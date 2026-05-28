const { TextractClient, StartDocumentTextDetectionCommand, GetDocumentTextDetectionCommand } = require("@aws-sdk/client-textract");
const { RekognitionClient, DetectLabelsCommand, DetectTextCommand } = require("@aws-sdk/client-rekognition");
const { TranslateClient, TranslateTextCommand } = require("@aws-sdk/client-translate");
const { BedrockRuntimeClient, InvokeModelCommand, ConverseCommand } = require("@aws-sdk/client-bedrock-runtime");
const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { PutCommand, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require("@aws-sdk/client-apigatewaymanagementapi");
const { v4: uuidv4 } = require("uuid");
const dynamoDb = require("../dynamodbClient");

const REGION = process.env.REGION || "us-east-1";
const RESOURCES_BUCKET = process.env.RESOURCES_BUCKET;

// DB 테이블명 및 웹소켓 엔드포인트 환경변수
const MESSAGES_TABLE = process.env.MESSAGES_TABLE;
const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE;
const WSS_ENDPOINT = process.env.WSS_ENDPOINT;

const textract    = new TextractClient({ region: REGION });
const rekognition = new RekognitionClient({ region: REGION });
const translate   = new TranslateClient({ region: REGION });
const bedrock     = new BedrockRuntimeClient({ region: REGION });
const s3          = new S3Client({ region: REGION });

// Textract 결과 폴링 (비동기 작업 완료 대기)
async function waitForTextract(jobId) {
  let status = "IN_PROGRESS";
  let result;
  while (status === "IN_PROGRESS") {
    await new Promise(r => setTimeout(r, 3000));
    result = await textract.send(new GetDocumentTextDetectionCommand({ JobId: jobId }));
    status = result.JobStatus;
  }
  if (status !== "SUCCEEDED") {
    throw new Error(`Textract 작업 실패: ${status}`);
  }
  return result.Blocks
    .filter(b => b.BlockType === "LINE")
    .map(b => b.Text)
    .join("\n");
}

// Bedrock Claude로 요약 생성
async function summarizeWithBedrock(text) {
  const prompt = `다음 문서 내용을 한국어로 간결하게 요약해주세요. 핵심 포인트를 불렛으로 정리해주세요.\n\n${text.slice(0, 4000)}`;
  const response = await bedrock.send(new InvokeModelCommand({
    modelId: "anthropic.claude-3-haiku-20240307-v1:0",
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify({
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    }),
  }));
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));
  return responseBody.content[0].text;
}

// PDF를 Bedrock Converse로 직접 분석 (Textract 우회 — 한국어 OCR 정확)
async function summarizeWithBedrockPdf(s3ObjectKey) {
  const obj = await s3.send(new GetObjectCommand({ Bucket: RESOURCES_BUCKET, Key: s3ObjectKey }));
  const chunks = [];
  const pdfBytes = Buffer.from(await obj.Body.transformToByteArray());

  const response = await bedrock.send(new ConverseCommand({
    modelId: "anthropic.claude-3-haiku-20240307-v1:0",
    messages: [{
      role: "user",
      content: [
        { document: { format: "pdf", name: "doc", source: { bytes: pdfBytes } } },
        { text: "이 문서를 한국어로 간결하게 요약해주세요. 핵심 포인트를 불렛으로 정리해주세요." }
      ]
    }],
    inferenceConfig: { maxTokens: 1024 },
  }));
  return response.output.message.content[0].text;
}



// =========================
// SQS 트리거 핸들러
// =========================
exports.handler = async (event) => {
  const records = event.Records || [];

  if (records.length === 0) {
    console.warn("aiRouter: 처리할 SQS 메시지가 없습니다.");
    return { statusCode: 200 };
  }

  // BatchSize=1로 설정 예정이지만, 혹시 모르니 루프 처리
  for (const record of records) {
    try {
      const body = JSON.parse(record.body || "{}");
      await processAiAnalysis(body);
    } catch (error) {
      console.error("aiRouter 메시지 처리 실패:", error);
      // throw하면 SQS가 VisibilityTimeout 후 재시도 (maxReceiveCount까지)
      throw error;
    }
  }

  return { statusCode: 200 };
};

// =========================
// AI 분석 메인 로직
// =========================
async function processAiAnalysis(body) {
  const { s3ObjectKey, fileType, serverId, fileName, requestId } = body;

  // 검증 실패는 재시도 의미 없음. 로그만 남기고 종료.
  if (!s3ObjectKey || !fileType) {
    console.warn("aiRouter 필수 파라미터 누락:", { s3ObjectKey, fileType });
    return;
  }

  let result = {};

  // ── 1. PDF/문서 → Bedrock 요약 ──
  if (fileType.includes("pdf") || fileType.includes("document")) {
    const summary = await summarizeWithBedrockPdf(s3ObjectKey);
    result = {
      type: "document",
      status: "COMPLETE",
      fileName: fileName || s3ObjectKey.split("/").pop(),
      summary,
    };
  }
  // ── 2. 이미지 → Rekognition + Translate ──
  else if (fileType.startsWith("image/")) {
    const labelsResponse = await rekognition.send(new DetectLabelsCommand({
      Image: { S3Object: { Bucket: RESOURCES_BUCKET, Name: s3ObjectKey } },
      MaxLabels: 10,
      MinConfidence: 70,
    }));
    const labels = labelsResponse.Labels.map(l => ({ name: l.Name, confidence: Math.round(l.Confidence) }));

    const textResponse = await rekognition.send(new DetectTextCommand({
      Image: { S3Object: { Bucket: RESOURCES_BUCKET, Name: s3ObjectKey } },
    }));
    const detectedTexts = textResponse.TextDetections.filter(t => t.Type === "LINE").map(t => t.DetectedText);

    const labelNames = labels.map(l => l.name).join(", ");
    let labelsKo = [];
    if (labelNames) {
      const translateResponse = await translate.send(new TranslateTextCommand({
        Text: labelNames, SourceLanguageCode: "en", TargetLanguageCode: "ko",
      }));
      labelsKo = translateResponse.TranslatedText.split(", ");
    }

    result = {
      type: "image",
      status: "COMPLETE",
      fileName: fileName || s3ObjectKey.split("/").pop(),
      labels, labelsKo, detectedTexts,
    };
  } else {
    result = {
      type: "unsupported",
      status: "SKIPPED",
      message: "지원하지 않는 파일 형식입니다. (PDF, 이미지만 분석 가능)",
    };
  }

  // ── DB에 메시지 저장 및 브로드캐스트 ──
  if (serverId && result.status === "COMPLETE") {
    const messageId = uuidv4();
    const createdAt = new Date().toISOString();

    const messageItem = {
      serverId,
      messageId,
      senderId: "system-ai",
      senderNickname: "AI 스터디 조교",
      messageType: "ai-summary",
      content: JSON.stringify(result),
      createdAt,
      ...(requestId && { aiRequestId: requestId }),
    };

    // 1. Messages 테이블에 저장
    await dynamoDb.send(new PutCommand({
      TableName: MESSAGES_TABLE,
      Item: messageItem,
    }));

    // 2. 같은 서버 접속자에게 실시간 브로드캐스트
    if (WSS_ENDPOINT) {
      const apigw = new ApiGatewayManagementApiClient({ endpoint: WSS_ENDPOINT });

      const response = await dynamoDb.send(new QueryCommand({
        TableName: CONNECTIONS_TABLE,
        IndexName: "serverId-index",
        KeyConditionExpression: "serverId = :serverId",
        ExpressionAttributeValues: { ":serverId": serverId },
      }));

      const connections = response.Items || [];

      await Promise.all(
        connections.map(async (conn) => {
          try {
            await apigw.send(new PostToConnectionCommand({
              ConnectionId: conn.connectionId,
              Data: Buffer.from(JSON.stringify({
                action: "receiveMessage",
                data: messageItem,
              })),
            }));
          } catch (err) {
            console.log(`AI 결과 전송 실패 (정상): ${conn.connectionId}`);
          }
        })
      );
    } else {
      console.warn("WSS_ENDPOINT가 설정되지 않아 브로드캐스트를 생략합니다.");
    }

    console.log("aiRouter 분석 완료:", { messageId, serverId, requestId });
  }
}
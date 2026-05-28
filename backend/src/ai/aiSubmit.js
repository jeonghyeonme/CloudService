const { SQSClient, SendMessageCommand } = require("@aws-sdk/client-sqs");
const { PutCommand } = require("@aws-sdk/lib-dynamodb");
const { HEADERS } = require("../utils/response");
const dynamoDb = require("../dynamodbClient");

const REGION = process.env.REGION || "us-east-1";
const AI_QUEUE_URL = process.env.AI_QUEUE_URL;
const MESSAGES_TABLE = process.env.MESSAGES_TABLE;
const DEDUP_WINDOW_MS = 5 * 60 * 1000; // 같은 파일 5분 내 재분석 차단

const sqs = new SQSClient({ region: REGION });

const DEDUP_LOCK_PK = "AI_DEDUP_LOCK";

// 같은 파일의 중복 분석 요청 차단 (조건부 쓰기)
// - attribute_not_exists: 처음 요청
// - expiresAt < now: 이전 마커가 만료됨 (재분석 허용)
// 둘 다 아니면(진행 중) ConditionalCheckFailed → 중복
async function tryAcquireAnalysisLock(s3ObjectKey) {
  const now = Date.now();
  const expiresAt = now + DEDUP_WINDOW_MS;

  try {
    await dynamoDb.send(new PutCommand({
      TableName: MESSAGES_TABLE,
      Item: {
        serverId: DEDUP_LOCK_PK,
        messageId: s3ObjectKey,
        expiresAt,
        ttl: Math.floor(expiresAt / 1000), // TTL 활성화 시 자동 정리 (권한 없어도 무해)
        createdAt: new Date(now).toISOString(),
      },
      ConditionExpression: "attribute_not_exists(messageId) OR expiresAt < :now",
      ExpressionAttributeValues: { ":now": now },
    }));
    return true; // 락 획득 (처음 또는 만료 후)
  } catch (error) {
    if (error.name === "ConditionalCheckFailedException") {
      return false; // 이미 진행 중 (중복)
    }
    throw error;
  }
}

exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body || "{}");
    const { s3ObjectKey, fileType, serverId, fileName, requestId } = body;

    // 필수 파라미터 검증
    if (!s3ObjectKey || !fileType) {
      return {
        statusCode: 400,
        headers: HEADERS,
        body: JSON.stringify({ message: "s3ObjectKey, fileType은 필수입니다." }),
      };
    }

    if (!AI_QUEUE_URL) {
      console.error("AI_QUEUE_URL 환경변수가 설정되지 않았습니다.");
      return {
        statusCode: 500,
        headers: HEADERS,
        body: JSON.stringify({ message: "서버 설정 오류" }),
      };
    }

    const acquired = await tryAcquireAnalysisLock(s3ObjectKey);
    if (!acquired) {
      return {
        statusCode: 409,
        headers: HEADERS,
        body: JSON.stringify({
          message: "이미 분석 중이거나 최근에 분석한 파일입니다. 잠시 후 다시 시도해주세요.",
        }),
      };
    }

    // SQS에 작업 enqueue
    await sqs.send(new SendMessageCommand({
      QueueUrl: AI_QUEUE_URL,
      MessageBody: JSON.stringify({
        s3ObjectKey,
        fileType,
        serverId,
        fileName,
        requestId,
        submittedAt: new Date().toISOString(),
      }),
    }));

    // 즉시 202 Accepted 응답
    return {
      statusCode: 202,
      headers: HEADERS,
      body: JSON.stringify({
        message: "AI 분석 요청이 접수되었습니다. 완료되면 채팅창에 자동으로 결과가 표시됩니다.",
        requestId,
      }),
    };
  } catch (error) {
    console.error("aiSubmit 오류:", error);
    return {
      statusCode: 500,
      headers: HEADERS,
      body: JSON.stringify({
        message: "AI 분석 요청 처리 중 오류가 발생했습니다.",
        error: error.message,
      }),
    };
  }
};
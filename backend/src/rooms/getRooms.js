const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand } = require("@aws-sdk/lib-dynamodb");

// 로컬/운영 환경 분기 처리
const client = process.env.IS_OFFLINE
  ? new DynamoDBClient({
      region: "us-east-1",
      endpoint: "http://localhost:4566",
      credentials: {
        accessKeyId: "test",
        secretAccessKey: "test",
      },
    })
  : new DynamoDBClient();

const dynamoDb = DynamoDBDocumentClient.from(client);

exports.handler = async (event) => {
  try {
    const params = {
      TableName: process.env.ROOMS_TABLE,
    };

    // ScanCommand를 사용하여 모든 방 데이터 가져오기
    const result = await dynamoDb.send(new ScanCommand(params));

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
      body: JSON.stringify(result.Items),
    };
  } catch (error) {
    console.error("DynamoDB Scan Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "방 목록을 불러오는 중 오류가 발생했습니다.", error: error.message }),
    };
  }
};
const { QueryCommand, BatchGetCommand } = require("@aws-sdk/lib-dynamodb");
const dynamoDb = require("../dynamodbClient");
const { HEADERS } = require("../utils/response");

async function getUsersById(userIds) {
  const uniqueUserIds = [...new Set(userIds.filter(Boolean))];
  if (!uniqueUserIds.length || !process.env.USERS_TABLE) return {};

  const usersById = {};
  for (let i = 0; i < uniqueUserIds.length; i += 100) {
    const chunk = uniqueUserIds.slice(i, i + 100);
    const result = await dynamoDb.send(new BatchGetCommand({
      RequestItems: {
        [process.env.USERS_TABLE]: {
          Keys: chunk.map((userId) => ({ userId })),
        },
      },
    }));

    for (const user of result.Responses?.[process.env.USERS_TABLE] || []) {
      usersById[user.userId] = user;
    }
  }

  return usersById;
}

async function attachSenderProfiles(messages) {
  const senderIds = messages.map((message) => message.senderId).filter(Boolean);
  if (!senderIds.length) return messages;

  try {
    const usersById = await getUsersById(senderIds);
    return messages.map((message) => ({
      ...message,
      senderProfileImageUrl:
        usersById[message.senderId]?.profileImageUrl ??
        message.senderProfileImageUrl ??
        null,
    }));
  } catch (error) {
    console.warn("Failed to attach sender profile images:", error);
    return messages.map((message) => ({
      ...message,
      senderProfileImageUrl: message.senderProfileImageUrl || null,
    }));
  }
}

exports.handler = async (event) => {
  try {
    const serverId = event.pathParameters.serverId;
    const { keyword } = event.queryStringParameters || {};

    if (!serverId) {
      return {
        statusCode: 400,
        headers: HEADERS,
        body: JSON.stringify({ message: "serverId가 필요합니다." }),
      };
    }

    const params = {
      TableName: process.env.MESSAGES_TABLE,
      KeyConditionExpression: "serverId = :serverId",
      ExpressionAttributeValues: {
        ":serverId": serverId,
      },
      ScanIndexForward: true,
    };

    if (keyword && keyword.trim()) {
      params.FilterExpression =
        "contains(#content, :keyword) AND #messageType = :messageType AND (attribute_not_exists(#isDeleted) OR #isDeleted = :isDeleted)";
      params.ExpressionAttributeNames = {
        "#content": "content",
        "#messageType": "messageType",
        "#isDeleted": "isDeleted",
      };
      params.ExpressionAttributeValues[":keyword"] = keyword.trim();
      params.ExpressionAttributeValues[":messageType"] = "TEXT";
      params.ExpressionAttributeValues[":isDeleted"] = false;
    }

    const result = await dynamoDb.send(new QueryCommand(params));
    const messages = await attachSenderProfiles(result.Items || []);

    return {
      statusCode: 200,
      headers: HEADERS,
      body: JSON.stringify(messages),
    };
  } catch (error) {
    console.error("getMessages Error:", error);

    return {
      statusCode: 500,
      headers: HEADERS,
      body: JSON.stringify({ message: "메시지 조회 실패", error: error.message }),
    };
  }
};

const { QueryCommand } = require("@aws-sdk/lib-dynamodb");
const dynamoDb = require("../dynamodbClient");
const { ROLE, json, requireServerRole } = require("../servers/serverAccess");

exports.handler = async (event) => {
  try {
    const { serverId } = event.pathParameters || {};
    const access = await requireServerRole(event, serverId, ROLE.MEMBER);
    if (access.response) return access.response;

    const result = await dynamoDb.send(new QueryCommand({
      TableName: process.env.SERVER_MEMBERS_TABLE,
      IndexName: "serverId-index",
      KeyConditionExpression: "serverId = :sid",
      ExpressionAttributeValues: { ":sid": serverId },
      ScanIndexForward: true,
    }));

    const items = (result.Items || []).map((member) => ({
      userId: member.userId,
      serverId: member.serverId,
      nickname: member.nickname,
      profileImageUrl: member.profileImageUrl || null,
      role: member.role || "MEMBER",
      joinedAt: member.joinedAt,
      updatedAt: member.updatedAt,
    }));

    return json(200, { items });
  } catch (error) {
    console.error("listMembers Error:", error);
    return json(500, { message: "서버 멤버 목록 조회 실패", error: error.message });
  }
};

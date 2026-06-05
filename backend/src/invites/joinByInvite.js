const { GetCommand, TransactWriteCommand } = require("@aws-sdk/lib-dynamodb");
const dynamoDb = require("../dynamodbClient");
const { verifyAccessToken } = require("../utils");
const { json, normalizeMembers, isUserBanned } = require("../servers/serverAccess");
const { getInviteByCode, getInviteValidity } = require("./inviteUtils");

exports.handler = async (event) => {
  try {
    const authHeader = event.headers?.Authorization || event.headers?.authorization || "";
    const { userId, error } = verifyAccessToken(authHeader);

    if (error || !userId) {
      return json(401, { message: "인증이 필요합니다." });
    }

    const inviteCode = String(event.pathParameters?.inviteCode || "").trim().toUpperCase();
    if (!inviteCode) {
      return json(400, { message: "inviteCode가 필요합니다." });
    }

    const invite = await getInviteByCode(inviteCode);
    const validity = getInviteValidity(invite);
    if (!validity.valid) {
      return json(400, { message: validity.reason });
    }

    const serverResult = await dynamoDb.send(new GetCommand({
      TableName: process.env.SERVERS_TABLE,
      Key: { serverId: invite.serverId },
    }));

    const server = serverResult.Item;
    if (!server || server.status !== "ACTIVE") {
      return json(404, { message: "초대 대상 서버를 찾을 수 없습니다." });
    }

    if (isUserBanned(server, userId)) {
      return json(403, { message: "이 서버에서 차단된 사용자입니다." });
    }

    const membershipResult = await dynamoDb.send(new GetCommand({
      TableName: process.env.SERVER_MEMBERS_TABLE,
      Key: { userId, serverId: invite.serverId },
    }));

    if (membershipResult.Item) {
      return json(200, {
        message: "이미 참여 중인 서버입니다.",
        serverId: invite.serverId,
        alreadyMember: true,
      });
    }

    const currentCount = Number(server.currentCount || 0);
    const maxCapacity = Number(server.maxCapacity || 10);
    if (currentCount >= maxCapacity) {
      return json(403, { message: "서버 정원이 가득 찼습니다." });
    }

    const userResult = await dynamoDb.send(new GetCommand({
      TableName: process.env.USERS_TABLE,
      Key: { userId },
    }));
    const nickname = userResult.Item?.nickname || "Unknown";
    const profileImageUrl = userResult.Item?.profileImageUrl || null;
    const joinedAt = new Date().toISOString();
    const member = { userId, serverId: invite.serverId, nickname, profileImageUrl, role: "MEMBER", joinedAt };
    const updatedMembers = [...normalizeMembers(server), { userId, nickname, profileImageUrl, role: "MEMBER", joinedAt }];

    const inviteUpdate = {
      TableName: process.env.INVITES_TABLE,
      Key: { inviteId: invite.inviteId },
      UpdateExpression: "ADD #useCount :one",
      ConditionExpression: "attribute_not_exists(revokedAt)",
      ExpressionAttributeNames: { "#useCount": "useCount" },
      ExpressionAttributeValues: { ":one": 1 },
    };

    if (invite.maxUses !== undefined && invite.maxUses !== null) {
      inviteUpdate.ConditionExpression += " AND #useCount < :maxUses";
      inviteUpdate.ExpressionAttributeValues[":maxUses"] = Number(invite.maxUses);
    }

    await dynamoDb.send(new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: process.env.SERVER_MEMBERS_TABLE,
            Item: member,
            ConditionExpression: "attribute_not_exists(userId) AND attribute_not_exists(serverId)",
          },
        },
        {
          Update: {
            TableName: process.env.SERVERS_TABLE,
            Key: { serverId: invite.serverId },
            UpdateExpression: "SET members = :members, currentCount = :count",
            ExpressionAttributeValues: {
              ":members": updatedMembers,
              ":count": updatedMembers.length,
            },
          },
        },
        { Update: inviteUpdate },
      ],
    }));

    return json(200, {
      message: "초대 코드로 서버에 참여했습니다.",
      serverId: invite.serverId,
      alreadyMember: false,
    });
  } catch (error) {
    console.error("joinByInvite Error:", error);
    if (error.name === "ConditionalCheckFailedException") {
      return json(409, { message: "이미 처리되었거나 사용할 수 없는 초대 코드입니다." });
    }
    return json(500, { message: "초대 코드 서버 참여 실패", error: error.message });
  }
};

const { GetCommand, PutCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const dynamoDb = require("../dynamodbClient");
const { ROLE, json, parseBody, requireServerRole, normalizeMembers } = require("../servers/serverAccess");

exports.handler = async (event) => {
  try {
    const { serverId } = event.pathParameters || {};
    const access = await requireServerRole(event, serverId, ROLE.HOST);
    if (access.response) return access.response;

    const body = parseBody(event);
    const targetUserId = body.targetUserId || event.pathParameters?.targetUserId;

    if (!targetUserId || targetUserId === access.userId) {
      return json(400, { message: "위임할 대상 멤버를 지정해 주세요." });
    }

    const targetMembership = await dynamoDb.send(new GetCommand({
      TableName: process.env.SERVER_MEMBERS_TABLE,
      Key: { userId: targetUserId, serverId },
    }));

    if (!targetMembership.Item) {
      return json(404, { message: "대상 멤버를 찾을 수 없습니다." });
    }

    const oldHostMembership = access.membership || {
      userId: access.userId,
      serverId,
      nickname: access.server.hostNickname || "Previous Host",
      profileImageUrl: access.server.hostProfileImageUrl || null,
      joinedAt: access.server.createdAt || new Date().toISOString(),
    };

    const now = new Date().toISOString();
    const newHostNickname = targetMembership.Item.nickname || "New Host";
    const newHostProfileImageUrl = targetMembership.Item.profileImageUrl || null;
    let updatedMembers = normalizeMembers(access.server).map((member) => {
      if (member.userId === targetUserId) return { ...member, role: ROLE.HOST, nickname: newHostNickname, profileImageUrl: newHostProfileImageUrl };
      if (member.userId === access.userId) return { ...member, role: ROLE.MODERATOR };
      return member;
    });

    if (!updatedMembers.some((member) => member.userId === targetUserId)) {
      updatedMembers.push({
        userId: targetUserId,
        nickname: newHostNickname,
        profileImageUrl: newHostProfileImageUrl,
        role: ROLE.HOST,
        joinedAt: targetMembership.Item.joinedAt || now,
      });
    }

    if (!updatedMembers.some((member) => member.userId === access.userId)) {
      updatedMembers.push({
        userId: access.userId,
        nickname: oldHostMembership.nickname,
        profileImageUrl: oldHostMembership.profileImageUrl || null,
        role: ROLE.MODERATOR,
        joinedAt: oldHostMembership.joinedAt || now,
      });
    }

    await dynamoDb.send(new PutCommand({
      TableName: process.env.SERVER_MEMBERS_TABLE,
      Item: { ...oldHostMembership, role: ROLE.MODERATOR, updatedAt: now },
    }));

    await dynamoDb.send(new PutCommand({
      TableName: process.env.SERVER_MEMBERS_TABLE,
      Item: { ...targetMembership.Item, role: ROLE.HOST, updatedAt: now },
    }));

    await dynamoDb.send(new UpdateCommand({
      TableName: process.env.SERVERS_TABLE,
      Key: { serverId },
      UpdateExpression: "SET hostId = :hostId, hostNickname = :hostNickname, hostProfileImageUrl = :hostProfileImageUrl, members = :members, updatedAt = :updatedAt",
      ExpressionAttributeValues: {
        ":hostId": targetUserId,
        ":hostNickname": newHostNickname,
        ":hostProfileImageUrl": newHostProfileImageUrl,
        ":members": updatedMembers,
        ":updatedAt": now,
      },
    }));

    return json(200, {
      message: "방장 권한을 위임했습니다.",
      previousHostId: access.userId,
      hostId: targetUserId,
      hostNickname: newHostNickname,
    });
  } catch (error) {
    console.error("transferOwnership Error:", error);
    return json(500, { message: "방장 권한 위임 실패", error: error.message });
  }
};

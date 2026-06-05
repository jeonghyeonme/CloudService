const { GetCommand, DeleteCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const dynamoDb = require("../dynamodbClient");
const { ROLE, json, requireServerRole, normalizeMembers, canManageMember } = require("../servers/serverAccess");

exports.handler = async (event) => {
  try {
    const { serverId, targetUserId } = event.pathParameters || {};
    const access = await requireServerRole(event, serverId, ROLE.MODERATOR);
    if (access.response) return access.response;

    if (!targetUserId || targetUserId === access.userId) {
      return json(400, { message: "자기 자신은 차단할 수 없습니다." });
    }

    if (targetUserId === access.server.hostId) {
      return json(403, { message: "방장은 차단할 수 없습니다." });
    }

    const targetMembership = await dynamoDb.send(new GetCommand({
      TableName: process.env.SERVER_MEMBERS_TABLE,
      Key: { userId: targetUserId, serverId },
    }));

    const targetRole = targetMembership.Item?.role || ROLE.MEMBER;
    if (!canManageMember(access.role, targetRole)) {
      return json(403, { message: "동급 또는 상위 권한의 멤버는 차단할 수 없습니다." });
    }

    const userResult = await dynamoDb.send(new GetCommand({
      TableName: process.env.USERS_TABLE,
      Key: { userId: targetUserId },
    }));

    if (!targetMembership.Item && !userResult.Item) {
      return json(404, { message: "대상 사용자를 찾을 수 없습니다." });
    }

    const bannedMembers = Array.isArray(access.server.bannedMembers) ? access.server.bannedMembers : [];
    const alreadyBanned = bannedMembers.some((member) => member.userId === targetUserId);
    const bannedAt = new Date().toISOString();
    const banEntry = {
      userId: targetUserId,
      nickname: targetMembership.Item?.nickname || userResult.Item?.nickname || "Unknown",
      profileImageUrl: targetMembership.Item?.profileImageUrl || userResult.Item?.profileImageUrl || null,
      bannedBy: access.userId,
      bannedAt,
    };

    const updatedBannedMembers = alreadyBanned
      ? bannedMembers.map((member) => member.userId === targetUserId ? { ...member, ...banEntry } : member)
      : [...bannedMembers, banEntry];

    if (targetMembership.Item) {
      await dynamoDb.send(new DeleteCommand({
        TableName: process.env.SERVER_MEMBERS_TABLE,
        Key: { userId: targetUserId, serverId },
      }));
    }

    const updatedMembers = normalizeMembers(access.server).filter((member) => member.userId !== targetUserId);
    await dynamoDb.send(new UpdateCommand({
      TableName: process.env.SERVERS_TABLE,
      Key: { serverId },
      UpdateExpression: "SET members = :members, currentCount = :count, bannedMembers = :bannedMembers",
      ExpressionAttributeValues: {
        ":members": updatedMembers,
        ":count": updatedMembers.length,
        ":bannedMembers": updatedBannedMembers,
      },
    }));

    return json(200, { message: "멤버를 차단했습니다.", ban: banEntry });
  } catch (error) {
    console.error("banMember Error:", error);
    return json(500, { message: "멤버 차단 실패", error: error.message });
  }
};

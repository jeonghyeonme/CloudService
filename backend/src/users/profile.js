const { GetCommand, QueryCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const dynamoDb = require("../dynamodbClient");
const { verifyAccessToken } = require("../utils");
const { HEADERS } = require("../utils/response");

const USERS_TABLE = process.env.USERS_TABLE;
const SERVERS_TABLE = process.env.SERVERS_TABLE;
const SERVER_MEMBERS_TABLE = process.env.SERVER_MEMBERS_TABLE;

function json(statusCode, payload) {
  return {
    statusCode,
    headers: HEADERS,
    body: JSON.stringify(payload),
  };
}

function getAuthUserId(event) {
  const authHeader = event.headers?.Authorization || event.headers?.authorization || "";
  const { userId, error } = verifyAccessToken(authHeader);
  return { userId, error };
}

function parseBody(event) {
  try {
    return JSON.parse(event.body || "{}");
  } catch {
    return null;
  }
}

function normalizeNickname(value) {
  if (typeof value !== "string") return null;
  return value.trim().replace(/\s+/g, " ");
}

function publicUser(user = {}) {
  return {
    userId: user.userId,
    nickname: user.nickname,
    profileImageUrl: user.profileImageUrl || null,
    status: user.status,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function privateUser(user = {}) {
  return {
    ...publicUser(user),
    email: user.email,
  };
}

async function getUser(userId) {
  if (!userId) return null;
  const result = await dynamoDb.send(new GetCommand({
    TableName: USERS_TABLE,
    Key: { userId },
  }));
  return result.Item || null;
}

async function syncNicknameToMemberships(userId, nickname, updatedAt) {
  const memberships = await dynamoDb.send(new QueryCommand({
    TableName: SERVER_MEMBERS_TABLE,
    KeyConditionExpression: "userId = :userId",
    ExpressionAttributeValues: { ":userId": userId },
  }));

  for (const membership of memberships.Items || []) {
    await dynamoDb.send(new UpdateCommand({
      TableName: SERVER_MEMBERS_TABLE,
      Key: { userId, serverId: membership.serverId },
      UpdateExpression: "SET #nickname = :nickname, updatedAt = :updatedAt",
      ExpressionAttributeNames: { "#nickname": "nickname" },
      ExpressionAttributeValues: {
        ":nickname": nickname,
        ":updatedAt": updatedAt,
      },
    }));

    const serverResult = await dynamoDb.send(new GetCommand({
      TableName: SERVERS_TABLE,
      Key: { serverId: membership.serverId },
    }));
    const server = serverResult.Item;
    if (!server) continue;

    const members = Array.isArray(server.members) ? server.members : [];
    const nextMembers = members.map((member) =>
      member.userId === userId ? { ...member, nickname } : member
    );
    const membersChanged = JSON.stringify(nextMembers) !== JSON.stringify(members);
    const hostChanged = server.hostId === userId && server.hostNickname !== nickname;

    if (!membersChanged && !hostChanged) continue;

    const updateNames = {};
    const updateValues = { ":updatedAt": updatedAt };
    const updateParts = ["updatedAt = :updatedAt"];

    if (membersChanged) {
      updateNames["#members"] = "members";
      updateValues[":members"] = nextMembers;
      updateParts.push("#members = :members");
    }

    if (hostChanged) {
      updateNames["#hostNickname"] = "hostNickname";
      updateValues[":hostNickname"] = nickname;
      updateParts.push("#hostNickname = :hostNickname");
    }

    await dynamoDb.send(new UpdateCommand({
      TableName: SERVERS_TABLE,
      Key: { serverId: membership.serverId },
      UpdateExpression: `SET ${updateParts.join(", ")}`,
      ...(Object.keys(updateNames).length ? { ExpressionAttributeNames: updateNames } : {}),
      ExpressionAttributeValues: updateValues,
    }));
  }
}

exports.getMe = async (event) => {
  try {
    const { userId, error } = getAuthUserId(event);
    if (error || !userId) {
      return json(401, { message: "인증이 필요합니다." });
    }

    const user = await getUser(userId);
    if (!user) {
      return json(404, { message: "사용자를 찾을 수 없습니다." });
    }

    return json(200, { user: privateUser(user) });
  } catch (error) {
    console.error("getMe Error:", error);
    return json(500, { message: "프로필 조회 실패", error: error.message });
  }
};

exports.getUser = async (event) => {
  try {
    const { userId: requesterId, error } = getAuthUserId(event);
    if (error || !requesterId) {
      return json(401, { message: "인증이 필요합니다." });
    }

    const targetUserId = event.pathParameters?.userId;
    if (!targetUserId) {
      return json(400, { message: "userId가 필요합니다." });
    }

    const user = await getUser(targetUserId);
    if (!user) {
      return json(404, { message: "사용자를 찾을 수 없습니다." });
    }

    return json(200, {
      user: targetUserId === requesterId ? privateUser(user) : publicUser(user),
    });
  } catch (error) {
    console.error("getUser Error:", error);
    return json(500, { message: "사용자 조회 실패", error: error.message });
  }
};

exports.updateMe = async (event) => {
  try {
    const { userId, error } = getAuthUserId(event);
    if (error || !userId) {
      return json(401, { message: "인증이 필요합니다." });
    }

    const body = parseBody(event);
    if (!body) {
      return json(400, { message: "요청 본문이 올바른 JSON 형식이 아닙니다." });
    }

    const nickname = normalizeNickname(body.nickname);
    if (!nickname) {
      return json(422, { message: "닉네임을 입력해 주세요." });
    }

    if (nickname.length > 30) {
      return json(422, { message: "닉네임은 30자 이하로 입력해 주세요." });
    }

    const currentUser = await getUser(userId);
    if (!currentUser) {
      return json(404, { message: "사용자를 찾을 수 없습니다." });
    }

    const updatedAt = new Date().toISOString();
    const result = await dynamoDb.send(new UpdateCommand({
      TableName: USERS_TABLE,
      Key: { userId },
      UpdateExpression: "SET #nickname = :nickname, updatedAt = :updatedAt",
      ExpressionAttributeNames: { "#nickname": "nickname" },
      ExpressionAttributeValues: {
        ":nickname": nickname,
        ":updatedAt": updatedAt,
      },
      ReturnValues: "ALL_NEW",
    }));

    if (currentUser.nickname !== nickname) {
      await syncNicknameToMemberships(userId, nickname, updatedAt);
    }

    return json(200, {
      message: "프로필이 수정되었습니다.",
      user: privateUser(result.Attributes),
    });
  } catch (error) {
    console.error("updateMe Error:", error);
    return json(500, { message: "프로필 수정 실패", error: error.message });
  }
};

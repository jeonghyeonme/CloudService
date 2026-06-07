const { GetCommand, QueryCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require("@aws-sdk/client-apigatewaymanagementapi");
const dynamoDb = require("../dynamodbClient");
const { verifyAccessToken } = require("../utils");
const { HEADERS } = require("../utils/response");
const {
  ALLOWED_TYPES,
  assertObjectExists,
  deleteObjectIfExists,
  getFileExtension,
  getFileUrl,
  isImageType,
} = require("../resources/uploadPolicy");

const USERS_TABLE = process.env.USERS_TABLE;
const SERVERS_TABLE = process.env.SERVERS_TABLE;
const SERVER_MEMBERS_TABLE = process.env.SERVER_MEMBERS_TABLE;
const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE;
const WSS_ENDPOINT = process.env.WSS_ENDPOINT;

function json(statusCode, payload) {
  return {
    statusCode,
    headers: HEADERS,
    body: JSON.stringify(payload),
  };
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key);
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
    profileImage: user.profileImage || null,
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

function normalizeProfileImageBody(body) {
  const s3ObjectKey = typeof body?.s3ObjectKey === "string" ? body.s3ObjectKey.trim() : "";
  const fileType = typeof body?.fileType === "string" ? body.fileType.trim() : "";
  const fileNameFromKey = s3ObjectKey.split("/").pop() || "";
  const fileName = typeof body?.fileName === "string" && body.fileName.trim()
    ? body.fileName.trim()
    : fileNameFromKey;
  const fileExtension = getFileExtension(s3ObjectKey);

  if (!s3ObjectKey || !fileType) {
    return {
      error: {
        statusCode: 422,
        payload: { message: "s3ObjectKey and fileType are required." },
      },
    };
  }

  if (!s3ObjectKey.startsWith("uploads/")) {
    return {
      error: {
        statusCode: 422,
        payload: { message: "Profile images must use the uploads/ S3 path." },
      },
    };
  }

  if (!ALLOWED_TYPES[fileType] || !isImageType(fileType, fileExtension)) {
    return {
      error: {
        statusCode: 422,
        payload: { message: "Only supported image files can be used as profile images." },
      },
    };
  }

  return {
    fileName,
    fileType,
    fileUrl: getFileUrl(s3ObjectKey),
    s3ObjectKey,
  };
}

function getProfileImageAction(body) {
  if (body.removeProfileImage === true || body.profileImage === null || body.profileImageUrl === null) {
    return { type: "remove" };
  }

  const hasProfileFields =
    hasOwn(body, "profileImage") ||
    hasOwn(body, "s3ObjectKey") ||
    hasOwn(body, "fileType") ||
    hasOwn(body, "fileName") ||
    hasOwn(body, "profileImageUrl");

  if (!hasProfileFields) {
    return { type: "none" };
  }

  const source = body.profileImage && typeof body.profileImage === "object"
    ? body.profileImage
    : body;
  const image = normalizeProfileImageBody(source);

  if (image.error) {
    return { type: "error", error: image.error };
  }

  return { type: "set", image };
}

async function syncUserProfileToMemberships(userId, changes, updatedAt) {
  if (!SERVER_MEMBERS_TABLE || !SERVERS_TABLE) return;

  const memberships = await dynamoDb.send(new QueryCommand({
    TableName: SERVER_MEMBERS_TABLE,
    KeyConditionExpression: "userId = :userId",
    ExpressionAttributeValues: { ":userId": userId },
  }));

  for (const membership of memberships.Items || []) {
    const memberNames = {};
    const memberValues = { ":updatedAt": updatedAt };
    const memberParts = ["updatedAt = :updatedAt"];

    if (hasOwn(changes, "nickname")) {
      memberNames["#nickname"] = "nickname";
      memberValues[":nickname"] = changes.nickname;
      memberParts.push("#nickname = :nickname");
    }

    if (hasOwn(changes, "profileImageUrl")) {
      memberNames["#profileImageUrl"] = "profileImageUrl";
      memberValues[":profileImageUrl"] = changes.profileImageUrl;
      memberParts.push("#profileImageUrl = :profileImageUrl");
    }

    await dynamoDb.send(new UpdateCommand({
      TableName: SERVER_MEMBERS_TABLE,
      Key: { userId, serverId: membership.serverId },
      UpdateExpression: `SET ${memberParts.join(", ")}`,
      ...(Object.keys(memberNames).length ? { ExpressionAttributeNames: memberNames } : {}),
      ExpressionAttributeValues: memberValues,
    }));

    const serverResult = await dynamoDb.send(new GetCommand({
      TableName: SERVERS_TABLE,
      Key: { serverId: membership.serverId },
    }));
    const server = serverResult.Item;
    if (!server) continue;

    const members = Array.isArray(server.members) ? server.members : [];
    const nextMembers = members.map((member) => {
      if (member.userId !== userId) return member;

      return {
        ...member,
        ...(hasOwn(changes, "nickname") ? { nickname: changes.nickname } : {}),
        ...(hasOwn(changes, "profileImageUrl") ? { profileImageUrl: changes.profileImageUrl } : {}),
      };
    });
    const membersChanged = JSON.stringify(nextMembers) !== JSON.stringify(members);
    const hostNicknameChanged =
      server.hostId === userId &&
      hasOwn(changes, "nickname") &&
      server.hostNickname !== changes.nickname;
    const hostProfileImageChanged =
      server.hostId === userId &&
      hasOwn(changes, "profileImageUrl") &&
      (server.hostProfileImageUrl || null) !== (changes.profileImageUrl || null);

    if (!membersChanged && !hostNicknameChanged && !hostProfileImageChanged) continue;

    const updateNames = {};
    const updateValues = { ":updatedAt": updatedAt };
    const updateParts = ["updatedAt = :updatedAt"];

    if (membersChanged) {
      updateNames["#members"] = "members";
      updateValues[":members"] = nextMembers;
      updateParts.push("#members = :members");
    }

    if (hostNicknameChanged) {
      updateNames["#hostNickname"] = "hostNickname";
      updateValues[":hostNickname"] = changes.nickname;
      updateParts.push("#hostNickname = :hostNickname");
    }

    if (hostProfileImageChanged) {
      updateNames["#hostProfileImageUrl"] = "hostProfileImageUrl";
      updateValues[":hostProfileImageUrl"] = changes.profileImageUrl;
      updateParts.push("#hostProfileImageUrl = :hostProfileImageUrl");
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

// 프로필(닉네임/이미지) 변경 시 사용자가 참여한 모든 서버 접속자에게 WebSocket 알림
async function broadcastProfileChange(userId, changes) {
  if (!CONNECTIONS_TABLE || !WSS_ENDPOINT) {
    console.warn("브로드캐스트 환경변수 누락(CONNECTIONS_TABLE/WSS_ENDPOINT), 스킵");
    return;
  }
  if (!Object.keys(changes).length) return;

  // 1. 이 사용자가 참여한 모든 서버 조회
  const memberships = await dynamoDb.send(new QueryCommand({
    TableName: SERVER_MEMBERS_TABLE,
    KeyConditionExpression: "userId = :userId",
    ExpressionAttributeValues: { ":userId": userId },
  }));

  const serverIds = (memberships.Items || []).map((m) => m.serverId);
  if (serverIds.length === 0) return;

  const apigw = new ApiGatewayManagementApiClient({ endpoint: WSS_ENDPOINT });

  // 2. 각 서버별로 활성 접속자에게 브로드캐스트
  await Promise.all(serverIds.map(async (serverId) => {
    const connections = await dynamoDb.send(new QueryCommand({
      TableName: CONNECTIONS_TABLE,
      IndexName: "serverId-index",
      KeyConditionExpression: "serverId = :serverId",
      ExpressionAttributeValues: { ":serverId": serverId },
    }));

    await Promise.all(
      (connections.Items || []).map(async (conn) => {
        try {
          await apigw.send(new PostToConnectionCommand({
            ConnectionId: conn.connectionId,
            Data: Buffer.from(JSON.stringify({
              action: "profileChanged",
              data: { serverId, userId, ...changes },
            })),
          }));
        } catch (err) {
          // 끊긴 connection은 무시 (정상)
          console.log(`프로필 브로드캐스트 실패 (정상): ${conn.connectionId}`);
        }
      })
    );
  }));
}

exports.getMe = async (event) => {
  try {
    const { userId, error } = getAuthUserId(event);
    if (error || !userId) {
      return json(401, { message: "Authentication is required." });
    }

    const user = await getUser(userId);
    if (!user) {
      return json(404, { message: "User not found." });
    }

    return json(200, { user: privateUser(user) });
  } catch (error) {
    console.error("getMe Error:", error);
    return json(500, { message: "Failed to load profile.", error: error.message });
  }
};

exports.getUser = async (event) => {
  try {
    const { userId: requesterId, error } = getAuthUserId(event);
    if (error || !requesterId) {
      return json(401, { message: "Authentication is required." });
    }

    const targetUserId = event.pathParameters?.userId;
    if (!targetUserId) {
      return json(400, { message: "userId is required." });
    }

    const user = await getUser(targetUserId);
    if (!user) {
      return json(404, { message: "User not found." });
    }

    return json(200, {
      user: targetUserId === requesterId ? privateUser(user) : publicUser(user),
    });
  } catch (error) {
    console.error("getUser Error:", error);
    return json(500, { message: "Failed to load user.", error: error.message });
  }
};

exports.updateMe = async (event) => {
  try {
    const { userId, error } = getAuthUserId(event);
    if (error || !userId) {
      return json(401, { message: "Authentication is required." });
    }

    const body = parseBody(event);
    if (!body) {
      return json(400, { message: "Request body must be valid JSON." });
    }

    const nicknameProvided = hasOwn(body, "nickname");
    const profileImageAction = getProfileImageAction(body);

    if (!nicknameProvided && profileImageAction.type === "none") {
      return json(422, { message: "nickname or profileImage is required." });
    }

    const nickname = nicknameProvided ? normalizeNickname(body.nickname) : null;
    if (nicknameProvided && !nickname) {
      return json(422, { message: "nickname is required." });
    }

    if (nickname && nickname.length > 30) {
      return json(422, { message: "nickname must be 30 characters or fewer." });
    }

    if (profileImageAction.error) {
      return json(profileImageAction.error.statusCode, profileImageAction.error.payload);
    }

    const currentUser = await getUser(userId);
    if (!currentUser) {
      return json(404, { message: "User not found." });
    }

    if (profileImageAction.type === "set") {
      try {
        await assertObjectExists(profileImageAction.image.s3ObjectKey);
      } catch (s3Error) {
        console.error("Profile image S3 validation failed:", s3Error);
        return json(400, {
          message: "The uploaded profile image does not exist in S3 or is not accessible.",
        });
      }
    }

    const updatedAt = new Date().toISOString();
    const updateNames = {};
    const updateValues = { ":updatedAt": updatedAt };
    const setParts = ["updatedAt = :updatedAt"];
    const removeParts = [];
    const syncChanges = {};

    if (nicknameProvided) {
      updateNames["#nickname"] = "nickname";
      updateValues[":nickname"] = nickname;
      setParts.push("#nickname = :nickname");
      if (currentUser.nickname !== nickname) {
        syncChanges.nickname = nickname;
      }
    }

    if (profileImageAction.type === "set") {
      const profileImageItem = {
        fileName: profileImageAction.image.fileName,
        fileUrl: profileImageAction.image.fileUrl,
        fileType: profileImageAction.image.fileType,
        s3ObjectKey: profileImageAction.image.s3ObjectKey,
        uploadedAt: updatedAt,
      };

      updateValues[":profileImageUrl"] = profileImageAction.image.fileUrl;
      updateValues[":profileImage"] = profileImageItem;
      setParts.push("profileImageUrl = :profileImageUrl", "profileImage = :profileImage");

      if ((currentUser.profileImageUrl || null) !== profileImageAction.image.fileUrl) {
        syncChanges.profileImageUrl = profileImageAction.image.fileUrl;
      }
    }

    if (profileImageAction.type === "remove") {
      removeParts.push("profileImageUrl", "profileImage");
      if (currentUser.profileImageUrl) {
        syncChanges.profileImageUrl = null;
      }
    }

    const updateExpression = [
      `SET ${setParts.join(", ")}`,
      ...(removeParts.length ? [`REMOVE ${removeParts.join(", ")}`] : []),
    ].join(" ");

    const result = await dynamoDb.send(new UpdateCommand({
      TableName: USERS_TABLE,
      Key: { userId },
      UpdateExpression: updateExpression,
      ...(Object.keys(updateNames).length ? { ExpressionAttributeNames: updateNames } : {}),
      ExpressionAttributeValues: updateValues,
      ReturnValues: "ALL_NEW",
    }));

    if (profileImageAction.type === "set" && !result.Attributes?.profileImageUrl) {
      return json(500, { message: "Profile image URL was not saved." });
    }

    if (Object.keys(syncChanges).length) {
      await syncUserProfileToMemberships(userId, syncChanges, updatedAt);
      await broadcastProfileChange(userId, syncChanges);
    }

    const oldS3ObjectKey = currentUser.profileImage?.s3ObjectKey;
    const nextS3ObjectKey = profileImageAction.image?.s3ObjectKey;
    if (
      oldS3ObjectKey &&
      (profileImageAction.type === "remove" ||
        (profileImageAction.type === "set" && oldS3ObjectKey !== nextS3ObjectKey))
    ) {
      await deleteObjectIfExists(oldS3ObjectKey).catch((deleteError) => {
        console.warn("Profile image delete failed:", deleteError);
      });
    }

    return json(200, {
      message: "Profile updated successfully.",
      user: privateUser(result.Attributes),
    });
  } catch (error) {
    console.error("updateMe Error:", error);
    return json(500, { message: "Failed to update profile.", error: error.message });
  }
};

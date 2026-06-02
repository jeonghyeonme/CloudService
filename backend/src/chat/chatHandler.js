const {
  PutCommand,
  UpdateCommand,
  QueryCommand,
  DeleteCommand,
  GetCommand,
} = require("@aws-sdk/lib-dynamodb");
const {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} = require("@aws-sdk/client-apigatewaymanagementapi");
const { v4: uuidv4 } = require("uuid");

const dynamoDb = require("../dynamodbClient");

const SERVERS_TABLE     = process.env.SERVERS_TABLE;
const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE;
const MESSAGES_TABLE    = process.env.MESSAGES_TABLE;
const SERVER_MEMBERS_TABLE = process.env.SERVER_MEMBERS_TABLE;
const USERS_TABLE = process.env.USERS_TABLE;


// =========================
// WebSocket 클라이언트 생성
// =========================
function getApigwClient(domain, stage) {
  const isOffline =
    process.env.IS_OFFLINE === "true" || process.env.IS_OFFLINE === true;

  const endpoint = isOffline
    ? process.env.WS_MANAGEMENT_ENDPOINT || "http://localhost:4001"
    : `https://${domain}/${stage}`;

  return new ApiGatewayManagementApiClient({
    endpoint,
  });
}

// 특정 connectionId로 메시지 전송
async function sendToConnection(apigw, connectionId, data) {
  try {
    await apigw.send(new PostToConnectionCommand({
      ConnectionId: connectionId,
      Data: Buffer.from(JSON.stringify(data)),
    }));
  } catch (err) {
    console.error("PostToConnection 실패:", {
      connectionId,
      name: err.name,
      message: err.message,
    });

    await dynamoDb.send(new UpdateCommand({
      TableName: CONNECTIONS_TABLE,
      Key: { connectionId },
      UpdateExpression: "SET serverId = :none",
      ExpressionAttributeValues: { ":none": "DISCONNECTED" },
    })).catch(() => {});
  }
}


// =========================
// $connect — WebSocket 연결 시 호출
// =========================
async function onConnect(event) {
  const connectionId = event.requestContext.connectionId;

  await dynamoDb.send(new PutCommand({
    TableName: CONNECTIONS_TABLE,
    Item: {
      connectionId,
      connectedAt: new Date().toISOString(),
      expiresAt:   Math.floor(Date.now() / 1000) + 3600, // 1시간 TTL
    },
  }));

  return { statusCode: 200 };
}


// =========================
// $disconnect — WebSocket 연결 해제 시 호출
// =========================
async function onDisconnect(event) {
  const connectionId = event.requestContext.connectionId;
  const domain = event.requestContext.domainName;
  const stage = event.requestContext.stage;
  const apigw = getApigwClient(domain, stage);

  // 1. 끊긴 connection의 serverId, userId 조회 (브로드캐스트용)
  const connResult = await dynamoDb.send(new GetCommand({
    TableName: CONNECTIONS_TABLE,
    Key: { connectionId },
  })).catch(() => null);

  const serverId = connResult?.Item?.serverId;
  const userId = connResult?.Item?.userId;

  // 2. CONNECTIONS 테이블 업데이트 (DISCONNECTED)
  await dynamoDb.send(new UpdateCommand({
    TableName: CONNECTIONS_TABLE,
    Key: { connectionId },
    UpdateExpression: "SET serverId = :none",
    ExpressionAttributeValues: { ":none": "DISCONNECTED" }
  })).catch(() => {});

  // 3. 같은 서버 다른 접속자들에게 userLeft 브로드캐스트
  if (serverId && serverId !== "DISCONNECTED" && userId) {
    const response = await dynamoDb.send(new QueryCommand({
      TableName: CONNECTIONS_TABLE,
      IndexName: "serverId-index",
      KeyConditionExpression: "serverId = :serverId",
      ExpressionAttributeValues: { ":serverId": serverId },
    }));
    const connections = response.Items || [];

    await Promise.all(
      connections
        .filter((c) => c.connectionId !== connectionId)
        .map((conn) =>
          sendToConnection(apigw, conn.connectionId, {
            action: "userLeft",
            data: { serverId, userId },
          })
        )
    );
  }

  return { statusCode: 200 };
}


// =========================
// 방 생성
// =========================
async function createServer(body) {
  const serverId    = uuidv4();
  const createdAt = new Date().toISOString();

  await dynamoDb.send(new PutCommand({
    TableName: SERVERS_TABLE,
    Item: {
      serverId,
      serverName:     body.serverName,
      hostId:       body.hostId,
      maxCapacity:  body.maxCapacity ?? 10,
      currentCount: 0,
      status:       "ACTIVE",               
      createdAt,
      expiresAt:    Math.floor(Date.now() / 1000) + 86400, // 24시간 TTL
    },
  }));

  return {
    statusCode: 200,
    body: JSON.stringify({ action: "createServer", serverId }),
  };
}


// =========================
// 방 입장
// =========================
async function joinServer(connectionId, body, event) {
  const domain = event.requestContext.domainName;
  const stage = event.requestContext.stage;
  const apigw = getApigwClient(domain, stage);

  const { serverId, userId } = body;

  // 1. 해당 connection에 serverId, userId 연결
  await dynamoDb.send(new UpdateCommand({
    TableName:                 CONNECTIONS_TABLE,
    Key:                       { connectionId },
    UpdateExpression:          "SET serverId = :r, userId = :u",
    ExpressionAttributeValues: { ":r": serverId, ":u": userId },
  }));

  // 2. ServerMembers 테이블에서 이미 멤버인지 확인
  let isAlreadyMember = false;
  if (SERVER_MEMBERS_TABLE && userId) {
    const memberResult = await dynamoDb.send(new GetCommand({
      TableName: SERVER_MEMBERS_TABLE,
      Key: { userId, serverId },
    })).catch(() => null);
    isAlreadyMember = Boolean(memberResult?.Item);
  }

  // 3. 이미 멤버가 아닐 때만 currentCount +1
  if (!isAlreadyMember) {
    await dynamoDb.send(new UpdateCommand({
      TableName:                 SERVERS_TABLE,
      Key:                       { serverId },
      UpdateExpression:          "SET currentCount = if_not_exists(currentCount, :zero) + :inc",
      ExpressionAttributeValues: { ":inc": 1, ":zero": 0 },
    }));
  }

  let joiningUser = null;
  if (userId && USERS_TABLE) {
    const userResult = await dynamoDb.send(new GetCommand({
      TableName: USERS_TABLE,
      Key: { userId },
    })).catch(() => null);
    joiningUser = userResult?.Item || null;
  }

  // 4. 같은 서버 모든 접속자 조회
  const response = await dynamoDb.send(new QueryCommand({
    TableName: CONNECTIONS_TABLE,
    IndexName: "serverId-index",
    KeyConditionExpression: "serverId = :serverId",
    ExpressionAttributeValues: { ":serverId": serverId },
  }));
  const connections = response.Items || [];

  // 5. 본인에게 현재 온라인 유저 ID 리스트 전송 (자기 포함)
  const onlineUserIds = [...new Set(
    connections.map((c) => c.userId).filter(Boolean)
  )];
  await sendToConnection(apigw, connectionId, {
    action: "onlineMembers",
    data: { serverId, onlineUserIds },
  });

  // 5. 다른 접속자들에게 userJoined 브로드캐스트 (본인 제외)
  await Promise.all(
    connections
      .filter((c) => c.connectionId !== connectionId)
      .map((conn) =>
        sendToConnection(apigw, conn.connectionId, {
          action: "userJoined",
          data: {
            serverId,
            userId,
            nickname: joiningUser?.nickname,
            profileImageUrl: joiningUser?.profileImageUrl || null,
          },
        })
      )
  );

  return {
    statusCode: 200,
    body: JSON.stringify({ action: "joinServer", serverId, isAlreadyMember }),
  };
}


// =========================
// 메시지 전송
// =========================
async function sendMessage(event, body) {
  const connectionId = event.requestContext.connectionId;
  const domain       = event.requestContext.domainName;
  const stage        = event.requestContext.stage;

  const apigw   = getApigwClient(domain, stage);
  const { serverId } = body;

  const messageId = body.messageId || uuidv4();
  const createdAt = body.createdAt || new Date().toISOString();

  const item = {
    serverId,
    channelId: body.channelId,
    messageId,
    // clientMessageId: body.clientMessageId || undefined,
    ...(body.clientMessageId && { clientMessageId: body.clientMessageId }),
    senderId:       body.senderId,
    senderNickname: body.senderNickname,
    messageType:    body.messageType,
    createdAt,
  };

  if (body.senderId && USERS_TABLE) {
    try {
      const userResult = await dynamoDb.send(new GetCommand({
        TableName: USERS_TABLE,
        Key: { userId: body.senderId },
      }));
      item.senderProfileImageUrl = userResult.Item?.profileImageUrl || body.senderProfileImageUrl || null;
    } catch (error) {
      console.warn("sender profile image lookup failed:", error);
      item.senderProfileImageUrl = body.senderProfileImageUrl || null;
    }
  } else {
    item.senderProfileImageUrl = body.senderProfileImageUrl || null;
  }

  if (body.messageType === "TEXT") {
    item.content = body.content;
  }

  if (body.messageType === "IMAGE") {
    item.content = body.content || "";
    item.imageUrl = body.imageUrl || body.fileUrl || "";
    item.fileUrl = body.fileUrl || body.imageUrl || "";
    item.fileName = body.fileName || "";
    item.fileType = body.fileType || "";
    item.fileId = body.fileId || "";
    item.s3ObjectKey = body.s3ObjectKey || "";
  }

  if (body.messageType === "FILE") {
    item.content = body.content || body.fileName || "";
    item.fileUrl = body.fileUrl || "";
    item.fileName = body.fileName || "";
    item.fileType = body.fileType || "";
    item.fileId = body.fileId || "";
    item.s3ObjectKey = body.s3ObjectKey || "";
  }

  if (body.messageType === "LINK") {
    item.content = body.content || "";
    item.linkUrl = body.linkUrl || "";
    item.linkName = body.linkName || "";
  }

  // Messages 테이블에 저장
  await dynamoDb.send(new PutCommand({
    TableName: MESSAGES_TABLE,
    Item:      item,
  }));

  // serverId-index GSI로 같은 방 접속자 전체 조회
  const response = await dynamoDb.send(new QueryCommand({
    TableName:                 CONNECTIONS_TABLE,
    IndexName:                 "serverId-index",
    KeyConditionExpression:    "serverId = :serverId",
    ExpressionAttributeValues: { ":serverId": serverId },
  }));

  const connections = response.Items || [];

  // 같은 방 모든 접속자에게 동시 브로드캐스트
  await Promise.all(
    connections.map((conn) =>
      sendToConnection(apigw, conn.connectionId, {
        action: "receiveMessage",
        data:   item,
      })
    )
  );

  return { statusCode: 200 };
}


// =========================
// 메시지 수정
// =========================
async function updateMessage(event, body) {
  const domain = event.requestContext.domainName;
  const stage = event.requestContext.stage;
  const apigw = getApigwClient(domain, stage);

  const { serverId, messageId, senderId, content } = body;

  if (!serverId || !messageId || !senderId || !content) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "serverId, messageId, senderId, content가 필요합니다." }),
    };
  }

  const updatedAt = new Date().toISOString();

  const result = await dynamoDb.send(new UpdateCommand({
    TableName: MESSAGES_TABLE,
    Key: {
      serverId,
      messageId,
    },
    UpdateExpression: `
      SET content = :content,
          updatedAt = :updatedAt,
          isEdited = :isEdited
    `,
    ConditionExpression: "senderId = :senderId",
    ExpressionAttributeValues: {
      ":content": content,
      ":updatedAt": updatedAt,
      ":isEdited": true,
      ":senderId": senderId,
    },
    ReturnValues: "ALL_NEW",
  }));

  const updatedMessage = result.Attributes;

  const response = await dynamoDb.send(new QueryCommand({
    TableName: CONNECTIONS_TABLE,
    IndexName: "serverId-index",
    KeyConditionExpression: "serverId = :serverId",
    ExpressionAttributeValues: {
      ":serverId": serverId,
    },
  }));

  const connections = response.Items || [];

  await Promise.all(
    connections.map((conn) =>
      sendToConnection(apigw, conn.connectionId, {
        action: "messageUpdated",
        data: updatedMessage,
      })
    )
  );

  return {
    statusCode: 200,
    body: JSON.stringify(updatedMessage),
  };
}


// =========================
// 메시지 삭제 - 소프트 삭제
// =========================
async function deleteMessage(event, body) {
  const domain = event.requestContext.domainName;
  const stage = event.requestContext.stage;
  const apigw = getApigwClient(domain, stage);

  const { serverId, messageId, senderId } = body;

  if (!serverId || !messageId || !senderId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "serverId, messageId, senderId가 필요합니다." }),
    };
  }

  const deletedAt = new Date().toISOString();

  const result = await dynamoDb.send(new UpdateCommand({
    TableName: MESSAGES_TABLE,
    Key: {
      serverId,
      messageId,
    },
    UpdateExpression: `
      SET isDeleted = :isDeleted,
          deletedAt = :deletedAt,
          content = :content
    `,
    ConditionExpression: "senderId = :senderId",
    ExpressionAttributeValues: {
      ":isDeleted": true,
      ":deletedAt": deletedAt,
      ":content": "삭제된 메시지입니다.",
      ":senderId": senderId,
    },
    ReturnValues: "ALL_NEW",
  }));

  const deletedMessage = result.Attributes;

  const response = await dynamoDb.send(new QueryCommand({
    TableName: CONNECTIONS_TABLE,
    IndexName: "serverId-index",
    KeyConditionExpression: "serverId = :serverId",
    ExpressionAttributeValues: {
      ":serverId": serverId,
    },
  }));

  const connections = response.Items || [];

  await Promise.all(
    connections.map((conn) =>
      sendToConnection(apigw, conn.connectionId, {
        action: "messageDeleted",
        data: deletedMessage,
      })
    )
  );

  return {
    statusCode: 200,
    body: JSON.stringify(deletedMessage),
  };
}

// =========================
// AI 분석 시작 알림 브로드캐스트
// =========================
async function aiAnalysisStarted(event, body) {
  const domain = event.requestContext.domainName;
  const stage = event.requestContext.stage;
  const apigw = getApigwClient(domain, stage);

  const { serverId, fileName, requestId, requestedBy } = body;

  if (!serverId || !requestId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "serverId, requestId가 필요합니다." }),
    };
  }

  const response = await dynamoDb.send(new QueryCommand({
    TableName: CONNECTIONS_TABLE,
    IndexName: "serverId-index",
    KeyConditionExpression: "serverId = :serverId",
    ExpressionAttributeValues: { ":serverId": serverId },
  }));

  const connections = response.Items || [];

  await Promise.all(
    connections.map((conn) =>
      sendToConnection(apigw, conn.connectionId, {
        action: "aiAnalysisStarted",
        data: { serverId, fileName, requestId, requestedBy, startedAt: new Date().toISOString() },
      })
    )
  );

  return { statusCode: 200 };
}

// =========================
// 리소스 업데이트 브로드캐스트
// =========================
async function resourceUpdated(event, body) {
  const domain = event.requestContext.domainName;
  const stage = event.requestContext.stage;
  const apigw = getApigwClient(domain, stage);

  const { serverId, resourceType, resourceAction, data: resourceData } = body;

  if (!serverId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "serverId가 필요합니다." }),
    };
  }

  // 같은 서버 접속자 전체 조회
  const response = await dynamoDb.send(new QueryCommand({
    TableName: CONNECTIONS_TABLE,
    IndexName: "serverId-index",
    KeyConditionExpression: "serverId = :serverId",
    ExpressionAttributeValues: { ":serverId": serverId },
  }));

  const connections = response.Items || [];

  // 프론트가 보낸 형식 그대로 전달 (resourceType, resourceAction, data 포함)
  await Promise.all(
    connections.map((conn) =>
      sendToConnection(apigw, conn.connectionId, {
        action: "resourceUpdated",
        data: {
          serverId,
          resourceType,
          resourceAction,
          data: resourceData,
          updatedAt: new Date().toISOString(),
        },
      })
    )
  );

  return { statusCode: 200 };
}


// =========================
// 메인 핸들러 — API Gateway WebSocket 라우팅
// =========================
module.exports.handler = async (event) => {
  const routeKey = event.requestContext.routeKey;

  try {
    if (routeKey === "$connect")    return await onConnect(event);
    if (routeKey === "$disconnect") return await onDisconnect(event);

    const body = JSON.parse(event.body || "{}");

    if (routeKey === "createServer")  return await createServer(body);
    if (routeKey === "joinServer")    return await joinServer(event.requestContext.connectionId, body, event);
    if (routeKey === "sendMessage") return await sendMessage(event, body);
    if (routeKey === "updateMessage") return await updateMessage(event, body);
    if (routeKey === "deleteMessage") return await deleteMessage(event, body);
    if (routeKey === "resourceUpdated") return await resourceUpdated(event, body);
    if (routeKey === "aiAnalysisStarted") return await aiAnalysisStarted(event, body);

    return { statusCode: 200 };

  } catch (error) {
    console.error("chatHandler Error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};

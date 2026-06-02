const { GetCommand, PutCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const dynamoDb = require("../dynamodbClient");
const { verifyAccessToken } = require("../utils");
const { HEADERS } = require("../utils/response");
const { isUserBanned } = require("./serverAccess");

exports.handler = async (event) => {
  try {
    const { serverId } = event.pathParameters || {};
    const authHeader =
      event.headers?.Authorization || event.headers?.authorization || "";
    const { userId } = verifyAccessToken(authHeader);

    if (!userId) {
      return {
        statusCode: 401,
        headers: HEADERS,
        body: JSON.stringify({ message: "인증이 필요합니다." }),
      };
    }

    if (!serverId) {
      return {
        statusCode: 400,
        headers: HEADERS,
        body: JSON.stringify({ message: "serverId가 필요합니다." }),
      };
    }

    // 1. 서버 존재 여부 확인
    const serverResult = await dynamoDb.send(new GetCommand({
      TableName: process.env.SERVERS_TABLE,
      Key: { serverId },
    }));

    if (!serverResult.Item) {
      return {
        statusCode: 404,
        headers: HEADERS,
        body: JSON.stringify({ message: "해당 서버를 찾을 수 없습니다." }),
      };
    }

    // 2. 이미 참여 중인지 ServerMembers 테이블에서 확인
    const membershipResult = await dynamoDb.send(new GetCommand({
      TableName: process.env.SERVER_MEMBERS_TABLE,
      Key: { userId, serverId },
    }));

    if (membershipResult.Item) {
      return {
        statusCode: 200,
        headers: HEADERS,
        body: JSON.stringify({
          message: "이미 참여 중인 서버입니다.",
          serverId,
          alreadyMember: true,
        }),
      };
    }

    // 3. 영구 차단 사용자 재입장 방지
    if (isUserBanned(serverResult.Item, userId)) {
      return {
        statusCode: 403,
        headers: HEADERS,
        body: JSON.stringify({ message: "이 서버에서 차단된 사용자입니다." }),
      };
    }

    // 4. 정원 초과 체크
    const currentCount = serverResult.Item.currentCount || 0;
    const maxCapacity = serverResult.Item.maxCapacity || 10;
    if (currentCount >= maxCapacity) {
      return {
        statusCode: 403,
        headers: HEADERS,
        body: JSON.stringify({ message: "서버 정원이 가득 찼습니다." }),
      };
    }

    // 5. 비밀번호 검증 (비공개 서버)
    if (serverResult.Item.serverPassword) {
      const body = JSON.parse(event.body || "{}");

      if (!body.serverPassword || body.serverPassword !== serverResult.Item.serverPassword) {
        return {
          statusCode: 403,
          headers: HEADERS,
          body: JSON.stringify({ message: "비밀번호가 올바르지 않습니다." }),
        };
      }
    }

    // 6. Users 테이블에서 nickname 조회
    const userResult = await dynamoDb.send(new GetCommand({
      TableName: process.env.USERS_TABLE,
      Key: { userId },
    }));
    const nickname = userResult.Item?.nickname || "Unknown";
    const profileImageUrl = userResult.Item?.profileImageUrl || null;

    // 7. ServerMembers 테이블에 멤버십 추가
    const joinedAt = new Date().toISOString();
    await dynamoDb.send(new PutCommand({
      TableName: process.env.SERVER_MEMBERS_TABLE,
      Item: { userId, serverId, nickname, profileImageUrl, role: "MEMBER", joinedAt },
    }));

    // 8. Servers 테이블의 members 배열과 currentCount 업데이트
    const currentMembers = Array.isArray(serverResult.Item.members) ? serverResult.Item.members : [];
    const newMembers = [...currentMembers, { userId, nickname, profileImageUrl, role: "MEMBER", joinedAt }];

    await dynamoDb.send(new UpdateCommand({
      TableName: process.env.SERVERS_TABLE,
      Key: { serverId },
      UpdateExpression: "SET members = :members, currentCount = :count",
      ExpressionAttributeValues: {
        ":members": newMembers,
        ":count": newMembers.length,
      },
    }));

    return {
      statusCode: 200,
      headers: HEADERS,
      body: JSON.stringify({ message: "서버 참여 성공", serverId, alreadyMember: false }),
    };
  } catch (error) {
    console.error("joinServer Error:", error);
    return {
      statusCode: 500,
      headers: HEADERS,
      body: JSON.stringify({ message: "서버 참여 실패", error: error.message }),
    };
  }
};

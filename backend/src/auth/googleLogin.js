const { HEADERS } = require("../utils/response");
const { OAuth2Client } = require("google-auth-library");
const { QueryCommand, PutCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { v4: uuidv4 } = require("uuid");

const dynamoDb = require("../dynamodbClient");
const {
  createAccessToken,
  createRefreshToken,
  saveRefreshToken,
} = require("../utils");

const USERS_TABLE = process.env.USERS_TABLE;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// =========================
// 구글 로그인
// =========================
module.exports.handler = async (event) => {
  try {
    if (!GOOGLE_CLIENT_ID) {
      return {
        statusCode: 500,
        headers: HEADERS,
        body: JSON.stringify({ detail: "GOOGLE_CLIENT_ID가 설정되지 않았습니다." }),
      };
    }

    const body = JSON.parse(event.body || "{}");
    const { idToken } = body;

    if (!idToken) {
      return {
        statusCode: 400,
        headers: HEADERS,
        body: JSON.stringify({ detail: "idToken이 필요합니다." }),
      };
    }

    // 1. Google id_token 검증
    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch (verifyError) {
      console.error("Google id_token 검증 실패:", verifyError);
      return {
        statusCode: 401,
        headers: HEADERS,
        body: JSON.stringify({ detail: "유효하지 않은 Google 토큰입니다." }),
      };
    }

    const { email, name, picture, sub: googleId, email_verified } = payload;

    if (!email_verified) {
      return {
        statusCode: 403,
        headers: HEADERS,
        body: JSON.stringify({ detail: "Google 이메일이 인증되지 않았습니다." }),
      };
    }

    // 2. Users 테이블에서 email로 기존 사용자 조회 (email-index GSI)
    const existingUserResult = await dynamoDb.send(new QueryCommand({
      TableName: USERS_TABLE,
      IndexName: "email-index",
      KeyConditionExpression: "email = :email",
      ExpressionAttributeValues: { ":email": email },
      Limit: 1,
    }));

    let userData;
    const now = new Date().toISOString();

    if (existingUserResult.Items && existingUserResult.Items.length > 0) {
      // 기존 사용자 → googleId 없으면 추가
      userData = existingUserResult.Items[0];
      if (!userData.googleId) {
        await dynamoDb.send(new UpdateCommand({
          TableName: USERS_TABLE,
          Key: { userId: userData.userId },
          UpdateExpression: "SET googleId = :gid, provider = :p, updatedAt = :u",
          ExpressionAttributeValues: {
            ":gid": googleId,
            ":p": userData.provider || "hybrid",
            ":u": now,
          },
        }));
        userData.googleId = googleId;
        userData.provider = userData.provider || "hybrid";
      }
    } else {
      // 신규 사용자 자동 생성
      const userId = uuidv4();
      userData = {
        userId,
        email,
        nickname: name || email.split("@")[0],
        profileImageUrl: picture || null,
        googleId,
        provider: "google",
        status: "ACTIVE",
        createdAt: now,
        updatedAt: now,
      };
      await dynamoDb.send(new PutCommand({
        TableName: USERS_TABLE,
        Item: userData,
      }));
    }

    // 3. 토큰 발급 (userLogin.js와 동일한 패턴)
    const accessToken = createAccessToken({ sub: userData.userId });
    const refreshToken = createRefreshToken({ sub: userData.userId });

    await saveRefreshToken(userData.userId, refreshToken);

    return {
      statusCode: 200,
      headers: HEADERS,
      body: JSON.stringify({
        result: "success",
        nickname: userData.nickname,
        profileImageUrl: userData.profileImageUrl,
        access_token: accessToken,
        refresh_token: refreshToken,
      }),
    };
  } catch (error) {
    console.error("googleLogin Error:", error);
    return {
      statusCode: 500,
      headers: HEADERS,
      body: JSON.stringify({ detail: "서버 오류가 발생했습니다.", error: error.message }),
    };
  }
};
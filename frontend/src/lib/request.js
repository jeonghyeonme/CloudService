import { createApiUrl } from "../constants/endpoint";

export async function request(path, options = {}) {
  const url = createApiUrl(path);

  // localStorage에서 토큰 가져오기
  const accessToken = localStorage.getItem("accessToken");
  const authHeader = accessToken
    ? { Authorization: `Bearer ${accessToken}` }
    : {};

  let response;

  try {
    response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...authHeader,
        ...(options.headers || {}),
      },
      ...options,
    });
  } catch (error) {
    console.error("Fetch error:", error);

    throw new Error(
      "서버에 연결할 수 없습니다. 백엔드가 실행 중인지 확인해 주세요.",
    );
  }

  const contentType = response.headers.get("content-type") || "";
  const isJsonResponse = contentType.includes("application/json");
  const payload = isJsonResponse
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    // ✅ 백엔드가 detail 또는 message 어느 키로 보내든 둘 다 체크
    if (isJsonResponse) {
      throw new Error(
        payload.detail || payload.message || "요청에 실패했습니다.",
      );
    }
    throw new Error("서버가 JSON이 아닌 응답을 반환했습니다.");
  }

  if (!isJsonResponse) {
    throw new Error(
      "서버 응답 형식이 올바르지 않습니다. API 주소를 확인해 주세요.",
    );
  }

  return payload;
}

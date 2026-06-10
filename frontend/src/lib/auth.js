import { ENDPOINTS } from "../constants/endpoint";
import { request } from "./request";

// 회원가입
export function register(payload) {
  return request(ENDPOINTS.auth.register, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// 로그인
export function login(payload) {
  return request(ENDPOINTS.auth.login, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// 토큰 재발급
export function refreshAccessToken(refreshToken) {
  return request(ENDPOINTS.auth.refresh, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${refreshToken}`,
    },
  });
}

// 로그아웃
export function logout(refreshToken) {
  return request(ENDPOINTS.auth.logout, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${refreshToken}`,
    },
  });
}

// 구글 로그인
export function googleLogin(idToken) {
  return request(ENDPOINTS.auth.googleLogin, {
    method: "POST",
    body: JSON.stringify({ idToken }),
  });
}
/**
 * @description 앱 라우팅 경로 상수 및 동적 경로 생성 유틸
 * @modified Server 경로 기준으로 /servers 라우팅 사용
 */

export const PATHS = {
  home: "/",
  onboarding: "/onboarding",
  login: "/login",
  register: "/register",
  explore: "/explore",
  profileEdit: "/profile/edit",
  server: "/servers/:serverId",
};

export function getServerPath(serverId) {
  return `/servers/${serverId}`;
}

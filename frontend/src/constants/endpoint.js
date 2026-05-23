const API_HOST = process.env.REACT_APP_API_HOST || "http://localhost:4000/dev";

export const API_BASE_URL = API_HOST;
export const API_WS_URL =
  process.env.REACT_APP_WS_HOST ||
  process.env.REACT_APP_WS_URL ||
  "ws://localhost:4001";

export const ENDPOINTS = {
  auth: {
    register: "/userRegister",
    login: "/userLogin",
    refresh: "/token/refresh",
    logout: "/userLogout",
  },
  servers: {
    list: "/servers",
    mine: "/servers/me",
  },
  invites: {
    base: (serverId) => `/servers/${serverId}/invites`,
    item: (serverId, inviteId) => `/servers/${serverId}/invites/${inviteId}`,
    reset: (serverId) => `/servers/${serverId}/invites/reset`,
    validate: (code) => `/invites/${code}`,
    join: (code) => `/invites/${code}/join`,
  },
  moderation: {
    members: (serverId) => `/servers/${serverId}/members`,
    updateMemberRole: (serverId, targetUserId) =>
      `/servers/${serverId}/members/${targetUserId}/role`,
    kickMember: (serverId, targetUserId) =>
      `/servers/${serverId}/members/${targetUserId}/kick`,
    banMember: (serverId, targetUserId) =>
      `/servers/${serverId}/members/${targetUserId}/ban`,
    unbanMember: (serverId, targetUserId) =>
      `/servers/${serverId}/bans/${targetUserId}`,
    transferOwnership: (serverId) => `/servers/${serverId}/ownership`,
  },
};

export function createApiUrl(path) {
  return `${API_BASE_URL}${path}`;
}

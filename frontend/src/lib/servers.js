import { ENDPOINTS } from "../constants/endpoint";
import { request } from "./request";

export function getServers() {
  return request(ENDPOINTS.servers.list, { method: "GET", });
}

export function getMyServers() {
  return request(ENDPOINTS.servers.mine, { method: "GET", });
}

export function createServer(payload) {
  return request(ENDPOINTS.servers.list, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getServerDetail(serverId) {
  return request(`${ENDPOINTS.servers.list}/${serverId}`, { method: "GET", });
}

export function updateServer(serverId, payload) {
  return request(`${ENDPOINTS.servers.list}/${serverId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteServer(serverId) {
  return request(`${ENDPOINTS.servers.list}/${serverId}`, { method: "DELETE", });
}

export function leaveServer(serverId) {
  return request(`${ENDPOINTS.servers.list}/${serverId}/leave`, { method: "POST", });
}

export function getServerMessages(serverId, keyword) {
  const url = keyword?.trim()
    ? `${ENDPOINTS.servers.list}/${serverId}/messages?keyword=${encodeURIComponent(keyword.trim())}`
    : `${ENDPOINTS.servers.list}/${serverId}/messages`;
  return request(url, { method: "GET" });
}

export function joinServer(serverId, password) {
  const options = { method: "POST", };
  if (password) {
    options.body = JSON.stringify({ serverPassword: password });
  }
  return request(`${ENDPOINTS.servers.list}/${serverId}/join`, options);
}

export function createChannel(serverId, payload) {
  return request(`${ENDPOINTS.servers.list}/${serverId}/channels`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function deleteChannel(serverId, channelId) {
  return request(`${ENDPOINTS.servers.list}/${serverId}/channels/${channelId}`, {
    method: "DELETE",
  });
}

export const updateChannel = async (serverId, chId, data) => {
  return await request(`/servers/${serverId}/channels/${chId}`, {
    method: "PUT",
    body: JSON.stringify({
      name: data.name,
      topic: data.topic
    }),
  });
};

export function listMembers(serverId) {
  return request(ENDPOINTS.moderation.members(serverId), {
    method: "GET",
  });
}

export function updateMemberRole(serverId, targetUserId, role) {
  return request(ENDPOINTS.moderation.updateMemberRole(serverId, targetUserId), {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
}

export function kickMember(serverId, targetUserId) {
  return request(ENDPOINTS.moderation.kickMember(serverId, targetUserId), {
    method: "POST",
  });
}

export function banMember(serverId, targetUserId) {
  return request(ENDPOINTS.moderation.banMember(serverId, targetUserId), {
    method: "POST",
  });
}

export function unbanMember(serverId, targetUserId) {
  return request(ENDPOINTS.moderation.unbanMember(serverId, targetUserId), {
    method: "DELETE",
  });
}

export function transferOwnership(serverId, targetUserId) {
  return request(ENDPOINTS.moderation.transferOwnership(serverId), {
    method: "POST",
    body: JSON.stringify({ targetUserId }),
  });
}

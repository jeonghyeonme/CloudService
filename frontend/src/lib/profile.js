import { ENDPOINTS } from "../constants/endpoint";
import { request } from "./request";

function hasPath(path) {
  return typeof path === "string" && path.trim() !== "";
}

export function canUseProfileReadApi() {
  return hasPath(ENDPOINTS.profile.me);
}

export function canUseProfileUpdateApi() {
  return hasPath(ENDPOINTS.profile.update);
}

export function getMyProfile() {
  if (!canUseProfileReadApi()) {
    return null;
  }

  return request(ENDPOINTS.profile.me, {
    method: "GET",
  });
}

export function updateMyProfile(payload) {
  if (!canUseProfileUpdateApi()) {
    throw new Error(
      "프로필 수정 API가 설정되지 않았습니다. REACT_APP_PROFILE_UPDATE_ENDPOINT를 확인해 주세요.",
    );
  }

  return request(ENDPOINTS.profile.update, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function getProfileImageUploadUrl(fileName, fileType) {
  const basePath = hasPath(ENDPOINTS.profile.uploadUrl)
    ? ENDPOINTS.profile.uploadUrl
    : ENDPOINTS.resources.uploadUrl;
  const params = new URLSearchParams({ fileName, fileType });
  return request(`${basePath}?${params.toString()}`, {
    method: "GET",
  });
}

export async function uploadProfileImage(file) {
  const { uploadUrl, fileUrl, s3ObjectKey } = await getProfileImageUploadUrl(
    file.name,
    file.type || "application/octet-stream",
  );

  const uploadResponse = await fetch(uploadUrl, {
    method: "PUT",
    body: file,
    headers: {
      "Content-Type": file.type || "application/octet-stream",
    },
  });

  if (!uploadResponse.ok) {
    throw new Error("프로필 이미지 업로드에 실패했습니다.");
  }

  return { fileUrl, s3ObjectKey };
}

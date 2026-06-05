import { ENDPOINTS } from "../constants/endpoint";
import { request } from "./request";

const DEFAULT_PROFILE_PATH = "/users/me";

const PROFILE_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "image/bmp",
  "image/tiff",
]);

const PROFILE_IMAGE_TYPES_BY_EXTENSION = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  bmp: "image/bmp",
  tif: "image/tiff",
  tiff: "image/tiff",
};

function hasPath(path) {
  return typeof path === "string" && path.trim() !== "";
}

function getProfileReadPath() {
  return hasPath(ENDPOINTS.profile.me)
    ? ENDPOINTS.profile.me
    : DEFAULT_PROFILE_PATH;
}

function getProfileUpdatePath() {
  return hasPath(ENDPOINTS.profile.update)
    ? ENDPOINTS.profile.update
    : DEFAULT_PROFILE_PATH;
}

export function canUseProfileReadApi() {
  return hasPath(getProfileReadPath());
}

export function canUseProfileUpdateApi() {
  return hasPath(getProfileUpdatePath());
}

export function getProfileImageContentType(file) {
  if (file?.type && PROFILE_IMAGE_TYPES.has(file.type)) {
    return file.type;
  }

  const extension = String(file?.name || "")
    .split(".")
    .pop()
    .toLowerCase();

  return PROFILE_IMAGE_TYPES_BY_EXTENSION[extension] || "";
}

export function getMyProfile() {
  if (!canUseProfileReadApi()) {
    return null;
  }

  return request(getProfileReadPath(), {
    method: "GET",
  });
}

export function updateMyProfile(payload) {
  if (!canUseProfileUpdateApi()) {
    throw new Error(
      "프로필 수정 API가 설정되지 않았습니다. REACT_APP_PROFILE_UPDATE_ENDPOINT를 확인해 주세요.",
    );
  }

  return request(getProfileUpdatePath(), {
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

export async function uploadProfileImage(file, profilePayload = {}) {
  if (!file) {
    throw new Error("프로필 이미지를 선택해 주세요.");
  }

  const fileType = getProfileImageContentType(file);
  if (!PROFILE_IMAGE_TYPES.has(fileType)) {
    throw new Error("프로필 사진은 이미지 파일만 사용할 수 있습니다.");
  }

  const { uploadUrl, fileUrl, s3ObjectKey } = await getProfileImageUploadUrl(
    file.name,
    fileType,
  );

  if (!uploadUrl || !s3ObjectKey) {
    throw new Error("S3 업로드 URL을 발급받지 못했습니다.");
  }

  const uploadResponse = await fetch(uploadUrl, {
    method: "PUT",
    body: file,
    headers: {
      "Content-Type": fileType,
    },
  });

  if (!uploadResponse.ok) {
    throw new Error(`S3 프로필 이미지 업로드에 실패했습니다. (${uploadResponse.status})`);
  }

  const result = await updateMyProfile({
    ...profilePayload,
    profileImage: {
      fileName: file.name,
      fileType,
      fileUrl,
      s3ObjectKey,
    },
  });

  if (!result?.user?.profileImageUrl) {
    throw new Error("프로필 이미지가 DB에 저장되지 않았습니다. /users/me API 배포 상태를 확인해 주세요.");
  }

  return result;
}

export function removeProfileImage(profilePayload = {}) {
  return updateMyProfile({
    ...profilePayload,
    removeProfileImage: true,
  });
}

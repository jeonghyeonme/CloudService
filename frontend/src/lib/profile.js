import { getUploadUrl } from "./resources";
import { request } from "./request";

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

export function updateProfile(payload) {
  return request("/users/me", {
    method: "PATCH",
    body: JSON.stringify(payload),
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

  const { uploadUrl, fileUrl, s3ObjectKey } = await getUploadUrl(file.name, fileType);
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

  const result = await updateProfile({
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
  return updateProfile({
    ...profilePayload,
    removeProfileImage: true,
  });
}

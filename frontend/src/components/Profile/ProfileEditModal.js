import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import {
  canUseProfileUpdateApi,
  updateMyProfile,
  uploadProfileImage,
} from "../../lib/profile";
import "./ProfileEditModal.css";

const MAX_PROFILE_IMAGE_SIZE = 5 * 1024 * 1024;

function getInitialChar(nickname) {
  if (!nickname) return "프";
  return nickname.trim().charAt(0).toUpperCase();
}

function resolveProfilePayload(result) {
  if (!result || typeof result !== "object") return null;
  return result.user || result.profile || result.data || result;
}

const ProfileEditModal = ({ open, onClose }) => {
  const { user, updateUser } = useAuth();
  const toast = useToast();
  const [nickname, setNickname] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isProfileUpdateEnabled = canUseProfileUpdateApi();

  const displayImageUrl = previewUrl || user?.profileImageUrl || "";
  const profileInitial = useMemo(
    () => getInitialChar(nickname || user?.nickname),
    [nickname, user?.nickname],
  );

  useEffect(() => {
    if (!open) return;
    setNickname(user?.nickname || "");
    setSelectedFile(null);
    setPreviewUrl("");
  }, [open, user?.nickname]);

  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  if (!open) {
    return null;
  }

  const handleOverlayClick = (event) => {
    if (event.target === event.currentTarget && !isSubmitting) {
      onClose();
    }
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0] || null;
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("파일 형식 오류", "이미지 파일만 업로드할 수 있습니다.");
      return;
    }

    if (file.size > MAX_PROFILE_IMAGE_SIZE) {
      toast.error("파일 크기 초과", "프로필 이미지는 5MB 이하만 가능합니다.");
      return;
    }

    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const trimmedNickname = nickname.trim();

    if (!trimmedNickname) {
      toast.error("입력 확인", "닉네임을 입력해 주세요.");
      return;
    }
    if (!isProfileUpdateEnabled) {
      toast.error(
        "API 미설정",
        "백엔드 프로필 수정 API가 없습니다. 환경변수(REACT_APP_PROFILE_UPDATE_ENDPOINT) 연결 후 다시 시도해 주세요.",
      );
      return;
    }

    setIsSubmitting(true);

    try {
      let nextProfileImageUrl = user?.profileImageUrl || null;

      if (selectedFile) {
        const uploadResult = await uploadProfileImage(selectedFile);
        nextProfileImageUrl =
          uploadResult?.fileUrl || uploadResult?.profileImageUrl || nextProfileImageUrl;
      }

      const result = await updateMyProfile({
        nickname: trimmedNickname,
        profileImageUrl: nextProfileImageUrl,
      });

      const profile = resolveProfilePayload(result) || {};
      const syncedUser = {
        userId: user?.userId || null,
        nickname: profile.nickname ?? trimmedNickname,
        profileImageUrl:
          profile.profileImageUrl !== undefined
            ? profile.profileImageUrl
            : nextProfileImageUrl,
      };

      updateUser((prev) => ({ ...prev, ...syncedUser }));
      toast.success("프로필 저장 완료", "내 정보가 업데이트되었습니다.");
      onClose();
    } catch (error) {
      toast.error("프로필 저장 실패", error.message || "잠시 후 다시 시도해 주세요.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="profile-modal-overlay" onClick={handleOverlayClick}>
      <div
        className="profile-modal-card"
        role="dialog"
        aria-modal="true"
        aria-label="프로필 수정"
      >
        <button
          type="button"
          className="profile-modal-close"
          onClick={onClose}
          disabled={isSubmitting}
          aria-label="모달 닫기"
        >
          ✕
        </button>

        <h2 className="profile-modal-title">프로필 수정</h2>
        <p className="profile-modal-description">
          닉네임과 프로필 이미지를 변경할 수 있습니다.
        </p>

        <form className="profile-modal-form" onSubmit={handleSubmit}>
          <div className="profile-modal-avatar-row">
            {displayImageUrl ? (
              <img
                src={displayImageUrl}
                alt="프로필 미리보기"
                className="profile-modal-avatar-image"
              />
            ) : (
              <div className="profile-modal-avatar-fallback">{profileInitial}</div>
            )}

            <label
              className="profile-modal-upload-button"
              htmlFor="profile-image-input"
            >
              이미지 선택
            </label>
            <input
              id="profile-image-input"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              disabled={isSubmitting}
            />
          </div>

          <label className="profile-modal-label" htmlFor="profile-nickname-input">
            닉네임
          </label>
          <input
            id="profile-nickname-input"
            className="profile-modal-input"
            type="text"
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            maxLength={20}
            required
            disabled={isSubmitting}
            placeholder="닉네임을 입력하세요"
          />

          <div className="profile-modal-actions">
            <button
              type="button"
              className="profile-modal-btn ghost"
              onClick={onClose}
              disabled={isSubmitting}
            >
              취소
            </button>
            <button
              type="submit"
              className="profile-modal-btn primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? "저장 중..." : "저장"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProfileEditModal;

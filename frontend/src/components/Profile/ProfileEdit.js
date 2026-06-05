import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PATHS } from "../../constants/path";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import {
  getProfileImageContentType,
  removeProfileImage,
  updateMyProfile,
  uploadProfileImage,
} from "../../lib/profile";
import "./ProfileEdit.css";

function ProfilePreview({ imageUrl, nickname }) {
  const initial = nickname ? nickname.charAt(0).toUpperCase() : "?";

  return (
    <div className={`profile-edit-avatar ${imageUrl ? "has-image" : ""}`}>
      {imageUrl ? (
        <img src={imageUrl} alt={nickname || "profile"} />
      ) : (
        <span>{initial}</span>
      )}
    </div>
  );
}

export default function ProfileEdit() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user, updateUser } = useAuth();
  const fileInputRef = useRef(null);
  const [nickname, setNickname] = useState(user?.nickname || "");
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setNickname(user?.nickname || "");
  }, [user?.nickname]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const normalizedNickname = nickname.trim().replace(/\s+/g, " ");
  const currentImageUrl = previewUrl || user?.profileImageUrl || "";

  const resetSelectedFile = () => {
    setPreviewUrl("");
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!getProfileImageContentType(file)) {
      toast.error("이미지 선택 필요", "프로필 사진은 이미지 파일만 사용할 수 있습니다.");
      event.target.value = "";
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const applyProfileResult = (result) => {
    updateUser({
      nickname: result.user?.nickname || normalizedNickname,
      profileImageUrl: result.user?.profileImageUrl || null,
    });
  };

  const handleSave = async () => {
    if (!normalizedNickname) {
      toast.error("저장 실패", "닉네임을 입력해 주세요.");
      return;
    }

    setIsSaving(true);
    try {
      const payload = { nickname: normalizedNickname };
      const fileToUpload = selectedFile || fileInputRef.current?.files?.[0] || null;
      const result = fileToUpload
        ? await uploadProfileImage(fileToUpload, payload)
        : await updateMyProfile(payload);

      applyProfileResult(result);
      resetSelectedFile();
      toast.success("프로필 저장", "프로필 변경사항을 적용했습니다.");
    } catch (error) {
      toast.error("저장 실패", error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!normalizedNickname) {
      toast.error("삭제 실패", "닉네임을 입력해 주세요.");
      return;
    }

    setIsSaving(true);
    try {
      const result = await removeProfileImage({ nickname: normalizedNickname });
      applyProfileResult(result);
      resetSelectedFile();
      toast.success("프로필 삭제", "프로필 사진을 제거했습니다.");
    } catch (error) {
      toast.error("삭제 실패", error.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="profile-edit-page">
      <section className="profile-edit-panel">
        <div className="profile-edit-header">
          <button
            type="button"
            className="profile-edit-back"
            onClick={() => navigate(PATHS.explore)}
          >
            뒤로
          </button>
          <div>
            <h1>프로필 편집</h1>
            <p>{user?.email || user?.nickname || "사용자"}</p>
          </div>
        </div>

        <div className="profile-edit-form">
          <label className="profile-edit-field" htmlFor="profile-nickname">
            <span className="profile-edit-label">닉네임</span>
            <input
              id="profile-nickname"
              className="profile-edit-input"
              type="text"
              value={nickname}
              maxLength={30}
              onChange={(event) => setNickname(event.target.value)}
              disabled={isSaving}
              autoComplete="nickname"
              placeholder="닉네임을 입력해 주세요"
            />
          </label>

          <div className="profile-edit-body">
            <ProfilePreview imageUrl={currentImageUrl} nickname={normalizedNickname} />
            <div className="profile-edit-controls">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                hidden
              />
              <button
                type="button"
                className="profile-edit-button primary"
                onClick={() => fileInputRef.current?.click()}
                disabled={isSaving}
              >
                이미지 선택
              </button>
              <button
                type="button"
                className="profile-edit-button"
                onClick={handleSave}
                disabled={isSaving || !normalizedNickname}
              >
                적용
              </button>
              <button
                type="button"
                className="profile-edit-button danger"
                onClick={handleRemove}
                disabled={isSaving || (!user?.profileImageUrl && !selectedFile)}
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

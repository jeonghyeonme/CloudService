import React, { useState } from "react";
import FormModal from "./FormModal";
import InviteManager from "./InviteManager";
import "./InviteManager.css";

function EntitySettingsModal({
  open,
  entityType,
  entityName,
  description,
  fields,
  submitLabel = "설정 저장",
  cancelLabel = "취소",
  onClose,
  onSubmit,
  // ✅ 초대 코드 탭용 props
  serverId,
  isHost,
}) {
  const [activeTab, setActiveTab] = useState("settings");
  const resolvedTitle = entityType === "channel" ? "채널 설정" : "서버 설정";

  // 채널 설정이거나 초대 코드 탭 비활성화 시 기존 FormModal 그대로
  if (entityType === "channel") {
    return (
      <FormModal
        open={open}
        title={resolvedTitle}
        description={description || `${entityName || "현재 항목"}의 정보를 수정하고 저장할 수 있습니다.`}
        fields={fields}
        submitLabel={submitLabel}
        cancelLabel={cancelLabel}
        onClose={onClose}
        onSubmit={onSubmit}
      />
    );
  }

  if (!open) return null;

  return (
    <div className="form-modal__overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="form-modal" style={{ maxWidth: 560 }}>
        <button type="button" className="form-modal__close" onClick={onClose} aria-label="모달 닫기">✕</button>

        <div className="form-modal__header">
          <h2>{resolvedTitle}</h2>
          {/* ✅ 탭 */}
          <div className="entity-settings-tabs">
            <button
              type="button"
              className={`entity-settings-tab ${activeTab === "settings" ? "active" : ""}`}
              onClick={() => setActiveTab("settings")}
            >
              기본 설정
            </button>
            <button
              type="button"
              className={`entity-settings-tab ${activeTab === "invites" ? "active" : ""}`}
              onClick={() => setActiveTab("invites")}
            >
              🔗 초대 코드
            </button>
          </div>
        </div>

        {activeTab === "settings" ? (
          <FormModal
            open={true}
            title=""
            description={description || `${entityName || "현재 항목"}의 정보를 수정하고 저장할 수 있습니다.`}
            fields={fields}
            submitLabel={submitLabel}
            cancelLabel={cancelLabel}
            onClose={onClose}
            onSubmit={onSubmit}
            _embedded
          />
        ) : (
          <div style={{ padding: "0 24px 24px" }}>
            {serverId ? (
              <InviteManager serverId={serverId} />
            ) : (
              <p style={{ color: "#52525b", fontSize: "13px" }}>서버 정보를 불러올 수 없습니다.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default EntitySettingsModal;
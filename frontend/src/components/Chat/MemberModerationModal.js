import React from "react";
import "./MemberModerationModal.css";

function MemberModerationModal({
  open,
  serverName,
  members = [],
  bannedMembers = [],
  canManage,
  onClose,
  onRoleChange,
  onKick,
  onBan,
  onUnban,
  onTransferOwnership,
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="member-moderation-modal__overlay" onClick={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="member-moderation-modal">
        <div className="member-moderation-modal__header">
          <h2>{serverName} 멤버 관리</h2>
          <button type="button" onClick={onClose} aria-label="모달 닫기">×</button>
        </div>

        <div className="member-moderation-modal__section">
          <h3>멤버 목록</h3>
          <div className="member-moderation-modal__list">
            {members.map((member) => {
              const manageable = canManage(member);
              const isHost = member.role === "HOST";

              return (
                <div key={member.userId} className="member-moderation-row">
                  <div className="member-moderation-row__meta">
                    <strong>{member.nickname || "Unknown"}</strong>
                    <span>{member.userId}</span>
                  </div>
                  <div className="member-moderation-row__actions">
                    <span className={`member-role-badge role-${(member.role || "MEMBER").toLowerCase()}`}>
                      {member.role || "MEMBER"}
                    </span>
                    {!isHost ? (
                      <>
                        <select
                          value={member.role || "MEMBER"}
                          disabled={!manageable}
                          onChange={(e) => onRoleChange?.(member, e.target.value)}
                        >
                          <option value="MEMBER">MEMBER</option>
                          <option value="MODERATOR">MODERATOR</option>
                        </select>
                        <button type="button" disabled={!manageable} onClick={() => onKick?.(member)}>
                          강퇴
                        </button>
                        <button type="button" className="danger" disabled={!manageable} onClick={() => onBan?.(member)}>
                          차단
                        </button>
                      </>
                    ) : null}
                    {!isHost && manageable ? (
                      <button type="button" onClick={() => onTransferOwnership?.(member)}>
                        소유권 위임
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="member-moderation-modal__section">
          <h3>차단 목록</h3>
          <div className="member-moderation-modal__list">
            {bannedMembers.length === 0 ? (
              <p className="member-moderation-modal__empty">현재 차단된 멤버가 없습니다.</p>
            ) : (
              bannedMembers.map((member) => (
                <div key={member.userId} className="member-moderation-row">
                  <div className="member-moderation-row__meta">
                    <strong>{member.nickname || "Unknown"}</strong>
                    <span>{member.userId}</span>
                  </div>
                  <div className="member-moderation-row__actions">
                    <button type="button" onClick={() => onUnban?.(member)}>차단 해제</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default MemberModerationModal;

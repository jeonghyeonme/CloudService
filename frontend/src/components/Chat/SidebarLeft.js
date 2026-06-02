import React from "react";
import { useAuth } from "../../contexts/AuthContext";

function handleRightClick(event, callback, payload) {
  event.preventDefault();
  event.stopPropagation();
  callback?.(event, payload);
}

/**
 * @title 채널 목록과 참여자 패널이 있는 서버 내부 사이드바
 * @param {Array} onlineUserIds - 웹소켓으로 수신한 온라인 유저 ID 목록
 * @param {string} serverName - 현재 서버 이름
 * @param {Array} channels - 채널 목록 ({chId, name, label} 형태)
 * @param {string} activeChannel - 현재 활성화된 채널 ID
 * @param {function} onChannelClick - 채널 클릭 시 실행 (채널 ID 전달)
 * @param {function} onAddChannelClick - 채널 추가 버튼 클릭 시 실행
 * @param {Array} members - 서버 멤버 목록 ({userId, nickname, role} 형태)
 * @param {string} hostId - 서버 방장 userId (방장 태그 표시용)
 */

// ✅ 채널 목록 Skeleton UI
const ChannelSkeleton = () => (
  <div className="channel-skeleton-list">
    {[...Array(4)].map((_, i) => (
      <div key={i} className="channel-skeleton-item">
        <div className="skeleton skeleton-hash" />
        <div className="skeleton skeleton-channel-name" style={{ width: `${60 + i * 10}%` }} />
      </div>
    ))}
  </div>
);

function MemberAvatar({ member }) {
  const imageUrl = member?.profileImageUrl;
  const initial = member?.nickname ? member.nickname.charAt(0).toUpperCase() : "?";

  return (
    <div className={`avatar ${imageUrl ? "avatar-has-image" : ""}`}>
      {imageUrl ? <img src={imageUrl} alt={member?.nickname || "profile"} /> : initial}
    </div>
  );
}

const SidebarLeft = ({
  serverName,
  channels,
  activeChannel,
  onChannelClick,
  onAddChannelClick,
  onServerContextMenu,
  onChannelContextMenu,
  onMemberContextMenu,
  contextMenuTargetId,
  contextMenuType,
  members = [],
  hostId,
  onlineUserIds = [], // ✅ 웹소켓 연결 시 실시간 온라인 유저 ID 목록
  loading = false, // ✅ 로딩 상태 prop 추가
}) => {
  const { user } = useAuth();

  // ✅ onlineUserIds가 있으면 웹소켓 기반으로 온/오프라인 분류
  // 없으면 기존 방식 (현재 로그인 유저만 온라인)
  const isOnline = (member) => {
    if (onlineUserIds.length > 0) {
      return onlineUserIds.includes(member.userId);
    }
    return member.userId === user?.userId;
  };

  const onlineMembers  = members.filter((m) => isOnline(m));
  const offlineMembers = members.filter((m) => !isOnline(m));

  return (
    <aside className="sidebar-left">
      <h2
        className="logo"
        onContextMenu={(event) => handleRightClick(event, onServerContextMenu)}
      >
        <span className="logo-text">{serverName}</span>
        <button
          type="button"
          className="logo-add-button"
          aria-label="채널 추가"
          onClick={onAddChannelClick}
        >
          +
        </button>
      </h2>

      <div className="channel-list">
        {/* ✅ 로딩 중이면 Skeleton, 채널 있으면 목록, 없으면 Empty State */}
        {loading ? ( <ChannelSkeleton />) : channels && channels.length > 0 ? 
        (channels.map((ch) => {
            const cid = ch.chId || ch.id;
            const isActive = activeChannel === cid;
            const isContextOpen = contextMenuType === "channel" && contextMenuTargetId === cid;

            return (
              <div
                key={cid}
                className={`channel ${isActive ? "active" : ""} ${isContextOpen ? "context-open" : ""}`}
                onClick={() => onChannelClick(cid)}
                onContextMenu={(event) => handleRightClick(event, onChannelContextMenu, ch)}
              >
                <span className="hash">#</span>{" "}
                {ch.name || ch.label || "이름 없는 채널"}
              </div>
            );
          })
        ) : (
          // ✅ 채널 Empty State
          <div className="channel-empty-state">
            <span className="channel-empty-icon">#</span>
            <p className="channel-empty-text">채널이 없습니다</p>
            <p className="channel-empty-sub">+ 버튼으로 채널을 추가해보세요</p>
          </div>
          // <div style={{ padding: "0 20px", fontSize: "0.8rem", color: "#888" }}>
          //   채널을 불러오는 중...
          // </div>
        )}
      </div>

      <div className="spacer" />

      <div className="member-panel">
        <div className="member-panel-header">
          온라인 — {onlineMembers.length}명
        </div>
        <div className="member-list">
          {onlineMembers.map((m) => (
            <div
              key={m.userId}
              className={`member online ${contextMenuType === "member" && contextMenuTargetId === m.userId ? "context-open" : ""}`}
              onContextMenu={(event) => handleRightClick(event, onMemberContextMenu, m)}
            >
              <div className="avatar-wrapper">
                <MemberAvatar member={m} />
                <div className="status-dot"></div>
              </div>
              <span className="name green-text">
                {m.nickname}
                {m.userId === hostId && (
                  <span className="bot-tag" style={{ marginLeft: "6px" }}>방장</span>
                )}
              </span>
            </div>
          ))}

          {offlineMembers.length > 0 && (
            <>
              <div className="member-category mt-20">
                오프라인 — {offlineMembers.length}명
              </div>
              {offlineMembers.map((m) => (
                <div
                  key={m.userId}
                  className={`member offline ${contextMenuType === "member" && contextMenuTargetId === m.userId ? "context-open" : ""}`}
                  onContextMenu={(event) => handleRightClick(event, onMemberContextMenu, m)}
                >
                  <div className="avatar-wrapper">
                    <MemberAvatar member={m} />
                  </div>
                  <span className="name">
                    {m.nickname}
                    {m.userId === hostId && (
                      <span className="bot-tag" style={{ marginLeft: "6px" }}>방장</span>
                    )}
                  </span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </aside>
  );
};

export default SidebarLeft;

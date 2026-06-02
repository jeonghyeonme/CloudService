import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getServerPath } from "../../constants/path";
import { useAuth } from "../../contexts/AuthContext";
import { useServers } from "../../contexts/ServerContext";
import { getServerId, getServerName } from "../../lib/serverEntity";
import ProfileEditModal from "../Profile/ProfileEditModal";
import "./ServerSidebar.css";

function handleRightClick(event, callback, payload) {
  event.preventDefault();
  event.stopPropagation();
  callback?.(event, payload);
}

const ServerSidebar = ({
  activeView,
  onAddClick,
  onLogout,
  onServerContextMenu,
  contextMenuTargetId,
  contextMenuType,
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { joinedServers, activeServerId } = useServers();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isProfileEditOpen, setIsProfileEditOpen] = useState(false);
  const menuRef = useRef(null);

  const initial = user?.nickname ? user.nickname.charAt(0).toUpperCase() : "프";
  const profileImageUrl = user?.profileImageUrl || "";

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsProfileMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    setIsProfileMenuOpen(false);
    onLogout?.();
  };

  const handleProfileEdit = () => {
    setIsProfileMenuOpen(false);
    setIsProfileEditOpen(true);
  };

  return (
    <nav className="server-nav">
      {joinedServers.map((server) => {
        const sid = getServerId(server);
        const serverName = getServerName(server, "");
        const serverInitial = serverName
          ? serverName.trim().charAt(0).toUpperCase()
          : "?";
        const isActiveServer = activeView === "chat" && sid === activeServerId;
        const isContextOpen =
          contextMenuType === "server" && contextMenuTargetId === sid;

        return (
          <div
            key={sid}
            className={`server-icon server-entry-icon ${isActiveServer ? "active-server" : ""} ${isContextOpen ? "context-open" : ""}`}
            onClick={() => navigate(getServerPath(sid))}
            onContextMenu={(event) =>
              handleRightClick(event, onServerContextMenu, server)
            }
            title={serverName || "접속한 서버"}
          >
            {serverInitial}
          </div>
        );
      })}

      <div
        className="server-icon add-btn"
        onClick={onAddClick}
        title="서버 추가"
      >
        +
      </div>

      <div className="spacer" />

      <div className="profile-wrapper" ref={menuRef}>
        {isProfileMenuOpen && (
          <div className="profile-popup">
            <div className="profile-popup-title">
              {user?.nickname || "사용자"}님
            </div>
            <div className="profile-popup-divider" />
            <button className="profile-popup-item" onClick={handleProfileEdit}>
              프로필 편집
              <span className="popup-arrow">›</span>
            </button>
            <div className="profile-popup-divider" />
            <button
              className="profile-popup-item danger"
              onClick={handleLogout}
            >
              로그아웃
            </button>
          </div>
        )}

        <div
          className={`server-icon profile-icon ${profileImageUrl ? "has-image" : ""}`}
          onClick={() => setIsProfileMenuOpen((prev) => !prev)}
          title={user?.nickname || "프로필"}
        >
          {profileImageUrl ? (
            <img
              src={profileImageUrl}
              alt={user?.nickname || "프로필"}
              className="profile-icon-image"
            />
          ) : (
            initial
          )}
        </div>
      </div>

      <ProfileEditModal
        open={isProfileEditOpen}
        onClose={() => setIsProfileEditOpen(false)}
      />
    </nav>
  );
};

export default ServerSidebar;

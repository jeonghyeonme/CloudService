import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getServerPath } from "../../constants/path";
import { getServers, joinServer, updateServer, leaveServer, deleteServer, validateInvite, joinByInvite } from "../../lib/servers";
import "./ExploreServers.css";
import ServerSidebar from "../layout/ServerSidebar";
import CreateServerModal from "./CreateServerModal";
import { useAuth } from "../../contexts/AuthContext";
import { PATHS } from "../../constants/path";
import { useServers } from "../../contexts/ServerContext";
import { useToast } from "../../contexts/ToastContext";
import ContextMenu from "../common/ContextMenu";
import ConfirmModal from "../common/ConfirmModal";
import EntitySettingsModal from "../common/EntitySettingsModal";
import useChatOverlayState from "../Chat/hooks/useChatOverlayState";
import {
  createServerDefaultValues,
  createServerFields,
} from "../common/entityFormConfig";
import { buildServerContextMenuItems } from "../Chat/utils/contextMenuFactories";
import JoinServerModal from "./JoinServerModal";
import {
  getServerId,
  getServerName,
  normalizeServer,
  normalizeServers,
} from "../../lib/serverEntity";

// ✅ 서버 카드 Skeleton UI
const ServerCardSkeleton = () => (
  <div className="servers-card skeleton-card">
    <div className="skeleton skeleton-cover" />
    <div className="servers-body">
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-desc" />
      <div className="skeleton skeleton-desc short" />
    </div>
  </div>
);

// ✅ 검색 결과 없음 Empty State
const EmptySearchState = ({ query }) => (
  <div className="empty-state">
    <div className="empty-state-icon">🔍</div>
    <p className="empty-state-title">검색 결과가 없어요</p>
    <p className="empty-state-sub">
      <span className="empty-state-keyword">"{query}"</span>에 해당하는 서버를 찾을 수 없습니다.
      <br />다른 검색어를 시도하거나 새 서버를 만들어보세요!
    </p>
  </div>
);

const ServerCard = ({ server, onJoin, isMember }) => {
  const name = getServerName(server, "제목 없음");
  const description = server.description;
  const currentMembers = Number(server.currentCount) || 0;
  const maxMembers = server.maxCapacity || 12;
  const coverImage = server.imageUrl || server.coverImage;
  const emoji = "📚";

  const isFull =
    (maxMembers && currentMembers >= maxMembers) || server.status === "FULL";
  const isLocked = server.isPrivate && isFull;
  const displayStatus = isFull ? "FULL" : server.status;

  return (
    <div className={`servers-card ${isFull ? "servers-full" : ""}`}>
      <div className="servers-cover">
        {coverImage ? (
          <img src={coverImage} alt={name} className="servers-cover-img" />
        ) : (
          <div className="servers-cover-emoji">{emoji}</div>
        )}
        <span className={`servers-badge badge-${displayStatus.toLowerCase()}`}>
          {displayStatus}
        </span>
      </div>

      <div className="servers-body">
        <div className="servers-title-row">
          <h3 className="servers-name">{name}</h3>
          {maxMembers && (
            <span className="servers-count">
              {currentMembers}/{maxMembers}
            </span>
          )}
        </div>
        <p className="servers-desc">{description}</p>

        <div className="servers-footer">
          <div className="member-avatars">
            {[...Array(Math.min(3, currentMembers))].map((_, i) => (
              <div key={i} className="mini-avatar" style={{ zIndex: 3 - i }} />
            ))}
            {currentMembers > 3 && (
              <span className="member-extra">+{currentMembers - 3}</span>
            )}
          </div>

          {isLocked ? (
            <button className="servers-btn btn-locked" disabled>LOCKED</button>
          ) : isFull ? (
            <button className="servers-btn btn-locked" disabled>FULL</button>
          ) : (
            // ✅ 이미 멤버면 "입장", 아니면 "JOIN"
            <button className="servers-btn btn-join" onClick={() => onJoin(server)}>
              {isMember ? "입장" : "JOIN"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const ExploreServers = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const { logout, refreshToken, user } = useAuth();
  const { clearJoinedServers, setActiveServerId, upsertJoinedServer, removeJoinedServer, joinedServers  } = useServers();
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true); // ✅ 로딩 상태 추가
  const [searchQuery, setSearchQuery] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const {
    contextMenu,
    settingsModal,
    confirmModal,
    openContextMenu,
    closeContextMenu,
    openSettingsModal,
    closeSettingsModal,
    openConfirmModal,
    closeConfirmModal,
  } = useChatOverlayState();
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [selectedServer, setSelectedServer] = useState(null);

  const handleLogout = async () => {
    try {
      if (refreshToken) {
        const { logout: logoutApi } = await import("../../lib/auth");
        await logoutApi(refreshToken);
      }
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      clearJoinedServers();
      logout();
      navigate(PATHS.onboarding, { replace: true });
    }
  };

  useEffect(() => {
    setActiveServerId(null);
    setLoading(true); // ✅ 로딩 시작
    getServers()
      .then((data) => setServers(normalizeServers(data.items || [])))
      .catch((err) => {
        console.error("데이터 로드 실패!", err);
        setServers([]);
      })
      .finally(() => setLoading(false)); // ✅ 로딩 완료
  }, [setActiveServerId]);

  const refreshServers = async () => {
    const data = await getServers();
    setServers(normalizeServers(data.items || []));
  };

  const filteredServers = servers.filter((server) => {
    const title = server.serverName || server.title || "";
    const description = server.description || "";
    return (
      title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      description.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  // ✅ 이미 가입한 서버인지 확인
  const isAlreadyMember = (server) => {
    const sid = getServerId(server);
    return joinedServers.some((s) => getServerId(s) === sid);
  };

  const executeJoin = async (server, password = null) => {
    const sid = getServerId(server);

    // ✅ 이미 멤버면 joinServer API 호출 없이 바로 이동
    if (isAlreadyMember(server)) {
      navigate(getServerPath(sid));
      return;
    }

    try {
      const result = await joinServer(sid, password);
       // ✅ 백엔드에서 alreadyMember 응답도 중복 카운트 방지
      if (!result?.alreadyMember) {
        upsertJoinedServer(normalizeServer(server));
      }
      navigate(getServerPath(sid));
    } catch (error) {
      console.error("서버 참여 실패:", error);
      throw error;
    }
  };

  const handleJoinClick = (server) => {
    // ✅ 이미 멤버면 비밀번호 없이 바로 입장
    if (isAlreadyMember(server)) {
      executeJoin(server);
      return;
    }

    if (server.isPrivate) {
      setSelectedServer(server);
      setIsJoinModalOpen(true);
    } else {
      executeJoin(server);
    }
  };

  // ✅ 초대 코드로 즉시 입장
  const handleDirectJoin = async () => {
    const code = inviteCode.trim().toUpperCase();
    if (!code) {
      toast.info("입력 필요", "초대 코드를 입력해주세요.");
      return;
    }
    try {
      const validation = await validateInvite(code);
      if (!validation.valid) {
        toast.error("유효하지 않은 코드", validation.message || "유효하지 않은 초대 코드입니다.");
        return;
      }
      const { serverId: targetServerId } = validation.invite;
 
      if (isAlreadyMember({ serverId: targetServerId })) {
        navigate(getServerPath(targetServerId));
        return;
      }
 
      const result = await joinByInvite(code);
      if (result.alreadyMember) {
        navigate(getServerPath(targetServerId));
        return;
      }
      toast.success("입장 완료", `${validation.invite.serverName} 서버에 입장했습니다.`);
      navigate(getServerPath(targetServerId));
    } catch (error) {
      toast.error("입장 실패", error.message || "초대 코드 입장에 실패했습니다.");
    }
  };

  const resolveServerForMenu = (server) => {
    const sid = getServerId(server);
    return servers.find((item) => getServerId(item) === sid) || server;
  };

  const handleOpenServerMenu = (event, server) => {
    const resolvedServer = resolveServerForMenu(server);
    const sid = getServerId(resolvedServer);
    const isHost = user?.userId === resolvedServer.hostId;

    openContextMenu(event, {
      type: "server",
      targetId: sid,
      title: getServerName(resolvedServer),
      items: buildServerContextMenuItems({
        canDelete: isHost,
        onOpenSettings: () =>
          openSettingsModal({
            type: "server",
            server: resolvedServer,
            entityName: getServerName(resolvedServer),
          }),
        onOpenDeleteConfirm: () =>
          openConfirmModal({
            title: "정말로 삭제하시겠습니까?",
            description: "확인을 누르면 서버가 영구적으로 삭제됩니다.",
            onConfirm: async () => {
              await deleteServer(sid);
              setServers((prev) =>
                prev.filter((item) => getServerId(item) !== sid),
              );
              removeJoinedServer(sid);
              closeConfirmModal();
            },
          }),
        onLeave: () =>
          openConfirmModal({
            title: "서버에서 나가시겠습니까?",
            description: "확인을 누르면 서버 목록에서 제외됩니다.",
            onConfirm: async () => {
              await leaveServer(sid);
              removeJoinedServer(sid);
              closeConfirmModal();
            },
          }),
      }),
    });
  };

  const handleServerSettingsSubmit = async (values) => {
    const sid = getServerId(settingsModal?.server);
    const trimmedName = values.serverName.trim();

    if (!trimmedName) {
      throw new Error("서버 이름을 입력해 주세요.");
    }

    const updatedServer = await updateServer(sid, {
      serverName: trimmedName,
      description: values.description?.trim() || "",
      maxCapacity: Number(values.maxParticipants),
      isPrivate: values.privacy === "Private",
    });
    const resolvedServer = normalizeServer(updatedServer);

    setServers((prev) =>
      prev.map((server) =>
        getServerId(server) === sid ? resolvedServer : server,
      ),
    );
    closeSettingsModal();
  };

  return (
    <div className="explore-container">
      <ServerSidebar
        activeView="home"
        onServerClick={() => {}}
        onAddClick={() => setIsModalOpen(true)}
        onLogout={handleLogout}
        contextMenuType={contextMenu?.type}
        contextMenuTargetId={contextMenu?.targetId}
        onServerContextMenu={handleOpenServerMenu}
      />

      <div className="explore-main">
        <div className="explore-topbar">
          <span className="topbar-title">서버 탐색</span>
        </div>

        <div className="explore-hero">
          <h1 className="hero-title">
            새로운 <span className="accent">서버</span>를 찾거나{" "}
            <span className="accent">생성</span>해보세요!
          </h1>
        </div>

        <div className="search-bar">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="서버 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="invite-bar">
          <span className="invite-icon">🔗</span>
          <input
            type="text"
            placeholder="초대 코드 또는 URL 입력"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleDirectJoin(); }}
          />
          <button className="join-directly-btn" onClick={handleDirectJoin}>
            즉시 입장
          </button>
        </div>

        <div className="servers-grid">
          {/* ✅ 로딩 중 → Skeleton 카드 표시 */}
          {loading ? (
            [...Array(4)].map((_, i) => <ServerCardSkeleton key={i} />)
          ) : filteredServers.length === 0 && searchQuery ? (
            // ✅ 검색 결과 없음 → Empty State
            <EmptySearchState query={searchQuery} />
          ) : ( 
            filteredServers.map((server) => (
              <ServerCard
                key={getServerId(server)}
                server={server}
                onJoin={handleJoinClick}
                isMember={isAlreadyMember(server)}
              />
            ))
          )}

          {/* 방 만들기 카드 - 로딩 중이 아닐 때만 표시 */}
          {!loading && (
          <div className="servers-card create-card" onClick={() => setIsModalOpen(true)}>
            <div className="create-plus">+</div>
            <p className="create-label">서버 만들기</p>
            <p className="create-sub">새로운 학습 세션 시작하기</p>
          </div>
          )}
        </div>
      </div>

      {isModalOpen && (
        <CreateServerModal
          onClose={() => setIsModalOpen(false)}
          onCreated={refreshServers}
        />
      )}

      <ContextMenu
        open={Boolean(contextMenu)}
        position={contextMenu?.position}
        title={contextMenu?.title}
        items={contextMenu?.items || []}
        onClose={closeContextMenu}
      />

      <EntitySettingsModal
        open={settingsModal?.type === "server"}
        entityType="server"
        entityName={settingsModal?.entityName}
        fields={createServerFields(
          createServerDefaultValues(settingsModal?.server || {}),
        )}
        onClose={closeSettingsModal}
        onSubmit={handleServerSettingsSubmit}
        serverId={getServerId(settingsModal?.server)}
        isHost={user?.userId === settingsModal?.server?.hostId}
      />

      <ConfirmModal
        open={Boolean(confirmModal)}
        title={confirmModal?.title}
        description={confirmModal?.description}
        onCancel={closeConfirmModal}
        onConfirm={confirmModal?.onConfirm}
      />

      {isJoinModalOpen && (
        <JoinServerModal
          server={selectedServer}
          onClose={() => setIsJoinModalOpen(false)}
          onSubmit={(password) => executeJoin(selectedServer, password)}
        />
      )}
    </div>
  );
};

export default ExploreServers;

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
} from "react";
import { useParams, useNavigate } from "react-router-dom";
import { PATHS } from "../../constants/path";
import { useServers } from "../../contexts/ServerContext";
import "./ChatLayout.css";
import ServerSidebar from "../layout/ServerSidebar";
import SidebarLeft from "./SidebarLeft";
import ChatWindow from "./ChatWindow";
import ResourceHub from "./ResourceHub";
import CreateServerModal from "../Servers/CreateServerModal";
import CreateChannelModal from "./CreateChannelModal";
import ContextMenu from "../common/ContextMenu";
import ConfirmModal from "../common/ConfirmModal";
import EntitySettingsModal from "../common/EntitySettingsModal";
import {
  createChannelDefaultValues,
  createChannelFields,
  createServerDefaultValues,
  createServerFields,
} from "../common/entityFormConfig";
import { useAuth } from "../../contexts/AuthContext";
import useChatServerData from "./hooks/useChatServerData";
import useChatOverlayState from "./hooks/useChatOverlayState";
import {
  buildChannelContextMenuItems,
  buildServerContextMenuItems,
} from "./utils/contextMenuFactories";
import { getServerId, getServerName } from "../../lib/serverEntity";
import useWebSocket from "./hooks/useWebSocket";
import {
  banMember,
  kickMember,
  listMembers,
  transferOwnership,
  unbanMember,
  updateMemberRole,
} from "../../lib/servers";
import MemberModerationModal from "./MemberModerationModal";
import { useToast } from "../../contexts/ToastContext";

const ChatLayout = () => {
  const { serverId } = useParams();
  const navigate = useNavigate();
  const { user, logout, refreshToken } = useAuth();
  const toast = useToast();
  const {
    setActiveServerId,
    upsertJoinedServer,
    removeJoinedServer,
    clearJoinedServers,
  } = useServers();

  const [isServerModalOpen, setIsServerModalOpen] = useState(false);
  const [isChannelModalOpen, setIsChannelModalOpen] = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState([]);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [moderationMembers, setModerationMembers] = useState([]);

  // ✅ 서버 변경 시 이전 서버의 실시간/모달 상태 초기화
  useEffect(() => {
    setOnlineUserIds([]);
    setModerationMembers([]);
    setIsMemberModalOpen(false);
  }, [serverId]);

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

  const {
    currentServer,
    setCurrentServer,
    loading,
    activeChannel,
    setActiveChannel,
    createChannelInServer,
    saveServerSettings,
    saveChannelSettings,
    removeServer,
    leaveServer,
    removeChannel,
  } = useChatServerData({
    serverId,
    setActiveServerId,
    upsertJoinedServer,
    removeJoinedServer,
  });

  // ✅ ChatWindow에서 사용할 메시지 핸들러 ref (ChatLayout에서 통합 관리)
  const chatMessageHandlerRef = useRef(null);

  // ✅ WebSocket 메시지 통합 핸들러
  const handleWsMessage = useCallback(
    (parsed) => {
      const { action, data } = parsed;

      // 채팅 메시지 관련 → ChatWindow 핸들러로 위임
      if (
        [
          "receiveMessage",
          "messageUpdated",
          "messageDeleted",
          "aiAnalysisStarted",
        ].includes(action)
      ) {
        chatMessageHandlerRef.current?.(parsed);
        return;
      }

      // ✅ 온라인 멤버 리스트 (입장 직후 본인이 받음)
      if (action === "onlineMembers" && data) {
        setOnlineUserIds(data.onlineUserIds || []);
        return;
      }

      // ✅ 다른 사람 입장 알림
      if (action === "userJoined" && data?.userId) {
        setOnlineUserIds((prev) => {
          if (prev.includes(data.userId)) return prev;
          return [...prev, data.userId];
        });
        return;
      }

      // ✅ 다른 사람 퇴장 알림
      if (action === "userLeft" && data?.userId) {
        setOnlineUserIds((prev) => prev.filter((id) => id !== data.userId));
        return;
      }

      // ✅ resourceUpdated 이벤트 처리 → 리소스 목록 즉시 갱신
      if (action === "resourceUpdated" && data) {
        const { resourceType, resourceAction, data: resourceData } = data;

        setCurrentServer((prev) => {
          if (!prev) return prev;

          if (resourceType === "file") {
            if (resourceAction === "add") {
              // 중복 방지
              const already = (prev.files || []).some(
                (f) => f.fileId === resourceData.fileId,
              );
              if (already) return prev;
              return { ...prev, files: [...(prev.files || []), resourceData] };
            }
            if (resourceAction === "delete") {
              return {
                ...prev,
                files: (prev.files || []).filter(
                  (f) => f.fileId !== resourceData.fileId,
                ),
              };
            }
          }

          if (resourceType === "link") {
            if (resourceAction === "add") {
              const already = (prev.links || []).some(
                (l) => l.linkId === resourceData.linkId,
              );
              if (already) return prev;
              return { ...prev, links: [...(prev.links || []), resourceData] };
            }
            if (resourceAction === "delete") {
              return {
                ...prev,
                links: (prev.links || []).filter(
                  (l) => l.linkId !== resourceData.linkId,
                ),
              };
            }
          }

          return prev;
        });
      }
    },
    [setCurrentServer],
  );

  // ✅ WebSocket 연결 (ChatLayout에서 관리 → ChatWindow, ResourceHub에 sendMessage 전달)
  const { sendMessage: sendWsMessage, isConnected } = useWebSocket({
    serverId,
    userId: user?.userId,
    onMessage: handleWsMessage,
  });

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

  const isCurrentUserHost =
    Boolean(user?.userId) &&
    (currentServer?.hostId === user.userId ||
      (currentServer?.members || []).some(
        (member) => member?.userId === user.userId && member?.role === "HOST",
      ));
  const currentUserRole = useMemo(() => {
    if (!user?.userId) return null;
    if (currentServer?.hostId === user.userId) return "HOST";
    return (
      (currentServer?.members || []).find(
        (member) => member.userId === user.userId,
      )?.role || null
    );
  }, [currentServer?.hostId, currentServer?.members, user?.userId]);
  const canOpenModeration =
    currentUserRole === "HOST" || currentUserRole === "MODERATOR";

  const refreshModerationMembers = useCallback(async () => {
    if (!serverId) return;
    const data = await listMembers(serverId);
    setModerationMembers(data?.items || []);
  }, [serverId]);

  const openModerationDashboard = useCallback(async () => {
    try {
      if (!canOpenModeration) {
        toast.error(
          "권한 없음",
          "관리자만 멤버 관리 메뉴를 사용할 수 있습니다.",
        );
        return;
      }
      await refreshModerationMembers();
      setIsMemberModalOpen(true);
    } catch (error) {
      toast.error("멤버 목록 조회 실패", error.message);
      console.error("Failed to fetch moderation members:", error);
    }
  }, [canOpenModeration, refreshModerationMembers, toast]);

  const canManageMember = useCallback(
    (member) => {
      if (!member || !user?.userId) return false;
      if (member.userId === user.userId) return false;
      const targetRole = member.role || "MEMBER";
      if (currentUserRole === "HOST") return targetRole !== "HOST";
      if (currentUserRole === "MODERATOR") return targetRole === "MEMBER";
      return false;
    },
    [currentUserRole, user?.userId],
  );

  const syncServerMembers = useCallback(
    (nextMembers, nextBannedMembers) => {
      setCurrentServer((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          members: nextMembers,
          currentCount: nextMembers.length,
          ...(nextBannedMembers ? { bannedMembers: nextBannedMembers } : {}),
        };
      });
    },
    [setCurrentServer],
  );

  const getBaseMembers = useCallback(() => {
    if (moderationMembers.length > 0) {
      return moderationMembers;
    }
    return currentServer?.members || [];
  }, [currentServer?.members, moderationMembers]);

  const handleRoleChange = useCallback(
    async (member, nextRole) => {
      try {
        await updateMemberRole(serverId, member.userId, nextRole);
        const nextMembers = getBaseMembers().map((item) =>
          item.userId === member.userId ? { ...item, role: nextRole } : item,
        );
        setModerationMembers(nextMembers);
        syncServerMembers(nextMembers);
        toast.success(
          "권한 변경 완료",
          `${member.nickname}님의 권한이 ${nextRole}(으)로 변경되었습니다.`,
        );
      } catch (error) {
        toast.error("권한 변경 실패", error.message);
      }
    },
    [getBaseMembers, serverId, syncServerMembers, toast],
  );

  const handleKickMember = useCallback(
    async (member) => {
      try {
        await kickMember(serverId, member.userId);
        const nextMembers = getBaseMembers().filter(
          (item) => item.userId !== member.userId,
        );
        setModerationMembers(nextMembers);
        syncServerMembers(nextMembers);
        toast.success(
          "강퇴 완료",
          `${member.nickname}님을 서버에서 내보냈습니다.`,
        );
      } catch (error) {
        toast.error("강퇴 실패", error.message);
      }
    },
    [getBaseMembers, serverId, syncServerMembers, toast],
  );

  const handleBanMember = useCallback(
    async (member) => {
      try {
        const result = await banMember(serverId, member.userId);
        const nextMembers = getBaseMembers().filter(
          (item) => item.userId !== member.userId,
        );
        const nextBannedMembers = [
          ...(currentServer?.bannedMembers || []).filter(
            (item) => item.userId !== member.userId,
          ),
          result?.ban || {
            userId: member.userId,
            nickname: member.nickname,
            bannedAt: new Date().toISOString(),
            bannedBy: user?.userId,
          },
        ];
        setModerationMembers(nextMembers);
        syncServerMembers(nextMembers, nextBannedMembers);
        toast.success("차단 완료", `${member.nickname}님을 차단했습니다.`);
      } catch (error) {
        toast.error("차단 실패", error.message);
      }
    },
    [
      currentServer?.bannedMembers,
      getBaseMembers,
      serverId,
      syncServerMembers,
      toast,
      user?.userId,
    ],
  );

  const handleUnbanMember = useCallback(
    async (member) => {
      try {
        await unbanMember(serverId, member.userId);
        const nextBannedMembers = (currentServer?.bannedMembers || []).filter(
          (item) => item.userId !== member.userId,
        );
        syncServerMembers(getBaseMembers(), nextBannedMembers);
        toast.success(
          "차단 해제 완료",
          `${member.nickname}님의 차단을 해제했습니다.`,
        );
      } catch (error) {
        toast.error("차단 해제 실패", error.message);
      }
    },
    [
      currentServer?.bannedMembers,
      getBaseMembers,
      serverId,
      syncServerMembers,
      toast,
    ],
  );

  const handleTransferOwnership = useCallback(
    async (member) => {
      try {
        await transferOwnership(serverId, member.userId);
        await refreshModerationMembers();
        setCurrentServer((prev) =>
          prev
            ? { ...prev, hostId: member.userId, hostNickname: member.nickname }
            : prev,
        );
        toast.success(
          "소유권 위임 완료",
          `${member.nickname}님에게 소유권을 위임했습니다.`,
        );
      } catch (error) {
        toast.error("소유권 위임 실패", error.message);
      }
    },
    [refreshModerationMembers, serverId, setCurrentServer, toast],
  );

  const openServerSettings = useCallback(
    () =>
      openSettingsModal({
        type: "server",
        entityName: getServerName(currentServer),
      }),
    [currentServer, openSettingsModal],
  );

  const openChannelSettings = useCallback(
    (channel) =>
      openSettingsModal({
        type: "channel",
        channel,
        entityName: channel.name || channel.label || "현재 채널",
      }),
    [openSettingsModal],
  );

  const serverMenuItems = useMemo(
    () =>
      buildServerContextMenuItems({
        canDelete: isCurrentUserHost,
        onOpenModeration: openModerationDashboard,
        onOpenSettings: openServerSettings,
        onOpenDeleteConfirm: () =>
          openConfirmModal({
            title: "정말로 삭제하시겠습니까?",
            description:
              "확인을 누르면 현재 서버가 삭제되고 서버 목록 화면으로 이동합니다.",
            onConfirm: async () => {
              await removeServer();
              closeConfirmModal();
            },
          }),
        onLeave: () =>
          openConfirmModal({
            title: "서버에서 나가시겠습니까?",
            description: "확인을 누르면 서버 목록에서 제외됩니다.",
            onConfirm: async () => {
              await leaveServer();
              closeConfirmModal();
            },
          }),
      }),
    [
      closeConfirmModal,
      isCurrentUserHost,
      openConfirmModal,
      openModerationDashboard,
      openServerSettings,
      removeServer,
      leaveServer,
    ],
  );

  const memberMenuItems = useCallback(
    (member) => {
      const manageable = canManageMember(member);
      const items = [];

      if (isCurrentUserHost && member.role !== "HOST") {
        items.push({
          key: "toggle-role",
          label: member.role === "MODERATOR" ? "멤버로 강등" : "관리자로 승격",
          onClick: () =>
            handleRoleChange(
              member,
              member.role === "MODERATOR" ? "MEMBER" : "MODERATOR",
            ),
        });
        items.push({
          key: "transfer-owner",
          label: "소유권 위임",
          onClick: () => handleTransferOwnership(member),
        });
      }

      items.push({
        key: "kick",
        label: "강퇴",
        danger: true,
        onClick: () => handleKickMember(member),
        disabled: !manageable,
      });
      items.push({
        key: "ban",
        label: "차단",
        danger: true,
        onClick: () => handleBanMember(member),
        disabled: !manageable,
      });
      return items;
    },
    [
      canManageMember,
      handleBanMember,
      handleKickMember,
      handleRoleChange,
      handleTransferOwnership,
      isCurrentUserHost,
    ],
  );

  const handleServerSettingsSubmit = async (values) => {
    await saveServerSettings(values);
    closeSettingsModal();
  };
  const handleChannelSettingsSubmit = async (values) => {
    await saveChannelSettings(settingsModal?.channel, values);
    closeSettingsModal();
  };
  const handleCreateChannel = async (values) => {
    await createChannelInServer(values);
    setIsChannelModalOpen(false);
  };

  // if (loading) return <div style={{ color: "white", padding: "20px" }}>서버 정보를 가져오는 중...</div>;

  if (!loading && !currentServer) {
    return (
      <div style={{ padding: "20px", color: "white" }}>
        <h3>서버를 찾을 수 없습니다. (ID: {serverId})</h3>
        <button onClick={() => navigate(PATHS.explore)}>
          목록으로 돌아가기
        </button>
      </div>
    );
  }

  return (
    <div className="chat-container">
      <ServerSidebar
        activeView="chat"
        onServerClick={() => {}}
        onAddClick={() => setIsServerModalOpen(true)}
        onLogout={handleLogout}
        contextMenuType={contextMenu?.type}
        contextMenuTargetId={contextMenu?.targetId}
        onServerContextMenu={(event, server) => {
          const sid = getServerId(server);
          const resolvedServer =
            getServerId(currentServer) === sid ? currentServer : server;
          openContextMenu(event, {
            type: "server",
            targetId: sid,
            title: getServerName(resolvedServer),
            items: serverMenuItems,
          });
        }}
      />

      {/* ✅ loading prop 전달 → 로딩 중엔 Skeleton 표시 */}
      <SidebarLeft
        serverName={getServerName(currentServer, "로딩 중...")}
        channels={currentServer?.channels || []}
        activeChannel={activeChannel}
        onChannelClick={setActiveChannel}
        onAddChannelClick={() => setIsChannelModalOpen(true)}
        contextMenuType={contextMenu?.type}
        contextMenuTargetId={contextMenu?.targetId}
        members={currentServer?.members || []}
        hostId={currentServer?.hostId}
        onlineUserIds={onlineUserIds}
        loading={loading}
        onServerContextMenu={(event) =>
          openContextMenu(event, {
            type: "server",
            targetId: serverId,
            title: getServerName(currentServer),
            items: serverMenuItems,
          })
        }
        onChannelContextMenu={(event, channel) =>
          openContextMenu(event, {
            type: "channel",
            targetId: channel.chId || channel.id,
            title: channel.name || channel.label || "현재 채널",
            items: buildChannelContextMenuItems({
              onOpenSettings: () => openChannelSettings(channel),
              onOpenDeleteConfirm: () =>
                openConfirmModal({
                  title: "정말로 삭제하시겠습니까?",
                  description: "확인을 누르면 현재 채널이 삭제됩니다.",
                  onConfirm: async () => {
                    await removeChannel(channel);
                    closeConfirmModal();
                  },
                }),
            }),
          })
        }
        onMemberContextMenu={(event, member) =>
          openContextMenu(event, {
            type: "member",
            targetId: member.userId,
            title: `${member.nickname} (${member.role || "MEMBER"})`,
            items: memberMenuItems(member),
          })
        }
      />

      <main
        className="chat-content-wrapper"
        style={{ display: "flex", flex: 1, minWidth: 0 }}
      >
        {loading ? (
          // ✅ 로딩 중 채팅창 Skeleton
          <div className="chat-main">
            <div className="chat-header">
              <div
                className="skeleton"
                style={{ width: 120, height: 16, borderRadius: 6 }}
              />
            </div>
            <div className="chat-messages" style={{ gap: 16 }}>
              {[...Array(5)].map((_, i) => (
                <div key={i} className="message-dummy">
                  <div
                    className="skeleton"
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      flexShrink: 0,
                    }}
                  />
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                      flex: 1,
                    }}
                  >
                    <div
                      className="skeleton"
                      style={{ width: 80, height: 12, borderRadius: 4 }}
                    />
                    <div
                      className="skeleton"
                      style={{
                        width: `${50 + i * 8}%`,
                        height: 14,
                        borderRadius: 4,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          //✅ ChatWindow에 sendWsMessage, isConnected, chatMessageHandlerRef 전달
          <ChatWindow
            activeChannel={activeChannel}
            channels={currentServer.channels}
            sendWsMessage={sendWsMessage}
            isConnected={isConnected}
            chatMessageHandlerRef={chatMessageHandlerRef}
          />
        )}

        {/* ✅ ResourceHub에 sendWsMessage 전달 */}
        <ResourceHub
          serverResources={currentServer}
          setCurrentServer={setCurrentServer}
          sendWsMessage={sendWsMessage}
          loading={loading}
        />
      </main>

      {isServerModalOpen && (
        <CreateServerModal onClose={() => setIsServerModalOpen(false)} />
      )}

      <CreateChannelModal
        open={isChannelModalOpen}
        serverName={getServerName(currentServer)}
        onClose={() => setIsChannelModalOpen(false)}
        onSubmit={handleCreateChannel}
      />

      <ContextMenu
        open={Boolean(contextMenu)}
        position={contextMenu?.position}
        title={contextMenu?.title}
        items={contextMenu?.items || []}
        onClose={closeContextMenu}
      />

      <MemberModerationModal
        open={isMemberModalOpen}
        serverName={getServerName(currentServer)}
        members={moderationMembers}
        bannedMembers={currentServer?.bannedMembers || []}
        canManage={canManageMember}
        onClose={() => setIsMemberModalOpen(false)}
        onRoleChange={handleRoleChange}
        onKick={handleKickMember}
        onBan={handleBanMember}
        onUnban={handleUnbanMember}
        onTransferOwnership={handleTransferOwnership}
      />

      <EntitySettingsModal
        open={settingsModal?.type === "server"}
        entityType="server"
        entityName={settingsModal?.entityName}
        fields={createServerFields(
          createServerDefaultValues(currentServer || {}),
        )}
        onClose={closeSettingsModal}
        onSubmit={handleServerSettingsSubmit}
      />

      <EntitySettingsModal
        open={settingsModal?.type === "channel"}
        entityType="channel"
        entityName={settingsModal?.entityName}
        fields={createChannelFields(
          createChannelDefaultValues(settingsModal?.channel || {}),
        )}
        onClose={closeSettingsModal}
        onSubmit={handleChannelSettingsSubmit}
      />

      <ConfirmModal
        open={Boolean(confirmModal)}
        title={confirmModal?.title}
        description={confirmModal?.description}
        onCancel={closeConfirmModal}
        onConfirm={confirmModal?.onConfirm}
      />
    </div>
  );
};

export default ChatLayout;

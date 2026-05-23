import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useParams } from "react-router-dom";
import { uploadFile } from "../../lib/resources";
import { useToast } from "../../contexts/ToastContext";
import { UPLOAD_POLICY_LABEL, validateUploadFile } from "../../lib/uploadPolicy";
import { getServerMessages } from "../../lib/servers";

const IMAGE_MESSAGE_TYPES = new Set(["IMAGE", "image"]);
const FILE_MESSAGE_TYPES = new Set(["FILE", "file"]);
const LINK_MESSAGE_TYPES = new Set(["LINK", "link"]);
const AI_SUMMARY_MESSAGE_TYPES = new Set(["ai-summary", "AI_SUMMARY"]);
const AI_PENDING_MESSAGE_TYPES = new Set(["ai-pending"]);
const AI_FAILED_MESSAGE_TYPES = new Set(["ai-failed"]);
const SEND_TIMEOUT_MS = 8000;
const FAILED_MESSAGES_STORAGE_PREFIX = "chat-failed-messages";

const createClientMessageKey = () =>
  `client-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const isPendingOrFailedMessage = (message) =>
  message?.sendStatus === "sending" || message?.sendStatus === "failed";

const getFailedMessagesStorageKey = (serverId) =>
  `${FAILED_MESSAGES_STORAGE_PREFIX}:${serverId}`;

const loadFailedMessages = (serverId) => {
  if (!serverId) return {};

  try {
    const raw = localStorage.getItem(getFailedMessagesStorageKey(serverId));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const persistFailedMessages = (serverId, messagesByChannel) => {
  if (!serverId) return;

  const entries = Object.entries(messagesByChannel || {}).filter(([, messages]) => messages?.length);

  if (!entries.length) {
    localStorage.removeItem(getFailedMessagesStorageKey(serverId));
    return;
  }

  localStorage.setItem(getFailedMessagesStorageKey(serverId), JSON.stringify(Object.fromEntries(entries)));
};

const mergeMessages = (baseMessages = [], extraMessages = []) => {
  const merged = [...baseMessages];

  extraMessages.forEach((message) => {
    const existingIndex = merged.findIndex((item) => isSameMessage(item, message));

    if (existingIndex >= 0) {
      merged[existingIndex] = {
        ...merged[existingIndex],
        ...message,
      };
      return;
    }

    merged.push(message);
  });

  return merged;
};

// Helper for deduplication
const isSameMessage = (left, right) => {
  if (!left || !right) return false;
  if (left.messageId && right.messageId && left.messageId === right.messageId) return true;
  if (left.clientMessageId && right.clientMessageId && left.clientMessageId === right.clientMessageId) return true;

  const leftFileSignature = [
    left.channelId,
    left.senderId,
    left.messageType || left.type,
    left.fileId,
    left.imageUrl || left.fileUrl,
  ].join("|");
  const rightFileSignature = [
    right.channelId,
    right.senderId,
    right.messageType || right.type,
    right.fileId,
    right.imageUrl || right.fileUrl,
  ].join("|");

  if (left.fileId && right.fileId && leftFileSignature === rightFileSignature) {
    return true;
  }

  const leftUrl = left.imageUrl || left.fileUrl || "";
  const rightUrl = right.imageUrl || right.fileUrl || "";
  const leftType = left.messageType || left.type;
  const rightType = right.messageType || right.type;

  if (
    leftUrl &&
    rightUrl &&
    leftUrl === rightUrl &&
    left.channelId === right.channelId &&
    left.senderId === right.senderId &&
    leftType === rightType &&
    (leftType === "IMAGE" || leftType === "FILE")
  ) {
    return true;
  }

  const leftContent = left.content || left.text || "";
  const rightContent = right.content || right.text || "";

  if (
    left.channelId === right.channelId &&
    left.senderId === right.senderId &&
    leftType === rightType &&
    (isPendingOrFailedMessage(left) || isPendingOrFailedMessage(right))
  ) {
    if ((leftType === "IMAGE" || leftType === "FILE") && leftUrl && rightUrl && leftUrl === rightUrl) {
      return true;
    }

    if (leftType === "TEXT") {
      const normalizedLeft = leftContent.trim();
      const normalizedRight = rightContent.trim();

      if (normalizedLeft && normalizedRight && normalizedLeft === normalizedRight) {
        return true;
      }
    }
  }

  if (
    leftType === "TEXT" &&
    rightType === "TEXT" &&
    left.channelId === right.channelId &&
    left.senderId === right.senderId &&
    leftContent &&
    leftContent === rightContent
  ) {
    const leftCreatedAt = left.createdAt ? new Date(left.createdAt).getTime() : 0;
    const rightCreatedAt = right.createdAt ? new Date(right.createdAt).getTime() : 0;
    if (leftCreatedAt && rightCreatedAt && Math.abs(leftCreatedAt - rightCreatedAt) < 3000) {
      return true;
    }
  }

  return false;
};

const getExternalFileItems = (event) => {
  const items = Array.from(event.dataTransfer?.items || []);
  return items.filter((item) => item.kind === "file");
};

const getDroppedFile = (event) => {
  const files = Array.from(event.dataTransfer?.files || []);
  return files[0] || null;
};

const isImageUpload = (file) => Boolean(file?.type?.startsWith("image/"));

/**
 * @param {string} activeChannel - 현재 활성 채널 ID
 * @param {Array} channels - 채널 목록
 * @param {function} sendWsMessage - ChatLayout에서 전달받은 WebSocket 전송 함수
 * @param {boolean} isConnected - WebSocket 연결 상태
 * @param {object} chatMessageHandlerRef - ChatLayout에서 메시지 핸들러 등록용 ref
 */
const ChatWindow = ({ activeChannel, channels, sendWsMessage, isConnected, chatMessageHandlerRef }) => {
  const { user } = useAuth();
  const toast = useToast();
  const { serverId } = useParams();
  const CURRENT_USER = user?.nickname || "";

  const [inputText, setInputText] = useState("");
  const [channelMessages, setChannelMessages] = useState({});
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isComposing, setIsComposing] = useState(false);
  const [pendingImage, setPendingImage] = useState(null);
  const [uploadFeedback, setUploadFeedback] = useState("");
  // ✅ 검색 관련 state
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const searchInputRef = useRef(null);
  const searchTimerRef = useRef(null);

  const dragDepthRef = useRef(0);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const aiPendingTimeoutsRef = useRef(new Map()); // requestId → timeoutId
  const messageSendTimeoutsRef = useRef(new Map()); // clientMessageId -> timeoutId

  const activeChannelRef = useRef(activeChannel);
  useEffect(() => {
    activeChannelRef.current = activeChannel;
  }, [activeChannel]);

  const currentChannel = useMemo(
    () => channels?.find((ch) => (ch.chId || ch.id) === activeChannel),
    [channels, activeChannel],
  );

  // 채널 초기 메시지 로드
  useEffect(() => {
    if (!activeChannel || !channels) return;

    setChannelMessages((prev) => {
      const updated = { ...prev };
      const failedMessagesByChannel = loadFailedMessages(serverId);

      channels.forEach((ch) => {
        const channelId = ch.chId || ch.id;
        if (!updated[channelId]) {
          updated[channelId] = mergeMessages(
            ch.messages || [],
            failedMessagesByChannel[channelId] || [],
          );
        }
      });
      return updated;
    });
  }, [channels, activeChannel, serverId]);

  useEffect(() => {
    return () => {
      if (pendingImage?.previewUrl) {
        URL.revokeObjectURL(pendingImage.previewUrl);
      }
    };
  }, [pendingImage]);

  const appendMessageToChannel = useCallback((channelId, message) => {
    if (!channelId || !message) return;

    setChannelMessages((prev) => {
      const existingMessages = prev[channelId] || [];
      const existingIndex = existingMessages.findIndex((item) => isSameMessage(item, message));

      if (existingIndex >= 0) {
        const nextMessages = [...existingMessages];
        nextMessages[existingIndex] = {
          ...nextMessages[existingIndex],
          ...message,
          isOptimistic: false,
          sendStatus: undefined, // ✅ 추가 - "전송 중..." 상태 해제
          sendError: undefined,  // ✅ 추가 - 에러 메시지 초기화
        };

        return {
          ...prev,
          [channelId]: nextMessages,
        };
      }

      return {
        ...prev,
        [channelId]: [...existingMessages, message],
      };
    });
  }, []);

  const clearMessageSendTimeout = useCallback((clientMessageId) => {
    if (!clientMessageId) return;

    const timeoutId = messageSendTimeoutsRef.current.get(clientMessageId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      messageSendTimeoutsRef.current.delete(clientMessageId);
    }
  }, []);

  const markMessageFailed = useCallback((channelId, clientMessageId, errorMessage = "메시지 전송에 실패했습니다.") => {
    if (!channelId || !clientMessageId) return;

    clearMessageSendTimeout(clientMessageId);

    setChannelMessages((prev) => ({
      ...prev,
      [channelId]: (prev[channelId] || []).map((message) =>
        message.clientMessageId === clientMessageId
          ? {
              ...message,
              isOptimistic: false,
              sendStatus: "failed",
              sendError: errorMessage,
              isRetrying: false,
            }
          : message,
      ),
    }));
  }, [clearMessageSendTimeout]);

  const scheduleMessageTimeout = useCallback((channelId, clientMessageId) => {
    if (!channelId || !clientMessageId) return;

    clearMessageSendTimeout(clientMessageId);

    const timeoutId = window.setTimeout(() => {
      markMessageFailed(channelId, clientMessageId, "전송 확인이 지연되고 있습니다. 재전송을 시도해주세요.");
    }, SEND_TIMEOUT_MS);

    messageSendTimeoutsRef.current.set(clientMessageId, timeoutId);
  }, [clearMessageSendTimeout, markMessageFailed]);

  const createOptimisticMessage = useCallback((payload) => {
    const imageType = payload.messageType === "IMAGE";

    return {
      messageId: payload.messageId || payload.clientMessageId || `temp-message-${Date.now()}`,
      clientMessageId: payload.clientMessageId,
      serverId,
      channelId: activeChannel,
      senderId: user?.userId,
      senderNickname: user?.nickname,
      messageType: payload.messageType,
      content: payload.content || "",
      imageUrl: imageType ? payload.imageUrl || payload.fileUrl || "" : "",
      fileUrl: payload.fileUrl || "",
      fileName: payload.fileName || "",
      fileType: payload.fileType || "",
      fileId: payload.fileId || "",
      s3ObjectKey: payload.s3ObjectKey || "",
      retryPayload: payload,
      createdAt: payload.createdAt || new Date().toISOString(),
      isOptimistic: true,
      sendStatus: "sending",
      isRetrying: false,
    };
  }, [activeChannel, serverId, user?.nickname, user?.userId]);

  // ✅ 메시지 수신 핸들러 - ChatLayout의 ref에 등록
  const handleWsMessage = useCallback((parsed) => {
    const { action, data } = parsed;
    const channelId = data?.channelId || activeChannelRef.current;

    if (action === "receiveMessage" && data) {
      if (data.clientMessageId) {
        clearMessageSendTimeout(data.clientMessageId);
      }

      // ai-summary 도착 시: 같은 requestId의 ai-pending 제거 + 타이머 정리
      if (
        (AI_SUMMARY_MESSAGE_TYPES.has(data.messageType) || AI_SUMMARY_MESSAGE_TYPES.has(data.type)) &&
        data.aiRequestId
      ) {
        const timeoutId = aiPendingTimeoutsRef.current.get(data.aiRequestId);
        if (timeoutId) {
          clearTimeout(timeoutId);
          aiPendingTimeoutsRef.current.delete(data.aiRequestId);
        }
        // ai-pending 제거 후 ai-summary 추가
        setChannelMessages((prev) => {
          const targetChannel = channelId;
          const filtered = (prev[targetChannel] || []).filter(
            (m) => !(m.aiRequestId === data.aiRequestId && AI_PENDING_MESSAGE_TYPES.has(m.messageType)),
          );
          return {
            ...prev,
            [targetChannel]: [...filtered, data],
          };
        });
        return;
      }

      appendMessageToChannel(channelId, data);
      return;
    }

    if (action === "messageUpdated" && data) {
      setChannelMessages((prev) => ({
        ...prev,
        [channelId]: (prev[channelId] || []).map((msg) =>
          msg.messageId === data.messageId ? { ...msg, ...data } : msg,
        ),
      }));
      return;
    }

    if (action === "messageDeleted" && data) {
      setChannelMessages((prev) => ({
        ...prev,
        [channelId]: (prev[channelId] || []).map((msg) =>
          msg.messageId === data.messageId ? { ...msg, ...data } : msg,
        ),
      }));
      return;
    }

    // AI 분석 시작 알림 → 임시 메시지 추가 + 5분 타이머 등록
    if (action === "aiAnalysisStarted" && data) {
      const { requestId, fileName, requestedBy, startedAt } = data;
      if (!requestId) return;

      const targetChannel = channelId;

      setChannelMessages((prev) => {
        const existing = prev[targetChannel] || [];
        // 중복 방지
        if (existing.some((m) => m.aiRequestId === requestId && AI_PENDING_MESSAGE_TYPES.has(m.messageType))) {
          return prev;
        }
        return {
          ...prev,
          [targetChannel]: [
            ...existing,
            {
              messageId: `ai-pending-${requestId}`,
              messageType: "ai-pending",
              aiRequestId: requestId,
              channelId: targetChannel,
              fileName,
              requestedBy,
              createdAt: startedAt || new Date().toISOString(),
              senderId: "system-ai",
              senderNickname: "AI 스터디 조교",
            },
          ],
        };
      });

      // 5분 후 자동 실패 처리
      const timeoutId = setTimeout(() => {
        setChannelMessages((prev) => ({
          ...prev,
          [targetChannel]: (prev[targetChannel] || []).map((m) =>
            m.aiRequestId === requestId && AI_PENDING_MESSAGE_TYPES.has(m.messageType)
              ? { ...m, messageType: "ai-failed", messageId: `ai-failed-${requestId}` }
              : m,
          ),
        }));
        aiPendingTimeoutsRef.current.delete(requestId);
      }, 5 * 60 * 1000);

      aiPendingTimeoutsRef.current.set(requestId, timeoutId);
    }
  }, [appendMessageToChannel, clearMessageSendTimeout]);

  // ✅ ChatLayout의 ref에 핸들러 등록
  useEffect(() => {
    if (chatMessageHandlerRef) {
      chatMessageHandlerRef.current = handleWsMessage;
    }
  }, [chatMessageHandlerRef, handleWsMessage]);

  const currentMessages = useMemo(
    () =>
      [...(channelMessages[activeChannel] || [])].sort(
        (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
      ),
    [channelMessages, activeChannel],
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentMessages.length]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
  }, [activeChannel]);

  useEffect(() => {
    const timeoutsMap = aiPendingTimeoutsRef.current;
    return () => {
      timeoutsMap.forEach((timeoutId) => clearTimeout(timeoutId));
      timeoutsMap.clear();
    };
  }, []);

  useEffect(() => {
    const timeoutsMap = messageSendTimeoutsRef.current;
    return () => {
      timeoutsMap.forEach((timeoutId) => clearTimeout(timeoutId));
      timeoutsMap.clear();
    };
  }, []);

  useEffect(() => {
    if (!serverId) return;

    const failedMessagesByChannel = Object.fromEntries(
      Object.entries(channelMessages).map(([channelId, messages]) => [
        channelId,
        (messages || []).filter(
          (message) =>
            message.sendStatus === "failed" &&
            message.clientMessageId &&
            message.retryPayload,
        ),
      ]),
    );

    persistFailedMessages(serverId, failedMessagesByChannel);
  }, [channelMessages, serverId]);

  const sendOptimisticMessage = useCallback((payload) => {
    if (!activeChannel || !serverId) {
      toast.info("채널 선택 필요", "메시지를 보낼 채널을 먼저 선택해주세요.");
      return false;
    }

    const optimisticMessage = createOptimisticMessage(payload);
    appendMessageToChannel(activeChannel, optimisticMessage);

    const sent = sendWsMessage?.("sendMessage", payload);

    if (!sent) {
      markMessageFailed(activeChannel, payload.clientMessageId, "웹소켓 연결이 끊겨 전송하지 못했습니다.");
      toast.error("전송 실패", "연결이 복구되면 재전송 버튼으로 다시 보낼 수 있습니다.");
      return false;
    }

    scheduleMessageTimeout(activeChannel, payload.clientMessageId);
    return true;
  }, [
    activeChannel,
    appendMessageToChannel,
    createOptimisticMessage,
    markMessageFailed,
    scheduleMessageTimeout,
    sendWsMessage,
    serverId,
    toast,
  ]);

  const createUploadPayload = useCallback((savedFile, content = "") => {
    const imageType = savedFile.fileType?.startsWith("image/");
    const clientMessageId = createClientMessageKey();
    const createdAt = new Date().toISOString();

    return {
      messageId: clientMessageId,
      clientMessageId,
      createdAt,
      serverId,
      channelId: activeChannel,
      senderId: user?.userId,
      senderNickname: user?.nickname,
      messageType: imageType ? "IMAGE" : "FILE",
      content: content || (imageType ? "" : savedFile.fileName),
      imageUrl: imageType ? savedFile.fileUrl : undefined,
      fileUrl: savedFile.fileUrl,
      fileName: savedFile.fileName,
      fileType: savedFile.fileType,
      fileId: savedFile.fileId,
      s3ObjectKey: savedFile.s3ObjectKey,
    };
  }, [activeChannel, serverId, user?.nickname, user?.userId]);

  const handleUpload = useCallback(async (file) => {
    if (!file) return;
    if (!serverId || !activeChannel) {
      const message = "업로드할 채널을 먼저 선택해주세요.";
      setUploadFeedback(message);
      toast.info("채널 선택 필요", message);
      return;
    }
    if (!isConnected) {
      const message = "웹소켓 연결 후 다시 시도해주세요.";
      setUploadFeedback(message);
      toast.info("연결 확인", message);
      return;
    }

    const validation = validateUploadFile(file);
    if (!validation.ok) {
      setUploadFeedback(validation.message);
      toast.error("업로드 제한", validation.message);
      return;
    }

    setUploadFeedback("");

    if (isImageUpload(file)) {
      setPendingImage((prev) => {
        if (prev?.previewUrl) {
          URL.revokeObjectURL(prev.previewUrl);
        }

        return {
          file,
          previewUrl: URL.createObjectURL(file),
        };
      });
      return;
    }

    setIsUploading(true);
    try {
      const savedFile = await uploadFile(serverId, file);
      const payload = createUploadPayload(savedFile);
      sendOptimisticMessage(payload);
    } catch (error) {
      console.error("채팅 파일 업로드 실패:", error);
      const message = error.message || "파일 업로드에 실패했습니다.";
      setUploadFeedback(message);
      toast.error("업로드 실패", message);
    } finally {
      setIsUploading(false);
    }
  }, [activeChannel, createUploadPayload, isConnected, sendOptimisticMessage, serverId, toast]);

  const clearPendingImage = useCallback(() => {
    setPendingImage((prev) => {
      if (prev?.previewUrl) {
        URL.revokeObjectURL(prev.previewUrl);
      }
      return null;
    });
  }, []);

  const handleSend = useCallback(async () => {
    const trimmed = inputText.trim();

    if (!trimmed && !pendingImage) return;

    if (!activeChannel) {
      toast.info("채널 선택 필요", "메시지를 보낼 채널을 먼저 선택해주세요.");
      return;
    }

    if (!isConnected) {
      toast.info("연결 확인", "웹소켓 연결 후 다시 시도해주세요.");
      return;
    }

    if (pendingImage?.file) {
      const validation = validateUploadFile(pendingImage.file);
      if (!validation.ok) {
        setUploadFeedback(validation.message);
        toast.error("업로드 제한", validation.message);
        return;
      }

      setIsUploading(true);
      try {
        const savedFile = await uploadFile(serverId, pendingImage.file);
        const payload = createUploadPayload(savedFile, trimmed);
        setUploadFeedback("");
        sendOptimisticMessage(payload);

        setInputText("");
        clearPendingImage();
      } catch (error) {
        console.error("이미지 전송 실패:", error);
        const message = error.message || "이미지 전송에 실패했습니다.";
        setUploadFeedback(message);
        toast.error("이미지 전송 실패", message);
      } finally {
        setIsUploading(false);
      }

      return;
    }

    const payload = {
      messageId: createClientMessageKey(),
      createdAt: new Date().toISOString(),
      serverId,
      channelId: activeChannel,
      senderId: user?.userId,
      senderNickname: user?.nickname,
      messageType: "TEXT",
      content: trimmed,
    };
    payload.clientMessageId = payload.messageId;

    setUploadFeedback("");
    sendOptimisticMessage(payload);

    setInputText("");
  }, [
    activeChannel,
    clearPendingImage,
    createUploadPayload,
    inputText,
    isConnected,
    pendingImage,
    sendOptimisticMessage,
    serverId,
    toast,
    user?.nickname,
    user?.userId,
  ]);

  // ✅ 검색 실행
  const handleSearch = useCallback(async (keyword) => {
    if (!keyword.trim()) {
      setSearchResults(null);
      return;
    }
    setIsSearching(true);
    try {
      const results = await getServerMessages(serverId, keyword);
      setSearchResults(Array.isArray(results) ? results : []);
    } catch (error) {
      console.error("검색 실패:", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [serverId]);
 
  // ✅ 검색창 토글
  const handleToggleSearch = useCallback(() => {
    setIsSearchOpen((prev) => {
      if (prev) {
        setSearchQuery("");
        setSearchResults(null);
      }
      return !prev;
    });
  }, []);
 
  // ✅ 검색 입력 처리 (400ms 디바운스)
  const handleSearchInput = useCallback((value) => {
    setSearchQuery(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!value.trim()) {
      setSearchResults(null);
      return;
    }
    searchTimerRef.current = setTimeout(() => {
      handleSearch(value);
    }, 400);
  }, [handleSearch]);
 
  // ✅ 검색창 열릴 때 포커스
  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchOpen]);

  const handleKeyDown = (event) => {
    if (event.nativeEvent?.isComposing || isComposing || event.keyCode === 229) {
      return;
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  };

  const handleFileInputChange = async (event) => {
    const file = event.target.files?.[0];
    await handleUpload(file);
    event.target.value = "";
  };

  const handleOpenFilePicker = () => {
    if (isUploading) return;
    setUploadFeedback("");
    fileInputRef.current?.click();
  };

  const handleDragEnter = (event) => {
    if (!getExternalFileItems(event).length) return;
    event.preventDefault();
    dragDepthRef.current += 1;
    setIsDragOver(true);
  };

  const handleDragOver = (event) => {
    if (!getExternalFileItems(event).length) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsDragOver(true);
  };

  const handleDragLeave = (event) => {
    if (!getExternalFileItems(event).length) return;
    event.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setIsDragOver(false);
    }
  };

  const handleDrop = async (event) => {
    const file = getDroppedFile(event);
    if (!file) return;

    event.preventDefault();
    dragDepthRef.current = 0;
    setIsDragOver(false);
    await handleUpload(file);
  };

  const handleRetryMessage = useCallback((message) => {
    const payload = message?.retryPayload;

    if (!payload) {
      toast.error("재전송 실패", "다시 보낼 메시지 정보를 찾을 수 없습니다.");
      return;
    }

    setChannelMessages((prev) => ({
      ...prev,
      [activeChannel]: (prev[activeChannel] || []).map((item) =>
        item.clientMessageId === payload.clientMessageId
          ? {
              ...item,
              sendStatus: "failed",
              isRetrying: true,
            }
          : item,
      ),
    }));

    const sent = sendWsMessage?.("sendMessage", payload);

    if (!sent) {
      markMessageFailed(activeChannel, payload.clientMessageId, "웹소켓 연결이 끊겨 전송하지 못했습니다.");
      toast.error("재전송 실패", "연결 상태를 확인한 뒤 다시 시도해주세요.");
      return;
    }

    scheduleMessageTimeout(activeChannel, payload.clientMessageId);
    toast.info("재전송 중", "메시지를 다시 전송하고 있습니다.");
  }, [activeChannel, markMessageFailed, scheduleMessageTimeout, sendWsMessage, toast]);

  const renderMessageBody = (msg) => {
    const messageType = msg.messageType || msg.type;
    const content = msg.content || msg.text || "";

    if (IMAGE_MESSAGE_TYPES.has(messageType) && msg.imageUrl) {
      return (
        <div className="message-media-group">
          <a
            href={msg.imageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="chat-image-link"
          >
            <img
              src={msg.imageUrl}
              alt={msg.fileName || "uploaded"}
              className="chat-image"
            />
          </a>
          {content && (
            <p className={msg.sendStatus === "failed" ? "message-text message-text-failed" : "message-text"}>
              {content}
              {msg.isEdited && (
                <span className="message-edited">(수정됨)</span>
              )}
            </p>
          )}
        </div>
      );
    }

    return (
      <>
        {content && (
          <p className={msg.sendStatus === "failed" ? "message-text message-text-failed" : "message-text"}>
            {content}
            {msg.isEdited && (
              <span className="message-edited">(수정됨)</span>
            )}
          </p>
        )}

        {FILE_MESSAGE_TYPES.has(messageType) && (
          <a
            href={msg.fileUrl || "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="file-attachment"
          >
            <span className="file-icon">📄</span>
            <div className="file-info">
              <span className="file-name">{msg.fileName || content}</span>
              <span className="file-meta">{msg.fileType || "첨부 파일"}</span>
            </div>
          </a>
        )}

        {LINK_MESSAGE_TYPES.has(messageType) && (
          <div className="file-attachment link-attachment">
            <span className="file-icon">🔗</span>
            <div className="file-info">
              <span className="file-name">{msg.linkName}</span>
              <span className="file-meta">{msg.linkUrl}</span>
            </div>
          </div>
        )}
      </>
    );
  };

  const hasRenderableContent = (msg) => {
    const messageType = msg.messageType || msg.type;
    const content = msg.content || msg.text || "";

    if (AI_SUMMARY_MESSAGE_TYPES.has(msg.type) || AI_SUMMARY_MESSAGE_TYPES.has(msg.messageType)) {
      return true;
    }
    if (AI_PENDING_MESSAGE_TYPES.has(messageType) || AI_FAILED_MESSAGE_TYPES.has(messageType)) {
      return true;
    }
    if (IMAGE_MESSAGE_TYPES.has(messageType)) {
      return Boolean(msg.imageUrl || content);
    }
    if (FILE_MESSAGE_TYPES.has(messageType)) {
      return Boolean(msg.fileUrl || msg.fileName || content);
    }
    if (LINK_MESSAGE_TYPES.has(messageType)) {
      return Boolean(msg.linkUrl || msg.linkName);
    }

    return Boolean(content);
  };

  return (
    <main
      className={`chat-main ${isDragOver ? "drag-active" : ""}`}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <header className="chat-header">
        <h3>
          <span className="hash">#</span>{" "}
          {currentChannel ? currentChannel.name || currentChannel.label : "채널 선택 중..."}
        </h3>
        <p className="topic">{currentChannel?.topic}</p>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "8px" }}>
          {/* ✅ 검색창 */}
          {isSearchOpen && (
            <div className="chat-search-bar">
              <span className="chat-search-icon">🔍</span>
              <input
                ref={searchInputRef}
                type="text"
                className="chat-search-input"
                placeholder="메시지 검색..."
                value={searchQuery}
                onChange={(e) => handleSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") handleToggleSearch();
                  if (e.key === "Enter") handleSearch(searchQuery);
                }}
              />
              {searchQuery && (
                <button
                  className="chat-search-clear"
                  onClick={() => { setSearchQuery(""); setSearchResults(null); }}
                >
                  ×
                </button>
              )}
            </div>
          )}
          {/* ✅ 검색 토글 버튼 */}
          <button
            className={`chat-search-toggle ${isSearchOpen ? "active" : ""}`}
            onClick={handleToggleSearch}
            title="메시지 검색"
          >
            🔍
          </button>
          <span
            style={{
              // marginLeft: "auto",
              fontSize: "11px",
              color: isConnected ? "#00ff66" : "#71717a",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <span style={{ fontSize: "8px" }}>●</span>
            {isConnected ? "연결됨" : "연결 중..."}
          </span>
        </div>
      </header>
      {/* ✅ 검색 결과 패널 */}
      {isSearchOpen && (
        <div className="chat-search-results">
          {isSearching ? (
            <div className="chat-search-status">검색 중...</div>
          ) : searchResults === null ? (
            <div className="chat-search-status">검색어를 입력하세요</div>
          ) : searchResults.length === 0 ? (
            <div className="chat-search-empty">
              <span>🔍</span>
              <p>"{searchQuery}"에 대한 검색 결과가 없습니다</p>
            </div>
          ) : (
            <div className="chat-search-list">
              <div className="chat-search-count">{searchResults.length}개의 결과</div>
              {searchResults.map((msg, idx) => (
                <div key={msg.messageId || idx} className="chat-search-item">
                  <div className="chat-search-item-author">{msg.senderNickname || "알 수 없음"}</div>
                  <div className="chat-search-item-content">{msg.content}</div>
                  <div className="chat-search-item-date">
                    {msg.createdAt ? new Date(msg.createdAt).toLocaleString("ko-KR") : ""}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="chat-messages">
        {currentMessages.length === 0 ? (
          <div
            className="no-messages"
            style={{
              color: "#52525b",
              padding: "20px",
              textAlign: "center",
              fontSize: "14px",
            }}
          >
            채널에 메시지가 없습니다. 대화를 시작해보세요!
          </div>
        ) : (
          currentMessages.map((msg, idx) => {
            const key = msg.messageId || idx;

            if (msg.isDeleted) {
              return (
                <div key={key} className="message-dummy">
                  <div className="avatar" style={{ opacity: 0.4 }}>?</div>
                  <div className="message-content">
                    <p style={{ color: "#52525b", fontStyle: "italic" }}>삭제된 메시지입니다.</p>
                  </div>
                </div>
              );
            }

            // AI 분석 진행 중 임시 메시지
            if (AI_PENDING_MESSAGE_TYPES.has(msg.messageType)) {
              return (
                <div key={key} className="ai-summary-box" style={{ opacity: 0.7 }}>
                  <div className="ai-summary-header">
                    <span className="ai-icon">🔄</span>
                    <span className="ai-label">SAGE AI</span>
                    <span className="ai-tag">분석 중</span>
                    {msg.fileName && (
                      <span
                        className="ai-filename"
                        style={{
                          marginLeft: "8px",
                          fontSize: "12px",
                          color: "#a1a1aa",
                          fontStyle: "italic",
                        }}
                      >
                        📎 {msg.fileName}
                      </span>
                    )}
                  </div>
                  <div className="ai-summary-content">
                    <div style={{ fontSize: "13px", color: "#d4d4d8", lineHeight: 1.6 }}>
                      {msg.requestedBy ? `${msg.requestedBy}님이 요청한` : "요청된"} 파일을 분석하고 있어요.
                      <br />
                      <span style={{ fontSize: "11px", color: "#71717a" }}>
                        PDF는 1~5분 소요됩니다. 완료되면 자동으로 결과가 표시됩니다.
                      </span>
                    </div>
                  </div>
                </div>
              );
            }

            // AI 분석 실패 메시지
            if (AI_FAILED_MESSAGE_TYPES.has(msg.messageType)) {
              return (
                <div key={key} className="ai-summary-box" style={{ opacity: 0.6 }}>
                  <div className="ai-summary-header">
                    <span className="ai-icon">❌</span>
                    <span className="ai-label" style={{ color: "#ef4444" }}>SAGE AI</span>
                    <span className="ai-tag" style={{ color: "#ef4444" }}>분석 실패</span>
                    {msg.fileName && (
                      <span
                        className="ai-filename"
                        style={{
                          marginLeft: "8px",
                          fontSize: "12px",
                          color: "#a1a1aa",
                          fontStyle: "italic",
                        }}
                      >
                        📎 {msg.fileName}
                      </span>
                    )}
                  </div>
                  <div className="ai-summary-content">
                    <div style={{ fontSize: "13px", color: "#d4d4d8", lineHeight: 1.6 }}>
                      분석에 시간이 너무 오래 걸려 중단되었습니다.
                      <br />
                      <span style={{ fontSize: "11px", color: "#71717a" }}>
                        잠시 후 🤖 버튼으로 다시 시도해주세요.
                      </span>
                    </div>
                  </div>
                </div>
              );
            }

            // AI 요약 타입 렌더링
            if (AI_SUMMARY_MESSAGE_TYPES.has(msg.type) || AI_SUMMARY_MESSAGE_TYPES.has(msg.messageType)) {
              let aiResult = {};
              try {
                aiResult =
                  typeof msg.content === "string"
                    ? JSON.parse(msg.content)
                    : msg.content || {};
              } catch {
                aiResult = {};
              }

              const isDocument = aiResult.type === "document";
              const isImage = aiResult.type === "image";

              return (
                <div key={key} className="ai-summary-box">
                  <div className="ai-summary-header">
                    <span className="ai-icon">🤖</span>
                    <span className="ai-label">SAGE AI</span>
                    <span className="ai-tag">
                      {isDocument ? "문서 요약" : isImage ? "이미지 분석" : "AI 분석"}
                    </span>
                    {aiResult.fileName && (
                      <span
                        className="ai-filename"
                        style={{
                          marginLeft: "8px",
                          fontSize: "12px",
                          color: "#a1a1aa",
                          fontStyle: "italic",
                        }}
                      >
                        📎 {aiResult.fileName}
                      </span>
                    )}
                  </div>
                  <div className="ai-summary-content">
                    {isDocument && aiResult.summary && (
                      <>
                        <h4 className="ai-summary-title">📄 문서 요약</h4>
                        <div
                          style={{
                            fontSize: "13px",
                            color: "#d4d4d8",
                            lineHeight: 1.6,
                            whiteSpace: "pre-wrap",
                          }}
                        >
                          {aiResult.summary}
                        </div>
                      </>
                    )}
                    {isImage && (
                      <>
                        <h4 className="ai-summary-title">🖼️ 이미지 분석</h4>
                        {aiResult.labelsKo?.length > 0 && (
                          <div style={{ marginBottom: "8px" }}>
                            <span style={{ fontSize: "12px", color: "#a1a1aa" }}>
                              감지된 태그:
                            </span>{" "}
                            {aiResult.labelsKo.map((tag, i) => (
                              <span
                                key={i}
                                style={{
                                  display: "inline-block",
                                  background: "rgba(0,255,102,0.1)",
                                  color: "#00ff66",
                                  padding: "2px 8px",
                                  borderRadius: "10px",
                                  fontSize: "11px",
                                  margin: "2px 4px 2px 0",
                                }}
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                        {aiResult.detectedTexts?.length > 0 && (
                          <div>
                            <span style={{ fontSize: "12px", color: "#a1a1aa" }}>
                              감지된 텍스트:
                            </span>{" "}
                            <span style={{ fontSize: "13px", color: "#d4d4d8" }}>
                              {aiResult.detectedTexts.join(", ")}
                            </span>
                          </div>
                        )}
                      </>
                    )}
                    {!isDocument && !isImage && (
                      <div style={{ fontSize: "13px", color: "#d4d4d8" }}>{msg.content}</div>
                    )}
                  </div>
                </div>
              );
            }

            const authorName = msg.senderNickname || msg.author || "알 수 없음";
            const isMine =
              msg.senderId === user?.userId || authorName === CURRENT_USER;
            const avatarChar = authorName.charAt(0).toUpperCase();

            if (!hasRenderableContent(msg)) {
              return null;
            }

            return (
              <div
                key={key}
                className={`message-dummy ${isMine ? "message-mine" : ""} ${msg.sendStatus === "sending" ? "message-pending" : ""} ${msg.sendStatus === "failed" ? "message-failed" : ""}`}
              >
                {!isMine && <div className="avatar">{avatarChar}</div>}
                <div className={`message-content ${isMine ? "mine-content" : ""}`}>
                  <span className={`author ${isMine ? "mine-author" : ""}`}>{authorName}</span>
                  {renderMessageBody(msg)}
                  {(msg.sendStatus === "sending" || msg.sendStatus === "failed") && (
                    <div className={`message-status-row ${msg.sendStatus}`}>
                      <span className="message-status-text">
                        {msg.sendStatus === "sending"
                          ? "전송 중..."
                          : msg.isRetrying
                            ? "재전송 중..."
                          : msg.sendError || "전송 실패"}
                      </span>
                      {msg.sendStatus === "failed" && !msg.isRetrying && (
                        <button
                          type="button"
                          className="message-retry-button"
                          onClick={() => handleRetryMessage(msg)}
                        >
                          재전송
                        </button>
                      )}
                    </div>
                  )}
                </div>
                {isMine && <div className="avatar">{avatarChar}</div>}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {isDragOver && (
        <div className="chat-upload-overlay">
            <div className="chat-upload-overlay-card">
            <div className="chat-upload-overlay-badge">UPLOAD</div>
            <strong>파일을 놓아 첨부 준비</strong>
            <span>이미지는 입력창에 미리보기로 올라가고, 전송 시 실제 업로드됩니다.</span>
          </div>
        </div>
      )}

      <div className="chat-input-area">
        <div className={`chat-upload-policy ${uploadFeedback ? "is-error" : ""}`}>
          {uploadFeedback || `업로드 가능 형식: ${UPLOAD_POLICY_LABEL}`}
        </div>
        {pendingImage && (
          <div className="chat-pending-image">
            <img
              src={pendingImage.previewUrl}
              alt={pendingImage.file?.name || "pending upload"}
              className="chat-pending-image-preview"
            />
            <div className="chat-pending-image-meta">
              <strong>{pendingImage.file?.name}</strong>
              <span>Enter 또는 전송 버튼으로 업로드 및 전송</span>
            </div>
            <button
              type="button"
              className="chat-pending-image-remove"
              onClick={clearPendingImage}
              aria-label="이미지 첨부 취소"
            >
              ×
            </button>
          </div>
        )}
        <div className="chat-input-shell">
          <button
            type="button"
            className="chat-input-icon-button"
            onClick={handleOpenFilePicker}
            disabled={!isConnected || isUploading}
            aria-label="파일 추가"
          >
            +
          </button>
          <input
            ref={fileInputRef}
            type="file"
            style={{ display: "none" }}
            onChange={handleFileInputChange}
          />
          <input
            type="text"
            placeholder={
              isConnected
                ? `#${currentChannel?.name || currentChannel?.label || "채널"}에 메시지 보내기`
                : "연결 중..."
            }
            value={inputText}
            onChange={(event) => {
              setInputText(event.target.value);
              if (uploadFeedback) {
                setUploadFeedback("");
              }
            }}
            onCompositionStart={() => setIsComposing(true)}
            onCompositionEnd={() => setIsComposing(false)}
            onKeyDown={handleKeyDown}
            disabled={!isConnected || isUploading}
          />
          <button
            type="button"
            className="chat-send-button"
            onClick={() => {
              void handleSend();
            }}
            disabled={!isConnected || isUploading || (!inputText.trim() && !pendingImage)}
            aria-label="메시지 전송"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M3 11.5 20.5 3l-4.4 18-4.8-6-5.9-3.5 8-3.4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>
    </main>
  );
};

export default ChatWindow;

import React, { useState, useEffect, useCallback } from "react";
import { listInvites, createInvite, deleteInvite, resetInvites } from "../../lib/servers";
import { useToast } from "../../contexts/ToastContext";

const EXPIRES_OPTIONS = [
  { label: "24시간", value: 24 },
  { label: "7일", value: 24 * 7 },
  { label: "30일", value: 24 * 30 },
];

const MAX_USES_OPTIONS = [
  { label: "무제한", value: "" },
  { label: "1회", value: 1 },
  { label: "5회", value: 5 },
  { label: "10회", value: 10 },
  { label: "25회", value: 25 },
];

function formatExpiry(expiresAt) {
  if (!expiresAt) return "-";
  const date = new Date(expiresAt * 1000);
  return date.toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function copyToClipboard(text) {
  // [향후 HTTPS 도입 시 사용]
  // navigator.clipboard?.writeText(text).catch((err) => { console.error(err); });

  // 범용 복사 방식 (HTTP/HTTPS 모두 지원)
  const textArea = document.createElement("textarea");
  textArea.value = text;

  // 요소를 화면 밖으로 숨김
  textArea.style.position = "fixed";
  textArea.style.left = "-9999px";
  textArea.style.top = "0";
  document.body.appendChild(textArea);

  textArea.focus();
  textArea.select();

  try {
    document.execCommand("copy");
  } catch (err) {
    console.error("복사 실패:", err);
  }

  document.body.removeChild(textArea);
}

const InviteManager = ({ serverId }) => {
  const toast = useToast();
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [expiresInHours, setExpiresInHours] = useState(24 * 7);
  const [maxUses, setMaxUses] = useState("");
  const [copiedCode, setCopiedCode] = useState("");

  const fetchInvites = useCallback(async () => {
    try {
      setLoading(true);
      const result = await listInvites(serverId);
      setInvites(result.items || []);
    } catch (error) {
      console.error("초대 코드 목록 조회 실패:", error);
      toast.error("조회 실패", "초대 코드 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [serverId, toast]);

  useEffect(() => {
    fetchInvites();
  }, [fetchInvites]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const options = { expiresInHours: Number(expiresInHours) };
      if (maxUses !== "") options.maxUses = Number(maxUses);
      const result = await createInvite(serverId, options);
      setInvites((prev) => [result.invite, ...prev]);
      toast.success("생성 완료", `초대 코드 ${result.invite.inviteCode}가 생성되었습니다.`);
    } catch (error) {
      toast.error("생성 실패", error.message || "초대 코드 생성에 실패했습니다.");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (inviteId) => {
    if (!window.confirm("초대 코드를 삭제하시겠습니까?")) return;
    try {
      await deleteInvite(serverId, inviteId);
      setInvites((prev) => prev.filter((i) => i.inviteId !== inviteId));
      toast.success("삭제 완료", "초대 코드가 삭제되었습니다.");
    } catch (error) {
      toast.error("삭제 실패", error.message || "초대 코드 삭제에 실패했습니다.");
    }
  };

  const handleReset = async () => {
    if (!window.confirm("모든 초대 코드를 초기화하시겠습니까?")) return;
    try {
      await resetInvites(serverId);
      setInvites([]);
      toast.success("초기화 완료", "모든 초대 코드가 삭제되었습니다.");
    } catch (error) {
      toast.error("초기화 실패", error.message || "초대 코드 초기화에 실패했습니다.");
    }
  };

  const handleCopy = (code) => {
    copyToClipboard(code);
    setCopiedCode(code);
    toast.success("복사 완료", `초대 코드 ${code}가 클립보드에 복사되었습니다.`);
    setTimeout(() => setCopiedCode(""), 2000);
  };

  return (
    <div className="invite-manager">
      {/* 생성 영역 */}
      <div className="invite-create-box">
        <h4 className="invite-section-title">새 초대 코드 생성</h4>
        <div className="invite-options">
          <div className="invite-option-group">
            <label>유효 기간</label>
            <select value={expiresInHours} onChange={(e) => setExpiresInHours(e.target.value)}>
              {EXPIRES_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="invite-option-group">
            <label>최대 사용 횟수</label>
            <select value={maxUses} onChange={(e) => setMaxUses(e.target.value)}>
              {MAX_USES_OPTIONS.map((o) => (
                <option key={o.label} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <button
            className="invite-create-btn"
            onClick={handleCreate}
            disabled={creating}
          >
            {creating ? "생성 중..." : "+ 코드 생성"}
          </button>
        </div>
      </div>

      {/* 목록 영역 */}
      <div className="invite-list-box">
        <div className="invite-list-header">
          <h4 className="invite-section-title">활성 초대 코드 {invites.length > 0 ? `(${invites.length})` : ""}</h4>
          {invites.length > 0 && (
            <button className="invite-reset-btn" onClick={handleReset}>
              전체 초기화
            </button>
          )}
        </div>

        {loading ? (
          <div className="invite-loading">불러오는 중...</div>
        ) : invites.length === 0 ? (
          <div className="invite-empty">
            <span>🔗</span>
            <p>활성 초대 코드가 없습니다</p>
          </div>
        ) : (
          <div className="invite-list">
            {invites.map((invite) => (
              <div key={invite.inviteId} className="invite-item">
                <div className="invite-code-badge">{invite.inviteCode}</div>
                <div className="invite-meta">
                  <span>만료: {formatExpiry(invite.expiresAt)}</span>
                  <span>사용: {invite.useCount || 0}{invite.maxUses ? `/${invite.maxUses}` : ""}</span>
                </div>
                <div className="invite-actions">
                  <button
                    className={`invite-copy-btn ${copiedCode === invite.inviteCode ? "copied" : ""}`}
                    onClick={() => handleCopy(invite.inviteCode)}
                  >
                    {copiedCode === invite.inviteCode ? "✓ 복사됨" : "복사"}
                  </button>
                  <button
                    className="invite-delete-btn"
                    onClick={() => handleDelete(invite.inviteId)}
                  >
                    삭제
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default InviteManager;
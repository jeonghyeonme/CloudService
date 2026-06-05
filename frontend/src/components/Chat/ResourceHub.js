import React, { useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { uploadFile, saveLink, deleteFile, deleteLink } from '../../lib/resources';
import { analyzeResource } from '../../lib/ai';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { UPLOAD_POLICY_LABEL, validateUploadFile } from '../../lib/uploadPolicy';

import './ResourceHub.css';

const getFileIcon = (fileName) => {
  if (!fileName) return '📁';
  const extension = fileName.split('.').pop().toLowerCase();
  if (['docx', 'hwp', 'doc'].includes(extension)) return '📝';
  if (extension === 'pdf') return '📄';
  if (['csv', 'xlsx', 'xls'].includes(extension)) return '📊';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension)) return '🖼️';
  return '📁';
};

const isAnalyzable = (fileName, fileType) => {
  if (!fileName) return false;
  const ext = fileName.split('.').pop().toLowerCase();
  if (ext === 'pdf' || fileType?.includes('pdf')) return true;
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext) || fileType?.startsWith('image/')) return true;
  return false;
};

// ✅ 파일/링크 목록 Skeleton UI
const ResourceSkeleton = () => (
  <div className="hub-skeleton-list">
    {[...Array(4)].map((_, i) => (
      <div key={i} className="hub-skeleton-item">
        <div className="skeleton hub-skeleton-icon" />
        <div className="hub-skeleton-info">
          <div className="skeleton hub-skeleton-name" style={{ width: `${50 + i * 10}%` }} />
          <div className="skeleton hub-skeleton-meta" style={{ width: `${30 + i * 8}%` }} />
        </div>
      </div>
    ))}
  </div>
);

// ✅ Empty State
const EmptyState = ({ icon, text }) => (
  <div className="hub-empty-state">
    <span className="hub-empty-icon">{icon}</span>
    <p className="hub-empty-text">{text}</p>
  </div>
);

/**
 * @param {object} serverResources - 서버 상세 데이터
 * @param {function} setCurrentServer - 서버 state 업데이트 함수
 * @param {function} sendWsMessage - WebSocket 메시지 전송 함수 (ChatLayout에서 전달)
 * @param {boolean} loading - 서버 데이터 로딩 상태
 */
const ResourceHub = ({ serverResources, setCurrentServer, sendWsMessage, loading = false }) => {
  const { user } = useAuth();
  const toast = useToast();
  const [activeHubTab, setActiveHubTab] = useState('Files');
  const { serverId } = useParams();
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [analyzingFileId, setAnalyzingFileId] = useState(null);
  const [uploadFeedback, setUploadFeedback] = useState('');

  const files = serverResources?.files || [];
  const links = serverResources?.links || [];

  // ✅ resourceUpdated 브로드캐스트 헬퍼
  const broadcastResourceUpdate = (type, action, data) => {
    sendWsMessage?.('resourceUpdated', {
      serverId,
      resourceType: type,   // 'file' | 'link'
      resourceAction: action, // 'add' | 'delete'
      data,
    });
  };

  // ✅ 채팅 알림 메시지 자동 전송 헬퍼
  const sendNotificationMessage = (content) => {
    sendWsMessage?.('sendMessage', {
      serverId,
      senderId: user?.userId,
      senderNickname: user?.nickname,
      senderProfileImageUrl: user?.profileImageUrl || null,
      messageType: 'TEXT',
      content,
    });
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateUploadFile(file);
    if (!validation.ok) {
      setUploadFeedback(validation.message);
      toast.error('업로드 제한', validation.message);
      return;
    }

    setUploadFeedback('');
    setUploading(true);
    try {
      const savedFile = await uploadFile(serverId, file);
      if (setCurrentServer && savedFile) {
        setCurrentServer(prev => ({
          ...prev,
          files: [...(prev?.files || []), savedFile],
        }));
        // ✅ 파일 업로드 완료 시 브로드캐스트
        broadcastResourceUpdate('file', 'add', savedFile);
        
        // ✅ 파일 업로드 알림 메시지 자동 전송
        sendNotificationMessage(`📎 ${user?.nickname}님이 파일을 공유했습니다: ${savedFile.fileName || file.name}`);
      }
    } catch (error) {
      console.error('업로드 실패:', error);
      const message = error.message || '업로드 실패';
      setUploadFeedback(message);
      toast.error('업로드 실패', message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleLinkAdd = async () => {
    const url = prompt('공유할 URL을 입력하세요:');
    if (!url) return;
    try {
      const result = await saveLink(serverId, url);
      if (setCurrentServer && result?.link) {
        setCurrentServer(prev => ({
          ...prev,
          links: [...(prev?.links || []), result.link],
        }));
        // ✅ 링크 저장 완료 시 브로드캐스트
        broadcastResourceUpdate('link', 'add', result.link);

        // ✅ 링크 추가 알림 메시지 자동 전송
        sendNotificationMessage(`🔗 ${user?.nickname}님이 링크를 공유했습니다: ${result.link.title || url}`);
      }
    } catch (error) {
      console.error('링크 저장 실패:', error);
      toast.error('링크 저장 실패', error.message || '링크 저장 실패');
    }
  };

  const handleAnalyze = async (e, file) => {
    e.preventDefault();
    e.stopPropagation();

    if (analyzingFileId) {
      toast.info('분석 대기', '다른 파일을 분석 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    const ext = file.fileName?.split('.').pop().toLowerCase();
    let fileType = file.fileType || '';
    if (!fileType) {
      if (ext === 'pdf') fileType = 'application/pdf';
      else if (['jpg', 'jpeg'].includes(ext)) fileType = 'image/jpeg';
      else if (ext === 'png') fileType = 'image/png';
      else if (ext === 'gif') fileType = 'image/gif';
      else if (ext === 'webp') fileType = 'image/webp';
    }

    // 임시 메시지 식별용 uuid
    const requestId = uuidv4();

    setAnalyzingFileId(file.fileId);

    // 1. 같은 채널 모든 사람에게 "분석 시작" 브로드캐스트
    sendWsMessage?.('aiAnalysisStarted', {
      serverId,
      fileName: file.fileName,
      requestId,
      requestedBy: user?.nickname || '누군가',
    });

    // 2. AI 분석 요청 (백엔드)
    try {
      await analyzeResource({
        serverId,
        s3ObjectKey: file.s3ObjectKey,
        fileType,
        fileName: file.fileName,
        requestId, // 같은 requestId 함께 전송 → 결과에 aiRequestId로 박혀 돌아옴
      });
      // 정상 완료. 임시 메시지는 ai-summary 도착 시 자동 교체됨.
    } catch (error) {
      // API Gateway 29초 타임아웃은 정상 (Lambda는 백그라운드 실행 중)
      console.log('AI 분석 요청 진행 중:', error.message);
      toast.info('분석 요청 접수', 'AI 분석이 백그라운드에서 진행 중입니다. 완료되면 채팅창에 표시됩니다.');
    } finally {
      setAnalyzingFileId(null);
    }
  };

  const handleDeleteFile = async (e, fileId) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm('파일을 삭제하시겠습니까?')) return;
    try {
      await deleteFile(serverId, fileId);
      if (setCurrentServer) {
        setCurrentServer(prev => ({
          ...prev,
          files: (prev?.files || []).filter(f => f.fileId !== fileId),
        }));
        // ✅ 파일 삭제 완료 시 브로드캐스트
        broadcastResourceUpdate('file', 'delete', { fileId });
      }
    } catch (error) {
      console.error('파일 삭제 실패:', error);
      toast.error('파일 삭제 실패', error.message || '파일 삭제 실패');
    }
  };

  const handleDeleteLink = async (e, linkId) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm('링크를 삭제하시겠습니까?')) return;
    try {
      await deleteLink(serverId, linkId);
      if (setCurrentServer) {
        setCurrentServer(prev => ({
          ...prev,
          links: (prev?.links || []).filter(l => l.linkId !== linkId),
        }));
        // ✅ 링크 삭제 완료 시 브로드캐스트
        broadcastResourceUpdate('link', 'delete', { linkId });
      }
    } catch (error) {
      console.error('링크 삭제 실패:', error);
      toast.error('링크 삭제 실패', error.message || '링크 삭제 실패');
    }
  };

  const renderFileItem = (file, i) => {
    const displayName = file.fileName || file.name;
    const fileExt = displayName ? displayName.split('.').pop().toLowerCase() : '';
    const fileTypeClass = ['pdf', 'docx', 'csv'].includes(fileExt) ? fileExt : 'default';
    const displayMeta = file.fileType || file.meta || fileExt.toUpperCase();
    const canAnalyze = isAnalyzable(displayName, file.fileType);
    const isAnalyzing = analyzingFileId === file.fileId;

    return (
      <a key={file.fileId || i} href={file.fileUrl || '#'} target="_blank" rel="noopener noreferrer" className="hub-file-item resource-item-hover" style={{ textDecoration: 'none', color: 'inherit', position: 'relative' }}>
        <div className={'hub-file-icon ' + fileTypeClass}>{getFileIcon(displayName)}</div>
        <div className="hub-file-info">
          <span className="hub-file-name">{displayName}</span>
          <span className="hub-file-meta">{displayMeta}</span>
        </div>
        <div className="hub-file-actions">
          {canAnalyze && (
            <button className="ai-analyze-btn" onClick={(e) => handleAnalyze(e, file)} disabled={isAnalyzing} title="AI 분석">
              {isAnalyzing ? '⏳' : '🤖'}
            </button>
          )}
          <button className="delete-btn" onClick={(e) => handleDeleteFile(e, file.fileId)}>×</button>
        </div>
      </a>
    );
  };

  const renderLinkItem = (link, i) => {
    return (
      <a key={link.linkId || i} href={link.url} target="_blank" rel="noopener noreferrer" className="hub-file-item resource-item-hover" style={{ textDecoration: 'none', color: 'inherit', position: 'relative' }}>
        <div className="hub-file-icon" style={{ backgroundColor: '#1a2a3a' }}>
          {link.image
            ? <img src={link.image} alt="" style={{ width: '100%', height: '100%', borderRadius: '6px', objectFit: 'cover' }} />
            : '🔗'
          }
        </div>
        <div className="hub-file-info">
          <span className="hub-file-name">{link.title}</span>
          <span className="hub-file-meta">{link.siteName || link.url}</span>
        </div>
        <button className="delete-btn" onClick={(e) => handleDeleteLink(e, link.linkId)}>×</button>
      </a>
    );
  };

  return (
    <aside className="sidebar-right">
      <div className="resource-hub">
        <div className="hub-header">
          <h3 className="hub-title">리소스 허브</h3>
          <div className="hub-tabs">
            {[{ en: 'Files', ko: '파일' }, { en: 'Links', ko: '링크' }].map((tab) => (
              <button
                key={tab.en}
                className={'hub-tab' + (activeHubTab === tab.en ? ' active' : '')}
                onClick={() => setActiveHubTab(tab.en)}
              >
                {tab.ko}
              </button>
            ))}
          </div>
        </div>

        {activeHubTab === 'Files' && (
          <div className="hub-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <p className="hub-section-label">최근 파일</p>
              <button
                onClick={() => {
                  setUploadFeedback('');
                  if (fileInputRef.current) fileInputRef.current.click();
                }}
                disabled={uploading}
                style={{ background: '#00ff66', color: '#000', border: 'none', borderRadius: '4px', padding: '4px 10px', fontSize: '11px', fontWeight: 700, cursor: uploading ? 'not-allowed' : 'pointer', opacity: uploading ? 0.6 : 1 }}
              >
                {uploading ? '업로드 중...' : '+ 업로드'}
              </button>
              <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={handleFileSelect} />
            </div>
            <div className={`hub-upload-policy ${uploadFeedback ? 'is-error' : ''}`}>
              {uploadFeedback || `업로드 가능 형식: ${UPLOAD_POLICY_LABEL}`}
            </div>
            <div className="hub-file-list">
              {/* ✅ 로딩 중 → Skeleton / 파일 없음 → Empty State / 있음 → 목록 */}
              {loading ? (
                <ResourceSkeleton />
              ) : files.length > 0 ? (files.map(renderFileItem)
              ) : (
                <EmptyState icon="📁" text="공유된 파일이 없습니다" />
              )}
            </div>
          </div>
        )}

        {activeHubTab === 'Links' && (
          <div className="hub-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <p className="hub-section-label">공유된 링크</p>
              {!loading && (
                <button
                  onClick={handleLinkAdd}
                  style={{ background: '#00ff66', color: '#000', border: 'none', borderRadius: '4px', padding: '4px 10px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
              >
                + 링크 추가
                </button>
              )}
            </div>
            <div className="hub-file-list">
              {loading ? (
                <ResourceSkeleton />
              ) : links.length > 0 ? (
                links.map(renderLinkItem)
              ) : (
                <EmptyState icon="🔗" text="공유된 링크가 없습니다" />
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

export default ResourceHub;

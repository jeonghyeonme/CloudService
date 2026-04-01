import React, { useState } from 'react';
import './ExploreRooms.css';

// 목업 데이터 (나중에 mockData.js 또는 API로 교체)
const MOCK_ROOMS = [
  {
    id: 1,
    name: 'AWS SAA STUDY',
    description: 'Prepping for the Solutions Architect exam. Focused on practice tests and key services.',
    status: 'ACTIVE',
    currentMembers: 8,
    maxMembers: null,
    isPrivate: false,
    emoji: '⌨️',
  },
  {
    id: 2,
    name: 'ALGORITHM PRACTICE',
    description: 'LeetCode medium/hard grinds. No voice, just music and focus...',
    status: 'ACTIVE',
    currentMembers: 4,
    maxMembers: 10,
    isPrivate: false,
    emoji: '🔷',
  },
  {
    id: 3,
    name: 'UI UX CRITIQUE',
    description: 'Design system workshop and portfolio review. Sharing Figma files and feedback.',
    status: 'FULL',
    currentMembers: 12,
    maxMembers: 12,
    isPrivate: true,
    emoji: '🖥️',
  },
  {
    id: 4,
    name: 'QUANTUM MECHANICS',
    description: "Finals prep for Physics 301. Solving Schrödinger's equation and quantum states.",
    status: 'ACTIVE',
    currentMembers: 5,
    maxMembers: 8,
    isPrivate: false,
    emoji: '📐',
  },
  {
    id: 5,
    name: 'REACT & NEXT.JS',
    description: 'Building production-grade apps. Troubleshooting server components and deployment.',
    status: 'ACTIVE',
    currentMembers: 18,
    maxMembers: 25,
    isPrivate: false,
    emoji: '💻',
  },
];

const RoomCard = ({ room, onJoin }) => {
  const isFull = room.status === 'FULL';
  const isLocked = room.isPrivate && isFull;

  return (
    <div className={`room-card ${isFull ? 'room-full' : ''}`}>
      {/* 상단 커버 영역 */}
      <div className="room-cover">
        <div className="room-cover-emoji">{room.emoji}</div>
        <span className={`room-badge badge-${room.status.toLowerCase()}`}>
          {room.status}
        </span>
      </div>

      {/* 하단 정보 영역 */}
      <div className="room-body">
        <div className="room-title-row">
          <h3 className="room-name">{room.name}</h3>
          {room.maxMembers && (
            <span className="room-count">
              {room.currentMembers}/{room.maxMembers}
            </span>
          )}
        </div>
        <p className="room-desc">{room.description}</p>

        <div className="room-footer">
          {/* 멤버 아바타 더미 */}
          <div className="member-avatars">
            {[...Array(Math.min(3, room.currentMembers))].map((_, i) => (
              <div key={i} className="mini-avatar" style={{ zIndex: 3 - i }} />
            ))}
            {room.currentMembers > 3 && (
              <span className="member-extra">+{room.currentMembers - 3}</span>
            )}
          </div>

          {/* 버튼 */}
          {isLocked ? (
            <button className="room-btn btn-locked" disabled>LOCKED</button>
          ) : isFull ? (
            <button className="room-btn btn-locked" disabled>FULL</button>
          ) : (
            <button className="room-btn btn-join" onClick={() => onJoin(room)}>
              JOIN
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const ExploreRooms = ({ onEnterRoom, onAddClick }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [inviteCode, setInviteCode] = useState('');

  const filteredRooms = MOCK_ROOMS.filter(room =>
    room.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    room.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="explore-container">

      {/* ── 극좌측 서버 네비게이션 (ChatLayout과 동일 구조) ── */}
      <nav className="server-nav">
        {/* 홈 아이콘 - 현재 선택됨 */}
        <div className="server-icon home-icon active">🏠</div>
        <div className="server-separator" />
        <div className="server-icon dummy-bg-1" onClick={onEnterRoom} title="스터디룸 입장" />
        <div className="server-icon dummy-bg-2" onClick={onEnterRoom} title="스터디룸 입장" />
        {/* + 버튼 */}
        <div className="server-icon add-btn" onClick={onAddClick}>+</div>
        <div className="spacer" />
        {/* <div className="server-icon dummy-profile" /> */}
      </nav>

      {/* ── 메인 콘텐츠 ── */}
      <div className="explore-main">

        {/* 상단 액션 아이콘 */}
        <div className="explore-topbar">
          <span className="topbar-title">EXPLORE ROOMS</span>
          <div className="topbar-icons">
            <button className="icon-btn">🔔</button>
            <button className="icon-btn">⚙️</button>
          </div>
        </div>

        {/* 타이틀 */}
        <div className="explore-hero">
          <h1 className="hero-title">
            서버를 <span className="accent">생성</span>하거나{' '}
            <span className="accent">가입</span>해보세요!
          </h1>
        </div>

        {/* 검색창 */}
        <div className="search-bar">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search Study Rooms..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* 초대 코드 입력 */}
        <div className="invite-bar">
          <span className="invite-icon">🔗</span>
          <input
            type="text"
            placeholder="Enter Invite Code/URL"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
          />
          <button className="join-directly-btn">JOIN DIRECTLY</button>
        </div>

        {/* 룸 카드 그리드 */}
        <div className="rooms-grid">
          {filteredRooms.map(room => (
            <RoomCard key={room.id} room={room} onJoin={onEnterRoom} />
          ))}

          {/* 방 만들기 카드 */}
          <div className="room-card create-card" onClick={onAddClick}>
            <div className="create-plus">+</div>
            <p className="create-label">CREATE ROOM</p>
            <p className="create-sub">START A NEW STUDY SESSION</p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ExploreRooms;
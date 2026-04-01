import React, { useState } from 'react';
import CreateRoomModal from '../components/CreateRoomModal';
import ChatLayout from '../components/ChatLayout';
import ExploreRooms from '../components/ExploreRooms';

function App() {
  // 'home' = ExploreRooms 화면 | 'chat' = ChatLayout 화면
  const [activeView, setActiveView] = useState('home');
  const [isModalOpen, setIsModalOpen] = useState(false);
 
  return (
    <div className="App">
      {activeView === 'home' ? (
        <ExploreRooms
          onEnterRoom={() => setActiveView('chat')}  // 🟢 서버 아이콘 클릭 → 채팅화면
          onAddClick={() => setIsModalOpen(true)}     // + 버튼 → 모달
        />
      ) : (
        <ChatLayout
          onHomeClick={() => setActiveView('home')}  // 🏠 홈 아이콘 클릭 → 홈화면
          onAddClick={() => setIsModalOpen(true)}     // + 버튼 → 모달
        />
      )}
 
      {isModalOpen && (
        <CreateRoomModal onClose={() => setIsModalOpen(false)} />
      )}
    </div>
  );
}
 
export default App;
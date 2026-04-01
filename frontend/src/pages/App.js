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
import { Routes, Route, Navigate } from 'react-router-dom';
import logo from '../assets/logo.svg';
import './App.css';
import Onboarding from '../components/Onboarding/Onboarding';
import Login from '../components/Auth/Login';
import Register from '../components/Auth/Register';

function Home() {
  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>Edit <code>src/pages/App.js</code> and save to reload.</p>
        <a className="App-link" href="https://reactjs.org" target="_blank" rel="noopener noreferrer">
          Learn React
        </a>
      </header>
    </div>
  );
}

function App() {
  const [isLoggedIn] = useState(false);

  return (
    <Routes>
      <Route path="/" element={isLoggedIn ? <Home /> : <Navigate to="/onboarding" replace />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
    </Routes>
  );
}

export default App;

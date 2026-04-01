// ChatLayout.js
import React, { useState } from 'react';
import './ChatLayout.css';

const CHANNELS = [
  { id: 'general-chat',     label: 'general-chat',    topic: 'Main hub for collective cognition' },
  { id: 'shared-resources', label: 'shared-resources', topic: 'Share files, links, and resources' },
];

const ChatLayout = ({ onAddClick, onHomeClick }) => {
  const [activeChannel, setActiveChannel] = useState('general-chat');
  const [activeHubTab, setActiveHubTab] = useState('Files');

  return (
    <div className="chat-container">

      {/* 극좌측 서버 네비 */}
      <nav className="server-nav">
        <div className="server-icon home-icon" onClick={onHomeClick} title="홈으로"><span>🏠</span></div>
        <div className="server-separator"></div>
        <div className="server-icon dummy-bg-1 active-server"></div>
        <div className="server-icon dummy-bg-2"></div>
        <div className="server-icon add-btn" onClick={onAddClick}>+</div>
        <div className="spacer"></div>
      </nav>

      {/* 좌측: 채널 목록 + 멤버 목록 + 하단 내 프로필 */}
      <aside className="sidebar-left">
        <h2 className="logo">STUDYSUBSTRATUM</h2>
        <div className="channel-list">
          {CHANNELS.map(ch => (
            <div
              key={ch.id}
              className={"channel" + (activeChannel === ch.id ? " active" : "")}
              onClick={() => setActiveChannel(ch.id)}
            >
              <span className="hash">#</span> {ch.label}
            </div>
          ))}
        </div>
        <div className="spacer" />

        {/* 멤버 목록 */}
        <div className="member-panel">
          <div className="member-panel-header">MEMBERS</div>
          <div className="member-list">
            <div className="member-category">ONLINE — 4</div>
            <div className="member online">
              <div className="avatar-wrapper"><div className="avatar">SM</div><div className="status-dot"></div></div>
              <span className="name green-text">StudyMaster_24</span>
            </div>
            <div className="member online">
              <div className="avatar-wrapper"><div className="avatar">A</div><div className="status-dot"></div></div>
              <span className="name">Aiden</span>
            </div>
            <div className="member online">
              <div className="avatar-wrapper"><div className="avatar">S</div><div className="status-dot"></div></div>
              <span className="name">Sarah M.</span>
            </div>
            <div className="member online">
              <div className="avatar-wrapper"><div className="avatar bg-ai">AI</div><div className="status-dot"></div></div>
              <span className="name">SAGE AI <span className="bot-tag">BOT</span></span>
            </div>
            <div className="member-category mt-20">OFFLINE — 2</div>
            <div className="member offline">
              <div className="avatar-wrapper"><div className="avatar dummy-offline"></div></div>
              <span className="name">Marcus_K</span>
            </div>
            <div className="member offline">
              <div className="avatar-wrapper"><div className="avatar dummy-offline"></div></div>
              <span className="name">JennyLee</span>
            </div>
          </div>
        </div>

        {/* 하단 내 프로필 */}
        <div className="my-profile">
          <div className="avatar my-avatar">SM</div>
          <div className="my-info">
            <span className="my-name">StudyMaster_24</span>
            <span className="my-status">Online</span>
          </div>
          <button className="my-settings" title="설정">⚙️</button>
        </div>
      </aside>

      {/* 중앙 채팅창 */}
      <main className="chat-main">
        <header className="chat-header">
          <h3><span className="hash">#</span> {CHANNELS.find(c => c.id === activeChannel)?.label}</h3>
          <p className="topic">{CHANNELS.find(c => c.id === activeChannel)?.topic}</p>
        </header>

        <div className="chat-messages">
          {activeChannel === 'general-chat' && (<>
            <div className="message-dummy">
              <div className="avatar">A</div>
              <div className="message-content">
                <span className="author">Aiden</span>
                <p>Has anyone finished the summary for Chapter 8? I'm struggling with the conceptual links between neural networks and biological synapses for the midterm.</p>
              </div>
            </div>
            <div className="message-dummy">
              <div className="avatar">S</div>
              <div className="message-content">
                <span className="author">Sarah M.</span>
                <p>I've just finished the study guide PDF. Here it is!</p>
                <div className="file-attachment">
                  <span className="file-icon">📄</span>
                  <div className="file-info">
                    <span className="file-name">Bio_Neural_Networks_Ch8.pdf</span>
                    <span className="file-meta">1.2 MB · PDF DOCUMENT</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="ai-summary-box">
              <div className="ai-summary-header">
                <span className="ai-icon">🤖</span>
                <span className="ai-label">SAGE AI</span>
                <span className="ai-tag">File Summary</span>
              </div>
              <div className="ai-summary-content">
                <p className="ai-summary-title">Key points from the document:</p>
                <ul className="ai-summary-list">
                  <li><strong>Neural Network basics:</strong> Foundational architecture and layer functions.</li>
                  <li><strong>Synaptic density:</strong> Correlation between learning rate and physical connections.</li>
                  <li><strong>Hebbian theory:</strong> Detailed breakdown of "Neurons that fire together, wire together".</li>
                </ul>
              </div>
            </div>
            <div className="message-mine">
              <div className="message-content mine-content">
                <span className="author mine-author">StudyMaster_24</span>
                <p>Thanks for the summary, SAGE! This really helps with the exam prep.</p>
              </div>
              <div className="avatar">SM</div>
            </div>
          </>)}

          {activeChannel === 'shared-resources' && (<>
            <div className="message-dummy">
              <div className="avatar">AC</div>
              <div className="message-content">
                <span className="author">AlexChen</span>
                <div className="file-attachment">
                  <span className="file-icon">📄</span>
                  <div className="file-info">
                    <span className="file-name">Algorithms_Cheat_Sheet_v2.pdf</span>
                    <span className="file-meta">1.4 MB · PDF DOCUMENT</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="ai-summary-box">
              <div className="ai-summary-header">
                <span className="ai-icon">🤖</span>
                <span className="ai-label">SAGE AI</span>
                <span className="ai-tag">File Summary</span>
              </div>
              <div className="ai-summary-content">
                <p className="ai-summary-title">Key highlights:</p>
                <ul className="ai-summary-list">
                  <li><strong>Time Complexity:</strong> Detailed breakdown of Big O for major sorting algorithms.</li>
                  <li><strong>Graph Theory:</strong> Refresher on BFS vs DFS implementation patterns.</li>
                </ul>
              </div>
            </div>
            <div className="message-dummy">
              <div className="avatar">SL</div>
              <div className="message-content">
                <span className="author">Sarah_Labs</span>
                <div className="file-attachment link-attachment">
                  <span className="file-icon">🔗</span>
                  <div className="file-info">
                    <span className="file-name">MIT 6.006 Lecture Notes - Fall 2023</span>
                    <span className="file-meta">ocw.mit.edu/courses/electrical-engineering...</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="ai-summary-box">
              <div className="ai-summary-header">
                <span className="ai-icon">🤖</span>
                <span className="ai-label">SAGE AI</span>
                <span className="ai-tag">Link Summary</span>
              </div>
              <div className="ai-summary-content">
                <p className="ai-summary-title">Resource Overview:</p>
                <ul className="ai-summary-list">
                  <li>External notes covering dynamic programming and hash table optimization.</li>
                  <li>Recommended for week 8 exam prep.</li>
                </ul>
              </div>
            </div>
          </>)}
        </div>

        <div className="chat-input-area">
          <input type="text" placeholder={"Message #" + (CHANNELS.find(c => c.id === activeChannel)?.label)} />
        </div>
      </main>

      {/* 우측: Resource Hub */}
      <aside className="sidebar-right">
        <div className="resource-hub">

          {/* 탭 헤더 */}
          <div className="hub-header">
            <h3 className="hub-title">RESOURCE HUB</h3>
            <div className="hub-tabs">
              {['Files', 'Links', 'Pins', 'Meeting'].map(tab => (
                <button
                  key={tab}
                  className={"hub-tab" + (activeHubTab === tab ? " active" : "")}
                  onClick={() => setActiveHubTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* ── Files 탭 ── */}
          {activeHubTab === 'Files' && (
            <div className="hub-section">
              <p className="hub-section-label">RECENT FILES</p>
              <div className="hub-file-list">
                <div className="hub-file-item">
                  <div className="hub-file-icon docx">📝</div>
                  <div className="hub-file-info">
                    <span className="hub-file-name">Final_Exam_Prep_v2.docx</span>
                    <span className="hub-file-meta">Uploaded by Aiden</span>
                  </div>
                </div>
                <div className="hub-file-item">
                  <div className="hub-file-icon pdf">📄</div>
                  <div className="hub-file-info">
                    <span className="hub-file-name">Spherical_Coordinates_Diagra...</span>
                    <span className="hub-file-meta">Uploaded 5h ago by Sarah M.</span>
                  </div>
                </div>
                <div className="hub-file-item">
                  <div className="hub-file-icon pdf">📄</div>
                  <div className="hub-file-info">
                    <span className="hub-file-name">Stokes_Theorem_Notes.pdf</span>
                    <span className="hub-file-meta">Uploaded 12:45 AM</span>
                  </div>
                </div>
                <div className="hub-file-item">
                  <div className="hub-file-icon csv">📊</div>
                  <div className="hub-file-info">
                    <span className="hub-file-name">Grade_Distribution_Calc3.csv</span>
                    <span className="hub-file-meta">Uploaded yesterday</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Links 탭 ── */}
          {activeHubTab === 'Links' && (
            <div className="hub-section">
              <p className="hub-section-label">SHARED LINKS</p>
              <div className="hub-file-list">
                <div className="hub-file-item">
                  <div className="hub-file-icon" style={{backgroundColor:'#1a2a3a'}}>🔗</div>
                  <div className="hub-file-info">
                    <span className="hub-file-name">MIT 6.006 Lecture Notes</span>
                    <span className="hub-file-meta">ocw.mit.edu · Sarah_Labs</span>
                  </div>
                </div>
                <div className="hub-file-item">
                  <div className="hub-file-icon" style={{backgroundColor:'#1a2a3a'}}>🔗</div>
                  <div className="hub-file-info">
                    <span className="hub-file-name">LeetCode Problem Set #34</span>
                    <span className="hub-file-meta">leetcode.com · AlexChen</span>
                  </div>
                </div>
                <div className="hub-file-item">
                  <div className="hub-file-icon" style={{backgroundColor:'#1a2a3a'}}>🔗</div>
                  <div className="hub-file-info">
                    <span className="hub-file-name">Khan Academy - Linear Algebra</span>
                    <span className="hub-file-meta">khanacademy.org · Aiden</span>
                  </div>
                </div>
                <div className="hub-file-item">
                  <div className="hub-file-icon" style={{backgroundColor:'#1a2a3a'}}>🔗</div>
                  <div className="hub-file-info">
                    <span className="hub-file-name">CS50 Week 5 Notes</span>
                    <span className="hub-file-meta">cs50.harvard.edu · Sarah M.</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Pins 탭 ── */}
          {activeHubTab === 'Pins' && (
            <div className="hub-section">
              <p className="hub-section-label">PINNED MESSAGES</p>
              <div className="hub-file-list">
                <div className="hub-pin-item">
                  <div className="hub-pin-author">
                    <div className="avatar" style={{width:20,minWidth:20,height:20,minHeight:20,fontSize:9}}>A</div>
                    <span>Aiden</span>
                    <span className="hub-pin-time">Yesterday 3:22 PM</span>
                  </div>
                  <p className="hub-pin-text">Reminder: midterm covers chapters 6–9. Focus on Hebbian theory and backpropagation.</p>
                </div>
                <div className="hub-pin-item">
                  <div className="hub-pin-author">
                    <div className="avatar" style={{width:20,minWidth:20,height:20,minHeight:20,fontSize:9}}>S</div>
                    <span>Sarah M.</span>
                    <span className="hub-pin-time">Mon 11:05 AM</span>
                  </div>
                  <p className="hub-pin-text">Study session every Tuesday 8PM — join the lounge 10 mins early to set up!</p>
                </div>
                <div className="hub-pin-item">
                  <div className="hub-pin-author">
                    <div className="avatar" style={{width:20,minWidth:20,height:20,minHeight:20,fontSize:9,backgroundColor:'#14532d',color:'#00ff66'}}>AI</div>
                    <span style={{color:'#00ff66'}}>SAGE AI</span>
                    <span className="hub-pin-time">Sun 9:00 AM</span>
                  </div>
                  <p className="hub-pin-text">Weekly summary posted in shared-resources. Key topics: sorting algorithms, graph traversal, dynamic programming.</p>
                </div>
              </div>
            </div>
          )}

          {/* ── Meeting 탭 ── */}
          {activeHubTab === 'Meeting' && (
            <div className="hub-section">
              <p className="hub-section-label">UPCOMING MEETINGS</p>
              <div className="hub-meeting">
                <div className="hub-meeting-label"><span className="meeting-dot">●</span> LIVE NOW</div>
                <p className="hub-meeting-title">Weekly Review Session</p>
                <p className="hub-meeting-sub">Started 5 minutes ago · 6 students joined</p>
                <button className="hub-meeting-btn">Join Lounge</button>
              </div>
              <div className="hub-meeting" style={{background:'linear-gradient(135deg,#1a1a2e,#16213e)', borderColor:'rgba(100,100,255,0.2)', marginTop: 10}}>
                <div className="hub-meeting-label" style={{color:'#818cf8'}}>📅 SCHEDULED</div>
                <p className="hub-meeting-title">Algorithm Deep Dive</p>
                <p className="hub-meeting-sub" style={{color:'#a5b4fc'}}>Tomorrow 7:00 PM · 3 students RSVP'd</p>
                <button className="hub-meeting-btn" style={{backgroundColor:'#818cf8', color:'#fff'}}>RSVP</button>
              </div>
            </div>
          )}

        </div>
      </aside>

    </div>
  );
};

export default ChatLayout;
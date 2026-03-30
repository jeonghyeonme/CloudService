import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import './Onboarding.css';

const slides = [
  {
    id: 1,
    badge: 'MODULE 01',
    title: (
      <>
        학습 몰입도를 극대화하는<br />
        <span className="text-highlight">서버리스 AI 메신저</span>
      </>
    ),
    description: '대화와 자료가 섞이지 않는 완벽한 스터디 공간을 경험하세요. SmartStudy는 당신의 집중력을 위해 설계되었습니다.',
    buttonText: '시작하기',
  },
  {
    id: 2,
    badge: 'MODULE 02',
    title: (
      <>
        실시간으로 동기화되는<br />
        <span className="text-highlight">스마트 협업 공간</span>
      </>
    ),
    description: '언제 어디서나 팀원들과 끊김 없이 소통하고 자료를 공유하세요. 효율적인 협업의 새로운 기준을 제시합니다.',
    buttonText: '시작하기',
  },
  {
    id: 3,
    badge: 'MODULE 03',
    title: (
      <>
        나만의 학습 패턴을 분석하는<br />
        <span className="text-highlight">맞춤형 AI 비서</span>
      </>
    ),
    description: 'AI가 당신의 학습 데이터를 분석하여 최적의 학습 경로를 추천합니다. 더 스마트하게 학습 목표를 달성하세요.',
    buttonText: '시작하기',
  }
];

const ArrowLeftIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const ArrowRightIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const DocumentIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

const ChartIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
  </svg>
);

const Onboarding = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const navigate = useNavigate();

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev === slides.length - 1 ? 0 : prev + 1));
  }, []);

  const prevSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev === 0 ? slides.length - 1 : prev - 1));
  }, []);

  useEffect(() => {
    const slideInterval = setInterval(nextSlide, 5000);
    return () => clearInterval(slideInterval);
  }, [nextSlide]);

  const handleManualNav = (direction) => {
    if (direction === 'next') nextSlide();
    if (direction === 'prev') prevSlide();
  };

  return (
    <div className="onboarding-container">
      {/* Navigation Bar */}
      <nav className="navbar">
        <div className="navbar-logo">
          {/* Logo placeholder if needed */}
        </div>
        <button className="signup-btn" onClick={() => navigate('/register')}>회원가입</button>
      </nav>

      {/* Main Slider Area */}
      <main className="slider-wrapper">
        <button className="nav-arrow left-arrow" onClick={() => handleManualNav('prev')} aria-label="Previous Slide">
          <ArrowLeftIcon />
        </button>

        <div className="slides-container">
          <div 
            className="slides-track" 
            style={{ transform: `translateX(-${currentSlide * 100}%)` }}
          >
            {slides.map((slide) => (
              <div className="slide" key={slide.id}>
                <div className="slide-content">
                  
                  {/* Left Side: Mock Graphic */}
                  <div className="slide-graphic">
                    <div className="graphic-backdrop"></div>
                    <div className="graphic-card">
                      <div className="code-lines">
                        <div className="line line-1"></div>
                        <div className="line line-2"></div>
                        <div className="line line-3"></div>
                        <div className="line line-4"></div>
                        <div className="line line-5"></div>
                      </div>
                    </div>
                    {/* Floating elements */}
                    <div className="floating-badge badge-top-right">
                      <DocumentIcon />
                    </div>
                    <div className="floating-badge badge-bottom-left">
                      <ChartIcon />
                    </div>
                    <div className="feature-pill feature-1">
                      <span className="sparkle">✨</span> AI 요약
                    </div>
                    <div className="feature-pill feature-2">
                      <span className="sync">🔄</span> 실시간 서버리스 동기화
                    </div>
                  </div>

                  {/* Right Side: Text Content */}
                  <div className="slide-text">
                    <span className="slide-badge">{slide.badge}</span>
                    <h1 className="slide-title">{slide.title}</h1>
                    <p className="slide-description">{slide.description}</p>
                    <button className="start-btn" onClick={() => navigate('/login')}>
                      {slide.buttonText} <ArrowRightIcon />
                    </button>
                  </div>
                  
                </div>
              </div>
            ))}
          </div>
        </div>

        <button className="nav-arrow right-arrow" onClick={() => handleManualNav('next')} aria-label="Next Slide">
          <ArrowRightIcon />
        </button>

        {/* Indicators */}
        <div className="slide-indicators">
          {slides.map((_, index) => (
            <button
              key={index}
              className={`indicator ${index === currentSlide ? 'active' : ''}`}
              onClick={() => setCurrentSlide(index)}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-content">
          <div className="footer-left">
            <h2 className="footer-logo">SmartStudy</h2>
            <p className="copyright">© 2024 SmartStudy. The Neon Brutalist Substratum.</p>
          </div>
          <div className="footer-right">
            {/* Nav items removed per requirement */}
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Onboarding;

# 🚀 Cloudservice 프로젝트 전수 조사 로드맵 (Final)

본 문서는 프로젝트의 모든 소스 코드를 파일 단위로 분석하여 기록하며, 시스템의 전체 구조와 세부 로직을 한눈에 파악하기 위해 작성되었습니다.

---

## 📁 전체 디렉토리 구조
```text
C:\Users\parad\Cloudservice\
├── .github/                # GitHub 관리 설정
│   ├── ISSUE_TEMPLATE/     # 이슈 리포트 및 제안 템플릿
│   └── workflows/          # GitHub Actions 배포 워크플로우
├── backend/                # 백엔드 서버 (AWS Lambda, Serverless)
│   ├── infra/              # 로컬 인프라 설정 (Docker, DynamoDB Seed)
│   └── src/                # 백엔드 핵심 소스 코드
│       ├── ai/             # AWS AI 서비스 연동 모듈
│       ├── auth/           # 사용자 인증 및 토큰 관리
│       ├── chat/           # WebSocket 통신 및 메시지 이력
│       ├── invites/        # 초대 시스템 모듈 (New)
│       ├── moderation/     # 서버 관리 및 중재 모듈 (New)
│       ├── resources/      # S3 파일 및 외부 링크 관리
│       ├── servers/        # 서버/채널/멤버십 관리 로직
│       └── utils/          # 공통 유틸리티 및 응답 설정
├── frontend/               # 프론트엔드 (React)
│   ├── public/             # 정적 자산 및 index.html
│   └── src/                # 프론트엔드 핵심 소스 코드
│       ├── assets/         # 로고 및 이미지 자산
│       ├── components/     # UI 컴포넌트 (기능별 분리)
│       │   ├── Auth/       # 로그인, 회원가입 UI
│       │   ├── Chat/       # 채팅 레이아웃 및 윈도우
│       │   │   ├── hooks/  # 채팅 전용 커스텀 훅 (WebSocket 등)
│       │   │   └── utils/  # 채팅 관련 헬퍼 함수
│       │   ├── common/     # 모달, 버튼 등 공통 컴포넌트
│       │   ├── layout/     # 서버 사이드바, 컨텍스트 메뉴
│       │   ├── NotFound/   # 404 페이지
│       │   ├── Onboarding/ # 랜딩 페이지
│       │   └── Servers/    # 서버 탐색, 생성 모달
│       ├── constants/      # 공통 상수 (경로, 엔드포인트)
│       ├── contexts/       # 전역 상태 관리 (Context API)
│       ├── data/           # 개발용 목 데이터 (mockData.js)
│       ├── lib/            # 서비스 라이브러리 (API 호출 및 유틸)
│       ├── pages/          # 앱 진입점 및 주요 스타일
│       └── styles/         # 전역 스타일 및 테마
└── ROADMAP.md              # 본 관리 문서
```

---

## 🔍 백엔드 소스 상세 분석 (`backend/src/`)

### 1. 루트 공통 모듈 (Core Modules)
| 파일명 | 상세 역할 및 핵심 로직 |
| :--- | :--- |
| **`config.js`** | 환경 변수(`process.env`) 통합 관리. `IS_OFFLINE` 기반 인프라 분기, **S3 URL 동적 생성**, 암호화 알고리즘(`HS256`) 및 솔트 설정 총괄. |
| **`dynamodbClient.js`** | AWS SDK v3 기반 `DynamoDBDocumentClient` 생성. 마샬링 자동화 및 **로컬 개발용 더미 자격 증명**(`test/test`) 주입 처리. |
| **`utils.js`** | `bcrypt` 비밀번호 관리, JWT(Access/Refresh) 발급 및 **논리적 삭제(`isRevoked`) 전략** 기반 리프레시 토큰 DB 처리 로직 완비. |

### 2. AI 분석 모듈 (`ai/`)
| 파일명 | 상세 역할 및 핵심 로직 |
| :--- | :--- |
| **`aiRouter.js`** | **멀티 모달 분석**: PDF(Textract + Bedrock Claude 3 한국어 요약), 이미지(Rekognition + Translate 번역). 분석 완료 시 **DB 기록 및 웹소켓 실시간 결과 전송**. |

### 3. 인증 관리 모듈 (`auth/`)
| 파일명 | 상세 역할 및 핵심 로직 |
| :--- | :--- |
| **`tokenRefresh.js`** | 헤더 내 리프레시 토큰 추출 및 `utils.js` 위임을 통한 유효성 검증 후 신규 Access Token 발급. |
| **`userLogin.js`** | **`email-index` GSI** 기반 유저 조회 및 비밀번호 대조를 통한 JWT 발급. 로그인 시 프로필 정보 동시 반환. |
| **`userLogout.js`** | 전달받은 리프레시 토큰의 DB 상태를 `isRevoked = true`로 변경하여 **기기별 논리적 세션 만료** 처리. |
| **`userRegister.js`** | 신규 유저 생성 전 **이메일 중복 체크** 수행. 비밀번호 해싱(`bcrypt`) 및 초기 토큰 세트 즉시 발급. |

### 4. 채팅 및 실시간 통신 모듈 (`chat/`)
| 파일명 | 상세 역할 및 핵심 로직 |
| :--- | :--- |
| **`chatHandler.js`** | **WebSocket 허브**: 연결 상태(`$connect/$disconnect`) 관리, 메시지 **수정/삭제(소프트 삭제)**, **AI 분석 시작 및 리소스 업데이트** 실시간 브로드캐스트 총괄. |
| **`getMessages.js`** | **이력 조회 엔진**: 서버별 메시지 시간순 쿼리. `keyword` 검색 시 **텍스트 타입 및 미삭제 메시지** 한정 필터링 로직 내장. |

### 5. 서버 및 채널 관리 모듈 (`servers/`)
| 파일명 | 상세 역할 및 핵심 로직 |
| :--- | :--- |
| **`addChannel.js`** | 특정 서버 내부에 신규 채널 정보를 리스트 형태로 추가. |
| **`createServer.js`** | 신규 서버 생성. 방장(HOST) 정보 **이중 기록(`Servers` & `ServerMembers`)** 및 초기 '일반' 채널 자동 생성 로직 포함. |
| **`deleteChannel.js`** | 채널 삭제. 단, `isDefault` 속성이 있는 기본 채널은 삭제 방지. |
| **`deleteServer.js`** | 서버 정보 및 관련 채널/데이터를 DB에서 영구 삭제. |
| **`getMyServers.js`** | 로그인한 유저가 참여 중인 모든 서버 목록을 `BatchGet`으로 일괄 조회. |
| **`getServerDetail.js`** | 특정 서버의 상세 정보, 참여자 수, 채널 리스트 등을 단일 조회. |
| **`getServers.js`** | 탐색 페이지용 전체 공개 서버 목록 제공. GSI를 통한 페이징 지원. |
| **`joinServer.js`** | 서버 참여 프로세스. **비밀번호/정원 초과/영구 차단 여부** 삼중 검증 후 멤버십 등록 및 참여자 수 업데이트. |
| **`leaveServer.js`** | 참여 중인 서버에서 퇴장 처리. 멤버십 데이터 삭제 및 서버 정원 수 업데이트. |
| **`serverAccess.js`** | **권한 제어(RBAC) 엔진**: 가중치 기반 Role 검증(`requireServerRole`) 및 차단/관리 가능 여부 판단 유틸 제공. |
| **`updateChannel.js`** | 기존 채널의 이름이나 설명 정보를 수정. |
| **`updateServer.js`** | 서버 이름, 설명, 규칙, 공개 여부 등 서버 메타데이터 업데이트. |
### 6. 리소스 허브 모듈 (`resources/`)
| 파일명 | 상세 역할 및 핵심 로직 |
| :--- | :--- |
| **`getUploadUrl.js`** | S3 보안 업로드. **화이트리스트(50+ 확장자)** 검증 및 5분 만료 **Pre-signed URL** 발급. |
| **`saveFileMetadata.js`** | 파일 관리. **S3 파일 존재 여부(`Head`) 최종 검증** 후 DB 기록. 권한 기반 삭제 및 S3 연동 삭제 지원. |
| **`saveLink.js`** | 외부 링크 관리. **Open Graph 미리보기 자동 추출** 연동 및 링크 정보 저장/수정/삭제 로직 총괄. |
| **`linkPreview.js`** | **보안 미리보기 엔진**: **SSRF 방지(DNS/Private IP 검사)** 및 Cheerio 기반 OG 태그 스크래핑 로직 내장. |
### 7. 초대 시스템 모듈 (`invites/`)
| 파일명 | 상세 역할 및 핵심 로직 |
| :--- | :--- |
| **`createInvite.js`** | 초대 코드 생성. **최대 8회 재시도**를 통한 코드 고유성 보장 및 만료 시간(TTL)/최대 사용 횟수 설정. |
| **`deleteInvite.js`** | 생성된 초대 코드를 수동으로 삭제하여 즉시 무효화. |
| **`inviteUtils.js`** | **검증 엔진**: 오인식 방지 문자열 기반 코드 생성 및 만료/취소/사용량 통합 유효성 검사 유틸 제공. |
| **`joinByInvite.js`** | **원자적 가입 처리**: 멤버십 등록 + 서버 정보 갱신 + 초대 코드 카운트를 **트랜잭션(`TransactWrite`)**으로 묶어 데이터 정합성 보장. |
| **`listInvites.js`** | 특정 서버에서 활성화된 모든 초대 코드 목록 및 상태 조회. |
| **`resetInvites.js`** | 보안 사고 대응 등을 위해 특정 서버의 모든 초대 코드를 일괄 초기화. |
| **`validateInvite.js`** | 초대 코드 유효성 검증 및 가입 전 **서버 미리보기 데이터(이름, 인원, 설명 등)** 통합 반환. |

### 8. 서버 관리 및 중재 모듈 (`moderation/`)
| 파일명 | 상세 역할 및 핵심 로직 |
| :--- | :--- |
| **`banMember.js`** | **영구 차단**: 멤버십 삭제 및 서버 내 `bannedMembers` 영구 등록. **방장/본인 차단 방지** 예외 로직 포함. |
| **`kickMember.js`** | **강제 퇴장**: 특정 멤버의 서버 멤버십 삭제 및 인원수 차감. (차단과 달리 재입장 가능) |
| **`listMembers.js`** | 서버 관리자용 전체 멤버 리스트 조회. Role 및 가입일자 포함. |
| **`transferOwnership.js`** | **소유권 위임**: 서버 소유권(Owner) 교체. **기존 방장은 중재자(MODERATOR)로 자동 전환**되는 안전 위임 로직. |
| **`unbanMember.js`** | 차단된 유저의 정보를 삭제하여 다시 서버에 가입할 수 있도록 허용. |
| **`updateMemberRole.js`** | **권한 관리**: 멤버를 `MODERATOR`로 승격 또는 강등. **계층적 RBAC** 정책에 따른 권한 검증 수행. |

---

## 🔍 프론트엔드 소스 상세 분석 (`frontend/src/`)

### 1. 기초 설정 및 상수 (`src/`, `constants/`)
| 파일명 | 상세 역할 및 핵심 로직 |
| :--- | :--- |
| **`index.js`** | 앱 진입점. `BrowserRouter` 라우팅 환경 구축 및 `StrictMode` 기반 안정성 확보. |
| **`pages/App.js`** | **중앙 가드 및 라우터**: `ProtectedRoute` 기반 미인증 접근 차단, 로그아웃 시 **서버 상태 초기화 및 토큰 폐기 API** 연쇄 실행. |
| **`constants/endpoint.js`** | **환경별 주소 동적 설정**: API 및 WebSocket(`API_WS_URL`) 주소 정의 및 엔드포인트 객체화 관리. |
| **`constants/path.js`** | 앱 내 이동 경로(`PATHS`) 관리 및 **서버별 동적 상세 경로 생성 유틸** 제공. |

### 2. API 통신 및 서비스 라이브러리 (`lib/`)
| 파일명 | 상세 역할 및 핵심 로직 |
| :--- | :--- |
| **`request.js`** | **지능형 API 클라이언트**: `localStorage` 토큰 자동 주입, 백엔드 에러 키(`detail`/`message`) 통합 파싱 및 네트워크 예외 처리. |
| **`auth.js`** | 인증 인터페이스. 회원가입/로그인 및 **리프레시 토큰 기반** 세션 연장/종료(Logout) API 연동. |
| **`servers.js`** | 서버 중심 도메인 서비스. 서버 상세 조회, 멤버십 관리, **RESTful 채널 CRUD** 로직 완비. |
| **`resources.js`** | **업로드 파이프라인**: [Pre-signed URL 발급 → S3 직접 PUT → 메타데이터 저장] 연쇄 로직 캡슐화. |
| **`serverEntity.js`** | **UI 데이터 어댑터**: 다양한 서버 데이터 구조를 일관된 형식(`serverId`, `serverName`)으로 정규화(Normalize). |
| **`reportWebVitals.js`** | 앱의 성능 지표(LCP, FID, CLS 등)를 측정하여 분석 도구로 전송하는 유틸리티. |

### 3. 전역 상태 관리 (`contexts/`)
| 파일명 | 상세 역할 및 핵심 로직 |
| :--- | :--- |
| **`AuthContext.js`** | 인증 상태 허브. 로그인 세션 유지, **JWT Payload 수동 디코딩**을 통한 유저 정보 복원 및 토큰 갱신 관리. |
| **`ServerContext.js`** | 서버 데이터 엔진. 참여 서버 목록 자동 조회, **`upsert` 기반 실시간 목록 동기화** 및 활성 서버 ID 관리. |

### 4. 주요 레이아웃 및 공통 컴포넌트 (`components/layout/`, `common/`)
| 파일명 | 상세 역할 및 핵심 로직 |
| :--- | :--- |
| **`layout/SharedLayout.js`** | 상단 네비바를 포함한 공통 뼈대. 페이지 위치에 따라 로그인/회원가입 버튼 노출 제어. |
| **`layout/ServerSidebar.js`** | 좌측 서버 아이콘 목록. 서버 이동, 우클릭 메뉴 트리거, 하단 프로필 팝업 관리. |
| **`layout/ServerContextMenu.js`** | 서버 우클릭 메뉴. 호스트 여부에 따라 '서버 설정/삭제' 또는 '서버 나가기' 기능 제공. |
| **`common/FormModal.js`** | 모든 입력 타입(텍스트, 파일, 토글 등)을 지원하는 범용 폼 모달. 동적 필드 노출(`showIf`) 지원. |

### 5. 핵심 기능 페이지 컴포넌트 (`components/Chat/`, `Servers/`)
| 파일명 | 상세 역할 및 핵심 로직 |
| :--- | :--- |
| **`Chat/ChatLayout.js`** | **이벤트 오케스트레이터**: WebSocket 통합 관리 및 메시지/리소스/멤버 상태 이벤트를 하위 컴포넌트로 분배. |
| **`Chat/SidebarLeft.js`** | 서버 내부 사이드바. 채널 리스트 및 참여자를 온라인/오프라인으로 자동 분류하여 표시. |
| **`Chat/ChatWindow.js`** | **지능형 메시징 엔진**: **낙관적 업데이트(Optimistic UI)** 적용, AI 분석 상태(Pending/Failed) 임시 메시지 처리. |
| **`Chat/ResourceHub.js`** | **리소스 컨트롤러**: S3 업로드 연동 및 **`requestId` 기반 AI 분석 트리거**. 리소스 변경 사항 실시간 브로드캐스트. |
| **`Chat/hooks/useWebSocket.js`** | **연결 라이프사이클**: **지수 백오프 재연결 로직**, 탭 복귀 자동 연결 점검 및 `joinServer` 자동 발신 인터페이스. |
| **`Servers/ExploreServers.js`** | **서버 디스커버리**: 공개 서버 검색 및 **비공개 서버 입장 전용 모달(비밀번호 검증)** 연동 프로세스 구현. |
| **`Servers/CreateServerModal.js`** | 서버 생성 전용 모달. 규칙 입력 텍스트를 줄바꿈 기준으로 파싱하여 아이콘 자동 부여. |

### 6. 인증 및 온보딩 (`components/Auth/`, `Onboarding/`, `pages/`)
| 파일명 | 상세 역할 및 핵심 로직 |
| :--- | :--- |
| **`Auth/Login/Register.js`** | 로그인 및 회원가입 페이지. 폼 입력값 검증 및 인증 성공 후 페이지 이동 로직. |
| **`Onboarding/Onboarding.js`** | 서비스 소개 랜딩 페이지. 인터랙티브 슬라이더를 통한 주요 기능(AI, 협업) 홍보. |
| **`pages/App.js`** | **중앙 라우터 및 가드**: `ProtectedRoute`를 통한 미인증 접근 차단 및 전체 Context 제공자 설정. |

### 7. 스타일 및 목 데이터 (`styles/`, `data/`)
| 파일명 | 상세 역할 및 핵심 로직 |
| :--- | :--- |
| **`styles/theme.css`** | 다크모드 기반의 전역 테마 정의. 색상, 간격, 둥글기 등 디자인 시스템 CSS 변수 관리. |
| **`data/mockData.js`** | 개발 및 테스트용 정적 데이터. 서버, 채널, 다양한 타입의 메시지 샘플 포함. |

---

## 📅 향후 작업 가이드라인 (Developer Action Items)

### 1. AI 분석 품질 및 안정성 (AI Analysis & Sync)
- **Backend**:
    - **한글 깨짐 이슈 수정**: Textract의 한국어 미지원 문제를 해결하기 위해 Bedrock Claude 3 멀티모달 직접 호출 또는 Rekognition 기반 로직으로 전환.
    - **중복 요청 방지**: 동일 리소스에 대한 중복 분석 요청을 서버 단에서 차단(Idempotency).
    - **채팅-리소스 DB 동기화**: 채팅창(`sendMessage`)을 통해 업로드된 파일/링크의 메타데이터가 서버의 '파일/링크 목록' DB에도 자동으로 등록되도록 후처리 로직 구현.

### 2. 실시간 소통 및 채팅 UX (Real-time & Chat UX)
- **Backend**:
    - **입력 상태 알림**: WebSocket 핸들러에 `typing` 액션을 추가하여 특정 유저가 입력 중임을 서버 단위로 브로드캐스트.
- **Frontend**:
    - **입력 중 표시 UI**: 서버에서 받은 타이핑 이벤트를 기반으로 채팅창 하단에 "OOO님이 입력 중..." 애니메이션 노출.
    - **검색 결과 스크롤 이동**: 메시지 검색 결과 클릭 시, 해당 메시지가 위치한 시점으로 자동 스크롤 및 포커스(하이라이트) 처리.

### 3. 유저 프로필 및 개인화 (User Profile)
- **Backend**:
    - **프로필 관리 API**: 닉네임 수정 및 프로필 이미지 S3 업로드/변경 처리를 위한 API 구현.
- **Frontend**:
    - **프로필 수정 모달**: 내 정보 확인 및 수정 기능을 담은 UI 컴포넌트 및 전역 상태 동기화.

### 4. 프로젝트 운영 및 인프라 (DevOps & Mobile)
- **Backend/DevOps**:
    - **배포 자동화 고도화**: CloudFront 캐시 무효화 자동화 및 환경 변수 관리 최적화.
- **Frontend**:
    - **반응형 드로어 시스템**: 태블릿 및 모바일 환경을 위한 사이드바 레이아웃 대응 및 UI 최적화.

---
*마지막 업데이트: 2026-05-26*

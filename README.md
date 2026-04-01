# 🚀 스마트 스터디 메신저 (Smart Study Messenger)

AWS 서버리스 아키텍처를 기반으로 하는 실시간 웹 메신저 프로젝트입니다. 스터디 그룹을 위한 효율적인 커뮤니케이션 및 자료 공유 기능을 제공하는 것을 목표로 합니다.
현재 **프론트엔드(React) 개발**이 우선적으로 진행되고 있으며, 추후 백엔드 및 클라우드 인프라가 연동될 예정입니다.

## 🎯 주요 기능 (Core Features)

CSV 기능 명세서 기반으로 크게 6가지 핵심 도메인으로 나뉘어 개발이 진행됩니다. 프론트엔드의 `src/features/` 디렉토리도 이 도메인 구조를 따릅니다.

1.  **💬 실시간 메신저:** WebSocket 기반 실시간 채팅, 과거 채팅 무한 스크롤, 접속자 목록 동기화
2.  **📁 자료 공유:** S3 다이렉트 업로드(진행률 표시), 채팅창 내 파일 링크 공유 및 즉시 열람
3.  **🤖 AI 분석:** 업로드된 문서 텍스트 추출/요약/퀴즈 생성(Bedrock, Textract), 이미지 객체 인식 및 태깅(Rekognition)
4.  **👤 회원 관리:** Cognito 기반 로그인/가입, 소셜 연동, JWT 토큰 관리 및 닉네임 설정
5.  **🏠 스터디룸 관리:** 스터디룸 개설 및 페이징 조회, 인원 제어(입장 제한, 실시간 인원 갱신)
6.  **⚙️ 공통/기반:** 통신 에러 핸들링, Toast 알림, 전역 로딩 UI, API 요청량 제한 방어

## 🛠️ 기술 스택 (Tech Stack)

우리 프로젝트는 **AWS 서버리스(Serverless) 아키텍처**를 기반으로 작동할 예정입니다. 무거운 서버 환경 대신 클라우드 네이티브 기술을 적극 활용합니다.

- **프론트엔드 (Frontend):** `React` (Amazon S3 정적 웹 호스팅 + CloudFront 배포 예정)
- **스타일링 (UI):** `Tailwind CSS` 등 디자인 컴포넌트 라이브러리
- **백엔드 (Backend) [예정]:** `Node.js` 또는 `Python` (AWS Lambda + API Gateway)
- **데이터베이스 (DB) [예정]:** `Amazon DynamoDB` (NoSQL)

---

## 🚀 시작하기 (Getting Started)

현재 프론트엔드 파트의 로컬 실행 방법입니다.

### 1. 환경 준비
*   [Node.js](https://nodejs.org/) (LTS 버전 권장)가 설치되어 있어야 합니다.

### 2. 프로젝트 클론 및 패키지 설치
```bash
# 저장소 클론
git clone <repository-url>

# 프론트엔드 디렉토리로 이동
cd frontend

# 의존성 패키지 설치
npm install
```

### 3. 환경 변수 설정
*   `frontend` 디렉토리 내에 `.env` 파일을 생성합니다. (`.env.example` 파일이 있다면 참고하여 복사)
*   *(현재는 초기 설정 단계이므로 필수로 요구되는 환경 변수는 없을 수 있습니다.)*

### 4. 로컬 서버 실행
```bash
# 개발 서버 실행 (기본 포트: 3000)
npm start
```
*   브라우저에서 `http://localhost:3000`으로 접속하여 프로젝트가 정상적으로 실행되는지 확인합니다.

---

## 📁 디렉토리 구조 (Frontend)

프론트엔드(`frontend/`) 디렉토리의 구조와 각 폴더의 역할은 다음과 같습니다.

```
frontend/
└── src/
    ├── assets/       # 이미지, 폰트 등 정적 에셋
    ├── components/   # 재사용 가능한 공통 UI 컴포넌트 (e.g., Button, Modal)
    │   └── layout/   # 페이지 레이아웃 관련 컴포넌트 (e.g., Header, Sidebar)
    ├── features/     # 기능별 비즈니스 로직 및 컴포넌트 (e.g., auth, chat)
    ├── hooks/        # 여러 기능에서 공통으로 사용하는 커스텀 훅
    ├── lib/          # API 클라이언트, 유틸리티 함수 등
    ├── pages/        # 최상위 페이지 단위 컴포넌트
    ├── providers/    # 전역 상태 관리(Context) 프로바이더
    └── styles/       # 전역 스타일 및 테마
```

- **`src/assets`**: 로고 이미지, 아이콘, 폰트 등 코드에서 직접 참조하는 정적 파일을 저장합니다.
- **`src/components`**: 특정 기능에 종속되지 않는, 프로젝트 전반에서 재사용되는 UI 컴포넌트와 레이아웃 컴포넌트를 관리합니다.
- **`src/features`**: 인증, 채팅, 파일 공유 등 각 기능(도메인)에 특화된 컴포넌트, 비즈니스 로직, 상태 관리를 모아둡니다.
- **`src/hooks`**: 여러 기능에서 공통으로 사용될 수 있는 커스텀 훅을 관리합니다.
- **`src/lib`**: 외부 API 연동 클라이언트, 날짜 포맷팅과 같은 순수 유틸리티 함수, 상수 값 등을 저장합니다.
- **`src/pages`**: 사용자가 브라우저에서 특정 경로로 접근했을 때 보게 되는 페이지 단위의 컴포넌트입니다.
- **`src/providers`**: React Context API 등을 사용하여 애플리케이션의 전역 상태를 관리합니다.
- **`src/styles`**: 전역 CSS 파일, 스타일 변수, 테마 설정 등을 관리합니다.

---

## 🛠️ 백엔드 로컬 개발 환경 세팅 가이드 (Local Setup)

우리 프로젝트는 AWS 클라우드 비용 방어와 빠른 로컬 테스트를 위해 **Docker + LocalStack** 조합을 사용합니다.

### 0. 필수 사전 준비 (Prerequisites)
* **[Node.js](https://nodejs.org/ko/)**: v18.x 이상 권장 (LTS 버전 설치)
* **[Docker Desktop](https://www.docker.com/products/docker-desktop/)**: 설치 후 반드시 프로그램을 **실행** 상태로 유지해 주세요.

### 1. 패키지 설치 및 셋업 (Backend)
프로젝트를 Clone 받은 후, 터미널에서 `backend` 폴더로 이동하여 패키지를 설치합니다.
```bash
cd backend
npm install
```

### 2. 가상 AWS 인프라 실행 (LocalStack)
터미널 경로가 backend 폴더인지 확인한 후, 가상 인프라(S3, DynamoDB, Cognito)를 백그라운드에서 실행합니다.
```bash
docker-compose up -d
```
* ✅ 실행 확인: 브라우저 주소창에 http://localhost:4566/_localstack/health 입력 시 JSON 데이터가 정상적으로 뜨면 인프라 구동 완료입니다.

### 3. 서버리스(Serverless) API 서버 구동
인프라가 준비되었다면 API 서버를 켭니다.
```bash
npx start
```
* 터미널에 POST | http://localhost:3000/dev/rooms 주소가 뜨면 서버가 정상적으로 실행된 것입니다.

### 4. 첫 API 통신 테스트 (Postman)
서버 구동 확인 후 포스트맨(또는 VS Code Thunder Client)을 통해 직접 API를 테스트합니다.
* **Method**: POST
* **URL**: `http://localhost:3000/dev/rooms`
* **Body** (raw -> JSON):
```bash
{
    "roomName": "테스트 스터디룸",
    "maxCapacity": 10
}
```
* 결과: "스터디룸이 성공적으로 생성되었습니다!" 응답이 오면 환경 세팅이 완벽하게 완료된 것입니다!


---

# 📌 프로젝트 그라운드 룰 (Ground Rules)

성공적인 프로젝트 수행과 원활한 협업을 위해 우리 팀이 반드시 지켜야 할 최소한의 규칙입니다.

## 🌳 1. Git 브랜치 전략 (Git Flow 기반)

안정적인 CI/CD 환경 구축을 위해 브랜치는 크게 3가지 구조로 나누어 관리합니다.

*   👑 **`main` (최종 배포용):** 실제 서비스 환경에 배포할 완성된 코드 (직접 Push ❌)
*   🛠️ **`dev` (통합 및 테스트용):** 각자 개발한 기능들을 병합하고 통합 테스트를 진행
*   🌿 **`feature/기능명` (개인 작업용):** 개별 기능 개발용 (예: `feature/login`)

**[🔄 작업 프로세스]**
`dev`에서 분기(branch) ➡️ 기능 개발 ➡️ `dev`로 PR ➡️ 코드 리뷰(승인) ➡️ `dev` Merge ➡️ (테스트 후) `main` Merge

## 📝 2. 커밋 메시지 컨벤션

*   `Feat:` 새로운 기능 추가 (예: `Feat: 소셜 로그인 UI 구현`)
*   `Fix:` 버그 수정
*   `Design:` CSS, UI 레이아웃 등 디자인 변경
*   `Refactor:` 기능 변화 없이 코드 구조나 성능을 개선
*   `Docs:` README, 기능 명세서 등 문서 수정
*   `Chore:` 패키지/라이브러리 설치, 환경 설정 파일 수정

## ☁️ 3. 클라우드 및 보안 공통 규칙 (추후 백엔드 연동 시 필수)

*   **🚫 API 키 하드코딩 금지:** `.env` 파일에 환경 변수로 분리하고 `.gitignore`에 등록 (GitHub 업로드 방지)
*   **🏷️ 리소스 네이밍 규칙:** `프로젝트명-환경-서비스-용도` (예: `studyhub-dev-s3-frontend`)
*   **📢 변경 사항 즉각 공유:** DB 테이블/API 스펙 변경 시 즉각 팀 내 공유하여 충돌 방지

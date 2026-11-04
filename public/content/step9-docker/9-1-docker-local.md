---
title: 'Dockerfile + docker-compose (로컬)'
week: 9
session: 1
awsServices: []
learningObjectives:
  - 백엔드(Spring) Dockerfile을 작성하고 이미지를 빌드할 수 있습니다.
  - 프론트엔드(Vue.js + Nginx) Dockerfile을 멀티스테이지로 작성할 수 있습니다.
  - Nginx 리버스 프록시를 설정하여 프론트/백엔드를 연동할 수 있습니다.
  - docker-compose로 프론트엔드 + 백엔드 + MySQL을 한번에 실행할 수 있습니다.
  - 환경변수(.env)로 DB 접속 정보를 분리할 수 있습니다.
prerequisites:
  - Docker 실행 환경 준비 (macOS: Homebrew + Colima / Windows: WSL2 + Docker Desktop)
  - 프론트엔드/백엔드 GitHub 리포지토리 준비 (Step 8 또는 샘플 코드)
  - 기본적인 터미널 사용법
estimatedCost: 무료 (로컬 실행)
---

프론트엔드(Vue.js)와 백엔드(Spring)를 각각 Docker 이미지로 만들고,  
docker-compose로 로컬에서 **프론트 + 백엔드 + DB**를 한번에 실행합니다.

### Step 9 전체 구성

| 세션                 | 주제                               | 핵심                                          |
| -------------------- | ---------------------------------- | --------------------------------------------- |
| 9-0                  | Docker + 컨테이너 이론             | 개념 학습                                     |
| **9-1 (이번 실습)**  | Dockerfile + docker-compose (로컬) | 프론트+백엔드+DB 로컬 풀스택 실행             |
| 9-2                  | ECR Push + EC2 docker-compose 배포 | 통합 인프라(EC2+RDS), VPC Endpoint, EC2 운영  |
| 9-3                  | AWS Fargate 서버리스 컨테이너 체험 | 9-2 이미지+RDS 재사용, Fargate 사이드카 체험  |
| 9-4                  | GitHub Actions → ECR → EC2         | Docker CI/CD 파이프라인 (멀티레포 & 모노레포) |
| 9-5                  | (선택) CloudFront + Fargate        | 프로덕션 분리 구성                            |
| 9-6                  | 리소스 정리                        | 전체 삭제                                     |

### 실습 흐름

```
[Docker 설치 확인] → [백엔드 Dockerfile] → [프론트 Dockerfile + nginx.conf] → [docker-compose.yml] → [로컬 실행 + 동작 확인]
```

### 최종 결과물

```
localhost:80  → Nginx (Vue.js 정적 파일 + /api 프록시)
                    ↓ /api/*
                backend:8080 (Spring)
                    ↓
                db:3306 (MySQL)
```

---

## 태스크 1: Docker 설치 확인

### 1-1. 운영체제별 Docker 설치

📍 **실행 위치: 로컬 PC**

> [!TIP]
> **설치 전, 내 PC에 이미 Docker가 설치되어 있는지 먼저 확인해보세요!**  
> 터미널(macOS/Linux) 또는 PowerShell(Windows)에서 아래 명령어를 실행했을 때 버전 정보가 출력된다면, 이미 설치된 상태이므로 **1-2. 설치 확인**으로 바로 건너뛰세요.
>
> ```bash
> docker --version
> docker-compose --version
> ```

Docker가 설치되어 있지 않다면 본인 운영체제에 맞는 방법을 선택해 설치합니다.

**🍎 macOS (Homebrew + Colima):**

> [!TIP]
> Homebrew가 설치되어 있어야 합니다.  
> 미설치 시: `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"`  
> 만약 맥에 이미 **Docker Desktop**이 설치되어 있다면 Colima를 추가로 설치할 필요 없이 Docker Desktop 앱만 실행하고 **1-2. 설치 확인**으로 이동하면 됩니다.

1. 터미널에서 Homebrew로 Docker CLI, `docker-compose`, `docker-buildx`(확장 빌더), Colima를 설치하고 플러그인을 연결합니다:

```bash
brew install docker docker-compose docker-buildx colima

# Docker CLI가 buildx 플러그인을 인식하도록 연결 (최초 1회)
mkdir -p ~/.docker/cli-plugins
ln -sfn $(brew --prefix)/opt/docker-buildx/bin/docker-buildx ~/.docker/cli-plugins/docker-buildx
```

> [!TIP]
> **docker-buildx는 왜 함께 설치하나요? (Windows는 별도 설치 불필요)**  
> - **Windows 및 Mac용 Docker Desktop**에는 `docker-buildx`가 기본 내장되어 있어 별도로 설치할 필요가 없습니다.  
> - 이번 **9-1 실습에서는 기본 `docker build` 명령어만 사용**하지만, macOS에서 Homebrew + Colima로 설치할 때 `docker-buildx`를 함께 연결해 두어야 `docker build` 실행 시 구버전 빌더 경고(DEPRECATED)가 뜨지 않고, 다음 **9-2(AWS 배포)**에서 크로스플랫폼 빌드를 바로 사용할 수 있습니다.

2. Colima를 시작합니다 (Docker 런타임 실행):

```bash
colima start
```

3. Docker가 정상적으로 동작하는지 확인합니다:

```bash
docker ps
```

> [!TIP]
> **Colima**는 가벼운 Linux 가상머신으로 Docker를 실행하여 Docker Desktop보다 메모리·배터리 소모가 훨씬 적고 개인/기업 모두 무료입니다.  
> 실습이 끝난 후 종료할 때는 `colima stop`, 다시 시작할 때는 `colima start`를 실행합니다.
>
> **macOS에서 GUI 환경(Docker Desktop)으로 설치하고 싶다면:**
> - [Docker Desktop for Mac](https://docs.docker.com/desktop/install/mac-install/) 페이지에서 본인 맥 칩에 맞는 버튼을 클릭하여 다운로드합니다.
>   - Apple Silicon (M1/M2/M3/M4): [[Docker Desktop for Mac with Apple silicon]]
>   - Intel: [[Docker Desktop for Mac with Intel chip]]
> - 다운로드된 `.dmg` 파일을 더블클릭하고, Docker 아이콘을 **Applications** 폴더로 드래그합니다.
> - **Applications**에서 **Docker**를 실행한 뒤, 상단 메뉴바에 고래 아이콘이 나타나면 설치 완료입니다 (Colima와 동시에 실행하지 마세요).

**🪟 Windows (WSL2 + Docker Desktop):**

> [!WARNING]
> **먼저 WSL2를 설치해야 합니다.**  
> Docker Desktop은 WSL2(Windows Subsystem for Linux 2) 위에서 동작합니다.  
> WSL2가 없으면 Docker Desktop 실행 시 daemon이 `stopped` 상태로 멈춥니다.

**① WSL2 설치 (Docker Desktop 설치 전 필수)**

1. **PowerShell을 관리자 권한으로** 실행합니다.
   - 시작 메뉴에서 `PowerShell` 검색 → 우클릭 → **관리자 권한으로 실행**
2. WSL2를 설치합니다:

```powershell
wsl --install
```

3. 설치가 끝나면 **PC를 재시작**합니다.
4. 재시작 후 Ubuntu 터미널 창이 자동으로 열리면, 사용할 리눅스 사용자 이름과 비밀번호를 입력합니다.
   - (창이 안 열려도 무방합니다. Docker Desktop이 WSL2 백엔드를 사용합니다.)
5. WSL2가 정상 설치되었는지 PowerShell에서 확인합니다:

```powershell
wsl --status
```

> [!OUTPUT]
>
> ```
> 기본 버전: 2
> ```

> [!TIP]
> `wsl --install`이 동작하지 않는 구버전 Windows라면, 아래 순서로 수동 설치합니다:  
> ① PowerShell(관리자): `dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart`  
> ② PowerShell(관리자): `dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart`  
> ③ 재부팅 후 [WSL2 Linux 커널 업데이트 패키지](https://wslstorestorage.blob.core.windows.net/wslblob/wsl_update_x64.msi) 설치  
> ④ PowerShell: `wsl --set-default-version 2`

**② Docker Desktop 설치**

6. [Docker Desktop for Windows](https://docs.docker.com/desktop/install/windows-install/) 페이지에서 [[Docker Desktop for Windows - x86_64]] 버튼을 클릭하여 다운로드합니다.
7. 다운로드된 `Docker Desktop Installer.exe`를 실행합니다.
8. Configuration 화면에서 기본값(**Use WSL 2 instead of Hyper-V** 체크)을 확인하고 [[OK]]를 클릭합니다.
9. 설치가 끝나면 [[Close and restart]]를 클릭하여 PC를 재시작합니다.
10. 재시작 후 Docker Desktop이 자동 실행됩니다.
11. 첫 실행 시 Docker Subscription Service Agreement 화면이 나타나면 [[Accept]]를 클릭합니다.
12. 다음 화면에서 로그인을 요구하면 건너뜁니다 — 우측 하단 [[Skip]] 또는 창을 닫습니다. (로그인 없이도 실습 가능합니다.)
13. Docker Desktop 창 좌측 하단 상태 표시가 **녹색 + `Engine running`**이 될 때까지 대기합니다.

> [!WARNING]
> Docker Desktop이 완전히 시작되기 전에 `docker` 명령어를 실행하면  
> `error during connect` 또는 `daemon is not running` 에러가 발생합니다.  
> 좌측 하단 상태가 녹색(`Engine running`)이 될 때까지 기다린 후 명령어를 실행하세요.

> [!TIP]
> **Windows Home** 에디션에서도 Docker Desktop 사용 가능합니다 (WSL2 기반).  
> Windows 10 버전 2004 이상 또는 Windows 11이 필요합니다.

**🐧 Linux (참고):**

- [Docker Engine 공식 설치 가이드](https://docs.docker.com/engine/install/) 참조
- Ubuntu 기준: `sudo apt update && sudo apt install -y docker.io docker-compose`
- 설치 후 현재 사용자에 권한 부여: `sudo usermod -aG docker $USER` (재로그인 필요)

### 1-2. 설치 확인

> [!NOTE]
> 위 설치 단계는 운영체제별 선택 사항입니다. 아래 확인 절차는 모든 OS 공통입니다.

1. 터미널(macOS/Linux) 또는 PowerShell(Windows)을 열고 Docker 버전을 확인합니다:

```bash
docker --version
```

2. `docker-compose` 버전도 확인합니다:

```bash
docker-compose --version
```

> [!OUTPUT]
>
> ```
> Docker version 27.x.x, build xxxxxxx
> Docker Compose version v2.x.x
> ```

> [!NOTE]
> `docker-compose`(하이픈 포함)와 `docker compose`(띄어쓰기)는 모두 Docker Compose v2를 실행합니다.  
> macOS(Colima + Homebrew)와 Windows(Docker Desktop) 모두에서 별도 설정 없이 동일하게 동작하도록, 이 실습에서는 **`docker-compose`(하이픈 포함)** 명령어로 통일하여 진행합니다.

3. Docker 컨테이너가 정상 실행되는지 테스트합니다:

```bash
docker run hello-world
```

> [!OUTPUT]
>
> ```
> Hello from Docker!
> This message shows that your installation appears to be working correctly.
> ```

> [!TROUBLESHOOTING]
> | 증상 | 원인 | 해결 방법 |
> |------|------|-----------|
> | `docker: command not found` | Docker 미설치 또는 PATH 미등록 | 설치 후 터미널(또는 PowerShell)을 닫고 다시 실행 |
> | `Cannot connect to the Docker daemon` | Docker 런타임 미실행 | macOS: `colima start` 실행 / Windows: Docker Desktop 앱 실행 후 좌측 하단 `Engine running` 확인 |
> | Windows에서 `WSL 2 is not installed` | WSL2 미설치 | PowerShell(관리자): `wsl --install` 실행 후 PC 재부팅 |
> | macOS에서 `permission denied` | Colima(또는 Docker Desktop) 미실행 | 터미널에서 `colima start`를 실행하여 런타임을 시작하세요 |

✅ **태스크 완료** — Docker가 정상 설치되었습니다.

---

## 태스크 2: 프로젝트 구조 및 설정 파일 준비

### 2-1. 작업 디렉토리 및 소스 코드 준비

📍 **실행 위치: 로컬 PC**

Step 9 실습에서는 아래 **3가지 방법** 중 본인 상황에 맞는 **한 가지**를 선택하여 프로젝트를 준비합니다:

| 방법 | 대상 수강생 | 백엔드 유형 |
| :--- | :--- | :---: |
| **🟢 방법 1: 기존 Step 8 로컬 폴더 활용** | Step 8을 이미 진행하여 로컬에 **3tier-project** 폴더가 있는 경우 (클론 불필요) | **WAR** (8-3A) 또는 **JAR** (8-3B·3C) |
| **🟡 방법 2: 샘플 압축 파일 활용** | Step 8을 안 했거나, Git 설정 없이 빠르게 Docker 실습을 시작할 경우 | **WAR** (Spring Legacy 기본 샘플) |
| **🔵 방법 3: 샘플 GitHub 리포지토리 클론** | Step 8을 안 했지만, Git으로 클론하여 **9-4(CI/CD)**까지 이어서 진행할 경우 | **WAR** (Spring Legacy 기본 샘플) |

> [!TIP]
> **Spring Boot(JAR) 환경으로 실습하고 싶다면?**
> - Step 9에서 기본 제공하는 샘플(압축 파일 및 샘플 리포지토리)은 **Spring Legacy MVC(WAR)** 기준입니다.
> - 만약 **Spring Boot(JAR)** 테스트 코드로 실습해보고 싶은데 아직 프로젝트가 없다면, [Step 8-2B: 새 Vue.js 프론트엔드](/week/8/session/2B)와 [Step 8-3C: 새 Spring Boot 백엔드](/week/8/session/3C)의 프로젝트 생성 단계를 먼저 진행한 뒤 **🟢 방법 1**로 이어가세요.
> - 본인이 직접 개발한 **자체 보유 프로젝트(Spring Boot/Legacy)**를 적용할 수도 있습니다 (아래 **2-4**의 자체 프로젝트 적용 포인트 참고).

> [!NOTE]
> **작업 디렉토리 및 폴더명 안내 (~/3tier-project)**
>
> - **기본 작업 경로**  
>   이 가이드에서는 Step 8과 동일하게 기본 작업 경로를 **~/3tier-project** (하위 폴더 **my-frontend**, **my-backend**)로 표기합니다.
> - **다른 경로 또는 자체 보유 프로젝트를 사용하는 경우**  
>   Step 8에서 다른 상위 폴더(예: **~/workspace**, **~/dev**)를 사용했거나 본인이 직접 만든 프로젝트의 폴더명이 다르다면(예: **frontend**, **backend** 등), 이후 안내되는 명령어와 **태스크 5의 docker-compose.yml**에서 본인의 실제 폴더 경로와 이름으로 바꾸어 진행하세요.

---

#### 🟢 방법 1: Step 8을 진행한 경우 (클론 불필요 — 기존 로컬 폴더 활용)

1. 기존 Step 8 작업 디렉토리로 이동하여 폴더 목록을 확인합니다:

```bash
cd ~/3tier-project
ls
```

- **my-frontend**, **my-backend** 폴더가 이미 존재하므로 새로 클론할 필요가 없습니다.

2. Step 8 프론트엔드 배포 실습에서 만들었던 `~/3tier-project/my-frontend/.env.production` 파일을 열어, 기존 ALB 주소 설정을 **주석 처리(`#`)**합니다:

```ini
# ~/3tier-project/my-frontend/.env.production

# 1) Step 8에서 설정했던 외부 ALB/CloudFront 주소는 앞에 #을 붙여 주석 처리합니다
# VITE_API_URL=http://<ALB_DNS_NAME>

# 2) [Step 8-2B (새 Vue.js 프로젝트) 진행자만 해당]
#    코드에서 /items 처럼 /api 없이 호출하는 경우에는 아래 한 줄의 주석(#)을 해제하여 /api만 붙여줍니다.
#    (Step 8-2A 기존 레거시 프로젝트는 코드에 이미 /api/board가 포함되어 있으므로 아래 줄도 주석 상태로 둡니다)
# VITE_API_URL=/api
```

> [!WARNING]
> **왜 기존 VITE_API_URL 주소를 주석 처리해야 하나요?**  
> Step 8에서는 프론트엔드(Amazon CloudFront)가 외부 ALB 주소로 직접 요청을 보냈지만, Step 9(Docker)에서는 프론트엔드 컨테이너 안의 **Nginx 리버스 프록시**가 `/api/...` 요청을 받아 백엔드 컨테이너로 전달합니다.  
> 이전 Step 8의 ALB 주소가 그대로 켜져 있으면 이미 삭제된 ALB로 요청을 보내 에러가 발생하므로, 반드시 `#`으로 주석 처리하여 상대 경로(`/api/...`)로 호출되게 해야 합니다 (파일을 삭제하지 않고 주석 처리해 두면 나중에 9-5 프로덕션 실습에서 다시 참고하기 편리합니다).

3. 로컬 MySQL 컨테이너 초기화용 **sql** 폴더를 준비합니다:
   - **Step 8-3A(레거시)**를 진행한 경우 백엔드 안의 sql 폴더를 복사합니다:
     ```bash
     cp -r ~/3tier-project/my-backend/sql ~/3tier-project/sql
     ```
   - **Step 8-3C(Spring Boot)**를 진행한 경우 빈 sql 폴더만 생성합니다 (JPA가 테이블을 자동 생성합니다):
     ```bash
     mkdir -p ~/3tier-project/sql
     ```

---

#### 🟡 방법 2: 샘플 압축 파일을 활용하는 경우

> [!DOWNLOAD]
> [step9-sample.zip](/files/step9/step9-sample/step9-sample.zip)
>
> - `my-backend.zip` - Spring Legacy MVC 백엔드 소스 (WAR 패키징)
> - `my-frontend.zip` - Vue.js 프론트엔드 소스
> - `sql.zip` - DB 초기화 파일 (schema + 샘플 데이터 + CSV)
>
> **관련 태스크:**
>
> - 태스크 2 (방법 2): 위 파일을 다운로드하고 압축 해제하여 프로젝트 구조를 준비합니다

1. 위 다운로드 블록에서 **step9-sample.zip**을 다운로드합니다.
2. 작업 디렉토리를 만들고 압축을 해제합니다:

**Mac/Linux:**

```bash
mkdir -p ~/3tier-project
cd ~/3tier-project

# 다운로드한 step9-sample.zip을 현재 폴더로 복사 후 압축 해제
cp ~/Downloads/step9-sample.zip .
unzip step9-sample.zip

# 내부 압축 파일 3개 해제 (각각 my-frontend, my-backend, sql 폴더 생성)
unzip my-frontend.zip -d my-frontend
unzip my-backend.zip -d my-backend
unzip sql.zip -d sql
```

**Windows (PowerShell):**

```powershell
mkdir -Force ~/3tier-project
cd ~/3tier-project

# 다운로드한 step9-sample.zip을 현재 폴더로 복사 후 압축 해제
Copy-Item ~/Downloads/step9-sample.zip .
Expand-Archive -Path step9-sample.zip -DestinationPath . -Force

# 내부 압축 파일 3개 해제 (각각 my-frontend, my-backend, sql 폴더 생성)
Expand-Archive -Path my-frontend.zip -DestinationPath my-frontend -Force
Expand-Archive -Path my-backend.zip -DestinationPath my-backend -Force
Expand-Archive -Path sql.zip -DestinationPath sql -Force
```

> [!NOTE]
> 압축 해제 후 **my-frontend/my-frontend/**처럼 하위 폴더가 한 겹 더 생겼다면, 내부 파일들을 상위 **my-frontend/** 바로 아래로 이동시켜 주세요.

---

#### 🔵 방법 3: 샘플 GitHub 리포지토리를 클론하는 경우

> [!TIP]
> **지금은 Fork 없이 원본 주소 그대로 클론하세요!**  
> 9-1(로컬) ~ 9-3(EC2·Fargate) 실습은 원본 샘플 리포지토리를 그대로 클론하여 바로 진행할 수 있습니다.  
> 이후 **9-4 (GitHub Actions CI/CD)** 실습을 진행할 때 본인 GitHub 계정에 새 리포지토리를 만들고 원격 주소만 변경하여 연결합니다 ([Step 9-0 이론](/week/9/session/0) 참고).

1. 작업 디렉토리를 만들고 프론트엔드와 백엔드를 클론합니다:

```bash
mkdir -p ~/3tier-project
cd ~/3tier-project

git clone https://github.com/puamoa/my-frontend.git my-frontend
git clone https://github.com/puamoa/my-backend.git my-backend
```

2. 로컬 MySQL 초기화용 **sql** 폴더를 복사합니다:

```bash
cp -r ~/3tier-project/my-backend/sql ~/3tier-project/sql
```

---

### 2-2. (선택) 여행지 이미지 파일 준비 — 제공 샘플(레거시) 등 해당 프로젝트만 진행

📍 **실행 위치: 로컬 PC**

> [!NOTE]
> **이 단계는 필요한 경우에만 진행합니다 (해당하지 않으면 2-3으로 건너뛰세요)**
>
> - **❌ 건너뛰는 대상**  
>   **Step 8-3C(Spring Boot 테스트 코드)** 또는 **별도 초기 이미지 파일이 없는 자체 보유 프로젝트**를 사용하는 경우 이 단계는 필요하지 않습니다.
> - **✅ 진행 대상**  
>   **Step 9 기본 제공 샘플(방법 2·3)**, **Step 8-3A(기존 레거시 프로젝트)** 등 여행지 게시판(travel) 이미지 파일이 필요한 프로젝트를 사용하는 경우에만 진행합니다 (텍스트 목록만 확인하려면 생략 가능).

> [!TIP]
> **여행지 이미지 파일은 어디에 사용되나요?**  
> 기본 제공 샘플(Spring Legacy MVC)의 여행지 게시판에는 전국 여행지 112곳의 사진 560장이 연결되어 있으나, 용량 문제로 Git 리포지토리와 **step9-sample.zip**에는 사진 파일명 목록(**travel_image.csv**)만 포함되어 있고 실제 원본 이미지(.jpg)는 빠져 있습니다.
>
> - **9-1 (로컬 docker-compose 실습)**  
>   **~/3tier-project/travel-image/** 폴더에 압축을 풀고 백엔드 컨테이너의 **/tmp/upload/travel/** 경로로 **볼륨 마운트(Volume Mount)**하면 로컬에서도 여행지 사진이 화면에 표시됩니다 (**upload.storage.type=local**).
> - **9-2 (AWS 배포 실습)**  
>   Amazon S3 버킷의 **public/travel/** 경로에 업로드하여 백엔드 컨테이너가 S3에서 직접 이미지를 불러오게 합니다 (**upload.storage.type=s3**).

1. 아래 Google Drive 링크에서 **travel-image.zip**을 다운로드합니다:
   - [travel-image.zip 다운로드 (Google Drive)](https://drive.google.com/file/d/10cNMIze0TbbEzu61UHCglrhhKZXqUBea/view?usp=drive_link)

2. **~/3tier-project/travel-image** 폴더에 압축을 해제합니다:

**Mac/Linux:**

```bash
cd ~/3tier-project
mkdir -p travel-image
unzip ~/Downloads/travel-image.zip -d travel-image
```

**Windows (PowerShell):**

```powershell
cd ~/3tier-project
mkdir -Force travel-image
Expand-Archive -Path ~/Downloads/travel-image.zip -DestinationPath travel-image -Force
```

> [!TIP]
> 압축 해제 후 **travel-image/travel-image/001-1.jpg**처럼 폴더가 두 겹으로 생겼다면, 사진 파일들이 **~/3tier-project/travel-image/** 바로 아래에 위치하도록 꺼내 주세요.

---

### 2-3. 디렉토리 구조 확인

위 과정을 마친 후, 작업 디렉토리 구조가 아래와 같은지 확인합니다:

```
~/3tier-project/
├── my-frontend/          ← Vue.js 프론트엔드 프로젝트
│   ├── src/
│   ├── package.json
│   ├── Dockerfile        ← (태스크 4에서 생성)
│   └── nginx.conf        ← (태스크 4에서 생성)
├── my-backend/           ← Spring 백엔드 프로젝트
│   ├── src/
│   ├── build.gradle
│   └── Dockerfile        ← (태스크 3에서 생성)
├── sql/                  ← 로컬 MySQL 초기화 파일 (자체/부트 프로젝트는 비어 있어도 무방)
├── travel-image/         ← (선택) 2-2에서 준비한 경우에만 존재 (여행지 사진 파일)
├── docker-compose.yml    ← (태스크 5에서 생성)
└── .env                  ← (태스크 5에서 생성)
```

---

### 2-4. 백엔드 보안 설정 파일 확인 및 생성 (필수)

📍 **실행 위치: 로컬 PC**

> [!WARNING]
> **왜 이 단계가 필요한가요?**  
> 백엔드 설정 파일(**application.properties** 또는 **application.yaml**)에는 DB 접속 정보와 비밀키가 들어가므로 **.gitignore**에 의해 Git 저장소와 샘플 압축 파일에서 제외되어 있습니다.  
> 따라서 **새로 압축을 풀었거나 클론한 경우에는 이 파일이 없으며**, 파일 없이 이미지를 빌드하면 컨테이너 실행 시 에러가 발생합니다.  
> Docker에서는 파일 안에 실제 비밀번호를 적는 대신 **환경변수 플레이스홀더**만 적어두고, 실제 값은 **.env** 파일이나 CI/CD Secrets에서 안전하게 주입합니다.

내 백엔드 프로젝트 종류에 맞춰 설정 파일이 존재하는지 확인하고, 없다면 생성합니다:

**🅰️ 기본 제공 샘플(Spring Legacy WAR) 또는 Step 8-3A 프로젝트인 경우:**

`~/3tier-project/my-backend/src/main/resources/application.properties` 파일을 확인하고, 없다면 아래 내용으로 생성합니다:

```properties
# 데이터베이스 설정 (환경변수에서 주입)
jdbc.driver=com.mysql.cj.jdbc.Driver
jdbc.url=jdbc:mysql://${DB_ENDPOINT}:3306/${DB_NAME}
jdbc.username=${DB_USERNAME}
jdbc.password=${DB_PASSWORD}

# 파일 업로드 및 스토리지 타입 설정
# - 로컬(9-1): STORAGE_TYPE=local → /tmp/upload/travel 에서 이미지 조회
# - AWS(9-2~): STORAGE_TYPE=s3    → S3 버킷(public/travel/)에서 이미지 조회
upload.local.path=/tmp/upload
upload.storage.type=${STORAGE_TYPE:local}

# AWS S3 설정 (로컬에서는 기본값 사용, 9-2 AWS 배포 시 환경변수로 주입)
cloud.aws.s3.bucket=${S3_BUCKET:my-bucket}
cloud.aws.region=${AWS_REGION:ap-northeast-2}

# 로그 레벨
logging.level.org.scoula=INFO
```

**🅱️ Step 8-3B / 8-3C (Spring Boot JAR) 프로젝트인 경우:**

`~/3tier-project/my-backend/src/main/resources/application.yaml` 파일에 아래처럼 환경변수 참조가 설정되어 있는지 확인합니다:

```yaml
spring:
  datasource:
    url: jdbc:mysql://${DB_ENDPOINT}:3306/${DB_NAME}?useSSL=false&allowPublicKeyRetrieval=true&characterEncoding=UTF-8&serverTimezone=Asia/Seoul
    username: ${DB_USERNAME}
    password: ${DB_PASSWORD}
    driver-class-name: com.mysql.cj.jdbc.Driver
  jpa:
    hibernate:
      ddl-auto: update
```

> [!TIP]
> **포트(:3306) 생략 가능 여부**  
> MySQL의 기본 포트는 **3306**이므로, 접속 URL에서 `:3306`을 생략해도(`jdbc:mysql://${DB_ENDPOINT}/${DB_NAME}`) 동일하게 동작합니다. 이 가이드는 Step 8과 맞추기 위해 `:3306`을 명시했습니다.  
> 이 경우 **.env**의 **DB_ENDPOINT**에는 포트 없이 호스트 이름(**db**)만 적어야 합니다. (`db:3306`으로 적으면 `db:3306:3306`이 되어 오류가 납니다.)  
> 기본 포트가 아닌 DB를 쓴다면 `:3306` 자리를 해당 포트로 바꾸세요.

> [!TIP]
> **자체 보유 프로젝트(개인/팀 프로젝트)를 적용할 때 꼭 맞춰야 할 5가지 포인트**
>
> 본인이 직접 개발한 프로젝트를 가져와 Docker로 구성할 때는 아래 5가지를 본인 프로젝트에 맞게 수정하세요:
>
> - **① DB 접속 주소를 환경변수로 변경**  
>   설정 파일에 **localhost:3306**이 하드코딩되어 있으면 컨테이너 내부 자기 자신을 찾다가 연결에 실패합니다.  
>   위 예시처럼 **DB_ENDPOINT**, **DB_NAME**, **DB_USERNAME**, **DB_PASSWORD** 환경변수를 사용하도록 수정하세요.
> - **② 초기 SQL 및 DB 이름 일치**  
>   본인 프로젝트의 테이블 생성 SQL 파일을 **sql/** 폴더에 넣고, SQL 안의 데이터베이스 이름과 태스크 5에서 만들 **.env**의 **DB_NAME**을 일치시키세요 (JPA **ddl-auto: update** 사용 시 자동 생성됨).
> - **③ Java 버전 확인 (JDK 17 vs 21)**  
>   **build.gradle**의 Java 버전을 확인하고, 태스크 3의 **Dockerfile** 베이스 이미지 버전(17 또는 21)을 맞추세요.
> - **④ 프론트엔드 API 경로와 Nginx 프록시 일치**  
>   프론트엔드가 백엔드를 호출하는 경로 접두사(예: **/api/**, **/board/**, **/member/**)를 확인하고 태스크 4의 **nginx.conf**에 반영하세요.
> - **⑤ 파일 업로드 경로 Linux 표준화**  
>   설정 파일에 Windows 경로(**C:/upload** 등)가 있다면 컨테이너 내부(Linux)에서 동작하도록 **/tmp/upload**로 변경하세요.

> [!NOTE]
> **9-4 (GitHub Actions CI/CD)와의 연결**:  
> 로컬에서는 방금 만든 설정 파일이 Docker 빌드 시 이미지 안에 포함됩니다.  
> 하지만 Git에는 이 파일이 올라가지 않으므로, **9-4 실습(GitHub Actions 자동 배포)**에서는 Step 8과 동일하게 GitHub Secrets(`APPLICATION_PROPERTIES`)에 이 내용을 등록하여 빌드 직전에 파일을 자동 생성하게 됩니다.

✅ **태스크 완료** — 프로젝트 구조와 백엔드 설정 파일을 준비했습니다.

---

## 태스크 3: 백엔드 Dockerfile 작성

📍 **실행 위치: 로컬 PC**

태스크 2에서 준비한 백엔드 프로젝트의 패키징 방식에 따라 **방법 A(JAR)** 또는 **방법 B(WAR)** 중 **한 가지**만 선택하여 Dockerfile을 작성합니다:

| 구분 | 대상 프로젝트 | 확인 방법 (my-backend/build.gradle) | 2단계 실행 이미지 |
| :--- | :--- | :--- | :--- |
| **🟢 방법 A: Spring Boot (JAR)** | Step 8-3B / 8-3C 부트 테스트 프로젝트, 또는 자체 Spring Boot 프로젝트 | plugins 블록에 **id 'war'**가 없음 | `eclipse-temurin:17-jre-alpine` |
| **🟡 방법 B: Spring Legacy MVC (WAR)** | **Step 9 기본 제공 샘플**, Step 8-3A 프로젝트 | plugins 블록에 **id 'war'**가 있음 | `tomcat:9-jre17` |

> [!CONCEPT] Dockerfile 안의 명령어는 어디서 실행되며, 데이터는 어떻게 연결될까요?
> - **내 PC가 아니라 '격리된 컨테이너 내부'에서 실행됩니다**  
>   Dockerfile에 적는 `WORKDIR /app`, `RUN ./gradlew build`, `RUN npm ci`는 내 PC의 폴더를 바꾸는 것이 아니라, Docker가 띄운 임시 빌드 컨테이너 안에서 실행됩니다 (내 PC에 Java나 Node.js가 없어도 빌드 가능).
> - **'이미지를 만드는 곳'과 '실행하는 곳'의 분리**  
>   이번 **9-1**에서는 내 PC에서 빌드하고 내 PC에서 실행하지만, **9-2·9-3**에서는 내 PC에서 빌드한 이미지를 Amazon ECR에 올려 EC2·Fargate가 내려받아 실행하며, **9-4(CI/CD)**에서는 GitHub Actions 서버가 내 PC 대신 이 Dockerfile을 읽어 자동 빌드합니다.
> - **주의: 외부 데이터(DB, 사진 파일)는 이미지 안에 들어가지 않습니다!**  
>   이미지 안에는 오직 애플리케이션 코드(`.jar`/`.war`/`dist/`)만 포장됩니다. DB 초기 데이터(`sql/`)나 여행지 사진(`travel-image/`)은 이미지에 포함되지 않으므로, 로컬(9-1)에서는 태스크 5의 **볼륨 마운트(volumes)**로 연결하고 AWS(9-2~)에서는 **Amazon RDS**와 **Amazon S3**로 연결합니다. (자세한 내용은 [Step 9-0 이론: 이미지를 빌드하는 곳 vs 실행하는 곳](/week/9/session/0) 참고)

---

### 🟢 방법 A: Spring Boot (JAR) Dockerfile

1. `~/3tier-project/my-backend/Dockerfile` 파일을 생성하고 아래 내용을 작성합니다:

```dockerfile
# ──── 1단계: 빌드 환경 (Gradle + JDK 17) ────
FROM eclipse-temurin:17-jdk-alpine AS build
WORKDIR /app

# Gradle Wrapper 및 설정 복사 + 의존성 캐싱 (Windows CRLF 줄바꿈 제거 포함)
COPY gradlew build.gradle settings.gradle ./
COPY gradle ./gradle
RUN sed -i 's/\r$//' ./gradlew && chmod +x ./gradlew && ./gradlew dependencies --no-daemon

# 소스 코드 복사 + 실행 가능한 JAR 빌드 (테스트 생략)
COPY src ./src
RUN ./gradlew bootJar --no-daemon -x test

# ──── 2단계: 실행 환경 (가벼운 JRE 17만 포함) ────
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=build /app/build/libs/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
```

> [!NOTE]
> **주요 설정값 의미 (방법 A)**
>
> - **sed -i 's/\r$//' ./gradlew**  
>   Windows에서 파일을 클론·저장할 때 생기는 줄바꿈 문자(CRLF)를 Linux 형식(LF)으로 변환하여 스크립트 실행 에러를 방지합니다.
> - **--no-daemon -x test**  
>   컨테이너 빌드 시 불필요한 Gradle 백그라운드 데몬과 단위 테스트 실행을 생략하여 빌드 속도를 높입니다.
> - **COPY --from=build**  
>   1단계(build)에서 생성된 JAR 파일만 2단계 JRE 이미지로 가져옵니다 (최종 이미지 크기 ~200MB).

---

### 🟡 방법 B: Spring Legacy MVC (WAR) Dockerfile (기본 제공 샘플)

1. `~/3tier-project/my-backend/Dockerfile` 파일을 생성하고 아래 내용을 작성합니다:

```dockerfile
# ──── 1단계: 빌드 환경 (Gradle + JDK 17) ────
FROM eclipse-temurin:17-jdk-alpine AS build
WORKDIR /app

# Gradle Wrapper 및 설정 복사 + 의존성 캐싱 (Windows CRLF 줄바꿈 제거 포함)
COPY gradlew build.gradle settings.gradle ./
COPY gradle ./gradle
RUN sed -i 's/\r$//' ./gradlew && chmod +x ./gradlew && ./gradlew dependencies --no-daemon

# 소스 코드 복사 + WAR 파일 빌드 (테스트 생략)
COPY src ./src
RUN ./gradlew build --no-daemon -x test

# ──── 2단계: 실행 환경 (Tomcat 9 + JRE 17) ────
FROM tomcat:9-jre17
RUN rm -rf /usr/local/tomcat/webapps/*
COPY --from=build /app/build/libs/*.war /usr/local/tomcat/webapps/ROOT.war
EXPOSE 8080
```

> [!NOTE]
> **주요 설정값 의미 (방법 B)**
>
> - **FROM tomcat:9-jre17**  
>   기본 제공 샘플(Spring 5.3.37)은 javax.servlet 패키지를 사용하므로 반드시 **Tomcat 9** 이미지를 사용해야 합니다 (Tomcat 10 이상은 jakarta.servlet 전용이라 서블릿 에러가 발생합니다).
> - **rm -rf /usr/local/tomcat/webapps/***  
>   Tomcat 기본 예제 파일들을 삭제합니다.
> - **.../webapps/ROOT.war**  
>   빌드된 WAR 파일을 **ROOT.war**라는 이름으로 복사하면 Tomcat이 자동으로 압축을 풀어 루트 경로(/)로 배포합니다 (별도의 ENTRYPOINT 없이도 Tomcat이 자동 시작됩니다).

---

### 빌드 테스트 (방법 A/B 공통)

2. 백엔드 디렉토리로 이동하여 이미지가 정상적으로 빌드되는지 테스트합니다 (첫 빌드는 의존성 다운로드로 인해 1 ~ 3분 정도 소요됩니다):

```bash
cd ~/3tier-project/my-backend
docker build -t step9-backend:test .
```

> [!NOTE]
> **docker build 명령어 구문 상세 설명**
>
> - **-t step9-backend:test (--tag 옵션)**  
>   생성될 이미지의 **이름(step9-backend)**과 **태그(test)**를 지정합니다. 콜론(`:`) 뒤의 태그를 생략하면 자동으로 **:latest**가 붙습니다.
> - **. (마지막 마침표 — 필수!)**  
>   **현재 디렉토리(.)를 '빌드 컨텍스트(Build Context)'로 지정**한다는 뜻입니다. Docker는 이 마침표가 가리키는 폴더 안에서 `Dockerfile`을 찾고, 그 폴더 안의 파일들을 대상으로 `COPY` 명령을 수행합니다.

> [!TIP]
> **크로스플랫폼 빌드 조건일 때는? (docker build vs docker buildx)**
>
> - **로컬 실행(9-1) 또는 동일 아키텍처 환경**: 지금처럼 내 PC에서 바로 띄워볼 때나 Windows PC(`amd64`)에서 빌드할 때는 기본 `docker build`만으로도 충분합니다.
> - **다른 CPU 서버 배포(9-2) 또는 공개 리포지토리/팀 공유 시**:  
>   ① **Apple Silicon 맥(M1~M4, `arm64`)**에서 빌드한 이미지를 AWS EC2/Fargate(`linux/amd64`) 서버에 올릴 때, 또는  
>   ② **공개 리포지토리(Docker Hub 등)**에 올려서 맥(`arm64`)과 윈도우/리눅스(`amd64`) 사용자 모두가 받아 쓸 수 있는 멀티 아키텍처 이미지를 만들 때는 아래와 같이 **`docker buildx`**와 **`--platform`** 옵션을 활용합니다 ([Step 9-0 이론](/week/9/session/0) 참고):
>   ```bash
>   # (참고) 9-2 AWS 서버(linux/amd64) 배포용 크로스플랫폼 빌드 예시
>   docker buildx build --platform linux/amd64 -t step9-backend:latest --load .
>   ```

> [!OUTPUT]
>
> ```
> [+] Building 45.2s (14/14) FINISHED
>  => [build 1/6] FROM eclipse-temurin:17-jdk-alpine
>  ...
>  => exporting to image
>  => => naming to docker.io/library/step9-backend:test
> ```

3. 빌드된 이미지가 생성되었는지 확인합니다 (macOS/Linux/Windows PowerShell 공통):

```bash
docker images step9-backend
```

> [!OUTPUT]
>
> ```
> REPOSITORY      TAG       IMAGE ID       CREATED          SIZE
> step9-backend   test      a1b2c3d4e5f6   10 seconds ago   265MB
> ```

> [!TROUBLESHOOTING]
> | 증상 | 원인 | 해결 방법 |
> |------|------|-----------|
> | `gradlew: Permission denied` 또는 `not found` | 실행 권한 없음 또는 Windows 줄바꿈(CRLF) | Dockerfile에 `RUN sed -i 's/\r$//' ./gradlew && chmod +x ./gradlew`가 포함되었는지 확인 |
> | `COPY failed: file not found` | 다른 폴더에서 빌드 실행 | 반드시 `cd ~/3tier-project/my-backend` 이동 후 마지막 마침표(`.`)까지 입력하여 실행 |
> | `no main manifest attribute` | Spring Boot에서 일반 jar 사용 | `./gradlew bootJar` (방법 A) 또는 WAR 방식 (방법 B) 사용 |

✅ **태스크 완료** — 백엔드 Docker 이미지를 빌드했습니다.

---

## 태스크 4: 프론트엔드 Dockerfile + Nginx 설정

📍 **실행 위치: 로컬 PC (`~/3tier-project/my-frontend/`)**

프론트엔드(Vue.js) 프로젝트를 빌드하고 정적 파일을 서빙할 **nginx.conf**와 **Dockerfile**을 작성합니다.

> [!CONCEPT] 왜 프론트엔드 컨테이너에 Nginx가 필요한가요? (npm run dev와의 차이)
> 로컬에서 개발할 때 사용하던 `npm run dev`(Vite 개발 서버)와 `vite.config.js`의 프록시(`server.proxy`) 설정은 **오직 개발 중에만 동작**합니다.  
> 운영 배포를 위해 `npm run build`를 실행하면 Vue.js 코드는 순수 정적 파일(`index.html`, `.js`, `.css`)로 변환되어 `dist/` 폴더에 저장되고 Vite 서버는 사라집니다.
>
> 따라서 컨테이너 환경에서는 다음 두 가지 역할을 수행할 **실제 웹 서버**가 필요합니다:
> - **정적 파일 서빙**: 브라우저가 접속했을 때 `dist/` 폴더의 HTML·JS·CSS 화면 파일을 전달합니다.
> - **API 리버스 프록시**: 개발 환경의 `vite.config.js`를 대신하여, 브라우저가 요청한 `/api/...` 호출을 백엔드 컨테이너로 전달합니다 (브라우저 입장에서는 프론트엔드와 백엔드가 같은 주소로 보이므로 **CORS 에러가 원천 차단**됩니다).
>
> 꼭 Nginx만 써야 하는 것은 아니며 **Caddy**, **Apache(httpd)** 같은 다른 웹 서버를 쓰거나, Step 8처럼 컨테이너 대신 **Amazon S3 + Amazon CloudFront**로 분리할 수도 있습니다 (9-5 프로덕션 구성에서 다룸). 다만 컨테이너 환경에서는 이미지 크기가 매우 작고(~45MB) 가벼운 **Nginx**가 실무 표준으로 가장 널리 사용됩니다.

---

### 4-1. nginx.conf 작성

1. 프론트엔드 디렉토리(`~/3tier-project/my-frontend/`) 안에 `nginx.conf` 파일을 생성하고 아래 내용을 작성합니다:

```nginx
# ~/3tier-project/my-frontend/nginx.conf
server {
    listen 80;
    server_name localhost;

    # 1) Vue.js 정적 파일 서빙 + SPA 라우팅 처리
    location / {
        root /usr/share/nginx/html;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # 2) 백엔드 API 리버스 프록시
    location /api/ {
        proxy_pass http://${BACKEND_HOST}:${BACKEND_PORT}/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

> [!NOTE]
> **nginx.conf 핵심 설정 상세 설명 (Step 8 설정과의 비교)**
>
> 위 `nginx.conf`는 앞선 **Step 8에서 Amazon S3와 Amazon CloudFront 콘솔로 설정했던 기능들을 컨테이너 안에서 똑같이 구현**한 것입니다:
>
> | 기능 역할 | Step 8 (S3 + CloudFront 콘솔 설정) | Step 9 (`nginx.conf` 코드 설정) |
> | :--- | :--- | :--- |
> | **기본 시작 페이지** | S3 `Index document` & CloudFront `Default root object`: **`index.html`** | `index index.html;` |
> | **SPA 라우팅 (새로고침 404 방지)** | CloudFront `Custom Error Response`: 403·404 발생 시 **`/index.html` (200)** 반환 | `try_files $uri $uri/ /index.html;` |
> | **백엔드 API 분기 (프록시)** | Step 8-4 CloudFront `Behavior`: **`/api/*` → ALB Origin** 전달 | `location /api/ { proxy_pass ... }` |
>
> - **root /usr/share/nginx/html; & index index.html;**  
>   Nginx가 정적 웹 파일을 찾는 기본 디렉토리입니다. 잠시 후 작성할 Dockerfile에서 Vue.js 빌드 결과물(`dist/`)을 이 경로로 복사합니다.
> - **try_files $uri $uri/ /index.html; (SPA 라우팅 필수 설정)**  
>   Vue.js 같은 SPA(Single Page Application)는 실제 HTML 파일이 `index.html` 하나뿐이고, `/board`나 `/travel` 같은 경로 이동은 Vue Router가 브라우저에서 처리합니다.  
>   만약 이 설정이 없으면 사용자가 브라우저 주소창에 `http://localhost/board`를 직접 입력하거나 새로고침(F5)했을 때 Nginx가 `/board`라는 실제 파일을 찾지 못해 **404 Not Found 에러**를 반환합니다. 이 설정을 넣으면 파일이 없을 때 항상 `/index.html`을 대신 반환하여 화면이 정상 표시됩니다.
> - **proxy_pass http://${BACKEND_HOST}:${BACKEND_PORT}/api/;**  
>   `/api/`로 시작하는 모든 요청을 백엔드 서버로 전달합니다. 주소를 고정(하드코딩)하지 않고 `${BACKEND_HOST}`, `${BACKEND_PORT}` 환경변수로 적어두면 실행 환경에 따라 백엔드 주소를 유연하게 바꿀 수 있습니다.
> - **proxy_set_header ... (클라이언트 원본 정보 전달)**  
>   Nginx가 요청을 대신 전달할 때 원래 접속한 사용자의 도메인(**Host**), 실제 IP 주소(**X-Real-IP**, **X-Forwarded-For**), 접속 프로토콜(**X-Forwarded-Proto**, http/https)을 백엔드(Spring)가 알 수 있도록 HTTP 헤더에 담아 넘겨줍니다.

> [!CONCEPT] 왜 백엔드 주소를 환경변수(${BACKEND_HOST})로 작성하나요?
> 앞으로 진행할 실습 환경마다 백엔드 컨테이너를 찾아가는 주소가 달라지기 때문입니다:
> - **9-1 (로컬 docker-compose) & 9-2 (Amazon EC2 docker-compose)**: 컨테이너 이름으로 통신하므로 **BACKEND_HOST=backend**
> - **9-3 (AWS Fargate 사이드카 배포)**: 하나의 Task 안에서 프론트와 백엔드가 네트워크를 공유하므로 **BACKEND_HOST=localhost**
>
> 이처럼 환경변수로 설정해 두면 **단 한 번 빌드한 프론트엔드 이미지를 로컬, Amazon EC2, AWS Fargate 어디서든 수정 없이 그대로 재사용**할 수 있습니다.

> [!TIP]
> **자체 보유 프로젝트의 API 경로가 다른 경우**
>
> Step 9 기본 제공 샘플(Spring Legacy)과 Step 8-3C(Spring Boot)는 모두 `/api/board`, `/api/travel`처럼 `/api/` 접두사를 사용하므로 위 `nginx.conf`를 **수정 없이 그대로 사용**하면 됩니다.  
> 만약 본인이 직접 개발한 프로젝트에서 `/api/` 없이 `/board/`, `/member/` 등을 호출한다면 `location /api/` 블록을 아래와 같이 수정하세요:
>
> - **특정 경로들만 백엔드로 전달할 때**:
>   ```nginx
>   location ~ ^/(board|member|travel|upload)/ {
>       proxy_pass http://${BACKEND_HOST}:${BACKEND_PORT};
>       proxy_set_header Host $host;
>       proxy_set_header X-Real-IP $remote_addr;
>   }
>   ```
> - **정적 파일 외의 모든 요청을 백엔드로 전달할 때**:
>   ```nginx
>   location / {
>       root /usr/share/nginx/html;
>       try_files $uri $uri/ @backend;
>   }
>   location @backend {
>       proxy_pass http://${BACKEND_HOST}:${BACKEND_PORT};
>       proxy_set_header Host $host;
>       proxy_set_header X-Real-IP $remote_addr;
>   }
>   ```

---

### 4-2. 프론트엔드 Dockerfile 작성

2. 같은 프론트엔드 디렉토리(`~/3tier-project/my-frontend/`) 안에 확장자 없는 `Dockerfile`을 생성하고 아래 내용을 작성합니다:

```dockerfile
# ~/3tier-project/my-frontend/Dockerfile
# ──── 1단계: 빌드 환경 (Node.js 20) ────
FROM node:20-alpine AS build
WORKDIR /app

# 의존성 파일 먼저 복사 및 설치 (레이어 캐싱)
COPY package*.json ./
RUN npm ci

# 전체 소스 복사 및 정적 파일 빌드 (/app/dist 생성)
COPY . .
RUN npm run build

# ──── 2단계: 실행 환경 (Nginx) ────
FROM nginx:alpine

# 1단계(build)에서 생성된 정적 파일만 Nginx 서빙 디렉토리로 복사
COPY --from=build /app/dist /usr/share/nginx/html

# Nginx 설정 템플릿 복사 (컨테이너 시작 시 환경변수 자동 치환)
COPY nginx.conf /etc/nginx/templates/default.conf.template

EXPOSE 80
```

> [!NOTE]
> **Dockerfile 핵심 코드 상세 설명**
>
> - **COPY package*.json ./ → RUN npm ci (레이어 캐싱 최적화)**  
>   전체 소스(`COPY . .`)를 복사하기 전에 `package.json`과 `package-lock.json`만 먼저 복사해서 라이브러리를 설치합니다.  
>   이렇게 분리하면 나중에 Vue.js 화면 코드(`src/`)만 수정하고 다시 빌드할 때, Docker가 이전의 라이브러리 설치 단계(`npm ci`)를 캐시에서 그대로 재사용하여 빌드 시간이 몇 초로 단축됩니다 (`npm ci`는 `package-lock.json`에 명시된 정확한 버전을 설치하는 배포 표준 명령어입니다).
> - **COPY --from=build /app/dist /usr/share/nginx/html**  
>   1단계(`build`) 컨테이너에서 `npm run build`로 만들어진 `/app/dist` 폴더 안의 결과물만 2단계 Nginx 이미지로 가져옵니다. 빌드에 쓰인 무거운 Node.js와 `node_modules` 폴더(수백 MB)는 최종 이미지에서 완전히 제외됩니다.
> - **COPY nginx.conf /etc/nginx/templates/default.conf.template (환경변수 자동 치환)**  
>   Nginx 공식 이미지는 컨테이너가 시작될 때 `/etc/nginx/templates/` 폴더 안에 있는 `*.template` 파일을 읽어, 그 안의 `${BACKEND_HOST}`, `${BACKEND_PORT}` 같은 환경변수를 실제 값으로 바꾼 뒤(`envsubst`) 최종 설정 파일(`/etc/nginx/conf.d/default.conf`)을 자동으로 생성해 줍니다.

> [!NOTE]
> **왜 Dockerfile과 nginx.conf를 모두 my-frontend/ 폴더 안에 두나요?**
>
> - **① Docker 빌드 컨텍스트(Build Context) 보안 규칙**  
>   Docker는 빌드 명령어를 실행한 폴더(컨텍스트) 바깥의 상위 폴더 파일(`COPY ../nginx.conf` 등)에 접근하는 것을 차단합니다. 두 파일이 모두 `my-frontend/` 안에 있어야 에러 없이 복사됩니다.
> - **② Git 저장소 및 9-4 CI/CD 완벽 호환 (멀티레포·모노레포 공통)**  
>   `my-frontend/` 폴더가 독립된 Git 리포지토리(멀티레포)이든 상위 폴더가 하나의 Git 리포지토리(모노레포)이든, `my-frontend/` 안에 두 파일이 함께 들어 있으면 **9-4 세션(GitHub Actions 자동 배포)**에서 단 한 줄의 수정도 없이 그대로 이미지를 빌드할 수 있습니다.

> [!WARNING]
> **Windows에서 파일 생성 시 확장자(.txt) 주의!**  
> Windows 메모장이나 탐색기에서 파일을 만들 때 `Dockerfile.txt` 또는 `nginx.conf.txt`처럼 뒤에 `.txt`가 숨겨진 채로 붙으면 빌드 시 `no such file or directory` 에러가 발생합니다. VS Code나 IntelliJ의 좌측 파일 트리에서 `my-frontend` 우클릭 → **New File**로 생성하는 것을 권장합니다.

---

### 4-3. 프론트엔드 빌드 테스트

3. 프론트엔드 디렉토리로 이동하여 이미지가 정상적으로 빌드되는지 테스트합니다 (마지막의 마침표 `.`까지 반드시 입력하세요):

```bash
cd ~/3tier-project/my-frontend
docker build -t step9-frontend:test .
```

> [!NOTE]
> **docker build 명령어 의미 요약**
>
> - **-t step9-frontend:test**  
>   빌드될 프론트엔드 이미지의 이름을 **step9-frontend**, 태그를 **test**로 지정합니다.
> - **. (마지막 마침표)**  
>   현재 폴더(`~/3tier-project/my-frontend`)를 빌드 컨텍스트로 지정하여, 폴더 안의 `Dockerfile`과 `nginx.conf`, 소스 파일을 읽어 빌드합니다.

> [!TIP]
> **크로스플랫폼(buildx)으로 프론트엔드 이미지를 빌드할 때 (참고)**  
> 이번 9-1 로컬 실습에서는 위 **docker build** 명령어만 실행하면 됩니다. 만약 Apple Silicon 맥에서 AWS 서버(**linux/amd64**) 배포용으로 빌드할 때(9-2 실습)는 아래 명령어를 사용합니다:
> ```bash
> docker buildx build --platform linux/amd64 -t step9-frontend:latest --load .
> ```

> [!OUTPUT]
>
> ```
> [+] Building 22.4s (12/12) FINISHED
>  => [build 1/5] FROM node:20-alpine
>  ...
>  => exporting to image
>  => => naming to docker.io/library/step9-frontend:test
> ```

4. 빌드된 프론트엔드 이미지가 생성되었는지 확인합니다 (Node.js 빌드 도구가 제외되어 약 40~50MB의 가벼운 이미지가 생성됩니다):

```bash
docker images step9-frontend
```

> [!OUTPUT]
>
> ```
> REPOSITORY       TAG       IMAGE ID       CREATED          SIZE
> step9-frontend   test      f6e5d4c3b2a1   10 seconds ago   45.8MB
> ```

> [!TROUBLESHOOTING]
> | 증상 | 원인 | 해결 방법 |
> |------|------|-----------|
> | `open Dockerfile: no such file or directory` | 다른 폴더에서 실행했거나 파일명이 `Dockerfile.txt`로 저장됨 | `cd ~/3tier-project/my-frontend` 이동 후 `ls`로 파일명이 정확히 `Dockerfile`인지 확인 |
> | `"/nginx.conf": not found` | `nginx.conf`가 상위 폴더나 다른 위치에 있음 | `~/3tier-project/my-frontend/nginx.conf` 위치에 파일이 있는지 확인 |
> | `npm ci` 실행 중 에러 발생 | `package-lock.json` 파일이 없는 자체 프로젝트 | Dockerfile의 `RUN npm ci`를 `RUN npm install`로 변경 후 다시 빌드 |

✅ **태스크 완료** — 프론트엔드 Dockerfile과 Nginx 설정을 작성하고 이미지를 빌드했습니다.

---

## 태스크 5: docker-compose.yml 및 .env 작성

📍 **실행 위치: 로컬 PC (`~/3tier-project`)**

태스크 3과 4에서 각각 만든 백엔드·프론트엔드 이미지와 공식 MySQL 8.0 이미지를 하나로 묶어 실행할 **docker-compose.yml**과 환경변수 파일(**.env**)을 작성합니다.

### 5-1. .env 파일 작성

> [!CONCEPT]
> **.env 파일은 내 로컬 PC 설정인가요, Docker 컨테이너 설정인가요?**
>
> 파일 자체(`~/3tier-project/.env`)는 **내 로컬 PC 폴더에 저장**하지만, 그 안에 적힌 값들은 내 로컬 PC(Windows/macOS)가 아니라 **Docker 안에 새로 띄워지는 컨테이너(db, backend)들의 내부 환경 설정**입니다.
>
> ```
> [내 로컬 PC의 ~/3tier-project/.env]
>   DB_ENDPOINT=db
>   DB_NAME=myapp
>   DB_USERNAME=root
>   DB_PASSWORD=devpassword123
>        │
>        ├──▶ ① [db 컨테이너 (MySQL 8.0)] 생성 시 주입
>        │      - 컨테이너가 처음 켜질 때 root 비밀번호를 'devpassword123'으로 설정하고
>        │      - 'myapp'이라는 초기 데이터베이스를 자동으로 생성함
>        │
>        └──▶ ② [backend 컨테이너 (Spring)] 실행 시 주입 (env_file: - .env)
>               - 태스크 2-4(및 Step 8)에서 application.properties / application.yaml에 적어둔
>                 ${DB_ENDPOINT}, ${DB_NAME}, ${DB_USERNAME}, ${DB_PASSWORD} 자리에
>                 위 값들을 그대로 넣어서 ①번 db 컨테이너에 접속함
> ```
>
> - **내 로컬 PC에 설치된 MySQL과는 완전히 무관합니다.**  
>   내 PC에 MySQL이 깔려 있지 않거나 비밀번호가 달라도 상관없습니다. 새로 생성되는 **db 컨테이너**가 이 `.env` 파일의 비밀번호(**devpassword123**)와 DB 이름(**myapp**)으로 초기화되기 때문입니다.
> - **왜 DB_ENDPOINT가 localhost가 아니라 db인가요?**  
>   백엔드도 컨테이너 안에서 실행되므로, 백엔드 입장에서 **localhost**는 백엔드 컨테이너 자기 자신을 가리킵니다. 같은 **docker-compose.yml**로 묶인 컨테이너끼리는 서비스 이름(**db**)을 호스트 주소처럼 사용하여 찾아갑니다.

1. 프로젝트 루트(`~/3tier-project`)로 이동하여 `.env` 파일을 생성합니다. 앞선 **태스크 2-4(및 Step 8)**의 백엔드 설정 파일에 적어둔 환경변수 이름과 **sql/00-init.sql**의 데이터베이스 이름(**myapp**)이 정확히 일치하도록 작성합니다:

```bash
cd ~/3tier-project
```

```ini
# ~/3tier-project/.env

# 1. MySQL 컨테이너 초기 생성 및 백엔드 DB 접속 설정
DB_ENDPOINT=db
DB_NAME=myapp
DB_USERNAME=root
DB_PASSWORD=devpassword123

# 2. 스토리지 타입 설정 (로컬 실습에서는 local, AWS 배포 시 s3)
STORAGE_TYPE=local
```

2. 만약 `~/3tier-project` 폴더를 Git으로 관리하는 경우, 비밀번호가 담긴 `.env` 파일이 GitHub에 올라가지 않도록 `.gitignore`에 추가합니다:

```bash
echo ".env" >> ~/3tier-project/.gitignore
```

> [!TIP]
> **협업이나 Git 저장소 공유 시: .env.example 활용법**  
> 실제 비밀번호가 들어있는 **.env** 파일은 Git에 올리지 않기 때문에, 팀원이나 다른 PC에서 프로젝트를 클론했을 때 *"어떤 환경변수들을 설정해야 하는지"* 알기 어렵습니다.  
> 실무에서는 아래처럼 실제 비밀번호 자리만 비워둔 **.env.example** 샘플 파일을 만들어 Git에 함께 커밋해 두고, 클론 받은 사람이 이를 **.env**로 복사(`cp .env.example .env`)해서 값만 채워 쓰도록 안내합니다.
>
> ```ini
> # .env.example (Git 커밋용 양식 예시)
> DB_ENDPOINT=db
> DB_NAME=myapp
> DB_USERNAME=root
> DB_PASSWORD=YOUR_PASSWORD_HERE
> STORAGE_TYPE=local
> ```

---

### 5-2. 컨테이너 DB 초기화를 위한 SQL 파일 확인 및 준비

> [!CONCEPT]
> **~/3tier-project/sql/ 폴더의 파일들은 어디에 적용되나요?**  
> 앞서 작성한 **.env**와 마찬가지로, `~/3tier-project/sql/` 폴더에 넣는 SQL·CSV 파일들은 **내 로컬 PC의 DB가 아니라 Docker 안에 새로 생성될 MySQL 컨테이너(db)를 초기화하기 위한 파일들**입니다.  
> **docker-compose.yml**에서 이 `sql/` 폴더를 MySQL 컨테이너 내부의 `/docker-entrypoint-initdb.d` 경로로 연결(볼륨 마운트)해 두면, **MySQL 컨테이너가 맨 처음 생성될 때 폴더 안의 파일들을 이름순(00 → 01 → 02...)으로 자동 실행**하여 컨테이너 안의 **myapp** 데이터베이스에 테이블과 초기 데이터를 세팅합니다.

본인의 실습 준비 상황에 맞춰 아래 **케이스 1 또는 케이스 2**를 확인하세요:

#### 🟢 케이스 1: 태스크 2에서 이미 `sql/` 폴더를 준비한 경우 (기본 제공 샘플 / Step 8-3A)

태스크 2에서 **step9-sample.zip** 또는 **sql.zip**의 압축을 풀어 `~/3tier-project/sql/` 폴더에 파일들이 이미 들어 있다면 **추가 작업 없이 바로 5-3으로 넘어가면 됩니다.** 아래 명령어로 파일 목록만 가볍게 확인하세요:

```bash
ls ~/3tier-project/sql
```

> [!OUTPUT]
>
> ```
> 00-init.sql  01-board.sql  02-member.sql  03-travel.sql  04-load-travel.sh  travel.csv  travel_image.csv
> ```

#### 🔵 케이스 2: 처음 DB를 구성하는 경우 (Step 8-3C 신규 Spring Boot 또는 빈 `sql/` 폴더)

아직 `~/3tier-project/sql/` 폴더 안에 SQL 파일이 없는 경우에는 아래 두 가지 방법 중 하나를 선택할 수 있습니다:

- **방법 A (Spring Boot JPA 자동 생성 사용 — 별도 SQL 작성 불필요)**  
  Spring Boot 프로젝트에서 `application.yaml`에 `ddl-auto: update`가 설정되어 있다면, `sql/` 폴더가 비어 있어도 **.env** 설정에 의해 빈 **myapp** 데이터베이스가 먼저 생성되고, 이어서 백엔드 컨테이너가 켜질 때 **JPA가 Entity 클래스를 바탕으로 테이블을 자동 생성**합니다. 빈 `sql/` 폴더만 있는지만 확인(`mkdir -p ~/3tier-project/sql`)하고 바로 **5-3**으로 이동하세요.
- **방법 B (컨테이너가 켜질 때 초기 테이블·더미 데이터를 직접 넣고 싶은 경우)**  
  `~/3tier-project/sql/01-schema.sql` 파일을 생성하여 컨테이너 DB(**myapp**)에 실행할 SQL을 작성합니다:

```sql
-- ~/3tier-project/sql/01-schema.sql
USE myapp;

-- 예시: 초기 테이블 생성 및 샘플 데이터 추가
CREATE TABLE IF NOT EXISTS items (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(500),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO items (name, description) VALUES ('첫 번째 아이템', 'Docker MySQL 컨테이너 초기 데이터');
```

> [!TIP]
> **자체 보유 프로젝트(개인/팀 프로젝트)의 SQL을 사용하는 경우**  
> - 본인 프로젝트의 스키마/더미 데이터 SQL 파일이 있다면 `~/3tier-project/sql/` 폴더에 넣어두세요.  
> - 파일명 앞에 **01-schema.sql**, **02-data.sql**처럼 번호를 붙이면 MySQL 컨테이너가 알파벳 순서대로 실행합니다.  
> - 만약 SQL 파일 상단에 `CREATE DATABASE ...; USE ...;` 구문이 있다면, 그 데이터베이스 이름과 **.env** 파일의 **DB_NAME** 값을 반드시 똑같이 맞춰주세요.

---

### 5-3. docker-compose.yml 작성

3. 프로젝트 루트(`~/3tier-project/docker-compose.yml`)에 3개의 컨테이너(**frontend**, **backend**, **db**)를 정의하는 `docker-compose.yml` 파일을 생성합니다:

```yaml
# ~/3tier-project/docker-compose.yml
services:
  # ─── 1. 프론트엔드 (Nginx + Vue.js) ───
  frontend:
    build:
      context: ./my-frontend
      dockerfile: Dockerfile
    ports:
      - '80:80'
    depends_on:
      backend:
        condition: service_healthy
    restart: unless-stopped

  # ─── 2. 백엔드 (Spring Boot JAR / Spring Legacy WAR) ───
  backend:
    build:
      context: ./my-backend
      dockerfile: Dockerfile
    ports:
      - '8080:8080'
    env_file:
      - .env
    # [선택] 태스크 2-2에서 여행지 이미지(travel-image)를 준비한 경우 아래 2줄의 주석(#)을 해제하세요!
    # volumes:
    #   - ./travel-image:/tmp/upload/travel
    depends_on:
      db:
        condition: service_healthy
    healthcheck:
      test:
        [
          'CMD-SHELL',
          'curl -s http://localhost:8080/ > /dev/null || wget -q -O /dev/null http://localhost:8080/ || exit 1',
        ]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 40s
    restart: unless-stopped

  # ─── 3. 데이터베이스 (MySQL 8.0) ───
  db:
    image: mysql:8.0
    command: --local-infile=1
    environment:
      - MYSQL_ROOT_PASSWORD=${DB_PASSWORD}
      - MYSQL_DATABASE=${DB_NAME}
    ports:
      - '3306:3306'
    volumes:
      - db-data:/var/lib/mysql
      - ./sql:/docker-entrypoint-initdb.d
    healthcheck:
      test: ['CMD', 'mysqladmin', 'ping', '-h', 'localhost']
      interval: 5s
      timeout: 3s
      retries: 10
    restart: unless-stopped

volumes:
  db-data:
```

> [!NOTE]
> **docker-compose.yml 핵심 설정 한눈에 이해하기**
>
> - **build.context (`./my-frontend`, `./my-backend`)의 의미**  
>   태스크 3과 4에서는 직접 각 폴더(`cd my-backend`, `cd my-frontend`)로 들어가서 `docker build ... .`를 실행했습니다.  
>   반면 **docker-compose.yml**은 상위 폴더인 `~/3tier-project/`에 위치하므로, **"현재 위치(`~/3tier-project`)를 기준으로 `./my-frontend` 폴더와 `./my-backend` 폴더를 각각의 빌드 작업 폴더(컨텍스트)로 삼아 그 안의 Dockerfile로 빌드하라"**고 경로를 지정해 주는 것입니다.
> - **여행지 이미지 볼륨 마운트 (`./travel-image:/tmp/upload/travel`)와 OS별 경로 규칙**  
>   콜론(`:`)을 기준으로 **왼쪽은 내 로컬 PC 경로**, **오른쪽은 컨테이너 내부(Linux) 경로**입니다.  
>   - **왼쪽 (`./travel-image`)**: `docker-compose.yml`이 있는 폴더(`~/3tier-project`) 기준의 상대 경로이므로 **macOS와 Windows(WSL2/PowerShell) 모두 수정 없이 그대로 동작**합니다.  
>   - **오른쪽 (`/tmp/upload/travel`)**: 백엔드 컨테이너 내부는 Windows 사용자라도 무조건 **Linux 환경**이므로, 태스크 2-4에서 설정한 `upload.local.path=/tmp/upload` 하위의 `/tmp/upload/travel`로 연결됩니다.
> - **depends_on + condition: service_healthy (기동 순서 제어)**  
>   컨테이너 3개가 동시에 켜질 때 DB가 아직 준비되지 않았는데 백엔드가 먼저 접속을 시도하면 에러가 발생합니다. **healthcheck**와 **service_healthy**를 함께 사용하면 **① db 준비 완료 → ② backend 시작 및 준비 완료 → ③ frontend 시작** 순서로 안전하게 기동됩니다.
> - **백엔드 통합 healthcheck (`curl ... || wget ...`)**  
>   Spring Boot(JAR)와 Spring Legacy(WAR) 구분 없이, 컨테이너 내부의 **8080 포트 서버가 응답을 시작했는지**를 확인합니다 (HTTP 상태 코드가 404여도 서버가 켜진 것으로 판단하며, 베이스 이미지에 `curl` 또는 `wget` 중 어느 것이 있든 동작합니다).
> - **command: --local-infile=1 및 ./sql:/docker-entrypoint-initdb.d**  
>   MySQL 8.0 컨테이너가 처음 켜질 때 `sql/` 폴더의 초기화 스크립트들과 CSV 파일(**travel.csv** 등) 로드를 허용하는 옵션입니다.

✅ **태스크 완료** — 컨테이너 환경을 설정하는 `.env` 파일과 `docker-compose.yml` 작성을 완료했습니다.

---

## 태스크 6: 로컬 실행 및 동작 확인

📍 **실행 위치: 로컬 PC (`~/step9-docker/`)**

### 6-1. 전체 서비스 실행

1. docker-compose로 모든 서비스를 시작합니다:

```bash
docker-compose up -d --build
```

> [!NOTE]
> `--build`: 이미지를 새로 빌드합니다. 코드 변경 후에는 항상 이 플래그를 붙이세요.  
> `-d`: 백그라운드 실행. 로그를 바로 보려면 `-d` 없이 실행합니다.

2. 서비스 상태를 확인합니다:

```bash
docker-compose ps
```

> [!OUTPUT]
>
> ```
> NAME                STATUS              PORTS
> step9-docker-db-1        Up (healthy)    0.0.0.0:3306->3306/tcp
> step9-docker-backend-1   Up (healthy)    0.0.0.0:8080->8080/tcp
> step9-docker-frontend-1  Up             0.0.0.0:80->80/tcp
> ```

3. 모든 서비스가 `Up` 상태가 될 때까지 대기합니다 (DB → Backend → Frontend 순서로 시작):

```bash
# 로그 실시간 확인
docker-compose logs -f
```

> [!TIP]
> 첫 실행 시 MySQL 초기화 + Gradle 빌드에 시간이 걸립니다 (2~5분).  
> `docker-compose logs -f db`로 DB 초기화 진행 상황을 확인할 수 있습니다.

### 6-2. 동작 확인

4. 브라우저에서 `http://localhost` 접속합니다.

- Vue.js 화면이 정상적으로 표시되면 프론트엔드 성공

5. API 프록시를 테스트합니다:

```bash
# 백엔드 직접 접근 테스트
curl http://localhost:8080/api/boards

# Nginx 프록시를 통한 접근 테스트 (프로덕션과 동일한 경로)
curl http://localhost/api/boards
```

6. DB 연결을 확인합니다:

```bash
# MySQL 컨테이너에 직접 접속
docker-compose exec db mysql -u root -pdevpassword123 appdb -e "SHOW TABLES;"
```

> [!TROUBLESHOOTING]
> | 증상 | 원인 | 해결 방법 |
> |------|------|-----------|
> | frontend `502 Bad Gateway` | backend가 아직 시작 안 됨 | `docker-compose logs backend`로 확인, 30초 대기 |
> | backend 시작 후 즉시 종료 | DB 연결 실패 | `.env`의 `SPRING_DATASOURCE_URL` 확인, DB healthcheck 상태 확인 |
> | DB `Access denied` | 비밀번호 불일치 | `.env`의 `DB_PASSWORD`와 `SPRING_DATASOURCE_PASSWORD` 일치 확인 |
> | `port is already allocated` | 로컬에 이미 같은 포트 사용 중 | 로컬 MySQL/Nginx 종료 또는 ports 변경 (`"3307:3306"`) |
> | Nginx에서 API 프록시 실패 | `BACKEND_HOST` 환경변수 미설정 | docker-compose.yml에서 frontend의 environment 확인 |
> | `npm run build` 실패 | Node.js 버전 또는 의존성 문제 | 로컬에서 `cd frontend && npm ci && npm run build` 먼저 확인 |

### 6-3. 서비스 중지 및 정리

7. 모든 서비스를 중지합니다:

```bash
# 컨테이너 중지 + 삭제 (DB 데이터는 Volume에 유지)
docker-compose down

# DB 데이터까지 완전 초기화하려면:
docker-compose down -v
```

> [!NOTE]
> `docker-compose down`은 컨테이너만 삭제합니다. Named Volume(`db-data`)은 유지됩니다.  
> 다음에 `docker-compose up`하면 이전 DB 데이터가 그대로 있습니다.
>
> 완전히 초기화하려면 `-v` 플래그를 추가하세요 (Volume도 삭제).

✅ **태스크 완료** — 로컬에서 프론트 + 백엔드 + DB를 Docker로 실행하고 동작을 확인했습니다.

---

## 마무리

### 이번 세션에서 배운 것

- Dockerfile 작성 (백엔드: JAR/WAR, 프론트엔드: 멀티스테이지)
- Nginx 리버스 프록시 설정 (정적 파일 + API 프록시)
- docker-compose로 멀티 컨테이너 로컬 환경 구성
- 환경변수 분리 (.env)
- Docker healthcheck + depends_on 의존 관계 설정

### 다음 단계

**9-2: ECR Push + EC2 docker-compose 배포**에서는 이 이미지를 Amazon ECR에 Push하고, Amazon EC2 + Amazon RDS 환경에서 그대로 실행해봅니다.

> [!CONCEPT] 로컬에서 잘 돌아가는 이미지 = AWS에서도 동일하게 동작
> 이것이 Docker의 핵심 가치입니다. 로컬에서 검증한 이미지를 그대로 AWS에 올리면 됩니다.  
> 환경 차이로 인한 문제가 없습니다.

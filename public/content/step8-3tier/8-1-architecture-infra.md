---
title: '전체 아키텍처 설계 및 인프라 구축'
week: 8
session: 1
awsServices:
  - Amazon VPC
  - Amazon RDS
  - Amazon S3
learningObjectives:
  - 3-Tier 아키텍처의 전체 구성을 설계할 수 있습니다.
  - AWS CloudFormation으로 VPC, RDS, S3를 한 번에 구축할 수 있습니다.
  - 각 계층(프론트엔드, 백엔드, 데이터베이스)의 역할을 설명할 수 있습니다.
prerequisites:
  - Step 0~7 학습 완료 (권장)
  - GitHub 계정
estimatedCost: 크레딧 내 사용 가능 (비용 발생 가능)
---

이 실습에서는 Step 0~7에서 배운 모든 것을 통합하여 실제 3-Tier 웹 서비스를
완성합니다.  
전체 아키텍처를 설계하고, AWS CloudFormation으로 인프라를 한 번에
구축합니다.

> [!WARNING]
> 이 실습에서는 **시간당 비용이 발생하는 리소스**(NAT Gateway, ALB, Amazon RDS)를 생성합니다.  
> 실습 후 반드시 리소스를 정리하세요 (Step 8-5에서 안내).  
> 문서에 표시된 비용 금액은 **작성 시점 기준 참고 값**이며, 실제 요금은 리전, 환율, AWS 정책 변경에 따라 상이할 수 있습니다.

> [!CONCEPT] Step 0~7의 기술이 Step 8에서 어떻게 합쳐지는가?
>
> | 이전 Step | 배운 기술                    | Step 8에서의 역할                          |
> | --------- | ---------------------------- | ------------------------------------------ |
> | Step 1    | Amazon VPC, Subnet, SG       | 3-Tier 네트워크 기반 (Public/Private 분리) |
> | Step 2    | Amazon EC2                   | Spring Boot 백엔드 서버 실행               |
> | Step 3    | NAT Gateway                  | Private Subnet → 인터넷 통신 (패키지 설치) |
> | Step 4    | Amazon RDS                   | MySQL 데이터베이스 (Private Subnet 배치)   |
> | Step 5    | Amazon S3, Amazon CloudFront | Vue.js 프론트엔드 정적 호스팅 + CDN        |
> | Step 6    | SSM Parameter Store          | DB 비밀번호 안전하게 관리                  |
> | Step 7    | ALB, Route 53, ACM           | 로드밸런싱 + 커스텀 도메인 + HTTPS         |
>
> **Step 8에서 새로 배우는 것:**
>
> - AWS CloudFormation 스택 분리 전략 (계층별 독립 관리)
> - Cross-stack Reference (`Export`/`ImportValue`)
> - 프론트엔드/백엔드 별도 리포지토리 운영
> - Amazon CloudFront + 커스텀 도메인 HTTPS 연결
> - 전체 아키텍처를 한눈에 설계하고 구축하는 실무 경험

> [!NOTE]
> Step 8은 5개의 세션으로 구성됩니다:
>
> - 8-1: 아키텍처 설계 + 인프라 구축 (현재)
> - 8-2: Vue.js 프론트엔드 배포 (S3 + CloudFront)
> - 8-3: Spring Boot 백엔드 배포 (EC2 + ALB)
> - 8-4: 전체 연동 확인
> - 8-5: 전체 리소스 정리
>
> 8-1에서 생성하는 인프라(NAT Gateway, ALB, Amazon RDS)는 시간당 비용이 발생합니다.  
> 비용 절감을 위해 **8-1~8-5를 가능한 한 번에 연속 진행**하고, 완료 후 즉시 8-5에서 정리하는 것을 권장합니다.

---

## 태스크 1: 3-Tier 아키텍처 설계

### 3-Tier 아키텍처란?

웹 애플리케이션을 3개의 독립적인 계층으로 분리하는 설계 패턴입니다.
각 계층은 독립적으로 확장하고 관리할 수 있습니다.

| 계층                          | 역할               | 기술 스택    | AWS 서비스           | 실습 차시 |
| ----------------------------- | ------------------ | ------------ | -------------------- | --------- |
| **Presentation** (프론트엔드) | 사용자 인터페이스  | Vue.js (SPA) | S3 + CloudFront      | 8-2       |
| **Application** (백엔드)      | 비즈니스 로직, API | Spring Boot  | EC2 + ALB            | 8-3       |
| **Data** (데이터베이스)       | 데이터 저장/관리   | MySQL        | RDS (Private Subnet) | 8-1       |

### 전체 아키텍처 다이어그램

<img src="/images/step8/8-architecture.png" alt="Step 8 3-Tier 아키텍처" class="guide-img-lg" />

```
┌─────────────────────────────────────────────────────────────────┐
│                        사용자 브라우저                          │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  [CloudFront + S3]  ← Vue.js 정적 파일 (HTML/CSS/JS)            │
│  - CDN으로 전 세계 빠른 응답                                    │
│  - HTTPS 자동 적용                                              │
└─────────────────────────┬───────────────────────────────────────┘
                          │ API 호출 (axios)
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  [ALB (Application Load Balancer)]  ← HTTPS 종료, 트래픽 분산   │
│  - Public Subnet에 위치                                         │
│  - Health Check로 정상 인스턴스에만 라우팅                      │
└─────────────────────────┬───────────────────────────────────────┘
                          │ Port 8080
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  [EC2 - Spring Boot]  ← REST API 서버                           │
│  - Private Subnet에 위치 (ALB에서만 접근)                       │
│  - NAT Gateway를 통해 외부 패키지 설치                          │
│  - SSM Session Manager로 접속 (SSH 불필요)                      │
└─────────────────────────┬───────────────────────────────────────┘
                          │ Port 3306
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  [Amazon RDS MySQL]  ← 데이터 영구 저장                         │
│  - Private Subnet에 위치 (외부 접근 차단)                       │
│  - EC2 Security Group에서만 접근 허용                           │
└─────────────────────────────────────────────────────────────────┘
```

### 네트워크 설계

```
VPC (10.0.0.0/16)
├── Public Subnet 1  (10.0.1.0/24)  - AZ-a  → ALB, NAT GW
├── Public Subnet 2  (10.0.2.0/24)  - AZ-c  → ALB
├── Private Subnet 1 (10.0.11.0/24) - AZ-a  → EC2, RDS
└── Private Subnet 2 (10.0.12.0/24) - AZ-c  → EC2, RDS (Multi-AZ 대비)
```

### Security Group 설계

| Security Group | Inbound 규칙           | 용도                     |
| -------------- | ---------------------- | ------------------------ |
| ALB-SG         | 80, 443 from 0.0.0.0/0 | 외부 HTTP/HTTPS 허용     |
| EC2-SG         | 8080 from ALB-SG       | ALB에서만 앱 접근        |
| RDS-SG         | 3306 from EC2-SG       | Amazon EC2에서만 DB 접근 |

> [!CONCEPT] 3-Tier 아키텍처의 장점
>
> - **보안**: 데이터베이스를 Private Subnet에 격리하여 외부 접근을 차단합니다.
> - **확장성**: 각 계층을 독립적으로 스케일링할 수 있습니다 (프론트엔드는 CDN, 백엔드는 Auto Scaling).
> - **유지보수**: 프론트엔드와 백엔드를 독립적으로 배포할 수 있습니다.
> - **비용 최적화**: 정적 파일은 S3+CloudFront로 서빙하여 Amazon EC2 부하를 줄입니다.

### 사용할 GitHub 리포지토리 구조

```
my-frontend/          ← Vue.js 프로젝트
├── src/
├── public/
├── .github/workflows/deploy.yml
├── package.json
└── vite.config.js

my-backend/           ← Spring Boot 프로젝트
├── src/main/java/
├── src/main/resources/application.yml
├── .github/workflows/deploy.yml
├── build.gradle
└── settings.gradle
```

✅ **태스크 완료** — 3-Tier 아키텍처를 설계하고 각 계층의 역할과 AWS 서비스를 매핑했습니다.

---

## 태스크 2: GitHub Personal Access Token (PAT) 발급

GitHub는 2021년부터 비밀번호 인증을 차단하고 **Personal Access Token(PAT)** 또는 SSH 키를 통한 인증만 허용합니다.  
로컬에서 `git push`하려면 PAT이 필요합니다.

> [!CONCEPT] GitHub 인증 방식
> GitHub에서 코드를 push하려면 본인 확인이 필요합니다.  
> 비밀번호 대신 **토큰**(긴 문자열)을 사용하여 인증합니다.  
> 토큰은 비밀번호보다 안전합니다 (만료 기간 설정, 권한 제한, 언제든 폐기 가능).
>
> 인증(push 권한)과 커밋 author(이름 표시)는 별개입니다.  
> 자세한 내용은 Step 8-0 이론의 "GitHub 인증과 Git 커밋 author" 섹션을 참고하세요.

### PAT 발급

이 실습에서는 설정이 간단한 **Classic** 토큰을 사용합니다.

1. [GitHub](https://github.com)에 로그인합니다.
2. 우측 상단 프로필 아이콘을 클릭합니다.
3. **Settings**를 클릭합니다.
   <img src="/images/step8/8-1-step3-github-settings.png" alt="GitHub Settings 메뉴" class="guide-img-sm" />

4. 왼쪽 메뉴 맨 아래 **Developer settings**를 클릭합니다.
   <img src="/images/step8/8-1-step4-developer-settings.png" alt="Developer settings 메뉴" class="guide-img-sm" />
5. **Personal access tokens** → **Tokens (classic)**을 클릭합니다.
   <img src="/images/step8/8-1-step5-tokens-classic.png" alt="Tokens classic 메뉴" class="guide-img-sm" />
6. [[Generate new token]] → **Generate new token (classic)**을 클릭합니다.
   <img src="/images/step8/8-1-step6-generate-token.png" alt="Generate new token classic" class="guide-img-sm" />

> [!TIP]
> GitHub는 **Fine-grained token**(세분화 토큰)도 제공합니다.  
> Fine-grained는 특정 레포만 접근 허용, 권한을 더 세밀하게 제어할 수 있어 보안상 권장됩니다.  
> 하지만 설정이 복잡하므로 이 실습에서는 Classic을 사용합니다.

7. 다음과 같이 설정합니다:
   - **Note**: `3tier-project` (용도 메모)
   - **Expiration**: `90 days` (또는 본인이 원하는 기간)
   - **Select scopes**:
     - ✅ `repo` 체크 (전체 레포 접근 권한)
     - ✅ `workflow` 체크 (GitHub Actions 워크플로우 파일 push에 필요)
     - ✅ `read:org` 체크 (admin:org 하위 항목, `gh auth login`에 필요)
       <img src="/images/step8/8-1-step7-token-settings.png" alt="PAT 설정 화면" class="guide-img-md" />

8. [[Generate token]] 버튼을 클릭합니다.
   <img src="/images/step8/8-1-step8-generate-token.png" alt="Generate token 버튼" class="guide-img-sm" />
9. 생성된 토큰(`ghp_` 또는 `github_pat_`으로 시작)을 **즉시 복사**하여 안전한 곳에 저장합니다.

> [!WARNING]
> 토큰은 이 화면에서만 확인할 수 있습니다. 페이지를 닫으면 다시 볼 수 없습니다.  
> 분실 시 해당 토큰의 [[Regenerate token]]을 클릭하면 새 값으로 재발급됩니다 (기존 토큰은 즉시 무효화).

### 로컬 Git에 토큰 설정

GitHub CLI(`gh`)를 사용하면 브라우저 인증 한 번으로 설정이 완료됩니다.

> [!NOTE]
> 아래 10~11번은 태스크 3에서 레포를 클론한 후에 실행합니다.  
> 지금은 PAT을 안전한 곳에 저장해두고, GitHub CLI 설치까지만 진행하세요.

**방법 1: GitHub CLI 사용 (권장)**

10. [GitHub CLI](https://cli.github.com/)를 설치합니다:

```bash
# macOS
brew install gh

# Windows (winget)
winget install --id GitHub.cli

# Linux (apt)
sudo apt install gh
```

> [!NOTE]
> Windows에서 설치 후 **터미널을 닫고 다시 열어야** `gh` 명령이 인식됩니다.

📌 **Windows (PowerShell/CMD)**
<img src="/images/step8/8-1-step10-gh-auth-windows.png" alt="gh auth login - Windows" class="guide-img-sm" />

📌 **macOS (Terminal)**
<img src="/images/step8/8-1-step10-gh-auth-mac.png" alt="gh auth login - macOS" class="guide-img-sm" />

11. GitHub 인증을 실행합니다:

```bash
gh auth login
```

<img src="/images/step8/8-1-step11-gh-auth-login.png" alt="gh auth login 실행" class="guide-img-sm" />

12. 대화형 프롬프트에서 다음을 선택합니다:
    - **What account do you want to log into?** → `GitHub.com`
    - **What is your preferred protocol for Git operations?** → `HTTPS`
    - **Authenticate Git with your GitHub credentials?** → `Yes`
    - **How would you like to authenticate GitHub CLI?** → `Paste an authentication token`
    - 9번에서 복사한 PAT을 붙여넣습니다.

13. 인증 상태를 확인합니다:

```bash
gh auth status
```

> [!OUTPUT]
>
> ```
> github.com
>   ✓ Logged in to github.com account <YOUR_USERNAME> (keyring)
>   - Active account: true
>   - Git operations protocol: https
>   - Token: ghp_****
>   - Token scopes: 'read:org', 'repo', 'workflow'
> ```
>
> `✓ Logged in` 메시지가 표시되면 성공입니다.  
> 이후 `git push`, `git clone`(Private) 시 인증 없이 바로 동작합니다.
>
> <img src="/images/step8/8-1-step13-gh-auth-status.png" alt="gh auth status 결과" class="guide-img-sm" />

> [!TIP]
> **계정을 전환하거나 로그아웃하고 싶은 경우:**
>
> ```bash
> gh auth logout
> ```
>
> 이후 `gh auth login`으로 다른 계정으로 재인증할 수 있습니다.

**방법 2: remote URL에 토큰 직접 포함 (GitHub CLI 설치가 어려운 경우)**

> [!NOTE]
> 이 방법은 태스크 3에서 레포를 클론한 후에 실행합니다.

클론한 레포의 remote URL에 PAT을 포함시킵니다:

```bash
cd ~/3tier-project/my-backend
git remote set-url origin https://<YOUR_USERNAME>:<발급한-토큰>@github.com/<YOUR_USERNAME>/my-backend.git

cd ~/3tier-project/my-frontend
git remote set-url origin https://<YOUR_USERNAME>:<발급한-토큰>@github.com/<YOUR_USERNAME>/my-frontend.git
```

설정 확인:

```bash
git remote -v
```

> [!WARNING]
> 방법 2는 `.git/config`에 토큰이 평문으로 저장됩니다.  
> 공용 PC에서는 작업 후 토큰을 제거하세요:
>
> ```bash
> # 토큰 제거 (URL에서 인증 정보 삭제)
> git remote set-url origin https://github.com/<YOUR_USERNAME>/my-backend.git
>
> # 로컬 user 설정 제거 (글로벌 설정으로 복원)
> git config --unset user.name
> git config --unset user.email
> ```

> [!TIP]
> **커밋 author를 변경하고 싶은 경우:**
>
> ```bash
> cd ~/3tier-project/my-backend
> git config user.name "<YOUR_USERNAME>"
> git config user.email "<YOUR_EMAIL>"
> ```

✅ **태스크 완료** — GitHub PAT을 발급하고 로컬 Git 인증을 설정했습니다.

---

## 태스크 3: GitHub 리포지토리 2개 생성

프론트엔드와 백엔드를 별도 리포지토리로 관리합니다.

> [!NOTE]
> **소스 코드 옵션을 선택하세요:**
>
> | 옵션                           | 대상                                             | 설명                                         |
> | ------------------------------ | ------------------------------------------------ | -------------------------------------------- |
> | **옵션 A: 기존 프로젝트 사용** | Step 2~6에서 만든 Spring Boot/Vue.js가 있는 경우 | 기존 코드를 그대로 사용하거나 새 레포에 복사 |
> | **옵션 B: 새로 시작**          | 처음부터 만들거나 기존 코드가 없는 경우          | 이 가이드에서 제공하는 보일러플레이트 사용   |
>
> 어떤 옵션이든 최종 결과물(3-Tier 연동)은 동일합니다.

> [!TIP]
> **옵션 A (기존 프로젝트)를 선택한 경우:**
>
> - 팀 내 기존 GitHub 레포가 있다면 그대로 사용합니다 (3-1, 3-2 건너뛰기 가능).
> - 개인 로컬 프로젝트만 있다면 3-1, 3-2에서 새 레포를 생성하고, 3-4에서 코드를 옮깁니다.
> - 이후 태스크에서 DB 접속 정보나 API URL만 환경에 맞게 변경하면 됩니다.
> - Step 8-3에서 Amazon RDS 연동 코드와 CORS 설정만 추가/확인합니다.
>
> **옵션 B (새로 시작)를 선택한 경우:**
>
> - 아래 가이드를 따라 레포를 생성합니다.
> - Step 8-2에서 Vue.js 프로젝트를, Step 8-3에서 Spring Boot 프로젝트를 처음부터 생성합니다.
> - 3-4는 건너뛰세요.

### 3-1. 🎨 my-frontend 리포지토리 생성

> [!WARNING]
> 이 태스크의 명령어에서 `<>` 로 감싼 부분은 본인 환경에 맞게 변경해야 합니다:
>
> - `<YOUR_USERNAME>`: 본인 GitHub 사용자명 (예: `hong123`)
> - `<TEAM_ORG>`: 팀/조직 GitHub 계정명 (예: `my-team-org`)
> - `<기존-백엔드-레포명>`, `<기존-프론트엔드-레포명>`: 기존 GitHub 레포 이름 (예: `scoula-backend`)
> - `<기존-백엔드-프로젝트-경로>`: 로컬 기존 프로젝트 폴더 경로 (예: `~/projects/my-spring-app`)
> - `~/3tier-project`: 작업 디렉토리 경로. 본인이 원하는 위치로 변경 가능 (예: `~/workspace`, `~/dev`)

14. [GitHub](https://github.com)에 로그인합니다.
15. 우측 상단 `+` → [[New repository]]를 클릭합니다 (또는 [https://github.com/new](https://github.com/new) 접속).
    <img src="/images/step8/8-1-step15-cloudshell.png" alt="New repository 생성" class="guide-img-sm" />
16. 다음과 같이 설정합니다:
    - **Repository name**: `my-frontend`
    - **Description**: `Vue.js Frontend for 3-Tier App`
    - **Visibility**: Public (GitHub Actions 무료 사용)
    - **Add a README file**: 토글 ON
    - **.gitignore template**: `Node` 선택
      <img src="/images/step8/8-1-step16-repo-settings.png" alt="Repository 설정" class="guide-img-sm" />

17. [[Create repository]]를 클릭합니다.
    <img src="/images/step8/8-1-step17-create-repo.png" alt="Create repository 완료" class="guide-img-sm" />

### 3-2. ⚙️ my-backend 리포지토리 생성

18. 같은 방식으로 두 번째 리포지토리를 생성합니다:
    - **Repository name**: `my-backend`
    - **Description**: `Spring Boot Backend for 3-Tier App`
    - **Visibility**: Public
    - **Add a README file**: 토글 ON
    - **.gitignore template**: `Gradle` 선택
      <img src="/images/step8/8-1-step18-backend-repo.png" alt="Backend repository 설정" class="guide-img-sm" />

19. [[Create repository]]를 클릭합니다.
    <img src="/images/step8/8-1-step19-create-backend.png" alt="Backend repository 생성 완료" class="guide-img-sm" />

### 3-3. 로컬에 클론

> [!NOTE]
> 3-4의 경우 1(팀 레포 그대로 사용) 또는 경우 1-1(Fork)을 선택한 경우,  
> 해당 단계에서 클론을 진행하므로 이 단계는 건너뛰세요.

20. 작업 디렉토리를 생성합니다:

```bash
mkdir ~/3tier-project && cd ~/3tier-project
```

<img src="/images/step8/8-1-step20-clone-repo.png" alt="작업 디렉토리 생성" class="guide-img-sm" />

21. 프론트엔드 레포를 클론합니다:

```bash
git clone https://github.com/<YOUR_USERNAME>/my-frontend.git
```

22. 백엔드 레포를 클론합니다:

```bash
git clone https://github.com/<YOUR_USERNAME>/my-backend.git
```

<img src="/images/step8/8-1-step22-git-config.png" alt="Git clone 완료" class="guide-img-sm" />

> [!TIP]
> 리포지토리를 Public으로 생성하면 GitHub Actions를 무제한 무료로 사용할 수 있습니다.  
> Private 리포지토리는 월 2,000분까지 무료입니다.

> [!TIP]
> **클론 후 로컬 Git 설정을 확인하세요.**  
> 여러 GitHub 계정을 사용하는 경우 커밋 author가 의도한 계정인지 확인합니다:
>
> ```bash
> cd ~/3tier-project/my-backend
> git config user.name   # 현재 설정 확인
> git config user.email  # 현재 설정 확인
> ```
>
> 다른 계정으로 표시되면 로컬 설정을 변경하세요 (태스크 2 참고):
>
> ```bash
> git config user.name "<YOUR_USERNAME>"
> git config user.email "<YOUR_EMAIL>"
> ```

> [!NOTE]
> 태스크 2에서 **방법 2(remote URL에 토큰 포함)**를 선택한 경우, 여기서 설정합니다:
>
> ```bash
> git remote set-url origin https://<YOUR_USERNAME>:<발급한-토큰>@github.com/<YOUR_USERNAME>/my-backend.git
> ```

### 3-4. 기존 프로젝트를 레포에 연결 (옵션 A)

> [!NOTE]
> 옵션 B(새로 시작)를 선택한 경우 이 단계를 건너뛰세요.

23. 본인 상황을 확인하고 아래 3가지 중 하나를 선택합니다:

| 상황                                                                   | 선택         | 3-1~3-3 필요 여부      | 설명                               |
| ---------------------------------------------------------------------- | ------------ | ---------------------- | ---------------------------------- |
| **경우 1**: 팀 내 기존 GitHub 레포가 있다                              | 아래 28~29번 | ❌ 건너뛰기            | 기존 레포를 그대로 사용하거나 Fork |
| **경우 2**: 개인 로컬 프로젝트가 있다 (기존 레포를 건드리고 싶지 않다) | 아래 28~29번 | ✅ 필요 (클론 후 복사) | 파일만 복사                        |
| **경우 3**: 개인 로컬 프로젝트가 있다 (이력을 옮기고 싶다)             | 아래 28~29번 | ❌ 건너뛰기            | 원격 주소 변경                     |

**경우 1: 팀 레포가 있는 경우**

24. 팀 레포를 그대로 사용하려면 기존 URL로 클론합니다 (3-1~3-3 건너뛰기 가능):

```bash
cd ~/3tier-project
git clone https://github.com/<TEAM_ORG>/<기존-백엔드-레포명>.git my-backend
git clone https://github.com/<TEAM_ORG>/<기존-프론트엔드-레포명>.git my-frontend
```

25. 팀 레포와 분리하고 싶다면 Fork 또는 수동 복사를 합니다:

```bash
# 방법 A: GitHub Fork (팀 레포 페이지 → 우측 상단 [[Fork]] → 본인 계정에 복사)
git clone https://github.com/<YOUR_USERNAME>/<기존-백엔드-레포명>.git my-backend

# 방법 B: 수동 복사 (완전 분리)
git clone https://github.com/<TEAM_ORG>/<기존-백엔드-레포명>.git temp-backend
cp -r temp-backend/* ~/3tier-project/my-backend/
cp temp-backend/.gitignore ~/3tier-project/my-backend/
rm -rf temp-backend
cd ~/3tier-project/my-backend
git add .
git commit -m "feat: initial project from team repo"
git push origin main
```

> [!TIP]
>
> - **Fork**: 원본 레포와 연결 유지, PR로 원본에 기여 가능, 이력 보존
> - **수동 복사**: 완전히 독립된 레포, 원본과 관계 없음, 이력 없이 새로 시작

**경우 2: 로컬 프로젝트를 새 레포로 복사하는 경우**

26. 3-3에서 클론한 디렉토리에 기존 소스 파일을 복사합니다 (`.git` 제외):

```bash
cd ~/3tier-project/my-backend
rsync -av --exclude='.git' --exclude='build' --exclude='.gradle' \
  <기존-백엔드-프로젝트-경로>/ .
```

<img src="/images/step8/8-1-step26-push-frontend.png" alt="소스 파일 복사" class="guide-img-sm" />

27. push 전에 `.gitignore`를 확인합니다.  
    불필요한 파일(`build/`, `node_modules/`, `.env.local` 등)이 포함되지 않도록 3-5를 먼저 확인한 후 커밋합니다:

```bash
git add .
git commit -m "feat: initial backend project"
git push origin main
```

<img src="/images/step8/8-1-step27-push-backend.png" alt="git push 완료" class="guide-img-sm" />

<img src="/images/step8/8-1-step27-push-result.png" alt="push 결과 확인" class="guide-img-sm" />

> [!TIP]
> 프론트엔드도 같은 방식으로 진행합니다:
>
> ```bash
> cd ~/3tier-project/my-frontend
> rsync -av --exclude='.git' --exclude='node_modules' --exclude='dist' \
>   <기존-프론트엔드-프로젝트-경로>/ .
> git add .
> git commit -m "feat: initial frontend project"
> git push origin main
> ```

**경우 3: 기존 로컬 프로젝트의 원격 주소를 변경하는 경우**

28. 기존 프로젝트 디렉토리에서 원격 주소를 새 레포로 변경합니다:

```bash
cd <기존-백엔드-프로젝트-경로>
git remote -v                    # 현재 원격 주소 확인
git remote set-url origin https://github.com/<YOUR_USERNAME>/my-backend.git
```

29. 새 레포에 push합니다:

```bash
git push origin main --force
```

> [!WARNING]
> `--force` push는 원격 레포의 기존 커밋(README, .gitignore)을 덮어씁니다.  
> 새로 생성한 빈 레포에만 사용하세요. 팀원이 이미 작업 중인 레포에는 절대 사용하지 마세요.

### 3-5. .gitignore와 환경 변수 설정 확인

GitHub에서 레포 생성 시 선택한 `.gitignore` 템플릿(Node, Gradle)은 환경 변수 파일을 자동으로 무시합니다.  
배포에 필요한 설정 파일이 누락되지 않도록 확인합니다.

> [!TIP]
> 기존 프로젝트에 이미 `.gitignore`가 있는 경우, GitHub에서 생성된 것과 **병합**하세요.  
> 기존 `.gitignore`에 아래 항목이 없다면 추가합니다.  
> GitHub에서 생성된 `.gitignore`와 중복되는 항목은 그대로 두면 됩니다.

**⚙️ 백엔드 — `.gitignore` 확인:**

30. `.gitignore` 파일을 열고 다음이 포함되어 있는지 확인합니다:

```gitignore
# Gradle 기본 .gitignore에 포함된 항목
.gradle/
build/
!gradle/wrapper/gradle-wrapper.jar

# 환경 변수 / 비밀값 (추가 권장)
.env
application-local.yml
```

31. `application.yml`(또는 `application.properties`)은 `.gitignore`에 **포함하지 않습니다**:
    - DB 접속 정보는 환경 변수(`${DB_ENDPOINT}`)로 주입하므로 코드에 비밀값이 없습니다.
    - 환경 변수 값 자체는 SSM Parameter Store에서 관리합니다.

> [!NOTE]
> `application.yml`에 하드코딩된 비밀번호가 있다면 환경 변수로 교체한 후 push하세요.  
> Step 8-3 태스크 2에서 SSM Parameter Store를 사용하여 비밀값을 안전하게 관리합니다.

**🎨 프론트엔드 — `.gitignore` 확인:**

32. `.gitignore`에 다음이 포함되어 있는지 확인합니다:

```gitignore
# Node 기본 .gitignore에 포함된 항목
node_modules/
dist/

# 환경 변수 (로컬 개발용만 무시)
.env.local
.env.*.local
```

33. `.env.development`와 `.env.production`의 git 포함 여부를 결정합니다:
    - API URL만 있고 민감 정보가 없다면 → git에 포함해도 됩니다.
    - API 키 등 민감 정보가 있다면 → `.gitignore`에 추가하고, GitHub Secrets로 빌드 시 주입합니다 (Step 8-2 태스크 6 참조).

> [!WARNING]
> Vue.js의 `VITE_` 환경 변수는 빌드 후 JS 파일에 포함되어 **브라우저에서 볼 수 있습니다.**  
> DB 비밀번호, 서버 시크릿 같은 값은 프론트엔드에 절대 넣지 마세요 (백엔드에서 처리).

> [!WARNING]
> `.env.local`은 로컬 전용이므로 git에 포함하지 않습니다.  
> `.env.production`은 민감 정보가 없다면 git에 포함해도 됩니다.  
> 민감 정보(API 키 등)가 있다면 `.gitignore`에 추가하고 GitHub Secrets로 빌드 시 주입하세요 (Step 8-2 태스크 6 참조).

34. 설정 확인 후 커밋합니다:

> [!NOTE]
> **처음 push할 때** Username/Password 프롬프트가 뜰 수 있습니다:
>
> ```
> Username for 'https://github.com': <YOUR_USERNAME>
> Password for 'https://<YOUR_USERNAME>@github.com': (여기에 PAT 붙여넣기)
> ```
>
> - Password에는 GitHub 비밀번호가 아닌 **태스크 2에서 발급한 PAT**을 붙여넣습니다.
> - 입력 시 화면에 아무것도 표시되지 않는 것이 정상입니다 (비밀번호 마스킹).
> - macOS에서는 "키체인에 저장하시겠습니까?" 팝업이 뜰 수 있습니다. **허용**하면 이후 자동 인증됩니다.
> - `gh auth login`(방법 1)으로 인증한 경우 프롬프트 없이 바로 push됩니다.

> [!TIP]
> **macOS 키체인 확인 방법:**  
> Spotlight(⌘+Space)에서 `키체인 접근` 검색 → `github.com` 항목이 있으면 저장된 credential 확인 가능.
>
> <img src="/images/step8/8-1-step34-keychain-tip.png" alt="macOS 키체인 확인" class="guide-img-sm" />

```bash
# 백엔드
cd ~/3tier-project/my-backend

# .gitignore에 추가한 파일이 이미 git에 트래킹되어 있다면 캐시 제거
git rm -r --cached .
git add .
git commit -m "chore: apply updated .gitignore"
git push origin main

# 프론트엔드
cd ~/3tier-project/my-frontend
git rm -r --cached .
git add .
git commit -m "chore: apply updated .gitignore"
git push origin main
```

> [!NOTE]
> `git rm -r --cached .`는 git 추적 목록만 초기화합니다 (로컬 파일은 삭제되지 않습니다).  
> `.gitignore`에 새로 추가한 파일(`.env.production`, `build/` 등)이 이후 커밋에서 제외됩니다.
>
> <img src="/images/step8/8-1-step34-git-cached.png" alt="git rm --cached 실행 결과" class="guide-img-sm" />

> [!NOTE]
> 환경 변수(DB 접속 정보, API URL 등)의 실제 값 설정과 관리 방법은 이후 세션에서 다룹니다:
>
> - **백엔드**: Step 8-3 태스크 2(SSM Parameter Store) 및 태스크 6(GitHub Secrets로 `application.properties` 주입)
> - **프론트엔드**: Step 8-2 태스크 2(`.env.production` 작성) 및 태스크 6(GitHub Secrets로 `VITE_API_URL` 주입)
>
> 지금은 `.gitignore` 설정만 확인하고 넘어가세요.

> [!WARNING]
> 기존 프로젝트에서 민감 정보(DB 비밀번호, API 키 등)를 제거하고 push한 경우, **현재 상태로는 배포해도 앱이 정상 동작하지 않습니다** (환경 변수가 비어있으므로).  
> 이후 Step 8-2(프론트), 8-3(백엔드)에서 GitHub Secrets 또는 SSM Parameter Store로 환경 변수를 주입하는 설정을 완료하면 정상 동작합니다.

✅ **태스크 완료** — GitHub에 `my-frontend`와 `my-backend` 리포지토리를 생성했습니다.

---

## 태스크 4: AWS CloudFormation으로 인프라 한 번에 구축

Step 0~7에서 수동으로 만들었던 모든 인프라를 AWS CloudFormation 하나로 자동 구축합니다.

> [!DOWNLOAD]
> [step8-3tier-infra.zip](/files/step8/step8-3tier-infra.zip)
>
> - `step8-network.yaml` — 네트워크 스택 (VPC, 서브넷, IGW, NAT Gateway(옵션), RT, Security Groups)
> - `step8-data.yaml` — 데이터 스택 (DB Parameter Group, DB Subnet Group, Amazon RDS MySQL)
> - `step8-frontend.yaml` — 프론트엔드 스택 (Amazon S3 버킷, 정적 호스팅)
> - `step8-backend.yaml` — 백엔드 스택 (ALB, Target Group, Listener)
> - `README.md` — 템플릿 파라미터 및 사용 방법 안내

> [!NOTE]
> 이 템플릿들은 다음 리소스를 4개 스택으로 나누어 생성합니다:
>
> - **Network**: Amazon VPC (10.0.0.0/16), Public/Private Subnet 4개, IGW, NAT Gateway(옵션), RT, Security Groups
> - **Data**: DB Parameter Group (timezone Asia/Seoul), DB Subnet Group, Amazon RDS MySQL
> - **Frontend**: Amazon S3 버킷 (정적 웹 호스팅)
> - **Backend**: ALB, Target Group, Listener

### 4-1. Network 스택 생성 (VPC + 서브넷 + SG)

이 스택은 VPC, Public/Private Subnet 4개, Internet Gateway, NAT Gateway(옵션), Route Table, Security Group 3개를 생성합니다.

35. 상단 검색창에 `CloudFormation`을 입력하고 **CloudFormation** 서비스를 선택합니다.
36. [[Create stack]] 드롭다운을 클릭한 후 **With new resources (standard)**를 선택합니다.
37. **Prerequisite - Prepare template**에서 `Choose an existing template`을 선택합니다.
    <img src="/images/step8/8-1-step37-cloudformation.png" alt="CloudFormation 템플릿 설정" class="guide-img-sm" />
38. **Specify template**에서 `Upload a template file`을 선택합니다.
39. [[Choose file]] 버튼을 클릭하고 다운로드한 `step8-network.yaml` 파일을 선택합니다.
40. [[Next]] 버튼을 클릭합니다.
41. **Stack name**에 `step8-network`를 입력합니다.
    <img src="/images/step8/8-1-step41-stack-name.png" alt="Stack name 입력" class="guide-img-sm" />
42. **Parameters** 섹션에서 다음을 설정합니다:

| 파라미터         | 값             | 설명                                               |
| ---------------- | -------------- | -------------------------------------------------- |
| ProjectName      | `my-3tier-app` | 리소스 이름 접두사 (4개 스택 모두 동일하게)        |
| CreateNATGateway | `Yes`          | Private Subnet 인터넷 접근 필요 시 Yes (비용 발생) |
| 나머지           | 기본값 유지    | CIDR 변경 불필요                                   |

> [!WARNING]
> **ProjectName은 4개 스택 모두 반드시 동일한 값**이어야 합니다.  
> 이 값으로 Cross-stack Reference(Export/Import)가 연결됩니다.  
> 하나라도 다르면 "No export named..." 에러로 스택 생성이 실패합니다.

> [!TIP]
> **CreateNATGateway를 `No`로 설정하면:**
> NAT Gateway 시간당 비용($0.045/h + 데이터 처리)을 절약할 수 있습니다.  
> 단, Private Subnet의 Amazon EC2에서 인터넷 접근(패키지 설치, SSM)이 불가합니다.  
> 이 실습에서는 `Yes`를 권장합니다.

43. [[Next]] 버튼을 클릭합니다.
44. **Configure stack options** 페이지에서 추가 설정 없이 [[Next]] 버튼을 클릭합니다.
    <img src="/images/step8/8-1-step44-configure-options.png" alt="Configure stack options" class="guide-img-sm" />
45. **Review and create** 페이지에서 Stack name, Parameters 설정 내용을 확인합니다.
    <img src="/images/step8/8-1-step45-review.png" alt="Review and create" class="guide-img-sm" />
46. [[Submit]] 버튼을 클릭합니다.
    <img src="/images/step8/8-1-step46-submit.png" alt="Submit 클릭" class="guide-img-sm" />
47. **Events** 탭에서 리소스 생성 진행 상태를 확인합니다.
48. Status가 `CREATE_COMPLETE`로 변경될 때까지 기다립니다 (약 2~3분).

> [!OUTPUT]
> Stacks 목록에서 `step8-network`의 Status가 `CREATE_COMPLETE` (녹색)로 표시됩니다.  
> Events 탭에서 VPC, Subnet, IGW, NAT Gateway, Route Table, Security Group 등이 순서대로 생성된 것을 확인할 수 있습니다.

### 4-2. Data 스택 생성 (Amazon RDS)

이 스택은 DB Parameter Group(timezone Asia/Seoul, utf8mb4), DB Subnet Group, Amazon RDS MySQL 인스턴스를 생성합니다.

> [!WARNING]
> Network 스택이 `CREATE_COMPLETE` 상태여야 Data 스택을 생성할 수 있습니다.  
> Network 스택의 Export 값을 Import하기 때문입니다.

49. Stacks 목록으로 돌아가서 [[Create stack]] 드롭다운 → **With new resources (standard)**를 선택합니다.
    <img src="/images/step8/8-1-step49-stack-complete.png" alt="Network 스택 생성 완료" class="guide-img-sm" />
50. `Upload a template file` → `step8-data.yaml` 파일을 선택합니다.
    <img src="/images/step8/8-1-step50-data-template.png" alt="Data 스택 템플릿 업로드" class="guide-img-sm" />
51. [[Next]] 버튼을 클릭합니다.
52. **Stack name**에 `step8-data`를 입력합니다.
    <img src="/images/step8/8-1-step52-data-params.png" alt="Data 스택 이름 및 Parameters" class="guide-img-sm" />
53. **Parameters** 섹션에서 다음을 설정합니다:

| 파라미터         | 값               | 설명                               |
| ---------------- | ---------------- | ---------------------------------- |
| ProjectName      | `my-3tier-app`   | Network 스택과 동일해야 함         |
| DBName           | `myapp`          | 초기 데이터베이스 이름 (자동 생성) |
| DBMasterUsername | `admin`          | Amazon RDS 관리자 계정             |
| DBMasterPassword | `MyPassword123!` | Amazon RDS 비밀번호 (8자 이상)     |
| DBInstanceClass  | `db.t3.micro`    | Amazon RDS 인스턴스 타입           |

> [!WARNING]
> DBMasterPassword는 실습용으로 간단하게 설정하지만, 실제 프로젝트에서는 **반드시 강력한 비밀번호**를 사용하세요.  
> 이 비밀번호는 Step 8-3에서 SSM Parameter Store에 저장하여 안전하게 관리합니다.

54. [[Next]] 버튼을 클릭합니다.
55. **Configure stack options** 페이지에서 [[Next]] 버튼을 클릭합니다.
    <img src="/images/step8/8-1-step55-data-complete.png" alt="Data 스택 Configure options" class="guide-img-sm" />
56. **Review and create** 페이지에서 설정을 확인합니다.  
    (DBMasterPassword는 `****`로 마스킹되어 표시되므로 입력 시 정확히 입력했는지 유의)
    <img src="/images/step8/8-1-step56-frontend-stack.png" alt="Data 스택 Review" class="guide-img-sm" />
57. [[Submit]] 버튼을 클릭합니다.
    <img src="/images/step8/8-1-step57-frontend-complete.png" alt="Data 스택 Submit" class="guide-img-sm" />
58. Status가 `CREATE_COMPLETE`가 될 때까지 기다립니다 (약 **8~10분**, Amazon RDS 생성 소요).

> [!TIP]
> Amazon RDS 생성이 가장 오래 걸립니다 (약 8~10분).  
> 이 시간 동안 Frontend 스택과 Backend 스택을 먼저 생성할 수 있습니다.  
> Frontend 스택은 Network에 의존하지 않으므로 Data와 동시에 생성 가능합니다.

### 4-3. Frontend 스택 생성 (Amazon S3)

이 스택은 Amazon S3 버킷(정적 웹 호스팅 활성화, Public Read 정책 포함)을 생성합니다.

> [!NOTE]
> Frontend 스택은 VPC와 독립적입니다 (Amazon S3는 글로벌 서비스).  
> Network 스택 완료를 기다릴 필요 없이 바로 생성할 수 있습니다.

59. [[Create stack]] 드롭다운 → **With new resources (standard)**를 선택합니다.
    <img src="/images/step8/8-1-step59-frontend-create.png" alt="Frontend 스택 생성" class="guide-img-sm" />
60. `Upload a template file` → `step8-frontend.yaml` 파일을 선택합니다.
    <img src="/images/step8/8-1-step60-frontend-params.png" alt="Frontend 템플릿 업로드" class="guide-img-sm" />
61. [[Next]] 버튼을 클릭합니다.
62. **Stack name**에 `step8-frontend`를 입력합니다.
    <img src="/images/step8/8-1-step62-backend-create.png" alt="Frontend Stack name 입력" class="guide-img-sm" />
63. **Parameters** 섹션에서 다음을 설정합니다:
    - **ProjectName**: `my-3tier-app` (4개 스택 모두 동일)
    - **BucketSuffix**: 본인만의 고유한 값 입력 (예: `hong01`, `myname-dev`).  
      S3 버킷 이름은 전 세계에서 고유해야 하므로 이니셜+번호 등을 사용합니다.
64. [[Next]] 버튼을 클릭합니다.
65. **Configure stack options** 페이지에서 [[Next]] 버튼을 클릭합니다.
    <img src="/images/step8/8-1-step65-backend-params.png" alt="Frontend Configure options" class="guide-img-sm" />
66. **Review and create** 페이지에서 확인 후 [[Submit]] 버튼을 클릭합니다.
    <img src="/images/step8/8-1-step66-all-stacks.png" alt="Frontend Review and Submit" class="guide-img-sm" />
67. Status가 `CREATE_COMPLETE`가 될 때까지 기다립니다 (약 1분).
    <img src="/images/step8/8-1-step67-frontend-complete.png" alt="Frontend 스택 생성 완료" class="guide-img-sm" />

### 4-4. Backend 스택 생성 (ALB)

이 스택은 Application Load Balancer, Target Group, HTTP Listener를 생성합니다.

> [!WARNING]
> Network 스택이 `CREATE_COMPLETE` 상태여야 합니다 (VPC, Subnet, SG를 Import).

68. [[Create stack]] 드롭다운 → **With new resources (standard)**를 선택합니다.
    <img src="/images/step8/8-1-step68-backend-create.png" alt="Backend 스택 생성 시작" class="guide-img-sm" />
69. `Upload a template file` → `step8-backend.yaml` 파일을 선택합니다.
    <img src="/images/step8/8-1-step69-backend-template.png" alt="Backend 템플릿 업로드" class="guide-img-sm" />
70. [[Next]] 버튼을 클릭합니다.
71. **Stack name**에 `step8-backend`를 입력합니다.
    <img src="/images/step8/8-1-step71-backend-params.png" alt="Backend Stack name 및 Parameters" class="guide-img-sm" />
72. **Parameters** 섹션에서 다음을 설정합니다:

| 파라미터        | 값                 | 설명                       |
| --------------- | ------------------ | -------------------------- |
| ProjectName     | `my-3tier-app`     | Network 스택과 동일해야 함 |
| AppPort         | `8080`             | Spring Boot 기본 포트      |
| HealthCheckPath | `/actuator/health` | Health Check 경로          |

73. [[Next]] 버튼을 클릭합니다.
74. **Configure stack options** 페이지에서 [[Next]] 버튼을 클릭합니다.
    <img src="/images/step8/8-1-step74-backend-options.png" alt="Backend Configure options" class="guide-img-sm" />
75. **Review and create** 페이지에서 확인 후 [[Submit]] 버튼을 클릭합니다.
    <img src="/images/step8/8-1-step75-backend-review.png" alt="Backend Review and Submit" class="guide-img-sm" />
76. Status가 `CREATE_COMPLETE`가 될 때까지 기다립니다 (약 2~3분).
    <img src="/images/step8/8-1-step76-all-complete.png" alt="4개 스택 모두 생성 완료" class="guide-img-sm" />

### 4-5. 전체 스택 상태 확인

77. AWS CloudFormation 콘솔에서 4개 스택 모두 `CREATE_COMPLETE` 상태인지 확인합니다:

| 스택 이름        | 상태               | 소요 시간 |
| ---------------- | ------------------ | --------- |
| `step8-network`  | ✅ CREATE_COMPLETE | 2~3분     |
| `step8-data`     | ✅ CREATE_COMPLETE | 8~10분    |
| `step8-frontend` | ✅ CREATE_COMPLETE | 1분       |
| `step8-backend`  | ✅ CREATE_COMPLETE | 2~3분     |

> [!CONCEPT] Cross-stack Reference
> 4개 스택은 `Export`/`ImportValue`로 값을 주고받습니다:
>
> - Network 스택이 VPC ID, Subnet ID, SG ID를 Export
> - Data 스택과 Backend 스택이 이 값들을 Import하여 사용
> - 이 방식으로 스택 간 의존성을 명확히 하고, 팀별 독립 관리가 가능합니다

✅ **태스크 완료** — 4개의 AWS CloudFormation 스택으로 계층별 인프라를 구축했습니다.

> [!TROUBLESHOOTING]
> | 증상 | 원인 | 해결 방법 |
> |------|------|-----------|
> | `CREATE_FAILED` (RDS) | 비밀번호가 8자 미만 또는 특수문자 제한 위반 | 8자 이상, `/`, `@`, `"`, 공백 제외한 비밀번호 사용 |
> | `No export named 'my-3tier-app-vpc-id'` | Network 스택이 아직 완료 안 됨 또는 ProjectName 불일치 | Network 스택 완료 확인 + ProjectName 동일하게 |
> | 스택 생성 후 `ROLLBACK_IN_PROGRESS` | 리소스 한도 초과 (VPC 5개, EIP 5개 제한 등) | 사용하지 않는 VPC/EIP 삭제 후 재시도 |
> | `CREATE_FAILED` (S3) | 버킷 이름 중복 (글로벌 고유) | ProjectName을 변경하거나 기존 버킷 삭제 |
> | `Template format error` | YAML 파일 손상 또는 인코딩 문제 | 파일을 다시 다운로드하여 업로드 |

> [!NOTE]
> 스택이 `ROLLBACK_COMPLETE` 상태가 되면 해당 스택을 삭제한 후 다시 생성해야 합니다.  
> Events 탭에서 가장 먼저 실패한 리소스의 **Status reason**을 확인하면 원인을 파악할 수 있습니다.

---

## 태스크 5: 인프라 확인

AWS CloudFormation이 생성한 리소스를 확인합니다.

### 5-1. AWS CloudFormation Outputs 확인

78. 상단 검색창에 `CloudFormation`을 입력하고 **CloudFormation** 서비스를 선택합니다.
79. **Stacks** 목록에서 `step8-network`를 클릭합니다.
80. **Outputs** 탭을 클릭합니다.
    <img src="/images/step8/8-1-step80-vpc-check.png" alt="CloudFormation Outputs 탭" class="guide-img-sm" />
81. 다음 값들을 메모합니다:

| Output Key         | 예시 값                                                                    | 용도                 |
| ------------------ | -------------------------------------------------------------------------- | -------------------- |
| VPCId              | `vpc-0abc123def456`                                                        | VPC 식별자           |
| RDSEndpoint        | `my-3tier-app-db.xxxx.ap-northeast-2.rds.amazonaws.com`                    | DB 연결 주소         |
| S3BucketName       | `my-3tier-app-frontend-hong01`                                             | 프론트엔드 배포 대상 |
| S3WebsiteURL       | `http://my-3tier-app-frontend-xxx.s3-website.ap-northeast-2.amazonaws.com` | S3 웹사이트 URL      |
| ALBDNSName         | `my-3tier-app-alb-xxx.ap-northeast-2.elb.amazonaws.com`                    | API 엔드포인트       |
| ALBTargetGroupArn  | `arn:aws:elasticloadbalancing:...`                                         | EC2 등록 대상        |
| EC2SecurityGroupId | `sg-0abc123`                                                               | EC2 생성 시 사용     |

> [!WARNING]
> 이 값들은 Step 8-2, 8-3에서 계속 사용됩니다.  
> 메모해두거나, 필요할 때 CloudFormation → Stacks → 해당 스택 → **Outputs** 탭에서 다시 확인할 수 있습니다.  
> 특히 **RDSEndpoint**, **S3BucketName**, **ALBDNSName**은 이후 실습에서 자주 참조합니다.

> [!TIP]
> Outputs 값을 메모장에 복사해두거나, 다음 CLI 명령으로 한 번에 확인할 수 있습니다:
>
> ```bash
> aws cloudformation describe-stacks --stack-name step8-network \
>   --query "Stacks[0].Outputs[*].[OutputKey,OutputValue]" --output table
> ```
>
> 이 명령을 실행하면 모든 Output 값을 표 형태로 볼 수 있습니다.
>
> <img src="/images/step8/8-1-step81-outputs-tip.png" alt="Outputs CLI 확인 결과" class="guide-img-sm" />

### 5-2. VPC 확인

82. 상단 검색창에 `VPC`를 입력하고 **VPC** 서비스를 선택합니다.
83. 왼쪽 메뉴에서 **Your VPCs**를 클릭합니다.
    <img src="/images/step8/8-1-step83-vpc-list.png" alt="VPC 목록 확인" class="guide-img-sm" />
84. `my-3tier-app-vpc`가 생성되었는지 확인합니다.

> [!OUTPUT]
> Your VPCs 목록에 `my-3tier-app-vpc` (CIDR: 10.0.0.0/16, State: available)가 표시됩니다.

85. **Subnets**에서 4개의 서브넷을 확인합니다:
    - `my-3tier-app-public-subnet-1` (10.0.1.0/24)
    - `my-3tier-app-public-subnet-2` (10.0.2.0/24)
    - `my-3tier-app-private-subnet-1` (10.0.11.0/24)
    - `my-3tier-app-private-subnet-2` (10.0.12.0/24)
      <img src="/images/step8/8-1-step85-subnets.png" alt="서브넷 4개 확인" class="guide-img-sm" />

### 5-3. RDS 확인

86. 상단 검색창에 `RDS`를 입력하고 **RDS** 서비스를 선택합니다.
87. 왼쪽 메뉴에서 **Databases**를 클릭합니다.
88. `my-3tier-app-db`를 클릭합니다.
89. **Connectivity & security** 탭을 클릭하고, **Connect using** 섹션에서 **Endpoints**를 선택하면 Endpoint 주소가 표시됩니다.
    <img src="/images/step8/8-1-step89-rds-check.png" alt="RDS Endpoint 확인" class="guide-img-sm" />
90. Status가 `Available`인지 확인합니다.

> [!OUTPUT]
> Amazon RDS 인스턴스 상세 정보:
>
> - **DB identifier**: `my-3tier-app-db`
> - **Status**: Available (녹색 원)
> - **Engine**: MySQL 8.4.x
> - **Endpoint**: `my-3tier-app-db.xxxx.ap-northeast-2.rds.amazonaws.com`
> - **Port**: 3306

### 5-4. S3 버킷 확인

91. 상단 검색창에 `S3`를 입력하고 **S3** 서비스를 선택합니다.
    <img src="/images/step8/8-1-step91-alb-check.png" alt="S3 버킷 확인" class="guide-img-sm" />
92. `my-3tier-app-frontend-{BucketSuffix}` 버킷이 생성되었는지 확인합니다.
93. **Properties** 탭 → **Static website hosting**이 활성화되었는지 확인합니다.
    <img src="/images/step8/8-1-step93-sg-check.png" alt="S3 Static website hosting 확인" class="guide-img-md" />

### 5-5. ALB 확인

94. 상단 검색창에 `EC2`를 입력하고 **EC2** 서비스를 선택합니다.
95. 왼쪽 메뉴에서 **Load Balancers**를 클릭합니다.
96. `my-3tier-app-alb`가 생성되었는지 확인합니다.
    <img src="/images/step8/8-1-step96-alb-list.png" alt="ALB 목록 확인" class="guide-img-sm" />
97. **DNS name**을 복사합니다 (Step 8-3에서 사용).
    <img src="/images/step8/8-1-step97-alb-dns.png" alt="ALB DNS name 복사" class="guide-img-sm" />
98. **Target Groups**에서 `my-3tier-app-tg`를 확인합니다 (아직 등록된 타겟 없음).
    <img src="/images/step8/8-1-step98-target-group.png" alt="Target Group 확인" class="guide-img-sm" />

> [!OUTPUT]
> ALB 상세 정보:
>
> - **Name**: `my-3tier-app-alb`
> - **State**: Active
> - **Scheme**: Internet-facing
> - **DNS name**: `my-3tier-app-alb-xxx.ap-northeast-2.elb.amazonaws.com`
> - **Target Group**: `my-3tier-app-tg` (Targets: 0, 아직 EC2 미등록)

### 5-6. Security Groups 확인

99. 왼쪽 메뉴에서 **Security Groups**를 클릭합니다.
    <img src="/images/step8/8-1-step99-sg-list.png" alt="Security Groups 목록" class="guide-img-sm" />
100. 3개의 SG를 확인합니다:
     - `my-3tier-app-alb-sg`: 80, 443 포트 열림
     - `my-3tier-app-ec2-sg`: 8080 (ALB-SG에서만), 22 (전체)
     - `my-3tier-app-rds-sg`: 3306 (EC2-SG에서만)

> [!CONCEPT] AWS CloudFormation의 장점
>
> 수동으로 하나씩 만들면 30분 이상 걸리고 실수할 수 있는 인프라를 AWS CloudFormation으로 10분 만에 정확하게 구축했습니다.  
> 또한 삭제할 때도 스택 하나만 삭제하면 모든 리소스가 정리됩니다.

✅ **태스크 완료** — AWS CloudFormation이 생성한 모든 리소스를 확인했습니다.

---

## 🎯 셀프 미션: Amazon RDS 초기 데이터베이스 구성 (Spring Legacy 사용자)

> [!NOTE]
> 이 미션은 기존 Spring MVC(WAR) 프로젝트를 사용하며, 초기 테이블과 데이터가 담긴 `.sql` 파일이 있는 경우에 진행합니다.  
> Spring Boot + `ddl-auto: update`를 사용하는 경우에는 건너뛰어도 됩니다 (앱 시작 시 자동 생성).

### 미션 목표

AWS CloudFormation으로 생성된 Amazon RDS에 기존 프로젝트의 테이블 구조와 초기 데이터를 적용합니다.

### 힌트

- Private Subnet의 Amazon RDS에 접근하려면 **같은 VPC의 Amazon EC2**가 필요합니다.
- Step 8-3에서 EC2를 생성하지만, 미리 해보고 싶다면 직접 EC2를 생성하세요.
- Amazon EC2 생성 시: Private Subnet 배치, `ec2-sg` 적용, SSM Session Manager용 IAM Role 연결
- **IAM Role 필수**: SSM Session Manager로 접속하려면 EC2에 `AmazonSSMManagedInstanceCore` 정책이 포함된 IAM Role을 연결해야 합니다.  
  IAM → Roles → Create role → AWS service: EC2 → `AmazonSSMManagedInstanceCore` 정책 연결 → EC2 생성 시 IAM instance profile에 선택
- MySQL 클라이언트 설치: `sudo dnf install -y mariadb105`
- SQL 파일 전송: 로컬 → Amazon S3 → Amazon EC2 (Private Subnet이므로 SCP 직접 불가)

### 진행 순서

101. Amazon EC2 인스턴스를 Private Subnet에 생성합니다 (Step 8-3 태스크 5 참고).
102. SSM Session Manager로 Amazon EC2에 접속합니다.
103. MySQL 클라이언트를 설치합니다.
104. `.sql` 파일을 Amazon S3 경유로 Amazon EC2에 전송합니다.
105. Amazon RDS에 접속하여 SQL을 실행합니다.
106. 테이블과 데이터가 정상 생성되었는지 확인합니다.

```bash
# 예시: EC2에서 RDS 접속 후 SQL 실행
mysql -h my-3tier-app-db.xxxx.ap-northeast-2.rds.amazonaws.com \
  -u admin -p myapp < /home/ec2-user/schema.sql
```

> [!TIP]
> 이 미션을 Step 8-3 이전에 진행하면, 8-3에서 생성하는 Amazon EC2를 그대로 재사용할 수 있습니다.  
> 미리 만들어둔 Amazon EC2를 8-3의 Target Group에 등록하면 됩니다.

---

# 🗑️ 리소스 정리

> [!WARNING]
> 이 세션에서 생성한 리소스를 지금 삭제하지 마세요!  
> Step 8-2, 8-3, 8-4에서 계속 사용합니다.  
> **Step 8-5에서 전체 정리합니다.**

### 비용 주의 사항

다음 리소스는 실행 중 비용이 발생합니다:

> [!WARNING]
> **시간당 비용이 발생하는 리소스 (방치 시 월 비용 추정)**
>
> | 리소스              | 시간당 비용 | 일 비용 (24h) | 월 비용 (30일) | 비고                  |
> | ------------------- | ----------- | ------------- | -------------- | --------------------- |
> | NAT Gateway         | $0.045      | $1.08         | **$32.40**     | 가장 비용 높음        |
> | ALB                 | $0.0225     | $0.54         | **$16.20**     | 고정 비용 + LCU       |
> | RDS (db.t3.micro)   | $0.017      | $0.41         | **$12.24**     | 프리티어 해당 시 무료 |
> | Elastic IP (미사용) | $0.005      | $0.12         | $3.60          | 연결된 상태면 무료    |
> | S3                  | ~$0.001     | -             | **거의 무료**  | 저장량 기반           |
>
> ※ 위 금액은 작성 시점 기준 참고 값이며, 실제 요금은 리전, 환율, AWS 정책 변경에 따라 상이할 수 있습니다.
>
> ⚠️ **모든 리소스를 방치하면 월 ~$64 이상 발생할 수 있습니다!**  
> (프리티어 적용 여부, 데이터 전송량, 환율 등 조건에 따라 실제 금액은 달라질 수 있습니다.)

> [!TIP]
> 실습을 하루 안에 완료하기 어렵다면, AWS CloudFormation 스택을 삭제하고 다음 실습 시 다시 생성하는 것이 비용을 절약하는 방법입니다.  
> 스택 생성은 10~15분이면 완료됩니다.

✅ **실습 종료**: Step 8-2에서 Vue.js 프론트엔드를 배포합니다.

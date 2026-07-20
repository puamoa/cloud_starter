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
> 실습 후 반드시 리소스를 정리하세요 (Step 8-4에서 안내).  
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
> Step 8은 4개의 세션으로 구성됩니다:
>
> - 8-1: 아키텍처 설계 + 인프라 구축 (현재)
> - 8-2: Vue.js 프론트엔드 배포 (S3 + CloudFront)
> - 8-3: Spring Boot 백엔드 배포 (EC2 + ALB)
> - 8-4: 전체 연동 확인 + 리소스 정리

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

## 태스크 2: GitHub 리포지토리 2개 생성

프론트엔드와 백엔드를 별도 리포지토리로 관리합니다.

> [!NOTE]
> **소스 코드 옵션을 선택하세요:**
>
> | 옵션                           | 대상                                             | 설명                                       |
> | ------------------------------ | ------------------------------------------------ | ------------------------------------------ |
> | **옵션 A: 기존 프로젝트 사용** | Step 2~6에서 만든 Spring Boot/Vue.js가 있는 경우 | 기존 코드를 새 레포에 옮겨서 사용          |
> | **옵션 B: 새로 시작**          | 처음부터 만들거나 기존 코드가 없는 경우          | 이 가이드에서 제공하는 보일러플레이트 사용 |
>
> 어떤 옵션이든 최종 결과물(3-Tier 연동)은 동일합니다.

> [!TIP]
> **옵션 A (기존 프로젝트)를 선택한 경우:**
>
> - 기존 Spring Boot 프로젝트를 `my-backend` 레포에 push합니다.
> - 기존 Vue.js 프로젝트를 `my-frontend` 레포에 push합니다.
> - 이후 태스크에서 DB 접속 정보나 API URL만 환경에 맞게 변경하면 됩니다.
> - Step 8-3에서 Amazon RDS 연동 코드와 CORS 설정만 추가/확인합니다.
>
> **옵션 B (새로 시작)를 선택한 경우:**
>
> - 아래 가이드를 따라 레포를 생성합니다.
> - Step 8-2에서 Vue.js 프로젝트를, Step 8-3에서 Spring Boot 프로젝트를 처음부터 생성합니다.

### 2-1. my-frontend 리포지토리 생성

1. GitHub에 로그인합니다.
2. 우측 상단 `+` → [[New repository]]를 클릭합니다.
3. 다음과 같이 설정합니다:
   - **Repository name**: `my-frontend`
   - **Description**: `Vue.js Frontend for 3-Tier App`
   - **Visibility**: Public (GitHub Actions 무료 사용)
   - ✅ **Add a README file** 체크
   - **.gitignore**: `Node` 선택
4. [[Create repository]]를 클릭합니다.

### 2-2. my-backend 리포지토리 생성

5. 같은 방식으로 두 번째 리포지토리를 생성합니다:
   - **Repository name**: `my-backend`
   - **Description**: `Spring Boot Backend for 3-Tier App`
   - **Visibility**: Public
   - ✅ **Add a README file** 체크
   - **.gitignore**: `Gradle` 선택
6. [[Create repository]]를 클릭합니다.

### 2-3. 로컬에 클론

```bash
# 작업 디렉토리 생성
mkdir ~/3tier-project && cd ~/3tier-project

# 프론트엔드 클론
git clone https://github.com/YOUR_USERNAME/my-frontend.git

# 백엔드 클론
git clone https://github.com/YOUR_USERNAME/my-backend.git
```

> [!TIP]
> 리포지토리를 Public으로 생성하면 GitHub Actions를 무제한 무료로 사용할 수 있습니다.  
> Private 리포지토리는 월 2,000분까지 무료입니다.

### 2-4. 기존 프로젝트를 새 레포에 push (옵션 A)

기존 Spring Boot/Vue.js 프로젝트가 로컬에 있는 경우, 새로 만든 레포에 push합니다.

**백엔드 (Spring Boot 또는 Spring MVC):**

```bash
cd ~/기존-백엔드-프로젝트

# 기존 git 이력 제거 (새 레포로 시작)
rm -rf .git

# 새 레포로 초기화
git init
git remote add origin https://github.com/YOUR_USERNAME/my-backend.git

# 원격 레포의 README, .gitignore 가져오기
git pull origin main --allow-unrelated-histories

# 전체 커밋 및 push
git add .
git commit -m "feat: initial backend project"
git push origin main
```

**프론트엔드 (Vue.js):**

```bash
cd ~/기존-프론트엔드-프로젝트

rm -rf .git
git init
git remote add origin https://github.com/YOUR_USERNAME/my-frontend.git
git pull origin main --allow-unrelated-histories
git add .
git commit -m "feat: initial frontend project"
git push origin main
```

> [!WARNING]
> `rm -rf .git`은 기존 git 이력을 완전히 삭제합니다.  
> 기존 이력을 보존하고 싶다면 `rm -rf .git` 대신 `git remote set-url origin <새 URL>`로 원격 주소만 변경하세요.

> [!TIP]
> `--allow-unrelated-histories` 옵션은 README가 있는 원격 레포와 로컬 프로젝트의 이력이 다를 때 병합을 허용합니다.  
> 충돌이 발생하면 README 파일만 선택하고 커밋하면 됩니다.

### 2-5. .gitignore와 환경 변수 설정 확인

GitHub에서 레포 생성 시 선택한 `.gitignore` 템플릿(Node, Gradle)은 환경 변수 파일을 자동으로 무시합니다.  
배포에 필요한 설정 파일이 누락되지 않도록 확인합니다.

**백엔드 — `.gitignore` 확인:**

7. `.gitignore` 파일을 열고 다음이 포함되어 있는지 확인합니다:

```gitignore
# Gradle 기본 .gitignore에 포함된 항목
.gradle/
build/
!gradle/wrapper/gradle-wrapper.jar

# 환경 변수 / 비밀값 (추가 권장)
.env
application-local.yml
```

8. `application.yml`(또는 `application.properties`)은 `.gitignore`에 **포함하지 않습니다**:
   - DB 접속 정보는 환경 변수(`${DB_ENDPOINT}`)로 주입하므로 코드에 비밀값이 없습니다.
   - 환경 변수 값 자체는 SSM Parameter Store에서 관리합니다.

> [!NOTE]
> `application.yml`에 하드코딩된 비밀번호가 있다면 환경 변수로 교체한 후 push하세요.  
> Step 8-3 태스크 2에서 SSM Parameter Store를 사용하여 비밀값을 안전하게 관리합니다.

**프론트엔드 — `.gitignore` 확인:**

9. `.gitignore`에 다음이 포함되어 있는지 확인합니다:

```gitignore
# Node 기본 .gitignore에 포함된 항목
node_modules/
dist/

# 환경 변수 (로컬 개발용만 무시)
.env.local
.env.*.local
```

10. `.env.development`와 `.env.production`은 `.gitignore`에 **포함하지 않습니다**:
    - 이 파일에는 API URL만 있고 비밀값이 없습니다.
    - GitHub Actions 빌드 시 이 파일의 값을 사용합니다.

> [!WARNING]
> `.env.local`은 로컬 전용이므로 git에 포함하지 않습니다.  
> `.env.production`은 빌드에 필요하므로 **반드시 git에 포함**해야 합니다.  
> 만약 `VITE_API_URL`을 GitHub Secrets로 주입하는 경우에는 `.env.production`이 없어도 됩니다 (Step 8-2 태스크 6 참조).

11. 설정 확인 후 커밋합니다:

```bash
# 백엔드
cd ~/3tier-project/my-backend
git add .gitignore
git commit -m "chore: update .gitignore"
git push origin main

# 프론트엔드
cd ~/3tier-project/my-frontend
git add .gitignore
git commit -m "chore: update .gitignore"
git push origin main
```

> [!NOTE]
> 환경 변수(DB 접속 정보, API URL 등)의 실제 값 설정과 관리 방법은 이후 세션에서 다룹니다:
>
> - **백엔드**: Step 8-3 태스크 2(SSM Parameter Store) 및 태스크 6(GitHub Secrets로 `application.properties` 주입)
> - **프론트엔드**: Step 8-2 태스크 2(`.env.production` 작성) 및 태스크 6(GitHub Secrets로 `VITE_API_URL` 주입)
>
> 지금은 `.gitignore` 설정만 확인하고 넘어가세요.

✅ **태스크 완료** — GitHub에 `my-frontend`와 `my-backend` 리포지토리를 생성했습니다.

---

## 태스크 3: AWS CloudFormation으로 인프라 한 번에 구축

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

### 3-1. Network 스택 생성 (VPC + 서브넷 + SG)

7. 상단 검색창에 `CloudFormation`을 입력하고 **CloudFormation** 서비스를 선택합니다.
8. [[Create stack]] 드롭다운을 클릭한 후 **With new resources (standard)**를 선택합니다.
9. **Prerequisite - Prepare template**에서 `Choose an existing template`을 선택합니다.
10. **Specify template**에서 `Upload a template file`을 선택합니다.
11. [[Choose file]] 버튼을 클릭하고 다운로드한 `step8-network.yaml` 파일을 선택합니다.
12. [[Next]] 버튼을 클릭합니다.
13. **Stack name**에 `step8-network`를 입력합니다.
14. **Parameters** 섹션에서 다음을 설정합니다:

| 파라미터         | 값             | 설명                                               |
| ---------------- | -------------- | -------------------------------------------------- |
| ProjectName      | `my-3tier-app` | 리소스 이름 접두사 (4개 스택 모두 동일하게)        |
| CreateNATGateway | `Yes`          | Private Subnet 인터넷 접근 필요 시 Yes (비용 발생) |
| 나머지           | 기본값 유지    | CIDR 변경 불필요                                   |

> [!TIP]
> **CreateNATGateway를 No로 설정하면:**
> NAT Gateway 시간당 비용($0.045/h + 데이터 처리)을 절약할 수 있습니다.  
> 단, Private Subnet의 Amazon EC2에서 인터넷 접근(패키지 설치, SSM)이 불가합니다.  
> 이 실습에서는 `Yes`를 권장합니다.

15. [[Next]] 버튼을 클릭합니다.
16. **Configure stack options** 페이지에서 추가 설정 없이 [[Next]] 버튼을 클릭합니다.
17. **Review and create** 페이지에서 Stack name, Parameters 설정 내용을 확인합니다.
18. [[Submit]] 버튼을 클릭합니다.
19. **Events** 탭에서 리소스 생성 진행 상태를 확인합니다.
20. Status가 `CREATE_COMPLETE`로 변경될 때까지 기다립니다 (약 2~3분).

> [!OUTPUT]
> Stacks 목록에서 `step8-network`의 Status가 `CREATE_COMPLETE` (녹색)로 표시됩니다.
> Events 탭에서 VPC, Subnet, IGW, NAT Gateway, Route Table, Security Group 등이 순서대로 생성된 것을 확인할 수 있습니다.

### 3-2. Data 스택 생성 (Amazon RDS)

> [!WARNING]
> Network 스택이 `CREATE_COMPLETE` 상태여야 Data 스택을 생성할 수 있습니다.  
> Network 스택의 Export 값을 Import하기 때문입니다.

21. [[Create stack]] 드롭다운 → **With new resources (standard)**를 선택합니다.
22. `Upload a template file` → `step8-data.yaml` 파일을 선택합니다.
23. [[Next]] 버튼을 클릭합니다.
24. **Stack name**에 `step8-data`를 입력합니다.
25. **Parameters** 섹션에서 다음을 설정합니다:

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

26. [[Next]] 버튼을 클릭합니다.
27. **Configure stack options** 페이지에서 [[Next]] 버튼을 클릭합니다.
28. **Review and create** 페이지에서 Parameters(특히 비밀번호)를 확인합니다.
29. [[Submit]] 버튼을 클릭합니다.
30. Status가 `CREATE_COMPLETE`가 될 때까지 기다립니다 (약 **8~10분**, Amazon RDS 생성 소요).

> [!TIP]
> Amazon RDS 생성이 가장 오래 걸립니다 (약 8~10분).  
> 이 시간 동안 Frontend 스택과 Backend 스택을 먼저 생성할 수 있습니다.  
> Frontend 스택은 Network에 의존하지 않으므로 Data와 동시에 생성 가능합니다.

### 3-3. Frontend 스택 생성 (Amazon S3)

> [!NOTE]
> Frontend 스택은 VPC와 독립적입니다 (Amazon S3는 글로벌 서비스).  
> Network 스택 완료를 기다릴 필요 없이 바로 생성할 수 있습니다.

31. [[Create stack]] 드롭다운 → **With new resources (standard)**를 선택합니다.
32. `Upload a template file` → `step8-frontend.yaml` 파일을 선택합니다.
33. [[Next]] 버튼을 클릭합니다.
34. **Stack name**에 `step8-frontend`를 입력합니다.
35. **Parameters** 섹션에서 **ProjectName**을 `my-3tier-app`으로 설정합니다 (4개 스택 모두 동일).
36. [[Next]] 버튼을 클릭합니다.
37. **Configure stack options** 페이지에서 [[Next]] 버튼을 클릭합니다.
38. **Review and create** 페이지에서 확인 후 [[Submit]] 버튼을 클릭합니다.
39. Status가 `CREATE_COMPLETE`가 될 때까지 기다립니다 (약 1분).

### 3-4. Backend 스택 생성 (ALB)

> [!WARNING]
> Network 스택이 `CREATE_COMPLETE` 상태여야 합니다 (VPC, Subnet, SG를 Import).

40. [[Create stack]] 드롭다운 → **With new resources (standard)**를 선택합니다.
41. `Upload a template file` → `step8-backend.yaml` 파일을 선택합니다.
42. [[Next]] 버튼을 클릭합니다.
43. **Stack name**에 `step8-backend`를 입력합니다.
44. **Parameters** 섹션에서 다음을 설정합니다:

| 파라미터        | 값                 | 설명                       |
| --------------- | ------------------ | -------------------------- |
| ProjectName     | `my-3tier-app`     | Network 스택과 동일해야 함 |
| AppPort         | `8080`             | Spring Boot 기본 포트      |
| HealthCheckPath | `/actuator/health` | Health Check 경로          |

45. [[Next]] 버튼을 클릭합니다.
46. **Configure stack options** 페이지에서 [[Next]] 버튼을 클릭합니다.
47. **Review and create** 페이지에서 확인 후 [[Submit]] 버튼을 클릭합니다.
48. Status가 `CREATE_COMPLETE`가 될 때까지 기다립니다 (약 2~3분).

### 3-5. 전체 스택 상태 확인

49. AWS CloudFormation 콘솔에서 4개 스택 모두 `CREATE_COMPLETE` 상태인지 확인합니다:

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

## 태스크 4: 인프라 확인

AWS CloudFormation이 생성한 리소스를 확인합니다.

### 4-1. AWS CloudFormation Outputs 확인

23. CloudFormation → **Stacks** → `step8-network` 클릭 (또는 각 스택의 Outputs 탭)
24. **Outputs** 탭을 클릭합니다.
25. 다음 값들을 메모합니다:

| Output Key         | 예시 값                                                                    | 용도                 |
| ------------------ | -------------------------------------------------------------------------- | -------------------- |
| VPCId              | `vpc-0abc123def456`                                                        | VPC 식별자           |
| RDSEndpoint        | `my-3tier-app-db.xxxx.ap-northeast-2.rds.amazonaws.com`                    | DB 연결 주소         |
| S3BucketName       | `my-3tier-app-frontend-123456789012`                                       | 프론트엔드 배포 대상 |
| S3WebsiteURL       | `http://my-3tier-app-frontend-xxx.s3-website.ap-northeast-2.amazonaws.com` | S3 웹사이트 URL      |
| ALBDNSName         | `my-3tier-app-alb-xxx.ap-northeast-2.elb.amazonaws.com`                    | API 엔드포인트       |
| ALBTargetGroupArn  | `arn:aws:elasticloadbalancing:...`                                         | EC2 등록 대상        |
| EC2SecurityGroupId | `sg-0abc123`                                                               | EC2 생성 시 사용     |

> [!WARNING]
> 이 값들은 Step 8-2, 8-3에서 계속 사용됩니다. 반드시 메모해두세요!  
> 특히 RDSEndpoint, S3BucketName, ALBDNSName은 필수입니다.

> [!TIP]
> Outputs 값을 메모장에 복사해두거나, 다음 CLI 명령으로 한 번에 확인할 수 있습니다:
>
> ```bash
> aws cloudformation describe-stacks --stack-name step8-network \
>   --query "Stacks[0].Outputs[*].[OutputKey,OutputValue]" --output table
> ```
>
> 이 명령을 실행하면 모든 Output 값을 표 형태로 볼 수 있습니다.

### 4-2. VPC 확인

26. AWS Console → **VPC** 서비스로 이동합니다.
27. 왼쪽 메뉴에서 **Your VPCs**를 클릭합니다.
28. `my-3tier-app-vpc`가 생성되었는지 확인합니다.

> [!OUTPUT]
> Your VPCs 목록에 `my-3tier-app-vpc` (CIDR: 10.0.0.0/16, State: available)가 표시됩니다.

29. **Subnets**에서 4개의 서브넷을 확인합니다:
    - `my-3tier-app-public-subnet-1` (10.0.1.0/24)
    - `my-3tier-app-public-subnet-2` (10.0.2.0/24)
    - `my-3tier-app-private-subnet-1` (10.0.11.0/24)
    - `my-3tier-app-private-subnet-2` (10.0.12.0/24)

### 4-3. RDS 확인

30. AWS Console → **RDS** 서비스로 이동합니다.
31. **Databases**에서 `my-3tier-app-db`를 클릭합니다.
32. **Connectivity & security** 탭에서 Endpoint를 확인합니다.
33. Status가 `Available`인지 확인합니다.

> [!OUTPUT]
> Amazon RDS 인스턴스 상세 정보:
>
> - **DB identifier**: `my-3tier-app-db`
> - **Status**: Available (녹색 원)
> - **Engine**: MySQL 8.4.x
> - **Endpoint**: `my-3tier-app-db.xxxx.ap-northeast-2.rds.amazonaws.com`
> - **Port**: 3306

### 4-4. S3 버킷 확인

34. AWS Console → **S3** 서비스로 이동합니다.
35. `my-3tier-app-frontend-{AccountId}` 버킷이 생성되었는지 확인합니다.
36. **Properties** 탭 → **Static website hosting**이 활성화되었는지 확인합니다.

### 4-5. ALB 확인

37. AWS Console → **EC2** → **Load Balancers**로 이동합니다.
38. `my-3tier-app-alb`가 생성되었는지 확인합니다.
39. **DNS name**을 복사합니다 (Step 8-3에서 사용).
40. **Target Groups**에서 `my-3tier-app-tg`를 확인합니다 (아직 등록된 타겟 없음).

> [!OUTPUT]
> ALB 상세 정보:
>
> - **Name**: `my-3tier-app-alb`
> - **State**: Active
> - **Scheme**: Internet-facing
> - **DNS name**: `my-3tier-app-alb-xxx.ap-northeast-2.elb.amazonaws.com`
> - **Target Group**: `my-3tier-app-tg` (Targets: 0, 아직 EC2 미등록)

### 4-6. Security Groups 확인

41. **EC2** → **Security Groups**에서 3개의 SG를 확인합니다:
    - `my-3tier-app-alb-sg`: 80, 443 포트 열림
    - `my-3tier-app-ec2-sg`: 8080 (ALB-SG에서만), 22 (전체)
    - `my-3tier-app-rds-sg`: 3306 (EC2-SG에서만)

> [!CONCEPT] AWS CloudFormation의 장점
>
> 수동으로 하나씩 만들면 30분 이상 걸리고 실수할 수 있는 인프라를 AWS CloudFormation으로 10분 만에 정확하게 구축했습니다.  
> 또한 삭제할 때도 스택 하나만 삭제하면 모든 리소스가 정리됩니다.

✅ **태스크 완료** — AWS CloudFormation이 생성한 모든 리소스를 확인했습니다.

---

## 셀프 미션: Amazon RDS 초기 데이터베이스 구성 (Spring Legacy 사용자)

> [!NOTE]
> 이 미션은 기존 Spring MVC(WAR) 프로젝트를 사용하며, 초기 테이블과 데이터가 담긴 `.sql` 파일이 있는 경우에 진행합니다.  
> Spring Boot + `ddl-auto: update`를 사용하는 경우에는 건너뛰어도 됩니다 (앱 시작 시 자동 생성).

### 미션 목표

AWS CloudFormation으로 생성된 Amazon RDS에 기존 프로젝트의 테이블 구조와 초기 데이터를 적용합니다.

### 힌트

- Private Subnet의 Amazon RDS에 접근하려면 **같은 VPC의 Amazon EC2**가 필요합니다.
- Step 8-3에서 EC2를 생성하지만, 미리 해보고 싶다면 직접 EC2를 생성하세요.
- Amazon EC2 생성 시: Private Subnet 배치, `ec2-sg` 적용, SSM Session Manager용 IAM Role 연결
- **IAM Role 필수**: SSM Session Manager로 접속하려면 EC2에 `AmazonSSMManagedInstanceCore` 정책이 포함된 IAM Role을 연결해야 합니다. IAM → Roles → Create role → AWS service: EC2 → `AmazonSSMManagedInstanceCore` 정책 연결 → EC2 생성 시 IAM instance profile에 선택
- MySQL 클라이언트 설치: `sudo dnf install -y mariadb105`
- SQL 파일 전송: 로컬 → Amazon S3 → Amazon EC2 (Private Subnet이므로 SCP 직접 불가)

### 진행 순서

1. Amazon EC2 인스턴스를 Private Subnet에 생성합니다 (Step 8-3 태스크 5 참고).
2. SSM Session Manager로 Amazon EC2에 접속합니다.
3. MySQL 클라이언트를 설치합니다.
4. `.sql` 파일을 Amazon S3 경유로 Amazon EC2에 전송합니다.
5. Amazon RDS에 접속하여 SQL을 실행합니다.
6. 테이블과 데이터가 정상 생성되었는지 확인합니다.

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
> **Step 8-4에서 전체 정리합니다.**

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

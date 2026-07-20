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

| 계층                          | 역할               | 기술 스택    | AWS 서비스           |
| ----------------------------- | ------------------ | ------------ | -------------------- |
| **Presentation** (프론트엔드) | 사용자 인터페이스  | Vue.js (SPA) | S3 + CloudFront      |
| **Application** (백엔드)      | 비즈니스 로직, API | Spring Boot  | EC2 + ALB            |
| **Data** (데이터베이스)       | 데이터 저장/관리   | MySQL        | RDS (Private Subnet) |

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

7. AWS Console에서 **CloudFormation** 서비스로 이동합니다.
8. [[Create stack]] → **With new resources (standard)**를 클릭합니다.
9. **Template source**: `Upload a template file` → `step8-network.yaml` 업로드
10. [[Next]]를 클릭합니다.
11. **Stack name**: `step8-network`
12. 파라미터를 설정합니다:

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

13. [[Next]] → [[Next]] → [[Submit]]을 클릭합니다.
14. Status가 `CREATE_COMPLETE`가 될 때까지 기다립니다 (약 2~3분).

### 3-2. Data 스택 생성 (Amazon RDS)

> [!WARNING]
> Network 스택이 `CREATE_COMPLETE` 상태여야 Data 스택을 생성할 수 있습니다.  
> Network 스택의 Export 값을 Import하기 때문입니다.

15. [[Create stack]] → `step8-data.yaml` 업로드
16. **Stack name**: `step8-data`
17. 파라미터를 설정합니다:

| 파라미터         | 값               | 설명                           |
| ---------------- | ---------------- | ------------------------------ |
| ProjectName      | `my-3tier-app`   | Network 스택과 동일해야 함     |
| DBMasterUsername | `admin`          | Amazon RDS 관리자 계정         |
| DBMasterPassword | `MyPassword123!` | Amazon RDS 비밀번호 (8자 이상) |
| DBInstanceClass  | `db.t3.micro`    | Amazon RDS 인스턴스 타입       |

> [!WARNING]
> DBMasterPassword는 실습용으로 간단하게 설정하지만, 실제 프로젝트에서는 **반드시 강력한 비밀번호**를 사용하세요.  
> 이 비밀번호는 Step 8-3에서 SSM Parameter Store에 저장하여 안전하게 관리합니다.

18. [[Next]] → [[Next]] → [[Submit]]을 클릭합니다.
19. Status가 `CREATE_COMPLETE`가 될 때까지 기다립니다 (약 **8~10분**, Amazon RDS 생성 소요).

> [!TIP]
> Amazon RDS 생성이 가장 오래 걸립니다 (약 8~10분).  
> 이 시간 동안 Frontend 스택과 Backend 스택을 먼저 생성할 수 있습니다.  
> Frontend 스택은 Network에 의존하지 않으므로 Data와 동시에 생성 가능합니다.

### 3-3. Frontend 스택 생성 (Amazon S3)

> [!NOTE]
> Frontend 스택은 VPC와 독립적입니다 (Amazon S3는 글로벌 서비스).  
> Network 스택 완료를 기다릴 필요 없이 바로 생성할 수 있습니다.

20. [[Create stack]] → `step8-frontend.yaml` 업로드
21. **Stack name**: `step8-frontend`
22. **ProjectName**: `my-3tier-app` (동일)
23. [[Next]] → [[Next]] → [[Submit]]을 클릭합니다.
24. Status가 `CREATE_COMPLETE`가 될 때까지 기다립니다 (약 1분).

### 3-4. Backend 스택 생성 (ALB)

> [!WARNING]
> Network 스택이 `CREATE_COMPLETE` 상태여야 합니다 (VPC, Subnet, SG를 Import).

25. [[Create stack]] → `step8-backend.yaml` 업로드
26. **Stack name**: `step8-backend`
27. 파라미터를 설정합니다:

| 파라미터        | 값                 | 설명                       |
| --------------- | ------------------ | -------------------------- |
| ProjectName     | `my-3tier-app`     | Network 스택과 동일해야 함 |
| AppPort         | `8080`             | Spring Boot 기본 포트      |
| HealthCheckPath | `/actuator/health` | Health Check 경로          |

28. [[Next]] → [[Next]] → [[Submit]]을 클릭합니다.
29. Status가 `CREATE_COMPLETE`가 될 때까지 기다립니다 (약 2~3분).

### 3-5. 전체 스택 상태 확인

30. AWS CloudFormation 콘솔에서 4개 스택 모두 `CREATE_COMPLETE` 상태인지 확인합니다:

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

> [!TIP]
> 실습을 하루 안에 완료하기 어렵다면, AWS CloudFormation 스택을 삭제하고 다음 실습 시 다시 생성하는 것이 비용을 절약하는 방법입니다.  
> 스택 생성은 10~15분이면 완료됩니다.

✅ **실습 종료**: Step 8-2에서 Vue.js 프론트엔드를 배포합니다.

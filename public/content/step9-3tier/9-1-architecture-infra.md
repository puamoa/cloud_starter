---
title: '전체 아키텍처 설계 및 인프라 구축'
week: 9
session: 1
awsServices:
  - Amazon VPC
  - Amazon RDS
  - Amazon S3
learningObjectives:
  - 3-Tier 아키텍처의 전체 구성을 설계할 수 있습니다.
  - CloudFormation으로 VPC, RDS, S3를 한 번에 구축할 수 있습니다.
  - 각 계층(프론트엔드, 백엔드, 데이터베이스)의 역할을 설명할 수 있습니다.
prerequisites:
  - Step 0~8 학습 완료 (권장)
  - GitHub 계정
estimatedCost: 크레딧 내 사용 가능 (비용 발생 가능)
---

이 실습에서는 Step 0~8에서 배운 모든 것을 통합하여 실제 3-Tier 웹 서비스를
완성합니다. 전체 아키텍처를 설계하고, CloudFormation으로 인프라를 한 번에
구축합니다.

> [!NOTE]
> Step 9는 4개의 세션으로 구성됩니다:
>
> - 9-1: 아키텍처 설계 + 인프라 구축 (현재)
> - 9-2: Vue.js 프론트엔드 배포 (S3 + CloudFront)
> - 9-3: Spring Boot 백엔드 배포 (EC2 + ALB + CI/CD)
> - 9-4: 전체 연동 확인 + 리소스 정리

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

```
┌─────────────────────────────────────────────────────────────────┐
│                        사용자 브라우저                             │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  [CloudFront + S3]  ← Vue.js 정적 파일 (HTML/CSS/JS)            │
│  - CDN으로 전 세계 빠른 응답                                      │
│  - HTTPS 자동 적용                                               │
└─────────────────────────┬───────────────────────────────────────┘
                          │ API 호출 (AJAX)
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  [ALB (Application Load Balancer)]  ← HTTPS 종료, 트래픽 분산     │
│  - Public Subnet에 위치                                          │
│  - Health Check로 정상 인스턴스에만 라우팅                         │
└─────────────────────────┬───────────────────────────────────────┘
                          │ Port 8080
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  [EC2 - Spring Boot]  ← REST API 서버                            │
│  - Private Subnet에 위치 (ALB에서만 접근)                         │
│  - NAT Gateway를 통해 외부 패키지 설치                            │
│  - SSM Session Manager로 접속 (SSH 불필요)                        │
└─────────────────────────┬───────────────────────────────────────┘
                          │ Port 3306
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  [RDS MySQL]  ← 데이터 영구 저장                                │
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

| Security Group | Inbound 규칙           | 용도                 |
| -------------- | ---------------------- | -------------------- |
| ALB-SG         | 80, 443 from 0.0.0.0/0 | 외부 HTTP/HTTPS 허용 |
| EC2-SG         | 8080 from ALB-SG       | ALB에서만 앱 접근    |
| RDS-SG         | 3306 from EC2-SG       | EC2에서만 DB 접근    |

> [!CONCEPT] 3-Tier 아키텍처의 장점
>
> 1. **보안**: 데이터베이스를 Private Subnet에 격리하여 외부 접근을 차단합니다.
> 2. **확장성**: 각 계층을 독립적으로 스케일링할 수 있습니다 (프론트엔드는 CDN, 백엔드는 Auto Scaling).
> 3. **유지보수**: 프론트엔드와 백엔드를 독립적으로 배포할 수 있습니다.
> 4. **비용 최적화**: 정적 파일은 S3+CloudFront로 서빙하여 EC2 부하를 줄입니다.

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

## 태스크 3: CloudFormation으로 인프라 한 번에 구축

Step 0~8에서 수동으로 만들었던 모든 인프라를 CloudFormation 하나로 자동 구축합니다.

### CloudFormation 템플릿 다운로드

아래 링크에서 CloudFormation 템플릿을 다운로드합니다:

📥 **[step9-1-3tier-infra.yaml 다운로드](/files/step9/step9-1-3tier-infra.yaml)**

> [!NOTE]
> 이 템플릿은 다음 리소스를 한 번에 생성합니다:
>
> - VPC (10.0.0.0/16)
> - Public Subnet 2개 + Private Subnet 2개
> - Internet Gateway + NAT Gateway
> - ALB + Target Group + Listener
> - Security Groups (ALB, EC2, RDS)
> - RDS MySQL (Private Subnet)
> - S3 버킷 (프론트엔드 호스팅용)

### 3-1. CloudFormation 스택 생성

7. AWS Console에서 **CloudFormation** 서비스로 이동합니다.
8. [[Create stack]] → **With new resources (standard)**를 클릭합니다.
9. **Prepare template**: `Template is ready` 선택
10. **Template source**: `Upload a template file` 선택
11. [[Choose file]]을 클릭하여 다운로드한 `step9-1-3tier-infra.yaml`을 업로드합니다.
12. [[Next]]를 클릭합니다.

### 3-2. 스택 파라미터 설정

13. **Stack name**: `my-3tier-infra`
14. 파라미터를 입력합니다:

| 파라미터         | 값               | 설명                    |
| ---------------- | ---------------- | ----------------------- |
| ProjectName      | `my-3tier-app`   | 리소스 이름 접두사      |
| DBMasterUsername | `admin`          | RDS 관리자 계정         |
| DBMasterPassword | `MyPassword123!` | RDS 비밀번호 (8자 이상) |
| DBInstanceClass  | `db.t3.micro`    | RDS 인스턴스 타입       |
| EnvironmentName  | `dev`            | 환경 이름               |

> [!WARNING]
> DBMasterPassword는 실습용으로 간단하게 설정하지만, 실제 프로젝트에서는
> 반드시 강력한 비밀번호를 사용하세요. 이 비밀번호는 Step 9-3에서 SSM Parameter Store에
> 저장하여 안전하게 관리합니다.

15. [[Next]]를 클릭합니다.

### 3-3. 스택 옵션 및 생성

16. **Configure stack options** 페이지에서 기본값 유지 → [[Next]]
17. **Review** 페이지에서 설정을 확인합니다.
18. 하단의 **Capabilities** 체크박스를 확인합니다:
    - ✅ `I acknowledge that AWS CloudFormation might create IAM resources.`
19. [[Submit]]을 클릭합니다.

### 3-4. 스택 생성 대기

20. **Events** 탭에서 리소스 생성 진행 상황을 확인합니다.
21. 전체 생성에 약 **10~15분** 소요됩니다 (RDS가 가장 오래 걸림).
22. Status가 `CREATE_COMPLETE`가 될 때까지 기다립니다.

> [!OUTPUT]
> Events 탭에서 리소스가 순차적으로 생성되는 것을 확인할 수 있습니다:
>
> ```
> CREATE_IN_PROGRESS  AWS::EC2::VPC           my-3tier-app-vpc
> CREATE_COMPLETE     AWS::EC2::VPC           my-3tier-app-vpc
> CREATE_IN_PROGRESS  AWS::EC2::Subnet        my-3tier-app-public-subnet-1
> ...
> CREATE_IN_PROGRESS  AWS::RDS::DBInstance    my-3tier-app-db  ← 가장 오래 걸림
> ...
> CREATE_COMPLETE     AWS::CloudFormation::Stack  my-3tier-infra
> ```
>
> 최종 Status가 `CREATE_COMPLETE`로 표시되면 모든 리소스가 정상 생성된 것입니다.

> [!TIP]
> RDS 생성이 가장 오래 걸립니다 (약 8~10분). 이 시간 동안 Step 9-2의 Vue.js
> 프로젝트 생성을 미리 시작해도 좋습니다.

✅ **태스크 완료** — CloudFormation으로 전체 인프라를 한 번에 구축했습니다.

> [!TROUBLESHOOTING]
> | 증상 | 원인 | 해결 방법 |
> |------|------|-----------|
> | `CREATE_FAILED` (RDS) | 비밀번호가 8자 미만 또는 특수문자 제한 위반 | 8자 이상, `/`, `@`, `"`, 공백 제외한 비밀번호 사용 |
> | `CREATE_FAILED` (Subnet) | CIDR 범위 겹침 또는 VPC 범위 초과 | 파라미터 기본값 그대로 사용 |
> | 스택 생성 10분 후 `ROLLBACK_IN_PROGRESS` | 리소스 한도 초과 (VPC 5개 제한 등) | 사용하지 않는 VPC/EIP 삭제 후 재시도 |
> | `Template format error` | YAML 파일 손상 또는 인코딩 문제 | 파일을 다시 다운로드하여 업로드 |
> | `Capabilities` 체크 안 하고 Submit | IAM 리소스 생성 동의 필요 | 하단 체크박스 확인 후 Submit |

> [!NOTE]
> 스택이 `ROLLBACK_COMPLETE` 상태가 되면 해당 스택을 삭제한 후 다시 생성해야 합니다.
> Events 탭에서 가장 먼저 실패한 리소스의 **Status reason**을 확인하면 원인을 파악할 수 있습니다.

---

## 태스크 4: 인프라 확인

CloudFormation이 생성한 리소스를 확인합니다.

### 4-1. CloudFormation Outputs 확인

23. CloudFormation → **Stacks** → `my-3tier-infra` 클릭
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
> 이 값들은 Step 9-2, 9-3에서 계속 사용됩니다. 반드시 메모해두세요!
> 특히 RDSEndpoint, S3BucketName, ALBDNSName은 필수입니다.

> [!TIP]
> Outputs 값을 메모장에 복사해두거나, 다음 CLI 명령으로 한 번에 확인할 수 있습니다:
>
> ```bash
> aws cloudformation describe-stacks --stack-name my-3tier-infra \
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
> RDS 인스턴스 상세 정보:
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
39. **DNS name**을 복사합니다 (Step 9-3에서 사용).
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

> [!CONCEPT] CloudFormation의 장점
>
> 수동으로 하나씩 만들면 30분 이상 걸리고 실수할 수 있는 인프라를
> CloudFormation으로 10분 만에 정확하게 구축했습니다.
> 또한 삭제할 때도 스택 하나만 삭제하면 모든 리소스가 정리됩니다.

✅ **태스크 완료** — CloudFormation이 생성한 모든 리소스를 확인했습니다.

---

# 🗑️ 리소스 정리

> [!WARNING]
> 이 세션에서 생성한 리소스를 지금 삭제하지 마세요!
> Step 9-2, 9-3, 9-4에서 계속 사용합니다.
> **Step 9-4에서 전체 정리합니다.**

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
> 실습을 하루 안에 완료하기 어렵다면, CloudFormation 스택을 삭제하고
> 다음 실습 시 다시 생성하는 것이 비용을 절약하는 방법입니다.
> 스택 생성은 10~15분이면 완료됩니다.

✅ **실습 종료**: Step 9-2에서 Vue.js 프론트엔드를 배포합니다.

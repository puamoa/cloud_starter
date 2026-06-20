---
title: 'Amazon RDS용 DB Subnet Group 생성 및 배치 전략'
week: 4
session: 1
awsServices:
  - Amazon RDS
  - Amazon VPC
learningObjectives:
  - DB Subnet Group의 개념과 최소 2개 AZ가 필요한 이유를 설명할 수 있습니다.
  - Amazon RDS의 Public vs Private 배치 전략을 비교할 수 있습니다.
  - DB Subnet Group을 생성하고 Amazon RDS 인스턴스를 배포할 수 있습니다.
  - Amazon EC2에서 Amazon RDS MySQL에 접속하여 동작을 확인할 수 있습니다.
prerequisites:
  - AWS 계정 생성 완료
  - Amazon VPC + Private Subnet 2개 + Security Group 필요
estimatedCost: 크레딧 내 사용 가능 (비용 발생 가능)
---

이 실습에서는 Amazon RDS를 배포하기 위한 DB Subnet Group을 생성하고, Amazon RDS MySQL 인스턴스를 Private Subnet에 배치합니다.  
Amazon EC2에서 MySQL Client를 설치하여 Amazon RDS에 접속하고 정상 동작을 확인합니다.

### 실습 흐름

```
[선행 리소스] → [개념 이해] → [Subnet Group 생성] → [Amazon RDS MySQL 생성] → [Amazon EC2에서 접속 테스트]
```

> [!WARNING]
> **비용 주의**: 아래 표를 참고하여 비용을 관리하세요.
>
> | 플랜 유형 | Amazon RDS 무료 조건 | 초과 시 비용 |
> | --------- | ------------- | ------------ |
> | **Free Plan** (2025.07.15 이후 가입) | 6개월간 db.t3.micro/db.t4g.micro 사용 가능 + $100 크레딧 | 크레딧 차감 후 종량 과금 |
> | **레거시 Free Tier** (2025.07.15 이전 가입) | 12개월간 750시간/월 db.t3.micro/db.t4g.micro | 초과 시 ~ $0.026/시간 |
>
> | 리소스 | 예상 비용 (무료 초과 시) |
> | ------ | ----------------------- |
> | Amazon RDS db.t3.micro | ~ $0.026/시간 ( ~ $18.7/월) |
> | Amazon RDS 스토리지 20GB (gp2) | ~ $2.6/월 |
> | Amazon EC2 t2.micro | ~ $0.0144/시간 ( ~ $10/월) |
>
> ※ 위 금액은 서울 리전 기준 참고 값이며, 실제 요금은 변동될 수 있습니다.
>
> 실습이 끝나면 **Amazon RDS 인스턴스 + DB Subnet Group + Amazon EC2**를 반드시 삭제하세요.

> [!NOTE]
> 이 실습은 Amazon VPC, Private Subnet 2개(서로 다른 AZ), Security Group이 필요합니다.  
> Step 1에서 생성한 Amazon VPC가 있다면 그것을 사용합니다. 없다면 태스크 0의 CloudFormation으로 생성합니다.

---

## 태스크 0: 선행 리소스 생성 (CloudFormation)

> [!DOWNLOAD]
> [step4-1-rds-lab.zip](/files/step4/step4-1-rds-lab.zip)
>
> - `step4-1-rds-prereq.yaml` - CloudFormation 템플릿 (VPC, 서브넷 4개, IGW, Route Table, Security Group 자동 생성)

이미 Step 1에서 생성한 VPC(`my-vpc`), Public/Private Subnet 2개(서로 다른 AZ), Security Group이 있다면 이 태스크를 건너뛰고 태스크 1로 이동합니다.

1. AWS Management Console에 로그인합니다.
2. 우측 상단에서 리전을 **Asia Pacific (Seoul) ap-northeast-2**로 설정합니다.

    <img src="/images/common/region-check.png" alt="리전 확인" class="guide-img-sm" />

> [!TIP]
> 일부 AWS 서비스(IAM, CloudFront, Route 53 등)는 **글로벌 서비스**이므로 리전 선택 드롭다운이 비활성화되거나 "Global"로 표시됩니다.  
> 이 실습에서 사용하는 서비스는 리전 기반이므로 반드시 올바른 리전이 선택되어 있는지 확인하세요.

3. 상단 검색창에 `CloudFormation`을 입력하고 **CloudFormation** 서비스를 선택합니다.
4. [[Create stack]] 드롭다운을 클릭한 후 **With new resources (standard)**를 선택합니다.
5. **Prerequisite - Prepare template**에서 `Choose an existing template`을 선택합니다.
6. **Specify template**에서 `Upload a template file`을 선택합니다.
7. [[Choose file]] 버튼을 클릭하고 다운로드한 `step4-1-rds-prereq.yaml` 파일을 선택합니다.

    <img src="/images/step4/4-1-step7-upload-template.png" alt="템플릿 업로드" class="guide-img-sm" />

8. [[Next]] 버튼을 클릭합니다.
9. **Stack name**에 `rds-lab-prereq`를 입력합니다.
10. **Parameters** 섹션에서 기본값을 확인합니다. 특별한 이유가 없다면 기본값을 유지합니다.

    <img src="/images/step4/4-1-step10-parameters.png" alt="Parameters 설정" class="guide-img-sm" />

11. [[Next]] 버튼을 클릭합니다.
12. **Configure stack options** 페이지에서 추가 설정 없이 아래로 스크롤합니다.

    <img src="/images/step4/4-1-step12-stack-options.png" alt="Stack options" class="guide-img-sm" />

13. [[Next]] 버튼을 클릭합니다.
14. **Review and create** 페이지에서 설정을 확인합니다.

    <img src="/images/step4/4-1-step14-review.png" alt="Review and create" class="guide-img-sm" />

15. [[Submit]] 버튼을 클릭합니다.
16. 스택 상태가 `CREATE_COMPLETE`가 될 때까지 기다립니다 (약 1~2분).

    <img src="/images/step4/4-1-step16-create-complete.png" alt="CREATE_COMPLETE" class="guide-img-sm" />

> [!NOTE]
> 스택 생성이 완료되면 **Outputs** 탭에서 생성된 리소스의 ID를 확인할 수 있습니다.
> VPC ID, Subnet ID, Security Group ID 등을 메모해 두세요.
>
> 이 CloudFormation 템플릿은 다음 리소스를 생성합니다:
>
> - VPC (`my-vpc`, 10.0.0.0/16)
> - Public Subnet 2개 (`my-public-subnet-a`, `my-public-subnet-c`) — 서로 다른 AZ
> - Private Subnet 2개 (`my-private-subnet-a`, `my-private-subnet-c`) — 서로 다른 AZ
> - Internet Gateway + Public Route Table
> - Security Group (`my-ec2-sg`: SSH 22, `my-rds-sg`: MySQL 3306)

✅ **태스크 완료**: 선행 리소스가 CloudFormation으로 생성되었습니다.

---

## 태스크 1: DB Subnet Group 개념 이해

> [!CONCEPT] DB Subnet Group이란?
> DB Subnet Group은 Amazon RDS 인스턴스가 배치될 수 있는 서브넷의 모음입니다.  
> Amazon RDS를 생성할 때 반드시 DB Subnet Group을 지정해야 하며, **최소 2개 이상의 서로 다른 AZ(Availability Zone)에 있는 서브넷**을 포함해야 합니다.
>
> **⚠️ 주의: 어떤 서브넷을 포함하느냐가 중요합니다.**
>
> DB Subnet Group에 Public Subnet과 Private Subnet을 모두 포함하면, Amazon RDS가 **랜덤으로** 그 중 하나에 배치됩니다.  
> Public Subnet에 배치되면 `Public access: Yes` 설정 시 인터넷에 직접 노출될 수 있습니다.  
> **운영 환경에서는 DB Subnet Group에 Private Subnet만 포함하세요.**
>
> ```
> ❌ 잘못된 예: DB Subnet Group = { Public A + Public C + Private A + Private C }
>    → RDS가 Public Subnet에 배치될 수 있음 (보안 위험)
>
> ✅ 올바른 예 (운영): DB Subnet Group = { Private A + Private C }
>    → RDS가 반드시 Private Subnet에만 배치됨 (안전)
>
> ⚠️ 테스트용: DB Subnet Group = { Public A + Public C } + Public access: Yes
>    → 외부에서 직접 접속 가능 (MySQL Workbench 등). 운영에서는 절대 사용 금지!
> ```
>
> **디폴트 DB Subnet Group:**
>
> RDS 생성 시 DB Subnet Group을 선택하지 않으면 AWS가 자동 생성한 `default` 그룹이 사용됩니다.  
> 이 그룹은 VPC의 **모든 서브넷**(Public + Private)을 포함하므로, RDS가 의도치 않은 서브넷에 배치될 수 있습니다.  
> **목적에 맞는 커스텀 DB Subnet Group을 직접 만들어 사용하는 것을 권장합니다.**  
> (운영용: Private만 포함 / 개발·테스트용: Public만 포함 등)
>
> **왜 2개 AZ가 필요한가?**
>
> Amazon RDS는 고가용성(Multi-AZ) 배포를 지원합니다.  
> Single-AZ로 생성하더라도, AWS는 향후 Multi-AZ 전환이나 장애 복구를 위해 최소 2개 AZ를 요구합니다.
>
> ```
> Region: ap-northeast-2 (Seoul)
> ┌─────────────────────────────────────────────────────────────┐
> │                      VPC (10.0.0.0/16)                      │
> │                                                             │
> │    ┌──── AZ-a ────────────┐    ┌──── AZ-c ───────────┐      │
> │    │                      │    │                     │      │
> │    │  Public Subnet       │    │  Public Subnet      │      │
> │    │  10.0.1.0/24         │    │  10.0.2.0/24        │      │
> │    │  [EC2 - App Server]  │    │                     │      │
> │    │                      │    │                     │      │
> │    │  Private Subnet      │    │  Private Subnet     │      │
> │    │  10.0.11.0/24        │    │  10.0.12.0/24       │      │
> │    │  [RDS - Primary]     │    │  [RDS - Standby]    │      │
> │    │                      │    │                     │      │
> │    └──────────────────────┘    └─────────────────────┘      │
> │                                                             │
> │  DB Subnet Group = { Private Subnet A + Private Subnet C }  │
> └─────────────────────────────────────────────────────────────┘
> ```
>
> **Public vs Private 배치 전략:**
>
> | 배치 방식      | 설명                                       | 보안 수준 | 사용 사례            |
> | -------------- | ------------------------------------------ | --------- | -------------------- |
> | Private Subnet | 인터넷에서 직접 접근 불가                  | 높음      | 운영 환경 (권장)     |
> | Public Subnet  | 인터넷에서 직접 접근 가능 (Public IP 할당) | 낮음      | 개발/테스트 (비권장) |
>
> **운영 환경에서는 반드시 Private Subnet에 Amazon RDS를 배치합니다.**  
> 이 실습에서도 Private Subnet에 Amazon RDS를 배치하고, 같은 VPC 내의 EC2에서만 접속합니다.

<img src="/images/step4/4-1-architecture.png" alt="Step 4 아키텍처" class="guide-img-lg" />

✅ **태스크 완료**: DB Subnet Group의 개념과 2개 AZ가 필요한 이유를 이해했습니다.

---

## 태스크 2: DB Subnet Group 생성

이 태스크에서는 Amazon RDS 인스턴스를 배치할 DB Subnet Group을 AWS 콘솔에서 생성합니다.

17. 상단 검색창에 `RDS`를 입력하고 **Aurora and RDS** 서비스를 선택합니다.

    <img src="/images/step4/4-1-step17-rds-console.png" alt="RDS 콘솔" class="guide-img-sm" />
18. 왼쪽 메뉴에서 **Subnet groups**를 선택합니다.

    <img src="/images/step4/4-1-step18-subnet-groups.png" alt="Subnet groups 메뉴" class="guide-img-sm" />
19. [[Create DB subnet group]] 버튼을 클릭합니다.
20. 다음과 같이 설정합니다:

    **Subnet group details:**

    - **Name**: `my-db-subnet-group`
    - **Description**: `DB Subnet Group for RDS lab`
    - **VPC**: 드롭다운에서 `my-vpc`를 선택합니다.

    <img src="/images/step4/4-1-step20-subnet-details.png" alt="Subnet group details" class="guide-img-sm" />

21. **Add subnets** 섹션에서 **Availability Zones** 드롭다운을 클릭하고 다음 2개를 선택합니다:
    - `ap-northeast-2a`
    - `ap-northeast-2c`

    <img src="/images/step4/4-1-step21-az-select.png" alt="AZ 선택" class="guide-img-sm" />

> [!WARNING]
> 반드시 **2개 이상의 서로 다른 AZ**를 선택해야 합니다. 1개만 선택하면 DB Subnet Group 생성이 실패합니다.
>
> <img src="/images/step4/4-1-step21-az-warning.png" alt="AZ 경고" class="guide-img-sm" />

22. **Subnets** 드롭다운에서 **Private Subnet**을 선택합니다:
    - `10.0.11.0/24` (my-private-subnet-a)
    - `10.0.12.0/24` (my-private-subnet-c)

    <img src="/images/step4/4-1-step22-subnet-select.png" alt="Subnet 선택" class="guide-img-sm" />

> [!WARNING]
> **Public Subnet을 선택하지 마세요.**  
> DB Subnet Group에 Public Subnet을 포함하면 Amazon RDS가 인터넷에 노출될 수 있습니다.  
> CIDR 블록을 확인하여 Private Subnet(10.0.11.0/24, 10.0.12.0/24)을 정확히 선택하세요.

> [!TIP]
> 어떤 서브넷이 Private인지 모르겠다면:
>
> 1. 새 탭에서 **VPC** 서비스 → **Subnets**로 이동합니다.
> 2. 각 서브넷의 **Route table** 탭을 확인합니다.
> 3. `0.0.0.0/0 → igw-xxx` 경로가 **없는** 서브넷이 Private Subnet입니다.

> [!TIP]
> DB Subnet Group에는 콘솔에서 직접 태그를 추가하는 옵션이 없습니다.  
> 생성 후 Subnet groups 목록에서 해당 그룹을 클릭 → **Tags** 탭에서 추가할 수 있습니다.
>
> - `CreatedBy` = `admin-user`
> - `Step` = `step4`
> - `Session` = `4-1`
>
> <img src="/images/step4/4-1-step23-tag1.png" alt="Tags 탭" class="guide-img-sm" />
>
> <img src="/images/step4/4-1-step23-tag2.png" alt="태그 추가" class="guide-img-sm" />
>
> 리소스 정리 시 Tag Editor로 한눈에 확인하려면 태그 추가를 권장합니다.  
> 실무에서도 환경별(dev/staging/prod) 또는 프로젝트별로 태그를 붙여 그룹을 구분하면 관리가 편해집니다.

23. [[Create]] 버튼을 클릭합니다.

    <img src="/images/step4/4-1-step23-created.png" alt="Subnet Group 생성 완료" class="guide-img-sm" />

> [!OUTPUT]
> "Successfully created my-db-subnet-group. View subnet group" 메시지가 표시됩니다.
>
> Subnet groups 목록에서 생성된 그룹을 확인할 수 있습니다:
>
> | Name               | VPC    | Status   | AZs                              |
> | ------------------ | ------ | -------- | -------------------------------- |
> | my-db-subnet-group | my-vpc | Complete | ap-northeast-2a, ap-northeast-2c |

> [!TROUBLESHOOTING]
> **DB Subnet Group 생성 실패 시:**
>
> | 증상                                                      | 원인                  | 해결 방법                                                  |
> | --------------------------------------------------------- | --------------------- | ---------------------------------------------------------- |
> | "DB Subnet Group doesn't meet availability zone coverage" | AZ가 1개만 선택됨     | 2개 이상의 서로 다른 AZ를 선택하세요                       |
> | "The DB subnet group doesn't meet the requirements"       | 서브넷이 1개만 포함됨 | 서로 다른 AZ에 있는 서브넷 2개 이상을 추가하세요           |
> | VPC 드롭다운에 VPC가 안 보임                              | 리전이 다름           | 우측 상단에서 `ap-northeast-2` (Seoul) 리전인지 확인하세요 |

✅ **태스크 완료**: DB Subnet Group이 생성되었습니다.

---

## 태스크 3: RDS MySQL 인스턴스 생성

> [!CONCEPT] Amazon RDS (Relational Database Service)
> Amazon RDS는 AWS 관리형 관계형 데이터베이스 서비스입니다.  
> 데이터베이스 엔진 설치, 패치, 백업, 복구를 AWS가 관리하므로 운영 부담이 줄어듭니다.
>
> **지원 엔진:** MySQL, PostgreSQL, MariaDB, Oracle, SQL Server, Aurora
>
> ```
> Amazon EC2 (Application)
>     ↓ MySQL 프로토콜 (Port 3306)
> Amazon RDS MySQL (Private Subnet)
>     ↓ 자동 백업
> Amazon S3 (Backup Storage)
>
> 사용자 관리 영역: 쿼리 최적화, 스키마 설계
> AWS 관리 영역:   OS 패치, DB 엔진 업데이트, 백업, 장애 복구
> ```

이 태스크에서는 Sandbox 템플릿을 사용하여 Amazon RDS MySQL 인스턴스를 생성합니다.

24. Amazon RDS 콘솔 왼쪽 메뉴에서 **Databases**를 선택합니다.
25. 우측 상단의 [[Create database ▾]] 드롭다운을 클릭하고 **Full configuration**을 선택합니다.

    <img src="/images/step4/4-1-step25-create-db.png" alt="Create database" class="guide-img-sm" />

> [!NOTE]
> **Create database 드롭다운 옵션:**
>
> | 옵션 | 설명 | 이 실습에서 |
> | ---- | ---- | ----------- |
> | **Express configuration** | AWS 권장 설정으로 빠르게 생성 (옵션 최소화) | ❌ 사용 안 함 |
> | **Full configuration** | 모든 설정을 직접 지정 (학습에 적합) | ✅ 선택 |
> | **Restore from S3** | S3에 저장된 백업에서 복원 | ❌ 사용 안 함 |
>
> Full configuration을 선택해야 DB Subnet Group, Security Group, Parameter Group 등을 직접 지정할 수 있습니다.

**Engine options:**

26. **Engine type**: `MySQL`을 선택합니다.

    <img src="/images/step4/4-1-step26-engine.png" alt="Engine type 선택" class="guide-img-sm" />

**Choose a database creation method:**

27. `Full configuration`을 선택합니다.

> [!NOTE]
> | 옵션 | 설명 |
> | ---- | ---- |
> | **Full configuration** | 모든 설정을 직접 제어. 학습 및 운영에 적합 |
> | **Easy create** | AWS 권장 설정 자동 적용. 빠르지만 세부 제어 불가 |

**Templates:**

28. `Sandbox`를 선택합니다.

> [!NOTE]
> | 템플릿 | 설명 | 이 실습에서 |
> | ------ | ---- | ----------- |
> | **Production** | Multi-AZ, 고성능 인스턴스 (비용 높음) | ❌ |
> | **Dev/Test** | 개발/테스트용 (Single-AZ, 중간 사양) | ❌ |
> | **Sandbox** | 학습/실험용 (Single-AZ, db.t4g.micro, 최소 비용) | ✅ 선택 |
>
> **2025.07.15 이후 가입자 (Free Plan):**  
> Sandbox 템플릿으로 db.t4g.micro를 6개월간 사용할 수 있습니다.  
> 6개월 초과 또는 Paid Plan 전환 시 $100 크레딧에서 차감됩니다.
>
> **2025.07.15 이전 가입자 (레거시 Free Tier):**  
> 가입일로부터 12개월간 월 750시간까지 무료입니다.

**Availability and durability:**

29. **Deployment options**: `Single-AZ DB instance deployment (1 instance)`를 선택합니다.

    <img src="/images/step4/4-1-step29-deployment.png" alt="Deployment options" class="guide-img-sm" />

> [!NOTE]
> Sandbox 템플릿 선택 시 자동으로 Single-AZ가 선택됩니다.
>
> | 옵션 | 인스턴스 수 | 가용성 | 비용 |
> | ---- | ----------- | ------ | ---- |
> | Multi-AZ DB cluster (3 instances) | 3개 | 99.99% | 높음 |
> | Multi-AZ DB instance (2 instances) | 2개 | 99.95% | 중간 |
> | **Single-AZ DB instance (1 instance)** | 1개 | 99.5% | 낮음 (학습용) |

**Settings:**

30. 다음과 같이 설정합니다:
    - **Edition**: `MySQL Community` (기본값)
    - **Engine version**: `MySQL 8.4.8` (최신 기본값 유지)
    - ☐ **Enable RDS Extended Support**: 체크 해제 (유료 옵션)
    - **DB instance identifier**: `my-rds-mysql`

    <img src="/images/step4/4-1-step30-settings.png" alt="Settings" class="guide-img-sm" />

**Credentials Settings:**

31. 다음과 같이 설정합니다:
    - **Master username**: `admin`
    - **Credentials management**: `Self managed` 선택
    - ☐ **Auto generate password**: 체크 해제
    - **Master password**: `MyPassword123!` (원하는 비밀번호 입력)
    - **Confirm master password**: 동일한 비밀번호를 다시 입력합니다.

    <img src="/images/step4/4-1-step31-credentials.png" alt="Credentials Settings" class="guide-img-sm" />

> [!WARNING]
> Master password는 반드시 기억해 두세요. 이후 Amazon EC2에서 Amazon RDS에 접속할 때 필요합니다.  
> 비밀번호 제약: 8자 이상, `/`, `'`, `"`, `@` 문자 사용 불가.

> [!NOTE]
> **Credentials management 옵션:**
>
> | 옵션 | 설명 |
> | ---- | ---- |
> | **Managed in AWS Secrets Manager** | AWS가 비밀번호를 자동 관리 (운영 권장, 추가 비용) |
> | **Self managed** | 직접 비밀번호 설정 및 관리 (학습용, 이 실습에서 사용) |

**Instance configuration:**

32. 다음과 같이 설정합니다:
    - **DB instance class**: `Burstable classes (includes t classes)` 선택
    - **Instance type**: `db.t4g.micro` (기본값 — 2 vCPUs, 1 GiB RAM)

    <img src="/images/step4/4-1-step32-instance.png" alt="Instance configuration" class="guide-img-sm" />

> [!NOTE]
> Sandbox 템플릿 선택 시 자동으로 `db.t4g.micro`가 선택됩니다.
>
> | 인스턴스 | CPU 아키텍처 | vCPU | RAM | 특징 |
> | -------- | ------------ | ---- | --- | ---- |
> | db.t4g.micro | arm64 (Graviton2) | 2 | 1GB | 기본 선택, 성능 우수 |
> | db.t3.micro | x86_64 (Intel) | 2 | 1GB | 범용, 호환성 높음 |
>
> 두 인스턴스 모두 Free Tier 대상입니다. 기본 선택(`db.t4g.micro`)을 유지하세요.

**Storage:**

33. 다음과 같이 설정합니다:
    - **Storage type**: `General Purpose SSD (gp2)`
    - **Allocated storage**: `20` GiB
    - **Additional storage configuration** 펼치기 → **Storage autoscaling**: `Enable storage autoscaling` 체크 해제

    <img src="/images/step4/4-1-step33-storage.png" alt="Storage" class="guide-img-sm" />

> [!TIP]
> Storage autoscaling을 비활성화하면 예상치 못한 스토리지 비용 증가를 방지할 수 있습니다.
> 학습 환경에서는 20GB면 충분합니다.

**Connectivity:**

34. 다음과 같이 설정합니다:
    - **Compute resource**: `Don't connect to an EC2 compute resource` 선택
    - **Virtual private cloud (VPC)**: `my-vpc` 선택
    - **DB subnet group**: `my-db-subnet-group` 선택 (태스크 2에서 생성한 것)
    - **Public access**: `No` 선택
    - **VPC security group (firewall)**: `Choose existing` 선택
    - **Existing VPC security groups**: `my-rds-sg` 선택 (기본 `default` SG는 ✕ 버튼으로 제거)
    - **Availability Zone**: `No preference` (기본값 유지)
    - **RDS Proxy**: ☐ 체크 해제 (기본값)
    - **Certificate authority**: 기본값 유지 (`rds-ca-rsa2048-g1`)

    <img src="/images/step4/4-1-step34-connectivity.png" alt="Connectivity" class="guide-img-sm" />

> [!WARNING]
> **Public access**를 반드시 `No`로 설정하세요.  
> `Yes`로 설정하면 Amazon RDS에 Public IP가 할당되어 인터넷에서 직접 접근이 가능해집니다.

> [!NOTE]
> **Security Group 설정 확인:**  
> `my-rds-sg`는 MySQL 포트(3306)를 EC2 Security Group에서만 허용하는 Security Group입니다.  
> 기본 `default` Security Group이 자동 추가되어 있다면 ✕ 버튼을 클릭하여 제거하세요.

**Tags:**

35. [[Add new tag]]를 클릭하여 다음 태그를 추가합니다:
    - `CreatedBy` = `admin-user`
    - `Step` = `step4`
    - `Session` = `4-1`

    <img src="/images/step4/4-1-step35-tags.png" alt="Tags" class="guide-img-sm" />

**Monitoring:**

36. 다음과 같이 설정합니다:
    - **Database Insights**: `Database Insights - Standard` 선택 (기본값)
    - **Additional monitoring settings** 펼치기:
      - ☐ **Enable Enhanced monitoring**: 체크 해제

    <img src="/images/step4/4-1-step36-monitoring.png" alt="Monitoring" class="guide-img-sm" />

> [!TIP]
> Enhanced Monitoring은 추가 비용이 발생할 수 있으므로 학습 환경에서는 비활성화합니다.

**Additional configuration** 섹션을 펼칩니다 (▶ 클릭하여 확장):

37. 다음과 같이 설정합니다:

    **Database options:**
    - **Initial database name**: `mydb`
    - **DB parameter group**: `default.mysql8.4` (기본값 유지)
    - **Option group**: `default:mysql-8-4` (기본값 유지)

    **Encryption:**
    - ✅ **Enable encryption**: 체크 유지 (기본값, 무료 — 저장 데이터 암호화)

    **Backup:**
    - ☐ **Enable automated backup**: 체크 해제

    > [!NOTE]
    > **Automated backup이란?**  
    > 매일 지정 시간에 DB 전체를 자동 백업(스냅샷)하고, 보존 기간 내 원하는 시점으로 복원(Point-in-time Recovery)할 수 있는 기능입니다.  
    > 운영 환경에서는 필수이지만, 이 실습에서는 불필요하며 삭제 시 스냅샷 관련 옵션이 추가되어 복잡해지므로 비활성화합니다.

    **Maintenance:**
    - ✅ **Enable auto minor version upgrade**: 체크 유지 (기본값)
    - **Maintenance window**: `No preference` (기본값)

    **Deletion protection:**
    - ☐ **Enable deletion protection**: 체크 해제

    <img src="/images/step4/4-1-step37-additional.png" alt="Additional configuration" class="guide-img-sm" />

> [!WARNING]
> **Deletion protection**이 체크되어 있으면 실습 후 Amazon RDS를 삭제할 수 없습니다.  
> 학습 환경에서는 반드시 체크 해제하세요.

> [!TIP]
> **Initial database name**에 `mydb`를 입력하면 Amazon RDS 생성 시 자동으로 데이터베이스가 만들어집니다.  
> 비워두면 빈 MySQL 서버만 생성되고, 접속 후 수동으로 `CREATE DATABASE`를 실행해야 합니다.

38. [[Create database]] 버튼을 클릭합니다.

    <img src="/images/step4/4-1-step38-create-db.png" alt="Create database" class="guide-img-sm" />

> [!OUTPUT]
> "Creating database my-rds-mysql" 메시지가 표시됩니다.
> Databases 목록에서 상태를 확인할 수 있습니다:
>
> | DB identifier | Status   | Engine | Size        |
> | ------------- | -------- | ------ | ----------- |
> | my-rds-mysql  | Creating | MySQL  | db.t4g.micro |
>
> **Amazon RDS 생성에는 약 5~10분이 소요됩니다.** 상태가 `Available`이 될 때까지 기다립니다.

> [!NOTE]
> Amazon RDS 인스턴스 상태 변화:
>
> - **Creating**: 생성 중 (5~10분 소요)
> - **Backing-up**: 초기 백업 중
> - **Available**: 사용 가능 (접속 가능)
> - **Modifying**: 설정 변경 중
> - **Deleting**: 삭제 중
>
> `Available` 상태가 되면 **Endpoint**를 확인할 수 있습니다.

39. 상태가 `Available`이 되면 `my-rds-mysql`을 클릭하여 상세 정보를 확인합니다.

    <img src="/images/step4/4-1-step39-creating.png" alt="RDS Creating" class="guide-img-sm" />
40. **Connectivity & security** 탭에서 **Endpoint**를 메모합니다.

    <img src="/images/step4/4-1-step40-endpoint.png" alt="Endpoint 확인" class="guide-img-sm" />

> [!OUTPUT]
> Endpoint 형식:
>
> ```
> my-rds-mysql.xxxxxxxxxxxx.ap-northeast-2.rds.amazonaws.com
> ```

> [!TIP]
> 이 Endpoint가 Amazon EC2에서 Amazon RDS에 접속할 때 사용하는 호스트 주소입니다.
> Port는 `3306` (MySQL 기본 포트)입니다.

✅ **태스크 완료**: Amazon RDS MySQL 인스턴스가 생성되었습니다.

---

## 태스크 4: Amazon EC2 생성 + MySQL Client 설치 + Amazon RDS 접속 테스트

> [!CONCEPT] Amazon EC2에서 Amazon RDS 접속 구조
> Amazon RDS는 Private Subnet에 있으므로 인터넷에서 직접 접속할 수 없습니다.  
> 같은 Amazon VPC 내의 Amazon EC2 인스턴스에서 MySQL Client를 사용하여 접속합니다.
>
> ```
> 로컬 PC
>     ↓ SSH (Port 22)
> Amazon EC2 (Public Subnet, my-public-subnet-a)
>     ↓ MySQL 프로토콜 (Port 3306)
> Amazon RDS MySQL (Private Subnet, my-private-subnet-a 또는 b)
>
> Security Group 흐름:
> [my-ec2-sg]  → 인바운드: SSH(22) from 0.0.0.0/0
> [my-rds-sg]  → 인바운드: MySQL(3306) from 10.0.0.0/16 (VPC 내부만)
> ```

### Amazon EC2 인스턴스 생성

41. 상단 검색창에 `EC2`를 입력하고 **EC2** 서비스를 선택합니다.
42. 왼쪽 메뉴에서 **Instances**를 선택합니다.

    <img src="/images/step4/4-1-step42-ec2-instances.png" alt="EC2 Instances" class="guide-img-sm" />
43. [[Launch instances]] 버튼을 클릭합니다.

**Name and tags:**

44. **Name**: `my-rds-client`를 입력합니다.
    - [[Add additional tags]]를 클릭하여 다음 태그를 추가합니다:
    - `CreatedBy` = `admin-user`
    - `Step` = `step4`
    - `Session` = `4-1`

    <img src="/images/step4/4-1-step44-name-tags.png" alt="Name and tags" class="guide-img-sm" />

**Application and OS Images (Amazon Machine Image):**

45. **Quick Start** 탭 → **Amazon Linux** 선택 → `Amazon Linux 2023 AMI` 확인 (기본 선택됨)

> [!NOTE]
> "Free tier eligible" 배지가 표시된 AMI를 선택하세요.  
> Architecture는 `64-bit (Arm)` 또는 `64-bit (x86)` 모두 가능합니다.

**Instance type:**

46. `t3.micro`를 선택합니다.

    <img src="/images/step4/4-1-step46-instance-type.png" alt="Instance type" class="guide-img-sm" />

> [!NOTE]
> 이 실습에서는 MySQL Client만 실행하므로 `t3.micro` (1GB RAM)로 충분합니다.

**Key pair (login):**

47. 기존 키 페어를 선택합니다. 없으면 [[Create new key pair]]를 클릭하여 생성합니다:
    - **Key pair name**: `my-keypair`
    - **Key pair type**: `RSA`
    - **Private key file format**: `.pem`
    - [[Create key pair]] 클릭 → 파일이 자동 다운로드됩니다.

> [!WARNING]
> 키 페어 파일(.pem)은 **한 번만 다운로드** 가능합니다. 분실하면 인스턴스에 SSH 접속할 수 없습니다.  
> 안전한 곳에 보관하세요 (예: `~/Downloads/my-keypair.pem`).

**Network settings** → [[Edit]] 버튼을 클릭합니다:

48. 다음과 같이 설정합니다:
    - **VPC**: `my-vpc` 선택
    - **Subnet**: `my-public-subnet-a` 선택
    - **Auto-assign public IP**: `Enable`
    - **Firewall (security groups)**: `Select existing security group` 선택
    - **Common security groups**: `my-ec2-sg` 선택

    <img src="/images/step4/4-1-step48-network.png" alt="Network settings" class="guide-img-sm" />

> [!WARNING]
> Amazon EC2는 반드시 **Public Subnet**에 배치하고 **Auto-assign public IP**를 `Enable`로 설정하세요.  
> Public IP가 없으면 로컬 PC에서 SSH 접속이 불가능합니다.

**Configure storage:**

49. 기본값을 유지합니다:
    - **Root volume**: `8` GiB, `gp3`, 3000 IOPS (기본값)
    - **File systems**: `None` 선택 (기본값)

    <img src="/images/step4/4-1-step49-storage.png" alt="Configure storage" class="guide-img-sm" />

> [!NOTE]
> MySQL Client만 실행할 용도이므로 8GB 기본 스토리지면 충분합니다.  
> Free Tier에서는 30GB까지 EBS General Purpose(SSD) 스토리지를 사용할 수 있습니다.
>
> **File systems** 옵션은 Amazon EC2에 추가 파일 시스템을 마운트하는 기능입니다:
>
> | 옵션 | 설명 | 이 실습에서 |
> | ---- | ---- | ----------- |
> | S3 Files - new | Amazon S3를 파일 시스템처럼 마운트 | ❌ |
> | EFS | 공유 NFS 스토리지 (여러 EC2에서 동시 접근) | ❌ |
> | FSx | 고성능 파일 시스템 (Windows/Lustre) | ❌ |
> | **None** | 추가 파일 시스템 없음 (Root volume만 사용) | ✅ 선택 |

**Advanced details** 섹션을 펼칩니다 (클릭하여 확장):

<img src="/images/step4/4-1-step50-advanced-top.png" alt="Advanced details" class="guide-img-sm" />

50. 다음과 같이 설정합니다:
    - **IAM instance profile**: 비워둡니다 (이 실습에서는 불필요)
    - 맨 아래로 스크롤하여 **User data** 필드에 다음 스크립트를 붙여넣습니다:

    ```bash
    #!/bin/bash
    dnf install -y mariadb105
    ```

    - 나머지 설정은 모두 기본값을 유지합니다.

    <img src="/images/step4/4-1-step50-userdata.png" alt="User data" class="guide-img-sm" />

> [!NOTE]
> **User Data란?**  
> Amazon EC2 인스턴스가 최초 부팅될 때 `root` 권한으로 자동 실행되는 스크립트입니다.  
> 여기서는 MySQL 호환 클라이언트(`mariadb105`)를 자동 설치하여, SSH 접속 후 별도 설치 없이 바로 Amazon RDS에 접속할 수 있도록 합니다.
>
> **User Data 참고사항:**
> - 반드시 첫 줄에 `#!/bin/bash`를 포함해야 합니다.
> - `root` 권한으로 실행되므로 `sudo`가 필요 없습니다.
> - 실행 로그: `/var/log/cloud-init-output.log`에서 확인 가능
> - 인스턴스 최초 부팅 시 한 번만 실행됩니다 (Stop → Start해도 재실행되지 않음)
> - SSH 접속이 가능해도 스크립트 실행이 완료되지 않았을 수 있으니 1~2분 대기 후 사용하세요.

51. [[Launch instance]] 버튼을 클릭합니다.

    <img src="/images/step4/4-1-step51-launch1.png" alt="Launch instance" class="guide-img-sm" />

    <img src="/images/step4/4-1-step51-launch2.png" alt="Launch 성공" class="guide-img-sm" />

52. 인스턴스 상태가 `Running`이 될 때까지 기다립니다 (약 1~2분).

    <img src="/images/step4/4-1-step52-running.png" alt="Running 상태" class="guide-img-sm" />
53. `my-rds-client`의 **Public IPv4 address**를 메모합니다.

### EC2에 SSH 접속 및 MySQL Client 설치

54. 로컬 터미널에서 EC2에 SSH 접속합니다:

```bash
# 키 파일 권한 설정 (최초 1회)
chmod 400 ~/Downloads/my-keypair.pem

# EC2에 SSH 접속
ssh -i ~/Downloads/my-keypair.pem ec2-user@<EC2-Public-IP>
```

<img src="/images/step4/4-1-step54-ssh.png" alt="SSH 접속" class="guide-img-sm" />

55. `Are you sure you want to continue connecting?` 메시지가 나오면 `yes`를 입력합니다.

> [!OUTPUT]
> EC2에 접속 성공 시 프롬프트가 표시됩니다:
>
> ```
> [ec2-user@ip-10-0-1-xxx ~]$
> ```

56. MySQL Client가 설치되었는지 확인합니다 (User Data로 자동 설치됨):

```bash
mysql --version
```

<img src="/images/step4/4-1-step56-mysql-version.png" alt="mysql --version" class="guide-img-sm" />

> [!OUTPUT]
> ```
> mysql  Ver 15.1 Distrib 10.5.x-MariaDB, for Linux (x86_64)
> ```

> [!TIP]
> 버전 정보가 표시되면 정상 설치된 것입니다.

> [!TROUBLESHOOTING]
> `mysql: command not found` 에러 시:
>
> User Data 실행이 아직 완료되지 않았을 수 있습니다 (부팅 직후 1~2분 소요).  
> 잠시 기다린 후 다시 시도하거나, 수동으로 설치합니다:
>
> ```bash
> sudo dnf install mariadb105 -y
> ```

### Amazon RDS MySQL 접속 테스트

57. MySQL Client로 Amazon RDS에 접속합니다:

```bash
mysql -h <RDS-Endpoint> -u admin -p
```

> [!NOTE]
> `<RDS-Endpoint>`를 태스크 3의 40번에서 메모한 Endpoint로 교체하세요.  
> 예:
> ```bash
> mysql -h my-rds-mysql.xxxxxxxxxxxx.ap-northeast-2.rds.amazonaws.com -u admin -p
> ```
>
> <img src="/images/step4/4-1-step57-endpoint-note.png" alt="Endpoint 확인" class="guide-img-sm" />

<img src="/images/step4/4-1-step57-mysql-connect.png" alt="MySQL 접속" class="guide-img-sm" />

58. `Enter password:` 프롬프트가 나오면 태스크 3에서 설정한 Master password를 입력합니다 (예: `MyPassword123!`).

> [!OUTPUT]
> 접속 성공 시 MySQL 프롬프트가 표시됩니다:
>
> ```
> Welcome to the MariaDB monitor.  Commands end with ; or \g.
> Your MySQL connection id is 20
> Server version: 8.0.xx Source distribution
>
> Type 'help;' or '\h' for help. Type '\c' to clear the current input statement.
>
> MySQL [(none)]>
> ```

59. 데이터베이스 목록을 확인합니다:

```sql
SHOW DATABASES;
```

<img src="/images/step4/4-1-step59-show-databases.png" alt="SHOW DATABASES" class="guide-img-sm" />

> [!OUTPUT]
>
> ```
> +--------------------+
> | Database           |
> +--------------------+
> | information_schema |
> | mydb               |
> | mysql              |
> | performance_schema |
> | sys                |
> +--------------------+
> 5 rows in set (0.00 sec)
> ```

> [!TIP]
> `mydb`가 목록에 있으면 태스크 3에서 설정한 Initial database name이 정상 생성된 것입니다.

60. 테스트 테이블을 생성하고 데이터를 삽입합니다:

```sql
USE mydb;

CREATE TABLE students (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    email VARCHAR(100)
);

INSERT INTO students (name, email) VALUES ('홍길동', 'hong@example.com');
INSERT INTO students (name, email) VALUES ('김철수', 'kim@example.com');

SELECT * FROM students;
```

<img src="/images/step4/4-1-step60-test-data.png" alt="테스트 데이터" class="guide-img-sm" />

> [!OUTPUT]
>
> ```
> +----+-----------+------------------+
> | id | name      | email            |
> +----+-----------+------------------+
> |  1 | 홍길동    | hong@example.com |
> |  2 | 김철수    | kim@example.com  |
> +----+-----------+------------------+
> 2 rows in set (0.00 sec)
> ```

61. MySQL에서 나갑니다:

```sql
EXIT;
```

62. Amazon EC2에서도 나갑니다:

```bash
exit
```

> [!TROUBLESHOOTING]
> **RDS 접속이 안 되는 경우:**
>
> | 증상                                        | 확인 사항                    | 해결 방법                                                                                |
> | ------------------------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------- |
> | `ERROR 2003: Can't connect to MySQL server` | Security Group 인바운드 규칙 | `my-rds-sg`에서 MySQL(3306) 포트가 VPC CIDR(10.0.0.0/16) 또는 Amazon EC2 SG에서 허용되는지 확인 |
> | `ERROR 2003: Can't connect to MySQL server` | EC2와 RDS가 같은 VPC인지     | EC2의 VPC와 RDS의 VPC가 동일한 `my-vpc`인지 확인                                         |
> | `ERROR 2003: Can't connect to MySQL server` | RDS 상태가 Available인지     | RDS 콘솔에서 상태가 `Available`인지 확인 (Creating이면 대기)                             |
> | `ERROR 1045: Access denied for user`        | 비밀번호 오류                | Master password를 정확히 입력했는지 확인. 틀리면 RDS 콘솔에서 비밀번호 재설정 가능       |
> | `Unknown MySQL server host`                 | Endpoint 오타                | RDS 콘솔 → Connectivity & security 탭에서 Endpoint를 다시 복사하세요                     |
> | 타임아웃 (응답 없음)                        | EC2가 Public Subnet에 있는지 | EC2의 서브넷이 Public Subnet이고 Public IP가 할당되었는지 확인                           |

✅ **태스크 완료**: Amazon EC2에서 Amazon RDS MySQL에 성공적으로 접속하고 데이터를 조작했습니다.

---

## 🎯 셀프 미션: 백엔드 프로젝트 DB 세팅

> [!NOTE]
> 이 미션은 선택 사항입니다. 실습에서 생성한 Amazon RDS를 활용하여 실제 프로젝트 데이터베이스를 세팅해 봅니다.

<img src="/images/step4/4-1-self-architecture.png" alt="셀프 미션 아키텍처" class="guide-img-lg" />

### 목표

- Amazon RDS에 애플리케이션용 사용자와 데이터베이스를 생성
- 로컬 Spring Boot에서 Amazon RDS에 접속 확인
- (선택) Amazon EC2에 배포하여 EC2 → RDS 연결 테스트

### 힌트

📍 **Amazon EC2 (SSH 접속 상태)에서 실행:**

```sql
-- 1. 애플리케이션용 사용자 생성 (본인 프로젝트 설정에 맞게 변경)
CREATE USER 'scoula'@'%' IDENTIFIED BY 'Scoula123!';

-- 2. 데이터베이스 생성
CREATE DATABASE scoula_db DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 3. 권한 부여
GRANT ALL PRIVILEGES ON scoula_db.* TO 'scoula'@'%';
FLUSH PRIVILEGES;
```

> [!TIP]
> 사용자명, 비밀번호, 데이터베이스명은 본인 프로젝트의 `application.properties` 설정과 일치시키세요.

📍 **로컬 PC — DB 접속 정보 설정 (본인 프로젝트에 맞게):**

**Spring MVC (레거시) — `application.properties`:**

이 프로젝트는 `@PropertySource`로 `application.properties`를 읽고 HikariCP DataSource를 구성합니다.  
`jdbc.url`의 호스트 부분만 RDS Endpoint로 교체하면 됩니다:

```properties
# 기존 (로컬 MySQL)
#jdbc.url=jdbc:log4jdbc:mysql://localhost:3306/scoula_db

# RDS로 변경
jdbc.url=jdbc:log4jdbc:mysql://<RDS-Endpoint>:3306/scoula_db
jdbc.username=scoula
jdbc.password=Scoula123!
```

**Spring Boot (`application.yml` 또는 `application.properties`):**

```yaml
spring:
  datasource:
    url: jdbc:mysql://<RDS-Endpoint>:3306/scoula_db?useSSL=false&serverTimezone=Asia/Seoul
    username: scoula
    password: Scoula123!
    driver-class-name: com.mysql.cj.jdbc.Driver
```

> [!TIP]
> 핵심은 **호스트 부분만** `localhost` → `<RDS-Endpoint>`로 교체하는 것입니다.  
> 나머지(사용자명, 비밀번호, DB명)는 위 SQL에서 생성한 값과 일치시키세요.

> [!WARNING]
> 로컬에서 Amazon RDS에 직접 접속하려면 Amazon RDS의 **Public access**가 `No`인 상태에서는 접속이 불가능합니다.  
> 두 가지 방법 중 선택하세요:
>
> | 방법 | 설명 | 적합한 상황 |
> | ---- | ---- | ----------- |
> | **SSH 터널링** | 로컬 → EC2 → RDS (EC2를 경유) | Public access: No 유지 (보안 권장) |
> | **Public access 변경** | RDS Modify → Public access: Yes | 빠른 테스트 (보안 약함, 테스트 후 복원) |
>
> **SSH 터널링 예시:**
> ```bash
> ssh -i ~/Downloads/my-keypair.pem -L 3306:<RDS-Endpoint>:3306 ec2-user@<EC2-Public-IP> -N
> ```
> 이후 `application.properties`에서 `jdbc.url`을 `localhost:3306`으로 변경하면 됩니다.

### 확인 포인트

- [ ] Amazon RDS에 `scoula_db` 데이터베이스가 생성됨
- [ ] `scoula` 사용자로 접속하여 `SHOW DATABASES;`에 `scoula_db`가 표시됨
- [ ] 로컬 Spring 앱이 정상 시작됨 (DB 연결 에러 없음)
- [ ] (선택) Amazon EC2에서 Spring 실행 시 Amazon RDS 접속 성공

> [!TIP]
> 이 미션을 완료하면 Step 5-2(S3 연동)에서 동일한 Amazon RDS를 재사용할 수 있습니다.  
> Amazon RDS를 삭제하지 않고 유지하면 다음 실습에서 바로 활용 가능합니다.

---

## 마무리

다음을 성공적으로 수행했습니다:

- DB Subnet Group의 개념과 최소 2개 AZ가 필요한 이유를 이해했습니다.
- DB Subnet Group을 생성하고 Private Subnet 2개를 포함시켰습니다.
- Amazon RDS MySQL 인스턴스를 Free Tier 템플릿으로 생성하고 Private Subnet에 배치했습니다.
- Amazon EC2에서 MySQL Client를 설치하고 Amazon RDS에 접속하여 데이터를 조작했습니다.

---

# 🗑️ 리소스 정리

> [!NOTE]
> **Step 4-2(Parameter Group 설정)를 이어서 진행할 예정이라면** Amazon RDS와 Amazon EC2를 삭제하지 마세요.  
> 4-2에서 동일한 `my-rds-mysql` 인스턴스를 사용합니다.

### 옵션 선택: 유지 vs 삭제

> | 옵션 | 설명 | 비용 영향 |
> | ---- | ---- | --------- |
> | **옵션 A: 유지 (Stop)** | Amazon RDS + Amazon EC2를 정지. 다음 실습에서 재사용 | RDS 스토리지 비용만 ( ~ $2.6/월). EC2 EBS만 ( ~ $0.80/월) |
> | **옵션 B: 완전 삭제** | 모든 리소스 삭제 | 비용 $0 |

---

## 옵션 A: 유지 (Stop)

4-2를 나중에 진행할 예정이라면 Amazon RDS와 Amazon EC2를 정지만 합니다.

1. Amazon RDS 콘솔 → **Databases** → `my-rds-mysql` 선택 → **Actions** → **Stop temporarily**를 클릭합니다.

    <img src="/images/step4/4-1-rm1-stop-temporarily.png" alt="Stop temporarily" class="guide-img-sm" />

2. **Stop DB instance temporarily** 팝업에서:
    - **Acknowledgement**: `I acknowledge that stopping the DB instance...` 체크합니다.
    - **Snapshot - optional**: `Save the DB instance in a snapshot` 체크 해제 (기본값 유지)

    <img src="/images/step4/4-1-rm2-stop-popup.png" alt="Stop 팝업" class="guide-img-sm" />

3. [[Stop temporarily]] 버튼을 클릭합니다.

    <img src="/images/step4/4-1-rm3-stop-confirm1.png" alt="Stop 확인" class="guide-img-sm" />

    <img src="/images/step4/4-1-rm3-stop-confirm2.png" alt="Stopping 상태" class="guide-img-sm" />

> [!TIP]
> **Snapshot 옵션**은 정지 전 현재 상태를 스냅샷으로 저장하는 기능입니다.  
> 스냅샷을 저장하면 나중에 해당 시점으로 복원할 수 있지만, 스냅샷 스토리지 비용이 발생합니다.  
> 학습 환경에서는 체크 해제로 두세요. 데이터가 중요한 운영 환경에서는 활용을 고려합니다.
4. Amazon EC2 콘솔 → **Instances** → `my-rds-client` 선택 → **Instance state** → **Stop instance**를 클릭합니다.
5. 확인 팝업에서 [[Stop]]을 클릭합니다.

> [!WARNING]
> **Amazon RDS Stop 주의사항:**
> - Amazon RDS는 **7일 후 자동으로 다시 시작**됩니다. 7일 이상 사용하지 않을 예정이면 삭제를 권장합니다.
> - 정지 중에도 스토리지 비용은 발생합니다.
>
> **재시작 시 주의사항:**
> - Amazon EC2: Start 후 **Public IP가 변경**됩니다. 새 IP를 확인하고 SSH 접속하세요.
> - Amazon RDS: Start 후 Endpoint는 동일하지만, 가동까지 3~5분 소요됩니다.

✅ **옵션 A 완료**: Amazon RDS와 Amazon EC2가 정지 상태입니다. 4-2에서 Start하여 재사용합니다.

---

## 옵션 B: 완전 삭제

4-2를 진행하지 않거나 실습을 완전히 종료하려면 모든 리소스를 삭제합니다.

> [!WARNING]
> **Amazon RDS 인스턴스는 실행 중이면 시간당 과금됩니다.**
>
> - **Free Plan (2025.07.15 이후 가입)**: 6개월간 무료이지만, 실습 완료 후 불필요한 리소스는 삭제하는 습관이 중요합니다.
> - **레거시 Free Tier (2025.07.15 이전 가입)**: 750시간/월 초과 시 과금됩니다.
> - **Free Tier 만료 후**: 방치 시 월 ~$30 이상 발생할 수 있습니다.
>
> | 리소스 | 방치 시 일일 비용 | 방치 시 월 비용 |
> | ------ | ----------------- | --------------- |
> | Amazon RDS db.t3.micro (무료 초과 시) | ~$0.62/일 | ~$18.7/월 |
> | Amazon RDS 스토리지 20GB | ~$0.09/일 | ~$2.6/월 |
> | Amazon EC2 t2.micro | ~$0.35/일 | ~$10/월 |
>
> ※ 위 금액은 서울 리전 기준 참고 값이며, 실제 요금은 변동될 수 있습니다.

### 삭제 순서 (의존 관계)

> [!NOTE]
> 리소스 간 의존 관계가 있으므로 반드시 아래 순서대로 삭제해야 합니다:
>
> ```
> ① Tag Editor로 리소스 확인
> → ② Amazon RDS 인스턴스 삭제 (5~10분 대기)
> → ③ DB Subnet Group 삭제
> → ④ EC2 인스턴스 종료
> → ⑤ CloudFormation 스택 삭제
> → ⑥ Tag Editor로 최종 확인
> ```
>
> Amazon RDS가 DB Subnet Group을 사용 중이므로, Amazon RDS를 먼저 삭제해야 DB Subnet Group을 삭제할 수 있습니다.

---

### 단계 1: Tag Editor로 생성된 리소스 확인

삭제 전에 이 실습에서 생성한 리소스를 확인합니다.

6. 상단 검색창에 `Resource Groups & Tag Editor`를 입력하고 선택합니다.
7. 왼쪽 메뉴에서 **Tag Editor**를 선택합니다.
8. 다음과 같이 설정합니다:
    - **Regions**: `ap-northeast-2`
    - **Resource types**: `All supported resource types`
    - **Tag key**: `Session`
    - **Tag value**: `4-1`
9. [[Search resources]] 버튼을 클릭합니다.

    <img src="/images/step4/4-1-rm9-tag-editor.png" alt="Tag Editor 검색 결과" class="guide-img-sm" />

10. 이 실습에서 생성한 리소스(RDS, EC2, Security Group 등)가 표시되는지 확인합니다.

> [!TIP]
> Tag Editor는 리소스를 찾는 용도로만 사용합니다. 실제 삭제는 다음 단계에서 수행합니다.

---

### 단계 2: Amazon RDS 인스턴스 삭제

11. 상단 검색창에 `RDS`를 입력하고 **Aurora and RDS** 서비스를 선택합니다.
12. 왼쪽 메뉴에서 **Databases**를 선택합니다.
13. `my-rds-mysql`을 선택합니다 (라디오 버튼 클릭).
14. 상단 **Actions** → **Delete**를 클릭합니다.

    <img src="/images/step4/4-1-rm14-delete-popup.png" alt="Delete 클릭" class="guide-img-sm" />

15. 삭제 확인 팝업에서:
    - ☐ **Create final snapshot**: 체크 해제 (기본값 유지)
    - ☑ **I acknowledge that upon instance deletion...**: 체크합니다.
    - 확인 입력란에 `delete me`를 입력합니다.

    <img src="/images/step4/4-1-rm15-delete-confirm.png" alt="Delete 확인" class="guide-img-sm" />
16. [[Delete]] 버튼을 클릭합니다.

    <img src="/images/step4/4-1-rm16-deleting.png" alt="Deleting" class="guide-img-sm" />

17. 상태가 `Deleting`으로 변경됩니다. 완전히 삭제될 때까지 약 5~10분 기다립니다.

    <img src="/images/step4/4-1-rm17-deleted.png" alt="삭제 완료" class="guide-img-sm" />

> [!WARNING]
> Amazon RDS 삭제에는 시간이 걸립니다. 상태가 목록에서 사라질 때까지 기다린 후 다음 단계를 진행하세요.

> [!TIP]
> **Create final snapshot**을 체크하면 삭제 전 스냅샷을 생성하여 나중에 복원할 수 있지만, 스냅샷 스토리지 비용이 발생합니다.  
> 학습 환경에서는 체크 해제하세요.

---

### 단계 3: DB Subnet Group 삭제

18. Amazon RDS 콘솔 왼쪽 메뉴에서 **Subnet groups**를 선택합니다.
19. `my-db-subnet-group`을 선택합니다.
20. [[Delete]] 버튼을 클릭합니다.

    <img src="/images/step4/4-1-rm20-subnet-delete.png" alt="Subnet Group 삭제" class="guide-img-sm" />

21. 확인 팝업에서 [[Delete]] 버튼을 클릭합니다.

    <img src="/images/step4/4-1-rm21-subnet-confirm1.png" alt="삭제 확인" class="guide-img-sm" />

    <img src="/images/step4/4-1-rm21-subnet-confirm2.png" alt="삭제 완료" class="guide-img-sm" />

> [!TROUBLESHOOTING]
> **"Cannot delete the subnet group because it is in use" 에러:**
>
> Amazon RDS 인스턴스가 아직 삭제 중입니다. Databases 목록에서 `my-rds-mysql`이 완전히 사라질 때까지 기다린 후 다시 시도하세요 (약 5~10분).

---

### 단계 4: Amazon EC2 인스턴스 종료

22. 상단 검색창에 `EC2`를 입력하고 **EC2** 서비스를 선택합니다.
23. 왼쪽 메뉴에서 **Instances**를 선택합니다.
24. `my-rds-client`를 체크합니다.
25. 상단 **Instance state** → **Terminate instance**를 클릭합니다.

    <img src="/images/step4/4-1-rm25-ec2-terminate.png" alt="Terminate instance" class="guide-img-sm" />

26. 확인 팝업에서 [[Terminate]] 버튼을 클릭합니다.

    <img src="/images/step4/4-1-rm26-ec2-confirm.png" alt="Terminate 확인" class="guide-img-sm" />

27. 인스턴스 상태가 `Shutting down` → `Terminated`로 변경되는 것을 확인합니다.

    <img src="/images/step4/4-1-rm27-ec2-terminated1.png" alt="Shutting down" class="guide-img-sm" />

    <img src="/images/step4/4-1-rm27-ec2-terminated2.png" alt="Terminated" class="guide-img-sm" />

---

### 단계 5: CloudFormation 스택 삭제 (태스크 0에서 생성한 경우)

28. 상단 검색창에 `CloudFormation`을 입력하고 선택합니다.
29. **Stacks** 목록에서 `rds-lab-prereq` 스택을 선택합니다.
30. [[Delete]] 버튼을 클릭합니다.
31. 확인 팝업에서 [[Delete stack]]을 클릭합니다.

    <img src="/images/step4/4-1-rm31-cf-delete.png" alt="Delete stack" class="guide-img-sm" />

32. 스택 상태가 `DELETE_IN_PROGRESS` → `DELETE_COMPLETE`가 될 때까지 기다립니다 (약 2~3분).

    <img src="/images/step4/4-1-rm32-cf-complete.png" alt="DELETE_COMPLETE" class="guide-img-sm" />

> [!NOTE]
> CloudFormation 스택을 삭제하면 스택이 생성한 모든 리소스(VPC, Subnet, IGW, Route Table, Security Group)가 자동으로 삭제됩니다.

> [!TROUBLESHOOTING]
> **스택 삭제가 `DELETE_FAILED` 상태인 경우:**
>
> | 증상                     | 원인                             | 해결 방법                                                          |
> | ------------------------ | -------------------------------- | ------------------------------------------------------------------ |
> | Security Group 삭제 실패 | 다른 리소스가 SG를 참조 중       | Amazon EC2가 Terminated 상태인지 확인 → 1~2분 대기 후 재시도              |
> | Subnet 삭제 실패         | DB Subnet Group이 아직 존재      | 단계 3에서 DB Subnet Group 삭제를 확인 후 재시도                   |
> | "has dependencies" 에러  | 수동 생성 리소스가 VPC를 사용 중 | **Events** 탭에서 실패 원인 확인 → 해당 리소스 수동 삭제 후 재시도 |

---

### 단계 6: 삭제 확인

33. **RDS 콘솔 → Databases**: `my-rds-mysql`이 목록에서 사라졌는지 확인합니다.
34. **RDS 콘솔 → Subnet groups**: `my-db-subnet-group`이 목록에서 사라졌는지 확인합니다.
35. **EC2 콘솔 → Instances**: `my-rds-client`가 `Terminated` 상태인지 확인합니다.
36. **CloudFormation 콘솔**: `rds-lab-prereq` 스택이 목록에서 사라졌는지 확인합니다.

> [!NOTE]
> Terminated 상태의 EC2 인스턴스는 약 1시간 후 콘솔 목록에서 자동으로 사라집니다.

---

### 단계 7: Tag Editor로 최종 확인

37. 상단 검색창에 `Resource Groups & Tag Editor`를 입력하고 선택합니다.
38. 왼쪽 메뉴에서 **Tag Editor**를 선택합니다.
39. 다음과 같이 설정합니다:
    - **Regions**: `ap-northeast-2`
    - **Resource types**: `All supported resource types`
    - **Tag key**: `Session`
    - **Tag value**: `4-1`
40. [[Search resources]] 버튼을 클릭합니다.

    <img src="/images/step4/4-1-rm40-tag-final.png" alt="Tag Editor 최종 확인" class="guide-img-sm" />
41. 검색 결과가 비어있는지 확인합니다.

> [!OUTPUT]
> 결과가 비어있으면 모든 리소스가 정상 정리된 것입니다.  
> 리소스가 남아있다면 해당 리소스를 클릭하여 서비스 콘솔에서 수동 삭제합니다.

> [!TIP]
> `Session: 4-1`로 검색했을 때 결과가 비어있어도, `Step: step4`로도 검색해보세요.  
> 4-2에서 생성한 리소스가 남아있을 수 있습니다.

✅ **실습 종료**: 모든 리소스가 정리되었습니다.

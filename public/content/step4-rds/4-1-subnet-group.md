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
8. [[Next]] 버튼을 클릭합니다.
9. **Stack name**에 `rds-lab-prereq`를 입력합니다.
10. **Parameters** 섹션에서 기본값을 확인합니다. 특별한 이유가 없다면 기본값을 유지합니다.
11. [[Next]] 버튼을 클릭합니다.
12. **Configure stack options** 페이지에서 추가 설정 없이 아래로 스크롤합니다.
13. [[Next]] 버튼을 클릭합니다.
14. **Review and create** 페이지에서 설정을 확인합니다.
15. [[Submit]] 버튼을 클릭합니다.
16. 스택 상태가 `CREATE_COMPLETE`가 될 때까지 기다립니다 (약 1~2분).

> [!NOTE]
> 스택 생성이 완료되면 **Outputs** 탭에서 생성된 리소스의 ID를 확인할 수 있습니다.
> VPC ID, Subnet ID, Security Group ID 등을 메모해 두세요.
>
> 이 CloudFormation 템플릿은 다음 리소스를 생성합니다:
>
> - VPC (`my-vpc`, 10.0.0.0/16)
> - Public Subnet 1개 (`my-public-subnet-a`)
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
> **왜 2개 AZ가 필요한가?**
>
> Amazon RDS는 고가용성(Multi-AZ) 배포를 지원합니다. Single-AZ로 생성하더라도, AWS는 향후 Multi-AZ 전환이나 장애 복구를 위해 최소 2개 AZ를 요구합니다.
>
> ```
> Region: ap-northeast-2 (Seoul)
> ┌─────────────────────────────────────────────────────────┐
> │                        VPC (10.0.0.0/16)                │
> │                                                         │
> │  ┌─── AZ-a ───────────┐    ┌─── AZ-c ───────────┐     │
> │  │                     │    │                     │     │
> │  │  Public Subnet      │    │                     │     │
> │  │  10.0.1.0/24        │    │                     │     │
> │  │  [EC2 - App Server] │    │                     │     │
> │  │                     │    │                     │     │
> │  │  Private Subnet     │    │  Private Subnet     │     │
> │  │  10.0.11.0/24       │    │  10.0.12.0/24       │     │
> │  │  [RDS - Primary]    │    │  [RDS - Standby]    │     │
> │  │                     │    │                     │     │
> │  └─────────────────────┘    └─────────────────────┘     │
> │                                                         │
> │  DB Subnet Group = { Private Subnet A + Private Subnet C }
> └─────────────────────────────────────────────────────────┘
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

✅ **태스크 완료**: DB Subnet Group의 개념과 2개 AZ가 필요한 이유를 이해했습니다.

---

## 태스크 2: DB Subnet Group 생성

이 태스크에서는 Amazon RDS 인스턴스를 배치할 DB Subnet Group을 AWS 콘솔에서 생성합니다.

17. 상단 검색창에 `RDS`를 입력하고 **RDS** 서비스를 선택합니다.
18. 왼쪽 메뉴에서 **Subnet groups**를 선택합니다.
19. [[Create DB subnet group]] 버튼을 클릭합니다.
20. 다음과 같이 설정합니다:

**Subnet group details:**

- **Name**: `my-db-subnet-group`
- **Description**: `DB Subnet Group for RDS lab`
- **VPC**: 드롭다운에서 `my-vpc`를 선택합니다.

**Add subnets:**

21. **Availability Zones** 드롭다운에서 다음 2개를 선택합니다:
    - `ap-northeast-2a`
    - `ap-northeast-2c`

> [!WARNING]
> 반드시 **2개 이상의 서로 다른 AZ**를 선택해야 합니다. 1개만 선택하면 DB Subnet Group 생성이 실패합니다.

22. **Subnets** 드롭다운에서 **Private Subnet**을 선택합니다:
    - `10.0.11.0/24` (my-private-subnet-a)
    - `10.0.12.0/24` (my-private-subnet-c)

> [!WARNING]
> **Public Subnet을 선택하지 마세요.** DB Subnet Group에 Public Subnet을 포함하면 Amazon RDS가 인터넷에 노출될 수 있습니다.
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

23. [[Create]] 버튼을 클릭합니다.

> [!OUTPUT]
> "DB subnet group my-db-subnet-group was created successfully." 메시지가 표시됩니다.
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
> S3 (Backup Storage)
>
> 사용자 관리 영역: 쿼리 최적화, 스키마 설계
> AWS 관리 영역:   OS 패치, DB 엔진 업데이트, 백업, 장애 복구
> ```

이 태스크에서는 Free Tier 템플릿을 사용하여 Amazon RDS MySQL 인스턴스를 생성합니다.

24. Amazon RDS 콘솔 왼쪽 메뉴에서 **Databases**를 선택합니다.
25. [[Create database]] 버튼을 클릭합니다.

**Choose a database creation method:**

26. `Standard create`를 선택합니다.

**Engine options:**

27. **Engine type**: `MySQL`을 선택합니다.
28. **Engine version**: 최신 MySQL 8.4.x 버전을 선택합니다 (기본값 유지).

**Templates:**

29. `Free tier`를 선택합니다.

> [!NOTE]
> Free Tier 템플릿을 선택하면 비용이 최소화되는 설정이 자동 적용됩니다:
>
> - Single-AZ 배포 (Multi-AZ 비활성화)
> - db.t3.micro 또는 db.t4g.micro 인스턴스
> - 20GB gp2 스토리지
>
> **2025.07.15 이후 가입자 (Free Plan):**  
> Free Plan에서 db.t3.micro 또는 db.t4g.micro를 6개월간 사용할 수 있습니다.  
> 6개월 초과 또는 Paid Plan 전환 시 $100 크레딧에서 차감됩니다.
>
> **2025.07.15 이전 가입자 (레거시 Free Tier):**  
> 가입일로부터 12개월간 월 750시간까지 무료입니다.

**Settings:**

30. 다음과 같이 설정합니다:
    - **DB instance identifier**: `my-rds-mysql`
    - **Master username**: `admin`
    - **Credentials management**: `Self managed` 선택
    - **Master password**: `MyPassword123!` (원하는 비밀번호 입력)
    - **Confirm master password**: 동일한 비밀번호를 다시 입력합니다.

> [!WARNING]
> Master password는 반드시 기억해 두세요. 이후 Amazon EC2에서 Amazon RDS에 접속할 때 필요합니다.
> 비밀번호 요구사항: 8자 이상, 영문 대소문자 + 숫자 + 특수문자 조합 권장.

**Instance configuration:**

31. **DB instance class**: `db.t3.micro` (Free Tier eligible 표시 확인)

> [!NOTE]
> Free Tier 템플릿 선택 시 자동으로 적합한 인스턴스가 선택됩니다.
>
> | 인스턴스 | CPU 아키텍처 | vCPU | RAM | 특징 |
> | -------- | ------------ | ---- | --- | ---- |
> | db.t3.micro | x86_64 (Intel) | 2 | 1GB | 범용, 호환성 높음 |
> | db.t4g.micro | arm64 (Graviton2) | 2 | 1GB | 최대 20% 저렴, 성능 우수 |
>
> 두 인스턴스 모두 Free Tier 대상입니다. 특별한 이유가 없다면 기본 선택을 유지하세요.

**Storage:**

32. 다음과 같이 설정합니다:
    - **Storage type**: `General Purpose SSD (gp2)`
    - **Allocated storage**: `20` GiB
    - **Storage autoscaling**: `Enable storage autoscaling` 체크 해제

> [!TIP]
> Storage autoscaling을 비활성화하면 예상치 못한 스토리지 비용 증가를 방지할 수 있습니다.
> 학습 환경에서는 20GB면 충분합니다.

**Connectivity:**

33. 다음과 같이 설정합니다:
    - **Compute resource**: `Don't connect to an EC2 compute resource` 선택
    - **Network type**: `IPv4`
    - **Virtual private cloud (VPC)**: `my-vpc` 선택
    - **DB subnet group**: `my-db-subnet-group` 선택 (태스크 2에서 생성한 것)
    - **Public access**: `No` 선택
    - **VPC security group (firewall)**: `Choose existing` 선택
    - **Existing VPC security groups**: `my-rds-sg` 선택 (기본 default SG는 제거)
    - **Availability Zone**: `No preference` (기본값 유지)

> [!WARNING]
> **Public access**를 반드시 `No`로 설정하세요.
> `Yes`로 설정하면 Amazon RDS에 Public IP가 할당되어 인터넷에서 직접 접근이 가능해집니다.
> 운영 환경에서는 절대 `Yes`를 선택하지 마세요.

> [!NOTE]
> **Security Group 설정 확인:**
> `my-rds-sg`는 MySQL 포트(3306)를 VPC 내부(10.0.0.0/16)에서만 허용하는 Security Group입니다.
> 기본 `default` Security Group이 자동 추가되어 있다면 X 버튼을 클릭하여 제거하세요.

**Database authentication:**

34. **Database authentication options**: `Password authentication` 선택 (기본값)

**Monitoring:**

35. **Enable Enhanced Monitoring**: 체크 해제 (Free Tier에서는 불필요)

**Additional configuration** 섹션을 펼칩니다 (클릭하여 확장):

36. 다음과 같이 설정합니다:
    - **Initial database name**: `mydb`
    - **DB parameter group**: 기본값 유지
    - **Option group**: 기본값 유지
    - **Enable automated backups**: 체크 해제 (학습 환경에서는 불필요)
    - **Enable encryption**: 체크 해제 (Free Tier에서는 기본 비활성화)
    - **Enable auto minor version upgrade**: 체크 유지 (기본값)
    - **Deletion protection**: 체크 해제

> [!WARNING]
> **Deletion protection**이 체크되어 있으면 실습 후 Amazon RDS를 삭제할 수 없습니다.
> 학습 환경에서는 반드시 체크 해제하세요.

> [!TIP]
> **Initial database name**에 `mydb`를 입력하면 Amazon RDS 생성 시 자동으로 데이터베이스가 만들어집니다.
> 비워두면 빈 MySQL 서버만 생성되고, 접속 후 수동으로 `CREATE DATABASE`를 실행해야 합니다.

> [!TIP]
> **Tags 추가 (권장):**  
> Additional configuration 섹션 하단 또는 생성 후 Amazon RDS 상세 페이지의 **Tags** 탭에서 다음 태그를 추가하세요:
> - `CreatedBy` = `admin-user`
> - `Step` = `step4`
> - `Session` = `4-1`
>
> 태그를 추가하면 나중에 Tag Editor에서 이 실습의 리소스를 한눈에 확인하고 정리할 수 있습니다.

37. [[Create database]] 버튼을 클릭합니다.

> [!OUTPUT]
> "Creating database my-rds-mysql" 메시지가 표시됩니다.
> Databases 목록에서 상태를 확인할 수 있습니다:
>
> | DB identifier | Status   | Engine | Size        |
> | ------------- | -------- | ------ | ----------- |
> | my-rds-mysql  | Creating | MySQL  | db.t3.micro |
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

38. 상태가 `Available`이 되면 `my-rds-mysql`을 클릭하여 상세 정보를 확인합니다.
39. **Connectivity & security** 탭에서 **Endpoint**를 메모합니다.

> [!OUTPUT]
> Endpoint 형식:
>
> ```
> my-rds-mysql.xxxxxxxxxxxx.ap-northeast-2.rds.amazonaws.com
> ```
>
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

### EC2 인스턴스 생성

40. 상단 검색창에 `EC2`를 입력하고 **EC2** 서비스를 선택합니다.
41. 왼쪽 메뉴에서 **Instances**를 선택합니다.
42. [[Launch instances]] 버튼을 클릭합니다.
43. 다음과 같이 설정합니다:

**Name and tags:**

- **Name**: `my-rds-client`

**Application and OS Images:**

- **AMI**: `Amazon Linux 2023 AMI` (Free tier eligible 표시 확인)
- **Architecture**: `64-bit (x86)`

**Instance type:**

- `t2.micro` 선택

**Key pair:**

- 기존 키 페어를 선택합니다. 없으면 [[Create new key pair]]를 클릭하여 생성합니다.
  - **Key pair name**: `my-keypair`
  - **Key pair type**: `RSA`
  - **Private key file format**: `.pem`
  - [[Create key pair]] 클릭 → 파일이 자동 다운로드됩니다.

**Network settings** → [[Edit]] 버튼을 클릭합니다:

- **VPC**: `my-vpc` 선택
- **Subnet**: `my-public-subnet-a` 선택
- **Auto-assign public IP**: `Enable`
- **Firewall (security groups)**: `Select existing security group` 선택
- **Common security groups**: `my-ec2-sg` 선택 (SSH 22번 포트가 열린 SG)

> [!WARNING]
> EC2는 반드시 **Public Subnet**에 배치하고 **Auto-assign public IP**를 `Enable`로 설정하세요.
> Public IP가 없으면 로컬 PC에서 SSH 접속이 불가능합니다.

**Tags:**

- [[Add new tag]]를 클릭합니다:
  - `CreatedBy` = `admin-user`
  - `Step` = `step4`
  - `Session` = `4-1`

44. [[Launch instance]] 버튼을 클릭합니다.
45. 인스턴스 상태가 `Running`이 될 때까지 기다립니다 (약 1~2분).
46. `my-rds-client`의 **Public IPv4 address**를 메모합니다.

### EC2에 SSH 접속 및 MySQL Client 설치

47. 로컬 터미널에서 EC2에 SSH 접속합니다:

```bash
# 키 파일 권한 설정 (최초 1회)
chmod 400 ~/Downloads/my-keypair.pem

# EC2에 SSH 접속
ssh -i ~/Downloads/my-keypair.pem ec2-user@<EC2-Public-IP>
```

48. `Are you sure you want to continue connecting?` 메시지가 나오면 `yes`를 입력합니다.

> [!OUTPUT]
> EC2에 접속 성공 시 프롬프트가 표시됩니다:
>
> ```
> [ec2-user@ip-10-0-1-xxx ~]$
> ```

49. MySQL Client를 설치합니다:

```bash
sudo dnf install mariadb105 -y
```

> [!OUTPUT]
> 설치가 완료되면 다음과 같은 메시지가 표시됩니다:
>
> ```
> Complete!
> ```

> [!NOTE]
> Amazon Linux 2023에서는 `mariadb105` 패키지에 MySQL 호환 클라이언트가 포함되어 있습니다.
> MariaDB 클라이언트는 MySQL 서버에 완벽하게 호환됩니다.

### RDS MySQL 접속 테스트

50. MySQL Client로 RDS에 접속합니다:

```bash
mysql -h <RDS-Endpoint> -u admin -p
```

> [!NOTE]
> `<RDS-Endpoint>`를 태스크 3의 39번에서 메모한 Endpoint로 교체하세요.
> 예: `mysql -h my-rds-mysql.xxxxxxxxxxxx.ap-northeast-2.rds.amazonaws.com -u admin -p`

51. `Enter password:` 프롬프트가 나오면 태스크 3에서 설정한 Master password를 입력합니다.

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

52. 데이터베이스 목록을 확인합니다:

```sql
SHOW DATABASES;
```

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
>
> `mydb`가 목록에 있으면 태스크 3에서 설정한 Initial database name이 정상 생성된 것입니다.

53. 테스트 테이블을 생성하고 데이터를 삽입합니다:

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

54. MySQL에서 나갑니다:

```sql
EXIT;
```

55. EC2에서도 나갑니다:

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

## 마무리

다음을 성공적으로 수행했습니다:

- DB Subnet Group의 개념과 최소 2개 AZ가 필요한 이유를 이해했습니다.
- DB Subnet Group을 생성하고 Private Subnet 2개를 포함시켰습니다.
- Amazon RDS MySQL 인스턴스를 Free Tier 템플릿으로 생성하고 Private Subnet에 배치했습니다.
- Amazon EC2에서 MySQL Client를 설치하고 Amazon RDS에 접속하여 데이터를 조작했습니다.

---

# 🗑️ 리소스 정리

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
> ① Amazon RDS 인스턴스 삭제 (5~10분 대기)
> → ② DB Subnet Group 삭제
> → ③ EC2 인스턴스 종료
> → ④ CloudFormation 스택 삭제
> ```
>
> Amazon RDS가 DB Subnet Group을 사용 중이므로, Amazon RDS를 먼저 삭제해야 DB Subnet Group을 삭제할 수 있습니다.

---

### 단계 1: RDS 인스턴스 삭제

1. 상단 검색창에 `RDS`를 입력하고 **RDS** 서비스를 선택합니다.
2. 왼쪽 메뉴에서 **Databases**를 선택합니다.
3. `my-rds-mysql`을 선택합니다 (라디오 버튼 클릭).
4. 상단 **Actions** → **Delete**를 클릭합니다.
5. 삭제 확인 팝업에서:
   - **Create final snapshot?**: `No` 선택 (체크 해제)
   - **I acknowledge that upon instance deletion...**: 체크합니다.
   - **Retain automated backups**: `No` 선택 (체크 해제)
   - 확인 입력란에 `delete me`를 입력합니다.
6. [[Delete]] 버튼을 클릭합니다.
7. 상태가 `Deleting`으로 변경됩니다. 완전히 삭제될 때까지 약 5~10분 기다립니다.

> [!WARNING]
> Amazon RDS 삭제에는 시간이 걸립니다. 상태가 목록에서 사라질 때까지 기다린 후 다음 단계를 진행하세요.
> Final snapshot을 생성하면 스냅샷 스토리지 비용이 발생하므로, 학습 환경에서는 `No`를 선택합니다.

---

### 단계 2: DB Subnet Group 삭제

8. RDS 콘솔 왼쪽 메뉴에서 **Subnet groups**를 선택합니다.
9. `my-db-subnet-group`을 선택합니다.
10. [[Delete]] 버튼을 클릭합니다.
11. 확인 팝업에서 [[Delete]] 버튼을 클릭합니다.

> [!TROUBLESHOOTING]
> **"Cannot delete the subnet group because it is in use" 에러:**
>
> Amazon RDS 인스턴스가 아직 삭제 중입니다. Databases 목록에서 `my-rds-mysql`이 완전히 사라질 때까지 기다린 후 다시 시도하세요 (약 5~10분).

---

### 단계 3: EC2 인스턴스 종료

12. 상단 검색창에 `EC2`를 입력하고 **EC2** 서비스를 선택합니다.
13. 왼쪽 메뉴에서 **Instances**를 선택합니다.
14. `my-rds-client`를 체크합니다.
15. 상단 **Instance state** → **Terminate instance**를 클릭합니다.
16. 확인 팝업에서 [[Terminate]] 버튼을 클릭합니다.
17. 인스턴스 상태가 `Shutting down` → `Terminated`로 변경되는 것을 확인합니다.

---

### 단계 4: CloudFormation 스택 삭제 (태스크 0에서 생성한 경우)

18. 상단 검색창에 `CloudFormation`을 입력하고 선택합니다.
19. **Stacks** 목록에서 `rds-lab-prereq` 스택을 선택합니다.
20. [[Delete]] 버튼을 클릭합니다.
21. 확인 팝업에서 [[Delete stack]]을 클릭합니다.
22. 스택 상태가 `DELETE_IN_PROGRESS` → `DELETE_COMPLETE`가 될 때까지 기다립니다 (약 2~3분).

> [!NOTE]
> CloudFormation 스택을 삭제하면 스택이 생성한 모든 리소스(VPC, Subnet, IGW, Route Table, Security Group)가 자동으로 삭제됩니다.

> [!TROUBLESHOOTING]
> **스택 삭제가 `DELETE_FAILED` 상태인 경우:**
>
> | 증상                     | 원인                             | 해결 방법                                                          |
> | ------------------------ | -------------------------------- | ------------------------------------------------------------------ |
> | Security Group 삭제 실패 | 다른 리소스가 SG를 참조 중       | Amazon EC2가 Terminated 상태인지 확인 → 1~2분 대기 후 재시도              |
> | Subnet 삭제 실패         | DB Subnet Group이 아직 존재      | 단계 2에서 DB Subnet Group 삭제를 확인 후 재시도                   |
> | "has dependencies" 에러  | 수동 생성 리소스가 VPC를 사용 중 | **Events** 탭에서 실패 원인 확인 → 해당 리소스 수동 삭제 후 재시도 |

---

### 단계 5: 삭제 확인

23. **RDS 콘솔 → Databases**: `my-rds-mysql`이 목록에서 사라졌는지 확인합니다.
24. **RDS 콘솔 → Subnet groups**: `my-db-subnet-group`이 목록에서 사라졌는지 확인합니다.
25. **EC2 콘솔 → Instances**: `my-rds-client`가 `Terminated` 상태인지 확인합니다.
26. **CloudFormation 콘솔**: `rds-lab-prereq` 스택이 목록에서 사라졌는지 확인합니다.

> [!NOTE]
> Terminated 상태의 EC2 인스턴스는 약 1시간 후 콘솔 목록에서 자동으로 사라집니다.

---

### 단계 6: Tag Editor로 최종 확인

27. 상단 검색창에 `Resource Groups & Tag Editor`를 입력하고 선택합니다.
28. 왼쪽 메뉴에서 **Tag Editor**를 선택합니다.
29. 다음과 같이 설정합니다:
    - **Regions**: `ap-northeast-2`
    - **Resource types**: `All supported resource types`
    - **Tag key**: `Session`
    - **Tag value**: `4-1`
30. [[Search resources]] 버튼을 클릭합니다.
31. 검색 결과가 비어있는지 확인합니다.

> [!OUTPUT]
> 결과가 비어있으면 모든 리소스가 정상 정리된 것입니다.  
> 리소스가 남아있다면 해당 리소스를 클릭하여 서비스 콘솔에서 수동 삭제합니다.

> [!TIP]
> `Session: 4-1`로 검색했을 때 결과가 비어있어도, `Step: step4`로도 검색해보세요.  
> 4-2에서 생성한 리소스가 남아있을 수 있습니다.

✅ **실습 종료**: 모든 리소스가 정리되었습니다.

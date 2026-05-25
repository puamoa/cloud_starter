---
title: 'Amazon RDS용 DB Subnet Group 생성 및 배치 전략'
week: 4
session: 1
awsServices:
  - Amazon RDS
  - Amazon VPC
learningObjectives:
  - DB Subnet Group의 개념과 최소 2개 AZ가 필요한 이유를 설명할 수 있습니다.
  - RDS의 Public vs Private 배치 전략을 비교할 수 있습니다.
  - DB Subnet Group을 생성하고 RDS 인스턴스를 배포할 수 있습니다.
  - EC2에서 RDS MySQL에 접속하여 동작을 확인할 수 있습니다.
prerequisites:
  - AWS 계정 생성 완료
  - VPC + Private Subnet 2개 + Security Group 필요
estimatedCost: 크레딧 내 사용 가능 (비용 발생 가능)
---

이 실습에서는 RDS를 배포하기 위한 DB Subnet Group을 생성하고, RDS MySQL 인스턴스를 Private Subnet에 배치합니다. EC2에서 RDS에 접속하여 정상 동작을 확인합니다.

> [!NOTE]
> 이 실습은 VPC, Private Subnet 2개(서로 다른 AZ), Security Group이 필요합니다. 이미 있다면 그것을 사용합니다. 없다면 아래 CloudFormation으로 생성합니다.

## 태스크 0: 선행 리소스 생성 (CloudFormation)

> [!DOWNLOAD]
> [step4-1-rds-lab.zip](/files/step4/step4-1-rds-lab.zip)
>
> - `step4-1-rds-prereq.yaml` - AWS CloudFormation 템플릿 (태스크 0에서 VPC, 서브넷, IGW, Security Group 자동 생성)

이미 VPC, Private Subnet 2개, EC2용/RDS용 Security Group이 있다면 이 태스크를 건너뛰고 태스크 1로 이동합니다.

1. AWS Management Console에 로그인합니다.
2. 리전을 **Asia Pacific (Seoul) ap-northeast-2**로 설정합니다.
3. 상단 검색창에 `CloudFormation`을 입력하고 선택합니다.
4. [[Create stack]] → **With new resources (standard)**를 선택합니다.

5. 다운로드한 `step4-1-rds-prereq.yaml` 파일을 확인합니다.
6. CloudFormation 콘솔에서 [[Create stack]] → **With new resources (standard)**를 선택합니다.
7. **Upload a template file** → 다운로드한 YAML 파일을 업로드합니다.
8. [[Next]] 버튼을 클릭합니다.
9. **Stack name**에 `step4-1-rds-prereq`를 입력합니다.
10. [[Next]] → [[Next]] → [[Submit]] 버튼을 클릭합니다.
11. 스택 상태가 `CREATE_COMPLETE`가 될 때까지 기다립니다.

> [!NOTE]
> 이 스택은 EC2 인스턴스를 포함하지 않습니다. RDS 접속 테스트를 위한 EC2는 태스크 4에서 별도로 생성합니다.

✅ **태스크 완료**: 선행 리소스가 생성되었습니다.

## 태스크 1: DB Subnet Group 개념 이해

> [!CONCEPT] DB Subnet Group
> DB Subnet Group은 RDS 인스턴스가 배치될 수 있는 서브넷의 모음입니다.
>
> **핵심 규칙:**
>
> - 최소 **2개 이상의 가용 영역(AZ)**에 속한 서브넷을 포함해야 합니다.
> - Multi-AZ 배포 시 Primary와 Standby가 서로 다른 AZ에 배치됩니다.
> - Single-AZ라도 2개 AZ가 필요한 이유: 나중에 Multi-AZ로 전환하거나, 장애 시 다른 AZ로 Failover할 수 있도록 준비하기 위함입니다.

### Public vs Private 배치 비교

| 구분      | Public 배치                          | Private 배치               |
| --------- | ------------------------------------ | -------------------------- |
| 접근 방식 | 인터넷에서 직접 접근 가능            | VPC 내부에서만 접근        |
| 보안      | 낮음 (공격 표면 넓음)                | 높음 (외부 차단)           |
| 사용 사례 | 개발/테스트 (비권장)                 | 운영 환경 (권장)           |
| 필요 설정 | Public Subnet + Public Access 활성화 | Private Subnet + SG로 제어 |

> [!WARNING]
> 운영 환경에서 RDS를 Public Subnet에 배치하는 것은 보안 위험입니다. 반드시 Private Subnet에 배치하고, EC2(또는 VPN/Direct Connect)를 통해서만 접근하도록 구성하세요.

✅ **태스크 완료**: DB Subnet Group의 개념을 이해했습니다.

## 태스크 2: DB Subnet Group 생성

10. 상단 검색창에 `RDS`를 입력하고 RDS 서비스를 선택합니다.
11. 왼쪽 메뉴에서 **Subnet groups**를 선택합니다.
12. [[Create DB subnet group]] 버튼을 클릭합니다.
13. 다음과 같이 설정합니다:
    - **Name**: `my-db-subnet-group`
    - **Description**: `DB Subnet Group for RDS in private subnets`
    - **VPC**: `my-vpc` 선택

14. **Add subnets** 섹션에서:
    - **Availability Zones**: `ap-northeast-2a`와 `ap-northeast-2c` 선택
    - **Subnets**: `10.0.11.0/24` (my-private-subnet-a)와 `10.0.12.0/24` (my-private-subnet-c) 선택

> [!NOTE]
> Private Subnet만 선택합니다. Public Subnet을 포함하면 RDS가 Public으로 배치될 수 있습니다.

15. [[Create]] 버튼을 클릭합니다.

> [!OUTPUT]
> DB Subnet Group이 생성됩니다. 상세 페이지에서 2개의 서브넷(2개 AZ)이 포함된 것을 확인할 수 있습니다.

✅ **태스크 완료**: DB Subnet Group이 생성되었습니다.

## 태스크 3: RDS MySQL 인스턴스 생성

16. 왼쪽 메뉴에서 **Databases**를 선택합니다.
17. [[Create database]] 버튼을 클릭합니다.
18. 다음과 같이 설정합니다:

**Choose a database creation method:**

- `Standard create` 선택

**Engine options:**

- **Engine type**: `MySQL`
- **Engine version**: `MySQL 8.0.x` (최신 8.0 버전)

**Templates:**

- `Free tier` 선택

> [!NOTE]
> AWS 콘솔에서 "Free tier" 템플릿이 여전히 표시됩니다. 새 체계(2025.07.15 이후 가입)에서는 이 템플릿을 선택하면 비용이 낮은 인스턴스 타입이 자동 선택되며, 비용은 크레딧에서 차감됩니다.

> [!WARNING]
> 반드시 **Free tier** 템플릿을 선택하세요. Production이나 Dev/Test를 선택하면 비용이 높은 인스턴스 타입이 기본 선택되어 크레딧이 빠르게 소진됩니다.

19. **Settings** 섹션:
    - **DB instance identifier**: `my-rds-mysql`
    - **Master username**: `admin`
    - **Credentials management**: `Self managed`
    - **Master password**: `Admin1234!` (예시)
    - **Confirm master password**: 동일하게 입력

20. **Instance configuration**:
    - **DB instance class**: `db.t3.micro` (Free tier eligible)

> [!NOTE]
> Free tier 템플릿을 선택하면 자동으로 `db.t3.micro`가 선택됩니다. 이 인스턴스는 무료 플랜 크레딧 내에서 사용 가능합니다.

21. **Storage**:
    - **Storage type**: `General Purpose SSD (gp2)`
    - **Allocated storage**: `20` GiB
    - **Storage autoscaling**: 체크 해제 (Enable storage autoscaling 비활성화)

> [!TIP]
> Storage autoscaling을 비활성화하면 예상치 못한 스토리지 비용 증가를 방지할 수 있습니다. 크레딧 내에서 20 GiB까지 비용이 매우 저렴합니다.

22. **Connectivity** 섹션:
    - **Compute resource**: `Don't connect to an EC2 compute resource`
    - **VPC**: `my-vpc`
    - **DB subnet group**: `my-db-subnet-group`
    - **Public access**: `No`
    - **VPC security group**: `Choose existing` → `my-rds-sg` 선택 (default 제거)
    - **Availability Zone**: `No preference`

23. **Database authentication**:
    - `Password authentication` 선택

24. **Additional configuration** 섹션을 펼칩니다:
    - **Initial database name**: `appdb`
    - **Backup retention period**: `0 days` (비용 절약, 학습 환경)
    - **Enable Enhanced Monitoring**: 체크 해제
    - **Enable auto minor version upgrade**: 체크 유지

> [!WARNING]
> Backup retention을 0으로 설정하면 자동 백업이 비활성화됩니다. 운영 환경에서는 반드시 7일 이상으로 설정하세요.

25. [[Create database]] 버튼을 클릭합니다.

> [!NOTE]
> RDS 인스턴스 생성에 약 5-10분이 소요됩니다. 상태가 `Available`이 될 때까지 기다립니다.

26. 생성이 완료되면 `my-rds-mysql`을 클릭하여 **Endpoint**를 확인합니다.

> [!OUTPUT]
> Endpoint 형식: `my-rds-mysql.xxxxxxxxxxxx.ap-northeast-2.rds.amazonaws.com`
> 이 주소를 메모해 두세요. EC2에서 접속할 때 사용합니다.

✅ **태스크 완료**: RDS MySQL 인스턴스가 생성되었습니다.

## 태스크 4: EC2에서 RDS 접속 테스트

EC2 인스턴스에서 RDS에 접속하여 정상 동작을 확인합니다.

### EC2 인스턴스 생성 (없는 경우)

27. EC2 콘솔에서 [[Launch instances]] 버튼을 클릭합니다.
28. 다음과 같이 설정합니다:
    - **Name**: `my-ec2-app`
    - **AMI**: `Amazon Linux 2023 AMI`
    - **Instance type**: `t2.micro`
    - **Key pair**: 기존 키 페어 선택
    - **Network settings** → [[Edit]]:
      - **VPC**: `my-vpc`
      - **Subnet**: `my-public-subnet-a`
      - **Auto-assign public IP**: `Enable`
      - **Security group**: `my-ec2-sg`
29. [[Launch instance]] 버튼을 클릭합니다.

### MySQL Client 설치 및 접속

30. EC2에 SSH로 접속합니다:

```bash
ssh -i ~/Downloads/my-keypair.pem ec2-user@<EC2-Public-IP>
```

31. MySQL Client를 설치합니다:

```bash
sudo dnf install mariadb105 -y
```

32. RDS에 접속합니다:

```bash
mysql -h my-rds-mysql.xxxxxxxxxxxx.ap-northeast-2.rds.amazonaws.com -u admin -p
```

33. 비밀번호를 입력합니다 (`Admin1234!`).

> [!OUTPUT]
>
> ```
> Welcome to the MariaDB monitor.
> ...
> MySQL [(none)]>
> ```

34. 데이터베이스를 확인합니다:

```sql
SHOW DATABASES;
USE appdb;
SHOW TABLES;
```

> [!OUTPUT]
>
> ```
> +--------------------+
> | Database           |
> +--------------------+
> | appdb              |
> | information_schema |
> | mysql              |
> | performance_schema |
> | sys                |
> +--------------------+
> ```

35. 테스트 테이블을 생성하고 데이터를 삽입합니다:

```sql
CREATE TABLE test_table (
    id INT AUTO_INCREMENT PRIMARY KEY,
    message VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO test_table (message) VALUES ('Hello from RDS!');
SELECT * FROM test_table;
```

> [!OUTPUT]
>
> ```
> +----+-----------------+---------------------+
> | id | message         | created_at          |
> +----+-----------------+---------------------+
> |  1 | Hello from RDS! | 2024-xx-xx xx:xx:xx |
> +----+-----------------+---------------------+
> ```

36. MySQL을 종료합니다:

```sql
EXIT;
```

✅ **태스크 완료**: EC2에서 RDS MySQL에 정상적으로 접속하고 데이터를 조작했습니다.

## 마무리

다음을 성공적으로 수행했습니다:

- DB Subnet Group의 개념과 최소 2개 AZ 요구 사항을 이해했습니다.
- RDS의 Public vs Private 배치 전략을 비교했습니다.
- DB Subnet Group을 생성하고 Private Subnet을 연결했습니다.
- RDS MySQL 인스턴스를 Free tier로 생성했습니다.
- EC2에서 RDS에 접속하여 데이터베이스 동작을 확인했습니다.

# 🗑️ 리소스 정리

> [!WARNING]
> 다음 단계를 **반드시 수행**하여 불필요한 비용을 방지합니다.

---

### 단계 1: RDS 인스턴스 삭제

RDS 인스턴스는 실행 중일 때 시간당 과금되므로 즉시 삭제합니다.

1. 상단 검색창에 `RDS`를 입력하고 선택합니다.
2. 왼쪽 메뉴에서 **Databases**를 클릭합니다.
3. `my-rds-mysql`을 선택합니다.
4. **Actions** → **Delete**를 클릭합니다.
5. **Create final snapshot?** 항목에서 `No`를 선택합니다 (학습 환경).
6. **I acknowledge that upon instance deletion, automated backups, including system snapshots and point-in-time recovery, will no longer be available.** 체크박스를 선택합니다.
7. 확인 입력란에 `delete me`를 입력합니다.
8. [[Delete]]를 클릭합니다.
9. 상태가 `Deleting`으로 변경되는 것을 확인합니다.

> [!WARNING]
> RDS 삭제에 약 3-5분이 소요됩니다. 삭제가 완료될 때까지 기다린 후 다음 단계를 진행하세요. RDS가 삭제되지 않으면 DB Subnet Group을 삭제할 수 없습니다.

> [!NOTE]
> RDS를 바로 삭제하지 않고 **Actions** → **Stop temporarily**를 선택하면 7일간 중지됩니다. 7일 후 자동으로 다시 시작되므로 주의하세요.

---

### 단계 2: DB Subnet Group 삭제

RDS 인스턴스가 완전히 삭제된 후 DB Subnet Group을 삭제합니다.

1. RDS 콘솔 왼쪽 메뉴에서 **Subnet groups**를 클릭합니다.
2. `my-db-subnet-group`을 선택합니다.
3. [[Delete]] 버튼을 클릭합니다.
4. 확인 팝업에서 [[Delete]]를 클릭합니다.

> [!NOTE]
> RDS 인스턴스가 아직 삭제 중이면 "Cannot delete the subnet group because it is in use" 에러가 발생합니다. RDS 삭제가 완료된 후 다시 시도하세요.

---

### 단계 3: EC2 인스턴스 종료

RDS 접속 테스트를 위해 생성한 EC2 인스턴스를 종료합니다.

1. 상단 검색창에 `EC2`를 입력하고 선택합니다.
2. 왼쪽 메뉴에서 **Instances**를 클릭합니다.
3. `my-ec2-app` 인스턴스를 체크합니다.
4. 상단 **Instance state** → **Terminate instance**를 클릭합니다.
5. 확인 팝업에서 [[Terminate]]를 클릭합니다.
6. Instance state가 `Shutting down` → `Terminated`로 변경되는 것을 확인합니다.

---

### 단계 4: CloudFormation 스택 삭제

태스크 0에서 CloudFormation으로 선행 리소스를 생성한 경우 스택을 삭제합니다.

1. 상단 검색창에 `CloudFormation`을 입력하고 선택합니다.
2. **Stacks** 목록에서 `step4-1-rds-prereq` 스택을 선택합니다.
3. [[Delete]] 버튼을 클릭합니다.
4. 확인 팝업에서 [[Delete stack]]을 클릭합니다.
5. 스택 상태가 `DELETE_IN_PROGRESS` → `DELETE_COMPLETE`가 될 때까지 기다립니다 (약 2-3분).

> [!NOTE]
> CloudFormation 스택을 삭제하면 스택이 생성한 모든 리소스(VPC, Subnet, IGW, Security Group)가 자동으로 삭제됩니다.

---

### 단계 5: 삭제 확인

모든 리소스가 정상적으로 삭제되었는지 확인합니다.

1. RDS 콘솔 → **Databases**에서 `my-rds-mysql`이 목록에서 사라졌는지 확인합니다.
2. RDS 콘솔 → **Subnet groups**에서 `my-db-subnet-group`이 삭제되었는지 확인합니다.
3. EC2 콘솔에서 `my-ec2-app` 인스턴스가 `Terminated` 상태인지 확인합니다.
4. CloudFormation 콘솔에서 `step4-1-rds-prereq` 스택이 목록에서 사라졌는지 확인합니다.

> [!NOTE]
> 삭제 직후에는 일부 리소스가 잠시 남아있을 수 있으나, 시간이 지나면 자동으로 사라집니다.

✅ **실습 종료**: 모든 리소스가 정리되었습니다.

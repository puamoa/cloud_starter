---
title: 'NAT Instance vs NAT Gateway 비교 실습'
week: 3
session: 1
awsServices:
  - Amazon EC2
  - NAT Gateway
  - Amazon VPC
learningObjectives:
  - Private Subnet에서 인터넷 접근이 필요한 이유를 설명할 수 있습니다.
  - NAT Instance를 구성하고 Source/Dest Check를 비활성화할 수 있습니다.
  - NAT Gateway를 생성하고 Private Route Table에 연결할 수 있습니다.
  - NAT Instance와 NAT Gateway의 차이(비용, 성능, 관리)를 비교할 수 있습니다.
  - NAT 설정 후 Private EC2에서 SSM Session Manager 접속이 가능해지는 원리를 이해할 수 있습니다.
prerequisites:
  - AWS 계정 생성 완료
  - VPC (Public Subnet + Private Subnet) 필요
estimatedCost: NAT Gateway 시간당 과금 (크레딧 소진 주의)
---

이 실습에서는 Private Subnet의 인스턴스가 인터넷에 접근할 수 있도록 NAT(Network Address Translation)를 구성합니다.  
NAT Instance와 NAT Gateway 두 가지 방식을 모두 실습하고 비교합니다.

> [!WARNING]
> **비용 주의**: NAT Gateway는 크레딧에서 차감되며 비용이 빠르게 소진될 수 있습니다.
>
> | 리소스                  | 비용 (서울 리전)                     | 비고             |
> | ----------------------- | ------------------------------------ | ---------------- |
> | NAT Gateway             | 시간당 ~$0.059 + 데이터 GB당 ~$0.059 | 월 ~$42.5 (24/7) |
> | NAT Instance (t3.micro) | 크레딧 내 사용 가능                  | 월 ~$10          |
> | Elastic IP (미사용 시)  | 시간당 ~$0.005                       | 월 ~$3.6         |
>
> ※ 위 금액은 작성 시점 기준 대략적인 참고 값이며, 실제 요금은 AWS 요금 페이지에서 확인하세요.  
> 실습이 끝나면 **NAT Gateway + Elastic IP**를 반드시 삭제하세요.  
> 이 실습 마지막의 [리소스 정리](#cleanup) 섹션을 반드시 수행하세요.

> [!NOTE]
> 이 실습은 VPC(Public Subnet + Private Subnet)가 필요합니다.  
> Step 1에서 생성한 VPC가 있다면 그것을 사용합니다. 없다면 태스크 0의 AWS CloudFormation으로 생성합니다.

### 실습 흐름

```
[태스크 0] CloudFormation으로 VPC 인프라 + IAM Role 생성
    ↓
[태스크 1] Bastion + Private EC2 생성 → 인터넷 접근 불가 확인
    ↓
[태스크 2] NAT Instance 구성 → 인터넷 접근 성공 + SSM 접속 확인
    ↓
[태스크 3] NAT Gateway 구성 → NAT Instance 대체
    ↓
[태스크 4] 두 방식 비교 정리
    ↓
[리소스 정리] 모든 리소스 삭제
```

| 단계     | 실행 위치       | 내용                                                    |
| -------- | --------------- | ------------------------------------------------------- |
| 태스크 0 | AWS 콘솔        | CloudFormation으로 VPC, Subnet, SG, IAM Role 생성       |
| 태스크 1 | AWS 콘솔 + 로컬 | Bastion/Private EC2 생성, 인터넷 접근 불가 확인         |
| 태스크 2 | AWS 콘솔 + EC2  | NAT Instance 생성, iptables 설정, 테스트, SSM 접속 확인 |
| 태스크 3 | AWS 콘솔        | NAT Gateway 생성, Route Table 교체, 테스트              |
| 태스크 4 | -               | 두 방식 비교 정리                                       |

## 태스크 0: 선행 리소스 준비

이 실습은 VPC, Subnet, Security Group, IAM Role이 필요합니다.  
본인 상황에 맞는 옵션을 선택하세요.

> [!DOWNLOAD]
> [step3-1-nat-lab.zip](/files/step3/step3-1-nat-lab.zip)
>
> - `step3-1-nat-prereq.yaml` - CloudFormation 템플릿 (VPC, Public/Private Subnet 4개, IGW, Route Table, Security Group, IAM Role 자동 생성)

| 상황                                                     | 선택            |
| -------------------------------------------------------- | --------------- |
| 이전 Step 리소스를 모두 정리한 상태 (또는 처음 시작)     | **옵션 A** 진행 |
| Step 1/2에서 생성한 VPC(`my-vpc`)를 그대로 사용하고 싶음 | **옵션 B** 진행 |

---

### 옵션 A: CloudFormation으로 전체 생성

> [!WARNING]
> **이전 Step의 리소스가 남아있으면 스택 생성이 실패(ROLLBACK)합니다.**  
> 동일한 이름의 VPC, Security Group, IAM Role이 이미 존재하면 충돌이 발생합니다.
>
> **옵션 A를 진행하기 전에 확인하세요:**
>
> | 확인 항목                | 확인 방법                                             | 남아있으면                |
> | ------------------------ | ----------------------------------------------------- | ------------------------- |
> | 이전 CloudFormation 스택 | CloudFormation 콘솔 → `ec2-lab-prereq` 스택 존재 여부 | 스택 삭제 후 진행         |
> | IAM Role                 | IAM 콘솔 → Roles → `my-ec2-ssm-role` 검색             | Role 삭제 후 진행         |
> | VPC                      | VPC 콘솔 → `my-vpc` 존재 여부                         | VPC 삭제 또는 옵션 B 선택 |
>
> **스택 삭제 방법:** CloudFormation 콘솔 → 해당 스택 선택 → [[Delete]] → [[Delete stack]]  
> (스택 내 EC2가 남아있으면 먼저 Terminate 후 스택 삭제)
>
> **IAM Role만 삭제:** IAM 콘솔 → Roles → `my-ec2-ssm-role` 선택 → [[Delete]] → 확인 입력 → [[Delete]]

**생성되는 리소스:**

| 리소스                | 이름 (기본값)       | 용도                            |
| --------------------- | ------------------- | ------------------------------- |
| VPC                   | my-vpc              | 10.0.0.0/16                     |
| Public Subnet A       | my-public-subnet-a  | 10.0.1.0/24 (Bastion, NAT 배치) |
| Public Subnet C       | my-public-subnet-c  | 10.0.2.0/24 (고가용성 예비)     |
| Private Subnet A      | my-private-subnet-a | 10.0.11.0/24 (Private EC2 배치) |
| Private Subnet C      | my-private-subnet-c | 10.0.12.0/24 (고가용성 예비)    |
| Public Route Table    | my-public-rt        | 0.0.0.0/0 → IGW                 |
| Private Route Table A | my-private-rt-a     | local만 (NAT 경로는 수동 추가)  |
| Private Route Table C | my-private-rt-c     | local만 (NAT 경로는 수동 추가)  |
| Public SG             | my-public-sg        | SSH(22) + VPC 내부 All Traffic  |
| Private SG            | my-private-sg       | VPC 내부에서 SSH(22)만          |
| IAM Role              | my-ec2-ssm-role     | SSM Session Manager 접속 권한   |

1. AWS Management Console에 로그인합니다.
2. 우측 상단에서 리전을 **Asia Pacific (Seoul) ap-northeast-2**로 설정합니다.
3. 상단 검색창에 `CloudFormation`을 입력하고 **CloudFormation** 서비스를 선택합니다.
4. [[Create stack]] 드롭다운을 클릭한 후 **With new resources (standard)**를 선택합니다.
5. **Prerequisite - Prepare template**에서 `Choose an existing template`을 선택합니다.
6. **Specify template**에서 `Upload a template file`을 선택합니다.
7. [[Choose file]] 버튼을 클릭하고 다운로드한 `step3-1-nat-prereq.yaml` 파일을 선택합니다.
8. [[Next]] 버튼을 클릭합니다.
9. **Stack name**에 `nat-lab-prereq`를 입력합니다.
10. **Parameters** 섹션에서 기본값을 확인합니다:
    - **Project Name**: `my` (기본값 유지)
    - **SSH Access IP**: `0.0.0.0/0` (본인 IP로 제한하려면 `x.x.x.x/32` 형태로 변경)
    - 나머지는 기본값을 유지합니다.
11. [[Next]] 버튼을 클릭합니다.
12. **Configure stack options** 페이지에서 아래로 스크롤합니다.
13. 페이지 하단의 **Capabilities** 섹션에서 **I acknowledge that AWS CloudFormation might create IAM resources with custom names.** 체크박스를 선택합니다.

> [!NOTE]
> 이 템플릿은 EC2에 AWS Systems Manager (SSM) 접속 권한을 부여하는 IAM Role을 생성합니다.  
> IAM 리소스를 포함하는 CloudFormation 템플릿은 반드시 이 체크박스를 선택해야 합니다.  
> 체크하지 않으면 다음 단계로 넘어갈 수 없습니다.

14. [[Next]] 버튼을 클릭합니다.
15. **Review and create** 페이지에서 설정을 확인합니다.
16. [[Submit]] 버튼을 클릭합니다.
17. 스택 상태가 `CREATE_COMPLETE`가 될 때까지 기다립니다 (약 1~2분).

> [!NOTE]
> 스택 생성이 완료되면 **Outputs** 탭에서 생성된 리소스의 ID를 확인할 수 있습니다.  
> VPC ID, Subnet ID, Security Group ID 등을 메모해 두세요.

> [!TROUBLESHOOTING]
> **스택이 `ROLLBACK_COMPLETE` 상태인 경우:**
>
> 1. **Events** 탭을 클릭하여 실패 원인을 확인합니다.
> 2. 에러 메시지에서 충돌하는 리소스 이름을 확인합니다.
>
> | 에러 메시지 예시                 | 원인                     | 해결 방법                                            |
> | -------------------------------- | ------------------------ | ---------------------------------------------------- |
> | `my-ec2-ssm-role already exists` | IAM Role 이름 충돌       | IAM → Roles → `my-ec2-ssm-role` 삭제                 |
> | `my-public-sg already exists`    | Security Group 이름 충돌 | 기존 VPC/SG 삭제 또는 ProjectName을 `nat`으로 변경   |
> | `The CIDR block is in use`       | VPC CIDR 충돌            | 기존 VPC 삭제 또는 VPC CIDR을 `10.1.0.0/16`으로 변경 |
>
> **해결 후 재시도:**
>
> 3. `ROLLBACK_COMPLETE` 상태의 스택을 선택 → [[Delete]] → [[Delete stack]]으로 삭제합니다.
> 4. 충돌 리소스를 삭제한 후, 위 1번부터 다시 진행합니다.

✅ **옵션 A 완료**: 선행 리소스가 CloudFormation으로 생성되었습니다. **태스크 1로 이동하세요.**

---

### 옵션 B: 기존 VPC 사용 + IAM Role 확인

Step 1/2에서 생성한 VPC를 그대로 사용하는 경우입니다.  
VPC와 Subnet은 이미 있지만, Security Group과 IAM Role을 확인해야 합니다.

#### B-1. Security Group 확인

이 실습에는 다음 2개의 Security Group이 필요합니다.  
VPC 콘솔 → **Security Groups**에서 `my-public-sg`, `my-private-sg`가 존재하는지 확인합니다.  
두 SG가 모두 존재하면 B-2로 넘어갑니다.

> [!TIP]
> Step 2에서 사용한 `my-ec2-sg`가 있다면 Bastion/NAT Instance에 그것을 사용해도 동작합니다.  
> 다만 Private EC2에는 VPC 내부에서 SSH만 허용하는 별도 SG가 보안상 적합합니다.

> [!NOTE]
> **SG가 없는 경우 아래 설정값으로 생성하세요.**  
> Security Group 생성 절차는 [Step 1-3](/week/1/session/3)에서 학습했습니다.  
> VPC 콘솔 → Security Groups → [[Create security group]]에서 생성합니다.  
> VPC는 반드시 `my-vpc`를 선택하세요 (기본 VPC 선택 시 이후 단계에서 SG가 보이지 않습니다).  
> Outbound rules는 두 SG 모두 기본값(All traffic, `0.0.0.0/0`)을 유지합니다.
>
> ---
>
> **`my-public-sg` (Bastion, NAT Instance용):**
>
> | 항목                | 값                                            |
> | ------------------- | --------------------------------------------- |
> | Security group name | `my-public-sg`                                |
> | Description         | `Public instances - Bastion and NAT Instance` |
> | VPC                 | `my-vpc`                                      |
>
> **Inbound rules:**
>
> | Type        | Port | Source                        | Description          |
> | ----------- | ---- | ----------------------------- | -------------------- |
> | SSH         | 22   | `0.0.0.0/0` (또는 My IP 선택) | SSH access           |
> | All traffic | All  | `10.0.0.0/16`                 | All traffic from VPC |
>
> Tags: `Name` = `my-public-sg`, `Step` = `step3`, `Session` = `3-1`
>
> ---
>
> **`my-private-sg` (Private EC2용):**
>
> | 항목                | 값                                      |
> | ------------------- | --------------------------------------- |
> | Security group name | `my-private-sg`                         |
> | Description         | `Private instances - SSH from VPC only` |
> | VPC                 | `my-vpc`                                |
>
> **Inbound rules:**
>
> | Type | Port | Source        | Description           |
> | ---- | ---- | ------------- | --------------------- |
> | SSH  | 22   | `10.0.0.0/16` | SSH from VPC internal |
>
> Tags: `Name` = `my-private-sg`, `Step` = `step3`, `Session` = `3-1`

#### B-2. IAM Role 확인/생성

18. 상단 검색창에 `IAM`을 입력하고 **IAM** 서비스를 선택합니다.
19. 왼쪽 메뉴에서 **Roles**를 선택합니다.
20. 검색창에 `my-ec2-ssm-role`을 입력합니다.
21. **검색 결과에 `my-ec2-ssm-role`이 표시되면** → 이미 존재합니다. **B-3으로 이동**하세요.
22. **검색 결과가 없으면** → 아래 단계에 따라 생성합니다.

---

**`my-ec2-ssm-role` 생성 (없는 경우):**

23. [[Create role]] 버튼을 클릭합니다.
24. **Select trusted entity** 페이지에서 다음과 같이 설정합니다:
    - **Trusted entity type**: `AWS service` 선택
    - **Use case**: `EC2` 선택
25. [[Next]] 버튼을 클릭합니다.
26. **Add permissions** 페이지에서 검색창에 `AmazonSSMManagedInstanceCore`를 입력합니다.
27. 검색 결과에서 `AmazonSSMManagedInstanceCore` 체크박스를 선택합니다.

> [!NOTE]
> `AmazonSSMManagedInstanceCore`는 AWS 관리형 정책으로, EC2가 SSM Agent를 통해 Systems Manager와 통신하는 데 필요한 최소 권한을 포함합니다.  
> 이 정책 하나로 Session Manager 접속, SSM Agent 등록 등이 가능합니다.

28. [[Next]] 버튼을 클릭합니다.
29. **Name, review, and create** 페이지에서 **Role name**에 `my-ec2-ssm-role`을 입력합니다.
30. **Tags** 섹션에서 [[Add tag]] 버튼을 클릭하여 다음 태그를 추가합니다:

| Key         | Value        |
| ----------- | ------------ |
| `CreatedBy` | `admin-user` |
| `Step`      | `step3`      |
| `Session`   | `3-1`        |

31. 아래로 스크롤하여 [[Create role]] 버튼을 클릭합니다.

> [!OUTPUT]
> "Role my-ec2-ssm-role created" 메시지가 표시됩니다.

> [!TIP]
> 이 Role은 EC2 인스턴스가 AWS Systems Manager에 접속할 수 있는 권한을 부여합니다.  
> Step 2에서 이미 생성했다면 동일한 Role을 재사용합니다. 여러 EC2에서 같은 Role을 공유할 수 있습니다.

#### B-3. 확인 체크리스트

옵션 B를 완료하기 전에 다음 리소스가 모두 존재하는지 확인합니다:

| 리소스                                 | 확인 위치                    | 상태                    |
| -------------------------------------- | ---------------------------- | ----------------------- |
| VPC (`my-vpc`)                         | VPC 콘솔 → Your VPCs         | 존재                    |
| Public Subnet (`my-public-subnet-a`)   | VPC 콘솔 → Subnets           | 존재                    |
| Private Subnet (`my-private-subnet-a`) | VPC 콘솔 → Subnets           | 존재                    |
| Internet Gateway                       | VPC 콘솔 → Internet Gateways | VPC에 연결됨            |
| Private Route Table                    | VPC 콘솔 → Route Tables      | Private Subnet에 연결됨 |
| Security Group (Public 또는 EC2용)     | VPC 콘솔 → Security Groups   | SSH 허용                |
| IAM Role (`my-ec2-ssm-role`)           | IAM 콘솔 → Roles             | 존재                    |

✅ **옵션 B 완료**: 기존 리소스를 확인하고 IAM Role을 준비했습니다. **태스크 1로 이동하세요.**

---

✅ **태스크 완료**: 선행 리소스가 준비되었습니다.

## 태스크 1: Private Subnet에서 인터넷 접근 불가 확인

> [!CONCEPT] Private Subnet과 인터넷 접근
> Private Subnet의 인스턴스는 Public IP가 없고 IGW로의 경로도 없어 인터넷에 직접 접근할 수 없습니다.  
> 하지만 다음과 같은 경우 인터넷 접근이 필요합니다:
>
> - **패키지 업데이트**: `dnf update`
> - **외부 API 호출**: 결제 API, 알림 서비스 등
> - **소프트웨어 다운로드**: 런타임, 라이브러리 설치
> - **AWS 서비스 접근**: Amazon S3, Amazon SQS 등 (VPC Endpoint 미사용 시)
>
> NAT를 사용하면 Private 인스턴스가 인터넷으로 **나가는 ** 트래픽은 허용하면서, 외부에서 **들어오는 ** 트래픽은 차단할 수 있습니다.
>
> ```
> Private EC2 → NAT (Public Subnet) → IGW → 인터넷
>                                              ↓ (응답만 돌아옴)
> Private EC2 ← NAT (Public Subnet) ← IGW ← 인터넷
>
> 인터넷 → IGW → NAT → Private EC2  ← ❌ 차단 (외부에서 먼저 접근 불가)
> ```

이 태스크에서는 Private Subnet에 EC2를 생성하고, 인터넷 접근이 불가능함을 직접 확인합니다.

### Bastion Host 생성 (Public Subnet)

Private EC2에 접속하려면 먼저 Public Subnet에 "점프 서버"(Bastion Host)가 필요합니다.

32. 상단 검색창에 `EC2`를 입력하고 **EC2** 서비스를 선택합니다.
33. 왼쪽 메뉴에서 **Instances**를 선택합니다.
34. [[Launch instances]] 버튼을 클릭합니다.
35. 다음과 같이 설정합니다:

**Name and tags:**

- **Name**: `my-bastion`
- [[Add additional tags]]를 클릭하여 다음 태그를 추가합니다:

| Key         | Value        |
| ----------- | ------------ |
| `CreatedBy` | `admin-user` |
| `Step`      | `step3`      |
| `Session`   | `3-1`        |

> [!TIP]
> `Step`, `Session` 태그는 Tag Editor에서 이 실습에서 생성한 리소스를 일괄 검색할 때 활용됩니다.  
> 모든 수동 생성 리소스에 동일한 태그를 적용하세요.

**Application and OS Images:**

- **AMI**: `Amazon Linux 2023 AMI`
- **Architecture**: `64-bit (x86)`

**Instance type:**

- `t3.micro` 선택

**Key pair:**

- 기존 키 페어를 선택합니다. 없으면 [[Create new key pair]]를 클릭하여 생성합니다.
  - **Key pair name**: `my-keypair`
  - **Key pair type**: `RSA`
  - **Private key file format**: `.pem`
  - [[Create key pair]] 클릭 → 파일이 자동 다운로드됩니다.

> [!TIP]
> **이미 Step 2에서 키 페어를 생성했다면** 동일한 키를 선택하세요.  
> 키 페어를 새로 만들면 이전 키로는 이번 실습의 인스턴스에 접속할 수 없습니다.

**Network settings** → [[Edit]] 버튼을 클릭합니다:

- **VPC**: `my-vpc` 선택
- **Subnet**: `my-public-subnet-a` 선택
- **Auto-assign public IP**: `Enable`
- **Firewall (security groups)**: `Select existing security group` 선택
- **Common security groups**: `my-public-sg` 선택

> [!NOTE]
> `my-public-sg`에는 SSH(22) 외부 접근 + VPC 내부 All Traffic이 허용되어 있습니다.  
> Bastion은 외부에서 SSH 접속을 받고, 내부에서 Private EC2로 SSH를 보내는 역할이므로 이 SG가 적합합니다.

**Configure storage**: 기본값을 유지합니다 (`8 GiB`, `gp3`).

**Advanced details** 섹션을 펼칩니다 (클릭하여 확장):

- **IAM instance profile**: 드롭다운에서 `my-ec2-ssm-role`을 선택합니다.
- **User data**: 비워둡니다.
- 나머지 설정은 기본값을 유지합니다.

> [!NOTE]
> Bastion은 Public Subnet에 있어 IGW를 통해 인터넷에 접근 가능합니다.  
> IAM Role을 연결하면 SSM Agent가 즉시 AWS에 등록되어 Session Manager로도 접속할 수 있습니다.  
> 반면, 이후 생성할 Private EC2는 같은 Role을 연결해도 NAT 없이는 SSM이 동작하지 않습니다.  
> 이 차이를 태스크 2에서 직접 확인합니다.

36. [[Launch instance]] 버튼을 클릭합니다.
37. 인스턴스 상태가 `Running`이 될 때까지 기다립니다 (약 1~2분).
38. `my-bastion`의 **Public IPv4 address**를 메모합니다.

### Private EC2 인스턴스 생성

39. EC2 콘솔에서 [[Launch instances]] 버튼을 다시 클릭합니다.
40. 다음과 같이 설정합니다:

**Name and tags:**

- **Name**: `my-private-ec2`
- [[Add additional tags]]를 클릭하여 다음 태그를 추가합니다:

| Key         | Value        |
| ----------- | ------------ |
| `CreatedBy` | `admin-user` |
| `Step`      | `step3`      |
| `Session`   | `3-1`        |

**Application and OS Images:**

- **AMI**: `Amazon Linux 2023 AMI`
- **Architecture**: `64-bit (x86)`

**Instance type:**

- `t3.micro` 선택

**Key pair:**

- Bastion과 동일한 키 페어(`my-keypair`)를 선택합니다.

**Network settings** → [[Edit]] 버튼을 클릭합니다:

- **VPC**: `my-vpc` 선택
- **Subnet**: `my-private-subnet-a` 선택
- **Auto-assign public IP**: `Disable`
- **Firewall (security groups)**: `Select existing security group` 선택
- **Common security groups**: `my-private-sg` 선택

> [!WARNING]
> **Auto-assign public IP**가 반드시 `Disable`인지 확인하세요.  
> Private Subnet의 인스턴스에는 Public IP를 할당하지 않습니다.  
> (CloudFormation으로 생성한 Private Subnet은 기본값이 Disable이지만, 명시적으로 확인하세요.)

> [!NOTE]
> `my-private-sg`에는 VPC 내부(10.0.0.0/16)에서 SSH(22)만 허용되어 있습니다.  
> 외부에서는 접속 불가하고, Bastion(같은 VPC)에서만 SSH 접속이 가능합니다.

**Configure storage**: 기본값을 유지합니다 (`8 GiB`, `gp3`).

**Advanced details** 섹션을 펼칩니다 (클릭하여 확장):

- **IAM instance profile**: 드롭다운에서 `my-ec2-ssm-role`을 선택합니다.
- **User data**: 비워둡니다.
- 나머지 설정은 기본값을 유지합니다.

> [!NOTE]
> Step 2에서 이미 `my-ec2-ssm-role`을 생성한 경우, 동일한 Role이 여기에 표시됩니다.  
> 이번 실습의 CloudFormation(태스크 0)으로 새로 생성한 경우에도 동일한 이름으로 생성됩니다.  
> IAM Role을 연결하면 SSM Agent가 AWS에 자동 등록되어, NAT 설정 완료 후 Session Manager로 접속할 수 있습니다.

> [!TIP]
> **지금은 SSM Session Manager로 접속할 수 없습니다.**  
> SSM Agent가 AWS Systems Manager 서비스 엔드포인트에 접근하려면 인터넷 연결이 필요합니다.  
> Private Subnet에는 아직 NAT가 없으므로 인터넷에 접근할 수 없고, SSM Agent 등록이 실패합니다.  
> NAT를 설정한 후에 SSM 접속이 가능해지는 것을 이후 태스크에서 확인합니다.

41. [[Launch instance]] 버튼을 클릭합니다.
42. 인스턴스 상태가 `Running`이 될 때까지 기다립니다.
43. `my-private-ec2`의 **Private IPv4 address**를 메모합니다 (예: `10.0.11.xxx`).

> [!NOTE]
> Private EC2에는 Public IP가 없으므로 외부에서 직접 접속할 수 없습니다.  
> Bastion Host를 경유해서만 접속할 수 있습니다.

### Bastion을 통해 Private EC2에 접속

📍 **실행 위치: 로컬 PC (터미널)**

44. 로컬 터미널에서 Bastion Host에 SSH 접속합니다:

**Mac/Linux:**

```bash
# 키 파일 권한 설정 (최초 1회)
chmod 400 ~/Downloads/my-keypair.pem

# Bastion에 SSH 접속
ssh -i ~/Downloads/my-keypair.pem ec2-user@<Bastion-Public-IP>
```

**Windows (PowerShell):**

```powershell
ssh -i C:\Users\<사용자명>\Downloads\my-keypair.pem ec2-user@<Bastion-Public-IP>
```

> [!TIP]
> **Windows MobaXterm 사용자:**  
> Session → SSH → Remote host에 Bastion Public IP 입력, Specify username: `ec2-user`, Advanced SSH settings → Use private key에 `.pem` 파일 경로 지정 → OK로 접속합니다.  
> MobaXterm 설정이 처음이라면 [Step 2-1의 SSH 접속 가이드](/week/2/session/1)를 참고하세요.

> [!TIP]
> **Windows PowerShell에서 "WARNING: UNPROTECTED PRIVATE KEY FILE" 에러가 나는 경우:**
>
> ```powershell
> icacls "C:\Users\<사용자명>\Downloads\my-keypair.pem" /inheritance:r /grant:r "$($env:USERNAME):(R)"
> ```

45. Bastion에서 Private EC2에 접속하기 위해 키 파일을 Bastion으로 전송합니다.  
    **새 터미널(또는 MobaXterm 새 탭)을 열어서** 다음 명령을 실행합니다:

**Mac/Linux:**

```bash
scp -i ~/Downloads/my-keypair.pem ~/Downloads/my-keypair.pem ec2-user@<Bastion-Public-IP>:~/
```

**Windows (PowerShell):**

```powershell
scp -i C:\Users\<사용자명>\Downloads\my-keypair.pem C:\Users\<사용자명>\Downloads\my-keypair.pem ec2-user@<Bastion-Public-IP>:~/
```

> [!TIP]
> **MobaXterm 사용자:** 왼쪽 파일 브라우저에서 Bastion의 홈 디렉토리(`/home/ec2-user`)가 보입니다.  
> 로컬의 `.pem` 파일을 드래그 앤 드롭으로 업로드하면 SCP 명령 없이 전송할 수 있습니다.

> [!TIP]
> **SSH Agent Forwarding을 사용하면 키 파일 전송 없이 바로 접속할 수 있습니다 (권장):**
>
> **Mac/Linux:**
>
> ```bash
> ssh-add ~/Downloads/my-keypair.pem
> ssh -A -i ~/Downloads/my-keypair.pem ec2-user@<Bastion-Public-IP>
> # Bastion에서 바로: ssh ec2-user@<Private-EC2-Private-IP>
> ```
>
> Mac에서 `ssh-add`가 안 되는 경우: `ssh-add --apple-use-keychain ~/Downloads/my-keypair.pem`
>
> **Windows (PowerShell):**
>
> ```powershell
> Get-Service ssh-agent | Set-Service -StartupType Automatic
> Start-Service ssh-agent
> ssh-add C:\Users\<사용자명>\Downloads\my-keypair.pem
> ssh -A -i C:\Users\<사용자명>\Downloads\my-keypair.pem ec2-user@<Bastion-Public-IP>
> ```
>
> **MobaXterm:** Session 설정 → Advanced SSH settings → **SSH Agent** 체크 → 키 파일 추가하면 Agent Forwarding이 자동 적용됩니다.

46. Bastion에서 Private EC2에 접속합니다:

📍 **실행 위치: Bastion EC2 (SSH 접속한 상태)**

```bash
# Agent Forwarding을 사용하지 않은 경우:
chmod 400 ~/my-keypair.pem
ssh -i ~/my-keypair.pem ec2-user@<Private-EC2-Private-IP>

# Agent Forwarding을 사용한 경우:
ssh ec2-user@<Private-EC2-Private-IP>
```

47. `Are you sure you want to continue connecting?` 메시지가 나오면 `yes`를 입력합니다.

> [!OUTPUT]
> Private EC2에 접속 성공 시 프롬프트가 표시됩니다:
>
> ```
> [ec2-user@ip-10-0-11-xxx ~]$
> ```
>
> IP가 `10.0.11.xxx` 형태(Private Subnet 대역)인 것을 확인하세요.

> [!TIP]
> **Bastion과 Private EC2의 프롬프트가 비슷해 보이지만 IP가 다릅니다.**  
> 현재 어디에 접속해 있는지 혼동하지 않도록 프롬프트의 IP 부분을 확인하세요:
>
> ```
> [ec2-user@ip-10-0-1-xxx ~]$    ← Bastion (Public Subnet: 10.0.1.0/24)
> [ec2-user@ip-10-0-11-xxx ~]$   ← Private EC2 (Private Subnet: 10.0.11.0/24)
> ```
>
> `10-0-1`이면 Bastion, `10-0-11`이면 Private EC2입니다.

### 인터넷 접근 불가 확인

📍 **실행 위치: Private EC2**

48. Private EC2에서 인터넷 접근을 테스트합니다:

```bash
# IP 직접 테스트 (DNS 없이)
ping -c 3 -W 5 8.8.8.8
```

> [!OUTPUT]
> 응답이 오지 않고 타임아웃됩니다:
>
> ```
> PING 8.8.8.8 (8.8.8.8) 56(84) bytes of data.
>
> --- 8.8.8.8 ping statistics ---
> 3 packets transmitted, 0 received, 100% packet loss, time 2003ms
> ```

> [!NOTE]
> `-c 3`은 ping을 3회만 보내고 종료합니다. 이 옵션 없이 실행하면 `Ctrl+C`로 직접 종료해야 합니다.  
> `-W 5`는 각 응답 대기 시간을 5초로 제한합니다. 네트워크가 차단된 환경에서 이 옵션 없이 실행하면 무한 대기할 수 있습니다.

49. 도메인으로도 테스트합니다:

```bash
ping -c 3 -W 5 google.com
```

> [!OUTPUT]
> DNS 해석 자체가 실패하거나 패킷 손실 100%:
>
> ```
> ping: google.com: Name or service not known
> ```

50. 패키지 업데이트도 시도합니다:

```bash
# 20초 후 자동 중단 (timeout 명령 사용)
timeout 20 sudo dnf check-update --refresh
```

> [!OUTPUT]
> 20초간 응답 없이 멈춘 후 자동 종료됩니다. 또는 아래와 유사한 에러가 출력됩니다:
>
> ```
> Failed to download metadata for repo 'amazonlinux'
> Error: Failed to download metadata for repo 'amazonlinux': Cannot prepare internal mirrorlist...
> ```

> [!NOTE]
> `timeout 20`은 명령을 20초 후 강제 종료합니다. 이 옵션 없이 실행하면 dnf가 리포지토리 접속을 계속 재시도하며 수 분간 멈출 수 있습니다.  
> `ping`으로 이미 인터넷 차단을 확인했지만, 실제 패키지 설치도 불가능하다는 것을 체감하기 위한 테스트입니다.
>
> 이것이 바로 NAT가 필요한 이유입니다.  
> Private Subnet의 인스턴스가 패키지를 설치하거나 외부 API를 호출하려면 NAT를 통해 인터넷에 접근해야 합니다.

51. Private EC2에서 나갑니다 (Bastion으로 돌아감):

```bash
exit
```

52. Bastion에서 인터넷 접근을 테스트합니다 (비교 확인):

📍 **실행 위치: Bastion EC2**

```bash
ping -c 2 google.com
```

> [!OUTPUT]
>
> ```
> PING google.com (142.250.xxx.xxx) 56(84) bytes of data.
> 64 bytes from ...: icmp_seq=1 ttl=53 time=3.21 ms
> 64 bytes from ...: icmp_seq=2 ttl=53 time=3.05 ms
> ```
>
> Bastion은 Public Subnet에 있어 IGW를 통해 인터넷에 바로 접근됩니다.  
> 방금 Private EC2에서는 실패했던 동일한 명령이 Bastion에서는 성공합니다.  
> **같은 VPC 안이지만 Subnet(Public vs Private)에 따라 인터넷 접근 가능 여부가 다릅니다.**

53. Bastion에서도 나갑니다:

```bash
exit
```

### SSM Session Manager 접속 상태 비교

54. EC2 콘솔 → **Instances**에서 `my-bastion`을 선택합니다.
55. 상단 [[Connect]] 버튼을 클릭합니다.
56. **Session Manager** 탭을 선택합니다.
57. Connect 버튼이 **활성화(주황색)** 되어 있는지 확인합니다.

> [!OUTPUT]
> Bastion의 SSM agent status:
>
> - **Ping status**: `Online` (초록색 체크)
> - **Session Manager connection status**: `Connected` (초록색 체크)
> - **IAM role**: `my-ec2-ssm-role`
>
> Public Subnet에 있어 SSM Agent가 AWS 엔드포인트에 정상 등록되었습니다.  
> Connect 버튼이 활성화(주황색)되어 있습니다. (접속은 하지 않아도 됩니다. 확인만 하세요.)

58. [[Cancel]]을 클릭하여 돌아갑니다.
59. **Instances** 목록에서 `my-private-ec2`를 선택합니다.
60. 상단 [[Connect]] 버튼을 클릭합니다.
61. **Session Manager** 탭을 선택합니다.
62. Connect 버튼이 **비활성화(회색)** 되어 있는지 확인합니다.

> [!OUTPUT]
> Private EC2의 SSM agent status:
>
> - **Ping status**: `Offline` (빨간색 X)
> - **Session Manager connection status**: `Not connected` (빨간색 X)
> - **Latest error messages**: `SSM Agent unable to acquire credentials ... retrieved credentials failed to report to ssm. Error: RequestError: send request failed`
> - **IAM role**: `my-ec2-ssm-role`
>
> 인터넷에 접근할 수 없어 SSM Agent가 AWS에 등록되지 못했습니다.  
> Connect 버튼이 비활성화(회색)되어 있습니다.

> [!NOTE]
> **같은 IAM Role(`my-ec2-ssm-role`)을 연결했는데 결과가 다릅니다.**  
> SSM은 IAM 권한뿐 아니라 **네트워크 접근**(SSM 엔드포인트로의 HTTPS 통신)이 필요합니다.  
> Private Subnet에는 IGW 경로가 없으므로 SSM Agent가 AWS API에 도달할 수 없습니다.  
> NAT를 설정한 후(태스크 2 이후) Private EC2의 SSM도 활성화되는 것을 확인합니다.

63. [[Cancel]]을 클릭하여 돌아갑니다.

✅ **태스크 완료**: Private Subnet에서 인터넷 접근이 불가능하고, SSM 접속도 불가능함을 확인했습니다.

## 태스크 2: NAT Instance 구성

> [!CONCEPT] NAT Instance
> NAT Instance는 일반 EC2 인스턴스에 NAT 기능을 설정한 것입니다.  
> Public Subnet에 배치하고, Private Subnet의 트래픽을 받아 자신의 Public IP로 변환하여 인터넷으로 전달합니다.
>
> **과거에는** AWS가 Marketplace에서 `amzn-ami-vpc-nat`이라는 전용 AMI를 제공했으나, Amazon Linux 1 기반으로 **2023년 12월 EOL**되어 더 이상 사용할 수 없습니다.  
> 현재는 **Amazon Linux 2023 인스턴스에 직접 NAT를 설정**하는 방식을 사용합니다.
>
> **핵심 설정 3가지:**
>
> - **Source/Destination Check 비활성화** — EC2는 기본적으로 자신이 Source나 Destination이 아닌 트래픽을 폐기합니다.  
>   NAT Instance는 다른 인스턴스의 트래픽을 중계해야 하므로 이 체크를 비활성화해야 합니다.
> - **IP Forwarding 활성화** — 커널이 패킷을 다른 인터페이스로 전달할 수 있게 합니다.
> - **iptables MASQUERADE 설정** — Private EC2의 IP(10.0.11.x)를 NAT Instance의 Public IP로 변환하는 규칙을 추가합니다.
>
> ```
> [요청 흐름 - Private EC2 → 인터넷]
>
> Private EC2 (10.0.11.50)
>   │ 패킷: src=10.0.11.50, dst=8.8.8.8
>   │ Route Table: 0.0.0.0/0 → NAT Instance로 전달
>   ▼
> NAT Instance (Private IP: 10.0.1.100 / Public IP: 3.35.x.x)
>   │ iptables MASQUERADE: src를 10.0.11.50 → 3.35.x.x로 변환
>   │ 패킷: src=3.35.x.x, dst=8.8.8.8
>   ▼
> Internet Gateway
>   │ Public IP이므로 인터넷으로 라우팅 가능
>   ▼
> 인터넷 (8.8.8.8)
>
> [응답 흐름 - 인터넷 → Private EC2]
>
> 인터넷 (8.8.8.8)
>   │ 응답: src=8.8.8.8, dst=3.35.x.x (NAT의 Public IP)
>   ▼
> Internet Gateway → NAT Instance
>   │ NAT 테이블 조회: 3.35.x.x → 10.0.11.50 으로 복원
>   │ 패킷: src=8.8.8.8, dst=10.0.11.50
>   ▼
> Private EC2 (10.0.11.50) ← 응답 수신 성공
> ```

### NAT Instance용 EC2 생성

64. 상단 검색창에 `EC2`를 입력하고 **EC2** 서비스를 선택합니다.
65. 왼쪽 메뉴에서 **Instances**를 선택합니다.
66. [[Launch instances]] 버튼을 클릭합니다.
67. 다음과 같이 설정합니다:

**Name and tags:**

- **Name**: `my-nat-instance`
- [[Add additional tags]]를 클릭하여 다음 태그를 추가합니다:

| Key         | Value        |
| ----------- | ------------ |
| `CreatedBy` | `admin-user` |
| `Step`      | `step3`      |
| `Session`   | `3-1`        |

**Application and OS Images:**

- **AMI**: `Amazon Linux 2023 AMI`
- **Architecture**: `64-bit (x86)`

**Instance type:**

- `t3.micro` 선택

**Key pair:**

- 동일한 키 페어(`my-keypair`)를 선택합니다.

**Network settings** → [[Edit]] 버튼을 클릭합니다:

- **VPC**: `my-vpc` 선택
- **Subnet**: `my-public-subnet-c` 선택
- **Auto-assign public IP**: `Enable`
- **Firewall (security groups)**: `Create security group` 선택 (기본값)
- **Security group name**: `my-nat-sg`
- **Description**: `NAT Instance - Allow all traffic`
- 기본으로 추가된 SSH 규칙을 삭제하고, [[Add security group rule]] 버튼을 클릭하여 다음 규칙을 설정합니다:

| Type        | Source      | Description       |
| ----------- | ----------- | ----------------- |
| All traffic | `0.0.0.0/0` | Allow all inbound |

> [!NOTE]
> **NAT Instance에 All traffic을 여는 이유:**  
> NAT Instance는 Private EC2의 모든 종류의 트래픽(HTTP, HTTPS, DNS, ping 등)을 중계해야 합니다.  
> 포트나 프로토콜을 제한하면 특정 트래픽이 차단될 수 있으므로 인바운드를 전체 허용합니다.  
> 아웃바운드도 기본값(All traffic, 0.0.0.0/0)을 유지합니다.
>
> **EC2 생성 화면에서 Security Group을 함께 만드는 방법:**  
> Network settings에서 `Create security group`을 선택하면 별도로 VPC 콘솔에 가지 않아도 EC2 생성과 동시에 SG가 만들어집니다.  
> 생성된 SG는 이후 EC2 콘솔 → Security Groups에서 확인·수정할 수 있습니다.

> [!TIP]
> NAT Instance를 **Public Subnet C** (AZ-c)에 배치합니다.  
> Private EC2는 Private Subnet A (AZ-a)에 있으므로, 트래픽이 AZ를 넘어 이동하는 흐름을 확인할 수 있습니다:
>
> ```
> Private EC2 (AZ-a, 10.0.11.x)
>     ↓ Route Table: 0.0.0.0/0 → NAT Instance
> NAT Instance (AZ-c, 10.0.2.x / Public IP)
>     ↓ MASQUERADE
> IGW → 인터넷
> ```
>
> VPC 내부에서는 서브넷과 AZ가 달라도 라우팅이 자유롭게 이루어집니다.
>
> **이 실습에서는 서브넷 간 트래픽 흐름을 시각적으로 이해하기 위해 의도적으로 다른 AZ에 배치한 것입니다.**  
> 비용 절감 목적으로 NAT를 1개만 운영할 때는 AZ에 관계없이 공유할 수 있지만, 실무(프로덕션)에서는 이 구성을 권장하지 않습니다:
>
> - AZ 간 데이터 전송 비용 발생 (GB당 $0.01)
> - NAT가 위치한 AZ에 장애 발생 시 모든 Private Subnet의 인터넷 접근 중단
> - 프로덕션 권장: Private Subnet A → NAT(Public A), Private Subnet C → NAT(Public C)로 AZ별 쌍 배치

**Configure storage**: 기본값을 유지합니다 (`8 GiB`, `gp3`).

**Advanced details**: 기본값을 유지합니다 (NAT Instance에는 IAM Role 불필요).

68. [[Launch instance]] 버튼을 클릭합니다.
69. 인스턴스 상태가 `Running`이 될 때까지 기다립니다.
70. `my-nat-instance`의 **Public IPv4 address**를 메모합니다.

### Source/Destination Check 비활성화

71. EC2 콘솔 → **Instances** 목록에서 `my-nat-instance`를 선택합니다 (체크박스 클릭).
72. 상단 **Actions** 메뉴를 클릭합니다.
73. **Networking** → **Change source/destination check**를 선택합니다.
74. 팝업 창에서 **Stop** 체크박스를 선택합니다 (Source/destination checking을 중지).
75. [[Save]] 버튼을 클릭합니다.

> [!OUTPUT]
> "Source/destination check was successfully changed" 메시지가 표시됩니다.

> [!NOTE]
> **Source/Destination Check란?**
>
> EC2는 기본적으로 자신이 보낸(Source) 패킷이거나 자신에게 온(Destination) 패킷만 처리합니다.  
> 그 외의 패킷은 폐기합니다.
>
> NAT Instance는 Private EC2가 보낸 패킷(Source: 10.0.11.x)을 받아서 인터넷으로 전달하는 "중계자"입니다.  
> 이 패킷의 Source는 NAT Instance가 아니므로, Source/Dest Check가 활성화되어 있으면 패킷이 폐기됩니다.
>
> **이 설정을 비활성화하지 않으면 NAT가 동작하지 않습니다.** 가장 흔히 빠뜨리는 설정입니다.
>
> **Stop하면 어떻게 되는가:**
>
> ```
> Check 활성화 (기본):
> 패킷 도착 → "이 패킷의 Source/Dest가 내 IP인가?" → 아님 → ❌ 폐기
>
> Check 비활성화 (Stop):
> 패킷 도착 → Source/Dest 검사 안 함 → ✅ 그대로 수신 → iptables로 전달
> ```
>
> 즉 Stop하면 EC2가 "우편배달부"처럼 자기 것이 아닌 패킷도 받아서 전달할 수 있게 됩니다.  
> NAT, VPN, 로드밸런서 등 트래픽을 중계하는 모든 EC2에서 이 설정을 비활성화해야 합니다.

### NAT Instance에 IP Forwarding + iptables 설정

📍 **실행 위치: AWS 콘솔 → NAT Instance에 접속**

76. EC2 Instance Connect로 NAT Instance에 접속합니다:

> [!CONCEPT] EC2 Instance Connect
> **EC2 Instance Connect**는 AWS 콘솔에서 브라우저 기반으로 EC2에 SSH 접속하는 방법입니다.  
> 키 페어 없이, 별도 SSH 클라이언트 없이 바로 접속할 수 있습니다.  
> Public IP가 있는 인스턴스에서 사용 가능하며, Amazon Linux 2023에는 기본 설치되어 있습니다.

- EC2 콘솔 → **Instances**에서 `my-nat-instance`를 선택합니다.
- 상단 [[Connect]] 버튼을 클릭합니다.
- **EC2 Instance Connect** 탭을 선택합니다 (기본 선택됨).
- **Connection type**: `Connect using a Public IP` 선택 (기본값).
- **Username**: `ec2-user` (기본값 유지).
- [[Connect]] 버튼을 클릭합니다.

> [!OUTPUT]
> 브라우저에 새 탭이 열리며 터미널이 표시됩니다:
>
> ```
> [ec2-user@ip-10-0-2-xxx ~]$
> ```

> [!NOTE]
> EC2 Instance Connect는 키 페어 없이 접속할 수 있어 편리합니다.  
> 내부적으로 AWS가 임시 SSH 공개키를 인스턴스에 주입하여 60초간만 유효한 접속을 생성합니다.  
> Security Group에 SSH(22)가 열려있고 Public IP가 있으면 동작합니다.
>
> **SSH vs EC2 Instance Connect vs SSM Session Manager 비교:**
>
> | 방식                 | 필요 조건                       | 키 페어 필요 | 용도                   |
> | -------------------- | ------------------------------- | ------------ | ---------------------- |
> | SSH (터미널)         | SG 22번 + Public IP + .pem 파일 | ✅           | 파일 전송(SCP), 터널링 |
> | EC2 Instance Connect | SG 22번 + Public IP             | ❌           | 빠른 접속, 간단한 작업 |
> | SSM Session Manager  | IAM Role + 인터넷(NAT/Endpoint) | ❌           | Private EC2, 보안 환경 |

> [!TIP]
> **SSH로 접속해도 됩니다.** 터미널에서 SCP로 파일을 전송하거나, MobaXterm을 사용하려면 기존 방식으로 접속하세요:
>
> ```bash
> ssh -i ~/Downloads/my-keypair.pem ec2-user@<NAT-Instance-Public-IP>
> ```

📍 **실행 위치: NAT Instance (접속한 상태)**

77. iptables-services 패키지를 먼저 설치합니다:

```bash
sudo dnf install iptables-services -y
sudo systemctl enable iptables
sudo systemctl start iptables
```

> [!NOTE]
> `iptables-services`를 먼저 설치해야 나중에 `service iptables save` 명령으로 규칙을 영구 저장할 수 있습니다.

78. IP 포워딩을 활성화합니다:

```bash
# 설정 파일 생성 (재부팅 후에도 유지)
echo "net.ipv4.ip_forward = 1" | sudo tee /etc/sysctl.d/custom-ip-forwarding.conf

# 설정 적용 (즉시 활성화)
sudo sysctl -p /etc/sysctl.d/custom-ip-forwarding.conf
```

> [!NOTE]
> `ip_forward`는 Linux 커널이 자신에게 온 패킷을 다른 인터페이스로 전달(포워딩)할 수 있게 하는 설정입니다.  
> 기본값은 `0`(비활성화)이며, NAT 기능을 위해 `1`(활성화)로 변경해야 합니다.

79. 네트워크 인터페이스 이름을 확인합니다:

> [!NOTE]
> iptables NAT 규칙을 설정할 때 "어떤 네트워크 인터페이스로 패킷을 내보낼지" 지정해야 합니다.  
> 인터페이스 이름은 인스턴스 타입에 따라 다르므로(`ens5`, `enX0`, `eth0` 등) 먼저 확인합니다.  
> 잘못된 이름을 지정하면 iptables 규칙이 적용되지 않아 NAT가 동작하지 않습니다.하면 iptables 규칙이 동작하지 않습니다.

```bash
netstat -i
```

> [!OUTPUT]
>
> ```
> Kernel Interface table
> Iface      MTU    RX-OK RX-ERR RX-DRP RX-OVR    TX-OK TX-ERR TX-DRP TX-OVR Flg
> ens5      9001     1076      0      0 0          1247      0      0      0 BMRU
> lo       65536       24      0      0 0            24      0      0      0 LRU
> ```
>
> `lo`(루프백)를 제외한 인터페이스 이름을 확인합니다.  
> 위 예시에서는 `ens5`이 실제 네트워크 인터페이스입니다.  
> 인스턴스 타입에 따라 `ens5`, `enX0`, `eth0` 중 하나가 표시됩니다.  
> **이 이름을 다음 단계에서 사용하므로 기억해 두세요.**

> [!TIP]
> `netstat -i` 대신 `ip link show`로도 확인할 수 있습니다:
>
> ```bash
> ip link show | grep -v lo | grep "^[0-9]"
> ```

80. iptables NAT 규칙을 추가합니다.

```bash
# 기존 FORWARD 체인의 기본 규칙 제거 (REJECT가 있으면 모든 전달이 차단됨)
sudo iptables -F FORWARD

# 기존 NAT 규칙도 초기화 (중복 방지)
sudo iptables -t nat -F POSTROUTING

# NAT MASQUERADE 규칙 추가
sudo iptables -t nat -A POSTROUTING -o ens5 -s 10.0.0.0/16 -j MASQUERADE

# FORWARD 체인에서 관련 트래픽 허용
sudo iptables -A FORWARD -i ens5 -o ens5 -m state --state RELATED,ESTABLISHED -j ACCEPT
sudo iptables -A FORWARD -s 10.0.0.0/16 -o ens5 -j ACCEPT
```

> [!WARNING]
> 위 명령은 t3.micro(인터페이스 이름: `ens5`) 기준입니다.  
> 79번에서 `netstat -i`로 확인한 인터페이스 이름이 `ens5`가 아닌 경우, 모든 `ens5`를 본인의 인터페이스 이름으로 교체하세요.  
> **이름이 틀리면 규칙이 적용되지 않아 NAT가 동작하지 않습니다.**
>
> | 인스턴스 타입 | 인터페이스 이름 |
> | ------------- | --------------- |
> | t3 계열       | `ens5`          |
> | t2 계열       | `enX0`          |
> | 기타          | `eth0`          |

> [!WARNING]
> `sudo iptables -F FORWARD`를 **반드시 먼저 실행**하세요.  
> `iptables-services`를 시작하면 기본 규칙에 `REJECT all`이 FORWARD 체인 1번에 들어있습니다.  
> 이 REJECT 규칙이 있으면 아래에 ACCEPT를 추가해도 위에서 먼저 거부되어 NAT가 동작하지 않습니다.  
> `-F FORWARD`는 FORWARD 체인의 모든 기존 규칙을 삭제(flush)하는 명령입니다.

> [!NOTE]
> 각 명령의 의미:
>
> | 명령                                                         | 설명                                                               |
> | ------------------------------------------------------------ | ------------------------------------------------------------------ |
> | `-t nat -A POSTROUTING -o ens5 -s 10.0.0.0/16 -j MASQUERADE` | VPC 내부에서 온 패킷의 Source IP를 NAT Instance의 Public IP로 변환 |
> | `-A FORWARD ... RELATED,ESTABLISHED -j ACCEPT`               | 이미 연결된 세션의 응답 패킷 허용 (인터넷 → Private EC2 응답)      |
> | `-A FORWARD -s 10.0.0.0/16 -o ens5 -j ACCEPT`                | VPC 내부에서 인터넷으로 나가는 새 패킷 허용                        |
>
> **옵션 상세 설명:**
>
> | 옵션                                   | 의미                                                               |
> | -------------------------------------- | ------------------------------------------------------------------ |
> | `-t nat`                               | nat 테이블에 규칙 추가 (주소 변환용 테이블)                        |
> | `-A POSTROUTING`                       | 패킷이 인터페이스를 통해 나가기 직전에 적용하는 체인               |
> | `-A FORWARD`                           | 이 장비를 경유하여 다른 곳으로 전달되는 패킷에 적용하는 체인       |
> | `-o ens5`                              | 출력(out) 인터페이스 지정. 이 인터페이스로 나가는 패킷에만 적용    |
> | `-i ens5`                              | 입력(in) 인터페이스 지정. 이 인터페이스로 들어오는 패킷에만 적용   |
> | `-s 10.0.0.0/16`                       | Source(출발지) IP 필터. VPC 대역에서 온 패킷만 대상                |
> | `-j MASQUERADE`                        | 출발지 IP를 이 장비의 공인 IP로 동적 변환 (NAT 핵심 동작)          |
> | `-j ACCEPT`                            | 패킷 통과 허용                                                     |
> | `-m state --state RELATED,ESTABLISHED` | 이미 연결이 맺어진 세션 또는 그에 관련된 패킷만 매칭 (응답 트래픽) |

81. iptables 규칙을 영구 저장합니다 (재부팅 후에도 유지):

```bash
sudo service iptables save
```

> [!OUTPUT]
>
> ```
> iptables: Saving firewall rules to /etc/sysconfig/iptables: [  OK  ]
> ```

82. 설정이 올바른지 확인합니다:

```bash
# IP 포워딩 확인 (1이면 정상)
cat /proc/sys/net/ipv4/ip_forward

# iptables NAT 규칙 확인
sudo iptables -t nat -L POSTROUTING -v --line-numbers

# FORWARD 규칙 확인
sudo iptables -L FORWARD -v --line-numbers
```

> [!OUTPUT]
>
> ```
> 1
>
> Chain POSTROUTING (policy ACCEPT 0 packets, 0 bytes)
> num   pkts bytes target     prot opt in     out     source               destination
> 1        0     0 MASQUERADE  all  --  any    ens5    10.0.0.0/16          anywhere
>
> Chain FORWARD (policy ACCEPT 0 packets, 0 bytes)
> num   pkts bytes target     prot opt in     out     source               destination
> 1        0     0 ACCEPT     all  --  ens5   ens5    anywhere             anywhere             state RELATED,ESTABLISHED
> 2        0     0 ACCEPT     all  --  any    ens5    10.0.0.0/16          anywhere
> ```

83. NAT Instance에서 나갑니다:

```bash
exit
```

### Private Route Table에 NAT Instance 경로 추가

Private Subnet의 트래픽이 NAT Instance를 통해 인터넷으로 나가도록 Route Table에 경로를 추가합니다.

84. AWS 콘솔 상단 검색창에 `VPC`를 입력하고 **VPC** 서비스를 선택합니다.
85. 왼쪽 메뉴에서 **Route tables**를 선택합니다.
86. Route Table 목록에서 `my-private-rt-a`를 선택합니다.

> [!TIP]
> Route Table이 여러 개 보인다면 **Name** 열에서 `my-private-rt-a`를 찾으세요.  
> 또는 왼쪽 메뉴에서 **Subnets** → `my-private-subnet-a` 선택 → 하단 **Route table** 탭에서 연결된 Route Table ID를 확인합니다.

87. 하단 **Routes** 탭을 선택합니다.
88. [[Edit routes]] 버튼을 클릭합니다.
89. [[Add route]] 버튼을 클릭합니다.
90. 새 경로를 다음과 같이 설정합니다:
    - **Destination**: `0.0.0.0/0`
    - **Target**: 드롭다운에서 `Instance`를 선택 → `my-nat-instance`를 선택합니다.

> [!NOTE]
> `0.0.0.0/0`은 "모든 목적지"를 의미합니다. VPC 내부 트래픽(10.0.0.0/16)은 이미 `local` 경로로 처리되므로, 이 규칙은 VPC 외부(인터넷)로 나가는 트래픽에만 적용됩니다.

91. [[Save changes]] 버튼을 클릭합니다.

> [!OUTPUT]
> Routes 탭에 새 경로가 추가됩니다:
>
> | Destination | Target                         | Status |
> | ----------- | ------------------------------ | ------ |
> | 10.0.0.0/16 | local                          | Active |
> | 0.0.0.0/0   | eni-xxxxxxxx (my-nat-instance) | Active |

### NAT Instance 동작 테스트

📍 **실행 위치: 로컬 PC → Bastion → Private EC2**

92. 로컬 터미널에서 Bastion Host에 SSH 접속합니다:

```bash
ssh -i ~/Downloads/my-keypair.pem ec2-user@<Bastion-Public-IP>
```

93. Bastion에서 Private EC2에 접속합니다:

```bash
ssh -i ~/my-keypair.pem ec2-user@<Private-EC2-Private-IP>
```

94. 인터넷 접근을 테스트합니다:

```bash
# IP 직접 테스트
ping -c 3 8.8.8.8

# 도메인 테스트 (DNS 확인)
ping -c 3 google.com
```

> [!OUTPUT]
> 이번에는 응답이 돌아옵니다:
>
> ```
> PING google.com (142.250.xxx.xxx) 56(84) bytes of data.
> 64 bytes from nrt12s51-in-f14.1e100.net: icmp_seq=1 ttl=53 time=3.45 ms
> 64 bytes from nrt12s51-in-f14.1e100.net: icmp_seq=2 ttl=53 time=3.12 ms
> 64 bytes from nrt12s51-in-f14.1e100.net: icmp_seq=3 ttl=53 time=3.28 ms
> ```

95. 패키지 업데이트도 테스트합니다:

```bash
sudo dnf check-update
```

> [!OUTPUT]
> 패키지 목록이 정상적으로 표시됩니다. 인터넷 접근이 가능해졌습니다.

96. 외부 IP를 확인하여 NAT Instance의 Public IP로 나가는지 확인합니다:

```bash
curl -s http://checkip.amazonaws.com
```

> [!OUTPUT]
> NAT Instance의 Public IP가 출력됩니다:
>
> ```
> 3.35.xxx.xxx
> ```
>
> 이 IP가 NAT Instance의 Public IP와 동일한지 확인하세요. 동일하면 NAT가 정상 동작하는 것입니다.

> [!TROUBLESHOOTING]
> **NAT Instance를 통한 인터넷 접근이 안 되는 경우:**
>
> 아래 순서대로 하나씩 확인하세요. 위에서부터 가장 흔한 원인입니다.
>
> | #   | 확인 사항                     | 확인 명령/방법                                                         | 정상 상태                                      |
> | --- | ----------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------- |
> | 1   | Route Table에 NAT 경로 존재   | VPC 콘솔 → Route Tables → `my-private-rt-a` → Routes 탭                | `0.0.0.0/0` → `eni-xxx (my-nat-instance)` 존재 |
> | 2   | Source/Dest Check 비활성화    | EC2 콘솔 → `my-nat-instance` 선택 → Networking 탭 → Source/dest. check | `Stop` 상태                                    |
> | 3   | IP Forwarding 활성화          | NAT Instance에서: `cat /proc/sys/net/ipv4/ip_forward`                  | `1` 출력                                       |
> | 4   | FORWARD 체인에 REJECT 없음    | NAT Instance에서: `sudo iptables -L FORWARD --line-numbers`            | ACCEPT만 있고 REJECT 없음                      |
> | 5   | POSTROUTING에 MASQUERADE 존재 | NAT Instance에서: `sudo iptables -t nat -L POSTROUTING`                | MASQUERADE 규칙 1개 존재                       |
> | 6   | NAT Instance SG (인바운드)    | EC2 콘솔 → Security Groups → `my-nat-sg` → Inbound rules               | All traffic, `0.0.0.0/0` 허용                  |
> | 7   | Private EC2 SG (아웃바운드)   | EC2 콘솔 → Security Groups → `my-private-sg` → Outbound rules          | All traffic 허용 (기본값)                      |
>
> **가장 흔한 실수:**
>
> | 증상                               | 원인                                  | 해결                                                                    |
> | ---------------------------------- | ------------------------------------- | ----------------------------------------------------------------------- |
> | 모든 ping 타임아웃                 | FORWARD 체인에 REJECT 규칙이 남아있음 | `sudo iptables -F FORWARD` 후 ACCEPT 규칙 재추가                        |
> | 모든 ping 타임아웃                 | Source/Dest Check를 비활성화하지 않음 | EC2 콘솔 → Actions → Networking → Change source/dest check → Stop       |
> | IP(`8.8.8.8`)는 되는데 도메인 실패 | DNS 문제                              | VPC 콘솔 → my-vpc → Edit VPC settings → **DNS resolution: Enable** 확인 |
> | `curl` 안 됨, `ping`은 됨          | FORWARD 체인 ACCEPT 누락              | 80번 단계의 FORWARD 규칙 재실행                                         |
> | 규칙이 맞는데도 안 됨              | iptables 인터페이스 이름 오류         | `netstat -i`로 인터페이스 이름 재확인 (ens5? enX0?)                     |

97. Private EC2에서 나갑니다:

```bash
exit
```

98. Bastion에서도 나갑니다:

```bash
exit
```

### SSM Session Manager 접속 확인

NAT가 설정되었으므로 이제 Private EC2의 SSM Agent가 AWS에 등록될 수 있습니다.  
Bastion 없이 SSM Session Manager로 직접 접속해 봅니다.

> [!NOTE]
> SSM Agent 등록에는 NAT 설정 후 1~2분이 소요될 수 있습니다. 바로 안 되면 잠시 기다리세요.

99. AWS 콘솔 → **EC2** 서비스 → **Instances**에서 `my-private-ec2`를 선택합니다.
100. 상단 [[Connect]] 버튼을 클릭합니다.
101. **Session Manager** 탭을 선택합니다.
102. [[Connect]] 버튼을 클릭합니다.

> [!OUTPUT]
> 브라우저 내에서 터미널이 열리고 `sh-5.2$` 프롬프트가 표시됩니다.

103. 접속을 확인합니다:

```bash
whoami
ping -c 2 google.com
```

> [!OUTPUT]
>
> ```
> ssm-user
> PING google.com ...
> 64 bytes from ...
> ```
>
> SSM으로 접속하면 기본 사용자가 `ssm-user`입니다 (SSH의 `ec2-user`와 다름).

104. SSM 세션을 종료합니다: 우측 상단 [[Terminate session]] 버튼을 클릭합니다.

> [!TIP]
> **핵심 포인트:**  
> NAT 설정 전에는 SSM 접속이 불가능했지만, NAT를 연결하자 Bastion 없이도 Private EC2에 접속할 수 있게 되었습니다.  
> 이것이 실무에서 NAT가 필수인 이유 중 하나입니다 — **Private EC2를 SSM으로 관리하려면 NAT(또는 VPC Endpoint)가 필요합니다.**

> [!TROUBLESHOOTING]
> **Session Manager Connect 버튼이 비활성(회색)인 경우:**
>
> | 원인                             | 해결 방법                                                                           |
> | -------------------------------- | ----------------------------------------------------------------------------------- |
> | SSM Agent 미등록 (NAT 설정 직후) | 1~2분 대기 후 페이지 새로고침                                                       |
> | IAM Role 미연결                  | EC2 → 인스턴스 선택 → Actions → Security → Modify IAM role → `my-ec2-ssm-role` 선택 |
> | NAT 경로 누락                    | Route Table에 0.0.0.0/0 → NAT Instance 경로가 있는지 확인                           |

✅ **태스크 완료**: NAT Instance를 통해 Private EC2에서 인터넷 접근이 가능하고, SSM Session Manager로도 접속할 수 있습니다.

## 태스크 3: NAT Gateway 구성

> [!WARNING]
> **NAT Gateway는 생성 시점부터 시간당 과금됩니다** (서울 리전 기준 ~$0.059/시간, 일 ~$1.42).  
> 테스트가 끝나면 즉시 삭제하세요. 생성 후 방치하면 하루만에 크레딧이 빠르게 소진됩니다.  
> 이 태스크의 목표는 NAT Gateway 동작을 확인하는 것이므로, 테스트 완료 후 바로 [리소스 정리](#cleanup)를 진행하는 것을 권장합니다.

> [!CONCEPT] NAT Gateway
> NAT Gateway는 AWS 관리형 NAT 서비스입니다. NAT Instance와 동일한 기능을 제공하지만, AWS가 가용성·대역폭·패치를 모두 관리합니다.
>
> **NAT Instance와의 핵심 차이:**
>
> | 항목              | NAT Instance                       | NAT Gateway                       |
> | ----------------- | ---------------------------------- | --------------------------------- |
> | 관리              | 사용자가 직접 (패치, 모니터링)     | AWS 관리형                        |
> | 가용성            | 단일 인스턴스 (장애 시 중단)       | AZ 내 이중화 (Regional은 멀티 AZ) |
> | 대역폭            | 인스턴스 타입에 의존               | 최대 100 Gbps                     |
> | Source/Dest Check | 수동 비활성화 필요                 | 해당 없음 (자동 처리)             |
> | 비용              | EC2 비용 (t3.micro 크레딧 내 가능) | 시간당 과금 + 데이터 처리 비용    |
>
> **관리형 vs 직접 운영 — 보이지 않는 비용:**
>
> | 항목                  | NAT Instance (직접 운영)           | NAT Gateway (AWS 관리형) |
> | --------------------- | ---------------------------------- | ------------------------ |
> | 서비스 비용           | t3.micro ~$10/월                   | ~$45/월 (시간당 $0.059)  |
> | OS 패치/보안 업데이트 | 운영자가 주기적으로 수행           | AWS가 자동 처리          |
> | 장애 감지/복구        | 모니터링 설정 + 수동 대응          | 자동 Failover            |
> | 용량 확장             | 인스턴스 타입 변경 (다운타임 발생) | 자동 확장 (100Gbps까지)  |
> | 인력 비용             | 운영자 시간 소모 (시급 환산하면?)  | 없음                     |
>
> NAT Gateway가 비용만 보면 4~5배 비싸지만, 운영 환경의 목적에 따라 선택해야 합니다.  
> 안정성이 중요한 프로덕션 → NAT Gateway (운영 부담 없음, 장애 자동 복구)  
> 비용이 극히 제한된 개발/학습 환경 → NAT Instance (직접 관리해야 하지만 저렴)  
> 서비스 비용뿐 아니라 운영자의 시간(패치, 모니터링, 장애 대응)도 비용임을 인식하고, 상황에 맞게 판단하세요.

먼저 NAT Instance 경로를 제거하고, NAT Gateway로 교체합니다.

### Private Route Table에서 NAT Instance 경로 제거

105. AWS 콘솔 → **VPC** 서비스 → 왼쪽 메뉴에서 **Route tables**를 선택합니다.
106. `my-private-rt-a`를 선택합니다.
107. 하단 **Routes** 탭을 선택합니다.
108. [[Edit routes]] 버튼을 클릭합니다.
109. `0.0.0.0/0` → `eni-xxxxxxxx (my-nat-instance)` 경로 옆의 [[Remove]] 버튼(X 아이콘)을 클릭합니다.
110. [[Save changes]] 버튼을 클릭합니다.

> [!NOTE]
> NAT Instance 경로를 제거하면 Private EC2는 다시 인터넷에 접근할 수 없게 됩니다.  
> 이제 NAT Gateway를 생성하여 새 경로를 추가합니다.

### NAT Gateway 생성

111. VPC 콘솔 왼쪽 메뉴에서 **NAT gateways**를 선택합니다.
112. [[Create NAT gateway]] 버튼을 클릭합니다.
113. 다음과 같이 설정합니다:
     - **Name**: `my-nat-gateway`
     - **Availability mode**: `Zonal` 선택
     - **Subnet**: 드롭다운에서 `my-public-subnet-a`를 선택합니다.
     - **Connectivity type**: `Public` (기본값)
     - **Elastic IP allocation ID**: 오른쪽의 [[Allocate Elastic IP]] 버튼을 클릭합니다.

> [!OUTPUT]
> 상단에 "Elastic IP address x.x.x.x (eipalloc-xxx) allocated." 배너가 표시되고,  
> Elastic IP allocation ID 드롭다운에 방금 생성된 EIP가 자동으로 선택됩니다.

> [!NOTE]
> **Zonal vs Regional:**
>
> | 모드                | 특징                                                | 사용 시점                        |
> | ------------------- | --------------------------------------------------- | -------------------------------- |
> | **Zonal**           | 지정한 Subnet(AZ)에 1개 생성. Subnet 지정 필요      | AZ별 세밀한 제어가 필요할 때     |
> | **Regional** (신규) | VPC 내 모든 AZ에 자동 확장/축소. Subnet 지정 불필요 | 멀티 AZ 고가용성을 간편하게 구성 |
>
> 이 실습에서는 **Zonal**을 선택하여 특정 Subnet에 NAT Gateway를 배치하고, Route Table에 수동 연결하는 과정을 학습합니다.  
> Regional 모드는 Route Table도 자동 생성되어 편리하지만, 학습 목적에서는 직접 연결하는 Zonal이 개념 이해에 적합합니다.

> [!WARNING]
> **[[Allocate Elastic IP]] 버튼으로 생성한 EIP는 NAT Gateway 삭제 시 자동 해제되지 않습니다.**  
> NAT Gateway를 삭제한 후 VPC 콘솔 → Elastic IPs에서 미사용 EIP를 직접 Release해야 합니다.  
> 해제하지 않으면 시간당 $0.005가 계속 과금됩니다.

114. **Tags** 섹션에서 [[Add new tag]]를 클릭합니다:
     - **Key**: `Name`, **Value**: `my-nat-gateway`
     - [[Add new tag]] 추가: **Key**: `CreatedBy`, **Value**: `admin-user`
     - [[Add new tag]] 추가: **Key**: `Step`, **Value**: `step3`
     - [[Add new tag]] 추가: **Key**: `Session`, **Value**: `3-1`

115. [[Create NAT gateway]] 버튼을 클릭합니다.

> [!OUTPUT]
> NAT Gateway가 생성됩니다. 상태가 `Pending` → `Available`로 변경될 때까지 약 1~2분 기다립니다.

> [!NOTE]
> NAT Gateway 상태 변화:
>
> - **Pending**: 생성 중 (1~2분 소요)
> - **Available**: 사용 가능 (Route Table에 연결 가능)
> - **Deleting**: 삭제 중
> - **Deleted**: 삭제 완료
> - **Failed**: 생성 실패
>
> **반드시 `Available` 상태가 된 후** 다음 단계를 진행하세요. Pending 상태에서 Route Table에 추가하면 실패합니다.

### Private Route Table에 NAT Gateway 경로 추가

116. 왼쪽 메뉴에서 **Route tables**를 선택합니다.
117. `my-private-rt-a`를 선택합니다.
118. 하단 **Routes** 탭을 선택합니다.
119. [[Edit routes]] 버튼을 클릭합니다.
120. [[Add route]] 버튼을 클릭합니다.
121. 새 경로를 다음과 같이 설정합니다:
     - **Destination**: `0.0.0.0/0`
     - **Target**: 드롭다운에서 `NAT Gateway`를 선택 → `my-nat-gateway`를 선택합니다.

122. [[Save changes]] 버튼을 클릭합니다.

> [!OUTPUT]
> Routes 탭에 새 경로가 추가됩니다:
>
> | Destination | Target                        | Status |
> | ----------- | ----------------------------- | ------ |
> | 10.0.0.0/16 | local                         | Active |
> | 0.0.0.0/0   | nat-xxxxxxxx (my-nat-gateway) | Active |

> [!TIP]
> **VPC Resource Map으로 전체 구성을 시각적으로 확인해 보세요.**  
> VPC 콘솔 → 왼쪽 메뉴 **Your VPCs** → `my-vpc` 선택 → 하단 **Resource map** 탭을 클릭하면, VPC 안의 Subnet, Route Table, NAT Gateway, IGW 연결 관계를 한눈에 볼 수 있습니다.  
> Private Subnet → Route Table → NAT Gateway → IGW 흐름이 시각적으로 표시됩니다.

### NAT Gateway 동작 테스트

📍 **실행 위치: 로컬 PC → Bastion → Private EC2**

123. 로컬 터미널에서 Bastion Host에 SSH 접속합니다:

```bash
ssh -i ~/Downloads/my-keypair.pem ec2-user@<Bastion-Public-IP>
```

124. Bastion에서 Private EC2에 접속합니다:

```bash
ssh -i ~/my-keypair.pem ec2-user@<Private-EC2-Private-IP>
```

125. 인터넷 접근을 테스트합니다:

```bash
ping -c 3 google.com
```

> [!OUTPUT]
> NAT Gateway를 통해 인터넷 접근이 가능합니다:
>
> ```
> PING google.com (142.250.xxx.xxx) 56(84) bytes of data.
> 64 bytes from nrt12s51-in-f14.1e100.net: icmp_seq=1 ttl=53 time=2.89 ms
> 64 bytes from nrt12s51-in-f14.1e100.net: icmp_seq=2 ttl=53 time=2.65 ms
> 64 bytes from nrt12s51-in-f14.1e100.net: icmp_seq=3 ttl=53 time=2.71 ms
> ```

126. 외부 IP를 확인합니다:

```bash
curl -s http://checkip.amazonaws.com
```

> [!OUTPUT]
> NAT Gateway에 할당한 Elastic IP가 출력됩니다:
>
> ```
> 3.35.xxx.xxx
> ```
>
> 이 IP가 NAT Gateway의 Elastic IP와 동일한지 확인하세요.  
> NAT Instance 때와 다른 IP인 것을 확인할 수 있습니다.

127. 패키지 업데이트를 테스트합니다:

```bash
sudo dnf check-update
```

> [!OUTPUT]
> 패키지 목록이 정상적으로 표시됩니다.

128. Private EC2에서 나갑니다:

```bash
exit
```

129. Bastion에서도 나갑니다:

```bash
exit
```

✅ **태스크 완료**: NAT Gateway를 통해 Private EC2에서 인터넷 접근이 가능합니다.

## 태스크 4: NAT Instance vs NAT Gateway 비교 정리

두 방식을 모두 실습했으므로 차이를 정리합니다.

| 구분                  | NAT Instance                                      | NAT Gateway                          |
| --------------------- | ------------------------------------------------- | ------------------------------------ |
| **관리**              | 사용자가 직접 관리 (OS 패치, 모니터링, 장애 대응) | AWS 완전 관리형                      |
| **가용성**            | 단일 인스턴스 (SPOF — 장애 시 서비스 중단)        | AZ 내 이중화 (자동 Failover)         |
| **대역폭**            | 인스턴스 타입에 의존 (t3.micro: ~1Gbps)           | 최대 100 Gbps (자동 확장)            |
| **비용**              | EC2 비용 (t3.micro 크레딧 내 사용 가능)           | 시간당 ~$0.059 + 데이터 GB당 ~$0.059 |
| **Security Group**    | 적용 가능 (세밀한 제어)                           | 적용 불가 (NACL로만 제어)            |
| **포트 포워딩**       | 가능 (iptables)                                   | 불가                                 |
| **Bastion 겸용**      | 가능 (NAT + SSH 점프 서버)                        | 불가                                 |
| **Source/Dest Check** | 수동 비활성화 필요                                | 해당 없음 (자동 처리)                |
| **설정 복잡도**       | 높음 (IP Forward, iptables, SG, Route Table)      | 낮음 (생성 → Route Table 연결만)     |
| **권장 환경**         | 개발/테스트, 비용 절약, 학습                      | 운영 환경, 고가용성 필요 시          |

> [!TIP]
> **어떤 것을 선택해야 할까?**
>
> - **학습/개발 환경**: NAT Instance (비용 절약, 다양한 설정 학습 가능)
> - **운영 환경**: NAT Gateway (고가용성, 관리 부담 없음)
> - **비용이 가장 중요**: NAT Instance (t3.micro 크레딧 내 사용 가능)
> - **안정성이 가장 중요**: NAT Gateway (AWS SLA 보장)
>
> 대부분의 실무 환경에서는 NAT Gateway를 사용합니다. NAT Instance는 학습 또는 비용이 극히 제한된 개발 환경에서 고려합니다.

✅ **태스크 완료**: NAT Instance와 NAT Gateway의 차이를 이해했습니다.

## 마무리

다음을 성공적으로 수행했습니다:

- Private Subnet에서 인터넷 접근이 불가능함을 직접 확인했습니다.
- NAT Instance를 구성하고 Source/Dest Check 비활성화, IP Forwarding, iptables MASQUERADE를 설정했습니다.
- NAT Gateway를 생성하고 Elastic IP를 할당하여 Private Route Table에 연결했습니다.
- 두 방식의 장단점을 비교하고 적합한 사용 사례를 이해했습니다.

### Private Subnet에서 NAT가 있을 때 vs 없을 때

| 항목                           | NAT 없음 (Private Only) | NAT 있음 (Private + NAT)   |
| ------------------------------ | ----------------------- | -------------------------- |
| 인터넷 아웃바운드              | ❌ 불가                 | ✅ NAT를 경유하여 가능     |
| 인터넷 인바운드 (외부→내부)    | ❌ 차단                 | ❌ **여전히 차단**         |
| 패키지 설치 (dnf, apt)         | ❌ 불가                 | ✅ 가능                    |
| 외부 API 호출                  | ❌ 불가                 | ✅ 가능                    |
| AWS Systems Manager (SSM) 접속 | ❌ Agent 등록 불가      | ✅ Agent 등록 후 접속 가능 |
| 외부에서 직접 SSH 접속         | ❌ 불가                 | ❌ **여전히 불가**         |
| Amazon CloudWatch 로그 전송    | ❌ 불가                 | ✅ 가능                    |

> [!NOTE]
> **핵심: NAT는 "나가는 문"만 열어줍니다.**  
> NAT를 연결해도 외부에서 Private EC2로 직접 접근하는 것은 **불가능**합니다.  
> 외부 → Private EC2 접근은 반드시 Bastion, SSM, 또는 Application Load Balancer (ALB)를 경유해야 합니다.
>
> 이것이 바로 Private Subnet + NAT 조합이 보안적으로 우수한 이유입니다:
>
> - **공격 표면 최소화**: 외부에서 인스턴스에 직접 접근 불가
> - **아웃바운드만 허용**: 필요한 업데이트/API 호출은 가능
> - **감사 용이**: 모든 아웃바운드 트래픽이 NAT의 EIP를 통해 나가므로 추적 가능
> - **방화벽 화이트리스트**: 외부 서비스에서 NAT EIP만 허용하면 됨

### 왜 Private Subnet을 쓰는가?

```
Public Subnet (모든 것이 열린 환경):
인터넷 ←→ EC2  양방향 통신 가능
→ 편리하지만 공격에 노출

Private Subnet + NAT (제어된 환경):
인터넷 ← EC2   나가는 것만 가능 (NAT 경유)
인터넷 → EC2   ❌ 직접 접근 차단
→ 불편하지만 보안 강화

실무 아키텍처:
┌─── Public Subnet ───┐   ┌─── Private Subnet ───┐
│  ALB (공개 접점)     │   │  App Server          │
│  Bastion (관리용)    │   │  DB Server           │
│  NAT Gateway         │   │  배치 서버            │
└──────────────────────┘   └───────────────────────┘
외부에 노출해도 되는 것만    외부 노출이 불필요한 것은
Public에 배치                Private에 배치
```

> [!TIP]
> **실무 원칙: 외부 노출이 불필요한 리소스는 모두 Private Subnet에 배치합니다.**  
> 웹 서버라도 ALB 뒤에 Private Subnet에 두는 것이 표준 아키텍처입니다.  
> NAT는 Private 리소스가 "필요할 때만 바깥으로 나갈 수 있는 통로"를 제공합니다.

---

# 리소스 정리

> [!WARNING]
> **NAT Gateway와 Elastic IP는 사용하지 않아도 시간당 과금됩니다.** 실습이 끝나면 즉시 삭제하세요.
>
> | 리소스             | 방치 시 일일 비용 | 방치 시 월 비용 |
> | ------------------ | ----------------- | --------------- |
> | NAT Gateway        | ~$1.42/일         | ~$42.5/월       |
> | EC2 t3.micro × 3대 | ~$1.04/일         | ~$31/월         |
> | **합계**           | **~$2.46/일**     | **~$73.5/월**   |
>
> ※ 위 금액은 작성 시점 기준 참고 값이며, 실제 요금은 상이할 수 있습니다.  
> NAT Gateway 삭제 후 Elastic IP를 별도로 해제하지 않으면 시간당 $0.005가 추가 과금됩니다.

### 삭제 순서 (의존 관계)

> [!NOTE]
> 리소스 간 의존 관계가 있으므로 반드시 아래 순서대로 삭제해야 합니다.  
> 순서를 무시하면 "리소스가 사용 중" 에러가 발생합니다.
>
> ```
> ① Tag Editor로 리소스 확인
>     ↓
> ② Route Table 경로 제거
>     ↓
> ③ NAT Gateway 삭제 (1~2분 대기)
>     ↓
> ④ EIP 잔여 확인 (Manual 사용 시 수동 해제)
>     ↓
> ⑤ EC2 인스턴스 종료 (3대)
>     ↓
> ⑥ CloudFormation 스택 삭제 (VPC, Subnet, SG 자동 정리)
>     ↓
> ⑦ Tag Editor로 누락 리소스 재확인
> ```

---

### 단계 1: Tag Editor로 생성된 리소스 확인

삭제 전에 이 실습에서 생성한 리소스를 확인합니다.

1. AWS Management Console 상단 검색창에 `Resource Groups & Tag Editor`를 입력하고 선택합니다.
2. 왼쪽 메뉴에서 **Tag Editor**를 선택합니다.
3. 다음과 같이 설정합니다:
   - **Regions**: `ap-northeast-2`
   - **Resource types**: `All supported resource types`
   - **Tag key**: `Session`
   - **Tag value**: `3-1`
4. [[Search resources]] 버튼을 클릭합니다.
5. 이 실습에서 생성한 리소스가 표시되는지 확인합니다.

> [!TIP]
> Tag Editor는 리소스를 찾는 용도로만 사용합니다. 실제 삭제는 다음 단계에서 수행합니다.  
> 검색 결과에 EC2 인스턴스, NAT Gateway, Elastic IP, VPC, Subnet, SG 등이 보여야 합니다.

> [!NOTE]
> CloudFormation으로 생성한 리소스에는 `Session: 3-1` 태그가 자동 적용되어 있습니다.  
> 수동 생성한 EC2, NAT Gateway, Elastic IP도 태그를 적용했으므로 모두 검색됩니다.

---

### 단계 2: Private Route Table 경로 제거

6. AWS 콘솔 → **VPC** 서비스 → 왼쪽 메뉴에서 **Route tables**를 선택합니다.
7. `my-private-rt-a`를 선택합니다.
8. 하단 **Routes** 탭을 선택합니다.
9. [[Edit routes]] 버튼을 클릭합니다.
10. `0.0.0.0/0` 경로 옆의 [[Remove]] 버튼(X 아이콘)을 클릭합니다.
11. [[Save changes]] 버튼을 클릭합니다.

> [!NOTE]
> NAT Gateway/NAT Instance 경로가 이미 제거되어 있거나 없다면 이 단계를 건너뛰세요.

---

### 단계 3: NAT Gateway 삭제

12. VPC 콘솔 왼쪽 메뉴에서 **NAT gateways**를 선택합니다.
13. `my-nat-gateway`를 선택합니다.
14. 상단 **Actions** → **Delete NAT gateway**를 클릭합니다.
15. 확인 입력란에 `delete`를 입력합니다.
16. [[Delete]] 버튼을 클릭합니다.
17. 상태가 `Deleting` → `Deleted`로 변경될 때까지 기다립니다 (약 1~2분).

> [!WARNING]
> NAT Gateway 상태가 `Deleted`로 변경된 것을 **반드시 확인 **한 후 다음 단계를 진행하세요.  
> 삭제가 완료되지 않으면 Elastic IP를 해제할 수 없습니다.

> [!NOTE]
> NAT Gateway를 생성하지 않은 경우(태스크 2만 진행한 경우) 이 단계를 건너뛰세요.

---

### 단계 4: Elastic IP 해제

> [!WARNING]
> Zonal NAT Gateway에서 [[Allocate Elastic IP]]로 생성한 EIP는 NAT Gateway 삭제 시 **자동 해제되지 않습니다.**  
> 반드시 수동으로 해제하세요. 미해제 시 시간당 $0.005가 계속 과금됩니다.

18. VPC 콘솔 왼쪽 메뉴에서 **Elastic IPs**를 선택합니다.
19. 미사용 EIP (Association 열이 비어있는 것)를 선택합니다.
20. 상단 **Actions** → **Release Elastic IP addresses**를 클릭합니다.
21. 확인 팝업에서 [[Release]] 버튼을 클릭합니다.

> [!TROUBLESHOOTING]
> **"Cannot be released with association IDs" 에러:**  
> EIP가 아직 NAT Gateway에 연결(associated)되어 있습니다.  
> NAT Gateway가 완전히 삭제될 때까지 1~2분 더 기다린 후 다시 시도하세요.  
> VPC 콘솔 → NAT Gateways에서 상태가 `Deleted`인지 확인합니다.

---

### 단계 5: EC2 인스턴스 종료

22. 상단 검색창에 `EC2`를 입력하고 **EC2** 서비스를 선택합니다.
23. 왼쪽 메뉴에서 **Instances**를 선택합니다.
24. 다음 3개 인스턴스를 모두 체크합니다:
    - `my-nat-instance`
    - `my-private-ec2`
    - `my-bastion`
25. 상단 **Instance state** → **Terminate instance**를 클릭합니다.
26. 확인 팝업에서 [[Terminate]] 버튼을 클릭합니다.
27. 모든 인스턴스의 상태가 `Shutting down` → `Terminated`로 변경되는 것을 확인합니다.

> [!TIP]
> 여러 인스턴스를 동시에 선택(체크박스 여러 개 클릭)하여 한 번에 종료할 수 있습니다.

> [!WARNING]
> **Terminate는 되돌릴 수 없습니다.** 인스턴스 이름을 반드시 확인한 후 종료하세요.  
> 다른 Step에서 사용 중인 인스턴스를 실수로 종료하지 않도록 주의합니다.

---

### 단계 6: CloudFormation 스택 삭제 (태스크 0에서 생성한 경우)

> [!NOTE]
> Step 1에서 생성한 VPC를 그대로 사용한 경우(태스크 0을 건너뛴 경우) 이 단계를 건너뛰세요.  
> 이후 Step에서도 같은 VPC를 사용할 예정이라면 삭제하지 마세요.

28. 상단 검색창에 `CloudFormation`을 입력하고 선택합니다.
29. **Stacks** 목록에서 `nat-lab-prereq` 스택을 선택합니다.
30. [[Delete]] 버튼을 클릭합니다.
31. 확인 팝업에서 [[Delete stack]]을 클릭합니다.
32. 스택 상태가 `DELETE_IN_PROGRESS` → `DELETE_COMPLETE`가 될 때까지 기다립니다 (약 2~3분).

> [!NOTE]
> CloudFormation 스택을 삭제하면 스택이 생성한 모든 리소스(VPC, Subnet, IGW, Route Table, Security Group, IAM Role)가 자동으로 삭제됩니다.

> [!TROUBLESHOOTING]
> **스택 삭제가 `DELETE_FAILED` 상태인 경우:**
>
> | 원인                                    | 해결 방법                                                                                                 |
> | --------------------------------------- | --------------------------------------------------------------------------------------------------------- |
> | EC2 인스턴스가 아직 Terminated되지 않음 | EC2 콘솔에서 인스턴스가 `Terminated` 상태인지 확인 → 1~2분 대기 후 재시도                                 |
> | NAT Gateway가 아직 삭제되지 않음        | VPC 콘솔에서 NAT Gateway 상태 확인 → `Deleted` 확인 후 재시도                                             |
> | "has dependencies" 에러                 | CloudFormation → 스택 선택 → **Events** 탭에서 실패 원인 확인 → 해당 리소스 수동 삭제 후 스택 삭제 재시도 |
> | Network Interface 삭제 불가             | EC2 Terminate 후 ENI가 정리될 때까지 2~3분 추가 대기 후 재시도                                            |

---

### 단계 7: Tag Editor로 누락 리소스 재확인

33. 상단 검색창에 `Resource Groups & Tag Editor`를 입력하고 선택합니다.
34. 왼쪽 메뉴에서 **Tag Editor**를 선택합니다.
35. 동일한 조건으로 검색합니다:
    - **Regions**: `ap-northeast-2`
    - **Resource types**: `All supported resource types`
    - **Tag key**: `Session`
    - **Tag value**: `3-1`
36. [[Search resources]] 버튼을 클릭합니다.
37. 검색 결과가 비어있거나, `Terminated` 상태의 EC2만 남아있으면 정상입니다.

> [!NOTE]
> 만약 삭제하지 않은 리소스가 검색된다면, 해당 리소스를 클릭하여 콘솔에서 직접 삭제하세요.  
> 특히 Elastic IP가 남아있으면 계속 과금되므로 즉시 해제합니다.

---

### 삭제 확인 체크리스트

모든 정리가 완료되었는지 최종 확인합니다:

| 확인 항목           | 위치                    | 상태                                     |
| ------------------- | ----------------------- | ---------------------------------------- |
| EC2 인스턴스 3대    | EC2 콘솔 → Instances    | `Terminated`                             |
| NAT Gateway         | VPC 콘솔 → NAT gateways | `Deleted` (또는 목록에서 사라짐)         |
| Elastic IP          | VPC 콘솔 → Elastic IPs  | 미사용 EIP 없음 (Release 완료)           |
| CloudFormation 스택 | CloudFormation 콘솔     | `DELETE_COMPLETE` (또는 목록에서 사라짐) |

> [!NOTE]
>
> - Terminated 상태의 인스턴스는 약 1시간 후 콘솔 목록에서 자동으로 사라집니다.
> - Deleted 상태의 NAT Gateway는 약 1시간 후 목록에서 사라집니다.
> - 삭제 직후 목록에 남아있어도 과금은 즉시 중단됩니다.

> [!TIP]
> **비용 확인**: AWS 콘솔 우측 상단 계정명 클릭 → **Billing and Cost Management** → **Bills**에서 당일 발생 비용을 확인할 수 있습니다. (반영까지 수 시간 소요)

✅ **실습 종료**: 모든 리소스가 정리되었습니다.

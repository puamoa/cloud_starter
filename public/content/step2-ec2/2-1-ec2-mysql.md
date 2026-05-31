---
title: 'Amazon EC2에 MySQL 8.0 직접 설치 및 설정'
week: 2
session: 1
awsServices:
  - Amazon EC2
  - Amazon VPC
learningObjectives:
  - EC2 인스턴스를 생성하고 SSH로 접속할 수 있습니다.
  - Amazon Linux 2023에 MySQL 8.0을 설치할 수 있습니다.
  - MySQL 보안 초기화 및 사용자/데이터베이스를 생성할 수 있습니다.
  - 외부 접속을 위한 MySQL 설정을 구성할 수 있습니다.
prerequisites:
  - AWS 계정 생성 완료
  - SSH 키 페어 보유 (또는 실습 중 생성)
  - VPC 및 Security Group 생성 완료 (또는 CloudFormation으로 생성)
estimatedCost: 크레딧 내 사용 가능 (비용 발생 가능)
---

이 실습에서는 EC2 인스턴스를 생성하고, SSH로 접속하여 MySQL 8.0을 직접 설치합니다.  
데이터베이스와 사용자를 생성하고, 외부에서 접속할 수 있도록 설정합니다.

> [!NOTE]
> 이 실습은 VPC, Public Subnet, Internet Gateway, Security Group이 필요합니다.  
> 이미 있다면 그것을 사용합니다. 없다면 태스크 0의 CloudFormation으로 한 번에 생성합니다.

## 태스크 0: 선행 리소스 생성 (CloudFormation)

> [!DOWNLOAD]
> [step2-1-ec2-lab.zip](/files/step2/step2-1-ec2-lab.zip)
>
> - `step2-1-ec2-prereq.yaml` - CloudFormation 템플릿 (VPC, 서브넷 4개, IGW, Route Table, Security Group 자동 생성)
> - `README.md` - 템플릿 설명 문서 (생성되는 리소스, 파라미터, 아키텍처 등)

이미 Step 1-2에서 생성한 VPC(`my-vpc`), Public/Private Subnet, Security Group이 있다면 이 태스크를 건너뛰고 태스크 1로 이동합니다.

> [!NOTE]
> 이 CloudFormation 템플릿은 Step 1-1 ~ 1-3에서 수동으로 구성한 환경과 동일한 구성을 한 번에 생성합니다.
>
> **생성되는 리소스:**
>
> | 리소스           | 이름 (기본값)                                        | 설명                       |
> | ---------------- | ---------------------------------------------------- | -------------------------- |
> | VPC              | `my-vpc`                                             | 10.0.0.0/16                |
> | Public Subnet    | `my-public-subnet-a`, `my-public-subnet-c`           | 10.0.1.0/24, 10.0.2.0/24   |
> | Private Subnet   | `my-private-subnet-a`, `my-private-subnet-c`         | 10.0.11.0/24, 10.0.12.0/24 |
> | Internet Gateway | `my-igw`                                             | VPC에 자동 연결            |
> | Route Table      | `my-public-rt`, `my-private-rt-a`, `my-private-rt-c` | Public RT에 IGW 경로 포함  |
> | Security Group   | `my-ec2-sg`, `my-rds-sg`                             | EC2용, RDS용               |

1. 다운로드한 zip 파일의 압축을 해제합니다.

> [!TIP]
> zip을 해제하면 폴더 없이 바로 `step2-1-ec2-prereq.yaml`과 `README.md` 파일이 나옵니다.  
> `README.md`에 템플릿의 상세 설명(생성 리소스, 파라미터, 아키텍처 다이어그램 등)이 있으니 참고하세요.

2. AWS Management Console에 로그인합니다.
3. 리전을 **Asia Pacific (Seoul) ap-northeast-2**로 설정합니다.
4. 상단 검색창에 `CloudFormation`을 입력하고 선택합니다.

> [!NOTE]
> AWS CloudFormation 콘솔 UI는 주기적으로 업데이트됩니다.  
> 버튼명이나 화면 구성이 가이드와 다를 수 있으나, 전체 흐름(템플릿 업로드 → 스택 이름 입력 → 파라미터 설정 → 생성)은 동일합니다.

5. [[Create stack]] 드롭다운을 클릭한 후 **With new resources (standard)**를 선택합니다.
6. **Prerequisite - Prepare template**에서 `Choose an existing template`를 선택합니다.
7. **Specify template**에서 `Upload a template file`을 선택합니다.
8. [[Choose file]] 버튼을 클릭하고 `step2-1-ec2-prereq.yaml` 파일을 선택합니다.

> [!TIP]
> 파일 탐색기에서 YAML 파일을 **드래그 앤 드롭**으로 업로드 영역에 끌어다 놓아도 됩니다.

9. [[Next]] 버튼을 클릭합니다.
10. **Stack name**에 `ec2-lab-prereq`를 입력합니다.
11. **Parameters** 섹션에서 값을 확인합니다:
    - **ProjectName**: `my` (기본값 유지)
    - **SSHAccessCidr**: `0.0.0.0/0` (기본값) → 본인 IP로 변경 권장 (예: `203.0.113.50/32`)
    - 나머지 CIDR 파라미터: 기본값 유지

> [!WARNING]
> **Network CIDR 파라미터는 기본값을 유지하세요.**  
> 서브넷 CIDR은 반드시 VPC CIDR(10.0.0.0/16) 범위 안에 있어야 하며, 서브넷끼리 겹치면 안 됩니다.  
> CloudFormation은 입력 시점에 이를 검증하지 않고, 리소스 생성 중에 실패합니다.  
> 잘못된 값을 입력하면 스택이 `CREATE_FAILED` 상태가 되고 자동 롤백됩니다.  
> 특별한 이유가 없다면 기본값 그대로 사용하세요.

> [!NOTE]
> 파라미터 입력 화면은 3개 그룹으로 나뉘어 표시됩니다:
>
> | 그룹                              | 포함 파라미터                  | 설명                                                       |
> | --------------------------------- | ------------------------------ | ---------------------------------------------------------- |
> | **Required Settings**             | `ProjectName`, `SSHAccessCidr` | 반드시 확인하세요. 리소스 이름과 SSH 보안에 영향을 줍니다. |
> | **Network CIDR**                  | VPC/Subnet CIDR 5개            | 기본값 그대로 사용하면 됩니다. Step 1과 동일한 구성입니다. |
> | **Security Group Access Control** | HTTP, HTTPS, 8080              | 기본값(0.0.0.0/0)은 전체 허용. 필요 시 제한 가능합니다.    |
>
> **ProjectName**은 모든 리소스 이름의 접두사로 사용됩니다.  
> 기본값 `my`를 사용하면 `my-vpc`, `my-public-subnet-a`, `my-ec2-sg` 등으로 생성됩니다.  
> Step 1에서 이미 `my-vpc`가 있는 경우, 다른 이름(예: `lab`)을 입력하면 충돌을 피할 수 있습니다.

> [!TIP]
> **SSHAccessCidr에 본인 IP를 입력하는 방법:**
>
> 1. 브라우저에서 [ifconfig.me](https://ifconfig.me)에 접속하여 현재 공인 IP를 확인합니다.
> 2. 확인된 IP 뒤에 `/32`를 붙여 입력합니다. (예: `203.0.113.50/32`)
> 3. `/32`는 "이 IP 하나만 허용"이라는 의미입니다.
>
> 기본값 `0.0.0.0/0`을 그대로 사용해도 실습은 가능하지만, 보안상 본인 IP로 제한하는 것을 권장합니다.

12. [[Next]] 버튼을 클릭합니다.
13. **Configure stack options** 페이지에서 추가 설정 없이 아래로 스크롤합니다.
14. [[Next]] 버튼을 클릭합니다.
15. **Review and create** 페이지에서 설정을 확인합니다.
16. [[Submit]] 버튼을 클릭합니다.

> [!NOTE]
> 스택 생성이 시작되면 **Status** 열에 상태가 표시됩니다:
>
> - **CREATE_IN_PROGRESS** (파란색): 리소스를 생성하고 있습니다.
> - **CREATE_COMPLETE** (초록색): 모든 리소스가 성공적으로 생성되었습니다.
> - **CREATE_FAILED** (빨간색): 생성 중 오류가 발생했습니다. **Events** 탭에서 원인을 확인하세요.
>
> 스택 생성에 약 1~2분이 소요됩니다. **Events** 탭에서 생성 과정을 실시간으로 확인할 수 있습니다.  
> 대기하는 동안 다음 태스크를 미리 읽어봅니다.

17. 스택 상태가 `CREATE_COMPLETE`가 되면 **Outputs** 탭을 선택합니다.

> [!OUTPUT]
> 스택의 **Outputs** 탭에서 생성된 리소스의 ID를 확인할 수 있습니다:
>
> | Output Key         | 설명                  |
> | ------------------ | --------------------- |
> | VPCId              | VPC ID                |
> | PublicSubnetAId    | Public Subnet A ID    |
> | PublicSubnetCId    | Public Subnet C ID    |
> | PrivateSubnetAId   | Private Subnet A ID   |
> | PrivateSubnetCId   | Private Subnet C ID   |
> | EC2SecurityGroupId | EC2 Security Group ID |
> | RDSSecurityGroupId | RDS Security Group ID |

> [!TIP]
> `SSHAccessCidr`를 기본값(`0.0.0.0/0`)으로 생성한 경우, 스택 생성 후 SSH 규칙을 `My IP`로 변경하세요:  
> VPC 콘솔 → Security Groups → `my-ec2-sg` → Inbound rules → Edit → SSH 규칙의 Source를 `My IP`로 변경 → Save rules

> [!NOTE]
> **생성된 리소스 확인 방법:**
>
> VPC 콘솔에서 실제로 리소스가 생성되었는지 확인해 보세요:
>
> 1. VPC 콘솔 → **Your VPCs** → `my-vpc`가 있는지 확인
> 2. **Subnets** → `my-public-subnet-a`, `my-public-subnet-c`, `my-private-subnet-a`, `my-private-subnet-c` 4개 확인
> 3. **Internet gateways** → `my-igw`가 `my-vpc`에 Attached 상태인지 확인
> 4. **Security groups** → `my-ec2-sg`, `my-rds-sg` 2개 확인
>
> Step 1에서 수동으로 만든 것과 동일한 구성이 CloudFormation으로 자동 생성된 것을 확인할 수 있습니다.

✅ **태스크 완료**: 선행 리소스가 CloudFormation으로 생성되었습니다.

## 태스크 1: EC2 인스턴스 생성

11. 상단 검색창에 `EC2`를 입력하고 EC2 서비스를 선택합니다.
12. 왼쪽 메뉴에서 **Instances**를 선택합니다.
13. [[Launch instances]] 버튼을 클릭합니다.
14. 다음과 같이 설정합니다:

**Name and tags:**

- **Name**: `my-ec2-mysql`

> [!TIP]
> Name 태그는 콘솔에서 인스턴스를 식별하는 데 사용됩니다. 용도를 알 수 있는 이름을 붙이면 나중에 관리가 편합니다.

**Application and OS Images (Amazon Machine Image):**

- **AMI**: `Amazon Linux 2023 AMI` (Free tier eligible 표시 확인)
- **Architecture**: `64-bit (x86)`

> [!NOTE]
> AWS 콘솔에서 "Free tier eligible" 표시가 여전히 나타납니다. 새 체계(2025.07.15 이후 가입)에서는 크레딧에서 차감됩니다.

> [!WARNING]
> AMI 선택 시 **Amazon Linux 2023**과 **Amazon Linux 2**를 혼동하지 마세요. Amazon Linux 2는 2025년 6월 EOL(End of Life)입니다. 반드시 "2023"이 포함된 AMI를 선택하세요.

15. **Instance type**에서 `t2.micro`를 선택합니다 (Free tier eligible).

> [!WARNING]
> 반드시 `t2.micro`를 선택하세요. 다른 인스턴스 타입은 비용이 높아 크레딧이 빠르게 소진됩니다.
>
> | 인스턴스 타입 | 시간당 비용 (서울) | 월 비용 (24/7) |
> | ------------- | ------------------ | -------------- |
> | t2.micro      | ~$0.0144           | ~$10.37        |
> | t3.small      | ~$0.026            | ~$18.72        |
> | t3.medium     | ~$0.052            | ~$37.44        |

16. **Key pair (login)** 섹션에서:
    - 기존 키 페어가 있으면 선택합니다.
    - 없으면 [[Create new key pair]] 클릭:
      - **Key pair name**: `my-keypair`
      - **Key pair type**: `RSA`
      - **Private key file format**: `.pem` (Mac/Linux) 또는 `.ppk` (Windows PuTTY)
      - [[Create key pair]] 클릭 → 파일이 자동 다운로드됩니다.

> [!WARNING]
> 키 페어 파일(.pem)은 **한 번만 다운로드** 가능합니다. 분실하면 인스턴스에 SSH 접속할 수 없습니다. 안전한 곳에 보관하세요.

> [!TIP]
> 키 페어 파일을 다운로드한 후 바로 안전한 위치로 이동하세요:
>
> ```bash
> # Mac/Linux
> mkdir -p ~/.ssh
> mv ~/Downloads/my-keypair.pem ~/.ssh/
> chmod 400 ~/.ssh/my-keypair.pem
> ```
>
> `~/.ssh/` 디렉토리에 보관하면 SSH 접속 시 경로를 기억하기 쉽습니다.

17. **Network settings** 섹션에서 [[Edit]] 버튼을 클릭합니다:
    - **VPC**: `my-vpc` 선택
    - **Subnet**: `my-public-subnet-a` 선택
    - **Auto-assign public IP**: `Enable`
    - **Firewall (security groups)**: `Select existing security group` 선택
    - **Common security groups**: `my-ec2-sg` 선택

> [!WARNING]
> **Auto-assign public IP**가 `Enable`인지 반드시 확인하세요. `Disable`이면 Public IP가 할당되지 않아 SSH 접속이 불가능합니다. 서브넷의 기본 설정이 Disable일 수 있으므로 수동으로 Enable로 변경해야 합니다.

> [!NOTE]
> **"Create new security group"이 아닌 "Select existing security group"을 선택해야 합니다.**  
> 기본값은 새 Security Group을 생성하는 것이므로, 반드시 라디오 버튼을 변경하고 `my-ec2-sg`를 선택하세요.

18. **Configure storage**는 기본값(8 GiB gp3)을 유지합니다.

> [!NOTE]
> 8 GiB는 MySQL 설치와 기본 운영에 충분합니다. 프로덕션 환경에서는 데이터 크기에 맞게 조정하지만, 실습에서는 기본값으로 충분합니다.

19. [[Launch instance]] 버튼을 클릭합니다.
20. 인스턴스 상태가 `Running`이 될 때까지 기다립니다 (약 1-2분).

> [!OUTPUT]
> 인스턴스가 생성되면 Instance ID, Public IPv4 address가 할당됩니다. Public IP를 메모해 두세요.
>
> 인스턴스 목록에서 확인할 수 있는 정보:
>
> | 항목                | 예시               |
> | ------------------- | ------------------ |
> | Instance ID         | i-0abc123def456789 |
> | Public IPv4 address | 3.35.xxx.xxx       |
> | Private IPv4        | 10.0.1.xxx         |
> | Instance state      | Running            |
> | Status check        | 2/2 checks passed  |

> [!TIP]
> **Status check**가 "2/2 checks passed"가 될 때까지 기다린 후 SSH 접속을 시도하세요. "Initializing"인 상태에서는 접속이 실패할 수 있습니다.

> [!TROUBLESHOOTING]
> **인스턴스가 `Running`이 되지 않는 경우:**
>
> - **`Pending` 상태가 오래 지속**: 정상입니다. 최대 2-3분 기다려 보세요.
> - **`Terminated` 상태로 바로 전환**: Instance를 선택 → **Description** 탭 → **State transition message**에서 원인을 확인합니다. 주로 AMI 문제이거나 인스턴스 타입이 해당 AZ에서 지원되지 않는 경우입니다.
> - **Public IP가 할당되지 않음**: Auto-assign public IP를 Enable로 설정했는지 확인합니다. 이미 생성된 인스턴스는 Elastic IP를 연결하거나, 인스턴스를 삭제 후 재생성해야 합니다.

✅ **태스크 완료**: EC2 인스턴스가 생성되었습니다.

## 태스크 2: SSH 접속

21. 인스턴스 목록에서 `my-ec2-mysql`을 선택합니다.
22. **Public IPv4 address**를 복사합니다.

> [!TIP]
> IP 주소 옆의 복사 아이콘(📋)을 클릭하면 클립보드에 복사됩니다. 수동으로 타이핑하면 오타가 발생하기 쉽습니다.

23. 터미널(Mac/Linux) 또는 PowerShell(Windows)에서 SSH 접속합니다:

```bash
# 키 파일 권한 설정 (Mac/Linux) — 최초 1회만 실행
chmod 400 ~/Downloads/my-keypair.pem

# SSH 접속
ssh -i ~/Downloads/my-keypair.pem ec2-user@<Public-IP>
```

> [!NOTE]
> `chmod 400`은 키 파일의 권한을 "소유자만 읽기"로 설정합니다. SSH는 보안상 키 파일의 권한이 너무 열려 있으면 접속을 거부합니다. 이 명령은 키 파일당 최초 1회만 실행하면 됩니다.

> [!TIP]
> **Windows 사용자:**
>
> **방법 1: Windows Terminal / PowerShell (Windows 10 이상 권장)**
>
> ```powershell
> ssh -i C:\Users\<사용자명>\Downloads\my-keypair.pem ec2-user@<Public-IP>
> ```
>
> Windows 10 이상에서는 OpenSSH가 기본 설치되어 있어 별도 프로그램 없이 SSH 접속이 가능합니다.
>
> **방법 2: PuTTY 사용**
>
> 1. PuTTYgen 실행 → **Load** → .pem 파일 선택 → **Save private key** (.ppk로 저장)
> 2. PuTTY 실행 → Host Name에 `ec2-user@<Public-IP>` 입력
> 3. 왼쪽 메뉴 Connection → SSH → Auth → Credentials → Private key file에 .ppk 파일 지정
> 4. **Open** 클릭

24. `Are you sure you want to continue connecting?` 메시지가 나오면 `yes`를 입력합니다.

> [!NOTE]
> 이 메시지는 최초 접속 시에만 나타납니다. 서버의 호스트 키를 로컬 `~/.ssh/known_hosts`에 저장하겠냐는 확인입니다. `yes`를 입력하면 이후 같은 서버에 접속할 때는 이 메시지가 나타나지 않습니다.

> [!OUTPUT]
> 접속 성공 시 다음과 같은 프롬프트가 표시됩니다:
>
> ```
>    ,     #_
>    ~\_  ####_        Amazon Linux 2023
>   ~~  \_#####\
>   ~~     \###|
>   ~~       \#/ ___   https://aws.amazon.com/linux/amazon-linux-2023
>    ~~       V~' '->
>     ~~~         /
>       ~~._.   _/
>          _/ _/
>        _/m/'
> [ec2-user@ip-10-0-1-xxx ~]$
> ```

> [!TROUBLESHOOTING]
> **SSH 접속이 실패하는 경우:**
>
> | 증상                                     | 원인                                                 | 해결 방법                                                                               |
> | ---------------------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------- |
> | `Connection timed out`                   | Security Group에 SSH(22) 미허용, 또는 Public IP 없음 | EC2 콘솔 → Security Group → Inbound rules에 SSH(22) 규칙 확인. Public IP 할당 여부 확인 |
> | `Permission denied (publickey)`          | 키 파일이 잘못되었거나, 사용자명 오류                | 올바른 .pem 파일인지 확인. 사용자명은 `ec2-user` (Amazon Linux)                         |
> | `WARNING: UNPROTECTED PRIVATE KEY FILE!` | 키 파일 권한이 너무 열려 있음                        | `chmod 400 my-keypair.pem` 실행                                                         |
> | `Connection refused`                     | SSH 서비스 미실행 또는 인스턴스 미준비               | Status check가 "2/2 checks passed"인지 확인. 1-2분 대기 후 재시도                       |
> | `Host key verification failed`           | 이전에 같은 IP로 다른 서버에 접속한 기록             | `ssh-keygen -R <Public-IP>` 실행 후 재시도                                              |
>
> **그래도 안 되면 EC2 Instance Connect 사용:**
>
> 1. EC2 콘솔에서 인스턴스 선택
> 2. [[Connect]] 버튼 클릭
> 3. **EC2 Instance Connect** 탭 선택
> 4. [[Connect]] 클릭 → 브라우저에서 바로 접속

✅ **태스크 완료**: EC2 인스턴스에 SSH 접속했습니다.

## 태스크 3: MySQL 8.0 설치

25. 시스템 패키지를 업데이트합니다:

```bash
sudo dnf update -y
```

> [!NOTE]
> `sudo dnf update -y`는 시스템의 모든 패키지를 최신 버전으로 업데이트합니다. 보안 패치와 버그 수정이 포함되므로 소프트웨어 설치 전에 항상 실행하는 것이 좋습니다. 1-2분 소요될 수 있습니다.

26. MySQL 8.0 Community Server를 설치합니다:

```bash
sudo dnf install mysql80-community-server -y
```

> [!NOTE]
> Amazon Linux 2023은 `dnf` 패키지 매니저를 사용합니다 (Amazon Linux 2의 `yum`과 호환).  
> MySQL 8.0은 기본 리포지토리에 포함되어 있어 별도의 리포지토리 추가가 필요 없습니다.

> [!TIP]
> 설치 가능한 MySQL 패키지를 확인하려면:
>
> ```bash
> sudo dnf list available | grep mysql
> ```

27. MySQL 서비스를 시작합니다:

```bash
sudo systemctl start mysqld
```

28. MySQL 서비스를 부팅 시 자동 시작하도록 설정합니다:

```bash
sudo systemctl enable mysqld
```

> [!NOTE]
> `enable`은 서버가 재부팅될 때 MySQL이 자동으로 시작되도록 설정합니다. `start`는 지금 당장 시작하는 것이고, `enable`은 다음 부팅부터 자동 시작하는 것입니다. 둘 다 실행해야 합니다.

29. MySQL 서비스 상태를 확인합니다:

```bash
sudo systemctl status mysqld
```

> [!OUTPUT]
>
> ```
> ● mysqld.service - MySQL Community Server
>      Loaded: loaded (/usr/lib/systemd/system/mysqld.service; enabled)
>      Active: active (running)
>      ...
>    Main PID: xxxx (mysqld)
> ```
>
> `Active: active (running)`과 `enabled`가 표시되면 정상입니다.

> [!TROUBLESHOOTING]
> **MySQL 설치 또는 시작 실패 시:**
>
> | 증상                                              | 원인                                 | 해결 방법                                                      |
> | ------------------------------------------------- | ------------------------------------ | -------------------------------------------------------------- |
> | `No match for argument: mysql80-community-server` | 패키지명 오류 또는 리포지토리 미등록 | `sudo dnf list available \| grep mysql`로 정확한 패키지명 확인 |
> | `Job for mysqld.service failed`                   | 포트 충돌 또는 디스크 공간 부족      | `sudo journalctl -u mysqld -n 30`으로 상세 로그 확인           |
> | `Active: failed`                                  | 설정 파일 오류                       | `sudo cat /var/log/mysqld.log`로 에러 메시지 확인              |
>
> **디스크 공간 확인:**
>
> ```bash
> df -h
> ```
>
> 루트 파티션(`/`)의 사용률이 90% 이상이면 MySQL이 시작되지 않을 수 있습니다.

✅ **태스크 완료**: MySQL 8.0이 설치되고 실행 중입니다.

## 태스크 4: MySQL 보안 초기화

30. MySQL 임시 비밀번호를 확인합니다:

```bash
sudo grep 'temporary password' /var/log/mysqld.log
```

> [!OUTPUT]
>
> ```
> A temporary password is generated for root@localhost: AbCd1234!xyz
> ```
>
> 콜론(`:`) 뒤의 문자열이 임시 비밀번호입니다. 정확히 복사하세요 (앞뒤 공백 주의).

> [!WARNING]
> 임시 비밀번호는 MySQL 최초 설치 시 한 번만 생성됩니다. 이 비밀번호를 분실하면 MySQL을 재설치해야 할 수 있습니다. 다음 단계에서 바로 변경하므로 메모장에 임시로 복사해 두세요.

31. MySQL 보안 초기화 스크립트를 실행합니다:

```bash
sudo mysql_secure_installation
```

32. 프롬프트에 따라 설정합니다:

```
Enter password for user root: (임시 비밀번호 입력 — 화면에 표시되지 않음)

New password: (새 비밀번호 입력, 예: MyPass123!)
Re-enter new password: (새 비밀번호 재입력)

Change the password for root? : y
Remove anonymous users? : y
Disallow root login remotely? : y
Remove test database and access to it? : y
Reload privilege tables now? : y
```

> [!WARNING]
> MySQL 8.0의 비밀번호 정책은 기본적으로 `MEDIUM`입니다:
>
> - 최소 **8자** 이상
> - **대문자** 1개 이상
> - **소문자** 1개 이상
> - **숫자** 1개 이상
> - **특수문자** 1개 이상 (`!@#$%^&*` 등)
>
> 예시: `MyPass123!`, `LabTest99#`, `Aws2024!db`
>
> 정책을 만족하지 않으면 `ERROR 1819 (HY000): Your password does not satisfy the current policy requirements` 에러가 발생합니다.

> [!NOTE]
> **각 질문의 의미:**
>
> | 질문                          | 권장 답변 | 설명                                        |
> | ----------------------------- | --------- | ------------------------------------------- |
> | Remove anonymous users?       | `y`       | 인증 없이 접속 가능한 익명 사용자 제거      |
> | Disallow root login remotely? | `y`       | root는 localhost에서만 접속 가능하도록 제한 |
> | Remove test database?         | `y`       | 누구나 접근 가능한 test DB 제거             |
> | Reload privilege tables?      | `y`       | 변경사항 즉시 적용                          |

> [!TROUBLESHOOTING]
> **`mysql_secure_installation` 실행 중 문제:**
>
> - **"Access denied for user 'root'@'localhost'"**: 임시 비밀번호를 정확히 입력했는지 확인합니다. 비밀번호 입력 시 화면에 아무것도 표시되지 않는 것이 정상입니다.
> - **비밀번호 정책 에러 반복**: `MyPass123!`처럼 확실히 정책을 만족하는 비밀번호를 사용하세요.
> - **"The 'validate_password' component is installed" 메시지 후 MEDIUM/STRONG 선택**: `0` (LOW) 또는 `1` (MEDIUM)을 입력합니다. 실습에서는 `1`(MEDIUM)을 권장합니다.

33. 새 비밀번호로 MySQL에 접속합니다:

```bash
mysql -u root -p
```

> [!NOTE]
> `-p` 옵션 뒤에 비밀번호를 직접 입력하지 마세요 (`mysql -u root -pMyPass123!`). 명령어 히스토리에 비밀번호가 남습니다. `-p`만 입력하면 비밀번호를 안전하게 프롬프트로 입력할 수 있습니다.

> [!OUTPUT]
>
> ```
> Welcome to the MySQL monitor.  Commands end with ; or \g.
> Your MySQL connection id is x
> Server version: 8.0.xx MySQL Community Server - GPL
>
> mysql>
> ```

✅ **태스크 완료**: MySQL 보안 초기화가 완료되었습니다.

## 태스크 5: 데이터베이스 및 사용자 생성

> [!NOTE]
> 이 태스크의 모든 명령은 MySQL 프롬프트(`mysql>`)에서 실행합니다. 태스크 4에서 `mysql -u root -p`로 접속한 상태여야 합니다.

34. 애플리케이션용 데이터베이스를 생성합니다:

```sql
CREATE DATABASE appdb DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

> [!NOTE]
> **`utf8mb4`를 사용하는 이유:**  
> MySQL의 `utf8`은 3바이트까지만 지원하여 이모지(😀)를 저장할 수 없습니다. `utf8mb4`는 4바이트 유니코드를 완전히 지원하므로 한글, 이모지, 특수문자 모두 정상 저장됩니다. 새 프로젝트에서는 항상 `utf8mb4`를 사용하세요.

35. 애플리케이션용 사용자를 생성합니다:

```sql
CREATE USER 'appuser'@'%' IDENTIFIED BY 'AppUser123!';
```

> [!NOTE]
> `'appuser'@'%'`에서 `%`는 모든 호스트에서의 접속을 허용합니다.
>
> | 호스트 지정             | 의미                  | 사용 사례             |
> | ----------------------- | --------------------- | --------------------- |
> | `'appuser'@'%'`         | 모든 IP에서 접속 허용 | 개발/테스트 환경      |
> | `'appuser'@'10.0.%'`    | 10.0.x.x 대역만 허용  | VPC 내부 접속만 허용  |
> | `'appuser'@'localhost'` | 로컬에서만 접속 허용  | 같은 서버의 앱만 사용 |
>
> 보안을 강화하려면 `'appuser'@'10.0.%'`처럼 VPC CIDR 범위로 제한할 수 있습니다.

36. 사용자에게 데이터베이스 권한을 부여합니다:

```sql
GRANT ALL PRIVILEGES ON appdb.* TO 'appuser'@'%';
FLUSH PRIVILEGES;
```

> [!NOTE]
> `GRANT ALL PRIVILEGES ON appdb.*`는 `appdb` 데이터베이스의 모든 테이블에 대해 모든 권한(SELECT, INSERT, UPDATE, DELETE, CREATE, DROP 등)을 부여합니다. `FLUSH PRIVILEGES`는 권한 변경을 즉시 적용합니다.

> [!TIP]
> 프로덕션 환경에서는 `ALL PRIVILEGES` 대신 필요한 권한만 부여하는 것이 보안상 좋습니다:
>
> ```sql
> GRANT SELECT, INSERT, UPDATE, DELETE ON appdb.* TO 'appuser'@'%';
> ```

37. 생성된 데이터베이스와 사용자를 확인합니다:

```sql
SHOW DATABASES;
SELECT user, host FROM mysql.user WHERE user = 'appuser';
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
>
> +---------+------+
> | user    | host |
> +---------+------+
> | appuser | %    |
> +---------+------+
> ```

38. MySQL을 종료합니다:

```sql
EXIT;
```

> [!TIP]
> `EXIT;`, `QUIT;`, 또는 `\q` 모두 MySQL 프롬프트를 종료하는 명령입니다.

✅ **태스크 완료**: 데이터베이스와 사용자가 생성되었습니다.

## 태스크 6: 외부 접속 설정

EC2 외부(로컬 PC 또는 다른 EC2)에서 MySQL에 접속할 수 있도록 설정합니다.

> [!NOTE]
> 이 태스크는 두 가지를 설정합니다:
>
> 1. **MySQL bind-address 변경**: MySQL이 외부 네트워크 요청을 수신하도록 설정
> 2. **Security Group 확인**: AWS 네트워크 레벨에서 3306 포트가 열려 있는지 확인
>
> 둘 다 설정되어야 외부 접속이 가능합니다.

39. MySQL 설정 파일을 편집합니다:

```bash
sudo vi /etc/my.cnf
```

40. `[mysqld]` 섹션에 다음을 추가합니다:

```ini
[mysqld]
bind-address = 0.0.0.0
```

> [!TIP]
> **vi 에디터 사용법 (최소한):**
>
> 1. `i` 키를 눌러 입력 모드 진입
> 2. 내용 입력/수정
> 3. `Esc` 키를 눌러 명령 모드로 복귀
> 4. `:wq` 입력 후 Enter로 저장 및 종료
>
> vi가 익숙하지 않다면 다음 명령으로 대체할 수 있습니다:
>
> ```bash
> echo -e "[mysqld]\nbind-address = 0.0.0.0" | sudo tee -a /etc/my.cnf
> ```

> [!NOTE]
> `bind-address = 0.0.0.0`은 모든 네트워크 인터페이스에서 접속을 허용합니다.
>
> | 설정값               | 의미                      |
> | -------------------- | ------------------------- |
> | `127.0.0.1` (기본값) | localhost에서만 접속 가능 |
> | `0.0.0.0`            | 모든 IP에서 접속 가능     |
> | `10.0.1.50`          | 특정 IP에서만 접속 가능   |

> [!WARNING]
> `bind-address = 0.0.0.0`은 네트워크 레벨에서 모든 접속을 허용합니다. 실제 접근 제어는 **Security Group**(AWS 방화벽)과 **MySQL 사용자 호스트 설정**(`'appuser'@'%'`)으로 이중 보호됩니다. 프로덕션 환경에서는 Security Group에서 특정 IP만 3306 포트에 접근하도록 제한하세요.

41. MySQL을 재시작합니다:

```bash
sudo systemctl restart mysqld
```

42. MySQL이 모든 인터페이스에서 리스닝하는지 확인합니다:

```bash
sudo ss -tlnp | grep 3306
```

> [!OUTPUT]
>
> ```
> LISTEN  0  151  0.0.0.0:3306  0.0.0.0:*  users:(("mysqld",pid=xxxx,fd=xx))
> ```
>
> `0.0.0.0:3306`이 표시되면 모든 인터페이스에서 수신 대기 중입니다.  
> `127.0.0.1:3306`이 표시되면 bind-address 설정이 적용되지 않은 것입니다.

43. **Security Group에서 3306 포트 확인:**

> [!NOTE]
> CloudFormation 템플릿(`step2-1-ec2-prereq.yaml`)으로 생성한 경우, `my-ec2-sg`에 MySQL(3306) 포트가 이미 열려 있습니다. 수동으로 Security Group을 만든 경우 다음을 확인하세요:
>
> 1. EC2 콘솔 → 인스턴스 선택 → **Security** 탭 → Security Group 링크 클릭
> 2. **Inbound rules** 탭에서 3306 포트 규칙이 있는지 확인
> 3. 없으면 [[Edit inbound rules]] → [[Add rule]]:
>    - **Type**: `MySQL/Aurora`
>    - **Port**: `3306`
>    - **Source**: `My IP` (또는 테스트용 `0.0.0.0/0`)
> 4. [[Save rules]] 클릭

44. 로컬 PC에서 MySQL 접속을 테스트합니다 (MySQL Client 설치 필요):

```bash
mysql -h <EC2-Public-IP> -u appuser -p appdb
```

> [!TIP]
> **로컬 PC에 MySQL Client가 없는 경우:**
>
> ```bash
> # Mac (Homebrew)
> brew install mysql-client
>
> # Ubuntu/Debian
> sudo apt install mysql-client
>
> # Windows
> # MySQL Installer에서 MySQL Shell 또는 MySQL Workbench 설치
> ```
>
> 또는 MySQL Workbench(GUI 도구)를 사용하면 시각적으로 접속할 수 있습니다.

> [!OUTPUT]
>
> ```
> Welcome to the MySQL monitor.  Commands end with ; or \g.
> Your MySQL connection id is x
> Server version: 8.0.xx MySQL Community Server - GPL
>
> mysql> SELECT DATABASE();
> +------------+
> | DATABASE() |
> +------------+
> | appdb      |
> +------------+
> ```

> [!TROUBLESHOOTING]
> **외부 접속이 안 되는 경우:**
>
> | 증상                     | 확인 사항                      | 해결 방법                                                             |
> | ------------------------ | ------------------------------ | --------------------------------------------------------------------- |
> | `Connection timed out`   | Security Group                 | EC2 콘솔에서 3306 포트 Inbound rule 확인/추가                         |
> | `Connection refused`     | bind-address 또는 MySQL 미실행 | `sudo ss -tlnp \| grep 3306`으로 리스닝 확인. `0.0.0.0:3306`이어야 함 |
> | `Access denied for user` | MySQL 사용자 설정              | `'appuser'@'%'`로 생성했는지 확인. 비밀번호 정확히 입력               |
> | `Host is not allowed`    | MySQL 사용자 호스트 제한       | `SELECT user, host FROM mysql.user;`로 호스트 설정 확인               |
>
> **단계별 디버깅:**
>
> ```bash
> # 1. EC2 내부에서 MySQL 접속 확인
> mysql -u appuser -p appdb
>
> # 2. EC2 내부에서 리스닝 포트 확인
> sudo ss -tlnp | grep 3306
>
> # 3. EC2 내부에서 방화벽 확인 (Amazon Linux 2023은 기본적으로 iptables 비활성)
> sudo iptables -L -n | grep 3306
> ```

✅ **태스크 완료**: 외부에서 MySQL 접속이 가능하도록 설정되었습니다.

## 마무리

다음을 성공적으로 수행했습니다:

- EC2 인스턴스(Amazon Linux 2023, t2.micro)를 생성하고 SSH로 접속했습니다.
- MySQL 8.0을 설치하고 보안 초기화를 완료했습니다.
- 애플리케이션용 데이터베이스(`appdb`)와 사용자(`appuser`)를 생성했습니다.
- 외부 접속을 위한 bind-address 설정을 완료했습니다.

---

## 📚 옵션 태스크: NACL 동작 테스트 (Step 1-3 복습)

> [!NOTE]
> 이 태스크는 **선택 사항**입니다. Step 1-3에서 학습한 NACL의 실제 동작을 EC2로 확인하고 싶은 경우에만 진행합니다.  
> 테스트 후 반드시 기본 NACL로 복원하여 이후 실습에 영향이 없도록 합니다.

### 사전 조건

- 위 실습에서 생성한 EC2 인스턴스가 `running` 상태이고, 브라우저에서 Public IP로 접속 가능한 상태.

### 경로 A: Step 1-3에서 커스텀 NACL을 이미 만든 경우

Step 1-3을 완료하여 `my-public-nacl`이 이미 존재하는 경우입니다.

1. VPC 콘솔 → **Network ACLs**에서 `my-public-nacl`을 선택합니다.
2. **Inbound rules** 탭에서 [[Edit inbound rules]]를 클릭합니다.
3. [[Add new rule]]을 클릭하고 다음 규칙을 추가합니다:
   - **Rule number**: `50`
   - **Type**: `HTTP (80)`
   - **Source**: `0.0.0.0/0`
   - **Allow/Deny**: `Deny`
4. [[Save changes]]를 클릭합니다.
5. 브라우저에서 EC2 Public IP로 접속을 시도합니다.

> [!OUTPUT]
> 접속이 **차단**됩니다. Rule 50(DENY)이 Rule 100(ALLOW)보다 번호가 낮으므로 먼저 평가되어 HTTP 트래픽이 거부됩니다.

6. 다시 **Inbound rules** → [[Edit inbound rules]]에서 Rule 50을 삭제합니다.
7. [[Save changes]]를 클릭합니다.
8. 브라우저에서 다시 접속을 시도합니다.

> [!OUTPUT]
> 접속이 **복구**됩니다. DENY 규칙이 제거되어 Rule 100(ALLOW)이 적용됩니다.

### 경로 B: CloudFormation으로 환경을 구성한 경우 (커스텀 NACL 없음)

2-1을 CloudFormation으로 시작하여 커스텀 NACL이 없는 경우, 직접 생성하여 테스트합니다.

1. VPC 콘솔 → **Network ACLs** → [[Create network ACL]]을 클릭합니다.
2. 다음과 같이 설정합니다:
   - **Name**: `test-nacl`
   - **VPC**: EC2가 있는 VPC 선택
3. [[Create network ACL]]을 클릭합니다.

> [!NOTE]
> 새로 생성한 NACL은 기본적으로 모든 인바운드/아웃바운드를 **DENY**합니다. (기본 NACL과 반대)

4. 생성된 `test-nacl`을 선택하고 **Subnet associations** 탭 → [[Edit subnet associations]]를 클릭합니다.
5. EC2가 있는 Public Subnet을 체크하고 [[Save changes]]를 클릭합니다.
6. 브라우저에서 EC2 Public IP로 접속을 시도합니다.

> [!OUTPUT]
> 접속이 **차단**됩니다. 커스텀 NACL은 기본적으로 모든 트래픽을 거부하므로, 허용 규칙을 추가하지 않으면 아무것도 통과하지 못합니다.

7. **Inbound rules** → [[Edit inbound rules]]에서 다음 규칙을 추가합니다:
   - Rule 100: HTTP (80), 0.0.0.0/0, ALLOW
8. **Outbound rules** → [[Edit outbound rules]]에서 다음 규칙을 추가합니다:
   - Rule 100: Custom TCP (1024-65535), 0.0.0.0/0, ALLOW

> [!NOTE]
> NACL은 **Stateless**이므로 아웃바운드에 Ephemeral Port(1024-65535)를 허용해야 응답이 돌아갑니다. Security Group(Stateful)과의 핵심 차이입니다.

9. 브라우저에서 다시 접속을 시도합니다.

> [!OUTPUT]
> 접속이 **복구**됩니다. 인바운드 HTTP 허용 + 아웃바운드 Ephemeral Port 허용으로 정상 통신됩니다.

### 테스트 후 정리 (필수)

> [!WARNING]
> 테스트가 끝나면 반드시 기본 NACL로 복원하세요. 커스텀 NACL이 연결된 상태로 방치하면 이후 실습에서 통신 문제가 발생할 수 있습니다.

**경로 A (기존 커스텀 NACL 사용):**

1. `my-public-nacl` → **Subnet associations** → [[Edit subnet associations]] → 모든 서브넷 체크 해제 → [[Save changes]]
2. 서브넷이 자동으로 기본 NACL에 연결됩니다.

**경로 B (test-nacl 생성):**

1. `test-nacl` → **Subnet associations** → [[Edit subnet associations]] → 모든 서브넷 체크 해제 → [[Save changes]]
2. 서브넷이 자동으로 기본 NACL에 연결됩니다.
3. `test-nacl` 선택 → **Actions** → [[Delete network ACL]] → 확인

> [!NOTE]
> 서브넷은 항상 하나의 NACL에 연결되어 있어야 합니다. 커스텀 NACL에서 서브넷 연결을 해제하면 자동으로 VPC의 기본 NACL(모든 트래픽 허용)에 연결됩니다.

✅ **옵션 태스크 완료**: NACL의 Stateless 동작과 규칙 번호 우선순위를 실제 트래픽으로 확인했습니다.

# 🗑️ 리소스 정리

> [!WARNING]
> 실습이 끝나면 **반드시** 리소스를 정리하여 불필요한 비용을 방지합니다.  
> EC2 인스턴스는 실행 중일 때 시간당 과금되며, 중지(Stop) 상태에서도 EBS 볼륨 비용이 발생합니다.

---

### 옵션 선택: 유지 vs 삭제

> [!NOTE]
> 다음 실습(Step 2-2, 2-3)에서 같은 EC2 인스턴스를 재사용할 수 있습니다. 상황에 맞게 선택하세요.
>
> | 옵션                    | 설명                                           | 비용 영향                             |
> | ----------------------- | ---------------------------------------------- | ------------------------------------- |
> | **옵션 A: 유지 (Stop)** | 인스턴스를 중지만 합니다. 다음 실습에서 재사용 | EBS 비용만 발생 (~$0.80/월, 8GiB gp3) |
> | **옵션 B: 완전 삭제**   | 인스턴스 + VPC 리소스 모두 삭제                | 비용 $0                               |
>
> Step 2-2(Vue.js), 2-3(Spring Boot)을 이어서 진행할 예정이라면 **옵션 A**를 권장합니다.

---

### 옵션 A: EC2 인스턴스 중지 (다음 실습에서 재사용)

1. AWS Management Console에서 상단 검색창에 `EC2`를 입력하고 선택합니다.
2. 왼쪽 메뉴에서 **Instances**를 클릭합니다.
3. `my-ec2-mysql` 인스턴스를 체크합니다.
4. 상단 **Instance state** → **Stop instance**를 클릭합니다.
5. 확인 팝업에서 [[Stop]]을 클릭합니다.
6. Instance state가 `Stopped`으로 변경되는 것을 확인합니다.

> [!NOTE]
> **Stop vs Terminate 차이:**
>
> | 항목        | Stop (중지)                 | Terminate (종료) |
> | ----------- | --------------------------- | ---------------- |
> | EC2 과금    | ❌ 중지                     | ❌ 중지          |
> | EBS 과금    | ✅ 계속 발생                | ❌ 중지 (삭제됨) |
> | 데이터 보존 | ✅ 유지                     | ❌ 삭제          |
> | Public IP   | ⚠️ 해제됨 (재시작 시 새 IP) | ❌ 해제          |
> | 재시작 가능 | ✅ 가능                     | ❌ 불가          |

> [!WARNING]
> Stop하면 **Public IP가 변경**됩니다. 다음에 Start할 때 새로운 IP가 할당되므로, SSH 접속 시 새 IP를 확인해야 합니다.

> [!TIP]
> **다음 실습에서 재시작하는 방법:**
>
> 1. EC2 콘솔 → Instances → `my-ec2-mysql` 선택
> 2. **Instance state** → **Start instance** 클릭
> 3. 1-2분 후 `Running` 상태 확인
> 4. 새로 할당된 **Public IPv4 address** 확인
> 5. 새 IP로 SSH 접속

✅ **옵션 A 완료**: 인스턴스가 중지되었습니다. 다음 실습에서 Start하여 재사용합니다.

---

### 옵션 B: 완전 삭제 (모든 리소스 제거)

Step 2를 더 이상 진행하지 않거나, 처음부터 다시 구성하려는 경우 모든 리소스를 삭제합니다.

#### 단계 1: Tag Editor로 생성된 리소스 확인

삭제 전에 이 실습에서 생성한 리소스를 확인합니다.

1. AWS Management Console 상단 검색창에 `Resource Groups & Tag Editor`를 입력하고 선택합니다.
2. 왼쪽 메뉴에서 **Tag Editor**를 선택합니다.
3. 다음과 같이 설정합니다:
   - **Regions**: `ap-northeast-2`
   - **Resource types**: `All supported resource types`
4. [[Search resources]] 버튼을 클릭합니다.
5. `my-ec2-mysql`, `my-vpc`, `my-ec2-sg` 등 이 실습에서 생성한 리소스가 표시되는지 확인합니다.

> [!TIP]
> Tag Editor는 리소스를 찾는 용도로만 사용합니다. 실제 삭제는 다음 단계에서 수행합니다.

#### 단계 2: EC2 인스턴스 종료 (Terminate)

> [!WARNING]
> Terminate하면 인스턴스와 연결된 EBS 볼륨이 함께 삭제됩니다. MySQL 데이터도 모두 삭제되므로 필요한 데이터는 미리 백업하세요. **이 작업은 되돌릴 수 없습니다.**

6. EC2 콘솔 → **Instances**에서 `my-ec2-mysql` 인스턴스를 체크합니다.
7. 상단 **Instance state** → **Terminate instance**를 클릭합니다.
8. 확인 팝업에서 [[Terminate]]를 클릭합니다.
9. Instance state가 `Shutting down` → `Terminated`로 변경되는 것을 확인합니다.

> [!NOTE]
> Terminated 상태의 인스턴스는 약 1시간 후 콘솔 목록에서 자동으로 사라집니다.

#### 단계 3: CloudFormation 스택 삭제

태스크 0에서 CloudFormation으로 선행 리소스를 생성한 경우 스택을 삭제합니다.

> [!NOTE]
> Step 1에서 수동으로 VPC를 생성한 경우(CloudFormation을 사용하지 않은 경우), 이 단계를 건너뛰고 "단계 4: 수동 생성 리소스 삭제"로 이동합니다.

10. 상단 검색창에 `CloudFormation`을 입력하고 선택합니다.
11. **Stacks** 목록에서 `ec2-lab-prereq` 스택을 선택합니다.
12. [[Delete]] 버튼을 클릭합니다.
13. 확인 팝업에서 [[Delete stack]]을 클릭합니다.
14. 스택 상태가 `DELETE_IN_PROGRESS` → `DELETE_COMPLETE`가 될 때까지 기다립니다 (약 2-3분).

> [!NOTE]
> CloudFormation 스택을 삭제하면 스택이 생성한 모든 리소스가 자동으로 삭제됩니다:
>
> - VPC (`my-vpc`)
> - Subnet 4개
> - Internet Gateway (`my-igw`)
> - Route Table 3개
> - Security Group 2개 (`my-ec2-sg`, `my-rds-sg`)

> [!TROUBLESHOOTING]
> **스택 삭제가 `DELETE_FAILED` 상태인 경우:**
>
> - **원인**: 스택이 생성한 리소스를 다른 서비스가 사용 중 (예: EC2가 아직 Terminated되지 않음)
> - **해결**: Events 탭에서 실패 원인 확인 → 해당 리소스를 먼저 삭제 → 스택 삭제 재시도
> - EC2 인스턴스가 완전히 Terminated된 후(약 1-2분) 스택 삭제를 시도하세요.

#### 단계 4: 수동 생성 리소스 삭제 (CloudFormation 미사용 시)

Step 1에서 수동으로 VPC를 생성하고 그것을 이 실습에서 사용한 경우, Step 1-1의 리소스 정리 섹션을 참고하여 VPC를 삭제합니다.

> [!NOTE]
> VPC 삭제 순서 (의존 관계 역순):
>
> ```
> EC2 Terminate → Security Group 삭제 → Route Table 삭제 → IGW Detach/삭제 → Subnet 삭제 → VPC 삭제
> ```
>
> 또는 EC2가 Terminated된 상태에서 VPC 콘솔 → Your VPCs → `my-vpc` 선택 → Actions → Delete VPC를 하면 연결된 리소스가 함께 삭제됩니다.

#### 단계 5: 삭제 확인

모든 리소스가 정상적으로 삭제되었는지 확인합니다.

15. **EC2 콘솔**: `my-ec2-mysql` 인스턴스가 `Terminated` 상태인지 확인합니다.
16. **CloudFormation 콘솔**: `ec2-lab-prereq` 스택이 목록에서 사라졌는지 확인합니다.
17. **VPC 콘솔**: `my-vpc`가 삭제되었는지 확인합니다.
18. **Tag Editor**: 다시 검색하여 관련 리소스가 남아있지 않은지 확인합니다.

> [!NOTE]
> 삭제 직후에는 일부 리소스가 잠시 남아있을 수 있으나, 시간이 지나면 자동으로 사라집니다. Terminated 인스턴스는 약 1시간 후 목록에서 제거됩니다.

> [!TIP]
> **키 페어는 삭제하지 마세요.** 키 페어 자체는 비용이 발생하지 않으며, 다음 실습에서 재사용할 수 있습니다. EC2 콘솔 → Key Pairs에서 확인할 수 있습니다.

✅ **옵션 B 완료**: 모든 리소스가 정리되었습니다.

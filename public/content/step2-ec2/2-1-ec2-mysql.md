---
title: 'Amazon EC2에 MySQL 8.4 LTS 직접 설치 및 설정'
week: 2
session: 1
awsServices:
  - Amazon EC2
  - Amazon VPC
learningObjectives:
  - Amazon EC2 인스턴스를 생성하고 SSH로 접속할 수 있습니다.
  - Amazon Linux 2023에 MySQL 8.4 LTS를 설치할 수 있습니다.
  - MySQL 보안 초기화 및 사용자/데이터베이스를 생성할 수 있습니다.
  - 외부 접속을 위한 MySQL 설정을 구성할 수 있습니다.
prerequisites:
  - AWS 계정 생성 완료
  - SSH 키 페어 보유 (또는 실습 중 생성)
  - VPC 및 Security Group 생성 완료 (또는 CloudFormation으로 생성)
estimatedCost: 크레딧 내 사용 가능 (비용 발생 가능)
---

이 실습에서는 Amazon EC2 인스턴스를 생성하고, SSH로 접속하여 MySQL 8.4 LTS를 직접 설치합니다.  
데이터베이스와 사용자를 생성하고, 외부에서 접속할 수 있도록 설정합니다.

### 실습 흐름

```
[AWS 콘솔] EC2 인스턴스 생성 → [로컬] SSH 접속 → [EC2] MySQL 설치·설정 → [로컬] 외부 접속 테스트
```

| 단계       | 실행 위치   | 내용                                    |
| ---------- | ----------- | --------------------------------------- |
| 태스크 0~1 | AWS 콘솔    | 선행 리소스(VPC) + Amazon EC2 인스턴스 생성    |
| 태스크 2~3 | 로컬 터미널 | SSH/SSM으로 EC2 접속                    |
| 태스크 4~6 | Amazon EC2 내부    | MySQL 설치, 보안 초기화, 사용자/DB 생성 |
| 태스크 7   | 로컬 PC     | MySQL Workbench 등으로 외부 접속 테스트 |

### 아키텍처 다이어그램

<img src="/images/step2/2-1-architecture.png" alt="Step 2-1 아키텍처 다이어그램" class="guide-img-lg" />

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
> | Internet Gateway | `my-igw`                                             | Amazon VPC에 자동 연결            |
> | Route Table      | `my-public-rt`, `my-private-rt-a`, `my-private-rt-c` | Public RT에 IGW 경로 포함  |
> | Security Group   | `my-ec2-sg`, `my-rds-sg`                             | EC2용, RDS용               |

1. 다운로드한 zip 파일의 압축을 해제합니다.

> [!TIP]
> zip을 해제하면 폴더 없이 바로 `step2-1-ec2-prereq.yaml`과 `README.md` 파일이 나옵니다.  
> `README.md`에 템플릿의 상세 설명(생성 리소스, 파라미터, 아키텍처 다이어그램 등)이 있으니 참고하세요.

2. AWS Management Console에 로그인합니다.
3. 리전을 **Asia Pacific (Seoul) ap-northeast-2**로 설정합니다.

    <img src="/images/common/region-check.png" alt="리전 확인" class="guide-img-sm" />

> [!TIP]
> 일부 AWS 서비스(IAM, CloudFront, Route 53 등)는 **글로벌 서비스**이므로 리전 선택 드롭다운이 비활성화되거나 "Global"로 표시됩니다.  
> 이 실습에서 사용하는 서비스는 리전 기반이므로 반드시 올바른 리전이 선택되어 있는지 확인하세요.

4. 상단 검색창에 `CloudFormation`을 입력하고 선택합니다.

    <img src="/images/step2/2-1-step4-cloudformation.png" alt="CloudFormation 검색" class="guide-img-sm" />

> [!NOTE]
> AWS CloudFormation 콘솔 UI는 주기적으로 업데이트됩니다.  
> 버튼명이나 화면 구성이 가이드와 다를 수 있으나, 전체 흐름(템플릿 업로드 → 스택 이름 입력 → 파라미터 설정 → 생성)은 동일합니다.

5. [[Create stack]] 드롭다운을 클릭한 후 **With new resources (standard)**를 선택합니다.

    <img src="/images/step2/2-1-step5-create-stack.png" alt="Create stack 선택" class="guide-img-sm" />
6. **Prerequisite - Prepare template**에서 `Choose an existing template`를 선택합니다.
7. **Specify template**에서 `Upload a template file`을 선택합니다.
8. [[Choose file]] 버튼을 클릭하고 `step2-1-ec2-prereq.yaml` 파일을 선택합니다.

    <img src="/images/step2/2-1-step8-upload-template.png" alt="템플릿 파일 업로드" class="guide-img-sm" />

> [!TIP]
> 파일 탐색기에서 YAML 파일을 **드래그 앤 드롭**으로 업로드 영역에 끌어다 놓아도 됩니다.

9. [[Next]] 버튼을 클릭합니다.
10. **Stack name**에 `ec2-lab-prereq`를 입력합니다.
11. **Parameters** 섹션에서 값을 확인합니다:
    - **ProjectName**: `my` (기본값 유지)
    - **SSHAccessCidr**: `0.0.0.0/0` (기본값) → 본인 IP로 변경 권장 (예: `203.0.113.50/32`)
    - 나머지 CIDR 파라미터: 기본값 유지

    <img src="/images/step2/2-1-step11-parameters.png" alt="Parameters 설정" class="guide-img-sm" />

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

    <img src="/images/step2/2-1-step13-review.png" alt="Configure stack options" class="guide-img-sm" />
14. [[Next]] 버튼을 클릭합니다.
15. **Review and create** 페이지에서 설정을 확인합니다.

    <img src="/images/step2/2-1-step15-review-submit.png" alt="Review and create" class="guide-img-sm" />
16. [[Submit]] 버튼을 클릭합니다.

    <img src="/images/step2/2-1-step16-submit.png" alt="Submit 클릭" class="guide-img-sm" />

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

    <img src="/images/step2/2-1-step17-create-complete.png" alt="CREATE_COMPLETE 확인" class="guide-img-sm" />

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
> **SSH 보안 강화 (권장)**
>
> `SSHAccessCidr`를 기본값(`0.0.0.0/0`)으로 생성한 경우, SSH 포트가 전 세계에 열려 있습니다.  
> 보안을 위해 스택 생성 후 SSH 규칙을 본인 IP로 변경하세요:
>
> 1. AWS 콘솔에서 **VPC** 서비스로 이동합니다.
> 2. 왼쪽 메뉴에서 **Security Groups**를 선택합니다.
> 3. `my-ec2-sg`를 선택합니다.
> 4. **Inbound rules** 탭에서 [[Edit inbound rules]] 버튼을 클릭합니다.
> 5. SSH (포트 22) 규칙의 **Source**를 `My IP`로 변경합니다.
> 6. [[Save rules]] 버튼을 클릭합니다.
>
> `My IP`를 선택하면 현재 접속 중인 IP 주소만 SSH 접근이 허용됩니다.

> [!NOTE]
> **생성된 리소스 확인 방법:**
>
> Amazon VPC 콘솔에서 실제로 리소스가 생성되었는지 확인해 보세요:
>
> 1. VPC 콘솔 → **Your VPCs** → `my-vpc`가 있는지 확인
> 2. **Subnets** → `my-public-subnet-a`, `my-public-subnet-c`, `my-private-subnet-a`, `my-private-subnet-c` 4개 확인
> 3. **Internet gateways** → `my-igw`가 `my-vpc`에 Attached 상태인지 확인
> 4. **Security groups** → `my-ec2-sg`, `my-rds-sg` 2개 확인
>
> Step 1에서 수동으로 만든 것과 동일한 구성이 CloudFormation으로 자동 생성된 것을 확인할 수 있습니다.

✅ **태스크 완료**: 선행 리소스가 CloudFormation으로 생성되었습니다.

## 태스크 1: Amazon EC2 인스턴스 생성

### 1-1. IAM Role 생성 (SSM Session Manager용)

Amazon EC2 생성 시 연결할 IAM Role을 먼저 만듭니다.  
이 Role은 태스크 3에서 SSM Session Manager로 접속할 때 사용됩니다.

> [!CONCEPT] IAM Role (인스턴스 프로필)
>
> IAM Role은 Amazon EC2 인스턴스에 AWS 서비스 사용 권한을 부여하는 방식입니다.  
> 키 페어가 "SSH 접속 열쇠"라면, IAM Role은 "AWS 서비스 이용 권한증"입니다.
>
> Amazon EC2에 Role을 연결하면 인스턴스 내부에서 별도 자격 증명(Access Key) 없이 AWS API를 호출할 수 있습니다.  
> 여기서는 Systems Manager(SSM) 접속 권한을 부여합니다.

18. 상단 검색창에 `IAM`을 입력하고 **IAM** 서비스를 선택합니다.
19. 왼쪽 메뉴에서 **Roles**를 선택합니다.

    <img src="/images/step2/2-1-step19-iam-role.png" alt="IAM Roles 메뉴" class="guide-img-sm" />
20. [[Create role]] 버튼을 클릭합니다.
21. 다음과 같이 설정합니다:
    - **Trusted entity type**: `AWS service`
    - **Use case**: `EC2` 선택

    <img src="/images/step2/2-1-step21-trusted-entity.png" alt="Trusted entity 설정" class="guide-img-sm" />
22. [[Next]] 버튼을 클릭합니다.
23. **Permissions policies** 검색창에 `AmazonSSMManagedInstanceCore`를 입력합니다.
24. `AmazonSSMManagedInstanceCore`를 체크합니다.

    <img src="/images/step2/2-1-step24-role-name.png" alt="SSM 정책 선택" class="guide-img-sm" />

> [!NOTE]
> `AmazonSSMManagedInstanceCore`는 AWS 관리형 정책으로, Amazon EC2가 SSM Agent를 통해 Systems Manager와 통신하는 데 필요한 최소 권한을 포함합니다.  
> 이 정책 하나로 Session Manager 접속, SSM Agent 등록 등이 가능합니다.

25. [[Next]] 버튼을 클릭합니다.
26. **Role name**에 `my-ec2-ssm-role`을 입력합니다.
27. **Tags** 섹션에서 다음 태그를 추가합니다:

| Key         | Value        |
| ----------- | ------------ |
| `CreatedBy` | `admin-user` |
| `Step`      | `step2`      |
| `Session`   | `2-1`        |

<img src="/images/step2/2-1-step27-role-tags.png" alt="Role 태그 및 이름 설정" class="guide-img-sm" />

28. [[Create role]] 버튼을 클릭합니다.

    <img src="/images/step2/2-1-step28-create-role.png" alt="Create role 클릭" class="guide-img-sm" />

✅ IAM Role 생성이 완료되었습니다.

### 1-2. Amazon EC2 인스턴스 생성

29. 상단 검색창에 `EC2`를 입력하고 EC2 서비스를 선택합니다.

    <img src="/images/step2/2-1-step29-ec2-search.png" alt="EC2 검색" class="guide-img-sm" />

30. 왼쪽 메뉴에서 **Instances**를 선택합니다.

    <img src="/images/step2/2-1-step30-instances.png" alt="Instances 메뉴 선택" class="guide-img-sm" />

31. [[Launch instances]] 버튼을 클릭합니다.
32. **Name and tags** 섹션에서 다음과 같이 설정합니다:
    - **Name**: `my-ec2-mysql`
    - [[Add additional tags]]를 클릭하여 다음 태그를 추가합니다:

    <img src="/images/step2/2-1-step32-name-tags.png" alt="Name and tags 설정" class="guide-img-sm" />
    
| Key         | Value        |
| ----------- | ------------ |
| `CreatedBy` | `admin-user` |
| `Step`      | `step2`      |
| `Session`   | `2-1`        |


<img src="/images/step2/2-1-step32-tags-detail.png" alt="태그 추가 설정" class="guide-img-sm" />

> [!TIP]
> Name 태그는 콘솔에서 인스턴스를 식별하는 데 사용됩니다.  
> `CreatedBy`, `Step`, `Session` 태그는 Tag Editor에서 리소스를 일괄 검색/삭제할 때 활용됩니다.  
> 모든 실습에서 동일한 태그 체계를 적용합니다.

33. **Application and OS Images (Amazon Machine Image)** 섹션에서 다음과 같이 설정합니다:
    - **Quick Start** 탭 → **Amazon Linux** 선택
    - **AMI**: `Amazon Linux 2023 kernel-6.1 AMI` (기본 선택됨, "Verified provider" 배지 확인)
    - **Architecture**: `64-bit (x86)`

    <img src="/images/step2/2-1-step33-ami.png" alt="AMI 선택" class="guide-img-sm" />

> [!WARNING]
> AMI 선택 시 **Amazon Linux 2023**과 **Amazon Linux 2**를 혼동하지 마세요.  
> Amazon Linux 2는 2026년 6월 EOL(End of Life)입니다. 반드시 "2023"이 포함된 AMI를 선택하세요.

34. **Instance type**에서 `t3.micro`를 선택합니다.

    <img src="/images/step2/2-1-step34-instance-type.png" alt="Instance type 선택" class="guide-img-sm" />

> [!NOTE]
> 콘솔에서 기본 선택된 인스턴스 타입은 계정에 따라 다를 수 있습니다 (t2.micro 또는 t3.micro).  
> `t3.micro`를 직접 선택하세요.
>
> | 인스턴스 타입 | vCPU | 메모리 | 시간당 비용 (서울) | 월 비용 (24/7) |
> | ------------- | ---- | ------ | ------------------ | -------------- |
> | **t3.micro**  | 2    | 1 GB   | ~$0.0104           | ~$7.49         |
> | t3.small      | 2    | 2 GB   | ~$0.0208           | ~$14.98        |
> | t3.medium     | 2    | 4 GB   | ~$0.0416           | ~$29.95        |
>
> ※ 위 금액은 작성 시점 기준 참고 값이며, 실제 요금은 리전, 환율, AWS 정책 변경에 따라 상이할 수 있습니다.

> [!TIP]
> **인스턴스 타입 선택 기준 (프로덕션 참고)**
>
> | 용도                          | 권장 타입    | 이유                          |
> | ----------------------------- | ------------ | ----------------------------- |
> | 실습/테스트                   | `t3.micro`   | 최소 비용, 학습 목적에 충분   |
> | Spring Boot 단독 실행         | `t3.small`   | 메모리 2GB로 JVM 안정 운영    |
> | Spring Boot + MySQL 동시 실행 | `t3.medium`  | 메모리 4GB로 여유 있는 운영   |
> | 트래픽이 많은 프로덕션        | `m6i.large`+ | 범용 고성능, 버스트 제한 없음 |
>
> 이 실습에서는 MySQL만 설치하므로 `t3.micro` (1GB)로 충분합니다.  
> 메모리 부족 증상(OOM Kill, 느린 응답)이 발생하면 `t3.small`로 업그레이드하세요.  
>  EC2 콘솔 → 인스턴스 선택 → **Instance state** → Stop → **Actions** → **Instance settings** → **Change instance type**에서 변경 가능합니다.
>
> 인스턴스 타입별 상세 스펙과 리전별 요금은 [AWS EC2 요금 페이지](https://aws.amazon.com/ec2/pricing/on-demand/)에서 확인하세요.

35. **Key pair (login)** 섹션에서:
    - 기존 키 페어가 있으면 선택합니다.
    - 없으면 [[Create new key pair]] 클릭:
      - **Key pair name**: `my-keypair`
      - **Key pair type**: `RSA`
      - **Private key file format**: `.pem`
      - [[Create key pair]] 클릭 → 파일이 자동 다운로드됩니다.

    <img src="/images/step2/2-1-step35-keypair1.png" alt="Key pair 설정" class="guide-img-sm" />

    <img src="/images/step2/2-1-step35-keypair2.png" alt="Key pair 생성" class="guide-img-sm" />
    <img src="/images/step2/2-1-step35-keypair-select.png" alt="Key pair 선택" class="guide-img-sm" />

> [!WARNING]
> 키 페어 파일(.pem)은 **한 번만 다운로드** 가능합니다. 분실하면 인스턴스에 SSH 접속할 수 없습니다. 안전한 곳에 보관하세요.
> <img src="/images/step2/2-1-step35-keypair-warning.png" alt="Key pair 다운로드" class="guide-img-sm" />


> [!NOTE]
> 이 실습에서는 `.pem` 형식만 사용합니다.
>
> - **Mac/Linux**: 터미널에서 `ssh -i` 명령어로 접속
> - **Windows**: [MobaXterm](https://mobaxterm.mobatek.net/) (무료 Home Edition, Portable)을 사용하여 접속. `.pem` 파일을 그대로 사용할 수 있습니다.
>
> **Windows — MobaXterm Portable 설치 (설치 과정 없음):**
>
> 1. [다운로드 페이지](https://mobaxterm.mobatek.net/download-home-edition.html) → **Portable edition** 클릭
> 2. ZIP 파일 다운로드 → 원하는 폴더에 압축 해제
> 3. `MobaXterm_Personal_xx.x.exe` 실행 (별도 설치 과정 없음)
> 4. 상단 **Session** → **SSH** 선택
> 5. **Remote host**: EC2 Public IP 입력, **Username**: `ec2-user`
> 6. **Advanced SSH settings** → ✅ **Use private key** 체크 → `.pem` 파일 선택
> 7. **OK** → 접속 완료
>
> 자주 사용한다면 실행 후 작업표시줄에서 우클릭 → **작업 표시줄에 고정**을 권장합니다.
>
> `.ppk`는 PuTTY 전용 키 형식입니다. PuTTY를 사용하는 경우에만 필요하며, 이 실습에서는 사용하지 않습니다.

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

36. **Network settings** 섹션에서 [[Edit]] 버튼을 클릭합니다:
    - **VPC**: `my-vpc` 선택
    - **Subnet**: `my-public-subnet-a` 선택
    - **Auto-assign public IP**: `Enable`
    - **Firewall (security groups)**: `Select existing security group` 선택
    - **Common security groups**: `my-ec2-sg` 선택

    <img src="/images/step2/2-1-step36-network.png" alt="Network settings 설정" class="guide-img-sm" />

> [!WARNING]
> **Auto-assign public IP**가 `Enable`인지 반드시 확인하세요.  
> `Disable`이면 Public IP가 할당되지 않아 SSH 접속이 불가능합니다.  
> 서브넷의 기본 설정이 Disable일 수 있으므로 수동으로 Enable로 변경해야 합니다.

> [!NOTE]
> **"Create new security group"이 아닌 "Select existing security group"을 선택해야 합니다.**  
> 기본값은 새 Security Group을 생성하는 것이므로, 반드시 라디오 버튼을 변경하고 `my-ec2-sg`를 선택하세요.

37. **Configure storage** 섹션은 기본값을 유지합니다:
    - **Root volume**: `8 GiB`, `gp3` (기본값 유지)
    - **File systems**: `None` 선택 (기본값)

    <img src="/images/step2/2-1-step37-storage.png" alt="Configure storage 설정" class="guide-img-sm" />

> [!NOTE]
> 8 GiB gp3는 MySQL 설치와 기본 운영에 충분합니다.  
> 프로덕션 환경에서는 데이터 크기에 맞게 조정하지만, 실습에서는 기본값으로 충분합니다.
>
> **File systems** 항목은 Amazon EC2에 추가 파일 시스템을 마운트하는 옵션입니다:
>
> | 옵션             | 설명                                           | 사용 사례                          |
> | ---------------- | ---------------------------------------------- | ---------------------------------- |
> | `S3 Files - new` | Amazon S3를 파일 시스템처럼 마운트             | 대용량 데이터 공유, 정적 파일 접근 |
> | `EFS`            | Elastic File System (공유 NFS 스토리지)        | 여러 Amazon EC2에서 동시에 파일 공유      |
> | `FSx`            | 고성능 파일 시스템 (Windows/Lustre)            | HPC, Windows 워크로드              |
> | **`None`**       | 추가 파일 시스템 없음 (EBS Root volume만 사용) | **이 실습에서 선택**               |
>
> 이 실습에서는 EBS Root volume만 사용하므로 `None`을 선택합니다.

38. **Advanced details** 섹션을 펼칩니다 (클릭하여 확장).
    - **IAM instance profile**: 드롭다운에서 `my-ec2-ssm-role`을 선택합니다.
    - **User data**: 비워둡니다 (이 실습에서는 사용하지 않음).
    - 나머지 설정은 기본값을 유지합니다.

    <img src="/images/step2/2-1-step38-advanced1.png" alt="Advanced details IAM Role 설정" class="guide-img-sm" />

    <img src="/images/step2/2-1-step38-advanced2.png" alt="Advanced details User data" class="guide-img-sm" />

> [!NOTE]
> 1-1단계에서 생성한 `my-ec2-ssm-role`을 여기서 연결합니다.  
> 이렇게 하면 인스턴스가 부팅되자마자 SSM Agent가 자동 등록되어, 태스크 3에서 Session Manager로 바로 접속할 수 있습니다.

> [!TIP]
> **User Data로 초기 설정 자동화하기 (참고)**
>
> Advanced details 맨 하단의 **User data** 필드에 쉘 스크립트를 입력하면, 인스턴스가 **최초 부팅될 때 자동으로 실행**됩니다.  
> 이 실습에서는 SSH 접속 후 수동으로 MySQL을 설치하지만, 익숙해지면 User Data를 활용하여 설치를 자동화할 수 있습니다.
>
> 예를 들어, MySQL 설치를 User Data에 넣으면 인스턴스 생성과 동시에 자동으로 처리됩니다:
>
> ```bash
> #!/bin/bash
> dnf update -y
> dnf install -y https://dev.mysql.com/get/mysql84-community-release-el9-1.noarch.rpm
> dnf install -y mysql-community-server
> systemctl start mysqld
> systemctl enable mysqld
> ```
>
> **User Data 활용 시 참고사항:**
>
> - 스크립트는 `root` 권한으로 실행되므로 `sudo`가 필요 없습니다.
> - 반드시 첫 줄에 `#!/bin/bash`를 포함해야 합니다.
> - 실행 로그는 `/var/log/cloud-init-output.log`에서 확인할 수 있습니다.
> - 인스턴스 최초 부팅 시 한 번만 실행됩니다 (Stop → Start해도 재실행되지 않음).
> - 스크립트 실행 중에는 SSH 접속이 가능하더라도 설치가 완료되지 않은 상태일 수 있으므로, 로그를 확인하고 진행하세요.
>
> 이후 Step에서 CloudFormation과 함께 User Data를 활용하여 완전 자동화된 환경 구축을 다룹니다.

39. 우측의 **Summary** 패널에서 설정 내용을 최종 확인합니다:
    - **Number of instances**: `1`
    - **Software Image (AMI)**: `Amazon Linux 2023 AMI`
    - **Virtual server type (instance type)**: `t3.micro`
    - **Firewall (security group)**: `my-ec2-sg`
    - **Storage (volumes)**: `1 volume(s) - 8 GiB`

    <img src="/images/step2/2-1-step39-summary.png" alt="Summary 패널 확인" class="guide-img-sm" />

> [!TIP]
> Summary에서 설정이 의도와 다르면 해당 섹션으로 돌아가 수정하세요.  
> 특히 Security Group이 `my-ec2-sg`가 아닌 다른 이름(예: `launch-wizard-1`)으로 표시되면, Network settings에서 "Select existing security group"을 다시 확인하세요.

40. [[Launch instance]] 버튼을 클릭합니다.

    <img src="/images/step2/2-1-step40-launch.png" alt="Launch instance 클릭" class="guide-img-sm" />

41. 인스턴스 상태가 `Running`이 될 때까지 기다립니다 (약 1-2분).

    <img src="/images/step2/2-1-step41-running.png" alt="인스턴스 Running 상태" class="guide-img-sm" />

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
> | Status check        | 3/3 checks passed  |

> [!TIP]
> **Status check**가 "3/3 checks passed"가 될 때까지 기다린 후 SSH 접속을 시도하세요.  
> "Initializing"인 상태에서는 접속이 실패할 수 있습니다.

> [!TROUBLESHOOTING]
> **인스턴스가 `Running`이 되지 않는 경우:**
>
> - **`Pending` 상태가 오래 지속**: 정상입니다. 최대 2-3분 기다려 보세요.
> - **`Terminated` 상태로 바로 전환**: Instance를 선택 → **Details** 탭 → **State transition message**에서 원인을 확인합니다.  
>   주로 AMI 문제이거나 인스턴스 타입이 해당 AZ에서 지원되지 않는 경우입니다.
> - **Public IP가 할당되지 않음**: Auto-assign public IP를 Enable로 설정했는지 확인합니다.  
>   이미 생성된 인스턴스는 Elastic IP를 연결하거나, 인스턴스를 삭제 후 재생성해야 합니다.

✅ **태스크 완료**: Amazon EC2 인스턴스가 생성되었습니다.

## 태스크 2: SSH 접속

42. 인스턴스 목록에서 `my-ec2-mysql`을 선택합니다.

    <img src="/images/step2/2-1-step42-select-instance.png" alt="인스턴스 선택" class="guide-img-sm" />

43. **Public IPv4 address**를 복사합니다.

> [!TIP]
> IP 주소 옆의 복사 아이콘(📋)을 클릭하면 클립보드에 복사됩니다. 수동으로 타이핑하면 오타가 발생하기 쉽습니다.

44. 키 파일 권한을 설정하고 확인합니다 (Mac/Linux — 최초 1회):

```bash
# 키 파일 권한 설정
chmod 400 ~/Downloads/my-keypair.pem

# 권한 확인
ls -la ~/Downloads/my-keypair.pem
```

<img src="/images/step2/2-1-step44-chmod.png" alt="키 파일 권한 설정" class="guide-img-sm" />

> [!OUTPUT]
>
> ```
> -r--------  1 username  staff  1674  6  3 10:00 /Users/username/Downloads/my-keypair.pem
> ```
>
> `-r--------`(소유자만 읽기)로 표시되면 정상입니다.  
> `-rw-r--r--` 등 다른 권한이 보이면 `chmod 400`을 다시 실행하세요.

45. SSH로 접속합니다:

```bash
ssh -i ~/Downloads/my-keypair.pem ec2-user@<Public-IP>
```

<img src="/images/step2/2-1-step45-ssh.png" alt="SSH 접속" class="guide-img-sm" />

> [!NOTE]
> `chmod 400`은 키 파일의 권한을 "소유자만 읽기"로 설정합니다.  
> SSH는 보안상 키 파일의 권한이 너무 열려 있으면 접속을 거부합니다. 이 명령은 키 파일당 최초 1회만 실행하면 됩니다.

> [!TIP]
> **Windows 사용자:**
>
> **방법 1: MobaXterm (권장 — 설치 없이 바로 사용)**
>
> 1. [다운로드 페이지](https://mobaxterm.mobatek.net/download-home-edition.html) → **Portable edition** 다운로드
>
>     <img src="/images/step2/2-1-moba-download.png" alt="MobaXterm 다운로드" class="guide-img-sm" />
>
> 2. ZIP 파일 압축 해제 → `MobaXterm_Personal_xx.x.exe` 실행
> 3. 상단 **Session** 클릭 → **SSH** 선택
> 4. **Basic SSH settings**:
>    - **Remote host**: EC2 Public IP 입력 (예: `13.125.200.28`)
>    - **Specify username** 체크 → `ec2-user` 입력
>    - **Port**: `22`
> 5. **Advanced SSH settings** 탭:
>    - ✅ **Use private key** 체크 → `.pem` 파일 선택
>
>     <img src="/images/step2/2-1-moba-advanced.png" alt="MobaXterm Advanced SSH settings" class="guide-img-sm" />
>
> 6. [[OK]] 클릭
> 7. 최초 접속 시 "the remote server identity is not yet known" 팝업이 나타나면 [[Accept]] 클릭
>
>     <img src="/images/step2/2-1-moba-accept.png" alt="MobaXterm Accept 팝업" class="guide-img-sm" />
>
>     <img src="/images/step2/2-1-moba-connected.png" alt="MobaXterm 접속 성공" class="guide-img-sm" />
>
> 접속 성공 시 왼쪽에 파일 브라우저, 오른쪽에 터미널이 표시됩니다. 파일 업로드/다운로드를 드래그 앤 드롭으로 할 수 있어 편리합니다.
>
> **방법 2: Windows Terminal / PowerShell (Windows 10 이상)**
>
> ```powershell
> ssh -i C:\Users\<사용자명>\Downloads\my-keypair.pem ec2-user@<Public-IP>
> ```
>
> <img src="/images/step2/2-1-powershell-ssh.png" alt="PowerShell SSH 접속" class="guide-img-sm" />
>
> Windows 10 이상에서는 OpenSSH가 기본 설치되어 있어 별도 프로그램 없이 SSH 접속이 가능합니다.
>
> **방법 3: PuTTY 사용**
>
> 1. PuTTYgen 실행 → **Load** → .pem 파일 선택 → **Save private key** (.ppk로 저장)
> 2. PuTTY 실행 → Host Name에 `ec2-user@<Public-IP>` 입력
> 3. 왼쪽 메뉴 Connection → SSH → Auth → Credentials → Private key file에 .ppk 파일 지정
> 4. **Open** 클릭

46. `Are you sure you want to continue connecting?` 메시지가 나오면 `yes`를 입력합니다.

> [!NOTE]
> 이 메시지는 최초 접속 시에만 나타납니다. 서버의 호스트 키를 로컬 `~/.ssh/known_hosts`에 저장하겠냐는 확인입니다.  
> `yes`를 입력하면 이후 같은 서버에 접속할 때는 이 메시지가 나타나지 않습니다.

> [!OUTPUT]
> 접속 성공 시 다음과 같은 프롬프트가 표시됩니다:
>
> ```
> ㅤ'     #_
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
> | `Connection refused`                     | SSH 서비스 미실행 또는 인스턴스 미준비               | Status check가 "3/3 checks passed"인지 확인. 1-2분 대기 후 재시도                       |
> | `Host key verification failed`           | 이전에 같은 IP로 다른 서버에 접속한 기록             | `ssh-keygen -R <Public-IP>` 실행 후 재시도                                              |
>
> **그래도 안 되면 EC2 Instance Connect 사용:**
>
> 1. EC2 콘솔에서 인스턴스 선택
> 2. [[Connect]] 버튼 클릭
> 3. **EC2 Instance Connect** 탭 선택
> 4. [[Connect]] 클릭 → 브라우저에서 바로 접속

✅ **태스크 완료**: Amazon EC2 인스턴스에 SSH 접속했습니다.

> [!CONCEPT] SSH 키 페어 사용 시 주의점
>
> SSH 접속에 사용한 키 페어(`.pem` 파일)는 Amazon EC2의 "물리적 열쇠"와 같습니다. 편리하지만 실무에서는 여러 위험이 있습니다.
>
> **키 페어의 장점:**
>
> - 설정이 단순하고 빠름 (EC2 생성 시 선택 → 바로 접속)
> - 별도 AWS 서비스 설정 없이 접속 가능
> - 로컬 터미널 환경 그대로 사용 가능
>
> **키 페어의 단점과 위험:**
>
> | 위험 요소              | 설명                                                     |
> | ---------------------- | -------------------------------------------------------- |
> | 분실 시 복구 불가      | `.pem` 파일을 잃어버리면 해당 키로는 다시 접속할 수 없음 |
> | 유출 시 즉시 침해 가능 | 키 파일이 유출되면 누구나 Amazon EC2에 접속 가능                |
> | 팀 공유가 어려움       | 팀원에게 `.pem` 파일을 전달하면 추적·회수가 불가능       |
> | 교체가 번거로움        | 키 변경 시 인스턴스의 `~/.ssh/authorized_keys` 수정 필요 |
> | 감사 로그 없음         | 누가 언제 접속했는지 SSH 자체로는 추적이 어려움          |
>
> **실무 가이드라인:**
>
> - `.pem` 파일은 **절대 Git에 커밋하지 마세요** (`.gitignore`에 `*.pem` 추가).
> - 팀 프로젝트에서는 키 페어를 공유하지 말고 **각자 자기 키 페어**를 사용하거나, SSM Session Manager를 사용하세요.
> - 프로덕션 서버에는 SSH 포트(22)를 아예 열지 않고 SSM만 사용하는 것이 모범 사례입니다.
> - 학습/개인 프로젝트에서는 SSH가 빠르고 편리하므로 적극 활용해도 됩니다.
>
> 다음 태스크에서 배울 SSM Session Manager는 이런 키 페어의 단점을 해결하는 접속 방식입니다.

## 태스크 3: SSM Session Manager로 접속

SSH에 이어 두 번째 접속 방식인 **SSM Session Manager**를 사용해 봅니다.  
태스크 1에서 EC2 생성 시 IAM Role(`my-ec2-ssm-role`)을 이미 연결했으므로, 바로 접속할 수 있습니다.

> [!CONCEPT] SSH vs SSM Session Manager
>
> Amazon EC2에 접속하는 대표적인 두 가지 방식입니다. 둘 다 알아두면 상황에 따라 적절한 방식을 선택할 수 있습니다.
>
> | 비교 항목           | SSH                            | SSM Session Manager                       |
> | ------------------- | ------------------------------ | ----------------------------------------- |
> | 키 페어 필요 여부   | ✅ 필요 (.pem 파일 관리)       | ❌ 불필요                                 |
> | Security Group 포트 | 22번 포트 오픈 필수            | 포트 오픈 불필요                          |
> | Public IP 필요 여부 | ✅ 필요 (Public Subnet인 경우) | ❌ Private Subnet에서도 접속 가능         |
> | 접속 로그 감사      | 별도 설정 필요                 | CloudTrail에 자동 기록                    |
> | 기본 접속 사용자    | `ec2-user`                     | `ssm-user`                                |
> | 필요 조건           | 키 페어 + SG 규칙 + Public IP  | IAM Role (`AmazonSSMManagedInstanceCore`) |
>
> **핵심 차이**: SSH는 네트워크(포트 22) 기반이고, SSM은 AWS API 기반입니다.  
> SSM은 Security Group에 인바운드 규칙이 없어도 동작하며, Private Subnet에서도 사용 가능합니다.

### 3-1. 콘솔에서 Session Manager 접속

47. EC2 콘솔에서 `my-ec2-mysql` 인스턴스를 선택합니다.
48. [[Connect]] 버튼을 클릭합니다.

    <img src="/images/step2/2-1-step48-connect.png" alt="Connect 버튼 클릭" class="guide-img-sm" />

49. **Session Manager** 탭을 선택합니다.

> [!TIP]
> **SSM Session Manager가 동작하려면 다음 3가지 조건이 모두 충족되어야 합니다:**
>
> | 조건                | 설명                                                                         | 이 실습에서의 상태                                 |
> | ------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------- |
> | ① IAM Role 연결     | EC2에 `AmazonSSMManagedInstanceCore` 정책이 포함된 Role이 연결되어 있어야 함 | ✅ 태스크 1-1에서 `my-ec2-ssm-role` 연결 완료      |
> | ② SSM Agent 실행 중 | Amazon EC2 내부에서 SSM Agent가 실행 중이어야 함                                    | ✅ Amazon Linux 2023은 기본 설치·자동 실행         |
> | ③ 네트워크 접근     | Amazon EC2가 SSM 서비스 엔드포인트에 접근 가능해야 함                               | ✅ Public Subnet + IGW이므로 인터넷 통해 접근 가능 |
>
> Private Subnet에서는 ③이 문제가 됩니다.  
> NAT Gateway가 있거나, VPC Endpoint(`ssm`, `ssmmessages`, `ec2messages`)를 생성해야 합니다.  
> 이 부분은 Step 9에서 다룹니다.

50. [[Connect]] 버튼을 클릭합니다.

    <img src="/images/step2/2-1-step50-session-manager.png" alt="Session Manager Connect" class="guide-img-sm" />

    <img src="/images/step2/2-1-step50-session-manager2.png" alt="Session Manager 접속 화면" class="guide-img-sm" />

> [!NOTE]
> Connect 버튼이 비활성(회색)이면 아직 SSM Agent가 IAM Role을 인식하지 못한 것입니다.  
> 인스턴스 생성 후 1~2분 기다린 뒤 페이지를 새로고침하세요.  
> Amazon Linux 2023에는 SSM Agent가 기본 설치·실행되므로, IAM Role만 연결되어 있으면 추가 설치 없이 동작합니다.

> [!OUTPUT]
> 브라우저에서 터미널이 열리며 다음과 같은 프롬프트가 표시됩니다:
>
> ```
> sh-5.2$
> ```

### 3-2. ssm-user 확인 및 ec2-user와의 차이 이해

51. 현재 접속 사용자를 확인합니다:

```bash
whoami
```

<img src="/images/step2/2-1-step51-whoami.png" alt="whoami 확인" class="guide-img-sm" />

> [!OUTPUT]
>
> ```
> ssm-user
> ```

> [!WARNING]
> **SSM과 SSH는 기본 접속 사용자가 다릅니다. 이 차이를 반드시 이해하세요.**
>
> | 접속 방식       | 기본 사용자 | 홈 디렉토리             | sudo 권한 |
> | --------------- | ----------- | ----------------------- | --------- |
> | SSH             | `ec2-user`  | `/home/ec2-user`        | ✅ 있음   |
> | Session Manager | `ssm-user`  | 없거나 `/home/ssm-user` | ✅ 있음   |
>
> **실무에서 주의할 점:**
>
> - SSH로 `/home/ec2-user`에 배포한 앱 파일은 SSM 접속 시 기본 경로에서 보이지 않습니다. `cd /home/ec2-user`로 이동해야 합니다.
> - `sudo`를 사용하는 시스템 명령(패키지 설치, 서비스 관리, `/etc/` 설정 변경)은 어떤 사용자든 동일하게 동작합니다.
> - 사용자별 환경(`.bashrc`, 환경변수, crontab)은 공유되지 않습니다.
> - 배포 스크립트나 crontab을 `ec2-user`로 설정했다면, SSM으로 접속해서 확인할 때는 반드시 `sudo su - ec2-user`로 전환해야 합니다.
>
> <img src="/images/step2/2-1-step51-warning.png" alt="SSM vs SSH 사용자 차이" class="guide-img-sm" />

52. `ec2-user`로 전환합니다:

```bash
sudo su - ec2-user
```

53. 전환된 사용자와 경로를 확인합니다:

```bash
whoami
pwd
```

<img src="/images/step2/2-1-step53-ec2user.png" alt="ec2-user 전환 확인" class="guide-img-sm" />

> [!OUTPUT]
>
> ```
> ec2-user
> /home/ec2-user
> ```

> [!TIP]
> **SSM 접속 후 사용자 전환 패턴:**
>
> ```bash
> # 애플리케이션 작업 (배포, 로그 확인, 앱 설정)
> sudo su - ec2-user
>
> # 시스템 관리 작업 (패키지 설치, 서비스 관리)
> sudo systemctl status mysqld     # ssm-user 상태에서 sudo 사용
>
> # root로 전환 (시스템 파일 직접 편집 등)
> sudo su -
> ```

54. 세션을 종료합니다:

```bash
exit  # ec2-user에서 ssm-user로 복귀
exit  # 세션 종료
```

<img src="/images/step2/2-1-step54-exit.png" alt="세션 종료" class="guide-img-sm" />

### 3-3. AWS CLI로 Session Manager 접속 (참고)

> [!TIP]
> 로컬 터미널에서도 Session Manager로 접속할 수 있습니다. 브라우저보다 로컬 터미널 환경(색상, 단축키, 복사/붙여넣기)이 편리합니다.
>
> **Session Manager Plugin 설치:**
>
> ```bash
> # Mac (Homebrew)
> brew install --cask session-manager-plugin
>
> # 설치 확인
> session-manager-plugin --version
> ```
>
> Windows/Linux 설치 방법은 [AWS 공식 문서](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html)를 참고하세요.
>
> **접속:**
>
> ```bash
> aws ssm start-session --target <Instance-ID> --region ap-northeast-2
> ```
>
> Instance ID는 EC2 콘솔에서 확인합니다 (예: `i-0abc123def456789`).

### 3-4. 접속 방식 정리

> [!CONCEPT] EC2 접속 방식 총정리
>
> | 방식                     | 사전 준비                          | 접속 대상           | 기본 사용자 | 주 사용 환경             |
> | ------------------------ | ---------------------------------- | ------------------- | ----------- | ------------------------ |
> | **SSH**                  | 키 페어 + SG 22번 포트 + Public IP | Public Subnet EC2   | `ec2-user`  | 개발/학습                |
> | **EC2 Instance Connect** | SG 22번 포트 + Public IP           | Public Subnet EC2   | `ec2-user`  | 빠른 임시 접속           |
> | **SSM Session Manager**  | IAM Role                           | Public/Private 모두 | `ssm-user`  | 프로덕션, 보안 중시 환경 |
>
> **이후 실습에서의 사용:**
>
> - **이 실습(Step 2)**: SSH로 접속하여 MySQL 설치·설정을 진행합니다.
> - **Step 9 (3-Tier)**: Private Subnet의 Amazon EC2에 SSM Session Manager로 접속합니다.
>
> 어떤 방식으로 접속하든 `sudo`가 포함된 명령은 동일하게 동작합니다.

> [!TROUBLESHOOTING]
> **Session Manager 접속이 안 되는 경우:**
>
> | 증상                                        | 원인                                  | 해결 방법                                            |
> | ------------------------------------------- | ------------------------------------- | ---------------------------------------------------- |
> | Connect 버튼 비활성 (회색)                  | IAM Role 미연결 또는 SSM Agent 미실행 | IAM Role 연결 확인. 1~2분 대기 후 새로고침           |
> | `TargetNotConnected` 에러                   | SSM Agent가 아직 시작되지 않음        | 2~3분 대기 또는 인스턴스 재부팅                      |
> | CLI에서 `SessionManagerPlugin is not found` | Plugin 미설치                         | `session-manager-plugin` 설치 후 재시도              |
> | `Access denied` 에러                        | IAM Role에 SSM 권한 없음              | Role에 `AmazonSSMManagedInstanceCore` 정책 연결 확인 |

✅ **태스크 완료**: SSM Session Manager로 접속하고, `ssm-user`와 `ec2-user`의 차이를 이해했습니다.

## 태스크 4: MySQL 8.4 LTS 설치

> [!NOTE]
> 이후 태스크는 **SSH로 접속한 상태** (`ec2-user`)를 기준으로 안내합니다.  
> SSM Session Manager를 사용하는 경우 `sudo su - ec2-user`로 전환하거나, 각 명령에 `sudo`를 붙여 실행하면 동일하게 동작합니다.

55. 시스템 패키지를 업데이트합니다:

```bash
sudo dnf update -y
```

<img src="/images/step2/2-1-step55-dnf-update.png" alt="dnf update 실행" class="guide-img-sm" />

> [!NOTE]
> `sudo dnf update -y`는 시스템의 모든 패키지를 최신 버전으로 업데이트합니다.  
> 보안 패치와 버그 수정이 포함되므로 소프트웨어 설치 전에 항상 실행하는 것이 좋습니다. 1-2분 소요될 수 있습니다.

56. MySQL 공식 Yum Repository를 추가합니다:

```bash
sudo dnf install -y https://dev.mysql.com/get/mysql84-community-release-el9-1.noarch.rpm
```

<img src="/images/step2/2-1-step56-mysql-repo.png" alt="MySQL Repository 추가" class="guide-img-sm" />

> [!NOTE]
> Amazon Linux 2023의 기본 리포지토리에는 MySQL이 포함되어 있지 않습니다.  
> MySQL 공식 Yum Repository를 추가해야 `mysql-community-server` 패키지를 설치할 수 있습니다.
>
> - `el9`는 Enterprise Linux 9 호환을 의미합니다. Amazon Linux 2023은 Fedora/RHEL 9 기반이므로 `el9` 패키지를 사용합니다.
> - `mysql84`는 MySQL 8.4 LTS(Long Term Support) 버전입니다. 2024년 4월 출시되어 2032년까지 지원됩니다.
> - RPM 파일 버전(`el9-1`)은 시점에 따라 변경될 수 있습니다. 최신 URL은 [MySQL Yum Repository 다운로드 페이지](https://dev.mysql.com/downloads/repo/yum/)에서 확인하세요.

57. MySQL 8.4 Community Server를 설치합니다:

```bash
sudo dnf install -y mysql-community-server
```

<img src="/images/step2/2-1-step57-mysql-install.png" alt="MySQL 설치" class="guide-img-sm" />

> [!NOTE]
> GPG 키 확인 메시지가 나타나면 `y`를 입력합니다.  
> 설치가 완료되면 `mysql-community-server`, `mysql-community-client`, `mysql-community-common` 등이 함께 설치됩니다.

58. MySQL 서비스를 시작합니다:

```bash
sudo systemctl start mysqld
```

<img src="/images/step2/2-1-step58-mysql-start.png" alt="MySQL 서비스 시작" class="guide-img-sm" />

59. MySQL 서비스를 부팅 시 자동 시작하도록 설정합니다:

```bash
sudo systemctl enable mysqld
```

> [!NOTE]
> `enable`은 서버가 재부팅될 때 MySQL이 자동으로 시작되도록 설정합니다.  
> `start`는 지금 당장 시작하는 것이고, `enable`은 다음 부팅부터 자동 시작하는 것입니다. 둘 다 실행해야 합니다.

60. MySQL 서비스 상태를 확인합니다:

```bash
sudo systemctl status mysqld
```

<img src="/images/step2/2-1-step60-mysql-status.png" alt="MySQL 서비스 상태 확인" class="guide-img-sm" />

> [!OUTPUT]
>
> ```
> ● mysqld.service - MySQL Server
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
> | 증상                                            | 원인                            | 해결 방법                                                                                                 |
> | ----------------------------------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------- |
> | `No match for argument: mysql-community-server` | 리포지토리 미등록               | `sudo dnf install -y https://dev.mysql.com/get/mysql84-community-release-el9-1.noarch.rpm` 실행 후 재시도 |
> | `Job for mysqld.service failed`                 | 포트 충돌 또는 디스크 공간 부족 | `sudo journalctl -u mysqld -n 30`으로 상세 로그 확인                                                      |
> | `Active: failed`                                | 설정 파일 오류                  | `sudo cat /var/log/mysqld.log`로 에러 메시지 확인                                                         |
>
> **디스크 공간 확인:**
>
> ```bash
> df -h
> ```
>
> 루트 파티션(`/`)의 사용률이 90% 이상이면 MySQL이 시작되지 않을 수 있습니다.

✅ **태스크 완료**: MySQL 8.4 LTS가 설치되고 실행 중입니다.

## 태스크 5: MySQL 보안 초기화

61. MySQL 임시 비밀번호를 확인합니다:

```bash
sudo grep 'temporary password' /var/log/mysqld.log
```

<img src="/images/step2/2-1-step61-temp-password.png" alt="임시 비밀번호 확인" class="guide-img-sm" />

> [!OUTPUT]
>
> ```
> A temporary password is generated for root@localhost: AbCd1234!xyz
> ```
>
> 콜론(`:`) 뒤의 문자열이 임시 비밀번호입니다. 정확히 복사하세요 (앞뒤 공백 주의).

> [!WARNING]
> 임시 비밀번호는 MySQL 최초 설치 시 한 번만 생성됩니다.  
> 이 비밀번호를 분실하면 MySQL을 재설치해야 할 수 있습니다.  
> 다음 단계에서 바로 변경하므로 메모장에 임시로 복사해 두세요.

62. MySQL 보안 초기화 스크립트를 실행합니다:

```bash
sudo mysql_secure_installation
```

63. 프롬프트에 따라 설정합니다:

```
Enter password for user root: (임시 비밀번호 입력 — 화면에 표시되지 않음)

New password: (새 비밀번호 입력, 예: MyPass123!)
Re-enter new password: (새 비밀번호 재입력)

Estimated strength of the password: 100
Change the password for root ? ((Press y|Y for Yes, any other key for No) : n

Remove anonymous users? (Press y|Y for Yes, any other key for No) : y
Disallow root login remotely? (Press y|Y for Yes, any other key for No) : y
Remove test database and access to it? (Press y|Y for Yes, any other key for No) : y
Reload privilege tables now? (Press y|Y for Yes, any other key for No) : y
```

<img src="/images/step2/2-1-step63-secure-install.png" alt="MySQL 보안 초기화" class="guide-img-sm" />

> [!NOTE]
> **MySQL 8.4의 `mysql_secure_installation` 전체 흐름:**
>
> 1. 임시 비밀번호 입력 → 비밀번호 만료 상태이므로 **새 비밀번호 설정을 강제**합니다.
> 2. 새 비밀번호 입력 후 강도 검사 결과가 표시됩니다 (예: `Estimated strength: 100`).
> 3. "Change the password for root?" 질문:
>    - **`n` (권장)**: 방금 설정한 비밀번호를 그대로 사용. 바로 다음 질문으로 넘어갑니다.
>    - **`y`**: 비밀번호를 다시 변경합니다.  
>      이 경우 새 비밀번호 입력 후 "Do you wish to continue with the password provided?" 질문이 추가로 나타나며, `y`를 입력하면 진행됩니다.
> 4. 이후 Remove anonymous users → Disallow root login remotely → Remove test database → Reload privilege tables 순서로 모두 `y`를 입력합니다.

> [!WARNING]
> MySQL 8.4의 비밀번호 정책은 기본적으로 `MEDIUM`입니다:
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

64. 새 비밀번호로 MySQL에 접속합니다:

```bash
mysql -u root -p
```

<img src="/images/step2/2-1-step64-mysql-login.png" alt="MySQL 접속" class="guide-img-sm" />

> [!NOTE]
> `-p` 옵션 뒤에 비밀번호를 직접 입력하지 마세요 (`mysql -u root -pMyPass123!`).  
> 명령어 히스토리에 비밀번호가 남습니다.  
> `-p`만 입력하면 비밀번호를 안전하게 프롬프트로 입력할 수 있습니다.

> [!OUTPUT]
>
> ```
> Welcome to the MySQL monitor.  Commands end with ; or \g.
> Your MySQL connection id is x
> Server version: 8.4.xx MySQL Community Server - GPL
>
> mysql>
> ```

✅ **태스크 완료**: MySQL 보안 초기화가 완료되었습니다.

## 태스크 6: 데이터베이스 및 사용자 생성

> [!NOTE]
> 이 태스크의 모든 명령은 MySQL 프롬프트(`mysql>`)에서 실행합니다. 태스크 5에서 `mysql -u root -p`로 접속한 상태여야 합니다.

65. 애플리케이션용 데이터베이스를 생성합니다:

```sql
CREATE DATABASE appdb DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

<img src="/images/step2/2-1-step65-create-db.png" alt="데이터베이스 생성" class="guide-img-sm" />

> [!NOTE]
> **`utf8mb4`를 사용하는 이유:**  
> MySQL의 `utf8`은 3바이트까지만 지원하여 이모지(😀)를 저장할 수 없습니다.  
> `utf8mb4`는 4바이트 유니코드를 완전히 지원하므로 한글, 이모지, 특수문자 모두 정상 저장됩니다.  
> 새 프로젝트에서는 항상 `utf8mb4`를 사용하세요.

66. 애플리케이션용 사용자를 생성합니다:

```sql
CREATE USER 'appuser'@'%' IDENTIFIED BY 'AppUser123!';
```

<img src="/images/step2/2-1-step66-create-user.png" alt="사용자 생성" class="guide-img-sm" />

> [!NOTE]
> `'appuser'@'%'`에서 `%`는 모든 호스트에서의 접속을 허용합니다.
>
> | 호스트 지정             | 의미                  | 사용 사례             |
> | ----------------------- | --------------------- | --------------------- |
> | `'appuser'@'%'`         | 모든 IP에서 접속 허용 | 개발/테스트 환경      |
> | `'appuser'@'10.0.%'`    | 10.0.x.x 대역만 허용  | Amazon VPC 내부 접속만 허용  |
> | `'appuser'@'localhost'` | 로컬에서만 접속 허용  | 같은 서버의 앱만 사용 |
>
> 보안을 강화하려면 `'appuser'@'10.0.%'`처럼 VPC CIDR 범위로 제한할 수 있습니다.

67. 사용자에게 데이터베이스 권한을 부여합니다:

```sql
GRANT ALL PRIVILEGES ON appdb.* TO 'appuser'@'%';
FLUSH PRIVILEGES;
```

<img src="/images/step2/2-1-step67-grant.png" alt="권한 부여" class="guide-img-sm" />

> [!NOTE]
> `GRANT ALL PRIVILEGES ON appdb.*`는 `appdb` 데이터베이스의 모든 테이블에 대해 모든 권한을 부여합니다.  
> `FLUSH PRIVILEGES`는 권한 변경을 즉시 적용합니다.
>
> **GRANT 구문 구조:**
>
> ```sql
> GRANT <권한 목록> ON <데이터베이스>.<테이블> TO '<사용자>'@'<호스트>';
> ```
>
> | 구성 요소           | 예시                                   | 설명                                                 |
> | ------------------- | -------------------------------------- | ---------------------------------------------------- |
> | 권한 목록           | `ALL PRIVILEGES` 또는 `SELECT, INSERT` | 부여할 권한. 콤마로 여러 개 지정 가능                |
> | 데이터베이스.테이블 | `appdb.*`                              | `appdb`의 모든 테이블. `appdb.users`면 특정 테이블만 |
> | 사용자@호스트       | `'appuser'@'%'`                        | 어떤 사용자에게, 어디서 접속할 때 적용할지           |
>
> **권한을 확인하는 방법:**
>
> ```sql
> -- 특정 사용자의 권한 확인
> SHOW GRANTS FOR 'appuser'@'%';
>
> -- 권한 회수 (잘못 부여한 경우)
> REVOKE DROP, ALTER ON appdb.* FROM 'appuser'@'%';
> FLUSH PRIVILEGES;
> ```
>
> 이 실습에서는 학습 편의를 위해 `ALL PRIVILEGES`를 사용하지만, 프로덕션에서는 아래 TIP을 참고하여 최소 권한만 부여하세요.

> [!TIP]
> **프로덕션 환경에서는 `ALL PRIVILEGES` 대신 필요한 권한만 부여하세요 (최소 권한 원칙).**
>
> ```sql
> GRANT SELECT, INSERT, UPDATE, DELETE ON appdb.* TO 'appuser'@'%';
> ```
>
> **왜 최소 권한을 부여하는가?**
>
> `ALL PRIVILEGES`는 SELECT, INSERT뿐 아니라 **DROP(테이블/DB 삭제)**, **ALTER(구조 변경)**, **GRANT(권한 위임)** 등 위험한 권한까지 포함합니다.
>
> | 권한                             | 위험도   | 설명                                                           |
> | -------------------------------- | -------- | -------------------------------------------------------------- |
> | `SELECT, INSERT, UPDATE, DELETE` | 낮음     | 일반적인 CRUD 작업. 애플리케이션에 필요한 최소 권한            |
> | `CREATE, ALTER`                  | 중간     | 테이블 구조 변경. 앱 배포 시에만 필요                          |
> | `DROP`                           | **높음** | 테이블/DB 삭제. 실수나 SQL Injection으로 데이터 영구 손실 가능 |
> | `GRANT`                          | **높음** | 다른 사용자에게 권한 부여. 권한 탈취 시 피해 확산              |
>
> **실무 패턴:**
>
> - **애플리케이션 계정** (`appuser`): `SELECT, INSERT, UPDATE, DELETE`만 부여
> - **마이그레이션/배포 계정** (`deploy_user`): `CREATE, ALTER, INDEX` 추가 부여
> - **DBA/관리 계정** (`admin`): `ALL PRIVILEGES` (접속 IP를 Amazon VPC 내부로 제한)
>
> 이렇게 분리하면 애플리케이션에 SQL Injection 취약점이 생기더라도 `DROP TABLE`이나 `DROP DATABASE`가 실행되지 않아 피해를 최소화할 수 있습니다.

68. 생성된 데이터베이스와 사용자를 확인합니다:

```sql
SHOW DATABASES;
SELECT user, host FROM mysql.user WHERE user = 'appuser';
```

<img src="/images/step2/2-1-step68-verify.png" alt="데이터베이스 및 사용자 확인" class="guide-img-sm" />

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

69. MySQL을 종료합니다:

```sql
EXIT;
```

<img src="/images/step2/2-1-step69-exit-mysql.png" alt="MySQL 종료" class="guide-img-sm" />

> [!TIP]
> `EXIT;`, `QUIT;`, 또는 `\q` 모두 MySQL 프롬프트를 종료하는 명령입니다.

✅ **태스크 완료**: 데이터베이스와 사용자가 생성되었습니다.

## 태스크 7: 외부 접속 설정

Amazon EC2 외부(로컬 PC 또는 다른 EC2)에서 MySQL에 접속할 수 있도록 설정합니다.

> [!CONCEPT] 왜 외부 접속을 설정하는가?
>
> 기본 설치된 MySQL은 **같은 서버 내부(localhost)**에서만 접속할 수 있습니다. 하지만 실무에서는 다음과 같은 이유로 외부 접속이 필요합니다:
>
> | 시나리오                              | 설명                                                            |
> | ------------------------------------- | --------------------------------------------------------------- |
> | **로컬 PC에서 GUI 도구로 관리**       | MySQL Workbench, DBeaver 등으로 편리하게 DB 구조 확인·쿼리 실행 |
> | **다른 Amazon EC2에서 접속**                 | 앱 서버(Web/WAS)와 DB 서버를 분리하는 구성 (Step 9에서 실습)    |
> | **CI/CD 파이프라인에서 마이그레이션** | 배포 시 자동으로 스키마 변경 실행                               |
> | **모니터링 도구 연동**                | Grafana, Datadog 등이 DB 메트릭을 수집                          |
>
> 이 실습에서는 로컬 PC의 MySQL Client(또는 GUI 도구)에서 Amazon EC2의 MySQL에 직접 접속할 수 있도록 설정합니다.
>
> ⚠️ **프로덕션에서는 DB를 Public Subnet에 두고 외부에 직접 노출하지 않습니다.**  
> DB는 Private Subnet에 배치하고, 앱 서버(같은 VPC)에서만 접속하도록 합니다.  
> 여기서는 학습 목적으로 외부 접속을 열지만, Step 4(RDS)와 Step 9(3-Tier)에서 보안 구성을 배웁니다.

> [!NOTE]
> 이 태스크에서는 **Security Group에 3306 포트를 추가**하는 것이 핵심 작업입니다.
>
> MySQL 8.4는 기본적으로 모든 인터페이스(`*`)에서 접속을 수신하므로, bind-address를 별도로 변경할 필요가 없습니다.  
> Security Group만 열어주면 외부에서 접속할 수 있습니다.

70. 먼저 MySQL이 외부 접속을 수신 가능한 상태인지 확인합니다:

```bash
sudo ss -tlnp | grep 3306
```

<img src="/images/step2/2-1-step70-bind-address.png" alt="MySQL 리스닝 확인" class="guide-img-sm" />

> [!OUTPUT]
>
> ```
> LISTEN  0  151  *:3306  *:*  users:(("mysqld",pid=xxxx,fd=xx))
> ```
>
> `*:3306` 또는 `0.0.0.0:3306`이 표시되면 모든 인터페이스에서 수신 대기 중이므로 **정상**입니다. 다음 단계로 넘어가세요.

> [!TIP]
> **MySQL의 bind-address 기본값은 `*` (모든 인터페이스)입니다.**
>
> MySQL 공식 RPM으로 설치한 경우(이 실습), 설정 파일(`/etc/my.cnf`)에 `bind-address`가 명시되어 있지 않으면 기본값 `*`가 적용되어 외부 접속이 가능합니다.
>
> 단, Ubuntu 등 일부 Linux 배포판은 보안을 위해 패키지 설치 시 설정 파일에 `bind-address = 127.0.0.1`을 명시적으로 넣습니다.  
> 이 경우 외부 접속이 차단됩니다.
>
> 만약 `127.0.0.1:3306`으로 표시된다면, `/etc/my.cnf`에서 `bind-address` 줄을 찾아 수정하거나 주석 처리하고 서비스를 재시작하세요:
>
> ```bash
> # 설정 파일에서 bind-address 확인
> grep bind-address /etc/my.cnf
>
> # bind-address가 있으면 0.0.0.0으로 변경하거나 주석 처리(#)
> sudo vi /etc/my.cnf
>
> # 변경 후 재시작
> sudo systemctl restart mysqld
> ```
>
> | 상태                         | 의미                  | 조치                   |
> | ---------------------------- | --------------------- | ---------------------- |
> | `*:3306` 또는 `0.0.0.0:3306` | 모든 IP에서 접속 가능 | ✅ 정상 — 변경 불필요  |
> | `127.0.0.1:3306`             | localhost만 접속 가능 | bind-address 수정 필요 |

> [!WARNING]
> bind-address가 열려 있어도 **Security Group에서 3306 포트를 허용하지 않으면** 외부에서 접속할 수 없습니다.  
> AWS에서는 Security Group이 1차 방화벽 역할을 합니다. 다음 단계에서 포트를 추가합니다.

71. **Security Group에 MySQL(3306) 포트를 추가합니다:**

> [!NOTE]
> CloudFormation 템플릿으로 생성된 `my-ec2-sg`에는 SSH(22), HTTP(80), HTTPS(443) 포트만 열려 있습니다.  
> 로컬 PC에서 MySQL에 접속하려면 **3306 포트 인바운드 규칙을 직접 추가**해야 합니다.

72. EC2 콘솔로 이동하여 `my-ec2-mysql` 인스턴스를 선택합니다.

    <img src="/images/step2/2-1-step72-security-tab.png" alt="EC2 인스턴스 선택" class="guide-img-sm" />

73. **Security** 탭을 클릭하고, Security groups 항목의 `my-ec2-sg` 링크를 클릭합니다.

    <img src="/images/step2/2-1-step73-sg-link.png" alt="Security Group 링크 클릭" class="guide-img-sm" />

74. **Inbound rules** 탭을 선택하고 [[Edit inbound rules]] 버튼을 클릭합니다.
75. [[Add rule]] 버튼을 클릭하고 다음과 같이 설정합니다:
    - **Type**: `MySQL/Aurora`
    - **Port range**: `3306` (자동 입력됨)
    - **Source**: `My IP` 선택 (현재 내 공인 IP만 허용)
    - **Description**: `MySQL from my PC`

    <img src="/images/step2/2-1-step75-add-rule.png" alt="Inbound rule 추가" class="guide-img-sm" />

76. [[Save rules]] 버튼을 클릭합니다.

    <img src="/images/step2/2-1-step76-save-rules.png" alt="Save rules 클릭" class="guide-img-sm" />

> [!WARNING]
> **Source는 `My IP`를 선택하여 본인 IP만 허용하는 것을 권장합니다.**
>
> IP가 자주 바뀌는 환경(카페, 모바일 핫스팟 등)에서 일시적으로 테스트할 목적이라면 `0.0.0.0/0`(모든 IP)을 사용할 수도 있지만, 다음 위험을 인지하세요:
>
> - MySQL 3306 포트는 봇들이 **자동으로 스캔하는 대표 포트**입니다.
> - `0.0.0.0/0`으로 열면 수분 내에 무차별 대입 공격(brute force) 시도가 들어옵니다.
> - 비밀번호가 약하면 DB가 탈취될 수 있고, 강하더라도 불필요한 접속 시도 로그가 계속 쌓입니다.
>
> `0.0.0.0/0`으로 열었다면 **테스트 직후 반드시 규칙을 삭제하거나 `My IP`로 변경**하세요.  
> IP가 바뀌면 Inbound rules에서 해당 규칙의 Source를 다시 `My IP`로 업데이트하면 됩니다.

> [!TIP]
> **실습이 끝나면 이 규칙을 삭제하세요.**  
> 3306 포트를 외부에 열어두는 것은 학습 목적으로만 사용합니다.  
> 프로덕션에서는 DB를 Private Subnet에 배치하고, Security Group에서도 3306을 앱 서버 SG에서만 허용합니다 (Step 4에서 학습).

77. 로컬 PC의 터미널에서 MySQL 접속을 테스트합니다:

```bash
mysql -h <EC2-Public-IP> -u appuser -p appdb

# 접속 후 데이터베이스 확인
SHOW DATABASES;
```

<img src="/images/step2/2-1-step77-external-connect.png" alt="외부 MySQL 접속 테스트" class="guide-img-sm" />

> [!NOTE]
> **mysql 명령어 옵션 설명:**
>
> ```
> mysql -h <호스트> -u <사용자> -p <데이터베이스>
>       │          │         │    │
>       │          │         │    └── 접속할 데이터베이스 이름
>       │          │         └── 비밀번호 프롬프트 표시 (-p 뒤에 공백)
>       │          └── 접속할 사용자명
>       └── 접속할 서버 IP 또는 호스트명
> ```
>
> | 옵션          | 의미                                 | 예시                       |
> | ------------- | ------------------------------------ | -------------------------- |
> | `-h`          | 접속할 서버 주소 (생략 시 localhost) | `-h 13.125.200.28`         |
> | `-u`          | MySQL 사용자명                       | `-u appuser`               |
> | `-p`          | 비밀번호를 프롬프트로 입력           | `-p` (뒤에 값 붙이지 않음) |
> | 마지막 인자   | 접속할 데이터베이스 이름 (생략 가능) | `appdb`                    |
> | `-P` (대문자) | 포트 번호 (기본값 3306이 아닐 때)    | `-P 3307`                  |
>
> `<EC2-Public-IP>` 부분을 Amazon EC2 인스턴스의 실제 Public IPv4 address로 교체합니다.  
> 비밀번호를 묻는 `Enter password:` 프롬프트가 나타나면 태스크 6에서 설정한 `appuser`의 비밀번호(`AppUser123!`)를 입력합니다.
>
> ⚠️ `-p` 뒤에 비밀번호를 직접 붙이면(`-pAppUser123!`) 쉘 히스토리에 비밀번호가 남습니다. 반드시 `-p`만 입력하고 프롬프트에서 입력하세요.

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
> **Windows에서 `mysql` 명령어를 전역으로 사용하려면 환경변수 등록이 필요합니다:**
>
> 1. MySQL 설치 경로 확인 (기본: `C:\Program Files\MySQL\MySQL Server 8.4\bin`)
> 2. **시스템 속성** → **환경 변수** → **Path** 편집 → 위 경로 추가
> 3. 터미널(CMD/PowerShell)을 재시작한 후 `mysql --version`으로 확인
>
> 환경변수를 등록하지 않으면 설치 폴더까지 전체 경로를 입력해야 합니다.
>
> 또는 MySQL Workbench(GUI 도구)를 사용하면 시각적으로 접속할 수 있습니다.

> [!OUTPUT]
>
> ```
> Welcome to the MySQL monitor.  Commands end with ; or \g.
> Your MySQL connection id is x
> Server version: 8.4.xx MySQL Community Server - GPL
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
> | 증상                     | 확인 사항                      | 해결 방법                                                       |
> | ------------------------ | ------------------------------ | --------------------------------------------------------------- |
> | `Connection timed out`   | Security Group                 | EC2 콘솔에서 3306 포트 Inbound rule 확인/추가                   |
> | `Connection refused`     | bind-address 또는 MySQL 미실행 | `sudo ss -tlnp \| grep 3306`으로 리스닝 확인. `*:3306`이어야 함 |
> | `Access denied for user` | MySQL 사용자 설정              | `'appuser'@'%'`로 생성했는지 확인. 비밀번호 정확히 입력         |
> | `Host is not allowed`    | MySQL 사용자 호스트 제한       | `SELECT user, host FROM mysql.user;`로 호스트 설정 확인         |
>
> **단계별 디버깅:**
>
> ```bash
> # 1. Amazon EC2 내부에서 MySQL 접속 확인 (SSH 접속 상태에서)
> mysql -u appuser -p appdb
>
> # 2. Amazon EC2 내부에서 리스닝 포트 확인
> sudo ss -tlnp | grep 3306
> ```
>
> ① 내부 접속이 안 되면 → MySQL 사용자/비밀번호 문제  
> ② 리스닝이 `*:3306`이 아니면 → bind-address 문제  
> ③ 내부 접속은 되는데 외부만 안 되면 → **Security Group** 3306 규칙 확인
>
> Amazon Linux 2023은 OS 레벨 방화벽(`iptables`, `firewalld`)이 기본 설치되어 있지 않으므로, Amazon EC2의 네트워크 접근 제어는 **Security Group**이 전부입니다.

✅ **태스크 완료**: 외부에서 MySQL 접속이 가능하도록 설정되었습니다.

---

## 📚 옵션 태스크: NACL 동작 테스트 (Step 1-3 복습)

> [!TIP]
> 이 태스크는 선택 사항이지만, **실습을 권장합니다.**  
> Step 1-3에서 이론으로 배운 NACL의 Stateless 동작과 규칙 번호 우선순위를 실제 트래픽으로 체험할 수 있습니다.  
> Security Group(Stateful)과의 차이를 직접 느껴보는 좋은 기회입니다.  
> 테스트 후 반드시 기본 NACL로 복원하여 이후 실습에 영향이 없도록 합니다.

### 사전 조건

- 위 실습에서 생성한 Amazon EC2 인스턴스가 `running` 상태이고, SSH로 접속 가능한 상태.
- 터미널에서 SSH 접속 명령어를 준비해 둡니다: `ssh -i ~/Downloads/my-keypair.pem ec2-user@<Public-IP>`

> [!NOTE]
> 이 테스트는 **SSH(22번 포트)**로 진행합니다.  
> 이 EC2에는 웹서버가 설치되어 있지 않으므로 HTTP(80)로는 테스트할 수 없습니다.  
> NACL에서 SSH 포트를 차단하면 접속이 끊기고, 허용하면 복구되는 것을 확인합니다.

> [!TIP]
> **다른 포트로도 테스트해 볼 수 있습니다.**
>
> SSH 외에 이 Amazon EC2에서 열려있는 MySQL(3306) 포트로도 동일한 테스트가 가능합니다.  
> 아래 표를 참고하여 NACL 규칙의 **Type**과 확인 명령어를 바꿔 적용하세요:
>
> | 테스트 대상 | NACL Rule Type        | 포트 | 차단 확인 명령어 (로컬 PC에서)      | 차단 시 에러 메시지                              |
> | ----------- | --------------------- | ---- | ----------------------------------- | ------------------------------------------------ |
> | SSH 접속    | `SSH (22)`            | 22   | `ssh -i key.pem ec2-user@<IP>`      | `Operation timed out` (약 1분 대기)              |
> | MySQL 접속  | `MySQL/Aurora (3306)` | 3306 | `mysql -h <IP> -u appuser -p appdb` | `ERROR 2003: Can't connect to MySQL server (60)` |
>
> 에러 메시지는 다르지만, 원인은 동일합니다 — NACL이 해당 포트의 트래픽을 차단하고 있습니다.  
> ALLOW 규칙을 추가하면 즉시 복구됩니다. 여러 포트를 번갈아 테스트하면 NACL의 동작 원리를 더 깊이 이해할 수 있습니다.
>
> <img src="/images/step2/2-1-nacl-mysql-test.png" alt="MySQL NACL 차단 테스트" class="guide-img-sm" />

### 경로 A: Step 1-3에서 커스텀 NACL을 이미 만든 경우

Step 1-3을 완료하여 `my-public-nacl`이 이미 존재하는 경우입니다.

78. Amazon VPC 콘솔 → **Network ACLs**에서 `my-public-nacl`을 선택합니다.
79. **Inbound rules** 탭에서 [[Edit inbound rules]]를 클릭합니다.
80. [[Add new rule]]을 클릭하고 다음 규칙을 추가합니다:
   - **Rule number**: `50`
   - **Type**: `SSH (22)`
   - **Source**: `0.0.0.0/0`
   - **Allow/Deny**: `Deny`
81. [[Save changes]]를 클릭합니다.
82. 로컬 터미널에서 SSH 접속을 시도합니다:

```bash
ssh -i ~/Downloads/my-keypair.pem ec2-user@<Public-IP>
```

<img src="/images/step2/2-1-step82-ssh-blocked.png" alt="SSH 접속 차단 확인" class="guide-img-sm" />

> [!OUTPUT]
> 접속이 **차단**됩니다 (`Operation timed out`).  
> Rule 50(DENY)이 Rule 100(ALLOW)보다 번호가 낮으므로 먼저 평가되어 SSH 트래픽이 거부됩니다.
>
> ⏱️ 타임아웃까지 약 1분 이상 걸립니다. 기다리기 싫으면 `Ctrl+C`로 중단해도 됩니다.

> [!NOTE]
> 이미 SSH로 접속 중인 세션은 바로 끊기지 않을 수 있습니다.  
> 새로운 SSH 접속을 시도해야 차단을 확인할 수 있습니다.

83. Amazon VPC 콘솔에서 다시 **Inbound rules** 탭 → [[Edit inbound rules]]를 클릭합니다.
84. Rule 50을 삭제합니다 (**Remove** 버튼 클릭).
85. [[Save changes]]를 클릭합니다.
86. 로컬 터미널에서 다시 SSH 접속을 시도합니다.

<img src="/images/step2/2-1-step86-ssh-restored.png" alt="SSH 접속 복구 확인" class="guide-img-sm" />

> [!OUTPUT]
> 접속이 **복구**됩니다. DENY 규칙이 제거되어 Rule 100(ALLOW)이 적용됩니다.

### 경로 B: CloudFormation으로 환경을 구성한 경우 (커스텀 NACL 없음)

2-1을 CloudFormation으로 시작하여 커스텀 NACL이 없는 경우, 직접 생성하여 테스트합니다.

87. 상단 검색창에 `VPC`를 입력하고 VPC 서비스를 선택합니다.
88. 왼쪽 메뉴에서 **Network ACLs**를 선택합니다.

    <img src="/images/step2/2-1-step88-network-acls.png" alt="Network ACLs 메뉴" class="guide-img-sm" />

89. [[Create network ACL]] 버튼을 클릭합니다.
90. 다음과 같이 설정합니다:  
    - **Name**: `test-nacl`
    - **VPC**: `my-vpc` 선택
    - **Tags**:
        - `CreatedBy` = `admin-user`
        - `Step` = `step2`
        - `Session` = `2-1`

    <img src="/images/step2/2-1-step90-create-nacl.png" alt="NACL 생성 설정" class="guide-img-sm" />

91. [[Create network ACL]] 버튼을 클릭합니다.

    <img src="/images/step2/2-1-step91-nacl-created1.png" alt="NACL 생성 완료" class="guide-img-sm" />

    <img src="/images/step2/2-1-step91-nacl-created2.png" alt="NACL 기본 규칙" class="guide-img-sm" />

> [!NOTE]
> 새로 생성한 NACL은 기본적으로 모든 인바운드/아웃바운드를 **DENY**합니다.  
> 이것이 기본 NACL(모든 트래픽 ALLOW)과의 핵심 차이입니다.

92. 생성된 `test-nacl`을 선택합니다.
93. **Subnet associations** 탭을 선택합니다.

    <img src="/images/step2/2-1-step93-subnet-assoc.png" alt="Subnet associations 탭" class="guide-img-sm" />

94. [[Edit subnet associations]] 버튼을 클릭합니다.
95. Amazon EC2가 있는 `my-public-subnet-a`를 체크합니다.

    <img src="/images/step2/2-1-step95-subnet-check.png" alt="Subnet 체크" class="guide-img-sm" />

96. [[Save changes]] 버튼을 클릭합니다.
97. 로컬 터미널에서 SSH 접속을 시도합니다:

```bash
ssh -i ~/Downloads/my-keypair.pem ec2-user@<Public-IP>
```

<img src="/images/step2/2-1-step82-ssh-blocked.png" alt="SSH 접속 차단 확인" class="guide-img-sm" />

> [!OUTPUT]
> 접속이 **차단**됩니다 (`Connection timed out`).  
> 커스텀 NACL은 기본적으로 모든 트래픽을 거부하므로, 허용 규칙을 추가하지 않으면 SSH도 통과하지 못합니다.
>
> ⏱️ 타임아웃 메시지가 나타나기까지 **약 1분 이상 대기**가 필요합니다.  
> 응답 없이 멈춰있는 것이 정상이며, 시간이 지나면 `Operation timed out` 에러가 표시됩니다. `Ctrl+C`로 강제 종료해도 됩니다.

98. `test-nacl`을 선택한 상태에서 **Inbound rules** 탭을 선택합니다.
99. [[Edit inbound rules]] 버튼을 클릭합니다.
100. [[Add new rule]] 버튼을 클릭하고 다음과 같이 설정합니다:  
     - **Rule number**: `100`  
     - **Type**: `SSH (22)`  
     - **Source**: `0.0.0.0/0`  
     - **Allow/Deny**: `Allow`  
101. [[Save changes]] 버튼을 클릭합니다.

     <img src="/images/step2/2-1-step101-inbound-rule.png" alt="Inbound rule 저장" class="guide-img-sm" />

102. **Outbound rules** 탭을 선택합니다.
103. [[Edit outbound rules]] 버튼을 클릭합니다.

     <img src="/images/step2/2-1-step103-outbound-rule.png" alt="Outbound rules 편집" class="guide-img-sm" />

104. [[Add new rule]] 버튼을 클릭하고 다음과 같이 설정합니다:  
     - **Rule number**: `100`
     - **Type**: `Custom TCP`
     - **Port range**: `1024-65535`
     - **Destination**: `0.0.0.0/0`
     - **Allow/Deny**: `Allow`
105. [[Save changes]] 버튼을 클릭합니다.

     <img src="/images/step2/2-1-step105-outbound-save.png" alt="Outbound rule 저장" class="guide-img-sm" />

> [!NOTE]
> NACL은 **Stateless**이므로 아웃바운드에 Ephemeral Port(1024-65535)를 허용해야 응답이 클라이언트에게 돌아갑니다.  
> Security Group은 Stateful이라 인바운드만 열면 응답이 자동으로 나가지만, NACL은 양방향 모두 명시적으로 허용해야 합니다.  
> 이것이 Security Group과 NACL의 핵심 차이입니다.

106. 로컬 터미널에서 다시 SSH 접속을 시도합니다:

```bash
ssh -i ~/Downloads/my-keypair.pem ec2-user@<Public-IP>
```

<img src="/images/step2/2-1-step86-ssh-restored.png" alt="SSH 접속 복구 확인" class="guide-img-sm" />

> [!OUTPUT]
> 접속이 **복구**됩니다. 인바운드 SSH 허용 + 아웃바운드 Ephemeral Port 허용으로 정상 통신됩니다.

---

## 🎯 셀프 미션: MySQL 포트로 NACL 차단/복구 테스트

> [!NOTE]
> **미션 목표**: SSH와 동일한 방식으로 MySQL(3306) 포트에 대해 NACL 차단/복구를 직접 수행해 보세요.
>
> 위에서 SSH(22)로 실습한 내용을 MySQL(3306)에 적용하는 것입니다.  
> 아래 힌트를 참고하여 스스로 시도해 보세요.
>
> **미션 단계:**
>
> 1. 현재 로컬 PC에서 MySQL 접속이 되는지 확인합니다.
>    ```bash
>    mysql -h <EC2-Public-IP> -u appuser -p appdb
>    ```
> 2. NACL Inbound rules에 **MySQL(3306) DENY 규칙**을 추가합니다. (Rule number: `50`)
> 3. 로컬 PC에서 MySQL 접속을 시도하여 **차단**을 확인합니다.
> 4. DENY 규칙을 삭제하여 **복구**를 확인합니다.
>
> **차단 시 예상 결과:**
> ```
> ERROR 2003 (HY000): Can't connect to MySQL server on '<IP>' (60)
> ```
>
> **힌트:**
> - NACL Rule Type: `MySQL/Aurora (3306)`
> - SSH 테스트와 동일한 원리 — 낮은 Rule number의 DENY가 우선 적용됩니다.
> - 경로 B(커스텀 NACL)를 사용한 경우, Inbound에 MySQL ALLOW 규칙도 추가해야 외부 접속이 가능합니다.

---

### 테스트 후 정리 (필수)

> [!WARNING]
> 테스트가 끝나면 반드시 기본 NACL로 복원하세요.  
> 커스텀 NACL이 연결된 상태로 방치하면 SSH 접속, MySQL 접속 등 이후 실습에서 통신 문제가 발생할 수 있습니다.

**경로 A를 진행한 경우:**

107. Amazon VPC 콘솔 → **Network ACLs**에서 `my-public-nacl`을 선택합니다.
108. **Subnet associations** 탭을 선택합니다.
109. [[Edit subnet associations]] 버튼을 클릭합니다.
110. 모든 서브넷의 체크를 해제합니다.
111. [[Save changes]] 버튼을 클릭합니다.

> [!NOTE]
> 서브넷은 항상 하나의 NACL에 연결되어 있어야 합니다. 커스텀 NACL에서 서브넷 연결을 해제하면 자동으로 Amazon VPC의 기본 NACL(모든 트래픽 허용)에 연결됩니다.

**경로 B를 진행한 경우:**

112. Amazon VPC 콘솔 → **Network ACLs**에서 `test-nacl`을 선택합니다.
113. **Subnet associations** 탭을 선택합니다.
114. [[Edit subnet associations]] 버튼을 클릭합니다.
115. 모든 서브넷의 체크를 해제합니다.
116. [[Save changes]] 버튼을 클릭합니다.

     <img src="/images/step2/2-1-step116-nacl-unassoc.png" alt="Subnet 연결 해제" class="guide-img-sm" />

117. 다시 `test-nacl`을 선택한 상태에서 **Actions** → [[Delete network ACL]]을 선택합니다.

     <img src="/images/step2/2-1-step117-delete-nacl.png" alt="Delete network ACL 선택" class="guide-img-sm" />

118. 확인 팝업에서 `delete`를 입력하고 [[Delete]] 버튼을 클릭합니다.

     <img src="/images/step2/2-1-step118-confirm-delete.png" alt="삭제 확인" class="guide-img-sm" />

> [!NOTE]
> 서브넷 연결을 해제하지 않으면 NACL을 삭제할 수 없습니다. 반드시 Subnet associations를 먼저 해제한 뒤 삭제하세요.

✅ **옵션 태스크 완료**: NACL의 Stateless 동작과 규칙 번호 우선순위를 실제 트래픽으로 확인했습니다.

## 마무리

이 실습에서 다음을 성공적으로 수행했습니다:

- IAM Role(`my-ec2-ssm-role`)을 생성하고 EC2에 연결했습니다.
- Amazon EC2 인스턴스(Amazon Linux 2023, t3.micro)를 생성하고 SSH와 SSM Session Manager 두 가지 방식으로 접속했습니다.
- `ec2-user`와 `ssm-user`의 차이를 이해하고, 접속 방식별 특성을 비교했습니다.
- MySQL 8.4 LTS를 설치하고 보안 초기화를 완료했습니다.
- 애플리케이션용 데이터베이스(`appdb`)와 사용자(`appuser`)를 생성하고, 최소 권한 원칙을 학습했습니다.
- Security Group에 3306 포트를 추가하여 로컬 PC에서 MySQL 외부 접속을 확인했습니다.

# 🗑️ 리소스 정리

> [!WARNING]
> 실습이 끝나면 **반드시** 리소스를 정리하여 불필요한 비용을 방지합니다.  
> Amazon EC2 인스턴스는 실행 중일 때 시간당 과금되며, 중지(Stop) 상태에서도 EBS 볼륨 비용이 발생합니다.

---

### 옵션 선택: 유지 vs 삭제

> [!NOTE]
> 다음 실습(Step 2-2, 2-3)에서 같은 Amazon EC2 인스턴스를 재사용할 수 있습니다. 상황에 맞게 선택하세요.
>
> | 옵션                    | 설명                                           | 비용 영향                             |
> | ----------------------- | ---------------------------------------------- | ------------------------------------- |
> | **옵션 A: 유지 (Stop)** | 인스턴스를 중지만 합니다. 다음 실습에서 재사용 | EBS 비용만 발생 (~$0.80/월, 8GiB gp3) |
> | **옵션 B: 완전 삭제**   | 인스턴스 + VPC 리소스 모두 삭제                | 비용 $0                               |
>
> ※ 위 금액은 작성 시점 기준 참고 값이며, 실제 요금은 리전, 환율, AWS 정책 변경에 따라 상이할 수 있습니다.
>
> Step 2-2(Vue.js), 2-3(Spring Boot)을 이어서 진행할 예정이라면 **옵션 A**를 권장합니다.

---

### 옵션 A: Amazon EC2 인스턴스 중지 (다음 실습에서 재사용)

1. AWS Management Console에서 상단 검색창에 `EC2`를 입력하고 선택합니다.
2. 왼쪽 메뉴에서 **Instances**를 클릭합니다.
3. `my-ec2-mysql` 인스턴스를 체크합니다.
4. 상단 **Instance state** → **Stop instance**를 클릭합니다.

    <img src="/images/step2/2-1-cleanup4-stop.png" alt="Stop instance 클릭" class="guide-img-sm" />

5. Instance state가 `Stopping`으로 변경되는 것을 확인합니다.

    <img src="/images/step2/2-1-cleanup5-stopping.png" alt="Stopping 상태 확인" class="guide-img-sm" />

6. Instance state가 `Stopped`으로 변경되는 것을 확인합니다.

    <img src="/images/step2/2-1-cleanup6-stopped.png" alt="Stopped 상태 확인" class="guide-img-sm" />

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

7. AWS Management Console 상단 검색창에 `Resource Groups & Tag Editor`를 입력하고 선택합니다.
8. 왼쪽 메뉴에서 **Tag Editor**를 선택합니다.
9. 다음과 같이 설정합니다:
   - **Regions**: `ap-northeast-2`
   - **Resource types**: `All supported resource types`
   - **Tag key**: `Session`
   - **Tag value**: `2-1`
10. [[Search resources]] 버튼을 클릭합니다.

    <img src="/images/step2/2-1-cleanup10-tag-editor.png" alt="Tag Editor 검색 결과" class="guide-img-sm" />

11. 이 실습에서 생성한 리소스(`my-ec2-mysql` 등)가 표시되는지 확인합니다.

> [!TIP]
> Tag Editor는 리소스를 찾는 용도로만 사용합니다. 실제 삭제는 다음 단계에서 수행합니다.

#### 단계 2: Amazon EC2 인스턴스 종료 (Terminate)

> [!WARNING]
> Terminate하면 인스턴스와 연결된 EBS 볼륨이 함께 삭제됩니다. MySQL 데이터도 모두 삭제되므로 필요한 데이터는 미리 백업하세요. **이 작업은 되돌릴 수 없습니다.**

12. EC2 콘솔 → **Instances**에서 `my-ec2-mysql` 인스턴스를 체크합니다.
13. 상단 **Instance state** → **Terminate(delete) instance**를 클릭합니다.

    <img src="/images/step2/2-1-cleanup13-terminate.png" alt="Terminate instance 클릭" class="guide-img-sm" />

14. 확인 팝업이 표시됩니다. 다음 항목을 확인합니다:
    - **Termination protection**: `Disabled` (정상 — 보호가 꺼져있어 삭제 가능)
    - **Skip OS shutdown**: 체크하지 않음 (기본값 유지)
15. [[Terminate (delete)]] 버튼을 클릭합니다.

    <img src="/images/step2/2-1-cleanup15-terminate-confirm.png" alt="Terminate 확인" class="guide-img-sm" />

16. Instance state가 `Shutting down` → `Terminated`로 변경되는 것을 확인합니다.

> [!NOTE]
> **확인 팝업의 옵션 설명:**
>
> | 항목                       | 설명                                                                             |
> | -------------------------- | -------------------------------------------------------------------------------- |
> | **Termination protection** | `Enabled`이면 실수로 삭제하는 것을 방지합니다. 프로덕션에서 권장.                |
> | **Skip OS shutdown**       | 체크하면 OS의 정상 종료(graceful shutdown) 과정을 건너뛰고 즉시 강제 종료합니다. |
>
> **Skip OS shutdown은 언제 사용하는가?**
>
> - 일반적으로 **체크하지 않습니다** (기본값). OS가 실행 중인 프로세스를 안전하게 종료하고, 파일 시스템을 정리한 뒤 꺼집니다.
> - 인스턴스가 응답하지 않거나(hang), 긴급 장애 대응 시에만 체크합니다. 강제 종료하면 디스크에 쓰는 중이던 데이터가 손상될 수 있습니다.
> - 이 실습에서는 **체크하지 않고** 그대로 [[Terminate (delete)]]를 클릭하세요.

> [!NOTE]
> Terminated 상태의 인스턴스는 약 1시간 후 콘솔 목록에서 자동으로 사라집니다.

#### 단계 3: CloudFormation 스택 삭제

태스크 0에서 CloudFormation으로 선행 리소스를 생성한 경우 스택을 삭제합니다.

> [!NOTE]
> Step 1에서 수동으로 Amazon VPC를 생성한 경우(CloudFormation을 사용하지 않은 경우), 이 단계를 건너뛰고 "단계 4: 수동 생성 리소스 삭제"로 이동합니다.

17. 상단 검색창에 `CloudFormation`을 입력하고 선택합니다.
18. **Stacks** 목록에서 `ec2-lab-prereq` 스택을 선택합니다.
19. [[Delete]] 버튼을 클릭합니다.
20. 확인 팝업에서 [[Delete stack]]을 클릭합니다.
21. 스택 상태가 `DELETE_IN_PROGRESS` → `DELETE_COMPLETE`가 될 때까지 기다립니다 (약 2-3분).

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
> - **원인**: 스택이 생성한 리소스를 다른 서비스가 사용 중 (예: Amazon EC2가 아직 Terminated되지 않음)
> - **해결**: Events 탭에서 실패 원인 확인 → 해당 리소스를 먼저 삭제 → 스택 삭제 재시도
> - Amazon EC2 인스턴스가 완전히 Terminated된 후(약 1-2분) 스택 삭제를 시도하세요.

#### 단계 4: 수동 생성 리소스 삭제 (CloudFormation 미사용 시)

Step 1에서 수동으로 Amazon VPC를 생성하고 그것을 이 실습에서 사용한 경우, 아래 방법으로 삭제합니다.

> [!TIP]
> **가장 간단한 방법: VPC 삭제 (연결 리소스 자동 삭제)**
>
> Amazon EC2 인스턴스가 완전히 Terminated된 상태라면, Amazon VPC를 삭제하면 연결된 리소스(서브넷, Route Table, IGW, Security Group)가 함께 삭제됩니다.
>
> 1. VPC 콘솔 → **Your VPCs**에서 `my-vpc`를 선택합니다.
> 2. **Actions** → [[Delete VPC]]를 선택합니다.
> 3. 확인 팝업에서 `delete`를 입력하고 [[Delete]] 버튼을 클릭합니다.
>
> 만약 VPC 삭제가 실패한다면 ("has dependencies" 에러), Amazon EC2가 아직 Terminated되지 않았거나 다른 리소스가 남아있는 것입니다.  
> 이 경우 [Step 1-1의 "📚 참고: 개별 리소스 역순 삭제" 섹션](/week/1/session/1#참고-개별-리소스-역순-삭제-vpc-삭제-실패-시)을 참고하여 의존 관계 역순으로 하나씩 삭제하세요.
>
> **삭제 순서 원칙** (생성의 역순):
>
> ```
> EC2 Terminate → Security Group 삭제 → Route Table 삭제 → IGW Detach/삭제 → Subnet 삭제 → VPC 삭제
> ```
>
> 각 단계의 상세 절차는 **Step 1-1 가이드의 "리소스 정리" 섹션**에 스크린샷 수준으로 안내되어 있습니다.

#### 단계 5: 삭제 확인

모든 리소스가 정상적으로 삭제되었는지 확인합니다.

22. **EC2 콘솔**: `my-ec2-mysql` 인스턴스가 `Terminated` 상태인지 확인합니다.
23. **CloudFormation 콘솔**: `ec2-lab-prereq` 스택이 목록에서 사라졌는지 확인합니다.
24. **VPC 콘솔**: `my-vpc`가 삭제되었는지 확인합니다.
25. **Tag Editor**: 다시 검색하여 관련 리소스가 남아있지 않은지 확인합니다.

> [!NOTE]
> 삭제 직후에는 일부 리소스가 잠시 남아있을 수 있으나, 시간이 지나면 자동으로 사라집니다. Terminated 인스턴스는 약 1시간 후 목록에서 제거됩니다.

> [!TIP]
> **키 페어는 삭제하지 마세요.** 키 페어 자체는 비용이 발생하지 않으며, 다음 실습에서 재사용할 수 있습니다. EC2 콘솔 → Key Pairs에서 확인할 수 있습니다.

✅ **옵션 B 완료**: 모든 리소스가 정리되었습니다.

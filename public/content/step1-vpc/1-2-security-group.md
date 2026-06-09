---
title: 'Security Group으로 인스턴스 방화벽 구성'
week: 1
session: 2
awsServices:
  - Amazon VPC
  - Security Group
learningObjectives:
  - Security Group의 Stateful 특성을 이해할 수 있습니다.
  - EC2용 Security Group을 생성하고 인바운드 규칙을 설정할 수 있습니다.
  - RDS용 Security Group을 생성하고 Source를 다른 SG로 지정할 수 있습니다.
  - 기본 Security Group과 커스텀 Security Group의 차이를 설명할 수 있습니다.
prerequisites:
  - AWS 계정 생성 완료
  - VPC 생성 완료 (Step 1-1 참조)
estimatedCost: 무료 리소스 (Security Group은 항상 무료)
---

이 실습에서는 EC2 인스턴스와 RDS 인스턴스에 적용할 Security Group을 생성합니다.  
Security Group은 인스턴스 레벨의 가상 방화벽으로, 인바운드/아웃바운드 트래픽을 제어합니다.

<img src="/images/architecture/step1-2-sg-architecture.png" alt="Step 1-2 Security Group 아키텍처 구성도" class="guide-img-lg" />

> [!WARNING]
> 위 다이어그램은 최종 목표 구성을 보여주는 참고 자료입니다.  
> Security Group은 생성만으로는 동작하지 않으며, 이후 Step 2에서 EC2 인스턴스, Step 4에서 RDS 인스턴스를 생성할 때 해당 SG를 연결해야 실제로 적용됩니다.

> [!NOTE]
> **실습 환경 구성 방식의 변화:**
>
> | Step    | 환경 구성 방식                 | 목적                                 |
> | ------- | ------------------------------ | ------------------------------------ |
> | 1-1     | 수동으로 하나씩 생성           | 각 구성 요소의 역할과 관계를 이해    |
> | **1-2** | **VPC and more로 한번에 생성** | **콘솔 마법사 활용법 학습**          |
> | 2-1~    | CloudFormation 템플릿 사용     | 인프라 자동화 체험, 실습 본론에 집중 |
>
> 이번 실습부터는 VPC 환경을 "VPC and more" 마법사로 빠르게 구성한 뒤, 본론인 Security Group 설정에 집중합니다.

## 태스크 0: VPC and more로 실습 환경 구성

Step 1-1에서는 VPC, 서브넷, IGW, Route Table을 하나씩 생성하며 원리를 학습했습니다.  
이번에는 AWS 콘솔의 **"VPC and more"** 마법사를 사용하여 동일한 구성을 한번에 생성합니다.

> [!NOTE]
> Step 1-1에서 생성한 `my-vpc`가 이미 있다면 이 태스크를 건너뛰고 태스크 1로 이동합니다.

### 상세 단계

1. AWS Management Console에 로그인합니다.
2. 리전을 **Asia Pacific (Seoul) ap-northeast-2**로 설정합니다.

    <img src="/images/common/region-check.png" alt="리전 확인" class="guide-img-sm" />

3. 상단 검색창에 `VPC`를 입력하고 VPC 서비스를 선택합니다.

    <img src="/images/step1/1-2-step3-vpc-search.png" alt="VPC 서비스 선택" class="guide-img-sm" />

4. [[Create VPC]] 버튼을 클릭합니다.

    <img src="/images/step1/1-2-step4-create-vpc.png" alt="Create VPC 클릭" class="guide-img-sm" />

5. **Resources to create**에서 `VPC and more`를 선택합니다.

    <img src="/images/step1/1-2-step5-vpc-and-more.png" alt="VPC and more 선택" class="guide-img-sm" />

6. 다음과 같이 설정합니다:
   - **Name tag auto-generation**: `my` 입력 (리소스 이름이 `my-vpc`, `my-public-subnet-1` 등으로 자동 생성)
   - **IPv4 CIDR block**: `10.0.0.0/16`
   - **IPv6 CIDR block**: `No IPv6 CIDR block`
   - **Tenancy**: `Default`
   - **Number of Availability Zones**: `2`
   - **Customize AZs**: 토글을 펼쳐서 `ap-northeast-2a`, `ap-northeast-2c`를 선택합니다.
   - **Number of public subnets**: `2`
   - **Number of private subnets**: `2`
   - **Customize subnets CIDR blocks**: 토글을 펼쳐서 다음과 같이 수정합니다.

     | 서브넷                                 | 기본값          | 변경값         |
     | -------------------------------------- | --------------- | -------------- |
     | Public subnet CIDR in ap-northeast-2a  | `10.0.0.0/20`   | `10.0.1.0/24`  |
     | Public subnet CIDR in ap-northeast-2c  | `10.0.16.0/20`  | `10.0.2.0/24`  |
     | Private subnet CIDR in ap-northeast-2a | `10.0.128.0/20` | `10.0.11.0/24` |
     | Private subnet CIDR in ap-northeast-2c | `10.0.144.0/20` | `10.0.12.0/24` |

   - **NAT gateways**: `None` (반드시 None 확인)
   - **VPC endpoints**: `None`
   - **DNS options**: 두 옵션 모두 체크 확인 (Enable DNS hostnames ✅, Enable DNS resolution ✅)

    <img src="/images/step1/1-2-step6-settings1.png" alt="VPC 설정 1" class="guide-img-sm" />

    <img src="/images/step1/1-2-step6-settings2.png" alt="VPC 설정 2" class="guide-img-sm" />

    <img src="/images/step1/1-2-step6-settings3.png" alt="VPC 설정 3" class="guide-img-sm" />

    <img src="/images/step1/1-2-step6-settings4.png" alt="VPC 설정 4" class="guide-img-sm" />

> [!WARNING]
> **NAT gateways 옵션이 반드시 `None`인지 확인하세요.**  
> `In 1 AZ` 또는 `1 per AZ`를 선택하면 NAT Gateway가 생성되며, 시간당 약 $0.059 + 데이터 처리 비용이 즉시 발생합니다.  
> (서울 리전 기준 월 약 $43~$86, 리전마다 비용이 다릅니다.)  
> 실수로 생성하면 크레딧이 빠르게 소진됩니다. NAT Gateway는 Step 3에서 별도로 학습합니다.
>
> ※ 위 금액은 작성 시점 기준 참고 값이며, 실제 요금은 리전, 환율, AWS 정책 변경에 따라 상이할 수 있습니다.

> [!NOTE]
> **Customize subnets CIDR blocks** 토글은 기본적으로 접혀 있습니다.  
> 펼치지 않으면 기본값(/20 대역)이 적용됩니다.  
> 기본값은 서브넷당 4,096개 IP로 학습용에는 과하고, Step 1-1에서 설계한 CIDR(/24, 251개)과 일치시키기 위해 수동으로 변경합니다.  
> 이후 실습에서 동일한 서브넷 CIDR을 참조하므로, 반드시 위 값으로 수정하세요.

7. **Additional tags** 토글을 펼쳐서 태그를 추가합니다:
   - [[Add new tag]]를 클릭하여 다음 3개 태그를 입력합니다.
   - `CreatedBy` = `admin-user`
   - `Step` = `step1`
   - `Session` = `1-2`

    <img src="/images/step1/1-2-step7-tags.png" alt="Additional tags 설정" class="guide-img-sm" />

> [!NOTE]
> **Additional tags**는 화면 하단에 접혀 있습니다.  
> 토글(▶)을 클릭하면 펼쳐지며, 여기서 추가한 태그는 VPC와 함께 생성되는 모든 리소스(서브넷, IGW, Route Table 등)에 자동으로 적용됩니다.  
> Name 태그는 상단의 Name tag auto-generation에서 설정하므로 여기서는 입력하지 않습니다.

8. 우측 **Preview** 패널에서 생성될 리소스를 확인합니다:
   - VPC 1개
   - Public Subnet 2개 (2a, 2c)
   - Private Subnet 2개 (2a, 2c)
   - Internet Gateway 1개
   - Route Table 2개 (Public, Private)

    <div class="guide-img-row">
      <img src="/images/step1/1-2-step8-preview1.png" alt="Preview 패널 1" class="guide-img-sm" />
      <img src="/images/step1/1-2-step8-preview2.png" alt="Preview 패널 2" class="guide-img-sm" />
    </div>

> [!TIP]
> Preview 다이어그램에서 각 리소스를 클릭하면 연결 경로가 하이라이트됩니다.  
> 서브넷 → Route Table → IGW 간의 연결이 올바른지 시각적으로 확인할 수 있습니다.
>
> <img src="/images/step1/1-2-step8-preview-route1.png" alt="연결 경로 확인 1" class="guide-img-sm" />
> <img src="/images/step1/1-2-step8-preview-route2.png" alt="연결 경로 확인 2" class="guide-img-sm" />

9. [[Create VPC]] 버튼을 클릭합니다.

    <img src="/images/step1/1-2-step9-create-vpc.png" alt="Create VPC 클릭" class="guide-img-sm" />

10. 생성 진행 화면에서 모든 리소스가 ✅ 표시될 때까지 기다립니다.

    <img src="/images/step1/1-2-step10-vpc-created.png" alt="VPC 생성 완료" class="guide-img-sm" />

> [!OUTPUT]
> "VPC and more" 마법사가 VPC, 서브넷 4개, IGW, Route Table 2개를 한번에 생성합니다.  
> Step 1-1에서 수동으로 진행한 모든 작업(VPC 생성 → 서브넷 생성 → IGW 생성/연결 → Route Table 생성/경로 추가/서브넷 연결)이 자동으로 완료됩니다.

> [!TIP]
> **VPC and more vs 수동 생성 비교:**
>
> - **수동 생성 (1-1)**: 각 단계의 의미를 이해하기 좋지만, 시간이 오래 걸리고 실수 가능성 있음.
> - **VPC and more (1-2)**: 클릭 몇 번으로 완성. 실무에서 빠르게 환경을 구성할 때 유용.
> - **AWS CloudFormation (2-1~)**: YAML 파일로 정의하여 반복 생성/삭제 가능. 코드로 인프라를 관리하는 IaC(Infrastructure as Code) 방식.
>
> 다음 Step(2-1)부터는 AWS CloudFormation 템플릿으로 환경을 자동 구성합니다.  
> 실습의 본론(Amazon EC2, Amazon RDS 등)에 집중할 수 있도록 사전 환경을 코드로 빠르게 프로비저닝합니다.

✅ **태스크 완료**: VPC and more로 실습 환경이 구성되었습니다.

## 태스크 1: Security Group 개념 이해

> [!CONCEPT] Security Group (보안 그룹)
> Security Group은 **인스턴스 레벨**에서 동작하는 가상 방화벽입니다.
>
> **핵심 특성:**
>
> - **Stateful**: 인바운드로 허용된 트래픽의 응답은 아웃바운드 규칙과 관계없이 자동 허용
> - **허용 규칙만 존재**: 거부(Deny) 규칙을 설정할 수 없음
> - **기본 동작**: 모든 인바운드 차단, 모든 아웃바운드 허용
> - **여러 인스턴스에 적용 가능**: 하나의 SG를 여러 인스턴스에 연결 가능
> - **Source로 다른 SG 지정 가능**: IP 대신 SG ID를 Source로 사용하여 동적 관리

### 기본 Security Group vs 커스텀 Security Group

| 구분                 | 기본 Security Group     | 커스텀 Security Group  |
| -------------------- | ----------------------- | ---------------------- |
| 생성 시점            | VPC 생성 시 자동 생성   | 사용자가 직접 생성     |
| 인바운드 기본 규칙   | 같은 SG의 트래픽만 허용 | 모든 인바운드 차단     |
| 아웃바운드 기본 규칙 | 모든 아웃바운드 허용    | 모든 아웃바운드 허용   |
| 삭제 가능 여부       | 삭제 불가               | 삭제 가능              |
| 권장 사용            | 사용하지 않는 것을 권장 | 용도별로 생성하여 사용 |

> [!WARNING]
> 기본 Security Group은 수정은 가능하지만 삭제할 수 없습니다.  
> 실무에서는 기본 SG를 사용하지 않고, 용도별로 커스텀 SG를 생성하는 것이 보안 모범 사례입니다.

✅ **태스크 완료**: Security Group의 개념과 특성을 이해했습니다.

## 태스크 2: EC2용 Security Group 생성

웹 서버(EC2)에 적용할 Security Group을 생성합니다. SSH, HTTP, HTTPS, Spring Boot(8080) 포트를 허용합니다.

11. 왼쪽 메뉴에서 **Security groups**를 선택합니다.

> [!TIP]
> VPC 생성 완료 후 대시보드가 닫혔다면:
> - 좌측 상단의 햄버거 메뉴(☰)를 클릭하면 왼쪽 네비게이션 패널이 열립니다.
> - 또는 상단 검색창에 `VPC`를 입력하여 VPC 서비스로 이동한 뒤 왼쪽 메뉴에서 **Security groups**를 선택하세요.

12. [[Create security group]] 버튼을 클릭합니다.

    <img src="/images/step1/1-2-step12-create-sg.png" alt="Create security group 클릭" class="guide-img-sm" />

13. **Basic details** 섹션을 설정합니다:
    - **Security group name**: `my-ec2-sg`
    - **Description**: `Security group for web server EC2 instances`
    - **VPC**: `my-vpc` 선택

    <img src="/images/step1/1-2-step13-basic-details.png" alt="Basic details 설정" class="guide-img-sm" />

14. **Inbound rules** 섹션에서 [[Add rule]] 버튼을 클릭합니다.
15. 첫 번째 규칙(SSH)을 설정합니다:
    - **Type**: `SSH`
    - **Port range**: `22` (자동 입력)
    - **Source**: `My IP` 선택

    <img src="/images/step1/1-2-step15-ssh-rule.png" alt="SSH 규칙 설정" class="guide-img-sm" />

> [!WARNING]
> SSH Source를 `0.0.0.0/0`(Anywhere)으로 설정하면 전 세계에서 SSH 접속을 시도할 수 있습니다.  
> 반드시 `My IP`를 선택하여 본인의 IP만 허용하세요.
>
> **`My IP`를 선택했는데 나중에 SSH 접속이 안 되는 경우:**
>
> - 카페, 학교, 집 등 네트워크를 이동하면 공인 IP가 변경됩니다.
> - 모바일 핫스팟, VPN 사용 시에도 IP가 달라집니다.
> - 이 경우 Security Group의 SSH 규칙을 편집하여 현재 IP로 업데이트하면 됩니다.  
>   (Security groups → `my-ec2-sg` → Inbound rules → Edit → SSH 규칙의 Source를 `My IP`로 다시 선택 → Save)
>
> **실무에서는 SSH 포트를 아예 열지 않는 방법도 있습니다:**
>
> - **AWS Systems Manager Session Manager (SSM)**: SSH 포트 없이 브라우저/CLI에서 인스턴스에 접속. Security Group에 22번 포트를 열 필요가 없어 보안상 가장 안전합니다.
> - **EC2 Instance Connect**: 콘솔에서 임시 SSH 키를 주입하여 접속. 포트 22는 필요하지만 키 관리가 간편합니다.
>
> 이 실습에서는 학습 목적으로 SSH(22)를 `My IP`로 열어두지만, 실무에서는 SSM 사용을 권장합니다.

> [!TIP]
> **EC2에 SSH 접속이 안 될 때 체크리스트:**
>
> 1. **Security Group 확인**: SSH(22) 인바운드 규칙의 Source IP가 현재 내 공인 IP와 일치하는지 확인합니다. ([ifconfig.me](https://ifconfig.me)에서 현재 IP 확인 가능)
> 2. **Public IP 확인**: EC2 인스턴스에 Public IP가 할당되어 있는지 확인합니다. (Public Subnet + Auto-assign Public IP 활성화 필요)
> 3. **Route Table 확인**: 서브넷의 Route Table에 `0.0.0.0/0 → IGW` 경로가 있는지 확인합니다.
> 4. **인스턴스 상태 확인**: EC2 인스턴스가 `running` 상태인지 확인합니다.
> 5. **Key Pair 확인**: SSH 접속 시 사용하는 키 파일(.pem)이 인스턴스 생성 시 지정한 Key Pair와 일치하는지 확인합니다.
> 6. **NACL 확인**: 서브넷의 Network ACL에서 SSH(22) 인바운드와 Ephemeral Port(1024-65535) 아웃바운드가 허용되어 있는지 확인합니다. (기본 NACL은 모두 허용)
>
> 대부분의 경우 **1번(IP 변경)**이 원인입니다. Security Group에서 SSH 규칙의 Source를 `My IP`로 다시 선택하면 해결됩니다.
>
> **그래도 해결이 안 되는 경우 (최후의 수단):**  
> SSH 규칙의 Source를 임시로 `0.0.0.0/0`(Anywhere)으로 변경하여 접속을 시도합니다.  
> 접속이 되면 네트워크/IP 문제였던 것이고, 접속이 안 되면 다른 원인(2~6번)을 확인합니다.  
> 문제 해결 후 반드시 Source를 `My IP`로 되돌리세요. `0.0.0.0/0` 상태로 방치하면 보안 위험이 있습니다.

16. [[Add rule]] 버튼을 클릭하여 두 번째 규칙(HTTP)을 추가합니다:
    - **Type**: `HTTP`
    - **Port range**: `80` (자동 입력)
    - **Source**: `Anywhere-IPv4` (0.0.0.0/0)

17. [[Add rule]] 버튼을 클릭하여 세 번째 규칙(HTTPS)을 추가합니다:
    - **Type**: `HTTPS`
    - **Port range**: `443` (자동 입력)
    - **Source**: `Anywhere-IPv4` (0.0.0.0/0)

    <img src="/images/step1/1-2-step17-https-rule.png" alt="HTTPS 규칙 설정" class="guide-img-sm" />

18. [[Add rule]] 버튼을 클릭하여 네 번째 규칙(Spring Boot)을 추가합니다:
    - **Type**: `Custom TCP`
    - **Port range**: `8080`
    - **Source**: `Anywhere-IPv4` (0.0.0.0/0)

    <img src="/images/step1/1-2-step18-springboot-rule.png" alt="Spring Boot 규칙 설정" class="guide-img-sm" />

> [!NOTE]
> 포트 8080은 Spring Boot의 기본 포트입니다.  
> 개발/테스트 환경에서는 직접 접근을 허용하지만, 운영 환경에서는 ALB(Application Load Balancer)를 통해 80/443으로만 접근하도록 구성합니다.

19. **Outbound rules**는 기본값(All traffic, 0.0.0.0/0)을 유지합니다.

20. 하단의 **Tags** 섹션에서 [[Add new tag]]를 클릭하여 태그를 추가합니다:
    - `Name` = `my-ec2-sg`
    - `CreatedBy` = `admin-user`
    - `Step` = `step1`
    - `Session` = `1-2`

    <img src="/images/step1/1-2-step20-tags.png" alt="Tags 설정" class="guide-img-sm" />

> [!NOTE]
> Security Group은 VPC와 달리 Name tag 전용 입력 필드가 없습니다.  
> Tags 섹션에서 `Name` 키를 직접 추가해야 콘솔 목록에서 이름이 표시됩니다.

21. [[Create security group]] 버튼을 클릭합니다.

    <img src="/images/step1/1-2-step21-sg-created.png" alt="Security Group 생성 완료" class="guide-img-sm" />

> [!OUTPUT]
> Security Group이 생성되면 상세 페이지로 이동합니다. Inbound rules 탭에서 4개의 규칙이 표시되는지 확인합니다:  
> SSH (22) - My IP
> HTTP (80) - 0.0.0.0/0
> HTTPS (443) - 0.0.0.0/0
> Custom TCP (8080) - 0.0.0.0/0

✅ **태스크 완료**: EC2용 Security Group(`my-ec2-sg`)이 생성되었습니다.

## 태스크 3: RDS용 Security Group 생성

데이터베이스(RDS)에 적용할 Security Group을 생성합니다. MySQL 포트(3306)만 허용하며, Source를 EC2 Security Group으로 지정합니다.

> [!CONCEPT] Source를 Security Group으로 지정하는 이유
> IP 주소 대신 Security Group을 Source로 지정하면:
>
> - EC2 인스턴스의 IP가 변경되어도 규칙을 수정할 필요 없음
> - Auto Scaling으로 인스턴스가 추가되어도 자동으로 접근 허용
> - 해당 SG가 적용된 인스턴스만 접근 가능하므로 보안 강화
>
> 즉, "my-ec2-sg가 적용된 모든 인스턴스에서 3306 포트 접근 허용"이라는 의미입니다.

22. 왼쪽 메뉴에서 **Security groups**를 선택합니다.
23. [[Create security group]] 버튼을 클릭합니다.
24. **Basic details** 섹션을 설정합니다:
    - **Security group name**: `my-rds-sg`
    - **Description**: `Security group for RDS MySQL instances`
    - **VPC**: `my-vpc` 선택

25. **Inbound rules** 섹션에서 [[Add rule]] 버튼을 클릭합니다.
26. MySQL 접근 규칙을 설정합니다:
    - **Type**: `MYSQL/Aurora`
    - **Port range**: `3306` (자동 입력)
    - **Source**: `Custom` 선택 → 검색창에 `my-ec2-sg` 입력 → 해당 Security Group 선택

    <img src="/images/step1/1-2-step26-rds-rule.png" alt="RDS MySQL 규칙 설정" class="guide-img-sm" />

> [!TIP]
> Source 검색창에 Security Group 이름을 입력하면 자동완성됩니다. `sg-` 로 시작하는 ID가 표시되면 올바르게 선택된 것입니다.

27. **Outbound rules**는 기본값(All traffic, 0.0.0.0/0)을 유지합니다.

28. 하단의 **Tags** 섹션에서 [[Add new tag]]를 클릭하여 태그를 추가합니다:
    - `Name` = `my-rds-sg`
    - `CreatedBy` = `admin-user`
    - `Step` = `step1`
    - `Session` = `1-2`

    <img src="/images/step1/1-2-step28-rds-tags.png" alt="RDS SG Tags 설정" class="guide-img-sm" />

29. [[Create security group]] 버튼을 클릭합니다.

    <img src="/images/step1/1-2-step29-rds-sg-created.png" alt="RDS Security Group 생성 완료" class="guide-img-sm" />

> [!OUTPUT]
> RDS Security Group이 생성됩니다.  
> Inbound rules에서 Source가 sg-xxxxxxxx (my-ec2-sg의 ID)로 표시되는지 확인합니다.

✅ **태스크 완료**: RDS용 Security Group(`my-rds-sg`)이 생성되었습니다.

## 태스크 4: Security Group 규칙 확인 및 테스트

생성된 Security Group의 규칙을 최종 확인합니다.

<img src="/images/architecture/step1-2-sg-architecture.png" alt="Step 1-2 최종 Security Group 아키텍처" class="guide-img-lg" />

30. Security groups 목록에서 `my-ec2-sg`를 선택합니다.

    <img src="/images/step1/1-2-step30-sg-list.png" alt="Security Groups 목록" class="guide-img-sm" />
31. **Inbound rules** 탭에서 4개의 규칙이 올바른지 확인합니다.

    <img src="/images/step1/1-2-step21-sg-created.png" alt="EC2 SG Inbound rules 확인" class="guide-img-sm" />
32. **Outbound rules** 탭에서 All traffic이 허용되어 있는지 확인합니다.

    <img src="/images/step1/1-2-step32-outbound-rules.png" alt="Outbound rules 확인" class="guide-img-sm" />
33. Security groups 목록으로 돌아가서 `my-rds-sg`를 선택합니다.
34. **Inbound rules** 탭에서 MySQL/Aurora(3306) 규칙의 Source가 `my-ec2-sg`의 SG ID인지 확인합니다.

    <img src="/images/step1/1-2-step34-rds-inbound.png" alt="RDS SG Inbound rules 확인" class="guide-img-sm" />

> [!CONCEPT] Stateful 동작 확인
> Security Group은 **Stateful**(상태를 기억함)이므로, 한쪽 방향을 허용하면 그 응답은 반대쪽 규칙과 무관하게 자동 허용됩니다.
>
> **예시 1: EC2가 외부 API를 호출하는 경우**
>
> ```
> EC2 → 외부 API (아웃바운드)
>   → 아웃바운드 규칙: All traffic 허용 → 통과 ✓
>   → SG가 이 연결을 기억함
>
> 외부 API → EC2 (응답, 인바운드)
>   → 인바운드에 해당 포트 규칙이 없음
>   → 하지만 SG가 "이건 아까 나간 요청의 응답이다"라고 기억 → 자동 허용 ✓
> ```
>
> **예시 2: 클라이언트가 EC2 웹서버에 접속하는 경우**
>
> ```
> 클라이언트 → EC2 포트 80 (인바운드)
>   → 인바운드 규칙: HTTP(80) 0.0.0.0/0 허용 → 통과 ✓
>   → SG가 이 연결을 기억함
>
> EC2 → 클라이언트 (응답, 아웃바운드)
>   → 아웃바운드에 포트 80 규칙을 별도로 만들지 않았음
>   → 하지만 SG가 "이건 아까 들어온 요청의 응답이다"라고 기억 → 자동 허용 ✓
> ```
>
> **예시 3: EC2 → RDS 접속 (SG 체이닝)**
>
> ```
> EC2 (my-ec2-sg) → RDS 포트 3306 (아웃바운드)
>   → EC2의 SG 아웃바운드: All traffic 허용 → 통과 ✓
>   → RDS의 SG 인바운드: 3306 from my-ec2-sg 허용 → 통과 ✓
>   → 양쪽 SG가 이 연결을 기억함
>
> RDS → EC2 (쿼리 결과 응답)
>   → RDS의 SG: Stateful이므로 응답 자동 허용 ✓
>   → EC2의 SG: Stateful이므로 응답 자동 허용 ✓
> ```
>
> **핵심**: Stateful 덕분에 아웃바운드 규칙을 세밀하게 설정하지 않아도 정상 통신이 됩니다. 기본 아웃바운드(All traffic 허용)를 그대로 두는 이유이기도 합니다.

### 최종 구성 요약

| Security Group | 포트              | Source    | 용도            |
| -------------- | ----------------- | --------- | --------------- |
| my-ec2-sg      | 22 (SSH)          | My IP     | 관리자 SSH 접속 |
| my-ec2-sg      | 80 (HTTP)         | 0.0.0.0/0 | 웹 서비스       |
| my-ec2-sg      | 443 (HTTPS)       | 0.0.0.0/0 | 웹 서비스 (SSL) |
| my-ec2-sg      | 8080 (Custom TCP) | 0.0.0.0/0 | Spring Boot     |
| my-rds-sg      | 3306 (MySQL)      | my-ec2-sg | EC2에서 DB 접근 |

✅ **태스크 완료**: Security Group 구성이 확인되었습니다.

## 마무리

다음을 성공적으로 수행했습니다:

- Security Group의 Stateful 특성과 동작 원리를 이해했습니다.
- EC2용 Security Group을 생성하고 SSH, HTTP, HTTPS, 8080 포트를 허용했습니다.
- RDS용 Security Group을 생성하고 Source를 EC2 SG로 지정했습니다.
- 기본 SG와 커스텀 SG의 차이를 이해했습니다.

# 🗑️ 리소스 정리

> [!NOTE]
> 이 실습에서 생성한 리소스(Security Group, VPC)는 모두 **항상 무료**입니다.  
> 다음 실습(Step 2: EC2)을 바로 이어서 진행하는 경우 삭제하지 않고 유지합니다.  
> 실습을 중단하거나 처음부터 다시 하고 싶은 경우에만 삭제하세요.

---

### 옵션 A: 다음 실습을 이어서 진행하는 경우 (권장)

Security Group과 VPC는 이후 실습(Step 2: EC2, Step 3: NAT, Step 4: RDS)에서 계속 사용합니다.  
**삭제하지 않고 그대로 유지합니다.**

> [!TIP]
> Security Group과 VPC는 항상 무료이므로 유지해도 비용이 발생하지 않습니다.  
> 다음 실습에서 이 리소스를 그대로 활용합니다.

---

### 옵션 B: 리소스를 삭제하는 경우

실습을 중단하거나 환경을 초기화하고 싶은 경우, 아래 순서대로 삭제합니다.

> [!WARNING]
> Security Group은 다른 리소스가 참조하고 있으면 삭제할 수 없습니다.  
> 반드시 **의존 관계 역순**으로 삭제해야 합니다.
>
> ```
> 삭제 순서: RDS SG → EC2 SG → VPC
> (my-rds-sg가 my-ec2-sg를 참조하므로 rds-sg를 먼저 삭제)
> ```

**단계 1: Tag Editor로 생성된 리소스 확인**

1. AWS Management Console 상단 검색창에 `Resource Groups & Tag Editor`를 입력하고 선택합니다.
2. 왼쪽 메뉴에서 **Tag Editor**를 선택합니다.
3. 다음과 같이 설정합니다:
   - **Regions**: `ap-northeast-2`
   - **Resource types**: `All supported resource types`
   - **Tags**: Tag key = `Session`, Tag value = `1-2`
4. [[Search resources]] 버튼을 클릭합니다.

    <img src="/images/step1/1-2-cleanup4-tag-editor.png" alt="Tag Editor 검색 결과" class="guide-img-sm" />

5. 이 실습에서 생성한 리소스(VPC, Subnet, IGW, Route Table, Security Group 2개)가 표시되는지 확인합니다.

**단계 2: RDS용 Security Group 삭제**

6. 상단 검색창에 `VPC`를 입력하고 VPC 서비스를 선택합니다.
7. 왼쪽 메뉴에서 **Security groups**를 선택합니다.
8. 상단 필터에서 `my-vpc`로 필터링합니다.
9. `my-rds-sg`를 선택합니다.
10. **Actions** → [[Delete security groups]]를 선택합니다.

    <img src="/images/step1/1-2-cleanup10-delete-rds-sg.png" alt="Delete security groups 선택" class="guide-img-sm" />

11. 확인 팝업에서 [[Delete]]를 클릭합니다.

    <img src="/images/step1/1-2-cleanup11-confirm-delete.png" alt="삭제 확인" class="guide-img-sm" />

> [!NOTE]
> `my-rds-sg`는 인바운드 규칙에서 `my-ec2-sg`를 Source로 참조하고 있습니다.  
> `my-ec2-sg`를 먼저 삭제하려고 하면 "resource has a dependent object" 오류가 발생합니다.  
> 반드시 `my-rds-sg`를 먼저 삭제하세요.

**단계 3: EC2용 Security Group 삭제**

12. `my-ec2-sg`를 선택합니다.
13. **Actions** → [[Delete security groups]]를 선택합니다.
14. 확인 팝업에서 [[Delete]]를 클릭합니다.

> [!NOTE]
> EC2 인스턴스가 이 Security Group을 사용 중이면 삭제가 실패합니다.  
> 해당 인스턴스를 먼저 Terminate하거나, 인스턴스의 Security Group을 다른 것으로 변경한 뒤 삭제하세요.

**단계 4: VPC 삭제 (선택)**

VPC와 서브넷, IGW, Route Table까지 모두 정리하려면 VPC를 삭제합니다.

15. 왼쪽 메뉴에서 **Your VPCs**를 선택합니다.
16. `my-vpc`를 선택합니다.
17. **Actions** → [[Delete VPC]]를 선택합니다.
18. 확인 팝업에서 `delete`를 입력하고 [[Delete]]를 클릭합니다.

> [!NOTE]
> VPC 삭제 시 서브넷, Route Table, IGW, 기본 Security Group, 기본 NACL이 함께 삭제됩니다.  
> 커스텀 Security Group(`my-ec2-sg`, `my-rds-sg`)은 위 단계에서 이미 삭제했으므로 문제 없습니다.

**단계 5: Tag Editor로 최종 확인**

19. 다시 **Tag Editor**로 이동합니다.
20. `Session: 1-2`로 검색합니다.
21. 검색 결과에 리소스가 표시되지 않으면 모든 리소스가 성공적으로 삭제된 것입니다.

> [!NOTE]
> 삭제 직후에는 일부 리소스가 잠시 남아있을 수 있으나, 시간이 지나면 자동으로 사라집니다.

✅ **실습 종료**: 모든 리소스가 정리되었습니다.

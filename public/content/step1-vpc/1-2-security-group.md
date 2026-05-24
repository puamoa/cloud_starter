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

이 실습에서는 EC2 인스턴스와 RDS 인스턴스에 적용할 Security Group을 생성합니다. Security Group은 인스턴스 레벨의 가상 방화벽으로, 인바운드/아웃바운드 트래픽을 제어합니다.

> [!NOTE]
> 이 실습은 VPC가 필요합니다. Step 1-1에서 생성한 VPC(`my-vpc`)를 사용하거나, 기존에 보유한 VPC를 사용합니다.

## 태스크 0: 선행 리소스 확인

1. AWS Management Console에 로그인합니다.
2. 리전을 **Asia Pacific (Seoul) ap-northeast-2**로 설정합니다.
3. 상단 검색창에 `VPC`를 입력하고 VPC 서비스를 선택합니다.
4. 왼쪽 메뉴에서 **Your VPCs**를 선택합니다.
5. 사용할 VPC가 있는지 확인합니다.

> [!TIP]
> VPC가 없다면 Step 1-1을 먼저 진행하거나, VPC 콘솔에서 [[Create VPC]] → `VPC and more`를 선택하여 기본 구성을 빠르게 생성할 수 있습니다.

✅ **태스크 완료**: 선행 리소스가 확인되었습니다.

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
> 기본 Security Group은 수정은 가능하지만 삭제할 수 없습니다. 실무에서는 기본 SG를 사용하지 않고, 용도별로 커스텀 SG를 생성하는 것이 보안 모범 사례입니다.

✅ **태스크 완료**: Security Group의 개념과 특성을 이해했습니다.

## 태스크 2: EC2용 Security Group 생성

웹 서버(EC2)에 적용할 Security Group을 생성합니다. SSH, HTTP, HTTPS, Spring Boot(8080) 포트를 허용합니다.

6. 왼쪽 메뉴에서 **Security groups**를 선택합니다.
7. [[Create security group]] 버튼을 클릭합니다.
8. **Basic details** 섹션을 설정합니다:
   - **Security group name**: `my-ec2-sg`
   - **Description**: `Security group for web server EC2 instances`
   - **VPC**: `my-vpc` 선택

9. **Inbound rules** 섹션에서 [[Add rule]] 버튼을 클릭합니다.
10. 첫 번째 규칙(SSH)을 설정합니다:
    - **Type**: `SSH`
    - **Port range**: `22` (자동 입력)
    - **Source**: `My IP` 선택

> [!WARNING]
> SSH Source를 `0.0.0.0/0`(Anywhere)으로 설정하면 전 세계에서 SSH 접속을 시도할 수 있습니다. 반드시 `My IP`를 선택하여 본인의 IP만 허용하세요. IP가 변경되면 규칙을 업데이트해야 합니다.

11. [[Add rule]] 버튼을 클릭하여 두 번째 규칙(HTTP)을 추가합니다:
    - **Type**: `HTTP`
    - **Port range**: `80` (자동 입력)
    - **Source**: `Anywhere-IPv4` (0.0.0.0/0)

12. [[Add rule]] 버튼을 클릭하여 세 번째 규칙(HTTPS)을 추가합니다:
    - **Type**: `HTTPS`
    - **Port range**: `443` (자동 입력)
    - **Source**: `Anywhere-IPv4` (0.0.0.0/0)

13. [[Add rule]] 버튼을 클릭하여 네 번째 규칙(Spring Boot)을 추가합니다:
    - **Type**: `Custom TCP`
    - **Port range**: `8080`
    - **Source**: `Anywhere-IPv4` (0.0.0.0/0)

> [!NOTE]
> 포트 8080은 Spring Boot의 기본 포트입니다. 개발/테스트 환경에서는 직접 접근을 허용하지만, 운영 환경에서는 ALB(Application Load Balancer)를 통해 80/443으로만 접근하도록 구성합니다.

14. **Outbound rules**는 기본값(All traffic, 0.0.0.0/0)을 유지합니다.
15. [[Create security group]] 버튼을 클릭합니다.

> [!OUTPUT]
> Security Group이 생성되면 상세 페이지로 이동합니다. Inbound rules 탭에서 4개의 규칙이 표시되는지 확인합니다:
>
> - SSH (22) - My IP
> - HTTP (80) - 0.0.0.0/0
> - HTTPS (443) - 0.0.0.0/0
> - Custom TCP (8080) - 0.0.0.0/0

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

16. 왼쪽 메뉴에서 **Security groups**를 선택합니다.
17. [[Create security group]] 버튼을 클릭합니다.
18. **Basic details** 섹션을 설정합니다:
    - **Security group name**: `my-rds-sg`
    - **Description**: `Security group for RDS MySQL instances`
    - **VPC**: `my-vpc` 선택

19. **Inbound rules** 섹션에서 [[Add rule]] 버튼을 클릭합니다.
20. MySQL 접근 규칙을 설정합니다:
    - **Type**: `MYSQL/Aurora`
    - **Port range**: `3306` (자동 입력)
    - **Source**: `Custom` 선택 → 검색창에 `my-ec2-sg` 입력 → 해당 Security Group 선택

> [!TIP]
> Source 검색창에 Security Group 이름을 입력하면 자동완성됩니다. `sg-` 로 시작하는 ID가 표시되면 올바르게 선택된 것입니다.

21. **Outbound rules**는 기본값(All traffic, 0.0.0.0/0)을 유지합니다.
22. [[Create security group]] 버튼을 클릭합니다.

> [!OUTPUT]
> RDS Security Group이 생성됩니다.
> Inbound rules에서 Source가 sg-xxxxxxxx (my-ec2-sg의 ID)로 표시되는지 확인합니다.

✅ **태스크 완료**: RDS용 Security Group(`my-rds-sg`)이 생성되었습니다.

## 태스크 4: Security Group 규칙 확인 및 테스트

생성된 Security Group의 규칙을 최종 확인합니다.

23. Security groups 목록에서 `my-ec2-sg`를 선택합니다.
24. **Inbound rules** 탭에서 4개의 규칙이 올바른지 확인합니다.
25. **Outbound rules** 탭에서 All traffic이 허용되어 있는지 확인합니다.
26. Security groups 목록으로 돌아가서 `my-rds-sg`를 선택합니다.
27. **Inbound rules** 탭에서 MySQL/Aurora(3306) 규칙의 Source가 `my-ec2-sg`의 SG ID인지 확인합니다.

> [!CONCEPT] Stateful 동작 확인
> Security Group은 Stateful이므로:
>
> 1. EC2에서 외부 API를 호출할 때 (아웃바운드 허용)
> 2. 그 응답이 돌아올 때 (인바운드에 규칙이 없어도 자동 허용)
>
> 반대로:
>
> 1. 외부에서 EC2의 80 포트로 요청할 때 (인바운드 허용)
> 2. EC2가 응답을 보낼 때 (아웃바운드에 80 규칙이 없어도 자동 허용)

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
> 이 실습에서 생성한 리소스는 모두 무료이므로 삭제하지 않아도 비용이 발생하지 않습니다.

---

### 단계 1: 리소스 유지 권장

Security Group은 이후 실습(EC2, RDS)에서 계속 사용합니다. **유지하는 것을 권장합니다.**

> [!NOTE]
> Security Group은 프리티어와 무관하게 **항상 무료**인 리소스입니다. VPC당 최대 2,500개까지 생성할 수 있으므로 학습용으로 유지해도 문제 없습니다.

---

### 단계 2: 삭제 방법 (모든 실습 완료 후)

Security Group은 다른 리소스가 참조하고 있으면 삭제할 수 없습니다. 반드시 의존 관계를 먼저 해제하세요.

1. Security Group을 사용하는 리소스(EC2, RDS 등)를 먼저 삭제합니다.
2. VPC 콘솔 → **Security groups** → `my-rds-sg` 선택 → **Actions** → [[Delete security groups]] → 확인

> [!NOTE]
> `my-rds-sg`는 Source로 `my-ec2-sg`를 참조하고 있으므로, `my-ec2-sg`보다 먼저 삭제해야 합니다.

3. `my-ec2-sg` 선택 → **Actions** → [[Delete security groups]] → 확인

---

### 단계 3: 삭제 확인

1. Security groups 목록에서 `my-ec2-sg`와 `my-rds-sg`가 없는지 확인합니다.

✅ **실습 종료**: 모든 리소스가 정리되었습니다.

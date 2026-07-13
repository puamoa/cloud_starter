---
title: 'Application Load Balancer 생성 및 Target Group 구성'
week: 7
session: 2
awsServices:
  - Elastic Load Balancing
  - Amazon EC2
learningObjectives:
  - Application Load Balancer의 개념과 동작 원리를 이해할 수 있습니다.
  - Target Group을 생성하고 EC2 인스턴스를 등록할 수 있습니다.
  - Health Check를 설정하여 비정상 인스턴스를 자동 제외할 수 있습니다.
  - ALB를 통해 여러 EC2에 트래픽을 분산할 수 있습니다.
  - Security Group을 활용하여 EC2 직접 접근을 차단할 수 있습니다.
prerequisites:
  - AWS 계정 생성 완료
  - VPC + Public Subnet 2개 (서로 다른 AZ) 필요
  - EC2 인스턴스 1개 이상 (Spring Boot 또는 Nginx 실행 중)
estimatedCost: 비용 발생 (ALB 시간당 + EC2 시간당 과금, 무료 플랜 적용 여부에 따라 다름)
---

이 실습에서는 Application Load Balancer(ALB)를 생성하고, Target Group을 구성하여
Amazon EC2 인스턴스에 트래픽을 분산하는 방법을 학습합니다.  
Health Check를 통해 비정상 인스턴스를 자동으로 제외하는 과정도 확인합니다.

### Step 7 전체 구성

| 세션                | 주제               | 핵심 리소스                     |
| ------------------- | ------------------ | ------------------------------- |
| 7-1                 | Route 53 + ACM     | 도메인 연결, HTTPS 인증서       |
| **7-2 (이번 실습)** | ALB + Target Group | 트래픽 분산, Health Check       |
| 7-3                 | Auto Scaling Group | 자동 확장/축소, Launch Template |

```
7-1: 도메인 + HTTPS     →    7-2: ALB 생성 + 도메인 연결  →    7-3: ASG로 자동 확장
(수동 EC2 등록)           (커스텀 도메인 + SSL)          (EC2 자동 생성/삭제)
```

> [!NOTE]
> 이 실습에는 VPC, Public Subnet 2개(서로 다른 AZ), Amazon EC2 인스턴스가 필요합니다.  
> 기존 리소스가 있으면 그대로 사용하고, 없으면 태스크 0의 AWS CloudFormation 템플릿으로 생성합니다.

### 실습 흐름

```
[선행 리소스 확인] → [ALB 개념] → [Target Group 생성] → [EC2 등록] → [ALB 생성] → [동작 확인] → [보안 강화]
```

---

## 태스크 0: 선행 리소스 확인

> [!DOWNLOAD]
> [step7-2-alb-lab.zip](/files/step7/step7-2-alb-lab.zip)
>
> - `step7-2-alb-prereq.yaml` — AWS CloudFormation 템플릿 (VPC, 서브넷, IGW, EC2, Security Group 자동 생성)
> - `README.md` — 템플릿 파라미터 및 사용 방법 안내

### 필요한 리소스 체크리스트

| 리소스              | 요구 사항                                      | 확인 |
| ------------------- | ---------------------------------------------- | ---- |
| VPC                 | 1개                                            | ☐    |
| Public Subnet       | 2개 (서로 다른 AZ, 예: 2a + 2c)                | ☐    |
| Internet Gateway    | VPC에 연결됨                                   | ☐    |
| Amazon EC2 인스턴스 | 2개 (서로 다른 AZ에 1개씩, HTTP 200 응답)      | ☐    |
| Security Group      | EC2에 SSH(22) + 애플리케이션 포트 Inbound 허용 | ☐    |

> [!TIP]
> 이전 차시(Step 1~6)에서 생성한 VPC와 Amazon EC2가 남아있다면 그대로 사용할 수 있습니다.  
> 단, **Public Subnet이 서로 다른 2개 AZ**에 있어야 합니다.  
> ALB는 최소 2개 AZ에 배치해야 하기 때문입니다.  
> 기존 리소스가 있어도 간단히 테스트하고 싶다면 태스크 0의 CloudFormation을 실행해도 좋습니다.  
> 별도 VPC가 생성되므로 기존 환경에 영향을 주지 않습니다.

### 리소스가 없는 경우: AWS CloudFormation으로 생성

다운로드한 `step7-2-alb-prereq.yaml` 파일을 사용하면 필요한 리소스를 한 번에 생성할 수 있습니다.

1. AWS Management Console에 로그인합니다.
2. 리전을 **Asia Pacific (Seoul) ap-northeast-2**로 설정합니다.

<img src="/images/common/region-check.png" alt="리전 확인" class="guide-img-sm" />

> [!TIP]
> 일부 AWS 서비스(IAM, CloudFront, Route 53 등)는 **글로벌 서비스**이므로 리전 선택 드롭다운이 비활성화되거나 "Global"로 표시됩니다.  
> 이 실습에서 사용하는 서비스는 리전 기반이므로 반드시 올바른 리전이 선택되어 있는지 확인하세요.

3. 상단 검색창에 `CloudFormation`을 입력하고 **CloudFormation** 서비스를 선택합니다.
4. [[Create stack]] 드롭다운을 클릭한 후 **With new resources (standard)**를 선택합니다.
5. **Prerequisite - Prepare template**에서 `Choose an existing template`을 선택합니다.
6. **Specify template**에서 `Upload a template file`을 선택합니다.
7. [[Choose file]] 버튼을 클릭하고 다운로드한 `step7-2-alb-prereq.yaml` 파일을 선택합니다.
8. [[Next]] 버튼을 클릭합니다.

9. **Stack name**에 `step7-2-alb-prereq`를 입력합니다.
10. **Parameters** 섹션에서 다음을 설정합니다:
    - **ProjectName**: `alb-lab` (기본값)
    - **KeyPairName**: 기존 Key Pair를 선택합니다 (SSH 접속용).
    - **AppPort**: `80` (기본값, Nginx)
    - **SSHAccessCidr**: `0.0.0.0/0` (기본값) — 보안을 위해 본인 IP(`x.x.x.x/32`)로 변경을 권장합니다.
    - 나머지 파라미터: 기본값 유지

> [!TIP]
> **AppPort 설명:**
>
> | 값   | 설명                                               |
> | ---- | -------------------------------------------------- |
> | 80   | Nginx 기본 포트 (이 실습의 기본값)                 |
> | 8080 | 이전 차시에서 Spring Boot를 사용한 EC2가 있는 경우 |
>
> AWS CloudFormation으로 새로 만드는 경우 Nginx가 설치되므로 80(기본값)을 유지합니다.

11. [[Next]] 버튼을 클릭합니다.
12. **Configure stack options** 페이지에서 추가 설정 없이 [[Next]] 버튼을 클릭합니다.
13. **Review and create** 페이지에서 설정 내용을 확인합니다.
14. [[Submit]] 버튼을 클릭합니다.
15. 스택 상태가 `CREATE_COMPLETE`가 될 때까지 기다립니다 (약 2~3분).

> [!WARNING]
> 스택 생성에 2~3분이 소요됩니다. `CREATE_COMPLETE` 상태가 될 때까지 기다리세요.  
> `CREATE_FAILED`가 표시되면 **Events** 탭에서 실패 원인을 확인합니다.

> [!TIP]
> **왜 Amazon EC2를 미리 2대 세팅하나요?**  
> Amazon EC2를 직접 만들어도 되지만, 이 실습의 주 목적은 **ALB와 Target Group을 이해하는 것**입니다.  
> VPC/EC2 생성에 시간을 쓰기보다, AWS CloudFormation으로 빠르게 환경을 준비하고 ALB 구성에 집중합니다.

> [!NOTE]
> AWS CloudFormation 템플릿의 주요 파라미터:
>
> | 파라미터             | 기본값         | 설명                               |
> | -------------------- | -------------- | ---------------------------------- |
> | `ProjectName`        | `alb-lab`      | 리소스 이름 접두사                 |
> | `VpcCidr`            | `10.0.0.0/16`  | VPC CIDR 블록                      |
> | `PublicSubnetACidr`  | `10.0.1.0/24`  | Public Subnet 1 (ap-northeast-2a)  |
> | `PublicSubnetCCidr`  | `10.0.2.0/24`  | Public Subnet 2 (ap-northeast-2c)  |
> | `PrivateSubnetACidr` | `10.0.11.0/24` | Private Subnet 1 (ap-northeast-2a) |
> | `PrivateSubnetCCidr` | `10.0.12.0/24` | Private Subnet 2 (ap-northeast-2c) |
> | `SSHAccessCidr`      | `0.0.0.0/0`    | SSH 접근 허용 IP (본인 IP 권장)    |
>
> 기본값을 변경하면 이후 가이드의 리소스 이름이 달라질 수 있습니다.  
> Private Subnet은 이 실습에서 직접 사용하지 않지만, 이전 차시와 동일한 VPC 구성을 유지하기 위해 포함됩니다.

✅ **태스크 완료** — 선행 리소스를 확인하거나 AWS CloudFormation으로 생성했습니다.

> [!CONCEPT] CloudFormation UserData — EC2 자동 세팅
>
> 스택이 생성한 EC2 2대에는 **UserData** 스크립트로 다음이 자동 설치·설정됩니다:
>
> - **Nginx 설치** + AppPort(기본 80)에서 리스닝
> - **인스턴스 식별 페이지 생성** — 인스턴스 ID, AZ, Private IP를 표시하는 HTML 페이지
>   - EC2 #1: 파란색 배경 (AZ-a)
>   - EC2 #2: 초록색 배경 (AZ-c)
>   - ALB를 통해 접속 시 새로고침하면 다른 인스턴스가 응답하는 것을 눈으로 확인할 수 있습니다.
> - **Health Check 엔드포인트** (`/health/`) — HTTP 200을 반환하여 ALB Health Check에 응답
>
> **메타데이터 조회 방식 (IMDSv2):**
>
> ```bash
> # 토큰 발급 후 메타데이터 조회 (보안 강화된 방식)
> TOKEN=$(curl -s -X PUT "http://169.254.169.254/latest/api/token" \
>   -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")
> INSTANCE_ID=$(curl -s -H "X-aws-ec2-metadata-token: $TOKEN" \
>   http://169.254.169.254/latest/meta-data/instance-id)
> ```
>
> EC2는 `169.254.169.254` 주소로 자기 자신의 메타데이터(인스턴스 ID, AZ, IP 등)를 조회할 수 있습니다.  
> 상세 내용은 다운로드한 `README.md` 파일을 참고하세요.

---

## 태스크 1: ALB 개념 이해

### 단일 Amazon EC2의 한계

현재 구성에서는 사용자가 Amazon EC2의 Public IP로 직접 접속합니다:

```
사용자 → EC2 Public IP:80   → Nginx
              또는
사용자 → EC2 Public IP:8080 → Spring Boot
```

이 구성의 문제점:

- Amazon EC2가 다운되면 서비스 전체가 중단됩니다.
- 트래픽이 증가해도 하나의 인스턴스가 모든 요청을 처리해야 합니다.
- EC2를 교체하면 IP가 변경되어 DNS 수정이 필요합니다.

### 현재 상태 확인

16. AWS CloudFormation 콘솔 → Stacks → `step7-2-alb-prereq` → **Outputs** 탭을 클릭합니다.
17. `EC2Instance1PublicIP`의 값을 복사합니다.
18. 브라우저에서 `http://<복사한 IP>`로 접속합니다.
    - 인스턴스 식별 페이지(파란색 배경, Instance ID, AZ 표시)가 표시되면 정상입니다.
    - 이것이 현재 상태 — 사용자가 EC2 Public IP로 직접 접속하는 구성입니다.

### ALB를 사용한 구성

```
                   ┌─── EC2 #1 (AZ-a)
사용자 → ALB DNS → │
                   └─── EC2 #2 (AZ-c)
```

ALB를 사용하면:

- 여러 Amazon EC2에 트래픽을 자동 분산합니다.
- 비정상 인스턴스를 자동으로 제외합니다 (Health Check).
- 고정된 DNS Name을 제공합니다 (EC2 교체해도 변경 없음).
- HTTPS 인증서를 ALB에 설치하여 SSL 종료가 가능합니다.

### ALB 구성 요소

```
ALB
├── Listener (HTTP:80 또는 HTTPS:443)
│   └── Rule (조건에 따라 라우팅)
│       └── Action (Target Group으로 전달)
└── Target Group
    ├── EC2 #1 (healthy)
    ├── EC2 #2 (healthy)
    └── EC2 #3 (unhealthy → 트래픽 제외)
```

| 구성 요소        | 역할                                                  |
| ---------------- | ----------------------------------------------------- |
| **Listener**     | 특정 포트/프로토콜로 들어오는 요청을 수신합니다       |
| **Rule**         | 요청 조건(경로, 호스트 등)에 따라 라우팅을 결정합니다 |
| **Target Group** | 실제 요청을 처리할 대상(EC2) 그룹입니다               |
| **Health Check** | 대상의 정상 여부를 주기적으로 확인합니다              |

> [!CONCEPT] L4 vs L7 로드밸런서
>
> - **NLB (Network Load Balancer)**: L4 (TCP/UDP 레벨). 초고성능, 고정 IP를 지원합니다.
> - **ALB (Application Load Balancer)**: L7 (HTTP/HTTPS 레벨). 경로 기반 라우팅, 호스트 기반 라우팅을 지원합니다.
>
> 웹 애플리케이션에는 ALB가 적합합니다.  
> URL 경로(`/api/*`, `/static/*`)나 호스트명(`api.example.com`, `www.example.com`)에 따라 다른 서버로 라우팅할 수 있습니다.

✅ **태스크 완료** — ALB의 개념과 구성 요소를 이해했습니다.

---

## 태스크 2: Target Group 생성

Target Group은 ALB가 트래픽을 전달할 대상(Amazon EC2 인스턴스)의 그룹입니다.  
먼저 Target Group을 생성하고, 다음 태스크에서 EC2를 등록합니다.

### Target Group 생성 단계

19. 상단 검색창에 `EC2`를 입력하고 **EC2** 서비스를 선택합니다.
20. 왼쪽 메뉴에서 **Load Balancing** → **Target Groups**를 클릭합니다.
    - 왼쪽 메뉴가 보이지 않으면 좌측 상단의 햄버거 버튼(☰)을 클릭하여 메뉴를 펼칩니다.
21. [[Create target group]]을 클릭합니다.

### Step 1: Specify group details

**Basic configuration** 섹션을 설정합니다:

22. **Choose a target type** — 타겟의 종류를 선택합니다:
    - **Instances** 선택
    - 다른 옵션(IP addresses, Lambda function, Application Load Balancer)은 이 실습에서 사용하지 않습니다.
23. **Target group name** — Target Group의 이름을 입력합니다:
    - `starter-app-tg`를 입력합니다.
24. **Protocol : Port** — ALB가 타겟에 요청을 전달할 때 사용하는 프로토콜과 포트입니다:
    - **Protocol**: `HTTP`를 선택합니다.
    - **Port**: 애플리케이션이 실행 중인 포트를 입력합니다.

> [!NOTE]
> Port는 Amazon EC2에서 애플리케이션이 실행 중인 포트를 입력합니다.
>
> | 애플리케이션 | Port | 설명                   |
> | ------------ | ---- | ---------------------- |
> | Spring Boot  | 8080 | Spring Boot 기본 포트  |
> | Nginx        | 80   | Nginx/Apache 기본 포트 |
>
> 본인의 애플리케이션에 맞는 포트를 입력하세요.

25. **IP address type**: `IPv4`를 선택합니다.
26. **VPC** — Target Group이 속할 VPC를 선택합니다:
    - 실습용 VPC를 선택합니다 (예: `alb-lab-vpc`).
    - 드롭다운에 여러 VPC가 표시되면, 이름 태그를 확인하여 올바른 VPC를 선택합니다.
27. **Protocol version**: `HTTP1`을 선택합니다 (기본값).

> [!TIP]
> **Protocol version 옵션:**
>
> | 버전  | 설명                                        |
> | ----- | ------------------------------------------- |
> | HTTP1 | 일반적인 HTTP/1.1 통신 (대부분의 앱에 적합) |
> | HTTP2 | 멀티플렉싱, 헤더 압축 지원 (gRPC 등에 사용) |
> | gRPC  | gRPC 프로토콜 전용                          |
>
> 이 실습에서는 Nginx/Spring Boot 기본 설정을 사용하므로 `HTTP1`을 선택합니다.

**Health checks** 섹션을 설정합니다:

28. **Health check protocol**: `HTTP`를 선택합니다.
29. **Health check path** — ALB가 타겟의 정상 여부를 확인하기 위해 요청을 보내는 경로입니다:
    - Health Check 경로를 입력합니다.

> [!TIP]
> **Health Check 경로:**
>
> | 환경                          | 경로               | 설명                              |
> | ----------------------------- | ------------------ | --------------------------------- |
> | CloudFormation으로 생성한 EC2 | `/health/`         | UserData가 자동 생성한 엔드포인트 |
> | Spring Boot (Actuator 사용)   | `/actuator/health` | Actuator 헬스 엔드포인트          |
> | Spring Boot (Actuator 미사용) | `/`                | 루트 경로                         |
>
> Health Check 경로는 **HTTP 200 응답**을 반환하는 엔드포인트여야 합니다.  
> CloudFormation으로 EC2를 생성한 경우 **`/health/`**를 입력하세요.

30. **Advanced health check settings**를 펼칩니다. 각 항목을 다음과 같이 설정합니다:
    - **Port**: Traffic port (기본값) — Target Group 포트와 동일한 포트로 Health Check를 수행합니다.
    - **Healthy threshold**: `3` — 연속 3회 성공하면 healthy로 판정합니다.
    - **Unhealthy threshold**: `2` — 연속 2회 실패하면 unhealthy로 판정합니다.
    - **Timeout**: `5` seconds — 5초 내에 응답이 없으면 실패로 간주합니다.
    - **Interval**: `30` seconds — 30초마다 Health Check를 수행합니다.
    - **Success codes**: `200` — HTTP 200 응답만 성공으로 판정합니다.

> [!CONCEPT] Health Check 동작 원리
>
> ALB는 설정된 간격(Interval)마다 각 타겟에 Health Check 요청을 보냅니다.
>
> ```
> ALB → GET /actuator/health → EC2:8080
>       ← HTTP 200 OK (healthy)
>       ← HTTP 503 또는 Timeout (unhealthy)
> ```
>
> - **Healthy threshold 3**: 3번 연속 200 응답 → healthy로 전환
> - **Unhealthy threshold 2**: 2번 연속 실패 → unhealthy로 전환, 트래픽 제외
> - **Interval 30초**: 30초마다 Health Check 수행
>
> 등록 직후 healthy까지 소요 시간: 약 30초 × 3 = **90초**

### Tags 추가

31. **Tags – optional** 섹션을 펼치고 [[Add new tag]]를 클릭하여 태그를 추가합니다:
    - **Key**: `CreatedBy`, **Value**: `admin-user`
    - **Key**: `Step`, **Value**: `step7`
    - **Key**: `Session`, **Value**: `7-1`

32. [[Next]]를 클릭합니다.

### Step 2: Register targets

33. 이 단계에서는 타겟을 등록하지 않고 [[Next]]를 클릭합니다.

> [!TIP]
> 여기서 바로 EC2를 등록할 수도 있지만, 이 실습에서는 **Target Group 생성과 타겟 등록을 분리**하여 진행합니다.  
> 각 단계의 역할을 명확히 이해하기 위해서입니다:
>
> - 태스크 2: Target Group **생성** (트래픽을 받을 그릇 만들기)
> - 태스크 3: Target Group에 EC2 **등록** (그릇에 대상 넣기)
>
> 실무에서는 이 화면에서 한 번에 등록해도 됩니다.

### Step 3: Review and create

34. 설정 내용을 확인합니다:
    - Target group details: `starter-app-tg`, HTTP:80, HTTP1
    - Health check details: `/health/`, Interval 30s, Healthy 3, Unhealthy 2
    - Register targets: Targets (0) — 등록하지 않았으므로 0개 정상
35. [[Create target group]]을 클릭합니다.
    - "Feedback for ELB Create Target Group" 팝업이 나타나면 ✕ 버튼으로 닫습니다.

> [!OUTPUT]
> Target Group이 생성되었습니다:
>
> ```
> Name: starter-app-tg
> Protocol/Port: HTTP:8080 (또는 HTTP:80)
> Health Check: /actuator/health (또는 /)
> Targets: 0개 (아직 등록하지 않음)
> ```

✅ **태스크 완료** — Target Group을 생성하고 Health Check를 설정했습니다.

---

## 태스크 3: Target Group에 EC2 등록

생성한 Target Group에 Amazon EC2 인스턴스를 타겟으로 등록합니다.

36. EC2 콘솔 왼쪽 메뉴에서 **Load Balancing** → **Target Groups**를 클릭합니다.
37. `starter-app-tg`를 클릭하여 상세 페이지로 이동합니다.
38. **Targets** 탭을 클릭합니다.
39. [[Register targets]]를 클릭합니다.

### Available instances에서 EC2 선택

40. **Available instances** 목록에서 등록할 Amazon EC2 인스턴스를 **2개 모두** 체크합니다.
    - AWS CloudFormation으로 생성한 경우: `alb-lab-ec2-1`과 `alb-lab-ec2-2`를 모두 선택합니다.
    - 기존 EC2를 사용하는 경우: 해당 인스턴스를 선택합니다.
41. **Ports for the selected instances**: 애플리케이션 포트를 확인합니다.
    - 기본적으로 Target Group 생성 시 설정한 포트(8080 또는 80)가 표시됩니다.
    - 변경할 필요가 없으면 그대로 둡니다.
42. [[Include as pending below]]를 클릭합니다.
    - 하단의 **Review targets** 영역에 선택한 인스턴스가 추가됩니다.
    - 여러 인스턴스를 등록하려면 40~42번을 반복합니다.
43. 하단 **Review targets**에서 등록할 인스턴스와 포트가 올바른지 확인합니다.
44. [[Register pending targets]]를 클릭합니다.

### Health Status 확인

45. Target Group 상세 → **Targets** 탭에서 등록된 인스턴스의 상태를 확인합니다.
    - 상태가 자동으로 새로고침되지 않으므로, 🔄 새로고침 버튼을 눌러 최신 상태를 확인합니다.

| Status        | 의미                                | 다음 행동                     |
| ------------- | ----------------------------------- | ----------------------------- |
| **unused**    | Target Group이 ALB에 연결되지 않음  | 태스크 4에서 ALB 생성 후 해결 |
| **initial**   | Health Check 진행 중 (최초 등록 후) | 90초 대기                     |
| **healthy**   | Health Check 성공, 트래픽 수신 가능 | 다음 태스크로 진행            |
| **unhealthy** | Health Check 실패, 트래픽 제외됨    | 아래 트러블슈팅 참고          |
| **draining**  | 등록 해제 중 (기존 연결 완료 대기)  | 잠시 대기                     |

> [!NOTE]
> 현재 단계에서는 Health status가 `Unused`로 표시됩니다.  
> 이는 Target Group이 아직 ALB에 연결되지 않았기 때문이며, 정상입니다.  
> 태스크 4에서 ALB를 생성하고 이 Target Group을 연결하면 Health Check가 시작됩니다.

> [!WARNING]
> ALB 연결 후 Status가 `unhealthy`로 표시되면 아래 트러블슈팅을 참고하세요.  
> 약 90초(30초 × Healthy threshold 3) 소요됩니다.  
> Status가 `unhealthy`로 표시되면 아래 트러블슈팅을 참고하세요.

✅ **태스크 완료** — Target Group에 Amazon EC2 인스턴스를 등록하고 Health Status를 확인했습니다.

> [!TIP]
> 이 태스크에서는 Target Group에 EC2를 **수동으로 등록**했습니다.  
> 인스턴스가 추가/제거될 때마다 직접 관리해야 하는 방식입니다.  
> Step 7-3에서 배울 **Auto Scaling Group**은 이 과정을 자동화합니다. — 인스턴스 생성 시 자동 등록, 종료 시 자동 해제

> [!TROUBLESHOOTING]
> | 증상 | 원인 | 해결 방법 |
> |------|------|-----------|
> | Status가 계속 `initial` | Health Check 간격 × Threshold 대기 중 | 90초 대기 후 🔄 새로고침 |
> | Status가 `unhealthy` | 앱이 실행되지 않음 | EC2에 SSH 접속 → `curl localhost:8080` (또는 `:80`) 확인 |
> | Status가 `unhealthy` | Health Check 경로 불일치 | Health Check 경로가 HTTP 200을 반환하는지 확인 |
> | Status가 `unhealthy` | Security Group에서 포트 미허용 | EC2 SG Inbound에 AppPort가 열려있는지 확인 |
> | "No targets registered" | Include as pending 미클릭 | [[Register targets]]에서 다시 등록 |

---

## 태스크 4: ALB 생성

이제 Application Load Balancer를 생성하여 Target Group과 연결합니다.  
ALB는 전용 Security Group이 필요하므로 먼저 생성합니다.

### ALB Security Group 생성

46. EC2 콘솔 왼쪽 메뉴에서 **Network & Security** → **Security Groups**를 클릭합니다.
47. [[Create security group]]을 클릭합니다.
48. **Basic details** 섹션을 설정합니다:
    - **Security group name**: `alb-sg`
    - **Description**: `Allow HTTP from internet to ALB`
    - **VPC**: 실습용 VPC를 선택합니다 (예: `alb-lab-vpc`).
      - ⚠️ 반드시 Target Group과 같은 VPC를 선택해야 합니다.
49. **Inbound rules** 섹션에서 [[Add rule]]을 2번 클릭하여 다음 규칙을 추가합니다:
    - **Type** 드롭다운에서 `HTTP`를 선택하면 Protocol과 Port range가 자동으로 설정됩니다.
    - **Source**에서 `Anywhere-IPv4` (= 0.0.0.0/0)를 선택합니다.
    - Description은 선택사항이지만, 규칙의 용도를 기록해두면 관리에 도움이 됩니다.

| Type  | Protocol | Port range | Source    | Description                 |
| ----- | -------- | ---------- | --------- | --------------------------- |
| HTTP  | TCP      | 80         | 0.0.0.0/0 | `Allow HTTP from anywhere`  |
| HTTPS | TCP      | 443        | 0.0.0.0/0 | `Allow HTTPS from anywhere` |

50. **Outbound rules** 섹션:
    - 기본값(All traffic, Destination: 0.0.0.0/0)을 유지합니다.
51. **Tags** 섹션에서 [[Add new tag]]를 클릭하여 태그를 추가합니다:
    - **Key**: `Name`, **Value**: `alb-sg`
    - **Key**: `CreatedBy`, **Value**: `admin-user`
    - **Key**: `Step`, **Value**: `step7`
    - **Key**: `Session`, **Value**: `7-1`

> [!TIP]
> `Name` 태그를 넣으면 Security Group 목록에서 **이름 컬럼**에 표시됩니다.  
> 태그 없이 생성하면 Security Group ID(`sg-xxx`)만 보여서 나중에 어떤 용도인지 구분하기 어렵습니다.

52. [[Create security group]]을 클릭합니다.

> [!OUTPUT]
> Security Group이 생성되었습니다:
>
> ```
> Name: alb-sg
> VPC: alb-lab-vpc
> Inbound: HTTP(80), HTTPS(443) from 0.0.0.0/0
> ```

> [!NOTE]
> ALB Security Group은 인터넷에서 들어오는 HTTP/HTTPS 트래픽을 허용합니다.  
> 이후 태스크 6에서 EC2 Security Group을 수정하여 "ALB → EC2"만 허용하도록 구성합니다.

### ALB 생성 단계

53. EC2 콘솔 왼쪽 메뉴에서 **Load Balancing** → **Load Balancers**를 클릭합니다.
54. [[Create load balancer]]를 클릭합니다.
55. 로드밸런서 유형 선택 화면에서 **Application Load Balancer** 섹션의 [[Create]]를 클릭합니다.
    - Network Load Balancer, Gateway Load Balancer는 이 실습에서 사용하지 않습니다.

### Basic configuration

56. **Load balancer name**: `starter-alb`를 입력합니다.
    - 이름은 영문, 숫자, 하이픈만 사용할 수 있습니다.
57. **Scheme** — ALB의 접근 범위를 결정합니다:
    - **Internet-facing** 선택 (인터넷에서 접근 가능)
    - Internal은 VPC 내부에서만 접근 가능하므로 이 실습에서는 선택하지 않습니다.
58. **Load balancer IP address type**: `IPv4`를 선택합니다 (기본값).

> [!CONCEPT] Internet-facing vs Internal
>
> - **Internet-facing**: 인터넷에서 접근 가능한 Public DNS Name이 부여됩니다. 웹 서비스에 사용합니다.
> - **Internal**: VPC 내부에서만 접근 가능합니다. 마이크로서비스 간 내부 통신에 사용합니다.
>
> 이 실습에서는 사용자가 브라우저로 접속해야 하므로 **Internet-facing**을 선택합니다.

### Network mapping

59. **VPC** — ALB가 배치될 VPC를 선택합니다:
    - 드롭다운에서 실습용 VPC를 선택합니다 (예: `vpc-xxx (alb-lab-vpc)`).
60. **Availability Zones and subnets** — ALB를 배치할 AZ를 선택합니다:
    - ✅ `ap-northeast-2a (apne2-az1)` 체크 → 드롭다운에서 **Public Subnet 1** 선택 (예: `alb-lab-public-subnet-1`)
    - ✅ `ap-northeast-2c (apne2-az3)` 체크 → 드롭다운에서 **Public Subnet 2** 선택 (예: `alb-lab-public-subnet-2`)

> [!WARNING]
> ALB는 최소 **2개의 AZ**(Availability Zone)에 배치해야 합니다.  
> 하나의 AZ만 선택하면 생성이 실패합니다.  
> 반드시 **Public Subnet**을 선택하세요. Private Subnet을 선택하면 Internet-facing ALB가 인터넷과 통신할 수 없습니다.

> [!TIP]
> 서브넷 이름이 비슷해서 헷갈린다면, 서브넷의 **Route Table**을 확인하세요.  
> Internet Gateway(`igw-`)로의 라우팅이 있는 서브넷이 Public Subnet입니다.  
> VPC 콘솔 → Subnets → 서브넷 선택 → **Route table** 탭에서 `0.0.0.0/0 → igw-xxx`가 있으면 Public입니다.

### Security groups

61. 기본으로 선택된 `default` Security Group을 ✕ 버튼으로 제거합니다.
62. 드롭다운에서 앞서 생성한 `alb-sg`를 선택합니다.

### Listeners and routing

기본으로 **Listener HTTP:80**이 하나 생성되어 있습니다. Default action을 설정합니다.

63. **Protocol**: `HTTP`, **Port**: `80` (기본값 유지)
64. **Default action** 섹션:
    - **Routing action**: `Forward to target groups` 선택 (기본값)
    - **Target group**: 드롭다운에서 `starter-app-tg`를 선택합니다.
    - **Target group stickiness**: 체크하지 않습니다 (기본값).

> [!TIP]
> Listener는 ALB가 수신하는 포트입니다.  
> 사용자는 ALB의 **80번 포트**로 접속하고, ALB는 Target Group의 EC2 포트(80)로 요청을 전달합니다.  
> 즉, 사용자는 포트 번호 없이 `http://alb-dns-name`으로 접속할 수 있습니다.

### Tags (선택)

65. **Load balancer tags – optional** 섹션을 펼치고 태그를 추가합니다:
    - **Key**: `CreatedBy`, **Value**: `admin-user`
    - **Key**: `Step`, **Value**: `step7`
    - **Key**: `Session`, **Value**: `7-1`

### Optimize with service integrations (선택)

66. **Optimize with service integrations – optional** 섹션:
    - CloudFront + WAF, WAF, Global Accelerator 옵션이 표시됩니다.
    - 이 실습에서는 모두 체크하지 않고 넘어갑니다 (추가 비용 발생).

> [!TIP]
> **실무에서의 활용:**
>
> | 옵션               | 용도                                         | 적합한 경우                          |
> | ------------------ | -------------------------------------------- | ------------------------------------ |
> | CloudFront + WAF   | CDN 캐싱 + SQL Injection/XSS 등 웹 공격 차단 | 글로벌 서비스, 보안 규제 대상        |
> | WAF 단독           | 웹 공격 차단만 (CDN 없이)                    | 리전 내 서비스이나 보안 강화 필요 시 |
> | Global Accelerator | 고정 IP + 글로벌 라우팅 최적화               | 멀티 리전 배포, 게임 서버 등         |
>
> 프로덕션에서는 **CloudFront + WAF** 조합을 가장 많이 사용합니다.  
> 이 실습에서는 학습 비용을 줄이기 위해 선택하지 않습니다.

### Summary 확인 및 생성

67. 하단의 **Review** 섹션에서 **Summary**를 확인합니다:

| 항목                  | 확인 내용                                                         |
| --------------------- | ----------------------------------------------------------------- |
| Basic configuration   | Name: starter-alb, Scheme: Internet-facing, IP address type: IPv4 |
| Network mapping       | VPC: alb-lab-vpc, AZ: ap-northeast-2a + 2c (Public Subnet)        |
| Security groups       | alb-sg                                                            |
| Listeners and routing | HTTP:80 \| Forward to 1 target group                              |
| Service integrations  | 모두 `-` (선택하지 않음)                                          |
| Tags                  | CreatedBy, Step, Session                                          |

68. [[Create load balancer]]를 클릭합니다.

### ALB 생성 확인

69. Load Balancers 목록에서 `starter-alb`의 **State**를 확인합니다.
    - **Provisioning** → **Active** (2~3분 소요)
    - State가 Active가 되면 ALB가 트래픽을 받을 준비가 완료된 것입니다.

> [!OUTPUT]
> ALB가 생성되었습니다:
>
> ```
> Name: starter-alb
> Scheme: Internet-facing
> State: Active
> DNS name: starter-alb-123456789.ap-northeast-2.elb.amazonaws.com
> ```
>
> 이 DNS name이 사용자가 접속할 주소입니다.

✅ **태스크 완료** — Application Load Balancer를 생성하고 Target Group과 연결했습니다.

---

## 태스크 5: ALB 동작 확인

### DNS Name으로 접속

70. Load Balancers 목록에서 `starter-alb`를 클릭합니다.
71. **Description** 탭에서 **DNS name**을 복사합니다.
    - DNS name 옆의 복사 아이콘(📋)을 클릭하면 클립보드에 복사됩니다.
72. 브라우저 주소창에 붙여넣고 접속합니다:

```
http://<ALB DNS Name>
```

> [!NOTE]
>
> - ALB DNS name은 생성할 때마다 다릅니다. 반드시 본인의 ALB DNS name을 사용하세요.
> - `https://`가 아닌 **`http://`**로 접속해야 합니다 (아직 인증서를 설정하지 않았으므로).
> - DNS name 예시: `starter-alb-123456789.ap-northeast-2.elb.amazonaws.com`

### 정상 접속 확인

- Nginx 인스턴스 식별 페이지가 표시됩니다 (Instance ID, AZ, Private IP 표시).
- **새로고침(F5)**을 여러 번 해보세요 — 인스턴스 ID와 배경색이 번갈아 변경됩니다.
  - 파란색 배경: EC2 #1 (AZ-a)
  - 초록색 배경: EC2 #2 (AZ-c)
- 이것이 ALB의 **트래픽 분산(로드밸런싱)**이 동작하는 것입니다.

### 접속이 안 되는 경우

> [!TROUBLESHOOTING]
> | 증상 | 원인 | 해결 방법 |
> |------|------|-----------|
> | 504 Gateway Timeout | Target Group에 healthy 타겟 없음 | Target Groups → Targets 탭에서 Health Status 확인 |
> | 502 Bad Gateway | EC2가 응답하지만 에러 반환 | EC2에 SSH 접속 → 앱 로그 확인 |
> | 연결 시간 초과 | ALB SG에서 80 포트 미허용 | `alb-sg` Inbound rules에 HTTP(80) 확인 |
> | ERR_CONNECTION_REFUSED | ALB가 아직 Provisioning 중 | State가 Active가 될 때까지 2~3분 대기 |
> | "This site can't be reached" | https://로 접속함 | http://로 변경하여 재시도 |

### Health Check 상태 재확인

73. EC2 콘솔 → **Load Balancing** → **Target Groups** → `starter-app-tg`를 클릭합니다.
74. **Targets** 탭에서 등록된 인스턴스의 **Health status**가 `healthy`인지 확인합니다.

> [!TIP]
> Health Status가 `healthy`인데도 접속이 안 된다면:
>
> 1. ALB의 State가 `Active`인지 확인합니다.
> 2. ALB Security Group(`alb-sg`)에 HTTP(80) Inbound 규칙이 있는지 확인합니다.
> 3. 브라우저 캐시를 삭제(Ctrl+Shift+R)하고 다시 시도합니다.

### CLI로 Health Check 상태 확인 (선택)

75. 터미널(또는 AWS CloudShell)에서 다음 명령어를 실행합니다:

```bash
aws elbv2 describe-target-health \
  --target-group-arn <Target Group ARN> \
  --region ap-northeast-2
```

> [!TIP]
> `<Target Group ARN>`은 Target Groups 목록에서 `starter-app-tg`를 선택하면 상세 정보의 **ARN** 필드에 표시됩니다.  
> 복사하여 사용하세요.

> [!OUTPUT]
>
> ```json
> {
>   "TargetHealthDescriptions": [
>     {
>       "Target": { "Id": "i-0abc123def456", "Port": 8080 },
>       "TargetHealth": { "State": "healthy" }
>     }
>   ]
> }
> ```

✅ **태스크 완료** — ALB DNS Name으로 접속하여 트래픽 분산이 정상 동작함을 확인했습니다.

---

## 태스크 6: Security Group으로 EC2 직접 접근 차단

현재는 사용자가 ALB를 통해서도, Amazon EC2 Public IP로 직접도 접속할 수 있습니다.  
보안을 강화하기 위해 EC2는 ALB에서 오는 트래픽만 허용하도록 변경합니다.

### 현재 상태 (보안 취약)

```
사용자 → ALB:80 → EC2:8080  ✅ (정상 경로)
사용자 → EC2 Public IP:8080  ⚠️ (직접 접근 가능 — 차단 필요)
```

### 목표 상태 (보안 강화)

```
사용자 → ALB:80 → EC2:8080  ✅ (정상 경로)
사용자 → EC2 Public IP:8080  ❌ (차단됨)
```

### EC2 Security Group 수정

76. EC2 콘솔 왼쪽 메뉴에서 **Network & Security** → **Security Groups**를 클릭합니다.
77. EC2에 연결된 Security Group을 선택합니다 (예: `alb-lab-ec2-sg`).
    - 여러 SG가 있으면 **Name** 태그를 확인합니다.
78. **Inbound rules** 탭을 클릭합니다.
79. [[Edit inbound rules]]를 클릭합니다.
80. 기존 **애플리케이션 포트 규칙**(Source: `0.0.0.0/0`, Port: 8080 또는 80)을 찾아 우측 [[Delete]] 버튼으로 삭제합니다.
    - SSH(22번 포트) 규칙은 **삭제하지 않습니다**.
81. [[Add rule]]을 클릭하고 새 규칙을 추가합니다:
    - **Type**: `Custom TCP`
    - **Port range**: `8080` (또는 `80` — 본인의 AppPort에 맞게 입력)
    - **Source**: 드롭다운에서 **Custom**을 선택하고, 검색창에 `alb-sg`를 입력하여 선택합니다.
      - Security Group ID(sg-xxx)가 자동으로 채워집니다.
    - **Description**: `Allow from ALB only`

> [!NOTE]
> Source에 IP 대신 **Security Group**을 지정하는 것이 핵심입니다.  
> `alb-sg`를 Source로 지정하면, 이 Security Group이 연결된 리소스(= ALB)에서 오는 트래픽만 허용됩니다.  
> ALB의 IP가 변경되어도 규칙을 수정할 필요가 없어 운영이 편리합니다.

82. 최종 Inbound rules가 다음과 같은지 확인합니다:

| Type       | Port range     | Source            | Description         |
| ---------- | -------------- | ----------------- | ------------------- |
| SSH        | 22             | SSHAccessCidr     | SSH access          |
| Custom TCP | 8080 (또는 80) | sg-xxx (`alb-sg`) | Allow from ALB only |

83. [[Save rules]]를 클릭합니다.

### 변경 후 확인

84. 브라우저에서 **EC2 Public IP:포트**로 직접 접속을 시도합니다:

```
http://<EC2 Public IP>:80    (CloudFormation으로 생성한 경우)
http://<EC2 Public IP>:8080  (Spring Boot를 사용하는 경우)
```

- ❌ 연결 시간 초과 (접근 차단됨) — 정상입니다.

85. 브라우저에서 **ALB DNS Name**으로 접속합니다:

```
http://<ALB DNS Name>
```

- ✅ 정상 접속 (ALB를 통한 접근은 허용)

> [!OUTPUT]
> EC2 Security Group 변경 후:
>
> - `http://<EC2-Public-IP>:8080` → ❌ 접속 불가 (타임아웃)
> - `http://<ALB-DNS-Name>` → ✅ 정상 접속
>
> Amazon EC2에 직접 접근이 차단되어 보안이 강화되었습니다.

> [!WARNING]
> EC2 Security Group에서 **SSH(22번 포트) 규칙을 삭제하면 EC2에 접속할 수 없게 됩니다.**  
> SSH 규칙은 반드시 유지하세요. 필요하다면 Source를 본인의 IP(`x.x.x.x/32`)로 제한하는 것을 권장합니다.

> [!TIP]
> EC2 Public IP는 EC2 콘솔 → Instances → 해당 인스턴스 선택 → **Details** 탭의 **Public IPv4 address** 필드에서 확인할 수 있습니다.  
> 또는 AWS CloudFormation 콘솔 → Stacks → `step7-2-alb-prereq` → **Outputs** 탭의 `EC2PublicIP`에서도 확인 가능합니다.

✅ **태스크 완료** — EC2 Security Group을 수정하여 ALB를 통한 접근만 허용하도록 설정했습니다.

---

## 마무리

이 실습에서 다음을 성공적으로 수행했습니다:

- Application Load Balancer(ALB)의 개념과 구성 요소(Listener, Rule, Target Group)를 이해했습니다.
- Target Group을 생성하고 Health Check를 설정했습니다.
- Amazon EC2 인스턴스 2대를 Target Group에 등록하고 트래픽 분산을 확인했습니다.
- ALB를 생성하여 Internet-facing으로 배포하고, DNS Name으로 접속했습니다.
- Security Group을 활용하여 EC2 직접 접근을 차단하고, ALB를 통한 접근만 허용하도록 보안을 강화했습니다.

> [!TIP]
> 다음 실습(Step 7-3)에서는 Auto Scaling Group으로 인스턴스를 자동 확장/축소합니다.

---

# 🗑️ 리소스 정리

> [!WARNING]
> ALB는 시간당 과금이 발생합니다. 실습 후 반드시 삭제하세요.
>
> | 리소스         | 과금 기준         | 비고                            |
> | -------------- | ----------------- | ------------------------------- |
> | ALB            | 시간당 + LCU 기반 | 미사용 시에도 시간당 비용 발생  |
> | Amazon EC2     | 시간당            | 무료 플랜 적용 여부에 따라 다름 |
> | Target Group   | 없음              | ALB 비용에 포함                 |
> | Security Group | 없음              | 무료                            |
>
> ※ 실제 요금은 리전, 무료 플랜 적용 여부, LCU 사용량에 따라 달라집니다.  
> [Elastic Load Balancing 요금](https://aws.amazon.com/elasticloadbalancing/pricing/) | [Amazon EC2 요금](https://aws.amazon.com/ec2/pricing/)

> [!NOTE]
> **Step 7-3 (Auto Scaling) 실습을 이어서 진행할 예정이라면:**  
> ALB, Target Group, VPC, EC2, Security Group을 삭제하지 마세요. 이후 세션에서 재사용합니다.  
> 아래는 **이 실습만 진행하고 삭제하는 경우**의 정리 순서입니다.

> [!NOTE]
> 삭제 순서 (의존 관계):
>
> ```
> ALB → Target Group → EC2 SG 원복 (참조 제거) → ALB Security Group → CloudFormation 스택
> ```
>
> ALB가 Target Group을 참조하므로 ALB를 먼저 삭제합니다.

---

### 단계 1: Tag Editor로 리소스 확인

먼저 이 실습에서 생성한 리소스를 Tag Editor로 한눈에 확인합니다.

1. 상단 검색창에 `Resource Groups & Tag Editor`를 입력하고 선택합니다.
2. 왼쪽 메뉴에서 **Tag Editor**를 선택합니다.
3. 다음 조건으로 검색합니다:
   - **Regions**: `ap-northeast-2`
   - **Tag key**: `Session`, **Tag value**: `7-1`
4. [[Search resources]]를 클릭합니다.

> [!TIP]
> AWS CloudFormation으로 생성한 리소스는 `CreatedBy: cloudformation` 태그가 있습니다.  
> 수동으로 생성한 ALB, Target Group, ALB SG는 `CreatedBy: admin-user` 태그로 구분됩니다.

---

### 단계 2: ALB 삭제

ALB는 시간당 과금이 발생하므로 가장 먼저 삭제합니다.

5. 상단 검색창에 `EC2`를 입력하고 선택합니다.
6. 왼쪽 메뉴에서 **Load Balancing** → **Load Balancers**를 클릭합니다.
7. `starter-alb`를 선택합니다 (체크박스 클릭).
8. **Actions** 드롭다운 → **Delete load balancer**를 클릭합니다.
9. 확인 입력란에 `confirm`을 입력합니다.
10. [[Delete]]를 클릭합니다.
11. 목록에서 ALB가 사라지는 것을 확인합니다 (1~2분 소요).

---

### 단계 3: Target Group 삭제

ALB가 삭제된 후 Target Group을 삭제합니다.

12. 왼쪽 메뉴에서 **Load Balancing** → **Target Groups**를 클릭합니다.
13. `starter-app-tg`를 선택합니다.
14. **Actions** 드롭다운 → **Delete**를 클릭합니다.
15. 확인 팝업에서 [[Delete]]를 클릭합니다.

> [!WARNING]
> ALB가 연결된 상태에서는 Target Group을 삭제할 수 없습니다.  
> "Target group is currently in use by a listener or a rule" 에러가 발생하면 ALB 삭제가 완료될 때까지 1~2분 대기 후 재시도하세요.

---

### 단계 4: EC2 Security Group 원복

태스크 6에서 EC2 Security Group의 Source를 `alb-sg`로 변경했으므로, ALB SG를 삭제하기 전에 참조를 먼저 제거해야 합니다.

16. 왼쪽 메뉴에서 **Network & Security** → **Security Groups**를 클릭합니다.
17. EC2에 연결된 Security Group을 선택합니다 (예: `alb-lab-ec2-sg`).
18. **Inbound rules** 탭 → [[Edit inbound rules]]를 클릭합니다.
19. Source가 `alb-sg`(sg-xxx)로 설정된 규칙을 [[Delete]] 버튼으로 삭제합니다.
20. [[Save rules]]를 클릭합니다.

> [!NOTE]
> EC2 SG가 `alb-sg`를 Source로 참조하고 있으면 `alb-sg`를 삭제할 수 없습니다.  
> 반드시 참조를 먼저 제거한 후 ALB SG를 삭제하세요.  
> AWS CloudFormation 스택을 삭제할 예정이라면, 스택이 EC2 SG도 함께 삭제하므로 이 단계와 단계 5를 건너뛰고 바로 단계 6으로 진행해도 됩니다.

---

### 단계 5: ALB Security Group 삭제

21. `alb-sg`를 선택합니다.
22. **Actions** 드롭다운 → **Delete security groups**를 클릭합니다.
23. 확인 팝업에서 [[Delete]]를 클릭합니다.

> [!NOTE]
> "has a dependent object" 에러가 발생하면 ALB 삭제가 완전히 완료될 때까지 1~2분 후 다시 시도하세요.

---

### 단계 6: AWS CloudFormation 스택 삭제

태스크 0에서 AWS CloudFormation으로 선행 리소스를 생성한 경우 스택을 삭제합니다.

24. 상단 검색창에 `CloudFormation`을 입력하고 선택합니다.
25. **Stacks** 목록에서 `step7-2-alb-prereq` 스택을 선택합니다.
26. [[Delete]]를 클릭합니다.
27. 확인 팝업에서 [[Delete stack]]을 클릭합니다.
28. 스택 상태가 `DELETE_IN_PROGRESS` → `DELETE_COMPLETE`가 될 때까지 기다립니다 (약 2~3분).

> [!NOTE]
> AWS CloudFormation 스택을 삭제하면 스택이 생성한 모든 리소스(VPC, Subnet, IGW, EC2, Security Group)가 자동으로 삭제됩니다.  
> 이전 차시에서 사용하던 VPC/EC2를 그대로 사용한 경우 이 단계는 건너뛰세요.

---

### 단계 7: 삭제 확인

29. EC2 콘솔 → **Load Balancers**에서 `starter-alb`가 삭제되었는지 확인합니다.
30. EC2 콘솔 → **Target Groups**에서 `starter-app-tg`가 삭제되었는지 확인합니다.
31. EC2 콘솔 → **Security Groups**에서 `alb-sg`가 삭제되었는지 확인합니다.
32. Tag Editor에서 최종 확인합니다:
    - **Resource Groups & Tag Editor** → **Tag Editor**
    - Tag key: `Session`, Value: `7-1`로 검색
    - 검색 결과가 없으면 모든 태그된 리소스가 정리된 것입니다.

> [!TIP]
> `Step: step7`으로도 추가 검색하여 다른 세션의 리소스가 남아있지 않은지 확인하세요.

✅ **실습 종료**: 모든 리소스가 정리되었습니다.

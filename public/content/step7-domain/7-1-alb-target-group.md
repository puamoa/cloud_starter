---
title: 'ALB 생성 및 Target Group 구성'
week: 7
session: 1
awsServices:
  - Elastic Load Balancing
learningObjectives:
  - Application Load Balancer의 개념과 동작 원리를 이해할 수 있습니다.
  - Target Group을 생성하고 EC2 인스턴스를 등록할 수 있습니다.
  - Health Check를 설정하여 비정상 인스턴스를 자동 제외할 수 있습니다.
  - ALB를 통해 여러 EC2에 트래픽을 분산할 수 있습니다.
prerequisites:
  - AWS 계정 생성 완료
  - VPC + Public Subnet 2개 (서로 다른 AZ) 필요
  - EC2 인스턴스 1개 이상 (Spring Boot 또는 Nginx 실행 중)
estimatedCost: 크레딧 내 사용 가능 (비용 발생 가능)
---

이 실습에서는 Application Load Balancer(ALB)를 생성하고, Target Group을
구성하여 EC2 인스턴스에 트래픽을 분산하는 방법을 학습합니다.
Health Check를 통해 비정상 인스턴스를 자동으로 제외하는 과정도 확인합니다.

> [!NOTE]
> 이 실습에는 VPC, Public Subnet 2개(서로 다른 AZ), EC2 인스턴스가 필요합니다.
> 선행 리소스가 없는 경우 태스크 0의 CloudFormation 템플릿을 사용하세요.

---

## 태스크 0: 선행 리소스 확인

> [!DOWNLOAD]
> [step7-1-alb-lab.zip](/files/step7/step7-1-alb-lab.zip)
>
> - `step7-1-alb-prereq.yaml` - AWS CloudFormation 템플릿 (태스크 0에서 VPC, 서브넷, IGW, EC2, Security Group 자동 생성)

### 필요한 리소스 체크리스트

| 리소스           | 요구 사항                             | 확인 |
| ---------------- | ------------------------------------- | ---- |
| VPC              | 1개                                   | ☐    |
| Public Subnet    | 2개 (서로 다른 AZ)                    | ☐    |
| Internet Gateway | VPC에 연결됨                          | ☐    |
| EC2 인스턴스     | 1개 이상 (포트 8080 또는 80에서 응답) | ☐    |

### 리소스가 없는 경우: CloudFormation으로 생성

아래 CloudFormation 템플릿을 사용하면 필요한 리소스를 한 번에 생성할 수 있습니다.

**CloudFormation 스택 생성 방법:**

1. 다운로드한 `step7-1-alb-prereq.yaml` 파일을 확인합니다.
2. CloudFormation 콘솔에서 [[Create stack]] → **With new resources (standard)**를 선택합니다.
3. **Upload a template file** → 다운로드한 YAML 파일을 업로드합니다.
4. Stack name: `step7-1-alb-prereq`
5. KeyPairName: 기존 Key Pair 선택
6. [[Next]] → [[Next]] → [[Submit]]

> [!WARNING]
> CloudFormation 스택 생성에 3~5분이 소요됩니다.
> Status가 `CREATE_COMPLETE`가 될 때까지 기다린 후 다음 태스크를 진행하세요.

✅ **태스크 완료** — 선행 리소스를 확인하거나 CloudFormation으로 생성했습니다.

---

## 태스크 1: ALB 개념 이해

### 단일 EC2의 한계

현재 구성에서는 사용자가 EC2의 Public IP로 직접 접속합니다:

```

사용자 → EC2 Public IP:8080 → Spring Boot 앱

```

이 구성의 문제점:

- EC2가 다운되면 서비스 전체가 중단됨
- 트래픽이 증가해도 하나의 EC2가 모든 요청을 처리해야 함
- EC2를 교체하면 IP가 변경되어 DNS 수정 필요

```

### ALB를 사용한 구성

```

                    ┌─── EC2 #1 (AZ-a)

사용자 → ALB DNS → │
└─── EC2 #2 (AZ-c)

```

ALB를 사용하면:

- 여러 EC2에 트래픽을 자동 분산
- 비정상 EC2를 자동으로 제외 (Health Check)
- 고정된 DNS Name 제공 (EC2 교체해도 변경 없음)
- HTTPS 인증서를 ALB에 설치하여 SSL 종료 가능

### ALB 구성 요소

```

ALB
├── Listener (HTTP:80 또는 HTTPS:443)
│ └── Rule (조건에 따라 라우팅)
│ └── Action (Target Group으로 전달)
└── Target Group
├── EC2 #1 (healthy)
├── EC2 #2 (healthy)
└── EC2 #3 (unhealthy → 트래픽 제외)

````

| 구성 요소        | 역할                                          |
| ---------------- | --------------------------------------------- |
| **Listener**     | 특정 포트/프로토콜로 들어오는 요청을 수신     |
| **Rule**         | 요청 조건(경로, 호스트 등)에 따라 라우팅 결정 |
| **Target Group** | 실제 요청을 처리할 대상(EC2) 그룹             |
| **Health Check** | 대상의 정상 여부를 주기적으로 확인            |

> [!CONCEPT] L4 vs L7 로드밸런서
>
> - **NLB (Network Load Balancer)**: L4 (TCP/UDP 레벨), 초고성능, 고정 IP 지원
> - **ALB (Application Load Balancer)**: L7 (HTTP/HTTPS 레벨), 경로 기반 라우팅, 호스트 기반 라우팅
>
> 웹 애플리케이션에는 ALB가 적합합니다. URL 경로(`/api/*`, `/static/*`)나
> 호스트명(`api.example.com`, `www.example.com`)에 따라 다른 서버로 라우팅할 수 있습니다.

✅ **태스크 완료** — ALB의 개념과 구성 요소를 이해했습니다.

---

## 태스크 2: Target Group 생성

Target Group은 ALB가 트래픽을 전달할 대상(EC2 인스턴스)의 그룹입니다.

### Target Group 생성 단계

1. AWS Management Console에 로그인합니다.
2. 우측 상단에서 리전을 **Asia Pacific (Seoul) ap-northeast-2**로 설정합니다.
3. 상단 검색창에 `EC2`를 입력하고 **EC2** 서비스를 선택합니다.
4. 왼쪽 메뉴에서 **Load Balancing** → **Target Groups**를 클릭합니다.
5. [[Create target group]] 버튼을 클릭합니다.

### Basic configuration

6. **Choose a target type**: **Instances**를 선택합니다.
7. **Target group name** 필드에 `starter-app-tg`를 입력합니다.
8. **Protocol** 드롭다운에서 `HTTP`를 선택합니다.
9. **Port** 필드에 `8080`을 입력합니다.

> [!NOTE]
> Port는 EC2에서 애플리케이션이 실행 중인 포트를 입력합니다.
> Spring Boot 기본 포트는 8080, Nginx 기본 포트는 80입니다.
> 본인의 애플리케이션에 맞게 설정하세요.

10. **IP address type**: `IPv4`를 선택합니다.
11. **VPC** 드롭다운에서 실습용 VPC를 선택합니다 (예: `alb-lab-vpc`).
12. **Protocol version**: `HTTP1`을 선택합니다.

### Health checks

13. **Health check protocol**: `HTTP`를 선택합니다.
14. **Health check path** 필드에 `/actuator/health`를 입력합니다.

> [!TIP]
> Spring Boot Actuator를 사용하지 않는 경우 `/`로 설정하세요.
> Health Check 경로는 HTTP 200 응답을 반환하는 엔드포인트여야 합니다.
> Nginx를 사용하는 경우 `/`가 적합합니다.

15. **Advanced health check settings**를 펼칩니다:
    - **Healthy threshold**: `3` (연속 3회 성공 시 healthy)
    - **Unhealthy threshold**: `2` (연속 2회 실패 시 unhealthy)
    - **Timeout**: `5` seconds
    - **Interval**: `30` seconds
    - **Success codes**: `200`

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

16. [[Next]]를 클릭합니다.

### Register targets (다음 태스크에서 진행)

17. 이 단계에서는 타겟을 등록하지 않고 [[Create target group]]을 클릭합니다.

> [!OUTPUT]
> Target Group이 생성되었습니다:
>
> - Name: `starter-app-tg`
> - Protocol/Port: HTTP:8080
> - Health Check: `/actuator/health`
> - Targets: 0개 (아직 등록하지 않음)

✅ **태스크 완료** — Target Group을 생성하고 Health Check를 설정했습니다.

---

## 태스크 3: Target Group에 EC2 등록

생성한 Target Group에 EC2 인스턴스를 타겟으로 등록합니다.

18. EC2 콘솔 → **Load Balancing** → **Target Groups**로 이동합니다.
19. `starter-app-tg`를 클릭합니다.
20. **Targets** 탭을 클릭합니다.
21. [[Register targets]]를 클릭합니다.

### Available instances에서 EC2 선택

22. 목록에서 등록할 EC2 인스턴스를 체크합니다.
23. **Ports for the selected instances**: `8080` (기본값 유지)
24. [[Include as pending below]]를 클릭합니다.

> [!NOTE]
> "Include as pending below"를 클릭하면 하단의 **Review targets** 영역에
> 선택한 인스턴스가 추가됩니다. 여러 인스턴스를 한 번에 등록할 수 있습니다.

25. 하단 **Review targets**에서 등록할 인스턴스를 확인합니다.
26. [[Register pending targets]]를 클릭합니다.

### Health Status 확인

27. Target Group 상세 → **Targets** 탭에서 등록된 인스턴스의 상태를 확인합니다.

| Status        | 의미                                |
| ------------- | ----------------------------------- |
| **initial**   | Health Check 진행 중 (최초 등록 후) |
| **healthy**   | Health Check 성공, 트래픽 수신 가능 |
| **unhealthy** | Health Check 실패, 트래픽 제외됨    |
| **draining**  | 등록 해제 중 (기존 연결 완료 대기)  |

> [!WARNING]
> 등록 직후에는 Status가 `initial`입니다. `healthy`로 변경되기까지
> 약 30초 × Healthy threshold(3) = 90초 정도 소요됩니다.
> Status가 `unhealthy`로 표시되면 EC2에서 애플리케이션이 정상 실행 중인지,
> Health Check 경로가 올바른지 확인하세요.

### unhealthy 상태 트러블슈팅

Status가 `unhealthy`인 경우 확인할 사항:

```bash
# EC2에 SSH 접속 후 애플리케이션 상태 확인
curl http://localhost:8080/actuator/health

# 또는 Nginx인 경우
curl http://localhost:80/
````

- 애플리케이션이 실행 중이 아닌 경우 → 시작
- Security Group에서 8080 포트가 열려있는지 확인
- Health Check 경로가 실제 응답하는 경로인지 확인

✅ **태스크 완료** — Target Group에 EC2 인스턴스를 등록하고 Health Status를 확인했습니다.

> [!TROUBLESHOOTING]
> | 증상 | 원인 | 해결 방법 |
> |------|------|-----------|
> | Status가 계속 `initial` | Health Check 간격 × Threshold 대기 중 | 90초(30초×3) 대기 후 재확인 |
> | Status가 `unhealthy` | 앱이 실행되지 않음 | EC2에 SSH 접속 후 `curl localhost:8080` 확인 |
> | Status가 `unhealthy` | Health Check 경로 불일치 | `/actuator/health` 대신 `/` 시도 |
> | Status가 `unhealthy` | Security Group에서 포트 미허용 | EC2 SG에서 8080 포트가 열려있는지 확인 |
> | "No targets registered" | Include as pending 클릭 안 함 | Register targets에서 인스턴스 재등록 |

---

## 태스크 4: ALB 생성

이제 Application Load Balancer를 생성하여 Target Group과 연결합니다.

### ALB Security Group 생성

ALB 전용 Security Group을 먼저 생성합니다.

28. EC2 콘솔 → **Network & Security** → **Security Groups**로 이동합니다.
29. [[Create security group]]을 클릭합니다.
30. 다음과 같이 설정합니다:

- **Security group name**: `alb-sg`
- **Description**: `Security group for ALB - Allow HTTP/HTTPS from internet`
- **VPC**: 실습용 VPC 선택

31. **Inbound rules**에서 [[Add rule]]을 클릭합니다:

| Type  | Protocol | Port range | Source    | Description               |
| ----- | -------- | ---------- | --------- | ------------------------- |
| HTTP  | TCP      | 80         | 0.0.0.0/0 | Allow HTTP from anywhere  |
| HTTPS | TCP      | 443        | 0.0.0.0/0 | Allow HTTPS from anywhere |

32. **Outbound rules**는 기본값(All traffic, 0.0.0.0/0)을 유지합니다.
33. [[Create security group]]을 클릭합니다.

> [!NOTE]
> ALB Security Group은 인터넷에서 들어오는 HTTP/HTTPS 트래픽을 허용합니다.
> 이후 태스크 6에서 EC2 Security Group은 ALB에서 오는 트래픽만 허용하도록 변경합니다.

### ALB 생성 단계

34. EC2 콘솔 → **Load Balancing** → **Load Balancers**로 이동합니다.
35. [[Create load balancer]]를 클릭합니다.
36. **Application Load Balancer** 섹션에서 [[Create]]를 클릭합니다.

### Basic configuration

37. **Load balancer name** 필드에 `starter-alb`를 입력합니다.
38. **Scheme**: **Internet-facing** (인터넷에서 접근 가능)을 선택합니다.
39. **IP address type**: `IPv4`를 선택합니다.

> [!CONCEPT] Internet-facing vs Internal
>
> - **Internet-facing**: 인터넷에서 접근 가능한 Public DNS Name 부여. 웹 서비스에 사용.
> - **Internal**: VPC 내부에서만 접근 가능. 마이크로서비스 간 통신에 사용.
>
> 이 실습에서는 사용자가 브라우저로 접속해야 하므로 Internet-facing을 선택합니다.

### Network mapping

40. **VPC** 드롭다운에서 실습용 VPC를 선택합니다.
41. **Mappings**: 최소 2개의 Availability Zone을 선택합니다.
    - ✅ `ap-northeast-2a` → Public Subnet 1 선택
    - ✅ `ap-northeast-2c` → Public Subnet 2 선택

> [!WARNING]
> ALB는 최소 2개의 AZ(Availability Zone)에 배치해야 합니다.
> 하나의 AZ만 선택하면 생성이 실패합니다.
> 반드시 **Public Subnet**을 선택하세요. Private Subnet을 선택하면
> Internet-facing ALB가 인터넷과 통신할 수 없습니다.

> [!TIP]
> 서브넷 이름이 비슷해서 헷갈린다면, 서브넷의 **Route Table**을 확인하세요.
> Internet Gateway(igw-)로의 라우팅이 있는 서브넷이 Public Subnet입니다.
> VPC 콘솔 → Subnets → 서브넷 선택 → Route table 탭에서 확인할 수 있습니다.

### Security groups

42. 기본 Security Group을 제거하고, 앞서 생성한 `alb-sg`를 선택합니다.

### Listeners and routing

43. **Listener** 설정:
    - **Protocol**: HTTP
    - **Port**: `80`
    - **Default action**: Forward to → `starter-app-tg` 선택

> [!TIP]
> Listener는 ALB가 수신하는 포트입니다. 사용자는 ALB의 80번 포트로 접속하고,
> ALB는 Target Group의 EC2 8080번 포트로 요청을 전달합니다.
> 즉, 사용자는 포트 번호 없이 `http://alb-dns-name`으로 접속할 수 있습니다.

44. 나머지 설정은 기본값을 유지합니다.
45. [[Create load balancer]]를 클릭합니다.

### ALB 생성 확인

46. Load Balancers 목록에서 `starter-alb`의 State를 확인합니다.
    - **Provisioning** → **Active** (2~3분 소요)

> [!OUTPUT]
> ALB가 생성되었습니다:
>
> - Name: `starter-alb`
> - Scheme: Internet-facing
> - State: Active
> - DNS name: `starter-alb-123456789.ap-northeast-2.elb.amazonaws.com`
>
> 이 DNS name이 사용자가 접속할 주소입니다.

✅ **태스크 완료** — Application Load Balancer를 생성하고 Target Group과 연결했습니다.

---

## 태스크 5: ALB 동작 확인

### DNS Name으로 접속

47. Load Balancers → `starter-alb`를 클릭합니다.
48. **Description** 탭에서 **DNS name**을 복사합니다.
49. 브라우저에서 접속합니다:

```
http://starter-alb-123456789.ap-northeast-2.elb.amazonaws.com
```

> [!NOTE]
> ALB DNS name은 생성할 때마다 다릅니다. 반드시 본인의 ALB DNS name을 사용하세요.
> `https://`가 아닌 `http://`로 접속해야 합니다 (아직 인증서를 설정하지 않았으므로).

### 정상 접속 확인

- Spring Boot 앱이 실행 중이라면 애플리케이션 화면이 표시됩니다.
- Nginx가 실행 중이라면 Nginx 기본 페이지가 표시됩니다.

### 접속이 안 되는 경우 트러블슈팅

| 증상                   | 원인                             | 해결                       |
| ---------------------- | -------------------------------- | -------------------------- |
| 504 Gateway Timeout    | Target Group에 healthy 타겟 없음 | Health Check 상태 확인     |
| 502 Bad Gateway        | EC2가 응답하지만 에러 반환       | EC2 애플리케이션 로그 확인 |
| 연결 시간 초과         | ALB SG에서 80 포트 미허용        | ALB Security Group 확인    |
| ERR_CONNECTION_REFUSED | ALB가 아직 Provisioning 중       | Active 상태까지 대기       |

### Health Check 상태 확인

50. EC2 콘솔 → **Target Groups** → `starter-app-tg`를 클릭합니다.
51. **Targets** 탭에서 등록된 인스턴스의 **Health status**를 확인합니다.

```
Target Group: starter-app-tg
┌─────────────────┬──────────┬────────────────┐
│ Instance        │ Port     │ Health Status  │
├─────────────────┼──────────┼────────────────┤
│ i-0abc123def456 │ 8080     │ ✅ healthy     │
└─────────────────┴──────────┴────────────────┘
```

> [!TIP]
> Health Status가 `healthy`인데도 접속이 안 된다면:
>
> 1. ALB의 State가 `Active`인지 확인
> 2. ALB Security Group에서 80 포트가 열려있는지 확인
> 3. 브라우저 캐시를 삭제하고 다시 시도

### CLI로 Health Check 상태 확인

```bash
aws elbv2 describe-target-health \
  --target-group-arn arn:aws:elasticloadbalancing:ap-northeast-2:123456789012:targetgroup/starter-app-tg/abc123def456
```

> [!OUTPUT]
>
> ```json
> {
>   "TargetHealthDescriptions": [
>     {
>       "Target": {
>         "Id": "i-0abc123def456",
>         "Port": 8080
>       },
>       "HealthCheckPort": "8080",
>       "TargetHealth": {
>         "State": "healthy"
>       }
>     }
>   ]
> }
> ```

✅ **태스크 완료** — ALB DNS Name으로 접속하여 트래픽 분산이 정상 동작함을 확인했습니다.

---

## 태스크 6: ALB Security Group 설정 (EC2 직접 접근 차단)

현재는 사용자가 ALB를 통해서도, EC2 Public IP로 직접도 접속할 수 있습니다.
보안을 강화하기 위해 EC2는 ALB에서 오는 트래픽만 허용하도록 변경합니다.

### 현재 상태 (보안 취약)

```
사용자 → ALB:80 → EC2:8080  ✅ (정상 경로)
사용자 → EC2 Public IP:8080  ⚠️ (직접 접근 가능 - 차단 필요)
```

### 목표 상태 (보안 강화)

```
사용자 → ALB:80 → EC2:8080  ✅ (정상 경로)
사용자 → EC2 Public IP:8080  ❌ (차단됨)
```

### EC2 Security Group 수정

52. EC2 콘솔 → **Network & Security** → **Security Groups**로 이동합니다.
53. EC2에 연결된 Security Group을 선택합니다 (예: `EC2SecurityGroup`).
54. **Inbound rules** 탭 → [[Edit inbound rules]]를 클릭합니다.
55. 기존 8080 포트 규칙을 **삭제**합니다 (Source: 0.0.0.0/0인 규칙).
56. [[Add rule]]을 클릭하고 새 규칙을 추가합니다:

| Type       | Protocol | Port range | Source                         | Description         |
| ---------- | -------- | ---------- | ------------------------------ | ------------------- |
| Custom TCP | TCP      | 8080       | `alb-sg` (Security Group 선택) | Allow from ALB only |

> [!NOTE]
> Source에 IP 대신 **Security Group ID**를 지정할 수 있습니다.
> `alb-sg`를 Source로 지정하면, ALB Security Group이 연결된 리소스(즉, ALB)에서
> 오는 트래픽만 허용됩니다. ALB의 IP가 변경되어도 규칙을 수정할 필요가 없습니다.

57. SSH 규칙(22번 포트)은 유지합니다 (관리 목적).
58. [[Save rules]]를 클릭합니다.

### 변경 후 확인

59. 브라우저에서 **EC2 Public IP:8080**으로 직접 접속을 시도합니다.

- ❌ 연결 시간 초과 (접근 차단됨)

60. 브라우저에서 **ALB DNS Name**으로 접속합니다.

- ✅ 정상 접속 (ALB를 통한 접근은 허용)

> [!OUTPUT]
> EC2 Security Group 변경 후:
>
> - `http://EC2-Public-IP:8080` → ❌ 접속 불가 (타임아웃)
> - `http://ALB-DNS-Name` → ✅ 정상 접속
>
> EC2에 직접 접근이 차단되어 보안이 강화되었습니다.

> [!WARNING]
> EC2 Security Group에서 SSH(22번 포트) 규칙을 삭제하면 EC2에 접속할 수 없게 됩니다.
> SSH 규칙은 반드시 유지하세요. 필요하다면 Source를 본인의 IP로 제한하는 것을 권장합니다.

✅ **태스크 완료** — EC2 Security Group을 수정하여 ALB를 통한 접근만 허용하도록 설정했습니다.

---

# 🗑️ 리소스 정리

> [!WARNING]
> 다음 단계를 **반드시 수행**하여 불필요한 비용을 방지합니다.
>
> | 리소스         | 시간당 비용    | 월 비용 (24/7) | 비고            |
> | -------------- | -------------- | -------------- | --------------- |
> | ALB            | $0.0225/시간   | ~$16.20        | LCU 비용 별도   |
> | EC2 (t2.micro) | $0 (Free Tier) | $0             | 12개월 무료     |
> | Target Group   | $0             | $0             | ALB 비용에 포함 |
> | Security Group | $0             | $0             | 무료            |
>
> **ALB를 삭제하지 않으면 월 약 $16 이상 과금됩니다.**

> [!NOTE]
> 삭제 순서 (의존 관계):
>
> ```
> 삭제 순서: ALB → Target Group → Security Group → CloudFormation
>
> ALB ──참조──→ Target Group ──참조──→ EC2
>  │                                    │
>  │ 먼저 삭제                          │ 나중에 삭제
>  ▼                                    ▼
> (1) ALB Delete              (3) SG Delete
> (2) TG Delete               (4) CloudFormation Delete
> ```
>
> ALB가 Target Group을 참조하고, Target Group이 삭제되어야 Security Group을 삭제할 수 있습니다.

---

### 단계 1: ALB 삭제

ALB는 시간당 약 $0.0225 + LCU 비용이 발생합니다. 가장 먼저 삭제합니다.

61. 상단 검색창에 `EC2`를 입력하고 선택합니다.
62. 왼쪽 메뉴에서 **Load Balancing** → **Load Balancers**를 클릭합니다.
63. `starter-alb`를 선택합니다.
64. **Actions** → **Delete load balancer**를 클릭합니다.
65. 확인 입력란에 `confirm`을 입력합니다.
66. [[Delete]]를 클릭합니다.
67. 목록에서 ALB가 사라지는 것을 확인합니다.

> [!NOTE]
> **Step 7-2 (Auto Scaling) 실습을 이어서 진행할 예정이라면 ALB를 삭제하지 마세요.** Step 7-2에서 이 ALB를 재사용합니다.

---

### 단계 2: Target Group 삭제

ALB가 삭제된 후 Target Group을 삭제합니다.

68. EC2 콘솔 왼쪽 메뉴에서 **Load Balancing** → **Target Groups**를 클릭합니다.
69. `starter-app-tg`를 선택합니다.
70. **Actions** → **Delete**를 클릭합니다.
71. 확인 팝업에서 [[Yes, delete]]를 클릭합니다.

> [!WARNING]
> ALB가 연결된 상태에서는 Target Group을 삭제할 수 없습니다. 반드시 ALB를 먼저 삭제한 후 Target Group을 삭제하세요.

---

### 단계 3: ALB Security Group 삭제

ALB 전용으로 생성한 Security Group을 삭제합니다.

72. EC2 콘솔 왼쪽 메뉴에서 **Network & Security** → **Security Groups**를 클릭합니다.
73. `alb-sg`를 선택합니다.
74. **Actions** → **Delete security groups**를 클릭합니다.
75. 확인 팝업에서 [[Delete]]를 클릭합니다.

> [!NOTE]
> ALB가 삭제된 후에도 Security Group 삭제까지 몇 분 걸릴 수 있습니다. "has a dependent object" 에러가 발생하면 1~2분 후 다시 시도하세요.

---

### 단계 4: EC2 Security Group 원복 (선택)

태스크 6에서 EC2 Security Group을 변경한 경우, 기존 EC2를 계속 사용하려면 원복합니다.

76. EC2 콘솔 → **Network & Security** → **Security Groups**로 이동합니다.
77. EC2에 연결된 Security Group을 선택합니다 (예: `EC2SecurityGroup`).
78. **Inbound rules** 탭 → [[Edit inbound rules]]를 클릭합니다.
79. Source가 `alb-sg`로 설정된 8080 포트 규칙을 삭제합니다.
80. [[Add rule]]을 클릭하고 새 규칙을 추가합니다:

- **Type**: Custom TCP
- **Port range**: 8080
- **Source**: `0.0.0.0/0` (또는 본인 IP)

81. [[Save rules]]를 클릭합니다.

> [!NOTE]
> EC2를 더 이상 사용하지 않을 경우 이 단계는 건너뛰어도 됩니다.

---

### 단계 5: CloudFormation 스택 삭제

태스크 0에서 CloudFormation으로 선행 리소스를 생성한 경우 스택을 삭제합니다.

82. 상단 검색창에 `CloudFormation`을 입력하고 선택합니다.
83. **Stacks** 목록에서 `step7-1-alb-prereq` 스택을 선택합니다.
84. [[Delete]] 버튼을 클릭합니다.
85. 확인 팝업에서 [[Delete stack]]을 클릭합니다.
86. 스택 상태가 `DELETE_IN_PROGRESS` → `DELETE_COMPLETE`가 될 때까지 기다립니다 (약 3-5분).

> [!NOTE]
> CloudFormation 스택을 삭제하면 스택이 생성한 모든 리소스(VPC, Subnet, IGW, EC2, Security Group)가 자동으로 삭제됩니다.

---

### 단계 6: 삭제 확인

모든 리소스가 정상적으로 삭제되었는지 확인합니다.

87. EC2 콘솔 → **Load Balancers**에서 `starter-alb`가 목록에서 사라졌는지 확인합니다.
88. EC2 콘솔 → **Target Groups**에서 `starter-app-tg`가 삭제되었는지 확인합니다.
89. EC2 콘솔 → **Security Groups**에서 `alb-sg`가 삭제되었는지 확인합니다.
90. CloudFormation 콘솔에서 `step7-1-alb-prereq` 스택이 목록에서 사라졌는지 확인합니다.

> [!NOTE]
> 삭제 직후에는 일부 리소스가 잠시 남아있을 수 있으나, 시간이 지나면 자동으로 사라집니다.

✅ **실습 종료**: 모든 리소스가 정리되었습니다.

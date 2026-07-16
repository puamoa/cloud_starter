---
title: 'Auto Scaling Group으로 자동 확장 설정'
week: 7
session: 3
awsServices:
  - Amazon EC2 Auto Scaling
learningObjectives:
  - Launch Template을 생성하여 인스턴스 설정을 템플릿화할 수 있습니다.
  - Auto Scaling Group을 생성하고 ALB와 연동할 수 있습니다.
  - 스케일링 정책(Target Tracking)을 설정할 수 있습니다.
  - 스케일 아웃/인 동작을 확인할 수 있습니다.
prerequisites:
  - AWS 계정 생성 완료
  - ALB + Target Group 생성 완료 (Step 7-2 참조)
  - VPC + Public Subnet 2개
estimatedCost: 비용 발생 (ALB 시간당 + EC2 시간당 과금, 무료 플랜 적용 여부에 따라 다름)
---

이 실습에서는 Auto Scaling Group(ASG)을 생성하여 트래픽 변화에 따라 Amazon EC2 인스턴스를 자동으로 확장/축소하는 방법을 학습합니다.  
Launch Template으로 인스턴스 설정을 템플릿화하고, ALB와 연동하여 새로 생성된 인스턴스가 자동으로 트래픽을 받도록 구성합니다.

### Step 7 전체 아키텍처

<img src="/images/step7/7-0-architecture.png" alt="Step 7 전체 아키텍처" class="guide-img-md" />

### 7-3 아키텍처: Auto Scaling Group

<img src="/images/step7/7-3-architecture.png" alt="7-3 Auto Scaling Group 아키텍처" class="guide-img-md" />

> [!TIP]
> 이번 실습에서는 Launch Template으로 인스턴스 설정을 템플릿화하고, ASG가 EC2를 자동 생성/종료합니다.  
> Target Tracking 정책으로 CPU 70% 기준 Scale Out/In이 자동 수행됩니다.  
> 셀프 미션에서는 본인 앱(Spring Boot/WAR) 배포 + 커스텀 도메인 HTTPS 연결까지 도전합니다.

### Step 7 전체 구성

| 세션                | 주제                  | 핵심 리소스                     |
| ------------------- | --------------------- | ------------------------------- |
| 7-1                 | Amazon Route 53 + ACM | 도메인 연결, HTTPS 인증서       |
| 7-2                 | ALB + Target Group    | 트래픽 분산, Health Check       |
| **7-3 (이번 실습)** | Auto Scaling Group    | 자동 확장/축소, Launch Template |

```
7-1: 도메인 + HTTPS     →    7-2: ALB 생성 + 도메인 연결  →    7-3: ASG로 자동 확장
(수동 EC2 등록)              (커스텀 도메인 + SSL)             (EC2 자동 생성/삭제)
```

> [!NOTE]
> 이 실습은 Step 7-2에서 생성한 ALB와 Target Group이 필요합니다.  
> 선행 리소스가 없는 경우 태스크 0의 AWS CloudFormation 템플릿을 사용하세요.

### 실습 흐름

```
[선행 리소스 확인] → [ASG 개념] → [Launch Template] → [ASG 생성] → [스케일링 정책] → [동작 확인] → [커스텀 AMI] → [스케일 아웃 테스트]
```

---

## 태스크 0: 선행 리소스 확인

1. AWS Management Console에 로그인합니다.
2. 리전을 **Asia Pacific (Seoul) ap-northeast-2**로 설정합니다.

<img src="/images/common/region-check.png" alt="리전 확인" class="guide-img-sm" />

> [!TIP]
> 일부 AWS 서비스(IAM, CloudFront, Route 53 등)는 **글로벌 서비스**이므로 리전 선택 드롭다운이 비활성화되거나 "Global"로 표시됩니다.  
> 이 실습에서 사용하는 서비스는 리전 기반이므로 반드시 올바른 리전이 선택되어 있는지 확인하세요.

> [!DOWNLOAD]
> [step7-3-asg-lab.zip](/files/step7/step7-3-asg-lab.zip)
>
> - `step7-3-asg-prereq.yaml` — AWS CloudFormation 템플릿 (VPC, 서브넷, IGW, ALB, Target Group, Security Group 자동 생성)
> - `README.md` — 템플릿 파라미터 및 사용 방법 안내

### 필요한 리소스 체크리스트

| 리소스             | 요구 사항                       | 확인 |
| ------------------ | ------------------------------- | ---- |
| VPC                | 1개                             | ☐    |
| Public Subnet      | 2개 (서로 다른 AZ)              | ☐    |
| ALB                | Internet-facing, Active 상태    | ☐    |
| Target Group       | HTTP:80, Health Check: /health/ | ☐    |
| ALB Security Group | 80, 443 포트 허용               | ☐    |

### 리소스가 없는 경우: AWS CloudFormation으로 생성

Step 7-2를 진행하지 않은 경우, 아래 AWS CloudFormation 템플릿으로 ALB와 Target Group을 포함한 모든 선행 리소스를 생성할 수 있습니다.

**AWS CloudFormation 스택 생성:**

3. 상단 검색창에 `CloudFormation`을 입력하고 **CloudFormation** 서비스를 선택합니다.
4. [[Create stack]] 드롭다운을 클릭한 후 **With new resources (standard)**를 선택합니다.
5. **Prerequisite - Prepare template**에서 `Choose an existing template`을 선택합니다.
6. **Specify template**에서 `Upload a template file`을 선택합니다.
7. [[Choose file]] 버튼을 클릭하고 다운로드한 `step7-3-asg-prereq.yaml` 파일을 선택합니다.
8. [[Next]] 버튼을 클릭합니다.
9. **Stack name**에 `step7-3-asg-prereq`를 입력합니다.
10. **Parameters** 섹션에서 다음을 설정합니다:
    - **KeyPairName**: 기존 Key Pair 선택
    - **AppPort**: `80` (기본값, Nginx)
    - 나머지: 기본값 유지
11. [[Next]] 버튼을 클릭합니다.
12. **Configure stack options** 페이지에서 추가 설정 없이 [[Next]] 버튼을 클릭합니다.
13. **Review and create** 페이지에서 설정 내용을 확인합니다.
14. [[Submit]] 버튼을 클릭합니다.

> [!WARNING]
> 스택 생성에 3~5분이 소요됩니다. `CREATE_COMPLETE` 상태가 될 때까지 기다리세요.

✅ **태스크 완료** — 선행 리소스를 확인하거나 AWS CloudFormation으로 생성했습니다.

---

## 태스크 1: Auto Scaling 개념 이해

### 수동 확장의 한계

트래픽이 증가할 때 수동으로 Amazon EC2를 추가하는 방식의 문제점:

```
수동 확장:
- 모니터링 → CPU 90% 감지 (사람이 확인)
- Amazon EC2 콘솔 접속 → 인스턴스 생성 (5~10분)
- 앱 배포 + 설정 (10~20분)
- Target Group에 등록 (수동)
- 트래픽 감소 → 인스턴스 종료 (잊어버리면 비용 낭비)

총 소요 시간: 20~30분 (그 사이 서비스 장애 가능)
```

### Auto Scaling의 자동 확장

```
자동 확장:
- Amazon CloudWatch → CPU 70% 초과 감지 (자동)
- ASG → Launch Template으로 인스턴스 자동 생성 (2~3분)
- User Data로 앱 자동 배포 (자동)
- Target Group에 자동 등록 (자동)
- 트래픽 감소 → 인스턴스 자동 종료 (자동)

총 소요 시간: 2~5분 (무중단)
```

### ASG 구성 요소

```
Auto Scaling Group (ASG)
├── Launch Template (인스턴스 설정 템플릿)
│   ├── AMI (OS 이미지)
│   ├── Instance Type (t3.micro)
│   ├── Key Pair
│   ├── Security Group
│   └── User Data (시작 스크립트)
├── Scaling Policy (확장/축소 규칙)
│   ├── Target Tracking (CPU 평균 70% 유지)
│   ├── Step Scaling (단계별 확장)
│   └── Scheduled (예약 확장)
└── ALB Target Group (트래픽 분산)
```

| 구성 요소              | 역할                                                  |
| ---------------------- | ----------------------------------------------------- |
| **Launch Template**    | 새 인스턴스를 어떻게 생성할지 정의 (AMI, 타입, SG 등) |
| **Auto Scaling Group** | 인스턴스 수를 관리 (Min, Max, Desired)                |
| **Scaling Policy**     | 언제 확장/축소할지 결정 (CPU, 메모리 등 기준)         |

> [!CONCEPT] Desired, Minimum, Maximum Capacity
>
> - **Minimum (1)**: 최소 유지할 인스턴스 수. 이 이하로 줄어들지 않음.
> - **Desired (2)**: 현재 유지하고 싶은 인스턴스 수. ASG가 이 수를 유지하려 함.
> - **Maximum (4)**: 최대 확장 가능한 인스턴스 수. 이 이상 늘어나지 않음.
>
> 예: Min=1, Desired=2, Max=4
>
> - 평상시: 인스턴스 2개 유지
> - 트래픽 증가: 최대 4개까지 확장
> - 트래픽 감소: 최소 1개까지 축소

✅ **태스크 완료** — Auto Scaling의 개념과 구성 요소를 이해했습니다.

---

## 태스크 2: Launch Template 생성

Launch Template은 ASG가 새 인스턴스를 생성할 때 사용할 설정을 정의합니다.

### Launch Template 생성 단계

15. EC2 콘솔 → **Instances** → **Launch Templates**로 이동합니다.
16. [[Create launch template]]을 클릭합니다.

### Launch template name and description

17. **Launch template name**: `starter-app-lt`
18. **Template version description**: `v1 - Nginx with instance identification`
19. ☑️ **Auto Scaling guidance** 체크

> [!TIP]
> **Auto Scaling guidance를 체크하면:**  
> Launch Template 설정 시 ASG에서 사용할 때 필요한 항목(네트워크, SG 등)을 강조 표시해줍니다.  
> 체크하지 않아도 동작에는 문제없지만, 초보자라면 체크해두면 누락을 방지할 수 있습니다.

20. **Template tags** 섹션을 펼치고 [[Add tag]]를 클릭하여 태그를 추가합니다:
    - **Key**: `CreatedBy`, **Value**: `admin-user`
    - **Key**: `Step`, **Value**: `step7`
    - **Key**: `Session`, **Value**: `7-3`

### Application and OS Images (AMI)

21. **Quick Start** → **Amazon Linux** 선택
22. **Amazon Linux 2023 AMI** 선택

> [!NOTE]
> AMI는 인스턴스의 OS 이미지입니다.  
> Amazon Linux 2023은 최신 보안 패치가 적용된 AWS 최적화 Linux입니다.

### Instance type

23. **Instance type**: `t3.micro`

> [!TIP]
> **Instance type 선택:**
>
> | 타입      | vCPU | 메모리 | 적합한 경우                 |
> | --------- | ---- | ------ | --------------------------- |
> | t3.micro  | 2    | 1GB    | 학습/테스트, 가벼운 웹 서버 |
> | t3.small  | 2    | 2GB    | Spring Boot 등 Java 앱      |
> | t3.medium | 2    | 4GB    | 프로덕션 소규모 앱          |
>
> Launch Template에서 지정하지 않아도 ASG 생성 시 **Instance type override**로 여러 타입을 선택할 수 있습니다.  
> 이 실습에서는 Launch Template에 `t3.micro`를 지정하는 단순 구성을 사용합니다.

### Key pair

24. **Key pair**: 기존 Key Pair를 선택합니다.

> [!TIP]
> Auto Scaling으로 생성된 인스턴스에 SSH 접속이 필요한 경우 Key Pair를 설정합니다.  
> 프로덕션 환경에서는 SSM Session Manager를 사용하여 Key Pair 없이 접속하는 것을 권장합니다.

### Network settings

25. **Security groups**: EC2용 Security Group을 선택합니다.
    - Step 7-2에서 생성한 Security Group (ALB에서 80 허용)
    - 또는 AWS CloudFormation으로 생성된 `EC2SecurityGroup`

> [!TIP]
> Launch Template에서 설정한 Security Group은 ASG가 생성하는 모든 EC2에 자동 적용됩니다.  
> ALB에서 오는 트래픽(80)과 SSH(22)만 허용하는 SG를 선택하세요.  
> **주의:** Security Group은 VPC에 종속되므로, 여기서 SG를 지정하면 ASG 생성 시 해당 VPC의 서브넷만 선택할 수 있습니다.  
> 여러 VPC에서 재사용하려면 Launch Template에서 SG를 지정하지 않고, ASG 생성 시 지정하는 방법도 있습니다.

### Resource tags

26. **Resource tags** 섹션을 펼치고 [[Add tag]]를 클릭하여 태그를 추가합니다:
    - **Key**: `Name`, **Value**: `starter-app-asg-instance`
    - **Key**: `CreatedBy`, **Value**: `admin-user`
    - **Key**: `Step`, **Value**: `step7`
    - **Key**: `Session`, **Value**: `7-3`
    - **Resource types**: `Instances`, `Volumes` 체크

> [!TIP]
> **Template tags vs Resource tags:**
>
> | 구분          | 적용 대상                       | 용도                           |
> | ------------- | ------------------------------- | ------------------------------ |
> | Template tags | Launch Template 자체            | 콘솔에서 템플릿 관리/검색용    |
> | Resource tags | 생성되는 EC2 인스턴스, EBS 볼륨 | 인스턴스에 Name 태그 자동 부여 |
>
> Resource tags에 `Name`을 넣으면 ASG가 EC2를 생성할 때 자동으로 해당 이름이 붙어 EC2 콘솔에서 식별하기 쉽습니다.

### Advanced details → User Data

27. **Advanced details**를 펼칩니다.
28. 맨 아래 **User Data** 영역에 다음 스크립트를 입력합니다:

```bash
#!/bin/bash
# ASG Launch Template - Nginx + 인스턴스 식별 페이지
# 7-1 CloudFormation UserData와 동일한 구성

dnf update -y
dnf install -y nginx

# IMDSv2 토큰 획득 후 인스턴스 메타데이터 조회
TOKEN=$(curl -s -X PUT "http://169.254.169.254/latest/api/token" \
  -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")
INSTANCE_ID=$(curl -s -H "X-aws-ec2-metadata-token: $TOKEN" \
  http://169.254.169.254/latest/meta-data/instance-id)
AZ=$(curl -s -H "X-aws-ec2-metadata-token: $TOKEN" \
  http://169.254.169.254/latest/meta-data/placement/availability-zone)
PRIVATE_IP=$(curl -s -H "X-aws-ec2-metadata-token: $TOKEN" \
  http://169.254.169.254/latest/meta-data/local-ipv4)

# 인스턴스 식별 HTML 페이지 생성
cat > /usr/share/nginx/html/index.html <<EOF
<!DOCTYPE html>
<html>
<head><title>ASG Lab</title>
<style>
  body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
  .card { background: white; border-radius: 10px; padding: 30px; max-width: 500px;
          margin: 0 auto; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
  .instance-id { color: #2563eb; font-size: 1.2em; font-weight: bold; }
  .az { color: #059669; }
</style>
</head>
<body>
  <div class="card">
    <h1>Hello from ASG!</h1>
    <p class="instance-id">Instance: $INSTANCE_ID</p>
    <p class="az">AZ: $AZ</p>
    <p>Private IP: $PRIVATE_IP</p>
    <hr>
    <p><small>Refresh to see load balancing across ASG instances</small></p>
  </div>
</body>
</html>
EOF

# Health Check 엔드포인트
mkdir -p /usr/share/nginx/html/health
echo "OK" > /usr/share/nginx/html/health/index.html

systemctl start nginx
systemctl enable nginx
```

> [!CONCEPT] User Data란?
>
> User Data는 Amazon EC2 인스턴스가 **최초 시작될 때 한 번** 실행되는 스크립트입니다.
> ASG가 새 인스턴스를 생성할 때마다 이 스크립트가 자동 실행되어:
>
> - Nginx를 설치하고
> - 인스턴스 식별 페이지를 생성하고
> - Health Check 엔드포인트를 만듭니다.
>
> 이를 통해 사람의 개입 없이 새 인스턴스가 자동으로 서비스를 시작합니다.  
> 단, **최초 부팅 시 1번만 실행**되므로 설치 시간(1~2분)이 인스턴스 시작 시간에 포함됩니다.  
> 태스크 6에서 커스텀 AMI를 사용하면 이 시간을 단축할 수 있습니다.

29. [[Create launch template]]을 클릭합니다.

> [!OUTPUT]
> "Successfully created starter-app-lt" 메시지가 표시됩니다.
>
> **Next Steps** 화면에서 다음 옵션이 안내됩니다:
>
> - **Launch instance from this template** — 이 템플릿으로 EC2를 바로 생성 (이 실습에서는 사용하지 않음)
> - **Create Auto Scaling group** — 다음 태스크에서 진행합니다.
> - **Create Spot Fleet** — Spot 인스턴스 활용 (이 실습에서는 사용하지 않음)

✅ **태스크 완료** — Launch Template을 생성하여 인스턴스 설정을 템플릿화했습니다.

---

## 태스크 3: Auto Scaling Group 생성

Launch Template을 기반으로 Auto Scaling Group을 생성합니다.

### ASG 생성 단계

30. EC2 콘솔 → **Auto Scaling** → **Auto Scaling Groups**로 이동합니다.
31. [[Create Auto Scaling group]]을 클릭합니다.

### Step 1: Choose launch template

32. **Auto Scaling group name**: `starter-app-asg`
33. **Launch template**: `starter-app-lt` 선택
34. **Version**: Latest (1)
35. [[Next]]를 클릭합니다.

### Step 2: Choose instance launch options

36. **VPC**: 실습용 VPC를 선택합니다 (예: `asg-lab-vpc`).
37. **Availability Zones and subnets**: 2개의 Public Subnet을 선택합니다.
    - ✅ `ap-northeast-2a` — `asg-lab-public-subnet-1` (AWS CloudFormation으로 생성한 경우)
    - ✅ `ap-northeast-2c` — `asg-lab-public-subnet-2`
    - **Availability Zone distribution**: `Balanced best effort` (기본값 유지)
    - **Additional capacity settings** → **Capacity Reservation preference**: `Default` (기본값 유지)

> [!NOTE]
> 2개의 AZ에 걸쳐 인스턴스를 배치하면, 하나의 AZ에 장애가 발생해도
> 다른 AZ의 인스턴스가 서비스를 유지합니다 (고가용성).
>
> **Availability Zone distribution 옵션:**
>
> | 옵션                            | 동작                                                 | 적합한 경우            |
> | ------------------------------- | ---------------------------------------------------- | ---------------------- |
> | **Balanced best effort** (기본) | AZ 간 균등 분배 시도. 한 AZ 실패 시 다른 AZ에서 생성 | 대부분의 워크로드      |
> | Balanced only                   | AZ 간 균등 분배 고수. 한 AZ 실패해도 균형 유지 시도  | 엄격한 AZ 균등 필요 시 |
> | Reservations Then Balanced      | Capacity Reservation 우선 사용 후 균형 분배          | 예약 용량이 있는 경우  |
>
> 이 실습에서는 **Balanced best effort**를 사용합니다.

38. [[Next]]를 클릭합니다.

### Step 3: Integrate with other services (optional)

**Load balancing** 섹션:

39. **Select Load balancing options**: **Attach to an existing load balancer**를 선택합니다.
    - 기본값은 "No load balancer"이지만, ALB와 연동해야 하므로 변경합니다.
40. **Choose from your load balancer target groups**를 선택합니다.
41. **Existing load balancer target groups**: `starter-app-tg | HTTP` 선택 (예: `asg-lab-tg`)

> [!CONCEPT] ASG + ALB 연동의 의미
>
> ASG를 ALB Target Group에 연결하면:
>
> - ASG가 새 인스턴스를 생성하면 → **자동으로 Target Group에 등록**
> - ASG가 인스턴스를 종료하면 → **자동으로 Target Group에서 제거**
>
> 수동으로 Target Group에 인스턴스를 등록/해제할 필요가 없습니다.

**VPC Lattice integration options** 섹션:

42. **Select VPC Lattice service to attach**: `No VPC Lattice service` (기본값 유지)

**Application Recovery Controller (ARC) zonal shift** 섹션:

43. **Enable zonal shift**: 체크하지 않음 (기본값 유지)

**Health checks** 섹션:

44. **EC2 health checks**: Always enabled (변경 불가)
45. **Additional health check types**:
    - ✅ **Turn on Elastic Load Balancing health checks** 체크
    - 나머지(VPC Lattice, Amazon EBS)는 체크하지 않음
46. **Health check grace period**: `300` seconds

> [!TIP]
> **Elastic Load Balancing health checks를 켜면:**  
> ALB의 Health Check 결과도 ASG의 판단 기준에 포함됩니다.  
> 앱이 응답하지 않는 인스턴스를 ASG가 자동으로 교체합니다.
>
> **Health check grace period(300초):**  
> 인스턴스 시작 후 이 시간 동안은 Health Check를 하지 않습니다.  
> User Data 실행 + Nginx 시작에 시간이 필요하므로 충분히 설정합니다.  
> 너무 짧으면 앱이 준비되기 전에 unhealthy로 판정되어 무한 교체가 발생할 수 있습니다.

47. [[Next]]를 클릭합니다.

### Step 4: Configure group size and scaling

**Group size** 섹션:

48. **Desired capacity type**: `Units (number of instances)` (기본값)
49. **Desired capacity**: `2`

**Scaling** 섹션:

50. **Scaling limits**:
    - **Min desired capacity**: `1`
    - **Max desired capacity**: `4`
51. **Automatic scaling**: **Target tracking scaling policy**를 선택합니다.
    - 기본값은 "No scaling policies"이지만, CPU 기반 자동 확장을 위해 변경합니다.
    - **Metric type**: Average CPU utilization
    - **Target value**: `70`
    - **Instance warmup**: `300` seconds

> [!CONCEPT] Target Tracking Scaling Policy
>
> Target Tracking은 지정한 메트릭(CPU 사용률)을 목표값(70%)에 맞추도록
> 자동으로 인스턴스를 추가/제거합니다.
>
> - CPU 평균 > 70% → 인스턴스 추가 (Scale Out)
> - CPU 평균 < 70% → 인스턴스 제거 (Scale In)
>
> AWS가 자동으로 Amazon CloudWatch 메트릭을 모니터링하고 스케일링을 수행합니다.
> 가장 간단하고 권장되는 스케일링 방식입니다.

**Instance maintenance policy** 섹션:

52. **Choose a replacement behavior**: `No policy` (기본값 유지)

**Additional settings** 섹션:

53. 모든 항목 기본값 유지:
    - **Instance scale-in protection**: 체크하지 않음
    - **Monitoring**: 체크하지 않음
    - **Default instance warmup**: 체크하지 않음
    - **Auto Scaling group deletion protection**: `None (default)`
    - **Placement group**: `None`
54. [[Next]]를 클릭합니다.

### Step 5: Add notifications (선택)

55. 알림이 필요하면 SNS Topic을 설정합니다. 이 실습에서는 건너뜁니다.
56. [[Next]]를 클릭합니다.

### Step 6: Add tags

57. [[Add tag]]를 클릭하여 다음 태그를 추가합니다:
    - **Key**: `Name`, **Value**: `starter-app-asg-instance`, ✅ **Tag new instances** 체크
    - **Key**: `CreatedBy`, **Value**: `admin-user`, ✅ **Tag new instances** 체크
    - **Key**: `Step`, **Value**: `step7`, ✅ **Tag new instances** 체크
    - **Key**: `Session`, **Value**: `7-3`, ✅ **Tag new instances** 체크

> [!TIP]
> **Tag new instances**를 체크하면 ASG가 생성하는 모든 EC2에 이 태그가 자동 적용됩니다.  
> Launch Template의 Resource tags에도 동일한 태그를 넣었지만, ASG 태그는 **ASG 자체**와 **인스턴스**에 모두 적용되어 Tag Editor에서 ASG 리소스도 검색할 수 있습니다.

58. [[Next]]를 클릭합니다.

### Step 7: Review

59. 설정을 검토합니다:
    - Launch template: `starter-app-lt`
    - VPC + Subnets: 2개 AZ
    - Load balancer: `starter-app-tg`
    - Desired: 2, Min: 1, Max: 4
    - Scaling policy: CPU 70% Target Tracking
60. [[Create Auto Scaling group]]을 클릭합니다.

> [!OUTPUT]
> Auto Scaling Group이 생성되었습니다:
>
> - **starter-app-asg** — Status: `Updating capacity`
> - **1 Scaling policy created successfully** (Target Tracking)
> - Desired: 2 → 즉시 2개의 Amazon EC2 인스턴스 생성 시작
> - Launch Template: `starter-app-lt` (v1)
> - Target Group: `starter-app-tg` 연결됨
>
> ASG 목록에서 `starter-app-asg`의 상태가 `Updating capacity`로 표시되며,  
> Desired capacity(2)를 맞추기 위해 인스턴스를 생성 중입니다.

✅ **태스크 완료** — Auto Scaling Group을 생성하고 ALB Target Group과 연동했습니다.

> [!TROUBLESHOOTING]
> | 증상 | 원인 | 해결 방법 |
> |------|------|-----------|
> | ASG 생성 후 인스턴스가 즉시 종료됨 | User Data 스크립트 오류 | EC2 → 인스턴스 → Actions → Monitor → Get system log 확인 |
> | 인스턴스가 `unhealthy`로 반복 교체됨 | Health check grace period 부족 | Grace period를 300초 이상으로 설정 |
> | "Failed to launch instances" 에러 | 서브넷에 가용 IP 부족 또는 인스턴스 한도 초과 | VPC 서브넷 IP 확인, Service Quotas에서 EC2 한도 확인 |
> | Target Group에 인스턴스 미등록 | ASG와 Target Group 연결 누락 | ASG → Edit → Load balancing에서 TG 연결 확인 |

---

## 태스크 4: 스케일링 정책 확인

ASG 생성 시 설정한 Target Tracking 정책을 확인합니다.

### ASG Activity 확인

61. EC2 콘솔 → **Auto Scaling Groups** → `starter-app-asg` 클릭
62. **Activity** 탭을 클릭합니다.
63. 인스턴스 생성 활동을 확인합니다:

```
Activity history:
- Launching a new EC2 instance: i-0abc123... (Successful)
- Launching a new EC2 instance: i-0def456... (Successful)
```

### 스케일링 정책 상세 확인

64. **Automatic scaling** 탭을 클릭합니다.
65. `cpu-target-tracking` 정책을 확인합니다:

- Metric type: Average CPU utilization
- Target value: 70
- Instances need: 300 seconds warm up

> [!CONCEPT] Warm-up 시간
>
> 새로 생성된 인스턴스는 앱 시작까지 시간이 걸립니다.  
> Warm-up 기간(300초) 동안은 해당 인스턴스의 CPU 메트릭이 스케일링 판단에서 제외됩니다.  
> 이를 통해 앱 시작 중의 높은 CPU가 추가 Scale Out을 유발하는 것을 방지합니다.

### Amazon CloudWatch 알람 확인

Target Tracking 정책은 Amazon CloudWatch 알람을 자동으로 생성합니다.

66. 상단 검색창에 `CloudWatch`를 입력하고 **CloudWatch** 서비스를 선택합니다.
67. **리전이 `ap-northeast-2` (서울)인지 반드시 확인합니다.**
68. 왼쪽 메뉴에서 **Alarms**를 클릭합니다.
69. ASG가 자동으로 생성한 알람 2개를 확인합니다:

| 알람 이름                          | 조건                | 동작                      |
| ---------------------------------- | ------------------- | ------------------------- |
| `TargetTracking-...-AlarmHigh-...` | CPU > 70% (수 분간) | Scale Out (인스턴스 추가) |
| `TargetTracking-...-AlarmLow-...`  | CPU < 목표값 이하   | Scale In (인스턴스 제거)  |

> [!WARNING]
> 알람이 보이지 않는다면 **리전을 확인**하세요.  
> Amazon CloudWatch는 리전별 서비스이므로, ASG가 있는 리전(서울)과 동일한 리전에서 확인해야 합니다.

> [!TIP]
> 이 알람은 ASG가 자동으로 생성하고 관리합니다.  
> 수동으로 수정하거나 삭제하지 마세요 — ASG 삭제 시 함께 삭제됩니다.

✅ **태스크 완료** — Target Tracking 스케일링 정책과 Amazon CloudWatch 알람을 확인했습니다.

---

## 태스크 5: 동작 확인

ASG가 생성한 인스턴스가 정상적으로 동작하는지 확인합니다.

### EC2 인스턴스 확인

> [!TIP]
> ASG 생성 후 시간이 지나면 트래픽이 없어 CPU 사용률이 목표값(70%) 이하로 유지되므로,  
> Scale In이 발생하여 인스턴스가 Desired(2) → Min(1)으로 줄어 있을 수 있습니다.  
> 이 경우 ASG → **Details** → [[Edit]]에서 **Desired capacity**를 `2`로 다시 설정하면 인스턴스가 재생성됩니다.  
> 천천히 실습을 진행할 예정이라면 **Min desired capacity**도 `2`로 변경해두면 다시 줄어드는 것을 방지할 수 있습니다.

70. EC2 콘솔 → **Instances**로 이동합니다.
71. `starter-app-asg-instance` 이름의 인스턴스 2개가 Running 상태인지 확인합니다.
72. 각 인스턴스가 서로 다른 AZ에 배치되었는지 확인합니다:
    - Instance 1: `ap-northeast-2a`
    - Instance 2: `ap-northeast-2c`

> [!NOTE]
> ASG는 인스턴스를 AZ 간에 균등하게 분배합니다.  
> Desired=2이면 각 AZ에 1개씩 배치됩니다.  
> 이를 통해 하나의 AZ에 장애가 발생해도 다른 AZ의 인스턴스가 서비스를 유지합니다.

### Target Group Health 확인

73. EC2 콘솔 → **Target Groups** → `starter-app-tg` 클릭
74. **Targets** 탭에서 등록된 인스턴스를 확인합니다:

```
Target Group: starter-app-tg
┌─────────────────┬──────────┬────────────────┬─────────────────┐
│ Instance        │ Port     │ Health Status  │ AZ              │
├─────────────────┼──────────┼────────────────┼─────────────────┤
│ i-0abc123...    │ 80       │ ✅ healthy     │ ap-northeast-2a │
│ i-0def456...    │ 80       │ ✅ healthy     │ ap-northeast-2c │
└─────────────────┴──────────┴────────────────┴─────────────────┘
```

> [!WARNING]
> 인스턴스가 `unhealthy` 상태인 경우:
>
> - User Data 스크립트가 정상 실행되었는지 확인 (시스템 로그 확인)
> - Health Check 경로가 올바른지 확인
> - Security Group에서 80 포트가 ALB에서 허용되는지 확인
> - Health check grace period(300초)가 지났는지 확인
>
> 시스템 로그 확인: EC2 → 인스턴스 선택 → Actions → Monitor and troubleshoot → Get system log

### ALB DNS로 접속 확인

75. Load Balancers → `starter-alb` (또는 `asg-lab-alb`) → DNS name 복사
76. 브라우저에서 접속합니다:

```
http://your-alb-dns-name.ap-northeast-2.elb.amazonaws.com
```

77. 여러 번 새로고침하여 트래픽이 분산되는지 확인합니다.
    - User Data에서 인스턴스 식별 페이지를 설정했으므로 새로고침할 때마다 Instance ID와 AZ가 바뀌는 것을 확인할 수 있습니다.

### 인스턴스 자동 복구 테스트

78. EC2 콘솔에서 ASG가 생성한 인스턴스 1개를 **수동으로 종료**합니다.
    - 인스턴스 선택 → **Instance state** → [[Terminate instance]]

79. 1~2분 후 ASG가 새 인스턴스를 자동으로 생성하는지 확인합니다.

> [!OUTPUT]
> 인스턴스를 수동 종료하면 ASG가 감지하고 새 인스턴스를 자동 생성합니다:
>
> Activity history:
>
> - Terminating EC2 instance: i-0abc123... (인스턴스 종료됨)
> - Launching a new EC2 instance: i-0ghi789... (새 인스턴스 생성)
>
> Desired capacity(2)를 유지하기 위해 ASG가 자동으로 인스턴스를 교체합니다.

> [!WARNING]
> ASG가 관리하는 인스턴스는 수동으로 종료해도 자동으로 다시 생성됩니다.  
> 따라서 인스턴스를 완전히 없애려면:
>
> - **ASG 자체를 삭제**하거나
> - ASG → Details → Edit에서 **Min / Desired / Max를 모두 `0`으로 설정**
>
> EC2만 종료하면 ASG가 계속 새 인스턴스를 만들어 비용이 발생하니 주의하세요.

✅ **태스크 완료** — ASG가 생성한 인스턴스의 정상 동작과 자동 복구를 확인했습니다.

---

## 태스크 6: Launch Template 버전 업 (커스텀 AMI)

현재 Launch Template v1은 공식 AMI + UserData로 앱을 설치합니다.  
UserData는 인스턴스 **최초 부팅 시 1번만 실행**되므로, 인스턴스가 시작될 때마다 설치 시간이 소요됩니다.

이번 태스크에서는 이미 앱이 설치된 EC2에서 **커스텀 AMI**를 생성하고, Launch Template의 새 버전(v2)에 적용하여 시작 시간을 단축합니다.

### UserData vs 커스텀 AMI 비교

| 항목               | UserData (v1)          | 커스텀 AMI (v2)                       |
| ------------------ | ---------------------- | ------------------------------------- |
| 인스턴스 시작 시간 | 2~5분 (설치 시간 포함) | 30초~1분 (이미 설치됨)                |
| 유지보수           | 스크립트 수정으로 변경 | AMI를 다시 생성해야 함                |
| 적합한 경우        | 설정이 자주 바뀔 때    | 앱이 안정적이고 빠른 시작이 필요할 때 |

> [!CONCEPT] 커스텀 AMI란?
>
> - 실행 중인 Amazon EC2에서 **이미지(AMI)**를 생성하면, 그 시점의 OS + 설치된 소프트웨어 + 설정이 모두 포함됩니다.
> - 이 AMI로 새 인스턴스를 시작하면 처음부터 동일한 상태로 바로 실행됩니다.
> - Amazon EC2 콘솔 → 인스턴스 선택 → **Actions** → **Image and templates** → **Create image**로 생성합니다.

### SSH 접속 후 코드 수정

80. ASG가 생성한 인스턴스 중 하나의 Public IP를 확인합니다.
    - EC2 콘솔 → Instances → `starter-app-asg-instance` 선택 → **Public IPv4 address** 복사
81. SSH로 접속합니다:

```bash
ssh -i your-key.pem ec2-user@<instance-public-ip>
```

82. 기존 index.html을 v2 버전으로 수정합니다 (색상 변경 + v2 표시):

```bash
TOKEN=$(curl -s -X PUT "http://169.254.169.254/latest/api/token" \
  -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")
INSTANCE_ID=$(curl -s -H "X-aws-ec2-metadata-token: $TOKEN" \
  http://169.254.169.254/latest/meta-data/instance-id)
AZ=$(curl -s -H "X-aws-ec2-metadata-token: $TOKEN" \
  http://169.254.169.254/latest/meta-data/placement/availability-zone)
PRIVATE_IP=$(curl -s -H "X-aws-ec2-metadata-token: $TOKEN" \
  http://169.254.169.254/latest/meta-data/local-ipv4)

sudo tee /usr/share/nginx/html/index.html > /dev/null <<EOF
<!DOCTYPE html>
<html>
<head><title>ASG Lab v2</title>
<style>
  body { font-family: Arial, sans-serif; text-align: center; padding: 50px;
         background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
  .card { background: rgba(255,255,255,0.95); border-radius: 10px; padding: 30px;
          max-width: 500px; margin: 0 auto; box-shadow: 0 4px 20px rgba(0,0,0,0.3); color: #333; }
  .version { color: #764ba2; font-size: 1.4em; font-weight: bold; }
  .instance-id { color: #2563eb; font-size: 1.1em; }
  .az { color: #059669; }
</style>
</head>
<body>
  <div class="card">
    <p class="version">&#128640; ASG Lab v2 (Custom AMI)</p>
    <h1>Hello from ASG!</h1>
    <p class="instance-id">Instance: $INSTANCE_ID</p>
    <p class="az">AZ: $AZ</p>
    <p>Private IP: $PRIVATE_IP</p>
    <hr>
    <p><small>Custom AMI - No UserData execution needed</small></p>
  </div>
</body>
</html>
EOF
```

83. 브라우저에서 해당 인스턴스 IP로 접속하여 v2 페이지가 표시되는지 확인합니다.
84. SSH 세션을 종료합니다: `exit`

### 커스텀 AMI 생성

85. EC2 콘솔 → **Instances**에서 방금 수정한 인스턴스를 선택합니다.
86. **Actions** → **Image and templates** → **Create image**를 클릭합니다.
87. 다음을 설정합니다:
    - **Image name**: `starter-app-ami-v2`
    - **Image description**: (비워둡니다)
    - **Reboot instance**: ✅ 체크 유지 (기본값, 데이터 일관성 보장)
    - **Instance volumes**: 기본값 유지 (8GB, gp3, Delete on termination ✅)
    - **Tags**: `Tag image and snapshots together`를 선택하고 [[Add new tag]]를 클릭합니다:
      - **Key**: `Name`, **Value**: `starter-app-ami-v2`
      - **Key**: `CreatedBy`, **Value**: `admin-user`
      - **Key**: `Step`, **Value**: `step7`
      - **Key**: `Session`, **Value**: `7-3`

> [!TIP]
> **Delete on termination:**  
> 이 옵션이 체크되어 있으면 인스턴스가 종료(Terminate)될 때 EBS 볼륨도 함께 삭제됩니다.  
> ASG 환경에서는 Scale In 시 인스턴스가 자동 종료되므로, 체크해두지 않으면 고아 볼륨이 남아 스토리지 비용이 계속 발생합니다.  
> 기본값(✅ Enable)을 유지하세요.

88. [[Create image]]를 클릭합니다. 88. 왼쪽 메뉴 **Images** → **AMIs**에서 생성 상태를 확인합니다.
    - Status: `pending` → `available` (2~5분 소요)

> [!TIP]
> **Reboot instance를 체크하면:**  
> AMI 생성 시 인스턴스를 재부팅하여 파일 시스템의 일관성을 보장합니다.  
> 체크를 해제(No reboot)하면 재부팅 없이 생성되지만, 메모리에만 있는 데이터가 누락될 수 있습니다.  
> 실습에서는 기본값(체크)을 권장합니다.

> [!WARNING]
> AMI Status가 `available`이 될 때까지 기다린 후 다음 단계를 진행하세요.  
> Reboot 옵션을 사용하면 인스턴스가 잠시 중단되므로 Health Check에서 unhealthy로 판정될 수 있으나, ASG가 grace period 내에서는 교체하지 않으므로 정상 복귀됩니다.

> [!NOTE]
> **AMI 비용 안내:**  
> AMI 자체는 무료이지만, AMI에 포함된 EBS 스냅샷에 대해 스토리지 비용이 발생합니다.  
> (예: 8GB gp3 스냅샷 ≈ 월 $0.40)  
> 실습 후 AMI가 불필요하면 리소스 정리에서 반드시 삭제하세요.

### Launch Template 새 버전 생성

89. EC2 콘솔 → **Instances** → **Launch Templates**로 이동합니다.
90. `starter-app-lt`를 선택하고 **Actions** → **Modify template (Create new version)**을 클릭합니다.
91. **Source template version**: `1 (Default)` 선택
92. **Template version description**: `v2 - Custom AMI with purple theme`
93. **Application and OS Images (AMI)** 섹션에서:
    - 현재 공식 AMI(Amazon Linux 2023)가 선택되어 있습니다.
    - **My AMIs** 탭을 클릭합니다.
    - **Owned by me**에서 `starter-app-ami-v2`를 선택합니다.
94. 나머지 항목은 v1에서 가져온 값이 자동 유지되므로 변경하지 않습니다:
    - **Instance type**: `t3.micro` (유지)
    - **Key pair**: 기존 Key Pair (유지)
    - **Network settings**: Security Group (유지)
95. **Storage (volumes)**: 기본값 유지 (AMI에 포함된 볼륨 정보가 자동 표시됨)

> [!NOTE]
> "AMI Volumes are not included in the template unless modified"로 표시되면 정상입니다.  
> 커스텀 AMI의 스냅샷이 인스턴스 시작 시 자동으로 적용됩니다.

96. **Advanced details**를 펼칩니다.
97. 맨 아래 **User Data** 영역의 내용을 모두 삭제합니다 (비워둡니다).

> [!TIP]
> 커스텀 AMI에는 이미 Nginx + 설정이 포함되어 있으므로 User Data가 불필요합니다.  
> User Data를 비우지 않으면 인스턴스 시작 시 스크립트가 다시 실행되어 AMI의 설정을 덮어쓸 수 있습니다.

98. 하단 **Summary**에서 설정을 확인합니다:
    - Software Image (AMI): `starter-app-ami-v2`
    - Virtual server type: `t3.micro`
    - Firewall: EC2 Security Group
    - Storage: 1 volume(s) - 8 GiB
99. [[Create template version]]을 클릭합니다.

### ASG 확인

태스크 3에서 ASG 생성 시 Version을 `Latest`로 설정했으므로, 새 버전(v2)이 자동으로 반영됩니다.

100. EC2 콘솔 → **Auto Scaling** → **Auto Scaling Groups** → `starter-app-asg`를 클릭합니다.
101. **Details** 탭에서 Launch template의 Version이 `Latest`로 설정되어 있는지 확인합니다.

> [!TIP]
> Version이 `Latest`이면 별도 수정 없이 다음 Scale Out부터 v2 AMI가 자동 적용됩니다.  
> 만약 Version이 특정 번호(예: `1`)로 고정되어 있다면 [[Edit]] → `Latest`로 변경하세요.

✅ **태스크 완료** — 커스텀 AMI로 Launch Template v2를 생성하고 ASG에 적용을 확인했습니다.

---

## 태스크 7: 스케일 아웃 테스트 (선택)

> [!WARNING]
> 이 태스크는 선택 사항입니다. CPU 부하를 발생시켜 Scale Out을 테스트합니다.  
> 추가 인스턴스가 생성되므로 약간의 비용이 발생할 수 있습니다.  
> 테스트 후 반드시 리소스를 정리하세요.

### stress 도구로 CPU 부하 발생

ASG가 생성한 **모든 인스턴스**에 SSH로 접속하여 CPU 부하를 발생시킵니다.

> [!WARNING]
> Target Tracking은 ASG 전체 인스턴스의 **평균 CPU**를 기준으로 판단합니다.  
> 인스턴스가 2개인데 1개에서만 stress를 실행하면 평균 CPU가 약 50%에 머물러 Scale Out이 발생하지 않습니다.  
> **모든 인스턴스에서 동시에 실행**해야 평균이 70%를 초과합니다.

102. ASG가 생성한 인스턴스 **각각**에 SSH 터미널을 열어 접속합니다:

```bash
ssh -i your-key.pem ec2-user@<instance-public-ip>
```

103. stress 도구를 설치합니다:

```bash
# Amazon Linux 2023
sudo dnf install -y stress
```

104. CPU 부하를 발생시킵니다:

```bash
# CPU 100% 부하 (10분간)
stress --cpu 4 --timeout 600
```

> [!NOTE]
> t3.micro는 vCPU 2개이지만, 확실히 CPU 100%를 달성하려면 `--cpu 4`로 설정합니다.  
> 10분(600초) 후 자동으로 종료됩니다.

> [!TIP]
> 10분이 지나도 Scale Out이 발생하지 않으면:
>
> - 시간을 늘려서 다시 실행: `stress --cpu 2 --timeout 900` (15분)
> - 또는 명령어를 한 번 더 실행하여 부하를 연장합니다.
>
> Target Tracking은 메트릭을 수 분간 관찰한 뒤 판단하므로, 부하가 충분히 지속되어야 Scale Out이 트리거됩니다.

### Scale Out 확인

105. **5~7분 후** ASG Activity를 확인합니다:


    - EC2 콘솔 → Auto Scaling Groups → `starter-app-asg` → **Activity** 탭

```
Activity history:
- Launching a new EC2 instance: i-0abc123... (Scale Out)
  Cause: TargetTracking-...-AlarmHigh in state ALARM triggered policy Target Tracking Policy
  changing the desired capacity from 2 to 3.
```

106. EC2 콘솔에서 인스턴스가 3개로 증가했는지 확인합니다.
107. Target Group에서 새 인스턴스가 등록되고 healthy 상태가 되는지 확인합니다.

### Scale In 확인

108. stress 명령이 종료된 후 (10분 후) CPU가 정상으로 돌아옵니다.
109. **약 15분 후** Scale In이 발생합니다:


    - Activity 탭에서 "Terminating EC2 instance" 이력 확인
    - 인스턴스 1개가 자동 종료됨

> [!NOTE]
> Scale In은 Scale Out보다 느리게 동작합니다 (기본 15분 대기).  
> 이는 트래픽이 일시적으로 감소했다가 다시 증가하는 경우를 대비하여 불필요한 인스턴스 생성/종료 반복(flapping)을 방지하기 위함입니다.

### CLI로 스케일링 활동 확인

```bash
aws autoscaling describe-scaling-activities \
  --auto-scaling-group-name starter-app-asg \
  --max-items 5
```

> [!OUTPUT]
>
> ```json
> {
>   "Activities": [
>     {
>       "ActivityId": "abc123...",
>       "AutoScalingGroupName": "starter-app-asg",
>       "Description": "Launching a new EC2 instance: i-0jkl012...",
>       "Cause": "Target tracking scaling policy cpu-target-tracking",
>       "StatusCode": "Successful",
>       "StartTime": "2025-01-20T14:30:00Z"
>     }
>   ]
> }
> ```

✅ **태스크 완료** — CPU 부하를 통해 Scale Out/In 동작을 확인했습니다.

---

## 🎯 셀프 미션: 본인 앱으로 Launch Template 구성 (선택)

태스크 6에서 배운 Launch Template 버전 업을 활용하여, Nginx 대신 **본인의 Spring Boot 또는 Spring Legacy 앱**으로 ASG를 구성해보세요.

### 미션 목표

- Launch Template v3를 생성하여 본인 앱이 자동 배포되도록 구성합니다.
- ASG의 인스턴스가 자동으로 앱을 실행하고, ALB Health Check를 통과해야 합니다.

### 힌트: UserData 작성 가이드

**Spring Boot (JAR 배포):**

```bash
#!/bin/bash
dnf update -y
dnf install -y java-17-amazon-corretto-headless

# JAR 파일을 S3에서 다운로드 (본인 S3 버킷으로 변경)
aws s3 cp s3://<버킷명>/app.jar /opt/app/app.jar

# systemd 서비스 등록
cat > /etc/systemd/system/app.service << 'EOF'
[Unit]
Description=Spring Boot App
After=network.target
[Service]
ExecStart=/usr/bin/java -jar /opt/app/app.jar --server.port=80
Restart=always
[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable app
systemctl start app
```

**Spring Legacy (WAR + Tomcat 배포):**

```bash
#!/bin/bash
dnf update -y
dnf install -y java-17-amazon-corretto tomcat

# WAR 파일을 S3에서 다운로드
aws s3 cp s3://<버킷명>/app.war /usr/share/tomcat/webapps/ROOT.war

systemctl enable tomcat
systemctl start tomcat
```

### 체크리스트

- [ ] EC2 IAM Role에 `AmazonS3ReadOnlyAccess` 정책 추가
- [ ] S3에 JAR/WAR 파일 업로드 완료
- [ ] Health Check 경로를 앱에 맞게 변경 (예: `/actuator/health`)
- [ ] Target Group 포트를 앱 포트에 맞게 변경 (8080 또는 80)
- [ ] ALB DNS로 접속 시 본인 앱 화면 확인

> [!TIP]
> 커스텀 AMI 방식도 활용할 수 있습니다:
>
> - EC2에 직접 SSH 접속 → 앱 설치·설정 완료 → AMI 생성
> - Launch Template 새 버전에 커스텀 AMI 적용 + UserData 비움
> - UserData 방식보다 시작 시간이 빠르고 안정적입니다.

> [!TIP]
> **셀프 미션에 시간이 걸린다면:**  
> 작업 중 비용을 절약하려면 ASG의 Min / Desired / Max를 모두 `0`으로 설정하세요.  
> 인스턴스가 모두 종료되어 EC2 비용이 발생하지 않습니다.  
> 작업 완료 후 Desired를 원하는 수로 다시 올리면 새 템플릿으로 인스턴스가 생성됩니다.

---

## 🎯 셀프 미션 2: ALB에 커스텀 도메인 연결 (선택)

Step 7-1에서 생성한 Amazon Route 53 Hosted Zone과 ACM 인증서를 활용하여, ALB에 커스텀 도메인을 연결해보세요.

### 미션 목표

- ALB DNS 대신 본인 도메인(예: `app.pmcloudtech.shop`)으로 접속할 수 있도록 설정합니다.
- HTTPS(443)로 접속 시 ACM 인증서가 적용되는 것을 확인합니다.

### 힌트

- Amazon Route 53 → Hosted Zone → **Create Record**
- Record type: **A** (Alias)
- Alias target: **Application Load Balancer** → 서울 리전 → ALB 선택
- ALB에 HTTPS Listener 추가: Listeners → **Add listener** → HTTPS:443 → ACM 인증서 선택 → Forward to Target Group

### 체크리스트

- [ ] Amazon Route 53에 A 레코드 (Alias → ALB) 생성
- [ ] ALB에 HTTPS:443 Listener 추가 + ACM 인증서 연결
- [ ] 브라우저에서 `https://도메인명`으로 접속 시 자물쇠 아이콘 확인
- [ ] 새로고침 시 ASG 인스턴스 간 트래픽 분산 확인

---

## 마무리

이 실습에서 다음을 성공적으로 수행했습니다:

- Launch Template을 생성하여 인스턴스 설정을 템플릿화했습니다.
- Auto Scaling Group을 생성하고 ALB Target Group과 연동했습니다.
- Target Tracking 스케일링 정책으로 CPU 기반 자동 확장/축소를 설정했습니다.
- ASG가 인스턴스를 자동 생성하고 Target Group에 자동 등록하는 것을 확인했습니다.
- Launch Template 버전 업을 통해 커스텀 AMI를 적용하는 방법을 학습했습니다.

> [!TIP]
> Step 7 전체를 완료했습니다.
> 도메인(Amazon Route 53) + HTTPS(ACM) + 로드밸런서(ALB) + 자동 확장(ASG) 구성을 통해 고가용성 웹 서비스의 기본 아키텍처를 구축할 수 있게 되었습니다.

---

# 🗑️ 리소스 정리

> [!WARNING]
> 다음 단계를 **반드시 수행**하여 불필요한 비용을 방지합니다.
>
> | 리소스              | 과금 기준         | 비고                            |
> | ------------------- | ----------------- | ------------------------------- |
> | EC2 (ASG에서 관리)  | 시간당            | 무료 플랜 적용 여부에 따라 다름 |
> | ALB                 | 시간당 + LCU 기반 | 미사용 시에도 시간당 비용 발생  |
> | 커스텀 AMI (스냅샷) | GB당 월별         | 8GB ≈ 월 $0.40                  |
> | Launch Template     | 없음              | 무료                            |
>
> ※ 실제 요금은 리전, 무료 플랜 적용 여부, 트래픽에 따라 달라집니다.  
> [Amazon EC2 요금](https://aws.amazon.com/ec2/pricing/) | [Elastic Load Balancing 요금](https://aws.amazon.com/elasticloadbalancing/pricing/)
>
> **ASG + ALB를 삭제하지 않으면 Amazon EC2 인스턴스가 계속 실행되어 비용이 발생합니다.**

> [!NOTE]
> 삭제 순서 (의존 관계):
>
> ```
> 삭제 순서: Tag Editor 확인 → ASG → Launch Template → AMI + 스냅샷 → ALB → Target Group → AWS CloudFormation → Tag Editor 최종 확인
>
> ASG ──관리──→ EC2 Instances (자동 종료)
>  │
>  ▼
> (1) ASG Delete (EC2 자동 종료)
> (2) Launch Template Delete
> (3) AMI Deregister + Snapshot Delete
> (4) ALB Delete
> (5) Target Group Delete
> (6) AWS CloudFormation Delete (VPC, Subnet, SG 일괄 삭제)
> ```
>
> ⚠️ ASG를 삭제하지 않고 EC2만 종료하면 ASG가 새 인스턴스를 다시 생성합니다!

---

### 단계 1: Tag Editor로 리소스 확인

먼저 이 실습에서 생성한 리소스를 Tag Editor로 한눈에 확인합니다.

1. 상단 검색창에 `Resource Groups & Tag Editor`를 입력하고 선택합니다.
2. 왼쪽 메뉴에서 **Tag Editor**를 선택합니다.
3. 다음 조건으로 검색합니다:

- **Regions**: `ap-northeast-2`
- **Tag key**: `Session`, **Tag value**: `7-3`

4. [[Search resources]]를 클릭합니다.

> [!TIP]
> `Step: step7`으로도 검색하여 이 Step에서 생성한 모든 리소스를 확인할 수 있습니다.

---

### 단계 2: Auto Scaling Group 삭제

ASG가 활성 상태이면 인스턴스를 수동으로 종료해도 ASG가 다시 생성합니다. 반드시 ASG를 먼저 삭제합니다.

5. 상단 검색창에 `EC2`를 입력하고 선택합니다.
6. 왼쪽 메뉴에서 **Auto Scaling** → **Auto Scaling Groups**를 클릭합니다.
7. `starter-app-asg`를 체크합니다.
8. 상단 **Actions** 드롭다운 → **Delete**를 클릭합니다.
9. 확인 입력란에 `delete`를 입력합니다.
10. [[Delete]]를 클릭합니다.
11. Amazon EC2 콘솔 → **Instances**에서 ASG가 관리하던 인스턴스가 `Shutting down` → `Terminated` 상태로 변경되는 것을 확인합니다 (약 3-5분).

> [!NOTE]
> ASG를 삭제하면 관리 중인 모든 Amazon EC2 인스턴스가 **자동으로 종료**됩니다.  
> 별도로 인스턴스를 종료할 필요가 없습니다.

> [!WARNING]
> ASG 삭제 후에도 인스턴스가 Running 상태로 남아있다면 수동으로 종료하세요.  
> Running 상태의 인스턴스는 계속 비용이 발생합니다.

---

### 단계 3: Launch Template 삭제

ASG에서 사용하던 Launch Template을 삭제합니다.

12. Amazon EC2 콘솔 왼쪽 메뉴에서 **Instances** → **Launch Templates**를 클릭합니다.
13. `starter-app-lt`를 선택합니다.
14. **Actions** → **Delete template**을 클릭합니다.
15. 확인 입력란에 `Delete`를 입력합니다.
16. [[Delete]]를 클릭합니다.

> [!NOTE]
> Launch Template 자체는 비용이 발생하지 않지만, 불필요한 리소스를 정리하기 위해 삭제합니다.

---

### 단계 4: 커스텀 AMI + 스냅샷 삭제

태스크 6에서 생성한 커스텀 AMI를 삭제합니다. AMI를 삭제하지 않으면 EBS 스냅샷 스토리지 비용이 계속 발생합니다.

17. Amazon EC2 콘솔 왼쪽 메뉴에서 **Images** → **AMIs**를 클릭합니다.
18. `starter-app-ami-v2`를 선택합니다.
19. **Actions** → **Deregister AMI**를 클릭합니다.
20. 확인 팝업에서 [[Deregister AMI]]를 클릭합니다.

> [!NOTE]
> AMI를 등록 해제(Deregister)해도 연결된 EBS 스냅샷은 자동 삭제되지 않습니다.  
> 반드시 스냅샷도 수동으로 삭제해야 스토리지 비용이 발생하지 않습니다.

21. 왼쪽 메뉴에서 **Elastic Block Store** → **Snapshots**를 클릭합니다.
22. `starter-app-ami-v2` 스냅샷을 체크합니다.
23. 상단 **Actions** → **Delete snapshot**을 클릭합니다.
24. 확인 입력란에 `delete`를 입력합니다.
25. [[Delete]]를 클릭합니다.

---

### 단계 5: ALB + Target Group 삭제

Step 7-2에서 생성한 ALB와 Target Group을 삭제합니다. (이미 삭제한 경우 건너뜁니다.)

**ALB 삭제:**

26. 왼쪽 메뉴에서 **Load Balancing** → **Load Balancers**를 클릭합니다.
27. ALB를 선택합니다 (예: `starter-alb` 또는 `asg-lab-alb`, 체크박스 클릭).
28. **Actions** 드롭다운 → **Delete load balancer**를 클릭합니다.
29. 확인 입력란에 `confirm`을 입력합니다.
30. [[Delete]]를 클릭합니다.
31. 목록에서 ALB가 사라지는 것을 확인합니다 (1~2분 소요).

**Target Group 삭제:**

32. 왼쪽 메뉴에서 **Load Balancing** → **Target Groups**를 클릭합니다.
33. `starter-app-tg` (또는 `asg-lab-tg`)를 선택합니다.
34. **Actions** 드롭다운 → **Delete**를 클릭합니다.
35. 확인 팝업에서 [[Delete]]를 클릭합니다.

> [!WARNING]
> ALB가 연결된 상태에서는 Target Group을 삭제할 수 없습니다.  
> "Target group is currently in use by a listener or a rule" 에러가 발생하면 ALB 삭제가 완료될 때까지 1~2분 대기 후 재시도하세요.

---

### 단계 6: AWS CloudFormation 스택 삭제

태스크 0에서 AWS CloudFormation으로 선행 리소스를 생성한 경우 스택을 삭제합니다.

36. 상단 검색창에 `CloudFormation`을 입력하고 선택합니다.
37. **Stacks** 목록에서 `step7-3-asg-prereq` 스택을 선택합니다.
38. [[Delete]] 버튼을 클릭합니다.
39. 확인 팝업에서 [[Delete stack]]을 클릭합니다.
40. 스택 상태가 `DELETE_IN_PROGRESS` → `DELETE_COMPLETE`가 될 때까지 기다립니다 (약 3-5분).

> [!NOTE]
> AWS CloudFormation 스택을 삭제하면 스택이 생성한 모든 리소스(VPC, Subnet, IGW, Security Group 등)가 자동으로 삭제됩니다.

---

### 단계 7: Amazon CloudWatch 알람 삭제 확인

41. 상단 검색창에 `CloudWatch`를 입력하고 선택합니다.
42. 왼쪽 메뉴에서 **Alarms**를 클릭합니다.
43. `TargetTracking-starter-app-asg`로 시작하는 알람이 목록에서 사라졌는지 확인합니다.

> [!NOTE]
> ASG를 삭제하면 Target Tracking 정책이 생성한 Amazon CloudWatch 알람도 자동으로 삭제됩니다.  
> 만약 알람이 남아있다면 선택 후 **Actions** → **Delete**로 수동 삭제하세요.

---

### 단계 8: Tag Editor 최종 확인

모든 리소스가 정상적으로 삭제되었는지 Tag Editor로 최종 확인합니다.

44. 상단 검색창에 `Resource Groups & Tag Editor`를 입력하고 선택합니다.
45. 왼쪽 메뉴에서 **Tag Editor**를 선택합니다.
46. 다음 조건으로 검색합니다:
    - **Regions**: `ap-northeast-2`
    - **Tag key**: `Session`, **Tag value**: `7-3`

47. [[Search resources]]를 클릭합니다.
48. 검색 결과가 없으면 모든 태그된 리소스가 정리된 것입니다.

> [!TIP]
> `Step: step7`으로도 추가 검색하여 다른 세션(7-1, 7-2)의 리소스가 남아있지 않은지 확인하세요.

✅ **실습 종료**: 모든 리소스가 정리되었습니다.

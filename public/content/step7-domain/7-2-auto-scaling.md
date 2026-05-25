---
title: 'Auto Scaling Group으로 자동 확장 설정'
week: 7
session: 2
awsServices:
  - Amazon EC2 Auto Scaling
learningObjectives:
  - Launch Template을 생성하여 인스턴스 설정을 템플릿화할 수 있습니다.
  - Auto Scaling Group을 생성하고 ALB와 연동할 수 있습니다.
  - 스케일링 정책(Target Tracking)을 설정할 수 있습니다.
  - 스케일 아웃/인 동작을 확인할 수 있습니다.
prerequisites:
  - AWS 계정 생성 완료
  - ALB + Target Group 생성 완료 (Step 7-1 참조)
  - VPC + Public Subnet 2개
estimatedCost: 크레딧 내 사용 가능 (비용 발생 가능)
---

이 실습에서는 Auto Scaling Group(ASG)을 생성하여 트래픽 변화에 따라
EC2 인스턴스를 자동으로 확장/축소하는 방법을 학습합니다.
Launch Template으로 인스턴스 설정을 템플릿화하고, ALB와 연동하여
새로 생성된 인스턴스가 자동으로 트래픽을 받도록 구성합니다.

> [!NOTE]
> 이 실습은 Step 7-1에서 생성한 ALB와 Target Group이 필요합니다.
> 선행 리소스가 없는 경우 태스크 0의 CloudFormation 템플릿을 사용하세요.

---

## 태스크 0: 선행 리소스 확인

> [!DOWNLOAD]
> [step7-2-asg-lab.zip](/files/step7/step7-2-asg-lab.zip)
>
> - `step7-2-asg-prereq.yaml` - AWS CloudFormation 템플릿 (태스크 0에서 VPC, 서브넷, IGW, ALB, Target Group, Security Group 자동 생성)

### 필요한 리소스 체크리스트

| 리소스             | 요구 사항                      | 확인 |
| ------------------ | ------------------------------ | ---- |
| VPC                | 1개                            | ☐    |
| Public Subnet      | 2개 (서로 다른 AZ)             | ☐    |
| ALB                | Internet-facing, Active 상태   | ☐    |
| Target Group       | HTTP:8080, Health Check 설정됨 | ☐    |
| ALB Security Group | 80, 443 포트 허용              | ☐    |

### 리소스가 없는 경우: CloudFormation으로 생성

Step 7-1을 진행하지 않은 경우, 아래 CloudFormation 템플릿으로 ALB와 Target Group을 포함한 모든 선행 리소스를 생성할 수 있습니다.

**CloudFormation 스택 생성:**

1. 다운로드한 `step7-2-asg-prereq.yaml` 파일을 확인합니다.
2. CloudFormation 콘솔에서 [[Create stack]] → **With new resources (standard)**를 선택합니다.
3. **Upload a template file** → 다운로드한 YAML 파일을 업로드합니다.
4. Stack name: `step7-2-asg-prereq`
5. KeyPairName: 기존 Key Pair 선택
6. [[Next]] → [[Next]] → [[Submit]]

> [!WARNING]
> 스택 생성에 3~5분이 소요됩니다. `CREATE_COMPLETE` 상태가 될 때까지 기다리세요.

✅ **태스크 완료** — 선행 리소스를 확인하거나 CloudFormation으로 생성했습니다.

---

## 태스크 1: Auto Scaling 개념 이해

### 수동 확장의 한계

트래픽이 증가할 때 수동으로 EC2를 추가하는 방식의 문제점:

```

```

수동 확장:

1. 모니터링 → CPU 90% 감지 (사람이 확인)
2. EC2 콘솔 접속 → 인스턴스 생성 (5~10분)
3. 앱 배포 + 설정 (10~20분)
4. Target Group에 등록 (수동)
5. 트래픽 감소 → 인스턴스 종료 (잊어버리면 비용 낭비)

총 소요 시간: 20~30분 (그 사이 서비스 장애 가능)

```

### Auto Scaling의 자동 확장

```

자동 확장:

1. CloudWatch → CPU 70% 초과 감지 (자동)
2. ASG → Launch Template으로 인스턴스 자동 생성 (2~3분)
3. User Data로 앱 자동 배포 (자동)
4. Target Group에 자동 등록 (자동)
5. 트래픽 감소 → 인스턴스 자동 종료 (자동)

총 소요 시간: 2~5분 (무중단)

```

### ASG 구성 요소

```

Auto Scaling Group (ASG)
├── Launch Template (인스턴스 설정 템플릿)
│ ├── AMI (OS 이미지)
│ ├── Instance Type (t2.micro)
│ ├── Key Pair
│ ├── Security Group
│ └── User Data (시작 스크립트)
├── Scaling Policy (확장/축소 규칙)
│ ├── Target Tracking (CPU 평균 70% 유지)
│ ├── Step Scaling (단계별 확장)
│ └── Scheduled (예약 확장)
└── ALB Target Group (트래픽 분산)

````

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

1. EC2 콘솔 → **Instances** → **Launch Templates**로 이동합니다.
2. [[Create launch template]]을 클릭합니다.

### Launch template name and description

3. **Launch template name**: `starter-app-lt`
4. **Template version description**: `v1 - Spring Boot app with auto start`
5. ☑️ **Auto Scaling guidance** 체크 (ASG에서 사용할 수 있도록 가이드 제공)

### Application and OS Images (AMI)

6. **Quick Start** → **Amazon Linux** 선택
7. **Amazon Linux 2023 AMI** 선택 (Free tier eligible)

> [!NOTE]
> AMI는 인스턴스의 OS 이미지입니다. Amazon Linux 2023은 최신 보안 패치가
> 적용된 AWS 최적화 Linux입니다. Free tier에서 사용 가능합니다.

### Instance type

8. **Instance type**: `t2.micro` (Free tier eligible)

### Key pair

9. **Key pair**: 기존 Key Pair를 선택합니다.

> [!TIP]
> Auto Scaling으로 생성된 인스턴스에 SSH 접속이 필요한 경우 Key Pair를 설정합니다.
> 프로덕션 환경에서는 SSM Session Manager를 사용하여 Key Pair 없이 접속하는 것을 권장합니다.

### Network settings

10. **Security groups**: EC2용 Security Group을 선택합니다.
    - Step 7-1에서 생성한 Security Group (ALB에서 8080 허용)
    - 또는 CloudFormation으로 생성된 `EC2SecurityGroup`

### Advanced details → User Data

11. **Advanced details**를 펼칩니다.
12. 맨 아래 **User Data** 영역에 다음 스크립트를 입력합니다:

```bash
#!/bin/bash
# Auto Scaling Launch Template - User Data Script
set -e

# 시스템 업데이트
yum update -y

# Java 17 설치
yum install -y java-17-amazon-corretto-headless

# 애플리케이션 디렉토리 생성
mkdir -p /opt/app
cd /opt/app

# S3에서 JAR 파일 다운로드 (본인의 S3 버킷으로 변경)
aws s3 cp s3://my-app-deploy-bucket/app.jar /opt/app/app.jar

# systemd 서비스 파일 생성
cat > /etc/systemd/system/starter-app.service << 'EOF'
[Unit]
Description=Spring Boot Starter Application
After=network.target

[Service]
Type=simple
User=ec2-user
ExecStart=/usr/bin/java -jar /opt/app/app.jar --server.port=8080
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# 서비스 시작
systemctl daemon-reload
systemctl enable starter-app
systemctl start starter-app
````

> [!CONCEPT] User Data란?
>
> User Data는 EC2 인스턴스가 **최초 시작될 때 한 번** 실행되는 스크립트입니다.
> ASG가 새 인스턴스를 생성할 때마다 이 스크립트가 자동 실행되어:
>
> 1. Java를 설치하고
> 2. S3에서 애플리케이션 JAR를 다운로드하고
> 3. systemd 서비스로 등록하여 자동 시작합니다.
>
> 이를 통해 사람의 개입 없이 새 인스턴스가 자동으로 서비스를 시작합니다.

> [!WARNING]
> User Data에서 S3 버킷 이름(`my-app-deploy-bucket`)을 본인의 버킷으로 변경하세요.
> EC2 IAM Role에 S3 읽기 권한(`s3:GetObject`)이 있어야 합니다.
> JAR 파일이 없는 경우, 간단한 Nginx 설치로 대체할 수 있습니다:
>
> ```bash
> #!/bin/bash
> yum update -y
> yum install -y nginx
> systemctl start nginx
> systemctl enable nginx
> ```

### IAM Instance Profile (선택)

13. **IAM instance profile**: EC2 Role을 선택합니다 (S3 접근 권한 필요).
    - S3에서 JAR를 다운로드하려면 `AmazonS3ReadOnlyAccess` 정책이 필요합니다.
    - Nginx만 사용하는 경우 이 설정은 생략 가능합니다.

14. [[Create launch template]]을 클릭합니다.

> [!OUTPUT]
> Launch Template이 생성되었습니다:
>
> - Name: `starter-app-lt`
> - Version: 1
> - AMI: Amazon Linux 2023
> - Instance type: t2.micro
> - User Data: Java 설치 + 앱 자동 시작 스크립트

✅ **태스크 완료** — Launch Template을 생성하여 인스턴스 설정을 템플릿화했습니다.

---

## 태스크 3: Auto Scaling Group 생성

Launch Template을 기반으로 Auto Scaling Group을 생성합니다.

### ASG 생성 단계

1. EC2 콘솔 → **Auto Scaling** → **Auto Scaling Groups**로 이동합니다.
2. [[Create Auto Scaling group]]을 클릭합니다.

### Step 1: Choose launch template

3. **Auto Scaling group name**: `starter-app-asg`
4. **Launch template**: `starter-app-lt` 선택
5. **Version**: Latest (1)
6. [[Next]]를 클릭합니다.

### Step 2: Choose instance launch options

7. **VPC**: 실습용 VPC를 선택합니다.
8. **Availability Zones and subnets**: 2개의 Public Subnet을 선택합니다.
   - ✅ `ap-northeast-2a` (Public Subnet 1)
   - ✅ `ap-northeast-2c` (Public Subnet 2)

> [!NOTE]
> 2개의 AZ에 걸쳐 인스턴스를 배치하면, 하나의 AZ에 장애가 발생해도
> 다른 AZ의 인스턴스가 서비스를 유지합니다 (고가용성).

9. [[Next]]를 클릭합니다.

### Step 3: Configure advanced options — Load balancing

10. **Load balancing**: **Attach to an existing load balancer**를 선택합니다.
11. **Choose from your load balancer target groups**를 선택합니다.
12. **Existing load balancer target groups**: `starter-app-tg | HTTP` 선택

> [!CONCEPT] ASG + ALB 연동의 의미
>
> ASG를 ALB Target Group에 연결하면:
>
> - ASG가 새 인스턴스를 생성하면 → **자동으로 Target Group에 등록**
> - ASG가 인스턴스를 종료하면 → **자동으로 Target Group에서 제거**
>
> 수동으로 Target Group에 인스턴스를 등록/해제할 필요가 없습니다.

### Health checks

13. **Health check type**:
    - ✅ EC2 (기본)
    - ✅ ELB (추가 체크 — ALB Health Check도 활용)
14. **Health check grace period**: `300` seconds (5분)

> [!TIP]
> Health check grace period는 인스턴스가 시작된 후 Health Check를 시작하기까지
> 대기하는 시간입니다. User Data 스크립트 실행 + 앱 시작에 시간이 걸리므로
> 충분한 시간(300초)을 설정합니다. 너무 짧으면 앱이 시작되기 전에
> unhealthy로 판정되어 인스턴스가 종료될 수 있습니다.

15. [[Next]]를 클릭합니다.

### Step 4: Configure group size and scaling

16. **Group size**:
    - **Desired capacity**: `2`
    - **Minimum capacity**: `1`
    - **Maximum capacity**: `4`

17. **Scaling policies**: **Target tracking scaling policy**를 선택합니다.
    - **Scaling policy name**: `cpu-target-tracking`
    - **Metric type**: Average CPU utilization
    - **Target value**: `70`

> [!CONCEPT] Target Tracking Scaling Policy
>
> Target Tracking은 지정한 메트릭(CPU 사용률)을 목표값(70%)에 맞추도록
> 자동으로 인스턴스를 추가/제거합니다.
>
> - CPU 평균 > 70% → 인스턴스 추가 (Scale Out)
> - CPU 평균 < 70% → 인스턴스 제거 (Scale In)
>
> AWS가 자동으로 CloudWatch 알람을 생성하고 관리합니다.
> 가장 간단하고 권장되는 스케일링 방식입니다.

18. **Instance scale-in protection**: 체크하지 않음 (기본값)
19. [[Next]]를 클릭합니다.

### Step 5: Add notifications (선택)

20. 알림이 필요하면 SNS Topic을 설정합니다. 이 실습에서는 건너뜁니다.
21. [[Next]]를 클릭합니다.

### Step 6: Add tags

22. [[Add tag]]를 클릭합니다:
    - **Key**: `Name`
    - **Value**: `starter-app-asg-instance`
    - ✅ **Tag new instances** 체크

> [!TIP]
> "Tag new instances"를 체크하면 ASG가 생성하는 모든 EC2 인스턴스에
> 이 태그가 자동으로 적용됩니다. EC2 콘솔에서 ASG가 생성한 인스턴스를
> 쉽게 식별할 수 있습니다.

23. [[Next]]를 클릭합니다.

### Step 7: Review and create

24. 설정을 검토합니다:
    - Launch template: `starter-app-lt`
    - VPC + Subnets: 2개 AZ
    - Load balancer: `starter-app-tg`
    - Desired: 2, Min: 1, Max: 4
    - Scaling policy: CPU 70% Target Tracking
25. [[Create Auto Scaling group]]을 클릭합니다.

> [!OUTPUT]
> Auto Scaling Group이 생성되었습니다:
>
> - Name: `starter-app-asg`
> - Desired: 2 → 즉시 2개의 EC2 인스턴스 생성 시작
> - Launch Template: `starter-app-lt` (v1)
> - Target Group: `starter-app-tg` 연결됨

✅ **태스크 완료** — Auto Scaling Group을 생성하고 ALB Target Group과 연동했습니다.

---

## 태스크 4: 스케일링 정책 확인

ASG 생성 시 설정한 Target Tracking 정책을 확인합니다.

### CloudWatch 알람 자동 생성 확인

1. CloudWatch 콘솔로 이동합니다.
2. 왼쪽 메뉴에서 **Alarms** → **All alarms**를 클릭합니다.
3. ASG가 자동으로 생성한 알람 2개를 확인합니다:

| 알람 이름                          | 조건                  | 동작                      |
| ---------------------------------- | --------------------- | ------------------------- |
| `TargetTracking-...-AlarmHigh-...` | CPU > 70% (3분간)     | Scale Out (인스턴스 추가) |
| `TargetTracking-...-AlarmLow-...`  | CPU < 약 63% (15분간) | Scale In (인스턴스 제거)  |

> [!NOTE]
> Target Tracking 정책은 CloudWatch 알람을 자동으로 생성하고 관리합니다.
> 이 알람을 수동으로 수정하거나 삭제하지 마세요. ASG가 자동으로 관리합니다.
> Scale In 임계값(63%)은 AWS가 자동으로 계산합니다 (목표값의 약 90%).

### ASG Activity 확인

4. EC2 콘솔 → **Auto Scaling Groups** → `starter-app-asg` 클릭
5. **Activity** 탭을 클릭합니다.
6. 인스턴스 생성 활동을 확인합니다:

```
Activity history:
- Launching a new EC2 instance: i-0abc123... (Successful)
- Launching a new EC2 instance: i-0def456... (Successful)
```

### 스케일링 정책 상세 확인

7. **Automatic scaling** 탭을 클릭합니다.
8. `cpu-target-tracking` 정책을 확인합니다:
   - Metric type: Average CPU utilization
   - Target value: 70
   - Instances need: 300 seconds warm up

> [!CONCEPT] Warm-up 시간
>
> 새로 생성된 인스턴스는 앱 시작까지 시간이 걸립니다.
> Warm-up 기간(300초) 동안은 해당 인스턴스의 CPU 메트릭이
> 스케일링 판단에서 제외됩니다. 이를 통해 앱 시작 중의 높은 CPU가
> 추가 Scale Out을 유발하는 것을 방지합니다.

✅ **태스크 완료** — Target Tracking 스케일링 정책과 CloudWatch 알람을 확인했습니다.

---

## 태스크 5: 동작 확인

ASG가 생성한 인스턴스가 정상적으로 동작하는지 확인합니다.

### EC2 인스턴스 확인

1. EC2 콘솔 → **Instances**로 이동합니다.
2. `starter-app-asg-instance` 이름의 인스턴스 2개가 Running 상태인지 확인합니다.
3. 각 인스턴스가 서로 다른 AZ에 배치되었는지 확인합니다:
   - Instance 1: `ap-northeast-2a`
   - Instance 2: `ap-northeast-2c`

> [!NOTE]
> ASG는 인스턴스를 AZ 간에 균등하게 분배합니다.
> Desired=2이면 각 AZ에 1개씩 배치됩니다. 이를 통해 하나의 AZ에
> 장애가 발생해도 다른 AZ의 인스턴스가 서비스를 유지합니다.

### Target Group Health 확인

4. EC2 콘솔 → **Target Groups** → `starter-app-tg` 클릭
5. **Targets** 탭에서 등록된 인스턴스를 확인합니다:

```
Target Group: starter-app-tg
┌─────────────────┬──────────┬────────────────┬─────────────────┐
│ Instance        │ Port     │ Health Status  │ AZ              │
├─────────────────┼──────────┼────────────────┼─────────────────┤
│ i-0abc123...    │ 8080     │ ✅ healthy     │ ap-northeast-2a │
│ i-0def456...    │ 8080     │ ✅ healthy     │ ap-northeast-2c │
└─────────────────┴──────────┴────────────────┴─────────────────┘
```

> [!WARNING]
> 인스턴스가 `unhealthy` 상태인 경우:
>
> - User Data 스크립트가 정상 실행되었는지 확인 (시스템 로그 확인)
> - Health Check 경로가 올바른지 확인
> - Security Group에서 8080 포트가 ALB에서 허용되는지 확인
> - Health check grace period(300초)가 지났는지 확인
>
> 시스템 로그 확인: EC2 → 인스턴스 선택 → Actions → Monitor and troubleshoot → Get system log

### ALB DNS로 접속 확인

6. Load Balancers → `starter-alb` (또는 `asg-lab-alb`) → DNS name 복사
7. 브라우저에서 접속합니다:

```
http://your-alb-dns-name.ap-northeast-2.elb.amazonaws.com
```

8. 여러 번 새로고침하여 트래픽이 분산되는지 확인합니다.

> [!TIP]
> 트래픽 분산을 확인하려면 각 인스턴스가 자신의 Instance ID나 IP를
> 응답에 포함하도록 설정하면 좋습니다. 새로고침할 때마다 다른 인스턴스가
> 응답하는 것을 확인할 수 있습니다.
>
> 간단한 확인 방법 (Nginx 사용 시):
>
> ```bash
> # 각 EC2에서 실행
> echo "Instance: $(curl -s http://169.254.169.254/latest/meta-data/instance-id)" > /usr/share/nginx/html/index.html
> ```

### 인스턴스 자동 복구 테스트

9. EC2 콘솔에서 ASG가 생성한 인스턴스 1개를 **수동으로 종료**합니다.
   - 인스턴스 선택 → **Instance state** → [[Terminate instance]]
10. 1~2분 후 ASG가 새 인스턴스를 자동으로 생성하는지 확인합니다.

> [!OUTPUT]
> 인스턴스를 수동 종료하면 ASG가 감지하고 새 인스턴스를 자동 생성합니다:
>
> Activity history:
>
> - Terminating EC2 instance: i-0abc123... (인스턴스 종료됨)
> - Launching a new EC2 instance: i-0ghi789... (새 인스턴스 생성)
>
> Desired capacity(2)를 유지하기 위해 ASG가 자동으로 인스턴스를 교체합니다.

✅ **태스크 완료** — ASG가 생성한 인스턴스의 정상 동작과 자동 복구를 확인했습니다.

---

## 태스크 6: 스케일 아웃 테스트 (선택)

> [!WARNING]
> 이 태스크는 선택 사항입니다. CPU 부하를 발생시켜 Scale Out을 테스트합니다.
> 추가 인스턴스가 생성되므로 약간의 비용이 발생할 수 있습니다.
> 테스트 후 반드시 리소스를 정리하세요.

### stress 도구로 CPU 부하 발생

ASG가 생성한 인스턴스에 SSH로 접속하여 CPU 부하를 발생시킵니다.

1. EC2 인스턴스에 SSH로 접속합니다:

```bash
ssh -i your-key.pem ec2-user@<instance-public-ip>
```

2. stress 도구를 설치합니다:

```bash
# Amazon Linux 2023
sudo yum install -y stress
```

3. CPU 부하를 발생시킵니다:

```bash
# CPU 코어 2개에 100% 부하 (5분간)
stress --cpu 2 --timeout 300
```

> [!NOTE]
> t2.micro는 CPU 코어가 1개이므로 `--cpu 2`로 설정하면 CPU 사용률이
> 100%에 도달합니다. 5분(300초) 후 자동으로 종료됩니다.

### Scale Out 확인

4. **2~3분 후** CloudWatch 알람 상태를 확인합니다:
   - `TargetTracking-...-AlarmHigh` → **In alarm** 상태

5. **3~5분 후** ASG Activity를 확인합니다:
   - EC2 콘솔 → Auto Scaling Groups → `starter-app-asg` → Activity 탭

```
Activity history:
- Launching a new EC2 instance: i-0jkl012... (Scale Out)
  Cause: monitor alarm TargetTracking-...-AlarmHigh triggered policy cpu-target-tracking
```

6. EC2 콘솔에서 인스턴스가 3개로 증가했는지 확인합니다.
7. Target Group에서 새 인스턴스가 등록되고 healthy 상태가 되는지 확인합니다.

### Scale In 확인

8. stress 명령이 종료된 후 (5분 후) CPU가 정상으로 돌아옵니다.
9. **약 15분 후** Scale In이 발생합니다:
   - `TargetTracking-...-AlarmLow` → **In alarm** 상태
   - 인스턴스 1개가 자동 종료됨

> [!NOTE]
> Scale In은 Scale Out보다 느리게 동작합니다 (기본 15분 대기).
> 이는 트래픽이 일시적으로 감소했다가 다시 증가하는 경우를 대비하여
> 불필요한 인스턴스 생성/종료 반복(flapping)을 방지하기 위함입니다.

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
>       "Cause": "monitor alarm TargetTracking-...-AlarmHigh triggered policy cpu-target-tracking",
>       "StatusCode": "Successful",
>       "StartTime": "2025-01-20T14:30:00Z"
>     }
>   ]
> }
> ```

✅ **태스크 완료** — CPU 부하를 통해 Scale Out/In 동작을 확인했습니다.

---

# 🗑️ 리소스 정리

> [!WARNING]
> 다음 단계를 **반드시 수행**하여 불필요한 비용을 방지합니다.

---

### 단계 1: Auto Scaling Group 삭제

ASG가 활성 상태이면 인스턴스를 수동으로 종료해도 ASG가 다시 생성합니다. 반드시 ASG를 먼저 삭제합니다.

1. 상단 검색창에 `EC2`를 입력하고 선택합니다.
2. 왼쪽 메뉴에서 **Auto Scaling** → **Auto Scaling Groups**를 클릭합니다.
3. `starter-app-asg`를 선택합니다.
4. [[Delete]]를 클릭합니다.
5. 확인 입력란에 `delete`를 입력합니다.
6. [[Delete]]를 클릭합니다.
7. EC2 콘솔 → **Instances**에서 ASG가 관리하던 인스턴스가 `Shutting down` → `Terminated` 상태로 변경되는 것을 확인합니다 (약 1-2분).

> [!NOTE]
> ASG를 삭제하면 관리 중인 모든 EC2 인스턴스가 **자동으로 종료**됩니다. 별도로 인스턴스를 종료할 필요가 없습니다.

> [!WARNING]
> ASG 삭제 후에도 인스턴스가 Running 상태로 남아있다면 수동으로 종료하세요. Running 상태의 인스턴스는 계속 비용이 발생합니다.

---

### 단계 2: Launch Template 삭제

ASG에서 사용하던 Launch Template을 삭제합니다.

1. EC2 콘솔 왼쪽 메뉴에서 **Instances** → **Launch Templates**를 클릭합니다.
2. `starter-app-lt`를 선택합니다.
3. **Actions** → **Delete template**을 클릭합니다.
4. 확인 입력란에 `Delete`를 입력합니다.
5. [[Delete]]를 클릭합니다.

> [!NOTE]
> Launch Template 자체는 비용이 발생하지 않지만, 불필요한 리소스를 정리하기 위해 삭제합니다.

---

### 단계 3: ALB + Target Group 삭제

Step 7-1에서 생성한 ALB와 Target Group을 삭제합니다. (이미 삭제한 경우 건너뜁니다.)

**ALB 삭제:**

1. EC2 콘솔 왼쪽 메뉴에서 **Load Balancing** → **Load Balancers**를 클릭합니다.
2. ALB를 선택합니다 (예: `starter-alb` 또는 `asg-lab-alb`).
3. **Actions** → **Delete load balancer**를 클릭합니다.
4. 확인 입력란에 `confirm`을 입력합니다.
5. [[Delete]]를 클릭합니다.

**Target Group 삭제:**

6. EC2 콘솔 왼쪽 메뉴에서 **Load Balancing** → **Target Groups**를 클릭합니다.
7. `starter-app-tg`를 선택합니다.
8. **Actions** → **Delete**를 클릭합니다.
9. 확인 팝업에서 [[Yes, delete]]를 클릭합니다.

> [!WARNING]
> ALB가 연결된 상태에서는 Target Group을 삭제할 수 없습니다. 반드시 ALB를 먼저 삭제한 후 Target Group을 삭제하세요.

---

### 단계 4: CloudFormation 스택 삭제

태스크 0에서 CloudFormation으로 선행 리소스를 생성한 경우 스택을 삭제합니다.

1. 상단 검색창에 `CloudFormation`을 입력하고 선택합니다.
2. **Stacks** 목록에서 `step7-2-asg-prereq` 스택을 선택합니다.
3. [[Delete]] 버튼을 클릭합니다.
4. 확인 팝업에서 [[Delete stack]]을 클릭합니다.
5. 스택 상태가 `DELETE_IN_PROGRESS` → `DELETE_COMPLETE`가 될 때까지 기다립니다 (약 3-5분).

> [!NOTE]
> CloudFormation 스택을 삭제하면 스택이 생성한 모든 리소스(VPC, Subnet, IGW, Security Group 등)가 자동으로 삭제됩니다.

---

### 단계 5: CloudWatch 알람 삭제 확인

ASG의 Target Tracking 정책이 자동으로 생성한 CloudWatch 알람이 삭제되었는지 확인합니다.

1. 상단 검색창에 `CloudWatch`를 입력하고 선택합니다.
2. 왼쪽 메뉴에서 **Alarms** → **All alarms**를 클릭합니다.
3. `TargetTracking-starter-app-asg`로 시작하는 알람이 목록에서 사라졌는지 확인합니다.

> [!NOTE]
> ASG를 삭제하면 Target Tracking 정책이 생성한 CloudWatch 알람도 자동으로 삭제됩니다. 만약 알람이 남아있다면 선택 후 **Actions** → **Delete**로 수동 삭제하세요.

---

### 단계 6: 삭제 확인

모든 리소스가 정상적으로 삭제되었는지 확인합니다.

1. EC2 콘솔 → **Instances**에서 ASG가 생성한 인스턴스(`starter-app-asg-instance`)가 모두 `Terminated` 상태인지 확인합니다.
2. EC2 콘솔 → **Auto Scaling Groups**에서 `starter-app-asg`가 목록에서 사라졌는지 확인합니다.
3. EC2 콘솔 → **Launch Templates**에서 `starter-app-lt`가 삭제되었는지 확인합니다.
4. EC2 콘솔 → **Load Balancers**에서 ALB가 삭제되었는지 확인합니다.
5. CloudFormation 콘솔에서 `step7-2-asg-prereq` 스택이 목록에서 사라졌는지 확인합니다.

> [!NOTE]
> 삭제 직후에는 일부 리소스가 잠시 남아있을 수 있으나, 시간이 지나면 자동으로 사라집니다.

✅ **실습 종료**: 모든 리소스가 정리되었습니다.

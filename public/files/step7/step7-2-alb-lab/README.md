# Step 7-1: ALB Lab Prerequisites - CloudFormation 템플릿

## 개요

이 CloudFormation 템플릿(`step7-2-alb-prereq.yaml`)은 Step 7-1 ALB 실습에 필요한 VPC 네트워크 환경과 EC2 인스턴스 2대(Nginx)를 자동으로 생성합니다.  
ALB, Target Group, ALB Security Group은 실습에서 수동으로 생성합니다.

> 이미 실습용 VPC와 EC2가 있다면 이 템플릿을 사용하지 않아도 됩니다.

---

## 생성되는 리소스

| 리소스             | 이름 (기본값)              | 설명                               |
| ------------------ | -------------------------- | ---------------------------------- |
| VPC                | `alb-lab-vpc`              | 10.0.0.0/16 CIDR                   |
| Public Subnet 1    | `alb-lab-public-subnet-1`  | 10.0.1.0/24, ap-northeast-2a       |
| Public Subnet 2    | `alb-lab-public-subnet-2`  | 10.0.2.0/24, ap-northeast-2c       |
| Private Subnet 1   | `alb-lab-private-subnet-1` | 10.0.11.0/24, ap-northeast-2a      |
| Private Subnet 2   | `alb-lab-private-subnet-2` | 10.0.12.0/24, ap-northeast-2c      |
| Internet Gateway   | `alb-lab-igw`              | VPC에 자동 연결                    |
| Public Route Table | `alb-lab-public-rt`        | 0.0.0.0/0 → IGW 경로 포함          |
| EC2 Security Group | `alb-lab-ec2-sg`           | SSH(22), AppPort(80) 허용          |
| EC2 Instance 1     | `alb-lab-ec2-1`            | AZ-a, Nginx + 인스턴스 식별 페이지 |
| EC2 Instance 2     | `alb-lab-ec2-2`            | AZ-c, Nginx + 인스턴스 식별 페이지 |

> 모든 리소스에 `CreatedBy`, `Step`, `Session` 태그가 자동 적용됩니다.

---

## EC2 내부 세팅 (UserData 상세)

각 EC2 인스턴스가 시작될 때 UserData 스크립트가 자동으로 실행되어 다음을 수행합니다:

### 1. Nginx 설치 및 포트 설정

```bash
yum update -y
yum install -y nginx

# AppPort가 80이 아닌 경우(예: 8080) Nginx 설정 변경
if [ "${AppPort}" != "80" ]; then
  sed -i 's/listen       80;/listen       ${AppPort};/' /etc/nginx/nginx.conf
fi
```

### 2. 인스턴스 메타데이터 조회 (IMDSv2)

```bash
# IMDSv2 토큰 발급 (보안 강화된 메타데이터 조회 방식)
TOKEN=$(curl -s -X PUT "http://169.254.169.254/latest/api/token" \
  -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")

# 토큰을 사용하여 인스턴스 정보 조회
INSTANCE_ID=$(curl -s -H "X-aws-ec2-metadata-token: $TOKEN" \
  http://169.254.169.254/latest/meta-data/instance-id)
AZ=$(curl -s -H "X-aws-ec2-metadata-token: $TOKEN" \
  http://169.254.169.254/latest/meta-data/placement/availability-zone)
PRIVATE_IP=$(curl -s -H "X-aws-ec2-metadata-token: $TOKEN" \
  http://169.254.169.254/latest/meta-data/local-ipv4)
```

### 3. 인스턴스 식별 HTML 페이지 생성

각 EC2에 고유한 HTML 페이지를 생성합니다. ALB를 통해 접속할 때 새로고침하면 다른 인스턴스의 페이지가 표시되어 **트래픽 분산을 눈으로 확인**할 수 있습니다.

- Instance 1: 파란색 배경 (`#f0f8ff`)
- Instance 2: 초록색 배경 (`#f0fff0`)

표시 정보:

- Instance ID (예: `i-0abc123def456`)
- Availability Zone (예: `ap-northeast-2a`)
- Private IP
- Listening Port

### 4. Health Check 엔드포인트 생성

```bash
mkdir -p /usr/share/nginx/html/health
echo "OK" > /usr/share/nginx/html/health/index.html
```

`/health` 경로에서 HTTP 200을 반환하여 ALB Health Check에 응답합니다.  
Target Group 생성 시 Health Check 경로를 `/health`로 설정하면 됩니다.

---

## 파라미터

| 파라미터             | 기본값           | 설명                                     |
| -------------------- | ---------------- | ---------------------------------------- |
| `ProjectName`        | `alb-lab`        | 리소스 이름 접두사                       |
| `KeyPairName`        | (필수 선택)      | SSH 접속용 기존 Key Pair 이름            |
| `AppPort`            | `80`             | Nginx 리스닝 포트 (기본 80, 필요시 8080) |
| `SSHAccessCidr`      | `0.0.0.0/0`      | SSH 접근 허용 IP (본인 IP 권장)          |
| `VpcCidr`            | `10.0.0.0/16`    | VPC CIDR 블록                            |
| `PublicSubnetACidr`  | `10.0.1.0/24`    | Public Subnet 1 CIDR (ap-northeast-2a)   |
| `PublicSubnetCCidr`  | `10.0.2.0/24`    | Public Subnet 2 CIDR (ap-northeast-2c)   |
| `PrivateSubnetACidr` | `10.0.11.0/24`   | Private Subnet 1 CIDR (ap-northeast-2a)  |
| `PrivateSubnetCCidr` | `10.0.12.0/24`   | Private Subnet 2 CIDR (ap-northeast-2c)  |
| `CreatedByTag`       | `cloudformation` | CreatedBy 태그 값                        |
| `StepTag`            | `step7`          | Step 태그 값                             |
| `SessionTag`         | `7-1`            | Session 태그 값                          |

---

## 네트워크 아키텍처

```
VPC (10.0.0.0/16)
├── Public Subnet 1  (10.0.1.0/24,  ap-northeast-2a) → Public RT → IGW
│   └── EC2 #1 (Nginx, 인스턴스 식별 페이지 - 파란색)
├── Public Subnet 2  (10.0.2.0/24,  ap-northeast-2c) → Public RT → IGW
│   └── EC2 #2 (Nginx, 인스턴스 식별 페이지 - 초록색)
├── Private Subnet 1 (10.0.11.0/24, ap-northeast-2a) → (no IGW, 향후 RDS 배치용)
└── Private Subnet 2 (10.0.12.0/24, ap-northeast-2c) → (no IGW, 향후 RDS 배치용)

ALB (실습에서 수동 생성) → 두 Public 서브넷에 걸쳐 배치
  └── Target Group → EC2 #1 + EC2 #2 등록
      → 새로고침 시 다른 인스턴스 응답 확인 (트래픽 분산)
```

---

## 트래픽 분산 확인 방법

1. ALB DNS Name으로 브라우저 접속
2. 새로고침(F5)을 여러 번 수행
3. 인스턴스 ID와 AZ가 번갈아 표시되면 ALB가 정상 동작하는 것

```
첫 번째 요청:  Instance: i-0abc123... | AZ: ap-northeast-2a (파란색 배경)
두 번째 요청:  Instance: i-0def456... | AZ: ap-northeast-2c (초록색 배경)
세 번째 요청:  Instance: i-0abc123... | AZ: ap-northeast-2a (파란색 배경)
```

---

## Outputs

| Output Key           | 설명                       |
| -------------------- | -------------------------- |
| VPCId                | VPC ID                     |
| PublicSubnet1Id      | Public Subnet 1 ID (AZ-a)  |
| PublicSubnet2Id      | Public Subnet 2 ID (AZ-c)  |
| PrivateSubnet1Id     | Private Subnet 1 ID (AZ-a) |
| PrivateSubnet2Id     | Private Subnet 2 ID (AZ-c) |
| EC2SecurityGroupId   | EC2 Security Group ID      |
| EC2Instance1Id       | EC2 Instance 1 ID (AZ-a)   |
| EC2Instance1PublicIP | EC2 Instance 1 Public IP   |
| EC2Instance2Id       | EC2 Instance 2 ID (AZ-c)   |
| EC2Instance2PublicIP | EC2 Instance 2 Public IP   |
| AppPort              | Application listening port |

---

## 주의사항

- **SSH 포트(22)**: 기본값 `0.0.0.0/0`이므로 본인 IP로 제한 권장
- **EC2 2대**: 무료 플랜(레거시 Free Tier)은 t3.micro 750시간/월이므로, 2대를 동시에 24시간 실행하면 한도를 초과할 수 있음
- **비용**: 실습 후 반드시 삭제하여 불필요한 과금 방지

---

## 삭제 방법

```
삭제 순서: ALB → Target Group → ALB Security Group → CloudFormation 스택
```

> ⚠️ 실습에서 생성한 ALB, Target Group, ALB Security Group은 CloudFormation 스택에 포함되지 않으므로 별도로 삭제해야 합니다.

# Step 7-2: Auto Scaling Lab Prerequisites - CloudFormation 템플릿

## 개요

이 CloudFormation 템플릿(`step7-3-asg-prereq.yaml`)은 Step 7-2 Auto Scaling 실습에 필요한 VPC, ALB, Target Group, Security Group을 자동으로 생성합니다.  
Auto Scaling Group, Launch Template은 실습에서 수동으로 생성합니다.

> Step 7-1에서 ALB를 유지한 경우 이 템플릿을 사용하지 않아도 됩니다.

---

## 생성되는 리소스

| 리소스             | 이름 (기본값)              | 설명                                 |
| ------------------ | -------------------------- | ------------------------------------ |
| VPC                | `asg-lab-vpc`              | 10.0.0.0/16 CIDR                     |
| Public Subnet 1    | `asg-lab-public-subnet-1`  | 10.0.1.0/24, ap-northeast-2a         |
| Public Subnet 2    | `asg-lab-public-subnet-2`  | 10.0.2.0/24, ap-northeast-2c         |
| Private Subnet 1   | `asg-lab-private-subnet-1` | 10.0.11.0/24, ap-northeast-2a        |
| Private Subnet 2   | `asg-lab-private-subnet-2` | 10.0.12.0/24, ap-northeast-2c        |
| Internet Gateway   | `asg-lab-igw`              | VPC에 자동 연결                      |
| Public Route Table | `asg-lab-public-rt`        | 0.0.0.0/0 → IGW 경로 포함            |
| ALB Security Group | `asg-lab-alb-sg`           | HTTP(80) 허용                        |
| EC2 Security Group | `asg-lab-ec2-sg`           | ALB에서 AppPort만 허용, SSH 허용     |
| Target Group       | `asg-lab-tg`               | HTTP:AppPort, Health Check: /health/ |
| ALB                | `asg-lab-alb`              | Internet-facing, 2 AZ                |
| ALB Listener       | —                          | HTTP:80 → Target Group forward       |

> 모든 리소스에 `CreatedBy`, `Step`, `Session` 태그가 자동 적용됩니다.

---

## 파라미터

| 파라미터             | 기본값           | 설명                                     |
| -------------------- | ---------------- | ---------------------------------------- |
| `ProjectName`        | `asg-lab`        | 리소스 이름 접두사                       |
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
| `SessionTag`         | `7-2`            | Session 태그 값                          |

---

## 네트워크 아키텍처

```
VPC (10.0.0.0/16)
├── Public Subnet 1  (10.0.1.0/24,  ap-northeast-2a) → Public RT → IGW
├── Public Subnet 2  (10.0.2.0/24,  ap-northeast-2c) → Public RT → IGW
├── Private Subnet 1 (10.0.11.0/24, ap-northeast-2a) → (no IGW)
└── Private Subnet 2 (10.0.12.0/24, ap-northeast-2c) → (no IGW)

ALB (asg-lab-alb) → 두 Public Subnet에 걸쳐 배치
  └── Listener HTTP:80 → Target Group (asg-lab-tg, HTTP:AppPort, Health: /health/)
                            └── Auto Scaling Group (실습에서 수동 생성)
                                ├── EC2 #1 (AZ-a)
                                └── EC2 #2 (AZ-c)
```

---

## Security Group 규칙

### ALB Security Group (`asg-lab-alb-sg`)

| 방향     | 포트 | 프로토콜 | Source    | 설명               |
| -------- | ---- | -------- | --------- | ------------------ |
| Inbound  | 80   | TCP      | 0.0.0.0/0 | HTTP from anywhere |
| Outbound | All  | All      | 0.0.0.0/0 | 모든 아웃바운드    |

### EC2 Security Group (`asg-lab-ec2-sg`)

| 방향     | 포트    | 프로토콜 | Source        | 설명                  |
| -------- | ------- | -------- | ------------- | --------------------- |
| Inbound  | AppPort | TCP      | ALB SG        | ALB에서만 트래픽 허용 |
| Inbound  | 22      | TCP      | SSHAccessCidr | SSH                   |
| Outbound | All     | All      | 0.0.0.0/0     | 모든 아웃바운드       |

---

## 사용 방법

1. AWS Management Console → CloudFormation 서비스
2. **Create stack** → **With new resources (standard)**
3. **Choose an existing template** → **Upload a template file** → `step7-3-asg-prereq.yaml` 업로드
4. **Stack name**: `step7-3-asg-prereq`
5. **Parameters**:
   - `KeyPairName`: 기존 Key Pair 선택 (필수)
   - `AppPort`: 80 (기본값, Nginx)
   - 나머지: 기본값 사용 (SSH IP만 본인 IP로 변경 권장)
6. **Next** → **Next** → **Submit**
7. 약 3~5분 후 `CREATE_COMPLETE` 확인 (ALB 생성에 2~3분 소요)

---

## Outputs

| Output Key         | 설명                                |
| ------------------ | ----------------------------------- |
| VPCId              | VPC ID                              |
| PublicSubnet1Id    | Public Subnet 1 ID (AZ-a)           |
| PublicSubnet2Id    | Public Subnet 2 ID (AZ-c)           |
| PrivateSubnet1Id   | Private Subnet 1 ID (AZ-a)          |
| PrivateSubnet2Id   | Private Subnet 2 ID (AZ-c)          |
| ALBSecurityGroupId | ALB Security Group ID               |
| EC2SecurityGroupId | EC2 Security Group ID               |
| TargetGroupArn     | Target Group ARN (ASG 생성 시 필요) |
| ALBDNSName         | ALB DNS Name (접속 테스트용)        |
| AppPort            | Application listening port          |

---

## 주의사항

- **SSH 포트(22)**: 기본값 `0.0.0.0/0`이므로 본인 IP로 제한 권장
- **ALB 비용**: ALB는 시간당 과금됩니다. 실습 후 반드시 삭제하세요.
- **EC2 Security Group**: AppPort의 Source가 ALB SG로 설정되어 있으므로 EC2에 직접 접근 불가

---

## 삭제 방법

```
삭제 순서: Auto Scaling Group → Launch Template → CloudFormation 스택
```

> ⚠️ Auto Scaling Group이 남아있으면 스택 삭제 시 Target Group 삭제가 실패합니다.  
> 반드시 Auto Scaling Group을 먼저 삭제한 후 스택을 삭제하세요.

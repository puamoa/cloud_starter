# Step 7-1: ALB Lab Prerequisites - CloudFormation 템플릿

## 개요

이 CloudFormation 템플릿(`step7-1-alb-prereq.yaml`)은 Step 7-1 ALB 실습에 필요한 VPC 네트워크 환경과 EC2 인스턴스(Nginx)를 자동으로 생성합니다.  
ALB, Target Group, ALB Security Group은 실습에서 수동으로 생성합니다.

> 이미 실습용 VPC와 EC2가 있다면 이 템플릿을 사용하지 않아도 됩니다.

---

## 생성되는 리소스

| 리소스             | 이름 (기본값)             | 설명                                |
| ------------------ | ------------------------- | ----------------------------------- |
| VPC                | `alb-lab-vpc`             | 10.0.0.0/16 CIDR                    |
| Public Subnet 1    | `alb-lab-public-subnet-1` | 10.0.1.0/24, ap-northeast-2a        |
| Public Subnet 2    | `alb-lab-public-subnet-2` | 10.0.2.0/24, ap-northeast-2c        |
| Internet Gateway   | `alb-lab-igw`             | VPC에 자동 연결                     |
| Public Route Table | `alb-lab-public-rt`       | 0.0.0.0/0 → IGW 경로 포함           |
| EC2 Security Group | `alb-lab-ec2-sg`          | SSH(22), AppPort(8080 또는 80) 허용 |
| EC2 Instance       | `alb-lab-ec2`             | Nginx 자동 설치, AppPort에서 응답   |

> 모든 리소스에 `CreatedBy`, `Step`, `Session` 태그가 자동 적용됩니다.

---

## 파라미터

| 파라미터            | 기본값           | 설명                                           |
| ------------------- | ---------------- | ---------------------------------------------- |
| `ProjectName`       | `alb-lab`        | 리소스 이름 접두사                             |
| `KeyPairName`       | (필수 선택)      | SSH 접속용 기존 Key Pair 이름                  |
| `AppPort`           | `8080`           | 애플리케이션 포트 (Spring Boot=8080, Nginx=80) |
| `SSHAccessCidr`     | `0.0.0.0/0`      | SSH 접근 허용 IP (본인 IP 권장)                |
| `VpcCidr`           | `10.0.0.0/16`    | VPC CIDR 블록                                  |
| `PublicSubnetACidr` | `10.0.1.0/24`    | Public Subnet 1 CIDR (ap-northeast-2a)         |
| `PublicSubnetCCidr` | `10.0.2.0/24`    | Public Subnet 2 CIDR (ap-northeast-2c)         |
| `CreatedByTag`      | `cloudformation` | CreatedBy 태그 값                              |
| `StepTag`           | `step7`          | Step 태그 값                                   |
| `SessionTag`        | `7-1`            | Session 태그 값                                |

---

## 네트워크 아키텍처

```
VPC (10.0.0.0/16)
├── Public Subnet 1 (10.0.1.0/24, ap-northeast-2a) → Public RT → IGW
│   └── EC2 (Nginx, AppPort에서 응답)
└── Public Subnet 2 (10.0.2.0/24, ap-northeast-2c) → Public RT → IGW
    └── (EC2 없음 — ALB 배치용 두 번째 AZ)

ALB (실습에서 수동 생성) → 두 서브넷에 걸쳐 배치
Target Group (실습에서 수동 생성) → EC2를 타겟으로 등록
```

---

## Security Group 규칙

### EC2 Security Group (`alb-lab-ec2-sg`)

| 방향     | 포트    | 프로토콜 | Source        | 설명             |
| -------- | ------- | -------- | ------------- | ---------------- |
| Inbound  | 22      | TCP      | SSHAccessCidr | SSH              |
| Inbound  | AppPort | TCP      | 0.0.0.0/0     | Application port |
| Outbound | All     | All      | 0.0.0.0/0     | 모든 아웃바운드  |

> 실습 태스크 6에서 AppPort의 Source를 ALB Security Group으로 변경합니다.

---

## 사용 방법

1. AWS Management Console → CloudFormation 서비스
2. **Create stack** → **With new resources (standard)**
3. **Upload a template file** → `step7-1-alb-prereq.yaml` 업로드
4. **Stack name**: `step7-1-alb-prereq`
5. **Parameters**:
   - `KeyPairName`: 기존 Key Pair 선택 (필수)
   - `AppPort`: Spring Boot 사용 시 8080(기본값), Nginx 사용 시 80
   - 나머지: 기본값 사용 (SSH IP만 본인 IP로 변경 권장)
6. **Next** → **Next** → **Submit**
7. 약 2~3분 후 `CREATE_COMPLETE` 확인

---

## Outputs

| Output Key         | 설명                       |
| ------------------ | -------------------------- |
| VPCId              | VPC ID                     |
| PublicSubnet1Id    | Public Subnet 1 ID (AZ-a)  |
| PublicSubnet2Id    | Public Subnet 2 ID (AZ-c)  |
| EC2SecurityGroupId | EC2 Security Group ID      |
| EC2InstanceId      | EC2 Instance ID            |
| EC2PublicIP        | EC2 Public IP Address      |
| AppPort            | Application listening port |

---

## 주의사항

- **SSH 포트(22)**: 기본값 `0.0.0.0/0`이므로 본인 IP로 제한 권장
- **AppPort**: Spring Boot를 사용한다면 8080(기본값), Nginx만 사용한다면 80으로 변경
- **비용**: VPC, Subnet, IGW, Route Table, Security Group은 무료. EC2(t2.micro)는 무료 플랜 적용 여부에 따라 다름

---

## 삭제 방법

```
CloudFormation 콘솔 → Stacks → step7-1-alb-prereq 선택 → Delete → Delete stack
```

> ⚠️ 실습에서 생성한 ALB, Target Group, ALB Security Group은 CloudFormation 스택에 포함되지 않으므로 별도로 삭제해야 합니다.  
> 삭제 순서: ALB → Target Group → ALB Security Group → CloudFormation 스택

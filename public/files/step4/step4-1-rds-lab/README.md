# Step 4-1: RDS Lab Prerequisites - CloudFormation 템플릿

## 개요

이 CloudFormation 템플릿(`step4-1-rds-prereq.yaml`)은 Step 4-1 RDS 실습에 필요한 VPC 네트워크 환경을 자동으로 생성합니다.  
DB Subnet Group과 RDS 인스턴스는 실습에서 수동으로 생성합니다.

---

## 생성되는 리소스

| 리소스             | 이름 (기본값)            | 설명                           |
| ------------------ | ------------------------ | ------------------------------ |
| VPC                | `my-vpc`                 | 10.0.0.0/16 CIDR               |
| Public Subnet A    | `my-public-subnet-a`    | 10.0.1.0/24, ap-northeast-2a   |
| Public Subnet C    | `my-public-subnet-c`    | 10.0.2.0/24, ap-northeast-2c   |
| Private Subnet A   | `my-private-subnet-a`   | 10.0.11.0/24, ap-northeast-2a  |
| Private Subnet C   | `my-private-subnet-c`   | 10.0.12.0/24, ap-northeast-2c  |
| Internet Gateway   | `my-igw`                 | VPC에 자동 연결                 |
| Public Route Table | `my-public-rt`           | 0.0.0.0/0 → IGW 경로 포함      |
| EC2 Security Group | `my-ec2-sg`              | SSH(22), HTTP(80), 8080 허용    |
| RDS Security Group | `my-rds-sg`              | MySQL(3306), Source: EC2 SG     |

> 모든 리소스에 `CreatedBy`, `Step`, `Session` 태그가 자동 적용됩니다.

---

## 파라미터

| 파라미터           | 기본값           | 설명                                        |
| ------------------ | ---------------- | ------------------------------------------- |
| `ProjectName`      | `my`             | 리소스 이름 접두사                           |
| `VpcCidr`          | `10.0.0.0/16`    | VPC CIDR 블록                               |
| `PublicSubnetACidr`| `10.0.1.0/24`    | Public Subnet A CIDR                        |
| `PublicSubnetCCidr`| `10.0.2.0/24`    | Public Subnet C CIDR                        |
| `PrivateSubnetACidr`| `10.0.11.0/24`  | Private Subnet A CIDR                       |
| `PrivateSubnetCCidr`| `10.0.12.0/24`  | Private Subnet C CIDR                       |
| `SSHAccessCidr`    | `0.0.0.0/0`      | SSH 접근 허용 IP (본인 IP 권장)             |
| `CreatedByTag`     | `cloudformation` | CreatedBy 태그 값                           |
| `StepTag`          | `step4`          | Step 태그 값                                |
| `SessionTag`       | `4-1`            | Session 태그 값                             |

---

## 네트워크 아키텍처

```
VPC (10.0.0.0/16)
├── Public Subnet A  (10.0.1.0/24,  ap-northeast-2a) → Public RT → IGW
├── Public Subnet C  (10.0.2.0/24,  ap-northeast-2c) → Public RT → IGW
├── Private Subnet A (10.0.11.0/24, ap-northeast-2a) → (no IGW)
└── Private Subnet C (10.0.12.0/24, ap-northeast-2c) → (no IGW)

DB Subnet Group (실습에서 수동 생성) = { Private Subnet A + Private Subnet C }
RDS MySQL (실습에서 수동 생성) → Private Subnet에 배치
EC2 (실습에서 수동 생성) → Public Subnet A에 배치
```

---

## Security Group 규칙

### EC2 Security Group (`my-ec2-sg`)

| 방향     | 포트 | 프로토콜 | Source          | 설명        |
| -------- | ---- | -------- | --------------- | ----------- |
| Inbound  | 22   | TCP      | SSHAccessCidr   | SSH         |
| Inbound  | 80   | TCP      | 0.0.0.0/0       | HTTP        |
| Inbound  | 8080 | TCP      | 0.0.0.0/0       | Spring Boot |
| Outbound | All  | All      | 0.0.0.0/0       | 모든 아웃바운드 |

### RDS Security Group (`my-rds-sg`)

| 방향     | 포트 | 프로토콜 | Source      | 설명                  |
| -------- | ---- | -------- | ----------- | --------------------- |
| Inbound  | 3306 | TCP      | `my-ec2-sg` | EC2에서만 MySQL 접근  |
| Outbound | All  | All      | 0.0.0.0/0   | 모든 아웃바운드       |

---

## 사용 방법

1. AWS Management Console → CloudFormation 서비스
2. **Create stack** → **With new resources (standard)**
3. **Upload a template file** → `step4-1-rds-prereq.yaml` 업로드
4. **Stack name**: `rds-lab-prereq`
5. **Parameters**: 기본값 사용 (SSH IP만 본인 IP로 변경 권장)
6. **Next** → **Next** → **Submit**
7. 약 1~2분 후 `CREATE_COMPLETE` 확인

---

## Outputs

| Output Key         | 설명                  |
| ------------------ | --------------------- |
| VPCId              | VPC ID                |
| PublicSubnetAId    | Public Subnet A ID    |
| PublicSubnetCId    | Public Subnet C ID    |
| PrivateSubnetAId   | Private Subnet A ID   |
| PrivateSubnetCId   | Private Subnet C ID   |
| EC2SecurityGroupId | EC2 Security Group ID |
| RDSSecurityGroupId | RDS Security Group ID |

---

## 주의사항

- **SSH 포트(22)**: 기본값 `0.0.0.0/0`이므로 본인 IP로 제한 권장
- **NAT Gateway 미포함**: Private Subnet에서 인터넷 접근 불가 (이 실습에서는 불필요)
- **비용**: VPC, Subnet, IGW, Route Table, Security Group은 모두 **무료**

---

## 삭제 방법

```
CloudFormation 콘솔 → Stacks → rds-lab-prereq 선택 → Delete → Delete stack
```

> ⚠️ RDS 인스턴스, EC2가 남아있으면 스택 삭제가 실패합니다.  
> 반드시 RDS 삭제 → DB Subnet Group 삭제 → EC2 Terminate → 스택 삭제 순서로 진행하세요.

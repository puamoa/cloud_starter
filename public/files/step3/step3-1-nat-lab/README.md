# Step 3-1: NAT Lab Prerequisites - CloudFormation 템플릿

## 개요

이 CloudFormation 템플릿(`step3-1-nat-prereq.yaml`)은 Step 3-1 NAT 실습에 필요한 VPC 네트워크 환경과 IAM Role을 자동으로 생성합니다.  
NAT Instance, NAT Gateway, Bastion Host, Private EC2는 실습 중 수동으로 생성합니다.

---

## 생성되는 리소스

| 리소스                | 이름 (기본값)         | 설명                                        |
| --------------------- | --------------------- | ------------------------------------------- |
| VPC                   | `my-vpc`              | 10.0.0.0/16 CIDR                            |
| Public Subnet A       | `my-public-subnet-a`  | 10.0.1.0/24, ap-northeast-2a                |
| Public Subnet C       | `my-public-subnet-c`  | 10.0.2.0/24, ap-northeast-2c                |
| Private Subnet A      | `my-private-subnet-a` | 10.0.11.0/24, ap-northeast-2a               |
| Private Subnet C      | `my-private-subnet-c` | 10.0.12.0/24, ap-northeast-2c               |
| Internet Gateway      | `my-igw`              | VPC에 자동 연결                             |
| Public Route Table    | `my-public-rt`        | 0.0.0.0/0 → IGW 경로 포함                   |
| Private Route Table A | `my-private-rt-a`     | local 경로만 (NAT 경로는 실습 중 수동 추가) |
| Private Route Table C | `my-private-rt-c`     | local 경로만 (NAT 경로는 실습 중 수동 추가) |
| Public SG             | `my-public-sg`        | SSH(22) 외부 + VPC 내부 All Traffic         |
| Private SG            | `my-private-sg`       | VPC 내부에서 SSH(22)만                      |
| IAM Role              | `my-ec2-ssm-role`     | EC2 → SSM Session Manager 접속 권한         |
| Instance Profile      | `my-ec2-ssm-role`     | IAM Role을 EC2에 연결하기 위한 컨테이너     |

> 모든 리소스에 `CreatedBy`, `Step`, `Session` 태그가 자동 적용됩니다.  
> (기본값: `cloudformation`, `step3`, `3-1`)

---

## 파라미터

| 파라미터             | 기본값           | 설명                                                                   |
| -------------------- | ---------------- | ---------------------------------------------------------------------- |
| `ProjectName`        | `my`             | 리소스 이름 접두사. 입력값에 따라 모든 리소스 이름이 변경됩니다.       |
| `VpcCidr`            | `10.0.0.0/16`    | VPC CIDR 블록                                                          |
| `PublicSubnetACidr`  | `10.0.1.0/24`    | Public Subnet A CIDR                                                   |
| `PublicSubnetCCidr`  | `10.0.2.0/24`    | Public Subnet C CIDR                                                   |
| `PrivateSubnetACidr` | `10.0.11.0/24`   | Private Subnet A CIDR                                                  |
| `PrivateSubnetCCidr` | `10.0.12.0/24`   | Private Subnet C CIDR                                                  |
| `SSHAccessCidr`      | `0.0.0.0/0`      | SSH(22) 접근 허용 IP 범위. 본인 IP로 제한 권장 (예: `203.0.113.50/32`) |
| `CreatedByTag`       | `cloudformation` | CreatedBy 태그 값                                                      |
| `StepTag`            | `step3`          | Step 태그 값                                                           |
| `SessionTag`         | `3-1`            | Session 태그 값                                                        |

### ProjectName 파라미터 예시

`ProjectName`에 `my`를 입력하면 (기본값):

```
my-vpc, my-public-subnet-a, my-public-subnet-c,
my-private-subnet-a, my-private-subnet-c,
my-igw, my-public-rt, my-private-rt-a, my-private-rt-c,
my-public-sg, my-private-sg, my-ec2-ssm-role
```

---

## 네트워크 아키텍처

```
VPC (10.0.0.0/16)
├── Public Subnet A  (10.0.1.0/24,  ap-northeast-2a) → Public RT → IGW
├── Public Subnet C  (10.0.2.0/24,  ap-northeast-2c) → Public RT → IGW
├── Private Subnet A (10.0.11.0/24, ap-northeast-2a) → Private RT A (no IGW, NAT 수동 추가)
└── Private Subnet C (10.0.12.0/24, ap-northeast-2c) → Private RT C (no IGW, NAT 수동 추가)
```

---

## Security Group 규칙

### Public Security Group (`my-public-sg`)

| 방향     | 포트 | 프로토콜 | Source          | 설명                                       |
| -------- | ---- | -------- | --------------- | ------------------------------------------ |
| Inbound  | 22   | TCP      | `SSHAccessCidr` | SSH (기본: 0.0.0.0/0, My IP 권장)          |
| Inbound  | All  | All      | VPC CIDR        | VPC 내부 All Traffic (NAT Instance 수신용) |
| Outbound | All  | All      | 0.0.0.0/0       | 모든 아웃바운드 허용 (기본값)              |

### Private Security Group (`my-private-sg`)

| 방향     | 포트 | 프로토콜 | Source    | 설명                            |
| -------- | ---- | -------- | --------- | ------------------------------- |
| Inbound  | 22   | TCP      | VPC CIDR  | VPC 내부에서 SSH (Bastion 경유) |
| Outbound | All  | All      | 0.0.0.0/0 | 모든 아웃바운드 허용 (기본값)   |

---

## IAM Role

### `my-ec2-ssm-role`

| 항목           | 값                                              |
| -------------- | ----------------------------------------------- |
| Trust Policy   | `ec2.amazonaws.com` (EC2 서비스가 이 Role 사용) |
| Managed Policy | `AmazonSSMManagedInstanceCore`                  |
| 용도           | Private EC2에서 SSM Session Manager 접속 가능   |

> NAT 설정 후 Private EC2의 SSM Agent가 AWS 엔드포인트에 도달할 수 있어 Session Manager 접속이 활성화됩니다.

---

## 사용 방법

### 1. CloudFormation 콘솔에서 스택 생성

1. AWS Management Console → CloudFormation 서비스로 이동합니다.
2. **Create stack** → **With new resources (standard)** 선택
3. **Upload a template file** → `step3-1-nat-prereq.yaml` 업로드
4. **Next** 클릭
5. **Stack name**: `nat-lab-prereq` 입력
6. **Parameters**: 기본값 사용 또는 필요 시 변경
7. **Next** → **Next** 클릭
8. **Capabilities** 체크박스 선택 (IAM 리소스 생성 동의)
9. **Submit** 클릭
10. 스택 상태가 `CREATE_COMPLETE`가 될 때까지 대기 (약 1~2분)

> ⚠️ 이 템플릿은 IAM Role을 생성하므로 **Capabilities 체크박스**를 반드시 선택해야 합니다.

### 2. 생성 결과 확인

스택의 **Outputs** 탭에서 생성된 리소스의 ID를 확인할 수 있습니다:

| Output Key                | 설명                      |
| ------------------------- | ------------------------- |
| VPCId                     | VPC ID                    |
| PublicSubnetAId           | Public Subnet A ID        |
| PublicSubnetCId           | Public Subnet C ID        |
| PrivateSubnetAId          | Private Subnet A ID       |
| PrivateSubnetCId          | Private Subnet C ID       |
| PublicSecurityGroupId     | Public Security Group ID  |
| PrivateSecurityGroupId    | Private Security Group ID |
| PrivateRouteTableAId      | Private Route Table A ID  |
| PrivateRouteTableCId      | Private Route Table C ID  |
| EC2SSMInstanceProfileName | Instance Profile 이름     |

---

## 주의사항

- **SSH 포트(22)**: `SSHAccessCidr` 파라미터의 기본값이 `0.0.0.0/0`(모든 IP 허용)입니다.  
  본인 IP로 제한하는 것을 **강력히 권장**합니다. 공인 IP 확인: [ifconfig.me](https://ifconfig.me)
- **NAT**: 이 템플릿에는 NAT Gateway/Instance가 포함되어 있지 않습니다. 실습 중 수동으로 생성합니다.
- **IAM Role 충돌**: Step 2에서 동일 이름(`my-ec2-ssm-role`)의 Role을 이미 생성한 경우, 스택 생성이 실패할 수 있습니다. 이 경우 `ProjectName`을 다른 값(예: `nat`)으로 변경하세요.
- **비용**: VPC, Subnet, IGW, Route Table, Security Group, IAM Role은 모두 **무료** 리소스입니다. 이 템플릿만으로는 비용이 발생하지 않습니다.

---

## 삭제 방법

```
CloudFormation 콘솔 → Stacks → nat-lab-prereq 선택 → Delete → Delete stack
```

스택을 삭제하면 생성된 모든 리소스(VPC, Subnet, IGW, Route Table, Security Group, IAM Role)가 자동으로 삭제됩니다.

> ⚠️ VPC 내에 EC2 인스턴스, NAT Gateway 등 다른 리소스가 남아있으면 스택 삭제가 실패합니다.  
> 반드시 NAT Gateway 삭제 → EC2 Terminate → EIP 해제 → 스택 삭제 순서로 진행하세요.

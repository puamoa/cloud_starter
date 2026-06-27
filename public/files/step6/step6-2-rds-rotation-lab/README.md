# Step 6-2: RDS Rotation Lab Prerequisites - CloudFormation 템플릿

## 개요

이 CloudFormation 템플릿(`step6-2-rds-rotation-prereq.yaml`)은 Step 6-2 태스크 5 (RDS 비밀번호 자동 로테이션)에 필요한 환경을 자동으로 생성합니다.  
Step 4에서 Amazon RDS를 이미 생성한 경우에는 이 템플릿을 사용하지 않아도 됩니다.

> ⚠️ **VPC Endpoint (Secrets Manager)는 이 템플릿에 포함되지 않습니다.**  
> 실습 가이드에서 직접 생성합니다 (VPC Endpoint 학습 목적).

---

## 생성되는 리소스

| 리소스               | 이름 (기본값)              | 설명                                    |
| -------------------- | -------------------------- | --------------------------------------- |
| VPC                  | `starter-vpc`              | 10.0.0.0/16 CIDR                        |
| Public Subnet A      | `starter-public-subnet-a`  | 10.0.1.0/24, ap-northeast-2a            |
| Public Subnet C      | `starter-public-subnet-c`  | 10.0.2.0/24, ap-northeast-2c            |
| Private Subnet A     | `starter-private-subnet-a` | 10.0.11.0/24, ap-northeast-2a           |
| Private Subnet C     | `starter-private-subnet-c` | 10.0.12.0/24, ap-northeast-2c           |
| Internet Gateway     | `starter-igw`              | VPC에 자동 연결                          |
| Public Route Table   | `starter-public-rt`        | 0.0.0.0/0 → IGW 경로 포함               |
| RDS Security Group   | `starter-rds-sg`           | MySQL(3306) VPC 내부 + Lambda SG에서 허용 |
| Lambda Security Group| `starter-lambda-sg`        | 로테이션 Lambda용                        |
| DB Subnet Group      | `starter-db-subnet-group`  | Private Subnet A + C                     |
| RDS MySQL            | `starter-mysql`            | db.t3.micro, MySQL 8.0                   |

> 모든 리소스에 `CreatedBy`, `Step`, `Session` 태그가 자동 적용됩니다.

---

## 파라미터

| 파라미터             | 기본값             | 설명                                          |
| -------------------- | ------------------ | --------------------------------------------- |
| `ProjectName`        | `starter`          | 리소스 이름 접두사                             |
| `DBMasterUsername`   | `admin`            | RDS 마스터 사용자명 (Secrets Manager와 일치)   |
| `DBMasterPassword`   | `MyPassword123!`   | RDS 마스터 비밀번호 (Secrets Manager와 일치)   |
| `DBName`             | `starter_db`       | 초기 데이터베이스명 (Secrets Manager와 일치)   |
| `VpcCidr`            | `10.0.0.0/16`      | VPC CIDR 블록                                 |
| `PublicSubnetACidr`  | `10.0.1.0/24`      | Public Subnet A CIDR                          |
| `PublicSubnetCCidr`  | `10.0.2.0/24`      | Public Subnet C CIDR                          |
| `PrivateSubnetACidr` | `10.0.11.0/24`     | Private Subnet A CIDR                         |
| `PrivateSubnetCCidr` | `10.0.12.0/24`     | Private Subnet C CIDR                         |
| `DBInstanceClass`    | `db.t3.micro`      | RDS 인스턴스 타입                              |
| `DBAllocatedStorage` | `20`               | RDS 스토리지 크기 (GB)                         |
| `CreatedByTag`       | `cloudformation`   | CreatedBy 태그 값                              |
| `StepTag`            | `step6`            | Step 태그 값                                   |
| `SessionTag`         | `6-2`              | Session 태그 값                                |

---

## 네트워크 아키텍처

```
VPC (10.0.0.0/16)
├── Public Subnet A  (10.0.1.0/24,  ap-northeast-2a) → Public RT → IGW
├── Public Subnet C  (10.0.2.0/24,  ap-northeast-2c) → Public RT → IGW
├── Private Subnet A (10.0.11.0/24, ap-northeast-2a) → (no IGW)
└── Private Subnet C (10.0.12.0/24, ap-northeast-2c) → (no IGW)

DB Subnet Group = { Private Subnet A + Private Subnet C }
RDS MySQL → Private Subnet에 배치 (PubliclyAccessible: false)

[실습에서 추가] VPC Endpoint (Secrets Manager) → Private Subnet에 배치
[실습에서 추가] Lambda (로테이션 함수) → Private Subnet에 배치, Lambda SG 적용
```

---

## Security Group 규칙

### RDS Security Group (`starter-rds-sg`)

| 방향     | 포트 | 프로토콜 | Source                  | 설명                         |
| -------- | ---- | -------- | ----------------------- | ---------------------------- |
| Inbound  | 3306 | TCP      | VPC CIDR (10.0.0.0/16)  | VPC 내부에서 MySQL 접근      |
| Inbound  | 3306 | TCP      | `starter-lambda-sg`     | Lambda 로테이션 함수에서 접근 |
| Outbound | All  | All      | 0.0.0.0/0               | 모든 아웃바운드              |

### Lambda Security Group (`starter-lambda-sg`)

| 방향     | 포트 | 프로토콜 | Source              | 설명                          |
| -------- | ---- | -------- | ------------------- | ----------------------------- |
| Inbound  | 443  | TCP      | VPC CIDR (10.0.0.0/16) | VPC Endpoint 접근 허용 (HTTPS) |
| Outbound | All  | All      | 0.0.0.0/0           | 모든 아웃바운드               |

> Lambda SG는 VPC Endpoint의 SG로도 사용됩니다. 인바운드 443을 허용해야 Lambda → Endpoint 통신이 가능합니다.

---

## 비용

| 리소스         | 비용                            | 비고                         |
| -------------- | ------------------------------- | ---------------------------- |
| VPC, Subnet 등 | 무료                            | 네트워크 리소스는 무료        |
| RDS db.t3.micro| 시간당 약 $0.026 (서울 리전)    | **실습 후 반드시 스택 삭제**  |
| 스토리지 20GB  | 월 $2.76 (gp3 기준)            | 스택 삭제 시 함께 삭제        |

> 💡 1시간 실습 기준 약 $0.03. 스택 삭제를 잊으면 월 ~$20 과금됩니다.

---

## 사용 방법

1. AWS Management Console → CloudFormation 서비스
2. **Create stack** → **With new resources (standard)**
3. **Upload a template file** → `step6-2-rds-rotation-prereq.yaml` 업로드
4. **Stack name**: `step6-rds-rotation-lab`
5. **Parameters**:
   - `DBMasterUsername`, `DBMasterPassword`, `DBName`을 Secrets Manager에 저장한 값과 일치시키세요
   - 나머지는 기본값 사용
6. **Next** → **Next** → **Acknowledge IAM** → **Submit**
7. 약 5~10분 후 `CREATE_COMPLETE` 확인 (RDS 생성에 시간 소요)

---

## Outputs

스택 생성 후 **Outputs** 탭에서 확인:

| Output Key             | 설명                                        | 활용                                |
| ---------------------- | ------------------------------------------- | ----------------------------------- |
| `RDSEndpoint`          | RDS MySQL 엔드포인트                         | Secrets Manager 'host' 값으로 업데이트 |
| `RDSPort`              | RDS 포트 (3306)                              | Secrets Manager 'port' 값            |
| `DBName`               | 데이터베이스 이름                            | Secrets Manager 'dbname' 값          |
| `VPCId`                | VPC ID                                       | VPC Endpoint 생성 시 사용            |
| `PrivateSubnetAId`     | Private Subnet A ID                          | VPC Endpoint 서브넷 선택             |
| `PrivateSubnetCId`     | Private Subnet C ID                          | VPC Endpoint 서브넷 선택             |
| `LambdaSecurityGroupId`| Lambda Security Group ID                     | VPC Endpoint SG로 사용               |

> ⚠️ 스택 생성 후 Secrets Manager의 `host` 값을 `RDSEndpoint` 출력값으로 **업데이트**해야 합니다.

---

## 삭제 방법

```
CloudFormation 콘솔 → Stacks → step6-rds-rotation-lab 선택 → Delete → Delete stack
```

> ⚠️ RDS 인스턴스 포함이므로 삭제에 5~10분 소요됩니다.  
> `DeletionPolicy: Delete` + `DeletionProtection: false`로 설정되어 있어 스택 삭제 시 RDS도 자동 삭제됩니다.  
> 스냅샷을 남기지 않으므로 데이터는 복구할 수 없습니다.

---

## 주의사항

- **비용**: RDS가 실행 중인 동안 시간당 과금됩니다. **실습 종료 후 반드시 스택을 삭제하세요.**
- **VPC Endpoint 별도**: 이 템플릿에는 VPC Endpoint가 포함되지 않습니다. 실습에서 직접 생성합니다.
- **Secrets Manager 값 업데이트 필수**: 스택 생성 후 `host` 값을 RDS 엔드포인트로 변경해야 합니다.
- **BackupRetentionPeriod: 0**: 학습용이므로 자동 백업을 비활성화했습니다.

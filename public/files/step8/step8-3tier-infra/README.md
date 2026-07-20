# Step 8-1: 3-Tier 웹 애플리케이션 인프라 - AWS CloudFormation 템플릿

## 개요

이 폴더에는 Step 8 3-Tier 실습에 필요한 AWS CloudFormation 템플릿 4개가 포함되어 있습니다.  
**계층별로 분리**하여 실무 패턴(라이프사이클 기반 스택 분리)을 학습합니다.

---

## 파일 구성

| 파일                  | 스택 이름 (권장) | 역할                                            | 의존성      |
| --------------------- | ---------------- | ----------------------------------------------- | ----------- |
| `step8-network.yaml`  | `step8-network`  | VPC, 서브넷, IGW, NAT(옵션), RT, SG             | 없음 (기반) |
| `step8-data.yaml`     | `step8-data`     | DB Parameter Group, DB Subnet Group, Amazon RDS | network     |
| `step8-frontend.yaml` | `step8-frontend` | Amazon S3 버킷 (정적 호스팅)                    | 없음 (독립) |
| `step8-backend.yaml`  | `step8-backend`  | ALB, Target Group, Listener                     | network     |

---

## 생성 순서 (의존성)

```
① step8-network  (기반 인프라, 2~3분)
       │
       ├── ② step8-data     (Amazon RDS, 8~10분)  ← network Export 참조
       │
       └── ④ step8-backend  (ALB, 2~3분)          ← network Export 참조

③ step8-frontend (Amazon S3, 1분)                 ← 독립 (동시 생성 가능)
```

> **중요**: `ProjectName` 파라미터를 4개 스택 모두 동일하게 설정해야 Cross-stack Reference가 동작합니다.

---

## 삭제 순서 (의존성 역순)

```
Backend (ALB)  ──┐
                 ├──→  Network (마지막)
Data (RDS)     ──┘

Frontend (S3)  ──→  언제든 삭제 가능 (독립)
```

> Network 스택을 먼저 삭제하면 "Export is being used" 에러가 발생합니다.  
> Backend와 Data를 먼저 삭제한 후 Network를 삭제하세요.

---

## 스택별 상세

### 1. step8-network.yaml

**생성되는 리소스:**

| 리소스           | 이름                             | 설명                                |
| ---------------- | -------------------------------- | ----------------------------------- |
| VPC              | `{ProjectName}-vpc`              | 10.0.0.0/16                         |
| Public Subnet 1  | `{ProjectName}-public-subnet-1`  | 10.0.1.0/24, AZ-a                   |
| Public Subnet 2  | `{ProjectName}-public-subnet-2`  | 10.0.2.0/24, AZ-c                   |
| Private Subnet 1 | `{ProjectName}-private-subnet-1` | 10.0.11.0/24, AZ-a                  |
| Private Subnet 2 | `{ProjectName}-private-subnet-2` | 10.0.12.0/24, AZ-c                  |
| Internet Gateway | `{ProjectName}-igw`              | VPC에 연결                          |
| NAT Gateway      | `{ProjectName}-nat-gw`           | 조건부 생성 (CreateNATGateway=Yes)  |
| Public RT        | `{ProjectName}-public-rt`        | 0.0.0.0/0 → IGW                     |
| Private RT       | `{ProjectName}-private-rt`       | 0.0.0.0/0 → NAT (조건부)            |
| ALB SG           | `{ProjectName}-alb-sg`           | HTTP(80), HTTPS(443) from 0.0.0.0/0 |
| EC2 SG           | `{ProjectName}-ec2-sg`           | 8080 from ALB SG                    |
| RDS SG           | `{ProjectName}-rds-sg`           | 3306 from EC2 SG                    |

**파라미터:**

| 파라미터           | 기본값         | 설명                                 |
| ------------------ | -------------- | ------------------------------------ |
| ProjectName        | `my-3tier-app` | 리소스 이름 접두사                   |
| CreateNATGateway   | `Yes`          | NAT Gateway 생성 여부 (No=비용 절감) |
| VpcCidr            | `10.0.0.0/16`  | VPC CIDR                             |
| PublicSubnet1Cidr  | `10.0.1.0/24`  | Public Subnet 1                      |
| PublicSubnet2Cidr  | `10.0.2.0/24`  | Public Subnet 2                      |
| PrivateSubnet1Cidr | `10.0.11.0/24` | Private Subnet 1                     |
| PrivateSubnet2Cidr | `10.0.12.0/24` | Private Subnet 2                     |

> NAT Gateway는 비용 절감을 위해 1개만 생성합니다.  
> 프로덕션에서는 AZ별 1개씩 (2개) 배치하여 고가용성을 확보합니다.

---

### 2. step8-data.yaml

**생성되는 리소스:**

| 리소스             | 이름                            | 설명                         |
| ------------------ | ------------------------------- | ---------------------------- |
| DB Parameter Group | `{ProjectName}-db-params`       | timezone=Asia/Seoul, utf8mb4, MySQL 8.4 |
| DB Subnet Group    | `{ProjectName}-db-subnet-group` | Private Subnet 1 + 2         |
| RDS MySQL          | `{ProjectName}-db`              | MySQL 8.4, db.t3.micro       |

**파라미터:**

| 파라미터         | 기본값         | 설명                       |
| ---------------- | -------------- | -------------------------- |
| ProjectName      | `my-3tier-app` | network 스택과 동일해야 함 |
| DBMasterUsername | `admin`        | RDS 마스터 사용자          |
| DBMasterPassword | (필수)         | RDS 비밀번호 (8자 이상)    |
| DBInstanceClass  | `db.t3.micro`  | 인스턴스 클래스            |

**RDS 설정:**

- timezone: `Asia/Seoul`
- 문자셋: `utf8mb4` (한글 + 이모지 지원)
- Multi-AZ: false (실습용)
- Backup: 0일 (실습용)
- DeletionProtection: false

---

### 3. step8-frontend.yaml

**생성되는 리소스:**

| 리소스        | 이름                                 | 설명                        |
| ------------- | ------------------------------------ | --------------------------- |
| S3 Bucket     | `{ProjectName}-frontend-{AccountId}` | 정적 웹 호스팅, Public Read |
| Bucket Policy | -                                    | s3:GetObject 허용           |

**파라미터:**

| 파라미터    | 기본값         | 설명               |
| ----------- | -------------- | ------------------ |
| ProjectName | `my-3tier-app` | 리소스 이름 접두사 |

> Amazon S3는 VPC 외부의 글로벌 서비스이므로 Network 스택에 의존하지 않습니다.

---

### 4. step8-backend.yaml

**생성되는 리소스:**

| 리소스       | 이름                | 설명                                      |
| ------------ | ------------------- | ----------------------------------------- |
| ALB          | `{ProjectName}-alb` | Internet-facing, Public Subnet 배치       |
| Target Group | `{ProjectName}-tg`  | HTTP:8080, Health Check: /actuator/health |
| Listener     | HTTP:80             | Forward to Target Group                   |

**파라미터:**

| 파라미터        | 기본값             | 설명                       |
| --------------- | ------------------ | -------------------------- |
| ProjectName     | `my-3tier-app`     | network 스택과 동일해야 함 |
| AppPort         | `8080`             | Spring Boot 포트           |
| HealthCheckPath | `/actuator/health` | ALB Health Check 경로      |

> Amazon EC2 인스턴스는 Step 8-3에서 수동 생성하여 Target Group에 등록합니다.

---

## Cross-stack Reference

스택 간 값 전달은 `Export`/`ImportValue` 패턴을 사용합니다:

```yaml
# Network 스택에서 Export
Outputs:
  VPCId:
    Value: !Ref VPC
    Export:
      Name: !Sub '${ProjectName}-vpc-id'

# Data/Backend 스택에서 Import
Resources:
  SomeResource:
    Properties:
      VpcId:
        Fn::ImportValue: !Sub '${ProjectName}-vpc-id'
```

---

## 주의사항

- **NAT Gateway**: 시간당 과금 발생. 실습 후 반드시 스택 삭제
- **Amazon RDS**: 생성에 8~10분 소요. Data 스택 생성 동안 Frontend/Backend 동시 진행 가능
- **ProjectName 일치**: 4개 스택 모두 동일한 ProjectName을 사용해야 Import 동작
- **비용**: NAT + RDS + ALB 동시 실행 시 시간당 비용 발생. 하루 안에 완료 권장

# Step 2-1: EC2 Lab Prerequisites - CloudFormation 템플릿

## 개요

이 CloudFormation 템플릿(`step2-1-ec2-prereq.yaml`)은 Step 2-1 EC2 실습에 필요한 VPC 네트워크 환경을 자동으로 생성합니다.  
Step 1-1 ~ 1-3에서 수동으로 구성한 환경과 동일한 구성을 한 번에 프로비저닝합니다.

---

## 생성되는 리소스

| 리소스                | 이름 (기본값)         | 설명                                     |
| --------------------- | --------------------- | ---------------------------------------- |
| VPC                   | `my-vpc`              | 10.0.0.0/16 CIDR                         |
| Public Subnet A       | `my-public-subnet-a`  | 10.0.1.0/24, ap-northeast-2a             |
| Public Subnet C       | `my-public-subnet-c`  | 10.0.2.0/24, ap-northeast-2c             |
| Private Subnet A      | `my-private-subnet-a` | 10.0.11.0/24, ap-northeast-2a            |
| Private Subnet C      | `my-private-subnet-c` | 10.0.12.0/24, ap-northeast-2c            |
| Internet Gateway      | `my-igw`              | VPC에 자동 연결                          |
| Public Route Table    | `my-public-rt`        | 0.0.0.0/0 → IGW 경로 포함                |
| Private Route Table A | `my-private-rt-a`     | local 경로만 (인터넷 경로 없음)          |
| Private Route Table C | `my-private-rt-c`     | local 경로만 (인터넷 경로 없음)          |
| EC2 Security Group    | `my-ec2-sg`           | SSH(22), HTTP(80), HTTPS(443), 8080 허용 |
| RDS Security Group    | `my-rds-sg`           | MySQL(3306), Source: EC2 SG              |

> 모든 리소스에 `CreatedBy`, `Step`, `Session` 태그가 자동 적용됩니다. (파라미터로 값 변경 가능, 기본값: `cloudformation`, `step2`, `2-1`)

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
| `HTTPAccessCidr`     | `0.0.0.0/0`      | HTTP(80) 접근 허용 IP 범위. 웹 서비스이므로 기본값 유지 가능           |
| `HTTPSAccessCidr`    | `0.0.0.0/0`      | HTTPS(443) 접근 허용 IP 범위                                           |
| `AppPortAccessCidr`  | `0.0.0.0/0`      | Spring Boot(8080) 접근 허용 IP 범위                                    |
| `CreatedByTag`       | `cloudformation` | CreatedBy 태그 값. Tag Editor에서 리소스 검색 시 사용                  |
| `StepTag`            | `step2`          | Step 태그 값. 주차별 리소스 그룹 식별용                                |
| `SessionTag`         | `2-1`            | Session 태그 값. 세션별 리소스 그룹 식별용                             |

### ProjectName 파라미터 예시

`ProjectName`에 `my`를 입력하면 (기본값):

```
my-vpc, my-public-subnet-a, my-public-subnet-c,
my-private-subnet-a, my-private-subnet-c,
my-igw, my-public-rt, my-private-rt-a, my-private-rt-c,
my-ec2-sg, my-rds-sg
```

`ProjectName`에 `prod`를 입력하면:

```
prod-vpc, prod-public-subnet-a, prod-public-subnet-c,
prod-private-subnet-a, prod-private-subnet-c,
prod-igw, prod-public-rt, prod-private-rt-a, prod-private-rt-c,
prod-ec2-sg, prod-rds-sg
```

---

## 네트워크 아키텍처

```
VPC (10.0.0.0/16)
├── Public Subnet A  (10.0.1.0/24,  ap-northeast-2a) → Public RT → IGW
├── Public Subnet C  (10.0.2.0/24,  ap-northeast-2c) → Public RT → IGW
├── Private Subnet A (10.0.11.0/24, ap-northeast-2a) → Private RT A (no IGW)
└── Private Subnet C (10.0.12.0/24, ap-northeast-2c) → Private RT C (no IGW)
```

---

## Security Group 규칙

### EC2 Security Group (`my-ec2-sg`)

| 방향     | 포트 | 프로토콜 | Source (파라미터)   | 설명                              |
| -------- | ---- | -------- | ------------------- | --------------------------------- |
| Inbound  | 22   | TCP      | `SSHAccessCidr`     | SSH (기본: 0.0.0.0/0, My IP 권장) |
| Inbound  | 80   | TCP      | `HTTPAccessCidr`    | HTTP (기본: 0.0.0.0/0)            |
| Inbound  | 443  | TCP      | `HTTPSAccessCidr`   | HTTPS (기본: 0.0.0.0/0)           |
| Inbound  | 8080 | TCP      | `AppPortAccessCidr` | Spring Boot (기본: 0.0.0.0/0)     |
| Outbound | All  | All      | 0.0.0.0/0           | 모든 아웃바운드 허용 (기본값)     |

> 각 포트의 접근 허용 IP를 파라미터로 개별 제어할 수 있습니다.  
> 예: SSH만 본인 IP로 제한하고 나머지는 전체 허용 → `SSHAccessCidr`만 `203.0.113.50/32`로 변경

### RDS Security Group (`my-rds-sg`)

| 방향     | 포트 | 프로토콜 | Source      | 설명                          |
| -------- | ---- | -------- | ----------- | ----------------------------- |
| Inbound  | 3306 | TCP      | `my-ec2-sg` | EC2에서만 MySQL 접근 허용     |
| Outbound | All  | All      | 0.0.0.0/0   | 모든 아웃바운드 허용 (기본값) |

---

## 사용 방법

### 1. CloudFormation 콘솔에서 스택 생성

1. AWS Management Console → CloudFormation 서비스로 이동합니다.
2. **Create stack** → **With new resources (standard)** 선택
3. **Upload a template file** → `step2-1-ec2-prereq.yaml` 업로드
4. **Next** 클릭
5. **Stack name**: `ec2-lab-prereq` 입력
6. **Parameters**: 기본값 사용 또는 `ProjectName` 변경
7. **Next** → **Next** → **Submit** 클릭
8. 스택 상태가 `CREATE_COMPLETE`가 될 때까지 대기 (약 1~2분)

### 2. 생성 결과 확인

스택의 **Outputs** 탭에서 생성된 리소스의 ID를 확인할 수 있습니다:

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

- **SSH 포트(22)**: `SSHAccessCidr` 파라미터의 기본값이 `0.0.0.0/0`(모든 IP 허용)입니다.  
  스택 생성 시 본인 IP를 입력하거나(`x.x.x.x/32`), 생성 후 콘솔에서 `My IP`로 변경하는 것을 **강력히 권장**합니다.  
  본인의 공인 IP는 [ifconfig.me](https://ifconfig.me)에서 확인할 수 있습니다.
- **NAT Gateway**: 이 템플릿에는 NAT Gateway가 포함되어 있지 않습니다. Private Subnet의 인스턴스는 인터넷에 접근할 수 없습니다. NAT Gateway는 Step 3에서 별도로 학습합니다.
- **비용**: VPC, Subnet, IGW, Route Table, Security Group은 모두 **무료** 리소스입니다. 이 템플릿을 실행해도 비용이 발생하지 않습니다.

---

## 삭제 방법

```
CloudFormation 콘솔 → Stacks → ec2-lab-prereq 선택 → Delete → Delete stack
```

스택을 삭제하면 생성된 모든 리소스(VPC, Subnet, IGW, Route Table, Security Group)가 자동으로 삭제됩니다.

> ⚠️ VPC 내에 EC2 인스턴스, RDS 등 다른 리소스가 남아있으면 스택 삭제가 실패합니다.  
> 반드시 EC2 Terminate → 스택 삭제 순서로 진행하세요.

---

## CloudFormation 템플릿 핵심 문법 가이드

이 YAML 파일에서 사용된 CloudFormation의 주요 개념과 문법을 정리합니다.

### 템플릿 기본 구조

```yaml
AWSTemplateFormatVersion: '2010-09-09' # 템플릿 형식 버전 (고정값)
Description: 스택 설명 # CloudFormation 콘솔에 표시되는 설명

Parameters: # 사용자 입력값 정의
Resources: # 생성할 AWS 리소스 정의 (필수)
Outputs: # 생성 결과 출력값 정의
```

| 섹션                       | 필수 여부 | 역할                                              |
| -------------------------- | --------- | ------------------------------------------------- |
| `AWSTemplateFormatVersion` | 선택      | 템플릿 형식 버전. 현재 유일한 값은 `'2010-09-09'` |
| `Description`              | 선택      | 스택 설명. 콘솔에서 스택 목록에 표시됨            |
| `Parameters`               | 선택      | 스택 생성 시 사용자가 입력하는 값                 |
| `Resources`                | **필수**  | 실제 생성할 AWS 리소스 목록                       |
| `Outputs`                  | 선택      | 생성된 리소스의 정보를 외부에 노출                |

---

### Parameters (파라미터)

파라미터는 스택 생성 시 사용자가 값을 입력할 수 있게 해주는 **변수**입니다.  
콘솔에서 스택을 생성할 때 입력 폼으로 표시됩니다.

```yaml
Parameters:
  ProjectName:
    Type: String # 파라미터의 데이터 타입
    Default: my # 기본값 (사용자가 입력하지 않으면 이 값 사용)
    Description: Prefix for names # 콘솔에 표시되는 설명
    AllowedPattern: '[a-zA-Z]...' # 입력값 검증 (정규식)
    ConstraintDescription: ... # 검증 실패 시 표시할 메시지
    MinLength: 1 # 최소 길이
    MaxLength: 20 # 최대 길이
```

**주요 파라미터 속성:**

| 속성                      | 설명                        | 예시                                       |
| ------------------------- | --------------------------- | ------------------------------------------ |
| `Type`                    | 데이터 타입                 | `String`, `Number`, `AWS::EC2::VPC::Id` 등 |
| `Default`                 | 기본값                      | 사용자가 비워두면 이 값이 적용됨           |
| `AllowedPattern`          | 정규식으로 입력값 검증      | `'[a-zA-Z][a-zA-Z0-9-]*'`                  |
| `AllowedValues`           | 허용되는 값 목록 (드롭다운) | `['t2.micro', 't3.micro']`                 |
| `MinLength` / `MaxLength` | 문자열 길이 제한            | `MinLength: 1`                             |
| `MinValue` / `MaxValue`   | 숫자 범위 제한              | `MinValue: 1`                              |

**Type의 주요 종류:**

| Type                         | 설명         | 콘솔 표시             |
| ---------------------------- | ------------ | --------------------- |
| `String`                     | 일반 문자열  | 텍스트 입력 필드      |
| `Number`                     | 숫자         | 숫자 입력 필드        |
| `AWS::EC2::VPC::Id`          | VPC ID       | 기존 VPC 드롭다운     |
| `AWS::EC2::Subnet::Id`       | Subnet ID    | 기존 서브넷 드롭다운  |
| `AWS::EC2::KeyPair::KeyName` | 키 페어 이름 | 기존 키 페어 드롭다운 |

---

### Resources (리소스)

실제 생성할 AWS 리소스를 정의합니다. 각 리소스는 **논리적 이름(Logical ID)**을 가집니다.

```yaml
Resources:
  VPC: # 논리적 이름 (템플릿 내에서 참조할 때 사용)
    Type: AWS::EC2::VPC # AWS 리소스 타입
    Properties: # 리소스 설정값
      CidrBlock: !Ref VpcCidr
      EnableDnsSupport: true
      Tags:
        - Key: Name
          Value: !Sub '${ProjectName}-vpc'
```

**구성 요소:**

| 요소         | 설명                                      | 예시                                       |
| ------------ | ----------------------------------------- | ------------------------------------------ |
| 논리적 이름  | 템플릿 내에서 이 리소스를 식별하는 이름   | `VPC`, `PublicSubnetA`, `EC2SecurityGroup` |
| `Type`       | 생성할 AWS 리소스의 종류                  | `AWS::EC2::VPC`, `AWS::EC2::Subnet`        |
| `Properties` | 리소스의 설정값                           | CIDR, 이름, 포트 등                        |
| `DependsOn`  | 이 리소스보다 먼저 생성되어야 하는 리소스 | `DependsOn: AttachGateway`                 |

**이 템플릿에서 사용된 리소스 타입:**

| Type                                    | 설명                        |
| --------------------------------------- | --------------------------- |
| `AWS::EC2::VPC`                         | VPC                         |
| `AWS::EC2::Subnet`                      | 서브넷                      |
| `AWS::EC2::InternetGateway`             | Internet Gateway            |
| `AWS::EC2::VPCGatewayAttachment`        | IGW를 VPC에 연결            |
| `AWS::EC2::RouteTable`                  | Route Table                 |
| `AWS::EC2::Route`                       | Route Table에 경로 추가     |
| `AWS::EC2::SubnetRouteTableAssociation` | 서브넷을 Route Table에 연결 |
| `AWS::EC2::SecurityGroup`               | Security Group              |

---

### 내장 함수 (Intrinsic Functions)

CloudFormation에서 동적으로 값을 생성하거나 참조할 때 사용하는 함수입니다.

#### `!Ref` — 참조

다른 리소스의 ID 또는 파라미터의 값을 가져옵니다.

```yaml
# 파라미터 값 참조
CidrBlock: !Ref VpcCidr # → "10.0.0.0/16" (파라미터 입력값)

# 리소스 참조 (리소스의 물리적 ID 반환)
VpcId: !Ref VPC # → "vpc-0abc123def456" (생성된 VPC의 실제 ID)
SubnetId: !Ref PublicSubnetA # → "subnet-0abc123def456"
```

**`!Ref`가 반환하는 값은 리소스 타입마다 다릅니다:**

| 리소스 타입                 | `!Ref` 반환값                |
| --------------------------- | ---------------------------- |
| `AWS::EC2::VPC`             | VPC ID (`vpc-xxx`)           |
| `AWS::EC2::Subnet`          | Subnet ID (`subnet-xxx`)     |
| `AWS::EC2::SecurityGroup`   | Security Group ID (`sg-xxx`) |
| `AWS::EC2::InternetGateway` | IGW ID (`igw-xxx`)           |
| `AWS::EC2::RouteTable`      | Route Table ID (`rtb-xxx`)   |
| Parameter                   | 파라미터 입력값 (문자열)     |

#### `!Sub` — 문자열 치환

문자열 안에 변수를 삽입합니다. `${변수명}` 형태로 파라미터나 리소스를 참조합니다.

```yaml
# 파라미터 값을 문자열에 삽입
Value: !Sub '${ProjectName}-vpc'
# ProjectName이 "my"이면 → "my-vpc"
# ProjectName이 "prod"이면 → "prod-vpc"

# AWS 의사 파라미터 사용
Name: !Sub '${AWS::StackName}-VPCId'
# 스택 이름이 "ec2-lab-prereq"이면 → "ec2-lab-prereq-VPCId"
```

**`!Sub`에서 사용 가능한 AWS 의사 파라미터:**

| 의사 파라미터       | 값                               |
| ------------------- | -------------------------------- |
| `${AWS::StackName}` | 현재 스택 이름                   |
| `${AWS::Region}`    | 현재 리전 (예: `ap-northeast-2`) |
| `${AWS::AccountId}` | AWS 계정 ID                      |

#### `!Ref` vs `!Sub` 비교

```yaml
# !Ref: 단순히 값을 가져올 때
CidrBlock: !Ref VpcCidr # → "10.0.0.0/16"

# !Sub: 문자열 안에 값을 끼워넣을 때
Value: !Sub '${ProjectName}-vpc' # → "my-vpc"
```

| 함수                        | 용도                             | 예시 결과     |
| --------------------------- | -------------------------------- | ------------- |
| `!Ref VpcCidr`              | 파라미터/리소스 값을 그대로 사용 | `10.0.0.0/16` |
| `!Sub '${ProjectName}-vpc'` | 문자열 조합                      | `my-vpc`      |

---

### Outputs (출력)

스택 생성 후 결과값을 외부에 노출합니다. 콘솔의 Outputs 탭에서 확인할 수 있습니다.

```yaml
Outputs:
  VPCId:
    Description: VPC ID # 설명
    Value: !Ref VPC # 출력할 값
    Export: # 다른 스택에서 참조 가능하게 내보내기
      Name: !Sub '${AWS::StackName}-VPCId'
```

| 속성          | 설명                                                   |
| ------------- | ------------------------------------------------------ |
| `Description` | 출력값 설명 (콘솔에 표시)                              |
| `Value`       | 실제 출력할 값                                         |
| `Export.Name` | 다른 스택에서 `!ImportValue`로 참조할 때 사용하는 이름 |

**Export의 활용:**  
이 스택의 VPC ID를 다른 스택에서 사용하고 싶을 때:

```yaml
# 다른 스택에서 참조
VpcId: !ImportValue 'ec2-lab-prereq-VPCId'
```

---

### DependsOn (의존 관계)

특정 리소스가 먼저 생성된 후에 이 리소스를 생성하도록 순서를 지정합니다.

```yaml
PublicRoute:
  Type: AWS::EC2::Route
  DependsOn: AttachGateway # IGW가 VPC에 연결된 후에 라우트 생성
  Properties:
    RouteTableId: !Ref PublicRouteTable
    DestinationCidrBlock: 0.0.0.0/0
    GatewayId: !Ref InternetGateway
```

> CloudFormation은 `!Ref`나 `!GetAtt`로 참조된 리소스의 의존 관계는 자동으로 파악합니다.  
> `DependsOn`은 명시적 참조가 없지만 순서가 필요한 경우에 사용합니다.  
> 예: IGW를 VPC에 연결(`AttachGateway`)한 후에야 IGW를 대상으로 하는 라우트를 생성할 수 있습니다.

---

### 이 템플릿의 리소스 의존 관계

```
Parameters (ProjectName, VpcCidr, ...)
    │
    ▼
VPC (!Ref VpcCidr)
    │
    ├── InternetGateway
    │       │
    │       ▼
    │   AttachGateway (!Ref VPC, !Ref InternetGateway)
    │       │
    │       ▼
    │   PublicRoute (DependsOn: AttachGateway)
    │
    ├── PublicSubnetA (!Ref VPC, !Ref PublicSubnetACidr)
    ├── PublicSubnetC (!Ref VPC, !Ref PublicSubnetCCidr)
    ├── PrivateSubnetA (!Ref VPC, !Ref PrivateSubnetACidr)
    ├── PrivateSubnetC (!Ref VPC, !Ref PrivateSubnetCCidr)
    │
    ├── PublicRouteTable (!Ref VPC)
    │       ├── PublicSubnetARouteTableAssociation
    │       └── PublicSubnetCRouteTableAssociation
    │
    ├── PrivateRouteTableA (!Ref VPC)
    │       └── PrivateSubnetARouteTableAssociation
    │
    ├── PrivateRouteTableC (!Ref VPC)
    │       └── PrivateSubnetCRouteTableAssociation
    │
    ├── EC2SecurityGroup (!Ref VPC)
    │       │
    │       ▼
    └── RDSSecurityGroup (!Ref VPC, !Ref EC2SecurityGroup)
```

> `!Ref`로 참조하면 CloudFormation이 자동으로 "참조 대상을 먼저 생성"합니다.  
> 예: `RDSSecurityGroup`이 `!Ref EC2SecurityGroup`을 사용하므로, EC2 SG가 먼저 생성됩니다.

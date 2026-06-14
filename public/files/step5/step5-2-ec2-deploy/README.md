# Step 5-2: EC2 배포용 CloudFormation 템플릿

## 개요

이 폴더에는 Spring S3 앱을 배포할 EC2 인스턴스를 자동으로 생성하는 CloudFormation 템플릿이 두 종류 있습니다.  
본인의 AWS 환경에 맞는 버전을 선택하세요.

| 파일 | 대상 | 설명 |
| ---- | ---- | ---- |
| `step5-2-ec2.yaml` | 기존 VPC가 있는 경우 | EC2 + Security Group만 생성. 기존 VPC/Subnet을 파라미터로 선택 |
| `step5-2-ec2-with-vpc.yaml` | VPC가 없는 경우 (또는 새로 만들고 싶은 경우) | VPC + Public Subnet + IGW + Route Table + Security Group + EC2 올인원 생성 |

---

## 어떤 파일을 사용해야 하나요?

| 상황 | 사용할 파일 |
| ---- | ----------- |
| 이전 실습(Step 3 등)에서 VPC를 이미 생성함 | `step5-2-ec2.yaml` |
| 기본 VPC(Default VPC)를 사용하고 싶음 | `step5-2-ec2.yaml` |
| VPC를 만든 적 없거나, 깨끗한 환경에서 시작하고 싶음 | `step5-2-ec2-with-vpc.yaml` |
| 기존 VPC를 건드리지 않고 별도 네트워크에서 실습하고 싶음 | `step5-2-ec2-with-vpc.yaml` |

---

## 파일별 상세

### `step5-2-ec2.yaml` — 기존 VPC 사용 버전

#### 생성되는 리소스

| 리소스 | 이름 (기본값) | 설명 |
| ------ | ------------- | ---- |
| EC2 Instance | `s3-app-ec2` | Amazon Linux 2023, Java 17 사전 설치 |
| Security Group | `s3-app-sg` | SSH(22) + 8080 포트 허용 |

#### 파라미터

| 파라미터 | 기본값 | 설명 |
| -------- | ------ | ---- |
| `KeyPairName` | (필수 입력) | SSH 접속에 사용할 키 페어 이름 |
| `InstanceType` | `t3.micro` | EC2 인스턴스 타입 |
| `LatestAmiId` | (자동 resolve) | Amazon Linux 2023 최신 AMI. 변경 불필요 |
| `VpcId` | (필수 선택) | EC2가 속할 VPC |
| `SubnetId` | (필수 선택) | EC2가 배치될 **Public Subnet** |
| `SSHAccessCidr` | `0.0.0.0/0` | SSH 허용 IP 범위. 본인 IP/32로 제한 권장 |
| `ProjectName` | `s3-app` | 리소스 이름 접두사 |
| `CreatedByTag` | `cloudformation` | CreatedBy 태그 값 |
| `StepTag` | `step5` | Step 태그 값 |
| `SessionTag` | `5-2` | Session 태그 값 |

---

### `step5-2-ec2-with-vpc.yaml` — VPC 포함 올인원 버전

#### 생성되는 리소스

| 리소스 | 이름 (기본값) | 설명 |
| ------ | ------------- | ---- |
| VPC | `s3-app-vpc` | 10.0.0.0/16 (기본) |
| Internet Gateway | `s3-app-igw` | 인터넷 접근용 |
| Public Subnet | `s3-app-public-subnet` | 10.0.1.0/24, Public IP 자동 할당 |
| Route Table | `s3-app-public-rt` | 0.0.0.0/0 → IGW |
| Security Group | `s3-app-sg` | SSH(22) + 8080 포트 허용 |
| EC2 Instance | `s3-app-ec2` | Amazon Linux 2023, Java 17 사전 설치 |

#### 파라미터

| 파라미터 | 기본값 | 설명 |
| -------- | ------ | ---- |
| `KeyPairName` | (필수 입력) | SSH 접속에 사용할 키 페어 이름 |
| `InstanceType` | `t3.micro` | EC2 인스턴스 타입 |
| `LatestAmiId` | (자동 resolve) | Amazon Linux 2023 최신 AMI. 변경 불필요 |
| `VpcCidr` | `10.0.0.0/16` | VPC CIDR 블록. 기본값 유지 권장 |
| `SubnetCidr` | `10.0.1.0/24` | Public Subnet CIDR 블록. 기본값 유지 권장 |
| `SSHAccessCidr` | `0.0.0.0/0` | SSH 허용 IP 범위. 본인 IP/32로 제한 권장 |
| `ProjectName` | `s3-app` | 리소스 이름 접두사 |
| `CreatedByTag` | `cloudformation` | CreatedBy 태그 값 |
| `StepTag` | `step5` | Step 태그 값 |
| `SessionTag` | `5-2` | Session 태그 값 |

> VPC/Subnet을 선택할 필요가 없으므로 네트워크 파라미터가 CIDR 입력으로 대체됩니다.

---

## 공통 사항

### 템플릿 구조 (주요 코드 설명)

두 yaml 파일 모두 동일한 구조를 따릅니다:

```
┌─ Metadata        → 콘솔에서 파라미터를 그룹별로 정리해서 보여주는 설정
├─ Parameters      → 스택 생성 시 사용자가 입력하는 값 (키페어, 인스턴스 타입, 태그 등)
├─ Resources       → 실제 생성되는 AWS 리소스 정의
└─ Outputs         → 스택 생성 후 확인할 수 있는 값 (Public IP, SSH 명령어 등)
```

#### UserData (EC2 부트스트랩 스크립트)

EC2가 생성되면서 자동으로 실행되는 쉘 스크립트입니다:

```yaml
UserData:
  Fn::Base64: !Sub |
    #!/bin/bash
    set -e
    dnf update -y                                    # 시스템 패키지 업데이트
    dnf install -y java-17-amazon-corretto-devel     # Java 17 설치
    aws --version                                    # AWS CLI 확인
    mkdir -p /opt/app                                # 앱 배포 디렉토리 생성
    chown ec2-user:ec2-user /opt/app                 # ec2-user 소유로 변경
    echo "UserData setup completed at $(date)" > /opt/app/setup.log
```

- `Fn::Base64`: UserData는 Base64 인코딩 필수 (CloudFormation이 자동 처리)
- `set -e`: 스크립트 중 에러 발생 시 즉시 중단
- `/opt/app`: SCP로 JAR/WAR를 전송할 목적지

#### VPC 네트워크 구성 흐름 (`step5-2-ec2-with-vpc.yaml` 전용)

```
Internet
   │
   ▼
┌─────────────────────────────┐
│ Internet Gateway (IGW)      │
└─────────────┬───────────────┘
              │ VPCGatewayAttachment (IGW ↔ VPC 연결)
              ▼
┌─────────────────────────────┐
│ VPC (10.0.0.0/16)           │
│                             │
│  ┌────────────────────────┐ │
│  │ Public Subnet          │ │
│  │ (10.0.1.0/24)          │ │
│  │ MapPublicIpOnLaunch:   │ │
│  │   true                 │ │
│  │                        │ │
│  │  ┌──────────────────┐  │ │
│  │  │ EC2 Instance     │  │ │
│  │  │ (SecurityGroup   │  │ │
│  │  │  22, 8080 허용)  │  │ │
│  │  └──────────────────┘  │ │
│  └────────────────────────┘ │
│                             │
│  Route Table:               │
│    0.0.0.0/0 → IGW         │
└─────────────────────────────┘
```

핵심 포인트:
- **MapPublicIpOnLaunch: true** → Subnet에 생성되는 EC2에 Public IP 자동 할당
- **Route Table의 0.0.0.0/0 → IGW** → 인터넷 아웃바운드 트래픽을 IGW로 전달
- **SubnetRouteTableAssociation** → Public Subnet에 Route Table 연결 (이게 없으면 기본 Route Table 사용)

#### Security Group 정의

```yaml
SecurityGroupIngress:
  - IpProtocol: tcp
    FromPort: 22
    ToPort: 22
    CidrIp: !Ref SSHAccessCidr    # SSH 접속 (파라미터로 제한 가능)
  - IpProtocol: tcp
    FromPort: 8080
    ToPort: 8080
    CidrIp: 0.0.0.0/0             # Spring Boot 앱 (모든 IP 허용)
```

- Outbound는 명시하지 않음 → AWS 기본값으로 모든 아웃바운드 허용
- `SSHAccessCidr`를 본인 IP/32로 변경하면 SSH 보안 강화

#### 태그 파라미터화

모든 리소스에 공통 태그 3개가 파라미터로 적용됩니다:

```yaml
Tags:
  - Key: Name
    Value: !Sub '${ProjectName}-ec2'    # ProjectName 파라미터 참조
  - Key: CreatedBy
    Value: !Ref CreatedByTag            # 기본값: cloudformation
  - Key: Step
    Value: !Ref StepTag                 # 기본값: step5
  - Key: Session
    Value: !Ref SessionTag              # 기본값: 5-2
```

기본값 그대로 두면 되지만, 다른 실습에서 재사용하거나 비용 추적 시 값을 변경할 수 있습니다.

---

### UserData로 자동 설치되는 항목

| 항목 | 설명 |
| ---- | ---- |
| Amazon Corretto 17 | Java 17 (Spring Boot 실행에 필요) |
| AWS CLI v2 | Amazon Linux 2023에 기본 포함, 버전 확인 |
| `/opt/app` 디렉토리 | 앱 배포 경로 (ec2-user 소유) |

설치 완료 확인: SSH 접속 후 `cat /opt/app/setup.log`

### Security Group 규칙 (두 버전 동일)

| 방향 | 포트 | 프로토콜 | Source | 설명 |
| ---- | ---- | -------- | ------ | ---- |
| Inbound | 22 | TCP | `SSHAccessCidr` (기본: 0.0.0.0/0) | SSH 접속 |
| Inbound | 8080 | TCP | 0.0.0.0/0 | Spring Boot 앱 접근 |
| Outbound | All | All | 0.0.0.0/0 | 모든 아웃바운드 허용 (기본) |

> ⚠️ `SSHAccessCidr`의 기본값이 `0.0.0.0/0`(모든 IP)입니다.  
> 보안을 위해 본인 IP로 제한하세요. 공인 IP 확인: [ifconfig.me](https://ifconfig.me)

### Outputs (두 버전 동일)

| Output Key | 설명 | 예시 |
| ---------- | ---- | ---- |
| `PublicIP` | EC2 Public IP (SSH, API 접근용) | `3.35.xxx.xxx` |
| `PublicDNS` | EC2 Public DNS | `ec2-3-35-xxx-xxx.ap-northeast-2.compute.amazonaws.com` |
| `SSHCommand` | SSH 접속 명령어 | `ssh -i my-keypair.pem ec2-user@3.35.xxx.xxx` |
| `AppURL` | 앱 접근 URL | `http://3.35.xxx.xxx:8080` |
| `SecurityGroupId` | Security Group ID | `sg-0abc...` |

> `step5-2-ec2-with-vpc.yaml`은 추가로 `VpcId`, `SubnetId`도 출력합니다.

---

## 사용 방법

### CloudFormation 콘솔에서 스택 생성

1. AWS Management Console → CloudFormation 서비스로 이동
2. [[Create stack]] → **With new resources (standard)** 선택
3. **Upload a template file** → 본인에게 맞는 yaml 파일 업로드
4. [[Next]] 클릭
5. **Stack name**: `s3-app-ec2` 입력
6. **Parameters** 설정 (파일에 따라 다름 — 위 파라미터 표 참조)
7. [[Next]] → [[Next]] → [[Submit]] 클릭
8. 스택 상태가 `CREATE_COMPLETE`가 될 때까지 대기 (약 2~3분)

### SSH 접속 및 배포

```bash
# SSH 접속
ssh -i ~/Downloads/my-keypair.pem ec2-user@{PublicIP}

# Java 설치 확인
java -version

# 로컬에서 JAR 전송 (별도 터미널)
scp -i ~/Downloads/my-keypair.pem build/libs/app.jar ec2-user@{PublicIP}:/opt/app/app.jar

# 앱 실행
nohup java -jar /opt/app/app.jar --server.port=8080 > /opt/app/app.log 2>&1 &
```

---

## 주의사항

- **`step5-2-ec2.yaml` 사용 시**: SubnetId에 반드시 **Public Subnet**을 선택하세요. Private Subnet을 선택하면 외부에서 접근할 수 없습니다.
- **`step5-2-ec2-with-vpc.yaml` 사용 시**: VPC/Subnet이 자동 생성되므로 별도 선택 불필요. CIDR 기본값을 유지하면 됩니다.
- **키 페어 준비**: 스택 생성 전에 EC2 → Key Pairs에서 키 페어를 미리 생성해야 합니다.
- **IAM Role 미포함**: 두 템플릿 모두 IAM Role이 포함되어 있지 않습니다. S3 접근을 위한 IAM Role은 실습 중 수동으로 생성하여 연결합니다 (태스크 8).
- **비용**: t3.micro 기준 ~$0.013/시간 (~$9.4/월). 실습 후 반드시 스택을 삭제하세요.

---

## 삭제 방법

```
CloudFormation 콘솔 → Stacks → s3-app-ec2 선택 → Delete → Delete stack
```

- `step5-2-ec2.yaml`: EC2 + Security Group이 삭제됩니다.
- `step5-2-ec2-with-vpc.yaml`: VPC + Subnet + IGW + Route Table + EC2 + Security Group이 모두 삭제됩니다.

> ⚠️ EC2에 IAM Role이 연결된 상태에서도 스택 삭제는 가능하지만,  
> IAM Role 자체는 별도로 삭제해야 합니다 (이 템플릿에 포함되지 않은 리소스이므로).

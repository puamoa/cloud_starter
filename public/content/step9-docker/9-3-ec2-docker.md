---
title: 'EC2 docker-compose 배포 (운영용)'
week: 9
session: 3
awsServices:
  - Amazon EC2
  - Amazon RDS
  - Amazon ECR
  - Amazon VPC
learningObjectives:
  - CloudFormation으로 EC2 + RDS + NAT 인프라를 한번에 구축할 수 있습니다.
  - EC2에서 docker-compose로 프론트+백엔드를 실행할 수 있습니다.
  - 로컬 MySQL 컨테이너 대신 Amazon RDS에 연결하여 DB를 분리할 수 있습니다.
  - 환경변수를 분리하여 같은 이미지를 다른 환경에서 실행할 수 있습니다.
prerequisites:
  - Step 9-2 완료 (ECR에 이미지 Push 완료)
  - AWS CLI 설정 완료
  - 키페어 준비
estimatedCost: 크레딧 내 사용 가능 (EC2 t3.small + RDS db.t3.micro)
---

9-2에서 Fargate로 체험한 것과 **동일한 이미지**를 EC2에서 docker-compose로 실행합니다.  
Fargate보다 비용이 절감되며, 소규모 서비스 운영에 적합한 방식입니다.

> [!CONCEPT] Fargate vs EC2 Docker — 같은 이미지, 다른 실행 환경
> 9-2에서 ECR에 Push한 이미지를 그대로 사용합니다.  
> 달라지는 것은 "어디서 실행하느냐"뿐입니다.
>
> - 9-2: Fargate가 컨테이너를 실행 (서버 관리 없음, 비용 높음)
> - 9-3: EC2에서 직접 docker-compose로 실행 (서버 관리, 비용 낮음)

### 실습 흐름

```
[CloudFormation 인프라 배포 (NAT 포함)] → [EC2 접속] → [ECR 로그인 + Pull]
    → [docker-compose.yml 작성] → [실행 + RDS 연결 확인] → [브라우저 동작 확인]
```

### 아키텍처

```
         Internet
            │
        ┌───┴───┐
        │  EC2  │ (Public Subnet, t3.small)
        │       │
        │ docker-compose:
        │ ┌──────┐ ┌──────┐
        │ │Nginx │►│ App  │
        │ │ :80  │ │:8080 │
        │ └──────┘ └──┬───┘
        └─────────────┼────┘
                      │
         ┌────────────┼─── Private Subnet ───┐
         │            ▼                       │
         │      ┌──────────┐                 │
         │      │   RDS    │                 │
         │      │ (MySQL)  │                 │
         │      └──────────┘                 │
         └────────────────────────────────────┘
```

---

## 태스크 1: CloudFormation으로 인프라 배포

📍 **실행 위치: AWS 콘솔 (CloudFormation)**

이번 스택에는 **NAT Gateway가 포함**됩니다 (EC2가 ECR에서 이미지 Pull 시 필요).

> [!NOTE]
> 9-2와 다른 점:
>
> - 9-2: NAT 없음, VPC Endpoint로 S3 접근
> - 9-3: NAT 있음, 인터넷을 통해 ECR/S3 접근
>
> 두 방식을 비교 체험하기 위해 의도적으로 다르게 구성합니다.

TODO: CloudFormation 스택 배포 (VPC + NAT + RDS + EC2 + IAM Role + ECR + S3)

### EC2 User Data (자동 설치)

스택의 EC2 인스턴스는 User Data로 다음을 자동 설치합니다:

- Docker + docker-compose
- AWS CLI (Amazon Linux에 기본 포함)
- mysql 클라이언트
- S3에서 init.sql 다운로드 → RDS import

✅ **태스크 완료** — 인프라가 생성되고, EC2에 Docker가 설치되었습니다.

---

## 태스크 2: EC2 접속 + ECR 이미지 Pull

📍 **실행 위치: 로컬 PC → EC2 (SSH 또는 SSM)**

TODO: EC2 접속, ECR 인증, docker pull (frontend + backend 이미지)

✅ **태스크 완료** — EC2에 이미지를 다운로드했습니다.

---

## 태스크 3: docker-compose.yml 작성 (AWS 버전)

📍 **실행 위치: EC2**

로컬 버전과의 차이:

- MySQL 컨테이너 제거 (RDS 사용)
- `DB_HOST`를 RDS endpoint로 변경
- 이미지를 `build:` 대신 `image:` (ECR URI)로 지정

TODO: EC2에서 docker-compose.yml 작성 (.env에 RDS 정보 포함)

> [!CONCEPT] 로컬 → AWS 전환 시 바꾸는 것
> | 항목 | 로컬 (9-1) | AWS (9-3) |
> |------|-----------|-----------|
> | DB | MySQL 컨테이너 (`db:3306`) | RDS (`xxx.rds.amazonaws.com:3306`) |
> | 이미지 | `build: ./backend` | `image: <ECR_URI>:latest` |
> | Nginx 프록시 | `BACKEND_HOST=backend` | `BACKEND_HOST=backend` (동일) |
>
> docker-compose.yml 구조는 거의 동일하고, DB 부분만 빠집니다.

✅ **태스크 완료** — AWS 환경용 docker-compose.yml을 작성했습니다.

---

## 태스크 4: 서비스 실행 + 동작 확인

📍 **실행 위치: EC2 + 로컬 PC (브라우저)**

TODO: docker-compose up, 동작 확인, RDS 데이터 확인

> [!TIP]
> EC2 Public IP:80으로 접속하여 동작을 확인합니다.  
> Security Group에서 Inbound 80 포트가 열려있는지 확인하세요.

✅ **태스크 완료** — EC2에서 Docker 컨테이너가 실행되고 RDS에 정상 연결됩니다.

---

## 태스크 5: DB 분리의 의미 체험 (선택)

📍 **실행 위치: EC2**

> [!CONCEPT] 왜 DB를 컨테이너에서 뺐는지 직접 체험
> docker-compose를 재시작해도 RDS의 데이터는 유지됩니다.  
> 만약 MySQL 컨테이너였다면? Volume 없이 재시작하면 데이터가 사라집니다.

TODO:

- docker-compose down + up → RDS 데이터 유지 확인
- (선택) 로컬에서 docker-compose down -v → MySQL 데이터 사라짐 체험

✅ **태스크 완료** — DB를 매니지드 서비스(RDS)로 분리하는 이유를 체험했습니다.

---

## 마무리

### 이번 세션에서 배운 것

- CloudFormation으로 NAT 포함 인프라 한번에 구축
- EC2에서 ECR 이미지 Pull + docker-compose 실행
- MySQL 컨테이너 → RDS로 전환 (환경변수만 변경)
- "같은 이미지, 다른 환경" 패턴 실습

### 현재 구성 비용 (참고)

| 리소스            | 시간당  | 월 예상 (24h) |
| ----------------- | ------- | ------------- |
| EC2 (t3.small)    | ~$0.026 | ~$19          |
| RDS (db.t3.micro) | ~$0.02  | ~$14          |
| NAT Gateway       | ~$0.059 | ~$42          |
| 합계              |         | ~$75          |

> [!WARNING]
> NAT Gateway가 가장 비싼 리소스입니다.  
> 실습이 끝나면 9-6에서 전체 리소스를 삭제하세요.  
> 또는 NAT만 먼저 삭제하고 EC2를 Public Subnet에서 운영하는 것도 가능합니다.

### 다음 단계

**9-4: GitHub Actions → ECR → EC2 자동 배포**에서 코드 Push만으로 이미지 빌드 → ECR → EC2 배포가 자동으로 이루어지는 파이프라인을 구축합니다.

> [!NOTE]
> 9-4를 진행하지 않고 바로 정리하려면 → [9-6: 리소스 정리](/week/9/session/6)로 이동하세요.

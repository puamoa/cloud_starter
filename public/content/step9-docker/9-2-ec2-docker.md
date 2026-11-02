---
title: 'ECR Push + EC2 docker-compose 배포'
week: 9
session: 2
awsServices:
  - Amazon ECR
  - Amazon EC2
  - Amazon RDS
  - Amazon VPC
  - Amazon S3
learningObjectives:
  - AWS CloudFormation으로 VPC, Amazon EC2, Amazon RDS, Amazon ECR 인프라를 한 번에 구축할 수 있습니다.
  - Amazon VPC Endpoint(S3 Gateway)를 콘솔에서 직접 생성하고 라우팅 테이블 동작을 확인할 수 있습니다.
  - 로컬에서 빌드한 Docker 이미지를 Amazon ECR에 Push할 수 있습니다.
  - Amazon EC2에서 ECR 이미지를 Pull하고 docker-compose로 실행하여 Amazon RDS와 연결할 수 있습니다.
  - 로컬 MySQL 컨테이너 대신 매니지드 DB(Amazon RDS)로 분리하는 이유를 체감할 수 있습니다.
prerequisites:
  - Step 9-1 완료 (로컬에서 Docker 이미지 빌드 및 docker-compose 동작 확인)
  - AWS CLI 설정 완료
  - 키페어 준비
estimatedCost: 크레딧 내 사용 가능 (Amazon EC2 t3.small + Amazon RDS db.t3.micro)
---

9-1에서 로컬 `docker-compose`로 실행했던 프론트엔드·백엔드 이미지를 **Amazon ECR**에 업로드하고,  
**Amazon EC2**에서 동일한 `docker-compose` 방식으로 실행하여 **Amazon RDS(MySQL)**에 연결합니다.

> [!CONCEPT] 로컬 docker-compose → AWS EC2 docker-compose 전환
> 9-1에서 만든 로컬 환경과 이번 9-2의 AWS 환경은 구조가 거의 같습니다.  
> 달라지는 것은 **단 두 가지**뿐입니다:
>
> - **이미지**: 로컬에서 직접 빌드(`build:`)하는 대신, **Amazon ECR에 올린 이미지(`image:`)를 Pull**하여 실행합니다.
> - **데이터베이스**: 로컬 MySQL 컨테이너(`db`)를 빼고, **Amazon RDS(`myapp`)**에 연결합니다 (`DB_ENDPOINT` 환경변수만 변경).

### Step 9 전체 구성

| 세션                | 주제                                      | 핵심                                               |
| ------------------- | ----------------------------------------- | -------------------------------------------------- |
| 9-0                 | Docker + 컨테이너 이론                    | Docker, Compose, ECR, ECS/Fargate, 멀티/모노레포   |
| 9-1                 | Dockerfile + docker-compose (로컬)        | 프론트(Nginx) + 백엔드(Spring) + MySQL 로컬 실행   |
| **9-2 (이번 실습)** | **ECR Push + EC2 docker-compose 배포**    | **CFn 인프라 구축, ECR Push, EC2 + RDS 운영 배포** |
| 9-3                 | AWS Fargate 서버리스 컨테이너 체험        | 같은 이미지·RDS로 Fargate 사이드카 체험 → 삭제     |
| 9-4                 | GitHub Actions → ECR → EC2 자동 배포      | Docker CI/CD 파이프라인                            |
| 9-5                 | (선택) CloudFront + Fargate 프로덕션 구성 | S3+CloudFront 프론트 + Fargate+ALB 백엔드          |
| 9-6                 | 리소스 정리                               | 전체 리소스 삭제                                   |

### 실습 흐름

```
[CloudFormation 인프라 배포] → [VPC Endpoint(S3) 수동 생성] → [ECR 이미지 Push]
    → [EC2 접속 + 이미지 Pull] → [운영용 docker-compose.yml 실행] → [동작 및 RDS 영속성 확인]
```

### 아키텍처

```
┌─────────────────────────── AWS (VPC) ───────────────────────────┐
│                                                                 │
│  ┌─── Public Subnet ─────────────────────────────────────────┐  │
│  │                                                           │  │
│  │  ┌─────────────── Amazon EC2 (t3.small) ───────────────┐  │  │
│  │  │  docker-compose:                                    │  │  │
│  │  │  ┌──────────────┐          ┌──────────────────┐     │  │  │
│  │  │  │   frontend   │── :80 ──►│     backend      │     │  │  │
│  │  │  │ (Nginx+Vue)  │          │  (Spring :8080)  │     │  │  │
│  │  │  └──────────────┘          └────────┬─────────┘     │  │  │
│  │  └─────────────────────────────────────┼───────────────┘  │  │
│  └────────────────────────────────────────┼──────────────────┘  │
│                                           │                     │
│  ┌─── Private Subnet ─────────────────────┼──────────────────┐  │
│  │                                        ▼                  │  │
│  │                                 ┌──────────────┐          │  │
│  │                                 │  Amazon RDS  │          │  │
│  │                                 │   (MySQL)    │          │  │
│  │                                 └──────────────┘          │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Amazon ECR (frontend / backend 이미지)                         │
│  VPC Endpoint (S3 Gateway) ← 콘솔에서 수동 생성 (무료)          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 태스크 1: CloudFormation으로 통합 인프라 배포

📍 **실행 위치: AWS 콘솔 (CloudFormation)**

하나의 CloudFormation 스택으로 Step 9 전체(`9-2` ~ `9-5`)에서 사용할 기반 인프라를 구축합니다:

- **Amazon VPC** (`10.0.0.0/16`) + Public/Private Subnets (2AZ) + Internet Gateway
- **Security Groups** (`EC2-SG`, `ECS-SG`, `RDS-SG`)
- **Amazon RDS MySQL** (`db.t3.micro`, Private Subnet, 초기 DB명 `myapp`)
- **Amazon EC2** (`t3.small`, Public Subnet — Docker, docker-compose, mysql 클라이언트 자동 설치 및 초기 SQL 자동 import)
- **Amazon ECR 리포지토리** (`step9-frontend`, `step9-backend`)
- **Amazon S3 버킷** 및 **IAM Role** (EC2 Role, ECS Task Execution Role)

> [!NOTE]
> **비용 절감 설계 (NAT Gateway 제외):**  
> 시간당 ~$0.059(월 ~$42)가 과금되는 NAT Gateway를 사용하지 않습니다.  
> Amazon EC2는 Public Subnet에 배치하여 Internet Gateway로 통신하고, S3 접근은 무료인 **S3 Gateway Endpoint**(태스크 2)를 직접 생성하여 학습합니다.

TODO: CloudFormation 템플릿 다운로드 블록(`[step9-infra.zip]`), 스택 생성 콘솔 단계, Outputs 확인 안내 작성

✅ **태스크 완료** — VPC, Amazon EC2, Amazon RDS(초기 데이터 포함), Amazon ECR 리포지토리가 생성되었습니다.

---

## 태스크 2: VPC Endpoint 수동 생성 (S3 Gateway)

📍 **실행 위치: AWS 콘솔 (Amazon VPC)**

VPC 내부에서 인터넷을 거치지 않고 Amazon S3에 안전하고 무료로 접근할 수 있도록 **S3 Gateway Endpoint**를 콘솔에서 직접 생성합니다.

> [!CONCEPT] VPC Endpoint를 직접 만들어보기
> CloudFormation으로 자동 생성할 수도 있지만, 이번에는 **콘솔에서 직접** 생성하여 동작 원리를 이해합니다.  
> Gateway Endpoint를 생성하면 Route Table에 S3 경로(`pl-xxxxxx`)가 자동으로 추가되는 것을 직접 확인할 수 있습니다.

TODO: Amazon VPC 콘솔 → Endpoints → Create endpoint (`com.amazonaws.ap-northeast-2.s3`, Gateway 타입) → Route Table 선택 및 확인 상세 단계 작성

✅ **태스크 완료** — S3 Gateway Endpoint를 생성하고 Route Table에 경로가 추가된 것을 확인했습니다.

---

## 태스크 3: Amazon ECR 로그인 + Docker 이미지 Push

📍 **실행 위치: 로컬 PC (터미널)**

9-1에서 작성한 프론트엔드(`my-frontend`)와 백엔드(`my-backend`)를 빌드하여 Amazon ECR 리포지토리에 업로드합니다.

> [!WARNING]
> **Apple Silicon (M1/M2/M3/M4) Mac 사용자 주의사항:**  
> 맥북에서 기본 빌드한 이미지는 `linux/arm64` 아키텍처입니다.  
> 반면 AWS의 Amazon EC2(`t3.small`)와 AWS Fargate 기본 환경은 `linux/amd64`(x86_64)이므로, 반드시 **`--platform linux/amd64`** 옵션을 붙여 빌드해야 AWS에서 `exec format error` 없이 실행됩니다.

TODO: AWS CLI ECR 로그인(`aws ecr get-login-password`), `--platform linux/amd64` 빌드, `docker tag`, `docker push` 상세 단계 작성

✅ **태스크 완료** — 프론트엔드와 백엔드 Docker 이미지를 Amazon ECR에 Push했습니다.

---

## 태스크 4: Amazon EC2 접속 + 운영용 docker-compose.yml 작성

📍 **실행 위치: Amazon EC2 (SSM Session Manager 또는 SSH)**

Amazon EC2에 접속하여 Amazon ECR에서 이미지를 Pull하고, Amazon RDS에 연결하는 운영용 `.env`와 `docker-compose.yml`을 작성합니다.

> [!CONCEPT] 로컬(9-1) → AWS EC2(9-2) 전환 시 바뀌는 것
> | 항목 | 로컬 (9-1) | AWS EC2 (9-2) |
> |------|-----------|---------------|
> | **DB** | MySQL 컨테이너 (`DB_ENDPOINT=db`) | **Amazon RDS** (`DB_ENDPOINT=<RDSEndpoint>`) |
> | **이미지** | `build: ./my-backend` | **`image: <ECR_URI>/step9-backend:latest`** |
> | **Nginx 프록시** | `BACKEND_HOST=backend` | `BACKEND_HOST=backend` (동일) |
>
> `docker-compose.yml`에서 `db` 컨테이너만 제거하고 `image:`로 바꾸면 끝입니다!

TODO: EC2 접속 → ECR 로그인 → `.env` 작성 (`DB_ENDPOINT`에 RDS 엔드포인트 입력) → `docker-compose.yml` 작성 상세 단계

✅ **태스크 완료** — Amazon EC2에 운영용 `.env`와 `docker-compose.yml`을 구성했습니다.

---

## 태스크 5: 서비스 실행 + 동작 및 DB 분리 확인

📍 **실행 위치: Amazon EC2 + 로컬 PC (브라우저)**

### 5-1. 컨테이너 실행 및 브라우저 접속 확인

TODO: `docker-compose up -d`, `docker-compose ps`, 브라우저에서 `http://<EC2_PUBLIC_IP>` 접속하여 게시판·여행 목록(RDS 초기 데이터) 확인

### 5-2. DB 분리의 의미 체험 (컨테이너 재시작 테스트)

> [!CONCEPT] 왜 DB를 컨테이너에서 뺐는지 직접 체험
> `docker-compose down`으로 컨테이너를 완전히 내렸다가 다시 `up -d`로 띄워도, 데이터는 **Amazon RDS**에 저장되어 있으므로 게시글과 회원 정보가 100% 그대로 유지됩니다.

TODO: `docker-compose down && docker-compose up -d` 후 데이터 유지 확인

✅ **태스크 완료** — Amazon EC2에서 Docker 컨테이너가 실행되고 Amazon RDS와 정상 연동되는 것을 확인했습니다.

---

## 마무리

### 이번 세션에서 배운 것

- AWS CloudFormation으로 VPC + Amazon EC2 + Amazon RDS + Amazon ECR 인프라 구축
- Amazon VPC Endpoint (S3 Gateway) 콘솔 수동 생성 및 라우팅 확인
- 로컬 Docker 이미지를 Amazon ECR에 Push (`--platform linux/amd64`)
- Amazon EC2에서 ECR 이미지 Pull + `docker-compose` 실행
- MySQL 컨테이너 대신 Amazon RDS를 연결하여 환경변수(`.env`)만으로 환경 전환

### 다음 단계

**9-3: AWS Fargate 서버리스 컨테이너 체험**에서는 *"만약 Amazon EC2 서버조차 관리하기 싫다면?"*이라는 질문에 답하기 위해, **방금 ECR에 올린 이미지와 RDS를 그대로 사용해서** 서버리스 컨테이너인 **AWS Fargate**로 실행해보고 EC2 방식과 비용·특징을 비교합니다.

> [!NOTE]
> 다음 세션(9-3, 9-4)에서 지금 만든 CloudFormation 스택(Amazon EC2, Amazon RDS, Amazon ECR)을 그대로 계속 사용하므로 **삭제하지 않고 바로 9-3으로 이동**합니다.


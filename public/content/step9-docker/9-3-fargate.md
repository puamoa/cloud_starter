---
title: 'AWS Fargate 서버리스 컨테이너 체험'
week: 9
session: 3
awsServices:
  - Amazon ECS
  - AWS Fargate
  - Amazon ECR
  - Amazon RDS
learningObjectives:
  - Amazon ECS의 핵심 구조(Cluster, Task Definition, Service)를 콘솔에서 직접 생성하며 이해할 수 있습니다.
  - 9-2에서 Push한 동일한 ECR 이미지와 Amazon RDS를 사용하여 AWS Fargate에서 컨테이너를 실행할 수 있습니다.
  - Fargate 사이드카(Sidecar) 패턴으로 프론트엔드와 백엔드를 하나의 Task에서 연동(`localhost`)할 수 있습니다.
  - Amazon EC2 Docker 방식(9-2)과 AWS Fargate 방식(9-3)의 비용과 운영 차이를 비교하고, 실습 후 Fargate 리소스를 정리할 수 있습니다.
prerequisites:
  - Step 9-2 완료 (CloudFormation 인프라 배포 및 ECR 이미지 Push 완료)
estimatedCost: 크레딧 내 사용 가능 (Fargate vCPU/메모리 시간당 과금, 체험 후 이 세션 끝에서 즉시 삭제)
---

9-2에서는 Amazon EC2 서버에 접속해 `docker-compose`로 컨테이너를 실행했습니다.  
이번 세션에서는 **서버(EC2) 없이** 컨테이너만 실행하는 서버리스 방식인 **Amazon ECS + AWS Fargate**를 체험합니다.

> [!CONCEPT] 같은 이미지, 같은 DB — 실행 환경만 EC2에서 Fargate로!
> 9-2에서 이미 **Amazon ECR에 Push해 둔 프론트·백엔드 이미지**와 **초기 데이터가 들어 있는 Amazon RDS**를 그대로 사용합니다.  
> 이미지를 새로 빌드하거나 DB를 다시 세팅할 필요 없이, AWS 콘솔에서 **ECS Cluster → Task Definition → Service**만 만들면 서버 없이 컨테이너가 동작합니다.

### Step 9 전체 구성

| 세션                | 주제                                      | 핵심                                               |
| ------------------- | ----------------------------------------- | -------------------------------------------------- |
| 9-0                 | Docker + 컨테이너 이론                    | Docker, Compose, ECR, ECS/Fargate, 멀티/모노레포   |
| 9-1                 | Dockerfile + docker-compose (로컬)        | 프론트(Nginx) + 백엔드(Spring) + MySQL 로컬 실행   |
| 9-2                 | ECR Push + EC2 docker-compose 배포        | CFn 인프라 구축, ECR Push, EC2 + RDS 운영 배포     |
| **9-3 (이번 실습)** | **AWS Fargate 서버리스 컨테이너 체험**    | **같은 이미지·RDS로 Fargate 사이드카 체험 → 삭제** |
| 9-4                 | GitHub Actions → ECR → EC2 자동 배포      | Docker CI/CD 파이프라인                            |
| 9-5                 | (선택) CloudFront + Fargate 프로덕션 구성 | S3+CloudFront 프론트 + Fargate+ALB 백엔드          |
| 9-6                 | 리소스 정리                               | 전체 리소스 삭제                                   |

### 실습 흐름

```
[ECS 클러스터 생성] → [Task Definition 생성 (사이드카: FE + BE)]
    → [ECS Service 생성 (Fargate)] → [Public IP 접속 확인 (RDS 연동)] → [비용 비교 후 Fargate 즉시 삭제]
```

### 아키텍처 (9-2의 인프라에 Fargate Task 추가)

```
┌─────────────────────────── AWS (VPC) ───────────────────────────┐
│                                                                 │
│  ┌─── Public Subnet ─────────────────────────────────────────┐  │
│  │                                                           │  │
│  │  ┌────────── ECS Task (AWS Fargate) ──────────┐           │  │
│  │  │  (서버 관리 없음, 같은 Task = localhost)   │           │  │
│  │  │  ┌──────────────┐      ┌────────────────┐  │           │  │
│  │  │  │   frontend   │─:80─►│    backend     │  │           │  │
│  │  │  │ (Nginx+Vue)  │      │ (Spring :8080) │  │           │  │
│  │  │  └──────────────┘      └───────┬────────┘  │           │  │
│  │  └────────────────────────────────┼───────────┘           │  │
│  └───────────────────────────────────┼───────────────────────┘  │
│                                      │                          │
│  ┌─── Private Subnet ────────────────┼───────────────────────┐  │
│  │                                   ▼                       │  │
│  │                            ┌──────────────┐               │  │
│  │                            │  Amazon RDS  │               │  │
│  │                            │ (9-2와 동일) │               │  │
│  │                            └──────────────┘               │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 태스크 1: Amazon ECS 클러스터 생성

📍 **실행 위치: AWS 콘솔 (Amazon ECS)**

콘솔에서 하나씩 직접 생성하여 Amazon ECS의 구조를 눈으로 확인합니다.

TODO: Amazon ECS 콘솔 → Clusters → Create cluster (`step9-cluster`, AWS Fargate 전용) 상세 단계 작성

✅ **태스크 완료** — AWS Fargate 전용 ECS 클러스터를 생성했습니다.

---

## 태스크 2: Task Definition 생성 (사이드카 패턴)

📍 **실행 위치: AWS 콘솔 (Amazon ECS)**

하나의 Task 안에 프론트엔드와 백엔드 **2개의 컨테이너**를 함께 정의합니다:

- **컨테이너 1 (`frontend`)**: 9-2에서 Push한 `step9-frontend:latest` 이미지 — 포트 `80`
- **컨테이너 2 (`backend`)**: 9-2에서 Push한 `step9-backend:latest` 이미지 — 포트 `8080`

> [!TIP]
> **docker-compose(9-2) vs Fargate 사이드카(9-3) 환경변수 차이:**
>
> | 환경변수 | 9-2 (EC2 docker-compose) | 9-3 (Fargate 사이드카) | 이유 |
> |----------|--------------------------|------------------------|------|
> | `BACKEND_HOST` | `backend` (서비스명) | **`localhost`** | 같은 Task 안의 컨테이너끼리는 네트워크를 공유하므로 `localhost`로 통신 |
> | `DB_ENDPOINT` | `<RDSEndpoint>` | `<RDSEndpoint>` (동일) | 9-2와 동일한 Amazon RDS 사용 |
>
> **Docker 이미지는 단 한 줄도 수정하지 않고**, 환경변수(`BACKEND_HOST=localhost`)만 바꿔서 그대로 실행합니다!

TODO: Task Definition 생성 상세 단계 (CPU 0.5 vCPU / 메모리 1GB, Task Execution Role 선택, 컨테이너 2개 이미지 URI 및 환경변수 입력, CloudWatch Logs 설정) 작성

✅ **태스크 완료** — 프론트엔드와 백엔드를 포함한 Fargate Task Definition을 생성했습니다.

---

## 태스크 3: Amazon ECS Service 생성

📍 **실행 위치: AWS 콘솔 (Amazon ECS)**

작성한 Task Definition을 기반으로 실제 Fargate Task를 실행하고 유지하는 Service를 생성합니다.

TODO: Service 생성 상세 단계 (Launch type: Fargate, Desired tasks: 1, VPC: `step9-vpc`, Public Subnet 선택, Security Group: `ECS-SG`, Public IP: Turned on) 작성

✅ **태스크 완료** — AWS Fargate에서 프론트엔드+백엔드 컨테이너가 실행되었습니다.

---

## 태스크 4: 동작 확인 + EC2 vs Fargate 비용 비교

📍 **실행 위치: 로컬 PC (브라우저)**

### 4-1. Fargate Task Public IP로 접속 확인

TODO: 생성된 Task 클릭 → Public IP 확인 → 브라우저에서 `http://<Fargate_Public_IP>` 접속 → 9-2의 Amazon RDS 데이터가 동일하게 조회되는지 확인

### 4-2. EC2 Docker (9-2) vs AWS Fargate (9-3) 비교

| 항목            | EC2 Docker (9-2)                   | AWS Fargate (9-3, 이번 세션)       |
| --------------- | ---------------------------------- | ---------------------------------- |
| **서버 관리**   | EC2 인스턴스 및 Docker 상태 관리   | **없음 (완전 서버리스)**           |
| **배포 방식**   | SSH/SSM 접속 후 `docker-compose`   | Task Definition + ECS Service      |
| **스케일 아웃** | Auto Scaling Group 별도 구성 필요  | Desired task 숫자만 변경하면 끝    |
| **비용 구조**   | EC2 인스턴스 시간당 과금           | vCPU + 메모리 시간당 과금          |
| **적합한 경우** | 소규모 고정 트래픽, 비용 절감 우선 | 운영 인력 최소화, 트래픽 변동폭 큼 |

> [!WARNING]
> AWS Fargate는 Task가 실행 중인 시간만큼 vCPU와 메모리 비용이 계속 과금됩니다.  
> 체험이 끝났으므로 아래 태스크 5에서 **Fargate 리소스만 즉시 삭제**합니다.

✅ **태스크 완료** — AWS Fargate에서 컨테이너 동작을 확인하고 EC2 방식과 비교했습니다.

---

## 태스크 5: Fargate 리소스 즉시 삭제 (EC2/RDS 스택은 유지!)

📍 **실행 위치: AWS 콘솔 (Amazon ECS)**

> [!WARNING]
> **주의: CloudFormation 스택은 삭제하지 마세요!**  
> 다음 세션(9-4: GitHub Actions CI/CD)에서 9-2에 띄워둔 **Amazon EC2와 Amazon RDS, Amazon ECR**을 그대로 사용합니다.  
> 여기서는 이번 9-3에서 수동으로 만든 **ECS Service와 ECS Cluster만 삭제**하여 Fargate 과금을 즉시 중단합니다.

TODO: ECS Service 삭제 (Force delete) → Task 종료 확인 → ECS Cluster 삭제 → Task Definition Deregister 상세 단계 작성

✅ **태스크 완료** — AWS Fargate 리소스를 모두 삭제하여 추가 과금을 중단했습니다 (9-2의 EC2/RDS/ECR은 유지).

---

## 마무리

### 이번 세션에서 배운 것

- Amazon ECS 핵심 구조: Cluster → Task Definition → Service
- Fargate 사이드카 패턴 (`BACKEND_HOST=localhost`로 하나의 Task 내 컨테이너 통신)
- 동일한 ECR 이미지와 Amazon RDS를 EC2와 Fargate 양쪽에서 코드 수정 없이 실행
- EC2 Docker 방식과 AWS Fargate 방식의 장단점 및 비용 비교

### 다음 단계

**9-4: GitHub Actions → ECR → EC2 자동 배포**에서는 9-2에서 구축해 둔 **Amazon EC2 운영 서버**를 대상으로, 코드를 GitHub에 Push하면 자동으로 Docker 빌드 → Amazon ECR Push → Amazon EC2 컨테이너 재시작까지 이루어지는 CI/CD 파이프라인을 완성합니다.


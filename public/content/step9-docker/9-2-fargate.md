---
title: 'ECR Push + Fargate 맛보기'
week: 9
session: 2
awsServices:
  - Amazon ECR
  - Amazon ECS
  - AWS Fargate
  - Amazon RDS
  - Amazon VPC
learningObjectives:
  - Amazon ECR 리포지토리를 생성하고 Docker 이미지를 Push할 수 있습니다.
  - VPC Endpoint(S3 Gateway)를 콘솔에서 생성할 수 있습니다.
  - ECS 클러스터, Task Definition, Service를 콘솔에서 생성할 수 있습니다.
  - Fargate 사이드카 패턴으로 프론트+백엔드를 하나의 Task에서 실행할 수 있습니다.
  - Fargate 비용을 확인하고 리소스를 삭제할 수 있습니다.
prerequisites:
  - Step 9-1 완료 (로컬에서 docker-compose 동작 확인)
  - AWS CLI 설정 완료
  - 키페어 준비
estimatedCost: 크레딧 내 사용 가능 (Fargate vCPU/메모리 시간당 과금, 실습 후 즉시 삭제)
---

9-1에서 로컬에서 잘 돌아가는 이미지를 Amazon ECR에 Push하고,  
AWS Fargate에서 **서버 관리 없이** 컨테이너를 실행해봅니다.

> [!CONCEPT] 이 세션의 핵심
> "로컬에서 docker-compose로 돌리던 걸, AWS에서는 어떻게 하지?"  
> → ECR에 이미지를 올리고, ECS Fargate로 실행합니다.  
> 서버(EC2) 없이도 컨테이너가 동작합니다.

### 실습 흐름

```
[CloudFormation 인프라 배포] → [VPC Endpoint 수동 생성] → [ECR Push]
    → [ECS 클러스터/Task/Service 콘솔 생성] → [동작 확인] → [비용 확인 → 삭제]
```

### 아키텍처

```
┌────────────── AWS (VPC) ──────────────────┐
│                                            │
│  ┌─── Public Subnet ───────────────────┐  │
│  │                                      │  │
│  │  ┌────── ECS Task (Fargate) ──────┐  │  │
│  │  │  ┌──────┐      ┌──────────┐   │  │  │
│  │  │  │Nginx │─:80─►│ Backend  │   │  │  │
│  │  │  │(FE)  │      │ (Spring) │   │  │  │
│  │  │  └──────┘      └────┬─────┘   │  │  │
│  │  └──────────────────────┼─────────┘  │  │
│  └─────────────────────────┼────────────┘  │
│                             │               │
│  ┌─── Private Subnet ──────┼────────────┐  │
│  │                          ▼            │  │
│  │                    ┌──────────┐       │  │
│  │                    │   RDS    │       │  │
│  │                    │ (MySQL)  │       │  │
│  │                    └──────────┘       │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  VPC Endpoint (S3 Gateway) ← 콘솔 수동 생성 │
└─────────────────────────────────────────────┘
```

---

## 태스크 1: CloudFormation으로 인프라 배포

📍 **실행 위치: AWS 콘솔 (CloudFormation)**

CloudFormation 스택으로 VPC, RDS, Security Groups를 한번에 생성합니다.  
**NAT Gateway 없이** 구성하여 비용을 절감합니다.

> [!NOTE]
> 이 스택에는 NAT Gateway가 포함되지 않습니다.  
> Private Subnet에서 AWS 서비스(S3 등)에 접근하려면 VPC Endpoint가 필요합니다.  
> 태스크 2에서 직접 생성합니다.

TODO: CloudFormation 스택 배포 단계 상세 작성 (스택 URL, 파라미터 설명)

✅ **태스크 완료** — VPC, RDS, Security Groups가 생성되었습니다.

---

## 태스크 2: VPC Endpoint 수동 생성 (S3 Gateway)

📍 **실행 위치: AWS 콘솔 (VPC)**

NAT Gateway 없이 Private Subnet에서 S3에 접근하기 위해 S3 Gateway Endpoint를 생성합니다.

> [!CONCEPT] VPC Endpoint를 직접 만들어보기
> CloudFormation으로 자동 생성할 수도 있지만, 이번에는 **콘솔에서 직접** 생성하여 동작 원리를 이해합니다.  
> Endpoint가 Route Table에 경로를 자동으로 추가하는 것을 직접 확인합니다.

TODO: VPC Endpoint 생성 상세 단계 (콘솔 스크린샷 위치 포함)

✅ **태스크 완료** — S3 Gateway Endpoint를 생성하고 Route Table에 경로가 추가된 것을 확인했습니다.

---

## 태스크 3: ECR 리포지토리 생성 + 이미지 Push

📍 **실행 위치: 로컬 PC (터미널)**

9-1에서 빌드한 이미지를 Amazon ECR에 Push합니다.

TODO: ECR 리포 생성 (콘솔 또는 CLI), ECR 인증, docker tag, docker push 상세 단계

✅ **태스크 완료** — 프론트엔드/백엔드 이미지를 ECR에 Push했습니다.

---

## 태스크 4: ECS 클러스터 + Task Definition + Service 생성

📍 **실행 위치: AWS 콘솔 (ECS)**

콘솔에서 하나씩 직접 생성하여 ECS 구조를 이해합니다.

> [!NOTE]
> 이 태스크에서는 의도적으로 **콘솔에서 수동으로** 생성합니다.  
> CloudFormation이나 CLI로 자동화하기 전에, 각 리소스가 어떤 역할인지 직접 눈으로 확인합니다.

### 4-1. ECS 클러스터 생성

TODO: Fargate 전용 클러스터 생성 단계

### 4-2. Task Definition 생성 (사이드카 패턴)

하나의 Task에 2개의 컨테이너를 정의합니다:

- 컨테이너 1: Frontend (Nginx + Vue.js) — 포트 80
- 컨테이너 2: Backend (Spring) — 포트 8080

> [!TIP]
> 사이드카 패턴에서 Nginx의 `BACKEND_HOST`는 `localhost`로 설정합니다.  
> 같은 Task 안의 컨테이너끼리는 localhost로 통신합니다.

TODO: Task Definition 생성 상세 (CPU/메모리, 환경변수, 로그 설정)

### 4-3. Service 생성

TODO: Service 생성 (desired count: 1, Public Subnet, Public IP 할당)

✅ **태스크 완료** — ECS Fargate에서 프론트+백엔드가 사이드카로 실행됩니다.

---

## 태스크 5: 동작 확인 + 비용 확인

📍 **실행 위치: 로컬 PC (브라우저)**

### 5-1. 접속 확인

TODO: Task의 Public IP로 접속, 프론트/API 동작 확인

### 5-2. 비용 확인

> [!WARNING]
> Fargate는 실행 중인 시간만큼 과금됩니다.
>
> - vCPU: ~$0.04/hr (0.25 vCPU 기준)
> - 메모리: ~$0.004/hr (0.5GB 기준)
>
> 실습이 끝나면 **즉시 삭제**하세요!

✅ **태스크 완료** — Fargate에서 컨테이너가 동작하는 것을 확인했습니다.

---

## 태스크 6: 리소스 삭제 (Fargate 즉시 정리)

📍 **실행 위치: AWS 콘솔**

> [!WARNING]
> Fargate 과금을 즉시 중단하려면 ECS Service → Task를 삭제해야 합니다.  
> CloudFormation 스택도 함께 삭제합니다.

### 삭제 순서

TODO: ECS Service 삭제 → Task Definition 비활성화 → Cluster 삭제 → CloudFormation 스택 삭제 → VPC Endpoint 삭제 상세 단계

> [!NOTE]
> 9-3에서 EC2 기반으로 다시 배포하므로, 이 세션의 모든 리소스를 삭제합니다.  
> 9-3은 별도의 CloudFormation 스택을 사용합니다.

✅ **태스크 완료** — Fargate 리소스를 모두 삭제하고 비용 발생을 중단했습니다.

---

## 마무리

### 이번 세션에서 배운 것

- Amazon ECR에 Docker 이미지 Push
- VPC Endpoint(S3 Gateway) 콘솔에서 직접 생성
- ECS 구조: Cluster → Task Definition → Service
- Fargate 사이드카 패턴 (Nginx + Backend in one Task)
- Fargate 비용 구조와 즉시 정리의 중요성

### Fargate vs EC2 Docker — 왜 9-3에서 EC2를 선택하나?

| 항목         | Fargate (이번 세션)                | EC2 Docker (9-3)                |
| ------------ | ---------------------------------- | ------------------------------- |
| 서버 관리    | 없음                               | Docker만 관리                   |
| 비용         | vCPU+메모리 시간당 과금            | EC2 인스턴스 비용만             |
| 월 비용 예상 | ~$15~30/월 (최소 사양 24시간)      | ~$9~19/월 (t3.small 24시간)     |
| 적합         | 트래픽 변동 큰 서비스, 관리 최소화 | 소규모 고정 서비스, 비용 최적화 |

> [!CONCEPT] 비용 절감을 위한 EC2 Docker 선택
> Fargate가 편하지만, 소규모 서비스에서 24시간 돌리면 EC2보다 비쌉니다.  
> 다음 세션(9-3)에서는 같은 이미지를 EC2에서 docker-compose로 실행하여 비용을 절감합니다.
> **이미지는 동일, 실행 환경만 다릅니다.**

### 다음 단계

**9-3: EC2 docker-compose 배포**에서 동일한 이미지를 EC2에서 실행하고, RDS에 연결합니다.

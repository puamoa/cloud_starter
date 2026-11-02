---
title: 'GitHub Actions → ECR → EC2 자동 배포'
week: 9
session: 4
awsServices:
  - Amazon ECR
  - Amazon EC2
learningObjectives:
  - GitHub Actions에서 Docker 이미지를 빌드하고 ECR에 Push하는 워크플로우를 작성할 수 있습니다.
  - SSM Run Command로 EC2에서 docker pull + restart를 자동화할 수 있습니다.
  - 코드 Push만으로 전체 배포가 자동으로 이루어지는 파이프라인을 구축할 수 있습니다.
prerequisites:
  - Step 9-2 완료 (Amazon EC2에서 docker-compose 실행 중)
  - GitHub 리포지토리에 Secrets 설정 (AWS 키, 보안 설정 파일)
estimatedCost: 무료 (GitHub Actions Public 무료, 기존 9-2 EC2/RDS 유지 비용만 발생)
---

코드를 Push하면 자동으로 Docker 이미지를 빌드하고, Amazon ECR에 Push하고,  
Amazon EC2에서 새 이미지를 Pull하여 재시작하는 **전체 CI/CD 파이프라인**을 구축합니다.

### Step 9 전체 구성

| 세션                 | 주제                               | 핵심                                          |
| -------------------- | ---------------------------------- | --------------------------------------------- |
| 9-0                  | Docker + 컨테이너 이론             | 개념 학습                                     |
| 9-1                  | Dockerfile + docker-compose (로컬) | 프론트+백엔드+DB 로컬 풀스택 실행             |
| 9-2                  | ECR Push + EC2 docker-compose 배포 | 통합 인프라(EC2+RDS), VPC Endpoint, EC2 운영  |
| 9-3                  | AWS Fargate 서버리스 컨테이너 체험 | 9-2 이미지+RDS 재사용, Fargate 사이드카 체험  |
| **9-4 (이번 실습)**  | GitHub Actions → ECR → EC2         | Docker CI/CD 파이프라인 (멀티레포 & 모노레포) |
| 9-5                  | (선택) CloudFront + Fargate        | 프로덕션 분리 구성                            |
| 9-6                  | 리소스 정리                        | 전체 삭제                                     |

> [!CONCEPT] Step 8 CI/CD vs Step 9 CI/CD
> | 항목 | Step 8 (JAR/WAR 직접 배포) | Step 9 (Docker 배포) |
> |------|---------------------------|---------------------|
> | 빌드 결과물 | JAR/WAR 파일 | Docker 이미지 |
> | 보안 설정 파일 | GitHub Secret(`APPLICATION_PROPERTIES`)으로 빌드 전 생성 | **동일** (`docker build` 직전 생성) |
> | 저장소 | Amazon S3 | Amazon ECR |
> | 배포 방식 | S3 → SSM → EC2에서 JAR/WAR 교체 | ECR → SSM → EC2에서 `docker-compose pull & up -d` |
> | 롤백 | 이전 JAR/WAR 복원 | 이전 이미지 태그로 pull |
>
> 구조는 비슷하지만, Docker 이미지 단위로 관리하므로 **로컬과 AWS의 실행 환경 일관성**이 완벽하게 보장됩니다.

### 실습 흐름

```
[GitHub Secrets 설정] → [워크플로우 작성 (백엔드)] → [워크플로우 작성 (프론트)]
    → [Push 테스트] → [자동 배포 확인] → [롤백 테스트]
```

### 파이프라인 구조

```
Push (main)
    │
    ▼
GitHub Actions
    │
    ├── Docker Build (frontend/backend)
    │
    ├── ECR Login + Push
    │       ├── step9-frontend:v1.0 (또는 SHA)
    │       └── step9-backend:v1.0
    │
    └── SSM Run Command → EC2
            │
            ├── docker pull step9-frontend:latest
            ├── docker pull step9-backend:latest
            └── docker-compose up -d (재시작)
```

---

## 태스크 1: IAM 권한 및 GitHub Secrets 설정

📍 **실행 위치: AWS 콘솔 (IAM) + GitHub 웹 (Settings → Secrets)**

TODO:
- GitHub Actions용 IAM User에 `AmazonEC2ContainerRegistryPowerUser` 및 SSM Run Command 권한 확인
- GitHub Secrets 등록 (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `ECR_REGISTRY`, `EC2_INSTANCE_ID`)
- 백엔드 보안 설정 파일(`application.properties` 또는 `application.yaml`)을 위한 `APPLICATION_PROPERTIES` Secret 등록 안내 (Step 8-3A와 동일 방식)
- 🟢 멀티레포(각 레포에 등록) vs 🟡 모노레포(단일 레포에 1회 등록) 안내

✅ **태스크 완료** — GitHub Secrets에 AWS 인증 정보와 설정 파일 정보를 등록했습니다.

---

## 태스크 2: 백엔드 배포 워크플로우 작성

📍 **실행 위치: 로컬 PC (`my-backend`)**

TODO: `.github/workflows/deploy.yml` 작성

- `APPLICATION_PROPERTIES` Secret으로 `src/main/resources/application.properties` 생성 단계
- Docker Build (`my-backend/Dockerfile` 멀티스테이지)
- Amazon ECR Login + Push (`latest` 및 `${{ github.sha }}` 태그)
- AWS Systems Manager Run Command (Amazon EC2에서 `docker-compose pull backend && docker-compose up -d`)
- 🟢 방법 A (멀티레포 기본) / 🟡 방법 B (모노레포 `paths: ['my-backend/**']` 필터) 예시 제공

✅ **태스크 완료** — 백엔드 자동 배포 워크플로우를 작성했습니다.

---

## 태스크 3: 프론트엔드 배포 워크플로우 작성

📍 **실행 위치: 로컬 PC (`my-frontend`)**

TODO: `.github/workflows/deploy.yml` 작성

- Docker Build (`my-frontend/Dockerfile` 멀티스테이지)
- Amazon ECR Login + Push
- AWS Systems Manager Run Command (Amazon EC2에서 `docker-compose pull frontend && docker-compose up -d`)
- 🟢 방법 A (멀티레포 기본) / 🟡 방법 B (모노레포 `paths: ['my-frontend/**']` 필터) 예시 제공

✅ **태스크 완료** — 프론트엔드 자동 배포 워크플로우를 작성했습니다.

---

## 태스크 4: 배포 테스트

📍 **실행 위치: 로컬 PC → GitHub → EC2**

TODO: 코드 수정 → Push → Actions 탭에서 실행 확인 → 브라우저에서 변경 확인

✅ **태스크 완료** — Push만으로 자동 배포가 완료되는 것을 확인했습니다.

---

## 태스크 5: 롤백 테스트 (선택)

📍 **실행 위치: EC2**

> [!TIP]
> Docker 이미지 태그로 롤백하는 방법:
>
> ```bash
> # EC2에서
> docker pull <ECR_URI>/step9-backend:이전태그
> docker-compose up -d
> ```
>
> Step 8(JAR)에서는 이전 파일을 찾아야 했지만, Docker는 태그만 변경하면 됩니다.

TODO: 이전 태그로 롤백, 동작 확인

✅ **태스크 완료** — 이미지 태그 기반 롤백을 확인했습니다.

---

## 마무리

### 이번 세션에서 배운 것

- GitHub Actions에서 Docker 이미지 빌드 + ECR Push
- SSM Run Command로 EC2에서 docker pull 자동화
- 코드 Push → 자동 배포 전체 파이프라인
- 이미지 태그 기반 롤백

### 다음 단계

- **9-5 (선택)**: CloudFront + Fargate 프로덕션 구성
- **9-6**: 리소스 정리 (9-5를 건너뛸 경우 바로 이동)

> [!NOTE]
> 9-5를 진행하지 않으려면 → [9-6: 리소스 정리](/week/9/session/6)로 이동하세요.

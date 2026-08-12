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
  - Step 9-3 완료 (EC2에서 docker-compose 실행 중)
  - GitHub 리포지토리에 Secrets 설정 (AWS 키)
estimatedCost: 무료 (GitHub Actions Public 무료)
---

코드를 Push하면 자동으로 Docker 이미지를 빌드하고, ECR에 Push하고,  
EC2에서 새 이미지를 Pull하여 재시작하는 **전체 CI/CD 파이프라인**을 구축합니다.

> [!CONCEPT] Step 8 CI/CD vs Step 9 CI/CD
> | 항목 | Step 8 (JAR 직접 배포) | Step 9 (Docker 배포) |
> |------|----------------------|---------------------|
> | 빌드 결과물 | JAR/WAR 파일 | Docker 이미지 |
> | 저장소 | S3 | ECR |
> | 배포 방식 | S3 → SSM → EC2에서 JAR 교체 | ECR → SSM → EC2에서 docker pull |
> | 롤백 | 이전 JAR 복원 | 이전 이미지 태그로 pull |
>
> 구조는 비슷하지만, Docker 이미지 단위로 관리하므로 **환경 일관성**이 보장됩니다.

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

## 태스크 1: GitHub Secrets 설정

📍 **실행 위치: GitHub 웹 (Settings → Secrets)**

TODO: 필요한 Secrets 목록 (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, ECR_REGISTRY, EC2_INSTANCE_ID)

✅ **태스크 완료** — GitHub Secrets에 AWS 인증 정보를 등록했습니다.

---

## 태스크 2: 백엔드 배포 워크플로우 작성

📍 **실행 위치: 로컬 PC (백엔드 리포지토리)**

TODO: `.github/workflows/deploy.yml` 작성

- Docker Build (멀티스테이지)
- ECR Login + Push
- SSM Run Command (EC2에서 pull + docker-compose up)

✅ **태스크 완료** — 백엔드 자동 배포 워크플로우를 작성했습니다.

---

## 태스크 3: 프론트엔드 배포 워크플로우 작성

📍 **실행 위치: 로컬 PC (프론트엔드 리포지토리)**

TODO: 프론트 워크플로우 (구조 동일, Dockerfile만 다름)

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

---
title: 'Docker 빌드 + Amazon ECR Push'
week: 9
session: 2
awsServices:
  - Amazon ECR
  - Amazon EC2
learningObjectives:
  - Docker 이미지를 빌드하고 로컬에서 실행할 수 있습니다.
  - Dockerfile을 작성하여 Spring Boot 애플리케이션을 컨테이너화할 수 있습니다.
  - Amazon ECR 리포지토리를 생성하고 이미지를 Push할 수 있습니다.
  - GitHub Actions에서 Docker 빌드 + Amazon ECR Push 파이프라인을 구축할 수 있습니다.
prerequisites:
  - Step 9-1 완료 (GitHub Actions 기본 이해)
  - Step 8 인프라 유지 중 (또는 Amazon EC2 인스턴스 1개 이상)
  - Docker Desktop 설치 (로컬 테스트용)
  - AWS CLI 설정 완료
estimatedCost: 프리티어 (Amazon ECR 500MB/월 무료, GitHub Actions Public 무료)
---

이 실습에서는 Spring Boot 애플리케이션을 Docker 이미지로 패키징하고,
Amazon ECR(Elastic Container Registry)에 Push하는 전체 과정을 학습합니다.
GitHub Actions로 자동화하여 코드 Push만으로 이미지가 빌드·배포되는 파이프라인을 구축합니다.

> [!NOTE]
> Step 9-3에서 이 이미지를 Amazon ECS Fargate에 배포합니다.  
> 이번 세션에서는 **이미지 빌드와 레지스트리 Push**에 집중합니다.

### Step 9 전체 구성

| 세션                | 주제                          | 핵심 리소스                |
| ------------------- | ----------------------------- | -------------------------- |
| 9-0                 | CI/CD + 컨테이너 이론         | 개념 학습                  |
| 9-1                 | GitHub Actions → EC2 배포     | GitHub Actions, Amazon EC2 |
| **9-2 (이번 실습)** | Docker 빌드 + Amazon ECR Push | Docker, Amazon ECR         |
| 9-3                 | ECR → ECS Fargate 배포        | Amazon ECS, AWS Fargate    |

### 실습 흐름

```
[Dockerfile 작성] → [로컬 빌드/테스트] → [Amazon ECR 생성] → [수동 Push] → [GitHub Actions 자동화]
```

---

## 태스크 1: Docker 개념 복습

> [!CONCEPT] 왜 Docker를 사용하는가?
> Docker는 애플리케이션과 실행 환경(JDK, 라이브러리, 설정)을 하나의 **이미지**로 패키징합니다.  
> "내 컴퓨터에서는 되는데..."라는 문제를 근본적으로 해결합니다.
>
> - 개발 환경과 운영 환경의 차이를 없앱니다 (동일한 이미지를 어디서든 실행)
> - 서버에 Java를 설치하고 버전을 맞추는 번거로움이 사라집니다
> - 하나의 서버에 여러 앱을 격리하여 실행할 수 있습니다

### Docker 핵심 용어

| 용어           | 설명                               | 비유             |
| -------------- | ---------------------------------- | ---------------- |
| **Dockerfile** | 이미지를 만드는 레시피 (설정 파일) | 요리 레시피      |
| **Image**      | 실행 가능한 패키지 (읽기 전용)     | 붕어빵 틀        |
| **Container**  | 이미지를 실행한 인스턴스           | 구워진 붕어빵    |
| **Registry**   | 이미지를 저장하는 저장소           | 붕어빵 틀 보관함 |
| **Amazon ECR** | AWS 관리형 Docker Registry         | AWS 전용 보관함  |

### Docker vs 전통 배포

```
전통 배포:                           Docker 배포:
┌──────────────────────┐              ┌──────────────────────┐
│ 서버에 JDK 설치       │              │ docker run my-app     │
│ 환경변수 설정         │              │                      │
│ 라이브러리 설치       │              │ (이미지에 모두 포함)  │
│ JAR 복사 + 실행       │              │                      │
│ 버전 충돌 해결...     │              │ ✅ 한 줄로 실행      │
└──────────────────────┘              └──────────────────────┘
```

---

## 태스크 2: Dockerfile 작성

Spring Boot 애플리케이션을 Docker 이미지로 만들기 위한 Dockerfile을 작성합니다.

### Multi-stage 빌드 Dockerfile

프로젝트 루트에 `Dockerfile`을 생성합니다:

```dockerfile
# ============================================================
# Stage 1: 빌드 단계
# Gradle로 JAR 파일을 생성합니다.
# ============================================================
FROM gradle:8.10-jdk17 AS builder

WORKDIR /app

# Gradle 캐시 활용을 위해 빌드 파일 먼저 복사
COPY build.gradle settings.gradle ./
COPY gradle ./gradle
RUN gradle dependencies --no-daemon || true

# 소스 코드 복사 후 빌드
COPY src ./src
RUN gradle bootJar --no-daemon

# ============================================================
# Stage 2: 실행 단계
# 빌드된 JAR만 가져와서 경량 이미지로 실행합니다.
# ============================================================
FROM eclipse-temurin:17-jre-alpine

WORKDIR /app

# 빌드 단계에서 생성된 JAR 복사
COPY --from=builder /app/build/libs/*.jar app.jar

# 컨테이너가 사용할 포트 명시 (문서화 목적)
EXPOSE 8080

# Health Check 설정 (Amazon ECS에서 활용)
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/actuator/health || exit 1

# 애플리케이션 실행
ENTRYPOINT ["java", "-jar", "app.jar"]
```

> [!CONCEPT] Multi-stage 빌드란?
> 하나의 Dockerfile에서 **빌드 환경**과 **실행 환경**을 분리합니다:
>
> - Stage 1 (builder): Gradle + JDK 17 전체 설치 → JAR 빌드 (이미지 약 800MB)
> - Stage 2 (실행): JRE-Alpine만 설치 + JAR 복사 (이미지 약 200MB)
>
> 최종 이미지에는 빌드 도구(Gradle)가 포함되지 않아 크기가 **4분의 1**로 줄어듭니다.  
> 보안 측면에서도 불필요한 도구가 없어 공격 면적(Attack Surface)이 줄어듭니다.

### .dockerignore 작성

불필요한 파일이 이미지에 포함되지 않도록 `.dockerignore`를 생성합니다:

```
.git
.gitignore
.idea
.gradle
build
*.md
docker-compose*.yml
```

---

## 태스크 3: 로컬에서 Docker 빌드 및 테스트

### 이미지 빌드

1. 터미널에서 프로젝트 루트 디렉토리로 이동합니다.
2. Docker 이미지를 빌드합니다:

```bash
docker build --platform linux/amd64 -t my-3tier-app:latest .
```

> [!NOTE]
> `--platform linux/amd64`는 AWS Fargate(x86_64)에서 실행할 이미지를 빌드합니다.  
> Apple Silicon(M1/M2/M3) Mac에서도 이 옵션을 사용하면 x86 이미지가 생성됩니다.  
> Windows, Intel Mac, Linux에서도 동일하게 사용할 수 있어 **크로스 플랫폼 빌드**가 보장됩니다.  
> 첫 빌드는 베이스 이미지 다운로드로 3~5분 소요됩니다.  
> 이후 빌드는 캐시를 활용하여 빠르게 완료됩니다.

> [!TIP]
> Docker Buildx를 사용하면 멀티 플랫폼 빌드도 가능합니다:
>
> ```bash
> # amd64 + arm64 동시 빌드 (Push 시)
> docker buildx build --platform linux/amd64,linux/arm64 -t my-3tier-app:latest --push .
>
> # 로컬 테스트용 (현재 플랫폼에 맞는 이미지만 로드)
> docker buildx build --platform linux/amd64 -t my-3tier-app:latest --load .
> ```
>
> `--push`는 레지스트리에 직접 Push, `--load`는 로컬 Docker에 저장합니다.  
> 멀티 플랫폼(`amd64,arm64`)과 `--load`는 동시에 사용할 수 없습니다 (manifest list는 로컬 저장 불가).  
> Buildx는 Docker Desktop 최신 버전에 기본 포함되어 있습니다.

3. 빌드된 이미지를 확인합니다:

```bash
docker images | grep my-3tier-app
```

> [!OUTPUT]
>
> ```
> REPOSITORY     TAG       IMAGE ID       CREATED         SIZE
> my-3tier-app   latest    a1b2c3d4e5f6   10 seconds ago  213MB
> ```

### 컨테이너 실행 및 테스트

4. 컨테이너를 실행합니다:

```bash
docker run -d \
  --name my-app \
  -p 8080:8080 \
  -e SPRING_PROFILES_ACTIVE=local \
  -e DB_HOST=host.docker.internal \
  -e DB_PORT=3306 \
  -e DB_NAME=mydb \
  -e DB_USERNAME=admin \
  -e DB_PASSWORD=password \
  my-3tier-app:latest
```

> [!TIP]
> `-e` 옵션으로 환경변수를 전달합니다. 실제 배포에서는 이 값들을 AWS Secrets Manager나 SSM Parameter Store에서 가져옵니다.  
> `host.docker.internal`은 Docker 컨테이너에서 호스트 머신의 localhost를 가리키는 특수 DNS입니다.

5. 컨테이너 상태를 확인합니다:

```bash
docker ps
```

6. Health Check를 확인합니다:

```bash
curl http://localhost:8080/actuator/health
```

> [!OUTPUT]
>
> ```json
> { "status": "UP" }
> ```

7. 테스트가 끝나면 컨테이너를 정리합니다:

```bash
docker stop my-app && docker rm my-app
```

> [!TROUBLESHOOTING]
> | 증상 | 원인 | 해결 방법 |
> |------|------|-----------|
> | `Cannot connect to the Docker daemon` | Docker Desktop 미실행 | Docker Desktop 실행 후 재시도 |
> | 빌드 중 `gradle: not found` | Dockerfile 오타 | `FROM gradle:8.10-jdk17` 확인 |
> | 컨테이너 즉시 종료 | DB 연결 실패 | 로그 확인: `docker logs my-app` |
> | `port is already in use` | 8080 포트 사용 중 | 다른 포트 매핑: `-p 8081:8080` |

✅ **태스크 완료** — Docker 이미지를 빌드하고 로컬에서 정상 실행을 확인했습니다.

---

## 태스크 4: Amazon ECR 리포지토리 생성

Amazon ECR은 Docker 이미지를 저장하는 AWS 관리형 레지스트리입니다.  
Docker Hub와 유사하지만 AWS IAM과 통합되어 보안이 강화됩니다.

### Amazon ECR 리포지토리 생성

8. AWS Management Console에서 상단 검색창에 `ECR`을 입력하고 **Elastic Container Registry**를 선택합니다.
9. 리전이 **ap-northeast-2 (서울)**인지 확인합니다.
10. 왼쪽 메뉴에서 **Repositories**를 클릭합니다.
11. [[Create repository]]를 클릭합니다.
12. 다음을 설정합니다:
    - **Visibility settings**: `Private` 선택
    - **Repository name**: `my-3tier-app`
    - **Tag immutability**: `Disabled` (기본값)
    - **Image scan settings**: ✅ `Scan on push` 체크

> [!TIP]
> **Scan on push를 활성화하면:**  
> 이미지를 Push할 때마다 자동으로 취약점 스캔이 실행됩니다.  
> 알려진 보안 취약점(CVE)이 포함된 라이브러리를 조기에 발견할 수 있습니다.  
> 프리티어에서 월 최초 스캔은 무료입니다.

13. [[Create repository]]를 클릭합니다.

> [!OUTPUT]
>
> ```
> Repository: my-3tier-app
> URI: 123456789012.dkr.ecr.ap-northeast-2.amazonaws.com/my-3tier-app
> ```
>
> 이 URI가 이미지를 Push/Pull할 주소입니다. 메모해두세요.

✅ **태스크 완료** — Amazon ECR Private 리포지토리를 생성했습니다.

---

## 태스크 5: 수동으로 Amazon ECR에 Push

자동화 전에 수동으로 한 번 Push하여 전체 흐름을 이해합니다.

### Amazon ECR 로그인

14. 터미널에서 Amazon ECR에 Docker 로그인합니다:

```bash
aws ecr get-login-password --region ap-northeast-2 | \
  docker login --username AWS --password-stdin \
  123456789012.dkr.ecr.ap-northeast-2.amazonaws.com
```

> [!NOTE]
> `123456789012`를 본인의 AWS 계정 ID로 변경하세요.  
> 계정 ID는 AWS Console 우측 상단 계정 이름을 클릭하면 확인할 수 있습니다.

> [!OUTPUT]
>
> ```
> Login Succeeded
> ```

### 이미지 태깅

15. 로컬 이미지에 Amazon ECR URI로 태그를 추가합니다:

```bash
docker tag my-3tier-app:latest \
  123456789012.dkr.ecr.ap-northeast-2.amazonaws.com/my-3tier-app:latest
```

> [!CONCEPT] Docker 태그란?
> Docker 태그는 이미지의 **버전 라벨**입니다.  
> `latest`는 관례적으로 최신 버전을 가리키지만, 프로덕션에서는 `v1.0.0`, `abc1234`(커밋 해시) 등 고유한 태그를 사용합니다.  
> 이 실습에서는 Git 커밋의 짧은 SHA를 태그로 사용합니다.

### 이미지 Push

16. Amazon ECR에 이미지를 Push합니다:

```bash
docker push \
  123456789012.dkr.ecr.ap-northeast-2.amazonaws.com/my-3tier-app:latest
```

17. AWS Console → Amazon ECR → `my-3tier-app` 리포지토리에서 이미지가 Push되었는지 확인합니다.

> [!TROUBLESHOOTING]
> | 증상 | 원인 | 해결 방법 |
> |------|------|-----------|
> | `no basic auth credentials` | ECR 로그인 만료 (12시간) | `aws ecr get-login-password` 재실행 |
> | `denied: User is not authorized` | IAM 권한 부족 | IAM에 `AmazonEC2ContainerRegistryPowerUser` 정책 추가 |
> | `name unknown` | 리포지토리 이름 불일치 | ECR URI와 태그 이름 확인 |

✅ **태스크 완료** — Docker 이미지를 수동으로 Amazon ECR에 Push했습니다.

---

## 태스크 6: GitHub Actions로 자동화

코드를 Push하면 자동으로 Docker 빌드 → Amazon ECR Push가 실행되는 파이프라인을 구축합니다.

### GitHub Secrets 설정

18. GitHub 리포지토리 → **Settings** → **Secrets and variables** → **Actions**로 이동합니다.
19. [[New repository secret]]을 클릭하여 다음 시크릿을 추가합니다:

| Name                    | Value             | 설명         |
| ----------------------- | ----------------- | ------------ |
| `AWS_ACCESS_KEY_ID`     | IAM Access Key ID | AWS 인증     |
| `AWS_SECRET_ACCESS_KEY` | IAM Secret Key    | AWS 인증     |
| `AWS_ACCOUNT_ID`        | `123456789012`    | ECR URI 구성 |
| `AWS_REGION`            | `ap-northeast-2`  | 리전         |

> [!WARNING]
> IAM 사용자의 Access Key를 사용합니다.  
> 프로덕션에서는 **OIDC**(OpenID Connect)를 통한 역할 위임 방식이 권장됩니다.  
> 이 실습에서는 학습 편의를 위해 Access Key를 사용합니다.

> [!TIP]
> IAM 사용자에게 최소한 다음 정책이 필요합니다:
>
> - `AmazonEC2ContainerRegistryPowerUser` — ECR Push/Pull 권한
>
> 또는 직접 정책을 작성:
>
> ```json
> {
>   "Version": "2012-10-17",
>   "Statement": [
>     {
>       "Effect": "Allow",
>       "Action": [
>         "ecr:GetAuthorizationToken",
>         "ecr:BatchCheckLayerAvailability",
>         "ecr:GetDownloadUrlForLayer",
>         "ecr:BatchGetImage",
>         "ecr:PutImage",
>         "ecr:InitiateLayerUpload",
>         "ecr:UploadLayerPart",
>         "ecr:CompleteLayerUpload"
>       ],
>       "Resource": "*"
>     }
>   ]
> }
> ```

### GitHub Actions 워크플로우 작성

20. 프로젝트에 `.github/workflows/docker-ecr.yml`을 생성합니다:

```yaml
name: Build and Push to ECR

on:
  push:
    branches: [main]

env:
  ECR_REPOSITORY: my-3tier-app
  IMAGE_TAG: ${{ github.sha }}

jobs:
  build-and-push:
    runs-on: ubuntu-latest

    steps:
      # 소스 코드 체크아웃
      - name: Checkout code
        uses: actions/checkout@v4

      # AWS 인증 설정
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ secrets.AWS_REGION }}

      # Amazon ECR 로그인
      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v2

      # Docker Buildx 설정 (멀티 플랫폼 빌드 지원)
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      # Docker 이미지 빌드 및 Push (amd64 + arm64 동시 빌드)
      - name: Build and push image to Amazon ECR
        uses: docker/build-push-action@v6
        with:
          context: .
          platforms: linux/amd64,linux/arm64
          push: true
          tags: |
            ${{ steps.login-ecr.outputs.registry }}/${{ env.ECR_REPOSITORY }}:${{ env.IMAGE_TAG }}
            ${{ steps.login-ecr.outputs.registry }}/${{ env.ECR_REPOSITORY }}:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

> [!CONCEPT] Docker Buildx란?
> `docker buildx`는 Docker의 확장 빌드 도구로, 다음 기능을 제공합니다:
>
> - **멀티 플랫폼 빌드**: `platforms: linux/amd64,linux/arm64`로 지정하면 한 번의 빌드로 x86과 ARM 이미지를 동시에 생성합니다. 하나의 태그(manifest list)로 묶여서 Push되며, 실행 환경에서 알아서 맞는 아키텍처를 Pull합니다.
> - **빌드 캐시**: `cache-from/cache-to: type=gha`로 GitHub Actions 캐시를 활용하여 빌드 시간을 단축합니다.
> - **크로스 플랫폼**: Apple Silicon Mac에서 빌드해도 x86 이미지가, Intel Mac에서 빌드해도 ARM 이미지가 생성됩니다.
>
> `docker/build-push-action`은 내부적으로 buildx를 사용하며, 빌드+Push를 한 번에 처리합니다.

> [!TIP]
> **두 개의 태그를 Push하는 이유:**
>
> - `$IMAGE_TAG` (커밋 SHA): 고유 버전. 롤백 시 특정 버전을 지정할 수 있습니다.
> - `latest`: 항상 최신 이미지. 개발/스테이징 환경에서 편리합니다.
>
> 프로덕션 배포에서는 `latest` 대신 명시적 태그(커밋 SHA 또는 시맨틱 버전)를 사용합니다.

### 파이프라인 테스트

21. 변경사항을 커밋하고 Push합니다:

```bash
git add .
git commit -m "feat: add Docker build + ECR push workflow"
git push origin main
```

22. GitHub 리포지토리 → **Actions** 탭에서 워크플로우 실행을 확인합니다.
23. 모든 스텝이 ✅ 완료되면 AWS Console → Amazon ECR에서 새 이미지를 확인합니다.

> [!TROUBLESHOOTING]
> | 증상 | 원인 | 해결 방법 |
> |------|------|-----------|
> | `Error: Credentials could not be loaded` | GitHub Secrets 미설정 또는 이름 오타 | Secrets 이름이 정확한지 확인 |
> | `requested access to the resource is denied` | ECR 리포지토리 이름 불일치 | `ECR_REPOSITORY` 환경변수 확인 |
> | 빌드 성공하지만 Push 실패 | 리전 불일치 | `AWS_REGION` Secret 확인 |
> | 빌드 시간 오래 걸림 (10분+) | 캐시 미활용 | Docker layer caching Action 추가 |

✅ **태스크 완료** — GitHub Actions로 Docker 빌드 → Amazon ECR Push 파이프라인을 구축했습니다.

---

## 태스크 7: 이미지 관리 (선택)

### Amazon ECR 라이프사이클 정책

오래된 이미지가 쌓이면 스토리지 비용이 발생합니다.  
라이프사이클 정책으로 자동 정리를 설정합니다.

24. Amazon ECR → `my-3tier-app` → **Lifecycle Policy** → [[Create rule]]을 클릭합니다.
25. 다음과 같이 설정합니다:
    - **Rule priority**: `1`
    - **Rule description**: `Keep only last 10 images`
    - **Image status**: `Any`
    - **Match criteria**: Count more than `10`
    - **Action**: `Expire`

> [!TIP]
> 이 정책은 이미지가 10개를 초과하면 오래된 것부터 자동 삭제합니다.  
> `latest` 태그가 붙은 이미지는 항상 유지됩니다.

✅ **태스크 완료** — Amazon ECR 라이프사이클 정책을 설정했습니다.

---

## 마무리

이 실습에서 다음을 성공적으로 수행했습니다:

- Multi-stage Dockerfile을 작성하여 경량 Docker 이미지를 빌드했습니다.
- 로컬에서 컨테이너를 실행하고 정상 동작을 확인했습니다.
- Amazon ECR Private 리포지토리를 생성하고 이미지를 Push했습니다.
- GitHub Actions로 Docker 빌드 → Amazon ECR Push 파이프라인을 자동화했습니다.

> [!TIP]
> 다음 실습(Step 9-3)에서는 이 이미지를 Amazon ECS Fargate에 배포합니다.  
> Amazon ECR의 이미지를 삭제하지 마세요!

---

# 🗑️ 리소스 정리

> [!NOTE]
> Step 9-3을 이어서 진행할 예정이라면 Amazon ECR 리포지토리와 이미지를 삭제하지 마세요.

### 이 세션만 정리하는 경우

1. Amazon ECR → `my-3tier-app` 리포지토리 선택
2. [[Delete]]를 클릭합니다.
3. 확인란에 `delete`를 입력하고 [[Delete]]를 클릭합니다.

> [!WARNING]
> 리포지토리를 삭제하면 포함된 모든 이미지가 함께 삭제됩니다.  
> Step 9-3에서 필요하므로 이어서 진행할 예정이면 삭제하지 마세요.

> [!NOTE]
> Amazon ECR 프리티어: Private 리포지토리 500MB/월 무료.  
> Multi-stage 빌드 이미지(약 200MB)는 2~3개까지 무료 범위 내입니다.

✅ **실습 종료**: 다음 세션(Step 9-3)에서 Amazon ECS Fargate 배포를 진행합니다.

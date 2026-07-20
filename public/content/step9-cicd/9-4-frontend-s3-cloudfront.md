---
title: 'Vue.js → S3 + CloudFront 자동 배포'
week: 9
session: 4
awsServices:
  - Amazon S3
  - Amazon CloudFront
learningObjectives:
  - GitHub Actions로 Vue.js 프로젝트를 빌드하고 Amazon S3에 자동 배포할 수 있습니다.
  - Amazon CloudFront 캐시 무효화(Invalidation)를 자동화할 수 있습니다.
  - 프론트엔드와 백엔드 CI/CD를 연동하여 3-Tier 아키텍처 전체 자동 배포를 완성할 수 있습니다.
prerequisites:
  - Step 9-3 완료 (백엔드 Amazon ECS Fargate 배포)
  - Step 8 인프라 유지 중 (Amazon S3 버킷, Amazon CloudFront Distribution)
  - Vue.js 프론트엔드 프로젝트 (GitHub 리포지토리)
estimatedCost: 프리티어 (Amazon S3 5GB, Amazon CloudFront 1TB/월 무료)
---

이 실습에서는 Vue.js 프론트엔드를 GitHub Actions로 자동 빌드하고,
Amazon S3에 배포한 뒤 Amazon CloudFront 캐시를 자동 무효화하는 파이프라인을 구축합니다.
Step 9-3에서 배포한 백엔드(Amazon ECS Fargate)와 연동하여 **3-Tier 아키텍처 전체 CI/CD를 완성**합니다.

> [!CONCEPT] Step 8-2 → Step 9-4: 무엇이 바뀌는가?
> Step 8-2에서는 프론트엔드를 **수동으로** 빌드하고 업로드했습니다:
>
> | 단계       | Step 8-2 (수동)                        | Step 9-4 (자동)                |
> | ---------- | -------------------------------------- | ------------------------------ |
> | 빌드       | 로컬에서 `npm run build`               | GitHub Actions가 자동 빌드     |
> | S3 업로드  | `aws s3 sync dist/ s3://...` 수동 실행 | push만 하면 자동 sync          |
> | CloudFront | 콘솔에서 Invalidation 수동 생성        | 워크플로우가 자동 Invalidation |
> | 환경변수   | `.env.production` 수동 편집            | GitHub Secrets에서 자동 주입   |
>
> **Amazon S3 버킷과 Amazon CloudFront는 Step 8 그대로 유지**합니다.  
> 배포 과정만 수동에서 자동으로 바뀝니다.

> [!NOTE]
> Step 8-2에서 수동으로 빌드 → Amazon S3 업로드 → Amazon CloudFront 설정을 했다면,  
> 이번 세션에서는 그 과정을 **GitHub Actions로 완전 자동화**합니다.

### Step 9 전체 구성

| 세션                | 주제                              | 핵심 리소스                  |
| ------------------- | --------------------------------- | ---------------------------- |
| 9-0                 | CI/CD + 컨테이너 이론             | 개념 학습                    |
| 9-1                 | GitHub Actions → EC2 배포         | GitHub Actions, Amazon EC2   |
| 9-2                 | Docker 빌드 + Amazon ECR Push     | Docker, Amazon ECR           |
| 9-3                 | ECR → ECS Fargate 배포 (백엔드)   | Amazon ECS, AWS Fargate      |
| **9-4 (이번 실습)** | S3 + CloudFront 배포 (프론트엔드) | Amazon S3, Amazon CloudFront |

### 실습 흐름

```
[환경변수 설정] → [워크플로우 작성] → [S3 배포 자동화] → [CloudFront Invalidation] → [백엔드 연동 확인]
```

---

## 태스크 1: 프론트엔드 CI/CD 아키텍처 이해

> [!CONCEPT] 프론트엔드 배포의 특성
> Vue.js, React 같은 SPA(Single Page Application)는 빌드 결과물이 **정적 파일**(HTML, CSS, JS)입니다.  
> 서버가 필요 없으므로 Amazon S3에 저장하고 Amazon CloudFront(CDN)로 전 세계에 배포하는 것이 최적입니다.
>
> - 백엔드는 서버가 계속 실행되어야 하지만 (ECS Fargate), 프론트엔드는 파일만 올리면 끝입니다.
> - Amazon CloudFront는 전 세계 엣지 로케이션에 파일을 캐싱하여 사용자에게 빠르게 전달합니다.
> - 비용도 Amazon EC2보다 훨씬 저렴합니다 (프리티어: Amazon S3 5GB + Amazon CloudFront 1TB/월).

### 전체 배포 파이프라인

```
┌─────────────────────────────────────────────────────────────────┐
│  프론트엔드 CI/CD                                                │
│                                                                  │
│  git push → GitHub Actions → npm build → aws s3 sync            │
│                                              │                   │
│                                              ▼                   │
│                                   CloudFront Invalidation        │
│                                              │                   │
│                                              ▼                   │
│                              사용자 ← CloudFront ← S3            │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  백엔드 CI/CD (Step 9-3에서 구축)                                │
│                                                                  │
│  git push → GitHub Actions → Docker Build → ECR → ECS Fargate   │
│                                                       │          │
│                                                       ▼          │
│                                프론트엔드 ← ALB ← Fargate → RDS  │
└─────────────────────────────────────────────────────────────────┘
```

### Amazon CloudFront Invalidation이 필요한 이유

Amazon CloudFront는 파일을 엣지 로케이션에 **캐싱**합니다 (기본 TTL: 24시간).  
Amazon S3에 새 파일을 올려도 캐시가 만료될 때까지 이전 버전이 사용자에게 전달됩니다.

```
배포 없이 S3만 업데이트하면:
사용자 → CloudFront (캐시된 v1.0) → 새 파일을 못 봄 (최대 24시간)

Invalidation 실행하면:
사용자 → CloudFront (캐시 삭제됨) → S3에서 v2.0 가져옴 → 즉시 반영
```

> [!TIP]
> Invalidation은 월 1,000건 무료입니다.  
> `/*` (전체 무효화) 1회 = 1건으로 카운트되므로 비용 걱정 없이 사용할 수 있습니다.

---

## 태스크 2: GitHub Secrets 설정

프론트엔드 리포지토리(`my-frontend`)에 AWS 인증 정보와 배포 대상을 등록합니다.

1. `my-frontend` GitHub 리포지토리 페이지에서 **Settings** 탭을 클릭합니다.
2. 왼쪽 메뉴에서 **Secrets and variables** → **Actions**를 클릭합니다.
3. [[New repository secret]]을 클릭하여 다음 시크릿을 추가합니다:

| Name                         | Value                                | 설명                              |
| ---------------------------- | ------------------------------------ | --------------------------------- |
| `AWS_ACCESS_KEY_ID`          | IAM Access Key ID                    | AWS 인증                          |
| `AWS_SECRET_ACCESS_KEY`      | IAM Secret Key                       | AWS 인증                          |
| `AWS_REGION`                 | `ap-northeast-2`                     | 리전                              |
| `S3_BUCKET_NAME`             | `my-3tier-app-frontend-123456789012` | Step 8에서 생성한 버킷 이름       |
| `CLOUDFRONT_DISTRIBUTION_ID` | `E1A2B3C4D5E6F7`                     | Amazon CloudFront Distribution ID |
| `VITE_API_BASE_URL`          | `http://<ALB DNS Name>`              | 백엔드 API URL (Step 9-3의 ALB)   |

> [!TIP]
> **Amazon CloudFront Distribution ID 확인 방법:**
>
> - AWS Console → Amazon CloudFront → Distributions → ID 열에 표시됩니다.
> - 또는 CLI: `aws cloudfront list-distributions --query 'DistributionList.Items[*].Id'`
>
> **VITE_API_BASE_URL:**
>
> - Step 9-3에서 배포한 백엔드의 ALB DNS Name입니다.
> - Vue.js에서 `import.meta.env.VITE_API_BASE_URL`로 접근합니다.

> [!NOTE]
> IAM 사용자에게 다음 정책이 필요합니다:
>
> - `AmazonS3FullAccess` (또는 특정 버킷에 대한 s3:PutObject, s3:DeleteObject, s3:ListBucket)
> - `CloudFrontFullAccess` (또는 cloudfront:CreateInvalidation)

✅ **태스크 완료** — GitHub Secrets를 설정했습니다.

---

## 태스크 3: 프론트엔드 배포 워크플로우 작성

### .env.production 설정

3. Vue.js 프로젝트의 `.env.production` 파일을 확인합니다:

```
VITE_API_BASE_URL=http://placeholder-will-be-replaced
```

> [!NOTE]
> GitHub Actions에서 빌드 시 `VITE_API_BASE_URL` 환경변수를 주입하므로,  
> `.env.production`에는 플레이스홀더만 넣어도 됩니다.  
> 실제 값은 워크플로우에서 GitHub Secrets로 전달합니다.

### GitHub Actions 워크플로우 작성

4. `my-frontend` 프로젝트에 `.github/workflows/deploy-frontend.yml`을 생성합니다:

```yaml
name: Deploy Frontend to S3 + CloudFront

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      # 소스 코드 체크아웃
      - name: Checkout code
        uses: actions/checkout@v4

      # Node.js 설정
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'

      # 의존성 설치
      - name: Install dependencies
        run: npm ci

      # 환경변수 주입 후 빌드
      - name: Build
        env:
          VITE_API_BASE_URL: ${{ secrets.VITE_API_BASE_URL }}
        run: npm run build

      # AWS 인증
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ secrets.AWS_REGION }}

      # S3에 빌드 결과물 배포
      # --delete: S3에만 있고 로컬에 없는 파일 삭제 (이전 버전 정리)
      - name: Deploy to S3
        run: |
          aws s3 sync dist/ s3://${{ secrets.S3_BUCKET_NAME }} \
            --delete \
            --cache-control "public, max-age=31536000, immutable" \
            --exclude "index.html"

          # index.html은 캐시하지 않음 (항상 최신 버전)
          aws s3 cp dist/index.html s3://${{ secrets.S3_BUCKET_NAME }}/index.html \
            --cache-control "public, max-age=0, must-revalidate"

      # CloudFront 캐시 무효화
      - name: Invalidate CloudFront cache
        run: |
          aws cloudfront create-invalidation \
            --distribution-id ${{ secrets.CLOUDFRONT_DISTRIBUTION_ID }} \
            --paths "/*"

      # 배포 완료 확인
      - name: Deployment summary
        run: |
          echo "✅ Frontend deployed successfully!"
          echo "S3 Bucket: ${{ secrets.S3_BUCKET_NAME }}"
          echo "CloudFront will propagate within 1-2 minutes."
```

> [!CONCEPT] 캐시 전략 (Cache-Control)
> 빌드 결과물의 캐시를 세분화합니다:
>
> - **JS/CSS/이미지** (파일명에 해시 포함: `app.a1b2c3.js`):  
>   `max-age=31536000, immutable` — 1년간 캐시. 파일명이 바뀌면 자동으로 새 버전 요청.
> - **index.html** (진입점, 파일명 고정):  
>   `max-age=0, must-revalidate` — 항상 최신 버전 확인. index.html이 새 JS/CSS 파일을 참조하므로 여기만 새로고침하면 전체 업데이트.
>
> 이 전략으로 대부분의 요청은 캐시에서 빠르게 서빙되고, 배포 시에만 index.html이 갱신됩니다.

---

## 태스크 4: 배포 테스트

### 첫 배포 실행

5. 변경사항을 커밋하고 Push합니다:

```bash
git add .
git commit -m "feat: add S3 + CloudFront deploy workflow"
git push origin main
```

6. GitHub 리포지토리 → **Actions** 탭에서 워크플로우 실행을 확인합니다.
7. 모든 스텝이 ✅ 완료되면 Amazon CloudFront URL에서 확인합니다:

```bash
# CloudFront URL로 접속
curl -I https://d1234abcdef.cloudfront.net
```

> [!TIP]
> Amazon CloudFront Invalidation 후 전파에 1~2분이 소요될 수 있습니다.  
> 브라우저에서 확인할 때 **강력 새로고침**(Ctrl+Shift+R)을 사용하세요.

### 코드 수정 후 자동 배포 확인

8. Vue.js 코드를 수정합니다 (예: 화면 텍스트 변경).
9. 커밋 + Push합니다.
10. GitHub Actions가 자동 실행되고, 1~2분 후 브라우저에서 변경사항이 반영되는 것을 확인합니다.

✅ **태스크 완료** — 프론트엔드 CI/CD 파이프라인이 정상 동작합니다.

---

## 태스크 5: 백엔드 연동 확인 (3-Tier 전체 테스트)

Step 9-3의 백엔드(ECS Fargate)와 Step 9-4의 프론트엔드(S3+CloudFront)가 연동되는지 확인합니다.

### 프론트엔드에서 백엔드 API 호출

11. 브라우저에서 Amazon CloudFront URL로 접속합니다.
12. 개발자 도구(F12) → **Network** 탭을 열고 페이지를 새로고침합니다.
13. 백엔드 API 호출(`/api/...`)이 정상 응답(200)을 반환하는지 확인합니다.

> [!TROUBLESHOOTING]
> | 증상 | 원인 | 해결 방법 |
> |------|------|-----------|
> | API 호출 시 CORS 에러 | 백엔드 CORS 설정 누락 | Spring Boot에 `@CrossOrigin` 또는 WebMvcConfigurer 설정 |
> | `net::ERR_CONNECTION_REFUSED` | VITE_API_BASE_URL 잘못됨 | GitHub Secrets의 ALB DNS 확인 |
> | 프론트엔드 로드 후 빈 화면 | Vue Router History 모드 문제 | Amazon CloudFront Error Pages → 403/404 → index.html |
> | API 호출 `502 Bad Gateway` | ECS Task 비정상 | Amazon ECS → Tasks → CloudWatch Logs 확인 |

> [!TIP]
> **SPA 404 에러 처리 (Vue Router History 모드):**
>
> Vue.js의 History 모드에서 직접 URL 접속(예: `/about`)하면 Amazon CloudFront가 404를 반환합니다.  
> Amazon S3에 `/about` 파일이 없기 때문입니다. 해결 방법:
>
> - AWS Console → Amazon CloudFront → Distribution → **Error pages** 탭
> - [[Create custom error response]]를 클릭
> - HTTP error code: `403`, Response page path: `/index.html`, HTTP response code: `200`
> - 동일하게 `404`에 대해서도 설정
>
> 이렇게 하면 모든 경로에서 index.html이 반환되고, Vue Router가 클라이언트에서 라우팅을 처리합니다.

### CORS 설정 확인

백엔드(Spring Boot)에 Amazon CloudFront 도메인이 허용되어 있어야 합니다:

```java
@Configuration
public class WebConfig implements WebMvcConfigurer {
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
            .allowedOrigins(
                "https://d1234abcdef.cloudfront.net",  // CloudFront 도메인
                "http://localhost:5173"                  // 로컬 개발
            )
            .allowedMethods("GET", "POST", "PUT", "DELETE")
            .allowCredentials(true);
    }
}
```

> [!TIP]
> CORS `allowedOrigins`에 Amazon CloudFront 도메인을 추가한 뒤 백엔드를 재배포하세요.  
> Step 9-3의 GitHub Actions가 자동으로 ECS를 업데이트합니다.

### 전체 흐름 최종 확인

```
✅ 프론트엔드: CloudFront URL 접속 → Vue.js 화면 표시
✅ API 호출: 프론트엔드 → ALB → ECS Fargate → 정상 응답
✅ DB 연동: ECS Fargate → Amazon RDS → 데이터 조회/저장
✅ CI/CD: 프론트/백 각각 push → 자동 배포 → 즉시 반영
```

✅ **태스크 완료** — 3-Tier 아키텍처 전체가 CI/CD로 자동화되었습니다.

---

## 마무리

이 실습에서 다음을 성공적으로 수행했습니다:

- GitHub Actions로 Vue.js를 빌드하고 Amazon S3에 자동 배포했습니다.
- Amazon CloudFront 캐시 무효화를 파이프라인에 통합했습니다.
- Cache-Control 헤더를 최적화하여 성능과 배포 즉시성을 모두 확보했습니다.
- 프론트엔드(S3+CloudFront)와 백엔드(ECS Fargate)를 연동하여 전체 3-Tier CI/CD를 완성했습니다.

> [!TIP]
> **Step 9 전체 완성 아키텍처:**
>
> ```
> 프론트엔드 개발자:  git push → S3 + CloudFront (1~2분 내 반영)
> 백엔드 개발자:      git push → ECR → ECS Fargate (3~5분 내 반영)
> 인프라:            CloudFormation 4개 스택 (Step 8)
> ```
>
> 수동 배포 없이 코드 Push만으로 전체 서비스가 업데이트됩니다.

---

# 🗑️ 리소스 정리

> [!NOTE]
> Amazon S3 + Amazon CloudFront는 프리티어 범위 내에서 비용이 거의 발생하지 않습니다.  
> 하지만 Step 8 + Step 9 전체를 정리하려면 아래 순서를 따르세요.

### Step 9 전체 리소스 정리 순서

```
삭제 순서:

① ECS Service → Cluster → Task Definition (9-3)
② ECR Repository (9-2)
③ CloudFront Distribution → S3 Bucket (9-4)
④ Step 8 CloudFormation 스택 (backend → data → frontend → network)
```

### 이 세션(9-4)에서 생성한 리소스

이 세션에서는 GitHub Actions 워크플로우만 추가했으므로 AWS 리소스를 별도 생성하지 않았습니다.  
Amazon S3 버킷과 Amazon CloudFront Distribution은 Step 8에서 생성한 것을 재사용합니다.

### Amazon CloudFront 삭제 (필요한 경우)

1. 상단 검색창에 `CloudFront`를 입력하고 **CloudFront** 서비스를 선택합니다.
2. Distributions 목록에서 배포를 선택합니다.
3. [[Disable]]를 클릭합니다.
4. Status가 `Disabled`로 변경될 때까지 기다립니다 (5~10분).
5. [[Delete]]를 클릭합니다.

> [!WARNING]
> Amazon CloudFront는 Disable 후에만 삭제할 수 있습니다.  
> Disable 직후 즉시 삭제하면 에러가 발생하므로 5~10분 대기 후 삭제하세요.

### Amazon S3 버킷 삭제 (필요한 경우)

5. 상단 검색창에 `S3`를 입력하고 **S3** 서비스를 선택합니다.
6. Buckets 목록에서 프론트엔드 버킷을 선택합니다.
7. [[Empty]]를 클릭하여 모든 객체를 삭제합니다.
8. [[Delete]]를 클릭하여 버킷을 삭제합니다.

> [!NOTE]
> Step 8 Frontend 스택(`step8-frontend`)을 삭제하면 Amazon S3 버킷도 함께 삭제됩니다.  
> 단, 버킷이 비어있어야 스택 삭제가 성공합니다. Empty를 먼저 실행하세요.

✅ **Step 9 완료**: CI/CD + 컨테이너 배포를 모두 학습했습니다.

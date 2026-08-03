---
title: '기존 Vue.js 프론트엔드 배포 (S3 + CloudFront)'
week: 8
session: '2a'
awsServices:
  - Amazon S3
  - Amazon CloudFront
learningObjectives:
  - 기존 Vue.js 프로젝트를 AWS 배포용으로 수정할 수 있습니다.
  - Amazon S3 정적 웹 호스팅을 설정할 수 있습니다.
  - Amazon CloudFront 배포를 생성하여 CDN + HTTPS를 적용할 수 있습니다.
  - GitHub Actions로 프론트엔드 자동 배포를 구성할 수 있습니다.
prerequisites:
  - Step 8-1 완료 (인프라 구축)
  - 기존 Vue.js 프로젝트 (예: KB IT's Your Life 프론트엔드)
  - Node.js 설치 (로컬)
estimatedCost: 크레딧 내 사용 가능 (비용 발생 가능)
---

이 실습에서는 **기존 Vue.js 프로젝트**를 Amazon S3 + Amazon CloudFront로 배포합니다.
GitHub Actions를 통해 코드를 push하면 자동으로 빌드 및 배포되는 파이프라인을 구축합니다.

### Step 8 전체 아키텍처

<img src="/images/step8/8-architecture.png" alt="Step 8 3-Tier 아키텍처" class="guide-img-lg" />

> [!NOTE]
> Step 8-1에서 생성한 AWS CloudFormation Outputs 값이 필요합니다:
>
> - **S3BucketName**: 프론트엔드 파일 업로드 대상
> - **ALBDNSName**: API 호출 대상 (Step 8-3 완료 후 사용)

---

## 태스크 1: 기존 Vue.js 프로젝트 배포 준비

Step 8-1에서 클론한 `~/3tier-project/my-frontend` 디렉토리에 기존 프로젝트 코드를 넣은 경우입니다.
AWS 배포를 위해 아래 항목을 확인하고 수정합니다.

### 1-1. API URL 환경 변수 설정

1. 프로젝트 루트에 `.env.production` 파일을 생성합니다:

```bash
# .env.production
VITE_API_URL=http://<ALB_DNS_NAME>
```

> [!WARNING]
> **`/api` 중복 주의:**
> 기존 프로젝트는 API 호출 시 `/api/board`, `/api/travel` 처럼 경로에 이미 `/api`가 포함되어 있으므로
> `VITE_API_URL`에는 `/api`를 **추가하지 않습니다.**

> [!WARNING]
> **Mixed Content 에러 (HTTPS ↔ HTTP):**
>
> Amazon CloudFront(HTTPS)에서 로드된 페이지가 ALB(HTTP)로 API를 호출하면 브라우저가 차단합니다.
> Step 8-4 태스크 1에서 도메인 + ALB HTTPS 리스너를 추가한 뒤 `VITE_API_URL=https://api.<YOUR_DOMAIN>`으로 변경하면 해결됩니다.
> 그 전까지 백엔드 배포 확인은 `curl`로 직접 테스트하세요.

2. `main.js` 상단에 axios 전역 baseURL을 설정합니다:

```javascript
import axios from 'axios';
axios.defaults.baseURL = import.meta.env.VITE_API_URL || '';
```

> [!NOTE]
> `axios.defaults.baseURL`은 전역 설정입니다.
> `main.js`에서 한 번 설정하면 이후 어떤 파일에서 `import axios from 'axios'`해도 동일한 baseURL이 적용됩니다.
>
> **단, `axios.create()`로 별도 인스턴스를 사용하는 경우:**
> `src/api/index.js`에서 `axios.create()`를 사용하고 있다면 그 인스턴스에 직접 `baseURL`을 추가하세요:
>
> ```javascript
> const instance = axios.create({
>   baseURL: import.meta.env.VITE_API_URL || '', // ← 추가
>   timeout: 10000,
> });
> ```
>
> 이 경우 `main.js`의 `axios.defaults.baseURL` 설정은 불필요합니다.

> [!NOTE]
> `vite.config.js`의 `server.proxy`는 로컬 개발(`npm run dev`)에서만 동작합니다.
> 프로덕션 빌드에는 적용되지 않으므로 환경 변수 설정이 필수입니다.
> CORS 설정은 Step 8-3 태스크 4에서 백엔드(Spring)에 추가합니다.

> [!TIP]
> **실무 권장: 인터셉터에 예외 URL을 설정하고 모든 호출을 인스턴스로 통일**
>
> 아래는 예시입니다. `noAuthUrls` 배열을 본인 프로젝트의 인증 불필요 경로에 맞게 수정하세요.
>
> ```javascript
> // src/api/index.js
> instance.interceptors.request.use((config) => {
>   // 인증 불필요한 요청은 토큰을 붙이지 않음 (본인 프로젝트에 맞게 수정)
>   const noAuthUrls = ['/api/auth/login', '/api/member'];
>   const needsAuth = !noAuthUrls.some((url) => config.url.startsWith(url));
>
>   if (needsAuth) {
>     const { getToken } = useAuthStore();
>     const token = getToken();
>     if (token) {
>       config.headers['Authorization'] = `Bearer ${token}`;
>     }
>   }
>   return config;
> });
> ```
>
> 이렇게 하면 `stores/auth.js` 등에서도 `import api from '@/api'`를 사용할 수 있고,
> `axios.defaults.baseURL` 전역 설정 없이 baseURL을 한 곳(`axios.create`)에서 관리합니다.

### 1-2. 하드코딩된 API 키 분리 (해당되는 경우)

3. `main.js`에 Kakao Maps, Google Maps 등 API 키가 직접 작성되어 있다면 환경 변수로 분리합니다:

```bash
# .env.production (추가)
VITE_KAKAO_KEY=본인의_카카오_자바스크립트_키
```

```javascript
// main.js 수정
const rest_api_key = import.meta.env.VITE_KAKAO_KEY;
```

### 1-3. 빌드 테스트

4. 프로덕션 빌드가 에러 없이 완료되는지 확인합니다:

```bash
npm run build
```

5. `dist/` 폴더가 정상 생성되면 성공입니다.

✅ **태스크 완료** — 기존 Vue.js 프로젝트를 AWS 배포용으로 준비했습니다.

---

## 태스크 2: Amazon S3 버킷 정적 웹 호스팅 설정

AWS CloudFormation에서 이미 Amazon S3 버킷과 정적 웹 호스팅을 설정했습니다.
여기서는 설정을 확인하고 추가 구성을 합니다.

> [!TIP]
> Step 5-3에서 수동으로 설정했던 Block Public Access 해제, 버킷 정책, 정적 웹 호스팅 활성화를 AWS CloudFormation 템플릿에 정의하여 스택 생성 시 자동으로 설정되도록 했습니다.
> 이 태스크에서는 정상 생성되었는지 확인만 합니다.

### S3 버킷 설정 확인

> [!WARNING]
> AWS Console 우측 상단에서 리전이 **Asia Pacific (Seoul) ap-northeast-2**인지 확인하세요.

6. 상단 검색창에 `S3`를 입력하고 **S3** 서비스를 선택합니다.
7. Buckets 목록에서 `my-3tier-app-frontend-{BucketSuffix}` 버킷을 클릭합니다.
8. **Properties** 탭을 클릭합니다.
9. 페이지 하단의 **Static website hosting** 섹션에서 다음을 확인합니다:
   - **S3 static website hosting**: Enabled
   - **Hosting type**: Bucket hosting
   - **Bucket website endpoint**: URL이 표시됨

10. Index/Error document를 확인하려면 [[Edit]] 버튼을 클릭합니다:

- **Index document**: `index.html`
- **Error document**: `index.html`

11. 확인만 하고 변경하지 않으므로 [[Cancel]] 버튼을 클릭하여 나갑니다.

### Block Public Access 확인

12. **Permissions** 탭을 클릭합니다.
13. **Block public access (bucket settings)** 섹션에서 모든 항목이 **Off**인지 확인합니다.

> [!NOTE]
> AWS CloudFormation 템플릿에서 이미 Public Access를 허용하고 버킷 정책을 설정했습니다.
> 수동으로 추가 설정할 필요가 없습니다.

### 버킷 정책 확인

14. 같은 **Permissions** 탭에서 **Bucket policy** 섹션을 확인합니다.
15. 다음과 같은 정책이 설정되어 있는지 확인합니다:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::my-3tier-app-frontend-{BucketSuffix}/*"
    }
  ]
}
```

### 웹사이트 엔드포인트 확인

16. **Properties** 탭으로 돌아갑니다.
17. 페이지 하단의 **Static website hosting** 섹션에서 **Bucket website endpoint** URL을 복사합니다.
18. 브라우저에서 해당 URL로 접속합니다.

> [!OUTPUT]
> Amazon S3 웹사이트 엔드포인트 형식:
> `http://my-3tier-app-frontend-hong01.s3-website.ap-northeast-2.amazonaws.com`
>
> 접속 시 `404 Not Found` 페이지가 표시됩니다 (아직 파일을 업로드하지 않았으므로 정상).

> [!TIP]
> 이 URL은 Amazon CloudFront의 Origin으로 사용됩니다. 메모해두세요.

✅ **태스크 완료** — Amazon S3 버킷의 정적 웹 호스팅 설정을 확인했습니다.

---

## 태스크 3: 빌드 및 S3 업로드

Vue.js 프로젝트를 빌드하고 Amazon S3에 업로드합니다.

### 3-1. 프로덕션 빌드

```bash
cd ~/3tier-project/my-frontend

# 프로덕션 빌드
npm run build
```

빌드 결과물이 `dist/` 디렉토리에 생성됩니다:

```
dist/
├── index.html
├── assets/
│   ├── index-xxxxx.js
│   └── index-xxxxx.css
└── favicon.ico
```

### 3-2. Amazon S3에 업로드

```bash
# S3 버킷 이름 (Step 8-1 CloudFormation Outputs의 S3BucketName 값으로 변경)
BUCKET_NAME="my-3tier-app-frontend-hong01"

# dist 폴더를 S3에 동기화
aws s3 sync dist/ s3://$BUCKET_NAME --delete

# AWS 프로파일을 별도로 설정한 경우:
# aws s3 sync dist/ s3://$BUCKET_NAME --delete --profile <프로파일명>
```

> [!TIP]
> AWS CLI 인증이 안 되어 있다면 먼저 설정하세요:
>
> ```bash
> # 기본 프로파일 설정
> aws configure
>
> # 별도 프로파일로 설정 (여러 계정 사용 시)
> aws configure --profile <프로파일명>
> ```
>
> Access Key ID, Secret Access Key, Region(`ap-northeast-2`), Output format(`json`)을 입력합니다.

> [!NOTE]
> `--delete` 옵션은 S3에 있지만 로컬 dist에 없는 파일을 삭제합니다.
> 이전 배포의 잔여 파일을 정리하여 깔끔한 상태를 유지합니다.

### 3-3. 업로드 확인

```bash
# S3 버킷 내용 확인
aws s3 ls s3://$BUCKET_NAME --recursive
```

> [!OUTPUT]
>
> ```
> 2025-01-20 10:30:01        450 index.html
> 2025-01-20 10:30:01      48720 assets/index-a1b2c3.js
> 2025-01-20 10:30:01       1230 assets/index-d4e5f6.css
> 2025-01-20 10:30:01       4286 favicon.ico
> ```

### 3-4. 브라우저에서 확인

Amazon S3 웹사이트 엔드포인트로 접속합니다:

```
http://my-3tier-app-frontend-hong01.s3-website.ap-northeast-2.amazonaws.com
```

> [!TIP]
> 이 시점에서는 API 서버가 아직 없으므로 "API 연결 실패" 메시지가 표시됩니다.
> 이는 정상입니다. Step 8-3에서 백엔드를 배포하면 정상 동작합니다.

✅ **태스크 완료** — Vue.js를 빌드하고 Amazon S3에 업로드하여 정적 웹사이트를 확인했습니다.

> [!TROUBLESHOOTING]
> | 증상 | 원인 | 해결 방법 |
> |------|------|-----------|
> | **npm run build 실패** | 코드 문법 에러 또는 의존성 미설치 | npm install 후 에러 메시지 확인 |
> | **aws s3 sync 실패 (AccessDenied)** | AWS CLI 자격 증명 미설정 | aws configure로 Access Key 설정 |
> | **S3 업로드 성공했지만 웹사이트 접속 불가** | 정적 웹 호스팅 미활성화 | S3 Properties → Static website hosting 확인 |
> | **페이지 로드 시 빈 화면 (흰 화면)** | vite.config.js의 base 경로 문제 | base: '/' 설정 확인 |

---

## 태스크 4: Amazon CloudFront 배포 생성

S3 앞에 Amazon CloudFront를 배치하여 CDN + HTTPS를 적용합니다.

> [!TIP]
> Step 5-3에서 Amazon CloudFront + SPA 에러 페이지 설정을 경험했습니다.
> 이번에도 동일한 위저드 흐름으로 설정하되, Origin에 Step 8-1에서 생성한 S3 웹사이트 엔드포인트를 사용합니다.

### Amazon CloudFront 콘솔 이동

19. 상단 검색창에 `CloudFront`를 입력하고 **CloudFront** 서비스를 선택합니다.
20. [[Create distribution]] 버튼을 클릭합니다.

### Step 1: Choose a plan

21. **Pay as you go** (맨 아래)를 선택합니다.
22. [[Next]]를 클릭합니다.

> [!NOTE]
> **Free** 플랜(1M 요청/100GB 전송 무료, WAF/DDoS 포함)을 선택해도 이 실습에 문제없습니다.
> 본인 상황에 맞게 선택하세요. 콘솔 UI가 수시로 변경되므로 화면이 다를 수 있습니다.

### Step 2: Get started

23. **Distribution name**: `3tier-frontend` (또는 본인이 원하는 이름) 입력합니다.
24. **Description**: 비워둡니다 (선택사항).
25. **Distribution type**: `Single website or app` 선택 (기본값).
26. **Domain** 섹션: 비워둡니다 (커스텀 도메인은 태스크 6에서 설정).
27. **Tags** 섹션을 펼쳐서 다음 태그를 추가합니다:
    - `CreatedBy` = `admin-user`
    - `Step` = `step8`
    - `Session` = `8-2`
28. [[Next]]를 클릭합니다.

### Step 3: Specify origin

29. **Origin type**: `Other`를 선택합니다.

> [!WARNING]
> **`Amazon S3`를 선택하지 마세요!**
> Amazon S3를 선택하면 OAC(Origin Access Control)가 기본 활성화되어 private bucket 방식으로 동작합니다.
> 이 실습에서는 S3 **정적 웹 호스팅 엔드포인트**(public bucket)를 사용하므로 `Other`를 선택해야 합니다.

30. **Origin** 필드에 태스크 2에서 확인한 S3 웹사이트 엔드포인트를 직접 입력합니다:
    - `my-3tier-app-frontend-<BucketSuffix>.s3-website.ap-northeast-2.amazonaws.com`

31. **Origin path**: 비워둡니다.
32. **Settings** 섹션:
    - **Origin settings**: `Customize origin settings`를 선택합니다.
    - **Protocol**: `HTTP only` 선택

> [!WARNING]
> **Protocol을 반드시 `HTTP only`로 설정하세요!**
> S3 웹사이트 엔드포인트는 HTTP만 지원합니다.
> `Use recommended origin settings`(기본값)를 그대로 두면 Protocol이 `HTTPS only`로 설정되어 **504 Gateway Timeout**이 발생합니다.

33. **Cache settings**: `Customize cache settings` 선택
34. **Viewer protocol policy**: `Redirect HTTP to HTTPS` 선택
35. **Allowed HTTP methods**: `GET, HEAD` (기본값 유지)
36. **Cache policy**: `CachingOptimized` (기본값 — "Recommended for S3" 표시)
37. **Origin request policy**: 비워둡니다 (Select origin policy 그대로).
38. **Response headers policy**: 비워둡니다.
39. [[Next]]를 클릭합니다.

### Step 4: Enable security

40. **Web Application Firewall (WAF)**: `Do not enable security protections` 선택

> [!WARNING]
> `Enable security protections`를 선택하면 **AWS WAF 비용이 월 $14 이상** 발생할 수 있습니다 (조건에 따라 달라집니다).
> 학습용 실습에서는 반드시 `Do not enable security protections`를 선택하세요.

41. [[Next]]를 클릭합니다.

### Step 5: Review and create

42. 설정 내용을 확인하고 [[Create distribution]] 버튼을 클릭합니다.

> [!OUTPUT]
> "Successfully created new distribution." 녹색 배너가 표시됩니다.
> Distribution 상세 페이지로 이동되며 **Last modified**가 `Deploying` 상태입니다.
>
> - **Distribution domain name**: `d1234abcdef.cloudfront.net` 형태 (메모해 두세요)
> - **Distribution ID**: `E1A2B3C4D5E6F7` 형태 (메모해 두세요)
> - **Status**: `Deploying` → 5~10분 후 완료

### Default root object 설정 (필수)

> [!WARNING]
> 새 콘솔 위저드에서는 Default root object가 자동 설정되지 않습니다.
> 이 설정을 하지 않으면 `https://d1234abcdef.cloudfront.net/` 접속 시 **AccessDenied** 에러가 발생합니다.

43. 생성 직후 상세 페이지의 **General** 탭 → **Settings** 섹션에서 [[Edit]] 버튼을 클릭합니다.
44. **Default root object** 필드에 `index.html`을 입력합니다.
45. **Price class**를 `Use only North America and Europe`로 변경합니다 (비용 절약, 선택사항).
46. [[Save changes]]를 클릭합니다.

> [!TIP]
> **Price class**는 Amazon CloudFront가 콘텐츠를 배포할 엣지 로케이션 범위를 결정합니다.
> 학습용이므로 가장 저렴한 `Use only North America and Europe`로 충분합니다.
> 실제 서비스에서 한국 사용자가 주 대상이라면 `Use all edge locations`를 선택하세요.

> [!NOTE]
> Amazon CloudFront 배포 생성에 약 **5~10분**이 소요됩니다.
> Status가 `Enabled`로 변경되고, Last modified에 날짜가 표시되면 배포가 완료된 것입니다.

### 에러 페이지 설정 (SPA 라우팅)

배포가 생성된 후, SPA 라우팅을 위한 커스텀 에러 응답을 설정합니다.

47. 생성된 Distribution 상세 페이지에서 **Error pages** 탭을 클릭합니다.
48. [[Create custom error response]] 버튼을 클릭합니다.
49. 다음과 같이 설정합니다:
    - **HTTP error code**: `403` 선택
    - **Customize error response**: `Yes` 선택
    - **Response page path**: `/index.html` 입력
    - **HTTP response code**: `200` 선택
50. [[Create custom error response]] 버튼을 클릭하여 저장합니다.

51. 같은 방식으로 [[Create custom error response]]를 한 번 더 클릭하여 `404` 에러도 추가합니다:
    - **HTTP error code**: `404` 선택
    - **Customize error response**: `Yes` 선택
    - **Response page path**: `/index.html` 입력
    - **HTTP response code**: `200` 선택
52. [[Create custom error response]] 버튼을 클릭하여 저장합니다.

> [!CONCEPT] SPA 라우팅과 에러 페이지 설정
>
> Vue Router의 `createWebHistory()`는 `/items` 같은 경로를 사용합니다.
> 사용자가 `/items`를 직접 입력하면 Amazon CloudFront는 S3에서 `/items` 파일을 찾지만, 실제로는 존재하지 않아 403/404 에러가 발생합니다.
> 에러 페이지를 `/index.html`로 설정하면, 모든 경로에서 Vue.js가 로드되고 클라이언트 측 라우터가 올바른 페이지를 렌더링합니다.

### Amazon CloudFront URL 접속 확인

53. Status가 `Enabled`로 변경되었는지 확인합니다 (약 5~10분 소요).
54. **Distribution domain name**을 복사합니다 (예: `d1234abcdef.cloudfront.net`).
55. 브라우저에서 `https://d1234abcdef.cloudfront.net`으로 접속합니다.
56. Vue.js 앱이 HTTPS로 정상 로드되는지 확인합니다.
57. 주소창에 `https://d1234abcdef.cloudfront.net/<본인 프로젝트의 하위 경로>`를 직접 입력하여 SPA 라우팅이 동작하는지 확인합니다 (예: `/board`, `/travel`, `/about` 등).

> [!OUTPUT]
> Amazon CloudFront 배포가 완료되었습니다:
>
> - **Distribution ID**: `E1A2B3C4D5E6F7` (메모 — GitHub Secrets에 사용)
> - **Distribution domain name**: `d1234abcdef.cloudfront.net`
> - **Status**: `Enabled`
> - 브라우저에서 Vue.js 앱이 🔒 HTTPS로 로드됩니다.

> [!TIP]
> Amazon CloudFront 도메인 이름을 메모해두세요.
> Step 8-3 태스크 4에서 백엔드의 CORS 설정에 사용합니다.

✅ **태스크 완료** — Amazon CloudFront 배포를 생성하여 CDN + HTTPS를 적용했습니다.

> [!TROUBLESHOOTING]
> | 증상 | 원인 | 해결 방법 |
> |------|------|-----------|
> | Amazon CloudFront URL 접속 시 `AccessDenied` | S3 버킷 정책 미설정 또는 Origin 설정 오류 | S3 웹사이트 엔드포인트를 Origin으로 사용했는지 확인 |
> | `/board` 직접 접속 시 403/404 에러 | 에러 페이지 설정 누락 | Custom Error Response에 403, 404 → `/index.html` (200) 추가 |
> | HTTPS 접속 불가 (ERR_SSL_PROTOCOL_ERROR) | Viewer Protocol Policy 설정 오류 | `Redirect HTTP to HTTPS` 선택 확인 |
> | 배포 생성 후 10분 이상 `InProgress` | 정상 동작 (전 세계 엣지 배포 중) | 최대 15분 대기, Status가 `Enabled`로 변경되면 완료 |
> | 이전 버전이 계속 표시됨 | Amazon CloudFront 캐시 | `Invalidation` 생성: `/*` 경로로 캐시 무효화 |

---

## 태스크 5: GitHub Actions 자동 배포

코드를 push하면 자동으로 빌드 → S3 업로드 → Amazon CloudFront 캐시 무효화가 실행되는 파이프라인을 구축합니다.

구성 요소:

- **IAM 사용자**: GitHub Actions가 AWS에 접근할 때 사용하는 인증 정보 (Access Key)
- **GitHub Secrets**: IAM 키, 버킷명, Distribution ID 등을 안전하게 저장
- **워크플로우 파일**: push 이벤트 시 빌드 → 배포 → 캐시 무효화를 자동 실행

### IAM 사용자 생성 (GitHub Actions용)

58. 상단 검색창에 `IAM`을 입력하고 **IAM** 서비스를 선택합니다.
59. 왼쪽 메뉴에서 **IAM Users**를 클릭합니다.
60. [[Create user]]를 클릭합니다.
61. **User name**: `github-actions-frontend`를 입력합니다.
62. **Provide user access to the AWS Management Console** 체크를 **하지 않습니다** (콘솔 접근 불필요).
63. [[Next]]를 클릭합니다.
64. **Permissions options**에서 `Attach policies directly`를 선택합니다.
65. 검색창에 `S3`를 입력하고 `AmazonS3FullAccess`를 체크합니다.
66. 검색창을 지우고 `CloudFront`를 입력하고 `CloudFrontFullAccess`를 체크합니다.
67. [[Next]]를 클릭합니다.
68. **Review and create** 페이지에서 설정을 확인합니다:
    - User name: `github-actions-frontend`
    - Permissions: `AmazonS3FullAccess`, `CloudFrontFullAccess`
69. [[Create user]]를 클릭합니다.

### Access Key 생성

70. 생성된 `github-actions-frontend` 사용자를 클릭하여 상세 페이지로 이동합니다.
71. **Security credentials** 탭을 클릭합니다.
72. **Access keys** 섹션에서 [[Create access key]]를 클릭합니다.
73. **Use case**에서 `Third-party service`를 선택합니다.
74. 하단의 확인 체크박스를 선택하고 [[Next]]를 클릭합니다.
75. [[Create access key]]를 클릭합니다.
76. **Access key ID**와 **Secret access key**를 복사하여 안전한 곳에 저장합니다.

> [!WARNING]
> Secret access key는 이 화면에서만 확인할 수 있습니다.
> 페이지를 닫으면 다시 볼 수 없으므로 반드시 복사하여 저장하세요.

### GitHub Secrets 설정

77. 브라우저에서 GitHub → `my-frontend` 리포지토리 페이지로 이동합니다.
78. **Settings** 탭을 클릭합니다.
79. 왼쪽 메뉴에서 **Secrets and variables** → **Actions**를 클릭합니다.
80. [[New repository secret]] 버튼을 클릭합니다.
81. 다음 Secrets를 하나씩 추가합니다:
    - `AWS_ACCESS_KEY_ID`: 76번에서 복사한 Access Key ID
    - `AWS_SECRET_ACCESS_KEY`: 76번에서 복사한 Secret Access Key
    - `AWS_REGION`: `ap-northeast-2`
    - `S3_BUCKET_NAME`: `<Step 8-1 CloudFormation Outputs의 S3BucketName 값>`
    - `CLOUDFRONT_DISTRIBUTION_ID`: `<태스크 4에서 메모한 Distribution ID (예: E1A2B3C4D5E6F7)>`
    - `VITE_API_URL`: `http://<ALBDNSName>` (`/api` 붙이지 않음)
    - (추가 환경변수가 있다면) `VITE_KAKAO_KEY`, `VITE_API_KEY` 등 본인 프로젝트에서 사용하는 `VITE_` 변수를 동일하게 등록

> [!WARNING]
> 워크플로우에서 `VITE_API_URL`을 Secrets로 주입하므로 `.env.production`은 git에 포함하지 않아도 됩니다.
> 기존 프로젝트에서 `VITE_KAKAO_KEY` 등 추가 환경변수가 있다면:
>
> 1. `.gitignore`에 추가합니다:
>    ```gitignore
>    .env.production
>    .env.local
>    ```
> 2. 이미 git에 추적 중이었다면 캐시를 삭제합니다:
>    ```bash
>    git rm --cached .env.production
>    git commit -m "chore: remove .env.production from tracking"
>    ```
> 3. GitHub Secrets에 해당 변수를 등록합니다.
> 4. 워크플로우 빌드 스텝의 `env`에 추가합니다.

### GitHub Actions 워크플로우 작성

82. 프론트엔드 리포지토리 루트에 `.github/workflows/deploy.yml` 파일을 생성합니다:

```yaml
# .github/workflows/deploy.yml
name: Deploy Frontend to S3 + CloudFront

on:
  push:
    branches: [main]
    paths:
      - 'src/**'
      - 'public/**'
      - 'package.json'
      - 'vite.config.js'
      - '.github/workflows/deploy.yml'

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      # 1. 소스 코드 체크아웃
      - name: Checkout source code
        uses: actions/checkout@v4

      # 2. Node.js 설정
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'

      # 3. 의존성 설치
      - name: Install dependencies
        run: npm ci

      # 4. 프로덕션 빌드
      - name: Build for production
        run: npm run build
        env:
          VITE_API_URL: ${{ secrets.VITE_API_URL }}
          # 추가 환경변수가 있다면 여기에 등록
          # VITE_KAKAO_KEY: ${{ secrets.VITE_KAKAO_KEY }}
          # VITE_API_KEY: ${{ secrets.VITE_API_KEY }}

      # 5. AWS 자격 증명 설정
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ secrets.AWS_REGION }}

      # 6. S3에 배포
      - name: Deploy to S3
        run: |
          aws s3 sync dist/ s3://${{ secrets.S3_BUCKET_NAME }} \
            --delete \
            --cache-control "public, max-age=31536000" \
            --exclude "index.html"

          aws s3 cp dist/index.html s3://${{ secrets.S3_BUCKET_NAME }}/index.html \
            --cache-control "no-cache, no-store, must-revalidate"

      # 7. Amazon CloudFront 캐시 무효화
      - name: Invalidate CloudFront cache
        run: |
          aws cloudfront create-invalidation \
            --distribution-id ${{ secrets.CLOUDFRONT_DISTRIBUTION_ID }} \
            --paths "/*"

      # 8. 배포 완료 확인
      - name: Deployment complete
        run: |
          echo "✅ Frontend deployed successfully!"
          echo "S3 Bucket: ${{ secrets.S3_BUCKET_NAME }}"
          echo "CloudFront will update within 1-2 minutes."
```

> [!CONCEPT] 캐시 전략 설명
>
> - **정적 자산** (JS, CSS, 이미지): `max-age=31536000` (1년) — 파일명에 해시가 포함되어 변경 시 새 파일명 생성
> - **index.html**: `no-cache` — 항상 최신 버전을 가져옴
>
> 이 전략으로 빠른 로딩 속도와 즉시 업데이트를 동시에 달성합니다.

### 배포 테스트

83. 변경사항을 커밋하고 push합니다:

```bash
cd ~/3tier-project/my-frontend

git add .
git commit -m "feat: initial frontend with CI/CD"
git push origin main
```

84. GitHub 리포지토리 페이지에서 **Actions** 탭을 클릭합니다.
85. 방금 트리거된 워크플로우를 클릭합니다.
86. 모든 스텝이 ✅ 성공하면 Amazon CloudFront URL에서 최신 버전을 확인합니다.

> [!OUTPUT]
> GitHub Actions 워크플로우 실행 결과:
>
> ```
> ✅ Checkout source code           (2s)
> ✅ Setup Node.js                  (5s)
> ✅ Install dependencies           (15s)
> ✅ Build for production           (8s)
> ✅ Configure AWS credentials      (1s)
> ✅ Deploy to S3                   (5s)
> ✅ Invalidate CloudFront cache    (2s)
> ✅ Deployment complete            (1s)
> ```
>
> 전체 실행 시간: 약 40초~1분

✅ **태스크 완료** — GitHub Actions로 프론트엔드 자동 배포 파이프라인을 구축했습니다.

> [!TROUBLESHOOTING]
> | 증상 | 원인 | 해결 방법 |
> |------|------|-----------|
> | `AccessDenied` (S3 sync 단계) | IAM 사용자에 S3 권한 없음 | `AmazonS3FullAccess` 정책 연결 확인 |
> | `AccessDenied` (CloudFront invalidation) | IAM 사용자에 CloudFront 권한 없음 | `CloudFrontFullAccess` 정책 연결 확인 |
> | `InvalidArgument: Distribution ID` | `CLOUDFRONT_DISTRIBUTION_ID` Secret 값 오류 | CloudFront 콘솔에서 ID 재확인 (예: `E1A2B3C4D5E6F7`) |
> | 배포 성공했지만 변경 미반영 | Amazon CloudFront 캐시 전파 지연 | 1~2분 대기 후 브라우저 강력 새로고침 (Ctrl+Shift+R) |
> | `npm ci` 실패 | `package-lock.json` 미커밋 | `git add package-lock.json && git commit` 후 재push |

---

## 태스크 6: Amazon CloudFront에 커스텀 도메인 연결 (선택)

> [!NOTE]
> 이 태스크는 Step 7-1에서 Amazon Route 53 Hosted Zone과 ACM 인증서를 발급한 경우에 진행합니다.
> 도메인이 없다면 Amazon CloudFront 기본 URL(`d1234abcdef.cloudfront.net`)로 사용해도 됩니다.

Step 7-1에서 발급한 ACM 인증서를 Amazon CloudFront에 연결하고,
Amazon Route 53 A 레코드를 추가하여 `app.mydomain.shop` 같은 커스텀 도메인으로 접속할 수 있도록 합니다.

### ACM 인증서 확인 (us-east-1)

> [!WARNING]
> Amazon CloudFront에 사용할 인증서는 반드시 **us-east-1 (버지니아 북부)** 리전에서 발급해야 합니다.
> Step 7-1에서 서울 리전(ap-northeast-2)에만 발급했다면, us-east-1에서 추가 발급이 필요합니다.

87. AWS Console 우측 상단에서 리전을 **US East (N. Virginia) us-east-1**로 변경합니다.
88. 상단 검색창에 `Certificate Manager`를 입력하고 **Certificate Manager** 서비스를 선택합니다.
89. `mydomain.shop` 또는 `*.mydomain.shop` 인증서가 **Issued** 상태인지 확인합니다.
90. 인증서가 없다면 Step 7-1과 동일한 방법으로 인증서를 요청합니다 (DNS 검증).

### Amazon CloudFront에 CNAME + 인증서 연결

91. 상단 검색창에 `CloudFront`를 입력하고 **CloudFront** 서비스를 선택합니다.
92. Distributions 목록에서 태스크 4에서 생성한 배포를 클릭합니다.
93. **General** 탭에서 [[Edit]] 버튼을 클릭합니다.
94. **Alternate domain name (CNAME)** 섹션에서 [[Add item]]을 클릭합니다.
95. 도메인을 입력합니다: `app.<mydomain.shop>` (본인 도메인으로 변경)
96. **Custom SSL certificate** 드롭다운에서 us-east-1에서 발급한 인증서를 선택합니다.
97. [[Save changes]] 버튼을 클릭합니다.

### Amazon Route 53 A 레코드 추가

98. 상단 검색창에 `Route 53`을 입력하고 **Route 53** 서비스를 선택합니다.
99. 왼쪽 메뉴에서 **Hosted zones**를 클릭합니다.
100.  본인의 도메인을 클릭합니다.
101.  [[Create record]] 버튼을 클릭합니다.
102.  다음과 같이 설정합니다:
      - **Record name**: `app` (결과: `app.mydomain.shop`)
      - **Record type**: `A`
      - **Alias**: ✅ 토글 ON
      - **Route traffic to**:
        - 첫 번째 드롭다운(Choose endpoint): `Alias to CloudFront distribution` 선택
        - 두 번째 드롭다운(Choose distribution): 본인의 Distribution 도메인(`d1234abcdef.cloudfront.net`)을 선택
103.  [[Create records]] 버튼을 클릭합니다.

### 커스텀 도메인 접속 확인

104. 브라우저에서 `https://app.<mydomain.shop>`으로 접속합니다.
105. 🔒 자물쇠 아이콘이 표시되고 Vue.js 화면이 로드되면 성공입니다.

> [!TROUBLESHOOTING]
> | 증상 | 원인 | 해결 방법 |
> |------|------|-----------|
> | ERR_SSL_PROTOCOL_ERROR | 인증서 미연결 또는 리전 오류 | us-east-1 인증서 확인 |
> | 403 Forbidden | CNAME 미설정 | CloudFront Alternate domain name 확인 |
> | DNS 접속 안 됨 | Route 53 레코드 미생성 | A 레코드 Alias 확인 |

✅ **태스크 완료** — Amazon CloudFront에 커스텀 도메인과 HTTPS를 적용했습니다.

---

# 🗑️ 리소스 정리

> [!WARNING]
> 이 세션에서 생성한 리소스를 지금 삭제하지 마세요!
> Step 8-3, 8-4에서 계속 사용합니다.
> **Step 8-4에서 전체 정리합니다.**

✅ **실습 종료**: Step 8-3에서 백엔드를 배포합니다.

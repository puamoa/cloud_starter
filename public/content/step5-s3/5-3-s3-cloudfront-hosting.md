---
title: 'Amazon S3 + CloudFront 정적 웹 호스팅'
week: 5
session: 3
awsServices:
  - Amazon S3
  - Amazon CloudFront
learningObjectives:
  - S3 정적 웹 호스팅을 설정할 수 있습니다.
  - CloudFront 배포를 생성하여 CDN과 HTTPS를 적용할 수 있습니다.
  - OAC(Origin Access Control)로 S3 직접 접근을 차단할 수 있습니다.
  - SPA 라우팅을 위한 에러 페이지 설정을 구성할 수 있습니다.
prerequisites:
  - AWS 계정 생성 완료
  - S3 버킷 생성 경험 (Step 5-1 참조)
estimatedCost: 크레딧 내 사용 가능 (비용 매우 저렴)
---

이 실습에서는 Vue.js로 빌드한 SPA(Single Page Application)를 S3에 업로드하고, CloudFront CDN을 연결하여 HTTPS + 전 세계 엣지 캐싱을 적용합니다.  
EC2 없이도 웹사이트를 전 세계에 빠르게 서빙할 수 있는 서버리스 호스팅 방식을 체험합니다.

> [!NOTE]
> 이 실습은 독립적으로 진행할 수 있습니다. Vue.js 빌드 파일이 없다면 간단한 HTML 파일로 대체해도 됩니다. Step 9에서 GitHub Actions CI/CD를 구성할 때 이 경험이 그대로 활용됩니다.

> [!CONCEPT] EC2 vs S3+CloudFront 정적 호스팅
> EC2에 Nginx를 설치하여 정적 파일을 서빙하는 방식과, S3 + CloudFront를 사용하는 서버리스 방식을 비교합니다.
> 정적 사이트(SPA)에는 S3 + CloudFront가 비용, 성능, 관리 모든 면에서 유리합니다.
>
> ```
> ┌─── EC2 방식 ───────────────────────────────────────────┐
> │                                                         │
> │  사용자 → ALB → EC2 (Nginx) → 정적 파일 (디스크)       │
> │                                                         │
> │  • OS 패치, Nginx 설정, Auto Scaling 모두 직접 관리    │
> │  • HTTPS: ACM + ALB 별도 구성 필요                     │
> │  • 단일 리전에서만 서빙                                │
> └─────────────────────────────────────────────────────────┘
>
> ┌─── S3 + CloudFront 방식 ────────────────────────────────┐
> │                                                          │
> │  사용자 → CloudFront (엣지) → S3 (원본 저장소)          │
> │                                                          │
> │  • 서버 관리 없음 (완전 서버리스)                       │
> │  • HTTPS: CloudFront 기본 제공                          │
> │  • 전 세계 400+ 엣지 로케이션에서 캐싱                 │
> └──────────────────────────────────────────────────────────┘
> ```

| 항목        | EC2 + Nginx              | S3 + CloudFront       |
| ----------- | ------------------------ | --------------------- |
| 서버 관리   | OS 패치, Nginx 설정 필요 | 없음 (서버리스)       |
| 확장        | Auto Scaling 설정 필요   | 자동 (무제한)         |
| HTTPS       | ACM + ALB 필요           | CloudFront 기본 제공  |
| 비용        | EC2 시간당 과금          | 요청 기반 (매우 저렴) |
| 속도        | 단일 리전                | 전 세계 엣지 캐싱     |
| 적합한 경우 | SSR, 동적 콘텐츠         | SPA, 정적 사이트      |

---

## 태스크 1: S3 정적 웹 호스팅 설정

S3 버킷을 생성하고, Block Public Access를 해제한 뒤, 버킷 정책으로 퍼블릭 읽기를 허용하고, 정적 웹 호스팅을 활성화합니다.

> [!CONCEPT] S3 정적 웹 호스팅이란?
> S3 버킷을 웹 서버처럼 사용하는 기능입니다. HTML, CSS, JS 파일을 업로드하면 HTTP 엔드포인트로 접근할 수 있습니다.
>
> ```
> ┌─────────────────────────────────────────────────────────────┐
> │                    S3 정적 웹 호스팅                         │
> │                                                             │
> │  브라우저 요청                                              │
> │       │                                                     │
> │       ▼                                                     │
> │  http://bucket-name.s3-website.ap-northeast-2.amazonaws.com │
> │       │                                                     │
> │       ▼                                                     │
> │  ┌─────────────────────────────────┐                        │
> │  │  S3 Bucket                      │                        │
> │  │  ├── index.html  (기본 문서)    │                        │
> │  │  ├── error.html  (에러 문서)    │                        │
> │  │  ├── css/style.css              │                        │
> │  │  └── js/app.js                  │                        │
> │  └─────────────────────────────────┘                        │
> │                                                             │
> │  • HTTP만 지원 (HTTPS는 CloudFront 필요)                   │
> │  • Index Document: / 요청 시 반환할 파일                    │
> │  • Error Document: 404 시 반환할 파일                       │
> └─────────────────────────────────────────────────────────────┘
> ```
>
> **3가지 필수 설정:**
>
> 1. Block Public Access 해제 → 외부 접근 허용의 "잠금 해제"
> 2. 버킷 정책 추가 → 실제로 누구에게 어떤 권한을 줄지 정의
> 3. 정적 웹 호스팅 활성화 → HTTP 엔드포인트 생성

### S3 버킷 생성

1. AWS Management Console에 로그인합니다.
2. 우측 상단에서 리전을 **Asia Pacific (Seoul) ap-northeast-2**로 설정합니다.

    <img src="/images/common/region-check.png" alt="리전 확인" class="guide-img-sm" />

3. 상단 검색창에 `S3`를 입력하고 **S3** 서비스를 선택합니다.
4. [[Create bucket]] 버튼을 클릭합니다.
5. 다음과 같이 설정합니다:
   - **Bucket type**: `General purpose`
   - **Bucket name**: `my-spa-hosting-{계정ID}` (전 세계 고유해야 함)
   - **AWS Region**: `Asia Pacific (Seoul) ap-northeast-2`

> [!TIP]
> 버킷 이름은 전 세계에서 고유해야 합니다. `{계정ID}` 부분을 본인의 AWS 계정 ID(12자리 숫자)로 교체하세요.
> 예: `my-spa-hosting-123456789012`
>
> 계정 ID 확인: 콘솔 우측 상단 계정 이름 클릭 → Account ID 복사

### Block Public Access 해제

6. **Block Public Access settings for this bucket** 섹션으로 스크롤합니다.
7. **Block all public access** 체크박스를 **해제**합니다 (체크 해제).
8. 아래에 나타나는 경고 메시지의 **I acknowledge that the current settings might result in this bucket and the objects within becoming public.** 체크박스를 **선택**합니다.

> [!WARNING]
> Block Public Access를 해제하면 버킷 정책에 따라 누구나 파일에 접근할 수 있습니다.
> 정적 웹 호스팅 용도이므로 의도된 설정이지만, **민감한 데이터가 포함된 버킷에는 절대 이 설정을 하지 마세요.**

9. 나머지 설정은 기본값을 유지합니다:
   - **Object Ownership**: `ACLs disabled (recommended)`
   - **Bucket Versioning**: `Disable`
   - **Default encryption**: `Server-side encryption with Amazon S3 managed keys (SSE-S3)`
   - **Bucket Key**: `Enable`
10. **Tags** 섹션에서 [[Add tag]]를 클릭하여 다음 태그를 추가합니다:

| Key         | Value        |
| ----------- | ------------ |
| `CreatedBy` | `admin-user` |
| `Step`      | `step5`      |
| `Session`   | `5-3`        |

11. [[Create bucket]] 버튼을 클릭합니다.

> [!OUTPUT]
> "Successfully created bucket "my-spa-hosting-123456789012"" 메시지가 표시됩니다.
> Buckets 목록에서 방금 생성한 버킷을 확인할 수 있습니다.

### 정적 웹 호스팅 활성화

12. Buckets 목록에서 방금 생성한 `my-spa-hosting-{계정ID}` 버킷을 클릭합니다.
13. **Properties** 탭을 클릭합니다.
14. 페이지 맨 아래로 스크롤하여 **Static website hosting** 섹션을 찾습니다.
15. [[Edit]] 버튼을 클릭합니다.
16. 다음과 같이 설정합니다:
    - **Static website hosting**: `Enable` 선택
    - **Hosting type**: `Host a static website` 선택
    - **Index document**: `index.html`
    - **Error document**: `index.html`

> [!TIP]
> **Error document를 `index.html`로 설정하는 이유:**
>
> SPA(Single Page Application)는 클라이언트 사이드 라우팅을 사용합니다.
> `/about`, `/users/123` 같은 경로는 실제 파일이 아니라 JavaScript가 처리하는 가상 경로입니다.
> S3는 해당 경로에 파일이 없으면 404를 반환하는데, Error document를 `index.html`로 설정하면
> 모든 404 요청이 `index.html`로 리다이렉트되어 SPA 라우터가 정상 동작합니다.

17. [[Save changes]] 버튼을 클릭합니다.

> [!OUTPUT]
> Static website hosting이 Enabled로 변경됩니다.
> **Bucket website endpoint** URL이 표시됩니다:
> `http://my-spa-hosting-123456789012.s3-website.ap-northeast-2.amazonaws.com`
> 이 URL을 메모해 두세요.

### 버킷 정책 추가 (퍼블릭 읽기 허용)

18. **Permissions** 탭을 클릭합니다.
19. **Bucket policy** 섹션에서 [[Edit]] 버튼을 클릭합니다.
20. **Policy** 편집기에 다음 JSON을 입력합니다:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::my-spa-hosting-{계정ID}/*"
    }
  ]
}
```

> [!WARNING]
> `my-spa-hosting-{계정ID}` 부분을 본인의 실제 버킷 이름으로 교체하세요.
> 예: `"Resource": "arn:aws:s3:::my-spa-hosting-123456789012/*"`
> 끝에 `/*`를 빠뜨리면 객체에 대한 접근이 허용되지 않습니다.

21. [[Save changes]] 버튼을 클릭합니다.

> [!OUTPUT]
> 정책이 저장되면 Permissions 탭 상단에 **"Publicly accessible"** 배지가 빨간색으로 표시됩니다.
> 이는 버킷이 퍼블릭으로 접근 가능하다는 의미이며, 정적 웹 호스팅에서는 정상입니다.

> [!CONCEPT] Block Public Access vs 버킷 정책의 관계
>
> ```
> ┌─────────────────────────────────────────────────────┐
> │              접근 제어 2단계 구조                     │
> │                                                     │
> │  요청 → [Block Public Access] → [Bucket Policy]    │
> │              (1차 잠금)           (2차 규칙)         │
> │                                                     │
> │  • Block Public Access = 건물 현관 잠금장치         │
> │    → ON이면 어떤 정책을 써도 퍼블릭 접근 불가       │
> │    → OFF여야 정책이 효력을 가짐                     │
> │                                                     │
> │  • Bucket Policy = 각 방의 출입 규칙                │
> │    → 누가(Principal), 무엇을(Action) 할 수 있는지   │
> │    → Block Public Access가 OFF일 때만 동작          │
> └─────────────────────────────────────────────────────┘
> ```

✅ **태스크 완료**: S3 버킷에 정적 웹 호스팅이 설정되었습니다. (Block Public Access 해제 + 버킷 정책 + 정적 웹 호스팅 활성화)

---

## 태스크 2: Vue.js 빌드 파일 S3 업로드

AWS CLI를 사용하여 Vue.js 빌드 결과물을 S3 버킷에 업로드합니다.

> [!CONCEPT] Vue.js 빌드와 S3 업로드 흐름
>
> ```
> ┌─────────────────────────────────────────────────────────┐
> │                  빌드 → 업로드 흐름                      │
> │                                                         │
> │  소스 코드 (src/)                                       │
> │       │                                                 │
> │       ▼  npm run build                                  │
> │  빌드 결과 (dist/)                                      │
> │  ├── index.html                                         │
> │  ├── assets/                                            │
> │  │   ├── index-abc123.js    (번들된 JS)                │
> │  │   └── index-def456.css   (번들된 CSS)               │
> │  └── favicon.ico                                        │
> │       │                                                 │
> │       ▼  aws s3 sync                                    │
> │  S3 Bucket                                              │
> │  ├── index.html                                         │
> │  ├── assets/index-abc123.js                             │
> │  ├── assets/index-def456.css                            │
> │  └── favicon.ico                                        │
> └─────────────────────────────────────────────────────────┘
> ```
>
> `npm run build`는 Vue.js 소스를 브라우저가 실행할 수 있는 정적 파일로 변환합니다.
> `aws s3 sync`는 로컬 폴더와 S3 버킷을 동기화하여 변경된 파일만 업로드합니다.

### Vue.js 프로젝트 빌드

> [!NOTE]
> Vue.js 프로젝트가 없다면 이 단계를 건너뛰고, 태스크 1에서 사용한 간단한 HTML 파일을 업로드해도 됩니다.
> 그 경우 아래 "HTML 파일로 대체하기" 섹션을 참고하세요.

22. 터미널에서 Vue.js 프로젝트 디렉토리로 이동합니다:

```bash
cd ~/your-vue-project
```

23. 프로젝트를 빌드합니다:

```bash
npm run build
```

> [!OUTPUT]
>
> ```
> vite v5.x.x building for production...
> ✓ 42 modules transformed.
> dist/index.html                  0.45 kB │ gzip:  0.30 kB
> dist/assets/index-abc123.css     1.23 kB │ gzip:  0.65 kB
> dist/assets/index-def456.js     48.72 kB │ gzip: 15.83 kB
> ✓ built in 1.23s
> ```
>
> `dist/` 폴더에 빌드 결과물이 생성됩니다.

24. 빌드 결과물을 확인합니다:

```bash
ls dist/
```

> [!OUTPUT]
>
> ```
> assets/  favicon.ico  index.html
> ```

### AWS CLI로 S3에 업로드

25. AWS CLI가 설치되어 있는지 확인합니다:

```bash
aws --version
```

> [!OUTPUT]
>
> ```
> aws-cli/2.x.x Python/3.x.x ...
> ```
>
> 설치되어 있지 않다면 [AWS CLI 설치 가이드](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)를 참고하세요.

26. AWS CLI 자격 증명이 설정되어 있는지 확인합니다:

```bash
aws sts get-caller-identity
```

> [!OUTPUT]
>
> ```json
> {
>   "UserId": "AIDAXXXXXXXXXXXXXXXXX",
>   "Account": "123456789012",
>   "Arn": "arn:aws:iam::123456789012:user/admin-user"
> }
> ```

27. `dist/` 폴더의 내용을 S3 버킷에 동기화합니다:

```bash
aws s3 sync dist/ s3://my-spa-hosting-{계정ID} --delete
```

> [!TIP]
> **`aws s3 sync` 명령어 옵션 설명:**
>
> - `dist/`: 업로드할 로컬 폴더
> - `s3://my-spa-hosting-{계정ID}`: 대상 S3 버킷
> - `--delete`: S3에는 있지만 로컬에 없는 파일을 삭제 (완전 동기화)
>
> `--delete` 옵션을 사용하면 이전 배포의 잔여 파일이 자동으로 정리됩니다.

> [!OUTPUT]
>
> ```
> upload: dist/index.html to s3://my-spa-hosting-123456789012/index.html
> upload: dist/assets/index-abc123.js to s3://my-spa-hosting-123456789012/assets/index-abc123.js
> upload: dist/assets/index-def456.css to s3://my-spa-hosting-123456789012/assets/index-def456.css
> upload: dist/favicon.ico to s3://my-spa-hosting-123456789012/favicon.ico
> ```

28. 업로드된 파일을 확인합니다:

```bash
aws s3 ls s3://my-spa-hosting-{계정ID} --recursive
```

> [!OUTPUT]
>
> ```
> 2024-01-15 10:30:01        450 index.html
> 2024-01-15 10:30:01       1230 assets/index-abc123.css
> 2024-01-15 10:30:01      48720 assets/index-def456.js
> 2024-01-15 10:30:01       4286 favicon.ico
> ```

### S3 웹사이트 엔드포인트로 접속 확인

29. 브라우저에서 S3 웹사이트 엔드포인트로 접속합니다:

```
http://my-spa-hosting-{계정ID}.s3-website.ap-northeast-2.amazonaws.com
```

> [!OUTPUT]
> Vue.js 앱(또는 업로드한 HTML 페이지)이 정상적으로 표시됩니다.
> 브라우저 주소창에 **http://** (자물쇠 없음)로 표시됩니다.

> [!WARNING]
> S3 웹사이트 엔드포인트는 **HTTP만** 지원합니다. HTTPS가 필요하면 CloudFront를 연결해야 합니다.
> 다음 태스크에서 CloudFront를 설정합니다.

### HTML 파일로 대체하기 (Vue.js 프로젝트가 없는 경우)

Vue.js 프로젝트가 없다면 다음과 같이 간단한 파일을 만들어 업로드합니다:

```bash
mkdir ~/s3-website && cd ~/s3-website

cat > index.html << 'EOF'
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>S3 + CloudFront 호스팅 테스트</title>
  <style>
    body { font-family: sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
    h1 { color: #0972d3; }
    .info { background: #f0f8ff; padding: 15px; border-radius: 8px; margin: 20px 0; }
  </style>
</head>
<body>
  <h1>🚀 S3 + CloudFront 정적 호스팅</h1>
  <p>이 페이지는 Amazon S3에 저장되고, CloudFront CDN을 통해 서빙됩니다.</p>
  <div class="info">
    <strong>호스팅 정보:</strong>
    <ul>
      <li>스토리지: Amazon S3</li>
      <li>CDN: Amazon CloudFront</li>
      <li>HTTPS: 자동 적용</li>
    </ul>
  </div>
</body>
</html>
EOF

aws s3 sync ~/s3-website/ s3://my-spa-hosting-{계정ID} --delete
```

| 문제                                                  | 원인                                                | 해결                                             |
| ----------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------ |
| `upload failed: ... An error occurred (AccessDenied)` | AWS CLI 자격 증명에 S3 권한 없음                    | IAM 사용자에 `AmazonS3FullAccess` 정책 연결      |
| `fatal error: An error occurred (NoSuchBucket)`       | 버킷 이름 오타                                      | `aws s3 ls`로 정확한 버킷 이름 확인              |
| 브라우저에서 403 Forbidden                            | 버킷 정책 미설정 또는 Block Public Access 활성 상태 | 태스크 1의 6~8번, 18~21번 단계 재확인            |
| 브라우저에서 404 Not Found                            | index.html이 버킷 루트에 없음                       | `aws s3 ls s3://bucket-name/`으로 파일 위치 확인 |

✅ **태스크 완료**: Vue.js 빌드 파일(또는 HTML 파일)이 S3에 업로드되었고, HTTP 엔드포인트로 접속이 확인되었습니다.

---

## 태스크 3: CloudFront 배포 생성

S3 앞에 CloudFront를 배치하여 CDN 캐싱 + HTTPS + 전 세계 엣지 서빙을 적용합니다.

> [!CONCEPT] CloudFront CDN의 동작 원리
>
> ```
> ┌──────────────────────────────────────────────────────────────────┐
> │                    CloudFront CDN 동작                            │
> │                                                                  │
> │  사용자 (서울)          사용자 (도쿄)         사용자 (미국)       │
> │       │                     │                     │              │
> │       ▼                     ▼                     ▼              │
> │  ┌─────────┐          ┌─────────┐          ┌─────────┐          │
> │  │ 서울    │          │ 도쿄    │          │ 미국    │          │
> │  │ 엣지   │          │ 엣지   │          │ 엣지   │          │
> │  └────┬────┘          └────┬────┘          └────┬────┘          │
> │       │ 캐시 미스 시        │                     │              │
> │       ▼                     ▼                     ▼              │
> │  ┌──────────────────────────────────────────────────┐            │
> │  │              Origin (S3 Bucket)                   │            │
> │  │         ap-northeast-2 (서울 리전)                │            │
> │  └──────────────────────────────────────────────────┘            │
> │                                                                  │
> │  1차 요청: 엣지에 캐시 없음 → Origin(S3)에서 가져옴 (캐시 미스) │
> │  2차 요청: 엣지 캐시에서 즉시 응답 (캐시 히트, 매우 빠름)       │
> └──────────────────────────────────────────────────────────────────┘
> ```
>
> **CloudFront가 제공하는 것:**
>
> - **HTTPS**: `*.cloudfront.net` 인증서 자동 적용 (별도 설정 불필요)
> - **CDN**: 전 세계 400+ 엣지 로케이션에서 캐싱
> - **DDoS 방어**: AWS Shield Standard 자동 적용
> - **성능**: 동일 요청에 대해 S3까지 가지 않고 엣지에서 즉시 응답

### CloudFront 콘솔 이동

30. 상단 검색창에 `CloudFront`를 입력하고 **CloudFront** 서비스를 선택합니다.
31. [[Create distribution]] 버튼을 클릭합니다.

### Origin 설정

32. **Origin domain** 필드를 클릭합니다.
33. 드롭다운에서 S3 버킷 목록이 표시되지만, **직접 입력**합니다:
    - `my-spa-hosting-{계정ID}.s3-website.ap-northeast-2.amazonaws.com`

> [!WARNING]
> **매우 중요: 드롭다운에서 S3 버킷을 선택하지 마세요!**
>
> 드롭다운에서 선택하면 S3 REST API 엔드포인트(`bucket.s3.amazonaws.com`)가 입력됩니다.
> 이 경우 정적 웹 호스팅의 Index Document, Error Document 설정이 동작하지 않습니다.
>
> | 엔드포인트 유형 | 형식                                     | SPA 라우팅 |
> | --------------- | ---------------------------------------- | ---------- |
> | REST API (❌)   | `bucket.s3.amazonaws.com`                | 동작 안 함 |
> | 웹사이트 (✅)   | `bucket.s3-website.region.amazonaws.com` | 정상 동작  |
>
> 반드시 **웹사이트 엔드포인트**를 직접 타이핑하세요.

34. **Protocol**: `HTTP only` 선택

> [!NOTE]
> Origin Protocol을 HTTP only로 설정하는 이유: S3 웹사이트 엔드포인트는 HTTP만 지원합니다.
> CloudFront ↔ S3 구간은 HTTP, 사용자 ↔ CloudFront 구간은 HTTPS로 동작합니다.

35. **Name**: 자동으로 채워진 값을 그대로 사용합니다.

### Default cache behavior 설정

36. **Viewer protocol policy**: `Redirect HTTP to HTTPS` 선택

> [!TIP]
> `Redirect HTTP to HTTPS`를 선택하면 사용자가 `http://`로 접속해도 자동으로 `https://`로 리다이렉트됩니다.
> 모든 트래픽이 암호화되어 전송됩니다.

37. **Allowed HTTP methods**: `GET, HEAD` (기본값 유지)
38. **Cache key and origin requests** 섹션:
    - **Cache policy**: `CachingOptimized` 선택 (드롭다운에서 선택)

> [!CONCEPT] CachingOptimized 캐시 정책
> AWS가 제공하는 관리형 캐시 정책입니다.
>
> - **TTL**: 기본 24시간 (86400초), 최대 31536000초 (1년)
> - **압축**: Gzip, Brotli 자동 압축 활성화
> - **캐시 키**: URL 경로만 사용 (쿼리 스트링, 헤더 무시)
>
> 정적 사이트에 가장 적합한 정책입니다.

39. **Origin request policy**: `없음 (None)` (기본값 유지)

### Web Application Firewall (WAF) 설정

40. **Web Application Firewall (WAF)** 섹션:
    - `Do not enable security protections` 선택

> [!NOTE]
> WAF는 추가 비용이 발생합니다. 학습 목적에서는 비활성화합니다.
> 프로덕션 환경에서는 WAF를 활성화하여 SQL Injection, XSS 등의 공격을 방어하세요.

### Settings (기본 설정)

41. **Price class**: `Use only North America and Europe` 선택

> [!TIP]
> Price Class를 제한하면 비용을 절약할 수 있습니다.
>
> | Price Class                                              | 엣지 범위   | 비용      |
> | -------------------------------------------------------- | ----------- | --------- |
> | Use all edge locations                                   | 전 세계     | 가장 비쌈 |
> | Use only North America and Europe                        | 북미 + 유럽 | 중간      |
> | Use North America, Europe, Asia, Middle East, and Africa | 대부분      | 약간 저렴 |
>
> 학습 목적에서는 가장 저렴한 옵션을 선택합니다. 한국에서 접속 시 약간 느릴 수 있지만 체감 차이는 미미합니다.

42. **Alternate domain name (CNAME)**: 비워둡니다 (기본 CloudFront 도메인 사용).
43. **Custom SSL certificate**: 비워둡니다 (기본 `*.cloudfront.net` 인증서 사용).
44. **Default root object**: `index.html` 입력

> [!WARNING]
> **Default root object에 반드시 `index.html`을 입력하세요!**
> 이 값을 비워두면 `https://d1234abcdef.cloudfront.net/` 접속 시 AccessDenied 에러가 발생합니다.

45. **Description**: `SPA hosting with S3` (선택사항, 메모용)
46. 나머지 설정은 기본값을 유지합니다.
47. [[Create distribution]] 버튼을 클릭합니다.

> [!OUTPUT]
> Distribution이 생성됩니다.
>
> - **Distribution ID**: `E1234ABCDEF` (메모해 두세요, 캐시 무효화에 사용)
> - **Distribution domain name**: `d1234abcdef.cloudfront.net` (메모해 두세요)
> - **Status**: `Deploying` → 5~10분 후 `Enabled`로 변경

> [!NOTE]
> CloudFront 배포 생성에 약 **5~10분**이 소요됩니다.
> Status가 `Enabled`로 변경되고, Last modified에 날짜가 표시되면 배포가 완료된 것입니다.
> 배포 완료 전에 접속하면 에러가 발생할 수 있으니 기다려주세요.

### 에러 페이지 설정 (SPA 라우팅)

배포가 생성된 후, SPA 라우팅을 위한 커스텀 에러 응답을 설정합니다.

> [!CONCEPT] SPA 라우팅과 CloudFront 에러 페이지
>
> ```
> ┌─────────────────────────────────────────────────────────────┐
> │              SPA 라우팅 문제와 해결                          │
> │                                                             │
> │  문제 상황:                                                 │
> │  사용자가 /about 직접 접속 또는 새로고침                    │
> │       │                                                     │
> │       ▼                                                     │
> │  CloudFront → S3에서 /about 파일 찾음 → 없음! → 403/404   │
> │                                                             │
> │  해결:                                                      │
> │  403/404 에러 발생 시 → index.html 반환 (HTTP 200)         │
> │       │                                                     │
> │       ▼                                                     │
> │  브라우저가 index.html 로드 → Vue Router가 /about 처리     │
> │                                                             │
> │  설정:                                                      │
> │  HTTP 403 → /index.html (200)                              │
> │  HTTP 404 → /index.html (200)                              │
> └─────────────────────────────────────────────────────────────┘
> ```

48. 생성된 Distribution을 클릭하여 상세 페이지로 이동합니다.
49. **Error pages** 탭을 클릭합니다.
50. [[Create custom error response]] 버튼을 클릭합니다.
51. 다음과 같이 설정합니다:
    - **HTTP error code**: `403: Forbidden` 선택
    - **Customize error response**: `Yes` 선택
    - **Response page path**: `/index.html`
    - **HTTP response code**: `200: OK` 선택
52. [[Create custom error response]] 버튼을 클릭합니다.

53. 다시 [[Create custom error response]] 버튼을 클릭합니다.
54. 다음과 같이 설정합니다:
    - **HTTP error code**: `404: Not Found` 선택
    - **Customize error response**: `Yes` 선택
    - **Response page path**: `/index.html`
    - **HTTP response code**: `200: OK` 선택
55. [[Create custom error response]] 버튼을 클릭합니다.

> [!OUTPUT]
> Error pages 탭에 2개의 커스텀 에러 응답이 표시됩니다:
>
> | HTTP Error Code | Response Page Path | HTTP Response Code |
> | --------------- | ------------------ | ------------------ |
> | 403             | /index.html        | 200                |
> | 404             | /index.html        | 200                |

> [!TIP]
> **왜 403과 404 모두 설정하는가?**
>
> - **404**: S3 웹사이트 엔드포인트를 Origin으로 사용할 때, 파일이 없으면 404 반환
> - **403**: S3 REST API 엔드포인트를 Origin으로 사용할 때, 파일이 없으면 403 반환
>
> 두 가지 모두 설정해두면 Origin 유형에 관계없이 SPA 라우팅이 정상 동작합니다.

| 문제                                   | 원인                                  | 해결                                                                     |
| -------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------ |
| 배포 생성 후 접속 시 `502 Bad Gateway` | Origin 도메인 오타                    | Distribution → Origins → Edit에서 도메인 확인                            |
| 접속 시 `AccessDenied` XML 에러        | Default root object 미설정            | Distribution → Settings → Edit → Default root object에 `index.html` 입력 |
| 접속 시 S3 버킷 목록 XML 표시          | REST API 엔드포인트를 Origin으로 사용 | Origin을 웹사이트 엔드포인트로 변경                                      |
| HTTPS 접속 불가                        | 배포 아직 Deploying 상태              | Status가 Enabled로 변경될 때까지 대기 (5~10분)                           |
| 에러 페이지 설정 후에도 404 표시       | 캐시에 이전 에러 응답 남아있음        | 캐시 무효화 실행 (태스크 5 참조)                                         |

✅ **태스크 완료**: CloudFront 배포가 생성되었고, SPA 라우팅을 위한 에러 페이지가 설정되었습니다.

---

## 태스크 4: CloudFront URL로 접속 확인 + SPA 라우팅 테스트

CloudFront 배포가 완료되면 HTTPS URL로 접속하여 정상 동작을 확인하고, SPA 라우팅이 올바르게 동작하는지 테스트합니다.

### 배포 상태 확인

56. CloudFront 콘솔에서 생성한 Distribution을 클릭합니다.
57. **General** 탭에서 **Last modified** 필드에 날짜/시간이 표시되는지 확인합니다.
58. **Status** 열이 `Enabled`로 표시되는지 확인합니다.

> [!NOTE]
> Status가 아직 `Deploying`이면 배포가 진행 중입니다. 5~10분 더 기다려주세요.
> 페이지를 새로고침(F5)하면 상태가 업데이트됩니다.

### HTTPS 접속 확인

59. **Distribution domain name**을 복사합니다 (예: `d1234abcdef.cloudfront.net`).
60. 브라우저 주소창에 다음을 입력하고 접속합니다:

```
https://d1234abcdef.cloudfront.net
```

> [!OUTPUT]
>
> - Vue.js 앱(또는 HTML 페이지)이 정상적으로 표시됩니다.
> - 브라우저 주소창에 🔒 **자물쇠 아이콘**이 표시됩니다 (HTTPS 적용 확인).
> - 인증서 정보를 클릭하면 `*.cloudfront.net` 인증서가 표시됩니다.

61. `http://d1234abcdef.cloudfront.net` (HTTP)으로도 접속해봅니다.

> [!OUTPUT]
> 자동으로 `https://d1234abcdef.cloudfront.net`으로 리다이렉트됩니다.
> (태스크 3에서 Viewer protocol policy를 `Redirect HTTP to HTTPS`로 설정했기 때문)

### SPA 라우팅 테스트

SPA의 클라이언트 사이드 라우팅이 정상 동작하는지 확인합니다.

62. 브라우저에서 존재하지 않는 경로로 직접 접속합니다:

```
https://d1234abcdef.cloudfront.net/about
```

63. 페이지가 정상적으로 로드되는지 확인합니다.

> [!OUTPUT]
>
> - Vue.js 앱: Vue Router가 `/about` 경로를 처리하여 해당 페이지 컴포넌트가 표시됩니다.
> - HTML 파일: `index.html`이 표시됩니다 (SPA 라우터가 없으므로 기본 페이지).
>
> **핵심**: 403/404 에러 대신 `index.html`이 반환되고, SPA 라우터가 URL을 해석합니다.

64. 다른 경로도 테스트합니다:

```
https://d1234abcdef.cloudfront.net/users/123
https://d1234abcdef.cloudfront.net/settings
```

65. 각 경로에서 브라우저 **새로고침(F5)**을 눌러봅니다.

> [!OUTPUT]
> 새로고침해도 페이지가 정상적으로 로드됩니다.
> 에러 페이지 설정이 없으면 새로고침 시 403 또는 404 에러가 발생합니다.

> [!TIP]
> **SPA 라우팅 테스트 체크리스트:**
>
> | 테스트 항목                  | 예상 결과          | 실패 시 원인                     |
> | ---------------------------- | ------------------ | -------------------------------- |
> | 루트 경로 `/` 접속           | 메인 페이지 표시   | Default root object 미설정       |
> | 하위 경로 `/about` 직접 접속 | 해당 페이지 표시   | 에러 페이지 미설정               |
> | 하위 경로에서 새로고침       | 동일 페이지 유지   | 에러 페이지 미설정               |
> | HTTP 접속                    | HTTPS로 리다이렉트 | Viewer protocol policy 설정 확인 |

### 응답 헤더 확인 (선택사항)

66. 브라우저 개발자 도구(F12)를 열고 **Network** 탭을 선택합니다.
67. 페이지를 새로고침합니다.
68. 첫 번째 요청(document)을 클릭하고 **Response Headers**를 확인합니다.

> [!OUTPUT]
>
> ```
> x-cache: Hit from cloudfront     ← CloudFront 캐시에서 응답 (2번째 요청부터)
> x-amz-cf-pop: ICN54-C1           ← 응답한 엣지 로케이션 (ICN = 인천)
> via: 1.1 abc123.cloudfront.net   ← CloudFront를 경유했음을 표시
> ```
>
> - `x-cache: Hit from cloudfront` → 캐시 히트 (엣지에서 즉시 응답)
> - `x-cache: Miss from cloudfront` → 캐시 미스 (Origin에서 가져옴)

> [!CONCEPT] 캐시 히트와 미스
>
> ```
> ┌─────────────────────────────────────────────────┐
> │           캐시 히트 vs 미스                      │
> │                                                 │
> │  [첫 번째 요청] Cache Miss                      │
> │  사용자 → 엣지 (캐시 없음) → S3 Origin         │
> │                ↓                                │
> │         캐시에 저장                             │
> │                                                 │
> │  [두 번째 요청] Cache Hit                       │
> │  사용자 → 엣지 (캐시 있음!) → 즉시 응답        │
> │                                                 │
> │  응답 시간 비교:                                │
> │  • Cache Miss: ~100ms (S3까지 왕복)            │
> │  • Cache Hit:  ~10ms  (엣지에서 즉시)          │
> └─────────────────────────────────────────────────┘
> ```

| 문제                                      | 원인                                        | 해결                                                    |
| ----------------------------------------- | ------------------------------------------- | ------------------------------------------------------- |
| 접속 시 빈 페이지 (흰 화면)               | JS/CSS 파일 경로 문제                       | 개발자 도구 Console에서 404 에러 확인, `base` 설정 점검 |
| `/about` 접속 시 AccessDenied XML         | 에러 페이지 미설정                          | 태스크 3의 48~55번 단계 재확인                          |
| 새로고침 시 에러                          | 에러 페이지 HTTP response code가 200이 아님 | Error pages에서 Response code를 `200: OK`로 설정        |
| `x-cache: Miss from cloudfront` 계속 표시 | 캐시 TTL 이전 또는 첫 요청                  | 동일 URL로 2~3회 재요청하면 Hit로 변경                  |

✅ **태스크 완료**: CloudFront HTTPS URL로 접속이 확인되었고, SPA 라우팅이 정상 동작합니다.

---

## 태스크 5: 캐시 무효화 (Invalidation)

S3의 파일을 업데이트한 후, CloudFront 엣지 캐시에 남아있는 이전 버전을 강제로 제거하는 방법을 학습합니다.

> [!CONCEPT] 캐시 무효화가 필요한 이유
>
> ```
> ┌─────────────────────────────────────────────────────────────┐
> │              캐시 무효화 시나리오                             │
> │                                                             │
> │  [상황] S3에 새 버전 업로드 후 CloudFront 접속              │
> │                                                             │
> │  사용자 → CloudFront 엣지                                  │
> │              │                                              │
> │              ├── 캐시에 이전 버전 있음 (TTL 만료 전)        │
> │              │   → 이전 버전 반환 (업데이트 안 보임!)       │
> │              │                                              │
> │  [해결] Invalidation 실행                                   │
> │              │                                              │
> │              ├── 엣지 캐시 강제 삭제                        │
> │              │                                              │
> │  사용자 → CloudFront 엣지 (캐시 없음)                      │
> │              │                                              │
> │              └── S3에서 새 버전 가져옴 → 새 버전 반환      │
> │                                                             │
> │  비용: 월 1,000개 경로까지 무료                            │
> │  시간: 보통 1~2분 내 전 세계 엣지에 반영                   │
> └─────────────────────────────────────────────────────────────┘
> ```

### 콘솔에서 캐시 무효화

69. CloudFront 콘솔에서 배포를 클릭하여 상세 페이지로 이동합니다.
70. **Invalidations** 탭을 클릭합니다.
71. [[Create invalidation]] 버튼을 클릭합니다.
72. **Add object paths** 필드에 다음을 입력합니다:
    - `/*`
73. [[Create invalidation]] 버튼을 클릭합니다.

> [!OUTPUT]
> Invalidation이 생성됩니다:
>
> - **Invalidation ID**: `I1234ABCDEF`
> - **Status**: `In progress` → 1~2분 후 `Completed`로 변경

74. Status가 `Completed`로 변경될 때까지 대기합니다 (약 1~2분).
75. 브라우저에서 CloudFront URL을 **강력 새로고침**(Ctrl+Shift+R 또는 Cmd+Shift+R)합니다.

> [!OUTPUT]
> 업데이트된 콘텐츠가 표시됩니다.

> [!TIP]
> **무효화 경로 패턴:**
>
> | 패턴               | 의미                | 사용 시점      |
> | ------------------ | ------------------- | -------------- |
> | `/*`               | 모든 파일 무효화    | 전체 배포 시   |
> | `/index.html`      | 특정 파일만 무효화  | HTML만 변경 시 |
> | `/assets/*`        | 특정 폴더 하위 전체 | CSS/JS 변경 시 |
> | `/images/logo.png` | 단일 파일           | 이미지 교체 시 |
>
> `/*`는 1개 경로로 카운트됩니다. 월 1,000개 경로까지 무료입니다.

### AWS CLI로 캐시 무효화

76. 터미널에서 다음 명령어를 실행합니다:

```bash
aws cloudfront create-invalidation \
  --distribution-id E1234ABCDEF \
  --paths "/*"
```

> [!WARNING]
> `E1234ABCDEF`를 본인의 Distribution ID로 교체하세요.
> Distribution ID는 CloudFront 콘솔 → 배포 목록의 **ID** 열에서 확인할 수 있습니다.

> [!OUTPUT]
>
> ```json
> {
>   "Location": "https://cloudfront.amazonaws.com/2020-05-31/distribution/E1234ABCDEF/invalidation/I5678GHIJKL",
>   "Invalidation": {
>     "Id": "I5678GHIJKL",
>     "Status": "InProgress",
>     "CreateTime": "2024-01-15T10:45:00.000Z",
>     "InvalidationBatch": {
>       "Paths": {
>         "Quantity": 1,
>         "Items": ["/*"]
>       },
>       "CallerReference": "cli-1705312345-123456"
>     }
>   }
> }
> ```

### 배포 자동화 스크립트 (S3 업로드 + 캐시 무효화)

77. 다음 스크립트를 `deploy.sh`로 저장합니다:

```bash
#!/bin/bash

# 변수 설정 (본인의 값으로 교체)
BUCKET_NAME="my-spa-hosting-123456789012"
DISTRIBUTION_ID="E1234ABCDEF"
BUILD_DIR="dist"

echo "🔨 빌드 시작..."
npm run build

echo "📤 S3 업로드 중..."
aws s3 sync $BUILD_DIR/ s3://$BUCKET_NAME --delete

echo "🔄 캐시 무효화 중..."
aws cloudfront create-invalidation \
  --distribution-id $DISTRIBUTION_ID \
  --paths "/*"

echo "✅ 배포 완료! 1~2분 후 반영됩니다."
echo "🌐 https://$DISTRIBUTION_ID.cloudfront.net 에서 확인하세요."
```

78. 스크립트에 실행 권한을 부여합니다:

```bash
chmod +x deploy.sh
```

79. 스크립트를 실행합니다:

```bash
./deploy.sh
```

> [!OUTPUT]
>
> ```
> 🔨 빌드 시작...
> ✓ built in 1.23s
> 📤 S3 업로드 중...
> upload: dist/index.html to s3://my-spa-hosting-123456789012/index.html
> upload: dist/assets/index-abc123.js to s3://my-spa-hosting-123456789012/assets/index-abc123.js
> 🔄 캐시 무효화 중...
> ✅ 배포 완료! 1~2분 후 반영됩니다.
> ```

> [!CONCEPT] 이것이 Step 9에서 하는 것의 기초
>
> ```
> ┌─────────────────────────────────────────────────────────┐
> │         수동 배포 → CI/CD 자동화 (Step 9)               │
> │                                                         │
> │  [지금 - 수동]                                          │
> │  개발자가 터미널에서 직접 실행:                         │
> │  1. npm run build                                       │
> │  2. aws s3 sync                                         │
> │  3. aws cloudfront create-invalidation                  │
> │                                                         │
> │  [Step 9 - 자동]                                        │
> │  git push만 하면 GitHub Actions가 자동 실행:           │
> │  1. git push → GitHub Actions 트리거                    │
> │  2. npm run build → Vue.js 빌드                         │
> │  3. aws s3 sync → S3 업로드                             │
> │  4. aws cloudfront create-invalidation → 캐시 무효화    │
> │                                                         │
> │  지금 수동으로 하는 것을 자동화하는 것뿐입니다.         │
> └─────────────────────────────────────────────────────────┘
> ```

| 문제                                     | 원인                        | 해결                                          |
| ---------------------------------------- | --------------------------- | --------------------------------------------- |
| `An error occurred (NoSuchDistribution)` | Distribution ID 오타        | CloudFront 콘솔에서 정확한 ID 복사            |
| `An error occurred (AccessDenied)`       | IAM 권한 부족               | `CloudFrontFullAccess` 정책 연결 필요         |
| 무효화 후에도 이전 버전 표시             | 브라우저 로컬 캐시          | Ctrl+Shift+R (강력 새로고침) 또는 시크릿 모드 |
| Invalidation Status가 계속 InProgress    | 정상 (전 세계 엣지 반영 중) | 1~2분 대기, 최대 5분 소요 가능                |

✅ **태스크 완료**: 콘솔과 CLI 모두에서 캐시 무효화를 실행하고, 배포 자동화 스크립트를 작성했습니다.

---

## 마무리

다음을 성공적으로 수행했습니다:

- S3 버킷에 정적 웹 호스팅을 설정했습니다 (Block Public Access 해제 + 버킷 정책 + 호스팅 활성화).
- AWS CLI로 Vue.js 빌드 파일을 S3에 업로드했습니다.
- CloudFront 배포를 생성하여 CDN + HTTPS를 적용했습니다.
- SPA 라우팅을 위한 에러 페이지(403, 404 → index.html)를 설정했습니다.
- CloudFront URL로 접속하여 HTTPS와 SPA 라우팅을 확인했습니다.
- 캐시 무효화를 콘솔과 CLI로 실행하는 방법을 학습했습니다.
- 배포 자동화 스크립트(빌드 → 업로드 → 무효화)를 작성했습니다.

### 전체 아키텍처 요약

```
사용자 (브라우저)
     │
     │ HTTPS (자동 인증서)
     ▼
CloudFront (CDN, 전 세계 엣지)
     │
     │ HTTP (Origin Protocol)
     ▼
S3 Bucket (정적 웹 호스팅)
├── index.html
├── assets/
│   ├── index-abc123.js
│   └── index-def456.css
└── favicon.ico
```

# 🗑️ 리소스 정리

> [!WARNING]
> CloudFront와 S3 정적 호스팅은 요청 기반 과금으로 비용이 매우 저렴하지만 (학습 수준에서 거의 무료),
> 깔끔하게 정리하려면 아래 단계를 **의존 관계 순서대로** 따릅니다.
>
> **삭제 순서 원칙**: CloudFront가 S3를 참조하므로, CloudFront를 먼저 삭제해야 합니다.
>
> ```
> 삭제 순서: CloudFront (Disable → Delete) → S3 (Empty → Delete)
>
> CloudFront ──참조──→ S3 Bucket
>     │                    │
>     │ 먼저 삭제          │ 나중에 삭제
>     ▼                    ▼
>  (1) Disable          (3) Empty
>  (2) Delete           (4) Delete
> ```

---

### 단계 1: CloudFront 배포 비활성화 (Disable)

CloudFront 배포는 즉시 삭제할 수 없습니다. 먼저 비활성화(Disable)한 후 삭제해야 합니다.

80. 상단 검색창에 `CloudFront`를 입력하고 **CloudFront** 서비스를 선택합니다.
81. Distributions 목록에서 이 실습에서 생성한 배포를 선택합니다 (체크박스 클릭).
82. [[Disable]] 버튼을 클릭합니다.
83. 확인 팝업에서 [[Disable]] 버튼을 클릭합니다.

> [!OUTPUT]
> Status가 `Enabled` → `Deploying` → `Disabled`로 변경됩니다.
> **Disabled 상태가 될 때까지 약 5~10분 소요됩니다.**

84. Status가 `Disabled`로 변경될 때까지 대기합니다.

> [!WARNING]
> Status가 `Disabled`로 변경되기 전에는 Delete 버튼이 활성화되지 않습니다.
> 반드시 Disabled 상태를 확인한 후 다음 단계로 진행하세요.
> 페이지를 새로고침(F5)하면 상태가 업데이트됩니다.

---

### 단계 2: CloudFront 배포 삭제 (Delete)

85. Status가 `Disabled`로 변경된 것을 확인합니다.
86. 해당 배포를 다시 선택합니다 (체크박스 클릭).
87. [[Delete]] 버튼을 클릭합니다.
88. 확인 팝업에서 [[Delete]] 버튼을 클릭합니다.

> [!OUTPUT]
> Distribution이 목록에서 사라집니다.

> [!NOTE]
> CloudFront 배포 삭제 후에도 엣지 캐시가 완전히 제거되기까지 시간이 걸릴 수 있습니다.
> 하지만 배포가 삭제되면 더 이상 요금이 발생하지 않습니다.

---

### 단계 3: S3 버킷 비우기 (Empty)

S3 버킷은 비어있어야만 삭제할 수 있습니다. 먼저 모든 객체를 삭제합니다.

89. 상단 검색창에 `S3`를 입력하고 **S3** 서비스를 선택합니다.
90. Buckets 목록에서 `my-spa-hosting-{계정ID}` 버킷을 선택합니다 (체크박스 클릭, 버킷 이름을 클릭하지 마세요).
91. [[Empty]] 버튼을 클릭합니다.
92. 확인 필드에 `permanently delete`를 입력합니다.
93. [[Empty]] 버튼을 클릭합니다.

> [!OUTPUT]
> "Successfully emptied bucket" 메시지가 표시됩니다.
> 버킷 내 모든 객체가 삭제되었습니다.

> [!WARNING]
> **버킷 이름을 클릭하면** 버킷 내부로 이동합니다. **체크박스를 클릭**해야 Empty/Delete 버튼이 활성화됩니다.

---

### 단계 4: S3 버킷 삭제 (Delete)

94. Buckets 목록으로 돌아갑니다 (이미 목록 페이지에 있을 수 있음).
95. `my-spa-hosting-{계정ID}` 버킷을 다시 선택합니다 (체크박스 클릭).
96. [[Delete]] 버튼을 클릭합니다.
97. 확인 필드에 버킷 이름(`my-spa-hosting-{계정ID}`)을 입력합니다.
98. [[Delete bucket]] 버튼을 클릭합니다.

> [!OUTPUT]
> "Successfully deleted bucket "my-spa-hosting-123456789012"" 메시지가 표시됩니다.
> Buckets 목록에서 해당 버킷이 사라집니다.

---

### 단계 5: 삭제 확인

99. **CloudFront** 콘솔에서 Distributions 목록에 이 실습의 배포가 없는지 확인합니다.
100. **S3** 콘솔에서 Buckets 목록에 `my-spa-hosting-{계정ID}` 버킷이 없는지 확인합니다.

> [!TIP]
> **Tag Editor로 최종 확인:**
>
> 1. 상단 검색창에 `Resource Groups & Tag Editor`를 입력하고 선택합니다.
> 2. 왼쪽 메뉴에서 **Tag Editor**를 선택합니다.
> 3. Regions: `ap-northeast-2`, Tag key: `Session`, Tag value: `5-3`으로 검색합니다.
> 4. 검색 결과가 없으면 모든 리소스가 정리된 것입니다.

| 문제                               | 원인                      | 해결                           |
| ---------------------------------- | ------------------------- | ------------------------------ |
| CloudFront Delete 버튼 비활성화    | 아직 Disabled 상태가 아님 | 5~10분 대기 후 페이지 새로고침 |
| S3 Delete 시 "Bucket is not empty" | 버킷 비우기(Empty) 미실행 | 단계 3의 89~93번 먼저 실행     |
| S3 Empty 시 "Access Denied"        | IAM 권한 부족             | `AmazonS3FullAccess` 정책 확인 |
| CloudFront 배포가 목록에 남아있음  | 삭제 처리 중 (정상)       | 1~2분 후 새로고침              |

✅ **실습 종료**: 모든 리소스(CloudFront 배포, S3 버킷)가 정리되었습니다.

---
title: 'Amazon S3 + CloudFront 정적 웹 호스팅'
week: 5
session: 3
awsServices:
  - Amazon S3
  - Amazon CloudFront
learningObjectives:
  - Amazon S3 정적 웹 호스팅을 설정할 수 있습니다.
  - CloudFront 배포를 생성하여 CDN과 HTTPS를 적용할 수 있습니다.
  - OAC(Origin Access Control)로 S3 직접 접근을 차단할 수 있습니다.
  - SPA 라우팅을 위한 에러 페이지 설정을 구성할 수 있습니다.
prerequisites:
  - AWS 계정 생성 완료
  - Amazon S3 버킷 생성 경험 (Step 5-1 참조)
estimatedCost: 크레딧 내 사용 가능 (비용 매우 저렴)
---

이 실습에서는 Vue.js로 빌드한 SPA(Single Page Application)를 Amazon S3에 업로드하고, CloudFront CDN을 연결하여 HTTPS + 전 세계 엣지 캐싱을 적용합니다.   
Amazon EC2 없이도 웹사이트를 전 세계에 빠르게 서빙할 수 있는 서버리스 호스팅 방식을 체험합니다.

> [!NOTE]
> 이 실습은 독립적으로 진행할 수 있습니다.  
> Vue.js 빌드 파일이 없다면 간단한 HTML 파일로 대체해도 됩니다.  
> Step 9에서 GitHub Actions CI/CD를 구성할 때 이 경험이 그대로 활용됩니다.

> [!CONCEPT] EC2 vs S3+CloudFront 정적 호스팅
> Amazon EC2에 Nginx를 설치하여 정적 파일을 서빙하는 방식과, S3 + CloudFront를 사용하는 서버리스 방식을 비교합니다.  
> 정적 사이트(SPA)에는 S3 + CloudFront가 비용, 성능, 관리 모든 면에서 유리합니다.
>
> ```
> ┌─── EC2 방식 ───────────────────────────────────────────┐
> │                                                        │
> │  사용자 → ALB → EC2 (Nginx) → 정적 파일 (디스크)       │
> │                                                        │
> │  • OS 패치, Nginx 설정, Auto Scaling 모두 직접 관리    │
> │  • HTTPS: ACM + ALB 별도 구성 필요                     │
> │  • 단일 리전에서만 서빙                                │
> └────────────────────────────────────────────────────────┘
>
> ┌─── S3 + CloudFront 방식 ───────────────────────────────┐
> │                                                        │
> │  사용자 → CloudFront (엣지) → S3 (원본 저장소)         │
> │                                                        │
> │  • 서버 관리 없음 (완전 서버리스)                      │
> │  • HTTPS: CloudFront 기본 제공                         │
> │  • 전 세계 600+ 엣지 로케이션에서 캐싱                 │
> └────────────────────────────────────────────────────────┘
> ```

| 항목        | EC2 + Nginx              | S3 + CloudFront       |
| ----------- | ------------------------ | --------------------- |
| 서버 관리   | OS 패치, Nginx 설정 필요 | 없음 (서버리스)       |
| 확장        | Auto Scaling 설정 필요   | 자동 (무제한)         |
| HTTPS       | ACM + ALB 필요           | CloudFront 기본 제공  |
| 비용        | EC2 시간당 과금          | 요청 기반 (매우 저렴) |
| 속도        | 단일 리전                | 전 세계 엣지 캐싱     |
| 적합한 경우 | SSR, 동적 콘텐츠         | SPA, 정적 사이트      |

### 아키텍처 다이어그램

<img src="/images/step5/5-3-architecture.png" alt="Step 5-3 S3 + CloudFront 아키텍처" class="guide-img-lg" />

---

## 태스크 1: Amazon S3 정적 웹 호스팅 설정

Amazon S3 버킷을 생성하고, Block Public Access를 해제한 뒤, 버킷 정책으로 퍼블릭 읽기를 허용하고, 정적 웹 호스팅을 활성화합니다.

> [!CONCEPT] Amazon S3 정적 웹 호스팅이란?
> Amazon S3 버킷을 웹 서버처럼 사용하는 기능입니다. HTML, CSS, JS 파일을 업로드하면 HTTP 엔드포인트로 접근할 수 있습니다.
>
> ```
> ┌─────────────────────────────────────────────────────────────┐
> │                    Amazon S3 정적 웹 호스팅                        │
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
> │  • HTTP만 지원 (HTTPS는 CloudFront 필요)                    │
> │  • Index Document: / 요청 시 반환할 파일                    │
> │  • Error Document: 404 시 반환할 파일                       │
> └─────────────────────────────────────────────────────────────┘
> ```
>
> **3가지 필수 설정:**
>
> - Block Public Access 해제 → 외부 접근 허용의 "잠금 해제"
> - 버킷 정책 추가 → 실제로 누구에게 어떤 권한을 줄지 정의
> - 정적 웹 호스팅 활성화 → HTTP 엔드포인트 생성

### Amazon S3 버킷 생성

1. AWS Management Console에 로그인합니다.
2. 우측 상단에서 리전을 **Asia Pacific (Seoul) ap-northeast-2**로 설정합니다.

    <img src="/images/common/region-check.png" alt="리전 확인" class="guide-img-sm" />

> [!TIP]
> 일부 AWS 서비스(IAM, CloudFront, Route 53 등)는 **글로벌 서비스**이므로 리전 선택 드롭다운이 비활성화되거나 "Global"로 표시됩니다.  
> Amazon S3 버킷은 리전 기반 서비스이므로 반드시 올바른 리전이 선택되어 있는지 확인하세요.

3. 상단 검색창에 `S3`를 입력하고 **S3** 서비스를 선택합니다.

    <img src="/images/step5/5-1-step3-s3-search.png" alt="S3 서비스 검색" class="guide-img-sm" />

4. [[Create bucket]] 버튼을 클릭합니다.
5. **General configuration** 섹션을 설정합니다:
   - **AWS Region**: `Asia Pacific (Seoul) ap-northeast-2` (콘솔 상단에서 설정한 리전이 자동 표시됨)
   - **Bucket namespace**: `Global namespace` 선택
     - `Account Regional namespace (recommended)`도 있지만, 이 실습에서는 이름이 짧고 직관적인 Global namespace를 사용합니다.
   - **Bucket name**: `{닉네임}-spa-hosting` (예: `hong-spa-hosting`, `mylab-spa-hosting`)
     - 전 세계에서 고유한 이름이어야 합니다. 본인의 닉네임이나 별칭을 포함하면 중복을 피할 수 있습니다.

    <img src="/images/step5/5-3-step5-general-config.png" alt="General configuration 설정" class="guide-img-sm" />

> [!TIP]
> 5-2에서 사용한 `{닉네임}-starter-app`과 동일한 닉네임을 사용하면 관리가 편합니다.  
> 예: `hong-starter-app` (5-2) / `hong-spa-hosting` (5-3)

### Block Public Access 해제

6. **Object Ownership** 섹션:
   - **ACLs disabled (recommended)** 선택 (기본값)

7. **Block Public Access settings for this bucket** 섹션:
   - ❌ **Block all public access** 체크를 **해제**합니다.
   - 경고 문구가 나타나면 **I acknowledge that the current settings might result in this bucket and the objects within becoming public.** 체크박스를 선택합니다.

    <img src="/images/step5/5-3-step7-block-public-access.png" alt="Block Public Access 해제" class="guide-img-sm" />

> [!WARNING]
> Block Public Access를 해제하면 버킷 정책에 따라 누구나 파일에 접근할 수 있습니다.  
> 정적 웹 호스팅 용도이므로 의도된 설정이지만, **민감한 데이터가 포함된 버킷에는 절대 이 설정을 하지 마세요.**

8. **Bucket Versioning** 섹션:
   - `Disable` 선택

    <img src="/images/step5/5-3-step8-versioning.png" alt="Bucket Versioning 설정" class="guide-img-sm" />

9. **Tags** 섹션에서 [[Add tag]]를 클릭하여 다음 태그를 추가합니다:

    | Key | Value |
    | --- | ----- |
    | `CreatedBy` | `admin-user` |
    | `Step` | `step5` |
    | `Session` | `5-3` |

10. **Default encryption** 섹션:
    - **Encryption type**: `Server-side encryption with Amazon S3 managed keys (SSE-S3)`
    - **Bucket Key**: `Enable` (기본값)

11. [[Create bucket]] 버튼을 클릭합니다.

    <img src="/images/step5/5-3-step11-create-bucket.png" alt="Create bucket 완료" class="guide-img-sm" />

> [!OUTPUT]
> "Successfully created bucket "{닉네임}-spa-hosting"" 메시지가 표시됩니다.
> Buckets 목록에서 방금 생성한 버킷을 확인할 수 있습니다.

### 정적 웹 호스팅 활성화

12. Buckets 목록에서 방금 생성한 `{닉네임}-spa-hosting` 버킷을 클릭합니다.
13. **Properties** 탭을 클릭합니다.
14. 페이지 맨 아래로 스크롤하여 **Static website hosting** 섹션을 찾습니다.

    <img src="/images/step5/5-3-step14-static-hosting.png" alt="Static website hosting 섹션" class="guide-img-sm" />

15. [[Edit]] 버튼을 클릭합니다.
16. 다음과 같이 설정합니다:
    - **Static website hosting**: `Enable` 선택
    - **Hosting type**: `Host a static website` 선택
    - **Index document**: `index.html`
    - **Error document**: `index.html`

    <img src="/images/step5/5-3-step16-hosting-settings.png" alt="Static website hosting 설정" class="guide-img-sm" />

> [!TIP]
> **Error document를 `index.html`로 설정하는 이유:**
>
> SPA(Single Page Application)는 클라이언트 사이드 라우팅을 사용합니다.  
> `/about`, `/users/123` 같은 경로는 실제 파일이 아니라 JavaScript가 처리하는 가상 경로입니다.  
> Amazon S3는 해당 경로에 파일이 없으면 404를 반환하는데, Error document를 `index.html`로 설정하면
> 모든 404 요청이 `index.html`로 리다이렉트되어 SPA 라우터가 정상 동작합니다.  

17. [[Save changes]] 버튼을 클릭합니다.

    <img src="/images/step5/5-3-step17-save-hosting.png" alt="Save changes 클릭" class="guide-img-sm" />

> [!OUTPUT]
> Static website hosting이 Enabled로 변경됩니다.  
> **Bucket website endpoint** URL이 표시됩니다:
> `http://{닉네임}-spa-hosting.s3-website.ap-northeast-2.amazonaws.com`
> 이 URL을 메모해 두세요.

### 버킷 정책 추가 (퍼블릭 읽기 허용)

18. **Permissions** 탭을 클릭합니다.

    <img src="/images/step5/5-3-step18-permissions-tab.png" alt="Permissions 탭" class="guide-img-sm" />

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
      "Resource": "arn:aws:s3:::{닉네임}-spa-hosting/*"
    }
  ]
}
```

<img src="/images/step5/5-3-step20-bucket-policy.png" alt="버킷 정책 JSON 입력" class="guide-img-sm" />

> [!WARNING]
> `{닉네임}-spa-hosting` 부분을 본인의 실제 버킷 이름으로 교체하세요.  
> 예: `"Resource": "arn:aws:s3:::{닉네임}-spa-hosting/*"`
> 끝에 `/*`를 빠뜨리면 객체에 대한 접근이 허용되지 않습니다.

21. [[Save changes]] 버튼을 클릭합니다.

    <img src="/images/step5/5-3-step21-policy-saved.png" alt="버킷 정책 저장 완료" class="guide-img-sm" />

> [!OUTPUT]
> 정책이 저장되면 상단에 "Successfully edited bucket policy." 녹색 배너가 표시됩니다.  
> Bucket policy 섹션에 방금 입력한 JSON이 표시되면 정상입니다.  
> 버킷 목록으로 돌아가면 해당 버킷에 **"Publicly accessible"** 경고 배지가 표시될 수 있으나, 정적 웹 호스팅에서는 의도된 설정입니다.

> [!CONCEPT] Block Public Access vs 버킷 정책의 관계
>
> ```
> ┌─────────────────────────────────────────────────────┐
> │              접근 제어 2단계 구조                   │
> │                                                     │
> │  요청 → [Block Public Access] → [Bucket Policy]     │
> │              (1차 잠금)           (2차 규칙)        │
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

✅ **태스크 완료**: Amazon S3 버킷에 정적 웹 호스팅이 설정되었습니다. (Block Public Access 해제 + 버킷 정책 + 정적 웹 호스팅 활성화)

---

## 태스크 2: Vue.js 빌드 파일 S3 업로드

AWS CLI를 사용하여 Vue.js 빌드 결과물을 Amazon S3 버킷에 업로드합니다.

> [!CONCEPT] Vue.js 빌드와 S3 업로드 흐름
>
> ```
> ┌─────────────────────────────────────────────────────────┐
> │                  빌드 → 업로드 흐름                     │
> │                                                         │
> │    소스 코드 (src/)                                     │
> │         │                                               │
> │         ▼  npm run build                                │
> │    빌드 결과 (dist/)                                    │
> │    ├── index.html                                       │
> │    ├── assets/                                          │
> │    │   ├── index-abc123.js    (번들된 JS)               │
> │    │   └── index-def456.css   (번들된 CSS)              │
> │    └── favicon.ico                                      │
> │         │                                               │
> │         ▼  aws s3 sync                                  │
> │    S3 Bucket                                            │
> │    ├── index.html                                       │
> │    ├── assets/index-abc123.js                           │
> │    ├── assets/index-def456.css                          │
> │    └── favicon.ico                                      │
> └─────────────────────────────────────────────────────────┘
> ```
>
> `npm run build`는 Vue.js 소스를 브라우저가 실행할 수 있는 정적 파일로 변환합니다.  
> `aws s3 sync`는 로컬 폴더와 Amazon S3 버킷을 동기화하여 변경된 파일만 업로드합니다.

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

<img src="/images/step5/5-3-step23-npm-build.png" alt="npm run build 결과" class="guide-img-sm" />

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

<img src="/images/step5/5-3-step24-ls-dist.png" alt="dist 폴더 확인" class="guide-img-sm" />

> [!OUTPUT]
>
> ```
> assets/  favicon.ico  index.html
> ```

### AWS CLI로 Amazon S3에 업로드

25. AWS CLI가 설치되어 있는지 확인합니다:

```bash
aws --version
```

<img src="/images/step5/5-3-step25-aws-version.png" alt="AWS CLI 버전 확인" class="guide-img-sm" />

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

<img src="/images/step5/5-3-step26-aws-configure2.png" alt="자격 증명 확인 결과" class="guide-img-sm" />

<img src="/images/step5/5-3-step26-aws-configure1.png" alt="자격 증명 설정" class="guide-img-sm" />

> [!OUTPUT]
>
> ```json
> {
>   "UserId": "AIDAXXXXXXXXXXXXXXXXX",
>   "Account": "123456789012",
>   "Arn": "arn:aws:iam::123456789012:user/admin-user"
> }
> ```

> [!TIP]
> **`Unable to locate credentials` 에러가 나오는 경우:**  
> Step 5-2에서 `--profile s3-dev`로 설정했다면 default 프로파일이 없을 수 있습니다.  
> 이 경우 모든 `aws` 명령어 뒤에 `--profile s3-dev`를 붙이거나, default로 다시 설정하세요:
>
> ```bash
> # 방법 1: 프로파일 지정하여 확인
> aws sts get-caller-identity --profile s3-dev
>
> # 방법 2: default 프로파일로 설정 (이후 명령에서 --profile 생략 가능)
> export AWS_PROFILE=s3-dev
> ```

> [!WARNING]
> **`AccessDenied` 에러가 나오는 경우:**  
> Step 5-2에서 생성한 `s3-dev-user`의 정책(`S3AppBucketPolicy`)은 `{닉네임}-starter-app` 버킷만 허용합니다.  
> 이 실습의 `{닉네임}-spa-hosting` 버킷에 접근하려면 **정책에 새 버킷을 추가**해야 합니다:
>
> - IAM 콘솔 → **Policies** → `S3AppBucketPolicy` 클릭
> - **Permissions** 탭 → [[Edit]] 클릭
> - JSON의 `Resource` 배열에 새 버킷 ARN 2줄을 추가:
>
> ```json
> "Resource": [
>   "arn:aws:s3:::{닉네임}-starter-app",
>   "arn:aws:s3:::{닉네임}-starter-app/*",
>   "arn:aws:s3:::{닉네임}-spa-hosting",
>   "arn:aws:s3:::{닉네임}-spa-hosting/*"
> ]
> ```
> - [[Next]] → [[Save changes]] 클릭
>
> 이후 `s3-dev` 프로파일로 두 버킷 모두 접근 가능합니다.
>
> <img src="/images/step5/5-3-step26-warning1.png" alt="IAM Policy 수정 1" class="guide-img-sm" />
>
> <img src="/images/step5/5-3-step26-warning2.png" alt="IAM Policy 수정 2" class="guide-img-sm" />
>
> <img src="/images/step5/5-3-step26-warning3.png" alt="IAM Policy 수정 3" class="guide-img-sm" />
>
> <img src="/images/step5/5-3-step26-warning4.png" alt="IAM Policy 수정 4" class="guide-img-sm" />

27. `dist/` 폴더의 내용을 Amazon S3 버킷에 동기화합니다:

```bash
aws s3 sync dist/ s3://{닉네임}-spa-hosting --delete
```

<img src="/images/step5/5-3-step27-s3-sync.png" alt="S3 sync 업로드" class="guide-img-sm" />

> [!TIP]
> **`aws s3 sync` 명령어 옵션 설명:**
>
> - `dist/`: 업로드할 로컬 폴더
> - `s3://{닉네임}-spa-hosting`: 대상 Amazon S3 버킷
> - `--delete`: S3에는 있지만 로컬에 없는 파일을 삭제 (완전 동기화)
>
> `--profile s3-dev`로 설정한 경우:
> ```bash
> aws s3 sync dist/ s3://{닉네임}-spa-hosting --delete --profile s3-dev
> ```
>
> `--delete` 옵션을 사용하면 이전 배포의 잔여 파일이 자동으로 정리됩니다.

> [!OUTPUT]
>
> ```
> upload: dist/index.html to s3://{닉네임}-spa-hosting/index.html
> upload: dist/assets/index-abc123.js to s3://{닉네임}-spa-hosting/assets/index-abc123.js
> upload: dist/assets/index-def456.css to s3://{닉네임}-spa-hosting/assets/index-def456.css
> upload: dist/favicon.ico to s3://{닉네임}-spa-hosting/favicon.ico
> ```

28. 업로드된 파일을 확인합니다:

```bash
aws s3 ls s3://{닉네임}-spa-hosting --recursive
```

<img src="/images/step5/5-3-step28-s3-ls.png" alt="S3 파일 목록 확인" class="guide-img-sm" />

> [!TIP]
> `AccessDenied` 에러 시 `--profile s3-dev`를 붙이거나, 앞서 `export AWS_PROFILE=s3-dev`를 실행했는지 확인하세요.

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
http://{닉네임}-spa-hosting.s3-website.ap-northeast-2.amazonaws.com
```

<img src="/images/step5/5-3-step29-browser-test.png" alt="S3 웹사이트 접속 확인" class="guide-img-sm" />

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

aws s3 sync ~/s3-website/ s3://{닉네임}-spa-hosting --delete
```

| 문제                                                  | 원인                                                | 해결                                             |
| ----------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------ |
| `upload failed: ... An error occurred (AccessDenied)` | AWS CLI 자격 증명에 S3 권한 없음                    | IAM 사용자에 `AmazonS3FullAccess` 정책 연결      |
| `fatal error: An error occurred (NoSuchBucket)`       | 버킷 이름 오타                                      | `aws s3 ls`로 정확한 버킷 이름 확인              |
| 브라우저에서 403 Forbidden                            | 버킷 정책 미설정 또는 Block Public Access 활성 상태 | 태스크 1의 6 ~8번, 18 ~ 21번 단계 재확인            |
| 브라우저에서 404 Not Found                            | index.html이 버킷 루트에 없음                       | `aws s3 ls s3://bucket-name/`으로 파일 위치 확인 |

<img src="/images/step5/5-3-step29-html-result1.png" alt="S3 웹사이트 접속 결과 1" class="guide-img-sm" />

<img src="/images/step5/5-3-step29-html-result2.png" alt="S3 웹사이트 접속 결과 2" class="guide-img-sm" />

✅ **태스크 완료**: Vue.js 빌드 파일(또는 HTML 파일)이 Amazon S3에 업로드되었고, HTTP 엔드포인트로 접속이 확인되었습니다.

---

## 태스크 3: CloudFront 배포 생성

Amazon S3 앞에 CloudFront를 배치하여 CDN 캐싱 + HTTPS + 전 세계 엣지 서빙을 적용합니다.

> [!CONCEPT] CloudFront CDN의 동작 원리
>
> ```
> ┌────────────────────────────────────────────────────────────────────┐
> │                    CloudFront CDN 동작                             │
> │                                                                    │
> │    사용자 (서울)          사용자 (도쿄)         사용자 (미국)      │
> │         │                     │                     │              │
> │         ▼                     ▼                     ▼              │
> │    ┌─────────┐          ┌─────────┐          ┌─────────┐           │
> │    │  서울   │          │  도쿄   │          │  미국   │           │
> │    │  엣지   │          │  엣지   │          │  엣지   │           │
> │    └────┬────┘          └─────┬───┘          └─────┬───┘           │
> │         │ 캐시 미스 시        │                    │               │
> │         ▼                     ▼                    ▼               │
> │    ┌──────────────────────────────────────────────────┐            │
> │    │              Origin (S3 Bucket)                  │            │
> │    │         ap-northeast-2 (서울 리전)               │            │
> │    └──────────────────────────────────────────────────┘            │
> │                                                                    │
> │    1차 요청: 엣지에 캐시 없음 → Origin(S3)에서 가져옴 (캐시 미스)  │
> │    2차 요청: 엣지 캐시에서 즉시 응답 (캐시 히트, 매우 빠름)        │
> └────────────────────────────────────────────────────────────────────┘
> ```
>
> **CloudFront가 제공하는 것:**
>
> - **HTTPS**: `*.cloudfront.net` 인증서 자동 적용 (별도 설정 불필요)
> - **CDN**: 전 세계 600+ 엣지 로케이션에서 캐싱
> - **DDoS 방어**: AWS Shield Standard 자동 적용
> - **성능**: 동일 요청에 대해 S3까지 가지 않고 엣지에서 즉시 응답

### CloudFront 콘솔 이동

30. 상단 검색창에 `CloudFront`를 입력하고 **CloudFront** 서비스를 선택합니다.
31. [[Create distribution]] 버튼을 클릭합니다.

> [!TIP]
> "Flat-rate security and delivery plans" 팝업이 나타나면 ✕로 닫으세요.
>
> <img src="/images/step5/5-3-step31-create-distribution-tip.png" alt="CloudFront 팝업 닫기" class="guide-img-sm" />

<img src="/images/step5/5-3-step31-create-distribution.png" alt="Create distribution" class="guide-img-sm" />

### Step 1: Choose a plan

32. **Pay as you go** (맨 아래)를 선택합니다.

    <img src="/images/step5/5-3-step32-pay-as-you-go.png" alt="Pay as you go 선택" class="guide-img-sm" />

33. [[Next]]를 클릭합니다.

> [!NOTE]
> | 플랜 | 비용 | 요청/전송 한도 | 특징 |
> | ---- | ---- | -------------- | ---- |
> | **Free** | $0/월 | 1M 요청 / 100GB 전송 | WAF, DDoS 보호, DNS 포함. 한도 내 무료 |
> | **Pay as you go** | 종량제 | 한도 없음 | 사용한 만큼만 과금. 기능 선택 자유 |
>
> 실습 수준(수십 건 요청, 수 MB 전송)이면 **Free로도 충분**합니다.  
> Pay as you go를 선택해도 실습 범위에서는 비용이 거의 발생하지 않습니다.  
> 본인 상황에 맞게 선택하세요.
>
> ⚠️ **콘솔 UI가 수시로 변경됩니다.** 화면에 표시되는 플랜 구성이 위 표와 다를 수 있습니다.  
> "Pay as you go"가 보이지 않는다면 **Free** 플랜을 선택해도 이 실습에 문제가 없습니다.

### Step 2: Get started

34. **Distribution name**: `spa-hosting` (또는 본인이 원하는 이름) 입력합니다.

    <img src="/images/step5/5-3-step34-distribution-name.png" alt="Distribution name 입력" class="guide-img-sm" />

35. **Description**: `SPA hosting with S3` (선택사항)
36. **Distribution type**: `Single website or app` 선택 (기본값).
37. **Domain** 섹션: 비워둡니다 (Route 53 도메인이 없으므로 건너뜀).
38. **Tags** 섹션을 펼쳐서 다음 태그를 추가합니다:
    - `CreatedBy` = `admin-user`
    - `Step` = `step5`
    - `Session` = `5-3`
39. [[Next]]를 클릭합니다.

### Step 3: Specify origin

40. **Origin type**: `Other`를 선택합니다.

    <img src="/images/step5/5-3-step40-origin-type.png" alt="Origin type Other 선택" class="guide-img-sm" />

> [!WARNING]
> **`Amazon S3`를 선택하지 마세요!**  
> Amazon S3를 선택하면 OAC(Origin Access Control)가 기본 활성화되어 private bucket 방식으로 동작합니다.  
> 이 실습에서는 S3 **정적 웹 호스팅 엔드포인트**(public bucket)를 사용하므로 `Other`를 선택해야 합니다.

41. **Origin** 필드에 S3 웹사이트 엔드포인트를 직접 입력합니다:
    - `{닉네임}-spa-hosting.s3-website.ap-northeast-2.amazonaws.com`

42. **Origin path**: 비워둡니다.
43. **Settings** 섹션:
    - **Origin settings**: `Customize origin settings`를 선택합니다.
    - **Protocol**: `HTTP only` 선택

> [!WARNING]
> **Protocol을 반드시 `HTTP only`로 설정하세요!**  
> S3 웹사이트 엔드포인트는 HTTP만 지원합니다.  
> `Use recommended origin settings`(기본값)를 그대로 두면 Protocol이 `HTTPS only`로 설정되어 **504 Gateway Timeout**이 발생합니다.
>
> <img src="/images/step5/5-3-step43-protocol-warning.png" alt="Protocol HTTP only 설정" class="guide-img-sm" />

44. **Cache settings**: `Customize cache settings` 선택
45. **Viewer protocol policy**: `Redirect HTTP to HTTPS` 선택
46. **Allowed HTTP methods**: `GET, HEAD` (기본값 유지)
47. **Cache policy**: `CachingOptimized` (기본값 — "Recommended for S3" 표시)
48. **Origin request policy**: 비워둡니다 (Select origin policy 그대로).
49. **Response headers policy**: 비워둡니다.
50. [[Next]]를 클릭합니다.

### Step 4: Enable security

51. **Web Application Firewall (WAF)**: `Do not enable security protections` 선택

    <img src="/images/step5/5-3-step51-waf-disable.png" alt="WAF 비활성화 선택" class="guide-img-sm" />

> [!WARNING]
> `Enable security protections`를 선택하면 **AWS WAF 비용이 월 $14 이상** 발생합니다.    
> 학습용 실습에서는 반드시 `Do not enable security protections`를 선택하세요.

52. [[Next]]를 클릭합니다.

### Step 5: Review and create

53. 설정 내용을 확인하고 [[Create distribution]] 버튼을 클릭합니다.

    <img src="/images/step5/5-3-step53-review1.png" alt="Review 확인" class="guide-img-sm" />

    <img src="/images/step5/5-3-step53-review2.png" alt="Create distribution 클릭" class="guide-img-sm" />

> [!OUTPUT]
> "Successfully created new distribution." 녹색 배너가 표시됩니다.  
> Distribution 상세 페이지로 이동되며 **Last modified**가 `Deploying` 상태입니다.
>
> - **Distribution domain name**: `d1r7u8klf5o6c2.cloudfront.net` 형태 (메모해 두세요)
> - **Status**: `Deploying` → 5~10분 후 완료

### Default root object 설정 (필수)

> [!WARNING]
> 새 콘솔 위저드에서는 Default root object가 자동 설정되지 않습니다.  
> 이 설정을 하지 않으면 `https://d1234abcdef.cloudfront.net/` 접속 시 **AccessDenied** 에러가 발생합니다.

54. 생성 직후 상세 페이지의 **General** 탭 → **Settings** 섹션에서 [[Edit]] 버튼을 클릭합니다.
55. **Default root object** 필드에 `index.html`을 입력합니다.

    <img src="/images/step5/5-3-step55-default-root.png" alt="Default root object 설정" class="guide-img-sm" />

56. [[Save changes]]를 클릭합니다.

    <img src="/images/step5/5-3-step56-save-changes.png" alt="Save changes 클릭" class="guide-img-sm" />

> [!TIP]
> **Price class** 변경도 같은 화면에서 가능합니다.  
> 비용을 줄이려면 `Use only North America and Europe`로 변경하세요 (선택사항).

> Distribution이 생성됩니다.
>
> - **Distribution ID**: `E1234ABCDEF` (메모해 두세요, 캐시 무효화에 사용)
> - **Distribution domain name**: `d1234abcdef.cloudfront.net` (메모해 두세요)
> - **Status**: `Deploying` → 5~10분 후 `Enabled`로 변경

> [!NOTE]
> CloudFront 배포 생성에 약 **5~10분**이 소요됩니다.  
> Status가 `Enabled`로 변경되고, Last modified에 날짜가 표시되면 배포가 완료된 것입니다.  
> 배포 완료 전에 접속하면 에러가 발생할 수 있으니 기다려주세요.
>
> <img src="/images/step5/5-3-step56-note.png" alt="배포 진행 상태 확인" class="guide-img-sm" />

### 에러 페이지 설정 (SPA 라우팅)

배포가 생성된 후, SPA 라우팅을 위한 커스텀 에러 응답을 설정합니다.

> [!CONCEPT] SPA 라우팅과 CloudFront 에러 페이지
>
> ```
> ┌─────────────────────────────────────────────────────────────┐
> │                SPA 라우팅 문제와 해결                       │
> │                                                             │
> │    문제 상황:                                               │
> │    사용자가 /about 직접 접속 또는 새로고침                  │
> │         │                                                   │
> │         ▼                                                   │
> │    CloudFront → Amazon S3에서 /about 파일 찾음 → 없음! → 403/404   │
> │                                                             │
> │    해결:                                                    │
> │    403/404 에러 발생 시 → index.html 반환 (HTTP 200)        │
> │         │                                                   │
> │         ▼                                                   │
> │    브라우저가 index.html 로드 → Vue Router가 /about 처리    │
> │                                                             │
> │    설정:                                                    │
> │    HTTP 403 → /index.html (200)                             │
> │    HTTP 404 → /index.html (200)                             │
> └─────────────────────────────────────────────────────────────┘
> ```

### Error pages 설정 (SPA 라우팅 필수)

57. **Error pages** 탭을 클릭합니다.

    <img src="/images/step5/5-3-step56-note.png" alt="Error pages 탭" class="guide-img-sm" />

58. [[Create custom error response]] 버튼을 클릭합니다.
59. 다음과 같이 설정합니다:
    - **HTTP error code**: `403: Forbidden` 선택
    - **Customize error response**: `Yes` 선택
    - **Response page path**: `/index.html`
    - **HTTP response code**: `200: OK` 선택

    <img src="/images/step5/5-3-step59-error-settings.png" alt="403 에러 응답 설정" class="guide-img-sm" />
60. [[Create custom error response]] 버튼을 클릭합니다.

    <img src="/images/step5/5-3-step60-403-error.png" alt="403 에러 응답 생성" class="guide-img-sm" />

61. 다시 [[Create custom error response]] 버튼을 클릭합니다.
62. 다음과 같이 설정합니다:
    - **HTTP error code**: `404: Not Found` 선택
    - **Customize error response**: `Yes` 선택
    - **Response page path**: `/index.html`
    - **HTTP response code**: `200: OK` 선택

    <img src="/images/step5/5-3-step62-404-error.png" alt="404 에러 응답 설정" class="guide-img-sm" />

63. [[Create custom error response]] 버튼을 클릭합니다.

    <img src="/images/step5/5-3-step63-error-created.png" alt="에러 페이지 설정 완료" class="guide-img-sm" />

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

> [!TROUBLESHOOTING]
> | 문제 | 원인 | 해결 |
> | ---- | ---- | ---- |
> | 접속 시 `502 Bad Gateway` | Origin 도메인 오타 | Distribution → Origins → Edit에서 도메인 확인 |
> | 접속 시 `AccessDenied` XML | Default root object 미설정 | Settings → Edit → Default root object에 `index.html` 입력 |
> | 접속 시 Amazon S3 버킷 목록 XML | REST API 엔드포인트를 Origin으로 사용 | Origin을 웹사이트 엔드포인트(`Other`)로 변경 |
> | HTTPS 접속 불가 | 배포 아직 Deploying | Status가 Enabled로 변경될 때까지 대기 (5~10분) |

✅ **태스크 완료**: CloudFront 배포가 생성되었고, Default root object + SPA 에러 페이지가 설정되었습니다.

---

## 태스크 4: CloudFront URL로 접속 확인 + SPA 라우팅 테스트

CloudFront 배포가 완료되면 HTTPS URL로 접속하여 정상 동작을 확인하고, SPA 라우팅이 올바르게 동작하는지 테스트합니다.

### 배포 상태 확인

64. CloudFront 콘솔 → **Distributions** 목록에서 생성한 Distribution의 **Last modified** 열을 확인합니다.
65. `Deploying`이 날짜/시간으로 변경되면 배포 완료입니다 (5~10분 소요).

> [!NOTE]
> Status가 아직 `Deploying`이면 배포가 진행 중입니다. 5~10분 더 기다려주세요.
> 페이지를 새로고침(F5)하면 상태가 업데이트됩니다.

### HTTPS 접속 확인

> [!TIP]
> 접속 전에 브라우저 개발자 도구(F12)를 열고 **Network** 탭을 선택한 뒤 접속하세요.  
> 첫 번째 요청(document)을 클릭하고 **Headers** 탭에서 다음을 확인합니다:
>
> | 헤더 | 의미 | 예시 |
> | ---- | ---- | ---- |
> | `X-Cache` | 캐시 상태 | `Miss from cloudfront` (첫 요청) / `Hit from cloudfront` (재요청) |
> | `X-Amz-Cf-Pop` | 응답한 엣지 로케이션 | `ICN53-P1` (인천) |
> | `Server` | Origin 서버 | `AmazonS3` |
> | `Via` | CloudFront 경유 확인 | `1.1 ...cloudfront.net (CloudFront)` |
> | `Age` | 캐시된 시간(초) | `446` (캐시 히트 시 표시) |
>
> **Timing** 탭에서는 DNS Lookup, Initial connection, SSL, Waiting 등 각 단계별 소요 시간을 확인할 수 있습니다.  
> `X-Cache: Error from cloudfront`가 나오면 에러 페이지 설정(403/404 → index.html)이 동작한 것입니다 — 페이지가 정상 표시되면 문제 없습니다.

66. **Distribution domain name**을 복사합니다 (예: `d1r7u8klf5o6c2.cloudfront.net`).
67. 브라우저 주소창에 다음을 입력하고 접속합니다:

```
https://d1234abcdef.cloudfront.net
```

<img src="/images/step5/5-3-step67-cloudfront-url.png" alt="CloudFront HTTPS 접속 확인" class="guide-img-sm" />

<img src="/images/step5/5-3-step67-https-cert.png" alt="HTTPS 인증서 확인" class="guide-img-sm" />

> [!OUTPUT]
>
> - Vue.js 앱(또는 HTML 페이지)이 정상적으로 표시됩니다.
> - 브라우저 주소창에 🔒 **자물쇠 아이콘**이 표시됩니다 (HTTPS 적용 확인).
> - 인증서 정보를 클릭하면 `*.cloudfront.net` 인증서가 표시됩니다.

68. `http://d1234abcdef.cloudfront.net` (HTTP)으로도 접속해봅니다.

    <img src="/images/step5/5-3-step68-http-redirect1.png" alt="HTTP 접속 시도" class="guide-img-sm" />

    <img src="/images/step5/5-3-step68-http-redirect2.png" alt="HTTPS로 리다이렉트 확인" class="guide-img-sm" />

    <img src="/images/step5/5-3-step68-cloudfront-page1.png" alt="CloudFront 페이지 확인 1" class="guide-img-sm" />

    <img src="/images/step5/5-3-step68-cloudfront-page2.png" alt="CloudFront 페이지 확인 2" class="guide-img-sm" />

    <img src="/images/step5/5-3-step68-cloudfront-page3.png" alt="CloudFront 페이지 확인 3" class="guide-img-sm" />

> [!OUTPUT]
> 자동으로 `https://d1234abcdef.cloudfront.net`으로 리다이렉트됩니다.  
> (태스크 3에서 Viewer protocol policy를 `Redirect HTTP to HTTPS`로 설정했기 때문)

### SPA 라우팅 테스트

SPA의 클라이언트 사이드 라우팅이 정상 동작하는지 확인합니다.

69. 브라우저에서 존재하지 않는 경로로 직접 접속합니다:

```
https://d1234abcdef.cloudfront.net/about
```

<img src="/images/step5/5-3-step69-spa-about.png" alt="SPA /about 라우팅 테스트" class="guide-img-sm" />

70. 페이지가 정상적으로 로드되는지 확인합니다.

> [!OUTPUT]
>
> - Vue.js 앱: Vue Router가 `/about` 경로를 처리하여 해당 페이지 컴포넌트가 표시됩니다.
> - HTML 파일: `index.html`이 표시됩니다 (SPA 라우터가 없으므로 기본 페이지).
>
> **핵심**: 403/404 에러 대신 `index.html`이 반환되고, SPA 라우터가 URL을 해석합니다.

> [!TIP]
> Network 탭에서 `X-Cache: Error from cloudfront`로 표시되지만 Status Code는 **200 OK**입니다.  
> 이것은 앞서 Error pages에서 403/404 에러를 `/index.html` + `200 OK`로 응답하도록 설정했기 때문입니다.  
> 실제로 Amazon S3에 `/about` 파일은 없지만(404), CloudFront가 `index.html`을 200으로 대신 응답 → SPA 라우터가 URL을 처리합니다.

71. 다른 경로도 테스트합니다:

```
https://d1234abcdef.cloudfront.net/users/123
https://d1234abcdef.cloudfront.net/settings
```

<img src="/images/step5/5-3-step71-other-routes1.png" alt="다른 경로 테스트 1" class="guide-img-sm" />

<img src="/images/step5/5-3-step71-other-routes2.png" alt="다른 경로 테스트 2" class="guide-img-sm" />

72. 각 경로에서 브라우저 **새로고침(F5)**을 눌러봅니다.

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

73. 브라우저 개발자 도구(F12)를 열고 **Network** 탭을 선택합니다.
74. 페이지를 새로고침합니다.
75. 첫 번째 요청(document)을 클릭하고 **Response Headers**를 확인합니다.

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
> │             캐시 히트 vs 미스                   │
> │                                                 │
> │    [첫 번째 요청] Cache Miss                    │
> │    사용자 → 엣지 (캐시 없음) → S3 Origin        │
> │                  ↓                              │
> │           캐시에 저장                           │
> │                                                 │
> │    [두 번째 요청] Cache Hit                     │
> │    사용자 → 엣지 (캐시 있음!) → 즉시 응답       │
> │                                                 │
> │    응답 시간 비교:                              │
> │    • Cache Miss: ~100ms (S3까지 왕복)           │
> │    • Cache Hit:  ~10ms  (엣지에서 즉시)         │
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
> │                캐시 무효화 시나리오                         │
> │                                                             │
> │    [상황] Amazon S3에 새 버전 업로드 후 CloudFront 접속            │
> │                                                             │
> │    사용자 → CloudFront 엣지                                 │
> │                │                                            │
> │                ├── 캐시에 이전 버전 있음 (TTL 만료 전)      │
> │                │   → 이전 버전 반환 (업데이트 안 보임!)     │
> │                │                                            │
> │    [해결] Invalidation 실행                                 │
> │                │                                            │
> │                ├── 엣지 캐시 강제 삭제                      │
> │                │                                            │
> │    사용자 → CloudFront 엣지 (캐시 없음)                     │
> │                │                                            │
> │                └── Amazon S3에서 새 버전 가져옴 → 새 버전 반환     │
> │                                                             │
> │    비용: 월 1,000개 경로까지 무료                           │
> │    시간: 보통 1~2분 내 전 세계 엣지에 반영                  │
> └─────────────────────────────────────────────────────────────┘
> ```

### S3 파일 업데이트

📍 **실행 위치: 로컬 PC** (터미널)

캐시 무효화를 체험하려면 먼저 Amazon S3의 파일을 변경해야 합니다.

> [!TIP]
> 변경 방법은 자유입니다:
> - 기존 Vue 프로젝트 소스를 수정 → 빌드 → 재업로드
> - `index.html`을 새로 만들어서 배포
> - 기존 파일에 텍스트 한 줄만 추가
>
> 핵심은 **S3의 파일이 바뀌었는데 CloudFront에서는 이전 버전이 보이는 상황**을 만드는 것입니다.
>
> <img src="/images/step5/5-3-step76-tip-update.png" alt="파일 수정 예시" class="guide-img-sm" />

**Vue.js 프로젝트 (기존 빌드 사용자):**

76. 소스 코드를 수정합니다 (예: App.vue에 텍스트 한 줄 추가).
77. 다시 빌드합니다:

```bash
npm run build
```

78. Amazon S3에 재업로드합니다:

```bash
aws s3 sync dist/ s3://{닉네임}-spa-hosting --delete
```

**HTML 직접 작성 (신규 사용자):**

79. 업로드했던 `index.html`에 변경 사항을 추가합니다:

```bash
echo '<p style="color:red;">v2 - 캐시 무효화 테스트</p>' >> index.html
```

80. Amazon S3에 재업로드합니다 (파일이 있는 폴더에서 실행):

```bash
aws s3 sync ./ s3://{닉네임}-spa-hosting --delete
```

> [!TIP]
> 업로드 경로는 본인이 태스크 2에서 사용한 폴더에 맞게 변경하세요:
> - Vue 프로젝트: `dist/`
> - 태스크 2에서 `~/s3-website/`로 만든 경우: `~/s3-website/`
> - 현재 폴더에 `index.html`이 있으면: `./`

> [!TIP]
> `--profile` 옵션은 본인의 AWS CLI 설정에 맞게 사용하세요:
> - default 프로파일을 사용 중이면 생략 가능
> - `s3-dev` 프로파일을 사용 중이면 `--profile s3-dev` 추가
> - 앞서 `export AWS_PROFILE=s3-dev`를 실행했으면 생략 가능

---

81. 브라우저에서 CloudFront URL을 새로고침합니다 — **이전 버전이 그대로 표시**되는지 확인합니다.

    <img src="/images/step5/5-3-step81-old-version.png" alt="이전 버전 캐시 확인" class="guide-img-sm" />

> [!OUTPUT]
> S3에는 새 파일을 올렸지만, CloudFront는 캐시된 이전 버전을 반환합니다.  
> 이것이 캐시 무효화가 필요한 이유입니다.

### 콘솔에서 캐시 무효화

📍 **실행 위치: 로컬 PC (브라우저 — AWS 콘솔)**

82. CloudFront 콘솔에서 배포를 클릭하여 상세 페이지로 이동합니다.
83. **Invalidations** 탭을 클릭합니다.

    <img src="/images/step5/5-3-step83-invalidations-tab.png" alt="Invalidations 탭" class="guide-img-sm" />

84. [[Create invalidation]] 버튼을 클릭합니다.
85. **Add object paths** 필드에 다음을 입력합니다:
    - `/*`

    <img src="/images/step5/5-3-step85-object-paths.png" alt="Object paths 입력" class="guide-img-sm" />

86. [[Create invalidation]] 버튼을 클릭합니다.

    <img src="/images/step5/5-3-step86-create-invalidation.png" alt="Create invalidation 완료" class="guide-img-sm" />

> [!OUTPUT]
> Invalidation이 생성됩니다:
>
> - **Invalidation ID**: `I1234ABCDEF`
> - **Status**: `In progress` → 1~2분 후 `Completed`로 변경

87. Status가 `Completed`로 변경될 때까지 대기합니다 (약 1~2분).

    <img src="/images/step5/5-3-step87-completed.png" alt="Invalidation Completed" class="guide-img-sm" />

88. 브라우저에서 CloudFront URL을 **강력 새로고침**(Ctrl+Shift+R 또는 Cmd+Shift+R)합니다.

    <img src="/images/step5/5-3-step88-new-version.png" alt="업데이트된 콘텐츠 확인" class="guide-img-sm" />

> [!OUTPUT]
> 업데이트된 콘텐츠(v2 텍스트)가 표시됩니다.

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

89. 터미널에서 다음 명령어를 실행합니다:

```bash
aws cloudfront create-invalidation \
  --distribution-id {Distribution-ID} \
  --paths "/*"
```

<img src="/images/step5/5-3-step89-cli-invalidate1.png" alt="CLI 캐시 무효화 1" class="guide-img-sm" />

<img src="/images/step5/5-3-step89-cli-invalidate2.png" alt="CLI 캐시 무효화 2" class="guide-img-sm" />

<img src="/images/step5/5-3-step89-cli-invalidate3.png" alt="CLI 캐시 무효화 3" class="guide-img-sm" />

<img src="/images/step5/5-3-step89-cli-invalidate4.png" alt="CLI 캐시 무효화 4" class="guide-img-sm" />

> [!NOTE]
> **명령어 옵션 설명:**
>
> | 옵션 | 의미 | 예시 |
> | ---- | ---- | ---- |
> | `create-invalidation` | 캐시 무효화 요청 생성 | — |
> | `--distribution-id` | 대상 Distribution ID | `EB34SOTGOG5WH` |
> | `--paths` | 무효화할 경로 패턴 | `"/*"` (전체), `"/index.html"` (단일 파일) |
>
> `{Distribution-ID}`를 본인의 Distribution ID로 교체하세요.  
> CloudFront 콘솔 → 배포 상세 페이지 상단 또는 배포 목록의 **ID** 열에서 확인할 수 있습니다.

> [!TIP]
> **`s3-dev` 프로파일로는 CloudFront 권한이 없을 수 있습니다.**  
> 이 명령어는 Amazon S3가 아닌 CloudFront 서비스 호출이므로 `s3-dev-user`의 정책에 포함되지 않습니다.  
> 다음 중 하나로 실행하세요:
>
> - **AWS CloudShell 사용 (권장)**: AWS 콘솔 우측 상단의 `>_` 아이콘을 클릭하면 브라우저에서 바로 터미널이 열립니다. admin 권한으로 동작하므로 별도 설정 없이 실행 가능합니다.
> - admin 프로파일 사용: `--profile default` (admin으로 설정한 경우)
> - 콘솔에서 무효화: 위 "콘솔에서 캐시 무효화" 방법 사용

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

### 배포 자동화 스크립트 (S3 업로드 + 캐시 무효화)

본인 환경에 맞는 방법을 선택하세요.

| 방법 | 대상 | 설명 |
| ---- | ---- | ---- |
| **방법 A** | 로컬에서 admin 프로파일 사용 가능 | 로컬에서 빌드 + 업로드 + 무효화 전체 실행 |
| **방법 B** | `s3-dev`에 CloudFront 권한 없음 | CloudShell에서 간단한 HTML로 전체 흐름 실행 |

---

**방법 A: 로컬에서 전체 실행**

📍 **실행 위치: 로컬 PC** (터미널)

90. 다음 스크립트를 `deploy.sh`로 저장합니다:

```bash
#!/bin/bash

# 변수 설정 (본인의 값으로 교체)
BUCKET_NAME="{닉네임}-spa-hosting"
DISTRIBUTION_ID="{Distribution-ID}"
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

> [!NOTE]
> 스크립트 상단의 변수를 본인의 값으로 교체하세요:
> - `{닉네임}-spa-hosting` → 본인의 Amazon S3 버킷 이름
> - `{Distribution-ID}` → CloudFront Distribution ID (콘솔에서 확인)
> - `BUILD_DIR` → 빌드 결과 폴더 (Vue: `dist`, 직접 작성: 파일이 있는 폴더)

91. 스크립트에 실행 권한을 부여합니다:

```bash
chmod +x deploy.sh
```

92. 스크립트를 실행합니다:

```bash
./deploy.sh
```

> [!OUTPUT]
>
> ```
> 🔨 빌드 시작...
> ✓ built in 1.23s
> 📤 S3 업로드 중...
> upload: dist/index.html to s3://{닉네임}-spa-hosting/index.html
> upload: dist/assets/index-abc123.js to s3://{닉네임}-spa-hosting/assets/index-abc123.js
> 🔄 캐시 무효화 중...
> ✅ 배포 완료! 1~2분 후 반영됩니다.
> ```

> [!CONCEPT] 이것이 Step 9에서 하는 것의 기초
>
> ```
> ┌───────────────────────────────────────────────────────────┐
> │           수동 배포 → CI/CD 자동화 (Step 9)               │
> │                                                           │
> │    [지금 - 수동]                                          │
> │    개발자가 터미널에서 직접 실행:                         │
> │    1. npm run build                                       │
> │    2. aws s3 sync                                         │
> │    3. aws cloudfront create-invalidation                  │
> │                                                           │
> │    [Step 9 - 자동]                                        │
> │    git push만 하면 GitHub Actions가 자동 실행:            │
> │    1. git push → GitHub Actions 트리거                    │
> │    2. npm run build → Vue.js 빌드                         │
> │    3. aws s3 sync → S3 업로드                             │
> │    4. aws cloudfront create-invalidation → 캐시 무효화    │
> │                                                           │
> │    지금 수동으로 하는 것을 자동화하는 것뿐입니다.         │
> └───────────────────────────────────────────────────────────┘
> ```

| 문제                                     | 원인                        | 해결                                          |
| ---------------------------------------- | --------------------------- | --------------------------------------------- |
| `An error occurred (NoSuchDistribution)` | Distribution ID 오타        | CloudFront 콘솔에서 정확한 ID 복사            |
| `An error occurred (AccessDenied)`       | IAM 권한 부족               | `CloudFrontFullAccess` 정책 연결 필요         |
| 무효화 후에도 이전 버전 표시             | 브라우저 로컬 캐시          | Ctrl+Shift+R (강력 새로고침) 또는 시크릿 모드 |
| Invalidation Status가 계속 InProgress    | 정상 (전 세계 엣지 반영 중) | 1~2분 대기, 최대 5분 소요 가능                |

---

**방법 B: CloudShell에서 실행 (CloudFront 권한이 로컬에 없는 경우)**

📍 **실행 위치: AWS CloudShell** (콘솔 우측 상단 `>_` 아이콘 클릭)

93. CloudShell을 열고 간단한 index.html을 생성합니다:

    <img src="/images/step5/5-3-step93-cloudshell.png" alt="CloudShell 열기" class="guide-img-sm" />

```bash
mkdir -p ~/site
cat > ~/site/index.html << 'EOF'
<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head><body><h1>CloudShell Deploy Test</h1></body></html>
EOF
```

94. deploy.sh 스크립트를 생성합니다:

    <img src="/images/step5/5-3-step94-deploy-sh.png" alt="deploy.sh 스크립트 생성" class="guide-img-sm" />

```bash
cat > ~/deploy.sh << 'EOF'
#!/bin/bash
# ============================================================
# 아래 2개 변수를 본인 값으로 교체하세요
# BUCKET_NAME: S3 버킷 이름 (예: mylab-spa-hosting)
# DISTRIBUTION_ID: CloudFront Distribution ID (예: EB34SOTGOG5WH)
# ============================================================
BUCKET_NAME="{닉네임}-spa-hosting"
DISTRIBUTION_ID="{Distribution-ID}"

echo "📤 S3 업로드 중..."
aws s3 sync ~/site/ s3://$BUCKET_NAME --delete

echo "🔄 캐시 무효화 중..."
aws cloudfront create-invalidation --distribution-id $DISTRIBUTION_ID --paths "/*"

echo "✅ 배포 완료!"
EOF
chmod +x ~/deploy.sh
```

95. 변수를 본인 값으로 수정합니다:

    <img src="/images/step5/5-3-step95-vi-edit.png" alt="vi로 변수 수정" class="guide-img-sm" />

```bash
vi ~/deploy.sh
```

> [!TIP]
> vi 기본 사용법:
> - `i` → 입력 모드 (값 수정)
> - `Esc` → 명령 모드로 복귀
> - `:wq` + Enter → 저장 후 종료

96. 스크립트를 실행합니다:

```bash
~/deploy.sh
```

<img src="/images/step5/5-3-step96-run-deploy.png" alt="deploy.sh 실행 결과" class="guide-img-sm" />

97. 브라우저에서 CloudFront URL 접속 → "CloudShell Deploy Test"가 표시되면 성공합니다.

    <img src="/images/step5/5-3-step97-browser-verify.png" alt="브라우저에서 배포 확인" class="guide-img-sm" />

98. 내용을 수정하고 다시 배포해봅니다:

```bash
cat > ~/site/index.html << 'EOF'
<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head><body><h1>v2 - Updated</h1></body></html>
EOF

~/deploy.sh
```

<img src="/images/step5/5-3-step98-redeploy1.png" alt="재배포 실행" class="guide-img-sm" />

<img src="/images/step5/5-3-step98-redeploy2.png" alt="v2 확인" class="guide-img-sm" />

> [!OUTPUT]
> 1~2분 후 브라우저에서 "v2 - Updated"가 표시되면 캐시 무효화까지 정상 동작한 것입니다.

✅ **태스크 완료**: 콘솔과 CLI(또는 CloudShell) 모두에서 캐시 무효화를 실행하고, 배포 자동화 스크립트를 작성했습니다.

---

## 마무리

다음을 성공적으로 수행했습니다:

- Amazon S3 버킷에 정적 웹 호스팅을 설정했습니다 (Block Public Access 해제 + 버킷 정책 + 호스팅 활성화).
- AWS CLI로 Vue.js 빌드 파일을 Amazon S3에 업로드했습니다.
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
> CloudFront와 Amazon S3 정적 호스팅은 요청 기반 과금으로 비용이 매우 저렴하지만 (학습 수준에서 거의 무료),
> 깔끔하게 정리하려면 아래 단계를 **의존 관계 순서대로** 따릅니다.
>
> **삭제 순서 원칙**: CloudFront가 Amazon S3를 참조하므로, CloudFront를 먼저 삭제해야 합니다.
>
> ```
> ① Tag Editor 확인 → ② CloudFront Disable → ③ CloudFront Delete
>     → ④ S3 Empty → ⑤ S3 Delete → ⑥ Tag Editor 최종 확인
> ```

> [!NOTE]
> **S3 버킷을 이후 실습에서 재사용하려면:**
> - CloudFront만 삭제하고 Amazon S3 버킷은 유지해도 됩니다 (단계 4~5 건너뜀).
> - Amazon S3 정적 호스팅 비용은 저장된 파일 크기에 비례하며, 수 MB 수준이면 월 1원 미만입니다.
> - 완전히 정리하고 싶다면 모든 단계를 수행하세요.

---

### 단계 1: Tag Editor로 생성된 리소스 확인

📍 **실행 위치: 로컬 PC (브라우저 — AWS 콘솔)**

삭제 전에 이 실습에서 생성한 리소스를 확인합니다.

1. AWS Management Console 상단 검색창에 `Resource Groups & Tag Editor`를 입력하고 선택합니다.
2. 왼쪽 메뉴에서 **Tag Editor**를 클릭합니다.
3. 다음과 같이 설정합니다:
    - **Regions**: `ap-northeast-2` (서울)
    - **Resource types**: `All supported resource types`
4. **Tags** 섹션에서 [[Add tag]] 버튼을 클릭합니다.
5. **Tag key**에 `Session`, **Tag value**에 `5-3`을 입력합니다.
6. [[Search resources]] 버튼을 클릭합니다.

    <img src="/images/step5/5-3-cleanup6-tag-editor.png" alt="Tag Editor 검색 결과" class="guide-img-sm" />

7. 이 실습에서 생성한 리소스(CloudFront Distribution, S3 Bucket)가 표시되는지 확인합니다.

> [!TIP]
> Tag Editor는 리소스를 **찾는 용도**로만 사용합니다.  
> 여기서 직접 삭제할 수는 없습니다. 실제 삭제는 다음 단계에서 각 서비스 콘솔에서 수행합니다.

---

### 단계 2: CloudFront 배포 비활성화 (Disable)

📍 **실행 위치: 로컬 PC (브라우저 — AWS 콘솔)**

CloudFront 배포는 즉시 삭제할 수 없습니다. 먼저 비활성화(Disable)한 후 삭제해야 합니다.

8. 상단 검색창에 `CloudFront`를 입력하고 **CloudFront** 서비스를 선택합니다.
9. Distributions 목록에서 이 실습에서 생성한 배포를 선택합니다 (체크박스 클릭).
10. [[Disable]] 버튼을 클릭합니다.

    <img src="/images/step5/5-3-cleanup10-disable-cf.png" alt="CloudFront Disable" class="guide-img-sm" />

11. 확인 팝업에서 [[Disable]] 버튼을 클릭합니다.

    <img src="/images/step5/5-3-cleanup11-confirm-disable1.png" alt="Disable 확인 1" class="guide-img-sm" />

    <img src="/images/step5/5-3-cleanup11-confirm-disable2.png" alt="Disable 확인 2" class="guide-img-sm" />

> [!OUTPUT]
> Last modified가 `Deploying` 상태로 변경됩니다.  
> **Disabled 상태가 될 때까지 약 5~10분 소요됩니다.**

12. Last modified에 날짜/시간이 다시 표시될 때까지 대기합니다 (페이지 새로고침).

    <img src="/images/step5/5-3-cleanup12-deploying1.png" alt="Deploying 상태" class="guide-img-sm" />

    <img src="/images/step5/5-3-cleanup12-deploying2.png" alt="Disabled 완료" class="guide-img-sm" />

> [!WARNING]
> Disabled 상태가 되기 전에는 Delete 버튼이 활성화되지 않습니다.  
> 반드시 대기 후 다음 단계로 진행하세요.

---

### 단계 3: CloudFront 배포 삭제 (Delete)

13. 배포가 Disabled된 것을 확인합니다.
14. 해당 배포를 다시 선택합니다 (체크박스 클릭).
15. [[Delete]] 버튼을 클릭합니다.

    <img src="/images/step5/5-3-cleanup15-delete-cf.png" alt="Delete 버튼 클릭" class="guide-img-sm" />

16. 확인 팝업에서 [[Delete]] 버튼을 클릭합니다.

    <img src="/images/step5/5-3-cleanup16-confirm-delete1.png" alt="Delete 확인 1" class="guide-img-sm" />

    <img src="/images/step5/5-3-cleanup16-confirm-delete2.png" alt="Delete 확인 2" class="guide-img-sm" />

> [!OUTPUT]
> Distribution이 목록에서 사라집니다.

---

### 단계 4: Amazon S3 버킷 비우기 (Empty)

> [!NOTE]
> Amazon S3 버킷을 이후 실습에서 재사용하려면 이 단계와 단계 5를 건너뛰세요.

Amazon S3 버킷은 비어있어야만 삭제할 수 있습니다. 먼저 모든 객체를 삭제합니다.

17. 상단 검색창에 `S3`를 입력하고 **S3** 서비스를 선택합니다.
18. Buckets 목록에서 `{닉네임}-spa-hosting` 버킷을 선택합니다 (체크박스 클릭).

    <img src="/images/step5/5-3-cleanup18-s3-select.png" alt="S3 버킷 선택" class="guide-img-sm" />

> [!WARNING]
> **버킷 이름을 클릭하면** 버킷 내부로 이동합니다. **체크박스를 클릭**해야 Empty/Delete 버튼이 활성화됩니다.

19. [[Empty]] 버튼을 클릭합니다.
20. 확인 필드에 `permanently delete`를 입력합니다.

    <img src="/images/step5/5-3-cleanup20-permanently-delete.png" alt="permanently delete 입력" class="guide-img-sm" />

21. [[Empty]] 버튼을 클릭합니다.

    <img src="/images/step5/5-3-cleanup21-empty-complete.png" alt="Empty 완료" class="guide-img-sm" />

> [!OUTPUT]
> "Successfully emptied bucket" 메시지가 표시됩니다.

---

### 단계 5: Amazon S3 버킷 삭제 (Delete)

22. Buckets 목록에서 `{닉네임}-spa-hosting` 버킷을 다시 선택합니다 (체크박스 클릭).
23. [[Delete]] 버튼을 클릭합니다.

    <img src="/images/step5/5-3-cleanup23-delete-bucket-btn.png" alt="Delete 버튼 클릭" class="guide-img-sm" />

24. 확인 필드에 버킷 이름(`{닉네임}-spa-hosting`)을 입력합니다.

    <img src="/images/step5/5-3-cleanup24-bucket-name.png" alt="버킷 이름 입력" class="guide-img-sm" />

25. [[Delete bucket]] 버튼을 클릭합니다.

    <img src="/images/step5/5-3-cleanup25-deleted.png" alt="버킷 삭제 완료" class="guide-img-sm" />

> [!OUTPUT]
> "Successfully deleted bucket" 메시지가 표시됩니다.

---

### 단계 6: Tag Editor로 최종 확인

26. 단계 1과 동일하게 **Tag Editor**에서 다시 검색합니다:
    - **Regions**: `ap-northeast-2`
    - **Tag key**: `Session`, **Tag value**: `5-3`
    - [[Search resources]] 클릭
27. 검색 결과가 비어있는지 확인합니다.

    <img src="/images/step5/5-3-cleanup27-tag-verify.png" alt="Tag Editor 최종 확인" class="guide-img-sm" />

> [!OUTPUT]
> 결과가 비어있으면 모든 리소스가 정상 정리된 것입니다.  
> 리소스가 남아있다면 해당 리소스를 클릭하여 서비스 콘솔에서 수동 삭제합니다.

> [!TIP]
> `Session: 5-3`으로 검색했을 때 결과가 비어있어도, `Step: step5`로도 한 번 더 검색해보세요.  
> 5-1, 5-2에서 생성한 리소스가 남아있을 수 있습니다.  
> 모든 Step 5 실습이 끝났다면 `Tag key: Step`, `Tag value: step5`로 검색하여 잔여 리소스를 일괄 확인할 수 있습니다.

---

### 삭제 확인 체크리스트

| 확인 항목 | 확인 방법 | 정상 상태 |
| --------- | --------- | --------- |
| CloudFront Distribution | CloudFront 콘솔 → Distributions | 목록에서 사라짐 |
| Amazon S3 버킷 | S3 콘솔 → Buckets | 목록에서 사라짐 (또는 유지 선택) |
| Tag Editor | `Session=5-3` 검색 | 결과 없음 |

> [!TROUBLESHOOTING]
> | 문제 | 원인 | 해결 |
> | ---- | ---- | ---- |
> | CloudFront Delete 버튼 비활성화 | 아직 Disabled 상태가 아님 | 5~10분 대기 후 페이지 새로고침 |
> | S3 Delete 시 "Bucket is not empty" | 버킷 비우기(Empty) 미실행 | 단계 4의 98~100번 먼저 실행 |
> | S3 Empty 시 "Access Denied" | IAM 권한 부족 | admin 계정으로 로그인 확인 |

> [!TIP]
> **키 페어, IAM 사용자(`s3-dev-user`)는 삭제하지 마세요.**  
> 비용이 발생하지 않으며, 이후 실습에서 재사용할 수 있습니다.

✅ **실습 종료**: 모든 리소스가 정리되었습니다.

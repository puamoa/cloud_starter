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

이 실습에서는 S3에 정적 웹사이트를 호스팅하고, CloudFront를 연결하여 CDN + HTTPS를 적용합니다. EC2 없이도 웹사이트를 전 세계에 빠르게 서빙할 수 있는 서버리스 호스팅 방식을 체험합니다.

> [!NOTE]
> 이 실습은 독립적으로 진행할 수 있습니다. 간단한 HTML 파일로 실습하며, Step 9에서 Vue.js 프로젝트를 배포할 때 이 경험이 활용됩니다.

> [!CONCEPT] EC2 vs S3+CloudFront 정적 호스팅
> EC2에 Nginx를 설치하여 정적 파일을 서빙하는 방식과, S3 + CloudFront를 사용하는 서버리스 방식을 비교합니다. 정적 사이트(SPA)에는 S3 + CloudFront가 비용, 성능, 관리 모든 면에서 유리합니다.

| 항목        | EC2 + Nginx              | S3 + CloudFront       |
| ----------- | ------------------------ | --------------------- |
| 서버 관리   | OS 패치, Nginx 설정 필요 | 없음 (서버리스)       |
| 확장        | Auto Scaling 설정 필요   | 자동 (무제한)         |
| HTTPS       | ACM + ALB 필요           | CloudFront 기본 제공  |
| 비용        | EC2 시간당 과금          | 요청 기반 (매우 저렴) |
| 속도        | 단일 리전                | 전 세계 엣지 캐싱     |
| 적합한 경우 | SSR, 동적 콘텐츠         | SPA, 정적 사이트      |

---

## 태스크 1: 샘플 웹사이트 준비

간단한 HTML/CSS 파일을 만들어 S3에 업로드합니다.

1. 로컬에 작업 폴더를 생성합니다:

```bash
mkdir ~/s3-website && cd ~/s3-website
```

2. `index.html` 파일을 생성합니다:

```html
<!DOCTYPE html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>S3 + CloudFront 호스팅 테스트</title>
    <style>
      body {
        font-family: sans-serif;
        max-width: 600px;
        margin: 50px auto;
        padding: 20px;
      }
      h1 {
        color: #0972d3;
      }
      .info {
        background: #f0f8ff;
        padding: 15px;
        border-radius: 8px;
        margin: 20px 0;
      }
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
        <li>서버: 없음 (서버리스)</li>
      </ul>
    </div>
    <p><a href="/about.html">About 페이지로 이동</a></p>
  </body>
</html>
```

3. `about.html` 파일을 생성합니다:

```html
<!DOCTYPE html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <title>About - S3 호스팅</title>
    <style>
      body {
        font-family: sans-serif;
        max-width: 600px;
        margin: 50px auto;
        padding: 20px;
      }
    </style>
  </head>
  <body>
    <h1>📖 About</h1>
    <p>S3 정적 웹 호스팅 + CloudFront CDN 실습 페이지입니다.</p>
    <p><a href="/">← 홈으로</a></p>
  </body>
</html>
```

4. `error.html` 파일을 생성합니다:

```html
<!DOCTYPE html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <title>404 - 페이지를 찾을 수 없습니다</title>
    <style>
      body {
        font-family: sans-serif;
        max-width: 600px;
        margin: 50px auto;
        padding: 20px;
        text-align: center;
      }
    </style>
  </head>
  <body>
    <h1>404</h1>
    <p>요청하신 페이지를 찾을 수 없습니다.</p>
    <p><a href="/">홈으로 돌아가기</a></p>
  </body>
</html>
```

✅ **태스크 완료**: 샘플 웹사이트 파일(index.html, about.html, error.html)을 준비했습니다.

---

## 태스크 2: S3 버킷 생성 및 정적 웹 호스팅 설정

1. AWS Console → **S3** 서비스로 이동합니다.
2. [[Create bucket]]을 클릭합니다.
3. 다음을 설정합니다:
   - **Bucket name**: `my-static-site-{계정ID}` (전 세계 고유)
   - **Region**: `ap-northeast-2`
4. **Block Public Access settings**:
   - ☐ **Block all public access** 체크 해제
   - ✅ 경고 확인 체크박스 선택
5. [[Create bucket]]을 클릭합니다.

### 정적 웹 호스팅 활성화

6. 생성된 버킷을 클릭합니다.
7. **Properties** 탭 → **Static website hosting** 섹션 → [[Edit]]을 클릭합니다.
8. 다음을 설정합니다:
   - **Static website hosting**: `Enable`
   - **Index document**: `index.html`
   - **Error document**: `error.html`
9. [[Save changes]]를 클릭합니다.

### 버킷 정책 추가

10. **Permissions** 탭 → **Bucket policy** → [[Edit]]을 클릭합니다.
11. 다음 정책을 입력합니다:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::my-static-site-{계정ID}/*"
    }
  ]
}
```

> [!WARNING]
> `my-static-site-{계정ID}` 부분을 본인의 버킷 이름으로 교체하세요.

12. [[Save changes]]를 클릭합니다.

### 파일 업로드

13. **Objects** 탭 → [[Upload]]를 클릭합니다.
14. [[Add files]]를 클릭하여 `index.html`, `about.html`, `error.html`을 선택합니다.
15. [[Upload]]를 클릭합니다.

### S3 웹사이트 엔드포인트 확인

16. **Properties** 탭 → **Static website hosting** 섹션에서 **Bucket website endpoint**를 복사합니다.
17. 브라우저에서 접속하여 페이지가 표시되는지 확인합니다.

> [!OUTPUT]
> `http://my-static-site-xxx.s3-website.ap-northeast-2.amazonaws.com`
> 으로 접속하면 "🚀 S3 + CloudFront 정적 호스팅" 페이지가 표시됩니다.

> [!NOTE]
> S3 웹사이트 엔드포인트는 HTTP만 지원합니다. HTTPS는 CloudFront를 통해 적용합니다.

✅ **태스크 완료**: S3 정적 웹 호스팅을 설정하고 웹사이트를 확인했습니다.

---

## 태스크 3: CloudFront 배포 생성

S3 앞에 CloudFront를 배치하여 CDN + HTTPS를 적용합니다.

1. AWS Console → **CloudFront** 서비스로 이동합니다.
2. [[Create distribution]]을 클릭합니다.

### Origin 설정

3. **Origin domain**: S3 버킷의 **웹사이트 엔드포인트**를 직접 입력합니다.
   - 형식: `my-static-site-xxx.s3-website.ap-northeast-2.amazonaws.com`

> [!WARNING]
> 드롭다운에서 S3 버킷을 선택하지 마세요! 드롭다운은 REST API 엔드포인트를 사용하며, 정적 웹 호스팅의 리다이렉트/에러 페이지가 동작하지 않습니다.
> 반드시 **웹사이트 엔드포인트**를 직접 입력하세요.

4. **Protocol**: `HTTP only`

### 캐시 동작 설정

5. **Viewer protocol policy**: `Redirect HTTP to HTTPS`
6. **Cache policy**: `CachingOptimized`

### 기본 설정

7. **Default root object**: `index.html`
8. **Price class**: `Use only North America and Europe` (비용 절약)

### 에러 페이지 설정

9. 나머지 설정은 기본값 유지 → [[Create distribution]]을 클릭합니다.
10. 배포 생성 후 **Error pages** 탭 → [[Create custom error response]]를 클릭합니다.
11. 다음을 설정합니다:

| HTTP error code | Customize error response | Response page path | HTTP response code |
| --------------- | ------------------------ | ------------------ | ------------------ |
| 404             | Yes                      | `/error.html`      | 404                |

12. [[Create custom error response]]를 클릭합니다.

> [!NOTE]
> 배포 생성에 약 5~10분 소요됩니다. Status가 `Enabled`로 변경되면 완료입니다.

### CloudFront URL로 접속

13. **Distribution domain name**을 복사합니다 (예: `d1234abcdef.cloudfront.net`).
14. 브라우저에서 접속합니다:

```
https://d1234abcdef.cloudfront.net
```

> [!OUTPUT]
> HTTPS로 동일한 페이지가 표시됩니다. 브라우저 주소창에 🔒 자물쇠 아이콘이 표시됩니다.

15. `https://d1234abcdef.cloudfront.net/about.html`로도 접속하여 확인합니다.
16. 존재하지 않는 경로 `https://d1234abcdef.cloudfront.net/xyz`로 접속하면 error.html이 표시됩니다.

> [!CONCEPT] CloudFront가 제공하는 것
>
> - **HTTPS**: 별도 인증서 설정 없이 자동 적용 (\*.cloudfront.net 인증서)
> - **CDN**: 전 세계 엣지 로케이션에서 캐싱하여 빠른 응답
> - **DDoS 방어**: AWS Shield Standard 자동 적용
> - **캐싱**: 동일 요청에 대해 S3까지 가지 않고 엣지에서 응답

✅ **태스크 완료**: CloudFront 배포를 생성하여 CDN + HTTPS를 적용했습니다.

---

## 태스크 4: 캐시 무효화 (콘텐츠 업데이트)

S3의 파일을 수정한 후 CloudFront 캐시를 무효화하는 방법을 학습합니다.

1. `index.html`을 수정합니다 (예: 제목 변경).
2. S3 콘솔에서 수정된 파일을 다시 업로드합니다.
3. CloudFront URL에 접속하면 **이전 버전**이 표시됩니다 (캐시 때문).

### 캐시 무효화 실행

4. CloudFront 콘솔 → 배포 선택 → **Invalidations** 탭을 클릭합니다.
5. [[Create invalidation]]을 클릭합니다.
6. **Object paths**에 `/*`를 입력합니다 (모든 파일 무효화).
7. [[Create invalidation]]을 클릭합니다.
8. Status가 `Completed`가 될 때까지 대기합니다 (약 1~2분).
9. 브라우저에서 새로고침하면 수정된 내용이 표시됩니다.

### CLI로 캐시 무효화

```bash
aws cloudfront create-invalidation \
  --distribution-id E1234ABCDEF \
  --paths "/*"
```

> [!TIP]
> 캐시 무효화는 월 1,000개 경로까지 무료입니다.
> `/*`는 1개 경로로 카운트됩니다.
> 특정 파일만 무효화하려면 `/index.html` 처럼 지정합니다.

✅ **태스크 완료**: 캐시 무효화로 콘텐츠를 즉시 업데이트하는 방법을 학습했습니다.

---

## 태스크 5: AWS CLI로 배포 자동화

콘솔 대신 CLI로 S3 업로드 + 캐시 무효화를 한 번에 실행합니다.

```bash
# 변수 설정
BUCKET_NAME="my-static-site-123456789012"
DISTRIBUTION_ID="E1234ABCDEF"

# S3에 파일 동기화 (변경된 파일만 업로드)
aws s3 sync ~/s3-website/ s3://$BUCKET_NAME --delete

# CloudFront 캐시 무효화
aws cloudfront create-invalidation \
  --distribution-id $DISTRIBUTION_ID \
  --paths "/*"

echo "✅ 배포 완료!"
```

> [!CONCEPT] 이것이 Step 9에서 하는 것의 기초
>
> Step 9에서는 이 과정을 GitHub Actions로 자동화합니다:
>
> 1. `git push` → GitHub Actions 트리거
> 2. `npm run build` → Vue.js 빌드
> 3. `aws s3 sync` → S3 업로드
> 4. `aws cloudfront create-invalidation` → 캐시 무효화
>
> 지금 수동으로 하는 것을 자동화하는 것뿐입니다.

✅ **태스크 완료**: CLI로 S3 업로드 + 캐시 무효화를 자동화했습니다.

---

## 마무리

다음을 성공적으로 수행했습니다:

- S3 정적 웹 호스팅을 설정하고 웹사이트를 배포했습니다.
- CloudFront를 연결하여 CDN + HTTPS를 적용했습니다.
- 에러 페이지를 설정했습니다.
- 캐시 무효화로 콘텐츠를 업데이트하는 방법을 학습했습니다.
- CLI로 배포를 자동화하는 방법을 체험했습니다.

### S3의 3가지 주요 사용법 정리

| 사용법             | 실습               | 설명                               |
| ------------------ | ------------------ | ---------------------------------- |
| 설정/관리          | Step 5-1           | 버킷 정책, 버전 관리, 수명 주기    |
| 파일 업로드 저장소 | Step 5-2           | Spring Boot에서 이미지/파일 업로드 |
| 정적 웹 호스팅     | Step 5-3 (이 실습) | HTML/CSS/JS를 CDN으로 서빙         |

# 🗑️ 리소스 정리

> [!NOTE]
> CloudFront와 S3 정적 호스팅은 요청 기반 과금으로 비용이 매우 저렴합니다.
> 학습 수준에서는 거의 무료이지만, 깔끔하게 정리하려면 아래 단계를 따릅니다.

---

### 단계 1: CloudFront 배포 비활성화 및 삭제

1. CloudFront 콘솔에서 배포를 선택합니다.
2. [[Disable]]을 클릭합니다.
3. Status가 `Disabled`로 변경될 때까지 대기합니다 (5~10분).
4. 다시 선택 → [[Delete]]를 클릭합니다.

> [!NOTE]
> CloudFront 배포는 즉시 삭제할 수 없습니다. 반드시 Disable → Delete 순서로 진행합니다.

---

### 단계 2: S3 버킷 비우기 및 삭제

5. S3 콘솔에서 `my-static-site-xxx` 버킷을 선택합니다.
6. [[Empty]] → `permanently delete` 입력 → [[Empty]]를 클릭합니다.
7. 버킷을 다시 선택 → [[Delete]] → 버킷 이름 입력 → [[Delete bucket]]을 클릭합니다.

---

### 단계 3: 삭제 확인

8. CloudFront 콘솔에서 배포가 삭제되었는지 확인합니다.
9. S3 콘솔에서 버킷이 삭제되었는지 확인합니다.

✅ **실습 종료**: 모든 리소스가 정리되었습니다.

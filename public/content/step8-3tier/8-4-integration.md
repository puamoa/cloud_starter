---
title: '🔗 전체 연동 확인'
week: 8
session: 4
awsServices:
  - Amazon Route 53
  - AWS Certificate Manager
learningObjectives:
  - 프론트엔드 ↔ 백엔드 ↔ DB 전체 연동을 확인할 수 있습니다.
  - 도메인과 HTTPS를 최종 적용할 수 있습니다.
prerequisites:
  - Step 8-1, 8-2, 8-3 완료
estimatedCost: 이전 차시(8-1~8-3)에서 생성한 리소스로 인해 비용 발생 가능
---

이 실습에서는 Step 8-1 ~ 8-3에서 구축한 3-Tier 아키텍처의 전체 연동을 확인하고,
선택적으로 도메인과 HTTPS를 적용합니다.

### Step 8 전체 아키텍처

<img src="/images/step8/8-architecture.png" alt="Step 8 3-Tier 아키텍처" class="guide-img-lg" />

> [!NOTE]
> 이 세션의 구성:
>
> - **태스크 1**: HTTPS 연결 — 📗 방법 A (CloudFront Origin 추가) 또는 📘 방법 B (도메인 + ALB HTTPS)
> - **태스크 2**: 전체 연동 테스트
> - **태스크 3**: 최종 아키텍처 확인
> - 리소스 정리는 **Step 8-5**에서 진행합니다.

---

## 태스크 1: HTTPS 연결 (프론트 ↔ 백엔드 연동)

CloudFront(HTTPS)에서 ALB(HTTP)로 직접 호출하면 Mixed Content로 차단됩니다.  
아래 두 방법 중 하나를 선택하세요:

<img src="/images/step8/8-4-mixed-content-error.png" alt="Mixed Content 에러 화면" class="guide-img-sm" />

| 방법                         | 조건               | 장점                               | 단점                              |
| ---------------------------- | ------------------ | ---------------------------------- | --------------------------------- |
| 📗 A: CloudFront Origin 추가 | 도메인 없어도 가능 | ACM 불필요, CORS 불필요, 설정 간단 | API 경로 패턴(`/api/*`) 분기 필요 |
| 📘 B: 도메인 + ALB HTTPS     | 도메인 필수        | 프론트/API 도메인 분리, 확장성     | ACM 2개, CORS 설정, 도메인 비용   |

> [!TIP]
> 📗 방법 A가 더 간단하고 도메인 없이도 동작합니다.  
> 도메인을 이미 보유하고 있고 `app.도메인` / `api.도메인`으로 분리하고 싶다면 📘 방법 B를 선택하세요.

---

### 📗 방법 A: CloudFront에 ALB Origin 추가 (도메인 없이도 가능)

CloudFront의 경로 패턴으로 요청을 분기합니다:

- `/api/*` → ALB (백엔드)
- 그 외 (`/*`) → S3 (프론트엔드)

같은 CloudFront 도메인에서 API를 호출하므로 **Mixed Content 없음, CORS 불필요**입니다.

> [!TIP]
> 이 방식은 로컬 개발의 `vite.config.js` → `server.proxy`와 동일한 개념입니다.
>
> | 환경                 | 프록시 역할         | 동작                                      |
> | -------------------- | ------------------- | ----------------------------------------- |
> | 로컬 (`npm run dev`) | Vite Dev Server     | `localhost:5173/api/*` → `localhost:8080` |
> | 프로덕션 (배포)      | CloudFront Behavior | `cloudfront.net/api/*` → ALB              |
>
> 둘 다 "같은 도메인에서 경로 패턴으로 분기"하는 리버스 프록시 방식이므로,  
> `VITE_API_URL`을 빈 문자열로 두면 로컬과 동일하게 상대 경로(`/api/board`)로 동작합니다.

**A-1. ALB를 CloudFront Origin으로 추가**

1. 상단 검색창에 `CloudFront`를 입력하고 **CloudFront** 서비스를 선택합니다.
2. Distributions 목록에서 프론트엔드 배포를 클릭합니다.
3. **Origins** 탭을 클릭합니다.
   <img src="/images/step8/8-4-step3-cf-origins.png" alt="CloudFront Origins 탭" class="guide-img-sm" />
4. [[Create origin]] 버튼을 클릭합니다.
5. 다음과 같이 설정합니다:
   - **Origin domain**: 드롭다운에서 **Elastic Load Balancer** 섹션의 `my-3tier-app-alb`를 선택합니다
   - **Protocol**: `HTTP only` 선택
   - **HTTP port**: `80` (기본값)
   - **Name**: ALB DNS가 자동 입력됩니다 (변경 불필요)
     <img src="/images/step8/8-4-step5-origin-settings.png" alt="Origin 설정" class="guide-img-sm" />
6. [[Create origin]] 버튼을 클릭합니다.

> [!NOTE]
> ALB의 HTTP 리스너(80번 포트)로 연결합니다.  
> CloudFront → ALB 구간은 AWS 내부 네트워크이므로 HTTP여도 안전합니다.  
> 사용자 브라우저 → CloudFront 구간은 HTTPS로 보호됩니다.

**A-2. `/api/*` 경로를 ALB로 라우팅하는 Behavior 추가**

7. **Behaviors** 탭을 클릭합니다.
   <img src="/images/step8/8-4-step7-behavior-create.png" alt="Behaviors 탭" class="guide-img-sm" />
8. [[Create behavior]] 버튼을 클릭합니다.
9. 다음과 같이 설정합니다:
   - **Path pattern**: `/api/*`
   - **Origin and origin groups**: ALB origin 선택 (Elastic Load Balancing)
   - **Viewer protocol policy**: `HTTPS only`
   - **Allowed HTTP methods**: `GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE`
   - **Cache policy**: `CachingDisabled` (Recommended로 자동 선택됨)
   - **Origin request policy**: `AllViewer` (Recommended로 자동 선택됨)
     <img src="/images/step8/8-4-step9-behavior-settings.png" alt="Behavior 설정" class="guide-img-sm" />

   나머지 설정은 기본값을 유지합니다.

> [!TIP]
> **각 설정의 의미:**
>
> - **Path pattern** — 이 패턴에 매칭되는 요청만 ALB로 전달. `/api/*`이면 `/api/board`, `/api/travel` 등 모두 포함
> - **Viewer protocol policy** — 브라우저 → CloudFront 구간의 프로토콜. `HTTPS only`로 HTTP 접근 차단
> - **Allowed HTTP methods** — API는 GET 외에 POST, PUT, DELETE 등도 사용하므로 전체 허용 필요
> - **Cache policy** — `CachingDisabled`: API 응답은 매번 새로운 데이터이므로 캐시하면 안 됨
> - **Origin request policy** — `AllViewer`: 브라우저가 보낸 헤더(Authorization, Content-Type 등)를 ALB에 그대로 전달
>
> **Origin request policy 주요 옵션 비교:**
>
> - `AllViewer` (권장) — 브라우저의 모든 헤더, 쿼리스트링, 쿠키를 Origin에 전달. API 호출에 적합
> - `AllViewerExceptHostHeader` — Host 헤더만 제외하고 전달. 커스텀 도메인 사용 시 Host 충돌 방지
> - `CORS-CustomOrigin` — CORS 관련 헤더(Origin, Access-Control-\*)만 전달. S3가 아닌 Origin에 CORS 필요 시
> - `UserAgentRefererHeaders` — User-Agent, Referer만 전달. 분석용
> - `None` — 아무 헤더도 전달하지 않음. 정적 파일 Origin용
>
> JWT 인증 토큰(`Authorization` 헤더)이 필요한 API는 반드시 `AllViewer` 또는 `AllViewerExceptHostHeader`를 사용해야 합니다.

10. [[Create behavior]] 버튼을 클릭합니다.

**A-3. 프론트엔드 API URL 업데이트**

📍 **GitHub** (Repository Settings) + **로컬 PC**

같은 CloudFront 도메인 경유이므로 `VITE_API_URL`을 빈 문자열로 변경합니다.

**GitHub Secrets 업데이트:**

11. GitHub → `my-frontend` 리포지토리 → **Settings** → **Secrets and variables** → **Actions**
12. `VITE_API_URL` Secret을 클릭하고 값을 본인의 CloudFront URL로 변경합니다:
    - 📗 기존 프로젝트: `https://<CLOUDFRONT_DOMAIN>.cloudfront.net`
    - 📘 새 프로젝트: `https://<CLOUDFRONT_DOMAIN>.cloudfront.net/api`
      <img src="/images/step8/8-4-step12-env-update-1.png" alt="VITE_API_URL Secret 변경 1" class="guide-img-sm" />
      <img src="/images/step8/8-4-step12-env-update-2.png" alt="VITE_API_URL Secret 변경 2" class="guide-img-sm" />
      <img src="/images/step8/8-4-step12-env-update-3.png" alt="Secret 값 업데이트 완료" class="guide-img-sm" />

> [!TIP]
> CloudFront URL은 AWS Console → CloudFront → Distributions에서 **Distribution domain name** 열에서 확인할 수 있습니다.

**재배포:**

아래 두 방법 중 하나로 재배포합니다:

**방법 1: Re-run (`.env.production`이 `.gitignore`에 포함된 경우)**

13. GitHub → `my-frontend` 리포지토리 → **Actions** 탭
14. 가장 최근 워크플로우 실행을 클릭합니다.
15. 우측 상단 [[Re-run all jobs]] 버튼을 클릭합니다.
    <img src="/images/step8/8-4-step15-rerun-1.png" alt="Re-run all jobs 1" class="guide-img-sm" />
    <img src="/images/step8/8-4-step15-rerun-2.png" alt="Re-run all jobs 2" class="guide-img-sm" />

**방법 2: push (`.env.production`을 git에서 관리하는 경우)**

```bash
# .env.production (📗 기존 프로젝트)
VITE_API_URL=https://<CLOUDFRONT_DOMAIN>.cloudfront.net

# .env.production (📘 새 프로젝트)
VITE_API_URL=https://<CLOUDFRONT_DOMAIN>.cloudfront.net/api
```

```bash
git add .env.production
git commit -m "feat: route API through CloudFront"
git push origin main
```

<img src="/images/step8/8-4-step15-invalidation.png" alt="git push 재배포" class="guide-img-sm" />

> [!TIP]
> `.env.production`이 `.gitignore`에 포함된 경우 `git add`가 무시됩니다.  
> 이때는 Secrets만 변경하고 [[Re-run all jobs]]로 수동 재실행하면 변경된 Secrets 값이 적용됩니다.

> [!NOTE]
> `VITE_API_URL`에 CloudFront URL을 설정하면 API 요청도 CloudFront를 경유합니다.  
> CloudFront의 Behavior가 `/api/*` 요청을 ALB로 전달하므로 HTTPS가 유지됩니다.  
> 로컬 개발에서는 `vite.config.js`의 proxy가 동일한 역할을 하므로 환경 분기 없이 동작합니다.  
> Step 8-3 태스크 4의 CORS 설정은 이 방법에서는 불필요합니다.

> [!WARNING]
> **Route 53으로 커스텀 도메인(`app.도메인`)을 연결한 경우:**
>
> `VITE_API_URL`은 반드시 **브라우저 주소창에 보이는 도메인**과 일치해야 합니다.  
> 예를 들어 `https://app.pmcloudtech.shop`으로 접속한다면:
>
> - ✅ `VITE_API_URL=https://app.pmcloudtech.shop` (같은 origin → CORS 불필요)
> - ❌ `VITE_API_URL=https://d37xxx.cloudfront.net` (다른 origin → CORS 에러 발생)
>
> 페이지 origin과 API origin이 다르면 브라우저가 CORS로 차단합니다.  
> CloudFront URL과 커스텀 도메인은 같은 배포를 가리키지만, 브라우저는 도메인이 다르면 별개의 origin으로 취급합니다.
>
> <img src="/images/step8/8-4-task1-warning-1.png" alt="CORS 에러 예시 1" class="guide-img-sm" />
> <img src="/images/step8/8-4-task1-warning-2.png" alt="CORS 에러 예시 2" class="guide-img-sm" />

✅ **방법 A 완료** — CloudFront Origin 추가로 프론트 ↔ 백엔드 연동이 완성되었습니다. 태스크 2로 이동하세요.

---

### 📘 방법 B: 도메인 + ALB HTTPS (커스텀 도메인 사용)

프론트엔드와 백엔드를 각각의 서브도메인으로 분리합니다:

- `app.<YOUR_DOMAIN>` → CloudFront (프론트엔드)
- `api.<YOUR_DOMAIN>` → ALB (백엔드)

**사전 확인:**

| 확인 항목                 | 어디서 확인                                                      | 비고                                         |
| ------------------------- | ---------------------------------------------------------------- | -------------------------------------------- |
| 도메인 보유               | Route 53 → Hosted zones                                          | Step 7에서 생성했거나, 외부 도메인 사용 가능 |
| Route 53 Hosted Zone 존재 | Route 53 → Hosted zones → 도메인 클릭                            | NS 레코드가 등록 업체 네임서버와 일치 확인   |
| ALB 정상 동작             | `curl http://<ALB_DNS_NAME>/api/board` (또는 `/actuator/health`) | Step 8-3 태스크 7에서 확인 완료              |

> [!TIP]
> Step 7에서 이미 Route 53 Hosted Zone과 ACM 인증서를 생성했다면, 기존 인증서를 재사용할 수 있습니다.  
> ACM → **List certificates**에서 본인 도메인의 인증서가 `Issued` 상태인지 확인하세요.
>
> - `us-east-1`에 `*.<YOUR_DOMAIN>` 인증서 있음 → B-1 건너뛰기
> - `ap-northeast-2`에 `api.<YOUR_DOMAIN>` 인증서 있음 → B-2 건너뛰기

### B-1. ACM 인증서 발급 (CloudFront용 - us-east-1)

Amazon CloudFront에 사용할 인증서는 반드시 **us-east-1 (버지니아)** 리전에서 발급해야 합니다.

9. AWS Console 우측 상단에서 리전을 **US East (N. Virginia) us-east-1**로 변경합니다.
10. 상단 검색창에 `Certificate Manager`를 입력하고 **Certificate Manager** 서비스를 선택합니다.
11. [[Request a certificate]] 버튼을 클릭합니다.
12. **Certificate type**: `Request a public certificate` 선택 → [[Next]] 버튼을 클릭합니다.
13. **Domain names**에 다음을 입력합니다:
    - `<YOUR_DOMAIN>`
    - [[Add another name to this certificate]]를 클릭하고 `*.<YOUR_DOMAIN>` 추가
14. **Validation method**: `DNS validation` 선택
15. [[Request]] 버튼을 클릭합니다.
16. 생성된 인증서를 클릭하고 [[Create records in Route 53]] 버튼을 클릭합니다.
17. 인증서 Status가 `Issued`로 변경될 때까지 대기합니다 (약 5~30분).

### B-2. ACM 인증서 발급 (ALB용 - ap-northeast-2)

ALB에 사용할 인증서는 ALB가 있는 리전에서 발급합니다.

18. AWS Console 우측 상단에서 리전을 **Asia Pacific (Seoul) ap-northeast-2**로 변경합니다.
19. 상단 검색창에 `Certificate Manager`를 입력하고 **Certificate Manager** 서비스를 선택합니다.
20. 위와 동일한 방법으로 `api.<YOUR_DOMAIN>` 인증서를 요청합니다 (DNS 검증).

### B-3. CloudFront에 도메인 연결

21. 상단 검색창에 `CloudFront`를 입력하고 **CloudFront** 서비스를 선택합니다.
22. Distributions 목록에서 배포를 클릭합니다.
23. **General** 탭 → **Settings** 섹션에서 [[Edit]] 버튼을 클릭합니다.
24. **Alternate domain name (CNAME)** 섹션에서 [[Add item]]을 클릭합니다.
25. `<YOUR_DOMAIN>`을 입력합니다.
26. **Custom SSL certificate** 드롭다운에서 us-east-1에서 발급한 인증서를 선택합니다.
27. [[Save changes]] 버튼을 클릭합니다.

### B-4. ALB에 HTTPS 리스너 추가

28. 상단 검색창에 `EC2`를 입력하고 **EC2** 서비스를 선택합니다.
29. 왼쪽 메뉴에서 **Load Balancers**를 클릭합니다.
30. `my-3tier-app-alb`를 클릭합니다.
31. **Listeners and rules** 탭을 클릭합니다.
32. [[Add listener]] 버튼을 클릭합니다.
33. 다음과 같이 설정합니다:
    - **Protocol**: `HTTPS`
    - **Port**: `443`
    - **Default actions**: `Forward to` → `my-3tier-app-tg` 선택
    - **Default SSL/TLS server certificate**: ap-northeast-2에서 발급한 `api.<YOUR_DOMAIN>` 인증서 선택
34. [[Add]] 버튼을 클릭합니다.

> [!WARNING]
> ALB Security Group(`my-3tier-app-alb-sg`)에 **443 포트**가 열려있어야 합니다.  
> CloudFormation에서 80, 443을 모두 열어놨다면 추가 작업 불필요합니다.  
> 443이 없다면: EC2 → Security Groups → `my-3tier-app-alb-sg` → Inbound rules → [[Edit inbound rules]] → Add rule → HTTPS(443), Source: 0.0.0.0/0 추가.

### B-5. Route 53 레코드 생성

35. 상단 검색창에 `Route 53`을 입력하고 **Route 53** 서비스를 선택합니다.
36. 왼쪽 메뉴에서 **Hosted zones**를 클릭합니다.
37. 본인의 도메인을 클릭합니다.
38. [[Create record]] 버튼을 클릭합니다.
39. 프론트엔드용 레코드를 생성합니다:
    - **Record name**: `app` (결과: `app.<YOUR_DOMAIN>`)
    - **Record type**: `A`
    - **Alias**: ✅ 토글 ON
    - **Route traffic to**: `Alias to CloudFront distribution` 선택
40. [[Create records]] 버튼을 클릭합니다.
41. [[Create record]] 버튼을 다시 클릭합니다.
42. 백엔드 API용 레코드를 생성합니다:
    - **Record name**: `api`
    - **Record type**: `A`
    - **Alias**: ✅ 토글 ON
    - **Route traffic to**: `Alias to Application and Classic Load Balancer` → `ap-northeast-2` → `my-3tier-app-alb` 선택
43. [[Create records]] 버튼을 클릭합니다.

### B-6. 프론트엔드 API URL 업데이트

도메인을 연결했다면 프론트엔드의 API URL을 업데이트합니다:

```bash
# .env.production 수정

# 📗 기존 프로젝트 (API 호출이 /api/board 형태)
VITE_API_URL=https://api.<YOUR_DOMAIN>

# 📘 새 프로젝트 (API 호출이 /items 형태)
VITE_API_URL=https://api.<YOUR_DOMAIN>/api
```

```bash
# 재배포
git add .
git commit -m "feat: update API URL to custom domain"
git push origin main
```

✅ **방법 B 완료** — 도메인과 HTTPS를 적용하고 프론트엔드 ↔ 백엔드 연동이 완성되었습니다. 태스크 2로 이동하세요.

> [!TROUBLESHOOTING]
> | 증상 | 원인 | 해결 방법 |
> |------|------|-----------|
> | ACM 인증서가 `Pending validation` 상태 유지 | DNS 검증 레코드 미생성 | Route 53에서 CNAME 레코드 생성 확인 |
> | CloudFront에 인증서가 안 보임 | us-east-1 리전에서 발급하지 않음 | CloudFront용 인증서는 반드시 **버지니아(us-east-1)** 리전에서 발급 |
> | 도메인 접속 시 `ERR_CERT_COMMON_NAME_INVALID` | 인증서 도메인과 접속 도메인 불일치 | ACM 인증서의 도메인 이름 확인 |
> | ALB HTTPS 리스너 추가 실패 | ap-northeast-2 리전 인증서 미발급 | ALB용 인증서는 ALB와 같은 리전에서 발급 |

> [!NOTE]
> ACM 인증서는 완전 무료입니다. 발급, 갱신, 사용 모두 비용이 발생하지 않습니다.
> 단, Route 53 Hosted Zone은 월 $0.50의 비용이 발생합니다.

---

## 태스크 2: 전체 연동 테스트

태스크 1에서 도메인 + HTTPS를 설정했으므로, 이제 프론트엔드 ↔ 백엔드 연동이 동작합니다.

### 2-1. 아키텍처 연동 흐름 확인

```
사용자 브라우저
    ↓ HTTPS
CloudFront (app.<YOUR_DOMAIN> 또는 <CLOUDFRONT_DOMAIN>.cloudfront.net)
    ↓ HTTP
S3 (Vue.js 정적 파일)
    ↓ API 호출 (Axios)
ALB (api.<YOUR_DOMAIN> 또는 <ALB_DNS_NAME>)
    ↓ HTTP:8080
EC2 (Spring Boot)
    ↓ JDBC:3306
Amazon RDS MySQL (Private Subnet)
```

### 2-2. 프론트엔드 → 백엔드 연동 확인

51. 브라우저에서 접속합니다:

```
# 커스텀 도메인이 있는 경우 (Step 8-2 태스크 7 완료 시)
https://app.<YOUR_DOMAIN>

# 커스텀 도메인이 없는 경우
https://<CLOUDFRONT_DOMAIN>.cloudfront.net
```

52. 메인 페이지가 정상 로드되는지 확인합니다.

---

📘 **방법 B 사용자 (새 프로젝트 — `/api/items`):**

53. **📋 아이템 관리** 페이지로 이동합니다.
    <img src="/images/step8/8-4-step53-items-page.png" alt="아이템 관리 페이지 이동" class="guide-img-sm" />
54. 아이템을 추가합니다:
    - 이름: `테스트 아이템`
    - 설명: `3-Tier 연동 테스트`
      <img src="/images/step8/8-4-step54-add-item.png" alt="아이템 추가" class="guide-img-sm" />

55. 아이템이 목록에 표시되는지 확인합니다.
    <img src="/images/step8/8-4-step55-item-list.png" alt="아이템 목록 표시 확인" class="guide-img-sm" />

> [!OUTPUT]
> 아이템 관리 페이지에서:
>
> - 아이템 이름: `테스트 아이템`
> - 아이템 설명: `3-Tier 연동 테스트`
> - [삭제] 버튼 정상 표시
>
> 아이템이 정상적으로 추가되고 목록에 표시되면 프론트엔드 ↔ 백엔드 ↔ DB 연동이 성공한 것입니다.

---

📗 **방법 A 사용자 (기존 프로젝트 — `/api/board`, `/api/travel` 등):**

56. 게시판 또는 메인 기능 페이지로 이동합니다.
57. 데이터가 정상적으로 조회되는지 확인합니다 (목록 로드).
58. 글 작성 등 CRUD 기능을 테스트합니다 (로그인 필요 시 먼저 로그인).

> [!OUTPUT]
> 게시판 목록이 정상적으로 로드되거나, 글 작성 후 목록에 반영되면 프론트엔드 ↔ 백엔드 ↔ DB 연동이 성공한 것입니다.

> [!TIP]
> 기존 프로젝트에서 이미지가 표시되지 않는다면:
>
> - 이미지가 S3에 저장되는 구조인지 확인 (Step 5-2 참고)
> - S3 버킷의 퍼블릭 읽기 권한 또는 CloudFront 연결 확인
> - 로컬 파일 저장 방식이라면 EC2에 해당 디렉토리(`/tmp/upload` 등)가 존재하는지 확인

### 2-3. 데이터베이스 저장 확인

📍 **EC2 (Session Manager)**

59. Amazon EC2에 SSM Session Manager로 접속하여 Amazon RDS에서 데이터를 확인합니다:

```bash
mysql -h <RDS_ENDPOINT> -u admin -p
```

📘 **방법 B (새 프로젝트):**

```sql
USE myapp;
SELECT * FROM items;
EXIT;
```

<img src="/images/step8/8-4-step59-db-check.png" alt="EC2에서 RDS 데이터 확인" class="guide-img-sm" />

📗 **방법 A (기존 프로젝트):**

```sql
USE <DB_NAME>;
SHOW TABLES;
-- 본인 테이블명으로 조회 (예: board, tbl_board)
SELECT * FROM board ORDER BY no DESC LIMIT 5;
EXIT;
```

방금 프론트에서 추가한 데이터가 DB에 저장되어 있으면 전체 연동 성공입니다.

### 2-4. 브라우저 개발자 도구로 확인

📍 **로컬 PC (브라우저)**

60. 브라우저에서 F12 → **Network** 탭을 엽니다.
61. 페이지를 새로고침하거나 데이터 추가/조회 시 API 호출을 확인합니다:
    <img src="/images/step8/8-4-step61-network-tab.png" alt="Network 탭 API 호출 확인" class="guide-img-sm" />

📘 **방법 B:** Request URL에 `/api/items`가 보이고 Status `200`/`201`이면 정상.

📗 **방법 A:** Request URL에 `/api/board` 등 본인 API 경로가 보이고 Status `200`이면 정상.

> [!TIP]
> CORS 에러가 발생하면 Step 8-3의 태스크 4를 다시 확인하세요.  
> Amazon CloudFront 도메인이 `allowed-origins`에 정확히 포함되어야 합니다.
> 프로토콜(`https://`)까지 정확히 일치해야 합니다.

### 2-5. 연동 체크리스트

| 확인 항목           | 예상 결과                             | 상태 |
| ------------------- | ------------------------------------- | ---- |
| CloudFront URL 접속 | 프론트엔드 앱 로드                    | ☐    |
| API 연동            | 데이터 정상 조회/생성                 | ☐    |
| RDS 데이터 확인     | 프론트에서 추가한 데이터가 DB에 존재  | ☐    |
| SPA 라우팅          | 직접 URL 입력 시 정상 로드 (404 아님) | ☐    |
| CORS 에러 없음      | 브라우저 Console에 CORS 에러 없음     | ☐    |

✅ **태스크 완료** — 프론트엔드 ↔ 백엔드 ↔ DB 전체 연동을 확인했습니다.

> [!TROUBLESHOOTING]
> | 증상 | 원인 | 해결 방법 |
> |------|------|-----------|
> | CloudFront 접속 시 빈 화면 | S3에 빌드 파일 미업로드 | `aws s3 ls s3://<FRONTEND_BUCKET_NAME>`으로 파일 존재 확인 |
> | "API 연결 실패" 표시 | 백엔드 미배포 또는 CORS 미설정 | ALB DNS로 직접 `curl` 테스트, CORS `allowed-origins` 확인 |
> | 데이터 추가 시 500 에러 | RDS 연결 실패 또는 테이블 미생성 | EC2 로그 확인: `sudo journalctl -u spring-app -n 50` 또는 `tail -50 /opt/tomcat/logs/catalina.out` |
> | CORS 에러 (브라우저 콘솔) | Amazon CloudFront 도메인이 `allowed-origins`에 미포함 | `https://` 프로토콜 포함하여 정확한 도메인 추가 |
> | Network 탭에서 `Mixed Content` 경고 | HTTPS 페이지에서 HTTP API 호출 | `.env.production`의 API URL을 `https://`로 변경 또는 ALB에 HTTPS 리스너 추가 |

---

## 태스크 3: 최종 아키텍처 확인

### 완성된 3-Tier 아키텍처

<img src="/images/step8/8-architecture.png" alt="Step 8 완성된 3-Tier 아키텍처" class="guide-img-lg" />

```
┌───────────────────────────────────────────────────────────────────────┐
│                         인터넷                                        │
└───────────┬───────────────────────────────────┬───────────────────────┘
            │                                   │
            ▼                                   ▼
┌─────────────────────────┐       ┌─────────────────────────────────────┐
│  CloudFront (CDN)       │       │  ALB (HTTPS 종료)                   │
│  - HTTPS 자동 적용      │       │  - Health Check                     │
│  - 전 세계 엣지 캐싱    │       │  - 트래픽 분산                      │
│  - SPA 라우팅 지원      │       │  - Public Subnet                    │
└───────────┬─────────────┘       └─────────────┬───────────────────────┘
            │                                   │
            ▼                                   ▼
┌─────────────────────────┐       ┌─────────────────────────────────────┐
│  S3 Bucket              │       │  EC2 (Spring Boot)                  │
│  - Vue.js 빌드 파일     │       │  - REST API                         │
│  - 정적 웹 호스팅       │       │  - SSM에서 비밀값 로드              │
│  - GitHub Actions 배포  │       │  - GitHub Actions 배포              │
└─────────────────────────┘       └─────────────┬───────────────────────┘
                                                │
                                                ▼
                                  ┌─────────────────────────────────────┐
                                  │  Amazon RDS MySQL (Private Subnet)  │
                                  │  - 외부 접근 차단                   │
                                  │  - Amazon EC2에서만 접근 가능       │
                                  │  - 자동 백업                        │
                                  └─────────────────────────────────────┘
```

### 구성 요소 정리

| 구성 요소    | AWS 서비스          | 역할                       | 배포 방식                 |
| ------------ | ------------------- | -------------------------- | ------------------------- |
| 프론트엔드   | S3 + CloudFront     | Vue.js SPA 호스팅          | GitHub Actions → S3 sync  |
| API 서버     | EC2 + ALB           | Spring Boot/MVC REST API   | GitHub Actions → S3 → SSM |
| 데이터베이스 | Amazon RDS MySQL    | 데이터 영구 저장           | CloudFormation            |
| 네트워크     | VPC + Subnets       | 네트워크 격리              | CloudFormation            |
| 보안         | Security Groups     | 접근 제어                  | CloudFormation            |
| 비밀 관리    | SSM Parameter Store | DB 접속 정보, S3 버킷명 등 | AWS CLI                   |
| CI/CD        | GitHub Actions      | 자동 빌드/배포             | YAML 워크플로우           |

> [!CONCEPT] Step 0~7에서 배운 것의 통합
>
> | Step   | 배운 내용           | Step 8에서의 활용    |
> | ------ | ------------------- | -------------------- |
> | Step 0 | AWS 계정, IAM       | IAM User/Role 생성   |
> | Step 1 | VPC, Subnet, SG     | 3-Tier 네트워크 설계 |
> | Step 2 | EC2                 | Spring Boot 서버     |
> | Step 3 | S3                  | 프론트엔드 호스팅    |
> | Step 4 | RDS                 | MySQL 데이터베이스   |
> | Step 5 | CloudFront          | CDN + HTTPS          |
> | Step 6 | SSM Parameter Store | 비밀값 관리          |
> | Step 7 | ALB, Route 53       | 로드 밸런싱, 도메인  |
> | Step 8 | GitHub Actions      | CI/CD 자동 배포      |

✅ **태스크 완료** — 완성된 3-Tier 아키텍처를 확인했습니다.

---

---

# 🗑️ 리소스 정리

> [!WARNING]
> 이 세션에서 생성한 리소스를 지금 삭제하지 마세요!  
> 전체 연동 확인이 완료되었다면 **Step 8-5**에서 체계적으로 정리합니다.

✅ **실습 종료**: Step 8-5에서 전체 리소스를 정리합니다.

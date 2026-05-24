---
title: '도메인 구매부터 HTTPS 인증서 발급까지'
week: 7
session: 3
awsServices:
  - Amazon Route 53
  - AWS Certificate Manager
learningObjectives:
  - 도메인을 구매하고 Route53에 연결할 수 있습니다.
  - Hosted Zone을 생성하고 A/CNAME 레코드를 설정할 수 있습니다.
  - ACM으로 무료 SSL 인증서를 발급받을 수 있습니다.
  - DNS 검증 방식으로 인증서를 검증할 수 있습니다.
prerequisites:
  - AWS 계정 생성 완료
  - 도메인 구매 (가비아, Route53 등)
  - EC2 인스턴스 실행 중 (선택)
estimatedCost: Route53 Hosted Zone 월 $0.50 + 도메인 구매 비용
---

이 실습에서는 도메인을 구매하고 Route53에 연결하여 DNS를 관리합니다.
ACM(AWS Certificate Manager)으로 무료 SSL 인증서를 발급받아 HTTPS를
적용할 준비를 합니다.

> [!WARNING]
> 이 실습은 비용이 발생합니다:
>
> - Route53 Hosted Zone: 월 $0.50
> - 도메인 구매: 연 $12~15 (Route53) 또는 연 15,000원~ (가비아)
> - DNS 쿼리: 100만 쿼리당 $0.40 (학습 수준에서는 무시 가능)
>
> ACM 인증서 자체는 **무료**입니다.

---

## 태스크 1: 도메인 구매 방법

도메인은 Route53에서 직접 구매하거나, 가비아 등 외부 등록기관에서 구매할 수 있습니다.

### 방법 A: 가비아에서 구매 (한국 도메인 등록기관)

1. [가비아](https://www.gabia.com)에 접속합니다.
2. 원하는 도메인을 검색합니다 (예: `my-starter-app.com`).
3. 사용 가능한 도메인을 선택하고 결제합니다.

| TLD    | 가비아 가격 (연) | 비고                   |
| ------ | ---------------- | ---------------------- |
| `.com` | ~15,000원        | 가장 일반적            |
| `.kr`  | ~17,000원        | 한국 도메인            |
| `.net` | ~18,000원        | 네트워크 관련          |
| `.io`  | ~50,000원        | 기술 스타트업에서 인기 |

### 방법 B: Route53에서 직접 구매

1. AWS Management Console에 로그인합니다.
2. 상단 검색창에 `Route 53`을 입력하고 선택합니다.
3. 왼쪽 메뉴에서 **Registered domains**를 클릭합니다.
4. [[Register domains]]를 클릭합니다.
5. 원하는 도메인을 검색합니다.
6. 사용 가능한 도메인을 선택하고 [[Proceed to checkout]]을 클릭합니다.
7. 연락처 정보를 입력합니다.
8. **Auto-renew**: 자동 갱신 여부를 선택합니다.
9. [[Submit]]을 클릭합니다.

| TLD    | Route53 가격 (연) | 비고                  |
| ------ | ----------------- | --------------------- |
| `.com` | $13               | Hosted Zone 자동 생성 |
| `.net` | $11               |                       |
| `.org` | $12               |                       |
| `.io`  | $39               |                       |

> [!TIP]
> Route53에서 도메인을 구매하면 **Hosted Zone이 자동으로 생성**됩니다.
> 네임서버 변경 작업이 필요 없어 설정이 간편합니다.
> 가비아에서 구매한 경우에는 태스크 3에서 네임서버를 수동으로 변경해야 합니다.

### 어떤 방법을 선택할까?

| 기준        | 가비아             | Route53                |
| ----------- | ------------------ | ---------------------- |
| 가격        | 약간 저렴          | 약간 비쌈              |
| 설정 편의성 | 네임서버 변경 필요 | 자동 설정              |
| 관리 통합   | AWS 외부           | AWS 콘솔에서 통합 관리 |
| 한국어 지원 | ✅                 | ❌ (영문)              |
| 결제        | 원화               | 달러 (AWS 청구서)      |

✅ **태스크 완료** — 도메인 구매 방법과 각 방식의 장단점을 이해했습니다.

---

## 태스크 2: Route53 Hosted Zone 생성

Hosted Zone은 도메인의 DNS 레코드를 관리하는 컨테이너입니다.

> [!NOTE]
> Route53에서 도메인을 구매한 경우 Hosted Zone이 자동 생성됩니다.
> 이 태스크는 가비아 등 외부에서 도메인을 구매한 경우에 필요합니다.

### Hosted Zone 생성 단계

1. Route 53 콘솔에서 왼쪽 메뉴의 **Hosted zones**를 클릭합니다.
2. [[Create hosted zone]]을 클릭합니다.
3. 다음을 입력합니다:
   - **Domain name**: `yourdomain.com` (구매한 도메인)
   - **Description**: `My starter app domain` (선택)
   - **Type**: **Public hosted zone**
4. [[Create hosted zone]]을 클릭합니다.

### NS 레코드 확인

5. 생성된 Hosted Zone을 클릭합니다.
6. 자동으로 생성된 **NS (Name Server)** 레코드를 확인합니다.

> [!OUTPUT]
> NS 레코드에 4개의 네임서버가 표시됩니다:
>
> ```
> ns-1234.awsdns-12.org
> ns-567.awsdns-34.com
> ns-890.awsdns-56.co.uk
> ns-1011.awsdns-78.net
> ```
>
> 이 4개의 네임서버를 도메인 등록기관(가비아)에 설정해야 합니다.

> [!CONCEPT] Hosted Zone의 기본 레코드
> Hosted Zone을 생성하면 2개의 레코드가 자동으로 생성됩니다:
>
> - **NS 레코드**: 이 도메인의 DNS를 담당하는 네임서버 4개
> - **SOA 레코드**: Start of Authority, DNS 영역의 관리 정보
>
> 이 두 레코드는 삭제하면 안 됩니다.

✅ **태스크 완료** — Hosted Zone을 생성하고 NS 레코드 4개를 확인했습니다.

---

## 태스크 3: 네임서버 변경 (가비아 → Route53)

가비아에서 도메인을 구매한 경우, 네임서버를 Route53으로 변경해야 합니다.
이 작업을 통해 도메인의 DNS 관리 권한을 Route53에 위임합니다.

### 가비아에서 네임서버 변경

1. [가비아](https://www.gabia.com)에 로그인합니다.
2. **My 가비아** → **도메인** → **관리**를 클릭합니다.
3. 해당 도메인의 **관리** 버튼을 클릭합니다.
4. **네임서버** 탭을 선택합니다.
5. **네임서버 설정** 섹션에서 [[변경]]을 클릭합니다.
6. 기존 네임서버를 삭제하고, Route53의 NS 레코드 4개를 입력합니다:

```
1차: ns-1234.awsdns-12.org
2차: ns-567.awsdns-34.com
3차: ns-890.awsdns-56.co.uk
4차: ns-1011.awsdns-78.net
```

7. [[적용]]을 클릭합니다.

> [!WARNING]
> 네임서버 변경 후 DNS 전파에 시간이 걸립니다:
>
> - 빠르면: 수 분 ~ 수 시간
> - 최대: 48시간
>
> 전파가 완료되기 전에는 도메인이 정상 작동하지 않을 수 있습니다.
> 기존 서비스가 운영 중이라면 트래픽이 적은 시간에 변경하세요.

### DNS 전파 확인

네임서버 변경이 반영되었는지 확인합니다:

```bash
# nslookup으로 네임서버 확인
nslookup -type=NS yourdomain.com

# dig 명령어로 확인 (macOS/Linux)
dig NS yourdomain.com

# 특정 DNS 서버에 직접 질의
dig @8.8.8.8 NS yourdomain.com
```

> [!OUTPUT]
> Route53 네임서버가 응답하면 전파가 완료된 것입니다:
>
> ```
> yourdomain.com.    172800  IN  NS  ns-1234.awsdns-12.org.
> yourdomain.com.    172800  IN  NS  ns-567.awsdns-34.com.
> yourdomain.com.    172800  IN  NS  ns-890.awsdns-56.co.uk.
> yourdomain.com.    172800  IN  NS  ns-1011.awsdns-78.net.
> ```

✅ **태스크 완료** — 가비아에서 Route53으로 네임서버를 변경하고 전파를 확인했습니다.

---

## 태스크 4: A 레코드 설정

도메인을 EC2 인스턴스의 IP 주소에 연결합니다.

### 루트 도메인 A 레코드 생성

1. Route 53 → Hosted zones → 도메인을 클릭합니다.
2. [[Create record]]를 클릭합니다.
3. 다음을 설정합니다:
   - **Record name**: (비워두면 루트 도메인, 예: `yourdomain.com`)
   - **Record type**: **A – Routes traffic to an IPv4 address**
   - **Value**: EC2 인스턴스의 Public IP (예: `3.35.xxx.xxx`)
   - **TTL (seconds)**: `300`
   - **Routing policy**: Simple routing
4. [[Create records]]를 클릭합니다.

### 서브도메인 A 레코드 생성 (api.yourdomain.com)

5. [[Create record]]를 다시 클릭합니다.
6. 다음을 설정합니다:
   - **Record name**: `api` (→ `api.yourdomain.com`이 됨)
   - **Record type**: **A**
   - **Value**: EC2 인스턴스의 Public IP (Spring Boot 서버)
   - **TTL (seconds)**: `300`
7. [[Create records]]를 클릭합니다.

### 추가 서브도메인 예시

| Record name | Type  | Value          | 용도                          |
| ----------- | ----- | -------------- | ----------------------------- |
| (빈값)      | A     | 3.35.xxx.xxx   | 루트 도메인 (yourdomain.com)  |
| `api`       | A     | 3.35.xxx.xxx   | API 서버 (api.yourdomain.com) |
| `www`       | CNAME | yourdomain.com | www 리다이렉트                |
| `dev`       | A     | 3.36.xxx.xxx   | 개발 서버                     |

> [!CONCEPT] A 레코드 vs CNAME 레코드
>
> - **A 레코드**: 도메인 → IP 주소 매핑. 루트 도메인에 사용 가능.
> - **CNAME 레코드**: 도메인 → 다른 도메인 매핑. 루트 도메인에는 사용 불가.
> - **Alias 레코드** (Route53 전용): 루트 도메인에서도 AWS 리소스(ALB, CloudFront 등)를 가리킬 수 있는 특수 레코드.

### DNS 확인

```bash
# A 레코드 확인
dig A yourdomain.com
dig A api.yourdomain.com

# 또는 nslookup
nslookup yourdomain.com
```

> [!OUTPUT]
>
> ```
> yourdomain.com.     300     IN      A       3.35.xxx.xxx
> api.yourdomain.com. 300     IN      A       3.35.xxx.xxx
> ```

> [!TIP]
> EC2의 Public IP는 인스턴스를 중지/시작하면 변경됩니다.
> 고정 IP가 필요하면 **Elastic IP**를 할당하여 연결하세요.
> 또는 ALB(Application Load Balancer)를 사용하면 IP 변경 걱정 없이
> Alias 레코드로 연결할 수 있습니다.

✅ **태스크 완료** — 루트 도메인과 서브도메인의 A 레코드를 설정했습니다.

---

## 태스크 5: ACM 인증서 요청

AWS Certificate Manager(ACM)에서 무료 SSL/TLS 인증서를 발급받습니다.

### 인증서 요청 단계

1. 상단 검색창에 `Certificate Manager`를 입력하고 선택합니다.

> [!WARNING]
> **리전 선택이 중요합니다!**
>
> - **ALB에 사용할 인증서**: ALB가 있는 리전에서 발급 (예: ap-northeast-2)
> - **CloudFront에 사용할 인증서**: 반드시 **us-east-1 (N. Virginia)** 리전에서 발급
>
> CloudFront용 인증서를 서울 리전에서 발급하면 연결할 수 없습니다.

2. [[Request a certificate]]를 클릭합니다.
3. **Certificate type**: **Request a public certificate**를 선택합니다.
4. [[Next]]를 클릭합니다.
5. **Domain names** 섹션에서 도메인을 추가합니다:
   - `yourdomain.com` (루트 도메인)
   - [[Add another name to this certificate]]를 클릭합니다.
   - `*.yourdomain.com` (와일드카드 — 모든 서브도메인 포함)
6. **Validation method**: **DNS validation – recommended**를 선택합니다.
7. **Key algorithm**: RSA 2048 (기본값)
8. [[Request]]를 클릭합니다.

> [!CONCEPT] 와일드카드 인증서 (\*.yourdomain.com)
> 와일드카드 인증서 하나로 모든 서브도메인에 HTTPS를 적용할 수 있습니다:
>
> - `api.yourdomain.com` ✅
> - `www.yourdomain.com` ✅
> - `dev.yourdomain.com` ✅
>
> 단, 루트 도메인(`yourdomain.com`)은 와일드카드에 포함되지 않으므로
> 별도로 추가해야 합니다. 그래서 두 개를 함께 요청합니다.

✅ **태스크 완료** — ACM에서 와일드카드 인증서를 요청했습니다.

---

## 태스크 6: DNS 검증 레코드 생성

인증서 소유권을 증명하기 위해 DNS에 검증 레코드를 추가합니다.

### Route53 자동 생성 (가장 간편한 방법)

1. ACM 콘솔에서 방금 요청한 인증서를 클릭합니다.
2. **Status**가 **Pending validation**인 것을 확인합니다.
3. **Domains** 섹션에서 검증이 필요한 도메인 목록을 확인합니다.
4. [[Create records in Route 53]]를 클릭합니다.
5. 검증 레코드 목록을 확인하고 [[Create records]]를 클릭합니다.

> [!OUTPUT]
> "Successfully created DNS records" 메시지가 표시됩니다.
> Route53 Hosted Zone에 CNAME 레코드가 자동으로 추가됩니다.

### 검증 완료 대기

6. ACM 콘솔에서 인증서 상태를 확인합니다.
7. **Status**가 **Pending validation** → **Issued**로 변경될 때까지 대기합니다.

> [!NOTE]
> DNS 검증은 보통 수 분 내에 완료됩니다. 최대 30분까지 걸릴 수 있습니다.
> 네임서버 변경 직후라면 DNS 전파 시간만큼 추가로 걸릴 수 있습니다.

### 수동으로 CNAME 레코드 추가 (Route53 외 DNS 사용 시)

Route53을 사용하지 않는 경우, ACM이 제공하는 CNAME 레코드를 수동으로 추가해야 합니다:

```
Record name: _abc123def456.yourdomain.com
Record type: CNAME
Value: _xyz789ghi012.acm-validations.aws.
```

> [!TIP]
> DNS 검증 레코드는 인증서가 존재하는 한 유지해야 합니다.
> 삭제하면 인증서 갱신 시 검증에 실패할 수 있습니다.
> ACM 인증서는 만료 60일 전에 자동 갱신을 시도하며,
> 이때 DNS 검증 레코드가 있어야 자동 갱신이 성공합니다.

✅ **태스크 완료** — DNS 검증 레코드를 생성하고 인증서 발급을 완료했습니다.

---

## 태스크 7: 인증서 활용 방법 안내

발급받은 ACM 인증서는 다음 AWS 서비스에 연결하여 HTTPS를 적용합니다.

> [!NOTE]
> ACM 인증서는 EC2에 직접 설치할 수 없습니다. 반드시 ALB, CloudFront,
> API Gateway 등 AWS 관리형 서비스를 통해 사용해야 합니다.

### 활용 방법 1: ALB (Application Load Balancer)에 연결

```
[사용자] → HTTPS → [ALB + ACM 인증서] → HTTP → [EC2 (Spring Boot)]
```

- ALB에서 HTTPS를 종료(SSL Termination)하고, EC2에는 HTTP로 전달
- EC2에 SSL 설정이 필요 없어 관리가 간편
- 가장 일반적인 프로덕션 구성

**설정 개요:**

1. EC2 콘솔 → Load Balancers → Create Application Load Balancer
2. Listener: HTTPS (443) 추가
3. SSL Certificate: ACM에서 발급받은 인증서 선택
4. Target Group: EC2 인스턴스 (포트 8080)

### 활용 방법 2: CloudFront에 연결

```
[사용자] → HTTPS → [CloudFront + ACM 인증서] → [S3 정적 웹사이트]
```

- Vue.js/React 빌드 파일을 S3에 배포하고 CloudFront로 서빙
- 전 세계 CDN + HTTPS 적용
- **주의**: 인증서는 반드시 us-east-1 리전에서 발급해야 함

### 활용 방법 3: API Gateway에 연결

```
[사용자] → HTTPS → [API Gateway + 커스텀 도메인 + ACM 인증서] → [Lambda]
```

- API Gateway에 커스텀 도메인을 설정하고 ACM 인증서 연결
- `api.yourdomain.com` 같은 깔끔한 API URL 사용 가능

### 전체 아키텍처 예시

```
                    ┌─── api.yourdomain.com ───┐
[사용자 브라우저] ──┤                           ├── [ALB + ACM] → [EC2 Spring Boot]
                    └─── www.yourdomain.com ───┘
                                                └── [CloudFront + ACM] → [S3 Vue.js]
```

> [!TIP]
> 이 실습에서는 인증서 발급까지만 진행합니다.
> ALB 연결은 별도 실습에서 다루며, 당장은 인증서를 발급받아 두기만 하면 됩니다.
> ACM 인증서는 무료이므로 미리 발급받아 두어도 비용이 발생하지 않습니다.

✅ **태스크 완료** — ACM 인증서의 활용 방법(ALB, CloudFront, API Gateway)을 이해했습니다.

---

# 🗑️ 리소스 정리

> [!WARNING]
> Route53 Hosted Zone은 월 $0.50이 과금됩니다. 도메인을 더 이상 사용하지 않는다면 삭제하여 비용을 절약하세요.

---

### 단계 1: Hosted Zone 내 레코드 삭제

Hosted Zone을 삭제하려면 NS, SOA 레코드를 제외한 모든 레코드를 먼저 삭제해야 합니다.

1. Route 53 콘솔 → **Hosted zones** → 도메인 선택
2. A 레코드, CNAME 레코드 등 직접 생성한 레코드를 모두 선택합니다.
3. [[Delete]]를 클릭합니다.

> [!NOTE]
> NS 레코드와 SOA 레코드는 Hosted Zone 삭제 시 자동으로 제거됩니다. 수동으로 삭제할 필요 없습니다.

---

### 단계 2: Hosted Zone 삭제 (월 $0.50 절약)

1. Route 53 콘솔 → **Hosted zones** → 도메인 선택
2. [[Delete hosted zone]]을 클릭합니다.
3. 확인 입력란에 `delete`를 입력합니다.
4. [[Delete]]를 클릭합니다.

> [!WARNING]
> Hosted Zone을 삭제하면 해당 도메인의 모든 DNS 레코드가 사라집니다. 서비스가 운영 중이라면 절대 삭제하지 마세요.

---

### 단계 3: ACM 인증서 삭제 (선택)

ACM 인증서는 무료이므로 유지해도 비용이 발생하지 않습니다. 삭제하려면:

1. Certificate Manager 콘솔 → 인증서 선택
2. [[Delete]]를 클릭합니다.

> [!NOTE]
> 인증서가 ALB나 CloudFront에 연결되어 있으면 먼저 연결을 해제해야 삭제할 수 있습니다.

---

### 단계 4: 도메인 자동 갱신 해제

도메인을 더 이상 사용하지 않는다면 자동 갱신을 해제하여 다음 해 갱신 비용을 방지합니다.

**Route53에서 구매한 경우:**

1. Route 53 → **Registered domains** → 도메인 선택
2. **Auto-renew**: [[Disable]]

**가비아에서 구매한 경우:**

1. 가비아 → 도메인 관리 → 자동 연장 설정 해제

---

### 단계 5: 삭제 확인

1. Route 53 → Hosted zones에서 해당 도메인이 없는지 확인합니다.
2. Certificate Manager에서 인증서가 삭제되었는지 확인합니다.

> [!NOTE]
> 도메인은 이후 실습(ALB, CloudFront 연결)에서 계속 사용합니다. 월 $0.50의 Hosted Zone 비용이 부담되지 않는다면 유지하는 것을 권장합니다.

✅ **실습 종료**: 모든 리소스가 정리되었습니다.

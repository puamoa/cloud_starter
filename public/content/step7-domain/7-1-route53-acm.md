---
title: '도메인 구매부터 HTTPS 인증서 발급까지'
week: 7
session: 1
awsServices:
  - Amazon Route 53
  - AWS Certificate Manager
learningObjectives:
  - 도메인을 구매하고 Amazon Route 53에 연결할 수 있습니다.
  - Hosted Zone을 생성하고 A/CNAME 레코드를 설정할 수 있습니다.
  - AWS Certificate Manager(ACM)으로 무료 SSL 인증서를 발급받을 수 있습니다.
  - DNS 검증 방식으로 인증서를 검증할 수 있습니다.
prerequisites:
  - AWS 계정 생성 완료
  - 도메인 구매 (cafe24, 가비아, Amazon Route 53 등)
  - EC2 인스턴스 실행 중 (선택)
estimatedCost: Amazon Route 53 Hosted Zone 월 과금 + 도메인 구매 비용
---

이 실습에서는 도메인을 구매하고 Amazon Route 53에 연결하여 DNS를 관리합니다.  
ACM(AWS Certificate Manager)으로 무료 SSL 인증서를 발급받아 HTTPS를
적용할 준비를 합니다.

### Step 7 전체 아키텍처

<img src="/images/step7/7-0-architecture.png" alt="Step 7 전체 아키텍처" class="guide-img-md" />

### 7-1 아키텍처: Route 53 + ACM

<img src="/images/step7/7-1-architecture.png" alt="7-1 Route 53 + ACM 아키텍처" class="guide-img-md" />

> [!TIP]
> 이번 실습에서는 도메인 등록 → Route 53 NS 위임 → A Record로 EC2 연결 → ACM 인증서 발급까지 진행합니다.  
> ACM 버지니아 인증서는 발급만 해두고, 실제 CloudFront 연결은 Step 8에서 진행합니다.

### Step 7 전체 구성

| 세션                | 주제                  | 핵심 리소스                     |
| ------------------- | --------------------- | ------------------------------- |
| **7-1 (이번 실습)** | Amazon Route 53 + ACM | 도메인 연결, HTTPS 인증서       |
| 7-2                 | ALB + Target Group    | 트래픽 분산, Health Check       |
| 7-3                 | Auto Scaling Group    | 자동 확장/축소, Launch Template |

```
7-1: 도메인 + HTTPS     →    7-2: ALB 생성 + 도메인 연결  →    7-3: ASG로 자동 확장
(수동 EC2 등록)              (커스텀 도메인 + SSL)             (EC2 자동 생성/삭제)
```

### 실습 흐름

```
[도메인 구매] → [Amazon Route 53 Hosted Zone] → [네임서버 설정] → [A 레코드 확인] → [ACM 인증서 발급] → [DNS 검증] → [활용 안내]
```

> [!WARNING]
> 이 실습은 비용이 발생합니다:
>
> | 리소스                        | 비용               | 비고                      |
> | ----------------------------- | ------------------ | ------------------------- |
> | Amazon Route 53 Hosted Zone   | 월 $0.50           | 삭제하지 않으면 매월 과금 |
> | 도메인 구매 (Amazon Route 53) | 연 $11~39          | TLD에 따라 다름           |
> | 도메인 구매 (cafe24/가비아)   | 연 15,000원~       | TLD에 따라 다름           |
> | DNS 쿼리                      | 100만 쿼리당 $0.40 | 학습 수준에서는 무시 가능 |
> | ACM 인증서                    | **무료**           | 발급·유지 모두 무료       |
>
> 실습 후 Hosted Zone을 삭제하면 월 $0.50을 절약할 수 있습니다.  
> [Amazon Route 53 요금](https://aws.amazon.com/route53/pricing/) | [AWS Certificate Manager 요금](https://aws.amazon.com/certificate-manager/pricing/)

---

## 태스크 1: 도메인 구매 방법

도메인은 Amazon Route 53에서 직접 구매하거나, cafe24, 가비아 등 외부 등록기관에서 구매할 수 있습니다.

| 기준            | 방법 A: cafe24/가비아 (외부) | 방법 B: Amazon Route 53 (AWS) |
| --------------- | ---------------------------- | ----------------------------- |
| **가격**        | 이벤트 특가 가능 (550원~)    | 국제 정가 ($11~39/년)         |
| **결제**        | 원화, 카드/계좌이체          | 달러, AWS 결제 수단           |
| **네임서버**    | 수동 변경 필요 (태스크 3)    | 자동으로 Amazon Route 53 연결 |
| **Hosted Zone** | 수동 생성 필요 (태스크 2)    | 자동 생성됨                   |
| **한국어 지원** | ✅                           | ❌ (영문)                     |
| **적합한 경우** | 저렴하게 시작, 한국어 선호   | AWS 생태계에서 일괄 관리      |

> [!TIP]
> 이 실습에서는 **방법 A (cafe24)** 기준으로 진행합니다.  
> 스크린샷과 가이드도 cafe24 기준이며, Amazon Route 53에서 구매한 경우 태스크 2/3을 건너뛸 수 있습니다.

### 방법 A: cafe24에서 구매 (한국 도메인 등록기관)

1. [cafe24](https://hosting.cafe24.com/)에 접속합니다.
   <img src="/images/step7/7-1-step1-cafe24-domain.png" alt="cafe24 도메인 검색" class="guide-img-sm" />
2. 상단 메뉴에서 **도메인**을 클릭합니다.
3. 원하는 도메인을 검색합니다 (예: `my-starter-app`).
   <img src="/images/step7/7-1-step3-domain-search.png" alt="도메인 검색" class="guide-img-sm" />
4. 검색 결과에서 사용 가능한 도메인을 선택합니다.
   - `.shop`, `.store` 등 이벤트 도메인은 첫해 550원으로 매우 저렴합니다.
   - 학습 목적이라면 이벤트 특가 도메인을 선택하는 것을 권장합니다.
     <img src="/images/step7/7-1-step4-domain-select.png" alt="도메인 선택" class="guide-img-sm" />
5. [[도메인 신청하기]]를 클릭합니다.
6. **도메인 소유자 정보**를 입력합니다:
   - 구분: 개인
   - 소유자명 (한글/영문), 이메일, 휴대폰 번호, 주소 등
     <img src="/images/step7/7-1-step6-owner-info.png" alt="도메인 소유자 정보 입력" class="guide-img-sm" />
7. 이메일 [[인증하기]]를 클릭합니다.
   - "인증번호를 전송하였습니다" 팝업이 표시됩니다.
   - 이메일로 받은 인증번호를 입력합니다.
     <img src="/images/step7/7-1-step7-email-verify.png" alt="이메일 인증" class="guide-img-sm" />
     <img src="/images/step7/7-1-step7-email-verify2.png" alt="인증번호 입력" class="guide-img-sm" />
     <img src="/images/step7/7-1-step7-email-verify3.png" alt="인증 완료" class="guide-img-sm" />
8. [[소유자 정보 저장]]을 클릭합니다.
   <img src="/images/step7/7-1-step8-save-owner.png" alt="소유자 정보 저장" class="guide-img-sm" />
9. **도메인에 SSL 인증서도 추가하세요** — 선택하지 않습니다 (ACM에서 무료로 발급합니다).
10. **이용 동의** 섹션에서 **전체 동의합니다**를 체크합니다.
    <img src="/images/step7/7-1-step10-agree-pay.png" alt="이용 동의 및 결제" class="guide-img-sm" />
11. [[결제하기]]를 클릭하여 결제를 완료합니다.
    <img src="/images/step7/7-1-step11-payment1.png" alt="결제하기 클릭" class="guide-img-sm" />
    <img src="/images/step7/7-1-step11-payment2.png" alt="브라우저 팝업 해제 1" class="guide-img-sm" />
    <img src="/images/step7/7-1-step11-payment3.png" alt="브라우저 팝업 해제 2" class="guide-img-sm" />
    <img src="/images/step7/7-1-step11-payment4.png" alt="결제 시작 화면" class="guide-img-sm" />

> [!TIP]
> [가비아](https://www.gabia.com)에서도 도메인을 구매할 수 있습니다.  
> cafe24 또는 가비아 중 가격이 저렴하거나 이미 계정이 있는 곳에서 구매하면 됩니다.

> [!WARNING]
> cafe24에서 제안하는 **SSL 인증서**는 유료이므로 선택하지 마세요.  
> 이 실습에서는 AWS Certificate Manager(ACM)에서 **무료로** SSL 인증서를 발급받습니다.

| TLD      | cafe24 (연)  | 가비아 (연, 이벤트가) | 비고                       |
| -------- | ------------ | --------------------- | -------------------------- |
| `.com`   | ~23,500원    | ~19,800원             | 가장 일반적                |
| `.kr`    | 37,400원/2년 | ~16,500원             | 한국 도메인                |
| `.co.kr` | 37,400원/2년 | ~16,500원             | 한국 기업 도메인           |
| `.shop`  | ~550원       | ~2,200원              | 이벤트 특가 (갱신 시 정가) |
| `.store` | ~550원       | ~2,200원              | 이벤트 특가 (갱신 시 정가) |
| `.cloud` | —            | ~2,750원              | 클라우드 관련              |
| `.io`    | —            | ~50,000원             | 기술 스타트업에서 인기     |

> [!TIP]
> `.shop`, `.store`, `.cloud` 등은 첫해 이벤트 가격이 매우 저렴하지만 **2년차 갱신 시 정가**(5~9만원)가 적용됩니다.  
> 학습 목적으로 1년만 사용할 계획이라면 이벤트 도메인이 가장 경제적입니다.  
> 장기 사용 예정이라면 `.com` 또는 `.kr`이 갱신 비용이 안정적입니다.

### 방법 B: Amazon Route 53에서 직접 구매

Amazon Route 53에서도 도메인을 직접 구매할 수 있습니다. 네임서버 설정이 자동으로 처리되어 편리합니다.

> [!NOTE]
> 이 가이드의 스크린샷은 **cafe24에서 구매한 경우**를 기준으로 작성되었습니다.  
> Amazon Route 53에서 구매한 경우 Hosted Zone이 자동 생성되므로 태스크 2(Hosted Zone 생성)와 태스크 3(네임서버 변경)을 건너뛸 수 있습니다.

12. AWS Management Console에 로그인합니다.
13. 상단 검색창에 `Route 53`을 입력하고 선택합니다.
    <img src="/images/step7/7-1-step13-route53-console.png" alt="Route 53 콘솔" class="guide-img-sm" />
14. 왼쪽 메뉴에서 **Registered domains**를 클릭합니다.
    <img src="/images/step7/7-1-step14-registered-domains.png" alt="Registered domains" class="guide-img-sm" />
15. [[Register domains]]를 클릭합니다.
16. 원하는 도메인을 검색합니다.
    <img src="/images/step7/7-1-step16-domain-search.png" alt="도메인 검색" class="guide-img-sm" />
17. 사용 가능한 도메인을 선택하고 [[Proceed to checkout]]을 클릭합니다.
    - "Secure your brand across other extensions" 화면이 나타나면 [[Skip]]을 클릭합니다.
      <img src="/images/step7/7-1-step17-secure-brand-skip.png" alt="추가 도메인 제안 Skip" class="guide-img-sm" />
18. **Pricing** 페이지에서 Duration과 Auto-renew를 확인하고 [[Next]]를 클릭합니다.
    - **Auto-renew**: 학습 목적이라면 해제를 권장합니다.
      <img src="/images/step7/7-1-step18-pricing.png" alt="Pricing 페이지" class="guide-img-sm" />
19. **Contact information** 페이지에서 연락처 정보를 입력하고 [[Next]]를 클릭합니다.
    <img src="/images/step7/7-1-step19-contact-info.png" alt="Contact information 입력" class="guide-img-sm" />
20. **Review and submit** 페이지에서 내용을 확인하고 [[Submit]]을 클릭합니다.

| TLD    | Amazon Route 53 가격 (연) | 비고                  |
| ------ | ------------------------- | --------------------- |
| `.com` | $13                       | Hosted Zone 자동 생성 |
| `.net` | $11                       |                       |
| `.org` | $12                       |                       |
| `.io`  | $39                       |                       |

> [!TIP]
> Amazon Route 53에서 도메인을 구매하면 **Hosted Zone이 자동으로 생성**됩니다.  
> 네임서버 변경 작업이 필요 없어 설정이 간편합니다.  
> cafe24/가비아에서 구매한 경우에는 태스크 3에서 네임서버를 수동으로 변경해야 합니다.

### 어떤 방법을 선택할까?

| 기준        | 가비아             | Amazon Route 53        |
| ----------- | ------------------ | ---------------------- |
| 가격        | 약간 저렴          | 약간 비쌈              |
| 설정 편의성 | 네임서버 변경 필요 | 자동 설정              |
| 관리 통합   | AWS 외부           | AWS 콘솔에서 통합 관리 |
| 한국어 지원 | ✅                 | ❌ (영문)              |
| 결제        | 원화               | 달러 (AWS 청구서)      |

✅ **태스크 완료** — 도메인 구매 방법과 각 방식의 장단점을 이해했습니다.

---

## 태스크 2: Amazon Route 53 Hosted Zone 생성

Hosted Zone은 도메인의 DNS 레코드를 관리하는 컨테이너입니다.

> [!NOTE]
> Amazon Route 53에서 도메인을 구매한 경우 Hosted Zone이 자동 생성됩니다.  
> 이 태스크는 cafe24, 가비아 등 외부에서 도메인을 구매한 경우에 필요합니다.

### Hosted Zone 생성 단계

21. Amazon Route 53 콘솔에서 왼쪽 메뉴의 **Hosted zones**를 클릭합니다.
    <img src="/images/step7/7-1-step21-hosted-zones.png" alt="Hosted zones 메뉴" class="guide-img-sm" />
22. [[Create hosted zone]]을 클릭합니다.
23. **Hosted zone configuration**을 입력합니다:
    - **Domain name**: 구매한 도메인을 입력합니다 (예: `my-starter-app.shop`)
    - **Description**: `My starter app domain` (선택사항)
    - **Type**: **Public hosted zone** 선택
      <img src="/images/step7/7-1-step23-create-hosted-zone.png" alt="Hosted zone 설정" class="guide-img-sm" />
24. **Tags** 섹션에서 [[Add tag]]를 클릭하여 태그를 추가합니다:
    - **Key**: `CreatedBy`, **Value**: `admin-user`
    - **Key**: `Step`, **Value**: `step7`
    - **Key**: `Session`, **Value**: `7-2`
25. [[Create hosted zone]]을 클릭합니다.
    <img src="/images/step7/7-1-step25-hosted-zone-created.png" alt="Hosted zone 생성 완료" class="guide-img-sm" />

### NS 레코드 확인

26. 생성된 Hosted Zone을 클릭합니다.
27. 자동으로 생성된 **NS (Name Server)** 레코드를 확인합니다.

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
> 이 4개의 네임서버를 도메인 등록기관(cafe24/가비아)에 설정해야 합니다.

> [!CONCEPT] Hosted Zone의 기본 레코드
> Hosted Zone을 생성하면 2개의 레코드가 자동으로 생성됩니다:
>
> - **NS (Name Server) 레코드**: 이 도메인의 DNS 질의를 처리할 네임서버 4개가 지정됩니다.  
>   도메인 등록기관(cafe24/가비아)에 이 4개의 네임서버를 등록하면, 해당 도메인의 모든 DNS 요청이 Amazon Route 53으로 전달됩니다.
>   ```
>   ns-1234.awsdns-12.org.
>   ns-567.awsdns-34.co.uk.
>   ns-890.awsdns-56.net.
>   ns-1011.awsdns-78.com.
>   ```
> - **SOA (Start of Authority) 레코드**: DNS 영역의 관리 정보를 담고 있습니다.  
>   주 네임서버, 관리자 이메일, 시리얼 번호, 갱신/재시도 주기 등이 포함됩니다.  
>   직접 수정할 일은 거의 없습니다.
>
> ⚠️ 이 두 레코드는 **삭제하면 안 됩니다.** Hosted Zone이 정상 동작하려면 반드시 유지해야 합니다.

✅ **태스크 완료** — Hosted Zone을 생성하고 NS 레코드 4개를 확인했습니다.

---

## 태스크 3: 네임서버 변경 (cafe24 → Amazon Route 53)

cafe24에서 도메인을 구매한 경우, 네임서버를 Amazon Route 53으로 변경해야 합니다.  
이 작업을 통해 도메인의 DNS 관리 권한을 Amazon Route 53에 위임합니다.

> [!NOTE]
> 가비아에서 구매한 경우도 동일한 방식입니다.  
> **My 가비아 → 도메인 → 관리 → 네임서버** 메뉴에서 변경하면 됩니다.

### cafe24에서 네임서버 변경

28. [cafe24 나의서비스관리](https://hosting.cafe24.com/)에 로그인합니다.
    <img src="/images/step7/7-1-step28-cafe24-login.png" alt="cafe24 나의서비스관리" class="guide-img-sm" />
29. 좌측 메뉴에서 **도메인관리** → **네임서버 변경**을 클릭합니다.
    <img src="/images/step7/7-1-step29-nameserver-menu.png" alt="네임서버 변경 메뉴" class="guide-img-sm" />
30. 도메인 목록에서 해당 도메인의 [[네임서버 변경하기]]를 클릭합니다.
    - 현재 네임서버가 `ns1.cafe24.com` ~ `ns4.cafe24.co.kr`로 설정되어 있습니다.
31. **본인인증** 화면이 나타나면 휴대폰 또는 이메일로 인증을 완료합니다.
    - [[인증번호받기]]를 클릭하고, 받은 인증번호를 입력 후 [[확인]]을 클릭합니다.
      <img src="/images/step7/7-1-step31-nameserver-change1.png" alt="본인인증 1" class="guide-img-sm" />
      <img src="/images/step7/7-1-step31-nameserver-change2.png" alt="본인인증 2" class="guide-img-sm" />
32. **네임서버 변경** 팝업에서 **변경할 네임서버 선택**: **다른 네임서버**를 선택합니다.
33. Amazon Route 53 Hosted Zone의 NS 레코드 4개를 입력합니다:
    - **1차 네임서버**: `ns-xxx.awsdns-xx.org` (Amazon Route 53에서 복사)
    - **2차 네임서버**: `ns-xxxx.awsdns-xx.com`
    - **3차 네임서버**: `ns-xxxx.awsdns-xx.co.uk`
    - **4차 네임서버**: `ns-xxx.awsdns-xx.net`
    - 각 네임서버 입력 후 [[IP 확인]]을 클릭하면 IP 주소가 자동으로 채워집니다.
      <img src="/images/step7/7-1-step33-ns-input.png" alt="네임서버 입력" class="guide-img-sm" />
34. [[변경하기]]를 클릭합니다.
    <img src="/images/step7/7-1-step34-ns-confirm1.png" alt="네임서버 변경 확인 1" class="guide-img-sm" />
    <img src="/images/step7/7-1-step34-ns-confirm2.png" alt="네임서버 변경 확인 2" class="guide-img-sm" />
35. "네임서버 변경신청이 정상적으로 접수되었습니다. 적용되기까지 24시간~48시간이 소요됩니다." 메시지를 확인합니다.

> [!TIP]
> 변경 완료 후 도메인 목록에서 네임서버가 `ns-xxx.awsdns-xx...`로 표시되면 정상입니다.

> [!CONCEPT] DNS 전파(Propagation)란?
>
> 네임서버를 변경하면 전 세계의 DNS 서버들이 새로운 정보를 순차적으로 업데이트합니다.  
> 이 과정을 **DNS 전파(Propagation)**라고 합니다.
>
> ```
> cafe24에서 NS 변경 요청
>   → 상위 DNS(.shop TLD 서버)에 반영
>     → 전 세계 ISP/캐시 DNS에 순차 전파
>       → 사용자의 PC/브라우저에서 새 NS로 질의
> ```
>
> - 각 DNS 서버는 **TTL(Time To Live)** 동안 이전 정보를 캐싱합니다.
> - TTL이 만료되어야 새 정보를 가져오므로, 모든 곳에 반영되기까지 시간이 걸립니다.
> - 일반적으로 수 분~수 시간이면 대부분 반영되지만, 최대 48시간까지 걸릴 수 있습니다.

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

# 특정 DNS 서버에 직접 질의 (로컬 캐시 무시)
dig @8.8.8.8 NS yourdomain.com
nslookup yourdomain.com 8.8.8.8
```

<img src="/images/step7/7-1-step35-dns-check1.png" alt="DNS 전파 확인 1" class="guide-img-sm" />
<img src="/images/step7/7-1-step35-dns-check2.png" alt="DNS 전파 확인 2" class="guide-img-sm" />
<img src="/images/step7/7-1-step35-dns-check-new3.png" alt="DNS 전파 확인 3" class="guide-img-sm" />
<img src="/images/step7/7-1-step35-dns-check3.png" alt="DNS 전파 확인 4" class="guide-img-sm" />

> [!TIP]
> **이전 DNS 정보가 계속 나오는 경우:**
>
> DNS 캐시는 2단계로 존재합니다:
>
> | 캐시 위치                      | 삭제 방법                                                       | 비고               |
> | ------------------------------ | --------------------------------------------------------------- | ------------------ |
> | macOS 로컬 캐시                | `sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder` | 즉시 삭제 가능     |
> | ISP DNS 서버 캐시 (KT, SKT 등) | **삭제 불가** — TTL 만료까지 대기                               | 외부에서 제어 불가 |
>
> `dig @8.8.8.8`에서 Amazon Route 53이 나오는데 로컬 `dig`에서 안 나오면, ISP DNS 캐시가 아직 갱신되지 않은 것입니다.
>
> **우회 방법:** macOS DNS 서버를 변경합니다:
>
> ```
> 시스템 설정 → Wi-Fi → 연결된 네트워크 우측 [세부사항...] → DNS → + 버튼
>   → 8.8.8.8 (Google) 또는 1.1.1.1 (Cloudflare) 추가
> ```
>
> 이렇게 하면 ISP DNS를 거치지 않으므로 전파된 결과를 즉시 확인할 수 있습니다.

> [!OUTPUT]
> Amazon Route 53 네임서버가 응답하면 전파가 완료된 것입니다:
>
> ```
> yourdomain.com.    172800  IN  NS  ns-1234.awsdns-12.org.
> yourdomain.com.    172800  IN  NS  ns-567.awsdns-34.com.
> yourdomain.com.    172800  IN  NS  ns-890.awsdns-56.co.uk.
> yourdomain.com.    172800  IN  NS  ns-1011.awsdns-78.net.
> ```

✅ **태스크 완료** — cafe24(또는 가비아)에서 Amazon Route 53으로 네임서버를 변경하고 전파를 확인했습니다.

> [!NOTE]
> NS 전파가 완료되어야 이후 태스크(A 레코드 접속 테스트, ACM DNS 검증)가 정상 동작합니다.  
> `nslookup` 또는 `dig`로 NS가 Amazon Route 53으로 바뀐 것을 확인한 후 다음 태스크를 진행하세요.  
> 전파가 안 됐다면 태스크 5(ACM 인증서 요청)까지는 진행 가능하지만, DNS 검증 완료에 시간이 더 걸릴 수 있습니다.

> [!TROUBLESHOOTING]
> | 증상 | 원인 | 해결 방법 |
> |------|------|-----------|
> | `dig NS` 결과에 Amazon Route 53 네임서버 미표시 | DNS 전파 미완료 | 최대 48시간 대기, `dig @8.8.8.8 NS` 로 확인 |
> | 네임서버 변경 후 사이트 접속 불가 | 전파 중 일부 DNS가 이전 NS 참조 | 시간 경과 후 자동 해결, 급하면 hosts 파일로 우회 |
> | cafe24/가비아에서 네임서버 변경 실패 | 네임서버 주소 끝에 `.` 포함 | cafe24/가비아에서는 마지막 `.` 제거하고 입력 |
> | 4개 미만의 NS만 입력 가능 | 등록기관 UI 제한 | 4차까지 모두 입력 (일부 등록기관은 2개만 필수) |

---

## 태스크 4: A 레코드 설정 (NS 전파 확인)

NS 변경이 전파되었는지 확인하기 위해, 도메인을 Amazon EC2 Public IP에 연결하고 브라우저에서 접속해봅니다.

> [!NOTE]
> 이 태스크는 NS 전파 완료 후에 테스트할 수 있습니다.  
> 아직 전파가 안 됐다면 태스크 5(ACM 인증서)를 먼저 진행하고 돌아와도 됩니다.

### EC2 준비

**옵션 A: 기존 EC2가 있는 경우**

이전 차시에서 생성한 Amazon EC2가 실행 중이라면 해당 Public IP를 사용합니다.

**옵션 B: EC2가 없는 경우**

간단하게 Nginx EC2 1대를 생성합니다:

36. 상단 검색창에 `EC2`를 입력하고 선택합니다.
37. 왼쪽 메뉴에서 **Instances**를 클릭합니다.
    <img src="/images/step7/7-1-step37-ec2-instances.png" alt="EC2 Instances" class="guide-img-sm" />
38. [[Launch instances]]를 클릭합니다.
39. 다음을 설정합니다:
    - **Name and tags**: `route53-test`
      - [[Add additional tags]]를 클릭하여 태그 추가:
      - **Key**: `CreatedBy`, **Value**: `admin-user`
      - **Key**: `Step`, **Value**: `step7`
      - **Key**: `Session`, **Value**: `7-1`
    - **Application and OS Images (AMI)**: Amazon Linux 2023 (기본 선택)
    - **Instance type**: `t3.micro`
    - **Key pair (login)**: 기존 Key Pair 선택 (없으면 [[Create new key pair]]로 생성)
      <img src="/images/step7/7-1-step39-launch-instance.png" alt="Launch instance 설정" class="guide-img-sm" />
40. **Network settings** — [[Edit]]를 클릭하고 다음을 설정합니다:
    - **VPC**: 기본 VPC (또는 실습용 VPC)
    - **Subnet**: Public Subnet 선택
    - **Auto-assign public IP**: `Enable`
    - **Firewall (security groups)**: [[Create security group]] 선택
    - **Security group name**: `route53-test-sg`
    - **Description**: `Allow SSH and HTTP for Amazon Route 53 test`
    - **Inbound Security Group Rules**:
      - Rule 1 (기본 생성됨): **Type** `ssh`, **Source type** `Anywhere`, **Source** `0.0.0.0/0`
      - [[Add security group rule]]을 클릭하여 Rule 2 추가:
      - **Type**: `HTTP`, **Source type**: `Anywhere`, **Source**: `0.0.0.0/0`
        <img src="/images/step7/7-1-step40-network-settings.png" alt="Network settings" class="guide-img-sm" />

> [!NOTE]
> **HTTP(80)** 규칙을 반드시 추가하세요.  
> 이 규칙이 없으면 브라우저에서 도메인으로 접속할 때 연결 시간 초과가 발생합니다.

41. **Advanced details**를 펼치고 맨 아래 **User Data**에 다음 스크립트를 입력합니다:

```bash
#!/bin/bash
dnf install -y nginx

# IMDSv2 토큰 획득 후 인스턴스 메타데이터 조회
TOKEN=$(curl -s -X PUT "http://169.254.169.254/latest/api/token" \
  -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")
INSTANCE_ID=$(curl -s -H "X-aws-ec2-metadata-token: $TOKEN" \
  http://169.254.169.254/latest/meta-data/instance-id)
AZ=$(curl -s -H "X-aws-ec2-metadata-token: $TOKEN" \
  http://169.254.169.254/latest/meta-data/placement/availability-zone)
PRIVATE_IP=$(curl -s -H "X-aws-ec2-metadata-token: $TOKEN" \
  http://169.254.169.254/latest/meta-data/local-ipv4)

# 인스턴스 식별 HTML 페이지 생성
cat > /usr/share/nginx/html/index.html <<EOF
<!DOCTYPE html>
<html>
<head><title>Amazon Route 53 Test</title>
<style>
  body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f0f8ff; }
  .card { background: white; border-radius: 10px; padding: 30px; max-width: 500px; margin: 0 auto; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
  .instance-id { color: #2563eb; font-size: 1.2em; font-weight: bold; }
</style>
</head>
<body>
  <div class="card">
    <h1>Hello from Amazon Route 53!</h1>
    <p class="instance-id">Instance: $INSTANCE_ID</p>
    <p>AZ: $AZ | IP: $PRIVATE_IP</p>
  </div>
</body>
</html>
EOF

# Health Check 엔드포인트
mkdir -p /usr/share/nginx/html/health
echo "OK" > /usr/share/nginx/html/health/index.html

systemctl start nginx
systemctl enable nginx
```

<img src="/images/step7/7-1-step41-userdata.png" alt="User Data 입력" class="guide-img-sm" />

42. [[Launch instance]]를 클릭합니다.
    <img src="/images/step7/7-1-step42-launch1.png" alt="Launch instance 클릭" class="guide-img-sm" />
    <img src="/images/step7/7-1-step42-launch2.png" alt="인스턴스 생성 완료" class="guide-img-sm" />
43. 인스턴스가 **Running** 상태가 되면 **Public IPv4 address**를 복사합니다.
    <img src="/images/step7/7-1-step43-public-ip.png" alt="Public IP 확인" class="guide-img-sm" />
    - Instances 목록에서 `route53-test`를 클릭 → **Details** 탭에서 확인합니다.

> [!TIP]
> 인스턴스 생성 후 Nginx가 시작되기까지 약 1분 소요됩니다.  
> `http://<Public IP>`로 접속하여 Nginx 기본 페이지가 나오는지 먼저 확인하세요.
>
> <img src="/images/step7/7-1-step43-tip1.png" alt="Nginx 접속 확인 1" class="guide-img-sm" />
> <img src="/images/step7/7-1-step43-tip2.png" alt="Nginx 접속 확인 2" class="guide-img-sm" />

### A 레코드 생성

44. Amazon Route 53 콘솔 → **Hosted zones** → 도메인을 클릭합니다.
    <img src="/images/step7/7-1-step44-hosted-zone.png" alt="Hosted zone 선택" class="guide-img-sm" />
45. [[Create record]]를 클릭합니다.
46. 다음을 설정합니다:
    - **Record name**: 비워둡니다 (루트 도메인)
    - **Record type**: **A – Routes traffic to an IPv4 address**
    - **Value**: EC2 Public IP (예: `3.35.xxx.xxx`)
    - **TTL**: `300`
    - **Routing policy**: Simple routing
      <img src="/images/step7/7-1-step46-create-record.png" alt="A 레코드 생성" class="guide-img-sm" />
47. [[Create records]]를 클릭합니다.
    <img src="/images/step7/7-1-step47-record-created.png" alt="레코드 생성 완료" class="guide-img-sm" />

### 도메인 접속 확인

48. 브라우저에서 `http://내도메인.shop`(구매한 도메인)으로 접속합니다.
    - Nginx 기본 페이지 또는 본인 앱이 표시되면 **NS 전파 + A 레코드 설정 성공**입니다.
      <img src="/images/step7/7-1-step48-browser-test.png" alt="도메인 접속 확인" class="guide-img-sm" />

```bash
# CLI로 확인
nslookup 내도메인.shop
dig A 내도메인.shop
```

<img src="/images/step7/7-1-step48-cli-test.png" alt="CLI로 DNS 확인" class="guide-img-sm" />

> [!TROUBLESHOOTING]
> | 증상 | 원인 | 해결 |
> |------|------|------|
> | 접속 안 됨 (DNS 응답 없음) | NS 전파 미완료 | 30분~수 시간 대기 후 재시도 |
> | DNS 응답은 있으나 연결 안 됨 | EC2 SG에서 80 포트 미허용 | Security Group Inbound 확인 |
> | 이전 DNS가 응답 | 로컬 DNS 캐시 | `nslookup` 또는 시크릿 모드로 확인 |

> [!CONCEPT] A 레코드 vs CNAME vs Alias
>
> - **A 레코드**: 도메인 → IP 주소 매핑. 루트 도메인에 사용 가능.
> - **CNAME 레코드**: 도메인 → 다른 도메인 매핑. 루트 도메인에는 사용 불가.
> - **Alias 레코드** (Amazon Route 53 전용): 루트 도메인에서도 ALB, CloudFront 등 AWS 리소스를 가리킬 수 있는 특수 레코드.  
>   다음 실습(7-2 ALB)에서 A 레코드를 ALB Alias로 변경합니다.

> [!TIP]
> Amazon EC2의 Public IP는 인스턴스를 중지/시작하면 변경됩니다.  
> 다음 실습(7-2)에서 ALB를 사용하면 IP 변경 걱정 없이 Alias 레코드로 연결할 수 있습니다.

✅ **태스크 완료** — A 레코드를 설정하고 도메인으로 접속을 확인했습니다.

---

## 태스크 5: ACM 인증서 요청

AWS Certificate Manager(ACM)에서 무료 SSL/TLS 인증서를 발급받습니다.

### 인증서 요청 단계

49. 상단 검색창에 `Certificate Manager`를 입력하고 선택합니다.
    <img src="/images/step7/7-1-step49-acm-console.png" alt="ACM 콘솔" class="guide-img-sm" />

> [!WARNING]
> **리전 선택이 중요합니다!**
>
> - **ALB에 사용할 인증서**: ALB가 있는 리전에서 발급 (예: ap-northeast-2)
> - **Amazon CloudFront에 사용할 인증서**: 반드시 **us-east-1 (N. Virginia)** 리전에서 발급
>
> Amazon CloudFront용 인증서를 서울 리전에서 발급하면 연결할 수 없습니다.

50. [[Request a certificate]]를 클릭합니다.
    <img src="/images/step7/7-1-step50-request-cert.png" alt="Request a certificate" class="guide-img-sm" />
51. **Certificate type**: **Request a public certificate**를 선택합니다.
    <img src="/images/step7/7-1-step51-public-cert.png" alt="Public certificate 선택" class="guide-img-sm" />
52. [[Next]]를 클릭합니다.
53. **Request public certificate** 페이지에서 다음을 설정합니다:
    - **Domain names**:
      - **Fully qualified domain name**: 구매한 도메인을 입력합니다 (예: `my-starter-app.shop`)
      - [[Add another name to this certificate]]를 클릭하여 와일드카드 추가: `*.my-starter-app.shop`
    - **Allow export**: **Disable export** (기본값)
    - **Validation method**: **DNS validation – recommended** (기본값)
    - **Key algorithm**: **RSA 2048** (기본값)
    - **Tags**: [[Add new tag]]를 클릭하여 태그 추가:
      - **Key**: `CreatedBy`, **Value**: `admin-user`
      - **Key**: `Step`, **Value**: `step7`
      - **Key**: `Session`, **Value**: `7-1`
        <img src="/images/step7/7-1-step53-domain-names.png" alt="도메인 및 설정 입력" class="guide-img-sm" />
54. [[Request]]를 클릭합니다.
    <img src="/images/step7/7-1-step54-request.png" alt="인증서 요청 완료" class="guide-img-sm" />

> [!CONCEPT] 와일드카드 인증서 (\*.yourdomain.com)
> 와일드카드 인증서 하나로 모든 서브도메인에 HTTPS를 적용할 수 있습니다:
>
> - `api.yourdomain.com` ✅
> - `www.yourdomain.com` ✅
> - `dev.yourdomain.com` ✅
>
> 단, 루트 도메인(`yourdomain.com`)은 와일드카드에 포함되지 않으므로 별도로 추가해야 합니다.  
> 그래서 두 개를 함께 요청합니다.

> [!TIP]
> **Step 8(3-Tier 아키텍처)에서 Amazon CloudFront를 사용할 예정이라면:**  
> 이 시점에서 리전을 **us-east-1 (N. Virginia)**로 변경하고 동일한 인증서를 한 번 더 발급하세요 (태스크 5와 동일한 설정).  
> 다음 태스크(태스크 6)에서 DNS 검증 CNAME을 1번만 등록하면 양쪽 인증서 모두 자동 검증됩니다.
>
> <img src="/images/step7/7-1-step54-tip-virginia.png" alt="버지니아 리전 인증서 발급" class="guide-img-sm" />
> <img src="/images/step7/7-1-step54-tip-virginia2.png" alt="버지니아 리전 인증서 발급 완료" class="guide-img-sm" />

✅ **태스크 완료** — ACM에서 와일드카드 인증서를 요청했습니다.

---

## 태스크 6: DNS 검증 레코드 생성

인증서 소유권을 증명하기 위해 DNS에 검증 레코드를 추가합니다.

### Amazon Route 53 자동 생성 (가장 간편한 방법)

55. ACM 콘솔에서 방금 요청한 인증서를 클릭합니다.
56. **Status**가 **Pending validation**인 것을 확인합니다.
    <img src="/images/step7/7-1-step56-pending-validation.png" alt="Pending validation 상태" class="guide-img-sm" />
57. **Domains** 섹션에서 검증이 필요한 도메인 목록을 확인합니다.
58. [[Create records in Amazon Route 53]]를 클릭합니다.
59. 검증 레코드 목록을 확인하고 [[Create records]]를 클릭합니다.
    <img src="/images/step7/7-1-step59-create-records1.png" alt="DNS 검증 레코드 생성 1" class="guide-img-sm" />
    <img src="/images/step7/7-1-step59-create-records2.png" alt="DNS 검증 레코드 생성 2" class="guide-img-sm" />

> [!OUTPUT]
> "Successfully created DNS records" 메시지가 표시됩니다.  
> Amazon Route 53 Hosted Zone에 CNAME 레코드가 자동으로 추가됩니다.

### 검증 완료 대기

60. ACM 콘솔에서 인증서 상태를 확인합니다.
61. **Status**가 **Pending validation** → **Issued**로 변경될 때까지 대기합니다.
    <img src="/images/step7/7-1-step61-issued.png" alt="인증서 Issued 상태" class="guide-img-sm" />

> [!NOTE]
> DNS 검증은 보통 수 분 내에 완료됩니다. 최대 30분까지 걸릴 수 있습니다.  
> 네임서버 변경 직후라면 DNS 전파 시간만큼 추가로 걸릴 수 있습니다.

### 수동으로 CNAME 레코드 추가 (Amazon Route 53 외 DNS 사용 시)

Amazon Route 53을 사용하지 않는 경우, ACM이 제공하는 CNAME 레코드를 수동으로 추가해야 합니다:

```
Record name: _abc123def456.yourdomain.com
Record type: CNAME
Value: _xyz789ghi012.acm-validations.aws.
```

> [!TIP]
> DNS 검증 레코드는 인증서가 존재하는 한 유지해야 합니다.  
> 삭제하면 인증서 갱신 시 검증에 실패할 수 있습니다.  
> ACM 인증서는 만료 60일 전에 자동 갱신을 시도하며, 이때 DNS 검증 레코드가 있어야 자동 갱신이 성공합니다.

✅ **태스크 완료** — DNS 검증 레코드를 생성하고 인증서 발급을 완료했습니다.

> [!TROUBLESHOOTING]
> | 증상 | 원인 | 해결 방법 |
> |------|------|-----------|
> | 인증서가 30분 이상 `Pending validation` | DNS 검증 레코드 미생성 또는 전파 미완료 | Amazon Route 53에서 CNAME 레코드 존재 확인, 네임서버 전파 확인 |
> | "Create records in Amazon Route 53" 버튼 비활성 | Hosted Zone이 없거나 다른 계정 | Amazon Route 53에 해당 도메인의 Hosted Zone 존재 확인 |
> | 인증서 발급 후 ALB에 연결 불가 | 리전 불일치 | ALB와 같은 리전에서 인증서 발급 확인 |
> | CloudFront에 인증서 연결 불가 | us-east-1 외 리전에서 발급 | us-east-1 (N. Virginia)에서 재발급 |
> | 인증서 자동 갱신 실패 | DNS 검증 CNAME 레코드 삭제됨 | ACM 콘솔에서 CNAME 레코드 재생성 |

---

## 태스크 7: 인증서 활용 방법 안내

발급받은 ACM 인증서는 다음 AWS 서비스에 연결하여 HTTPS를 적용할 수 있습니다.

> [!NOTE]
> 이 태스크에서는 **활용 방법을 안내**만 합니다.  
> 실제 적용은 다음 실습(7-2: ALB)과 Step 8(3-Tier: CloudFront)에서 진행합니다.  
> ACM 인증서는 Amazon EC2에 직접 설치할 수 없으며, ALB/CloudFront/API Gateway 등 AWS 관리형 서비스를 통해서만 사용 가능합니다.

### 활용 시나리오

| 연결 대상          | 구성                                  | 인증서 리전           | 실습     |
| ------------------ | ------------------------------------- | --------------------- | -------- |
| ALB                | 사용자 → HTTPS → ALB → HTTP → EC2     | ap-northeast-2 (서울) | Step 7-2 |
| Amazon CloudFront  | 사용자 → HTTPS → CloudFront → S3      | us-east-1 (버지니아)  | Step 8   |
| Amazon API Gateway | 사용자 → HTTPS → API Gateway → Lambda | ap-northeast-2        | —        |

### 전체 아키텍처 예시

```
사용자 브라우저
  ├── api.yourdomain.com  → [ALB + ACM 인증서] → [EC2 Spring Boot]
  └── www.yourdomain.com  → [CloudFront + ACM 인증서] → [S3 Vue.js]
```

> [!TIP]
> ACM 인증서는 **무료**이므로 미리 발급받아 두어도 비용이 발생하지 않습니다.  
> 서울 리전 + 버지니아 리전 둘 다 발급해두면 이후 실습에서 바로 사용할 수 있습니다.

✅ **태스크 완료** — ACM 인증서의 활용 방법(ALB, CloudFront, API Gateway)을 이해했습니다.

---

## 마무리

이 실습에서 다음을 성공적으로 수행했습니다:

- 도메인을 구매하고(또는 기존 도메인을 사용하고) Amazon Route 53 Hosted Zone에 연결했습니다.
- 네임서버를 변경하여 Amazon Route 53이 도메인의 DNS를 관리하도록 설정했습니다.
- A 레코드를 생성하여 도메인으로 ALB 또는 EC2에 접속할 수 있게 했습니다.
- ACM에서 SSL/TLS 인증서를 요청하고 DNS 검증을 완료했습니다.

> [!TIP]
> 인증서를 ALB HTTPS Listener에 연결하면 `https://도메인`으로 안전하게 접속할 수 있습니다.  
> 이 연결은 Step 8(3-Tier 아키텍처) 또는 향후 실습에서 진행합니다.

---

# 🗑️ 리소스 정리

> [!WARNING]
> Amazon Route 53 Hosted Zone은 월 $0.50이 과금됩니다.  
> 도메인을 더 이상 사용하지 않는다면 삭제하여 비용을 절약하세요.

### 옵션 A: 리소스 유지 (이후 실습에서 사용)

도메인과 Hosted Zone은 이후 실습(ALB HTTPS 연결, CloudFront 연결)에서 계속 사용합니다.  
월 $0.50의 비용이 부담되지 않는다면 유지하는 것을 권장합니다.

| 유지할 리소스 | 월 비용           | 이유                              |
| ------------- | ----------------- | --------------------------------- |
| Hosted Zone   | $0.50             | 이후 ALB/CloudFront 실습에서 사용 |
| ACM 인증서    | $0                | 무료이므로 유지 권장              |
| A 레코드      | $0                | 쿼리 비용 극소                    |
| 도메인        | (갱신 시 연 비용) | 자동 갱신 해제로 추가 비용 방지   |

**태스크 4에서 테스트 EC2를 생성한 경우 삭제합니다:**

1. 상단 검색창에 `EC2`를 입력하고 선택합니다.
2. 왼쪽 메뉴에서 **Instances**를 클릭합니다.
3. `route53-test`를 선택합니다.
4. **Instance state** → **Terminate instance**를 클릭합니다.
   <img src="/images/step7/7-1-cleanup4-terminate-ec2.png" alt="EC2 Terminate" class="guide-img-sm" />
5. 확인 팝업에서 [[Terminate]]를 클릭합니다.
   <img src="/images/step7/7-1-cleanup5-terminate-confirm1.png" alt="Terminate 확인 1" class="guide-img-sm" />
   <img src="/images/step7/7-1-cleanup5-terminate-confirm2.png" alt="Terminate 확인 2" class="guide-img-sm" />
6. 왼쪽 메뉴에서 **Network & Security** → **Security Groups**를 클릭합니다.
7. `route53-test-sg`를 선택합니다.
8. **Actions** → **Delete security groups**를 클릭합니다.
   <img src="/images/step7/7-1-cleanup8-delete-sg.png" alt="Security Group 삭제" class="guide-img-sm" />
9. 확인 팝업에서 [[Delete]]를 클릭합니다.
   <img src="/images/step7/7-1-cleanup9-delete-sg-confirm1.png" alt="SG 삭제 확인 1" class="guide-img-sm" />
   <img src="/images/step7/7-1-cleanup9-delete-sg-confirm2.png" alt="SG 삭제 확인 2" class="guide-img-sm" />

> [!NOTE]
> 이전 차시의 기존 EC2를 사용한 경우(옵션 A로 태스크 4를 진행한 경우)  
> EC2를 삭제하지 않아도 됩니다. A 레코드만 삭제하거나 유지하세요.

✅ **옵션 A 완료** — Hosted Zone과 ACM 인증서를 유지하고, 테스트 EC2만 삭제했습니다.

> [!WARNING]
> **Hosted Zone을 삭제했다가 다시 생성하면:**
>
> - 같은 달에 삭제 후 재생성하면 **$0.50이 2번 과금**됩니다 (삭제 전 1회 + 재생성 1회).
> - 새 Hosted Zone의 **네임서버(NS)가 변경**됩니다. — 이전과 다른 NS가 할당됩니다.
> - 도메인 등록기관(cafe24/가비아/Amazon Route 53)에서 네임서버를 다시 변경해야 합니다.
> - 네임서버 변경이 전파되기까지 **24~48시간** 동안 도메인이 작동하지 않을 수 있습니다.
> - ACM 인증서의 DNS 검증 CNAME 레코드도 새 Hosted Zone에 다시 생성해야 합니다.
>
> **결론:** 월 $0.50을 아끼려고 삭제했다가 재생성하면 오히려 비용이 더 들고, 설정도 처음부터 다시 해야 합니다.  
> 계속 사용할 예정이라면 **삭제하지 말고 유지하세요.**

### 옵션 B: 리소스 삭제

> [!NOTE]
> 삭제 순서:
>
> Tag Editor 확인 → EC2(태스크 4에서 생성한 경우) → Hosted Zone 레코드 → Hosted Zone → ACM 인증서 → 도메인 자동 갱신 해제 → Tag Editor 최종 확인

---

### 단계 1: Tag Editor로 리소스 확인

먼저 이 실습에서 생성한 리소스를 Tag Editor로 한눈에 확인합니다.

10. 상단 검색창에 `Resource Groups & Tag Editor`를 입력하고 선택합니다.
11. 왼쪽 메뉴에서 **Tag Editor**를 선택합니다.
12. 다음 조건으로 검색합니다:
    - **Regions**: `ap-northeast-2`
    - **Tag key**: `Session`, **Tag value**: `7-1`

13. [[Search resources]]를 클릭합니다.
    <img src="/images/step7/7-1-cleanup13-tag-editor.png" alt="Tag Editor 검색" class="guide-img-sm" />

> [!TIP]
> Amazon Route 53 Hosted Zone과 ACM 인증서는 Tag Editor에서 검색되지 않을 수 있습니다.  
> 아래 단계에서 각 서비스 콘솔에서 직접 삭제합니다.

---

### 단계 2: 테스트 EC2 삭제 (태스크 4에서 생성한 경우)

태스크 4에서 `route53-test` EC2를 생성한 경우 삭제합니다.

14. EC2 콘솔 → **Instances**에서 `route53-test`를 선택합니다.
15. **Instance state** → **Terminate instance**를 클릭합니다.
    <img src="/images/step7/7-1-cleanup4-terminate-ec2.png" alt="EC2 Terminate" class="guide-img-sm" />
16. 확인 팝업에서 [[Terminate]]를 클릭합니다.
    <img src="/images/step7/7-1-cleanup5-terminate-confirm1.png" alt="Terminate 확인 1" class="guide-img-sm" />
    <img src="/images/step7/7-1-cleanup5-terminate-confirm2.png" alt="Terminate 확인 2" class="guide-img-sm" />
17. **Security Groups**에서 `route53-test-sg`를 선택하고 삭제합니다.
    <img src="/images/step7/7-1-cleanup8-delete-sg.png" alt="Security Group 삭제" class="guide-img-sm" />

> [!NOTE]
> 이전 차시의 기존 EC2를 사용한 경우 이 단계는 건너뜁니다.

---

### 단계 3: Hosted Zone 내 레코드 삭제

Hosted Zone을 삭제하려면 NS, SOA 레코드를 제외한 모든 레코드를 먼저 삭제해야 합니다.

18. Amazon Route 53 콘솔 → **Hosted zones** → 도메인 선택
19. A 레코드, CNAME 레코드 등 직접 생성한 레코드를 모두 선택하고 [[Delete records]]를 클릭합니다.
    <img src="/images/step7/7-1-cleanup19-select-records.png" alt="레코드 선택" class="guide-img-sm" />
20. 확인 팝업에서 [[Delete]]를 클릭합니다.
    <img src="/images/step7/7-1-cleanup20-delete-records.png" alt="레코드 삭제 확인" class="guide-img-sm" />

> [!NOTE]
> NS 레코드와 SOA 레코드는 Hosted Zone 삭제 시 자동으로 제거됩니다.  
> 수동으로 삭제할 필요 없습니다.

---

### 단계 4: Hosted Zone 삭제 (월 $0.50 절약)

21. Amazon Route 53 콘솔 → **Hosted zones** → 도메인을 선택합니다.
    <img src="/images/step7/7-1-cleanup21-hosted-zone-select.png" alt="Hosted Zone 선택" class="guide-img-sm" />
22. [[Delete]]을 클릭합니다.
23. 확인 입력란에 `delete`를 입력합니다.
    <img src="/images/step7/7-1-cleanup23-delete-hosted-zone.png" alt="Hosted Zone 삭제 확인" class="guide-img-sm" />
24. [[Delete]]를 클릭합니다.

> [!WARNING]
> Hosted Zone을 삭제하면 해당 도메인의 모든 DNS 레코드가 사라집니다.  
> 서비스가 운영 중이라면 절대 삭제하지 마세요.

---

### 단계 5: ACM 인증서 삭제 (선택)

ACM 인증서는 무료이므로 유지해도 비용이 발생하지 않습니다. 삭제하려면:

25. 상단 검색창에 `Certificate Manager`를 입력하고 선택합니다.
26. 삭제할 인증서를 체크합니다.
27. [[More actions]] 드롭다운 → [[Delete]]를 클릭합니다.
    <img src="/images/step7/7-1-cleanup27-delete-acm.png" alt="ACM 인증서 삭제" class="guide-img-sm" />
28. 확인 입력란에 `delete`를 입력합니다.
    <img src="/images/step7/7-1-cleanup28-delete-acm-confirm.png" alt="ACM 삭제 확인" class="guide-img-sm" />
29. [[Delete]]를 클릭합니다.

> [!NOTE]
> 인증서가 ALB나 Amazon CloudFront에 연결되어 있으면 "Delete" 옵션이 비활성화됩니다.  
> 먼저 ALB Listener 또는 CloudFront에서 인증서 연결을 해제한 후 삭제하세요.  
> 버지니아 리전(us-east-1)에서 발급한 인증서도 별도로 삭제해야 합니다 — 리전을 변경 후 동일하게 삭제합니다.

---

### 단계 6: 도메인 자동 갱신 해제

도메인을 더 이상 사용하지 않는다면 자동 갱신을 해제하여 다음 해 갱신 비용을 방지합니다.

**cafe24에서 구매한 경우:**

30. [cafe24 나의서비스관리](https://hosting.cafe24.com/)에 로그인합니다.
31. 좌측 메뉴에서 **도메인관리** → **기본관리**를 클릭합니다.
32. 해당 도메인의 **자동 연장** 설정을 **해제**합니다.

**가비아에서 구매한 경우:**

33. [가비아](https://www.gabia.com)에 로그인합니다.
34. **My 가비아** → **도메인** → **도메인 관리**로 이동합니다.
35. 해당 도메인의 **자동 연장** 설정을 **해제**합니다.

**Amazon Route 53에서 구매한 경우:**

36. Amazon Route 53 콘솔 → **Registered domains** → 도메인을 선택합니다.
37. **Auto-renew** 옆의 [[Disable]]을 클릭합니다.

> [!NOTE]
> 자동 갱신을 해제하면 만료일 이후 도메인이 반환됩니다.  
> 계속 사용할 예정이라면 해제하지 마세요.

---

### 단계 7: Tag Editor 최종 확인

38. 상단 검색창에 `Resource Groups & Tag Editor`를 입력하고 선택합니다.
39. 왼쪽 메뉴에서 **Tag Editor**를 선택합니다.
40. 다음 조건으로 검색합니다:
    - **Regions**: `ap-northeast-2`
    - **Tag key**: `Session`, **Tag value**: `7-1`
41. [[Search resources]]를 클릭합니다.
42. 검색 결과가 없으면 모든 태그된 리소스가 정리된 것입니다.

✅ **실습 종료**: 모든 리소스가 정리되었습니다.

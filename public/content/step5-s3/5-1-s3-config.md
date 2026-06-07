---
title: 'Amazon S3 버킷 생성과 핵심 설정 이해'
week: 5
session: 1
awsServices:
  - Amazon S3
learningObjectives:
  - S3 버킷을 생성하고 주요 설정 옵션을 이해할 수 있습니다.
  - Block Public Access, 버전 관리, 암호화 설정을 구성할 수 있습니다.
  - 버킷 정책과 ACL의 차이를 설명할 수 있습니다.
  - S3의 다양한 사용 시나리오를 설명할 수 있습니다.
  - 수명 주기 규칙을 설정하여 비용을 최적화할 수 있습니다.
prerequisites:
  - AWS 계정 생성 완료
estimatedCost: 크레딧 내 사용 가능 (비용 매우 저렴)
---

이 실습에서는 Amazon S3의 핵심 개념을 이해하고, 버킷을 생성하여 주요 설정을 구성합니다.  
파일 업로드/다운로드를 테스트하고, 버킷 정책과 수명 주기 규칙을 설정하여 실무에서 S3를 활용하는 방법을 학습합니다.

> [!NOTE]
> 이 실습은 독립적으로 진행할 수 있습니다. AWS 계정만 있으면 바로 시작할 수 있습니다.

### 실습 흐름

```
[개념 이해] → [버킷 생성] → [핵심 설정] → [업로드/다운로드] → [퍼블릭 접근] → [버전 관리] → [수명 주기] → [시나리오 정리]
```

---

## 태스크 1: S3 개념 이해

Amazon S3(Simple Storage Service)는 AWS의 오브젝트 스토리지 서비스입니다.  
파일 시스템이나 블록 스토리지와는 근본적으로 다른 구조를 가집니다.

### 오브젝트 스토리지 vs 블록 스토리지

| 항목        | 오브젝트 스토리지 (S3)     | 블록 스토리지 (EBS)     |
| ----------- | -------------------------- | ----------------------- |
| 구조        | 플랫한 키-값 구조          | 파일 시스템 계층 구조   |
| 접근 방식   | HTTP API (REST)            | OS에 마운트하여 접근    |
| 수정 방식   | 전체 객체 교체 (덮어쓰기)  | 부분 수정 가능          |
| 용량 제한   | 무제한                     | 볼륨 크기 지정 필요     |
| 적합한 용도 | 이미지, 동영상, 백업, 로그 | 데이터베이스, OS 디스크 |
| 비용        | 저장량 기반 (매우 저렴)    | 프로비저닝 용량 기반    |

> [!CONCEPT] 버킷 / 객체 / 키
>
> - **버킷(Bucket)**: 객체를 담는 최상위 컨테이너. 기본적으로 전 세계에서 고유한 이름이 필요합니다.   
> (Account Regional Namespace 사용 시 계정+리전 범위로 한정 가능)
> - **객체(Object)**: S3에 저장되는 개별 파일. 최대 5TB까지 저장 가능합니다.
> - **키(Key)**: 버킷 내에서 객체를 식별하는 고유 경로. 예: `images/profile/user-123.jpg`
>
> S3에는 실제 "폴더"가 없습니다.   
> `images/profile/user-123.jpg`는 하나의 키(문자열)일 뿐이며, 콘솔에서 폴더처럼 보여주는 것은 UI의 편의 기능입니다.

### S3 주요 특징

- **내구성**: 99.999999999% (11 nines) — 데이터 손실 가능성이 극히 낮음
- **가용성**: 99.99% — 거의 항상 접근 가능
- **무제한 용량**: 저장할 수 있는 객체 수와 총 용량에 제한 없음
- **리전 기반**: 버킷은 특정 리전에 생성되며, 데이터는 해당 리전 내 최소 3개 AZ에 자동 복제됨
- **HTTP/HTTPS 기반 접근**: REST API로 어디서든 접근 가능 (AWS SDK, CLI, 콘솔 모두 내부적으로 HTTP API 호출)
- **비용 효율**: 저장한 만큼만 과금 (프로비저닝 불필요). GB당 월 $0.025 수준으로 매우 저렴
- **다양한 스토리지 클래스**: 접근 빈도에 따라 Standard → IA → Glacier 등 6단계로 비용 최적화 가능
- **이벤트 알림**: 객체 생성/삭제 시 Lambda, SQS, SNS를 자동 트리거 (이미지 리사이즈, 로그 처리 등)
- **정적 웹 호스팅**: 별도 서버 없이 HTML/CSS/JS 파일을 S3에서 직접 서빙 가능 (CloudFront 연동 시 CDN + HTTPS)
- **버전 관리**: 객체의 모든 변경 이력을 자동 보존하여 실수로 덮어쓰거나 삭제해도 복원 가능

✅ **태스크 완료** — S3의 핵심 개념(오브젝트 스토리지, 버킷, 객체, 키)을 이해했습니다.

---

## 태스크 2: S3 버킷 생성

### 버킷 이름 규칙

S3 버킷에는 두 가지 네임스페이스 방식이 있습니다:

| 방식 | 이름 고유 범위 | 형식 예시 | 비고 |
| ---- | -------------- | --------- | ---- |
| **Global namespace** (기본) | 전 세계 모든 AWS 계정에서 고유 | `my-app-bucket` | 기존 방식, 이 실습에서 사용 |
| **Account regional namespace** (2026.03~) | 내 계정 + 리전 내에서만 고유 | `my-app-{계정ID}-{리전}-an` | opt-in, 이름 충돌 걱정 없음 |

> [!NOTE]
> **Account Regional Namespace (2026년 3월 도입)**
>
> 기존에는 버킷 이름이 전 세계 모든 AWS 계정에서 고유해야 했습니다.  
> 2026년 3월부터 **Account Regional Namespace** 옵션이 추가되어, 버킷 이름을 계정+리전 범위로 한정할 수 있습니다.  
> 이 방식을 선택하면 버킷 이름에 `{계정ID}-{리전}-an` 접미사가 자동으로 붙어 다른 계정과 이름이 겹칠 걱정이 없습니다.
>
> 이 실습에서는 기본 방식(Global namespace)을 사용합니다.

**버킷 이름 공통 규칙:**

- 3~63자 사이
- 소문자, 숫자, 하이픈(`-`)만 사용 가능
- 문자 또는 숫자로 시작해야 함
- IP 주소 형식 불가 (예: `192.168.1.1`)
- `xn--`으로 시작 불가

> [!TIP]
> Global namespace를 사용할 때 버킷 이름을 고유하게 만드는 방법:
>
> | 방법 | 예시 | 장점 |
> | ---- | ---- | ---- |
> | 별칭 + 프로젝트명 | `mylab-starter-app` | 기억하기 쉬움 |
> | 닉네임 + 용도 | `hong-s3-images` | 간결하고 식별 용이 |
> | 프로젝트 + 날짜 | `starter-app-20260607` | 중복 가능성 낮음 |
> | 프로젝트 + 랜덤 | `starter-app-a3f7k2` | 가장 확실한 고유성 |
>
> 계정 ID(12자리)를 사용해도 되지만, 버킷 이름은 공개될 수 있으므로 닉네임이나 별칭을 활용하는 것이 더 안전합니다.

### 버킷 생성 단계

1. AWS Management Console에 로그인합니다.
2. 리전을 **Asia Pacific (Seoul) ap-northeast-2**로 설정합니다.
3. 상단 검색창에 `S3`를 입력하고 선택합니다.
4. [[Create bucket]]을 클릭합니다.
5. **General configuration** 섹션을 설정합니다. 각 필드를 아래와 같이 입력합니다:
   - **Bucket type**: General purpose (범용 버킷 — 대부분의 사용 사례에 적합)
   - **Bucket name**: `{닉네임}-starter-app` (예: `hong-starter-app`, `mylab-starter-app`)
     - 전 세계에서 고유한 이름이어야 합니다. 본인의 닉네임, 별칭, 또는 이니셜을 포함하면 중복을 피할 수 있습니다.
   - **AWS Region**: Asia Pacific (Seoul) ap-northeast-2
     - 이미 콘솔 상단에서 리전을 설정했다면 자동으로 선택되어 있습니다.

6. **Object Ownership** 섹션:
   - **ACLs disabled (recommended)** 선택 (기본값)

7. **Block Public Access settings for this bucket** 섹션:
   - ✅ **Block all public access** 체크 (기본값 유지)

> [!WARNING]
> Block Public Access는 반드시 활성화 상태를 유지하세요.  
> 이 설정을 해제하면 버킷의 모든 객체가 인터넷에 공개될 수 있습니다.  
> 정적 웹 호스팅이 필요한 경우에만 선택적으로 해제합니다.

> [!NOTE]
> **Block Public Access의 4가지 옵션:**
>
> | 옵션                                                                                                            | 설명                            |
> | --------------------------------------------------------------------------------------------------------------- | ------------------------------- |
> | Block public access to buckets and objects granted through new ACLs                                             | 새 ACL로 공개 설정 차단         |
> | Block public access to buckets and objects granted through any ACLs                                             | 모든 ACL 공개 설정 차단         |
> | Block public access to buckets and objects granted through new public bucket or access point policies           | 새 버킷 정책으로 공개 설정 차단 |
> | Block public and cross-account access to buckets and objects through any public bucket or access point policies | 모든 정책으로 공개 설정 차단    |
>
> "Block all public access"를 체크하면 4가지 모두 활성화됩니다.

8. **Bucket Versioning** 섹션:
   - **Disable** 선택 (태스크 3에서 활성화 예정)

9. **Tags** 섹션 (선택 사항이지만 실습 관리를 위해 권장):
   - [[Add new tag]]를 클릭합니다.
   - **Key**: `CreatedBy`, **Value**: `admin-user`
   - [[Add new tag]]를 클릭합니다.
   - **Key**: `Step`, **Value**: `step5`
   - [[Add new tag]]를 클릭합니다.
   - **Key**: `Session`, **Value**: `5-1`

> [!TIP]
> 태그를 추가하면 나중에 여러 실습에서 생성한 리소스를 구분하고 정리하기 쉬워집니다.  
> `CreatedBy`, `Step`, `Session` 태그는 Tag Editor에서 리소스를 일괄 검색/삭제할 때 활용됩니다.  
> 모든 실습에서 동일한 태그 체계를 적용합니다.

10. **Default encryption** 섹션:
    - **Encryption type**: Server-side encryption with Amazon S3 managed keys (SSE-S3)
    - **Bucket Key**: Enable (기본값)

11. [[Create bucket]]을 클릭합니다.

> [!OUTPUT]
> "Successfully created bucket" 메시지가 표시되면 버킷이 정상적으로 생성된 것입니다.
> 버킷 목록에서 방금 생성한 버킷을 확인할 수 있습니다.

> [!TROUBLESHOOTING]
> **버킷 생성 실패 시:**
>
> | 에러 메시지                  | 원인                                 | 해결 방법                                          |
> | ---------------------------- | ------------------------------------ | -------------------------------------------------- |
> | `Bucket name already exists` | 전 세계에서 이미 사용 중인 이름      | 이름에 계정 ID나 날짜를 추가하여 고유하게 만드세요 |
> | `Bucket name is not valid`   | 이름 규칙 위반 (대문자, 특수문자 등) | 소문자, 숫자, 하이픈만 사용. 3~63자                |
> | `Too many buckets`           | 계정당 버킷 수 제한 (기본 100개)     | 불필요한 버킷 삭제 또는 AWS에 한도 증가 요청       |

✅ **태스크 완료** — S3 버킷을 생성하고 기본 설정을 확인했습니다.

---

## 태스크 3: 핵심 설정 구성

생성한 버킷의 주요 설정을 하나씩 구성합니다.

### 3-1. 서버 측 암호화 (SSE-S3) 확인

S3는 기본적으로 모든 새 객체에 서버 측 암호화를 적용합니다.

12. S3 콘솔에서 생성한 버킷을 클릭합니다.
13. **Properties** 탭을 선택합니다.
14. **Default encryption** 섹션에서 **Server-side encryption with Amazon S3 managed keys (SSE-S3)**가 설정되어 있는지 확인합니다.

| 암호화 방식 | 키 관리         | 비용            | 적합한 경우            |
| ----------- | --------------- | --------------- | ---------------------- |
| SSE-S3      | AWS가 자동 관리 | 무료            | 대부분의 경우 (기본값) |
| SSE-KMS     | AWS KMS 키 사용 | KMS 요청당 과금 | 키 관리/감사 필요 시   |
| SSE-C       | 고객 제공 키    | 무료            | 자체 키 관리 시        |

### 3-2. CORS 설정

> [!CONCEPT] CORS(Cross-Origin Resource Sharing)란?
>
> CORS는 웹 브라우저의 보안 메커니즘입니다. 브라우저는 기본적으로 현재 페이지의 도메인과 다른 도메인(Origin)으로의 요청을 차단합니다.
>
> **Origin이란? ** 프로토콜 + 도메인 + 포트의 조합입니다.
> - `http://localhost:5173` (프론트엔드 개발 서버)
> - `https://hong-starter-app.s3.ap-northeast-2.amazonaws.com` (S3 버킷)
>
> 위 두 개는 서로 다른 Origin이므로, 브라우저가 프론트엔드에서 S3로 직접 요청을 보내면 차단합니다.
>
> **왜 차단하는가? ** 악의적인 웹사이트가 사용자 브라우저를 이용해 다른 서버의 데이터를 무단으로 가져가는 것을 방지하기 위한 보안 정책(Same-Origin Policy)입니다.
>
> **해결 방법: ** S3 버킷에 "이 도메인에서 오는 요청은 허용한다"고 CORS 설정을 추가하면, 브라우저가 해당 요청을 통과시킵니다.
>
> ```
> [브라우저] http://localhost:5173
>     │
>     │ PUT 요청 (파일 업로드)
>     ▼
> [S3] https://bucket.s3.amazonaws.com
>     │
>     ├── CORS 설정에 localhost:5173이 있음 → ✅ 허용
>     └── CORS 설정에 없는 도메인 → ❌ 차단 (CORS policy 에러)
> ```
>
> CORS 설정이 없으면 브라우저 콘솔에 `Access to XMLHttpRequest has been blocked by CORS policy` 에러가 발생합니다.

브라우저에서 S3에 직접 파일을 업로드하려면 CORS 설정이 필요합니다.

15. **Permissions** 탭을 선택합니다.
16. 하단의 **Cross-origin resource sharing (CORS)** 섹션에서 [[Edit]]을 클릭합니다.
17. 아래 JSON을 입력합니다:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST"],
    "AllowedOrigins": ["http://localhost:5173", "http://localhost:3000"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

> [!NOTE]
> **각 설정값의 의미:**
>
> | 항목 | 값 | 설명 |
> | ---- | -- | ---- |
> | `AllowedHeaders` | `["*"]` | 모든 요청 헤더를 허용 (Content-Type, Authorization 등) |
> | `AllowedMethods` | `["GET", "PUT", "POST"]` | 파일 다운로드(GET), 업로드(PUT), 폼 전송(POST) 허용 |
> | `AllowedOrigins` | `["http://localhost:5173", ...]` | 이 도메인에서 오는 요청만 허용 |
> | `ExposeHeaders` | `["ETag"]` | 브라우저에서 응답의 ETag 헤더를 읽을 수 있도록 허용 (멀티파트 업로드 시 필요) |
> | `MaxAgeSeconds` | `3600` | 브라우저가 CORS 사전 요청(preflight) 결과를 1시간 동안 캐시 |

18. [[Save changes]]를 클릭합니다.

> [!TIP]
> `AllowedOrigins`에는 실제 프론트엔드 도메인을 입력합니다.  
> 개발 중에는 `localhost`를, 배포 후에는 실제 도메인(예: `https://www.mydomain.com`)으로 변경합니다.  
> `"*"`는 모든 도메인을 허용하므로 프로덕션에서는 사용하지 마세요.

✅ **태스크 완료** — 암호화, CORS 설정을 구성했습니다.

---

## 태스크 4: 파일 업로드/다운로드

콘솔에서 직접 파일을 업로드하고 다운로드하여 S3의 기본 동작을 확인합니다.

### 테스트 파일 준비

메모장(Windows) 또는 텍스트 편집기(Mac)를 열어 아래 내용을 복사하여 `test.txt`로 저장합니다:

```text
안녕하세요!
S3 업로드 테스트 파일입니다.
이 파일은 Step 5-1 실습에서 사용됩니다.
```

### 파일 업로드

19. **Objects** 탭에서 [[Upload]]를 클릭합니다.
20. [[Add files]]를 클릭하고 방금 만든 `test.txt`를 선택합니다.
    - 또는 파일을 Upload 영역으로 **드래그 앤 드롭**하면 바로 추가됩니다.
21. [[Upload]]를 클릭합니다.

> [!OUTPUT]
> "Upload succeeded" 메시지가 표시됩니다. **Upload: status** 페이지에서 업로드 결과를 확인할 수 있습니다.

22. 우측 상단의 [[Close]]를 클릭하여 버킷 Objects 목록으로 돌아갑니다.

### 폴더 생성

23. [[Create folder]]를 클릭합니다.
24. Folder name에 `public`을 입력합니다.
25. [[Create folder]]를 클릭합니다.

> [!TIP]
> **폴더 생성 화면의 Server-side encryption 옵션:**
>
> 폴더 생성 시 아래쪽에 **Server-side encryption** 섹션이 표시됩니다.  
> 이 설정은 폴더 자체(0바이트 객체)에만 적용되며, 이후 폴더 안에 업로드하는 파일에는 영향을 주지 않습니다.
>
> - **Don't specify an encryption key** (기본값): 버킷의 기본 암호화 설정(SSE-S3)을 따릅니다. 이 옵션을 유지하세요.
> - **Specify an encryption key**: 특정 KMS 키로 암호화할 때 사용합니다 (이 실습에서는 불필요).
>
> S3에서 "폴더"는 실제로 `/`로 끝나는 0바이트 객체입니다. 폴더 안의 파일 암호화는 파일 업로드 시점의 버킷 기본 설정에 의해 결정됩니다.

### 파일 다운로드 및 URL 확인

26. 버킷 루트의 `test.txt`를 클릭합니다.
27. **Properties** 탭의 각 섹션을 확인합니다:

> [!NOTE]
> **Properties 탭 주요 섹션:**
>
> | 섹션 | 주요 정보 | 설명 |
> | ---- | --------- | ---- |
> | **Object overview** | Owner, AWS Region, Last modified, Size, Type, Key | 객체의 기본 메타데이터 |
> | | S3 URI (`s3://버킷/키`) | AWS CLI나 SDK에서 사용하는 경로 |
> | | Amazon Resource Name (ARN) | IAM 정책에서 리소스를 지정할 때 사용 |
> | | Entity tag (ETag) | 객체의 해시값 — 내용이 바뀌면 ETag도 변경됨 |
> | | **Object URL** | 브라우저에서 직접 접근할 수 있는 HTTP URL |
> | **Object management overview** | Bucket Versioning 상태 | 현재 비활성화(Disabled) — 태스크 6에서 활성화 예정 |
> | | Replication / Expiration rule | 복제 규칙, 수명 주기 규칙 적용 상태 |
> | **Storage class** | Standard | 현재 스토리지 클래스 (태스크 7에서 자세히 학습) |
> | **Server-side encryption settings** | SSE-S3 | 객체가 저장될 때 자동 암호화되는 방식 |
> | **Checksums** | CRC64NVME / Full object | 데이터 무결성 검증용 체크섬 |
> | **Tags** | (없음) | 객체 단위 태그 — 비용 추적이나 수명 주기 필터에 활용 |
> | **Metadata** | Content-Type: text/plain | HTTP 응답 시 브라우저에 전달되는 메타데이터 |
> | **Object Lock** | Disabled | WORM(한번쓰기-여러번읽기) 잠금 — 규정 준수용, 이 실습에서는 사용 안 함 |

28. **Object URL**을 복사합니다 (예: `https://{버킷이름}.s3.ap-northeast-2.amazonaws.com/test.txt`).
29. [[Download]]를 클릭하여 파일을 다운로드합니다.
30. 다운로드한 파일을 열어 내용이 정상적으로 표시되는지 확인합니다.
31. **Object URL**을 브라우저 주소창에 붙여넣기합니다.

> [!NOTE]
> `AccessDenied` 에러가 발생합니다.   
> Block Public Access가 활성화되어 있기 때문에 외부에서 직접 접근할 수 없습니다.  
> 다음 태스크에서 특정 경로만 공개하여 브라우저에서 파일을 직접 열 수 있도록 설정합니다.

32. [[Open]]을 클릭하면 임시 Presigned URL로 파일이 열립니다 (로그인된 사용자만 가능한 임시 접근).

> [!WARNING]
> **한글 파일이 깨져 보이는 경우:**
> [[Open]]으로 텍스트 파일을 열면 한글이 `�`로 깨져 보일 수 있습니다.  
> 이는 S3가 파일의 Content-Type을 `text/plain`으로 서빙할 때 인코딩(charset)을 지정하지 않아 브라우저가 UTF-8이 아닌 다른 인코딩으로 해석하기 때문입니다.  
> 이 문제는 파일 자체의 손상이 아니므로 걱정하지 마세요. [[Download]]로 다운로드한 파일을 메모장에서 열면 정상적으로 표시됩니다.  
> HTML 파일(`index.html`)은 `<meta charset="UTF-8">` 태그가 있어 이 문제가 발생하지 않습니다.

✅ **태스크 완료** — 파일 업로드/다운로드 기본 동작을 확인했습니다. Object URL로 직접 접근이 차단되는 것을 확인했습니다.

---

## 태스크 5: 퍼블릭 접근 설정 (버킷 정책)

S3에 업로드한 파일을 브라우저에서 URL만으로 직접 열 수 있도록 설정합니다.
보안을 위해 버킷 전체가 아닌 `public/` 경로만 공개합니다.

### HTML 테스트 파일 준비

메모장에서 아래 내용을 복사하여 `index.html`로 저장합니다:

```html
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <title>S3 퍼블릭 접근 테스트</title>
</head>
<body>
    <h1>🎉 S3에서 직접 열린 페이지입니다!</h1>
    <p>이 파일은 S3 버킷의 public/ 경로에 업로드되었습니다.</p>
    <p>브라우저에서 Object URL로 직접 접근하고 있습니다.</p>
</body>
</html>
```

### Block Public Access 부분 해제

33. S3 콘솔에서 버킷 → **Permissions** 탭을 선택합니다.
34. **Block public access (bucket settings)** 섹션에서 [[Edit]]을 클릭합니다.
35. ☐ **Block all public access** 체크를 해제합니다.

> [!WARNING]
> 전체 해제 대신, 아래 4개 중 필요한 것만 해제할 수도 있습니다.  
> 이 실습에서는 버킷 정책으로 특정 경로만 공개할 것이므로 전체 해제해도 안전합니다 (정책이 없는 경로는 여전히 비공개).

36. [[Save changes]]를 클릭합니다.
37. 확인 입력란에 `confirm`을 입력하고 [[Confirm]]을 클릭합니다.

### 버킷 정책 설정 (public/ 경로만 공개)

38. **Bucket policy** 섹션에서 [[Edit]]을 클릭합니다.
39. 아래 JSON을 입력합니다 (`{버킷이름}` 부분을 본인의 버킷 이름으로 변경):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadForPublicFolder",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::{버킷이름}/public/*"
    }
  ]
}
```

> [!NOTE]
> **정책 해석:**
>
> | 항목 | 값 | 의미 |
> | ---- | -- | ---- |
> | `Effect` | `Allow` | 허용 |
> | `Principal` | `*` | 누구나 (인터넷 전체) |
> | `Action` | `s3:GetObject` | 파일 읽기(다운로드)만 허용 |
> | `Resource` | `.../public/*` | `public/` 폴더 안의 파일에만 적용 |
>
> 즉, `public/` 경로 밖의 파일(예: `test.txt`)은 여전히 비공개입니다.

40. [[Save changes]]를 클릭합니다.

### HTML 파일 업로드 및 브라우저 접근 테스트

41. **Objects** 탭 → `public/` 폴더로 이동합니다.
42. 준비한 `index.html`을 업로드합니다 (드래그 앤 드롭 또는 Add files).
43. [[Upload]]를 클릭합니다.
44. 업로드된 `index.html`을 클릭하고 **Object URL**을 복사합니다.
45. 브라우저 주소창에 Object URL을 붙여넣기합니다.

> [!OUTPUT]
> 브라우저에 "🎉 S3에서 직접 열린 페이지입니다!" 라는 HTML 페이지가 표시됩니다.
> S3에 저장된 파일을 URL만으로 누구나 열 수 있는 상태입니다.

> [!TIP]
> 지금은 단순한 HTML 파일 하나를 열어본 것입니다.  
> 이 방식을 확장하면 CSS, JavaScript, 이미지를 포함한 **완전한 정적 웹사이트**를 S3에서 호스팅할 수 있습니다.  
> Vue.js나 React의 빌드 결과물(`dist/` 폴더)을 통째로 업로드하면 서버 없이 웹 앱을 배포할 수 있으며, CloudFront(CDN)를 연동하면 HTTPS와 전 세계 캐싱까지 적용됩니다.  
> 자세한 구성은 **Step 5-3: S3 + CloudFront 정적 웹 호스팅**에서 진행합니다.

### 비공개 파일 접근 확인

46. 버킷 루트의 `test.txt`의 Object URL을 브라우저에서 열어봅니다.

> [!OUTPUT]
> `AccessDenied` — `public/` 경로 밖의 파일은 여전히 접근이 차단됩니다.
> 버킷 정책이 `public/*`에만 적용되기 때문입니다.

✅ **태스크 완료** — 버킷 정책으로 특정 경로만 퍼블릭 공개하고, 브라우저에서 HTML 파일을 직접 열어보았습니다.

---

## 태스크 6: 버전 관리 & 업데이트 테스트

파일을 수정하여 같은 이름으로 다시 업로드하면 어떻게 되는지 확인합니다.  
먼저 버전 관리가 꺼진 상태에서 덮어쓰기의 위험성을 체험한 뒤, 버전 관리를 활성화하여 이전 버전이 보존되는 것을 비교합니다.

### 덮어쓰기 테스트 (버전 관리 OFF)

`index.html`을 열어 아래 내용으로 수정하고 저장합니다:

```html
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <title>S3 덮어쓰기 테스트</title>
</head>
<body>
    <h1>📝 수정된 페이지 (Version 2)</h1>
    <p>이 파일은 버전 관리가 꺼진 상태에서 덮어쓰기 되었습니다.</p>
</body>
</html>
```

47. `public/` 폴더에 수정된 `index.html`을 다시 업로드합니다.
48. [[Upload]]를 클릭합니다.
49. 브라우저에서 같은 Object URL을 새로고침합니다.

> [!OUTPUT]
> "📝 수정된 페이지 (Version 2)" 가 표시됩니다. 이전 내용("🎉 S3에서 직접 열린 페이지입니다!")은 사라졌습니다.

50. S3 콘솔에서 `public/index.html`을 클릭하고 **Versions** 탭을 확인합니다.

> [!NOTE]
> **"No versions"** 메시지와 함께 "This object has no versions to display because Bucket Versioning has not been enabled for this bucket."라고 표시됩니다.  
> 버전 관리가 꺼진 상태에서는 이전 파일이 완전히 사라지고 **복원이 불가능합니다.** 실수로 잘못된 파일을 덮어쓰면 원본을 되찾을 수 없습니다.  
>
> 상단에 **"Enable Bucket Versioning"** 버튼이 표시되지만, 여기서는 다음 단계에서 Properties 탭을 통해 활성화합니다.

### 버전 관리 활성화

51. S3 콘솔에서 버킷 이름을 클릭하여 버킷 루트로 돌아간 뒤, **Properties** 탭을 선택합니다.
52. **Bucket Versioning** 섹션에서 [[Edit]]을 클릭합니다.
53. **Enable**을 선택합니다.
54. [[Save changes]]를 클릭합니다.

### 덮어쓰기 테스트 (버전 관리 ON)

`index.html`을 열어 아래 내용으로 다시 수정하고 저장합니다:

```html
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <title>S3 버전 관리 테스트</title>
    <style>
        body { font-family: sans-serif; text-align: center; padding: 50px; }
        .version { color: #e74c3c; font-size: 2em; }
    </style>
</head>
<body>
    <h1>🎉 S3 버전 관리 테스트</h1>
    <p class="version">Version 3 — 버전 관리 활성화 후 업로드!</p>
    <p>이번에는 이전 버전이 보존됩니다.</p>
</body>
</html>
```

55. `public/` 폴더에 수정된 `index.html`을 다시 업로드합니다.
56. [[Upload]]를 클릭합니다.
57. 브라우저에서 같은 Object URL을 새로고침합니다.

> [!OUTPUT]
> "Version 3 — 버전 관리 활성화 후 업로드!" 페이지가 표시됩니다.

### 이전 버전 확인 및 비교

58. S3 콘솔에서 `public/index.html`을 클릭하고 **Versions** 탭을 선택합니다.
59. 이제 **두 개의 버전**이 표시됩니다 — 버전 관리 활성화 이후의 변경 이력이 보존됩니다.
60. 이전 버전(Version 2)을 클릭하여 다운로드합니다.
61. 다운로드한 파일을 열어 "📝 수정된 페이지 (Version 2)" 내용이 보존되어 있는지 확인합니다.

> [!CONCEPT] 버전 관리의 동작 방식
>
> - 같은 키로 파일을 업로드하면 새 버전이 생성되고, 이전 버전도 유지됩니다.
> - 객체를 삭제하면 "Delete Marker"가 추가될 뿐, 실제 데이터는 남아있습니다.
> - 이전 버전을 복원하려면 Delete Marker를 삭제하면 됩니다.
> - 💸 **주의**: 모든 버전이 저장 용량에 포함되므로 비용이 증가할 수 있습니다.
> - 버전 관리를 활성화하기 **이전**에 업로드된 객체는 버전 ID가 `null`입니다. 활성화 이후부터 버전 추적이 시작됩니다.

✅ **태스크 완료** — 버전 관리 OFF/ON의 차이를 직접 체험했습니다. OFF에서는 덮어쓰면 복원 불가, ON에서는 이전 버전이 보존됩니다.

---

## 태스크 7: 수명 주기 규칙 설정

수명 주기(Lifecycle) 규칙을 사용하면 객체를 자동으로 저렴한 스토리지 클래스로 이동하거나 삭제할 수 있습니다.

### S3 스토리지 클래스

| 클래스               | 용도                    | 비용 (서울, GB/월) | 최소 보관 기간 |
| -------------------- | ----------------------- | ------------------ | -------------- |
| Standard             | 자주 접근하는 데이터    | ~$0.025            | 없음           |
| Standard-IA          | 가끔 접근 (월 1회 이하) | ~$0.0138           | 30일           |
| One Zone-IA          | 가끔 접근 + 단일 AZ     | ~$0.011            | 30일           |
| Glacier Instant      | 분기 1회 접근           | ~$0.005            | 90일           |
| Glacier Flexible     | 연 1~2회 접근           | ~$0.0045           | 90일           |
| Glacier Deep Archive | 거의 접근 안 함         | ~$0.002            | 180일          |

※ 위 금액은 작성 시점 기준 참고 값이며, 실제 요금은 리전, 환율, AWS 정책 변경에 따라 상이할 수 있습니다.

### 수명 주기 규칙 생성

62. S3 콘솔에서 버킷 → **Management** 탭을 선택합니다.
63. **Lifecycle rules** 섹션에서 [[Create lifecycle rule]]을 클릭합니다.
64. 규칙을 설정합니다:
    - **Lifecycle rule name**: `move-to-ia-and-delete`
    - **Choose a rule scope**: Apply to all objects in the bucket
    - ✅ **I acknowledge that this rule will apply to all objects in the bucket** 체크

65. **Lifecycle rule actions** 섹션에서 다음을 체크합니다:
    - ✅ **Transition current versions of objects between storage classes**
    - ✅ **Expire current versions of objects**

> [!NOTE]
> 체크하면 아래에 추가 설정 섹션이 나타납니다. 또한 다음 경고 메시지가 표시됩니다:
>
> - ⚠️ **"Transitions are charged per request"**: Transition 동작마다 요청 비용이 발생합니다. 학습 수준에서는 무시해도 되는 금액입니다.
> - ℹ️ **"By default, objects less than 128KB will not transition across any storage class"**: 128KB 미만 파일은 전환 비용이 저장 절감보다 클 수 있어 기본적으로 전환되지 않습니다.
>
> ☐ **I acknowledge that this lifecycle rule will incur a transition cost per request** 체크박스가 표시되면 체크합니다.

66. **Transition current versions of objects between storage classes** 섹션:
    - **Choose storage class transitions**: `Standard-IA` 선택
    - **Days after object creation**: `30` 입력

> [!TIP]
> **Transition 옵션이란?**  
> 지정한 일수가 지나면 객체를 더 저렴한 스토리지 클래스로 자동 이동합니다.  
> 예를 들어 30일이 지난 파일은 접근 빈도가 낮다고 판단하여 Standard-IA(Infrequent Access)로 옮기면 저장 비용이 약 45% 절감됩니다.  
> 단, IA 클래스는 읽기 시 별도 요금이 부과되므로 자주 접근하지 않는 데이터에 적합합니다.

67. **Expire current versions of objects** 섹션:
    - **Days after object creation**: `90` 입력

> [!TIP]
> **Expire 옵션이란?**  
> 지정한 일수가 지나면 객체를 자동으로 삭제합니다.  
> 버전 관리가 켜져있으면 Delete Marker가 추가되고 현재 버전이 비현재(noncurrent)로 전환됩니다.  
> 버전 관리가 꺼져있으면 객체가 영구 삭제됩니다.

68. [[Create rule]]을 클릭합니다.

> [!OUTPUT]
> 규칙이 생성되면 Management 탭의 Lifecycle rules 목록에 표시됩니다.
> 실제 전환/삭제는 설정한 일수가 경과한 후 자동으로 실행됩니다.

### 실무에서 자주 사용하는 수명 주기 패턴

```
패턴 1: 로그 파일 관리
├── 0~30일: Standard (활발히 조회)
├── 30~90일: Standard-IA (가끔 조회)
└── 90일 이후: 삭제

패턴 2: 백업 데이터
├── 0~30일: Standard
├── 30~180일: Glacier Instant Retrieval
└── 180일~1년: Glacier Deep Archive
└── 1년 이후: 삭제

패턴 3: 사용자 업로드 이미지
├── 영구 보관 (삭제 안 함)
└── 이전 버전만 30일 후 삭제
```

> [!TIP]
> 수명 주기 규칙은 특정 prefix(경로)에만 적용할 수도 있습니다.  
> 예를 들어 `logs/` 경로의 파일만 90일 후 삭제하고, `images/` 경로는 영구 보관하는 식으로 구성할 수 있습니다.

✅ **태스크 완료** — 수명 주기 규칙을 설정하여 비용 최적화 방법을 학습했습니다.

---

## 태스크 8: S3 사용 시나리오 정리

S3는 다양한 용도로 활용됩니다. 실무에서 가장 많이 사용되는 시나리오를 정리합니다.

### 시나리오 1: 이미지/파일 업로드 저장소

```
[사용자] → [Spring Boot API] → [S3 버킷]
                                    ├── images/profile/user-123.jpg
                                    ├── images/posts/post-456.png
                                    └── documents/resume-789.pdf
```

- 사용자 프로필 이미지, 게시글 첨부 파일 저장
- Spring Boot에서 AWS SDK로 업로드 (Step 5-2에서 구현)
- Presigned URL로 클라이언트 직접 업로드 가능

### 시나리오 2: 정적 웹 호스팅

```
[사용자 브라우저] → [CloudFront CDN] → [S3 버킷]
                                          ├── index.html
                                          ├── assets/main.js
                                          └── assets/style.css
```

- Vue.js / React 빌드 결과물(`dist/`) 배포
- CloudFront와 연동하여 전 세계 CDN 적용
- HTTPS 지원 (ACM 인증서 연결)
- **Step 5-3에서 실습**

### 시나리오 3: 백업 및 아카이빙

```
[RDS 스냅샷]        → [S3 버킷 (Glacier)]
[EC2 로그]          → [S3 버킷 (Standard-IA)]
[애플리케이션 로그] → [S3 버킷 (Lifecycle 적용)]
```

- 데이터베이스 백업 저장
- 서버 로그 장기 보관
- Lifecycle 규칙으로 자동 비용 최적화

### 시나리오 4: 데이터 레이크

```
[다양한 소스] → [S3 버킷 (Data Lake)]
                    ├── raw/          ← 원본 데이터
                    ├── processed/    ← 가공된 데이터
                    └── analytics/    ← 분석 결과
                         ↓
                    [Amazon Athena] → SQL로 직접 쿼리
```

- 대용량 데이터를 S3에 저장하고 Athena로 분석
- Parquet, CSV, JSON 등 다양한 형식 지원
- 별도 데이터베이스 없이 S3 데이터를 SQL로 조회

### 시나리오 5: 로그 집중 관리 및 감사

```
[CloudTrail]     → [S3 버킷 (감사 로그)]
[ALB Access Log] → [S3 버킷 (액세스 로그)]
[VPC Flow Logs]  → [S3 버킷 (네트워크 로그)]
```

- AWS CloudTrail API 호출 기록을 S3에 자동 저장 (누가 언제 무엇을 했는지 감사 추적)
- ALB/NLB 액세스 로그, VPC Flow Logs 저장
- Object Lock(WORM)을 활성화하면 로그 파일을 수정/삭제 불가능하게 보호 (규정 준수)
- Lifecycle 규칙으로 오래된 로그를 Glacier로 이동하여 장기 보관 비용 최소화

### 시나리오 6: CI/CD 빌드 아티팩트

```
[GitHub Actions / CodePipeline] → [S3 버킷]
                                      ├── builds/v1.0.0/app.jar
                                      ├── builds/v1.1.0/app.jar
                                      └── builds/latest/app.jar
```

- 빌드 결과물(JAR, WAR, Docker 이미지 레이어 등) 저장
- CodePipeline/CodeBuild에서 아티팩트 소스로 사용
- 버전 관리 + Lifecycle으로 오래된 빌드 자동 정리

### 시나리오 7: 미디어 처리 파이프라인

```
[사용자 업로드] → [S3 버킷 (원본)]
                      │
                      └── S3 이벤트 트리거
                              │
                              ▼
                    [Lambda / MediaConvert]
                              │
                              ▼
                    [S3 버킷 (변환 완료)] → [CloudFront로 서빙]
```

- 동영상/이미지 업로드 시 S3 이벤트로 자동 변환 트리거
- 이미지 리사이즈(Lambda), 동영상 트랜스코딩(MediaConvert)
- 원본과 변환 결과물을 별도 prefix로 관리

### 시나리오별 권장 설정

| 시나리오           | 버전 관리 | 암호화  | 수명 주기 | Block Public Access           |
| ------------------ | --------- | ------- | --------- | ----------------------------- |
| 이미지 업로드      | 선택적    | SSE-S3  | 선택적    | ✅ 활성화                     |
| 정적 웹 호스팅     | 비활성화  | SSE-S3  | 불필요    | ❌ 해제 (또는 CloudFront OAC) |
| 백업               | ✅ 활성화 | SSE-KMS | ✅ 필수   | ✅ 활성화                     |
| 데이터 레이크      | ✅ 활성화 | SSE-S3  | ✅ 필수   | ✅ 활성화                     |
| 로그/감사          | ✅ 활성화 | SSE-S3  | ✅ 필수   | ✅ 활성화 + Object Lock       |
| CI/CD 아티팩트     | 선택적    | SSE-S3  | ✅ 권장   | ✅ 활성화                     |
| 미디어 처리        | 선택적    | SSE-S3  | 선택적    | ✅ 활성화                     |

✅ **태스크 완료** — S3의 다양한 사용 시나리오와 각 시나리오별 권장 설정을 이해했습니다.

---

## 마무리

다음을 성공적으로 수행했습니다:

- S3 버킷을 생성하고 암호화, CORS 등 핵심 설정을 구성했습니다.
- 파일을 업로드/다운로드하고 Object URL의 접근 제한을 확인했습니다.
- 버킷 정책으로 특정 경로만 퍼블릭 공개하고 브라우저에서 HTML 파일을 직접 열었습니다.
- 버전 관리 OFF/ON의 차이를 체험하고, 이전 버전이 보존되는 것을 확인했습니다.
- 수명 주기 규칙을 설정하여 자동 스토리지 클래스 전환과 만료를 구성했습니다.
- S3의 다양한 실무 시나리오(파일 저장, 정적 호스팅, 백업, 감사 로그 등)를 이해했습니다.

---

## 실습에서 다루지 않은 주요 기능

아래 기능들은 S3를 실무에서 운영할 때 자주 사용되지만, 별도의 심화 학습이 필요한 주제들입니다.

#### Object Lock (객체 잠금)

- WORM(Write Once Read Many) 모델로 객체를 수정/삭제 불가능하게 잠금
- **Governance mode**: 특정 IAM 권한이 있는 사용자만 잠금 해제 가능
- **Compliance mode**: Root 사용자를 포함해 누구도 보존 기간 동안 삭제 불가
- 금융, 의료, 법률 등 규정 준수(Compliance)가 요구되는 환경에서 필수
- 버킷 생성 시에만 활성화 가능 (이후 변경 불가)

#### S3 Replication (복제)

- **Same-Region Replication (SRR)**: 같은 리전 내 다른 버킷으로 자동 복제
- **Cross-Region Replication (CRR)**: 다른 리전으로 자동 복제 (재해 복구)
- 실시간 복제로 데이터 손실 방지 및 지역 분산

#### S3 Event Notifications (이벤트 알림)

- 객체 생성/삭제/복원 시 Lambda, SQS, SNS, EventBridge로 자동 트리거
- 이미지 업로드 → Lambda로 썸네일 자동 생성 등 이벤트 기반 아키텍처 구현
- Step 5-2에서 Spring Boot와 연동 시 활용

#### Presigned URL (사전 서명된 URL)

- 일정 시간만 유효한 임시 접근 URL 생성
- 로그인하지 않은 사용자에게 특정 파일의 다운로드/업로드 권한을 안전하게 부여
- Step 5-2에서 Spring Boot에서 생성하는 방법을 학습

#### S3 Transfer Acceleration

- CloudFront 엣지 로케이션을 경유하여 장거리 업로드 속도 향상
- 해외에서 서울 리전 S3로 대용량 파일을 업로드할 때 유용

#### S3 Inventory / S3 Storage Lens

- **Inventory**: 버킷 내 모든 객체의 목록을 CSV/Parquet로 주기적 생성 (대규모 관리)
- **Storage Lens**: 계정/조직 레벨에서 S3 사용량, 비용, 활동을 시각화하는 대시보드

> [!TIP]
> 이 실습에서 학습한 기본 기능(버킷 생성, 정책, 버전 관리, 수명 주기)은 위의 모든 고급 기능의 **기반**이 됩니다.  
> 다음 단계로 **Step 5-2**(Spring Boot S3 연동)에서 Presigned URL과 AWS SDK를 활용한 프로그래밍 방식의 S3 접근을 학습하고,  
> **Step 5-3**(S3 + CloudFront)에서 정적 웹 호스팅과 CDN을 구성합니다.

---

# 🗑️ 리소스 정리

> [!NOTE]
> **Step 5-2(Spring Boot S3 연동)를 이어서 진행할 예정이라면** 이 버킷을 삭제하지 마세요.  
> 아래 **옵션 A**(퍼블릭 접근만 복원)를 수행한 뒤 버킷을 유지하세요.  
> S3 비용은 매우 저렴하여(저장된 파일 몇 개 수준은 월 $0.01 미만) 크레딧에 거의 영향이 없습니다.  
>
> Step 5-2를 진행하지 않거나, 실습을 완전히 종료하려면 **옵션 B**(완전 삭제)를 수행하세요.

---

## 옵션 A: 버킷 유지 (퍼블릭 접근만 복원)

태스크 5에서 Block Public Access를 해제하고 버킷 정책을 추가했으므로, 보안을 위해 이것만 되돌립니다.

1. S3 콘솔 → 버킷 → **Permissions** 탭으로 이동합니다.
2. **Bucket policy** 섹션에서 [[Edit]]을 클릭합니다.
3. 정책 내용을 모두 삭제합니다 (빈 상태).
4. [[Save changes]]를 클릭합니다.
5. **Block public access (bucket settings)** 섹션에서 [[Edit]]을 클릭합니다.
6. ✅ **Block all public access**를 체크합니다.
7. [[Save changes]]를 클릭합니다.
8. 확인 입력란에 `confirm`을 입력하고 [[Confirm]]을 클릭합니다.
9. **Management** 탭 → **Lifecycle rules** 섹션에서 `move-to-ia-and-delete` 규칙을 선택합니다.
10. [[Delete]]를 클릭합니다.
11. 확인 팝업에서 [[Delete]]를 클릭합니다.

> [!NOTE]
> 이 작업 후 버킷은 안전한 상태(퍼블릭 차단 + Lifecycle 규칙 없음)로 유지됩니다.
> 버전 관리는 활성화된 상태로 남아있어도 괜찮습니다 (Step 5-2에서 활용).

✅ **옵션 A 완료**: 버킷이 안전한 상태로 유지됩니다. Step 5-2에서 이 버킷을 사용합니다.

---

## 옵션 B: 완전 삭제

버킷과 모든 객체를 삭제하여 리소스를 완전히 정리합니다.

### 단계 1: Tag Editor로 생성된 리소스 확인

삭제 전에 이 실습에서 생성한 리소스를 확인합니다.

12. AWS Management Console 상단 검색창에 `Resource Groups & Tag Editor`를 입력하고 선택합니다.
13. 왼쪽 메뉴에서 **Tag Editor**를 선택합니다.
14. 다음과 같이 설정합니다:
    - **Regions**: `ap-northeast-2`
    - **Resource types**: `All supported resource types`
    - **Tag key**: `Session`
    - **Tag value**: `5-1`
15. [[Search resources]] 버튼을 클릭합니다.
16. 이 실습에서 생성한 S3 버킷이 표시되는지 확인합니다.

> [!TIP]
> Tag Editor는 리소스를 찾는 용도로만 사용합니다. 실제 삭제는 다음 단계에서 수행합니다.

### 단계 2: 퍼블릭 접근 복원

17. S3 콘솔 → 버킷 → **Permissions** 탭으로 이동합니다.
18. **Bucket policy** 섹션에서 [[Edit]]을 클릭합니다.
19. 정책 내용을 모두 삭제합니다 (빈 상태).
20. [[Save changes]]를 클릭합니다.
21. **Block public access (bucket settings)** 섹션에서 [[Edit]]을 클릭합니다.
22. ✅ **Block all public access**를 체크합니다.
23. [[Save changes]]를 클릭합니다.
24. 확인 입력란에 `confirm`을 입력하고 [[Confirm]]을 클릭합니다.

### 단계 2: 수명 주기 규칙 삭제

25. **Management** 탭 → **Lifecycle rules** 섹션으로 이동합니다.
26. `move-to-ia-and-delete` 규칙을 선택합니다.
27. [[Delete]]를 클릭합니다.

### 단계 3: 버킷 비우기 (Empty bucket)

28. S3 콘솔의 버킷 목록으로 돌아갑니다.
29. 버킷 이름 왼쪽의 라디오 버튼을 선택합니다.
30. [[Empty]]를 클릭합니다.
31. 확인 입력란에 `permanently delete`를 입력합니다.
32. [[Empty]]를 클릭합니다.

> [!NOTE]
> **Empty bucket**은 모든 객체와 모든 버전(Delete Marker 포함)을 한번에 삭제합니다.
> 버전 관리가 활성화된 버킷에서도 별도의 Show versions 작업 없이 깨끗하게 비워집니다.

> [!TIP]
> **개별 객체를 선택하여 삭제하는 방법:**
>
> 전체가 아닌 특정 객체만 삭제하려면:
> 1. 버킷 → **Objects** 탭에서 삭제할 객체를 체크합니다.
> 2. [[Delete]]를 클릭합니다.
> 3. 확인 입력란에 `delete`를 입력하고 [[Delete objects]]를 클릭합니다.
>
> ⚠️ 버전 관리가 켜져있으면 "Deleting the specified objects adds delete markers to them" 안내가 표시됩니다.  
> 이 경우 실제 데이터는 삭제되지 않고 Delete Marker만 추가됩니다.  
> 완전 삭제하려면 **Show versions** 토글을 켜고 해당 버전을 직접 선택하여 삭제해야 합니다.

> [!TIP]
> **AWS CLI로 삭제 (CloudShell):**
> AWS 콘솔 왼쪽 하단의 **CloudShell** 아이콘(터미널 모양)을 클릭하면 별도 설치 없이 AWS CLI를 바로 사용할 수 있습니다.
>
> ```bash
> # 버전 관리가 꺼진 버킷: 객체 삭제 후 버킷 삭제
> aws s3 rb s3://{버킷이름} --force
> ```
>
> ⚠️ **버전 관리가 켜진 버킷**에서는 `aws s3 rb --force`가 `BucketNotEmpty` 에러로 실패합니다.
> 아래 스크립트로 모든 버전과 Delete Marker를 삭제할 수 있습니다:
>
> ```bash
> BUCKET="{버킷이름}"
>
> # 모든 객체 버전 삭제
> aws s3api list-object-versions --bucket $BUCKET \
>   --query "Versions[].{Key:Key,VersionId:VersionId}" --output json | \
>   jq -c '.[]? | {Key,VersionId}' | while read obj; do
>     KEY=$(echo $obj | jq -r '.Key')
>     VID=$(echo $obj | jq -r '.VersionId')
>     aws s3api delete-object --bucket $BUCKET --key "$KEY" --version-id "$VID"
> done
>
> # 모든 Delete Marker 삭제
> aws s3api list-object-versions --bucket $BUCKET \
>   --query "DeleteMarkers[].{Key:Key,VersionId:VersionId}" --output json | \
>   jq -c '.[]? | {Key,VersionId}' | while read obj; do
>     KEY=$(echo $obj | jq -r '.Key')
>     VID=$(echo $obj | jq -r '.VersionId')
>     aws s3api delete-object --bucket $BUCKET --key "$KEY" --version-id "$VID"
> done
>
> # 버킷 삭제
> aws s3 rb s3://$BUCKET
> ```
>
> 💡 실습 수준의 파일 몇 개라면 **콘솔의 Empty bucket**이 훨씬 간단합니다. 위 스크립트는 대량 객체 관리 시 참고용입니다.

### 단계 4: 버킷 삭제

33. S3 콘솔의 버킷 목록으로 돌아갑니다.
34. 삭제할 버킷의 라디오 버튼을 선택합니다.
35. [[Delete]]를 클릭합니다.
36. 버킷 이름을 입력하여 확인합니다.
37. [[Delete bucket]]을 클릭합니다.

### 단계 5: 삭제 확인

38. S3 콘솔의 버킷 목록에서 해당 버킷이 없는지 확인합니다.
39. **Tag Editor**에서 `Session: 5-1`로 다시 검색하여 관련 리소스가 남아있지 않은지 확인합니다.

✅ **옵션 B 완료**: 모든 리소스가 정리되었습니다.

> [!TIP]
> **CloudFormation이 생성한 S3 버킷 (`cf-templates-...`):**
>
> 이전 실습에서 CloudFormation을 사용한 경우, S3 버킷 목록에 `cf-templates-{랜덤문자열}-{리전}` 형태의 버킷이 남아있을 수 있습니다.  
> 이 버킷은 CloudFormation이 템플릿 파일을 저장하기 위해 자동 생성한 것입니다.
>
> 더 이상 CloudFormation을 사용하지 않을 예정이라면 동일한 방법(Empty → Delete)으로 삭제해도 됩니다.  
> 향후 CloudFormation을 다시 사용하면 자동으로 재생성되므로 삭제해도 문제없습니다.

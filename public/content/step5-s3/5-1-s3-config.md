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

이 실습에서는 Amazon S3의 핵심 개념을 이해하고, 버킷을 생성하여 주요 설정을 구성합니다. 파일 업로드/다운로드를 테스트하고, 버킷 정책과 수명 주기 규칙을 설정하여 실무에서 S3를 활용하는 방법을 학습합니다.

> [!NOTE]
> 이 실습은 독립적으로 진행할 수 있습니다. AWS 계정만 있으면 바로 시작할 수 있습니다.

---

## 태스크 1: S3 개념 이해

Amazon S3(Simple Storage Service)는 AWS의 오브젝트 스토리지 서비스입니다. 파일 시스템이나 블록 스토리지와는 근본적으로 다른 구조를 가집니다.

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
> - **버킷(Bucket)**: 객체를 담는 최상위 컨테이너. 전 세계에서 고유한 이름이 필요합니다.
> - **객체(Object)**: S3에 저장되는 개별 파일. 최대 5TB까지 저장 가능합니다.
> - **키(Key)**: 버킷 내에서 객체를 식별하는 고유 경로. 예: `images/profile/user-123.jpg`
>
> S3에는 실제 "폴더"가 없습니다. `images/profile/user-123.jpg`는 하나의 키(문자열)일 뿐이며, 콘솔에서 폴더처럼 보여주는 것은 UI의 편의 기능입니다.

### S3 주요 특징

- **내구성**: 99.999999999% (11 nines) — 데이터 손실 가능성이 극히 낮음
- **가용성**: 99.99% — 거의 항상 접근 가능
- **무제한 용량**: 저장할 수 있는 객체 수와 총 용량에 제한 없음
- **리전 기반**: 버킷은 특정 리전에 생성되며, 데이터는 해당 리전 내에 복제됨

✅ **태스크 완료** — S3의 핵심 개념(오브젝트 스토리지, 버킷, 객체, 키)을 이해했습니다.

---

## 태스크 2: S3 버킷 생성

### 버킷 이름 규칙

S3 버킷 이름은 전 세계에서 고유해야 합니다. 다음 규칙을 따릅니다:

- 3~63자 사이
- 소문자, 숫자, 하이픈(`-`)만 사용 가능
- 문자 또는 숫자로 시작해야 함
- IP 주소 형식 불가 (예: `192.168.1.1`)
- `xn--`으로 시작 불가

> [!TIP]
> 버킷 이름에 AWS 계정 ID나 프로젝트명을 포함하면 고유성을 확보하기 쉽습니다.
> 예: `my-app-123456789012`, `starter-images-2025`

### 버킷 생성 단계

1. AWS Management Console에 로그인합니다.
2. 리전을 **Asia Pacific (Seoul) ap-northeast-2**로 설정합니다.
3. 상단 검색창에 `S3`를 입력하고 선택합니다.
4. [[Create bucket]]을 클릭합니다.
5. **General configuration** 섹션을 설정합니다:
   - **Bucket type**: General purpose
   - **Bucket name**: `my-starter-app-{본인계정ID}` (예: `my-starter-app-123456789012`)
   - **AWS Region**: Asia Pacific (Seoul) ap-northeast-2

6. **Object Ownership** 섹션:
   - **ACLs disabled (recommended)** 선택 (기본값)

7. **Block Public Access settings for this bucket** 섹션:
   - ✅ **Block all public access** 체크 (기본값 유지)

> [!WARNING]
> Block Public Access는 반드시 활성화 상태를 유지하세요. 이 설정을 해제하면 버킷의 모든 객체가 인터넷에 공개될 수 있습니다. 정적 웹 호스팅이 필요한 경우에만 선택적으로 해제합니다.

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

9. **Default encryption** 섹션:
   - **Encryption type**: Server-side encryption with Amazon S3 managed keys (SSE-S3)
   - **Bucket Key**: Enable (기본값)

10. [[Create bucket]]을 클릭합니다.

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

### 3-1. 버전 관리 (Versioning) 활성화

버전 관리를 활성화하면 객체를 덮어쓰거나 삭제해도 이전 버전이 보존됩니다.

1. S3 콘솔에서 생성한 버킷을 클릭합니다.
2. **Properties** 탭을 선택합니다.
3. **Bucket Versioning** 섹션에서 [[Edit]]을 클릭합니다.
4. **Enable**을 선택합니다.
5. [[Save changes]]를 클릭합니다.

> [!CONCEPT] 버전 관리의 동작 방식
>
> - 같은 키로 파일을 업로드하면 새 버전이 생성되고, 이전 버전도 유지됩니다.
> - 객체를 삭제하면 "Delete Marker"가 추가될 뿐, 실제 데이터는 남아있습니다.
> - 이전 버전을 복원하려면 Delete Marker를 삭제하면 됩니다.
> - **주의**: 모든 버전이 저장 용량에 포함되므로 비용이 증가할 수 있습니다.

### 3-2. 서버 측 암호화 (SSE-S3) 확인

S3는 기본적으로 모든 새 객체에 서버 측 암호화를 적용합니다.

1. **Properties** 탭에서 **Default encryption** 섹션을 확인합니다.
2. **Server-side encryption with Amazon S3 managed keys (SSE-S3)**가 설정되어 있는지 확인합니다.

| 암호화 방식 | 키 관리         | 비용            | 적합한 경우            |
| ----------- | --------------- | --------------- | ---------------------- |
| SSE-S3      | AWS가 자동 관리 | 무료            | 대부분의 경우 (기본값) |
| SSE-KMS     | AWS KMS 키 사용 | KMS 요청당 과금 | 키 관리/감사 필요 시   |
| SSE-C       | 고객 제공 키    | 무료            | 자체 키 관리 시        |

### 3-3. CORS 설정

브라우저에서 S3에 직접 파일을 업로드하려면 CORS(Cross-Origin Resource Sharing) 설정이 필요합니다.

1. **Permissions** 탭을 선택합니다.
2. **Cross-origin resource sharing (CORS)** 섹션에서 [[Edit]]을 클릭합니다.
3. 아래 JSON을 입력합니다:

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

4. [[Save changes]]를 클릭합니다.

> [!TIP]
> `AllowedOrigins`에는 실제 프론트엔드 도메인을 입력합니다. 개발 중에는 `localhost`를, 배포 후에는 실제 도메인(예: `https://www.mydomain.com`)으로 변경합니다. `"*"`는 모든 도메인을 허용하므로 프로덕션에서는 사용하지 마세요.

✅ **태스크 완료** — 버전 관리, 암호화, CORS 설정을 구성했습니다.

---

## 태스크 4: 파일 업로드/다운로드 테스트

콘솔에서 직접 파일을 업로드하고 다운로드하여 S3의 기본 동작을 확인합니다.

### 파일 업로드

1. S3 콘솔에서 생성한 버킷을 클릭합니다.
2. **Objects** 탭에서 [[Upload]]를 클릭합니다.
3. [[Add files]]를 클릭하고 테스트용 이미지 파일(예: `test-image.png`)을 선택합니다.
4. **Destination** 섹션에서 경로를 확인합니다:
   - 기본값은 버킷 루트에 업로드됩니다.
   - 폴더를 지정하려면 "Destination" 입력란에 `images/` 등을 입력합니다.
5. **Properties** 섹션은 기본값을 유지합니다:
   - Storage class: Standard
   - Encryption: 버킷 기본 설정 사용
6. [[Upload]]를 클릭합니다.

> [!OUTPUT]
> "Upload succeeded" 메시지가 표시됩니다. 업로드된 파일이 Objects 목록에 나타납니다.

### 폴더 생성 및 구조화

1. [[Create folder]]를 클릭합니다.
2. Folder name에 `images`를 입력합니다.
3. [[Create folder]]를 클릭합니다.
4. `images/` 폴더로 이동하여 다시 [[Upload]]로 파일을 업로드합니다.

### 파일 다운로드 및 URL 확인

1. 업로드한 파일을 클릭합니다.
2. **Object overview** 섹션에서 다음 정보를 확인합니다:
   - **Object URL**: `https://my-starter-app-123456789012.s3.ap-northeast-2.amazonaws.com/test-image.png`
   - **ARN**: `arn:aws:s3:::my-starter-app-123456789012/test-image.png`
   - **Size**, **Last modified**, **Storage class**
3. [[Download]]를 클릭하여 파일을 다운로드합니다.
4. [[Open]]을 클릭하면 Presigned URL로 파일이 브라우저에서 열립니다.

> [!NOTE]
> Object URL로 직접 접근하면 `AccessDenied` 에러가 발생합니다. Block Public Access가 활성화되어 있기 때문입니다. [[Open]] 버튼은 임시 Presigned URL을 생성하여 접근합니다.

### 버전 관리 테스트

1. 같은 이름의 파일(내용이 다른)을 다시 업로드합니다.
2. 파일을 클릭하고 **Versions** 탭을 선택합니다.
3. 두 개의 버전이 표시되는 것을 확인합니다.
4. 이전 버전을 클릭하면 해당 버전의 파일을 다운로드할 수 있습니다.

✅ **태스크 완료** — 파일 업로드, 다운로드, 버전 관리 동작을 확인했습니다.

---

## 태스크 5: 버킷 정책 vs ACL 비교

S3의 접근 제어는 크게 **버킷 정책**과 **ACL** 두 가지 방식이 있습니다.

### 비교표

| 항목        | 버킷 정책 (Bucket Policy)          | ACL (Access Control List)     |
| ----------- | ---------------------------------- | ----------------------------- |
| 형식        | JSON 정책 문서                     | 미리 정의된 권한 (Canned ACL) |
| 적용 범위   | 버킷 전체 또는 특정 경로(prefix)   | 개별 객체 또는 버킷           |
| 세밀한 제어 | IP, 시간, 조건 등 다양한 조건 가능 | 제한적                        |
| 권장 여부   | ✅ AWS 권장                        | ❌ 레거시 (사용 비권장)       |
| 크로스 계정 | 지원                               | 지원 (제한적)                 |

> [!CONCEPT] AWS의 권장 사항
> AWS는 2023년 4월부터 새로 생성되는 버킷에 대해 ACL을 기본적으로 비활성화합니다. **버킷 정책 + IAM 정책** 조합으로 접근을 제어하는 것이 모범 사례입니다.

### 버킷 정책 예시 1: 특정 IP에서만 접근 허용

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowSpecificIP",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::my-starter-app-123456789012/public/*",
      "Condition": {
        "IpAddress": {
          "aws:SourceIp": "203.0.113.0/24"
        }
      }
    }
  ]
}
```

### 버킷 정책 예시 2: CloudFront에서만 접근 허용

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudFrontAccess",
      "Effect": "Allow",
      "Principal": {
        "Service": "cloudfront.amazonaws.com"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::my-starter-app-123456789012/*",
      "Condition": {
        "StringEquals": {
          "AWS:SourceArn": "arn:aws:cloudfront::123456789012:distribution/EXXXXXXXXX"
        }
      }
    }
  ]
}
```

### 버킷 정책 적용 방법

1. S3 콘솔에서 버킷 → **Permissions** 탭을 선택합니다.
2. **Bucket policy** 섹션에서 [[Edit]]을 클릭합니다.
3. JSON 정책을 입력합니다.
4. [[Save changes]]를 클릭합니다.

> [!WARNING]
> 버킷 정책에서 `"Principal": "*"`와 `"Effect": "Allow"`를 사용할 때는 반드시 `Condition`을 추가하세요. 조건 없이 사용하면 전 세계 누구나 접근할 수 있습니다.

✅ **태스크 완료** — 버킷 정책과 ACL의 차이를 이해하고, JSON 정책 작성법을 학습했습니다.

---

## 태스크 6: 수명 주기 규칙 설정

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

### 수명 주기 규칙 생성

1. S3 콘솔에서 버킷 → **Management** 탭을 선택합니다.
2. **Lifecycle rules** 섹션에서 [[Create lifecycle rule]]을 클릭합니다.
3. 규칙을 설정합니다:
   - **Lifecycle rule name**: `move-to-ia-and-delete`
   - **Choose a rule scope**: Apply to all objects in the bucket
   - ✅ **I acknowledge that this rule will apply to all objects in the bucket** 체크

4. **Lifecycle rule actions** 섹션에서 선택합니다:
   - ✅ Move current versions of objects between storage classes
   - ✅ Expire current versions of objects

5. **Transition current versions of objects between storage classes**:
   - Storage class: **Standard-IA**
   - Days after object creation: `30`

6. **Expire current versions of objects**:
   - Days after object creation: `90`

7. [[Create rule]]을 클릭합니다.

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
> 수명 주기 규칙은 특정 prefix(경로)에만 적용할 수도 있습니다. 예를 들어 `logs/` 경로의 파일만 90일 후 삭제하고, `images/` 경로는 영구 보관하는 식으로 구성할 수 있습니다.

✅ **태스크 완료** — 수명 주기 규칙을 설정하여 비용 최적화 방법을 학습했습니다.

---

## 태스크 7: S3 사용 시나리오 정리

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

### 시나리오 3: 백업 및 아카이빙

```
[RDS 스냅샷] → [S3 버킷 (Glacier)]
[EC2 로그]   → [S3 버킷 (Standard-IA)]
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

### 시나리오별 권장 설정

| 시나리오       | 버전 관리 | 암호화  | 수명 주기 | Block Public Access           |
| -------------- | --------- | ------- | --------- | ----------------------------- |
| 이미지 업로드  | 선택적    | SSE-S3  | 선택적    | ✅ 활성화                     |
| 정적 웹 호스팅 | 비활성화  | SSE-S3  | 불필요    | ❌ 해제 (또는 CloudFront OAC) |
| 백업           | ✅ 활성화 | SSE-KMS | ✅ 필수   | ✅ 활성화                     |
| 데이터 레이크  | ✅ 활성화 | SSE-S3  | ✅ 필수   | ✅ 활성화                     |

✅ **태스크 완료** — S3의 다양한 사용 시나리오와 각 시나리오별 권장 설정을 이해했습니다.

---

# 🗑️ 리소스 정리

> [!NOTE]
> S3 비용은 매우 저렴하여 학습 수준에서는 크레딧 소진이 거의 없습니다. 이후 Step 5-2에서 이 버킷을 사용하므로 유지하는 것을 권장합니다.

---

### 단계 1: 수명 주기 규칙 삭제 (버킷 유지 시)

버킷은 유지하되 수명 주기 규칙만 삭제하려면:

1. S3 콘솔 → 버킷 클릭 → **Management** 탭 → **Lifecycle rules**
2. `move-to-ia-and-delete` 규칙을 선택합니다.
3. [[Delete]]를 클릭합니다.

---

### 단계 2: 버킷 내 객체 삭제

버킷을 완전히 삭제하려면 먼저 모든 객체를 삭제해야 합니다.

1. S3 콘솔에서 버킷을 클릭합니다.
2. **Objects** 탭에서 모든 객체를 선택합니다 (체크박스).
3. [[Delete]]를 클릭합니다.
4. 확인 입력란에 `permanently delete`를 입력합니다.
5. [[Delete objects]]를 클릭합니다.

> [!WARNING]
> 버전 관리가 활성화된 경우, **Show versions** 토글을 켜고 모든 버전을 선택하여 삭제해야 합니다. 현재 버전만 삭제하면 Delete Marker만 추가되고 실제 데이터는 남아있어 버킷 삭제가 불가능합니다.

> [!TIP]
> 객체가 많은 경우 AWS CLI를 사용하면 빠르게 삭제할 수 있습니다:
>
> ```bash
> # 모든 객체 삭제 (버전 포함)
> aws s3 rb s3://my-starter-app-123456789012 --force
> ```
>
> `--force` 옵션은 버킷 내 모든 객체를 삭제한 후 버킷도 삭제합니다.

---

### 단계 3: 버킷 삭제

1. S3 콘솔의 버킷 목록으로 돌아갑니다.
2. 삭제할 버킷의 라디오 버튼을 선택합니다.
3. [[Delete]]를 클릭합니다.
4. 버킷 이름을 입력하여 확인합니다.
5. [[Delete bucket]]을 클릭합니다.

---

### 단계 4: 삭제 확인

1. S3 콘솔의 버킷 목록에서 해당 버킷이 없는지 확인합니다.

✅ **실습 종료**: 모든 리소스가 정리되었습니다.

---
title: 'AWS SSM Parameter Store로 DB 비밀번호 관리'
week: 6
session: 1
awsServices:
  - AWS Systems Manager Parameter Store
learningObjectives:
  - SSM Parameter Store의 String/SecureString 타입 차이를 이해할 수 있습니다.
  - AWS 콘솔과 CLI로 파라미터를 생성할 수 있습니다.
  - Spring 프로젝트(Boot/MVC)에서 Parameter Store 값을 조회하여 사용할 수 있습니다.
  - Amazon EC2 IAM Role을 설정하여 Parameter Store에 접근할 수 있습니다.
prerequisites:
  - AWS 계정 생성 완료
estimatedCost: 무료 (Standard 파라미터 10,000개까지 항상 무료)
---

이 실습에서는 데이터베이스 비밀번호, API 키 등 민감한 설정값을 AWS Systems Manager Parameter Store에 안전하게 저장하고, Spring 애플리케이션(Boot 또는 MVC)에서 조회하여 사용하는 방법을 학습합니다.

> [!NOTE]
> 이 실습은 독립적으로 진행할 수 있습니다. AWS 계정만 있으면 바로 시작할 수 있습니다.  
> Amazon RDS나 Amazon EC2가 없어도 Parameter Store 자체의 사용법을 학습할 수 있습니다.

### 실습 흐름

```
[비밀값 관리 이해] → [Parameter Store 개념] → [콘솔에서 파라미터 생성] → [CLI로 조회] → [Spring 연동] → [EC2 IAM Role 설정] → [Secrets Manager 비교]
```

---

## 태스크 1: 왜 비밀값 관리가 필요한가

> [!CONCEPT] 비밀값 하드코딩의 위험성
> 코드에 비밀번호, API 키, 토큰 등을 직접 작성하면 심각한 보안 사고로 이어집니다.
>
> - GitHub에 AWS Access Key가 포함된 코드를 push → 수 분 내 해커가 탐지
> - 암호화폐 채굴 인스턴스가 대량 생성 → 수백만 원 청구
> - GitHub의 공개 리포지토리는 봇이 **실시간으로 스캔**하고 있습니다.
> - 비공개 리포지토리라도 팀원 변경, 포크 등으로 노출될 수 있습니다.
>
> ```java
> // ❌ 절대 이렇게 하지 마세요!
> spring.datasource.url=jdbc:mysql://my-db.amazonaws.com:3306/mydb
> spring.datasource.password=MySecretPassword123!
> ```

### 비밀값 관리 방법 비교

| 방법                       | 설명                     | 적합한 환경                   |
| -------------------------- | ------------------------ | ----------------------------- |
| 환경 변수                  | OS 레벨에서 설정         | 로컬 개발, 간단한 배포        |
| `.env` 파일 + `.gitignore` | 파일로 관리하되 Git 제외 | 로컬 개발                     |
| **SSM Parameter Store**    | AWS 관리형 비밀 저장소   | **AWS 환경 (권장)**           |
| Secrets Manager            | 자동 로테이션 지원       | DB 비밀번호 자동 교체 필요 시 |

> [!WARNING]
> GitHub에 비밀번호, Access Key, 토큰 등을 커밋하면 **즉시 유출**됩니다.  
> AWS는 이를 감지하면 경고 이메일을 보내지만, 이미 피해가 발생한 후일 수 있습니다.

✅ **태스크 완료** — 비밀값 하드코딩의 위험성과 안전한 관리 방법을 이해했습니다.

---

## 태스크 2: Parameter Store 개념 이해

> [!CONCEPT] SSM Parameter Store란?
> AWS Systems Manager Parameter Store는 설정 데이터와 비밀값을 중앙에서 관리하는 서비스입니다.
>
> - **무료**: Standard 파라미터 10,000개까지 항상 무료
> - **암호화**: SecureString 타입은 KMS로 자동 암호화
> - **계층 구조**: 경로 기반(`/app/env/key`)으로 파라미터를 체계적으로 관리
> - **IAM 통합**: IAM 정책으로 경로별 접근 제어 가능
> - **버전 관리**: 파라미터 변경 이력을 자동으로 추적

### 파라미터 타입

| 타입             | 설명           | 암호화 | 비용            | 사용 예시                 |
| ---------------- | -------------- | ------ | --------------- | ------------------------- |
| **String**       | 일반 텍스트    | ❌     | 무료            | DB URL, 버킷명, 환경 설정 |
| **StringList**   | 쉼표 구분 목록 | ❌     | 무료            | 허용 IP 목록, 기능 플래그 |
| **SecureString** | KMS로 암호화   | ✅     | 무료 (Standard) | 비밀번호, API 키, 토큰    |

> [!CONCEPT] Standard vs Advanced 파라미터
>
> - **Standard** (무료): 값 최대 4KB, 계정당 10,000개, 파라미터 정책 미지원
> - **Advanced** (유료): 값 최대 8KB, 제한 없음, 만료 정책 지원, 월 $0.05/파라미터
>
> 대부분의 경우 Standard로 충분합니다. 이 실습에서는 Standard만 사용합니다.

> [!TIP]
> **Parameter Store 비용 정리:**
>
> | 항목 | Standard | Advanced |
> | ---- | -------- | -------- |
> | 파라미터 저장 | 무료 | 월 $0.05/파라미터 |
> | API 상호작용 (기본 처리량) | 무료 | 10,000건당 $0.05 |
> | API 상호작용 (Higher throughput) | 10,000건당 $0.05 | 10,000건당 $0.05 |
>
> - Standard 파라미터는 **Free Tier / Free Plan과 무관하게 항상 무료**입니다 (Always Free 카테고리).
> - 계정 만료 후에도, 12개월 무료 기간 종료 후에도 계속 무료입니다.
> - Higher throughput(초당 1,000건 이상)을 활성화하면 Standard도 API 비용이 발생하지만, 학습 환경에서는 해당 없습니다.

### 계층 구조 (Hierarchy)

Parameter Store는 경로 기반의 계층 구조를 지원합니다:

```
/myapp/
├── prod/
│   ├── db/
│   │   ├── driver       → net.sf.log4jdbc.sql.jdbcapi.DriverSpy
│   │   ├── url          → jdbc:log4jdbc:mysql://prod-db:3306/mydb
│   │   ├── username     → admin
│   │   └── password     → (SecureString) ProdP@ss123!
│   └── s3/
│       └── bucket       → myapp-prod-bucket
└── dev/
    ├── db/
    │   ├── driver       → net.sf.log4jdbc.sql.jdbcapi.DriverSpy
    │   ├── url          → jdbc:log4jdbc:mysql://dev-db:3306/mydb
    │   ├── username     → dev_user
    │   └── password     → (SecureString) DevP@ss123!
    └── s3/
        └── bucket       → myapp-dev-bucket
```

> [!TIP]
> 계층 구조를 사용하면 `GetParametersByPath` API로 특정 경로 하위의 모든 파라미터를 한 번에 조회할 수 있습니다.  
> 환경(prod/dev)별로 분리하면 IAM 정책으로 환경별 접근 제어도 가능합니다.
>
> **네이밍 규칙 권장**: `/{앱이름}/{환경}/{카테고리}/{키이름}`
> 예: `/starter/prod/db/password`, `/starter/dev/db/password`

✅ **태스크 완료** — Parameter Store의 타입과 계층 구조를 이해했습니다.

---

## 태스크 3: 콘솔에서 파라미터 생성

AWS Management Console에서 4개의 파라미터를 생성합니다.

### DB URL 파라미터 (String 타입)

1. AWS Management Console에 로그인합니다.
2. 우측 상단에서 리전을 **Asia Pacific (Seoul) ap-northeast-2**로 설정합니다.

    <img src="/images/common/region-check.png" alt="리전 확인" class="guide-img-sm" />

> [!TIP]
> 일부 AWS 서비스(IAM, CloudFront, Route 53 등)는 **글로벌 서비스**이므로 리전 선택 드롭다운이 비활성화되거나 "Global"로 표시됩니다.  
> 이 실습에서 사용하는 서비스는 리전 기반이므로 반드시 올바른 리전이 선택되어 있는지 확인하세요.

3. 상단 검색창에 `Systems Manager`를 입력합니다.
4. 검색 결과에서 **Systems Manager** 서비스를 클릭합니다.
5. 왼쪽 메뉴에서 **Application Tools** 섹션의 **Parameter Store**를 클릭합니다.

> [!TIP]
> 왼쪽 메뉴가 접혀 있으면 좌측 상단의 햄버거 아이콘(≡)을 클릭하여 펼치세요.  
> Parameter Store는 **Application Tools** 섹션 아래에 있습니다.

6. Parameter Store 페이지가 열리면 **My parameters** / **Public parameters** / **Settings** 3개 탭이 표시됩니다.  
**My parameters** 탭이 선택된 상태를 확인합니다.
7. [[Create parameter]] 버튼을 클릭합니다.
8. **Name** 필드에 `/starter/prod/db/url`을 입력합니다.
9. **Description** 필드에 `Production DB JDBC URL`을 입력합니다.
10. **Tier** 섹션에서 `Standard`가 선택되어 있는지 확인합니다 (기본값).
11. **Type** 드롭다운에서 `String`을 선택합니다 (기본값).
12. **Data type** 드롭다운에서 `text`를 선택합니다 (기본값).
13. **Value** 필드에 `jdbc:log4jdbc:mysql://localhost:3306/starter_db`를 입력합니다.

> [!TIP]
> `starter_db` 부분은 본인 프로젝트의 데이터베이스 이름으로 변경해도 됩니다. (예: `scoula_db`, `myapp_db`)  
> Amazon RDS를 사용 중이라면 `localhost` 대신 RDS 엔드포인트를 입력하세요.  
> 예: `jdbc:log4jdbc:mysql://my-rds-mysql.xxxx.ap-northeast-2.rds.amazonaws.com:3306/scoula_db`  
> 나중에 CLI에서 `--overwrite` 옵션으로 언제든 업데이트할 수 있습니다.
>
> **주의**: URL은 드라이버와 쌍으로 맞춰야 합니다. `log4jdbc` 드라이버를 사용하면 URL이 `jdbc:log4jdbc:mysql://`로 시작해야 합니다.  
> 일반 드라이버(`com.mysql.cj.jdbc.Driver`)를 사용한다면 `jdbc:mysql://`로 시작합니다.

14. **Tags** 섹션에서 [[Add tag]]를 클릭하여 아래 태그를 추가합니다:
    - `CreatedBy` = `admin-user`
    - `Step` = `step6`
    - `Session` = `6-1`

15. [[Create parameter]] 버튼을 클릭합니다.

> [!OUTPUT]
> 화면 상단에 녹색 배너로 "Create parameter request succeeded" 메시지가 표시됩니다.  
> Parameter Store 목록에 `/starter/prod/db/url` 파라미터가 나타납니다.

### DB Password 파라미터 (SecureString 타입)

16. [[Create parameter]] 버튼을 다시 클릭합니다.
17. **Name** 필드에 `/starter/prod/db/password`를 입력합니다.
18. **Description** 필드에 `Production DB password`를 입력합니다.
19. **Tier** 섹션에서 `Standard`가 선택되어 있는지 확인합니다.
20. **Type** 드롭다운에서 `SecureString`을 선택합니다.

> [!NOTE]
> SecureString을 선택하면 **KMS key source**와 **KMS Key ID** 필드가 새로 나타납니다.  
> 이 필드들은 암호화에 사용할 KMS 키를 지정하는 것입니다.

21. **KMS key source**에서 `My current account`를 선택합니다 (기본값).
22. **KMS Key ID** 드롭다운에서 `alias/aws/ssm`을 선택합니다 (기본 KMS 키).

> [!CONCEPT] KMS (Key Management Service)와 SecureString
> SecureString 타입의 파라미터는 KMS 키로 암호화되어 저장됩니다.
>
> - `alias/aws/ssm`: AWS가 자동으로 생성·관리하는 기본 KMS 키 (무료)
> - 커스텀 KMS 키: 직접 생성한 키 (월 $1/키 + API 호출 비용)
>
> 학습 단계에서는 기본 키(`alias/aws/ssm`)를 사용하면 됩니다.  
> 복호화 시 `kms:Decrypt` 권한이 필요합니다 (태스크 6에서 설정).

23. **Value** 필드에 `MyPassword123!`을 입력합니다.

> [!TIP]
> Step 4-1에서 Amazon RDS 생성 시 설정한 마스터 비밀번호와 동일한 값을 사용합니다.  
> 본인이 다른 비밀번호를 설정했다면 그 값을 입력하세요.

> [!NOTE]
> SecureString으로 저장해도 IAM 권한이 있는 사용자는 콘솔의 [[Show]] 버튼이나 `--with-decryption` 옵션으로 평문을 확인할 수 있습니다.  
> SecureString의 핵심은 "아무도 못 보게 하는 것"이 아니라:
>
> - **Git에 비밀번호가 노출되지 않음** (코드에 하드코딩 불필요)
> - **IAM 정책으로 누가 볼 수 있는지 제어** (경로별 접근 제한 가능)
> - **CloudTrail로 누가 언제 조회했는지 감사 가능** (보안 감사 대응)
24. **Tags** 섹션에서 [[Add tag]]를 클릭하여 태그를 추가합니다:
    - `CreatedBy` = `admin-user`
    - `Step` = `step6`
    - `Session` = `6-1`

25. [[Create parameter]] 버튼을 클릭합니다.

> [!OUTPUT]
> "Create parameter request succeeded" 메시지가 표시됩니다.   
> 목록에서 `/starter/prod/db/password`의 Type이 `SecureString`으로 표시됩니다.

### DB Username 파라미터 (String 타입)

26. [[Create parameter]] 버튼을 클릭합니다.
27. **Name** 필드에 `/starter/prod/db/username`을 입력합니다.
28. **Description** 필드에 `Production DB username`을 입력합니다.
29. **Tier**: `Standard` (기본값 확인).
30. **Type** 드롭다운에서 `String`을 선택합니다 (기본값).
31. **Data type**: `text` (기본값 확인).
32. **Value** 필드에 `admin`을 입력합니다.
33. **Tags** 섹션에서 [[Add tag]]를 클릭하여 동일한 태그 3개를 추가합니다:
    - `CreatedBy` = `admin-user`
    - `Step` = `step6`
    - `Session` = `6-1`
34. [[Create parameter]] 버튼을 클릭합니다.

### DB Driver 파라미터 (String 타입)

35. [[Create parameter]] 버튼을 클릭합니다.
36. **Name** 필드에 `/starter/prod/db/driver`를 입력합니다.
37. **Description** 필드에 `Production DB JDBC driver class name`을 입력합니다.
38. **Tier**: `Standard` (기본값 확인).
39. **Type** 드롭다운에서 `String`을 선택합니다 (기본값).
40. **Data type**: `text` (기본값 확인).
41. **Value** 필드에 `net.sf.log4jdbc.sql.jdbcapi.DriverSpy`를 입력합니다.

> [!TIP]
> **드라이버와 URL은 반드시 쌍으로 맞춰야 합니다:**
>
> | 드라이버 | URL 형식 | 용도 |
> | -------- | -------- | ---- |
> | `net.sf.log4jdbc.sql.jdbcapi.DriverSpy` | `jdbc:log4jdbc:mysql://...` | SQL 로깅 포함 (개발/디버깅) |
> | `com.mysql.cj.jdbc.Driver` | `jdbc:mysql://...` | 순수 DB 연결 (운영 환경) |
>
> 드라이버를 변경하면 `/starter/prod/db/url` 파라미터의 값도 맞춰 변경하세요.  
> 6-0 이론의 "JDBC 드라이버 이해" 섹션에서 자세한 설명을 확인할 수 있습니다.

42. **Tags** 섹션에서 [[Add tag]]를 클릭하여 동일한 태그 3개를 추가합니다:
    - `CreatedBy` = `admin-user`
    - `Step` = `step6`
    - `Session` = `6-1`
43. [[Create parameter]] 버튼을 클릭합니다.

### S3 Bucket 파라미터 (String 타입)

44. [[Create parameter]] 버튼을 클릭합니다.
45. **Name** 필드에 `/starter/prod/s3/bucket`을 입력합니다.
46. **Description** 필드에 `Production S3 bucket name`을 입력합니다.
47. **Tier**: `Standard` (기본값 확인).
48. **Type** 드롭다운에서 `String`을 선택합니다 (기본값).
49. **Data type**: `text` (기본값 확인).
50. **Value** 필드에 본인의 Amazon S3 버킷 이름을 입력합니다. (예: `hong-starter-app`)

> [!TIP]
> Step 5에서 생성한 Amazon S3 버킷이 있다면 그 이름을 사용하세요. (예: `{닉네임}-starter-app`)  
> 아직 없다면 위 예시 값을 그대로 입력해도 됩니다. 나중에 `--overwrite`로 업데이트할 수 있습니다.

51. **Tags** 섹션에서 [[Add tag]]를 클릭하여 동일한 태그 3개를 추가합니다:
    - `CreatedBy` = `admin-user`
    - `Step` = `step6`
    - `Session` = `6-1`
52. [[Create parameter]] 버튼을 클릭합니다.

### 생성 결과 확인

53. Parameter Store 목록 페이지에서 5개의 파라미터가 모두 표시되는지 확인합니다.
54. `/starter/prod/db/password`를 클릭합니다.
55. **Value** 섹션에서 값이 `****`로 마스킹되어 있는지 확인합니다.
56. [[Show]] 버튼을 클릭하여 복호화된 값(`MyPassword123!`)이 표시되는지 확인합니다.
57. 브라우저의 뒤로 가기를 클릭하여 목록으로 돌아갑니다.

> [!OUTPUT]
> Parameter Store 목록에서 생성한 5개의 파라미터를 확인할 수 있습니다:
>
> | Name                        | Type         | Value 표시                                       |
> | --------------------------- | ------------ | ------------------------------------------------ |
> | `/starter/prod/db/driver`   | String       | `net.sf.log4jdbc.sql.jdbcapi.DriverSpy`          |
> | `/starter/prod/db/url`      | String       | `jdbc:log4jdbc:mysql://localhost:3306/starter_db` |
> | `/starter/prod/db/username` | String       | `admin`                                          |
> | `/starter/prod/db/password` | SecureString | `****` (Show 클릭 시 복호화)                     |
> | `/starter/prod/s3/bucket`   | String       | `hong-starter-app`                               |

> [!WARNING]
> Name 필드에 `/`로 시작하지 않으면 에러가 발생합니다.  
> Parameter Store의 이름은 반드시 `/`로 시작해야 합니다 (예: `/starter/prod/db/url`).

> [!TROUBLESHOOTING]
> | 증상 | 원인 | 해결 방법 |
> |------|------|-----------|
> | "Parameter name must begin with /" 에러 | Name에 `/` 누락 | Name 앞에 `/`를 추가 (예: `/starter/prod/db/url`) |
> | "Parameter already exists" 에러 | 동일 이름 파라미터 존재 | 기존 파라미터 삭제 후 재생성, 또는 CLI에서 `--overwrite` 사용 |
> | SecureString 선택 시 KMS 관련 에러 | KMS 키 권한 부족 | `alias/aws/ssm` 기본 키 사용 확인, IAM 사용자에 KMS 권한 확인 |
> | 파라미터가 목록에 안 보임 | 리전 불일치 | 우측 상단 리전이 `ap-northeast-2`인지 확인 |

✅ **태스크 완료** — 콘솔에서 String 4개와 SecureString 1개, 총 5개의 파라미터를 생성했습니다.

---

## 태스크 4: AWS CLI로 파라미터 생성 및 조회

CLI를 사용하면 파라미터를 스크립트로 자동화하거나, 빠르게 조회·수정할 수 있습니다.

### 주요 CLI 명령어 요약

| 명령어 | 용도 | 비고 |
| ------ | ---- | ---- |
| `put-parameter` | 파라미터 생성/수정 | 수정 시 `--overwrite` 필수 |
| `get-parameter` | 단일 파라미터 조회 | SecureString은 `--with-decryption` 추가 |
| `get-parameters-by-path` | 경로 기반 일괄 조회 | `--recursive`로 하위 경로 포함 |
| `delete-parameter` | 파라미터 삭제 | 삭제 후 복구 불가 |

> [!TIP]
> 이 태스크에서는 **AWS CloudShell** 사용을 권장합니다.  
> CloudShell은 AWS 콘솔 상단 우측의 터미널 아이콘(`>_`)을 클릭하면 열립니다.  
> 별도 설치 없이 AWS CLI가 미리 설정되어 있으며, 현재 로그인한 IAM 사용자 권한으로 즉시 사용할 수 있습니다.
>
> 로컬 터미널을 사용하려면 `aws configure`로 Access Key가 설정되어 있어야 합니다.

### 파라미터 생성 (put-parameter)

58. AWS CloudShell을 엽니다 (콘솔 상단 우측의 `>_` 아이콘 클릭).

> [!TIP]
> 콘솔 좌측 하단에도 CloudShell 바로가기가 있습니다.
59. 다음 명령어로 String 타입 파라미터를 생성합니다:

```bash
aws ssm put-parameter \
  --name "/starter/prod/app/port" \
  --type "String" \
  --value "8080" \
  --description "Application port" \
  --region ap-northeast-2
```

60. 다음 명령어로 SecureString 타입 파라미터를 생성합니다:

```bash
aws ssm put-parameter \
  --name "/starter/prod/jwt/secret" \
  --type "SecureString" \
  --value 'myJwtSecretKey2025Secure' \
  --description "JWT signing secret key" \
  --region ap-northeast-2
```

> [!TIP]
> `--value`에 `!`, `$`, `#` 등 특수문자가 포함된 경우 bash가 이를 해석하여 에러가 발생할 수 있습니다.  
> 특수문자가 포함된 값은 작은따옴표(`'`)로 감싸세요. (큰따옴표 사용 시 `!`가 history expansion으로 인식됨)

> [!OUTPUT]
> 각 명령어 실행 후 다음과 같은 응답이 표시됩니다:
>
> ```json
> {
>   "Version": 1,
>   "Tier": "Standard"
> }
> ```

61. 기존 파라미터의 값을 업데이트합니다 (`--overwrite` 필수):

```bash
aws ssm put-parameter \
  --name "/starter/prod/app/port" \
  --type "String" \
  --value "9090" \
  --overwrite \
  --region ap-northeast-2
```

> [!WARNING]
> `--overwrite` 플래그 없이 이미 존재하는 파라미터를 생성하면 `ParameterAlreadyExists` 에러가 발생합니다.  
> 값을 변경할 때는 반드시 `--overwrite`를 추가하세요.

### 단일 파라미터 조회 (get-parameter)

62. String 타입 파라미터를 조회합니다:

```bash
aws ssm get-parameter \
  --name "/starter/prod/db/url" \
  --region ap-northeast-2
```

> [!OUTPUT]
>
> ```json
> {
>   "Parameter": {
>     "Name": "/starter/prod/db/url",
>     "Type": "String",
>     "Value": "jdbc:mysql://your-rds-endpoint:3306/starter_db",
>     "Version": 1,
>     "LastModifiedDate": "2025-01-15T10:30:00+09:00",
>     "ARN": "arn:aws:ssm:ap-northeast-2:123456789012:parameter/starter/prod/db/url",
>     "DataType": "text"
>   }
> }
> ```

63. SecureString 타입 파라미터를 **복호화 없이** 조회합니다:

```bash
aws ssm get-parameter \
  --name "/starter/prod/db/password" \
  --region ap-northeast-2
```

> [!NOTE]
> `--with-decryption` 옵션 없이 SecureString을 조회하면 Value가 암호화된 문자열로 반환됩니다.
> 평문 값을 얻으려면 반드시 `--with-decryption`을 추가해야 합니다.

64. SecureString 타입 파라미터를 **복호화하여** 조회합니다:

```bash
aws ssm get-parameter \
  --name "/starter/prod/db/password" \
  --with-decryption \
  --region ap-northeast-2
```

> [!OUTPUT]
>
> ```json
> {
>   "Parameter": {
>     "Name": "/starter/prod/db/password",
>     "Type": "SecureString",
>     "Value": "MyPassword123!",
>     "Version": 1,
>     "LastModifiedDate": "2025-01-15T10:35:00+09:00",
>     "ARN": "arn:aws:ssm:ap-northeast-2:123456789012:parameter/starter/prod/db/password",
>     "DataType": "text"
>   }
> }
> ```

### 경로 기반 일괄 조회 (get-parameters-by-path)

65. `/starter/prod/db` 경로 하위의 모든 파라미터를 한 번에 조회합니다:

```bash
aws ssm get-parameters-by-path \
  --path "/starter/prod/db" \
  --with-decryption \
  --recursive \
  --region ap-northeast-2
```

> [!OUTPUT]
>
> ```json
> {
>   "Parameters": [
>     {
>       "Name": "/starter/prod/db/url",
>       "Type": "String",
>       "Value": "jdbc:mysql://your-rds-endpoint:3306/starter_db"
>     },
>     {
>       "Name": "/starter/prod/db/username",
>       "Type": "String",
>       "Value": "admin"
>     },
>     {
>       "Name": "/starter/prod/db/password",
>       "Type": "SecureString",
>       "Value": "MyPassword123!"
>     }
>   ]
> }
> ```

> [!TIP]
> `--recursive` 옵션을 추가하면 하위 경로의 파라미터까지 모두 조회합니다.  
> 생략하면 지정한 경로의 직접 하위 파라미터만 반환됩니다.
>
> 예: `--path "/starter/prod"` + `--recursive` → `/starter/prod/db/url`, `/starter/prod/s3/bucket` 등 모두 반환  
> 예: `--path "/starter/prod"` (recursive 없음) → 직접 하위만 반환 (하위 경로 제외)

### 파라미터 삭제 (delete-parameter)

66. 테스트용으로 생성한 파라미터를 삭제합니다:

```bash
aws ssm delete-parameter \
  --name "/starter/prod/app/port" \
  --region ap-northeast-2
```

```bash
aws ssm delete-parameter \
  --name "/starter/prod/jwt/secret" \
  --region ap-northeast-2
```

> [!OUTPUT]
> 삭제 성공 시 아무 출력 없이 명령이 완료됩니다 (exit code 0).  
> 존재하지 않는 파라미터를 삭제하면 `ParameterNotFound` 에러가 발생합니다.

> [!TROUBLESHOOTING]
> | 증상 | 원인 | 해결 방법 |
> |------|------|-----------|
> | `ParameterNotFound` 에러 | 파라미터 이름 오타 또는 리전 불일치 | `--name` 경로 확인, `--region ap-northeast-2` 추가 |
> | `AccessDeniedException` | IAM 사용자/역할에 SSM 권한 부족 | IAM에서 `ssm:GetParameter`, `ssm:PutParameter` 권한 확인 |
> | SecureString 값이 암호화된 채로 반환 | `--with-decryption` 누락 | 명령어에 `--with-decryption` 옵션 추가 |
> | `ParameterAlreadyExists` 에러 | 동일 이름 파라미터 존재 | `--overwrite` 플래그 추가하여 재실행 |
> | `An error occurred (ExpiredTokenException)` | 세션 토큰 만료 | `aws configure` 재실행 또는 CloudShell 새 탭 열기 |

✅ **태스크 완료** — AWS CLI로 파라미터를 생성, 조회, 업데이트, 삭제하는 방법을 학습했습니다.

---

## 태스크 5: Spring에서 Parameter Store 조회

Spring 애플리케이션에서 AWS SDK를 사용하여 Parameter Store 값을 조회하고, DataSource 설정에 활용합니다.

> [!CONCEPT] 이 태스크에서 하는 일
> - `build.gradle`에 AWS SDK `ssm` 의존성 추가
> - `ParameterStoreService` 클래스 작성 — 앱 시작 시 Parameter Store에서 설정값 로드
> - `DataSourceConfig` 클래스 작성 — 로드한 값으로 DB 연결 설정 (application.yml에 비밀번호 불필요)

**Spring Boot와 기존 MVC 프로젝트 모두** 동일한 AWS SDK 코드를 사용합니다. 의존성 추가 방법만 다릅니다.

### 5-A. 의존성 추가

> [!TIP]
> **Step 5(S3 연동)를 이미 진행했다면** BOM은 이미 추가되어 있습니다.  
> 이 경우 `implementation 'software.amazon.awssdk:ssm'` 한 줄만 추가하면 됩니다.
>
> ```groovy
> // Step 5에서 이미 추가한 부분
> implementation 'software.amazon.awssdk:s3:2.44.0'
>
> // ✅ 이번 실습에서 추가하는 부분
> implementation 'software.amazon.awssdk:ssm:2.44.0'
> ```

67. `build.gradle` 파일을 열고 다음 의존성을 추가합니다 (본인 프로젝트에 맞는 방법 선택):

**방법 A: Spring Boot 프로젝트**

```groovy
// build.gradle (Spring Boot — BOM 방식)
dependencyManagement {
    imports {
        mavenBom "software.amazon.awssdk:bom:2.44.0"
    }
}

dependencies {
    implementation 'software.amazon.awssdk:ssm'
    implementation 'org.springframework.boot:spring-boot-starter-web'
    implementation 'org.springframework.boot:spring-boot-starter-jdbc'  // HikariCP 포함
    implementation 'com.mysql:mysql-connector-j'                        // MySQL 드라이버
}
```

> [!TIP]
> 이미 `spring-boot-starter-data-jpa`를 사용 중이라면 `starter-jdbc`는 추가하지 않아도 됩니다 (jpa에 포함).  
> 기존 프로젝트에 DB 관련 starter가 있는지 확인하고, 없는 것만 추가하세요.

**방법 B: 기존 Spring MVC 프로젝트**

```groovy
// build.gradle (Spring MVC — 직접 버전 명시)
dependencies {
    // 기존 의존성들...

    // AWS SDK v2 - SSM (Parameter Store)
    implementation 'software.amazon.awssdk:ssm:2.44.0'

    // @PostConstruct 사용 시 필요 (Java 9+ 환경)
    implementation 'javax.annotation:javax.annotation-api:1.3.2'
}
```

> [!NOTE]
> Step 5에서 S3 의존성을 이미 추가한 경우, 같은 버전(`2.44.0`)으로 `ssm`만 한 줄 추가하면 됩니다.  
> `platform()` BOM을 사용했다면 버전 없이 `implementation 'software.amazon.awssdk:ssm'`만 추가하세요.

### 5-B. ParameterStoreService 클래스 (공통)

이 클래스는 Boot/레거시 **모두 동일**합니다. `@Profile("aws")`로 배포 환경에서만 활성화됩니다.

68. `src/main/java/com/example/demo/config/` 디렉토리에 `ParameterStoreService.java` 파일을 생성합니다.

> [!TIP]
> 패키지 경로는 본인 프로젝트에 맞게 변경하세요.  
> - Spring Boot: `com.example.demo.config` (또는 본인 패키지)
> - Spring MVC 레거시: `org.scoula.config` 등
>
> Step 5에서 `S3Config`를 생성한 위치와 동일한 `config` 패키지에 넣으면 됩니다.
69. 다음 코드를 작성합니다:

> [!NOTE]
> **import 차이:**
>
> - Spring Boot 3.x (Jakarta EE): `import jakarta.annotation.PostConstruct;`
> - Spring MVC 5.x / Boot 2.x (Java EE): `import javax.annotation.PostConstruct;`
>
> 본인 프로젝트의 Spring 버전에 맞게 import를 변경하세요.  
> 기존 MVC 프로젝트에서는 패키지도 `org.scoula.config`로 변경합니다.

```java
package com.example.demo.config;

import javax.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.ssm.SsmClient;
import software.amazon.awssdk.services.ssm.model.GetParameterRequest;
import software.amazon.awssdk.services.ssm.model.GetParametersByPathRequest;
import software.amazon.awssdk.services.ssm.model.GetParametersByPathResponse;
import software.amazon.awssdk.services.ssm.model.Parameter;

import java.util.HashMap;
import java.util.Map;

@Slf4j
@Component
@Profile("aws")  // "aws" 프로필일 때만 Bean 등록
public class ParameterStoreService {

    private final SsmClient ssmClient;
    private final Map<String, String> parameters = new HashMap<>();

    public ParameterStoreService() {
        this.ssmClient = SsmClient.builder()
                .region(Region.AP_NORTHEAST_2)
                .build();
    }

    /**
     * 애플리케이션 시작 시 Parameter Store에서 설정값을 로드합니다.
     */
    @PostConstruct
    public void loadParameters() {
        String path = "/starter/prod";
        log.info("Parameter Store에서 설정 로드 시작: {}", path);

        GetParametersByPathRequest request = GetParametersByPathRequest.builder()
                .path(path)
                .recursive(true)
                .withDecryption(true)
                .build();

        GetParametersByPathResponse response = ssmClient.getParametersByPath(request);

        for (Parameter param : response.parameters()) {
            parameters.put(param.name(), param.value());
            log.info("파라미터 로드: {} (type: {})", param.name(), param.type());
        }

        log.info("총 {}개 파라미터 로드 완료", parameters.size());
    }

    /**
     * 단일 파라미터를 조회합니다.
     */
    public String getParameter(String name) {
        // 캐시된 값이 있으면 반환
        if (parameters.containsKey(name)) {
            return parameters.get(name);
        }

        // 없으면 직접 조회
        GetParameterRequest request = GetParameterRequest.builder()
                .name(name)
                .withDecryption(true)
                .build();

        String value = ssmClient.getParameter(request).parameter().value();
        parameters.put(name, value);
        return value;
    }

    public String getDbUrl() {
        return getParameter("/starter/prod/db/url");
    }

    public String getDbDriver() {
        return getParameter("/starter/prod/db/driver");
    }

    public String getDbUsername() {
        return getParameter("/starter/prod/db/username");
    }

    public String getDbPassword() {
        return getParameter("/starter/prod/db/password");
    }

    public String getS3Bucket() {
        return getParameter("/starter/prod/s3/bucket");
    }

}

```

> [!CONCEPT] @PostConstruct와 파라미터 캐싱
>
> - `@PostConstruct`: Spring Bean이 생성된 직후 자동으로 실행되는 메서드를 지정합니다.  
>   애플리케이션 시작 시 Parameter Store에서 모든 설정값을 한 번에 로드합니다.  
> - **캐싱**: `Map<String, String>`에 로드한 값을 저장하여, 이후 조회 시 AWS API를 다시 호출하지 않습니다.  
>   API 호출 횟수를 줄이고 응답 속도를 높입니다.  
> - `withDecryption(true)`: SecureString 타입도 자동으로 복호화하여 평문으로 반환합니다.

### 5-C. DataSource 설정 — Spring Boot

70. `src/main/java/com/example/demo/config/` 디렉토리에 `DataSourceConfig.java` 파일을 생성합니다.
71. 다음 코드를 작성합니다:

> [!NOTE]
> **Boot에서는 충돌하지 않습니다.**  
> `application.properties`에 `spring.datasource.*`이 있어도, `@Profile("aws")`가 붙은 `DataSourceConfig`는 `aws` 프로필일 때만 활성화됩니다.  
> 로컬에서는 Boot 자동 설정이 그대로 동작합니다.
>
> 레거시 프로젝트는 **5-D 섹션**에서 별도 가이드합니다.

```java
package com.example.demo.config;

import com.zaxxer.hikari.HikariDataSource;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

import javax.sql.DataSource;

@Configuration
@Profile("aws")  // "aws" 프로필일 때만 활성화 (로컬에서는 기존 설정 사용)
@RequiredArgsConstructor
public class DataSourceConfig {

    private final ParameterStoreService parameterStoreService;

    @Bean
    public DataSource dataSource() {
        HikariDataSource dataSource = new HikariDataSource();
        dataSource.setDriverClassName(parameterStoreService.getDbDriver());   // Parameter Store에서 조회
        dataSource.setJdbcUrl(parameterStoreService.getDbUrl());              // Parameter Store에서 조회
        dataSource.setUsername(parameterStoreService.getDbUsername());         // Parameter Store에서 조회
        dataSource.setPassword(parameterStoreService.getDbPassword());        // Parameter Store에서 조회 (SecureString → 자동 복호화)
        return dataSource;
    }
}
```

> [!TIP]
> 이 방식을 사용하면 `application.yml`에 DB 비밀번호를 작성할 필요가 없습니다.  
> 코드를 Git에 push해도 비밀번호가 노출되지 않습니다.
>
> **기존 방식 (위험):**
>
> ```yaml
> # application.yml — 비밀번호가 코드에 노출됨!
> spring:
>   datasource:
>     password: MySecretPassword123!
> ```
>
> **Parameter Store 방식 (안전):**
>
> ```yaml
> # application.yml — 비밀번호 없음, Parameter Store에서 런타임에 조회
> spring:
>   datasource:
>     # password는 ParameterStoreService에서 주입
> ```

> [!WARNING]
> 로컬 개발 환경에서는 AWS 자격 증명이 설정되어 있어야 합니다.  
> `aws configure`로 Access Key를 설정하거나, AWS SSO를 사용하세요.  
> Amazon EC2에서는 IAM Role로 자동 인증됩니다 (태스크 6에서 설정).

✅ **Boot 설정 완료** — `@Profile("aws")`로 배포 시에만 Parameter Store를 사용합니다.

> [!TIP]
> **Spring Boot 로컬 DB 설정** — `application.properties`에 다음이 있으면 로컬에서 DB가 동작합니다:
>
> ```properties
> spring.datasource.url=jdbc:mysql://localhost:3306/starter_db
> spring.datasource.username=admin
> spring.datasource.password=MyPassword123!
> spring.datasource.driver-class-name=com.mysql.cj.jdbc.Driver
> ```
>
> `--spring.profiles.active=aws`로 실행하면 위 설정 대신 Parameter Store 값을 사용합니다.

---

### 5-D. DataSource 설정 — Spring MVC 레거시

레거시에서는 기존 `RootConfig.java`에 DataSource가 이미 있습니다.  
**DataSource를 외부 파일로 분리**하여 환경별로 관리합니다.

> [!CONCEPT] 왜 분리하는가?
> 현재 RootConfig에 DataSource + SqlSessionFactory + TransactionManager가 한 파일에 있습니다.  
> DataSource만 환경에 따라 달라지므로, 이 부분만 외부로 분리하면:
> - **단일 책임**: 환경별 DB 설정을 독립적으로 관리
> - **확장성**: staging, test 환경 추가 시 파일 하나만 추가
> - **기존 코드 최소 수정**: SqlSessionFactory, TransactionManager는 그대로
>
> 6-0 이론에서 학습한 `@ComponentScan` 자동 등록 원리를 활용합니다.

**① RootConfig.java 수정** (DataSource 제거 + 파라미터 주입)

72. 기존 `RootConfig.java`에서 DataSource 관련 코드를 제거하고, 파라미터 주입으로 변경합니다:

```java
@Configuration
@PropertySource({"classpath:/application.properties"})
@MapperScan(basePackages = {"org.scoula.board.mapper", "org.scoula.member.mapper"})
@ComponentScan(basePackages = {"org.scoula.config", "org.scoula.board.service", "org.scoula.member.service"})
@EnableTransactionManagement
public class RootConfig {

    // ❌ 제거: @Value("${jdbc.*}") 필드 4개
    // ❌ 제거: dataSource() 메서드

    @Autowired
    ApplicationContext applicationContext;

    @Bean
    public SqlSessionFactory sqlSessionFactory(DataSource dataSource) throws Exception {
        //                                     ↑ 파라미터로 주입받음 (외부 Config에서 생성된 Bean)
        SqlSessionFactoryBean factory = new SqlSessionFactoryBean();
        factory.setConfigLocation(applicationContext.getResource("classpath:/mybatis-config.xml"));
        factory.setDataSource(dataSource);
        return (SqlSessionFactory) factory.getObject();
    }

    @Bean
    public DataSourceTransactionManager transactionManager(DataSource dataSource) {
        return new DataSourceTransactionManager(dataSource);
    }
}
```

**② LocalDataSourceConfig.java 생성** (로컬용)

73. `config` 패키지에 `LocalDataSourceConfig.java`를 생성합니다:

```java
package org.scoula.config;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.context.annotation.PropertySource;

import javax.sql.DataSource;

@Configuration
@Profile("!aws")  // "aws"가 아닌 모든 환경 (로컬 기본)
@PropertySource({"classpath:/application.properties"})
public class LocalDataSourceConfig {

    @Value("${jdbc.driver}") String driver;
    @Value("${jdbc.url}") String url;
    @Value("${jdbc.username}") String username;
    @Value("${jdbc.password}") String password;

    @Bean
    public DataSource dataSource() {
        HikariConfig config = new HikariConfig();
        config.setDriverClassName(driver);
        config.setJdbcUrl(url);
        config.setUsername(username);
        config.setPassword(password);
        return new HikariDataSource(config);
    }
}
```

> [!TIP]
> `@Profile("!aws")`는 프로필을 지정하지 않아도 기본으로 활성화됩니다.  
> 로컬에서는 **아무 설정 없이 기존과 동일하게** 동작합니다.

**③ AwsDataSourceConfig.java 생성** (배포용)

74. 같은 `config` 패키지에 `AwsDataSourceConfig.java`를 생성합니다:

```java
package org.scoula.config;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

import javax.sql.DataSource;

@Configuration
@Profile("aws")  // EC2 배포 시에만 활성화
@RequiredArgsConstructor
public class AwsDataSourceConfig {

    private final ParameterStoreService parameterStoreService;

    @Bean
    public DataSource dataSource() {
        HikariConfig config = new HikariConfig();
        config.setDriverClassName(parameterStoreService.getDbDriver());
        config.setJdbcUrl(parameterStoreService.getDbUrl());
        config.setUsername(parameterStoreService.getDbUsername());
        config.setPassword(parameterStoreService.getDbPassword());
        return new HikariDataSource(config);
    }
}
```

> [!CONCEPT] 레거시에서의 전체 흐름
> ```
> 로컬 실행 (프로필 없음):
>   LocalDataSourceConfig (@Profile("!aws")) → DataSource Bean 생성
>   RootConfig.sqlSessionFactory(DataSource) → 주입받아서 사용
>
> EC2 배포 (-Dspring.profiles.active=aws):
>   ParameterStoreService (@Profile("aws")) → Parameter Store에서 값 로드
>   AwsDataSourceConfig (@Profile("aws")) → DataSource Bean 생성
>   RootConfig.sqlSessionFactory(DataSource) → 주입받아서 사용
> ```

---

### 5-E. 실행 방법 정리

| 환경 | 실행 방법 | DataSource 출처 |
| ---- | --------- | --------------- |
| 로컬 (Boot) | `./gradlew bootRun` | `application.properties` (자동 설정) |
| 로컬 (레거시) | Tomcat Run (기본) | `LocalDataSourceConfig` → `application.properties` |
| EC2 (Boot) | `java -jar app.jar --spring.profiles.active=aws` | `DataSourceConfig` → Parameter Store |
| EC2 (레거시) | `JAVA_OPTS="-Dspring.profiles.active=aws"` | `AwsDataSourceConfig` → Parameter Store |

> [!WARNING]
> `aws` 프로필로 실행하려면 해당 환경에서 AWS 자격 증명이 필요합니다:
> - **로컬에서 aws 프로필 테스트**: `aws configure`로 Access Key 설정 필요
> - **EC2**: IAM Role 연결 시 자동 인증 (태스크 6에서 설정)

---

### 5-F. 로컬에서 aws 프로필 테스트

EC2에 배포하기 전에, **로컬 환경에서** Parameter Store 연동이 제대로 동작하는지 확인합니다.

> [!NOTE]
> 이 테스트는 `aws configure`로 Access Key가 설정된 로컬 환경에서 진행합니다.  
> 태스크 3~4에서 Parameter Store에 파라미터를 생성할 때 CLI를 사용했다면 이미 설정되어 있습니다.

#### 방법 1: Spring 전체 기동 테스트

**Spring Boot:**

```bash
./gradlew bootRun --args='--spring.profiles.active=aws'
```

**Spring MVC 레거시 (IntelliJ):**

Run Configuration → VM options에 다음을 추가하고 Tomcat을 실행합니다:

```
-Dspring.profiles.active=aws
```

> [!WARNING]
> `aws` 프로필로 Tomcat을 실행하면 Parameter Store에서 가져온 값으로 DB 연결을 시도합니다.  
> 다음 조건이 맞지 않으면 **앱 기동이 실패**할 수 있습니다:
>
> | 확인 항목 | 에러 메시지 예시 | 해결 방법 |
> |-----------|-----------------|-----------|
> | `aws configure` 미설정 | `Unable to load credentials` | `aws configure`로 Access Key 설정 |
> | IAM 사용자에 SSM 권한 없음 | `AccessDeniedException: ssm:GetParametersByPath` | IAM에서 `AmazonSSMFullAccess` 정책 추가 |
> | 드라이버와 URL 불일치 | `DriverSpy claims to not accept jdbcUrl` | 드라이버가 `log4jdbc`면 URL이 `jdbc:log4jdbc:mysql://`이어야 함 |
> | DB 계정 정보 불일치 | `Access denied for user 'admin'@'localhost'` | Parameter Store의 username/password가 로컬 MySQL 계정과 일치하는지 확인 |
> | DB 또는 스키마 미존재 | `Unknown database 'starter_db'` | Parameter Store의 URL에 있는 DB명이 실제 존재하는지 확인 |
>
> **"파라미터 로드 완료" 로그가 찍힌 후에 에러가 나면** Parameter Store 연동 자체는 성공한 것입니다.  
> 이후 에러는 DB 접속 문제이므로 Parameter Store 값을 로컬 환경에 맞게 수정하세요.

> [!OUTPUT]
> 콘솔 로그에 다음과 같이 출력되면 Parameter Store 연동 **성공**입니다:
>
> ```
> Parameter Store에서 설정 로드 시작: /starter/prod
> 파라미터 로드: /starter/prod/db/driver (type: String)
> 파라미터 로드: /starter/prod/db/url (type: String)
> 파라미터 로드: /starter/prod/db/username (type: String)
> 파라미터 로드: /starter/prod/db/password (type: SecureString)
> 파라미터 로드: /starter/prod/s3/bucket (type: String)
> 총 5개 파라미터 로드 완료
> ```

> [!TIP]
> DB 연결까지 성공하려면 Parameter Store의 `/starter/prod/db/url` 값이 로컬에서 접근 가능한 DB를 가리켜야 합니다.  
> Parameter Store 값 조회 자체만 확인하고 싶다면, DB 연결 에러는 무시해도 됩니다.  
> 핵심은 위 4줄의 "파라미터 로드" 로그가 찍히는지 여부입니다.

#### 방법 2: SDK 호출만 단독 테스트 (Spring 없이)

Spring 전체를 띄우지 않고, **AWS SDK 연동만 빠르게 확인**하려면 간단한 main 메서드를 실행합니다.

**Spring Boot 프로젝트:**
- 파일 위치: `src/test/java/com/example/demo/SsmConnectionTest.java`

**Spring MVC 레거시 프로젝트:**
- 파일 위치: `src/test/java/org/scoula/SsmConnectionTest.java`

> [!TIP]
> `src/test/java`에 넣으면 빌드 결과물(WAR/JAR)에 포함되지 않으므로 배포에 영향을 주지 않습니다.  
> 테스트 확인 후 삭제해도 되고, 남겨둬도 무방합니다.

```java
package com.example.demo;  // Boot 기준. 레거시는 org.scoula로 변경

import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.ssm.SsmClient;
import software.amazon.awssdk.services.ssm.model.GetParametersByPathRequest;
import software.amazon.awssdk.services.ssm.model.GetParametersByPathResponse;

public class SsmConnectionTest {
    public static void main(String[] args) {
        SsmClient client = SsmClient.builder()
                .region(Region.AP_NORTHEAST_2)
                .build();

        GetParametersByPathResponse response = client.getParametersByPath(
                GetParametersByPathRequest.builder()
                        .path("/starter/prod")
                        .recursive(true)
                        .withDecryption(true)
                        .build()
        );

        response.parameters().forEach(p ->
                System.out.println(p.name() + " = " + p.value())
        );

        client.close();
        System.out.println("\n✅ SSM Parameter Store 연동 테스트 성공!");
    }
}
```

> [!TIP]
> **IntelliJ에서 실행 방법:**
>
> - 위 파일을 생성합니다.
> - `main` 메서드 왼쪽의 초록색 ▶ 아이콘을 클릭합니다.
> - **Run 'SsmConnectionTest.main()'** 을 선택합니다.
>
> 또는 클래스명 위에서 우클릭 → **Run 'SsmConnectionTest'** 을 선택해도 됩니다.

> [!OUTPUT]
> 실행 결과로 5개의 파라미터가 출력되면 **SDK + IAM 권한 + KMS 복호화** 모두 정상입니다:
>
> ```
> /starter/prod/db/driver = net.sf.log4jdbc.sql.jdbcapi.DriverSpy
> /starter/prod/db/url = jdbc:log4jdbc:mysql://localhost:3306/starter_db
> /starter/prod/db/username = admin
> /starter/prod/db/password = MyPassword123!
> /starter/prod/s3/bucket = hong-starter-app
>
> ✅ SSM Parameter Store 연동 테스트 성공!
> ```

> [!TROUBLESHOOTING]
> | 증상 | 원인 | 해결 방법 |
> |------|------|-----------|
> | `SdkClientException: Unable to load credentials` | AWS 자격 증명 미설정 | `aws configure`로 Access Key 설정, 또는 `~/.aws/credentials` 파일 확인 |
> | `SsmException: Access denied` | IAM 사용자에 SSM 권한 부족 | IAM 콘솔에서 사용자에게 `AmazonSSMReadOnlyAccess` 정책 연결 |
> | `Parameter does not exist` | 파라미터 미생성 또는 리전 불일치 | 태스크 3에서 파라미터를 생성했는지 확인, `Region.AP_NORTHEAST_2` 확인 |
> | KMS 복호화 에러 | KMS 권한 부족 | IAM 사용자에게 `kms:Decrypt` 권한 확인 (콘솔에서 Show 버튼이 동작했다면 권한 있음) |

✅ **태스크 완료** — Spring에서 Parameter Store 값을 조회하여 환경별 DataSource를 설정하고, 로컬에서 동작을 검증했습니다.

---

## 태스크 6: Amazon EC2 IAM Role 설정

Amazon EC2 인스턴스에서 Parameter Store에 접근하려면 적절한 IAM 권한이 필요합니다.  
IAM 정책을 생성하고, Role에 연결한 뒤, Amazon EC2에 Role을 부여합니다.

> [!NOTE]
> **이 태스크는 EC2 배포 준비 단계입니다.**  
> Amazon EC2 인스턴스가 아직 없거나, 배포를 나중에 진행할 예정이라면 이 태스크는 **건너뛰고 나중에 돌아와도** 됩니다.  
> 태스크 5까지 완료했다면 Parameter Store 연동은 이미 로컬에서 검증된 상태입니다.

> [!CONCEPT] Amazon EC2에서 AWS 서비스 접근 방식
>
> Amazon EC2에서 AWS 서비스(AWS Systems Manager, Amazon S3, Amazon RDS 등)에 접근하는 방법은 두 가지입니다:
>
> - **Access Key 직접 설정** (❌ 비권장): Amazon EC2에 Access Key를 저장 → 키 유출 위험
> - **IAM Role 연결** (✅ 권장): Amazon EC2에 Role을 부여 → 임시 자격 증명 자동 발급, 키 관리 불필요
>
> IAM Role을 사용하면 Access Key 없이도 AWS API를 호출할 수 있습니다.  
> AWS SDK는 Amazon EC2 메타데이터 서비스에서 임시 자격 증명을 자동으로 가져옵니다.
>
> **이 태스크에서 하는 일:**  
> IAM Role을 EC2에 연결하면, EC2 위에서 돌아가는 Spring 앱의 `ParameterStoreService`가 **`aws configure` 없이도** 자동으로 Parameter Store에 접근할 수 있게 됩니다.  
> CLI 테스트는 이 자동 인증이 제대로 되는지 확인하는 용도입니다.

### IAM 정책 생성

75. AWS Management Console 상단 검색창에 `IAM`을 입력합니다.
76. 검색 결과에서 **IAM** 서비스를 클릭합니다.
77. 왼쪽 메뉴에서 **Policies**를 클릭합니다.
78. [[Create policy]] 버튼을 클릭합니다.
79. 상단의 **JSON** 탭을 클릭합니다.

> [!NOTE]
> 기본으로 Visual editor가 선택되어 있습니다. JSON 탭을 클릭하면 정책을 직접 JSON으로 작성할 수 있습니다.

80. 기존 내용을 모두 삭제하고 다음 JSON을 붙여넣습니다:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowSSMParameterAccess",
      "Effect": "Allow",
      "Action": [
        "ssm:GetParameter",
        "ssm:GetParameters",
        "ssm:GetParametersByPath"
      ],
      "Resource": "arn:aws:ssm:ap-northeast-2:*:parameter/starter/*"
    },
    {
      "Sid": "AllowKMSDecrypt",
      "Effect": "Allow",
      "Action": ["kms:Decrypt"],
      "Resource": "*",
      "Condition": {
        "StringEquals": {
          "kms:ViaService": "ssm.ap-northeast-2.amazonaws.com"
        }
      }
    }
  ]
}
```

> [!CONCEPT] 최소 권한 원칙 (Least Privilege)
>
> 이 정책은 두 가지 권한을 부여합니다:
>
> - **SSM 읽기 권한**: `/starter/*` 경로의 파라미터만 조회 가능
>   - `Resource`를 `"arn:aws:ssm:*:*:parameter/*"`로 설정하면 모든 파라미터에 접근 가능 (위험)
>   - `/starter/*`로 제한하면 해당 경로의 파라미터만 접근 가능 (안전)
> - **KMS 복호화 권한**: SecureString을 복호화하는 데 필요
>   - `Condition`으로 SSM 서비스를 통한 복호화만 허용
>   - 직접 KMS API를 호출하여 다른 데이터를 복호화하는 것은 차단

81. [[Next]] 버튼을 클릭합니다.
82. **Policy name** 필드에 `starter-ssm-read-policy`를 입력합니다.
83. **Description** 필드에 `Allow read access to starter parameters in SSM Parameter Store`를 입력합니다.
84. **Tags** 섹션에서 [[Add tag]]를 클릭하여 태그를 추가합니다:
    - `CreatedBy` = `admin-user`
    - `Step` = `step6`
    - `Session` = `6-1`
85. [[Create policy]] 버튼을 클릭합니다.

> [!OUTPUT]
> 화면 상단에 녹색 배너로 "Policy starter-ssm-read-policy created" 메시지가 표시됩니다.  
> Policies 목록에서 `starter-ssm-read-policy`를 검색하면 확인할 수 있습니다.

### IAM Role 생성

86. 왼쪽 메뉴에서 **Roles**를 클릭합니다.
87. [[Create role]] 버튼을 클릭합니다.
88. **Trusted entity type** 섹션에서 `AWS service`를 선택합니다 (기본값).
89. **Use case** 섹션에서 **Service or use case** 드롭다운에서 `EC2`를 선택합니다.
90. 하단의 `EC2` 라디오 버튼이 선택되어 있는지 확인합니다.
91. [[Next]] 버튼을 클릭합니다.

92. **Permissions policies** 검색창에 `starter-ssm-read-policy`를 입력합니다.
93. 검색 결과에서 `starter-ssm-read-policy` 왼쪽의 체크박스를 클릭합니다.
94. [[Next]] 버튼을 클릭합니다.
95. **Role name** 필드에 `ec2-starter-role`을 입력합니다.
96. **Description** 필드에 `EC2 role for accessing SSM Parameter Store`를 입력합니다.
97. **Tags** 섹션에서 [[Add tag]]를 클릭하여 태그를 추가합니다:
    - `CreatedBy` = `admin-user`
    - `Step` = `step6`
    - `Session` = `6-1`
98. 페이지 하단의 [[Create role]] 버튼을 클릭합니다.

> [!OUTPUT]
> 화면 상단에 녹색 배너로 "Role ec2-starter-role created" 메시지가 표시됩니다.

### Amazon EC2 인스턴스에 IAM Role 연결

> [!NOTE]
> **본인 상황에 맞는 경로를 선택하세요:**
>
> | 상황 | 진행 방법 |
> |------|-----------|
> | Step 2에서 생성한 Amazon EC2가 있고, 이미 IAM Role이 연결됨 | 기존 Role에 `starter-ssm-read-policy` 정책만 추가 (아래 TIP 참고) → 바로 테스트로 이동 |
> | Step 2에서 생성한 Amazon EC2가 있고, IAM Role이 없음 | 아래 99~106번 단계 진행 |
> | Amazon EC2가 아직 없지만 테스트해보고 싶음 | Step 2-1을 참고하여 t3.micro 생성 후 아래 단계 진행 |
> | Amazon EC2가 없고, 나중에 할 예정 | 이 섹션 전체를 건너뛰고 태스크 7로 이동 |

> [!TIP]
> **이미 Amazon EC2에 IAM Role이 연결된 경우** (예: Step 5에서 S3용 Role을 붙인 경우):
>
> - IAM → **Roles** → 기존 Role 클릭
> - **Permissions** 탭에서 [[Add permissions]] → **Attach policies** 클릭
> - `starter-ssm-read-policy` 검색 → 체크 → [[Attach policies]] 클릭
>
> 새 Role을 만들 필요 없이 기존 Role에 정책만 추가하면 됩니다.

99. AWS Management Console 상단 검색창에 `EC2`를 입력합니다.
100. 검색 결과에서 **EC2** 서비스를 클릭합니다.
101. 왼쪽 메뉴에서 **Instances**를 클릭합니다.
102. IAM Role을 연결할 Amazon EC2 인스턴스의 체크박스를 클릭합니다.
103. 상단의 **Actions** 드롭다운을 클릭합니다.
104. **Security** → **Modify IAM role**을 선택합니다.
105. **IAM role** 드롭다운에서 `ec2-starter-role`을 선택합니다.
106. [[Update IAM role]] 버튼을 클릭합니다.

> [!OUTPUT]
> 화면 상단에 녹색 배너로 "Successfully attached ec2-starter-role to instance i-xxxxxxxxx" 메시지가 표시됩니다.

### Amazon EC2에서 Parameter Store 접근 테스트

> [!CONCEPT] 이 테스트의 목적
>
> 지금까지 IAM 정책 → IAM Role → Amazon EC2에 Role 연결을 완료했습니다.  
> 이제 **Amazon EC2 안에서 Access Key 없이도** Parameter Store를 조회할 수 있는지 확인합니다.
>
> - 로컬 PC에서는 `aws configure`로 Access Key를 설정해야 AWS CLI가 작동합니다.  
> - Amazon EC2에서는 IAM Role이 연결되어 있으면 **Access Key 없이도** AWS CLI가 자동으로 작동합니다.
> - 이것이 IAM Role의 핵심 장점입니다: 키를 저장하지 않아도 AWS 서비스를 사용할 수 있습니다.

107. Amazon EC2 인스턴스에 SSH로 접속합니다.

> [!TIP]
> Step 2에서 Amazon EC2를 생성할 때 다운로드한 `.pem` 키 파일이 필요합니다.  
> `<EC2-Public-IP>`는 EC2 콘솔 → 인스턴스 상세 → **Public IPv4 address** 에서 확인할 수 있습니다.

```bash
ssh -i your-key.pem ec2-user@<EC2-Public-IP>
```

> [!NOTE]
> - `your-key.pem`을 본인이 다운로드한 키 파일 경로로 변경하세요 (예: `~/Downloads/my-ec2-key.pem`) 
> - `<EC2-Public-IP>`를 실제 Amazon EC2 퍼블릭 IP로 변경하세요 (예: `3.35.xxx.xxx`)
> - Permission denied 에러가 나면: `chmod 400 your-key.pem` 실행 후 재시도

108. SSH 접속 후, **Amazon EC2 안에서** 다음 명령어를 실행합니다 (String 파라미터 조회):

```bash
aws ssm get-parameter \
  --name "/starter/prod/db/url" \
  --region ap-northeast-2
```

> [!NOTE]
> 이 명령어는 태스크 4에서 로컬에서 실행한 것과 동일합니다.
> 차이점은: 로컬에서는 Access Key가 필요했지만, Amazon EC2에서는 IAM Role 덕분에 **자동으로 인증**됩니다.
> `aws configure`를 실행하지 않았는데도 명령어가 작동하면 성공입니다!

109. SecureString 파라미터를 복호화하여 조회합니다:

```bash
aws ssm get-parameter \
  --name "/starter/prod/db/password" \
  --with-decryption \
  --region ap-northeast-2
```

> [!OUTPUT]
> IAM Role이 정상적으로 설정되었다면 Access Key 설정 없이도 파라미터를 조회할 수 있습니다.
> 아래와 같이 `Value`에 평문 비밀번호가 표시되면 **성공**입니다:
>
> ```json
> {
>   "Parameter": {
>     "Name": "/starter/prod/db/password",
>     "Type": "SecureString",
>     "Value": "MyPassword123!",
>     "Version": 1
>   }
> }
> ```

> [!TIP]
> **성공 확인 포인트:**
> - `Value` 필드에 태스크 3에서 입력한 비밀번호(`MyPassword123!`)가 보이면 됩니다.
> - `aws configure`를 하지 않았는데도 작동하면 IAM Role이 올바르게 설정된 것입니다.

> [!NOTE]
> Amazon EC2가 없어서 이 단계를 진행할 수 없는 경우:
> - 이 테스트 단계는 건너뛰어도 됩니다.
> - 핵심 개념만 이해하면 됩니다: "Amazon EC2에 IAM Role을 붙이면 Access Key 없이 AWS 서비스에 접근 가능하다"
> - 나중에 Amazon EC2를 생성한 후 이 단계로 돌아와서 테스트할 수 있습니다.

> [!TROUBLESHOOTING]
> | 증상 | 원인 | 해결 방법 |
> |------|------|-----------|
> | `Unable to locate credentials` | IAM Role이 Amazon EC2에 연결되지 않음 | EC2 콘솔 → 인스턴스 선택 → Actions → Security → Modify IAM role에서 `ec2-starter-role` 선택 후 Update |
> | `AccessDeniedException` on SSM | 정책의 Resource ARN 불일치 | IAM → Policies → `starter-ssm-read-policy` 클릭 → JSON에서 `Resource`가 `"arn:aws:ssm:ap-northeast-2:*:parameter/starter/*"`인지 확인 |
> | `AccessDeniedException` on KMS | KMS 복호화 권한 누락 | 정책 JSON에 `kms:Decrypt` Action이 포함되어 있는지 확인 |
> | Role 변경 후에도 권한 에러 | IAM 전파 지연 (수 초~수 분) | 1~2분 대기 후 재시도. 그래도 안 되면 EC2 콘솔에서 Role이 연결되어 있는지 재확인 |
> | `Could not connect to the endpoint URL` | 리전 설정 오류 또는 네트워크 문제 | `--region ap-northeast-2` 옵션 확인. Amazon EC2가 인터넷에 연결되어 있는지 확인 (Public Subnet 또는 NAT Gateway 필요) |

✅ **태스크 완료** — Amazon EC2 IAM Role에 Parameter Store 접근 권한을 설정하고 테스트했습니다.

---

## 태스크 7: Secrets Manager와 비교

AWS에는 Parameter Store 외에 **Secrets Manager**라는 비밀값 관리 서비스도 있습니다.
두 서비스의 차이를 이해하고 적절한 선택 기준을 학습합니다.

> [!CONCEPT] Parameter Store vs Secrets Manager
>
> | 항목             | Parameter Store                 | Secrets Manager                 |
> | ---------------- | ------------------------------- | ------------------------------- |
> | 비용             | 무료 (Standard)                 | 비밀당 월 $0.40 + API 호출 비용 |
> | 자동 로테이션    | ❌ 미지원                       | ✅ Lambda로 자동 교체           |
> | 최대 크기        | 4KB (Standard) / 8KB (Advanced) | 64KB                            |
> | RDS 통합         | 수동                            | ✅ RDS 비밀번호 자동 로테이션   |
> | 크로스 계정 공유 | 제한적                          | ✅ 지원                         |
> | 버전 관리        | 제한적                          | ✅ 자동 버전 관리               |
>
> **선택 기준:**
>
> - 비용 최소화 + 단순 설정값 관리 → **Parameter Store**
> - DB 비밀번호 자동 로테이션 필요 → **Secrets Manager**
> - 학습 단계 → **Parameter Store** (무료, 간단)

> [!TIP]
> 학습 단계에서는 **Parameter Store**로 충분합니다. 무료이고 사용법이 간단합니다.  
> 프로덕션에서 DB 비밀번호 자동 로테이션이 필요해지면 Secrets Manager를 고려하세요.
>
> **Secrets Manager의 실제 사용법(콘솔/CLI/Spring 연동/RDS 자동 로테이션)은 Session 6-2에서 실습합니다.**

✅ **태스크 완료** — Parameter Store와 Secrets Manager의 차이를 이해하고 적절한 선택 기준을 학습했습니다.

---

## 마무리

다음을 성공적으로 수행했습니다:

- 비밀값 하드코딩의 위험성과 안전한 관리 방법을 이해했습니다.
- Parameter Store의 String/SecureString 타입과 계층 구조를 학습했습니다.
- AWS 콘솔에서 5개의 파라미터(String 4개, SecureString 1개)를 생성했습니다.
- AWS CLI로 파라미터를 생성, 조회, 업데이트, 삭제하는 방법을 실습했습니다.
- Spring 프로젝트(Boot/MVC)에서 AWS SDK를 사용하여 Parameter Store 값을 조회하고 DataSource에 활용했습니다.
- 로컬에서 `aws` 프로필 테스트로 연동 동작을 검증했습니다.
- Amazon EC2 IAM Role을 생성하고 Parameter Store 접근 권한을 설정했습니다.
- Parameter Store와 Secrets Manager의 차이를 이해했습니다.

> [!NOTE]
> **다음 세션 안내**  
> Session 6-2에서는 Secrets Manager를 사용하여 비밀을 생성하고, Amazon RDS 비밀번호 자동 로테이션을 설정합니다.

---

# 🗑️ 리소스 정리

> [!NOTE]
> 이 실습에서 생성한 리소스를 유지할지 삭제할지 결정하세요.  
> Parameter Store Standard 파라미터는 10,000개까지 **항상 무료**입니다.  
> 학습용 파라미터 몇 개는 유지해도 전혀 비용이 발생하지 않습니다.

| 항목 | 옵션 A: 유지 | 옵션 B: 완전 삭제 |
|------|-------------|-------------------|
| 비용 | 무료 (Standard 파라미터) | 무료 |
| 장점 | 다음 실습에서 참조 가능 | 깨끗한 환경 유지 |
| 단점 | 없음 | 재실습 시 재생성 필요 |
| 권장 대상 | 학습 계속 진행 예정 | 실습 완전 종료 |

## 옵션 A: 리소스 유지 (권장)

Parameter Store Standard 파라미터는 **완전 무료**이므로 유지해도 비용이 발생하지 않습니다.  
다음 실습에서 비교 참조용으로 활용할 수 있습니다.

## 옵션 B: 리소스 삭제

더 이상 사용하지 않는다면 아래 순서로 삭제합니다.

> [!WARNING]
> **삭제 순서가 중요합니다 (의존 관계):**
>
> ```
> 생성 순서: 정책 → Role → Amazon EC2에 Role 연결 → 파라미터
> 삭제 순서: Amazon EC2에서 Role 분리 → Role에서 정책 분리 → 정책 삭제 → 파라미터 삭제 (역순)
> ```
>
> 정책이 Role에 연결된 상태에서는 정책을 삭제할 수 없습니다.  
> Role이 Amazon EC2에 연결된 상태에서도 Role 삭제가 실패합니다.

---

### 단계 1: Tag Editor로 생성된 리소스 확인

삭제를 시작하기 전에, 이 실습에서 생성한 모든 리소스를 Tag Editor로 확인합니다.

1. AWS Management Console 상단 검색창에 `Resource Groups & Tag Editor`를 입력하고 선택합니다.
2. 왼쪽 메뉴에서 **Tag Editor**를 클릭합니다.
3. 다음과 같이 설정합니다:
    - **Regions**: `ap-northeast-2`
    - **Resource types**: `All supported resource types`
    - **Tags**: Tag key = `Session`, Tag value = `6-1`
4. [[Search resources]] 버튼을 클릭합니다.
5. 검색 결과에서 이 실습에서 생성한 리소스 목록을 확인합니다.

> [!NOTE]
> Tag Editor 검색 결과를 통해 삭제해야 할 리소스의 전체 목록을 미리 파악할 수 있습니다.  
> 아래 단계에서 이 리소스들을 순서대로 삭제합니다.

---

### 단계 2: Amazon EC2에서 IAM Role 분리

1. AWS Management Console 상단 검색창에 `EC2`를 입력하고 선택합니다.
2. 왼쪽 메뉴에서 **Instances**를 클릭합니다.
3. `ec2-starter-role`이 연결된 Amazon EC2 인스턴스의 체크박스를 클릭합니다.
4. **Actions** → **Security** → **Modify IAM role**을 선택합니다.
5. **IAM role** 드롭다운에서 `No IAM Role`을 선택합니다 (빈 값 선택).
6. [[Update IAM role]] 버튼을 클릭합니다.

> [!OUTPUT]
> "Successfully detached IAM role from instance" 메시지가 표시됩니다.

> [!NOTE]
> Amazon EC2에 Role을 연결하지 않았다면 이 단계는 건너뛰세요.

---

### 단계 3: IAM Role에서 정책 분리

7. AWS Management Console 상단 검색창에 `IAM`을 입력하고 선택합니다.
8. 왼쪽 메뉴에서 **Roles**를 클릭합니다.
9. 검색창에 `ec2-starter-role`을 입력합니다.
10. `ec2-starter-role`을 클릭하여 상세 페이지로 이동합니다.
11. **Permissions** 탭에서 `starter-ssm-read-policy` 오른쪽의 [[Remove]] 버튼을 클릭합니다.
12. 확인 팝업에서 [[Remove]] 버튼을 클릭합니다.

> [!OUTPUT]
> Permissions 목록에서 `starter-ssm-read-policy`가 사라집니다.

---

### 단계 4: IAM Role 삭제

13. 왼쪽 메뉴에서 **Roles**를 클릭합니다.
14. 검색창에 `ec2-starter-role`을 입력합니다.
15. `ec2-starter-role` 왼쪽의 라디오 버튼을 클릭합니다.
16. [[Delete]] 버튼을 클릭합니다.
17. 확인 팝업에서 Role 이름 `ec2-starter-role`을 입력합니다.
18. [[Delete]] 버튼을 클릭합니다.

> [!OUTPUT]
> "Role ec2-starter-role deleted" 메시지가 표시됩니다.

---

### 단계 5: IAM 정책 삭제

19. 왼쪽 메뉴에서 **Policies**를 클릭합니다.
20. 검색창에 `starter-ssm-read-policy`를 입력합니다.
21. `starter-ssm-read-policy` 왼쪽의 라디오 버튼을 클릭합니다.
22. **Actions** 드롭다운을 클릭합니다.
23. [[Delete]]를 선택합니다.
24. 확인 팝업에서 정책 이름 `starter-ssm-read-policy`를 입력합니다.
25. [[Delete]] 버튼을 클릭합니다.

> [!OUTPUT]
> "Policy starter-ssm-read-policy deleted" 메시지가 표시됩니다.

> [!NOTE]
> 정책이 다른 Role에도 연결되어 있다면 "Cannot delete a policy attached to entities" 에러가 발생합니다.  
> 모든 Role에서 정책을 분리(Detach)한 후 삭제하세요.

---

### 단계 6: Parameter Store 파라미터 삭제

**방법 A: 콘솔에서 삭제**

26. AWS Management Console 상단 검색창에 `Systems Manager`를 입력하고 선택합니다.
27. 왼쪽 메뉴에서 **Parameter Store**를 클릭합니다.
28. `/starter/prod/db/driver` 왼쪽의 체크박스를 클릭합니다.
29. `/starter/prod/db/url` 왼쪽의 체크박스를 클릭합니다.
30. `/starter/prod/db/username` 왼쪽의 체크박스를 클릭합니다.
31. `/starter/prod/db/password` 왼쪽의 체크박스를 클릭합니다.
32. `/starter/prod/s3/bucket` 왼쪽의 체크박스를 클릭합니다.
33. [[Delete]] 버튼을 클릭합니다.
34. 확인 팝업에서 [[Delete parameters]] 버튼을 클릭합니다.

> [!OUTPUT]
> "Delete parameters request succeeded" 메시지가 표시됩니다.  
> Parameter Store 목록에서 5개의 파라미터가 사라집니다.

**방법 B: CLI로 일괄 삭제**

```bash
aws ssm delete-parameters \
  --names "/starter/prod/db/driver" \
          "/starter/prod/db/url" \
          "/starter/prod/db/username" \
          "/starter/prod/db/password" \
          "/starter/prod/s3/bucket" \
  --region ap-northeast-2
```

> [!OUTPUT]
>
> ```json
> {
>   "DeletedParameters": [
>     "/starter/prod/db/driver",
>     "/starter/prod/db/url",
>     "/starter/prod/db/username",
>     "/starter/prod/db/password",
>     "/starter/prod/s3/bucket"
>   ],
>   "InvalidParameters": []
> }
> ```

---

### 단계 7: 삭제 확인

34. **Parameter Store** 목록에서 `/starter/prod/` 경로의 파라미터가 없는지 확인합니다.
35. **IAM → Policies**에서 `starter-ssm-read-policy`를 검색하여 결과가 없는지 확인합니다.
36. **IAM → Roles**에서 `ec2-starter-role`을 검색하여 결과가 없는지 확인합니다.

### Tag Editor로 최종 확인

37. AWS Management Console 상단 검색창에 `Resource Groups & Tag Editor`를 입력하고 선택합니다.
38. 왼쪽 메뉴에서 **Tag Editor**를 클릭합니다.
39. 다음과 같이 설정합니다:
    - **Regions**: `ap-northeast-2`
    - **Resource types**: `All supported resource types`
    - **Tags**: Tag key = `Session`, Tag value = `6-1`
40. [[Search resources]] 버튼을 클릭합니다.
41. 검색 결과에 리소스가 표시되지 않으면 모든 리소스가 성공적으로 삭제된 것입니다.

> [!NOTE]
> 삭제 직후에는 일부 리소스가 잠시 남아있을 수 있으나, 수 분 내에 자동으로 사라집니다.

> [!TIP]
> `Session: 6-1` 태그로 검색한 후, 추가로 Tag key = `Step`, Tag value = `step6`으로도 검색하면
> 이 Step에서 생성한 다른 세션의 리소스까지 함께 확인할 수 있습니다.

> [!TROUBLESHOOTING]
> | 증상 | 원인 | 해결 방법 |
> |------|------|-----------|
> | IAM 정책 삭제 실패 "Cannot delete a policy attached to entities" | 정책이 Role에 연결된 상태 | 단계 3에서 Role에서 정책을 먼저 분리 |
> | IAM Role 삭제 실패 "Cannot delete entity, must detach all policies" | Role에 정책이 남아있음 | Role의 Permissions에서 모든 정책 Remove |
> | IAM Role 삭제 실패 "Role is attached to instance profile" | Amazon EC2에 Role이 연결된 상태 | 단계 2에서 Amazon EC2에서 Role을 먼저 분리 |
> | Tag Editor에서 리소스가 계속 보임 | 삭제 전파 지연 | 1~2분 대기 후 다시 검색 |

✅ **실습 종료**: 모든 리소스가 정리되었습니다.

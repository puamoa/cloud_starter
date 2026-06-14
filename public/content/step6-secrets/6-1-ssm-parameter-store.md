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
  - EC2 IAM Role을 설정하여 Parameter Store에 접근할 수 있습니다.
prerequisites:
  - AWS 계정 생성 완료
estimatedCost: 무료 (Standard 파라미터 10,000개까지 항상 무료)
---

이 실습에서는 데이터베이스 비밀번호, API 키 등 민감한 설정값을 AWS Systems Manager Parameter Store에 안전하게 저장하고, Spring 애플리케이션(Boot 또는 MVC)에서 조회하여 사용하는 방법을 학습합니다.

> [!NOTE]
> 이 실습은 독립적으로 진행할 수 있습니다. AWS 계정만 있으면 바로 시작할 수 있습니다.
> RDS나 EC2가 없어도 Parameter Store 자체의 사용법을 학습할 수 있습니다.

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

### 계층 구조 (Hierarchy)

Parameter Store는 경로 기반의 계층 구조를 지원합니다:

```
/myapp/
├── prod/
│   ├── db/
│   │   ├── url          → jdbc:mysql://prod-db:3306/mydb
│   │   ├── username     → admin
│   │   └── password     → (SecureString) ProdP@ss123!
│   └── s3/
│       └── bucket       → myapp-prod-bucket
└── dev/
    ├── db/
    │   ├── url          → jdbc:mysql://dev-db:3306/mydb
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

3. 상단 검색창에 `Systems Manager`를 입력합니다.
4. 검색 결과에서 **Systems Manager** 서비스를 클릭합니다.
5. 왼쪽 메뉴 스크롤을 내려 **Application Management** 섹션을 찾습니다.
6. **Parameter Store**를 클릭합니다.

> [!TIP]
> 왼쪽 메뉴가 접혀 있으면 좌측 상단의 햄버거 아이콘(≡)을 클릭하여 펼치세요.
> Parameter Store는 **Application Management** 섹션 아래에 있습니다.

7. [[Create parameter]] 버튼을 클릭합니다.
8. **Name** 필드에 `/starter/prod/db/url`을 입력합니다.
9. **Description** 필드에 `Production DB JDBC URL`을 입력합니다.
10. **Tier** 섹션에서 `Standard`가 선택되어 있는지 확인합니다 (기본값).
11. **Type** 드롭다운에서 `String`을 선택합니다 (기본값).
12. **Data type** 드롭다운에서 `text`를 선택합니다 (기본값).
13. **Value** 필드에 `jdbc:mysql://your-rds-endpoint:3306/starter_db`를 입력합니다.

> [!NOTE]
> `your-rds-endpoint` 부분은 실제 RDS 엔드포인트로 교체합니다.
> RDS가 아직 없다면 위 예시 값을 그대로 사용해도 됩니다. 나중에 `--overwrite`로 업데이트할 수 있습니다.

14. **Tags** 섹션에서 [[Add tag]]를 클릭하여 아래 태그를 추가합니다:

| Key         | Value        |
| ----------- | ------------ |
| `CreatedBy` | `admin-user` |
| `Step`      | `step6`      |
| `Session`   | `6-1`        |

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

23. **Value** 필드에 `YourSecurePassword123!`을 입력합니다.
24. **Tags** 섹션에서 [[Add tag]]를 클릭하여 태그를 추가합니다:

| Key         | Value        |
| ----------- | ------------ |
| `CreatedBy` | `admin-user` |
| `Step`      | `step6`      |
| `Session`   | `6-1`        |

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

### S3 Bucket 파라미터 (String 타입)

35. [[Create parameter]] 버튼을 클릭합니다.
36. **Name** 필드에 `/starter/prod/s3/bucket`을 입력합니다.
37. **Description** 필드에 `Production S3 bucket name`을 입력합니다.
38. **Tier**: `Standard` (기본값 확인).
39. **Type** 드롭다운에서 `String`을 선택합니다 (기본값).
40. **Data type**: `text` (기본값 확인).
41. **Value** 필드에 `my-starter-app-123456789012`를 입력합니다.

> [!TIP]
> S3 버킷 이름은 전 세계적으로 고유해야 합니다. 실제 사용 시에는 계정 ID나 고유 식별자를 포함하세요.
> 여기서는 학습용 예시 값을 사용합니다.

42. **Tags** 섹션에서 [[Add tag]]를 클릭하여 동일한 태그 3개를 추가합니다:
    - `CreatedBy` = `admin-user`
    - `Step` = `step6`
    - `Session` = `6-1`
43. [[Create parameter]] 버튼을 클릭합니다.

### 생성 결과 확인

44. Parameter Store 목록 페이지에서 4개의 파라미터가 모두 표시되는지 확인합니다.
45. `/starter/prod/db/password`를 클릭합니다.
46. **Value** 섹션에서 값이 `****`로 마스킹되어 있는지 확인합니다.
47. [[Show]] 버튼을 클릭하여 복호화된 값(`YourSecurePassword123!`)이 표시되는지 확인합니다.
48. 브라우저의 뒤로 가기를 클릭하여 목록으로 돌아갑니다.

> [!OUTPUT]
> Parameter Store 목록에서 생성한 4개의 파라미터를 확인할 수 있습니다:
>
> | Name                        | Type         | Value 표시                                       |
> | --------------------------- | ------------ | ------------------------------------------------ |
> | `/starter/prod/db/url`      | String       | `jdbc:mysql://your-rds-endpoint:3306/starter_db` |
> | `/starter/prod/db/username` | String       | `admin`                                          |
> | `/starter/prod/db/password` | SecureString | `****` (Show 클릭 시 복호화)                     |
> | `/starter/prod/s3/bucket`   | String       | `my-starter-app-123456789012`                    |

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

✅ **태스크 완료** — 콘솔에서 String 3개와 SecureString 1개, 총 4개의 파라미터를 생성했습니다.

---

## 태스크 4: AWS CLI로 파라미터 생성 및 조회

CLI를 사용하면 파라미터를 스크립트로 자동화하거나, 빠르게 조회·수정할 수 있습니다.

### 파라미터 생성 (put-parameter)

49. 터미널(또는 CloudShell)을 엽니다.
50. 다음 명령어로 String 타입 파라미터를 생성합니다:

```bash
aws ssm put-parameter \
  --name "/starter/prod/app/port" \
  --type "String" \
  --value "8080" \
  --description "Application port" \
  --region ap-northeast-2
```

51. 다음 명령어로 SecureString 타입 파라미터를 생성합니다:

```bash
aws ssm put-parameter \
  --name "/starter/prod/jwt/secret" \
  --type "SecureString" \
  --value "myJwtSecretKey2025!@#$" \
  --description "JWT signing secret key" \
  --region ap-northeast-2
```

> [!OUTPUT]
> 각 명령어 실행 후 다음과 같은 응답이 표시됩니다:
>
> ```json
> {
>   "Version": 1,
>   "Tier": "Standard"
> }
> ```

52. 기존 파라미터의 값을 업데이트합니다 (`--overwrite` 필수):

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

53. String 타입 파라미터를 조회합니다:

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

54. SecureString 타입 파라미터를 **복호화 없이** 조회합니다:

```bash
aws ssm get-parameter \
  --name "/starter/prod/db/password" \
  --region ap-northeast-2
```

> [!NOTE]
> `--with-decryption` 옵션 없이 SecureString을 조회하면 Value가 암호화된 문자열로 반환됩니다.
> 평문 값을 얻으려면 반드시 `--with-decryption`을 추가해야 합니다.

55. SecureString 타입 파라미터를 **복호화하여** 조회합니다:

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
>     "Value": "YourSecurePassword123!",
>     "Version": 1,
>     "LastModifiedDate": "2025-01-15T10:35:00+09:00",
>     "ARN": "arn:aws:ssm:ap-northeast-2:123456789012:parameter/starter/prod/db/password",
>     "DataType": "text"
>   }
> }
> ```

### 경로 기반 일괄 조회 (get-parameters-by-path)

56. `/starter/prod/db` 경로 하위의 모든 파라미터를 한 번에 조회합니다:

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
>       "Value": "YourSecurePassword123!"
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

57. 테스트용으로 생성한 파라미터를 삭제합니다:

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

**Spring Boot와 기존 MVC 프로젝트 모두** 동일한 AWS SDK 코드를 사용합니다. 의존성 추가 방법만 다릅니다.

### 의존성 추가

**방법 A: Spring Boot 프로젝트**

58. `build.gradle` 파일을 열고 다음 의존성을 추가합니다:

```groovy
// build.gradle
dependencyManagement {
    imports {
        mavenBom "software.amazon.awssdk:bom:2.25.60"
    }
}

dependencies {
    implementation 'software.amazon.awssdk:ssm'
    implementation 'org.springframework.boot:spring-boot-starter-web'
}
```

**방법 B: 기존 Spring MVC 프로젝트**

58. `build.gradle` 파일을 열고 다음 의존성을 추가합니다:

```groovy
dependencies {
    // 기존 의존성들...

    // AWS SDK v2 - SSM (Parameter Store)
    implementation platform('software.amazon.awssdk:bom:2.25.60')
    implementation 'software.amazon.awssdk:ssm'
}
```

> [!NOTE]
> AWS SDK BOM(Bill of Materials)을 사용하면 AWS SDK 모듈 간 버전 충돌을 방지할 수 있습니다.
> `ssm` 모듈만 추가하면 Parameter Store API를 사용할 수 있습니다.

### ParameterStoreService 클래스 생성

59. `src/main/java/com/example/demo/config/` 디렉토리에 `ParameterStoreService.java` 파일을 생성합니다.
60. 다음 코드를 작성합니다:

```java
package com.example.demo.config;

import javax.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
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
public class ParameterStoreService {
```

> [!NOTE]
> **import 차이:**
>
> - Spring Boot 3.x (Jakarta EE): `import jakarta.annotation.PostConstruct;`
> - Spring MVC 5.x / Boot 2.x (Java EE): `import javax.annotation.PostConstruct;`
>
> 본인 프로젝트의 Spring 버전에 맞게 import를 변경하세요.
> 기존 MVC 프로젝트에서는 패키지도 `org.scoula.config`로 변경합니다.

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

```

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

````

### DataSource 설정에 활용

61. `src/main/java/com/example/demo/config/` 디렉토리에 `DataSourceConfig.java` 파일을 생성합니다.
62. 다음 코드를 작성합니다:

```java
package com.example.demo.config;

import com.zaxxer.hikari.HikariDataSource;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import javax.sql.DataSource;

@Configuration
@RequiredArgsConstructor
public class DataSourceConfig {

    private final ParameterStoreService parameterStoreService;

    @Bean
    public DataSource dataSource() {
        HikariDataSource dataSource = new HikariDataSource();
        dataSource.setJdbcUrl(parameterStoreService.getDbUrl());
        dataSource.setUsername(parameterStoreService.getDbUsername());
        dataSource.setPassword(parameterStoreService.getDbPassword());
        dataSource.setDriverClassName("com.mysql.cj.jdbc.Driver");
        return dataSource;
    }
}
````

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
> EC2에서는 IAM Role로 자동 인증됩니다 (태스크 6에서 설정).

✅ **태스크 완료** — Spring Boot에서 Parameter Store 값을 조회하여 DataSource를 설정했습니다.

> [!NOTE]
> **기존 Spring MVC 프로젝트에서의 적용:**
>
> 기존 MVC 프로젝트에서는 `RootConfig.java`에 이미 HikariCP DataSource가 설정되어 있을 수 있습니다.
> 기존 `application.properties`의 DB 정보를 Parameter Store에서 가져오도록 수정합니다:
>
> ```java
> // RootConfig.java에서 기존 DataSource 설정을 수정
> @Configuration
> @ComponentScan(basePackages = {"org.scoula.config"})
> public class RootConfig {
>
>     @Autowired
>     private ParameterStoreService parameterStoreService;
>
>     @Bean
>     public DataSource dataSource() {
>         HikariDataSource ds = new HikariDataSource();
>         ds.setDriverClassName("net.sf.log4jdbc.sql.jdbcapi.DriverSpy");
>         ds.setJdbcUrl(parameterStoreService.getDbUrl());
>         ds.setUsername(parameterStoreService.getDbUsername());
>         ds.setPassword(parameterStoreService.getDbPassword());
>         return ds;
>     }
> }
> ```
>
> 이렇게 하면 `application.properties`에서 DB 비밀번호를 완전히 제거할 수 있습니다.

---

## 태스크 6: EC2 IAM Role 설정

EC2 인스턴스에서 Parameter Store에 접근하려면 적절한 IAM 권한이 필요합니다.
IAM 정책을 생성하고, Role에 연결한 뒤, EC2에 Role을 부여합니다.

> [!CONCEPT] EC2에서 AWS 서비스 접근 방식
>
> EC2에서 AWS 서비스(SSM, S3, RDS 등)에 접근하는 방법은 두 가지입니다:
>
> 1. **Access Key 직접 설정** (❌ 비권장): EC2에 Access Key를 저장 → 키 유출 위험
> 2. **IAM Role 연결** (✅ 권장): EC2에 Role을 부여 → 임시 자격 증명 자동 발급, 키 관리 불필요
>
> IAM Role을 사용하면 Access Key 없이도 AWS API를 호출할 수 있습니다.
> AWS SDK는 EC2 메타데이터 서비스에서 임시 자격 증명을 자동으로 가져옵니다.

### IAM 정책 생성

63. AWS Management Console 상단 검색창에 `IAM`을 입력합니다.
64. 검색 결과에서 **IAM** 서비스를 클릭합니다.
65. 왼쪽 메뉴에서 **Policies**를 클릭합니다.
66. [[Create policy]] 버튼을 클릭합니다.
67. 상단의 **JSON** 탭을 클릭합니다.

> [!NOTE]
> 기본으로 Visual editor가 선택되어 있습니다. JSON 탭을 클릭하면 정책을 직접 JSON으로 작성할 수 있습니다.

68. 기존 내용을 모두 삭제하고 다음 JSON을 붙여넣습니다:

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
> 1. **SSM 읽기 권한**: `/starter/*` 경로의 파라미터만 조회 가능
>    - `Resource`를 `"arn:aws:ssm:*:*:parameter/*"`로 설정하면 모든 파라미터에 접근 가능 (위험)
>    - `/starter/*`로 제한하면 해당 경로의 파라미터만 접근 가능 (안전)
> 2. **KMS 복호화 권한**: SecureString을 복호화하는 데 필요
>    - `Condition`으로 SSM 서비스를 통한 복호화만 허용
>    - 직접 KMS API를 호출하여 다른 데이터를 복호화하는 것은 차단

69. [[Next]] 버튼을 클릭합니다.
70. **Policy name** 필드에 `starter-ssm-read-policy`를 입력합니다.
71. **Description** 필드에 `Allow read access to /starter/* parameters in SSM Parameter Store`를 입력합니다.
72. **Tags** 섹션에서 [[Add tag]]를 클릭하여 태그를 추가합니다:
    - `CreatedBy` = `admin-user`
    - `Step` = `step6`
    - `Session` = `6-1`
73. [[Create policy]] 버튼을 클릭합니다.

> [!OUTPUT]
> 화면 상단에 녹색 배너로 "Policy starter-ssm-read-policy created" 메시지가 표시됩니다.
> Policies 목록에서 `starter-ssm-read-policy`를 검색하면 확인할 수 있습니다.

### IAM Role 생성

74. 왼쪽 메뉴에서 **Roles**를 클릭합니다.
75. [[Create role]] 버튼을 클릭합니다.
76. **Trusted entity type** 섹션에서 `AWS service`를 선택합니다 (기본값).
77. **Use case** 섹션에서 **Service or use case** 드롭다운에서 `EC2`를 선택합니다.
78. 하단의 `EC2` 라디오 버튼이 선택되어 있는지 확인합니다.
79. [[Next]] 버튼을 클릭합니다.

80. **Permissions policies** 검색창에 `starter-ssm-read-policy`를 입력합니다.
81. 검색 결과에서 `starter-ssm-read-policy` 왼쪽의 체크박스를 클릭합니다.
82. [[Next]] 버튼을 클릭합니다.
83. **Role name** 필드에 `ec2-starter-role`을 입력합니다.
84. **Description** 필드에 `EC2 role for accessing SSM Parameter Store`를 입력합니다.
85. **Tags** 섹션에서 [[Add tag]]를 클릭하여 태그를 추가합니다:
    - `CreatedBy` = `admin-user`
    - `Step` = `step6`
    - `Session` = `6-1`
86. 페이지 하단의 [[Create role]] 버튼을 클릭합니다.

> [!OUTPUT]
> 화면 상단에 녹색 배너로 "Role ec2-starter-role created" 메시지가 표시됩니다.

> [!TIP]
> 이미 EC2에 연결된 Role이 있다면 새 Role을 생성하지 않고, 기존 Role에 정책을 추가할 수 있습니다:
>
> 1. IAM → **Roles** → 기존 Role 클릭
> 2. **Permissions** 탭에서 [[Add permissions]] → **Attach policies** 클릭
> 3. `starter-ssm-read-policy` 검색 → 체크 → [[Attach policies]] 클릭

### EC2 인스턴스에 IAM Role 연결

87. AWS Management Console 상단 검색창에 `EC2`를 입력합니다.
88. 검색 결과에서 **EC2** 서비스를 클릭합니다.
89. 왼쪽 메뉴에서 **Instances**를 클릭합니다.
90. IAM Role을 연결할 EC2 인스턴스의 체크박스를 클릭합니다.
91. 상단의 **Actions** 드롭다운을 클릭합니다.
92. **Security** → **Modify IAM role**을 선택합니다.
93. **IAM role** 드롭다운에서 `ec2-starter-role`을 선택합니다.
94. [[Update IAM role]] 버튼을 클릭합니다.

> [!OUTPUT]
> 화면 상단에 녹색 배너로 "Successfully attached ec2-starter-role to instance i-xxxxxxxxx" 메시지가 표시됩니다.

> [!NOTE]
> EC2 인스턴스가 아직 없다면 이 단계는 건너뛰어도 됩니다.
> Step 2에서 생성한 EC2가 있다면 해당 인스턴스에 Role을 연결하세요.
> IAM Role 변경은 인스턴스 재시작 없이 즉시 적용됩니다 (전파에 수 초~수 분 소요).

### EC2에서 Parameter Store 접근 테스트

> [!CONCEPT] 이 테스트의 목적
>
> 지금까지 IAM 정책 → IAM Role → EC2에 Role 연결을 완료했습니다.
> 이제 **EC2 안에서 Access Key 없이도** Parameter Store를 조회할 수 있는지 확인합니다.
>
> - 로컬 PC에서는 `aws configure`로 Access Key를 설정해야 AWS CLI가 작동합니다.
> - EC2에서는 IAM Role이 연결되어 있으면 **Access Key 없이도** AWS CLI가 자동으로 작동합니다.
> - 이것이 IAM Role의 핵심 장점입니다: 키를 저장하지 않아도 AWS 서비스를 사용할 수 있습니다.

95. EC2 인스턴스에 SSH로 접속합니다.

> [!TIP]
> Step 2에서 EC2를 생성할 때 다운로드한 `.pem` 키 파일이 필요합니다.
> `<EC2-Public-IP>`는 EC2 콘솔 → 인스턴스 상세 → **Public IPv4 address** 에서 확인할 수 있습니다.

```bash
ssh -i your-key.pem ec2-user@<EC2-Public-IP>
```

> [!NOTE]
> - `your-key.pem`을 본인이 다운로드한 키 파일 경로로 변경하세요 (예: `~/Downloads/my-ec2-key.pem`)
> - `<EC2-Public-IP>`를 실제 EC2 퍼블릭 IP로 변경하세요 (예: `3.35.xxx.xxx`)
> - Permission denied 에러가 나면: `chmod 400 your-key.pem` 실행 후 재시도

96. SSH 접속 후, **EC2 안에서** 다음 명령어를 실행합니다 (String 파라미터 조회):

```bash
aws ssm get-parameter \
  --name "/starter/prod/db/url" \
  --region ap-northeast-2
```

> [!NOTE]
> 이 명령어는 태스크 4에서 로컬에서 실행한 것과 동일합니다.
> 차이점은: 로컬에서는 Access Key가 필요했지만, EC2에서는 IAM Role 덕분에 **자동으로 인증**됩니다.
> `aws configure`를 실행하지 않았는데도 명령어가 작동하면 성공입니다!

97. SecureString 파라미터를 복호화하여 조회합니다:

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
>     "Value": "YourSecurePassword123!",
>     "Version": 1
>   }
> }
> ```
>
> **성공 확인 포인트:**
> - `Value` 필드에 태스크 3에서 입력한 비밀번호(`YourSecurePassword123!`)가 보이면 됩니다.
> - `aws configure`를 하지 않았는데도 작동하면 IAM Role이 올바르게 설정된 것입니다.

> [!NOTE]
> EC2가 없어서 이 단계를 진행할 수 없는 경우:
> - 이 테스트 단계는 건너뛰어도 됩니다.
> - 핵심 개념만 이해하면 됩니다: "EC2에 IAM Role을 붙이면 Access Key 없이 AWS 서비스에 접근 가능하다"
> - 나중에 EC2를 생성한 후 이 단계로 돌아와서 테스트할 수 있습니다.

> [!TROUBLESHOOTING]
> | 증상 | 원인 | 해결 방법 |
> |------|------|-----------|
> | `Unable to locate credentials` | IAM Role이 EC2에 연결되지 않음 | EC2 콘솔 → 인스턴스 선택 → Actions → Security → Modify IAM role에서 `ec2-starter-role` 선택 후 Update |
> | `AccessDeniedException` on SSM | 정책의 Resource ARN 불일치 | IAM → Policies → `starter-ssm-read-policy` 클릭 → JSON에서 `Resource`가 `"arn:aws:ssm:ap-northeast-2:*:parameter/starter/*"`인지 확인 |
> | `AccessDeniedException` on KMS | KMS 복호화 권한 누락 | 정책 JSON에 `kms:Decrypt` Action이 포함되어 있는지 확인 |
> | Role 변경 후에도 권한 에러 | IAM 전파 지연 (수 초~수 분) | 1~2분 대기 후 재시도. 그래도 안 되면 EC2 콘솔에서 Role이 연결되어 있는지 재확인 |
> | `Could not connect to the endpoint URL` | 리전 설정 오류 또는 네트워크 문제 | `--region ap-northeast-2` 옵션 확인. EC2가 인터넷에 연결되어 있는지 확인 (Public Subnet 또는 NAT Gateway 필요) |

✅ **태스크 완료** — EC2 IAM Role에 Parameter Store 접근 권한을 설정하고 테스트했습니다.

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

### Secrets Manager 간단 예시 (참고)

98. (참고용) Secrets Manager에 비밀을 생성하는 CLI 명령어입니다:

```bash
# Secrets Manager에 비밀 생성
aws secretsmanager create-secret \
  --name "starter/prod/db-credentials" \
  --secret-string '{"username":"admin","password":"MyP@ss123!"}' \
  --region ap-northeast-2
```

99. (참고용) 비밀을 조회하는 CLI 명령어입니다:

```bash
# 비밀 조회
aws secretsmanager get-secret-value \
  --secret-id "starter/prod/db-credentials" \
  --region ap-northeast-2
```

> [!WARNING]
> Secrets Manager는 **유료 서비스**입니다 (비밀당 월 $0.40).
> 위 명령어를 실행하면 비용이 발생합니다. 학습 목적이라면 실행하지 않고 참고만 하세요.
> 실행했다면 반드시 삭제하세요: `aws secretsmanager delete-secret --secret-id "starter/prod/db-credentials" --force-delete-without-recovery`

> [!TIP]
> 학습 단계에서는 **Parameter Store**로 충분합니다. 무료이고 사용법이 간단합니다.
> 프로덕션에서 DB 비밀번호 자동 로테이션이 필요해지면 Secrets Manager를 고려하세요.

✅ **태스크 완료** — Parameter Store와 Secrets Manager의 차이를 이해하고 적절한 선택 기준을 학습했습니다.

---

## 마무리

다음을 성공적으로 수행했습니다:

- 비밀값 하드코딩의 위험성과 안전한 관리 방법을 이해했습니다.
- Parameter Store의 String/SecureString 타입과 계층 구조를 학습했습니다.
- AWS 콘솔에서 4개의 파라미터(String 3개, SecureString 1개)를 생성했습니다.
- AWS CLI로 파라미터를 생성, 조회, 업데이트, 삭제하는 방법을 실습했습니다.
- Spring 프로젝트(Boot/MVC)에서 AWS SDK를 사용하여 Parameter Store 값을 조회하고 DataSource에 활용했습니다.
- EC2 IAM Role을 생성하고 Parameter Store 접근 권한을 설정했습니다.
- Parameter Store와 Secrets Manager의 차이를 이해했습니다.

---

# 🗑️ 리소스 정리

> [!NOTE]
> Parameter Store Standard 파라미터는 10,000개까지 **항상 무료**입니다.
> 학습용 파라미터 몇 개는 유지해도 전혀 비용이 발생하지 않습니다.

### 옵션 A: 리소스 유지 (권장)

Parameter Store Standard 파라미터는 **완전 무료**이므로 유지해도 비용이 발생하지 않습니다.
다음 실습에서 비교 참조용으로 활용할 수 있습니다.

### 옵션 B: 리소스 삭제

더 이상 사용하지 않는다면 아래 순서로 삭제합니다.

> [!WARNING]
> **삭제 순서가 중요합니다 (의존 관계):**
>
> ```
> 생성 순서: 정책 → Role → EC2에 Role 연결 → 파라미터
> 삭제 순서: EC2에서 Role 분리 → Role에서 정책 분리 → 정책 삭제 → 파라미터 삭제 (역순)
> ```
>
> 정책이 Role에 연결된 상태에서는 정책을 삭제할 수 없습니다.
> Role이 EC2에 연결된 상태에서도 Role 삭제가 실패합니다.

---

### 단계 1: EC2에서 IAM Role 분리

1. AWS Management Console 상단 검색창에 `EC2`를 입력하고 선택합니다.
2. 왼쪽 메뉴에서 **Instances**를 클릭합니다.
3. `ec2-starter-role`이 연결된 EC2 인스턴스의 체크박스를 클릭합니다.
4. **Actions** → **Security** → **Modify IAM role**을 선택합니다.
5. **IAM role** 드롭다운에서 `No IAM Role`을 선택합니다 (빈 값 선택).
6. [[Update IAM role]] 버튼을 클릭합니다.

> [!OUTPUT]
> "Successfully detached IAM role from instance" 메시지가 표시됩니다.

> [!NOTE]
> EC2에 Role을 연결하지 않았다면 이 단계는 건너뛰세요.

---

### 단계 2: IAM Role에서 정책 분리

7. AWS Management Console 상단 검색창에 `IAM`을 입력하고 선택합니다.
8. 왼쪽 메뉴에서 **Roles**를 클릭합니다.
9. 검색창에 `ec2-starter-role`을 입력합니다.
10. `ec2-starter-role`을 클릭하여 상세 페이지로 이동합니다.
11. **Permissions** 탭에서 `starter-ssm-read-policy` 오른쪽의 [[Remove]] 버튼을 클릭합니다.
12. 확인 팝업에서 [[Remove policy]] 버튼을 클릭합니다.

> [!OUTPUT]
> Permissions 목록에서 `starter-ssm-read-policy`가 사라집니다.

---

### 단계 3: IAM Role 삭제

13. 왼쪽 메뉴에서 **Roles**를 클릭합니다.
14. 검색창에 `ec2-starter-role`을 입력합니다.
15. `ec2-starter-role` 왼쪽의 라디오 버튼을 클릭합니다.
16. [[Delete]] 버튼을 클릭합니다.
17. 확인 팝업에서 Role 이름 `ec2-starter-role`을 입력합니다.
18. [[Delete]] 버튼을 클릭합니다.

> [!OUTPUT]
> "Role ec2-starter-role deleted" 메시지가 표시됩니다.

---

### 단계 4: IAM 정책 삭제

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

### 단계 5: Parameter Store 파라미터 삭제

**방법 A: 콘솔에서 삭제**

26. AWS Management Console 상단 검색창에 `Systems Manager`를 입력하고 선택합니다.
27. 왼쪽 메뉴에서 **Parameter Store**를 클릭합니다.
28. `/starter/prod/db/url` 왼쪽의 체크박스를 클릭합니다.
29. `/starter/prod/db/username` 왼쪽의 체크박스를 클릭합니다.
30. `/starter/prod/db/password` 왼쪽의 체크박스를 클릭합니다.
31. `/starter/prod/s3/bucket` 왼쪽의 체크박스를 클릭합니다.
32. [[Delete]] 버튼을 클릭합니다.
33. 확인 팝업에서 [[Delete parameters]] 버튼을 클릭합니다.

> [!OUTPUT]
> "Delete parameters request succeeded" 메시지가 표시됩니다.
> Parameter Store 목록에서 4개의 파라미터가 사라집니다.

**방법 B: CLI로 일괄 삭제**

```bash
aws ssm delete-parameters \
  --names "/starter/prod/db/url" \
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
>     "/starter/prod/db/url",
>     "/starter/prod/db/username",
>     "/starter/prod/db/password",
>     "/starter/prod/s3/bucket"
>   ],
>   "InvalidParameters": []
> }
> ```

---

### 단계 6: 삭제 확인

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

> [!TROUBLESHOOTING]
> | 증상 | 원인 | 해결 방법 |
> |------|------|-----------|
> | IAM 정책 삭제 실패 "Cannot delete a policy attached to entities" | 정책이 Role에 연결된 상태 | 단계 2에서 Role에서 정책을 먼저 분리 |
> | IAM Role 삭제 실패 "Cannot delete entity, must detach all policies" | Role에 정책이 남아있음 | Role의 Permissions에서 모든 정책 Remove |
> | IAM Role 삭제 실패 "Role is attached to instance profile" | EC2에 Role이 연결된 상태 | 단계 1에서 EC2에서 Role을 먼저 분리 |
> | Tag Editor에서 리소스가 계속 보임 | 삭제 전파 지연 | 1~2분 대기 후 다시 검색 |

✅ **실습 종료**: 모든 리소스가 정리되었습니다.

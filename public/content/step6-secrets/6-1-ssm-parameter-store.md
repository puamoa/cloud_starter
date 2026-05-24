---
title: 'AWS SSM Parameter Store로 DB 비밀번호 관리'
week: 6
session: 1
awsServices:
  - AWS Systems Manager Parameter Store
learningObjectives:
  - SSM Parameter Store의 String/SecureString 타입 차이를 이해할 수 있습니다.
  - AWS 콘솔과 CLI로 파라미터를 생성할 수 있습니다.
  - Spring Boot에서 Parameter Store 값을 조회하여 사용할 수 있습니다.
  - EC2 IAM Role을 설정하여 Parameter Store에 접근할 수 있습니다.
prerequisites:
  - AWS 계정 생성 완료
estimatedCost: 무료 (Standard 파라미터 10,000개까지 항상 무료)
---

이 실습에서는 데이터베이스 비밀번호, API 키 등 민감한 설정값을 AWS Systems
Manager Parameter Store에 안전하게 저장하고, Spring Boot 애플리케이션에서
조회하여 사용하는 방법을 학습합니다.

> [!NOTE]
> 이 실습은 독립적으로 진행할 수 있습니다. AWS 계정만 있으면 바로 시작할 수
> 있습니다. RDS나 EC2가 없어도 Parameter Store 자체의 사용법을 학습할 수 있습니다.

---

## 태스크 1: 왜 비밀값 관리가 필요한가

### 하드코딩의 위험성

다음과 같이 코드에 비밀번호를 직접 작성하는 것은 심각한 보안 위험입니다:

```java
// ❌ 절대 이렇게 하지 마세요!
spring.datasource.url=jdbc:mysql://my-db.amazonaws.com:3306/mydb
spring.datasource.password=MySecretPassword123!
```

### 실제 사고 사례

- GitHub에 AWS Access Key가 포함된 코드를 push → 수 분 내 해커가 탐지
- 암호화폐 채굴 인스턴스가 대량 생성 → 수백만 원 청구
- AWS는 이를 감지하면 경고 이메일을 보내지만, 이미 피해가 발생한 후일 수 있음

> [!WARNING]
> GitHub에 비밀번호, Access Key, 토큰 등을 커밋하면 **즉시 유출**됩니다.
> GitHub의 공개 리포지토리는 봇이 실시간으로 스캔하고 있습니다.
> 비공개 리포지토리라도 팀원 변경, 포크 등으로 노출될 수 있습니다.

### 올바른 비밀값 관리 방법

| 방법                       | 설명                     | 적합한 환경                   |
| -------------------------- | ------------------------ | ----------------------------- |
| 환경 변수                  | OS 레벨에서 설정         | 로컬 개발, 간단한 배포        |
| `.env` 파일 + `.gitignore` | 파일로 관리하되 Git 제외 | 로컬 개발                     |
| **SSM Parameter Store**    | AWS 관리형 비밀 저장소   | **AWS 환경 (권장)**           |
| Secrets Manager            | 자동 로테이션 지원       | DB 비밀번호 자동 교체 필요 시 |

✅ **태스크 완료** — 비밀값 하드코딩의 위험성과 안전한 관리 방법을 이해했습니다.

---

## 태스크 2: Parameter Store 개념 이해

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
> 대부분의 경우 Standard로 충분합니다.

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
├── dev/
│   ├── db/
│   │   ├── url          → jdbc:mysql://dev-db:3306/mydb
│   │   ├── username     → dev_user
│   │   └── password     → (SecureString) DevP@ss123!
│   └── s3/
│       └── bucket       → myapp-dev-bucket
```

> [!TIP]
> 계층 구조를 사용하면 `GetParametersByPath` API로 특정 경로 하위의 모든
> 파라미터를 한 번에 조회할 수 있습니다. 환경(prod/dev)별로 분리하면
> IAM 정책으로 환경별 접근 제어도 가능합니다.

✅ **태스크 완료** — Parameter Store의 타입과 계층 구조를 이해했습니다.

---

## 태스크 3: 콘솔에서 파라미터 생성

AWS Management Console에서 파라미터를 생성합니다.

### DB URL 파라미터 (String 타입)

1. AWS Management Console에 로그인합니다.
2. 리전을 **Asia Pacific (Seoul) ap-northeast-2**로 설정합니다.
3. 상단 검색창에 `Systems Manager`를 입력하고 선택합니다.
4. 왼쪽 메뉴에서 **Parameter Store**를 클릭합니다.
5. [[Create parameter]]를 클릭합니다.
6. 다음과 같이 설정합니다:
   - **Name**: `/starter/prod/db/url`
   - **Description**: `Production DB JDBC URL`
   - **Tier**: Standard
   - **Type**: **String**
   - **Data type**: text
   - **Value**: `jdbc:mysql://your-rds-endpoint:3306/starter_db`
7. [[Create parameter]]를 클릭합니다.

### DB Password 파라미터 (SecureString 타입)

8. [[Create parameter]]를 다시 클릭합니다.
9. 다음과 같이 설정합니다:
   - **Name**: `/starter/prod/db/password`
   - **Description**: `Production DB password`
   - **Tier**: Standard
   - **Type**: **SecureString**
   - **KMS key source**: My current account
   - **KMS Key ID**: `alias/aws/ssm` (기본 KMS 키)
   - **Value**: `YourSecurePassword123!`
10. [[Create parameter]]를 클릭합니다.

### DB Username 파라미터

11. [[Create parameter]]를 클릭합니다.
12. 설정:
    - **Name**: `/starter/prod/db/username`
    - **Type**: **String**
    - **Value**: `admin`
13. [[Create parameter]]를 클릭합니다.

### S3 Bucket 파라미터

14. [[Create parameter]]를 클릭합니다.
15. 설정:
    - **Name**: `/starter/prod/s3/bucket`
    - **Type**: **String**
    - **Value**: `my-starter-app-123456789012`
16. [[Create parameter]]를 클릭합니다.

> [!OUTPUT]
> Parameter Store 목록에서 생성한 4개의 파라미터를 확인할 수 있습니다:
>
> - `/starter/prod/db/url` (String)
> - `/starter/prod/db/username` (String)
> - `/starter/prod/db/password` (SecureString) — 값이 `****`로 마스킹됨
> - `/starter/prod/s3/bucket` (String)

> [!NOTE]
> SecureString 타입의 파라미터는 콘솔에서도 값이 마스킹되어 표시됩니다.
> **Show** 버튼을 클릭해야 복호화된 값을 확인할 수 있습니다.

✅ **태스크 완료** — 콘솔에서 String과 SecureString 파라미터를 생성했습니다.

---

## 태스크 4: AWS CLI로 파라미터 생성/조회

### 파라미터 생성 (put-parameter)

```bash
# String 타입 파라미터 생성
aws ssm put-parameter \
  --name "/starter/prod/app/port" \
  --type "String" \
  --value "8080" \
  --description "Application port"

# SecureString 타입 파라미터 생성
aws ssm put-parameter \
  --name "/starter/prod/jwt/secret" \
  --type "SecureString" \
  --value "myJwtSecretKey2025!@#$" \
  --description "JWT signing secret key"

# 기존 파라미터 값 업데이트 (--overwrite 필수)
aws ssm put-parameter \
  --name "/starter/prod/db/password" \
  --type "SecureString" \
  --value "NewPassword456!" \
  --overwrite
```

> [!WARNING]
> `--overwrite` 플래그 없이 이미 존재하는 파라미터를 생성하면 에러가 발생합니다.
> 값을 변경할 때는 반드시 `--overwrite`를 추가하세요.

### 파라미터 조회 (get-parameter)

```bash
# 단일 파라미터 조회 (String)
aws ssm get-parameter \
  --name "/starter/prod/db/url"
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
>     "ARN": "arn:aws:ssm:ap-northeast-2:123456789012:parameter/starter/prod/db/url"
>   }
> }
> ```

```bash
# SecureString 조회 (복호화)
aws ssm get-parameter \
  --name "/starter/prod/db/password" \
  --with-decryption
```

> [!NOTE]
> SecureString을 조회할 때 `--with-decryption`을 생략하면 암호화된 값이 반환됩니다.
> 복호화된 평문 값을 얻으려면 반드시 `--with-decryption` 옵션을 추가하세요.

```bash
# 경로 기반 일괄 조회 (GetParametersByPath)
aws ssm get-parameters-by-path \
  --path "/starter/prod/db" \
  --with-decryption \
  --recursive
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

```bash
# 파라미터 삭제
aws ssm delete-parameter \
  --name "/starter/prod/app/port"
```

✅ **태스크 완료** — AWS CLI로 파라미터를 생성, 조회, 삭제하는 방법을 학습했습니다.

---

## 태스크 5: Spring Boot에서 Parameter Store 조회

### 의존성 추가

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

### ParameterStoreService 클래스

```java
package com.example.demo.config;

import jakarta.annotation.PostConstruct;
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

### DataSource 설정에 활용

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
```

> [!TIP]
> 이 방식을 사용하면 `application.yml`에 DB 비밀번호를 작성할 필요가 없습니다.
> 코드를 Git에 push해도 비밀번호가 노출되지 않습니다.

✅ **태스크 완료** — Spring Boot에서 Parameter Store 값을 조회하여 DataSource를 설정했습니다.

---

## 태스크 6: EC2 IAM Role 설정

EC2에서 Parameter Store에 접근하려면 적절한 IAM 권한이 필요합니다.

### IAM 정책 생성

1. IAM 콘솔 → **Policies** → [[Create policy]]를 클릭합니다.
2. **JSON** 탭을 선택하고 아래 정책을 입력합니다:

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

3. [[Next]]를 클릭합니다.
4. **Policy name**: `starter-ssm-read-policy`
5. [[Create policy]]를 클릭합니다.

> [!CONCEPT] 최소 권한 원칙 (Least Privilege)
>
> - `Resource`를 `"arn:aws:ssm:*:*:parameter/*"`로 설정하면 모든 파라미터에 접근 가능합니다.
> - `/starter/*`로 제한하면 해당 경로의 파라미터만 접근할 수 있습니다.
> - `kms:Decrypt`는 SecureString을 복호화하는 데 필요합니다.

### IAM Role에 정책 연결

기존 EC2 IAM Role이 있다면 정책을 추가합니다. 없다면 새로 생성합니다.

**기존 Role에 정책 추가:**

1. IAM → **Roles** → EC2에 연결된 Role을 클릭합니다.
2. **Permissions** 탭에서 [[Add permissions]] → **Attach policies**를 클릭합니다.
3. `starter-ssm-read-policy`를 검색하여 체크합니다.
4. [[Attach policies]]를 클릭합니다.

**새 Role 생성 (EC2에 Role이 없는 경우):**

1. IAM → **Roles** → [[Create role]]을 클릭합니다.
2. Trusted entity: **AWS service** → Use case: **EC2**
3. [[Next]]를 클릭합니다.
4. `starter-ssm-read-policy`를 검색하여 체크합니다.
5. [[Next]]를 클릭합니다.
6. Role name: `ec2-starter-role`
7. [[Create role]]을 클릭합니다.

**EC2에 Role 연결:**

8. EC2 콘솔 → 인스턴스 선택
9. **Actions** → **Security** → **Modify IAM role**
10. `ec2-starter-role` 선택
11. [[Update IAM role]]을 클릭합니다.

### EC2에서 확인

```bash
# EC2에 SSH 접속 후 테스트
aws ssm get-parameter \
  --name "/starter/prod/db/url" \
  --region ap-northeast-2

# SecureString 복호화 테스트
aws ssm get-parameter \
  --name "/starter/prod/db/password" \
  --with-decryption \
  --region ap-northeast-2
```

> [!OUTPUT]
> IAM Role이 정상적으로 설정되었다면 Access Key 없이도 파라미터를 조회할 수 있습니다.
> 권한이 없으면 `AccessDeniedException` 에러가 발생합니다.

✅ **태스크 완료** — EC2 IAM Role에 Parameter Store 접근 권한을 설정했습니다.

---

## 태스크 7: Secrets Manager와 비교

AWS에는 Parameter Store 외에 **Secrets Manager**라는 비밀값 관리 서비스도 있습니다.

### Parameter Store vs Secrets Manager

| 항목             | Parameter Store                 | Secrets Manager                 |
| ---------------- | ------------------------------- | ------------------------------- |
| 비용             | 무료 (Standard)                 | 비밀당 월 $0.40 + API 호출 비용 |
| 자동 로테이션    | ❌ 미지원                       | ✅ Lambda로 자동 교체           |
| 최대 크기        | 4KB (Standard) / 8KB (Advanced) | 64KB                            |
| RDS 통합         | 수동                            | ✅ RDS 비밀번호 자동 로테이션   |
| 크로스 계정 공유 | 제한적                          | ✅ 지원                         |
| 버전 관리        | 제한적                          | ✅ 자동 버전 관리               |

### 언제 무엇을 사용할까?

```
Parameter Store를 사용하는 경우:
├── 비용을 최소화하고 싶을 때
├── 단순한 설정값 (DB URL, 포트, 버킷명 등)
├── 비밀번호를 수동으로 관리해도 괜찮을 때
└── 10,000개 이하의 파라미터

Secrets Manager를 사용하는 경우:
├── DB 비밀번호를 자동으로 주기적 교체해야 할 때
├── RDS와 통합된 비밀번호 로테이션이 필요할 때
├── 크로스 계정 비밀 공유가 필요할 때
└── 비용보다 보안 자동화가 중요할 때
```

> [!TIP]
> 학습 단계에서는 **Parameter Store**로 충분합니다. 무료이고 사용법이 간단합니다.
> 프로덕션에서 DB 비밀번호 자동 로테이션이 필요해지면 Secrets Manager를 고려하세요.

### Secrets Manager 간단 예시 (참고)

```bash
# Secrets Manager에 비밀 생성
aws secretsmanager create-secret \
  --name "starter/prod/db-credentials" \
  --secret-string '{"username":"admin","password":"MyP@ss123!"}'

# 비밀 조회
aws secretsmanager get-secret-value \
  --secret-id "starter/prod/db-credentials"
```

✅ **태스크 완료** — Parameter Store와 Secrets Manager의 차이를 이해하고 적절한 선택 기준을 학습했습니다.

---

# 🗑️ 리소스 정리

> [!NOTE]
> Parameter Store Standard 파라미터는 10,000개까지 항상 무료입니다. 학습용 파라미터 몇 개는 유지해도 전혀 비용이 발생하지 않습니다.

---

### 단계 1: Parameter Store 파라미터 삭제 (선택)

**콘솔에서 삭제:**

1. Systems Manager 콘솔 → **Parameter Store**
2. 삭제할 파라미터를 선택합니다 (체크박스).
3. [[Delete]]를 클릭합니다.
4. 확인 대화상자에서 [[Delete parameters]]를 클릭합니다.

**CLI로 일괄 삭제:**

```bash
aws ssm delete-parameters \
  --names "/starter/prod/db/url" "/starter/prod/db/username" \
          "/starter/prod/db/password" "/starter/prod/s3/bucket" \
  --region ap-northeast-2
```

---

### 단계 2: IAM 정책 분리 및 삭제 (선택)

EC2 Role에서 Parameter Store 접근 정책을 분리합니다.

1. IAM 콘솔 → **Roles** → EC2에 연결된 Role 선택
2. **Permissions** 탭에서 `starter-ssm-read-policy` 옆의 [[Remove]] 클릭 → 확인
3. IAM 콘솔 → **Policies** → `starter-ssm-read-policy` 선택 → **Actions** → [[Delete]] → 확인

> [!NOTE]
> 정책이 다른 Role에도 연결되어 있다면 먼저 모든 Role에서 분리(Detach)해야 삭제할 수 있습니다.

---

### 단계 3: 삭제 확인

1. Parameter Store에서 `/starter/prod/` 경로의 파라미터가 없는지 확인합니다.
2. IAM Policies에서 `starter-ssm-read-policy`가 없는지 확인합니다.

✅ **실습 종료**: 모든 리소스가 정리되었습니다.

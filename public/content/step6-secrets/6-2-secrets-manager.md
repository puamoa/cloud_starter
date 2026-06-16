---
title: 'AWS Secrets Manager로 자동 로테이션 설정'
week: 6
session: 2
awsServices:
  - AWS Secrets Manager
learningObjectives:
  - Secrets Manager에 비밀을 생성하고 조회할 수 있습니다.
  - Parameter Store와 Secrets Manager의 차이를 비교할 수 있습니다.
  - RDS 비밀번호 자동 로테이션을 설정할 수 있습니다.
  - Spring 프로젝트(Boot/MVC)에서 Secrets Manager 값을 조회하여 사용할 수 있습니다.
prerequisites:
  - AWS 계정 생성 완료
  - RDS MySQL 인스턴스 (자동 로테이션 실습 시 필요, 선택)
estimatedCost: 크레딧 내 사용 가능 (비밀당 월 $0.40 + API 호출 비용)
---

이 실습에서는 AWS Secrets Manager를 사용하여 비밀값을 관리합니다. Parameter Store와의 차이를 이해하고, RDS 비밀번호 자동 로테이션을 설정하는 방법을 학습합니다.

> [!NOTE]
> 이 실습은 독립적으로 진행할 수 있습니다. 자동 로테이션 실습(태스크 5)은 RDS 인스턴스가 필요하지만, 나머지 태스크는 AWS 계정만 있으면 진행 가능합니다.

> [!WARNING]
> Secrets Manager는 비밀당 월 $0.40이 과금됩니다 (크레딧에서 차감). 실습 후 불필요한 비밀은 삭제하세요.
>
> | 리소스              | 비용             | 비고                         |
> | ------------------- | ---------------- | ---------------------------- |
> | 비밀 저장           | 비밀당 월 $0.40  | 삭제 대기 기간(7일)에도 과금 |
> | API 호출            | 10,000건당 $0.05 | 학습 수준에서는 무시 가능    |
> | Lambda (로테이션용) | 무료 티어 내     | 월 100만 요청 무료           |
>
> 비밀 3개 생성 시 월 약 $1.20 발생합니다.

---

## 태스크 1: Secrets Manager vs Parameter Store 비교

> [!CONCEPT] 언제 무엇을 사용할까?
>
> ```
> ┌─────────────────────────────────────────────────────────────┐
> │           비밀 관리 서비스 선택 기준                         │
> │                                                             │
> │  "DB 비밀번호를 자동으로 교체해야 하나요?"                  │
> │       │                                                     │
> │       ├── YES → Secrets Manager                             │
> │       │         • 자동 로테이션 (Lambda 기반)               │
> │       │         • RDS 네이티브 통합                         │
> │       │         • 비밀당 월 $0.40                           │
> │       │                                                     │
> │       └── NO → Parameter Store (SecureString)               │
> │                • 무료 (Standard 티어)                       │
> │                • 수동 관리                                  │
> │                • 단순 설정값에 적합                         │
> └─────────────────────────────────────────────────────────────┘
> ```
>
> | 항목             | Parameter Store | Secrets Manager               |
> | ---------------- | --------------- | ----------------------------- |
> | 비용             | 무료 (Standard) | 비밀당 월 $0.40               |
> | 자동 로테이션    | ❌ 미지원       | ✅ Lambda로 자동 교체         |
> | RDS 통합         | 수동            | ✅ RDS 비밀번호 자동 로테이션 |
> | 최대 크기        | 4KB (Standard)  | 64KB                          |
> | 버전 관리        | 제한적          | ✅ 자동 버전 관리             |
> | 크로스 계정 공유 | 제한적          | ✅ 지원                       |
>
> **결론:**
>
> - 단순 설정값, 비용 최소화 → **Parameter Store**
> - DB 비밀번호 자동 교체, 보안 감사 필요 → **Secrets Manager**

✅ **태스크 완료**: 두 서비스의 차이를 이해했습니다.

---

## 태스크 2: Secrets Manager에 비밀 생성 (콘솔)

> [!CONCEPT] Secrets Manager의 비밀 구조
>
> ```
> ┌─────────────────────────────────────────────────────────┐
> │              Secrets Manager 비밀 구조                    │
> │                                                         │
> │  Secret Name: starter/prod/db-credentials               │
> │       │                                                 │
> │       ├── Version: AWSCURRENT (현재 활성 버전)          │
> │       │   └── SecretString (JSON):                      │
> │       │       {                                         │
> │       │         "username": "admin",                    │
> │       │         "password": "MySecretPass123!",         │
> │       │         "host": "my-rds.xxx.rds.amazonaws.com", │
> │       │         "port": "3306",                         │
> │       │         "dbname": "appdb"                       │
> │       │       }                                         │
> │       │                                                 │
> │       ├── Version: AWSPREVIOUS (이전 버전, 롤백용)      │
> │       │   └── SecretString: {...이전 값...}             │
> │       │                                                 │
> │       └── Metadata:                                     │
> │           ├── ARN (고유 식별자)                         │
> │           ├── KMS Key (암호화 키)                       │
> │           ├── Rotation Config                           │
> │           └── Tags                                      │
> └─────────────────────────────────────────────────────────┘
> ```
>
> - **SecretString**: JSON 형태로 여러 키-값 쌍을 하나의 비밀에 저장
> - **버전 관리**: 업데이트 시 자동으로 이전 버전 보관
> - **KMS 암호화**: 저장 시 자동 암호화, 조회 시 자동 복호화

### Secrets Manager 콘솔 이동

1. AWS Management Console에 로그인합니다.
2. 우측 상단에서 리전을 **Asia Pacific (Seoul) ap-northeast-2**로 설정합니다.

    <img src="/images/common/region-check.png" alt="리전 확인" class="guide-img-sm" />

> [!TIP]
> 일부 AWS 서비스(IAM, CloudFront, Route 53 등)는 **글로벌 서비스**이므로 리전 선택 드롭다운이 비활성화되거나 "Global"로 표시됩니다.  
> 이 실습에서 사용하는 서비스는 리전 기반이므로 반드시 올바른 리전이 선택되어 있는지 확인하세요.

3. 상단 검색창에 `Secrets Manager`를 입력합니다.
4. 검색 결과에서 **Secrets Manager** 서비스를 클릭합니다.

> [!OUTPUT]
> Secrets Manager 대시보드가 표시됩니다. 아직 비밀이 없으면 "You don't have any secrets" 메시지가 보입니다.

### 새 비밀 생성

5. [[Store a new secret]] 버튼을 클릭합니다.
6. **Secret type** 섹션에서 **Other type of secret**을 선택합니다.

> [!TIP]
> Secret type 옵션 설명:
>
> | Secret type                         | 용도                               |
> | ----------------------------------- | ---------------------------------- |
> | Credentials for Amazon RDS database | RDS 자격 증명 (자동 로테이션 지원) |
> | Credentials for other database      | RDS 외 DB (Redshift 등)            |
> | **Other type of secret**            | 범용 키-값 쌍 (API 키, 토큰 등)    |
>
> 이 태스크에서는 범용 비밀을 생성하므로 **Other type of secret**을 선택합니다.

7. **Key/value pairs** 섹션에서 [[+ Add row]] 버튼을 클릭하여 다음 5개 키-값 쌍을 추가합니다:

| Key        | Value                                                |
| ---------- | ---------------------------------------------------- |
| `username` | `admin`                                              |
| `password` | `MySecretPass123!`                                   |
| `host`     | `my-rds-mysql.xxxx.ap-northeast-2.rds.amazonaws.com` |
| `port`     | `3306`                                               |
| `dbname`   | `appdb`                                              |

> [!WARNING]
> 첫 번째 행은 이미 표시되어 있습니다. [[+ Add row]]를 4번 클릭하여 총 5개 행을 만든 후 각각 입력하세요.
> Key와 Value를 정확히 입력해야 나중에 코드에서 조회할 때 오류가 발생하지 않습니다.

8. **Encryption key** 드롭다운에서 `aws/secretsmanager` (기본 AWS 관리형 키)를 유지합니다.
9. [[Next]] 버튼을 클릭합니다.

### 비밀 이름 및 설명 설정

10. **Secret name** 필드에 `starter/prod/db-credentials`를 입력합니다.

> [!TIP]
> 비밀 이름에 `/`를 사용하면 계층 구조로 관리할 수 있습니다.
> 예: `{프로젝트}/{환경}/{용도}` → `starter/prod/db-credentials`
>
> 이렇게 하면 나중에 `starter/prod/*` 패턴으로 프로덕션 비밀만 필터링할 수 있습니다.

11. **Description** 필드에 `Production database credentials`를 입력합니다.
12. **Tags** 섹션에서 [[Add tag]] 버튼을 클릭합니다.
13. 다음 태그를 추가합니다:

| Key         | Value        |
| ----------- | ------------ |
| `CreatedBy` | `admin-user` |
| `Step`      | `step6`      |
| `Session`   | `6-2`        |

14. [[Next]] 버튼을 클릭합니다.

### 로테이션 설정 (건너뛰기)

15. **Configure rotation** 페이지에서 **Disable automatic rotation**이 선택된 상태를 유지합니다.

> [!NOTE]
> 자동 로테이션은 태스크 5에서 별도로 설정합니다. 먼저 기본 사용법을 익힙니다.

16. [[Next]] 버튼을 클릭합니다.

### 검토 및 생성

17. **Review** 페이지에서 다음을 확인합니다:
    - Secret name: `starter/prod/db-credentials`
    - Secret type: Other type of secret
    - Encryption key: `aws/secretsmanager`
    - Rotation: Disabled
18. [[Store]] 버튼을 클릭합니다.

> [!OUTPUT]
> "Secret starter/prod/db-credentials successfully stored." 메시지가 표시됩니다.
> 비밀 상세 페이지로 자동 이동합니다.

### 저장된 비밀 값 확인

19. 비밀 상세 페이지에서 **Secret value** 섹션으로 스크롤합니다.
20. [[Retrieve secret value]] 버튼을 클릭합니다.

> [!OUTPUT]
> 저장된 키-값 쌍이 테이블 형태로 표시됩니다:
>
> | Secret key | Secret value                                       |
> | ---------- | -------------------------------------------------- |
> | username   | admin                                              |
> | password   | MySecretPass123!                                   |
> | host       | my-rds-mysql.xxxx.ap-northeast-2.rds.amazonaws.com |
> | port       | 3306                                               |
> | dbname     | appdb                                              |

> [!TIP]
> **Plaintext** 탭을 클릭하면 JSON 형태로도 확인할 수 있습니다:
>
> ```json
> {
>   "username": "admin",
>   "password": "MySecretPass123!",
>   "host": "my-rds-mysql.xxxx.ap-northeast-2.rds.amazonaws.com",
>   "port": "3306",
>   "dbname": "appdb"
> }
> ```

✅ **태스크 완료**: Secrets Manager에 DB 자격 증명을 저장했습니다.

---

## 태스크 3: AWS CLI로 비밀 생성/조회

### 새 비밀 생성 (CLI)

21. 터미널을 열고 다음 명령어를 실행합니다:

```bash
aws secretsmanager create-secret \
  --name "starter/prod/api-keys" \
  --description "External API keys" \
  --secret-string '{"payment_api_key":"pk_live_abc123","notification_key":"nk_xyz789"}' \
  --region ap-northeast-2
```

> [!OUTPUT]
>
> ```json
> {
>   "ARN": "arn:aws:secretsmanager:ap-northeast-2:123456789012:secret:starter/prod/api-keys-AbCdEf",
>   "Name": "starter/prod/api-keys",
>   "VersionId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
> }
> ```

> [!TIP]
> `--secret-string`에 JSON을 전달할 때 작은따옴표(`'`)로 감싸면 쉘에서 큰따옴표를 이스케이프하지 않아도 됩니다.
> Windows CMD에서는 큰따옴표를 `\"`로 이스케이프해야 합니다.

### 비밀 조회

22. 태스크 2에서 콘솔로 생성한 비밀을 CLI로 조회합니다:

```bash
aws secretsmanager get-secret-value \
  --secret-id "starter/prod/db-credentials" \
  --region ap-northeast-2
```

> [!OUTPUT]
>
> ```json
> {
>   "ARN": "arn:aws:secretsmanager:ap-northeast-2:123456789012:secret:starter/prod/db-credentials-XyZaBc",
>   "Name": "starter/prod/db-credentials",
>   "VersionId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
>   "SecretString": "{\"username\":\"admin\",\"password\":\"MySecretPass123!\",\"host\":\"my-rds-mysql.xxxx.ap-northeast-2.rds.amazonaws.com\",\"port\":\"3306\",\"dbname\":\"appdb\"}",
>   "VersionStages": ["AWSCURRENT"],
>   "CreatedDate": "2025-01-15T10:30:00+09:00"
> }
> ```

23. JSON에서 특정 값만 추출하려면 `--query` 옵션을 사용합니다:

```bash
aws secretsmanager get-secret-value \
  --secret-id "starter/prod/db-credentials" \
  --query "SecretString" \
  --output text \
  --region ap-northeast-2
```

> [!OUTPUT]
>
> ```
> {"username":"admin","password":"MySecretPass123!","host":"my-rds-mysql.xxxx.ap-northeast-2.rds.amazonaws.com","port":"3306","dbname":"appdb"}
> ```

### 비밀 값 업데이트

24. 비밀번호를 변경합니다:

```bash
aws secretsmanager update-secret \
  --secret-id "starter/prod/db-credentials" \
  --secret-string '{"username":"admin","password":"NewPassword456!","host":"my-rds-mysql.xxxx.ap-northeast-2.rds.amazonaws.com","port":"3306","dbname":"appdb"}' \
  --region ap-northeast-2
```

> [!OUTPUT]
>
> ```json
> {
>   "ARN": "arn:aws:secretsmanager:ap-northeast-2:123456789012:secret:starter/prod/db-credentials-XyZaBc",
>   "Name": "starter/prod/db-credentials",
>   "VersionId": "yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy"
> }
> ```

> [!NOTE]
> 비밀을 업데이트하면 새 버전이 자동으로 생성됩니다. 이전 버전은 `AWSPREVIOUS` 스테이지로 유지되어 필요 시 롤백할 수 있습니다.

### 비밀 목록 조회

25. 현재 계정의 모든 비밀을 조회합니다:

```bash
aws secretsmanager list-secrets \
  --query "SecretList[?starts_with(Name, 'starter/')].[Name,CreatedDate]" \
  --output table \
  --region ap-northeast-2
```

> [!OUTPUT]
>
> ```
> -----------------------------------------------------------
> |                       ListSecrets                        |
> +----------------------------------+----------------------+
> |  starter/prod/api-keys           |  2025-01-15T10:35:00 |
> |  starter/prod/db-credentials     |  2025-01-15T10:30:00 |
> +----------------------------------+----------------------+
> ```

✅ **태스크 완료**: CLI로 비밀을 생성, 조회, 업데이트했습니다.

> [!TROUBLESHOOTING]
> | 증상 | 원인 | 해결 방법 |
> |------|------|-----------|
> | `ResourceNotFoundException` | 비밀 이름(secret-id) 오타 | `aws secretsmanager list-secrets`로 정확한 이름 확인 |
> | `InvalidRequestException` | JSON 형식 오류 | `--secret-string`의 JSON 유효성 검사 (따옴표 이스케이프 확인) |
> | `AccessDeniedException` | IAM 권한 부족 | `secretsmanager:GetSecretValue` 권한 확인 |
> | 업데이트 후 이전 값 반환 | 캐시 또는 버전 문제 | `--version-stage AWSCURRENT` 명시하여 조회 |

---

## 태스크 4: Spring에서 Secrets Manager 조회

> [!CONCEPT] Spring + Secrets Manager 연동 흐름
>
> ```
> ┌─────────────────────────────────────────────────────────────┐
> │         Spring ↔ Secrets Manager 연동                        │
> │                                                             │
> │  [애플리케이션 시작]                                        │
> │       │                                                     │
> │       ▼                                                     │
> │  SecretsManagerService (@PostConstruct)                     │
> │       │                                                     │
> │       ▼  GetSecretValue API 호출                            │
> │  AWS Secrets Manager                                        │
> │       │                                                     │
> │       ▼  SecretString (JSON) 반환                           │
> │  JSON 파싱 → dbHost, dbPort, dbName, username, password     │
> │       │                                                     │
> │       ▼                                                     │
> │  DataSource Bean 생성 (HikariCP)                            │
> │       │                                                     │
> │       ▼                                                     │
> │  jdbc:mysql://host:port/dbname 으로 RDS 연결                │
> └─────────────────────────────────────────────────────────────┘
> ```
>
> **장점**: application.yml/properties에 비밀번호를 하드코딩하지 않아도 됩니다.
> **주의**: EC2/ECS에 적절한 IAM Role이 있어야 Secrets Manager API를 호출할 수 있습니다.

### 의존성 추가

**방법 A: Spring Boot 프로젝트**

26. `build.gradle` 파일에 AWS SDK 의존성을 추가합니다:

```groovy
// build.gradle
dependencyManagement {
    imports {
        mavenBom "software.amazon.awssdk:bom:2.25.60"
    }
}

dependencies {
    implementation 'software.amazon.awssdk:secretsmanager'
}
```

**방법 B: 기존 Spring MVC 프로젝트**

26. `build.gradle` 파일에 AWS SDK 의존성을 추가합니다:

```groovy
dependencies {
    // 기존 의존성들...

    // AWS SDK v2 - Secrets Manager
    implementation platform('software.amazon.awssdk:bom:2.25.60')
    implementation 'software.amazon.awssdk:secretsmanager'
}
```

> [!TIP]
> BOM을 사용하면 AWS SDK 모듈 간 버전 충돌을 방지할 수 있습니다.
> 개별 모듈에 버전을 명시하지 않아도 BOM에서 호환되는 버전을 자동으로 관리합니다.

27. Gradle을 새로고침합니다:

```bash
./gradlew dependencies --configuration compileClasspath | grep secretsmanager
```

> [!OUTPUT]
>
> ```
> +--- software.amazon.awssdk:secretsmanager -> 2.25.60
> ```

### SecretsManagerService 클래스 작성

28. `src/main/java/com/example/demo/config/` 디렉토리에 `SecretsManagerService.java` 파일을 생성합니다:

```java
package com.example.demo.config;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.secretsmanager.SecretsManagerClient;
import software.amazon.awssdk.services.secretsmanager.model.GetSecretValueRequest;
import software.amazon.awssdk.services.secretsmanager.model.GetSecretValueResponse;

@Slf4j
@Component
public class SecretsManagerService {

    private final SecretsManagerClient client;
    private final ObjectMapper objectMapper = new ObjectMapper();

    private String dbHost;
    private String dbPort;
    private String dbName;
    private String dbUsername;
    private String dbPassword;

    public SecretsManagerService() {
        this.client = SecretsManagerClient.builder()
                .region(Region.AP_NORTHEAST_2)
                .build();
    }

    @PostConstruct
    public void loadSecrets() {
        try {
            GetSecretValueResponse response = client.getSecretValue(
                    GetSecretValueRequest.builder()
                            .secretId("starter/prod/db-credentials")
                            .build()
            );

            JsonNode secret = objectMapper.readTree(response.secretString());
            this.dbHost = secret.get("host").asText();
            this.dbPort = secret.get("port").asText();
            this.dbName = secret.get("dbname").asText();
            this.dbUsername = secret.get("username").asText();
            this.dbPassword = secret.get("password").asText();

            log.info("Secrets Manager에서 DB 자격 증명 로드 완료");
        } catch (Exception e) {
            log.error("Secrets Manager 조회 실패", e);
            throw new RuntimeException("Failed to load secrets", e);
        }
    }

    public String getJdbcUrl() {
        return String.format("jdbc:mysql://%s:%s/%s", dbHost, dbPort, dbName);
    }

    public String getDbUsername() { return dbUsername; }
    public String getDbPassword() { return dbPassword; }
}
```

> [!WARNING]
> `secretId("starter/prod/db-credentials")` 부분을 태스크 2에서 생성한 비밀 이름과 정확히 일치시키세요.
> 대소문자와 슬래시(`/`)를 포함하여 정확히 입력해야 합니다.

### DataSource 설정 클래스 작성

29. 같은 디렉토리에 `DataSourceConfig.java` 파일을 생성합니다:

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

    private final SecretsManagerService secretsManager;

    @Bean
    public DataSource dataSource() {
        HikariDataSource ds = new HikariDataSource();
        ds.setJdbcUrl(secretsManager.getJdbcUrl());
        ds.setUsername(secretsManager.getDbUsername());
        ds.setPassword(secretsManager.getDbPassword());
        ds.setDriverClassName("com.mysql.cj.jdbc.Driver");
        return ds;
    }
}
```

30. `application.yml`에서 기존 DB 설정을 제거합니다 (Secrets Manager가 대체):

```yaml
# application.yml
# 아래 설정은 더 이상 필요하지 않습니다 (Secrets Manager에서 조회)
# spring:
#   datasource:
#     url: jdbc:mysql://...
#     username: admin
#     password: MySecretPass123!
```

> [!TIP]
> 자동 로테이션이 설정된 경우, 비밀번호가 변경되면 애플리케이션을 재시작해야 새 비밀번호를 가져옵니다.
> 이를 자동화하려면:
>
> 1. 커넥션 풀 갱신 로직 추가 (HikariCP의 `setPassword()` 호출)
> 2. 또는 Spring Cloud AWS의 `SecretsManagerPropertySource` 사용 (자동 갱신 지원)

### 동작 확인

31. 애플리케이션을 빌드합니다:

```bash
./gradlew build
```

32. 애플리케이션을 실행합니다:

```bash
java -jar build/libs/demo-0.0.1-SNAPSHOT.jar
```

> [!OUTPUT]
> 정상 시작 시 로그에 다음이 표시됩니다:
>
> ```
> INFO  c.e.d.config.SecretsManagerService - Secrets Manager에서 DB 자격 증명 로드 완료
> INFO  o.s.b.w.embedded.tomcat.TomcatWebServer - Tomcat started on port 8080
> ```

> [!NOTE]
> 로컬에서 실행할 때는 AWS CLI 자격 증명(`~/.aws/credentials`)이 설정되어 있어야 합니다.
> EC2에서 실행할 때는 인스턴스에 연결된 IAM Role에 `secretsmanager:GetSecretValue` 권한이 필요합니다.

✅ **태스크 완료**: Spring에서 Secrets Manager 값을 조회하여 DataSource를 설정했습니다.

---

## 태스크 5: RDS 비밀번호 자동 로테이션 설정 (선택)

> [!NOTE]
> 이 태스크는 RDS MySQL 인스턴스가 필요합니다. Step 4-1에서 생성한 RDS를 사용하거나, 이 태스크를 건너뛸 수 있습니다.

> [!CONCEPT] 자동 로테이션 동작 원리
>
> ```
> ┌─────────────────────────────────────────────────────────────┐
> │              자동 로테이션 흐름 (30일 주기)                   │
> │                                                             │
> │  [Day 0] 로테이션 트리거                                    │
> │       │                                                     │
> │       ▼                                                     │
> │  Secrets Manager → Lambda 함수 호출                         │
> │       │                                                     │
> │       ▼  4단계 로테이션 프로세스                            │
> │  ┌─────────────────────────────────────────────┐            │
> │  │ 1. createSecret: 새 비밀번호 생성           │            │
> │  │ 2. setSecret: RDS에 새 비밀번호 적용        │            │
> │  │ 3. testSecret: 새 비밀번호로 접속 테스트    │            │
> │  │ 4. finishSecret: AWSCURRENT 스테이지 이동   │            │
> │  └─────────────────────────────────────────────┘            │
> │       │                                                     │
> │       ▼                                                     │
> │  결과:                                                      │
> │  • AWSCURRENT → 새 비밀번호                                │
> │  • AWSPREVIOUS → 이전 비밀번호 (일정 기간 유효)            │
> │                                                             │
> │  [Day 30] 다음 로테이션 자동 실행...                        │
> └─────────────────────────────────────────────────────────────┘
> ```

### RDS용 비밀 생성

33. Secrets Manager 콘솔로 이동합니다 (상단 검색창에 `Secrets Manager` 입력).
34. [[Store a new secret]] 버튼을 클릭합니다.
35. **Secret type** 섹션에서 **Credentials for Amazon RDS database**를 선택합니다.

> [!TIP]
> **Credentials for Amazon RDS database**를 선택하면 Secrets Manager가 RDS와 직접 통합됩니다.
> 자동 로테이션 시 Lambda가 RDS에 직접 접속하여 비밀번호를 변경할 수 있습니다.

36. **Credentials** 섹션에서 다음을 입력합니다:
    - **User name**: `admin`
    - **Password**: RDS 생성 시 설정한 마스터 비밀번호
37. **Encryption key**: `aws/secretsmanager` (기본값) 유지합니다.
38. **Database** 섹션에서 목록에 표시된 `my-rds-mysql` 인스턴스를 선택합니다.

> [!WARNING]
> Database 목록에 RDS 인스턴스가 표시되지 않으면:
>
> - RDS 인스턴스가 같은 리전(ap-northeast-2)에 있는지 확인하세요.
> - RDS 인스턴스가 `Available` 상태인지 확인하세요.
> - IAM 사용자에 `rds:DescribeDBInstances` 권한이 있는지 확인하세요.

39. [[Next]] 버튼을 클릭합니다.
40. **Secret name** 필드에 `starter/prod/rds-auto-rotate`를 입력합니다.
41. **Description** 필드에 `RDS MySQL auto-rotation credentials`를 입력합니다.
42. **Tags** 섹션에서 [[Add tag]]를 클릭하고 다음을 추가합니다:

| Key         | Value        |
| ----------- | ------------ |
| `CreatedBy` | `admin-user` |
| `Step`      | `step6`      |
| `Session`   | `6-2`        |

43. [[Next]] 버튼을 클릭합니다.

### 자동 로테이션 활성화

44. **Configure rotation** 페이지에서 **Turn on automatic rotation** 토글을 활성화합니다.
45. **Rotation schedule** 섹션에서 다음을 설정합니다:
    - **Schedule expression type**: `Days` 선택
    - **Days**: `30` 입력
46. **Rotation function** 섹션에서:
    - **Create a new Lambda function** 선택
    - **Lambda function name**: `SecretsManagerRDSRotation` 입력
47. **Use separate credentials to rotate this secret**: `No` 선택

> [!NOTE]
> "Use separate credentials"를 No로 설정하면 비밀에 저장된 자격 증명 자체로 비밀번호를 변경합니다.
> 이 방식은 단일 사용자 로테이션(single-user rotation)이라고 합니다.
>
> Yes를 선택하면 별도의 관리자 자격 증명으로 비밀번호를 변경합니다 (multi-user rotation).
> 프로덕션에서는 multi-user rotation이 더 안전합니다.

48. [[Next]] 버튼을 클릭합니다.
49. **Review** 페이지에서 설정을 확인합니다.
50. [[Store]] 버튼을 클릭합니다.

> [!OUTPUT]
> 비밀이 생성되고, AWS가 자동으로:
>
> - Lambda 함수 (`SecretsManagerRDSRotation`)를 생성합니다.
> - Lambda에 필요한 IAM Role과 정책을 연결합니다.
> - Lambda를 VPC에 배치합니다 (RDS 접근을 위해).
> - 첫 번째 로테이션을 즉시 실행합니다.

> [!WARNING]
> 첫 번째 로테이션이 즉시 실행됩니다. 이 시점에서 RDS 비밀번호가 변경됩니다.
> 기존 애플리케이션이 하드코딩된 비밀번호를 사용하고 있다면 접속이 끊길 수 있습니다.
> 반드시 태스크 4의 Secrets Manager 연동을 먼저 적용한 후 로테이션을 설정하세요.

### 로테이션 결과 확인

51. 비밀 상세 페이지에서 **Rotation configuration** 섹션을 확인합니다.
52. **Rotation status**가 `Enabled`로 표시되는지 확인합니다.
53. **Last rotated date**에 날짜/시간이 표시되면 첫 번째 로테이션이 완료된 것입니다.

> [!NOTE]
> 첫 번째 로테이션 완료까지 1~2분 소요될 수 있습니다. 페이지를 새로고침하여 확인하세요.

54. **Secret value** 섹션에서 [[Retrieve secret value]]를 클릭합니다.
55. `password` 값이 이전과 다른 자동 생성된 비밀번호로 변경되었는지 확인합니다.

> [!OUTPUT]
> password 값이 자동 생성된 복잡한 문자열로 변경되어 있습니다.
> 예: `aB3$kL9mNp2!xYz7`
> 이 비밀번호는 Lambda가 자동으로 생성하고 RDS에 적용한 것입니다.

✅ **태스크 완료**: RDS 비밀번호 자동 로테이션이 설정되었습니다.

> [!TROUBLESHOOTING]
> | 증상 | 원인 | 해결 방법 |
> |------|------|-----------|
> | 로테이션 실패 (Lambda 에러) | Lambda가 RDS에 접근 불가 | Lambda의 VPC 설정 및 Security Group 확인 |
> | `Rotation failed` 상태 | RDS 엔드포인트 변경 또는 네트워크 문제 | CloudWatch Logs에서 Lambda 로그 확인 (`/aws/lambda/SecretsManagerRDSRotation`) |
> | 앱 접속 끊김 | 로테이션 후 앱이 이전 비밀번호 사용 | 앱에서 Secrets Manager 재조회 로직 추가 또는 재시작 |
> | Lambda 함수 생성 실패 | VPC 서브넷에 NAT 없음 | Lambda가 Secrets Manager API 호출 가능하도록 NAT Gateway 또는 VPC Endpoint 설정 |
> | Database 목록에 RDS 미표시 | 다른 리전 또는 권한 부족 | 리전 확인 + `rds:DescribeDBInstances` 권한 확인 |

---

## 마무리

다음을 성공적으로 수행했습니다:

- Secrets Manager와 Parameter Store의 차이를 비교했습니다.
- Secrets Manager에 DB 자격 증명을 콘솔에서 저장하고 조회했습니다.
- AWS CLI로 비밀을 생성, 조회, 업데이트했습니다.
- Spring 프로젝트(Boot/MVC)에서 Secrets Manager 값을 조회하여 DataSource를 설정했습니다.
- RDS 비밀번호 자동 로테이션을 설정했습니다 (선택).

---

# 🗑️ 리소스 정리

> [!WARNING]
> Secrets Manager는 비밀당 월 $0.40이 과금됩니다. 실습 후 불필요한 비밀은 반드시 삭제하세요.
>
> | 리소스                         | 월 비용        | 삭제 방법          |
> | ------------------------------ | -------------- | ------------------ |
> | `starter/prod/db-credentials`  | $0.40          | CLI 즉시 삭제 권장 |
> | `starter/prod/api-keys`        | $0.40          | CLI 즉시 삭제 권장 |
> | `starter/prod/rds-auto-rotate` | $0.40          | CLI 즉시 삭제 권장 |
> | Lambda (로테이션용)            | $0 (무료 티어) | 콘솔에서 삭제      |
>
> 삭제하지 않으면 월 최대 **$1.20** 과금됩니다.

> [!NOTE]
> 삭제 순서 (의존 관계):
>
> ```
> 삭제 순서: Secrets → Lambda → IAM Role
>
> Secrets Manager 비밀 ──참조──→ Lambda (로테이션)
>         │                           │
>         │ 먼저 삭제                  │ 나중에 삭제
>         ▼                           ▼
>   (1) 비밀 즉시 삭제          (2) Lambda 삭제
>                                (3) IAM Role 삭제
> ```
>
> 콘솔 삭제는 7일 대기 기간이 있어 그 동안에도 과금됩니다. **CLI 즉시 삭제를 권장합니다.**

---

### 단계 1: CLI로 비밀 즉시 삭제 (권장)

복구 기간 없이 즉시 삭제하여 과금을 즉시 중단합니다.

56. 터미널에서 다음 명령어를 실행합니다:

```bash
aws secretsmanager delete-secret \
  --secret-id "starter/prod/db-credentials" \
  --force-delete-without-recovery \
  --region ap-northeast-2
```

> [!OUTPUT]
>
> ```json
> {
>   "ARN": "arn:aws:secretsmanager:ap-northeast-2:123456789012:secret:starter/prod/db-credentials-XyZaBc",
>   "Name": "starter/prod/db-credentials",
>   "DeletionDate": "2025-01-15T10:50:00+09:00"
> }
> ```

57. 두 번째 비밀을 삭제합니다:

```bash
aws secretsmanager delete-secret \
  --secret-id "starter/prod/api-keys" \
  --force-delete-without-recovery \
  --region ap-northeast-2
```

58. 태스크 5를 진행한 경우, 세 번째 비밀도 삭제합니다:

```bash
aws secretsmanager delete-secret \
  --secret-id "starter/prod/rds-auto-rotate" \
  --force-delete-without-recovery \
  --region ap-northeast-2
```

> [!WARNING]
> `--force-delete-without-recovery` 옵션을 사용하면 **되돌릴 수 없습니다**.
> 삭제 전에 비밀 값이 다른 곳에 백업되어 있는지 확인하세요.
> 실습용 비밀이므로 즉시 삭제해도 문제없습니다.

---

### 단계 2: 콘솔에서 비밀 삭제 (대안)

CLI를 사용하지 않는 경우 콘솔에서 삭제합니다. 단, 최소 7일의 복구 기간이 있으며 그 동안에도 과금됩니다.

59. Secrets Manager 콘솔에서 삭제할 비밀을 클릭하여 상세 페이지로 이동합니다.
60. 우측 상단의 **Actions** 드롭다운을 클릭합니다.
61. [[Delete secret]]을 선택합니다.
62. **Waiting period** 필드에 `7` (최소 대기 기간)을 입력합니다.
63. [[Schedule deletion]] 버튼을 클릭합니다.

> [!OUTPUT]
> 비밀 상태가 "Scheduled for deletion" 으로 변경됩니다.
> 7일 후 자동으로 영구 삭제됩니다.

64. 나머지 비밀들도 동일하게 삭제를 예약합니다.

---

### 단계 3: Lambda 로테이션 함수 삭제 (태스크 5 진행한 경우)

65. 상단 검색창에 `Lambda`를 입력하고 **Lambda** 서비스를 선택합니다.
66. Functions 목록에서 `SecretsManagerRDSRotation` 함수를 클릭합니다.
67. 우측 상단의 **Actions** 드롭다운을 클릭합니다.
68. [[Delete function]]을 선택합니다.
69. 확인 팝업에서 `delete`를 입력하고 [[Delete]] 버튼을 클릭합니다.

> [!OUTPUT]
> "Successfully deleted function SecretsManagerRDSRotation" 메시지가 표시됩니다.

---

### 단계 4: IAM Role 삭제 (태스크 5 진행한 경우)

70. 상단 검색창에 `IAM`을 입력하고 **IAM** 서비스를 선택합니다.
71. 왼쪽 메뉴에서 **Roles**를 선택합니다.
72. 검색창에 `SecretsManager`를 입력합니다.
73. `SecretsManagerRDSRotation` 관련 Role을 선택합니다 (체크박스 클릭).
74. [[Delete]] 버튼을 클릭합니다.
75. 확인 필드에 Role 이름을 입력하고 [[Delete]] 버튼을 클릭합니다.

> [!OUTPUT]
> Role이 삭제됩니다.

---

### 단계 5: 삭제 확인

76. 터미널에서 다음 명령어를 실행하여 비밀이 모두 삭제되었는지 확인합니다:

```bash
aws secretsmanager list-secrets \
  --query "SecretList[?starts_with(Name, 'starter/')].[Name,DeletedDate]" \
  --output table \
  --region ap-northeast-2
```

> [!OUTPUT]
> 즉시 삭제한 경우: 결과가 비어있습니다 (모든 비밀 삭제 완료).
> 예약 삭제한 경우: DeletedDate 열에 삭제 예정 날짜가 표시됩니다.

> [!TIP]
> **Tag Editor로 최종 확인:**
>
> 1. 상단 검색창에 `Resource Groups & Tag Editor`를 입력하고 선택합니다.
> 2. 왼쪽 메뉴에서 **Tag Editor**를 선택합니다.
> 3. Regions: `ap-northeast-2`, Tag key: `Session`, Tag value: `6-2`로 검색합니다.
> 4. 검색 결과가 없으면 모든 리소스가 정리된 것입니다.

| 문제                                    | 원인                                | 해결                                              |
| --------------------------------------- | ----------------------------------- | ------------------------------------------------- |
| `You can't delete secret ... scheduled` | 이미 삭제 예약됨                    | 정상 상태, 대기 기간 후 자동 삭제                 |
| `AccessDeniedException`                 | IAM 권한 부족                       | `secretsmanager:DeleteSecret` 권한 확인           |
| 삭제 후에도 과금 발생                   | 콘솔 삭제는 7일 대기 기간 동안 과금 | CLI `--force-delete-without-recovery`로 즉시 삭제 |
| Lambda 삭제 후 로테이션 에러 알림       | 비밀에 로테이션 설정이 남아있음     | 비밀을 먼저 삭제하면 문제없음 (순서 준수)         |

✅ **실습 종료**: 모든 리소스(Secrets Manager 비밀, Lambda 함수, IAM Role)가 정리되었습니다.

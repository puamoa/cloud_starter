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
  - Spring Boot에서 Secrets Manager 값을 조회하여 사용할 수 있습니다.
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

---

## 태스크 1: Secrets Manager vs Parameter Store 비교

> [!CONCEPT] 언제 무엇을 사용할까?
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

1. AWS Management Console에 로그인합니다.
2. 리전을 **Asia Pacific (Seoul) ap-northeast-2**로 설정합니다.
3. 상단 검색창에 `Secrets Manager`를 입력하고 선택합니다.
4. [[Store a new secret]]을 클릭합니다.
5. **Secret type**에서 **Other type of secret**을 선택합니다.
6. **Key/value pairs** 섹션에서 다음을 추가합니다:

| Key        | Value                                                |
| ---------- | ---------------------------------------------------- |
| `username` | `admin`                                              |
| `password` | `MySecretPass123!`                                   |
| `host`     | `my-rds-mysql.xxxx.ap-northeast-2.rds.amazonaws.com` |
| `port`     | `3306`                                               |
| `dbname`   | `appdb`                                              |

7. **Encryption key**: `aws/secretsmanager` (기본 KMS 키) 유지
8. [[Next]]를 클릭합니다.
9. **Secret name**: `starter/prod/db-credentials`
10. **Description**: `Production database credentials`
11. **Tags**: Key=`Project`, Value=`starter` 추가
12. [[Next]]를 클릭합니다.
13. **Configure rotation** 페이지에서 지금은 **Disable automatic rotation** 유지합니다.

> [!NOTE]
> 자동 로테이션은 태스크 5에서 별도로 설정합니다. 먼저 기본 사용법을 익힙니다.

14. [[Next]]를 클릭합니다.
15. **Review** 페이지에서 설정을 확인합니다.
16. [[Store]]를 클릭합니다.

> [!OUTPUT]
> 비밀이 생성되면 상세 페이지로 이동합니다. **Secret value** 섹션에서 [[Retrieve secret value]]를 클릭하면 저장된 키-값 쌍을 확인할 수 있습니다.

✅ **태스크 완료**: Secrets Manager에 DB 자격 증명을 저장했습니다.

---

## 태스크 3: AWS CLI로 비밀 생성/조회

### 비밀 생성

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

### 비밀 조회

```bash
aws secretsmanager get-secret-value \
  --secret-id "starter/prod/db-credentials" \
  --region ap-northeast-2
```

> [!OUTPUT]
>
> ```json
> {
>   "Name": "starter/prod/db-credentials",
>   "SecretString": "{\"username\":\"admin\",\"password\":\"MySecretPass123!\",\"host\":\"my-rds-mysql.xxxx.ap-northeast-2.rds.amazonaws.com\",\"port\":\"3306\",\"dbname\":\"appdb\"}",
>   "VersionId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
>   "CreatedDate": "2025-01-15T10:30:00+09:00"
> }
> ```

### 비밀 값 업데이트

```bash
aws secretsmanager update-secret \
  --secret-id "starter/prod/db-credentials" \
  --secret-string '{"username":"admin","password":"NewPassword456!","host":"my-rds-mysql.xxxx.ap-northeast-2.rds.amazonaws.com","port":"3306","dbname":"appdb"}' \
  --region ap-northeast-2
```

> [!NOTE]
> 비밀을 업데이트하면 새 버전이 자동으로 생성됩니다. 이전 버전도 유지되어 필요 시 롤백할 수 있습니다.

✅ **태스크 완료**: CLI로 비밀을 생성, 조회, 업데이트했습니다.

---

## 태스크 4: Spring Boot에서 Secrets Manager 조회

### 의존성 추가

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

### SecretsManagerService 클래스

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

### DataSource 설정

```java
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

> [!TIP]
> 자동 로테이션이 설정된 경우, 비밀번호가 변경되면 애플리케이션을 재시작해야 새 비밀번호를 가져옵니다. 이를 자동화하려면 Secrets Manager의 로테이션 이벤트를 감지하여 커넥션 풀을 갱신하는 로직이 필요합니다.

✅ **태스크 완료**: Spring Boot에서 Secrets Manager 값을 조회하여 DataSource를 설정했습니다.

---

## 태스크 5: RDS 비밀번호 자동 로테이션 설정 (선택)

> [!NOTE]
> 이 태스크는 RDS MySQL 인스턴스가 필요합니다. Step 4-1에서 생성한 RDS를 사용하거나, 이 태스크를 건너뛸 수 있습니다.

> [!CONCEPT] 자동 로테이션
> Secrets Manager는 Lambda 함수를 사용하여 비밀번호를 주기적으로 자동 교체합니다.
>
> 동작 흐름:
>
> 1. 설정한 주기(예: 30일)마다 Lambda 함수가 실행됨
> 2. Lambda가 새 비밀번호를 생성
> 3. RDS에 새 비밀번호를 적용
> 4. Secrets Manager에 새 비밀번호를 저장
> 5. 이전 비밀번호는 일정 기간 유지 (graceful rotation)

### RDS용 비밀 생성

1. Secrets Manager 콘솔에서 [[Store a new secret]]을 클릭합니다.
2. **Secret type**: **Credentials for Amazon RDS database**를 선택합니다.
3. **Credentials** 섹션:
   - **User name**: `admin`
   - **Password**: RDS 마스터 비밀번호
4. **Database**: 목록에서 `my-rds-mysql`을 선택합니다.
5. [[Next]]를 클릭합니다.
6. **Secret name**: `starter/prod/rds-auto-rotate`
7. [[Next]]를 클릭합니다.

### 자동 로테이션 활성화

8. **Configure rotation** 페이지에서:
   - ✅ **Turn on automatic rotation** 활성화
   - **Rotation schedule**: `30 days`
   - **Rotation function**: **Create a new Lambda function**
   - **Lambda function name**: `SecretsManagerRDSRotation`
   - **Use separate credentials to rotate this secret**: `No`
9. [[Next]]를 클릭합니다.
10. [[Store]]를 클릭합니다.

> [!NOTE]
> AWS가 자동으로 Lambda 함수를 생성하고 필요한 IAM 권한을 설정합니다. 첫 번째 로테이션은 즉시 실행되며, 이후 30일마다 자동 실행됩니다.

> [!WARNING]
> 자동 로테이션이 실행되면 RDS 비밀번호가 변경됩니다. 애플리케이션이 Secrets Manager에서 비밀번호를 조회하도록 설정되어 있지 않으면 접속이 끊길 수 있습니다.

### 로테이션 확인

11. 비밀 상세 페이지에서 **Rotation configuration** 섹션을 확인합니다.
12. **Last rotated date**에 날짜가 표시되면 첫 번째 로테이션이 완료된 것입니다.
13. [[Retrieve secret value]]를 클릭하여 비밀번호가 변경되었는지 확인합니다.

✅ **태스크 완료**: RDS 비밀번호 자동 로테이션이 설정되었습니다.

---

## 마무리

다음을 성공적으로 수행했습니다:

- Secrets Manager와 Parameter Store의 차이를 비교했습니다.
- Secrets Manager에 DB 자격 증명을 저장하고 조회했습니다.
- AWS CLI로 비밀을 생성, 조회, 업데이트했습니다.
- Spring Boot에서 Secrets Manager 값을 조회하여 DataSource를 설정했습니다.
- RDS 비밀번호 자동 로테이션을 설정했습니다 (선택).

---

# 🗑️ 리소스 정리

> [!WARNING]
> Secrets Manager는 비밀당 월 $0.40이 과금됩니다. 실습 후 불필요한 비밀은 반드시 삭제하세요.

---

### 단계 1: 비밀 삭제 (콘솔)

Secrets Manager는 즉시 삭제가 아닌 **예약 삭제** 방식입니다. 최소 7일의 복구 기간이 있으며, 이 기간 동안에도 과금됩니다.

1. Secrets Manager 콘솔에서 삭제할 비밀을 선택합니다.
2. **Actions** → [[Delete secret]]을 클릭합니다.
3. **Waiting period**: `7 days` (최소 대기 기간)
4. [[Schedule deletion]]을 클릭합니다.

> [!NOTE]
> 복구 기간 동안 삭제를 취소할 수 있습니다. 하지만 복구 기간 동안에도 월 $0.40이 과금되므로, 확실히 불필요한 비밀은 CLI로 즉시 삭제하는 것이 좋습니다.

---

### 단계 2: CLI로 즉시 삭제 (복구 불가)

복구 기간 없이 즉시 삭제하여 과금을 즉시 중단합니다.

```bash
# db-credentials 즉시 삭제
aws secretsmanager delete-secret \
  --secret-id "starter/prod/db-credentials" \
  --force-delete-without-recovery \
  --region ap-northeast-2

# api-keys 즉시 삭제
aws secretsmanager delete-secret \
  --secret-id "starter/prod/api-keys" \
  --force-delete-without-recovery \
  --region ap-northeast-2

# 자동 로테이션용 비밀 즉시 삭제 (태스크 5 진행한 경우)
aws secretsmanager delete-secret \
  --secret-id "starter/prod/rds-auto-rotate" \
  --force-delete-without-recovery \
  --region ap-northeast-2
```

> [!WARNING]
> `--force-delete-without-recovery` 옵션을 사용하면 되돌릴 수 없습니다. 삭제 전에 비밀 값이 다른 곳에 백업되어 있는지 확인하세요.

---

### 단계 3: 자동 로테이션 Lambda 삭제 (태스크 5 진행한 경우)

1. Lambda 콘솔 → `SecretsManagerRDSRotation` 함수 선택 → **Actions** → [[Delete function]] → 확인
2. IAM 콘솔 → **Roles** → `SecretsManagerRDSRotation` 관련 Role 검색 → 선택 → [[Delete]] → 확인

---

### 단계 4: 삭제 확인

```bash
aws secretsmanager list-secrets \
  --query "SecretList[?starts_with(Name, 'starter/')].[Name,DeletedDate]" \
  --output table --region ap-northeast-2
```

> [!TIP]
> 학습이 끝나면 Secrets Manager의 비밀을 모두 삭제하여 월 과금을 방지하세요. 비밀값 관리가 필요하다면 무료인 Parameter Store(SecureString)로 전환하는 것도 방법입니다.

✅ **실습 종료**: 모든 리소스가 정리되었습니다.

---
title: '🚀 셀프 미션: Amazon EC2에 Spring 백엔드 배포 (Parameter Store + Secrets Manager)'
week: 6
session: 3
type: mission
learningObjectives:
  - Step 2~6에서 학습한 내용을 통합하여 실제 배포 환경을 구축할 수 있습니다.
  - Parameter Store와 Secrets Manager를 적절히 선택하여 비밀값을 관리할 수 있습니다.
  - Amazon EC2 IAM Role을 활용하여 Access Key 없이 AWS 서비스에 접근할 수 있습니다.
prerequisites:
  - Session 6-1 (Parameter Store 실습) 완료
  - Session 6-2 (Secrets Manager 실습) 완료
  - AWS 계정 및 크레딧
estimatedCost: 크레딧 내 사용 가능 (Amazon EC2 t3.micro 시간당 약 $0.013 + Amazon RDS 선택 시 추가 비용)
---

# 🚀 셀프 미션: Amazon EC2에 Spring 백엔드 배포

이 미션에서는 지금까지 학습한 내용을 종합하여 **Amazon EC2에 Spring 백엔드를 배포**합니다.  
DB 접속 정보는 코드에 하드코딩하지 않고, AWS 비밀 관리 서비스를 통해 안전하게 관리합니다.

---

## 미션 목표

Amazon EC2에서 Spring 애플리케이션이 `aws` 프로필로 기동되어, **Parameter Store 또는 Secrets Manager에서 DB 접속 정보를 조회**하고 정상 동작하는 것을 확인합니다.

```
┌────────────────────────────────────────────────────────────────┐
│                    최종 구성도                                 │
│                                                                │
│  [Amazon EC2 Instance]                                         │
│    ├── Spring App (aws 프로필)                                 │
│    ├── IAM Role (ec2-starter-role)                             │
│    │     ├── SSM Parameter Store 읽기 권한                     │
│    │     └── Secrets Manager 읽기 권한 (Amazon RDS 선택 시)    │
│    └── 접속: SSH (Port 22) + HTTP (Port 8080)                  │
│                                                                │
│  [DB 서버] ← 택 1                                              │
│    ├── 옵션 A: Amazon EC2 내부 MySQL                           │
│    └── 옵션 B: Amazon RDS MySQL                                │
│                                                                │
│  [비밀 관리]                                                   │
│    ├── Parameter Store: DB driver, URL, username 등            │
│    └── Secrets Manager: DB password (Amazon RDS 선택 시 권장)  │
└────────────────────────────────────────────────────────────────┘
```

---

## 미션 조건

| 항목       | 요구사항                                                   |
| ---------- | ---------------------------------------------------------- |
| Amazon EC2 | t3.micro, Amazon Linux 2023 또는 Ubuntu                    |
| DB         | Amazon EC2 내부 MySQL **또는** Amazon RDS MySQL (택 1)     |
| 비밀 관리  | DB 접속 정보를 **코드/설정 파일에 하드코딩하지 않을 것**   |
| IAM        | Amazon EC2에 IAM Role을 연결하여 Access Key 없이 동작할 것 |
| 프로필     | `spring.profiles.active=aws`로 실행할 것                   |
| 확인       | 브라우저 또는 curl로 API 응답 확인                         |

---

## DB 옵션별 가이드

### 옵션 A: Amazon EC2 내부에 MySQL 설치 (간단, 크레딧 최소 사용)

이 방식은 Amazon EC2 하나에 앱 + DB를 모두 올리는 구성입니다.

**비밀 관리**: Parameter Store만 사용

> [!TIP]
> **힌트**
>
> - Step 2-1에서 Amazon EC2에 MySQL을 설치한 방법을 참고하세요.
> - DB URL에서 host는 `localhost`가 됩니다.
> - Parameter Store에 저장할 값 예시:
>
> | 파라미터                    | 값                                               |
> | --------------------------- | ------------------------------------------------ |
> | `/starter/prod/db/driver`   | `net.sf.log4jdbc.sql.jdbcapi.DriverSpy`          |
> | `/starter/prod/db/url`      | `jdbc:log4jdbc:mysql://localhost:3306/scoula_db` |
> | `/starter/prod/db/username` | `admin`                                          |
> | `/starter/prod/db/password` | (본인이 설정한 비밀번호)                         |
>
> - Amazon EC2에 MySQL 설치 후 DB 스키마와 테이블을 생성해야 합니다.

---

### 옵션 B: Amazon RDS 사용 (실전, 소액 과금)

이 방식은 Amazon EC2(앱)와 Amazon RDS(DB)를 분리하는 구성입니다.

**비밀 관리**: Parameter Store + Secrets Manager 혼합 사용

> [!TIP]
> **힌트**
>
> - Step 4에서 Amazon RDS를 생성한 방법을 참고하세요.
> - Amazon RDS 엔드포인트를 Parameter Store의 DB URL에 넣습니다.
> - **DB 비밀번호는 Secrets Manager에 저장**하면 6-2에서 배운 내용을 적용할 수 있습니다.
> - Parameter Store에 저장할 값 예시:
>
> | 파라미터                    | 값                                                          |
> | --------------------------- | ----------------------------------------------------------- |
> | `/starter/prod/db/driver`   | `com.mysql.cj.jdbc.Driver`                                  |
> | `/starter/prod/db/url`      | `jdbc:mysql://my-rds.xxxx.rds.amazonaws.com:3306/scoula_db` |
> | `/starter/prod/db/username` | `admin`                                                     |
>
> - Secrets Manager에 저장할 값:
>
> | 비밀 이름                  | 값                         |
> | -------------------------- | -------------------------- |
> | `starter/prod/db-password` | Amazon RDS 마스터 비밀번호 |
>
> - `AwsDataSourceConfig`에서 password만 Secrets Manager에서 가져오도록 수정이 필요합니다.

> [!TIP]
> **AwsDataSourceConfig 수정 힌트:**
>
> ```java
> // password만 Secrets Manager에서, 나머지는 Parameter Store에서
> @RequiredArgsConstructor
> public class AwsDataSourceConfig {
>     private final ParameterStoreService parameterStore;
>     private final SecretsManagerService secretsManager;
>
>     @Bean
>     public DataSource dataSource() {
>         HikariConfig config = new HikariConfig();
>         config.setDriverClassName(parameterStore.getDbDriver());   // Parameter Store
>         config.setJdbcUrl(parameterStore.getDbUrl());              // Parameter Store (driver와 쌍 맞춤)
>         config.setUsername(parameterStore.getDbUsername());         // Parameter Store
>         config.setPassword(secretsManager.getDbPassword());        // Secrets Manager
>         return new HikariDataSource(config);
>     }
> }
> ```
>
> **핵심**: driver와 URL은 Parameter Store에서 관리하면 쌍이 자동으로 맞습니다.  
> 6-2에서 `SecretsManagerService`의 `getJdbcUrl()`은 `jdbc:mysql://` 형식으로 고정되어 있으므로,  
> `log4jdbc` 드라이버를 사용하려면 URL을 Parameter Store에서 가져오는 이 방식이 필요합니다.
>
> **SecretsManagerService의 `secretId` 변경:**  
> 6-2에서는 `secretId("starter/prod/db-credentials")`로 하드코딩되어 있습니다.  
> 본인이 생성한 비밀 이름이 다르다면 (예: `starter/prod/db-password`) 코드에서 `secretId`를 맞춰 변경하세요.

> - Amazon EC2와 Amazon RDS가 **같은 VPC** 안에 있어야 하고, Security Group에서 3306 포트를 허용해야 합니다.
> - Amazon RDS 사용 시 운영 환경에서는 `log4jdbc` 대신 일반 드라이버(`com.mysql.cj.jdbc.Driver`)를 권장합니다.

> [!NOTE]
> **추가 도전 (보너스):**  
> 6-2 태스크 5에서 배운 자동 로테이션을 이 배포 환경에도 적용해보세요.  
> VPC Endpoint 생성 → Secrets Manager에 RDS 비밀번호 로테이션 설정 → 로테이션 후 앱 재시작 확인까지 해보면 프로덕션 수준의 비밀 관리를 경험할 수 있습니다.

---

### 옵션 C: Secrets Manager만 사용 (하드코딩 완전 제거)

이 방식은 Parameter Store를 사용하지 않고, **모든 DB 접속 정보를 Secrets Manager 하나에** 저장합니다.  
6-2에서 `getJdbcUrl()`의 URL 형식이 하드코딩된 문제를 해결합니다.

**비밀 관리**: Secrets Manager만 사용

> [!TIP]
> **힌트**
>
> Secrets Manager에 저장할 JSON에 `driver`와 `url` 키를 추가합니다:
>
> ```json
> {
>   "driver": "com.mysql.cj.jdbc.Driver",
>   "url": "jdbc:mysql://my-rds.xxxx.rds.amazonaws.com:3306/scoula_db",
>   "username": "admin",
>   "password": "MyPassword123!"
> }
> ```
>
> `SecretsManagerService`에서 `driver`와 `url`을 직접 읽도록 수정합니다:
>
> ```java
> // getJdbcUrl() 대신 — JSON에서 직접 읽기
> public String getDbDriver() { return driver; }
> public String getDbUrl() { return url; }
>
> @PostConstruct
> public void loadSecrets() {
>     // ...
>     this.driver = secret.get("driver").asText();
>     this.url = secret.get("url").asText();
>     this.username = secret.get("username").asText();
>     this.password = secret.get("password").asText();
> }
> ```
>
> `DataSourceConfig`에서는 모두 Secrets Manager에서 가져옵니다:
>
> ```java
> config.setDriverClassName(secretsManager.getDbDriver());
> config.setJdbcUrl(secretsManager.getDbUrl());
> config.setUsername(secretsManager.getDbUsername());
> config.setPassword(secretsManager.getDbPassword());
> ```
>
> **장점**: Parameter Store 없이 Secrets Manager 하나로 관리. 하드코딩 완전 제거.  
> **단점**: Secrets Manager는 유료 (비밀당 월 과금). 값 변경 시 전체 JSON을 다시 전달해야 함.

---

## 단계별 체크리스트

각 단계를 완료했는지 스스로 확인하세요:

### 1단계: 인프라 준비

- [ ] Amazon EC2 인스턴스 생성 (또는 기존 인스턴스 활용)
- [ ] Security Group에 22(SSH), 8080(HTTP) 포트 열기
- [ ] DB 준비 (옵션 A 또는 B)
- [ ] DB 스키마/테이블 생성 (DDL 실행)

> [!TIP]
> **참고할 실습 가이드:**
>
> - Amazon EC2 생성 → **Step 2-0 ~ 2-1** (VPC + EC2 생성)
> - Security Group 설정 → **Step 1-2** (Security Group으로 인스턴스 방화벽 구성)
> - Amazon EC2에 MySQL 설치 → **Step 2-1** (Amazon EC2에 MySQL 직접 설치)
> - Amazon RDS 생성 → **Step 4-1 ~ 4-2** (RDS Subnet Group + Parameter Group)

### 2단계: 비밀값 설정

- [ ] Parameter Store에 DB 설정값 저장 (driver, url, username 등)
- [ ] (옵션 B) Secrets Manager에 DB 비밀번호 저장
- [ ] Amazon EC2에서 CLI로 파라미터 조회 테스트

> [!TIP]
> **참고할 실습 가이드:**
>
> - Parameter Store 생성 (콘솔/CLI) → **Step 6-1 태스크 3~4**
> - Secrets Manager 생성 → **Step 6-2 태스크 2~3**
> - 드라이버와 URL 쌍 맞추기 → **Step 6-0** "JDBC 드라이버 이해" 섹션

### 3단계: IAM Role 설정

- [ ] IAM 정책 생성 (SSM 읽기 + KMS 복호화)
- [ ] (옵션 B) Secrets Manager 읽기 권한 추가
- [ ] IAM Role 생성 및 Amazon EC2에 연결
- [ ] Amazon EC2에서 `aws configure` **없이** 파라미터 조회 확인

> [!TIP]
> **참고할 실습 가이드:**
>
> - IAM 정책/Role 생성 및 Amazon EC2 연결 → **Step 6-1 태스크 6**
> - Secrets Manager 권한 추가 시 Action에 `secretsmanager:GetSecretValue` 추가

### 4단계: 앱 배포

- [ ] Spring 프로젝트 빌드 (JAR 또는 WAR)
- [ ] Amazon EC2에 빌드 결과물 전송 (scp 또는 S3 경유)
- [ ] `aws` 프로필로 앱 실행
- [ ] 로그에서 "파라미터 로드 완료" 확인
- [ ] 브라우저 또는 curl로 API 응답 확인

> [!TIP]
> **참고할 실습 가이드:**
>
> - Spring Boot JAR 배포 → **Step 2-3** (Amazon EC2에 Spring 애플리케이션 배포)
> - Spring MVC WAR 배포 → **Step 2-3** (Tomcat WAR 배포 섹션)
> - S3를 통한 파일 전송 → **Step 5-1 ~ 5-2** (Amazon S3 버킷 + Spring S3 연동)
> - `aws` 프로필 실행 방법 → **Step 6-1 태스크 5-E ~ 5-F** (실행 방법 정리 + 로컬 테스트)

---

## 성공 기준

다음을 모두 만족하면 미션 완료입니다:

1. Amazon EC2에서 Spring 앱이 `aws` 프로필로 정상 기동됨
2. Parameter Store (+ Secrets Manager)에서 DB 접속 정보를 조회하여 DB에 연결됨
3. `application.properties` 또는 코드에 **비밀번호가 하드코딩되어 있지 않음**
4. Amazon EC2에 `aws configure`를 하지 않았는데도 앱이 동작함 (IAM Role로 인증)
5. 브라우저에서 API 엔드포인트 호출 시 정상 응답

---

## 트러블슈팅 힌트

> [!TIP]
> 막히면 아래 힌트를 참고하세요. 에러 메시지별로 정리했습니다.

| 에러                                             | 원인                                  | 참고                                                              |
| ------------------------------------------------ | ------------------------------------- | ----------------------------------------------------------------- |
| `Unable to locate credentials`                   | IAM Role이 Amazon EC2에 연결되지 않음 | 6-1 태스크 6 참고                                                 |
| `AccessDeniedException: ssm:GetParametersByPath` | IAM 정책에 SSM 권한 없음              | 6-1 태스크 6 IAM 정책 JSON 참고                                   |
| `DriverSpy claims to not accept jdbcUrl`         | driver와 URL 불일치                   | 6-0 "JDBC 드라이버 이해" 섹션 참고                                |
| `Access denied for user`                         | DB 계정 정보 불일치                   | Parameter Store 값과 실제 DB 계정 일치 확인                       |
| `Communications link failure`                    | Amazon EC2에서 DB 접속 불가           | Security Group에서 3306 허용 확인, Amazon RDS는 같은 VPC인지 확인 |
| `Unknown database`                               | DB 스키마 미생성                      | MySQL 접속 후 `CREATE DATABASE` 실행                              |
| `Connection refused (port 8080)`                 | 앱 미실행 또는 포트 미개방            | Security Group에서 8080 허용, 앱 로그 확인                        |

---

## 🗑️ 리소스 정리

미션 완료 후 비용 방지를 위해 리소스를 정리하세요:

| 리소스                | 비용                           | 정리 방법                                     |
| --------------------- | ------------------------------ | --------------------------------------------- |
| Amazon EC2 (t3.micro) | 시간당 약 $0.013 (크레딧 차감) | 사용 안 할 때 중지, 완료 후 종료              |
| Amazon RDS (옵션 B)   | 시간당 과금                    | 스냅샷 생성 후 삭제 권장                      |
| Parameter Store       | 무료                           | 유지해도 비용 없음                            |
| Secrets Manager       | $0.40/비밀/월                  | `--force-delete-without-recovery`로 즉시 삭제 |

> [!WARNING]
> Amazon RDS를 사용한 경우 반드시 정리하세요. 중지해도 7일 후 자동 재시작됩니다.
> 삭제 전 스냅샷을 생성해두면 나중에 복원할 수 있습니다.

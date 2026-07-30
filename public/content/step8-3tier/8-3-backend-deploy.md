---
title: 'Spring Boot 백엔드 배포 (EC2 + ALB + CI/CD)'
week: 8
session: 3
awsServices:
  - Amazon EC2
  - Elastic Load Balancing
learningObjectives:
  - Spring Boot 프로젝트에 Amazon RDS 연동 코드를 작성할 수 있습니다.
  - Amazon EC2에 Spring Boot를 배포하고 ALB와 연결할 수 있습니다.
  - SSM Parameter Store로 비밀값을 관리할 수 있습니다.
  - GitHub Actions로 백엔드 자동 배포를 구성할 수 있습니다.
prerequisites:
  - Step 8-1 완료 (인프라 구축)
  - Java 17 + Gradle (로컬)
estimatedCost: 크레딧 내 사용 가능 (비용 발생 가능)
---

이 실습에서는 Spring Boot 백엔드를 생성하고, Amazon RDS MySQL과 연동한 후,
Amazon EC2에 배포하여 ALB와 연결합니다.  
GitHub Actions로 자동 배포 파이프라인도 구축합니다.

### Step 8 전체 아키텍처

<img src="/images/step8/8-architecture.png" alt="Step 8 3-Tier 아키텍처" class="guide-img-lg" />

> [!NOTE]
> Step 8-1에서 생성한 AWS CloudFormation Outputs 값이 필요합니다:
>
> - **RDSEndpoint**: 데이터베이스 연결 주소
> - **ALBTargetGroupArn**: EC2 등록 대상
> - **EC2SecurityGroupId**: Amazon EC2 인스턴스에 적용할 보안 그룹

---

## 태스크 1: Spring Boot 프로젝트 준비

기존 Spring 프로젝트가 있다면 **방법 A**로 진행하고, 새로 만드려면 **방법 B**를 따릅니다.

---

### 방법 A: 기존 프로젝트 사용

Step 2-3에서 사용한 기존 프로젝트를 3-Tier 배포에 활용합니다.

```bash
cd ~/3tier-project/my-backend

# 기존 프로젝트 파일을 복사하거나 git clone
# git clone <기존-백엔드-레포-URL> .
```

> [!NOTE]
> 기존 프로젝트를 사용하는 경우 다음을 확인하세요:
>
> - **Spring Boot (JAR)**: `./gradlew clean bootJar` 또는 `./gradlew build -x test`로 빌드 가능
> - **Spring MVC (WAR)**: `./gradlew build -x test`로 WAR 빌드 가능
> - `application.properties`(또는 `.yml`)의 DB 접속 정보를 Amazon RDS 엔드포인트로 변경
> - CORS 설정에 Amazon CloudFront 도메인 추가 필요
>
> **DB 접속 정보 변경 예시:**
>
> ```properties
> # application.properties
> jdbc.url=jdbc:log4jdbc:mysql://RDS_ENDPOINT:3306/scoula_db
> jdbc.username=scoula
> jdbc.password=1234
> ```

방법 A를 선택했다면 **태스크 3: CRUD API** 부분은 건너뛰고, **태스크 4: CORS 설정**과 **태스크 5: Amazon EC2 배포**로 이동하세요.

> [!TIP]
> **방법 A에서 Spring Boot vs Spring MVC 배포 차이:**
>
> | 항목         | Spring Boot (JAR)         | Spring MVC (WAR)                |
> | ------------ | ------------------------- | ------------------------------- |
> | 빌드 명령    | `./gradlew clean bootJar` | `./gradlew clean build -x test` |
> | 결과물       | `build/libs/*.jar`        | `build/libs/*.war`              |
> | EC2 실행     | `java -jar app.jar`       | Tomcat에 WAR 배포               |
> | 포트         | 8080 (내장 Tomcat)        | 8080 (외부 Tomcat)              |
> | systemd      | spring-app.service        | tomcat.service                  |
> | Health Check | `/actuator/health`        | `/` 또는 `/health`              |
>
> 태스크 5에서 본인 방식에 맞는 가이드를 따르세요.

---

### 방법 B: 새 프로젝트 생성 (Spring Boot)

Spring Initializr로 프로젝트를 새로 생성합니다.  
Step 2-3에서 Spring Boot 프로젝트를 생성한 경험이 있다면 동일한 방식입니다.

### B-1. Spring Initializr로 프로젝트 생성

1. 브라우저에서 [https://start.spring.io](https://start.spring.io)에 접속합니다.
2. 다음과 같이 설정합니다:

| 설정          | 값                                             |
| ------------- | ---------------------------------------------- |
| Project       | Gradle - Groovy                                |
| Language      | Java                                           |
| Spring Boot   | 최신 안정 버전 (SNAPSHOT/RC 제외, 예: `4.1.0`) |
| Group         | com.example                                    |
| Artifact      | my-backend                                     |
| Packaging     | Jar                                            |
| Configuration | YAML                                           |
| Java          | 17                                             |

> [!TIP]
> **Spring Boot 버전 선택 가이드:**
>
> | 상황                     | 권장 버전                              |
> | ------------------------ | -------------------------------------- |
> | 새 프로젝트 시작         | 4.x (최신 안정 버전, SNAPSHOT/RC 제외) |
> | 기존 3.x 프로젝트 유지   | 3.5.x (호환성 유지)                    |
> | KB IT's Your Life 레거시 | Spring MVC 5.x (방법 A로 진행)         |
>
> Spring Boot 3.x/4.x 모두 **Java 17 이상**을 요구합니다.  
> 4.x와 3.x는 Jackson, Security 기본값 등이 달라 기존 3.x 코드와 호환성 문제가 있을 수 있습니다.  
> 기존 프로젝트가 있다면 같은 메이저 버전을 유지하세요.
>
> **Configuration**: `YAML`을 선택하면 `application.yml`이 생성됩니다.  
> `Properties`를 선택하면 `application.properties`가 생성됩니다.  
> 이 가이드에서는 `YAML`을 기준으로 설명하지만, Properties를 선택해도 무방합니다.  
> 기존 프로젝트가 `.properties` 형식이라면 그대로 유지하세요.

3. **Dependencies**에서 다음을 추가합니다:
   - Spring Web
   - Spring Data JPA
   - MySQL Driver
   - Spring Boot Actuator
   - Validation

4. [[GENERATE]]를 클릭하여 ZIP 파일을 다운로드합니다.

### B-2. 프로젝트 설정

```bash
cd ~/3tier-project/my-backend

# 다운로드한 ZIP 압축 해제 후 파일 복사
# 또는 Spring Initializr에서 직접 생성한 구조 사용
```

완성 시 프로젝트 구조 (태스크 3~6에서 순차적으로 생성):

```
my-backend/
├── src/
│   ├── main/
│   │   ├── java/com/example/mybackend/
│   │   │   ├── MyBackendApplication.java       ← 자동 생성됨
│   │   │   ├── controller/
│   │   │   │   └── ItemController.java         ← 태스크 3에서 생성
│   │   │   ├── entity/
│   │   │   │   └── Item.java                   ← 태스크 3에서 생성
│   │   │   ├── repository/
│   │   │   │   └── ItemRepository.java         ← 태스크 3에서 생성
│   │   │   └── config/
│   │   │       └── WebConfig.java              ← 태스크 4에서 생성
│   │   └── resources/
│   │       └── application.yml                 ← 태스크 2에서 수정
│   └── test/
├── build.gradle                                 ← 자동 생성됨
├── settings.gradle                              ← 자동 생성됨
└── .github/workflows/deploy.yml                 ← 태스크 6에서 생성
```

> [!NOTE]
> Spring Initializr로 생성 직후에는 `MyBackendApplication.java`, `build.gradle`, `application.yml`만 존재합니다.  
> 나머지 파일은 이후 태스크를 진행하면서 직접 생성합니다.

✅ **태스크 완료** — Spring Boot 프로젝트를 생성했습니다.

---

## 태스크 2: RDS 연동 설정

> [!WARNING]
> 이 태스크는 **필수**입니다. SSM Parameter Store에 DB 접속 정보를 저장하지 않으면 Amazon EC2에서 애플리케이션이 시작되지 않습니다.

### 2-1. SSM Parameter Store에 비밀값 저장

Amazon EC2에서 Amazon RDS 접속 정보를 안전하게 관리하기 위해 SSM Parameter Store를 사용합니다.

> [!TIP]
> SSM Parameter Store의 개념, 타입(String/SecureString), 계층 구조, Spring 연동 방법은 [Step 6-1](/week/6/session/1)에서 자세히 다루고 있습니다.  
> 처음 접하는 경우 Step 6-1을 먼저 참고하세요.
>
> **스택 생성 시 기본값을 변경하지 않았다면:**
>
> | 파라미터     | 기본값                                                           |
> | ------------ | ---------------------------------------------------------------- |
> | DB 이름      | `myapp`                                                          |
> | DB 사용자명  | `admin`                                                          |
> | DB 비밀번호  | `MyPassword123!` (Step 8-1 가이드 기본 예시, 변경했다면 본인 값) |
> | RDS Endpoint | CloudFormation Outputs → `RDSEndpoint` 확인                      |

5. 다음 명령어를 실행하여 SSM Parameter Store에 4개의 파라미터를 저장합니다:

```bash
# Amazon RDS 엔드포인트 저장
aws ssm put-parameter \
  --name "/my-3tier-app/db/endpoint" \
  --value "<Step 8-1 CloudFormation Outputs의 RDSEndpoint 값>" \
  --type String

# DB 이름 저장
aws ssm put-parameter \
  --name "/my-3tier-app/db/name" \
  --value "<스택 생성 시 설정한 DB 이름 (기본: myapp)>" \
  --type String

# DB 사용자명 저장
aws ssm put-parameter \
  --name "/my-3tier-app/db/username" \
  --value "<스택 생성 시 설정한 DB 마스터 사용자명 (기본: admin)>" \
  --type String

# DB 비밀번호 저장 (SecureString으로 암호화)
aws ssm put-parameter \
  --name "/my-3tier-app/db/password" \
  --value "<스택 생성 시 설정한 DB 마스터 비밀번호>" \
  --type SecureString
```

> [!TIP]
> `SecureString` 타입은 AWS KMS로 자동 암호화됩니다.
> 비밀번호, API 키 등 민감한 값은 항상 SecureString을 사용하세요.
>
> **값을 잘못 입력한 경우:**
>
> - CLI: `--overwrite` 플래그를 추가하여 같은 명령을 다시 실행하면 덮어씁니다.
> - 콘솔: AWS Console → Systems Manager → Parameter Store에서 해당 파라미터를 클릭하고 [[Edit]] → 값 수정 → [[Save changes]]

### 2-2. RDS 초기 데이터베이스 및 테이블 설정

6. 아래 방법 중 본인 프로젝트에 맞는 것을 선택합니다:

> [!NOTE]
> Step 8-1에서 AWS CloudFormation `DBName` 파라미터로 데이터베이스가 **자동 생성**되었습니다 (기본: `myapp`).  
> 별도로 `CREATE DATABASE`를 실행할 필요가 없습니다.

| 방법    | 대상                             | 테이블 생성 방식                             | 추가 작업               |
| ------- | -------------------------------- | -------------------------------------------- | ----------------------- |
| **A**   | 기존 레거시 (Spring MVC 등)      | EC2에서 수동 SQL 실행                        | 태스크 5-2b에서 진행    |
| **B-1** | 새 프로젝트 (Spring Boot + JPA)  | `ddl-auto: update`로 앱 시작 시 자동 생성    | 없음 (7번에서 yml 설정) |
| **B-2** | Spring Boot + 초기 SQL 파일 있음 | `schema.sql`/`data.sql` 앱 시작 시 자동 실행 | 아래 yml 설정 추가      |

**방법 B-2: schema.sql / data.sql 사용 시 설정**

초기 테이블 구조와 데이터가 있는 SQL 파일을 프로젝트에 포함하면 앱 시작 시 자동 실행됩니다:

```
src/main/resources/
├── schema.sql    ← CREATE TABLE 문 (테이블 구조)
├── data.sql      ← INSERT 문 (초기 데이터)
└── application.yml
```

`application.yml`에 다음을 추가합니다:

```yaml
spring:
  sql:
    init:
      mode: always # 항상 실행 (최초 1회만 하려면 'embedded')
      schema-locations: classpath:schema.sql
      data-locations: classpath:data.sql
```

> [!WARNING]
> `mode: always`는 앱을 재시작할 때마다 SQL이 실행됩니다.  
> 테이블이 이미 존재하면 에러가 발생할 수 있으므로 `CREATE TABLE IF NOT EXISTS`를 사용하세요.  
> 프로덕션에서는 Flyway나 Liquibase 같은 마이그레이션 도구를 권장합니다.

### 2-3. DB 접속 설정 파일 수정

**방법 B 사용자 (새 프로젝트 — application.yml):**

7. `src/main/resources/application.yml` 파일을 다음과 같이 설정합니다:

```yaml
spring:
  application:
    name: my-backend

  datasource:
    url: jdbc:mysql://${DB_ENDPOINT}:3306/${DB_NAME}?useSSL=false&serverTimezone=Asia/Seoul&characterEncoding=UTF-8
    username: ${DB_USERNAME}
    password: ${DB_PASSWORD}
    driver-class-name: com.mysql.cj.jdbc.Driver
    hikari:
      maximum-pool-size: 5
      minimum-idle: 2
      idle-timeout: 30000
      connection-timeout: 20000

  jpa:
    hibernate:
      ddl-auto: update
    show-sql: true
    properties:
      hibernate:
        dialect: org.hibernate.dialect.MySQLDialect
        format_sql: true

server:
  port: 8080

management:
  endpoints:
    web:
      exposure:
        include: health, info
  endpoint:
    health:
      show-details: always
```

**방법 A 사용자 (기존 프로젝트 — application.properties):**

> [!TIP]
> 기존 프로젝트라도 `application.yml`을 사용한다면 위 7번을 따르세요.

8. `src/main/resources/application.properties`의 DB 접속 정보를 환경 변수로 변경합니다:

```properties
# 변경 전 (로컬 DB 직접 접속)
#jdbc.driver=net.sf.log4jdbc.sql.jdbcapi.DriverSpy
#jdbc.url=jdbc:log4jdbc:mysql://localhost:3306/scoula_db
#jdbc.username=scoula
#jdbc.password=Scoula123!

# 변경 후 (환경 변수에서 주입 — EC2의 start.sh에서 설정)
jdbc.driver=net.sf.log4jdbc.sql.jdbcapi.DriverSpy
jdbc.url=jdbc:log4jdbc:mysql://${DB_ENDPOINT}:3306/${DB_NAME}
jdbc.username=${DB_USERNAME}
jdbc.password=${DB_PASSWORD}
```

> [!TIP]
> 기존 프로젝트의 `RootConfig.java`에서 `@Value("${jdbc.url}")` 등으로 값을 읽는 구조라면,  
> `application.properties`의 값만 환경 변수 형태로 변경하면 됩니다. Java 코드 수정은 불필요합니다.
>
> `log4jdbc` 드라이버를 사용하는 경우 URL 형식이 `jdbc:log4jdbc:mysql://`이어야 합니다.  
> SSM Parameter Store의 endpoint 값은 호스트명만 저장하고, 드라이버+프로토콜은 properties에서 처리합니다.
>
> ---
>
> **로컬 개발 시** 환경 변수가 없으면 앱이 시작되지 않습니다.  
> 아래 방법 중 하나를 선택하세요:
>
> | 방법              | 설정 위치                                       | 적합한 경우            |
> | ----------------- | ----------------------------------------------- | ---------------------- |
> | IntelliJ 환경변수 | Run/Debug Configuration → Environment variables | IDE 사용자 (가장 간편) |
> | OS 환경변수       | 터미널에서 `export DB_ENDPOINT=localhost` 등    | CLI로 실행하는 경우    |
> | properties 분리   | `application-local.properties` 별도 생성        | 팀 공유 시             |
>
> **IntelliJ 설정 예시:**  
> Run → Edit Configurations → 실행 설정 선택 → Environment variables에 입력:
>
> ```
> DB_ENDPOINT=localhost;DB_NAME=scoula_db;DB_USERNAME=scoula;DB_PASSWORD=Scoula123!
> ```
>
> **properties 분리 예시:**  
> `application-local.properties`를 생성하고 `.gitignore`에 추가합니다:
>
> ```properties
> jdbc.driver=net.sf.log4jdbc.sql.jdbcapi.DriverSpy
> jdbc.url=jdbc:log4jdbc:mysql://localhost:3306/scoula_db
> jdbc.username=scoula
> jdbc.password=Scoula123!
> ```
>
> `RootConfig.java`의 `@PropertySource`를 프로파일 기반으로 변경:
>
> ```java
> @PropertySource({"classpath:/application-${spring.profiles.active:local}.properties"})
> ```
>
> 로컬에서는 프로파일 없이 실행(기본 `local`), EC2에서는 `--spring.profiles.active=prod`로 실행합니다.

**Step 6-1 실습을 적용한 경우 (ParameterStoreService 사용):**

9. Step 6-1에서 `ParameterStoreService`를 구현하여 SSM Parameter Store에서 직접 값을 읽는 구조라면, `application.properties`에 환경 변수(`${DB_ENDPOINT}`)를 넣을 필요가 없습니다.  
   대신 SSM Parameter Store의 **파라미터 값**만 Amazon RDS 엔드포인트로 업데이트하면 됩니다:

```bash
# 기존 로컬 DB URL을 Amazon RDS 엔드포인트로 변경
aws ssm put-parameter \
  --name "/starter/prod/db/url" \
  --value "jdbc:log4jdbc:mysql://<RDS_ENDPOINT>:3306/<DB_NAME>" \
  --type String \
  --overwrite

# 사용자명/비밀번호도 Amazon RDS 기준으로 업데이트 (필요 시)
aws ssm put-parameter \
  --name "/starter/prod/db/username" \
  --value "<DB_USERNAME>" \
  --type String \
  --overwrite

aws ssm put-parameter \
  --name "/starter/prod/db/password" \
  --value "<DB_PASSWORD>" \
  --type SecureString \
  --overwrite
```

> [!TIP]
> 이 경우 `application.properties`는 수정하지 않아도 됩니다.  
> `ParameterStoreService`가 앱 시작 시 SSM에서 값을 읽어 DataSource에 주입하기 때문입니다.  
> 파라미터 경로(`/starter/prod/db/...`)는 본인 프로젝트에서 설정한 경로에 맞게 변경하세요.
>
> **프로파일 관련:**  
> `ParameterStoreService`는 `@Profile("aws-ssm")`으로 설정되어 있습니다.  
> 태스크 5-3의 `start.sh`에서 `--spring.profiles.active=aws-ssm`으로 실행해야 이 Bean이 활성화됩니다.  
> 기존 `prod`로 되어 있다면 본인 프로젝트의 `@Profile` 값에 맞게 변경하세요.

> [!CONCEPT] 환경 변수로 설정값 주입
>
> `${DB_ENDPOINT}`, `${DB_USERNAME}` 등은 EC2의 환경 변수에서 값을 가져옵니다.  
> systemd 서비스 파일에서 SSM Parameter Store의 값을 환경 변수로 설정합니다.  
> 이렇게 하면 코드에 비밀값이 포함되지 않아 안전합니다.

✅ **태스크 완료** — Amazon RDS 연동 설정을 완료하고 SSM Parameter Store에 비밀값을 저장했습니다.

> [!TROUBLESHOOTING]
> | 증상 | 원인 | 해결 방법 |
> |------|------|-----------|
> | `ParameterAlreadyExists` 에러 | 동일 이름의 파라미터 이미 존재 | `--overwrite` 플래그 추가하여 재실행 |
> | Amazon EC2에서 Amazon RDS 접속 실패 (`Can't connect`) | Security Group 미허용 또는 RDS 미생성 | RDS-SG에서 EC2-SG의 3306 포트 허용 확인 |
> | `Access denied for user 'admin'` | 비밀번호 오류 | SSM에 저장한 비밀번호와 RDS 생성 시 설정한 비밀번호 일치 확인 |
> | `Unknown database 'myapp'` | 데이터베이스 미생성 | Amazon EC2에서 Amazon RDS 접속 후 `CREATE DATABASE myapp` 실행 |

> [!NOTE]
> SSM Parameter Store의 Standard 파라미터는 무료입니다 (리전당 10,000개까지).  
> SecureString은 KMS 기본 키(`aws/ssm`)를 사용하면 추가 비용이 없습니다.

---

## 태스크 3: 간단한 REST API 작성

### 3-1. Entity 클래스

10. `src/main/java/com/example/mybackend/entity/Item.java` 파일을 생성합니다:

```java
// src/main/java/com/example/mybackend/entity/Item.java
package com.example.mybackend.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import java.time.LocalDateTime;

@Entity
@Table(name = "items")
public class Item {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank(message = "이름은 필수입니다")
    @Column(nullable = false, length = 100)
    private String name;

    @Column(length = 500)
    private String description;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
```

### 3-2. Repository 인터페이스

11. `src/main/java/com/example/mybackend/repository/ItemRepository.java` 파일을 생성합니다:

```java
// src/main/java/com/example/mybackend/repository/ItemRepository.java
package com.example.mybackend.repository;

import com.example.mybackend.entity.Item;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ItemRepository extends JpaRepository<Item, Long> {
}
```

### 3-3. Controller 클래스

12. `src/main/java/com/example/mybackend/controller/ItemController.java` 파일을 생성합니다:

```java
// src/main/java/com/example/mybackend/controller/ItemController.java
package com.example.mybackend.controller;

import com.example.mybackend.entity.Item;
import com.example.mybackend.repository.ItemRepository;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class ItemController {

    private final ItemRepository itemRepository;

    public ItemController(ItemRepository itemRepository) {
        this.itemRepository = itemRepository;
    }

    // Health Check
    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Map.of(
            "status", "UP",
            "service", "my-backend",
            "timestamp", java.time.LocalDateTime.now().toString()
        ));
    }

    // 전체 조회
    @GetMapping("/items")
    public ResponseEntity<List<Item>> getAllItems() {
        return ResponseEntity.ok(itemRepository.findAll());
    }

    // 단건 조회
    @GetMapping("/items/{id}")
    public ResponseEntity<Item> getItem(@PathVariable Long id) {
        return itemRepository.findById(id)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    // 생성
    @PostMapping("/items")
    public ResponseEntity<Item> createItem(@Valid @RequestBody Item item) {
        Item saved = itemRepository.save(item);
        return ResponseEntity.status(201).body(saved);
    }

    // 수정
    @PutMapping("/items/{id}")
    public ResponseEntity<Item> updateItem(
            @PathVariable Long id,
            @Valid @RequestBody Item item) {
        return itemRepository.findById(id)
            .map(existing -> {
                existing.setName(item.getName());
                existing.setDescription(item.getDescription());
                return ResponseEntity.ok(itemRepository.save(existing));
            })
            .orElse(ResponseEntity.notFound().build());
    }

    // 삭제
    @DeleteMapping("/items/{id}")
    public ResponseEntity<Void> deleteItem(@PathVariable Long id) {
        if (itemRepository.existsById(id)) {
            itemRepository.deleteById(id);
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.notFound().build();
    }
}
```

> [!NOTE]
> `/api/health` 엔드포인트는 ALB Health Check와 CI/CD 배포 확인에 사용됩니다.
> Spring Boot Actuator의 `/actuator/health`도 함께 사용할 수 있습니다.

✅ **태스크 완료** — CRUD REST API와 Health Check 엔드포인트를 작성했습니다.

---

## 태스크 4: CORS 설정

Amazon CloudFront 도메인에서 API를 호출할 수 있도록 CORS를 설정합니다.

13. 아래 방법 중 본인 프로젝트에 맞는 것을 선택합니다:

| 방법  | 대상                                     | CORS 설정 위치                         | 작업                      |
| ----- | ---------------------------------------- | -------------------------------------- | ------------------------- |
| **A** | 기존 레거시 (Spring Security 사용)       | `SecurityConfig.java`의 `CorsFilter`   | `*` 유지 또는 도메인 제한 |
| **B** | 기존 레거시 (Spring Security 미사용)     | `WebMvcConfigurer` 또는 `@CrossOrigin` | 아래 방법 B 참고          |
| **C** | 새 프로젝트 (Spring Boot, Security 없음) | `WebConfig.java` + `application.yml`   | 아래 14~15번 진행         |

**방법 A: SecurityConfig.java 수정 (기존 프로젝트 — Security 사용)**

`SecurityConfig.java`에 이미 `CorsFilter` Bean이 있고 `addAllowedOriginPattern("*")`로 설정되어 있다면 추가 작업 없이 동작합니다.  
프로덕션에서 도메인을 제한하려면 `*` 부분을 수정합니다:

```java
// SecurityConfig.java의 corsFilter() 메서드
@Bean
public CorsFilter corsFilter() {
    UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
    CorsConfiguration config = new CorsConfiguration();
    config.setAllowCredentials(true);
    config.addAllowedOriginPattern("https://<CloudFront 도메인>"); // 예: https://d1234abcdef.cloudfront.net
    config.addAllowedOriginPattern("http://localhost:5173");        // 로컬 개발
    config.addAllowedHeader("*");
    config.addAllowedMethod("*");
    source.registerCorsConfiguration("/**", config);
    return new CorsFilter(source);
}
```

> [!TIP]
> `addAllowedOriginPattern("*")`을 그대로 두면 모든 도메인에서 접근 가능합니다.  
> 학습용이라면 `*`로 유지해도 무방합니다. 방법 A를 선택했다면 **태스크 5로 이동**하세요.

**방법 B: WebMvcConfigurer 추가 (기존 프로젝트 — Security 미사용)**

Spring Security를 사용하지 않는 레거시 프로젝트에서는 기존 `WebConfig.java` (또는 `ServletConfig.java` 등 MVC 설정 파일)에 CORS 설정을 추가합니다:

```java
// src/main/java/.../config/WebConfig.java
@Configuration
@EnableWebMvc
public class WebConfig implements WebMvcConfigurer {
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
            .allowedOriginPatterns("*")
            .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
            .allowedHeaders("*")
            .allowCredentials(true);
    }
}
```

> [!TIP]
> 이미 `WebConfig.java`가 있고 `addCorsMappings`가 설정되어 있다면 추가 작업 없이 동작합니다.  
> 프로덕션에서는 `allowedOriginPatterns("*")`을 Amazon CloudFront 도메인으로 제한하세요.  
> 방법 B를 선택했다면 **태스크 5로 이동**하세요.

**방법 C: WebConfig.java 생성 (새 프로젝트 — Spring Boot)**

Spring Boot에서는 Security를 사용하지 않으면 CORS를 처리할 필터가 없으므로, `WebConfig.java`를 생성하여 MVC 레벨에서 CORS를 설정합니다.

> [!NOTE]
> Spring Boot에 Spring Security 의존성을 추가한 경우, `WebConfig`의 CORS 설정보다 Security 필터가 우선합니다.  
> 이 경우 방법 A처럼 Security 설정에서 CORS를 처리해야 합니다.

### 4-1. WebConfig 클래스 생성

14. `src/main/java/com/example/mybackend/config/WebConfig.java` 파일을 생성합니다:

```java
// src/main/java/com/example/mybackend/config/WebConfig.java
package com.example.mybackend.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Value("${app.cors.allowed-origins:*}")
    private String allowedOrigins;

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
            .allowedOrigins(allowedOrigins.split(","))
            .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
            .allowedHeaders("*")
            .allowCredentials(false)
            .maxAge(3600);
    }
}
```

### 4-2. application.yml에 CORS 설정 추가

15. `application.yml`에 CORS 설정을 추가합니다:

```yaml
# application.yml에 추가
app:
  cors:
    allowed-origins: https://d1234abcdef.cloudfront.net,http://localhost:5173
```

> [!WARNING]
> `allowed-origins`에 Step 8-2에서 생성한 Amazon CloudFront 도메인을 입력하세요.
> 로컬 개발 시에는 `http://localhost:5173` (Vite 기본 포트)도 추가합니다.
> 프로덕션에서는 `*` 대신 정확한 도메인을 지정하는 것이 보안상 좋습니다.

✅ **태스크 완료** — Amazon CloudFront 도메인에서 API 호출을 허용하는 CORS를 설정했습니다.

> [!TROUBLESHOOTING]
> | 증상 | 원인 | 해결 방법 |
> |------|------|-----------|
> | 브라우저에서 CORS 에러 | `allowed-origins`에 프론트엔드 도메인 미포함 | Amazon CloudFront 도메인을 `https://` 포함하여 정확히 추가 |
> | `localhost`에서 CORS 에러 | `http://localhost:5173` 미추가 | 개발 환경 URL도 `allowed-origins`에 포함 |
> | OPTIONS 요청 실패 (Preflight) | `allowedMethods`에 `OPTIONS` 미포함 | `"GET", "POST", "PUT", "DELETE", "OPTIONS"` 모두 포함 확인 |
> | 배포 후 CORS 에러 (로컬은 정상) | `application.yml`의 CORS 설정이 환경변수로 주입 안 됨 | EC2의 환경변수 또는 `application.yml` 직접 수정 |

> [!NOTE]
> CORS 에러는 **브라우저에서만** 발생합니다.  
> `curl`로 테스트하면 CORS 에러가 나타나지 않습니다.  
> 브라우저 개발자 도구(F12) → Console 탭에서 CORS 에러 메시지를 확인하세요.

---

## 태스크 5: Amazon EC2 배포 + ALB Target Group 등록

### 5-1. Amazon EC2 인스턴스 생성

> [!WARNING]
> AWS Console 우측 상단에서 리전이 **Asia Pacific (Seoul) ap-northeast-2**인지 확인하세요.  
> 다른 리전에서 생성하면 Step 8-1의 VPC, Security Group 등이 보이지 않습니다.

16. 상단 검색창에 `EC2`를 입력하고 **EC2** 서비스를 선택합니다.
17. 왼쪽 메뉴에서 **Instances**를 클릭합니다.
18. [[Launch instances]] 버튼을 클릭합니다.
19. **Name and tags** 섹션:
    - **Name**: `my-3tier-app-server`
    - [[Add additional tags]]를 클릭하여 다음 태그를 추가합니다:
      - `CreatedBy` = `admin-user`
      - `Step` = `step8`
      - `Session` = `8-3`

20. **Application and OS Images (Amazon Machine Image)** 섹션:
    - **AMI**: `Amazon Linux 2023` 선택 (기본 선택됨)

21. **Instance type** 섹션:
    - `t2.micro` 선택 (프리티어 대상)

22. **Key pair (login)** 섹션:
    - `Proceed without a key pair (Not recommended)` 선택
    - SSM Session Manager로 접속하므로 SSH 키가 불필요합니다.

23. **Network settings** 섹션에서 [[Edit]] 버튼을 클릭합니다.
24. 다음과 같이 설정합니다:
    - **VPC**: `my-3tier-app-vpc` 선택
    - **Subnet**: `my-3tier-app-private-subnet-1` 선택
    - **Auto-assign public IP**: `Disable` 선택
    - **Firewall (security groups)**: `Select existing security group` 선택
    - **Common security groups**: `my-3tier-app-ec2-sg` 선택

> [!WARNING]
> **Auto-assign public IP**를 반드시 `Disable`로 설정하세요.
> Private Subnet에 배치하므로 Public IP가 필요 없습니다.

25. **Configure storage** 섹션은 기본값을 유지합니다:
    - **Root volume**: `8 GiB`, `gp3` (기본값)

26. **Advanced details** 섹션을 펼칩니다.
27. **IAM instance profile** 드롭다운에서 SSM + Parameter Store 읽기 권한이 있는 IAM Role을 선택합니다.
    - 필요 정책: `AmazonSSMManagedInstanceCore` + `AmazonSSMReadOnlyAccess`
    - Role이 없다면 아래 TIP을 참고하여 먼저 생성하세요.

> [!TIP]
> **IAM Role 생성 방법 (EC2용 SSM 접속 + Parameter Store 읽기):**
>
> - IAM → Roles → [[Create role]]
> - **Trusted entity type**: `AWS service` 선택
> - **Use case**: `EC2` 선택 → [[Next]]
> - 검색창에 `SSM`을 입력하고 `AmazonSSMManagedInstanceCore` 체크
> - 검색창을 지우고 `SSMReadOnly`를 입력하고 `AmazonSSMReadOnlyAccess` 체크
> - [[Next]] → **Role name**: `my-3tier-app-ec2-role` → [[Create role]]
> - EC2 생성 화면으로 돌아와서 IAM instance profile에 `my-3tier-app-ec2-role` 선택

28. [[Launch instance]] 버튼을 클릭합니다.

> [!OUTPUT]
> "Successfully initiated launch of instance (i-0abc123def456)" 메시지가 표시됩니다.
> EC2 콘솔 → Instances에서 `my-3tier-app-server`가 `Running` 상태로 변경됩니다 (약 1분 소요).

### 5-2. EC2 초기 설정

```bash
# SSM Session Manager로 EC2 접속 (AWS Console에서)
# EC2 콘솔 → 인스턴스 선택 → Connect → Session Manager → Connect

# 또는 AWS CLI로 접속
aws ssm start-session --target INSTANCE_ID --region ap-northeast-2

# Java 17 설치
sudo dnf install -y java-17-amazon-corretto-devel

# JAVA_HOME 설정
echo 'export JAVA_HOME=/usr/lib/jvm/java-17-amazon-corretto' | sudo tee -a /etc/profile.d/java.sh
source /etc/profile.d/java.sh

# Java 버전 확인
java -version

# MySQL 클라이언트 설치 (RDS 접속 테스트용)
sudo dnf install -y mariadb105
```

### 5-2b. 기존 프로젝트 SQL 실행 (방법 C 해당자만)

> [!NOTE]
> 태스크 2-2에서 **방법 C**를 선택한 경우에만 이 단계를 진행합니다.  
> 방법 A(ddl-auto) 또는 방법 B(schema.sql)를 사용하면 앱 시작 시 자동 처리되므로 건너뛰세요.

Step 2-3에서 `board.sql`, `member.sql` 등으로 EC2 로컬 MySQL에 세팅했던 것과 동일한 작업을 Amazon RDS에 수행합니다.

> [!NOTE]
> 아래 명령어의 파일명은 예시입니다.  
> 본인 프로젝트에서 사용하는 SQL/CSV 파일명으로 변경하세요.

```bash
# 로컬에서 기존 SQL/CSV 파일을 S3에 업로드 (예시)
aws s3 cp board.sql s3://<S3_DEPLOY_BUCKET>/
aws s3 cp member.sql s3://<S3_DEPLOY_BUCKET>/
aws s3 cp travel.sql s3://<S3_DEPLOY_BUCKET>/
aws s3 cp travel.csv s3://<S3_DEPLOY_BUCKET>/
aws s3 cp travel_image.csv s3://<S3_DEPLOY_BUCKET>/

# EC2에서 S3에서 다운로드 (SSM Session Manager 접속 상태에서)
aws s3 cp s3://<S3_DEPLOY_BUCKET>/board.sql /home/ec2-user/
aws s3 cp s3://<S3_DEPLOY_BUCKET>/member.sql /home/ec2-user/
aws s3 cp s3://<S3_DEPLOY_BUCKET>/travel.sql /home/ec2-user/
aws s3 cp s3://<S3_DEPLOY_BUCKET>/travel.csv /home/ec2-user/
aws s3 cp s3://<S3_DEPLOY_BUCKET>/travel_image.csv /home/ec2-user/

# Amazon RDS에 접속하여 SQL 실행
mysql -h <RDS_ENDPOINT> -u admin -p

source /home/ec2-user/board.sql;
source /home/ec2-user/member.sql;
source /home/ec2-user/travel.sql;

SHOW TABLES;
EXIT;
```

**CSV 데이터가 있는 경우 (`LOAD DATA LOCAL INFILE`):**

```bash
# --local-infile 옵션 필수
mysql -h <RDS_ENDPOINT> -u admin -p --local-infile=1 <DB_NAME> -e "
  LOAD DATA LOCAL INFILE '/home/ec2-user/travel.csv'
  INTO TABLE tbl_travel
  FIELDS TERMINATED BY ',' ENCLOSED BY '\"'
  LINES TERMINATED BY '\n'
  IGNORE 1 ROWS;"

mysql -h <RDS_ENDPOINT> -u admin -p --local-infile=1 <DB_NAME> -e "
  LOAD DATA LOCAL INFILE '/home/ec2-user/travel_image.csv'
  INTO TABLE tbl_travel_image
  FIELDS TERMINATED BY ','
  LINES TERMINATED BY '\n'
  IGNORE 1 ROWS (filename, travel_no);"

# 확인
mysql -h <RDS_ENDPOINT> -u admin -p <DB_NAME> -e "SELECT COUNT(*) FROM tbl_travel;"
```

> [!WARNING]
> Step 2-3에서 사용했던 SQL에 `CREATE USER 'scoula'@'%'` 등이 포함된 경우,  
> Amazon RDS에서는 `admin` 계정으로 접속하여 실행하면 됩니다.  
> Amazon RDS의 마스터 사용자(`admin`)가 해당 권한을 갖고 있습니다.

> [!TIP]
> `<RDS_ENDPOINT>`는 Step 8-1 AWS CloudFormation Outputs의 RDSEndpoint 값입니다.  
> `<DB_NAME>`은 스택 생성 시 설정한 데이터베이스 이름(기본: `myapp`)입니다.  
> SQL 파일 내에서 별도 DB를 생성하는 경우(`CREATE DATABASE scoula_db`), `<DB_NAME>`과 다를 수 있으므로 `application.properties`의 DB 이름과 일치시키세요.

### 5-3. 앱 디렉토리 및 시작 스크립트 생성

```bash
# 앱 디렉토리 생성
mkdir -p /home/ec2-user/app

# 시작 스크립트 생성
cat << 'SCRIPT' > /home/ec2-user/app/start.sh
#!/bin/bash

# SSM Parameter Store에서 값 가져오기
export DB_ENDPOINT=$(aws ssm get-parameter --name "/my-3tier-app/db/endpoint" --query "Parameter.Value" --output text --region ap-northeast-2)
export DB_NAME=$(aws ssm get-parameter --name "/my-3tier-app/db/name" --query "Parameter.Value" --output text --region ap-northeast-2)
export DB_USERNAME=$(aws ssm get-parameter --name "/my-3tier-app/db/username" --query "Parameter.Value" --output text --region ap-northeast-2)
export DB_PASSWORD=$(aws ssm get-parameter --name "/my-3tier-app/db/password" --with-decryption --query "Parameter.Value" --output text --region ap-northeast-2)

# Spring Boot 실행
exec java -jar /home/ec2-user/app/app.jar \
  --spring.profiles.active=prod
SCRIPT

chmod +x /home/ec2-user/app/start.sh
```

### 5-4. systemd 서비스 등록

```bash
sudo tee /etc/systemd/system/spring-app.service << 'EOF'
[Unit]
Description=Spring Boot Application
After=network.target

[Service]
User=ec2-user
WorkingDirectory=/home/ec2-user/app
ExecStart=/home/ec2-user/app/start.sh
Environment=JAVA_OPTS=-Xms256m -Xmx512m
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable spring-app
```

### 5-5. 로컬에서 빌드 및 EC2 전송

> [!NOTE]
> EC2가 Private Subnet에 있으므로 SSH(scp)로 직접 파일을 전송할 수 없습니다.  
> Amazon S3를 경유하여 JAR/WAR 파일을 EC2에 전달합니다.

**Spring Boot (JAR) 방식:**

```bash
# 로컬에서 빌드 (Permission denied 시: chmod +x ./gradlew)
cd ~/3tier-project/my-backend
./gradlew clean bootJar

# S3에 업로드 (배포용 버킷 사용)
aws s3 cp build/libs/my-backend-0.0.1-SNAPSHOT.jar s3://<S3_DEPLOY_BUCKET>/app.jar
```

**Spring MVC (WAR + Tomcat) 방식:**

```bash
# 로컬에서 빌드
cd ~/3tier-project/my-backend
./gradlew clean build -x test

# S3에 업로드
aws s3 cp build/libs/my-backend-0.0.1-SNAPSHOT.war s3://<S3_DEPLOY_BUCKET>/app.war
```

**EC2에서 다운로드 (SSM Session Manager로 접속 후):**

```bash
# JAR 방식
aws s3 cp s3://<S3_DEPLOY_BUCKET>/app.jar /home/ec2-user/app/app.jar

# WAR 방식
aws s3 cp s3://<S3_DEPLOY_BUCKET>/app.war /home/ec2-user/app/app.war
sudo cp /home/ec2-user/app/app.war /usr/share/tomcat/webapps/ROOT.war
```

> [!TIP]
> `<S3_DEPLOY_BUCKET>`은 배포 아티팩트 저장용 S3 버킷입니다.  
> 프론트엔드 버킷과 별도로 생성하거나, 기존 버킷에 `deploy/` 접두사로 구분하여 사용할 수 있습니다.
>
> **배포용 버킷 빠르게 생성:**
>
> ```bash
> aws s3 mb s3://my-3tier-app-deploy-<BucketSuffix> --region ap-northeast-2
> ```
>
> 이 버킷명을 태스크 6에서 GitHub Secrets `S3_DEPLOY_BUCKET`에 등록합니다.

> [!TIP]
> **Spring MVC (WAR) 사용 시 추가 작업:**
>
> Amazon EC2에 Tomcat을 설치하고 WAR를 배포해야 합니다:
>
> ```bash
> # Tomcat 설치 (Amazon Linux 2023)
> sudo dnf install -y tomcat
>
> # WAR 파일을 Tomcat webapps에 복사
> sudo cp /home/ec2-user/app/app.war /usr/share/tomcat/webapps/ROOT.war
>
> # Tomcat 시작
> sudo systemctl enable tomcat
> sudo systemctl start tomcat
> ```
>
> Tomcat은 기본 8080 포트에서 실행됩니다.  
> 위 systemd 서비스(spring-app.service) 대신 Tomcat 서비스를 사용합니다.  
> Health Check 경로도 앱에 맞게 변경하세요 (예: `/` 또는 `/health`).

> [!NOTE]
> **어떤 방식을 선택해야 하나요?**
>
> | 방식                  | 적합한 경우                               |
> | --------------------- | ----------------------------------------- |
> | **Spring Boot (JAR)** | 새 프로젝트, 내장 Tomcat 사용 (권장)      |
> | **Spring MVC (WAR)**  | KB IT's Your Life 등 기존 레거시 프로젝트 |
>
> Spring Boot JAR이 배포가 간단하고 관리가 쉽습니다.  
> 기존 WAR 프로젝트가 있다면 그대로 사용하되, 장기적으로는 JAR 전환을 권장합니다.

### 5-6. EC2에서 애플리케이션 시작

```bash
# EC2에서 실행
sudo systemctl start spring-app

# 상태 확인
sudo systemctl status spring-app

# 로그 확인
sudo journalctl -u spring-app -f
```

### 5-7. ALB Target Group에 EC2 등록

29. 상단 검색창에 `EC2`를 입력하고 **EC2** 서비스를 선택합니다.
30. 왼쪽 메뉴에서 **Target Groups**를 클릭합니다.
31. `my-3tier-app-tg`를 클릭합니다.
32. **Targets** 탭을 클릭합니다.
33. [[Register targets]] 버튼을 클릭합니다.
34. **Available instances**에서 `my-3tier-app-server`를 체크합니다.
35. **Ports for the selected instances**: `8080` 입력
36. [[Include as pending below]] 버튼을 클릭합니다.
37. 하단의 **Review** 섹션에서 인스턴스가 추가된 것을 확인합니다.
38. [[Register pending targets]] 버튼을 클릭합니다.

> [!OUTPUT]
> Target Group의 Targets 탭에서 등록된 인스턴스를 확인합니다:
>
> | Instance ID     | Port | Health Status | Status Details                  |
> | --------------- | ---- | ------------- | ------------------------------- |
> | i-0abc123def456 | 8080 | initial       | Target registration in progress |
>
> 약 30초~1분 후 `healthy`로 변경됩니다.
> `unhealthy`가 표시되면 아래 TROUBLESHOOTING을 참고하세요.

> [!NOTE]
> Target Group에 등록 후 Health Check가 통과하면 Status가 `healthy`로 변경됩니다.
> Health Check 경로는 `/actuator/health`로 설정되어 있습니다.
> 약 30초~1분 후 상태를 확인하세요.

✅ **태스크 완료** — Amazon EC2에 Spring Boot를 배포하고 ALB Target Group에 등록했습니다.

> [!TROUBLESHOOTING]
> | 증상 | 원인 | 해결 방법 |
> |------|------|-----------|
> | Target Group Status: `unhealthy` | 앱 미시작 또는 Health Check 경로 불일치 | EC2에서 `curl http://localhost:8080/actuator/health` 확인 |
> | `systemctl start spring-app` 실패 | Java 미설치 또는 JAR 경로 오류 | `java -version` 확인, `/home/ec2-user/app/app.jar` 존재 확인 |
> | SSM Session Manager 접속 불가 | IAM Role 미연결 또는 VPC 엔드포인트 없음 | EC2에 `AmazonSSMManagedInstanceCore` 정책 연결 확인 |
> | `start.sh`에서 SSM 값 못 가져옴 | EC2 IAM Role에 SSM 읽기 권한 없음 | `AmazonSSMReadOnlyAccess` 정책 추가 |
> | ALB Health Check 경로 불일치 | Target Group의 Health Check 경로 설정 오류 | Target Group → Health checks → `/actuator/health` 확인 |

> [!TIP]
> Amazon EC2에서 앱 로그를 실시간으로 확인하려면:
>
> ```bash
> sudo journalctl -u spring-app -f
> ```
>
> 이 명령으로 Spring Boot 시작 에러, DB 연결 실패 등을 즉시 확인할 수 있습니다.

---

## 태스크 6: GitHub Actions CI/CD

코드를 push하면 자동으로 빌드 → Amazon EC2 배포 → Health Check가 실행되는 파이프라인을 구축합니다.

### 6-1. IAM 사용자 생성 (GitHub Actions용)

39. 상단 검색창에 `IAM`을 입력하고 **IAM** 서비스를 선택합니다.
40. 왼쪽 메뉴에서 **IAM Users**를 클릭합니다.
41. [[Create user]]를 클릭합니다.
42. **User name**: `github-actions-backend`를 입력합니다.
43. **Provide user access to the AWS Management Console** 체크를 **하지 않습니다** (콘솔 접근 불필요).
44. [[Next]]를 클릭합니다.
45. **Permissions options**에서 `Attach policies directly`를 선택합니다.
46. 다음 정책을 검색하여 체크합니다:
    - `AmazonS3FullAccess` (JAR 업로드용)
    - `AmazonSSMFullAccess` (SSM Run Command 실행용)
47. [[Next]]를 클릭합니다.
48. **Review and create** 페이지에서 설정을 확인하고 [[Create user]]를 클릭합니다.

### Access Key 생성

49. 생성된 `github-actions-backend` 사용자를 클릭하여 상세 페이지로 이동합니다.
50. **Security credentials** 탭을 클릭합니다.
51. **Access keys** 섹션에서 [[Create access key]]를 클릭합니다.
52. **Use case**에서 `Third-party service`를 선택합니다.
53. 하단의 확인 체크박스를 선택하고 [[Next]]를 클릭합니다.
54. [[Create access key]]를 클릭합니다.
55. **Access key ID**와 **Secret access key**를 복사하여 안전한 곳에 저장합니다.

> [!WARNING]
> Secret access key는 이 화면에서만 확인할 수 있습니다.  
> 페이지를 닫으면 다시 볼 수 없으므로 반드시 복사하여 저장하세요.

### 6-2. GitHub Secrets 설정

56. 브라우저에서 GitHub → `my-backend` 리포지토리 페이지로 이동합니다.
57. **Settings** 탭을 클릭합니다.
58. 왼쪽 메뉴에서 **Secrets and variables** → **Actions**를 클릭합니다.
59. [[New repository secret]] 버튼을 클릭합니다.
60. 다음 Secrets를 하나씩 추가합니다:
    - `AWS_ACCESS_KEY_ID`: 55번에서 복사한 Access Key ID
    - `AWS_SECRET_ACCESS_KEY`: 55번에서 복사한 Secret Access Key
    - `AWS_REGION`: `ap-northeast-2`
    - `S3_DEPLOY_BUCKET`: `<태스크 5-5에서 생성한 배포용 S3 버킷명>`
    - `EC2_INSTANCE_ID`: `<태스크 5-1에서 생성한 Amazon EC2 인스턴스 ID (예: i-0abc123def456)>`

> [!CONCEPT] Private Subnet Amazon EC2에 배포하는 방법
> Private Subnet의 Amazon EC2에는 SSH로 직접 접속할 수 없습니다.
> 대신 다음 방식으로 배포합니다:
>
> - GitHub Actions에서 JAR을 Amazon S3에 업로드
> - SSM Run Command로 Amazon EC2에서 Amazon S3 다운로드 + 재시작 명령 실행
>
> 이 방식은 SSH 키 관리가 불필요하고 보안상 더 안전합니다.

> [!TIP]
> **application.properties를 GitHub Secrets로 관리하는 방법 (선택)**
>
> `.gitignore`에 `application.properties`를 추가하고, 빌드 시 GitHub Secrets에서 파일을 생성할 수 있습니다.
> DB 비밀번호 등 민감 정보가 코드에 노출되지 않아 안전합니다.
>
> **1단계: GitHub Secrets에 설정 파일 내용 등록**
>
> | Secret Name              | 값                                                 |
> | ------------------------ | -------------------------------------------------- |
> | `APPLICATION_PROPERTIES` | `application.properties` 파일 전체 내용 (멀티라인) |
>
> **2단계: 워크플로우에서 파일 생성 스텝 추가**
>
> ```yaml
> # application.properties 생성 (Secrets에서 주입)
> - name: Create application.properties
>   run: |
>     mkdir -p src/main/resources
>     echo "${{ secrets.APPLICATION_PROPERTIES }}" > src/main/resources/application.properties
> ```
>
> **3단계: .gitignore에 추가**
>
> ```gitignore
> # 비밀값이 포함된 설정 파일
> src/main/resources/application.properties
> src/main/resources/application.yml
> ```
>
> 이 방식은 Spring MVC(WAR) 프로젝트처럼 SSM Parameter Store를 사용하기 어려운 경우에 유용합니다.
> Spring Boot 프로젝트에서도 SSM 대신 이 방식을 사용할 수 있습니다.

### 6-3. GitHub Actions 워크플로우 작성

`.github/workflows/deploy.yml` 파일을 생성합니다:

```yaml
# .github/workflows/deploy.yml
name: Deploy Spring Boot to EC2 (via S3 + SSM)

on:
  push:
    branches: [main]
    paths:
      - 'src/**'
      - 'build.gradle'
      - '.github/workflows/deploy.yml'

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest

    steps:
      # 1. 소스 코드 체크아웃
      - name: Checkout source code
        uses: actions/checkout@v4

      # 2. JDK 17 설정
      - name: Set up JDK 17
        uses: actions/setup-java@v4
        with:
          java-version: '17'
          distribution: 'corretto'

      # 3. Gradle 캐시
      - name: Cache Gradle packages
        uses: actions/cache@v4
        with:
          path: |
            ~/.gradle/caches
            ~/.gradle/wrapper
          key: ${{ runner.os }}-gradle-${{ hashFiles('**/*.gradle*') }}
          restore-keys: ${{ runner.os }}-gradle-

      # 4. Gradle 빌드
      - name: Build with Gradle
        run: |
          chmod +x ./gradlew
          ./gradlew clean bootJar

      # 5. AWS 자격 증명 설정
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ secrets.AWS_REGION }}

      # 6. JAR 파일을 Amazon S3에 업로드
      - name: Upload JAR to S3
        run: |
          JAR_FILE=$(ls build/libs/*.jar | head -1)
          aws s3 cp "$JAR_FILE" s3://${{ secrets.S3_DEPLOY_BUCKET }}/app.jar

      # 7. SSM Run Command로 EC2에서 배포 실행
      - name: Deploy via SSM Run Command
        run: |
          COMMAND_ID=$(aws ssm send-command \
            --instance-ids "${{ secrets.EC2_INSTANCE_ID }}" \
            --document-name "AWS-RunShellScript" \
            --parameters 'commands=[
              "aws s3 cp s3://${{ secrets.S3_DEPLOY_BUCKET }}/app.jar /home/ec2-user/app/app.jar",
              "sudo systemctl restart spring-app",
              "sleep 15",
              "curl -sf http://localhost:8080/actuator/health || exit 1"
            ]' \
            --query "Command.CommandId" \
            --output text)

          echo "SSM Command ID: $COMMAND_ID"

          # 명령 완료 대기
          aws ssm wait command-executed \
            --command-id "$COMMAND_ID" \
            --instance-id "${{ secrets.EC2_INSTANCE_ID }}"

          echo "✅ 배포 완료!"
```

### 6-4. 배포 테스트

```bash
cd ~/3tier-project/my-backend

# 변경사항 커밋 및 푸시
git add .
git commit -m "feat: initial backend with CI/CD"
git push origin main
```

GitHub → **Actions** 탭에서 워크플로우 실행을 확인합니다.

> [!TIP]
> 첫 빌드는 Gradle 의존성 다운로드로 3~4분 소요됩니다.
> 이후 빌드는 캐시 덕분에 1~2분으로 단축됩니다.

✅ **태스크 완료** — GitHub Actions로 백엔드 자동 배포 파이프라인을 구축했습니다.

> [!TROUBLESHOOTING]
> | 증상 | 원인 | 해결 방법 |
> |------|------|-----------|
> | `Upload failed: NoSuchBucket` | S3 버킷명 Secret 오류 | `S3_DEPLOY_BUCKET` Secret 값이 실제 버킷명과 일치하는지 확인 |
> | `SSM SendCommand failed` | Amazon EC2 인스턴스 ID 오류 또는 IAM 권한 부족 | `EC2_INSTANCE_ID` 확인, GitHub Actions IAM에 `ssm:SendCommand` 권한 추가 |
> | `CommandInvocationStatus: Failed` | EC2에서 명령 실행 실패 | EC2에서 수동으로 같은 명령 실행하여 에러 확인 |
> | `aws ssm wait` 타임아웃 | SSM Agent 미설치 또는 EC2 미실행 | EC2 상태 확인, Amazon Linux 2023은 SSM Agent 기본 설치됨 |
> | Gradle 빌드 실패 (GitHub Actions) | Java 버전 불일치 | `setup-java`의 `java-version`이 프로젝트와 일치하는지 확인 |

> [!NOTE]
> Private Subnet의 Amazon EC2에 SSM Run Command를 사용하려면 Amazon EC2가 SSM 서비스에 접근할 수 있어야 합니다.
> NAT Gateway가 있으면 자동으로 가능하고, 없다면 VPC Endpoint(ssm, ssmmessages, ec2messages)가 필요합니다.

---

## 태스크 7: ALB Health Check 확인 + API 테스트

### 7-1. ALB Target Group Health Check 확인

61. **EC2** → **Target Groups** → `my-3tier-app-tg`를 클릭합니다.
62. **Targets** 탭에서 등록된 인스턴스의 Status를 확인합니다:

- `healthy`: 정상 (Health Check 통과)
- `unhealthy`: 비정상 (로그 확인 필요)
- `initial`: 초기 Health Check 진행 중

> [!OUTPUT]
> Status가 `healthy`이면 ALB DNS Name으로 접속할 수 있습니다:
>
> ```bash
> curl http://my-3tier-app-alb-xxx.ap-northeast-2.elb.amazonaws.com/actuator/health
> ```
>
> 예상 응답:
>
> ```json
> {
>   "status": "UP",
>   "components": { "db": { "status": "UP" }, "diskSpace": { "status": "UP" } }
> }
> ```

> [!WARNING]
> Status가 `unhealthy`인 경우 확인사항:
>
> - EC2에서 `sudo systemctl status spring-app`으로 앱 실행 상태 확인
> - `curl http://localhost:8080/actuator/health`로 로컬 Health Check
> - Security Group에서 8080 포트가 ALB-SG에서 허용되는지 확인
> - `sudo journalctl -u spring-app -n 50`으로 에러 로그 확인

### 7-2. ALB를 통한 API 테스트

ALB DNS Name으로 API를 호출합니다:

```bash
# ALB DNS Name (AWS CloudFormation Outputs에서 확인)
ALB_DNS="my-3tier-app-alb-xxx.ap-northeast-2.elb.amazonaws.com"

# Health Check
curl http://$ALB_DNS/actuator/health
```

예상 응답:

```json
{
  "status": "UP",
  "components": {
    "db": { "status": "UP" },
    "diskSpace": { "status": "UP" }
  }
}
```

### 7-3. CRUD API 테스트

```bash
# 아이템 생성
curl -X POST http://$ALB_DNS/api/items \
  -H "Content-Type: application/json" \
  -d '{"name": "첫 번째 아이템", "description": "테스트 아이템입니다"}'

# 전체 조회
curl http://$ALB_DNS/api/items

# 단건 조회
curl http://$ALB_DNS/api/items/1

# 수정
curl -X PUT http://$ALB_DNS/api/items/1 \
  -H "Content-Type: application/json" \
  -d '{"name": "수정된 아이템", "description": "수정 완료"}'

# 삭제
curl -X DELETE http://$ALB_DNS/api/items/1
```

### 7-4. RDS 데이터 확인

```bash
# Amazon EC2에서 Amazon RDS 접속
mysql -h my-3tier-app-db.xxxx.ap-northeast-2.rds.amazonaws.com -u admin -p

# 데이터 확인
USE myapp;
SELECT * FROM items;
EXIT;
```

> [!CONCEPT] ALB Health Check의 동작 방식
>
> ALB는 주기적으로 (30초마다) Target Group의 인스턴스에 Health Check 요청을 보냅니다.
>
> - 경로: `/actuator/health`
> - 성공 조건: HTTP 200 응답
> - 연속 2회 성공 → `healthy`
> - 연속 3회 실패 → `unhealthy` (트래픽 라우팅 중단)
>
> 이를 통해 장애가 발생한 인스턴스로 트래픽이 전달되지 않습니다.

✅ **태스크 완료** — ALB Health Check를 확인하고 API 테스트를 완료했습니다.

---

## 🎯 셀프 미션: Auto Scaling Group으로 전환 (선택)

> [!NOTE]
> 이 셀프 미션은 선택 사항입니다. 태스크 5~6에서 단일 Amazon EC2 배포를 완료한 후, 도전 과제로 진행하세요.

### 단일 EC2 vs ASG — 무엇이 다른가?

| 항목        | 단일 EC2 (현재)                    | Auto Scaling Group           |
| ----------- | ---------------------------------- | ---------------------------- |
| 인스턴스 수 | 1대 고정                           | 최소~최대 범위에서 자동 조절 |
| 장애 대응   | 수동 복구                          | 자동으로 새 인스턴스 생성    |
| 배포 방식   | SSM Run Command (Instance ID 고정) | Instance Refresh (순차 교체) |
| CI/CD       | Instance ID를 Secret에 등록        | ASG 이름을 Secret에 등록     |
| 비용        | 1대 고정 비용                      | 트래픽에 따라 유동적         |

### 전환 시 주의사항

- ASG 인스턴스는 **동적으로 생성/삭제**됩니다. Instance ID를 고정할 수 없습니다.
- 새 인스턴스가 생성될 때 **자동으로 앱이 설치+시작**되어야 합니다 (Launch Template의 User Data 활용).
- 배포 시에는 새 JAR을 S3에 업로드한 뒤 **Instance Refresh**로 인스턴스를 순차 교체합니다.
- Health Check가 통과해야 새 인스턴스가 서비스에 투입됩니다.

### 구현 가이드

**1단계: Launch Template 생성**

Launch Template의 **User Data**에 앱 설치+시작 스크립트를 포함합니다:

```bash
#!/bin/bash
# User Data — 인스턴스 시작 시 자동 실행

# Java 설치
dnf install -y java-17-amazon-corretto-devel

# 앱 디렉토리 생성
mkdir -p /home/ec2-user/app

# S3에서 최신 JAR 다운로드
aws s3 cp s3://<S3_DEPLOY_BUCKET>/app.jar /home/ec2-user/app/app.jar

# start.sh 생성 (태스크 5-3과 동일)
cat << 'SCRIPT' > /home/ec2-user/app/start.sh
#!/bin/bash
export DB_ENDPOINT=$(aws ssm get-parameter --name "/my-3tier-app/db/endpoint" --query "Parameter.Value" --output text --region ap-northeast-2)
export DB_NAME=$(aws ssm get-parameter --name "/my-3tier-app/db/name" --query "Parameter.Value" --output text --region ap-northeast-2)
export DB_USERNAME=$(aws ssm get-parameter --name "/my-3tier-app/db/username" --query "Parameter.Value" --output text --region ap-northeast-2)
export DB_PASSWORD=$(aws ssm get-parameter --name "/my-3tier-app/db/password" --with-decryption --query "Parameter.Value" --output text --region ap-northeast-2)
exec java -jar /home/ec2-user/app/app.jar --spring.profiles.active=prod
SCRIPT
chmod +x /home/ec2-user/app/start.sh
chown -R ec2-user:ec2-user /home/ec2-user/app

# systemd 서비스 등록 + 시작
cat << 'EOF' > /etc/systemd/system/spring-app.service
[Unit]
Description=Spring Boot Application
After=network.target
[Service]
User=ec2-user
WorkingDirectory=/home/ec2-user/app
ExecStart=/home/ec2-user/app/start.sh
Restart=on-failure
RestartSec=10
[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable spring-app
systemctl start spring-app
```

**2단계: ASG 생성**

- AWS Console → EC2 → Auto Scaling Groups → [[Create Auto Scaling group]]
- Launch Template: 위에서 생성한 템플릿 선택
- VPC: `my-3tier-app-vpc`, Subnet: Private Subnet 1, 2
- Load balancing: 기존 `my-3tier-app-tg` Target Group 연결
- Health check: ELB health check 활성화
- Desired capacity: 2, Minimum: 1, Maximum: 4

**3단계: CI/CD 워크플로우 변경**

GitHub Secrets에 `ASG_NAME`을 추가하고, 워크플로우를 다음과 같이 변경합니다:

```yaml
# .github/workflows/deploy.yml (ASG 버전)
name: Deploy Spring Boot to ASG (via S3 + Instance Refresh)

on:
  push:
    branches: [main]
    paths:
      - 'src/**'
      - 'build.gradle'
      - '.github/workflows/deploy.yml'

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout source code
        uses: actions/checkout@v4

      - name: Set up JDK 17
        uses: actions/setup-java@v4
        with:
          java-version: '17'
          distribution: 'corretto'

      - name: Cache Gradle packages
        uses: actions/cache@v4
        with:
          path: |
            ~/.gradle/caches
            ~/.gradle/wrapper
          key: ${{ runner.os }}-gradle-${{ hashFiles('**/*.gradle*') }}
          restore-keys: ${{ runner.os }}-gradle-

      - name: Build with Gradle
        run: |
          chmod +x ./gradlew
          ./gradlew clean bootJar

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ secrets.AWS_REGION }}

      # S3에 새 JAR 업로드
      - name: Upload JAR to S3
        run: |
          JAR_FILE=$(ls build/libs/*.jar | head -1)
          aws s3 cp "$JAR_FILE" s3://${{ secrets.S3_DEPLOY_BUCKET }}/app.jar

      # ASG Instance Refresh 실행 (인스턴스를 순차 교체)
      - name: Start Instance Refresh
        run: |
          aws autoscaling start-instance-refresh \
            --auto-scaling-group-name ${{ secrets.ASG_NAME }} \
            --preferences '{"MinHealthyPercentage": 50, "InstanceWarmup": 60}'

          echo "✅ Instance Refresh 시작! 새 인스턴스가 최신 JAR로 교체됩니다."
```

> [!CONCEPT] Instance Refresh 동작 방식
>
> - ASG의 인스턴스를 **순차적으로 교체** (Rolling Update)
> - 새 인스턴스가 Launch Template의 User Data를 실행 → S3에서 최신 JAR 다운로드 → 앱 시작
> - ALB Health Check 통과 후 이전 인스턴스 종료
> - `MinHealthyPercentage: 50` — 최소 50% 인스턴스는 항상 서비스 중
> - 무중단 배포 (Zero-downtime deployment) 달성

> [!TIP]
> **Step 8 (EC2/ASG) vs Step 9 (Docker/ECS Fargate) 배포 방식 비교:**
>
> | 항목        | EC2 단일                          | EC2 + ASG                | ECS Fargate (Step 9)       |
> | ----------- | --------------------------------- | ------------------------ | -------------------------- |
> | 서버 관리   | 직접 관리 (Java 설치, systemd 등) | Launch Template에 정의   | **관리 불필요** (서버리스) |
> | 배포 방식   | SSM Run Command                   | Instance Refresh         | Docker 이미지 교체         |
> | 확장        | 수동                              | 자동 (CPU/메모리 기반)   | 자동 (더 빠름)             |
> | 배포 속도   | 즉시 (재시작만)                   | 3~5분 (인스턴스 교체)    | 2~3분 (Task 교체)          |
> | 환경 일관성 | EC2마다 다를 수 있음              | Launch Template으로 통일 | **Docker 이미지로 보장**   |
> | 비용        | EC2 시간당 과금                   | EC2 시간당 과금          | 실행 시간 기반 과금        |
>
> Step 9에서는 Docker + Amazon ECR + Amazon ECS Fargate를 사용하여 서버 관리 없이 컨테이너 기반 배포를 학습합니다.
> EC2/ASG 방식의 한계(서버 패치, Java 버전 관리, 환경 불일치 등)를 Docker로 해결합니다.

> [!WARNING]
> **ASG 전환 시 추가 비용 발생:**
>
> - ASG 자체는 무료이지만, 최소 인스턴스 수만큼 Amazon EC2 비용 발생
> - Desired capacity: 2이면 `t2.micro` 2대 비용 (프리티어는 1대만 적용)
> - Instance Refresh 중에는 일시적으로 인스턴스가 더 많아질 수 있음
>
> 학습 완료 후 반드시 ASG를 삭제하세요 (Step 8-4에서 정리).

---

# 🗑️ 리소스 정리

> [!WARNING]
> 이 세션에서 생성한 리소스를 지금 삭제하지 마세요!
> Step 8-4에서 전체 연동 확인 후 정리합니다.
> **Step 8-4에서 전체 정리합니다.**

### 이 세션에서 추가 생성한 리소스

| 리소스         | 이름/식별자           | 시간당 비용 | 월 비용 추정 | 비고                           |
| -------------- | --------------------- | ----------- | ------------ | ------------------------------ |
| EC2 Instance   | `my-3tier-app-server` | $0.0116     | $8.35        | t2.micro 프리티어 해당 시 무료 |
| SSM Parameters | 4개                   | 무료        | 무료         | Standard 타입                  |
| IAM Role       | EC2용 SSM 읽기 역할   | 무료        | 무료         | -                              |

> [!TIP]
> Amazon EC2 인스턴스가 프리티어 대상(계정 생성 12개월 이내)이라면 t2.micro는 월 750시간 무료입니다.
> 프리티어가 만료된 경우 Amazon EC2도 시간당 비용이 발생하므로 실습 후 빠르게 정리하세요.

✅ **실습 종료**: Step 8-4에서 전체 연동을 확인하고 리소스를 정리합니다.

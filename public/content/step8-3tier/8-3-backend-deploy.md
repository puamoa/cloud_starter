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
Amazon EC2에 배포하여 ALB와 연결합니다. GitHub Actions로 자동 배포 파이프라인도 구축합니다.

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

### B-1. Spring Initializr로 프로젝트 생성

1. 브라우저에서 [https://start.spring.io](https://start.spring.io)에 접속합니다.
2. 다음과 같이 설정합니다:

| 설정        | 값                                        |
| ----------- | ----------------------------------------- |
| Project     | Gradle - Groovy                           |
| Language    | Java                                      |
| Spring Boot | 최신 안정 버전 (예: `4.0.6` 또는 `3.5.x`) |
| Group       | com.example                               |
| Artifact    | my-backend                                |
| Packaging   | Jar                                       |
| Java        | 17                                        |

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

프로젝트 구조:

```
my-backend/
├── src/
│   ├── main/
│   │   ├── java/com/example/mybackend/
│   │   │   ├── MyBackendApplication.java
│   │   │   ├── controller/
│   │   │   │   └── ItemController.java
│   │   │   ├── entity/
│   │   │   │   └── Item.java
│   │   │   ├── repository/
│   │   │   │   └── ItemRepository.java
│   │   │   └── config/
│   │   │       └── WebConfig.java
│   │   └── resources/
│   │       └── application.yml
│   └── test/
├── build.gradle
├── settings.gradle
└── .github/workflows/deploy.yml
```

✅ **태스크 완료** — Spring Boot 프로젝트를 생성했습니다.

---

## 태스크 2: RDS 연동 설정

### 2-1. SSM Parameter Store에 비밀값 저장

Amazon EC2에서 Amazon RDS 접속 정보를 안전하게 관리하기 위해 SSM Parameter Store를 사용합니다.

```bash
# Amazon RDS 엔드포인트 저장
aws ssm put-parameter \
  --name "/my-3tier-app/db/endpoint" \
  --value "my-3tier-app-db.xxxx.ap-northeast-2.rds.amazonaws.com" \
  --type String

# DB 이름 저장
aws ssm put-parameter \
  --name "/my-3tier-app/db/name" \
  --value "myapp" \
  --type String

# DB 사용자명 저장
aws ssm put-parameter \
  --name "/my-3tier-app/db/username" \
  --value "admin" \
  --type String

# DB 비밀번호 저장 (SecureString으로 암호화)
aws ssm put-parameter \
  --name "/my-3tier-app/db/password" \
  --value "MyPassword123!" \
  --type SecureString
```

> [!TIP]
> `SecureString` 타입은 AWS KMS로 자동 암호화됩니다.
> 비밀번호, API 키 등 민감한 값은 항상 SecureString을 사용하세요.

### 2-2. RDS 초기 데이터베이스 및 테이블 설정

> [!NOTE]
> Step 8-1에서 AWS CloudFormation `DBName` 파라미터로 `myapp` 데이터베이스가 **자동 생성**되었습니다.  
> 별도로 `CREATE DATABASE`를 실행할 필요가 없습니다.  
> 테이블 생성은 아래 방법 중 본인 프로젝트에 맞는 것을 선택하세요.

**방법 A: Spring Boot — 자동 테이블 생성 (새 프로젝트)**

Spring Boot의 JPA `ddl-auto` 설정으로 앱 시작 시 테이블이 자동 생성됩니다.  
`application.yml`에서 `ddl-auto: update`를 설정하면 Entity 클래스 기반으로 테이블을 만들어줍니다.  
별도 SQL 실행이 필요 없습니다.

**방법 B: Spring Boot — schema.sql / data.sql 사용**

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

**방법 C: EC2에서 수동 SQL 실행 (기존 레거시 프로젝트)**

기존 `.sql` 파일이 있고 Spring 자동 초기화를 사용하지 않는 경우, Amazon EC2에서 직접 실행합니다:

```bash
# EC2에 SSM Session Manager로 접속 후
mysql -h my-3tier-app-db.xxxx.ap-northeast-2.rds.amazonaws.com \
  -u admin -p myapp

# SQL 파일 실행 (EC2에 파일을 먼저 전송해야 함)
source /home/ec2-user/schema.sql;
source /home/ec2-user/data.sql;

# 또는 직접 입력
CREATE TABLE IF NOT EXISTS items (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(500),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SHOW TABLES;
EXIT;
```

> [!TIP]
> SQL 파일을 EC2로 전송하려면 Amazon S3를 경유합니다 (Private Subnet이므로 SCP 불가):
>
> ```bash
> # 로컬에서 S3에 업로드
> aws s3 cp schema.sql s3://MY_BUCKET/schema.sql
>
> # EC2에서 S3에서 다운로드
> aws s3 cp s3://MY_BUCKET/schema.sql /home/ec2-user/schema.sql
> ```

### 2-3. application.yml 설정

`src/main/resources/application.yml`:

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

```java
// src/main/java/com/example/mybackend/repository/ItemRepository.java
package com.example.mybackend.repository;

import com.example.mybackend.entity.Item;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ItemRepository extends JpaRepository<Item, Long> {
}
```

### 3-3. Controller 클래스

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

### 4-1. WebConfig 클래스 생성

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
> CORS 에러는 **브라우저에서만** 발생합니다. `curl`로 테스트하면 CORS 에러가 나타나지 않습니다.
> 브라우저 개발자 도구(F12) → Console 탭에서 CORS 에러 메시지를 확인하세요.

---

## 태스크 5: Amazon EC2 배포 + ALB Target Group 등록

### 5-1. Amazon EC2 인스턴스 생성

### 5-1. Amazon EC2 인스턴스 생성

1. 상단 검색창에 `EC2`를 입력하고 **EC2** 서비스를 선택합니다.
2. 왼쪽 메뉴에서 **Instances**를 클릭합니다.
3. [[Launch instances]] 버튼을 클릭합니다.
4. **Name and tags** 섹션:
   - **Name**: `my-3tier-app-server`
5. **Application and OS Images (Amazon Machine Image)** 섹션:
   - **AMI**: `Amazon Linux 2023` 선택 (기본 선택됨)
6. **Instance type** 섹션:
   - `t2.micro` 선택 (프리티어 대상)
7. **Key pair (login)** 섹션:
   - `Proceed without a key pair (Not recommended)` 선택
   - SSM Session Manager로 접속하므로 SSH 키가 불필요합니다.
8. **Network settings** 섹션에서 [[Edit]] 버튼을 클릭합니다.
9. 다음과 같이 설정합니다:
   - **VPC**: `my-3tier-app-vpc` 선택
   - **Subnet**: `my-3tier-app-private-subnet-1` 선택
   - **Auto-assign public IP**: `Disable` 선택
   - **Firewall (security groups)**: `Select existing security group` 선택
   - **Common security groups**: `my-3tier-app-ec2-sg` 선택

> [!WARNING]
> **Auto-assign public IP**를 반드시 `Disable`로 설정하세요.
> Private Subnet에 배치하므로 Public IP가 필요 없습니다.

10. **Advanced details** 섹션을 펼칩니다.
11. **IAM instance profile** 드롭다운에서 SSM + Parameter Store 읽기 권한이 있는 IAM Role을 선택합니다.
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

12. [[Launch instance]] 버튼을 클릭합니다.

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

**Spring Boot (JAR) 방식:**

```bash
# 로컬에서 빌드 (Permission denied 시: chmod +x ./gradlew)
cd ~/3tier-project/my-backend
./gradlew clean bootJar

# JAR 파일을 EC2로 전송
scp -i ~/.ssh/my-key.pem \
  build/libs/my-backend-0.0.1-SNAPSHOT.jar \
  ec2-user@EC2_PUBLIC_IP:/home/ec2-user/app/app.jar
```

**Spring MVC (WAR + Tomcat) 방식:**

```bash
# 로컬에서 빌드
cd ~/3tier-project/my-backend
./gradlew clean build -x test

# WAR 파일을 EC2로 전송
scp -i ~/.ssh/my-key.pem \
  build/libs/my-backend-0.0.1-SNAPSHOT.war \
  ec2-user@EC2_PUBLIC_IP:/home/ec2-user/app/app.war
```

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

13. 상단 검색창에 `EC2`를 입력하고 **EC2** 서비스를 선택합니다.
14. 왼쪽 메뉴에서 **Target Groups**를 클릭합니다.
15. `my-3tier-app-tg`를 클릭합니다.
16. **Targets** 탭을 클릭합니다.
17. [[Register targets]] 버튼을 클릭합니다.
18. **Available instances**에서 `my-3tier-app-server`를 체크합니다.
19. **Ports for the selected instances**: `8080` 입력
20. [[Include as pending below]] 버튼을 클릭합니다.
21. 하단의 **Review** 섹션에서 인스턴스가 추가된 것을 확인합니다.
22. [[Register pending targets]] 버튼을 클릭합니다.

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

### 6-1. GitHub Secrets 설정

25. 브라우저에서 GitHub → `my-backend` 리포지토리 페이지로 이동합니다.
26. **Settings** 탭을 클릭합니다.
27. 왼쪽 메뉴에서 **Secrets and variables** → **Actions**를 클릭합니다.
28. [[New repository secret]] 버튼을 클릭합니다.
29. 다음 Secrets를 하나씩 추가합니다:
    - **AWS_ACCESS_KEY_ID**: IAM Access Key ID (S3 업로드용)
    - **AWS_SECRET_ACCESS_KEY**: IAM Secret Access Key
    - **AWS_REGION**: `ap-northeast-2`
    - **S3_DEPLOY_BUCKET**: JAR 업로드용 S3 버킷명
    - **EC2_INSTANCE_ID**: Amazon EC2 인스턴스 ID (SSM 명령 실행용)

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

### 6-2. GitHub Actions 워크플로우 작성

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

### 6-3. 배포 테스트

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

23. **EC2** → **Target Groups** → `my-3tier-app-tg`를 클릭합니다.
24. **Targets** 탭에서 등록된 인스턴스의 Status를 확인합니다:

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

---
title: 'Spring Boot 백엔드 배포 (EC2 + ALB + CI/CD)'
week: 9
session: 3
awsServices:
  - Amazon EC2
  - Elastic Load Balancing
learningObjectives:
  - Spring Boot 프로젝트에 RDS 연동 코드를 작성할 수 있습니다.
  - EC2에 Spring Boot를 배포하고 ALB와 연결할 수 있습니다.
  - SSM Parameter Store로 비밀값을 관리할 수 있습니다.
  - GitHub Actions로 백엔드 자동 배포를 구성할 수 있습니다.
prerequisites:
  - Step 9-1 완료 (인프라 구축)
  - Java 17 + Gradle (로컬)
estimatedCost: 크레딧 내 사용 가능 (비용 발생 가능)
---

이 실습에서는 Spring Boot 백엔드를 생성하고, RDS MySQL과 연동한 후,
EC2에 배포하여 ALB와 연결합니다. GitHub Actions로 자동 배포 파이프라인도 구축합니다.

> [!NOTE]
> Step 9-1에서 생성한 CloudFormation Outputs 값이 필요합니다:
>
> - **RDSEndpoint**: 데이터베이스 연결 주소
> - **ALBTargetGroupArn**: EC2 등록 대상
> - **EC2SecurityGroupId**: EC2 인스턴스에 적용할 보안 그룹

---

## 태스크 1: Spring Boot 프로젝트 생성

### 1-1. Spring Initializr로 프로젝트 생성

1. 브라우저에서 [https://start.spring.io](https://start.spring.io)에 접속합니다.
2. 다음과 같이 설정합니다:

| 설정        | 값                     |
| ----------- | ---------------------- |
| Project     | Gradle - Groovy        |
| Language    | Java                   |
| Spring Boot | 3.2.x (최신 안정 버전) |
| Group       | com.example            |
| Artifact    | my-backend             |
| Packaging   | Jar                    |
| Java        | 17                     |

3. **Dependencies**에서 다음을 추가합니다:
   - Spring Web
   - Spring Data JPA
   - MySQL Driver
   - Spring Boot Actuator
   - Validation

4. [[GENERATE]]를 클릭하여 ZIP 파일을 다운로드합니다.

### 1-2. 프로젝트 설정

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

EC2에서 RDS 접속 정보를 안전하게 관리하기 위해 SSM Parameter Store를 사용합니다.

```bash
# RDS 엔드포인트 저장
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

### 2-2. RDS에 데이터베이스 생성

EC2에서 RDS에 접속하여 데이터베이스를 생성합니다 (EC2 생성 후 실행):

```bash
# EC2에 SSH 접속 후
mysql -h my-3tier-app-db.xxxx.ap-northeast-2.rds.amazonaws.com \
  -u admin -p

# MySQL 프롬프트에서
CREATE DATABASE myapp CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
SHOW DATABASES;
EXIT;
```

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

✅ **태스크 완료** — RDS 연동 설정을 완료하고 SSM Parameter Store에 비밀값을 저장했습니다.

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

CloudFront 도메인에서 API를 호출할 수 있도록 CORS를 설정합니다.

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
> `allowed-origins`에 Step 9-2에서 생성한 CloudFront 도메인을 입력하세요.
> 로컬 개발 시에는 `http://localhost:5173` (Vite 기본 포트)도 추가합니다.
> 프로덕션에서는 `*` 대신 정확한 도메인을 지정하는 것이 보안상 좋습니다.

✅ **태스크 완료** — CloudFront 도메인에서 API 호출을 허용하는 CORS를 설정했습니다.

---

## 태스크 5: EC2 배포 + ALB Target Group 등록

### 5-1. EC2 인스턴스 생성

1. AWS Console → **EC2** → [[Launch instances]]
2. 다음과 같이 설정합니다:

| 설정                  | 값                                      |
| --------------------- | --------------------------------------- |
| Name                  | `my-3tier-app-server`                   |
| AMI                   | Amazon Linux 2023                       |
| Instance type         | `t2.micro` (프리티어)                   |
| Key pair              | 키 페어 없음 (SSM Session Manager 사용) |
| VPC                   | `my-3tier-app-vpc`                      |
| Subnet                | `my-3tier-app-private-subnet-1`         |
| Auto-assign public IP | Disable                                 |
| Security group        | `my-3tier-app-ec2-sg` (기존 선택)       |

3. **Advanced details** → **IAM instance profile**:
   - SSM Session Manager + Parameter Store 읽기 권한이 있는 IAM Role 선택
   - 필요 정책: `AmazonSSMManagedInstanceCore` + `AmazonSSMReadOnlyAccess`

4. [[Launch instance]]를 클릭합니다.

### 5-2. EC2 초기 설정

```bash
# SSM Session Manager로 EC2 접속 (AWS Console에서)
# EC2 콘솔 → 인스턴스 선택 → Connect → Session Manager → Connect

# 또는 AWS CLI로 접속
aws ssm start-session --target INSTANCE_ID --region ap-northeast-2

# Java 17 설치
sudo dnf install -y java-17-amazon-corretto-headless

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

### 5-5. 로컬에서 JAR 빌드 및 EC2 전송

```bash
# 로컬에서 빌드
cd ~/3tier-project/my-backend
./gradlew clean bootJar

# JAR 파일을 EC2로 전송
scp -i ~/.ssh/my-key.pem \
  build/libs/my-backend-0.0.1-SNAPSHOT.jar \
  ec2-user@EC2_PUBLIC_IP:/home/ec2-user/app/app.jar
```

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

5. AWS Console → **EC2** → **Target Groups**로 이동합니다.
6. `my-3tier-app-tg`를 클릭합니다.
7. **Targets** 탭 → [[Register targets]]를 클릭합니다.
8. 방금 생성한 EC2 인스턴스를 선택합니다.
9. **Port**: `8080`
10. [[Include as pending below]] → [[Register pending targets]]

> [!NOTE]
> Target Group에 등록 후 Health Check가 통과하면 Status가 `healthy`로 변경됩니다.
> Health Check 경로는 `/actuator/health`로 설정되어 있습니다.
> 약 30초~1분 후 상태를 확인하세요.

✅ **태스크 완료** — EC2에 Spring Boot를 배포하고 ALB Target Group에 등록했습니다.

---

## 태스크 6: GitHub Actions CI/CD

코드를 push하면 자동으로 빌드 → EC2 배포 → Health Check가 실행되는 파이프라인을 구축합니다.

### 6-1. GitHub Secrets 설정

GitHub → `my-backend` 리포지토리 → **Settings** → **Secrets and variables** → **Actions**

| Secret Name             | 값                                |
| ----------------------- | --------------------------------- |
| `AWS_ACCESS_KEY_ID`     | IAM Access Key ID (S3 업로드용)   |
| `AWS_SECRET_ACCESS_KEY` | IAM Secret Access Key             |
| `AWS_REGION`            | `ap-northeast-2`                  |
| `S3_DEPLOY_BUCKET`      | JAR 업로드용 S3 버킷명            |
| `EC2_INSTANCE_ID`       | EC2 인스턴스 ID (SSM 명령 실행용) |

> [!CONCEPT] Private Subnet EC2에 배포하는 방법
> Private Subnet의 EC2에는 SSH로 직접 접속할 수 없습니다.
> 대신 다음 방식으로 배포합니다:
>
> 1. GitHub Actions에서 JAR을 S3에 업로드
> 2. SSM Run Command로 EC2에서 S3 다운로드 + 재시작 명령 실행
>
> 이 방식은 SSH 키 관리가 불필요하고 보안상 더 안전합니다.

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

      # 6. JAR 파일을 S3에 업로드
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

---

## 태스크 7: ALB Health Check 확인 + API 테스트

### 7-1. ALB Target Group Health Check 확인

1. AWS Console → **EC2** → **Target Groups** → `my-3tier-app-tg`
2. **Targets** 탭에서 등록된 인스턴스의 Status를 확인합니다:
   - `healthy`: 정상 (Health Check 통과)
   - `unhealthy`: 비정상 (로그 확인 필요)
   - `initial`: 초기 Health Check 진행 중

> [!WARNING]
> Status가 `unhealthy`인 경우 확인사항:
>
> 1. EC2에서 `sudo systemctl status spring-app`으로 앱 실행 상태 확인
> 2. `curl http://localhost:8080/actuator/health`로 로컬 Health Check
> 3. Security Group에서 8080 포트가 ALB-SG에서 허용되는지 확인
> 4. `sudo journalctl -u spring-app -n 50`으로 에러 로그 확인

### 7-2. ALB를 통한 API 테스트

ALB DNS Name으로 API를 호출합니다:

```bash
# ALB DNS Name (CloudFormation Outputs에서 확인)
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
# EC2에서 RDS 접속
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
> Step 9-4에서 전체 연동 확인 후 정리합니다.
> **Step 9-4에서 전체 정리합니다.**

### 이 세션에서 추가 생성한 리소스

| 리소스         | 이름/식별자           | 비용              |
| -------------- | --------------------- | ----------------- |
| EC2 Instance   | `my-3tier-app-server` | t2.micro 프리티어 |
| SSM Parameters | 4개                   | 무료 (Standard)   |
| IAM Role       | EC2용 SSM 읽기 역할   | 무료              |

✅ **실습 종료**: Step 9-4에서 전체 연동을 확인하고 리소스를 정리합니다.

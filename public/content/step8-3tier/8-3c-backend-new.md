---
title: '새 백엔드 생성 + 배포: Spring Boot JAR (EC2 + ALB)'
week: 8
session: '3c'
awsServices:
  - Amazon EC2
  - Elastic Load Balancing
learningObjectives:
  - Spring Boot 프로젝트를 생성하고 Amazon RDS와 연동할 수 있습니다.
  - Amazon EC2에 Spring Boot JAR을 배포하고 ALB와 연결할 수 있습니다.
  - SSM Parameter Store로 비밀값을 관리할 수 있습니다.
  - GitHub Actions로 백엔드 자동 배포를 구성할 수 있습니다.
prerequisites:
  - Step 8-1 완료 (인프라 구축)
  - Java 17 + Gradle (로컬)
estimatedCost: 크레딧 내 사용 가능 (비용 발생 가능)
---

이 실습에서는 **새 Spring Boot 프로젝트를 생성**하고, Amazon RDS MySQL과 연동한 후,
Amazon EC2에 JAR로 배포하여 ALB와 연결합니다.
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

## 태스크 1: Spring Boot 프로젝트 생성

Spring Initializr로 프로젝트를 생성합니다.

### 1-1. Spring Initializr

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

3. **Dependencies** 추가:
   - Spring Web
   - Spring Data JPA
   - MySQL Driver
   - Spring Boot Actuator
   - Validation

4. [[GENERATE]]를 클릭하여 ZIP 파일을 다운로드합니다.

### 1-2. 프로젝트 설정

5. 다운로드한 ZIP을 압축 해제하고 프로젝트 디렉터리로 이동합니다:

```bash
cd ~/3tier-project/my-backend
# 다운로드한 ZIP 압축 해제 후 파일 복사
```

완성 시 프로젝트 구조:

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

6. SSM Parameter Store에 데이터베이스 연결 정보를 저장합니다:

```bash
aws ssm put-parameter \
  --name "/my-3tier-app/db/endpoint" \
  --value "<Step 8-1 CloudFormation Outputs의 RDSEndpoint 값>" \
  --type String

aws ssm put-parameter \
  --name "/my-3tier-app/db/name" \
  --value "<DB 이름 (기본: myapp)>" \
  --type String

aws ssm put-parameter \
  --name "/my-3tier-app/db/username" \
  --value "<DB 마스터 사용자명 (기본: admin)>" \
  --type String

aws ssm put-parameter \
  --name "/my-3tier-app/db/password" \
  --value "<DB 마스터 비밀번호>" \
  --type SecureString
```

### 2-2. application.yml 설정

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

app:
  cors:
    allowed-origins: https://d1234abcdef.cloudfront.net,http://localhost:5173
```

> [!WARNING]
> `app.cors.allowed-origins`에 Step 8-2에서 생성한 Amazon CloudFront 도메인을 입력하세요.

✅ **태스크 완료** — Amazon RDS 연동 설정을 완료했습니다.

---

## 태스크 3: REST API 작성

### 3-1. Entity 클래스

8. `src/main/java/com/example/mybackend/entity/Item.java` 파일을 작성합니다:

```java
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

9. `src/main/java/com/example/mybackend/repository/ItemRepository.java` 파일을 작성합니다:

```java
package com.example.mybackend.repository;

import com.example.mybackend.entity.Item;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ItemRepository extends JpaRepository<Item, Long> {
}
```

### 3-3. Controller 클래스

10. `src/main/java/com/example/mybackend/controller/ItemController.java` 파일을 작성합니다:

```java
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

    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Map.of(
            "status", "UP",
            "service", "my-backend",
            "timestamp", java.time.LocalDateTime.now().toString()
        ));
    }

    @GetMapping("/items")
    public ResponseEntity<List<Item>> getAllItems() {
        return ResponseEntity.ok(itemRepository.findAll());
    }

    @GetMapping("/items/{id}")
    public ResponseEntity<Item> getItem(@PathVariable Long id) {
        return itemRepository.findById(id)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/items")
    public ResponseEntity<Item> createItem(@Valid @RequestBody Item item) {
        Item saved = itemRepository.save(item);
        return ResponseEntity.status(201).body(saved);
    }

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

✅ **태스크 완료** — CRUD REST API와 Health Check 엔드포인트를 작성했습니다.

---

## 태스크 4: CORS 설정

Amazon CloudFront 도메인에서 API를 호출할 수 있도록 CORS를 설정합니다.

### 4-1. WebConfig 클래스 생성

11. `src/main/java/com/example/mybackend/config/WebConfig.java` 파일을 작성합니다:

```java
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

> [!WARNING]
> `application.yml`의 `app.cors.allowed-origins`에 Step 8-2에서 생성한 Amazon CloudFront 도메인을 입력하세요.
> 로컬 개발 시에는 `http://localhost:5173`도 추가합니다.

✅ **태스크 완료** — CORS를 설정했습니다.

---

## 태스크 5: Amazon EC2 배포 + ALB Target Group 등록

### 5-1. Amazon EC2 인스턴스 생성

> [!WARNING]
> AWS Console 우측 상단에서 리전이 **Asia Pacific (Seoul) ap-northeast-2**인지 확인하세요.

12. 상단 검색창에 `EC2`를 입력하고 **EC2** 서비스를 선택합니다. [[Launch instances]] 버튼을 클릭합니다.
13. **Name**: `my-3tier-app-server`
14. **AMI**: `Amazon Linux 2023`
15. **Instance type**: `t3.micro`
16. **Key pair**: `Proceed without a key pair`
17. **Network settings** 섹션에서 [[Edit]] 버튼을 클릭하고 다음과 같이 설정합니다:
    - **VPC**: `my-3tier-app-vpc`
    - **Subnet**: `my-3tier-app-private-subnet-1`
    - **Auto-assign public IP**: `Disable`
    - **Security groups**: `my-3tier-app-ec2-sg`
18. **Advanced details** → **IAM instance profile**: SSM + Parameter Store 읽기 권한이 있는 IAM Role
19. [[Launch instance]]

### 5-2. EC2 초기 설정

20. SSM Session Manager로 EC2에 접속하여 Java 17과 MySQL 클라이언트를 설치합니다:

```bash
# SSM Session Manager로 접속 후
sudo su - ec2-user

# Java 17 설치
sudo dnf install -y java-17-amazon-corretto-devel
echo 'export JAVA_HOME=/usr/lib/jvm/java-17-amazon-corretto' | sudo tee -a /etc/profile.d/java.sh
source /etc/profile.d/java.sh
java -version

# MySQL 클라이언트 설치 + RDS 접속 테스트
sudo dnf install -y mariadb105
mysql -h <RDS_ENDPOINT> -u admin -p -e "SELECT 1;"
```

### 5-3. start.sh 생성

21. 애플리케이션 시작 스크립트를 생성합니다:

```bash
mkdir -p /home/ec2-user/app

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

22. Spring Boot를 systemd 서비스로 등록합니다:

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

### 5-5. JAR 빌드 및 배포

23. 로컬에서 JAR을 빌드하고 S3에 업로드합니다:

```bash
cd ~/3tier-project/my-backend
./gradlew clean bootJar

export S3_DEPLOY_BUCKET=my-3tier-app-deploy-<BucketSuffix>

# 배포용 버킷 생성 (아직 없는 경우)
aws s3 mb s3://$S3_DEPLOY_BUCKET --region ap-northeast-2

# S3에 업로드
JAR_FILE=$(ls build/libs/*.jar | head -1)
aws s3 cp "$JAR_FILE" s3://$S3_DEPLOY_BUCKET/app.jar
```

24. EC2에서 JAR을 다운로드하고 애플리케이션을 실행합니다:

```bash
export S3_DEPLOY_BUCKET=my-3tier-app-deploy-<BucketSuffix>
aws s3 cp s3://$S3_DEPLOY_BUCKET/app.jar /home/ec2-user/app/app.jar

# 앱 시작
sudo systemctl start spring-app

# 상태 확인
sudo systemctl status spring-app
sudo journalctl -u spring-app -f

# Health Check
curl http://localhost:8080/actuator/health
```

### 5-6. ALB Target Group에 EC2 등록

25. **EC2** 콘솔 → **Target Groups** → `my-3tier-app-tg` 클릭
26. **Targets** 탭 → [[Register targets]]
27. `my-3tier-app-server` 체크 → Port: `8080` → [[Include as pending below]]
28. [[Register pending targets]]

> [!OUTPUT]
> 약 30초~1분 후 Status가 `healthy`로 변경됩니다.
> Health Check 경로는 `/actuator/health` (CloudFormation 기본값)입니다.

✅ **태스크 완료** — Amazon EC2에 Spring Boot를 배포하고 ALB Target Group에 등록했습니다.

---

## 태스크 6: GitHub Actions CI/CD (JAR)

### 6-1. IAM 사용자 생성

29. 상단 검색창에 `IAM`을 입력하고 **IAM** 서비스를 선택합니다. 왼쪽 메뉴에서 **Users** → [[Create user]]를 클릭합니다.
30. **User name**: `github-actions-backend`
31. 정책 연결: `AmazonS3FullAccess` + `AmazonSSMFullAccess`
32. Access Key 생성 (Third-party service)

### 6-2. GitHub Secrets 설정

33. GitHub → `my-backend` 리포지토리 → Settings → Secrets에 다음 값을 등록합니다:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`: `ap-northeast-2`
- `S3_DEPLOY_BUCKET`: `<배포용 S3 버킷명>`
- `EC2_INSTANCE_ID`: `<EC2 인스턴스 ID>`

### 6-3. GitHub Actions 워크플로우 작성

34. `.github/workflows/deploy.yml` 파일을 작성합니다:

```yaml
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
          ./gradlew clean bootJar -x test

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ secrets.AWS_REGION }}

      - name: Upload JAR to S3
        run: |
          JAR_FILE=$(ls build/libs/*.jar | head -1)
          aws s3 cp "$JAR_FILE" s3://${{ secrets.S3_DEPLOY_BUCKET }}/app.jar

      - name: Deploy via SSM Run Command
        run: |
          COMMAND_ID=$(aws ssm send-command \
            --instance-ids "${{ secrets.EC2_INSTANCE_ID }}" \
            --document-name "AWS-RunShellScript" \
            --timeout-seconds 120 \
            --parameters 'commands=[
              "aws s3 cp s3://${{ secrets.S3_DEPLOY_BUCKET }}/app.jar /home/ec2-user/app/app.jar --quiet",
              "chown ec2-user:ec2-user /home/ec2-user/app/app.jar",
              "systemctl restart spring-app",
              "sleep 30",
              "for i in 1 2 3; do curl -sf http://localhost:8080/actuator/health && exit 0; sleep 10; done; exit 1"
            ]' \
            --query "Command.CommandId" \
            --output text)

          echo "SSM Command ID: $COMMAND_ID"

          aws ssm wait command-executed \
            --command-id "$COMMAND_ID" \
            --instance-id "${{ secrets.EC2_INSTANCE_ID }}"

          echo "✅ 배포 완료!"
```

> [!WARNING]
> `./gradlew`를 사용하므로 **Gradle Wrapper 파일이 레포에 포함**되어야 합니다:
>
> ```bash
> git add -f gradle/wrapper/gradle-wrapper.properties gradle/wrapper/gradle-wrapper.jar gradlew gradlew.bat
> git commit -m "chore: add gradle wrapper for CI/CD"
> ```

### 6-4. 배포 테스트

35. 코드를 커밋하고 푸시하여 자동 배포를 실행합니다:

```bash
git add .
git commit -m "feat: initial backend with CI/CD"
git push origin main
```

36. GitHub Actions 탭에서 워크플로우 실행을 확인합니다.

✅ **태스크 완료** — GitHub Actions로 JAR 자동 배포 파이프라인을 구축했습니다.

---

## 태스크 7: ALB Health Check 확인 + API 테스트

### 7-1. Target Group Health Check 확인

37. **EC2** → **Target Groups** → `my-3tier-app-tg` → **Targets** 탭에서 Status 확인
38. Status가 `healthy`이면 정상

### 7-2. ALB를 통한 API 테스트

39. ALB DNS를 통해 API 엔드포인트를 테스트합니다:

```bash
ALB_DNS="<ALB_DNS_NAME>"

# Actuator Health Check
curl http://$ALB_DNS/actuator/health

# 커스텀 Health Check
curl http://$ALB_DNS/api/health

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

### 7-3. RDS 데이터 확인 (선택)

40. EC2에서 직접 Amazon RDS에 접속하여 데이터를 확인합니다:

```bash
mysql -h <RDS_ENDPOINT> -u admin -p
```

```sql
USE myapp;
SELECT * FROM items;
EXIT;
```

> [!NOTE]
> 이 시점에서 브라우저(CloudFront HTTPS)에서 프론트엔드 → 백엔드(ALB HTTP) API 호출은 **Mixed Content**로 차단됩니다.
> 프론트엔드 ↔ 백엔드 연동은 **Step 8-4 태스크 1**을 완료한 뒤 동작합니다.
> 현재 단계에서는 `curl`로 API가 정상 응답하는 것을 확인했으면 충분합니다.

✅ **태스크 완료** — ALB Health Check를 확인하고 API 테스트를 완료했습니다.

---

# 🗑️ 리소스 정리

> [!WARNING]
> 이 세션에서 생성한 리소스를 지금 삭제하지 마세요!
> Step 8-4에서 전체 연동 확인 후 정리합니다.
> **Step 8-4에서 전체 정리합니다.**

✅ **실습 종료**: Step 8-4에서 전체 연동을 확인하고 리소스를 정리합니다.

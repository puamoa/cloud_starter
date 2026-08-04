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

> [!WARNING]
> 이 태스크는 **필수**입니다. SSM Parameter Store에 DB 접속 정보를 저장하지 않으면 Amazon EC2에서 애플리케이션이 시작되지 않습니다.  

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

> [!TIP]
> `SecureString` 타입은 AWS KMS로 자동 암호화됩니다.  
> 비밀번호, API 키 등 민감한 값은 항상 SecureString을 사용하세요.  
>
> **값을 잘못 입력한 경우:** `--overwrite` 플래그를 추가하여 같은 명령을 다시 실행하면 덮어씁니다.  

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

> [!NOTE]
> CORS 에러는 **브라우저에서만** 발생합니다.  
> `curl`로 테스트하면 CORS 에러가 나타나지 않습니다.  

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
19. [[Launch instance]] 버튼을 클릭합니다.

### 5-2. EC2 초기 설정

20. SSM Session Manager로 EC2에 접속하여 Java 17과 MySQL 클라이언트를 설치합니다:

```bash
# SSM Session Manager로 EC2 접속 (AWS Console에서)
# EC2 콘솔 → 인스턴스 선택 → [[Connect]] → Session Manager 탭 → [[Connect]]

# 또는 AWS CLI로 접속 (Instance ID는 EC2 콘솔에서 확인)
aws ssm start-session --target <INSTANCE_ID> --region ap-northeast-2
```

> [!TIP]
> **AWS CLI로 접속하려면** 로컬에 Session Manager plugin이 필요합니다:
>
> ```bash
> # macOS
> brew install session-manager-plugin
> ```
>
> 플러그인 설치가 번거로우면 AWS Console의 Session Manager로 접속하세요.  

```bash
# ssm-user → ec2-user로 전환
sudo su - ec2-user

# Java 17 설치
sudo dnf install -y java-17-amazon-corretto-devel
echo 'export JAVA_HOME=/usr/lib/jvm/java-17-amazon-corretto' | sudo tee -a /etc/profile.d/java.sh
source /etc/profile.d/java.sh
java -version

# MySQL 클라이언트 설치 + RDS 접속 테스트
sudo dnf install -y mariadb105
mysql -h <RDS_ENDPOINT> -u admin -p -e "SELECT 1;"

# 또는 SSM Parameter Store에서 값 가져와서 접속 테스트
mysql -h $(aws ssm get-parameter --name "/my-3tier-app/db/endpoint" --query "Parameter.Value" --output text --region ap-northeast-2) \
  -u $(aws ssm get-parameter --name "/my-3tier-app/db/username" --query "Parameter.Value" --output text --region ap-northeast-2) \
  -p$(aws ssm get-parameter --name "/my-3tier-app/db/password" --with-decryption --query "Parameter.Value" --output text --region ap-northeast-2) \
  -e "SELECT 1;"
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

📍 **실행 위치: 로컬 PC**

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

📍 **실행 위치: EC2** (SSM Session Manager 접속 상태)

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

25. 상단 검색창에 `EC2`를 입력하고 **EC2** 서비스를 선택합니다.
26. 왼쪽 메뉴에서 **Target Groups**를 클릭합니다.
27. `my-3tier-app-tg`를 클릭합니다.
28. **Targets** 탭을 클릭하고 [[Register targets]] 버튼을 클릭합니다.
29. **Available instances**에서 `my-3tier-app-server`를 체크합니다.
30. **Ports for the selected instances**에 `8080`을 입력합니다.
31. [[Include as pending below]] 버튼을 클릭합니다.
32. 하단의 **Review** 섹션에서 인스턴스가 추가된 것을 확인합니다.
33. [[Register pending targets]] 버튼을 클릭하여 등록을 완료합니다.

> [!OUTPUT]
> Target Group의 Targets 탭에서 등록된 인스턴스를 확인합니다:
>
> | Instance ID     | Port | Health Status | Status Details                  |
> | --------------- | ---- | ------------- | ------------------------------- |
> | i-0abc123def456 | 8080 | initial       | Target registration in progress |
>
> 약 30초~1분 후 `healthy`로 변경됩니다.  
> Health Check 경로는 `/actuator/health` (CloudFormation 기본값)입니다.  

> [!TROUBLESHOOTING]
>
> **Target Group Status: `unhealthy`**
>
> - 원인: 앱 미시작 또는 Health Check 경로 불일치
> - 해결: EC2에서 `curl http://localhost:8080/actuator/health`로 응답 확인
>
> **`systemctl start spring-app` 실패**
>
> - 원인: Java 미설치 또는 JAR 경로 오류
> - 해결: `java -version` 확인, `/home/ec2-user/app/app.jar` 존재 확인, `sudo journalctl -u spring-app -n 50`으로 에러 로그 확인
>
> **SSM Session Manager 접속 불가**
>
> - 원인: IAM Role 미연결
> - 해결: EC2에 `AmazonSSMManagedInstanceCore` 정책 연결 확인
>
> **`start.sh`에서 SSM 값 못 가져옴**
>
> - 원인: EC2 IAM Role에 SSM 읽기 권한 없음
> - 해결: `AmazonSSMReadOnlyAccess` 정책 추가

✅ **태스크 완료** — Amazon EC2에 Spring Boot를 배포하고 ALB Target Group에 등록했습니다.

---

## 태스크 6: GitHub Actions CI/CD (JAR)

코드를 push하면 자동으로 빌드 → Amazon EC2 배포 → Health Check가 실행되는 파이프라인을 구축합니다.

> [!WARNING]
> 이 CI/CD는 **SSM Run Command**로 Private Subnet의 Amazon EC2에 명령을 전달합니다.  
> EC2가 SSM 서비스에 접근하려면 아래 중 하나가 필요합니다:
>
> - **NAT Gateway** (Step 8-1에서 `CreateNATGateway=Yes`로 생성한 경우) — 추가 작업 없음
> - **VPC Endpoint** 3개 (`ssm`, `ssmmessages`, `ec2messages`) — NAT 없이 가능하지만 유료
>
> Step 8-1에서 NAT Gateway를 생성했다면 바로 진행하세요.  

### 6-1. IAM 사용자 설정 (GitHub Actions용)

백엔드 CI/CD에는 `AmazonS3FullAccess`(JAR 업로드)와 `AmazonSSMFullAccess`(SSM Run Command 실행) 권한이 필요합니다.

> [!CONCEPT] IAM 사용자를 분리하는 이유
>
> 실무에서는 프론트엔드/백엔드별로 IAM 사용자를 분리하는 것이 보안 원칙(최소 권한)입니다.  
> 프론트엔드 사용자에 SSM 권한을 부여하면, 프론트 레포가 탈취될 경우 EC2까지 제어할 수 있게 됩니다.  
> 학습 환경에서는 하나로 합쳐도 무방하지만, 분리를 권장합니다.  

아래 두 가지 중 하나를 선택합니다:

| 옵션 | 방법                                       | 장점                             | 단점                             |
| ---- | ------------------------------------------ | -------------------------------- | -------------------------------- |
| 📗 A | 새 IAM 사용자 생성                         | 보안 분리 (권장), 권한 추적 명확 | 사용자/키 하나 더 관리           |
| 📙 B | 기존 `github-actions-frontend`에 정책 추가 | 키 하나로 관리 간편              | 프론트 레포 탈취 시 EC2까지 영향 |

**📗 옵션 A: 새 IAM 사용자 생성 (권장)**

34. 상단 검색창에 `IAM`을 입력하고 **IAM** 서비스를 선택합니다.
35. 왼쪽 메뉴에서 **Users**를 클릭합니다.
36. [[Create user]]를 클릭합니다.
37. **User name**: `github-actions-backend`를 입력합니다.
38. **Provide user access to the AWS Management Console** 체크를 **하지 않습니다** (콘솔 접근 불필요).
39. [[Next]]를 클릭합니다.
40. **Permissions options**에서 `Attach policies directly`를 선택합니다.
41. 다음 정책을 검색하여 체크합니다:
    - `AmazonS3FullAccess` (JAR 업로드용)
    - `AmazonSSMFullAccess` (SSM Run Command 실행용)
42. [[Next]]를 클릭합니다.
43. **Review and create** 페이지에서 설정을 확인하고 [[Create user]]를 클릭합니다.

**📙 옵션 B: 기존 `github-actions-frontend` 사용자에 정책 추가**

34. 상단 검색창에 `IAM`을 입력하고 **IAM** 서비스를 선택합니다.
35. 왼쪽 메뉴에서 **Users**를 클릭합니다.
36. `github-actions-frontend`를 클릭합니다.
37. **Permissions** 탭 → [[Add permissions]] → **Add permissions**를 클릭합니다.
38. **Permissions options**에서 `Attach policies directly`를 선택합니다.
39. 검색창에 `SSMFull`을 입력하고 `AmazonSSMFullAccess`를 체크합니다 (`AmazonS3FullAccess`는 이미 있음).
40. [[Next]] → [[Add permissions]]를 클릭합니다.

> [!NOTE]
> 옵션 B를 선택한 경우 아래 "Access Key 생성"을 건너뛰세요.  
> 8-2에서 발급한 Access Key ID / Secret Access Key를 `my-backend` 레포의 GitHub Secrets에도 동일하게 등록합니다 (6-2에서 진행).

> [!TIP]
> **실무에서는 커스텀 정책(최소 권한)을 권장합니다.**  
> 이 실습에서는 편의상 AWS 관리형 정책(`AmazonS3FullAccess`, `AmazonSSMFullAccess`)을 사용하지만,  
> 프로덕션에서는 JSON 정책으로 특정 리소스에만 접근을 허용합니다. 예시:
>
> ```json
> {
>   "Version": "2012-10-17",
>   "Statement": [
>     {
>       "Effect": "Allow",
>       "Action": ["s3:PutObject", "s3:GetObject"],
>       "Resource": "arn:aws:s3:::my-3tier-app-deploy-<BucketSuffix>/*"
>     },
>     {
>       "Effect": "Allow",
>       "Action": "ssm:SendCommand",
>       "Resource": [
>         "arn:aws:ec2:ap-northeast-2:*:instance/<INSTANCE_ID>",
>         "arn:aws:ssm:ap-northeast-2::document/AWS-RunShellScript"
>       ]
>     }
>   ]
> }
> ```
>
> IAM → Policies → [[Create policy]] → JSON 탭에 붙여넣어 커스텀 정책을 생성할 수 있습니다.  

### Access Key 생성 (옵션 A만 해당)

> [!NOTE]
> 📙 옵션 B를 선택한 경우 이 단계를 건너뛰고 **6-2. GitHub Secrets 설정**으로 이동하세요.  

44. 생성된 `github-actions-backend` 사용자를 클릭하여 상세 페이지로 이동합니다.
45. **Security credentials** 탭을 클릭합니다.
46. **Access keys** 섹션에서 [[Create access key]]를 클릭합니다.
47. **Use case**에서 `Third-party service`를 선택합니다.
48. 하단의 확인 체크박스를 선택하고 [[Next]]를 클릭합니다.
49. [[Create access key]]를 클릭합니다.
50. **Access key ID**와 **Secret access key**를 복사하여 안전한 곳에 저장합니다.

> [!WARNING]
> Secret access key는 이 화면에서만 확인할 수 있습니다.  
> 페이지를 닫으면 다시 볼 수 없으므로 반드시 복사하여 저장하세요.  

### 6-2. GitHub Secrets 설정

51. 브라우저에서 GitHub → `my-backend` 리포지토리 페이지로 이동합니다.
52. **Settings** 탭을 클릭합니다.
53. 왼쪽 메뉴에서 **Secrets and variables** → **Actions**를 클릭합니다.
54. [[New repository secret]] 버튼을 클릭합니다.
55. 다음 Secrets를 하나씩 추가합니다:
    - `AWS_ACCESS_KEY_ID`: 50번에서 복사한 Access Key ID
    - `AWS_SECRET_ACCESS_KEY`: 50번에서 복사한 Secret Access Key
    - `AWS_REGION`: `ap-northeast-2`
    - `S3_DEPLOY_BUCKET`: `<태스크 5-5에서 생성한 배포용 S3 버킷명>`
    - `EC2_INSTANCE_ID`: `<태스크 5-1에서 생성한 Amazon EC2 인스턴스 ID (예: i-0abc123def456)>`

> [!CONCEPT] Private Subnet Amazon EC2에 배포하는 방법
>
> Private Subnet의 Amazon EC2에는 SSH로 직접 접속할 수 없습니다.  
> 대신 다음 방식으로 배포합니다:
>
> - GitHub Actions에서 JAR을 Amazon S3에 업로드
> - SSM Run Command로 Amazon EC2에서 Amazon S3 다운로드 + spring-app 재시작
>
> 이 방식은 SSH 키 관리가 불필요하고 보안상 더 안전합니다.  

### 6-3. GitHub Actions 워크플로우 작성

> [!WARNING]
> 이 워크플로우는 `./gradlew`를 사용하므로 **Gradle Wrapper 파일이 레포에 포함**되어야 합니다.  
> GitHub의 Gradle `.gitignore`가 이 파일을 제외할 수 있으니 아래 명령으로 확인 후 추가하세요:
>
> ```bash
> # wrapper가 git에 있는지 확인
> git ls-files gradle/wrapper/
>
> # 비어있으면 강제 추가
> git add -f gradle/wrapper/gradle-wrapper.properties gradle/wrapper/gradle-wrapper.jar gradlew gradlew.bat
> git commit -m "chore: add gradle wrapper for CI/CD"
> git push origin main
> ```

56. `.github/workflows/deploy.yml` 파일을 생성합니다:

```bash
# 프로젝트 루트에서 실행 (~/3tier-project/my-backend)
mkdir -p .github/workflows
```

```
my-backend/                    ← 프로젝트 루트
├── .github/
│   └── workflows/
│       └── deploy.yml         ← 이 파일을 생성
├── src/
├── build.gradle
└── ...
```

`.github/workflows/deploy.yml`:

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

      # 3. Gradle 캐시 (빌드 시간 단축)
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
          ./gradlew clean bootJar -x test

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

          # 명령 완료 대기
          aws ssm wait command-executed \
            --command-id "$COMMAND_ID" \
            --instance-id "${{ secrets.EC2_INSTANCE_ID }}"

          echo "✅ 배포 완료!"
```

> [!CONCEPT] SSM Run Command 워크플로우 동작 흐름
>
> ```
> GitHub Actions Runner          AWS                          EC2 (Private Subnet)
>       │                         │                                │
>       │  1. aws ssm send-command│                                │
>       │────────────────────────▶│  2. SSM Agent에 명령 전달      │
>       │                         │───────────────────────────────▶│
>       │                         │                                │ 3. S3에서 JAR 다운로드
>       │                         │                                │ 4. spring-app 재시작
>       │                         │                                │ 5. Health Check (curl)
>       │                         │  6. 결과 반환                   │
>       │  7. aws ssm wait        │◀───────────────────────────────│
>       │◀────────────────────────│                                │
>       │  ✅ 성공 / ❌ 실패      │                                │
> ```
>
> - `send-command`: EC2에 실행할 셸 명령을 전달 (SSH 불필요)
> - `commands` 배열: EC2에서 순서대로 실행되는 명령어 목록
> - `wait command-executed`: 명령이 완료될 때까지 대기 (타임아웃 시 실패 처리)
> - Health Check(`curl -sf`)가 실패하면 `exit 1`로 전체 배포 실패 처리

### 6-4. 배포 테스트

57. 변경사항을 커밋하고 push합니다:

```bash
cd ~/3tier-project/my-backend

git add .
git commit -m "feat: initial backend with CI/CD"
git push origin main
```

58. GitHub → `my-backend` 리포지토리 → **Actions** 탭에서 워크플로우 실행을 확인합니다.

> [!TIP]
> 첫 빌드는 Gradle 의존성 다운로드로 3~4분 소요됩니다.  
> 이후 빌드는 캐시 덕분에 1~2분으로 단축됩니다.  

> [!TROUBLESHOOTING]
>
> **`Upload failed: NoSuchBucket`**
>
> - 원인: S3 버킷명 Secret 오류
> - 해결: `S3_DEPLOY_BUCKET` Secret 값이 실제 버킷명과 일치하는지 확인
>
> **`SSM SendCommand failed`**
>
> - 원인: Amazon EC2 인스턴스 ID 오류 또는 IAM 권한 부족
> - 해결: `EC2_INSTANCE_ID` 확인, GitHub Actions IAM에 `ssm:SendCommand` 권한 추가
>
> **`CommandInvocationStatus: Failed`**
>
> - 원인: EC2에서 명령 실행 실패
> - 해결: EC2에서 수동으로 같은 명령 실행하여 에러 확인
>
> **`aws ssm wait` 타임아웃**
>
> - 원인: SSM Agent 미설치 또는 EC2 미실행
> - 해결: EC2 상태 확인, Amazon Linux 2023은 SSM Agent 기본 설치됨
>
> **Gradle 빌드 실패 (GitHub Actions)**
>
> - 원인: Java 버전 불일치
> - 해결: `setup-java`의 `java-version`이 프로젝트와 일치하는지 확인
>
> **`gradle-wrapper.properties does not exist`**
>
> - 원인: wrapper 파일이 git에 없음
> - 해결: `git add -f gradle/wrapper/gradle-wrapper.properties gradle/wrapper/gradle-wrapper.jar gradlew gradlew.bat`

> [!NOTE]
> Private Subnet의 Amazon EC2에 SSM Run Command를 사용하려면 Amazon EC2가 SSM 서비스에 접근할 수 있어야 합니다.  
> NAT Gateway가 있으면 자동으로 가능하고, 없다면 VPC Endpoint(ssm, ssmmessages, ec2messages)가 필요합니다.  

✅ **태스크 완료** — GitHub Actions로 JAR 자동 배포 파이프라인을 구축했습니다.

---

## 태스크 7: ALB Health Check 확인 + API 테스트

### 7-1. Target Group Health Check 확인

37. 상단 검색창에 `EC2`를 입력하고 **EC2** 서비스를 선택합니다.
38. 왼쪽 메뉴에서 **Target Groups** → `my-3tier-app-tg`를 클릭합니다.
39. **Targets** 탭에서 Status를 확인합니다.
40. Status가 `healthy`이면 정상

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

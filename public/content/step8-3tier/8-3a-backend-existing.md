---
title: '기존 백엔드 배포: Spring MVC WAR (EC2 + Tomcat + ALB)'
week: 8
session: '3a'
awsServices:
  - Amazon EC2
  - Elastic Load Balancing
learningObjectives:
  - 기존 Spring MVC 프로젝트를 Amazon EC2에 배포할 수 있습니다.
  - Tomcat 9에 WAR를 배포하고 ALB와 연결할 수 있습니다.
  - SSM Parameter Store로 비밀값을 관리할 수 있습니다.
  - GitHub Actions로 백엔드 자동 배포를 구성할 수 있습니다.
prerequisites:
  - Step 8-1 완료 (인프라 구축)
  - 기존 Spring MVC 프로젝트 (MyBatis, JWT, WAR, javax.servlet)
  - Java 17 + Gradle (로컬)
estimatedCost: 크레딧 내 사용 가능 (비용 발생 가능)
---

이 실습에서는 **기존 Spring MVC 프로젝트**(WAR)를 Amazon EC2의 Tomcat에 배포하고,
ALB와 연결합니다.  
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

## 태스크 1: Health Check 설정

ALB Target Group은 Health Check 경로로 HTTP 200 응답을 기대합니다.  
Spring MVC에는 Actuator가 없으므로 아래 중 하나를 선택하세요:

**방법 1: Target Group Health Check 경로를 `/`로 변경 (가장 간단)**

앱의 기본 페이지(`/`)가 200을 반환하면 추가 작업 없음.  
태스크 5에서 Target Group 설정 시 경로를 변경합니다.

**방법 2: 간단한 Health Check 컨트롤러 추가**

```java
// src/main/java/.../controller/HealthController.java
@RestController
public class HealthController {
    @GetMapping("/health")
    public ResponseEntity<String> health() {
        return ResponseEntity.ok("OK");
    }
}
```

Target Group Health Check 경로를 `/health`로 설정합니다.

> [!TIP]
> 방법 1이 가장 간단하며 코드 수정이 불필요합니다.  

✅ **태스크 완료** — Health Check 방식을 선택했습니다.

---

## 태스크 2: RDS 연동 설정

> [!WARNING]
> 이 태스크는 **필수**입니다. SSM Parameter Store에 DB 접속 정보를 저장하지 않으면 Amazon EC2에서 애플리케이션이 시작되지 않습니다.  

### 2-1. SSM Parameter Store에 비밀값 저장

Amazon EC2에서 Amazon RDS 접속 정보를 안전하게 관리하기 위해 SSM Parameter Store를 사용합니다.

> [!TIP]
> **스택 생성 시 기본값을 변경하지 않았다면:**
>
> | 파라미터     | 기본값                                                           |
> | ------------ | ---------------------------------------------------------------- |
> | DB 이름      | `myapp`                                                          |
> | DB 사용자명  | `admin`                                                          |
> | DB 비밀번호  | `MyPassword123!` (Step 8-1 가이드 기본 예시, 변경했다면 본인 값) |
> | RDS Endpoint | CloudFormation Outputs → `RDSEndpoint` 확인                      |

1. 다음 명령어를 실행하여 SSM Parameter Store에 파라미터를 저장합니다:

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

# S3 버킷명 저장 (S3 업로드 기능이 있는 프로젝트만 해당)
aws ssm put-parameter \
  --name "/my-3tier-app/s3/bucket" \
  --value "<Step 8-1 CloudFormation Outputs의 S3BucketName 값>" \
  --type String

# AWS 리전 저장
aws ssm put-parameter \
  --name "/my-3tier-app/aws/region" \
  --value "ap-northeast-2" \
  --type String
```

> [!TIP]
> `SecureString` 타입은 AWS KMS로 자동 암호화됩니다.  
> 비밀번호, API 키 등 민감한 값은 항상 SecureString을 사용하세요.  
>
> **값을 잘못 입력한 경우:**
>
> - CLI: `--overwrite` 플래그를 추가하여 같은 명령을 다시 실행하면 덮어씁니다.  
> - 콘솔: AWS Console → Systems Manager → Parameter Store에서 해당 파라미터를 클릭하고 [[Edit]] → 값 수정 → [[Save changes]]

### 2-2. DB 접속 설정 파일 수정

2. `src/main/resources/application.properties`의 DB 접속 정보를 환경 변수로 변경합니다:

```properties
# 변경 전 (로컬 DB 직접 접속)
#jdbc.driver=net.sf.log4jdbc.sql.jdbcapi.DriverSpy
#jdbc.url=jdbc:log4jdbc:mysql://localhost:3306/scoula_db
#jdbc.username=scoula
#jdbc.password=Scoula123!

# 변경 후 (환경 변수에서 주입 — EC2의 setenv.sh에서 설정)
jdbc.driver=net.sf.log4jdbc.sql.jdbcapi.DriverSpy
jdbc.url=jdbc:log4jdbc:mysql://${DB_ENDPOINT}:3306/${DB_NAME}
jdbc.username=${DB_USERNAME}
jdbc.password=${DB_PASSWORD}
```

> [!TIP]
> 기존 프로젝트의 `RootConfig.java`에서 `@Value("${jdbc.url}")` 등으로 값을 읽는 구조라면, `application.properties`의 값만 환경 변수 형태로 변경하면 됩니다.  
> Java 코드 수정은 불필요합니다.  
>
> `log4jdbc` 드라이버를 사용하는 경우 URL 형식이 `jdbc:log4jdbc:mysql://`이어야 합니다.  

> [!TIP]
> **로컬 개발 시** 환경 변수가 없으면 앱이 시작되지 않습니다.  
> IntelliJ Run/Debug Configuration → Environment variables에 입력:
>
> ```
> DB_ENDPOINT=localhost;DB_NAME=scoula_db;DB_USERNAME=scoula;DB_PASSWORD=Scoula123!
> ```

**Step 6-1 실습을 적용한 경우 (ParameterStoreService 사용):**

3. `ParameterStoreService`를 구현하여 SSM Parameter Store에서 직접 값을 읽는 구조라면, `application.properties`에 환경 변수를 넣을 필요가 없습니다.  
   대신 SSM Parameter Store의 파라미터 값만 Amazon RDS 엔드포인트로 업데이트합니다:

```bash
aws ssm put-parameter \
  --name "/starter/prod/db/url" \
  --value "jdbc:log4jdbc:mysql://<RDS_ENDPOINT>:3306/<DB_NAME>" \
  --type String \
  --overwrite
```

> [!TIP]
> 이 경우 `application.properties`는 수정하지 않아도 됩니다.  
> `ParameterStoreService`가 앱 시작 시 SSM에서 값을 읽어 DataSource에 주입합니다.  

> [!TROUBLESHOOTING]
>
> **`ParameterAlreadyExists` 에러**
>
> - 원인: 동일 이름의 파라미터 이미 존재
> - 해결: `--overwrite` 플래그 추가하여 재실행
>
> **Amazon EC2에서 Amazon RDS 접속 실패 (`Can't connect`)**
>
> - 원인: Security Group 미허용 또는 RDS 미생성
> - 해결: RDS-SG에서 EC2-SG의 3306 포트 허용 확인
>
> **`Access denied for user 'admin'`**
>
> - 원인: 비밀번호 오류
> - 해결: SSM에 저장한 비밀번호와 RDS 생성 시 설정한 비밀번호 일치 확인
>
> **`Unknown database 'myapp'`**
>
> - 원인: 데이터베이스 미생성
> - 해결: Amazon EC2에서 Amazon RDS 접속 후 `CREATE DATABASE myapp` 실행

✅ **태스크 완료** — Amazon RDS 연동 설정을 완료했습니다.

---

## 태스크 3: 기존 프로젝트 확인 사항

기존 프로젝트에는 이미 Entity, Repository(Mapper), Controller가 있으므로 새로 작성하지 않습니다.  
아래 항목만 확인하세요:

- **API 엔드포인트**: `/api/board`, `/api/travel`, `/api/member`, `/api/auth/login` 등이 정상 동작
- **빌드 가능 여부**: `./gradlew clean build -x test`로 WAR 생성 확인
- **SQL 파일 존재**: `board.sql`, `member.sql`, `travel.sql` 등 테이블 생성 SQL 확인

4. 로컬에서 프로젝트를 빌드하여 WAR 파일이 정상 생성되는지 확인합니다:

```bash
cd ~/3tier-project/my-backend
./gradlew clean build -x test
ls build/libs/*.war
```

> [!NOTE]
> 빌드 성공 시 `build/libs/` 안에 WAR 파일이 생성됩니다.  
> 파일명은 `settings.gradle`의 `rootProject.name`과 `build.gradle`의 `version`에 따라 결정됩니다.  

✅ **태스크 완료** — 기존 프로젝트의 배포 준비 상태를 확인했습니다.

---

## 태스크 4: CORS 설정

Amazon CloudFront 도메인에서 API를 호출할 수 있도록 CORS를 설정합니다.

**SecurityConfig.java에 CorsFilter가 있는 경우:**

`SecurityConfig.java`에 이미 `CorsFilter` Bean이 있고 `addAllowedOriginPattern("*")`로 설정되어 있다면 추가 작업 없이 동작합니다.  
프로덕션에서 도메인을 제한하려면:

5. `SecurityConfig.java`의 `corsFilter()` 메서드에서 도메인을 설정합니다:

```java
// SecurityConfig.java의 corsFilter() 메서드
@Bean
public CorsFilter corsFilter() {
    UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
    CorsConfiguration config = new CorsConfiguration();
    config.setAllowCredentials(true);
    config.addAllowedOriginPattern("https://<CloudFront 도메인>");
    config.addAllowedOriginPattern("http://localhost:5173");
    config.addAllowedHeader("*");
    config.addAllowedMethod("*");
    source.registerCorsConfiguration("/**", config);
    return new CorsFilter(source);
}
```

**Spring Security 미사용 시 (WebMvcConfigurer):**

6. 기존 `WebConfig.java` (또는 MVC 설정 파일)에 CORS 설정을 추가합니다:

```java
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
> `allowedOriginPatterns("*")`을 그대로 두면 모든 도메인에서 접근 가능합니다.  
> 학습용이라면 `*`로 유지해도 무방합니다.  

> [!TROUBLESHOOTING]
>
> **브라우저에서 CORS 에러**
>
> - 원인: `allowed-origins`에 프론트엔드 도메인 미포함
> - 해결: Amazon CloudFront 도메인을 `https://` 포함하여 정확히 추가
>
> **`localhost`에서 CORS 에러**
>
> - 원인: `http://localhost:5173` 미추가
> - 해결: 개발 환경 URL도 `allowed-origins`에 포함
>
> **OPTIONS 요청 실패 (Preflight)**
>
> - 원인: `allowedMethods`에 `OPTIONS` 미포함
> - 해결: `"GET", "POST", "PUT", "DELETE", "OPTIONS"` 모두 포함 확인

> [!NOTE]
> CORS 에러는 **브라우저에서만** 발생합니다.  
> `curl`로 테스트하면 CORS 에러가 나타나지 않습니다.  
> 브라우저 개발자 도구(F12) → Console 탭에서 CORS 에러 메시지를 확인하세요.  

✅ **태스크 완료** — CORS를 설정했습니다.

---

## 태스크 5: Amazon EC2 배포 + Tomcat + ALB Target Group 등록

### 5-1. Amazon EC2 인스턴스 생성

> [!WARNING]
> AWS Console 우측 상단에서 리전이 **Asia Pacific (Seoul) ap-northeast-2**인지 확인하세요.  

7. 상단 검색창에 `EC2`를 입력하고 **EC2** 서비스를 선택합니다.
8. [[Launch instances]] 버튼을 클릭합니다.
9. **Name**: `my-3tier-app-server`
10. **AMI**: `Amazon Linux 2023` 선택
11. **Instance type**: `t3.micro`
12. **Key pair**: `Proceed without a key pair (Not recommended)` 선택
13. **Network settings** 섹션에서 [[Edit]] 버튼을 클릭하고 다음과 같이 설정합니다:
    - **VPC**: `my-3tier-app-vpc` 선택
    - **Subnet**: `my-3tier-app-private-subnet-1` 선택
    - **Auto-assign public IP**: `Disable`
    - **Security groups**: `my-3tier-app-ec2-sg` 선택

14. **Advanced details** → **IAM instance profile**: SSM + Parameter Store 읽기 권한이 있는 IAM Role 선택
15. [[Launch instance]] 버튼을 클릭합니다.

> [!TIP]
> IAM Role에 필요한 정책: `AmazonSSMManagedInstanceCore` + `AmazonSSMReadOnlyAccess` + `AmazonS3ReadOnlyAccess`
> 앞차시에서 `ec2-starter-role`을 이미 만든 경우 기존 Role에 정책을 추가하면 됩니다.  

### 5-2. EC2 초기 설정 + Tomcat 설치

16. SSM Session Manager로 EC2에 접속하고 초기 설정을 실행합니다:

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

# JAVA_HOME 설정
echo 'export JAVA_HOME=/usr/lib/jvm/java-17-amazon-corretto' | sudo tee -a /etc/profile.d/java.sh
source /etc/profile.d/java.sh
java -version

# MySQL 클라이언트 설치 (RDS 접속 테스트용)
sudo dnf install -y mariadb105

# RDS 접속 테스트
mysql -h <RDS_ENDPOINT> -u admin -p -e "SELECT 1;"

# 또는 SSM Parameter Store에서 값 가져와서 접속 테스트 (태스크 2-1에서 저장한 파라미터 활용)
mysql -h $(aws ssm get-parameter --name "/my-3tier-app/db/endpoint" --query "Parameter.Value" --output text --region ap-northeast-2) \
  -u $(aws ssm get-parameter --name "/my-3tier-app/db/username" --query "Parameter.Value" --output text --region ap-northeast-2) \
  -p$(aws ssm get-parameter --name "/my-3tier-app/db/password" --with-decryption --query "Parameter.Value" --output text --region ap-northeast-2) \
  -e "SELECT 1;"
```

### 5-3. Tomcat 9 설치

17. Tomcat 9를 설치합니다:

```bash
# Tomcat 9 설치 (Spring MVC 5.x + javax.servlet)
sudo dnf install -y wget
wget https://archive.apache.org/dist/tomcat/tomcat-9/v9.0.106/bin/apache-tomcat-9.0.106.tar.gz
sudo mkdir -p /opt/tomcat
sudo tar -xzf apache-tomcat-9.0.106.tar.gz -C /opt/tomcat --strip-components=1
rm apache-tomcat-9.0.106.tar.gz
sudo chown -R ec2-user:ec2-user /opt/tomcat
```

### 5-4. systemd 서비스 등록

18. Tomcat을 systemd 서비스로 등록합니다:

```bash
sudo tee /etc/systemd/system/tomcat.service << 'EOF'
[Unit]
Description=Apache Tomcat
After=network.target

[Service]
Type=forking
User=ec2-user
Group=ec2-user
Environment=JAVA_HOME=/usr/lib/jvm/java-17-amazon-corretto
Environment=CATALINA_HOME=/opt/tomcat
Environment=CATALINA_PID=/opt/tomcat/temp/tomcat.pid
ExecStart=/opt/tomcat/bin/startup.sh
ExecStop=/opt/tomcat/bin/shutdown.sh
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable tomcat
```

### 5-5. setenv.sh 생성 (환경 변수 주입)

19. SSM Parameter Store에서 환경 변수를 주입하는 `setenv.sh`를 생성합니다:

```bash
tee /opt/tomcat/bin/setenv.sh << 'EOF'
#!/bin/bash

# SSM Parameter Store에서 값 가져오기
DB_ENDPOINT=$(aws ssm get-parameter --name "/my-3tier-app/db/endpoint" --query "Parameter.Value" --output text --region ap-northeast-2)
DB_NAME=$(aws ssm get-parameter --name "/my-3tier-app/db/name" --query "Parameter.Value" --output text --region ap-northeast-2)
DB_USERNAME=$(aws ssm get-parameter --name "/my-3tier-app/db/username" --query "Parameter.Value" --output text --region ap-northeast-2)
DB_PASSWORD=$(aws ssm get-parameter --name "/my-3tier-app/db/password" --with-decryption --query "Parameter.Value" --output text --region ap-northeast-2)

# S3 설정 (S3 업로드 기능이 있는 프로젝트만 해당)
S3_BUCKET=$(aws ssm get-parameter --name "/my-3tier-app/s3/bucket" --query "Parameter.Value" --output text --region ap-northeast-2 2>/dev/null || echo "")
S3_REGION=$(aws ssm get-parameter --name "/my-3tier-app/aws/region" --query "Parameter.Value" --output text --region ap-northeast-2 2>/dev/null || echo "ap-northeast-2")

# Java 시스템 프로퍼티로 전달 + 프로파일 설정
export CATALINA_OPTS="$CATALINA_OPTS -DDB_ENDPOINT=$DB_ENDPOINT -DDB_NAME=$DB_NAME -DDB_USERNAME=$DB_USERNAME -DDB_PASSWORD=$DB_PASSWORD -Dcloud.aws.s3.bucket=$S3_BUCKET -Dcloud.aws.region=$S3_REGION -Dspring.profiles.active=prod"
EOF
chmod +x /opt/tomcat/bin/setenv.sh
```

> [!NOTE]
> `setenv.sh`는 Tomcat이 시작될 때 자동으로 실행됩니다.  
> `-D` 옵션으로 전달된 값은 Java 시스템 프로퍼티가 됩니다.  

> [!TIP]
> WAR 방식에서 `ParameterStoreService`를 사용하는 경우, DB 관련 환경 변수는 불필요합니다.  
> 프로파일만 설정하면 됩니다:
>
> ```bash
> export CATALINA_OPTS="$CATALINA_OPTS -Dspring.profiles.active=aws-ssm"
> ```

### 5-6. SQL 실행 (테이블 생성)

기존 프로젝트의 SQL 파일을 Amazon S3를 경유하여 Amazon RDS에 적용합니다.

**① 로컬 PC에서 — SQL/CSV 파일을 S3에 업로드:**

📍 **실행 위치: 로컬 PC**

20. 로컬 PC에서 SQL/CSV 파일을 S3에 업로드합니다:

```bash
export S3_DEPLOY_BUCKET=my-3tier-app-deploy-<BucketSuffix>

# 배포용 버킷 생성 (아직 없는 경우)
aws s3 mb s3://$S3_DEPLOY_BUCKET --region ap-northeast-2

# SQL 파일 업로드
aws s3 cp board.sql s3://$S3_DEPLOY_BUCKET/sql/
aws s3 cp member.sql s3://$S3_DEPLOY_BUCKET/sql/
aws s3 cp travel.sql s3://$S3_DEPLOY_BUCKET/sql/

# CSV 파일이 있는 경우
aws s3 cp travel.csv s3://$S3_DEPLOY_BUCKET/sql/
aws s3 cp travel_image.csv s3://$S3_DEPLOY_BUCKET/sql/
```

**② EC2에서 — S3에서 다운로드 후 RDS에 적용:**

📍 **실행 위치: EC2** (SSM Session Manager 접속 상태)

21. EC2에서 S3의 SQL 파일을 다운로드하고 Amazon RDS에 접속합니다:

```bash
cd /home/ec2-user
export S3_DEPLOY_BUCKET=my-3tier-app-deploy-<BucketSuffix>
export DB_ENDPOINT=$(aws ssm get-parameter --name "/my-3tier-app/db/endpoint" --query "Parameter.Value" --output text --region ap-northeast-2)
export DB_USERNAME=$(aws ssm get-parameter --name "/my-3tier-app/db/username" --query "Parameter.Value" --output text --region ap-northeast-2)
export DB_PASSWORD=$(aws ssm get-parameter --name "/my-3tier-app/db/password" --with-decryption --query "Parameter.Value" --output text --region ap-northeast-2)

# S3에서 SQL/CSV 파일 다운로드
aws s3 cp s3://$S3_DEPLOY_BUCKET/sql/ . --recursive

# Amazon RDS에 접속하여 SQL 실행
mysql -h $DB_ENDPOINT -u $DB_USERNAME -p$DB_PASSWORD
```

22. MySQL에 접속 후 SQL 파일을 실행합니다:

```sql
source /home/ec2-user/board.sql;
source /home/ec2-user/member.sql;
source /home/ec2-user/travel.sql;
SHOW TABLES;
EXIT;
```

> [!WARNING]
> 기존 SQL에 `CREATE DATABASE scoula_db` + `USE scoula_db`가 포함된 경우,
> `application.properties`의 DB 이름도 `scoula_db`로 맞춰야 합니다.  

**③ CSV 데이터 import (해당되는 경우):**

CSV 파일이 있는 경우 `LOAD DATA LOCAL INFILE`로 import합니다:

```bash
# --local-infile 옵션 필수
mysql -h $DB_ENDPOINT -u $DB_USERNAME -p$DB_PASSWORD --local-infile=1 $DB_NAME -e "
  LOAD DATA LOCAL INFILE '/home/ec2-user/travel.csv'
  INTO TABLE tbl_travel
  FIELDS TERMINATED BY ',' ENCLOSED BY '\"'
  LINES TERMINATED BY '\n'
  IGNORE 1 ROWS;"

mysql -h $DB_ENDPOINT -u $DB_USERNAME -p$DB_PASSWORD --local-infile=1 $DB_NAME -e "
  LOAD DATA LOCAL INFILE '/home/ec2-user/travel_image.csv'
  INTO TABLE tbl_travel_image
  FIELDS TERMINATED BY ','
  LINES TERMINATED BY '\n'
  IGNORE 1 ROWS (filename, travel_no);"

# 확인
mysql -h $DB_ENDPOINT -u $DB_USERNAME -p$DB_PASSWORD $DB_NAME -e "SELECT COUNT(*) FROM tbl_travel;"
```

> [!TIP]
> `--local-infile`이 없으면 `ERROR 3948: Loading local data is disabled` 에러가 발생합니다.  

### 5-7. WAR 빌드 및 배포

**로컬에서 빌드 + S3 업로드:**

📍 **실행 위치: 로컬 PC**

23. 로컬에서 WAR를 빌드하고 S3에 업로드합니다:

```bash
cd ~/3tier-project/my-backend
./gradlew clean build -x test

export S3_DEPLOY_BUCKET=my-3tier-app-deploy-<BucketSuffix>
WAR_FILE=$(ls build/libs/*.war | head -1)
aws s3 cp "$WAR_FILE" s3://$S3_DEPLOY_BUCKET/app.war
```

**EC2에서 다운로드 + Tomcat 배포:**

📍 **실행 위치: EC2** (SSM Session Manager 접속 상태)

24. EC2에서 WAR를 다운로드하고 Tomcat에 배포합니다:

```bash
# 앱 디렉토리 생성
mkdir -p /home/ec2-user/app
mkdir -p /tmp/upload

# WAR 다운로드
aws s3 cp s3://$S3_DEPLOY_BUCKET/app.war /home/ec2-user/app/app.war

# Tomcat에 배포 (ROOT.war로 복사)
rm -rf /opt/tomcat/webapps/ROOT /opt/tomcat/webapps/ROOT.war
cp /home/ec2-user/app/app.war /opt/tomcat/webapps/ROOT.war

# Tomcat 시작
sudo systemctl start tomcat

# 상태 확인
sudo systemctl status tomcat
tail -f /opt/tomcat/logs/catalina.out

# 정상 기동 확인
curl http://localhost:8080/
```

### 5-8. ALB Target Group에 EC2 등록

25. 상단 검색창에 `EC2`를 입력하고 **EC2** 서비스를 선택합니다.
26. 왼쪽 메뉴에서 **Target Groups**를 클릭합니다.
27. `my-3tier-app-tg`를 클릭합니다.
28. **Targets** 탭을 클릭합니다.
29. [[Register targets]] 버튼을 클릭합니다.
30. **Available instances**에서 `my-3tier-app-server`를 체크합니다.
31. **Ports for the selected instances**에 `8080`을 입력합니다.
32. [[Include as pending below]] 버튼을 클릭합니다.
33. 하단의 **Review** 섹션에서 인스턴스가 추가된 것을 확인합니다.
34. [[Register pending targets]] 버튼을 클릭하여 등록을 완료합니다.

> [!NOTE]
> Health Check 경로를 확인하세요:
>
> - Target Group → Health checks → [[Edit]]
> - 태스크 1에서 방법 1을 선택했다면 경로를 `/`로 변경
> - 방법 2를 선택했다면 `/health`로 변경
>
> **Spring MVC(WAR) 프로젝트의 경우:**
> Spring MVC는 Actuator가 없으므로 `/actuator/health`가 404를 반환합니다.  
> 반드시 태스크 1에서 선택한 경로로 변경하세요.  

> [!OUTPUT]
> Target Group의 Targets 탭에서 등록된 인스턴스를 확인합니다:
>
> | Instance ID     | Port | Health Status | Status Details                  |
> | --------------- | ---- | ------------- | ------------------------------- |
> | i-0abc123def456 | 8080 | initial       | Target registration in progress |
>
> 약 30초~1분 후 `healthy`로 변경됩니다.  
> `unhealthy`가 표시되면 아래 TROUBLESHOOTING을 참고하세요.  

> [!TROUBLESHOOTING]
>
> **Target Group Status: `unhealthy`**
>
> - 원인: 앱 미시작 또는 Health Check 경로 불일치
> - 해결: EC2에서 Health Check 경로를 직접 호출하여 응답 확인
>   - 방법 1 선택: `curl http://localhost:8080/`
>   - 방법 2 선택: `curl http://localhost:8080/health`
>
> **Tomcat 시작 실패 (`systemctl start tomcat`)**
>
> - 원인: Java 미설치 또는 WAR 경로 오류
> - 해결: `java -version` 확인, `/opt/tomcat/webapps/ROOT.war` 존재 확인, `tail -50 /opt/tomcat/logs/catalina.out`으로 에러 로그 확인
>
> **SSM Session Manager 접속 불가**
>
> - 원인: IAM Role 미연결 또는 VPC 엔드포인트 없음
> - 해결: EC2에 `AmazonSSMManagedInstanceCore` 정책 연결 확인
>
> **`setenv.sh`에서 SSM 값 못 가져옴**
>
> - 원인: EC2 IAM Role에 SSM 읽기 권한 없음
> - 해결: `AmazonSSMReadOnlyAccess` 정책 추가

✅ **태스크 완료** — Amazon EC2에 WAR를 배포하고 ALB Target Group에 등록했습니다.

---

## 태스크 6: GitHub Actions CI/CD (WAR)

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

백엔드 CI/CD에는 `AmazonS3FullAccess`(WAR 업로드)와 `AmazonSSMFullAccess`(SSM Run Command 실행) 권한이 필요합니다.

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

35. 상단 검색창에 `IAM`을 입력하고 **IAM** 서비스를 선택합니다.
36. 왼쪽 메뉴에서 **Users**를 클릭합니다.
37. [[Create user]]를 클릭합니다.
38. **User name**: `github-actions-backend`를 입력합니다.
39. **Provide user access to the AWS Management Console** 체크를 **하지 않습니다** (콘솔 접근 불필요).
40. [[Next]]를 클릭합니다.
41. **Permissions options**에서 `Attach policies directly`를 선택합니다.
42. 다음 정책을 검색하여 체크합니다:
    - `AmazonS3FullAccess` (WAR 업로드용)
    - `AmazonSSMFullAccess` (SSM Run Command 실행용)
43. [[Next]]를 클릭합니다.
44. **Review and create** 페이지에서 설정을 확인하고 [[Create user]]를 클릭합니다.

**📙 옵션 B: 기존 `github-actions-frontend` 사용자에 정책 추가**

35. 상단 검색창에 `IAM`을 입력하고 **IAM** 서비스를 선택합니다.
36. 왼쪽 메뉴에서 **Users**를 클릭합니다.
37. `github-actions-frontend`를 클릭합니다.
38. **Permissions** 탭 → [[Add permissions]] → **Add permissions**를 클릭합니다.
39. **Permissions options**에서 `Attach policies directly`를 선택합니다.
40. 검색창에 `SSMFull`을 입력하고 `AmazonSSMFullAccess`를 체크합니다 (`AmazonS3FullAccess`는 이미 있음).
41. [[Next]] → [[Add permissions]]를 클릭합니다.

> [!NOTE]
> 옵션 B를 선택한 경우 아래 "Access Key 생성"을 건너뛰세요.  
> 8-2에서 발급한 Access Key ID / Secret Access Key를 `my-backend` 레포의 GitHub Secrets에도 동일하게 등록합니다 (6-2에서 진행).

> [!TIP]
> **실무에서는 커스텀 정책(최소 권한)을 권장합니다.**  
> 이 실습에서는 편의상 AWS 관리형 정책을 사용하지만,  
> 프로덕션에서는 JSON 정책으로 특정 리소스에만 접근을 허용합니다.  

### Access Key 생성 (옵션 A만 해당)

> [!NOTE]
> 📙 옵션 B를 선택한 경우 이 단계를 건너뛰고 **6-2. GitHub Secrets 설정**으로 이동하세요.  

45. 생성된 `github-actions-backend` 사용자를 클릭하여 상세 페이지로 이동합니다.
46. **Security credentials** 탭을 클릭합니다.
47. **Access keys** 섹션에서 [[Create access key]]를 클릭합니다.
48. **Use case**에서 `Third-party service`를 선택합니다.
49. 하단의 확인 체크박스를 선택하고 [[Next]]를 클릭합니다.
50. [[Create access key]]를 클릭합니다.
51. **Access key ID**와 **Secret access key**를 복사하여 안전한 곳에 저장합니다.

> [!WARNING]
> Secret access key는 이 화면에서만 확인할 수 있습니다.  
> 페이지를 닫으면 다시 볼 수 없으므로 반드시 복사하여 저장하세요.  

### 6-2. GitHub Secrets 설정

52. 브라우저에서 GitHub → `my-backend` 리포지토리 페이지로 이동합니다.
53. **Settings** 탭을 클릭합니다.
54. 왼쪽 메뉴에서 **Secrets and variables** → **Actions**를 클릭합니다.
55. [[New repository secret]] 버튼을 클릭합니다.
56. 다음 Secrets를 하나씩 추가합니다:
    - `AWS_ACCESS_KEY_ID`: 51번에서 복사한 Access Key ID
    - `AWS_SECRET_ACCESS_KEY`: 51번에서 복사한 Secret Access Key
    - `AWS_REGION`: `ap-northeast-2`
    - `S3_DEPLOY_BUCKET`: `<태스크 5-6에서 생성한 배포용 S3 버킷명>`
    - `EC2_INSTANCE_ID`: `<태스크 5-1에서 생성한 Amazon EC2 인스턴스 ID (예: i-0abc123def456)>`

> [!CONCEPT] Private Subnet Amazon EC2에 배포하는 방법
>
> Private Subnet의 Amazon EC2에는 SSH로 직접 접속할 수 없습니다.  
> 대신 다음 방식으로 배포합니다:
>
> - GitHub Actions에서 WAR을 Amazon S3에 업로드
> - SSM Run Command로 Amazon EC2에서 Amazon S3 다운로드 + Tomcat 재시작
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

57. `.github/workflows/deploy.yml` 파일을 생성합니다:

```yaml
# .github/workflows/deploy.yml (WAR + Tomcat 버전)
name: Deploy Spring MVC WAR to EC2 (via S3 + SSM)

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

      - name: Create application.properties
        run: |
          if [ -n "$APP_PROPS" ]; then
            mkdir -p src/main/resources
            echo "$APP_PROPS" > src/main/resources/application.properties
          fi
        env:
          APP_PROPS: ${{ secrets.APPLICATION_PROPERTIES }}

      - name: Cache Gradle packages
        uses: actions/cache@v4
        with:
          path: |
            ~/.gradle/caches
            ~/.gradle/wrapper
          key: ${{ runner.os }}-gradle-${{ hashFiles('**/*.gradle*') }}
          restore-keys: ${{ runner.os }}-gradle-

      - name: Build WAR
        run: |
          chmod +x ./gradlew
          ./gradlew clean build -x test

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ secrets.AWS_REGION }}

      - name: Upload WAR to S3
        run: |
          WAR_FILE=$(ls build/libs/*.war | head -1)
          aws s3 cp "$WAR_FILE" s3://${{ secrets.S3_DEPLOY_BUCKET }}/app.war

      - name: Deploy via SSM Run Command
        run: |
          COMMAND_ID=$(aws ssm send-command \
            --instance-ids "${{ secrets.EC2_INSTANCE_ID }}" \
            --document-name "AWS-RunShellScript" \
            --timeout-seconds 120 \
            --parameters 'commands=[
              "aws s3 cp s3://${{ secrets.S3_DEPLOY_BUCKET }}/app.war /home/ec2-user/app/app.war --quiet",
              "rm -rf /opt/tomcat/webapps/ROOT /opt/tomcat/webapps/ROOT.war",
              "cp /home/ec2-user/app/app.war /opt/tomcat/webapps/ROOT.war",
              "chown -R ec2-user:ec2-user /opt/tomcat/webapps/ROOT.war",
              "systemctl restart tomcat",
              "sleep 30",
              "for i in 1 2 3; do curl -sf http://localhost:8080/ && exit 0; sleep 10; done; exit 1"
            ]' \
            --query "Command.CommandId" \
            --output text)

          echo "SSM Command ID: $COMMAND_ID"

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
>       │                         │                                │ 3. S3에서 WAR 다운로드
>       │                         │                                │ 4. Tomcat 재시작
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

58. 변경사항을 커밋하고 push합니다:

```bash
cd ~/3tier-project/my-backend

git add .
git commit -m "feat: initial backend with CI/CD"
git push origin main
```

59. GitHub → `my-backend` 리포지토리 → **Actions** 탭에서 워크플로우 실행을 확인합니다.

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

✅ **태스크 완료** — GitHub Actions로 WAR 자동 배포 파이프라인을 구축했습니다.

---

## 태스크 7: ALB Health Check 확인 + API 테스트

### 7-1. Target Group Health Check 확인

37. 상단 검색창에 `EC2`를 입력하고 **EC2** 서비스를 선택합니다.
38. 왼쪽 메뉴에서 **Target Groups** → `my-3tier-app-tg`를 클릭합니다.
39. **Targets** 탭에서 Status를 확인합니다.
40. Status가 `healthy`이면 정상

### 7-2. ALB를 통한 API 테스트

39. ALB DNS를 통해 API를 테스트합니다:

```bash
ALB_DNS="<ALB_DNS_NAME>"

# Health Check
curl http://$ALB_DNS/
# 또는
curl http://$ALB_DNS/health

# 게시글 목록 조회 (GET — 인증 불필요)
curl http://$ALB_DNS/api/board

# 여행지 목록 조회
curl http://$ALB_DNS/api/travel
```

> 위 요청에 JSON 응답이 오면 **백엔드 배포 + DB 연동 성공**입니다.  

**인증 필요 API 테스트 (선택):**

40. 인증이 필요한 API를 테스트합니다:

```bash
# 로그인하여 토큰 획득
TOKEN=$(curl -s -X POST http://$ALB_DNS/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "<PASSWORD>"}' | jq -r '.token')

echo $TOKEN

# 게시글 생성
curl -X POST http://$ALB_DNS/api/board \
  -H "Authorization: Bearer $TOKEN" \
  -F "title=배포 테스트" \
  -F "content=ALB 경유 확인" \
  -F "writer=admin"
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

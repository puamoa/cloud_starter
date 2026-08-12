---
title: '기존 백엔드 배포: Spring Boot JAR (EC2 + ALB)'
week: 8
session: '3B'
awsServices:
  - Amazon EC2
  - Elastic Load Balancing
learningObjectives:
  - 기존 Spring Boot 프로젝트를 Amazon EC2에 JAR로 배포할 수 있습니다.
  - SSM Parameter Store로 비밀값을 관리할 수 있습니다.
  - ALB와 연결하여 로드 밸런싱을 적용할 수 있습니다.
  - GitHub Actions로 백엔드 자동 배포를 구성할 수 있습니다.
prerequisites:
  - Step 8-1 완료 (인프라 구축)
  - 기존 Spring Boot 프로젝트 (JPA/MyBatis, JAR 패키징)
  - Java 17 + Gradle (로컬)
estimatedCost: 크레딧 내 사용 가능 (비용 발생 가능)
---

이 실습에서는 **기존 Spring Boot 프로젝트**(JAR)를 Amazon EC2에 배포하고,
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
기존 Spring Boot 프로젝트의 경우 아래 중 하나를 확인하세요:

**🟢 방법 1: Actuator가 이미 있는 경우 (가장 간단)**

`build.gradle`에 `spring-boot-starter-actuator` 의존성이 있다면 `/actuator/health`가 자동으로 활성화됩니다. 추가 작업 없음.

> [!TIP]
> 의존성만 있으면 별도 yml 설정 없이도 `/actuator/health`가 동작합니다.  
> **방법 2**의 yml 설정은 상세 정보 노출(`show-details`)과 엔드포인트 제한(`exposure.include`)을 명시적으로 설정하고 싶을 때 추가합니다.

**🟡 방법 2: Actuator가 없는 경우 — 의존성 추가**

1. `build.gradle`에 Actuator 의존성을 추가합니다:

```groovy
// build.gradle
implementation 'org.springframework.boot:spring-boot-starter-actuator'
```

2. `application.yml` (또는 `.properties`)에 다음을 추가합니다 (선택):

```yaml
management:
  endpoints:
    web:
      exposure:
        include: health, info
  endpoint:
    health:
      show-details: always
```

**🔴 방법 3: Actuator를 추가하지 않으려면 — Health Controller 직접 작성**

3. Health Check용 Controller를 작성합니다:

```java
@RestController
public class HealthController {
    @GetMapping("/health")
    public ResponseEntity<String> health() {
        return ResponseEntity.ok("OK");
    }
}
```

Target Group Health Check 경로를 `/health`로 변경합니다 (태스크 5에서 설정).

✅ **태스크 완료** — Health Check 방식을 확인했습니다.

---

## 태스크 2: RDS 연동 설정

> [!WARNING]
> 이 태스크는 **필수**입니다.  
> SSM Parameter Store에 DB 접속 정보를 저장하지 않으면 Amazon EC2에서 애플리케이션이 시작되지 않습니다.

### 2-1. SSM Parameter Store에 비밀값 저장

4. 아래 명령어에서 `<>` 부분을 본인 값으로 수정한 후 실행합니다:

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

<img src="/images/step8/8-3-step1-ssm-1.png" alt="SSM Parameter Store 저장 1" class="guide-img-sm" />
<img src="/images/step8/8-3-step1-ssm-2.png" alt="SSM Parameter Store 저장 2" class="guide-img-sm" />
<img src="/images/step8/8-3-step1-ssm-3.png" alt="SSM Parameter Store 저장 3" class="guide-img-sm" />
<img src="/images/step8/8-3-step1-ssm-4.png" alt="SSM Parameter Store 저장 4" class="guide-img-sm" />
<img src="/images/step8/8-3-step1-ssm-5.png" alt="SSM Parameter Store 저장 5" class="guide-img-sm" />

> [!TIP]
> 프로젝트에서 S3 업로드 기능을 사용하거나 추가 설정이 필요한 경우 아래 파라미터도 등록하세요:
>
> ```bash
> # S3 버킷명 (S3 업로드 기능이 있는 프로젝트만 해당)
> aws ssm put-parameter \
>   --name "/my-3tier-app/s3/bucket" \
>   --value "<Step 8-1 CloudFormation Outputs의 S3BucketName 값>" \
>   --type String
>
> # AWS 리전
> aws ssm put-parameter \
>   --name "/my-3tier-app/aws/region" \
>   --value "ap-northeast-2" \
>   --type String
> ```

> [!TIP]
> `SecureString` 타입은 AWS KMS로 자동 암호화됩니다.  
> 비밀번호, API 키 등 민감한 값은 항상 SecureString을 사용하세요.
>
> **값을 잘못 입력한 경우:**
>
> - CLI: `--overwrite` 플래그를 추가하여 같은 명령을 다시 실행하면 덮어씁니다.
> - 콘솔: AWS Console → Systems Manager → Parameter Store에서 해당 파라미터를 클릭하고 [[Edit]] → 값 수정 → [[Save changes]]

### 2-2. DB 접속 설정 파일 수정

5. 기존 Spring Boot 프로젝트의 `application.yml` (또는 `.properties`)에서 DB 접속 정보를 환경 변수로 변경합니다.

**application.yml 사용 시:**

```yaml
spring:
  datasource:
    url: jdbc:mysql://${DB_ENDPOINT}:3306/${DB_NAME}?useSSL=false&serverTimezone=Asia/Seoul&characterEncoding=UTF-8
    username: ${DB_USERNAME}
    password: ${DB_PASSWORD}
    driver-class-name: com.mysql.cj.jdbc.Driver
```

<img src="/images/step8/8-3c-step8-application-yml.png" alt="application.yml 환경 변수 설정" class="guide-img-sm" />

**application.properties 사용 시:**

```properties
# 변경 전 (로컬 DB)
#spring.datasource.url=jdbc:mysql://localhost:3306/mydb
#spring.datasource.username=root
#spring.datasource.password=1234

# 변경 후 (환경 변수에서 주입)
spring.datasource.url=jdbc:mysql://${DB_ENDPOINT}:3306/${DB_NAME}?useSSL=false&serverTimezone=Asia/Seoul
spring.datasource.username=${DB_USERNAME}
spring.datasource.password=${DB_PASSWORD}
```

> [!TIP]
> **로컬 개발 시** 환경 변수가 없으면 앱이 시작되지 않습니다.  
> IntelliJ Run/Debug Configuration → Environment variables에 입력:
>
> ```
> DB_ENDPOINT=localhost;DB_NAME=mydb;DB_USERNAME=root;DB_PASSWORD=1234
> ```
>
> 본인 프로젝트의 DB 이름, 사용자명, 비밀번호가 위 예시와 다르면 본인 값으로 변경하세요.  
> 예: `DB_NAME=scoula_db;DB_USERNAME=scoula;DB_PASSWORD=Scoula123!`

**Step 6-1 실습을 적용한 경우 (ParameterStoreService 사용):**

`ParameterStoreService`를 구현하여 SSM Parameter Store에서 직접 값을 읽는 구조라면,  
`application.properties`에 환경 변수를 넣을 필요가 없습니다.  
대신 SSM Parameter Store의 파라미터 값만 Amazon RDS 엔드포인트로 업데이트합니다:

6. SSM Parameter Store의 DB URL 파라미터를 RDS 엔드포인트로 업데이트합니다 (아래 `<>` 부분을 본인 값으로 수정한 후 실행합니다):

```bash
aws ssm put-parameter \
  --name "/starter/prod/db/url" \
  --value "jdbc:mysql://<RDS_ENDPOINT>:3306/<DB_NAME>?useSSL=false&serverTimezone=Asia/Seoul" \
  --type String \
  --overwrite
```

<img src="/images/step8/8-3-step3-ssm-verify-1.png" alt="SSM 파라미터 업데이트 1" class="guide-img-sm" />
<img src="/images/step8/8-3-step3-ssm-verify-2.png" alt="SSM 파라미터 업데이트 2" class="guide-img-sm" />

> [!TIP]
> 이 경우 `application.yml`은 수정하지 않아도 됩니다.  
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

✅ **태스크 완료** — Amazon RDS 연동 설정을 완료했습니다.

---

## 태스크 3: 기존 프로젝트 확인 사항

기존 프로젝트에는 이미 Entity, Repository, Controller가 있으므로 새로 작성하지 않습니다.  
아래 항목만 확인하세요:

- **빌드 가능 여부**: `./gradlew clean bootJar`로 JAR 생성 확인
- **API 엔드포인트**: 기존 API가 정상 동작하는지 로컬에서 확인
- **SQL 파일 존재** (DB에 테이블이 없는 경우): 테이블 생성 SQL 확인

7. 다음 명령어로 JAR 빌드가 정상적으로 되는지 확인합니다:

```bash
cd ~/3tier-project/my-backend
./gradlew clean bootJar
ls build/libs/*.jar
```

<img src="/images/step8/8-3b-step7-gradle-build.png" alt="Gradle JAR 빌드 결과" class="guide-img-sm" />

> [!NOTE]
> `bootJar`로 빌드하면 실행 가능한 Fat JAR이 생성됩니다.  
> `build -x test`는 일반 JAR과 WAR을 모두 생성하므로 Spring Boot라면 `bootJar`를 사용하세요.
>
> **JPA(ddl-auto: update)를 사용하는 경우:**
> 앱 시작 시 테이블이 자동 생성되므로 SQL 실행이 불필요합니다.
>
> **MyBatis + SQL 파일을 사용하는 경우:**
> 태스크 5에서 EC2 접속 후 SQL을 Amazon RDS에 실행합니다.

✅ **태스크 완료** — 기존 프로젝트의 배포 준비 상태를 확인했습니다.

> [!WARNING]
> **S3에 이미지를 저장하는 프로젝트 (Step 5-2 적용한 경우):**
>
> 로컬 파일 경로(`uploadPath`)로 이미지를 서빙하는 코드가 있다면, 배포 환경에서는 S3에서 읽도록 수정이 필요합니다.  
> `upload.storage.type` 설정에 따라 분기하는 방식을 권장합니다.
>
> **체크 대상:** `uploadPath`를 사용하여 파일을 읽는 Controller/Service 메서드  
> **수정 예시 (TravelController 등):**
>
> ```java
> @Value("${upload.storage.type}")
> private String storageType;
>
> @GetMapping("/image/{no}")
> public void viewImage(@PathVariable Long no, HttpServletResponse response) {
>     TravelImageDTO image = service.getImage(no);
>     String path;
>     if ("s3".equals(storageType)) {
>         path = "public/travel/" + image.getFilename(); // S3 key
>     } else {
>         path = uploadPath + "/travel/" + image.getFilename(); // 로컬
>     }
>     File file = new File(path);
>     UploadFiles.downloadImage(response, file);
> }
> ```
>
> 또한 기존 이미지 파일을 S3에 업로드하는 마이그레이션이 필요합니다:
>
> ```bash
> aws s3 sync /tmp/upload/ s3://<BUCKET_NAME>/public/
> ```
>
> **다른 방법도 가능합니다:**
>
> - DTO에서 S3 URL을 직접 반환하여 백엔드 프록시를 거치지 않는 방식 (성능 우수)
> - Presigned URL을 생성하여 private 파일도 시간 제한 접근 가능
> - CloudFront를 S3 앞에 두고 CDN URL을 반환하는 방식 (캐싱 + 속도)
> - 프론트엔드에서 이미지 URL을 조합 (백엔드가 filename만 반환, 프론트가 S3 base URL + filename으로 `<img src>` 조합)

---

## 태스크 4: CORS 설정

Amazon CloudFront 도메인에서 API를 호출할 수 있도록 CORS를 설정합니다.

> [!NOTE]
> 아래 8번 또는 9번 중 **본인 프로젝트에 해당하는 것만** 진행합니다.  
> 이미 `addAllowedOriginPattern("*")`로 설정되어 있다면 추가 작업 없이 동작합니다.

**Spring Security를 사용하는 경우 (SecurityConfig):**

8. `SecurityConfig.java`에서 CORS 설정을 확인하거나 수정합니다:

```java
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

9. `WebConfig.java`를 생성하여 CORS를 설정합니다:

```java
@Configuration
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

<img src="/images/step8/8-3c-step12-build-test.png" alt="CORS 설정 완료" class="guide-img-sm" />

> [!TIP]
> 학습용이라면 `*`로 유지해도 무방합니다.

> [!TROUBLESHOOTING]
>
> **브라우저에서 CORS 에러**
>
> - 원인: `allowed-origins`에 프론트엔드 도메인 미포함
> - 해결: Amazon CloudFront 도메인을 `https://` 포함하여 정확히 추가
>
> **OPTIONS 요청 실패 (Preflight)**
>
> - 원인: `allowedMethods`에 `OPTIONS` 미포함
> - 해결: `"GET", "POST", "PUT", "DELETE", "OPTIONS"` 모두 포함 확인

> [!NOTE]
> CORS 에러는 **브라우저에서만** 발생합니다.  
> `curl`로 테스트하면 CORS 에러가 나타나지 않습니다.

✅ **태스크 완료** — CORS를 설정했습니다.

---

## 태스크 5: Amazon EC2 배포 + ALB Target Group 등록

### 5-1. Amazon EC2 인스턴스 생성

> [!WARNING]
> AWS Console 우측 상단에서 리전이 **Asia Pacific (Seoul) ap-northeast-2**인지 확인하세요.

10. **EC2** → [[Launch instances]]를 클릭합니다.
    <img src="/images/step8/8-3-ec2-launch.png" alt="EC2 Launch instances" class="guide-img-sm" />

11. 다음과 같이 인스턴스를 설정합니다:
    - **Name**: `my-3tier-app-server`
    - **Tags** 섹션: [[Add new tag]]를 클릭하여 추가
      - `CreatedBy` = `admin-user`
      - `Step` = `step8`
      - `Session` = `8-3`
    - **AMI**: `Amazon Linux 2023`
    - **Instance type**: `t3.micro`
    - **Key pair**: `Proceed without a key pair`
      <img src="/images/step8/8-3-ec2-name-tags.png" alt="EC2 인스턴스 설정" class="guide-img-sm" />

12. **Network settings** → [[Edit]]를 클릭하여 다음과 같이 설정합니다:
    - **VPC**: `my-3tier-app-vpc`
    - **Subnet**: `my-3tier-app-private-subnet-1`
    - **Auto-assign public IP**: `Disable`
    - **Security groups**: `my-3tier-app-ec2-sg`
      <img src="/images/step8/8-3-ec2-network.png" alt="Network settings 설정" class="guide-img-sm" />

13. **Advanced details** → **IAM instance profile**에서 `my-3tier-app-ec2-role` (또는 `ec2-starter-role`)을 선택합니다.
    - 필요 정책: `AmazonSSMManagedInstanceCore` + `AmazonSSMReadOnlyAccess` + `AmazonS3FullAccess`
    - 앞차시에서 `ec2-starter-role`을 이미 만든 경우 해당 Role에 위 정책을 추가하여 선택합니다.
      <img src="/images/step8/8-3-ec2-iam-role.png" alt="IAM instance profile 선택" class="guide-img-sm" />

> [!TIP]
> **Role이 없는 경우 새로 생성:**
>
> 1. 새 탭에서 IAM → Roles → [[Create role]]
> 2. Trusted entity: `AWS service` → Use case: `EC2` → [[Next]]
> 3. 검색창에 `SSMManaged` → `AmazonSSMManagedInstanceCore` 체크
> 4. 검색창 지우고 `SSMReadOnly` → `AmazonSSMReadOnlyAccess` 체크
> 5. 검색창 지우고 `S3Full` → `AmazonS3FullAccess` 체크
> 6. [[Next]] → Role name: `my-3tier-app-ec2-role` → [[Create role]]
> 7. EC2 생성 화면으로 돌아와서 IAM instance profile에 `my-3tier-app-ec2-role` 선택

14. [[Launch instance]]를 클릭하여 인스턴스를 생성합니다.
    <img src="/images/step8/8-3-launch-instance-1.png" alt="Launch instance 클릭" class="guide-img-sm" />
    <img src="/images/step8/8-3-launch-instance-2.png" alt="인스턴스 생성 완료" class="guide-img-sm" />

> [!TIP]
> IAM Role에 필요한 정책: `AmazonSSMManagedInstanceCore` + `AmazonSSMReadOnlyAccess` + `AmazonS3FullAccess`  
> 앞차시에서 `ec2-starter-role`을 이미 만든 경우 기존 Role에 정책을 추가하면 됩니다.

### 5-2. EC2 초기 설정

15. SSM Session Manager로 EC2에 접속한 후 Java 17과 MySQL 클라이언트를 설치합니다 (아래 `<>` 부분을 본인 값으로 수정한 후 실행합니다):

```bash
# SSM Session Manager로 EC2 접속 (AWS Console에서)
# EC2 콘솔 → 인스턴스 선택 → [[Connect]] → Session Manager 탭 → [[Connect]]

# 또는 AWS CLI로 접속 (Instance ID는 EC2 콘솔에서 확인)
aws ssm start-session --target <INSTANCE_ID> --region ap-northeast-2
```

<img src="/images/step8/8-3-ssm-connect-1.png" alt="EC2 Connect 화면" class="guide-img-sm" />
<img src="/images/step8/8-3-ssm-connect-2.png" alt="Session Manager 탭" class="guide-img-sm" />
<img src="/images/step8/8-3-ssm-connect-3.png" alt="SSM 접속 완료" class="guide-img-sm" />

> [!TIP]
> **AWS CLI로 접속하려면** 로컬에 Session Manager plugin이 필요합니다:
>
> - 🍎 macOS: `brew install session-manager-plugin`
> - 🪟 Windows: [Session Manager plugin 인스톨러 다운로드](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html)
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

# MySQL 클라이언트 설치 + RDS 접속 테스트 (아래 <> 부분을 본인 값으로 수정)
sudo dnf install -y mariadb105
mysql -h <RDS_ENDPOINT> -u admin -p -e "SELECT 1;"

# 또는 SSM Parameter Store에서 값 가져와서 접속 테스트
mysql -h $(aws ssm get-parameter --name "/my-3tier-app/db/endpoint" --query "Parameter.Value" --output text --region ap-northeast-2) \
  -u $(aws ssm get-parameter --name "/my-3tier-app/db/username" --query "Parameter.Value" --output text --region ap-northeast-2) \
  -p$(aws ssm get-parameter --name "/my-3tier-app/db/password" --with-decryption --query "Parameter.Value" --output text --region ap-northeast-2) \
  -e "SELECT 1;"
```

<img src="/images/step8/8-3-ec2-setup-1.png" alt="Java 설치" class="guide-img-sm" />
<img src="/images/step8/8-3-ec2-setup-2.png" alt="MySQL 클라이언트 설치" class="guide-img-sm" />
<img src="/images/step8/8-3-ec2-setup-3.png" alt="RDS 접속 테스트" class="guide-img-sm" />
<img src="/images/step8/8-3-ec2-setup-4.png" alt="접속 테스트 성공" class="guide-img-sm" />

### 5-3. SQL 실행 (MyBatis + SQL 파일 사용 시)

> [!NOTE]
> JPA(ddl-auto: update)를 사용하는 프로젝트는 이 단계를 건너뛰세요.  
> 앱 시작 시 테이블이 자동 생성됩니다.

SQL 파일이 있는 경우, Amazon S3를 경유하여 Amazon RDS에 적용합니다:

**① 로컬 PC에서 — SQL 파일을 S3에 업로드:**

📍 **실행 위치: 로컬 PC (터미널)** — ALB가 Internet-facing이므로 인터넷이 되는 곳이면 어디서든 가능

16. 로컬에서 SQL 파일을 S3에 업로드합니다 (아래 `<>` 부분을 본인 값으로 수정한 후 실행합니다):

```bash
export S3_DEPLOY_BUCKET=my-3tier-app-deploy-<BucketSuffix>

# 배포용 버킷 생성 (이미 있으면 생략)
aws s3 mb s3://$S3_DEPLOY_BUCKET --region ap-northeast-2

# SQL 파일 업로드 (본인 프로젝트의 SQL 파일명으로 변경)
aws s3 cp schema.sql s3://$S3_DEPLOY_BUCKET/sql/
# 파일이 여러 개인 경우:
# aws s3 cp board.sql s3://$S3_DEPLOY_BUCKET/sql/
# aws s3 cp member.sql s3://$S3_DEPLOY_BUCKET/sql/
```

<img src="/images/step8/8-3a-step20-sql-upload-1.png" alt="S3 버킷 생성 및 SQL 업로드 1" class="guide-img-sm" />
<img src="/images/step8/8-3a-step20-sql-upload-2.png" alt="SQL 파일 업로드 2" class="guide-img-sm" />

**② EC2에서 — S3에서 다운로드 후 RDS에 적용:**

📍 **실행 위치: EC2 (SSM Session Manager)**

17. EC2에서 SQL 파일을 다운로드하고 RDS에 적용합니다 (아래 `<>` 부분을 본인 값으로 수정한 후 실행합니다):

```bash
cd /home/ec2-user
export S3_DEPLOY_BUCKET=my-3tier-app-deploy-<BucketSuffix>
export DB_ENDPOINT=$(aws ssm get-parameter --name "/my-3tier-app/db/endpoint" --query "Parameter.Value" --output text --region ap-northeast-2)
export DB_USERNAME=$(aws ssm get-parameter --name "/my-3tier-app/db/username" --query "Parameter.Value" --output text --region ap-northeast-2)
export DB_PASSWORD=$(aws ssm get-parameter --name "/my-3tier-app/db/password" --with-decryption --query "Parameter.Value" --output text --region ap-northeast-2)

aws s3 cp s3://$S3_DEPLOY_BUCKET/sql/ . --recursive
mysql -h $DB_ENDPOINT -u $DB_USERNAME -p$DB_PASSWORD < schema.sql
# 파일이 여러 개인 경우 각각 실행:
# mysql -h $DB_ENDPOINT -u $DB_USERNAME -p$DB_PASSWORD < board.sql
# mysql -h $DB_ENDPOINT -u $DB_USERNAME -p$DB_PASSWORD < member.sql
```

<img src="/images/step8/8-3a-step21-sql-download.png" alt="SQL 다운로드 및 RDS 적용" class="guide-img-sm" />
<img src="/images/step8/8-3a-step21-sql-execute.png" alt="SQL 실행 확인" class="guide-img-sm" />

### 5-4. start.sh 생성

18. 앱 시작 스크립트를 생성합니다:

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

<img src="/images/step8/8-3c-step22-start-sh.png" alt="start.sh 생성" class="guide-img-sm" />

> [!TIP]
> **ParameterStoreService를 사용하는 경우:**
> `ParameterStoreService`가 앱 내부에서 SSM 값을 직접 읽으므로 환경 변수 export가 불필요합니다:
>
> ```bash
> cat << 'SCRIPT' > /home/ec2-user/app/start.sh
> #!/bin/bash
> exec java -jar /home/ec2-user/app/app.jar \
>   --spring.profiles.active=aws-ssm
> SCRIPT
> ```
>
> `aws-ssm`은 Step 6-1에서 `ParameterStoreService`에 설정한 `@Profile` 값입니다.  
> 본인 프로젝트에서 다른 이름을 사용했다면 해당 값으로 변경하세요.

### 5-5. systemd 서비스 등록

19. systemd 서비스 파일을 생성하고 등록합니다:

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

<img src="/images/step8/8-3c-step23-jar-deploy.png" alt="systemd 서비스 등록" class="guide-img-sm" />

### 5-6. JAR 빌드 및 배포

📍 **실행 위치: 로컬 PC (터미널)** — ALB가 Internet-facing이므로 인터넷이 되는 곳이면 어디서든 가능

20. 로컬에서 JAR을 빌드하고 S3에 업로드합니다 (아래 `<>` 부분을 본인 값으로 수정한 후 실행합니다):

```bash
cd ~/3tier-project/my-backend
./gradlew clean bootJar

export S3_DEPLOY_BUCKET=my-3tier-app-deploy-<BucketSuffix>
JAR_FILE=$(ls build/libs/*.jar | head -1)
aws s3 cp "$JAR_FILE" s3://$S3_DEPLOY_BUCKET/app.jar
```

<img src="/images/step8/8-3c-step24-target-group-1.png" alt="JAR 빌드 및 S3 업로드 1" class="guide-img-sm" />
<img src="/images/step8/8-3c-step24-target-group-2.png" alt="JAR 빌드 및 S3 업로드 2" class="guide-img-sm" />

📍 **실행 위치: EC2 (SSM Session Manager)**

21. EC2에서 JAR을 다운로드하고 서비스를 시작합니다 (아래 `<>` 부분을 본인 값으로 수정한 후 실행합니다):

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

<img src="/images/step8/8-3c-step25-jar-run-1.png" alt="JAR 다운로드 및 실행" class="guide-img-sm" />
<img src="/images/step8/8-3c-step25-jar-run-2.png" alt="Health Check 확인" class="guide-img-sm" />

### 5-7. ALB Target Group에 EC2 등록

22. 상단 검색창에 `EC2`를 입력하고 **EC2** 서비스를 선택합니다.

23. 왼쪽 메뉴에서 **Target Groups**를 클릭합니다.
    <img src="/images/step8/8-3-target-groups.png" alt="Target Groups 메뉴" class="guide-img-sm" />

24. `my-3tier-app-tg`를 클릭합니다.

25. **Targets** 탭을 클릭하고 [[Register targets]] 버튼을 클릭합니다.
    <img src="/images/step8/8-3-targets-tab.png" alt="Targets 탭" class="guide-img-sm" />

26. **Available instances**에서 `my-3tier-app-server`를 체크합니다.

27. **Ports for the selected instances**에 `8080`을 입력합니다.
    <img src="/images/step8/8-3-port-8080.png" alt="Port 8080 입력" class="guide-img-sm" />

28. [[Include as pending below]] 버튼을 클릭합니다.
    <img src="/images/step8/8-3-include-pending.png" alt="Include as pending below" class="guide-img-sm" />

29. 하단의 **Review** 섹션에서 인스턴스가 추가된 것을 확인합니다.

30. [[Register pending targets]] 버튼을 클릭하여 등록을 완료합니다.
    <img src="/images/step8/8-3-register-targets-1.png" alt="Register pending targets 1" class="guide-img-sm" />
    <img src="/images/step8/8-3-register-targets-2.png" alt="Register pending targets 2" class="guide-img-sm" />

> [!NOTE]
> Health Check 경로 확인:
>
> - Actuator 사용 시: 기본값 `/actuator/health` 그대로 유지
> - HealthController 직접 작성 시: Target Group → Health checks → [[Edit]] → 경로를 `/health`로 변경

> [!OUTPUT]
> Target Group의 Targets 탭에서 등록된 인스턴스를 확인합니다:
>
> | Instance ID     | Port | Health Status | Status Details                  |
> | --------------- | ---- | ------------- | ------------------------------- |
> | i-0abc123def456 | 8080 | initial       | Target registration in progress |
>
> 약 30초 ~ 1분 후 `healthy`로 변경됩니다.

> [!TROUBLESHOOTING]
>
> **Target Group Status: `unhealthy`**
>
> - 원인: 앱 미시작 또는 Health Check 경로 불일치
> - 해결: EC2에서 Health Check 경로를 직접 호출하여 응답 확인
>   - 방법 1/2 선택: `curl http://localhost:8080/actuator/health`
>   - 방법 3 선택: `curl http://localhost:8080/health`
>
> **`systemctl start spring-app` 실패**
>
> - 원인: Java 미설치 또는 JAR 경로 오류
> - 해결: `java -version` 확인, `/home/ec2-user/app/app.jar` 존재 확인, `sudo journalctl -u spring-app -n 50`으로 에러 로그 확인
>
> **SSM Session Manager 접속 불가**
>
> - 원인: IAM Role 미연결 또는 VPC 엔드포인트 없음
> - 해결: EC2에 `AmazonSSMManagedInstanceCore` 정책 연결 확인
>
> **`start.sh`에서 SSM 값 못 가져옴**
>
> - 원인: EC2 IAM Role에 SSM 읽기 권한 없음
> - 해결: `AmazonSSMReadOnlyAccess` 정책 추가

✅ **태스크 완료** — Amazon EC2에 JAR을 배포하고 ALB Target Group에 등록했습니다.

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

31. 상단 검색창에 `IAM`을 입력하고 **IAM** 서비스를 선택합니다.

32. 왼쪽 메뉴에서 **Users**를 클릭합니다.

33. [[Create user]]를 클릭합니다.

34. **User name**: `github-actions-backend`를 입력합니다.
    <img src="/images/step8/8-3a-step38-alb-test.png" alt="User name 입력" class="guide-img-sm" />

35. **Provide user access to the AWS Management Console** 체크를 **하지 않습니다** (콘솔 접근 불필요).

36. [[Next]]를 클릭합니다.

37. **Permissions options**에서 `Attach policies directly`를 선택합니다.

38. 다음 정책을 검색하여 체크합니다: - `AmazonS3FullAccess` (JAR 업로드용) - `AmazonSSMFullAccess` (SSM Run Command 실행용)
    <img src="/images/step8/8-3a-step42-iam-user.png" alt="정책 선택" class="guide-img-sm" />

39. [[Next]]를 클릭합니다.

40. **Review and create** 페이지에서 설정을 확인하고 [[Create user]]를 클릭합니다.
    <img src="/images/step8/8-3a-step44-secrets-1.png" alt="Review and create" class="guide-img-sm" />
    <img src="/images/step8/8-3a-step44-secrets-2.png" alt="Create user 완료" class="guide-img-sm" />

**📙 옵션 B: 기존 `github-actions-frontend` 사용자에 정책 추가**

41. 상단 검색창에 `IAM`을 입력하고 **IAM** 서비스를 선택합니다.

42. 왼쪽 메뉴에서 **Users**를 클릭합니다.

43. `github-actions-frontend`를 클릭합니다.

44. **Permissions** 탭 → [[Add permissions]] → **Add permissions**를 클릭합니다.
    <img src="/images/step8/8-3a-step48-access-key.png" alt="Add permissions 클릭" class="guide-img-sm" />

45. **Permissions options**에서 `Attach policies directly`를 선택합니다.

46. 검색창에 `SSMFull`을 입력하고 `AmazonSSMFullAccess`를 체크합니다 (`AmazonS3FullAccess`는 이미 있음).
    <img src="/images/step8/8-3a-step50-github-secrets.png" alt="SSMFullAccess 정책 추가" class="guide-img-sm" />

47. [[Next]] → [[Add permissions]]를 클릭합니다.
    <img src="/images/step8/8-3a-step51-secrets-1.png" alt="Add permissions 확인 1" class="guide-img-sm" />
    <img src="/images/step8/8-3a-step51-secrets-2.png" alt="Add permissions 확인 2" class="guide-img-sm" />

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

48. 생성된 `github-actions-backend` 사용자를 클릭하여 상세 페이지로 이동합니다.

49. **Security credentials** 탭을 클릭합니다.

50. **Access keys** 섹션에서 [[Create access key]]를 클릭합니다.

51. **Use case**에서 `Third-party service`를 선택합니다.

52. 하단의 확인 체크박스를 선택하고 [[Next]]를 클릭합니다.

53. [[Create access key]]를 클릭합니다.

54. **Access key ID**와 **Secret access key**를 복사하여 안전한 곳에 저장합니다.
    <img src="/images/step8/8-3a-step58-copy-keys.png" alt="Access Key 복사" class="guide-img-sm" />

> [!WARNING]
> Secret access key는 이 화면에서만 확인할 수 있습니다.  
> 페이지를 닫으면 다시 볼 수 없으므로 반드시 복사하여 저장하세요.

### 6-2. GitHub Secrets 설정

55. 브라우저에서 GitHub → `my-backend` 리포지토리 페이지로 이동합니다.

56. **Settings** 탭을 클릭합니다.

57. 왼쪽 메뉴에서 **Secrets and variables** → **Actions**를 클릭합니다.
    <img src="/images/step8/8-3a-step61-github-settings.png" alt="Secrets and variables 메뉴" class="guide-img-sm" />

58. [[New repository secret]] 버튼을 클릭합니다.

59. 다음 Secrets를 하나씩 추가합니다:
    - `AWS_ACCESS_KEY_ID`: 47번에서 복사한 Access Key ID
    - `AWS_SECRET_ACCESS_KEY`: 47번에서 복사한 Secret Access Key
    - `AWS_REGION`: `ap-northeast-2`
    - `S3_DEPLOY_BUCKET`: `<태스크 5-5에서 생성한 배포용 S3 버킷명>`
    - `EC2_INSTANCE_ID`: `<태스크 5-1에서 생성한 Amazon EC2 인스턴스 ID (예: i-0abc123def456)>`
      <img src="/images/step8/8-3a-step63-secrets-1.png" alt="GitHub Secrets 추가 1" class="guide-img-sm" />
      <img src="/images/step8/8-3a-step63-secrets-2.png" alt="GitHub Secrets 추가 2" class="guide-img-sm" />
      <img src="/images/step8/8-3a-step63-secrets-3.png" alt="GitHub Secrets 추가 3" class="guide-img-sm" />
      <img src="/images/step8/8-3a-step63-secrets-4.png" alt="GitHub Secrets 추가 4" class="guide-img-sm" />
      <img src="/images/step8/8-3a-step63-secrets-5.png" alt="GitHub Secrets 추가 5" class="guide-img-sm" />

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

60. `.github/workflows/deploy.yml` 파일을 생성합니다:
    <img src="/images/step8/8-3c-step64-workflow-file.png" alt="워크플로우 파일 생성" class="guide-img-sm" />

> [!NOTE]
> 아래 워크플로우는 기본 구성입니다. 본인 프로젝트에 맞게 수정하세요:
>
> - Health Check URL(`/actuator/health`)이 다르면 본인 경로로 변경
> - `application.properties`를 git에 포함하지 않는 경우, GitHub Secrets에 `APPLICATION_PROPERTIES` 값을 등록하면 빌드 시 자동 생성됩니다 (Step 3 참고)
> - 추가 환경변수가 필요하면 `env` 섹션에 Secrets를 추가하세요

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

      # 3. application.properties 생성 (레포에 없는 경우, Secrets에서 주입)
      - name: Create application.properties
        run: |
          if [ -n "$APP_PROPS" ]; then
            mkdir -p src/main/resources
            echo "$APP_PROPS" > src/main/resources/application.properties
          fi
        env:
          APP_PROPS: ${{ secrets.APPLICATION_PROPERTIES }}

      # 4. Gradle 캐시 (빌드 시간 단축)
      - name: Cache Gradle packages
        uses: actions/cache@v4
        with:
          path: |
            ~/.gradle/caches
            ~/.gradle/wrapper
          key: ${{ runner.os }}-gradle-${{ hashFiles('**/*.gradle*') }}
          restore-keys: ${{ runner.os }}-gradle-

      # 5. Gradle 빌드 (JAR)
      - name: Build with Gradle
        run: |
          chmod +x ./gradlew
          ./gradlew clean bootJar -x test

      # 6. AWS 자격 증명 설정
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ secrets.AWS_REGION }}

      # 7. JAR 파일을 Amazon S3에 업로드
      - name: Upload JAR to S3
        run: |
          JAR_FILE=$(ls build/libs/*.jar | head -1)
          aws s3 cp "$JAR_FILE" s3://${{ secrets.S3_DEPLOY_BUCKET }}/app.jar

      # 8. SSM Run Command로 EC2에서 배포 실행
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

> [!NOTE]
> 워크플로우의 Health Check URL(`/actuator/health`)은 태스크 1에서 Actuator를 사용하지 않기로 한 경우 본인이 설정한 경로(`/health` 등)로 변경하세요.

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

61. 변경사항을 커밋하고 push합니다:

```bash
cd ~/3tier-project/my-backend
git add .
git commit -m "feat: initial backend with CI/CD"
git push origin main
```

<img src="/images/step8/8-3a-step65-push-deploy.png" alt="git push 후 배포 트리거" class="guide-img-sm" />

62. GitHub → `my-backend` 리포지토리 → **Actions** 탭에서 워크플로우 실행을 확인합니다.
    <img src="/images/step8/8-3a-step66-actions-1.png" alt="Actions 탭 확인" class="guide-img-sm" />
    <img src="/images/step8/8-3a-step66-actions-2.png" alt="워크플로우 실행" class="guide-img-sm" />

> [!TIP]
> 첫 빌드는 Gradle 의존성 다운로드로 3 ~ 4분 소요됩니다.  
> 이후 빌드는 캐시 덕분에 1 ~ 2분으로 단축됩니다.

> [!TROUBLESHOOTING]
>
> **`Invalid key=value pair in Authorization header`**
>
> - 원인: GitHub Secrets에 AWS Access Key ID 또는 Secret Access Key가 잘못 입력됨 (공백, 줄바꿈 포함 또는 값 뒤바뀜)
> - 해결: Secrets에서 `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`를 삭제하고 앞뒤 공백 없이 다시 입력
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

> [!TIP]
> **워크플로우 개선 아이디어 (선택):**
>
> - **Health Check 강화**: 배포 후 `curl`을 여러 번 재시도하여 앱 시작 대기 (retry loop)
> - **수동 배포 트리거**: `workflow_dispatch`를 추가하면 Actions 탭에서 수동 실행 가능
> - **롤백 자동화**: 배포 전 현재 JAR을 백업 → 배포 실패 시 `if: failure()` 스텝에서 백업 복원
> - **Slack/Discord 알림**: 배포 성공/실패 시 팀 채널에 알림 전송
>
> 이런 개선은 프로덕션 운영에서 매우 유용합니다. 관심 있다면 GitHub Actions 공식 문서를 참고하세요.

---

## 태스크 7: ALB Health Check 확인 + API 테스트

### 7-1. Target Group Health Check 확인

63. 상단 검색창에 `EC2`를 입력하고 **EC2** 서비스를 선택합니다.

64. 왼쪽 메뉴에서 **Target Groups** → `my-3tier-app-tg`를 클릭합니다.

65. **Targets** 탭에서 Status를 확인합니다.

66. Status가 `healthy`인지 확인합니다.

### 7-2. ALB를 통한 API 테스트

📍 **실행 위치: 로컬 PC (터미널)** — ALB가 Internet-facing이므로 인터넷이 되는 곳이면 어디서든 가능

67. ALB DNS를 통해 API가 정상 응답하는지 테스트합니다 (아래 `<>` 부분을 본인 값으로 수정한 후 실행합니다):

```bash
ALB_DNS="<ALB_DNS_NAME>"

# Actuator Health Check
curl http://$ALB_DNS/actuator/health

# 본인 프로젝트 API 테스트 (예시)
curl http://$ALB_DNS/api/items
curl http://$ALB_DNS/api/boards
```

<img src="/images/step8/8-3a-step71-alb-test-1.png" alt="ALB Health Check 테스트" class="guide-img-sm" />
<img src="/images/step8/8-3a-step71-alb-test-2.png" alt="API 목록 조회 테스트" class="guide-img-sm" />

> [!TIP]
> 본인 프로젝트의 Controller `@RequestMapping` 경로에 맞게 테스트하세요.  
> Spring Security + JWT 프로젝트는 인증 불필요 엔드포인트(GET 목록 조회 등)로 먼저 확인합니다.

> [!NOTE]
> 이 시점에서 브라우저(CloudFront HTTPS)에서 프론트엔드 → 백엔드(ALB HTTP) API 호출은 **Mixed Content**로 차단됩니다.  
> 프론트엔드 ↔ 백엔드 연동은 **Step 8-4 태스크 1**을 완료한 뒤 동작합니다.  
> 현재 단계에서는 `curl`로 API가 정상 응답하는 것을 확인했으면 충분합니다.

✅ **태스크 완료** — ALB Health Check를 확인하고 API 테스트를 완료했습니다.

---

# 🗑️ 리소스 정리

> [!WARNING]
> 이 세션에서 생성한 리소스를 지금 삭제하지 마세요!
> Step 8-4에서 전체 연동을 확인합니다.  
> **Step 8-5에서 전체 정리합니다.**

✅ **실습 종료**: Step 8-4에서 전체 연동을 확인합니다.

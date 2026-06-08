---
title: 'Spring에서 Amazon S3 파일 업로드 구현'
week: 5
session: 2
awsServices:
  - Amazon S3
learningObjectives:
  - Spring 프로젝트에서 AWS SDK v2를 설정할 수 있습니다.
  - MultipartFile을 S3에 업로드하는 서비스를 구현할 수 있습니다.
  - Presigned URL을 생성하여 클라이언트 직접 업로드를 구현할 수 있습니다.
  - S3 객체를 삭제하고 목록을 조회할 수 있습니다.
prerequisites:
  - AWS 계정 생성 완료
  - S3 버킷 생성 완료 (Step 5-1 참조)
  - Spring Boot 또는 Spring MVC 프로젝트 (로컬 또는 EC2)
  - IAM 사용자 또는 EC2 IAM Role (S3 접근 권한)
estimatedCost: 크레딧 내 사용 가능 (비용 매우 저렴)
---

이 실습에서는 Spring 애플리케이션에서 AWS SDK v2를 사용하여 S3에 파일을 업로드, 다운로드, 조회하는 기능을 구현합니다.
EC2 인스턴스에 IAM Role을 연결하여 Access Key 없이 안전하게 S3에 접근하는 방식을 사용하며, Presigned URL을 활용한 클라이언트 직접 업로드 방식도 학습합니다.

**Spring Boot(새 프로젝트)** 또는 **기존 Spring MVC 프로젝트** 모두에서 동일한 AWS SDK를 사용하며, 의존성 추가와 설정 방법만 다릅니다.

> [!NOTE]
> 이 실습은 EC2에서 IAM Role을 통해 S3에 접근하는 **AWS 권장 방식**을 사용합니다.
> Access Key를 코드에 넣지 않으므로 보안상 안전하며, 키 로테이션도 자동으로 처리됩니다.

## 태스크 0: 선행 조건 확인

이 실습을 시작하기 전에 다음 리소스가 준비되어 있어야 합니다.

### 필요한 리소스 체크리스트

| 리소스               | 확인 방법                      | 없는 경우              |
| -------------------- | ------------------------------ | ---------------------- |
| S3 버킷              | S3 콘솔에서 버킷 존재 확인     | Step 5-1 실습 수행     |
| EC2 인스턴스         | EC2 콘솔에서 Running 상태 확인 | Step 2-1 실습 수행     |
| EC2 Security Group   | 인바운드 8080 포트 허용 확인   | Step 1-2 참조하여 추가 |
| Spring Boot 프로젝트 | EC2에 JAR 배포 가능한 프로젝트 | Step 4-1 프로젝트 활용 |

### 상세 확인 단계

1. AWS Management Console에 로그인합니다.
2. 우측 상단에서 리전을 **Asia Pacific (Seoul) ap-northeast-2**로 설정합니다.

    <img src="/images/common/region-check.png" alt="리전 확인" class="guide-img-sm" />

3. 상단 검색창에 `S3`를 입력하고 **S3** 서비스를 선택합니다.
4. 버킷 목록에서 사용할 버킷(예: `my-starter-app-{AccountId}`)이 존재하는지 확인합니다.
5. 상단 검색창에 `EC2`를 입력하고 **EC2** 서비스를 선택합니다.
6. 왼쪽 메뉴에서 **Instances**를 선택합니다.
7. 사용할 EC2 인스턴스가 **Running** 상태인지 확인합니다.
8. 해당 인스턴스를 클릭하여 상세 페이지로 이동합니다.
9. **Security** 탭을 선택합니다.
10. Security Group 링크를 클릭하여 Security Group 상세 페이지로 이동합니다.
11. **Inbound rules** 탭에서 **포트 8080**이 허용되어 있는지 확인합니다.

> [!WARNING]
> EC2 Security Group에 8080 포트가 열려있지 않으면 태스크 7에서 외부 테스트가 불가능합니다.
> 포트가 없는 경우: [[Edit inbound rules]] 클릭 → [[Add rule]] 클릭 →
> Type: `Custom TCP`, Port range: `8080`, Source: `0.0.0.0/0` 입력 → [[Save rules]] 클릭

> [!TIP]
> S3 버킷 이름을 메모해 두세요. 이후 태스크에서 `application.yml` 설정과 IAM 정책에 사용됩니다.
> 버킷 이름 예시: `my-starter-app-123456789012` (Account ID를 포함하여 고유하게 생성)

✅ **태스크 완료**: 선행 조건(S3 버킷, EC2 인스턴스, Security Group)이 모두 확인되었습니다.

---

## 태스크 1: IAM 정책 생성 (S3 접근 권한)

> [!CONCEPT] IAM 정책 (Policy)
> IAM 정책은 AWS 리소스에 대한 접근 권한을 JSON 형식으로 정의한 문서입니다.
>
> - **AWS 관리형 정책**: AWS가 미리 만들어 둔 정책 (예: `AmazonS3FullAccess`)
> - **고객 관리형 정책**: 사용자가 직접 만드는 정책 (특정 버킷만 허용 등)
>
> 프로덕션에서는 **최소 권한 원칙(Least Privilege)**에 따라 필요한 버킷과 작업만 허용하는 커스텀 정책을 사용합니다.
> 이 실습에서는 특정 버킷에 대한 커스텀 정책을 생성합니다.
>
> ```json
> {
>   "Effect": "Allow", // 허용 (Allow) 또는 거부 (Deny)
>   "Action": "s3:PutObject", // 허용할 작업
>   "Resource": "arn:aws:s3:::my-bucket/*" // 대상 리소스
> }
> ```

### 상세 단계

12. 상단 검색창에 `IAM`을 입력하고 **IAM** 서비스를 선택합니다.
13. 왼쪽 메뉴에서 **Policies**를 선택합니다.
14. [[Create policy]] 버튼을 클릭합니다.
15. 상단의 **JSON** 탭을 클릭합니다.
16. 기존 내용을 모두 삭제합니다 (`Ctrl+A` → `Delete`).
17. 다음 JSON을 붙여넣습니다:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowS3BucketAccess",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::my-starter-app-123456789012",
        "arn:aws:s3:::my-starter-app-123456789012/*"
      ]
    }
  ]
}
```

> [!WARNING]
> `Resource`의 버킷 이름을 **본인의 실제 버킷 이름**으로 변경하세요.
> 두 줄 모두 변경해야 합니다:
>
> - 첫 번째 줄 (`arn:aws:s3:::버킷이름`): `ListBucket` 권한에 필요 (버킷 레벨)
> - 두 번째 줄 (`arn:aws:s3:::버킷이름/*`): `PutObject`, `GetObject`, `DeleteObject` 권한에 필요 (객체 레벨)

18. [[Next]] 버튼을 클릭합니다.
19. **Policy name** 필드에 `S3AppBucketPolicy`를 입력합니다.
20. **Description** 필드에 `Spring Boot 앱에서 특정 S3 버킷에 접근하기 위한 정책`을 입력합니다.
21. **Tags** 섹션에서 [[Add new tag]]를 클릭합니다.
22. 다음 태그 3개를 추가합니다:

| Key         | Value        |
| ----------- | ------------ |
| `CreatedBy` | `admin-user` |
| `Step`      | `step5`      |
| `Session`   | `5-2`        |

23. [[Create policy]] 버튼을 클릭합니다.

> [!OUTPUT]
> 정책이 생성되면 정책 상세 페이지로 이동합니다.
> **Policy name**: `S3AppBucketPolicy`
> **Type**: Customer managed
>
> Permissions 탭에서 JSON을 확인하면 입력한 내용이 그대로 표시됩니다.

> [!TIP]
> **왜 `AmazonS3FullAccess` 대신 커스텀 정책을 만드는가?**
>
> `AmazonS3FullAccess`는 계정 내 **모든 S3 버킷**에 대한 **모든 작업**을 허용합니다.
> 만약 EC2가 해킹당하면 모든 버킷의 데이터가 유출/삭제될 수 있습니다.
> 커스텀 정책은 특정 버킷의 특정 작업만 허용하므로 피해 범위를 최소화합니다.

✅ **태스크 완료**: S3 접근용 IAM 커스텀 정책(`S3AppBucketPolicy`)이 생성되었습니다.

---

## 태스크 2: EC2에 IAM Role 연결

> [!CONCEPT] EC2 IAM Role (인스턴스 프로파일)
> EC2에 IAM Role을 연결하면 인스턴스 내부에서 실행되는 애플리케이션이 **Access Key 없이** AWS 서비스에 접근할 수 있습니다.
>
> - SDK가 EC2 메타데이터 서비스(IMDS)에서 **임시 자격 증명**을 자동으로 가져옵니다.
> - 임시 자격 증명은 자동으로 로테이션되므로 키 유출 위험이 없습니다.
> - AWS가 공식적으로 권장하는 EC2 → AWS 서비스 접근 방식입니다.
>
> ```
> [Spring Boot App] → [EC2 메타데이터] → [임시 자격 증명 획득] → [S3 접근]
>                     (169.254.169.254)    (자동 갱신)
> ```

### IAM Role 생성

24. IAM 콘솔 왼쪽 메뉴에서 **Roles**를 선택합니다.
25. [[Create role]] 버튼을 클릭합니다.
26. **Trusted entity type** 섹션에서 `AWS service`를 선택합니다.
27. **Use case** 섹션에서 **Service or use case** 드롭다운이 `EC2`로 선택되어 있는지 확인합니다.
28. 만약 `EC2`가 아니라면 드롭다운을 클릭하여 `EC2`를 선택합니다.
29. [[Next]] 버튼을 클릭합니다.
30. **Add permissions** 페이지의 검색창에 `S3AppBucketPolicy`를 입력합니다.
31. 검색 결과에서 **S3AppBucketPolicy** 왼쪽의 체크박스를 클릭합니다.
32. [[Next]] 버튼을 클릭합니다.
33. **Role name** 필드에 `ec2-s3-access-role`을 입력합니다.
34. **Description** 필드에 `EC2에서 S3 버킷에 접근하기 위한 역할`을 입력합니다.
35. **Tags** 섹션에서 [[Add tag]]를 클릭하여 다음 태그 3개를 추가합니다:

| Key         | Value        |
| ----------- | ------------ |
| `CreatedBy` | `admin-user` |
| `Step`      | `step5`      |
| `Session`   | `5-2`        |

36. [[Create role]] 버튼을 클릭합니다.

> [!OUTPUT]
> "Role ec2-s3-access-role created" 메시지가 표시됩니다.
> Roles 목록에서 `ec2-s3-access-role`을 검색하면 확인할 수 있습니다.

### EC2 인스턴스에 IAM Role 연결

37. 상단 검색창에 `EC2`를 입력하고 **EC2** 서비스를 선택합니다.
38. 왼쪽 메뉴에서 **Instances**를 선택합니다.
39. Spring Boot를 배포할 EC2 인스턴스의 체크박스를 클릭하여 선택합니다.
40. 상단의 **Actions** 버튼을 클릭합니다.
41. 드롭다운에서 **Security**를 선택합니다.
42. **Modify IAM role**을 클릭합니다.
43. **IAM role** 드롭다운을 클릭합니다.
44. 목록에서 `ec2-s3-access-role`을 선택합니다.
45. [[Update IAM role]] 버튼을 클릭합니다.

> [!OUTPUT]
> "Successfully attached ec2-s3-access-role to instance i-xxxxxxxx" 메시지가 표시됩니다.
> 인스턴스 상세 → **Security** 탭에서 **IAM Role**이 `ec2-s3-access-role`로 표시됩니다.

> [!TIP]
> IAM Role 연결은 인스턴스를 재시작하지 않아도 즉시 적용됩니다.
> 연결 후 EC2 내부에서 바로 AWS CLI나 SDK를 통해 S3에 접근할 수 있습니다.

### EC2에서 IAM Role 동작 확인

46. 터미널(또는 PuTTY)을 열고 EC2에 SSH로 접속합니다:

```bash
ssh -i my-key.pem ec2-user@{EC2-Public-IP}
```

> [!TIP]
> `{EC2-Public-IP}`는 EC2 콘솔 → 인스턴스 선택 → **Details** 탭 → **Public IPv4 address**에서 확인합니다.
> `my-key.pem`은 인스턴스 생성 시 다운로드한 키 페어 파일입니다.

47. 다음 명령어를 입력하여 IAM Role이 정상 연결되었는지 확인합니다:

```bash
aws sts get-caller-identity
```

> [!OUTPUT]
>
> ```json
> {
>   "UserId": "AROA...:i-0abc123def456",
>   "Account": "123456789012",
>   "Arn": "arn:aws:sts::123456789012:assumed-role/ec2-s3-access-role/i-0abc123def456"
> }
> ```
>
> `Arn`에 `ec2-s3-access-role`이 포함되어 있으면 정상입니다.

48. S3 버킷 접근을 테스트합니다:

```bash
aws s3 ls s3://my-starter-app-123456789012/
```

> [!OUTPUT]
> 버킷이 비어있으면 아무것도 출력되지 않습니다 (에러 없이 빈 결과).
> 파일이 있으면 파일 목록이 표시됩니다.
> `AccessDenied` 에러가 발생하면 IAM 정책의 버킷 이름을 확인하세요.

> [!WARNING]
> `Unable to locate credentials` 에러가 발생하면 IAM Role이 제대로 연결되지 않은 것입니다.
> EC2 콘솔에서 인스턴스의 **Security** 탭 → IAM Role을 다시 확인하세요.
> Role을 연결한 직후라면 1~2분 기다린 후 다시 시도하세요.

✅ **태스크 완료**: IAM Role(`ec2-s3-access-role`)을 생성하고 EC2 인스턴스에 연결했습니다.

---

## 태스크 3: Spring Boot 프로젝트에 AWS SDK 의존성 추가

본인 프로젝트에 맞는 방법을 선택합니다.

---

### 방법 A: Spring Boot 프로젝트

> [!CONCEPT] AWS SDK v2 BOM (Bill of Materials)
> BOM을 사용하면 AWS SDK 모듈들의 버전을 일일이 지정하지 않아도 됩니다.
> `bom:2.25.60`을 선언하면 `s3`, `sts`, `s3-presigner` 등 모든 모듈이 동일한 호환 버전으로 자동 설정됩니다.
>
> ```groovy
> // BOM 없이 (버전 충돌 위험)
> implementation 'software.amazon.awssdk:s3:2.25.60'
> implementation 'software.amazon.awssdk:s3-presigner:2.25.58'  // 버전 불일치!
>
> // BOM 사용 (버전 자동 관리)
> implementation 'software.amazon.awssdk:s3'           // 버전 생략 가능
> implementation 'software.amazon.awssdk:s3-presigner' // BOM이 관리
> ```

### build.gradle 수정 (Gradle 프로젝트)

49. 로컬 개발 환경에서 Spring Boot 프로젝트의 `build.gradle` 파일을 엽니다.
50. `dependencyManagement` 블록을 찾습니다 (없으면 `dependencies` 블록 위에 새로 추가합니다).
51. `dependencyManagement` 블록 안에 AWS SDK BOM을 추가합니다:

```groovy
dependencyManagement {
    imports {
        mavenBom "software.amazon.awssdk:bom:2.25.60"
    }
}
```

52. `dependencies` 블록에 다음 의존성을 추가합니다:

```groovy
dependencies {
    // AWS SDK v2 - S3
    implementation 'software.amazon.awssdk:s3'
    // AWS SDK v2 - S3 Presigner (Presigned URL 생성용)
    implementation 'software.amazon.awssdk:s3-presigner'

    // Spring Boot Web (파일 업로드 API)
    implementation 'org.springframework.boot:spring-boot-starter-web'

    // Lombok (선택)
    compileOnly 'org.projectlombok:lombok'
    annotationProcessor 'org.projectlombok:lombok'
}
```

53. 파일을 저장합니다 (`Ctrl+S`).
54. IntelliJ IDEA 우측의 **Gradle** 패널을 엽니다.
55. 🔄 **Reload All Gradle Projects** 버튼을 클릭하여 의존성을 다운로드합니다.

> [!NOTE]
> Maven 프로젝트를 사용하는 경우 `pom.xml`에 다음을 추가합니다:
>
> ```xml
> <dependencyManagement>
>     <dependencies>
>         <dependency>
>             <groupId>software.amazon.awssdk</groupId>
>             <artifactId>bom</artifactId>
>             <version>2.25.60</version>
>             <type>pom</type>
>             <scope>import</scope>
>         </dependency>
>     </dependencies>
> </dependencyManagement>
>
> <dependencies>
>     <dependency>
>         <groupId>software.amazon.awssdk</groupId>
>         <artifactId>s3</artifactId>
>     </dependency>
>     <dependency>
>         <groupId>software.amazon.awssdk</groupId>
>         <artifactId>s3-presigner</artifactId>
>     </dependency>
> </dependencies>
> ```

### application.yml 설정

56. `src/main/resources/application.yml` 파일을 엽니다.
57. 파일 하단에 다음 설정을 추가합니다:

```yaml
cloud:
  aws:
    region: ap-northeast-2
    s3:
      bucket: my-starter-app-123456789012
```

> [!WARNING]
> `bucket` 값을 **본인의 실제 S3 버킷 이름**으로 변경하세요.
> 버킷 이름이 틀리면 런타임에 `NoSuchBucket` 에러가 발생합니다.

58. 같은 파일에 파일 업로드 크기 제한 설정을 추가합니다:

```yaml
spring:
  servlet:
    multipart:
      max-file-size: 10MB
      max-request-size: 10MB
```

> [!TIP]
> Spring Boot의 기본 파일 업로드 제한은 1MB입니다. 이 설정 없이 1MB 이상의 파일을 업로드하면
> `MaxUploadSizeExceededException`이 발생합니다.

> [!NOTE]
> EC2에서 IAM Role을 사용하므로 `access-key`, `secret-key` 설정이 **필요 없습니다**.
> SDK가 자동으로 EC2 메타데이터에서 임시 자격 증명을 가져옵니다.
> 로컬 개발 시에는 `~/.aws/credentials` 파일이나 환경 변수를 사용합니다.

59. 파일을 저장합니다 (`Ctrl+S`).

방법 A를 완료했다면 **S3Config 클래스 작성**으로 이동하세요.

---

### 방법 B: 기존 Spring MVC 프로젝트 (Boot가 아닌 경우)

기존 Spring MVC 프로젝트(WAR 패키징, XML/Java Config)에서 AWS SDK를 사용하는 방법입니다.

**build.gradle에 의존성 추가:**

```groovy
dependencies {
    // 기존 의존성들...

    // AWS SDK v2 - S3
    implementation platform('software.amazon.awssdk:bom:2.25.60')
    implementation 'software.amazon.awssdk:s3'
    implementation 'software.amazon.awssdk:s3-presigner'
}
```

> [!NOTE]
> Spring Boot가 아닌 프로젝트에서는 `dependencyManagement` 블록 대신 `platform()`을 사용하여 BOM을 가져옵니다.
> 동작은 동일합니다 — AWS SDK 모듈의 버전을 BOM이 관리합니다.

**application.properties에 S3 설정 추가:**

```properties
# application.properties에 추가
cloud.aws.region=ap-northeast-2
cloud.aws.s3.bucket=my-starter-app-123456789012
```

> [!WARNING]
> `bucket` 값을 **본인의 실제 S3 버킷 이름**으로 변경하세요.

**파일 업로드 크기 제한:**

기존 MVC 프로젝트에서는 `WebConfig.java`의 `MultipartConfigElement`에서 이미 파일 크기를 설정하고 있습니다.
현재 10MB로 설정되어 있으므로 추가 변경이 필요 없습니다.

---

### S3Config 클래스 작성 (공통)

60. IntelliJ에서 `src/main/java/com/example/demo/config/` 디렉토리를 우클릭합니다.
61. **New** → **Java Class**를 선택합니다.
62. 클래스 이름에 `S3Config`를 입력하고 `Enter`를 누릅니다.
63. 생성된 파일의 내용을 모두 삭제하고 다음 코드를 붙여넣습니다:

```java
package com.example.demo.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

@Configuration
public class S3Config {

    @Value("${cloud.aws.region}")
    private String region;

    @Bean
    public S3Client s3Client() {
        return S3Client.builder()
                .region(Region.of(region))
                .build();
    }

    @Bean
    public S3Presigner s3Presigner() {
        return S3Presigner.builder()
                .region(Region.of(region))
                .build();
    }
}
```

> [!NOTE]
> **기존 MVC 프로젝트에서의 패키지 위치:**
>
> - Boot 프로젝트: `com.example.demo.config.S3Config`
> - 기존 MVC 프로젝트: `org.scoula.config.S3Config` (또는 본인 프로젝트의 config 패키지)
>
> 기존 MVC 프로젝트에서 `@Value`가 동작하려면 `RootConfig`나 `ServletConfig`에서 **PropertyPlaceholder**가 설정되어 있어야 합니다:
>
> ```java
> // RootConfig.java에 추가 (이미 있을 수 있음)
> @PropertySource("classpath:application.properties")
> ```
>
> 또는 S3Config에서 직접 값을 하드코딩하고 나중에 환경변수로 전환할 수 있습니다:
>
> ```java
> @Bean
> public S3Client s3Client() {
>     return S3Client.builder()
>             .region(Region.AP_NORTHEAST_2)
>             .build();
> }
> ```

64. 파일을 저장합니다 (`Ctrl+S`).

> [!CONCEPT] AWS SDK의 자격 증명 체인 (Default Credential Provider Chain)
> `credentialsProvider`를 명시하지 않으면 SDK는 다음 순서로 자격 증명을 탐색합니다:
>
> 1. 환경 변수 (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`)
> 2. Java 시스템 속성 (`aws.accessKeyId`, `aws.secretAccessKey`)
> 3. `~/.aws/credentials` 파일 (AWS CLI 설정)
> 4. **EC2 Instance Metadata (IAM Role)** ← EC2에서는 여기서 자동 획득
> 5. ECS Container Credentials
>
> 이 방식을 사용하면 **코드 변경 없이** 로컬(환경 변수)과 EC2(IAM Role) 모두에서 동작합니다.

> [!TIP]
> **로컬 개발 환경에서 테스트하려면:**
>
> AWS CLI를 설치하고 `aws configure`로 자격 증명을 설정하세요:
>
> ```bash
> aws configure
> # AWS Access Key ID: (IAM 사용자의 Access Key)
> # AWS Secret Access Key: (IAM 사용자의 Secret Key)
> # Default region name: ap-northeast-2
> # Default output format: json
> ```
>
> 이렇게 하면 `~/.aws/credentials` 파일이 생성되어 SDK가 자동으로 읽습니다.

✅ **태스크 완료**: AWS SDK v2 의존성과 S3Client Bean 설정이 완료되었습니다.

---

## 태스크 4: S3 파일 업로드 서비스 구현

> [!CONCEPT] MultipartFile 업로드 흐름
> Spring Boot에서 파일 업로드는 다음 흐름으로 동작합니다:
>
> ```
> [클라이언트] --multipart/form-data--> [Controller] --MultipartFile--> [S3Service] --PutObject--> [S3]
> ```
>
> - `MultipartFile`: Spring이 HTTP 요청의 파일 데이터를 추상화한 인터페이스
> - `PutObjectRequest`: S3에 객체를 저장하기 위한 요청 객체
> - `RequestBody.fromInputStream()`: 파일 스트림을 S3로 전송

### S3Service 클래스 작성

65. `src/main/java/com/example/demo/service/` 디렉토리를 우클릭합니다.
66. **New** → **Java Class**를 선택합니다.
67. 클래스 이름에 `S3Service`를 입력하고 `Enter`를 누릅니다.
68. 생성된 파일의 내용을 모두 삭제하고 다음 코드를 붙여넣습니다:

```java
package com.example.demo.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.*;

import java.io.IOException;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class S3Service {

    private final S3Client s3Client;

    @Value("${cloud.aws.s3.bucket}")
    private String bucket;

    @Value("${cloud.aws.region}")
    private String region;

    /**
     * MultipartFile을 S3에 업로드합니다.
     *
     * @param file      업로드할 파일
     * @param directory S3 내 저장 경로 (예: "images/profile")
     * @return 업로드된 객체의 키 (S3 경로)
     */
    public String upload(MultipartFile file, String directory) {
        String originalFilename = file.getOriginalFilename();
        String extension = extractExtension(originalFilename);
        String key = directory + "/" + UUID.randomUUID() + extension;

        try {
            PutObjectRequest request = PutObjectRequest.builder()
                    .bucket(bucket)
                    .key(key)
                    .contentType(file.getContentType())
                    .contentLength(file.getSize())
                    .build();

            s3Client.putObject(request,
                    RequestBody.fromInputStream(
                        file.getInputStream(), file.getSize()));

            log.info("파일 업로드 성공: {}", key);
            return key;

        } catch (IOException e) {
            throw new RuntimeException(
                "파일 업로드 실패: " + originalFilename, e);
        }
    }

    /**
     * 특정 경로(prefix)의 객체 목록을 조회합니다.
     */
    public List<String> listFiles(String prefix) {
        ListObjectsV2Request request = ListObjectsV2Request.builder()
                .bucket(bucket)
                .prefix(prefix)
                .build();

        ListObjectsV2Response response = s3Client.listObjectsV2(request);

        return response.contents().stream()
                .map(S3Object::key)
                .collect(Collectors.toList());
    }

    /**
     * S3에서 객체를 다운로드합니다.
     */
    public ResponseInputStream<GetObjectResponse> download(String key) {
        GetObjectRequest request = GetObjectRequest.builder()
                .bucket(bucket)
                .key(key)
                .build();

        return s3Client.getObject(request);
    }

    /**
     * S3에서 객체를 삭제합니다.
     */
    public void delete(String key) {
        DeleteObjectRequest request = DeleteObjectRequest.builder()
                .bucket(bucket)
                .key(key)
                .build();

        s3Client.deleteObject(request);
        log.info("파일 삭제 성공: {}", key);
    }

    /**
     * 업로드된 파일의 전체 URL을 반환합니다.
     */
    public String getFileUrl(String key) {
        return String.format(
            "https://%s.s3.%s.amazonaws.com/%s",
            bucket, region, key);
    }

    private String extractExtension(String filename) {
        if (filename == null || !filename.contains(".")) {
            return "";
        }
        return filename.substring(filename.lastIndexOf("."));
    }
}
```

69. 파일을 저장합니다 (`Ctrl+S`).

> [!CONCEPT] UUID 파일명을 사용하는 이유
> 원본 파일명 대신 UUID를 사용하는 이유:
>
> - **파일명 충돌 방지**: 여러 사용자가 `photo.png`를 업로드해도 겹치지 않습니다.
> - **보안**: 원본 파일명에 포함된 개인정보나 경로 정보를 노출하지 않습니다.
> - **URL 안전**: 한글, 공백, 특수문자로 인한 인코딩 문제를 방지합니다.
>
> 원본 파일명은 DB에 별도 저장하고, S3 키는 UUID 기반으로 관리하는 것이 일반적입니다.

> [!NOTE]
> `listObjectsV2`는 기본적으로 최대 1,000개의 객체를 반환합니다.
> 더 많은 객체가 있는 경우 `response.isTruncated()`를 확인하고
> `continuationToken`을 사용하여 페이징 처리합니다.

✅ **태스크 완료**: S3 파일 업로드/다운로드/목록/삭제 서비스가 구현되었습니다.

---

## 태스크 5: S3 파일 업로드 컨트롤러 구현

### S3Controller 작성

70. `src/main/java/com/example/demo/controller/` 디렉토리를 우클릭합니다.
71. **New** → **Java Class**를 선택합니다.
72. 클래스 이름에 `S3Controller`를 입력하고 `Enter`를 누릅니다.
73. 생성된 파일의 내용을 모두 삭제하고 다음 코드를 붙여넣습니다:

```java
package com.example.demo.controller;

import com.example.demo.service.S3Service;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/files")
@RequiredArgsConstructor
public class S3Controller {

    private final S3Service s3Service;

    /**
     * 파일 업로드 (서버 경유)
     * POST /api/files/upload?directory=images/profile
     */
    @PostMapping("/upload")
    public ResponseEntity<Map<String, String>> upload(
            @RequestParam("file") MultipartFile file,
            @RequestParam(defaultValue = "uploads") String directory) {

        String key = s3Service.upload(file, directory);
        String url = s3Service.getFileUrl(key);

        return ResponseEntity.ok(Map.of(
                "key", key,
                "url", url
        ));
    }

    /**
     * 파일 목록 조회
     * GET /api/files?prefix=images/profile/
     */
    @GetMapping
    public ResponseEntity<List<String>> list(
            @RequestParam(defaultValue = "") String prefix) {
        List<String> files = s3Service.listFiles(prefix);
        return ResponseEntity.ok(files);
    }

    /**
     * 파일 다운로드
     * GET /api/files/download?key=images/profile/uuid.png
     */
    @GetMapping("/download")
    public ResponseEntity<InputStreamResource> download(
            @RequestParam String key) {
        ResponseInputStream<GetObjectResponse> s3Object =
            s3Service.download(key);
        GetObjectResponse metadata = s3Object.response();

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(
                    metadata.contentType()))
                .contentLength(metadata.contentLength())
                .header(HttpHeaders.CONTENT_DISPOSITION,
                    "attachment; filename=\"" +
                    key.substring(key.lastIndexOf("/") + 1) + "\"")
                .body(new InputStreamResource(s3Object));
    }

    /**
     * 파일 삭제
     * DELETE /api/files?key=images/profile/uuid.png
     */
    @DeleteMapping
    public ResponseEntity<Void> delete(@RequestParam String key) {
        s3Service.delete(key);
        return ResponseEntity.noContent().build();
    }
}
```

74. 파일을 저장합니다 (`Ctrl+S`).

> [!TIP]
> `@RequestParam(defaultValue = "uploads")`를 사용하면 `directory` 파라미터를 생략해도
> 기본값 `uploads`가 적용됩니다. 테스트 시 편리합니다.

> [!TIP]
> 다운로드 API에서 `Content-Disposition: attachment`를 설정하면 브라우저가 파일을 다운로드합니다.
> `inline`으로 변경하면 브라우저에서 직접 표시합니다 (이미지, PDF 등).

✅ **태스크 완료**: 파일 업로드, 목록 조회, 다운로드, 삭제 API 엔드포인트가 구현되었습니다.

---

## 태스크 6: Presigned URL 생성 API 구현

> [!CONCEPT] Presigned URL이란?
> Presigned URL은 **임시 서명이 포함된 S3 접근 URL**입니다.
> 이 URL을 가진 사람은 누구나 지정된 시간 동안 S3 객체에 접근할 수 있습니다.
>
> **서버 경유 업로드 vs Presigned URL 업로드:**
>
> ```
> [서버 경유 방식]
> 클라이언트 → 서버(Spring Boot) → S3
> - 서버가 파일 데이터를 중계 → 서버 메모리/대역폭 소모
> - 대용량 파일 시 서버 부하 증가
>
> [Presigned URL 방식]
> 클라이언트 → 서버(URL 요청만) → 클라이언트 → S3(직접 업로드)
> - 서버는 URL만 발급 → 서버 부하 최소
> - 대용량 파일도 클라이언트가 직접 S3로 전송
> ```
>
> | 비교 항목   | 서버 경유                 | Presigned URL       |
> | ----------- | ------------------------- | ------------------- |
> | 서버 부하   | 높음 (파일 중계)          | 낮음 (URL만 발급)   |
> | 대용량 파일 | 서버 메모리 부족 위험     | 문제 없음           |
> | 구현 복잡도 | 단순                      | 약간 복잡           |
> | 적합한 경우 | 소용량, 서버 가공 필요 시 | 대용량, 직접 업로드 |

### PresignedUrlService 클래스 작성

75. `src/main/java/com/example/demo/service/` 디렉토리를 우클릭합니다.
76. **New** → **Java Class**를 선택합니다.
77. 클래스 이름에 `PresignedUrlService`를 입력하고 `Enter`를 누릅니다.
78. 생성된 파일의 내용을 모두 삭제하고 다음 코드를 붙여넣습니다:

```java
package com.example.demo.service;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;

import java.time.Duration;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PresignedUrlService {

    private final S3Presigner s3Presigner;

    @Value("${cloud.aws.s3.bucket}")
    private String bucket;

    /**
     * 업로드용 Presigned URL을 생성합니다 (10분 유효).
     *
     * @param directory   저장 경로
     * @param filename    원본 파일명
     * @param contentType MIME 타입 (예: "image/png")
     * @return Presigned URL 문자열
     */
    public String generateUploadUrl(String directory,
                                     String filename,
                                     String contentType) {
        String key = directory + "/" + UUID.randomUUID() + "_" + filename;

        PutObjectRequest objectRequest = PutObjectRequest.builder()
                .bucket(bucket)
                .key(key)
                .contentType(contentType)
                .build();

        PutObjectPresignRequest presignRequest =
            PutObjectPresignRequest.builder()
                .signatureDuration(Duration.ofMinutes(10))
                .putObjectRequest(objectRequest)
                .build();

        return s3Presigner.presignPutObject(presignRequest)
                .url().toString();
    }

    /**
     * 다운로드용 Presigned URL을 생성합니다 (30분 유효).
     *
     * @param key 다운로드할 객체의 키
     * @return Presigned URL 문자열
     */
    public String generateDownloadUrl(String key) {
        GetObjectRequest objectRequest = GetObjectRequest.builder()
                .bucket(bucket)
                .key(key)
                .build();

        GetObjectPresignRequest presignRequest =
            GetObjectPresignRequest.builder()
                .signatureDuration(Duration.ofMinutes(30))
                .getObjectRequest(objectRequest)
                .build();

        return s3Presigner.presignGetObject(presignRequest)
                .url().toString();
    }
}
```

79. 파일을 저장합니다 (`Ctrl+S`).

> [!TIP]
> Presigned URL의 만료 시간은 용도에 따라 조절합니다:
>
> - **업로드용**: 5~15분 (사용자가 파일을 선택하고 업로드할 시간)
> - **다운로드용**: 30분~1시간 (링크 공유 시)
> - **최대**: 7일까지 설정 가능하지만, 짧을수록 보안에 유리합니다.

### S3Controller에 Presigned URL 엔드포인트 추가

80. `S3Controller.java` 파일을 엽니다.
81. 클래스 상단의 필드 선언부에 `PresignedUrlService` 주입을 추가합니다:

```java
private final PresignedUrlService presignedUrlService;
```

> [!NOTE]
> `@RequiredArgsConstructor`를 사용하고 있으므로 `final` 필드를 추가하면 자동으로 생성자 주입됩니다.
> 별도의 `@Autowired`나 생성자 수정이 필요 없습니다.

82. 클래스 하단에 다음 두 개의 엔드포인트를 추가합니다:

```java
/**
 * 업로드용 Presigned URL 발급
 * POST /api/files/presigned-upload
 * Body: { "directory": "images", "filename": "photo.png",
 *         "contentType": "image/png" }
 */
@PostMapping("/presigned-upload")
public ResponseEntity<Map<String, String>> getPresignedUploadUrl(
        @RequestBody Map<String, String> request) {

    String url = presignedUrlService.generateUploadUrl(
            request.get("directory"),
            request.get("filename"),
            request.get("contentType"));

    return ResponseEntity.ok(Map.of("uploadUrl", url));
}

/**
 * 다운로드용 Presigned URL 발급
 * GET /api/files/presigned-download?key=images/uuid_photo.png
 */
@GetMapping("/presigned-download")
public ResponseEntity<Map<String, String>> getPresignedDownloadUrl(
        @RequestParam String key) {

    String url = presignedUrlService.generateDownloadUrl(key);

    return ResponseEntity.ok(Map.of("downloadUrl", url));
}
```

83. 파일을 저장합니다 (`Ctrl+S`).

> [!WARNING]
> Presigned URL로 업로드할 때 클라이언트는 **PUT** 메서드를 사용해야 합니다.
> Content-Type도 URL 생성 시 지정한 것과 **정확히 동일하게** 보내야 합니다.
> 불일치하면 `SignatureDoesNotMatch` 에러가 발생합니다.

✅ **태스크 완료**: Presigned URL 생성 API(업로드용/다운로드용)가 구현되었습니다.

---

## 태스크 7: 빌드 및 EC2 배포

### 로컬에서 빌드

84. 터미널(또는 IntelliJ Terminal)을 엽니다.
85. 프로젝트 루트 디렉토리로 이동합니다.
86. 다음 명령어를 입력하여 빌드합니다:

**방법 A (Boot — JAR 빌드):**

```bash
./gradlew clean build -x test
```

> 빌드된 JAR 파일 위치: `build/libs/demo-0.0.1-SNAPSHOT.jar`

**방법 B (MVC — WAR 빌드):**

```bash
chmod +x gradlew
./gradlew build -x test
```

> 빌드된 WAR 파일 위치: `build/libs/backend-1.0-SNAPSHOT.war`

> [!OUTPUT]
>
> ```
> BUILD SUCCESSFUL in 12s
> 7 actionable tasks: 7 executed
> ```
>
> 빌드된 JAR 파일 위치: `build/libs/demo-0.0.1-SNAPSHOT.jar`

> [!TIP]
> `-x test`는 테스트를 건너뛰는 옵션입니다. 로컬에 AWS 자격 증명이 없으면
> S3 관련 테스트가 실패할 수 있으므로 배포 시에는 테스트를 건너뜁니다.

87. 빌드된 JAR 파일이 존재하는지 확인합니다:

```bash
ls -la build/libs/demo-0.0.1-SNAPSHOT.jar
```

### EC2로 JAR 파일 전송

88. 새 터미널을 열고 다음 명령어로 빌드 결과물을 EC2에 전송합니다:

**방법 A (Boot):**

```bash
scp -i my-key.pem \
  build/libs/demo-0.0.1-SNAPSHOT.jar \
  ec2-user@{EC2-Public-IP}:~/app.jar
```

**방법 B (MVC):**

```bash
scp -i my-key.pem \
  build/libs/backend-1.0-SNAPSHOT.war \
  ec2-user@{EC2-Public-IP}:~/app.war
```

> [!TIP]
> `{EC2-Public-IP}`를 실제 EC2의 Public IP 주소로 변경하세요.
> EC2 콘솔 → 인스턴스 선택 → **Details** 탭 → **Public IPv4 address**에서 확인할 수 있습니다.

> [!WARNING]
> `Permission denied (publickey)` 에러가 발생하면:
>
> - `.pem` 파일 경로가 정확한지 확인하세요.
> - `.pem` 파일 권한이 `400`인지 확인하세요: `chmod 400 my-key.pem`
> - EC2 사용자명이 맞는지 확인하세요 (Amazon Linux: `ec2-user`, Ubuntu: `ubuntu`).

### EC2에서 애플리케이션 실행

89. EC2에 SSH로 접속합니다:

```bash
ssh -i my-key.pem ec2-user@{EC2-Public-IP}
```

90. 기존에 실행 중인 Java 프로세스가 있는지 확인합니다:

```bash
ps aux | grep 'java -jar'
```

91. 실행 중인 프로세스가 있으면 종료합니다:

```bash
pkill -f 'java -jar' || true
```

**방법 A (Boot — JAR 직접 실행):**

92. 새 JAR 파일을 백그라운드로 실행합니다:

```bash
nohup java -jar ~/app.jar \
  --server.port=8080 \
  > ~/app.log 2>&1 &
```

**방법 B (MVC — Tomcat에 WAR 배포):**

92. Tomcat에 WAR를 배포합니다:

```bash
# Tomcat 중지
sudo systemctl stop tomcat

# 기존 배포 제거 및 새 WAR 배포
rm -rf /opt/tomcat/webapps/ROOT
cp ~/app.war /opt/tomcat/webapps/ROOT.war

# Tomcat 시작
sudo systemctl start tomcat
```

93. 애플리케이션이 정상 시작되었는지 로그를 확인합니다:

```bash
tail -f ~/app.log
```

> [!OUTPUT]
>
> ```
> Started DemoApplication in 5.234 seconds (process running for 5.891)
> ```
>
> 이 메시지가 보이면 정상 시작된 것입니다. `Ctrl+C`로 로그 확인을 종료합니다.

> [!WARNING]
> `Port 8080 already in use` 에러가 발생하면:
>
> ```bash
> lsof -i :8080          # 포트를 사용 중인 프로세스 확인
> kill -9 {PID}          # 해당 프로세스 강제 종료
> ```
>
> 이후 92번 단계부터 다시 실행합니다.

> [!WARNING]
> `Error creating bean with name 's3Client'` 에러가 발생하면:
> IAM Role이 EC2에 연결되지 않았거나, `application.yml`의 region 설정이 잘못된 것입니다.
> 태스크 2의 IAM Role 연결 단계를 다시 확인하세요.

✅ **태스크 완료**: Spring Boot 앱이 EC2에 배포되어 실행 중입니다.

---

## 태스크 8: API 테스트

### EC2 내부에서 테스트

94. EC2에 SSH로 접속된 상태에서 테스트 파일을 생성합니다:

```bash
echo "Hello S3!" > /tmp/test.txt
```

95. 파일 업로드 API를 테스트합니다:

```bash
curl -X POST http://localhost:8080/api/files/upload \
  -F "file=@/tmp/test.txt" \
  -F "directory=test"
```

> [!OUTPUT]
>
> ```json
> {
>   "key": "test/550e8400-e29b-41d4-a716-446655440000.txt",
>   "url": "https://my-starter-app-123456789012.s3.ap-northeast-2.amazonaws.com/test/550e8400-e29b-41d4-a716-446655440000.txt"
> }
> ```
>
> `key`와 `url`이 반환되면 업로드 성공입니다. `key` 값을 메모해 두세요.

96. 파일 목록 조회 API를 테스트합니다:

```bash
curl http://localhost:8080/api/files?prefix=test/
```

> [!OUTPUT]
>
> ```json
> ["test/550e8400-e29b-41d4-a716-446655440000.txt"]
> ```

97. Presigned Upload URL 발급을 테스트합니다:

```bash
curl -X POST http://localhost:8080/api/files/presigned-upload \
  -H "Content-Type: application/json" \
  -d '{"directory":"test","filename":"hello.txt","contentType":"text/plain"}'
```

> [!OUTPUT]
>
> ```json
> {
>   "uploadUrl": "https://my-starter-app-123456789012.s3.ap-northeast-2.amazonaws.com/test/..."
> }
> ```
>
> 긴 URL이 반환됩니다. 이 URL에는 서명 정보가 포함되어 있습니다.

98. Presigned URL로 직접 업로드를 테스트합니다:

```bash
curl -X PUT "{위에서 받은 uploadUrl}" \
  -H "Content-Type: text/plain" \
  --data-binary @/tmp/test.txt
```

> [!OUTPUT]
> HTTP 200 응답 (빈 본문). S3 콘솔에서 파일이 업로드된 것을 확인할 수 있습니다.

> [!WARNING]
> Presigned URL을 curl에 넣을 때 반드시 **큰따옴표(`"`)**로 감싸세요.
> URL에 `&` 문자가 포함되어 있어 따옴표 없이 실행하면 명령어가 잘립니다.

99. Presigned Download URL 발급을 테스트합니다 (95번에서 메모한 key 사용):

```bash
curl "http://localhost:8080/api/files/presigned-download?key=test/550e8400-e29b-41d4-a716-446655440000.txt"
```

> [!OUTPUT]
>
> ```json
> {
>   "downloadUrl": "https://my-starter-app-123456789012.s3.ap-northeast-2.amazonaws.com/test/..."
> }
> ```

100. 파일 삭제 API를 테스트합니다:

```bash
curl -X DELETE "http://localhost:8080/api/files?key=test/550e8400-e29b-41d4-a716-446655440000.txt"
```

> [!OUTPUT]
> HTTP 204 No Content 응답 (빈 본문). 파일이 S3에서 삭제되었습니다.

101. 삭제 확인을 위해 목록을 다시 조회합니다:

```bash
curl http://localhost:8080/api/files?prefix=test/
```

> [!OUTPUT]
>
> ```json
> []
> ```
>
> 빈 배열이 반환되면 삭제가 정상적으로 완료된 것입니다.

### 외부에서 테스트 (로컬 PC에서)

102. 로컬 PC의 터미널을 엽니다.
103. EC2의 Public IP로 파일 업로드를 테스트합니다:

```bash
curl -X POST http://{EC2-Public-IP}:8080/api/files/upload \
  -F "file=@./test-image.png" \
  -F "directory=images"
```

> [!TIP]
> 테스트할 이미지 파일이 없으면 아무 텍스트 파일로 대체해도 됩니다:
>
> ```bash
> echo "external test" > test.txt
> curl -X POST http://{EC2-Public-IP}:8080/api/files/upload \
>   -F "file=@./test.txt" \
>   -F "directory=test"
> ```

> [!WARNING]
> 외부 접근이 안 되면 Security Group의 인바운드 규칙에 포트 8080이 열려있는지 확인하세요.
> EC2 콘솔 → 인스턴스 → Security 탭 → Security Group → Inbound rules

### S3 콘솔에서 업로드 확인

104. AWS Management Console에서 상단 검색창에 `S3`를 입력하고 **S3** 서비스를 선택합니다.
105. 버킷 목록에서 사용한 버킷을 클릭합니다.
106. `test/` 폴더를 클릭하여 업로드된 파일이 존재하는지 확인합니다.
107. 파일을 클릭하면 **Object overview**에서 크기, Content-Type, 업로드 시간 등을 확인할 수 있습니다.

> [!OUTPUT]
> S3 콘솔에서 `test/` 경로 아래에 UUID 이름의 파일이 표시됩니다.
> 파일 크기와 Content-Type이 업로드한 파일과 일치하면 정상입니다.

### TROUBLESHOOTING

| 증상                             | 원인                                | 해결 방법                                       |
| -------------------------------- | ----------------------------------- | ----------------------------------------------- |
| `NoSuchBucket`                   | application.yml의 버킷 이름 오류    | 실제 버킷 이름으로 수정 후 재빌드·재배포        |
| `AccessDenied`                   | IAM 정책의 Resource ARN 불일치      | IAM 정책의 버킷 이름 확인 후 수정               |
| `Unable to locate credentials`   | IAM Role 미연결                     | EC2에 IAM Role 연결 확인 (태스크 2)             |
| `Connection refused`             | 앱 미실행 또는 포트 불일치          | `tail ~/app.log`로 상태 확인                    |
| `SignatureDoesNotMatch`          | Presigned URL의 Content-Type 불일치 | URL 생성 시와 동일한 Content-Type 사용          |
| `MaxUploadSizeExceededException` | 파일 크기 초과 (기본 1MB)           | application.yml에 max-file-size: 10MB 설정      |
| 외부 접근 불가                   | Security Group 8080 미허용          | 인바운드 규칙에 Custom TCP 8080 추가            |
| `Port 8080 already in use`       | 기존 프로세스가 포트 점유           | `lsof -i :8080`으로 PID 확인 후 `kill -9 {PID}` |
| `NoSuchKey`                      | 존재하지 않는 키로 다운로드 시도    | `GET /api/files?prefix=`로 실제 키 목록 확인    |

✅ **태스크 완료**: 모든 API(업로드, 목록, 다운로드, Presigned URL, 삭제)를 EC2 내부 및 외부에서 테스트했습니다.

---

## 마무리

다음을 성공적으로 수행했습니다:

- S3 접근용 IAM 커스텀 정책을 생성하고 최소 권한 원칙을 적용했습니다.
- EC2에 IAM Role을 연결하여 Access Key 없이 S3에 접근하는 방식을 구현했습니다.
- Spring 프로젝트(Boot 또는 MVC)에 AWS SDK v2를 설정하고 S3Client Bean을 구성했습니다.
- MultipartFile을 S3에 업로드하는 API를 구현했습니다.
- S3 객체 목록 조회, 다운로드, 삭제 API를 구현했습니다.
- Presigned URL을 활용한 클라이언트 직접 업로드/다운로드 방식을 구현했습니다.
- EC2에 배포하고 모든 API를 curl로 테스트했습니다.

> [!TIP]
> **IAM Role 방식의 장점 정리:**
>
> | 항목           | Access Key 방식          | IAM Role 방식 (이 실습)        |
> | -------------- | ------------------------ | ------------------------------ |
> | 자격 증명 위치 | 코드/환경변수에 저장     | EC2 메타데이터에서 자동 제공   |
> | 키 로테이션    | 수동으로 교체 필요       | 자동 로테이션 (임시 자격 증명) |
> | 유출 위험      | Git 커밋, 로그 노출 가능 | 인스턴스 외부 유출 불가        |
> | 코드 변경      | 환경별 설정 필요         | 코드 변경 없이 동작            |

---

# 🗑️ 리소스 정리

> [!WARNING]
> 리소스를 삭제할 때는 **의존 관계의 역순**으로 진행해야 합니다.
> IAM Role이 EC2에 연결된 상태에서 Role을 삭제하면 에러가 발생합니다.
>
> ```
> 생성 순서: IAM Policy → IAM Role → EC2에 Role 연결 → S3 객체 업로드
> 삭제 순서: S3 객체 → EC2에서 Role 분리 → IAM Role → IAM Policy (역순)
> ```

---

### 단계 1: Tag Editor로 생성된 리소스 확인

삭제 전에 이 실습에서 생성한 리소스를 Tag Editor로 확인합니다.

108. AWS Management Console 상단 검색창에 `Resource Groups & Tag Editor`를 입력합니다.
109. 검색 결과에서 **Resource Groups & Tag Editor**를 선택합니다.
110. 왼쪽 메뉴에서 **Tag Editor**를 선택합니다.
111. **Regions** 드롭다운에서 `ap-northeast-2`를 선택합니다.
112. **Resource types** 드롭다운에서 `All supported resource types`를 선택합니다.
113. **Tags** 섹션에서 **Tag key**에 `Session`을 입력합니다.
114. **Tag value**에 `5-2`를 입력합니다.
115. [[Search resources]] 버튼을 클릭합니다.
116. 이 실습에서 생성한 리소스(IAM Policy, IAM Role)가 표시되는지 확인합니다.

> [!TIP]
> Tag Editor는 리소스를 찾는 용도로만 사용합니다. 실제 삭제는 다음 단계에서 수행합니다.
> IAM 리소스는 글로벌 서비스이므로 Tag Editor에서 보이지 않을 수 있습니다. 그 경우 IAM 콘솔에서 직접 확인하세요.

---

### 단계 2: S3 테스트 파일 삭제

117. 상단 검색창에 `S3`를 입력하고 **S3** 서비스를 선택합니다.
118. 버킷 목록에서 사용한 버킷(예: `my-starter-app-123456789012`)을 클릭합니다.
119. `test/` 폴더 왼쪽의 체크박스를 클릭합니다.
120. 다른 테스트 폴더(예: `uploads/`, `images/`)가 있으면 함께 체크합니다.
121. [[Delete]] 버튼을 클릭합니다.
122. 확인 필드에 `permanently delete`를 입력합니다.
123. [[Delete objects]] 버튼을 클릭합니다.

> [!OUTPUT]
> "Successfully deleted X objects" 메시지가 표시됩니다.
> 버킷 자체는 삭제하지 않습니다 (다른 실습에서 사용할 수 있으므로).

> [!TIP]
> 버킷 내 파일이 많은 경우 AWS CLI로 한번에 삭제할 수 있습니다:
>
> ```bash
> aws s3 rm s3://my-starter-app-123456789012/test/ --recursive
> aws s3 rm s3://my-starter-app-123456789012/uploads/ --recursive
> ```

---

### 단계 3: EC2 애플리케이션 종료

124. EC2에 SSH로 접속합니다:

```bash
ssh -i my-key.pem ec2-user@{EC2-Public-IP}
```

125. 실행 중인 Java 프로세스를 종료합니다:

```bash
pkill -f 'java -jar'
```

126. 프로세스가 종료되었는지 확인합니다:

```bash
ps aux | grep 'java -jar'
```

> [!OUTPUT]
> `java -jar` 프로세스가 목록에 없으면 정상 종료된 것입니다.
> (grep 자체의 프로세스만 표시될 수 있습니다)

127. SSH 접속을 종료합니다:

```bash
exit
```

---

### 단계 4: EC2에서 IAM Role 분리

128. AWS Management Console에서 상단 검색창에 `EC2`를 입력하고 **EC2** 서비스를 선택합니다.
129. 왼쪽 메뉴에서 **Instances**를 선택합니다.
130. IAM Role을 연결한 인스턴스의 체크박스를 클릭하여 선택합니다.
131. 상단의 **Actions** 버튼을 클릭합니다.
132. **Security**를 선택합니다.
133. **Modify IAM role**을 클릭합니다.
134. **IAM role** 드롭다운을 클릭합니다.
135. 목록에서 `No IAM Role`을 선택합니다 (빈 값 선택).
136. [[Update IAM role]] 버튼을 클릭합니다.

> [!OUTPUT]
> "Successfully detached IAM role from instance" 메시지가 표시됩니다.
> 인스턴스의 Security 탭에서 IAM Role이 비어있는 것을 확인합니다.

> [!WARNING]
> IAM Role을 분리하면 EC2에서 실행 중인 앱이 즉시 S3에 접근할 수 없게 됩니다.
> 앱이 아직 실행 중이라면 `AccessDenied` 에러가 발생합니다.
> 단계 3에서 앱을 먼저 종료한 이유입니다.

---

### 단계 5: IAM Role 삭제

IAM Role을 삭제하려면 먼저 연결된 정책을 분리해야 합니다.

137. 상단 검색창에 `IAM`을 입력하고 **IAM** 서비스를 선택합니다.
138. 왼쪽 메뉴에서 **Roles**를 선택합니다.
139. 검색창에 `ec2-s3-access-role`을 입력합니다.
140. 검색 결과에서 `ec2-s3-access-role`을 클릭하여 상세 페이지로 이동합니다.
141. **Permissions** 탭을 선택합니다.
142. `S3AppBucketPolicy` 오른쪽의 ✕ (Remove) 버튼을 클릭합니다.
143. 확인 팝업에서 [[Remove policy]] 버튼을 클릭합니다.

> [!NOTE]
> 정책을 분리(Detach)하는 것이지 삭제하는 것이 아닙니다.
> 정책 자체는 다음 단계에서 별도로 삭제합니다.

144. 왼쪽 메뉴에서 **Roles**를 다시 선택합니다.
145. 검색창에 `ec2-s3-access-role`을 입력합니다.
146. `ec2-s3-access-role` 왼쪽의 라디오 버튼을 선택합니다.
147. [[Delete]] 버튼을 클릭합니다.
148. 확인 필드에 `ec2-s3-access-role`을 입력합니다.
149. [[Delete]] 버튼을 클릭합니다.

> [!OUTPUT]
> "Role ec2-s3-access-role has been deleted" 메시지가 표시됩니다.

---

### 단계 6: IAM 정책 삭제

150. 왼쪽 메뉴에서 **Policies**를 선택합니다.
151. **Filter policies** 드롭다운에서 `Customer managed`를 선택합니다.
152. 검색창에 `S3AppBucketPolicy`를 입력합니다.
153. `S3AppBucketPolicy` 왼쪽의 라디오 버튼을 선택합니다.
154. **Actions** 드롭다운을 클릭합니다.
155. [[Delete]]를 선택합니다.
156. 확인 필드에 `S3AppBucketPolicy`를 입력합니다.
157. [[Delete]] 버튼을 클릭합니다.

> [!OUTPUT]
> "Policy S3AppBucketPolicy has been deleted" 메시지가 표시됩니다.

> [!WARNING]
> IAM 정책이 다른 Role이나 User에 연결되어 있으면 삭제가 실패합니다.
> "Cannot delete a policy attached to entities" 에러가 발생하면
> 해당 정책의 **Policy usage** 탭에서 연결된 엔티티를 확인하고 먼저 분리하세요.

---

### 단계 7: 삭제 확인

158. **S3 콘솔**에서 버킷을 클릭하여 테스트 파일/폴더가 삭제되었는지 확인합니다.
159. **IAM 콘솔** → 왼쪽 메뉴 **Roles** → 검색창에 `ec2-s3-access-role` 입력 → 결과가 없는지 확인합니다.
160. **IAM 콘솔** → 왼쪽 메뉴 **Policies** → `Customer managed` 필터 → 검색창에 `S3AppBucketPolicy` 입력 → 결과가 없는지 확인합니다.
161. **EC2 콘솔** → 인스턴스 선택 → **Security** 탭 → IAM Role이 비어있는지 확인합니다.

> [!TIP]
> Tag Editor에서 `Session: 5-2`로 검색하여 남은 리소스가 없는지 최종 확인합니다.
> 검색 결과가 비어있으면 모든 리소스가 정리된 것입니다.

✅ **실습 종료**: 모든 리소스가 정리되었습니다.

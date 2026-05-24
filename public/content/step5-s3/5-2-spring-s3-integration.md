---
title: 'Spring Boot에서 Amazon S3 파일 업로드 구현'
week: 5
session: 2
awsServices:
  - Amazon S3
learningObjectives:
  - Spring Boot에서 AWS SDK v2를 설정할 수 있습니다.
  - MultipartFile을 S3에 업로드하는 서비스를 구현할 수 있습니다.
  - Presigned URL을 생성하여 클라이언트 직접 업로드를 구현할 수 있습니다.
  - S3 객체를 삭제하고 목록을 조회할 수 있습니다.
prerequisites:
  - AWS 계정 생성 완료
  - S3 버킷 생성 완료 (Step 5-1 참조)
  - Spring Boot 프로젝트 (로컬 또는 EC2)
  - IAM 사용자 또는 EC2 IAM Role (S3 접근 권한)
estimatedCost: 크레딧 내 사용 가능 (비용 매우 저렴)
---

이 실습에서는 Spring Boot 애플리케이션에서 AWS SDK v2를 사용하여 S3에 파일을
업로드, 삭제, 조회하는 기능을 구현합니다. Presigned URL을 활용한 클라이언트
직접 업로드 방식도 학습합니다.

> [!NOTE]
> 이 실습에는 S3 버킷이 필요합니다. 이미 있다면 사용합니다.
> 없다면 Step 5-1을 참조하여 버킷을 먼저 생성하세요.

---

## 태스크 0: IAM 사용자 생성 및 Access Key 발급

로컬 개발 환경에서 S3에 접근하려면 IAM 사용자의 Access Key가 필요합니다.
EC2에서 IAM Role을 사용하는 방식은 태스크 7에서 다룹니다.

### IAM 사용자 생성

1. AWS Management Console에 로그인합니다.
2. 상단 검색창에 `IAM`을 입력하고 선택합니다.
3. 왼쪽 메뉴에서 **Users**를 클릭합니다.
4. [[Create user]]를 클릭합니다.
5. **User name**: `s3-app-user`를 입력합니다.
6. [[Next]]를 클릭합니다.

### 권한 설정

7. **Set permissions** 페이지에서 **Attach policies directly**를 선택합니다.
8. 검색창에 `AmazonS3FullAccess`를 입력합니다.
9. ✅ **AmazonS3FullAccess** 정책을 체크합니다.
10. [[Next]]를 클릭합니다.
11. [[Create user]]를 클릭합니다.

> [!WARNING]
> `AmazonS3FullAccess`는 모든 S3 버킷에 대한 전체 권한을 부여합니다.
> 프로덕션에서는 특정 버킷에만 접근 가능한 커스텀 정책을 사용하세요.
> 이 실습에서는 학습 편의를 위해 FullAccess를 사용합니다.

### Access Key 발급

12. 생성된 사용자 `s3-app-user`를 클릭합니다.
13. **Security credentials** 탭을 선택합니다.
14. **Access keys** 섹션에서 [[Create access key]]를 클릭합니다.
15. Use case: **Application running outside AWS**를 선택합니다.
16. [[Next]]를 클릭합니다.
17. [[Create access key]]를 클릭합니다.
18. **Access key ID**와 **Secret access key**를 안전한 곳에 복사합니다.

> [!WARNING]
> Secret access key는 이 화면에서만 확인할 수 있습니다. 페이지를 닫으면
> 다시 볼 수 없으므로 반드시 복사해두세요. 분실 시 새로 발급해야 합니다.
> **절대 Git에 커밋하지 마세요.**

✅ **태스크 완료** — IAM 사용자를 생성하고 Access Key를 발급받았습니다.

---

## 태스크 1: Spring Boot 프로젝트 의존성 추가

AWS SDK v2 BOM(Bill of Materials)을 사용하여 버전을 일괄 관리합니다.

### build.gradle (Gradle 프로젝트)

```groovy
// build.gradle

dependencyManagement {
    imports {
        mavenBom "software.amazon.awssdk:bom:2.25.60"
    }
}

dependencies {
    // AWS SDK v2 - S3
    implementation 'software.amazon.awssdk:s3'
    // AWS SDK v2 - S3 Presigner (Presigned URL 생성용)
    implementation 'software.amazon.awssdk:s3-presigner'
    // AWS SDK v2 - STS (임시 자격 증명용, 선택)
    implementation 'software.amazon.awssdk:sts'

    // Spring Boot Web (파일 업로드 API)
    implementation 'org.springframework.boot:spring-boot-starter-web'

    // Lombok (선택)
    compileOnly 'org.projectlombok:lombok'
    annotationProcessor 'org.projectlombok:lombok'
}
```

> [!CONCEPT] AWS SDK v2 BOM
> BOM을 사용하면 AWS SDK 모듈들의 버전을 일일이 지정하지 않아도 됩니다.
> `bom:2.25.60`을 선언하면 `s3`, `sts`, `s3-presigner` 등 모든 모듈이
> 동일한 호환 버전으로 자동 설정됩니다.

### Maven 프로젝트의 경우 (pom.xml)

```xml
<dependencyManagement>
    <dependencies>
        <dependency>
            <groupId>software.amazon.awssdk</groupId>
            <artifactId>bom</artifactId>
            <version>2.25.60</version>
            <type>pom</type>
            <scope>import</scope>
        </dependency>
    </dependencies>
</dependencyManagement>

<dependencies>
    <dependency>
        <groupId>software.amazon.awssdk</groupId>
        <artifactId>s3</artifactId>
    </dependency>
    <dependency>
        <groupId>software.amazon.awssdk</groupId>
        <artifactId>s3-presigner</artifactId>
    </dependency>
</dependencies>
```

✅ **태스크 완료** — AWS SDK v2 의존성을 프로젝트에 추가했습니다.

---

## 태스크 2: S3Client Bean 설정

### application.yml 설정

```yaml
# src/main/resources/application.yml
cloud:
  aws:
    region: ap-northeast-2
    s3:
      bucket: my-starter-app-123456789012
    credentials:
      access-key: ${AWS_ACCESS_KEY_ID}
      secret-key: ${AWS_SECRET_ACCESS_KEY}
```

> [!WARNING]
> Access Key를 `application.yml`에 직접 작성하지 마세요.
> 환경 변수(`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`)를 사용하거나,
> `.env` 파일을 `.gitignore`에 추가하여 관리합니다.

### S3Config 클래스 작성

```java
package com.example.demo.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

@Configuration
public class S3Config {

    @Value("${cloud.aws.region}")
    private String region;

    @Value("${cloud.aws.credentials.access-key}")
    private String accessKey;

    @Value("${cloud.aws.credentials.secret-key}")
    private String secretKey;

    @Bean
    public S3Client s3Client() {
        return S3Client.builder()
                .region(Region.of(region))
                .credentialsProvider(StaticCredentialsProvider.create(
                        AwsBasicCredentials.create(accessKey, secretKey)))
                .build();
    }

    @Bean
    public S3Presigner s3Presigner() {
        return S3Presigner.builder()
                .region(Region.of(region))
                .credentialsProvider(StaticCredentialsProvider.create(
                        AwsBasicCredentials.create(accessKey, secretKey)))
                .build();
    }
}
```

> [!TIP]
> EC2에서 IAM Role을 사용하는 경우, `credentialsProvider` 설정을 제거하면
> SDK가 자동으로 인스턴스 메타데이터에서 자격 증명을 가져옵니다 (태스크 7 참조).

### 환경 변수 설정 (로컬 개발)

IntelliJ IDEA에서 환경 변수를 설정하는 방법:

1. **Run** → **Edit Configurations**
2. Spring Boot 실행 설정 선택
3. **Environment variables** 필드에 입력:

```
AWS_ACCESS_KEY_ID=AKIA...;AWS_SECRET_ACCESS_KEY=wJal...
```

또는 터미널에서 실행 시:

```bash
export AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
export AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
./gradlew bootRun
```

✅ **태스크 완료** — S3Client와 S3Presigner Bean을 설정했습니다.

---

## 태스크 3: 파일 업로드 서비스 구현

### S3Service 클래스

```java
package com.example.demo.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.io.IOException;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class S3Service {

    private final S3Client s3Client;

    @Value("${cloud.aws.s3.bucket}")
    private String bucket;

    /**
     * MultipartFile을 S3에 업로드합니다.
     *
     * @param file      업로드할 파일
     * @param directory S3 내 저장 경로 (예: "images/profile")
     * @return 업로드된 객체의 키 (S3 경로)
     */
    public String upload(MultipartFile file, String directory) {
        // 고유한 파일명 생성 (UUID + 원본 파일명)
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
                    RequestBody.fromInputStream(file.getInputStream(), file.getSize()));

            log.info("파일 업로드 성공: {}", key);
            return key;

        } catch (IOException e) {
            throw new RuntimeException("파일 업로드 실패: " + originalFilename, e);
        }
    }

    /**
     * 업로드된 파일의 전체 URL을 반환합니다.
     */
    public String getFileUrl(String key) {
        return String.format("https://%s.s3.ap-northeast-2.amazonaws.com/%s",
                bucket, key);
    }

    private String extractExtension(String filename) {
        if (filename == null || !filename.contains(".")) {
            return "";
        }
        return filename.substring(filename.lastIndexOf("."));
    }
}
```

> [!CONCEPT] UUID 파일명을 사용하는 이유
>
> - 파일명 충돌 방지: 여러 사용자가 같은 이름의 파일을 업로드해도 겹치지 않습니다.
> - 보안: 원본 파일명에 포함된 개인정보나 특수문자 문제를 방지합니다.
> - URL 안전: 한글이나 공백이 포함된 파일명으로 인한 인코딩 문제를 방지합니다.

✅ **태스크 완료** — S3 파일 업로드 서비스를 구현했습니다.

---

## 태스크 4: 파일 삭제 및 목록 조회 구현

S3Service에 삭제와 목록 조회 메서드를 추가합니다.

### 파일 삭제

```java
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;

// S3Service 클래스에 추가
/**
 * S3에서 객체를 삭제합니다.
 *
 * @param key 삭제할 객체의 키
 */
public void delete(String key) {
    DeleteObjectRequest request = DeleteObjectRequest.builder()
            .bucket(bucket)
            .key(key)
            .build();

    s3Client.deleteObject(request);
    log.info("파일 삭제 성공: {}", key);
}
```

### 목록 조회

```java
import software.amazon.awssdk.services.s3.model.ListObjectsV2Request;
import software.amazon.awssdk.services.s3.model.ListObjectsV2Response;
import software.amazon.awssdk.services.s3.model.S3Object;
import java.util.List;
import java.util.stream.Collectors;

// S3Service 클래스에 추가
/**
 * 특정 경로(prefix)의 객체 목록을 조회합니다.
 *
 * @param prefix 조회할 경로 (예: "images/profile/")
 * @return 객체 키 목록
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
```

> [!NOTE]
> `listObjectsV2`는 기본적으로 최대 1,000개의 객체를 반환합니다.
> 더 많은 객체가 있는 경우 `continuationToken`을 사용하여 페이징 처리합니다.

✅ **태스크 완료** — 파일 삭제 및 목록 조회 기능을 구현했습니다.

---

## 태스크 5: Presigned URL 생성

Presigned URL을 사용하면 클라이언트(브라우저)가 서버를 거치지 않고 S3에 직접 파일을 업로드할 수 있습니다. 대용량 파일 업로드 시 서버 부하를 크게 줄일 수 있습니다.

### 동작 흐름

```
1. [클라이언트] → [서버] "업로드 URL 요청"
2. [서버] → [S3 Presigner] "Presigned URL 생성"
3. [서버] → [클라이언트] "Presigned URL 반환"
4. [클라이언트] → [S3] "Presigned URL로 직접 업로드 (PUT)"
```

### Presigned URL 서비스

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
    public String generateUploadUrl(String directory, String filename,
                                     String contentType) {
        String key = directory + "/" + UUID.randomUUID() + "_" + filename;

        PutObjectRequest objectRequest = PutObjectRequest.builder()
                .bucket(bucket)
                .key(key)
                .contentType(contentType)
                .build();

        PutObjectPresignRequest presignRequest = PutObjectPresignRequest.builder()
                .signatureDuration(Duration.ofMinutes(10))
                .putObjectRequest(objectRequest)
                .build();

        String url = s3Presigner.presignPutObject(presignRequest).url().toString();
        return url;
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

        GetObjectPresignRequest presignRequest = GetObjectPresignRequest.builder()
                .signatureDuration(Duration.ofMinutes(30))
                .getObjectRequest(objectRequest)
                .build();

        return s3Presigner.presignGetObject(presignRequest).url().toString();
    }
}
```

> [!TIP]
> Presigned URL의 만료 시간은 용도에 따라 조절합니다:
>
> - 업로드용: 5~15분 (사용자가 파일을 선택하고 업로드할 시간)
> - 다운로드용: 30분~1시간 (링크 공유 시)
> - 최대 7일까지 설정 가능하지만, 짧을수록 보안에 유리합니다.

✅ **태스크 완료** — Presigned URL 생성 서비스를 구현했습니다.

---

## 태스크 6: REST Controller 작성 및 테스트

### S3Controller

```java
package com.example.demo.controller;

import com.example.demo.service.PresignedUrlService;
import com.example.demo.service.S3Service;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/files")
@RequiredArgsConstructor
public class S3Controller {

    private final S3Service s3Service;
    private final PresignedUrlService presignedUrlService;

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
     * 파일 삭제
     * DELETE /api/files?key=images/profile/uuid.png
     */
    @DeleteMapping
    public ResponseEntity<Void> delete(@RequestParam String key) {
        s3Service.delete(key);
        return ResponseEntity.noContent().build();
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
     * Presigned Upload URL 발급
     * POST /api/files/presigned-url
     * Body: { "directory": "images", "filename": "photo.png",
     *         "contentType": "image/png" }
     */
    @PostMapping("/presigned-url")
    public ResponseEntity<Map<String, String>> getPresignedUrl(
            @RequestBody Map<String, String> request) {

        String url = presignedUrlService.generateUploadUrl(
                request.get("directory"),
                request.get("filename"),
                request.get("contentType"));

        return ResponseEntity.ok(Map.of("uploadUrl", url));
    }
}
```

### curl로 테스트

애플리케이션을 실행한 후 터미널에서 테스트합니다:

```bash
# 1. 파일 업로드 (서버 경유)
curl -X POST http://localhost:8080/api/files/upload \
  -F "file=@/path/to/test-image.png" \
  -F "directory=images/profile"
```

> [!OUTPUT]
>
> ```json
> {
>   "key": "images/profile/550e8400-e29b-41d4-a716-446655440000.png",
>   "url": "https://my-starter-app-123456789012.s3.ap-northeast-2.amazonaws.com/images/profile/550e8400-e29b-41d4-a716-446655440000.png"
> }
> ```

```bash
# 2. 파일 목록 조회
curl http://localhost:8080/api/files?prefix=images/
```

> [!OUTPUT]
>
> ```json
> ["images/profile/550e8400-e29b-41d4-a716-446655440000.png"]
> ```

```bash
# 3. Presigned URL 발급
curl -X POST http://localhost:8080/api/files/presigned-url \
  -H "Content-Type: application/json" \
  -d '{"directory":"images","filename":"photo.png","contentType":"image/png"}'
```

> [!OUTPUT]
>
> ```json
> {
>   "uploadUrl": "https://my-starter-app-123456789012.s3.ap-northeast-2.amazonaws.com/images/..."
> }
> ```

```bash
# 4. Presigned URL로 직접 업로드
curl -X PUT "위에서 받은 uploadUrl" \
  -H "Content-Type: image/png" \
  --data-binary @/path/to/photo.png
```

```bash
# 5. 파일 삭제
curl -X DELETE "http://localhost:8080/api/files?key=images/profile/550e8400-e29b-41d4-a716-446655440000.png"
```

✅ **태스크 완료** — REST Controller를 작성하고 curl로 모든 API를 테스트했습니다.

---

## 태스크 7: EC2 IAM Role 방식 (Access Key 없이 접근)

EC2 인스턴스에 IAM Role을 부여하면 Access Key 없이도 S3에 접근할 수 있습니다.
이 방식이 보안상 더 안전하며, AWS가 권장하는 방법입니다.

### IAM Role vs Access Key 비교

| 항목           | Access Key 방식          | IAM Role 방식                  |
| -------------- | ------------------------ | ------------------------------ |
| 자격 증명 위치 | 코드/환경변수에 저장     | EC2 메타데이터에서 자동 제공   |
| 키 로테이션    | 수동으로 교체 필요       | 자동 로테이션 (임시 자격 증명) |
| 유출 위험      | Git 커밋, 로그 노출 가능 | 인스턴스 외부 유출 불가        |
| 적합한 환경    | 로컬 개발                | EC2, ECS 등 AWS 환경           |

### IAM Role 생성

1. IAM 콘솔 → **Roles** → [[Create role]]을 클릭합니다.
2. **Trusted entity type**: AWS service
3. **Use case**: EC2
4. [[Next]]를 클릭합니다.
5. 정책 검색: `AmazonS3FullAccess` 체크
6. [[Next]]를 클릭합니다.
7. **Role name**: `ec2-s3-access-role`
8. [[Create role]]을 클릭합니다.

### EC2에 IAM Role 연결

1. EC2 콘솔에서 인스턴스를 선택합니다.
2. **Actions** → **Security** → **Modify IAM role**을 클릭합니다.
3. 드롭다운에서 `ec2-s3-access-role`을 선택합니다.
4. [[Update IAM role]]을 클릭합니다.

### Spring Boot 설정 변경 (EC2용)

EC2에서 IAM Role을 사용할 때는 `credentialsProvider`를 제거합니다:

```java
@Configuration
public class S3Config {

    @Value("${cloud.aws.region}")
    private String region;

    @Bean
    public S3Client s3Client() {
        // credentialsProvider를 지정하지 않으면
        // SDK가 자동으로 EC2 Instance Metadata에서 자격 증명을 가져옵니다.
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

> [!CONCEPT] AWS SDK의 자격 증명 체인 (Credential Provider Chain)
> AWS SDK v2는 다음 순서로 자격 증명을 찾습니다:
>
> 1. 환경 변수 (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`)
> 2. Java 시스템 속성
> 3. `~/.aws/credentials` 파일
> 4. EC2 Instance Metadata (IAM Role)
> 5. ECS Container Credentials
>
> `credentialsProvider`를 명시하지 않으면 이 체인을 순서대로 탐색합니다.
> EC2에 IAM Role이 연결되어 있으면 4번에서 자동으로 자격 증명을 획득합니다.

> [!TIP]
> 로컬 개발과 EC2 배포를 모두 지원하려면, `credentialsProvider`를 설정하지 않고
> 로컬에서는 환경 변수나 `~/.aws/credentials` 파일을 사용하는 것이 가장 깔끔합니다.
> 이렇게 하면 코드 변경 없이 두 환경 모두에서 동작합니다.

✅ **태스크 완료** — EC2 IAM Role 방식으로 Access Key 없이 S3에 접근하는 방법을 학습했습니다.

---

# 🗑️ 리소스 정리

> [!NOTE]
> S3 비용은 매우 저렴하여 학습 수준에서는 크레딧 소진이 거의 없습니다. IAM 사용자와 Role은 무료이므로 유지해도 비용이 발생하지 않습니다.

---

### 단계 1: S3 테스트 파일 삭제

1. S3 콘솔에서 버킷을 클릭합니다.
2. 테스트로 업로드한 파일들을 선택합니다.
3. [[Delete]]를 클릭하고 `permanently delete`를 입력하여 삭제합니다.

---

### 단계 2: IAM 사용자 Access Key 비활성화/삭제

더 이상 로컬에서 S3 테스트를 하지 않는다면 Access Key를 비활성화합니다.

1. IAM 콘솔 → **Users** → `s3-app-user` → **Security credentials** 탭
2. Access key 옆의 **Actions** → [[Deactivate]] (일시 비활성화)
3. 완전히 삭제하려면 **Actions** → [[Delete]] → 확인

> [!WARNING]
> Access Key를 삭제하면 해당 키를 사용하는 모든 애플리케이션이 S3에 접근할 수 없게 됩니다. 삭제 전에 사용 중인 곳이 없는지 확인하세요.

---

### 단계 3: IAM Role 삭제 (선택)

EC2에서 더 이상 S3를 사용하지 않는다면:

1. EC2 콘솔 → 인스턴스 선택 → **Actions** → **Security** → **Modify IAM role** → `No IAM Role` 선택 → [[Update IAM role]]
2. IAM 콘솔 → **Roles** → `ec2-s3-access-role` 선택 → [[Delete]] → Role 이름 입력 → 확인

---

### 단계 4: 삭제 확인

1. S3 버킷에서 테스트 파일이 삭제되었는지 확인합니다.
2. IAM Users에서 `s3-app-user`의 Access Key 상태를 확인합니다.

✅ **실습 종료**: 모든 리소스가 정리되었습니다.

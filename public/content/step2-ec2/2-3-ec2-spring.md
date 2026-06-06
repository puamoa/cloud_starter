---
title: 'Amazon EC2에 Spring 애플리케이션 배포'
week: 2
session: 3
awsServices:
  - Amazon EC2
learningObjectives:
  - EC2에 Amazon Corretto 17(Java)을 설치할 수 있습니다.
  - Spring Boot JAR 또는 Spring MVC WAR를 EC2에 배포할 수 있습니다.
  - Tomcat을 설치하고 WAR 파일을 배포할 수 있습니다.
  - systemd 서비스로 애플리케이션을 등록할 수 있습니다.
  - journalctl로 애플리케이션 로그를 확인할 수 있습니다.
  - Nginx 리버스 프록시를 설정하여 프론트엔드와 백엔드를 연결할 수 있습니다.
prerequisites:
  - AWS 계정 생성 완료
  - EC2 인스턴스 실행 중 (Amazon Linux 2023, Public IP 할당)
  - Security Group에 8080 포트 허용
  - 로컬에 Spring 프로젝트 (또는 실습 중 샘플 생성)
estimatedCost: 크레딧 내 사용 가능 (비용 발생 가능)
---

이 실습에서는 EC2 인스턴스에 Java 17을 설치하고, Spring 애플리케이션을 배포합니다.  
**Spring Boot(JAR)** 또는 **Spring MVC(WAR + Tomcat)** 두 가지 방식을 모두 안내합니다.

> [!NOTE]
> 이 실습은 EC2 인스턴스가 필요합니다. Step 2-1에서 생성한 EC2를 사용하거나, 새로운 EC2 인스턴스를 생성합니다.  
> Security Group에 8080 포트가 열려 있어야 합니다.  
> EC2가 없다면 [Step 2-1의 태스크 0(CloudFormation)과 태스크 1(EC2 생성)](/week/2/session/1)을 먼저 진행하세요.

### 실습 흐름

```
[로컬] 빌드 → [로컬→EC2] SCP 전송 → [EC2] 실행 + 서비스 등록 → [브라우저] 확인
```

| 단계       | 실행 위치       | 내용                                       |
| ---------- | --------------- | ------------------------------------------ |
| 태스크 0   | AWS 콘솔 + 로컬 | EC2 확인 및 SSH 접속                       |
| 태스크 1   | EC2 내부        | Java 17 설치, Swap 추가                    |
| 태스크 2   | **로컬 PC**     | Spring 프로젝트 빌드 (JAR 또는 WAR)        |
| 태스크 3   | **로컬 PC**     | SCP로 빌드 결과물을 EC2에 전송             |
| 태스크 4   | EC2 내부        | 애플리케이션 실행 + systemd 서비스 등록    |
| 태스크 5~6 | EC2 내부        | 로그 확인 + 자동 재시작 테스트             |
| 태스크 7   | EC2 내부        | Nginx 리버스 프록시 설정 (프론트엔드 연동) |

> [!WARNING]
> Step 2-1에서 EC2를 Stop한 경우, 먼저 Start하고 새로운 Public IP를 확인한 후 진행하세요.
>
> **EC2 인스턴스 Start 방법:**
>
> 1. EC2 콘솔 → **Instances** → 해당 인스턴스 선택
> 2. **Instance state** 버튼 클릭 → **Start instance** 선택
> 3. Status check가 "3/3 checks passed"가 될 때까지 대기 (약 1분)
> 4. 새로 할당된 **Public IPv4 address**를 확인합니다
>
> ⚠️ Stop → Start 시 **Public IP가 변경**됩니다. 이전 IP로 접속하면 실패합니다.
> Elastic IP를 사용하지 않는 한, 매번 새 IP를 확인해야 합니다.

> [!CONCEPT] Spring Boot (JAR) vs Spring MVC (WAR)
>
> | 항목        | Spring Boot (JAR)   | Spring MVC (WAR)      |
> | ----------- | ------------------- | --------------------- |
> | 실행 방식   | `java -jar app.jar` | Tomcat에 WAR 배포     |
> | 내장 서버   | ✅ Tomcat 내장      | ❌ 외부 Tomcat 필요   |
> | 빌드 결과물 | `.jar` (20~50MB)    | `.war` (수 MB)        |
> | 설정 파일   | `application.yml`   | XML + properties      |
> | 배포 난이도 | 간단 (파일 하나)    | Tomcat 설치·관리 필요 |
> | 실무 추세   | ✅ 주류             | 레거시 프로젝트       |
>
> 이 실습에서는 두 방식을 모두 다룹니다. 본인 프로젝트에 맞는 방법을 선택하세요.

> [!TIP]
> **Spring Boot도 외부 Tomcat에 WAR로 배포할 수 있습니다.**  
> `SpringBootServletInitializer`를 상속하고 packaging을 `war`로 변경하면 됩니다.  
> 단, 내장 Tomcat(JAR)을 쓰는 것이 Spring Boot의 기본이자 권장 방식입니다.  
> 외부 Tomcat이 반드시 필요한 경우(기존 인프라 제약, 레거시 통합 등)가 아니라면 JAR 배포를 선택하세요.

## 태스크 0: EC2 인스턴스 확인 및 접속

📍 **실행 위치: 로컬 PC (브라우저 + 터미널)**

1. AWS Management Console에 로그인합니다.
2. 리전을 **Asia Pacific (Seoul) ap-northeast-2**로 설정합니다.
3. EC2 콘솔에서 사용할 인스턴스가 `Running` 상태인지 확인합니다.
4. Public IPv4 address를 확인합니다.
5. SSH로 접속합니다:

**Mac/Linux:**

```bash
ssh -i ~/Downloads/my-keypair.pem ec2-user@<Public-IP>
```

**Windows:**

```powershell
ssh -i C:\Users\<사용자명>\Downloads\my-keypair.pem ec2-user@<Public-IP>
```

> [!TIP]
> **Windows MobaXterm 사용자:**  
> Step 2-1에서 세션을 이미 만들었다면, 왼쪽 **Sessions** 탭 → 세션 **우클릭** → **Edit session** → **Remote host**를 새 IP로 변경 → [[OK]] → 더블클릭으로 접속합니다.  
> 처음이라면 [Step 2-1의 태스크 2(SSH 접속)](/week/2/session/1)를 참고하세요.

> [!NOTE]
> **Security Group에 8080 포트가 열려 있는지 확인:**
>
> 1. EC2 콘솔 → 인스턴스 선택 → **Security** 탭 → Security Group 링크 클릭
> 2. **Inbound rules**에서 Custom TCP 8080 규칙이 있는지 확인
> 3. 없으면 [[Edit inbound rules]] → [[Add rule]] → Type: `Custom TCP`, Port: `8080`, Source: `0.0.0.0/0` → [[Save rules]]
>
> CloudFormation 템플릿으로 생성한 `my-ec2-sg`에는 8080이 이미 포함되어 있습니다.

✅ **태스크 완료**: EC2 인스턴스에 접속했습니다.

## 태스크 1: Java 17 (Amazon Corretto) 설치

> [!CONCEPT] Amazon Corretto
> Amazon Corretto는 AWS에서 제공하는 무료 OpenJDK 배포판입니다.  
> 장기 지원(LTS)이 제공되며, AWS 서비스와의 호환성이 검증되어 있습니다.  
> Spring Boot 3.x/4.x 모두 Java 17 이상을 요구합니다.

> [!NOTE]
> **t3.micro (1GB RAM) 사용 시 Swap 메모리 추가 권장**
>
> Step 2-2에서 이미 Swap을 추가했다면 이 단계를 건너뛰세요.  
> 추가하지 않았다면 Java 애플리케이션 실행 시 메모리 부족이 발생할 수 있으므로 미리 추가합니다:
>
> ```bash
> # Swap이 이미 있는지 확인
> free -h
> ```
>
> Swap 행이 `0B`이면 추가가 필요합니다:
>
> ```bash
> sudo dd if=/dev/zero of=/swapfile bs=128M count=16
> sudo chmod 600 /swapfile
> sudo mkswap /swapfile
> sudo swapon /swapfile
> echo '/swapfile swap swap defaults 0 0' | sudo tee -a /etc/fstab
> ```
>
> 상세 설명은 [Step 2-2의 Swap 메모리 추가](/week/2/session/2) 섹션을 참고하세요.
>
> **왜 필요한가요?**  
> Java(JVM)는 기본적으로 수백 MB의 메모리를 사용합니다.  
> t3.micro(1GB)에서 MySQL + Spring을 동시에 실행하면 메모리가 부족해 OOM Kill이 발생하거나 SSH 접속이 불가능해질 수 있습니다.

📍 **실행 위치: EC2** (SSH 접속한 상태)

6. Amazon Corretto 17을 설치합니다:

```bash
sudo dnf install java-17-amazon-corretto-devel -y
```

7. Java 버전을 확인합니다:

```bash
java -version
```

> [!OUTPUT]
>
> ```
> openjdk version "17.0.x" 2024-xx-xx LTS
> OpenJDK Runtime Environment Corretto-17.0.x.x.x (build 17.0.x+x-LTS)
> OpenJDK 64-Bit Server VM Corretto-17.0.x.x.x (build 17.0.x+x-LTS, mixed mode, sharing)
> ```

8. JAVA_HOME 환경 변수를 설정합니다:

```bash
echo 'export JAVA_HOME=/usr/lib/jvm/java-17-amazon-corretto' | sudo tee -a /etc/profile.d/java.sh
source /etc/profile.d/java.sh
echo $JAVA_HOME
```

✅ **태스크 완료**: Java 17(Amazon Corretto)이 설치되었습니다.

## 태스크 2: 로컬에서 빌드

📍 **실행 위치: 로컬 PC** (본인 컴퓨터에서 진행합니다)

본인 프로젝트에 맞는 방법을 선택합니다.

---

### 방법 A: Spring Boot (JAR 빌드)

기존 Spring Boot 프로젝트가 있다면 빌드만 합니다. 없다면 새로 생성합니다.

**기존 프로젝트가 있는 경우:**

```bash
cd <프로젝트 디렉토리>
./gradlew build -x test
# 결과: build/libs/<프로젝트명>-0.0.1-SNAPSHOT.jar
```

**새 프로젝트를 생성하는 경우:**

> [!NOTE]
> 아래에서 생성하는 샘플 프로젝트는 **DB 연결 없이 동작하는 간단한 REST API**입니다.  
> MySQL 설정이나 DB 사용자 생성 없이 바로 빌드·배포·테스트할 수 있습니다.

9. 브라우저에서 https://start.spring.io 에 접속합니다.

10. 다음과 같이 설정합니다:
    - **Project**: `Gradle - Groovy`
    - **Language**: `Java`
    - **Spring Boot**: 최신 안정 버전 (예: `4.0.6` — SNAPSHOT, RC가 아닌 버전 선택)
    - **Group**: `com.example`
    - **Artifact**: `demo`
    - **Packaging**: `Jar`
    - **Java**: `17`
    - **Dependencies**: `Spring Web` 추가

> [!NOTE]
> 기존 프로젝트가 Spring Boot 3.x 기반이라면, 여기서도 `3.5.x`를 선택하세요.  
> 4.x와 3.x는 Jackson, Security 기본값 등이 달라 기존 코드에서 호환성 문제가 발생할 수 있습니다.  
> 새로 시작하는 프로젝트는 4.x를 권장합니다.

11. [[Generate]] 버튼을 클릭하여 다운로드 후 압축 해제합니다.

> [!TIP]
> **IntelliJ IDEA에서 생성하는 경우:**  
> File → New → Project → 왼쪽 Generators에서 **Spring Boot** 선택 → 동일한 설정(Language: Java, Type: Gradle - Groovy, Java: 17, Packaging: Jar)으로 생성합니다.  
> Next를 누르면 Dependencies 화면이 나옵니다:
>
> - **Spring Boot 버전**: 상단 드롭다운에서 `4.0.6` (SNAPSHOT/RC가 아닌 안정 버전) 선택
> - **Dependencies**: `Spring Web` 체크 (Web 카테고리), 필요 시 `Lombok`, `Spring Boot DevTools` 추가
> - [[Create]] 클릭
>
> IntelliJ가 내부적으로 start.spring.io를 호출하므로 결과물은 웹에서 생성한 것과 동일합니다.

12. 간단한 API를 추가합니다. `controller` 패키지를 만들고 그 안에 파일을 생성합니다:

> [!NOTE]
> **프로젝트 구조 (생성 후):**
>
> ```
> demo/
> ├── build.gradle
> ├── src/main/java/com/example/demo/
> │   ├── DemoApplication.java          ← 자동 생성된 메인 클래스
> │   └── controller/                   ← 새로 만드는 패키지
> │       └── HelloController.java      ← 새로 만드는 파일
> └── src/main/resources/
>     ├── application.properties
>     └── static/                        ← 사용하지 않음 (Nginx에서 프론트 서빙)
> ```
>
> IntelliJ: `com.example.demo` 패키지 우클릭 → New → Package → `controller` 입력 → 그 안에 New → Java Class → `HelloController`

`src/main/java/com/example/demo/controller/HelloController.java`

```java
package com.example.demo.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HelloController {

    @GetMapping("/")
    public String hello() {
        return "Hello from Spring Boot on EC2!";
    }

    @GetMapping("/api/health")
    public String health() {
        return "OK";
    }
}
```

13. `src/main/resources/application.properties`에 로그 설정을 추가합니다:

```properties
# 요청 로그 출력 (배포 후 로그 확인용)
logging.level.org.springframework.web=DEBUG
```

> [!NOTE]
> **Spring Boot 로그 레벨:**
>
> | 레벨    | 설명                         | 출력량 |
> | ------- | ---------------------------- | ------ |
> | `ERROR` | 에러만 출력                  | 최소   |
> | `WARN`  | 경고 + 에러                  | 적음   |
> | `INFO`  | 일반 정보 (기본값)           | 보통   |
> | `DEBUG` | 상세 디버깅 정보 (요청 포함) | 많음   |
> | `TRACE` | 모든 내부 동작               | 최대   |
>
> 기본값(`INFO`)에서는 브라우저 접속 시 로그가 출력되지 않습니다.  
> `DEBUG`로 설정하면 어떤 URL로 요청이 들어왔는지, 어떤 컨트롤러가 처리했는지 확인할 수 있습니다.  
> **프로덕션에서는 `INFO` 또는 `WARN`으로 되돌리세요** (DEBUG는 로그량이 많아 디스크를 빠르게 소모합니다).

14. 프로젝트 루트 디렉토리에서 터미널을 열고 빌드합니다:

> [!TIP]
> **터미널 여는 방법:**
>
> - **IntelliJ**: 하단 **Terminal** 탭 클릭 (단축키: `Alt+F12` / Mac: `Option+F12`). 프로젝트 루트에서 자동으로 열립니다.
> - **VS Code**: 상단 메뉴 Terminal → New Terminal (단축키: `` Ctrl+` ``). 프로젝트 루트에서 열립니다.
> - **Mac/Linux 터미널**: `cd ~/경로/demo` 로 프로젝트 폴더로 이동
> - **Windows PowerShell**: `cd C:\Users\사용자명\경로\demo` 로 이동
>
> `ls` (Mac/Linux) 또는 `dir` (Windows)로 `build.gradle` 파일이 보이는지 확인하세요. 보이면 올바른 위치입니다.

```bash
./gradlew build
```

> [!OUTPUT]
>
> ```
> BUILD SUCCESSFUL in xxs
> ```
>
> 빌드된 JAR 파일: `build/libs/demo-0.0.1-SNAPSHOT.jar`

> [!TIP]
> **빌드 결과 파일명 확인:**  
> 프로젝트 설정에 따라 JAR 파일명이 다를 수 있습니다.  
> `build/libs/` 폴더의 실제 파일명을 확인하세요:
>
> ```bash
> ls build/libs/
> ```
>
> `-plain.jar`가 아닌 일반 `.jar` 파일을 사용합니다.  
> 예: `demo-0.0.1-SNAPSHOT.jar` (O), `demo-0.0.1-SNAPSHOT-plain.jar` (X)

15. 로컬에서 테스트합니다:

```bash
java -jar build/libs/demo-0.0.1-SNAPSHOT.jar
# 브라우저에서 http://localhost:8080 확인 후 Ctrl+C로 종료
```

방법 A를 완료했다면 **태스크 3**으로 이동하세요.

---

### 방법 B: Spring MVC (WAR 빌드)

기존 Spring MVC 프로젝트(Tomcat 배포용)가 있는 경우입니다.

> [!NOTE]
> 이 방법은 Spring Boot가 아닌 **일반 Spring MVC** 프로젝트 (WAR 패키징, 외부 Tomcat 필요)에 해당합니다.  
> `build.gradle`에 `id 'war'` 플러그인이 있고, `application.yml` 대신 `application.properties` + XML 설정을 사용하는 프로젝트입니다.

**빌드 전 확인 사항:**

📍 **실행 위치: 로컬 PC의 터미널** (프로젝트 루트 디렉토리에서 진행)

> [!TIP]
> **터미널에서 프로젝트 폴더로 이동하는 방법:**
>
> - **IntelliJ/VS Code**: 프로젝트를 연 상태에서 내장 터미널 사용 (이미 프로젝트 루트에 위치)
> - **Mac 터미널**: `cd ~/프로젝트경로` (예: `cd ~/IdeaProjects/backend`)
> - **Windows PowerShell**: `cd C:\Users\사용자명\IdeaProjects\backend`
>
> `ls` (Mac) 또는 `dir` (Windows)로 `build.gradle`과 `gradlew` 파일이 보이면 올바른 위치입니다.

9. **`gradlew` 파일 실행 권한 확인** (Mac/Linux):

```bash
chmod +x gradlew
```

> [!NOTE]
> **Windows 사용자**는 `gradlew.bat`을 사용합니다.  
> 권한 설정이 필요 없으며, 이후 모든 `./gradlew` 명령을 `gradlew.bat`으로 대체하세요:
>
> ```powershell
> # Windows에서는 이렇게 실행
> gradlew.bat build -x test
> ```

> [!WARNING]
> Windows에서 복사한 프로젝트의 `gradlew` 파일은 실행 권한이 없거나 인코딩이 깨져 있을 수 있습니다.  
> `./gradlew: Permission denied` 에러가 나면 `chmod +x gradlew`를 실행하세요.  
> `\#!/bin/sh: No such file or directory` 에러가 나면 파일이 손상된 것이므로 Gradle Wrapper를 재생성해야 합니다:
>
> ```bash
> # Gradle이 로컬에 설치되어 있는 경우
> gradle wrapper --gradle-version 8.8
>
> # 또는 GitHub에서 직접 다운로드
> curl -sL https://raw.githubusercontent.com/gradle/gradle/v8.8.0/gradlew -o gradlew
> chmod +x gradlew
> ```

10. **업로드 경로 수정** (Windows 경로 → Linux 경로):  
    프로젝트에 파일 업로드 기능이 있다면, 업로드 경로가 Windows 형식(`C:/upload`)으로 되어 있을 수 있습니다.  
    EC2(Linux)에서 동작하도록 변경합니다:

```java
// WebConfig.java 또는 관련 설정 파일
// 변경 전: final String LOCATION = "C:/upload";
// 변경 후:
final String LOCATION = "/tmp/upload";
```

11. **DB 접속 정보 확인** (`application.properties`):

```properties
# EC2에서 같은 서버의 MySQL에 접속하는 경우 localhost 그대로 사용
jdbc.url=jdbc:log4jdbc:mysql://localhost:3306/scoula_db
jdbc.username=scoula
jdbc.password=Scoula123!
```

> [!NOTE]
> **`localhost:3306`이 맞는 이유:**  
> MySQL을 같은 EC2 인스턴스에 설치했으므로, 애플리케이션과 DB가 같은 서버에 있습니다.  
> 따라서 `localhost`(또는 `127.0.0.1`)로 접속하면 됩니다.
>
> **확인 방법** (EC2에서):
>
> ```bash
> # MySQL이 실행 중인지 확인
> sudo systemctl status mysqld
>
> # MySQL 포트 확인
> sudo ss -tlnp | grep 3306
> ```
>
> `3306` 포트에서 LISTEN 상태이면 정상입니다.

> [!WARNING]
> `application.properties`의 DB 접속 정보(DB명, 사용자명, 비밀번호)에 해당하는 **MySQL 사용자와 데이터베이스가 EC2에 존재해야** 합니다.  
> 아직 생성하지 않았다면 EC2에 SSH 접속 후 다음을 실행하세요:
>
> 📍 **실행 위치: EC2 (SSH 접속한 상태)**
>
> ```bash
> mysql -u root -p
> ```
>
> ```sql
> CREATE DATABASE IF NOT EXISTS scoula_db DEFAULT CHARACTER SET utf8mb4;
> CREATE USER IF NOT EXISTS 'scoula'@'%' IDENTIFIED BY 'Scoula123!';
> GRANT ALL PRIVILEGES ON scoula_db.* TO 'scoula'@'%';
> FLUSH PRIVILEGES;
> EXIT;
> ```
>
> 위 값(`scoula_db`, `scoula`, `Scoula123!`)은 예시입니다.  
> **본인 프로젝트의 `application.properties`에 적힌 값과 동일하게** 생성하세요.

12. **빌드합니다:**

📍 **실행 위치: 로컬 PC** (프로젝트 루트 터미널에서 실행)

**Mac/Linux:**

```bash
./gradlew build -x test
```

**Windows (PowerShell):**

```powershell
gradlew.bat build -x test
```

> [!OUTPUT]
>
> ```
> BUILD SUCCESSFUL in xxs
> ```
>
> 빌드된 WAR 파일: `build/libs/backend-1.0-SNAPSHOT.war`

> [!TIP]
> `-x test`는 테스트를 건너뛰는 옵션입니다. DB 연결이 로컬에서 안 되는 경우 테스트가 실패하므로 생략합니다.
>
> **빌드 결과 파일명 확인:**  
> 프로젝트마다 WAR 파일명이 다릅니다. `ls build/libs/`로 실제 파일명을 확인하세요.  
> 태스크 3에서 SCP 전송 시 이 파일명을 사용합니다.

---

✅ **태스크 완료**: 애플리케이션이 빌드되었습니다.

## 태스크 3: SCP로 파일 전송

📍 **실행 위치: 로컬 PC** (EC2가 아닌 본인 컴퓨터의 터미널에서 실행합니다)

16. 빌드된 파일을 SCP로 EC2에 전송합니다. 본인의 방법에 맞는 명령어를 실행하세요:

> [!WARNING]
> 아래 명령어에서 다음 부분을 **반드시 본인 환경에 맞게 변경**하세요:
>
> | 변경할 부분                          | 설명                       | 예시                         |
> | ------------------------------------ | -------------------------- | ---------------------------- |
> | `~/Downloads/my-keypair.pem`         | 키 파일 경로               | `~/.ssh/my-keypair.pem`      |
> | `build/libs/demo-0.0.1-SNAPSHOT.jar` | 빌드 결과물 경로 및 파일명 | `build/libs/myapp-0.0.1.jar` |
> | `<Public-IP>`                        | EC2의 Public IP            | `3.35.123.456`               |
>
> 빌드 결과 파일명은 `ls build/libs/` (Mac) 또는 `dir build\libs\` (Windows)로 확인하세요.

---

**방법 A (JAR) — Mac/Linux:**

```bash
scp -i ~/Downloads/my-keypair.pem build/libs/demo-0.0.1-SNAPSHOT.jar ec2-user@<Public-IP>:~/app.jar
```

**방법 A (JAR) — Windows (PowerShell):**

```powershell
scp -i C:\Users\<사용자명>\Downloads\my-keypair.pem build\libs\demo-0.0.1-SNAPSHOT.jar ec2-user@<Public-IP>:~/app.jar
```

---

**방법 B (WAR) — Mac/Linux:**

```bash
scp -i ~/Downloads/my-keypair.pem build/libs/backend-1.0-SNAPSHOT.war ec2-user@<Public-IP>:~/app.war
```

**방법 B (WAR) — Windows (PowerShell):**

```powershell
scp -i C:\Users\<사용자명>\Downloads\my-keypair.pem build\libs\backend-1.0-SNAPSHOT.war ec2-user@<Public-IP>:~/app.war
```

> [!TIP]
>
> - 파일명을 `app.jar` 또는 `app.war`로 변경하여 전송하면 이후 단계에서 경로를 통일할 수 있습니다.
> - **Windows MobaXterm 사용자**: 왼쪽 파일 브라우저에서 EC2의 홈 디렉토리(`/home/ec2-user`)가 보입니다. 로컬의 JAR/WAR 파일을 드래그 앤 드롭으로 업로드할 수 있습니다.  
>   업로드 후 EC2 터미널에서 `mv <파일명> ~/app.jar`로 이름을 변경하세요.

17. EC2에 접속하여 파일이 전송되었는지 확인합니다:

📍 **실행 위치: EC2**(SSH 접속한 상태에서 진행합니다.)

```bash
ls -la ~/app.*
```

> [!OUTPUT]
>
> ```
> -rw-r--r--. 1 ec2-user ec2-user  xxxx  ...  /home/ec2-user/app.jar
> ```
>
> 파일 크기가 0이 아니고, JAR은 보통 20~50MB, WAR은 수 MB 이상이면 정상입니다.

> [!TROUBLESHOOTING]
> **SCP 전송 실패 시:**
>
> | 증상                                     | 원인                     | 해결 방법                                               |
> | ---------------------------------------- | ------------------------ | ------------------------------------------------------- |
> | `Permission denied (publickey)`          | 키 파일 경로가 잘못됨    | SSH 접속에 사용한 것과 동일한 `.pem` 파일인지 확인      |
> | `Connection timed out`                   | SG에 SSH(22) 포트 미허용 | Security Group Inbound rules에 SSH(22) 확인             |
> | `No such file or directory`              | 빌드 파일 경로 오류      | `ls build/libs/`로 실제 파일명 확인 후 정확한 경로 사용 |
> | `WARNING: UNPROTECTED PRIVATE KEY FILE!` | 키 파일 권한 문제        | Mac/Linux: `chmod 400 my-keypair.pem`                   |

✅ **태스크 완료**: 파일이 EC2에 전송되었습니다.

## 태스크 4: 애플리케이션 배포 및 실행

📍 **실행 위치: EC2** (SSH 접속한 상태에서 진행합니다)

본인 프로젝트에 맞는 방법을 선택합니다.

---

### 방법 A: Spring Boot (JAR) 배포

18. 애플리케이션 디렉토리를 생성하고 JAR 파일을 이동합니다:

```bash
sudo mkdir -p /opt/app
sudo mv ~/app.jar /opt/app/app.jar
sudo chown ec2-user:ec2-user /opt/app/app.jar
```

19. 직접 실행하여 정상 동작을 확인합니다:

```bash
java -jar /opt/app/app.jar
```

> [!OUTPUT]
>
> ```
>   .   ____          _            __ _ _
>  /\\ / ___'_ __ _ _(_)_ __  __ _ \ \ \ \
> ( ( )\___ | '_ | '_| | '_ \/ _` | \ \ \ \
>  \\/  ___)| |_)| | | | | || (_| |  ) ) ) )
>   '  |____| .__|_| |_|_| |_\__, | / / / /
>  =========|_|==============|___/=/_/_/_/
>  :: Spring Boot ::                (v3.x.x)
>
> ... Started DemoApplication in x.xxx seconds
> ```

> [!NOTE]
> Spring Boot가 시작되면 `Started ... in x.xxx seconds` 메시지가 나타납니다.  
> 에러 없이 이 메시지가 보이면 정상입니다. 시작까지 20~40초 정도 걸릴 수 있습니다(t3.micro 기준).

> [!TROUBLESHOOTING]
> **`java -jar` 실행 시 문제:**
>
> | 증상                                    | 원인                             | 해결 방법                                          |
> | --------------------------------------- | -------------------------------- | -------------------------------------------------- |
> | `Error: Unable to access jarfile`       | JAR 파일 경로 오류               | `ls /opt/app/app.jar`로 파일 존재 확인             |
> | `Address already in use: 8080`          | 다른 프로세스가 포트 점유        | `sudo ss -tlnp \| grep 8080`로 확인 후 종료        |
> | `java.lang.OutOfMemoryError`            | 메모리 부족                      | Swap 추가 (태스크 1 참조) 또는 인스턴스 업그레이드 |
> | `Communications link failure` (DB 에러) | MySQL 미실행 또는 접속 정보 오류 | `sudo systemctl status mysqld` 확인                |
> | 시작 후 바로 종료 (에러 로그 출력)      | 설정 파일 오류                   | 출력된 에러 메시지에서 원인 확인                   |

20. **새 터미널을 열어** EC2에 다시 접속하고 테스트합니다:

> [!TIP]
> `java -jar`를 실행한 터미널은 Spring이 점유하고 있어 다른 명령을 입력할 수 없습니다.  
> **새 터미널 창/탭을 열어** 같은 EC2에 SSH로 다시 접속하세요:
>
> ```bash
> ssh -i ~/Downloads/my-keypair.pem ec2-user@<Public-IP>
> ```

```bash
curl http://localhost:8080
curl http://localhost:8080/api/health
```

21. 확인 후 `java -jar`를 실행한 터미널에서 **Ctrl+C**를 눌러 Spring 애플리케이션을 종료합니다.

22. **systemd 서비스로 등록합니다:**

```bash
sudo tee /etc/systemd/system/spring-app.service << 'EOF'
[Unit]
Description=Spring Boot Application
After=network.target

[Service]
Type=simple
User=ec2-user
Group=ec2-user
ExecStart=/usr/bin/java -jar /opt/app/app.jar --server.port=8080
WorkingDirectory=/opt/app
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=spring-app
Environment=SPRING_PROFILES_ACTIVE=prod
Environment=JAVA_OPTS=-Xms256m -Xmx512m

[Install]
WantedBy=multi-user.target
EOF
```

23. 서비스를 시작합니다:

```bash
sudo systemctl daemon-reload
sudo systemctl start spring-app
sudo systemctl enable spring-app
sudo systemctl status spring-app
```

> [!TIP]
> `status` 명령 실행 후 화면 하단에 `(END)`가 표시되면 **`q`를 눌러 빠져나오세요** (페이저 종료).

방법 A를 완료했다면 **태스크 5**로 이동하세요.

---

### 방법 B: Spring MVC (WAR + Tomcat) 배포

#### B-1. Tomcat 9 설치

📍 **실행 위치: EC2** (SSH 접속한 상태)

18. Tomcat 9을 다운로드하고 설치합니다:

```bash
sudo dnf install -y wget
wget https://archive.apache.org/dist/tomcat/tomcat-9/v9.0.106/bin/apache-tomcat-9.0.106.tar.gz
sudo mkdir -p /opt/tomcat
sudo tar -xzf apache-tomcat-9.0.106.tar.gz -C /opt/tomcat --strip-components=1
sudo chown -R ec2-user:ec2-user /opt/tomcat
```

> [!NOTE]
> Spring MVC 5.x + javax.servlet은 **Tomcat 9**을 사용합니다.  
> Spring 6.x + jakarta.servlet을 사용하는 프로젝트는 Tomcat 10 이상이 필요합니다.
>
> | Spring 버전 | Servlet API           | Tomcat 버전 |
> | ----------- | --------------------- | ----------- |
> | Spring 5.x  | javax.servlet (4.0)   | Tomcat 9    |
> | Spring 6.x  | jakarta.servlet (6.0) | Tomcat 10+  |

19. Tomcat 실행 권한을 설정합니다:

```bash
chmod +x /opt/tomcat/bin/*.sh
```

20. Tomcat을 시작하여 정상 동작을 확인합니다:

```bash
/opt/tomcat/bin/startup.sh
```

21. 브라우저에서 `http://<Public-IP>:8080`으로 접속하여 Tomcat 기본 페이지가 표시되는지 확인합니다.

> [!TIP]
> **페이지가 안 뜨는 경우 확인 순서:**
>
> 1. EC2 내부에서 먼저 확인: `curl http://localhost:8080` (정상이면 Tomcat은 OK)
> 2. Security Group에 8080 포트 열려 있는지 확인 (태스크 0 참조)
> 3. 브라우저가 `https://`로 자동 전환하는지 확인 → 시크릿 모드로 재시도

22. 확인 후 Tomcat을 중지합니다:

```bash
/opt/tomcat/bin/shutdown.sh
```

#### B-2. DB 스키마 생성

프로젝트가 MySQL을 사용하는 경우, Step 2-1에서 설치한 MySQL에 스키마를 생성합니다.

> [!NOTE]
> **사전 확인**: Step 2-1에서 MySQL을 같은 EC2에 설치했다면, `localhost:3306`으로 접속됩니다.  
> MySQL이 실행 중인지 먼저 확인하세요:
>
> ```bash
> sudo systemctl status mysqld
> ```
>
> `Active: active (running)`이면 정상입니다.  
> `inactive` 또는 `dead`이면 `sudo systemctl start mysqld`로 시작하세요.

23. SQL 파일을 EC2에 전송합니다:

📍 **실행 위치: 로컬 PC**

**Mac/Linux:**

```bash
scp -i ~/Downloads/my-keypair.pem *.sql ec2-user@<Public-IP>:~/
```

**Windows (PowerShell):**

```powershell
scp -i C:\Users\<사용자명>\Downloads\my-keypair.pem *.sql ec2-user@<Public-IP>:~/
```

> [!TIP]
> SQL 파일이 여러 개이고 경로가 다른 경우, 파일을 하나씩 지정하세요:
>
> ```bash
> scp -i ~/Downloads/my-keypair.pem ./sql/board.sql ./sql/member.sql ec2-user@<Public-IP>:~/
> ```

24. EC2에서 MySQL에 접속하여 SQL을 실행합니다:

📍 **실행 위치: EC2**

```bash
mysql -u root -p < ~/board.sql
mysql -u root -p < ~/member.sql
```

> [!NOTE]
> `-p` 뒤에 비밀번호를 입력하라는 프롬프트가 나타납니다.  
> **Step 2-1 태스크 5에서 설정한 root 비밀번호**를 입력하세요 (예: `MyPass123!`).  
> 비밀번호는 화면에 표시되지 않으니 정확히 입력 후 엔터를 누릅니다.
>
> `board.sql`은 데이터베이스(`scoula_db`)와 사용자(`scoula`)를 자동 생성합니다.  
> 이미 존재하는 경우 에러가 날 수 있으므로, `CREATE DATABASE IF NOT EXISTS`로 변경하거나 에러를 무시합니다.

> [!TROUBLESHOOTING]
> **SQL 실행 실패 시:**
>
> | 증상                             | 원인                          | 해결 방법                                                        |
> | -------------------------------- | ----------------------------- | ---------------------------------------------------------------- |
> | `Access denied for user 'root'`  | 비밀번호 오류                 | Step 2-1에서 설정한 비밀번호 확인. 분실 시 MySQL 비밀번호 재설정 |
> | `Can't connect to local MySQL`   | MySQL 미실행                  | `sudo systemctl start mysqld`                                    |
> | `ERROR 1007: Database exists`    | DB가 이미 생성됨              | 무시해도 됨. 또는 `DROP DATABASE`후 재실행                       |
> | SQL 파일이 없음 (`No such file`) | SCP 전송 안 됨 또는 경로 오류 | `ls ~/` 로 파일 존재 확인                                        |
>
> **SQL 파일이 없는 경우** (프로젝트에 DDL 스크립트가 따로 없는 경우):  
> MySQL에 직접 접속하여 수동으로 생성합니다:
>
> ```bash
> mysql -u root -p
> ```
>
> ```sql
> CREATE DATABASE IF NOT EXISTS scoula_db DEFAULT CHARACTER SET utf8mb4;
> CREATE USER IF NOT EXISTS 'scoula'@'%' IDENTIFIED BY 'Scoula123!';
> GRANT ALL PRIVILEGES ON scoula_db.* TO 'scoula'@'%';
> FLUSH PRIVILEGES;
> EXIT;
> ```

> [!TIP]
> **프로젝트에 초기 데이터용 CSV 파일이 있는 경우:**
>
> 📍 로컬에서 SQL + CSV 파일을 EC2에 전송:
>
> ```bash
> scp -i ~/Downloads/my-keypair.pem travel.sql travel.csv travel_image.csv ec2-user@<Public-IP>:~/
> ```
>
> 📍 EC2에서 아래 순서대로 실행:
>
> ```bash
> # ① local_infile 허용 (MySQL 8.4 기본값이 OFF이므로 필수)
> mysql -u root -p -e "SET GLOBAL local_infile = 1;"
>
> # ② 테이블 생성
> mysql -u scoula -p'Scoula123!' scoula_db < ~/travel.sql
>
> # ③ CSV 데이터 import
> mysql -u scoula -p'Scoula123!' --local-infile=1 scoula_db -e "
>   LOAD DATA LOCAL INFILE '/home/ec2-user/travel.csv'
>   INTO TABLE tbl_travel
>   FIELDS TERMINATED BY ',' ENCLOSED BY '\"'
>   LINES TERMINATED BY '\n'
>   IGNORE 1 ROWS (no, district, title, description, address, phone);"
>
> mysql -u scoula -p'Scoula123!' --local-infile=1 scoula_db -e "
>   LOAD DATA LOCAL INFILE '/home/ec2-user/travel_image.csv'
>   INTO TABLE tbl_travel_image
>   FIELDS TERMINATED BY ','
>   LINES TERMINATED BY '\n'
>   IGNORE 1 ROWS (filename, travel_no);"
>
> # ④ 확인
> mysql -u scoula -p'Scoula123!' scoula_db -e "SELECT COUNT(*) FROM tbl_travel;"
> mysql -u scoula -p'Scoula123!' scoula_db -e "SELECT COUNT(*) FROM tbl_travel_image;"
> ```

#### B-3. WAR 배포

25. 기존 기본 앱을 정리하고 WAR 파일을 배포합니다:

```bash
# 기본 ROOT 앱 제거
rm -rf /opt/tomcat/webapps/ROOT

# WAR를 ROOT.war로 배포 (루트 경로에서 서빙)
cp ~/app.war /opt/tomcat/webapps/ROOT.war
```

> [!NOTE]
> WAR 파일명이 컨텍스트 경로를 결정합니다:
>
> | WAR 파일명    | 접속 경로                   |
> | ------------- | --------------------------- |
> | `ROOT.war`    | `http://host:8080/`         |
> | `app.war`     | `http://host:8080/app/`     |
> | `backend.war` | `http://host:8080/backend/` |
>
> `ROOT.war`로 배포하면 루트(`/`)에서 바로 접근 가능합니다.

26. (옵션) 프로젝트에 파일 업로드 기능이 있는 경우, 업로드 디렉토리를 생성합니다:

```bash
sudo mkdir -p /tmp/upload
sudo chown ec2-user:ec2-user /tmp/upload
```

#### B-4. Tomcat systemd 서비스 등록

27. systemd 서비스 파일을 생성합니다:

```bash
sudo tee /etc/systemd/system/tomcat.service << 'EOF'
[Unit]
Description=Apache Tomcat 9
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
```

28. 서비스를 시작합니다:

```bash
sudo systemctl daemon-reload
sudo systemctl start tomcat
sudo systemctl enable tomcat
sudo systemctl status tomcat
```

> [!TIP]
> `status` 명령 실행 후 화면 하단에 `(END)`가 표시되면 **`q`를 눌러 빠져나오세요** (페이저 종료).

29. 동작을 확인합니다:

```bash
# Tomcat 로그에서 배포 상태 확인
tail -30 /opt/tomcat/logs/catalina.out

# API 테스트
curl http://localhost:8080/api/board
```

> [!OUTPUT]
> WAR가 정상 배포되면 로그에 다음과 유사한 메시지가 나타납니다:
>
> ```
> INFO [main] org.apache.catalina.startup.Catalina.start Server startup in [xxxx] milliseconds
> ```

> [!TROUBLESHOOTING]
> **WAR 배포 실패 시:**
>
> ```bash
> # Tomcat 로그 확인
> tail -50 /opt/tomcat/logs/catalina.out
> ```
>
> | 증상                                         | 원인                         | 해결 방법                              |
> | -------------------------------------------- | ---------------------------- | -------------------------------------- |
> | `ClassNotFoundException: javax.servlet`      | Tomcat 버전 불일치           | Spring 5.x → Tomcat 9 사용             |
> | `Communications link failure`                | MySQL 접속 불가              | `application.properties`의 DB URL 확인 |
> | `java.io.FileNotFoundException: /tmp/upload` | 업로드 디렉토리 없음         | `sudo mkdir -p /tmp/upload`            |
> | `Address already in use: 8080`               | 다른 프로세스가 포트 사용 중 | `sudo ss -tlnp \| grep 8080`           |

---

✅ **태스크 완료**: 애플리케이션이 배포되었습니다.

## 태스크 5: 로그 확인

📍 **실행 위치: EC2**

배포한 애플리케이션에 문제가 발생하면 로그를 확인해야 합니다.  
본인의 방법에 맞는 로그 확인 명령어를 실행해 보세요.

### 방법 A (Boot) — journalctl

24. 실시간 로그를 확인합니다:

```bash
sudo journalctl -u spring-app -f
```

> [!TIP]
> `-f`는 실시간으로 새 로그가 추가될 때마다 출력합니다.  
> 이 상태에서 **다른 터미널 탭을 열거나 브라우저에서 `http://<Public-IP>:8080`에 접속**해 보세요.
>
> **요청 로그가 안 보이는 경우:**  
> Spring Boot는 기본 로그 레벨에서 일반 HTTP 요청 로그를 출력하지 않습니다.  
> 요청 로그를 보려면 `src/main/resources/application.properties`에 다음을 추가하고 재빌드·재배포하세요:
>
> ```properties
> logging.level.org.springframework.web=DEBUG
> ```
>
> 또는 존재하지 않는 경로(예: `http://<Public-IP>:8080/asdf`)에 접속하면 에러 로그가 출력됩니다.
>
> 확인이 끝나면 **Ctrl+C**로 빠져나옵니다.

25. 최근 로그를 확인합니다 (필요 시):

```bash
# 최근 50줄
sudo journalctl -u spring-app -n 50

# 오늘 로그만
sudo journalctl -u spring-app --since today

# 에러만
sudo journalctl -u spring-app -p err
```

### 방법 B (Tomcat) — catalina.out

24. 실시간 로그를 확인합니다:

```bash
tail -f /opt/tomcat/logs/catalina.out
```

> [!TIP]
> `tail -f`는 파일 끝을 실시간 감시합니다.  
> 이 상태에서 **다른 터미널 탭을 열거나 브라우저에서 `http://<Public-IP>:8080`에 접속**해 보세요.  
> 요청이 들어올 때마다 로그가 실시간으로 출력되는 것을 확인할 수 있습니다.  
> 확인이 끝나면 **Ctrl+C**로 빠져나옵니다.

25. 에러를 검색합니다 (필요 시):

```bash
# 최근 50줄
tail -50 /opt/tomcat/logs/catalina.out

# 에러 검색
grep -i "error\|exception" /opt/tomcat/logs/catalina.out | tail -20
```

### 서비스 관리 명령어 (참고)

서비스를 중지/재시작해야 할 때 사용합니다:

```bash
# 방법 A (Boot)
sudo systemctl stop spring-app       # 중지
sudo systemctl restart spring-app    # 재시작
sudo systemctl status spring-app     # 상태 확인

# 방법 B (Tomcat)
sudo systemctl stop tomcat           # 중지
sudo systemctl restart tomcat        # 재시작
sudo systemctl status tomcat         # 상태 확인
```

> [!NOTE]
> 코드를 수정하고 재배포할 때는 `stop` → 파일 교체 → `start` 순서로 진행합니다.  
> `restart`는 실행 중인 상태에서 한 번에 중지+시작을 수행합니다.

✅ **태스크 완료**: 로그 확인 방법을 학습했습니다.

## 태스크 6: 자동 재시작 테스트

📍 **실행 위치: EC2**

systemd의 `Restart=on-failure` 설정이 정상 동작하는지 확인합니다.  
프로세스를 강제로 종료하면 systemd가 자동으로 다시 시작하는지 테스트합니다.

**방법 A (Boot):**

26. 프로세스를 강제 종료합니다:

```bash
sudo kill -9 $(pgrep -f "app.jar")
```

27. 12초 후 자동 재시작되었는지 확인합니다:

```bash
sleep 12
sudo systemctl status spring-app
curl http://localhost:8080
```

**방법 B (Tomcat):**

26. 프로세스를 강제 종료합니다:

```bash
sudo kill -9 $(pgrep -f "catalina")
```

27. 12초 후 자동 재시작되었는지 확인합니다:

```bash
sleep 12
sudo systemctl status tomcat
curl http://localhost:8080/api/board
```

> [!OUTPUT]
> `sudo systemctl status`에서 `active (running)` 상태로 복구되어 있어야 합니다.  
> `curl` 응답이 정상이면 자동 재시작 성공입니다.  
> `RestartSec=10` 설정에 의해 종료 후 약 10초 뒤 자동 재시작됩니다.

> [!NOTE]
> **왜 이 테스트가 중요한가요?**  
> 프로덕션에서 애플리케이션이 메모리 부족(OOM), 예외 등으로 갑자기 종료될 수 있습니다.  
> systemd 서비스로 등록해두면 자동으로 복구되어 수동 개입 없이 서비스가 유지됩니다.

✅ **태스크 완료**: 자동 재시작이 정상 동작합니다.

## 태스크 7: Nginx 리버스 프록시 (프론트엔드 연동)

> [!NOTE]
> Step 2-2에서 Nginx + Vue 앱을 배포한 경우, 여기서 백엔드 API를 연결합니다.  
> Step 2-2를 건너뛴 경우 이 태스크는 선택사항입니다.

Step 2-2에서 Nginx는 프론트엔드(Vue) 정적 파일을 서빙하고 있습니다.  
프론트엔드에서 `/api`로 시작하는 요청을 백엔드(8080)로 전달하도록 리버스 프록시를 설정합니다.

```
[브라우저]
    │
    ├── /           → Nginx → Vue 앱 (정적 파일)
    ├── /about      → Nginx → Vue 앱 (SPA try_files)
    └── /api/**     → Nginx → Spring (8080) (리버스 프록시)
```

📍 **실행 위치: EC2** (SSH 접속한 상태)

30. Nginx 설정 파일을 수정합니다:

> [!NOTE]
> 기존 `vue-app.conf` 파일의 **전체 내용을 아래로 교체**합니다.  
> 기존 내용(SPA 라우팅 + 정적 파일 캐싱)은 유지하면서, `location /api/` 블록이 추가된 버전입니다.

```bash
sudo vi /etc/nginx/conf.d/vue-app.conf
```

> [!TIP]
> **vi 에디터 사용법** (상세 설명은 [Step 2-2 태스크 6](/week/2/session/2) 참조):
>
> - 기존 내용 전체 삭제: `Esc` → `gg` → `dG` (파일 전체 삭제)
> - 입력 모드 전환: `i`
> - 아래 내용 붙여넣기: Mac `Cmd+V` / Windows 터미널 우클릭 또는 `Shift+Insert`
> - 저장 후 종료: `Esc` → `:wq` → `엔터`
> - 실수 시 저장하지 않고 종료: `Esc` → `:q!` → `엔터`

31. 아래 내용을 **전체 교체**합니다 (기존 내용 삭제 후 붙여넣기):

```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # SPA 라우팅
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API 리버스 프록시 → Spring (8080)
    location /api/ {
        proxy_pass http://localhost:8080/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_read_timeout 60s;
    }

    # 정적 파일 캐싱
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # gzip 압축
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;
    gzip_min_length 1000;
}
```

32. 설정을 검증하고 Nginx를 재시작합니다:

```bash
sudo nginx -t
sudo systemctl restart nginx
```

33. 브라우저에서 테스트합니다:

📍 **실행 위치: 로컬 PC (브라우저)**

프록시 설정이 정상 동작하는지 확인합니다. **80 포트(Nginx)를 통해** API 요청이 백엔드까지 전달되면 성공입니다.

    - `http://<Public-IP>` → Vue 앱 (프론트엔드 정상 표시)
    - `http://<Public-IP>/api/health` → `OK` 응답 (방법 A — 새 프로젝트)
    - `http://<Public-IP>/api/board` → JSON 응답 (방법 B — 기존 프로젝트)

> [!NOTE]
> 본인 프로젝트에 맞는 API 경로로 테스트하세요.  
> 핵심은 **브라우저에서 80 포트로 접속했을 때 `/api/*` 요청이 Spring(8080)으로 전달되는지** 확인하는 것입니다.  
> JSON 응답이 돌아오면 프록시 성공, HTML이 돌아오면(Vue 앱 화면) 프록시 설정이 안 된 것입니다.

> [!WARNING]
> **브라우저에서 접속이 안 되는 경우:**
>
> EC2 내부에서 Nginx 프록시 경유로 정상 동작하는지 확인하세요:
>
> ```bash
> # Nginx(80)를 경유하여 백엔드에 도달하는지 확인
> curl http://localhost/api/board        # 방법 B (기존 프로젝트)
> curl http://localhost/api/health       # 방법 A (새 프로젝트)
> ```
>
> - **JSON 응답이 돌아오면**: Nginx 프록시 정상. 브라우저 문제(HTTPS 자동 전환 등) 확인
> - **HTML이 돌아오면 (Vue 앱)**: 프록시 설정이 안 됨. `vue-app.conf`에 `location /api/` 블록 확인
> - **`502 Bad Gateway`**: Spring/Tomcat 서비스가 중지됨. `sudo systemctl status spring-app` (또는 `tomcat`) 확인
> - **`Connection refused`**: Nginx 미실행. `sudo systemctl start nginx`
>
> **브라우저가 `https://`로 자동 전환되는 경우:**
>
> EC2에 HTTPS 설정이 없으면 `ERR_CONNECTION_REFUSED`가 발생합니다.
>
> - **해결 1**: 시크릿/프라이빗 모드(Ctrl+Shift+N)로 `http://IP주소` 접속
> - **해결 2**: Chrome → `chrome://net-internals/#hsts` → 하단 "Delete domain security policies"에 IP 입력 후 Delete

> [!NOTE]
> 이제 프론트엔드(Vue)와 백엔드(Spring)가 같은 도메인(80 포트)에서 동작합니다.  
> 프론트엔드의 API 호출(`/api/board` 등)이 Nginx를 통해 백엔드로 전달됩니다.
>
> 이 구조의 장점:
>
> - CORS 문제 없음 (같은 origin)
> - 프론트엔드와 백엔드를 독립적으로 업데이트 가능
> - 외부에 8080 포트를 노출하지 않아도 됨

> [!TIP]
> 리버스 프록시 설정 후 Security Group에서 8080 포트를 제거해도 됩니다.  
> 외부에서는 80 포트(Nginx)로만 접속하고, 백엔드는 내부에서만 접근합니다.

> [!CONCEPT] vite.config.js의 proxy vs Nginx의 proxy_pass
>
> 둘 다 `/api` 요청을 백엔드로 전달하는 역할이지만, **동작하는 시점과 환경이 다릅니다:**
>
> | 항목          | vite.config.js `proxy`             | Nginx `proxy_pass`       |
> | ------------- | ---------------------------------- | ------------------------ |
> | **동작 시점** | 개발 모드 (`npm run dev`)에서만    | 프로덕션 배포 후 항상    |
> | **동작 위치** | 로컬 PC (Vite 개발 서버)           | EC2 서버 (Nginx)         |
> | **빌드 후**   | ❌ 사라짐 (정적 파일에 포함 안 됨) | ✅ 계속 동작             |
> | **용도**      | 로컬 개발 시 CORS 우회             | 운영 환경에서 API 라우팅 |
>
> ```
> 개발 환경 (로컬):
> [브라우저] → [Vite 개발 서버 :5173] → /api/* → proxy → [Spring :8080]
>                                       → 그 외 → Vue 소스 서빙
>
> 운영 환경 (EC2):
> [브라우저] → [Nginx :80] → /api/* → proxy_pass → [Spring/Tomcat :8080]
>                           → 그 외 → Vue 빌드 파일 (dist/) 서빙
> ```
>
> **핵심:** `npm run build`로 빌드하면 Vite proxy 설정은 결과물에 포함되지 않습니다.  
> 따라서 프로덕션에서는 반드시 Nginx(또는 다른 웹서버)에서 프록시를 설정해야 합니다.
>
> `vite.config.js`의 proxy와 Nginx의 proxy_pass 경로를 **동일하게 ** 맞춰두면,  
> 프론트엔드 코드의 API URL(`/api/board`)을 환경에 따라 변경할 필요 없이 그대로 사용할 수 있습니다.

✅ **태스크 완료**: Nginx 리버스 프록시로 프론트엔드와 백엔드가 연결되었습니다.

## 마무리

다음을 성공적으로 수행했습니다:

- EC2에 Amazon Corretto 17(Java 17)을 설치했습니다.
- Spring Boot JAR 또는 Spring MVC WAR를 빌드하고 EC2에 전송했습니다.
- systemd 서비스로 등록하여 자동 시작/재시작을 설정했습니다.
- journalctl 또는 catalina.out으로 로그를 확인했습니다.
- Nginx 리버스 프록시로 프론트엔드와 백엔드를 연결했습니다.

---

## Step 2 전체 아키텍처 정리

Step 2-1 ~ 2-3을 통해 **하나의 EC2 인스턴스에 3개의 서버**를 동작시키는 구조를 완성했습니다.  
이것이 가장 기본적인 IaaS 배포 형태입니다.

```
┌──────────────────────────────────────────────────────────────────┐
│  EC2 인스턴스 (Amazon Linux 2023, t3.micro)                      │
│                                                                  │
│  ┌─────────────────────┐                                         │
│  │  Nginx (:80)        │ ← 브라우저 요청 진입점                  │
│  │                     │                                         │
│  │  /              → Vue 빌드 파일 (정적 파일 서빙)              │
│  │  /about, /board → try_files → index.html (SPA 라우팅)         │
│  │  /api/*         → proxy_pass → localhost:8080 (리버스 프록시) │
│  └────────┬────────────┘                                         │
│           │                                                      │
│           ▼                                                      │
│  ┌─────────────────────┐                                         │
│  │  Spring (:8080)     │ ← REST API 처리                         │
│  │  (Tomcat 내장/외장) │                                         │
│  │                     │                                         │
│  │  /api/board     → 게시판 CRUD                                 │
│  │  /api/auth      → 로그인/인증 (JWT)                           │
│  │  /api/member    → 회원 관리                                   │
│  └────────┬────────────┘                                         │
│           │                                                      │
│           ▼                                                      │
│  ┌────────────────────┐                                          │
│  │  MySQL (:3306)     │ ← 데이터 저장                            │
│  │                    │                                          │
│  │  scoula_db      → 게시판, 회원, 여행지 데이터                 │
│  └────────────────────┘                                          │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 이 구조의 특징

| 항목      | 현재 (Step 2)           | 프로덕션에서의 문제점            |
| --------- | ----------------------- | -------------------------------- |
| 서버 수   | EC2 1대에 모두 설치     | 하나가 죽으면 전체 서비스 중단   |
| DB        | EC2에 직접 설치         | 백업/복구/패치를 직접 해야 함    |
| 스케일링  | 불가 (서버 1대 고정)    | 트래픽 증가 시 대응 불가         |
| 보안      | 모든 것이 Public Subnet | DB가 외부에 노출될 위험          |
| 배포      | SCP + systemctl 수동    | 무중단 배포 불가, 휴먼 에러 발생 |
| 정적 파일 | EC2에서 직접 서빙       | CDN 없이 글로벌 성능 저하        |
| 비밀정보  | properties에 평문 저장  | 소스코드에 비밀번호 노출         |

### 이후 Step에서 개선하는 방향

| Step                 | 개선 내용                                         |
| -------------------- | ------------------------------------------------- |
| **Step 3 (NAT)**     | Private Subnet에 서버 배치, 외부 노출 최소화      |
| **Step 4 (RDS)**     | DB를 관리형 서비스로 분리 (자동 백업, Multi-AZ)   |
| **Step 5 (S3)**      | 정적 파일/이미지를 S3 + CloudFront로 분리         |
| **Step 6 (Secrets)** | DB 비밀번호 등을 Secrets Manager로 안전하게 관리  |
| **Step 7 (Domain)**  | 도메인 + HTTPS(ACM) 적용                          |
| **Step 8 (CI/CD)**   | GitHub Actions로 빌드·배포 자동화                 |
| **Step 9 (3-Tier)**  | 프론트/백엔드/DB를 각각 독립 서버로 분리 (3-Tier) |

> [!CONCEPT] 왜 이 구조부터 시작하는가?
>
> 프로덕션에서는 이렇게 배포하지 않습니다. 하지만 **기초를 먼저 이해해야 개선할 수 있습니다.**
>
> - SSH로 서버에 접속해서 소프트웨어를 설치하는 경험 → IaaS의 본질 이해
> - 수동 배포의 불편함을 체감 → CI/CD 자동화의 필요성 체감
> - 하나의 서버에 모든 것을 넣었을 때의 한계 → 서비스 분리(3-Tier)의 이유 이해
> - DB를 직접 관리하는 부담 → 관리형 서비스(RDS)의 가치 체감
>
> Step 2는 "이렇게 하면 동작은 하지만 이런 문제가 있다"를 경험하는 단계이고, 이후 Step에서 하나씩 개선해 나갑니다.

---

## 다음 단계: Step 8 (CI/CD)에서의 자동화

이 실습에서는 수동으로 빌드 → SCP 전송 → 배포를 진행했습니다.  
Step 8에서는 GitHub Actions를 사용하여 `git push`만으로 빌드·배포가 자동으로 실행되도록 구성합니다.

---

# 🗑️ 리소스 정리

> [!WARNING]
> Step 2 실습이 모두 끝났습니다. **반드시** 리소스를 정리하여 불필요한 비용을 방지합니다.  
> EC2 인스턴스는 실행 중일 때 시간당 과금되며, 중지(Stop) 상태에서도 EBS 볼륨 비용이 발생합니다.  
> 이후 Step에서는 새로운 인프라를 구성하므로, 여기서 만든 EC2를 유지할 필요가 없습니다.

---

#### 단계 1: Tag Editor로 생성된 리소스 확인

삭제 전에 이 실습에서 생성한 리소스를 확인합니다.

1. AWS Management Console 상단 검색창에 `Resource Groups & Tag Editor`를 입력하고 선택합니다.
2. 왼쪽 메뉴에서 **Tag Editor**를 선택합니다.
3. 다음과 같이 설정합니다:
   - **Regions**: `ap-northeast-2`
   - **Resource types**: `All supported resource types`
   - **Tag key**: `Step`
   - **Tag value**: `step2`
4. [[Search resources]] 버튼을 클릭합니다.
5. Step 2에서 생성한 리소스 목록이 표시되는지 확인합니다.

> [!TIP]
> Tag Editor는 리소스를 찾는 용도로만 사용합니다. 실제 삭제는 다음 단계에서 수행합니다.

#### 단계 2: EC2 인스턴스 종료 (Terminate)

> [!WARNING]
> Terminate하면 인스턴스와 연결된 EBS 볼륨이 함께 삭제됩니다.  
> MySQL 데이터, 배포한 애플리케이션(Spring, Nginx), 모든 설정이 삭제됩니다.  
> **이 작업은 되돌릴 수 없습니다.**

6. EC2 콘솔 → **Instances**에서 `my-ec2-mysql` 인스턴스를 체크합니다.
7. 상단 **Instance state** → **Terminate(delete) instance**를 클릭합니다.
8. 확인 팝업이 표시됩니다:
   - **Termination protection**: `Disabled` (정상)
   - **Skip OS shutdown**: 체크하지 않음 (기본값 유지)
9. [[Terminate (delete)]] 버튼을 클릭합니다.
10. Instance state가 `Shutting down` → `Terminated`로 변경되는 것을 확인합니다.

> [!NOTE]
> Terminated 상태의 인스턴스는 약 1시간 후 콘솔 목록에서 자동으로 사라집니다.

#### 단계 3: IAM Role 삭제 (선택사항)

> [!NOTE]
> IAM Role은 비용이 발생하지 않으므로 삭제하지 않아도 됩니다.  
> 리소스 정리를 깔끔하게 하고 싶다면 삭제하세요.

11. 상단 검색창에 `IAM`을 입력하고 선택합니다.
12. 왼쪽 메뉴에서 **Roles**를 클릭합니다.
13. 검색창에 `my-ec2-ssm-role`을 입력하여 찾습니다.
14. 해당 Role을 선택하고 [[Delete]] 버튼을 클릭합니다.
15. 확인을 위해 Role 이름(`my-ec2-ssm-role`)을 입력하고 [[Delete]] 클릭합니다.

#### 단계 4: CloudFormation 스택 삭제

Step 2-1 태스크 0에서 CloudFormation으로 VPC를 생성한 경우 스택을 삭제합니다.

> [!NOTE]
> Step 1에서 수동으로 VPC를 생성하고 그것을 이 실습에서 사용한 경우, CloudFormation 스택이 없으므로 이 단계를 건너뛰고 단계 5로 이동합니다.  
> 수동 생성한 VPC를 삭제하려면 [Step 1-1의 리소스 정리 섹션](/week/1/session/1)을 참고하세요.

16. 상단 검색창에 `CloudFormation`을 입력하고 선택합니다.
17. **Stacks** 목록에서 `ec2-lab-prereq` 스택을 선택합니다.
18. [[Delete]] 버튼을 클릭합니다.
19. 확인 팝업에서 [[Delete stack]]을 클릭합니다.
20. 스택 상태가 `DELETE_IN_PROGRESS` → `DELETE_COMPLETE`가 될 때까지 기다립니다 (약 2-3분).

> [!NOTE]
> CloudFormation 스택을 삭제하면 스택이 생성한 모든 리소스가 자동으로 삭제됩니다:
>
> - VPC (`my-vpc`)
> - Subnet 4개 (`my-public-subnet-a`, `my-public-subnet-c`, `my-private-subnet-a`, `my-private-subnet-c`)
> - Internet Gateway (`my-igw`)
> - Route Table 3개
> - Security Group 2개 (`my-ec2-sg`, `my-rds-sg`)

> [!TROUBLESHOOTING]
> **스택 삭제가 `DELETE_FAILED` 상태인 경우:**
>
> | 원인                                      | 해결 방법                                                 |
> | ----------------------------------------- | --------------------------------------------------------- |
> | EC2가 아직 Terminated되지 않음            | EC2가 완전히 Terminated된 후(1-2분 대기) 스택 삭제 재시도 |
> | Security Group을 다른 리소스가 참조 중    | Events 탭에서 실패 리소스 확인 → 해당 리소스 먼저 삭제    |
> | ENI(Elastic Network Interface)가 남아있음 | EC2 콘솔 → Network Interfaces에서 관련 ENI 삭제 후 재시도 |
>
> 스택 삭제 재시도: 스택 선택 → [[Delete]] → "Retain" 옵션 없이 [[Delete stack]]

#### 단계 5: 삭제 확인

21. **EC2 콘솔**: `my-ec2-mysql` 인스턴스가 `Terminated` 상태인지 확인합니다.
22. **CloudFormation 콘솔**: `ec2-lab-prereq` 스택이 목록에서 사라졌는지 확인합니다.
23. **Tag Editor**: Step 2 태그로 다시 검색하여 관련 리소스가 남아있지 않은지 확인합니다.

> [!TIP]
> **키 페어는 삭제하지 마세요.** 키 페어 자체는 비용이 발생하지 않으며, 이후 Step에서 재사용할 수 있습니다.  
> 로컬의 `.pem` 파일도 안전한 곳(`~/.ssh/`)에 보관하세요.

> [!NOTE]
> **삭제 후에도 잠시 리소스가 보일 수 있습니다.**  
> Terminated 인스턴스는 약 1시간 후, CloudFormation 삭제 완료 스택은 일정 시간 후 콘솔에서 자동으로 사라집니다.

✅ **실습 종료**: 모든 리소스가 정리되었습니다.

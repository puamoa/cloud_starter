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
> 이 실습은 EC2 인스턴스가 필요합니다. Step 2-1에서 생성한 EC2를 사용하거나, 새로운 EC2 인스턴스를 생성합니다. Security Group에 8080 포트가 열려 있어야 합니다.

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

## 태스크 0: EC2 인스턴스 확인 및 접속

1. AWS Management Console에 로그인합니다.
2. 리전을 **Asia Pacific (Seoul) ap-northeast-2**로 설정합니다.
3. EC2 콘솔에서 사용할 인스턴스가 `Running` 상태인지 확인합니다.
4. Public IPv4 address를 확인합니다.
5. SSH로 접속합니다:

```bash
ssh -i ~/Downloads/my-keypair.pem ec2-user@<Public-IP>
```

> [!NOTE]
> **Security Group에 8080 포트가 열려 있는지 확인:**
>
> 1. EC2 콘솔 → 인스턴스 선택 → **Security** 탭 → Security Group 링크 클릭
> 2. **Inbound rules**에서 Custom TCP 8080 규칙이 있는지 확인
> 3. 없으면 [[Edit inbound rules]] → [[Add rule]] → Type: `Custom TCP`, Port: `8080`, Source: `0.0.0.0/0` → [[Save rules]]
>
> CloudFormation 템플릿으로 생성한 `my-ec2-sg`에는 8080이 이미 포함되어 있습니다.

> [!TIP]
> EC2 인스턴스가 없다면 [Step 2-1의 태스크 0(CloudFormation)과 태스크 1(EC2 생성)](/week/2/session/1)을 먼저 진행하세요.

✅ **태스크 완료**: EC2 인스턴스에 접속했습니다.

## 태스크 1: Java 17 (Amazon Corretto) 설치

> [!CONCEPT] Amazon Corretto
> Amazon Corretto는 AWS에서 제공하는 무료 OpenJDK 배포판입니다. 장기 지원(LTS)이 제공되며, AWS 서비스와의 호환성이 검증되어 있습니다. Spring Boot 3.x는 Java 17 이상을 요구합니다.

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

9. 브라우저에서 https://start.spring.io 에 접속합니다.

10. 다음과 같이 설정합니다:
    - **Project**: `Gradle - Groovy`
    - **Language**: `Java`
    - **Spring Boot**: 최신 안정 버전
    - **Group**: `com.example`
    - **Artifact**: `demo`
    - **Packaging**: `Jar`
    - **Java**: `17`
    - **Dependencies**: `Spring Web` 추가

11. [[Generate]] 버튼을 클릭하여 다운로드 후 압축 해제합니다.

12. 간단한 API를 추가합니다:

```java
// src/main/java/com/example/demo/HelloController.java
package com.example.demo;

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

13. 빌드합니다:

```bash
cd demo
./gradlew build
```

> [!OUTPUT]
>
> ```
> BUILD SUCCESSFUL in xxs
> ```
>
> 빌드된 JAR 파일: `build/libs/demo-0.0.1-SNAPSHOT.jar`

14. 로컬에서 테스트합니다:

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

```bash
cd <프로젝트 디렉토리>
```

1. **`gradlew` 파일 실행 권한 확인** (Mac/Linux):

```bash
chmod +x gradlew
```

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

2. **업로드 경로 수정** (Windows 경로 → Linux 경로):

프로젝트에 파일 업로드 기능이 있다면, 업로드 경로가 Windows 형식(`C:/upload`)으로 되어 있을 수 있습니다.  
EC2(Linux)에서 동작하도록 변경합니다:

```java
// WebConfig.java 또는 관련 설정 파일
// 변경 전: final String LOCATION = "C:/upload";
// 변경 후:
final String LOCATION = "/tmp/upload";
```

3. **DB 접속 정보 확인** (`application.properties`):

```properties
# EC2에서 같은 서버의 MySQL에 접속하는 경우 localhost 그대로 사용
jdbc.url=jdbc:log4jdbc:mysql://localhost:3306/scoula_db
jdbc.username=scoula
jdbc.password=1234
```

> [!NOTE]
> Step 2-1에서 생성한 MySQL DB와 사용자가 있어야 합니다.  
> 없다면 SSH로 EC2 접속 후 MySQL에서 SQL 파일을 실행하세요 (태스크 4에서 안내).

4. **빌드합니다:**

```bash
./gradlew build -x test
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

---

✅ **태스크 완료**: 애플리케이션이 빌드되었습니다.

## 태스크 3: SCP로 파일 전송

**로컬 PC에서** 실행합니다. 본인의 빌드 결과물에 맞게 파일명을 변경하세요.

**방법 A (JAR):**

```bash
scp -i ~/Downloads/my-keypair.pem build/libs/demo-0.0.1-SNAPSHOT.jar ec2-user@<Public-IP>:~/app.jar
```

**방법 B (WAR):**

```bash
scp -i ~/Downloads/my-keypair.pem build/libs/backend-1.0-SNAPSHOT.war ec2-user@<Public-IP>:~/app.war
```

> [!TIP]
> 파일명을 `app.jar` 또는 `app.war`로 변경하여 전송하면 이후 단계에서 경로를 통일할 수 있습니다.

EC2에 접속하여 파일이 전송되었는지 확인합니다:

```bash
ls -la ~/app.*
```

> [!TROUBLESHOOTING]
> **SCP 전송 실패 시:**
>
> - `Permission denied (publickey)`: SSH 접속과 동일한 키 파일을 사용하고 있는지 확인
> - `Connection timed out`: Security Group에 SSH(22) 포트가 열려 있는지 확인
> - `No such file or directory`: 로컬의 빌드 파일 경로가 정확한지 확인

✅ **태스크 완료**: 파일이 EC2에 전송되었습니다.

## 태스크 4: 애플리케이션 배포 및 실행

본인 프로젝트에 맞는 방법을 선택합니다.

---

### 방법 A: Spring Boot (JAR) 배포

15. 애플리케이션 디렉토리를 생성하고 JAR 파일을 이동합니다:

```bash
sudo mkdir -p /opt/app
sudo mv ~/app.jar /opt/app/app.jar
sudo chown ec2-user:ec2-user /opt/app/app.jar
```

16. 직접 실행하여 정상 동작을 확인합니다:

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

17. 새 터미널에서 테스트합니다:

```bash
curl http://localhost:8080
curl http://localhost:8080/api/health
```

18. 확인 후 Ctrl+C로 종료합니다.

19. **systemd 서비스로 등록합니다:**

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

20. 서비스를 시작합니다:

```bash
sudo systemctl daemon-reload
sudo systemctl start spring-app
sudo systemctl enable spring-app
sudo systemctl status spring-app
```

방법 A를 완료했다면 **태스크 5**로 이동하세요.

---

### 방법 B: Spring MVC (WAR + Tomcat) 배포

#### B-1. Tomcat 9 설치

15. Tomcat 9을 다운로드하고 설치합니다:

```bash
sudo dnf install -y wget
wget https://archive.apache.org/dist/tomcat/tomcat-9/v9.0.97/bin/apache-tomcat-9.0.97.tar.gz
sudo mkdir -p /opt/tomcat
sudo tar -xzf apache-tomcat-9.0.97.tar.gz -C /opt/tomcat --strip-components=1
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

16. Tomcat 실행 권한을 설정합니다:

```bash
chmod +x /opt/tomcat/bin/*.sh
```

17. Tomcat을 시작하여 정상 동작을 확인합니다:

```bash
/opt/tomcat/bin/startup.sh
```

18. 브라우저에서 `http://<Public-IP>:8080`으로 접속하여 Tomcat 기본 페이지가 표시되는지 확인합니다.

19. 확인 후 Tomcat을 중지합니다:

```bash
/opt/tomcat/bin/shutdown.sh
```

#### B-2. DB 스키마 생성

프로젝트가 MySQL을 사용하는 경우, Step 2-1에서 설치한 MySQL에 스키마를 생성합니다.

20. SQL 파일을 EC2에 전송합니다 (로컬에서):

```bash
scp -i ~/Downloads/my-keypair.pem *.sql ec2-user@<Public-IP>:~/
```

21. EC2에서 MySQL에 접속하여 SQL을 실행합니다:

```bash
mysql -u root -p < ~/board.sql
mysql -u root -p < ~/member.sql
```

> [!NOTE]
> `board.sql`은 데이터베이스(`scoula_db`)와 사용자(`scoula`)를 자동 생성합니다.  
> 이미 존재하는 경우 에러가 날 수 있으므로, `CREATE DATABASE IF NOT EXISTS`로 변경하거나 에러를 무시합니다.

#### B-3. WAR 배포

22. 기존 기본 앱을 정리하고 WAR 파일을 배포합니다:

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

23. 업로드 디렉토리를 생성합니다:

```bash
sudo mkdir -p /tmp/upload
sudo chown ec2-user:ec2-user /tmp/upload
```

#### B-4. Tomcat systemd 서비스 등록

24. systemd 서비스 파일을 생성합니다:

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

25. 서비스를 시작합니다:

```bash
sudo systemctl daemon-reload
sudo systemctl start tomcat
sudo systemctl enable tomcat
sudo systemctl status tomcat
```

26. 동작을 확인합니다:

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

### 방법 A (Boot) — journalctl

```bash
# 실시간 로그
sudo journalctl -u spring-app -f

# 최근 50줄
sudo journalctl -u spring-app -n 50

# 오늘 로그만
sudo journalctl -u spring-app --since today

# 에러만
sudo journalctl -u spring-app -p err
```

### 방법 B (Tomcat) — catalina.out

```bash
# 실시간 로그
tail -f /opt/tomcat/logs/catalina.out

# 최근 50줄
tail -50 /opt/tomcat/logs/catalina.out

# 에러 검색
grep -i "error\|exception" /opt/tomcat/logs/catalina.out | tail -20
```

### 서비스 관리 명령어

```bash
# 방법 A (Boot)
sudo systemctl start/stop/restart/status spring-app

# 방법 B (Tomcat)
sudo systemctl start/stop/restart/status tomcat
```

✅ **태스크 완료**: 로그 확인 방법을 학습했습니다.

## 태스크 6: 자동 재시작 테스트

서비스가 비정상 종료되었을 때 자동으로 복구되는지 확인합니다.

**방법 A (Boot):**

```bash
# 프로세스 강제 종료
sudo kill -9 $(pgrep -f "app.jar")

# 12초 후 자동 재시작 확인
sleep 12
sudo systemctl status spring-app
curl http://localhost:8080
```

**방법 B (Tomcat):**

```bash
# 프로세스 강제 종료
sudo kill -9 $(pgrep -f "catalina")

# 12초 후 자동 재시작 확인
sleep 12
sudo systemctl status tomcat
curl http://localhost:8080/api/board
```

> [!OUTPUT]
> 서비스가 `active (running)` 상태로 복구되어 있어야 합니다. `RestartSec=10` 설정에 의해 10초 후 자동 재시작됩니다.

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

27. Nginx 설정 파일을 수정합니다:

```bash
sudo vi /etc/nginx/conf.d/vue-app.conf
```

28. `server` 블록 안에 다음을 추가합니다:

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

29. 설정을 검증하고 Nginx를 재시작합니다:

```bash
sudo nginx -t
sudo systemctl restart nginx
```

30. 브라우저에서 테스트합니다:
    - `http://<Public-IP>` → Vue 앱 (프론트엔드)
    - `http://<Public-IP>/api/health` → Spring API 응답

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

✅ **태스크 완료**: Nginx 리버스 프록시로 프론트엔드와 백엔드가 연결되었습니다.

## 마무리

다음을 성공적으로 수행했습니다:

- EC2에 Amazon Corretto 17(Java 17)을 설치했습니다.
- Spring Boot JAR 또는 Spring MVC WAR를 빌드하고 EC2에 전송했습니다.
- systemd 서비스로 등록하여 자동 시작/재시작을 설정했습니다.
- journalctl 또는 catalina.out으로 로그를 확인했습니다.
- Nginx 리버스 프록시로 프론트엔드와 백엔드를 연결했습니다.

---

## 다음 단계: Step 8 (CI/CD)에서의 자동화

이 실습에서는 수동으로 빌드 → SCP 전송 → 배포를 진행했습니다.  
Step 8에서는 GitHub Actions를 사용하여 `git push`만으로 빌드·배포가 자동으로 실행되도록 구성합니다.

---

# 🗑️ 리소스 정리

> [!NOTE]
> 이 실습에서 추가로 생성한 리소스는 EC2 내부의 소프트웨어(Java, Tomcat, 서비스 파일)뿐입니다.  
> EC2 내부 소프트웨어는 추가 AWS 비용이 발생하지 않습니다.

---

### 옵션 A: EC2 유지 (서비스만 정리)

**Boot (JAR) 정리:**

```bash
sudo systemctl stop spring-app
sudo systemctl disable spring-app
sudo rm /etc/systemd/system/spring-app.service
sudo systemctl daemon-reload
sudo rm -rf /opt/app
```

**Tomcat (WAR) 정리:**

```bash
sudo systemctl stop tomcat
sudo systemctl disable tomcat
sudo rm /etc/systemd/system/tomcat.service
sudo systemctl daemon-reload
sudo rm -rf /opt/tomcat
```

**Nginx 프록시 설정 복원 (리버스 프록시 제거):**

Nginx 설정에서 `location /api/` 블록을 삭제하고 `sudo systemctl restart nginx`를 실행합니다.

> [!TIP]
> Java(Amazon Corretto)는 삭제하지 않아도 됩니다. 다른 Java 애플리케이션에서 재사용할 수 있습니다.

---

### 옵션 B: EC2 인스턴스 포함 전체 삭제

EC2 인스턴스 자체를 삭제하려면 [Step 2-1의 리소스 정리 → 옵션 B](/week/2/session/1#cleanup) 섹션을 참조하세요.

✅ **실습 종료**: 모든 리소스가 정리되었습니다.

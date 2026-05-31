---
title: 'Amazon EC2에 Spring Boot JAR 배포 및 서비스 등록'
week: 2
session: 3
awsServices:
  - Amazon EC2
learningObjectives:
  - EC2에 Amazon Corretto 17(Java)을 설치할 수 있습니다.
  - 로컬에서 빌드한 JAR 파일을 SCP로 EC2에 전송할 수 있습니다.
  - Spring Boot 애플리케이션을 systemd 서비스로 등록할 수 있습니다.
  - journalctl로 애플리케이션 로그를 확인할 수 있습니다.
prerequisites:
  - AWS 계정 생성 완료
  - EC2 인스턴스 실행 중 (Amazon Linux 2023, Public IP 할당)
  - Security Group에 8080 포트 허용
  - 로컬에 Spring Boot 프로젝트 (또는 실습 중 샘플 생성)
estimatedCost: 크레딧 내 사용 가능 (비용 발생 가능)
---

이 실습에서는 EC2 인스턴스에 Java 17을 설치하고, 로컬에서 빌드한 Spring Boot JAR 파일을 배포합니다. systemd 서비스로 등록하여 서버 재부팅 시에도 자동으로 시작되도록 구성합니다.

> [!NOTE]
> 이 실습은 EC2 인스턴스가 필요합니다. Step 2-1에서 생성한 EC2를 사용하거나, 새로운 EC2 인스턴스를 생성합니다. Security Group에 8080 포트가 열려 있어야 합니다.

> [!WARNING]
> Step 2-1에서 EC2를 Stop한 경우, 먼저 Start하고 새로운 Public IP를 확인한 후 진행하세요.

## 태스크 0: EC2 인스턴스 확인 및 접속

1. AWS Management Console에 로그인합니다.
2. 리전을 **Asia Pacific (Seoul) ap-northeast-2**로 설정합니다.
3. EC2 콘솔에서 사용할 인스턴스가 `Running` 상태인지 확인합니다.
4. Public IPv4 address를 확인합니다.
5. SSH로 접속합니다:

```bash
ssh -i ~/Downloads/my-keypair.pem ec2-user@<Public-IP>
```

> [!TIP]
> EC2 인스턴스가 없다면 Step 2-1의 태스크 0(CloudFormation)과 태스크 1(EC2 생성)을 먼저 진행하세요.

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

8. JAVA_HOME 환경 변수를 확인합니다:

```bash
echo $JAVA_HOME
```

> [!NOTE]
> JAVA_HOME이 설정되어 있지 않다면 다음 명령으로 설정합니다:
>
> ```bash
> echo 'export JAVA_HOME=/usr/lib/jvm/java-17-amazon-corretto' | sudo tee -a /etc/profile.d/java.sh
> source /etc/profile.d/java.sh
> ```

✅ **태스크 완료**: Java 17(Amazon Corretto)이 설치되었습니다.

## 태스크 2: 로컬에서 JAR 빌드

> [!NOTE]
> 이미 빌드된 JAR 파일이 있다면 이 태스크를 건너뛰고 태스크 3으로 이동합니다. 샘플 프로젝트가 필요하다면 아래 단계를 따릅니다.

**로컬 PC에서** (EC2가 아닌 본인 컴퓨터에서) 실행합니다:

9. Spring Initializr로 샘플 프로젝트를 생성합니다. 브라우저에서 https://start.spring.io 에 접속합니다.

10. 다음과 같이 설정합니다:
    - **Project**: `Gradle - Groovy`
    - **Language**: `Java`
    - **Spring Boot**: `3.2.x` (최신 안정 버전)
    - **Group**: `com.example`
    - **Artifact**: `demo`
    - **Packaging**: `Jar`
    - **Java**: `17`
    - **Dependencies**: `Spring Web` 추가

11. [[Generate]] 버튼을 클릭하여 프로젝트를 다운로드합니다.

12. 다운로드한 프로젝트를 압축 해제하고, 간단한 API를 추가합니다:

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

    @GetMapping("/health")
    public String health() {
        return "OK";
    }
}
```

13. 프로젝트를 빌드합니다:

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

14. JAR 파일이 정상 동작하는지 로컬에서 테스트합니다:

```bash
java -jar build/libs/demo-0.0.1-SNAPSHOT.jar
```

15. 브라우저에서 `http://localhost:8080`으로 접속하여 "Hello from Spring Boot on EC2!" 메시지를 확인합니다.
16. Ctrl+C로 종료합니다.

✅ **태스크 완료**: JAR 파일이 빌드되었습니다.

## 태스크 3: SCP로 JAR 파일 전송

**로컬 PC에서** 실행합니다:

17. SCP 명령으로 JAR 파일을 EC2에 전송합니다:

```bash
scp -i ~/Downloads/my-keypair.pem build/libs/demo-0.0.1-SNAPSHOT.jar ec2-user@<Public-IP>:~/
```

> [!OUTPUT]
>
> ```
> demo-0.0.1-SNAPSHOT.jar    100%   xx MB   x.x MB/s   00:xx
> ```

> [!TIP]
> 파일이 큰 경우 전송 시간이 오래 걸릴 수 있습니다. Spring Boot JAR은 보통 20-50MB 정도입니다.

> [!TROUBLESHOOTING]
> **SCP 전송 실패 시:**
>
> - `Permission denied (publickey)`: SSH 접속과 동일한 키 파일을 사용하고 있는지 확인
> - `Connection timed out`: Security Group에 SSH(22) 포트가 열려 있는지 확인
> - `No such file or directory`: 로컬의 JAR 파일 경로가 정확한지 확인 (`ls build/libs/`)
> - 경로에 공백이 있는 경우: 경로를 따옴표로 감싸세요

18. EC2에 SSH로 접속하여 파일이 전송되었는지 확인합니다:

```bash
ssh -i ~/Downloads/my-keypair.pem ec2-user@<Public-IP>
ls -la ~/demo-0.0.1-SNAPSHOT.jar
```

> [!OUTPUT]
>
> ```
> -rw-r--r--. 1 ec2-user ec2-user xxxxxxxx ... demo-0.0.1-SNAPSHOT.jar
> ```

✅ **태스크 완료**: JAR 파일이 EC2에 전송되었습니다.

## 태스크 4: 직접 실행 테스트

EC2에서 JAR 파일을 직접 실행하여 정상 동작을 확인합니다.

19. 애플리케이션 디렉토리를 생성하고 JAR 파일을 이동합니다:

```bash
sudo mkdir -p /opt/app
sudo mv ~/demo-0.0.1-SNAPSHOT.jar /opt/app/app.jar
sudo chown ec2-user:ec2-user /opt/app/app.jar
```

20. JAR 파일을 직접 실행합니다:

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
>  :: Spring Boot ::                (v3.2.x)
>
> ... Started DemoApplication in x.xxx seconds
> ```

21. 새 터미널을 열어 EC2에 접속한 후 curl로 테스트합니다:

```bash
curl http://localhost:8080
curl http://localhost:8080/health
```

> [!OUTPUT]
>
> ```
> Hello from Spring Boot on EC2!
> OK
> ```

22. 브라우저에서 `http://<Public-IP>:8080`으로 접속하여 확인합니다.
23. 첫 번째 터미널에서 Ctrl+C로 애플리케이션을 종료합니다.

> [!WARNING]
> 직접 실행(`java -jar`)은 터미널을 닫으면 애플리케이션도 종료됩니다. 운영 환경에서는 반드시 systemd 서비스로 등록해야 합니다.

> [!TIP]
> `nohup java -jar /opt/app/app.jar &`로 백그라운드 실행도 가능하지만, 서버 재부팅 시 자동 시작되지 않고 로그 관리도 어렵습니다. 다음 태스크에서 systemd를 사용하는 것이 정석입니다.

✅ **태스크 완료**: JAR 파일이 정상 실행됨을 확인했습니다.

## 태스크 5: systemd 서비스 등록

> [!CONCEPT] systemd 서비스
> systemd는 Linux의 서비스 관리 시스템입니다. 서비스로 등록하면:
>
> - 서버 재부팅 시 자동 시작
> - 비정상 종료 시 자동 재시작
> - 로그 관리 (journalctl)
> - 서비스 상태 모니터링
>
> 프로덕션 환경에서 Java 애플리케이션을 운영하는 표준 방법입니다.

24. systemd 서비스 파일을 생성합니다:

```bash
sudo vi /etc/systemd/system/spring-app.service
```

25. 다음 내용을 입력합니다:

```ini
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

# 환경 변수 설정 (필요한 경우)
Environment=SPRING_PROFILES_ACTIVE=prod
Environment=JAVA_OPTS=-Xms256m -Xmx512m

[Install]
WantedBy=multi-user.target
```

> [!NOTE]
> **주요 설정 설명:**
>
> | 설정                         | 값           | 설명                                      |
> | ---------------------------- | ------------ | ----------------------------------------- |
> | `After=network.target`       | -            | 네트워크가 준비된 후 시작                 |
> | `User=ec2-user`              | -            | 이 사용자 권한으로 실행 (root 아님)       |
> | `Restart=on-failure`         | -            | 비정상 종료(exit code ≠ 0) 시 자동 재시작 |
> | `RestartSec=10`              | -            | 재시작 전 10초 대기                       |
> | `SyslogIdentifier`           | `spring-app` | journalctl에서 로그 필터링에 사용         |
> | `WantedBy=multi-user.target` | -            | 서버 부팅 시 자동 시작 대상에 포함        |

> [!TIP]
> vi가 익숙하지 않다면 다음 명령으로 파일을 생성할 수 있습니다:
>
> ```bash
> sudo tee /etc/systemd/system/spring-app.service << 'EOF'
> [Unit]
> Description=Spring Boot Application
> After=network.target
>
> [Service]
> Type=simple
> User=ec2-user
> Group=ec2-user
> ExecStart=/usr/bin/java -jar /opt/app/app.jar --server.port=8080
> WorkingDirectory=/opt/app
> Restart=on-failure
> RestartSec=10
> StandardOutput=journal
> StandardError=journal
> SyslogIdentifier=spring-app
> Environment=SPRING_PROFILES_ACTIVE=prod
> Environment=JAVA_OPTS=-Xms256m -Xmx512m
>
> [Install]
> WantedBy=multi-user.target
> EOF
> ```

26. systemd 데몬을 리로드합니다:

```bash
sudo systemctl daemon-reload
```

27. 서비스를 시작합니다:

```bash
sudo systemctl start spring-app
```

28. 서비스를 부팅 시 자동 시작하도록 설정합니다:

```bash
sudo systemctl enable spring-app
```

29. 서비스 상태를 확인합니다:

```bash
sudo systemctl status spring-app
```

> [!OUTPUT]
>
> ```
> ● spring-app.service - Spring Boot Application
>      Loaded: loaded (/etc/systemd/system/spring-app.service; enabled)
>      Active: active (running) since ...
>    Main PID: xxxx (java)
>      CGroup: /system.slice/spring-app.service
>              └─xxxx /usr/bin/java -jar /opt/app/app.jar --server.port=8080
> ```

30. curl로 동작을 확인합니다:

```bash
curl http://localhost:8080
```

> [!OUTPUT]
>
> ```
> Hello from Spring Boot on EC2!
> ```

> [!TROUBLESHOOTING]
> **서비스가 시작되지 않는 경우:**
>
> ```bash
> # 상세 에러 로그 확인
> sudo journalctl -u spring-app -n 50 --no-pager
> ```
>
> | 증상                      | 원인               | 해결 방법                                                   |
> | ------------------------- | ------------------ | ----------------------------------------------------------- |
> | `Active: failed`          | JAR 파일 경로 오류 | `ls -la /opt/app/app.jar`로 파일 존재 확인                  |
> | `Permission denied`       | 파일 권한 문제     | `sudo chown ec2-user:ec2-user /opt/app/app.jar`             |
> | `Address already in use`  | 8080 포트 사용 중  | `sudo ss -tlnp \| grep 8080`으로 확인 후 해당 프로세스 종료 |
> | `java: command not found` | Java 경로 문제     | `which java`로 경로 확인 후 ExecStart 수정                  |

✅ **태스크 완료**: Spring Boot 애플리케이션이 systemd 서비스로 등록되었습니다.

## 태스크 6: journalctl 로그 확인

31. 실시간 로그를 확인합니다:

```bash
sudo journalctl -u spring-app -f
```

32. 다른 터미널에서 요청을 보내면 로그가 실시간으로 표시됩니다:

```bash
curl http://localhost:8080
```

33. Ctrl+C로 실시간 로그 확인을 종료합니다.

34. 최근 50줄의 로그를 확인합니다:

```bash
sudo journalctl -u spring-app -n 50
```

35. 오늘 날짜의 로그만 확인합니다:

```bash
sudo journalctl -u spring-app --since today
```

36. 에러 로그만 필터링합니다:

```bash
sudo journalctl -u spring-app -p err
```

> [!TIP]
> 자주 사용하는 journalctl 옵션:
>
> - `-f`: 실시간 로그 (tail -f와 유사)
> - `-n 100`: 최근 100줄
> - `--since "2024-01-01"`: 특정 날짜 이후
> - `--since "1 hour ago"`: 1시간 전부터
> - `-p err`: 에러 레벨 이상만
> - `--no-pager`: 페이저 없이 출력

### 서비스 관리 명령어 요약

```bash
# 서비스 시작/중지/재시작
sudo systemctl start spring-app
sudo systemctl stop spring-app
sudo systemctl restart spring-app

# 상태 확인
sudo systemctl status spring-app

# 자동 시작 활성화/비활성화
sudo systemctl enable spring-app
sudo systemctl disable spring-app
```

✅ **태스크 완료**: journalctl로 로그를 확인하는 방법을 학습했습니다.

## 태스크 7: 자동 재시작 테스트

37. 프로세스를 강제 종료하여 자동 재시작을 테스트합니다:

```bash
# 현재 PID 확인
sudo systemctl status spring-app | grep "Main PID"

# 프로세스 강제 종료
sudo kill -9 $(pgrep -f "app.jar")
```

38. 10초 후 서비스가 자동으로 재시작되는지 확인합니다:

```bash
sleep 12
sudo systemctl status spring-app
```

> [!OUTPUT]
> 서비스가 `active (running)` 상태로 복구되어 있어야 합니다. `RestartSec=10` 설정에 의해 10초 후 자동 재시작됩니다.

39. curl로 정상 동작을 확인합니다:

```bash
curl http://localhost:8080
```

✅ **태스크 완료**: 자동 재시작이 정상 동작함을 확인했습니다.

## 마무리

다음을 성공적으로 수행했습니다:

- EC2에 Amazon Corretto 17(Java 17)을 설치했습니다.
- 로컬에서 Spring Boot JAR을 빌드하고 SCP로 EC2에 전송했습니다.
- JAR 파일을 직접 실행하여 정상 동작을 확인했습니다.
- systemd 서비스 파일을 작성하고 자동 시작을 설정했습니다.
- journalctl로 로그를 확인하는 방법을 학습했습니다.
- 비정상 종료 시 자동 재시작을 테스트했습니다.

# 🗑️ 리소스 정리

> [!NOTE]
> 이 실습에서 추가로 생성한 리소스는 EC2 내부의 소프트웨어(Java, JAR, systemd 서비스)뿐입니다.  
> EC2 내부 소프트웨어는 추가 AWS 비용이 발생하지 않습니다. EC2 인스턴스 자체의 비용 관리는 Step 2-1의 리소스 정리를 참조하세요.

---

### 옵션 A: EC2 유지 (서비스만 정리)

EC2 인스턴스를 계속 사용하지만 Spring Boot 서비스를 정리하려면 다음 명령을 실행합니다.

```bash
# 서비스 중지 및 자동 시작 비활성화
sudo systemctl stop spring-app
sudo systemctl disable spring-app

# 서비스 파일 삭제
sudo rm /etc/systemd/system/spring-app.service
sudo systemctl daemon-reload

# JAR 파일 및 애플리케이션 디렉토리 삭제
sudo rm -rf /opt/app
```

> [!TIP]
> Java(Amazon Corretto)는 삭제하지 않아도 됩니다. 다른 Java 애플리케이션에서 재사용할 수 있으며, 설치된 상태로 비용이 발생하지 않습니다.

---

### 옵션 B: EC2 인스턴스 포함 전체 삭제

EC2 인스턴스 자체를 삭제하려면 **Step 2-1의 리소스 정리 → 옵션 B** 섹션을 참조하세요.

> [!WARNING]
> EC2를 Terminate하면 내부의 모든 소프트웨어와 데이터가 함께 삭제됩니다. 별도로 서비스를 정리할 필요 없이 인스턴스만 Terminate하면 됩니다.

✅ **실습 종료**: 모든 리소스가 정리되었습니다.

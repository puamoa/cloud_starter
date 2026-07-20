---
title: 'GitHub Actions로 프론트엔드/백엔드 자동 배포'
week: 9
session: 1
awsServices:
  - Amazon EC2
  - Amazon RDS
learningObjectives:
  - GitHub Actions 워크플로우 YAML을 작성할 수 있습니다.
  - GitHub Secrets에 민감 정보를 안전하게 저장할 수 있습니다.
  - SSH를 통한 EC2 자동 배포 파이프라인을 구축할 수 있습니다.
  - 프론트엔드와 백엔드를 별도 리포지토리로 운영하고 각각 CI/CD를 구성할 수 있습니다.
prerequisites:
  - GitHub 계정 및 리포지토리 2개 (프론트엔드/백엔드)
  - Step 8 인프라 구축 완료 (또는 EC2 인스턴스 실행 중)
  - Spring Boot 또는 Spring MVC 프로젝트
  - Vue.js 프로젝트
estimatedCost: 프리티어 (GitHub Actions Public 리포 무료, Private 월 2000분 무료)
---

이 실습에서는 GitHub Actions를 사용하여 코드를 push하면 자동으로 빌드하고
EC2에 배포하는 CI/CD 파이프라인을 구축합니다.  
프론트엔드(Vue.js)와 백엔드(Spring)를 **별도 리포지토리**로 운영하며 각각의 배포 워크플로우를 작성합니다.

> [!CONCEPT] Step 8 → Step 9: 무엇이 바뀌는가?
> Step 8에서는 **수동 배포**를 했습니다. 이제 그 과정을 **자동화**합니다:
>
> | 단계          | Step 8 (수동)                  | Step 9 (자동)              |
> | ------------- | ------------------------------ | -------------------------- |
> | 백엔드 빌드   | 로컬에서 `./gradlew bootJar`   | GitHub Actions가 자동 빌드 |
> | EC2 전송      | `scp`로 JAR 수동 복사          | SSH 또는 SSM으로 자동 배포 |
> | 프론트 빌드   | 로컬에서 `npm run build`       | GitHub Actions가 자동 빌드 |
> | S3 업로드     | `aws s3 sync` 수동 실행        | push만 하면 자동 sync      |
> | 서비스 재시작 | SSH 접속 → `systemctl restart` | 워크플로우가 자동 재시작   |
>
> **인프라(VPC, ALB, Amazon RDS, Amazon S3)는 Step 8 그대로 유지**합니다.  
> 코드를 배포하는 **방법만** 수동에서 자동으로 바뀝니다.

> [!NOTE]
> 이 실습에는 Amazon EC2 인스턴스(SSH 접속 가능)와 GitHub 리포지토리 2개가 필요합니다.
>
> **Step 8 인프라를 재사용하는 경우 (권장):**
>
> - Step 8에서 생성한 VPC, ALB, Amazon RDS를 그대로 사용합니다.
> - Amazon EC2만 Step 8-3에서 생성한 것을 유지하면 됩니다.
> - AWS CloudFormation 스택(`step8-network`, `step8-data`, `step8-backend`)이 살아있는지 확인하세요.
>
> **Step 8 없이 진행하는 경우:**
>
> - Amazon EC2가 없다면 Step 2를 참조하여 인스턴스를 먼저 생성하세요.
> - Amazon RDS가 없다면 Step 4를 참조하여 DB를 생성하세요.

---

## 태스크 1: GitHub Actions 개념 이해

### CI/CD란?

| 용어                            | 의미                          | 예시                      |
| ------------------------------- | ----------------------------- | ------------------------- |
| **CI** (Continuous Integration) | 코드 변경 시 자동 빌드/테스트 | push → 빌드 → 테스트 실행 |
| **CD** (Continuous Delivery)    | 빌드 결과물을 자동 배포       | 테스트 통과 → EC2에 배포  |

### GitHub Actions 핵심 구성 요소

```
Workflow (워크플로우)
├── Event (이벤트/트리거): push, pull_request, schedule 등
├── Job (잡): 독립적인 실행 단위
│   ├── runs-on: 실행 환경 (ubuntu-latest 등)
│   └── Steps (스텝): 순차 실행되는 작업들
│       ├── uses: 미리 만들어진 Action 사용
│       └── run: 직접 명령어 실행
```

> [!CONCEPT] GitHub Actions의 동작 방식
>
> - `.github/workflows/` 디렉토리에 YAML 파일을 작성합니다.
> - 지정한 이벤트(push, PR 등)가 발생하면 워크플로우가 자동 실행됩니다.
> - GitHub이 제공하는 가상 머신(Runner)에서 스텝이 순차적으로 실행됩니다.
> - 모든 스텝이 성공하면 워크플로우가 완료됩니다.
>
> Public 리포지토리는 무료, Private 리포지토리는 월 2,000분 무료입니다.

### 워크플로우 파일 위치

이 실습에서는 프론트엔드와 백엔드를 **별도 리포지토리**로 운영합니다.

```
my-frontend/              ← 프론트엔드 전용 리포지토리
├── .github/
│   └── workflows/
│       └── deploy.yml    ← Vue.js 빌드 + 배포
├── src/
├── package.json
└── vite.config.js

my-backend/               ← 백엔드 전용 리포지토리
├── .github/
│   └── workflows/
│       └── deploy.yml    ← Spring 빌드 + 배포
├── src/
├── build.gradle
└── settings.gradle
```

> [!CONCEPT] 모노레포 vs 별도 레포
>
> | 항목         | 모노레포 (Monorepo)                   | 별도 레포 (Multi-repo)      |
> | ------------ | ------------------------------------- | --------------------------- |
> | 구조         | 하나의 레포에 `frontend/`, `backend/` | 각각 독립된 레포            |
> | 배포 트리거  | `paths` 필터로 변경된 디렉토리만 배포 | push하면 해당 레포만 배포   |
> | CI/CD 복잡도 | 경로 필터 설정 필요                   | 단순 (레포 = 배포 단위)     |
> | 팀 협업      | PR 충돌 가능성 높음                   | 각 팀 독립적 운영           |
> | 버전 관리    | 프론트/백엔드 버전이 함께 움직임      | 각각 독립적으로 버전 관리   |
> | 적합한 상황  | 소규모 팀, 프론트/백엔드 동시 개발    | 중대규모 팀, 독립 배포 필요 |
>
> 이 실습에서는 **별도 레포**를 사용합니다. 프론트엔드와 백엔드를 독립적으로 배포할 수 있고, 각 팀이 자율적으로 CI/CD를 관리합니다.

✅ **태스크 완료** — GitHub Actions의 핵심 개념(워크플로우, 잡, 스텝, 트리거)을 이해했습니다.

---

## 태스크 2: GitHub Secrets 설정

배포에 필요한 민감 정보(SSH 키, 비밀번호 등)를 GitHub Secrets에 저장합니다.  
**프론트엔드 레포와 백엔드 레포 각각에** 동일한 Secrets를 등록합니다.

### Secrets 설정 단계

1. GitHub에서 **백엔드 리포지토리** 페이지로 이동합니다.
2. **Settings** 탭을 클릭합니다.
3. 왼쪽 메뉴에서 **Secrets and variables** → **Actions**를 클릭합니다.
4. [[New repository secret]]을 클릭합니다.

> [!OUTPUT]
> "New repository secret" 페이지가 표시됩니다.  
> **Name** 필드와 **Secret** 필드가 보입니다.  
> Name에 Secret 이름을, Secret에 값을 입력하고 [[Add secret]]을 클릭합니다.

### 필요한 Secrets 목록

다음 Secrets를 하나씩 추가합니다:

| Secret Name   | 값                        | 설명                      |
| ------------- | ------------------------- | ------------------------- |
| `EC2_HOST`    | `3.35.xxx.xxx`            | EC2 Public IP 또는 도메인 |
| `EC2_USER`    | `ec2-user`                | SSH 접속 사용자명         |
| `EC2_KEY`     | SSH Private Key 전체 내용 | `.pem` 파일 내용          |
| `DB_URL`      | `jdbc:mysql://...`        | RDS 엔드포인트 (선택)     |
| `DB_PASSWORD` | DB 비밀번호               | RDS 비밀번호 (선택)       |

### EC2_KEY 등록 방법

5. **Name**: `EC2_KEY`
6. **Secret**: `.pem` 파일의 전체 내용을 붙여넣습니다.

```bash
# .pem 파일 내용 확인 (macOS/Linux)
cat ~/.ssh/my-key.pem
```

> [!WARNING]
> SSH Private Key를 붙여넣을 때 주의사항:
>
> - `-----BEGIN RSA PRIVATE KEY-----`부터 `-----END RSA PRIVATE KEY-----`까지 **전체**를 복사합니다.
> - 앞뒤 공백이나 빈 줄이 없어야 합니다.
> - 키 형식이 올바르지 않으면 SSH 접속이 실패합니다.

### EC2_HOST 등록

7. [[New repository secret]]을 다시 클릭합니다.
8. **Name**: `EC2_HOST`
9. **Secret**: EC2 인스턴스의 Public IP (예: `3.35.123.456`)

> [!TIP]
> EC2에 Elastic IP를 할당하면 인스턴스를 재시작해도 IP가 변경되지 않습니다.  
> Elastic IP 없이 사용하면 인스턴스 재시작 시 IP가 바뀌어 Secret을 업데이트해야 합니다.

나머지 Secrets(`EC2_USER`, `DB_URL`, `DB_PASSWORD`)도 같은 방식으로 추가합니다.

> [!TROUBLESHOOTING]
> | 증상 | 원인 | 해결 방법 |
> |------|------|-----------|
> | Secret 저장 후 워크플로우에서 빈 값 | Secret Name 오타 (대소문자 구분) | `EC2_KEY`와 `${{ secrets.EC2_KEY }}` 이름이 정확히 일치하는지 확인 |
> | `.pem` 키 붙여넣기 후 SSH 실패 | 키 앞뒤에 공백/빈줄 포함 | 메모장에서 복사하지 말고 `cat` 출력을 직접 복사 |
> | Settings에 Secrets 메뉴가 안 보임 | 리포지토리 권한 부족 (Collaborator) | 리포지토리 Owner 또는 Admin 권한 필요 |
> | EC2_HOST에 도메인 입력 후 접속 실패 | DNS 미전파 또는 HTTPS 포트 사용 | IP 주소를 직접 입력하거나 `ping` 으로 확인 |

> [!NOTE]
> GitHub Secrets는 한 번 저장하면 다시 볼 수 없습니다 (수정만 가능).  
> 값을 잘못 입력했다면 Secret을 삭제하고 다시 생성하세요.

✅ **태스크 완료** — GitHub Secrets에 배포에 필요한 민감 정보를 저장했습니다.

> [!NOTE]
> **프론트엔드 레포에도 동일한 Secrets를 등록하세요.**  
> `EC2_HOST`, `EC2_USER`, `EC2_KEY`는 프론트/백엔드 모두 같은 EC2에 배포하므로 동일한 값을 사용합니다.

---

## 태스크 3: 백엔드 배포 워크플로우 작성

**백엔드 리포지토리**에서 `main` 브랜치에 push하면 자동으로 빌드하고 EC2에 배포하는 워크플로우를 작성합니다.

본인 프로젝트에 맞는 방법을 선택하세요:

- **방법 A**: Spring Boot (JAR) — `java -jar`로 실행
- **방법 B**: Spring MVC (WAR) — Tomcat에 배포

---

### 방법 A: Spring Boot (JAR) 배포 워크플로우

백엔드 리포지토리 루트에 `.github/workflows/deploy.yml` 파일을 생성합니다:

```yaml
# .github/workflows/deploy.yml (백엔드 리포지토리)
name: Deploy Spring Boot to EC2

on:
  push:
    branches: [main]
    paths:
      - 'src/**'
      - 'build.gradle'
      - 'settings.gradle'
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

      # 3. Gradle 캐시 (빌드 속도 향상)
      - name: Cache Gradle packages
        uses: actions/cache@v4
        with:
          path: |
            ~/.gradle/caches
            ~/.gradle/wrapper
          key: ${{ runner.os }}-gradle-${{ hashFiles('**/*.gradle*', '**/gradle-wrapper.properties') }}
          restore-keys: |
            ${{ runner.os }}-gradle-

      # 4. Gradle 빌드 (테스트 포함)
      - name: Build with Gradle
        run: |
          chmod +x ./gradlew
          ./gradlew clean bootJar

      # 5. JAR 파일을 EC2로 전송
      - name: Copy JAR to EC2
        uses: appleboy/scp-action@v0.1.7
        with:
          host: ${{ secrets.EC2_HOST }}
          username: ${{ secrets.EC2_USER }}
          key: ${{ secrets.EC2_KEY }}
          source: 'build/libs/*.jar'
          target: '/home/ec2-user/app/'
          strip_components: 2

      # 6. EC2에서 애플리케이션 재시작
      - name: Restart application on EC2
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.EC2_HOST }}
          username: ${{ secrets.EC2_USER }}
          key: ${{ secrets.EC2_KEY }}
          script: |
            echo "=== 배포 시작: $(date) ==="

            # 기존 프로세스 종료
            sudo systemctl stop spring-app || true
            sleep 2

            # 새 JAR 파일로 교체
            cd /home/ec2-user/app
            JAR_FILE=$(ls -t *.jar | head -1)
            echo "배포할 JAR: $JAR_FILE"

            # 애플리케이션 시작
            sudo systemctl start spring-app
            sleep 10

            # Health Check
            echo "=== Health Check ==="
            curl -f http://localhost:8080/actuator/health || exit 1
            echo ""
            echo "=== 배포 완료: $(date) ==="
```

> [!CONCEPT] 워크플로우 주요 설정 설명
>
> - `on.push.paths`: 특정 파일이 변경될 때만 워크플로우를 실행합니다. README만 수정했을 때 불필요한 배포를 방지합니다.
> - `actions/cache`: Gradle 의존성을 캐시하여 빌드 시간을 단축합니다 (첫 빌드 3분 → 이후 1분).
> - `appleboy/scp-action`: SSH를 통해 파일을 EC2로 전송합니다.
> - `appleboy/ssh-action`: SSH로 EC2에 접속하여 명령어를 실행합니다.

### EC2에 systemd 서비스 등록 (사전 준비)

EC2에서 Spring Boot를 systemd 서비스로 관리하려면 다음 파일을 생성합니다:

```bash
# EC2에 SSH 접속 후 실행
sudo vi /etc/systemd/system/spring-app.service
```

```ini
[Unit]
Description=Spring Boot Application
After=network.target

[Service]
User=ec2-user
WorkingDirectory=/home/ec2-user/app
ExecStart=/usr/bin/java -jar /home/ec2-user/app/app.jar \
  --spring.profiles.active=prod
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
# 서비스 등록 및 활성화
sudo systemctl daemon-reload
sudo systemctl enable spring-app
```

---

### 방법 B: Spring MVC (WAR + Tomcat) 배포 워크플로우

기존 Spring MVC 프로젝트(WAR 패키징)를 사용하는 경우입니다.

백엔드 리포지토리 루트에 `.github/workflows/deploy.yml` 파일을 생성합니다:

```yaml
# .github/workflows/deploy.yml (백엔드 리포지토리 - WAR)
name: Deploy Spring MVC WAR to EC2

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
          key: ${{ runner.os }}-gradle-${{ hashFiles('**/*.gradle*', '**/gradle-wrapper.properties') }}
          restore-keys: |
            ${{ runner.os }}-gradle-

      # 4. WAR 빌드 (테스트 제외)
      - name: Build WAR
        run: |
          chmod +x ./gradlew
          ./gradlew build -x test

      # 5. WAR 파일을 EC2로 전송
      - name: Copy WAR to EC2
        uses: appleboy/scp-action@v0.1.7
        with:
          host: ${{ secrets.EC2_HOST }}
          username: ${{ secrets.EC2_USER }}
          key: ${{ secrets.EC2_KEY }}
          source: 'build/libs/*.war'
          target: '/home/ec2-user/'
          strip_components: 2

      # 6. Tomcat에 WAR 배포 및 재시작
      - name: Deploy WAR to Tomcat
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.EC2_HOST }}
          username: ${{ secrets.EC2_USER }}
          key: ${{ secrets.EC2_KEY }}
          script: |
            echo "=== WAR 배포 시작: $(date) ==="

            # Tomcat 중지
            sudo systemctl stop tomcat || true
            sleep 3

            # 기존 배포 제거 및 새 WAR 배포
            rm -rf /opt/tomcat/webapps/ROOT
            rm -f /opt/tomcat/webapps/ROOT.war
            cp /home/ec2-user/*.war /opt/tomcat/webapps/ROOT.war

            # Tomcat 시작
            sudo systemctl start tomcat
            sleep 15

            # Health Check
            echo "=== Health Check ==="
            curl -f http://localhost:8080/ || echo "⚠️ 앱 시작 중..."
            echo ""
            echo "=== WAR 배포 완료: $(date) ==="
```

> [!NOTE]
> WAR 배포는 Tomcat이 WAR를 자동으로 풀어서(explode) 배포합니다.  
> Tomcat 시작 후 WAR 파일이 풀리는 데 약 10~15초가 소요됩니다.

---

> [!TROUBLESHOOTING]
> | 증상 | 원인 | 해결 방법 |
> |------|------|-----------|
> | `Error: Process completed with exit code 1` (빌드 단계) | Gradle 빌드 실패 | 로컬에서 `./gradlew clean bootJar` 실행하여 에러 확인 |
> | YAML 파싱 에러 (`Invalid workflow file`) | 들여쓰기 오류 또는 탭 문자 사용 | YAML은 **스페이스만** 사용, 2칸 들여쓰기 확인 |
> | `Host key verification failed` | EC2 호스트 키 미등록 | `appleboy/ssh-action`은 자동 처리하므로 action 버전 확인 |
> | `Permission denied` (SCP 단계) | EC2 대상 디렉토리 권한 부족 | EC2에서 `mkdir -p /home/ec2-user/app && chmod 755 /home/ec2-user/app` 실행 |
> | 워크플로우가 트리거되지 않음 | `paths` 필터에 변경 파일 미포함 | 변경한 파일 경로가 `paths` 목록에 포함되는지 확인 |

> [!WARNING]
> YAML 파일에서 가장 흔한 실수:
>
> - **탭(Tab) 문자 사용** → 반드시 스페이스(Space)만 사용하세요
> - **콜론(:) 뒤 공백 누락** → `key: value` (콜론 뒤 공백 필수)
> - **하이픈(-) 뒤 공백 누락** → `- item` (하이픈 뒤 공백 필수)
>
> VS Code에서 YAML 확장 프로그램을 설치하면 문법 오류를 실시간으로 확인할 수 있습니다.

✅ **태스크 완료** — Spring Boot 자동 배포 워크플로우를 작성했습니다.

---

## 태스크 4: Vue.js 배포 워크플로우 작성

**프론트엔드 리포지토리**에서 Vue.js를 빌드하고 EC2의 Nginx 디렉토리에 배포합니다.

### 워크플로우 파일 생성

프론트엔드 리포지토리 루트에 `.github/workflows/deploy.yml` 파일을 생성합니다:

```yaml
# .github/workflows/deploy.yml (프론트엔드 리포지토리)
name: Deploy Vue.js to EC2

on:
  push:
    branches: [main]
    paths:
      - 'src/**'
      - 'package.json'
      - 'vite.config.*'
      - '.github/workflows/deploy.yml'

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest

    steps:
      # 1. 소스 코드 체크아웃
      - name: Checkout source code
        uses: actions/checkout@v4

      # 2. Node.js 설정
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'

      # 3. 의존성 설치
      - name: Install dependencies
        run: npm ci

      # 4. 프로덕션 빌드
      - name: Build for production
        run: npm run build

      # 5. 빌드 결과물을 EC2로 전송
      - name: Deploy to EC2
        uses: appleboy/scp-action@v0.1.7
        with:
          host: ${{ secrets.EC2_HOST }}
          username: ${{ secrets.EC2_USER }}
          key: ${{ secrets.EC2_KEY }}
          source: 'dist/*'
          target: '/home/ec2-user/frontend-deploy/'
          strip_components: 1

      # 6. Nginx 디렉토리에 복사 및 재시작
      - name: Update Nginx and restart
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.EC2_HOST }}
          username: ${{ secrets.EC2_USER }}
          key: ${{ secrets.EC2_KEY }}
          script: |
            echo "=== 프론트엔드 배포 시작: $(date) ==="

            # 새 빌드 파일 복사
            sudo rm -rf /usr/share/nginx/html/*
            sudo cp -r /home/ec2-user/frontend-deploy/* /usr/share/nginx/html/
            sudo chown -R nginx:nginx /usr/share/nginx/html/

            # Nginx 설정 테스트 및 재로드
            sudo nginx -t && sudo systemctl reload nginx

            # 정리
            rm -rf /home/ec2-user/frontend-deploy

            echo "=== 프론트엔드 배포 완료: $(date) ==="
```

> [!TIP]
> `npm ci`는 `npm install`과 달리 `package-lock.json`을 기반으로 정확한 버전을 설치합니다.  
> CI/CD 환경에서는 항상 `npm ci`를 사용하세요.  
> 빌드 결과물의 일관성을 보장합니다.

> [!NOTE]
> 별도 레포이므로 `working-directory`가 필요 없습니다.  
> 프로젝트 루트에서 바로 `npm ci`, `npm run build`를 실행합니다.

### 환경 변수 주입 (선택)

Vue.js 빌드 시 API URL 등의 환경 변수를 주입할 수 있습니다:

10. GitHub Secrets에 `API_URL` 추가: `http://<EC2-IP>` 또는 도메인
11. 워크플로우 빌드 단계에 `env` 추가:

```yaml
- name: Build for production
  run: npm run build
  env:
    VITE_API_URL: ${{ secrets.API_URL }}
```

12. Vue.js 코드에서 사용: `import.meta.env.VITE_API_URL`

> [!TROUBLESHOOTING]
> | 증상 | 원인 | 해결 방법 |
> |------|------|-----------|
> | `npm ci` 실패 (`package-lock.json` 관련) | `package-lock.json` 미커밋 | 로컬에서 `npm install` 후 `package-lock.json`을 git에 포함 |
> | 빌드 성공했지만 페이지 빈 화면 | API URL 미설정 또는 잘못된 값 | Nginx 리버스 프록시 설정 확인 (Step 2-3 태스크 7) |
> | Nginx reload 실패 | Nginx 설정 파일 문법 오류 | EC2에서 `sudo nginx -t`로 설정 검증 |

> [!NOTE]
> 별도 레포에서는 `cache-dependency-path`를 지정하지 않아도 됩니다.  
> `package-lock.json`이 루트에 있으므로 자동으로 캐시됩니다.

✅ **태스크 완료** — Vue.js 프론트엔드 자동 배포 워크플로우를 작성했습니다.

---

## 태스크 5: 배포 테스트

작성한 워크플로우가 정상 동작하는지 테스트합니다.

### 배포 트리거

13. 코드를 수정합니다 (예: API 응답 메시지 변경).
14. Git에 커밋하고 push합니다:

```bash
git add .
git commit -m "feat: update API response message"
git push origin main
```

### GitHub Actions 실행 확인

15. GitHub 리포지토리 페이지에서 **Actions** 탭을 클릭합니다.
16. 방금 트리거된 워크플로우를 클릭합니다.
17. 각 스텝의 실행 상태를 확인합니다:

- ✅ 녹색 체크: 성공
- ❌ 빨간 X: 실패 (로그 확인 필요)
- 🟡 노란 원: 실행 중

> [!OUTPUT]
> 모든 스텝이 성공하면 워크플로우 옆에 ✅ 녹색 체크가 표시됩니다.  
> 전체 실행 시간은 보통 1~3분 정도 소요됩니다.

### 배포 결과 확인

18. 브라우저에서 서비스에 접속하여 변경사항이 반영되었는지 확인합니다:

```bash
# Spring Boot API 확인
curl http://EC2_PUBLIC_IP:8080/actuator/health

# 또는 도메인이 설정된 경우
curl https://api.yourdomain.com/actuator/health
```

> [!OUTPUT]
>
> ```json
> { "status": "UP" }
> ```

### 실패 시 디버깅

워크플로우가 실패한 경우:

19. Actions 탭에서 실패한 워크플로우를 클릭합니다.
20. 실패한 스텝을 클릭하여 로그를 확인합니다.
21. 일반적인 실패 원인:

| 에러                            | 원인                       | 해결                        |
| ------------------------------- | -------------------------- | --------------------------- |
| `Permission denied (publickey)` | SSH 키가 잘못됨            | EC2_KEY Secret 재확인       |
| `Connection timed out`          | EC2 IP 오류 또는 SG 미설정 | EC2_HOST 확인, 포트 22 열기 |
| `Build failed`                  | 코드 컴파일 에러           | 로컬에서 빌드 테스트        |
| `Health check failed`           | 앱 시작 실패               | EC2에서 로그 확인           |

✅ **태스크 완료** — 배포를 트리거하고 결과를 확인했습니다.

> [!TROUBLESHOOTING]
> | 증상 | 원인 | 해결 방법 |
> |------|------|-----------|
> | Actions 탭에 워크플로우 미표시 | YAML 파일이 default 브랜치에 없음 | `main` 브랜치에 `.github/workflows/` 파일이 있는지 확인 |
> | push 했는데 워크플로우 미실행 | `on.push.branches`에 현재 브랜치 미포함 | `branches: [main]`과 push 대상 브랜치 일치 확인 |
> | 모든 스텝 성공인데 앱 미동작 | Health Check가 앱 시작 전에 실행됨 | `sleep` 시간을 늘리거나 retry 로직 추가 |
> | `Error: Timeout` (SSH 단계) | EC2 Security Group에서 22번 포트 미허용 | SG Inbound에 SSH(22) 규칙 추가 |

---

## 태스크 6: 워크플로우 개선

기본 워크플로우에 실용적인 기능을 추가합니다.

### 6-1. Health Check 강화

```yaml
- name: Health Check with retry
  uses: appleboy/ssh-action@v1
  with:
    host: ${{ secrets.EC2_HOST }}
    username: ${{ secrets.EC2_USER }}
    key: ${{ secrets.EC2_KEY }}
    script: |
      echo "Health Check 시작 (최대 30초 대기)..."
      for i in $(seq 1 6); do
        if curl -sf http://localhost:8080/actuator/health > /dev/null; then
          echo "✅ Health Check 성공! (${i}번째 시도)"
          exit 0
        fi
        echo "대기 중... (${i}/6)"
        sleep 5
      done
      echo "❌ Health Check 실패!"
      exit 1
```

### 6-2. 수동 배포 트리거 (workflow_dispatch)

```yaml
on:
  push:
    branches: [main]
  workflow_dispatch: # 수동 실행 버튼 추가
    inputs:
      environment:
        description: '배포 환경'
        required: true
        default: 'prod'
        type: choice
        options:
          - prod
          - dev
```

> [!TIP]
> `workflow_dispatch`를 추가하면 Actions 탭에서 [[Run workflow]] 버튼이 나타납니다.  
> 긴급 배포나 특정 환경에 수동 배포할 때 유용합니다.

### 6-3. 배포 실패 시 Slack/Discord 알림

```yaml
# 워크플로우 마지막에 추가
- name: Notify on failure
  if: failure()
  uses: appleboy/ssh-action@v1
  with:
    host: ${{ secrets.EC2_HOST }}
    username: ${{ secrets.EC2_USER }}
    key: ${{ secrets.EC2_KEY }}
    script: |
      # 이전 JAR로 롤백
      echo "배포 실패! 이전 버전으로 롤백합니다..."
      cd /home/ec2-user/app
      if [ -f app.jar.backup ]; then
        cp app.jar.backup app.jar
        sudo systemctl restart spring-app
        echo "롤백 완료"
      fi
```

### 6-4. 배포 전 백업 추가

```yaml
- name: Backup current version
  uses: appleboy/ssh-action@v1
  with:
    host: ${{ secrets.EC2_HOST }}
    username: ${{ secrets.EC2_USER }}
    key: ${{ secrets.EC2_KEY }}
    script: |
      cd /home/ec2-user/app
      if [ -f app.jar ]; then
        cp app.jar app.jar.backup
        echo "현재 버전 백업 완료"
      fi
```

✅ **태스크 완료** — Health Check, 수동 트리거, 롤백 기능을 추가했습니다.

---

## 태스크 7: 환경 분리 (dev/prod 브랜치별 배포)

개발 환경과 프로덕션 환경을 분리하여 안전하게 배포합니다.

### GitHub Environments 설정

22. GitHub 리포지토리 → **Settings** → **Environments**
23. [[New environment]]를 클릭합니다.
24. **Name**: `production`을 입력하고 [[Configure environment]]를 클릭합니다.
25. **Environment protection rules**:

- ✅ **Required reviewers**: 프로덕션 배포 전 승인 필요 (선택)
- ✅ **Wait timer**: 배포 전 대기 시간 설정 (선택)

26. **Environment secrets**에 프로덕션 전용 Secrets를 추가합니다:

- `EC2_HOST`: 프로덕션 EC2 IP

27. 같은 방식으로 `development` 환경도 생성합니다.

### 브랜치별 배포 워크플로우

```yaml
# .github/workflows/deploy.yml
name: Deploy Application

on:
  push:
    branches:
      - main # 프로덕션 배포
      - develop # 개발 서버 배포

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: ${{ github.ref == 'refs/heads/main' && 'production' || 'development' }}

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up JDK 17
        uses: actions/setup-java@v4
        with:
          java-version: '17'
          distribution: 'corretto'

      - name: Build
        run: |
          chmod +x ./gradlew
          ./gradlew clean bootJar

      - name: Deploy
        uses: appleboy/scp-action@v0.1.7
        with:
          host: ${{ secrets.EC2_HOST }}
          username: ${{ secrets.EC2_USER }}
          key: ${{ secrets.EC2_KEY }}
          source: 'build/libs/*.jar'
          target: '/home/ec2-user/app/'
          strip_components: 2

      - name: Restart
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.EC2_HOST }}
          username: ${{ secrets.EC2_USER }}
          key: ${{ secrets.EC2_KEY }}
          script: |
            PROFILE=${{ github.ref == 'refs/heads/main' && 'prod' || 'dev' }}
            echo "배포 환경: $PROFILE"
            sudo systemctl restart spring-app
```

### 브랜치 전략

```
main (프로덕션)
 ↑ PR (코드 리뷰 + 승인)
develop (개발)
 ↑ merge
feature/xxx (기능 개발)
```

| 브랜치      | 배포 대상    | 자동/수동          | 승인 필요 |
| ----------- | ------------ | ------------------ | --------- |
| `main`      | 프로덕션 EC2 | 자동 (PR merge 시) | ✅ (선택) |
| `develop`   | 개발 EC2     | 자동 (push 시)     | ❌        |
| `feature/*` | 배포 안 함   | -                  | -         |

> [!CONCEPT] GitHub Environments의 장점
>
> - 환경별로 다른 Secrets를 사용할 수 있습니다 (prod/dev EC2 IP 분리).
> - 프로덕션 배포 전 승인(Required reviewers)을 강제할 수 있습니다.
> - 배포 이력을 환경별로 추적할 수 있습니다.
> - 대기 시간(Wait timer)을 설정하여 실수로 인한 즉시 배포를 방지할 수 있습니다.

✅ **태스크 완료** — 브랜치별 환경 분리 배포를 구성했습니다.

---

# 🗑️ 리소스 정리

> [!NOTE]
> GitHub Actions는 Public 리포지토리에서 완전 무료이며, Private 리포지토리도 월 2,000분 무료입니다.  
> 별도 비용이 발생하지 않습니다.

> [!WARNING]
> **GitHub Actions 비용 (Private 리포지토리만 해당)**
>
> | 항목                         | 무료 한도  | 초과 시 비용 |
> | ---------------------------- | ---------- | ------------ |
> | 실행 시간 (Linux)            | 월 2,000분 | $0.008/분    |
> | 실행 시간 (macOS)            | 월 200분   | $0.08/분     |
> | Storage (Artifacts/Packages) | 500MB      | $0.25/GB     |
>
> Public 리포지토리는 완전 무료입니다. 비용이 걱정된다면 리포를 Public으로 유지하세요.

### 삭제 순서 (의존 관계)

```
1. 워크플로우 비활성화/삭제 ← 자동 배포 중단 (먼저!)
2. GitHub Secrets 삭제      ← 민감 정보 제거 (보안)
3. EC2 systemd 서비스 삭제  ← 배포된 앱 제거
```

> [!TIP]
> 워크플로우를 먼저 비활성화하지 않으면, Secrets를 삭제한 후에도 push 시 워크플로우가 실행되어 에러가 발생합니다.

---

### 단계 1: 워크플로우 비활성화/삭제

자동 배포를 중단하려면 워크플로우를 비활성화하거나 파일을 삭제합니다.

**비활성화 (워크플로우 유지, 실행만 중단):**

28. GitHub 리포지토리 → **Actions** 탭
29. 왼쪽에서 비활성화할 워크플로우를 선택합니다.
30. 우측 상단 `...` → [[Disable workflow]]

**파일 삭제 (완전 제거):**

```bash
# 각 레포에서 실행
rm .github/workflows/deploy.yml
git add .
git commit -m "chore: remove deployment workflow"
git push origin main
```

---

### 단계 2: GitHub Secrets 삭제 (선택)

31. GitHub 리포지토리 → **Settings** → **Secrets and variables** → **Actions**
32. 각 Secret(`EC2_HOST`, `EC2_USER`, `EC2_KEY`, `DB_URL`, `DB_PASSWORD`) 옆의 🗑️ 아이콘을 클릭하여 삭제합니다.

> [!NOTE]
> Secrets는 무료이므로 유지해도 비용이 발생하지 않습니다.  
> 보안상 더 이상 사용하지 않는 SSH 키는 삭제하는 것이 좋습니다.

---

### 단계 3: EC2 systemd 서비스 삭제 (선택)

GitHub Actions로 배포한 서비스를 EC2에서 제거합니다.

```bash
# EC2에 SSH 접속 후 실행
sudo systemctl stop spring-app
sudo systemctl disable spring-app
sudo rm /etc/systemd/system/spring-app.service
sudo systemctl daemon-reload

# 배포된 애플리케이션 파일 삭제
rm -rf /home/ec2-user/app
```

---

### 단계 4: 삭제 확인

33. GitHub Actions 탭에서 워크플로우가 비활성화/삭제되었는지 확인합니다.
34. EC2에서 `sudo systemctl status spring-app` 실행 시 "not found" 메시지가 표시되는지 확인합니다.

✅ **실습 종료**: 모든 리소스가 정리되었습니다.

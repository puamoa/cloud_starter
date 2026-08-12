---
title: 'Dockerfile + docker-compose (로컬)'
week: 9
session: 1
awsServices: []
learningObjectives:
  - 백엔드(Spring) Dockerfile을 작성하고 이미지를 빌드할 수 있습니다.
  - 프론트엔드(Vue.js + Nginx) Dockerfile을 멀티스테이지로 작성할 수 있습니다.
  - Nginx 리버스 프록시를 설정하여 프론트/백엔드를 연동할 수 있습니다.
  - docker-compose로 프론트엔드 + 백엔드 + MySQL을 한번에 실행할 수 있습니다.
  - 환경변수(.env)로 DB 접속 정보를 분리할 수 있습니다.
prerequisites:
  - Docker Desktop 설치 (macOS/Windows) 또는 Docker Engine 설치 (Linux)
  - 프론트엔드/백엔드 GitHub 리포지토리 준비 (Step 8 또는 샘플 리포 fork)
  - 기본적인 터미널 사용법
estimatedCost: 무료 (로컬 실행)
---

프론트엔드(Vue.js)와 백엔드(Spring)를 각각 Docker 이미지로 만들고,  
docker-compose로 로컬에서 **프론트 + 백엔드 + DB**를 한번에 실행합니다.

### 실습 흐름

```
[Docker 설치 확인] → [백엔드 Dockerfile] → [프론트 Dockerfile + nginx.conf] → [docker-compose.yml] → [로컬 실행 + 동작 확인]
```

### 최종 결과물

```
localhost:80  → Nginx (Vue.js 정적 파일 + /api 프록시)
                    ↓ /api/*
                backend:8080 (Spring)
                    ↓
                db:3306 (MySQL)
```

---

## 태스크 1: Docker 설치 확인

### 1-1. Docker Desktop 설치

📍 **실행 위치: 로컬 PC**

본인 운영체제에 맞는 방법을 선택합니다.

**macOS:**

1. [Docker Desktop for Mac](https://docs.docker.com/desktop/install/mac-install/) 페이지에서 본인 칩에 맞는 설치 파일을 다운로드합니다.
   - Apple Silicon (M1/M2/M3/M4): `Docker Desktop for Mac with Apple Silicon`
   - Intel: `Docker Desktop for Mac with Intel chip`
2. 다운로드된 `.dmg` 파일을 더블클릭합니다.
3. Docker 아이콘을 **Applications** 폴더로 드래그합니다.
4. Applications에서 **Docker**를 실행합니다.
5. 상단 메뉴바에 Docker 아이콘(고래)이 나타나면 설치 완료입니다.

**Windows:**

6. [Docker Desktop for Windows](https://docs.docker.com/desktop/install/windows-install/) 페이지에서 설치 파일을 다운로드합니다.
7. 다운로드된 `Docker Desktop Installer.exe`를 실행합니다.
8. 설치 과정에서 **Use WSL 2 instead of Hyper-V** 옵션이 체크되어 있는지 확인합니다.
9. 설치 완료 후 **Close and restart**를 클릭하여 PC를 재시작합니다.
10. 재시작 후 Docker Desktop이 자동 실행됩니다.

> [!WARNING]
> **WSL2 미설치 에러가 나오면:**
>
> PowerShell을 **관리자 권한**으로 열고 다음을 실행합니다:
>
> ```powershell
> wsl --install
> ```
>
> 설치 후 PC를 재시작하고 Docker Desktop을 다시 실행하세요.

> [!TIP]
> **Windows Home** 에디션에서도 Docker Desktop 사용 가능합니다 (WSL2 기반).  
> Windows 10 버전 2004 이상 또는 Windows 11이 필요합니다.

**Linux:**

- [Docker Engine 공식 설치 가이드](https://docs.docker.com/engine/install/) 참조
- Ubuntu: `sudo apt install docker.io docker-compose-v2`
- 설치 후 `sudo usermod -aG docker $USER` → 로그아웃/로그인

### 1-2. 설치 확인

11. 터미널(macOS/Linux) 또는 PowerShell(Windows)을 열고 다음 명령어를 실행합니다:

```bash
docker --version
```

12. docker-compose 버전도 확인합니다:

```bash
docker compose version
```

> [!OUTPUT]
>
> ```
> Docker version 27.x.x, build xxxxxxx
> Docker Compose version v2.x.x
> ```

> [!NOTE]
> 최신 Docker Desktop에서는 `docker-compose`(하이픈) 대신 `docker compose`(스페이스)가 기본입니다.  
> 둘 다 동일하게 동작하며, 이 가이드에서는 `docker-compose`(하이픈)를 사용합니다.

13. Docker가 정상 실행되는지 테스트합니다:

```bash
docker run hello-world
```

> [!OUTPUT]
>
> ```
> Hello from Docker!
> This message shows that your installation appears to be working correctly.
> ```

> [!TROUBLESHOOTING]
> | 증상 | 원인 | 해결 방법 |
> |------|------|-----------|
> | `docker: command not found` | Docker 미설치 또는 PATH 미등록 | Docker Desktop 재설치 후 터미널 재시작 |
> | `Cannot connect to the Docker daemon` | Docker Desktop 미실행 | Docker Desktop 앱을 실행하세요 |
> | Windows에서 `WSL 2 is not installed` | WSL2 미설치 | PowerShell(관리자): `wsl --install` 후 재부팅 |
> | macOS에서 `permission denied` | Docker Desktop 미실행 | 상단 메뉴바에서 Docker 아이콘 확인, 앱 실행 |

✅ **태스크 완료** — Docker가 정상 설치되었습니다.

---

## 태스크 2: 프로젝트 구조 준비

### 2-1. 작업 디렉토리 구성

14. 작업할 디렉토리를 만듭니다:

```bash
mkdir ~/step9-docker
cd ~/step9-docker
```

15. 프론트엔드와 백엔드 리포지토리를 clone합니다:

```bash
# 본인 리포지토리로 변경하세요
git clone https://github.com/<username>/my-frontend.git frontend
git clone https://github.com/<username>/my-backend.git backend
```

> [!TIP]
> Step 8에서 만든 리포가 있다면 그대로 사용하세요.  
> 없다면 샘플 리포를 fork하여 사용할 수 있습니다.

16. 최종 디렉토리 구조를 확인합니다:

```
~/step9-docker/
├── frontend/          ← Vue.js 프로젝트
│   ├── src/
│   ├── package.json
│   └── (Dockerfile은 이 실습에서 생성)
├── backend/           ← Spring 프로젝트
│   ├── src/
│   ├── build.gradle
│   └── (Dockerfile은 이 실습에서 생성)
├── sql/               ← DB 초기화 파일 (이 실습에서 생성)
├── docker-compose.yml ← (이 실습에서 생성)
├── .env               ← (이 실습에서 생성)
└── nginx.conf         ← (이 실습에서 생성)
```

✅ **태스크 완료** — 프로젝트 구조를 준비했습니다.

---

## 태스크 3: 백엔드 Dockerfile 작성

📍 **실행 위치: 로컬 PC (`~/step9-docker/backend/`)**

본인 프로젝트에 맞는 방법을 선택합니다:

- **방법 A**: Spring Boot (JAR) — `java -jar`로 실행
- **방법 B**: Spring Legacy MVC (WAR) — Tomcat에 배포

---

### 방법 A: Spring Boot (JAR) Dockerfile

17. `backend/Dockerfile`을 생성합니다:

```dockerfile
# ──── 1단계: 빌드 (Gradle + JDK) ────
FROM eclipse-temurin:17-jdk-alpine AS build
WORKDIR /app

# Gradle Wrapper 복사 + 의존성 캐싱
COPY gradlew build.gradle settings.gradle ./
COPY gradle ./gradle
RUN chmod +x ./gradlew && ./gradlew dependencies --no-daemon

# 소스 복사 + 빌드
COPY src ./src
RUN ./gradlew bootJar --no-daemon -x test

# ──── 2단계: 실행 (JRE만) ────
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=build /app/build/libs/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
```

> [!NOTE]
> 멀티스테이지 빌드를 사용합니다:
>
> - 1단계: JDK + Gradle로 빌드 (이미지에 포함 안 됨)
> - 2단계: JRE만 포함된 경량 이미지로 실행
>
> 최종 이미지 크기: ~200MB (JDK 전체 포함 시 ~500MB)

---

### 방법 B: Spring Legacy MVC (WAR) Dockerfile

17. `backend/Dockerfile`을 생성합니다:

```dockerfile
# ──── 1단계: 빌드 (Gradle + JDK) ────
FROM eclipse-temurin:17-jdk-alpine AS build
WORKDIR /app

COPY gradlew build.gradle settings.gradle ./
COPY gradle ./gradle
RUN chmod +x ./gradlew && ./gradlew dependencies --no-daemon

COPY src ./src
RUN ./gradlew build --no-daemon -x test

# ──── 2단계: 실행 (Tomcat) ────
FROM tomcat:10-jre17
RUN rm -rf /usr/local/tomcat/webapps/*
COPY --from=build /app/build/libs/*.war /usr/local/tomcat/webapps/ROOT.war
EXPOSE 8080
```

> [!NOTE]
> WAR 파일은 Tomcat이 자동으로 풀어서(explode) 배포합니다.  
> `ROOT.war`로 복사하면 `/` 경로로 접근 가능합니다.

---

### 빌드 테스트 (방법 A/B 공통)

18. 이미지가 정상적으로 빌드되는지 테스트합니다:

```bash
cd ~/step9-docker/backend
docker build -t step9-backend:test .
```

> [!OUTPUT]
>
> ```
> [+] Building 45.2s (14/14) FINISHED
>  => [build 1/6] FROM eclipse-temurin:17-jdk-alpine
>  ...
>  => exporting to image
>  => => naming to docker.io/library/step9-backend:test
> ```

19. 빌드된 이미지를 확인합니다:

```bash
docker images | grep step9-backend
```

> [!TROUBLESHOOTING]
> | 증상 | 원인 | 해결 방법 |
> |------|------|-----------|
> | `gradlew: Permission denied` | 실행 권한 없음 | Dockerfile에 `RUN chmod +x ./gradlew` 확인 |
> | `COPY failed: file not found` | 빌드 컨텍스트 외부 파일 | `docker build`를 프로젝트 루트에서 실행 |
> | Gradle 빌드 실패 | 의존성 다운로드 실패 | 로컬에서 `./gradlew build` 먼저 성공하는지 확인 |
> | `no main manifest attribute` | bootJar가 아닌 jar 사용 | `./gradlew bootJar` (Boot) 또는 WAR 방식 사용 |

✅ **태스크 완료** — 백엔드 Docker 이미지를 빌드했습니다.

---

## 태스크 4: 프론트엔드 Dockerfile + Nginx 설정

📍 **실행 위치: 로컬 PC (`~/step9-docker/`)**

### 4-1. nginx.conf 작성

20. 프로젝트 루트(`~/step9-docker/`)에 `nginx.conf`를 생성합니다:

```nginx
server {
    listen 80;
    server_name localhost;

    # Vue.js 정적 파일 서빙 + SPA 라우팅
    location / {
        root /usr/share/nginx/html;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # 백엔드 API 프록시 (본인 프로젝트에 맞게 수정)
    location /api/ {
        proxy_pass http://${BACKEND_HOST}:${BACKEND_PORT}/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

> [!TIP]
> **프로젝트별 프록시 경로 설정:**
>
> 본인 백엔드의 API 경로에 맞게 `location` 블록을 수정하세요:
>
> - Spring Boot REST API: `location /api/ { ... }` (위 예시 그대로)
> - Spring Legacy (board, member 등):
>   ```nginx
>   location ~ ^/(board|member|travel|upload)/ {
>       proxy_pass http://${BACKEND_HOST}:${BACKEND_PORT};
>       proxy_set_header Host $host;
>       proxy_set_header X-Real-IP $remote_addr;
>   }
>   ```
> - 정적 파일 외 모두 백엔드로:
>   ```nginx
>   location / {
>       root /usr/share/nginx/html;
>       try_files $uri $uri/ @backend;
>   }
>   location @backend {
>       proxy_pass http://${BACKEND_HOST}:${BACKEND_PORT};
>   }
>   ```

### 4-2. 프론트엔드 Dockerfile 작성

21. `frontend/Dockerfile`을 생성합니다:

```dockerfile
# ──── 1단계: 빌드 (Node.js) ────
FROM node:20-alpine AS build
WORKDIR /app

# 의존성 캐싱
COPY package*.json ./
RUN npm ci

# 소스 복사 + 빌드
COPY . .
RUN npm run build

# ──── 2단계: 실행 (Nginx) ────
FROM nginx:alpine

# 빌드 결과물을 Nginx 서빙 디렉토리에 복사
COPY --from=build /app/dist /usr/share/nginx/html

# Nginx 설정 (envsubst 템플릿)
COPY ../nginx.conf /etc/nginx/templates/default.conf.template

EXPOSE 80
```

> [!WARNING]
> `COPY ../nginx.conf`는 Docker 빌드 컨텍스트 밖의 파일을 참조하므로 에러가 발생합니다.  
> docker-compose에서 빌드 컨텍스트를 프로젝트 루트로 설정하거나, nginx.conf를 frontend/ 안에 두어야 합니다.
>
> 이 실습에서는 **docker-compose의 build context 설정**으로 해결합니다 (태스크 5에서 처리).

### 4-3. 프론트엔드 Dockerfile (수정 — nginx.conf 경로 대응)

실제로 사용할 Dockerfile:

```dockerfile
# ──── 1단계: 빌드 (Node.js) ────
FROM node:20-alpine AS build
WORKDIR /app

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ .
RUN npm run build

# ──── 2단계: 실행 (Nginx) ────
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/templates/default.conf.template

EXPOSE 80
```

> [!NOTE]
> docker-compose에서 `build.context: .` (프로젝트 루트)로 설정하고,  
> `build.dockerfile: Dockerfile.frontend`로 지정하면 루트의 nginx.conf에 접근할 수 있습니다.
>
> 이 구조는 태스크 5에서 docker-compose.yml을 작성할 때 확인합니다.

22. 프로젝트 루트에 `Dockerfile.frontend`를 생성합니다:

```dockerfile
# ~/step9-docker/Dockerfile.frontend
FROM node:20-alpine AS build
WORKDIR /app

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/templates/default.conf.template
EXPOSE 80
```

✅ **태스크 완료** — 프론트엔드 Dockerfile과 Nginx 설정을 작성했습니다.

---

## 태스크 5: docker-compose.yml 작성

📍 **실행 위치: 로컬 PC (`~/step9-docker/`)**

### 5-1. .env 파일 작성

23. 프로젝트 루트에 `.env` 파일을 생성합니다:

```bash
# ~/step9-docker/.env
DB_HOST=db
DB_PORT=3306
DB_NAME=appdb
DB_USER=root
DB_PASSWORD=devpassword123

# Spring 설정
SPRING_DATASOURCE_URL=jdbc:mysql://db:3306/appdb?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=Asia/Seoul
SPRING_DATASOURCE_USERNAME=root
SPRING_DATASOURCE_PASSWORD=devpassword123
```

24. `.env.example` 파일도 생성합니다 (git에 포함용):

```bash
# ~/step9-docker/.env.example (이 파일은 git에 커밋)
DB_HOST=db
DB_PORT=3306
DB_NAME=appdb
DB_USER=root
DB_PASSWORD=YOUR_PASSWORD_HERE

SPRING_DATASOURCE_URL=jdbc:mysql://db:3306/appdb?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=Asia/Seoul
SPRING_DATASOURCE_USERNAME=root
SPRING_DATASOURCE_PASSWORD=YOUR_PASSWORD_HERE
```

25. `.gitignore`에 `.env`를 추가합니다:

```bash
echo ".env" >> .gitignore
```

### 5-2. SQL 초기화 파일 준비

26. `sql/` 디렉토리를 만들고 초기화 파일을 준비합니다:

```bash
mkdir -p sql
```

27. `sql/01-schema.sql`에 테이블 생성 SQL을 작성합니다 (본인 프로젝트 기준):

```sql
-- sql/01-schema.sql
CREATE DATABASE IF NOT EXISTS appdb;
USE appdb;

-- 예시: 게시판 테이블
CREATE TABLE IF NOT EXISTS board (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    content TEXT,
    writer VARCHAR(50),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

> [!TIP]
> 본인 프로젝트의 스키마 SQL이 있다면 그대로 `sql/` 폴더에 넣으세요.  
> 파일명 앞에 번호를 붙이면 순서대로 실행됩니다: `01-schema.sql`, `02-data.sql` 등.
>
> CSV 데이터가 있다면 `03-load-csv.sh` 스크립트로 `LOAD DATA` 처리할 수 있습니다.

### 5-3. docker-compose.yml 작성

28. 프로젝트 루트에 `docker-compose.yml`을 생성합니다:

```yaml
services:
  # ─── 프론트엔드 (Nginx + Vue.js) ───
  frontend:
    build:
      context: .
      dockerfile: Dockerfile.frontend
    ports:
      - '80:80'
    environment:
      - BACKEND_HOST=backend
      - BACKEND_PORT=8080
    depends_on:
      backend:
        condition: service_healthy
    restart: unless-stopped

  # ─── 백엔드 (Spring Boot/Legacy) ───
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - '8080:8080'
    env_file:
      - .env
    depends_on:
      db:
        condition: service_healthy
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:8080/actuator/health']
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s
    restart: unless-stopped

  # ─── 데이터베이스 (MySQL) ───
  db:
    image: mysql:8.0
    environment:
      - MYSQL_ROOT_PASSWORD=${DB_PASSWORD}
      - MYSQL_DATABASE=${DB_NAME}
    ports:
      - '3306:3306'
    volumes:
      - db-data:/var/lib/mysql
      - ./sql:/docker-entrypoint-initdb.d
    healthcheck:
      test: ['CMD', 'mysqladmin', 'ping', '-h', 'localhost']
      interval: 5s
      timeout: 3s
      retries: 10
    restart: unless-stopped

volumes:
  db-data:
```

> [!NOTE]
> **주요 설정 설명:**
>
> - `depends_on.condition: service_healthy`: DB가 완전히 시작된 후에 백엔드 시작
> - `healthcheck`: 컨테이너가 정상 동작하는지 주기적으로 확인
> - `volumes.db-data`: MySQL 데이터를 Named Volume에 저장 (컨테이너 삭제해도 유지)
> - `./sql:/docker-entrypoint-initdb.d`: DB 첫 시작 시 SQL 파일 자동 실행
> - `env_file: .env`: 환경변수를 파일에서 로드

> [!TIP]
> **백엔드에 actuator가 없는 경우** (Spring Legacy 등):
>
> healthcheck를 다음으로 변경하세요:
>
> ```yaml
> healthcheck:
>   test: ['CMD', 'curl', '-f', 'http://localhost:8080/']
>   interval: 10s
>   timeout: 5s
>   retries: 5
>   start_period: 40s
> ```
>
> Tomcat WAR 배포는 시작에 시간이 더 걸리므로 `start_period`를 40초 이상으로 설정합니다.

✅ **태스크 완료** — docker-compose.yml과 환경 파일을 작성했습니다.

---

## 태스크 6: 로컬 실행 및 동작 확인

📍 **실행 위치: 로컬 PC (`~/step9-docker/`)**

### 6-1. 전체 서비스 실행

29. docker-compose로 모든 서비스를 시작합니다:

```bash
docker-compose up -d --build
```

> [!NOTE]
> `--build`: 이미지를 새로 빌드합니다. 코드 변경 후에는 항상 이 플래그를 붙이세요.  
> `-d`: 백그라운드 실행. 로그를 바로 보려면 `-d` 없이 실행합니다.

30. 서비스 상태를 확인합니다:

```bash
docker-compose ps
```

> [!OUTPUT]
>
> ```
> NAME                STATUS              PORTS
> step9-docker-db-1        Up (healthy)    0.0.0.0:3306->3306/tcp
> step9-docker-backend-1   Up (healthy)    0.0.0.0:8080->8080/tcp
> step9-docker-frontend-1  Up             0.0.0.0:80->80/tcp
> ```

31. 모든 서비스가 `Up` 상태가 될 때까지 대기합니다 (DB → Backend → Frontend 순서로 시작):

```bash
# 로그 실시간 확인
docker-compose logs -f
```

> [!TIP]
> 첫 실행 시 MySQL 초기화 + Gradle 빌드에 시간이 걸립니다 (2~5분).  
> `docker-compose logs -f db`로 DB 초기화 진행 상황을 확인할 수 있습니다.

### 6-2. 동작 확인

32. 브라우저에서 `http://localhost` 접속합니다.

- Vue.js 화면이 정상적으로 표시되면 프론트엔드 성공

33. API 프록시를 테스트합니다:

```bash
# 백엔드 직접 접근 테스트
curl http://localhost:8080/api/boards

# Nginx 프록시를 통한 접근 테스트 (프로덕션과 동일한 경로)
curl http://localhost/api/boards
```

34. DB 연결을 확인합니다:

```bash
# MySQL 컨테이너에 직접 접속
docker-compose exec db mysql -u root -pdevpassword123 appdb -e "SHOW TABLES;"
```

> [!TROUBLESHOOTING]
> | 증상 | 원인 | 해결 방법 |
> |------|------|-----------|
> | frontend `502 Bad Gateway` | backend가 아직 시작 안 됨 | `docker-compose logs backend`로 확인, 30초 대기 |
> | backend 시작 후 즉시 종료 | DB 연결 실패 | `.env`의 `SPRING_DATASOURCE_URL` 확인, DB healthcheck 상태 확인 |
> | DB `Access denied` | 비밀번호 불일치 | `.env`의 `DB_PASSWORD`와 `SPRING_DATASOURCE_PASSWORD` 일치 확인 |
> | `port is already allocated` | 로컬에 이미 같은 포트 사용 중 | 로컬 MySQL/Nginx 종료 또는 ports 변경 (`"3307:3306"`) |
> | Nginx에서 API 프록시 실패 | `BACKEND_HOST` 환경변수 미설정 | docker-compose.yml에서 frontend의 environment 확인 |
> | `npm run build` 실패 | Node.js 버전 또는 의존성 문제 | 로컬에서 `cd frontend && npm ci && npm run build` 먼저 확인 |

### 6-3. 서비스 중지 및 정리

35. 모든 서비스를 중지합니다:

```bash
# 컨테이너 중지 + 삭제 (DB 데이터는 Volume에 유지)
docker-compose down

# DB 데이터까지 완전 초기화하려면:
docker-compose down -v
```

> [!NOTE]
> `docker-compose down`은 컨테이너만 삭제합니다. Named Volume(`db-data`)은 유지됩니다.  
> 다음에 `docker-compose up`하면 이전 DB 데이터가 그대로 있습니다.
>
> 완전히 초기화하려면 `-v` 플래그를 추가하세요 (Volume도 삭제).

✅ **태스크 완료** — 로컬에서 프론트 + 백엔드 + DB를 Docker로 실행하고 동작을 확인했습니다.

---

## 마무리

### 이번 세션에서 배운 것

- Dockerfile 작성 (백엔드: JAR/WAR, 프론트엔드: 멀티스테이지)
- Nginx 리버스 프록시 설정 (정적 파일 + API 프록시)
- docker-compose로 멀티 컨테이너 로컬 환경 구성
- 환경변수 분리 (.env)
- Docker healthcheck + depends_on 의존 관계 설정

### 다음 단계

**9-2: ECR Push + Fargate 맛보기**에서는 이 이미지를 Amazon ECR에 Push하고, AWS Fargate에서 서버리스로 실행해봅니다.

> [!CONCEPT] 로컬에서 잘 돌아가는 이미지 = AWS에서도 동일하게 동작
> 이것이 Docker의 핵심 가치입니다. 로컬에서 검증한 이미지를 그대로 AWS에 올리면 됩니다.  
> 환경 차이로 인한 문제가 없습니다.

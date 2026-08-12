---
title: 'Docker + 컨테이너 이론'
week: 9
session: 0
type: theory
learningObjectives:
  - VM과 컨테이너의 차이를 설명하고, Docker의 핵심 개념을 이해할 수 있습니다.
  - Dockerfile과 docker-compose의 역할과 구조를 이해할 수 있습니다.
  - 멀티스테이지 빌드의 장점을 설명할 수 있습니다.
  - Amazon ECR과 DockerHub의 차이를 비교할 수 있습니다.
  - Amazon ECS/AWS Fargate의 개념과 Task/Service 구조를 이해할 수 있습니다.
  - DB를 컨테이너에 넣었을 때의 문제점과 분리하는 이유를 설명할 수 있습니다.
  - 컨테이너 환경에서 환경변수를 관리하는 다양한 방법을 이해할 수 있습니다.
  - VPC Endpoint의 역할과 필요성을 이해할 수 있습니다.
---

# Docker + 컨테이너 이론

---

## 1. 왜 Docker인가?

> [!CONCEPT] Docker가 해결하는 문제
> "내 컴퓨터에서는 잘 되는데 서버에서 안 돼요" — 개발자라면 한 번쯤 겪어본 문제입니다.  
> Docker는 애플리케이션과 실행 환경(OS, 라이브러리, 설정)을 하나의 패키지(이미지)로 묶어서 **어디서든 동일하게 실행**합니다.
>
> 마치 이사할 때 가구를 하나하나 옮기는 게 아니라, 컨테이너 박스에 모든 걸 넣어서 통째로 옮기는 것과 같습니다.

### Docker 없이 배포할 때 (Step 8 방식)

Step 8에서는 EC2에 직접 접속하여 Java를 설치하고, JAR 파일을 전송하고, systemd로 서비스를 등록했습니다.  
서버가 늘어나면 **같은 작업을 반복**해야 하고, 서버마다 환경이 미묘하게 다를 수 있습니다.

```
EC2 서버 세팅 과정 (수동):
1. Java 17 설치
2. 환경변수 설정 (DB_HOST, DB_PASSWORD...)
3. JAR 파일 전송
4. systemd 서비스 등록
5. 방화벽(Security Group) 확인
6. 실행 + 로그 확인

문제: 서버 3대면 이걸 3번 반복? 서버마다 Java 버전 다르면?
```

### Docker로 배포할 때 (Step 9 방식)

```
EC2 서버 세팅 과정 (Docker):
1. Docker 설치 (한 번만)
2. docker pull myapp:v1.0
3. docker run myapp:v1.0

끝. 서버 3대면 2~3번만 반복. Java? 이미지 안에 포함되어 있음.
```

### Step 8 vs Step 9 비교

| 항목        | Step 8: EC2 직접 배포                  | Step 9: Docker 배포                 |
| ----------- | -------------------------------------- | ----------------------------------- |
| 서버 세팅   | Java 설치, 환경변수, systemd 등록      | Docker만 설치하면 끝                |
| 환경 일관성 | EC2마다 다를 수 있음 (Java 버전, 설정) | 이미지 = 동일 환경 보장             |
| 배포 방식   | JAR/WAR 파일 전송 + 재시작             | 이미지 Pull + 컨테이너 교체         |
| 롤백        | 이전 JAR 수동 복원, 서비스 재시작      | `docker run myapp:v0.9` (이전 태그) |
| 로컬 테스트 | 로컬 환경 ≠ EC2 환경                   | `docker run`으로 동일 환경 테스트   |
| 확장        | 서버마다 동일하게 세팅 필요            | 이미지 Pull만 하면 동일 서버 완성   |
| 의존성 충돌 | 서버에 다른 앱 있으면 버전 충돌 가능   | 컨테이너 격리 (충돌 없음)           |

---

## 2. VM vs 컨테이너

> [!CONCEPT] VM과 컨테이너의 차이
> **VM**(가상 머신)은 하드웨어 위에 Hypervisor를 올리고 각 VM마다 독립된 OS를 실행합니다.  
> **컨테이너**는 Host OS의 커널을 공유하고, 프로세스 수준으로 격리합니다.
>
> 비유하자면:
>
> - VM = **아파트 한 채** (벽, 배관, 전기 모두 독립 — 무겁지만 완전 격리)
> - 컨테이너 = **셰어하우스 방** (벽은 있지만 배관·전기는 공유 — 가볍고 빠름)

### 구조 비교

```
VM (가상 머신):                      컨테이너 (Docker):
┌──────────────────────┐             ┌─────┐ ┌─────┐ ┌─────┐
│       App A          │             │App A│ │App B│ │App C│
├──────────────────────┤             ├─────┤ ├─────┤ ├─────┤
│  Guest OS (Linux)    │ ← 각각 OS   │Libs │ │Libs │ │Libs │
├──────────────────────┤             └──┬──┘ └──┬──┘ └──┬──┘
│     Hypervisor       │                │       │       │
├──────────────────────┤             ┌──┴───────┴───────┴───┐
│      Host OS         │             │    Docker Engine     │
└──────────────────────┘             ├──────────────────────┤
                                     │  Host OS (커널 공유) │
 시작: 분 단위                       └──────────────────────┘
 크기: GB 단위                        시작: 초 단위
                                      크기: MB 단위
```

### 상세 비교표

| 항목                | VM                          | 컨테이너                         |
| ------------------- | --------------------------- | -------------------------------- |
| **격리 수준**       | 완전 격리 (별도 OS)         | 프로세스 격리 (커널 공유)        |
| **시작 시간**       | 30초~수 분                  | 1~3초                            |
| **이미지 크기**     | 수 GB                       | 수십~수백 MB                     |
| **리소스 오버헤드** | 높음 (Guest OS 메모리 필요) | 낮음 (앱 프로세스만)             |
| **밀도**            | 하나의 서버에 수~수십 개    | 하나의 서버에 수십~수백 개       |
| **OS 선택**         | Linux/Windows 자유          | Host OS 커널 공유 (보통 Linux)   |
| **적합한 용도**     | 레거시 앱, 다른 OS 필요     | 마이크로서비스, CI/CD, 빠른 배포 |
| **AWS 서비스**      | Amazon EC2                  | Amazon ECS, AWS Fargate          |

> [!TIP]
> Docker는 Linux 커널 기반이므로 macOS/Windows에서는 내부적으로 가벼운 Linux VM을 실행합니다.  
> 이것이 Docker Desktop이 하는 일입니다.

---

## 3. Docker 핵심 개념

> [!CONCEPT] Docker의 핵심 요소
> Docker는 **이미지**(설계도)와 **컨테이너**(실행 인스턴스)라는 두 가지 핵심 개념으로 동작합니다.  
> 이미지를 한 번 만들면 어디서든 동일한 컨테이너를 실행할 수 있습니다.
>
> - **Dockerfile** → 레시피 (어떻게 만들지)
> - **Image** → 붕어빵 틀 (불변, 재사용)
> - **Container** → 구워진 붕어빵 (실행 중인 인스턴스, 여러 개 가능)

### 주요 용어

| 용어             | 설명                                               | 비유             |
| ---------------- | -------------------------------------------------- | ---------------- |
| **Dockerfile**   | 이미지를 만드는 설정 파일. 각 명령어가 레이어가 됨 | 요리 레시피      |
| **Image**        | 실행 가능한 불변 패키지 (읽기 전용)                | 붕어빵 틀        |
| **Container**    | 이미지를 실행한 인스턴스 (쓰기 가능, 삭제 가능)    | 구워진 붕어빵    |
| **Layer**        | 이미지의 각 변경사항 단위. 캐싱되어 빌드 속도 향상 | 레시피의 각 단계 |
| **Registry**     | 이미지를 저장·배포하는 원격 저장소                 | 앱스토어         |
| **Tag**          | 이미지의 버전 라벨 (`myapp:v1.0`, `myapp:latest`)  | 앱 버전          |
| **Volume**       | 컨테이너 외부에 데이터를 유지하는 저장소           | 외장 하드        |
| **Port Mapping** | 호스트 포트 ↔ 컨테이너 포트 연결 (`-p 80:8080`)    | 우편함 번호      |

### Docker 동작 흐름

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  1. Dockerfile 작성 (레시피)                                 │
│     FROM openjdk:17                                          │
│     COPY app.jar /app/app.jar                                │
│     CMD ["java", "-jar", "/app/app.jar"]                     │
│                                                              │
│  2. docker build (이미지 생성)                               │
│     $ docker build -t myapp:v1.0 .                           │
│     → Layer 1: openjdk:17 다운로드                           │
│     → Layer 2: app.jar 복사                                  │
│     → Layer 3: CMD 설정                                      │
│                                                              │
│  3. docker run (컨테이너 실행)                               │
│     $ docker run -p 8080:8080 myapp:v1.0                     │
│     → 이미지를 기반으로 컨테이너 생성 + 실행                 │
│                                                              │
│  4. docker push (레지스트리에 공유)                          │
│     $ docker push ecr.aws/myapp:v1.0                         │
│     → 다른 서버에서 pull해서 동일하게 실행 가능              │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 레이어 캐싱

Docker는 Dockerfile의 각 명령어를 레이어로 캐싱합니다. 변경되지 않은 레이어는 재사용하므로 빌드가 빨라집니다.

```dockerfile
# 순서가 중요! 자주 변경되는 것을 아래에 배치
FROM eclipse-temurin:17-jre-alpine     # ← 거의 변경 안 됨 (캐시 O)
WORKDIR /app                            # ← 거의 변경 안 됨 (캐시 O)
COPY build/libs/*.jar app.jar           # ← 코드 변경 시 여기부터 재빌드
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
```

> [!TIP]
> `COPY package*.json ./` → `RUN npm install` → `COPY . .` 순서로 작성하면 소스 코드만 변경했을 때 `npm install` 레이어가 캐시되어 빌드 시간이 크게 단축됩니다.

### 기본 명령어

| 명령어                                       | 설명                     | 예시                                    |
| -------------------------------------------- | ------------------------ | --------------------------------------- |
| `docker build -t <이름> .`                   | Dockerfile로 이미지 빌드 | `docker build -t myapp:v1 .`            |
| `docker run -p <호스트>:<컨테이너> <이미지>` | 이미지로 컨테이너 실행   | `docker run -p 8080:8080 myapp:v1`      |
| `docker run -d`                              | 백그라운드 실행          | `docker run -d -p 80:80 nginx`          |
| `docker run -e KEY=VALUE`                    | 환경변수 주입            | `docker run -e DB_HOST=localhost myapp` |
| `docker ps`                                  | 실행 중인 컨테이너 목록  |                                         |
| `docker stop <id>`                           | 컨테이너 정지            |                                         |
| `docker logs <id>`                           | 컨테이너 로그 확인       |                                         |
| `docker images`                              | 로컬 이미지 목록         |                                         |
| `docker push <registry>/<이미지>:<태그>`     | 레지스트리에 업로드      |                                         |
| `docker pull <registry>/<이미지>:<태그>`     | 레지스트리에서 다운로드  |                                         |

### Dockerfile 예시: Spring Boot (JAR)

```dockerfile
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY build/libs/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
```

### Dockerfile 예시: Spring Legacy (WAR + Tomcat)

```dockerfile
FROM tomcat:10-jre17
RUN rm -rf /usr/local/tomcat/webapps/*
COPY build/libs/*.war /usr/local/tomcat/webapps/ROOT.war
EXPOSE 8080
```

> [!NOTE]
> JAR은 내장 Tomcat으로 단독 실행하고, WAR은 Tomcat 이미지 위에 배포합니다.  
> 9-1 실습에서 본인 프로젝트에 맞는 Dockerfile을 작성합니다.

### 이미지 태그 전략

| 태그 방식     | 예시             | 장점                         | 단점                                |
| ------------- | ---------------- | ---------------------------- | ----------------------------------- |
| **latest**    | `myapp:latest`   | 항상 최신                    | 어떤 버전인지 알 수 없음, 롤백 불가 |
| **버전 번호** | `myapp:1.2.3`    | 명확한 버전 추적, 롤백 용이  | 수동 관리 필요                      |
| **Git SHA**   | `myapp:a1b2c3d`  | 커밋과 1:1 매핑, 정확한 추적 | 사람이 읽기 어려움                  |
| **날짜**      | `myapp:20260812` | 배포 시점 파악 쉬움          | 같은 날 여러 번 배포 시 구분 어려움 |

> [!WARNING]
> **프로덕션에서 `latest` 태그를 사용하지 마세요!**
>
> - `docker pull myapp:latest`는 매번 다른 이미지를 가져올 수 있음
> - 문제 발생 시 "어떤 버전에서 문제가 생겼는지" 추적 불가
> - 롤백 시 "이전 latest가 뭐였는지" 알 수 없음
>
> 권장: CI/CD에서 Git SHA 또는 버전 번호로 태그 자동 생성
>
> ```bash
> # GitHub Actions에서 자동 태그 예시
> docker build -t myapp:${{ github.sha }} .
> docker build -t myapp:v1.2.3 .
> ```

---

## 4. 멀티스테이지 빌드

> [!CONCEPT] 멀티스테이지 빌드란?
> 하나의 Dockerfile에서 **빌드 환경**과 **실행 환경**을 분리하는 기법입니다.
>
> 비유: 요리할 때 주방(빌드)에서 모든 도구를 사용하지만, 손님에게 내놓는 접시(실행)에는 완성된 요리만 담습니다.  
> 칼, 도마, 프라이팬은 접시에 넣지 않습니다.
>
> 빌드에 필요한 도구(Node.js 전체, Gradle, 소스 코드)는 최종 이미지에 포함되지 않으므로 이미지 크기가 줄어들고 보안도 향상됩니다.

### 프론트엔드 멀티스테이지 빌드

```dockerfile
# ──── 1단계: 빌드 환경 (node + npm) ────
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci                    # 의존성 설치
COPY . .
RUN npm run build             # dist/ 폴더 생성

# ──── 2단계: 실행 환경 (nginx만) ────
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/templates/default.conf.template
EXPOSE 80

# 최종 이미지에는 node, npm, 소스코드가 없음!
# nginx + 빌드된 정적 파일만 포함 → 이미지 크기 ~30MB
```

### 싱글스테이지 vs 멀티스테이지

| 항목               | 싱글스테이지                   | 멀티스테이지           |
| ------------------ | ------------------------------ | ---------------------- |
| 최종 이미지에 포함 | 빌드 도구 + 소스 + 결과물 전부 | 결과물만               |
| 이미지 크기        | ~1GB (Node.js 전체 포함)       | ~30MB (nginx + dist만) |
| 보안               | 소스 코드 노출 가능            | 최소한의 파일만 포함   |
| 빌드 속도          | 매번 전체                      | 레이어 캐싱 활용       |

### 백엔드 멀티스테이지 빌드 (Spring Boot)

```dockerfile
# ──── 1단계: 빌드 (Gradle + JDK) ────
FROM eclipse-temurin:17-jdk-alpine AS build
WORKDIR /app
COPY gradlew build.gradle settings.gradle ./
COPY gradle ./gradle
RUN chmod +x ./gradlew && ./gradlew dependencies --no-daemon
COPY src ./src
RUN ./gradlew bootJar --no-daemon -x test

# ──── 2단계: 실행 (JRE만) ────
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=build /app/build/libs/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]

# JDK(~300MB) 대신 JRE(~100MB)만 포함
# Gradle, 소스코드, 테스트 코드 미포함
```

> [!TIP]
> GitHub Actions에서 빌드한 JAR을 직접 복사하는 방식도 가능합니다.  
> 이 경우 멀티스테이지가 필요 없지만, **로컬에서도 동일하게 빌드**하려면 멀티스테이지가 편합니다.

---

## 5. docker-compose

> [!CONCEPT] docker-compose란?
> 여러 컨테이너를 **하나의 YAML 파일**로 정의하고 한번에 실행/중지하는 도구입니다.
>
> 비유: 오케스트라 악보처럼, 어떤 악기(컨테이너)가 어떤 타이밍에 무엇을 연주하는지(설정) 하나의 문서에 정리해두는 것입니다.
>
> 프론트엔드 + 백엔드 + DB처럼 여러 서비스를 로컬에서 쉽게 구성할 수 있으며, EC2 서버에서도 동일하게 사용할 수 있습니다.

### docker-compose.yml 구조

```yaml
services:
  # ─── 프론트엔드 (Nginx + Vue.js) ───
  frontend:
    build: ./frontend # frontend/ 디렉토리의 Dockerfile 사용
    ports:
      - '80:80' # 호스트 80 → 컨테이너 80
    environment:
      - BACKEND_HOST=backend # Nginx가 프록시할 백엔드 주소
      - BACKEND_PORT=8080
    depends_on:
      - backend # backend가 먼저 시작된 후 실행

  # ─── 백엔드 (Spring Boot/Legacy) ───
  backend:
    build: ./backend
    ports:
      - '8080:8080'
    env_file:
      - .env # 환경변수 파일에서 로드
    depends_on:
      - db

  # ─── 데이터베이스 (MySQL) ───
  db:
    image: mysql:8.0 # 공식 이미지 사용 (빌드 불필요)
    environment:
      - MYSQL_ROOT_PASSWORD=${DB_PASSWORD}
      - MYSQL_DATABASE=${DB_NAME}
    ports:
      - '3306:3306'
    volumes:
      - db-data:/var/lib/mysql # 데이터 영구 보존
      - ./sql:/docker-entrypoint-initdb.d # 초기 SQL 자동 실행

volumes:
  db-data: # Named Volume (컨테이너 삭제해도 유지)
```

### 서비스 간 통신

docker-compose 안의 서비스끼리는 **서비스명**으로 통신합니다:

```
frontend → backend:8080  (서비스명 = DNS)
backend  → db:3306       (서비스명 = DNS)
```

외부에서 접근할 때는 `ports`로 매핑된 호스트 포트를 사용합니다:

- 브라우저 → `http://localhost:80` → frontend 컨테이너
- DB 클라이언트 → `localhost:3306` → db 컨테이너

### Docker 네트워크 동작 원리

> [!CONCEPT] Docker 내부 DNS
> docker-compose를 실행하면 자동으로 **전용 네트워크**가 생성됩니다.  
> 이 네트워크 안에서 각 서비스의 이름이 DNS로 자동 등록됩니다.
>
> ```
> ┌─── docker-compose 네트워크 (myapp_default) ────┐
> │                                                │
> │  DNS: frontend → 172.18.0.2                    │
> │  DNS: backend  → 172.18.0.3                    │
> │  DNS: db       → 172.18.0.4                    │
> │                                                │
> │  → backend 컨테이너에서 `db:3306` 접속 가능    │
> │  → 외부에서는 접근 불가 (ports 매핑 제외)      │
> └────────────────────────────────────────────────┘
> ```
>
> 이 덕분에 IP 주소를 하드코딩하지 않고 서비스명으로 통신할 수 있습니다.  
> EC2에서 docker-compose를 실행해도 동일하게 동작합니다.

### Nginx 리버스 프록시

> [!CONCEPT] 리버스 프록시란?
> 클라이언트(브라우저)의 요청을 받아서 **내부 서버(백엔드)로 전달**해주는 중간 서버입니다.
>
> 왜 필요한가?
>
> - 프론트엔드(Vue.js)와 백엔드(Spring)가 다른 포트/서버에서 실행됨
> - 브라우저는 같은 도메인이 아니면 API 호출 시 CORS 에러 발생
> - Nginx가 중간에서 `/api/*` 요청을 백엔드로 전달하면 CORS 문제 해결
>
> ```
> 브라우저 → http://example.com/           → Nginx → Vue.js 정적 파일 응답
> 브라우저 → http://example.com/api/boards → Nginx → backend:8080/api/boards 프록시
> ```

이 실습에서 Nginx의 역할:

- **정적 파일 서빙**: Vue.js 빌드 결과(`dist/`)를 호스팅
- **SPA 라우팅**: `/about`, `/login` 등 클라이언트 라우팅 → `index.html`로 fallback
- **API 프록시**: `/api/*` 요청을 백엔드 컨테이너로 전달

```nginx
# nginx.conf 예시
server {
    listen 80;

    # Vue.js 정적 파일 서빙 + SPA 라우팅
    location / {
        root /usr/share/nginx/html;
        try_files $uri $uri/ /index.html;
    }

    # 백엔드 API 프록시
    location /api/ {
        proxy_pass http://${BACKEND_HOST}:${BACKEND_PORT}/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

> [!TIP]
> `${BACKEND_HOST}`는 환경변수입니다. Nginx 공식 이미지는 `/etc/nginx/templates/*.template` 파일을 시작 시 `envsubst`로 자동 치환합니다.
>
> - 로컬/EC2 (docker-compose): `BACKEND_HOST=backend` (서비스명)
> - Fargate (사이드카): `BACKEND_HOST=localhost` (같은 Task)
>
> **같은 이미지, 환경변수만 바꾸면 어디서든 동작합니다.**
>
> 프로젝트에 따라 프록시 경로가 다를 수 있습니다:
>
> - Spring Boot REST: `location /api/ { ... }`
> - Spring Legacy: `location ~ ^/(board|member|travel)/ { ... }`
> - 범용: 정적 파일에 없으면 백엔드로 → `try_files $uri @backend;`

### 주요 명령어

| 명령어                             | 설명                                       |
| ---------------------------------- | ------------------------------------------ |
| `docker-compose up -d`             | 모든 서비스 백그라운드 실행                |
| `docker-compose down`              | 모든 서비스 정지 + 컨테이너 삭제           |
| `docker-compose down -v`           | 컨테이너 + Volume까지 삭제 (데이터 초기화) |
| `docker-compose logs -f backend`   | 특정 서비스 로그 실시간 확인               |
| `docker-compose build`             | 이미지 재빌드 (코드 변경 후)               |
| `docker-compose ps`                | 서비스 상태 확인                           |
| `docker-compose exec backend bash` | 실행 중인 컨테이너에 접속                  |

### .env 파일 예시

```bash
# .env (git에 포함하지 않음 — .gitignore에 추가)
DB_HOST=db
DB_PORT=3306
DB_NAME=appdb
DB_USER=root
DB_PASSWORD=devpassword123
```

> [!WARNING]
> `.env` 파일은 **절대 git에 커밋하지 마세요.** `.gitignore`에 추가합니다.  
> 대신 `.env.example` 파일을 제공하여 어떤 변수가 필요한지 안내합니다.

---

## 6. 이미지 레지스트리: Amazon ECR vs DockerHub

> [!CONCEPT] 이미지 레지스트리란?
> Docker 이미지를 저장하고 배포하는 **원격 저장소**입니다.  
> Git이 코드를 GitHub에 저장하듯, Docker 이미지는 레지스트리에 저장합니다.
>
> - `docker push` → 레지스트리에 업로드
> - `docker pull` → 레지스트리에서 다운로드

### 비교표

| 항목                 | DockerHub                                  | Amazon ECR                        |
| -------------------- | ------------------------------------------ | --------------------------------- |
| **제공자**           | Docker Inc.                                | AWS                               |
| **기본 공개 설정**   | Public (기본)                              | Private (기본)                    |
| **무료 범위**        | Public 무제한, Private 1개                 | 500MB/월 무료                     |
| **Rate Limit**       | 익명 100 pull/6시간, 로그인 200 pull/6시간 | 같은 AWS 계정이면 제한 없음       |
| **인증**             | Docker ID + Password                       | IAM (AWS CLI 토큰, 12시간 유효)   |
| **ECS/Fargate 연동** | 가능하지만 rate limit 주의                 | 네이티브 연동 (IAM Role)          |
| **이미지 스캔**      | 유료 플랜                                  | 무료 (Amazon Inspector 연동)      |
| **적합한 상황**      | 오픈소스, 공개 이미지 배포                 | 프로덕션, 비공개 이미지, AWS 환경 |

> [!TIP]
> AWS에서 컨테이너를 운영한다면 **Amazon ECR이 표준**입니다.
>
> - IAM으로 접근 제어 → 별도 비밀번호 관리 불필요
> - 같은 리전이면 Pull 데이터 전송 비용 무료
> - ECS Task Execution Role이 자동으로 Pull 권한 가짐

### ECR 인증 방법

```bash
# AWS CLI로 ECR 로그인 (토큰 유효기간: 12시간)
aws ecr get-login-password --region ap-northeast-2 | \
  docker login --username AWS --password-stdin \
  <ACCOUNT_ID>.dkr.ecr.ap-northeast-2.amazonaws.com

# 이후 push/pull 가능
docker push <ACCOUNT_ID>.dkr.ecr.ap-northeast-2.amazonaws.com/myapp:v1.0
docker pull <ACCOUNT_ID>.dkr.ecr.ap-northeast-2.amazonaws.com/myapp:v1.0
```

### GitHub Actions에서 ECR 인증

```yaml
# CI/CD 워크플로우에서는 액션으로 자동 처리
- name: Login to Amazon ECR
  uses: aws-actions/amazon-ecr-login@v2
```

> [!NOTE]
> ECR 인증에 필요한 IAM 권한: `AmazonEC2ContainerRegistryPowerUser` (Push/Pull 모두 가능)  
> Pull만 필요하면: `AmazonEC2ContainerRegistryReadOnly`

---

## 7. AWS 컨테이너 서비스: ECS와 Fargate

> [!CONCEPT] Amazon ECS와 AWS Fargate
> **Amazon ECS**(Elastic Container Service)는 컨테이너를 관리(배포, 스케일링, 모니터링)하는 오케스트레이션 서비스입니다.
>
> **AWS Fargate**는 ECS의 실행 환경 중 하나로, 서버를 직접 관리하지 않고 컨테이너만 실행하는 서버리스 방식입니다.
>
> 비유:
>
> - ECS = 배달 플랫폼 (주문 접수, 배차, 상태 관리)
> - Fargate = 배달 기사 (직접 고용 안 해도 됨, 필요할 때만 호출)
> - EC2 Launch Type = 자사 배달 기사 (직접 고용·관리, 세밀한 제어 가능)

### 전체 구조

```
┌────────────────────────────────────────────────────────────┐
│                      Amazon ECS                            │
│                                                            │
│  ┌─── Cluster ─────────────────────────────────────────┐   │
│  │                                                     │   │
│  │  ┌─── Service A ────────────┐                       │   │
│  │  │  desired count: 2        │                       │   │
│  │  │  ┌──────┐  ┌──────┐      │                       │   │
│  │  │  │Task 1│  │Task 2│      │  ← 자동으로 2개 유지  │   │
│  │  │  └──────┘  └──────┘      │                       │   │
│  │  └──────────────────────────┘                       │   │
│  │                                                     │   │
│  │  ┌─── Service B ────────────┐                       │   │
│  │  │  desired count: 1        │                       │   │
│  │  │  ┌──────┐                │                       │   │
│  │  │  │Task 1│                │                       │   │
│  │  │  └──────┘                │                       │   │
│  │  └──────────────────────────┘                       │   │
│  │                                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                            │
│  실행 환경: EC2 (직접 관리) 또는 Fargate (서버리스)        │
└────────────────────────────────────────────────────────────┘
```

### 핵심 용어

| 용어                | 설명                                                     | 비유                              |
| ------------------- | -------------------------------------------------------- | --------------------------------- |
| **Cluster**         | 컨테이너를 실행하는 논리적 그룹                          | 공장                              |
| **Task Definition** | 컨테이너 실행 설정 (이미지, CPU, 메모리, 포트, 환경변수) | 제품 설계도                       |
| **Task**            | Task Definition을 기반으로 실행된 컨테이너 인스턴스      | 생산된 제품                       |
| **Service**         | Task를 원하는 개수만큼 유지·관리하는 단위                | 생산 라인 (불량 나오면 자동 교체) |

### Task Definition 구성 요소

```
Task Definition:
├── 컨테이너 정의 (1개 이상)
│   ├── 이미지 URI (ECR 또는 DockerHub)
│   ├── CPU / 메모리 할당
│   ├── 포트 매핑
│   ├── 환경변수
│   └── 로그 설정 (CloudWatch)
├── Task 실행 역할 (Execution Role) — ECR Pull, 로그 전송 권한
├── Task 역할 (Task Role) — 앱이 AWS 서비스 접근할 때 (선택)
└── 네트워크 모드 (awsvpc — Fargate 필수)
```

### ECS Launch Type 비교

| 항목          | EC2 Launch Type                                   | Fargate                     |
| ------------- | ------------------------------------------------- | --------------------------- |
| **서버 관리** | EC2 인스턴스 직접 관리 (OS 패치, Docker 업데이트) | 없음 (AWS 관리)             |
| **확장**      | EC2 수 + Task 수 모두 조절                        | Task 수만 조절              |
| **비용 모델** | EC2 인스턴스 시간당 과금                          | vCPU + 메모리 시간당 과금   |
| **시작 시간** | EC2 시작 + 컨테이너 시작                          | 컨테이너 시작만 (~30초)     |
| **적합**      | 대규모, GPU, 세밀한 네트워크 제어                 | 소~중규모, 운영 부담 최소화 |

### 사이드카 (Sidecar) 패턴

> [!CONCEPT] 사이드카 패턴
> 하나의 Task 안에 **2개 이상의 컨테이너**를 넣는 패턴입니다.  
> 같은 Task 안의 컨테이너끼리는 `localhost`로 통신합니다 (네트워크 네임스페이스 공유).
>
> docker-compose에서 서비스명(`backend:8080`)으로 통신하는 것과 유사하지만, 사이드카에서는 `localhost:8080`으로 통신합니다.

```
┌─────────── ECS Task (하나의 단위) ───────────┐
│                                              │
│  ┌──────────┐         ┌──────────┐           │
│  │  Nginx   │ ──:80──►│ Backend  │ :8080     │
│  │ (Vue.js) │         │ (Spring) │           │
│  └──────────┘         └──────────┘           │
│                                              │
│  Nginx → http://localhost:8080 으로 프록시   │
│  (같은 Task = 같은 네트워크)                 │
└──────────────────────────────────────────────┘
```

| 구성 방식                          | 통신 주소                | 스케일링                  |
| ---------------------------------- | ------------------------ | ------------------------- |
| **사이드카** (1 Task = 2 컨테이너) | `localhost:8080`         | 프론트+백엔드 함께 스케일 |
| **별도 Service** (각각 독립)       | 서비스 디스커버리 or ALB | 독립 스케일 가능          |

> [!NOTE]
> 이 실습(9-2)에서는 **사이드카 패턴**으로 Fargate를 체험합니다.  
> 소규모 서비스에서 간단하고, docker-compose 경험과 유사하여 이해하기 쉽습니다.

### 컨테이너 로그 확인 (CloudWatch Logs)

로컬에서는 `docker logs` 또는 `docker-compose logs`로 로그를 확인합니다.  
AWS(ECS/Fargate)에서는 컨테이너 로그가 자동으로 **Amazon CloudWatch Logs**에 전송됩니다.

```
로컬:   docker-compose logs -f backend  → 터미널에서 직접 확인
AWS:    ECS Task → CloudWatch Logs → 로그 그룹에서 확인
```

Task Definition에서 로그 설정:

```json
"logConfiguration": {
  "logDriver": "awslogs",
  "options": {
    "awslogs-group": "/ecs/step9-backend",
    "awslogs-region": "ap-northeast-2",
    "awslogs-stream-prefix": "ecs"
  }
}
```

> [!TIP]
> ECS Task Execution Role에 `AmazonECSTaskExecutionRolePolicy`를 연결하면 CloudWatch Logs 전송 권한이 자동으로 포함됩니다.  
> 배포 후 앱이 시작되지 않으면 CloudWatch Logs에서 에러 로그를 확인하세요.

---

## 8. DB를 컨테이너에 넣으면?

> [!CONCEPT] DB 컨테이너의 한계와 분리 이유
> 개발 환경에서 MySQL 컨테이너는 편리합니다 — 설치 없이 `docker-compose up` 한 방이면 DB가 준비됩니다.  
> 하지만 프로덕션에서는 심각한 문제가 발생합니다.
>
> 비유: 이삿짐(앱)은 컨테이너 박스에 넣어 옮기면 편하지만, 금고(DB)는 컨테이너에 넣으면 안전하지 않습니다. 금고는 은행(RDS)에 맡기는 게 맞습니다.

### 문제점

| 문제                | 설명                                                                            | 심각도 |
| ------------------- | ------------------------------------------------------------------------------- | :----: |
| **데이터 휘발성**   | 컨테이너 삭제 시 데이터 소멸. Volume으로 완화 가능하지만 서버 장애 시 복구 불가 |   🔴   |
| **고가용성 불가**   | 컨테이너 2대로 MySQL 이중화? 직접 Replication 구성해야 함 (매우 복잡)           |   🔴   |
| **자동 백업 없음**  | RDS는 자동 백업 + Point-in-time Recovery. 컨테이너는 cron + mysqldump 직접 구현 |   🟡   |
| **성능**            | 컨테이너 I/O 오버헤드, overlay 파일시스템 병목                                  |   🟡   |
| **패치/업그레이드** | RDS는 자동 패치. 컨테이너는 이미지 버전 직접 관리                               |   🟡   |
| **스케일링 충돌**   | 앱 컨테이너와 함께 스케일되면 DB도 증가 (의미 없음)                             |   🔴   |

### DB 데이터 공유 문제 (멀티 인스턴스)

앱 컨테이너가 2대 이상일 때, DB도 컨테이너라면:

```
┌─────────┐     ┌──────────┐
│  App 1  │────►│  DB 1    │  ← 데이터가 여기에만 있음
└─────────┘     └──────────┘

┌─────────┐     ┌──────────┐
│  App 2  │────►│  DB 2    │  ← 다른 데이터!
└─────────┘     └──────────┘

문제: 사용자마다 다른 DB에 접근 → 데이터 불일치
```

해결: 하나의 중앙 DB에 모든 앱이 접근해야 함 → **매니지드 DB (RDS)**

### 해결 방법 비교

| 방법                  | 설명                                        | 적합한 상황                    |
| --------------------- | ------------------------------------------- | ------------------------------ |
| **Amazon RDS**        | 매니지드 DB (자동 백업, Multi-AZ, 패치)     | ✅ 프로덕션 (이 실습에서 사용) |
| **EBS Volume 마운트** | EC2 EBS를 컨테이너에 마운트 (단일 인스턴스) | 소규모, 단일 서버              |
| **EFS 공유 스토리지** | 여러 인스턴스가 같은 파일시스템 공유        | 파일 공유용 (DB에는 성능 부족) |
| **Docker Volume**     | 호스트 디렉토리를 컨테이너에 마운트         | ✅ 로컬 개발 환경              |
| **StatefulSet (K8s)** | Kubernetes에서 상태 유지 Pod 관리           | 대규모 K8s 환경                |

### 이 실습에서의 전략

```
┌─────────── 로컬 개발 ───────────┐    ┌─────────── AWS 운영 ────────────┐
│                                 │    │                                 │
│  docker-compose                 │    │  EC2 (docker-compose)           │
│  ┌────┐ ┌────┐ ┌──────┐         │    │  ┌────┐ ┌────┐                  │
│  │ FE │ │ BE │ │MySQL │         │    │  │ FE │ │ BE │──────► RDS       │
│  └────┘ └────┘ └──────┘         │    │  └────┘ └────┘                  │
│         ▲ DB_HOST=db            │    │         ▲ DB_HOST=xxx.rds.aws   │
│                                 │    │                                 │
│  빠르고 간편                    │    │  고가용성, 자동 백업            │
└─────────────────────────────────┘    └─────────────────────────────────┘

같은 이미지, 환경변수(DB_HOST)만 다름!
```

---

## 9. 환경변수 관리

> [!CONCEPT] 같은 이미지, 다른 환경
> Docker의 핵심 가치 중 하나는 **하나의 이미지**를 개발/스테이징/프로덕션 어디서든 실행할 수 있다는 것입니다.  
> 환경에 따라 달라지는 값(DB 주소, API 키 등)은 **환경변수**로 외부에서 주입합니다.  
> 이미지 자체를 수정할 필요가 없습니다.

### 환경변수 주입 방법

| 방식                    | 설명                                              | 적합한 상황           |
| ----------------------- | ------------------------------------------------- | --------------------- |
| **`.env` 파일**         | docker-compose에서 `env_file: .env`로 로드        | 로컬 개발             |
| **`-e` 플래그**         | `docker run -e DB_HOST=xxx` 직접 지정             | 테스트, 단일 컨테이너 |
| **GitHub Secrets**      | CI/CD에서 `${{ secrets.DB_HOST }}`로 주입         | GitHub Actions 배포   |
| **SSM Parameter Store** | AWS 매니지드 키-값 저장소. IAM으로 접근 제어      | AWS 운영 환경         |
| **Secrets Manager**     | 민감 정보 전용 (자동 로테이션 지원)               | DB 비밀번호 등 고보안 |
| **ECS Task Definition** | `environment` 또는 `valueFrom` (SSM/Secrets 참조) | Fargate 배포          |

### 이 실습에서의 사용

| 환경                   | 방식                          | 이유                                 |
| ---------------------- | ----------------------------- | ------------------------------------ |
| 로컬 (docker-compose)  | `.env` 파일                   | 간단, `docker-compose up`만으로 실행 |
| CI/CD (GitHub Actions) | GitHub Secrets                | Step 8과 동일 패턴, 학습자에게 익숙  |
| Fargate (9-2)          | Task Definition `environment` | 콘솔에서 직접 설정                   |

### SSM Parameter Store 방식 (참고)

> [!TIP]
> **SSM Parameter Store로 환경변수를 관리하면:**
>
> - 중앙 관리: AWS 콘솔에서 값 변경 → 다음 배포 시 자동 반영
> - 접근 제어: IAM 정책으로 "dev팀은 /dev/*, 운영팀은 /prod/*만 접근"
> - 암호화: `SecureString` 타입으로 비밀번호를 KMS로 암호화 저장
> - ECS 연동: Task Definition에서 `valueFrom`으로 직접 참조
>
> ```bash
> # 파라미터 저장
> aws ssm put-parameter --name "/step9/db/host" --value "step9-db.xxx.rds.amazonaws.com" --type String
> aws ssm put-parameter --name "/step9/db/password" --value "MySecret123!" --type SecureString
>
> # EC2에서 읽어서 .env 생성
> DB_HOST=$(aws ssm get-parameter --name "/step9/db/host" --query "Parameter.Value" --output text)
> DB_PASS=$(aws ssm get-parameter --name "/step9/db/password" --with-decryption --query "Parameter.Value" --output text)
> echo "DB_HOST=$DB_HOST" > .env
> echo "DB_PASSWORD=$DB_PASS" >> .env
> ```
>
> Step 8-3에서 SSM에 DB 정보를 저장한 것과 동일한 패턴입니다.  
> 이 실습에서는 GitHub Secrets를 메인으로 사용하고, SSM은 대안으로 안내합니다.

---

## 10. VPC Endpoint

> [!CONCEPT] VPC Endpoint란?
> VPC 내부의 리소스(EC2, Fargate 등)가 **인터넷(NAT Gateway)을 거치지 않고** AWS 서비스에 직접 접근할 수 있게 해주는 Private 연결입니다.
>
> 비유: 회사 내부에서 은행(AWS 서비스)에 갈 때, 매번 정문(NAT)을 나가서 대로(인터넷)를 타는 대신, 회사와 은행 사이에 전용 터널을 뚫어두는 것입니다.
>
> **왜 필요한가?**  
> Private Subnet의 EC2/Fargate는 인터넷에 접근할 수 없습니다.  
> NAT Gateway($0.059/hr)를 쓰면 가능하지만 비용이 발생합니다.  
> VPC Endpoint를 사용하면 NAT 없이도 S3, ECR 등 AWS 서비스에 접근할 수 있습니다.

### NAT Gateway vs VPC Endpoint

```
방법 1: NAT Gateway 사용               방법 2: VPC Endpoint 사용
Private Subnet                          Private Subnet
    │                                       │
    ▼                                       ▼
NAT Gateway ($0.059/hr)                 VPC Endpoint
    │                                       │
    ▼                                       ▼
Internet Gateway                        AWS 서비스 (S3, ECR)
    │                                   (인터넷 안 거침,
    ▼                                    Private 네트워크)
AWS 서비스 (S3, ECR)

비용: NAT → 시간당 과금                비용: Gateway → 무료
      + 데이터 처리 비용                      Interface → 소액
```

### Endpoint 유형

| 유형                   | 비용                    | 대상 서비스                         | 동작 방식               |
| ---------------------- | ----------------------- | ----------------------------------- | ----------------------- |
| **Gateway Endpoint**   | **무료**                | S3, DynamoDB만                      | Route Table에 경로 추가 |
| **Interface Endpoint** | ~$0.01/hr + 데이터 전송 | ECR, SSM, CloudWatch, SQS 등 대부분 | ENI 생성 + Private DNS  |

### Gateway Endpoint (S3) 예시

```
Route Table에 자동 추가되는 규칙:
┌────────────────────────────────────────────────┐
│  Destination         │  Target                 │
│──────────────────────│─────────────────────────│
│  10.0.0.0/16         │  local                  │
│  pl-12345 (S3)       │  vpce-xxxxx (Endpoint)  │  ← 이게 추가됨
│  0.0.0.0/0           │  nat-xxxxx             │
└────────────────────────────────────────────────┘
```

S3로 가는 트래픽이 NAT를 거치지 않고 Endpoint를 통해 직접 전달됩니다.

### 이 실습에서의 활용

| 세션          | 네트워크 구성 | AWS 서비스 접근 방법                     |
| ------------- | ------------- | ---------------------------------------- |
| 9-2 (Fargate) | NAT 없음      | S3 Gateway Endpoint (콘솔에서 수동 생성) |
| 9-3 (EC2)     | NAT 있음      | NAT Gateway 통해 인터넷 접근             |

9-2에서 NAT 없이 구성하면:

- 비용 절감 ($0.059/hr × 24h × 30일 = **~$42/월** 절약)
- VPC Endpoint의 개념과 동작을 직접 체험
- "Private Subnet에서 AWS 서비스 접근하는 또 다른 방법"을 학습

> [!NOTE]
> Fargate에서 ECR 이미지를 Pull하려면 ECR에 접근할 수 있어야 합니다.
>
> - NAT Gateway가 있으면 → 인터넷 경유로 자동
> - NAT Gateway가 없으면 → ECR Interface Endpoint 필요 (또는 Public Subnet에 배치)
>
> 9-2 실습에서는 Fargate를 **Public Subnet**에 배치하여 ECR 접근 문제를 피하고,  
> S3 Gateway Endpoint만 수동으로 생성하여 학습합니다.

---

## 핵심 정리

| 개념              | 한 줄 요약                                                  |
| ----------------- | ----------------------------------------------------------- |
| Docker            | 앱 + 환경을 하나의 이미지로 패키징 → 어디서든 동일 실행     |
| 컨테이너 vs VM    | 컨테이너 = 가볍고 빠름 (커널 공유), VM = 무겁지만 완전 격리 |
| Dockerfile        | 이미지 빌드 설정 파일 (각 명령어 = 레이어)                  |
| docker-compose    | 여러 컨테이너를 YAML로 정의하고 한번에 실행                 |
| 멀티스테이지 빌드 | 빌드 환경과 실행 환경 분리 → 이미지 경량화                  |
| Amazon ECR        | AWS 전용 Private 이미지 레지스트리 (IAM 연동)               |
| Amazon ECS        | 컨테이너 오케스트레이션 (Task, Service 관리)                |
| AWS Fargate       | 서버 관리 없이 컨테이너 실행 (서버리스)                     |
| 사이드카          | 하나의 Task에 여러 컨테이너 (localhost 통신)                |
| DB 분리           | 프로덕션에서는 RDS (고가용성, 자동 백업, 데이터 공유)       |
| 환경변수          | 같은 이미지, 다른 환경 — .env / Secrets / SSM               |
| VPC Endpoint      | NAT 없이 AWS 서비스에 Private 접근 (비용 절감)              |

---

## Step 9 전체 구성

| 세션                | 주제                               | 핵심                            |
| ------------------- | ---------------------------------- | ------------------------------- |
| **9-0 (이번 세션)** | Docker + 컨테이너 이론             | 개념 학습                       |
| 9-1                 | Dockerfile + docker-compose (로컬) | 프론트+백엔드+DB 로컬 실행      |
| 9-2                 | ECR Push + Fargate 맛보기          | 서버리스 컨테이너, VPC Endpoint |
| 9-3                 | EC2 docker-compose 배포            | 비용 절감 운영 방식             |
| 9-4                 | GitHub Actions → ECR → EC2         | Docker CI/CD 파이프라인         |
| 9-5                 | (선택) CloudFront + Fargate        | 프로덕션 분리 구성              |
| 9-6                 | 리소스 정리                        | 전체 삭제                       |

---

## 다음 단계

이 이론을 바탕으로 **9-1: Dockerfile + docker-compose (로컬)** 실습에서 프론트엔드와 백엔드를 직접 Docker 이미지로 만들고, 로컬에서 풀스택을 실행해봅니다.

> [!NOTE]
> 9-1 실습에는 **Docker Desktop**이 설치되어 있어야 합니다.
>
> - macOS: [Docker Desktop for Mac](https://docs.docker.com/desktop/install/mac-install/)
> - Windows: [Docker Desktop for Windows](https://docs.docker.com/desktop/install/windows-install/) (WSL2 필요)
> - Linux: [Docker Engine 설치](https://docs.docker.com/engine/install/)

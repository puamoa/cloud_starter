# Step 9 Docker 실습 샘플 프로젝트

## 구성

| 폴더/파일       | 설명                                       |
| --------------- | ------------------------------------------ |
| `my-backend/`   | Spring MVC 백엔드 (WAR 패키징)             |
| `my-frontend/`  | Vue.js 프론트엔드                          |
| `sql/`          | DB 초기화 파일 (Docker & RDS 공용)         |
| `travel-image/` | 여행지 이미지 (S3 업로드용, 별도 다운로드) |

## 압축 파일

| 파일               | 내용                                   |
| ------------------ | -------------------------------------- |
| `step9-sample.zip` | 아래 3개 zip + README를 하나로 묶은 것 |
| `my-backend.zip`   | 백엔드 소스                            |
| `my-frontend.zip`  | 프론트엔드 소스                        |
| `sql.zip`          | SQL + CSV 초기화 파일                  |

## 여행지 이미지 다운로드 (별도)

이미지 파일(560개, ~324MB)은 용량이 커서 별도로 제공합니다:

**[travel-image.zip 다운로드 (Google Drive)](https://drive.google.com/file/d/10cNMIze0TbbEzu61UHCglrhhKZXqUBea/view?usp=drive_link)**

다운로드 후 프로젝트 루트에 압축 해제하면 `travel-image/` 폴더가 생성됩니다.
이 이미지들은 S3 업로드 실습에서 사용합니다.

## 사용법

### 1. 압축 해제

```bash
mkdir ~/step9-docker
cd ~/step9-docker
unzip step9-sample.zip
unzip my-backend.zip
unzip my-frontend.zip
unzip sql.zip
```

### 2. 디렉토리 구조

```
~/step9-docker/
├── my-backend/       ← Spring 프로젝트
├── my-frontend/      ← Vue.js 프로젝트
└── sql/              ← DB 초기화 파일
    ├── 00-init.sql
    ├── 01-board.sql
    ├── 02-member.sql
    ├── 03-travel.sql
    ├── 04-load-travel.sh
    ├── travel.csv
    └── travel_image.csv
```

### 3. 실습 가이드

Step 9-1부터 가이드를 따라 Dockerfile, docker-compose.yml, nginx.conf를 작성합니다.

## 참고

- 백엔드: Spring Legacy MVC (WAR 패키징) — Tomcat 10, JDK 17
- 프론트엔드: Vue.js 3 + Vite
- DB: MySQL 8.0 (myapp 데이터베이스)
- 앱 로그인 계정: `admin` / `1234` (sql/02-member.sql에서 생성, BCrypt 인코딩)
- MySQL root 비밀번호: `.env` 파일에서 설정 (가이드 참조)

> 본인 프로젝트가 Spring Boot(JAR)라면 가이드의 "방법 A" Dockerfile을 사용하세요.
> 이 샘플은 Spring Legacy(WAR)이므로 "방법 B" Dockerfile에 해당합니다.

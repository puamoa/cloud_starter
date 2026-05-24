---
title: 'Amazon EC2에 Vue 3 + Nginx 배포'
week: 2
session: 2
awsServices:
  - Amazon EC2
learningObjectives:
  - EC2에 Node.js 20 LTS를 설치할 수 있습니다.
  - Vue 3 프로젝트를 생성하고 프로덕션 빌드할 수 있습니다.
  - Nginx를 설치하고 SPA 라우팅을 설정할 수 있습니다.
  - 빌드된 정적 파일을 Nginx로 서빙할 수 있습니다.
prerequisites:
  - AWS 계정 생성 완료
  - EC2 인스턴스 실행 중 (Amazon Linux 2023, Public IP 할당)
  - Security Group에 HTTP(80) 포트 허용
estimatedCost: 크레딧 내 사용 가능 (비용 발생 가능)
---

이 실습에서는 EC2 인스턴스에 Node.js와 Nginx를 설치하고, Vue 3 프로젝트를 빌드하여 배포합니다. SPA(Single Page Application) 라우팅을 위한 Nginx 설정도 함께 구성합니다.

> [!NOTE]
> 이 실습은 EC2 인스턴스가 필요합니다. Step 2-1에서 생성한 EC2(`my-ec2-mysql`)를 사용하거나, 새로운 EC2 인스턴스를 생성합니다. Security Group에 HTTP(80) 포트가 열려 있어야 합니다.

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

✅ **태스크 완료**: EC2 인스턴스에 접속했습니다.

## 태스크 1: Node.js 20 LTS 설치

6. Node.js 20 LTS를 설치합니다 (Amazon Linux 2023 기본 리포지토리 사용):

```bash
sudo dnf module enable nodejs:20 -y
sudo dnf install nodejs -y
```

7. Node.js와 npm 버전을 확인합니다:

```bash
node --version
npm --version
```

> [!OUTPUT]
>
> ```
> v20.x.x
> 10.x.x
> ```

> [!NOTE]
> Amazon Linux 2023에서는 `dnf module` 명령으로 Node.js 버전을 선택할 수 있습니다. 20 LTS는 장기 지원 버전으로 안정적입니다.

✅ **태스크 완료**: Node.js 20 LTS가 설치되었습니다.

## 태스크 2: Vue 3 프로젝트 생성 및 빌드

8. 홈 디렉토리에서 Vue 3 프로젝트를 생성합니다:

```bash
cd ~
npm create vue@latest my-vue-app
```

9. 프로젝트 설정 프롬프트에서 다음과 같이 선택합니다:

```
✔ Add TypeScript? … No
✔ Add JSX Support? … No
✔ Add Vue Router for Single Page Application development? … Yes
✔ Add Pinia for state management? … No
✔ Add Vitest for Unit Testing? … No
✔ Add an End-to-End Testing Solution? … No
✔ Add ESLint for code quality? … No
✔ Add Vue DevTools 7 extension for debugging? … No
```

> [!TIP]
> Vue Router를 `Yes`로 선택해야 SPA 라우팅 테스트가 가능합니다. 나머지는 실습 목적상 `No`로 선택하여 간단하게 유지합니다.

10. 프로젝트 디렉토리로 이동하고 의존성을 설치합니다:

```bash
cd my-vue-app
npm install
```

11. 프로덕션 빌드를 실행합니다:

```bash
npm run build
```

> [!OUTPUT]
>
> ```
> vite v5.x.x building for production...
> ✓ xx modules transformed.
> dist/index.html                  0.xx kB │ gzip: 0.xx kB
> dist/assets/index-xxxxx.css      x.xx kB │ gzip: x.xx kB
> dist/assets/index-xxxxx.js      xx.xx kB │ gzip: xx.xx kB
> ✓ built in xxxms
> ```

12. 빌드 결과물을 확인합니다:

```bash
ls dist/
```

> [!NOTE]
> `dist/` 폴더에 `index.html`과 `assets/` 폴더가 생성됩니다. 이 정적 파일들을 Nginx로 서빙합니다.

✅ **태스크 완료**: Vue 3 프로젝트가 빌드되었습니다.

## 태스크 3: Nginx 설치

13. Nginx를 설치합니다:

```bash
sudo dnf install nginx -y
```

14. Nginx 서비스를 시작합니다:

```bash
sudo systemctl start nginx
```

15. Nginx를 부팅 시 자동 시작하도록 설정합니다:

```bash
sudo systemctl enable nginx
```

16. Nginx 상태를 확인합니다:

```bash
sudo systemctl status nginx
```

> [!OUTPUT]
>
> ```
> ● nginx.service - The nginx HTTP and reverse proxy server
>      Loaded: loaded (/usr/lib/systemd/system/nginx.service; enabled)
>      Active: active (running)
> ```

17. 브라우저에서 `http://<Public-IP>`로 접속하여 Nginx 기본 페이지가 표시되는지 확인합니다.

> [!WARNING]
> 페이지가 표시되지 않으면 Security Group에 HTTP(80) 포트가 열려 있는지 확인하세요.

✅ **태스크 완료**: Nginx가 설치되고 실행 중입니다.

## 태스크 4: Vue 빌드 파일 배포

18. Nginx의 기본 웹 루트 디렉토리를 정리합니다:

```bash
sudo rm -rf /usr/share/nginx/html/*
```

19. Vue 빌드 결과물을 Nginx 웹 루트로 복사합니다:

```bash
sudo cp -r ~/my-vue-app/dist/* /usr/share/nginx/html/
```

20. 파일 권한을 설정합니다:

```bash
sudo chown -R nginx:nginx /usr/share/nginx/html/
```

21. 브라우저에서 `http://<Public-IP>`로 접속하여 Vue 앱이 표시되는지 확인합니다.

> [!OUTPUT]
> Vue 3의 기본 Welcome 페이지가 표시됩니다. "You did it!" 메시지와 Vue 로고가 보이면 성공입니다.

✅ **태스크 완료**: Vue 빌드 파일이 Nginx에 배포되었습니다.

## 태스크 5: SPA 라우팅 설정 (try_files)

> [!CONCEPT] SPA 라우팅 문제
> Vue Router를 사용하는 SPA에서 `/about` 같은 경로로 직접 접속하면, Nginx는 `/about` 파일을 찾으려 합니다. 하지만 실제로는 `index.html` 하나로 모든 라우팅을 처리해야 합니다.
>
> `try_files` 지시어를 사용하면:
>
> 1. 요청된 URI에 해당하는 파일이 있으면 그 파일을 서빙
> 2. 없으면 `index.html`을 반환하여 Vue Router가 라우팅 처리

22. Nginx 설정 파일을 편집합니다:

```bash
sudo vi /etc/nginx/conf.d/vue-app.conf
```

23. 다음 내용을 입력합니다:

```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # SPA 라우팅: 파일이 없으면 index.html로 fallback
    location / {
        try_files $uri $uri/ /index.html;
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

24. 기본 서버 블록과 충돌하지 않도록 기본 설정을 수정합니다:

```bash
sudo vi /etc/nginx/nginx.conf
```

25. `server { }` 블록 내의 `listen 80` 부분을 주석 처리하거나, 해당 server 블록 전체를 주석 처리합니다:

```nginx
# 기존 server 블록을 주석 처리
#    server {
#        listen       80;
#        ...
#    }
```

> [!TIP]
> `/etc/nginx/nginx.conf`의 기본 server 블록과 `/etc/nginx/conf.d/vue-app.conf`가 동시에 80 포트를 사용하면 충돌합니다. 기본 블록을 비활성화하세요.

26. Nginx 설정 문법을 검증합니다:

```bash
sudo nginx -t
```

> [!OUTPUT]
>
> ```
> nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
> nginx: configuration file /etc/nginx/nginx.conf test is successful
> ```

27. Nginx를 재시작합니다:

```bash
sudo systemctl restart nginx
```

28. SPA 라우팅을 테스트합니다. 브라우저에서 `http://<Public-IP>/about`으로 직접 접속합니다.

> [!OUTPUT]
> Vue Router의 About 페이지가 정상적으로 표시됩니다. 404 에러가 아닌 Vue 앱이 로드되면 `try_files` 설정이 올바르게 동작하는 것입니다.

29. curl로도 확인합니다:

```bash
curl -I http://localhost/about
```

> [!OUTPUT]
>
> ```
> HTTP/1.1 200 OK
> Content-Type: text/html
> ```

✅ **태스크 완료**: SPA 라우팅이 설정되었습니다.

## 태스크 6: 배포 확인 및 최종 테스트

30. 브라우저에서 다음 URL들을 테스트합니다:
    - `http://<Public-IP>` → 메인 페이지
    - `http://<Public-IP>/about` → About 페이지 (새로고침해도 동작)
    - `http://<Public-IP>/assets/` → 정적 파일 (CSS, JS)

31. 서버에서 Nginx 액세스 로그를 확인합니다:

```bash
sudo tail -f /var/log/nginx/access.log
```

32. Ctrl+C로 로그 확인을 종료합니다.

> [!TIP]
> 배포 후 확인 체크리스트:
>
> - [ ] 메인 페이지 정상 로드
> - [ ] Vue Router 경로 직접 접속 시 정상 동작
> - [ ] 브라우저 새로고침 시 404 발생하지 않음
> - [ ] 정적 파일(CSS, JS) 정상 로드
> - [ ] gzip 압축 동작 확인 (`curl -H "Accept-Encoding: gzip" -I http://localhost`)

✅ **태스크 완료**: Vue 3 + Nginx 배포가 완료되었습니다.

## 마무리

다음을 성공적으로 수행했습니다:

- EC2에 Node.js 20 LTS를 설치했습니다.
- Vue 3 프로젝트를 생성하고 프로덕션 빌드했습니다.
- Nginx를 설치하고 빌드된 정적 파일을 배포했습니다.
- `try_files`를 사용하여 SPA 라우팅을 설정했습니다.
- gzip 압축과 정적 파일 캐싱을 구성했습니다.

# 🗑️ 리소스 정리

> [!NOTE]
> 이 실습에서 추가로 생성한 리소스는 EC2 내부의 소프트웨어(Node.js, Vue 프로젝트, Nginx)뿐입니다. EC2 인스턴스 자체의 비용은 Step 2-1을 참조하세요.

---

### 단계 1: EC2 내부 소프트웨어 삭제 (선택)

EC2 인스턴스를 계속 사용하지만 Vue.js/Nginx 환경을 정리하려면 다음 명령을 실행합니다.

```bash
# Vue 프로젝트 삭제
rm -rf ~/my-vue-app

# Nginx 설정 파일 삭제 및 서비스 중지
sudo rm /etc/nginx/conf.d/vue-app.conf
sudo systemctl stop nginx
sudo systemctl disable nginx

# Nginx 삭제 (필요한 경우)
sudo dnf remove nginx -y

# Node.js 삭제 (필요한 경우)
sudo dnf remove nodejs -y
```

> [!NOTE]
> EC2 인스턴스를 계속 사용할 예정이라면 Nginx와 Vue 앱을 그대로 유지해도 됩니다. EC2 내부 소프트웨어는 추가 비용이 발생하지 않습니다.

---

### 단계 2: EC2 인스턴스 정리

EC2 인스턴스 자체를 삭제하려면 **Step 2-1의 리소스 정리** 섹션을 참조하세요.

✅ **실습 종료**: 모든 리소스가 정리되었습니다.

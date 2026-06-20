---
title: 'Amazon EC2에 Vue 3 + Nginx 배포'
week: 2
session: 2
awsServices:
  - Amazon EC2
learningObjectives:
  - Amazon EC2에 Node.js 22 LTS를 설치할 수 있습니다.
  - Vue 3 프로젝트를 생성하고 프로덕션 빌드할 수 있습니다.
  - rsync, scp, git clone으로 프로젝트를 Amazon EC2에 전송할 수 있습니다.
  - Nginx를 설치하고 빌드된 정적 파일을 서빙할 수 있습니다.
  - SPA 라우팅 문제의 원인을 이해하고 try_files로 해결할 수 있습니다.
  - gzip 압축과 정적 파일 캐싱을 설정할 수 있습니다.
prerequisites:
  - AWS 계정 생성 완료
  - Amazon EC2 인스턴스 실행 중 (Amazon Linux 2023, Public IP 할당)
  - Security Group에 HTTP(80) 포트 허용
estimatedCost: 크레딧 내 사용 가능 (비용 발생 가능)
---

이 실습에서는 Amazon EC2 인스턴스에 Node.js와 Nginx를 설치하고, Vue 3 프로젝트를 빌드하여 배포합니다.  
SPA(Single Page Application) 라우팅을 위한 Nginx 설정도 함께 구성합니다.

> [!NOTE]
> 이 실습은 Amazon EC2 인스턴스가 필요합니다.  
> Step 2-1에서 생성한 EC2(`my-ec2-mysql`)를 사용하거나, 새로운 EC2 인스턴스를 생성합니다.  
> Security Group에 HTTP(80) 포트가 열려 있어야 합니다.  
> Amazon EC2가 없다면 [Step 2-1의 태스크 0(CloudFormation)과 태스크 1(EC2 생성)](/week/2/session/1)을 먼저 진행하세요.

### 실습 흐름

```
[로컬] 프로젝트 준비 → [로컬→EC2] 소스 업로드 → [EC2] 빌드 + Nginx 배포 → [브라우저] 확인
```

| 단계       | 실행 위치       | 내용                                           |
| ---------- | --------------- | ---------------------------------------------- |
| 태스크 0   | AWS 콘솔 + 로컬 | EC2 확인 및 SSH 접속                           |
| 태스크 1   | Amazon EC2 내부        | Node.js 설치, Swap 추가                        |
| 태스크 2   | 로컬 또는 EC2   | 프로젝트 업로드(git clone/rsync/scp) 또는 생성 |
| 태스크 3   | Amazon EC2 내부        | `npm install` + `npm run build`                |
| 태스크 4~5 | Amazon EC2 내부        | Nginx 설치 + 빌드 파일 배포                    |
| 태스크 6~7 | EC2 + 브라우저  | SPA 라우팅 설정 + 최종 테스트                  |

### 아키텍처 다이어그램

<img src="/images/step2/2-2-architecture.png" alt="Step 2-2 아키텍처 다이어그램" class="guide-img-lg" />

> [!TIP]
> Windows에서 로컬 빌드 후 `dist/`만 전송하는 경우(방법 A-③), 태스크 1(Node.js)과 태스크 3(빌드)을 건너뛸 수 있습니다.

> [!WARNING]
> Step 2-1에서 Amazon EC2를 Stop한 경우, 먼저 Start하고 새로운 Public IP를 확인한 후 진행하세요.
>
> **EC2 인스턴스 Start 방법:**
>
> 1. EC2 콘솔 → **Instances** → 해당 인스턴스 선택
> 2. **Instance state** 버튼 클릭 → **Start instance** 선택
>
>     <img src="/images/step2/2-2-step0-start-instance.png" alt="EC2 인스턴스 Start" class="guide-img-sm" />
>
> 3. Status check가 "3/3 checks passed"가 될 때까지 대기 (약 1분)
> 4. 새로 할당된 **Public IPv4 address**를 확인합니다
>
>     <img src="/images/step2/2-2-step0-new-public-ip.png" alt="새 Public IP 확인" class="guide-img-sm" />
>
> ⚠️ Stop → Start 시 **Public IP가 변경**됩니다. 이전 IP로 접속하면 실패합니다.  
> Elastic IP를 사용하지 않는 한, 매번 새 IP를 확인해야 합니다.

## 태스크 0: Amazon EC2 인스턴스 확인 및 접속

1. AWS Management Console에 로그인합니다.
2. 리전을 **Asia Pacific (Seoul) ap-northeast-2**로 설정합니다.

    <img src="/images/common/region-check.png" alt="리전 확인" class="guide-img-sm" />

> [!TIP]
> 일부 AWS 서비스(IAM, CloudFront, Route 53 등)는 **글로벌 서비스**이므로 리전 선택 드롭다운이 비활성화되거나 "Global"로 표시됩니다.  
> 이 실습에서 사용하는 서비스는 리전 기반이므로 반드시 올바른 리전이 선택되어 있는지 확인하세요.

3. EC2 콘솔에서 사용할 인스턴스가 `Running` 상태인지 확인합니다.
4. Public IPv4 address를 확인합니다.

    <img src="/images/step2/2-2-step0-new-public-ip.png" alt="Public IP 확인" class="guide-img-sm" />

5. SSH로 접속합니다:

**Mac/Linux:**

```bash
ssh -i ~/Downloads/my-keypair.pem ec2-user@<Public-IP>
```

**Windows:**

```powershell
ssh -i C:\Users\<사용자명>\Downloads\my-keypair.pem ec2-user@<Public-IP>
```

<img src="/images/step2/2-2-step5-ssh.png" alt="SSH 접속" class="guide-img-sm" />

> [!TIP]
> **Windows MobaXterm 사용자:**  
> Step 2-1에서 세션을 이미 만들었다면, 왼쪽 **Sessions** 탭 → 세션 **우클릭** → **Edit session** → **Remote host**를 새 IP로 변경 → [[OK]] → 더블클릭으로 접속합니다.  
> 처음이라면 [Step 2-1의 태스크 2(SSH 접속)](/week/2/session/1)를 참고하세요.

> [!NOTE]
> **Security Group에 HTTP(80) 포트가 열려 있는지 확인:**
>
> 1. EC2 콘솔 → 인스턴스 선택 → **Security** 탭 → Security Group 링크 클릭
> 2. **Inbound rules**에서 HTTP(80) 규칙이 있는지 확인
> 3. 없으면 [[Edit inbound rules]] → [[Add rule]] → Type: `HTTP`, Source: `0.0.0.0/0` → [[Save rules]]
>
> CloudFormation 템플릿으로 생성한 `my-ec2-sg`에는 HTTP(80)이 이미 포함되어 있습니다.
>
> <img src="/images/step2/2-2-step0-running.png" alt="EC2 Running 및 Security Group 확인" class="guide-img-sm" />

✅ **태스크 완료**: Amazon EC2 인스턴스에 접속했습니다.

## 태스크 1: Node.js 22 LTS 설치

6. Node.js 22 LTS를 설치합니다 (Amazon Linux 2023 기본 리포지토리 사용):

```bash
sudo dnf install nodejs22 -y
```

<img src="/images/step2/2-2-step6-node-install.png" alt="Node.js 설치" class="guide-img-sm" />

7. Node.js와 npm 버전을 확인합니다:

```bash
node --version
npm --version
```

<img src="/images/step2/2-2-step7-node-version.png" alt="Node.js 버전 확인" class="guide-img-sm" />

> [!OUTPUT]
>
> ```
> v22.x.x
> 10.x.x
> ```

> [!NOTE]
> Amazon Linux 2023에서는 `nodejs22` 패키지로 Node.js 22 LTS를 설치할 수 있습니다.
>
> **Node.js LTS 버전 정책:**
>
> | 버전           | 코드명  | 상태                          | 지원 종료      |
> | -------------- | ------- | ----------------------------- | -------------- |
> | Node.js 20     | Iron    | ❌ EOL (지원 종료)            | 2026년 4월     |
> | **Node.js 22** | **Jod** | **✅ LTS (이 실습에서 사용)** | **2027년 4월** |
> | Node.js 24     | -       | LTS (최신 LTS)                | 2028년 4월     |
>
> 이 실습에서는 **Node.js 22 LTS**를 사용합니다.  
> 안정적인 LTS 버전으로 보안 패치와 버그 수정이 활발히 이루어지며, Vue 3 및 대부분의 프론트엔드 빌드 도구와 호환됩니다.

> [!TROUBLESHOOTING]
> **Node.js 설치 실패 시:**
>
> - `No match for argument: nodejs22` → `sudo dnf list available | grep nodejs`로 사용 가능한 패키지 확인
> - 이미 다른 버전이 설치된 경우 → `sudo dnf remove nodejs -y` 후 `sudo dnf install nodejs22 -y` 재시도

✅ **태스크 완료**: Node.js 22 LTS가 설치되었습니다.

### Swap 메모리 추가 (t3.micro 사용 시 권장)

t3.micro 인스턴스는 RAM이 1GB뿐입니다.  
MySQL이 실행 중인 상태에서 `npm install`이나 `npm run build`를 실행하면 **메모리 부족으로 멈추거나 SSH 접속까지 불가능**해질 수 있습니다.

이를 방지하기 위해 Swap 메모리를 미리 추가합니다.

8. Swap 파일을 생성하고 활성화합니다:

```bash
sudo dd if=/dev/zero of=/swapfile bs=128M count=16
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

<img src="/images/step2/2-2-step8-swap-create.png" alt="Swap 파일 생성" class="guide-img-sm" />

9. Swap이 추가되었는지 확인합니다:

```bash
free -h
```

<img src="/images/step2/2-2-step9-swap-verify.png" alt="Swap 확인" class="guide-img-sm" />

> [!OUTPUT]
>
> ```
>                total        used        free      shared  buff/cache   available
> Mem:           949Mi       xxxMi       xxxMi       xxxMi       xxxMi       xxxMi
> Swap:          2.0Gi          0B        2.0Gi
> ```
>
> Swap 행에 `2.0Gi`가 표시되면 정상입니다.

10. 재부팅 후에도 Swap을 유지하려면:

```bash
echo '/swapfile swap swap defaults 0 0' | sudo tee -a /etc/fstab
```

<img src="/images/step2/2-2-step10-swap-fstab.png" alt="Swap fstab 등록" class="guide-img-sm" />

> [!NOTE]
> **왜 Swap이 필요한가요?**
>
> | 항목           | RAM만 사용           | RAM + Swap      |
> | -------------- | -------------------- | --------------- |
> | 총 가용 메모리 | 1GB                  | 1GB + 2GB = 3GB |
> | npm install    | 멈춤 가능 (OOM Kill) | 느리지만 완료됨 |
> | SSH 접속       | 불가능해질 수 있음   | 유지됨          |
>
> Swap은 디스크를 메모리처럼 사용하는 것이라 RAM보다 느리지만, 메모리 부족으로 시스템이 멈추는 것을 방지합니다.  
> `t3.small`(2GB) 이상을 사용하면 Swap 없이도 문제 없습니다.

---

## 태스크 2: 프로젝트 업로드 (또는 생성)

이미 Vue 3 프로젝트가 있다면 **방법 A**에서 선택하여 Amazon EC2에 올립니다.  
새로 시작한다면 **방법 B**에서 Amazon EC2에서 직접 프로젝트를 생성합니다.

> [!CONCEPT] 왜 소스를 Amazon EC2에 올리나요? 빌드한 결과만 올리면 안 되나요?
>
> **결론부터: 빌드 결과(`dist/`)만 올려도 됩니다.** 실제 프로덕션에서는 그게 더 일반적입니다.
>
> 하지만 이 실습에서 소스를 Amazon EC2에 올려서 빌드하는 이유:
>
> - Amazon EC2에서 빌드 → 배포의 **전체 흐름을 체험**하기 위해
> - 나중에 CI/CD(Step 8)에서 이 과정을 자동화할 때 동일한 흐름이 GitHub Actions에서 실행됨
> - Amazon EC2 환경에서 빌드가 정상 동작하는지 확인 (OS 차이로 실패할 수 있음)
>
> **실무에서의 배포 흐름 비교:**
>
> | 방식                            | 흐름                                      | 사용 상황                 |
> | ------------------------------- | ----------------------------------------- | ------------------------- |
> | Amazon EC2에서 빌드                    | 소스 업로드 → Amazon EC2에서 npm install + build | 학습, 소규모              |
> | 로컬/CI에서 빌드 후 결과만 전송 | 로컬에서 build → dist/ 만 scp             | Windows 사용자, 빠른 배포 |
> | CI/CD 자동화                    | git push → GitHub Actions가 빌드+배포     | Step 8에서 다룸           |

---

### 방법 A: 기존 프로젝트 업로드

본인 환경에 맞는 방법을 선택하세요:

| 방법                       | 조건                     | OS                       |
| -------------------------- | ------------------------ | ------------------------ |
| ① Git clone                | 프로젝트가 GitHub에 있음 | 모두                     |
| ② rsync                    | 프로젝트가 로컬에만 있음 | Mac / Linux / Git Bash   |
| ③ 로컬 빌드 후 dist만 전송 | 프로젝트가 로컬에만 있음 | **Windows (PowerShell)** |

---

**방법 ①: Git clone (프로젝트가 GitHub에 있는 경우) — 모든 OS**

프로젝트가 이미 GitHub에 push되어 있다면, Amazon EC2에서 직접 clone합니다.  
`node_modules/`는 `.gitignore`에 포함되어 있으므로 전송할 필요 없습니다.

📍 **실행 위치: EC2 (SSH 접속한 상태)**

```bash
git clone https://github.com/YOUR_USERNAME/my-vue-app.git ~/my-vue-app
```

> [!WARNING]
> **`YOUR_USERNAME`과 `my-vue-app` 부분을 본인의 실제 값으로 변경하세요.**
>
> 위 명령어를 그대로 복사하면 안 됩니다.  
> 메모장(또는 VS Code)에 먼저 붙여넣고, 본인의 GitHub 사용자명과 리포지토리 이름으로 수정한 후 EC2 터미널에 붙여넣으세요.
>
> **예시:**
>
> ```bash
> # 변경 전 (템플릿)
> git clone https://github.com/YOUR_USERNAME/my-vue-app.git ~/my-vue-app
>
> # 변경 후 (본인 값으로 수정)
> git clone https://github.com/kim-student/kb-frontend.git ~/my-vue-app
> ```
>
> GitHub에서 리포지토리 URL 복사하는 방법:  
> 리포지토리 페이지 → 녹색 [[<> Code]] 버튼 → HTTPS URL 복사

> [!NOTE]
> Private 리포지토리인 경우 GitHub Personal Access Token이 필요합니다:
>
> ```bash
> git clone https://<TOKEN>@github.com/YOUR_USERNAME/my-vue-app.git ~/my-vue-app
> ```
>
> Token 생성: GitHub → Settings → Developer settings → Personal access tokens → Generate new token (repo 권한 체크)

업로드 확인:

```bash
ls ~/my-vue-app/
```

> [!OUTPUT]
>
> ```
> index.html  package.json  src/  public/  vite.config.js  ...
> ```
>
> `package.json`과 `src/` 폴더가 보이면 정상입니다.

---

**방법 ②: rsync로 소스 전송 (Mac / Linux / Git Bash)**

프로젝트가 로컬에만 있고 GitHub에 올리지 않은 경우입니다.  
`rsync`의 `--exclude` 옵션으로 `node_modules/`를 제외하고 소스만 전송합니다.

> [!NOTE]
> `rsync`는 Mac과 Linux에 기본 설치되어 있습니다.  
> Windows에서는 **Git Bash** 또는 **WSL** 터미널에서 사용할 수 있습니다.  
> Windows PowerShell/CMD에서는 사용할 수 없습니다 → **방법 ③**을 사용하세요.

📍 **실행 위치: 로컬 PC (Mac 터미널 / Linux / Git Bash)**

```bash
rsync -avz --exclude 'node_modules' --exclude 'dist' \
  -e "ssh -i ~/Downloads/my-keypair.pem" \
  ./my-vue-app/ ec2-user@<Public-IP>:~/my-vue-app/
```

**Mac에서 `._` 파일이 같이 전송되는 경우** `--exclude '._*'`를 추가하세요:

```bash
rsync -avz --exclude 'node_modules' --exclude 'dist' --exclude '._*' \
  -e "ssh -i ~/Downloads/my-keypair.pem" \
  ./my-vue-app/ ec2-user@<Public-IP>:~/my-vue-app/
```

<img src="/images/step2/2-2-step-rsync.png" alt="rsync 전송" class="guide-img-sm" />

> [!WARNING]
> **명령어의 다음 부분을 본인 환경에 맞게 변경하세요:**
>
> | 변경할 부분                  | 설명                     | 예시                    |
> | ---------------------------- | ------------------------ | ----------------------- |
> | `~/Downloads/my-keypair.pem` | 키 파일 경로             | `~/.ssh/my-keypair.pem` |
> | `./my-vue-app/`              | 로컬 프로젝트 폴더 경로  | `./kb-frontend/`        |
> | `<Public-IP>`                | Amazon EC2 인스턴스의 Public IP | `3.35.123.456`          |
>
> 메모장에 먼저 붙여넣고 수정한 뒤 터미널에 실행하세요.

전송 후 Amazon EC2에서 확인:

```bash
ssh -i ~/Downloads/my-keypair.pem ec2-user@<Public-IP>
ls ~/my-vue-app/
```

<img src="/images/step2/2-2-step-rsync-verify.png" alt="rsync 전송 확인" class="guide-img-sm" />

> [!OUTPUT]
>
> ```
> index.html  package.json  src/  public/  vite.config.js  ...
> ```

---

**방법 ③: 로컬에서 빌드 후 dist만 전송 (Windows PowerShell/CMD)**

Windows에서는 `rsync`를 사용하기 어렵습니다. 대신 **로컬에서 먼저 빌드**하고, 결과물만 Amazon EC2에 전송합니다.

> [!NOTE]
> 이 방법을 사용하면 Amazon EC2에 Node.js가 설치되어 있지 않아도 됩니다.  
> **방법 ③을 선택한 경우 아래 A-2(EC2에서 빌드)는 건너뛰고 바로 태스크 4(Nginx 설치)로 이동합니다.**

📍 **실행 위치: 로컬 PC (Windows PowerShell 또는 CMD)**

```powershell
# 1. 프로젝트 디렉토리로 이동
cd C:\Users\사용자명\projects\my-vue-app

# 2. 의존성 설치 (이미 되어 있으면 생략)
npm install

# 3. 프로덕션 빌드
npm run build

# 4. 빌드 결과물(dist 폴더)을 EC2에 전송
scp -i C:\Users\사용자명\Downloads\my-keypair.pem -r .\dist\ ec2-user@<Public-IP>:~/dist/
```

<img src="/images/step2/2-2-step-scp-verify.png" alt="scp 전송" class="guide-img-sm" />

> [!WARNING]
>
> - `<Public-IP>`를 Amazon EC2의 실제 Public IP로 변경하세요
> - 키 파일 경로, 프로젝트 경로도 본인 환경에 맞게 수정하세요

전송 후 Amazon EC2에서 확인:

```bash
ls ~/dist/
```

<img src="/images/step2/2-2-step-scp-transfer.png" alt="scp 전송 확인" class="guide-img-sm" />

> [!OUTPUT]
>
> ```
> assets/  index.html
> ```
>
> `index.html`과 `assets/` 폴더가 보이면 정상입니다.

---

### 방법 B: 새 프로젝트 생성 (EC2에서 직접)

Vue 3 프로젝트가 없는 경우, Amazon EC2에서 직접 생성합니다.

📍 **실행 위치: EC2 (SSH 접속한 상태)**

11. Vue 3 프로젝트를 생성합니다:

```bash
cd ~
npm create vue@latest my-vue-app
```

<img src="/images/step2/2-2-step11-vue-create.png" alt="Vue 3 프로젝트 생성" class="guide-img-sm" />

> [!NOTE]
> 최초 실행 시 `Need to install the following packages: create-vue@x.x.x — Ok to proceed? (y)` 메시지가 나타납니다.  
> **`y`를 입력하고 엔터**를 누르세요. (최초 1회만 표시됩니다)

프로젝트 설정 프롬프트에서 다음과 같이 선택합니다:

```
◇ Use TypeScript?
│ No

◆ Select features to include in your project:
│ (↑/↓ 화살표로 이동, 스페이스바로 선택, 엔터로 확인)
│ ■ Router (SPA development)     ← 스페이스바로 선택
│ ■ Pinia (state management)     ← 스페이스바로 선택
│ 나머지는 선택하지 않음

◆ Select experimental features to include in your project:
│ 아무것도 선택하지 않고 엔터

◇ Skip all example code and start with a blank Vue project?
│ No
```

> [!TIP]
> **조작 방법:**
>
> - `↑` `↓` 화살표 키: 항목 간 이동
> - `스페이스바`: 항목 선택/해제 (■ 선택됨, □ 미선택)
> - `엔터`: 현재 선택 확인 후 다음 단계로
>
> **Router**와 **Pinia**를 선택하세요. Router는 SPA 라우팅 테스트에, Pinia는 상태 관리 학습에 활용됩니다.

> [!OUTPUT]
>
> ```
> Scaffolding project in /home/ec2-user/my-vue-app...
>
>   Done. Now run:
>
>     cd my-vue-app
>     npm install
>     npm run dev
> ```

12. 프로젝트 디렉토리로 이동하고 확인합니다:

```bash
cd my-vue-app
ls
```

<img src="/images/step2/2-2-step12-cd-project.png" alt="프로젝트 디렉토리 확인" class="guide-img-sm" />

> [!OUTPUT]
>
> ```
> index.html  package.json  src/  public/  vite.config.js
> ```

13. 기본 생성된 `src/App.vue`를 배포 확인용 화면으로 교체합니다:

```bash
cat > src/App.vue << 'EOF'
<script setup>
import { ref } from 'vue'
import { RouterLink, RouterView } from 'vue-router'

const serverInfo = ref({
  message: '🚀 Vue 3 + Nginx on EC2',
  deployedAt: new Date().toLocaleString('ko-KR'),
  environment: 'Amazon Linux 2023'
})
</script>

<template>
  <div id="app">
    <header>
      <h1>{{ serverInfo.message }}</h1>
      <p class="subtitle">EC2에서 Vue 3 앱이 정상 배포되었습니다!</p>
      <nav>
        <RouterLink to="/">Home</RouterLink>
        <RouterLink to="/about">About</RouterLink>
      </nav>
    </header>

    <main>
      <RouterView />
    </main>

    <footer>
      <div class="info-card">
        <p>📅 빌드 시각: {{ serverInfo.deployedAt }}</p>
        <p>🖥️ 환경: {{ serverInfo.environment }}</p>
        <p>⚡ Powered by Vite + Vue 3</p>
      </div>
    </footer>
  </div>
</template>

<style>
#app {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
  text-align: center;
}

h1 {
  color: #42b883;
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

.subtitle {
  color: #666;
  font-size: 1.1rem;
}

nav {
  margin: 1.5rem 0;
}

nav a {
  display: inline-block;
  padding: 0.5rem 1.5rem;
  margin: 0 0.5rem;
  background: #42b883;
  color: white;
  text-decoration: none;
  border-radius: 6px;
  transition: background 0.2s;
}

nav a:hover,
nav a.router-link-active {
  background: #35495e;
}

.info-card {
  margin-top: 2rem;
  padding: 1.5rem;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.info-card p {
  margin: 0.4rem 0;
  color: #555;
}
</style>
EOF
```

<img src="/images/step2/2-2-step13-app-vue.png" alt="App.vue 교체" class="guide-img-sm" />

> [!TIP]
> 이 화면은 배포 확인용 간단한 페이지입니다. Vue Router 링크가 포함되어 있어 태스크 6의 SPA 라우팅 테스트에도 활용됩니다.

✅ **태스크 완료**: 프로젝트가 Amazon EC2에 준비되었습니다.

---

## 태스크 3: 프로덕션 빌드

> **방법 A-③ (Windows 로컬 빌드)을 선택한 경우 이 태스크를 건너뛰고 태스크 4(Nginx 설치)로 이동하세요.**

📍 **실행 위치: EC2 (SSH 접속한 상태)**

방법 A-①(Git clone) 또는 A-②(rsync)로 소스를 업로드한 경우, Amazon EC2에서 빌드합니다.

14. 프로젝트 디렉토리로 이동합니다:

```bash
cd ~/my-vue-app
pwd
```

<img src="/images/step2/2-2-step14-cd-project.png" alt="프로젝트 디렉토리 이동" class="guide-img-sm" />

> [!OUTPUT]
>
> ```
> /home/ec2-user/my-vue-app
> ```

15. 프로젝트 파일이 있는지 확인합니다:

```bash
ls
```

> [!OUTPUT]
>
> ```
> index.html  package.json  src/  public/  vite.config.js  ...
> ```
>
> `package.json`이 보여야 합니다. 안 보이면 태스크 2로 돌아가 업로드를 확인하세요.

16. 의존성을 설치합니다:

```bash
npm install
```

<img src="/images/step2/2-2-step16-npm-install.png" alt="npm install" class="guide-img-sm" />

> [!OUTPUT]
>
> ```
> added xx packages in xxs
> ```

17. 프로덕션 빌드를 실행합니다:

```bash
npm run build
```

<img src="/images/step2/2-2-step17-npm-build.png" alt="npm run build" class="guide-img-sm" />

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

18. 빌드 결과물을 확인합니다:

```bash
ls dist/
```

<img src="/images/step2/2-2-step18-ls-dist.png" alt="빌드 결과물 확인" class="guide-img-sm" />

> [!OUTPUT]
>
> ```
> assets/  index.html
> ```
>
> `index.html`과 `assets/` 폴더가 보이면 빌드 성공입니다.

> [!TROUBLESHOOTING]
> **빌드 실패 시:**
>
> | 증상                                | 원인                             | 해결                                     |
> | ----------------------------------- | -------------------------------- | ---------------------------------------- |
> | `npm: command not found`            | Node.js 미설치                   | 태스크 1로 돌아가 Node.js 설치           |
> | `Missing dependencies`              | `npm install` 미실행             | `npm install` 먼저 실행                  |
> | `ENOENT: no such file or directory` | 프로젝트 경로 오류               | `pwd`로 현재 위치 확인, `ls`로 파일 확인 |
> | `npm install`이 멈추고 응답 없음    | 메모리 부족 (t3.micro = 1GB RAM) | 아래 Swap 추가 방법 참고                 |
>
> **`npm install` 또는 `npm run build`가 멈추는 경우 (t3.micro):**
>
> t3.micro(1GB RAM)에서 MySQL이 같이 실행 중이면 메모리가 부족하여 npm이 멈출 수 있습니다.  
> Swap 메모리를 추가하면 해결됩니다:
>
> ```bash
> # 새 터미널로 Amazon EC2에 접속하여 실행
> sudo dd if=/dev/zero of=/swapfile bs=128M count=16
> sudo chmod 600 /swapfile
> sudo mkswap /swapfile
> sudo swapon /swapfile
>
> # 확인 (Swap 2GB가 추가됨)
> free -h
> ```
>
> Swap 추가 후 멈춘 터미널에서 Ctrl+C로 중단하고 `npm install`을 다시 실행하세요.
>
> 재부팅 후에도 Swap을 유지하려면:
>
> ```bash
> echo '/swapfile swap swap defaults 0 0' | sudo tee -a /etc/fstab
> ```

✅ **태스크 완료**: 프로덕션 빌드가 완료되었습니다.

## 태스크 4: Nginx 설치

19. Nginx를 설치합니다:

```bash
sudo dnf install nginx -y
```

<img src="/images/step2/2-2-step19-nginx-install.png" alt="Nginx 설치" class="guide-img-sm" />

20. Nginx 서비스를 시작합니다:

```bash
sudo systemctl start nginx
```

21. Nginx를 부팅 시 자동 시작하도록 설정합니다:

```bash
sudo systemctl enable nginx
```

<img src="/images/step2/2-2-step21-nginx-enable.png" alt="Nginx enable" class="guide-img-sm" />

22. Nginx 상태를 확인합니다:

```bash
sudo systemctl status nginx
```

<img src="/images/step2/2-2-step22-nginx-status.png" alt="Nginx 상태 확인" class="guide-img-sm" />

> [!OUTPUT]
>
> ```
> ● nginx.service - The nginx HTTP and reverse proxy server
>      Loaded: loaded (/usr/lib/systemd/system/nginx.service; enabled)
>      Active: active (running)
> ```

> [!TIP]
> `Active: active (running)`과 `enabled`가 표시되면 정상입니다.  
> 화면 하단에 `(END)`가 표시되면 **`q`를 눌러 빠져나오세요** (페이저 종료).

23. 브라우저에서 `http://<Public-IP>`로 접속하여 Nginx 기본 페이지가 표시되는지 확인합니다.

    <img src="/images/step2/2-2-step23-nginx-browser.png" alt="Nginx 기본 페이지 확인" class="guide-img-sm" />

> [!WARNING]
> 페이지가 표시되지 않으면 Security Group에 HTTP(80) 포트가 열려 있는지 확인하세요.

> [!TROUBLESHOOTING]
> **Nginx 기본 페이지가 표시되지 않는 경우:**
>
> | 증상           | 원인                            | 해결 방법                                                                 |
> | -------------- | ------------------------------- | ------------------------------------------------------------------------- |
> | 연결 시간 초과 | Security Group에 80 포트 미허용 | EC2 콘솔 → Security Group → Inbound rules에 HTTP(80) 추가                 |
> | 연결 거부      | Nginx 미실행                    | `sudo systemctl status nginx`로 상태 확인 후 `sudo systemctl start nginx` |
> | 403 Forbidden  | 파일 권한 문제                  | `sudo chmod -R 755 /usr/share/nginx/html/`                                |

✅ **태스크 완료**: Nginx가 설치되고 실행 중입니다.

## 태스크 5: Vue 빌드 파일 배포

24. Nginx의 기본 웹 루트 디렉토리를 정리합니다:

```bash
sudo rm -rf /usr/share/nginx/html/*
```

<img src="/images/step2/2-2-step24-rm-html.png" alt="웹 루트 정리" class="guide-img-sm" />

25. Vue 빌드 결과물을 Nginx 웹 루트로 복사합니다:

**방법 A-①② 또는 방법 B (EC2에서 빌드한 경우):**

```bash
sudo cp -r ~/my-vue-app/dist/* /usr/share/nginx/html/
```

<img src="/images/step2/2-2-step25-cp-dist.png" alt="빌드 파일 복사" class="guide-img-sm" />

**또는 — 방법 A-③ (Windows에서 빌드 후 dist만 전송한 경우):**

```bash
sudo cp -r ~/dist/* /usr/share/nginx/html/
```

<img src="/images/step2/2-2-step25-cp-dist-win.png" alt="빌드 파일 복사 (Windows)" class="guide-img-sm" />

> [!TIP]
> 어디에 빌드 결과가 있는지 모르겠으면 `ls`로 확인하세요:
>
> ```bash
> ls ~/my-vue-app/dist/    # 방법 A-①②, 방법 B
> ls ~/dist/               # 방법 A-③ (Windows)
> ```
>
> `index.html`이 보이는 경로를 사용합니다.

26. 파일 권한을 설정합니다:

```bash
sudo chown -R nginx:nginx /usr/share/nginx/html/
```

27. 배포된 파일을 확인합니다:

```bash
ls -la /usr/share/nginx/html/
```

<img src="/images/step2/2-2-step27-ls-html.png" alt="배포 파일 확인" class="guide-img-sm" />

> [!OUTPUT]
>
> ```
> total xx
> drwxr-xr-x. 3 nginx nginx  xxx  ...  .
> drwxr-xr-x. 3 root  root   xxx  ...  ..
> drwxr-xr-x. 2 nginx nginx  xxx  ...  assets
> -rw-r--r--. 1 nginx nginx  xxx  ...  index.html
> ```
>
> `index.html`과 `assets/` 폴더가 `nginx` 소유자로 표시되면 정상입니다.

> [!NOTE]
> Nginx 프로세스는 `nginx` 사용자로 실행됩니다. 파일 소유자를 `nginx`로 변경해야 정상적으로 파일을 읽을 수 있습니다.

28. 브라우저에서 `http://<Public-IP>`로 접속하여 Vue 앱이 표시되는지 확인합니다.

    <img src="/images/step2/2-2-step28-vue-browser.png" alt="Vue 앱 확인" class="guide-img-sm" />

    <img src="/images/step2/2-2-step28-vue-browser2.png" alt="Vue 앱 확인 2" class="guide-img-sm" />

> [!OUTPUT]
> **방법 B (새 프로젝트):** Vue 3의 기본 Welcome 페이지가 표시됩니다. "🚀 Vue 3 + Nginx on EC2" 메시지가 보이면 성공입니다.
>
> **방법 A (기존 프로젝트):** 본인 프로젝트의 메인 페이지가 표시됩니다. (예: 로그인 화면, 홈페이지 등)

> [!TROUBLESHOOTING]
> **Vue 앱이 표시되지 않는 경우:**
>
> - **Nginx 기본 페이지가 계속 보임**: 브라우저 캐시를 삭제(Ctrl+Shift+R)하거나, `sudo ls /usr/share/nginx/html/`로 파일이 복사되었는지 확인
> - **403 Forbidden**: `sudo chown -R nginx:nginx /usr/share/nginx/html/` 재실행
> - **빈 페이지**: 브라우저 개발자 도구(F12) → Console 탭에서 에러 확인. JS/CSS 파일 경로 문제일 수 있음
> - **ERR_CONNECTION_REFUSED (연결 거부)**: 두 가지 원인이 있습니다:
>   1. **Nginx 미실행**: Amazon EC2에서 `sudo systemctl status nginx` 확인 → `active (running)`이 아니면 `sudo systemctl start nginx`
>   2. **브라우저가 HTTPS로 강제 전환**: 브라우저가 `http://`를 `https://`로 자동 변경하는 경우. Amazon EC2에 HTTPS(443) 설정이 없으면 연결 거부됨.
>      - **해결**: 시크릿 모드(Ctrl+Shift+N)로 `http://IP주소` 접속
>      - **또는**: Chrome에서 `chrome://net-internals/#hsts` → 하단 "Delete domain security policies"에 IP 입력 후 Delete 클릭
>      - Amazon EC2 내부에서 `curl http://localhost`가 정상 응답하면 Nginx는 문제 없고 브라우저 문제입니다

> [!NOTE]
> **기존 프로젝트(방법 A)를 배포한 경우:**  
> 화면은 정상적으로 표시되지만, 로그인·회원가입·게시판 등 **API를 호출하는 기능은 동작하지 않습니다.**  
> 백엔드(Spring)가 아직 배포되지 않았고, DB 연동도 안 되어 있기 때문입니다.  
> 이 단계에서는 **프론트엔드 화면이 정상적으로 뜨는 것**만 확인하면 됩니다.  
> 백엔드 배포와 DB 연동은 Step 2-3에서 진행합니다.
>
> **API 연동이 안 되는 이유와 해결 방법:**
>
> 프론트엔드에서 `/api/board` 같은 요청을 보내면, 현재 Nginx는 이 경로를 어디로 보내야 할지 모릅니다.
>
> | 상황                                      | API 요청 결과                         | 해결 방법                                       |
> | ----------------------------------------- | ------------------------------------- | ----------------------------------------------- |
> | 백엔드 미배포                             | 404 또는 네트워크 에러                | Step 2-3에서 백엔드 배포                        |
> | 백엔드 배포했지만 프록시 미설정           | 404 (Nginx가 `/api` 파일을 찾으려 함) | Nginx 리버스 프록시 설정                        |
> | **같은 서버**에 백엔드 배포 + 프록시 설정 | ✅ 정상                               | Step 2-3 태스크 7에서 설정                      |
> | **다른 서버**에 백엔드 배포               | API URL 변경 필요                     | 프론트엔드 환경변수 또는 Nginx 프록시 대상 변경 |
>
> 지금은 같은 Amazon EC2에 프론트엔드와 백엔드를 모두 배포할 예정이므로, Step 2-3에서 Nginx에 `/api → localhost:8080` 프록시를 추가하면 해결됩니다.
> 프론트엔드 코드의 API URL(`/api/...`)은 수정할 필요가 없습니다.

✅ **태스크 완료**: Vue 빌드 파일이 Nginx에 배포되었습니다.

## 태스크 6: SPA 라우팅 설정 (try_files)

배포한 Vue 앱에서 메인 페이지(`http://<Public-IP>`)는 정상적으로 보입니다.  
하지만 브라우저 주소창에 `http://<Public-IP>/about`을 **직접 입력하고 엔터**를 누르면 어떻게 될까요?

29. 404 문제를 확인합니다. Amazon EC2에서 다음을 실행하세요:

```bash
curl -I http://localhost/about
```

<img src="/images/step2/2-2-step29-curl-404.png" alt="curl 404 확인" class="guide-img-sm" />

<img src="/images/step2/2-2-step29-browser-404.png" alt="브라우저 404 확인" class="guide-img-sm" />

> [!OUTPUT]
>
> ```
> HTTP/1.1 404 Not Found
> ```

**404 에러가 발생합니다.** 이 문제를 이해하고 해결하는 것이 이 태스크의 핵심입니다.

---

### SPA 라우팅 문제란?

> [!CONCEPT] SPA에서 URL 직접 입력이 안 되는 이유
>
> **전통적인 웹사이트 (MPA: Multi Page Application):**
>
> ```
> /about 요청 → 서버에 about.html 파일이 존재 → 해당 파일 반환 ✅
> ```
>
> **SPA (Single Page Application):**
>
> ```
> /about 요청 → 서버에 about 파일이 없음 → 404 ❌
> ```
>
> SPA는 실제 파일이 `index.html` 하나뿐입니다.  
> `/about`, `/board/list` 같은 경로는 JavaScript(Vue Router)가 브라우저 내부에서 처리하는 **가상 경로**입니다.
>
> - **앱 내 링크 클릭** → Vue Router가 브라우저 URL만 변경 (서버 요청 없음) → ✅ 동작
> - **주소창에 직접 입력 / 새로고침** → 브라우저가 서버에 실제 요청 → 서버에 해당 파일 없음 → ❌ 404

### 언제 서버 설정이 필요한가?

SPA에서 모든 URL 이동이 문제인 것은 아닙니다. **서버에 실제 요청이 가는 경우**에만 문제가 됩니다:

| 사용자 동작                       | 누가 처리        | 서버에 요청     | 서버 설정 필요? |
| --------------------------------- | ---------------- | --------------- | --------------- |
| 앱 내 링크 클릭 (`<RouterLink>`)  | Vue/React Router | ❌ (URL만 변경) | ❌              |
| 브라우저 뒤로가기 / 앞으로가기    | Router           | ❌              | ❌              |
| **주소창에 URL 직접 입력 + 엔터** | **서버**         | ✅              | ✅              |
| **현재 페이지에서 새로고침 (F5)** | **서버**         | ✅              | ✅              |
| **다른 사이트에서 링크 클릭**     | **서버**         | ✅              | ✅              |
| **북마크에서 접속**               | **서버**         | ✅              | ✅              |

**핵심**: Router는 앱이 이미 로드된 상태에서만 동작합니다.  
앱이 아직 로드되지 않은 상태(직접 입력, 새로고침, 외부 링크)에서는 서버가 먼저 `index.html`을 반환해야 Router가 작동할 수 있습니다.

아래 4가지 방법은 모두 **"서버가 모르는 경로를 요청받았을 때 `index.html`을 돌려주는"** 역할을 합니다.  
그 이후 실제 페이지를 그리는 건 Router의 일입니다.

---

### SPA 라우팅 문제 해결 방법 비교

이 문제를 해결하는 방법은 여러 가지가 있습니다:

| 방법                             | 설정 위치              | 원리                                     | 장단점                                                   |
| -------------------------------- | ---------------------- | ---------------------------------------- | -------------------------------------------------------- |
| **① Nginx `try_files`**          | 서버 (Nginx 설정)      | 파일이 없으면 `index.html` 반환          | ✅ 깔끔한 URL, SEO 유리 / 서버 설정 필요                 |
| **② Vue Router Hash Mode**       | 프로젝트 (router 설정) | URL에 `#` 사용하여 서버 요청 회피        | ✅ 서버 설정 불필요 / ❌ URL이 지저분 (`/#/about`)       |
| **③ Spring Boot 포워딩**         | 백엔드 (Java 컨트롤러) | API 외 모든 경로를 `index.html`로 포워딩 | ✅ 모놀리식에서 사용 / ❌ 별도 웹서버 없이 백엔드에 의존 |
| **④ S3 + CloudFront Error Page** | 인프라 (AWS 설정)      | 404 응답을 `index.html`로 리다이렉트     | ✅ 서버리스 / Step 5-3에서 다룸                          |

---

### 방법별 코드 예시

**① Nginx `try_files` (이 실습에서 사용)**

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

**② Vue Router Hash Mode (서버 설정 불필요)**

```js
// src/router/index.js
import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),  // URL: /#/about
  routes: [...]
})
```

> URL이 `http://example.com/#/about` 형태가 됩니다.  
> `#` 뒤의 내용은 서버로 전송되지 않으므로, 서버는 항상 `index.html`만 반환하면 됩니다.

**③ Spring Boot 포워딩 (모놀리식 배포)**

```java
@Controller
public class SpaForwardController {
    // /api 외의 모든 경로를 index.html로 포워딩
    @GetMapping(value = {"/{path:[^\\.]*}", "/{path:[^\\.]*}/**"})
    public String forward() {
        return "forward:/resources/index.html";
    }
}
```

> Vue 빌드 결과를 Spring Boot 내부(`webapp/resources/`)에 넣고, 백엔드가 직접 SPA fallback을 처리하는 방식입니다.

---

### 모놀리식 배포 vs 독립 배포

> [!CONCEPT] 배포 아키텍처 비교
>
> **모놀리식 배포** — 프론트엔드를 백엔드 안에 포함:
>
> ```
> [브라우저] → [Spring Boot (Tomcat)]
>                  ├── /api/** → REST Controller
>                  └── 그 외 → index.html (Vue 빌드 파일 내장)
> ```
>
> - Vite 빌드 시 `outDir`을 백엔드 폴더로 설정
> - 서버 하나로 프론트+백엔드 모두 서빙
> - SPA fallback을 Spring Boot 컨트롤러에서 처리
> - 소규모 프로젝트나 학습용으로 간편
>
> **독립 배포 (이 실습)** — 프론트엔드와 백엔드를 분리:
>
> ```
> [브라우저] → [Nginx (프론트엔드)]     ← Vue 빌드 파일 서빙 + SPA fallback
>                  │
>                  └── /api/** 프록시 → [Spring Boot (백엔드)]
> ```
>
> - 프론트엔드: Nginx (또는 S3+CloudFront)에서 정적 파일 서빙
> - 백엔드: API만 담당
> - SPA fallback을 웹서버(Nginx) 레벨에서 처리
> - 각각 독립적으로 배포·스케일링 가능
> - **이 실습과 이후 Step에서 사용하는 방식**
>
> | 항목            | 모놀리식             | 독립 배포          |
> | --------------- | -------------------- | ------------------ |
> | 배포 단위       | 하나 (백엔드에 포함) | 프론트/백엔드 각각 |
> | SPA fallback    | Spring Boot 컨트롤러 | Nginx `try_files`  |
> | 스케일링        | 함께 스케일          | 독립 스케일        |
> | 프론트 업데이트 | 백엔드 재배포 필요   | 프론트만 재배포    |
> | CI/CD           | 단일 파이프라인      | 각각 파이프라인    |
> | 실무 적합도     | 소규모/학습          | 중대규모 서비스    |

---

### Vite `base` 경로 설정 (서브 디렉토리 배포 시)

서브 경로(`/app/`)에 배포하는 경우, 빌드된 파일의 리소스 경로가 맞지 않아 JS/CSS가 로드되지 않습니다.

```js
// vite.config.js
export default defineConfig({
  base: '/app/', // 서브 경로에 배포하는 경우
});
```

```js
// src/router/index.js
const router = createRouter({
  history: createWebHistory('/app/'),  // base와 동일하게 맞춰야 함
  routes: [...]
})
```

#### 개발 모드와 운영 모드에서 base가 다른 경우

실무에서 흔한 패턴: 개발 시에는 `localhost:5173/`(루트)에서 실행하고, 프로덕션에서는 `/app/` 서브 경로에 배포하는 경우입니다.

**방법 1: 환경 변수로 분기**

```js
// vite.config.js
export default defineConfig({
  base: process.env.NODE_ENV === 'production' ? '/app/' : '/',
});
```

```js
// src/router/index.js
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL), // Vite가 base 값을 자동 주입
  routes: [...]
})
```

> [!TIP]
> `import.meta.env.BASE_URL`은 Vite가 `vite.config.js`의 `base` 값을 자동으로 주입해 주는 환경 변수입니다.  
> Router에서 이 값을 사용하면 `vite.config.js`의 `base`만 변경해도 Router가 자동으로 따라갑니다.

**방법 2: `.env` 파일로 분리**

```bash
# .env.development (npm run dev 시 적용)
VITE_BASE_URL=/

# .env.production (npm run build 시 적용)
VITE_BASE_URL=/app/
```

```js
// vite.config.js
export default defineConfig({
  base: process.env.VITE_BASE_URL || '/',
});
```

**방법 3: 빌드 시 커맨드라인으로 지정**

```bash
# 로컬 개발 (루트)
npm run dev
# → http://localhost:5173/

# GitHub Pages 배포 (서브 경로)
VITE_BASE_URL=/repo-name/ npm run build

# EC2 루트 배포
npm run build
# → base: '/' (기본값)
```

#### 실제 사용 예시

이 교안 웹사이트(React)가 이 패턴을 사용하고 있습니다:

```js
// vite.config.ts
base: process.env.NODE_ENV === 'production' ? '/cloud_starter/' : '/',

// App.tsx
const basename = import.meta.env.MODE === 'production' ? '/cloud_starter' : '/';
<Router basename={basename}>
```

- `npm run dev` → `localhost:3000/` (루트에서 개발)
- `npm run build` → `/cloud_starter/`에 배포 (GitHub Pages)

#### base 설정 시 주의사항

| 문제                    | 원인                             | 해결                                     |
| ----------------------- | -------------------------------- | ---------------------------------------- |
| JS/CSS 404 (빈 화면)    | `base`와 실제 배포 경로 불일치   | 배포 URL의 경로와 `base` 값 일치시키기   |
| Router가 경로를 못 찾음 | Router의 base와 Vite base 불일치 | `import.meta.env.BASE_URL` 사용          |
| 이미지/폰트 경로 깨짐   | 정적 파일 참조가 상대경로        | `base`가 적용되는 `/assets/`를 통해 참조 |

> [!NOTE]
> 이 실습에서는 루트(`/`)에 배포하므로 `base` 설정을 변경할 필요가 없습니다.  
> `base` 설정이 필요한 경우는 GitHub Pages(`/repo-name/`), 서브 도메인 경로, 리버스 프록시 경로 등에서 서빙할 때입니다.

---

### 실습: Nginx `try_files` 설정

이 실습에서는 **방법 ①** (Nginx `try_files`)을 사용합니다:

- 프로덕션에서 가장 널리 사용되는 표준 방식
- 깔끔한 URL (`/about`, `/board/list`)
- Vue Router의 기본 History Mode와 조합
- Nginx 설정 한 줄로 해결

30. Nginx 설정 파일을 편집합니다:

```bash
sudo vi /etc/nginx/conf.d/vue-app.conf
```

<img src="/images/step2/2-2-step30-vi-vue-conf.png" alt="vue-app.conf 편집" class="guide-img-sm" />

31. 다음 내용을 입력하고 저장합니다:

> [!TIP]
> **vi 에디터 사용법:**
>
> 1. `i` 키를 눌러 입력 모드로 전환
> 2. 아래 내용을 **붙여넣기** (Mac: `Cmd+V` / Windows 터미널: 우클릭 또는 `Shift+Insert`)
> 3. `Esc` 키를 눌러 입력 모드 종료
> 4. `:wq` 입력 후 `엔터` → 저장하고 종료
>
> 잘못 입력했으면 `Esc` → `:q!` → `엔터`로 저장하지 않고 종료한 뒤 다시 시작하세요.

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

<img src="/images/step2/2-2-step31-vue-app-conf.png" alt="vue-app.conf 작성" class="guide-img-sm" />

> [!NOTE]
> **31번에서 한 작업:**  
> `/etc/nginx/conf.d/vue-app.conf`라는 새 설정 파일을 만들어서 "파일이 없으면 `index.html`을 반환하라(`try_files`)"는 규칙을 Nginx에 추가한 것입니다.  
> 이 파일이 있으면 Nginx는 `/about` 요청을 받아도 404 대신 `index.html`을 반환하고, Vue Router가 나머지를 처리합니다.

32. 기본 서버 블록과 충돌하지 않도록 기본 설정을 수정합니다:

> [!NOTE]
> **왜 기본 설정을 수정하나요?**  
> Nginx는 `/etc/nginx/nginx.conf`에 이미 포트 80을 사용하는 기본 server 블록이 있습니다.  
> 방금 만든 `vue-app.conf`도 포트 80을 사용하므로, 두 설정이 **충돌**합니다.  
> 기본 블록을 **주석 처리**(비활성화)하여 `vue-app.conf`만 동작하게 합니다.
>
> **주석 처리란?**  
> 줄 앞에 `#`을 붙이면 Nginx가 해당 줄을 무시합니다 (코드에서 `//`로 주석 다는 것과 같음).

```bash
sudo vi /etc/nginx/nginx.conf
```

<img src="/images/step2/2-2-step32-nginx-conf.png" alt="nginx.conf 편집" class="guide-img-sm" />

33. `server { }` 블록을 찾아서 주석 처리합니다:

> [!TIP]
> **vi에서 `server` 블록 찾는 방법:**
>
> 1. vi가 열린 상태에서 `/server` 입력 후 `엔터` → `server`가 포함된 줄로 이동
> 2. `n` 키를 누르면 다음 검색 결과로 이동
> 3. `listen 80`이 포함된 server 블록을 찾으세요

해당 server 블록 전체를 주석 처리합니다 (각 줄 앞에 `#` 추가):

```nginx
# 기존 server 블록을 주석 처리
#    server {
#        listen       80;
#        ...
#    }
```

<img src="/images/step2/2-2-step33-comment-server.png" alt="server 블록 주석 처리" class="guide-img-sm" />

> [!TIP]
> `/etc/nginx/nginx.conf`의 기본 server 블록과 `/etc/nginx/conf.d/vue-app.conf`가 동시에 80 포트를 사용하면 충돌합니다.  
> 기본 블록을 비활성화하세요.
>
> **vi에서 여러 줄 주석 처리하는 방법:**
>
> 1. `i` 키를 눌러 입력 모드 진입
> 2. server 블록의 각 줄 앞에 `#`을 추가
> 3. `Esc` → `:wq`로 저장 및 종료
>
> **vi가 어렵다면** 다음 명령어로 한 번에 처리할 수 있습니다:
>
> ```bash
> sudo sed -i '/^    server {/,/^    }/s/^/#/' /etc/nginx/nginx.conf
> ```

34. Nginx 설정 문법을 검증합니다:

```bash
sudo nginx -t
```

<img src="/images/step2/2-2-step34-nginx-t.png" alt="nginx -t 검증" class="guide-img-sm" />

> [!OUTPUT]
>
> ```
> nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
> nginx: configuration file /etc/nginx/nginx.conf test is successful
> ```

35. Nginx를 재시작합니다:

```bash
sudo systemctl restart nginx
```

36. SPA 라우팅을 테스트합니다. 브라우저에서 `http://<Public-IP>/about`으로 직접 접속합니다.

    <img src="/images/step2/2-2-step36-spa-browser.png" alt="SPA 라우팅 브라우저 확인" class="guide-img-sm" />

> [!OUTPUT]
> Vue Router의 About 페이지가 정상적으로 표시됩니다.  
> 404 에러가 아닌 Vue 앱이 로드되면 `try_files` 설정이 올바르게 동작하는 것입니다.

37. curl로도 확인합니다:

```bash
curl -I http://localhost/about
```

<img src="/images/step2/2-2-step37-curl-200.png" alt="curl 200 OK 확인" class="guide-img-sm" />

> [!OUTPUT]
>
> ```
> HTTP/1.1 200 OK
> Content-Type: text/html
> ```

✅ **태스크 완료**: SPA 라우팅이 설정되었습니다.

## 태스크 7: 배포 확인 및 최종 테스트

38. 브라우저에서 다음 URL들을 테스트합니다:
    - `http://<Public-IP>` → 메인 페이지
    - `http://<Public-IP>/about` → About 페이지 (새로고침해도 동작하면 try_files 성공)

39. 서버에서 Nginx 액세스 로그를 확인합니다:

```bash
sudo tail -f /var/log/nginx/access.log
```

<img src="/images/step2/2-2-step39-access-log.png" alt="Nginx 액세스 로그" class="guide-img-sm" />

40. Ctrl+C로 로그 확인을 종료합니다.

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

- Amazon EC2에 Node.js 22 LTS를 설치했습니다.
- Vue 3 프로젝트를 생성하고 프로덕션 빌드했습니다.
- Nginx를 설치하고 빌드된 정적 파일을 배포했습니다.
- `try_files`를 사용하여 SPA 라우팅을 설정했습니다.
- gzip 압축과 정적 파일 캐싱을 구성했습니다.

---

## 다음 단계: CI/CD로 배포 자동화 (미리보기)

이 실습에서는 SSH 접속 → 빌드 → 파일 복사를 **수동**으로 진행했습니다.  
실제 개발에서는 코드를 수정할 때마다 이 과정을 반복하는 것은 비효율적입니다.

**Step 8 (CI/CD)**에서는 GitHub Actions를 사용하여 이 배포 과정을 자동화합니다.

> [!CONCEPT] 수동 배포 vs CI/CD 자동 배포
>
> **지금 (수동 배포):**
>
> ```
> 코드 수정 → git push → SSH 접속 → git pull → npm install → npm run build → cp dist/* → nginx reload
> ```
>
> **Step 8 이후 (CI/CD 자동 배포):**
>
> ```
> 코드 수정 → git push → (자동) 빌드 → (자동) S3 업로드 또는 EC2 배포
> ```
>
> GitHub에 push하기만 하면 빌드, 테스트, 배포가 모두 자동으로 실행됩니다.

### CI/CD 파이프라인 흐름 (참고)

Step 8에서 구성할 GitHub Actions 워크플로우의 전체 흐름입니다:

```yaml
# .github/workflows/deploy.yml (Step 8에서 작성)
name: Deploy Vue App to EC2

on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      # 1. 소스 코드 체크아웃
      - uses: actions/checkout@v4

      # 2. Node.js 설정
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'

      # 3. 의존성 설치 및 빌드
      - run: npm ci
      - run: npm run build

      # 4. EC2에 배포 (scp로 빌드 결과물 전송)
      - name: Deploy to EC2
        uses: appleboy/scp-action@v0.1.7
        with:
          host: ${{ secrets.EC2_HOST }}
          username: ec2-user
          key: ${{ secrets.EC2_SSH_KEY }}
          source: 'dist/*'
          target: '/usr/share/nginx/html/'
          strip_components: 1
```

> [!NOTE]
> 위 코드는 참고용입니다. 실제 구성은 Step 8에서 단계별로 진행합니다.
>
> **CI/CD를 도입하면:**
>
> | 항목           | 수동 배포 (지금)               | CI/CD (Step 8)             |
> | -------------- | ------------------------------ | -------------------------- |
> | 배포 소요 시간 | 5~10분 (SSH 접속, 명령어 실행) | 1~2분 (자동)               |
> | 휴먼 에러      | 명령어 오타, 단계 누락 가능    | 동일 과정 매번 정확히 반복 |
> | 배포 빈도      | 귀찮아서 모아서 배포           | 커밋할 때마다 즉시 배포    |
> | 롤백           | 이전 파일 수동 복원            | Git revert → 자동 재배포   |
>
> 지금 수동으로 익힌 배포 흐름(빌드 → 파일 복사 → Nginx 서빙)이 CI/CD에서도 동일하게 적용됩니다.  
> 차이점은 사람이 직접 하느냐, GitHub Actions가 대신 하느냐입니다.

---

# 🗑️ 리소스 정리

> [!NOTE]
> 이 실습에서 추가로 생성한 리소스는 Amazon EC2 내부의 소프트웨어(Node.js, Vue 프로젝트, Nginx)뿐입니다.  
> Amazon EC2 내부 소프트웨어는 추가 AWS 비용이 발생하지 않습니다. Amazon EC2 인스턴스 자체의 비용 관리는 Step 2-1의 리소스 정리를 참조하세요.

---

### 옵션 A: EC2 유지 (소프트웨어만 정리)

Amazon EC2 인스턴스를 계속 사용하지만 Vue.js/Nginx 환경을 정리하려면 다음 명령을 실행합니다.

1. Vue 프로젝트를 삭제합니다:

```bash
rm -rf ~/my-vue-app
```

2. Nginx 설정 파일을 삭제하고 서비스를 중지합니다:

```bash
sudo rm /etc/nginx/conf.d/vue-app.conf
sudo systemctl stop nginx
sudo systemctl disable nginx
```

3. Nginx를 삭제합니다 (필요한 경우):

```bash
sudo dnf remove nginx -y
```

4. Node.js를 삭제합니다 (필요한 경우):

```bash
sudo dnf remove nodejs22 -y
```

> [!TIP]
> Step 2-3(Spring Boot)을 이어서 진행할 예정이라면 Nginx를 유지해도 됩니다. Spring Boot 앱의 리버스 프록시로 활용할 수 있습니다.

---

### 옵션 B: Amazon EC2 인스턴스 포함 전체 삭제

Amazon EC2 인스턴스 자체를 삭제하려면 [Step 2-1의 리소스 정리 → 옵션 B](/week/2/session/1#cleanup) 섹션을 참조하세요.  
Terminate 방법, CloudFormation 스택 삭제, VPC 수동 삭제 등 상세 단계가 안내되어 있습니다.

✅ **실습 종료**: 모든 리소스가 정리되었습니다.

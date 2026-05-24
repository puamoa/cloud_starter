---
title: 'Vue.js 프론트엔드 배포 (S3 + CloudFront)'
week: 9
session: 2
awsServices:
  - Amazon S3
  - Amazon CloudFront
learningObjectives:
  - Vue.js 프로젝트를 생성하고 API 연동 코드를 작성할 수 있습니다.
  - S3 정적 웹 호스팅을 설정할 수 있습니다.
  - CloudFront 배포를 생성하여 CDN + HTTPS를 적용할 수 있습니다.
  - GitHub Actions로 프론트엔드 자동 배포를 구성할 수 있습니다.
prerequisites:
  - Step 9-1 완료 (인프라 구축)
  - Node.js 설치 (로컬)
estimatedCost: 크레딧 내 사용 가능 (비용 발생 가능)
---

이 실습에서는 Vue.js 프론트엔드를 생성하고, S3 + CloudFront로 배포합니다.
GitHub Actions를 통해 코드를 push하면 자동으로 빌드 및 배포되는 파이프라인을 구축합니다.

> [!NOTE]
> Step 9-1에서 생성한 CloudFormation Outputs 값이 필요합니다:
>
> - **S3BucketName**: 프론트엔드 파일 업로드 대상
> - **ALBDNSName**: API 호출 대상 (Step 9-3 완료 후 사용)

---

## 태스크 1: Vue.js 프로젝트 생성

Vite를 사용하여 Vue.js 프로젝트를 생성합니다.

### 1-1. 프로젝트 초기화

```bash
cd ~/3tier-project/my-frontend

# Vite + Vue.js 프로젝트 생성
npm create vite@latest . -- --template vue

# 의존성 설치
npm install

# 추가 패키지 설치
npm install vue-router@4 axios
```

### 1-2. 프로젝트 구조 확인

```
my-frontend/
├── public/
├── src/
│   ├── assets/
│   ├── components/
│   ├── router/
│   │   └── index.js       ← 라우터 설정
│   ├── views/
│   │   ├── HomeView.vue   ← 메인 페이지
│   │   └── ItemsView.vue  ← CRUD 페이지
│   ├── api/
│   │   └── index.js       ← Axios 설정
│   ├── App.vue
│   └── main.js
├── .env.development       ← 개발 환경 변수
├── .env.production        ← 프로덕션 환경 변수
├── index.html
├── package.json
└── vite.config.js
```

### 1-3. Vue Router 설정

`src/router/index.js` 파일을 생성합니다:

```javascript
// src/router/index.js
import { createRouter, createWebHistory } from 'vue-router';

const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('../views/HomeView.vue'),
  },
  {
    path: '/items',
    name: 'Items',
    component: () => import('../views/ItemsView.vue'),
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
```

### 1-4. main.js 수정

```javascript
// src/main.js
import { createApp } from 'vue';
import App from './App.vue';
import router from './router';

const app = createApp(App);
app.use(router);
app.mount('#app');
```

> [!TIP]
> `createWebHistory()`를 사용하면 URL에 `#`이 없는 깔끔한 경로를 사용할 수 있습니다.
> 단, SPA 라우팅을 위해 CloudFront에서 에러 페이지 설정이 필요합니다 (태스크 5에서 설정).

✅ **태스크 완료** — Vue.js 프로젝트를 생성하고 기본 구조를 설정했습니다.

---

## 태스크 2: API 연동 코드 작성

환경 변수로 API URL을 관리하고, Axios로 백엔드 API를 호출하는 코드를 작성합니다.

### 2-1. 환경 변수 파일 생성

```bash
# 개발 환경 (로컬)
# .env.development
VITE_API_URL=http://localhost:8080/api
```

```bash
# 프로덕션 환경 (배포)
# .env.production
VITE_API_URL=http://ALB_DNS_NAME/api
```

> [!WARNING]
> `.env.production`의 `ALB_DNS_NAME`은 Step 9-1에서 확인한 ALB DNS 이름으로
> 교체해야 합니다. Step 9-3에서 백엔드 배포 후 실제 동작합니다.
> 예: `VITE_API_URL=http://my-3tier-app-alb-xxx.ap-northeast-2.elb.amazonaws.com/api`

### 2-2. Axios 설정

`src/api/index.js` 파일을 생성합니다:

```javascript
// src/api/index.js
import axios from 'axios';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 요청 인터셉터 (디버깅용)
apiClient.interceptors.request.use(
  (config) => {
    console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => Promise.reject(error),
);

// 응답 인터셉터 (에러 처리)
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('[API Error]', error.response?.status, error.message);
    return Promise.reject(error);
  },
);

export default {
  // Items CRUD
  getItems() {
    return apiClient.get('/items');
  },
  getItem(id) {
    return apiClient.get(`/items/${id}`);
  },
  createItem(data) {
    return apiClient.post('/items', data);
  },
  updateItem(id, data) {
    return apiClient.put(`/items/${id}`, data);
  },
  deleteItem(id) {
    return apiClient.delete(`/items/${id}`);
  },
  // Health Check
  healthCheck() {
    return apiClient.get('/health');
  },
};
```

### 2-3. 메인 페이지 (HomeView.vue)

```vue
<!-- src/views/HomeView.vue -->
<template>
  <div class="home">
    <h1>🚀 3-Tier Web Application</h1>
    <p>Vue.js + Spring Boot + MySQL on AWS</p>

    <div class="status-card">
      <h3>서비스 상태</h3>
      <p :class="statusClass">API: {{ apiStatus }}</p>
      <button @click="checkHealth">상태 확인</button>
    </div>

    <nav>
      <router-link to="/items">📋 아이템 관리</router-link>
    </nav>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import api from '../api';

const apiStatus = ref('확인 중...');
const statusClass = ref('');

const checkHealth = async () => {
  try {
    await api.healthCheck();
    apiStatus.value = '✅ 정상';
    statusClass.value = 'status-ok';
  } catch (error) {
    apiStatus.value = '❌ 연결 실패';
    statusClass.value = 'status-error';
  }
};

checkHealth();
</script>
```

### 2-4. CRUD 페이지 (ItemsView.vue)

```vue
<!-- src/views/ItemsView.vue -->
<template>
  <div class="items">
    <h2>📋 아이템 관리</h2>

    <!-- 아이템 추가 폼 -->
    <form @submit.prevent="addItem" class="add-form">
      <input v-model="newItem.name" placeholder="아이템 이름" required />
      <input v-model="newItem.description" placeholder="설명" />
      <button type="submit">추가</button>
    </form>

    <!-- 아이템 목록 -->
    <div class="item-list">
      <div v-for="item in items" :key="item.id" class="item-card">
        <div>
          <strong>{{ item.name }}</strong>
          <p>{{ item.description }}</p>
        </div>
        <button @click="removeItem(item.id)" class="delete-btn">삭제</button>
      </div>
      <p v-if="items.length === 0">아이템이 없습니다.</p>
    </div>

    <router-link to="/">← 홈으로</router-link>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import api from '../api';

const items = ref([]);
const newItem = ref({ name: '', description: '' });

const fetchItems = async () => {
  try {
    const response = await api.getItems();
    items.value = response.data;
  } catch (error) {
    console.error('아이템 로드 실패:', error);
  }
};

const addItem = async () => {
  try {
    await api.createItem(newItem.value);
    newItem.value = { name: '', description: '' };
    await fetchItems();
  } catch (error) {
    console.error('아이템 추가 실패:', error);
  }
};

const removeItem = async (id) => {
  try {
    await api.deleteItem(id);
    await fetchItems();
  } catch (error) {
    console.error('아이템 삭제 실패:', error);
  }
};

onMounted(fetchItems);
</script>
```

> [!CONCEPT] 환경 변수를 사용하는 이유
>
> - 로컬 개발 시: `http://localhost:8080/api` (백엔드 로컬 실행)
> - 프로덕션 배포 시: `http://ALB_DNS/api` (AWS ALB 경유)
>
> Vite는 빌드 시 `VITE_` 접두사가 붙은 환경 변수를 코드에 주입합니다.
> `.env.production` 파일의 값이 `npm run build` 시 적용됩니다.

✅ **태스크 완료** — API 연동 코드를 작성하고 환경 변수로 URL을 관리합니다.

---

## 태스크 3: S3 버킷 정적 웹 호스팅 설정

CloudFormation에서 이미 S3 버킷과 정적 웹 호스팅을 설정했습니다.
여기서는 설정을 확인하고 추가 구성을 합니다.

### 3-1. S3 버킷 설정 확인

1. AWS Console → **S3** 서비스로 이동합니다.
2. `my-3tier-app-frontend-{AccountId}` 버킷을 클릭합니다.
3. **Properties** 탭 → **Static website hosting** 섹션을 확인합니다:
   - **Status**: Enabled
   - **Index document**: `index.html`
   - **Error document**: `index.html`

### 3-2. Block Public Access 확인

4. **Permissions** 탭을 클릭합니다.
5. **Block public access** 섹션에서 모든 항목이 **Off**인지 확인합니다.

> [!NOTE]
> CloudFormation 템플릿에서 이미 Public Access를 허용하고 버킷 정책을 설정했습니다.
> 수동으로 추가 설정할 필요가 없습니다.

### 3-3. 버킷 정책 확인

6. **Permissions** 탭 → **Bucket policy**에서 다음 정책이 있는지 확인합니다:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::my-3tier-app-frontend-{AccountId}/*"
    }
  ]
}
```

### 3-4. 웹사이트 엔드포인트 확인

7. **Properties** 탭 → **Static website hosting** 섹션에서 **Bucket website endpoint**를 복사합니다.
8. 브라우저에서 접속하면 아직 파일이 없으므로 404 에러가 표시됩니다 (정상).

> [!TIP]
> S3 정적 웹 호스팅 엔드포인트 형식:
> `http://BUCKET-NAME.s3-website.REGION.amazonaws.com`
>
> 이 URL은 CloudFront의 Origin으로 사용됩니다.

✅ **태스크 완료** — S3 버킷의 정적 웹 호스팅 설정을 확인했습니다.

---

## 태스크 4: 빌드 및 S3 업로드

Vue.js 프로젝트를 빌드하고 S3에 업로드합니다.

### 4-1. 프로덕션 빌드

```bash
cd ~/3tier-project/my-frontend

# 프로덕션 빌드
npm run build
```

빌드 결과물이 `dist/` 디렉토리에 생성됩니다:

```
dist/
├── index.html
├── assets/
│   ├── index-xxxxx.js
│   └── index-xxxxx.css
└── favicon.ico
```

### 4-2. S3에 업로드

```bash
# S3 버킷 이름 (CloudFormation Outputs에서 확인)
BUCKET_NAME="my-3tier-app-frontend-123456789012"

# dist 폴더를 S3에 동기화
aws s3 sync dist/ s3://$BUCKET_NAME --delete
```

> [!NOTE]
> `--delete` 옵션은 S3에 있지만 로컬 dist에 없는 파일을 삭제합니다.
> 이전 배포의 잔여 파일을 정리하여 깔끔한 상태를 유지합니다.

### 4-3. 업로드 확인

```bash
# S3 버킷 내용 확인
aws s3 ls s3://$BUCKET_NAME --recursive
```

### 4-4. 브라우저에서 확인

S3 웹사이트 엔드포인트로 접속합니다:

```
http://my-3tier-app-frontend-123456789012.s3-website.ap-northeast-2.amazonaws.com
```

> [!TIP]
> 이 시점에서는 API 서버가 아직 없으므로 "API 연결 실패" 메시지가 표시됩니다.
> 이는 정상입니다. Step 9-3에서 백엔드를 배포하면 정상 동작합니다.

✅ **태스크 완료** — Vue.js를 빌드하고 S3에 업로드하여 정적 웹사이트를 확인했습니다.

---

## 태스크 5: CloudFront 배포 생성

S3 앞에 CloudFront를 배치하여 CDN + HTTPS를 적용합니다.

### 5-1. CloudFront 배포 생성

1. AWS Console → **CloudFront** 서비스로 이동합니다.
2. [[Create distribution]]을 클릭합니다.

### 5-2. Origin 설정

3. **Origin domain**: S3 버킷의 **웹사이트 엔드포인트**를 입력합니다.

> [!WARNING]
> Origin 선택 시 주의사항:
>
> - ❌ 드롭다운에서 S3 버킷을 선택하지 마세요 (REST API 엔드포인트가 선택됨)
> - ✅ 직접 S3 **웹사이트 엔드포인트**를 입력하세요
>
> 웹사이트 엔드포인트 형식: `my-3tier-app-frontend-xxx.s3-website.ap-northeast-2.amazonaws.com`
>
> REST API 엔드포인트를 사용하면 SPA 라우팅이 동작하지 않습니다.

4. **Protocol**: `HTTP only` (S3 웹사이트 엔드포인트는 HTTPS 미지원)

### 5-3. 캐시 동작 설정

5. **Viewer protocol policy**: `Redirect HTTP to HTTPS`
6. **Allowed HTTP methods**: `GET, HEAD`
7. **Cache policy**: `CachingOptimized` (권장)

### 5-4. 기본 설정

8. **Default root object**: `index.html`
9. **Price class**: `Use only North America and Europe` (비용 절약) 또는 `Use all edge locations`

### 5-5. 에러 페이지 설정 (SPA 라우팅)

10. **Error pages** 탭에서 [[Create custom error response]]를 클릭합니다.
11. 다음과 같이 설정합니다:

| 설정                     | 값            |
| ------------------------ | ------------- |
| HTTP error code          | `403`         |
| Customize error response | Yes           |
| Response page path       | `/index.html` |
| HTTP response code       | `200`         |

12. 같은 방식으로 `404` 에러도 추가합니다:

| 설정                     | 값            |
| ------------------------ | ------------- |
| HTTP error code          | `404`         |
| Customize error response | Yes           |
| Response page path       | `/index.html` |
| HTTP response code       | `200`         |

> [!CONCEPT] SPA 라우팅과 에러 페이지 설정
>
> Vue Router의 `createWebHistory()`는 `/items` 같은 경로를 사용합니다.
> 사용자가 `/items`를 직접 입력하면 CloudFront는 S3에서 `/items` 파일을 찾지만,
> 실제로는 존재하지 않아 403/404 에러가 발생합니다.
>
> 에러 페이지를 `/index.html`로 설정하면, 모든 경로에서 Vue.js가 로드되고
> 클라이언트 측 라우터가 올바른 페이지를 렌더링합니다.

### 5-6. 배포 생성 완료

13. [[Create distribution]]을 클릭합니다.
14. 배포 생성에 약 **5~10분** 소요됩니다.
15. Status가 `Enabled`로 변경되면 완료입니다.
16. **Distribution domain name**을 복사합니다 (예: `d1234abcdef.cloudfront.net`).

### 5-7. CloudFront URL로 접속 확인

```
https://d1234abcdef.cloudfront.net
```

브라우저에서 Vue.js 앱이 HTTPS로 로드되는지 확인합니다.

> [!TIP]
> CloudFront 도메인 이름을 메모해두세요. Step 9-3에서 백엔드의 CORS 설정에 사용합니다.
> 또한 Step 9-4에서 커스텀 도메인을 연결할 수 있습니다.

✅ **태스크 완료** — CloudFront 배포를 생성하여 CDN + HTTPS를 적용했습니다.

---

## 태스크 6: GitHub Actions 자동 배포

코드를 push하면 자동으로 빌드 → S3 업로드 → CloudFront 캐시 무효화가 실행되는 파이프라인을 구축합니다.

### 6-1. AWS IAM 사용자 생성 (GitHub Actions용)

1. AWS Console → **IAM** → **Users** → [[Create user]]
2. **User name**: `github-actions-frontend`
3. [[Next]] → **Attach policies directly** 선택
4. 다음 정책을 검색하여 추가합니다:
   - `AmazonS3FullAccess`
   - `CloudFrontFullAccess`
5. [[Create user]] → 사용자 클릭 → **Security credentials** 탭
6. [[Create access key]] → **Third-party service** 선택 → [[Create access key]]
7. **Access key ID**와 **Secret access key**를 복사합니다.

> [!WARNING]
> Secret access key는 이 화면에서만 확인할 수 있습니다.
> 반드시 복사하여 안전한 곳에 저장하세요.

### 6-2. GitHub Secrets 설정

8. GitHub → `my-frontend` 리포지토리 → **Settings** → **Secrets and variables** → **Actions**
9. 다음 Secrets를 추가합니다:

| Secret Name                  | 값                                                                     |
| ---------------------------- | ---------------------------------------------------------------------- |
| `AWS_ACCESS_KEY_ID`          | IAM Access Key ID                                                      |
| `AWS_SECRET_ACCESS_KEY`      | IAM Secret Access Key                                                  |
| `AWS_REGION`                 | `ap-northeast-2`                                                       |
| `S3_BUCKET_NAME`             | CloudFormation Output의 S3BucketName                                   |
| `CLOUDFRONT_DISTRIBUTION_ID` | CloudFront 배포 ID                                                     |
| `VITE_API_URL`               | ALB DNS Name (예: `http://my-3tier-app-alb-xxx.elb.amazonaws.com/api`) |

### 6-3. GitHub Actions 워크플로우 작성

`.github/workflows/deploy.yml` 파일을 생성합니다:

```yaml
# .github/workflows/deploy.yml
name: Deploy Frontend to S3 + CloudFront

on:
  push:
    branches: [main]
    paths:
      - 'src/**'
      - 'public/**'
      - 'package.json'
      - 'vite.config.js'
      - '.github/workflows/deploy.yml'

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      # 1. 소스 코드 체크아웃
      - name: Checkout source code
        uses: actions/checkout@v4

      # 2. Node.js 설정
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      # 3. 의존성 설치
      - name: Install dependencies
        run: npm ci

      # 4. 프로덕션 빌드
      - name: Build for production
        run: npm run build
        env:
          VITE_API_URL: ${{ secrets.VITE_API_URL }}

      # 5. AWS 자격 증명 설정
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ secrets.AWS_REGION }}

      # 6. S3에 배포
      - name: Deploy to S3
        run: |
          aws s3 sync dist/ s3://${{ secrets.S3_BUCKET_NAME }} \
            --delete \
            --cache-control "public, max-age=31536000" \
            --exclude "index.html"

          aws s3 cp dist/index.html s3://${{ secrets.S3_BUCKET_NAME }}/index.html \
            --cache-control "no-cache, no-store, must-revalidate"

      # 7. CloudFront 캐시 무효화
      - name: Invalidate CloudFront cache
        run: |
          aws cloudfront create-invalidation \
            --distribution-id ${{ secrets.CLOUDFRONT_DISTRIBUTION_ID }} \
            --paths "/*"

      # 8. 배포 완료 확인
      - name: Deployment complete
        run: |
          echo "✅ Frontend deployed successfully!"
          echo "S3 Bucket: ${{ secrets.S3_BUCKET_NAME }}"
          echo "CloudFront will update within 1-2 minutes."
```

> [!CONCEPT] 캐시 전략 설명
>
> - **정적 자산** (JS, CSS, 이미지): `max-age=31536000` (1년) — 파일명에 해시가 포함되어 변경 시 새 파일명 생성
> - **index.html**: `no-cache` — 항상 최신 버전을 가져옴
>
> 이 전략으로 빠른 로딩 속도와 즉시 업데이트를 동시에 달성합니다.

### 6-4. 배포 테스트

```bash
cd ~/3tier-project/my-frontend

# 변경사항 커밋 및 푸시
git add .
git commit -m "feat: initial frontend with CI/CD"
git push origin main
```

10. GitHub → **Actions** 탭에서 워크플로우 실행을 확인합니다.
11. 모든 스텝이 ✅ 성공하면 CloudFront URL에서 최신 버전을 확인합니다.

> [!TIP]
> CloudFront 캐시 무효화 후 전파에 1~2분 소요될 수 있습니다.
> 브라우저에서 강력 새로고침(Ctrl+Shift+R)을 시도하세요.

✅ **태스크 완료** — GitHub Actions로 프론트엔드 자동 배포 파이프라인을 구축했습니다.

---

# 🗑️ 리소스 정리

> [!WARNING]
> 이 세션에서 생성한 리소스를 지금 삭제하지 마세요!
> Step 9-3, 9-4에서 계속 사용합니다.
> **Step 9-4에서 전체 정리합니다.**

### 이 세션에서 생성한 리소스 목록

| 리소스                  | 이름/식별자                  | 비용                  |
| ----------------------- | ---------------------------- | --------------------- |
| CloudFront Distribution | `d1234abcdef.cloudfront.net` | 요청 기반 (소량 무료) |
| IAM User                | `github-actions-frontend`    | 무료                  |
| GitHub Secrets          | 6개                          | 무료                  |

> [!NOTE]
> CloudFront는 월 1,000만 요청까지 프리티어에 포함됩니다.
> 실습 수준의 트래픽에서는 비용이 거의 발생하지 않습니다.

✅ **실습 종료**: Step 9-3에서 Spring Boot 백엔드를 배포합니다.

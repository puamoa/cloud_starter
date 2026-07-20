---
title: 'Vue.js 프론트엔드 배포 (S3 + CloudFront)'
week: 8
session: 2
awsServices:
  - Amazon S3
  - Amazon CloudFront
learningObjectives:
  - Vue.js 프로젝트를 생성하고 API 연동 코드를 작성할 수 있습니다.
  - Amazon S3 정적 웹 호스팅을 설정할 수 있습니다.
  - Amazon CloudFront 배포를 생성하여 CDN + HTTPS를 적용할 수 있습니다.
  - GitHub Actions로 프론트엔드 자동 배포를 구성할 수 있습니다.
prerequisites:
  - Step 8-1 완료 (인프라 구축)
  - Node.js 설치 (로컬)
estimatedCost: 크레딧 내 사용 가능 (비용 발생 가능)
---

이 실습에서는 Vue.js 프론트엔드를 생성하고, Amazon S3 + Amazon CloudFront로 배포합니다.  
GitHub Actions를 통해 코드를 push하면 자동으로 빌드 및 배포되는 파이프라인을 구축합니다.

### Step 8 전체 아키텍처

<img src="/images/step8/8-architecture.png" alt="Step 8 3-Tier 아키텍처" class="guide-img-lg" />

> [!NOTE]
> Step 8-1에서 생성한 AWS CloudFormation Outputs 값이 필요합니다:
>
> - **S3BucketName**: 프론트엔드 파일 업로드 대상
> - **ALBDNSName**: API 호출 대상 (Step 8-3 완료 후 사용)

---

## 태스크 1: Vue.js 프로젝트 준비

기존 Vue.js 프로젝트가 있다면 **방법 A**로 진행하고, 새로 만드려면 **방법 B**를 따릅니다.

---

### 방법 A: 기존 Vue.js 프로젝트 사용

Step 2-2에서 사용한 기존 프로젝트를 3-Tier 배포에 활용합니다.

```bash
cd ~/3tier-project/my-frontend

# 기존 프로젝트 파일을 복사하거나 git clone
# git clone <기존-프론트엔드-레포-URL> .
```

> [!NOTE]
> 기존 프로젝트를 사용하는 경우 다음을 확인하세요:
>
> - `vite.config.js`의 `outDir`이 `'dist'`로 설정되어 있는지
> - `npm run build`가 정상적으로 동작하는지
> - API 호출 URL을 환경변수로 분리할 수 있는지 (`.env.production` 사용)
>
> API URL 환경변수 설정이 필요하면 `.env.production` 파일을 생성하세요:
>
> ```bash
> # .env.production
> VITE_API_URL=http://ALB_DNS_NAME
> ```

방법 A를 선택했다면 **태스크 2: API 연동 코드**에서 환경변수 관련 부분만 확인 후 **태스크 3**으로 이동하세요.

---

### 방법 B: 새 프로젝트 생성 (처음부터)

Vite를 사용하여 Vue.js 프로젝트를 새로 생성합니다.

### B-1. 프로젝트 초기화

```bash
cd ~/3tier-project/my-frontend

# Vite + Vue.js 프로젝트 생성
npm create vite@latest . -- --template vue

# 의존성 설치
npm install

# 추가 패키지 설치
npm install vue-router@4 axios
```

### B-2. 프로젝트 구조 확인

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

### B-3. Vue Router 설정

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

### B-4. main.js 수정

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
> 단, SPA 라우팅을 위해 Amazon CloudFront에서 에러 페이지 설정이 필요합니다 (태스크 5에서 설정).

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
> `.env.production`의 `ALB_DNS_NAME`은 Step 8-1에서 확인한 ALB DNS 이름으로 교체해야 합니다.  
> Step 8-3에서 백엔드 배포 후 실제 동작합니다.  
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

## 태스크 3: Amazon S3 버킷 정적 웹 호스팅 설정

AWS CloudFormation에서 이미 Amazon S3 버킷과 정적 웹 호스팅을 설정했습니다.  
여기서는 설정을 확인하고 추가 구성을 합니다.

### S3 버킷 설정 확인

1. 상단 검색창에 `S3`를 입력하고 **S3** 서비스를 선택합니다.
2. Buckets 목록에서 `my-3tier-app-frontend-{AccountId}` 버킷을 클릭합니다.
3. **Properties** 탭을 클릭합니다.
4. 페이지 하단의 **Static website hosting** 섹션에서 다음을 확인합니다:
   - **Status**: Enabled
   - **Index document**: `index.html`
   - **Error document**: `index.html`

### Block Public Access 확인

5. **Permissions** 탭을 클릭합니다.
6. **Block public access (bucket settings)** 섹션에서 모든 항목이 **Off**인지 확인합니다.

> [!NOTE]
> AWS CloudFormation 템플릿에서 이미 Public Access를 허용하고 버킷 정책을 설정했습니다.  
> 수동으로 추가 설정할 필요가 없습니다.

### 버킷 정책 확인

7. 같은 **Permissions** 탭에서 **Bucket policy** 섹션을 확인합니다.
8. 다음과 같은 정책이 설정되어 있는지 확인합니다:

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

### 웹사이트 엔드포인트 확인

9. **Properties** 탭으로 돌아갑니다.
10. 페이지 하단의 **Static website hosting** 섹션에서 **Bucket website endpoint** URL을 복사합니다.
11. 브라우저에서 해당 URL로 접속합니다.

> [!OUTPUT]
> Amazon S3 웹사이트 엔드포인트 형식:  
> `http://my-3tier-app-frontend-123456789012.s3-website.ap-northeast-2.amazonaws.com`
>
> 접속 시 `404 Not Found` 페이지가 표시됩니다 (아직 파일을 업로드하지 않았으므로 정상).

> [!TIP]
> 이 URL은 Amazon CloudFront의 Origin으로 사용됩니다. 메모해두세요.

✅ **태스크 완료** — Amazon S3 버킷의 정적 웹 호스팅 설정을 확인했습니다.

---

## 태스크 4: 빌드 및 S3 업로드

Vue.js 프로젝트를 빌드하고 Amazon S3에 업로드합니다.

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

### 4-2. Amazon S3에 업로드

```bash
# S3 버킷 이름 (AWS CloudFormation Outputs에서 확인)
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

> [!OUTPUT]
>
> ```
> 2025-01-20 10:30:01        450 index.html
> 2025-01-20 10:30:01      48720 assets/index-a1b2c3.js
> 2025-01-20 10:30:01       1230 assets/index-d4e5f6.css
> 2025-01-20 10:30:01       4286 favicon.ico
> ```

### 4-4. 브라우저에서 확인

Amazon S3 웹사이트 엔드포인트로 접속합니다:

```
http://my-3tier-app-frontend-123456789012.s3-website.ap-northeast-2.amazonaws.com
```

> [!TIP]
> 이 시점에서는 API 서버가 아직 없으므로 "API 연결 실패" 메시지가 표시됩니다.  
> 이는 정상입니다. Step 8-3에서 백엔드를 배포하면 정상 동작합니다.

✅ **태스크 완료** — Vue.js를 빌드하고 Amazon S3에 업로드하여 정적 웹사이트를 확인했습니다.

> [!TROUBLESHOOTING]
> | 증상 | 원인 | 해결 방법 |
> |------|------|-----------|
> | `npm run build` 실패 | 코드 문법 에러 또는 의존성 미설치 | `npm install` 후 에러 메시지 확인 |
> | `aws s3 sync` 실패 (`AccessDenied`) | AWS CLI 자격 증명 미설정 | `aws configure`로 Access Key 설정 |
> | S3 업로드 성공했지만 웹사이트 접속 불가 | 정적 웹 호스팅 미활성화 | S3 Properties → Static website hosting 확인 |
> | 페이지 로드 시 빈 화면 (흰 화면) | `vite.config.js`의 `base` 경로 문제 | `base: '/'` 설정 확인 |

---

## 태스크 5: Amazon CloudFront 배포 생성

S3 앞에 Amazon CloudFront를 배치하여 CDN + HTTPS를 적용합니다.

### Amazon CloudFront 콘솔 이동

12. 상단 검색창에 `CloudFront`를 입력하고 **CloudFront** 서비스를 선택합니다.
13. [[Create distribution]] 버튼을 클릭합니다.

### Origin 설정

14. **Origin domain** 필드에 Amazon S3 버킷의 **웹사이트 엔드포인트**를 직접 입력합니다:
    - 형식: `my-3tier-app-frontend-xxx.s3-website.ap-northeast-2.amazonaws.com`
    - 태스크 3에서 확인한 S3 웹사이트 엔드포인트를 붙여넣으세요.

> [!WARNING]
> Origin 선택 시 주의사항:
>
> - ❌ 드롭다운에서 Amazon S3 버킷을 선택하지 마세요 (REST API 엔드포인트가 선택됨)
> - ✅ 직접 Amazon S3 **웹사이트 엔드포인트**를 수동 입력하세요
>
> REST API 엔드포인트(`s3.amazonaws.com`)를 사용하면 SPA 라우팅이 동작하지 않습니다.  
> 반드시 `s3-website` 형식의 엔드포인트를 사용해야 합니다.

15. **Protocol**:
    - `HTTP only` 선택 (S3 웹사이트 엔드포인트는 HTTPS를 지원하지 않음)

### Default cache behavior 설정

16. **Viewer protocol policy**:
    - `Redirect HTTP to HTTPS` 선택 (사용자는 항상 HTTPS로 접속)

17. **Allowed HTTP methods**:
    - `GET, HEAD` 선택 (정적 파일이므로 읽기만 필요)

18. **Cache policy**:
    - `CachingOptimized` 선택 (권장, 정적 파일에 최적화)

### Settings (기본 설정)

19. **Price class**:
    - `Use only North America and Europe` 선택 (비용 절약)
    - 또는 `Use all edge locations` (전 세계 최적 성능, 비용 증가)

20. **Default root object**:
    - `index.html` 입력 (루트 URL 접속 시 반환할 파일)

21. 나머지 설정은 기본값을 유지합니다.

22. [[Create distribution]] 버튼을 클릭합니다.

> [!OUTPUT]
> "Distribution is being created" 메시지와 함께 배포가 생성됩니다.
> **Distribution domain name** (예: `d1234abcdef.cloudfront.net`)과 **Distribution ID** (예: `E1A2B3C4D5E6F7`)를 메모하세요.
> Status가 `Deploying`에서 `Enabled`로 변경될 때까지 약 5~10분 소요됩니다.

### 에러 페이지 설정 (SPA 라우팅)

배포 생성 후, SPA 라우팅을 위한 에러 페이지를 설정합니다.

23. 생성된 Distribution을 클릭하여 상세 페이지로 이동합니다.
24. **Error pages** 탭을 클릭합니다.
25. [[Create custom error response]] 버튼을 클릭합니다.
26. 다음과 같이 설정합니다:
    - **HTTP error code**: `403` 선택
    - **Customize error response**: `Yes` 선택
    - **Response page path**: `/index.html` 입력
    - **HTTP response code**: `200` 선택

27. [[Create custom error response]] 버튼을 클릭하여 저장합니다.

28. 같은 방식으로 [[Create custom error response]]를 한 번 더 클릭하여 `404` 에러도 추가합니다:
    - **HTTP error code**: `404` 선택
    - **Customize error response**: `Yes` 선택
    - **Response page path**: `/index.html` 입력
    - **HTTP response code**: `200` 선택

29. [[Create custom error response]] 버튼을 클릭하여 저장합니다.

> [!CONCEPT] SPA 라우팅과 에러 페이지 설정
>
> Vue Router의 `createWebHistory()`는 `/items` 같은 경로를 사용합니다.
> 사용자가 `/items`를 직접 입력하면 Amazon CloudFront는 S3에서 `/items` 파일을 찾지만, 실제로는 존재하지 않아 403/404 에러가 발생합니다.
> 에러 페이지를 `/index.html`로 설정하면, 모든 경로에서 Vue.js가 로드되고 클라이언트 측 라우터가 올바른 페이지를 렌더링합니다.

### CloudFront URL 접속 확인

30. Status가 `Enabled`로 변경되었는지 확인합니다 (약 5~10분 소요).
31. **Distribution domain name**을 복사합니다 (예: `d1234abcdef.cloudfront.net`).
32. 브라우저에서 `https://d1234abcdef.cloudfront.net`으로 접속합니다.
33. Vue.js 앱이 HTTPS로 정상 로드되는지 확인합니다.
34. 주소창에 `https://d1234abcdef.cloudfront.net/items`를 직접 입력하여 SPA 라우팅이 동작하는지 확인합니다.

> [!OUTPUT]
> Amazon CloudFront 배포가 완료되었습니다:
>
> - **Distribution ID**: `E1A2B3C4D5E6F7` (메모 — GitHub Secrets에 사용)
> - **Distribution domain name**: `d1234abcdef.cloudfront.net`
> - **Status**: `Enabled`
> - 브라우저에서 Vue.js 앱이 🔒 HTTPS로 로드됩니다.

> [!TIP]
> Amazon CloudFront 도메인 이름을 메모해두세요.
> Step 8-3에서 백엔드의 CORS 설정에 사용합니다.
> 또한 태스크 7에서 커스텀 도메인을 연결할 수 있습니다.

✅ **태스크 완료** — Amazon CloudFront 배포를 생성하여 CDN + HTTPS를 적용했습니다.

> [!TROUBLESHOOTING]
> | 증상 | 원인 | 해결 방법 |
> |------|------|-----------|
> | CloudFront URL 접속 시 `AccessDenied` | S3 버킷 정책 미설정 또는 Origin 설정 오류 | S3 웹사이트 엔드포인트를 Origin으로 사용했는지 확인 |
> | `/items` 직접 접속 시 403/404 에러 | 에러 페이지 설정 누락 | Custom Error Response에 403, 404 → `/index.html` (200) 추가 |
> | HTTPS 접속 불가 (ERR_SSL_PROTOCOL_ERROR) | Viewer Protocol Policy 설정 오류 | `Redirect HTTP to HTTPS` 선택 확인 |
> | 배포 생성 후 10분 이상 `InProgress` | 정상 동작 (전 세계 엣지 배포 중) | 최대 15분 대기, Status가 `Enabled`로 변경되면 완료 |
> | 이전 버전이 계속 표시됨 | Amazon CloudFront 캐시 | `Invalidation` 생성: `/*` 경로로 캐시 무효화 |

---

## 태스크 6: GitHub Actions 자동 배포

코드를 push하면 자동으로 빌드 → S3 업로드 → Amazon CloudFront 캐시 무효화가 실행되는 파이프라인을 구축합니다.

### IAM 사용자 생성 (GitHub Actions용)

35. 상단 검색창에 `IAM`을 입력하고 **IAM** 서비스를 선택합니다.
36. 왼쪽 메뉴에서 **Users**를 클릭합니다.
37. [[Create user]] 버튼을 클릭합니다.
38. **User name**에 `github-actions-frontend`를 입력합니다.
39. [[Next]] 버튼을 클릭합니다.
40. **Permissions options**에서 `Attach policies directly`를 선택합니다.
41. 검색창에 `S3`를 입력하고 `AmazonS3FullAccess`를 체크합니다.
42. 검색창을 지우고 `CloudFront`를 입력하고 `CloudFrontFullAccess`를 체크합니다.
43. [[Next]] 버튼을 클릭합니다.
44. **Review and create** 페이지에서 설정을 확인합니다:
    - User name: `github-actions-frontend`
    - Permissions: `AmazonS3FullAccess`, `CloudFrontFullAccess`
45. [[Create user]] 버튼을 클릭합니다.
46. 생성된 `github-actions-frontend` 사용자를 클릭합니다.
47. **Security credentials** 탭을 클릭합니다.
48. **Access keys** 섹션에서 [[Create access key]] 버튼을 클릭합니다.
49. **Use case**에서 `Third-party service`를 선택합니다.
50. 하단의 확인 체크박스를 선택하고 [[Next]] 버튼을 클릭합니다.
51. [[Create access key]] 버튼을 클릭합니다.
52. **Access key ID**와 **Secret access key**를 복사하여 안전한 곳에 저장합니다.

> [!WARNING]
> Secret access key는 이 화면에서만 확인할 수 있습니다.  
> 페이지를 닫으면 다시 볼 수 없으므로 반드시 복사하여 저장하세요.

### GitHub Secrets 설정

53. 브라우저에서 GitHub → `my-frontend` 리포지토리 페이지로 이동합니다.
54. **Settings** 탭을 클릭합니다.
55. 왼쪽 메뉴에서 **Secrets and variables** → **Actions**를 클릭합니다.
56. [[New repository secret]] 버튼을 클릭합니다.
57. 다음 Secrets를 하나씩 추가합니다:
    - **AWS_ACCESS_KEY_ID**: IAM에서 복사한 Access Key ID
    - **AWS_SECRET_ACCESS_KEY**: IAM에서 복사한 Secret Access Key
    - **AWS_REGION**: `ap-northeast-2`
    - **S3_BUCKET_NAME**: AWS CloudFormation Output의 S3BucketName 값
    - **CLOUDFRONT_DISTRIBUTION_ID**: Amazon CloudFront 배포 ID (예: `E1A2B3C4D5E6F7`)
    - **VITE_API_URL**: ALB DNS Name (예: `http://my-3tier-app-alb-xxx.elb.amazonaws.com/api`)

> [!TIP]
> **Vue.js .env 파일과 GitHub Secrets 관리 전략**
>
> Vite는 `VITE_` 접두사가 붙은 환경 변수만 클라이언트 코드에 노출합니다.  
> `.env` 파일 관리 방식을 선택하세요:
>
> | 방식                | `.env.production`   | GitHub Secrets      | 적합한 경우                   |
> | ------------------- | ------------------- | ------------------- | ----------------------------- |
> | **A. 파일 커밋**    | git에 포함          | 사용 안 함          | API URL만 있고 민감 정보 없음 |
> | **B. Secrets 주입** | `.gitignore`에 추가 | `VITE_API_URL` 등록 | API 키 등 민감 정보 포함      |
>
> **방식 B (Secrets 주입)를 사용하는 경우:**
>
> ```gitignore
> # .gitignore에 추가
> .env.production
> .env.local
> ```
>
> 워크플로우 빌드 스텝에서 환경 변수를 주입합니다:
>
> ```yaml
> - name: Build for production
>   run: npm run build
>   env:
>     VITE_API_URL: ${{ secrets.VITE_API_URL }}
>     VITE_API_KEY: ${{ secrets.VITE_API_KEY }}
> ```
>
> 또는 `.env.production` 파일을 직접 생성합니다:
>
> ```yaml
> - name: Create .env.production
>   run: |
>     echo "VITE_API_URL=${{ secrets.VITE_API_URL }}" > .env.production
>     echo "VITE_API_KEY=${{ secrets.VITE_API_KEY }}" >> .env.production
> ```
>
> 이 실습에서는 `VITE_API_URL`만 사용하므로 **방식 A(파일 커밋)** 또는 워크플로우의 `env`로 주입하는 것으로 충분합니다.

### GitHub Actions 워크플로우 작성

58. 프론트엔드 리포지토리 루트에 `.github/workflows/deploy.yml` 파일을 생성합니다:

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
          node-version: '22'
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

      # 7. Amazon CloudFront 캐시 무효화
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

### 배포 테스트

59. 변경사항을 커밋하고 push합니다:

```bash
cd ~/3tier-project/my-frontend

git add .
git commit -m "feat: initial frontend with CI/CD"
git push origin main
```

60. GitHub 리포지토리 페이지에서 **Actions** 탭을 클릭합니다.
61. 방금 트리거된 워크플로우를 클릭합니다.
62. 모든 스텝이 ✅ 성공하면 Amazon CloudFront URL에서 최신 버전을 확인합니다.

> [!OUTPUT]
> GitHub Actions 워크플로우 실행 결과:
>
> ```
> ✅ Checkout source code           (2s)
> ✅ Setup Node.js                  (5s)
> ✅ Install dependencies           (15s)
> ✅ Build for production           (8s)
> ✅ Configure AWS credentials      (1s)
> ✅ Deploy to S3                   (5s)
> ✅ Invalidate CloudFront cache    (2s)
> ✅ Deployment complete            (1s)
> ```
>
> 전체 실행 시간: 약 40초~1분

> [!TIP]
> Amazon CloudFront 캐시 무효화 후 전파에 1~2분 소요될 수 있습니다.  
> 브라우저에서 강력 새로고침(Ctrl+Shift+R)을 시도하세요.

✅ **태스크 완료** — GitHub Actions로 프론트엔드 자동 배포 파이프라인을 구축했습니다.

> [!TROUBLESHOOTING]
> | 증상 | 원인 | 해결 방법 |
> |------|------|-----------|
> | `AccessDenied` (S3 sync 단계) | IAM 사용자에 S3 권한 없음 | `AmazonS3FullAccess` 정책 연결 확인 |
> | `AccessDenied` (CloudFront invalidation) | IAM 사용자에 CloudFront 권한 없음 | `CloudFrontFullAccess` 정책 연결 확인 |
> | `InvalidArgument: Distribution ID` | `CLOUDFRONT_DISTRIBUTION_ID` Secret 값 오류 | CloudFront 콘솔에서 ID 재확인 (예: `E1A2B3C4D5E6F7`) |
> | 배포 성공했지만 변경 미반영 | Amazon CloudFront 캐시 전파 지연 | 1~2분 대기 후 브라우저 강력 새로고침 (Ctrl+Shift+R) |
> | `npm ci` 실패 | `package-lock.json` 미커밋 | `git add package-lock.json && git commit` 후 재push |

> [!NOTE]
> GitHub Actions에서 사용하는 IAM Access Key는 **최소 권한 원칙**을 적용하는 것이 좋습니다.  
> 실습에서는 편의상 FullAccess를 사용하지만, 프로덕션에서는 필요한 S3 버킷과 Amazon CloudFront 배포에만 접근 가능한 커스텀 정책을 생성하세요.

---

## 태스크 7: Amazon CloudFront에 커스텀 도메인 연결 (선택)

> [!NOTE]
> 이 태스크는 Step 7-1에서 Amazon Route 53 Hosted Zone과 ACM 인증서를 발급한 경우에 진행합니다.  
> 도메인이 없다면 Amazon CloudFront 기본 URL(`d1234abcdef.cloudfront.net`)로 사용해도 됩니다.

Step 7-1에서 발급한 ACM 인증서를 Amazon CloudFront에 연결하고,  
Amazon Route 53 A 레코드를 추가하여 `app.mydomain.shop` 같은 커스텀 도메인으로 접속할 수 있도록 합니다.

### ACM 인증서 확인 (us-east-1)

> [!WARNING]
> Amazon CloudFront에 사용할 인증서는 반드시 **us-east-1 (버지니아 북부)** 리전에서 발급해야 합니다.  
> Step 7-1에서 서울 리전(ap-northeast-2)에만 발급했다면, us-east-1에서 추가 발급이 필요합니다.

63. AWS Console 우측 상단에서 리전을 **US East (N. Virginia) us-east-1**로 변경합니다.
64. 상단 검색창에 `Certificate Manager`를 입력하고 **Certificate Manager** 서비스를 선택합니다.
65. `mydomain.shop` 또는 `*.mydomain.shop` 인증서가 **Issued** 상태인지 확인합니다.
66. 인증서가 없다면 Step 7-1과 동일한 방법으로 인증서를 요청합니다 (DNS 검증).

### Amazon CloudFront에 도메인 + 인증서 연결

67. 상단 검색창에 `CloudFront`를 입력하고 **CloudFront** 서비스를 선택합니다.
68. Distributions 목록에서 태스크 5에서 생성한 배포를 클릭합니다.
69. **General** 탭에서 [[Edit]] 버튼을 클릭합니다.
70. **Alternate domain name (CNAME)** 섹션에서 [[Add item]]을 클릭합니다.
71. 도메인을 입력합니다: `app.mydomain.shop` (본인 도메인으로 변경)
72. **Custom SSL certificate** 드롭다운에서 us-east-1에서 발급한 인증서를 선택합니다.
73. [[Save changes]] 버튼을 클릭합니다.

> [!TIP]
> 서브도메인 예시:
>
> - `app.mydomain.shop` → Amazon CloudFront (프론트엔드)
> - `api.mydomain.shop` → ALB (백엔드 API, Step 8-4에서 설정)
> - `mydomain.shop` → Amazon CloudFront 또는 ALB (메인)

### Amazon Route 53 A 레코드 추가

74. 상단 검색창에 `Route 53`을 입력하고 **Route 53** 서비스를 선택합니다.
75. 왼쪽 메뉴에서 **Hosted zones**를 클릭합니다.
76. 본인의 도메인을 클릭합니다.
77. [[Create record]] 버튼을 클릭합니다.
78. 다음과 같이 설정합니다:
    - **Record name**: `app` (결과: `app.mydomain.shop`)
    - **Record type**: `A`
    - **Alias**: ✅ 토글 ON
    - **Route traffic to**: `Alias to CloudFront distribution` 선택
    - 드롭다운에서 해당 Amazon CloudFront 배포를 선택합니다.
79. [[Create records]] 버튼을 클릭합니다.

### 커스텀 도메인 접속 확인

80. 브라우저에서 `https://app.mydomain.shop`으로 접속합니다.
81. 🔒 자물쇠 아이콘이 표시되고 Vue.js 화면이 로드되면 성공입니다.

> [!TROUBLESHOOTING]
> | 증상 | 원인 | 해결 방법 |
> |------|------|-----------|
> | ERR_SSL_PROTOCOL_ERROR | 인증서 미연결 또는 리전 오류 | us-east-1 인증서 확인 |
> | 403 Forbidden | CNAME 미설정 | CloudFront Alternate domain name 확인 |
> | DNS 접속 안 됨 | Route 53 레코드 미생성 | A 레코드 Alias 확인 |
> | "Your connection is not private" | 인증서 도메인 불일치 | ACM 인증서 도메인이 `*.mydomain.shop` 또는 `app.mydomain.shop` 포함하는지 확인 |

✅ **태스크 완료** — Amazon CloudFront에 커스텀 도메인과 HTTPS를 적용했습니다.

---

# 🗑️ 리소스 정리

> [!WARNING]
> 이 세션에서 생성한 리소스를 지금 삭제하지 마세요!  
> Step 8-3, 8-4에서 계속 사용합니다.  
> **Step 8-4에서 전체 정리합니다.**

### 이 세션에서 생성한 리소스 목록

| 리소스                         | 이름/식별자                  | 시간당 비용 | 월 비용 추정         |
| ------------------------------ | ---------------------------- | ----------- | -------------------- |
| Amazon CloudFront Distribution | `d1234abcdef.cloudfront.net` | 요청 기반   | ~$1 미만 (실습 수준) |
| IAM User                       | `github-actions-frontend`    | 무료        | 무료                 |
| GitHub Secrets                 | 6개                          | 무료        | 무료                 |

> [!NOTE]
> Amazon CloudFront는 월 1,000만 요청 + 1TB 전송까지 프리티어에 포함됩니다.  
> 실습 수준의 트래픽에서는 비용이 거의 발생하지 않습니다.  
> 단, Amazon CloudFront를 삭제하려면 먼저 **Disable** 후 **Delete** 순서를 지켜야 합니다.

✅ **실습 종료**: Step 8-3에서 Spring Boot 백엔드를 배포합니다.

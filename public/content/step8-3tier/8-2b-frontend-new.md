---
title: '새 Vue.js 프론트엔드 생성 + 배포 (S3 + CloudFront)'
week: 8
session: '2b'
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

이 실습에서는 **새 Vue.js 프로젝트를 생성**하고, API 연동 코드를 작성한 후,
Amazon S3 + Amazon CloudFront로 배포합니다.
GitHub Actions를 통해 코드를 push하면 자동으로 빌드 및 배포되는 파이프라인을 구축합니다.

### Step 8 전체 아키텍처

<img src="/images/step8/8-architecture.png" alt="Step 8 3-Tier 아키텍처" class="guide-img-lg" />

> [!NOTE]
> Step 8-1에서 생성한 AWS CloudFormation Outputs 값이 필요합니다:
>
> - **S3BucketName**: 프론트엔드 파일 업로드 대상
> - **ALBDNSName**: API 호출 대상 (Step 8-3 완료 후 사용)

---

## 태스크 1: Vue.js 프로젝트 생성

Vite를 사용하여 Vue.js 프로젝트를 새로 생성합니다.

### 1-1. 프로젝트 초기화

1. Vue.js 프로젝트를 생성합니다:

```bash
cd ~/3tier-project/my-frontend

# Vue.js 프로젝트 생성 (현재 디렉토리에 생성, 대화형 선택)
npm create vue@latest .
```

대화형 프롬프트에서 다음을 선택합니다:

- **Add TypeScript?** → No
- **Add JSX Support?** → No
- **Add Vue Router?** → **Yes**
- **Add Pinia?** → **Yes** (상태 관리가 필요한 경우)
- **Add Vitest?** → No
- **Add ESLint?** → No (또는 Yes)
- **Add Prettier?** → No (또는 Yes)

> [!NOTE]
> 8-1에서 클론한 레포 안에 이미 `README.md`, `.gitignore` 파일이 있습니다.
> "기존 파일이 있습니다. 덮어쓰시겠습니까?" 라고 물으면 **Yes**를 선택하세요.
> `.gitignore`는 생성된 것과 기존 것을 병합하면 됩니다.

2. 의존성을 설치합니다:

```bash
# 의존성 설치
npm install
```

3. Axios를 추가 설치합니다 (API 호출용):

```bash
# axios 추가 설치 (API 호출용)
npm install axios
```

### 1-2. 프로젝트 구조 확인

```
my-frontend/
├── public/
├── src/
│   ├── assets/
│   ├── components/
│   ├── router/
│   │   └── index.js       ← 라우터 설정 (자동 생성됨)
│   ├── stores/             ← Pinia 상태 관리 (Yes 선택 시 자동 생성)
│   ├── views/
│   │   ├── HomeView.vue   ← 메인 페이지 (자동 생성됨)
│   │   └── ItemsView.vue  ← CRUD 페이지 (직접 추가)
│   ├── api/
│   │   └── index.js       ← Axios 설정 (직접 추가)
│   ├── App.vue
│   └── main.js
├── .env.development       ← 개발 환경 변수 (직접 추가)
├── .env.production        ← 프로덕션 환경 변수 (직접 추가)
├── index.html
├── package.json
└── vite.config.js
```

### 1-3. Vue Router 설정

4. `src/router/index.js` 파일을 다음 내용으로 생성합니다:

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

5. `src/main.js` 파일을 다음과 같이 수정합니다:

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
> 단, SPA 라우팅을 위해 Amazon CloudFront에서 에러 페이지 설정이 필요합니다 (태스크 4에서 설정).

✅ **태스크 완료** — Vue.js 프로젝트를 생성하고 기본 구조를 설정했습니다.

---

## 태스크 2: API 연동 코드 작성

환경 변수로 API URL을 관리하고, Axios로 백엔드 API를 호출하는 코드를 작성합니다.

### 2-1. 환경 변수 파일 생성

6. 프로젝트 루트에 `.env.development` 파일을 생성합니다:

```bash
# 개발 환경 (로컬)
# .env.development
VITE_API_URL=http://localhost:8080/api
```

7. 프로젝트 루트에 `.env.production` 파일을 생성합니다:

```bash
# 프로덕션 환경 (배포)
# .env.production
VITE_API_URL=http://<ALB_DNS_NAME>/api
```

> [!WARNING]
> **`/api`를 포함하는 이유:**
> 새 프로젝트의 API 호출은 `/items`, `/health` 형태(상대 경로)이고, 백엔드 Controller의 `@RequestMapping("/api")`가 접두사를 붙입니다.
> `baseURL`에 `/api`를 포함해야 실제 요청이 `/api/items`, `/api/health`로 전송됩니다.

> [!WARNING]
> `.env.production`의 `<ALB_DNS_NAME>`은 Step 8-1 CloudFormation Outputs의 `ALBDNSName` 값으로 교체해야 합니다.
> Step 8-3에서 백엔드 배포 후 실제 동작합니다.
>
> **Mixed Content 주의:** CloudFront(HTTPS)에서 ALB(HTTP) API를 호출하면 브라우저가 차단합니다.
> 이 문제는 Step 8-4 태스크 1에서 도메인 + ALB HTTPS를 설정하면 해결됩니다.
> 설정 전에는 `curl`로 직접 API 테스트하세요.

### 2-2. Axios 설정

8. `src/api/index.js` 파일을 생성합니다:

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

9. `src/views/HomeView.vue` 파일을 생성합니다:

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

10. `src/views/ItemsView.vue` 파일을 생성합니다:

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

> [!TIP]
> Step 5-3에서 수동으로 설정했던 Block Public Access 해제, 버킷 정책, 정적 웹 호스팅 활성화를 AWS CloudFormation 템플릿에 정의하여 스택 생성 시 자동으로 설정되도록 했습니다.
> 이 태스크에서는 정상 생성되었는지 확인만 합니다.

### S3 버킷 설정 확인

> [!WARNING]
> AWS Console 우측 상단에서 리전이 **Asia Pacific (Seoul) ap-northeast-2**인지 확인하세요.

11. 상단 검색창에 `S3`를 입력하고 **S3** 서비스를 선택합니다.
12. Buckets 목록에서 `my-3tier-app-frontend-{BucketSuffix}` 버킷을 클릭합니다.
13. **Properties** 탭을 클릭합니다.
14. 페이지 하단의 **Static website hosting** 섹션에서 다음을 확인합니다:

- **S3 static website hosting**: Enabled
- **Hosting type**: Bucket hosting
- **Bucket website endpoint**: URL이 표시됨

15. Index/Error document를 확인하려면 [[Edit]] 버튼을 클릭합니다:

- **Index document**: `index.html`
- **Error document**: `index.html`

16. 확인만 하고 변경하지 않으므로 [[Cancel]] 버튼을 클릭하여 나갑니다.

### Block Public Access 확인

17. **Permissions** 탭을 클릭합니다.
18. **Block public access (bucket settings)** 섹션에서 모든 항목이 **Off**인지 확인합니다.

### 버킷 정책 확인

19. 같은 **Permissions** 탭에서 **Bucket policy** 섹션을 확인합니다.
20. 다음과 같은 정책이 설정되어 있는지 확인합니다:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::my-3tier-app-frontend-{BucketSuffix}/*"
    }
  ]
}
```

### 웹사이트 엔드포인트 확인

21. **Properties** 탭으로 돌아갑니다.
22. 페이지 하단의 **Static website hosting** 섹션에서 **Bucket website endpoint** URL을 복사합니다.
23. 브라우저에서 해당 URL로 접속합니다.

> [!OUTPUT]
> Amazon S3 웹사이트 엔드포인트 형식:
> `http://my-3tier-app-frontend-hong01.s3-website.ap-northeast-2.amazonaws.com`
>
> 접속 시 `404 Not Found` 페이지가 표시됩니다 (아직 파일을 업로드하지 않았으므로 정상).

✅ **태스크 완료** — Amazon S3 버킷의 정적 웹 호스팅 설정을 확인했습니다.

---

## 태스크 4: 빌드 및 S3 업로드

Vue.js 프로젝트를 빌드하고 Amazon S3에 업로드합니다.

### 4-1. 프로덕션 빌드

24. 프로덕션 빌드를 실행합니다:

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

25. 빌드 결과물을 S3에 업로드합니다:

```bash
# S3 버킷 이름 (Step 8-1 CloudFormation Outputs의 S3BucketName 값으로 변경)
BUCKET_NAME="my-3tier-app-frontend-hong01"

# dist 폴더를 S3에 동기화
aws s3 sync dist/ s3://$BUCKET_NAME --delete
```

> [!NOTE]
> `--delete` 옵션은 S3에 있지만 로컬 dist에 없는 파일을 삭제합니다.
> 이전 배포의 잔여 파일을 정리하여 깔끔한 상태를 유지합니다.

### 4-3. 업로드 확인

26. S3 버킷에 파일이 업로드되었는지 확인합니다:

```bash
# S3 버킷 내용 확인
aws s3 ls s3://$BUCKET_NAME --recursive
```

### 4-4. 브라우저에서 확인

27. Amazon S3 웹사이트 엔드포인트로 접속합니다:

```
http://my-3tier-app-frontend-hong01.s3-website.ap-northeast-2.amazonaws.com
```

> [!TIP]
> 이 시점에서는 API 서버가 아직 없으므로 "API 연결 실패" 메시지가 표시됩니다.
> 이는 정상입니다. Step 8-3에서 백엔드를 배포하면 정상 동작합니다.

✅ **태스크 완료** — Vue.js를 빌드하고 Amazon S3에 업로드하여 정적 웹사이트를 확인했습니다.

---

## 태스크 5: Amazon CloudFront 배포 생성

S3 앞에 Amazon CloudFront를 배치하여 CDN + HTTPS를 적용합니다.

### Amazon CloudFront 콘솔 이동

28. 상단 검색창에 `CloudFront`를 입력하고 **CloudFront** 서비스를 선택합니다.
29. [[Create distribution]] 버튼을 클릭합니다.

### Step 1: Choose a plan

30. **Pay as you go** (맨 아래)를 선택합니다.
31. [[Next]]를 클릭합니다.

### Step 2: Get started

32. **Distribution name**: `3tier-frontend` (또는 본인이 원하는 이름) 입력합니다.
33. **Description**: 비워둡니다 (선택사항).
34. **Distribution type**: `Single website or app` 선택 (기본값).
35. **Domain** 섹션: 비워둡니다 (커스텀 도메인은 태스크 7에서 설정).
36. **Tags** 섹션을 펼쳐서 다음 태그를 추가합니다:
    - `CreatedBy` = `admin-user`
    - `Step` = `step8`
    - `Session` = `8-2`
37. [[Next]]를 클릭합니다.

### Step 3: Specify origin

38. **Origin type**: `Other`를 선택합니다.

> [!WARNING]
> **`Amazon S3`를 선택하지 마세요!**
> 이 실습에서는 S3 **정적 웹 호스팅 엔드포인트**(public bucket)를 사용하므로 `Other`를 선택해야 합니다.

39. **Origin** 필드에 태스크 3에서 확인한 S3 웹사이트 엔드포인트를 직접 입력합니다:
    - `my-3tier-app-frontend-<BucketSuffix>.s3-website.ap-northeast-2.amazonaws.com`

40. **Origin path**: 비워둡니다.
41. **Settings** 섹션:
    - **Origin settings**: `Customize origin settings`를 선택합니다.
    - **Protocol**: `HTTP only` 선택

> [!WARNING]
> **Protocol을 반드시 `HTTP only`로 설정하세요!**
> S3 웹사이트 엔드포인트는 HTTP만 지원합니다.

42. **Cache settings**: `Customize cache settings` 선택
43. **Viewer protocol policy**: `Redirect HTTP to HTTPS` 선택
44. **Allowed HTTP methods**: `GET, HEAD` (기본값 유지)
45. **Cache policy**: `CachingOptimized` (기본값)
46. **Origin request policy**: 비워둡니다.
47. **Response headers policy**: 비워둡니다.
48. [[Next]]를 클릭합니다.

### Step 4: Enable security

49. **Web Application Firewall (WAF)**: `Do not enable security protections` 선택

> [!WARNING]
> `Enable security protections`를 선택하면 **AWS WAF 비용이 월 $14 이상** 발생할 수 있습니다.
> 학습용 실습에서는 반드시 `Do not enable security protections`를 선택하세요.

50. [[Next]]를 클릭합니다.

### Step 5: Review and create

51. 설정 내용을 확인하고 [[Create distribution]] 버튼을 클릭합니다.

### Default root object 설정 (필수)

52. 생성 직후 상세 페이지의 **General** 탭 → **Settings** 섹션에서 [[Edit]] 버튼을 클릭합니다.
53. **Default root object** 필드에 `index.html`을 입력합니다.
54. **Price class**를 `Use only North America and Europe`로 변경합니다 (비용 절약, 선택사항).
55. [[Save changes]]를 클릭합니다.

### 에러 페이지 설정 (SPA 라우팅)

56. 생성된 Distribution 상세 페이지에서 **Error pages** 탭을 클릭합니다.
57. [[Create custom error response]] 버튼을 클릭합니다.
58. 다음과 같이 설정합니다:
    - **HTTP error code**: `403` 선택
    - **Customize error response**: `Yes` 선택
    - **Response page path**: `/index.html` 입력
    - **HTTP response code**: `200` 선택
59. [[Create custom error response]] 버튼을 클릭하여 저장합니다.

60. 같은 방식으로 `404` 에러도 추가합니다:
    - **HTTP error code**: `404` 선택
    - **Customize error response**: `Yes` 선택
    - **Response page path**: `/index.html` 입력
    - **HTTP response code**: `200` 선택
61. [[Create custom error response]] 버튼을 클릭하여 저장합니다.

> [!CONCEPT] SPA 라우팅과 에러 페이지 설정
>
> Vue Router의 `createWebHistory()`는 `/items` 같은 경로를 사용합니다.
> 사용자가 `/items`를 직접 입력하면 Amazon CloudFront는 S3에서 `/items` 파일을 찾지만, 실제로는 존재하지 않아 403/404 에러가 발생합니다.
> 에러 페이지를 `/index.html`로 설정하면, 모든 경로에서 Vue.js가 로드되고 클라이언트 측 라우터가 올바른 페이지를 렌더링합니다.

### Amazon CloudFront URL 접속 확인

62. Status가 `Enabled`로 변경되었는지 확인합니다 (약 5~10분 소요).
63. **Distribution domain name**을 복사합니다 (예: `d1234abcdef.cloudfront.net`).
64. 브라우저에서 `https://d1234abcdef.cloudfront.net`으로 접속합니다.
65. Vue.js 앱이 HTTPS로 정상 로드되는지 확인합니다.
66. `https://d1234abcdef.cloudfront.net/items`를 직접 입력하여 SPA 라우팅이 동작하는지 확인합니다.

> [!OUTPUT]
> Amazon CloudFront 배포가 완료되었습니다:
>
> - **Distribution ID**: `E1A2B3C4D5E6F7` (메모 — GitHub Secrets에 사용)
> - **Distribution domain name**: `d1234abcdef.cloudfront.net`
> - **Status**: `Enabled`

> [!TIP]
> Amazon CloudFront 도메인 이름을 메모해두세요.
> Step 8-3 태스크 4에서 백엔드의 CORS 설정에 사용합니다.

✅ **태스크 완료** — Amazon CloudFront 배포를 생성하여 CDN + HTTPS를 적용했습니다.

---

## 태스크 6: GitHub Actions 자동 배포

코드를 push하면 자동으로 빌드 → S3 업로드 → Amazon CloudFront 캐시 무효화가 실행되는 파이프라인을 구축합니다.

### IAM 사용자 생성 (GitHub Actions용)

67. 상단 검색창에 `IAM`을 입력하고 **IAM** 서비스를 선택합니다.
68. 왼쪽 메뉴에서 **IAM Users**를 클릭합니다.
69. [[Create user]]를 클릭합니다.
70. **User name**: `github-actions-frontend`를 입력합니다.
71. **Provide user access to the AWS Management Console** 체크를 **하지 않습니다**.
72. [[Next]]를 클릭합니다.
73. **Permissions options**에서 `Attach policies directly`를 선택합니다.
74. 검색창에 `S3`를 입력하고 `AmazonS3FullAccess`를 체크합니다.
75. 검색창을 지우고 `CloudFront`를 입력하고 `CloudFrontFullAccess`를 체크합니다.
76. [[Next]]를 클릭합니다.
77. 설정을 확인하고 [[Create user]]를 클릭합니다.

### Access Key 생성

78. 생성된 `github-actions-frontend` 사용자를 클릭하여 상세 페이지로 이동합니다.
79. **Security credentials** 탭 → **Access keys** 섹션에서 [[Create access key]]를 클릭합니다.
80. **Use case**: `Third-party service` → 확인 체크 → [[Next]] → [[Create access key]]
81. **Access key ID**와 **Secret access key**를 복사하여 안전한 곳에 저장합니다.

> [!WARNING]
> Secret access key는 이 화면에서만 확인할 수 있습니다.

### GitHub Secrets 설정

82. GitHub → `my-frontend` 리포지토리 → **Settings** → **Secrets and variables** → **Actions**
83. [[New repository secret]] 버튼을 클릭하고 다음 Secrets를 추가합니다:
    - `AWS_ACCESS_KEY_ID`: 81번에서 복사한 Access Key ID
    - `AWS_SECRET_ACCESS_KEY`: 81번에서 복사한 Secret Access Key
    - `AWS_REGION`: `ap-northeast-2`
    - `S3_BUCKET_NAME`: `<Step 8-1 CloudFormation Outputs의 S3BucketName 값>`
    - `CLOUDFRONT_DISTRIBUTION_ID`: `<태스크 5에서 메모한 Distribution ID>`
    - `VITE_API_URL`: `http://<ALBDNSName>/api` (`/api` 포함)

### GitHub Actions 워크플로우 작성

84. 프론트엔드 리포지토리 루트에 `.github/workflows/deploy.yml` 파일을 생성합니다:

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
      - name: Checkout source code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build for production
        run: npm run build
        env:
          VITE_API_URL: ${{ secrets.VITE_API_URL }}

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ secrets.AWS_REGION }}

      - name: Deploy to S3
        run: |
          aws s3 sync dist/ s3://${{ secrets.S3_BUCKET_NAME }} \
            --delete \
            --cache-control "public, max-age=31536000" \
            --exclude "index.html"

          aws s3 cp dist/index.html s3://${{ secrets.S3_BUCKET_NAME }}/index.html \
            --cache-control "no-cache, no-store, must-revalidate"

      - name: Invalidate CloudFront cache
        run: |
          aws cloudfront create-invalidation \
            --distribution-id ${{ secrets.CLOUDFRONT_DISTRIBUTION_ID }} \
            --paths "/*"

      - name: Deployment complete
        run: |
          echo "✅ Frontend deployed successfully!"
```

### 배포 테스트

85. 변경사항을 커밋하고 push합니다:

```bash
cd ~/3tier-project/my-frontend

git add .
git commit -m "feat: initial frontend with CI/CD"
git push origin main
```

86. GitHub 리포지토리 페이지에서 **Actions** 탭을 클릭합니다.
87. 모든 스텝이 ✅ 성공하면 Amazon CloudFront URL에서 최신 버전을 확인합니다.

✅ **태스크 완료** — GitHub Actions로 프론트엔드 자동 배포 파이프라인을 구축했습니다.

---

## 태스크 7: Amazon CloudFront에 커스텀 도메인 연결 (선택)

> [!NOTE]
> 이 태스크는 Step 7-1에서 Amazon Route 53 Hosted Zone과 ACM 인증서를 발급한 경우에 진행합니다.
> 도메인이 없다면 Amazon CloudFront 기본 URL(`d1234abcdef.cloudfront.net`)로 사용해도 됩니다.

### ACM 인증서 확인 (us-east-1)

> [!WARNING]
> Amazon CloudFront에 사용할 인증서는 반드시 **us-east-1 (버지니아 북부)** 리전에서 발급해야 합니다.

88. AWS Console 우측 상단에서 리전을 **US East (N. Virginia) us-east-1**로 변경합니다.
89. 상단 검색창에 `Certificate Manager`를 입력하고 **Certificate Manager** 서비스를 선택합니다.
90. `mydomain.shop` 또는 `*.mydomain.shop` 인증서가 **Issued** 상태인지 확인합니다.

### Amazon CloudFront에 CNAME + 인증서 연결

91. **CloudFront** 서비스로 이동하여 배포를 선택하고 **General** 탭에서 [[Edit]] 버튼을 클릭합니다.
92. **Alternate domain name (CNAME)**: `app.<mydomain.shop>`
93. **Custom SSL certificate**: us-east-1 인증서 선택
94. [[Save changes]] 버튼을 클릭합니다.

### Amazon Route 53 A 레코드 추가

95. **Route 53** → Hosted zones에서 본인의 도메인을 클릭하고 [[Create record]] 버튼을 클릭합니다.
96. 설정:
    - **Record name**: `app`
    - **Record type**: `A`
    - **Alias**: ON → `Alias to CloudFront distribution` → 본인 Distribution 선택
97. [[Create records]] 버튼을 클릭합니다.

### 커스텀 도메인 접속 확인

98. 브라우저에서 `https://app.<mydomain.shop>`으로 접속합니다.
99. 🔒 자물쇠 아이콘이 표시되고 Vue.js 화면이 로드되면 성공입니다.

✅ **태스크 완료** — Amazon CloudFront에 커스텀 도메인과 HTTPS를 적용했습니다.

---

# 🗑️ 리소스 정리

> [!WARNING]
> 이 세션에서 생성한 리소스를 지금 삭제하지 마세요!
> Step 8-3, 8-4에서 계속 사용합니다.
> **Step 8-4에서 전체 정리합니다.**

✅ **실습 종료**: Step 8-3에서 백엔드를 배포합니다.

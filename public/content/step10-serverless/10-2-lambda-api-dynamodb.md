---
title: 'Lambda + API Gateway + DynamoDB 서버리스 API'
week: 10
session: 2
awsServices:
  - AWS Lambda
  - Amazon API Gateway
  - Amazon DynamoDB
learningObjectives:
  - Lambda 함수에서 DynamoDB를 읽고 쓰는 코드를 작성할 수 있습니다.
  - API Gateway REST API를 생성하고 Lambda와 연동할 수 있습니다.
  - 서버리스 아키텍처의 전체 흐름을 이해할 수 있습니다.
  - EC2 기반 API와 서버리스 API의 차이를 비교할 수 있습니다.
prerequisites:
  - AWS 계정 생성 완료
  - DynamoDB 테이블 생성 완료 (Step 10-1 참조, 또는 이 실습에서 생성)
estimatedCost: 항상 무료 (Lambda·API Gateway·DynamoDB 모두 무료 티어 포함)
---

이 실습에서는 Lambda + API Gateway + DynamoDB를 연동하여 완전한 서버리스 REST API를
구축합니다. AWS SDK v3를 사용하여 Lambda에서 DynamoDB를 직접 읽고 쓰는 코드를 작성하고,
API Gateway를 통해 외부에서 호출할 수 있는 CRUD API를 배포합니다.

> [!NOTE]
> 이 실습은 Step 10-1에서 생성한 `Items` 테이블을 사용합니다.
> 테이블이 없다면 태스크 0에서 생성합니다.

---

## 태스크 0: 선행 리소스 확인

### DynamoDB Items 테이블 확인

1. AWS Management Console에 로그인합니다.
2. 리전을 **Asia Pacific (Seoul) ap-northeast-2**로 설정합니다.
3. 상단 검색창에 `DynamoDB`를 입력하고 선택합니다.
4. 왼쪽 메뉴에서 **Tables**를 클릭합니다.
5. `Items` 테이블이 있는지 확인합니다.

### 테이블이 없는 경우 — 여기서 생성

`Items` 테이블이 없다면 다음 단계로 생성합니다:

6. [[Create table]]을 클릭합니다.
7. 다음을 설정합니다:
   - **Table name**: `Items`
   - **Partition key**: `id` (타입: **String**)
   - **Sort key**: 비워둡니다
8. **Table settings**: Customize settings
9. **Capacity mode**: **On-demand**
10. [[Create table]]을 클릭합니다.

> [!OUTPUT]
> 테이블 상태가 "Active"로 변경되면 준비 완료입니다.
>
> ```
> Table name: Items
> Partition key: id (String)
> Capacity mode: On-demand
> Status: Active
> ```

### CLI로 확인하는 방법

```bash
aws dynamodb describe-table \
  --table-name Items \
  --query "Table.{Name:TableName,Status:TableStatus,PK:KeySchema}" \
  --region ap-northeast-2
```

> [!OUTPUT]
>
> ```json
> {
>   "Name": "Items",
>   "Status": "ACTIVE",
>   "PK": [{ "AttributeName": "id", "KeyType": "HASH" }]
> }
> ```

✅ **태스크 완료** — DynamoDB Items 테이블이 준비되었습니다.

---

## 태스크 1: EC2 vs 서버리스 아키텍처 비교

### 아키텍처 다이어그램

```
EC2 기반 API:
┌──────────┐     ┌─────────────────────────────┐     ┌─────────┐
│ 클라이언트│ ──→ │ EC2 (Node.js/Spring Boot)   │ ──→ │   RDS   │
└──────────┘     │ • 24시간 실행                │     └─────────┘
                 │ • OS/런타임 직접 관리         │
                 │ • 보안 패치 직접 적용         │
                 └─────────────────────────────┘

서버리스 API:
┌──────────┐     ┌─────────────┐     ┌──────────┐     ┌──────────┐
│ 클라이언트│ ──→ │ API Gateway │ ──→ │  Lambda  │ ──→ │ DynamoDB │
└──────────┘     └─────────────┘     └──────────┘     └──────────┘
                 │ URL 라우팅    │     │ 코드만    │     │ 완전관리  │
                 │ 인증/제한     │     │ 작성      │     │ 서버리스  │
```

### 상세 비교표

| 항목                   | EC2 기반 API                | 서버리스 API               |
| ---------------------- | --------------------------- | -------------------------- |
| **서버 관리**          | OS 업데이트, 보안 패치 직접 | 없음 (AWS가 모두 관리)     |
| **과금 방식**          | 시간당 (실행 여부 무관)     | 요청 수 + 실행 시간만      |
| **확장**               | Auto Scaling 설정 필요      | 자동 확장 (동시 1000개)    |
| **Cold Start**         | 없음 (항상 실행 중)         | 있음 (수백ms ~ 수초)       |
| **실행 시간 제한**     | 없음                        | 최대 15분                  |
| **배포**               | SSH 접속, PM2, Docker 등    | 코드 업로드만              |
| **데이터베이스**       | RDS (관계형)                | DynamoDB (NoSQL)           |
| **월 비용 (저트래픽)** | 최소 $10~30                 | $0 (무료 티어)             |
| **적합한 경우**        | 상시 트래픽, WebSocket      | 이벤트 기반, 간헐적 트래픽 |

> [!CONCEPT] 서버리스의 핵심 가치
> 서버리스는 "서버가 없다"는 뜻이 아니라 "서버를 관리하지 않는다"는 의미입니다.
>
> - **개발자**: 비즈니스 로직(코드)에만 집중
> - **AWS**: 서버 프로비저닝, 확장, 패치, 모니터링 담당
> - **비용**: 사용한 만큼만 지불 (0 요청 = $0)
>
> Lambda + API Gateway + DynamoDB 조합은 가장 대표적인 서버리스 스택입니다.

✅ **태스크 완료** — EC2 기반 API와 서버리스 API의 차이를 이해했습니다.

---

## 태스크 2: Lambda 함수 생성

DynamoDB와 연동할 Lambda 함수를 생성합니다.

### 함수 생성 단계

11. 상단 검색창에 `Lambda`를 입력하고 선택합니다.
12. [[Create function]]을 클릭합니다.
13. **Author from scratch**를 선택합니다.
14. 다음을 설정합니다:

- **Function name**: `starter-dynamodb-api`
- **Runtime**: **Node.js 22.x**
- **Architecture**: x86_64

15. **Permissions** 섹션을 펼칩니다:

- **Execution role**: **Create a new role with basic Lambda permissions**

16. [[Create function]]을 클릭합니다.

> [!OUTPUT]
> "Successfully created the function starter-dynamodb-api" 메시지가 표시됩니다.

### IAM Role에 DynamoDB 권한 추가

Lambda가 DynamoDB에 접근하려면 IAM 권한이 필요합니다.

17. 함수 상세 페이지에서 **Configuration** 탭을 클릭합니다.
18. 왼쪽 메뉴에서 **Permissions**를 클릭합니다.
19. **Execution role** 섹션에서 Role name 링크를 클릭합니다 (IAM 콘솔로 이동).
20. IAM Role 페이지에서 [[Add permissions]] → [[Attach policies]]를 클릭합니다.
21. 검색창에 `DynamoDB`를 입력합니다.
22. **AmazonDynamoDBFullAccess**를 체크합니다.
23. [[Add permissions]]를 클릭합니다.

> [!OUTPUT]
> "Policy AmazonDynamoDBFullAccess has been attached to role" 메시지가 표시됩니다.

> [!WARNING]
> `AmazonDynamoDBFullAccess`는 학습용으로 사용합니다.
> 프로덕션에서는 최소 권한 원칙에 따라 필요한 테이블과 작업만 허용하는
> 커스텀 정책을 사용하세요.
>
> ```json
> {
>   "Effect": "Allow",
>   "Action": [
>     "dynamodb:GetItem",
>     "dynamodb:PutItem",
>     "dynamodb:DeleteItem",
>     "dynamodb:Scan"
>   ],
>   "Resource": "arn:aws:dynamodb:ap-northeast-2:*:table/Items"
> }
> ```

✅ **태스크 완료** — Lambda 함수를 생성하고 DynamoDB 접근 권한을 부여했습니다.

> [!NOTE]
> IAM 정책 변경 후 Lambda에 반영되기까지 수 초가 걸릴 수 있습니다.
> 권한 추가 직후 테스트에서 `AccessDeniedException`이 발생하면 10~20초 대기 후 재시도하세요.

---

## 태스크 3: Lambda 코드 작성 (AWS SDK v3)

AWS SDK v3의 `@aws-sdk/client-dynamodb`를 사용하여 DynamoDB CRUD API를 구현합니다.

> [!CONCEPT] AWS SDK v3 in Lambda
> Lambda Node.js 22.x 런타임에는 AWS SDK v3가 기본 포함되어 있습니다.
> 별도의 npm install 없이 바로 `import`하여 사용할 수 있습니다.
>
> - `@aws-sdk/client-dynamodb`: 저수준 DynamoDB 클라이언트
> - `PutItemCommand`: 항목 생성
> - `GetItemCommand`: 단건 조회
> - `ScanCommand`: 전체 조회
> - `DeleteItemCommand`: 항목 삭제

### 코드 작성

24. Lambda 함수 페이지에서 **Code** 탭을 선택합니다.
25. `index.mjs` 파일의 내용을 아래 코드로 교체합니다:

```javascript
// index.mjs - Lambda + DynamoDB CRUD API
import {
  DynamoDBClient,
  PutItemCommand,
  GetItemCommand,
  ScanCommand,
  DeleteItemCommand,
} from '@aws-sdk/client-dynamodb';

// DynamoDB 클라이언트 생성 (Lambda 실행 환경의 리전 사용)
const client = new DynamoDBClient({});
const TABLE_NAME = 'Items';

export const handler = async (event) => {
  console.log('Received event:', JSON.stringify(event, null, 2));

  const method = event.httpMethod;
  const path = event.path;
  const pathParameters = event.pathParameters;

  try {
    // GET /items - 전체 목록 조회
    if (method === 'GET' && path === '/items') {
      return await getAllItems();
    }

    // GET /items/{id} - 단건 조회
    if (method === 'GET' && pathParameters && pathParameters.id) {
      return await getItemById(pathParameters.id);
    }

    // POST /items - 새 아이템 생성
    if (method === 'POST' && path === '/items') {
      const body = JSON.parse(event.body);
      return await createItem(body);
    }

    // DELETE /items/{id} - 아이템 삭제
    if (method === 'DELETE' && pathParameters && pathParameters.id) {
      return await deleteItem(pathParameters.id);
    }

    return response(404, { message: `Route not found: ${method} ${path}` });
  } catch (error) {
    console.error('Error:', error);
    return response(500, {
      message: 'Internal server error',
      error: error.message,
    });
  }
};

// ─── GET /items ─── 전체 목록 조회 (Scan)
async function getAllItems() {
  const command = new ScanCommand({
    TableName: TABLE_NAME,
  });

  const result = await client.send(command);

  // DynamoDB 형식을 일반 JSON으로 변환
  const items = result.Items.map((item) => ({
    id: item.id.S,
    name: item.name.S,
    price: Number(item.price.N),
    ...(item.category && { category: item.category.S }),
  }));

  return response(200, { items, count: items.length });
}

// ─── GET /items/{id} ─── 단건 조회
async function getItemById(id) {
  const command = new GetItemCommand({
    TableName: TABLE_NAME,
    Key: { id: { S: id } },
  });

  const result = await client.send(command);

  if (!result.Item) {
    return response(404, { message: 'Item not found' });
  }

  const item = {
    id: result.Item.id.S,
    name: result.Item.name.S,
    price: Number(result.Item.price.N),
    ...(result.Item.category && { category: result.Item.category.S }),
  };

  return response(200, item);
}

// ─── POST /items ─── 새 아이템 생성
async function createItem(body) {
  if (!body.id || !body.name || !body.price) {
    return response(400, { message: 'id, name, and price are required' });
  }

  const item = {
    id: { S: body.id },
    name: { S: body.name },
    price: { N: String(body.price) },
    createdAt: { S: new Date().toISOString() },
  };

  if (body.category) {
    item.category = { S: body.category };
  }

  const command = new PutItemCommand({
    TableName: TABLE_NAME,
    Item: item,
  });

  await client.send(command);

  return response(201, {
    message: 'Item created',
    item: {
      id: body.id,
      name: body.name,
      price: body.price,
      category: body.category || null,
      createdAt: item.createdAt.S,
    },
  });
}

// ─── DELETE /items/{id} ─── 아이템 삭제
async function deleteItem(id) {
  // 먼저 항목이 존재하는지 확인
  const getCommand = new GetItemCommand({
    TableName: TABLE_NAME,
    Key: { id: { S: id } },
  });

  const existing = await client.send(getCommand);

  if (!existing.Item) {
    return response(404, { message: 'Item not found' });
  }

  const deleteCommand = new DeleteItemCommand({
    TableName: TABLE_NAME,
    Key: { id: { S: id } },
  });

  await client.send(deleteCommand);

  return response(200, {
    message: 'Item deleted',
    item: {
      id: existing.Item.id.S,
      name: existing.Item.name.S,
    },
  });
}

// ─── 응답 헬퍼 함수 ───
function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '\*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
    body: JSON.stringify(body),
  };
}
```

26. [[Deploy]]를 클릭하여 코드를 배포합니다.

> [!OUTPUT]
> "Successfully updated the function starter-dynamodb-api" 메시지가 표시됩니다.

> [!NOTE]
> DynamoDB의 데이터 형식은 `{ "S": "문자열" }`, `{ "N": "숫자" }` 형태입니다.
> SDK v3의 저수준 클라이언트를 사용하면 이 형식을 직접 다뤄야 합니다.
> 더 편리한 방법으로 `@aws-sdk/lib-dynamodb`의 `DynamoDBDocumentClient`를
> 사용하면 일반 JavaScript 객체처럼 다룰 수 있습니다.

✅ **태스크 완료** — AWS SDK v3를 사용한 DynamoDB CRUD Lambda 코드를 작성하고 배포했습니다.

---

## 태스크 4: Lambda 테스트 이벤트로 동작 확인

코드가 DynamoDB와 정상적으로 연동되는지 테스트합니다.

### POST /items 테스트 — 항목 생성

27. Lambda 함수 페이지에서 **Test** 탭을 선택합니다.
28. [[Create new event]]를 클릭합니다.
29. 다음을 설정합니다:

- **Event name**: `test-create-item`
- **Event JSON**:

```json
{
  "httpMethod": "POST",
  "path": "/items",
  "pathParameters": null,
  "body": "{\"id\": \"item-101\", \"name\": \"무선 이어폰\", \"price\": 89000, \"category\": \"전자제품\"}"
}
```

30. [[Save]]를 클릭합니다.
31. [[Test]]를 클릭합니다.

> [!OUTPUT]
> **Execution result: succeeded**
>
> ```json
> {
>   "statusCode": 201,
>   "headers": { "Content-Type": "application/json", ... },
>   "body": "{\"message\":\"Item created\",\"item\":{\"id\":\"item-101\",\"name\":\"무선 이어폰\",\"price\":89000,\"category\":\"전자제품\",\"createdAt\":\"2025-01-15T10:30:00.000Z\"}}"
> }
> ```

### GET /items 테스트 — 전체 조회

32. 새 이벤트를 생성합니다:

- **Event name**: `test-get-all-items`
- **Event JSON**:

```json
{
  "httpMethod": "GET",
  "path": "/items",
  "pathParameters": null,
  "body": null
}
```

33. [[Test]]를 실행합니다.

> [!OUTPUT]
> **Execution result: succeeded**
>
> ```json
> {
>   "statusCode": 200,
>   "body": "{\"items\":[{\"id\":\"item-101\",\"name\":\"무선 이어폰\",\"price\":89000,\"category\":\"전자제품\"}],\"count\":1}"
> }
> ```

### GET /items/{id} 테스트 — 단건 조회

34. 새 이벤트를 생성합니다:

- **Event name**: `test-get-item`
- **Event JSON**:

```json
{
  "httpMethod": "GET",
  "path": "/items/item-101",
  "pathParameters": { "id": "item-101" },
  "body": null
}
```

35. [[Test]]를 실행합니다.

> [!OUTPUT]
> **Execution result: succeeded**
>
> ```json
> {
>   "statusCode": 200,
>   "body": "{\"id\":\"item-101\",\"name\":\"무선 이어폰\",\"price\":89000,\"category\":\"전자제품\"}"
> }
> ```

### DELETE /items/{id} 테스트 — 항목 삭제

36. 새 이벤트를 생성합니다:
    - **Event name**: `test-delete-item`
    - **Event JSON**:

```json
{
  "httpMethod": "DELETE",
  "path": "/items/item-101",
  "pathParameters": { "id": "item-101" },
  "body": null
}
```

37. [[Test]]를 실행합니다.

> [!OUTPUT]
> **Execution result: succeeded**
>
> ```json
> {
>   "statusCode": 200,
>   "body": "{\"message\":\"Item deleted\",\"item\":{\"id\":\"item-101\",\"name\":\"무선 이어폰\"}}"
> }
> ```

> [!TIP]
> DynamoDB 콘솔에서 `Items` 테이블의 **Explore table items**를 확인하면
> Lambda에서 생성/삭제한 항목이 실제로 반영된 것을 볼 수 있습니다.

✅ **태스크 완료** — Lambda 테스트 이벤트로 DynamoDB CRUD 동작을 확인했습니다.

> [!TROUBLESHOOTING]
> | 증상 | 원인 | 해결 방법 |
> |------|------|-----------|
> | `AccessDeniedException` (DynamoDB) | IAM Role에 DynamoDB 권한 미부여 | Configuration → Permissions에서 정책 확인 |
> | `ResourceNotFoundException` | 테이블 이름 불일치 | 코드의 `TABLE_NAME`이 `Items`인지 확인 (대소문자 주의) |
> | `Internal server error` | 코드 문법 오류 | CloudWatch Logs에서 에러 상세 확인 |
> | `Task timed out after 3.00 seconds` | DynamoDB 응답 지연 또는 네트워크 문제 | Lambda 타임아웃을 10초로 증가 (Configuration → General) |
> | `Cannot find module` 에러 | 파일명이 `index.mjs`가 아님 | Handler가 `index.handler`이고 파일명이 `index.mjs`인지 확인 |

---

## 태스크 5: API Gateway REST API 생성

Lambda 함수를 외부에서 HTTP로 호출할 수 있도록 API Gateway를 설정합니다.

### API 생성

38. 상단 검색창에 `API Gateway`를 입력하고 선택합니다.
39. **REST API** 섹션에서 [[Build]]를 클릭합니다.

> [!WARNING]
> "HTTP API"가 아닌 **"REST API"**를 선택하세요.
> HTTP API는 더 간단하지만, 이 실습에서는 REST API의 리소스/메서드 구조를 학습합니다.

> [!NOTE]
> API Gateway 콘솔에 "REST API"가 2개 보일 수 있습니다:
>
> - **REST API** ← 이것을 선택하세요
> - **REST API (Private)** ← VPC 내부 전용, 선택하지 마세요
>
> "HTTP API"와 "WebSocket API"도 있지만 이 실습에서는 사용하지 않습니다.

40. 다음을 설정합니다:

- **API name**: `starter-serverless-api`
- **API endpoint type**: Regional

41. [[Create API]]를 클릭합니다.

### 리소스 생성 (/items)

42. `/` (루트)를 선택한 상태에서 [[Create resource]]를 클릭합니다.
43. 설정:

- **Resource name**: `items`
- **Resource path**: `/items` (자동)
- ✅ **CORS (Cross Origin Resource Sharing)** 체크

44. [[Create resource]]를 클릭합니다.

### 하위 리소스 생성 (/items/{id})

45. `/items` 리소스를 선택합니다.
46. [[Create resource]]를 클릭합니다.
47. 설정:
    - **Resource name**: `{id}`
    - **Resource path**: `/items/{id}`
    - ✅ **CORS** 체크
48. [[Create resource]]를 클릭합니다.

### 메서드 생성 (GET /items)

49. `/items` 리소스를 선택합니다.
50. [[Create method]]를 클릭합니다.
51. 설정:
    - **Method type**: GET
    - **Integration type**: Lambda Function
    - ✅ **Lambda proxy integration** 체크
    - **Lambda function**: `starter-dynamodb-api` 선택
52. [[Create method]]를 클릭합니다.

### 메서드 생성 (POST /items)

53. `/items` 리소스를 선택합니다.
54. [[Create method]]를 클릭합니다.
55. 설정:
    - **Method type**: POST
    - **Integration type**: Lambda Function
    - ✅ **Lambda proxy integration** 체크
    - **Lambda function**: `starter-dynamodb-api`
56. [[Create method]]를 클릭합니다.

### 메서드 생성 (GET /items/{id})

57. `/items/{id}` 리소스를 선택합니다.
58. [[Create method]]를 클릭합니다.
59. 설정:
    - **Method type**: GET
    - **Integration type**: Lambda Function
    - ✅ **Lambda proxy integration** 체크
    - **Lambda function**: `starter-dynamodb-api`
60. [[Create method]]를 클릭합니다.

### 메서드 생성 (DELETE /items/{id})

61. `/items/{id}` 리소스를 선택합니다.
62. [[Create method]]를 클릭합니다.
63. 설정:
    - **Method type**: DELETE
    - **Integration type**: Lambda Function
    - ✅ **Lambda proxy integration** 체크
    - **Lambda function**: `starter-dynamodb-api`
64. [[Create method]]를 클릭합니다.

> [!OUTPUT]
> Resources 트리가 다음과 같이 구성됩니다:
>
> ```
> /
> └── /items
>     ├── GET     → starter-dynamodb-api (Lambda Proxy)
>     ├── POST    → starter-dynamodb-api (Lambda Proxy)
>     ├── OPTIONS → (CORS preflight)
>     └── /{id}
>         ├── GET     → starter-dynamodb-api (Lambda Proxy)
>         ├── DELETE  → starter-dynamodb-api (Lambda Proxy)
>         └── OPTIONS → (CORS preflight)
> ```

> [!CONCEPT] Lambda Proxy Integration
> Lambda 프록시 통합을 사용하면 API Gateway가 HTTP 요청의 모든 정보를
> Lambda의 `event` 객체로 그대로 전달합니다.
>
> - `event.httpMethod`: HTTP 메서드 (GET, POST, DELETE)
> - `event.path`: 요청 경로 (/items, /items/item-101)
> - `event.pathParameters`: 경로 파라미터 ({ id: "item-101" })
> - `event.body`: 요청 본문 (POST의 JSON 데이터)
>
> Lambda는 `statusCode`, `headers`, `body`를 포함한 객체를 반환해야 합니다.

✅ **태스크 완료** — API Gateway REST API를 생성하고 Lambda와 연동했습니다.

> [!WARNING]
> API Gateway에서 리소스나 메서드를 변경한 후에는 반드시 **Deploy API**를 실행해야 합니다.
> 배포하지 않으면 변경사항이 실제 URL에 반영되지 않습니다.
> 초보자가 가장 많이 하는 실수 중 하나입니다.

---

## 태스크 6: API 배포 + curl 테스트

### API 배포 (prod 스테이지)

65. API Gateway 콘솔에서 `starter-serverless-api`를 선택합니다.
66. [[Deploy API]]를 클릭합니다.
67. 설정:

- **Stage**: **\*New Stage\***
- **Stage name**: `prod`

68. [[Deploy]]를 클릭합니다.

### Invoke URL 확인

69. **Stages** → `prod`를 선택합니다.
70. 상단에 **Invoke URL**이 표시됩니다:

> [!OUTPUT]
>
> ```
> Invoke URL: https://xyz789abc1.execute-api.ap-northeast-2.amazonaws.com/prod
> ```

### curl 테스트

아래 명령에서 URL을 본인의 Invoke URL로 교체하세요.

#### POST /items — 아이템 생성

```bash
curl -X POST \
  https://xyz789abc1.execute-api.ap-northeast-2.amazonaws.com/prod/items \
  -H "Content-Type: application/json" \
  -d '{
    "id": "item-201",
    "name": "블루투스 스피커",
    "price": 65000,
    "category": "전자제품"
  }'
```

> [!OUTPUT]
>
> ```json
> {
>   "message": "Item created",
>   "item": {
>     "id": "item-201",
>     "name": "블루투스 스피커",
>     "price": 65000,
>     "category": "전자제품",
>     "createdAt": "2025-01-15T11:00:00.000Z"
>   }
> }
> ```

#### GET /items — 전체 목록 조회

```bash
curl https://xyz789abc1.execute-api.ap-northeast-2.amazonaws.com/prod/items
```

> [!OUTPUT]
>
> ```json
> {
>   "items": [
>     {
>       "id": "item-201",
>       "name": "블루투스 스피커",
>       "price": 65000,
>       "category": "전자제품"
>     }
>   ],
>   "count": 1
> }
> ```

#### GET /items/{id} — 단건 조회

```bash
curl https://xyz789abc1.execute-api.ap-northeast-2.amazonaws.com/prod/items/item-201
```

> [!OUTPUT]
>
> ```json
> {
>   "id": "item-201",
>   "name": "블루투스 스피커",
>   "price": 65000,
>   "category": "전자제품"
> }
> ```

#### DELETE /items/{id} — 아이템 삭제

```bash
curl -X DELETE \
  https://xyz789abc1.execute-api.ap-northeast-2.amazonaws.com/prod/items/item-201
```

> [!OUTPUT]
>
> ```json
> {
>   "message": "Item deleted",
>   "item": {
>     "id": "item-201",
>     "name": "블루투스 스피커"
>   }
> }
> ```

#### 에러 케이스 테스트

```bash
# 존재하지 않는 아이템 조회
curl https://xyz789abc1.execute-api.ap-northeast-2.amazonaws.com/prod/items/not-exist
```

> [!OUTPUT]
>
> ```json
> { "message": "Item not found" }
> ```

```bash
# 필수 필드 누락
curl -X POST \
  https://xyz789abc1.execute-api.ap-northeast-2.amazonaws.com/prod/items \
  -H "Content-Type: application/json" \
  -d '{"name": "테스트"}'
```

> [!OUTPUT]
>
> ```json
> { "message": "id, name, and price are required" }
> ```

> [!TIP]
> 브라우저 주소창에 GET URL을 직접 입력해도 결과를 확인할 수 있습니다.
> POST/DELETE는 curl, Postman, 또는 브라우저 개발자 도구의 fetch를 사용하세요.

✅ **태스크 완료** — API를 prod 스테이지에 배포하고 curl로 모든 엔드포인트를 테스트했습니다.

> [!TROUBLESHOOTING]
> | 증상 | 원인 | 해결 방법 |
> |------|------|-----------|
> | `{"message":"Missing Authentication Token"}` | URL 경로 오류 (스테이지명 누락) | URL에 `/prod/items` 포함 확인 |
> | `{"message":"Internal server error"}` | Lambda 코드 에러 | CloudWatch Logs에서 Lambda 에러 로그 확인 |
> | `403 Forbidden` | API Gateway 권한 또는 리소스 정책 | Lambda 함수의 리소스 기반 정책 확인 |
> | CORS 에러 (브라우저) | OPTIONS 메서드 미설정 | 리소스에 CORS 활성화 확인, 재배포 |
> | 변경사항 미반영 | API 재배포 안 함 | 코드/설정 변경 후 반드시 [[Deploy API]] 실행 |

---

## 태스크 7: CloudWatch Logs 확인 + 비용 분석

### CloudWatch Logs 확인

71. 상단 검색창에 `CloudWatch`를 입력하고 선택합니다.
72. 왼쪽 메뉴에서 **Logs** → **Log groups**를 클릭합니다.
73. `/aws/lambda/starter-dynamodb-api` 로그 그룹을 클릭합니다.
74. 최신 **Log stream**을 클릭합니다.

### 로그 분석

> [!OUTPUT]
>
> ```
> START RequestId: a1b2c3d4-... Version: $LATEST
> 2025-01-15T11:00:00.000Z  INFO  Received event: {
>   "httpMethod": "GET",
>   "path": "/items",
>   ...
> }
> END RequestId: a1b2c3d4-...
> REPORT RequestId: a1b2c3d4-...
>   Duration: 45.67 ms          ← DynamoDB 호출 포함
>   Billed Duration: 46 ms      ← 과금 기준 (1ms 단위)
>   Memory Size: 128 MB
>   Max Memory Used: 72 MB
>   Init Duration: 312.45 ms    ← Cold Start (첫 호출 시만)
> ```

### Cold Start vs Warm Start 비교

| 항목            | Cold Start (첫 호출) | Warm Start (연속 호출) |
| --------------- | -------------------- | ---------------------- |
| Init Duration   | 300~500ms            | 없음                   |
| Duration        | 40~100ms             | 5~30ms                 |
| Total 응답 시간 | 400~600ms            | 5~30ms                 |

> [!CONCEPT] Cold Start가 발생하는 시점
>
> 1. 함수를 처음 호출할 때
> 2. 코드를 업데이트한 후 첫 호출
> 3. 약 5~15분 동안 호출이 없은 후 다시 호출할 때
> 4. 동시 요청이 증가하여 새 실행 환경이 필요할 때
>
> Node.js Lambda의 Cold Start는 보통 300~500ms로, 대부분의 API에서 허용 가능합니다.

### 비용 분석

이 실습에서 사용한 서버리스 리소스의 비용을 계산합니다:

| 서비스              | 무료 티어 (항상 무료)      | 이 실습 사용량  | 비용   |
| ------------------- | -------------------------- | --------------- | ------ |
| **Lambda**          | 월 100만 요청 + 40만 GB-초 | 수십 요청       | $0     |
| **API Gateway**     | 월 100만 API 호출 (12개월) | 수십 호출       | $0     |
| **DynamoDB**        | 25GB + 월 2억 5천만 R/W    | 수 KB, 수십 R/W | $0     |
| **CloudWatch Logs** | 5GB 수집 + 5GB 저장        | 수 KB           | $0     |
| **합계**            |                            |                 | **$0** |

> [!TIP]
> 같은 기능을 EC2로 구현하면 최소 월 $10~30의 비용이 발생합니다.
> 서버리스는 트래픽이 적은 학습/개발 환경에서 비용 면에서 압도적으로 유리합니다.
> 하루 수천 건 이하의 요청이라면 서버리스가 거의 항상 무료입니다.

### Lambda 비용 계산 공식 (참고)

```
Lambda 비용 = 요청 수 비용 + 실행 시간 비용

요청 수 비용:
  월 100만 요청 무료, 이후 100만 요청당 $0.20

실행 시간 비용:
  월 40만 GB-초 무료
  이후 1GB-초당 $0.0000166667

예시: 128MB 메모리, 50ms 실행, 월 10만 요청
  = 100,000 × 0.128GB × 0.05초
  = 640 GB-초
  → 무료 티어(40만 GB-초) 초과분: 240 GB-초
  → 비용: 240 × $0.0000166667 = $0.004 (약 5원)
```

✅ **태스크 완료** — CloudWatch Logs에서 실행 로그를 확인하고 서버리스 비용 구조를 분석했습니다.

---

# 🗑️ 리소스 정리

> [!NOTE]
> 서버리스 리소스는 사용하지 않으면 비용이 $0입니다. 급하게 삭제할 필요 없이, 학습이 끝난 후 한꺼번에 정리해도 됩니다.
>
> | 리소스           | 월 비용 (미사용 시) | 비고                 |
> | ---------------- | ------------------- | -------------------- |
> | Lambda 함수      | $0                  | 호출하지 않으면 무료 |
> | API Gateway      | $0                  | 호출하지 않으면 무료 |
> | DynamoDB (Items) | $0                  | 25GB 무료 티어       |
> | CloudWatch Logs  | $0.03/GB 저장       | 소량이면 무시 가능   |
> | IAM Role         | $0                  | 항상 무료            |
>
> **서버리스는 사용하지 않으면 비용이 발생하지 않으므로 유지해도 무방합니다.**

> [!NOTE]
> 삭제 순서 (의존 관계):
>
> 1. API Gateway 삭제 → 2. Lambda 함수 삭제 → 3. DynamoDB 테이블 삭제 (선택) → 4. CloudWatch Logs 삭제 → 5. IAM Role 삭제
>
> API Gateway가 Lambda를 참조하므로 먼저 삭제합니다.

---

### 단계 1: API Gateway 삭제

API Gateway를 먼저 삭제합니다 (Lambda를 참조하고 있으므로).

75. API Gateway 콘솔에서 `starter-serverless-api`를 선택합니다.
76. **Actions** → [[Delete API]]를 클릭합니다.
77. 확인 입력란에 API 이름을 입력합니다.
78. [[Delete]]를 클릭합니다.

> [!NOTE]
> API가 삭제되면 Invoke URL로 더 이상 접근할 수 없습니다.

---

### 단계 2: Lambda 함수 삭제

79. Lambda 콘솔에서 `starter-dynamodb-api` 함수를 선택합니다.
80. **Actions** → [[Delete function]]을 클릭합니다.
81. 확인 대화상자에서 [[Delete]]를 클릭합니다.

---

### 단계 3: DynamoDB 테이블 (유지 또는 삭제)

DynamoDB는 항상 무료 티어(25GB + 월 2억 5천만 R/W)가 매우 넉넉하므로 유지해도 됩니다.

**삭제하는 경우:**

82. DynamoDB 콘솔에서 `Items` 테이블을 선택합니다.
83. [[Delete]]를 클릭합니다.
84. 확인 입력란에 `delete`를 입력합니다.
85. ☐ **Create a backup of this table before deleting it** 체크 해제
86. [[Delete table]]을 클릭합니다.

---

### 단계 4: CloudWatch Logs 삭제

CloudWatch Logs는 저장 용량에 따라 소액 과금될 수 있으므로 불필요한 로그 그룹은 삭제합니다.

87. CloudWatch 콘솔 → **Logs** → **Log groups**
88. `/aws/lambda/starter-dynamodb-api` 로그 그룹을 선택합니다.
89. **Actions** → [[Delete log group(s)]]를 클릭합니다.
90. [[Delete]]를 클릭합니다.

---

### 단계 5: IAM Role 삭제 (선택)

Lambda 생성 시 자동으로 만들어진 IAM Role을 삭제합니다.

91. IAM 콘솔 → **Roles** → `starter-dynamodb-api-role-` 로 시작하는 Role 검색
92. 선택 후 [[Delete]]를 클릭합니다.
93. 확인 입력란에 Role 이름을 입력하고 [[Delete]]를 클릭합니다.

---

### 단계 6: 삭제 확인

```bash
# Lambda 함수 확인
aws lambda list-functions \
  --query "Functions[?starts_with(FunctionName, 'starter-')].[FunctionName]" \
  --output table --region ap-northeast-2

# API Gateway 확인
aws apigateway get-rest-apis \
  --query "items[?starts_with(name, 'starter-')].[name]" \
  --output table --region ap-northeast-2

# DynamoDB 테이블 확인
aws dynamodb list-tables --region ap-northeast-2
```

모든 리소스가 삭제되었다면 위 명령들의 결과가 비어있어야 합니다.

✅ **실습 종료**: 모든 리소스가 정리되었습니다.

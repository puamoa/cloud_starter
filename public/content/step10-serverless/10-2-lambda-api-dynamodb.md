---
title: 'AWS Lambda + Amazon API Gateway + Amazon DynamoDB 서버리스 API'
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
estimatedCost: 이 실습 수준에서 비용 미미 (트래픽·무료 플랜 여부에 따라 달라짐)
---

이 실습에서는 AWS Lambda + Amazon API Gateway + Amazon DynamoDB를 연동하여 완전한 서버리스 REST API를
구축합니다.  
AWS SDK v3를 사용하여 Lambda에서 DynamoDB를 직접 읽고 쓰는 코드를 작성하고,
API Gateway를 통해 외부에서 호출할 수 있는 CRUD API를 배포합니다.

> [!NOTE]
> 이 실습은 Step 10-1에서 생성한 `Items` 테이블을 사용합니다.  
> 테이블이 없다면 태스크 0에서 생성합니다.

---

## 태스크 0: 선행 리소스 확인

### Amazon DynamoDB Items 테이블 확인

1. AWS Management Console에 로그인합니다.
2. 리전을 **Asia Pacific (Seoul) ap-northeast-2**로 설정합니다.

<img src="/images/common/region-check.png" alt="리전 확인" class="guide-img-sm" />

> [!TIP]
> 일부 AWS 서비스(IAM, CloudFront, Route 53 등)는 **글로벌 서비스**이므로 리전 선택 드롭다운이 비활성화되거나 "Global"로 표시됩니다.  
> 이 실습에서 사용하는 서비스는 리전 기반이므로 반드시 올바른 리전이 선택되어 있는지 확인하세요.

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
8. **Table settings**: **Default settings** (기본값 그대로 사용)
9. **Tags** 섹션에서 [[Add new tag]]를 클릭하여 태그를 추가합니다:
   - **Key**: `CreatedBy`, **Value**: `admin-user`
   - **Key**: `Step`, **Value**: `step10`
   - **Key**: `Session`, **Value**: `10-2`
10. [[Create table]]을 클릭합니다.

> [!OUTPUT]
> 테이블 상태가 "Active"로 변경되면 준비 완료입니다.
>
> ```
> Table name: Items
> Partition key: id (String)
> Capacity mode: On-demand (Default)
> Status: Active
> ```

### CLI로 확인하는 방법

11. 터미널(또는 CloudShell)을 열고 다음 명령어를 실행합니다:

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

> [!TIP]
> 로컬 터미널에서 CLI를 사용하려면 `aws configure`로 Access Key가 설정되어 있어야 합니다.  
> 또는 AWS CloudShell을 사용하면 별도 설정 없이 현재 로그인한 사용자 권한으로 바로 실행됩니다.

✅ **태스크 완료** — Amazon DynamoDB Items 테이블이 준비되었습니다.

---

## 태스크 1: EC2 vs 서버리스 아키텍처 비교

### 아키텍처 다이어그램

```
EC2 기반 API:
┌────────────┐     ┌───────────────────────────────┐     ┌─────────┐
│ 클라이언트 │ ──→ │ EC2 (Node.js/Spring Boot)     │ ──→ │   RDS   │
└────────────┘     │ • 24시간 실행                 │     └─────────┘
                   │ • OS/런타임 직접 관리         │
                   │ • 보안 패치 직접 적용         │
                   └───────────────────────────────┘

서버리스 API:
┌────────────┐     ┌─────────────┐     ┌──────────┐     ┌───────────┐
│ 클라이언트 │ ──→ │ API Gateway │ ──→ │  Lambda  │ ──→ │ DynamoDB  │
└────────────┘     └─────────────┘     └──────────┘     └───────────┘
                   │ URL 라우팅  │     │ 코드만   │     │ 완전관리  │
                   │ 인증/제한   │     │ 작성     │     │ 서버리스  │
```

### 상세 비교표

| 항목                   | EC2 기반 API                                                             | 서버리스 API                                |
| ---------------------- | ------------------------------------------------------------------------ | ------------------------------------------- |
| **서버 관리**          | OS 업데이트, 보안 패치 직접                                              | 없음 (AWS가 모두 관리)                      |
| **과금 방식**          | 시간당 (실행 여부 무관)                                                  | 요청 수 + 실행 시간만                       |
| **확장**               | Auto Scaling 설정 필요                                                   | 자동 확장 (동시 1000개)                     |
| **Cold Start**         | 없음 (항상 실행 중)                                                      | 있음 (수백ms ~ 수초)                        |
| **실행 시간 제한**     | 없음                                                                     | 최대 15분                                   |
| **배포**               | SSH 접속, PM2, Docker 등                                                 | 코드 업로드만                               |
| **데이터베이스**       | RDS (관계형)                                                             | DynamoDB (NoSQL)                            |
| **월 비용 (저트래픽)** | ~$20 (t3.micro + 8GB EBS + db.t3.micro RDS, 무료 플랜 미적용, 서울 리전) | 이 실습 수준 미미 (트래픽에 따라 종량 과금) |
| **적합한 경우**        | 상시 트래픽, WebSocket                                                   | 이벤트 기반, 간헐적 트래픽                  |

> [!NOTE]
> 위 EC2 비용은 무료 플랜 미적용, 서울 리전, 24시간 상시 운영 기준 참고 금액입니다.  
> 양쪽 모두 실제 과금은 무료 플랜 적용 여부, 트래픽, 데이터 전송량, 추가 서비스(NAT, ALB 등)에 따라 달라집니다.
>
> **각 서비스 요금 페이지:**
>
> - [Amazon EC2 요금](https://aws.amazon.com/ec2/pricing/)
> - [Amazon RDS 요금](https://aws.amazon.com/rds/pricing/)
> - [AWS Lambda 요금](https://aws.amazon.com/lambda/pricing/)
> - [Amazon API Gateway 요금](https://aws.amazon.com/api-gateway/pricing/)
> - [Amazon DynamoDB 요금](https://aws.amazon.com/dynamodb/pricing/)

> [!CONCEPT] 서버리스의 핵심 가치
> 서버리스는 "서버가 없다"는 뜻이 아니라 "서버를 관리하지 않는다"는 의미입니다.
>
> - **개발자**: 비즈니스 로직(코드)에만 집중
> - **AWS**: 서버 프로비저닝, 확장, 패치, 모니터링 담당
> - **비용**: 사용한 만큼만 지불 (요청이 없으면 과금 없음)
>
> AWS Lambda + Amazon API Gateway + Amazon DynamoDB 조합은 가장 대표적인 서버리스 스택입니다.

✅ **태스크 완료** — EC2 기반 API와 서버리스 API의 차이를 이해했습니다.

---

## 태스크 2: AWS Lambda 함수 생성

Amazon DynamoDB와 연동할 AWS Lambda 함수를 생성합니다.

### 함수 생성 단계

12. 상단 검색창에 `Lambda`를 입력하고 선택합니다.
13. 왼쪽 메뉴에서 **Functions**를 클릭합니다.
14. [[Create a function]]을 클릭합니다.
15. **Author from scratch**를 선택합니다 (기본 선택됨).
16. **Basic information**을 설정합니다:
    - **Function name**: `starter-dynamodb-api`
    - **Runtime**: **Node.js** 최신 버전 선택 (예: Node.js 24.x)

> [!NOTE]
> **Custom settings** 섹션이 표시되지만 변경하지 않습니다.  
> Durable execution, EC2 capacity provider 등은 기본값(Off)을 유지하세요.  
> **Permissions**도 기본값 그대로 — Lambda가 자동으로 CloudWatch Logs 권한이 포함된 실행 역할을 생성합니다.

17. [[Create function]]을 클릭합니다.

> [!OUTPUT]
> "Successfully created the function starter-dynamodb-api" 메시지가 표시됩니다.  
> **Getting started** 팝업이 나타나면 [[Dismiss]]를 클릭하여 닫습니다.

### IAM Role에 Amazon DynamoDB 권한 추가

Lambda가 DynamoDB에 접근하려면 IAM 권한이 필요합니다.

18. 함수 상세 페이지에서 **Configuration** 탭을 클릭합니다.
19. 왼쪽 메뉴에서 **Permissions**를 클릭합니다.
20. **Execution role** 섹션에서 Role name 링크를 클릭합니다 (IAM 콘솔로 이동).

> [!TIP]
> **Execution role**은 Lambda 함수가 다른 AWS 서비스에 접근할 때 사용하는 IAM 역할입니다.  
> 함수 생성 시 자동으로 만들어지며, 기본적으로 CloudWatch Logs에 로그를 쓸 수 있는 권한만 포함되어 있습니다.  
> DynamoDB, S3 등 다른 서비스에 접근하려면 해당 권한을 추가해야 합니다.

21. IAM Role 페이지에서 [[Add permissions]] → [[Attach policies]]를 클릭합니다.
22. 검색창에 `DynamoDB`를 입력합니다.
23. **AmazonDynamoDBFullAccess**를 체크합니다.
24. [[Add permissions]]를 클릭합니다.

> [!OUTPUT]
> "Policy AmazonDynamoDBFullAccess has been attached to role" 메시지가 표시됩니다.

### AWS Lambda 함수에 태그 추가

25. 브라우저의 뒤로가기로 Lambda 함수 페이지로 돌아갑니다.
26. **Configuration** 탭 → 왼쪽 메뉴에서 **Tags**를 클릭합니다.
27. [[Manage tags]]를 클릭합니다.
28. 다음 태그를 추가합니다:
    - **Key**: `CreatedBy`, **Value**: `admin-user`
    - **Key**: `Step`, **Value**: `step10`
    - **Key**: `Session`, **Value**: `10-2`
29. [[Save]]를 클릭합니다.

> [!WARNING]
> `AmazonDynamoDBFullAccess`는 학습용으로 사용합니다.  
> 프로덕션에서는 최소 권한 원칙에 따라 필요한 테이블과 작업만 허용하는 커스텀 정책을 사용하세요.
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

✅ **태스크 완료** — AWS Lambda 함수를 생성하고 Amazon DynamoDB 접근 권한을 부여했습니다.

> [!NOTE]
> IAM 정책 변경 후 Lambda에 반영되기까지 수 초가 걸릴 수 있습니다.  
> 권한 추가 직후 테스트에서 `AccessDeniedException`이 발생하면 10~20초 대기 후 재시도하세요.

---

## 태스크 3: Lambda 코드 작성 (AWS SDK v3)

AWS SDK v3의 `@aws-sdk/client-dynamodb`를 사용하여 Amazon DynamoDB CRUD API를 구현합니다.

> [!CONCEPT] AWS SDK v3 in Lambda
> Lambda Node.js 런타임(18.x 이상)에는 AWS SDK v3가 기본 포함되어 있습니다.  
> 별도의 npm install 없이 바로 `import`하여 사용할 수 있습니다.
>
> - `@aws-sdk/client-dynamodb`: 저수준 DynamoDB 클라이언트
> - `PutItemCommand`: 항목 생성
> - `GetItemCommand`: 단건 조회
> - `ScanCommand`: 전체 조회
> - `DeleteItemCommand`: 항목 삭제

### 코드 작성

30. Lambda 함수 페이지에서 **Code** 탭을 선택합니다.
31. `index.mjs` 파일의 내용을 아래 코드로 교체합니다:

```javascript
// index.mjs - Lambda + DynamoDB CRUD API

// AWS SDK v3에서 DynamoDB 관련 명령어를 import
import {
  DynamoDBClient, // DynamoDB 연결 클라이언트
  PutItemCommand, // 항목 생성 (Create)
  GetItemCommand, // 단건 조회 (Read)
  ScanCommand, // 전체 조회 (테이블 스캔)
  DeleteItemCommand, // 항목 삭제 (Delete)
} from '@aws-sdk/client-dynamodb';

// DynamoDB 클라이언트 생성
// 빈 객체 {} → Lambda 실행 환경의 리전(ap-northeast-2)을 자동으로 사용
// handler 밖에서 생성하면 Warm Start 시 재사용됨 (성능 최적화)
const client = new DynamoDBClient({});
const TABLE_NAME = 'Items'; // 10-1에서 생성한 테이블 이름

/**
 * Lambda 핸들러 함수 (진입점)
 * API Gateway가 HTTP 요청 정보를 event 객체로 전달함
 *
 * event 주요 필드:
 * - event.httpMethod: "GET", "POST", "DELETE" 등
 * - event.path: "/items", "/items/item-101" 등
 * - event.pathParameters: { id: "item-101" } (경로 파라미터)
 * - event.body: POST 요청의 JSON 문자열
 */
export const handler = async (event) => {
  console.log('Received event:', JSON.stringify(event, null, 2));

  const method = event.httpMethod; // HTTP 메서드
  const path = event.path; // 요청 경로
  const pathParameters = event.pathParameters; // 경로 파라미터 ({id})

  try {
    // 라우팅: HTTP 메서드 + 경로 조합으로 적절한 함수 호출

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
      const body = JSON.parse(event.body); // JSON 문자열 → 객체 변환
      return await createItem(body);
    }

    // DELETE /items/{id} - 아이템 삭제
    if (method === 'DELETE' && pathParameters && pathParameters.id) {
      return await deleteItem(pathParameters.id);
    }

    // 위 조건에 해당하지 않으면 404 반환
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
  // ScanCommand: 테이블의 모든 항목을 조회 (데이터 적을 때만 사용 권장)
  const command = new ScanCommand({
    TableName: TABLE_NAME,
  });

  const result = await client.send(command); // DynamoDB에 명령 전송

  // DynamoDB 형식 { "S": "값" } → 일반 JSON { key: "값" } 으로 변환
  const items = result.Items.map((item) => ({
    id: item.id.S, // .S = String 타입 값 추출
    name: item.name.S,
    price: Number(item.price.N), // .N = Number 타입 (문자열이므로 Number()로 변환)
    ...(item.category && { category: item.category.S }), // 선택 속성 (없을 수 있음)
  }));

  return response(200, { items, count: items.length });
}

// ─── GET /items/{id} ─── 단건 조회
async function getItemById(id) {
  // GetItemCommand: 파티션 키로 단건 조회 (가장 빠른 조회 방식)
  const command = new GetItemCommand({
    TableName: TABLE_NAME,
    Key: { id: { S: id } }, // 키 형식: { 속성명: { 타입코드: 값 } }
  });

  const result = await client.send(command);

  // 항목이 없으면 404 반환
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
  // 필수 필드 검증
  if (!body.id || !body.name || !body.price) {
    return response(400, { message: 'id, name, and price are required' });
  }

  // DynamoDB 형식으로 항목 구성: { 속성명: { 타입코드: 값 } }
  const item = {
    id: { S: body.id }, // String
    name: { S: body.name }, // String
    price: { N: String(body.price) }, // Number (문자열로 전달해야 함)
    createdAt: { S: new Date().toISOString() }, // 생성 시각 자동 추가
  };

  // 선택 속성: category가 있으면 추가
  if (body.category) {
    item.category = { S: body.category };
  }

  // PutItemCommand: 항목 생성 (같은 키가 있으면 덮어쓰기)
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
  // 먼저 항목이 존재하는지 확인 (없으면 404 반환하기 위해)
  const getCommand = new GetItemCommand({
    TableName: TABLE_NAME,
    Key: { id: { S: id } },
  });

  const existing = await client.send(getCommand);

  if (!existing.Item) {
    return response(404, { message: 'Item not found' });
  }

  // DeleteItemCommand: 파티션 키로 항목 삭제
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
// API Gateway + Lambda Proxy Integration이 요구하는 응답 형식
function response(statusCode, body) {
  return {
    statusCode, // HTTP 상태 코드 (200, 201, 404, 500)
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*', // CORS: 모든 출처 허용
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
    body: JSON.stringify(body), // 응답 본문 (객체 → JSON 문자열)
  };
}
```

32. [[Deploy]]를 클릭하여 코드를 배포합니다.

> [!OUTPUT]
> "Successfully updated the function starter-dynamodb-api" 메시지가 표시됩니다.

> [!NOTE]
> DynamoDB의 데이터 형식은 `{ "S": "문자열" }`, `{ "N": "숫자" }` 형태입니다.  
> SDK v3의 저수준 클라이언트를 사용하면 이 형식을 직접 다뤄야 합니다.  
> 더 편리한 방법으로 `@aws-sdk/lib-dynamodb`의 `DynamoDBDocumentClient`를
> 사용하면 일반 JavaScript 객체처럼 다룰 수 있습니다.

✅ **태스크 완료** — AWS SDK v3를 사용한 Amazon DynamoDB CRUD Lambda 코드를 작성하고 배포했습니다.

---

## 태스크 4: Lambda 테스트 이벤트로 동작 확인

코드가 Amazon DynamoDB와 정상적으로 연동되는지 테스트합니다.

### POST /items 테스트 — 항목 생성

33. Lambda 함수 페이지에서 **Test** 탭을 선택합니다.
34. **Test event action**에서 **Create new event**가 선택되어 있는지 확인합니다.
35. 다음을 설정합니다:
    - **Invocation type**: Synchronous (기본값)
    - **Event name**: `test-create-item`
    - **Event sharing settings**: Private (기본값)
    - **Template**: Hello World (기본값, 변경하지 않음)
    - **Event JSON**: 기존 내용을 지우고 아래 JSON을 붙여넣습니다:

    ```json
    {
      "httpMethod": "POST",
      "path": "/items",
      "pathParameters": null,
      "body": "{\"id\": \"item-101\", \"name\": \"무선 이어폰\", \"price\": 89000, \"category\": \"전자제품\"}"
    }
    ```

> [!TIP]
> **Test 탭 사용법:**
>
> - **Create new event**: 새 테스트 이벤트를 만들어 저장합니다.
> - **Edit saved event**: 기존에 저장한 이벤트를 선택하여 수정/실행합니다.
> - **Invocation type**: Synchronous(동기)는 실행 결과를 바로 반환하고, Asynchronous(비동기)는 요청만 전달하고 결과는 별도로 확인합니다.  
>   이 실습에서는 **Synchronous**(기본값)를 사용합니다.
> - **Event sharing settings**: Private은 본인만 사용하고, Shareable은 같은 계정의 다른 IAM 사용자도 사용할 수 있습니다.
> - **Template**: Hello World(기본값) 등 샘플 템플릿을 선택하면 Event JSON이 자동으로 채워지지만, 이 실습에서는 직접 입력합니다.
> - Save를 먼저 클릭해야 이벤트가 저장되며, Test를 클릭하면 저장된 이벤트로 함수가 실행됩니다.

36. [[Save]]를 클릭합니다.
37. [[Test]]를 클릭합니다.

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

38. **Create new event**를 선택하고 새 이벤트를 생성합니다:
    - **Invocation type**: Synchronous (기본값)
    - **Event name**: `test-get-all-items`
    - **Event sharing settings**: Private (기본값)
    - **Template**: Hello World (기본값, 변경하지 않음)
    - **Event JSON**:

    ```json
    {
      "httpMethod": "GET",
      "path": "/items",
      "pathParameters": null,
      "body": null
    }
    ```

39. [[Save]]를 클릭한 뒤 [[Test]]를 클릭합니다.

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

40. **Create new event**를 선택하고 새 이벤트를 생성합니다:
    - **Invocation type**: Synchronous (기본값)
    - **Event name**: `test-get-item`
    - **Event sharing settings**: Private (기본값)
    - **Template**: Hello World (기본값, 변경하지 않음)
    - **Event JSON**:

    ```json
    {
      "httpMethod": "GET",
      "path": "/items/item-101",
      "pathParameters": { "id": "item-101" },
      "body": null
    }
    ```

41. [[Save]]를 클릭한 뒤 [[Test]]를 클릭합니다.

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

42. **Create new event**를 선택하고 새 이벤트를 생성합니다:
    - **Invocation type**: Synchronous (기본값)
    - **Event name**: `test-delete-item`
    - **Event sharing settings**: Private (기본값)
    - **Template**: Hello World (기본값, 변경하지 않음)
    - **Event JSON**:

    ```json
    {
      "httpMethod": "DELETE",
      "path": "/items/item-101",
      "pathParameters": { "id": "item-101" },
      "body": null
    }
    ```

43. [[Save]]를 클릭한 뒤 [[Test]]를 클릭합니다.

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

✅ **태스크 완료** — Lambda 테스트 이벤트로 Amazon DynamoDB CRUD 동작을 확인했습니다.

> [!TROUBLESHOOTING]
> | 증상 | 원인 | 해결 방법 |
> |------|------|-----------|
> | `AccessDeniedException` (DynamoDB) | IAM Role에 DynamoDB 권한 미부여 | Configuration → Permissions에서 정책 확인 |
> | `ResourceNotFoundException` | 테이블 이름 불일치 | 코드의 `TABLE_NAME`이 `Items`인지 확인 (대소문자 주의) |
> | `Internal server error` | 코드 문법 오류 | CloudWatch Logs에서 에러 상세 확인 |
> | `Task timed out after 3.00 seconds` | DynamoDB 응답 지연 또는 네트워크 문제 | Lambda 타임아웃을 10초로 증가 (Configuration → General) |
> | `Cannot find module` 에러 | 파일명이 `index.mjs`가 아님 | Handler가 `index.handler`이고 파일명이 `index.mjs`인지 확인 |

---

## 태스크 5: Amazon API Gateway REST API 생성

AWS Lambda 함수를 외부에서 HTTP로 호출할 수 있도록 Amazon API Gateway를 설정합니다.

### API 생성

44. 상단 검색창에 `API Gateway`를 입력하고 선택합니다.
45. 왼쪽 메뉴에서 **APIs**를 클릭합니다.

> [!TIP]
> 왼쪽 메뉴가 보이지 않으면 좌측 상단의 햄버거 버튼(☰)을 클릭하여 메뉴를 펼치세요.

46. [[Create API]]를 클릭합니다.
47. API 타입 선택 화면에서 **REST API** 섹션의 [[Build]]를 클릭합니다.

> [!WARNING]
> "HTTP API"가 아닌 **"REST API"**를 선택하세요.  
> HTTP API는 더 간단하지만, 이 실습에서는 REST API의 리소스/메서드 구조를 학습합니다.

> [!NOTE]
> API 타입 선택 화면에 여러 옵션이 표시됩니다:
>
> - **HTTP API** — 간단한 프록시용 (이 실습에서는 사용하지 않음)
> - **WebSocket API** — 실시간 양방향 통신용 (이 실습에서는 사용하지 않음)
> - **REST API** ← 이것을 선택하세요
> - **REST API (Private)** — VPC 내부 전용 (선택하지 마세요)

48. 다음을 설정합니다:
    - **API details**: New API (기본값)
    - **API name**: `starter-serverless-api`
    - **Description**: 비워둡니다 (선택사항)
    - **API endpoint type**: Regional (기본값)
    - **Security policy**: 기본값 유지
    - **IP address type**: IPv4 (기본값)

> [!TIP]
> **API endpoint type 옵션:**
>
> | 타입               | 설명                                                                 |
> | ------------------ | -------------------------------------------------------------------- |
> | **Regional**       | 현재 리전에 배포. 같은 리전의 클라이언트에 최적화됩니다.             |
> | **Edge-optimized** | CloudFront를 통해 전세계에 배포. 글로벌 사용자가 있을 때 적합합니다. |
> | **Private**        | VPC 내부에서만 접근 가능합니다.                                      |
>
> 이 실습에서는 **Regional**을 사용합니다.

> [!TIP]
> **Security policy**는 API가 허용하는 최소 TLS 버전과 암호화 스위트를 지정하는 설정입니다.  
> 선택하지 않으면 기본 정책(TLS 1.2 이상 허용)이 자동 적용됩니다.  
> `SecurityPolicy_`로 시작하는 강화된 정책은 규제 환경이나 TLS 1.3 전용이 필요할 때 사용합니다.  
> 이 실습에서는 선택하지 않고 비워두면 됩니다.

49. [[Create API]]를 클릭합니다.

### Amazon API Gateway에 태그 추가

50. API 목록에서 `starter-serverless-api`를 클릭하여 상세 페이지로 이동합니다.
51. 왼쪽 메뉴에서 **API settings**를 클릭합니다.
52. **Tags** 섹션에서 [[Manage tags]]를 클릭합니다.
53. 다음 태그를 추가합니다:
    - **Key**: `CreatedBy`, **Value**: `admin-user`
    - **Key**: `Step`, **Value**: `step10`
    - **Key**: `Session`, **Value**: `10-2`
54. [[Save changes]]를 클릭합니다.

### 리소스 생성 (/items)

55. 왼쪽 메뉴에서 **Resources**를 클릭합니다.
56. `/` (루트)를 선택한 상태에서 [[Create resource]]를 클릭합니다.
57. 설정:
    - **Resource name**: `items`
    - **Resource path**: `/items` (자동)
    - ✅ **CORS (Cross Origin Resource Sharing)** 체크

> [!TIP]
> **CORS**를 체크하면 브라우저에서 다른 도메인의 JavaScript가 이 API를 호출할 수 있습니다.  
> 체크하면 OPTIONS 메서드가 자동으로 추가되어 브라우저의 Preflight 요청을 처리합니다.  
> 프론트엔드(React, Vue 등)에서 API를 호출할 계획이라면 반드시 체크하세요.

58. [[Create resource]]를 클릭합니다.

### 하위 리소스 생성 (/items/{id})

59. `/items` 리소스를 선택합니다.
60. [[Create resource]]를 클릭합니다.
61. 설정:
    - **Resource name**: `{id}`
    - **Resource path**: `/items/{id}`
    - ✅ **CORS** 체크
62. [[Create resource]]를 클릭합니다.

### 메서드 생성 (GET /items)

63. `/items` 리소스를 선택합니다.
64. [[Create method]]를 클릭합니다.
65. 설정:
    - **Method type**: GET
    - **Integration type**: Lambda Function
    - ✅ **Lambda proxy integration** (토글 ON)
    - **Response transfer mode**: Buffered (기본값)
    - **Lambda function**: 리전 `ap-northeast-2` 선택 → `starter-dynamodb-api` 입력/선택
    - **Integration timeout**: 29000 (기본값)
    - 나머지 접힌 섹션(Method request settings, URL query string parameters, HTTP request headers, Request body)은 변경하지 않습니다.

> [!TIP]
> **Lambda proxy integration**을 ON으로 하면 API Gateway가 HTTP 요청의 모든 정보(메서드, 경로, 헤더, 본문 등)를 Lambda의 `event` 객체로 그대로 전달합니다.  
> OFF로 하면 매핑 템플릿을 직접 설정해야 하므로, 특별한 이유가 없다면 항상 ON을 유지합니다.

> [!TIP]
> **Response transfer mode:**
>
> - **Buffered** (기본): Lambda 실행이 완료될 때까지 기다린 후 전체 응답을 한 번에 전송합니다.
> - **Stream**: Lambda가 응답을 부분적으로 보내면 즉시 클라이언트에 전달합니다 (대용량 응답, 실시간 스트리밍에 적합).
>
> 이 실습에서는 **Buffered**를 사용합니다.

> [!NOTE]
> "Grant API Gateway permission to invoke your Lambda function" 메시지가 표시됩니다.  
> [[Create method]]를 클릭하면 API Gateway가 자동으로 Lambda 함수의 리소스 기반 정책에 호출 권한을 추가합니다.  
> 별도로 설정할 필요가 없습니다.

66. [[Create method]]를 클릭합니다.

### 메서드 생성 (POST /items)

67. `/items` 리소스를 선택합니다.
68. [[Create method]]를 클릭합니다.
69. 설정 (65번과 동일한 방식):
    - **Method type**: POST
    - **Integration type**: Lambda Function
    - ✅ **Lambda proxy integration** (토글 ON)
    - **Response transfer mode**: Buffered (기본값)
    - **Lambda function**: `ap-northeast-2` → `starter-dynamodb-api`
    - **Integration timeout**: 29000 (기본값)
70. [[Create method]]를 클릭합니다.

### 메서드 생성 (GET /items/{id})

71. `/items/{id}` 리소스를 선택합니다.
72. [[Create method]]를 클릭합니다.
73. 설정 (65번과 동일한 방식):
    - **Method type**: GET
    - **Integration type**: Lambda Function
    - ✅ **Lambda proxy integration** (토글 ON)
    - **Response transfer mode**: Buffered (기본값)
    - **Lambda function**: `ap-northeast-2` → `starter-dynamodb-api`
    - **Integration timeout**: 29000 (기본값)
74. [[Create method]]를 클릭합니다.

### 메서드 생성 (DELETE /items/{id})

75. `/items/{id}` 리소스를 선택합니다.
76. [[Create method]]를 클릭합니다.
77. 설정 (65번과 동일한 방식):
    - **Method type**: DELETE
    - **Integration type**: Lambda Function
    - ✅ **Lambda proxy integration** (토글 ON)
    - **Response transfer mode**: Buffered (기본값)
    - **Lambda function**: `ap-northeast-2` → `starter-dynamodb-api`
    - **Integration timeout**: 29000 (기본값)
78. [[Create method]]를 클릭합니다.

> [!OUTPUT]
> Resources 트리가 다음과 같이 구성됩니다:
>
> ```
> /
> └── /items
>     ├── GET           → starter-dynamodb-api (Lambda Proxy)
>     ├── POST          → starter-dynamodb-api (Lambda Proxy)
>     ├── OPTIONS       → (CORS preflight)
>     └── /{id}
>         ├── GET       → starter-dynamodb-api (Lambda Proxy)
>         ├── DELETE    → starter-dynamodb-api (Lambda Proxy)
>         └── OPTIONS   → (CORS preflight)
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

✅ **태스크 완료** — Amazon API Gateway REST API를 생성하고 Lambda와 연동했습니다.

> [!WARNING]
> API Gateway에서 리소스나 메서드를 변경한 후에는 반드시 **Deploy API**를 실행해야 합니다.  
> 배포하지 않으면 변경사항이 실제 URL에 반영되지 않습니다.  
> 초보자가 가장 많이 하는 실수 중 하나입니다.

---

## 태스크 6: API 배포 + curl 테스트

### API 배포 (prod 스테이지)

79. API Gateway 콘솔에서 `starter-serverless-api`를 선택합니다.
80. [[Deploy API]]를 클릭합니다.
81. 설정:
    - **Stage**: **\*New Stage\***
    - **Stage name**: `prod`

> [!TIP]
> **Stage**는 API의 배포 환경을 구분하는 단위입니다.  
> 예: `prod`(운영), `dev`(개발), `staging`(테스트).  
> Stage 이름이 Invoke URL 경로에 포함됩니다 (예: `/prod/items`).  
> 이 실습에서는 `prod` 하나만 사용합니다.

82. [[Deploy]]를 클릭합니다.

### Invoke URL 확인

83. **Stages** → `prod`를 선택합니다.
84. 상단에 **Invoke URL**이 표시됩니다:

> [!OUTPUT]
>
> ```
> Invoke URL: https://xyz789abc1.execute-api.ap-northeast-2.amazonaws.com/prod
> ```

### curl 테스트

`<Invoke URL>`을 본인의 Invoke URL로 교체하여 실행합니다.

> [!TIP]
> 터미널(또는 CloudShell)을 열고 명령어를 실행합니다.  
> `<Invoke URL>` 부분을 위에서 확인한 본인의 URL로 교체하세요.  
> 예: `https://xyz789abc1.execute-api.ap-northeast-2.amazonaws.com/prod`

> [!TIP]
> **JSON 응답을 보기 좋게 출력하려면:**
>
> ```bash
> # jq 사용 (CloudShell에 기본 설치됨)
> curl <Invoke URL>/items | jq .
>
> # jq가 없으면 python3 사용
> curl <Invoke URL>/items | python3 -m json.tool
> ```
>
> 아래 예시에서는 간결함을 위해 `| jq .`를 생략했지만, 실행 시 붙여서 사용하면 가독성이 좋습니다.

#### POST /items — 아이템 생성

85. 터미널에서 다음 명령어를 실행하여 아이템을 생성합니다:

```bash
curl -X POST \
  <Invoke URL>/items \
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

86. 전체 아이템 목록을 조회합니다:

```bash
curl <Invoke URL>/items
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

87. 특정 아이템을 ID로 조회합니다:

```bash
curl <Invoke URL>/items/item-201
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

88. 아이템을 삭제합니다:

```bash
curl -X DELETE \
  <Invoke URL>/items/item-201
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

89. 방금 삭제한 아이템을 다시 조회하여 404 응답을 확인합니다:

```bash
curl <Invoke URL>/items/item-201
```

> [!OUTPUT]
>
> ```json
> { "message": "Item not found" }
> ```

90. 필수 필드를 누락하여 검증 에러를 확인합니다:

```bash
curl -X POST \
  <Invoke URL>/items \
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

## 태스크 7: Amazon CloudWatch Logs 확인 + 비용 분석

### Amazon CloudWatch Logs 확인

91. 상단 검색창에 `CloudWatch`를 입력하고 선택합니다.
92. 왼쪽 메뉴에서 **Logs** → **Log Management**를 클릭합니다.
93. **Log groups** 탭에서 `/aws/lambda/starter-dynamodb-api` 로그 그룹을 클릭합니다.
94. 최신 **Log stream**을 클릭합니다.

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

> [!TIP]
> 이 실습에서 태스크 6의 curl 테스트 첫 호출은 **Cold Start**입니다.  
> API 배포 후 처음 호출하는 것이므로 `Init Duration`이 로그에 표시됩니다.  
> 이어서 연속으로 호출하면 `Init Duration`이 사라지고 Duration만 표시됩니다. — 이것이 **Warm Start**입니다.  
> 직접 확인해보세요: 같은 curl 명령을 2~3초 간격으로 두 번 실행하면 두 번째 로그에는 `Init Duration`이 없습니다.

### Cold Start vs Warm Start 비교

| 항목            | Cold Start (첫 호출) | Warm Start (연속 호출) |
| --------------- | -------------------- | ---------------------- |
| Init Duration   | 300~500ms            | 없음                   |
| Duration        | 40~100ms             | 5~30ms                 |
| Total 응답 시간 | 400~600ms            | 5~30ms                 |

> [!CONCEPT] Cold Start가 발생하는 시점
>
> - 함수를 처음 호출할 때
> - 코드를 업데이트한 후 첫 호출
> - 약 5~15분 동안 호출이 없은 후 다시 호출할 때
> - 동시 요청이 증가하여 새 실행 환경이 필요할 때
>
> Node.js Lambda의 Cold Start는 보통 300~500ms로, 대부분의 API에서 허용 가능합니다.

### 비용 분석

이 실습에서 사용한 서버리스 리소스의 과금 기준입니다:

| 서비스              | 과금 기준                  | 이 실습 사용량  |
| ------------------- | -------------------------- | --------------- |
| **Lambda**          | 요청 수 + 실행 시간(GB-초) | 수십 요청       |
| **API Gateway**     | API 호출 수                | 수십 호출       |
| **DynamoDB**        | 읽기/쓰기 요청 + 저장 용량 | 수 KB, 수십 R/W |
| **CloudWatch Logs** | 수집량 + 저장량            | 수 KB           |

> [!NOTE]
> 이 실습 수준(수십~수백 건 요청)에서는 비용이 미미합니다.  
> 트래픽이 증가하면 각 서비스별로 종량 과금이 발생하며, 무료 플랜 적용 여부에 따라 금액이 달라집니다.
>
> **각 서비스 요금 페이지:**
>
> - [AWS Lambda 요금](https://aws.amazon.com/lambda/pricing/)
> - [Amazon API Gateway 요금](https://aws.amazon.com/api-gateway/pricing/)
> - [Amazon DynamoDB 요금](https://aws.amazon.com/dynamodb/pricing/)
> - [Amazon CloudWatch 요금](https://aws.amazon.com/cloudwatch/pricing/)

### AWS Lambda 비용 계산 공식 (참고)

```
Lambda 비용 = 요청 수 비용 + 실행 시간 비용

요청 수 비용:
  월 100만 요청 무료, 이후 100만 요청당 $0.20

실행 시간 비용 (x86 기준):
  월 40만 GB-초 무료
  이후 1GB-초당 $0.0000166667

예시: 128MB 메모리, 50ms 실행, 월 10만 요청
  GB-초 = 100,000 × 0.128GB × 0.05초 = 640 GB-초
  → 무료 한도(40만 GB-초) 내이므로 실행 시간 비용: $0
  → 요청 수도 무료 한도(100만) 내이므로 요청 비용: $0
  → 합계: $0

예시: 128MB 메모리, 50ms 실행, 월 500만 요청
  GB-초 = 5,000,000 × 0.128GB × 0.05초 = 32,000 GB-초
  → 무료 한도(40만 GB-초) 내이므로 실행 시간 비용: $0
  → 요청 초과분: 500만 - 100만 = 400만 요청
  → 요청 비용: 4 × $0.20 = $0.80
  → 합계: $0.80
```

✅ **태스크 완료** — Amazon CloudWatch Logs에서 실행 로그를 확인하고 서버리스 비용 구조를 분석했습니다.

---

# 🗑️ 리소스 정리

> [!NOTE]
> 서버리스 리소스는 호출하지 않으면 비용이 거의 발생하지 않습니다.  
> 급하게 삭제할 필요 없이, 학습이 끝난 후 한꺼번에 정리해도 됩니다.
>
> | 리소스           | 미사용 시 비용 | 비고                                |
> | ---------------- | -------------- | ----------------------------------- |
> | Lambda 함수      | 미미           | 호출하지 않으면 요청/실행 비용 없음 |
> | API Gateway      | 미미           | 호출하지 않으면 호출 비용 없음      |
> | DynamoDB (Items) | 미미           | 저장 용량에 따라 소액 발생 가능     |
> | CloudWatch Logs  | $0.03/GB 저장  | 소량이면 무시 가능                  |
> | IAM Role         | 없음           | IAM은 과금 대상이 아님              |
>
> 단, 무료 플랜 종료 후에는 저장된 데이터나 로그 용량에 따라 소액이 발생할 수 있습니다.  
> 불필요한 리소스는 정리하는 것을 권장합니다.

> [!NOTE]
> 삭제 순서 (의존 관계):
>
> API Gateway → Lambda 함수 → DynamoDB 테이블 (선택) → CloudWatch Logs → IAM Role
>
> API Gateway가 Lambda를 참조하므로 먼저 삭제합니다.

---

### 단계 1: Tag Editor로 리소스 확인

먼저 이 실습에서 생성한 리소스를 Tag Editor로 한눈에 확인합니다.

1. 상단 검색창에 `Resource Groups & Tag Editor`를 입력하고 선택합니다.
2. 왼쪽 메뉴에서 **Tag Editor**를 선택합니다.
3. 다음 조건으로 검색합니다:
   - **Regions**: `ap-northeast-2`
   - **Tag key**: `Session`, **Tag value**: `10-2`
4. [[Search resources]]를 클릭합니다.

> [!OUTPUT]
> 이 실습에서 태그를 추가한 리소스(DynamoDB Items 테이블, Lambda 함수)가 표시됩니다.

> [!TIP]
> Tag Editor는 태그가 붙은 리소스만 검색하며, 일부 서비스는 Tag Editor에서 검색되지 않을 수 있습니다.  
> API Gateway REST API는 태그를 추가했더라도 Tag Editor에서 표시되지 않습니다.  
> IAM Role과 CloudWatch Logs는 Lambda 실행 시 자동 생성되므로 태그가 없어 표시되지 않습니다.  
> 아래 단계에서 각 서비스 콘솔에서 직접 삭제합니다.

---

### 단계 2: Amazon API Gateway 삭제

Amazon API Gateway를 먼저 삭제합니다 (Lambda를 참조하고 있으므로).

5. 상단 검색창에 `API Gateway`를 입력하고 선택합니다.
6. 왼쪽 메뉴에서 **APIs**를 클릭합니다.
7. `starter-serverless-api`를 선택합니다.
8. [[Delete]]를 클릭합니다.
9. 확인 입력란에 `confirm`을 입력하고 [[Delete]]를 클릭합니다.

> [!NOTE]
> API가 삭제되면 Invoke URL로 더 이상 접근할 수 없습니다.

---

### 단계 3: AWS Lambda 함수 삭제

10. 상단 검색창에 `Lambda`를 입력하고 선택합니다.
11. 왼쪽 메뉴에서 **Functions**를 클릭합니다.
12. `starter-dynamodb-api` 함수를 선택합니다.
13. **Actions** → [[Delete]]를 클릭합니다.
14. 확인 입력란에 `delete`를 입력하고 [[Delete]]를 클릭합니다.

---

### 단계 4: Amazon DynamoDB 테이블 삭제 (선택)

> [!TIP]
> DynamoDB Items 테이블은 저장 용량이 극소량이므로 유지해도 비용이 미미합니다.  
> 다른 실습에서 사용할 계획이 없다면 삭제합니다.

**삭제하는 경우:**

15. 상단 검색창에 `DynamoDB`를 입력하고 선택합니다.
16. 왼쪽 메뉴에서 **Tables**를 클릭합니다.
17. `Items` 테이블을 선택합니다.
18. [[Delete]]를 클릭합니다.
19. 삭제 대화상자에서 다음을 확인합니다:
    - ✅ **Delete all CloudWatch alarms for Items** (기본 체크, 유지)
    - ☐ **Create an on-demand backup of Items before deletion** (체크 해제 유지)
20. 확인 입력란에 `confirm`을 입력합니다.
21. [[Delete]]를 클릭합니다.

---

### 단계 5: Amazon CloudWatch Logs 삭제

Amazon CloudWatch Logs는 저장 용량에 따라 소액 과금될 수 있으므로 불필요한 로그 그룹은 삭제합니다.

22. 상단 검색창에 `CloudWatch`를 입력하고 선택합니다.
23. 왼쪽 메뉴에서 **Logs** → **Log Management**를 클릭합니다.
24. **Log groups** 탭에서 `/aws/lambda/starter-dynamodb-api` 로그 그룹을 선택합니다.
25. **Actions** → [[Delete log group(s)]]를 클릭합니다.
26. [[Delete]]를 클릭합니다.

---

### 단계 6: IAM Role 삭제 (선택)

AWS Lambda 생성 시 자동으로 만들어진 IAM Role을 삭제합니다.

27. 상단 검색창에 `IAM`을 입력하고 선택합니다.
28. 왼쪽 메뉴에서 **Roles**를 클릭합니다.
29. 검색창에 `starter-dynamodb-api`를 입력합니다.
30. `starter-dynamodb-api-role-`로 시작하는 Role을 선택합니다.
31. [[Delete]]를 클릭합니다.
32. 확인 입력란에 Role 이름을 입력하고 [[Delete]]를 클릭합니다.

---

### 단계 7: 삭제 확인

33. 터미널에서 다음 명령어를 실행하여 모든 리소스가 삭제되었는지 확인합니다:

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

> [!OUTPUT]
> 모든 리소스가 삭제되었다면 위 명령들의 결과가 비어있어야 합니다.

34. Tag Editor에서도 최종 확인합니다:
    - **Resource Groups & Tag Editor** → **Tag Editor**
    - Tag key: `Session`, Value: `10-2`로 검색
    - 검색 결과가 없으면 모든 태그된 리소스가 정리된 것입니다.

✅ **실습 종료**: 모든 리소스가 정리되었습니다.

---
title: 'Amazon DynamoDB 테이블 생성 및 핵심 개념'
week: 10
session: 1
awsServices:
  - Amazon DynamoDB
learningObjectives:
  - DynamoDB의 핵심 개념(테이블, 항목, 속성, 파티션 키, 정렬 키)을 이해할 수 있습니다.
  - DynamoDB 테이블을 생성하고 용량 모드를 선택할 수 있습니다.
  - 콘솔과 CLI로 항목을 생성, 조회, 수정, 삭제할 수 있습니다.
  - RDS(관계형)와 DynamoDB(NoSQL)의 차이를 비교할 수 있습니다.
prerequisites:
  - AWS 계정 생성 완료
estimatedCost: 실습 수준 비용 소량 발생 가능 (설계·인덱스에 따라 상이)
---

이 실습에서는 AWS의 완전관리형 NoSQL 데이터베이스인 Amazon DynamoDB를 학습합니다.  
Amazon RDS(관계형 DB)와의 차이를 이해하고, 테이블을 생성하여 항목(Item)을 CRUD하는
방법을 콘솔과 CLI 양쪽에서 실습합니다.  
정렬 키를 활용한 고급 쿼리 패턴도 다룹니다.

> [!NOTE]
> 이 실습은 독립적으로 진행할 수 있습니다.  
> AWS 계정만 있으면 바로 시작할 수 있습니다. 이 실습 수준(수십~수백 건 요청)에서는 비용이 미미합니다.

### 실습 흐름

```
[RDS vs DynamoDB 비교] → [핵심 개념 학습] → [테이블 생성] → [콘솔 CRUD] → [CLI CRUD] → [정렬 키 활용] → [설계 모범 사례]
```

---

## 태스크 1: Amazon RDS vs Amazon DynamoDB 비교

### 관계형 DB와 NoSQL의 근본적 차이

```
관계형 데이터베이스 (RDS):
┌───────────────────────────────────────────┐
│  테이블: Users                            │
│  ┌────┬──────────┬─────────┬───────────┐  │
│  │ id │ name     │ email   │ age       │  │
│  ├────┼──────────┼─────────┼───────────┤  │
│  │ 1  │ 김철수   │ a@b.com │ 25        │  │
│  │ 2  │ 이영희   │ c@d.com │ 30        │  │
│  └────┴──────────┴─────────┴───────────┘  │
│  → 고정된 스키마, 모든 행이 동일한 컬럼   │
└───────────────────────────────────────────┘

NoSQL 데이터베이스 (DynamoDB):
┌────────────────────────────────────────────┐
│  테이블: Users                             │
│  ┌─────────────────────────────────────┐   │
│  │ { id: "1", name: "김철수",          │   │
│  │   email: "a@b.com", age: 25 }       │   │
│  ├─────────────────────────────────────┤   │
│  │ { id: "2", name: "이영희",          │   │
│  │   phone: "010-1234", hobby: "독서"} │   │
│  └─────────────────────────────────────┘   │
│  → 유연한 스키마, 각 항목이 다른 속성 가능 │
└────────────────────────────────────────────┘
```

### 상세 비교표

| 항목            | RDS (관계형)                   | DynamoDB (NoSQL)                   |
| --------------- | ------------------------------ | ---------------------------------- |
| **데이터 모델** | 테이블, 행, 열 (고정 스키마)   | 테이블, 항목, 속성 (유연한 스키마) |
| **스키마**      | 사전 정의 필수 (CREATE TABLE)  | 키 속성만 정의, 나머지 자유        |
| **쿼리 언어**   | SQL                            | PartiQL 또는 API 호출              |
| **조인(JOIN)**  | 지원 (여러 테이블 결합)        | 미지원 (단일 테이블 설계)          |
| **트랜잭션**    | 완전한 ACID                    | 제한적 트랜잭션 지원               |
| **확장 방식**   | 수직 확장 (인스턴스 크기 증가) | 수평 확장 (자동 파티셔닝)          |
| **성능**        | 데이터 증가 시 느려질 수 있음  | 데이터 크기와 무관하게 일정        |
| **관리**        | 패치, 백업, 복제 설정 필요     | 완전 관리형 (서버리스)             |
| **비용**        | 인스턴스 시간당 과금           | 요청 수 + 저장 용량 과금           |
| **적합한 경우** | 복잡한 관계, 트랜잭션, 리포팅  | 대규모 트래픽, 단순 조회, 서버리스 |

### 언제 무엇을 선택할까?

```
DynamoDB를 선택하는 경우:
├── 단순한 키-값 조회가 대부분
├── 초당 수천~수만 요청 처리 필요
├── 서버리스 아키텍처 (Lambda + API Gateway)
├── 유연한 스키마가 필요 (속성이 자주 변경)
├── 글로벌 분산이 필요 (Global Tables)
└── 비용을 최소화하고 싶을 때 (On-demand)

RDS를 선택하는 경우:
├── 복잡한 JOIN 쿼리가 필요
├── 강력한 트랜잭션 보장 필요 (금융, 결제)
├── 기존 SQL 기반 애플리케이션 마이그레이션
├── 복잡한 리포팅/분석 쿼리
└── 관계형 데이터 모델이 자연스러운 경우
```

> [!CONCEPT] DynamoDB는 "서버리스 데이터베이스"
> DynamoDB는 서버를 프로비저닝하거나 관리할 필요가 없습니다.  
> RDS처럼 인스턴스 타입을 선택하거나, OS 패치를 걱정할 필요가 없습니다.  
> 테이블을 만들면 AWS가 자동으로 데이터를 분산 저장하고, 트래픽에 따라 확장합니다.  
> Lambda + API Gateway + DynamoDB 조합이 대표적인 서버리스 스택입니다.

✅ **태스크 완료** — RDS와 DynamoDB의 차이를 이해하고 적절한 선택 기준을 학습했습니다.

---

## 태스크 2: DynamoDB 핵심 개념

### 테이블, 항목, 속성

```
DynamoDB 구조:
┌───────────────────────────────────────────────────┐
│ 테이블 (Table): Items                             │
│                                                   │
│  ┌─── 항목 (Item) ─────────────────────────────┐  │
│  │ id: "item-001"          ← 속성 (Attribute)  │  │
│  │ name: "노트북"          ← 속성              │  │
│  │ price: 1200000          ← 속성              │  │
│  │ category: "전자제품"    ← 속성              │  │
│  └─────────────────────────────────────────────┘  │
│                                                   │
│  ┌─── 항목 (Item) ─────────────────────────────┐  │
│  │ id: "item-002"                              │  │
│  │ name: "키보드"                              │  │
│  │ price: 150000                               │  │
│  │ color: "black"          ← 다른 항목에 없는  │  │
│  └─────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────┘
```

| 용어                 | RDS 대응    | 설명                       |
| -------------------- | ----------- | -------------------------- |
| **테이블 (Table)**   | 테이블      | 데이터를 저장하는 컬렉션   |
| **항목 (Item)**      | 행 (Row)    | 하나의 데이터 레코드       |
| **속성 (Attribute)** | 열 (Column) | 항목 내의 개별 데이터 필드 |

### 파티션 키(PK)와 정렬 키(SK)

DynamoDB 테이블의 Primary Key는 두 가지 유형이 있습니다:

```
유형 1: 단순 기본 키 (Partition Key만)
┌──────────────────────────────────┐
│ PK: id                           │
│ ┌──────────┬───────────────────┐ │
│ │ id       │ 기타 속성         │ │
│ ├──────────┼───────────────────┤ │
│ │ "item-1" │ name: "노트북"    │ │
│ │ "item-2" │ name: "키보드"    │ │
│ │ "item-3" │ name: "마우스"    │ │
│ └──────────┴───────────────────┘ │
│ → PK 값이 고유해야 함            │
└──────────────────────────────────┘

유형 2: 복합 기본 키 (Partition Key + Sort Key)
┌──────────────────────────────────────────────┐
│ PK: userId, SK: createdAt                    │
│ ┌──────────┬────────────┬──────────────────┐ │
│ │ userId   │ createdAt  │ 기타 속성        │ │
│ ├──────────┼────────────┼──────────────────┤ │
│ │ "user-1" │ 2025-01-01 │ total: 50000     │ │
│ │ "user-1" │ 2025-01-15 │ total: 30000     │ │
│ │ "user-2" │ 2025-01-03 │ total: 80000     │ │
│ └──────────┴────────────┴──────────────────┘ │
│ → PK+SK 조합이 고유해야 함                   │
│ → 같은 PK 내에서 SK로 정렬/범위 조회 가능    │
└──────────────────────────────────────────────┘
```

> [!CONCEPT] 파티션 키의 역할
> 파티션 키는 DynamoDB가 데이터를 물리적으로 분산 저장하는 기준입니다.  
> 같은 파티션 키를 가진 항목들은 같은 파티션에 저장됩니다.
>
> - **파티션 키(PK)**: 데이터가 어느 파티션에 저장될지 결정
> - **정렬 키(SK)**: 같은 파티션 내에서 데이터의 정렬 순서 결정
>
> 좋은 파티션 키: 값이 고르게 분산되는 속성 (userId, deviceId 등)  
> 나쁜 파티션 키: 값이 편중되는 속성 (status: "active" → 대부분 여기에 몰림)

### 용량 모드

| 모드            | 설명                          | 적합한 경우                   |
| --------------- | ----------------------------- | ----------------------------- |
| **On-demand**   | 요청한 만큼만 과금, 자동 확장 | 트래픽 예측 불가, 개발/테스트 |
| **Provisioned** | 초당 읽기/쓰기 용량 사전 설정 | 트래픽 예측 가능, 비용 최적화 |

> [!TIP]
> 학습 및 개발 환경에서는 **On-demand** 모드를 선택하세요.  
> 사용한 만큼만 과금되며, 트래픽이 없으면 $0입니다.  
> 이 실습 수준(수십~수백 건)에서는 비용이 미미합니다.
>
> **주의:** On-demand 모드는 요청에 대한 무료 티어가 적용되지 않습니다 (저장 25GB만 Always Free).  
> Provisioned 모드(25 RCU + 25 WCU)를 사용하면 월 약 2억 요청까지 무료이지만, 학습 목적에서는 On-demand가 관리가 편합니다.  
> 자세한 요금은 [Amazon DynamoDB 요금 페이지](https://aws.amazon.com/dynamodb/pricing/)를 확인하세요.

✅ **태스크 완료** — DynamoDB의 핵심 개념(테이블, 항목, 속성, PK, SK, 용량 모드)을 이해했습니다.

---

## 태스크 3: DynamoDB 테이블 생성

AWS 콘솔에서 DynamoDB 테이블을 생성합니다.

### 테이블 생성 단계

1. AWS Management Console에 로그인합니다.
2. 리전을 **Asia Pacific (Seoul) ap-northeast-2**로 설정합니다.

    <img src="/images/common/region-check.png" alt="리전 확인" class="guide-img-sm" />

> [!TIP]
> 일부 AWS 서비스(IAM, CloudFront, Route 53 등)는 **글로벌 서비스**이므로 리전 선택 드롭다운이 비활성화되거나 "Global"로 표시됩니다.  
> 이 실습에서 사용하는 서비스는 리전 기반이므로 반드시 올바른 리전이 선택되어 있는지 확인하세요.

3. 상단 검색창에 `DynamoDB`를 입력하고 선택합니다.
4. 왼쪽 메뉴에서 **Tables**를 클릭합니다.
5. [[Create table]]을 클릭합니다.
6. 다음을 설정합니다:
   - **Table name**: `Items`
   - **Partition key**: `id` (타입: **String**)
   - **Sort key**: 비워둡니다 (단순 기본 키 사용)

7. **Table settings** 섹션에서 **Customize settings**를 선택합니다.

> [!NOTE]
> **Default settings**를 선택하면 아래 세부 항목들이 숨겨지고 기본값으로 생성됩니다.  
> 학습 목적으로 각 설정의 의미를 확인하기 위해 **Customize settings**를 선택합니다.

8. **Table class** 섹션:
    - **DynamoDB Standard**를 선택합니다 (기본값).

> [!TIP]
> **Table class 옵션:**
>
> | 클래스 | 설명 | 적합 사례 |
> | ------ | ---- | --------- |
> | **DynamoDB Standard** | 범용. 읽기/쓰기 비용 중심 | 자주 접근하는 데이터 (대부분의 경우) |
> | **DynamoDB Standard-IA** | 저장 비용 저렴, 읽기/쓰기 비용 높음 | 드물게 접근하는 데이터 (로그, 아카이브) |
>
> 이 실습에서는 **Standard**를 사용합니다.

9. **Read/write capacity settings** 섹션:
    - **Capacity mode**: **On-demand**를 선택합니다.

> [!NOTE]
> On-demand를 선택하면 아래에 **Maximum table throughput** (선택사항)과 **Warm throughput** 섹션이 표시됩니다.  
> 둘 다 기본값을 유지하세요:
>
> - **Maximum table throughput**: 설정하지 않음 (기본 DynamoDB 테이블 쿼터 적용)
> - **Warm throughput**: **Keep default values** 유지 (Read 12,000 / Write 4,000)
>
> **Capacity calculator** 섹션도 표시되지만, 이것은 Provisioned 모드 기준 비용 시뮬레이터입니다.  
> On-demand를 선택했으므로 여기에 표시되는 Estimated cost(예: US$0.63/month)는 무시하세요. 설정을 변경할 필요 없습니다.

10. **Secondary indexes** 섹션:
    - 이 실습에서는 인덱스를 추가하지 않습니다. 기본값(No indexes)을 유지합니다.

> [!TIP]
> GSI(Global Secondary Index)를 추가하면 파티션 키가 아닌 속성으로도 쿼리할 수 있습니다.  
> 단, 인덱스마다 별도 용량·비용이 발생하므로 필요할 때만 추가하세요.

11. **Encryption at rest** 섹션:
    - **AWS owned key**를 선택합니다 (기본값, 추가 비용 없음).

> [!NOTE]
> 암호화 옵션:
>
> | 옵션 | 비용 | 설명 |
> | ---- | ---- | ---- |
> | **AWS owned key** (기본) | 무료 | DynamoDB가 관리하는 키로 자동 암호화 |
> | AWS managed key | KMS 비용 발생 | 사용자 계정의 KMS 키 사용 |
> | Customer managed key | KMS 비용 발생 | 직접 생성·관리하는 KMS 키 |
>
> 학습 환경에서는 **AWS owned key**를 유지합니다.

12. **Deletion protection** 섹션:
    - 기본값(꺼짐)을 유지합니다.

> [!TIP]
> Deletion protection을 켜면 실수로 테이블을 삭제하는 것을 방지합니다.  
> 프로덕션 환경에서는 권장하지만, 학습 환경에서는 삭제 편의를 위해 꺼둡니다.

13. **Resource-based policy** 섹션:
    - 기본값(비어있음)을 유지합니다. 정책을 추가하지 않습니다.

14. **Tags** 섹션에서 [[Add new tag]]를 클릭합니다:
    - **Key**: `CreatedBy`, **Value**: `admin-user`
    - **Key**: `Step`, **Value**: `step10`
    - **Key**: `Session`, **Value**: `10-1`

15. [[Create table]] 버튼을 클릭합니다.

> [!OUTPUT]
> 테이블 상태가 "Creating"에서 "Active"로 변경됩니다 (약 10~30초 소요).
>
> ```
> Table name: Items
> Status: Active
> Partition key: id (String)
> Sort key: -
> Capacity mode: On-demand
> ```

> [!WARNING]
> 테이블 이름은 대소문자를 구분합니다. `Items`와 `items`는 다른 테이블입니다.  
> 이후 실습(Step 10-2)에서 이 테이블을 사용하므로 정확히 `Items`로 생성하세요.  

> [!NOTE]
> 초보자 실수 주의: Partition key 타입을 **String**으로 설정하세요.  
> Number로 설정하면 이후 실습의 Lambda 코드에서 `{"S": "item-001"}` 형식이 동작하지 않습니다.  
> 타입은 테이블 생성 후 변경할 수 없으므로 처음에 정확히 설정해야 합니다.

### 테이블 상세 정보 확인

16. 생성된 `Items` 테이블을 클릭합니다.
17. **Settings** 탭의 **General information** 섹션에서 다음을 확인합니다:

| 항목                     | 값                                                       |
| ------------------------ | -------------------------------------------------------- |
| Partition key            | id (S)                                                   |
| Sort key                 | -                                                        |
| Capacity mode            | On-demand                                                |
| Table status             | Active                                                   |
| Item count               | 0                                                        |
| Table size               | 0 bytes                                                  |
| Point-in-time recovery   | Off                                                      |
| Deletion protection      | Off                                                      |
| Resource-based policy    | Not active                                               |
| Amazon Resource Name     | arn:aws:dynamodb:ap-northeast-2:xxxxxxxxxxxx:table/Items  |

> [!NOTE]
> 테이블 상세 페이지에서는 **Settings**, **Indexes**, **Monitor**, **Global tables**, **Backups** 등 다양한 탭이 표시됩니다.  
> 아래로 스크롤하면 **Read/write capacity** (On-demand, Maximum read/write request units), **Auto scaling activities**, **Warm throughput** (Read 12,000 / Write 4,000) 등 추가 정보도 확인할 수 있습니다.
>
> 이 실습에서는 이 설정들을 변경할 필요 없습니다. 기본값 그대로 사용합니다.

✅ **태스크 완료** — DynamoDB `Items` 테이블을 On-demand 모드로 생성했습니다.

> [!TIP]
> **Amazon DynamoDB 비용 안내:**
>
> - 이 실습에서 생성하는 테이블과 데이터 수준에서는 비용이 거의 발생하지 않습니다 ($0.01 미만 예상). 
> - 단, 인덱스(GSI) 추가, 대량 데이터 저장, 높은 트래픽 등 설계에 따라 비용이 달라질 수 있습니다.
> - On-demand 모드는 요청당 과금, Provisioned 모드는 설정한 용량 기준 과금입니다.
> - 정확한 요금은 [Amazon DynamoDB 요금 페이지](https://aws.amazon.com/dynamodb/pricing/)를 확인하세요.

> [!TROUBLESHOOTING]
> | 증상 | 원인 | 해결 방법 |
> |------|------|-----------|
> | 테이블 생성 버튼 비활성화 | Table name 미입력 또는 PK 미설정 | 필수 항목 모두 입력 확인 |
> | 테이블이 "Creating" 상태에서 안 바뀜 | 정상 (최대 1분 소요) | 페이지 새로고침 후 재확인 |
> | "Table already exists" 에러 | 동일 이름 테이블 존재 | 기존 테이블 삭제 후 재생성 또는 다른 이름 사용 |

---

## 태스크 4: 항목 CRUD — 콘솔

콘솔에서 직접 항목을 생성, 조회, 수정, 삭제합니다.

### 항목 생성 (Create)

18. `Items` 테이블 상세 페이지에서 **Explore table items**를 클릭합니다.
19. [[Create item]]을 클릭합니다.
20. **JSON view**를 활성화합니다.
21. 다음 JSON을 입력합니다:

```json
{
  "id": {
    "S": "item-001"
  },
  "name": {
    "S": "노트북"
  },
  "price": {
    "N": "1200000"
  },
  "category": {
    "S": "전자제품"
  },
  "inStock": {
    "BOOL": true
  }
}
```

22. [[Create item]]을 클릭합니다.

> [!CONCEPT] DynamoDB 데이터 타입
>
> | 타입 코드 | 의미            | 예시                            |
> | --------- | --------------- | ------------------------------- |
> | S         | String (문자열) | `"S": "hello"`                  |
> | N         | Number (숫자)   | `"N": "42"` (문자열로 표현)     |
> | BOOL      | Boolean         | `"BOOL": true`                  |
> | L         | List (배열)     | `"L": [{"S": "a"}, {"N": "1"}]` |
> | M         | Map (객체)      | `"M": {"key": {"S": "value"}}`  |
> | NULL      | Null            | `"NULL": true`                  |
>
> 주의: 숫자(N)도 JSON에서는 문자열로 감싸서 전달합니다.

23. 같은 방법으로 추가 항목을 생성합니다:

```json
{
  "id": { "S": "item-002" },
  "name": { "S": "키보드" },
  "price": { "N": "150000" },
  "category": { "S": "전자제품" },
  "color": { "S": "black" }
}
```

```json
{
  "id": { "S": "item-003" },
  "name": { "S": "프로그래밍 책" },
  "price": { "N": "35000" },
  "category": { "S": "도서" },
  "author": { "S": "홍길동" }
}
```

> [!NOTE]
> 각 항목이 서로 다른 속성을 가질 수 있습니다.  
> item-001에는 `inStock`, item-002에는 `color`, item-003에는 `author`가 있습니다.  
> 이것이 NoSQL의 유연한 스키마입니다.

### 항목 조회 (Scan)

24. **Explore table items** 페이지에서 [[Run]]을 클릭합니다 (기본 Scan).
25. 3개의 항목이 표시됩니다.

> [!OUTPUT]
> Items returned: 3
>
> | id | name | price | category |
> | --- | --- | --- | --- |
> | item-001 | 노트북 | 1200000 | 전자제품 |
> | item-002 | 키보드 | 150000 | 전자제품 |
> | item-003 | 프로그래밍 책 | 35000 | 도서 |

### 특정 항목 조회 (Query)

26. **Scan or query items** 섹션에서 **Query**를 선택합니다.
27. **Partition key (id)**: `item-001` 입력
28. [[Run]]을 클릭합니다.

> [!OUTPUT]
> id가 "item-001"인 항목 1개만 반환됩니다.

### 항목 수정 (Update)

29. 항목 목록에서 `item-001`을 클릭합니다.
30. `price` 속성의 값을 `1100000`으로 변경합니다.
31. [[Save and close]]를 클릭합니다.

> [!TIP]
> **항목 수정 방법:**
>
> **방법 1: Edit item 페이지에서 수정**
> - 항목의 `id` 링크를 클릭하거나, 체크박스 선택 후 **Actions** → [[Edit item]]
> - Edit item 페이지에서 **Form** 뷰(속성별 개별 수정) 또는 **JSON view**(전체 JSON 편집)로 수정
> - 수정 후 [[Save and close]] 클릭
>
> **방법 2: 목록에서 인라인 수정 (연필 아이콘)**
> - 항목 목록에서 수정할 속성 값 옆의 ✏️ (연필) 아이콘을 클릭
> - "Edit Number" 또는 "Edit String" 팝업이 나타남
> - 값을 수정하고 [[Save]] 클릭 (페이지 이동 없이 즉시 수정)
>
> 간단한 값 1개만 바꿀 때는 연필 아이콘, 여러 속성을 동시에 수정하거나 속성을 추가/삭제할 때는 Edit item 페이지를 사용하세요.

### 항목 삭제 (Delete)

32. 항목 목록에서 `item-003`을 체크박스로 선택합니다.
33. **Actions** → [[Delete items]]를 클릭합니다.
34. 확인 대화상자에서 [[Delete]]를 클릭합니다.

> [!OUTPUT]
> "1 item(s) deleted" 메시지가 표시됩니다.  
> 항목 목록에 2개만 남습니다.

✅ **태스크 완료** — 콘솔에서 DynamoDB 항목의 CRUD 작업을 수행했습니다.

---

## 태스크 5: 항목 CRUD — AWS CLI

AWS CLI를 사용하여 프로그래밍 방식으로 Amazon DynamoDB를 조작합니다.

> [!NOTE]
> 로컬 터미널에서 CLI를 사용하려면 `aws configure`로 Access Key가 설정되어 있어야 합니다.  
> 또는 AWS CloudShell을 사용하면 별도 설정 없이 현재 로그인한 사용자 권한으로 바로 실행됩니다.

### put-item — 항목 생성

35. 터미널(또는 CloudShell)을 열고 다음 명령어를 실행합니다:

```bash
aws dynamodb put-item \
  --table-name Items \
  --item '{
    "id": {"S": "item-004"},
    "name": {"S": "모니터"},
    "price": {"N": "350000"},
    "category": {"S": "전자제품"},
    "size": {"S": "27inch"}
  }' \
  --region ap-northeast-2
```

> [!OUTPUT]
> 성공 시 출력이 없습니다 (HTTP 200 반환).  
> `--return-values ALL_OLD`를 추가하면 이전 값을 반환합니다.

### get-item — 단건 조회

36. 방금 생성한 항목을 조회합니다:

```bash
aws dynamodb get-item \
  --table-name Items \
  --key '{"id": {"S": "item-004"}}' \
  --region ap-northeast-2
```

> [!OUTPUT]
>
> ```json
> {
>   "Item": {
>     "id": { "S": "item-004" },
>     "name": { "S": "모니터" },
>     "price": { "N": "350000" },
>     "category": { "S": "전자제품" },
>     "size": { "S": "27inch" }
>   }
> }
> ```

### scan — 전체 조회

37. 테이블의 모든 항목을 조회합니다:

```bash
aws dynamodb scan \
  --table-name Items \
  --region ap-northeast-2
```

> [!OUTPUT]
>
> ```json
> {
>   "Items": [
>     { "id": {"S": "item-001"}, "name": {"S": "노트북"}, ... },
>     { "id": {"S": "item-002"}, "name": {"S": "키보드"}, ... },
>     { "id": {"S": "item-004"}, "name": {"S": "모니터"}, ... }
>   ],
>   "Count": 3,
>   "ScannedCount": 3
> }
> ```

> [!WARNING]
> `scan`은 테이블의 모든 항목을 읽습니다. 데이터가 많으면 비용과 시간이 많이 소요됩니다.  
> 프로덕션에서는 가능한 `query`를 사용하고, `scan`은 피하세요.

> [!TIP]
> CLI 출력이 길어서 `(END)`로 멈추거나 `:`가 표시되면 페이저(less)가 활성화된 것입니다.  
> - **스페이스바**: 다음 페이지로 이동
> - **q**: 페이저 종료 (터미널로 복귀)
>
> 페이저를 비활성화하려면 명령어 실행 전에 다음을 설정하세요:
> ```bash
> export AWS_PAGER=""
> ```

### query — 조건 조회

38. 특정 PK 값으로 항목을 조회합니다:

```bash
aws dynamodb query \
  --table-name Items \
  --key-condition-expression "id = :id" \
  --expression-attribute-values '{":id": {"S": "item-001"}}' \
  --region ap-northeast-2
```

> [!OUTPUT]
>
> ```json
> {
>   "Items": [
>     {
>       "id": { "S": "item-001" },
>       "name": { "S": "노트북" },
>       "price": { "N": "1100000" },
>       "category": { "S": "전자제품" },
>       "inStock": { "BOOL": true }
>     }
>   ],
>   "Count": 1
> }
> ```

### update-item — 항목 수정

39. `item-004`의 이름과 가격을 수정합니다:

```bash
aws dynamodb update-item \
  --table-name Items \
  --key '{"id": {"S": "item-004"}}' \
  --update-expression "SET price = :newPrice, #n = :newName" \
  --expression-attribute-names '{"#n": "name"}' \
  --expression-attribute-values '{
    ":newPrice": {"N": "320000"},
    ":newName": {"S": "27인치 모니터"}
  }' \
  --return-values ALL_NEW \
  --region ap-northeast-2
```

> [!OUTPUT]
>
> ```json
> {
>   "Attributes": {
>     "id": { "S": "item-004" },
>     "name": { "S": "27인치 모니터" },
>     "price": { "N": "320000" },
>     "category": { "S": "전자제품" },
>     "size": { "S": "27inch" }
>   }
> }
> ```

> [!NOTE]
> `name`은 DynamoDB의 예약어이므로 `#n`과 같은 Expression Attribute Names를 사용해야 합니다.  
> 예약어 목록: status, name, year, date, time, type 등

### delete-item — 항목 삭제

40. `item-004` 항목을 삭제합니다:

```bash
aws dynamodb delete-item \
  --table-name Items \
  --key '{"id": {"S": "item-004"}}' \
  --return-values ALL_OLD \
  --region ap-northeast-2
```

> [!OUTPUT]
>
> ```json
> {
>   "Attributes": {
>     "id": { "S": "item-004" },
>     "name": { "S": "27인치 모니터" },
>     "price": { "N": "320000" },
>     "category": { "S": "전자제품" },
>     "size": { "S": "27inch" }
>   }
> }
> ```

41. 삭제된 항목이 조회되지 않는지 확인합니다:

```bash
aws dynamodb get-item \
  --table-name Items \
  --key '{"id": {"S": "item-004"}}' \
  --region ap-northeast-2
```

> [!OUTPUT]
>
> ```json
> {}
> ```
>
> 빈 객체(`{}`)가 반환되면 해당 항목이 정상적으로 삭제된 것입니다.

✅ **태스크 완료** — AWS CLI로 Amazon DynamoDB 항목의 CRUD 작업을 수행했습니다.

> [!TROUBLESHOOTING]
> | 증상 | 원인 | 해결 방법 |
> |------|------|-----------|
> | `ResourceNotFoundException` | 테이블 이름 오타 또는 리전 불일치 | `--table-name`과 `--region` 확인 |
> | `ValidationException: The provided key element does not match the schema` | Key 형식 오류 (타입 불일치) | PK 타입이 String이면 `{"S": "값"}` 사용 |
> | `SerializationException` | JSON 형식 오류 (따옴표, 쉼표) | JSON 유효성 검사 후 재시도 |
> | `ConditionalCheckFailedException` | 조건부 쓰기 실패 | 조건식 확인 또는 조건 제거 |
> | `#n` 없이 `name` 사용 시 에러 | `name`은 DynamoDB 예약어 | `--expression-attribute-names '{"#n": "name"}'` 추가 |

---

## 태스크 6: 정렬 키(Sort Key) 활용

정렬 키를 사용하면 같은 파티션 키 내에서 범위 조회와 정렬이 가능합니다.  
주문(Orders) 테이블을 만들어 실습합니다.

### Orders 테이블 생성

42. Amazon DynamoDB 콘솔 왼쪽 메뉴에서 **Tables**를 클릭합니다.
43. [[Create table]]을 클릭합니다.
44. 다음을 설정합니다:
    - **Table name**: `Orders`
    - **Partition key**: `userId` (타입: **String**)
    - **Sort key**: `createdAt` (타입: **String**)

45. **Table settings**: **Default settings**를 선택합니다.

> [!NOTE]
> Default settings를 선택하면 아래 기본값이 자동 적용됩니다:
>
> | 설정 | 기본값 |
> | ---- | ------ |
> | Table class | DynamoDB Standard |
> | Capacity mode | On-demand |
> | Encryption | AWS owned key |
> | Deletion protection | Off |
>
> 태스크 3에서 각 옵션의 의미를 이미 학습했으므로, 여기서는 기본값으로 빠르게 생성합니다.

46. **Tags** 섹션에서 [[Add new tag]]를 클릭하여 태그를 추가합니다:
    - `CreatedBy` = `admin-user`
    - `Step` = `step10`
    - `Session` = `10-1`
47. [[Create table]] 버튼을 클릭합니다.

> [!OUTPUT]
>
> ```
> Table name: Orders
> Status: Active
> Partition key: userId (String)
> Sort key: createdAt (String)
> Capacity mode: On-demand
> ```

### 테스트 데이터 입력

48. 터미널(또는 CloudShell)에서 다음 명령어를 순서대로 실행하여 테스트 데이터를 입력합니다:

```bash
# user-1의 주문 3건
aws dynamodb put-item --table-name Orders --item '{
  "userId": {"S": "user-1"},
  "createdAt": {"S": "2025-01-10T09:00:00Z"},
  "orderId": {"S": "order-001"},
  "total": {"N": "50000"},
  "status": {"S": "delivered"}
}' --region ap-northeast-2

aws dynamodb put-item --table-name Orders --item '{
  "userId": {"S": "user-1"},
  "createdAt": {"S": "2025-01-15T14:30:00Z"},
  "orderId": {"S": "order-002"},
  "total": {"N": "30000"},
  "status": {"S": "shipped"}
}' --region ap-northeast-2

aws dynamodb put-item --table-name Orders --item '{
  "userId": {"S": "user-1"},
  "createdAt": {"S": "2025-01-20T11:00:00Z"},
  "orderId": {"S": "order-003"},
  "total": {"N": "85000"},
  "status": {"S": "pending"}
}' --region ap-northeast-2

# user-2의 주문 2건
aws dynamodb put-item --table-name Orders --item '{
  "userId": {"S": "user-2"},
  "createdAt": {"S": "2025-01-12T16:00:00Z"},
  "orderId": {"S": "order-004"},
  "total": {"N": "120000"},
  "status": {"S": "delivered"}
}' --region ap-northeast-2

aws dynamodb put-item --table-name Orders --item '{
  "userId": {"S": "user-2"},
  "createdAt": {"S": "2025-01-18T10:00:00Z"},
  "orderId": {"S": "order-005"},
  "total": {"N": "45000"},
  "status": {"S": "shipped"}
}' --region ap-northeast-2
```

> [!NOTE]
> 각 명령어를 한 줄씩 붙여넣고 실행합니다. 성공 시 출력이 없습니다.  
> 5건 모두 실행하세요 (user-1: 3건, user-2: 2건).

### Query — 특정 사용자의 전체 주문 조회

49. user-1의 모든 주문을 조회합니다:

```bash
aws dynamodb query \
  --table-name Orders \
  --key-condition-expression "userId = :uid" \
  --expression-attribute-values '{":uid": {"S": "user-1"}}' \
  --region ap-northeast-2
```

> [!OUTPUT]
>
> ```json
> {
>   "Items": [
>     { "userId": {"S": "user-1"}, "createdAt": {"S": "2025-01-10T09:00:00Z"}, "total": {"N": "50000"}, ... },
>     { "userId": {"S": "user-1"}, "createdAt": {"S": "2025-01-15T14:30:00Z"}, "total": {"N": "30000"}, ... },
>     { "userId": {"S": "user-1"}, "createdAt": {"S": "2025-01-20T11:00:00Z"}, "total": {"N": "85000"}, ... }
>   ],
>   "Count": 3
> }
> ```
>
> 정렬 키(createdAt) 기준으로 자동 오름차순 정렬됩니다.

### Query — 특정 기간의 주문만 조회

50. user-1의 1월 14일~21일 사이 주문만 조회합니다:

```bash
aws dynamodb query \
  --table-name Orders \
  --key-condition-expression "userId = :uid AND createdAt BETWEEN :start AND :end" \
  --expression-attribute-values '{
    ":uid": {"S": "user-1"},
    ":start": {"S": "2025-01-14T00:00:00Z"},
    ":end": {"S": "2025-01-21T00:00:00Z"}
  }' \
  --region ap-northeast-2
```

> [!OUTPUT]
>
> ```json
> {
>   "Items": [
>     { "userId": {"S": "user-1"}, "createdAt": {"S": "2025-01-15T14:30:00Z"}, ... },
>     { "userId": {"S": "user-1"}, "createdAt": {"S": "2025-01-20T11:00:00Z"}, ... }
>   ],
>   "Count": 2
> }
> ```

### Query — 최신 주문부터 조회 (역순)

51. user-1의 최신 주문 2건을 역순으로 조회합니다:

```bash
aws dynamodb query \
  --table-name Orders \
  --key-condition-expression "userId = :uid" \
  --expression-attribute-values '{":uid": {"S": "user-1"}}' \
  --no-scan-index-forward \
  --max-items 2 \
  --region ap-northeast-2
```

> [!OUTPUT]
>
> ```json
> {
>   "Items": [
>     { "userId": {"S": "user-1"}, "createdAt": {"S": "2025-01-20T11:00:00Z"}, ... },
>     { "userId": {"S": "user-1"}, "createdAt": {"S": "2025-01-15T14:30:00Z"}, ... }
>   ],
>   "Count": 2
> }
> ```
>
> `--no-scan-index-forward`로 내림차순(최신순) 정렬합니다.
> `--max-items 2`로 최대 2개만 반환합니다.

> [!CONCEPT] 정렬 키로 가능한 조건 연산자
>
> | 연산자        | 예시                       | 설명        |
> | ------------- | -------------------------- | ----------- |
> | `=`           | `SK = :val`                | 정확히 일치 |
> | `<`           | `SK < :val`                | 미만        |
> | `<=`          | `SK <= :val`               | 이하        |
> | `>`           | `SK > :val`                | 초과        |
> | `>=`          | `SK >= :val`               | 이상        |
> | `BETWEEN`     | `SK BETWEEN :a AND :b`     | 범위        |
> | `begins_with` | `begins_with(SK, :prefix)` | 접두사 일치 |
>
> 이 연산자들은 정렬 키에만 사용할 수 있습니다.  
> 파티션 키는 항상 `=` 조건만 가능합니다.

✅ **태스크 완료** — 정렬 키를 활용한 범위 조회, 정렬, 제한 쿼리를 수행했습니다.

> [!TROUBLESHOOTING]
> | 증상 | 원인 | 해결 방법 |
> |------|------|-----------|
> | Query에서 결과 0건 | userId 값 오타 | 대소문자 및 정확한 값 확인 (`user-1` vs `User-1`) |
> | BETWEEN 쿼리 결과 없음 | ISO 8601 형식 불일치 | 날짜 형식이 `2025-01-14T00:00:00Z`인지 확인 |
> | `ValidationException` | SK 조건에서 PK 없이 사용 | key-condition-expression에 PK 조건이 반드시 포함되어야 함 |
> | `--scan-index-forward` 무시됨 | Query가 아닌 Scan 사용 | Scan에서는 정렬이 불가, Query로 변경 |

---

## 태스크 7: DynamoDB 설계 모범 사례

### 1. 접근 패턴(Access Pattern)을 먼저 정의하라

RDS에서는 데이터 구조를 먼저 설계하고 쿼리를 나중에 작성합니다.  
DynamoDB에서는 **어떤 쿼리가 필요한지 먼저 정의**하고, 그에 맞게 테이블을 설계합니다.

```
❌ 잘못된 접근:
"Users 테이블을 만들고... 나중에 필요한 쿼리를 작성하자"

✅ 올바른 접근:
"이 서비스에서 필요한 쿼리는..."
1. 사용자 ID로 프로필 조회
2. 사용자의 최근 주문 10개 조회
3. 특정 날짜 범위의 주문 조회
4. 주문 ID로 주문 상세 조회
"→ 이 패턴에 맞는 키 설계를 하자"
```

### 2. 단일 테이블 설계 (Single Table Design)

여러 엔티티를 하나의 테이블에 저장하는 패턴입니다:

```
테이블: ServiceData
┌──────────────┬──────────────────┬──────────────────────┐
│ PK           │ SK               │ 기타 속성             │
├──────────────┼──────────────────┼──────────────────────┤
│ USER#user-1  │ PROFILE          │ name, email, ...     │
│ USER#user-1  │ ORDER#2025-01-10 │ total, status, ...   │
│ USER#user-1  │ ORDER#2025-01-15 │ total, status, ...   │
│ USER#user-2  │ PROFILE          │ name, email, ...     │
│ USER#user-2  │ ORDER#2025-01-12 │ total, status, ...   │
│ PRODUCT#p-1  │ INFO             │ name, price, ...     │
│ PRODUCT#p-1  │ REVIEW#2025-01   │ rating, comment, ... │
└──────────────┴──────────────────┴──────────────────────┘
```

> [!TIP]
> 단일 테이블 설계는 고급 패턴입니다.  
> 처음에는 엔티티별로 테이블을 분리하는 것이 이해하기 쉽습니다.  
> 서비스가 성장하면 단일 테이블 설계를 고려하세요.

### 3. Hot Partition 방지

```
❌ 나쁜 파티션 키 설계:
PK: status ("active", "inactive")
→ 대부분의 사용자가 "active" → 하나의 파티션에 트래픽 집중

❌ 나쁜 파티션 키 설계:
PK: date ("2025-01-15")
→ 오늘 날짜에 모든 쓰기가 집중

✅ 좋은 파티션 키 설계:
PK: userId (고유한 사용자 ID)
→ 트래픽이 사용자별로 고르게 분산

✅ 좋은 파티션 키 설계:
PK: deviceId (고유한 디바이스 ID)
→ IoT 데이터가 디바이스별로 분산
```

### 4. 설계 체크리스트

| 항목                                   | 확인 |
| -------------------------------------- | ---- |
| 접근 패턴을 모두 나열했는가?           | ☐    |
| 파티션 키가 고르게 분산되는가?         | ☐    |
| 정렬 키로 필요한 범위 조회가 가능한가? | ☐    |
| Scan 없이 모든 쿼리가 가능한가?        | ☐    |
| 읽기/쓰기 비율을 고려했는가?           | ☐    |

> [!WARNING]
> DynamoDB는 테이블 생성 후 파티션 키와 정렬 키를 변경할 수 없습니다.  
> 키 설계를 변경하려면 새 테이블을 만들고 데이터를 마이그레이션해야 합니다.  
> 따라서 설계 단계에서 접근 패턴을 충분히 분석하는 것이 중요합니다.

✅ **태스크 완료** — DynamoDB 설계 모범 사례(접근 패턴 우선, 단일 테이블, Hot Partition 방지)를 학습했습니다.

---

## 마무리

다음을 성공적으로 수행했습니다:

- Amazon RDS(관계형)와 Amazon DynamoDB(NoSQL)의 차이를 이해하고 적절한 선택 기준을 학습했습니다.
- Amazon DynamoDB의 핵심 개념(테이블, 항목, 속성, 파티션 키, 정렬 키, 용량 모드)을 이해했습니다.
- AWS 콘솔에서 Amazon DynamoDB 테이블(Items, Orders)을 생성했습니다.
- 콘솔과 AWS CLI로 항목의 CRUD 작업을 수행했습니다.
- 정렬 키를 활용한 범위 조회, 정렬, 제한 쿼리를 실습했습니다.
- Amazon DynamoDB 설계 모범 사례(접근 패턴 우선, 단일 테이블, Hot Partition 방지)를 학습했습니다.

> [!NOTE]
> **다음 세션 안내**  
> Step 10-2에서는 AWS Lambda 함수를 생성하고, Amazon API Gateway와 Amazon DynamoDB를 연동하여 서버리스 REST API를 구축합니다.   
> `Items` 테이블을 그대로 사용하므로 삭제하지 마세요.

---

# 🗑️ 리소스 정리

> [!NOTE]
> Amazon DynamoDB는 이 실습 수준에서 비용이 거의 발생하지 않습니다.  
> 다만, 인덱스(GSI) 추가나 대량 데이터 적재 시 비용이 달라질 수 있으므로 방치하지 마세요.
>
> | 리소스                    | 예상 비용 | 비고                      |
> | ------------------------- | --------- | ------------------------- |
> | Items 테이블 (On-demand)  | 미미      | 트래픽 없으면 요청 비용 $0, 저장만 과금 |
> | Orders 테이블 (On-demand) | 미미      | 트래픽 없으면 요청 비용 $0, 저장만 과금 |
> | 저장된 데이터 (수 KB)     | 미미      | 25GB 이하 시 저장 비용 무료 (Always Free) |

### 옵션 선택: 유지 vs 삭제

| 옵션 | 설명 | 비용 | 권장 대상 |
| ---- | ---- | ---- | --------- |
| 옵션 A: 전체 유지 (권장) | Items + Orders 모두 유지 | 미미 | Step 10-2 진행 예정 |
| 옵션 B: Orders만 삭제 | Orders 삭제, Items 유지 | 미미 | 정리하고 싶은 경우 |
| 옵션 C: 전체 삭제 | Items + Orders 모두 삭제 | $0 | 실습 완전 종료 |

> [!WARNING]
> `Items` 테이블은 다음 실습(Step 10-2: Lambda + API Gateway + DynamoDB)에서 사용합니다.  
> Step 10-2를 진행할 예정이라면 **옵션 A(전체 유지)**를 선택하세요.  
> 트래픽이 없으면 요청 비용은 발생하지 않으며, 저장 비용도 25GB 이하 무료이므로 유지해도 비용이 미미합니다.

## 옵션 A: 전체 유지 (권장)

별도 작업이 필요 없습니다. 다음 실습으로 넘어가세요.

✅ 옵션 A 완료

## 옵션 B: Orders 테이블만 삭제

---

### 단계 1: Tag Editor로 리소스 확인

1. 상단 검색창에 `Resource Groups & Tag Editor`를 입력하고 선택합니다.
2. 왼쪽 메뉴에서 **Tag Editor**를 선택합니다.
3. 다음 조건으로 검색합니다:
    - **Regions**: `ap-northeast-2`
    - **Tag key**: `Session`, **Tag value**: `10-1`
4. [[Search resources]] 버튼을 클릭합니다.

> [!OUTPUT]
> Items 테이블과 Orders 테이블이 표시됩니다.

---

### 단계 2: Orders 테이블 삭제

5. 상단 검색창에 `DynamoDB`를 입력하고 **DynamoDB** 서비스를 선택합니다.
6. 왼쪽 메뉴에서 **Tables**를 클릭합니다.
7. 테이블 목록에서 `Orders`를 클릭합니다.
8. 우측 상단의 [[Delete]] 버튼을 클릭합니다.
9. 확인 입력란에 `delete`를 입력합니다.
10. ☐ **Create a backup of this table before deleting it** 체크를 해제합니다.
11. [[Delete table]] 버튼을 클릭합니다.

> [!OUTPUT]
> "Table is being deleted" 메시지가 표시되고, 잠시 후 목록에서 사라집니다.

**또는 CLI로 삭제:**

```bash
aws dynamodb delete-table \
  --table-name Orders \
  --region ap-northeast-2
```

---

### 단계 3: 삭제 확인

12. 왼쪽 메뉴에서 **Tables**를 클릭하여 목록을 새로고침합니다.
13. `Items` 테이블만 남아있는지 확인합니다.

**CLI로 확인:**

```bash
aws dynamodb list-tables --region ap-northeast-2
```

> [!OUTPUT]
>
> ```json
> {
>   "TableNames": ["Items"]
> }
> ```

---

### 단계 4: Tag Editor로 최종 확인

14. 상단 검색창에 `Resource Groups & Tag Editor`를 입력하고 선택합니다.
15. 왼쪽 메뉴에서 **Tag Editor**를 선택합니다.
16. 동일 조건으로 재검색합니다 (Tag key: `Session`, Value: `10-1`).
17. `Items` 테이블만 표시되면 정상입니다.

> [!TIP]
> `Step: step10`으로도 추가 검색하여 이 Step의 다른 세션에서 생성한 리소스도 함께 확인하세요.

✅ 옵션 B 완료: Orders 테이블을 삭제하고, Items 테이블은 다음 실습을 위해 유지했습니다.

## 옵션 C: 전체 삭제

Items와 Orders 테이블을 모두 삭제합니다.

> [!WARNING]
> `Items` 테이블을 삭제하면 Step 10-2에서 다시 생성해야 합니다.

---

### 단계 1: Items 테이블 삭제

1. 상단 검색창에 `DynamoDB`를 입력하고 **DynamoDB** 서비스를 선택합니다.
2. 왼쪽 메뉴에서 **Tables**를 클릭합니다.
3. 테이블 목록에서 `Items`를 클릭합니다.
4. 우측 상단의 [[Delete]] 버튼을 클릭합니다.
5. 확인 입력란에 `delete`를 입력합니다.
6. ☐ **Create a backup of this table before deleting it** 체크를 해제합니다.
7. [[Delete table]] 버튼을 클릭합니다.

---

### 단계 2: Orders 테이블 삭제

8. 같은 방법으로 `Orders` 테이블도 삭제합니다.

**또는 CLI로 일괄 삭제:**

```bash
aws dynamodb delete-table --table-name Items --region ap-northeast-2
aws dynamodb delete-table --table-name Orders --region ap-northeast-2
```

---

### 단계 3: Tag Editor로 최종 확인

9. 상단 검색창에 `Resource Groups & Tag Editor`를 입력하고 선택합니다.
10. 왼쪽 메뉴에서 **Tag Editor**를 선택합니다.
11. Tag key: `Session`, Value: `10-1`로 검색합니다.
12. 검색 결과가 없으면 모든 리소스가 정리된 것입니다.

✅ 옵션 C 완료: 모든 테이블을 삭제했습니다.

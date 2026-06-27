---
title: 'AWS Secrets Manager로 자동 로테이션 설정'
week: 6
session: 2
awsServices:
  - AWS Secrets Manager
learningObjectives:
  - Secrets Manager에 비밀을 생성하고 조회할 수 있습니다.
  - Parameter Store와 Secrets Manager의 차이를 비교할 수 있습니다.
  - Amazon RDS 비밀번호 자동 로테이션을 설정할 수 있습니다.
  - Spring 프로젝트(Boot/MVC)에서 Secrets Manager 값을 조회하여 사용할 수 있습니다.
prerequisites:
  - AWS 계정 생성 완료
  - Amazon RDS MySQL 인스턴스 (자동 로테이션 실습 시 필요, 선택)
estimatedCost: 크레딧 내 사용 가능 (비밀당 월 $0.40 + API 호출 비용)
---

이 실습에서는 AWS Secrets Manager를 사용하여 비밀값을 관리합니다.  
Parameter Store와의 차이를 이해하고, Amazon RDS 비밀번호 자동 로테이션을 설정하는 방법을 학습합니다.

### 실습 흐름

```
[서비스 비교] → [콘솔에서 비밀 생성] → [CLI로 생성/조회] → [Spring 연동] → [RDS 자동 로테이션]
```

> [!NOTE]
> 이 실습은 독립적으로 진행할 수 있습니다.  
> 자동 로테이션 실습(태스크 5)은 Amazon RDS 인스턴스가 필요하지만, 나머지 태스크는 AWS 계정만 있으면 진행 가능합니다.

> [!WARNING]
> Secrets Manager는 비밀당 월 $0.40이 과금됩니다 (크레딧에서 차감).  
> 실습 후 불필요한 비밀은 삭제하세요.
>
> | 리소스              | 비용             | 비고                         |
> | ------------------- | ---------------- | ---------------------------- |
> | 비밀 저장           | 비밀당 월 $0.40  | 삭제 대기 기간(7일)에도 과금 |
> | API 호출            | 10,000건당 $0.05 | 학습 수준에서는 무시 가능    |
> | Lambda (로테이션용) | 무료 티어 내     | 월 100만 요청 무료           |
>
> 비밀 3개 생성 시 월 약 $1.20 발생합니다.

---

## 태스크 1: Secrets Manager vs Parameter Store 비교

> [!CONCEPT] 언제 무엇을 사용할까?
>
> ```
> ┌─────────────────────────────────────────────────────────────┐
> │           비밀 관리 서비스 선택 기준                        │
> │                                                             │
> │  "DB 비밀번호를 자동으로 교체해야 하나요?"                  │
> │       │                                                     │
> │       ├── YES → Secrets Manager                             │
> │       │         • 자동 로테이션 (Lambda 기반)               │
> │       │         • RDS 네이티브 통합                         │
> │       │         • 비밀당 월 $0.40                           │
> │       │                                                     │
> │       └── NO → Parameter Store (SecureString)               │
> │                • 무료 (Standard 티어)                       │
> │                • 수동 관리                                  │
> │                • 단순 설정값에 적합                         │
> └─────────────────────────────────────────────────────────────┘
> ```
>
> | 항목             | Parameter Store | Secrets Manager               |
> | ---------------- | --------------- | ----------------------------- |
> | 비용             | 무료 (Standard) | 비밀당 월 $0.40               |
> | 자동 로테이션    | ❌ 미지원       | ✅ Lambda로 자동 교체         |
> | RDS 통합         | 수동            | ✅ RDS 비밀번호 자동 로테이션 |
> | 최대 크기        | 4KB (Standard)  | 64KB                          |
> | 버전 관리        | 제한적          | ✅ 자동 버전 관리             |
> | 크로스 계정 공유 | 제한적          | ✅ 지원                       |
>
> **결론:**
>
> - 단순 설정값, 비용 최소화 → **Parameter Store**
> - DB 비밀번호 자동 교체, 보안 감사 필요 → **Secrets Manager**

✅ **태스크 완료**: 두 서비스의 차이를 이해했습니다.

---

## 태스크 2: Secrets Manager에 비밀 생성 (콘솔)

> [!CONCEPT] Secrets Manager의 비밀 구조
>
> ```
> ┌─────────────────────────────────────────────────────────┐
> │              Secrets Manager 비밀 구조                  │
> │                                                         │
> │  Secret Name: starter/prod/db-credentials               │
> │       │                                                 │
> │       ├── Version: AWSCURRENT (현재 활성 버전)          │
> │       │   └── SecretString (JSON):                      │
> │       │       {                                         │
> │       │         "username": "admin",                    │
> │       │         "password": "MyPassword123!",           │
> │       │         "host": "localhost",                    │
> │       │         "port": "3306",                         │
> │       │         "dbname": "starter_db"                  │
> │       │       }                                         │
> │       │                                                 │
> │       ├── Version: AWSPREVIOUS (이전 버전, 롤백용)      │
> │       │   └── SecretString: {...이전 값...}             │
> │       │                                                 │
> │       └── Metadata:                                     │
> │           ├── ARN (고유 식별자)                         │
> │           ├── KMS Key (암호화 키)                       │
> │           ├── Rotation Config                           │
> │           └── Tags                                      │
> └─────────────────────────────────────────────────────────┘
> ```
>
> - **SecretString**: JSON 형태로 여러 키-값 쌍을 하나의 비밀에 저장
> - **버전 관리**: 업데이트 시 자동으로 이전 버전 보관
> - **KMS 암호화**: 저장 시 자동 암호화, 조회 시 자동 복호화

### Secrets Manager 콘솔 이동

1. AWS Management Console에 로그인합니다.
2. 우측 상단에서 리전을 **Asia Pacific (Seoul) ap-northeast-2**로 설정합니다.

    <img src="/images/common/region-check.png" alt="리전 확인" class="guide-img-sm" />

> [!TIP]
> 일부 AWS 서비스(IAM, CloudFront, Route 53 등)는 **글로벌 서비스**이므로 리전 선택 드롭다운이 비활성화되거나 "Global"로 표시됩니다.  
> 이 실습에서 사용하는 서비스는 리전 기반이므로 반드시 올바른 리전이 선택되어 있는지 확인하세요.

3. 상단 검색창에 `Secrets Manager`를 입력합니다.
4. 검색 결과에서 **Secrets Manager** 서비스를 클릭합니다.

> [!OUTPUT]
> Secrets Manager 소개 페이지가 표시됩니다.  
> 우측 **Get started** 섹션에 [[Store a new secret]] 버튼이 보입니다.  
> (이미 비밀이 있다면 비밀 목록 페이지가 표시됩니다.)

### 새 비밀 생성

5. [[Store a new secret]] 버튼을 클릭합니다 (또는 왼쪽 메뉴 **Secrets** 클릭 후 [[Store a new secret]]).
6. **Secret type** 섹션에서 **Other type of secret**을 선택합니다.

> [!TIP]
> Secret type 옵션 설명:
>
> | Secret type                                | 용도                                         |
> | ------------------------------------------ | -------------------------------------------- |
> | Credentials for Amazon RDS database        | Amazon RDS 자격 증명 (자동 로테이션 지원)    |
> | Credentials for Amazon DocumentDB database | Amazon DocumentDB 자격 증명                  |
> | Credentials for Amazon Redshift data warehouse | Amazon Redshift 자격 증명                |
> | Credentials for other database             | 기타 DB (자체 호스팅 MySQL, PostgreSQL 등)   |
> | Managed external secret                    | 3rd-party 소프트웨어 벤더가 관리하는 비밀    |
> | **Other type of secret**                   | 범용 키-값 쌍 (API 키, OAuth 토큰 등)        |
>
> 이 태스크에서는 범용 비밀을 생성하므로 **Other type of secret**을 선택합니다.  
> 태스크 5(RDS 자동 로테이션)에서는 **Credentials for Amazon RDS database**를 선택합니다.

7. **Key/value pairs** 섹션에서 [[+ Add row]] 버튼을 클릭하여 다음 5개 키-값 쌍을 추가합니다:

| Key        | Value                                |
| ---------- | ------------------------------------ |
| `username` | `admin`                              |
| `password` | `MyPassword123!`                     |
| `host`     | `localhost`                          |
| `port`     | `3306`                               |
| `dbname`   | `starter_db`                         |

> [!TIP]
> 위 값은 로컬 테스트용 예시입니다. 본인 환경에 맞게 변경하세요:
>
> - `dbname`: 본인 DB명 (예: `scoula_db`)
> - `password`: 본인 로컬 MySQL 비밀번호
> - Amazon RDS를 사용 중이라면 `host`를 RDS 엔드포인트로 변경
>
> **Amazon RDS 사용 시 예시:**
>
> | Key        | Value                                                    |
> | ---------- | -------------------------------------------------------- |
> | `username` | `admin`                                                  |
> | `password` | `RDS생성시설정한비밀번호`                                |
> | `host`     | `my-rds-mysql.xxxx.ap-northeast-2.rds.amazonaws.com`     |
> | `port`     | `3306`                                                   |
> | `dbname`   | `scoula_db`                                              |
>
> 값은 생성 후에도 콘솔의 [[Edit]] 또는 CLI `update-secret`으로 언제든 수정할 수 있습니다.

> [!WARNING]
> 첫 번째 행은 이미 표시되어 있습니다.  
> [[+ Add row]]를 4번 클릭하여 총 5개 행을 만든 후 각각 입력하세요.  
> Key와 Value를 정확히 입력해야 나중에 코드에서 조회할 때 오류가 발생하지 않습니다.

8. **Encryption key** 드롭다운에서 `aws/secretsmanager` (기본 AWS 관리형 키)를 유지합니다.
9. [[Next]] 버튼을 클릭합니다.

### 비밀 이름 및 설명 설정

10. **Secret name** 필드에 `starter/prod/db-credentials`를 입력합니다.

> [!TIP]
> 비밀 이름에 `/`를 사용하면 계층 구조로 관리할 수 있습니다.  
> 예: `{프로젝트}/{환경}/{용도}` → `starter/prod/db-credentials`
>
> 이렇게 하면 나중에 `starter/prod/*` 패턴으로 프로덕션 비밀만 필터링할 수 있습니다.

11. **Description** 필드에 `Production database credentials`를 입력합니다.
12. **Tags** 섹션에서 [[Add tag]] 버튼을 클릭합니다.
13. 다음 태그를 추가합니다:
    - `CreatedBy` = `admin-user`
    - `Step` = `step6`
    - `Session` = `6-2`

> [!NOTE]
> 태그 아래에 **Resource permissions**와 **Replicate secret** 섹션이 보이지만, 모두 기본값으로 두고 건너뛰면 됩니다.
> - **Resource permissions**: 크로스 계정 접근 설정 (이 실습에서는 불필요)
> - **Replicate secret**: 다른 리전에 복제 (이 실습에서는 불필요)

14. [[Next]] 버튼을 클릭합니다.

### 로테이션 설정 (건너뛰기)

15. **Configure rotation** 페이지가 표시됩니다. **Automatic rotation** 토글이 꺼져 있는 상태를 유지합니다.

> [!CONCEPT] Configure rotation 페이지 설명
>
> 이 페이지는 비밀값을 **자동으로 주기적 교체**하는 설정입니다:
>
> - **Automatic rotation**: 토글을 켜면 아래 옵션이 활성화됨
> - **Rotation schedule**: 교체 주기 설정 (예: 23시간마다, 30일마다 등)
> - **Window duration**: 로테이션이 실행될 시간 범위 (예: 4시간 이내)
> - **Rotate immediately**: 저장 즉시 첫 로테이션 실행 여부
> - **Rotation function**: 비밀번호 교체를 수행할 Lambda 함수 선택
>
> 자동 로테이션은 태스크 5에서 Amazon RDS와 함께 설정합니다. 지금은 **꺼둔 채로** 넘어갑니다.

16. [[Next]] 버튼을 클릭합니다.

### 검토 및 생성

17. **Review** 페이지에서 다음을 확인합니다:
    - Secret name: `starter/prod/db-credentials`
    - Secret type: Other type of secret
    - Encryption key: `aws/secretsmanager`
    - Rotation: Disabled
18. [[Store]] 버튼을 클릭합니다.

> [!OUTPUT]
> 녹색 배너로 "You successfully stored the secret starter/prod/db-credentials." 메시지가 표시됩니다.  
> Secrets 목록 페이지로 이동하며, 생성한 비밀이 목록에 나타납니다.
>
> | Secret name | Description | Created on (UTC) |
> | --- | --- | --- |
> | `starter/prod/db-credentials` | Production database credentials | (생성 시각) |

### 저장된 비밀 값 확인

19. 비밀 상세 페이지에서 **Secret value** 섹션으로 스크롤합니다.
20. [[Retrieve secret value]] 버튼을 클릭합니다.

> [!OUTPUT]
> 저장된 키-값 쌍이 테이블 형태로 표시됩니다:
>
> | Secret key | Secret value     |
> | ---------- | ---------------- |
> | username   | admin            |
> | password   | MyPassword123!   |
> | host       | localhost        |
> | port       | 3306             |
> | dbname     | starter_db       |

> [!TIP]
> **Plaintext** 탭을 클릭하면 JSON 형태로도 확인할 수 있습니다:
>
> ```json
> {
>   "username": "admin",
>   "password": "MyPassword123!",
>   "host": "localhost",
>   "port": "3306",
>   "dbname": "starter_db"
> }
> ```

> [!NOTE]
> 비밀번호가 평문으로 보이는 것은 정상입니다. Secrets Manager의 보안 핵심은 "아무도 못 보게 하는 것"이 아니라:
>
> - **코드/Git에 비밀번호가 노출되지 않음** (하드코딩 불필요)
> - **IAM 정책으로 누가 조회할 수 있는지 제어** (권한 없으면 접근 불가)
> - **CloudTrail로 누가 언제 조회했는지 감사** (보안 사고 추적 가능)
> - **저장 시 KMS로 암호화** (AWS 내부 스토리지에서는 암호문)
>
> 콘솔에서 평문이 보이는 건 "IAM 권한이 있는 사용자가 의도적으로 조회한 것"이므로 문제없습니다.

✅ **태스크 완료**: Secrets Manager에 DB 자격 증명을 저장했습니다.

---

## 태스크 3: AWS CLI로 비밀 생성/조회

> [!NOTE]
> 로컬 터미널에서 CLI를 사용하려면 `aws configure`로 Access Key가 설정되어 있어야 하며,  
> 해당 IAM 사용자에 Secrets Manager 권한이 필요합니다.
>
> **권한 추가 방법:**  
> IAM → Users → 본인 사용자 → Add permissions → **Attach policies directly**  
> → `SecretsManagerReadWrite` 검색 → 체크 → Add permissions
>
> 또는 AWS CloudShell을 사용하면 별도 설정 없이 현재 로그인한 사용자 권한으로 바로 실행됩니다.

> [!TIP]
> 로컬 터미널에서 CLI 출력이 `(END)`로 멈추는 경우, 먼저 다음 명령어를 실행하면 이후 모든 명령에서 페이저가 비활성화됩니다:
>
> ```bash
> export AWS_PAGER=""
> ```
>
> 터미널을 새로 열 때마다 실행해야 합니다. 영구 적용하려면 `~/.zshrc`에 추가하세요.

### 주요 CLI 명령어 요약

| 명령어 | 용도 | 비고 |
| ------ | ---- | ---- |
| `create-secret` | 새 비밀 생성 | 이름 중복 시 `ResourceExistsException` 에러 |
| `get-secret-value` | 비밀 값 조회 (평문 반환) | `--secret-id`에 이름 또는 ARN |
| `update-secret` | 기존 비밀 값 업데이트 | 새 버전 자동 생성 |
| `list-secrets` | 비밀 목록 조회 | `--query`로 필터링 가능 |
| `delete-secret` | 비밀 삭제 | `--force-delete-without-recovery`로 즉시 삭제 |

### 새 비밀 생성 (create-secret)

21. 터미널을 열고 다음 명령어를 실행합니다:

```bash
aws secretsmanager create-secret \
  --name "starter/prod/api-keys" \
  --description "External API keys" \
  --secret-string '{"payment_api_key":"pk_live_abc123","notification_key":"nk_xyz789"}' \
  --region ap-northeast-2
```

> [!NOTE]
> 각 옵션 설명:
>
> | 옵션 | 설명 |
> |------|------|
> | `--name` | 비밀 이름 (경로 형태 권장: `프로젝트/환경/용도`) |
> | `--description` | 비밀 설명 (콘솔 목록에서 표시됨) |
> | `--secret-string` | 저장할 값 (JSON 형태로 여러 키-값 쌍 가능) |
> | `--region` | AWS 리전 |

> [!OUTPUT]
>
> ```json
> {
>   "ARN": "arn:aws:secretsmanager:ap-northeast-2:123456789012:secret:starter/prod/api-keys-AbCdEf",
>   "Name": "starter/prod/api-keys",
>   "VersionId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
> }
> ```

> [!TIP]
> 터미널에 `(END)`가 표시되면 출력이 `less` 페이저로 열린 것입니다.  
> **`q`를 눌러 빠져나오세요.**  
> 이를 방지하려면 명령어 끝에 `--no-cli-pager`를 추가하거나, `export AWS_PAGER=""`를 설정하면 됩니다.

> [!TIP]
> `--secret-string`에 JSON을 전달할 때 작은따옴표(`'`)로 감싸면 쉘에서 큰따옴표를 이스케이프하지 않아도 됩니다.  
> Windows CMD에서는 큰따옴표를 `\"`로 이스케이프해야 합니다.

### 비밀 조회 (get-secret-value)

22. 방금 CLI로 생성한 `api-keys` 비밀을 조회합니다:

```bash
aws secretsmanager get-secret-value \
  --secret-id "starter/prod/api-keys" \
  --region ap-northeast-2
```

> [!NOTE]
> `get-secret-value`는 비밀의 실제 값을 평문으로 반환합니다.  
> `--secret-id`에는 비밀 이름 또는 ARN을 지정합니다.

> [!OUTPUT]
>
> ```json
> {
>   "ARN": "arn:aws:secretsmanager:ap-northeast-2:123456789012:secret:starter/prod/api-keys-AbCdEf",
>   "Name": "starter/prod/api-keys",
>   "VersionId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
>   "SecretString": "{\"payment_api_key\":\"pk_live_abc123\",\"notification_key\":\"nk_xyz789\"}",
>   "VersionStages": ["AWSCURRENT"],
>   "CreatedDate": "2025-01-15T10:35:00+09:00"
> }
> ```

23. 태스크 2에서 **콘솔로** 생성한 비밀도 CLI로 조회합니다:

```bash
aws secretsmanager get-secret-value \
  --secret-id "starter/prod/db-credentials" \
  --region ap-northeast-2
```

> [!OUTPUT]
>
> ```json
> {
>   "ARN": "arn:aws:secretsmanager:ap-northeast-2:123456789012:secret:starter/prod/db-credentials-XyZaBc",
>   "Name": "starter/prod/db-credentials",
>   "VersionId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
>   "SecretString": "{\"username\":\"admin\",\"password\":\"MyPassword123!\",\"host\":\"localhost\",\"port\":\"3306\",\"dbname\":\"starter_db\"}",
>   "VersionStages": ["AWSCURRENT"],
>   "CreatedDate": "2025-01-15T10:30:00+09:00"
> }
> ```

24. JSON에서 특정 값만 추출하려면 `--query` 옵션을 사용합니다:

```bash
aws secretsmanager get-secret-value \
  --secret-id "starter/prod/db-credentials" \
  --query "SecretString" \
  --output text \
  --region ap-northeast-2
```

> [!NOTE]
> `--query`는 JMESPath 표현식으로 응답에서 원하는 필드만 추출합니다.  
> `--output text`와 함께 사용하면 따옴표 없는 순수 텍스트로 출력됩니다.

> [!OUTPUT]
>
> ```
> {"username":"admin","password":"MyPassword123!","host":"localhost","port":"3306","dbname":"starter_db"}
> ```

### 비밀 값 업데이트 (update-secret)

25. 비밀번호를 변경합니다:

```bash
aws secretsmanager update-secret \
  --secret-id "starter/prod/db-credentials" \
  --secret-string '{"username":"admin","password":"NewPassword456!","host":"localhost","port":"3306","dbname":"starter_db"}' \
  --region ap-northeast-2
```

> [!NOTE]
> `update-secret`은 기존 비밀의 값을 덮어씁니다. 전체 JSON을 다시 전달해야 합니다 (부분 업데이트 불가).  
> 업데이트 시 새 버전이 자동 생성되고, 이전 버전은 `AWSPREVIOUS` 스테이지로 보관됩니다.

> [!OUTPUT]
>
> ```json
> {
>   "ARN": "arn:aws:secretsmanager:ap-northeast-2:123456789012:secret:starter/prod/db-credentials-XyZaBc",
>   "Name": "starter/prod/db-credentials",
>   "VersionId": "yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy"
> }
> ```

> [!WARNING]
> 비밀번호를 변경했으므로, 이후 Spring 테스트 시 이 값이 로컬 MySQL 비밀번호와 일치해야 합니다.  
> 아래에서 원래 값으로 되돌립니다.

26. Spring 테스트를 위해 원래 비밀번호로 복원합니다:

```bash
aws secretsmanager update-secret \
  --secret-id "starter/prod/db-credentials" \
  --secret-string '{"username":"admin","password":"MyPassword123!","host":"localhost","port":"3306","dbname":"starter_db"}' \
  --region ap-northeast-2
```

> [!OUTPUT]
> `VersionId`가 새로 발급되면 복원 완료입니다. 이제 `password`가 다시 `MyPassword123!`입니다.

### 비밀 목록 조회 (list-secrets)

27. 현재 계정에서 `starter/`로 시작하는 비밀을 모두 조회합니다:

```bash
aws secretsmanager list-secrets \
  --query "SecretList[?starts_with(Name, 'starter/')].[Name,CreatedDate]" \
  --output table \
  --region ap-northeast-2
```

> [!NOTE]
> `list-secrets`는 비밀의 **메타데이터만** 반환합니다 (값은 포함되지 않음).  
> 실제 값을 보려면 `get-secret-value`를 사용해야 합니다.

> [!OUTPUT]
>
> ```
> -----------------------------------------------------------
> |                       ListSecrets                        |
> +----------------------------------+----------------------+
> |  starter/prod/api-keys           |  2025-01-15T10:35:00 |
> |  starter/prod/db-credentials     |  2025-01-15T10:30:00 |
> +----------------------------------+----------------------+
> ```

✅ **태스크 완료**: CLI로 비밀을 생성, 조회, 업데이트했습니다.

> [!TROUBLESHOOTING]
> | 증상 | 원인 | 해결 방법 |
> |------|------|-----------|
> | `ResourceNotFoundException` | 비밀 이름(secret-id) 오타 | `aws secretsmanager list-secrets`로 정확한 이름 확인 |
> | `InvalidRequestException` | JSON 형식 오류 | `--secret-string`의 JSON 유효성 검사 (따옴표 이스케이프 확인) |
> | `AccessDeniedException` | IAM 권한 부족 | `secretsmanager:GetSecretValue` 권한 확인 |
> | 업데이트 후 이전 값 반환 | 캐시 또는 버전 문제 | `--version-stage AWSCURRENT` 명시하여 조회 |

---

## 태스크 4: Spring에서 Secrets Manager 조회

> [!CONCEPT] Spring + Secrets Manager 연동 흐름
>
> ```
> ┌─────────────────────────────────────────────────────────────┐
> │         Spring ↔ Secrets Manager 연동                       │
> │                                                             │
> │  [애플리케이션 시작]                                        │
> │       │                                                     │
> │       ▼                                                     │
> │  SecretsManagerService (@PostConstruct)                     │
> │       │                                                     │
> │       ▼  GetSecretValue API 호출                            │
> │  AWS Secrets Manager                                        │
> │       │                                                     │
> │       ▼  SecretString (JSON) 반환                           │
> │  JSON 파싱 → dbHost, dbPort, dbName, username, password     │
> │       │                                                     │
> │       ▼                                                     │
> │  DataSource Bean 생성 (HikariCP)                            │
> │       │                                                     │
> │       ▼                                                     │
> │  jdbc:mysql://host:port/dbname 으로 RDS 연결                │
> └─────────────────────────────────────────────────────────────┘
> ```
>
> **장점**: application.yml/properties에 비밀번호를 하드코딩하지 않아도 됩니다.  
> **주의**: ⚠️ Amazon EC2/ECS에 적절한 IAM Role이 있어야 Secrets Manager API를 호출할 수 있습니다.

### 의존성 추가

28. `build.gradle` 파일에 AWS SDK 의존성을 추가합니다 (본인 프로젝트에 맞는 방법 선택):

**방법 A: Spring Boot 프로젝트**

```groovy
// build.gradle (Spring Boot — BOM 방식)
dependencyManagement {
    imports {
        mavenBom "software.amazon.awssdk:bom:2.44.0"  // AWS SDK 버전 통합 관리
    }
}

dependencies {
    implementation 'software.amazon.awssdk:secretsmanager'              // Secrets Manager SDK
    implementation 'com.fasterxml.jackson.core:jackson-databind'        // JSON 파싱 (starter-web에 포함, 없으면 추가)
}
```

> [!TIP]
> `spring-boot-starter-web`을 사용 중이라면 Jackson은 이미 포함되어 있으므로 `jackson-databind` 줄은 생략해도 됩니다.  
> 에러가 나면 추가하세요. BOM 버전 관리 덕분에 Jackson 버전은 명시하지 않아도 됩니다.

**방법 B: 기존 Spring MVC 프로젝트**

```groovy
// build.gradle (Spring MVC — 직접 버전 명시)
dependencies {
    // 기존 의존성들...

    // AWS SDK v2 - Secrets Manager
    implementation 'software.amazon.awssdk:secretsmanager:2.44.0'

    // JSON 파싱용 (없는 경우에만 추가)
    implementation 'com.fasterxml.jackson.core:jackson-databind:2.17.0'
}
```

> [!NOTE]
> Step 5 또는 6-1에서 AWS SDK 의존성을 이미 추가한 경우, 같은 버전(`2.44.0`)으로 `secretsmanager`만 한 줄 추가하면 됩니다.  
> `platform()` BOM을 사용했다면 버전 없이 `implementation 'software.amazon.awssdk:secretsmanager'`만 추가하세요.

> [!TIP]
> BOM을 사용하면 AWS SDK 모듈 간 버전 충돌을 방지할 수 있습니다.  
> 개별 모듈에 버전을 명시하지 않아도 BOM에서 호환되는 버전을 자동으로 관리합니다.

> [!TIP]
> 의존성 추가 후 IntelliJ에서 우측 상단의 🔄 Gradle sync 아이콘을 클릭하거나,  
> Gradle 탭 → 🔄 Reload All Gradle Projects를 클릭하여 새로고침합니다.

### SecretsManagerService 클래스 작성

> [!WARNING]
> **6-1에서 ParameterStoreService를 작성한 경우:**  
> `ParameterStoreService`도 `@Profile("aws")`이므로 `aws` 프로필로 실행하면 함께 활성화됩니다.  
> 6-2 테스트 시에는 다음 두 가지를 변경하세요:
>
> **① ParameterStoreService 비활성화:**
> ```java
> // ParameterStoreService.java — 임시 비활성화
> @Profile("aws-ssm")  // "aws" → "aws-ssm"으로 변경
> public class ParameterStoreService { ... }
> ```
>
> **② 기존 DataSourceConfig에서 주입 대상 변경:**  
> `ParameterStoreService` → `SecretsManagerService`로 변경합니다.  
> (아래 30번에서 새 DataSourceConfig를 작성하므로, 기존 것을 교체하면 됩니다.)
>
> 나중에 프로덕션에서는 Parameter Store 또는 Secrets Manager 중 하나만 선택하여 사용합니다.

29. `src/main/java/com/example/demo/config/` 디렉토리에 `SecretsManagerService.java` 파일을 생성합니다:

> [!NOTE]
> **import 차이:**
>
> - Spring Boot 3.x (Jakarta EE): `import jakarta.annotation.PostConstruct;`
> - Spring MVC 5.x / Boot 2.x (Java EE): `import javax.annotation.PostConstruct;`
>
> 레거시 프로젝트에서는 패키지를 `org.scoula.config`로 변경하세요.

```java
package com.example.demo.config;  // 레거시: org.scoula.config

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;  // 레거시: javax.annotation.PostConstruct
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.secretsmanager.SecretsManagerClient;
import software.amazon.awssdk.services.secretsmanager.model.GetSecretValueRequest;
import software.amazon.awssdk.services.secretsmanager.model.GetSecretValueResponse;

@Slf4j
@Component
@Profile("aws")  // "aws" 프로필일 때만 Bean 등록
public class SecretsManagerService {

    private final SecretsManagerClient client;
    private final ObjectMapper objectMapper = new ObjectMapper();  // JSON 파싱용

    private String dbHost;
    private String dbPort;
    private String dbName;
    private String dbUsername;
    private String dbPassword;

    public SecretsManagerService() {
        // 서울 리전의 Secrets Manager 클라이언트 생성
        this.client = SecretsManagerClient.builder()
                .region(Region.AP_NORTHEAST_2)
                .build();
    }

    /**
     * 애플리케이션 시작 시 Secrets Manager에서 DB 자격 증명을 로드합니다.
     * Parameter Store와 달리 JSON 형태로 여러 값이 하나의 비밀에 저장됩니다.
     */
    @PostConstruct
    public void loadSecrets() {
        try {
            // Secrets Manager에서 비밀 값 조회
            GetSecretValueResponse response = client.getSecretValue(
                    GetSecretValueRequest.builder()
                            .secretId("starter/prod/db-credentials")  // 태스크 2에서 생성한 비밀 이름
                            .build()
            );

            // JSON 문자열을 파싱하여 각 필드 추출
            JsonNode secret = objectMapper.readTree(response.secretString());
            this.dbHost = secret.get("host").asText();
            this.dbPort = secret.get("port").asText();
            this.dbName = secret.get("dbname").asText();
            this.dbUsername = secret.get("username").asText();
            this.dbPassword = secret.get("password").asText();

            log.info("Secrets Manager에서 DB 자격 증명 로드 완료");
            log.info("  host: {}", dbHost);
            log.info("  port: {}", dbPort);
            log.info("  dbname: {}", dbName);
            log.info("  username: {}", dbUsername);
            log.info("  password: {}", "****");  // 비밀번호는 마스킹
        } catch (Exception e) {
            log.error("Secrets Manager 조회 실패", e);
            throw new RuntimeException("Failed to load secrets", e);
        }
    }

    /** host, port, dbname을 조합하여 JDBC URL 생성 */
    public String getJdbcUrl() {
        return String.format("jdbc:mysql://%s:%s/%s", dbHost, dbPort, dbName);
    }

    public String getDbUsername() { return dbUsername; }
    public String getDbPassword() { return dbPassword; }
}
```

> [!WARNING]
> `secretId("starter/prod/db-credentials")` 부분을 태스크 2에서 생성한 비밀 이름과 정확히 일치시키세요.  
> 대소문자와 슬래시(`/`)를 포함하여 정확히 입력해야 합니다.

### DataSource 설정 클래스 작성

30. DataSource 설정 클래스를 생성합니다 (본인 프로젝트에 맞는 방법 선택):

**Spring Boot:**

```java
package com.example.demo.config;

import com.zaxxer.hikari.HikariDataSource;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

import javax.sql.DataSource;

@Configuration
@Profile("aws")  // "aws" 프로필일 때만 활성화
@RequiredArgsConstructor
public class DataSourceConfig {

    private final SecretsManagerService secretsManager;

    @Bean
    public DataSource dataSource() {
        HikariDataSource ds = new HikariDataSource();
        ds.setJdbcUrl(secretsManager.getJdbcUrl());          // Secrets Manager에서 host+port+dbname 조합
        ds.setUsername(secretsManager.getDbUsername());       // Secrets Manager에서 조회
        ds.setPassword(secretsManager.getDbPassword());      // Secrets Manager에서 조회
        ds.setDriverClassName("com.mysql.cj.jdbc.Driver");   // MySQL 기본 드라이버 (환경에 따라 변경)
        return ds;
    }
}
```

> [!TIP]
> driver를 하드코딩하지 않으려면 Secrets Manager JSON에 `"driver": "com.mysql.cj.jdbc.Driver"` 필드를 추가하거나,  
> 6-3 셀프 미션처럼 driver는 Parameter Store에서, password는 Secrets Manager에서 가져오는 혼합 방식을 사용하세요.

> [!NOTE]
> `@Profile("aws")`를 붙였으므로 로컬에서는 기존 `application.properties`의 DataSource 설정이 그대로 사용됩니다.  
> `--spring.profiles.active=aws`로 실행할 때만 Secrets Manager에서 값을 가져옵니다.

**Spring MVC 레거시:**

```java
package org.scoula.config;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

import javax.sql.DataSource;

@Configuration
@Profile("aws")  // EC2 배포 시에만 활성화
@RequiredArgsConstructor
public class AwsDataSourceConfig {

    private final SecretsManagerService secretsManager;

    @Bean
    public DataSource dataSource() {
        HikariConfig config = new HikariConfig();
        config.setDriverClassName("com.mysql.cj.jdbc.Driver");       // MySQL 기본 드라이버 (환경에 따라 변경)
        config.setJdbcUrl(secretsManager.getJdbcUrl());              // Secrets Manager에서 조합된 URL
        config.setUsername(secretsManager.getDbUsername());           // Secrets Manager에서 조회
        config.setPassword(secretsManager.getDbPassword());          // Secrets Manager에서 조회
        return new HikariDataSource(config);
    }
}
```

> [!TIP]
> 레거시 프로젝트에서 `log4jdbc`를 사용한다면 driver와 URL을 맞춰야 합니다.  
> 이 경우 Secrets Manager의 `host` 값 앞에 `log4jdbc:`를 붙이거나, driver를 Parameter Store에서 관리하는 6-3 셀프 미션 방식을 권장합니다.

> [!TIP]
> 레거시에서 6-1의 `LocalDataSourceConfig`(`@Profile("!aws")`)를 이미 작성했다면,  
> 여기서는 `AwsDataSourceConfig`만 Secrets Manager 버전으로 교체하면 됩니다.  
> 로컬 실행 시에는 기존 `LocalDataSourceConfig`가 동작합니다.

> [!TIP]
> **`aws` 프로필 활성화 방법:**
>
> | 환경 | 방법 |
> | ---- | ---- |
> | Spring Boot (IntelliJ Run Configuration) | **Active profiles** 필드에 `aws` 입력 |
> | Spring Boot (터미널) | `./gradlew bootRun --args='--spring.profiles.active=aws'` |
> | Spring Boot (JAR) | `java -jar app.jar --spring.profiles.active=aws` |
> | Spring MVC 레거시 (IntelliJ) | Run Configuration → VM options: `-Dspring.profiles.active=aws` |
> | Tomcat WAR 배포 | `JAVA_OPTS="-Dspring.profiles.active=aws"` |
>
> 프로필을 지정하지 않으면 `@Profile("aws")` Bean은 비활성화되고, 로컬 설정이 그대로 동작합니다.

31. (Boot) `application.properties`의 기존 DB 설정은 그대로 유지합니다:

```properties
# 로컬 실행용 (aws 프로필이 아닐 때 자동 사용)
spring.datasource.url=jdbc:mysql://localhost:3306/starter_db
spring.datasource.username=admin
spring.datasource.password=MyPassword123!
spring.datasource.driver-class-name=com.mysql.cj.jdbc.Driver
```

> [!TIP]
> 6-1과 마찬가지로 `@Profile("aws")`로 분리했기 때문에, 로컬에서는 기존 설정이 그대로 동작합니다.  
> `application.properties`를 삭제하지 마세요.

### 로컬에서 aws 프로필 테스트

**전제 조건**: `aws configure`로 Access Key가 설정되어 있고, IAM 사용자에 `secretsmanager:GetSecretValue` 권한이 있어야 합니다.

> [!TIP]
> **IAM 권한 안내:**  
> 태스크 3에서 CLI를 사용하기 위해 `SecretsManagerReadWrite` 권한을 이미 추가했다면 **여기서 추가 작업은 불필요**합니다.  
> Spring SDK도 동일한 IAM 사용자 자격 증명(`~/.aws/credentials`)을 사용하므로 같은 권한이 적용됩니다.
>
> 태스크 3을 건너뛰었거나 권한 에러가 나는 경우:  
> IAM → Users → 본인 사용자 → Add permissions → **Attach policies directly**  
> → `SecretsManagerReadWrite` 검색 → 체크 → Add permissions

**Spring Boot:**

```bash
./gradlew bootRun --args='--spring.profiles.active=aws'
```

**Spring MVC 레거시 (IntelliJ):**

Run Configuration → VM options에 `-Dspring.profiles.active=aws` 추가 후 Tomcat 실행.

> [!OUTPUT]
> 콘솔 로그에 다음과 같이 출력되면 Secrets Manager 연동 **성공**입니다:
>
> ```
> INFO  c.e.d.config.SecretsManagerService - Secrets Manager에서 DB 자격 증명 로드 완료
> INFO  c.e.d.config.SecretsManagerService -   host: localhost
> INFO  c.e.d.config.SecretsManagerService -   port: 3306
> INFO  c.e.d.config.SecretsManagerService -   dbname: starter_db
> INFO  c.e.d.config.SecretsManagerService -   username: admin
> INFO  c.e.d.config.SecretsManagerService -   password: ****
> ```

> [!WARNING]
> Secrets Manager에 저장한 `host` 값이 로컬에서 접근 불가한 Amazon RDS 엔드포인트라면 DB 연결은 실패합니다.  
> 로컬 테스트 시에는 `host`를 `localhost`로, `dbname`을 로컬 DB명으로 업데이트하거나,  
> **"Secrets Manager에서 값을 가져오는 것 자체"** 가 성공하는지만 확인하세요.  
> 핵심은 "Secrets Manager에서 DB 자격 증명 로드 완료" 로그가 찍히는지 여부입니다.

✅ **태스크 완료**: Spring에서 Secrets Manager 값을 조회하여 DataSource를 설정했습니다.

---

## 태스크 5: Amazon RDS 비밀번호 자동 로테이션 설정 (선택)

> [!NOTE]
> 이 태스크는 Amazon RDS MySQL 인스턴스가 필요합니다.
>
> **본인 상황에 맞는 경로를 선택하세요:**
>
> | 상황 | 진행 방법 |
> |------|-----------|
> | Step 4에서 Amazon RDS를 이미 생성함 | 바로 아래 단계 진행 |
> | Amazon RDS가 없지만 실습하고 싶음 | CloudFormation으로 환경 구축 후 진행 (아래 TIP 참고) |
> | 이 태스크를 건너뛰고 싶음 | 마무리 섹션으로 이동 |

> [!NOTE]
> Amazon RDS가 없는 경우 아래 CloudFormation 단계로 환경을 구축하세요.  
> Step 4에서 Amazon RDS를 이미 생성했다면 "VPC Endpoint 생성" 섹션으로 건너뛰세요.

### CloudFormation으로 Amazon RDS 환경 구축 (Amazon RDS가 없는 경우)

이 실습에서 제공하는 CloudFormation 템플릿을 사용하면 VPC + Amazon RDS 환경을 자동 생성할 수 있습니다.

> [!DOWNLOAD]
> [step6-2-rds-rotation-lab.zip](/files/step6/step6-2-rds-rotation-lab.zip)
>
> - `step6-2-rds-rotation-prereq.yaml` - AWS CloudFormation 템플릿 (VPC, 서브넷 4개, Security Group, DB Subnet Group, Amazon RDS MySQL 자동 생성)

> [!CONCEPT] 이 템플릿이 생성하는 리소스
>
> | 리소스 | 설명 |
> |--------|------|
> | VPC + 서브넷 4개 | 퍼블릭 2 + 프라이빗 2 (2 AZ) |
> | Internet Gateway + Route Table | 퍼블릭 서브넷 인터넷 연결 |
> | RDS Security Group | VPC 내부 + Lambda에서 MySQL(3306) 허용 |
> | Lambda Security Group | 로테이션 Lambda용 |
> | DB Subnet Group | 프라이빗 서브넷 2개로 구성 |
> | RDS MySQL (db.t3.micro) | 프라이빗 서브넷에 배치 |

> [!WARNING]
> **Amazon RDS 비용:** db.t3.micro 기준 시간당 과금됩니다 (크레딧에서 차감).  
> 최신 요금은 [AWS RDS 요금 페이지](https://aws.amazon.com/rds/pricing/)를 확인하세요.  
> **실습 종료 후 반드시 스택을 삭제하세요.** 방치 시 지속 과금됩니다.

32. 다운로드한 zip 파일을 압축 해제합니다.
33. AWS Management Console 상단 검색창에 `CloudFormation`을 입력하고 선택합니다.
34. [[Create stack]] → **With new resources (standard)** 를 클릭합니다.
35. **Prepare template** 섹션에서 `Choose an existing template`을 선택합니다.
36. **Template source** 섹션에서 `Upload a template file`을 선택합니다.
37. [[Choose file]] 을 클릭하여 `step6-2-rds-rotation-prereq.yaml` 파일을 업로드합니다.
38. [[Next]] 버튼을 클릭합니다.
39. **Stack name** 필드에 `step6-rds-rotation-lab`을 입력합니다.
40. **Parameters** 섹션에서 다음 값을 확인하고, 본인 환경에 맞게 변경합니다:
    - `DBMasterUsername`: `admin` (Secrets Manager의 `username`과 동일하게 설정)
    - `DBMasterPassword`: `MyPassword123!` (Secrets Manager의 `password`와 동일하게 설정)
    - `DBName`: `starter_db` (Secrets Manager의 `dbname`과 동일하게 설정)
    - 나머지 파라미터는 기본값 유지

> [!TIP]
> Secrets Manager에 저장한 값과 다른 username/password/dbname을 사용했다면 여기서 맞춰 변경하세요.  
> CloudFormation Parameters의 값 = Secrets Manager에 저장한 값 = 실제 RDS 접속 정보가 모두 일치해야 합니다.
41. [[Next]] 버튼을 클릭합니다.
42. **Configure stack options** 페이지에서 기본값 유지, [[Next]] 버튼을 클릭합니다.
43. **Review** 페이지 하단의 **Capabilities** 체크박스를 선택합니다.
44. [[Submit]] 버튼을 클릭합니다.
45. **Status**가 `CREATE_COMPLETE`로 변경될 때까지 대기합니다 (약 5~10분).

> [!OUTPUT]
> 스택 상태가 `CREATE_COMPLETE`로 변경되면 모든 리소스가 생성된 것입니다.  
> **Outputs** 탭을 클릭하면 RDS 엔드포인트 등 생성된 리소스 정보를 확인할 수 있습니다.

46. **Outputs** 탭에서 `RDSEndpoint` 값을 복사합니다 (예: `starter-mysql.xxxx.ap-northeast-2.rds.amazonaws.com`).
47. Secrets Manager의 `host` 값을 RDS 엔드포인트로 업데이트합니다:

```bash
aws secretsmanager update-secret \
  --secret-id "starter/prod/db-credentials" \
  --secret-string '{"username":"admin","password":"MyPassword123!","host":"여기에-RDS-엔드포인트-붙여넣기","port":"3306","dbname":"starter_db"}' \
  --region ap-northeast-2
```

> [!TIP]
> `여기에-RDS-엔드포인트-붙여넣기` 부분을 Outputs에서 복사한 실제 엔드포인트로 교체하세요.  
> 예: `starter-mysql.abc123xyz.ap-northeast-2.rds.amazonaws.com`
>
> **변경 확인:** 업데이트 후 다음 명령어로 값이 올바르게 변경되었는지 확인합니다:
>
> ```bash
> aws secretsmanager get-secret-value \
>   --secret-id "starter/prod/db-credentials" \
>   --query "SecretString" \
>   --output text \
>   --region ap-northeast-2
> ```
>
> `host` 값이 RDS 엔드포인트로 변경되어 있으면 성공입니다.

### VPC Endpoint 생성 (자동 로테이션 필수)

> [!CONCEPT] 자동 로테이션 동작 원리
>
> ```
> ┌─────────────────────────────────────────────────────────────┐
> │              자동 로테이션 흐름 (30일 주기)                 │
> │                                                             │
> │  [Day 0] 로테이션 트리거                                    │
> │       │                                                     │
> │       ▼                                                     │
> │  Secrets Manager → Lambda 함수 호출                         │
> │       │                                                     │
> │       ▼  4단계 로테이션 프로세스                            │
> │  ┌─────────────────────────────────────────────┐            │
> │  │ 1. createSecret: 새 비밀번호 생성           │            │
> │  │ 2. setSecret: RDS에 새 비밀번호 적용        │            │
> │  │ 3. testSecret: 새 비밀번호로 접속 테스트    │            │
> │  │ 4. finishSecret: AWSCURRENT 스테이지 이동   │            │
> │  └─────────────────────────────────────────────┘            │
> │       │                                                     │
> │       ▼                                                     │
> │  결과:                                                      │
> │  • AWSCURRENT → 새 비밀번호                                 │
> │  • AWSPREVIOUS → 이전 비밀번호 (일정 기간 유효)             │
> │                                                             │
> │  [Day 30] 다음 로테이션 자동 실행...                        │
> └─────────────────────────────────────────────────────────────┘
> ```

> [!CONCEPT] VPC Endpoint란?
> VPC Endpoint는 프라이빗 서브넷에서 **인터넷을 거치지 않고** AWS 서비스에 직접 접근하는 통로입니다.
>
> ```
> [프라이빗 서브넷]
>   └── Lambda (로테이션 함수)
>         ├── RDS 접속 → 프라이빗 내부 통신 (OK)
>         └── Secrets Manager API 호출 → ❌ 인터넷 없음!
>                                         ✅ VPC Endpoint로 해결
> ```
>
> 로테이션 Lambda는 RDS와 같은 프라이빗 서브넷에 배치됩니다.  
> RDS 접속은 내부 통신이라 문제없지만, Secrets Manager API를 호출하려면 경로가 필요합니다.  
> **NAT Gateway가 있으면 이미 동작하지만**, VPC Endpoint를 사용하면 NAT 없이도 가능하고 비용도 절감됩니다.

> [!NOTE]
> Step 3에서 NAT Gateway 또는 NAT Instance를 생성한 경우, 프라이빗 서브넷에서 이미 인터넷 접근이 가능합니다.  
> 이 경우 VPC Endpoint 없이도 로테이션이 동작하지만, **VPC Endpoint 학습을 위해 함께 진행하는 것을 권장합니다.**

48. VPC 콘솔로 이동합니다 (상단 검색창에 `VPC` 입력).
49. 왼쪽 메뉴에서 **Endpoints**를 클릭합니다.
50. [[Create endpoint]] 버튼을 클릭합니다.
51. **Name tag** 필드에 `starter-secretsmanager-endpoint`를 입력합니다.
52. **Type** 섹션에서 `AWS services`를 선택합니다 (기본값).

> [!NOTE]
> **Type 옵션 설명:**
>
> | Type | 설명 |
> |------|------|
> | **AWS services** | AWS 서비스에 Interface 또는 Gateway로 연결 (이번 실습) |
> | PrivateLink Ready partner services | AWS 파트너 SaaS 서비스 연결 |
> | AWS Marketplace services | Marketplace에서 구매한 서비스 연결 |
> | EC2 Instance Connect Endpoint | 프라이빗 서브넷 Amazon EC2에 SSH 접속 |
> | Resources | Amazon RDS 등 리소스에 Resource endpoint로 연결 |
> | Service networks | VPC Lattice 서비스 네트워크 연결 |
> | Endpoint services that use NLBs and GWLBs | NLB/GWLB 기반 서비스 연결 |

53. **Services** 검색창에 `secretsmanager`를 입력합니다.
54. `com.amazonaws.ap-northeast-2.secretsmanager` 서비스를 선택합니다 (Type: **Interface**).

> [!NOTE]
> VPC Endpoint에는 두 가지 유형이 있습니다:
>
> | 유형 | 방식 | 대상 서비스 | 비용 |
> |------|------|-------------|------|
> | **Gateway** | 라우트 테이블에 경로 추가 | Amazon S3, DynamoDB만 | 무료 |
> | **Interface** | 서브넷에 ENI(네트워크 인터페이스) 생성 | 대부분의 AWS 서비스 | 시간당 과금 |
>
> Secrets Manager는 **Interface** 유형입니다. 서비스를 선택하면 Type 열에서 확인할 수 있습니다.

55. **VPC** 드롭다운에서 본인의 VPC를 선택합니다 (예: `starter-vpc`).

> [!NOTE]
> **Additional settings** 섹션의 **Enable private DNS name**은 체크된 상태를 유지하세요 (기본값).  
> 이 설정이 켜져 있으면 VPC 내에서 Secrets Manager API를 호출할 때 자동으로 VPC Endpoint를 경유합니다.  
> 코드 변경 없이 기존 SDK 코드가 그대로 동작합니다.

56. **Subnets** 섹션에서 프라이빗 서브넷 2개를 선택합니다:
    - `ap-northeast-2a` → 드롭다운에서 **Private Subnet A** 선택
    - `ap-northeast-2c` → 드롭다운에서 **Private Subnet C** 선택

> [!WARNING]
> 각 AZ의 드롭다운에 퍼블릭/프라이빗 서브넷이 모두 표시됩니다.  
> 반드시 **private** 서브넷을 선택하세요. Lambda가 프라이빗 서브넷에 배치되므로 같은 서브넷에 Endpoint가 있어야 합니다.

57. **Security groups** 섹션에서 Security Group을 선택합니다.

> [!TIP]
> **CloudFormation으로 환경을 구축한 경우:** `starter-lambda-sg`를 선택하세요 (인바운드 443 이미 설정됨).
>
> **Step 4에서 직접 RDS를 만든 경우 (Lambda SG가 없는 경우):**  
> VPC 기본 Security Group (`default`)을 선택하세요.  
> VPC 기본 SG는 **같은 SG를 소스로 하는 모든 트래픽을 허용**하므로,  
> Lambda에도 같은 기본 SG가 적용되어 있으면 443 통신이 자동으로 허용됩니다.
>
> 만약 로테이션 설정 후 timeout 에러가 발생한다면, VPC Endpoint의 SG에 다음 인바운드 규칙을 추가하세요:
> - **Type**: HTTPS (443)
> - **Source**: VPC CIDR (`10.0.0.0/16`) 또는 Lambda에 적용된 SG

58. **Policy**는 `Full access` (기본값)를 유지합니다.

> [!NOTE]
> `Full access`는 VPC 내 모든 사용자/서비스가 이 Endpoint를 통해 Secrets Manager에 접근할 수 있다는 의미입니다.  
> 학습 환경에서는 이 설정으로 충분합니다. 프로덕션에서는 `Custom` 정책으로 특정 비밀만 허용할 수 있습니다.

59. **Tags** 섹션에서 [[Add new tag]]를 클릭하여 태그를 추가합니다:
    - `CreatedBy` = `admin-user`
    - `Step` = `step6`
    - `Session` = `6-2`

60. [[Create endpoint]] 버튼을 클릭합니다.

> [!OUTPUT]
> "Successfully created VPC endpoint vpce-xxxxxxxxx" 메시지가 표시됩니다.  
> Status가 `Available`이 되면 사용 가능합니다 (보통 1~2분 소요).

> [!WARNING]
> **VPC Endpoint 비용**: 시간당 과금됩니다 (크레딧에서 차감).  
> 최신 요금은 [AWS PrivateLink 요금 페이지](https://aws.amazon.com/privatelink/pricing/)를 확인하세요.  
> **실습 후 반드시 삭제하세요.** 리소스 정리 섹션에서 삭제 방법을 안내합니다.

### Amazon RDS용 비밀 생성

61. Secrets Manager 콘솔로 이동합니다 (상단 검색창에 `Secrets Manager` 입력).
62. [[Store a new secret]] 버튼을 클릭합니다.
63. **Secret type** 섹션에서 **Credentials for Amazon RDS database**를 선택합니다.

> [!TIP]
> **Credentials for Amazon RDS database**를 선택하면 Secrets Manager가 Amazon RDS와 직접 통합됩니다.  
> 자동 로테이션 시 Lambda가 Amazon RDS에 직접 접속하여 비밀번호를 변경할 수 있습니다.

64. **Credentials** 섹션에서 다음을 입력합니다:
    - **User name**: `admin`
    - **Password**: Amazon RDS 생성 시 설정한 마스터 비밀번호 (예: `MyPassword123!`)
65. **Encryption key**: `aws/secretsmanager` (기본값) 유지합니다.
66. **Database** 섹션에서 목록에 표시된 본인의 Amazon RDS 인스턴스를 선택합니다 (예: `starter-mysql`).

> [!WARNING]
> Database 목록에 Amazon RDS 인스턴스가 표시되지 않으면:
>
> - Amazon RDS 인스턴스가 같은 리전(ap-northeast-2)에 있는지 확인하세요.
> - Amazon RDS 인스턴스가 `Available` 상태인지 확인하세요.
> - IAM 사용자에 `rds:DescribeDBInstances` 권한이 있는지 확인하세요.

67. [[Next]] 버튼을 클릭합니다.
68. **Secret name** 필드에 `starter/prod/rds-auto-rotate`를 입력합니다.
69. **Description** 필드에 `RDS MySQL auto-rotation credentials`를 입력합니다.
70. **Tags** 섹션에서 [[Add tag]]를 클릭하고 다음을 추가합니다:
    - `CreatedBy` = `admin-user`
    - `Step` = `step6`
    - `Session` = `6-2`

71. [[Next]] 버튼을 클릭합니다.

### 자동 로테이션 활성화

72. **Configure rotation** 페이지에서 **Automatic rotation** 토글을 활성화합니다.
73. **Rotation schedule** 섹션에서 다음을 설정합니다:
    - **Schedule expression builder** 라디오 선택
    - **Time unit**: `Days` 선택
    - **Days**: `30` 입력 (30일마다 자동 로테이션)

> [!TIP]
> `Hours`로 설정하면 더 짧은 주기로 테스트할 수 있습니다 (예: 23시간).  
> **Window duration**은 빈칸으로 두면 됩니다 (기본값 사용).  
> **Rotate immediately when the secret is stored** 체크박스는 켜둔 상태를 유지하세요 — 저장 즉시 첫 로테이션이 실행됩니다.

74. **Rotation function** 섹션에서:
    - **Create a rotation function** 라디오를 선택합니다.
    - **Lambda rotation function** 이름 필드에 `mysql-rotation-lambda`를 입력합니다 (앞에 `SecretsManager` 접두사가 자동 추가됨).

> [!NOTE]
> 최종 Lambda 함수 이름은 `SecretsManagermysql-rotation-lambda`가 됩니다.  
> 이미 같은 이름의 함수가 있으면 다른 이름을 사용하세요.

75. **Rotation strategy** 섹션에서 `Single user`를 선택합니다 (기본값).

> [!CONCEPT] Rotation strategy 차이
>
> | 전략 | 설명 | 적합한 경우 |
> |------|------|-------------|
> | **Single user** | 비밀에 저장된 사용자가 직접 자신의 비밀번호를 변경 | 학습 환경, 단일 DB 사용자 |
> | **Alternating users** | 사용자를 복제(clone)하여 두 세트를 번갈아 사용 | 프로덕션 (다운타임 최소화) |
>
> Single user는 로테이션 중 짧은 순간 접속이 불가할 수 있지만, 설정이 간단합니다.  
> Alternating users는 별도 admin 자격 증명이 필요합니다.

76. **IAM permissions** 섹션에서 `Create default role`을 선택합니다 (기본값).

> [!NOTE]
> AWS가 Lambda에 필요한 IAM Role을 자동으로 생성합니다.  
> 이 Role에는 Secrets Manager API 호출, Amazon RDS 접근, VPC 네트워크 인터페이스 생성 권한이 포함됩니다.

77. [[Next]] 버튼을 클릭합니다.
78. **Review** 페이지에서 설정을 확인합니다.
79. [[Store]] 버튼을 클릭합니다.

> [!OUTPUT]
> 녹색 배너로 "You successfully stored the secret starter/prod/rds-auto-rotate" 메시지가 표시됩니다.  
> "AWS CloudFormation is setting up rotation resources, this can take up to 2 minutes to complete." 안내가 함께 표시됩니다.  
> Secrets 목록 페이지로 이동합니다.

> [!WARNING]
> 첫 번째 로테이션이 즉시 실행됩니다. 이 시점에서 Amazon RDS 비밀번호가 변경됩니다.  
> 기존 애플리케이션이 하드코딩된 비밀번호를 사용하고 있다면 접속이 끊길 수 있습니다.  
> 반드시 태스크 4의 Secrets Manager 연동을 먼저 적용한 후 로테이션을 설정하세요.

> [!CONCEPT] AWS가 자동으로 생성하는 리소스
>
> 로테이션을 설정하면 AWS가 내부적으로 다음 리소스를 자동 생성합니다:
>
> | 리소스 | 이름 예시 | 설명 |
> |--------|-----------|------|
> | Lambda 함수 | `SecretsManagermysql-rotation-lambda` | 비밀번호 변경 로직 실행 |
> | IAM Role | `SecretsManagermysql-rotation-lambda-role` | Lambda에 필요한 권한 |
> | CloudWatch Log Group | `/aws/lambda/SecretsManagermysql-rotation-lambda` | Lambda 실행 로그 저장 |
>
> **CloudWatch Log Group**은 Lambda가 처음 실행될 때 자동 생성됩니다.  
> 로테이션 실패 시 이 로그를 확인하면 원인을 파악할 수 있습니다.  
> Lambda를 삭제해도 Log Group은 남아있으므로, 리소스 정리 시 별도로 삭제해야 합니다.

### 로테이션 결과 확인

80. Secrets 목록에서 `starter/prod/rds-auto-rotate`를 클릭하여 상세 페이지로 이동합니다.
81. **Rotation configuration** 섹션을 확인합니다.
82. **Rotation status**가 `Enabled`로 표시되는지 확인합니다.
83. **Last rotated date**에 날짜/시간이 표시되면 첫 번째 로테이션이 완료된 것입니다.

> [!NOTE]
> 첫 번째 로테이션 완료까지 1~2분 소요될 수 있습니다. 페이지를 새로고침하여 확인하세요.

84. **Secret value** 섹션에서 [[Retrieve secret value]]를 클릭합니다.
85. `password` 값이 이전과 다른 자동 생성된 비밀번호로 변경되었는지 확인합니다.

> [!OUTPUT]
> password 값이 자동 생성된 복잡한 문자열로 변경되어 있습니다.  
> 예: `aB3$kL9mNp2!xYz7`  
> 이 비밀번호는 Lambda가 자동으로 생성하고 Amazon RDS에 적용한 것입니다.

✅ **태스크 완료**: Amazon RDS 비밀번호 자동 로테이션이 설정되었습니다.

> [!CONCEPT] 로테이션 후 애플리케이션 대응
>
> 로테이션이 실행되면 RDS 비밀번호가 자동으로 변경됩니다.  
> 하지만 Spring 앱의 `@PostConstruct`는 **시작 시 1회만** 값을 로드하므로, 로테이션 후 앱이 이전 비밀번호를 계속 사용합니다.
>
> | 대응 방법 | 설명 | 적합한 환경 |
> |-----------|------|-------------|
> | 앱 재시작 | 가장 단순. 재시작 시 새 비밀번호를 로드 | 학습, 소규모 |
> | 주기적 재조회 | 스케줄러로 N분마다 Secrets Manager 재조회 | 중규모 |
> | HikariCP 갱신 | 커넥션 풀의 password를 런타임에 교체 | 프로덕션 |
> | Spring Cloud AWS | `SecretsManagerPropertySource` 자동 갱신 | 프로덕션 (Spring Boot) |
>
> 학습 단계에서는 **로테이션 후 앱을 재시작**하면 됩니다.  
> ECS/EKS 환경에서는 롤링 재배포로 자연스럽게 처리됩니다.

> [!NOTE]
> **코드에서 비밀 이름 주의:**  
> 이 태스크에서는 학습 목적으로 별도 비밀(`starter/prod/rds-auto-rotate`)을 생성했습니다.  
> 실제 프로덕션에서는 **하나의 비밀에 로테이션을 설정**하고, 코드의 `secretId`도 그 비밀 이름을 가리키도록 합니다.  
> 태스크 4에서 작성한 `SecretsManagerService`의 `secretId`를 로테이션이 설정된 비밀 이름으로 맞춰야 합니다.

> [!TROUBLESHOOTING]
> | 증상 | 원인 | 해결 방법 |
> |------|------|-----------|
> | 로테이션 Lambda timeout (30초) | VPC Endpoint SG에 인바운드 443이 없음 | 아래 "SG 인바운드 추가" 가이드 참고 |
> | 로테이션 실패 (Lambda 에러) | Lambda가 Amazon RDS에 접근 불가 | Lambda의 VPC 설정 및 Security Group 확인 (RDS SG에 Lambda SG로부터 3306 인바운드 필요) |
> | `Rotation failed` 상태 | Amazon RDS 엔드포인트 변경 또는 네트워크 문제 | CloudWatch Logs에서 Lambda 로그 확인 (`/aws/lambda/SecretsManager*`) |
> | 앱 접속 끊김 | 로테이션 후 앱이 이전 비밀번호 사용 | 앱에서 Secrets Manager 재조회 로직 추가 또는 재시작 |
> | Lambda 함수 생성 실패 | VPC 서브넷에 ENI 생성 불가 | 서브넷에 사용 가능한 IP가 있는지 확인 |

> [!TIP]
> **Lambda timeout 해결 — Lambda의 Security Group 확인 및 변경:**
>
> 로테이션 Lambda가 자동 생성될 때 RDS용 SG(`starter-rds-sg`)가 할당됩니다.  
> 이 SG에는 443(HTTPS) 인바운드가 없어서 VPC Endpoint 통신이 차단될 수 있습니다.
>
> **방법 A: Lambda의 SG를 `starter-lambda-sg`로 변경** (권장)
>
> - Lambda 콘솔 → 생성된 로테이션 함수 클릭 (예: `SecretsManagermysql-rotation-lambda`)
> - **Configuration** 탭 → **VPC** 클릭
> - [[Edit]] 버튼 클릭
> - **Security groups** 섹션에서 기존 SG를 제거하고 `starter-lambda-sg` 선택
> - [[Save]] 버튼 클릭
>
> `starter-lambda-sg`는 RDS SG의 인바운드 소스로도 등록되어 있으므로 RDS 접속도 정상 동작합니다.
>
> **방법 B: VPC Endpoint SG에 인바운드 443 추가**
>
> Lambda SG를 변경하지 않고, VPC Endpoint에 적용된 SG에 인바운드를 추가하는 방법입니다:
>
> - VPC 콘솔 → 왼쪽 메뉴 **Security Groups** 클릭
> - VPC Endpoint에 적용한 SG 클릭 (예: `starter-lambda-sg`)
> - **Inbound rules** 탭 → [[Edit inbound rules]] 클릭
> - [[Add rule]] 클릭 → **Type**: `HTTPS`, **Source**: `10.0.0.0/16` (VPC CIDR) 입력
> - [[Save rules]] 클릭
>
> **변경 후 로테이션 재시도:**
>
> - Secrets Manager 콘솔 → `starter/prod/rds-auto-rotate` 클릭
> - **Rotation** 탭 → [[Edit rotation]] 클릭
> - **Rotate immediately when the secret is stored** 체크
> - [[Save]] 클릭
> - 1~2분 후 **Last rotated date**에 시간이 표시되면 성공

---

## 마무리

다음을 성공적으로 수행했습니다:

- Secrets Manager와 Parameter Store의 차이를 비교했습니다.
- Secrets Manager에 DB 자격 증명을 콘솔에서 저장하고 조회했습니다.
- AWS CLI로 비밀을 생성, 조회, 업데이트했습니다.
- Spring 프로젝트(Boot/MVC)에서 Secrets Manager 값을 조회하여 DataSource를 설정했습니다.
- VPC Endpoint를 생성하여 프라이빗 서브넷에서 AWS 서비스에 접근하는 방법을 학습했습니다.
- Amazon RDS 비밀번호 자동 로테이션을 설정했습니다 (선택).

### 비밀 유형별 비교 정리

이 실습에서 두 가지 Secret type을 사용했습니다. 차이를 정리합니다:

| 항목 | Other type of secret (태스크 2) | Credentials for Amazon RDS database (태스크 5) |
|------|------|------|
| 용도 | 범용 키-값 쌍 저장 | Amazon RDS 전용 자격 증명 |
| 값 형식 | 자유 JSON (key 직접 정의) | AWS가 `engine`, `host`, `dbInstanceIdentifier` 등 자동 추가 |
| 자동 로테이션 | ❌ 직접 Lambda 작성 필요 | ✅ AWS 제공 템플릿 Lambda로 원클릭 설정 |
| DB 연결 테스트 | ❌ 미지원 | ✅ 로테이션 시 자동 접속 검증 |
| 코드에서 사용 | `getSecretValue` → JSON 직접 파싱 | 동일 |
| 비밀번호 변경 시 | 수동 `update-secret` | Lambda가 자동 생성 + RDS에 적용 |
| 적합한 경우 | API 키, 토큰, 커스텀 설정 | DB 비밀번호 자동 교체가 필요할 때 |

> [!TIP]
> **어떤 걸 선택할까?**
>
> - DB 비밀번호를 **수동으로 관리**하면서 코드에 하드코딩만 피하고 싶다 → **Other type of secret**
> - DB 비밀번호를 **자동으로 주기적 교체**하고 싶다 → **Credentials for Amazon RDS database**
> - 둘 다 가능하지만, 자동 로테이션은 VPC Endpoint + Lambda + Security Group 설정이 추가로 필요합니다.

> [!NOTE]
> **다음 단계 안내**  
> Session 6-3 셀프 미션에서는 지금까지 학습한 Parameter Store + Secrets Manager를 활용하여 **Amazon EC2에 실제 배포**하는 통합 실습을 진행합니다.  
> Step 2~6의 내용을 종합 복습할 수 있는 기회입니다.

---

# 🗑️ 리소스 정리

> [!WARNING]
> **실습 후 반드시 아래 리소스를 삭제하세요.** 삭제하지 않으면 지속적으로 과금됩니다.
>
> | 리소스                         | 비용              | 삭제 방법              |
> | ------------------------------ | ----------------- | ---------------------- |
> | `starter/prod/db-credentials`  | 비밀당 월 과금    | CLI 즉시 삭제 권장     |
> | `starter/prod/api-keys`        | 비밀당 월 과금    | CLI 즉시 삭제 권장     |
> | `starter/prod/rds-auto-rotate` | 비밀당 월 과금    | CLI 즉시 삭제 권장     |
> | Lambda (로테이션용)            | 무료 티어 내      | 콘솔에서 삭제          |
> | CloudWatch Log Group           | 소량이면 무료     | 콘솔에서 삭제          |
> | VPC Endpoint (Secrets Manager) | 시간당 과금       | 콘솔에서 삭제          |
> | CloudFormation 스택 (RDS 포함) | RDS 시간당 과금   | 스택 삭제로 일괄 정리  |
>
> 콘솔 삭제는 7일 대기 기간이 있어 그 동안에도 과금됩니다. **CLI 즉시 삭제를 권장합니다.**

> [!NOTE]
> 삭제 순서 (의존 관계):
>
> ```
> 삭제 순서: Secrets → Lambda → Log Group → VPC Endpoint → CloudFormation 스택
>
>   (1) Secrets Manager 비밀 즉시 삭제
>   (2) Lambda 함수 삭제
>   (3) CloudWatch Log Group 삭제
>   (4) VPC Endpoint 삭제
>   (5) IAM Role 삭제
>   (6) CloudFormation 스택 삭제 (사용한 경우)
> ```

---

### 단계 1: Tag Editor로 리소스 확인

1. 상단 검색창에 `Resource Groups & Tag Editor`를 입력하고 선택합니다.
2. 왼쪽 메뉴에서 **Tag Editor**를 선택합니다.
3. 다음 조건으로 검색합니다:
    - **Regions**: `ap-northeast-2`
    - **Tag key**: `Session`, **Tag value**: `6-2`
4. [[Search resources]] 버튼을 클릭합니다.

> [!OUTPUT]
> 이 실습에서 생성한 리소스 목록이 표시됩니다 (Secrets Manager 비밀 등).

---

### 단계 2: CLI로 비밀 즉시 삭제 (권장)

> [!WARNING]
> `--force-delete-without-recovery` 옵션을 사용하면 **되돌릴 수 없습니다**.  
> 삭제 전에 비밀 값이 다른 곳에 백업되어 있는지 확인하세요.  
> 실습용 비밀이므로 즉시 삭제해도 문제없습니다.

복구 기간 없이 즉시 삭제하여 과금을 즉시 중단합니다.

5. 터미널에서 다음 명령어를 실행합니다:

```bash
aws secretsmanager delete-secret \
  --secret-id "starter/prod/db-credentials" \
  --force-delete-without-recovery \
  --region ap-northeast-2
```

> [!OUTPUT]
>
> ```json
> {
>   "ARN": "arn:aws:secretsmanager:ap-northeast-2:123456789012:secret:starter/prod/db-credentials-XyZaBc",
>   "Name": "starter/prod/db-credentials",
>   "DeletionDate": "2025-01-15T10:50:00+09:00"
> }
> ```

6. 두 번째 비밀을 삭제합니다:

```bash
aws secretsmanager delete-secret \
  --secret-id "starter/prod/api-keys" \
  --force-delete-without-recovery \
  --region ap-northeast-2
```

7. 태스크 5를 진행한 경우, 세 번째 비밀도 삭제합니다:

```bash
aws secretsmanager delete-secret \
  --secret-id "starter/prod/rds-auto-rotate" \
  --force-delete-without-recovery \
  --region ap-northeast-2
```

---

### 단계 3: 콘솔에서 비밀 삭제 (대안)

CLI를 사용하지 않는 경우 콘솔에서 삭제합니다.   
단, 최소 7일의 복구 기간이 있으며 그 동안에도 과금됩니다.

8. Secrets Manager 콘솔에서 삭제할 비밀을 클릭하여 상세 페이지로 이동합니다.
9. 우측 상단의 **Actions** 드롭다운을 클릭합니다.
10. [[Delete secret]]을 선택합니다.
11. **Waiting period** 필드에 `7` (최소 대기 기간)을 입력합니다.
12. [[Schedule deletion]] 버튼을 클릭합니다.

> [!OUTPUT]
> 비밀 상태가 "Scheduled for deletion" 으로 변경됩니다.
> 7일 후 자동으로 영구 삭제됩니다.

13. 나머지 비밀들도 동일하게 삭제를 예약합니다.

---

### 단계 4: Lambda 로테이션 함수 삭제 (태스크 5 진행한 경우)

14. 상단 검색창에 `Lambda`를 입력하고 **Lambda** 서비스를 선택합니다.
15. Functions 목록에서 `SecretsManagermysql-rotation-lambda` 함수를 클릭합니다.
16. 우측 상단의 **Actions** 드롭다운을 클릭합니다.
17. [[Delete]]을 선택합니다.
18. 확인 팝업에서 `confirm`를 입력하고 [[Delete]] 버튼을 클릭합니다.

> [!OUTPUT]
> "Successfully deleted function: SecretsManagermysql-rotation-lambda" 메시지가 표시됩니다.

---

### 단계 5: CloudWatch Log Group 삭제 (태스크 5 진행한 경우)

19. 상단 검색창에 `CloudWatch`를 입력하고 **CloudWatch** 서비스를 선택합니다.
20. 왼쪽 메뉴에서 **Logs** → **Log groups**를 클릭합니다.
21. 검색창에 `SecretsManager`를 입력합니다.
22. `/aws/lambda/SecretsManagermysql-rotation-lambda` 로그 그룹을 선택합니다 (체크박스 클릭).
23. **Actions** → [[Delete log group(s)]]를 클릭합니다.
24. 확인 팝업에서 [[Delete]]를 클릭합니다.

> [!OUTPUT]
> 로그 그룹이 삭제됩니다.

> [!NOTE]
> Lambda가 실행될 때 CloudWatch에 자동으로 로그 그룹이 생성됩니다.  
> Lambda를 삭제해도 로그 그룹은 남아있으므로 별도로 삭제해야 합니다.

---

### 단계 6: IAM Role 삭제 (태스크 5 진행한 경우)

> [!NOTE]
> 로테이션 설정 시 AWS가 자동으로 CloudFormation 스택(`SecretsManagerRDSMySQLRotationSingleUser...`)을 생성합니다.  
> 이 스택은 Lambda, IAM Role, Security Group 인바운드 규칙 등을 포함합니다.  
> **비밀 삭제 후에도 이 스택이 남아있을 수 있으므로**, CloudFormation 콘솔에서 확인하고 삭제하세요.
>
> - CloudFormation → Stacks → `SecretsManagerRDSMySQLRotation...` 스택 선택 → [[Delete stack]]
> - NESTED 스택이 있으면 상위 스택만 삭제하면 하위도 자동 삭제됩니다.

25. 상단 검색창에 `IAM`을 입력하고 **IAM** 서비스를 선택합니다.
26. 왼쪽 메뉴에서 **Roles**를 선택합니다.
27. 검색창에 `SecretsManager`를 입력합니다.
28. `SecretsManagermysql-rotation-lambda` 관련 Role을 선택합니다 (체크박스 클릭).
29. [[Delete]] 버튼을 클릭합니다.
30. 확인 필드에 Role 이름을 입력하고 [[Delete]] 버튼을 클릭합니다.

> [!OUTPUT]
> Role이 삭제됩니다.

---

### 단계 7: VPC Endpoint 삭제 (태스크 5 진행한 경우)

31. 상단 검색창에 `VPC`를 입력하고 **VPC** 서비스를 선택합니다.
32. 왼쪽 메뉴에서 **Endpoints**를 클릭합니다.
33. `starter-secretsmanager-endpoint`를 선택합니다 (체크박스 클릭).
34. **Actions** → [[Delete VPC endpoints]]를 클릭합니다.
35. 확인 필드에 `delete`를 입력하고 [[Delete]] 버튼을 클릭합니다.

> [!OUTPUT]
> Endpoint 상태가 "Deleting"으로 변경됩니다. 몇 분 후 목록에서 사라집니다.

---

### 단계 8: CloudFormation 스택 삭제 (CloudFormation으로 RDS를 생성한 경우)

36. 상단 검색창에 `CloudFormation`을 입력하고 선택합니다.
37. Stacks 목록에서 `step6-rds-rotation-lab`을 선택합니다.
38. [[Delete]] 버튼을 클릭합니다.
39. 확인 팝업에서 [[Delete stack]]을 클릭합니다.

> [!OUTPUT]
> 스택 상태가 `DELETE_IN_PROGRESS`로 변경됩니다. RDS 삭제 포함 5~10분 소요됩니다.  
> 완료되면 스택이 목록에서 사라지고, VPC + RDS + Security Group 등 모든 리소스가 함께 삭제됩니다.

> [!NOTE]
> CloudFormation을 사용하지 않고 Step 4에서 직접 만든 Amazon RDS라면 이 단계는 건너뛰세요.  
> Amazon RDS를 유지할지 삭제할지는 본인 판단에 따릅니다.  
> 삭제하려면 [Step 4-1 리소스 정리](/week/4/session/1) 가이드의 삭제 섹션을 참고하세요.

---

### 단계 9: Tag Editor로 최종 확인

40. 상단 검색창에 `Resource Groups & Tag Editor`를 입력하고 선택합니다.
41. 왼쪽 메뉴에서 **Tag Editor**를 선택합니다.
42. Regions: `ap-northeast-2`, Tag key: `Session`, Tag value: `6-2`로 검색합니다.
43. 검색 결과가 없으면 모든 리소스가 정리된 것입니다.

> [!TIP]
> `Step: step6`으로도 추가 검색하여 이 Step의 다른 세션에서 생성한 리소스도 함께 확인하세요.

44. 터미널에서도 비밀이 모두 삭제되었는지 확인합니다:

```bash
aws secretsmanager list-secrets \
  --query "SecretList[?starts_with(Name, 'starter/')].[Name,DeletedDate]" \
  --output table \
  --region ap-northeast-2
```

> [!OUTPUT]
> 즉시 삭제한 경우: 결과가 비어있습니다 (모든 비밀 삭제 완료).  
> 예약 삭제한 경우: DeletedDate 열에 삭제 예정 날짜가 표시됩니다.

| 문제                                    | 원인                                | 해결                                              |
| --------------------------------------- | ----------------------------------- | ------------------------------------------------- |
| `You can't delete secret ... scheduled` | 이미 삭제 예약됨                    | 정상 상태, 대기 기간 후 자동 삭제                 |
| `AccessDeniedException`                 | IAM 권한 부족                       | `secretsmanager:DeleteSecret` 권한 확인           |
| 삭제 후에도 과금 발생                   | 콘솔 삭제는 7일 대기 기간 동안 과금 | CLI `--force-delete-without-recovery`로 즉시 삭제 |
| Lambda 삭제 후 로테이션 에러 알림       | 비밀에 로테이션 설정이 남아있음     | 비밀을 먼저 삭제하면 문제없음 (순서 준수)         |

✅ **실습 종료**: 모든 리소스(Secrets Manager 비밀, Lambda 함수, IAM Role)가 정리되었습니다.

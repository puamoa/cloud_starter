---
title: 'Amazon RDS Parameter Group (시간대·Connection 설정)'
week: 4
session: 2
awsServices:
  - Amazon RDS
learningObjectives:
  - 기본 Parameter Group을 수정할 수 없는 이유를 설명할 수 있습니다.
  - 커스텀 Parameter Group을 생성하고 시간대, 문자셋을 설정할 수 있습니다.
  - max_connections 계산법을 이해하고 적절한 값을 설정할 수 있습니다.
  - Spring Boot HikariCP 커넥션 풀 설정과 RDS 설정을 연계할 수 있습니다.
prerequisites:
  - AWS 계정 생성 완료
  - RDS MySQL 인스턴스 실행 중 (Step 4-1 참조)
estimatedCost: 무료 (Parameter Group 변경은 비용 없음)
---

이 실습에서는 RDS의 Parameter Group을 커스터마이징합니다. 시간대를 Asia/Seoul로 변경하고, 문자셋을 utf8mb4로 설정하며, max_connections를 애플리케이션 요구에 맞게 조정합니다.

> [!NOTE]
> 이 실습은 RDS MySQL 인스턴스가 필요합니다. Step 4-1에서 생성한 RDS(`my-rds-mysql`)를 사용하거나, 기존 RDS 인스턴스를 사용합니다.

## 태스크 1: Parameter Group 개념 이해

> [!CONCEPT] Parameter Group
> Parameter Group은 RDS 인스턴스의 데이터베이스 엔진 설정을 관리하는 컨테이너입니다. MySQL의 `my.cnf` 파일에 해당하는 설정을 AWS 콘솔에서 관리합니다.
>
> **핵심 규칙:**
>
> - **기본 Parameter Group은 수정 불가**: AWS가 제공하는 기본 그룹(`default.mysql8.0`)은 읽기 전용
> - **커스텀 Parameter Group 필요**: 설정을 변경하려면 커스텀 그룹을 생성해야 함
> - **적용 방식**: Dynamic 파라미터는 즉시 적용, Static 파라미터는 재부팅 필요
> - **버전별 관리**: MySQL 8.0용, 8.1용 등 엔진 버전별로 별도 관리

### 기본 Parameter Group을 수정할 수 없는 이유

| 이유         | 설명                                                   |
| ------------ | ------------------------------------------------------ |
| 안전성       | 기본값을 보존하여 문제 발생 시 원복 기준점 제공        |
| 공유 리소스  | 여러 RDS 인스턴스가 동일한 기본 그룹을 참조할 수 있음  |
| AWS 업데이트 | AWS가 엔진 업데이트 시 기본 그룹의 값을 조정할 수 있음 |
| 모범 사례    | 인스턴스별/환경별 설정을 분리하여 관리                 |

1. AWS Management Console에 로그인합니다.
2. 리전을 **Asia Pacific (Seoul) ap-northeast-2**로 설정합니다.
3. 상단 검색창에 `RDS`를 입력하고 RDS 서비스를 선택합니다.
4. 왼쪽 메뉴에서 **Parameter groups**를 선택합니다.
5. `default.mysql8.0` 그룹을 클릭하여 파라미터 목록을 확인합니다.

> [!NOTE]
> 기본 Parameter Group의 파라미터를 클릭하면 값을 볼 수 있지만, 수정 버튼이 비활성화되어 있습니다.

✅ **태스크 완료**: Parameter Group의 개념을 이해했습니다.

## 태스크 2: 커스텀 Parameter Group 생성

6. 왼쪽 메뉴에서 **Parameter groups**를 선택합니다.
7. [[Create parameter group]] 버튼을 클릭합니다.
8. 다음과 같이 설정합니다:
   - **Parameter group family**: `mysql8.0`
   - **Type**: `DB Parameter Group`
   - **Group name**: `my-mysql80-params`
   - **Description**: `Custom parameter group for MySQL 8.0 - timezone, charset, connections`
9. [[Create]] 버튼을 클릭합니다.

> [!OUTPUT]
> Parameter Group이 생성됩니다. 이제 이 그룹의 파라미터를 수정할 수 있습니다.

✅ **태스크 완료**: 커스텀 Parameter Group이 생성되었습니다.

## 태스크 3: 시간대 설정 (time_zone)

10. Parameter groups 목록에서 `my-mysql80-params`를 클릭합니다.
11. 검색창에 `time_zone`을 입력합니다.
12. `time_zone` 파라미터를 선택합니다.
13. [[Edit parameters]] 버튼을 클릭합니다.
14. `time_zone`의 값을 `Asia/Seoul`로 변경합니다.

> [!NOTE]
> RDS MySQL의 기본 시간대는 UTC입니다. 한국 서비스라면 `Asia/Seoul`(UTC+9)로 변경하는 것이 일반적입니다. 단, 글로벌 서비스라면 UTC를 유지하고 애플리케이션에서 변환하는 것이 좋습니다.

15. [[Save changes]] 버튼을 클릭합니다.

> [!TIP]
> `time_zone`은 **Dynamic** 파라미터입니다. RDS를 재부팅하지 않아도 Parameter Group을 적용하면 즉시 반영됩니다.

✅ **태스크 완료**: 시간대가 Asia/Seoul로 설정되었습니다.

## 태스크 4: 문자셋 설정 (utf8mb4)

> [!CONCEPT] utf8mb4
> MySQL의 `utf8`은 실제로 3바이트까지만 지원하여 이모지(😀)를 저장할 수 없습니다. `utf8mb4`는 4바이트를 지원하여 모든 유니코드 문자를 저장할 수 있습니다. 새 프로젝트에서는 항상 `utf8mb4`를 사용하세요.

16. `my-mysql80-params` 파라미터 목록에서 [[Edit parameters]] 버튼을 클릭합니다.
17. 검색창을 활용하여 다음 파라미터들을 변경합니다:

| 파라미터                   | 값                   | 설명                     |
| -------------------------- | -------------------- | ------------------------ |
| `character_set_client`     | `utf8mb4`            | 클라이언트 문자셋        |
| `character_set_connection` | `utf8mb4`            | 연결 문자셋              |
| `character_set_database`   | `utf8mb4`            | 데이터베이스 기본 문자셋 |
| `character_set_results`    | `utf8mb4`            | 결과 문자셋              |
| `character_set_server`     | `utf8mb4`            | 서버 기본 문자셋         |
| `collation_connection`     | `utf8mb4_unicode_ci` | 연결 정렬 규칙           |
| `collation_server`         | `utf8mb4_unicode_ci` | 서버 기본 정렬 규칙      |

> [!TIP]
> 파라미터가 많으므로 검색창에 `character_set`을 입력하면 관련 파라미터를 한 번에 볼 수 있습니다. `collation`도 마찬가지입니다.

18. [[Save changes]] 버튼을 클릭합니다.

✅ **태스크 완료**: 문자셋이 utf8mb4로 설정되었습니다.

## 태스크 5: max_connections 설정

> [!CONCEPT] max_connections 계산법
> `max_connections`는 RDS가 동시에 허용하는 최대 연결 수입니다.
>
> **계산 공식:**
>
> ```
> max_connections = (서버 수 × 커넥션 풀 크기) + 여유분
> ```
>
> **예시:**
>
> - EC2 서버 2대 × HikariCP 풀 크기 10 = 20
> - 여유분 (관리자 접속, 모니터링 등): 10
> - **총 필요: 30**
>
> **db.t3.micro 기본값:**
> RDS는 인스턴스 메모리를 기반으로 기본 max_connections를 계산합니다:
>
> ```
> {DBInstanceClassMemory/12582880}
> ```
>
> db.t3.micro (1GB RAM): 약 66개

19. `my-mysql80-params`에서 [[Edit parameters]] 버튼을 클릭합니다.
20. 검색창에 `max_connections`를 입력합니다.
21. `max_connections`의 값을 `100`으로 변경합니다.

> [!NOTE]
> db.t3.micro의 기본값은 약 66입니다. 학습 환경에서는 100 정도면 충분합니다. 운영 환경에서는 위 계산 공식에 따라 설정하세요.

> [!WARNING]
> max_connections를 너무 높게 설정하면 메모리 부족으로 RDS가 불안정해질 수 있습니다. 각 연결은 약 10-20MB의 메모리를 사용합니다. db.t3.micro(1GB)에서는 150을 넘기지 않는 것이 좋습니다.

22. [[Save changes]] 버튼을 클릭합니다.

✅ **태스크 완료**: max_connections가 100으로 설정되었습니다.

## 태스크 6: Parameter Group을 RDS에 적용

23. 왼쪽 메뉴에서 **Databases**를 선택합니다.
24. `my-rds-mysql`을 선택합니다.
25. [[Modify]] 버튼을 클릭합니다.
26. **Additional configuration** 섹션에서:
    - **DB parameter group**: `my-mysql80-params` 선택
27. 페이지 하단의 [[Continue]] 버튼을 클릭합니다.
28. **Schedule of modifications**에서:
    - `Apply immediately` 선택
29. [[Modify DB instance]] 버튼을 클릭합니다.

> [!NOTE]
> Parameter Group을 변경하면 RDS 상태가 `Modifying`으로 변경됩니다. Dynamic 파라미터는 즉시 적용되지만, Static 파라미터는 재부팅이 필요합니다.

### RDS 재부팅

30. `my-rds-mysql`을 선택합니다.
31. **Actions** → **Reboot**를 선택합니다.
32. [[Confirm]] 버튼을 클릭합니다.

> [!WARNING]
> 재부팅 중에는 RDS에 접속할 수 없습니다. 약 1-3분 소요됩니다. 운영 환경에서는 점검 시간에 진행하세요.

33. 상태가 다시 `Available`이 될 때까지 기다립니다.

✅ **태스크 완료**: Parameter Group이 RDS에 적용되었습니다.

## 태스크 7: 설정 확인

34. EC2에서 RDS에 접속합니다:

```bash
mysql -h my-rds-mysql.xxxxxxxxxxxx.ap-northeast-2.rds.amazonaws.com -u admin -p
```

35. 시간대를 확인합니다:

```sql
SELECT NOW();
SELECT @@global.time_zone, @@session.time_zone;
```

> [!OUTPUT]
>
> ```
> +---------------------+
> | NOW()               |
> +---------------------+
> | 2024-xx-xx xx:xx:xx |  ← 한국 시간 (UTC+9)
> +---------------------+
>
> +--------------------+---------------------+
> | @@global.time_zone | @@session.time_zone |
> +--------------------+---------------------+
> | Asia/Seoul         | Asia/Seoul          |
> +--------------------+---------------------+
> ```

36. 문자셋을 확인합니다:

```sql
SHOW VARIABLES LIKE 'character_set%';
SHOW VARIABLES LIKE 'collation%';
```

> [!OUTPUT]
>
> ```
> +--------------------------+---------+
> | Variable_name            | Value   |
> +--------------------------+---------+
> | character_set_client     | utf8mb4 |
> | character_set_connection | utf8mb4 |
> | character_set_database   | utf8mb4 |
> | character_set_results    | utf8mb4 |
> | character_set_server     | utf8mb4 |
> +--------------------------+---------+
> ```

37. max_connections를 확인합니다:

```sql
SHOW VARIABLES LIKE 'max_connections';
```

> [!OUTPUT]
>
> ```
> +-----------------+-------+
> | Variable_name   | Value |
> +-----------------+-------+
> | max_connections | 100   |
> +-----------------+-------+
> ```

38. MySQL을 종료합니다:

```sql
EXIT;
```

✅ **태스크 완료**: 모든 파라미터가 올바르게 적용되었습니다.

## 태스크 8: Spring Boot HikariCP 설정 연계

> [!CONCEPT] HikariCP 커넥션 풀
> Spring Boot는 기본적으로 HikariCP를 커넥션 풀로 사용합니다. 커넥션 풀은 DB 연결을 미리 생성해두고 재사용하여 성능을 향상시킵니다.
>
> **핵심 설정:**
>
> - `maximum-pool-size`: 풀에서 유지하는 최대 연결 수
> - `minimum-idle`: 유휴 상태로 유지하는 최소 연결 수
> - `connection-timeout`: 연결 획득 대기 시간
> - `max-lifetime`: 연결의 최대 수명

아래는 RDS 설정에 맞춘 Spring Boot `application.yml` 예시입니다:

```yaml
spring:
  datasource:
    url: jdbc:mysql://my-rds-mysql.xxxxxxxxxxxx.ap-northeast-2.rds.amazonaws.com:3306/appdb?useSSL=false&serverTimezone=Asia/Seoul&characterEncoding=UTF-8
    username: admin
    password: Admin1234!
    driver-class-name: com.mysql.cj.jdbc.Driver

    hikari:
      maximum-pool-size: 10
      minimum-idle: 5
      connection-timeout: 3000
      max-lifetime: 1800000
      idle-timeout: 600000
      pool-name: MyHikariPool
      connection-test-query: SELECT 1
```

> [!NOTE]
> **max_connections와 HikariCP 관계:**
>
> ```
> RDS max_connections (100)
>   ├── EC2 서버 1: HikariCP pool-size 10
>   ├── EC2 서버 2: HikariCP pool-size 10
>   ├── EC2 서버 3: HikariCP pool-size 10
>   ├── 관리자 접속 여유분: 10
>   └── 남은 여유: 60
> ```
>
> 서버가 늘어날 것을 고려하여 max_connections에 여유를 두세요.

> [!WARNING]
> `maximum-pool-size`를 너무 크게 설정하면:
>
> - 서버 여러 대가 동시에 연결하면 max_connections 초과 → `Too many connections` 에러
> - 각 연결이 메모리를 차지하므로 EC2 메모리 부족 가능
>
> 일반적으로 서버당 10-20이 적당합니다.

### 운영 환경 설정 가이드

| 환경     | 서버 수 | pool-size | max_connections | 여유분 |
| -------- | ------- | --------- | --------------- | ------ |
| 개발     | 1대     | 5         | 30              | 25     |
| 스테이징 | 2대     | 10        | 50              | 30     |
| 운영     | 3대     | 15        | 100             | 55     |
| 대규모   | 10대    | 20        | 300             | 100    |

✅ **태스크 완료**: Spring Boot HikariCP 설정 방법을 이해했습니다.

## 마무리

다음을 성공적으로 수행했습니다:

- 기본 Parameter Group을 수정할 수 없는 이유를 이해했습니다.
- 커스텀 Parameter Group을 생성했습니다.
- time_zone을 Asia/Seoul로 설정했습니다.
- character_set을 utf8mb4로 통일했습니다.
- max_connections를 계산하고 설정했습니다.
- RDS에 Parameter Group을 적용하고 재부팅했습니다.
- Spring Boot HikariCP 설정과의 연계를 이해했습니다.

# 🗑️ 리소스 정리

> [!NOTE]
> 이 실습에서 생성한 리소스는 모두 무료이므로 삭제하지 않아도 비용이 발생하지 않습니다. RDS 인스턴스 자체의 비용은 Step 4-1을 참조하세요.

---

### 단계 1: Parameter Group 삭제 (선택)

Parameter Group은 RDS 인스턴스에서 분리한 후에만 삭제할 수 있습니다.

1. RDS 콘솔 → **Databases** → `my-rds-mysql` 선택 → [[Modify]]
2. **Additional configuration** 섹션에서 **DB parameter group**을 `default.mysql8.0`으로 변경합니다.
3. **Schedule of modifications**: `Apply immediately` 선택 → [[Continue]] → [[Modify DB instance]]
4. RDS 상태가 `Available`이 되면 **Actions** → [[Reboot]] → [[Confirm]]

> [!NOTE]
> Parameter Group을 기본값으로 되돌리면 시간대가 UTC로, 문자셋이 기본값으로 복원됩니다. 재부팅이 필요합니다.

5. RDS 콘솔 → **Parameter groups** → `my-mysql80-params` 선택 → **Actions** → [[Delete]] → 확인

---

### 단계 2: RDS 인스턴스 정리

RDS 인스턴스 자체를 삭제하려면 **Step 4-1의 리소스 정리** 섹션을 참조하세요.

---

### 단계 3: 삭제 확인

1. Parameter groups 목록에서 `my-mysql80-params`가 없는지 확인합니다.

> [!TIP]
> 커스텀 Parameter Group은 여러 RDS 인스턴스에 재사용할 수 있습니다. 팀 표준 설정으로 유지하면 새 RDS 생성 시 바로 적용할 수 있어 편리합니다.

✅ **실습 종료**: 모든 리소스가 정리되었습니다.

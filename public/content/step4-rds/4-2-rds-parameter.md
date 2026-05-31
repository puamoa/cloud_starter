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
> 이 실습은 RDS MySQL 인스턴스가 필요합니다. Step 4-1에서 생성한 RDS(`my-rds-mysql`)를 사용합니다.
> EC2에서 RDS에 접속하여 설정을 확인하는 단계가 있으므로, Step 2-1의 EC2 인스턴스도 실행 중이어야 합니다.

## 태스크 1: Parameter Group 개념 이해

> [!CONCEPT] Parameter Group이란?
> Parameter Group은 RDS 인스턴스의 데이터베이스 엔진 설정을 관리하는 컨테이너입니다.
> MySQL을 직접 설치하면 `my.cnf`(또는 `my.ini`) 파일에서 설정을 변경하지만,
> RDS는 서버에 직접 접근할 수 없으므로 Parameter Group을 통해 설정을 관리합니다.
>
> **핵심 규칙:**
>
> - **기본 Parameter Group은 수정 불가**: AWS가 제공하는 기본 그룹(`default.mysql8.0`)은 읽기 전용
> - **커스텀 Parameter Group 필요**: 설정을 변경하려면 반드시 커스텀 그룹을 생성해야 함
> - **버전별 관리**: MySQL 8.0용, 8.4용 등 엔진 버전별로 별도 관리됨

> [!CONCEPT] Dynamic vs Static 파라미터
> Parameter Group의 파라미터는 적용 방식에 따라 두 종류로 나뉩니다:
>
> | 구분    | 적용 시점                      | 예시                                                |
> | ------- | ------------------------------ | --------------------------------------------------- |
> | Dynamic | Parameter Group 적용 즉시 반영 | `time_zone`, `character_set_*`, `max_connections`   |
> | Static  | RDS 재부팅(Reboot) 후에만 반영 | `innodb_buffer_pool_size`, `lower_case_table_names` |
>
> Dynamic 파라미터만 변경했더라도, 확실한 적용을 위해 재부팅하는 것이 모범 사례입니다.
> 콘솔에서 각 파라미터의 **Apply type** 열을 보면 Dynamic/Static 여부를 확인할 수 있습니다.

### 기본 Parameter Group을 수정할 수 없는 이유

| 이유         | 설명                                                   |
| ------------ | ------------------------------------------------------ |
| 안전성       | 기본값을 보존하여 문제 발생 시 원복 기준점 제공        |
| 공유 리소스  | 여러 RDS 인스턴스가 동일한 기본 그룹을 참조할 수 있음  |
| AWS 업데이트 | AWS가 엔진 업데이트 시 기본 그룹의 값을 조정할 수 있음 |
| 모범 사례    | 인스턴스별/환경별 설정을 분리하여 관리                 |

### 상세 단계

1. AWS Management Console에 로그인합니다.
2. 우측 상단에서 리전을 **Asia Pacific (Seoul) ap-northeast-2**로 설정합니다.
3. 상단 검색창에 `RDS`를 입력하고 **RDS** 서비스를 선택합니다.
4. 왼쪽 메뉴에서 **Parameter groups**를 선택합니다.
5. 목록에서 `default.mysql8.0` 그룹 이름을 클릭합니다.
6. 파라미터 목록이 표시됩니다. 상단의 검색창에 `time_zone`을 입력합니다.
7. `time_zone` 파라미터가 표시되지만, **Values** 열이 `engine-default`로 되어 있고 수정할 수 없는 것을 확인합니다.

> [!TIP]
> 기본 Parameter Group에서 [[Edit parameters]] 버튼을 클릭해도 값을 변경할 수 없습니다.
> "This parameter group cannot be modified because it is a default parameter group" 메시지가 표시됩니다.
> 이것이 커스텀 Parameter Group을 생성해야 하는 이유입니다.

8. 왼쪽 메뉴에서 **Parameter groups**를 클릭하여 목록으로 돌아갑니다.

> [!OUTPUT]
> Parameter groups 목록에 `default.mysql8.0`이 표시됩니다.
> Type 열에 `DB Parameter Group`으로 표시되며, Description에 `Default parameter group for mysql8.0`이라고 되어 있습니다.

✅ **태스크 완료**: 기본 Parameter Group이 읽기 전용임을 확인했습니다.

## 태스크 2: 커스텀 Parameter Group 생성

> [!CONCEPT] 커스텀 Parameter Group
> 커스텀 Parameter Group은 기본 그룹을 복사한 뒤 원하는 값을 수정할 수 있는 그룹입니다.
> 생성 시 기본 그룹의 모든 파라미터 값이 복사되며, 이후 개별 파라미터를 자유롭게 변경할 수 있습니다.
>
> **네이밍 규칙 권장:**
>
> - `{프로젝트}-{엔진}{버전}-{환경}` 형식
> - 예: `myapp-mysql80-prod`, `myapp-mysql80-dev`
> - 이 실습에서는 `my-mysql80-params`를 사용합니다.

### 상세 단계

9. Parameter groups 목록 화면에서 [[Create parameter group]] 버튼을 클릭합니다.
10. **Parameter group family** 드롭다운에서 `mysql8.0`을 선택합니다.

> [!WARNING]
> Parameter group family는 RDS 인스턴스의 엔진 버전과 반드시 일치해야 합니다.
> Step 4-1에서 MySQL 8.0으로 생성했다면 `mysql8.0`을 선택합니다.
> 버전이 다르면 나중에 RDS에 적용할 때 드롭다운에 표시되지 않습니다.

11. **Type**에서 `DB Parameter Group`을 선택합니다.

> [!NOTE]
> Type에는 `DB Parameter Group`과 `DB Cluster Parameter Group` 두 가지가 있습니다.
>
> - **DB Parameter Group**: 단일 RDS 인스턴스용 (이 실습에서 사용)
> - **DB Cluster Parameter Group**: Aurora 클러스터용
>
> Step 4-1에서 생성한 것이 단일 RDS 인스턴스이므로 `DB Parameter Group`을 선택합니다.

12. **Group name**에 `my-mysql80-params`를 입력합니다.
13. **Description**에 `Custom parameter group for MySQL 8.0 - timezone, charset, connections`를 입력합니다.
14. **Tags** 섹션에서 [[Add tag]]를 클릭하여 다음 태그를 추가합니다:

| Key         | Value        |
| ----------- | ------------ |
| `CreatedBy` | `admin-user` |
| `Step`      | `step4`      |
| `Session`   | `4-2`        |

15. [[Create]] 버튼을 클릭합니다.

> [!OUTPUT]
> "Parameter group my-mysql80-params was created successfully" 메시지가 표시됩니다.
> Parameter groups 목록에 `my-mysql80-params`가 추가된 것을 확인할 수 있습니다.

> [!TIP]
> Parameter Group 자체는 비용이 발생하지 않습니다. 여러 개를 생성해도 무료이므로,
> 환경별(dev/staging/prod)로 분리하여 관리하는 것이 좋습니다.

✅ **태스크 완료**: 커스텀 Parameter Group `my-mysql80-params`가 생성되었습니다.

## 태스크 3: 시간대 설정 (time_zone = Asia/Seoul)

> [!CONCEPT] RDS 시간대 (time_zone)
> RDS MySQL의 기본 시간대는 **UTC**입니다. 한국 서비스에서 `NOW()` 함수를 호출하면 한국 시간보다 9시간 느린 시간이 반환됩니다.
>
> **시간대 설정 전략:**
>
> | 전략              | 적용 대상        | 장점                    | 단점                     |
> | ----------------- | ---------------- | ----------------------- | ------------------------ |
> | DB를 Asia/Seoul로 | 한국 전용 서비스 | SQL 결과가 직관적       | 글로벌 확장 시 변경 필요 |
> | DB는 UTC 유지     | 글로벌 서비스    | 시간대 변환 로직 일관성 | 개발자가 항상 변환 필요  |
>
> 이 실습에서는 한국 서비스를 가정하여 `Asia/Seoul`로 설정합니다.

### 상세 단계

16. Parameter groups 목록에서 `my-mysql80-params` 이름을 클릭합니다.
17. 파라미터 목록이 표시됩니다. 상단 검색창에 `time_zone`을 입력합니다.
18. `time_zone` 파라미터가 필터링되어 표시됩니다. **Apply type** 열이 `Dynamic`인 것을 확인합니다.
19. [[Edit parameters]] 버튼을 클릭합니다.
20. `time_zone` 행의 **Values** 열 드롭다운을 클릭합니다.
21. 드롭다운 목록에서 `Asia/Seoul`을 선택합니다.

> [!TIP]
> 드롭다운 목록이 길어서 찾기 어려울 수 있습니다. 드롭다운이 열린 상태에서 키보드로 `Asia`를 입력하면 빠르게 이동할 수 있습니다.
> 또는 드롭다운 상단의 필터 입력란에 `Seoul`을 입력하여 검색합니다.

22. [[Save changes]] 버튼을 클릭합니다.

> [!OUTPUT]
> "Parameter group my-mysql80-params was modified successfully" 메시지가 표시됩니다.
> `time_zone` 파라미터의 Values 열이 `Asia/Seoul`로 변경된 것을 확인할 수 있습니다.

> [!NOTE]
> `time_zone`은 Dynamic 파라미터이므로 Parameter Group을 RDS에 적용하면 재부팅 없이 즉시 반영됩니다.
> 하지만 이 실습에서는 다른 파라미터도 함께 변경한 뒤 한 번에 적용합니다.

✅ **태스크 완료**: 시간대가 Asia/Seoul로 설정되었습니다.

## 태스크 4: 문자셋 설정 (utf8mb4)

> [!CONCEPT] utf8 vs utf8mb4
> MySQL의 `utf8`은 실제로 **3바이트**까지만 지원하는 불완전한 UTF-8 구현입니다.
> 이모지(😀, 🎉)나 일부 한자 등 4바이트 문자를 저장하면 에러가 발생합니다.
>
> `utf8mb4`는 **4바이트**를 완전히 지원하는 진짜 UTF-8입니다.
>
> ```
> utf8   → 최대 3바이트 → 이모지 저장 불가 ❌
> utf8mb4 → 최대 4바이트 → 이모지 저장 가능 ✅
> ```
>
> **새 프로젝트에서는 항상 `utf8mb4`를 사용하세요.**
> 기존 프로젝트에서 utf8 → utf8mb4로 변경할 때는 인덱스 크기 제한에 주의해야 합니다.

> [!CONCEPT] Collation (정렬 규칙)
> Collation은 문자열을 비교·정렬하는 규칙입니다.
>
> | Collation            | 특징                        | 사용 시점               |
> | -------------------- | --------------------------- | ----------------------- |
> | `utf8mb4_general_ci` | 빠르지만 정렬 정확도 낮음   | 레거시 호환             |
> | `utf8mb4_unicode_ci` | 유니코드 표준 정렬, 범용적  | 대부분의 프로젝트       |
> | `utf8mb4_0900_ai_ci` | MySQL 8.0 기본값, 가장 정확 | MySQL 8.0 신규 프로젝트 |
>
> - `ci` = Case Insensitive (대소문자 구분 안 함)
> - `ai` = Accent Insensitive (악센트 구분 안 함)
>
> 이 실습에서는 범용적인 `utf8mb4_unicode_ci`를 사용합니다.

### 변경할 파라미터 목록

| 파라미터                   | 값                   | 설명                     | Apply type |
| -------------------------- | -------------------- | ------------------------ | ---------- |
| `character_set_client`     | `utf8mb4`            | 클라이언트 → 서버 문자셋 | Dynamic    |
| `character_set_connection` | `utf8mb4`            | 연결 시 사용 문자셋      | Dynamic    |
| `character_set_database`   | `utf8mb4`            | 데이터베이스 기본 문자셋 | Dynamic    |
| `character_set_results`    | `utf8mb4`            | 서버 → 클라이언트 문자셋 | Dynamic    |
| `character_set_server`     | `utf8mb4`            | 서버 기본 문자셋         | Dynamic    |
| `collation_connection`     | `utf8mb4_unicode_ci` | 연결 정렬 규칙           | Dynamic    |
| `collation_server`         | `utf8mb4_unicode_ci` | 서버 기본 정렬 규칙      | Dynamic    |

### 상세 단계

23. `my-mysql80-params` 파라미터 목록 화면에서 [[Edit parameters]] 버튼을 클릭합니다.
24. 상단 검색창에 `character_set`을 입력합니다.
25. `character_set_client` 행의 **Values** 열 드롭다운을 클릭하고 `utf8mb4`를 선택합니다.
26. `character_set_connection` 행의 **Values** 열 드롭다운을 클릭하고 `utf8mb4`를 선택합니다.
27. `character_set_database` 행의 **Values** 열 드롭다운을 클릭하고 `utf8mb4`를 선택합니다.
28. `character_set_results` 행의 **Values** 열 드롭다운을 클릭하고 `utf8mb4`를 선택합니다.
29. `character_set_server` 행의 **Values** 열 드롭다운을 클릭하고 `utf8mb4`를 선택합니다.

> [!TIP]
> `character_set_filesystem`은 변경하지 않습니다. 이 파라미터는 파일 이름 인코딩에 사용되며, 기본값 `binary`를 유지하는 것이 안전합니다.

30. 검색창을 지우고 `collation`을 입력합니다.
31. `collation_connection` 행의 **Values** 열 드롭다운을 클릭하고 `utf8mb4_unicode_ci`를 선택합니다.
32. `collation_server` 행의 **Values** 열 드롭다운을 클릭하고 `utf8mb4_unicode_ci`를 선택합니다.

> [!TIP]
> 드롭다운에서 `utf8mb4_unicode_ci`를 찾기 어려우면, 드롭다운 필터에 `unicode`를 입력하여 검색합니다.
> `utf8mb4_`로 시작하는 collation이 매우 많으므로 필터를 활용하세요.

33. [[Save changes]] 버튼을 클릭합니다.

> [!OUTPUT]
> "Parameter group my-mysql80-params was modified successfully" 메시지가 표시됩니다.
> 검색창에 `character_set`을 입력하면 5개 파라미터 모두 `utf8mb4`로 변경된 것을 확인할 수 있습니다.

> [!WARNING]
> `character_set_database`는 기존 데이터베이스의 문자셋을 변경하지 않습니다.
> 이 설정은 **새로 생성되는 데이터베이스**의 기본 문자셋만 지정합니다.
> 기존 데이터베이스의 문자셋을 변경하려면 SQL로 직접 `ALTER DATABASE` 명령을 실행해야 합니다:
>
> ```sql
> ALTER DATABASE appdb CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
> ```

✅ **태스크 완료**: 문자셋 7개 파라미터가 utf8mb4/utf8mb4_unicode_ci로 설정되었습니다.

## 태스크 5: max_connections 설정

> [!CONCEPT] max_connections (최대 동시 연결 수)
> `max_connections`는 RDS 인스턴스가 동시에 허용하는 최대 데이터베이스 연결 수입니다.
> 이 값을 초과하면 새로운 연결 시도 시 `Too many connections` 에러가 발생합니다.
>
> **RDS 기본 계산 공식:**
>
> ```
> max_connections = {DBInstanceClassMemory / 12582880}
> ```
>
> | 인스턴스 타입 | 메모리 | 기본 max_connections |
> | ------------- | ------ | -------------------- |
> | db.t3.micro   | 1 GB   | ~66                  |
> | db.t3.small   | 2 GB   | ~150                 |
> | db.t3.medium  | 4 GB   | ~300                 |
> | db.m5.large   | 8 GB   | ~650                 |
>
> **실무 계산 공식:**
>
> ```
> 필요한 max_connections = (서버 수 × 커넥션 풀 크기) + 여유분(관리자·모니터링)
> ```
>
> **예시 (학습 환경):**
>
> - EC2 서버 1대 × HikariCP 풀 크기 10 = 10
> - 여유분 (MySQL Workbench 접속, 모니터링 등): 10
> - **총 필요: 20** → 넉넉하게 100으로 설정

> [!WARNING]
> max_connections를 너무 높게 설정하면 위험합니다:
>
> - 각 연결은 약 **10~20MB**의 메모리를 사용합니다.
> - db.t3.micro(1GB)에서 max_connections=200이면 → 200 × 10MB = 2GB → 메모리 부족으로 RDS 크래시 가능
> - **권장 상한**: db.t3.micro는 100, db.t3.small은 200을 넘기지 마세요.
>
> 반대로 너무 낮게 설정하면 트래픽 증가 시 `Too many connections` 에러가 발생합니다.

### 상세 단계

34. `my-mysql80-params` 파라미터 목록 화면에서 [[Edit parameters]] 버튼을 클릭합니다.
35. 상단 검색창에 `max_connections`를 입력합니다.
36. `max_connections` 파라미터가 표시됩니다. 현재 값이 `{DBInstanceClassMemory/12582880}` (수식)인 것을 확인합니다.
37. `max_connections` 행의 **Values** 열 입력란을 클릭합니다.
38. 기존 값을 지우고 `100`을 입력합니다.

> [!NOTE]
> 값을 수식(`{DBInstanceClassMemory/12582880}`)에서 고정값(`100`)으로 변경합니다.
> 고정값을 사용하면 인스턴스 타입을 변경해도 max_connections가 자동 조정되지 않으므로,
> 인스턴스 스케일업 시 이 값도 함께 조정해야 합니다.
>
> 수식을 유지하면서 배수를 조정하고 싶다면 `{DBInstanceClassMemory/8388608}` (약 1.5배)처럼 분모를 줄일 수도 있습니다.

39. [[Save changes]] 버튼을 클릭합니다.

> [!OUTPUT]
> "Parameter group my-mysql80-params was modified successfully" 메시지가 표시됩니다.
> `max_connections` 파라미터의 Values 열이 `100`으로 변경된 것을 확인할 수 있습니다.

✅ **태스크 완료**: max_connections가 100으로 설정되었습니다.

## 태스크 6: Parameter Group을 RDS에 적용

> [!CONCEPT] Parameter Group 적용 프로세스
> 커스텀 Parameter Group을 생성하고 값을 변경했지만, 아직 RDS 인스턴스에는 적용되지 않았습니다.
> RDS 인스턴스의 설정을 Modify하여 Parameter Group을 교체한 뒤, Reboot해야 완전히 적용됩니다.
>
> ```
> 적용 흐름:
> 1. RDS Modify → Parameter Group 변경 → Apply immediately
> 2. RDS 상태: Available → Modifying → Available
> 3. RDS Reboot → Static 파라미터 포함 전체 적용
> 4. RDS 상태: Available → Rebooting → Available
> ```

### 상세 단계: RDS Modify

40. 왼쪽 메뉴에서 **Databases**를 선택합니다.
41. 데이터베이스 목록에서 `my-rds-mysql`의 라디오 버튼을 선택합니다.
42. 우측 상단의 [[Modify]] 버튼을 클릭합니다.
43. **Modify DB instance** 페이지가 열립니다. 아래로 스크롤하여 **Additional configuration** 섹션을 찾습니다.
44. **DB parameter group** 드롭다운을 클릭합니다.
45. 드롭다운에서 `my-mysql80-params`를 선택합니다.

> [!WARNING]
> 드롭다운에 `my-mysql80-params`가 표시되지 않는 경우:
>
> - Parameter Group의 family가 RDS 엔진 버전과 일치하는지 확인하세요.
> - 예: RDS가 MySQL 8.0이면 Parameter Group family도 `mysql8.0`이어야 합니다.
> - Parameter Group 생성 시 family를 잘못 선택했다면, 삭제 후 올바른 family로 다시 생성하세요.

46. 다른 설정은 변경하지 않고 페이지 최하단의 [[Continue]] 버튼을 클릭합니다.
47. **Summary of modifications** 페이지가 표시됩니다. 변경 사항을 확인합니다:
    - DB parameter group: `default.mysql8.0` → `my-mysql80-params`
48. **Schedule of modifications** 섹션에서 `Apply immediately`를 선택합니다.

> [!NOTE]
> **Apply immediately vs Apply during the next scheduled maintenance window:**
>
> - `Apply immediately`: 즉시 적용. 학습/개발 환경에서 사용.
> - `Apply during the next scheduled maintenance window`: 다음 유지보수 시간에 적용. 운영 환경에서 사용.
>
> 운영 환경에서는 서비스 영향을 최소화하기 위해 유지보수 시간에 적용하는 것이 좋습니다.

49. [[Modify DB instance]] 버튼을 클릭합니다.

> [!OUTPUT]
> Databases 목록으로 돌아갑니다.
> `my-rds-mysql`의 Status가 `Modifying`으로 변경됩니다.
> 1~2분 후 다시 `Available`로 돌아옵니다.

### 상세 단계: RDS Reboot

50. `my-rds-mysql`의 Status가 `Available`로 돌아올 때까지 기다립니다. (새로고침 버튼 🔄 클릭)
51. `my-rds-mysql`의 라디오 버튼을 선택합니다.
52. 우측 상단의 **Actions** 드롭다운을 클릭합니다.
53. **Reboot**를 선택합니다.
54. 확인 팝업에서 [[Confirm]] 버튼을 클릭합니다.

> [!WARNING]
> 재부팅 중에는 RDS에 접속할 수 없습니다.
>
> - 소요 시간: 약 **1~3분** (인스턴스 크기에 따라 다름)
> - 운영 환경에서는 반드시 **점검 시간(maintenance window)**에 진행하세요.
> - Multi-AZ 구성이면 Failover가 발생하여 다운타임을 최소화할 수 있습니다.

55. Status가 `Rebooting`으로 변경되는 것을 확인합니다.
56. 1~3분 후 Status가 다시 `Available`로 돌아올 때까지 기다립니다.

> [!TIP]
> 재부팅 완료 후, `my-rds-mysql`을 클릭하여 상세 페이지로 이동합니다.
> **Configuration** 탭에서 **DB instance parameter group** 항목이 `my-mysql80-params`로 표시되고,
> 상태가 `in-sync`인지 확인합니다.
>
> - `in-sync`: 모든 파라미터가 정상 적용됨
> - `pending-reboot`: 아직 재부팅이 필요한 Static 파라미터가 있음

> [!TROUBLESHOOTING]
> **Parameter Group 적용 문제:**
>
> | 증상                              | 원인                                | 해결 방법                                           |
> | --------------------------------- | ----------------------------------- | --------------------------------------------------- |
> | Parameter Group이 드롭다운에 없음 | family 버전 불일치                  | PG 삭제 후 올바른 family로 재생성                   |
> | 적용 후에도 `pending-reboot` 표시 | Static 파라미터 변경 후 미재부팅    | Actions → Reboot 실행                               |
> | Modify 버튼이 비활성화            | RDS 상태가 Available이 아님         | Modifying/Rebooting 완료까지 대기                   |
> | 재부팅 후에도 설정이 반영 안 됨   | Parameter Group이 제대로 연결 안 됨 | Configuration 탭에서 PG 이름 확인, 다시 Modify 시도 |
> | `Too many connections` 에러 발생  | max_connections 값이 너무 낮음      | Parameter Group에서 값 상향 후 재적용               |

✅ **태스크 완료**: Parameter Group이 RDS에 적용되고 재부팅이 완료되었습니다.

## 태스크 7: 설정 확인 (EC2에서 RDS 접속하여 SQL로 확인)

> [!NOTE]
> 이 태스크에서는 Step 2-1에서 생성한 EC2 인스턴스에 SSH로 접속한 뒤, RDS에 MySQL 클라이언트로 연결하여 설정을 확인합니다.
> EC2에 MySQL 클라이언트가 설치되어 있어야 합니다. (Step 4-1에서 설치 완료)

### 상세 단계: EC2에서 RDS 접속

57. 로컬 터미널에서 EC2에 SSH로 접속합니다:

```bash
ssh -i my-key.pem ec2-user@<EC2-Public-IP>
```

58. EC2에서 RDS에 MySQL 클라이언트로 접속합니다:

```bash
mysql -h my-rds-mysql.xxxxxxxxxxxx.ap-northeast-2.rds.amazonaws.com -u admin -p
```

59. 비밀번호를 입력합니다. (Step 4-1에서 설정한 마스터 비밀번호)

> [!TIP]
> RDS 엔드포인트를 모르겠다면:
> RDS 콘솔 → Databases → `my-rds-mysql` 클릭 → **Connectivity & security** 탭 → **Endpoint** 값을 복사합니다.

> [!WARNING]
> 접속이 안 되는 경우 확인 사항:
>
> - EC2의 Security Group이 RDS의 Security Group에서 인바운드 허용되어 있는지 (3306 포트)
> - RDS가 `Available` 상태인지 (Rebooting 중이면 접속 불가)
> - 비밀번호가 정확한지

### 상세 단계: 시간대 확인

60. MySQL 프롬프트에서 현재 시간을 확인합니다:

```sql
SELECT NOW();
```

> [!OUTPUT]
>
> ```
> +---------------------+
> | NOW()               |
> +---------------------+
> | 2024-xx-xx 15:30:00 |  ← 한국 시간 (UTC+9)으로 표시됨
> +---------------------+
> ```

61. 시간대 설정을 확인합니다:

```sql
SELECT @@global.time_zone, @@session.time_zone;
```

> [!OUTPUT]
>
> ```
> +--------------------+---------------------+
> | @@global.time_zone | @@session.time_zone |
> +--------------------+---------------------+
> | Asia/Seoul         | Asia/Seoul          |
> +--------------------+---------------------+
> ```

### 상세 단계: 문자셋 확인

62. 문자셋 설정을 확인합니다:

```sql
SHOW VARIABLES LIKE 'character_set%';
```

> [!OUTPUT]
>
> ```
> +--------------------------+----------+
> | Variable_name            | Value    |
> +--------------------------+----------+
> | character_set_client     | utf8mb4  |
> | character_set_connection | utf8mb4  |
> | character_set_database   | utf8mb4  |
> | character_set_filesystem | binary   |
> | character_set_results    | utf8mb4  |
> | character_set_server     | utf8mb4  |
> | character_set_system     | utf8mb3  |
> +--------------------------+----------+
> ```
>
> `character_set_system`은 MySQL 내부 메타데이터용으로 변경할 수 없습니다. `binary`와 `utf8mb3`은 정상입니다.

63. Collation 설정을 확인합니다:

```sql
SHOW VARIABLES LIKE 'collation%';
```

> [!OUTPUT]
>
> ```
> +----------------------+--------------------+
> | Variable_name        | Value              |
> +----------------------+--------------------+
> | collation_connection | utf8mb4_unicode_ci |
> | collation_database   | utf8mb4_unicode_ci |
> | collation_server     | utf8mb4_unicode_ci |
> +----------------------+--------------------+
> ```

### 상세 단계: max_connections 확인

64. max_connections 설정을 확인합니다:

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

65. 현재 사용 중인 연결 수를 확인합니다:

```sql
SHOW STATUS LIKE 'Threads_connected';
```

> [!OUTPUT]
>
> ```
> +-------------------+-------+
> | Variable_name     | Value |
> +-------------------+-------+
> | Threads_connected | 1     |
> +-------------------+-------+
> ```
>
> 현재 1개의 연결(본인의 접속)만 사용 중입니다. max_connections=100이므로 99개의 여유가 있습니다.

### 상세 단계: 이모지 저장 테스트 (선택)

66. utf8mb4가 정상 동작하는지 이모지를 저장하여 테스트합니다:

```sql
CREATE DATABASE IF NOT EXISTS testdb CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE testdb;
CREATE TABLE emoji_test (id INT AUTO_INCREMENT PRIMARY KEY, content VARCHAR(100));
INSERT INTO emoji_test (content) VALUES ('Hello 😀🎉🚀');
SELECT * FROM emoji_test;
```

> [!OUTPUT]
>
> ```
> +----+------------------+
> | id | content          |
> +----+------------------+
> |  1 | Hello 😀🎉🚀    |
> +----+------------------+
> ```
>
> 이모지가 정상적으로 저장·조회됩니다. utf8mb4 설정이 올바르게 적용된 것입니다.

67. 테스트 데이터를 정리합니다:

```sql
DROP DATABASE testdb;
```

68. MySQL을 종료합니다:

```sql
EXIT;
```

69. EC2 SSH 세션을 종료합니다:

```bash
exit
```

> [!TROUBLESHOOTING]
> **설정 확인 시 문제:**
>
> | 증상                                    | 원인                         | 해결 방법                                               |
> | --------------------------------------- | ---------------------------- | ------------------------------------------------------- |
> | time_zone이 여전히 UTC                  | Reboot 미실행 또는 PG 미적용 | RDS Configuration 탭에서 PG 확인 후 Reboot              |
> | character_set이 latin1 또는 utf8        | PG 파라미터 저장 안 됨       | PG에서 파라미터 값 재확인 후 Save changes               |
> | max_connections가 66 (기본값)           | PG가 적용되지 않음           | RDS Modify에서 PG 재선택 → Apply immediately → Reboot   |
> | `ERROR 1045 Access denied`              | 비밀번호 오류                | Step 4-1에서 설정한 마스터 비밀번호 확인                |
> | `ERROR 2003 Can't connect`              | 네트워크/SG 문제             | EC2→RDS Security Group 인바운드 3306 허용 확인          |
> | 이모지 저장 시 `Incorrect string value` | 테이블이 utf8로 생성됨       | `ALTER TABLE ... CONVERT TO CHARACTER SET utf8mb4` 실행 |

✅ **태스크 완료**: 모든 파라미터(시간대, 문자셋, max_connections)가 올바르게 적용된 것을 확인했습니다.

## 태스크 8: Spring Boot HikariCP 설정 연계

> [!CONCEPT] HikariCP 커넥션 풀
> Spring Boot는 기본적으로 **HikariCP**를 커넥션 풀로 사용합니다.
> 커넥션 풀은 DB 연결을 미리 생성해두고 재사용하여 매번 연결/해제하는 오버헤드를 줄입니다.
>
> ```
> [Spring Boot App]
>     ├── HikariCP Pool (10개 연결 유지)
>     │   ├── Connection 1 ──→ RDS
>     │   ├── Connection 2 ──→ RDS
>     │   ├── ...
>     │   └── Connection 10 ──→ RDS
>     └── 요청이 오면 풀에서 연결을 빌려 사용 후 반환
> ```
>
> **핵심 설정:**
>
> | 설정                 | 의미                              | 권장값 (학습)  |
> | -------------------- | --------------------------------- | -------------- |
> | `maximum-pool-size`  | 풀에서 유지하는 최대 연결 수      | 10             |
> | `minimum-idle`       | 유휴 상태로 유지하는 최소 연결 수 | 5              |
> | `connection-timeout` | 연결 획득 대기 시간 (ms)          | 3000 (3초)     |
> | `max-lifetime`       | 연결의 최대 수명 (ms)             | 1800000 (30분) |
> | `idle-timeout`       | 유휴 연결 유지 시간 (ms)          | 600000 (10분)  |

> [!CONCEPT] max_connections와 HikariCP의 관계
> RDS의 `max_connections`는 전체 연결 한도이고, HikariCP의 `maximum-pool-size`는 서버 1대가 사용하는 연결 수입니다.
>
> ```
> RDS max_connections = 100
>   ├── EC2 서버 1: HikariCP pool-size 10  → 10개 사용
>   ├── EC2 서버 2: HikariCP pool-size 10  → 10개 사용
>   ├── EC2 서버 3: HikariCP pool-size 10  → 10개 사용
>   ├── 관리자 접속 (MySQL Workbench 등)   → 5개 사용
>   ├── 모니터링 (CloudWatch Agent 등)     → 5개 사용
>   └── 남은 여유: 60개
> ```
>
> **공식:**
>
> ```
> maximum-pool-size ≤ (max_connections - 여유분) / 서버 수
> ```
>
> 서버가 늘어날 것을 고려하여 항상 여유를 두세요.

### application.yml 설정 예시

아래는 RDS Parameter Group 설정에 맞춘 Spring Boot `application.yml` 예시입니다:

```yaml
spring:
  datasource:
    # RDS 엔드포인트 (Step 4-1에서 확인한 값으로 교체)
    url: jdbc:mysql://my-rds-mysql.xxxxxxxxxxxx.ap-northeast-2.rds.amazonaws.com:3306/appdb?useSSL=false&serverTimezone=Asia/Seoul&characterEncoding=UTF-8
    username: admin
    password: ${DB_PASSWORD} # 환경변수로 관리 (하드코딩 금지)
    driver-class-name: com.mysql.cj.jdbc.Driver

    hikari:
      # 커넥션 풀 크기 설정
      maximum-pool-size: 10 # 최대 연결 수 (서버 1대 기준)
      minimum-idle: 5 # 최소 유휴 연결 수
      # 타임아웃 설정
      connection-timeout: 3000 # 연결 획득 대기 (3초, 초과 시 예외)
      max-lifetime: 1800000 # 연결 최대 수명 (30분)
      idle-timeout: 600000 # 유휴 연결 유지 시간 (10분)
      # 풀 이름 (로그에서 식별용)
      pool-name: MyHikariPool
      # 연결 유효성 검사
      connection-test-query: SELECT 1
```

> [!WARNING]
> **비밀번호를 application.yml에 직접 작성하지 마세요!**
>
> - Git에 커밋되면 보안 사고로 이어집니다.
> - 환경변수(`${DB_PASSWORD}`)나 AWS Secrets Manager를 사용하세요.
> - `.gitignore`에 `application-local.yml`을 추가하고 로컬 전용 설정 파일을 분리하는 것도 방법입니다.

> [!TIP]
> **JDBC URL 파라미터 설명:**
>
> | 파라미터            | 값           | 설명                                     |
> | ------------------- | ------------ | ---------------------------------------- |
> | `useSSL`            | `false`      | 학습 환경에서 SSL 비활성화 (운영은 true) |
> | `serverTimezone`    | `Asia/Seoul` | JDBC 드라이버의 시간대 (RDS 설정과 일치) |
> | `characterEncoding` | `UTF-8`      | JDBC 드라이버의 문자 인코딩              |
>
> 운영 환경에서는 `useSSL=true&requireSSL=true`로 설정하여 전송 암호화를 활성화하세요.

### 운영 환경별 설정 가이드

| 환경     | 서버 수 | pool-size | max_connections | 여유분 | 비고                       |
| -------- | ------- | --------- | --------------- | ------ | -------------------------- |
| 개발     | 1대     | 5         | 30              | 25     | db.t3.micro                |
| 스테이징 | 2대     | 10        | 50              | 30     | db.t3.small                |
| 운영     | 3대     | 15        | 100             | 55     | db.t3.medium               |
| 대규모   | 10대    | 20        | 300             | 100    | db.m5.large + Read Replica |

> [!NOTE]
> **max-lifetime 설정 주의:**
>
> HikariCP의 `max-lifetime`은 RDS의 `wait_timeout`보다 **짧게** 설정해야 합니다.
> RDS MySQL의 기본 `wait_timeout`은 28800초(8시간)이므로, HikariCP의 `max-lifetime`을 1800초(30분)로 설정하면 안전합니다.
>
> 만약 `max-lifetime > wait_timeout`이면, RDS가 먼저 연결을 끊어버려서 애플리케이션에서 `Connection is closed` 에러가 발생합니다.

✅ **태스크 완료**: Spring Boot HikariCP 설정과 RDS Parameter Group의 연계를 이해했습니다.

## 마무리

다음을 성공적으로 수행했습니다:

- 기본 Parameter Group이 읽기 전용인 이유와 Dynamic/Static 파라미터의 차이를 이해했습니다.
- 커스텀 Parameter Group(`my-mysql80-params`)을 생성했습니다.
- `time_zone`을 `Asia/Seoul`로 설정하여 한국 시간대를 적용했습니다.
- `character_set_*` 5개와 `collation_*` 2개를 `utf8mb4`/`utf8mb4_unicode_ci`로 통일했습니다.
- `max_connections`를 100으로 설정하고 계산 공식을 이해했습니다.
- RDS에 Parameter Group을 적용(Modify)하고 재부팅(Reboot)했습니다.
- EC2에서 SQL로 모든 설정이 올바르게 반영되었음을 확인했습니다.
- Spring Boot HikariCP 커넥션 풀 설정과 RDS max_connections의 관계를 이해했습니다.

# 🗑️ 리소스 정리

> [!NOTE]
> Parameter Group 자체는 **완전 무료**입니다. 몇 개를 생성하든 비용이 발생하지 않습니다.
> 따라서 삭제하지 않고 유지해도 되지만, 깔끔한 정리를 위해 삭제 방법을 안내합니다.
>
> RDS 인스턴스 자체의 비용 정리는 **Step 4-1의 리소스 정리** 섹션을 참조하세요.

> [!WARNING]
> Parameter Group을 삭제하려면 **먼저 RDS 인스턴스에서 분리**해야 합니다.
> RDS가 사용 중인 Parameter Group은 삭제할 수 없습니다.
> 삭제 순서: RDS에서 기본 PG로 변경 → Reboot → 커스텀 PG 삭제

---

### 단계 1: RDS에서 Parameter Group 분리

1. 상단 검색창에 `RDS`를 입력하고 RDS 서비스를 선택합니다.
2. 왼쪽 메뉴에서 **Databases**를 선택합니다.
3. `my-rds-mysql`의 라디오 버튼을 선택합니다.
4. [[Modify]] 버튼을 클릭합니다.
5. 아래로 스크롤하여 **Additional configuration** 섹션을 찾습니다.
6. **DB parameter group** 드롭다운에서 `default.mysql8.0`을 선택합니다.
7. 페이지 최하단의 [[Continue]] 버튼을 클릭합니다.
8. **Schedule of modifications**에서 `Apply immediately`를 선택합니다.
9. [[Modify DB instance]] 버튼을 클릭합니다.
10. Status가 `Available`로 돌아올 때까지 기다립니다.

> [!NOTE]
> 기본 Parameter Group으로 되돌리면 시간대가 UTC로, 문자셋이 기본값으로, max_connections가 수식 기반으로 복원됩니다.

---

### 단계 2: RDS 재부팅

11. `my-rds-mysql`의 라디오 버튼을 선택합니다.
12. **Actions** → **Reboot**를 선택합니다.
13. 확인 팝업에서 [[Confirm]] 버튼을 클릭합니다.
14. Status가 `Available`로 돌아올 때까지 기다립니다. (1~3분 소요)

---

### 단계 3: 커스텀 Parameter Group 삭제

15. 왼쪽 메뉴에서 **Parameter groups**를 선택합니다.
16. `my-mysql80-params` 왼쪽의 라디오 버튼을 선택합니다.
17. **Actions** 드롭다운을 클릭합니다.
18. [[Delete]]를 선택합니다.
19. 확인 팝업에서 [[Delete]]를 클릭합니다.

> [!TROUBLESHOOTING]
> **Parameter Group 삭제 실패:**
>
> | 증상                                          | 원인                        | 해결 방법                                        |
> | --------------------------------------------- | --------------------------- | ------------------------------------------------ |
> | "Cannot delete, parameter group is in use"    | RDS가 아직 이 PG를 사용 중  | RDS Modify에서 default PG로 변경 후 재시도       |
> | Delete 메뉴가 비활성화                        | 기본 Parameter Group 선택함 | 커스텀 PG(`my-mysql80-params`)를 선택했는지 확인 |
> | "Parameter group is associated with instance" | Modify 후 Reboot 미실행     | RDS Reboot 실행 후 재시도                        |

---

### 단계 4: 삭제 확인

20. Parameter groups 목록에서 `my-mysql80-params`가 사라졌는지 확인합니다.
21. `default.mysql8.0`만 남아있으면 정리 완료입니다.

> [!TIP]
> 커스텀 Parameter Group은 팀 표준 설정으로 유지하면 편리합니다.
> 새 RDS 인스턴스를 생성할 때 바로 적용할 수 있어, 매번 파라미터를 하나씩 설정하는 수고를 줄일 수 있습니다.
> 비용이 없으므로, 삭제하지 않고 유지하는 것도 좋은 선택입니다.

✅ **실습 종료**: 모든 리소스가 정리되었습니다.

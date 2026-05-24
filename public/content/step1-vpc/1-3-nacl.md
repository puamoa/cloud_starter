---
title: 'NACL로 서브넷 레벨 접근 제어'
week: 1
session: 3
awsServices:
  - Amazon VPC
  - Network ACL
learningObjectives:
  - NACL의 Stateless 특성과 규칙 평가 순서를 이해할 수 있습니다.
  - Security Group과 NACL의 차이를 명확히 설명할 수 있습니다.
  - Ephemeral Port의 필요성을 이해하고 올바르게 설정할 수 있습니다.
  - 커스텀 NACL을 생성하고 서브넷에 적용할 수 있습니다.
prerequisites:
  - AWS 계정 생성 완료
  - VPC 및 서브넷 생성 완료 (Step 1-1 참조)
estimatedCost: 무료 리소스 (NACL은 항상 무료)
---

이 실습에서는 서브넷 레벨에서 동작하는 Network ACL(NACL)을 생성하고 규칙을 설정합니다. Security Group과의 차이를 이해하고, Stateless 특성에 따른 Ephemeral Port 설정의 필요성을 학습합니다.

> [!NOTE]
> 이 실습은 VPC와 서브넷이 필요합니다. Step 1-1에서 생성한 VPC(`my-vpc`)와 서브넷을 사용하거나, 기존에 보유한 VPC를 사용합니다.

## 태스크 1: NACL 개념 이해

> [!CONCEPT] Network ACL (NACL)
> NACL은 **서브넷 레벨**에서 동작하는 방화벽입니다.
>
> **핵심 특성:**
>
> - **Stateless**: 인바운드와 아웃바운드를 독립적으로 평가 (응답 트래픽도 명시적 허용 필요)
> - **허용 + 거부 규칙**: Allow와 Deny 모두 설정 가능
> - **규칙 번호 순서 평가**: 낮은 번호부터 순서대로 평가, 첫 번째 매칭 규칙 적용
> - **서브넷 단위 적용**: 서브넷에 속한 모든 인스턴스에 일괄 적용
> - **마지막 규칙**: 규칙 번호 `*`는 모든 트래픽 거부 (변경 불가)

### Security Group vs NACL 비교

| 구분        | Security Group              | NACL                              |
| ----------- | --------------------------- | --------------------------------- |
| 적용 레벨   | 인스턴스 (ENI)              | 서브넷                            |
| 상태        | Stateful                    | Stateless                         |
| 규칙 유형   | 허용(Allow)만               | 허용 + 거부(Deny)                 |
| 규칙 평가   | 모든 규칙 평가 후 종합 판단 | 번호 순서대로, 첫 매칭 적용       |
| 기본 동작   | 모든 인바운드 차단          | 기본 NACL: 모든 트래픽 허용       |
| 적용 방식   | 인스턴스에 명시적 연결      | 서브넷에 자동 적용                |
| 응답 트래픽 | 자동 허용                   | 명시적 허용 필요 (Ephemeral Port) |

> [!TIP]
> 실무에서는 Security Group을 주요 방화벽으로 사용하고, NACL은 추가적인 방어 계층(Defense in Depth)으로 활용합니다. 대부분의 경우 기본 NACL을 그대로 사용해도 충분합니다.

### 기본 NACL vs 커스텀 NACL

| 구분                 | 기본 NACL             | 커스텀 NACL        |
| -------------------- | --------------------- | ------------------ |
| 생성 시점            | VPC 생성 시 자동 생성 | 사용자가 직접 생성 |
| 인바운드 기본 규칙   | 모든 트래픽 허용      | 모든 트래픽 거부   |
| 아웃바운드 기본 규칙 | 모든 트래픽 허용      | 모든 트래픽 거부   |
| 삭제 가능 여부       | 삭제 불가             | 삭제 가능          |

> [!WARNING]
> 커스텀 NACL을 생성하면 기본적으로 **모든 트래픽이 거부**됩니다. 필요한 규칙을 추가하지 않으면 서브넷의 모든 통신이 차단됩니다.

✅ **태스크 완료**: NACL의 개념과 Security Group과의 차이를 이해했습니다.

## 태스크 2: 기본 NACL 확인

1. AWS Management Console에 로그인합니다.
2. 리전을 **Asia Pacific (Seoul) ap-northeast-2**로 설정합니다.
3. 상단 검색창에 `VPC`를 입력하고 VPC 서비스를 선택합니다.
4. 왼쪽 메뉴에서 **Network ACLs**를 선택합니다.
5. `my-vpc`에 연결된 기본 NACL을 선택합니다 (Default 열이 `Yes`인 것).
6. **Inbound rules** 탭을 확인합니다.

> [!OUTPUT]
> 기본 NACL의 Inbound rules:
> | Rule # | Type | Protocol | Port range | Source | Allow/Deny |
> |--------|------|----------|------------|--------|------------|
> | 100 | All traffic | All | All | 0.0.0.0/0 | ALLOW |
> | \* | All traffic | All | All | 0.0.0.0/0 | DENY |

7. **Outbound rules** 탭을 확인합니다.

> [!OUTPUT]
> 기본 NACL의 Outbound rules:
> | Rule # | Type | Protocol | Port range | Destination | Allow/Deny |
> |--------|------|----------|------------|-------------|------------|
> | 100 | All traffic | All | All | 0.0.0.0/0 | ALLOW |
> | \* | All traffic | All | All | 0.0.0.0/0 | DENY |

8. **Subnet associations** 탭에서 연결된 서브넷을 확인합니다.

> [!NOTE]
> 기본 NACL은 VPC의 모든 서브넷에 자동으로 연결됩니다. 서브넷을 커스텀 NACL에 연결하면 기본 NACL에서 분리됩니다.

✅ **태스크 완료**: 기본 NACL의 규칙과 동작을 확인했습니다.

## 태스크 3: 커스텀 NACL 생성 (Public Subnet용)

Public Subnet에 적용할 커스텀 NACL을 생성합니다. 웹 트래픽(HTTP, HTTPS)과 SSH를 허용하고, 응답을 위한 Ephemeral Port를 설정합니다.

> [!CONCEPT] Ephemeral Port (임시 포트)
> 클라이언트가 서버에 요청을 보낼 때, 응답을 받기 위해 임시 포트(1024-65535)를 사용합니다.
>
> NACL은 Stateless이므로, 서버가 클라이언트에게 응답을 보낼 때도 아웃바운드 규칙에서 이 임시 포트 범위를 명시적으로 허용해야 합니다.
>
> 예시: 클라이언트가 80 포트로 HTTP 요청 → 서버가 클라이언트의 임시 포트(예: 52431)로 응답
>
> ```
> [클라이언트:52431] → [서버:80]  (인바운드: 80 허용 필요)
> [서버:80] → [클라이언트:52431]  (아웃바운드: 1024-65535 허용 필요)
> ```

9. 왼쪽 메뉴에서 **Network ACLs**를 선택합니다.
10. [[Create network ACL]] 버튼을 클릭합니다.
11. 다음과 같이 설정합니다:
    - **Name**: `my-public-nacl`
    - **VPC**: `my-vpc` 선택
12. [[Create network ACL]] 버튼을 클릭합니다.

> [!WARNING]
> 생성 직후에는 모든 인바운드/아웃바운드 트래픽이 거부됩니다. 서브넷에 연결하기 전에 반드시 필요한 규칙을 추가하세요.

### Inbound 규칙 추가

13. 생성된 `my-public-nacl`을 선택합니다.
14. **Inbound rules** 탭을 선택합니다.
15. [[Edit inbound rules]] 버튼을 클릭합니다.
16. [[Add new rule]] 버튼을 클릭하고 첫 번째 규칙을 설정합니다:
    - **Rule number**: `100`
    - **Type**: `HTTP (80)`
    - **Source**: `0.0.0.0/0`
    - **Allow/Deny**: `Allow`

17. [[Add new rule]] 버튼을 클릭하고 두 번째 규칙을 설정합니다:
    - **Rule number**: `110`
    - **Type**: `HTTPS (443)`
    - **Source**: `0.0.0.0/0`
    - **Allow/Deny**: `Allow`

18. [[Add new rule]] 버튼을 클릭하고 세 번째 규칙을 설정합니다:
    - **Rule number**: `120`
    - **Type**: `SSH (22)`
    - **Source**: `0.0.0.0/0`
    - **Allow/Deny**: `Allow`

> [!TIP]
> NACL에서는 SSH Source를 `0.0.0.0/0`으로 설정해도 됩니다. Security Group에서 이미 My IP로 제한하고 있으므로, NACL은 넓게 열어두고 SG에서 세밀하게 제어하는 것이 일반적입니다.

19. [[Add new rule]] 버튼을 클릭하고 네 번째 규칙을 설정합니다:
    - **Rule number**: `130`
    - **Type**: `Custom TCP`
    - **Port range**: `8080`
    - **Source**: `0.0.0.0/0`
    - **Allow/Deny**: `Allow`

20. [[Add new rule]] 버튼을 클릭하고 다섯 번째 규칙(Ephemeral Port)을 설정합니다:
    - **Rule number**: `140`
    - **Type**: `Custom TCP`
    - **Port range**: `1024-65535`
    - **Source**: `0.0.0.0/0`
    - **Allow/Deny**: `Allow`

> [!NOTE]
> Rule 140은 서버가 외부로 요청을 보낸 후 응답을 받기 위한 Ephemeral Port입니다. 예를 들어 EC2에서 `yum update`를 실행하면, 패키지 서버의 응답이 이 포트 범위로 돌아옵니다.

21. [[Save changes]] 버튼을 클릭합니다.

### Outbound 규칙 추가

22. **Outbound rules** 탭을 선택합니다.
23. [[Edit outbound rules]] 버튼을 클릭합니다.
24. [[Add new rule]] 버튼을 클릭하고 첫 번째 규칙을 설정합니다:
    - **Rule number**: `100`
    - **Type**: `HTTP (80)`
    - **Destination**: `0.0.0.0/0`
    - **Allow/Deny**: `Allow`

25. [[Add new rule]] 버튼을 클릭하고 두 번째 규칙을 설정합니다:
    - **Rule number**: `110`
    - **Type**: `HTTPS (443)`
    - **Destination**: `0.0.0.0/0`
    - **Allow/Deny**: `Allow`

26. [[Add new rule]] 버튼을 클릭하고 세 번째 규칙(Ephemeral Port - 응답용)을 설정합니다:
    - **Rule number**: `120`
    - **Type**: `Custom TCP`
    - **Port range**: `1024-65535`
    - **Destination**: `0.0.0.0/0`
    - **Allow/Deny**: `Allow`

> [!CONCEPT] 아웃바운드 Ephemeral Port의 의미
> 외부 클라이언트가 EC2의 80 포트로 요청을 보내면, EC2는 클라이언트의 임시 포트로 응답을 보내야 합니다. 이 응답 트래픽이 아웃바운드 Ephemeral Port 규칙에 의해 허용됩니다.

27. [[Save changes]] 버튼을 클릭합니다.

✅ **태스크 완료**: 커스텀 NACL의 인바운드/아웃바운드 규칙이 설정되었습니다.

## 태스크 4: NACL을 서브넷에 연결

28. `my-public-nacl`의 **Subnet associations** 탭을 선택합니다.
29. [[Edit subnet associations]] 버튼을 클릭합니다.
30. `my-public-subnet-a`와 `my-public-subnet-c`를 체크합니다.
31. [[Save changes]] 버튼을 클릭합니다.

> [!OUTPUT]
> Subnet associations 탭에서 2개의 Public Subnet이 연결된 것을 확인할 수 있습니다. 이 서브넷들은 더 이상 기본 NACL이 아닌 `my-public-nacl`의 규칙을 따릅니다.

> [!WARNING]
> NACL을 서브넷에 연결하는 순간 즉시 적용됩니다. 규칙이 올바르지 않으면 해당 서브넷의 모든 통신이 차단될 수 있습니다. 실습 환경에서 문제가 발생하면 서브넷을 다시 기본 NACL에 연결하세요.

✅ **태스크 완료**: 커스텀 NACL이 Public Subnet에 연결되었습니다.

## 태스크 5: 규칙 번호 순서 평가 이해

> [!CONCEPT] 규칙 번호 순서 평가
> NACL은 규칙 번호가 낮은 것부터 순서대로 평가합니다. 첫 번째로 매칭되는 규칙이 적용되고, 이후 규칙은 무시됩니다.
>
> 예시:
>
> ```
> Rule 100: HTTP (80) ALLOW
> Rule 200: HTTP (80) DENY
> Rule *:   All traffic DENY
> ```
>
> → 80 포트 트래픽은 Rule 100에서 ALLOW로 매칭되므로 허용됩니다.
>
> 만약 순서가 반대라면:
>
> ```
> Rule 100: HTTP (80) DENY
> Rule 200: HTTP (80) ALLOW
> Rule *:   All traffic DENY
> ```
>
> → 80 포트 트래픽은 Rule 100에서 DENY로 매칭되므로 차단됩니다.

### 규칙 번호 설계 모범 사례

| 번호 범위 | 용도         | 예시              |
| --------- | ------------ | ----------------- |
| 100-199   | 웹 트래픽    | HTTP, HTTPS       |
| 200-299   | 관리 트래픽  | SSH, RDP          |
| 300-399   | 데이터베이스 | MySQL, PostgreSQL |
| 400-499   | 애플리케이션 | Custom ports      |
| 900-999   | 차단 규칙    | 특정 IP 차단      |

> [!TIP]
> 규칙 번호를 10 단위(100, 110, 120...)로 설정하면 나중에 중간에 규칙을 추가하기 쉽습니다. 예를 들어 100과 110 사이에 105를 추가할 수 있습니다.

32. 테스트를 위해 특정 IP를 차단하는 규칙을 추가해 봅니다 (선택 사항):
    - `my-public-nacl`의 Inbound rules에서 [[Edit inbound rules]] 클릭
    - [[Add new rule]] 클릭
    - **Rule number**: `50`
    - **Type**: `All traffic`
    - **Source**: `203.0.113.0/24` (예시 IP 대역)
    - **Allow/Deny**: `Deny`
    - [[Save changes]] 클릭

> [!NOTE]
> Rule 50은 Rule 100보다 먼저 평가됩니다. 따라서 203.0.113.0/24 대역에서 오는 모든 트래픽은 HTTP, SSH 등의 허용 규칙보다 먼저 차단됩니다. 이것이 NACL에서 특정 IP를 차단하는 방법입니다.

33. 테스트가 끝나면 Rule 50을 삭제합니다 (실습용이므로).

✅ **태스크 완료**: 규칙 번호 순서 평가 원리를 이해했습니다.

## 태스크 6: 최종 구성 확인

34. Network ACLs 목록에서 `my-public-nacl`을 선택합니다.
35. Inbound rules에서 다음 규칙이 있는지 확인합니다:

| Rule # | Type        | Port       | Source    | Allow/Deny |
| ------ | ----------- | ---------- | --------- | ---------- |
| 100    | HTTP        | 80         | 0.0.0.0/0 | ALLOW      |
| 110    | HTTPS       | 443        | 0.0.0.0/0 | ALLOW      |
| 120    | SSH         | 22         | 0.0.0.0/0 | ALLOW      |
| 130    | Custom TCP  | 8080       | 0.0.0.0/0 | ALLOW      |
| 140    | Custom TCP  | 1024-65535 | 0.0.0.0/0 | ALLOW      |
| \*     | All traffic | All        | 0.0.0.0/0 | DENY       |

36. Outbound rules에서 다음 규칙이 있는지 확인합니다:

| Rule # | Type        | Port       | Destination | Allow/Deny |
| ------ | ----------- | ---------- | ----------- | ---------- |
| 100    | HTTP        | 80         | 0.0.0.0/0   | ALLOW      |
| 110    | HTTPS       | 443        | 0.0.0.0/0   | ALLOW      |
| 120    | Custom TCP  | 1024-65535 | 0.0.0.0/0   | ALLOW      |
| \*     | All traffic | All        | 0.0.0.0/0   | DENY       |

37. Subnet associations에서 `my-public-subnet-a`와 `my-public-subnet-c`가 연결되어 있는지 확인합니다.

✅ **태스크 완료**: 전체 NACL 구성이 완료되었습니다.

## 마무리

다음을 성공적으로 수행했습니다:

- NACL의 Stateless 특성과 규칙 번호 순서 평가를 이해했습니다.
- Security Group과 NACL의 차이를 비교했습니다.
- Ephemeral Port의 필요성과 설정 방법을 학습했습니다.
- 커스텀 NACL을 생성하고 Public Subnet에 연결했습니다.
- 규칙 번호를 활용한 특정 IP 차단 방법을 확인했습니다.

# 🗑️ 리소스 정리

> [!NOTE]
> 이 실습에서 생성한 리소스는 모두 무료이므로 삭제하지 않아도 비용이 발생하지 않습니다.

---

### 단계 1: 리소스 유지 권장

NACL은 이후 실습에서 계속 사용할 수 있습니다. **유지하는 것을 권장합니다.**

> [!NOTE]
> NACL은 프리티어와 무관하게 **항상 무료**인 리소스입니다. 삭제하지 않아도 비용이 발생하지 않습니다.

---

### 단계 2: 삭제 방법 (선택)

커스텀 NACL을 삭제하면 연결된 서브넷은 자동으로 기본 NACL(모든 트래픽 허용)로 돌아갑니다.

1. VPC 콘솔 → **Network ACLs** → `my-public-nacl` 선택 → **Subnet associations** 탭 → [[Edit subnet associations]]
2. 모든 서브넷의 체크를 해제합니다 → [[Save changes]]

> [!NOTE]
> 서브넷 연결을 해제하면 해당 서브넷은 자동으로 기본 NACL에 연결됩니다. 기본 NACL은 모든 트래픽을 허용하므로 통신에 문제가 없습니다.

3. `my-public-nacl` 선택 → **Actions** → [[Delete network ACL]] → 확인

---

### 단계 3: 삭제 확인

1. Network ACLs 목록에서 `my-public-nacl`이 없는지 확인합니다.
2. 기본 NACL의 Subnet associations에서 Public Subnet이 다시 연결되었는지 확인합니다.

> [!TIP]
> 실습 환경에서 통신 문제가 발생하면 NACL을 먼저 의심하세요. 커스텀 NACL의 규칙이 올바르지 않으면 서브넷 전체의 통신이 차단됩니다. 문제 해결이 어려우면 서브넷을 기본 NACL에 다시 연결하세요.

✅ **실습 종료**: 모든 리소스가 정리되었습니다.

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

이 실습에서는 서브넷 레벨에서 동작하는 Network ACL(NACL)을 생성하고 규칙을 설정합니다.  
Security Group과의 차이를 이해하고, Stateless 특성에 따른 Ephemeral Port 설정의 필요성을 학습합니다.

<img src="/images/architecture/step1-3-nacl-architecture.png" alt="Step 1-3 NACL 아키텍처 구성도" class="guide-img-lg" />

> [!WARNING]
> 위 다이어그램은 최종 목표 구성을 보여주는 참고 자료입니다.  
> NACL은 서브넷 단위로 적용되며, 서브넷에 연결해야 실제로 트래픽을 제어합니다.  
> Public Subnet에는 커스텀 NACL(`my-public-nacl`)을, Private Subnet에는 기본 NACL(Default)을 사용합니다.

> [!NOTE]
> 이 실습은 Amazon VPC와 서브넷이 필요합니다.  
> Step 1-1 또는 Step 1-2에서 생성한 VPC(`my-vpc`)와 서브넷을 사용하거나, 기존에 보유한 VPC를 사용합니다.

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

| 구분        | Security Group              | NACL                                                    |
| ----------- | --------------------------- | ------------------------------------------------------- |
| 적용 레벨   | 인스턴스 (ENI)              | 서브넷                                                  |
| 상태        | Stateful                    | Stateless                                               |
| 규칙 유형   | 허용(Allow)만               | 허용 + 거부(Deny)                                       |
| 규칙 평가   | 모든 규칙 평가 후 종합 판단 | 번호 순서대로, 첫 매칭 적용 (낮은 번호 = 높은 우선순위) |
| 기본 동작   | 모든 인바운드 차단          | 기본 NACL: 모든 트래픽 허용                             |
| 적용 방식   | 인스턴스에 명시적 연결      | 서브넷에 자동 적용                                      |
| 응답 트래픽 | 자동 허용                   | 명시적 허용 필요 (Ephemeral Port)                       |

> [!NOTE]
> **ENI (Elastic Network Interface)란?**
>
> ENI는 Amazon VPC 내에서 인스턴스에 연결되는 **가상 네트워크 카드**입니다. 물리 서버의 LAN 카드에 해당합니다.
>
> - Amazon EC2 인스턴스를 생성하면 자동으로 **Primary ENI**가 하나 생성되어 연결됩니다.
> - ENI에는 사설 IP, Public IP, MAC 주소, Security Group이 할당됩니다.
> - Security Group은 실제로 **인스턴스가 아닌 ENI에 연결**됩니다. 그래서 "인스턴스 레벨"이라고 표현합니다.
> - 하나의 인스턴스에 여러 ENI를 연결할 수 있고, 각 ENI에 서로 다른 Security Group을 적용할 수 있습니다.
> - ENI를 다른 인스턴스로 이동(detach → attach)하면 IP와 Security Group 설정이 함께 이동합니다.
>
> ```
> Amazon EC2 인스턴스
> └── ENI (eth0) ← Primary ENI
>     ├── Private IP: 10.0.1.50
>     ├── Public IP: 54.180.x.x (할당된 경우)
>     ├── MAC Address: 02:xx:xx:xx:xx:xx
>     └── Security Groups: [my-ec2-sg]
> ```

> [!TIP]
> 실무에서는 Security Group을 주요 방화벽으로 사용하고, NACL은 추가적인 방어 계층(Defense in Depth)으로 활용합니다.  
> 대부분의 경우 기본 NACL을 그대로 사용해도 충분합니다.

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

    <img src="/images/common/region-check.png" alt="리전 확인" class="guide-img-sm" />

> [!TIP]
> 일부 AWS 서비스(IAM, CloudFront, Route 53 등)는 **글로벌 서비스**이므로 리전 선택 드롭다운이 비활성화되거나 "Global"로 표시됩니다.  
> 이 실습에서 사용하는 서비스는 리전 기반이므로 반드시 올바른 리전이 선택되어 있는지 확인하세요.

3. 상단 검색창에 `VPC`를 입력하고 VPC 서비스를 선택합니다.
4. 왼쪽 메뉴에서 **Network ACLs**를 선택합니다.

    <img src="/images/step1/1-3-step4-network-acls.png" alt="Network ACLs 선택" class="guide-img-sm" />

5. `my-vpc`에 연결된 기본 NACL을 선택합니다 (Default 열이 `Yes`인 것).

    <img src="/images/step1/1-3-step5-default-nacl.png" alt="기본 NACL 선택" class="guide-img-sm" />
6. **Inbound rules** 탭을 확인합니다.

> [!OUTPUT]
> 기본 NACL의 Inbound rules:
>
> | Rule # | Type        | Protocol | Port range | Source    | Allow/Deny |
> | ------ | ----------- | -------- | ---------- | --------- | ---------- |
> | 100    | All traffic | All      | All        | 0.0.0.0/0 | ALLOW      |
> | \*     | All traffic | All      | All        | 0.0.0.0/0 | DENY       |

7. **Outbound rules** 탭을 확인합니다.

    <img src="/images/step1/1-3-step7-outbound-rules.png" alt="Outbound rules 확인" class="guide-img-sm" />

> [!OUTPUT]
> 기본 NACL의 Outbound rules:
>
> | Rule # | Type        | Protocol | Port range | Destination | Allow/Deny |
> | ------ | ----------- | -------- | ---------- | ----------- | ---------- |
> | 100    | All traffic | All      | All        | 0.0.0.0/0   | ALLOW      |
> | \*     | All traffic | All      | All        | 0.0.0.0/0   | DENY       |

8. **Subnet associations** 탭에서 연결된 서브넷을 확인합니다.

    <img src="/images/step1/1-3-step8-subnet-assoc.png" alt="Subnet associations 확인" class="guide-img-sm" />

> [!NOTE]
> 기본 NACL은 Amazon VPC의 모든 서브넷에 자동으로 연결됩니다. 서브넷을 커스텀 NACL에 연결하면 기본 NACL에서 분리됩니다.

✅ **태스크 완료**: 기본 NACL의 규칙과 동작을 확인했습니다.

## 태스크 3: 커스텀 NACL 생성 (Public Subnet용)

Public Subnet에 적용할 커스텀 NACL을 생성합니다. 웹 트래픽(HTTP, HTTPS)과 SSH를 허용하고, 응답을 위한 Ephemeral Port를 설정합니다.

> [!CONCEPT] Ephemeral Port (임시 포트)
> 클라이언트가 서버에 요청을 보낼 때, 클라이언트 측에서는 **임시 포트(Ephemeral Port)**를 자동으로 할당하여 응답을 받습니다.
>
> **왜 클라이언트에 임시 포트가 필요한가?**
>
> 웹 브라우저에서 `http://서버IP`로 접속하면, 브라우저는 내부적으로 임의의 높은 번호 포트(예: 52431)를 열고 서버의 80 포트로 요청을 보냅니다.  
> 서버는 응답을 보낼 때 이 임시 포트(52431)로 돌려보냅니다.
>
> 비유: 편의점에서 택배를 보내는 상황을 생각해보세요.
>
> - 편의점(서버)의 주소는 고정되어 있습니다. (포트 80 = HTTP 서비스)
> - 하지만 택배를 받으려면 **내 집 주소(임시 포트)**가 있어야 합니다.
> - 내가 편의점에 택배를 맡기면서 "답장은 52431번지로 보내주세요"라고 알려주는 것과 같습니다.
>
> ```
> 요청: [내 PC:52431] ──→ [서버:80]   "응답은 52431로 보내줘"
> 응답: [서버:80]      ──→ [내 PC:52431]
> ```
>
> 임시 포트가 매번 랜덤으로 할당되는 이유는, 하나의 PC에서 **여러 연결을 동시에 구분**하기 위해서입니다.  
> 브라우저 탭을 3개 열면 각 탭이 서로 다른 임시 포트를 사용하므로, 서버가 보낸 응답이 어떤 탭의 요청에 대한 것인지 정확히 전달됩니다.
>
> ```
> 탭 1: [내 PC:52431] ──→ [서버:80]   → 응답은 52431로 돌아옴 → 탭 1에 표시
> 탭 2: [내 PC:53892] ──→ [서버:80]   → 응답은 53892로 돌아옴 → 탭 2에 표시
> 탭 3: [내 PC:49100] ──→ [서버:443]  → 응답은 49100으로 돌아옴 → 탭 3에 표시
> ```
>
> 만약 모든 탭이 같은 포트를 쓰면 응답이 섞여서 어떤 탭에 보여줘야 할지 구분할 수 없습니다.  
> 그래서 OS가 연결마다 고유한 임시 포트를 자동 할당합니다.
>
> **Security Group에서는 왜 신경 안 써도 되나?**
>
> Security Group은 **Stateful**이므로 인바운드를 허용하면 응답은 자동 허용됩니다. Ephemeral Port를 별도로 열 필요가 없습니다.
>
> **NACL에서는 왜 필요한가?**
>
> NACL은 **Stateless**이므로 요청과 응답을 별개로 취급합니다.  
> 서버가 클라이언트에게 응답을 보내려면, 아웃바운드 규칙에서 임시 포트 범위(1024-65535)를 명시적으로 허용해야 합니다.  
> 이 규칙이 없으면 요청은 들어오지만 응답이 나가지 못해 통신이 실패합니다.
>
> **포트 범위가 1024-65535인 이유:**
>
> - 0~1023: Well-Known Ports (HTTP:80, SSH:22 등 고정 서비스용)
> - 1024~65535: 클라이언트가 임시로 사용하는 포트 범위
> - OS마다 실제 사용 범위가 다름 (Linux: 32768-60999, Windows: 49152-65535)
> - AWS에서는 안전하게 **1024-65535 전체**를 허용하는 것을 권장합니다.
>
> | 방향       | 필요한 NACL 규칙                  | 이유                          |
> | ---------- | --------------------------------- | ----------------------------- |
> | 인바운드   | 포트 80 ALLOW (0.0.0.0/0)         | 클라이언트의 HTTP 요청 수신   |
> | 아웃바운드 | 포트 1024-65535 ALLOW (0.0.0.0/0) | 클라이언트에게 HTTP 응답 전송 |
> | 인바운드   | 포트 1024-65535 ALLOW (0.0.0.0/0) | 외부 요청(yum 등)의 응답 수신 |
> | 아웃바운드 | 포트 80, 443 ALLOW (0.0.0.0/0)    | 외부로 HTTP/HTTPS 요청 전송   |

9. 왼쪽 메뉴에서 **Network ACLs**를 선택합니다.
10. [[Create network ACL]] 버튼을 클릭합니다.
11. 다음과 같이 설정합니다:
    - **Name**: `my-public-nacl`
    - **VPC**: `my-vpc` 선택
    - **Tags**:
      - `Name` = `my-public-nacl`
      - `CreatedBy` = `admin-user`
      - `Step` = `step1`
      - `Session` = `1-3`

    <img src="/images/step1/1-3-step11-create-nacl.png" alt="NACL 생성 설정" class="guide-img-sm" />
12. [[Create network ACL]] 버튼을 클릭합니다.

> [!WARNING]
> 생성 직후에는 모든 인바운드/아웃바운드 트래픽이 거부됩니다. 서브넷에 연결하기 전에 반드시 필요한 규칙을 추가하세요.

### Inbound 규칙 추가

13. 생성된 `my-public-nacl`을 선택합니다.

    <img src="/images/step1/1-3-step13-nacl-created.png" alt="생성된 NACL 선택" class="guide-img-sm" />
14. **Inbound rules** 탭을 선택합니다.
15. [[Edit inbound rules]] 버튼을 클릭합니다.

    <img src="/images/step1/1-3-step15-edit-inbound.png" alt="Edit inbound rules" class="guide-img-sm" />
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
> NACL에서는 SSH Source를 `0.0.0.0/0`으로 설정해도 됩니다.  
> Security Group에서 이미 My IP로 제한하고 있으므로, NACL은 넓게 열어두고 SG에서 세밀하게 제어하는 것이 일반적입니다.

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

    <img src="/images/step1/1-3-step20-inbound-rules.png" alt="Inbound rules 전체" class="guide-img-sm" />

> [!NOTE]
> Rule 140은 서버가 외부로 요청을 보낸 후 응답을 받기 위한 Ephemeral Port입니다.  
> 예를 들어 Amazon EC2에서 `yum update`를 실행하면, 패키지 서버의 응답이 이 포트 범위로 돌아옵니다.

21. [[Save changes]] 버튼을 클릭합니다.

    <img src="/images/step1/1-3-step21-inbound-saved.png" alt="Inbound rules 저장 완료" class="guide-img-sm" />

### Outbound 규칙 추가

22. **Outbound rules** 탭을 선택합니다.
23. [[Edit outbound rules]] 버튼을 클릭합니다.

    <img src="/images/step1/1-3-step23-edit-outbound.png" alt="Edit outbound rules" class="guide-img-sm" />
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

    <img src="/images/step1/1-3-step26-outbound-rules.png" alt="Outbound rules 전체" class="guide-img-sm" />

> [!CONCEPT] 아웃바운드 Ephemeral Port의 의미
> 외부 클라이언트가 Amazon EC2의 80 포트로 요청을 보내면, Amazon EC2는 클라이언트의 임시 포트로 응답을 보내야 합니다.  
> 이 응답 트래픽이 아웃바운드 Ephemeral Port 규칙에 의해 허용됩니다.

27. [[Save changes]] 버튼을 클릭합니다.

    <img src="/images/step1/1-3-step27-outbound-saved.png" alt="Outbound rules 저장 완료" class="guide-img-sm" />

✅ **태스크 완료**: 커스텀 NACL의 인바운드/아웃바운드 규칙이 설정되었습니다.

## 태스크 4: NACL을 서브넷에 연결

28. `my-public-nacl`의 **Subnet associations** 탭을 선택합니다.
29. [[Edit subnet associations]] 버튼을 클릭합니다.

    <img src="/images/step1/1-3-step29-edit-subnet-assoc.png" alt="Edit subnet associations" class="guide-img-sm" />
30. `my-public-subnet-a`와 `my-public-subnet-c`를 체크합니다.

    <img src="/images/step1/1-3-step30-select-subnets.png" alt="Public Subnet 선택" class="guide-img-sm" />

> [!NOTE]
> 스크린샷에서 보이는 서브넷 이름은 "VPC and more"로 생성한 경우 `my-subnet-public1-ap-northeast-2a`처럼 자동 생성된 이름일 수 있습니다.  
> Step 1-1에서 수동 생성한 경우 `my-public-subnet-a`로 표시됩니다.  
> **Name 열과 IPv4 CIDR 열을 함께 확인**하여 Public Subnet(10.0.1.0/24, 10.0.2.0/24)만 선택하세요.  
> Private Subnet(10.0.11.0/24, 10.0.12.0/24)은 체크하지 않습니다.

31. [[Save changes]] 버튼을 클릭합니다.

    <img src="/images/step1/1-3-step31-subnet-saved.png" alt="Subnet associations 저장 완료" class="guide-img-sm" />

> [!OUTPUT]
> Subnet associations 탭에서 2개의 Public Subnet이 연결된 것을 확인할 수 있습니다.  
> 이 서브넷들은 더 이상 기본 NACL이 아닌 `my-public-nacl`의 규칙을 따릅니다.

> [!WARNING]
> NACL을 서브넷에 연결하는 순간 즉시 적용됩니다.  
> 규칙이 올바르지 않으면 해당 서브넷의 모든 통신이 차단될 수 있습니다.  
> 실습 환경에서 문제가 발생하면 서브넷을 다시 기본 NACL에 연결하세요.

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

> [!TIP]
> **NACL 규칙 번호 핵심 정리:**
>
> - **숫자가 낮을수록 우선순위가 높습니다.** (Rule 100 > Rule 200 > Rule 300)
> - 같은 포트에 ALLOW와 DENY가 모두 있으면, **번호가 낮은 쪽이 이깁니다.**
> - Rule `*`(별표)는 번호가 가장 높은 기본 규칙으로, 어떤 규칙에도 매칭되지 않은 트래픽을 **모두 거부**합니다. 삭제하거나 변경할 수 없습니다.
> - 규칙 번호를 10 단위(100, 110, 120...)로 설정하면 나중에 사이에 규칙을 끼워넣기 쉽습니다.
> - Security Group과 달리 NACL은 **거부(DENY) 규칙을 만들 수 있으므로**, 특정 IP를 차단하는 용도로 활용합니다.  
>   (예: Rule 50에 공격 IP DENY → 다른 허용 규칙보다 먼저 평가되어 차단)

### 규칙 번호 설계 모범 사례

| 번호 범위 | 용도         | 예시              |
| --------- | ------------ | ----------------- |
| 100-199   | 웹 트래픽    | HTTP, HTTPS       |
| 200-299   | 관리 트래픽  | SSH, RDP          |
| 300-399   | 데이터베이스 | MySQL, PostgreSQL |
| 400-499   | 애플리케이션 | Custom ports      |
| 900-999   | 차단 규칙    | 특정 IP 차단      |

> [!TIP]
> **왜 규칙 번호를 1, 2, 3이 아니라 100, 110, 120으로 띄엄띄엄 설정하는가?**
>
> NACL 규칙은 한번 생성하면 **번호를 변경할 수 없습니다.** 삭제하고 다시 만들어야 합니다. 그래서 처음부터 간격을 두고 설계합니다.
>
> **실무 시나리오:**
>
> - 현재 규칙: Rule 100(HTTP 허용), Rule 200(SSH 허용)
> - 갑자기 "HTTP는 허용하되, 특정 IP만 차단"해야 하는 상황 발생
> - Rule 50에 해당 IP DENY를 추가하면 됨 (100보다 먼저 평가되어 차단)
> - 만약 1, 2, 3으로 붙여서 만들었다면? → 사이에 끼워넣을 번호가 없음 → 전체 규칙을 삭제하고 재생성해야 함
>
> **간격 설계 권장:**
>
> | 방식     | 예시                           | 장점                                |
> | -------- | ------------------------------ | ----------------------------------- |
> | 10 단위  | 100, 110, 120...               | 사이에 101 ~ 109를 끼워넣을 수 있음 |
> | 100 단위 | 100, 200, 300...               | 용도별 그룹화 + 사이에 50개씩 여유  |
> | 혼합     | 100 ~ 199(웹), 200 ~ 299(관리) | 그룹 내에서 10 단위로 세분화        |
>
> 이 실습에서는 10 단위(100, 110, 120, 130, 140)를 사용합니다. 긴급 차단이 필요하면 50번대에 DENY 규칙을 추가하면 됩니다.

32. 테스트를 위해 특정 IP를 차단하는 규칙을 추가해 봅니다 (선택 사항):
    - `my-public-nacl`의 Inbound rules에서 [[Edit inbound rules]] 클릭
    - [[Add new rule]] 클릭
    - **Rule number**: `50`
    - **Type**: `All traffic`
    - **Source**: `203.0.113.0/24` (예시 IP 대역)
    - **Allow/Deny**: `Deny`
    - [[Save changes]] 클릭

    <img src="/images/step1/1-3-step32-deny-rule1.png" alt="DENY 규칙 추가" class="guide-img-sm" />

    <img src="/images/step1/1-3-step32-deny-rule2.png" alt="DENY 규칙 저장" class="guide-img-sm" />

> [!NOTE]
> Rule 50은 Rule 100보다 먼저 평가됩니다.  
> 따라서 203.0.113.0/24 대역에서 오는 모든 트래픽은 HTTP, SSH 등의 허용 규칙보다 먼저 차단됩니다.  
> 이것이 NACL에서 특정 IP를 차단하는 방법입니다.

> [!TIP]
> **실제 차단 테스트는 Step 2-1에서 진행합니다.**
>
> 여기서 사용한 `203.0.113.0/24`는 문서 예시용 IP(RFC 5737)로, 실제 트래픽이 발생하지 않아 차단 효과를 체감할 수 없습니다.  
> Step 2-1에서 Amazon EC2를 생성한 뒤, 본인의 IP(`My IP`)를 DENY에 넣으면 실제로 웹 접속이 차단되는 것을 확인할 수 있습니다.
>
> 실무에서 긴급 차단이 필요한 경우:
>
> ```
> Rule 50: 공격 IP (예: 185.220.101.0/24) → All traffic → DENY
> ```
>
> 이렇게 낮은 번호에 DENY를 추가하면 다른 허용 규칙보다 먼저 평가되어 즉시 차단됩니다.

33. 테스트가 끝나면 Rule 50을 삭제합니다 (실습용이므로):
    - `my-public-nacl`의 **Inbound rules** 탭을 선택합니다.
    - [[Edit inbound rules]] 버튼을 클릭합니다.
    - Rule number `50`인 규칙의 왼쪽 [[Remove]] 버튼을 클릭합니다.
    - [[Save changes]] 버튼을 클릭합니다.

> [!NOTE]
> NACL 규칙은 번호를 수정할 수 없으므로, 변경이 필요하면 삭제 후 새로 생성해야 합니다.  
> 여기서는 테스트용으로 추가한 Rule 50만 삭제하고, 나머지 규칙(100~140)은 그대로 유지합니다.

✅ **태스크 완료**: 규칙 번호 순서 평가 원리를 이해했습니다.

## 태스크 6: 최종 구성 확인

<img src="/images/architecture/step1-3-nacl-architecture.png" alt="Step 1-3 최종 NACL 아키텍처" class="guide-img-lg" />

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

> [!NOTE]
> **실제 통신 차단/허용 테스트는 Step 2-1에서 진행합니다.**
>
> 이 실습에서는 NACL 규칙을 설계하고 생성했지만, Amazon VPC 내에 Amazon EC2 인스턴스가 없어 실제 트래픽 차단을 체험할 수 없습니다.  
> Step 2-1에서 Amazon EC2를 생성한 뒤, 옵션 태스크로 NACL 규칙을 변경하여 HTTP 접속이 차단/복구되는 것을 직접 확인합니다.
>
> - NACL DENY 규칙 추가 → 웹 접속 차단 확인.
> - DENY 규칙 제거 → 웹 접속 복구 확인.
> - 기본 NACL로 복원하여 이후 실습에 영향 없도록 정리.

# 🗑️ 리소스 정리

> [!NOTE]
> 이 실습에서 생성한 리소스(NACL)는 **항상 무료**입니다.  
> 다음 실습(Step 2: EC2)을 바로 이어서 진행하는 경우 삭제하지 않고 유지합니다.  
> 실습을 중단하거나 처음부터 다시 하고 싶은 경우에만 삭제하세요.

---

### 옵션 A: 다음 실습을 이어서 진행하는 경우 (권장)

NACL은 이후 실습(Step 2: EC2)에서 계속 사용합니다.  
**삭제하지 않고 그대로 유지합니다.**

> [!TIP]
> NACL은 프리티어와 무관하게 **항상 무료**인 리소스입니다. 유지해도 비용이 발생하지 않습니다.  
> 다음 실습에서 이 NACL을 그대로 활용합니다.

---

### 옵션 B: 리소스를 삭제하는 경우

실습을 중단하거나 환경을 초기화하고 싶은 경우, 아래 순서대로 삭제합니다.

> [!WARNING]
> 커스텀 NACL을 삭제하면 연결된 서브넷은 자동으로 **기본 NACL(모든 트래픽 허용)**로 돌아갑니다.  
> 기본 NACL은 모든 트래픽을 허용하므로 통신에 문제가 발생하지 않습니다.

**단계 1: Tag Editor로 생성된 리소스 확인**

1. AWS Management Console 상단 검색창에 `Resource Groups & Tag Editor`를 입력하고 선택합니다.
2. 왼쪽 메뉴에서 **Tag Editor**를 선택합니다.
3. 다음과 같이 설정합니다:
   - **Regions**: `ap-northeast-2`
   - **Resource types**: `All supported resource types`
   - **Tags**: Tag key = `Session`, Tag value = `1-3`
4. [[Search resources]] 버튼을 클릭합니다.

    <img src="/images/step1/1-3-cleanup4-tag-editor.png" alt="Tag Editor 검색 결과" class="guide-img-sm" />

5. 이 실습에서 생성한 리소스(`my-public-nacl`)가 표시되는지 확인합니다.

**단계 2: NACL의 서브넷 연결 해제**

NACL을 삭제하려면 먼저 연결된 서브넷을 해제해야 합니다.

6. 상단 검색창에 `VPC`를 입력하고 VPC 서비스를 선택합니다.
7. 왼쪽 메뉴에서 **Network ACLs**를 선택합니다.
8. `my-public-nacl`을 선택합니다.
9. **Subnet associations** 탭을 선택합니다.
10. [[Edit subnet associations]] 버튼을 클릭합니다.
11. 체크된 서브넷(`my-public-subnet-a`, `my-public-subnet-c`)을 모두 **해제**합니다.

    <img src="/images/step1/1-3-cleanup11-edit-subnet-assoc.png" alt="서브넷 해제" class="guide-img-sm" />
12. [[Save changes]] 버튼을 클릭합니다.

> [!NOTE]
> 서브넷 연결을 해제하면 해당 서브넷은 자동으로 기본 NACL에 연결됩니다.  
> 기본 NACL은 모든 인바운드/아웃바운드 트래픽을 허용하므로 통신에 문제가 없습니다.

**단계 3: NACL 삭제**

13. Network ACLs 목록에서 `my-public-nacl`이 선택된 상태에서 **Actions** 버튼을 클릭합니다.
14. [[Delete network ACL]]을 선택합니다.

    <img src="/images/step1/1-3-cleanup14-delete-nacl.png" alt="Delete network ACL" class="guide-img-sm" />
15. 확인 팝업에서 `delete`를 입력하고 [[Delete]]를 클릭합니다.

    <img src="/images/step1/1-3-cleanup15-nacl-deleted.png" alt="NACL 삭제 완료" class="guide-img-sm" />

> [!NOTE]
> 서브넷이 연결된 상태에서 NACL을 삭제하려고 하면 오류가 발생합니다.  
> 반드시 단계 2에서 서브넷 연결을 먼저 해제한 뒤 삭제하세요.
>
> 기본 NACL(Default 열이 `Yes`인 것)은 삭제할 수 없습니다. VPC 삭제 시 자동으로 함께 삭제됩니다.

**단계 4: 삭제 확인**

16. Network ACLs 목록에서 `my-public-nacl`이 사라졌는지 확인합니다.
17. 기본 NACL을 선택하고 **Subnet associations** 탭에서 `my-public-subnet-a`와 `my-public-subnet-c`가 다시 연결되어 있는지 확인합니다.

**단계 5: Tag Editor로 최종 확인**

18. 다시 **Tag Editor**로 이동합니다.
19. `Session: 1-3`으로 검색합니다.
20. 검색 결과에 리소스가 표시되지 않으면 모든 리소스가 성공적으로 삭제된 것입니다.

> [!NOTE]
> 삭제 직후에는 일부 리소스가 잠시 남아있을 수 있으나, 시간이 지나면 자동으로 사라집니다.

> [!TIP]
> **Step 1 전체 리소스를 한번에 확인하려면?**
>
> Tag Editor에서 Tag key = `Step`, Tag value = `step1`로 검색하면 Step 1-1, 1-2, 1-3에서 생성한 모든 리소스를 한번에 조회할 수 있습니다.  
> 실습 환경을 완전히 초기화하고 싶을 때 유용합니다.
>
> <img src="/images/step1/1-3-cleanup-step1-all.png" alt="Step 1 전체 리소스 조회" class="guide-img-sm" />
>
> | 검색 조건                  | 조회 범위                         |
> | -------------------------- | --------------------------------- |
> | `Session` = `1-3`          | 이 실습(NACL)에서 생성한 리소스만 |
> | `Step` = `step1`           | Step 1 전체(VPC, SG, NACL) 리소스 |
> | `CreatedBy` = `admin-user` | 내가 생성한 모든 실습 리소스      |

> [!TIP]
> 실습 환경에서 통신 문제가 발생하면 NACL을 먼저 의심하세요.  
> 커스텀 NACL의 규칙이 올바르지 않으면 서브넷 전체의 통신이 차단됩니다.  
> 문제 해결이 어려우면 서브넷을 기본 NACL에 다시 연결하세요.  
> (Network ACLs → 기본 NACL 선택 → Subnet associations → Edit → Public Subnet 체크 → Save)

✅ **실습 종료**: 모든 리소스가 정리되었습니다.

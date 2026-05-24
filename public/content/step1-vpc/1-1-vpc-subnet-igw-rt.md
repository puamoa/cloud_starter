---
title: 'Amazon VPC 생성과 서브넷·IGW·라우팅 테이블 구성'
week: 1
session: 1
awsServices:
  - Amazon VPC
  - Internet Gateway
  - Route Table
learningObjectives:
  - VPC와 CIDR 블록의 개념을 이해하고 직접 생성할 수 있습니다.
  - Public Subnet과 Private Subnet의 차이를 설명할 수 있습니다.
  - Internet Gateway를 생성하고 VPC에 연결할 수 있습니다.
  - Route Table을 구성하여 트래픽 흐름을 제어할 수 있습니다.
prerequisites:
  - AWS 계정 생성 완료
  - AWS Management Console 로그인 가능
estimatedCost: 무료 리소스 (VPC, Subnet, IGW, Route Table은 항상 무료)
---

이 실습에서는 AWS 네트워크의 기본 구성 요소인 VPC, Subnet, Internet Gateway, Route Table을 직접 생성합니다. 서울 리전(ap-northeast-2)에 2개의 가용 영역(2a, 2c)을 활용하여 Public Subnet 2개와 Private Subnet 2개를 구성합니다.

> [!NOTE]
> 이 실습은 AWS 네트워크의 첫 번째 단계입니다. 선행 조건 없이 처음부터 VPC를 생성합니다.

## 태스크 1: VPC 생성

> [!CONCEPT] VPC (Virtual Private Cloud)
> VPC는 AWS 클라우드 내에서 논리적으로 격리된 가상 네트워크입니다. 온프레미스의 데이터센터와 유사하게, VPC 안에서 서브넷을 나누고, 라우팅을 설정하고, 보안 규칙을 적용합니다.
>
> **CIDR 블록**은 VPC의 IP 주소 범위를 정의합니다. `10.0.0.0/16`은 10.0.0.0 ~ 10.0.255.255 범위로, 총 65,536개의 IP 주소를 사용할 수 있습니다.

### CIDR 설계

| 구분             | CIDR         | IP 범위                 | 용도          |
| ---------------- | ------------ | ----------------------- | ------------- |
| VPC              | 10.0.0.0/16  | 10.0.0.0 ~ 10.0.255.255 | 전체 네트워크 |
| Public Subnet A  | 10.0.1.0/24  | 10.0.1.0 ~ 10.0.1.255   | 웹 서버 (2a)  |
| Public Subnet C  | 10.0.2.0/24  | 10.0.2.0 ~ 10.0.2.255   | 웹 서버 (2c)  |
| Private Subnet A | 10.0.11.0/24 | 10.0.11.0 ~ 10.0.11.255 | DB 서버 (2a)  |
| Private Subnet C | 10.0.12.0/24 | 10.0.12.0 ~ 10.0.12.255 | DB 서버 (2c)  |

> [!TIP]
> Public Subnet은 1~10번대, Private Subnet은 11~20번대로 번호를 부여하면 나중에 서브넷이 늘어나도 구분하기 쉽습니다.

### 상세 단계

1. AWS Management Console에 로그인합니다.
2. 우측 상단에서 리전을 **Asia Pacific (Seoul) ap-northeast-2**로 설정합니다.
3. 상단 검색창에 `VPC`를 입력하고 **VPC** 서비스를 선택합니다.
4. 왼쪽 메뉴에서 **Your VPCs**를 선택합니다.
5. [[Create VPC]] 버튼을 클릭합니다.
6. 다음과 같이 설정합니다:
   - **Resources to create**: `VPC only` 선택
   - **Name tag**: `my-vpc`
   - **IPv4 CIDR block**: `IPv4 CIDR manual input` 선택
   - **IPv4 CIDR**: `10.0.0.0/16`
   - **IPv6 CIDR block**: `No IPv6 CIDR block`
   - **Tenancy**: `Default`

> [!NOTE]
> `VPC and more` 옵션을 선택하면 서브넷, IGW, Route Table을 한 번에 생성할 수 있지만, 이 실습에서는 각 구성 요소를 개별적으로 생성하여 동작 원리를 이해합니다.

7. [[Create VPC]] 버튼을 클릭합니다.

> [!OUTPUT]
> VPC가 생성되면 상세 페이지로 이동합니다. VPC ID(vpc-xxxxxxxx)를 메모해 두세요. 이후 단계에서 사용합니다.

✅ **태스크 완료**: VPC(10.0.0.0/16)가 생성되었습니다.

## 태스크 2: 서브넷 생성

> [!CONCEPT] Subnet (서브넷)
> 서브넷은 VPC의 IP 주소 범위를 더 작은 단위로 나눈 것입니다.
>
> - **Public Subnet**: Internet Gateway를 통해 인터넷과 직접 통신 가능
> - **Private Subnet**: 인터넷과 직접 통신 불가 (NAT를 통해서만 가능)
>
> 서브넷 자체에는 Public/Private 구분이 없습니다. Route Table에서 IGW로의 경로가 있으면 Public, 없으면 Private입니다.

### Public Subnet 생성

8. 왼쪽 메뉴에서 **Subnets**를 선택합니다.
9. [[Create subnet]] 버튼을 클릭합니다.
10. **VPC ID**에서 방금 생성한 `my-vpc`를 선택합니다.
11. **Subnet settings** 섹션에서 첫 번째 서브넷을 설정합니다:
    - **Subnet name**: `my-public-subnet-a`
    - **Availability Zone**: `ap-northeast-2a`
    - **IPv4 subnet CIDR block**: `10.0.1.0/24`

12. [[Add new subnet]] 버튼을 클릭하여 두 번째 서브넷을 추가합니다.
13. 두 번째 서브넷을 설정합니다:
    - **Subnet name**: `my-public-subnet-c`
    - **Availability Zone**: `ap-northeast-2c`
    - **IPv4 subnet CIDR block**: `10.0.2.0/24`

14. [[Add new subnet]] 버튼을 클릭하여 세 번째 서브넷을 추가합니다.
15. 세 번째 서브넷을 설정합니다:
    - **Subnet name**: `my-private-subnet-a`
    - **Availability Zone**: `ap-northeast-2a`
    - **IPv4 subnet CIDR block**: `10.0.11.0/24`

16. [[Add new subnet]] 버튼을 클릭하여 네 번째 서브넷을 추가합니다.
17. 네 번째 서브넷을 설정합니다:
    - **Subnet name**: `my-private-subnet-c`
    - **Availability Zone**: `ap-northeast-2c`
    - **IPv4 subnet CIDR block**: `10.0.12.0/24`

18. [[Create subnet]] 버튼을 클릭합니다.

> [!OUTPUT]
> 4개의 서브넷이 생성됩니다. Subnets 목록에서 `my-vpc`로 필터링하면 4개 모두 확인할 수 있습니다.

### Public Subnet에 Auto-assign Public IP 설정

Public Subnet에 생성되는 인스턴스가 자동으로 Public IP를 받도록 설정합니다.

19. Subnets 목록에서 `my-public-subnet-a`를 선택합니다.
20. **Actions** → **Edit subnet settings**를 선택합니다.
21. **Auto-assign IP settings** 섹션에서 **Enable auto-assign public IPv4 address**를 체크합니다.
22. [[Save]] 버튼을 클릭합니다.
23. 동일하게 `my-public-subnet-c`에도 Auto-assign public IPv4 address를 활성화합니다.

> [!WARNING]
> Private Subnet에는 Auto-assign public IP를 활성화하지 마세요. Private Subnet의 인스턴스는 Public IP가 필요하지 않으며, 보안상 외부에 노출되면 안 됩니다.

✅ **태스크 완료**: 4개의 서브넷(Public 2개, Private 2개)이 생성되었습니다.

## 태스크 3: Internet Gateway 생성 및 VPC 연결

> [!CONCEPT] Internet Gateway (IGW)
> Internet Gateway는 VPC와 인터넷 간의 통신을 가능하게 하는 게이트웨이입니다. VPC당 하나만 연결할 수 있으며, 수평 확장되어 대역폭 제한이 없습니다.

24. 왼쪽 메뉴에서 **Internet gateways**를 선택합니다.
25. [[Create internet gateway]] 버튼을 클릭합니다.
26. **Name tag**에 `my-igw`를 입력합니다.
27. [[Create internet gateway]] 버튼을 클릭합니다.

> [!NOTE]
> IGW가 생성되면 상태가 `Detached`입니다. VPC에 연결해야 사용할 수 있습니다.

28. 생성된 IGW 상세 페이지에서 **Actions** → **Attach to VPC**를 선택합니다.
29. **Available VPCs**에서 `my-vpc`를 선택합니다.
30. [[Attach internet gateway]] 버튼을 클릭합니다.

> [!OUTPUT]
> IGW 상태가 `Attached`로 변경됩니다. 이제 이 VPC의 리소스가 인터넷과 통신할 수 있는 경로가 열렸습니다 (Route Table 설정 후).

✅ **태스크 완료**: Internet Gateway가 생성되고 VPC에 연결되었습니다.

## 태스크 4: Route Table 설정

> [!CONCEPT] Route Table (라우팅 테이블)
> Route Table은 네트워크 트래픽이 어디로 향해야 하는지 결정하는 규칙 집합입니다.
>
> - **Public Route Table**: 0.0.0.0/0 → IGW (인터넷으로 나가는 트래픽을 IGW로 보냄)
> - **Private Route Table**: 0.0.0.0/0 경로 없음 (또는 NAT로 향함)
>
> VPC를 생성하면 기본 Route Table(Main)이 자동 생성됩니다. 이것은 Private용으로 사용하고, Public용은 별도로 생성합니다.

### Public Route Table 생성

31. 왼쪽 메뉴에서 **Route tables**를 선택합니다.
32. [[Create route table]] 버튼을 클릭합니다.
33. 다음과 같이 설정합니다:
    - **Name**: `my-public-rt`
    - **VPC**: `my-vpc` 선택
34. [[Create route table]] 버튼을 클릭합니다.

### Public Route Table에 인터넷 경로 추가

35. 생성된 `my-public-rt`의 상세 페이지에서 **Routes** 탭을 선택합니다.
36. [[Edit routes]] 버튼을 클릭합니다.
37. [[Add route]] 버튼을 클릭합니다.
38. 새 라우트를 설정합니다:
    - **Destination**: `0.0.0.0/0`
    - **Target**: `Internet Gateway` → `my-igw` 선택
39. [[Save changes]] 버튼을 클릭합니다.

> [!OUTPUT]
> Routes 탭에 두 개의 라우트가 표시됩니다:
>
> - `10.0.0.0/16` → local (VPC 내부 통신)
> - `0.0.0.0/0` → igw-xxxxxxxx (인터넷 통신)

### Public Route Table에 서브넷 연결

40. **Subnet associations** 탭을 선택합니다.
41. [[Edit subnet associations]] 버튼을 클릭합니다.
42. `my-public-subnet-a`와 `my-public-subnet-c`를 체크합니다.
43. [[Save associations]] 버튼을 클릭합니다.

> [!NOTE]
> 서브넷을 명시적으로 Route Table에 연결하지 않으면 VPC의 Main Route Table이 적용됩니다. Main Route Table에는 IGW 경로가 없으므로 Private Subnet처럼 동작합니다.

### Private Route Table 이름 지정

44. Route tables 목록에서 `my-vpc`의 **Main** Route Table을 선택합니다 (Yes로 표시된 것).
45. Name 열을 클릭하여 `my-private-rt`로 이름을 지정합니다.

> [!TIP]
> Private Subnet은 별도로 Route Table에 연결하지 않아도 됩니다. Main Route Table이 자동으로 적용되며, 이 테이블에는 IGW 경로가 없으므로 인터넷 접근이 차단됩니다.

✅ **태스크 완료**: Public Route Table과 Private Route Table이 구성되었습니다.

## 태스크 5: 구성 확인

최종적으로 생성된 리소스를 확인합니다.

46. 왼쪽 메뉴에서 **Your VPCs**를 선택하고 `my-vpc`가 있는지 확인합니다.
47. **Subnets**에서 4개의 서브넷이 모두 `my-vpc`에 속하는지 확인합니다.
48. **Internet gateways**에서 `my-igw`가 `my-vpc`에 Attached 상태인지 확인합니다.
49. **Route tables**에서 `my-public-rt`의 Routes에 `0.0.0.0/0 → igw` 경로가 있는지 확인합니다.
50. **Route tables**에서 `my-private-rt`의 Routes에 `10.0.0.0/16 → local`만 있는지 확인합니다.

> [!OUTPUT]
> 최종 아키텍처:
>
> ```
> VPC (10.0.0.0/16)
> ├── Public Subnet A (10.0.1.0/24, ap-northeast-2a) → my-public-rt → IGW
> ├── Public Subnet C (10.0.2.0/24, ap-northeast-2c) → my-public-rt → IGW
> ├── Private Subnet A (10.0.11.0/24, ap-northeast-2a) → my-private-rt (no IGW)
> └── Private Subnet C (10.0.12.0/24, ap-northeast-2c) → my-private-rt (no IGW)
> ```

✅ **태스크 완료**: 전체 VPC 네트워크 구성이 완료되었습니다.

## 마무리

다음을 성공적으로 수행했습니다:

- VPC(10.0.0.0/16)를 생성하고 CIDR 설계 원칙을 이해했습니다.
- 2개의 가용 영역에 Public Subnet 2개, Private Subnet 2개를 생성했습니다.
- Internet Gateway를 생성하고 VPC에 연결했습니다.
- Public Route Table에 IGW 경로를 추가하고 Public Subnet을 연결했습니다.
- Public Subnet에 Auto-assign Public IP를 활성화했습니다.

# 🗑️ 리소스 정리

> [!NOTE]
> 이 실습에서 생성한 리소스는 모두 무료이므로 삭제하지 않아도 비용이 발생하지 않습니다.

---

### 단계 1: 리소스 유지 권장

VPC, Subnet, IGW, Route Table은 이후 실습(EC2, RDS, ALB 등)에서 계속 사용합니다. **유지하는 것을 권장합니다.**

> [!NOTE]
> VPC, Subnet, IGW, Route Table은 프리티어와 무관하게 **항상 무료**인 리소스입니다. 삭제하지 않아도 비용이 발생하지 않습니다. 다만 리전당 VPC 개수 제한(기본 5개)이 있으므로, 불필요한 VPC는 정리하는 것이 좋습니다.

---

### 단계 2: 삭제 방법 (모든 실습 완료 후)

모든 실습이 끝난 후 정리하려면 **역순**으로 삭제해야 합니다. 의존 관계가 있는 리소스를 먼저 삭제하면 오류가 발생합니다.

1. VPC 콘솔 → **Route tables** → `my-public-rt` 선택 → **Subnet associations** 탭 → [[Edit subnet associations]] → 모든 서브넷 체크 해제 → [[Save associations]]
2. `my-public-rt` 선택 → **Actions** → [[Delete route table]] → 확인

> [!NOTE]
> Main Route Table(`my-private-rt`)은 VPC 삭제 시 자동으로 삭제됩니다. 별도로 삭제할 필요 없습니다.

3. **Internet gateways** → `my-igw` 선택 → **Actions** → [[Detach from VPC]] → 확인
4. `my-igw` 선택 → **Actions** → [[Delete internet gateway]] → 확인
5. **Subnets** → 4개 서브넷(`my-public-subnet-a`, `my-public-subnet-c`, `my-private-subnet-a`, `my-private-subnet-c`) 선택 → **Actions** → [[Delete subnet]] → 확인
6. **Your VPCs** → `my-vpc` 선택 → **Actions** → [[Delete VPC]] → 확인

---

### 단계 3: 삭제 확인

1. VPC 콘솔에서 `my-vpc`가 목록에 없는지 확인합니다.
2. Subnets, Internet gateways, Route tables에서 관련 리소스가 모두 사라졌는지 확인합니다.

✅ **실습 종료**: 모든 리소스가 정리되었습니다.

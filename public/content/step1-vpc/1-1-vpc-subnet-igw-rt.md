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

이 실습에서는 AWS 네트워크의 기본 구성 요소인 VPC, Subnet, Internet Gateway, Route Table을 직접 생성합니다.  
서울 리전(ap-northeast-2)에 2개의 가용 영역(2a, 2c)을 활용하여 Public Subnet 2개와 Private Subnet 2개를 구성합니다.

> [!NOTE]
> 이 실습은 AWS 네트워크의 첫 번째 단계입니다. 선행 조건 없이 처음부터 VPC를 생성합니다.

## 태스크 1: VPC 생성

> [!CONCEPT] VPC (Virtual Private Cloud)
> VPC는 AWS 클라우드 내에서 논리적으로 격리된 가상 네트워크입니다.  
> 온프레미스의 데이터센터와 유사하게, VPC 안에서 서브넷을 나누고, 라우팅을 설정하고, 보안 규칙을 적용합니다.
>
> `10.0.0.0/16`은 10.0.0.0 ~ 10.0.255.255 범위로, 총 65,536개의 IP 주소를 사용할 수 있습니다.

### CIDR 설계

| 구분             | CIDR         | IP 범위                 | 용도          |
| ---------------- | ------------ | ----------------------- | ------------- |
| VPC              | 10.0.0.0/16  | 10.0.0.0 ~ 10.0.255.255 | 전체 네트워크 |
| Public Subnet A  | 10.0.1.0/24  | 10.0.1.0 ~ 10.0.1.255   | 웹 서버 (2a)  |
| Public Subnet C  | 10.0.2.0/24  | 10.0.2.0 ~ 10.0.2.255   | 웹 서버 (2c)  |
| Private Subnet A | 10.0.11.0/24 | 10.0.11.0 ~ 10.0.11.255 | DB 서버 (2a)  |
| Private Subnet C | 10.0.12.0/24 | 10.0.12.0 ~ 10.0.12.255 | DB 서버 (2c)  |

> [!TIP]
> Public Subnet은 1 ~ 10번대, Private Subnet은 11 ~ 20번대로 번호를 부여하면 나중에 서브넷이 늘어나도 구분하기 쉽습니다.

### 상세 단계

1. AWS Management Console에 로그인합니다.
2. 우측 상단에서 리전을 **Asia Pacific (Seoul) ap-northeast-2**로 설정합니다.

    <img src="/images/common/region-check.png" alt="리전 확인" class="guide-img-sm" />

3. 상단 검색창에 `VPC`를 입력하고 **VPC** 서비스를 선택합니다.

    <img src="/images/step1/1-1-step3-vpc-search.png" alt="VPC 서비스 선택" class="guide-img-sm" />

4. 왼쪽 메뉴에서 **Your VPCs**를 선택합니다.
5. [[Create VPC]] 버튼을 클릭합니다.

    <img src="/images/step1/1-1-step5-create-vpc.png" alt="Create VPC 버튼 클릭" class="guide-img-sm" />

6. 다음과 같이 설정합니다:
   - **Resources to create**: `VPC only` 선택
   - **Name tag**: `my-vpc`
   - **IPv4 CIDR block**: `IPv4 CIDR manual input` 선택
   - **IPv4 CIDR**: `10.0.0.0/16`
   - **IPv6 CIDR block**: `No IPv6 CIDR block`
   - **Tenancy**: `Default`
   - **Tags**: 아래 3개 태그를 추가합니다.

| Key         | Value        |
| ----------- | ------------ |
| `CreatedBy` | `admin-user` |
| `Step`      | `step1`      |
| `Session`   | `1-1`        |

<img src="/images/step1/1-1-step6-vpc-settings.png" alt="VPC 설정 화면" class="guide-img-md" />

> [!CONCEPT] AWS 태그 (Tags)
> 태그는 AWS 리소스에 붙이는 **키-값 쌍 라벨**입니다. 리소스 자체의 동작에는 영향을 주지 않지만, 관리·비용 추적·정리에 매우 유용합니다.
>
> - **CreatedBy**: 누가 만들었는지. 팀 작업 시 책임 소재를 파악할 수 있습니다.
> - **Step**: 주차별 묶음. Tag Editor에서 `Step: step1`로 검색하면 1주차 리소스 전체를 조회할 수 있습니다.
> - **Session**: 세션별 구분. `Session: 1-1`로 검색하면 해당 세션에서 만든 리소스만 필터링할 수 있습니다.
>
> 이후 모든 실습에서 리소스를 생성할 때 이 3개 태그를 동일하게 적용합니다. (`Step`과 `Session` 값만 해당 실습에 맞게 변경)

> [!TIP]
> **태그 추가 방법**: Create VPC 화면 하단의 **Tags** 섹션에서 [[Add tag]]를 클릭하여 키-값을 입력합니다. `Name` 태그는 Name tag 필드에 입력하면 자동으로 추가됩니다.

> [!NOTE]
> `VPC and more` 옵션을 선택하면 서브넷, IGW, Route Table을 한 번에 생성할 수 있지만, 이 실습에서는 각 구성 요소를 개별적으로 생성하여 동작 원리를 이해합니다.

7. [[Create VPC]] 버튼을 클릭합니다.

    <img src="/images/step1/1-1-step7-vpc-created.png" alt="VPC 생성 완료" class="guide-img-md" />

> [!OUTPUT]
> VPC가 생성되면 상세 페이지로 이동합니다.
> VPC ID(vpc-xxxxxxxx)를 메모해 두세요. 이후 단계에서 사용합니다.

✅ **태스크 완료**: VPC(10.0.0.0/16)가 생성되었습니다.

## 태스크 2: 서브넷 생성

> [!CONCEPT] Subnet (서브넷)
> 서브넷은 VPC의 IP 주소 범위를 더 작은 단위로 나눈 것입니다.
>
> - **Public Subnet**: Internet Gateway를 통해 인터넷과 직접 통신할 수 있습니다.
> - **Private Subnet**: 인터넷과 직접 통신할 수 없습니다. (NAT를 통해서만 가능)
>
> 서브넷 자체에는 Public/Private 구분이 없습니다. Route Table에서 IGW로의 경로가 있으면 Public, 없으면 Private입니다.

### Public Subnet 생성

> [!NOTE]
> **서울 리전에서 ap-northeast-2a와 2c를 사용하는 이유:**
>
> 서울 리전에는 4개의 AZ(2a, 2b, 2c, 2d)가 있지만, 이 실습에서는 **2a와 2c**를 사용합니다.
>
> - `ap-northeast-2b`는 초기에 생성된 AZ로, 일부 최신 인스턴스 타입(예: t3, m5 등)을 지원하지 않거나 가용 용량이 제한적인 경우가 있습니다.
> - `ap-northeast-2d`는 가장 최근에 추가된 AZ로, 일부 서비스(RDS Multi-AZ, ElastiCache 등)에서 지원이 제한될 수 있습니다.
> - `ap-northeast-2a`와 `ap-northeast-2c`는 가장 범용적으로 모든 서비스와 인스턴스 타입을 안정적으로 지원합니다.
>
> 실무에서도 서울 리전에서는 2a + 2c 조합을 가장 많이 사용합니다.

8. 왼쪽 메뉴에서 **Subnets**를 선택합니다.
9. [[Create subnet]] 버튼을 클릭합니다.

    <img src="/images/step1/1-1-step9-create-subnet.png" alt="Create subnet 버튼 클릭" class="guide-img-sm" />

10. **VPC ID**에서 방금 생성한 `my-vpc`를 선택합니다.
11. **Subnet settings** 섹션에서 첫 번째 서브넷을 설정합니다:
    - **Subnet name**: `my-public-subnet-a`
    - **Availability Zone**: `ap-northeast-2a`
    - **IPv4 subnet CIDR block**: `10.0.1.0/24`
    - **Tags** (하단의 [[Add new tag]]를 클릭하여 추가):

      | Key         | Value        |
      | ----------- | ------------ |
      | `CreatedBy` | `admin-user` |
      | `Step`      | `step1`      |
      | `Session`   | `1-1`        |

    <img src="/images/step1/1-1-step11-subnet-settings.png" alt="서브넷 설정" class="guide-img-sm" />

> [!TIP]
> `Name` 태그는 Subnet name 필드에 입력하면 자동으로 추가됩니다. 나머지 3개 태그만 수동으로 추가하세요.  
> 4개 서브넷 모두에 동일한 태그를 넣어야 합니다. 서브넷을 추가할 때마다 각 서브넷의 Tags 섹션에서 동일하게 입력하세요.

12. [[Add new subnet]] 버튼을 클릭하여 두 번째 서브넷을 추가합니다.
13. 두 번째 서브넷을 설정합니다:
    - **Subnet name**: `my-public-subnet-c`
    - **Availability Zone**: `ap-northeast-2c`
    - **IPv4 subnet CIDR block**: `10.0.2.0/24`

14. [[Add new subnet]] 버튼을 클릭하여 세 번째 서브넷을 추가합니다.

    <img src="/images/step1/1-1-step14-add-subnet.png" alt="서브넷 추가" class="guide-img-sm" />

15. 세 번째 서브넷을 설정합니다:
    - **Subnet name**: `my-private-subnet-a`
    - **Availability Zone**: `ap-northeast-2a`
    - **IPv4 subnet CIDR block**: `10.0.11.0/24`
    - **Tags**: 11번과 동일
      - `CreatedBy` = `admin-user`
      - `Step` = `step1`
      - `Session` = `1-1`

> [!TIP]
> Private Subnet에도 동일한 태그를 넣어주세요.  
> 나중에 Tag Editor에서 `Session: 1-1`로 검색하면 이 실습에서 만든 Public/Private 서브넷을 한번에 조회할 수 있습니다.

16. [[Add new subnet]] 버튼을 클릭하여 네 번째 서브넷을 추가합니다.

    <img src="/images/step1/1-1-step16-add-subnet.png" alt="네 번째 서브넷 추가" class="guide-img-sm" />

17. 네 번째 서브넷을 설정합니다:
    - **Subnet name**: `my-private-subnet-c`
    - **Availability Zone**: `ap-northeast-2c`
    - **IPv4 subnet CIDR block**: `10.0.12.0/24`
    - **Tags**:
      - `CreatedBy` = `admin-user`
      - `Step` = `step1`
      - `Session` = `1-1`

18. [[Create subnet]] 버튼을 클릭합니다.

    <img src="/images/step1/1-1-step18-create-subnet.png" alt="Create subnet 클릭" class="guide-img-sm" />

    <img src="/images/step1/1-1-step18-subnet-created.png" alt="서브넷 생성 완료" class="guide-img-sm" />

> [!OUTPUT]
> 4개의 서브넷이 생성됩니다.
> Subnets 목록에서 my-vpc 로 필터링하면 4개 모두 확인할 수 있습니다.
>
> <img src="/images/step1/1-1-step18-subnet-list.png" alt="서브넷 목록 확인" class="guide-img-sm" />

### Public Subnet에 Auto-assign Public IP 설정

Public Subnet에 생성되는 인스턴스가 자동으로 Public IP를 받도록 설정합니다.

19. Subnets 목록에서 `my-public-subnet-a`를 선택합니다.
20. **Actions** → **Edit subnet settings**를 선택합니다.

    <img src="/images/step1/1-1-step20-edit-subnet.png" alt="Edit subnet settings" class="guide-img-sm" />

21. **Auto-assign IP settings** 섹션에서 ** ✅Enable auto-assign public IPv4 address**를 체크합니다.

    <img src="/images/step1/1-1-step21-auto-assign-ip.png" alt="Auto-assign public IP 활성화" class="guide-img-sm" />

22. [[Save]] 버튼을 클릭합니다.
23. 동일하게 `my-public-subnet-c`에도 Auto-assign public IPv4 address를 활성화합니다.

> [!TIP]
> **왜 Auto-assign Public IP를 설정하는가?**
>
> 이 설정을 활성화하면 이 서브넷에 EC2 인스턴스를 생성할 때 **자동으로 공인 IP가 할당**됩니다.  
> 활성화하지 않으면 인스턴스 생성 시 매번 수동으로 "Public IP 할당"을 선택해야 하고, 깜빡하면 인터넷 접속이 안 됩니다.
>
> - **활성화 O**: 서브넷에 인스턴스 생성 → 자동으로 Public IP 부여 → 인터넷 통신 가능.
> - **활성화 X**: 서브넷에 인스턴스 생성 → Public IP 없음 → IGW가 있어도 인터넷 통신 불가.
>
> 즉, Public Subnet이 진정한 "Public"이 되려면 **IGW 경로 + Public IP** 두 가지가 모두 필요합니다.

> [!WARNING]
> Private Subnet에는 Auto-assign public IP를 활성화하지 마세요.  
> Private Subnet의 인스턴스는 Public IP가 필요하지 않으며, 보안상 외부에 노출되면 안 됩니다.

✅ **태스크 완료**: 4개의 서브넷(Public 2개, Private 2개)이 생성되었습니다.

## 태스크 3: Internet Gateway 생성 및 VPC 연결

> [!CONCEPT] Internet Gateway (IGW)
> Internet Gateway는 VPC와 인터넷 간의 통신을 가능하게 하는 게이트웨이입니다.  
> VPC당 하나만 연결할 수 있으며, 수평 확장되어 대역폭 제한이 없습니다.

24. 왼쪽 메뉴에서 **Internet gateways**를 선택합니다.
25. [[Create internet gateway]] 버튼을 클릭합니다.

    <img src="/images/step1/1-1-step25-create-igw.png" alt="Create internet gateway 클릭" class="guide-img-sm" />

26. **Name tag**에 `my-igw`를 입력합니다.

> [!TIP]
> IGW에도 태그를 추가합니다:
>
> - `CreatedBy` = `admin-user`
> - `Step` = `step1`
> - `Session` = `1-1`

27. [[Create internet gateway]] 버튼을 클릭합니다.

    <img src="/images/step1/1-1-step27-igw-created.png" alt="IGW 생성 완료" class="guide-img-sm" />

    <img src="/images/step1/1-1-step27-igw-detached.png" alt="IGW Detached 상태" class="guide-img-sm" />

> [!NOTE]
> IGW가 생성되면 상태가 `Detached`입니다. VPC에 연결해야 사용할 수 있습니다.

28. 생성된 IGW 상세 페이지에서 **Actions** → **Attach to VPC**를 선택합니다.

    <img src="/images/step1/1-1-step28-attach-vpc.png" alt="Attach to VPC" class="guide-img-sm" />
29. **Available VPCs**에서 `my-vpc`를 선택합니다.

    <img src="/images/step1/1-1-step29-select-vpc.png" alt="VPC 선택" class="guide-img-sm" />

30. [[Attach internet gateway]] 버튼을 클릭합니다.

    <img src="/images/step1/1-1-step30-igw-attached.png" alt="IGW Attached 완료" class="guide-img-sm" />

> [!OUTPUT]
> IGW 상태가 Attached로 변경됩니다.
> 이제 이 VPC의 리소스가 인터넷과 통신할 수 있는 경로가 열렸습니다 (Route Table 설정 후).

✅ **태스크 완료**: Internet Gateway가 생성되고 VPC에 연결되었습니다.

> [!TIP]
> IGW를 VPC에 연결했지만, 아직 인터넷 통신은 되지 않습니다.  
> IGW는 "문"을 설치한 것이고, Route Table에서 `0.0.0.0/0 → IGW` 경로를 추가해야 "문을 열어주는" 것입니다.  
> 다음 태스크 4에서 이 경로를 설정합니다.

## 태스크 4: Route Table 설정

> [!CONCEPT] Route Table (라우팅 테이블)
> Route Table은 네트워크 트래픽이 어디로 향해야 하는지 결정하는 규칙 집합입니다.
>
> - **Public Route Table**: 0.0.0.0/0 → IGW (인터넷으로 나가는 트래픽을 IGW로 보냄)
> - **Private Route Table**: 0.0.0.0/0 경로 없음 (또는 NAT로 향합니다)
>
> VPC를 생성하면 기본 Route Table(Main)이 자동 생성됩니다. 이것은 Private용으로 사용하고, Public용은 별도로 생성합니다.

### Public Route Table 생성

31. 왼쪽 메뉴에서 **Route tables**를 선택합니다.
32. [[Create route table]] 버튼을 클릭합니다.

    <img src="/images/step1/1-1-step32-create-rt.png" alt="Create route table 클릭" class="guide-img-sm" />

33. 다음과 같이 설정합니다:
    - **Name**: `my-public-rt`
    - **VPC**: `my-vpc` 선택
    - **Tags**:
      - `CreatedBy` = `admin-user`
      - `Step` = `step1`
      - `Session` = `1-1`

    <img src="/images/step1/1-1-step33-rt-settings.png" alt="Route table 설정" class="guide-img-sm" />

34. [[Create route table]] 버튼을 클릭합니다.

    <img src="/images/step1/1-1-step34-rt-created.png" alt="Route table 생성 완료" class="guide-img-sm" />

### Public Route Table에 인터넷 경로 추가

35. 생성된 `my-public-rt`의 상세 페이지에서 **Routes** 탭을 선택합니다.
36. [[Edit routes]] 버튼을 클릭합니다.
37. [[Add route]] 버튼을 클릭합니다.
38. 새 라우트를 설정합니다:
    - **Destination**: `0.0.0.0/0`
    - **Target**: `Internet Gateway` → `my-igw` 선택

    <img src="/images/step1/1-1-step38-add-route.png" alt="라우트 추가 설정" class="guide-img-sm" />

39. [[Save changes]] 버튼을 클릭합니다.

    <img src="/images/step1/1-1-step39-save-routes.png" alt="Routes 저장 완료" class="guide-img-sm" />

> [!OUTPUT]
> Routes 탭에 두 개의 라우트가 표시됩니다:  
> 10.0.0.0/16 → local (VPC 내부 통신)  
> 0.0.0.0/0 → igw-xxxxxxxx (인터넷 통신)

### Public Route Table에 서브넷 연결

40. **Subnet associations** 탭을 선택합니다.
41. [[Edit subnet associations]] 버튼을 클릭합니다.

    <img src="/images/step1/1-1-step41-edit-subnet-assoc.png" alt="Edit subnet associations" class="guide-img-sm" />

42. `my-public-subnet-a`와 `my-public-subnet-c`를 체크합니다.

    <img src="/images/step1/1-1-step42-select-subnets.png" alt="서브넷 선택" class="guide-img-sm" />

43. [[Save associations]] 버튼을 클릭합니다.

    <img src="/images/step1/1-1-step43-save-assoc.png" alt="Subnet associations 저장" class="guide-img-sm" />

> [!NOTE]
> 서브넷을 명시적으로 Route Table에 연결하지 않으면 VPC의 Main Route Table이 적용됩니다.  
> Main Route Table에는 IGW 경로가 없으므로 Private Subnet처럼 동작합니다.

### Private Route Table 생성 (AZ별 분리)

44. [[Create route table]] 버튼을 클릭합니다.
45. 다음과 같이 설정합니다:
    - **Name**: `my-private-rt-a`
    - **VPC**: `my-vpc` 선택
    - **Tags**:
      - `CreatedBy` = `admin-user`
      - `Step` = `step1`
      - `Session` = `1-1`

    <img src="/images/step1/1-1-step45-private-rt-settings.png" alt="Private Route Table 설정" class="guide-img-sm" />

46. [[Create route table]] 버튼을 클릭합니다.
47. **Subnet associations** 탭을 선택하고 [[Edit subnet associations]]를 클릭합니다.
48. `my-private-subnet-a`를 체크하고 [[Save associations]]를 클릭합니다.

    <img src="/images/step1/1-1-step48-private-rt-a-assoc.png" alt="Private Subnet A 연결" class="guide-img-sm" />

    <img src="/images/step1/1-1-step48-private-rt-a-saved.png" alt="Private RT A 연결 완료" class="guide-img-sm" />

49. 다시 Route tables 목록으로 돌아가 [[Create route table]] 버튼을 클릭합니다.
50. 다음과 같이 설정합니다:
    - **Name**: `my-private-rt-c`
    - **VPC**: `my-vpc` 선택
    - **Tags**:
      - `CreatedBy` = `admin-user`
      - `Step` = `step1`
      - `Session` = `1-1`

    <img src="/images/step1/1-1-step50-private-rt-c-settings.png" alt="Private RT C 설정" class="guide-img-sm" />

51. [[Create route table]] 버튼을 클릭합니다.
52. **Subnet associations** 탭을 선택하고 [[Edit subnet associations]]를 클릭합니다.
53. `my-private-subnet-c`를 체크하고 [[Save associations]]를 클릭합니다.

    <img src="/images/step1/1-1-step53-private-rt-c-assoc.png" alt="Private Subnet C 연결" class="guide-img-sm" />

    <img src="/images/step1/1-1-step53-private-rt-c-saved.png" alt="Private RT C 연결 완료" class="guide-img-sm" />

> [!TIP]
> **왜 Private Subnet마다 별도의 Route Table을 만드는가?**
>
> 학습 단계에서는 하나의 Private RT를 공유해도 동작하지만, 실무에서는 AZ별·용도별로 분리하는 것이 모범 사례입니다:
>
> **1. NAT Gateway 이중화 (AZ별 분리)**
>
> Step 3에서 NAT Gateway를 추가할 때, AZ-a의 NAT GW는 `my-private-rt-a`에, AZ-c의 NAT GW는 `my-private-rt-c`에 연결합니다.  
> 하나의 AZ에 장애가 발생해도 다른 AZ의 Private Subnet은 독립적으로 인터넷에 접근할 수 있습니다.
>
> **2. 용도별 경로 분리 (실무 핵심)**
>
> 실무에서는 같은 Private Subnet이라도 용도에 따라 라우팅이 달라야 합니다:
>
> - **App Subnet (NAT 연결)**: 앱 서버가 외부 API 호출, 패키지 설치 등을 위해 `0.0.0.0/0 → NAT GW` 경로가 필요.
> - **DB Subnet (완전 폐쇄)**: RDS, ElastiCache 등은 인터넷 접근이 전혀 불필요. NAT 경로조차 없어야 보안상 안전. `10.0.0.0/16 → local`만 존재.
>
> RT를 공유하면 이런 분리가 불가능합니다.  
> DB Subnet에 NAT 경로가 생기면 DB에서 외부로 데이터가 유출될 수 있는 경로가 열리는 셈입니다.
>
> **3. 장애 격리**
>
> RT를 공유하면 잘못된 경로 하나가 모든 Private Subnet에 영향을 미칩니다.  
> 분리하면 한쪽 RT에 문제가 생겨도 다른 서브넷은 정상 동작합니다.
>
> ```
> 실무 3-Tier 구성 예시:
>
>   App Subnet A (AZ-a) → app-private-rt-a → NAT GW A (인터넷 단방향 허용)
>   App Subnet C (AZ-c) → app-private-rt-c → NAT GW C (인터넷 단방향 허용)
>   DB Subnet A  (AZ-a) → db-private-rt    → local만 (완전 폐쇄, 인터넷 경로 없음)
>   DB Subnet C  (AZ-c) → db-private-rt    → local만 (완전 폐쇄, 인터넷 경로 없음)
>
>   → App 서버: 외부 API 호출, 패키지 업데이트 가능
>   → DB 서버: VPC 내부 통신만 가능, 외부 유출 경로 원천 차단
> ```
>
> 이 실습에서는 간단히 AZ별로 분리하지만, 이후 Step 3(NAT)과 Step 4(RDS)에서 이 구조의 실제 효과를 체험하게 됩니다.

✅ **태스크 완료**: Public Route Table 1개와 Private Route Table 2개(AZ별 분리)가 구성되었습니다.

## 태스크 5: 구성 확인

최종적으로 생성된 리소스를 확인합니다.

### Resource Map으로 전체 구성 시각화

54. 왼쪽 메뉴에서 **Your VPCs**를 선택하고 `my-vpc`를 클릭합니다.
55. 상세 페이지에서 **Resource map** 탭을 선택합니다.

    <img src="/images/step1/1-1-step55-resource-map.png" alt="Resource Map 전체 구성" class="guide-img-sm" />

56. VPC에 연결된 모든 리소스(서브넷, Route Table, IGW, 네트워크 연결)가 다이어그램으로 표시되는지 확인합니다.

> [!TIP]
> **Resource Map**은 VPC의 전체 네트워크 구성을 시각적으로 보여주는 기능입니다.
>
> - 서브넷이 어떤 Route Table에 연결되어 있는지 한눈에 파악할 수 있습니다.
> - IGW, NAT Gateway 등의 연결 관계를 시각적으로 확인할 수 있습니다.
> - 리소스를 클릭하면 해당 리소스의 상세 페이지로 이동합니다.
> - 실습 중 "내가 제대로 연결했나?" 확인할 때 가장 빠른 방법입니다.
>
> 이후 Step에서 NAT Gateway, EC2, RDS 등을 추가하면 Resource Map에 자동으로 반영됩니다.

### 개별 리소스 확인

57. **Subnets**에서 상단 필터에 `my-vpc`를 입력하여 VPC로 필터링한 뒤, 4개의 서브넷이 모두 표시되는지 확인합니다.
58. **Internet gateways**에서 `my-igw`가 `my-vpc`에 Attached 상태인지 확인합니다.
59. **Route tables**에서 `my-public-rt`의 Routes에 `0.0.0.0/0 → igw` 경로가 있는지 확인합니다.
60. **Route tables**에서 `my-private-rt-a`와 `my-private-rt-c`의 Routes에 `10.0.0.0/16 → local`만 있는지 확인합니다.

> [!OUTPUT]
> 최종 아키텍처:
>
> ```
> VPC (10.0.0.0/16)
> ├── Public Subnet A (10.0.1.0/24, ap-northeast-2a)   → my-public-rt    → IGW
> ├── Public Subnet C (10.0.2.0/24, ap-northeast-2c)   → my-public-rt    → IGW
> ├── Private Subnet A (10.0.11.0/24, ap-northeast-2a) → my-private-rt-a (no IGW)
> └── Private Subnet C (10.0.12.0/24, ap-northeast-2c) → my-private-rt-c (no IGW)
> ```

✅ **태스크 완료**: 전체 VPC 네트워크 구성이 완료되었습니다.

## 마무리

다음을 성공적으로 수행했습니다:

- VPC(10.0.0.0/16)를 생성하고 CIDR 설계 원칙을 이해했습니다.
- 2개의 가용 영역에 Public Subnet 2개, Private Subnet 2개를 생성했습니다.
- Internet Gateway를 생성하고 VPC에 연결했습니다.
- Public Route Table에 IGW 경로를 추가하고 Public Subnet을 연결했습니다.
- Private Route Table을 AZ별로 분리하여 생성하고 각 Private Subnet에 연결했습니다.
- Public Subnet에 Auto-assign Public IP를 활성화했습니다.

> [!TIP]
> **콘솔(UI) 작업의 한계와 실무에서의 인프라 관리**
>
> 이 실습에서는 AWS 콘솔에서 수동으로 리소스를 생성했습니다. 학습에는 좋지만, 콘솔 작업에는 다음과 같은 위험이 있습니다:
>
> - **실수 가능성**: 클릭 한 번으로 잘못된 리소스를 삭제하거나, 설정을 빠뜨릴 수 있습니다.
> - **재현 불가**: 동일한 환경을 다시 만들려면 모든 단계를 기억하고 반복해야 합니다.
> - **감사 어려움**: 누가 언제 무엇을 변경했는지 추적이 어렵습니다.
> - **휴먼 에러**: 서브넷 CIDR을 잘못 입력하거나, Route Table 연결을 빠뜨리는 등의 실수가 빈번합니다.
>
> **실무에서는 다음과 같이 사용합니다:**
>
> | 방식                                | 사용 시점                            | 장점                            |
> | ----------------------------------- | ------------------------------------ | ------------------------------- |
> | **콘솔 (UI)**                       | 빠른 확인, 디버깅, 일회성 작업, 학습 | 시각적, 직관적                  |
> | **AWS CLI**                         | 반복 작업 자동화, 스크립트 작성      | 빠르고 재현 가능                |
> | **IaC (CloudFormation, Terraform)** | 인프라 구축·변경·삭제 전체           | 코드 리뷰, 버전 관리, 롤백 가능 |
>
> 다음 Step(1-2)에서는 "VPC and more" 마법사로 한번에 구성하고, Step 2-1부터는 CloudFormation으로 환경을 자동 프로비저닝합니다.  
> 점진적으로 자동화 수준을 높여가는 것이 이 가이드의 학습 흐름입니다.

# 🗑️ 리소스 정리

> [!WARNING]
> 이 실습에서 생성한 리소스(VPC, Subnet, IGW, Route Table)는 모두 **항상 무료**이지만, Step 1-2에서 "VPC and more"로 한번에 구성하는 것을 학습하기 위해 삭제합니다.

---

### 단계 1: Tag Editor로 생성된 리소스 확인

삭제 전에 이 실습에서 생성한 리소스를 Tag Editor로 확인합니다.

> [!CONCEPT] Tag Editor란?
> **Tag Editor**는 AWS 콘솔에서 제공하는 리소스 검색 도구입니다. 리전과 태그를 기준으로 모든 AWS 리소스를 한번에 조회할 수 있어, 실습 후 정리할 리소스를 빠르게 파악할 때 유용합니다.
>
> - 여러 서비스에 흩어진 리소스를 태그 하나로 모아볼 수 있습니다.
> - 리소스를 클릭하면 해당 서비스 콘솔로 바로 이동할 수 있습니다.
> - 삭제 기능은 없으므로, 확인 후 각 서비스 콘솔에서 직접 삭제해야 합니다.

1. AWS Management Console 상단 검색창에 `Resource Groups & Tag Editor`를 입력하고 선택합니다.

    <img src="/images/step1/1-1-cleanup1-tag-editor.png" alt="Tag Editor 검색" class="guide-img-sm" />

2. 왼쪽 메뉴에서 **Tag Editor**를 선택합니다.
3. 다음과 같이 설정합니다:
   - **Regions**: `ap-northeast-2`
   - **Resource types**: `All supported resource types`
   - **Tags**: Tag key = `Session`, Tag value = `1-1`
4. [[Search resources]] 버튼을 클릭합니다.

    <img src="/images/step1/1-1-cleanup4-search-results.png" alt="Tag Editor 검색 결과" class="guide-img-sm" />

5. 이 실습에서 생성한 리소스(VPC, Subnet 4개, IGW, Route Table 3개)가 표시되는지 확인합니다.

> [!WARNING]
> **Tag Editor의 한계: 모든 리소스가 검색되는 것은 아닙니다.**
>
> - 태그를 지원하지 않는 리소스(일부 설정, 연결 정보 등)는 표시되지 않습니다.
> - 태그를 붙이지 않은 리소스는 당연히 검색되지 않습니다.
> - Route Table의 라우트(경로) 자체, Subnet association 등은 별도 리소스가 아니므로 표시되지 않습니다.
> - CloudWatch Log Group, IAM 역할 등 일부 글로벌 서비스는 리전 필터에 걸리지 않을 수 있습니다.
>
> Tag Editor는 **보조 확인 수단**입니다. 최종적으로는 각 서비스 콘솔에서 직접 리소스가 삭제되었는지 확인하세요.

> [!TIP]
> Tag Editor는 리소스를 찾는 용도로만 사용합니다. 실제 삭제는 다음 단계에서 수행합니다.

---

### 단계 2: VPC 삭제

VPC 내에 EC2, RDS, NAT Gateway 등 다른 리소스가 없는 경우, VPC를 삭제하면 연결된 리소스가 함께 삭제됩니다.

6. 상단 검색창에 `VPC`를 입력하고 VPC 서비스를 선택합니다.
7. 왼쪽 메뉴에서 **Your VPCs**를 선택합니다.
8. `my-vpc`를 선택합니다.
9. **Actions** → [[Delete VPC]]를 선택합니다.

    <img src="/images/step1/1-1-cleanup9-delete-vpc.png" alt="Delete VPC 선택" class="guide-img-sm" />

10. 확인 팝업에서 `delete`를 입력하고 [[Delete]]를 클릭합니다.

    <img src="/images/step1/1-1-cleanup10-confirm-delete.png" alt="삭제 확인" class="guide-img-sm" />

    <img src="/images/step1/1-1-cleanup10-deleting.png" alt="VPC 삭제 중" class="guide-img-sm" />

    <img src="/images/step1/1-1-cleanup10-deleted.png" alt="VPC 삭제 완료" class="guide-img-sm" />

> [!NOTE]
> VPC 삭제 시 다음 리소스가 자동으로 함께 삭제됩니다:
>
> - 서브넷 (4개)
> - 커스텀 Route Table (`my-public-rt`, `my-private-rt-a`, `my-private-rt-c`)
> - Internet Gateway (자동 Detach 후 삭제)
> - 기본 Security Group, 기본 NACL, Main Route Table
>
> 단, VPC 내에 EC2 인스턴스, NAT Gateway, VPN, Elastic IP 등이 남아있으면 삭제가 실패합니다.  
> 그 경우 아래 "📚 참고: 개별 삭제 방법"을 참고하세요.

---

### 단계 3: 삭제 확인

11. VPC 콘솔에서 `my-vpc`가 목록에 없는지 확인합니다.
12. **Subnets**에서 `my-public-subnet-a`, `my-public-subnet-c`, `my-private-subnet-a`, `my-private-subnet-c`가 사라졌는지 확인합니다.
13. **Internet gateways**에서 `my-igw`가 사라졌는지 확인합니다.
14. **Route tables**에서 `my-public-rt`, `my-private-rt-a`, `my-private-rt-c`가 사라졌는지 확인합니다.

---

### 단계 4: Tag Editor로 최종 확인

15. 다시 **Tag Editor**로 이동합니다.
16. 단계 1과 동일하게 `Session: 1-1`로 검색합니다.
17. 검색 결과에 리소스가 표시되지 않으면 모든 리소스가 성공적으로 삭제된 것입니다.

> [!NOTE]
> 삭제 직후에는 일부 리소스가 잠시 남아있을 수 있으나, 시간이 지나면 자동으로 사라집니다.

✅ **실습 종료**: 모든 리소스가 정리되었습니다. Step 1-2에서 "VPC and more"로 다시 구성합니다.

---

### 📚 참고: 개별 리소스 역순 삭제 (VPC 삭제 실패 시)

VPC 삭제가 실패하는 경우, 의존 관계가 있는 리소스를 **생성의 역순**으로 개별 삭제해야 합니다.

> [!NOTE]
> **VPC 삭제가 실패하는 주요 원인:**
>
> - VPC 내에 EC2 인스턴스가 실행 중입니다. (Terminated가 아닌 상태)
> - NAT Gateway가 남아있습니다.
> - Elastic IP가 할당되어 있습니다.
> - VPN 연결이 존재합니다.
> - 다른 서비스(RDS, ELB 등)가 서브넷을 사용 중입니다.
>
> 오류 메시지에 "has dependencies" 또는 "is being used by" 등이 표시되면, 해당 리소스를 먼저 삭제해야 합니다.

> [!TIP]
> **삭제 순서 원칙**: 다른 리소스가 참조하고 있는 리소스는 마지막에 삭제합니다.
>
> ```
> 생성 순서: VPC → Subnet → IGW 연결 → Route Table
> 삭제 순서: Route Table → IGW → Subnet → VPC (역순)
> ```

**① Route Table 삭제:**

Route Table을 삭제하려면 먼저 연결된 서브넷을 해제해야 합니다.

18. 왼쪽 메뉴에서 **Route tables**를 선택합니다.
19. `my-public-rt`를 선택합니다.
20. **Subnet associations** 탭을 선택합니다.
21. [[Edit subnet associations]]를 클릭합니다.

    <img src="/images/step1/1-1-cleanup21-edit-subnet-assoc.png" alt="Edit subnet associations" class="guide-img-sm" />

22. 체크된 서브넷을 모두 해제합니다.
23. [[Save associations]]를 클릭합니다.

    <img src="/images/step1/1-1-cleanup23-save-assoc.png" alt="Save associations" class="guide-img-sm" />

24. 다시 `my-public-rt`를 선택한 상태에서 **Actions** → [[Delete route table]]을 선택합니다.

    <img src="/images/step1/1-1-cleanup24-delete-rt.png" alt="Delete route table 선택" class="guide-img-sm" />

25. 확인 팝업에서 `delete`를 입력하고 [[Delete]]를 클릭합니다.

    <img src="/images/step1/1-1-cleanup25-rt-deleted.png" alt="Route table 삭제 완료" class="guide-img-sm" />
26. 동일하게 `my-private-rt-a`도 Subnet associations 해제 → 삭제합니다.
27. 동일하게 `my-private-rt-c`도 Subnet associations 해제 → 삭제합니다.

> [!TIP]
> Route Table은 목록에서 여러 개를 체크하여 한번에 삭제할 수도 있습니다.  
> 단, Subnet associations가 남아있으면 삭제가 실패하므로 각각 해제 후 진행하세요.

> [!NOTE]
> Main Route Table(VPC 생성 시 자동 생성된 것)은 수동 삭제할 수 없습니다. VPC 삭제 시 자동으로 함께 삭제됩니다.

**② Internet Gateway 삭제:**

IGW를 삭제하려면 먼저 VPC에서 분리(Detach)해야 합니다.

28. 왼쪽 메뉴에서 **Internet gateways**를 선택합니다.
29. `my-igw`를 선택합니다.
30. **Actions** → [[Detach from VPC]]를 선택합니다.

    <img src="/images/step1/1-1-cleanup30-detach-igw.png" alt="Detach from VPC 선택" class="guide-img-sm" />

31. 확인 팝업에서 `detach`를 입력하고 [[Detach internet gateway]]를 클릭합니다.

    <img src="/images/step1/1-1-cleanup31-confirm-detach.png" alt="Detach 확인" class="guide-img-sm" />
32. 상태가 `Detached`로 변경된 것을 확인합니다.
33. 다시 `my-igw`를 선택한 상태에서 **Actions** → [[Delete internet gateway]]를 선택합니다.

    <img src="/images/step1/1-1-cleanup33-delete-igw.png" alt="Delete internet gateway 선택" class="guide-img-sm" />

34. 확인 팝업에서 `delete`를 입력하고 [[Delete internet gateway]]를 클릭합니다.

    <img src="/images/step1/1-1-cleanup34-igw-deleted.png" alt="IGW 삭제 완료" class="guide-img-sm" />

> [!WARNING]
> IGW는 반드시 **Detach → Delete** 순서로 진행해야 합니다. VPC에 연결된 상태에서는 "The internet gateway is in use" 오류가 발생합니다.

**③ Subnet 삭제:**

35. 왼쪽 메뉴에서 **Subnets**를 선택합니다.
36. 상단 필터에서 `my-vpc`로 필터링합니다.
37. 4개 서브넷(`my-public-subnet-a`, `my-public-subnet-c`, `my-private-subnet-a`, `my-private-subnet-c`)을 모두 체크합니다.
38. **Actions** → [[Delete subnet]]을 선택합니다.

    <img src="/images/step1/1-1-cleanup38-delete-subnet.png" alt="Delete subnet 선택" class="guide-img-sm" />

39. 확인 팝업에서 `delete`를 입력하고 [[Delete]]를 클릭합니다.

    <img src="/images/step1/1-1-cleanup39-subnet-deleted.png" alt="Subnet 삭제 완료" class="guide-img-sm" />

> [!NOTE]
> 서브넷에 EC2 인스턴스나 ENI(네트워크 인터페이스)가 남아있으면 삭제가 실패합니다.  
> EC2 콘솔에서 해당 인스턴스를 Terminate한 뒤 다시 시도하세요.

**④ VPC 삭제:**

40. 왼쪽 메뉴에서 **Your VPCs**를 선택합니다.
41. `my-vpc`를 선택합니다.
42. **Actions** → [[Delete VPC]]를 선택합니다.

    <img src="/images/step1/1-1-cleanup42-delete-vpc.png" alt="Delete VPC 선택" class="guide-img-sm" />

43. 확인 팝업에서 `delete`를 입력하고 [[Delete]]를 클릭합니다.

    <img src="/images/step1/1-1-cleanup43-vpc-deleted.png" alt="VPC 삭제 완료" class="guide-img-sm" />

> [!NOTE]
> VPC 삭제 시 Main Route Table, 기본 Security Group, 기본 NACL이 자동으로 함께 삭제됩니다.

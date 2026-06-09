---
title: 'draw.io로 AWS 아키텍처 다이어그램 작성'
week: 12
session: 1
awsServices: []
learningObjectives:
  - Draw.io를 사용하여 AWS 아키텍처 다이어그램을 작성할 수 있습니다.
  - AWS 아이콘 라이브러리를 활용하여 서비스를 시각적으로 표현할 수 있습니다.
  - VPC, 서브넷, AZ 등 네트워크 구성을 다이어그램으로 표현할 수 있습니다.
  - 아키텍처 다이어그램을 PNG 파일로 내보낼 수 있습니다.
prerequisites:
  - AWS 기본 서비스 이해 (Step 1~11 학습 완료)
  - 네트워킹 기본 개념
estimatedCost: 무료 (AWS 리소스를 생성하지 않습니다)
---

이 실습에서는 **Draw.io**를 사용하여 지금까지 학습한 AWS 인프라의 아키텍처 다이어그램을 작성합니다.

### 이 실습을 통해 얻을 수 있는 것

- **아키텍처 시각화 능력**: AWS 서비스 간의 관계와 네트워크 흐름을 다이어그램으로 표현하는 방법을 익힙니다.
- **설계 검증**: 다이어그램을 그리면서 "이 서비스는 어디에 배치해야 하는가?", "어떤 서브넷에 놓아야 하는가?"를 스스로 점검할 수 있습니다.
- **커뮤니케이션 도구**: 팀원, 면접관, 고객에게 인프라 구조를 설명할 때 말보다 그림 한 장이 더 효과적입니다.
- **포트폴리오 산출물**: 완성된 아키텍처 다이어그램은 기술 면접이나 이력서에 첨부할 수 있는 구체적인 산출물입니다.

### 아키텍처 다이어그램이란?

아키텍처 다이어그램은 시스템의 구성 요소와 그 관계를 시각적으로 표현한 것입니다.  
AWS에서는 공식 아이콘을 사용하여 서비스를 표현하고, 그룹(VPC, Subnet, AZ)으로 네트워크 경계를 나타냅니다.

<img src="/images/step12/my-architecture.png" alt="3-Tier 아키텍처 다이어그램 예시" class="guide-img-lg" />

**좋은 아키텍처 다이어그램의 조건:**
- 한눈에 전체 구조를 파악할 수 있어야 합니다.
- 네트워크 경계(Public/Private)가 명확해야 합니다.
- 트래픽 흐름(화살표)이 직관적이어야 합니다.
- 과도한 정보 없이 핵심만 담아야 합니다.

Draw.io의 **AWS 아이콘 라이브러리**를 활용하여 VPC, 서브넷, IGW, EC2, RDS 등 AWS 서비스를 시각적으로 배치하고, 네트워크 흐름과 보안 구성을 다이어그램으로 표현합니다.

> [!NOTE]
> 이 실습은 Draw.io를 사용한 다이어그램 작성 실습으로, **AWS 리소스를 생성하지 않습니다.**  
> draw.io는 무료 온라인 다이어그램 도구이며, 별도의 설치 없이 웹 브라우저에서 바로 사용할 수 있습니다.

> [!TIP]
> 이 실습에서는 기본적인 배치 방법과 draw.io 조작법을 학습합니다.  
> 실제 다이어그램의 구성과 배치는 학습자가 자신의 아키텍처 설계에 맞게 자유롭게 구성하세요.  
> 정답은 없으며, 아키텍처를 명확하게 전달할 수 있으면 됩니다.

> [!TIP]
> **draw.io AWS 아이콘 버전 참고**:  
> draw.io에 내장된 AWS 아이콘 라이브러리는 버전에 따라 색상이나 그룹 스타일이 다를 수 있습니다.  
> 예를 들어 서브넷/AZ 그룹의 색상, Security Group 아이콘 디자인 등이 이 가이드의 이미지와 약간 다르게 보일 수 있습니다.  
> 기능적으로는 동일하므로, 제공되는 아이콘을 그대로 사용하면 됩니다.  
> 최신 공식 아이콘이 필요한 경우 [AWS Architecture Icons](https://aws.amazon.com/architecture/icons/)에서 다운로드할 수 있습니다.

## 태스크 1: Draw.io 환경 설정

이 태스크에서는 Draw.io 작업 환경을 설정하고 AWS 아이콘 라이브러리를 로드합니다.

### 상세 단계

1. 웹 브라우저에서 다음 URL에 접속합니다: `https://app.diagrams.net/?splash=0&libs=aws4&lang=ko`

    <img src="/images/step12/12-1-step1-drawio-open.png" alt="draw.io 접속 화면" class="guide-img-sm" />

> [!NOTE]
> URL 파라미터 설명:
> - `splash=0`: 시작 화면을 건너뜁니다.
> - `libs=aws4`: AWS 아이콘 라이브러리를 자동으로 로드합니다.
> - `lang=ko`: 한국어 인터페이스를 설정합니다.
>
> 접속하면 자동으로 빈 다이어그램이 열리고, 왼쪽 패널에 AWS 아이콘 라이브러리가 로드됩니다.

### 다이어그램 이름 설정

2. 상단의 **제목 없는 다이어그램**을 클릭합니다.

    <img src="/images/step12/12-1-step2-diagram-name.png" alt="다이어그램 이름 클릭" class="guide-img-sm" />

3. **파일명** 필드에 `my-architecture`를 입력합니다.
4. **유형**은 `XML 파일 (.drawio)`로 유지합니다.

    <img src="/images/step12/12-1-step4-diagram-type.png" alt="다이어그램 유형 설정" class="guide-img-sm" />

5. [[이름 바꾸기]] 버튼을 클릭합니다.

    <img src="/images/step12/12-1-step5-rename-complete.png" alt="이름 바꾸기 완료" class="guide-img-sm" />

### 다이어그램 저장

6. 상단 메뉴에서 **파일** > **저장**을 선택합니다.

    <img src="/images/step12/12-1-step6-save-menu.png" alt="파일 저장 메뉴" class="guide-img-sm" />

7. **위치**에서 저장 위치를 선택합니다 (예: `Google 드라이브`, `브라우저`, `기기` 등).

    <img src="/images/step12/12-1-step7-save-location.png" alt="저장 위치 선택" class="guide-img-sm" />

8. [[저장]] 버튼을 클릭합니다.

    <img src="/images/step12/12-1-step8-save-button.png" alt="저장 완료" class="guide-img-sm" />

> [!TIP]
> 작업 중 주기적으로 **파일** > **저장** (또는 `Ctrl+S` / `Cmd+S`)을 사용하여 저장하세요.

> [!TIP]
> **새 다이어그램 만들기**
>
> 이미 다른 다이어그램을 작업 중이거나 새로 시작하려면:
> 1. 상단 메뉴에서 **파일** > **새로 만들기**를 선택합니다.
> 2. **빈 다이어그램**을 선택합니다.
> 3. [[만들기]] 버튼을 클릭합니다.
>
> <img src="/images/step12/12-1-tip-new-diagram.png" alt="새 다이어그램 만들기" class="guide-img-sm" />

> [!TIP]
> **영어 인터페이스로 변경하기**
>
> 영어 인터페이스를 선호하는 경우:
> 1. 상단 메뉴에서 **추가 도구**를 선택합니다.
> 2. **Language**를 선택합니다.
> 3. **English**를 선택합니다.
>
> 또는 URL에서 `lang=ko`를 `lang=en`으로 변경합니다.

✅ **태스크 완료**: Draw.io 작업 환경이 준비되고 AWS 아이콘 라이브러리가 로드되었습니다.

## 태스크 2: AWS 그룹 배치 (Region, VPC, AZ)

이 태스크에서는 AWS 아키텍처의 기본 골격인 Region, VPC, Availability Zone 그룹을 배치합니다.  
그룹은 **바깥에서 안으로** 순서대로 배치합니다: Region → VPC → AZ → Subnet.

### AWS 리전 배치

9. 왼쪽 패널에서 **AWS / Groups** 카테고리를 확장합니다.

> [!TIP]
> **AWS 아이콘 검색 방법**: 왼쪽 패널 상단의 검색창에 `Region`, `VPC`, `Subnet` 등을 입력하면 아이콘을 빠르게 찾을 수 있습니다.  
> 카테고리를 클릭하면 해당 카테고리의 모든 아이콘이 표시됩니다.

10. **Region** 아이콘을 캔버스로 드래그합니다.

    <img src="/images/step12/12-1-step10-region-drag.png" alt="Region 아이콘 드래그" class="guide-img-sm" />
11. Region 박스 크기를 조정하여 전체 아키텍처를 포함할 수 있도록 **넉넉하게** 확장합니다.

    <img src="/images/step12/12-1-step11-region-size.png" alt="Region 크기 조정" class="guide-img-sm" />

> [!TIP]
> **크기 조정 방법**:
> - **드래그**: 박스 모서리의 파란색 핸들을 드래그하여 직접 조정합니다.
> - **수치 입력**: 오른쪽 패널의 **배치(Arrange)** 탭에서 너비(W)와 높이(H) 값을 직접 입력하면 정확한 크기로 설정할 수 있습니다.
12. Region 박스를 더블클릭하여 레이블을 `AWS Region (ap-northeast-2)`로 변경합니다.

    <img src="/images/step12/12-1-step12-region-label.png" alt="Region 레이블 변경" class="guide-img-sm" />

> [!TIP]
> **크기 조정**: 박스 모서리의 파란색 핸들을 드래그하여 크기를 조정합니다.  
> **레이블 편집**: 박스를 더블클릭하면 텍스트를 편집할 수 있습니다.  
> **이동**: 박스 테두리를 클릭한 채 드래그하면 이동합니다. (내부 빈 공간을 클릭하면 선택이 해제될 수 있습니다.)

### VPC 배치

13. **VPC** 아이콘을 Region 내부로 드래그합니다.

    <img src="/images/step12/12-1-step13-vpc-drag.png" alt="VPC를 Region 내부에 드래그" class="guide-img-sm" />

    <img src="/images/step12/12-1-step13-vpc-inside.png" alt="VPC가 Region 안에 배치됨" class="guide-img-sm" />

> [!NOTE]
> 그룹 안에 다른 그룹을 넣으려면, 반드시 **바깥 그룹 안쪽 영역에 드래그**해야 합니다.  
> 제대로 들어가면 바깥 그룹의 테두리가 파란색으로 하이라이트됩니다.  
> 하이라이트 없이 놓으면 그룹 안에 포함되지 않고 독립적으로 배치됩니다.

14. VPC 박스 크기를 조정하여 서브넷들을 포함할 수 있도록 확장합니다.
15. VPC 박스를 더블클릭하여 레이블을 `my-vpc (10.0.0.0/16)`로 변경합니다.

    <img src="/images/step12/12-1-step15-vpc-label.png" alt="VPC 레이블 변경" class="guide-img-sm" />

### 가용 영역 배치

16. **Availability Zone** 아이콘을 VPC 내부에 배치합니다.

    <img src="/images/step12/12-1-step16-az-drag.png" alt="AZ 배치" class="guide-img-sm" />
17. AZ 박스 크기를 조정하여 서브넷 3개가 세로로 들어갈 수 있도록 세로로 길게 만듭니다.

    <img src="/images/step12/12-1-step17-az-size.png" alt="AZ 크기 조정" class="guide-img-sm" />

> [!TIP]
> **아이콘 복제 방법**:
> - 아이콘 선택 → **마우스 오른쪽 버튼** → **Duplicate** 선택
> - **단축키**: `Cmd+D` (Mac) / `Ctrl+D` (Windows)
> - **드래그 복제**: `Cmd` (Mac) / `Ctrl` (Windows)을 누른 채로 드래그
>
> <img src="/images/step12/12-1-step17-tip-duplicate.png" alt="복제 방법" class="guide-img-sm" />
>
> **여러 아이콘 동시 선택**:
> - **Shift 클릭**: Shift 키를 누른 채로 아이콘을 클릭하면 여러 개를 선택할 수 있습니다.
> - **드래그 선택**: 빈 공간에서 드래그하여 영역을 지정하면 해당 영역의 모든 아이콘이 선택됩니다.
> - 선택한 여러 아이콘을 한 번에 복제하거나 이동할 수 있습니다.

18. 복제 기능을 사용하여 두 번째 Availability Zone을 VPC 내부에 추가합니다.
19. 첫 번째 AZ 레이블을 `Availability Zone A (ap-northeast-2a)`로 설정합니다.
20. 두 번째 AZ 레이블을 `Availability Zone C (ap-northeast-2c)`로 설정합니다.
21. 두 AZ를 좌우로 나란히 배치합니다.

    <img src="/images/step12/12-1-step21-az-complete.png" alt="AZ 좌우 배치 완료" class="guide-img-sm" />

> [!NOTE]
> **Multi-AZ 구성**: 하나의 가용 영역에 장애가 발생해도 다른 가용 영역에서 서비스를 계속 제공할 수 있습니다.  
> 실무에서는 2개 이상의 AZ를 사용하여 고가용성을 보장합니다.

✅ **태스크 완료**: Region, VPC, 2개의 가용 영역이 배치되었습니다.

## 태스크 3: 3-Tier 서브넷 배치

이 태스크에서는 각 가용 영역에 **3개의 서브넷**을 배치합니다: Public Subnet, Private App Subnet, Private DB Subnet.

> [!NOTE]
> **서브넷 종류**: AWS / Groups 카테고리에는 2가지 서브넷 아이콘이 있습니다.
> - **Public Subnet** (초록색): 인터넷 게이트웨이를 통해 외부와 통신
> - **Private Subnet** (파란색): 외부 접근이 차단된 격리 환경
>
> 이 실습에서는 Public 1개 + Private 2개(App용, DB용)를 각 AZ에 배치합니다.
>
> ⚠️ draw.io에서 제공하는 서브넷 그룹 아이콘은 **이전 버전의 AWS 색상**을 사용하고 있어, 최신 AWS 콘솔이나 공식 문서의 색상과 다를 수 있습니다. 기능적으로는 동일하므로 그대로 사용하면 됩니다.

### ap-northeast-2a 서브넷 배치

22. 왼쪽 패널에서 `Public Subnet` 아이콘을 검색합니다.

    <img src="/images/step12/12-1-step22-subnet-search.png" alt="Public Subnet 검색" class="guide-img-sm" />

    <img src="/images/step12/12-1-step22-subnet-drag.png" alt="Public Subnet 드래그" class="guide-img-sm" />
23. **Public Subnet** 아이콘을 **ap-northeast-2a** AZ 내부 상단에 배치합니다.
24. 레이블을 `my-public-subnet-a (10.0.1.0/24)`로 설정합니다.

    <img src="/images/step12/12-1-step24-public-subnet-label.png" alt="Public Subnet 레이블 설정" class="guide-img-sm" />

25. 왼쪽 패널에서 `Private Subnet` 아이콘을 검색하여 드래그합니다. (파란색 아이콘)

    <img src="/images/step12/12-1-step25-private-subnet-search.png" alt="Private Subnet 검색" class="guide-img-sm" />
26. **Private Subnet** 아이콘을 **ap-northeast-2a** AZ 내부 중간에 배치합니다.
27. 레이블을 `my-private-app-subnet-a (10.0.11.0/24)`로 설정합니다.

    <img src="/images/step12/12-1-step27-private-app-label.png" alt="Private App Subnet 레이블" class="guide-img-sm" />

28. **Private Subnet** 아이콘을 복제하여 **ap-northeast-2a** AZ 내부 하단에 배치합니다.
29. 레이블을 `my-private-db-subnet-a (10.0.21.0/24)`로 설정합니다.

    <img src="/images/step12/12-1-step29-private-db-label.png" alt="Private DB Subnet 레이블" class="guide-img-sm" />

### ap-northeast-2c 서브넷 배치

30. **ap-northeast-2a**의 3개 서브넷을 모두 선택합니다 (Shift 키를 누른 채로 클릭).
31. `Cmd` (Mac) / `Ctrl` (Windows)을 누른 채로 선택한 서브넷들을 **ap-northeast-2c** AZ로 드래그하면 한 번에 복제됩니다.

    <img src="/images/step12/12-1-step31-duplicate-to-azc.png" alt="AZ-C로 복제" class="guide-img-sm" />
32. 첫 번째 서브넷 레이블을 `my-public-subnet-c (10.0.2.0/24)`로 변경합니다.
33. 두 번째 서브넷 레이블을 `my-private-app-subnet-c (10.0.12.0/24)`로 변경합니다.
34. 세 번째 서브넷 레이블을 `my-private-db-subnet-c (10.0.22.0/24)`로 변경합니다.

    <img src="/images/step12/12-1-step34-subnets-complete.png" alt="서브넷 배치 완료" class="guide-img-sm" />

> [!NOTE]
> **3-Tier 서브넷 구성**:
> - **Public Subnet (상단)**: ALB, NAT Gateway 배치. 인터넷과 직접 통신.
> - **Private App Subnet (중간)**: EC2 웹/앱 서버 배치. NAT를 통해 아웃바운드만 허용.
> - **Private DB Subnet (하단)**: RDS 데이터베이스 배치. 외부 인터넷 접근 완전 차단.

✅ **태스크 완료**: 6개의 서브넷(각 AZ에 3개씩)이 배치되었습니다.

## 태스크 4: 네트워크 리소스 배치 (IGW, NAT Gateway)

이 태스크에서는 Internet Gateway와 NAT Gateway를 추가하여 네트워크 연결을 구성합니다.

### Internet Gateway 배치

35. 왼쪽 패널 검색창에서 `Internet Gateway`를 검색합니다. (또는 **AWS / Network & Content Delivery** 카테고리에서 찾습니다.)

    <img src="/images/step12/12-1-step35-igw-search.png" alt="Internet Gateway 검색" class="guide-img-sm" />

    <img src="/images/step12/12-1-step35-igw-placed.png" alt="Internet Gateway 배치" class="guide-img-sm" />
36. **Internet Gateway** 아이콘을 VPC 상단 중앙에 배치합니다.
37. 레이블을 `IGW (Internet Gateway)`로 설정합니다.

    <img src="/images/step12/12-1-step37-igw-label.png" alt="IGW 레이블 설정" class="guide-img-sm" />

### NAT Gateway 배치

38. 왼쪽 패널에서 `NAT Gateway` 아이콘을 검색합니다.

    <img src="/images/step12/12-1-step38-nat-search.png" alt="NAT Gateway 검색" class="guide-img-sm" />
39. **NAT Gateway** 아이콘을 **Public Subnet A** 내부에 배치합니다.
40. 레이블을 `NAT Gateway A`로 설정합니다.
41. **NAT Gateway** 아이콘을 복제하여 **Public Subnet C** 내부에 배치합니다.
42. 레이블을 `NAT Gateway C`로 설정합니다.

    <img src="/images/step12/12-1-step42-nat-complete.png" alt="NAT Gateway 배치 완료" class="guide-img-sm" />

> [!TIP]
> **텍스트 위치 조정**:
> 아이콘에 화살표를 연결하면 텍스트가 가려질 수 있습니다. 오른쪽 패널에서:
> 1. 아이콘을 선택합니다.
> 2. **텍스트** 섹션에서 정렬/위치를 조정합니다.
> 3. 텍스트를 아이콘 아래/옆에 배치하여 가독성을 높입니다.

> [!NOTE]
> **Internet Gateway**: VPC와 인터넷 간의 양방향 통신을 가능하게 합니다. VPC당 1개만 연결 가능합니다.  
> **NAT Gateway**: Private Subnet의 리소스가 인터넷으로 나가는 트래픽만 허용합니다. 각 AZ에 1개씩 배치하여 고가용성을 보장합니다.

✅ **태스크 완료**: Internet Gateway와 NAT Gateway가 배치되었습니다.

## 태스크 5: 컴퓨팅/데이터베이스 리소스 배치

이 태스크에서는 ALB, EC2, RDS, Auto Scaling Group을 배치합니다.

### Application Load Balancer 배치

43. 왼쪽 패널에서 `Application Load Balancer`를 검색합니다.

    <img src="/images/step12/12-1-step43-alb-search.png" alt="ALB 검색" class="guide-img-sm" />
44. **ALB** 아이콘을 2개의 Public Subnet 사이(또는 걸쳐서)에 배치합니다.
45. 레이블을 `ALB (Application Load Balancer)`로 설정합니다.

    <img src="/images/step12/12-1-step45-alb-placed.png" alt="ALB 배치 완료" class="guide-img-sm" />

### EC2 인스턴스 배치

46. 왼쪽 패널에서 `EC2` 또는 `instance`를 검색합니다. (필요하다면 **그 외 결과** 버튼을 누릅니다.)

    <img src="/images/step12/12-1-step46-ec2-search.png" alt="EC2 인스턴스 검색" class="guide-img-sm" />
47. **Amazon EC2 Instance** 아이콘을 **Private App Subnet A** 내부에 배치합니다.
48. 레이블을 `Web Server A1`로 설정합니다.
49. 복제하여 `Web Server A2`를 옆에 배치합니다.
50. 동일하게 **Private App Subnet C**에도 `Web Server C1`, `Web Server C2`를 배치합니다.

    <img src="/images/step12/12-1-step50-ec2-complete.png" alt="EC2 인스턴스 배치 완료" class="guide-img-sm" />

### Auto Scaling Group 표시

51. 왼쪽 패널에서 `Auto Scaling` 아이콘을 검색합니다.

    <img src="/images/step12/12-1-step51-asg-search.png" alt="Auto Scaling 검색" class="guide-img-sm" />
52. **Auto Scaling Group** 아이콘을 Web Server 영역을 감싸는 위치에 배치합니다.
53. 레이블을 `ASG (Auto Scaling Group)`로 설정합니다.

    <img src="/images/step12/12-1-step53-asg-placed.png" alt="Auto Scaling Group 배치 완료" class="guide-img-sm" />

> [!TIP]
> Auto Scaling Group은 점선 박스로 EC2 인스턴스들을 감싸는 형태로 표현하면 직관적입니다.  
> AWS / Groups 카테고리에서 **Auto Scaling group** 아이콘을 사용하거나, 일반 점선 박스를 그려도 됩니다.

### RDS 데이터베이스 배치

54. 왼쪽 패널에서 `RDS` 아이콘을 검색합니다.

    <img src="/images/step12/12-1-step54-rds-search.png" alt="RDS 검색" class="guide-img-sm" />
55. **RDS DB Instance** 아이콘을 **Private DB Subnet A** 내부에 배치합니다.
56. 레이블을 `RDS Primary`로 설정합니다.
57. 복제하여 **Private DB Subnet C**에 `RDS Standby`를 배치합니다.

    <img src="/images/step12/12-1-step57-rds-complete.png" alt="RDS 배치 완료" class="guide-img-sm" />

> [!NOTE]
> **Application Load Balancer**: HTTP/HTTPS 트래픽을 여러 EC2 인스턴스로 분산합니다. Multi-AZ로 고가용성을 보장합니다.  
> **Auto Scaling Group**: 트래픽에 따라 EC2 인스턴스 수를 자동 조정합니다.  
> **RDS Multi-AZ**: Primary에 장애 발생 시 Standby가 자동으로 승격됩니다.

✅ **태스크 완료**: ALB, EC2, Auto Scaling Group, RDS가 배치되었습니다.

## 태스크 6: 보안 그룹 표시

이 태스크에서는 Security Group을 다이어그램에 표시하여 계층화된 보안을 시각화합니다.

58. 왼쪽 패널에서 `Security Group`을 검색합니다.

    <img src="/images/step12/12-1-step58-sg-search.png" alt="Security Group 검색" class="guide-img-sm" />
59. **Security Group** 아이콘을 해당 리소스 주변에 배치합니다.
60. 레이블을 설정합니다 (예: `my-ec2-sg`, `my-rds-sg`).

    <img src="/images/step12/12-1-step60-sg-complete.png" alt="Security Group 배치 완료" class="guide-img-sm" />

> [!NOTE]
> Security Group은 빨간색 테두리 박스로 표현됩니다.  
> 리소스를 감싸는 형태로 배치하면 "이 SG가 해당 리소스에 적용됨"을 직관적으로 표현할 수 있습니다.
>
> ALB의 보안 그룹(`my-alb-sg`)은 다이어그램에서 별도로 표시하지 않습니다.  
> ALB는 Public Subnet에 위치하며, 다이어그램의 가독성을 위해 EC2와 RDS의 보안 그룹만 표시합니다.

✅ **태스크 완료**: 보안 그룹이 표시되었습니다.

## 태스크 7: 화살표 연결 (트래픽 흐름)

이 태스크에서는 리소스 간 화살표를 연결하여 트래픽 흐름을 표현합니다.

### Route Table 배치

61. 왼쪽 패널에서 `Route Table`을 검색합니다.

    <img src="/images/step12/12-1-step61-rt-search.png" alt="Route Table 검색" class="guide-img-sm" />
62. **Route Table** 아이콘을 **Public Subnet A** 내부(또는 근처)에 배치합니다.
63. 레이블을 `Public RT`로 설정합니다.

    <img src="/images/step12/12-1-step63-rt-placed.png" alt="Route Table 배치 완료" class="guide-img-sm" />

> [!TIP]
> Route Table은 모든 서브넷에 연결되지만, 다이어그램에서는 하나만 배치하여 라우팅 개념을 표현합니다.  
> 모든 서브넷에 배치하면 다이어그램이 복잡해지므로 Public Subnet에만 대표로 표시합니다.

### 화살표 연결 방법

64. 시작 아이콘 위에 마우스를 올리면 연결 포인트(파란색 점)가 표시됩니다.

    <img src="/images/step12/12-1-step64-arrow-connect.png" alt="화살표 연결 포인트" class="guide-img-sm" />
65. 연결 포인트를 클릭한 후 끝 아이콘으로 드래그하면 화살표가 연결됩니다.

> [!TIP]
> **화살표 도구로 직접 그리기**:
> 아이콘의 연결 포인트 외에도, 상단 툴바의 화살표 도구를 사용하여 직접 화살표를 그릴 수 있습니다.
>
> <img src="/images/step12/12-1-arrow-tool.png" alt="화살표 도구" class="guide-img-sm" />
>
> 화살표 도구를 선택한 후 캔버스에서 시작점을 클릭하고 끝점까지 드래그하면 화살표가 생성됩니다.

> [!TIP]
> **화살표 스타일 변경**:
> 1. 화살표를 선택합니다.
> 2. 오른쪽 패널에서 스타일을 변경할 수 있습니다:
>    - **실선**: 주요 트래픽 흐름 (요청)
>    - **점선(Dashed)**: 응답 또는 복제 흐름
>    - **색상**: 네트워크(보라), 보안(빨강), 컴퓨트(주황) 등으로 구분
>    - **양방향 화살표**: 양쪽 끝에 화살표 머리 추가

> [!TIP]
> **화살표에 레이블 추가**:
> 화살표를 더블클릭하면 텍스트를 입력할 수 있습니다 (예: `HTTP`, `MySQL 3306`, `Replication`).

### 기본 연결 패턴

66. **Internet Gateway ↔ Route Table** 연결을 양방향 화살표로 표현합니다.

> [!TIP]
> **양방향 화살표 설정 방법**:
> 1. 화살표를 선택합니다.
> 2. 오른쪽 패널에서 화살표 양쪽 끝의 모양을 설정할 수 있습니다.
> 3. 시작 부분(Source)의 화살표 머리를 **Classic** 또는 **Open**으로 변경하면 양방향 화살표가 됩니다.
> 4. 기본적으로 시작 부분은 화살표 머리가 없으므로(None), 드롭다운에서 원하는 모양을 선택합니다.

67. **Route Table → ALB** 연결을 화살표로 표현합니다.
68. **ALB → EC2** 연결을 화살표로 표현합니다.
69. **EC2 ↔ RDS** 연결을 양방향 화살표로 표현합니다.

    <img src="/images/step12/12-1-step69-arrow-complete.png" alt="화살표 연결 완료" class="guide-img-sm" />
70. 필요에 따라 추가 연결을 표현합니다 (예: NAT Gateway → IGW).

> [!NOTE]
> **화살표 방향 규칙**:
> - **단방향**: IGW → ALB, ALB → EC2 (요청 흐름 방향)
> - **양방향**: IGW ↔ Route Table, EC2 ↔ RDS (요청과 응답이 모두 있는 트래픽)

> [!TIP]
> **화살표는 핵심 흐름만 표현하세요**:
> 모든 연결을 화살표로 표현하면 다이어그램이 복잡해지고 오히려 가독성이 떨어집니다.  
> 핵심 트래픽 흐름(IGW → RT → ALB → EC2 → RDS)만 표현해도 충분합니다.
>
> **버전을 나눠서 관리하는 방법**:
> - **버전 1 (기본 뼈대)**: 그룹과 리소스 배치만 표현한 깔끔한 버전
> - **버전 2 (트래픽 흐름)**: 화살표와 흐름을 추가한 상세 버전
>
> draw.io에서 **파일** > **사본 만들기**로 현재 다이어그램을 복제한 뒤,  
> 복제본에 화살표를 추가하면 두 가지 버전을 유지할 수 있습니다.

✅ **태스크 완료**: 트래픽 흐름이 화살표로 연결되었습니다.

## 태스크 8: AWS Cloud 그룹 감싸기 (선택)

모든 배치가 완료되면, 전체 다이어그램을 AWS Cloud 그룹으로 감싸서 정식 AWS 아키텍처 다이어그램 형식을 갖출 수 있습니다.

71. 왼쪽 패널 **AWS / Groups** 카테고리에서 **AWS Cloud** 아이콘을 캔버스로 드래그합니다.

    <img src="/images/step12/12-1-step71-cloud-search.png" alt="AWS Cloud 검색" class="guide-img-sm" />

    <img src="/images/step12/12-1-step71-cloud-drag.png" alt="AWS Cloud 드래그" class="guide-img-sm" />
72. AWS Cloud 박스를 Region 그룹보다 크게 확장하여 전체를 감쌉니다.
73. Users 아이콘을 AWS Cloud 바깥 상단에 배치하여 외부 사용자를 표현합니다.

    <img src="/images/step12/12-1-step73-cloud-complete.png" alt="AWS Cloud 그룹 완료" class="guide-img-sm" />

> [!TIP]
> AWS Cloud 그룹을 나중에 추가하면 기존 요소들이 자동으로 안에 포함되지 않을 수 있습니다.  
> 모든 요소를 선택(`Cmd+A`)한 뒤 AWS Cloud 박스 안으로 드래그하거나,  
> AWS Cloud 박스를 뒤로 보내기(**Arrange** > **To Back**)하여 배경처럼 배치하세요.

✅ **태스크 완료**: AWS Cloud 그룹이 추가되었습니다.

## 태스크 9: 다이어그램 내보내기

이 태스크에서는 완성된 다이어그램을 PNG 이미지로 내보냅니다.

74. 다이어그램이 완성되었는지 확인합니다:
    - 그룹 계층이 올바른지 (Region > VPC > AZ > Subnet)
    - 화살표가 명확하게 연결되어 있는지
    - 레이블이 읽기 쉬운지
75. 상단 메뉴에서 **파일** > **다른 형식으로 내보내기** > **PNG...**를 선택합니다.

    <img src="/images/step12/12-1-step75-export-menu.png" alt="PNG 내보내기 메뉴" class="guide-img-sm" />
76. **이미지** 대화상자에서 설정을 확인합니다:
    - **배율**: `200%` (고해상도 권장)
    - **크기**: `다이어그램`
    - **투명한 배경**: 체크 해제 (흰색 배경 유지)
    - 나머지는 기본값으로 유지합니다.
77. [[내보내기]] 버튼을 클릭합니다.

    <img src="/images/step12/12-1-step77-export-button.png" alt="내보내기 버튼 클릭" class="guide-img-sm" />
78. 파일명을 `my-architecture`로 입력하고 저장합니다.

    <img src="/images/step12/12-1-step78-export-save.png" alt="파일명 입력 및 저장" class="guide-img-sm" />

> [!TIP]
> **내보내기 형식**:
> - **PNG**: 일반적인 이미지 형식. 문서 삽입, 발표용에 적합.
> - **SVG**: 벡터 형식. 확대해도 선명하며 웹 삽입에 적합.
> - **PDF**: 인쇄용.
>
> **배율** 설정은 해상도를 결정합니다. 200%로 내보내면 선명한 이미지를 얻을 수 있습니다.

> [!TIP]
> **다이어그램 추가 개선 (선택사항)**:
>
> 기본 아키텍처가 완성되었다면, 다음 요소를 추가하여 더욱 완성도 높은 다이어그램을 만들 수 있습니다:
>
> - **AWS Cloud 그룹**: Region 바깥에 AWS Cloud 그룹을 추가하면 정식 AWS 아키텍처 다이어그램 구조(Cloud > Region > VPC)와 동일해집니다.  
> AWS / Groups 카테고리에서 **AWS Cloud** 아이콘을 드래그하여 전체를 감싸세요.
> - **사용자 아이콘**: AWS Cloud 바깥에 사용자 아이콘을 배치하여 트래픽 시작점 표현
> - **CloudFront, Route 53**: CDN 및 DNS 구성 표현
> - **CloudWatch**: 모니터링 아이콘 추가
>
> Step 1~11에서 학습한 모든 서비스를 자유롭게 추가해보세요.

✅ **태스크 완료**: 아키텍처 다이어그램이 PNG 이미지로 내보내기되었습니다.

<img src="/images/step12/12-1-step73-final-architecture.png" alt="완성된 아키텍처 다이어그램" class="guide-img-lg" />

## 마무리

다음을 성공적으로 수행했습니다:

- Draw.io 환경을 설정하고 AWS 아이콘 라이브러리를 로드했습니다.
- Region, VPC, AZ, Subnet 등 AWS 그룹을 계층적으로 배치했습니다.
- EC2, RDS 등 서비스 아이콘을 배치했습니다.
- Security Group을 시각적으로 표현했습니다.
- 화살표로 트래픽 흐름을 연결했습니다.
- 다이어그램을 PNG 이미지로 내보냈습니다.

> [!TIP]
> **포트폴리오 활용**: 완성된 아키텍처 다이어그램은 기술 면접이나 포트폴리오에서 활용할 수 있습니다.  
> AWS 서비스에 대한 이해도와 설계 능력을 시각적으로 보여줄 수 있는 좋은 자료입니다.

# 🗑️ 리소스 정리

> [!NOTE]
> 이 실습은 Draw.io를 사용한 다이어그램 작성 실습으로, AWS 리소스를 생성하지 않았습니다.  
> 별도의 정리가 필요하지 않습니다.

## 파일 정리 (선택사항)

- **다이어그램 파일 보관**: `.drawio` 파일은 향후 아키텍처 변경 시 수정할 수 있으므로 보관을 권장합니다.
- **PNG 파일**: 문서나 발표 자료에 삽입하여 활용합니다.

✅ **실습 종료**: 아키텍처 다이어그램 작성이 완료되었습니다.

## 추가 학습 리소스

- [AWS 아키텍처 센터](https://aws.amazon.com/ko/architecture/)
- [AWS Architecture Icons (공식 아이콘 다운로드)](https://aws.amazon.com/architecture/icons/)
- [AWS Well-Architected Framework](https://aws.amazon.com/ko/architecture/well-architected/)
- [Draw.io 공식 문서](https://www.drawio.com/doc/)

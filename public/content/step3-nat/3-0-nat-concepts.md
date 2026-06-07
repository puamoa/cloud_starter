---
title: 'NAT와 네트워크 주소 변환 이론'
week: 3
session: 0
type: theory
learningObjectives:
  - NAT(Network Address Translation)의 정의와 필요성을 설명할 수 있습니다.
  - Public IP와 Private IP의 역할 차이를 이해할 수 있습니다.
  - NAT의 동작 원리와 변환 과정을 설명할 수 있습니다.
  - SNAT와 DNAT의 차이를 구분할 수 있습니다.
  - AWS에서 NAT가 필요한 시나리오를 이해할 수 있습니다.
  - Private Subnet + NAT 구성의 보안적 이점을 설명할 수 있습니다.
  - Elastic IP의 개념과 NAT Gateway 배치 모드(Zonal/Regional)를 설명할 수 있습니다.
  - Route Table에 NAT 경로를 추가하는 원리를 이해할 수 있습니다.
  - EC2 접속 방식(SSH, EC2 Instance Connect, SSM)의 차이를 비교할 수 있습니다.
  - NAT Instance의 핵심 기술 요소(Source/Dest Check, IP Forwarding, iptables)를 설명할 수 있습니다.
  - NAT와 SSM Session Manager의 관계를 이해할 수 있습니다.
  - Bastion Host의 개념과 한계, 실무에서 지양하는 이유를 설명할 수 있습니다.
  - VPN과 Direct Connect의 기초 개념을 이해할 수 있습니다.
---

# NAT와 네트워크 주소 변환 이론

---

## 1. NAT란? (Network Address Translation)

> [!CONCEPT] NAT의 정의와 필요성
> **NAT**(Network Address Translation)는 IP 패킷의 출발지 또는 목적지 IP 주소를 다른 IP 주소로 변환하는 기술입니다.  
> 사설 IP를 가진 장치가 인터넷과 통신할 수 있게 해주며, IPv4 주소 부족 문제를 해결하는 핵심 기술입니다.

### 핵심 용어 정리

| 용어                                  | 설명                                                                      | AWS 관련                    |
| ------------------------------------- | ------------------------------------------------------------------------- | --------------------------- |
| **NAT (Network Address Translation)** | 사설 IP를 공인 IP로 변환하여 인터넷 접근을 가능하게 하는 기술             | NAT Gateway                 |
| **SNAT (Source NAT)**                 | 출발지 IP를 변환. 내부 → 외부 통신 시 사설 IP를 공인 IP로 변경            | NAT Gateway 기본 동작       |
| **DNAT (Destination NAT)**            | 목적지 IP를 변환. 외부 → 내부 통신 시 공인 IP를 사설 IP로 변경            | ALB, Port Forwarding        |
| **NAT Gateway**                       | AWS 관리형 NAT 서비스. Private Subnet에서 인터넷 접근 시 사용             | 시간당 + 데이터 처리량 과금 |
| **Bastion Host (점프 서버)**          | Public Subnet에 위치하여 Private Subnet 인스턴스에 SSH 접속하는 중계 서버 | EC2 in Public Subnet        |
| **VPN (Virtual Private Network)**     | 인터넷을 통해 암호화된 터널로 사설 네트워크에 접속하는 기술               | AWS Site-to-Site VPN        |
| **Direct Connect**                    | AWS와 온프레미스를 전용 물리 회선으로 연결하는 서비스                     | AWS Direct Connect          |
| **Elastic IP**                        | NAT Gateway에 연결하는 고정 공인 IP. 외부에서 보이는 출발지 IP가 됨       | NAT Gateway 필수 구성       |

### NAT가 필요한 이유

```
문제: IPv4 주소는 약 43억 개뿐
      전 세계 인터넷 연결 장치 수 >> 43억

해결: NAT를 통해 하나의 공인 IP로 여러 사설 IP 장치가 인터넷 사용

┌─────────────────────────────────────────────────────┐
│  가정/회사 내부 네트워크 (사설 IP)                  │
│                                                     │
│  PC-A: 192.168.1.10 ─┐                              │
│  PC-B: 192.168.1.11 ─┼──► NAT ──► 인터넷            │
│  PC-C: 192.168.1.12 ─┘       (공인 IP: 203.0.113.1) │
│                                                     │
│  3대의 PC가 1개의 공인 IP를 공유                    │
└─────────────────────────────────────────────────────┘
```

### NAT의 핵심 기능

| 기능             | 설명                                 |
| ---------------- | ------------------------------------ |
| **IP 주소 절약** | 다수의 사설 IP가 소수의 공인 IP 공유 |
| **보안 강화**    | 내부 네트워크 구조를 외부에 숨김     |
| **유연한 설계**  | 내부 IP 체계를 자유롭게 설계 가능    |
| **인터넷 접근**  | 사설 IP 장치의 외부 통신 가능        |

---

## 2. Public IP vs Private IP 심화

> [!CONCEPT] Public IP와 Private IP의 차이
> **Public IP**는 인터넷에서 직접 라우팅 가능한 전역 고유 주소이고, **Private IP**는 내부 네트워크에서만 유효한 주소입니다.  
> Private IP는 인터넷으로 직접 나갈 수 없으며, 반드시 NAT를 거쳐야 합니다.

### 주요 용어

| 용어           | 설명                                                   |
| -------------- | ------------------------------------------------------ |
| **Public IP**  | 인터넷에서 직접 라우팅 가능한 전역 고유 주소           |
| **Private IP** | 내부 네트워크에서만 유효한 주소. 인터넷 직접 통신 불가 |
| **Elastic IP** | 수동 할당하는 고정 공인 IP. 인스턴스 중지 시에도 유지  |
| **DHCP**       | IP 주소를 자동으로 할당하는 프로토콜                   |

### AWS에서의 IP 주소 체계

```
┌─────────────────────────────────────────────────────────┐
│  VPC: 10.0.0.0/16                                       │
│                                                         │
│  ┌─── Public Subnet (10.0.1.0/24) ───────┐              │
│  │                                       │              │
│  │  EC2-A                                │              │
│  │  Private IP: 10.0.1.10                │              │
│  │  Public IP:  54.180.xxx.xxx ◄── 자동 할당            │
│  │  (인터넷 직접 통신 가능)              │              │
│  └───────────────────────────────────────┘              │
│                                                         │
│  ┌─── Private Subnet (10.0.10.0/24) ─────┐              │
│  │                                       │              │
│  │  EC2-B                                │              │
│  │  Private IP: 10.0.10.20               │              │
│  │  Public IP:  없음                     │              │
│  │  (인터넷 직접 통신 불가 → NAT 필요)   │              │
│  └───────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────┘
```

### AWS IP 주소 유형 비교

| 유형           | 할당 방식   | 인스턴스 중지 시 | 비용                           | 용도           |
| -------------- | ----------- | ---------------- | ------------------------------ | -------------- |
| **Private IP** | 자동 (DHCP) | 유지             | 무료                           | 내부 통신      |
| **Public IP**  | 자동 할당   | 변경됨           | 시간당 $0.005                  | 임시 외부 접근 |
| **Elastic IP** | 수동 할당   | 유지             | 시간당 $0.005 (사용 여부 무관) | 고정 외부 접근 |

> [!NOTE]
> 2024년 2월부터 **모든 Public IPv4 주소**에 시간당 $0.005가 과금됩니다 (사용 중이든 미사용이든 동일).  
> EC2에 연결된 Public IP, Elastic IP 모두 해당됩니다. 월 기준 약 $3.6/IP입니다.

---

## 3. NAT의 동작 원리

> [!CONCEPT] NAT 테이블과 주소 변환 과정
> NAT는 패킷이 네트워크 경계를 통과할 때 **IP 주소와 포트 번호를 변환**합니다.  
> 이 변환 정보를 **NAT 테이블**에 기록하여, 응답 패킷이 돌아올 때 원래 장치로 정확히 전달합니다.

### 주요 용어

| 용어                                        | 설명                                                                 |
| ------------------------------------------- | -------------------------------------------------------------------- |
| **NAT 테이블**                              | IP 주소와 포트 변환 정보를 기록하는 매핑 테이블                      |
| **PAT (Port Address Translation)**          | 포트 번호까지 변환하여 여러 사설 IP가 하나의 공인 IP를 공유하는 방식 |
| **NAPT (Network Address Port Translation)** | PAT의 다른 이름. IP + 포트를 함께 변환                               |

### NAT 변환 과정 (PAT/NAPT)

```
[요청 - 나가는 패킷]

EC2 (Private)          NAT Gateway              인터넷 서버
10.0.10.20:45000  →   52.78.xxx.xxx:12345  →   8.8.8.8:443
                       │
                       │ NAT 테이블에 기록:
                       │ 10.0.10.20:45000 ↔ 52.78.xxx.xxx:12345
                       │

[응답 - 돌아오는 패킷]

EC2 (Private)          NAT Gateway              인터넷 서버
10.0.10.20:45000  ←   52.78.xxx.xxx:12345  ←   8.8.8.8:443
                       │
                       │ NAT 테이블 조회:
                       │ 52.78.xxx.xxx:12345 → 10.0.10.20:45000
                       │ 목적지 IP를 사설 IP로 복원
```

### NAT 테이블 예시

| 내부 IP:포트     | 외부 IP:포트    | 목적지          | 프로토콜 | 상태        |
| ---------------- | --------------- | --------------- | -------- | ----------- |
| 10.0.10.20:45000 | 52.78.1.1:12345 | 8.8.8.8:443     | TCP      | ESTABLISHED |
| 10.0.10.21:38000 | 52.78.1.1:12346 | 151.101.1.69:80 | TCP      | ESTABLISHED |
| 10.0.10.20:52000 | 52.78.1.1:12347 | 54.230.1.1:443  | TCP      | TIME_WAIT   |

---

## 4. SNAT vs DNAT

> [!CONCEPT] SNAT와 DNAT의 차이
> **SNAT**(Source NAT)는 출발지 IP를 변환하고, **DNAT**(Destination NAT)는 목적지 IP를 변환합니다.  
> AWS에서 NAT Gateway는 SNAT를, Application Load Balancer (ALB)/Network Load Balancer (NLB)는 DNAT 역할을 수행합니다.

### 주요 용어

| 용어                       | 설명                                                           |
| -------------------------- | -------------------------------------------------------------- |
| **SNAT (Source NAT)**      | 출발지 IP를 변환. 내부 → 외부 통신 시 사설 IP를 공인 IP로 변경 |
| **DNAT (Destination NAT)** | 목적지 IP를 변환. 외부 → 내부 통신 시 공인 IP를 사설 IP로 변경 |
| **Port Forwarding**        | 특정 포트로 들어오는 트래픽을 내부 서버로 전달하는 DNAT 기법   |

### SNAT (Source NAT)

```
용도: 내부 → 외부 통신 시 출발지 IP 변환

┌──────────┐         ┌──────────┐         ┌──────────┐
│  EC2     │  ────►  │   NAT    │  ────►  │  인터넷  │
│ 10.0.10.5│         │ Gateway  │         │  서버    │
└──────────┘         └──────────┘         └──────────┘
출발지: 10.0.10.5    출발지: 52.78.1.1    수신: 52.78.1.1
(사설 IP)            (공인 IP로 변환)     (공인 IP만 인식)

AWS 사용 사례: NAT Gateway, NAT Instance
```

### DNAT (Destination NAT)

```
용도: 외부 → 내부 통신 시 목적지 IP 변환

┌──────────┐         ┌──────────┐         ┌──────────┐
│  사용자   │  ────► │   ALB    │  ────►  │   EC2    │
│ (인터넷)  │        │          │         │ 10.0.1.5 │
└──────────┘         └──────────┘         └──────────┘
목적지: ALB IP       목적지: 10.0.1.5     수신: 요청 도착
(공인 IP)            (사설 IP로 변환)

AWS 사용 사례: ALB, NLB, Port Forwarding
```

### SNAT vs DNAT 비교표

| 항목           | SNAT                        | DNAT                      |
| -------------- | --------------------------- | ------------------------- |
| **변환 대상**  | 출발지(Source) IP           | 목적지(Destination) IP    |
| **방향**       | 내부 → 외부                 | 외부 → 내부               |
| **목적**       | 사설 IP 숨기기, 인터넷 접근 | 외부에서 내부 서비스 접근 |
| **AWS 서비스** | NAT Gateway                 | ALB, NLB                  |
| **예시**       | EC2가 패키지 다운로드       | 사용자가 웹서버 접속      |

---

## 5. AWS에서 NAT가 필요한 시나리오

> [!CONCEPT] Private Subnet에서 NAT가 필요한 이유
> Private Subnet의 리소스가 인터넷에 접근해야 하지만, 외부에서의 직접 접근은 차단해야 할 때 NAT를 사용합니다.  
> 보안과 접근성의 균형을 맞추는 핵심 아키텍처 패턴입니다.

### 주요 용어

| 용어             | 설명                                                            |
| ---------------- | --------------------------------------------------------------- |
| **NAT Gateway**  | AWS 관리형 NAT 서비스. 자동 이중화, 최대 100Gbps                |
| **NAT Instance** | EC2에 NAT 기능을 설정한 인스턴스. 비용 저렴하나 직접 관리 필요  |
| **VPC Endpoint** | NAT 없이 AWS 서비스(Amazon S3 등)에 직접 접근하는 프라이빗 연결 |

### 대표적인 NAT 필요 시나리오

| 시나리오                        | 설명                     | 왜 Private에 배치?           |
| ------------------------------- | ------------------------ | ---------------------------- |
| **OS 패치/업데이트**            | dnf update               | 보안 서버는 외부 노출 최소화 |
| **패키지 다운로드**             | pip install, npm install | 빌드 서버는 내부에 배치      |
| **외부 API 호출**               | 결제 API, 알림 서비스    | 백엔드는 직접 노출 불필요    |
| **Amazon CloudWatch 로그 전송** | 모니터링 데이터 전송     | 모든 인스턴스에서 필요       |
| **Amazon S3 접근**              | 파일 업로드/다운로드     | VPC Endpoint 대안 가능       |

### 전형적인 AWS 아키텍처에서의 NAT 위치

```
┌─────────────────────────────────────────────────────────┐
│  VPC                                                    │
│                                                         │
│  ┌─── Public Subnet ─────────────────────────────┐      │
│  │  Internet Gateway ◄──── 인터넷                │      │
│  │       │                                       │      │
│  │  NAT Gateway (Elastic IP 할당)                │      │
│  │       │                                       │      │
│  │  Bastion Host (점프 서버)                     │      │
│  └───────┼───────────────────────────────────────┘      │
│          │                                              │
│  ┌───────┼── Private Subnet ─────────────────────┐      │
│  │       ▼                                       │      │
│  │  App Server (Spring Boot)                     │      │
│  │       │ ← NAT를 통해 외부 API 호출            │      │
│  │       │ ← NAT를 통해 패키지 다운로드          │      │
│  └───────┼───────────────────────────────────────┘      │
│          │                                              │
│  ┌───────┼── Private Subnet (DB) ────────────────┐      │
│  │       ▼                                       │      │
│  │  RDS (MySQL)                                  │      │
│  │  ← 인터넷 접근 불필요 (NAT 불필요)            │      │
│  └───────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────┘
```

### NAT Gateway vs NAT Instance 비교

| 항목               | NAT Gateway            | NAT Instance         |
| ------------------ | ---------------------- | -------------------- |
| **관리**           | AWS 완전 관리형        | 사용자 직접 관리     |
| **가용성**         | AZ 내 자동 이중화      | 직접 이중화 구성     |
| **대역폭**         | 최대 100 Gbps          | 인스턴스 타입에 의존 |
| **비용**           | 시간당 + 데이터 처리량 | 인스턴스 비용만      |
| **Security Group** | 미지원                 | 지원                 |
| **포트 포워딩**    | 미지원                 | 지원                 |
| **Bastion 겸용**   | 불가                   | 가능                 |
| **추천**           | 프로덕션 환경          | 학습/비용 절약       |

### Private Subnet + NAT의 보안적 이점

NAT를 연결해도 외부에서 Private EC2로 직접 접근하는 것은 **불가능**합니다.  
NAT는 "나가는 문"만 열어줄 뿐, "들어오는 문"은 여전히 닫혀있습니다.

```
NAT의 트래픽 방향:

✅ Private EC2 → NAT → IGW → 인터넷       (아웃바운드: 허용)
❌ 인터넷 → IGW → NAT → Private EC2       (인바운드: 차단)
```

| 보안 이점             | 설명                                                  |
| --------------------- | ----------------------------------------------------- |
| **공격 표면 최소화**  | 외부에서 인스턴스에 직접 접근할 수 없음               |
| **아웃바운드만 허용** | 업데이트, API 호출 등 필요한 통신만 가능              |
| **감사 용이**         | 모든 아웃바운드가 NAT의 EIP를 통해 나가므로 추적 가능 |
| **화이트리스트 간편** | 외부 서비스에서 NAT의 EIP 하나만 허용하면 됨          |

> [!TIP]
> **실무 원칙:** 외부 노출이 불필요한 리소스(앱 서버, DB, 배치 서버)는 모두 Private Subnet에 배치합니다.  
> 웹 서버라도 Application Load Balancer (ALB) 뒤에 Private Subnet에 두는 것이 표준 아키텍처입니다.  
> NAT는 Private 리소스가 "필요할 때만 바깥으로 나갈 수 있는 통로"를 제공합니다.

---

## 6. Elastic IP와 NAT Gateway 배치 모드

> [!CONCEPT] Elastic IP (EIP)
> **Elastic IP**는 AWS 계정에 할당하는 고정 공인 IPv4 주소입니다.  
> 인스턴스를 Stop/Start해도 변하지 않으며, NAT Gateway에 연결하면 Private Subnet의 모든 아웃바운드 트래픽이 이 IP로 나갑니다.

### Elastic IP 주요 특성

| 특성          | 설명                                                                                           |
| ------------- | ---------------------------------------------------------------------------------------------- |
| **고정 IP**   | 한 번 할당하면 해제할 때까지 같은 IP 유지                                                      |
| **연결 대상** | EC2 인스턴스 또는 NAT Gateway에 연결 가능                                                      |
| **과금 규칙** | 연결된 상태에서 리소스가 실행 중이면 무료. 미사용(미연결 또는 연결 대상 중지) 시 시간당 $0.005 |
| **할당 방식** | 수동 할당(Allocate) 후 리소스에 연결(Associate)                                                |
| **해제**      | 먼저 연결 해제(Disassociate) → 할당 해제(Release) 순서                                         |

### EIP를 사용하는 이유

```
일반 Public IP:
EC2 Stop → Start 시 IP가 변경됨
→ 외부 방화벽 화이트리스트, DNS 설정이 무효화

Elastic IP:
EC2 Stop → Start 해도 IP 유지
→ 고정 IP가 필요한 서비스에 적합

NAT Gateway + EIP:
Private Subnet의 모든 아웃바운드 트래픽이 EIP로 나감
→ 외부 서비스에서 이 IP를 화이트리스트에 등록 가능
```

### NAT Gateway 배치 모드: Zonal vs Regional

| 항목            | Zonal (기존)                            | Regional (2025년 신규)                  |
| --------------- | --------------------------------------- | --------------------------------------- |
| **배치 방식**   | 개발자가 특정 AZ의 Public Subnet을 지정 | AWS가 AZ 배치를 추상화, VPC 단위로 생성 |
| **Subnet 지정** | Public Subnet 지정 필수                 | 불필요 (VPC만 선택)                     |
| **Route Table** | AZ별 Private RT에 각각 연결             | 자동 생성된 RT 사용                     |
| **EIP**         | 수동 할당 또는 Allocate 버튼 사용       | Automatic(AWS 관리) 또는 Manual         |
| **고가용성**    | AZ별로 각각 생성하여 직접 구성          | AWS가 관리하여 편리하게 제공            |
| **학습 적합도** | 개념 이해에 적합 (수동 설정)            | 편리하지만 내부 동작이 숨겨짐           |

> [!WARNING]
> Regional 모드는 AZ 배치를 AWS가 추상화하여 편리하게 관리해 주는 방식이지, NAT Gateway가 물리적으로 AZ를 초월하여 존재하는 것은 아닙니다.  
> 완전한 AZ 장애 격리가 필요한 프로덕션 아키텍처에서는 여전히 가용 영역별 데이터 흐름과 가용성 보장 구조를 인지하고 설계해야 합니다.

> [!TIP]
> 이 실습에서는 **Zonal** 모드를 사용합니다.  
> Route Table에 수동으로 경로를 추가하는 과정을 통해 NAT의 동작 원리를 직접 확인합니다.  
> Regional 모드는 프로덕션에서 편리하지만, 학습 목적에서는 Zonal이 개념 이해에 더 적합합니다.

---

## 7. Route Table과 NAT의 관계

> [!CONCEPT] Route Table이 NAT를 연결하는 방법
> Route Table은 "이 Subnet에서 나가는 패킷을 어디로 보낼지" 결정하는 라우팅 규칙입니다.  
> Private Subnet에서 인터넷으로 나가려면 Route Table에 `0.0.0.0/0 → NAT` 경로를 추가해야 합니다.

### Public vs Private Route Table의 차이

```
Public Route Table:
┌─────────────────────────────────────┐
│  Destination  │  Target             │
├───────────────┼─────────────────────┤
│  10.0.0.0/16  │  local              │  ← VPC 내부 통신 (자동)
│  0.0.0.0/0    │  igw-xxx (IGW)      │  ← 인터넷 직접 접근
└─────────────────────────────────────┘

Private Route Table (NAT 설정 전):
┌─────────────────────────────────────┐
│  Destination  │  Target             │
├───────────────┼─────────────────────┤
│  10.0.0.0/16  │  local              │  ← VPC 내부 통신만 가능
│               │  (인터넷 경로 없음) │  ← 인터넷 접근 불가!
└─────────────────────────────────────┘

Private Route Table (NAT 설정 후):
┌─────────────────────────────────────┐
│  Destination  │  Target             │
├───────────────┼─────────────────────┤
│  10.0.0.0/16  │  local              │  ← VPC 내부 통신
│  0.0.0.0/0    │  nat-xxx (NAT GW)   │  ← 인터넷 → NAT 경유
└─────────────────────────────────────┘
```

### Route Table 경로 매칭 규칙

패킷의 목적지 IP와 Route Table의 Destination을 비교할 때, **가장 구체적인(Longest Prefix Match)** 경로가 우선합니다:

| 패킷 목적지  | 매칭되는 경로         | 이유                        |
| ------------ | --------------------- | --------------------------- |
| `10.0.1.50`  | `10.0.0.0/16 → local` | /16이 /0보다 구체적         |
| `8.8.8.8`    | `0.0.0.0/0 → NAT`     | VPC 대역이 아니므로 /0 매칭 |
| `10.0.11.20` | `10.0.0.0/16 → local` | 같은 VPC 내부이므로 local   |

> [!NOTE]
> `0.0.0.0/0`은 "그 외 모든 목적지"를 의미하는 기본 경로(Default Route)입니다.  
> VPC 내부 트래픽(10.0.0.0/16)은 항상 `local`로 처리되고, 그 외 트래픽만 NAT/IGW로 전달됩니다.  
> 따라서 NAT를 설정해도 VPC 내부 통신에는 영향을 주지 않습니다.

---

## 8. NAT Instance 핵심 기술 요소

> [!CONCEPT] NAT Instance를 직접 구성하는 원리
> NAT Instance는 일반 EC2 인스턴스에 3가지 핵심 설정을 적용하여 NAT 기능을 수행하게 합니다.  
> 과거에는 AWS Marketplace에서 전용 AMI(`amzn-ami-vpc-nat`)를 제공했으나, Amazon Linux 1 기반으로 2023년 12월 EOL되어 더 이상 사용할 수 없습니다.  
> 현재는 Amazon Linux 2023 인스턴스에 직접 설정하는 방식을 사용합니다.

### 핵심 설정 3가지

| 설정                           | 설명                                                      | 미설정 시 결과                         |
| ------------------------------ | --------------------------------------------------------- | -------------------------------------- |
| **Source/Dest Check 비활성화** | EC2 기본 동작(자신이 Source/Dest인 패킷만 처리)을 해제    | 다른 인스턴스의 트래픽이 폐기됨        |
| **IP Forwarding 활성화**       | Linux 커널이 패킷을 다른 인터페이스로 전달할 수 있게 설정 | 패킷이 커널에서 폐기됨                 |
| **iptables MASQUERADE**        | 출발지 IP를 NAT Instance의 Public IP로 변환하는 규칙      | IP 변환이 안 되어 응답이 돌아오지 않음 |

### Source/Destination Check

```
Source/Dest Check = 활성화 (기본):
┌──────────────────────────────────────────────┐
│  EC2 인스턴스                                │
│                                              │
│  수신 패킷 검사:                             │
│  • Source가 나 자신? → 처리                  │
│  • Destination이 나 자신? → 처리             │
│  • 둘 다 아님? → ❌ 폐기 (Drop)              │
└──────────────────────────────────────────────┘

Source/Dest Check = 비활성화 (NAT Instance):
┌──────────────────────────────────────────────┐
│  EC2 인스턴스 (NAT)                          │
│                                              │
│  수신 패킷 검사:                             │
│  • Source가 나 자신? → 처리                  │
│  • Destination이 나 자신? → 처리             │
│  • 둘 다 아님? → ✅ 전달 (Forward)           │
└──────────────────────────────────────────────┘
```

### IP Forwarding (net.ipv4.ip_forward)

```
ip_forward = 0 (기본):
패킷 도착 → 목적지가 자신이 아님 → 커널이 폐기

ip_forward = 1 (활성화):
패킷 도착 → 목적지가 자신이 아님 → 라우팅 테이블 확인 → 다른 인터페이스로 전달
```

### iptables 기초 개념

> [!NOTE]
> Amazon Linux 2023에는 `iptables`가 기본 설치되어 있지 않습니다.  
> NAT Instance 실습에서 `iptables-services` 패키지를 설치한 후 사용합니다.  
> 일반 EC2(웹 서버, DB 서버 등)에서는 Security Group이 방화벽 역할을 하므로 iptables를 설정할 필요가 없습니다.  
> **iptables는 NAT Instance처럼 패킷을 변환·중계하는 특수한 경우에만 사용합니다.**

iptables는 Linux 커널의 패킷 필터링/변환 도구입니다. NAT Instance에서는 이것을 사용하여 IP 주소를 변환합니다.

**테이블(Table)**: 규칙을 용도별로 분류한 그룹

| 테이블     | 용도                                   | NAT Instance에서의 역할    |
| ---------- | -------------------------------------- | -------------------------- |
| **filter** | 패킷 허용/거부 (기본 테이블)           | FORWARD 체인으로 전달 허용 |
| **nat**    | IP 주소/포트 변환                      | MASQUERADE로 IP 변환       |
| mangle     | 패킷 헤더 수정 (고급, 실습에서 미사용) | -                          |

> [!NOTE]
> **`-t` 옵션을 생략하면 자동으로 filter 테이블에 적용됩니다.**
>
> ```bash
> # filter 테이블 (-t 생략됨)
> sudo iptables -A FORWARD -s 10.0.0.0/16 -j ACCEPT
>
> # nat 테이블 (-t nat 명시)
> sudo iptables -t nat -A POSTROUTING -o ens5 -j MASQUERADE
> ```
>
> 실습에서 `-t nat`이 붙은 명령은 주소 변환 규칙이고, 없는 명령은 패킷 통과 허용/거부 규칙입니다.  
> **Private EC2에서 외부로 나가는 패킷(아웃바운드) 기준으로**, filter 테이블의 FORWARD 체인이 먼저 패킷 통과를 판단(ACCEPT)한 뒤, nat 테이블의 POSTROUTING 체인에서 주소 변환(MASQUERADE)이 적용됩니다.  
> filter의 FORWARD에서 REJECT/DROP되면 nat 단계까지 도달하지 못합니다.

**체인(Chain)**: 패킷이 처리되는 시점(훅 포인트)

| 체인            | 패킷 처리 시점                           | NAT Instance에서의 역할      |
| --------------- | ---------------------------------------- | ---------------------------- |
| **FORWARD**     | 이 장비를 경유하여 다른 곳으로 전달될 때 | Private EC2 트래픽 통과 허용 |
| **POSTROUTING** | 패킷이 인터페이스를 통해 나가기 직전     | 출발지 IP를 Public IP로 변환 |
| INPUT           | 이 장비에 도착하는 패킷                  | (NAT 기능에서는 사용 안 함)  |
| OUTPUT          | 이 장비에서 나가는 패킷                  | (NAT 기능에서는 사용 안 함)  |

**NAT Instance에서 패킷이 처리되는 순서:**

```
Private EC2에서 패킷 도착
    │
    ▼
[FORWARD 체인 - filter 테이블]
    "이 패킷을 통과시킬까?" → ACCEPT / REJECT
    │
    ▼ (ACCEPT인 경우)
[POSTROUTING 체인 - nat 테이블]
    "출발지 IP를 변환할까?" → MASQUERADE (10.0.11.x → Public IP)
    │
    ▼
네트워크 인터페이스(ens5)를 통해 인터넷으로 전송
```

> [!WARNING]
> `iptables-services`를 시작하면 FORWARD 체인에 기본 `REJECT all` 규칙이 추가됩니다.  
> 이 규칙이 있으면 아래에 ACCEPT를 추가해도 **위에서 먼저 거부**되어 패킷이 통과하지 못합니다.  
> 실습에서 `sudo iptables -F FORWARD`(규칙 전체 삭제)를 먼저 실행하는 이유입니다.
>
> ```
> FORWARD 체인 규칙 처리 순서 (위에서 아래로):
>
> ❌ 잘못된 경우 (기본 REJECT가 남아있음):
>   1. REJECT all   ← 모든 패킷이 여기서 거부됨
>   2. ACCEPT ...   ← 도달하지 못함!
>
> ✅ 올바른 경우 (-F로 초기화 후 ACCEPT만 추가):
>   1. ACCEPT (RELATED,ESTABLISHED)  ← 응답 패킷 허용
>   2. ACCEPT (VPC 대역 → 인터넷)    ← 새 요청 허용
> ```

### iptables MASQUERADE

```
MASQUERADE 전:
Private EC2 (10.0.11.50) → NAT Instance → 인터넷
패킷: src=10.0.11.50, dst=8.8.8.8
→ 인터넷 라우터가 사설 IP(10.x.x.x)를 모르므로 응답 불가

MASQUERADE 후:
Private EC2 (10.0.11.50) → NAT Instance → 인터넷
패킷: src=3.35.x.x (NAT의 Public IP), dst=8.8.8.8
→ 인터넷 라우터가 공인 IP로 응답 전송 가능
→ NAT Instance가 응답을 받아 원래 Private EC2로 전달
```

---

## 9. EC2 접속 방식 비교

> [!CONCEPT] EC2에 접속하는 3가지 방법
> AWS에서 EC2 인스턴스에 접속하는 방법은 3가지가 있습니다.  
> 상황에 따라 적합한 방식을 선택합니다.

### 접속 방식 비교

| 방식                     | 필요 조건                               | 키 페어 필요 | 포트 오픈 | 적합한 상황            |
| ------------------------ | --------------------------------------- | ------------ | --------- | ---------------------- |
| **SSH (터미널)**         | SG 22번 + Public IP + .pem 파일         | ✅           | 22번 필수 | 파일 전송(SCP), 터널링 |
| **EC2 Instance Connect** | SG 22번 + Public IP (또는 EIC Endpoint) | ❌           | 22번 필수 | 빠른 접속, 간단한 작업 |
| **SSM Session Manager**  | IAM Role + 인터넷(NAT/Endpoint)         | ❌           | 불필요    | Private EC2, 보안 환경 |

### EC2 Instance Connect

```
동작 원리:
1. 콘솔에서 [Connect] 클릭
2. AWS가 임시 SSH 공개키를 인스턴스의 메타데이터에 주입 (60초간 유효)
3. 브라우저가 해당 키로 SSH 접속
4. 60초 후 키 자동 만료

기본 조건:
• Public IP가 있어야 함
• Security Group에서 SSH(22) 포트가 열려있어야 함
• Amazon Linux 2023에는 기본 설치됨 (ec2-instance-connect 패키지)
```

> [!NOTE]
> **EIC Endpoint(EC2 Instance Connect Endpoint)를 사용하면 Private Subnet에서도 접속 가능합니다.**  
> VPC 내부에 EIC Endpoint를 미리 생성해 두면, Public IP가 없고 22번 포트를 외부에 열지 않은 Private EC2에도 콘솔 브라우저로 접속할 수 있습니다.  
> 이 실습에서는 다루지 않지만, SSM Session Manager와 함께 Private EC2 접속의 또 다른 선택지입니다.

### AWS Systems Manager (SSM) Session Manager

```
동작 원리:
1. EC2 내부의 SSM Agent가 AWS Systems Manager 서비스에 등록
2. 사용자가 콘솔/CLI로 세션 요청
3. SSM 서비스가 Agent에 세션 생성 명령 전달
4. Agent가 세션을 열고 사용자와 연결

조건:
• IAM Role (AmazonSSMManagedInstanceCore) 연결
• SSM Agent 실행 중 (Amazon Linux 2023 기본 설치)
• 인터넷 접근 가능 (NAT 또는 VPC Endpoint)
  → Private Subnet에서는 NAT/Endpoint 없이 사용 불가!
```

### 상황별 권장 접속 방식

| 상황                          | 권장 방식                          | 이유                             |
| ----------------------------- | ---------------------------------- | -------------------------------- |
| Public Subnet, 빠른 확인      | EC2 Instance Connect               | 키 없이 브라우저에서 바로        |
| Public Subnet, 파일 전송 필요 | SSH (SCP)                          | SCP/rsync 사용 가능              |
| Private Subnet, NAT 있음      | SSM Session Manager                | 포트 오픈 불필요, 감사 로그 자동 |
| Private Subnet, NAT 없음      | Bastion 경유 SSH 또는 EIC Endpoint | NAT 설정 전 대안                 |

---

## 10. Bastion Host (점프 서버)

> [!CONCEPT] Bastion Host의 역할과 한계
> **Bastion Host**는 Public Subnet에 위치하여 외부에서 Private Subnet의 인스턴스에 접근할 수 있는 유일한 진입점 역할을 하는 서버입니다.  
> SSH 접속의 중계 역할을 하며, 보안 감사와 접근 제어의 단일 지점을 제공합니다.  
> 다만 **실무에서는 점차 지양되는 추세**이며, AWS Systems Manager Session Manager로 대체되고 있습니다.

### 주요 용어

| 용어                                    | 설명                                                          |
| --------------------------------------- | ------------------------------------------------------------- |
| **Bastion Host (점프 서버)**            | Public Subnet에서 Private 인스턴스로 SSH 접속을 중계하는 서버 |
| **SSH Agent Forwarding**                | 로컬 키를 Bastion에 노출하지 않고 Private EC2에 접속하는 방법 |
| **ProxyJump (-J 옵션)**                 | Bastion을 경유하여 한 번의 명령으로 Private EC2에 직접 접속   |
| **AWS Systems Manager Session Manager** | Bastion 없이 Private EC2에 접속하는 AWS 관리형 서비스         |

### Bastion Host 접속 흐름

```
개발자 PC                Bastion Host              Private EC2
(인터넷)                 (Public Subnet)           (Private Subnet)
                         10.0.1.x                  10.0.11.x

┌────────┐   SSH(22)    ┌───────────┐   SSH(22)    ┌──────────┐
│ 개발자 │ ──────────►  │  Bastion  │ ──────────►  │  App     │
│  PC    │              │  Host     │              │  Server  │
└────────┘              └───────────┘              └──────────┘

프롬프트 비교:
[로컬 PC]         → 명령 프롬프트 / PS C:\Users\...>
[Bastion]         → [ec2-user@ip-10-0-1-xxx ~]$
[Private EC2]     → [ec2-user@ip-10-0-11-xxx ~]$
                                      ↑ 여기가 다름! (1 vs 11)
```

### Bastion Host의 장단점

| 장점                            | 단점                                  |
| ------------------------------- | ------------------------------------- |
| 단일 진입점으로 접근 제어 가능  | 별도 EC2 관리 필요 (패치, 모니터링)   |
| Security Group으로 IP 제한 가능 | 키 파일 관리/공유 문제                |
| SSH 터널링으로 포트 포워딩 가능 | 22번 포트를 인터넷에 노출 (공격 표면) |
| 네트워크 레벨 감사 가능         | 팀원 증감 시 키 관리 복잡             |
| 추가 비용 저렴 (t3.micro)       | SPOF — Bastion 장애 시 접근 불가      |

### 실무에서 Bastion Host를 지양하는 이유

```
문제 1: 보안 위험
┌────────────────────────────────────────────────────────┐
│  • SSH(22) 포트가 인터넷에 노출 → 브루트포스 공격 대상 │
│  • .pem 키 파일 유출 시 서버 전체 접근 가능            │
│  • 퇴사자 키 회수가 어려움                             │
│  • Bastion 서버 자체가 해킹되면 내부 전체 노출         │
└────────────────────────────────────────────────────────┘

문제 2: 운영 부담
┌───────────────────────────────────────────────────────┐
│  • OS 패치, 보안 업데이트 주기적 수행 필요            │
│  • SSH 세션 로깅을 별도 설정해야 감사 가능            │
│  • 팀원마다 키 페어 발급/회수/교체 관리 필요          │
│  • 고가용성 확보하려면 Multi-AZ 배치 필요             │
└───────────────────────────────────────────────────────┘

대안: AWS Systems Manager Session Manager
┌───────────────────────────────────────────────────────┐
│  ✅ SSH 포트 노출 없음 (22번 포트 불필요)             │
│  ✅ 키 파일 불필요 (IAM 기반 접근 제어)               │
│  ✅ CloudTrail에 모든 세션 자동 기록                  │
│  ✅ IAM 정책으로 팀원별 접근 범위 제어                │
│  ✅ 추가 인스턴스 비용 없음                           │
│  ✅ Private Subnet에서도 동작 (NAT/Endpoint 필요)     │
└───────────────────────────────────────────────────────┘
```

### SSH 점프 접속 시 주의사항

Bastion을 경유하여 여러 서버에 접속할 때, **현재 자신이 어디에 있는지** 항상 인지해야 합니다.

> [!WARNING]
> **SSH 점프 후 가장 흔한 실수:**
>
> - Bastion에서 실행할 명령을 Private EC2에서 실행 (또는 그 반대)
> - Private EC2에서 `exit`을 한 번 더 쳐서 Bastion까지 종료
> - 로컬인 줄 알고 `rm -rf`를 서버에서 실행
> - 패키지 설치를 Bastion에 해버림 (Private EC2에 해야 하는데)

```
접속 상태 확인 방법:

1. 프롬프트의 IP 확인
   [ec2-user@ip-10-0-1-50 ~]$     ← Bastion (10.0.1.x)
   [ec2-user@ip-10-0-11-20 ~]$    ← Private EC2 (10.0.11.x)

2. hostname 명령 실행
   $ hostname
   ip-10-0-1-50.ap-northeast-2.compute.internal    ← Bastion
   ip-10-0-11-20.ap-northeast-2.compute.internal   ← Private EC2

3. 현재 접속 단계 파악
   로컬 PC → [ssh] → Bastion → [ssh] → Private EC2
                                         ↑ 여기서 exit 하면
                      ↑ 여기로 돌아옴      Bastion으로 복귀
```

### 접속 해제 시 주의

```
Private EC2에서 작업 완료 후:

[ec2-user@ip-10-0-11-20 ~]$ exit     ← Private EC2 종료 → Bastion으로 복귀
[ec2-user@ip-10-0-1-50 ~]$ exit      ← Bastion 종료 → 로컬 PC로 복귀
[로컬 PC] $                           ← 로컬로 돌아옴

⚠️ exit을 한 번만 치면 Bastion에 있는 상태!
   두 번 쳐야 로컬로 완전히 돌아옵니다.
```

### Bastion Host 보안 모범 사례

실습 환경에서는 간단히 구성하지만, 실무에서 Bastion을 사용해야 할 경우 아래를 적용합니다:

| 항목               | 권장 설정                                     |
| ------------------ | --------------------------------------------- |
| **인바운드 규칙**  | 회사/VPN IP만 SSH 허용 (0.0.0.0/0 절대 금지)  |
| **인스턴스 타입**  | t3.micro (최소 사양, 불필요한 서비스 제거)    |
| **SSH 키 관리**    | 팀원별 개인 키 발급, 퇴사 시 즉시 폐기        |
| **세션 로깅**      | Amazon CloudWatch Logs로 SSH 세션 기록        |
| **MFA**            | SSH 접속 시 MFA(Google Authenticator 등) 적용 |
| **Auto Scaling**   | Bastion 장애 시 자동 복구                     |
| **접근 시간 제한** | 업무 시간 외 SG 규칙으로 접근 차단            |

### Bastion vs SSM Session Manager 비교

| 항목             | Bastion Host               | SSM Session Manager           |
| ---------------- | -------------------------- | ----------------------------- |
| **포트 노출**    | SSH(22) 필수               | 포트 오픈 불필요              |
| **키 관리**      | .pem 파일 배포/회수 필요   | IAM 정책으로 관리             |
| **접근 로그**    | 별도 설정 필요             | AWS CloudTrail에 자동 기록    |
| **추가 비용**    | Bastion EC2 비용           | 무료 (NAT/Endpoint 비용 별도) |
| **설정 복잡도**  | SG + 키 + EC2 관리         | IAM Role 연결만               |
| **팀 규모 확장** | 키 공유 문제 발생          | IAM 정책 추가만               |
| **권장 환경**    | 레거시, SSH 터널링 필요 시 | **신규 프로젝트 표준**        |

> [!TIP]
> **실무 권장: SSM Session Manager를 기본으로 사용하세요.**
>
> - 신규 프로젝트 → SSM Session Manager (Bastion 불필요)
> - SSH 터널링이 반드시 필요한 경우 → Bastion 유지하되 접근 IP 제한
> - 이 실습에서 Bastion을 사용하는 이유 → NAT 없는 상태에서 Private EC2에 접속하여 "인터넷 불가"를 확인하기 위함

---

## 11. NAT와 SSM Session Manager의 관계

> [!CONCEPT] Private EC2에서 SSM이 동작하려면
> AWS Systems Manager Session Manager는 EC2 내부의 **SSM Agent**가 AWS API 엔드포인트(`ssm.region.amazonaws.com`)에 접근하여 등록해야 동작합니다.  
> Private Subnet의 EC2는 인터넷에 접근할 수 없으므로, **NAT 또는 VPC Endpoint가 있어야 SSM 접속이 가능**합니다.

### SSM 접속을 위한 조건

| 조건             | 설명                                         | Private Subnet에서의 상태      |
| ---------------- | -------------------------------------------- | ------------------------------ |
| ① IAM Role 연결  | `AmazonSSMManagedInstanceCore` 정책 필요     | EC2 생성 시 연결 (인터넷 무관) |
| ② SSM Agent 실행 | Amazon Linux 2023은 기본 설치·자동 실행      | 자동 실행됨 (인터넷 무관)      |
| ③ 네트워크 접근  | SSM 서비스 엔드포인트에 HTTPS(443) 접근 필요 | ❌ NAT 없으면 불가             |

### NAT 설정 전후 비교

```
NAT 설정 전:
┌────────────────────────────────────────────────────────────┐
│  Private EC2                                               │
│  • IAM Role: ✅ 연결됨                                     │
│  • SSM Agent: ✅ 실행 중                                   │
│  • 네트워크: ❌ ssm.ap-northeast-2.amazonaws.com 접근 불가 │
│  → 결과: Session Manager Connect 버튼 비활성               │
└────────────────────────────────────────────────────────────┘

NAT 설정 후:
┌────────────────────────────────────────────────────────────┐
│  Private EC2                                               │
│  • IAM Role: ✅ 연결됨                                     │
│  • SSM Agent: ✅ 실행 중                                   │
│  • 네트워크: ✅ NAT → IGW → SSM 엔드포인트 접근            │
│  → 결과: Session Manager 접속 가능                         │
└────────────────────────────────────────────────────────────┘
```

### NAT 대신 VPC Endpoint를 사용하는 방법

```
VPC Endpoint (PrivateLink):
Private EC2 → VPC Endpoint → SSM 서비스 (인터넷 경유 없음)

필요한 VPC Endpoint 3개:
• com.amazonaws.region.ssm
• com.amazonaws.region.ssmmessages
• com.amazonaws.region.ec2messages

장점: NAT 없이도 SSM 접속 가능, 데이터가 AWS 네트워크 내부에서만 이동
단점: Endpoint마다 시간당 + 데이터 비용 발생
```

> [!TIP]
> **어떤 방식을 선택할까?**
>
> - NAT Gateway가 이미 있는 환경 → 추가 설정 없이 SSM 동작
> - NAT가 불필요하지만 SSM만 필요한 경우 → VPC Endpoint 사용
> - 비용 최적화 → NAT Instance를 Bastion + NAT + SSM 겸용으로 사용

---

## 12. VPN과 Direct Connect 간단 소개

> [!CONCEPT] VPN과 Direct Connect 비교
> **VPN**(Virtual Private Network)은 인터넷을 통해 암호화된 터널로 AWS VPC에 연결하는 방식이고, **Direct Connect**는 전용 물리 회선으로 AWS에 직접 연결하는 방식입니다. 둘 다 On-Premise와 AWS 간 하이브리드 연결에 사용됩니다.

### 주요 용어

| 용어                              | 설명                                                      |
| --------------------------------- | --------------------------------------------------------- |
| **Site-to-Site VPN**              | 인터넷을 통해 IPsec 암호화 터널로 AWS VPC에 연결하는 방식 |
| **AWS Direct Connect**            | 전용 물리 회선으로 AWS에 직접 연결하는 서비스             |
| **IPsec**                         | IP 패킷을 암호화하는 보안 프로토콜                        |
| **VGW (Virtual Private Gateway)** | VPC 측에서 VPN/Direct Connect 연결을 수신하는 게이트웨이  |

### 연결 방식 비교

```
Site-to-Site VPN:
┌───────────┐    인터넷 (암호화 터널)    ┌──────────┐
│ On-Premise│ ═══════════════════════►   │  AWS VPC │
│ (VPN GW)  │    IPsec 암호화            │ (VGW)    │
└───────────┘    지연: 가변적            └──────────┘

Direct Connect:
┌────────────┐    전용 물리 회선         ┌──────────┐
│ On-Premise │ ───────────────────────   │  AWS VPC │
│ (라우터)   │    1Gbps / 10Gbps         │ (VGW)    │
└────────────┘    지연: 일정/낮음        └──────────┘
```

### VPN vs Direct Connect 비교

| 항목          | Site-to-Site VPN     | Direct Connect       |
| ------------- | -------------------- | -------------------- |
| **연결 매체** | 인터넷               | 전용 회선            |
| **암호화**    | IPsec (기본 제공)    | 별도 설정 필요       |
| **대역폭**    | 최대 1.25 Gbps       | 1/10/100 Gbps        |
| **지연 시간** | 가변적 (인터넷 경유) | 일정하고 낮음        |
| **설정 시간** | 수 분                | 수 주 ~ 수 개월      |
| **비용**      | 저렴 (시간당 과금)   | 고가 (포트 + 데이터) |
| **이중화**    | 자동 (터널 2개)      | 직접 구성 필요       |
| **사용 사례** | 소규모, 빠른 연결    | 대용량, 안정적 연결  |

---

## 핵심 정리

| 개념                 | 한 줄 요약                                                    |
| -------------------- | ------------------------------------------------------------- |
| NAT                  | 사설 IP ↔ 공인 IP 주소 변환 기술                              |
| Public vs Private IP | 인터넷 직접 통신 가능 vs NAT 필요                             |
| SNAT                 | 출발지 IP 변환 (내부→외부)                                    |
| DNAT                 | 목적지 IP 변환 (외부→내부)                                    |
| NAT Gateway          | AWS 관리형 NAT (프로덕션 권장)                                |
| NAT Instance         | EC2에 직접 NAT 설정 (학습/비용 절약)                          |
| Elastic IP           | 고정 공인 IPv4. NAT Gateway에 연결하여 아웃바운드 IP 고정     |
| Route Table + NAT    | Private RT에 `0.0.0.0/0 → NAT` 경로 추가로 인터넷 접근        |
| Private + NAT 보안   | 아웃바운드만 허용, 인바운드는 여전히 차단 (공격 표면 최소화)  |
| Zonal vs Regional    | AZ별 개별 생성 vs VPC 단위 자동 확장                          |
| Source/Dest Check    | NAT Instance에서 반드시 비활성화해야 하는 설정                |
| IP Forwarding        | 커널이 패킷을 다른 인터페이스로 전달하는 설정                 |
| iptables MASQUERADE  | 출발지 IP를 NAT의 Public IP로 변환하는 규칙                   |
| iptables 테이블/체인 | filter(허용/거부) + nat(주소변환), FORWARD + POSTROUTING 체인 |
| EC2 Instance Connect | 브라우저에서 키 없이 SSH 접속 (Public IP 필요)                |
| SSM Session Manager  | IAM + 인터넷(NAT/Endpoint)으로 Private EC2 접속               |
| Bastion Host         | Private 인스턴스 접근을 위한 점프 서버 (실무에선 SSM 권장)    |
| VPN                  | 인터넷 경유 암호화 터널 연결                                  |
| Direct Connect       | 전용 물리 회선 직접 연결                                      |

---

## 다음 단계

이 이론을 바탕으로 **Session 1: NAT Instance vs NAT Gateway 비교 실습**에서 직접 NAT를 구성하고 Private Subnet에서 인터넷 접근을 테스트해봅니다.

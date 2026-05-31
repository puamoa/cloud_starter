---
title: 'NAT Instance vs NAT Gateway 비교 실습'
week: 3
session: 1
awsServices:
  - Amazon EC2
  - NAT Gateway
  - Amazon VPC
learningObjectives:
  - Private Subnet에서 인터넷 접근이 필요한 이유를 설명할 수 있습니다.
  - NAT Instance를 구성하고 Source/Dest Check를 비활성화할 수 있습니다.
  - NAT Gateway를 생성하고 Private Route Table에 연결할 수 있습니다.
  - NAT Instance와 NAT Gateway의 차이(비용, 성능, 관리)를 비교할 수 있습니다.
prerequisites:
  - AWS 계정 생성 완료
  - VPC (Public Subnet + Private Subnet) 필요
estimatedCost: NAT Gateway 시간당 과금 (크레딧 소진 주의)
---

이 실습에서는 Private Subnet의 인스턴스가 인터넷에 접근할 수 있도록 NAT(Network Address Translation)를 구성합니다.  
NAT Instance와 NAT Gateway 두 가지 방식을 모두 실습하고 비교합니다.

> [!WARNING]
> **비용 주의**: NAT Gateway는 크레딧에서 차감되며 비용이 빠르게 소진될 수 있습니다.
>
> | 리소스                  | 비용 (서울 리전)                     | 비고             |
> | ----------------------- | ------------------------------------ | ---------------- |
> | NAT Gateway             | 시간당 ~$0.059 + 데이터 GB당 ~$0.059 | 월 ~$42.5 (24/7) |
> | NAT Instance (t2.micro) | 크레딧 내 사용 가능                  | 월 ~$10          |
> | Elastic IP (미사용 시)  | 시간당 ~$0.005                       | 월 ~$3.6         |
>
> 실습이 끝나면 **NAT Gateway + Elastic IP**를 반드시 삭제하세요.

> [!NOTE]
> 이 실습은 VPC(Public Subnet + Private Subnet)가 필요합니다.  
> Step 1에서 생성한 VPC가 있다면 그것을 사용합니다. 없다면 태스크 0의 CloudFormation으로 생성합니다.

## 태스크 0: 선행 리소스 생성 (CloudFormation)

> [!DOWNLOAD]
> [step3-1-nat-lab.zip](/files/step3/step3-1-nat-lab.zip)
>
> - `step3-1-nat-prereq.yaml` - CloudFormation 템플릿 (VPC, 서브넷 4개, IGW, Route Table, Security Group 자동 생성)

이미 Step 1에서 생성한 VPC(`my-vpc`), Public/Private Subnet, IGW가 있다면 이 태스크를 건너뛰고 태스크 1로 이동합니다.

1. AWS Management Console에 로그인합니다.
2. 우측 상단에서 리전을 **Asia Pacific (Seoul) ap-northeast-2**로 설정합니다.
3. 상단 검색창에 `CloudFormation`을 입력하고 **CloudFormation** 서비스를 선택합니다.
4. [[Create stack]] 드롭다운을 클릭한 후 **With new resources (standard)**를 선택합니다.
5. **Prerequisite - Prepare template**에서 `Choose an existing template`을 선택합니다.
6. **Specify template**에서 `Upload a template file`을 선택합니다.
7. [[Choose file]] 버튼을 클릭하고 다운로드한 `step3-1-nat-prereq.yaml` 파일을 선택합니다.
8. [[Next]] 버튼을 클릭합니다.
9. **Stack name**에 `nat-lab-prereq`를 입력합니다.
10. **Parameters** 섹션에서 기본값을 확인합니다. 특별한 이유가 없다면 기본값을 유지합니다.
11. [[Next]] 버튼을 클릭합니다.
12. **Configure stack options** 페이지에서 추가 설정 없이 아래로 스크롤합니다.
13. [[Next]] 버튼을 클릭합니다.
14. **Review and create** 페이지에서 설정을 확인합니다.
15. [[Submit]] 버튼을 클릭합니다.
16. 스택 상태가 `CREATE_COMPLETE`가 될 때까지 기다립니다 (약 1~2분).

> [!NOTE]
> 스택 생성이 완료되면 **Outputs** 탭에서 생성된 리소스의 ID를 확인할 수 있습니다.  
> VPC ID, Subnet ID, Security Group ID 등을 메모해 두세요.

✅ **태스크 완료**: 선행 리소스가 CloudFormation으로 생성되었습니다.

## 태스크 1: Private Subnet에서 인터넷 접근 불가 확인

> [!CONCEPT] Private Subnet과 인터넷 접근
> Private Subnet의 인스턴스는 Public IP가 없고 IGW로의 경로도 없어 인터넷에 직접 접근할 수 없습니다.  
> 하지만 다음과 같은 경우 인터넷 접근이 필요합니다:
>
> - **패키지 업데이트**: `dnf update`, `apt upgrade`
> - **외부 API 호출**: 결제 API, 알림 서비스 등
> - **소프트웨어 다운로드**: 런타임, 라이브러리 설치
> - **AWS 서비스 접근**: S3, SQS 등 (VPC Endpoint 미사용 시)
>
> NAT를 사용하면 Private 인스턴스가 인터넷으로 **나가는** 트래픽은 허용하면서, 외부에서 **들어오는** 트래픽은 차단할 수 있습니다.
>
> ```
> Private EC2 → NAT (Public Subnet) → IGW → 인터넷
>                                              ↓ (응답만 돌아옴)
> Private EC2 ← NAT ← IGW ← 인터넷
>
> 인터넷 → IGW → NAT → Private EC2  ← ❌ 차단 (외부에서 먼저 접근 불가)
> ```

이 태스크에서는 Private Subnet에 EC2를 생성하고, 인터넷 접근이 불가능함을 직접 확인합니다.

### Bastion Host 생성 (Public Subnet)

Private EC2에 접속하려면 먼저 Public Subnet에 "점프 서버"(Bastion Host)가 필요합니다.

17. 상단 검색창에 `EC2`를 입력하고 **EC2** 서비스를 선택합니다.
18. 왼쪽 메뉴에서 **Instances**를 선택합니다.
19. [[Launch instances]] 버튼을 클릭합니다.
20. 다음과 같이 설정합니다:

**Name and tags:**

- **Name**: `my-bastion`

**Application and OS Images:**

- **AMI**: `Amazon Linux 2023 AMI` (Free tier eligible 표시 확인)
- **Architecture**: `64-bit (x86)`

**Instance type:**

- `t2.micro` 선택

**Key pair:**

- 기존 키 페어를 선택합니다. 없으면 [[Create new key pair]]를 클릭하여 생성합니다.
  - **Key pair name**: `my-keypair`
  - **Key pair type**: `RSA`
  - **Private key file format**: `.pem`
  - [[Create key pair]] 클릭 → 파일이 자동 다운로드됩니다.

**Network settings** → [[Edit]] 버튼을 클릭합니다:

- **VPC**: `my-vpc` 선택
- **Subnet**: `my-public-subnet-a` 선택
- **Auto-assign public IP**: `Enable`
- **Firewall (security groups)**: `Select existing security group` 선택
- **Common security groups**: `my-ec2-sg` 선택 (SSH 22번 포트가 열린 SG)

21. [[Launch instance]] 버튼을 클릭합니다.
22. 인스턴스 상태가 `Running`이 될 때까지 기다립니다 (약 1~2분).
23. `my-bastion`의 **Public IPv4 address**를 메모합니다.

> [!NOTE]
> Bastion Host는 Private Subnet의 인스턴스에 접속하기 위한 "중간 다리" 역할을 합니다.  
> 외부(로컬 PC) → Bastion(Public) → Private EC2 순서로 접속합니다.

### Private EC2 인스턴스 생성

24. EC2 콘솔에서 [[Launch instances]] 버튼을 다시 클릭합니다.
25. 다음과 같이 설정합니다:

**Name and tags:**

- **Name**: `my-private-ec2`

**Application and OS Images:**

- **AMI**: `Amazon Linux 2023 AMI`
- **Architecture**: `64-bit (x86)`

**Instance type:**

- `t2.micro` 선택

**Key pair:**

- Bastion과 동일한 키 페어(`my-keypair`)를 선택합니다.

**Network settings** → [[Edit]] 버튼을 클릭합니다:

- **VPC**: `my-vpc` 선택
- **Subnet**: `my-private-subnet-a` 선택
- **Auto-assign public IP**: `Disable`
- **Firewall (security groups)**: `Select existing security group` 선택
- **Common security groups**: `my-ec2-sg` 선택

> [!WARNING]
> **Auto-assign public IP**가 반드시 `Disable`인지 확인하세요. Private Subnet의 인스턴스에는 Public IP를 할당하지 않습니다.

26. [[Launch instance]] 버튼을 클릭합니다.
27. 인스턴스 상태가 `Running`이 될 때까지 기다립니다.
28. `my-private-ec2`의 **Private IPv4 address**를 메모합니다 (예: `10.0.11.xxx`).

> [!NOTE]
> Private EC2에는 Public IP가 없으므로 외부에서 직접 접속할 수 없습니다.  
> Bastion Host를 경유해서만 접속할 수 있습니다.

### Bastion을 통해 Private EC2에 접속

29. 로컬 터미널에서 Bastion Host에 SSH 접속합니다:

```bash
# 키 파일 권한 설정 (최초 1회)
chmod 400 ~/Downloads/my-keypair.pem

# Bastion에 SSH 접속
ssh -i ~/Downloads/my-keypair.pem ec2-user@<Bastion-Public-IP>
```

30. Bastion에서 Private EC2에 접속하기 위해 키 파일을 Bastion으로 전송합니다.  
    **새 터미널을 열어서** 다음 명령을 실행합니다:

```bash
# 로컬에서 키 파일을 Bastion으로 전송
scp -i ~/Downloads/my-keypair.pem ~/Downloads/my-keypair.pem ec2-user@<Bastion-Public-IP>:~/
```

> [!TIP]
> **SSH Agent Forwarding을 사용하면 키 파일을 Bastion에 복사하지 않아도 됩니다 (권장):**
>
> ```bash
> # 로컬에서 SSH Agent에 키 추가
> ssh-add ~/Downloads/my-keypair.pem
>
> # -A 옵션으로 Agent Forwarding 활성화하여 Bastion 접속
> ssh -A -i ~/Downloads/my-keypair.pem ec2-user@<Bastion-Public-IP>
>
> # Bastion에서 바로 Private EC2 접속 가능 (키 파일 불필요)
> ssh ec2-user@<Private-EC2-Private-IP>
> ```
>
> Mac에서 `ssh-add`가 안 되는 경우: `ssh-add --apple-use-keychain ~/Downloads/my-keypair.pem`

31. Bastion에서 Private EC2에 접속합니다:

```bash
# Bastion 터미널에서 실행
chmod 400 ~/my-keypair.pem
ssh -i ~/my-keypair.pem ec2-user@<Private-EC2-Private-IP>
```

32. `Are you sure you want to continue connecting?` 메시지가 나오면 `yes`를 입력합니다.

> [!OUTPUT]
> Private EC2에 접속 성공 시 프롬프트가 표시됩니다:
>
> ```
> [ec2-user@ip-10-0-11-xxx ~]$
> ```
>
> IP가 `10.0.11.xxx` 형태(Private Subnet 대역)인 것을 확인하세요.

### 인터넷 접근 불가 확인

33. Private EC2에서 인터넷 접근을 테스트합니다:

```bash
ping -c 3 google.com
```

> [!OUTPUT]
> 응답이 오지 않고 타임아웃됩니다:
>
> ```
> ping: google.com: Name or service not known
> ```
>
> 또는 `PING google.com ... 100% packet loss`가 표시됩니다.

34. 패키지 업데이트도 시도합니다:

```bash
sudo dnf check-update
```

> [!OUTPUT]
> 타임아웃이 발생합니다. Private Subnet에서는 인터넷에 접근할 수 없기 때문입니다.

> [!NOTE]
> 이것이 바로 NAT가 필요한 이유입니다. Private Subnet의 인스턴스가 패키지를 설치하거나 외부 API를 호출하려면 NAT를 통해 인터넷에 접근해야 합니다.

35. Private EC2에서 나갑니다 (Bastion으로 돌아감):

```bash
exit
```

✅ **태스크 완료**: Private Subnet에서 인터넷 접근이 불가능함을 확인했습니다.

## 태스크 2: NAT Instance 구성

> [!CONCEPT] NAT Instance
> NAT Instance는 일반 EC2 인스턴스에 NAT 기능을 설정한 것입니다.  
> Public Subnet에 배치하고, Private Subnet의 트래픽을 받아 자신의 Public IP로 변환하여 인터넷으로 전달합니다.
>
> **핵심 설정 2가지:**
>
> 1. **Source/Destination Check 비활성화** — EC2는 기본적으로 자신이 Source나 Destination이 아닌 트래픽을 폐기합니다. NAT Instance는 다른 인스턴스의 트래픽을 중계해야 하므로 이 체크를 비활성화해야 합니다.
> 2. **iptables MASQUERADE 설정** — Private EC2의 IP(10.0.11.x)를 NAT Instance의 Public IP로 변환하는 규칙을 추가합니다.
>
> ```
> Private EC2 (10.0.11.50)
>     ↓ 패킷: src=10.0.11.50, dst=google.com
> NAT Instance (10.0.1.100 / Public IP: 3.35.x.x)
>     ↓ 패킷: src=3.35.x.x, dst=google.com  ← IP 변환 (MASQUERADE)
> Internet Gateway
>     ↓
> 인터넷 (google.com)
> ```

### NAT Instance용 EC2 생성

36. Bastion 터미널에서 나와서 AWS 콘솔로 돌아갑니다.
37. EC2 콘솔 → 왼쪽 메뉴에서 **Instances**를 선택합니다.
38. [[Launch instances]] 버튼을 클릭합니다.
39. 다음과 같이 설정합니다:

**Name and tags:**

- **Name**: `my-nat-instance`

**Application and OS Images:**

- **AMI**: `Amazon Linux 2023 AMI`
- **Architecture**: `64-bit (x86)`

**Instance type:**

- `t2.micro` 선택

**Key pair:**

- 동일한 키 페어(`my-keypair`)를 선택합니다.

**Network settings** → [[Edit]] 버튼을 클릭합니다:

- **VPC**: `my-vpc` 선택
- **Subnet**: `my-public-subnet-a` 선택
- **Auto-assign public IP**: `Enable`
- **Firewall (security groups)**: `Select existing security group` 선택
- **Common security groups**: `my-ec2-sg` 선택

> [!WARNING]
> NAT Instance는 반드시 **Public Subnet**에 배치하고 **Public IP를 할당**해야 합니다.  
> Private Subnet에 배치하면 NAT Instance 자체가 인터넷에 접근할 수 없어 NAT 기능이 동작하지 않습니다.

40. [[Launch instance]] 버튼을 클릭합니다.
41. 인스턴스 상태가 `Running`이 될 때까지 기다립니다.
42. `my-nat-instance`의 **Public IPv4 address**를 메모합니다.

### Source/Destination Check 비활성화

43. EC2 콘솔 → **Instances** 목록에서 `my-nat-instance`를 선택합니다 (체크박스 클릭).
44. 상단 **Actions** 메뉴를 클릭합니다.
45. **Networking** → **Change source/destination check**를 선택합니다.
46. 팝업 창에서 **Stop** 체크박스를 선택합니다 (Source/destination checking을 중지).
47. [[Save]] 버튼을 클릭합니다.

> [!OUTPUT]
> "Source/destination check was successfully changed" 메시지가 표시됩니다.

> [!NOTE]
> **Source/Destination Check란?**
>
> EC2는 기본적으로 자신이 보낸(Source) 패킷이거나 자신에게 온(Destination) 패킷만 처리합니다.  
> 그 외의 패킷은 폐기합니다.
>
> NAT Instance는 Private EC2가 보낸 패킷(Source: 10.0.11.x)을 받아서 인터넷으로 전달하는 "중계자"입니다.  
> 이 패킷의 Source는 NAT Instance가 아니므로, Source/Dest Check가 활성화되어 있으면 패킷이 폐기됩니다.
>
> **이 설정을 비활성화하지 않으면 NAT가 동작하지 않습니다.** 가장 흔히 빠뜨리는 설정입니다.

### NAT Instance에 IP Forwarding + iptables 설정

48. NAT Instance에 SSH로 접속합니다:

```bash
ssh -i ~/Downloads/my-keypair.pem ec2-user@<NAT-Instance-Public-IP>
```

49. IP 포워딩을 활성화합니다:

```bash
# 즉시 활성화
sudo sysctl -w net.ipv4.ip_forward=1

# 재부팅 후에도 유지되도록 설정 파일에 저장
echo "net.ipv4.ip_forward = 1" | sudo tee /etc/sysctl.d/nat.conf
```

> [!NOTE]
> `ip_forward`는 Linux 커널이 자신에게 온 패킷을 다른 인터페이스로 전달(포워딩)할 수 있게 하는 설정입니다.  
> 기본값은 `0`(비활성화)이며, NAT 기능을 위해 `1`(활성화)로 변경해야 합니다.

50. 네트워크 인터페이스 이름을 확인합니다:

```bash
ip addr show | grep "^[0-9]"
```

> [!OUTPUT]
>
> ```
> 1: lo: <LOOPBACK,UP,LOWER_UP> ...
> 2: enX0: <BROADCAST,MULTICAST,UP,LOWER_UP> ...
> ```
>
> `lo`(루프백)를 제외한 인터페이스 이름을 확인합니다. 보통 `enX0` 또는 `ens5`입니다.

51. iptables NAT 규칙을 추가합니다 (인터페이스 이름을 위에서 확인한 것으로 교체):

```bash
sudo iptables -t nat -A POSTROUTING -o enX0 -s 10.0.0.0/16 -j MASQUERADE
```

> [!NOTE]
> 이 명령의 의미:
>
> - `-t nat`: NAT 테이블에 규칙 추가
> - `-A POSTROUTING`: 패킷이 나가기 직전에 적용
> - `-o enX0`: 출력 인터페이스 (인터넷으로 나가는 인터페이스)
> - `-s 10.0.0.0/16`: 출발지가 VPC 내부(10.0.x.x)인 패킷만 대상
> - `-j MASQUERADE`: 출발지 IP를 NAT Instance의 Public IP로 변환

52. iptables 규칙을 영구 저장합니다 (재부팅 후에도 유지):

```bash
sudo dnf install iptables-services -y
sudo systemctl enable iptables
sudo service iptables save
```

> [!OUTPUT]
>
> ```
> iptables: Saving firewall rules to /etc/sysconfig/iptables: [  OK  ]
> ```

53. 설정이 올바른지 확인합니다:

```bash
# IP 포워딩 확인 (1이면 정상)
cat /proc/sys/net/ipv4/ip_forward

# iptables NAT 규칙 확인
sudo iptables -t nat -L POSTROUTING -v
```

> [!OUTPUT]
>
> ```
> 1
>
> Chain POSTROUTING (policy ACCEPT 0 packets, 0 bytes)
>  pkts bytes target     prot opt in     out     source               destination
>     0     0 MASQUERADE  all  --  any    enX0    10.0.0.0/16          anywhere
> ```

54. NAT Instance에서 나갑니다:

```bash
exit
```

### Private Route Table에 NAT Instance 경로 추가

Private Subnet의 트래픽이 NAT Instance를 통해 인터넷으로 나가도록 Route Table에 경로를 추가합니다.

55. AWS 콘솔 상단 검색창에 `VPC`를 입력하고 **VPC** 서비스를 선택합니다.
56. 왼쪽 메뉴에서 **Route tables**를 선택합니다.
57. Route Table 목록에서 `my-private-rt` (또는 Private Subnet에 연결된 Route Table)를 선택합니다.

> [!TIP]
> 어떤 Route Table이 Private Subnet에 연결되어 있는지 모르겠다면:
>
> 1. 왼쪽 메뉴에서 **Subnets**를 클릭합니다.
> 2. `my-private-subnet-a`를 선택합니다.
> 3. 하단 **Route table** 탭에서 연결된 Route Table ID를 확인합니다.
> 4. 해당 Route Table을 선택합니다.

58. 하단 **Routes** 탭을 선택합니다.
59. [[Edit routes]] 버튼을 클릭합니다.
60. [[Add route]] 버튼을 클릭합니다.
61. 새 경로를 다음과 같이 설정합니다:
    - **Destination**: `0.0.0.0/0`
    - **Target**: 드롭다운에서 `Instance`를 선택 → `my-nat-instance`를 선택합니다.

> [!NOTE]
> `0.0.0.0/0`은 "모든 목적지"를 의미합니다. VPC 내부 트래픽(10.0.0.0/16)은 이미 `local` 경로로 처리되므로, 이 규칙은 VPC 외부(인터넷)로 나가는 트래픽에만 적용됩니다.

62. [[Save changes]] 버튼을 클릭합니다.

> [!OUTPUT]
> Routes 탭에 새 경로가 추가됩니다:
>
> | Destination | Target                       | Status |
> | ----------- | ---------------------------- | ------ |
> | 10.0.0.0/16 | local                        | Active |
> | 0.0.0.0/0   | i-xxxxxxxx (my-nat-instance) | Active |

### NAT Instance 동작 테스트

63. 로컬 터미널에서 Bastion Host에 SSH 접속합니다:

```bash
ssh -i ~/Downloads/my-keypair.pem ec2-user@<Bastion-Public-IP>
```

64. Bastion에서 Private EC2에 접속합니다:

```bash
ssh -i ~/my-keypair.pem ec2-user@<Private-EC2-Private-IP>
```

65. 인터넷 접근을 테스트합니다:

```bash
ping -c 3 google.com
```

> [!OUTPUT]
> 이번에는 응답이 돌아옵니다:
>
> ```
> PING google.com (142.250.xxx.xxx) 56(84) bytes of data.
> 64 bytes from nrt12s51-in-f14.1e100.net: icmp_seq=1 ttl=53 time=3.45 ms
> 64 bytes from nrt12s51-in-f14.1e100.net: icmp_seq=2 ttl=53 time=3.12 ms
> 64 bytes from nrt12s51-in-f14.1e100.net: icmp_seq=3 ttl=53 time=3.28 ms
> ```

66. 패키지 업데이트도 테스트합니다:

```bash
sudo dnf check-update
```

> [!OUTPUT]
> 패키지 목록이 정상적으로 표시됩니다. 인터넷 접근이 가능해졌습니다.

> [!TROUBLESHOOTING]
> **NAT Instance를 통한 인터넷 접근이 안 되는 경우:**
>
> | 증상                                   | 확인 사항                       | 해결 방법                                                                           |
> | -------------------------------------- | ------------------------------- | ----------------------------------------------------------------------------------- |
> | `ping` 타임아웃                        | Source/Dest Check 비활성화 여부 | EC2 콘솔 → my-nat-instance → Actions → Networking → Change source/dest check → Stop |
> | `ping` 타임아웃                        | IP Forwarding 활성화 여부       | NAT Instance에서 `cat /proc/sys/net/ipv4/ip_forward` → `1`이어야 함                 |
> | `ping` 타임아웃                        | iptables 규칙 존재 여부         | NAT Instance에서 `sudo iptables -t nat -L` → MASQUERADE 규칙 확인                   |
> | `ping` 타임아웃                        | Route Table 경로 설정           | VPC 콘솔 → Route Tables → my-private-rt → 0.0.0.0/0 → NAT Instance 확인             |
> | `ping` 타임아웃                        | Security Group                  | NAT Instance의 SG에서 Private Subnet CIDR(10.0.11.0/24)의 All Traffic 허용 확인     |
> | DNS 실패 (`Name or service not known`) | DNS 해석 불가                   | `ping 8.8.8.8`로 IP 직접 테스트. IP는 되는데 도메인이 안 되면 DNS 문제              |

67. Private EC2에서 나갑니다:

```bash
exit
```

68. Bastion에서도 나갑니다:

```bash
exit
```

✅ **태스크 완료**: NAT Instance를 통해 Private EC2에서 인터넷 접근이 가능합니다.

## 태스크 3: NAT Gateway 구성

> [!CONCEPT] NAT Gateway
> NAT Gateway는 AWS 관리형 NAT 서비스입니다. NAT Instance와 동일한 기능을 제공하지만, AWS가 가용성·대역폭·패치를 모두 관리합니다.
>
> **NAT Instance와의 핵심 차이:**
>
> | 항목              | NAT Instance                       | NAT Gateway                    |
> | ----------------- | ---------------------------------- | ------------------------------ |
> | 관리              | 사용자가 직접 (패치, 모니터링)     | AWS 관리형                     |
> | 가용성            | 단일 인스턴스 (장애 시 중단)       | AZ 내 이중화                   |
> | 대역폭            | 인스턴스 타입에 의존               | 최대 100 Gbps                  |
> | Source/Dest Check | 수동 비활성화 필요                 | 해당 없음 (자동 처리)          |
> | 비용              | EC2 비용 (t2.micro 크레딧 내 가능) | 시간당 과금 + 데이터 처리 비용 |
>
> **필요한 것:**
>
> - Elastic IP (고정 공인 IP)
> - Public Subnet에 배치

먼저 NAT Instance 경로를 제거하고, NAT Gateway로 교체합니다.

### Private Route Table에서 NAT Instance 경로 제거

69. AWS 콘솔 → **VPC** 서비스 → 왼쪽 메뉴에서 **Route tables**를 선택합니다.
70. `my-private-rt`를 선택합니다.
71. 하단 **Routes** 탭을 선택합니다.
72. [[Edit routes]] 버튼을 클릭합니다.
73. `0.0.0.0/0` → `i-xxxxxxxx (my-nat-instance)` 경로 옆의 [[Remove]] 버튼(X 아이콘)을 클릭합니다.
74. [[Save changes]] 버튼을 클릭합니다.

> [!NOTE]
> NAT Instance 경로를 제거하면 Private EC2는 다시 인터넷에 접근할 수 없게 됩니다.  
> 이제 NAT Gateway를 생성하여 새 경로를 추가합니다.

### Elastic IP 할당

NAT Gateway에는 고정 공인 IP(Elastic IP)가 필요합니다.

75. VPC 콘솔 왼쪽 메뉴에서 **Elastic IPs**를 선택합니다.
76. [[Allocate Elastic IP address]] 버튼을 클릭합니다.
77. **Elastic IP address settings** 섹션에서:
    - **Network Border Group**: `ap-northeast-2` (기본값 유지)
    - **Public IPv4 address pool**: `Amazon's pool of IPv4 addresses` (기본값 유지)
78. **Tags** 섹션에서 [[Add new tag]]를 클릭합니다:
    - **Key**: `Name`, **Value**: `my-nat-eip`
79. [[Allocate]] 버튼을 클릭합니다.

> [!OUTPUT]
> Elastic IP가 할당됩니다. 할당된 IP 주소(예: `3.35.xxx.xxx`)를 메모합니다.

> [!WARNING]
> Elastic IP는 **사용하지 않는 상태**에서 시간당 $0.005가 과금됩니다.  
> NAT Gateway에 연결하면 과금되지 않지만, NAT Gateway를 삭제한 후 EIP를 해제하지 않으면 비용이 발생합니다.  
> 실습 후 반드시 EIP도 함께 해제하세요.

### NAT Gateway 생성

80. VPC 콘솔 왼쪽 메뉴에서 **NAT gateways**를 선택합니다.
81. [[Create NAT gateway]] 버튼을 클릭합니다.
82. 다음과 같이 설정합니다:
    - **Name**: `my-nat-gateway`
    - **Subnet**: 드롭다운에서 `my-public-subnet-a`를 선택합니다.
    - **Connectivity type**: `Public` (기본값)
    - **Elastic IP allocation ID**: 드롭다운에서 방금 할당한 Elastic IP(`my-nat-eip`)를 선택합니다.

> [!WARNING]
> **Subnet**에 반드시 **Public Subnet**을 선택하세요.  
> NAT Gateway는 인터넷으로 트래픽을 전달해야 하므로 IGW 경로가 있는 Public Subnet에 배치해야 합니다.  
> Private Subnet을 선택하면 NAT Gateway가 인터넷에 접근할 수 없어 동작하지 않습니다.

83. **Tags** 섹션에서 [[Add new tag]]를 클릭합니다:
    - **Key**: `Step`, **Value**: `step3`
84. [[Create NAT gateway]] 버튼을 클릭합니다.

> [!OUTPUT]
> NAT Gateway가 생성됩니다. 상태가 `Pending` → `Available`로 변경될 때까지 약 1~2분 기다립니다.

> [!NOTE]
> NAT Gateway 상태 변화:
>
> - **Pending**: 생성 중 (1~2분 소요)
> - **Available**: 사용 가능 (Route Table에 연결 가능)
> - **Deleting**: 삭제 중
> - **Deleted**: 삭제 완료
> - **Failed**: 생성 실패 (Elastic IP 또는 서브넷 문제)
>
> 상태가 `Available`이 될 때까지 기다린 후 다음 단계를 진행하세요.

### Private Route Table에 NAT Gateway 경로 추가

85. 왼쪽 메뉴에서 **Route tables**를 선택합니다.
86. `my-private-rt`를 선택합니다.
87. 하단 **Routes** 탭을 선택합니다.
88. [[Edit routes]] 버튼을 클릭합니다.
89. [[Add route]] 버튼을 클릭합니다.
90. 새 경로를 다음과 같이 설정합니다:
    - **Destination**: `0.0.0.0/0`
    - **Target**: 드롭다운에서 `NAT Gateway`를 선택 → `my-nat-gateway`를 선택합니다.
91. [[Save changes]] 버튼을 클릭합니다.

> [!OUTPUT]
> Routes 탭에 새 경로가 추가됩니다:
>
> | Destination | Target                        | Status |
> | ----------- | ----------------------------- | ------ |
> | 10.0.0.0/16 | local                         | Active |
> | 0.0.0.0/0   | nat-xxxxxxxx (my-nat-gateway) | Active |

### NAT Gateway 동작 테스트

92. 로컬 터미널에서 Bastion Host에 SSH 접속합니다:

```bash
ssh -i ~/Downloads/my-keypair.pem ec2-user@<Bastion-Public-IP>
```

93. Bastion에서 Private EC2에 접속합니다:

```bash
ssh -i ~/my-keypair.pem ec2-user@<Private-EC2-Private-IP>
```

94. 인터넷 접근을 테스트합니다:

```bash
ping -c 3 google.com
```

> [!OUTPUT]
> NAT Gateway를 통해 인터넷 접근이 가능합니다:
>
> ```
> PING google.com (142.250.xxx.xxx) 56(84) bytes of data.
> 64 bytes from nrt12s51-in-f14.1e100.net: icmp_seq=1 ttl=53 time=2.89 ms
> 64 bytes from nrt12s51-in-f14.1e100.net: icmp_seq=2 ttl=53 time=2.65 ms
> 64 bytes from nrt12s51-in-f14.1e100.net: icmp_seq=3 ttl=53 time=2.71 ms
> ```

95. 패키지 업데이트를 테스트합니다:

```bash
sudo dnf update -y
```

> [!OUTPUT]
> 패키지가 정상적으로 다운로드되고 설치됩니다.

96. Private EC2에서 나갑니다:

```bash
exit
```

97. Bastion에서도 나갑니다:

```bash
exit
```

✅ **태스크 완료**: NAT Gateway를 통해 Private EC2에서 인터넷 접근이 가능합니다.

## 태스크 4: NAT Instance vs NAT Gateway 비교 정리

두 방식을 모두 실습했으므로 차이를 정리합니다.

| 구분                  | NAT Instance                                      | NAT Gateway                          |
| --------------------- | ------------------------------------------------- | ------------------------------------ |
| **관리**              | 사용자가 직접 관리 (OS 패치, 모니터링, 장애 대응) | AWS 완전 관리형                      |
| **가용성**            | 단일 인스턴스 (SPOF — 장애 시 서비스 중단)        | AZ 내 이중화 (자동 Failover)         |
| **대역폭**            | 인스턴스 타입에 의존 (t2.micro: ~1Gbps)           | 최대 100 Gbps (자동 확장)            |
| **비용**              | EC2 비용 (t2.micro 크레딧 내 사용 가능)           | 시간당 ~$0.059 + 데이터 GB당 ~$0.059 |
| **Security Group**    | 적용 가능 (세밀한 제어)                           | 적용 불가 (NACL로만 제어)            |
| **포트 포워딩**       | 가능 (iptables)                                   | 불가                                 |
| **Bastion 겸용**      | 가능 (NAT + SSH 점프 서버)                        | 불가                                 |
| **Source/Dest Check** | 수동 비활성화 필요                                | 해당 없음 (자동 처리)                |
| **설정 복잡도**       | 높음 (IP Forward, iptables, SG, Route Table)      | 낮음 (생성 → Route Table 연결만)     |
| **권장 환경**         | 개발/테스트, 비용 절약, 학습                      | 운영 환경, 고가용성 필요 시          |

> [!TIP]
> **어떤 것을 선택해야 할까?**
>
> - **학습/개발 환경**: NAT Instance (비용 절약, 다양한 설정 학습 가능)
> - **운영 환경**: NAT Gateway (고가용성, 관리 부담 없음)
> - **비용이 가장 중요**: NAT Instance (t2.micro 크레딧 내 사용 가능)
> - **안정성이 가장 중요**: NAT Gateway (AWS SLA 보장)

✅ **태스크 완료**: NAT Instance와 NAT Gateway의 차이를 이해했습니다.

## 마무리

다음을 성공적으로 수행했습니다:

- Private Subnet에서 인터넷 접근이 불가능함을 직접 확인했습니다.
- NAT Instance를 구성하고 Source/Dest Check 비활성화, IP Forwarding, iptables MASQUERADE를 설정했습니다.
- NAT Gateway를 생성하고 Elastic IP를 할당하여 Private Route Table에 연결했습니다.
- 두 방식의 장단점을 비교하고 적합한 사용 사례를 이해했습니다.

---

# 🗑️ 리소스 정리

> [!WARNING]
> **NAT Gateway와 Elastic IP는 사용하지 않아도 시간당 과금됩니다.** 실습이 끝나면 즉시 삭제하세요.
>
> | 리소스              | 방치 시 일일 비용 | 방치 시 월 비용 |
> | ------------------- | ----------------- | --------------- |
> | NAT Gateway         | ~$1.42/일         | ~$42.5/월       |
> | Elastic IP (미사용) | ~$0.12/일         | ~$3.6/월        |
> | EC2 t2.micro × 3대  | ~$1.04/일         | ~$31/월         |

### 삭제 순서 (의존 관계)

> [!NOTE]
> 리소스 간 의존 관계가 있으므로 반드시 아래 순서대로 삭제해야 합니다:
>
> ```
> ① Route Table 경로 제거 → ② NAT Gateway 삭제 (1~2분 대기)
> → ③ Elastic IP 해제 → ④ EC2 인스턴스 종료
> → ⑤ CloudFormation 스택 삭제
> ```

---

### 단계 1: Private Route Table 경로 제거

1. AWS 콘솔 → **VPC** 서비스 → 왼쪽 메뉴에서 **Route tables**를 선택합니다.
2. `my-private-rt`를 선택합니다.
3. 하단 **Routes** 탭을 선택합니다.
4. [[Edit routes]] 버튼을 클릭합니다.
5. `0.0.0.0/0` 경로 옆의 [[Remove]] 버튼(X 아이콘)을 클릭합니다.
6. [[Save changes]] 버튼을 클릭합니다.

---

### 단계 2: NAT Gateway 삭제

7. 왼쪽 메뉴에서 **NAT gateways**를 선택합니다.
8. `my-nat-gateway`를 선택합니다.
9. 상단 **Actions** → **Delete NAT gateway**를 클릭합니다.
10. 확인 입력란에 `delete`를 입력합니다.
11. [[Delete]] 버튼을 클릭합니다.
12. 상태가 `Deleting` → `Deleted`로 변경될 때까지 기다립니다 (약 1~2분).

> [!WARNING]
> NAT Gateway 상태가 `Deleted`로 변경된 것을 **반드시 확인**한 후 다음 단계를 진행하세요.  
> 삭제가 완료되지 않으면 Elastic IP를 해제할 수 없습니다.

---

### 단계 3: Elastic IP 해제

13. 왼쪽 메뉴에서 **Elastic IPs**를 선택합니다.
14. `my-nat-eip`를 선택합니다.
15. 상단 **Actions** → **Release Elastic IP addresses**를 클릭합니다.
16. 확인 팝업에서 [[Release]] 버튼을 클릭합니다.

> [!TROUBLESHOOTING]
> **"Elastic IP address is still associated" 에러:**
>
> NAT Gateway가 아직 삭제 중입니다. NAT Gateways 목록에서 상태가 `Deleted`가 될 때까지 1~2분 더 기다린 후 다시 시도하세요.

---

### 단계 4: EC2 인스턴스 종료

17. 상단 검색창에 `EC2`를 입력하고 **EC2** 서비스를 선택합니다.
18. 왼쪽 메뉴에서 **Instances**를 선택합니다.
19. 다음 3개 인스턴스를 모두 체크합니다:
    - `my-nat-instance`
    - `my-private-ec2`
    - `my-bastion`
20. 상단 **Instance state** → **Terminate instance**를 클릭합니다.
21. 확인 팝업에서 [[Terminate]] 버튼을 클릭합니다.
22. 모든 인스턴스의 상태가 `Shutting down` → `Terminated`로 변경되는 것을 확인합니다.

> [!TIP]
> 여러 인스턴스를 동시에 선택(체크박스 여러 개 클릭)하여 한 번에 종료할 수 있습니다.

---

### 단계 5: CloudFormation 스택 삭제 (태스크 0에서 생성한 경우)

23. 상단 검색창에 `CloudFormation`을 입력하고 선택합니다.
24. **Stacks** 목록에서 `nat-lab-prereq` 스택을 선택합니다.
25. [[Delete]] 버튼을 클릭합니다.
26. 확인 팝업에서 [[Delete stack]]을 클릭합니다.
27. 스택 상태가 `DELETE_IN_PROGRESS` → `DELETE_COMPLETE`가 될 때까지 기다립니다 (약 2~3분).

> [!NOTE]
> CloudFormation 스택을 삭제하면 스택이 생성한 모든 리소스(VPC, Subnet, IGW, Route Table, Security Group)가 자동으로 삭제됩니다.

> [!TROUBLESHOOTING]
> **스택 삭제가 `DELETE_FAILED` 상태인 경우:**
>
> - EC2 인스턴스가 아직 Terminated되지 않은 경우 → 1~2분 대기 후 재시도
> - "has dependencies" 에러 → **Events** 탭에서 실패 원인 확인 → 해당 리소스 수동 삭제 후 재시도

---

### 단계 6: 삭제 확인

28. **EC2 콘솔 → Instances**: 3개 인스턴스가 모두 `Terminated` 상태인지 확인합니다.
29. **VPC 콘솔 → NAT gateways**: `my-nat-gateway`가 `Deleted` 상태인지 확인합니다.
30. **VPC 콘솔 → Elastic IPs**: `my-nat-eip`가 목록에서 사라졌는지 확인합니다.
31. **CloudFormation 콘솔**: `nat-lab-prereq` 스택이 목록에서 사라졌는지 확인합니다.

> [!NOTE]
> Terminated 상태의 인스턴스는 약 1시간 후 콘솔 목록에서 자동으로 사라집니다.

✅ **실습 종료**: 모든 리소스가 정리되었습니다.

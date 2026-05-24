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

이 실습에서는 Private Subnet의 인스턴스가 인터넷에 접근할 수 있도록 NAT(Network Address Translation)를 구성합니다. NAT Instance와 NAT Gateway 두 가지 방식을 모두 실습하고 비교합니다.

> [!WARNING]
> **비용 주의**: NAT Gateway는 크레딧에서 차감되며 비용이 빠르게 소진될 수 있습니다. 실습이 끝나면 반드시 삭제하세요.

> [!NOTE]
> 이 실습은 VPC(Public Subnet + Private Subnet)가 필요합니다. 이미 있다면 그것을 사용합니다. 없다면 아래 CloudFormation으로 생성합니다.

## 태스크 0: 선행 리소스 생성 (CloudFormation)

> [!DOWNLOAD]
> [step3-1-nat-lab.zip](/files/step3/step3-1-nat-lab.zip)
>
> - `nat-lab-prereq.yaml` - AWS CloudFormation 템플릿 (태스크 0에서 VPC, 서브넷, IGW, Route Table, Security Group 자동 생성)

이미 VPC, Public/Private Subnet, IGW가 있다면 이 태스크를 건너뛰고 태스크 1로 이동합니다.

1. AWS Management Console에 로그인합니다.
2. 리전을 **Asia Pacific (Seoul) ap-northeast-2**로 설정합니다.
3. 상단 검색창에 `CloudFormation`을 입력하고 선택합니다.
4. [[Create stack]] → **With new resources (standard)**를 선택합니다.

5. 다운로드한 `nat-lab-prereq.yaml` 파일을 확인합니다.
6. CloudFormation 콘솔에서 [[Create stack]] → **With new resources (standard)**를 선택합니다.
7. **Upload a template file** → 다운로드한 YAML 파일을 업로드합니다.
8. [[Next]] 버튼을 클릭합니다.
9. **Stack name**에 `nat-lab-prereq`를 입력합니다.
10. [[Next]] → [[Next]] → [[Submit]] 버튼을 클릭합니다.
11. 스택 상태가 `CREATE_COMPLETE`가 될 때까지 기다립니다.

✅ **태스크 완료**: 선행 리소스가 생성되었습니다.

## 태스크 1: Private Subnet에서 인터넷이 필요한 이유 이해

> [!CONCEPT] Private Subnet과 인터넷 접근
> Private Subnet의 인스턴스는 Public IP가 없고 IGW로의 경로도 없어 인터넷에 직접 접근할 수 없습니다. 하지만 다음과 같은 경우 인터넷 접근이 필요합니다:
>
> - **패키지 업데이트**: `dnf update`, `apt upgrade`
> - **외부 API 호출**: 결제 API, 알림 서비스 등
> - **소프트웨어 다운로드**: 런타임, 라이브러리 설치
> - **AWS 서비스 접근**: S3, SQS 등 (VPC Endpoint 미사용 시)
>
> NAT를 사용하면 Private 인스턴스가 인터넷으로 **나가는** 트래픽은 허용하면서, 외부에서 **들어오는** 트래픽은 차단할 수 있습니다.

### Private EC2 인스턴스 생성 (테스트용)

10. EC2 콘솔에서 [[Launch instances]] 버튼을 클릭합니다.
11. 다음과 같이 설정합니다:
    - **Name**: `my-private-ec2`
    - **AMI**: `Amazon Linux 2023 AMI`
    - **Instance type**: `t2.micro`
    - **Key pair**: 기존 키 페어 선택
    - **Network settings** → [[Edit]]:
      - **VPC**: `my-vpc`
      - **Subnet**: `my-private-subnet-a`
      - **Auto-assign public IP**: `Disable`
      - **Security group**: `my-private-sg` 선택
12. [[Launch instance]] 버튼을 클릭합니다.

### Bastion Host를 통한 Private EC2 접속

13. Public Subnet에 Bastion Host(점프 서버)를 생성합니다:
    - **Name**: `my-bastion`
    - **AMI**: `Amazon Linux 2023 AMI`
    - **Instance type**: `t2.micro`
    - **Subnet**: `my-public-subnet-a`
    - **Auto-assign public IP**: `Enable`
    - **Security group**: `my-public-sg`
14. [[Launch instance]] 버튼을 클릭합니다.

15. 로컬에서 Bastion Host에 SSH 접속합니다:

```bash
ssh -i ~/Downloads/my-keypair.pem ec2-user@<Bastion-Public-IP>
```

16. Bastion에서 Private EC2에 접속합니다 (키 파일을 먼저 Bastion에 전송해야 함):

```bash
# 로컬에서 키 파일을 Bastion으로 전송
scp -i ~/Downloads/my-keypair.pem ~/Downloads/my-keypair.pem ec2-user@<Bastion-Public-IP>:~/

# Bastion에서 Private EC2로 접속
ssh -i ~/my-keypair.pem ec2-user@<Private-EC2-Private-IP>
```

> [!TIP]
> SSH Agent Forwarding을 사용하면 키 파일을 Bastion에 복사하지 않아도 됩니다:
>
> ```bash
> ssh-add ~/Downloads/my-keypair.pem
> ssh -A -i ~/Downloads/my-keypair.pem ec2-user@<Bastion-Public-IP>
> # Bastion에서 바로 Private EC2 접속 가능
> ssh ec2-user@<Private-EC2-Private-IP>
> ```

17. Private EC2에서 인터넷 접근을 테스트합니다:

```bash
ping -c 3 google.com
```

> [!OUTPUT]
>
> ```
> ping: google.com: Name or service not known
> ```
>
> 또는 타임아웃이 발생합니다. NAT가 없으므로 인터넷에 접근할 수 없습니다.

✅ **태스크 완료**: Private Subnet에서 인터넷 접근이 불가능함을 확인했습니다.

## 태스크 2: NAT Instance 구성

> [!CONCEPT] NAT Instance
> NAT Instance는 일반 EC2 인스턴스에 NAT 기능을 설정한 것입니다. Public Subnet에 배치하고, Private Subnet의 트래픽을 받아 인터넷으로 전달합니다.
>
> 핵심 설정: **Source/Destination Check 비활성화** — EC2는 기본적으로 자신이 Source나 Destination이 아닌 트래픽을 폐기합니다. NAT Instance는 다른 인스턴스의 트래픽을 중계해야 하므로 이 체크를 비활성화해야 합니다.

18. EC2 콘솔에서 [[Launch instances]] 버튼을 클릭합니다.
19. 다음과 같이 설정합니다:
    - **Name**: `my-nat-instance`
    - **AMI**: `Amazon Linux 2023 AMI`
    - **Instance type**: `t2.micro`
    - **Key pair**: 기존 키 페어 선택
    - **Network settings** → [[Edit]]:
      - **VPC**: `my-vpc`
      - **Subnet**: `my-public-subnet-a`
      - **Auto-assign public IP**: `Enable`
      - **Security group**: `my-public-sg`
20. [[Launch instance]] 버튼을 클릭합니다.
21. 인스턴스가 `Running` 상태가 될 때까지 기다립니다.

### Source/Destination Check 비활성화

22. `my-nat-instance`를 선택합니다.
23. **Actions** → **Networking** → **Change source/destination check**를 선택합니다.
24. **Stop** 체크박스를 선택합니다 (Source/destination checking을 중지).
25. [[Save]] 버튼을 클릭합니다.

> [!WARNING]
> Source/Dest Check를 비활성화하지 않으면 NAT Instance가 트래픽을 전달하지 못합니다. 이것은 NAT Instance 구성에서 가장 흔히 빠뜨리는 설정입니다.

### NAT Instance에 iptables 설정

26. NAT Instance에 SSH로 접속합니다:

```bash
ssh -i ~/Downloads/my-keypair.pem ec2-user@<NAT-Instance-Public-IP>
```

27. IP 포워딩을 활성화합니다:

```bash
sudo sysctl -w net.ipv4.ip_forward=1
echo "net.ipv4.ip_forward = 1" | sudo tee /etc/sysctl.d/nat.conf
```

28. iptables NAT 규칙을 추가합니다:

```bash
sudo iptables -t nat -A POSTROUTING -o enX0 -s 10.0.0.0/16 -j MASQUERADE
```

> [!NOTE]
> `enX0`은 네트워크 인터페이스 이름입니다. `ip addr`로 확인하세요. Amazon Linux 2023에서는 보통 `enX0` 또는 `eth0`입니다.

29. iptables 규칙을 영구 저장합니다:

```bash
sudo dnf install iptables-services -y
sudo systemctl enable iptables
sudo service iptables save
```

### Private Route Table에 NAT Instance 경로 추가

30. VPC 콘솔 → **Route tables** → `my-private-rt`를 선택합니다.
31. **Routes** 탭 → [[Edit routes]] 버튼을 클릭합니다.
32. [[Add route]] 버튼을 클릭합니다:
    - **Destination**: `0.0.0.0/0`
    - **Target**: `Instance` → `my-nat-instance` 선택
33. [[Save changes]] 버튼을 클릭합니다.

### NAT Instance 테스트

34. Bastion을 통해 Private EC2에 접속합니다.
35. 인터넷 접근을 테스트합니다:

```bash
ping -c 3 google.com
sudo dnf check-update
```

> [!OUTPUT]
>
> ```
> PING google.com (xxx.xxx.xxx.xxx) 56(84) bytes of data.
> 64 bytes from xxx: icmp_seq=1 ttl=xx time=xx ms
> ```

✅ **태스크 완료**: NAT Instance를 통해 Private EC2에서 인터넷 접근이 가능합니다.

## 태스크 3: NAT Gateway 구성

> [!CONCEPT] NAT Gateway
> NAT Gateway는 AWS 관리형 NAT 서비스입니다. NAT Instance와 달리 AWS가 가용성, 대역폭, 패치를 관리합니다. Elastic IP가 필요하며, Public Subnet에 생성합니다.

먼저 NAT Instance 경로를 제거합니다.

36. VPC 콘솔 → **Route tables** → `my-private-rt`를 선택합니다.
37. **Routes** 탭 → [[Edit routes]] → `0.0.0.0/0` 경로를 삭제합니다.
38. [[Save changes]] 버튼을 클릭합니다.

### Elastic IP 할당

39. VPC 콘솔 → 왼쪽 메뉴에서 **Elastic IPs**를 선택합니다.
40. [[Allocate Elastic IP address]] 버튼을 클릭합니다.
41. 기본 설정을 유지하고 [[Allocate]] 버튼을 클릭합니다.
42. 할당된 Elastic IP를 메모합니다.

### NAT Gateway 생성

43. 왼쪽 메뉴에서 **NAT gateways**를 선택합니다.
44. [[Create NAT gateway]] 버튼을 클릭합니다.
45. 다음과 같이 설정합니다:
    - **Name**: `my-nat-gateway`
    - **Subnet**: `my-public-subnet-a` 선택
    - **Connectivity type**: `Public`
    - **Elastic IP allocation ID**: 방금 할당한 Elastic IP 선택
46. [[Create NAT gateway]] 버튼을 클릭합니다.

> [!NOTE]
> NAT Gateway 생성에 약 1-2분이 소요됩니다. 상태가 `Available`이 될 때까지 기다립니다.

> [!WARNING]
> NAT Gateway는 생성 즉시 과금이 시작됩니다. 실습이 끝나면 반드시 삭제하세요.

### Private Route Table에 NAT Gateway 경로 추가

47. **Route tables** → `my-private-rt`를 선택합니다.
48. **Routes** 탭 → [[Edit routes]] 버튼을 클릭합니다.
49. [[Add route]] 버튼을 클릭합니다:
    - **Destination**: `0.0.0.0/0`
    - **Target**: `NAT Gateway` → `my-nat-gateway` 선택
50. [[Save changes]] 버튼을 클릭합니다.

### NAT Gateway 테스트

51. Bastion을 통해 Private EC2에 접속합니다.
52. 인터넷 접근을 테스트합니다:

```bash
ping -c 3 google.com
sudo dnf update -y
```

> [!OUTPUT]
>
> ```
> PING google.com (xxx.xxx.xxx.xxx) 56(84) bytes of data.
> 64 bytes from xxx: icmp_seq=1 ttl=xx time=xx ms
> ```

✅ **태스크 완료**: NAT Gateway를 통해 Private EC2에서 인터넷 접근이 가능합니다.

## 태스크 4: NAT Instance vs NAT Gateway 비교

| 구분                  | NAT Instance                                     | NAT Gateway               |
| --------------------- | ------------------------------------------------ | ------------------------- |
| **관리**              | 사용자가 직접 관리 (패치, 모니터링)              | AWS 관리형                |
| **가용성**            | 단일 인스턴스 (SPOF)                             | AZ 내 이중화              |
| **대역폭**            | 인스턴스 타입에 의존                             | 최대 100 Gbps             |
| **비용**              | EC2 인스턴스 비용 (t2.micro 크레딧 내 사용 가능) | 시간당 과금 + 데이터 처리 |
| **Security Group**    | 적용 가능                                        | 적용 불가                 |
| **포트 포워딩**       | 가능 (iptables)                                  | 불가                      |
| **Bastion 겸용**      | 가능                                             | 불가                      |
| **Source/Dest Check** | 비활성화 필요                                    | 해당 없음                 |
| **권장 환경**         | 개발/테스트, 비용 절약                           | 운영 환경                 |

> [!TIP]
> **비용 비교 (월 기준, 서울 리전):**
>
> - NAT Instance (t2.micro): 크레딧 내 사용 가능 (저렴)
> - NAT Gateway: 시간당 과금으로 크레딧 소진이 빠름
>
> 학습/개발 환경에서는 NAT Instance가 비용 효율적이고, 운영 환경에서는 NAT Gateway가 안정적입니다.

✅ **태스크 완료**: NAT Instance와 NAT Gateway의 차이를 이해했습니다.

## 마무리

다음을 성공적으로 수행했습니다:

- Private Subnet에서 인터넷 접근이 필요한 이유를 이해했습니다.
- NAT Instance를 구성하고 Source/Dest Check 비활성화, iptables 설정을 완료했습니다.
- NAT Gateway를 생성하고 Private Route Table에 연결했습니다.
- 두 방식의 장단점을 비교했습니다.

# 🗑️ 리소스 정리

> [!WARNING]
> 다음 단계를 **반드시 수행**하여 불필요한 비용을 방지합니다.

---

### 단계 1: Private Route Table 경로 제거

NAT Gateway 또는 NAT Instance로 향하는 경로를 먼저 제거합니다.

1. 상단 검색창에 `VPC`를 입력하고 선택합니다.
2. 왼쪽 메뉴에서 **Route tables**를 클릭합니다.
3. `my-private-rt`를 선택합니다.
4. **Routes** 탭을 클릭합니다.
5. [[Edit routes]] 버튼을 클릭합니다.
6. `0.0.0.0/0` 경로의 [[Remove]] 버튼(X)을 클릭합니다.
7. [[Save changes]] 버튼을 클릭합니다.

> [!NOTE]
> 경로를 먼저 제거해야 NAT Gateway와 NAT Instance를 정상적으로 삭제할 수 있습니다.

---

### 단계 2: NAT Gateway 삭제

NAT Gateway는 사용하지 않아도 시간당 과금되므로 즉시 삭제합니다.

1. VPC 콘솔 왼쪽 메뉴에서 **NAT gateways**를 클릭합니다.
2. `my-nat-gateway`를 선택합니다.
3. **Actions** → **Delete NAT gateway**를 클릭합니다.
4. 확인 입력란에 `delete`를 입력합니다.
5. [[Delete]]를 클릭합니다.
6. 상태가 `Deleting` → `Deleted`로 변경될 때까지 기다립니다 (약 1-2분).

> [!WARNING]
> NAT Gateway 상태가 `Deleted`로 변경된 것을 반드시 확인한 후 다음 단계를 진행하세요. 삭제가 완료되지 않으면 Elastic IP를 해제할 수 없습니다.

---

### 단계 3: Elastic IP 해제

NAT Gateway에 할당했던 Elastic IP를 해제합니다.

1. VPC 콘솔 왼쪽 메뉴에서 **Elastic IPs**를 클릭합니다.
2. NAT Gateway에 할당했던 Elastic IP를 선택합니다.
3. **Actions** → **Release Elastic IP addresses**를 클릭합니다.
4. 확인 팝업에서 [[Release]]를 클릭합니다.

> [!WARNING]
> Elastic IP를 해제하지 않으면 사용하지 않는 상태에서도 시간당 $0.005가 과금됩니다. 반드시 해제하세요.

---

### 단계 4: EC2 인스턴스 종료

이 실습에서 생성한 모든 EC2 인스턴스를 종료합니다.

1. 상단 검색창에 `EC2`를 입력하고 선택합니다.
2. 왼쪽 메뉴에서 **Instances**를 클릭합니다.
3. 다음 인스턴스를 모두 체크합니다:
   - `my-nat-instance`
   - `my-private-ec2`
   - `my-bastion`
4. 상단 **Instance state** → **Terminate instance**를 클릭합니다.
5. 확인 팝업에서 [[Terminate]]를 클릭합니다.
6. 모든 인스턴스의 상태가 `Shutting down` → `Terminated`로 변경되는 것을 확인합니다.

> [!NOTE]
> 여러 인스턴스를 동시에 선택하여 한 번에 종료할 수 있습니다.

---

### 단계 5: CloudFormation 스택 삭제

태스크 0에서 CloudFormation으로 선행 리소스를 생성한 경우 스택을 삭제합니다.

1. 상단 검색창에 `CloudFormation`을 입력하고 선택합니다.
2. **Stacks** 목록에서 `nat-lab-prereq` 스택을 선택합니다.
3. [[Delete]] 버튼을 클릭합니다.
4. 확인 팝업에서 [[Delete stack]]을 클릭합니다.
5. 스택 상태가 `DELETE_IN_PROGRESS` → `DELETE_COMPLETE`가 될 때까지 기다립니다 (약 2-3분).

> [!NOTE]
> CloudFormation 스택을 삭제하면 스택이 생성한 모든 리소스(VPC, Subnet, IGW, Route Table, Security Group)가 자동으로 삭제됩니다.

---

### 단계 6: 삭제 확인

모든 리소스가 정상적으로 삭제되었는지 확인합니다.

1. EC2 콘솔에서 `my-nat-instance`, `my-private-ec2`, `my-bastion` 인스턴스가 모두 `Terminated` 상태인지 확인합니다.
2. VPC 콘솔 → **NAT gateways**에서 `my-nat-gateway`가 `Deleted` 상태인지 확인합니다.
3. VPC 콘솔 → **Elastic IPs**에서 할당한 IP가 목록에서 사라졌는지 확인합니다.
4. CloudFormation 콘솔에서 `nat-lab-prereq` 스택이 목록에서 사라졌는지 확인합니다.

> [!NOTE]
> 삭제 직후에는 일부 리소스가 잠시 남아있을 수 있으나, 시간이 지나면 자동으로 사라집니다.

✅ **실습 종료**: 모든 리소스가 정리되었습니다.

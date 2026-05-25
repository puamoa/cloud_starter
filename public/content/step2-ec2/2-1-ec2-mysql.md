---
title: 'Amazon EC2에 MySQL 8.0 직접 설치 및 설정'
week: 2
session: 1
awsServices:
  - Amazon EC2
  - Amazon VPC
learningObjectives:
  - EC2 인스턴스를 생성하고 SSH로 접속할 수 있습니다.
  - Amazon Linux 2023에 MySQL 8.0을 설치할 수 있습니다.
  - MySQL 보안 초기화 및 사용자/데이터베이스를 생성할 수 있습니다.
  - 외부 접속을 위한 MySQL 설정을 구성할 수 있습니다.
prerequisites:
  - AWS 계정 생성 완료
  - SSH 키 페어 보유 (또는 실습 중 생성)
  - VPC 및 Security Group 생성 완료 (또는 CloudFormation으로 생성)
estimatedCost: 크레딧 내 사용 가능 (비용 발생 가능)
---

이 실습에서는 EC2 인스턴스를 생성하고, SSH로 접속하여 MySQL 8.0을 직접 설치합니다. 데이터베이스와 사용자를 생성하고, 외부에서 접속할 수 있도록 설정합니다.

> [!NOTE]
> 이 실습은 VPC, Public Subnet, Internet Gateway, Security Group이 필요합니다. 이미 있다면 그것을 사용합니다. 없다면 태스크 0의 CloudFormation으로 한 번에 생성합니다.

## 태스크 0: 선행 리소스 생성 (CloudFormation)

> [!DOWNLOAD]
> [step2-1-ec2-lab.zip](/files/step2/step2-1-ec2-lab.zip)
>
> - `step2-1-ec2-prereq.yaml` - AWS CloudFormation 템플릿 (태스크 0에서 VPC, 서브넷, IGW, Security Group 자동 생성)

이미 VPC, Public Subnet, IGW, Security Group이 있다면 이 태스크를 건너뛰고 태스크 1로 이동합니다.

1. AWS Management Console에 로그인합니다.
2. 리전을 **Asia Pacific (Seoul) ap-northeast-2**로 설정합니다.
3. 상단 검색창에 `CloudFormation`을 입력하고 선택합니다.
4. [[Create stack]] → **With new resources (standard)**를 선택합니다.
5. **Specify template** 섹션에서 `Upload a template file`을 선택합니다.

   > - 태스크 0: 실습 환경 구축 (step2-1-ec2-prereq.yaml 사용)

6. 다운로드한 `step2-1-ec2-prereq.yaml` 파일을 확인합니다.
7. CloudFormation 콘솔에서 [[Create stack]] → **With new resources (standard)**를 선택합니다.
8. **Upload a template file** → 다운로드한 YAML 파일을 업로드합니다.
9. [[Next]] 버튼을 클릭합니다.
10. **Stack name**에 `ec2-lab-prereq`를 입력합니다.
11. [[Next]] → [[Next]] → [[Submit]] 버튼을 클릭합니다.
12. 스택 상태가 `CREATE_COMPLETE`가 될 때까지 기다립니다 (약 1-2분).

> [!NOTE]
> CloudFormation 스택이 완료되면 **Outputs** 탭에서 VPC ID, Subnet ID, Security Group ID를 확인할 수 있습니다.

✅ **태스크 완료**: 선행 리소스가 CloudFormation으로 생성되었습니다.

## 태스크 1: EC2 인스턴스 생성

11. 상단 검색창에 `EC2`를 입력하고 EC2 서비스를 선택합니다.
12. 왼쪽 메뉴에서 **Instances**를 선택합니다.
13. [[Launch instances]] 버튼을 클릭합니다.
14. 다음과 같이 설정합니다:

**Name and tags:**

- **Name**: `my-ec2-mysql`

**Application and OS Images (Amazon Machine Image):**

- **AMI**: `Amazon Linux 2023 AMI` (Free tier eligible 표시 확인)
- **Architecture**: `64-bit (x86)`

> [!NOTE]
> AWS 콘솔에서 "Free tier eligible" 표시가 여전히 나타납니다. 새 체계(2025.07.15 이후 가입)에서는 크레딧에서 차감됩니다.

15. **Instance type**에서 `t2.micro`를 선택합니다 (Free tier eligible).

> [!WARNING]
> 반드시 `t2.micro`를 선택하세요. 다른 인스턴스 타입은 비용이 높아 크레딧이 빠르게 소진됩니다.

16. **Key pair (login)** 섹션에서:
    - 기존 키 페어가 있으면 선택합니다.
    - 없으면 [[Create new key pair]] 클릭:
      - **Key pair name**: `my-keypair`
      - **Key pair type**: `RSA`
      - **Private key file format**: `.pem` (Mac/Linux) 또는 `.ppk` (Windows PuTTY)
      - [[Create key pair]] 클릭 → 파일이 자동 다운로드됩니다.

> [!WARNING]
> 키 페어 파일(.pem)은 **한 번만 다운로드** 가능합니다. 분실하면 인스턴스에 SSH 접속할 수 없습니다. 안전한 곳에 보관하세요.

17. **Network settings** 섹션에서 [[Edit]] 버튼을 클릭합니다:
    - **VPC**: `my-vpc` 선택
    - **Subnet**: `my-public-subnet-a` 선택
    - **Auto-assign public IP**: `Enable`
    - **Firewall (security groups)**: `Select existing security group` 선택
    - **Common security groups**: `my-ec2-sg` 선택

18. **Configure storage**는 기본값(8 GiB gp3)을 유지합니다.
19. [[Launch instance]] 버튼을 클릭합니다.
20. 인스턴스 상태가 `Running`이 될 때까지 기다립니다 (약 1-2분).

> [!OUTPUT]
> 인스턴스가 생성되면 Instance ID, Public IPv4 address가 할당됩니다. Public IP를 메모해 두세요.

✅ **태스크 완료**: EC2 인스턴스가 생성되었습니다.

## 태스크 2: SSH 접속

21. 인스턴스 목록에서 `my-ec2-mysql`을 선택합니다.
22. **Public IPv4 address**를 복사합니다.
23. 터미널(Mac/Linux) 또는 PowerShell(Windows)에서 SSH 접속합니다:

```bash
# 키 파일 권한 설정 (Mac/Linux)
chmod 400 ~/Downloads/my-keypair.pem

# SSH 접속
ssh -i ~/Downloads/my-keypair.pem ec2-user@<Public-IP>
```

> [!TIP]
> Windows에서 PuTTY를 사용하는 경우:
>
> 1. PuTTYgen으로 .pem → .ppk 변환
> 2. PuTTY에서 Host Name에 `ec2-user@<Public-IP>` 입력
> 3. Connection → SSH → Auth → Private key file에 .ppk 파일 지정

24. `Are you sure you want to continue connecting?` 메시지가 나오면 `yes`를 입력합니다.

> [!OUTPUT]
> 접속 성공 시 다음과 같은 프롬프트가 표시됩니다:
>
> ```
>    ,     #_
>    ~\_  ####_        Amazon Linux 2023
>   ~~  \_#####\
>   ~~     \###|
>   ~~       \#/ ___   https://aws.amazon.com/linux/amazon-linux-2023
>    ~~       V~' '->
>     ~~~         /
>       ~~._.   _/
>          _/ _/
>        _/m/'
> [ec2-user@ip-10-0-1-xxx ~]$
> ```

✅ **태스크 완료**: EC2 인스턴스에 SSH 접속했습니다.

## 태스크 3: MySQL 8.0 설치

25. 시스템 패키지를 업데이트합니다:

```bash
sudo dnf update -y
```

26. MySQL 8.0 Community Server를 설치합니다:

```bash
sudo dnf install mysql80-community-server -y
```

> [!NOTE]
> Amazon Linux 2023은 `dnf` 패키지 매니저를 사용합니다 (Amazon Linux 2의 `yum`과 호환). MySQL 8.0은 기본 리포지토리에 포함되어 있습니다.

27. MySQL 서비스를 시작합니다:

```bash
sudo systemctl start mysqld
```

28. MySQL 서비스를 부팅 시 자동 시작하도록 설정합니다:

```bash
sudo systemctl enable mysqld
```

29. MySQL 서비스 상태를 확인합니다:

```bash
sudo systemctl status mysqld
```

> [!OUTPUT]
>
> ```
> ● mysqld.service - MySQL Community Server
>      Loaded: loaded (/usr/lib/systemd/system/mysqld.service; enabled)
>      Active: active (running)
> ```

✅ **태스크 완료**: MySQL 8.0이 설치되고 실행 중입니다.

## 태스크 4: MySQL 보안 초기화

30. MySQL 임시 비밀번호를 확인합니다:

```bash
sudo grep 'temporary password' /var/log/mysqld.log
```

> [!OUTPUT]
>
> ```
> A temporary password is generated for root@localhost: AbCd1234!xyz
> ```

31. MySQL 보안 초기화 스크립트를 실행합니다:

```bash
sudo mysql_secure_installation
```

32. 프롬프트에 따라 설정합니다:

```
Enter password for user root: (임시 비밀번호 입력)

New password: (새 비밀번호 입력, 예: MyPass123!)
Re-enter new password: (새 비밀번호 재입력)

Change the password for root? : y
Remove anonymous users? : y
Disallow root login remotely? : y
Remove test database and access to it? : y
Reload privilege tables now? : y
```

> [!WARNING]
> MySQL 8.0의 비밀번호 정책은 기본적으로 `MEDIUM`입니다. 최소 8자, 대문자, 소문자, 숫자, 특수문자를 포함해야 합니다.

33. 새 비밀번호로 MySQL에 접속합니다:

```bash
mysql -u root -p
```

> [!OUTPUT]
>
> ```
> Welcome to the MySQL monitor.  Commands end with ; or \g.
> mysql>
> ```

✅ **태스크 완료**: MySQL 보안 초기화가 완료되었습니다.

## 태스크 5: 데이터베이스 및 사용자 생성

34. 애플리케이션용 데이터베이스를 생성합니다:

```sql
CREATE DATABASE appdb DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

35. 애플리케이션용 사용자를 생성합니다:

```sql
CREATE USER 'appuser'@'%' IDENTIFIED BY 'AppUser123!';
```

> [!NOTE]
> `'appuser'@'%'`에서 `%`는 모든 호스트에서의 접속을 허용합니다. 보안을 강화하려면 `'appuser'@'10.0.%'`처럼 VPC CIDR 범위로 제한할 수 있습니다.

36. 사용자에게 데이터베이스 권한을 부여합니다:

```sql
GRANT ALL PRIVILEGES ON appdb.* TO 'appuser'@'%';
FLUSH PRIVILEGES;
```

37. 생성된 데이터베이스와 사용자를 확인합니다:

```sql
SHOW DATABASES;
SELECT user, host FROM mysql.user WHERE user = 'appuser';
```

> [!OUTPUT]
>
> ```
> +--------------------+
> | Database           |
> +--------------------+
> | appdb              |
> | information_schema |
> | mysql              |
> | performance_schema |
> | sys                |
> +--------------------+
>
> +---------+------+
> | user    | host |
> +---------+------+
> | appuser | %    |
> +---------+------+
> ```

38. MySQL을 종료합니다:

```sql
EXIT;
```

✅ **태스크 완료**: 데이터베이스와 사용자가 생성되었습니다.

## 태스크 6: 외부 접속 설정

EC2 외부(로컬 PC 또는 다른 EC2)에서 MySQL에 접속할 수 있도록 설정합니다.

39. MySQL 설정 파일을 편집합니다:

```bash
sudo vi /etc/my.cnf
```

40. `[mysqld]` 섹션에 다음을 추가합니다:

```ini
[mysqld]
bind-address = 0.0.0.0
```

> [!NOTE]
> `bind-address = 0.0.0.0`은 모든 네트워크 인터페이스에서 접속을 허용합니다. 기본값은 `127.0.0.1`(localhost만 허용)입니다.

41. MySQL을 재시작합니다:

```bash
sudo systemctl restart mysqld
```

42. MySQL이 모든 인터페이스에서 리스닝하는지 확인합니다:

```bash
sudo ss -tlnp | grep 3306
```

> [!OUTPUT]
>
> ```
> LISTEN  0  151  0.0.0.0:3306  0.0.0.0:*  users:(("mysqld",pid=xxxx,fd=xx))
> ```

43. 로컬 PC에서 MySQL 접속을 테스트합니다 (MySQL Client 설치 필요):

```bash
mysql -h <EC2-Public-IP> -u appuser -p appdb
```

> [!TIP]
> 접속이 안 되면 다음을 확인하세요:
>
> 1. Security Group에 3306 포트가 열려 있는지
> 2. `bind-address`가 `0.0.0.0`으로 설정되었는지
> 3. MySQL 서비스가 실행 중인지 (`sudo systemctl status mysqld`)

✅ **태스크 완료**: 외부에서 MySQL 접속이 가능하도록 설정되었습니다.

## 마무리

다음을 성공적으로 수행했습니다:

- EC2 인스턴스(Amazon Linux 2023, t2.micro)를 생성하고 SSH로 접속했습니다.
- MySQL 8.0을 설치하고 보안 초기화를 완료했습니다.
- 애플리케이션용 데이터베이스(`appdb`)와 사용자(`appuser`)를 생성했습니다.
- 외부 접속을 위한 bind-address 설정을 완료했습니다.

# 🗑️ 리소스 정리

> [!WARNING]
> 다음 단계를 **반드시 수행**하여 불필요한 비용을 방지합니다.

---

### 단계 1: EC2 인스턴스 중지 또는 종료

실습이 끝난 후 EC2 인스턴스를 중지(Stop)하거나 종료(Terminate)합니다.

**나중에 다시 사용할 경우 (Stop):**

1. AWS Management Console에서 상단 검색창에 `EC2`를 입력하고 선택합니다.
2. 왼쪽 메뉴에서 **Instances**를 클릭합니다.
3. `my-ec2-mysql` 인스턴스를 체크합니다.
4. 상단 **Instance state** → **Stop instance**를 클릭합니다.
5. 확인 팝업에서 [[Stop]]을 클릭합니다.
6. Instance state가 `Stopped`으로 변경되는 것을 확인합니다.

> [!NOTE]
> Stop된 인스턴스는 EC2 요금이 발생하지 않지만, 연결된 EBS 볼륨(8 GiB)은 계속 크레딧에서 차감됩니다. EBS 비용은 매우 저렴하므로 크게 걱정하지 않아도 됩니다.

**완전히 삭제할 경우 (Terminate):**

1. EC2 콘솔 → **Instances**에서 `my-ec2-mysql` 인스턴스를 체크합니다.
2. 상단 **Instance state** → **Terminate instance**를 클릭합니다.
3. 확인 팝업에서 [[Terminate]]를 클릭합니다.
4. Instance state가 `Shutting down` → `Terminated`로 변경되는 것을 확인합니다.

> [!WARNING]
> Terminate하면 인스턴스와 연결된 EBS 볼륨이 함께 삭제됩니다. MySQL 데이터도 모두 삭제되므로 필요한 데이터는 미리 백업하세요.

---

### 단계 2: CloudFormation 스택 삭제

태스크 0에서 CloudFormation으로 선행 리소스를 생성한 경우 스택을 삭제합니다.

1. 상단 검색창에 `CloudFormation`을 입력하고 선택합니다.
2. **Stacks** 목록에서 `ec2-lab-prereq` 스택을 선택합니다.
3. [[Delete]] 버튼을 클릭합니다.
4. 확인 팝업에서 [[Delete stack]]을 클릭합니다.
5. 스택 상태가 `DELETE_IN_PROGRESS` → `DELETE_COMPLETE`가 될 때까지 기다립니다 (약 2-3분).

> [!NOTE]
> CloudFormation 스택을 삭제하면 스택이 생성한 모든 리소스(VPC, Subnet, IGW, Security Group)가 자동으로 삭제됩니다.

---

### 단계 3: 삭제 확인

모든 리소스가 정상적으로 삭제되었는지 확인합니다.

1. EC2 콘솔에서 `my-ec2-mysql` 인스턴스가 `Terminated` 상태인지 확인합니다.
2. CloudFormation 콘솔에서 `ec2-lab-prereq` 스택이 목록에서 사라졌는지 확인합니다.
3. VPC 콘솔에서 `my-vpc`가 삭제되었는지 확인합니다.

> [!NOTE]
> 삭제 직후에는 일부 리소스가 잠시 남아있을 수 있으나, 시간이 지나면 자동으로 사라집니다.

✅ **실습 종료**: 모든 리소스가 정리되었습니다.

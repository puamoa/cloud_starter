---
title: '전체 연동 확인 및 리소스 정리'
week: 9
session: 4
awsServices:
  - Amazon Route 53
  - AWS Certificate Manager
learningObjectives:
  - 프론트엔드↔백엔드↔DB 전체 연동을 확인할 수 있습니다.
  - 도메인과 HTTPS를 최종 적용할 수 있습니다.
  - 전체 AWS 리소스를 체계적으로 정리할 수 있습니다.
prerequisites:
  - Step 9-1, 9-2, 9-3 완료
estimatedCost: 무료 (정리 작업)
---

이 실습에서는 Step 9-1~9-3에서 구축한 3-Tier 아키텍처의 전체 연동을 확인하고,
선택적으로 도메인과 HTTPS를 적용합니다. 마지막으로 Step 0~9에서 생성한
모든 AWS 리소스를 체계적으로 정리합니다.

> [!NOTE]
> 이 세션은 두 부분으로 구성됩니다:
>
> - **태스크 1~3**: 전체 연동 확인 + 도메인 설정 (선택)
> - **태스크 4**: 전체 리소스 정리 (18단계 상세 가이드)

---

## 태스크 1: 전체 연동 테스트

### 1-1. 아키텍처 연동 흐름 확인

```
사용자 브라우저
    ↓ HTTPS
CloudFront (d1234abcdef.cloudfront.net)
    ↓ HTTP
S3 (Vue.js 정적 파일)
    ↓ API 호출 (Axios)
ALB (my-3tier-app-alb-xxx.elb.amazonaws.com)
    ↓ HTTP:8080
EC2 (Spring Boot)
    ↓ JDBC:3306
RDS MySQL (Private Subnet)
```

### 1-2. 프론트엔드 → 백엔드 연동 확인

1. 브라우저에서 CloudFront URL에 접속합니다:

```
https://d1234abcdef.cloudfront.net
```

2. 메인 페이지에서 **서비스 상태**가 "✅ 정상"으로 표시되는지 확인합니다.
3. **📋 아이템 관리** 페이지로 이동합니다.
4. 아이템을 추가합니다:
   - 이름: `테스트 아이템`
   - 설명: `3-Tier 연동 테스트`
5. 아이템이 목록에 표시되는지 확인합니다.

### 1-3. 데이터베이스 저장 확인

6. EC2에 SSH 접속하여 RDS에서 데이터를 확인합니다:

```bash
mysql -h RDS_ENDPOINT -u admin -p

USE myapp;
SELECT * FROM items;
```

예상 결과:

```
+----+------------------+----------------------+---------------------+
| id | name             | description          | created_at          |
+----+------------------+----------------------+---------------------+
|  1 | 테스트 아이템     | 3-Tier 연동 테스트    | 2024-01-15 10:30:00 |
+----+------------------+----------------------+---------------------+
```

### 1-4. 브라우저 개발자 도구로 확인

7. 브라우저에서 F12 → **Network** 탭을 엽니다.
8. 아이템 추가/조회 시 API 호출을 확인합니다:
   - Request URL: `http://ALB_DNS/api/items`
   - Status: `200` 또는 `201`
   - Response: JSON 데이터

> [!TIP]
> CORS 에러가 발생하면 Step 9-3의 태스크 4를 다시 확인하세요.
> CloudFront 도메인이 `allowed-origins`에 정확히 포함되어야 합니다.
> 프로토콜(https://)까지 정확히 일치해야 합니다.

### 1-5. 연동 체크리스트

| 확인 항목           | 예상 결과                     | 상태 |
| ------------------- | ----------------------------- | ---- |
| CloudFront URL 접속 | Vue.js 앱 로드                | ☐    |
| API Health Check    | "✅ 정상" 표시                | ☐    |
| 아이템 생성         | 목록에 추가됨                 | ☐    |
| 아이템 삭제         | 목록에서 제거됨               | ☐    |
| RDS 데이터 확인     | items 테이블에 데이터 존재    | ☐    |
| SPA 라우팅          | /items 직접 접속 시 정상 로드 | ☐    |

✅ **태스크 완료** — 프론트엔드↔백엔드↔DB 전체 연동을 확인했습니다.

---

## 태스크 2: 도메인 연결 (선택)

> [!NOTE]
> 이 태스크는 도메인을 보유한 경우에만 진행합니다.
> 도메인이 없어도 CloudFront URL과 ALB DNS로 서비스를 사용할 수 있습니다.

### 2-1. ACM 인증서 발급 (CloudFront용 - us-east-1)

CloudFront에 사용할 인증서는 반드시 **us-east-1 (버지니아)** 리전에서 발급해야 합니다.

1. AWS Console → 리전을 **US East (N. Virginia)** 로 변경합니다.
2. **Certificate Manager** → [[Request a certificate]]
3. **Domain names**: `yourdomain.com`, `*.yourdomain.com`
4. **Validation method**: DNS validation
5. [[Request]] → DNS 검증 레코드를 Route 53에 추가합니다.
6. [[Create records in Route 53]]을 클릭합니다.
7. 인증서 Status가 `Issued`가 될 때까지 대기합니다 (약 5~30분).

### 2-2. ACM 인증서 발급 (ALB용 - ap-northeast-2)

ALB에 사용할 인증서는 ALB가 있는 리전에서 발급합니다.

8. AWS Console → 리전을 **Asia Pacific (Seoul)** 로 변경합니다.
9. **Certificate Manager** → [[Request a certificate]]
10. **Domain names**: `api.yourdomain.com`
11. 같은 방식으로 DNS 검증을 완료합니다.

### 2-3. CloudFront에 도메인 연결

12. **CloudFront** → 배포 선택 → [[Edit]]
13. **Alternate domain name (CNAME)**: `yourdomain.com`
14. **Custom SSL certificate**: us-east-1에서 발급한 인증서 선택
15. [[Save changes]]

### 2-4. ALB에 HTTPS 리스너 추가

16. **EC2** → **Load Balancers** → `my-3tier-app-alb`
17. **Listeners** 탭 → [[Add listener]]
18. **Protocol**: HTTPS, **Port**: 443
19. **Default SSL/TLS certificate**: ap-northeast-2에서 발급한 인증서 선택
20. **Default action**: Forward to `my-3tier-app-tg`
21. [[Add]]

### 2-5. Route 53 레코드 생성

22. **Route 53** → **Hosted zones** → 도메인 선택
23. [[Create record]]:
    - **Record name**: (비워두기 = 루트 도메인)
    - **Record type**: A
    - **Alias**: Yes → CloudFront distribution 선택
24. [[Create record]]:
    - **Record name**: `api`
    - **Record type**: A
    - **Alias**: Yes → ALB 선택

### 2-6. 프론트엔드 API URL 업데이트

도메인을 연결했다면 프론트엔드의 API URL을 업데이트합니다:

```bash
# .env.production 수정
VITE_API_URL=https://api.yourdomain.com/api
```

```bash
# 재배포
git add .
git commit -m "feat: update API URL to custom domain"
git push origin main
```

✅ **태스크 완료** — 도메인과 HTTPS를 적용했습니다 (선택 사항).

---

## 태스크 3: 최종 아키텍처 확인

### 완성된 3-Tier 아키텍처

```
┌─────────────────────────────────────────────────────────────────────┐
│                         인터넷                                       │
└───────────┬─────────────────────────────────┬───────────────────────┘
            │                                 │
            ▼                                 ▼
┌───────────────────────┐       ┌─────────────────────────────────────┐
│  CloudFront (CDN)     │       │  ALB (HTTPS 종료)                    │
│  - HTTPS 자동 적용     │       │  - Health Check                     │
│  - 전 세계 엣지 캐싱   │       │  - 트래픽 분산                       │
│  - SPA 라우팅 지원     │       │  - Public Subnet                    │
└───────────┬───────────┘       └───────────────┬─────────────────────┘
            │                                   │
            ▼                                   ▼
┌───────────────────────┐       ┌─────────────────────────────────────┐
│  S3 Bucket            │       │  EC2 (Spring Boot)                   │
│  - Vue.js 빌드 파일    │       │  - REST API                         │
│  - 정적 웹 호스팅      │       │  - SSM에서 비밀값 로드               │
│  - GitHub Actions 배포 │       │  - GitHub Actions 배포               │
└───────────────────────┘       └───────────────┬─────────────────────┘
                                                │
                                                ▼
                                ┌─────────────────────────────────────┐
                                │  RDS MySQL (Private Subnet)          │
                                │  - 외부 접근 차단                     │
                                │  - EC2에서만 접근 가능                │
                                │  - 자동 백업                         │
                                └─────────────────────────────────────┘
```

### 구성 요소 정리

| 구성 요소    | AWS 서비스          | 역할                 | 배포 방식                      |
| ------------ | ------------------- | -------------------- | ------------------------------ |
| 프론트엔드   | S3 + CloudFront     | Vue.js SPA 호스팅    | GitHub Actions → S3 sync       |
| API 서버     | EC2 + ALB           | Spring Boot REST API | GitHub Actions → SCP → systemd |
| 데이터베이스 | RDS MySQL           | 데이터 영구 저장     | CloudFormation                 |
| 네트워크     | VPC + Subnets       | 네트워크 격리        | CloudFormation                 |
| 보안         | Security Groups     | 접근 제어            | CloudFormation                 |
| 비밀 관리    | SSM Parameter Store | DB 비밀번호 등       | AWS CLI                        |
| CI/CD        | GitHub Actions      | 자동 빌드/배포       | YAML 워크플로우                |

> [!CONCEPT] Step 0~8에서 배운 것의 통합
>
> | Step   | 배운 내용           | Step 9에서의 활용    |
> | ------ | ------------------- | -------------------- |
> | Step 0 | AWS 계정, IAM       | IAM User/Role 생성   |
> | Step 1 | VPC, Subnet, SG     | 3-Tier 네트워크 설계 |
> | Step 2 | EC2                 | Spring Boot 서버     |
> | Step 3 | S3                  | 프론트엔드 호스팅    |
> | Step 4 | RDS                 | MySQL 데이터베이스   |
> | Step 5 | CloudFront          | CDN + HTTPS          |
> | Step 6 | SSM Parameter Store | 비밀값 관리          |
> | Step 7 | ALB, Route 53       | 로드 밸런싱, 도메인  |
> | Step 8 | GitHub Actions      | CI/CD 자동 배포      |

✅ **태스크 완료** — 완성된 3-Tier 아키텍처를 확인했습니다.

---

## 태스크 4: 전체 리소스 정리

Step 0~9에서 생성한 모든 AWS 리소스를 체계적으로 정리합니다.
**비용이 발생하는 리소스부터 우선 삭제합니다.**

> [!WARNING]
> 리소스 정리 순서가 중요합니다!
> 의존 관계가 있는 리소스는 순서를 지키지 않으면 삭제가 실패합니다.
> 아래 18단계를 순서대로 진행하세요.

---

### 단계 1: Auto Scaling Group 삭제 (해당 시)

Auto Scaling Group이 있다면 먼저 삭제합니다 (EC2 인스턴스가 자동 생성되는 것을 방지).

1. AWS Console → **EC2** → **Auto Scaling Groups**
2. 해당 ASG 선택 → [[Delete]]
3. 확인 입력 후 삭제

---

### 단계 2: ALB (Application Load Balancer) 삭제

4. **EC2** → **Load Balancers**
5. `my-3tier-app-alb` 선택 → **Actions** → [[Delete load balancer]]
6. 확인 입력 후 삭제

7. **Target Groups**에서 `my-3tier-app-tg` 선택 → **Actions** → [[Delete]]

> [!NOTE]
> ALB를 삭제하면 즉시 비용 발생이 중단됩니다 (~$0.0225/시간).

---

### 단계 3: NAT Gateway 삭제

NAT Gateway는 시간당 비용이 발생하므로 빠르게 삭제합니다.

8. **VPC** → **NAT Gateways**
9. `my-3tier-app-nat-gw` 선택 → **Actions** → [[Delete NAT gateway]]
10. 확인 입력 후 삭제 (삭제에 1~2분 소요)

---

### 단계 4: Elastic IP 해제

NAT Gateway에 연결된 EIP를 해제합니다.

11. **VPC** → **Elastic IPs**
12. `my-3tier-app-nat-eip` 선택 → **Actions** → [[Release Elastic IP addresses]]
13. [[Release]]

> [!WARNING]
> 사용하지 않는 Elastic IP는 시간당 비용이 발생합니다.
> 반드시 해제하세요.

---

### 단계 5: RDS 인스턴스 삭제

14. **RDS** → **Databases**
15. `my-3tier-app-db` 선택 → **Actions** → [[Delete]]
16. 설정:
    - ❌ Create final snapshot: 체크 해제
    - ✅ I acknowledge that upon instance deletion...
    - 확인 입력: `delete me`
17. [[Delete]]

> [!NOTE]
> RDS 삭제에 5~10분 소요됩니다. 삭제 완료를 기다리지 않고 다음 단계를 진행해도 됩니다.

---

### 단계 6: EC2 인스턴스 종료

18. **EC2** → **Instances**
19. Step 9에서 생성한 인스턴스 선택 (`my-3tier-app-server`)
20. **Instance state** → [[Terminate instance]]
21. 이전 Step에서 생성한 EC2도 함께 종료합니다.

---

### 단계 7: CloudFront 배포 삭제

CloudFront 배포는 비활성화 후 삭제해야 합니다.

22. **CloudFront** → **Distributions**
23. 배포 선택 → [[Disable]]
24. Status가 `Disabled`로 변경될 때까지 대기 (5~10분)
25. 다시 선택 → [[Delete]]

> [!TIP]
> CloudFront 비활성화에 시간이 걸리므로, 다른 리소스를 먼저 정리하고
> 마지막에 돌아와서 삭제하면 효율적입니다.

---

### 단계 8: S3 버킷 비우기 + 삭제

S3 버킷은 비어있어야 삭제할 수 있습니다.

```bash
# 버킷 비우기
aws s3 rm s3://my-3tier-app-frontend-123456789012 --recursive

# 버킷 삭제
aws s3 rb s3://my-3tier-app-frontend-123456789012
```

또는 Console에서:

26. **S3** → 버킷 선택 → [[Empty]] → 확인 입력 → [[Empty]]
27. 버킷 선택 → [[Delete]] → 버킷 이름 입력 → [[Delete bucket]]

이전 Step에서 생성한 S3 버킷도 같은 방식으로 삭제합니다.

---

### 단계 9: SSM Parameter Store 파라미터 삭제

```bash
aws ssm delete-parameter --name "/my-3tier-app/db/endpoint"
aws ssm delete-parameter --name "/my-3tier-app/db/name"
aws ssm delete-parameter --name "/my-3tier-app/db/username"
aws ssm delete-parameter --name "/my-3tier-app/db/password"
```

또는 Console에서:

28. **Systems Manager** → **Parameter Store**
29. `/my-3tier-app/` 접두사 파라미터를 모두 선택 → [[Delete]]

---

### 단계 10: Security Groups 삭제

> [!NOTE]
> Security Group은 다른 리소스가 참조하고 있으면 삭제할 수 없습니다.
> EC2, RDS, ALB를 먼저 삭제한 후 진행하세요.

30. **VPC** → **Security Groups**
31. 다음 SG를 삭제합니다 (default SG는 삭제 불가):
    - `my-3tier-app-rds-sg`
    - `my-3tier-app-ec2-sg`
    - `my-3tier-app-alb-sg`
32. 각 SG 선택 → **Actions** → [[Delete security groups]]

---

### 단계 11: DB Subnet Group 삭제

33. **RDS** → **Subnet groups**
34. `my-3tier-app-db-subnet-group` 선택 → [[Delete]]

> [!NOTE]
> RDS 인스턴스가 완전히 삭제된 후에만 Subnet Group을 삭제할 수 있습니다.

---

### 단계 12: VPC 삭제

VPC를 삭제하면 연결된 서브넷, 라우트 테이블, IGW가 함께 삭제됩니다.

35. **VPC** → **Your VPCs**
36. `my-3tier-app-vpc` 선택 → **Actions** → [[Delete VPC]]
37. 확인 입력 후 삭제

> [!WARNING]
> VPC 삭제가 실패하면 아직 연결된 리소스가 있는 것입니다.
> ENI (Elastic Network Interface)가 남아있는 경우가 많습니다.
> **Network Interfaces**에서 확인하고 삭제하세요.

---

### 단계 13: DynamoDB 테이블 삭제 (이전 Step에서 생성한 경우)

38. **DynamoDB** → **Tables**
39. 이전 Step에서 생성한 테이블 선택 → [[Delete]]
40. 확인 입력 후 삭제

---

### 단계 14: CloudFormation 스택 일괄 삭제

> [!TIP]
> CloudFormation 스택을 삭제하면 스택이 생성한 모든 리소스가 자동으로 삭제됩니다.
> 위 단계에서 이미 수동으로 삭제한 리소스는 "DELETE_SKIPPED"로 표시됩니다.

41. **CloudFormation** → **Stacks**
42. `my-3tier-infra` 스택 선택 → [[Delete]]
43. 이전 Step에서 생성한 다른 스택도 삭제합니다.

스택 삭제가 `DELETE_FAILED` 상태가 되면:

- 실패한 리소스를 확인합니다.
- 해당 리소스를 수동으로 삭제합니다.
- 스택을 다시 삭제합니다 (실패한 리소스 건너뛰기 옵션 선택).

---

### 단계 15: ACM 인증서 삭제

44. **Certificate Manager** (us-east-1 리전)
45. 사용하지 않는 인증서 선택 → [[Delete]]
46. **Certificate Manager** (ap-northeast-2 리전)에서도 확인

> [!NOTE]
> CloudFront나 ALB에 연결된 인증서는 삭제할 수 없습니다.
> 먼저 연결을 해제한 후 삭제하세요.

---

### 단계 16: Route 53 레코드 삭제 (도메인 설정한 경우)

47. **Route 53** → **Hosted zones** → 도메인 선택
48. 생성한 A 레코드 (CloudFront, ALB Alias) 삭제
49. Hosted zone 자체는 유지해도 됩니다 (월 $0.50)

---

### 단계 17: IAM 정리

50. **IAM** → **Users**
51. `github-actions-frontend` 사용자 삭제
52. **IAM** → **Roles**
53. EC2용으로 생성한 IAM Role 삭제
54. **IAM** → **Policies**
55. 커스텀 정책이 있다면 삭제

> [!TIP]
> IAM 리소스는 무료이므로 급하게 삭제하지 않아도 됩니다.
> 하지만 보안을 위해 사용하지 않는 Access Key와 사용자는 삭제하는 것이 좋습니다.

---

### 단계 18: 최종 확인

모든 리소스가 정리되었는지 최종 확인합니다.

#### 비용 발생 리소스 확인

56. **Billing** → **Bills** 또는 **Cost Explorer**에서 현재 비용을 확인합니다.
57. 다음 서비스에 비용이 0인지 확인합니다:

| 서비스     | 확인 사항                  |
| ---------- | -------------------------- |
| EC2        | Running 인스턴스 없음      |
| RDS        | 활성 인스턴스 없음         |
| VPC        | NAT Gateway 없음, EIP 없음 |
| ELB        | Load Balancer 없음         |
| CloudFront | 배포 없음                  |
| S3         | 버킷 없음 (또는 비어있음)  |

#### 리전별 확인

> [!WARNING]
> AWS 리소스는 리전별로 존재합니다. 실습에 사용한 모든 리전을 확인하세요:
>
> - **ap-northeast-2** (서울): 대부분의 리소스
> - **us-east-1** (버지니아): CloudFront용 ACM 인증서

#### AWS CLI로 빠른 확인

```bash
# 실행 중인 EC2 확인
aws ec2 describe-instances \
  --filters "Name=instance-state-name,Values=running" \
  --query "Reservations[].Instances[].{ID:InstanceId,Name:Tags[?Key=='Name'].Value|[0]}" \
  --output table

# 활성 RDS 확인
aws rds describe-db-instances \
  --query "DBInstances[].{ID:DBInstanceIdentifier,Status:DBInstanceStatus}" \
  --output table

# NAT Gateway 확인
aws ec2 describe-nat-gateways \
  --filter "Name=state,Values=available" \
  --query "NatGateways[].{ID:NatGatewayId,State:State}" \
  --output table

# Load Balancer 확인
aws elbv2 describe-load-balancers \
  --query "LoadBalancers[].{Name:LoadBalancerName,DNS:DNSName}" \
  --output table

# Elastic IP 확인
aws ec2 describe-addresses \
  --query "Addresses[].{IP:PublicIp,Associated:AssociationId}" \
  --output table
```

모든 명령어의 결과가 비어있으면 정리가 완료된 것입니다.

---

### 전체 정리 체크리스트

| #   | 리소스                  | 삭제 완료 | 비용 영향        |
| --- | ----------------------- | --------- | ---------------- |
| 1   | Auto Scaling Group      | ☐         | 높음             |
| 2   | ALB + Target Group      | ☐         | 높음             |
| 3   | NAT Gateway             | ☐         | 높음             |
| 4   | Elastic IP              | ☐         | 중간             |
| 5   | RDS Instance            | ☐         | 높음             |
| 6   | EC2 Instances           | ☐         | 중간             |
| 7   | CloudFront Distribution | ☐         | 낮음             |
| 8   | S3 Buckets              | ☐         | 낮음             |
| 9   | SSM Parameters          | ☐         | 무료             |
| 10  | Security Groups         | ☐         | 무료             |
| 11  | DB Subnet Group         | ☐         | 무료             |
| 12  | VPC + Subnets           | ☐         | 무료             |
| 13  | DynamoDB Tables         | ☐         | 무료 (On-demand) |
| 14  | CloudFormation Stacks   | ☐         | 무료             |
| 15  | ACM Certificates        | ☐         | 무료             |
| 16  | Route 53 Records        | ☐         | 무료             |
| 17  | IAM Users/Roles         | ☐         | 무료             |
| 18  | 최종 비용 확인          | ☐         | -                |

> [!CONCEPT] 리소스 정리의 중요성
>
> AWS는 사용한 만큼 비용을 청구합니다. 실습이 끝난 후 리소스를 방치하면
> 예상치 못한 비용이 발생할 수 있습니다.
>
> 특히 주의할 리소스:
>
> - **NAT Gateway**: 시간당 ~$0.045 (월 ~$32)
> - **ALB**: 시간당 ~$0.0225 (월 ~$16)
> - **RDS**: 시간당 ~$0.017 (프리티어 초과 시)
> - **Elastic IP** (미사용): 시간당 ~$0.005
>
> 실습 후 반드시 정리하는 습관을 들이세요!

✅ **태스크 완료** — 모든 AWS 리소스를 체계적으로 정리했습니다.

---

# 🎉 Step 9 완료 — 축하합니다!

Step 0~9를 통해 다음을 달성했습니다:

- ✅ AWS 기본 서비스 (VPC, EC2, S3, RDS, CloudFront, ALB) 활용
- ✅ 3-Tier 웹 아키텍처 설계 및 구축
- ✅ 프론트엔드/백엔드 분리 배포
- ✅ CI/CD 파이프라인 구축
- ✅ 보안 (Security Groups, SSM, HTTPS) 적용
- ✅ 비용 관리 및 리소스 정리

이제 여러분은 AWS에서 실제 웹 서비스를 구축하고 운영할 수 있는 기본 역량을 갖추었습니다! 🚀

✅ **실습 종료**: 모든 리소스가 정리되었습니다.

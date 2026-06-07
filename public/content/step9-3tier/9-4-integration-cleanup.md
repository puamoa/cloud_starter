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

> [!OUTPUT]
> 아이템 관리 페이지에서:
>
> ```
> 📋 아이템 관리
> ┌─────────────────────────────────────────┐
> │ 테스트 아이템                            │
> │ 3-Tier 연동 테스트                       │  [삭제]
> └─────────────────────────────────────────┘
> ```
>
> 아이템이 정상적으로 추가되고 목록에 표시되면 프론트엔드↔백엔드↔DB 연동이 성공한 것입니다.

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

> [!TROUBLESHOOTING]
> | 증상 | 원인 | 해결 방법 |
> |------|------|-----------|
> | CloudFront 접속 시 빈 화면 | S3에 빌드 파일 미업로드 | `aws s3 ls s3://BUCKET_NAME`으로 파일 존재 확인 |
> | "API 연결 실패" 표시 | 백엔드 미배포 또는 CORS 미설정 | ALB DNS로 직접 `curl` 테스트, CORS `allowed-origins` 확인 |
> | 아이템 추가 시 500 에러 | RDS 연결 실패 또는 테이블 미생성 | EC2 로그 확인: `sudo journalctl -u spring-app -n 50` |
> | CORS 에러 (브라우저 콘솔) | CloudFront 도메인이 `allowed-origins`에 미포함 | `https://` 프로토콜 포함하여 정확한 도메인 추가 |
> | Network 탭에서 `Mixed Content` 경고 | HTTPS 페이지에서 HTTP API 호출 | `.env.production`의 API URL을 `https://`로 변경 또는 ALB에 HTTPS 리스너 추가 |

---

## 태스크 2: 도메인 연결 (선택)

> [!NOTE]
> 이 태스크는 도메인을 보유한 경우에만 진행합니다.
> 도메인이 없어도 CloudFront URL과 ALB DNS로 서비스를 사용할 수 있습니다.

### 2-1. ACM 인증서 발급 (CloudFront용 - us-east-1)

CloudFront에 사용할 인증서는 반드시 **us-east-1 (버지니아)** 리전에서 발급해야 합니다.

9. AWS Console → 리전을 **US East (N. Virginia)** 로 변경합니다.
10. **Certificate Manager** → [[Request a certificate]]
11. **Domain names**: `yourdomain.com`, `*.yourdomain.com`
12. **Validation method**: DNS validation
13. [[Request]] → DNS 검증 레코드를 Route 53에 추가합니다.
14. [[Create records in Route 53]]을 클릭합니다.
15. 인증서 Status가 `Issued`가 될 때까지 대기합니다 (약 5~30분).

### 2-2. ACM 인증서 발급 (ALB용 - ap-northeast-2)

ALB에 사용할 인증서는 ALB가 있는 리전에서 발급합니다.

16. AWS Console → 리전을 **Asia Pacific (Seoul)** 로 변경합니다.
17. **Certificate Manager** → [[Request a certificate]]
18. **Domain names**: `api.yourdomain.com`
19. 같은 방식으로 DNS 검증을 완료합니다.

### 2-3. CloudFront에 도메인 연결

20. **CloudFront** → 배포 선택 → [[Edit]]
21. **Alternate domain name (CNAME)**: `yourdomain.com`
22. **Custom SSL certificate**: us-east-1에서 발급한 인증서 선택
23. [[Save changes]]

### 2-4. ALB에 HTTPS 리스너 추가

24. **EC2** → **Load Balancers** → `my-3tier-app-alb`
25. **Listeners** 탭 → [[Add listener]]
26. **Protocol**: HTTPS, **Port**: 443
27. **Default SSL/TLS certificate**: ap-northeast-2에서 발급한 인증서 선택
28. **Default action**: Forward to `my-3tier-app-tg`
29. [[Add]]

### 2-5. Route 53 레코드 생성

30. **Route 53** → **Hosted zones** → 도메인 선택
31. [[Create record]]:
    - **Record name**: (비워두기 = 루트 도메인)
    - **Record type**: A
    - **Alias**: Yes → CloudFront distribution 선택
32. [[Create record]]:
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

> [!TROUBLESHOOTING]
> | 증상 | 원인 | 해결 방법 |
> |------|------|-----------|
> | ACM 인증서가 `Pending validation` 상태 유지 | DNS 검증 레코드 미생성 | Route 53에서 CNAME 레코드 생성 확인 |
> | CloudFront에 인증서가 안 보임 | us-east-1 리전에서 발급하지 않음 | CloudFront용 인증서는 반드시 **버지니아(us-east-1)** 리전에서 발급 |
> | 도메인 접속 시 `ERR_CERT_COMMON_NAME_INVALID` | 인증서 도메인과 접속 도메인 불일치 | ACM 인증서의 도메인 이름 확인 |
> | ALB HTTPS 리스너 추가 실패 | ap-northeast-2 리전 인증서 미발급 | ALB용 인증서는 ALB와 같은 리전에서 발급 |

> [!NOTE]
> ACM 인증서는 완전 무료입니다. 발급, 갱신, 사용 모두 비용이 발생하지 않습니다.
> 단, Route 53 Hosted Zone은 월 $0.50의 비용이 발생합니다.

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
> **리소스 방치 시 월 비용 추정 (서울 리전 기준)**
>
> | 리소스               | 시간당 비용 | 일 비용 (24h) | 월 비용 (30일) | 우선순위         |
> | -------------------- | ----------- | ------------- | -------------- | ---------------- |
> | NAT Gateway          | $0.045      | $1.08         | **$32.40**     | 🔴 즉시 삭제     |
> | ALB                  | $0.0225     | $0.54         | **$16.20**     | 🔴 즉시 삭제     |
> | RDS (db.t3.micro)    | $0.017      | $0.41         | **$12.24**     | 🔴 즉시 삭제     |
> | EC2 (t2.micro)       | $0.0116     | $0.28         | **$8.35**      | 🟡 프리티어 확인 |
> | Elastic IP (미사용)  | $0.005      | $0.12         | $3.60          | 🟡 삭제          |
> | Route 53 Hosted Zone | -           | -             | $0.50          | 🟢 낮음          |
> | S3 (소량 데이터)     | -           | -             | ~$0.01         | 🟢 낮음          |
>
> ※ 위 금액은 작성 시점 기준 참고 값이며, 실제 요금은 리전, 환율, AWS 정책 변경에 따라 상이할 수 있습니다.
>
> ⚠️ **모든 리소스를 방치하면 월 ~$73 이상 발생할 수 있습니다!**
> 프리티어 대상이라도 NAT Gateway, ALB는 프리티어에 포함되지 않습니다.

> [!WARNING]
> 리소스 정리 순서가 중요합니다!
> 의존 관계가 있는 리소스는 순서를 지키지 않으면 삭제가 실패합니다.
> 아래 18단계를 순서대로 진행하세요.

### 삭제 순서 (의존 관계 다이어그램)

```
삭제 순서 (위에서 아래로):

1. Auto Scaling Group  ← EC2를 자동 생성하므로 먼저 삭제
2. ALB + Target Group  ← EC2, SG 참조
3. NAT Gateway         ← Route Table 참조
4. Elastic IP          ← NAT Gateway에 연결됨 (NAT 삭제 후)
5. RDS Instance        ← SG, Subnet Group 참조
6. EC2 Instances       ← SG, Subnet 참조
7. CloudFront          ← S3 Origin, ACM 참조 (Disable → Delete)
8. S3 Buckets          ← CloudFront Origin (CF 삭제 후)
9. SSM Parameters      ← 독립적 (순서 무관)
10. Security Groups    ← EC2, RDS, ALB가 참조 (모두 삭제 후)
11. DB Subnet Group    ← RDS가 참조 (RDS 삭제 후)
12. VPC + Subnets      ← 모든 네트워크 리소스 삭제 후
13. DynamoDB Tables    ← 독립적
14. CloudFormation     ← 남은 리소스 일괄 정리
15. ACM Certificates   ← CloudFront/ALB 연결 해제 후
16. Route 53 Records   ← 독립적
17. IAM Users/Roles    ← 독립적
18. 최종 비용 확인
```

> [!TIP]
> 삭제가 실패하면 "이 리소스를 참조하는 다른 리소스가 아직 존재한다"는 의미입니다.
> 에러 메시지에서 참조하는 리소스를 확인하고 먼저 삭제하세요.

---

### 단계 1: Auto Scaling Group 삭제 (해당 시)

Auto Scaling Group이 있다면 먼저 삭제합니다 (EC2 인스턴스가 자동 생성되는 것을 방지).

33. AWS Console → **EC2** → **Auto Scaling Groups**
34. 해당 ASG 선택 → [[Delete]]
35. 확인 입력 후 삭제

---

### 단계 2: ALB (Application Load Balancer) 삭제

36. **EC2** → **Load Balancers**
37. `my-3tier-app-alb` 선택 → **Actions** → [[Delete load balancer]]
38. 확인 입력 후 삭제

39. **Target Groups**에서 `my-3tier-app-tg` 선택 → **Actions** → [[Delete]]

> [!NOTE]
> ALB를 삭제하면 즉시 비용 발생이 중단됩니다 (~$0.0225/시간).
> Target Group은 ALB 삭제 후에 삭제할 수 있습니다.

> [!TIP]
> ALB 삭제 전에 Target Group에서 인스턴스를 먼저 Deregister하면 더 깔끔합니다.
> 하지만 ALB를 삭제하면 Target Group의 등록도 자동으로 해제됩니다.

---

### 단계 3: NAT Gateway 삭제

NAT Gateway는 시간당 비용이 발생하므로 빠르게 삭제합니다.

40. **VPC** → **NAT Gateways**
41. `my-3tier-app-nat-gw` 선택 → **Actions** → [[Delete NAT gateway]]
42. 확인 입력 후 삭제 (삭제에 1~2분 소요)

---

### 단계 4: Elastic IP 해제

NAT Gateway에 연결된 EIP를 해제합니다.

> [!NOTE]
> NAT Gateway 삭제 후 1~2분 대기해야 EIP 해제가 가능합니다.
> "EIP is still associated" 에러가 나오면 잠시 후 다시 시도하세요.

43. **VPC** → **Elastic IPs**
44. `my-3tier-app-nat-eip` 선택 → **Actions** → [[Release Elastic IP addresses]]
45. [[Release]]

> [!WARNING]
> 사용하지 않는 Elastic IP는 시간당 비용이 발생합니다.
> 반드시 해제하세요.

---

### 단계 5: RDS 인스턴스 삭제

46. **RDS** → **Databases**
47. `my-3tier-app-db` 선택 → **Actions** → [[Delete]]
48. 설정:
    - ❌ Create final snapshot: 체크 해제
    - ✅ I acknowledge that upon instance deletion...
    - 확인 입력: `delete me`
49. [[Delete]]

> [!NOTE]
> RDS 삭제에 5~10분 소요됩니다. 삭제 완료를 기다리지 않고 다음 단계를 진행해도 됩니다.

---

### 단계 6: EC2 인스턴스 종료

50. **EC2** → **Instances**
51. Step 9에서 생성한 인스턴스 선택 (`my-3tier-app-server`)
52. **Instance state** → [[Terminate instance]]
53. 이전 Step에서 생성한 EC2도 함께 종료합니다.

---

### 단계 7: CloudFront 배포 삭제

CloudFront 배포는 비활성화 후 삭제해야 합니다.

54. **CloudFront** → **Distributions**
55. 배포 선택 → [[Disable]]
56. Status가 `Disabled`로 변경될 때까지 대기 (5~10분)
57. 다시 선택 → [[Delete]]

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

58. **S3** → 버킷 선택 → [[Empty]] → 확인 입력 → [[Empty]]
59. 버킷 선택 → [[Delete]] → 버킷 이름 입력 → [[Delete bucket]]

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

60. **Systems Manager** → **Parameter Store**
61. `/my-3tier-app/` 접두사 파라미터를 모두 선택 → [[Delete]]

---

### 단계 10: Security Groups 삭제

> [!NOTE]
> Security Group은 다른 리소스가 참조하고 있으면 삭제할 수 없습니다.
> EC2, RDS, ALB를 먼저 삭제한 후 진행하세요.

62. **VPC** → **Security Groups**
63. 다음 SG를 삭제합니다 (default SG는 삭제 불가):
    - `my-3tier-app-rds-sg`
    - `my-3tier-app-ec2-sg`
    - `my-3tier-app-alb-sg`
64. 각 SG 선택 → **Actions** → [[Delete security groups]]

---

### 단계 11: DB Subnet Group 삭제

65. **RDS** → **Subnet groups**
66. `my-3tier-app-db-subnet-group` 선택 → [[Delete]]

> [!NOTE]
> RDS 인스턴스가 완전히 삭제된 후에만 Subnet Group을 삭제할 수 있습니다.

---

### 단계 12: VPC 삭제

VPC를 삭제하면 연결된 서브넷, 라우트 테이블, IGW가 함께 삭제됩니다.

67. **VPC** → **Your VPCs**
68. `my-3tier-app-vpc` 선택 → **Actions** → [[Delete VPC]]
69. 확인 입력 후 삭제

> [!WARNING]
> VPC 삭제가 실패하면 아직 연결된 리소스가 있는 것입니다.
> ENI (Elastic Network Interface)가 남아있는 경우가 많습니다.
> **Network Interfaces**에서 확인하고 삭제하세요.

> [!TROUBLESHOOTING]
> | 증상 | 원인 | 해결 방법 |
> |------|------|-----------|
> | "has dependencies and cannot be deleted" | ENI가 남아있음 | EC2 → Network Interfaces에서 해당 VPC의 ENI 삭제 |
> | "has attached Internet Gateway" | IGW 미분리 | VPC → Internet Gateways → Detach 후 Delete |
> | Security Group 삭제 실패 | 다른 SG가 참조 중 | 참조하는 SG의 Inbound/Outbound 규칙에서 해당 SG 제거 후 삭제 |
> | Subnet 삭제 실패 | Lambda ENI 또는 ELB ENI 잔존 | Network Interfaces에서 해당 Subnet의 ENI 확인 후 삭제 |

---

### 단계 13: DynamoDB 테이블 삭제 (이전 Step에서 생성한 경우)

70. **DynamoDB** → **Tables**
71. 이전 Step에서 생성한 테이블 선택 → [[Delete]]
72. 확인 입력 후 삭제

---

### 단계 14: CloudFormation 스택 일괄 삭제

> [!TIP]
> CloudFormation 스택을 삭제하면 스택이 생성한 모든 리소스가 자동으로 삭제됩니다.
> 위 단계에서 이미 수동으로 삭제한 리소스는 "DELETE_SKIPPED"로 표시됩니다.

73. **CloudFormation** → **Stacks**
74. `my-3tier-infra` 스택 선택 → [[Delete]]
75. 이전 Step에서 생성한 다른 스택도 삭제합니다.

스택 삭제가 `DELETE_FAILED` 상태가 되면:

- 실패한 리소스를 확인합니다.
- 해당 리소스를 수동으로 삭제합니다.
- 스택을 다시 삭제합니다 (실패한 리소스 건너뛰기 옵션 선택).

> [!TROUBLESHOOTING]
> | 증상 | 원인 | 해결 방법 |
> |------|------|-----------|
> | `DELETE_FAILED` (Security Group) | 다른 리소스가 SG를 참조 중 | 참조하는 리소스(EC2, RDS 등) 먼저 삭제 |
> | `DELETE_FAILED` (S3 Bucket) | 버킷이 비어있지 않음 | `aws s3 rm s3://BUCKET --recursive` 후 재시도 |
> | `DELETE_FAILED` (VPC) | ENI 또는 서브넷에 리소스 잔존 | Network Interfaces 확인 후 수동 삭제 |
> | 스택 삭제 재시도 시 같은 에러 | 수동 삭제 미완료 | "Retain" 옵션으로 해당 리소스 건너뛰고 삭제 후 수동 정리 |

---

### 단계 15: ACM 인증서 삭제

76. **Certificate Manager** (us-east-1 리전)
77. 사용하지 않는 인증서 선택 → [[Delete]]
78. **Certificate Manager** (ap-northeast-2 리전)에서도 확인

> [!NOTE]
> CloudFront나 ALB에 연결된 인증서는 삭제할 수 없습니다.
> 먼저 연결을 해제한 후 삭제하세요.

---

### 단계 16: Route 53 레코드 삭제 (도메인 설정한 경우)

79. **Route 53** → **Hosted zones** → 도메인 선택
80. 생성한 A 레코드 (CloudFront, ALB Alias) 삭제
81. Hosted zone 자체는 유지해도 됩니다 (월 $0.50)

---

### 단계 17: IAM 정리

82. **IAM** → **Users**
83. `github-actions-frontend` 사용자 삭제
84. **IAM** → **Roles**
85. EC2용으로 생성한 IAM Role 삭제
86. **IAM** → **Policies**
87. 커스텀 정책이 있다면 삭제

> [!TIP]
> IAM 리소스는 무료이므로 급하게 삭제하지 않아도 됩니다.
> 하지만 보안을 위해 사용하지 않는 Access Key와 사용자는 삭제하는 것이 좋습니다.

---

### 단계 18: 최종 확인

모든 리소스가 정리되었는지 최종 확인합니다.

#### 비용 발생 리소스 확인

88. **Billing** → **Bills** 또는 **Cost Explorer**에서 현재 비용을 확인합니다.
89. 다음 서비스에 비용이 0인지 확인합니다:

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

| #   | 리소스                  | 삭제 완료 | 월 비용 (방치 시) | 프리티어       |
| --- | ----------------------- | --------- | ----------------- | -------------- |
| 1   | Auto Scaling Group      | ☐         | EC2 비용 발생     | -              |
| 2   | ALB + Target Group      | ☐         | **~$16/월**       | ❌ 미포함      |
| 3   | NAT Gateway             | ☐         | **~$32/월**       | ❌ 미포함      |
| 4   | Elastic IP              | ☐         | ~$3.6/월          | ❌ 미포함      |
| 5   | RDS Instance            | ☐         | **~$12/월**       | ✅ 750시간/월  |
| 6   | EC2 Instances           | ☐         | ~$8/월            | ✅ 750시간/월  |
| 7   | CloudFront Distribution | ☐         | ~$1 미만          | ✅ 1000만 요청 |
| 8   | S3 Buckets              | ☐         | ~$0.01            | ✅ 5GB         |
| 9   | SSM Parameters          | ☐         | 무료              | ✅             |
| 10  | Security Groups         | ☐         | 무료              | ✅             |
| 11  | DB Subnet Group         | ☐         | 무료              | ✅             |
| 12  | VPC + Subnets           | ☐         | 무료              | ✅             |
| 13  | DynamoDB Tables         | ☐         | 무료 (On-demand)  | ✅             |
| 14  | CloudFormation Stacks   | ☐         | 무료              | ✅             |
| 15  | ACM Certificates        | ☐         | 무료              | ✅             |
| 16  | Route 53 Records        | ☐         | $0.50/월 (Zone)   | ❌             |
| 17  | IAM Users/Roles         | ☐         | 무료              | ✅             |
| 18  | 최종 비용 확인          | ☐         | -                 | -              |

> [!CONCEPT] 리소스 정리의 중요성
>
> AWS는 사용한 만큼 비용을 청구합니다. 실습이 끝난 후 리소스를 방치하면
> 예상치 못한 비용이 발생할 수 있습니다.
>
> 특히 주의할 리소스 (프리티어 미포함):
>
> | 리소스              | 시간당  | 1일 방치 | 1주 방치 | 1개월 방치 |
> | ------------------- | ------- | -------- | -------- | ---------- |
> | NAT Gateway         | $0.045  | $1.08    | $7.56    | **$32.40** |
> | ALB                 | $0.0225 | $0.54    | $3.78    | **$16.20** |
> | RDS (프리티어 초과) | $0.017  | $0.41    | $2.86    | **$12.24** |
> | Elastic IP (미사용) | $0.005  | $0.12    | $0.84    | $3.60      |
>
> ※ 위 금액은 작성 시점 기준 참고 값이며, 실제 요금은 리전, 환율, AWS 정책 변경에 따라 상이할 수 있습니다.
>
> 💡 **실습 후 반드시 정리하는 습관을 들이세요!**
> AWS Billing → Bills에서 일별 비용을 확인할 수 있습니다.
> Budget Alert를 설정하면 예상 비용 초과 시 이메일 알림을 받을 수 있습니다.

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

---
title: '🗑️ 전체 리소스 정리'
week: 8
session: 5
awsServices: []
learningObjectives:
  - 전체 AWS 리소스를 체계적으로 정리할 수 있습니다.
  - 리소스 간 의존 관계를 이해하고 올바른 순서로 삭제할 수 있습니다.
  - 비용 발생 리소스를 식별하고 우선 삭제할 수 있습니다.
prerequisites:
  - Step 8-1 ~ 8-4 완료
estimatedCost: 이전 차시(8-1~8-3)에서 생성한 리소스로 인해 비용 발생 가능
---

Step 0 ~ 8에서 생성한 모든 AWS 리소스를 체계적으로 정리합니다.  
**비용이 발생하는 리소스부터 우선 삭제합니다.**

### Step 8 전체 아키텍처

<img src="/images/step8/8-architecture.png" alt="Step 8 3-Tier 아키텍처" class="guide-img-lg" />

---

## 본인 환경에 맞는 정리 방법 선택

| 방법 | 해당하는 경우                                          | 정리 방법                                         |
| ---- | ------------------------------------------------------ | ------------------------------------------------- |
| 📗 A | Step 8-1에서 **CloudFormation 스택**으로 인프라 구축   | 수동 생성 리소스 삭제 → 스택 4개 역순 삭제 (간단) |
| 📙 B | 모든 리소스를 **수동 생성** (또는 스택 없이 직접 구축) | 아래 전체 18단계를 순서대로 진행                  |

> [!TIP]
> Step 8-1 가이드를 따랐다면 대부분 **📗 방법 A**에 해당합니다.  
> CloudFormation 스택 삭제 한번으로 VPC, RDS, ALB, S3 등이 자동 정리됩니다.

---

## 📗 방법 A: CloudFormation 스택 사용자 (권장)

CloudFormation으로 생성한 리소스는 스택 삭제로 일괄 정리됩니다.  
**수동 생성한 리소스만 먼저 삭제**한 뒤 스택을 삭제합니다.

### A-1. Tag Editor로 리소스 확인

📍 **실행 위치: 로컬 PC (브라우저 — AWS 콘솔)**

1. 상단 검색창에 `Resource Groups & Tag Editor`를 입력하고 선택합니다.
2. 왼쪽 메뉴에서 **Tag Editor**를 선택합니다.
3. 다음 조건으로 검색합니다:
   - **Regions**: `ap-northeast-2`
   - **Tag key**: `Step`, **Tag value**: `step8`
4. [[Search resources]] 버튼을 클릭합니다.
5. 검색 결과에서 이 실습에서 생성한 리소스를 확인합니다.

> [!TIP]
> Tag Editor는 리소스를 **찾는 용도**로만 사용합니다.  
> 실제 삭제는 아래 단계에서 각 서비스 콘솔 또는 CloudShell에서 수행합니다.
>
> **이전 Step 리소스도 확인:**  
> Tag key `Step`, Tag value `step1` ~ `step7`로 각각 검색하면 남아있는 리소스를 찾을 수 있습니다.

### A-2. 수동 생성 리소스 삭제

📍 **실행 위치: AWS 콘솔 + CloudShell**

> [!TIP]
> AWS 콘솔 우측 상단의 **CloudShell** 아이콘(>\_)을 클릭하면 브라우저에서 바로 AWS CLI를 실행할 수 있습니다.  
> 로컬에 AWS CLI가 설치되어 있지 않아도 S3 비우기, SSM 삭제 등을 CloudShell에서 수행할 수 있습니다.

아래 리소스는 CloudFormation이 아닌 수동으로 생성한 것이므로 개별 삭제합니다:

**① EC2 인스턴스 종료**

6. 상단 검색창에 `EC2`를 입력하고 **EC2** 서비스를 선택합니다.
7. 왼쪽 메뉴에서 **Instances**를 클릭합니다.
8. `my-3tier-app-server` 인스턴스의 체크박스를 선택합니다.
9. 상단 **Instance state** → [[Terminate (delete) instance]]를 클릭합니다.
10. 확인 팝업에서 [[Terminate]]를 클릭합니다.
11. Instance state가 `Shutting down` → `Terminated`로 변경되는 것을 확인합니다.

**② CloudFront 배포 삭제**

12. 상단 검색창에 `CloudFront`를 입력하고 **CloudFront** 서비스를 선택합니다.
13. Distributions 목록에서 본인의 배포를 선택합니다.
14. [[Disable]] 버튼을 클릭합니다.
15. 확인 팝업에서 [[Disable distribution]]을 클릭합니다.
16. Status가 `Disabled`로 변경될 때까지 대기합니다 (5 ~ 10분 소요).
17. 다시 선택하고 [[Delete]] 버튼을 클릭합니다.

> [!TIP]
> Disable에 시간이 걸리므로, 다른 리소스를 먼저 정리하고 마지막에 돌아와서 Delete하면 효율적입니다.

**③ 배포용 S3 버킷 삭제**

📍 **실행 위치: AWS CloudShell 또는 로컬 터미널**

18. CloudShell(콘솔 우측 상단 >\_ 아이콘)을 열고 다음 명령어를 실행합니다:

```bash
# 배포용 버킷 비우기 + 삭제 (<> 부분을 본인 버킷명으로 변경)
aws s3 rm s3://<my-3tier-app-deploy-BucketSuffix> --recursive
aws s3 rb s3://<my-3tier-app-deploy-BucketSuffix>
```

또는 콘솔에서:

19. S3 → 배포용 버킷을 클릭합니다.
20. [[Empty]] 버튼을 클릭합니다.
21. 확인 문구 `permanently delete`를 입력하고 [[Empty]]를 클릭합니다.
22. 버킷 목록으로 돌아가서 같은 버킷을 선택합니다.
23. [[Delete]] 버튼을 클릭합니다.
24. 버킷 이름을 입력하고 [[Delete bucket]]을 클릭합니다.

**④ SSM Parameter Store 삭제**

📍 **실행 위치: AWS CloudShell 또는 로컬 터미널**

25. 다음 명령어를 실행합니다:

```bash
aws ssm delete-parameter --name "/my-3tier-app/db/endpoint"
aws ssm delete-parameter --name "/my-3tier-app/db/name"
aws ssm delete-parameter --name "/my-3tier-app/db/username"
aws ssm delete-parameter --name "/my-3tier-app/db/password"
```

> [!NOTE]
> `ParameterNotFound` 에러는 이미 삭제된 것이므로 무시해도 됩니다.  
> 본인이 추가한 파라미터(`/my-3tier-app/s3/bucket`, `/my-3tier-app/aws/region` 등)가 더 있다면 함께 삭제하세요.

**⑤ IAM 사용자 삭제**

26. 상단 검색창에 `IAM`을 입력하고 **IAM** 서비스를 선택합니다.
27. 왼쪽 메뉴에서 **Users**를 클릭합니다.
28. `github-actions-frontend`를 선택합니다.
29. [[Delete]] 버튼을 클릭합니다.
30. 확인 입력란에 사용자 이름을 입력하고 [[Delete]]를 클릭합니다.
31. `github-actions-backend`도 같은 방식으로 삭제합니다.

> [!TIP]
> IAM 사용자를 삭제했다면 GitHub 리포지토리의 Secrets도 함께 정리하세요:
>
> - 리포지토리 → Settings → Secrets and variables → Actions
> - `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` 등 삭제한 IAM 사용자의 키를 제거합니다.

**⑥ IAM Role 삭제**

32. 왼쪽 메뉴에서 **Roles**를 클릭합니다.
33. 검색창에 `my-3tier-app-ec2-role` (또는 `ec2-starter-role`)을 입력합니다.
34. 해당 Role을 선택합니다.
35. [[Delete]] 버튼을 클릭합니다.
36. 확인 입력란에 Role 이름을 입력하고 [[Delete]]를 클릭합니다.

**⑦ ACM 인증서 삭제 (도메인 설정한 경우만)**

37. 우측 상단 리전을 **US East (N. Virginia) us-east-1**로 변경합니다.
38. 상단 검색창에 `Certificate Manager`를 입력하고 선택합니다.
39. 사용하지 않는 인증서를 선택합니다.
40. [[Delete]] 버튼을 클릭합니다.
41. 확인 팝업에서 [[Delete]]를 클릭합니다.
42. 리전을 **ap-northeast-2**로 돌아와서 같은 작업을 반복합니다.

> [!NOTE]
> CloudFront나 ALB에 아직 연결된 인증서는 삭제할 수 없습니다.  
> 먼저 해당 서비스에서 인증서 연결을 해제한 후 삭제하세요.

**⑧ Route 53 레코드 삭제 (도메인 설정한 경우만)**

43. 상단 검색창에 `Route 53`을 입력하고 **Route 53** 서비스를 선택합니다.
44. 왼쪽 메뉴에서 **Hosted zones**를 클릭합니다.
45. 본인의 도메인을 클릭합니다.
46. 생성한 A 레코드 (CloudFront Alias, ALB Alias)를 선택합니다.
47. [[Delete records]] 버튼을 클릭합니다.
48. 확인 팝업에서 [[Delete]]를 클릭합니다.

> [!TIP]
> Hosted zone 자체는 삭제하지 않아도 됩니다 (월 $0.50).  
> 도메인을 계속 사용할 예정이라면 유지하세요.

### A-3. CloudFormation 스택 삭제 (역순)

> [!WARNING]
> 스택 삭제 순서가 중요합니다! 의존 관계 역순으로 삭제하세요.  
> 순서를 무시하면 `DELETE_FAILED`가 발생합니다.

📍 **실행 위치: AWS 콘솔 (CloudFormation)**

49. 상단 검색창에 `CloudFormation`을 입력하고 **CloudFormation** 서비스를 선택합니다.
50. **Stacks** 목록에서 다음 순서로 삭제합니다:

**① `step8-backend` 삭제:**

51. `step8-backend` 스택을 선택합니다.
52. [[Delete]] 버튼을 클릭합니다.
53. 확인 팝업에서 [[Delete stack]]을 클릭합니다.
54. Status가 `DELETE_COMPLETE`가 될 때까지 대기합니다.

**② `step8-frontend` 삭제:**

> [!WARNING]
> S3 버킷에 파일이 남아있으면 삭제 실패합니다.  
> 먼저 CloudShell에서 `aws s3 rm s3://<프론트엔드 버킷명> --recursive`로 비운 뒤 진행하세요.

55. `step8-frontend` 스택을 선택하고 [[Delete]]를 클릭합니다.
56. 확인 팝업에서 [[Delete stack]]을 클릭합니다.
57. `DELETE_COMPLETE` 대기합니다.

**③ `step8-data` 삭제:**

58. `step8-data` 스택을 선택하고 [[Delete]]를 클릭합니다.
59. 확인 팝업에서 [[Delete stack]]을 클릭합니다 (RDS 포함 5 ~ 10분 소요).
60. RDS 삭제 포함 5 ~ 10분 소요됩니다. `DELETE_COMPLETE` 대기합니다.

**④ `step8-network` 삭제:**

61. `step8-network` 스택을 선택하고 [[Delete]]를 클릭합니다.
62. 확인 팝업에서 [[Delete stack]]을 클릭합니다.
63. `DELETE_COMPLETE` 확인합니다.

> [!TROUBLESHOOTING]
> | 증상 | 원인 | 해결 방법 |
> |------|------|-----------|
> | `DELETE_FAILED` (Security Group) | EC2가 아직 종료되지 않음 | EC2 Terminated 확인 후 재시도 |
> | `DELETE_FAILED` (S3 Bucket) | 버킷이 비어있지 않음 | `aws s3 rm s3://<BUCKET> --recursive` 후 재시도 |
> | `DELETE_FAILED` (VPC) | ENI 잔존 | EC2 → Network Interfaces에서 해당 VPC의 ENI 삭제 |
> | 스택 삭제 재시도 시 같은 에러 | 수동 삭제 미완료 | "Retain" 옵션으로 건너뛰고 수동 정리 |

### A-4. Tag Editor로 최종 확인

64. 다시 Tag Editor에서 `Step: step8`로 검색합니다.
65. 검색 결과에 리소스가 없으면 정리 완료입니다.

> [!TIP]
> **이전 Step 리소스도 확인하세요:**  
> Tag key `Step`, Tag value `step1` ~ `step7`로 각각 검색하여 남은 리소스가 있는지 확인합니다.  
> 이전 Step의 정리 가이드는 각 세션의 "🗑️ 리소스 정리" 섹션을 참고하세요.

✅ **방법 A 완료** — CloudFormation 스택 삭제로 리소스가 정리되었습니다. 아래 "최종 비용 확인"으로 이동하세요.

---

## 📙 방법 B: 수동 생성 사용자 (전체 18단계)

> [!WARNING]
> **리소스 방치 시 월 비용 추정 (서울 리전 기준, On-Demand)**
>
> | 리소스                   | 시간당 비용 | 일 비용 (24h) | 월 비용 (30일) | 비고                 |
> | ------------------------ | ----------- | ------------- | -------------- | -------------------- |
> | NAT Gateway              | ~$0.059     | ~$1.42        | **~$42**       | 🔴 즉시 삭제         |
> | ALB                      | ~$0.025     | ~$0.60        | **~$18**       | 🔴 즉시 삭제         |
> | RDS (db.t3.micro)        | ~$0.02      | ~$0.48        | **~$14**       | 🔴 즉시 삭제         |
> | EC2 (t3.micro)           | ~$0.013     | ~$0.31        | **~$9**        | � 크레딧 빠르게 소진 |
> | Elastic IP (Public IPv4) | $0.005      | $0.12         | ~$3.60         | 🟡 삭제              |
> | Route 53 Hosted Zone     | -           | -             | $0.50          | 🟢 낮음              |
> | S3 (소량 데이터)         | -           | -             | ~$0.01         | 🟢 낮음              |
>
> ※ 금액은 참고용이며, 리전·환율·AWS 정책 변경에 따라 달라질 수 있습니다.  
> ※ 2024.02부터 모든 Public IPv4 주소에 $0.005/hr 과금됩니다 (NAT Gateway, ALB, EC2 포함).  
> [Amazon EC2 요금](https://aws.amazon.com/ec2/pricing/) | [Amazon VPC 요금](https://aws.amazon.com/vpc/pricing/) | [Amazon RDS 요금](https://aws.amazon.com/rds/pricing/)
>
> ⚠️ **모든 리소스를 방치하면 월 ~$87 이상 발생할 수 있습니다!**
>
> **Free Plan (2025.07.15 이후 가입):**  
> $100~$200 크레딧으로 비용 차감 가능하지만, 위 리소스를 방치하면 크레딧이 빠르게 소진됩니다.  
> 크레딧 소진 시 Free Tier 한도를 초과할 수 없으므로 리소스가 중단/삭제될 수 있습니다.  
> 단, Always Free 범위를 넘는 서비스는 크레딧 소진 후 On-Demand 요금이 청구됩니다.
>
> **레거시 Free Tier (2025.07.15 이전 가입):**  
> NAT Gateway, ALB는 프리티어 미포함. EC2(t3.micro), RDS(db.t3.micro)만 12개월간 750시간/월 무료.  
> 한도를 초과하면 즉시 On-Demand 요금이 과금됩니다.

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

Auto Scaling Group이 있다면 먼저 삭제합니다 (Amazon EC2 인스턴스가 자동 생성되는 것을 방지).

66. 상단 검색창에 `EC2`를 입력하고 **EC2** 서비스를 선택합니다.
67. 왼쪽 메뉴에서 **Auto Scaling Groups**를 클릭합니다.
68. 해당 ASG를 선택합니다.
69. [[Delete]] 버튼을 클릭합니다.
70. 확인 입력란에 `delete`를 입력하고 [[Delete]]를 클릭합니다.

---

### 단계 2: ALB (Application Load Balancer) 삭제

71. 왼쪽 메뉴에서 **Load Balancers**를 클릭합니다.
72. `my-3tier-app-alb`를 선택합니다.
73. **Actions** → [[Delete load balancer]]를 클릭합니다.
74. 확인 입력란에 `confirm`을 입력하고 [[Delete]]를 클릭합니다.

75. 왼쪽 메뉴에서 **Target Groups**를 클릭합니다.
76. `my-3tier-app-tg`를 선택합니다.
77. **Actions** → [[Delete]]를 클릭합니다.
78. 확인 팝업에서 [[Yes, delete]]를 클릭합니다.

> [!NOTE]
> ALB를 삭제하면 즉시 비용 발생이 중단됩니다 (~$0.0225/시간).  
> Target Group은 ALB 삭제 후에 삭제할 수 있습니다.

> [!TIP]
> ALB 삭제 전에 Target Group에서 인스턴스를 먼저 Deregister하면 더 깔끔합니다.  
> 하지만 ALB를 삭제하면 Target Group의 등록도 자동으로 해제됩니다.

---

### 단계 3: NAT Gateway 삭제

NAT Gateway는 시간당 비용이 발생하므로 빠르게 삭제합니다.

79. 상단 검색창에 `VPC`를 입력하고 **VPC** 서비스를 선택합니다.
80. 왼쪽 메뉴에서 **NAT Gateways**를 클릭합니다.
81. `my-3tier-app-nat-gw`를 선택합니다.
82. **Actions** → [[Delete NAT gateway]]를 클릭합니다.
83. 확인 입력란에 `delete`를 입력하고 [[Delete]]를 클릭합니다 (삭제에 1~2분 소요).

---

### 단계 4: Elastic IP 해제

NAT Gateway에 연결된 EIP를 해제합니다.

> [!NOTE]
> NAT Gateway 삭제 후 1~2분 대기해야 EIP 해제가 가능합니다.  
> "EIP is still associated" 에러가 나오면 잠시 후 다시 시도하세요.

84. 왼쪽 메뉴에서 **Elastic IPs**를 클릭합니다.
85. `my-3tier-app-nat-eip`를 선택합니다.
86. **Actions** → [[Release Elastic IP addresses]]를 클릭합니다.
87. [[Release]] 버튼을 클릭합니다.

> [!WARNING]
> 사용하지 않는 Elastic IP는 시간당 비용이 발생합니다.  
> 반드시 해제하세요.

---

### 단계 5: Amazon RDS 인스턴스 삭제

> [!WARNING]
> RDS에 **Deletion Protection**이 활성화되어 있으면 삭제가 불가능합니다.  
> 삭제 전에 반드시 해제하세요:
>
> - DB 인스턴스를 선택하고 [[Modify]] 버튼을 클릭합니다.
> - 하단 **Deletion protection** 섹션에서 **Enable deletion protection** 체크를 해제합니다.
> - [[Continue]] → **Apply immediately** 선택 → [[Modify DB instance]]를 클릭합니다.

88. 상단 검색창에 `RDS`를 입력하고 **RDS** 서비스를 선택합니다.
89. 왼쪽 메뉴에서 **Databases**를 클릭합니다.
90. `my-3tier-app-db`를 선택합니다.
91. **Actions** → [[Delete]]를 클릭합니다.
92. 설정:
    - ❌ Create final snapshot: 체크 해제
    - ✅ I acknowledge that upon instance deletion...
    - 확인 입력: `delete me`
93. [[Delete]] 버튼을 클릭합니다.

> [!NOTE]
> RDS 삭제에 5~10분 소요됩니다.  
> 삭제 완료를 기다리지 않고 다음 단계를 진행해도 됩니다.

---

### 단계 6: Amazon EC2 인스턴스 종료

94. 상단 검색창에 `EC2`를 입력하고 **EC2** 서비스를 선택합니다.
95. 왼쪽 메뉴에서 **Instances**를 클릭합니다.
96. Step 8에서 생성한 인스턴스 (`my-3tier-app-server`)를 선택합니다.
97. **Instance state** → [[Terminate (delete) instance]]를 클릭합니다.
98. 이전 Step에서 생성한 EC2도 함께 종료합니다.

---

### 단계 7: Amazon CloudFront 배포 삭제

Amazon CloudFront 배포는 비활성화 후 삭제해야 합니다.

99. 상단 검색창에 `CloudFront`를 입력하고 **CloudFront** 서비스를 선택합니다.
100. Distributions 목록에서 배포를 선택합니다.
101.  [[Disable]] 버튼을 클릭합니다.
102.  확인 팝업에서 [[Disable distribution]]을 클릭합니다.
103.  Status가 `Disabled`로 변경될 때까지 대기합니다 (5~10분).
104.  다시 선택하고 [[Delete]] 버튼을 클릭합니다.

> [!TIP]
> CloudFront 비활성화에 시간이 걸리므로, 다른 리소스를 먼저 정리하고 마지막에 돌아와서 삭제하면 효율적입니다.

---

### 단계 8: S3 버킷 비우기 + 삭제

📍 **실행 위치: AWS CloudShell 또는 로컬 터미널**

S3 버킷은 비어있어야 삭제할 수 있습니다.

```bash
# 버킷 비우기
aws s3 rm s3://<FRONTEND_BUCKET_NAME> --recursive

# 버킷 삭제
aws s3 rb s3://<FRONTEND_BUCKET_NAME>
```

또는 Console에서:

105. 상단 검색창에 `S3`를 입력하고 **S3** 서비스를 선택합니다.
106. 프론트엔드 배포 버킷을 선택합니다.
107. [[Empty]] 버튼을 클릭합니다.
108. 확인 문구 `permanently delete`를 입력하고 [[Empty]]를 클릭합니다.
109. 다시 버킷을 선택하고 [[Delete]] 버튼을 클릭합니다.
110. 버킷 이름을 입력하고 [[Delete bucket]]을 클릭합니다.
111. 배포용 S3 버킷 (JAR/WAR 업로드용)도 같은 방식으로 비우기 + 삭제합니다.

> [!TIP]
> 이전 Step에서 생성한 S3 버킷도 확인하세요.  
> `Tag Editor`에서 `Session` 태그로 검색하면 Step별로 생성한 버킷을 쉽게 찾을 수 있습니다.

---

### 단계 9: SSM Parameter Store 파라미터 삭제

📍 **실행 위치: AWS CloudShell 또는 로컬 터미널**

```bash
aws ssm delete-parameter --name "/my-3tier-app/db/endpoint"
aws ssm delete-parameter --name "/my-3tier-app/db/name"
aws ssm delete-parameter --name "/my-3tier-app/db/username"
aws ssm delete-parameter --name "/my-3tier-app/db/password"
aws ssm delete-parameter --name "/my-3tier-app/s3/deploy-bucket"
aws ssm delete-parameter --name "/my-3tier-app/s3/region"
```

> [!TIP]
> 파라미터가 존재하지 않으면 `ParameterNotFound` 에러가 발생합니다. 무시해도 됩니다.  
> 본인이 추가한 파라미터가 더 있다면 함께 삭제하세요.

또는 Console에서:

112. 상단 검색창에 `Systems Manager`를 입력하고 선택합니다.
113. 왼쪽 메뉴에서 **Parameter Store**를 클릭합니다.
114. `/my-3tier-app/` 접두사 파라미터를 모두 선택하고 [[Delete]] 버튼을 클릭합니다.

---

### 단계 10: Security Groups 삭제

> [!NOTE]
> Security Group은 다른 리소스가 참조하고 있으면 삭제할 수 없습니다.  
> EC2, RDS, ALB를 먼저 삭제한 후 진행하세요.
>
> **상호 참조 해결:** SG끼리 서로 참조하는 경우 삭제가 실패합니다.  
> 이 경우 먼저 각 SG의 Inbound/Outbound 규칙에서 다른 SG를 참조하는 규칙을 삭제한 뒤 SG를 삭제하세요.

115. 상단 검색창에 `VPC`를 입력하고 **VPC** 서비스를 선택합니다.
116. 왼쪽 메뉴에서 **Security Groups**를 클릭합니다.
117. 다음 SG를 삭제합니다 (default SG는 삭제 불가):
     - `my-3tier-app-rds-sg`
     - `my-3tier-app-ec2-sg`
     - `my-3tier-app-alb-sg`

118. 각 SG를 선택합니다.
119. **Actions** → [[Delete security groups]]를 클릭합니다.
120. 확인 팝업에서 [[Delete]]를 클릭합니다.

---

### 단계 11: DB Subnet Group 삭제

121. 상단 검색창에 `RDS`를 입력하고 **RDS** 서비스를 선택합니다.
122. 왼쪽 메뉴에서 **Subnet groups**를 클릭합니다.
123. `my-3tier-app-db-subnet-group`을 선택하고 [[Delete]] 버튼을 클릭합니다.

> [!NOTE]
> Amazon RDS 인스턴스가 완전히 삭제된 후에만 Subnet Group을 삭제할 수 있습니다.

---

### 단계 12: VPC 삭제

VPC를 삭제하면 연결된 서브넷, 라우트 테이블, IGW가 함께 삭제됩니다.

124. 상단 검색창에 `VPC`를 입력하고 **VPC** 서비스를 선택합니다.
125. 왼쪽 메뉴에서 **Your VPCs**를 클릭합니다.
126. `my-3tier-app-vpc`를 선택합니다.
127. **Actions** → [[Delete VPC]]를 클릭합니다.
128. 확인 입력란에 `delete`를 입력하고 [[Delete]]를 클릭합니다.

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

📍 **실행 위치: AWS 콘솔**

129. 상단 검색창에 `DynamoDB`를 입력하고 **DynamoDB** 서비스를 선택합니다.
130. 왼쪽 메뉴에서 **Tables**를 클릭합니다.
131. 이전 Step에서 생성한 테이블을 선택하고 [[Delete]] 버튼을 클릭합니다.
132. 확인 입력란에 `confirm`을 입력하고 [[Delete table]]을 클릭합니다.

> [!NOTE]
> Step 10(서버리스)을 진행하지 않았다면 이 단계를 건너뛰세요.

---

### 단계 14: AWS CloudFormation 스택 삭제 (해당하는 경우만)

> [!NOTE]
> 이전 Step(2, 3, 5, 6 등)에서 CloudFormation 스택을 사용한 적이 있다면 여기서 함께 삭제합니다.  
> Step 8에서 CloudFormation을 사용했다면 **📗 방법 A**를 따르세요. 이 단계는 건너뛰면 됩니다.

📍 **실행 위치: AWS 콘솔 (CloudFormation)**

133. 상단 검색창에 `CloudFormation`을 입력하고 **CloudFormation** 서비스를 선택합니다.
134. **Stacks** 목록에서 이전 Step에서 생성한 스택이 있는지 확인합니다.
135. 있다면 각 스택을 선택하고 [[Delete]] 버튼을 클릭합니다.
136. 확인 팝업에서 [[Delete stack]]을 클릭합니다.

스택 삭제가 `DELETE_FAILED` 상태가 되면:

- 실패한 리소스를 확인합니다.
- 해당 리소스를 수동으로 삭제합니다.
- 스택을 다시 삭제합니다 (실패한 리소스 건너뛰기 옵션 선택).

> [!TROUBLESHOOTING]
> | 증상 | 원인 | 해결 방법 |
> |------|------|-----------|
> | `DELETE_FAILED` (Security Group) | 다른 리소스가 SG를 참조 중 | 참조하는 리소스(EC2, RDS 등) 먼저 삭제 |
> | `DELETE_FAILED` (S3 Bucket) | 버킷이 비어있지 않음 | `aws s3 rm s3://<BUCKET_NAME> --recursive` 후 재시도 |
> | `DELETE_FAILED` (VPC) | ENI 또는 서브넷에 리소스 잔존 | Network Interfaces 확인 후 수동 삭제 |
> | 스택 삭제 재시도 시 같은 에러 | 수동 삭제 미완료 | "Retain" 옵션으로 해당 리소스 건너뛰고 삭제 후 수동 정리 |

---

### 단계 15: ACM 인증서 삭제

📍 **실행 위치: AWS 콘솔 (Certificate Manager)**

137. 우측 상단 리전을 **US East (N. Virginia) us-east-1**로 변경합니다.
138. 상단 검색창에 `Certificate Manager`를 입력하고 선택합니다.
139. 사용하지 않는 인증서를 선택합니다.
140. [[Delete]] 버튼을 클릭합니다.
141. 확인 팝업에서 [[Delete]]를 클릭합니다.
142. 리전을 **ap-northeast-2 (서울)** 로 돌아와서 같은 작업을 반복합니다.

> [!NOTE]
> CloudFront나 ALB에 연결된 인증서는 삭제할 수 없습니다.  
> 먼저 해당 서비스에서 인증서 연결을 해제한 후 삭제하세요.

---

### 단계 16: Route 53 레코드 삭제 (도메인 설정한 경우)

📍 **실행 위치: AWS 콘솔 (Route 53)**

143. 상단 검색창에 `Route 53`을 입력하고 **Route 53** 서비스를 선택합니다.
144. 왼쪽 메뉴에서 **Hosted zones**를 클릭합니다.
145. 본인의 도메인을 클릭합니다.
146. 생성한 A 레코드 (CloudFront Alias, ALB Alias)를 선택합니다.
147. [[Delete records]] 버튼을 클릭합니다.
148. 확인 팝업에서 [[Delete]]를 클릭합니다.

> [!TIP]
> Hosted zone 자체는 삭제하지 않아도 됩니다 (월 $0.50).  
> 도메인을 계속 사용할 예정이라면 유지하세요.  
> NS, SOA 레코드는 삭제하지 마세요 (도메인 동작에 필수).

---

### 단계 17: IAM 정리

📍 **실행 위치: AWS 콘솔 (IAM)**

149. 상단 검색창에 `IAM`을 입력하고 **IAM** 서비스를 선택합니다.
150. 왼쪽 메뉴에서 **Users**를 클릭합니다.
151. `github-actions-frontend`를 선택합니다.
152. [[Delete]] 버튼을 클릭합니다.
153. 확인 입력란에 사용자 이름을 입력하고 [[Delete]]를 클릭합니다.
154. `github-actions-backend`도 같은 방식으로 삭제합니다.
155. 왼쪽 메뉴에서 **Roles**를 클릭합니다.
156. 검색창에 `my-3tier-app-ec2-role` (또는 `ec2-starter-role`)을 입력합니다.
157. 해당 Role을 선택합니다.
158. [[Delete]] 버튼을 클릭합니다.
159. 확인 입력란에 Role 이름을 입력하고 [[Delete]]를 클릭합니다.
160. 왼쪽 메뉴에서 **Policies**를 클릭합니다.
161. 커스텀 정책이 있다면 선택합니다.
162. **Actions** → [[Delete]]를 클릭합니다.
163. 확인 팝업에서 [[Delete]]를 클릭합니다.

> [!TIP]
> IAM 리소스는 무료이므로 급하게 삭제하지 않아도 됩니다.  
> 하지만 보안을 위해 사용하지 않는 Access Key와 사용자는 삭제하는 것이 좋습니다.
>
> **GitHub Secrets 정리:**  
> IAM 사용자를 삭제했다면 GitHub 리포지토리의 Secrets도 함께 정리하세요:
>
> - 리포지토리 → Settings → Secrets and variables → Actions
> - `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` 등 삭제한 IAM 사용자의 키를 제거합니다.

---

### 단계 18: 최종 확인

모든 리소스가 정리되었는지 최종 확인합니다.

#### Tag Editor로 최종 확인

📍 **실행 위치: AWS 콘솔**

164. 상단 검색창에 `Resource Groups & Tag Editor`를 입력하고 선택합니다.
165. 왼쪽 메뉴에서 **Tag Editor**를 선택합니다.
166. Tag key `Step`, Tag value `step8`로 검색합니다.
167. 검색 결과에 리소스가 없으면 정리 완료입니다.

> [!TIP]
> `step1` ~ `step7`로도 검색하여 이전 Step에서 남긴 리소스가 있는지 확인하세요.

#### 비용 발생 리소스 확인

168. 상단 검색창에 `Billing`을 입력하고 **Billing and Cost Management** 서비스를 선택합니다.
169. 왼쪽 메뉴에서 **Bills** 또는 **Cost Explorer**를 클릭하여 현재 비용을 확인합니다.
170. 다음 서비스에 비용이 0인지 확인합니다:

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
> AWS 리소스는 리전별로 존재합니다.  
> 실습에 사용한 모든 리전을 확인하세요:
>
> - **ap-northeast-2** (서울): 대부분의 리소스
> - **us-east-1** (버지니아): CloudFront용 ACM 인증서

#### AWS CLI로 빠른 확인

📍 **실행 위치: AWS CloudShell 또는 로컬 터미널 (AWS CLI 설치 필요)**

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

| #   | 리소스                         | 삭제 완료 | 월 비용 (방치 시) | 크레딧 차감 |
| --- | ------------------------------ | --------- | ----------------- | ----------- |
| 1   | Auto Scaling Group             | ☐         | EC2 비용 발생     | ✅          |
| 2   | ALB + Target Group             | ☐         | **~$18/월**       | ✅          |
| 3   | NAT Gateway                    | ☐         | **~$42/월**       | ✅          |
| 4   | Elastic IP                     | ☐         | ~$3.6/월          | ✅          |
| 5   | RDS Instance                   | ☐         | **~$14/월**       | ✅          |
| 6   | EC2 Instances                  | ☐         | ~$9/월            | ✅          |
| 7   | Amazon CloudFront Distribution | ☐         | ~$1 미만          | ✅          |
| 8   | S3 Buckets                     | ☐         | ~$0.01            | ✅          |
| 9   | SSM Parameters                 | ☐         | 무료              | -           |
| 10  | Security Groups                | ☐         | 무료              | -           |
| 11  | DB Subnet Group                | ☐         | 무료              | -           |
| 12  | VPC + Subnets                  | ☐         | 무료              | -           |
| 13  | DynamoDB Tables                | ☐         | 무료 (On-demand)  | -           |
| 14  | CloudFormation Stacks          | ☐         | 무료              | -           |
| 15  | ACM Certificates               | ☐         | 무료              | -           |
| 16  | Route 53 Records               | ☐         | $0.50/월 (Zone)   | ✅          |
| 17  | IAM Users/Roles                | ☐         | 무료              | -           |
| 18  | 최종 비용 확인                 | ☐         | -                 | -           |

> [!CONCEPT] 리소스 정리의 중요성
>
> AWS는 사용한 만큼 비용을 청구합니다. 실습이 끝난 후 리소스를 방치하면 예상치 못한 비용이 발생할 수 있습니다.
>
> 특히 비용이 큰 리소스 (서울 리전 기준, 참고용):
>
> | 리소스            | 시간당  | 1일 방치 | 1주 방치 | 1개월 방치 |
> | ----------------- | ------- | -------- | -------- | ---------- |
> | NAT Gateway       | ~$0.059 | ~$1.42   | ~$9.94   | **~$42**   |
> | ALB               | ~$0.025 | ~$0.60   | ~$4.20   | **~$18**   |
> | RDS (db.t3.micro) | ~$0.02  | ~$0.48   | ~$3.36   | **~$14**   |
> | EC2 (t3.micro)    | ~$0.013 | ~$0.31   | ~$2.18   | **~$9**    |
> | Elastic IP        | $0.005  | $0.12    | $0.84    | $3.60      |
>
> ※ 금액은 참고용이며, 리전·환율·AWS 정책 변경에 따라 달라질 수 있습니다.
>
> 💡 **실습 후 반드시 정리하는 습관을 들이세요!**  
> AWS Billing → Bills에서 일별 비용을 확인할 수 있습니다.  
> Budget Alert를 설정하면 예상 비용 초과 시 이메일 알림을 받을 수 있습니다.

✅ **태스크 완료** — 모든 AWS 리소스를 체계적으로 정리했습니다.

---

# 🎉 Step 8 완료 — 축하합니다!

Step 0~8을 통해 다음을 달성했습니다:

- ✅ AWS 기본 서비스 (VPC, EC2, S3, RDS, CloudFront, ALB) 활용
- ✅ 3-Tier 웹 아키텍처 설계 및 구축
- ✅ 프론트엔드/백엔드 분리 배포
- ✅ CI/CD 파이프라인 구축
- ✅ 보안 (Security Groups, SSM, HTTPS) 적용
- ✅ 비용 관리 및 리소스 정리

이제 여러분은 AWS에서 실제 웹 서비스를 구축하고 운영할 수 있는 기본 역량을 갖추었습니다! 🚀

✅ **실습 종료**: 모든 리소스가 정리되었습니다.

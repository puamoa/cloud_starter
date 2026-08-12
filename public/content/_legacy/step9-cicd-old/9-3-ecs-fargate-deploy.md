---
title: 'GitHub Actions → ECR → ECS Fargate 배포'
week: 9
session: 3
awsServices:
  - Amazon ECS
  - AWS Fargate
  - Amazon ECR
  - Elastic Load Balancing
learningObjectives:
  - Amazon ECS 클러스터와 Task Definition을 생성할 수 있습니다.
  - AWS Fargate로 서버리스 컨테이너를 실행할 수 있습니다.
  - Amazon ECS Service를 생성하여 ALB와 연동할 수 있습니다.
  - GitHub Actions에서 Amazon ECS 자동 배포 파이프라인을 구축할 수 있습니다.
prerequisites:
  - Step 9-2 완료 (Amazon ECR에 이미지 Push 완료)
  - Step 8 인프라 유지 중 (VPC, ALB, Amazon RDS)
  - AWS CLI 설정 완료
estimatedCost: 비용 발생 (Fargate vCPU/메모리 시간당 과금, 실습 후 반드시 삭제)
---

이 실습에서는 Amazon ECR에 저장된 Docker 이미지를 Amazon ECS Fargate에 배포합니다.  
서버를 직접 관리하지 않는 **서버리스 컨테이너** 환경에서 애플리케이션을 실행하고,  
ALB를 통해 트래픽을 분산합니다. GitHub Actions로 전체 배포를 자동화합니다.

> [!CONCEPT] Step 9-2 → Step 9-3: 무엇이 바뀌는가?
> 9-2에서는 Docker 이미지를 Amazon ECR에 Push했습니다. 이제 그 이미지를 **실행**합니다:
>
> | 항목                 | Step 8-3 / 9-1 (EC2)        | Step 9-3 (ECS Fargate)           |
> | -------------------- | --------------------------- | -------------------------------- |
> | 서버 관리            | OS 패치, Java 설치, systemd | 없음 (AWS 관리)                  |
> | 배포 방식            | JAR SCP + 재시작            | 이미지 태그 변경 → 롤링 업데이트 |
> | 스케일링             | ASG 설정 필요               | desired count만 변경             |
> | 롤백                 | 이전 JAR 수동 복원          | 이전 Task Definition 자동 롤백   |
> | Health Check 실패 시 | 수동 확인·조치              | 자동으로 이전 버전 유지          |
>
> **Step 8의 인프라(VPC, ALB, Amazon RDS)를 그대로 사용**합니다.  
> EC2 대신 Fargate가 컨테이너를 실행하는 것만 바뀝니다.

> [!NOTE]
> Step 8에서 생성한 VPC, ALB, Amazon RDS를 재사용합니다.  
> AWS CloudFormation 스택(`step8-network`, `step8-backend`)이 유지 중인지 확인하세요.

### Step 9 전체 구성

| 세션                | 주제                          | 핵심 리소스                  |
| ------------------- | ----------------------------- | ---------------------------- |
| 9-0                 | CI/CD + 컨테이너 이론         | 개념 학습                    |
| 9-1                 | GitHub Actions → EC2 배포     | GitHub Actions, Amazon EC2   |
| 9-2                 | Docker 빌드 + Amazon ECR Push | Docker, Amazon ECR           |
| **9-3 (이번 실습)** | ECR → ECS Fargate 배포        | Amazon ECS, AWS Fargate, ALB |

### 실습 흐름

```
[ECS 개념] → [Task Definition] → [ECS 클러스터] → [Service 생성] → [ALB 연동] → [GitHub Actions 자동화]
```

---

## 태스크 1: Amazon ECS 개념 이해

> [!CONCEPT] Amazon ECS + Fargate란?
> **Amazon ECS**(Elastic Container Service)는 Docker 컨테이너를 실행·관리하는 AWS 서비스입니다.  
> **AWS Fargate**는 Amazon ECS의 서버리스 실행 모드로, Amazon EC2 인스턴스를 관리할 필요 없이 컨테이너를 실행합니다.
>
> - Amazon EC2에 Docker를 설치해서 직접 운영하는 것 vs 택시 호출하듯 "이 컨테이너 실행해줘"하고 맡기는 것
> - Fargate는 택시입니다. 목적지(컨테이너)만 지정하면 알아서 태워다 줍니다. 차량(서버) 관리는 AWS가 합니다.

### Amazon ECS 핵심 구성 요소

| 구성 요소           | 역할                                                     | 비유                  |
| ------------------- | -------------------------------------------------------- | --------------------- |
| **Cluster**         | 컨테이너를 실행하는 논리적 그룹                          | 택시 회사             |
| **Task Definition** | 컨테이너 실행 설정 (이미지, CPU, 메모리, 포트 등)        | 택시 호출 시 요구사항 |
| **Task**            | Task Definition으로 실행된 컨테이너 인스턴스             | 운행 중인 택시 1대    |
| **Service**         | Task를 지정된 수만큼 유지·관리 (Auto Scaling, 롤링 배포) | 배차 매니저           |

### Amazon EC2 vs AWS Fargate

| 항목            | EC2 (직접 관리)                    | Fargate (서버리스)           |
| --------------- | ---------------------------------- | ---------------------------- |
| **서버 관리**   | OS 패치, 보안, 모니터링 직접       | AWS가 전부 관리              |
| **스케일링**    | ASG 설정 필요                      | Service desired count만 변경 |
| **비용**        | 인스턴스 시간당 과금               | 태스크 vCPU/메모리 초당 과금 |
| **시작 시간**   | AMI 부팅 (30초~1분)                | 컨테이너 시작 (10~30초)      |
| **적합한 경우** | 항상 실행, GPU 필요, 특수 네트워크 | 가변적 워크로드, 빠른 배포   |

### 전체 아키텍처

```
GitHub Push → GitHub Actions → Docker Build → ECR Push
                                                   │
                                                   ▼
사용자 → ALB → ECS Service (Fargate) → Container ← ECR Image
                    │                      │
                    │                      ▼
                    └── Health Check     Amazon RDS
```

---

## 태스크 2: Task Definition 생성

Task Definition은 컨테이너의 "실행 설정서"입니다.  
어떤 이미지를, 얼마의 CPU/메모리로, 어떤 포트를 열어서 실행할지 정의합니다.

### ECS Task Execution Role 확인

1. AWS Console에서 상단 검색창에 `IAM`을 입력하고 선택합니다.
2. 왼쪽 메뉴에서 **Roles**를 클릭합니다.
3. 검색창에 `ecsTaskExecutionRole`을 입력합니다.
4. 역할이 존재하면 그대로 사용합니다. 없으면 Amazon ECS가 Task Definition 생성 시 자동으로 만들어줍니다.

> [!NOTE]
> `ecsTaskExecutionRole`은 Amazon ECS가 Amazon ECR에서 이미지를 Pull하고 CloudWatch에 로그를 전송하는 데 사용하는 IAM Role입니다.  
> 첫 번째 Task Definition 생성 시 자동 생성됩니다.

> [!TIP]
> **Task Execution Role vs Task Role:**
>
> | Role               | 용도                                       | 예시                          |
> | ------------------ | ------------------------------------------ | ----------------------------- |
> | **Execution Role** | ECS 인프라가 사용 (이미지 Pull, 로그 전송) | ECR Pull, CloudWatch Logs     |
> | **Task Role**      | 컨테이너 앱 코드가 사용 (AWS 서비스 호출)  | S3 업로드, SSM 조회, SQS 전송 |
>
> 앱에서 AWS SDK를 사용한다면 Task Role도 별도 설정해야 합니다.  
> 이 실습에서는 DB 접속만 하므로 Task Role은 불필요합니다.

### Task Definition 생성

5. 상단 검색창에 `ECS`를 입력하고 **Elastic Container Service**를 선택합니다.
6. 왼쪽 메뉴에서 **Task definitions**를 클릭합니다.
7. [[Create new task definition]]을 클릭합니다.

### Task Definition 설정

8. **Task definition family**: `my-3tier-app-task`
9. **Launch type**: `AWS Fargate` 선택
10. **Operating system/Architecture**: `Linux/X86_64`
11. **Task size**:
    - **CPU**: `.25 vCPU` (0.25 vCPU)
    - **Memory**: `.5 GB` (512MB)

> [!TIP]
> 실습에서는 최소 사양(.25 vCPU / .5 GB)으로 설정합니다.  
> Spring Boot는 메모리를 많이 사용하므로, 실제 운영에서는 `.5 vCPU / 1 GB` 이상을 권장합니다.  
> 512MB에서 OOM(Out of Memory)이 발생하면 1GB로 변경하세요.

12. **Task execution role**: `ecsTaskExecutionRole` (자동 선택 또는 Create new role)

### 컨테이너 설정

13. **Container - 1** 섹션에서:
    - **Name**: `my-3tier-app`
    - **Image URI**: `123456789012.dkr.ecr.ap-northeast-2.amazonaws.com/my-3tier-app:latest`
    - **Essential container**: Yes
    - **Port mappings**:
      - Container port: `8080`
      - Protocol: `TCP`
      - App protocol: `HTTP`

> [!NOTE]
> Image URI는 Step 9-2에서 생성한 Amazon ECR 리포지토리 URI입니다.  
> AWS Console → Amazon ECR → `my-3tier-app` → URI 복사

14. **Environment variables** 섹션에서 [[Add environment variable]]을 클릭합니다:

| Key                      | Value type | Value                   |
| ------------------------ | ---------- | ----------------------- |
| `SPRING_PROFILES_ACTIVE` | Value      | `prod`                  |
| `DB_HOST`                | Value      | (Amazon RDS 엔드포인트) |
| `DB_PORT`                | Value      | `3306`                  |
| `DB_NAME`                | Value      | `mydb`                  |
| `DB_USERNAME`            | Value      | `admin`                 |
| `DB_PASSWORD`            | Value      | (Amazon RDS 비밀번호)   |

> [!WARNING]
> 환경변수에 비밀번호를 직접 입력하는 것은 실습용입니다.  
> 프로덕션에서는 **AWS Secrets Manager**를 사용하여 `valueFrom` 으로 참조합니다.

15. **Log collection** 섹션:
    - ✅ `Use log collection` 체크
    - **Log driver**: `awslogs` (기본값)
    - 자동으로 CloudWatch Logs에 로그가 전송됩니다.

16. [[Create]]를 클릭합니다.

✅ **태스크 완료** — Task Definition을 생성했습니다.

---

## 태스크 3: Amazon ECS 클러스터 생성

### 클러스터 생성

17. Amazon ECS 콘솔 → 왼쪽 메뉴 **Clusters** → [[Create cluster]]를 클릭합니다.
18. **Cluster name**: `my-3tier-app-cluster`
19. **Infrastructure**: **AWS Fargate (serverless)** ✅ 체크 (기본값)
    - Amazon EC2 instances는 체크하지 않습니다.
20. [[Create]]를 클릭합니다.

> [!NOTE]
> Fargate 클러스터는 생성 즉시 완료됩니다 (Amazon EC2 기반과 달리 인스턴스를 프로비저닝하지 않음).  
> 클러스터 자체는 논리적 그룹일 뿐이며, Task를 실행할 때 비로소 컴퓨팅 리소스가 할당됩니다.

✅ **태스크 완료** — Amazon ECS Fargate 클러스터를 생성했습니다.

---

## 태스크 4: Amazon ECS Service 생성 (ALB 연동)

Service는 Task를 지정된 수만큼 항상 유지하고, ALB와 연동하여 트래픽을 분산합니다.

### Service 생성

21. Amazon ECS 콘솔의 왼쪽 메뉴에서 **Clusters**를 클릭합니다.
22. `my-3tier-app-cluster`를 클릭합니다.
23. **Services** 탭을 클릭합니다.
24. [[Create]]를 클릭합니다.

### Deployment configuration

23. **Family**: `my-3tier-app-task` 선택
24. **Service name**: `my-3tier-app-service`
25. **Desired tasks**: `2` (2개의 Task를 실행하여 고가용성 확보)

### Networking

26. **VPC**: Step 8에서 생성한 VPC 선택 (`my-3tier-app-vpc`)
27. **Subnets**: **Private Subnet 1 + 2** 선택
    - Fargate Task는 Private Subnet에 배치합니다 (ALB가 앞단에서 트래픽을 받음).
28. **Security group**: Step 8에서 생성한 EC2 Security Group 선택 (`my-3tier-app-ec2-sg`)
    - ALB에서 8080 포트만 허용하는 SG입니다.

> [!WARNING]
> Fargate Task를 Private Subnet에 배치하면 NAT Gateway가 필요합니다 (Amazon ECR 이미지 Pull, CloudWatch 로그 전송).  
> Step 8 Network 스택에서 `CreateNATGateway=Yes`로 설정한 경우 정상 동작합니다.

### Load balancing

29. **Load balancer type**: `Application Load Balancer` 선택
30. **Use an existing load balancer**: Step 8에서 생성한 ALB 선택 (`my-3tier-app-alb`)
31. **Use an existing listener**: `80:HTTP` 선택
32. **Use an existing target group**: Step 8에서 생성한 Target Group 선택 (`my-3tier-app-tg`)

> [!TIP]
> Step 8에서 생성한 ALB와 Target Group을 그대로 재사용합니다.  
> Target Group의 target type이 `ip`로 되어 있어야 Fargate와 호환됩니다.  
> Step 8의 Backend 스택에서 `TargetType: instance`로 설정했다면 `ip`로 변경이 필요합니다.

33. **Health check grace period**: `60` seconds
    - 컨테이너가 완전히 시작될 때까지 Health Check 실패를 무시하는 시간입니다.

> [!WARNING]
> **Target Group의 Target type이 `ip`여야 합니다.**  
> AWS Fargate는 동적 IP를 사용하므로 Target Group의 target type이 `ip`여야 합니다.  
> Step 8 Backend 스택의 Target Group이 `instance` 타입이라면,  
> 새로운 Target Group을 `ip` 타입으로 생성하거나 Backend 스택을 수정해야 합니다.

> [!TIP]
> **Fargate 비용 계산 예시 (서울 리전):**
>
> - 0.25 vCPU × $0.04048/시간 + 0.5GB × $0.00442/시간 = 약 $0.012/시간 (Task 1개)
> - Task 2개 × 24시간 × 30일 = 약 $17.3/월
> - 실습 후 바로 삭제하면 수 시간분 비용만 발생합니다 (수십 원 수준)

34. [[Create]]를 클릭합니다.
35. Service 생성 후 **Tasks** 탭에서 2개의 Task가 `RUNNING` 상태가 될 때까지 기다립니다 (1~2분).

> [!TROUBLESHOOTING]
> | 증상 | 원인 | 해결 방법 |
> |------|------|-----------|
> | Task가 `STOPPED` 즉시 종료 | OOM 또는 앱 에러 | CloudWatch Logs에서 로그 확인, 메모리 증가 |
> | Task가 `PROVISIONING`에서 멈춤 | NAT Gateway 없음 (ECR Pull 불가) | Network 스택에서 NAT 확인 |
> | `CannotPullContainerError` | ECR 이미지 없음 또는 권한 부족 | ECR URI 확인, Task Execution Role 권한 확인 |
> | Health Check 실패 | 앱 시작 시간 > grace period | grace period를 120초로 증가 |

✅ **태스크 완료** — Amazon ECS Service를 생성하고 ALB와 연동했습니다.

---

## 태스크 5: 동작 확인

### ALB DNS로 접속

36. 상단 검색창에 `EC2`를 입력하고 **EC2** 서비스를 선택합니다.
37. 왼쪽 메뉴에서 **Load Balancers**를 클릭합니다.
38. ALB(`my-3tier-app-alb`)의 **DNS name**을 복사합니다.
39. 브라우저에서 `http://<ALB DNS Name>/actuator/health`에 접속합니다.

> [!OUTPUT]
>
> ```json
> { "status": "UP" }
> ```

38. API 엔드포인트도 테스트합니다:

```bash
curl http://<ALB DNS Name>/api/hello
```

### CloudWatch Logs 확인

39. 상단 검색창에 `CloudWatch`를 입력하고 **CloudWatch** 서비스를 선택합니다.
40. 왼쪽 메뉴에서 **Log groups**를 클릭합니다.
41. `/ecs/my-3tier-app-task` 로그 그룹을 클릭합니다.
42. 각 Task의 로그 스트림에서 Spring Boot 시작 로그를 확인합니다.

✅ **태스크 완료** — Amazon ECS Fargate에서 애플리케이션이 정상 동작하는 것을 확인했습니다.

---

## 태스크 6: GitHub Actions로 ECS 자동 배포

코드 Push → Docker 빌드 → Amazon ECR Push → Amazon ECS Service 업데이트가 자동으로 실행되는 파이프라인을 구축합니다.

### 추가 GitHub Secrets

42. GitHub 리포지토리 페이지에서 **Settings** 탭을 클릭합니다.
43. 왼쪽 메뉴에서 **Secrets and variables** → **Actions**를 클릭합니다.
44. [[New repository secret]]을 클릭하여 다음 시크릿을 추가합니다:

| Name                  | Value                  |
| --------------------- | ---------------------- |
| `ECS_CLUSTER`         | `my-3tier-app-cluster` |
| `ECS_SERVICE`         | `my-3tier-app-service` |
| `ECS_TASK_DEFINITION` | `my-3tier-app-task`    |

### GitHub Actions 워크플로우 업데이트

43. `.github/workflows/docker-ecr.yml`을 다음으로 업데이트합니다:

```yaml
name: Build, Push, and Deploy to ECS

on:
  push:
    branches: [main]

env:
  ECR_REPOSITORY: my-3tier-app
  IMAGE_TAG: ${{ github.sha }}

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ secrets.AWS_REGION }}

      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build, tag, and push image
        id: build-image
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
        run: |
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG .
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
          echo "image=$ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG" >> $GITHUB_OUTPUT

      # Task Definition에서 이미지 URI를 새 버전으로 교체
      - name: Download current task definition
        run: |
          aws ecs describe-task-definition \
            --task-definition ${{ secrets.ECS_TASK_DEFINITION }} \
            --query taskDefinition \
            > task-definition.json

      - name: Update image in task definition
        id: task-def
        uses: aws-actions/amazon-ecs-render-task-definition@v1
        with:
          task-definition: task-definition.json
          container-name: my-3tier-app
          image: ${{ steps.build-image.outputs.image }}

      # ECS Service에 새 Task Definition 배포 (롤링 업데이트)
      - name: Deploy to Amazon ECS
        uses: aws-actions/amazon-ecs-deploy-task-definition@v2
        with:
          task-definition: ${{ steps.task-def.outputs.task-definition }}
          service: ${{ secrets.ECS_SERVICE }}
          cluster: ${{ secrets.ECS_CLUSTER }}
          wait-for-service-stability: true
```

> [!CONCEPT] 롤링 업데이트 배포 방식
> `wait-for-service-stability: true`로 설정하면:
>
> - 새 Task가 시작되고 Health Check를 통과할 때까지 대기합니다.
> - 새 Task가 정상이면 이전 Task를 종료합니다.
> - 배포 중에도 서비스가 중단되지 않습니다 (Zero-downtime deployment).
> - 새 Task가 Health Check에 실패하면 자동으로 롤백됩니다.

### 배포 테스트

44. 코드를 수정하고 Push합니다:

```bash
git add .
git commit -m "feat: test ECS deployment"
git push origin main
```

45. GitHub Actions → 워크플로우가 성공하면 Amazon ECS 콘솔에서:
    - **Events** 탭에서 롤링 업데이트 이력 확인
    - **Tasks** 탭에서 새 Task가 `RUNNING` 상태 확인

✅ **태스크 완료** — GitHub Actions로 Amazon ECS Fargate 자동 배포 파이프라인을 구축했습니다.

---

## 마무리

이 실습에서 다음을 성공적으로 수행했습니다:

- Amazon ECS 클러스터와 Task Definition을 생성했습니다.
- AWS Fargate로 서버리스 컨테이너를 실행하고 ALB와 연동했습니다.
- CloudWatch Logs로 컨테이너 로그를 확인했습니다.
- GitHub Actions에서 빌드 → Amazon ECR Push → Amazon ECS 배포 전체 파이프라인을 자동화했습니다.

> [!TIP]
> **EC2 vs Fargate 비교 정리:**
>
> | 항목      | Step 9-1 (EC2 직접 배포)        | Step 9-3 (Fargate)          |
> | --------- | ------------------------------- | --------------------------- |
> | 서버 관리 | SSH 접속, 패키지 설치, 모니터링 | 없음 (AWS 관리)             |
> | 배포 방식 | JAR 복사 + 재시작               | 이미지 교체 (롤링 업데이트) |
> | 롤백      | 이전 JAR 수동 복원              | 이전 Task Definition 자동   |
> | 스케일링  | ASG 설정 필요                   | Service desired count 변경  |

---

# 🗑️ 리소스 정리

> [!WARNING]
> AWS Fargate는 Task가 실행 중인 동안 vCPU/메모리에 대해 과금됩니다.  
> 실습 후 반드시 Service를 삭제하세요.
>
> | 리소스       | 과금 기준             | 비고                           |
> | ------------ | --------------------- | ------------------------------ |
> | Fargate Task | vCPU/메모리 초당 과금 | Service 삭제 시 Task 자동 종료 |
> | Amazon ECR   | 스토리지 GB당 과금    | 500MB/월 프리티어              |
> | ALB          | 시간당 + LCU          | Step 8에서 관리                |
> | NAT Gateway  | 시간당 + 데이터       | Step 8에서 관리                |

### 삭제 순서

1. 상단 검색창에 `ECS`를 입력하고 **Elastic Container Service**를 선택합니다.
2. 왼쪽 메뉴에서 **Clusters**를 클릭합니다.
3. `my-3tier-app-cluster`를 클릭합니다.
4. **Services** 탭을 클릭합니다.
5. `my-3tier-app-service`를 선택합니다.
6. [[Delete service]]를 클릭합니다.
7. 확인란에 `delete`를 입력하고 [[Delete]]를 클릭합니다.
8. **Tasks** 탭에서 모든 Task가 `STOPPED`되는 것을 확인합니다.
9. 왼쪽 메뉴에서 **Clusters**로 돌아갑니다.
10. `my-3tier-app-cluster`를 선택합니다.
11. [[Delete cluster]]를 클릭합니다.
12. 확인란에 클러스터 이름을 입력하고 [[Delete]]를 클릭합니다.
13. 왼쪽 메뉴에서 **Task definitions**를 클릭합니다.
14. `my-3tier-app-task`를 클릭합니다.
15. 모든 리비전을 체크합니다.
16. **Actions** 드롭다운을 클릭하고 **Deregister**를 선택합니다.

> [!NOTE]
> Amazon ECR 리포지토리는 프리티어 500MB 내이므로 유지해도 비용이 발생하지 않습니다.  
> 완전 정리하려면 Amazon ECR → `my-3tier-app` → [[Delete]]

> [!NOTE]
> Step 8 인프라(VPC, ALB, Amazon RDS)는 이 세션에서 삭제하지 않습니다.  
> Step 8-4의 리소스 정리를 참고하세요.

✅ **실습 종료**: Amazon ECS Fargate 리소스가 정리되었습니다.

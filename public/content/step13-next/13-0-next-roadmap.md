---
title: '웹 개발자의 AWS 성장 로드맵'
week: 13
session: 0
type: theory
learningObjectives:
  - 컨테이너(Docker, Amazon ECS, Amazon EKS)의 개념과 Amazon EC2 배포와의 차이를 이해할 수 있습니다.
  - CI/CD 파이프라인을 컨테이너 기반으로 확장하는 전략을 설명할 수 있습니다.
  - IaC(Infrastructure as Code) 도구의 종류와 선택 기준을 이해할 수 있습니다.
  - 모니터링과 관측성(Observability)의 핵심 개념을 설명할 수 있습니다.
  - 서버리스 심화 패턴과 이벤트 드리븐 아키텍처를 이해할 수 있습니다.
  - 프로덕션 보안 강화를 위한 AWS 서비스와 전략을 설명할 수 있습니다.
  - 각 확장 영역의 예상 비용과 주의사항을 파악할 수 있습니다.
---

# 웹 개발자의 AWS 성장 로드맵

이 문서는 Step 0~12의 기초 실습을 마친 후, 실무 수준으로 확장하기 위한 **이론과 설계 가이드**입니다.  
각 영역의 핵심 개념, AWS 서비스, 아키텍처 설계, 비용 주의사항을 정리합니다.

> [!WARNING]
> **비용 주의**: 이 문서에서 소개하는 서비스들은 대부분 **프리티어 범위를 초과**합니다.  
> 설계에 따라 비용이 상이하므로, 실습 시 반드시 해당 서비스의 요금 페이지를 사전에 확인하고, 테스트 후 즉시 리소스를 삭제하세요.
>
> **비용은 사용하는 서비스 조합, 리전, 실행 시간, 트래픽 등에 따라 크게 달라집니다.**  
> 반드시 [AWS 요금 페이지](https://aws.amazon.com/pricing/)에서 최신 가격을 확인하세요.

### 현재까지 학습한 아키텍처

```
┌─────────────────────────────────────────────────────────┐
│  현재 수준 (Step 0~12 완료)                             │
│                                                         │
│  [Vue.js] → CloudFront → S3                             │
│  [Spring] → EC2 (직접 배포) → RDS                       │
│  [CI/CD]  → GitHub Actions → EC2 SSH 배포               │
│  [보안]   → Parameter Store / Secrets Manager           │
│  [서버리스] → Lambda + API Gateway + DynamoDB           │
└─────────────────────────────────────────────────────────┘
```

### 확장 로드맵 전체 흐름

```
┌─────────────────────────────────────────────────────────┐
│  확장 방향 (이 문서에서 다루는 내용)                    │
│                                                         │
│  1. 컨테이너화     EC2 직접 배포 → Docker → ECS/EKS     │
│  2. CI/CD 고도화   GitHub Actions → CodePipeline/ArgoCD │
│  3. IaC            콘솔 수동 → CDK / Terraform          │
│  4. 모니터링       CloudWatch 기본 → X-Ray, 알람        │
│  5. 서버리스 심화  Lambda 단일 → Step Functions, SAM    │
│  6. 보안 심화      IAM 기본 → WAF, Shield, GuardDuty    │
└─────────────────────────────────────────────────────────┘
```

---

## 1. 컨테이너화 (Docker → ECS → EKS)

> [!CONCEPT] 왜 컨테이너인가?
> 현재 Amazon EC2에 직접 Java/Nginx를 설치하고 배포하는 방식은 **환경 차이 문제**(내 PC에서는 되는데 서버에서 안 됨)와 **확장의 어려움**이 있습니다.  
> 컨테이너는 애플리케이션과 실행 환경을 하나로 패키징하여 어디서나 동일하게 실행되는 것을 보장합니다.

### 핵심 용어

| 용어 | 설명 | 현재 실습과의 관계 |
| ---- | ---- | ------------------ |
| **Docker** | 컨테이너를 빌드·실행하는 플랫폼 | Amazon EC2에 직접 설치하던 것을 이미지로 패키징 |
| **Dockerfile** | 컨테이너 이미지 빌드 명세서 | build.gradle + 배포 스크립트를 대체 |
| **이미지 (Image)** | 실행 환경이 포함된 불변 패키지 | JAR/WAR + JDK + 설정을 하나로 |
| **컨테이너 (Container)** | 이미지의 실행 인스턴스 | Amazon EC2 내 프로세스와 유사하지만 격리됨 |
| **Amazon ECR** | AWS 관리형 컨테이너 이미지 저장소 | Docker Hub의 AWS 버전 |
| **Amazon ECS** | AWS 관리형 컨테이너 오케스트레이션 | Amazon EC2 위에 컨테이너를 자동 배치·관리 |
| **AWS Fargate** | 서버리스 컨테이너 실행 엔진 | Amazon EC2 관리 없이 컨테이너만 실행 |
| **Amazon EKS** | AWS 관리형 Kubernetes | 대규모 MSA, 멀티 클라우드 표준 |
| **Task Definition** | Amazon ECS에서 컨테이너의 실행 사양 정의 | CPU, 메모리, 포트, 환경 변수 등 |
| **Service** | Task를 지속적으로 유지하는 Amazon ECS 단위 | Auto Scaling, ALB 연동 |

### 현재 vs 컨테이너 비교

| 항목 | 현재 (Amazon EC2 직접 배포) | 컨테이너 (Amazon ECS/Fargate) |
| ---- | -------------------- | ---------------------- |
| 환경 설정 | SSH 접속 → JDK 설치 → 설정 | Dockerfile에 모두 정의 |
| 배포 | SCP → 재시작 스크립트 | 새 이미지 Push → 롤링 업데이트 |
| 확장 | AMI 복제 → ASG | Task 수 증가 (즉시) |
| 환경 일관성 | OS 버전·패키지 차이 가능 | 이미지가 동일하면 어디서든 동일 |
| 롤백 | 이전 JAR 수동 복원 | 이전 이미지 태그로 즉시 롤백 |

### 아키텍처 설계

```
┌─────────────────────────────────────────────────────────┐
│  컨테이너 기반 배포 아키텍처                            │
│                                                         │
│  개발자 PC                                              │
│    └── Dockerfile → docker build → docker push          │
│                                         │               │
│                                         ▼               │
│                                    Amazon ECR           │
│                                    (이미지 저장소)      │
│                                         │               │
│                                         ▼               │
│  ┌─── Amazon ECS (Fargate) ─────────────────────┐       │
│  │                                              │       │
│  │  Task 1 (Spring)    Task 2 (Spring)          │       │
│  │  ┌──────────────┐   ┌──────────────┐         │       │
│  │  │ Container    │   │ Container    │         │       │
│  │  │ JDK 17 + JAR│   │ JDK 17 + JAR│           │       │
│  │  └──────────────┘   └──────────────┘         │       │
│  └──────────────────────────────────────────────┘       │
│                          │                              │
│                          ▼                              │
│                    ALB (로드밸런서)                     │
│                          │                              │
│                          ▼                              │
│                    Amazon RDS                           │
└─────────────────────────────────────────────────────────┘
```

### ECS vs EKS 선택 기준

| 기준 | Amazon ECS (Fargate) | Amazon EKS (Kubernetes) |
| ---- | ------------- | ---------------- |
| 복잡도 | 낮음 (AWS 네이티브) | 높음 (K8s 학습 필요) |
| 비용 | Task 단위 과금 | 클러스터 $73/월 + 워커 노드 |
| 적합 대상 | AWS 전용, 소~중규모 | 멀티 클라우드, 대규모 MSA |
| 학습 순서 | **먼저 학습 권장** | Amazon ECS 이해 후 확장 |

> [!WARNING]
> **비용 주의**: Amazon ECS Fargate는 vCPU·메모리·실행 시간 기준 과금입니다.  
> 0.25 vCPU + 0.5GB 메모리 Task 1개를 24시간 실행 시 약 $10/월 수준입니다.  
> Amazon EKS는 클러스터 자체가 시간당 $0.10 ($73/월)이므로 학습 후 즉시 삭제하세요.

---

## 2. CI/CD 고도화

> [!CONCEPT] CI/CD 파이프라인 확장
> 현재 GitHub Actions로 SSH 기반 Amazon EC2 배포를 구현했습니다.  
> 프로덕션 환경에서는 **Blue/Green 배포**, **카나리 배포**, **컨테이너 기반 롤링 업데이트** 등 무중단 배포 전략이 필요합니다.

### 핵심 용어

| 용어 | 설명 |
| ---- | ---- |
| **Blue/Green 배포** | 새 버전(Green)을 별도 환경에 배포 후 트래픽을 한 번에 전환 |
| **카나리 배포** | 새 버전에 소량 트래픽(5~10%)만 먼저 보내고 점진 확대 |
| **롤링 업데이트** | 인스턴스/Task를 하나씩 순차적으로 교체 |
| **AWS CodePipeline** | AWS 네이티브 CI/CD 오케스트레이션 서비스 |
| **AWS CodeBuild** | 관리형 빌드 서비스 (컴파일, 테스트, 패키징) |
| **AWS CodeDeploy** | Amazon EC2/Amazon ECS/AWS Lambda에 자동 배포 (Blue/Green 지원) |
| **ArgoCD** | Kubernetes 환경의 GitOps 배포 도구 |
| **GitOps** | Git 리포지토리를 배포 상태의 단일 진실 원천(SSOT)으로 사용 |

### 현재 vs 고도화 비교

| 항목 | 현재 (GitHub Actions + SSH) | 고도화 |
| ---- | --------------------------- | ------ |
| 배포 방식 | SSH로 JAR 복사 + 재시작 | Blue/Green 또는 롤링 |
| 무중단 | ❌ (재시작 시 순간 중단) | ✅ (ALB 트래픽 전환) |
| 롤백 | 수동 (이전 JAR 복원) | 자동 (이전 TaskDef/이미지) |
| 환경 분리 | 단일 서버 | dev → staging → production |

### 컨테이너 CI/CD 파이프라인 설계

```
┌─────────────────────────────────────────────────────────┐
│  컨테이너 기반 CI/CD 파이프라인                         │
│                                                         │
│  [Git Push] → [CodeBuild]                               │
│                  │                                      │
│                  ├── gradle build (JAR 생성)            │
│                  ├── docker build (이미지 생성)         │
│                  └── docker push → ECR                  │
│                                      │                  │
│                                      ▼                  │
│                               [CodeDeploy / ECS]        │
│                                      │                  │
│                    ┌─────────────────┼─────────────┐    │
│                    │                 │             │    │
│                    ▼                 ▼             ▼    │
│               Blue (기존)      Green (신규)   롤백 가능 │
│               Task v1.0        Task v1.1                │ 
│                    │                 │                  │
│                    └────── ALB ──────┘                  │
│                         트래픽 전환                     │
└─────────────────────────────────────────────────────────┘
```

### 배포 전략 비교

| 전략 | 무중단 | 롤백 속도 | 리소스 비용 | 적합 상황 |
| ---- | :----: | :-------: | :---------: | --------- |
| In-place (현재) | ❌ | 느림 | 낮음 | 개발/테스트 |
| Rolling | ✅ | 중간 | 낮음 | 일반 프로덕션 |
| Blue/Green | ✅ | 즉시 | 2배 (일시적) | 안정성 최우선 |
| Canary | ✅ | 즉시 | +10~20% | 대규모 서비스 |

> [!WARNING]
> **비용 주의**: AWS CodePipeline은 파이프라인당 월 $1, AWS CodeBuild는 빌드 분당 과금입니다.  
> 학습 목적이라면 GitHub Actions(무료 티어 2,000분/월)를 유지하면서  
> 배포 대상만 Amazon ECS로 변경하는 것이 비용 효율적입니다.

---

## 3. IaC (Infrastructure as Code)

> [!CONCEPT] 왜 IaC인가?
> 현재 AWS 콘솔에서 수동으로 리소스를 생성하고 있습니다.  
> 이 방식은 **재현 불가능**(다시 만들면 설정이 달라짐), **추적 불가능**(누가 언제 변경했는지 모름), **확장 불가능**(환경 10개를 동일하게 만들기 어려움)합니다.  
> IaC는 인프라를 코드로 정의하여 Git으로 버전 관리하고, 명령 하나로 동일한 환경을 반복 생성합니다.

### 핵심 용어

| 용어 | 설명 |
| ---- | ---- |
| **IaC (Infrastructure as Code)** | 인프라를 코드로 정의하고 자동 프로비저닝하는 방법론 |
| **AWS CloudFormation** | AWS 네이티브 IaC. YAML/JSON 템플릿으로 리소스 정의 |
| **AWS CDK (Cloud Development Kit)** | TypeScript/Python 등 프로그래밍 언어로 CloudFormation 생성 |
| **Terraform** | HashiCorp의 멀티 클라우드 IaC 도구 (HCL 언어) |
| **스택 (Stack)** | CloudFormation/CDK에서 리소스 묶음의 배포 단위 |
| **상태 파일 (State)** | Terraform이 실제 인프라와 코드를 매핑하는 파일 |
| **드리프트 (Drift)** | 코드와 실제 인프라의 불일치 상태 |

### IaC 도구 비교

| 도구 | 언어 | 멀티 클라우드 | 학습 난이도 | 추천 상황 |
| ---- | ---- | :-----------: | :---------: | --------- |
| **CloudFormation** | YAML/JSON | ❌ AWS만 | 중간 | AWS 입문, 단순 스택 |
| **AWS CDK** | TypeScript, Python 등 | ❌ AWS만 | 낮음 (개발자 친화적) | **웹 개발자에게 추천** |
| **Terraform** | HCL | ✅ | 중간 | 멀티 클라우드, 팀 표준 |
| **Pulumi** | TypeScript, Python 등 | ✅ | 낮음 | CDK + 멀티 클라우드 |

### CDK로 VPC + ECS 정의 예시 (TypeScript)

```typescript
// CDK로 현재 실습의 인프라를 코드화한 예시
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';

const vpc = new ec2.Vpc(this, 'StarterVpc', {
  maxAzs: 2,
  subnetConfiguration: [
    { name: 'Public', subnetType: ec2.SubnetType.PUBLIC },
    { name: 'Private', subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
  ],
});

const cluster = new ecs.Cluster(this, 'StarterCluster', { vpc });

// 이 코드 한 줄로 VPC + 서브넷 + IGW + NAT + ECS 클러스터가 생성됨
// 콘솔에서 수십 단계 클릭하던 것을 10줄로 대체
```

### 학습 순서 권장

```
1. CloudFormation YAML 읽기 (기존 실습 템플릿 분석)
   ↓
2. AWS CDK (TypeScript) — 웹 개발자에게 가장 자연스러움
   ↓
3. Terraform (팀/회사에서 사용 중이라면)
```

> [!NOTE]
> IaC 도구 자체는 무료입니다. 비용은 IaC로 생성하는 AWS 리소스에만 발생합니다.  
> CDK를 학습할 때는 `cdk deploy` 후 반드시 `cdk destroy`로 리소스를 삭제하세요.

---

## 4. 모니터링과 관측성 (Observability)

> [!CONCEPT] Observability의 세 기둥
> 프로덕션 서비스를 운영하려면 "지금 시스템이 정상인지", "문제가 생기면 어디서 발생했는지"를 파악해야 합니다.  
> **Metrics**(수치 지표), **Logs**(로그), **Traces**(분산 추적) 세 가지를 조합하여 시스템 상태를 관찰합니다.

### 핵심 용어

| 용어 | 설명 |
| ---- | ---- |
| **Metrics** | CPU, 메모리, 요청 수, 응답 시간 등 수치화된 시계열 데이터 |
| **Logs** | 애플리케이션이 출력하는 텍스트 기반 이벤트 기록 |
| **Traces** | 하나의 요청이 여러 서비스를 거치는 경로 추적 |
| **Amazon CloudWatch** | AWS 통합 모니터링 서비스 (Metrics + Logs + Alarms) |
| **AWS X-Ray** | 분산 추적 서비스 (마이크로서비스 간 요청 흐름 시각화) |
| **CloudWatch Alarms** | 지표가 임계값을 초과하면 알림 (SNS, Lambda 연동) |
| **CloudWatch Logs Insights** | 로그를 SQL-like 쿼리로 분석하는 도구 |
| **대시보드** | 주요 지표를 한눈에 볼 수 있는 시각화 화면 |

### 모니터링 성숙도 단계

| 단계 | 현재 수준 | 다음 단계 | 프로덕션 수준 |
| ---- | --------- | --------- | ------------- |
| Metrics | Amazon EC2 기본 지표 | 커스텀 메트릭 (응답 시간 등) | 대시보드 + 알람 |
| Logs | SSH로 로그 확인 | CloudWatch Logs 중앙화 | Logs Insights 쿼리 |
| Traces | 없음 | X-Ray 기본 적용 | 서비스 맵 + 병목 분석 |
| Alerts | 없음 | Budget 알림 | 다단계 알림 + 자동 복구 |

### 모니터링 아키텍처 설계

```
┌───────────────────────────────────────────────────────────┐
│  Observability 아키텍처                                   │
│                                                           │
│  [Spring App] ─── X-Ray SDK ───► AWS X-Ray                │
│       │                           (분산 추적)             │
│       │                                                   │
│       ├── 로그 ──► CloudWatch Logs                        │
│       │              └── Logs Insights (쿼리 분석)        │
│       │                                                   │
│       └── 지표 ──► CloudWatch Metrics                     │
│                      └── Alarms ──► SNS ──► 이메일/Slack  │
│                                                           │
│  [ALB] ─── Access Log ──► S3                              │
│  [RDS] ─── Performance Insights ──► CloudWatch            │
└───────────────────────────────────────────────────────────┘
```

### 필수 알람 설정 (권장)

| 대상 | 지표 | 임계값 예시 | 조치 |
| ---- | ---- | ----------- | ---- |
| Amazon EC2/Amazon ECS | CPU 사용률 | > 80% 5분 | Auto Scaling 또는 알림 |
| ALB | 5xx 에러율 | > 5% | 즉시 알림 |
| Amazon RDS | 연결 수 | > max의 80% | 커넥션 풀 점검 |
| Lambda | 에러 수 | > 0 | 즉시 알림 |
| 비용 | 일일 비용 | > $10 | 이상 사용 점검 |

> [!WARNING]
> **비용 주의**: CloudWatch 기본 지표와 5분 간격 수집은 무료입니다.  
> 1분 간격 상세 모니터링, 커스텀 메트릭, X-Ray 트레이스는 사용량에 따라 과금됩니다.  
> 로그 저장량이 많아지면 월 $5~$20 수준이 될 수 있으므로, 로그 보존 기간을 설정하세요.

---

## 5. 서버리스 심화

> [!CONCEPT] 서버리스 아키텍처의 확장
> Step 10에서 Lambda + API Gateway + DynamoDB로 기본 서버리스 API를 만들었습니다.  
> 프로덕션에서는 여러 Lambda를 조합하는 **워크플로우**, 이벤트 기반 **비동기 처리**, **SAM/Serverless Framework**를 활용합니다.

### 핵심 용어

| 용어 | 설명 |
| ---- | ---- |
| **AWS SAM (Serverless Application Model)** | 서버리스 앱을 정의·배포하는 IaC 프레임워크 (CloudFormation 확장) |
| **AWS Step Functions** | Lambda를 순차/병렬/조건 분기로 조합하는 워크플로우 엔진 |
| **Amazon EventBridge** | 이벤트 기반 아키텍처의 중앙 이벤트 버스 |
| **Amazon SQS** | 관리형 메시지 큐 (비동기 처리, 부하 분산) |
| **Amazon SNS** | Pub/Sub 알림 서비스 (이메일, SMS, Lambda 트리거) |
| **Dead Letter Queue (DLQ)** | 처리 실패한 메시지를 보관하는 대기열 |
| **Provisioned Concurrency** | Lambda 콜드 스타트를 제거하기 위해 미리 인스턴스를 준비 |

### 서버리스 확장 패턴

```
┌───────────────────────────────────────────────────────────┐
│  이벤트 드리븐 아키텍처                                   │
│                                                           │
│  [S3 업로드] ──► EventBridge ──► Lambda (이미지 리사이즈) │
│                      │                                    │
│  [API 요청]  ──► SQS ──► Lambda (주문 처리)               │
│                      │         │                          │
│                      │         ▼                          │
│                      │    DynamoDB (저장)                 │
│                      │         │                          │
│                      │         ▼                          │
│                      └──► SNS ──► 이메일 알림             │
│                                                           │
│  [스케줄]    ──► EventBridge (cron) ──► Lambda (배치)     │
└───────────────────────────────────────────────────────────┘
```

### Step Functions 워크플로우 예시

```
주문 처리 워크플로우:

[주문 접수] → [재고 확인] ─── 재고 있음 ──► [결제 처리] → [배송 요청] → [완료 알림]
                    │
                    └── 재고 없음 ──► [대기 등록] → [입고 알림 구독]
```

### SAM vs 콘솔 배포 비교

| 항목 | 콘솔 (현재) | SAM |
| ---- | ----------- | --- |
| Lambda 생성 | 콘솔에서 수동 | `template.yaml`에 정의 |
| API Gateway 연결 | 콘솔에서 수동 | 자동 생성 |
| 환경 복제 | 처음부터 다시 | `sam deploy --stack-name dev/prod` |
| 로컬 테스트 | 불가 | `sam local invoke` |
| 배포 | ZIP 업로드 | `sam deploy` (CI/CD 연동) |

> [!NOTE]
> 서버리스 서비스 대부분은 넉넉한 프리티어를 제공합니다.  
> Lambda 월 100만 요청, SQS 월 100만 메시지, SNS 월 100만 Pub이 무료입니다.  
> Step Functions는 월 4,000회 상태 전환이 무료이며, 초과 시 1,000회당 $0.025입니다.

---

## 6. 보안 심화

> [!CONCEPT] 프로덕션 보안 계층
> 현재 AWS IAM, Security Group, Parameter Store/Secrets Manager로 기본 보안을 구성했습니다.  
> 프로덕션에서는 **웹 방화벽(AWS WAF)**, **DDoS 방어(AWS Shield)**, **위협 탐지(Amazon GuardDuty)**, **보안 감사(AWS Security Hub)** 를 추가로 적용합니다.

### 핵심 용어

| 용어 | 설명 | 비용 |
| ---- | ---- | ---- |
| **AWS WAF** | 웹 애플리케이션 방화벽 (SQL Injection, XSS 차단) | WebACL $5/월 + 규칙당 $1 |
| **AWS Shield** | DDoS 공격 방어 (Standard: 무료, Advanced: $3,000/월) | Standard는 자동 적용 |
| **Amazon GuardDuty** | AI 기반 위협 탐지 (악성 IP, 비정상 API 호출) | 분석량에 따라 $1~$10/월 |
| **AWS Security Hub** | 보안 상태 중앙 관리 대시보드 | 검사 건수당 과금 |
| **AWS Config** | 리소스 설정 변경 추적 및 규정 준수 검사 | 규칙당 $1/월 |
| **AWS CloudTrail** | 모든 AWS API 호출 기록 (누가 언제 무엇을 했는지) | 관리 이벤트 무료, 데이터 이벤트 과금 |
| **Amazon VPC Flow Logs** | VPC 내 네트워크 트래픽 로그 | 로그 저장량에 따라 과금 |

### 보안 계층 아키텍처

```
┌─────────────────────────────────────────────────────────┐
│  보안 심층 방어 (Defense in Depth)                      │
│                                                         │
│  [인터넷]                                               │
│     │                                                   │
│     ▼                                                   │
│  ┌── AWS Shield (DDoS 방어) ───┐                        │
│  │                             │                        │
│  │  ┌── AWS WAF ───────────┐   │                        │
│  │  │  SQL Injection 차단  │   │                        │
│  │  │  XSS 차단            │   │                        │
│  │  │  Rate Limiting       │   │                        │
│  │  └──────────────────────┘   │                        │
│  └─────────────────────────────┘                        │
│     │                                                   │
│     ▼                                                   │
│  [CloudFront / ALB]                                     │
│     │                                                   │
│     ▼                                                   │
│  [Security Group] → [NACL] → [EC2/ECS]                  │
│     │                                                   │
│     ▼                                                   │
│  [IAM Role] → [Secrets Manager] → [RDS]                 │
│                                                         │
│  ──── 감시 계층 ────                                    │
│  CloudTrail (API 감사) + GuardDuty (위협 탐지)          │
│  + Security Hub (통합 대시보드) + Config (규정 준수)    │
└─────────────────────────────────────────────────────────┘
```

### 웹 개발자가 우선 적용할 보안 항목

| 우선순위 | 항목 | 이유 | 난이도 |
| :------: | ---- | ---- | :----: |
| 1 | AWS WAF (SQL Injection, XSS) | 웹 앱 공격 방어 기본 | 중 |
| 2 | AWS CloudTrail 활성화 | 보안 사고 추적 필수 | 하 |
| 3 | Amazon GuardDuty 활성화 | 비정상 활동 자동 탐지 | 하 |
| 4 | Amazon VPC Flow Logs | 네트워크 이상 탐지 | 중 |
| 5 | AWS Security Hub | 전체 보안 상태 한눈에 | 중 |

> [!WARNING]
> **비용 주의**: AWS Shield Standard는 무료이지만, Shield Advanced는 월 $3,000입니다 (대기업용).  
> AWS WAF는 WebACL $5/월 + 규칙당 $1/월 + 요청 100만건당 $0.60으로 학습 수준에서는 $6~$10/월입니다.  
> Amazon GuardDuty는 30일 무료 평가판이 있으므로 활성화해보고 비용을 확인한 후 유지 여부를 결정하세요.

---

## 학습 순서 권장 로드맵

```
현재 수준 (Step 0~12 완료)
    │
    ├─── [필수] 컨테이너화 (Docker + ECS Fargate)
    │         └── 기존 Spring JAR을 Docker 이미지로 패키징 → ECS 배포
    │
    ├─── [필수] IaC (AWS CDK)
    │         └── 현재 콘솔에서 만든 VPC/EC2/RDS를 CDK 코드로 재현
    │
    ├─── [권장] CI/CD 고도화
    │         └── GitHub Actions + ECR + ECS 롤링 배포
    │
    ├─── [권장] 모니터링
    │         └── CloudWatch Logs 중앙화 + 알람 설정
    │
    ├─── [선택] 서버리스 심화
    │         └── SAM으로 로컬 개발 + Step Functions 워크플로우
    │
    └─── [선택] 보안 심화
              └── WAF + GuardDuty 활성화
```

### 학습 시 비용 관리 팁

> [!WARNING]
> **확장 학습 시 비용 관리 원칙:**
>
> 1. **학습 전**: AWS 요금 페이지에서 해당 서비스 비용을 반드시 확인합니다.
> 2. **학습 중**: Budget 알림을 $10~$20 수준으로 설정하여 초과 지출을 방지합니다.
> 3. **학습 후**: 리소스를 즉시 삭제합니다. 특히 Amazon EKS 클러스터, NAT Gateway, Amazon RDS는 시간당 과금입니다.
> 4. **크레딧 활용**: 크레딧이 남아있다면 크레딧 범위 내에서 학습합니다.
> 5. **프리티어 확인**: [AWS 프리티어 페이지](https://aws.amazon.com/free/)에서 무료 범위를 먼저 확인합니다.
>
> | 비용 함정 주의 서비스 | 이유 |
> | -------------------- | ---- |
> | NAT Gateway | 시간당 $0.045 + 데이터 처리 비용 (방치 시 월 $30+) |
> | Amazon EKS 클러스터 | 클러스터만 켜져있어도 시간당 $0.10 (월 $73) |
> | Amazon RDS Multi-AZ | 단일 인스턴스 대비 2배 비용 |
> | Elastic IP (미사용) | 연결 안 된 EIP는 시간당 과금 |
> | CloudWatch Logs | 보존 기간 미설정 시 로그가 계속 쌓여 과금 |

---

## 핵심 정리

| 확장 영역 | 핵심 서비스 | 현재 대비 장점 | 학습 난이도 |
| --------- | ----------- | -------------- | :---------: |
| 컨테이너화 | Docker, Amazon ECS, AWS Fargate | 환경 일관성, 빠른 확장·롤백 | ⭐⭐ |
| CI/CD 고도화 | AWS CodePipeline, AWS CodeDeploy | 무중단 배포, Blue/Green | ⭐⭐ |
| IaC | AWS CDK, Terraform | 인프라 재현성, 버전 관리 | ⭐⭐ |
| 모니터링 | Amazon CloudWatch, AWS X-Ray | 장애 원인 파악, 사전 예방 | ⭐ |
| 서버리스 심화 | AWS SAM, AWS Step Functions | 복잡한 워크플로우, 로컬 테스트 | ⭐⭐⭐ |
| 보안 심화 | AWS WAF, Amazon GuardDuty | 웹 공격 방어, 위협 자동 탐지 | ⭐⭐ |

---

## 다음 단계

이 로드맵의 각 영역을 깊이 학습하려면 다음 리소스를 참고하세요:

- [AWS Well-Architected Framework](https://aws.amazon.com/architecture/well-architected/) — 아키텍처 설계 모범 사례
- [AWS Skill Builder](https://skillbuilder.aws/) — AWS 공식 무료 학습 플랫폼
- [AWS Workshops](https://workshops.aws/) — 핸즈온 실습 모음
- [CDK Workshop](https://cdkworkshop.com/) — CDK 입문 실습 (TypeScript)
- [Amazon ECS Workshop](https://ecsworkshop.com/) — 컨테이너 배포 실습

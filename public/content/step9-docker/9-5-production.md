---
title: '(선택) CloudFront + Fargate 프로덕션 구성'
week: 9
session: 5
awsServices:
  - Amazon CloudFront
  - Amazon S3
  - Amazon ECS
  - AWS Fargate
  - Elastic Load Balancing
learningObjectives:
  - 프론트엔드를 S3 + CloudFront로 분리 배포할 수 있습니다.
  - 백엔드를 ECS Fargate + ALB로 배포할 수 있습니다.
  - 프로덕션 수준의 3-Tier Docker 아키텍처를 구성할 수 있습니다.
prerequisites:
  - Step 9-3 또는 9-4 완료
  - ECR에 이미지 Push 완료
estimatedCost: 크레딧 내 사용 가능 (Fargate + ALB + CloudFront, 실습 후 삭제)
---

> [!WARNING]
> 이 세션은 **선택 사항**입니다.  
> 추가 비용이 발생하며(Fargate + ALB), 실습 후 즉시 삭제해야 합니다.  
> 건너뛰려면 → [9-6: 리소스 정리](/week/9/session/6)로 이동하세요.

EC2 docker-compose 구성을 **프로덕션 수준**으로 업그레이드합니다:

- 프론트엔드: S3 + CloudFront (CDN, HTTPS)
- 백엔드: ECS Fargate + ALB (서버리스, 오토스케일링)

> [!CONCEPT] EC2 단일 서버 vs 프로덕션 분리 구성
> | 항목 | 9-3 (EC2 docker-compose) | 9-5 (프로덕션) |
> |------|-------------------------|----------------|
> | 프론트 | EC2 안의 Nginx 컨테이너 | S3 + CloudFront (글로벌 CDN) |
> | 백엔드 | EC2 안의 Spring 컨테이너 | Fargate + ALB (오토스케일링) |
> | 장점 | 저렴, 단순 | 고가용성, 확장성, HTTPS |
> | 적합 | 개발/소규모 | 프로덕션/중규모 이상 |

### 아키텍처

```
         Internet
            │
    ┌───────┴───────┐
    │               │
    ▼               ▼
┌────────┐    ┌──────────┐
│CloudFr.│    │   ALB    │
│(S3 FE) │    │          │
└────────┘    └────┬─────┘
                   │
              ┌────┴────────┐
              │ECS Fargate  │
              │ (Backend)   │
              └──────┬──────┘
                     │
                ┌────┴────┐
                │   RDS   │
                └─────────┘
```

---

## 태스크 1: 프론트엔드 → S3 + CloudFront 배포

📍 **실행 위치: AWS 콘솔 + 로컬 PC**

> [!NOTE]
> Step 8-2에서 S3 + CloudFront를 설정한 경험이 있다면 동일한 패턴입니다.  
> 이번에는 Docker 빌드 결과물(`dist/`)을 S3에 업로드합니다.

TODO: S3 버킷 생성, CloudFront 배포, dist/ 업로드, 동작 확인

✅ **태스크 완료** — 프론트엔드를 CloudFront로 배포했습니다.

---

## 태스크 2: 백엔드 → ECS Fargate + ALB 배포

📍 **실행 위치: AWS 콘솔**

9-2에서 사이드카로 체험한 것과 달리, 이번에는 **백엔드만 단독 Service**로 배포합니다.  
ALB를 앞에 두어 Health Check + 로드밸런싱을 적용합니다.

TODO:

- ECS Cluster, Task Definition (백엔드만), Service 생성
- ALB + Target Group (IP 타입) 연동
- CloudFront → ALB 오리진 설정 (또는 별도 도메인)

✅ **태스크 완료** — 백엔드를 Fargate + ALB로 배포했습니다.

---

## 태스크 3: 프론트 ↔ 백엔드 연동 확인

📍 **실행 위치: 로컬 PC (브라우저)**

TODO: CloudFront URL 접속, API 호출 확인, CORS 설정 (필요 시)

✅ **태스크 완료** — 프로덕션 구성에서 프론트/백엔드가 정상 연동됩니다.

---

## 태스크 4: 이 세션 리소스 삭제

📍 **실행 위치: AWS 콘솔**

> [!WARNING]
> ALB + Fargate는 시간당 과금됩니다. 확인 후 즉시 삭제하세요.

TODO: ECS Service → ALB → CloudFront → S3 버킷 삭제

✅ **태스크 완료** — 9-5에서 추가 생성한 리소스를 모두 삭제했습니다.

---

## 마무리

### 이번 세션에서 배운 것

- 프론트 CDN 배포 (S3 + CloudFront)와 백엔드 서버리스 배포 (Fargate + ALB) 분리
- 프로덕션 수준 3-Tier Docker 아키텍처
- EC2 단일 서버 구성과의 비용/확장성 비교

### 다음 단계

**9-6: 리소스 정리**에서 Step 9에서 생성한 모든 리소스를 최종 삭제합니다.

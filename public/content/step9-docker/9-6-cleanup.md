---
title: '리소스 정리'
week: 9
session: 6
awsServices: []
learningObjectives:
  - Step 9에서 생성한 모든 AWS 리소스를 체계적으로 삭제할 수 있습니다.
  - 비용 발생 리소스를 식별하고 우선 삭제할 수 있습니다.
prerequisites:
  - Step 9-2 ~ 9-5 완료
estimatedCost: 무료 (삭제 작업)
---

Step 9에서 생성한 모든 AWS 리소스를 체계적으로 정리합니다.  
**비용이 발생하는 리소스부터 우선 삭제합니다.**

### Step 9 전체 구성

| 세션                 | 주제                               | 핵심                                          |
| -------------------- | ---------------------------------- | --------------------------------------------- |
| 9-0                  | Docker + 컨테이너 이론             | 개념 학습                                     |
| 9-1                  | Dockerfile + docker-compose (로컬) | 프론트+백엔드+DB 로컬 풀스택 실행             |
| 9-2                  | ECR Push + EC2 docker-compose 배포 | 통합 인프라(EC2+RDS), VPC Endpoint, EC2 운영  |
| 9-3                  | AWS Fargate 서버리스 컨테이너 체험 | 9-2 이미지+RDS 재사용, Fargate 사이드카 체험  |
| 9-4                  | GitHub Actions → ECR → EC2         | Docker CI/CD 파이프라인 (멀티레포 & 모노레포) |
| 9-5                  | (선택) CloudFront + Fargate        | 프로덕션 분리 구성                            |
| **9-6 (이번 실습)**  | 리소스 정리                        | 전체 삭제                                     |

> [!WARNING]
> **비용 발생 리소스 (즉시 삭제 필요):**
>
> | 리소스                | 시간당 비용 | 월 비용 (방치 시) |
> | --------------------- | ----------- | ----------------- |
> | Amazon EC2 (t3.small) | ~\$0.026    | ~\$19             |
> | Amazon RDS (db.t3.micro) | ~\$0.02  | ~\$14             |
> | ALB (9-5 진행 시)     | ~\$0.025    | ~\$18             |
> | AWS Fargate (9-3/9-5 방치 시) | ~\$0.04 | ~\$29         |
>
> ※ 금액은 참고용이며, 리전·환율·AWS 정책 변경에 따라 달라질 수 있습니다.

---

## 진행한 세션에 따른 삭제 범위

| 진행 세션      | 삭제할 리소스                                                     |
| -------------- | ----------------------------------------------------------------- |
| 9-2 ~ 9-4 완료 | S3 Gateway Endpoint + ECR 이미지 + 통합 CloudFormation 스택(EC2, RDS, VPC) |
| 9-3 Fargate    | ✅ 9-3 마지막에 ECS Service/Cluster 삭제 완료 (미삭제 시 함께 정리) |
| 9-5도 진행     | 위 + Amazon CloudFront, Amazon S3, ALB, Amazon ECS Service        |

---

## 단계 1: 9-5 리소스 삭제 (해당 시)

> [!NOTE]
> 9-5를 진행하지 않았다면 이 단계를 건너뛰세요.

TODO: ECS Service → ALB → CloudFront Disable → Delete → S3 Empty → Delete

---

## 단계 2: EC2 docker-compose 정지

📍 **실행 위치: EC2 (SSH 또는 SSM)**

TODO: docker-compose down, EC2에서 컨테이너 정리

---

## 단계 3: ECR 이미지 삭제

📍 **실행 위치: AWS 콘솔 (ECR) 또는 CLI**

TODO: ECR 리포지토리 내 이미지 삭제 (리포 자체는 스택 삭제 시 함께 삭제됨)

> [!NOTE]
> ECR 리포지토리에 이미지가 남아있으면 CloudFormation 스택 삭제가 실패할 수 있습니다.  
> 먼저 이미지를 삭제하세요.

---

## 단계 4: VPC Endpoint 및 CloudFormation 스택 삭제

📍 **실행 위치: AWS 콘솔 (VPC / CloudFormation)**

TODO:
- 9-2에서 수동 생성한 S3 Gateway Endpoint 삭제 (VPC 삭제 전 선행 필요)
- `step9-infra` CloudFormation 스택 삭제 (VPC, EC2, RDS, ECR, S3 일괄 삭제)

---

## 단계 5: Tag Editor 최종 확인

📍 **실행 위치: AWS 콘솔**

TODO: Tag Editor에서 Step: step9 검색, 남은 리소스 확인

---

## 단계 6: 비용 확인

📍 **실행 위치: AWS 콘솔 (Billing)**

TODO: Billing → Bills에서 Step 9 관련 비용 확인

---

## 삭제 체크리스트

| #   | 리소스                                      | 삭제 완료 |
| --- | ------------------------------------------- | --------- |
| 1   | EC2 (docker-compose 정지)                   | ☐         |
| 2   | ECR 이미지 (리포 내 이미지)                 | ☐         |
| 3   | CloudFormation 스택 (EC2 + VPC + RDS + NAT) | ☐         |
| 4   | (9-5) ECS Service + Cluster                 | ☐         |
| 5   | (9-5) ALB + Target Group                    | ☐         |
| 6   | (9-5) CloudFront Distribution               | ☐         |
| 7   | (9-5) S3 버킷                               | ☐         |
| 8   | Tag Editor 최종 확인                        | ☐         |
| 9   | Billing 비용 확인                           | ☐         |

---

## 로컬 정리 (선택)

```bash
# 로컬 Docker 이미지 삭제
docker rmi step9-frontend:test step9-backend:test

# docker-compose 데이터 삭제
cd ~/step9-docker
docker-compose down -v

# 빌드 캐시 정리
docker system prune -a
```

> [!NOTE]
> 로컬 Docker 이미지와 볼륨은 비용이 발생하지 않습니다.  
> 디스크 공간이 부족할 때만 정리하면 됩니다.

---

✅ **실습 종료**: Step 9의 모든 리소스가 정리되었습니다.

---

# 🎉 Step 9 완료

Step 9에서 달성한 것:

- ✅ 기존 프로젝트를 Docker 이미지로 컨테이너화
- ✅ `docker-compose`로 로컬 풀스택 환경 구성
- ✅ Amazon ECR에 이미지 Push 및 Amazon EC2 + `docker-compose` + Amazon RDS 운영 배포
- ✅ AWS Fargate 서버리스 컨테이너(사이드카 패턴) 체험 및 비용 비교
- ✅ GitHub Actions → Amazon ECR → Amazon EC2 Docker CI/CD 파이프라인 구축
- ✅ (선택) Amazon CloudFront + AWS Fargate 프로덕션 구성

**Docker의 핵심 가치**: 같은 이미지를 로컬에서든, Fargate에서든, EC2에서든 동일하게 실행할 수 있습니다.  
환경 차이로 인한 배포 문제가 사라집니다.

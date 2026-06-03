// AWS 기초 실습 가이드 - 단계별 커리큘럼 데이터

export type SessionType = 'lab' | 'demo' | 'theory';

export interface Session {
  session: number;
  type: SessionType;
  title: string;
  hasContent: boolean;
  markdownPath?: string;
  description?: string;
  awsServices?: string[];
  learningObjectives?: string[];
  estimatedCost?: string;
}

export interface WeekCurriculum {
  week: number;
  title: string;
  description: string;
  sessions: Session[];
  prerequisites?: string[];
  estimatedTime?: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
}

// Step 기반 커리큘럼 데이터
export const curriculum: WeekCurriculum[] = [
  {
    week: 0,
    title: 'AWS 가입 및 비용 관리',
    description:
      'AWS 비용 폭탄을 방지하기 위한 예산 알림 설정과 프리티어 범위를 이해합니다.',
    sessions: [
      {
        session: 0,
        type: 'theory',
        title: 'AWS 클라우드 기초 개념',
        hasContent: true,
        markdownPath: '/content/step0-budget/0-0-aws-overview.md',
        description:
          '클라우드 컴퓨팅, On-premise vs Cloud, IaaS/PaaS/SaaS, 글로벌 인프라, 책임 공유 모델',
        awsServices: [],
        estimatedCost: '무료 (이론)',
      },
      {
        session: 1,
        type: 'lab',
        title: 'AWS 계정 생성 및 AWS IAM 사용자 설정',
        hasContent: true,
        markdownPath: '/content/step0-budget/0-1-account-iam-setup.md',
        description: 'AWS 계정 생성, Root 계정 보안, IAM 사용자 생성, MFA 설정',
        awsServices: ['AWS IAM'],
        estimatedCost: '무료',
      },
      {
        session: 2,
        type: 'lab',
        title: 'AWS Budget 설정 및 프리티어 완전 정리',
        hasContent: true,
        markdownPath: '/content/step0-budget/0-2-budget-freetier.md',
        description: '예산 알림 설정, 프리티어 3가지 유형, 비용 폭탄 방지 설정',
        awsServices: ['AWS Budgets', 'AWS Cost Explorer'],
        estimatedCost: '프리티어',
      },
    ],
    difficulty: 'beginner',
  },
  {
    week: 1,
    title: 'Amazon VPC 네트워크 설계',
    description:
      'AWS 인프라의 기반이 되는 가상 네트워크를 직접 설계하고 구축합니다.',
    sessions: [
      {
        session: 0,
        type: 'theory',
        title: '네트워크 기초 이론',
        hasContent: true,
        markdownPath: '/content/step1-vpc/1-0-network-fundamentals.md',
        description:
          'IP 주소, CIDR, 서브넷, 라우팅, DNS, TCP/UDP, OSI 7계층, VPC 필요성',
        awsServices: [],
        estimatedCost: '무료 (이론)',
      },
      {
        session: 1,
        type: 'lab',
        title: 'VPC 생성과 서브넷·IGW·라우팅 구성',
        hasContent: true,
        markdownPath: '/content/step1-vpc/1-1-vpc-subnet-igw-rt.md',
        description:
          'VPC CIDR 설계, Public/Private Subnet 배치, Internet Gateway 연결, Route Table 설정',
        awsServices: ['Amazon VPC'],
        estimatedCost: '프리티어',
      },
      {
        session: 2,
        type: 'lab',
        title: 'Security Group으로 인스턴스 방화벽 구성',
        hasContent: true,
        markdownPath: '/content/step1-vpc/1-2-security-group.md',
        description:
          'EC2용·RDS용 Security Group 생성, Stateful 동작 원리, 기본값과 커스텀 차이',
        awsServices: ['Amazon VPC'],
        estimatedCost: '프리티어',
      },
      {
        session: 3,
        type: 'lab',
        title: 'NACL로 서브넷 레벨 접근 제어',
        hasContent: true,
        markdownPath: '/content/step1-vpc/1-3-nacl.md',
        description:
          'Stateless 동작 원리, Security Group과 비교, Ephemeral Port 이해',
        awsServices: ['Amazon VPC'],
        estimatedCost: '프리티어',
      },
    ],
    difficulty: 'beginner',
  },
  {
    week: 2,
    title: 'Amazon EC2 서버 구축',
    description:
      'IaaS의 핵심인 EC2에 직접 서버를 구축하고 애플리케이션을 배포합니다.',
    sessions: [
      {
        session: 0,
        type: 'theory',
        title: '컴퓨팅 기초 이론',
        hasContent: true,
        markdownPath: '/content/step2-ec2/2-0-compute-fundamentals.md',
        description:
          '가상화, 하이퍼바이저, 인스턴스 타입, AMI, EBS, 키 페어, 수명 주기',
        awsServices: [],
        estimatedCost: '무료 (이론)',
      },
      {
        session: 1,
        type: 'lab',
        title: 'Amazon EC2에 MySQL 8.4 LTS 직접 설치 및 설정',
        hasContent: true,
        markdownPath: '/content/step2-ec2/2-1-ec2-mysql.md',
        description:
          'EC2 인스턴스 생성, MySQL 8.4 LTS 설치, 보안 초기화, 사용자 및 DB 생성',
        awsServices: ['Amazon EC2'],
        estimatedCost: '프리티어',
      },
      {
        session: 2,
        type: 'lab',
        title: 'Amazon EC2에 Vue 3 + Nginx 배포',
        hasContent: true,
        markdownPath: '/content/step2-ec2/2-2-ec2-vuejs.md',
        description:
          'Node.js 설치, Vue 3 프로젝트 빌드, Nginx 웹서버 설정 및 배포',
        awsServices: ['Amazon EC2'],
        estimatedCost: '프리티어',
      },
      {
        session: 3,
        type: 'lab',
        title: 'EC2에 Spring Boot 배포 및 서비스 등록',
        hasContent: true,
        markdownPath: '/content/step2-ec2/2-3-ec2-spring.md',
        description:
          'Java 17 설치, JAR 빌드 및 전송, systemd 서비스 등록으로 안정 운영',
        awsServices: ['Amazon EC2'],
        estimatedCost: '프리티어',
      },
    ],
    difficulty: 'beginner',
  },
  {
    week: 3,
    title: 'NAT를 통한 Private 인터넷 연결',
    description:
      'Private Subnet의 인스턴스가 외부 인터넷에 안전하게 접근하는 방법을 학습합니다.',
    sessions: [
      {
        session: 0,
        type: 'theory',
        title: 'NAT와 네트워크 주소 변환 이론',
        hasContent: true,
        markdownPath: '/content/step3-nat/3-0-nat-concepts.md',
        description:
          'NAT 동작 원리, SNAT/DNAT, Bastion Host, VPN/Direct Connect 개념',
        awsServices: [],
        estimatedCost: '무료 (이론)',
      },
      {
        session: 1,
        type: 'lab',
        title: 'NAT Instance vs NAT Gateway 비교 실습',
        hasContent: true,
        markdownPath: '/content/step3-nat/3-1-nat-instance-vs-gateway.md',
        description:
          'NAT Instance 직접 구성, NAT Gateway 설정, 비용·성능·관리 비교',
        awsServices: ['Amazon VPC', 'Amazon EC2'],
        estimatedCost: '소액 발생',
      },
    ],
    difficulty: 'intermediate',
  },
  {
    week: 4,
    title: 'Amazon RDS 관리형 데이터베이스',
    description:
      'AWS 관리형 MySQL을 구성하고, EC2 직접 설치와 비교하며 편리함을 체감합니다.',
    sessions: [
      {
        session: 0,
        type: 'theory',
        title: '데이터베이스 기초 이론',
        hasContent: true,
        markdownPath: '/content/step4-rds/4-0-database-fundamentals.md',
        description:
          '관계형 DB, SQL 기초, 정규화, 인덱스, ACID, Multi-AZ, Read Replica',
        awsServices: [],
        estimatedCost: '무료 (이론)',
      },
      {
        session: 1,
        type: 'lab',
        title: 'RDS Subnet Group 생성 및 배치 전략',
        hasContent: true,
        markdownPath: '/content/step4-rds/4-1-subnet-group.md',
        description:
          'DB Subnet Group 생성, Public/Private 배치 차이, 보안 관점 설계',
        awsServices: ['Amazon RDS'],
        estimatedCost: '프리티어',
      },
      {
        session: 2,
        type: 'lab',
        title: 'RDS Parameter Group 설정',
        hasContent: true,
        markdownPath: '/content/step4-rds/4-2-rds-parameter.md',
        description:
          'time_zone=Asia/Seoul, max_connections 조정, Spring HikariCP 풀 연동',
        awsServices: ['Amazon RDS'],
        estimatedCost: '프리티어',
      },
    ],
    difficulty: 'intermediate',
  },
  {
    week: 5,
    title: 'Amazon S3 스토리지 활용',
    description:
      '오브젝트 스토리지의 핵심 설정을 이해하고, Spring Boot 연동과 정적 웹 호스팅까지 S3의 주요 사용법을 모두 학습합니다.',
    sessions: [
      {
        session: 0,
        type: 'theory',
        title: '스토리지 유형과 개념',
        hasContent: true,
        markdownPath: '/content/step5-s3/5-0-storage-concepts.md',
        description:
          '블록/오브젝트/파일 스토리지, 내구성과 가용성, 스토리지 클래스, CDN, 캐싱',
        awsServices: [],
        estimatedCost: '무료 (이론)',
      },
      {
        session: 1,
        type: 'lab',
        title: 'Amazon S3 버킷 생성과 핵심 설정 이해',
        hasContent: true,
        markdownPath: '/content/step5-s3/5-1-s3-config.md',
        description:
          '버킷 정책, 암호화, 버전 관리, 수명 주기, 사용 시나리오 정리',
        awsServices: ['Amazon S3'],
        estimatedCost: '크레딧 내 사용 가능 (비용 매우 저렴)',
      },
      {
        session: 2,
        type: 'lab',
        title: 'Spring Boot S3 파일 업로드 구현',
        hasContent: true,
        markdownPath: '/content/step5-s3/5-2-spring-s3-integration.md',
        description: 'AWS SDK 설정, MultipartFile 업로드, Presigned URL 생성',
        awsServices: ['Amazon S3'],
        estimatedCost: '크레딧 내 사용 가능 (비용 매우 저렴)',
      },
      {
        session: 3,
        type: 'lab',
        title: 'Amazon S3 + Amazon CloudFront 정적 웹 호스팅',
        hasContent: true,
        markdownPath: '/content/step5-s3/5-3-s3-cloudfront-hosting.md',
        description:
          'S3 정적 웹 호스팅 설정, CloudFront CDN 연결, HTTPS 적용, SPA 라우팅',
        awsServices: ['Amazon S3', 'Amazon CloudFront'],
        estimatedCost: '크레딧 내 사용 가능 (비용 매우 저렴)',
      },
    ],
    difficulty: 'intermediate',
  },
  {
    week: 6,
    title: 'AWS에서 비밀값 안전하게 관리',
    description:
      '하드코딩된 비밀번호와 API 키를 Parameter Store와 Secrets Manager로 안전하게 분리합니다.',
    sessions: [
      {
        session: 0,
        type: 'theory',
        title: '보안과 자격 증명 관리 이론',
        hasContent: true,
        markdownPath: '/content/step6-secrets/6-0-security-concepts.md',
        description:
          '인증/인가, 암호화, KMS, 비밀값 관리, 최소 권한 원칙, Zero Trust',
        awsServices: [],
        estimatedCost: '무료 (이론)',
      },
      {
        session: 1,
        type: 'lab',
        title: 'AWS SSM Parameter Store로 DB 비밀번호 관리',
        hasContent: true,
        markdownPath: '/content/step6-secrets/6-1-ssm-parameter-store.md',
        description:
          'SecureString 저장, Spring Boot에서 조회, EC2 IAM Role 설정',
        awsServices: ['AWS Systems Manager Parameter Store'],
        estimatedCost: '무료 (Standard 파라미터 10,000개까지 항상 무료)',
      },
      {
        session: 2,
        type: 'lab',
        title: 'AWS Secrets Manager로 자동 로테이션 설정',
        hasContent: true,
        markdownPath: '/content/step6-secrets/6-2-secrets-manager.md',
        description:
          'Secrets Manager에 비밀 저장, RDS 비밀번호 자동 로테이션, Spring Boot 연동',
        awsServices: ['AWS Secrets Manager'],
        estimatedCost: '크레딧 내 사용 가능 (비밀당 월 $0.40)',
      },
    ],
    difficulty: 'intermediate',
  },
  {
    week: 7,
    title: '고가용성 & HTTPS 적용',
    description:
      'ALB로 트래픽을 분산하고, Auto Scaling으로 확장하며, 도메인과 HTTPS를 적용합니다.',
    sessions: [
      {
        session: 0,
        type: 'theory',
        title: '고가용성과 확장 전략 이론',
        hasContent: true,
        markdownPath: '/content/step7-domain/7-0-ha-concepts.md',
        description:
          'HA, SLA/SLO/SLI, SPOF, 수평 확장, 로드밸런싱, Auto Scaling, DNS, SSL/TLS',
        awsServices: [],
        estimatedCost: '무료 (이론)',
      },
      {
        session: 1,
        type: 'lab',
        title: 'ALB 생성 및 Target Group 구성',
        hasContent: true,
        markdownPath: '/content/step7-domain/7-1-alb-target-group.md',
        description:
          'Application Load Balancer 생성, Target Group 설정, Health Check, EC2 연결',
        awsServices: ['Elastic Load Balancing'],
        estimatedCost: '크레딧 내 사용 가능 (비용 발생 가능)',
      },
      {
        session: 2,
        type: 'lab',
        title: 'Auto Scaling Group으로 자동 확장 설정',
        hasContent: true,
        markdownPath: '/content/step7-domain/7-2-auto-scaling.md',
        description: 'Launch Template 생성, ASG 설정, 스케일링 정책, ALB 연동',
        awsServices: ['Amazon EC2 Auto Scaling'],
        estimatedCost: '크레딧 내 사용 가능 (비용 발생 가능)',
      },
      {
        session: 3,
        type: 'lab',
        title: '도메인 구매부터 HTTPS 인증서 발급까지',
        hasContent: true,
        markdownPath: '/content/step7-domain/7-3-route53-acm.md',
        description:
          '가비아 도메인 구매, Route53 Hosted Zone, ACM DNS 검증, ALB에 HTTPS 적용',
        awsServices: ['Amazon Route 53', 'AWS Certificate Manager'],
        estimatedCost: 'Route53 Hosted Zone 월 $0.50 + 도메인 구매 비용',
      },
    ],
    difficulty: 'intermediate',
  },
  {
    week: 8,
    title: 'GitHub Actions 자동 배포',
    description:
      '수동 배포를 자동화하여 코드 push만으로 EC2에 배포되는 파이프라인을 구축합니다.',
    sessions: [
      {
        session: 0,
        type: 'theory',
        title: 'CI/CD 파이프라인 이론',
        hasContent: true,
        markdownPath: '/content/step8-cicd/8-0-cicd-concepts.md',
        description: 'CI/CD 개념, 배포 전략, Git Flow, 환경 분리, IaC, GitOps',
        awsServices: [],
        estimatedCost: '무료 (이론)',
      },
      {
        session: 1,
        type: 'lab',
        title: 'GitHub Actions로 Amazon EC2 자동 배포 구축',
        hasContent: true,
        markdownPath: '/content/step8-cicd/8-1-github-actions.md',
        description:
          'GitHub Secrets 설정, SSH 배포 워크플로우, 빌드→테스트→배포 파이프라인',
        awsServices: ['Amazon EC2', 'Amazon RDS'],
        estimatedCost: '프리티어',
      },
    ],
    difficulty: 'advanced',
  },
  {
    week: 9,
    title: '3-Tier 아키텍처 통합 배포',
    description:
      'Step 0~8에서 배운 모든 것을 통합하여 Vue.js + Spring Boot + RDS 3-Tier 서비스를 완성합니다.',
    sessions: [
      {
        session: 0,
        type: 'theory',
        title: '웹 아키텍처 설계 패턴 이론',
        hasContent: true,
        markdownPath: '/content/step9-3tier/9-0-architecture-concepts.md',
        description:
          '모놀리식 vs 마이크로서비스, N-Tier, REST API, Stateless, 캐싱, 메시지 큐',
        awsServices: [],
        estimatedCost: '무료 (이론)',
      },
      {
        session: 1,
        type: 'lab',
        title: '전체 아키텍처 설계 및 인프라 구축',
        hasContent: true,
        markdownPath: '/content/step9-3tier/9-1-architecture-infra.md',
        description:
          '3-Tier 아키텍처 설계, CloudFormation으로 VPC/RDS/S3 환경 한 번에 구축',
        awsServices: ['Amazon VPC', 'Amazon RDS', 'Amazon S3'],
        estimatedCost: '크레딧 내 사용 가능 (비용 발생 가능)',
      },
      {
        session: 2,
        type: 'lab',
        title: 'Vue.js 프론트엔드 배포 (S3 + CloudFront)',
        hasContent: true,
        markdownPath: '/content/step9-3tier/9-2-frontend-deploy.md',
        description:
          'Vue.js 리포지토리 생성, 빌드, S3 정적 호스팅, CloudFront CDN 연결',
        awsServices: ['Amazon S3', 'Amazon CloudFront'],
        estimatedCost: '크레딧 내 사용 가능 (비용 발생 가능)',
      },
      {
        session: 3,
        type: 'lab',
        title: 'Spring Boot 백엔드 배포 (EC2 + ALB + CI/CD)',
        hasContent: true,
        markdownPath: '/content/step9-3tier/9-3-backend-deploy.md',
        description:
          'Spring Boot 리포지토리, EC2 배포, ALB 연결, GitHub Actions CI/CD',
        awsServices: ['Amazon EC2', 'Elastic Load Balancing'],
        estimatedCost: '크레딧 내 사용 가능 (비용 발생 가능)',
      },
      {
        session: 4,
        type: 'lab',
        title: '전체 연동 확인 및 리소스 정리',
        hasContent: true,
        markdownPath: '/content/step9-3tier/9-4-integration-cleanup.md',
        description:
          '프론트↔백엔드↔DB 연동 테스트, 도메인 연결, 전체 리소스 정리 체크리스트',
        awsServices: ['Amazon Route 53', 'AWS Certificate Manager'],
        estimatedCost: '무료 (정리 작업)',
      },
    ],
    difficulty: 'advanced',
  },
  {
    week: 10,
    title: '서버리스 백엔드 (고급)',
    description:
      'DynamoDB로 NoSQL 데이터베이스를 이해하고, Lambda + API Gateway + DynamoDB로 서버리스 REST API를 구축합니다.',
    sessions: [
      {
        session: 0,
        type: 'theory',
        title: '서버리스와 NoSQL 이론',
        hasContent: true,
        markdownPath: '/content/step10-serverless/10-0-serverless-concepts.md',
        description:
          '서버리스, 이벤트 드리븐, Cold Start, NoSQL 유형, CAP 정리, DynamoDB 설계',
        awsServices: [],
        estimatedCost: '무료 (이론)',
      },
      {
        session: 1,
        type: 'lab',
        title: 'Amazon DynamoDB 테이블 생성 및 핵심 개념',
        hasContent: true,
        markdownPath: '/content/step10-serverless/10-1-dynamodb-basics.md',
        description:
          'DynamoDB 개념(파티션 키, 정렬 키), 테이블 생성, 항목 CRUD, 콘솔 조작',
        awsServices: ['Amazon DynamoDB'],
        estimatedCost: '항상 무료 (DynamoDB 25GB + 월 2억 5천만 요청 무료)',
      },
      {
        session: 2,
        type: 'lab',
        title: 'Lambda + API Gateway + DynamoDB 서버리스 API',
        hasContent: true,
        markdownPath: '/content/step10-serverless/10-2-lambda-api-dynamodb.md',
        description:
          'Lambda에서 DynamoDB CRUD, API Gateway 연동, 서버리스 REST API 완성',
        awsServices: ['AWS Lambda', 'Amazon API Gateway', 'Amazon DynamoDB'],
        estimatedCost: '항상 무료 (Lambda·API Gateway·DynamoDB 무료 티어 포함)',
      },
    ],
    difficulty: 'advanced',
  },
  {
    week: 11,
    title: 'Amazon Bedrock 체험 (고급)',
    description:
      'Amazon Bedrock Playground에서 생성형 AI 모델을 체험하고 프롬프트 엔지니어링을 학습합니다.',
    sessions: [
      {
        session: 0,
        type: 'theory',
        title: '생성형 AI와 프롬프트 엔지니어링 이론',
        hasContent: true,
        markdownPath: '/content/step11-bedrock/11-0-ai-concepts.md',
        description:
          'LLM, Transformer, 토큰, Foundation Model, RAG, Temperature/Top-P',
        awsServices: [],
        estimatedCost: '무료 (이론)',
      },
      {
        session: 1,
        type: 'lab',
        title: 'Bedrock Playground 프롬프트 엔지니어링',
        hasContent: true,
        markdownPath: '/content/step11-bedrock/11-1-bedrock-playground.md',
        description:
          'Claude 모델 사용, Zero-shot/Few-shot/CoT 프롬프팅, 파라미터 조정',
        awsServices: ['Amazon Bedrock'],
        estimatedCost: '크레딧 내 사용 가능 (비용 발생 가능)',
      },
    ],
    difficulty: 'advanced',
  },
];

export const sessionTypeConfig = {
  theory: { icon: 'file', label: '이론', color: 'grey', emoji: '📕' },
  lab: { icon: 'settings', label: '실습', color: 'blue', emoji: '⚡' },
  demo: { icon: 'video-on', label: '데모', color: 'green', emoji: '🖥️' },
} as const;

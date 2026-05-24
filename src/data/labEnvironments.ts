// 실습 사전 환경 및 파일 정보

export type FileType =
  | 'cloudformation' // CloudFormation 템플릿
  | 'lambda' // Lambda 함수 코드 ZIP
  | 'data' // 샘플 데이터 (JSON, CSV)
  | 'yaml' // Kubernetes YAML 매니페스트
  | 'script' // 스크립트 파일 (Shell, Python)
  | 'config' // 설정 파일 (JSON, YAML)
  | 'document' // 문서 파일 (PDF, TXT, MD)
  | 'code' // 소스 코드 (HTML, CSS, JS)
  | 'other'; // 기타

export interface LabFile {
  name: string;
  type: FileType;
  description: string;
  usedInTask?: string; // 어느 태스크에서 사용하는지
}

export interface LabEnvironment {
  week: number;
  session: number;
  sessionType: 'theory' | 'lab' | 'demo' | 'none';
  hasPrerequisites: boolean; // 사전 환경이 필요한가?
  zipFileName?: string; // ZIP 파일명 (있는 경우)
  files: LabFile[];
  cloudFormationResources?: string[]; // CFn으로 생성되는 리소스 목록
  notes?: string; // 추가 설명
}

// 15주차 실습 사전 환경 데이터
export const labEnvironments: LabEnvironment[] = [
  // ========================================
  // Week 1: 클라우드 서비스 디자인 개요
  // ========================================
  {
    week: 1,
    session: 1,
    sessionType: 'lab',
    hasPrerequisites: true,
    zipFileName: 'week1-1-tag-editor-lab.zip',
    files: [
      {
        name: 'tag-editor-lab-stack.yaml',
        type: 'cloudformation',
        description: 'QuickTable 리소스 생성 템플릿 (S3, Lambda, DynamoDB)',
        usedInTask: '태스크 0: 실습 환경 구축',
      },
      {
        name: 'README.md',
        type: 'document',
        description: 'CloudFormation 배포 가이드 및 태그 관리 방법',
        usedInTask: '참고 자료',
      },
    ],
    cloudFormationResources: [
      'S3 Bucket (quicktable-reservations)',
      'S3 Bucket (quicktable-logs)',
      'DynamoDB Table (QuickTableReservations)',
      'Lambda Function (QuickTableCreateReservation)',
      'Lambda Function (QuickTableGetReservation)',
      'IAM Role (QuickTableLambdaExecutionRole)',
    ],
    notes:
      '태스크 0에서 CloudFormation으로 QuickTable 리소스 생성, Tag Editor로 태그 관리',
  },
  {
    week: 1,
    session: 2,
    sessionType: 'demo',
    hasPrerequisites: true,
    zipFileName: 'week1-2-well-architected-guide.zip',
    files: [
      {
        name: 'quicktable-architecture-overview.md',
        type: 'document',
        description: 'QuickTable 3-Tier 아키텍처 개요 및 구성 요소 설명',
        usedInTask:
          '태스크 1: AWS Well-Architected Tool 시작하기 (quicktable-architecture-overview.md 참고하여 워크로드 생성)',
      },
      {
        name: 'well-architected-checklist.md',
        type: 'document',
        description:
          'AWS Well-Architected Framework 6가지 원칙별 체크리스트 (QuickTable 시스템 현황 기반)',
        usedInTask:
          '태스크 2-7: 6가지 원칙 평가 (well-architected-checklist.md 참고하여 질문 답변)',
      },
    ],
    notes: '콘솔에서 직접 Well-Architected Tool 사용',
  },
  {
    week: 1,
    session: 3,
    sessionType: 'lab',
    hasPrerequisites: true,
    zipFileName: 'week1-3-architecture-lab.zip',
    files: [
      {
        name: 'README.md',
        type: 'document',
        description:
          'QuickTable 아키텍처 설계 가이드 및 Multi-AZ 고가용성 원칙 설명',
        usedInTask:
          '태스크 2-8: QuickTable 아키텍처 다이어그램 작성 - README.md를 참고하여 Multi-AZ 고가용성 설계 원칙, 3-Tier 아키텍처 구성 요소, 보안 그룹 설계 모범 사례, Amazon EC2 Auto Scaling 전략 등을 학습하고 다이어그램에 적용합니다',
      },
      {
        name: 'template-info.md',
        type: 'document',
        description:
          'Draw.io 템플릿 사용 안내 및 AWS 아이콘 라이브러리 로드 방법',
        usedInTask:
          '태스크 1: Draw.io 환경 설정 - template-info.md를 참고하여 AWS 아이콘 라이브러리를 자동으로 로드하는 URL 파라미터 사용법을 확인하고 작업 환경을 설정합니다',
      },
    ],
    notes: 'draw.io 웹 접속하여 아키텍처 다이어그램 작성',
  },

  // ========================================
  // Week 2: AWS IAM 및 조직 관리 고급 전략
  // ========================================
  {
    week: 2,
    session: 1,
    sessionType: 'lab',
    hasPrerequisites: true,
    zipFileName: 'week2-1-iam-policy-condition.zip',
    files: [
      {
        name: 'week2-1-iam-policy-condition.yaml',
        type: 'cloudformation',
        description: 'IAM 사용자 및 Access Key 생성 템플릿',
        usedInTask: '태스크 0: 실습 환경 구축',
      },
      {
        name: 'mfa-policy.json',
        type: 'config',
        description: 'MFA Condition 정책 JSON 샘플',
        usedInTask: '태스크 2: MFA 강제 정책 생성',
      },
      {
        name: 'ip-restriction-policy.json',
        type: 'config',
        description: 'IP 제한 정책 JSON 샘플',
        usedInTask: '태스크 3: IP 주소 제한 정책 생성',
      },
      {
        name: 'time-based-policy.json',
        type: 'config',
        description: '시간 기반 정책 JSON 샘플',
        usedInTask: '태스크 4: 시간 기반 접근 제어',
      },
      {
        name: 'README.md',
        type: 'document',
        description: '정책 사용 방법 및 Condition 키 레퍼런스',
        usedInTask: '참고 자료',
      },
    ],
    cloudFormationResources: [
      'IAM User (lab-user)',
      'Access Key',
      'IAM Policy (S3 ListAllMyBuckets)',
    ],
    notes:
      '태스크 0에서 CloudFormation으로 lab-user 생성, 정책은 콘솔에서 직접 생성',
  },
  {
    week: 2,
    session: 2,
    sessionType: 'lab',
    hasPrerequisites: true,
    zipFileName: 'week2-2-iam-role-assumerole.zip',
    files: [
      {
        name: 'assume-role-policy.json',
        type: 'config',
        description: 'AssumeRole 권한 정책 JSON',
        usedInTask: '태스크 4: IAM 사용자에게 AssumeRole 권한 부여',
      },
    ],
    cloudFormationResources: [
      'IAM User (lab-user)',
      'Access Key',
      'S3 Bucket (iam-role-lab-{AccountId})',
    ],
    notes:
      '태스크 0에서 CloudFormation으로 lab-user + S3 버킷 생성, IAM 역할은 콘솔에서 직접 생성',
  },
  {
    week: 2,
    session: 3,
    sessionType: 'theory',
    hasPrerequisites: false,
    files: [],
  },

  // ========================================
  // Week 3: Amazon VPC 고급 네트워킹
  // ========================================
  {
    week: 3,
    session: 1,
    sessionType: 'lab',
    hasPrerequisites: true,
    zipFileName: 'week3-1-vpc-lab.zip',
    files: [
      {
        name: 'week3-1-vpc-lab.yaml',
        type: 'cloudformation',
        description: 'VPC 환경 구축 템플릿 (VPC, 서브넷, IGW, NAT GW, EC2)',
        usedInTask: '태스크 0: 실습 환경 구축',
      },
    ],
    cloudFormationResources: [
      'VPC (10.0.0.0/16)',
      '퍼블릭 서브넷 2개',
      '프라이빗 서브넷 2개',
      'Internet Gateway',
      'NAT Gateway',
      '라우팅 테이블',
      'EC2 인스턴스 (프라이빗 서브넷)',
      '보안 그룹',
    ],
    notes:
      '태스크 0에서 CloudFormation으로 VPC 환경 구축, VPC Endpoint는 콘솔에서 직접 생성',
  },
  {
    week: 3,
    session: 2,
    sessionType: 'lab',
    hasPrerequisites: true,
    zipFileName: 'week3-2-security-group-lab.zip',
    files: [
      {
        name: 'week3-2-security-group-lab.yaml',
        type: 'cloudformation',
        description: '3-Tier VPC 환경 구축 템플릿 (VPC, 서브넷, NAT GW, EC2)',
        usedInTask: '태스크 0: Amazon VPC 환경 구축',
      },
      {
        name: 'README.md',
        type: 'document',
        description: 'CloudFormation 배포 가이드 및 아키텍처 설명',
        usedInTask: '참고 자료',
      },
    ],
    cloudFormationResources: [
      'VPC (10.0.0.0/16)',
      '퍼블릭 서브넷 2개',
      '웹 계층 서브넷 2개',
      '앱 계층 서브넷 2개',
      'DB 계층 서브넷 2개',
      'Internet Gateway',
      'NAT Gateway 2개',
      '라우팅 테이블',
      'EC2 인스턴스 3개 (Web, App, DB)',
      '보안 그룹 (기본 상태)',
    ],
    notes:
      '태스크 0에서 CloudFormation으로 3-Tier VPC 환경 구축, 보안 그룹 규칙은 콘솔에서 직접 설정',
  },
  {
    week: 3,
    session: 3,
    sessionType: 'theory',
    hasPrerequisites: false,
    files: [],
  },

  // ========================================
  // Week 4: 서버리스 및 이벤트 기반 아키텍처
  // ========================================
  {
    week: 4,
    session: 1,
    sessionType: 'theory',
    hasPrerequisites: false,
    files: [],
  },
  {
    week: 4,
    session: 2,
    sessionType: 'lab',
    hasPrerequisites: true,
    zipFileName: 'week4-2-api-gateway-auth-lab.zip',
    files: [
      {
        name: 'lambda_function.py',
        type: 'lambda',
        description: 'Lambda 함수 코드 (예약 CRUD API)',
        usedInTask: '태스크 2: Lambda 함수 생성',
      },
      {
        name: 'test_api.html',
        type: 'code',
        description: 'API 테스트용 웹 페이지',
        usedInTask: '태스크 5: API 테스트',
      },
      {
        name: 'README.md',
        type: 'document',
        description: 'API 사용 방법 및 Cognito 설정 가이드',
        usedInTask: '참고 자료',
      },
    ],
    cloudFormationResources: [],
    notes: 'Lambda 함수 코드 제공, API Gateway와 Cognito는 콘솔에서 직접 생성',
  },
  {
    week: 4,
    session: 3,
    sessionType: 'lab',
    hasPrerequisites: true,
    zipFileName: 'week4-3-eventbridge-lab.zip',
    files: [
      {
        name: 'lambda_function.py',
        type: 'lambda',
        description: 'Lambda 함수 코드 (이벤트 처리)',
        usedInTask: '태스크 2: Lambda 함수 생성',
      },
      {
        name: 'event-pattern.json',
        type: 'config',
        description: 'EventBridge 이벤트 패턴',
        usedInTask: '태스크 3: EventBridge 규칙 생성',
      },
      {
        name: 'test_event.json',
        type: 'config',
        description: '테스트 이벤트 샘플',
        usedInTask: '태스크 4: 이벤트 테스트',
      },
      {
        name: 'README.md',
        type: 'document',
        description: 'EventBridge 설정 가이드 및 이벤트 패턴 설명',
        usedInTask: '참고 자료',
      },
    ],
    cloudFormationResources: [],
    notes:
      'EventBridge 기반 이벤트 처리 시스템, Lambda와 EventBridge는 콘솔에서 직접 생성',
  },

  // ========================================
  // Week 5: 고성능 데이터베이스 설계
  // ========================================
  {
    week: 5,
    session: 1,
    sessionType: 'demo',
    hasPrerequisites: true,
    zipFileName: 'week5-1-rds-lab.zip',
    files: [
      {
        name: 'week5-1-rds-multi-az-lab.yaml',
        type: 'cloudformation',
        description:
          'VPC 환경 CloudFormation 템플릿 (VPC, 서브넷, 보안 그룹, DB 서브넷 그룹)',
        usedInTask: '태스크 0: 실습 환경 구축',
      },
      {
        name: 'init_database.sql',
        type: 'script',
        description: '데이터베이스 초기화 SQL 스크립트',
        usedInTask: '참고 자료',
      },
      {
        name: 'README.md',
        type: 'document',
        description: 'MySQL 클라이언트 연결 방법 및 페일오버 테스트 가이드',
        usedInTask: '참고 자료',
      },
    ],
    cloudFormationResources: [
      'VPC (10.0.0.0/16)',
      '퍼블릭 서브넷 2개 (Multi-AZ)',
      '프라이빗 서브넷 2개 (Multi-AZ)',
      '인터넷 게이트웨이',
      'NAT Gateway',
      'RDS 보안 그룹',
      'EC2 보안 그룹 (MySQL 클라이언트용)',
      'DB 서브넷 그룹',
    ],
    notes:
      'CloudFormation으로 네트워크 환경 자동 생성, RDS Multi-AZ 인스턴스는 콘솔에서 직접 생성',
  },
  {
    week: 5,
    session: 2,
    sessionType: 'theory',
    hasPrerequisites: false,
    files: [],
  },
  {
    week: 5,
    session: 3,
    sessionType: 'lab',
    hasPrerequisites: true,
    zipFileName: 'week5-3-dynamodb-lab.zip',
    files: [
      {
        name: 'sample_orders.json',
        type: 'data',
        description: '샘플 주문 데이터 JSON (batch-write용)',
        usedInTask: '태스크 2: 샘플 데이터 입력',
      },
      {
        name: 'README.md',
        type: 'document',
        description: 'DynamoDB 테이블 설계 및 GSI 활용 가이드',
        usedInTask: '참고 자료',
      },
    ],
    cloudFormationResources: [],
    notes: 'DynamoDB 테이블과 GSI는 콘솔에서 직접 생성',
  },

  // ========================================
  // Week 6: IaC 기반 인프라 자동화
  // ========================================
  {
    week: 6,
    session: 1,
    sessionType: 'demo',
    hasPrerequisites: false,
    files: [],
    notes: 'CloudFormation 콘솔에서 직접 템플릿 작성 및 변경 세트 데모',
  },
  {
    week: 6,
    session: 2,
    sessionType: 'lab',
    hasPrerequisites: true,
    zipFileName: 'week6-2-cloudformation-lab.zip',
    files: [
      {
        name: 'simple-s3-template.yaml',
        type: 'cloudformation',
        description: 'S3 버킷 생성 CloudFormation 템플릿 예시',
        usedInTask: '태스크 1: 간단한 템플릿 작성',
      },
      {
        name: 'vpc-ec2-template.yaml',
        type: 'cloudformation',
        description: 'VPC + EC2 CloudFormation 템플릿 예시',
        usedInTask: '태스크 2: VPC 템플릿 작성',
      },
      {
        name: 'README.md',
        type: 'document',
        description: 'CloudFormation 템플릿 작성 가이드',
        usedInTask: '참고 자료',
      },
    ],
    notes: 'CloudFormation 스택은 콘솔에서 직접 생성',
  },
  {
    week: 6,
    session: 3,
    sessionType: 'lab',
    hasPrerequisites: false,
    files: [],
    notes: 'AWS Infrastructure Composer 콘솔에서 직접 사용',
  },

  // ========================================
  // Week 7: 컨테이너 기반 아키텍처
  // ========================================
  {
    week: 7,
    session: 1,
    sessionType: 'theory',
    hasPrerequisites: false,
    files: [],
  },
  {
    week: 7,
    session: 2,
    sessionType: 'theory',
    hasPrerequisites: false,
    files: [],
  },
  {
    week: 7,
    session: 3,
    sessionType: 'lab',
    hasPrerequisites: true,
    zipFileName: 'week7-3-eks-lab.zip',
    files: [
      {
        name: 'week7-3-eks-lab.yaml',
        type: 'cloudformation',
        description: 'EKS 클러스터 및 노드 그룹 자동 생성 템플릿',
        usedInTask: '태스크 0: EKS 클러스터 생성 (CloudFormation 스택 배포)',
      },
    ],
    cloudFormationResources: [
      'VPC (퍼블릭 서브넷 2개)',
      'EKS Cluster',
      'EKS NodeGroup (t3.medium)',
      'IAM Roles (Cluster Role, Node Role)',
    ],
    notes:
      'CloudFormation으로 클러스터 자동 생성 후 kubectl 명령 실습. 선택사항: 마지막 섹션에서 콘솔로 클러스터 수동 생성 방법 안내',
  },

  // ========================================
  // Week 8: 중간고사
  // ========================================
  {
    week: 8,
    session: 1,
    sessionType: 'none',
    hasPrerequisites: false,
    files: [],
  },

  // ========================================
  // Week 9: CI/CD 파이프라인 구축
  // ========================================
  {
    week: 9,
    session: 1,
    sessionType: 'theory',
    hasPrerequisites: false,
    files: [],
  },
  {
    week: 9,
    session: 2,
    sessionType: 'lab',
    hasPrerequisites: true,
    zipFileName: 'week9-2-cicd-lab.zip',
    files: [
      {
        name: 'app.js',
        type: 'code',
        description: 'Node.js 애플리케이션 소스 코드',
        usedInTask: '태스크 1: 소스 코드 확인',
      },
      {
        name: 'buildspec.yml',
        type: 'config',
        description: 'CodeBuild 빌드 스펙',
        usedInTask: '태스크 2: CodeBuild 프로젝트 생성',
      },
      {
        name: 'Dockerfile',
        type: 'config',
        description: 'Docker 이미지 빌드 파일',
        usedInTask: '태스크 2: 컨테이너 이미지 빌드',
      },
      {
        name: 'package.json',
        type: 'config',
        description: 'Node.js 패키지 의존성 파일',
        usedInTask: '태스크 1: 소스 코드 확인',
      },
      {
        name: 'README.md',
        type: 'document',
        description: 'CI/CD 실습 가이드',
        usedInTask: '참고 자료',
      },
    ],
    cloudFormationResources: [],
    notes: 'CodeCommit, ECR, CodeBuild는 콘솔에서 직접 생성',
  },
  {
    week: 9,
    session: 3,
    sessionType: 'lab',
    hasPrerequisites: true,
    zipFileName: 'week9-3-s3-website-lab.zip',
    files: [
      {
        name: 'cloudformation-template.yaml',
        type: 'cloudformation',
        description: 'S3 버킷 및 CodePipeline 환경 CloudFormation 템플릿',
        usedInTask: '태스크 0: 실습 환경 구축',
      },
      {
        name: 'index.html',
        type: 'code',
        description: '메인 페이지 HTML',
        usedInTask: '태스크 2: 웹사이트 파일 업로드',
      },
      {
        name: 'about.html',
        type: 'code',
        description: '소개 페이지 HTML',
        usedInTask: '태스크 2: 웹사이트 파일 업로드',
      },
      {
        name: 'style.css',
        type: 'code',
        description: '스타일시트',
        usedInTask: '태스크 2: 웹사이트 파일 업로드',
      },
      {
        name: 'script.js',
        type: 'code',
        description: 'JavaScript 파일',
        usedInTask: '태스크 2: 웹사이트 파일 업로드',
      },
      {
        name: 'buildspec.yml',
        type: 'yaml',
        description: 'CodeBuild 빌드 스펙',
        usedInTask: '태스크 3: CodePipeline 생성',
      },
    ],
    notes: 'CloudFormation으로 S3 버킷 및 CodePipeline 환경 자동 생성',
  },

  // ========================================
  // Week 10: 캐싱 및 성능 최적화
  // ========================================
  {
    week: 10,
    session: 1,
    sessionType: 'lab',
    hasPrerequisites: true,
    zipFileName: 'week10-1-elasticache-lab.zip',
    files: [
      {
        name: '.env.example',
        type: 'config',
        description: '환경 변수 예시 파일',
        usedInTask: '태스크 1: 환경 설정',
      },
      {
        name: 'app.py',
        type: 'code',
        description: 'Flask 애플리케이션 소스 코드',
        usedInTask: '태스크 2: 애플리케이션 실행',
      },
      {
        name: 'benchmark.py',
        type: 'script',
        description: '성능 벤치마크 스크립트',
        usedInTask: '태스크 3: 성능 비교',
      },
      {
        name: 'init_db.sql',
        type: 'script',
        description: '데이터베이스 초기화 SQL 스크립트',
        usedInTask: '태스크 1: 데이터베이스 초기화',
      },
      {
        name: 'README.md',
        type: 'document',
        description: 'ElastiCache 실습 가이드',
        usedInTask: '참고 자료',
      },
      {
        name: 'requirements.txt',
        type: 'config',
        description: 'Python 패키지 의존성 파일',
        usedInTask: '태스크 1: 환경 설정',
      },
    ],
    notes: 'ElastiCache Valkey 캐시는 콘솔에서 직접 생성',
  },
  {
    week: 10,
    session: 2,
    sessionType: 'theory',
    hasPrerequisites: false,
    files: [],
    notes: 'ElastiCache 개념 이론 강의',
  },
  {
    week: 10,
    session: 3,
    sessionType: 'demo',
    hasPrerequisites: true,
    zipFileName: 'week10-3-cloudfront-demo.zip',
    files: [
      {
        name: 'index.html',
        type: 'code',
        description: 'HTML 메인 페이지',
        usedInTask: '태스크 1: S3 버킷에 업로드',
      },
      {
        name: 'about.html',
        type: 'code',
        description: 'HTML About 페이지',
        usedInTask: '태스크 1: S3 버킷에 업로드',
      },
      {
        name: 'style.css',
        type: 'code',
        description: 'CSS 스타일시트',
        usedInTask: '태스크 1: S3 버킷에 업로드',
      },
      {
        name: 'script.js',
        type: 'code',
        description: 'JavaScript 파일',
        usedInTask: '태스크 1: S3 버킷에 업로드',
      },
      {
        name: 'README.md',
        type: 'document',
        description: 'CloudFront 데모 가이드',
        usedInTask: '참고 자료',
      },
    ],
    cloudFormationResources: [],
    notes: 'S3 버킷, CloudFront 배포, CloudFront Functions는 콘솔에서 직접 생성',
  },

  // ========================================
  // Week 11: 데이터 레이크 및 분석 파이프라인
  // ========================================
  {
    week: 11,
    session: 1,
    sessionType: 'theory',
    hasPrerequisites: false,
    files: [],
  },
  {
    week: 11,
    session: 2,
    sessionType: 'lab',
    hasPrerequisites: true,
    zipFileName: 'week11-2-datalake-lab.zip',
    files: [
      {
        name: 'week11-2-datalake-lab.yaml',
        type: 'cloudformation',
        description: 'Amazon S3 버킷 3개, IAM 역할, 샘플 데이터 자동 업로드 템플릿',
        usedInTask: '태스크 0: Amazon S3 데이터 레이크 환경 구축',
      },
      {
        name: 'sales.csv',
        type: 'data',
        description: '매출 샘플 데이터 CSV 파일 (참고용)',
        usedInTask: '참고 자료',
      },
      {
        name: 'customers.json',
        type: 'data',
        description: '고객 샘플 데이터 JSON 파일 (참고용)',
        usedInTask: '참고 자료',
      },
    ],
    cloudFormationResources: [
      'S3 Bucket 3개 (Raw, Processed, Query Results)',
      'IAM Role (GlueCrawlerRole)',
      'Lambda Function (샘플 데이터 업로드)',
    ],
    notes:
      'CloudFormation으로 S3 버킷 + IAM 역할 + 샘플 데이터만 생성. Glue Database, Crawler, Athena Workgroup은 학생이 콘솔에서 직접 생성',
  },
  {
    week: 11,
    session: 3,
    sessionType: 'lab',
    hasPrerequisites: true,
    zipFileName: 'week11-3-data-pipeline-lab.zip',
    files: [
      {
        name: 'week11-3-data-pipeline-lab.yaml',
        type: 'cloudformation',
        description: 'CloudFormation 템플릿 (S3 버킷, IAM 역할, Lambda, EventBridge, 샘플 데이터)',
        usedInTask: '태스크 0: 실습 환경 구축',
      },
      {
        name: 'sales-data.csv',
        type: 'data',
        description: '추가 테스트 데이터 (파이프라인 테스트용)',
        usedInTask: '태스크 5: 파이프라인 테스트',
      },
      {
        name: 'sales-data-2.csv',
        type: 'data',
        description: '추가 테스트 데이터 (파이프라인 테스트용)',
        usedInTask: '태스크 5: 파이프라인 테스트',
      },
    ],
    cloudFormationResources: [
      'S3 Bucket 3개 (Data, Scripts, Temp)',
      'IAM Role 2개 (Glue 서비스 역할, Lambda 실행 역할)',
      'Lambda Function (Crawler 자동 트리거)',
      'EventBridge Rule (S3 이벤트 감지)',
      '샘플 데이터 (transactions.csv 자동 업로드)',
    ],
    notes:
      'CloudFormation으로 S3 버킷 + IAM 역할 + Lambda + EventBridge + 샘플 데이터만 생성. Glue Database, Crawler, Visual ETL Job은 학생이 콘솔에서 직접 생성',
  },

  // ========================================
  // Week 12: 보안 자동화 및 컴플라이언스
  // ========================================
  {
    week: 12,
    session: 1,
    sessionType: 'lab',
    hasPrerequisites: true,
    zipFileName: 'week12-1-secrets-manager-files.zip',
    files: [
      {
        name: 'lambda_function.py',
        type: 'lambda',
        description: 'Lambda 함수 코드 (Parameter Store 읽기)',
        usedInTask: '태스크 2: Lambda 함수 생성',
      },
      {
        name: 'lambda-iam-policy.json',
        type: 'config',
        description: 'Lambda 실행 역할 IAM 정책',
        usedInTask: '태스크 1: IAM 역할 생성',
      },
      {
        name: 'README.txt',
        type: 'document',
        description: 'Secrets Manager 실습 가이드',
        usedInTask: '참고 자료',
      },
    ],
    cloudFormationResources: [],
    notes: 'Lambda, IAM 역할, Parameter Store는 콘솔에서 직접 생성',
  },
  {
    week: 12,
    session: 2,
    sessionType: 'demo',
    hasPrerequisites: false,
    files: [],
    notes: 'AWS Config는 콘솔에서 직접 설정하고 규칙 생성',
  },
  {
    week: 12,
    session: 3,
    sessionType: 'demo',
    hasPrerequisites: true,
    zipFileName: 'week12-3-guardduty-lambda.zip',
    files: [
      {
        name: 'lambda_function.py',
        type: 'lambda',
        description: 'Lambda 함수 코드 (GuardDuty 자동 대응)',
        usedInTask: '태스크 2: Lambda 함수 생성',
      },
    ],
    cloudFormationResources: [],
    notes: 'GuardDuty, EventBridge, Lambda, SNS는 콘솔에서 직접 생성',
  },

  // ========================================
  // Week 13: 비용 최적화 및 관측성
  // ========================================
  {
    week: 13,
    session: 1,
    sessionType: 'theory',
    hasPrerequisites: false,
    files: [],
  },
  {
    week: 13,
    session: 2,
    sessionType: 'demo',
    hasPrerequisites: true,
    zipFileName: 'week13-2-xray-files.zip',
    files: [
      {
        name: 'lambda_function.py',
        type: 'lambda',
        description: 'Lambda 함수 코드 (X-Ray SDK 포함)',
        usedInTask: '태스크 2: Lambda 함수 생성 및 코드 배포',
      },
      {
        name: 'lambda-iam-policy.json',
        type: 'config',
        description: 'Lambda 실행 역할 IAM 정책',
        usedInTask: '태스크 4: IAM 권한 설정',
      },
      {
        name: 'README.txt',
        type: 'document',
        description: 'X-Ray 실습 안내 및 SDK 설치 방법',
        usedInTask: '참고 자료',
      },
    ],
    cloudFormationResources: [],
    notes: 'Lambda, API Gateway, DynamoDB는 콘솔에서 직접 생성',
  },
  {
    week: 13,
    session: 3,
    sessionType: 'demo',
    hasPrerequisites: false,
    files: [],
    notes: 'EKS 클러스터는 콘솔에서 직접 생성하고 Container Insights 활성화',
  },

  // ========================================
  // Week 14: 지능형 클라우드 서비스 설계
  // ========================================
  {
    week: 14,
    session: 1,
    sessionType: 'lab',
    hasPrerequisites: false,
    files: [],
    notes: 'Bedrock 콘솔에서 직접 프롬프트 엔지니어링 실습',
  },
  {
    week: 14,
    session: 2,
    sessionType: 'demo',
    hasPrerequisites: false,
    files: [],
    notes: 'Bedrock Knowledge Base는 콘솔에서 직접 생성하고 문서 업로드',
  },
  {
    week: 14,
    session: 3,
    sessionType: 'lab',
    hasPrerequisites: true,
    zipFileName: 'week14-3-bedrock-agent-lab.zip',
    files: [
      {
        name: 'bedrock_agent_lambda.py',
        type: 'lambda',
        description: 'Lambda 함수 코드 (Action Group용)',
        usedInTask: '태스크 2: Lambda 함수 생성',
      },
    ],
    cloudFormationResources: [],
    notes: 'Lambda, Bedrock Agent는 콘솔에서 직접 생성',
  },

  // ========================================
  // Week 15: 기말고사
  // ========================================
  {
    week: 15,
    session: 1,
    sessionType: 'none',
    hasPrerequisites: false,
    files: [],
  },
];

// ========================================
// 유틸리티 함수
// ========================================

/**
 * 특정 주차의 모든 세션 환경 정보 가져오기
 */
export const getWeekEnvironments = (week: number): LabEnvironment[] => {
  return labEnvironments.filter((env) => env.week === week);
};

/**
 * 특정 세션의 환경 정보 가져오기
 */
export const getSessionEnvironment = (
  week: number,
  session: number,
): LabEnvironment | undefined => {
  return labEnvironments.find(
    (env) => env.week === week && env.session === session,
  );
};

/**
 * 사전 환경이 필요한 모든 세션 목록
 */
export const getSessionsWithPrerequisites = (): LabEnvironment[] => {
  return labEnvironments.filter((env) => env.hasPrerequisites);
};

/**
 * 파일 타입별 통계
 */
export const getFileTypeStatistics = (): Record<FileType, number> => {
  const stats: Record<FileType, number> = {
    cloudformation: 0,
    lambda: 0,
    data: 0,
    yaml: 0,
    script: 0,
    config: 0,
    document: 0,
    code: 0,
    other: 0,
  };

  labEnvironments.forEach((env) => {
    env.files.forEach((file) => {
      stats[file.type]++;
    });
  });

  return stats;
};

/**
 * 전체 파일 수 계산
 */
export const getTotalFileCount = (): number => {
  return labEnvironments.reduce((total, env) => total + env.files.length, 0);
};

/**
 * ZIP 파일이 있는 세션 목록
 */
export const getSessionsWithZipFiles = (): LabEnvironment[] => {
  return labEnvironments.filter((env) => env.zipFileName);
};

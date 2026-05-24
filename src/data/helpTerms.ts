// 용어 사전 데이터
export interface Term {
    term: string
    definition: string
    category: string
    awsCategory?: string // AWS 서비스 카테고리명
    weeks?: string[] // 실습/데모에서 다루는 주차
}

// 실습/데모 가이드 관련 용어 데이터
export const labTerms: Term[] = [
    // AWS 서비스 (알파벳 순)
    {
        term: 'Amazon Athena',
        definition: 'S3에 저장된 데이터를 SQL로 직접 분석할 수 있는 서버리스 쿼리 서비스입니다. 별도의 데이터베이스 구축 없이 표준 SQL을 사용하여 데이터를 분석할 수 있습니다.',
        category: 'AWS 서비스',
        awsCategory: 'Analytics',
        weeks: ['Week 11-2', 'Week 11-3']
    },
    {
        term: 'Amazon Aurora',
        definition: 'MySQL 및 PostgreSQL과 호환되는 고성능 관계형 데이터베이스입니다. 상용 데이터베이스의 성능과 가용성을 오픈소스 데이터베이스의 비용으로 제공합니다.',
        category: 'AWS 서비스',
        awsCategory: 'Database',
        weeks: ['Week 3-2', 'Week 5-1']
    },
    {
        term: 'Amazon CloudFront',
        definition: '전 세계 엣지 로케이션을 통해 콘텐츠를 빠르게 전송하는 CDN(Content Delivery Network) 서비스입니다. 웹사이트, API, 동영상 스트리밍 등의 성능을 향상시킵니다.\n\n주요 개념:\n• Distribution - CloudFront 배포 단위\n• Origin - 원본 콘텐츠 위치 (S3, EC2, ALB 등)\n• Edge Location - 전 세계 400개 이상 캐시 서버\n• Cache Behavior - 캐싱 규칙 및 경로 패턴\n• TTL (Time To Live) - 캐시 유효 시간\n• Invalidation - 캐시 강제 삭제\n• OAC (Origin Access Control) - S3 비공개 접근\n• Custom Domain - Route 53 도메인 연결\n• SSL/TLS Certificate - HTTPS 암호화 (ACM)\n• Geo Restriction - 지역 기반 접근 제어\n• Lambda@Edge - 엣지에서 코드 실행\n• Real-time Logs - 실시간 로그 스트리밍',
        category: 'AWS 서비스',
        awsCategory: 'Networking',
        weeks: ['Week 10-3', 'Week 14-2']
    },
    {
        term: 'CloudFront Functions',
        definition: 'CloudFront 엣지 로케이션에서 경량 JavaScript 코드를 실행하는 서버리스 엣지 컴퓨팅 기능입니다. 뷰어 요청/응답 시점에 서브밀리초 단위로 실행되며, URL 리다이렉트, 헤더 조작, 캐시 키 정규화, 요청 인증 등에 사용됩니다. Lambda@Edge보다 가볍고 빠르며, 초당 수백만 요청을 처리할 수 있습니다.',
        category: 'AWS 서비스',
        awsCategory: 'Networking',
        weeks: ['Week 10-3']
    },
    {
        term: 'Amazon CloudWatch',
        definition: 'AWS 리소스와 애플리케이션을 실시간으로 모니터링하는 서비스입니다. 로그 수집, 메트릭 추적, 알람 설정 등을 통해 시스템 상태를 관리할 수 있습니다.',
        category: 'AWS 서비스',
        awsCategory: 'Management',
        weeks: ['Week 13-2']
    },
    {
        term: 'Amazon Cognito',
        definition: '사용자 인증 및 권한 부여를 제공하는 완전 관리형 서비스입니다. 사용자 등록, 로그인, 소셜 로그인, MFA 등을 지원하며, JWT 토큰 기반 인증을 구현할 수 있습니다.',
        category: 'AWS 서비스',
        awsCategory: 'Security',
        weeks: ['Week 4-3']
    },
    {
        term: 'Amazon DynamoDB',
        definition: '완전 관리형 NoSQL 데이터베이스로, 밀리초 단위의 빠른 응답 속도와 무제한 확장성을 제공합니다. 키-값 및 문서 데이터 모델을 지원합니다.\n\n주요 개념:\n• Partition Key - 데이터 분산 저장을 위한 기본 키\n• Sort Key - 파티션 내 데이터 정렬 키\n• GSI (Global Secondary Index) - 다른 쿼리 패턴 지원\n• LSI (Local Secondary Index) - 동일 파티션 키로 다른 정렬\n• On-Demand Mode - 자동 확장/축소 용량 모드\n• Provisioned Mode - 읽기/쓰기 용량 사전 지정\n• Streams - 데이터 변경 이벤트 캡처\n• TTL (Time To Live) - 항목 자동 만료 및 삭제\n• Transactions - ACID 트랜잭션 지원\n• PartiQL - SQL 유사 쿼리 언어\n• Point-in-Time Recovery - 특정 시점 복구\n• Global Tables - 다중 리전 복제',
        category: 'AWS 서비스',
        awsCategory: 'Database',
        weeks: ['Week 4-3', 'Week 5-3']
    },
    {
        term: 'Amazon EC2',
        definition: '크기 조정 가능한 가상 서버(인스턴스)를 제공하는 컴퓨팅 서비스입니다. 다양한 인스턴스 타입과 운영체제를 선택하여 애플리케이션을 실행할 수 있습니다.\n\n주요 개념:\n• Instance Types - 컴퓨팅 성능 조합 (t2.micro, m5.large 등)\n• AMI (Amazon Machine Image) - 인스턴스 템플릿\n• EBS (Elastic Block Store) - 영구 블록 스토리지\n• Instance Store - 임시 블록 스토리지\n• Security Group - 인스턴스 방화벽 규칙\n• Key Pair - SSH 접속용 공개/개인 키\n• User Data - 인스턴스 시작 시 실행 스크립트\n• Elastic IP - 고정 공인 IP 주소\n• Placement Group - 인스턴스 배치 전략\n• Auto Scaling - 자동 확장/축소\n• Load Balancer - 트래픽 분산 (ALB, NLB)\n• Spot Instance - 저렴한 예비 용량',
        category: 'AWS 서비스',
        awsCategory: 'Compute',
        weeks: ['Week 1-3', 'Week 2-1', 'Week 3-1', 'Week 3-2']
    },
    {
        term: 'Amazon ECR',
        definition: 'Docker 컨테이너 이미지를 안전하게 저장, 관리, 배포하는 완전 관리형 컨테이너 레지스트리 서비스입니다. ECS, EKS와 통합되어 사용됩니다.',
        category: 'AWS 서비스',
        awsCategory: 'Containers',
        weeks: ['Week 7-1']
    },
    {
        term: 'Amazon ECS',
        definition: 'Docker 컨테이너를 쉽게 실행, 중지, 관리할 수 있는 완전 관리형 컨테이너 오케스트레이션 서비스입니다. Fargate 또는 EC2에서 실행할 수 있습니다.',
        category: 'AWS 서비스',
        awsCategory: 'Containers',
        weeks: ['Week 7-2']
    },
    {
        term: 'Amazon ElastiCache',
        definition: 'Valkey, Redis OSS, Memcached 기반의 완전 관리형 인메모리 캐시 서비스입니다. 데이터베이스 부하를 줄이고 애플리케이션 응답 속도를 향상시킵니다. AWS는 Valkey를 권장 엔진으로 제공하며, Redis OSS 대비 최대 33% 저렴합니다.',
        category: 'AWS 서비스',
        awsCategory: 'Database',
        weeks: ['Week 10-1']
    },
    {
        term: 'Valkey',
        definition: 'Redis OSS와 완전 호환되는 오픈소스 인메모리 데이터 저장소입니다. 2024년 Linux Foundation에서 시작된 프로젝트로, Amazon ElastiCache의 권장 엔진입니다. Redis OSS v7.0과 동일한 명령어, 데이터 구조, 클라이언트 라이브러리를 지원하며, 최대 33% 저렴합니다.',
        category: 'AWS 서비스',
        awsCategory: 'Database',
        weeks: ['Week 10-2']
    },
    {
        term: 'Amazon RDS',
        definition: '관계형 데이터베이스를 쉽게 설정, 운영, 확장할 수 있는 관리형 서비스입니다. MySQL, PostgreSQL, Oracle, SQL Server 등을 지원하며, 자동 백업과 패치를 제공합니다.\n\n주요 개념:\n• Multi-AZ - 여러 가용 영역에 동기식 복제 (고가용성)\n• Read Replica - 읽기 전용 복제본 (성능 향상)\n• Automated Backup - 자동 백업 및 특정 시점 복구\n• Snapshot - 수동 백업 및 복원\n• Parameter Group - 데이터베이스 설정 관리\n• Option Group - 추가 기능 활성화\n• DB Subnet Group - VPC 내 서브넷 지정\n• Security Group - 네트워크 접근 제어\n• Enhanced Monitoring - 상세 모니터링 메트릭\n• Performance Insights - 쿼리 성능 분석\n• Encryption - 저장 데이터 암호화 (KMS)\n• IAM Database Authentication - IAM 기반 인증',
        category: 'AWS 서비스',
        awsCategory: 'Database',
        weeks: ['Week 5-1', 'Week 10-1']
    },
    {
        term: 'Amazon Route 53',
        definition: '확장 가능한 DNS 웹 서비스로, 도메인 등록, DNS 라우팅, 헬스 체크 기능을 제공합니다. 지연 시간 기반, 지리적 위치 기반 등 다양한 라우팅 정책을 지원합니다.',
        category: 'AWS 서비스',
        awsCategory: 'Networking',
        weeks: ['Week 14-2']
    },
    {
        term: 'Amazon S3',
        definition: '무제한 용량의 객체 스토리지 서비스로, 파일을 버킷에 저장하고 관리합니다. 높은 내구성(99.999999999%)과 가용성을 제공하며, 정적 웹사이트 호스팅도 가능합니다.\n\n주요 개념:\n• Bucket - 객체를 저장하는 최상위 컨테이너\n• Object - 파일과 메타데이터의 조합 (최대 5TB)\n• Versioning - 객체의 여러 버전 유지 및 복구\n• Lifecycle Policy - 객체 자동 전환 및 삭제 규칙\n• Storage Class - Standard, IA, Glacier 등 비용 최적화 옵션\n• Bucket Policy - 버킷 수준의 액세스 제어\n• ACL (Access Control List) - 객체 수준의 권한 관리\n• CORS - 다른 도메인에서의 접근 허용 설정\n• Static Website Hosting - HTML/CSS/JS 정적 사이트 호스팅\n• Presigned URL - 임시 접근 권한 URL 생성\n• Multipart Upload - 대용량 파일 분할 업로드\n• S3 Select - SQL로 객체 내용 직접 쿼리',
        category: 'AWS 서비스',
        awsCategory: 'Storage',
        weeks: ['Week 2-2', 'Week 6-1', 'Week 10-3', 'Week 11-2', 'Week 11-3']
    },
    {
        term: 'Amazon SageMaker AI',
        definition: '머신러닝 모델을 구축, 학습, 배포할 수 있는 완전 관리형 서비스입니다. Jupyter 노트북, 자동 모델 튜닝, 파이프라인 등 ML 워크플로우 전체를 지원합니다.',
        category: 'AWS 서비스',
        awsCategory: 'AI/ML'
    },
    {
        term: 'Amazon VPC',
        definition: '논리적으로 격리된 가상 네트워크 공간을 제공하는 서비스입니다. 서브넷, 라우팅 테이블, 게이트웨이 등을 구성하여 AWS 리소스를 안전하게 배치할 수 있습니다.\n\n주요 개념:\n• Subnet - VPC 내부를 나눈 네트워크 영역 (Public/Private)\n• Route Table - 네트워크 트래픽 경로 지정 규칙\n• Internet Gateway - VPC와 인터넷 연결\n• NAT Gateway - Private Subnet의 아웃바운드 인터넷 접근\n• Security Group - 인스턴스 수준 가상 방화벽 (Stateful)\n• NACL - 서브넷 수준 네트워크 ACL (Stateless)\n• VPC Peering - VPC 간 프라이빗 연결\n• VPC Endpoint - AWS 서비스와 프라이빗 연결\n• Elastic IP - 고정 공인 IPv4 주소\n• CIDR Block - IP 주소 범위 (예: 10.0.0.0/16)\n• Transit Gateway - 여러 VPC 중앙 연결\n• VPN - 온프레미스와 암호화 연결',
        category: 'AWS 서비스',
        awsCategory: 'Networking',
        weeks: ['Week 1-3', 'Week 3-1', 'Week 3-2', 'Week 5-1', 'Week 6-2']
    },
    {
        term: 'API Gateway',
        definition: 'RESTful API와 WebSocket API를 생성, 게시, 유지 관리할 수 있는 완전 관리형 서비스입니다. Lambda와 통합하여 서버리스 API를 구축할 수 있습니다.\n\n주요 개념:\n• REST API - HTTP 메서드 기반 API (GET, POST, PUT, DELETE)\n• WebSocket API - 양방향 실시간 통신 API\n• Resource - API 경로 (예: /users, /orders)\n• Method - HTTP 메서드 및 통합 설정\n• Stage - 배포 환경 (dev, test, prod)\n• Deployment - API 변경사항 배포\n• Authorizer - Cognito, Lambda 기반 인증\n• API Key - API 사용량 제어 및 추적\n• Usage Plan - API 호출 할당량 및 스로틀링\n• CORS - 크로스 오리진 리소스 공유 설정\n• Lambda Proxy Integration - Lambda와 직접 통합\n• Request/Response Transformation - 데이터 변환',
        category: 'AWS 서비스',
        awsCategory: 'Networking',
        weeks: ['Week 4-1', 'Week 4-3']
    },
    {
        term: 'AWS Auto Scaling',
        definition: '애플리케이션 수요에 따라 EC2 인스턴스, ECS 태스크 등의 리소스를 자동으로 조정하는 서비스입니다. 비용 최적화와 가용성 유지를 동시에 달성할 수 있습니다.',
        category: 'AWS 서비스',
        awsCategory: 'Compute'
    },
    {
        term: 'AWS Budgets',
        definition: 'AWS 비용 및 사용량에 대한 예산을 설정하고 알림을 받을 수 있는 서비스입니다. 예산 초과 시 자동으로 알림을 보내거나 작업을 실행할 수 있습니다.',
        category: 'AWS 서비스',
        awsCategory: 'Cost Management',
        weeks: ['Week 13-1']
    },
    {
        term: 'AWS CloudFormation',
        definition: '인프라를 코드(YAML/JSON)로 정의하고 자동으로 프로비저닝하는 IaC(Infrastructure as Code) 서비스입니다. 스택 단위로 리소스를 생성, 업데이트, 삭제할 수 있습니다.',
        category: 'AWS 서비스',
        awsCategory: 'Management',
        weeks: ['Week 6-1', 'Week 6-2']
    },
    {
        term: 'AWS CloudShell',
        definition: '브라우저 기반 셸 환경으로, AWS CLI, Python, Node.js 등이 사전 설치되어 있습니다. 별도의 설정 없이 AWS 리소스를 관리할 수 있습니다.',
        category: 'AWS 서비스',
        awsCategory: 'Management',
        weeks: ['Week 7-1']
    },
    {
        term: 'AWS CodeBuild',
        definition: '소스 코드를 컴파일하고 테스트를 실행하는 완전 관리형 빌드 서비스입니다. Docker 이미지 빌드, 테스트 자동화 등을 지원합니다.',
        category: 'AWS 서비스',
        awsCategory: 'Developer Tools',
        weeks: ['Week 9-2']
    },
    {
        term: 'AWS CodeCommit',
        definition: 'Git 기반의 프라이빗 소스 코드 버전 관리 서비스입니다. GitHub와 유사하지만 AWS 환경에 완전히 통합되어 있습니다.',
        category: 'AWS 서비스',
        awsCategory: 'Developer Tools'
    },
    {
        term: 'AWS CodeDeploy',
        definition: 'EC2, Lambda, ECS 등에 애플리케이션을 자동으로 배포하는 서비스입니다. 블루/그린 배포, 롤링 배포 등 다양한 배포 전략을 지원합니다.',
        category: 'AWS 서비스',
        awsCategory: 'Developer Tools',
        weeks: ['Week 9-2']
    },
    {
        term: 'AWS CodePipeline',
        definition: '소스 코드 변경부터 빌드, 테스트, 배포까지 전체 CI/CD 프로세스를 자동화하는 서비스입니다. CodeCommit, CodeBuild, CodeDeploy 등과 통합됩니다.',
        category: 'AWS 서비스',
        awsCategory: 'Developer Tools',
        weeks: ['Week 9-2']
    },
    {
        term: 'AWS Config',
        definition: 'AWS 리소스의 구성 변경 사항을 기록하고 평가하는 서비스입니다. 규정 준수 감사, 보안 분석, 변경 추적 등에 사용됩니다.',
        category: 'AWS 서비스',
        awsCategory: 'Management',
        weeks: ['Week 12-2']
    },
    {
        term: 'AWS Cost Explorer',
        definition: 'AWS 비용과 사용량을 시각화하고 분석하는 도구입니다. 과거 데이터를 기반으로 미래 비용을 예측하고, 비용 절감 기회를 식별할 수 있습니다.',
        category: 'AWS 서비스',
        awsCategory: 'Cost Management',
        weeks: ['Week 13-1']
    },
    {
        term: 'AWS Fargate',
        definition: '서버를 관리할 필요 없이 컨테이너를 실행할 수 있는 서버리스 컴퓨팅 엔진입니다. ECS 또는 EKS와 함께 사용하여 인프라 관리 부담을 제거합니다.',
        category: 'AWS 서비스',
        awsCategory: 'Containers',
        weeks: ['Week 7-2']
    },
    {
        term: 'AWS Glue',
        definition: 'ETL(추출, 변환, 로드) 작업을 자동화하는 서버리스 데이터 통합 서비스입니다. 데이터 카탈로그를 생성하고 데이터를 변환하여 분석 준비를 합니다.',
        category: 'AWS 서비스',
        awsCategory: 'Analytics',
        weeks: ['Week 11-2', 'Week 11-3']
    },
    {
        term: 'AWS IAM',
        definition: 'AWS 리소스에 대한 액세스를 안전하게 제어하는 서비스입니다. 사용자, 그룹, 역할, 정책을 통해 세밀한 권한 관리가 가능합니다.\n\n주요 개념:\n• User - AWS 계정 내 개별 사용자 (장기 자격증명)\n• Group - 사용자 집합 (권한 일괄 관리)\n• Role - 임시 자격증명 제공 (AssumeRole)\n• Policy - JSON 형식 권한 정의 (Effect, Action, Resource)\n• Trust Policy - 역할을 맡을 수 있는 주체 정의\n• Permission Boundary - 최대 권한 제한\n• MFA (Multi-Factor Authentication) - 다중 인증\n• Access Key - 프로그래밍 방식 액세스\n• IAM Identity Center - 중앙 집중식 액세스 관리\n• Service Control Policy (SCP) - Organizations 정책\n• Condition - 정책 조건 (IP, 시간, MFA 등)\n• Principal - 권한을 받는 주체',
        category: 'AWS 서비스',
        awsCategory: 'Security',
        weeks: ['Week 2-1', 'Week 2-2', 'Week 5-3']
    },
    {
        term: 'AWS KMS',
        definition: '암호화 키를 생성하고 관리하는 서비스입니다. 데이터 암호화, 디지털 서명, 키 교체 등을 지원하며, 다른 AWS 서비스와 통합됩니다.',
        category: 'AWS 서비스',
        awsCategory: 'Security'
    },
    {
        term: 'AWS Lambda',
        definition: '서버 관리 없이 코드를 실행할 수 있는 서버리스 컴퓨팅 서비스입니다. 이벤트에 응답하여 자동으로 실행되며, 사용한 컴퓨팅 시간만큼만 비용을 지불합니다.\n\n주요 개념:\n• Lambda Layer - 공통 라이브러리 패키징\n• Function URL - 직접 HTTPS 엔드포인트\n• Execution Role - IAM 권한 관리\n• Environment Variables - 설정값 전달\n• Concurrency - 동시 실행 수 제어\n• Proxy Integration - API Gateway 통합\n• Trigger - 이벤트 소스 (S3, DynamoDB, EventBridge 등)\n• Timeout - 최대 실행 시간 (최대 15분)\n• Memory - 메모리 할당 (128MB~10GB)\n• Destination - 실행 결과 자동 전달\n• Dead Letter Queue - 실패 이벤트 저장',
        category: 'AWS 서비스',
        awsCategory: 'Compute',
        weeks: ['Week 4-1', 'Week 4-2', 'Week 4-3', 'Week 11-3']
    },
    {
        term: 'AWS Management Console',
        definition: 'AWS 서비스를 관리할 수 있는 웹 기반 사용자 인터페이스입니다. 브라우저에서 접속하여 시각적으로 리소스를 생성, 수정, 삭제할 수 있습니다.',
        category: 'AWS 서비스',
        awsCategory: 'Management',
        weeks: ['Week 1-1']
    },
    {
        term: 'AWS Organizations',
        definition: '여러 AWS 계정을 중앙에서 관리하고 통합하는 서비스입니다. 계정 그룹화, 정책 적용, 통합 결제 등을 지원합니다.',
        category: 'AWS 서비스',
        awsCategory: 'Management',
        weeks: ['Week 12-2', 'Week 13-1']
    },
    {
        term: 'AWS Secrets Manager',
        definition: '데이터베이스 자격 증명, API 키, 비밀번호 등을 안전하게 저장하고 관리하는 서비스입니다. 자동 암호 교체 및 세밀한 액세스 제어를 제공합니다.',
        category: 'AWS 서비스',
        awsCategory: 'Security',
        weeks: ['Week 12-1']
    },
    {
        term: 'AWS SNS',
        definition: '게시-구독 모델의 메시징 서비스입니다. 이메일, SMS, 모바일 푸시, Lambda 등 다양한 엔드포인트로 알림을 전송할 수 있습니다.',
        category: 'AWS 서비스',
        awsCategory: 'Networking',
        weeks: ['Week 13-2']
    },
    {
        term: 'AWS SQS',
        definition: '완전 관리형 메시지 큐 서비스입니다. 마이크로서비스, 분산 시스템 간 메시지를 안정적으로 전달하며, 표준 큐와 FIFO 큐를 지원합니다.',
        category: 'AWS 서비스',
        awsCategory: 'Networking'
    },
    {
        term: 'AWS Systems Manager',
        definition: 'AWS 리소스를 중앙에서 관리하고 운영하는 서비스입니다. 패치 관리, 명령 실행, 파라미터 저장, 세션 관리 등을 제공합니다.',
        category: 'AWS 서비스',
        awsCategory: 'Management',
        weeks: ['Week 12-1', 'Week 12-2']
    },
    {
        term: 'AWS Well-Architected Tool',
        definition: '워크로드를 AWS 모범 사례와 비교하여 평가하는 도구입니다. 운영 우수성, 보안, 안정성, 성능 효율성, 비용 최적화, 지속 가능성 6가지 원칙을 기준으로 검토합니다.',
        category: 'AWS 서비스',
        awsCategory: 'Management',
        weeks: ['Week 1-1']
    },
    {
        term: 'AWS X-Ray',
        definition: '분산 애플리케이션을 추적하고 분석하는 서비스입니다. 요청 흐름을 시각화하고 병목 지점을 식별하여 성능을 최적화할 수 있습니다.',
        category: 'AWS 서비스',
        awsCategory: 'Management',
        weeks: ['Week 13-2']
    },
    {
        term: 'Amazon Bedrock',
        definition: '생성형 AI 기반 모델(Foundation Model)을 API로 제공하는 완전 관리형 서비스입니다. Claude, Llama, Titan 등 다양한 모델을 선택하여 텍스트 생성, 챗봇, 요약, 이미지 생성 등을 구현할 수 있습니다.',
        category: 'AWS 서비스',
        awsCategory: 'AI/ML',
        weeks: ['Week 14-1', 'Week 14-2', 'Week 14-3']
    },
    {
        term: 'Amazon GuardDuty',
        definition: 'AWS 계정과 워크로드를 지능형 위협 탐지로 보호하는 관리형 보안 서비스입니다. 머신러닝을 사용하여 악의적인 활동, 무단 액세스, 비정상적인 동작을 자동으로 탐지합니다.',
        category: 'AWS 서비스',
        awsCategory: 'Security',
        weeks: ['Week 12-3']
    },
    {
        term: 'Amazon EKS',
        definition: 'Elastic Kubernetes Service의 약자로, Kubernetes를 AWS에서 쉽게 실행할 수 있는 관리형 서비스입니다. 컨트롤 플레인의 설치, 운영, 유지 관리를 자동화하여 컨테이너 오케스트레이션을 간소화합니다.',
        category: 'AWS 서비스',
        awsCategory: 'Containers',
        weeks: ['Week 7-3', 'Week 13-3']
    },
    {
        term: 'Amazon OpenSearch Serverless',
        definition: 'OpenSearch를 서버리스로 실행할 수 있는 완전 관리형 서비스입니다. 인프라 관리 없이 로그 분석, 전체 텍스트 검색, 벡터 검색 등을 수행할 수 있습니다.',
        category: 'AWS 서비스',
        awsCategory: 'Analytics',
        weeks: ['Week 14-2']
    },
    {
        term: 'CloudTrail',
        definition: 'AWS 계정의 모든 API 호출을 기록하는 서비스입니다. 보안 분석, 규정 준수 감사, 운영 문제 해결에 사용됩니다.',
        category: 'AWS 서비스',
        awsCategory: 'Management'
    },
    {
        term: 'Application Load Balancer (ALB)',
        definition: 'HTTP/HTTPS 트래픽을 처리하는 Layer 7 로드 밸런서입니다. 경로 기반 라우팅, 호스트 기반 라우팅, WebSocket 지원 등 고급 기능을 제공합니다.',
        category: 'AWS 서비스',
        awsCategory: 'Networking',
        weeks: ['Week 3-2']
    },
    {
        term: 'Network Load Balancer (NLB)',
        definition: 'TCP/UDP 트래픽을 처리하는 Layer 4 로드 밸런서입니다. 초당 수백만 개의 요청을 처리할 수 있으며, 고정 IP 주소를 지원합니다.',
        category: 'AWS 서비스',
        awsCategory: 'Networking'
    },
    {
        term: 'EventBridge',
        definition: '서버리스 이벤트 버스 서비스입니다. AWS 서비스, SaaS 애플리케이션, 사용자 정의 애플리케이션 간 이벤트를 라우팅합니다.',
        category: 'AWS 서비스',
        awsCategory: 'Networking',
        weeks: ['Week 11-3']
    },
    {
        term: 'AWS Backup',
        definition: 'AWS 리소스의 백업을 중앙에서 관리하고 자동화하는 서비스입니다. EC2, RDS, DynamoDB, EFS 등 여러 서비스의 백업을 통합 관리할 수 있습니다.',
        category: 'AWS 서비스',
        awsCategory: 'Storage'
    },
    {
        term: 'AWS Certificate Manager (ACM)',
        definition: 'SSL/TLS 인증서를 무료로 프로비저닝, 관리, 배포하는 서비스입니다. CloudFront, ALB, API Gateway 등과 통합하여 HTTPS를 쉽게 구현할 수 있습니다.',
        category: 'AWS 서비스',
        awsCategory: 'Security',
        weeks: ['Week 10-3', 'Week 14-2']
    },
    {
        term: 'Amazon Inspector',
        definition: '애플리케이션의 보안 취약점을 자동으로 평가하는 서비스입니다. EC2 인스턴스와 컨테이너 이미지를 스캔하여 보안 문제를 식별합니다.',
        category: 'AWS 서비스',
        awsCategory: 'Security'
    },
    {
        term: 'AWS Shield',
        definition: 'DDoS(분산 서비스 거부) 공격으로부터 AWS 애플리케이션을 보호하는 관리형 서비스입니다. Standard와 Advanced 두 가지 티어를 제공합니다.',
        category: 'AWS 서비스',
        awsCategory: 'Security',
        weeks: ['Week 12-3']
    },
    {
        term: 'AWS WAF',
        definition: 'Web Application Firewall로, 웹 애플리케이션을 일반적인 웹 공격으로부터 보호합니다. SQL 인젝션, XSS 등의 공격을 차단하는 규칙을 설정할 수 있습니다.',
        category: 'AWS 서비스',
        awsCategory: 'Security',
        weeks: ['Week 12-3']
    },
    {
        term: 'AWS Security Hub',
        definition: '여러 AWS 보안 서비스의 탐지 결과를 통합하여 전체 보안 현황을 관리하는 서비스입니다. GuardDuty, Inspector, Config 등의 결과를 중앙에서 확인하고 보안 표준 준수 여부를 평가합니다.',
        category: 'AWS 서비스',
        awsCategory: 'Security',
        weeks: ['Week 12-3']
    },

    // 네트워킹 개념
    {
        term: 'VPC Endpoint',
        definition: 'AWS 서비스와 VPC를 프라이빗하게 연결하는 게이트웨이입니다. 인터넷을 거치지 않고 S3, DynamoDB 등에 안전하게 접근할 수 있습니다.',
        category: '네트워킹'
    },
    {
        term: 'VPC Peering',
        definition: '두 VPC 간에 프라이빗 네트워크 연결을 생성하는 기능입니다. 서로 다른 계정이나 리전의 VPC를 연결하여 리소스를 공유할 수 있습니다.',
        category: '네트워킹'
    },
    {
        term: 'Transit Gateway',
        definition: '여러 VPC와 온프레미스 네트워크를 중앙에서 연결하는 네트워크 허브입니다. 복잡한 네트워크 토폴로지를 단순화합니다.',
        category: '네트워킹'
    },
    {
        term: 'Subnet',
        definition: 'VPC 내부를 나눈 네트워크 영역입니다. Public Subnet은 인터넷 게이트웨이와 연결되고, Private Subnet은 외부 접근이 차단됩니다.',
        category: '네트워킹',
        weeks: ['Week 3-1', 'Week 3-2']
    },
    {
        term: 'Internet Gateway',
        definition: 'VPC와 인터넷을 연결하는 게이트웨이입니다. Public Subnet의 리소스가 인터넷과 통신할 수 있게 하며, 수평 확장 가능한 고가용성 구성 요소입니다.',
        category: '네트워킹',
        weeks: ['Week 3-1']
    },
    {
        term: 'NAT Gateway',
        definition: 'Private Subnet의 리소스가 인터넷에 아웃바운드 연결할 수 있게 하는 관리형 서비스입니다. 인바운드 연결은 차단하여 보안을 유지하며, 고가용성을 위해 각 AZ마다 생성하는 것이 권장됩니다.',
        category: '네트워킹',
        weeks: ['Week 3-1', 'Week 3-2', 'Week 5-1']
    },
    { term: 'Security Group', definition: 'EC2 인스턴스 수준의 가상 방화벽입니다. 인바운드/아웃바운드 트래픽을 제어하며, 상태 저장(Stateful) 방식으로 작동합니다.', category: '네트워킹', weeks: ['Week 3-2'] },
    { term: 'NACL', definition: '서브넷 수준의 네트워크 접근 제어 목록입니다. 상태 비저장(Stateless) 방식으로 작동하며, 허용 및 거부 규칙을 모두 설정할 수 있습니다.', category: '네트워킹', weeks: ['Week 3-2'] },
    {
        term: 'Route Table',
        definition: '네트워크 트래픽의 경로를 지정하는 규칙 집합입니다. 각 서브넷은 하나의 라우팅 테이블과 연결되어 트래픽 흐름을 제어합니다. 0.0.0.0/0은 모든 인터넷 트래픽을 의미합니다.',
        category: '네트워킹',
        weeks: ['Week 3-1']
    },
    {
        term: 'Elastic IP',
        definition: '고정된 공인 IPv4 주소입니다. EC2 인스턴스나 NAT Gateway에 할당하여 재시작해도 동일한 IP 주소를 유지할 수 있습니다. 사용하지 않으면 시간당 요금이 부과됩니다.',
        category: '네트워킹',
        weeks: ['Week 3-1', 'Week 5-1']
    },
    {
        term: 'Direct Connect',
        definition: '온프레미스 데이터 센터와 AWS 간에 전용 네트워크 연결을 제공하는 서비스입니다. 인터넷을 거치지 않아 더 안정적이고 빠른 연결을 제공합니다.',
        category: '네트워킹'
    },
    {
        term: 'VPN',
        definition: 'Virtual Private Network의 약자로, 공용 네트워크를 통해 안전한 암호화 연결을 제공합니다. AWS Site-to-Site VPN으로 온프레미스와 VPC를 연결할 수 있습니다.',
        category: '네트워킹'
    },
    {
        term: 'Proxy',
        definition: '클라이언트와 서버 사이에서 요청을 중계하는 서버입니다. 보안, 캐싱, 로드 밸런싱 등의 목적으로 사용됩니다.',
        category: '네트워킹'
    },

    // 보안 개념
    { term: 'IAM Role', definition: 'AWS 리소스에 권한을 부여하는 방법입니다. 임시 자격 증명을 제공하여 장기 자격 증명보다 안전하며, EC2, Lambda 등에서 사용됩니다.', category: '보안', weeks: ['Week 2-1'] },
    { term: 'IAM Policy', definition: 'JSON 형식으로 작성된 권한 집합입니다. Effect, Action, Resource 등의 요소로 구성되며, 누가 무엇을 할 수 있는지 정의합니다.', category: '보안', weeks: ['Week 2-2'] },
    { term: 'IAM User', definition: 'AWS 계정 내 개별 사용자입니다. 장기 자격 증명(액세스 키, 비밀 키)을 가지며, 콘솔 또는 CLI를 통해 AWS에 접근합니다.', category: '보안' },
    { term: 'MFA', definition: '다중 인증(Multi-Factor Authentication)으로, 비밀번호 외에 추가 인증 요소를 요구합니다. 가상 MFA 디바이스, 하드웨어 토큰 등을 사용하여 보안을 강화합니다.', category: '보안' },
    { term: 'AssumeRole', definition: 'IAM 역할을 맡아 임시 자격 증명을 받는 API 작업입니다. 크로스 계정 액세스, 권한 상승 등에 사용되며, 세션 시간을 제한할 수 있습니다.', category: '보안', weeks: ['Week 2-1'] },
    { term: 'Trust Policy', definition: '누가 역할을 맡을 수 있는지 정의하는 IAM 역할의 정책입니다. Principal 요소로 신뢰할 주체(사용자, 서비스, 계정)를 지정합니다.', category: '보안' },
    {
        term: 'Finding',
        definition: 'GuardDuty가 탐지한 보안 위협 또는 의심스러운 활동입니다. 심각도(Low, Medium, High, Critical)와 위협 유형이 포함되며, EventBridge로 자동 대응할 수 있습니다.',
        category: '보안',
        weeks: ['Week 12-3']
    },
    {
        term: 'Compliance',
        definition: '규정 준수의 의미로, 조직의 보안 정책이나 법적 요구사항을 충족하는 상태입니다. AWS Config로 리소스 구성을 평가하고 규정 준수 여부를 확인할 수 있습니다.',
        category: '보안',
        weeks: ['Week 12-2']
    },
    {
        term: 'Config Rule',
        definition: 'AWS Config에서 리소스 구성을 평가하는 규칙입니다. 관리형 규칙(AWS 제공)과 사용자 지정 규칙(Lambda)을 사용하여 규정 준수를 자동으로 확인합니다.',
        category: '보안',
        weeks: ['Week 12-2']
    },

    // 데이터베이스 개념
    { term: 'Multi-AZ', definition: '여러 가용 영역에 데이터베이스를 동기식으로 복제하여 고가용성을 제공하는 RDS 기능입니다. 장애 발생 시 자동으로 페일오버됩니다.', category: '데이터베이스', weeks: ['Week 5-1'] },
    { term: 'Read Replica', definition: '읽기 전용 복제본으로, 읽기 트래픽을 분산하여 성능을 향상시킵니다. 비동기식 복제 방식을 사용하며, 여러 리전에 생성할 수 있습니다.', category: '데이터베이스' },
    { term: 'Partition Key', definition: 'DynamoDB 테이블에서 데이터를 분산 저장하는 기본 키입니다. 해시 함수를 사용하여 데이터를 여러 파티션에 균등하게 분배합니다.', category: '데이터베이스', weeks: ['Week 5-3'] },
    { term: 'Sort Key', definition: 'DynamoDB에서 같은 파티션 키 내에서 데이터를 정렬하는 키입니다. 파티션 키와 함께 복합 기본 키를 구성하여 효율적인 쿼리를 가능하게 합니다.', category: '데이터베이스', weeks: ['Week 5-3'] },
    {
        term: 'Connection Pool',
        definition: '데이터베이스 연결을 미리 생성하여 재사용하는 기술입니다. 연결 생성 오버헤드를 줄여 애플리케이션 성능을 향상시킵니다.',
        category: '데이터베이스'
    },
    {
        term: 'Transaction',
        definition: '데이터베이스에서 하나의 논리적 작업 단위입니다. ACID(원자성, 일관성, 격리성, 지속성) 속성을 보장하여 데이터 무결성을 유지합니다.',
        category: '데이터베이스'
    },
    {
        term: 'Schema',
        definition: '데이터베이스의 구조와 제약 조건을 정의하는 청사진입니다. 테이블, 컬럼, 데이터 타입, 관계 등을 명시합니다.',
        category: '데이터베이스'
    },

    // 컨테이너 개념
    { term: 'Docker', definition: '애플리케이션을 컨테이너로 패키징하고 실행하는 플랫폼입니다. 이미지를 빌드하고 컨테이너로 실행하여 일관된 환경을 제공합니다.', category: '컨테이너', weeks: ['Week 7-1'] },
    { term: 'Task Definition', definition: 'ECS에서 컨테이너를 실행하기 위한 설정을 정의하는 JSON 문서입니다. 이미지, CPU, 메모리, 환경 변수, 포트 매핑 등을 지정합니다.', category: '컨테이너', weeks: ['Week 7-2'] },
    { term: 'Container Image', definition: '애플리케이션과 모든 종속성을 포함하는 실행 가능한 패키지입니다. Dockerfile로 빌드하고 ECR에 저장하여 배포합니다.', category: '컨테이너', weeks: ['Week 7-1'] },
    {
        term: 'Container Insights',
        definition: 'CloudWatch의 기능으로, ECS와 EKS 클러스터의 컨테이너 메트릭과 로그를 수집하고 시각화합니다. CPU, 메모리, 네트워크 사용량을 모니터링할 수 있습니다.',
        category: '컨테이너',
        weeks: ['Week 13-3']
    },

    // Kubernetes 개념
    {
        term: 'Kubernetes',
        definition: '컨테이너 오케스트레이션 플랫폼으로, 컨테이너화된 애플리케이션의 배포, 확장, 관리를 자동화합니다. Pod, Service, Deployment 등의 리소스로 구성됩니다.',
        category: 'Kubernetes',
        weeks: ['Week 7-3']
    },
    {
        term: 'Pod',
        definition: 'Kubernetes에서 배포할 수 있는 가장 작은 단위입니다. 하나 이상의 컨테이너를 포함하며, 동일한 네트워크와 스토리지를 공유합니다.',
        category: 'Kubernetes',
        weeks: ['Week 7-3']
    },
    {
        term: 'Deployment',
        definition: 'Kubernetes에서 애플리케이션의 배포와 업데이트를 관리하는 리소스입니다. 원하는 상태를 선언하면 자동으로 Pod를 생성하고 유지합니다.',
        category: 'Kubernetes',
        weeks: ['Week 7-3']
    },
    {
        term: 'ReplicaSet',
        definition: 'Kubernetes에서 지정된 수의 Pod 복제본을 유지하는 리소스입니다. Deployment가 내부적으로 ReplicaSet을 생성하여 Pod를 관리합니다.',
        category: 'Kubernetes',
        weeks: ['Week 7-3']
    },
    {
        term: 'Service',
        definition: 'Kubernetes에서 Pod 집합에 대한 네트워크 접근을 제공하는 추상화입니다. LoadBalancer, NodePort, ClusterIP 타입을 지원합니다.',
        category: 'Kubernetes',
        weeks: ['Week 7-3']
    },
    {
        term: 'Node',
        definition: 'Kubernetes 클러스터의 워커 머신입니다. Pod가 실행되는 물리적 또는 가상 서버로, kubelet과 kube-proxy가 실행됩니다.',
        category: 'Kubernetes',
        weeks: ['Week 7-3']
    },
    {
        term: 'Control Plane',
        definition: 'Kubernetes 클러스터를 관리하는 구성 요소 집합입니다. API 서버, 스케줄러, 컨트롤러 매니저, etcd 등이 포함되며, EKS에서는 AWS가 관리합니다.',
        category: 'Kubernetes',
        weeks: ['Week 7-3']
    },
    {
        term: 'kubectl',
        definition: 'Kubernetes 클러스터를 제어하는 명령줄 도구입니다. Pod 생성, 로그 확인, 리소스 관리 등 모든 Kubernetes 작업을 수행할 수 있습니다.',
        category: 'Kubernetes',
        weeks: ['Week 7-3']
    },
    {
        term: 'Namespace',
        definition: 'Kubernetes에서 리소스를 논리적으로 분리하는 단위입니다. 팀, 프로젝트, 환경별로 리소스를 격리하여 관리할 수 있습니다.',
        category: 'Kubernetes',
        weeks: ['Week 7-3']
    },
    {
        term: 'ConfigMap',
        definition: 'Kubernetes에서 설정 데이터를 저장하는 리소스입니다. 환경 변수, 명령줄 인수, 설정 파일 등을 Pod와 분리하여 관리할 수 있습니다.',
        category: 'Kubernetes',
        weeks: ['Week 7-3']
    },
    {
        term: 'Secret',
        definition: 'Kubernetes에서 민감한 정보(비밀번호, 토큰, 키)를 안전하게 저장하는 리소스입니다. Base64로 인코딩되어 저장되며, Pod에 환경 변수나 볼륨으로 마운트할 수 있습니다.',
        category: 'Kubernetes',
        weeks: ['Week 7-3']
    },
    {
        term: 'Ingress',
        definition: 'Kubernetes에서 외부 HTTP/HTTPS 트래픽을 클러스터 내부 Service로 라우팅하는 리소스입니다. 도메인 기반 라우팅, SSL/TLS 종료 등을 지원합니다.',
        category: 'Kubernetes',
        weeks: ['Week 7-3']
    },
    {
        term: 'Label',
        definition: 'Kubernetes 리소스에 붙이는 키-값 쌍의 메타데이터입니다. 리소스를 식별하고 그룹화하는 데 사용되며, Selector로 선택할 수 있습니다.',
        category: 'Kubernetes',
        weeks: ['Week 7-3']
    },
    {
        term: 'Selector',
        definition: 'Kubernetes에서 Label을 기반으로 리소스를 선택하는 메커니즘입니다. Service가 어떤 Pod를 대상으로 할지 결정하는 데 사용됩니다.',
        category: 'Kubernetes',
        weeks: ['Week 7-3']
    },
    {
        term: 'RBAC (Role-Based Access Control)',
        definition: 'Kubernetes에서 역할 기반으로 리소스 접근을 제어하는 보안 메커니즘입니다. Role, ClusterRole, RoleBinding, ClusterRoleBinding으로 구성되며, 사용자와 서비스 계정의 권한을 세밀하게 관리합니다.',
        category: 'Kubernetes',
        weeks: ['Week 7-3']
    },
    {
        term: 'ServiceAccount',
        definition: 'Kubernetes에서 Pod가 API 서버에 접근할 때 사용하는 계정입니다. RBAC과 함께 사용하여 Pod의 권한을 제어하며, 각 네임스페이스마다 기본 ServiceAccount가 자동 생성됩니다.',
        category: 'Kubernetes',
        weeks: ['Week 7-3']
    },
    {
        term: 'Volume',
        definition: 'Kubernetes에서 Pod에 스토리지를 제공하는 추상화입니다. emptyDir, hostPath, PersistentVolume 등 다양한 타입을 지원하며, 컨테이너 재시작 시에도 데이터를 유지할 수 있습니다.',
        category: 'Kubernetes',
        weeks: ['Week 7-3']
    },
    {
        term: 'PersistentVolume (PV)',
        definition: 'Kubernetes 클러스터의 스토리지 리소스입니다. 관리자가 프로비저닝하거나 StorageClass를 통해 동적으로 생성되며, Pod의 생명주기와 독립적으로 존재합니다.',
        category: 'Kubernetes',
        weeks: ['Week 7-3']
    },
    {
        term: 'PersistentVolumeClaim (PVC)',
        definition: 'Pod가 PersistentVolume을 요청하는 방법입니다. 필요한 스토리지 크기와 접근 모드를 지정하면, Kubernetes가 적절한 PV를 자동으로 바인딩합니다.',
        category: 'Kubernetes',
        weeks: ['Week 7-3']
    },
    {
        term: 'StatefulSet',
        definition: 'Kubernetes에서 상태를 가진 애플리케이션을 관리하는 리소스입니다. Pod에 고유한 식별자와 안정적인 네트워크 ID를 제공하며, 데이터베이스나 메시지 큐 같은 스테이트풀 워크로드에 사용됩니다.',
        category: 'Kubernetes',
        weeks: ['Week 7-3']
    },
    {
        term: 'DaemonSet',
        definition: 'Kubernetes에서 모든 노드(또는 특정 노드)에 Pod를 하나씩 실행하는 리소스입니다. 로그 수집, 모니터링 에이전트, 네트워크 플러그인 등 노드별로 실행해야 하는 작업에 사용됩니다.',
        category: 'Kubernetes',
        weeks: ['Week 7-3']
    },
    {
        term: 'Job',
        definition: 'Kubernetes에서 한 번 실행되고 완료되는 작업을 관리하는 리소스입니다. 배치 처리, 데이터 마이그레이션, 백업 등 일회성 작업에 사용되며, 실패 시 자동으로 재시도합니다.',
        category: 'Kubernetes',
        weeks: ['Week 7-3']
    },
    {
        term: 'CronJob',
        definition: 'Kubernetes에서 주기적으로 실행되는 작업을 관리하는 리소스입니다. Cron 표현식으로 스케줄을 정의하며, 정기적인 백업, 리포트 생성, 데이터 정리 등에 사용됩니다.',
        category: 'Kubernetes',
        weeks: ['Week 7-3']
    },
    {
        term: 'HorizontalPodAutoscaler (HPA)',
        definition: 'Kubernetes에서 CPU/메모리 사용률에 따라 Pod 수를 자동으로 조정하는 리소스입니다. 트래픽 증가 시 자동으로 스케일 아웃하고, 감소 시 스케일 인하여 리소스를 효율적으로 사용합니다.',
        category: 'Kubernetes',
        weeks: ['Week 7-3']
    },
    {
        term: 'Liveness Probe',
        definition: 'Kubernetes에서 컨테이너가 정상적으로 실행 중인지 확인하는 헬스 체크입니다. 실패 시 kubelet이 컨테이너를 재시작하여 자동 복구합니다.',
        category: 'Kubernetes',
        weeks: ['Week 7-3']
    },
    {
        term: 'Readiness Probe',
        definition: 'Kubernetes에서 컨테이너가 트래픽을 받을 준비가 되었는지 확인하는 헬스 체크입니다. 실패 시 Service의 엔드포인트에서 제외되어 트래픽을 받지 않습니다.',
        category: 'Kubernetes',
        weeks: ['Week 7-3']
    },
    {
        term: 'Helm',
        definition: 'Kubernetes 애플리케이션을 패키징하고 배포하는 패키지 매니저입니다. Chart라는 패키지 형식으로 복잡한 애플리케이션을 쉽게 설치, 업그레이드, 롤백할 수 있습니다.',
        category: 'Kubernetes',
        weeks: ['Week 7-3']
    },
    {
        term: 'Kustomize',
        definition: 'Kubernetes YAML 파일을 템플릿 없이 커스터마이징하는 도구입니다. 베이스 설정을 유지하면서 환경별(dev, staging, prod) 오버레이를 적용하여 설정을 관리합니다.',
        category: 'Kubernetes',
        weeks: ['Week 7-3']
    },

    // 서버리스 개념
    { term: 'Serverless', definition: '서버 관리 없이 코드를 실행하는 클라우드 컴퓨팅 모델입니다. 인프라 프로비저닝, 확장, 패치 등을 클라우드 제공자가 자동으로 처리합니다.', category: '서버리스' },
    { term: 'Event-driven', definition: '이벤트 발생 시 자동으로 함수가 실행되는 아키텍처 패턴입니다. S3 업로드, DynamoDB 변경, API 요청 등이 트리거가 될 수 있습니다.', category: '서버리스' },
    { term: 'Cold Start', definition: 'Lambda 함수가 처음 실행되거나 오랫동안 사용되지 않았을 때 발생하는 초기화 지연입니다. 실행 환경을 준비하는 시간이 추가로 소요됩니다.', category: '서버리스' },
    { term: 'Blue/Green Deployment', definition: '두 개의 동일한 환경(Blue, Green)을 유지하며 배포하는 전략입니다. 새 버전을 Green에 배포하고 테스트 후 트래픽을 전환하여 무중단 배포를 실현합니다.', category: '서버리스' },
    { term: 'Canary Deployment', definition: '새 버전을 일부 사용자에게만 먼저 배포하여 테스트하는 전략입니다. 문제가 없으면 점진적으로 트래픽을 증가시켜 전체 배포를 완료합니다.', category: '서버리스' },
    {
        term: 'CI/CD',
        definition: 'Continuous Integration/Continuous Deployment의 약자로, 코드 변경을 자동으로 빌드, 테스트, 배포하는 개발 방법론입니다. CodePipeline으로 구현할 수 있습니다.',
        category: '서버리스',
        weeks: ['Week 9-2']
    },
    {
        term: 'Rolling Update',
        definition: '서비스 중단 없이 점진적으로 새 버전을 배포하는 전략입니다. 일부 인스턴스를 업데이트하고 정상 작동을 확인한 후 나머지를 업데이트합니다.',
        category: '서버리스'
    },
    {
        term: 'Rollback',
        definition: '배포된 새 버전에 문제가 발생했을 때 이전 버전으로 되돌리는 작업입니다. CodeDeploy는 자동 롤백 기능을 제공합니다.',
        category: '서버리스',
        weeks: ['Week 9-2']
    },

    // 머신러닝 개념
    { term: 'Pipeline', definition: '데이터 처리부터 모델 학습, 평가, 배포까지의 ML 워크플로우를 자동화하는 시스템입니다. SageMaker Pipelines로 재현 가능한 ML 워크플로우를 구축할 수 있습니다.', category: '머신러닝' },
    { term: 'Model Registry', definition: '머신러닝 모델의 버전을 관리하고 추적하는 저장소입니다. 모델 메타데이터, 성능 지표, 승인 상태 등을 기록하여 모델 거버넌스를 지원합니다.', category: '머신러닝' },
    { term: 'Endpoint', definition: '학습된 모델을 배포하여 실시간 추론을 제공하는 인터페이스입니다. HTTPS 요청을 통해 예측 결과를 반환하며, 자동 확장을 지원합니다.', category: '머신러닝' },
    {
        term: 'RAG (Retrieval-Augmented Generation)',
        definition: '검색 증강 생성의 약자로, 외부 지식 베이스에서 관련 정보를 검색한 후 생성형 AI로 답변을 생성하는 기법입니다. 모델의 환각(Hallucination)을 줄이고 최신 정보를 반영할 수 있습니다.',
        category: '머신러닝',
        weeks: ['Week 14-2']
    },
    {
        term: 'Foundation Model',
        definition: '대규모 데이터로 사전 학습된 범용 AI 모델입니다. Claude, GPT, Llama 등이 있으며, 다양한 작업에 적용할 수 있습니다. Amazon Bedrock에서 API로 제공됩니다.',
        category: '머신러닝',
        weeks: ['Week 14-1', 'Week 14-3']
    },
    {
        term: 'Prompt Engineering',
        definition: 'AI 모델에게 효과적인 지시를 작성하는 기술입니다. Zero-shot, Few-shot, Chain-of-Thought 등의 기법을 사용하여 원하는 결과를 얻을 수 있습니다.',
        category: '머신러닝',
        weeks: ['Week 14-1']
    },
    {
        term: 'Embedding',
        definition: '텍스트를 고차원 벡터로 변환하는 기술입니다. 의미적으로 유사한 텍스트는 벡터 공간에서 가까이 위치하여 검색과 분류에 활용됩니다.',
        category: '머신러닝',
        weeks: ['Week 14-2']
    },
    {
        term: 'Vector Database',
        definition: '벡터 임베딩을 저장하고 유사도 검색을 수행하는 데이터베이스입니다. OpenSearch Serverless, Pinecone 등이 있으며, RAG 시스템의 핵심 구성 요소입니다.',
        category: '머신러닝',
        weeks: ['Week 14-2']
    },
    {
        term: 'Knowledge Base',
        definition: 'AI 모델이 참조할 수 있는 구조화된 지식 저장소입니다. Bedrock Knowledge Bases는 문서를 자동으로 벡터화하여 RAG 시스템을 구축합니다.',
        category: '머신러닝',
        weeks: ['Week 14-2', 'Week 14-3']
    },
    {
        term: 'Agent',
        definition: '자율적으로 작업을 수행하는 AI 시스템입니다. Bedrock Agent는 사용자 의도를 파악하고, 필요한 도구를 선택하여 복잡한 작업을 수행합니다.',
        category: '머신러닝',
        weeks: ['Week 14-3']
    },
    {
        term: 'Action Group',
        definition: 'Bedrock Agent가 호출할 수 있는 Lambda 함수 집합입니다. 데이터베이스 조회, API 호출 등 실제 작업을 수행하는 인터페이스를 제공합니다.',
        category: '머신러닝',
        weeks: ['Week 14-3']
    },

    // 일반 개념
    {
        term: 'Region',
        definition: 'AWS 데이터 센터가 위치한 지리적 영역입니다. 각 리전은 독립적으로 운영되며, 서울(ap-northeast-2), 도쿄(ap-northeast-1) 등이 있습니다.',
        category: '일반',
        weeks: ['Week 1-1']
    },
    {
        term: 'Availability Zone (AZ)',
        definition: '리전 내 독립된 데이터 센터입니다. 각 AZ는 물리적으로 분리되어 있어 장애 격리를 제공하며, 하나의 리전은 보통 2개 이상의 AZ로 구성됩니다. Multi-AZ 배포로 고가용성을 확보합니다.',
        category: '일반',
        weeks: ['Week 3-1', 'Week 5-1']
    },
    { term: 'ARN', definition: 'AWS 리소스를 고유하게 식별하는 Amazon Resource Name입니다. arn:aws:서비스:리전:계정ID:리소스 형식으로 구성되며, 정책 작성 시 사용됩니다.', category: '일반' },
    { term: 'Tag', definition: '리소스를 분류하고 관리하기 위한 키-값 쌍의 메타데이터입니다. 비용 추적, 자동화, 액세스 제어 등에 활용됩니다.', category: '일반' },
    { term: 'Endpoint', definition: 'AWS 서비스에 접근하기 위한 URL 주소입니다. 각 서비스는 리전별로 고유한 엔드포인트를 가지며, VPC 엔드포인트를 통해 프라이빗 연결도 가능합니다.', category: '일반' },
    { term: 'Console', definition: 'AWS 리소스를 관리할 수 있는 웹 기반 사용자 인터페이스입니다. 브라우저에서 접속하여 시각적으로 리소스를 생성, 수정, 삭제할 수 있습니다.', category: '일반' },
    { term: 'CLI', definition: 'Command Line Interface로, 명령줄에서 AWS를 제어하는 도구입니다. 스크립트 작성, 자동화, 반복 작업에 유용하며, 모든 AWS 서비스를 지원합니다.', category: '일반' },
    { term: 'SDK', definition: 'Software Development Kit로, 프로그래밍 언어로 AWS를 제어하는 라이브러리입니다. Python(Boto3), JavaScript, Java 등 다양한 언어를 지원합니다.', category: '일반' },
    { term: 'CIDR', definition: 'Classless Inter-Domain Routing의 약자로, IP 주소 범위를 표기하는 방법입니다. 예: 10.0.0.0/16은 10.0.0.0부터 10.0.255.255까지의 IP 주소를 의미합니다.', category: '일반' },
    { term: 'IaC', definition: 'Infrastructure as Code의 약자로, 인프라를 코드로 정의하고 관리하는 방식입니다. CloudFormation, Terraform 등이 대표적인 IaC 도구입니다.', category: '일반', weeks: ['Week 6-1', 'Week 6-2'] },
    { term: 'Idempotency', definition: '동일한 작업을 여러 번 수행해도 결과가 같은 성질입니다. API 설계 시 중요한 개념으로, 네트워크 오류 시 안전하게 재시도할 수 있게 합니다.', category: '일반' },
    { term: 'Throttling', definition: 'API 요청 속도를 제한하는 메커니즘입니다. 서비스 보호와 공정한 리소스 사용을 위해 초당 요청 수를 제한합니다.', category: '일반' },
    {
        term: 'Bastion Host',
        definition: '프라이빗 네트워크에 안전하게 접근하기 위한 점프 서버입니다. Public Subnet에 배치하여 Private Subnet의 리소스에 SSH/RDP 접속할 때 사용합니다.',
        category: '일반',
        weeks: ['Week 3-1']
    },
    {
        term: '3-Tier Architecture',
        definition: '애플리케이션을 Presentation(Web), Application(App), Data(Database) 세 계층으로 분리하는 아키텍처 패턴입니다. 각 계층을 독립적으로 확장하고 관리할 수 있습니다.',
        category: '일반',
        weeks: ['Week 3-2']
    },
    {
        term: 'High Availability (고가용성)',
        definition: '시스템이 장애 없이 지속적으로 운영되는 능력입니다. Multi-AZ 배포, Auto Scaling, Load Balancing 등을 통해 구현합니다.',
        category: '일반',
        weeks: ['Week 3-1', 'Week 5-1']
    },
    {
        term: 'CRUD',
        definition: 'Create(생성), Read(읽기), Update(수정), Delete(삭제)의 약자로, 데이터베이스의 기본 작업을 의미합니다. RESTful API 설계의 기본 개념입니다.',
        category: '일반',
        weeks: ['Week 4-3']
    },
    {
        term: 'REST API',
        definition: 'Representational State Transfer API의 약자로, HTTP 프로토콜을 사용하는 웹 API 아키텍처 스타일입니다. GET, POST, PUT, DELETE 메서드로 리소스를 조작합니다.',
        category: '일반',
        weeks: ['Week 4-1', 'Week 4-3']
    },
    {
        term: 'JSON',
        definition: 'JavaScript Object Notation의 약자로, 데이터를 키-값 쌍으로 표현하는 경량 데이터 형식입니다. API 통신과 설정 파일에 널리 사용됩니다.',
        category: '일반',
        weeks: ['Week 4-3', 'Week 6-1']
    },
    {
        term: 'YAML',
        definition: 'YAML Ain\'t Markup Language의 약자로, 사람이 읽기 쉬운 데이터 직렬화 형식입니다. CloudFormation 템플릿 작성에 주로 사용됩니다.',
        category: '일반',
        weeks: ['Week 6-1', 'Week 6-2']
    },
    {
        term: 'HTTP/HTTPS',
        definition: 'Hypertext Transfer Protocol의 약자로, 웹에서 데이터를 주고받는 프로토콜입니다. HTTPS는 SSL/TLS로 암호화된 안전한 버전입니다.',
        category: '일반',
        weeks: ['Week 4-1', 'Week 10-3']
    },
    {
        term: 'DNS',
        definition: 'Domain Name System의 약자로, 도메인 이름을 IP 주소로 변환하는 시스템입니다. Route 53은 AWS의 DNS 서비스입니다.',
        category: '일반',
        weeks: ['Week 3-1', 'Week 14-2']
    },
    {
        term: 'CDN',
        definition: 'Content Delivery Network의 약자로, 전 세계에 분산된 서버를 통해 콘텐츠를 빠르게 전달하는 시스템입니다. CloudFront는 AWS의 CDN 서비스입니다.',
        category: '일반',
        weeks: ['Week 10-3']
    },
    {
        term: 'Cache (캐시)',
        definition: '자주 사용되는 데이터를 빠르게 접근할 수 있는 임시 저장소에 보관하는 기술입니다. ElastiCache, CloudFront 등에서 사용됩니다.',
        category: '일반',
        weeks: ['Week 10-1', 'Week 10-3']
    },
    {
        term: 'TTL (Time To Live)',
        definition: '캐시나 DNS 레코드가 유효한 시간을 의미합니다. TTL이 만료되면 데이터가 갱신됩니다.',
        category: '일반',
        weeks: ['Week 10-3']
    },
    {
        term: 'CORS',
        definition: 'Cross-Origin Resource Sharing의 약자로, 다른 도메인의 리소스에 접근할 수 있도록 허용하는 보안 메커니즘입니다. API Gateway에서 설정합니다.',
        category: '일반',
        weeks: ['Week 4-3']
    },
    {
        term: 'JWT',
        definition: 'JSON Web Token의 약자로, 사용자 인증 정보를 안전하게 전달하는 토큰 형식입니다. Cognito에서 발급하여 API 인증에 사용합니다.',
        category: '일반',
        weeks: ['Week 4-3']
    },
    {
        term: 'Backup (백업)',
        definition: '데이터 손실에 대비하여 데이터를 복사하여 저장하는 작업입니다. RDS는 자동 백업과 수동 스냅샷을 지원합니다.',
        category: '일반',
        weeks: ['Week 5-1', 'Week 10-1']
    },
    {
        term: 'Snapshot (스냅샷)',
        definition: '특정 시점의 데이터 상태를 저장한 복사본입니다. RDS, EBS 등에서 백업 및 복구에 사용됩니다.',
        category: '일반',
        weeks: ['Week 5-1']
    },
    {
        term: 'Replication (복제)',
        definition: '데이터를 여러 위치에 복사하여 저장하는 기술입니다. RDS Read Replica, DynamoDB Global Tables 등에서 사용됩니다.',
        category: '일반',
        weeks: ['Week 5-1']
    },
    {
        term: 'Query (쿼리)',
        definition: '데이터베이스에서 특정 조건에 맞는 데이터를 검색하는 작업입니다. DynamoDB는 파티션 키로 효율적인 쿼리를 지원합니다.',
        category: '일반',
        weeks: ['Week 4-3', 'Week 5-3', 'Week 11-2']
    },
    {
        term: 'Index (인덱스)',
        definition: '데이터베이스에서 검색 속도를 향상시키기 위한 자료구조입니다. DynamoDB는 GSI(Global Secondary Index)와 LSI(Local Secondary Index)를 지원합니다.',
        category: '일반',
        weeks: ['Week 5-3']
    },
    {
        term: 'Encryption (암호화)',
        definition: '데이터를 읽을 수 없는 형태로 변환하여 보호하는 기술입니다. At-rest(저장 시)와 In-transit(전송 중) 암호화가 있으며, KMS로 키를 관리합니다.',
        category: '일반',
        weeks: ['Week 10-1', 'Week 12-1']
    },
    {
        term: 'SSL/TLS',
        definition: 'Secure Sockets Layer/Transport Layer Security의 약자로, 네트워크 통신을 암호화하는 프로토콜입니다. HTTPS는 TLS를 사용합니다.',
        category: '일반',
        weeks: ['Week 10-3']
    },
    {
        term: 'Certificate (인증서)',
        definition: '웹사이트의 신원을 확인하고 암호화 통신을 가능하게 하는 디지털 문서입니다. ACM(AWS Certificate Manager)에서 무료로 발급받을 수 있습니다.',
        category: '일반',
        weeks: ['Week 10-3']
    },
    {
        term: 'Monitoring (모니터링)',
        definition: '시스템의 상태와 성능을 지속적으로 관찰하고 측정하는 활동입니다. CloudWatch로 메트릭, 로그, 알람을 관리합니다.',
        category: '일반',
        weeks: ['Week 5-1', 'Week 10-1', 'Week 13-2']
    },
    {
        term: 'Logging (로깅)',
        definition: '시스템 이벤트와 활동을 기록하는 프로세스입니다. CloudWatch Logs, CloudTrail 등으로 로그를 수집하고 분석합니다.',
        category: '일반',
        weeks: ['Week 13-2']
    },
    {
        term: 'Metric (메트릭)',
        definition: '시스템 성능을 측정하는 수치 데이터입니다. CPU 사용률, 메모리 사용량, 네트워크 트래픽 등이 있으며, CloudWatch로 수집합니다.',
        category: '일반',
        weeks: ['Week 10-1', 'Week 13-2']
    },
    {
        term: 'Alarm (알람)',
        definition: '메트릭이 임계값을 초과할 때 자동으로 알림을 보내는 기능입니다. CloudWatch Alarm으로 SNS, Lambda 등을 트리거할 수 있습니다.',
        category: '일반',
        weeks: ['Week 13-1', 'Week 13-2']
    },
    {
        term: 'Dashboard (대시보드)',
        definition: '여러 메트릭과 데이터를 시각화하여 한눈에 볼 수 있는 화면입니다. CloudWatch Dashboard로 커스텀 모니터링 화면을 구성할 수 있습니다.',
        category: '일반',
        weeks: ['Week 13-1', 'Week 13-2']
    },
    {
        term: 'Stage (스테이지)',
        definition: 'API Gateway에서 배포 환경을 구분하는 단위입니다. dev, test, prod 등으로 나누어 각각 다른 설정을 적용할 수 있습니다.',
        category: '일반',
        weeks: ['Week 4-1', 'Week 4-3']
    },
    {
        term: 'Tag (태그)',
        definition: '리소스를 분류하고 관리하기 위한 키-값 쌍의 메타데이터입니다. 비용 추적, 자동화, 액세스 제어 등에 활용되며, Cost Explorer에서 태그별 비용 분석이 가능합니다.',
        category: '일반',
        weeks: ['Week 13-1']
    },
    {
        term: 'Docker Image',
        definition: '애플리케이션과 모든 종속성을 포함하는 실행 가능한 패키지입니다. Dockerfile로 빌드하고 ECR에 저장하여 배포합니다.',
        category: '일반',
        weeks: ['Week 7-1']
    },
    {
        term: 'Container Registry',
        definition: 'Docker 이미지를 저장하고 관리하는 저장소입니다. ECR(Elastic Container Registry)은 AWS의 완전 관리형 컨테이너 레지스트리입니다.',
        category: '일반',
        weeks: ['Week 7-1']
    },
    {
        term: 'Multi-stage Build',
        definition: 'Dockerfile에서 여러 단계로 이미지를 빌드하는 기법입니다. 빌드 도구는 최종 이미지에 포함하지 않아 이미지 크기를 줄일 수 있습니다.',
        category: '일반',
        weeks: ['Week 7-1']
    },
    {
        term: 'Health Check',
        definition: '시스템이나 서비스가 정상적으로 작동하는지 주기적으로 확인하는 프로세스입니다. ELB, Auto Scaling 등에서 인스턴스 상태를 모니터링하는 데 사용됩니다.',
        category: '일반',
        weeks: ['Week 3-2']
    },
    {
        term: 'Auto Recovery',
        definition: '시스템 장애 발생 시 자동으로 복구하는 기능입니다. EC2 인스턴스는 상태 확인 실패 시 자동으로 재시작할 수 있습니다.',
        category: '일반'
    },
    {
        term: 'Scaling Policy',
        definition: 'Auto Scaling이 리소스를 확장하거나 축소하는 조건과 방법을 정의하는 규칙입니다. 대상 추적, 단계별, 단순 스케일링 정책이 있습니다.',
        category: '일반'
    },
]


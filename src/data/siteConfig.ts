// 사이트 기본 설정

export const siteConfig = {
  // 사이트명
  university: 'AWS 기초',
  // 과정명
  courseName: '실습 가이드',
  // 부제
  semester: '',
  // 작성자
  professor: '',
  // 영문명 (홈 배지용)
  courseNameEn: 'AWS Starter Lab Guide',
  // 설명
  courseDescription: 'AWS 인프라를 단계별로 직접 구축해보는 실습 가이드',

  // 학점·시수 (사용하지 않음)
  credits: '',
  // 교과구분 (사용하지 않음)
  courseCategory: '',
  // 평가유형 (사용하지 않음)
  evaluationType: '',

  // 교과목개요
  courseOverview:
    'VPC 네트워크 설계부터 EC2, RDS, S3, ALB, CI/CD, 서버리스까지 AWS 핵심 서비스를 단계별로 직접 구축하며 배우는 실습 중심 가이드입니다. 최종적으로 3-Tier 아키텍처를 완성합니다.',

  // 수업목표
  courseObjectives: [
    'AWS 핵심 인프라(VPC, EC2, RDS, S3)를 직접 구축할 수 있다.',
    '보안 그룹, NACL, IAM 등 보안 설정을 이해하고 적용할 수 있다.',
    'ALB + Auto Scaling으로 고가용성 아키텍처를 구성할 수 있다.',
    'GitHub Actions를 활용한 CI/CD 파이프라인을 구성할 수 있다.',
    'Lambda + API Gateway + DynamoDB로 서버리스 백엔드를 구축할 수 있다.',
  ],

  // 홈 페이지 피처 아이콘
  homeFeatures: [
    { icon: '🏗️', text: '인프라 구축' },
    { icon: '💰', text: '비용 최적화' },
    { icon: '🚀', text: '배포 자동화' },
  ],
} as const;

// 조합된 문자열 헬퍼
export const siteTitle = `${siteConfig.university} ${siteConfig.courseName}`;
export const semesterInfo = siteConfig.semester;
export const copyright = `© ${new Date().getFullYear()} ${siteTitle}`;

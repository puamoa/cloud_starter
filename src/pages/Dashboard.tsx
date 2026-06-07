import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  SpaceBetween,
  Box,
  Header,
  Link,
  Badge,
  ColumnLayout,
  StatusIndicator,
  Icon,
} from '@cloudscape-design/components';
import { curriculum } from '@/data/curriculum';
import { siteConfig, siteTitle, semesterInfo } from '@/data/siteConfig';
import '@/styles/dashboard.css';
import '@/styles/info-boxes.css';

// AWS 서비스명을 CSS 클래스명으로 변환
const getServiceBadgeClass = (service: string): string => {
  const serviceMap: { [key: string]: string } = {
    // Management & Governance
    'AWS Console': 'console',
    'AWS Management Console': 'console',
    'AWS CloudShell': 'cloudshell',
    'Amazon CloudWatch': 'cloudwatch',
    'AWS CloudFormation': 'cloudformation',
    'AWS Well-Architected Tool': 'well-architected-tool',

    // Storage
    'Amazon S3': 's3',
    'Amazon EBS': 'ebs',

    // Compute
    'Amazon EC2': 'ec2',
    'AWS Lambda': 'lambda',
    'Amazon ECS': 'ecs',
    'AWS Auto Scaling': 'auto-scaling',

    // Networking
    'Amazon VPC': 'vpc',
    'Elastic Load Balancing': 'elb',
    'Application Load Balancer': 'alb',
    'Amazon API Gateway': 'api-gateway',
    'Amazon CloudFront': 'cloudfront',
    'Amazon Route 53': 'route-53',

    // Database
    'Amazon RDS': 'rds',
    'Amazon Aurora': 'rds',
    'Amazon DynamoDB': 'dynamodb',
    'Amazon ElastiCache': 'elasticache',

    // Developer Tools
    'AWS CodePipeline': 'codepipeline',
    'AWS CodeBuild': 'codebuild',
    'AWS CodeCommit': 'codecommit',
    'AWS CodeDeploy': 'codedeploy',
    'AWS Infrastructure Composer': 'infrastructure-composer',

    // Security
    'AWS IAM': 'iam',
    'AWS STS': 'iam',
    'AWS Organizations': 'organizations',
    'Amazon Cognito': 'cognito',
    'Amazon GuardDuty': 'guardduty',
    'AWS Security Hub': 'security-hub',
    'AWS Secrets Manager': 'secrets-manager',
    'AWS KMS': 'kms',
    'AWS Certificate Manager': 'certificate-manager',
    'AWS WAF': 'waf',
    'AWS Shield': 'shield',

    // Management & Governance (추가 서비스)
    'AWS Systems Manager': 'systems-manager',
    'AWS Systems Manager Parameter Store': 'parameter-store',
    'Amazon SNS': 'sns',
    'AWS Config': 'config',
    'Amazon EventBridge': 'eventbridge',

    // Analytics
    'AWS Glue': 'glue',
    'Amazon Athena': 'athena',
    'AWS Lake Formation': 'lake-formation',
    'Amazon QuickSight': 'quicksight',
    'Amazon Quick Suite': 'quick-suite',

    // Cloud Financial Management
    'AWS Cost Explorer': 'cost-explorer',
    'AWS Budgets': 'budgets',

    // Machine Learning
    'Amazon SageMaker': 'sagemaker',
    'Amazon Rekognition': 'rekognition',
    'Amazon Bedrock': 'bedrock',

    // Analytics (추가)
    'OpenSearch Serverless': 'opensearch-serverless',
    'Amazon OpenSearch Serverless': 'opensearch-serverless',

    // Containers
    'Amazon ECR': 'ecr',
    'Amazon EKS': 'eks',
    Kubernetes: 'kubernetes',

    // Additional Services
    'AWS X-Ray': 'xray',
    'AWS Resource Groups & Tag Editor': 'resource-groups',
  };

  return serviceMap[service] || 'default';
};

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();

  return (
    <SpaceBetween direction="vertical" size="l">
      {/* 헤더 카드 */}
      <div className="dashboard-header-container">
        <Container
          header={
            <Header variant="h1" description={siteConfig.courseDescription}>
              {siteTitle}
            </Header>
          }
        >
          <SpaceBetween direction="vertical" size="m">
            <Box
              color="text-body-secondary"
              className="dashboard-semester-info"
            >
              {semesterInfo}
            </Box>

            {/* 실습 안내 - 보라색 info-box */}
            <div className="info-box info-box--note">
              <div className="info-box-icon">
                <Icon name="status-info" variant="normal" />
              </div>
              <div className="info-box-content">
                <strong>실습 안내</strong>
                <div>
                  각 단계를 클릭하여 실습 가이드를 확인하세요. 각 실습은
                  독립적으로 진행할 수 있으며, 순서대로 하지 않아도 됩니다.
                </div>
                <div
                  style={{
                    marginTop: '0.5rem',
                    color: 'var(--color-text-body-secondary)',
                  }}
                >
                  ⚠️ 이 실습은 AWS 크레딧 또는 무료 플랜(Free Plan) 사용을
                  전제로 합니다.
                  <br />
                  💰 크레딧이나 무료 플랜을 사용하지 않는 경우 실제 비용이
                  발생합니다.
                  <br />⏰ 무료 플랜은 가입 후 6개월간 유효하며, 크레딧 소진 시
                  종료됩니다.
                </div>
              </div>
            </div>
          </SpaceBetween>
        </Container>
      </div>

      {/* 가이드 소개 카드 */}
      <Container
        id="overview"
        header={
          <Header variant="h2">
            <span className="section-title">📚 가이드 소개</span>
          </Header>
        }
      >
        <Box padding={{ horizontal: 'l', vertical: 'm' }}>
          <SpaceBetween direction="vertical" size="l">
            {/* 가이드 기본 정보 */}
            <ColumnLayout columns={3} variant="text-grid">
              <div>
                <Box color="text-label" fontSize="body-s">
                  총 단계
                </Box>
                <Box fontWeight="bold">12 Steps (0~11)</Box>
              </div>
              <div>
                <Box color="text-label" fontSize="body-s">
                  난이도
                </Box>
                <Box fontWeight="bold">초급 → 고급</Box>
              </div>
              <div>
                <Box color="text-label" fontSize="body-s">
                  비용
                </Box>
                <Box fontWeight="bold">대부분 크레딧 내 사용 가능</Box>
              </div>
            </ColumnLayout>

            {/* 개요 */}
            <Box>
              <SpaceBetween direction="horizontal" size="m" alignItems="start">
                <Box fontSize="heading-l" color="text-label">
                  🎯
                </Box>
                <Box>
                  <Box fontWeight="bold" padding={{ bottom: 'xs' }}>
                    개요
                  </Box>
                  {siteConfig.courseOverview}
                </Box>
              </SpaceBetween>
            </Box>

            {/* 학습 목표 */}
            <Box>
              <SpaceBetween direction="horizontal" size="m" alignItems="start">
                <Box fontSize="heading-l" color="text-label">
                  🚀
                </Box>
                <Box>
                  <Box fontWeight="bold" padding={{ bottom: 'xs' }}>
                    학습 목표
                  </Box>
                  <SpaceBetween direction="vertical" size="xs">
                    {siteConfig.courseObjectives.map((objective, idx) => (
                      <Box key={idx}>
                        {idx + 1}. {objective}
                      </Box>
                    ))}
                  </SpaceBetween>
                </Box>
              </SpaceBetween>
            </Box>
          </SpaceBetween>
        </Box>
      </Container>

      {/* 단계별 실습 목록 */}
      <Container
        id="curriculum"
        header={
          <Header
            variant="h2"
            description="각 단계를 클릭하여 실습 가이드를 확인하세요"
          >
            <span className="section-title">🗂️ 단계별 실습</span>
          </Header>
        }
      >
        <SpaceBetween direction="vertical" size="m">
          {curriculum.map((week) => (
            <Box
              key={week.week}
              id={`week-${week.week}`}
              padding="m"
              className="week-card"
            >
              <SpaceBetween direction="vertical" size="m">
                {/* 단계 헤더 */}
                <SpaceBetween
                  direction="horizontal"
                  size="s"
                  alignItems="center"
                >
                  <Badge
                    color={
                      week.difficulty === 'beginner'
                        ? 'green'
                        : week.difficulty === 'advanced'
                          ? 'red'
                          : 'blue'
                    }
                  >
                    Step {week.week}
                  </Badge>
                  <Box variant="h3" fontSize="heading-m" fontWeight="bold">
                    {week.title}
                  </Box>
                </SpaceBetween>

                {/* 차시 목록 */}
                {week.sessions && week.sessions.length > 0 ? (
                  <ColumnLayout columns={week.sessions.length >= 4 ? 4 : 3}>
                    {week.sessions.map((session, idx) => {
                      const hasLink =
                        session.hasContent &&
                        (session.type === 'lab' ||
                          session.type === 'demo' ||
                          session.type === 'theory');

                      // 타입별 StatusIndicator 타입
                      const getStatusType = ():
                        | 'success'
                        | 'info'
                        | 'stopped' => {
                        if (session.type === 'lab') return 'success'; // 실습: 초록색 체크
                        if (session.type === 'demo') return 'info'; // 데모: 파란색 정보
                        return 'stopped'; // 강의: 회색 정지
                      };

                      const getTypeLabel = () => {
                        if (session.type === 'lab') return '실습';
                        if (session.type === 'demo') return '데모';
                        return '강의';
                      };

                      return (
                        <Box key={idx} className="session-item">
                          <SpaceBetween direction="vertical" size="xs">
                            <SpaceBetween
                              direction="horizontal"
                              size="xs"
                              alignItems="center"
                            >
                              <StatusIndicator type={getStatusType()}>
                                {getTypeLabel()}
                              </StatusIndicator>
                              <Box fontWeight="bold" color="text-label">
                                {week.week}-{session.session}
                              </Box>
                            </SpaceBetween>
                            {hasLink ? (
                              <Link
                                fontSize="inherit"
                                onFollow={() =>
                                  navigate(
                                    `/week/${week.week}/session/${session.session}`,
                                  )
                                }
                              >
                                {session.title}
                              </Link>
                            ) : (
                              <Box color="text-body-secondary">
                                {session.title}
                              </Box>
                            )}
                          </SpaceBetween>
                        </Box>
                      );
                    })}
                  </ColumnLayout>
                ) : (
                  <Box
                    color="text-body-secondary"
                    textAlign="center"
                    padding="m"
                  >
                    실습 없음
                  </Box>
                )}

                {/* AWS 서비스 배지 */}
                {week.sessions &&
                  week.sessions.length > 0 &&
                  (() => {
                    const allServices = week.sessions.flatMap(
                      (session) => session.awsServices || [],
                    );
                    const uniqueServices = [...new Set(allServices)];

                    return (
                      uniqueServices.length > 0 && (
                        <Box>
                          <SpaceBetween direction="vertical" size="xs">
                            <Box
                              color="text-label"
                              className="aws-services-label"
                            >
                              관련 AWS 서비스:
                            </Box>
                            <SpaceBetween direction="horizontal" size="xs">
                              {uniqueServices.map((service, idx) => (
                                <span
                                  key={idx}
                                  className={`aws-service-badge ${getServiceBadgeClass(service)}`}
                                >
                                  {service}
                                </span>
                              ))}
                            </SpaceBetween>
                          </SpaceBetween>
                        </Box>
                      )
                    );
                  })()}
              </SpaceBetween>
            </Box>
          ))}
        </SpaceBetween>
      </Container>
    </SpaceBetween>
  );
};

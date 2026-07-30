import {
  Box,
  Container,
  Header,
  SpaceBetween,
  Table,
  Link,
  Badge,
} from '@cloudscape-design/components';
import { useNavigate } from 'react-router-dom';

interface Mission {
  step: string;
  session: string;
  title: string;
  difficulty: number;
  keywords: string[];
  path: string;
}

const missions: Mission[] = [
  {
    step: 'Step 2',
    session: '2-1',
    title: 'MySQL 포트로 NACL 차단/복구 테스트',
    difficulty: 1,
    keywords: ['Network ACL', 'Security'],
    path: '/week/2/session/1#self-mission',
  },
  {
    step: 'Step 4',
    session: '4-1',
    title: '백엔드 프로젝트 DB 세팅',
    difficulty: 2,
    keywords: ['Amazon RDS', 'MySQL'],
    path: '/week/4/session/1#self-mission',
  },
  {
    step: 'Step 5',
    session: '5-2',
    title: 'Amazon EC2에서 게시판 CRUD 테스트 (curl)',
    difficulty: 2,
    keywords: ['Amazon EC2', 'Amazon S3', '배포'],
    path: '/week/5/session/2#self-mission-1',
  },
  {
    step: 'Step 5',
    session: '5-2',
    title: '프론트엔드 배포 + S3 이미지 확인',
    difficulty: 2,
    keywords: ['Vue.js', 'Amazon S3', 'Amazon CloudFront'],
    path: '/week/5/session/2#self-mission-2',
  },
  {
    step: 'Step 5',
    session: '5-2',
    title: 'S3 코드를 활용한 백엔드 프로그램 제작',
    difficulty: 3,
    keywords: ['AWS SDK', 'Amazon S3', 'Spring'],
    path: '/week/5/session/2#self-mission-3',
  },
  {
    step: 'Step 7',
    session: '7-3',
    title: '본인 앱으로 Launch Template 구성',
    difficulty: 2,
    keywords: ['Auto Scaling', 'Launch Template'],
    path: '/week/7/session/3#self-mission',
  },
  {
    step: 'Step 7',
    session: '7-3',
    title: 'ALB에 커스텀 도메인 연결',
    difficulty: 2,
    keywords: ['ALB', 'Route 53', 'ACM'],
    path: '/week/7/session/3#self-mission-2',
  },
  {
    step: 'Step 8',
    session: '8-1',
    title: 'Amazon RDS 초기 데이터베이스 구성 (Spring Legacy)',
    difficulty: 2,
    keywords: ['Amazon RDS', 'MySQL', 'SSM'],
    path: '/week/8/session/1#self-mission',
  },
  {
    step: 'Step 8',
    session: '8-3',
    title: 'Auto Scaling Group으로 전환',
    difficulty: 3,
    keywords: ['ASG', 'Instance Refresh', 'CI/CD'],
    path: '/week/8/session/3#self-mission',
  },
];

const getDifficultyStars = (level: number) => '⭐'.repeat(level);

export function Missions() {
  const navigate = useNavigate();

  return (
    <SpaceBetween size="l">
      <Header
        variant="h1"
        description="각 Step에서 추가로 도전할 수 있는 셀프 미션 모음입니다. 필수는 아니지만, 완료하면 실력 향상에 큰 도움이 됩니다."
      >
        🎯 셀프 미션 모음
      </Header>

      <Container>
        <Table
          columnDefinitions={[
            {
              id: 'step',
              header: 'Step',
              cell: (item) => <Badge color="blue">{item.step}</Badge>,
              width: 80,
            },
            {
              id: 'session',
              header: '세션',
              cell: (item) => item.session,
              width: 60,
            },
            {
              id: 'title',
              header: '미션',
              cell: (item) => (
                <Link onFollow={() => navigate(item.path)}>{item.title}</Link>
              ),
            },
            {
              id: 'difficulty',
              header: '난이도',
              cell: (item) => getDifficultyStars(item.difficulty),
              width: 100,
            },
            {
              id: 'keywords',
              header: '핵심 키워드',
              cell: (item) => (
                <SpaceBetween direction="horizontal" size="xs">
                  {item.keywords.map((kw) => (
                    <Badge key={kw} color="grey">
                      {kw}
                    </Badge>
                  ))}
                </SpaceBetween>
              ),
            },
          ]}
          items={missions}
          variant="embedded"
          stripedRows
          empty={
            <Box textAlign="center" color="inherit">
              셀프 미션이 없습니다.
            </Box>
          }
        />
      </Container>

      <Container
        header={<Header variant="h2">💡 셀프 미션 활용 가이드</Header>}
      >
        <SpaceBetween size="s">
          <Box>
            <Box variant="p">
              셀프 미션은 해당 Step의 핵심 개념을 직접 적용해보는 도전
              과제입니다.
            </Box>
            <Box variant="p" margin={{ top: 's' }}>
              • <strong>⭐</strong> — 기본 실습을 완료했다면 바로 시도 가능
            </Box>
            <Box variant="p">
              • <strong>⭐⭐</strong> — 약간의 검색이나 시행착오가 필요할 수
              있음
            </Box>
            <Box variant="p">
              • <strong>⭐⭐⭐</strong> — 여러 개념을 조합해야 하며, 시간이 더
              소요됨
            </Box>
          </Box>
        </SpaceBetween>
      </Container>
    </SpaceBetween>
  );
}

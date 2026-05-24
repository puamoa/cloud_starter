import React from 'react';
import {
  Container,
  Header,
  SpaceBetween,
  Badge,
  Box,
  Button,
} from '@cloudscape-design/components';
import { WeekCurriculum } from '@/data/curriculum';

interface WeekCardProps {
  week: WeekCurriculum;
  status: 'completed' | 'current' | 'pending';
  onNavigate: () => void;
}

export const WeekCard: React.FC<WeekCardProps> = ({
  week,
  status,
  onNavigate,
}) => {
  const getStatusBadge = () => {
    switch (status) {
      case 'completed':
        return <Badge color="green">✅ 완료</Badge>;
      case 'current':
        return <Badge color="blue">📍 진행중</Badge>;
      case 'pending':
        return <Badge color="grey">⏳ 대기</Badge>;
    }
  };

  const getDifficultyBadge = () => {
    switch (week.difficulty) {
      case 'beginner':
        return <Badge color="green">초급</Badge>;
      case 'intermediate':
        return <Badge color="blue">중급</Badge>;
      case 'advanced':
        return <Badge color="red">고급</Badge>;
    }
  };

  return (
    <div className={`week-card week-card--${week.difficulty || 'beginner'}`}>
      <Container
        header={
          <Header
            variant="h3"
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                {getStatusBadge()}
                {getDifficultyBadge()}
              </SpaceBetween>
            }
          >
            Step {week.week}: {week.title}
          </Header>
        }
      >
        <SpaceBetween direction="vertical" size="m">
          <Box>{week.description}</Box>

          <div>
            <Box variant="small" color="text-status-info">
              ⏱️ 예상 소요 시간: {week.estimatedTime || '180분'}
            </Box>
          </div>

          <div>
            <Box variant="small">AWS 서비스:</Box>
            <SpaceBetween direction="horizontal" size="xs">
              {week.sessions
                .flatMap((session) => session.awsServices || [])
                .slice(0, 3)
                .map((service, index) => (
                  <Badge key={index} color="grey">
                    {service}
                  </Badge>
                ))}
              {week.sessions.flatMap((session) => session.awsServices || [])
                .length > 3 && (
                <Badge color="grey">
                  +
                  {week.sessions.flatMap((session) => session.awsServices || [])
                    .length - 3}
                </Badge>
              )}
            </SpaceBetween>
          </div>

          <Button
            variant={status === 'current' ? 'primary' : 'normal'}
            onClick={onNavigate}
            fullWidth
          >
            {status === 'completed'
              ? '📖 복습하기'
              : status === 'current'
                ? '🚀 시작하기'
                : '👀 미리보기'}
          </Button>
        </SpaceBetween>
      </Container>
    </div>
  );
};

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Header, Button, Grid } from '@cloudscape-design/components';

interface QuickJumpProps {
  // 현재 props 없음 - 향후 확장 가능
}

export const QuickJump: React.FC<QuickJumpProps> = () => {
  const navigate = useNavigate();

  const quickLinks = [
    { title: '환경 설정', href: '/setup', description: 'AWS 환경 설정 가이드' },
    { title: 'Step 0', href: '/week/0', description: 'Budget & 프리티어' },
    { title: 'Step 1', href: '/week/1', description: 'VPC & 네트워크' },
    { title: 'Step 2', href: '/week/2', description: 'EC2 인스턴스' },
    { title: 'Step 4', href: '/week/4', description: 'RDS (MySQL)' },
    { title: 'Step 8', href: '/week/8', description: 'CI/CD' },
  ];

  return (
    <Container header={<Header variant="h2">빠른 이동</Header>}>
      <Grid
        gridDefinition={[
          { colspan: { default: 12, xs: 6, s: 4, m: 4, l: 4 } },
          { colspan: { default: 12, xs: 6, s: 4, m: 4, l: 4 } },
          { colspan: { default: 12, xs: 6, s: 4, m: 4, l: 4 } },
          { colspan: { default: 12, xs: 6, s: 4, m: 4, l: 4 } },
          { colspan: { default: 12, xs: 6, s: 4, m: 4, l: 4 } },
          { colspan: { default: 12, xs: 6, s: 4, m: 4, l: 4 } },
        ]}
      >
        {quickLinks.map((link, index) => (
          <Button
            key={index}
            variant="normal"
            onClick={() => navigate(link.href)}
            fullWidth
          >
            {link.title}
          </Button>
        ))}
      </Grid>
    </Container>
  );
};

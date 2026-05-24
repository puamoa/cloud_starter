import React, { useState } from 'react'
import {
    Container,
    Header,
    SpaceBetween,
    Box,
    ColumnLayout,
    Icon,
    Tabs,
    Link,
    Badge
} from '@cloudscape-design/components'
import { siteConfig } from '@/data/siteConfig'
import '@/styles/environment-setup.css'
import '@/styles/info-boxes.css'

const Bullet: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="styled-list-item">
        <span><Icon name="caret-right-filled" size="small" /></span>
        <span>{children}</span>
    </div>
)

export const EnvironmentSetup: React.FC = () => {
    const [activeTabId, setActiveTabId] = useState('overview')

    return (
        <SpaceBetween direction="vertical" size="l">
            <Container
                header={
                    <Header variant="h1" description="AWS 실습을 시작하기 전에 필요한 환경 설정 및 확인 가이드">
                        환경 설정
                    </Header>
                }
            >
                <SpaceBetween direction="vertical" size="m">
                    <Box fontSize="body-m">
                        실습을 시작하기 전에 <strong>AWS 계정 생성 및 기본 환경</strong>을 설정해야 합니다.
                        이 가이드는 AWS 계정 생성부터 보안 설정, 리전 구성, 요금 관리, CloudFormation 사용법까지 안내합니다.
                    </Box>
                    <div className="info-box info-box--note">
                        <div className="info-box-icon"><Icon name="status-warning" variant="warning" /></div>
                        <div className="info-box-content">
                            <strong>중요</strong>
                            <div>실습 환경은 교육 목적으로만 사용해야 하며, 개인 정보나 민감한 데이터를 입력하지 마세요. 실습 종료 후 생성한 모든 리소스를 반드시 삭제해야 합니다.</div>
                        </div>
                    </div>
                </SpaceBetween>
            </Container>

            <Container>
                <Tabs
                    activeTabId={activeTabId}
                    onChange={({ detail }) => setActiveTabId(detail.activeTabId)}
                    tabs={[
                        {
                            id: 'overview',
                            label: '📋 개요',
                            content: (
                                <SpaceBetween direction="vertical" size="l">
                                    <ColumnLayout columns={3}>
                                        <Box>
                                            <SpaceBetween direction="vertical" size="m">
                                                <Box textAlign="center"><Icon name="user-profile" size="large" /></Box>
                                                <Box variant="h3" textAlign="center">1. 계정 생성</Box>
                                                <Box fontSize="body-m" textAlign="center">AWS 계정을 생성합니다</Box>
                                            </SpaceBetween>
                                        </Box>
                                        <Box>
                                            <SpaceBetween direction="vertical" size="m">
                                                <Box textAlign="center"><Icon name="lock-private" size="large" /></Box>
                                                <Box variant="h3" textAlign="center">2. 보안 설정</Box>
                                                <Box fontSize="body-m" textAlign="center">IAM 사용자 및 MFA를 설정합니다</Box>
                                            </SpaceBetween>
                                        </Box>
                                        <Box>
                                            <SpaceBetween direction="vertical" size="m">
                                                <Box textAlign="center"><Icon name="settings" size="large" /></Box>
                                                <Box variant="h3" textAlign="center">3. 리전 설정</Box>
                                                <Box fontSize="body-m" textAlign="center">서울 리전(ap-northeast-2)을 선택합니다</Box>
                                            </SpaceBetween>
                                        </Box>
                                    </ColumnLayout>
                                </SpaceBetween>
                            )
                        },
                        {
                            id: 'account',
                            label: '🎯 계정 생성',
                            content: (
                                <SpaceBetween direction="vertical" size="m">
                                    <Box fontSize="body-m">
                                        AWS 계정은 2가지 방식으로 생성할 수 있습니다. 계정 생성은{' '}
                                        <Link href="https://aws.amazon.com" external>AWS 공식 웹사이트</Link>에서 진행하세요.
                                    </Box>
                                    <ColumnLayout columns={2}>
                                        <div className="column-card column-card--green">
                                            <SpaceBetween direction="vertical" size="s">
                                                <Box><SpaceBetween direction="horizontal" size="xs" alignItems="center"><Icon name="status-positive" variant="success" /><Box variant="h4">무료 계정 플랜</Box></SpaceBetween></Box>
                                                <Box className="tab-content-text">6개월간 또는 크레딧 소진 시까지 무료 사용</Box>
                                            </SpaceBetween>
                                        </div>
                                        <div className="column-card column-card--blue">
                                            <SpaceBetween direction="vertical" size="s">
                                                <Box><SpaceBetween direction="horizontal" size="xs" alignItems="center"><Icon name="status-info" variant="link" /><Box variant="h4">유료 계정 플랜</Box></SpaceBetween></Box>
                                                <Box className="tab-content-text">모든 AWS 서비스 접근 가능, 크레딧 초과 시 온디맨드 요금</Box>
                                            </SpaceBetween>
                                        </div>
                                    </ColumnLayout>
                                    <div className="info-box info-box--note">
                                        <div className="info-box-icon"><Icon name="status-info" variant="link" /></div>
                                        <div className="info-box-content">
                                            <strong>새로운 AWS 프리 티어 (2025년 7월 15일부터)</strong>
                                            <div>최대 200 USD 크레딧 제공 (가입 시 100 USD + 활동 완료 시 100 USD 추가)</div>
                                        </div>
                                    </div>
                                    <Box>
                                        <SpaceBetween direction="vertical" size="s">
                                            <Box><SpaceBetween direction="horizontal" size="xs" alignItems="center"><Icon name="ticket" variant="link" /><Box variant="h4">추가 크레딧 획득 활동 (총 100 USD)</Box></SpaceBetween></Box>
                                            <ColumnLayout columns={5}>
                                                <Box textAlign="center" padding="s">
                                                    <SpaceBetween direction="vertical" size="xxs">
                                                        <Box fontSize="heading-l">📊</Box>
                                                        <Box fontWeight="bold" fontSize="body-s">AWS Budgets</Box>
                                                        <Box color="text-body-secondary" fontSize="body-s">예산 설정</Box>
                                                        <Badge color="blue">20 USD</Badge>
                                                    </SpaceBetween>
                                                </Box>
                                                <Box textAlign="center" padding="s">
                                                    <SpaceBetween direction="vertical" size="xxs">
                                                        <Box fontSize="heading-l">🖥️</Box>
                                                        <Box fontWeight="bold" fontSize="body-s">Amazon EC2</Box>
                                                        <Box color="text-body-secondary" fontSize="body-s">인스턴스 시작 및 종료</Box>
                                                        <Badge color="blue">20 USD</Badge>
                                                    </SpaceBetween>
                                                </Box>
                                                <Box textAlign="center" padding="s">
                                                    <SpaceBetween direction="vertical" size="xxs">
                                                        <Box fontSize="heading-l">🗄️</Box>
                                                        <Box fontWeight="bold" fontSize="body-s">Amazon RDS</Box>
                                                        <Box color="text-body-secondary" fontSize="body-s">데이터베이스 시작</Box>
                                                        <Badge color="blue">20 USD</Badge>
                                                    </SpaceBetween>
                                                </Box>
                                                <Box textAlign="center" padding="s">
                                                    <SpaceBetween direction="vertical" size="xxs">
                                                        <Box fontSize="heading-l">⚡</Box>
                                                        <Box fontWeight="bold" fontSize="body-s">AWS Lambda</Box>
                                                        <Box color="text-body-secondary" fontSize="body-s">함수 URL 웹앱 구축</Box>
                                                        <Badge color="blue">20 USD</Badge>
                                                    </SpaceBetween>
                                                </Box>
                                                <Box textAlign="center" padding="s">
                                                    <SpaceBetween direction="vertical" size="xxs">
                                                        <Box fontSize="heading-l">🤖</Box>
                                                        <Box fontWeight="bold" fontSize="body-s">Amazon Bedrock</Box>
                                                        <Box color="text-body-secondary" fontSize="body-s">프롬프트 제출</Box>
                                                        <Badge color="blue">20 USD</Badge>
                                                    </SpaceBetween>
                                                </Box>
                                            </ColumnLayout>
                                        </SpaceBetween>
                                    </Box>
                                </SpaceBetween>
                            )
                        },
                        {
                            id: 'security',
                            label: '🔒 보안 설정',
                            content: (
                                <SpaceBetween direction="vertical" size="m">
                                    <Box fontSize="body-m">계정 생성 후 반드시 아래 보안 설정을 완료하세요.</Box>
                                    <ColumnLayout columns={2}>
                                        <div className="column-card column-card--blue">
                                            <SpaceBetween direction="vertical" size="s">
                                                <Box><SpaceBetween direction="horizontal" size="xs" alignItems="center"><Icon name="user-profile" variant="link" /><Box variant="h4">IAM 사용자 생성</Box></SpaceBetween></Box>
                                                <Box className="tab-content-text">루트 사용자 대신 IAM 사용자를 생성하여 일상적인 작업에 사용합니다</Box>
                                                <Box className="tab-content-text">
                                                    <SpaceBetween direction="vertical" size="s">
                                                        <Box className="tab-content-text">1. AWS 콘솔에서 IAM 서비스로 이동합니다</Box>
                                                        <Box className="tab-content-text">2. 좌측 메뉴에서 Users → Create user를 선택합니다</Box>
                                                        <Box className="tab-content-text">3. 사용자 이름을 입력하고 AWS Management Console 액세스를 활성화합니다</Box>
                                                        <Box className="tab-content-text">4. Attach policies directly에서 AdministratorAccess를 선택합니다</Box>
                                                        <Box className="tab-content-text">5. Create user를 선택하여 완료합니다</Box>
                                                        <Box className="tab-content-text">6. 로그인 URL, 사용자 이름, 비밀번호를 안전하게 저장합니다</Box>
                                                    </SpaceBetween>
                                                </Box>
                                            </SpaceBetween>
                                        </div>
                                        <div className="column-card column-card--purple">
                                            <SpaceBetween direction="vertical" size="s">
                                                <Box><SpaceBetween direction="horizontal" size="xs" alignItems="center"><Icon name="lock-private" variant="link" /><Box variant="h4">MFA 설정</Box></SpaceBetween></Box>
                                                <Box className="tab-content-text">다중 인증(MFA)으로 계정 보안을 강화합니다</Box>
                                                <Box className="tab-content-text">
                                                    <SpaceBetween direction="vertical" size="s">
                                                        <Box className="tab-content-text">1. IAM 콘솔에서 해당 사용자를 선택합니다</Box>
                                                        <Box className="tab-content-text">2. Security credentials 탭을 선택합니다</Box>
                                                        <Box className="tab-content-text">3. Multi-factor authentication (MFA) 섹션에서 Assign MFA device를 선택합니다</Box>
                                                        <Box className="tab-content-text">4. Authenticator app을 선택합니다</Box>
                                                        <Box className="tab-content-text">5. 스마트폰에 Google Authenticator 또는 Microsoft Authenticator 앱을 설치합니다</Box>
                                                        <Box className="tab-content-text">6. 앱으로 QR 코드를 스캔하고 연속된 MFA 코드 2개를 입력합니다</Box>
                                                        <Box className="tab-content-text">7. Add MFA를 선택하여 완료합니다</Box>
                                                    </SpaceBetween>
                                                </Box>
                                            </SpaceBetween>
                                        </div>
                                    </ColumnLayout>
                                </SpaceBetween>
                            )
                        },
                        {
                            id: 'region',
                            label: '🌏 리전 설정',
                            content: (
                                <SpaceBetween direction="vertical" size="m">
                                    <Box fontSize="body-m">모든 실습은 <strong>서울 리전 (ap-northeast-2)</strong>에서 진행됩니다.</Box>
                                    <div className="info-box info-box--note">
                                        <div className="info-box-icon"><Icon name="status-info" variant="link" /></div>
                                        <div className="info-box-content">
                                            <strong>리전 확인</strong>
                                            <div>AWS Console 우측 상단의 리전 선택 드롭다운에서 "아시아 태평양(서울) ap-northeast-2"가 선택되어 있는지 확인합니다.</div>
                                        </div>
                                    </div>
                                    <Box>
                                        <SpaceBetween direction="vertical" size="s">
                                            <Box><SpaceBetween direction="horizontal" size="xs" alignItems="center"><Icon name="status-warning" variant="warning" /><Box variant="h4">주의사항</Box></SpaceBetween></Box>
                                            <Box className="tab-content-text">
                                                <SpaceBetween direction="vertical" size="xs">
                                                    <Bullet>리전이 다르면 실습 파일이나 리소스를 찾을 수 없습니다</Bullet>
                                                    <Bullet>실습 중 리전을 변경하지 않습니다</Bullet>
                                                    <Bullet>모든 리소스는 서울 리전에 생성합니다</Bullet>
                                                </SpaceBetween>
                                            </Box>
                                        </SpaceBetween>
                                    </Box>
                                </SpaceBetween>
                            )
                        },
                        {
                            id: 'billing',
                            label: '💰 요금 관리',
                            content: (
                                <SpaceBetween direction="vertical" size="m">
                                    <Box fontSize="body-m">실습 비용을 사전에 추정하고, 예산 알람을 설정하여 예상치 못한 요금을 방지하세요.</Box>
                                    <ColumnLayout columns={2}>
                                        <div className="column-card column-card--blue">
                                            <SpaceBetween direction="vertical" size="s">
                                                <Box><SpaceBetween direction="horizontal" size="xs" alignItems="center"><Icon name="status-info" variant="link" /><Box variant="h4">AWS 요금 추정기 사용법</Box></SpaceBetween></Box>
                                                <Box className="tab-content-text">
                                                    <SpaceBetween direction="vertical" size="s">
                                                        <Box className="tab-content-text">1. <Link href="https://calculator.aws" external>AWS 요금 추정기</Link>에 접속합니다</Box>
                                                        <Box className="tab-content-text">2. Create estimate 버튼을 선택합니다</Box>
                                                        <Box className="tab-content-text">3. 사용할 서비스를 검색하여 추가합니다 (예: EC2, RDS, S3)</Box>
                                                        <Box className="tab-content-text">4. 각 서비스의 사양과 사용 시간을 입력합니다</Box>
                                                        <Box className="tab-content-text">5. 예상 월별 비용을 확인합니다</Box>
                                                        <Box className="tab-content-text">6. Save and share로 추정 결과를 저장합니다</Box>
                                                    </SpaceBetween>
                                                </Box>
                                            </SpaceBetween>
                                        </div>
                                        <div className="column-card column-card--amber">
                                            <SpaceBetween direction="vertical" size="s">
                                                <Box><SpaceBetween direction="horizontal" size="xs" alignItems="center"><Icon name="status-warning" variant="warning" /><Box variant="h4">AWS Budgets 요금 알람 설정</Box></SpaceBetween></Box>
                                                <Box className="tab-content-text">
                                                    <SpaceBetween direction="vertical" size="s">
                                                        <Box className="tab-content-text">1. AWS 콘솔에서 검색창에 Billing을 입력하고 Billing을 선택합니다</Box>
                                                        <Box className="tab-content-text">2. 탐색 창에서 Budgets를 선택합니다</Box>
                                                        <Box className="tab-content-text">3. Create budget 버튼을 선택합니다</Box>
                                                        <Box className="tab-content-text">4. Use a template (simplified)을 선택합니다</Box>
                                                        <Box className="tab-content-text">5. Monthly cost budget을 선택합니다</Box>
                                                        <Box className="tab-content-text">6. 예산 금액을 설정합니다 (예: $10 또는 $20)</Box>
                                                        <Box className="tab-content-text">7. 이메일 주소를 입력하여 예산 초과 시 알림을 받습니다</Box>
                                                        <Box className="tab-content-text">8. Create budget을 선택하여 완료합니다</Box>
                                                    </SpaceBetween>
                                                </Box>
                                            </SpaceBetween>
                                        </div>
                                    </ColumnLayout>
                                </SpaceBetween>
                            )
                        },
                        {
                            id: 'cloudformation',
                            label: '📜 CloudFormation 스크립트',
                            content: (
                                <SpaceBetween direction="vertical" size="m">
                                    <Box fontSize="body-m">
                                        고급 과정에서는 AWS CloudFormation 템플릿을 활용하여 실습 환경을 자동으로 프로비저닝합니다.
                                    </Box>
                                    <ColumnLayout columns={2}>
                                        <div className="column-card column-card--green">
                                            <SpaceBetween direction="vertical" size="s">
                                                <Box><SpaceBetween direction="horizontal" size="xs" alignItems="center"><Icon name="upload" variant="link" /><Box variant="h4">SETUP: CloudFormation 스택 배포</Box></SpaceBetween></Box>
                                                <Box className="tab-content-text">
                                                    <SpaceBetween direction="vertical" size="s">
                                                        <Box className="tab-content-text">1. 각 실습 페이지에서 실습 스크립트 ZIP 파일을 다운로드합니다</Box>
                                                        <Box className="tab-content-text">2. ZIP 파일을 압축 해제하여 CloudFormation 템플릿(.yaml) 파일을 확인합니다</Box>
                                                        <Box className="tab-content-text">3. AWS 콘솔에서 CloudFormation 서비스로 이동합니다</Box>
                                                        <Box className="tab-content-text">4. Create stack → With new resources (standard)를 선택합니다</Box>
                                                        <Box className="tab-content-text">5. Upload a template file을 선택하고 압축 해제한 .yaml 파일을 업로드합니다</Box>
                                                        <Box className="tab-content-text">6. 스택 이름을 입력하고 파라미터를 확인합니다</Box>
                                                        <Box className="tab-content-text">7. Next → Next → Submit으로 스택을 생성합니다</Box>
                                                        <Box className="tab-content-text">8. 스택 상태가 CREATE_COMPLETE가 될 때까지 대기합니다</Box>
                                                    </SpaceBetween>
                                                </Box>
                                            </SpaceBetween>
                                        </div>
                                        <div className="column-card column-card--amber">
                                            <SpaceBetween direction="vertical" size="s">
                                                <Box><SpaceBetween direction="horizontal" size="xs" alignItems="center"><Icon name="remove" variant="link" /><Box variant="h4">CLEANUP: CloudFormation 스택 삭제</Box></SpaceBetween></Box>
                                                <Box className="tab-content-text">
                                                    <SpaceBetween direction="vertical" size="s">
                                                        <Box className="tab-content-text">1. AWS 콘솔에서 CloudFormation 서비스로 이동합니다</Box>
                                                        <Box className="tab-content-text">2. 삭제할 스택을 선택합니다</Box>
                                                        <Box className="tab-content-text">3. Delete 버튼을 클릭합니다</Box>
                                                        <Box className="tab-content-text">4. 스택 상태가 DELETE_COMPLETE가 될 때까지 대기합니다</Box>
                                                        <Box className="tab-content-text">5. EC2 콘솔에서 관련 리소스가 모두 삭제되었는지 확인합니다</Box>
                                                    </SpaceBetween>
                                                </Box>
                                            </SpaceBetween>
                                        </div>
                                    </ColumnLayout>
                                    <div className="info-box info-box--note">
                                        <div className="info-box-icon"><Icon name="status-warning" variant="warning" /></div>
                                        <div className="info-box-content">
                                            <strong>실습 주의사항</strong>
                                            <div>
                                                <ul style={{ margin: '4px 0', paddingLeft: '20px' }}>
                                                    <li>이전 실습의 CloudFormation 스택이 남아있으면 충돌이 발생할 수 있습니다</li>
                                                    <li>안전한 실습을 위해 이전 실습의 스택을 먼저 삭제하는 것을 권장합니다</li>
                                                    <li>스택 생성에 5-15분이 소요될 수 있으며, 상태를 주기적으로 확인하세요</li>
                                                    <li>실습 중 직접 생성한 리소스(EC2 인스턴스, S3 버킷 등)는 스택 삭제로 제거되지 않으므로 별도로 수동 삭제해야 합니다.</li>
                                                    <li><Link href="https://console.aws.amazon.com/resource-groups/tag-editor" external>Tag Editor</Link>를 활용하면 모든 리전의 리소스를 한눈에 조회하고 누락된 리소스를 확인할 수 있습니다.</li>
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                </SpaceBetween>
                            )
                        },
                        {
                            id: 'caution',
                            label: '❌ 실습 주의사항',
                            content: (
                                <SpaceBetween direction="vertical" size="m">
                                    <ColumnLayout columns={2}>
                                        <div className="column-card column-card--amber">
                                            <SpaceBetween direction="vertical" size="s">
                                                <Box><SpaceBetween direction="horizontal" size="xs" alignItems="center"><Icon name="remove" variant="error" /><Box variant="h4">리소스 정리 확인</Box></SpaceBetween></Box>
                                                <Box className="tab-content-text">
                                                    <SpaceBetween direction="vertical" size="xs">
                                                        <Bullet>CloudFormation 스택 삭제 후 AWS 콘솔에서 삭제하려고 한 리소스가 모두 삭제되었는지 반드시 확인하세요</Bullet>
                                                        <Bullet>실습 중 직접 생성한 리소스(EC2 인스턴스, S3 버킷 등)는 스택 삭제로 제거되지 않으므로 별도로 삭제해야 합니다</Bullet>
                                                        <Bullet>삭제되지 않은 리소스는 지속적으로 요금이 발생할 수 있습니다</Bullet>
                                                        <Bullet>AWS 콘솔에서 <Link href="https://console.aws.amazon.com/resource-groups/tag-editor" external>Tag Editor</Link>를 활용하면 모든 리전의 리소스를 한눈에 조회하고 누락된 리소스를 확인할 수 있습니다</Bullet>
                                                    </SpaceBetween>
                                                </Box>
                                            </SpaceBetween>
                                        </div>
                                        <div className="column-card column-card--blue">
                                            <SpaceBetween direction="vertical" size="s">
                                                <Box><SpaceBetween direction="horizontal" size="xs" alignItems="center"><Icon name="status-warning" variant="warning" /><Box variant="h4">정기적인 빌링 확인</Box></SpaceBetween></Box>
                                                <Box className="tab-content-text">
                                                    <SpaceBetween direction="vertical" size="xs">
                                                        <Bullet>주 1-2회 AWS Billing 대시보드에서 사용 요금을 확인하세요</Bullet>
                                                        <Bullet>예상보다 높은 요금이 발생하면 즉시 리소스를 점검하고 삭제하세요</Bullet>
                                                        <Bullet>AWS Budgets 알림을 설정하여 예산 초과를 미리 방지하세요</Bullet>
                                                    </SpaceBetween>
                                                </Box>
                                            </SpaceBetween>
                                        </div>
                                    </ColumnLayout>
                                </SpaceBetween>
                            )
                        }
                    ]}
                />
            </Container >

            {/* 이용 안내 카드 */}
            < Container
                header={
                    < Header variant="h2" >
                        <span className="section-title">📋 이용 안내</span>
                    </Header >
                }
            >
                <ColumnLayout columns={3} variant="text-grid">
                    <div className="column-card">
                        <SpaceBetween direction="vertical" size="xs">
                            <Box variant="h4">⚠️ 저작권 안내</Box>
                            <Box color="text-body-secondary" fontSize="body-s">
                                이 사이트의 모든 자료는 {siteConfig.university} {siteConfig.courseName} 과정을 위한 교육 자료입니다. 수업 목적 외의 무단 사용, 복제, 배포를 금지합니다.
                            </Box>
                        </SpaceBetween>
                    </div>
                    <div className="column-card">
                        <SpaceBetween direction="vertical" size="xs">
                            <Box variant="h4">🤖 제작 정보</Box>
                            <Box color="text-body-secondary" fontSize="body-s">
                                본 가이드는 Generative AI + Agentic AI 기술을 활용하여 제작되었습니다. 내용의 정확성을 위해 지속적으로 검토하고 있으나, 실습 시 주의깊게 확인해 주시기 바랍니다.
                            </Box>
                        </SpaceBetween>
                    </div>
                    <div className="column-card">
                        <SpaceBetween direction="vertical" size="xs">
                            <Box variant="h4">🔄 업데이트 안내</Box>
                            <Box color="text-body-secondary" fontSize="body-s">
                                AWS 콘솔 UI는 지속적으로 업데이트되므로, 실제 화면과 가이드 내용이 다를 수 있습니다. 차이가 있는 경우 최신 AWS 공식 문서를 참고하시기 바랍니다.
                            </Box>
                        </SpaceBetween>
                    </div>
                </ColumnLayout>
            </Container >
        </SpaceBetween >
    )
}

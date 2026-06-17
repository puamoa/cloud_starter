import React, { ReactNode, useState, useEffect, useRef } from 'react';
import {
  AppLayout as CloudScapeAppLayout,
  SideNavigation,
  BreadcrumbGroup,
  HelpPanel,
  TopNavigation,
  Box,
} from '@cloudscape-design/components';
import { useTheme } from '@/contexts/ThemeContext';
import { curriculum, sessionTypeConfig } from '@/data/curriculum';
import { getVisibleCurriculum } from '@/utils/contentFilter';
import { siteTitle } from '@/data/siteConfig';
import { HelpPanelContent } from '../education';
import '@/styles/app-layout.css';

interface AppLayoutProps {
  children: ReactNode;
  currentPath: string;
  onNavigate: (href: string) => void;
}

// 반응형 브레이크포인트 (CloudScape 기본값)
const MOBILE_BREAKPOINT = 688;
const VERY_SMALL_BREAKPOINT = 500; // 작은 모바일 기기

export const AppLayout: React.FC<AppLayoutProps> = ({
  children,
  currentPath,
  onNavigate,
}) => {
  const { theme, setTheme } = useTheme();
  const [toolsOpen, setToolsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(
    window.innerWidth < MOBILE_BREAKPOINT,
  );
  const [isVerySmall, setIsVerySmall] = useState(
    window.innerWidth < VERY_SMALL_BREAKPOINT,
  );

  // 초기 상태를 현재 창 크기에 따라 설정
  const [navigationOpen, setNavigationOpen] = useState(() => {
    return window.innerWidth >= MOBILE_BREAKPOINT;
  });

  // 데스크톱에서의 네비게이션 상태를 기억
  const desktopNavOpenRef = useRef(window.innerWidth >= MOBILE_BREAKPOINT);
  const prevMobileRef = useRef(window.innerWidth < MOBILE_BREAKPOINT);
  const isResizingRef = useRef(false);

  const handleNavigationChange = ({
    detail,
  }: {
    detail: { open: boolean };
  }) => {
    setNavigationOpen(detail.open);
    // 리사이즈 중이 아니고 데스크톱일 때만 기억
    if (!isResizingRef.current && window.innerWidth >= MOBILE_BREAKPOINT) {
      desktopNavOpenRef.current = detail.open;
    }
  };

  // 창 크기 변경 감지
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < MOBILE_BREAKPOINT;
      const verySmall = window.innerWidth < VERY_SMALL_BREAKPOINT;
      const wasMobile = prevMobileRef.current;

      isResizingRef.current = true;

      // 모바일 → 데스크톱 전환: 이전 데스크톱 상태 복원
      if (wasMobile && !mobile) {
        setNavigationOpen(desktopNavOpenRef.current);
      }

      prevMobileRef.current = mobile;
      setIsMobile(mobile);
      setIsVerySmall(verySmall);

      // CloudScape의 비동기 onNavigationChange 호출을 무시하기 위해 지연 해제
      setTimeout(() => {
        isResizingRef.current = false;
      }, 100);
    };

    // 리사이즈 이벤트 리스너 등록
    window.addEventListener('resize', handleResize);

    // 클린업
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  const navigationItems = [
    {
      type: 'section' as const,
      text: '시작하기',
      items: [
        { type: 'link' as const, text: '📚 실습 목록', href: '/dashboard' },
        { type: 'link' as const, text: '⚙️ 환경 설정', href: '/setup' },
      ],
    },
    { type: 'divider' as const },
    // 단계별 섹션 메뉴 생성 (실습/데모만 표시)
    ...getVisibleCurriculum()
      .map((week) => {
        // 모든 세션 표시
        const visibleSessions = week.sessions;

        // 표시할 차시가 없으면 이 주차는 메뉴에서 제외
        if (visibleSessions.length === 0) {
          return null;
        }

        return {
          type: 'section' as const,
          text: `Step ${week.week}: ${week.title}`,
          items: visibleSessions.map((session) => {
            // sessionTypeConfig에서 이모지 가져오기
            const config = sessionTypeConfig[session.type];
            const icon = config.emoji;

            return {
              type: 'link' as const,
              text: `${icon} ${week.week}-${session.session}. ${session.title}`,
              href: `/week/${week.week}/session/${session.session}`,
            };
          }),
        };
      })
      .filter((item) => item !== null), // null 항목 제거
  ];

  // 브레드크럼 생성
  const getBreadcrumbs = () => {
    const breadcrumbs = [{ text: '홈', href: '/' }];

    if (currentPath === '/dashboard') {
      breadcrumbs.push({ text: '시작하기', href: '#' });
      breadcrumbs.push({ text: '📚 실습 목록', href: '/dashboard' });
    } else if (currentPath === '/setup') {
      breadcrumbs.push({ text: '시작하기', href: '#' });
      breadcrumbs.push({ text: '⚙️ 환경 설정', href: '/setup' });
    } else if (currentPath.startsWith('/week/')) {
      const pathParts = currentPath.split('/');
      const weekNumber = parseInt(pathParts[2]);
      const weekData = curriculum.find((w) => w.week === weekNumber);

      if (weekData) {
        breadcrumbs.push({
          text: `Step ${weekNumber}`,
          href: `/week/${weekNumber}`,
        });

        // 차시 정보가 있으면 추가
        if (pathParts.length > 4 && pathParts[3] === 'session') {
          const sessionNumber = parseInt(pathParts[4]);
          const sessionData = weekData.sessions.find(
            (s) => s.session === sessionNumber,
          );
          if (sessionData) {
            const config = sessionTypeConfig[sessionData.type];
            breadcrumbs.push({
              text: `${config.emoji} ${weekNumber}-${sessionNumber}. ${sessionData.title}`,
              href: currentPath,
            });
          }
        }
      }
    }

    return breadcrumbs;
  };

  // 도움말 패널 내용
  const helpPanel = (
    <HelpPanel header={<Box variant="h3">목차 및 용어 사전</Box>} footer={null}>
      <HelpPanelContent
        onLinkClick={() => {
          // 모바일에서만 패널 닫기
          if (isMobile) {
            setToolsOpen(false);
          }
        }}
      />
    </HelpPanel>
  );

  return (
    <div className={`awsui-${theme}-mode app-layout-container`}>
      {/* TopNavigation과 모바일 Breadcrumb을 하나의 헤더로 묶음 */}
      <div className="app-layout-header">
        {/* 매우 작은 화면(400px 이하)에서는 별도의 모바일 헤더 */}
        {isVerySmall ? (
          <div className="very-small-mobile-header">
            <button
              className="mobile-icon-button mobile-icon-button--menu"
              onClick={() => setNavigationOpen(!navigationOpen)}
              aria-label="메뉴 열기"
            >
              <span className="mobile-icon">☰</span>
            </button>
            <button
              className="mobile-icon-button mobile-icon-button--info"
              onClick={() => setToolsOpen(!toolsOpen)}
              aria-label="목차 및 용어 사전 열기"
            >
              <span className="mobile-icon mobile-icon--info">i</span>
            </button>
            <button
              className="mobile-icon-button mobile-icon-button--theme"
              onClick={toggleTheme}
              aria-label={
                theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'
              }
            >
              <span className="mobile-icon">
                {theme === 'dark' ? '☀' : '🌙'}
              </span>
            </button>
          </div>
        ) : (
          /* TopNavigation (401px 이상) */
          <div className="app-layout-top-nav">
            {/* 데스크톱 사이드바 토글 버튼 */}
            {!isMobile && (
              <button
                className="desktop-nav-toggle"
                onClick={() => {
                  const newState = !navigationOpen;
                  setNavigationOpen(newState);
                  desktopNavOpenRef.current = newState;
                }}
                aria-label={navigationOpen ? '사이드바 닫기' : '사이드바 열기'}
              >
                {navigationOpen ? '✕' : '☰'}
              </button>
            )}
            <TopNavigation
              identity={{
                href: import.meta.env.BASE_URL || '/',
                title: isMobile ? '' : siteTitle,
              }}
              utilities={[
                // 햄버거 버튼 (모바일에서만 표시, CSS로 제어)
                {
                  type: 'button' as const,
                  iconName: 'menu' as const,
                  onClick: () => setNavigationOpen(!navigationOpen),
                  ariaLabel: '메뉴 열기',
                },
                // 모바일이지만 매우 작은 화면이 아닐 때만 중앙 텍스트 추가
                ...(isMobile && !isVerySmall
                  ? [
                      {
                        type: 'button' as const,
                        text: siteTitle,
                        onClick: () => onNavigate('/'),
                        variant: 'link' as const,
                      },
                    ]
                  : []),
                {
                  type: 'button' as const,
                  iconName: 'search' as const,
                  text: isMobile ? undefined : '목차 및 용어 사전',
                  onClick: () => setToolsOpen(!toolsOpen),
                  ariaLabel: '목차 및 용어 사전 열기',
                },
                {
                  type: 'button' as const,
                  text: isMobile
                    ? theme === 'dark'
                      ? '☀️'
                      : '🌙'
                    : theme === 'dark'
                      ? '☀️ 라이트 모드'
                      : '🌙 다크 모드',
                  onClick: toggleTheme,
                  ariaLabel:
                    theme === 'dark'
                      ? '라이트 모드로 전환'
                      : '다크 모드로 전환',
                },
              ]}
            />
          </div>
        )}

        {/* 모바일에서만 Breadcrumb */}
        {isMobile && (
          <div className="mobile-breadcrumb-header">
            <BreadcrumbGroup
              items={getBreadcrumbs()}
              onFollow={(event) => {
                if (!event.detail.external) {
                  event.preventDefault();
                  onNavigate(event.detail.href);
                }
              }}
            />
          </div>
        )}
      </div>

      <CloudScapeAppLayout
        navigationWidth={400}
        toolsWidth={400}
        stickyNotifications
        breadcrumbs={
          !isMobile ? (
            <div className="breadcrumb-container">
              <BreadcrumbGroup
                items={getBreadcrumbs()}
                onFollow={(event) => {
                  if (!event.detail.external) {
                    event.preventDefault();
                    onNavigate(event.detail.href);
                  }
                }}
              />
            </div>
          ) : undefined
        }
        content={children}
        navigation={
          <SideNavigation
            activeHref={currentPath}
            header={{ text: '☁️ AWS Starter', href: '/' }}
            items={navigationItems}
            onFollow={(event) => {
              if (!event.detail.external) {
                event.preventDefault();
                onNavigate(event.detail.href);
              }
            }}
          />
        }
        navigationOpen={navigationOpen}
        onNavigationChange={handleNavigationChange}
        tools={helpPanel}
        toolsOpen={toolsOpen}
        onToolsChange={({ detail }) => setToolsOpen(detail.open)}
        contentType="default"
      />
    </div>
  );
};

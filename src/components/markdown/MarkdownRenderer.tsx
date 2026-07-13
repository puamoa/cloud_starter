import React, { useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Box, Icon } from '@cloudscape-design/components';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import CopyToClipboard from '@cloudscape-design/components/copy-to-clipboard';
import CodeView from '@cloudscape-design/code-view/code-view';
import bashHighlight from '@cloudscape-design/code-view/highlight/sh';
import pythonHighlight from '@cloudscape-design/code-view/highlight/python';
import javascriptHighlight from '@cloudscape-design/code-view/highlight/javascript';
import typescriptHighlight from '@cloudscape-design/code-view/highlight/typescript';
import jsonHighlight from '@cloudscape-design/code-view/highlight/json';
import yamlHighlight from '@cloudscape-design/code-view/highlight/yaml';
import { createHighlight } from '@cloudscape-design/code-view/highlight';
import { SqlHighlightRules } from 'ace-code/src/mode/sql_highlight_rules';
import { AWSButton } from '@/components/ui/AWSButton';
import { UserValue } from '@/components/ui/UserValue';
import { FileDownload } from '@/components/education/FileDownload';
import '@/styles/user-value.css';
import '@/styles/markdown.css';
import '@/styles/info-boxes.css';
import '@/styles/download-files.css';
import '@/styles/markdown-renderer.css';
import '@/styles/guide-images.css';

// SQL 하이라이터 생성
const sqlHighlight = createHighlight(new SqlHighlightRules());

// react-markdown 컴포넌트 props 타입
interface CodeComponentProps {
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
}

interface ChildrenProps {
  children?: React.ReactNode;
}

interface LinkProps {
  href?: string;
  children?: React.ReactNode;
}

interface ImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src?: string;
  alt?: string;
}

// ReactElement의 props 타입
interface ElementWithChildren {
  children?: React.ReactNode;
  [key: string]: unknown;
}

// Markdown AST node 타입 (react-markdown이 전달하는 내부 노드)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MdNode = any; // react-markdown 내부 노드는 런타임에 다양한 형태를 가짐

// Cloudscape Icon name 타입
type IconName = React.ComponentProps<typeof Icon>['name'];

interface MarkdownRendererProps {
  content: string;
}

/**
 * Markdown 콘텐츠를 CloudScape 컴포넌트로 렌더링
 */
export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
}) => {
  // 이미지 줌 상태
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [zoomedAlt, setZoomedAlt] = useState<string>('');

  // 이미지 클릭 핸들러
  const handleImageClick = useCallback((src: string, alt: string) => {
    setZoomedImage(src);
    setZoomedAlt(alt);
  }, []);

  // 줌 모달 닫기
  const handleCloseZoom = useCallback(() => {
    setZoomedImage(null);
    setZoomedAlt('');
  }, []);

  // 텍스트에서 버튼 패턴을 찾아 React 컴포넌트로 변환하는 함수
  const processButtonPatterns = (text: string): React.ReactNode[] => {
    // [[버튼]], {{버튼}}, ((버튼)) 패턴을 모두 찾기
    const pattern = /(\[\[([^\]]+)\]\]|\{\{([^}]+)\}\}|\(\(([^)]+)\)\))/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null = null;

    while ((match = pattern.exec(text)) !== null) {
      // 패턴 이전의 텍스트 추가
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }

      // 버튼 컴포넌트 추가
      if (match[2]) {
        // [[버튼]] - 모두 primary (주황색)
        parts.push(
          <span key={match.index} className="markdown-button-wrapper">
            <AWSButton variant="primary" size="small">
              {match[2]}
            </AWSButton>
          </span>,
        );
      } else if (match[3]) {
        // {{버튼}} - Normal
        parts.push(
          <span key={match.index} className="markdown-button-wrapper">
            <AWSButton variant="normal" size="small">
              {match[3]}
            </AWSButton>
          </span>,
        );
      } else if (match[4]) {
        // ((버튼)) - Link
        parts.push(
          <span key={match.index} className="markdown-button-wrapper">
            <AWSButton variant="link" size="small">
              {match[4]}
            </AWSButton>
          </span>,
        );
      }

      lastIndex = pattern.lastIndex;
    }

    // 남은 텍스트 추가
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? parts : [text];
  };

  // children을 재귀적으로 처리하여 버튼 패턴 변환
  const processChildren = (children: React.ReactNode): React.ReactNode => {
    if (typeof children === 'string') {
      if (
        children.includes('[[') ||
        children.includes('{{') ||
        children.includes('((')
      ) {
        return processButtonPatterns(children);
      }
      return children;
    }
    if (Array.isArray(children)) {
      return children.map((child, index) => (
        <React.Fragment key={index}>{processChildren(child)}</React.Fragment>
      ));
    }
    // React 엘리먼트인 경우 (strong, em 등)
    if (React.isValidElement(children)) {
      const element = children as React.ReactElement<ElementWithChildren>;
      // props.children을 재귀적으로 처리
      if (element.props && element.props.children) {
        return React.cloneElement(element, {
          children: processChildren(element.props.children),
        });
      }
    }
    return children;
  };

  // 변換되지 않은 **텍스트** 패턴을 <strong>으로 변환하는 후처리 함수
  const processUnconvertedBold = (
    children: React.ReactNode,
  ): React.ReactNode => {
    if (typeof children === 'string') {
      // **텍스트** 패턴 찾기
      const pattern = /\*\*([^*]+)\*\*/g;
      if (pattern.test(children)) {
        const parts: React.ReactNode[] = [];
        let lastIndex = 0;
        const text = children;

        // 패턴 초기화
        pattern.lastIndex = 0;
        let match;

        while ((match = pattern.exec(text)) !== null) {
          // 패턴 이전의 텍스트 추가
          if (match.index > lastIndex) {
            parts.push(text.substring(lastIndex, match.index));
          }

          // <strong> 태그로 변환
          parts.push(
            <strong key={match.index} className="markdown-bold-text">
              {match[1]}
            </strong>,
          );

          lastIndex = pattern.lastIndex;
        }

        // 남은 텍스트 추가
        if (lastIndex < text.length) {
          parts.push(text.substring(lastIndex));
        }

        return parts.length > 0 ? parts : children;
      }
      return children;
    }

    if (Array.isArray(children)) {
      return children.map((child, index) => (
        <React.Fragment key={`bold-${index}`}>
          {processUnconvertedBold(child)}
        </React.Fragment>
      ));
    }

    // React 요소인 경우 children을 재귀적으로 처리
    if (React.isValidElement(children)) {
      const element = children as React.ReactElement<ElementWithChildren>;
      if (element.props?.children) {
        return React.cloneElement(element, {
          ...element.props,
          children: processUnconvertedBold(element.props.children),
        } as ElementWithChildren);
      }
    }

    return children;
  };

  // 커스텀 컴포넌트 매핑
  const components = {
    // 인라인 코드 → UserValue 컴포넌트
    code: ({ inline, className, children }: CodeComponentProps) => {
      const text = String(children).replace(/\s+/g, ' ').trim();
      const rawText = String(children);
      const codeContent = String(children).replace(/\n$/, '');

      // 줄바꿈이 있거나, className이 있거나, inline이 명시적으로 false면 코드 블록
      if (rawText.includes('\n') || className || inline === false) {
        // 언어 감지
        let highlight = undefined;
        let language = 'plaintext';

        if (className) {
          const match = className.match(/language-(\w+)/);
          if (match) {
            language = match[1];
          }
        }

        // 공통 들여쓰기 제거 함수
        const normalizeIndentation = (code: string): string => {
          const lines = code.split('\n');

          // 빈 줄이 아닌 줄들의 들여쓰기 찾기
          const nonEmptyLines = lines.filter((line) => line.trim().length > 0);
          if (nonEmptyLines.length === 0) return code;

          // 최소 들여쓰기 계산
          const minIndent = Math.min(
            ...nonEmptyLines.map((line) => {
              const match = line.match(/^(\s*)/);
              return match ? match[1].length : 0;
            }),
          );

          // 모든 줄에서 최소 들여쓰기만큼 제거
          return lines
            .map((line) => line.slice(minIndent))
            .join('\n')
            .trim();
        };

        // 들여쓰기 정규화 (언어가 지정된 코드 블록에만 적용)
        // plaintext(언어 미지정)는 ASCII 아트 등 의도적 공백이 있으므로 들여쓰기 제거하지 않음
        const normalizedCode =
          language !== 'plaintext'
            ? normalizeIndentation(codeContent)
            : codeContent.replace(/^\n+|\n+$/g, '');

        // 언어별 하이라이터 매핑 (더 많은 언어 지원)
        switch (language) {
          case 'bash':
          case 'sh':
          case 'shell':
            highlight = bashHighlight;
            break;
          case 'python':
          case 'py':
            highlight = pythonHighlight;
            break;
          case 'javascript':
          case 'js':
            highlight = javascriptHighlight;
            break;
          case 'typescript':
          case 'ts':
            highlight = typescriptHighlight;
            break;
          case 'json':
            highlight = jsonHighlight;
            break;
          case 'yaml':
          case 'yml':
            highlight = yamlHighlight;
            break;
          case 'sql':
          case 'mysql':
          case 'postgresql':
          case 'postgres':
            highlight = sqlHighlight;
            break;
          case 'html':
          case 'xml':
            // HTML은 기본 하이라이트 사용
            highlight = undefined;
            break;
          case 'css':
          case 'scss':
            highlight = undefined;
            break;
          case 'redis':
          case 'plaintext':
          case 'text':
            // 하이라이트 없이 표시
            highlight = undefined;
            break;
        }

        return (
          <div className="markdown-code-block">
            <CodeView
              content={normalizedCode}
              highlight={highlight}
              lineNumbers
              actions={
                <CopyToClipboard
                  copyButtonAriaLabel="코드 복사"
                  copyErrorText="복사 실패"
                  copySuccessText="복사됨"
                  textToCopy={normalizedCode}
                />
              }
            />
          </div>
        );
      }

      // 인라인 코드 → UserValue
      return <UserValue copyable={true}>{text}</UserValue>;
    },

    // 블록쿼트 → 세련된 정보 박스 또는 파일 다운로드
    blockquote: ({ children }: ChildrenProps) => {
      // extractText 함수를 여기서 정의 (모든 Alert에서 사용)
      const extractText = (node: MdNode): string => {
        if (typeof node === 'string') return node;
        if (Array.isArray(node)) {
          return node.map(extractText).filter(Boolean).join('\n');
        }
        if (node?.type === 'li') {
          const text = extractText(node.props?.children);
          return `- ${text}`;
        }
        if (node?.type === 'ul' || node?.type === 'ol') {
          return extractText(node.props?.children);
        }
        if (node?.props?.children) return extractText(node.props.children);
        if (node?.props?.value) return node.props.value;
        if (node?.type === 'p') {
          return extractText(node.props?.children) + '\n';
        }
        return '';
      };

      const content = extractText(children);

      // DOWNLOAD 블록 렌더링 - FileDownload 컴포넌트 사용 (팝오버 포함)
      const renderDownloadBlock = (
        children: React.ReactNode,
      ): React.ReactNode => {
        // children 배열에서 링크 요소 찾기
        let fileName = '';
        let downloadUrl = '';
        const fileList: { name: string; description: string }[] = [];
        const usageTasks: string[] = [];

        if (Array.isArray(children)) {
          children.forEach((child) => {
            // p 태그 확인 (링크 추출)
            if (child?.props?.node?.tagName === 'p' && child?.props?.children) {
              const pChildren = child.props.children;

              if (Array.isArray(pChildren)) {
                for (const pChild of pChildren) {
                  // a 태그 확인
                  if (pChild?.props?.node?.tagName === 'a' && pChild?.props) {
                    fileName = extractText(pChild.props.children);
                    downloadUrl =
                      pChild.props.href || pChild.props.node?.properties?.href;
                    break;
                  }
                }
              } else if (
                pChildren?.props?.node?.tagName === 'a' &&
                pChildren?.props
              ) {
                fileName = extractText(pChildren.props.children);
                downloadUrl =
                  pChildren.props.href ||
                  pChildren.props.node?.properties?.href;
              }
            }

            // ul 태그 확인 (파일 목록 또는 관련 태스크 추출)
            if (
              child?.props?.node?.tagName === 'ul' &&
              child?.props?.children
            ) {
              const ulChildren = child.props.children;

              if (Array.isArray(ulChildren)) {
                ulChildren.forEach((liChild) => {
                  // li 태그 확인
                  if (
                    liChild?.props?.node?.tagName === 'li' &&
                    liChild?.props?.children
                  ) {
                    const liChildren = liChild.props.children;
                    const liText = extractText(liChildren);

                    // "태스크 X:" 또는 "태스크 X-Y:" 또는 "참고 자료:" 패턴 감지 - 관련 태스크
                    if (
                      liText.match(
                        /^(태스크\s+[\d-]+|참고\s*자료|모든\s*태스크)/,
                      )
                    ) {
                      usageTasks.push(liText);
                      return;
                    }

                    // 파일 목록 파싱 (code 태그가 있는 경우만)
                    let fileName = '';
                    let description = '';

                    // li의 children에서 code 태그(파일명)와 텍스트(설명) 찾기
                    if (Array.isArray(liChildren)) {
                      let hasCodeTag = false;
                      liChildren.forEach((item) => {
                        // code 태그 (파일명)
                        if (item?.props?.node?.tagName === 'code') {
                          fileName = extractText(item.props.children);
                          hasCodeTag = true;
                        }
                        // 일반 텍스트 (설명)
                        else if (typeof item === 'string') {
                          const cleaned = item.trim();
                          if (cleaned.startsWith('-')) {
                            description = cleaned.substring(1).trim();
                          }
                        }
                      });

                      // code 태그가 있는 경우만 파일 목록에 추가
                      if (hasCodeTag && fileName) {
                        fileList.push({ name: fileName, description });
                      }
                    }
                  }
                });
              }
            }
          });
        }

        if (!fileName || !downloadUrl) {
          return null;
        }

        return (
          <Box margin={{ vertical: 'm' }}>
            <FileDownload
              fileName={fileName}
              downloadUrl={downloadUrl}
              files={fileList}
              usageTasks={usageTasks}
            />
          </Box>
        );
      };

      // [!DOWNLOAD] 감지 - FileDownload 컴포넌트로 렌더링
      if (content.includes('[!DOWNLOAD]')) {
        return renderDownloadBlock(children);
      }

      // [!CONCEPT] 감지 - 데모 가이드 전용 개념 설명
      if (content.includes('[!CONCEPT]')) {
        // 제목 추출: [!CONCEPT] 바로 뒤의 텍스트
        const titleMatch = content.match(/\[!CONCEPT\]\s+(.+?)(?:\n|$)/);
        const conceptTitle = titleMatch ? titleMatch[1].trim() : '개념 설명';

        // [!CONCEPT] 마커와 제목을 제거하고 나머지 children을 그대로 렌더링
        const removeConceptTitle = (node: MdNode): MdNode => {
          if (typeof node === 'string') {
            return node
              .replace(/\[!CONCEPT\]\s+.+?(?:\n|$)/, '')
              .replace(/^\s+/, '');
          }
          if (Array.isArray(node)) {
            return node
              .map(removeConceptTitle)
              .filter((n: MdNode) => n !== '' && n != null);
          }
          if (node?.props?.children) {
            const newChildren = removeConceptTitle(node.props.children);
            // 자식이 빈 배열이거나 빈 문자열이면 null 반환
            if (Array.isArray(newChildren) && newChildren.length === 0)
              return null;
            if (newChildren === '') return null;
            return {
              ...node,
              props: {
                ...node.props,
                children: newChildren,
              },
            };
          }
          return node;
        };

        const cleanedChildren = removeConceptTitle(children);

        return (
          <Box margin={{ vertical: 'm' }}>
            <div className="concept-box">
              <div className="concept-box-header">
                <Icon name="status-info" variant="normal" />
                <span>{conceptTitle}</span>
              </div>
              <div className="concept-box-content">{cleanedChildren}</div>
            </div>
          </Box>
        );
      }

      // [!NOTE], [!WARNING], [!TIP], [!OUTPUT], [!SUCCESS], [!ERROR], [!COST], [!IMPORTANT], [!TROUBLESHOOTING], [!ARCHITECTURE] 감지
      let boxType = 'note';
      let iconName: IconName = 'status-info';
      let label = '참고';
      let isOutputBlock = false;
      let isArchitectureBlock = false;

      if (content.includes('[!NOTE]')) {
        boxType = 'note';
        iconName = 'status-info';
        label = '참고';
      } else if (content.includes('[!WARNING]')) {
        boxType = 'warning';
        iconName = 'status-warning';
        label = '경고';
      } else if (content.includes('[!TIP]')) {
        boxType = 'tip';
        iconName = 'status-positive';
        label = '팁';
      } else if (content.includes('[!ERROR]')) {
        boxType = 'error';
        iconName = 'status-negative';
        label = '오류';
      } else if (content.includes('[!OUTPUT]')) {
        boxType = 'output';
        iconName = 'file';
        label = '예상 출력';
        isOutputBlock = true;
      } else if (content.includes('[!SUCCESS]')) {
        boxType = 'success';
        iconName = 'status-positive';
        label = '성공';
      } else if (content.includes('[!COST]')) {
        boxType = 'cost';
        iconName = 'status-info';
        label = '리소스 비용 가이드';
      } else if (content.includes('[!IMPORTANT]')) {
        boxType = 'important';
        iconName = 'status-info';
        label = '중요';
      } else if (content.includes('[!TROUBLESHOOTING]')) {
        boxType = 'troubleshooting';
        iconName = 'status-warning';
        label = '문제 해결';
      } else if (content.includes('[!CONCEPT]')) {
        boxType = 'concept';
        iconName = 'status-info';
        label = '개념';
      } else if (content.includes('[!ARCHITECTURE]')) {
        boxType = 'architecture';
        iconName = 'view-full';
        label = '아키텍처 다이어그램';
        isArchitectureBlock = true;
      } else if (content.includes('[!DOWNLOAD]')) {
        // DOWNLOAD 블록은 별도 처리
        return renderDownloadBlock(children);
      }

      // OUTPUT 블록은 특별 처리 - 내부 코드 블록을 추출하여 렌더링
      if (isOutputBlock) {
        // children 배열에서 pre > code 요소 찾기
        let codeContent = null;
        let language = 'plaintext';

        if (Array.isArray(children)) {
          for (const child of children) {
            // pre 요소 찾기
            if (child?.type === 'pre' && child?.props?.children) {
              const codeElement = child.props.children;
              // code 요소에서 언어와 내용 추출
              if (codeElement?.props?.className) {
                const match =
                  codeElement.props.className.match(/language-(\w+)/);
                if (match) language = match[1];
              }
              if (codeElement?.props?.children) {
                codeContent = String(codeElement.props.children);
              }
              break;
            }
          }
        }

        if (codeContent) {
          const code = codeContent;

          // 언어별 하이라이터 매핑
          let highlight = undefined;
          switch (language) {
            case 'bash':
            case 'sh':
            case 'shell':
              highlight = bashHighlight;
              break;
            case 'python':
            case 'py':
              highlight = pythonHighlight;
              break;
            case 'javascript':
            case 'js':
              highlight = javascriptHighlight;
              break;
            case 'typescript':
            case 'ts':
              highlight = typescriptHighlight;
              break;
            case 'json':
              highlight = jsonHighlight;
              break;
            case 'yaml':
            case 'yml':
              highlight = yamlHighlight;
              break;
          }

          return (
            <div className={`info-box info-box--${boxType}`} role="note">
              <div className="info-box-icon">
                <Icon name={iconName} />
              </div>
              <div className="info-box-content">
                <strong>{label}</strong>
                <Box margin={{ top: 's' }}>
                  <CodeView
                    content={code.trim()}
                    highlight={highlight}
                    lineNumbers
                    actions={
                      <CopyToClipboard
                        copyButtonAriaLabel="코드 복사"
                        copyErrorText="복사 실패"
                        copySuccessText="복사됨"
                        textToCopy={code.trim()}
                      />
                    }
                  />
                </Box>
              </div>
            </div>
          );
        }

        // 코드 블록이 없으면 일반 콘텐츠로 표시 (테이블 등 포함)
        const removeOutputMarker = (node: MdNode): MdNode => {
          if (typeof node === 'string') {
            return node.replace(/\[!OUTPUT\]\s*/g, '');
          }
          if (Array.isArray(node)) {
            return node.map(removeOutputMarker);
          }
          if (node?.props?.children) {
            return {
              ...node,
              props: {
                ...node.props,
                children: removeOutputMarker(node.props.children),
              },
            };
          }
          return node;
        };
        const cleanedOutputChildren = removeOutputMarker(children);
        return (
          <div className={`info-box info-box--${boxType}`} role="note">
            <div className="info-box-icon">
              <Icon name={iconName} />
            </div>
            <div className="info-box-content">
              <strong>{label}</strong>
              <div className="alert-content-wrapper">
                {cleanedOutputChildren}
              </div>
            </div>
          </div>
        );
      }

      // Alert 마커 제거 함수 (먼저 선언)
      const removeAlertMarker = (node: MdNode): MdNode => {
        if (typeof node === 'string') {
          return node.replace(
            /\[!(NOTE|WARNING|TIP|ERROR|SUCCESS|COST|IMPORTANT|TROUBLESHOOTING|CONCEPT|DOWNLOAD|OUTPUT|ARCHITECTURE)\]\s*/g,
            '',
          );
        }
        if (Array.isArray(node)) {
          return node.map(removeAlertMarker);
        }
        if (node?.props?.children) {
          return {
            ...node,
            props: {
              ...node.props,
              children: removeAlertMarker(node.props.children),
            },
          };
        }
        return node;
      };

      // 이미지에 클릭 이벤트 추가 함수
      const addImageClickHandler = (node: MdNode): MdNode => {
        if (typeof node === 'string') {
          return node;
        }
        if (Array.isArray(node)) {
          return node.map(addImageClickHandler);
        }
        // img 태그인 경우 클릭 이벤트 추가
        if (node?.type === 'img' || node?.props?.node?.tagName === 'img') {
          const rawSrc = node.props?.src || node.props?.node?.properties?.src;
          const imgAlt =
            node.props?.alt || node.props?.node?.properties?.alt || '';
          const base = import.meta.env.BASE_URL || '/';
          const imgSrc = rawSrc?.startsWith(base)
            ? rawSrc
            : `${base}${rawSrc?.replace(/^\//, '')}`;

          return {
            ...node,
            props: {
              ...node.props,
              onClick: () => handleImageClick(imgSrc, imgAlt),
              style: { ...node.props?.style, cursor: 'zoom-in' },
            },
          };
        }
        if (node?.props?.children) {
          return {
            ...node,
            props: {
              ...node.props,
              children: addImageClickHandler(node.props.children),
            },
          };
        }
        return node;
      };

      // ARCHITECTURE 블록은 특별 처리 - 이미지를 중앙 정렬하여 카드 형태로 표시
      if (isArchitectureBlock) {
        const cleanedContent = removeAlertMarker(children);
        const contentWithClickHandler = addImageClickHandler(cleanedContent);

        return (
          <div className="architecture-box">
            <div className="architecture-box-header">
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                style={{ flexShrink: 0 }}
              >
                <path
                  d="M3 3h6v6H3V3zm8 0h6v6h-6V3zM3 11h6v6H3v-6zm8 0h6v6h-6v-6z"
                  fill="#ff9900"
                />
              </svg>
              <span>{label}</span>
            </div>
            <div className="architecture-box-content">
              {contentWithClickHandler}
            </div>
          </div>
        );
      }

      // role 속성 결정 (접근성)
      const roleAttr =
        boxType === 'warning' || boxType === 'error' ? 'alert' : 'note';

      const cleanedChildren = removeAlertMarker(children);

      return (
        <div className={`info-box info-box--${boxType}`} role={roleAttr}>
          <div className="info-box-icon">
            <Icon name={iconName} />
          </div>
          <div className="info-box-content">
            <strong>{label}</strong>
            <div className="alert-content-wrapper">{cleanedChildren}</div>
          </div>
        </div>
      );
    },

    // 링크 → AWS 버튼 또는 일반 링크
    a: ({ href, children }: LinkProps) => {
      // aws: 프로토콜 감지
      if (href?.startsWith('aws:')) {
        const parts = href.replace('aws:', '').split(':');
        const service = parts[0];

        return (
          <AWSButton href={`https://console.aws.amazon.com/${service}`}>
            {children}
          </AWSButton>
        );
      }

      // 앵커 링크 (#으로 시작) - 페이지 내 스크롤
      if (href?.startsWith('#')) {
        const handleClick = (e: React.MouseEvent) => {
          e.preventDefault();
          const targetId = href.substring(1); // # 제거
          const targetElement = document.getElementById(targetId);
          if (targetElement) {
            // 헤더 높이 + 여유 공간 (80px) 고려
            const headerOffset = 80;
            const elementPosition = targetElement.getBoundingClientRect().top;
            const offsetPosition =
              elementPosition + window.pageYOffset - headerOffset;

            window.scrollTo({
              top: offsetPosition,
              behavior: 'smooth',
            });

            // URL 업데이트
            window.history.pushState(null, '', href);
          }
        };

        return (
          <a href={href} onClick={handleClick} className="markdown-anchor-link">
            {children}
          </a>
        );
      }

      // 내부 링크 (/week/... 등 같은 앱 내 경로) - 새 탭에서 열기
      if (href?.startsWith('/') && !href?.startsWith('//')) {
        return (
          <a href={href} target="_blank" rel="noopener noreferrer">
            {children}
          </a>
        );
      }

      // 외부 링크
      return (
        <a href={href} target="_blank" rel="noopener noreferrer">
          {children}
        </a>
      );
    },

    // 강조 (굵게) → 버튼 패턴은 처리하지 않고 일반 굵은 텍스트로만 처리
    strong: ({ children }: ChildrenProps) => {
      // 일반 굵은 텍스트 (필드명, 메뉴명)
      // children을 그대로 렌더링하여 괄호 안 텍스트도 볼드로 표시
      return <strong className="markdown-strong">{children}</strong>;
    },

    // 순서 있는 리스트 - 전체 문서에서 연속된 번호
    ol: ({ children }: ChildrenProps) => {
      return (
        <Box margin={{ vertical: 'm' }}>
          <ol className="markdown-ordered-list">{children}</ol>
        </Box>
      );
    },

    // 순서 없는 리스트
    ul: ({ children }: ChildrenProps) => {
      return (
        <Box margin={{ vertical: 'm' }}>
          <ul className="markdown-unordered-list">{children}</ul>
        </Box>
      );
    },

    // 리스트 아이템
    li: ({ children }: ChildrenProps) => {
      // 버튼 패턴 처리 후 변환되지 않은 **텍스트** 패턴도 처리
      const processedChildren = processChildren(children);
      const finalChildren = processUnconvertedBold(processedChildren);

      return <li className="markdown-list-item">{finalChildren}</li>;
    },

    // 정의 목록 (Definition List) - 완전히 일반 단락으로 변환
    dl: ({ children }: ChildrenProps) => {
      // dt와 dd를 하나의 문장으로 합치기
      const items: React.ReactNode[] = [];
      let currentTerm: React.ReactNode = null;

      React.Children.forEach(children, (child) => {
        if (React.isValidElement(child)) {
          const childElement = child as React.ReactElement<ElementWithChildren>;
          if (childElement.type === 'dt') {
            currentTerm = childElement.props.children;
          } else if (childElement.type === 'dd' && currentTerm) {
            items.push(
              <p key={items.length} className="definition-list-item">
                <strong>{currentTerm}</strong>: {childElement.props.children}
              </p>,
            );
            currentTerm = null;
          }
        }
      });

      return <div className="definition-list-wrapper">{items}</div>;
    },

    // dt와 dd는 dl에서 처리하므로 그대로 반환
    dt: ({ children }: ChildrenProps) => children,
    dd: ({ children }: ChildrenProps) => children,

    // 단락 - [[버튼명]] 감지 및 StatusIndicator 패턴 감지
    p: ({ children }: ChildrenProps) => {
      // children을 문자열로 변환하여 패턴 확인
      const extractText = (node: MdNode): string => {
        if (typeof node === 'string') return node;
        if (Array.isArray(node)) return node.map(extractText).join('');
        if (node?.props?.children) return extractText(node.props.children);
        return '';
      };

      const text = extractText(children);

      // StatusIndicator 패턴 감지: 💡 **참고**:, ✅ **태스크 완료**:, 📋 **예상 결과**: 등
      const statusPatterns = [
        { emoji: '💡', label: '참고', type: 'info' as const },
        { emoji: '✅', label: '태스크 완료', type: 'success' as const },
        { emoji: '✅', label: '결과', type: 'success' as const },
        { emoji: '✅', label: '실습 종료', type: 'success' as const },
        { emoji: '📋', label: '예상 결과', type: 'in-progress' as const },
        { emoji: '📋', label: '예상 출력', type: 'in-progress' as const },
      ];

      for (const pattern of statusPatterns) {
        const regex = new RegExp(
          `^${pattern.emoji}\\s*\\*\\*${pattern.label}\\*\\*:?\\s*(.*)$`,
        );
        const match = text.match(regex);
        if (match) {
          return (
            <Box
              variant="p"
              fontSize="body-m"
              margin={{ top: 'xs', bottom: 'xs' }}
            >
              <span className="markdown-status-wrapper">
                <StatusIndicator type={pattern.type}>
                  {pattern.label}
                </StatusIndicator>
                <span className="markdown-status-text">{match[1]}</span>
              </span>
            </Box>
          );
        }
      }

      // 버튼 패턴 처리 후 변환되지 않은 **텍스트** 패턴도 처리
      const processedChildren = processChildren(children);
      const finalChildren = processUnconvertedBold(processedChildren);

      return (
        <Box variant="p" fontSize="body-m" margin={{ top: 'xs', bottom: 'xs' }}>
          <span className="markdown-paragraph-text">{finalChildren}</span>
        </Box>
      );
    },

    // 제목
    h1: ({ children }: ChildrenProps) => {
      const text = String(children);
      // ID 생성: 리소스 정리는 'cleanup', 참고는 'reference'
      let id = '';
      if (text.includes('🗑️') || text.includes('리소스 정리')) {
        id = 'cleanup';
      } else if (text.includes('📚') || text.includes('참고')) {
        id = 'reference';
      }

      return (
        <Box
          variant="h1"
          margin={{ top: 'l', bottom: 'm' }}
          id={id || undefined}
        >
          <span className="markdown-h1">{children}</span>
        </Box>
      );
    },
    h2: ({ children }: ChildrenProps) => {
      // children에서 순수 텍스트 추출 (React 노드 대응)
      const extractTextFromChildren = (node: React.ReactNode): string => {
        if (typeof node === 'string') return node;
        if (typeof node === 'number') return String(node);
        if (Array.isArray(node))
          return node.map(extractTextFromChildren).join('');
        if (node && typeof node === 'object' && 'props' in node) {
          return extractTextFromChildren(
            (node as React.ReactElement).props.children,
          );
        }
        return '';
      };
      const text = extractTextFromChildren(children);
      // "태스크" 또는 "데모"로 시작하는 h2는 h3로 렌더링 (계층 구조 명확화)
      const isTask = text.includes('태스크') || text.includes('Task');
      const isDemo = text.includes('데모') || text.includes('Demo');
      // "📚 참고:"로 시작하는 제목은 별도 카드로 분리되므로 구분선 불필요
      const isReference = text.includes('📚 참고:') || text.includes('참고:');
      // 구분선이 필요한 섹션들
      const needsDivider =
        !isReference &&
        (text.includes('마무리') ||
          text.includes('추가 학습 리소스') ||
          text.includes('추가 리소스') ||
          text.includes('리소스 정리') ||
          text.includes('실습 종료') ||
          text.includes('데모 종료') ||
          text.includes('핵심 개념 정리'));

      // ID 생성
      let id = '';
      if (isTask) {
        // "태스크 1: ..." → "task-1"
        const taskMatch = text.match(/태스크\s+(\d+)/);
        if (taskMatch) {
          id = `task-${taskMatch[1]}`;
        }
      } else if (text.includes('🗑️') || text.includes('리소스 정리')) {
        id = 'cleanup';
      } else if (text.includes('📚') || text.includes('참고')) {
        id = 'reference';
      } else if (text.includes('🎯') || text.includes('셀프 미션')) {
        id = 'self-mission';
      } else {
        // 리소스 정리 하위 섹션 (## 1단계:, ## 2단계:)
        const stepMatch = text.match(/(?:(\d+)단계|단계\s+(\d+))/);
        if (stepMatch) {
          const stepNumber = stepMatch[1] || stepMatch[2];
          id = `cleanup-step-${stepNumber}`;
        }
      }

      // Fallback: slugify from text if no specific id was generated
      if (!id) {
        id = text
          .toLowerCase()
          .replace(/[^a-z0-9가-힣]/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '');
      }

      if (isTask || isDemo) {
        return (
          <>
            <Box margin={{ top: 'xl', bottom: 'm' }}>
              <hr className="markdown-divider" />
            </Box>
            <Box
              variant="h3"
              margin={{ top: 'm', bottom: 's' }}
              id={id || undefined}
            >
              <span className="markdown-h2">{children}</span>
            </Box>
          </>
        );
      }

      if (needsDivider) {
        return (
          <>
            <Box margin={{ top: 'xl', bottom: 'm' }}>
              <hr className="markdown-divider" />
            </Box>
            <Box
              variant="h2"
              margin={{ top: 'm', bottom: 's' }}
              id={id || undefined}
            >
              <span className="markdown-h2">{children}</span>
            </Box>
          </>
        );
      }

      // 일반 h2 (구분선 없음)
      return (
        <Box
          variant="h2"
          margin={{ top: 'l', bottom: 's' }}
          id={id || undefined}
        >
          <span className="markdown-h2">{children}</span>
        </Box>
      );
    },
    h3: ({ children }: ChildrenProps) => {
      const text = String(children);

      // ID 생성: 리소스 정리 하위 섹션 또는 옵션
      let id = '';

      // 옵션 패턴 (옵션 1, 옵션 2)
      const optionMatch = text.match(/옵션\s*(\d+)/);
      if (optionMatch) {
        id = `option-${optionMatch[1]}`;
      } else {
        // 단계 패턴 (1단계, 단계 1)
        const stepMatch = text.match(/(?:(\d+)단계|단계\s+(\d+))/);
        if (stepMatch) {
          const stepNumber = stepMatch[1] || stepMatch[2];
          id = `cleanup-step-${stepNumber}`;
        }
      }

      // Fallback: slugify from text if no specific id was generated
      if (!id) {
        id = text
          .toLowerCase()
          .replace(/[^a-z0-9가-힣]/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '');
      }

      return (
        <Box
          variant="h3"
          margin={{ top: 'l', bottom: 'xxxs' }}
          padding={{ top: 's', bottom: 'xs' }}
          id={id || undefined}
        >
          <span className="markdown-h3">{children}</span>
        </Box>
      );
    },
    h4: ({ children }: ChildrenProps) => {
      const text = String(children);

      // ID 생성: 리소스 정리 하위 섹션 또는 옵션
      let id = '';

      // 옵션 패턴 (옵션 1, 옵션 2)
      const optionMatch = text.match(/옵션\s*(\d+)/);
      if (optionMatch) {
        id = `option-${optionMatch[1]}`;
      } else {
        // 단계 패턴 (1단계, 단계 1)
        const stepMatch = text.match(/(?:(\d+)단계|단계\s+(\d+))/);
        if (stepMatch) {
          const stepNumber = stepMatch[1] || stepMatch[2];
          id = `cleanup-step-${stepNumber}`;
        }
      }

      return (
        <Box
          variant="h4"
          margin={{ top: 'm', bottom: 'xxxs' }}
          padding={{ top: 'xs', bottom: 'xxs' }}
          id={id || undefined}
        >
          <span className="markdown-h4">{children}</span>
        </Box>
      );
    },

    // 이미지 - base path 자동 처리 + 클릭 확대
    img: ({ src, alt, ...props }: ImageProps) => {
      // base path 가져오기 (vite.config.ts에서 설정한 값)
      const base = import.meta.env.BASE_URL || '/';

      // 이미 base path가 포함되어 있으면 그대로 사용
      const imageSrc = src?.startsWith(base)
        ? src
        : `${base}${src?.replace(/^\//, '')}`;

      return (
        <img
          src={imageSrc}
          alt={alt || ''}
          className="markdown-image"
          style={{ cursor: 'zoom-in' }}
          onClick={() => handleImageClick(imageSrc, alt || '')}
          {...props}
        />
      );
    },

    // 테이블 컴포넌트
    table: ({ children }: ChildrenProps) => <table>{children}</table>,
    thead: ({ children }: ChildrenProps) => <thead>{children}</thead>,
    tbody: ({ children }: ChildrenProps) => <tbody>{children}</tbody>,
    tr: ({ children }: ChildrenProps) => <tr>{children}</tr>,
    th: ({ children }: ChildrenProps) => <th>{children}</th>,
    td: ({ children }: ChildrenProps) => <td>{children}</td>,
  };

  return (
    <>
      <Box className="markdown-content">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw]}
          components={components}
        >
          {content}
        </ReactMarkdown>
      </Box>

      {/* 이미지 줌 모달 */}
      {zoomedImage && (
        <div className="image-zoom-overlay" onClick={handleCloseZoom}>
          <div className="image-zoom-container" onClick={handleCloseZoom}>
            <button
              className="image-zoom-close"
              onClick={handleCloseZoom}
              aria-label="닫기"
            >
              ✕
            </button>
            <img src={zoomedImage} alt={zoomedAlt} className="image-zoom-img" />
            {zoomedAlt && <div className="image-zoom-title">{zoomedAlt}</div>}
          </div>
        </div>
      )}
    </>
  );
};

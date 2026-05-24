# AWS 기초 실습 가이드

AWS 인프라를 단계별로 직접 구축해보는 실습 중심 가이드입니다.

## 🌐 배포 URL

https://puamoa.github.io/cloud_starter/

## 📚 커리큘럼 (12 Steps)

| Step | 제목                                | 난이도 |
| ---- | ----------------------------------- | ------ |
| 0    | 비용 관리 & 프리티어                | 초급   |
| 1    | Amazon VPC 네트워크 설계            | 초급   |
| 2    | Amazon EC2 서버 구축                | 초급   |
| 3    | NAT를 통한 Private 인터넷 연결      | 중급   |
| 4    | Amazon RDS 관리형 데이터베이스      | 중급   |
| 5    | Amazon S3 스토리지 활용             | 중급   |
| 6    | AWS에서 비밀값 안전하게 관리        | 중급   |
| 7    | 고가용성 & HTTPS 적용               | 중급   |
| 8    | GitHub Actions 자동 배포            | 고급   |
| 9    | 3-Tier 아키텍처 통합 배포           | 고급   |
| 10   | 서버리스 백엔드 (DynamoDB + Lambda) | 고급   |
| 11   | Amazon Bedrock 체험                 | 고급   |

## 🛠️ 기술 스택

- React 18 + TypeScript
- Vite 5
- AWS CloudScape Design System
- react-markdown + remark-gfm
- GitHub Pages 배포

## 🚀 로컬 실행

```bash
npm install
npm run dev
```

## 📦 빌드 및 배포

```bash
npm run build
```

GitHub Pages 배포는 `main` 브랜치에 push하면 자동으로 실행됩니다.

## 📁 프로젝트 구조

```
public/
├── content/          # 마크다운 실습 가이드
│   ├── step0-budget/
│   ├── step1-vpc/
│   ├── step2-ec2/
│   ├── ...
│   └── step11-bedrock/
└── files/            # CloudFormation 템플릿 (ZIP)
    ├── step2/
    ├── step3/
    ├── step4/
    ├── step7/
    └── step9/
src/
├── components/       # UI 컴포넌트
├── data/             # 커리큘럼, 사이트 설정
├── pages/            # 페이지 컴포넌트
├── styles/           # CSS
└── utils/            # 유틸리티
```

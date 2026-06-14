---
title: 'Spring에서 Amazon S3 파일 업로드 구현'
week: 5
session: 2
awsServices:
  - Amazon S3
  - AWS IAM
  - Amazon EC2
learningObjectives:
  - Spring 프로젝트에서 AWS SDK v2를 설정할 수 있습니다.
  - MultipartFile을 S3에 업로드하는 서비스를 구현할 수 있습니다.
  - Presigned URL을 생성하여 클라이언트 직접 업로드를 구현할 수 있습니다.
  - S3 객체를 삭제하고 목록을 조회할 수 있습니다.
  - IAM Role을 EC2에 연결하여 Access Key 없이 S3에 접근할 수 있습니다.
prerequisites:
  - AWS 계정 생성 완료
  - S3 버킷 생성 완료 (Step 5-1 참조)
  - Spring Boot 또는 Spring MVC 프로젝트 (로컬)
estimatedCost: 크레딧 내 사용 가능 (비용 매우 저렴)
---

이 실습에서는 Spring 애플리케이션에서 AWS SDK v2를 사용하여 S3에 파일을 업로드, 다운로드, 조회하는 기능을 구현합니다.  
먼저 **로컬 환경에서 개발·테스트**한 후, CloudFormation으로 EC2를 생성하고 **IAM Role을 직접 만들어 연결**하여 배포합니다.

**Spring Boot(새 프로젝트)** 또는 **기존 Spring MVC 프로젝트** 모두에서 동일한 AWS SDK를 사용하며, 의존성 추가와 설정 방법만 다릅니다.

### 실습 흐름

```
[태스크 0] S3 버킷 확인 + IAM 사용자에 S3 권한 추가 (로컬 개발용)
    ↓
[태스크 1] AWS CLI 설정 (로컬 자격 증명)
    ↓
[태스크 2] Spring 프로젝트에 AWS SDK 의존성 + 설정
    ↓
[태스크 3] S3 파일 업로드 서비스 구현
    ↓
[태스크 4] S3 파일 업로드 컨트롤러 구현
    ↓
[태스크 5] Presigned URL 생성 API 구현
    ↓
[태스크 6] 로컬 실행 + API 테스트
    ↓
[태스크 7] CloudFormation으로 EC2 생성 (UserData로 Java 등 설치)
    ↓
[태스크 8] IAM Policy + Role 수동 생성 → EC2에 연결
    ↓
[태스크 9] EC2 배포 + 테스트
    ↓
[리소스 정리] 모든 리소스 삭제
```

---

## 태스크 0: 선행 조건 확인

### S3 버킷 확인

1. AWS Management Console에 로그인합니다.
2. 우측 상단에서 리전을 **Asia Pacific (Seoul) ap-northeast-2**로 설정합니다.

    <img src="/images/common/region-check.png" alt="리전 확인" class="guide-img-sm" />

3. 상단 검색창에 `S3`를 입력하고 **S3** 서비스를 선택합니다.
4. 버킷 목록에서 사용할 버킷(예: `{닉네임}-starter-app`)이 존재하는지 확인합니다.

> [!TIP]
> S3 버킷 이름을 메모해 두세요. 이후 태스크에서 `application.yml` 설정과 IAM 정책에 사용됩니다.  
> 버킷 이름 예시: `{닉네임}-starter-app` (예: `hong-starter-app`, `mylab-starter-app`)

| 상황 | 진행 |
| ---- | ---- |
| 버킷이 이미 있음 (5-1에서 생성) | **"버킷 공개 설정"으로 이동** (아래) |
| 버킷이 없음 | **"버킷 생성"부터 진행** |

---

#### 버킷이 없는 경우: 버킷 생성

> [!NOTE]
> S3 버킷의 상세 개념(버전 관리, 수명 주기, 스토리지 클래스 등)을 학습하려면 [Step 5-1](/week/5/session/1)을 참고하세요.

5. [[Create bucket]]을 클릭합니다.
6. **General configuration** 섹션을 설정합니다:
    - **AWS Region**: `Asia Pacific (Seoul) ap-northeast-2` (콘솔 상단에서 설정한 리전이 자동 표시됨)
    - **Bucket namespace**: `Global namespace` 선택
      - `Account Regional namespace (recommended)`도 있지만, 이 실습에서는 이름이 짧고 직관적인 Global namespace를 사용합니다.
    - **Bucket name**: `{닉네임}-starter-app` (예: `hong-starter-app`, `mylab-starter-app`)
      - 전 세계에서 고유한 이름이어야 합니다. 본인의 닉네임이나 별칭을 포함하면 중복을 피할 수 있습니다.

7. **Object Ownership** 섹션:
    - **ACLs disabled (recommended)** 선택 (기본값)

8. **Block Public Access settings for this bucket** 섹션:
    - ❌ **Block all public access** 체크를 **해제**합니다.
    - 경고 문구가 나타나면 **I acknowledge that the current settings might result in this bucket and the objects within becoming public.** 체크박스를 선택합니다.

> [!WARNING]
> **Block Public Access를 해제합니다.**  
> 이 실습에서는 업로드한 이미지를 웹에서 URL로 직접 확인할 수 있도록 공개 폴더를 사용합니다.  
> 해제 후 **버킷 정책으로 특정 폴더(`public/`)만 공개**하여 보안을 유지합니다.

9. **Bucket Versioning** 섹션:
    - **Disable** 선택

10. **Tags** 섹션에서 [[Add new tag]]를 클릭하여 다음 태그를 추가합니다:

    | Key | Value |
    | --- | ----- |
    | `CreatedBy` | `admin-user` |
    | `Step` | `step5` |
    | `Session` | `5-2` |

11. **Default encryption** 섹션:
    - **Encryption type**: `Server-side encryption with Amazon S3 managed keys (SSE-S3)`
    - **Bucket Key**: `Enable` (기본값)

12. [[Create bucket]]을 클릭합니다.

> [!OUTPUT]
> "Successfully created bucket" 메시지가 표시되면 정상입니다.

> [!TROUBLESHOOTING]
> | 에러 | 원인 | 해결 |
> | ---- | ---- | ---- |
> | `Bucket name already exists` | 전 세계에서 이미 사용 중 | 이름에 날짜나 랜덤 문자 추가 (예: `hong-starter-app-0614`) |
> | `Bucket name is not valid` | 대문자, 특수문자 사용 | 소문자, 숫자, 하이픈만 사용 (3~63자) |

---

### 버킷 공개 설정 (공통 — 신규/기존 모두 수행)

> [!NOTE]
> **5-1에서 버킷을 생성한 경우** `Block all public access`가 활성화되어 있습니다.  
> 이 실습에서는 `public/` 폴더의 이미지를 웹에서 직접 확인해야 하므로 아래 설정을 수행합니다.  
> (위에서 버킷을 새로 생성한 경우에는 이미 해제되어 있으므로 **Block Public Access 해제는 건너뛰고** 버킷 정책만 설정합니다.)

#### Block Public Access 해제 (5-1에서 생성한 버킷만)

13. 버킷 목록에서 본인 버킷을 클릭합니다.
14. **Permissions** 탭을 선택합니다.
15. **Block public access (bucket settings)** 섹션에서 [[Edit]]을 클릭합니다.
16. **Block all public access** 체크를 **해제**합니다.
17. [[Save changes]]를 클릭합니다.
18. 확인 필드에 `confirm`을 입력하고 [[Confirm]]을 클릭합니다.

#### 버킷 정책 설정 (폴더별 접근 제어)

하나의 버킷 안에서 **폴더(prefix)별로 접근 수준을 다르게** 설정합니다:

| 폴더 (prefix) | 용도 | 접근 방식 | 예시 |
| -------------- | ---- | --------- | ---- |
| `public/` | 웹에서 보여줄 이미지 | 누구나 URL로 직접 접근 | 프로필 사진, 상품 이미지 |
| `private/` | 인증된 사용자용 | Presigned URL로만 접근 | 주문서, 개인 문서 |
| `archive/` | 내부 백업/저장 | 앱 서버(IAM Role)만 접근 | DB 백업, 로그 파일 |

> [!CONCEPT] 버킷 정책으로 폴더별 공개 설정
> S3에는 실제 "폴더"가 없지만, 키의 prefix를 기준으로 정책을 적용할 수 있습니다.  
> `public/*`에만 공개 읽기를 허용하면 나머지 경로는 비공개로 유지됩니다.
>
> ```
> s3://{버킷}/public/profile/photo.jpg  → 누구나 접근 가능 (웹 브라우저에서 URL로)
> s3://{버킷}/private/docs/invoice.pdf  → Presigned URL 필요 (앱에서 발급)
> s3://{버킷}/archive/backup/dump.sql   → IAM Role만 접근 가능
> ```

19. **Permissions** 탭 → **Bucket policy** 섹션에서 [[Edit]]을 클릭합니다.
20. 다음 JSON을 붙여넣습니다 (**버킷 이름을 본인 것으로 변경**):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadForPublicFolder",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::{닉네임}-starter-app/public/*"
    }
  ]
}
```

> [!WARNING]
> `Resource`의 버킷 이름을 **본인의 실제 버킷 이름**으로 변경하세요.  
> `public/*`만 허용하므로 `private/`, `archive/` 등 다른 경로는 비공개입니다.

21. [[Save changes]]를 클릭합니다.

> [!OUTPUT]
> 정책이 저장되면 Bucket policy 섹션에 JSON이 표시됩니다.  
> 버킷 목록에서 "Publicly accessible" 경고 배지가 표시될 수 있으나, 실제로는 `public/` 폴더만 공개됩니다.

> [!TIP]
> **S3에서는 폴더를 미리 만들 필요가 없습니다.**  
> 업로드할 때 key에 경로를 포함하면(예: `public/images/photo.png`) 자동으로 폴더 구조가 생깁니다.  
> 콘솔에서 구조를 시각적으로 확인하고 싶다면, 버킷 상세 → [[Create folder]]로 `public/`, `private/`, `archive/`를 미리 만들어도 됩니다.  
> 하지만 코드에서 업로드하면 알아서 생성되므로 필수가 아닙니다.

> [!TIP]
> **이후 코드에서 업로드할 때 directory 파라미터로 접근 수준을 결정합니다:**
>
> ```bash
> # 공개 이미지 (URL로 직접 접근 가능)
> curl -X POST .../upload -F "file=@photo.png" -F "directory=public/images"
>
> # 비공개 문서 (Presigned URL 필요)
> curl -X POST .../upload -F "file=@invoice.pdf" -F "directory=private/docs"
>
> # 내부 백업 (서버만 접근)
> curl -X POST .../upload -F "file=@dump.sql" -F "directory=archive/backup"
> ```
>
> 공개 이미지의 URL 형식: `https://{버킷}.s3.ap-northeast-2.amazonaws.com/public/images/{uuid}.png`  
> 이 URL을 `<img src="...">`에 바로 사용할 수 있습니다.

---

✅ **태스크 완료**: S3 버킷과 공개 설정이 준비되었습니다.

---

## 태스크 1: 로컬 개발용 IAM 사용자 + Access Key 설정

Spring SDK가 로컬에서 S3에 접근하려면 **자격 증명(Access Key)**이 필요합니다.  
admin 사용자의 키를 사용하는 대신, **S3 전용 사용자를 만들어 최소 권한만 부여**합니다.

> [!CONCEPT] Spring SDK는 자격 증명을 어떻게 찾는가?
> AWS SDK는 코드에 키를 명시하지 않아도 다음 순서로 자동 탐색합니다:
>
> - 환경변수 (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`)
> - Java 시스템 속성
> - **`~/.aws/credentials` 파일** ← 로컬에서는 여기서 획득
> - **EC2 IAM Role (Instance Metadata)** ← 배포 시에는 여기서 획득
>
> 즉 `~/.aws/credentials`에 키를 설정해두면 **코드 변경 없이** Spring 앱이 S3에 접근합니다.  
> EC2에 배포할 때는 IAM Role을 연결하면 키 자체가 불필요하고, 동일한 코드가 그대로 동작합니다.

> [!WARNING]
> **`application.properties`에 Access Key를 직접 넣지 마세요.**
>
> ```properties
> # ❌ 절대 하면 안 됨 — Git에 올라가면 키 유출
> cloud.aws.credentials.access-key=AKIA...
> cloud.aws.credentials.secret-key=wJalr...
> ```
>
> 블로그에서 이런 방식을 가이드하는 경우가 많지만, 실수로 Git에 push하면 수 분 내에 자동 스캐너에 의해 키가 탈취됩니다.  
> AWS는 유출된 키를 감지하면 계정에 경고를 보내지만, 이미 수백 달러의 비용이 발생할 수 있습니다.
>
> **❌ 비권장 방법:**
>
> | 방식 | 장점 | 단점 | 위험도 |
> | ---- | ---- | ---- | ------ |
> | application.properties에 하드코딩 | 가장 간단, 바로 동작 | Git push 시 키 유출, 스캐너가 수 분 내 탈취 | 🔴 매우 높음 |
> | application-local.properties + .gitignore | 프로젝트별 명시적 관리 | .gitignore 누락 시 유출, 파일이 프로젝트 내부에 남음 | 🟡 중간 |
> | 환경변수 직접 설정 | 코드/파일에 안 남음 | 터미널마다 재설정 필요, 팀원 간 공유 어려움 | 🟢 낮음 |
>
> **✅ 권장 방법:**
>
> | 환경 | 권장 방식 | 키가 저장되는 위치 | 장점 | 단점 |
> | ---- | --------- | ------------------ | ---- | ---- |
> | 로컬 개발 | ~/.aws/credentials | 프로젝트 외부 (홈 디렉토리) | Git에 올라갈 위험 없음, 여러 프로젝트 공유 | PC에 키 파일이 남아있음 |
> | EC2 배포 | IAM Role | 키 불필요 (자동 임시 자격 증명) | 키 유출 불가, 자동 로테이션, AWS 권장 | Role 설정 필요 |
> | CI/CD | GitHub Secrets → 환경변수 | Git에 평문으로 저장되지 않음 | 팀원 간 키 공유 불필요, 암호화 저장 | 로컬 디버깅 시 별도 설정 필요 |
>
> **이 실습에서는 `~/.aws/credentials` 방식을 사용합니다.**  
> 아래에서 S3 전용 IAM 사용자를 만들고, 해당 사용자의 Access Key를 credentials 파일에 등록합니다.

> [!TIP]
> **비권장 방법을 사용해야 하는 경우 (팀/레거시 프로젝트 등):**
>
> - ⚠️ application-local.properties를 사용한다면 **반드시** `.gitignore`에 추가하세요.
> - ⚠️ Git 커밋 전에 `git status`로 설정 파일이 포함되지 않았는지 확인하세요.
> - ⚠️ 실수로 push했다면: 즉시 AWS 콘솔에서 해당 Access Key를 **비활성화(Deactivate)** → **삭제(Delete)** 하세요.
>
> **로컬 개발이라도 최소 권한 원칙은 중요합니다.**  
> admin 사용자의 Access Key가 유출되면 계정 전체가 위험해집니다.  
> 아래에서 S3 전용 사용자를 별도로 만드는 이유가 바로 이것입니다 — 유출되더라도 피해가 특정 버킷에 한정됩니다.
>
> 🚨 **Root 계정의 Access Key는 절대 생성하지 마세요.**  
> Root 계정은 AWS 계정의 모든 권한을 가지며, IAM 정책으로도 제한할 수 없습니다.  
> Root 키가 유출되면 계정 삭제, 결제 정보 변경, 모든 리소스 파괴가 가능합니다.  
> Admin IAM 사용자 키도 마찬가지로 위험합니다 — 개발용으로는 반드시 **용도별 전용 사용자**를 만드세요.
>
> **팀 프로젝트에서의 실무 권장 방식:**
>
> | 단계 | 방법 | 설명 |
> | ---- | ---- | ---- |
> | 로컬 개발 | 개인별 IAM 사용자 + ~/.aws/credentials | 팀원마다 자기 키를 사용, 퇴사 시 해당 키만 삭제 |
> | 개발 서버 | IAM Role (EC2/ECS) | Access Key 공유 없이 서버에 권한 부여 |
> | CI/CD 배포 | GitHub Secrets / AWS Secrets Manager | 파이프라인에서 환경변수로 주입, 평문 저장 안 함 |
> | 프로덕션 | IAM Role + 서비스별 최소 권한 정책 | 버킷/작업 단위로 분리, 감사 로그(CloudTrail) 활용 |
>
> 팀에서 하나의 Access Key를 공유하는 것은 **안티패턴**입니다.  
> 누가 어떤 작업을 했는지 추적이 불가능하고, 한 명이 퇴사해도 키를 교체해야 전체 팀에 영향이 갑니다.  
> 팀원마다 개인 IAM 사용자를 만들고, 동일한 정책(그룹)을 연결하는 것이 표준입니다.

### S3 전용 IAM 사용자 생성

22. 상단 검색창에 `IAM`을 입력하고 **IAM** 서비스를 선택합니다.
23. 왼쪽 메뉴에서 **IAM Users**를 선택합니다.
24. [[Create user]]를 클릭합니다.
25. **User name**: `s3-dev-user`를 입력합니다.
26. **Provide user access to the AWS Management Console** 체크를 **하지 않습니다** (콘솔 접근 불필요).
27. [[Next]]를 클릭합니다.
28. **Attach policies directly**를 선택합니다.
29. [[Create policy]]를 클릭합니다 (새 탭에서 열림).

> [!NOTE]
> 이 사용자는 프로그래밍 전용(API 접근)이므로 콘솔 로그인 권한을 부여하지 않습니다.  
> Access Key로만 접근하는 "서비스 계정" 개념입니다.

### 최소 권한 정책 생성

30. (새 탭) **JSON** 탭을 클릭합니다.
31. 기존 내용을 삭제하고 다음을 붙여넣습니다:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowS3BucketAccess",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::{닉네임}-starter-app",
        "arn:aws:s3:::{닉네임}-starter-app/*"
      ]
    }
  ]
}
```

> [!WARNING]
> `Resource`의 버킷 이름을 **본인의 실제 버킷 이름**으로 변경하세요.

> [!NOTE]
> **ARN에 공백이 들어가지 않도록 주의하세요.**  
> 복사-붙여넣기 시 버킷 이름 앞뒤에 공백이 들어가면 정책이 동작하지 않습니다.  
> `"arn:aws:s3:::my-bucket "` ← 끝에 공백 하나만 있어도 `AccessDenied` 발생.  
> 붙여넣기 후 따옴표(`"`) 바로 안쪽에 불필요한 공백이 없는지 확인하세요.

> [!TIP]
> **편하게 하려면 `AmazonS3FullAccess` 관리형 정책을 사용해도 됩니다.**  
> 커스텀 정책을 만드는 대신 29번에서 `AmazonS3FullAccess`를 검색하여 연결하면 모든 S3 작업이 가능합니다.  
> 단, 이 경우 계정 내 **모든 버킷**에 대한 **모든 작업**이 허용되므로:
>
> - 키가 유출되면 모든 버킷 데이터가 위험해집니다.
> - 프로덕션에서는 반드시 커스텀 정책(특정 버킷만 허용)을 사용하세요.
> - 학습/개인 프로젝트에서는 편의상 사용해도 무방합니다.

32. [[Next]]를 클릭합니다.
33. **Policy name**: `S3AppBucketPolicy`를 입력합니다.
34. **Description**: `Allow PutObject, GetObject, DeleteObject, ListBucket on specific S3 bucket`를 입력합니다.
35. **Tags** 섹션에서 [[Add new tag]]를 클릭하여 다음 태그를 추가합니다:

    | Key | Value |
    | --- | ----- |
    | `CreatedBy` | `admin-user` |
    | `Step` | `step5` |
    | `Session` | `5-2` |

36. [[Create policy]]를 클릭합니다.
37. 사용자 생성 탭으로 돌아갑니다.

### 정책 연결 및 사용자 생성 완료

38. 정책 목록 상단의 🔄 새로고침 버튼을 클릭합니다.
39. 검색창에 `S3AppBucketPolicy`를 입력합니다.
40. `S3AppBucketPolicy` 체크박스를 선택합니다.
41. [[Next]]를 클릭합니다.
42. [[Create user]]를 클릭합니다.

> [!OUTPUT]
> "User created successfully" 메시지가 표시됩니다.

### Access Key 생성

43. 생성된 `s3-dev-user`를 클릭하여 상세 페이지로 이동합니다.
44. **Security credentials** 탭을 선택합니다.
45. **Access keys** 섹션에서 [[Create access key]]를 클릭합니다.
46. Use case에서 `Local code`를 선택합니다.
47. 하단 확인 체크박스를 선택하고 [[Next]]를 클릭합니다.
48. [[Create access key]]를 클릭합니다.
49. **Access key**와 **Secret access key**를 안전한 곳에 메모합니다.

> [!WARNING]
> Secret access key는 이 화면에서만 볼 수 있습니다. 페이지를 닫으면 다시 확인할 수 없으므로 반드시 메모하세요.  
> [[Download .csv file]]로 다운로드해 두는 것을 권장합니다.

### AWS CLI 설정 (`~/.aws/credentials`)

50. 터미널을 열고 AWS CLI가 설치되어 있는지 확인합니다:

```bash
aws --version
```

> [!NOTE]
> AWS CLI가 설치되어 있지 않은 경우:
> - **Mac**: `brew install awscli`
> - **Windows**: [AWS CLI 설치 페이지](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)에서 MSI 설치

51. 다음 명령어를 실행합니다:

```bash
aws configure --profile s3-dev
```

52. 프롬프트에 다음과 같이 입력합니다:

```
AWS Access Key ID [None]: (48번에서 메모한 Access Key)
AWS Secret Access Key [None]: (48번에서 메모한 Secret Key)
Default region name [None]: ap-northeast-2
Default output format [None]: json
```

> [!NOTE]
> `--profile s3-dev`로 설정하면 기존 default 프로파일과 분리됩니다.  
> `~/.aws/credentials` 파일에 `[s3-dev]` 섹션이 추가됩니다.  
> Spring SDK에서 사용하려면 환경변수 `AWS_PROFILE=s3-dev`를 설정하거나, default 프로파일로 설정해도 됩니다.

> [!TIP]
> 기존에 `aws configure`로 설정한 default 프로파일이 admin 사용자라면, 아래처럼 default로 설정해도 됩니다:
>
> ```bash
> aws configure
> # s3-dev-user의 Access Key/Secret Key 입력
> ```
>
> 이 경우 Spring SDK가 별도 설정 없이 바로 인식합니다.

53. 설정이 정상적으로 저장되었는지 확인합니다:

```bash
aws configure list --profile s3-dev
```

> [!OUTPUT]
> ```
>       Name                    Value             Type    Location
>       ----                    -----             ----    --------
>    profile                  s3-dev           manual    --profile
> access_key     ****************XXXX shared-credentials-file
> secret_key     ****************XXXX shared-credentials-file
>     region           ap-northeast-2      config-file    ~/.aws/config
> ```

> [!TIP]
> access_key와 secret_key에 값이 표시되고, region이 `ap-northeast-2`이면 정상입니다.  

54. 자격 증명이 유효한지 확인합니다:

```bash
aws sts get-caller-identity --profile s3-dev
```

> [!OUTPUT]
> ```json
> {
>   "UserId": "AIDA...",
>   "Account": "123456789012",
>   "Arn": "arn:aws:iam::123456789012:user/s3-dev-user"
> }
> ```

> [!TIP]
> Arn에 `s3-dev-user`가 표시되면 정상입니다.  
> 화면 하단에 `(END)` 표시가 나오면 `q`를 눌러 빠져나옵니다.

55. S3 접근을 테스트합니다:

```bash
aws s3 ls s3://{닉네임}-starter-app/ --profile s3-dev
```

> [!OUTPUT]
> 에러 없이 빈 결과 또는 파일 목록이 표시되면 성공입니다.  
> `AccessDenied` 에러가 발생하면 정책의 버킷 이름을 다시 확인하세요.

> [!TIP]
> **Spring 앱에서 프로파일을 인식하게 하려면:**
>
> IntelliJ Run Configuration → Environment variables에 `AWS_PROFILE=s3-dev` 추가  
> 또는 터미널에서 실행할 때:
>
> ```bash
> AWS_PROFILE=s3-dev ./gradlew bootRun
> ```
>
> default 프로파일을 s3-dev-user로 설정했다면 이 작업이 필요 없습니다.

> [!TIP]
> **컨테이너(ECS, EKS) 환경에서도 동일한 패턴:**
>
> | 환경 | 인증 방식 | Access Key 필요? |
> | ---- | --------- | ---------------- |
> | 로컬 개발 | `~/.aws/credentials` | ✅ (이 태스크에서 설정) |
> | EC2 | IAM Role (Instance Profile) | ❌ |
> | ECS (Fargate) | Task Role | ❌ |
> | EKS (Kubernetes) | IRSA (IAM Roles for Service Accounts) | ❌ |
>
> 코드는 변경 없이 동일합니다. SDK가 환경에 따라 자동으로 적절한 인증 방식을 선택합니다.

✅ **태스크 완료**: S3 전용 IAM 사용자(`s3-dev-user`)를 생성하고, 최소 권한 정책을 연결하고, 로컬 자격 증명을 설정했습니다.

------

## 태스크 2: Spring 프로젝트에 AWS SDK 의존성 추가

본인 프로젝트에 맞는 방법을 선택합니다.

---

### 방법 A: Spring Boot 프로젝트

> [!CONCEPT] AWS SDK v2 BOM (Bill of Materials)
> BOM을 사용하면 AWS SDK 모듈들의 버전을 일일이 지정하지 않아도 됩니다.  
> `bom:2.44.0`을 선언하면 `s3`, `sts` 등 모든 모듈이 동일한 호환 버전으로 자동 설정됩니다.

#### build.gradle 수정

56. 로컬 개발 환경에서 Spring Boot 프로젝트의 `build.gradle` 파일을 엽니다.
57. `dependencyManagement` 블록을 찾습니다 (없으면 `dependencies` 블록 위에 새로 추가합니다).

> [!TIP]
> `dependencyManagement`는 실제 의존성을 추가하는 게 아니라 **버전만 관리**하는 블록입니다.  
> 여기서 BOM을 선언하면 `dependencies`에서 버전 번호 없이 모듈명만 적어도 됩니다.  
> Spring Boot 프로젝트에는 보통 이미 있지만, 없으면 `dependencies { ... }` 바로 위에 새로 만들면 됩니다.
58. `dependencyManagement` 블록 안에 AWS SDK BOM을 추가합니다:

> [!TIP]
> **BOM (Bill of Materials)** 은 AWS SDK 모듈들의 버전을 일괄 관리합니다.  
> BOM 하나만 선언하면 `s3` 등 개별 모듈에 버전을 명시하지 않아도 호환되는 버전이 자동 적용됩니다.

```groovy
dependencyManagement {
    imports {
        mavenBom "software.amazon.awssdk:bom:2.44.0"
    }
}
```

> [!WARNING]
> **위 빌드에서 `Could not find software.amazon.awssdk:s3:.` 에러가 발생하면:**  
> `dependencyManagement` 블록이 동작하지 않는 것입니다.  
> 이 블록은 `io.spring.dependency-management` 플러그인이 필요한데, Spring Boot 4나 일부 프로젝트에서 누락될 수 있습니다.
>
> **해결 방법 1: 플러그인 추가**
>
> `build.gradle`의 `plugins` 블록에 다음을 추가합니다:
>
> ```groovy
> plugins {
>     id 'io.spring.dependency-management' version '1.1.7'
> }
> ```
>
> **해결 방법 2: `platform()` 방식으로 변경**
>
> `dependencyManagement` 블록을 삭제하고, `dependencies` 안에서 `platform()`으로 BOM을 가져옵니다:
>
> ```groovy
> dependencies {
>     implementation platform('software.amazon.awssdk:bom:2.44.0')
>     implementation 'software.amazon.awssdk:s3'
> }
> ```
>
> `platform()`은 Gradle 네이티브 BOM 방식으로, 별도 플러그인 없이 항상 동작합니다.

59. `dependencies` 블록에 다음 의존성을 추가합니다:

> [!TIP]
> **s3**: S3 업로드/다운로드/삭제 + Presigned URL 생성까지 모두 포함합니다.  
> SDK 2.44.0 이상에서는 `s3` 모듈 하나로 `S3Client`와 `S3Presigner` 모두 사용 가능합니다.

```groovy
dependencies {
    // AWS SDK v2 - S3 (업로드/다운로드/삭제 + Presigned URL 포함)
    implementation 'software.amazon.awssdk:s3'

    // Spring Boot Web (파일 업로드 API)
    implementation 'org.springframework.boot:spring-boot-starter-web'

    // Lombok (선택)
    compileOnly 'org.projectlombok:lombok'
    annotationProcessor 'org.projectlombok:lombok'
}
```

60. 파일을 저장하고 IntelliJ 우측 **Gradle** 패널에서 🔄 **Reload All Gradle Projects**를 클릭합니다.
61. 의존성이 정상적으로 추가되었는지 빌드를 실행하여 확인합니다:

```bash
./gradlew classes
```

> [!OUTPUT]
> ```
> BUILD SUCCESSFUL
> ```
>
> 에러 없이 완료되면 의존성 설정이 정상입니다. 다음 단계로 이동하세요.

> [!TIP]
> **Spring Boot 4 사용 시 Java 21 이상이 필수입니다.**  
> Boot 4(Spring Framework 7)는 Java 21+에서만 동작합니다.  
> AWS SDK 의존성이 resolve 안 되면 프로젝트의 JDK 버전을 확인하세요.  
> (File → Project Structure → Project SDK → 21 이상 선택)
>
> **Gradle Reload 후에도 import가 빨간색인 경우:**
> - File → **Invalidate Caches** → Invalidate and Restart
> - 또는 IntelliJ를 완전히 종료 후 재시작
> - 프로젝트 루트의 `.gradle/`, `.idea/` 폴더 삭제 후 다시 열기 (최후 수단)

> [!NOTE]
> Maven 프로젝트를 사용하는 경우 `pom.xml`에 다음을 추가합니다:
>
> ```xml
> <dependencyManagement>
>     <dependencies>
>         <dependency>
>             <groupId>software.amazon.awssdk</groupId>
>             <artifactId>bom</artifactId>
>             <version>2.44.0</version>
>             <type>pom</type>
>             <scope>import</scope>
>         </dependency>
>     </dependencies>
> </dependencyManagement>
>
> <dependencies>
>     <dependency>
>         <groupId>software.amazon.awssdk</groupId>
>         <artifactId>s3</artifactId>
>     </dependency>
> </dependencies>
> ```

#### application.yml 설정

62. `src/main/resources/application.yml` 파일을 엽니다.

> [!TIP]
> `application.yml` 대신 `application.properties`를 사용하는 프로젝트라면 같은 내용을 properties 형식으로 추가합니다:
>
> ```properties
> cloud.aws.region=ap-northeast-2
> cloud.aws.s3.bucket={닉네임}-starter-app
> spring.servlet.multipart.max-file-size=10MB
> spring.servlet.multipart.max-request-size=10MB
> ```

63. 다음 설정을 추가합니다:

```yaml
cloud:
  aws:
    region: ap-northeast-2
    s3:
      bucket: {닉네임}-starter-app

spring:
  servlet:
    multipart:
      max-file-size: 10MB
      max-request-size: 10MB
```

> [!WARNING]
> `bucket` 값을 **본인의 실제 S3 버킷 이름**으로 변경하세요.  
> 버킷 이름이 틀리면 런타임에 `NoSuchBucket` 에러가 발생합니다.

> [!NOTE]
> EC2에서 IAM Role을 사용하면 `access-key`, `secret-key` 설정이 **필요 없습니다**.  
> SDK가 자동으로 자격 증명을 찾는 순서:  
> ① 환경 변수 → ② `~/.aws/credentials` (로컬) → ③ EC2 IAM Role (배포 시)

방법 A를 완료했다면 **S3Config 클래스 작성**으로 이동하세요.

---

### 방법 B: 기존 Spring MVC 프로젝트 (Boot가 아닌 경우)

**build.gradle에 의존성 추가:**

```groovy
dependencies {
    // 기존 의존성들...

    // AWS SDK v2 - S3
    implementation platform('software.amazon.awssdk:bom:2.44.0')
    implementation 'software.amazon.awssdk:s3'
}
```

**application.properties에 S3 설정 추가:**

```properties
cloud.aws.region=ap-northeast-2
cloud.aws.s3.bucket={닉네임}-starter-app
```

> [!WARNING]
> `bucket` 값을 **본인의 실제 S3 버킷 이름**으로 변경하세요.

---

### S3Config 클래스 작성 (공통)

64. `src/main/java/com/example/demo/config/` 디렉토리를 우클릭합니다.

> [!TIP]
> 패키지 경로는 본인 프로젝트에 맞게 변경하세요.  
> 예: `com.example.demo.config`, `org.scoula.config`, `com.myapp.config` 등  
> 중요한 건 `@Configuration` 클래스가 컴포넌트 스캔 범위 안에 있으면 됩니다.
65. **New** → **Java Class**를 선택합니다.
66. 클래스 이름에 `S3Config`를 입력하고 `Enter`를 누릅니다.
67. 다음 코드를 붙여넣습니다:

> [!WARNING]
> 코드 첫 줄의 `package com.example.demo.config;`를 **본인 프로젝트의 실제 패키지 경로**로 변경하세요.  
> 패키지 선언이 파일의 실제 위치와 다르면 컴파일 에러가 발생합니다.  
> IntelliJ에서 파일을 생성하면 패키지가 자동으로 입력되므로, 그 줄은 유지하고 나머지 코드만 붙여넣어도 됩니다.

```java
package com.example.demo.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

@Configuration // Spring이 이 클래스를 설정 파일로 인식하여 Bean을 등록합니다
public class S3Config {

    @Value("${cloud.aws.region}") // application.yml의 cloud.aws.region 값을 주입
    private String region;

    @Bean // S3 업로드/다운로드/삭제 등 기본 작업에 사용하는 클라이언트
    public S3Client s3Client() {
        return S3Client.builder()
                .region(Region.of(region)) // 서울 리전 지정
                .build(); // credentialsProvider 미지정 → 자동 탐색 (Credential Chain)
    }

    @Bean // Presigned URL 생성 전용 클라이언트
    public S3Presigner s3Presigner() {
        return S3Presigner.builder()
                .region(Region.of(region))
                .build();
    }
}
```

68. 파일을 저장합니다.

> [!CONCEPT] AWS SDK의 자격 증명 체인 (Default Credential Provider Chain)
> `credentialsProvider`를 명시하지 않으면 SDK는 다음 순서로 자격 증명을 탐색합니다:
>
> - 환경 변수 (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`)
> - Java 시스템 속성 (`aws.accessKeyId`, `aws.secretAccessKey`)
> - `~/.aws/credentials` 파일 (AWS CLI 설정) ← **로컬에서는 여기서 획득**
> - **EC2 Instance Metadata (IAM Role)** ← **EC2에서는 여기서 자동 획득**
> - ECS Container Credentials
>
> 이 방식을 사용하면 **코드 변경 없이** 로컬(credentials 파일)과 EC2(IAM Role) 모두에서 동작합니다.

> [!NOTE]
> **기존 MVC 프로젝트에서의 패키지 위치:**
>
> - Boot 프로젝트: `com.example.demo.config.S3Config`
> - 기존 MVC 프로젝트: `org.scoula.config.S3Config` (또는 본인 프로젝트의 config 패키지)
>
> 기존 MVC 프로젝트에서 `@Value`가 동작하려면 `RootConfig`에 `@PropertySource("classpath:application.properties")`가 필요합니다.

> [!WARNING]
> **기존 MVC 프로젝트**: `RootConfig`의 `@ComponentScan`에 S3 관련 패키지를 추가해야 합니다.  
> `S3Config`, `S3Service` 등이 위치한 패키지가 스캔 대상에 포함되지 않으면 Bean 생성이 안 되어 배포 시 에러가 발생합니다.
>
> ```java
> // RootConfig.java — @ComponentScan에 본인이 S3Config, S3Service를 넣은 패키지를 추가
> @ComponentScan(basePackages = {
>     "org.scoula.board.service",
>     "org.scoula.member.service",
>     "org.scoula.travel.service",
>     "org.scoula.config",   // ← S3Config가 있는 패키지 추가
>     "org.scoula.util"      // ← S3Service, PresignedUrlService가 있는 패키지 추가
> })
> ```
>
> 패키지 경로는 본인 프로젝트 구조에 맞게 변경하세요.  
> 핵심은 `S3Config`와 `S3Service`가 있는 패키지가 `@ComponentScan` 대상에 들어가야 한다는 것입니다.

✅ **태스크 완료**: AWS SDK v2 의존성과 S3Client Bean 설정이 완료되었습니다.

---

## 태스크 3: S3 파일 업로드 서비스 구현

> [!CONCEPT] MultipartFile 업로드 흐름
> ```
> [클라이언트] --multipart/form-data--> [Controller] --MultipartFile--> [S3Service] --PutObject--> [S3]
> ```

### S3Service 클래스 작성

69. `src/main/java/com/example/demo/service/` 디렉토리를 우클릭합니다.

> [!TIP]
> 경로는 본인 프로젝트에 맞게 변경하세요 (예: `org.scoula.service`).

70. **New** → **Java Class** → `S3Service`를 입력합니다.
71. 다음 코드를 붙여넣습니다:

> [!WARNING]
> 첫 줄의 `package` 선언을 본인 프로젝트의 패키지로 변경하세요. IntelliJ에서 클래스 생성 시 자동 입력된 패키지를 유지하고, 나머지 코드만 붙여넣으면 됩니다.

```java
package com.example.demo.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.*;

import java.io.IOException;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j       // 로그 출력용 (log.info, log.error 사용 가능)
@Service     // Spring이 이 클래스를 서비스 Bean으로 등록
@RequiredArgsConstructor // final 필드를 자동으로 생성자 주입
public class S3Service {

    // S3Config에서 등록한 S3Client Bean이 자동 주입됩니다
    private final S3Client s3Client;

    // application.yml(또는 .properties)에서 버킷 이름을 읽어옵니다
    @Value("${cloud.aws.s3.bucket}")
    private String bucket;

    @Value("${cloud.aws.region}")
    private String region;

    /**
     * MultipartFile을 S3에 업로드합니다.
     *
     * @param file      업로드할 파일 (컨트롤러에서 받은 MultipartFile)
     * @param directory S3 내 저장 경로 (예: "public/board", "private/docs")
     * @return 업로드된 객체의 S3 key (예: "public/board/uuid.jpg")
     */
    public String upload(MultipartFile file, String directory) {
        // 원본 파일명에서 확장자 추출 (예: .jpg, .png)
        String originalFilename = file.getOriginalFilename();
        String extension = extractExtension(originalFilename);

        // UUID로 고유한 파일명 생성 → 파일명 충돌 방지 + 보안
        // 결과 예: "public/board/550e8400-e29b-41d4-a716-446655440000.jpg"
        String key = directory + "/" + UUID.randomUUID() + extension;

        try {
            // S3에 보낼 요청 객체 생성 (어디에, 어떤 타입으로, 얼마나 큰 파일을 저장할지)
            PutObjectRequest request = PutObjectRequest.builder()
                    .bucket(bucket)                    // 저장할 버킷 이름
                    .key(key)                          // 버킷 내 경로 (파일의 주소)
                    .contentType(file.getContentType()) // MIME 타입 (image/jpeg 등)
                    .contentLength(file.getSize())      // 파일 크기 (바이트)
                    .build();

            // 실제 S3로 파일 데이터를 전송합니다
            // fromInputStream: 파일을 스트림으로 읽어서 S3로 보냄
            s3Client.putObject(request,
                    RequestBody.fromInputStream(
                        file.getInputStream(), file.getSize()));

            log.info("파일 업로드 성공: {}", key);
            return key; // 저장된 S3 key를 반환 (DB에 저장할 값)

        } catch (IOException e) {
            throw new RuntimeException(
                "파일 업로드 실패: " + originalFilename, e);
        }
    }

    /**
     * 특정 경로(prefix) 아래의 파일 목록을 조회합니다.
     * 예: prefix="public/board/" → 게시판에 업로드된 모든 파일의 key 반환
     */
    public List<String> listFiles(String prefix) {
        ListObjectsV2Request request = ListObjectsV2Request.builder()
                .bucket(bucket)
                .prefix(prefix) // 이 경로로 시작하는 객체만 조회
                .build();

        ListObjectsV2Response response = s3Client.listObjectsV2(request);

        // 응답에서 각 객체의 key만 추출하여 리스트로 반환
        return response.contents().stream()
                .map(S3Object::key)
                .collect(Collectors.toList());
    }

    /**
     * S3에서 파일을 다운로드합니다.
     * 반환값은 InputStream이므로 컨트롤러에서 응답으로 내려보낼 수 있습니다.
     */
    public ResponseInputStream<GetObjectResponse> download(String key) {
        GetObjectRequest request = GetObjectRequest.builder()
                .bucket(bucket)
                .key(key)
                .build();

        return s3Client.getObject(request);
    }

    /**
     * S3에서 파일을 삭제합니다.
     * 게시글 삭제 시 첨부파일도 함께 삭제할 때 사용합니다.
     */
    public void delete(String key) {
        DeleteObjectRequest request = DeleteObjectRequest.builder()
                .bucket(bucket)
                .key(key)
                .build();

        s3Client.deleteObject(request);
        log.info("파일 삭제 성공: {}", key);
    }

    /**
     * S3 key로부터 브라우저에서 접근 가능한 전체 URL을 생성합니다.
     * public/ 경로의 파일은 이 URL로 바로 접근할 수 있습니다.
     * 예: "https://my-bucket.s3.ap-northeast-2.amazonaws.com/public/board/uuid.jpg"
     */
    public String getFileUrl(String key) {
        return String.format(
            "https://%s.s3.%s.amazonaws.com/%s",
            bucket, region, key);
    }

    /**
     * 파일명에서 확장자를 추출하는 유틸 메서드
     * "photo.jpg" → ".jpg", "document" → ""
     */
    private String extractExtension(String filename) {
        if (filename == null || !filename.contains(".")) {
            return "";
        }
        return filename.substring(filename.lastIndexOf("."));
    }
}
```

72. 파일을 저장합니다.

> [!CONCEPT] UUID 파일명을 사용하는 이유
> - **파일명 충돌 방지**: 여러 사용자가 `photo.png`를 업로드해도 겹치지 않음
> - **보안**: 원본 파일명에 포함된 개인정보 노출 방지
> - **URL 안전**: 한글, 공백, 특수문자로 인한 인코딩 문제 방지

✅ **태스크 완료**: S3 파일 업로드/다운로드/목록/삭제 서비스가 구현되었습니다.

> [!TIP]
> **기존 Spring MVC 프로젝트 (게시판 등)에 적용하는 방법:**
>
> 기존 프로젝트에서 파일을 로컬 디스크에 저장하고 있다면 (예: `UploadFiles.upload(BASE_DIR, part)`),  
> S3Service를 주입하여 저장 위치만 교체하면 됩니다. S3Service 코드 자체는 Boot와 동일합니다.
>
> **S3Service 배치 위치: `org.scoula.util.S3Service`**  `UploadFiles`와 같은 패키지에 배치합니다.   
> board, travel 등 여러 도메인에서 공통으로 사용하는 파일 업로드 유틸이기 때문입니다.
>
> **변경 전 (로컬 디스크):**
>
> ```java
> // BoardServiceImpl.java
> private void upload(Long bno, List<MultipartFile> files) {
>     for (MultipartFile part : files) {
>         // UploadFiles.upload()는 로컬 디스크(c:/upload/board)에 파일을 저장하고
>         // 저장된 파일의 로컬 경로를 반환합니다
>         String uploadPath = UploadFiles.upload(BASE_DIR, part);
>
>         // DB에 로컬 파일 경로를 저장
>         BoardAttachmentVO attach = BoardAttachmentVO.of(part, bno, uploadPath);
>         mapper.createAttachment(attach);
>     }
> }
> ```
>
> **변경 후 (S3):**
>
> ```java
> // BoardServiceImpl.java
>
> // S3Service를 주입받습니다 (@RequiredArgsConstructor + final)
> private final S3Service s3Service;
>
> private void upload(Long bno, List<MultipartFile> files) {
>     for (MultipartFile part : files) {
>         // s3Service.upload()는 S3 버킷에 파일을 업로드하고
>         // S3 key(경로)를 반환합니다 (예: "public/board/uuid.jpg")
>         String key = s3Service.upload(part, "public/board");
>
>         // DB에 S3 key를 저장 (로컬 경로 대신)
>         // 이 key로 S3 URL을 조합하면 이미지 접근 가능:
>         // https://{버킷}.s3.ap-northeast-2.amazonaws.com/public/board/uuid.jpg
>         BoardAttachmentVO attach = BoardAttachmentVO.of(part, bno, key);
>         mapper.createAttachment(attach);
>     }
> }
> ```
>
> **다운로드(이미지 표시) 방식 변경:**
>
> ```java
> // 변경 전: 서버가 로컬 파일을 읽어서 응답으로 전송
> File file = new File(attachment.getPath());
> UploadFiles.download(response, file, attachment.getFilename());
>
> // 변경 후: S3 URL을 직접 반환 (public/ 경로라면 URL로 바로 접근 가능)
> String url = s3Service.getFileUrl(attachment.getPath());
> // 프론트엔드에서 <img src="{url}" />로 직접 표시
> ```
>
> **핵심 포인트:**
> - `S3Service`는 `org.scoula.util` 패키지에 배치 (board, travel 등 공통 사용)
> - `BoardAttachmentVO.path`에 로컬 경로 대신 S3 key 저장
> - public/ 경로 파일은 URL로 직접 접근 가능 → 서버가 파일을 중계할 필요 없음
> - `S3Config`, `S3Service` 코드는 Boot와 **완전히 동일** (패키지만 다름)

---

## 태스크 4: S3 파일 업로드 컨트롤러 구현

### S3Controller 작성

73. `src/main/java/com/example/demo/controller/` 디렉토리를 우클릭합니다.

> [!TIP]
> 경로는 본인 프로젝트에 맞게 변경하세요 (예: `org.scoula.controller`).

74. **New** → **Java Class** → `S3Controller`를 입력합니다.
75. 다음 코드를 붙여넣습니다:

> [!WARNING]
> 첫 줄의 `package` 선언을 본인 프로젝트의 패키지로 변경하세요.

```java
package com.example.demo.controller;

import com.example.demo.service.S3Service;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;

import java.util.List;
import java.util.Map;

@RestController          // JSON 응답을 반환하는 REST 컨트롤러
@RequestMapping("/api/files") // 모든 엔드포인트의 기본 경로
@RequiredArgsConstructor // final 필드 자동 생성자 주입
public class S3Controller {

    private final S3Service s3Service; // S3Service Bean 자동 주입

    /**
     * 파일 업로드 (서버 경유 방식)
     * 클라이언트가 보낸 파일을 서버가 받아서 S3로 전달합니다.
     *
     * 요청 예시: POST /api/files/upload?directory=public/board
     * Body: form-data에 file 필드로 파일 첨부
     */
    @PostMapping("/upload")
    public ResponseEntity<Map<String, String>> upload(
            @RequestParam("file") MultipartFile file,           // 업로드된 파일
            @RequestParam(defaultValue = "uploads") String directory) { // 저장 경로 (생략 시 "uploads")

        String key = s3Service.upload(file, directory); // S3에 업로드, key 반환
        String url = s3Service.getFileUrl(key);         // 접근 가능한 URL 생성

        // key와 url을 JSON으로 응답 (프론트엔드에서 이미지 표시에 사용)
        return ResponseEntity.ok(Map.of(
                "key", key,
                "url", url
        ));
    }

    /**
     * 파일 목록 조회
     * 특정 경로(prefix) 아래의 모든 파일 key를 반환합니다.
     *
     * 요청 예시: GET /api/files?prefix=public/board/
     */
    @GetMapping
    public ResponseEntity<List<String>> list(
            @RequestParam(defaultValue = "") String prefix) { // prefix 생략 시 전체 조회
        List<String> files = s3Service.listFiles(prefix);
        return ResponseEntity.ok(files);
    }

    /**
     * 파일 다운로드
     * S3에서 파일을 읽어 브라우저로 전송합니다 (private/ 경로 파일용).
     *
     * 요청 예시: GET /api/files/download?key=private/docs/uuid.pdf
     */
    @GetMapping("/download")
    public ResponseEntity<InputStreamResource> download(
            @RequestParam String key) {
        // S3에서 파일 스트림 + 메타데이터 조회
        ResponseInputStream<GetObjectResponse> s3Object =
            s3Service.download(key);
        GetObjectResponse metadata = s3Object.response();

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(
                    metadata.contentType()))              // 원본 Content-Type 유지
                .contentLength(metadata.contentLength())  // 파일 크기
                .header(HttpHeaders.CONTENT_DISPOSITION,
                    "attachment; filename=\"" +
                    key.substring(key.lastIndexOf("/") + 1) + "\"") // 다운로드 파일명
                .body(new InputStreamResource(s3Object)); // 파일 스트림 응답
    }

    /**
     * 파일 삭제
     * S3에서 지정한 key의 파일을 삭제합니다.
     *
     * 요청 예시: DELETE /api/files?key=public/board/uuid.jpg
     */
    @DeleteMapping
    public ResponseEntity<Void> delete(@RequestParam String key) {
        s3Service.delete(key);
        return ResponseEntity.noContent().build(); // 204 No Content 응답
    }
}
```

76. 파일을 저장합니다.

✅ **태스크 완료**: 파일 업로드, 목록 조회, 다운로드, 삭제 API가 구현되었습니다.

---

## 태스크 5: Presigned URL 생성 API 구현

> [!CONCEPT] Presigned URL이란?
> Presigned URL은 **임시 서명이 포함된 S3 접근 URL**입니다.  
> 이 URL을 가진 사람은 AWS 자격 증명 없이도 지정된 시간 동안 S3 객체에 접근할 수 있습니다.
>
> **왜 필요한가?**
>
> 태스크 4에서 구현한 서버 경유 방식은 모든 파일 데이터가 서버를 거칩니다.  
> 10MB 이미지 100장을 동시에 업로드하면 서버 메모리에 1GB가 올라갑니다.  
> Presigned URL 방식은 서버가 "이 URL로 업로드해" 라고 주소만 알려주고,  
> 실제 파일은 클라이언트가 S3로 직접 보내므로 서버 부하가 없습니다.
>
> ```
> [서버 경유 방식 — 태스크 4]
> 클라이언트 → 파일 데이터 → 서버(Spring) → 파일 데이터 → S3
>                            서버 메모리 사용 ↑
>
> [Presigned URL 방식 — 이 태스크]
> 클라이언트 → "URL 주세요" → 서버(Spring) → URL만 반환 (수 바이트)
> 클라이언트 → 파일 데이터 ────────────────────────→ S3 (직접 업로드)
>                            서버 부하 없음 ↑
> ```
>
> | 비교 항목   | 서버 경유 (태스크 4)       | Presigned URL (이 태스크) |
> | ----------- | ------------------------- | ----------------------- |
> | 서버 부하   | 높음 (파일 중계)          | 낮음 (URL만 발급)       |
> | 대용량 파일 | 서버 메모리 부족 위험     | 문제 없음               |
> | 파일 검증   | 서버에서 가능 (타입, 크기) | 별도 처리 필요          |
> | 구현 복잡도 | 단순                      | 약간 복잡               |
> | 적합한 경우 | 소용량, 서버 검증 필요 시 | 대용량, 이미지/동영상   |
>
> **실무에서는 두 방식을 함께 사용합니다:**
> - 프로필 사진 (1MB 이하): 서버 경유 → 리사이즈 후 저장
> - 동영상/대용량 파일: Presigned URL → 클라이언트 직접 업로드

### PresignedUrlService 클래스 작성

77. `src/main/java/com/example/demo/service/` → **New** → **Java Class** → `PresignedUrlService`

> [!TIP]
> 경로는 본인 프로젝트에 맞게 변경하세요.

78. 다음 코드를 붙여넣습니다:

> [!WARNING]
> 첫 줄의 `package` 선언을 본인 프로젝트의 패키지로 변경하세요.

```java
package com.example.demo.service;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;

import java.time.Duration;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PresignedUrlService {

    // S3Config에서 등록한 S3Presigner Bean (Presigned URL 생성 전용)
    private final S3Presigner s3Presigner;

    @Value("${cloud.aws.s3.bucket}")
    private String bucket;

    /**
     * 업로드용 Presigned URL을 생성합니다 (10분 유효).
     *
     * 클라이언트는 이 URL로 S3에 직접 PUT 요청을 보내 파일을 업로드합니다.
     * 서버를 경유하지 않으므로 대용량 파일 업로드에 적합합니다.
     *
     * @param directory   S3 저장 경로 (예: "public/board")
     * @param filename    원본 파일명 (key에 포함되어 참고용으로 사용)
     * @param contentType 파일의 MIME 타입 (클라이언트가 PUT 시 동일하게 보내야 함)
     * @return 서명된 업로드 URL
     */
    public String generateUploadUrl(String directory,
                                     String filename,
                                     String contentType) {
        // UUID + 원본 파일명으로 고유한 key 생성
        String key = directory + "/" + UUID.randomUUID() + "_" + filename;

        // "이 key에, 이 Content-Type으로 업로드를 허용하겠다"는 요청 정의
        PutObjectRequest objectRequest = PutObjectRequest.builder()
                .bucket(bucket)
                .key(key)
                .contentType(contentType) // 클라이언트가 보내는 Content-Type과 일치해야 함
                .build();

        // 서명 유효 시간 설정 (10분 후 만료)
        PutObjectPresignRequest presignRequest =
            PutObjectPresignRequest.builder()
                .signatureDuration(Duration.ofMinutes(10))
                .putObjectRequest(objectRequest)
                .build();

        // 서명된 URL 생성하여 반환
        return s3Presigner.presignPutObject(presignRequest)
                .url().toString();
    }

    /**
     * 다운로드용 Presigned URL을 생성합니다 (30분 유효).
     *
     * private/ 경로의 파일처럼 공개되지 않은 객체를 임시로 접근할 수 있게 합니다.
     * 이 URL을 브라우저에 넣으면 로그인 없이 파일을 다운로드할 수 있습니다.
     *
     * @param key 다운로드할 객체의 S3 key
     * @return 서명된 다운로드 URL
     */
    public String generateDownloadUrl(String key) {
        GetObjectRequest objectRequest = GetObjectRequest.builder()
                .bucket(bucket)
                .key(key)
                .build();

        GetObjectPresignRequest presignRequest =
            GetObjectPresignRequest.builder()
                .signatureDuration(Duration.ofMinutes(30)) // 30분 후 만료
                .getObjectRequest(objectRequest)
                .build();

        return s3Presigner.presignGetObject(presignRequest)
                .url().toString();
    }
}
```

79. 파일을 저장합니다.

### S3Controller에 Presigned URL 엔드포인트 추가

기존 S3Controller에 Presigned URL 발급 API를 추가합니다.  
클라이언트는 이 API로 URL을 받아서 S3에 직접 업로드/다운로드합니다.

80. `S3Controller.java`를 엽니다.
81. 클래스 상단 필드에 추가합니다:

```java
// PresignedUrlService도 주입받습니다 (final 추가만 하면 @RequiredArgsConstructor가 처리)
private final PresignedUrlService presignedUrlService;
```

82. 클래스 하단에 다음 엔드포인트를 추가합니다:

```java
/**
 * 업로드용 Presigned URL 발급
 * 
 * 프론트엔드 흐름:
 * 1. 이 API 호출 → uploadUrl 받음
 * 2. 받은 URL로 PUT 요청 (파일 데이터 직접 전송)
 * 3. S3에 직접 업로드 완료
 *
 * POST /api/files/presigned-upload
 * Body: { "directory": "public/board", "filename": "photo.png", "contentType": "image/png" }
 */
@PostMapping("/presigned-upload")
public ResponseEntity<Map<String, String>> getPresignedUploadUrl(
        @RequestBody Map<String, String> request) { // JSON Body로 받음

    String url = presignedUrlService.generateUploadUrl(
            request.get("directory"),    // 저장 경로
            request.get("filename"),     // 원본 파일명
            request.get("contentType")); // MIME 타입 (PUT 시 동일해야 함)

    return ResponseEntity.ok(Map.of("uploadUrl", url));
}

/**
 * 다운로드용 Presigned URL 발급
 *
 * private/ 경로의 비공개 파일을 임시로 접근할 수 있는 URL을 생성합니다.
 * URL은 30분 후 만료됩니다.
 *
 * GET /api/files/presigned-download?key=private/docs/uuid.pdf
 */
@GetMapping("/presigned-download")
public ResponseEntity<Map<String, String>> getPresignedDownloadUrl(
        @RequestParam String key) { // 다운로드할 객체의 S3 key

    String url = presignedUrlService.generateDownloadUrl(key);

    return ResponseEntity.ok(Map.of("downloadUrl", url));
}
```

83. 파일을 저장합니다.

✅ **태스크 완료**: Presigned URL 생성 API가 구현되었습니다.

---

## 태스크 6: 로컬 실행 + API 테스트

### 로컬에서 실행

84. IntelliJ에서 **Run Configuration**을 엽니다:
    - **Boot**: 상단 Run Configuration → **Edit Configurations...**
    - **MVC (Tomcat)**: 상단 Run Configuration 클릭
85. 환경변수를 추가합니다:
    - **Boot**: **Modify options** → **Environment variables** 체크 → `AWS_PROFILE=s3-dev` 입력 → [[OK]]
    - **MVC (Tomcat)**: **Startup/Connection** 탭 → **Environment variables** → `AWS_PROFILE=s3-dev` 추가

> [!NOTE]
> 태스크 1에서 `aws configure --profile s3-dev`로 설정했으므로, Spring 앱에도 어떤 프로파일을 사용할지 알려줘야 합니다.  
> 환경변수 `AWS_PROFILE=s3-dev`를 설정하면 SDK가 `~/.aws/credentials`에서 `[s3-dev]` 섹션을 읽습니다.  
> 터미널에서 실행하는 경우: `AWS_PROFILE=s3-dev ./gradlew bootRun`

86. 앱을 실행합니다 (Boot: 메인 클래스 Run / MVC: ▶️ Run 버튼).
87. 앱이 정상 시작되었는지 확인합니다.

> [!OUTPUT]
> ```
> Started DemoApplication in 3.234 seconds
> ```
> 또는 Tomcat 로그에 배포 완료 메시지가 표시됩니다.

> [!TIP]
> `aws configure`를 `--profile` 없이 실행하여 default 프로파일로 설정했다면 환경변수 없이도 동작합니다.  
> 하지만 용도별 프로파일 분리가 보안상 권장됩니다.

> [!TIP]
> **MVC 프로젝트의 API 경로:**  
> Boot는 `http://localhost:8080/api/files/upload`이지만,  
> MVC + Tomcat은 context path가 포함될 수 있습니다: `http://localhost:8080/{context}/api/files/upload`  
> context path는 보통 WAR 파일명 또는 Tomcat 설정에 따라 다릅니다.  
> ROOT.war로 배포했다면 context path 없이 동일합니다.

> [!WARNING]
> `Unable to load credentials` 에러가 발생하면 태스크 1의 `aws configure` 설정을 확인하세요.  
> `NoSuchBucket` 에러가 발생하면 `application.yml`(또는 `.properties`)의 버킷 이름을 확인하세요.  
> MVC 프로젝트에서 `@Value`가 안 읽히면 `RootConfig`에 `@PropertySource("classpath:application.properties")`가 있는지 확인하세요.

---

### API 테스트

> [!WARNING]
> **Mac/Linux와 Windows에서 curl 명령어가 다릅니다.**
>
> | 차이점 | Mac/Linux (터미널) | Windows (PowerShell) |
> | ------ | ------------------ | -------------------- |
> | 줄 바꿈 | `\` | `` ` `` (백틱) |
> | JSON 데이터 | 작은따옴표: `'{"key":"value"}'` | 큰따옴표 이스케이프: `"{\"key\":\"value\"}"` |
> | 임시 파일 경로 | `/tmp/test.txt` | `$env:TEMP\test.txt` |
>
> 아래 명령어는 **Mac/Linux** 기준입니다. Windows 사용자는 각 명령어 아래의 **Windows** 탭을 참고하세요.

86. 새 터미널을 열고 테스트 파일을 생성합니다:

> [!TIP]
> **curl 명령어를 터미널에서 직접 타이핑하기 어려우면, VS Code나 메모장에서 조립하세요.**
>
> 1. VS Code, 메모장, IntelliJ 등 아무 텍스트 에디터를 엽니다.
> 2. 아래 예시처럼 curl 명령어 틀을 먼저 적습니다.
> 3. API 응답에서 받은 URL이나 key를 복사해서 해당 위치에 붙여넣습니다.
> 4. 완성된 명령어를 통째로 복사 → 터미널에 붙여넣기 → Enter
>
> ```bash
> # 명령어 틀:
> curl -X PUT "여기에-presigned-URL-붙여넣기" -H "Content-Type: text/plain" --data-binary @/tmp/test.txt
> ```
>
> **실제 예시 — 텍스트를 직접 보내는 경우:**
> ```bash
> curl -X PUT "https://mylab-starter-app.s3.ap-northeast-2.amazonaws.com/test/348704c1_hello.txt?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Date=20260614T021637Z&X-Amz-SignedHeaders=content-type%3Bhost&X-Amz-Credential=AKIA...&X-Amz-Expires=600&X-Amz-Signature=4ef0fd..." -H "Content-Type: text/plain" --data-binary @/tmp/test.txt
> ```
>
> **실제 예시 — 이미지 파일을 업로드하는 경우:**
> ```bash
> curl -X PUT "https://mylab-starter-app.s3.ap-northeast-2.amazonaws.com/test/348704c1_photo.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Date=20260614T021637Z&X-Amz-SignedHeaders=content-type%3Bhost&X-Amz-Credential=AKIA...&X-Amz-Expires=600&X-Amz-Signature=4ef0fd..." -H "Content-Type: image/png" --data-binary @/Users/hong/Desktop/photo.png
> ```
>
> | 옵션 | 의미 |
> | ---- | ---- |
> | `-X PUT` | HTTP PUT 요청 (S3에 파일을 저장할 때 사용) |
> | `"URL"` | 앞서 발급받은 Presigned Upload URL 전체 (반드시 큰따옴표로 감쌈) |
> | `-H "Content-Type: text/plain"` | 업로드할 파일의 MIME 타입 (Presigned Upload URL 발급 요청의 `contentType`과 일치해야 함) |
> | `--data-binary @/tmp/test.txt` | `@` 뒤에 업로드할 파일 경로 (앞서 생성한 파일 경로와 일치시킬 것) |
>
> 이렇게 하면 줄 바꿈(`\` vs 백틱) 문제도 없고, 긴 Presigned URL을 터미널에서 직접 편집할 필요도 없습니다.  
> **Mac이든 Windows든 한 줄로 작성하면 동일하게 동작합니다.**

> [!NOTE]
> 아래 명령어의 파일 경로(`/tmp/test.txt`)나 파일 이름은 예시입니다.  
> 본인이 원하는 경로와 파일명으로 자유롭게 변경하되, 이후 명령어에서도 동일한 경로를 사용하세요.

**Mac/Linux:**
```bash
echo "Hello S3 from local! " > /tmp/test.txt
```

**Windows (PowerShell):**
```powershell
"Hello S3 from local! " | Out-File -Encoding utf8 $env:TEMP\test.txt
```

파일이 정상적으로 생성되었는지 확인합니다:

```bash
cat /tmp/test.txt
```

> [!OUTPUT]
> ```
> Hello S3 from local! 
> ```

87. 파일 업로드 테스트:

> [!NOTE]
> `file=@` 뒤의 경로가 앞서 생성한 테스트 파일 경로와 일치하는지 확인하세요.

**Mac/Linux:**
```bash
curl -X POST http://localhost:8080/api/files/upload \
  -F "file=@/tmp/test.txt" \
  -F "directory=test"
```

**Windows (PowerShell):**
```powershell
curl -X POST http://localhost:8080/api/files/upload `
  -F "file=@$env:TEMP\test.txt" `
  -F "directory=test"
```

> [!OUTPUT]
> ```json
> {
>   "key": "test/550e8400-e29b-41d4-a716-446655440000.txt",
>   "url": "https://{닉네임}-starter-app.s3.ap-northeast-2.amazonaws.com/test/..."
> }
> ```

88. 파일 목록 조회:

```bash
curl http://localhost:8080/api/files?prefix=test/
```

> [!OUTPUT]
> ```json
> ["test/550e8400-e29b-41d4-a716-446655440000.txt"]
> ```

89. Presigned Upload URL 발급:

**Mac/Linux:**
```bash
curl -X POST http://localhost:8080/api/files/presigned-upload \
  -H "Content-Type: application/json" \
  -d '{"directory":"test","filename":"hello.txt","contentType":"text/plain"}'
```

**Windows (PowerShell):**
```powershell
curl -X POST http://localhost:8080/api/files/presigned-upload `
  -H "Content-Type: application/json" `
  -d "{`"directory`":`"test`",`"filename`":`"hello.txt`",`"contentType`":`"text/plain`"}"
```

> [!TIP]
> Windows PowerShell에서 JSON을 전달할 때:
> - 전체를 큰따옴표(`"`)로 감쌉니다.
> - 내부 따옴표는 백틱 + 따옴표(`` `" ``)로 이스케이프합니다.
> - 또는 Git Bash를 설치하면 Mac과 동일한 명령어를 사용할 수 있습니다.

> [!TIP]
> **따옴표나 긴 URL 다루기가 어려우면, 텍스트 에디터에서 명령어를 조립하세요.**
>
> 1. VS Code, 메모장, IntelliJ 등 아무 에디터를 엽니다.
> 2. curl 명령어 틀을 먼저 적습니다:
>    ```
>    curl -X PUT "여기에URL붙여넣기" -H "Content-Type: text/plain" -d "Hello"
>    ```
> 3. 응답에서 받은 URL이나 key를 복사해서 해당 위치에 붙여넣습니다.
> 4. 완성된 명령어 한 줄을 통째로 복사 → 터미널에 붙여넣어 실행합니다.
>
> **예시 — 메모장에서 조립하는 과정:**
> ```
> ① Presigned Upload URL 발급 응답에서 uploadUrl 복사:
>    https://mylab-starter-app.s3.ap-northeast-2.amazonaws.com/test/abc123_hello.txt?X-Amz-Algorithm=...
>
> ② 에디터에서 명령어 조립:
>    curl -X PUT "https://mylab-starter-app.s3.ap-northeast-2.amazonaws.com/test/abc123_hello.txt?X-Amz-Algorithm=..." -H "Content-Type: text/plain" -d "Hello"
>
> ③ 위 한 줄을 통째로 복사 → 터미널에 붙여넣기 → Enter
> ```
>
> 이렇게 하면 줄 바꿈(`\` vs 백틱) 문제도 없고, 긴 Presigned URL을 터미널에서 직접 편집할 필요도 없습니다.
> **Mac이든 Windows든 한 줄로 작성하면 동일하게 동작합니다.**

> [!OUTPUT]
> ```json
> {
>   "uploadUrl": "https://{닉네임}-starter-app.s3.ap-northeast-2.amazonaws.com/test/348704c1-c8de-44a2-8f9c-f4180a931c3f_hello.txt?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Date=...&X-Amz-SignedHeaders=content-type%3Bhost&X-Amz-Credential=...&X-Amz-Expires=600&X-Amz-Signature=..."
> }
> ```
>
> **복사할 부분:** `"uploadUrl":"` 뒤부터 마지막 `"` 앞까지의 URL 전체입니다.  
> `https://`로 시작하고 `X-Amz-Signature=...` 로 끝나는 긴 문자열 한 덩어리를 복사하세요.  
> 앞뒤의 `{`, `}`, `"uploadUrl":"` 부분은 포함하지 않습니다.

90. **발급받은 Presigned URL로 파일을 직접 업로드합니다.**

> [!NOTE]
> **이 단계가 핵심입니다.** 앞서 발급받은 `uploadUrl`은 "이 URL로 보내면 S3에 저장해줄게"라는 임시 허가증입니다.  
> 이제 그 URL에 실제 파일 데이터를 PUT 요청으로 전송해야 S3에 파일이 올라갑니다.
>
> 앞서 받은 응답의 `uploadUrl` 값 **전체**를 복사하여 아래 명령어의 URL 부분에 붙여넣습니다.

**Mac/Linux:**
```bash
curl -X PUT "여기에-앞서-받은-uploadUrl-전체를-붙여넣기" \
  -H "Content-Type: text/plain" \
  --data-binary @/tmp/test.txt
```

**Windows (PowerShell):**
```powershell
curl -X PUT "여기에-앞서-받은-uploadUrl-전체를-붙여넣기" `
  -H "Content-Type: text/plain" `
  --data-binary @$env:TEMP\test.txt
```

실제 예시 (앞서 받은 응답을 그대로 사용):

**Mac/Linux:**
```bash
curl -X PUT "https://{닉네임}-starter-app.s3.ap-northeast-2.amazonaws.com/test/348704c1-c8de-44a2-8f9c-f4180a931c3f_hello.txt?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Date=20260614T021637Z&X-Amz-SignedHeaders=content-type%3Bhost&X-Amz-Credential=...&X-Amz-Expires=600&X-Amz-Signature=..." \
  -H "Content-Type: text/plain" \
  --data-binary @/tmp/test.txt
```

**Windows (PowerShell):**
```powershell
curl -X PUT "https://{닉네임}-starter-app.s3.ap-northeast-2.amazonaws.com/test/348704c1-c8de-44a2-8f9c-f4180a931c3f_hello.txt?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Date=20260614T021637Z&X-Amz-SignedHeaders=content-type%3Bhost&X-Amz-Credential=...&X-Amz-Expires=600&X-Amz-Signature=..." `
  -H "Content-Type: text/plain" `
  --data-binary @$env:TEMP\test.txt
```

> [!OUTPUT]
> 성공 시 빈 응답(HTTP 200)이 돌아옵니다. 에러 없이 커서가 돌아오면 업로드 성공입니다.

업로드 확인 — 파일 목록을 조회하여 S3에 올라갔는지 확인합니다:

```bash
curl http://localhost:8080/api/files?prefix=test/
```

> [!OUTPUT]
> ```json
> ["test/348704c1-c8de-44a2-8f9c-f4180a931c3f_hello.txt"]
> ```
>
> 목록에 파일이 표시되면 Presigned URL 업로드가 성공한 것입니다.

> [!WARNING]
> - `Content-Type` 헤더 값은 Presigned Upload URL 발급 시 보낸 `contentType`과 **정확히 일치**해야 합니다 (여기선 `text/plain`).
> - 일치하지 않으면 `SignatureDoesNotMatch` 에러가 발생합니다.
> - Presigned URL은 발급 후 10분(600초)간만 유효합니다. 시간이 지났으면 Presigned Upload URL 발급부터 다시 실행하세요.

91. **Presigned Download URL을 발급받아 파일을 다운로드합니다.**

> [!NOTE]
> 아래 명령어의 `key=` 뒤에는 **앞서 받은 uploadUrl에서 S3 key 부분**을 넣습니다.
>
> S3 key 찾는 법 — 앞서 받은 응답의 `uploadUrl`에서:
> ```
> https://{버킷}.s3.ap-northeast-2.amazonaws.com/ test/348704c1-c8de-44a2-8f9c-f4180a931c3f_hello.txt ?X-Amz-...
>                                                ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
>                                                  버킷 도메인 뒤 ~ 물음표(?) 앞 = 이게 key
> ```
>
> 즉 key = `test/348704c1-c8de-44a2-8f9c-f4180a931c3f_hello.txt`

```bash
curl "http://localhost:8080/api/files/presigned-download?key={앞서-확인한-S3-key}"
```

실제 예시:

```bash
curl "http://localhost:8080/api/files/presigned-download?key=test/348704c1-c8de-44a2-8f9c-f4180a931c3f_hello.txt"
```

> [!OUTPUT]
> ```json
> {
>   "downloadUrl": "https://{닉네임}-starter-app.s3.ap-northeast-2.amazonaws.com/test/348704c1-c8de-44a2-8f9c-f4180a931c3f_hello.txt?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=1800&..."
> }
> ```

응답의 `downloadUrl` 값을 복사하여 브라우저 주소창에 붙여넣으면 파일 내용을 확인할 수 있습니다.

> [!TIP]
> 터미널에서 한번에 확인하려면 `jq`를 사용할 수 있습니다 (Mac: `brew install jq`):
>
> ```bash
> curl -s "http://localhost:8080/api/files/presigned-download?key={앞서-확인한-S3-key}" | jq -r '.downloadUrl' | xargs curl
> ```

> [!OUTPUT]
> 브라우저에 파일 내용(`Hello S3 from local! `)이 표시되면 성공입니다.  
> Presigned Download URL은 30분간 유효합니다.

> [!TIP]
> **`test/` 경로는 public이 아닌데 왜 브라우저에서 보이나요?**  
> Presigned URL에는 AWS 서명(Signature)이 포함되어 있어서, 버킷 정책과 관계없이 **임시 접근 권한**을 부여합니다.
> - `public/` 경로: 버킷 정책으로 누구나 URL만으로 접근 가능 (서명 불필요)
> - `test/`, `private/` 경로: 일반 URL로는 `Access Denied`, **Presigned URL로만 접근 가능** (서명이 권한을 대신함)
>
> 즉, Presigned URL은 "이 사람은 내가 허락했으니 한시적으로 볼 수 있게 해줘"라는 의미입니다.

92. 파일 삭제:

> [!NOTE]
> `key=` 뒤에 앞서 업로드한 파일의 S3 key를 넣습니다.  
> 파일 목록 조회(90번)나 업로드 응답에서 확인한 key와 동일한 값입니다.  
> `test/` 경로를 빠뜨리지 않도록 주의하세요.

```bash
curl -X DELETE "http://localhost:8080/api/files?key={앞서-확인한-S3-key}"
```

실제 예시:

```bash
curl -X DELETE "http://localhost:8080/api/files?key=test/348704c1-c8de-44a2-8f9c-f4180a931c3f_hello.txt"
```

> [!OUTPUT]
> HTTP 204 No Content (빈 응답). 삭제 완료.

삭제 확인:

```bash
curl http://localhost:8080/api/files?prefix=test/
```

> [!OUTPUT]
> ```json
> []
> ```
>
> 빈 배열이 반환되면 삭제가 정상적으로 완료된 것입니다.

> [!TIP]
> **key를 매번 복사하기 번거롭다면**, 변수에 저장하여 사용할 수 있습니다:
>
> ```bash
> # 앞서 받은 uploadUrl에서 key 부분을 복사해 변수에 저장
> KEY="test/348704c1-c8de-44a2-8f9c-f4180a931c3f_hello.txt"
>
> # 이후 명령어에서 변수 사용
> curl "http://localhost:8080/api/files/presigned-download?key=$KEY"
> curl -X DELETE "http://localhost:8080/api/files?key=$KEY"
> ```

93. S3 콘솔에서 확인:
    - AWS 콘솔 → S3 → 버킷 클릭 → `test/` 폴더에서 업로드된 파일 확인

✅ **태스크 완료**: 로컬에서 모든 API가 정상 동작합니다.

---

### (참고) Vue.js에서 S3 API 활용하기

백엔드 API가 동작하는 것을 확인했으니, 프론트엔드에서 이를 호출하는 방법을 살펴봅니다.  
아래는 Vue 3 Composition API 기준 예시입니다.

#### 파일 업로드 (Multipart)

```vue
<template>
  <div>
    <input type="file" @change="onFileSelect" />
    <button @click="upload" :disabled="!selectedFile">업로드</button>
    <p v-if="uploadedUrl">
      업로드 완료: <a :href="uploadedUrl" target="_blank">{{ uploadedUrl }}</a>
    </p>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const selectedFile = ref(null)
const uploadedUrl = ref('')

const onFileSelect = (e) => {
  selectedFile.value = e.target.files[0]
}

const upload = async () => {
  const formData = new FormData()
  formData.append('file', selectedFile.value)
  formData.append('directory', 'public/images') // 공개 폴더에 업로드

  const res = await fetch('/api/files/upload', {
    method: 'POST',
    body: formData
  })
  const data = await res.json()
  uploadedUrl.value = data.url // S3 공개 URL
}
</script>
```

#### Presigned URL로 클라이언트 직접 업로드

> [!CONCEPT] Presigned URL 업로드의 장점
> 파일이 백엔드 서버를 거치지 않고 **브라우저에서 S3로 직접** 올라갑니다.
> - 서버 부하 감소 (대용량 파일도 서버 메모리 사용 없음)
> - 업로드 속도 향상 (클라이언트 → S3 직통)
> - 서버는 URL 발급만 담당

```vue
<template>
  <div>
    <input type="file" @change="onFileSelect" />
    <button @click="presignedUpload" :disabled="!selectedFile">
      Presigned URL 업로드
    </button>
    <p v-if="status">{{ status }}</p>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const selectedFile = ref(null)
const status = ref('')

const onFileSelect = (e) => {
  selectedFile.value = e.target.files[0]
}

const presignedUpload = async () => {
  const file = selectedFile.value
  status.value = 'URL 발급 중...'

  // 1단계: 백엔드에서 Presigned Upload URL 발급
  const urlRes = await fetch('/api/files/presigned-upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      directory: 'private/docs',
      filename: file.name,
      contentType: file.type
    })
  })
  const { uploadUrl } = await urlRes.json()

  // 2단계: 발급받은 URL로 S3에 직접 업로드
  status.value = '업로드 중...'
  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file  // 파일 데이터를 S3로 직접 전송
  })

  if (uploadRes.ok) {
    status.value = '업로드 완료!'
  } else {
    status.value = '업로드 실패: ' + uploadRes.statusText
  }
}
</script>
```

> [!NOTE]
> `Content-Type`은 URL 발급 시 보낸 `contentType`과 **반드시 일치**해야 합니다.
> `file.type`을 그대로 사용하면 자동으로 일치합니다.

#### Presigned URL로 다운로드

```vue
<script setup>
const downloadFile = async (key) => {
  // 백엔드에서 Presigned Download URL 발급
  const res = await fetch(`/api/files/presigned-download?key=${encodeURIComponent(key)}`)
  const { downloadUrl } = await res.json()

  // 브라우저에서 다운로드 실행
  window.open(downloadUrl, '_blank')
}
</script>
```

#### 파일 목록 조회 + 삭제

```vue
<template>
  <div>
    <button @click="loadFiles">파일 목록 조회</button>
    <ul>
      <li v-for="key in files" :key="key">
        {{ key }}
        <button @click="downloadFile(key)">다운로드</button>
        <button @click="deleteFile(key)">삭제</button>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const files = ref([])

const loadFiles = async () => {
  const res = await fetch('/api/files?prefix=public/images/')
  files.value = await res.json()
}

const downloadFile = async (key) => {
  const res = await fetch(`/api/files/presigned-download?key=${encodeURIComponent(key)}`)
  const { downloadUrl } = await res.json()
  window.open(downloadUrl, '_blank')
}

const deleteFile = async (key) => {
  await fetch(`/api/files?key=${encodeURIComponent(key)}`, { method: 'DELETE' })
  await loadFiles() // 목록 갱신
}
</script>
```

> [!TIP]
> **실제 프로젝트에 적용할 때:**
> - `fetch` URL의 base path는 프로젝트의 API 설정(axios baseURL, proxy 등)에 맞게 조정하세요.
> - 에러 처리(`try/catch`)와 로딩 상태를 추가하면 UX가 좋아집니다.
> - `public/` 경로에 업로드한 파일은 `data.url`을 `<img :src="...">`에 바로 사용할 수 있습니다.
> - `private/` 경로 파일은 Presigned Download URL을 발급받아야만 접근 가능합니다.

---

## 태스크 7: CloudFormation으로 EC2 생성

로컬에서 개발·테스트를 완료했으므로, 이제 EC2를 생성하여 배포합니다.  
CloudFormation으로 EC2를 생성하면서 UserData로 Java 17, MySQL, Tomcat 등 필요한 패키지를 자동 설치합니다.

> [!DOWNLOAD]
> [step5-2-ec2-deploy.zip](/files/step5/step5-2-ec2-deploy.zip)
>
> - `step5-2-ec2.yaml` — 기존 VPC가 있는 경우 (EC2 + Security Group만 생성)
> - `step5-2-ec2-with-vpc.yaml` — VPC 없는 경우 (2AZ 고가용성 네트워크 + EC2 올인원 생성)
>
> 다운로드 후 zip을 풀어서 본인 상황에 맞는 yaml 파일을 준비해 두세요.

| 상황 | 사용할 파일 |
| ---- | ----------- |
| 이전 실습(Step 2-1, 3 등)에서 VPC를 이미 생성함 또는 기본 VPC 사용 | `step5-2-ec2.yaml` |
| VPC를 만든 적 없거나, 깨끗한 환경에서 시작하고 싶음 | `step5-2-ec2-with-vpc.yaml` |

### CloudFormation 스택 생성

📍 **실행 위치: 로컬 PC (브라우저 — AWS 콘솔)**

94. AWS Management Console 상단 검색창에 `CloudFormation`을 입력하고 **CloudFormation** 서비스를 선택합니다.
95. [[Create stack]] → **With new resources (standard)**를 선택합니다.
96. **Prepare template** 섹션에서 **Upload a template file**을 선택합니다.
97. [[Choose file]]을 클릭하고 본인 상황에 맞는 yaml 파일을 선택합니다.
    - 기존 VPC 사용: `step5-2-ec2.yaml`
    - VPC 새로 생성: `step5-2-ec2-with-vpc.yaml`
98. [[Next]]를 클릭합니다.
99. **Stack name**: `s3-app-ec2`를 입력합니다.
100. **Parameters**를 설정합니다:

**`step5-2-ec2.yaml` 선택 시:**

| 파라미터 | 설정값 |
| -------- | ------ |
| **KeyPairName** | 본인의 키 페어 이름 (예: `my-keypair`) |
| **InstanceType** | `t3.micro` (기본값 유지) |
| **VpcId** | 사용할 VPC 선택 (기본 VPC 또는 `my-vpc`) |
| **SubnetId** | **Public Subnet** 선택 |

**`step5-2-ec2-with-vpc.yaml` 선택 시:**

| 파라미터 | 설정값 |
| -------- | ------ |
| **KeyPairName** | 본인의 키 페어 이름 (예: `my-keypair`) |
| **InstanceType** | `t3.micro` (기본값 유지) |
| **CIDR 파라미터들** | 모두 기본값 유지 |

> [!NOTE]
> - **KeyPairName**: EC2에 SSH 접속할 때 사용하는 키 페어. EC2 콘솔 → Key Pairs에서 확인. 없으면 먼저 생성하세요.
> - **VpcId / SubnetId** (`step5-2-ec2.yaml`만): 기존 VPC와 **Public Subnet**을 선택합니다.
> - **CIDR 파라미터들** (`step5-2-ec2-with-vpc.yaml`만): 기본값 유지하면 이전 실습(Step 2-1)과 동일한 2AZ 고가용성 구조로 생성됩니다.

> [!TIP]
> **`ProjectName` 파라미터**를 변경하면 리소스 이름이 달라집니다.  
> 기본값 `s3-app` → `s3-app-vpc`, `s3-app-public-subnet-a`, `s3-app-ec2-sg` 등으로 생성됩니다.  
> 이전 실습에서 `my-vpc`, `my-public-subnet-a`처럼 사용했다면 `ProjectName`을 `my`로 변경하세요.  
> 단, **기존 VPC와 이름이 같아도 별개의 리소스**입니다 (CloudFormation 스택 단위로 관리).

101. [[Next]]를 클릭합니다 (Configure stack options 페이지 — 기본값 유지).
102. 한 번 더 [[Next]]를 클릭합니다 (Review 페이지가 표시됨).
103. 설정 내용을 확인한 후 [[Submit]]을 클릭합니다.
104. 스택 목록에서 `s3-app-ec2` 스택의 **Status**가 `CREATE_COMPLETE`가 될 때까지 기다립니다 (약 3~5분). 
     - `CREATE_IN_PROGRESS`가 표시되면 정상 — 자동 새로고침이 안 되면 🔄 버튼을 클릭하세요.

> [!NOTE]
> **UserData로 자동 설치되는 항목:**
> - Swap 2GB (t3.micro 메모리 부족 대비)
> - Amazon Corretto 17 (Java 17) + JAVA_HOME 설정
> - MySQL 8.4 LTS (mysql-community-server) — 설치 + 시작 + `root` 비밀번호 `Scoula123!` 설정
> - Tomcat 9.0.106 — 설치 + systemd 서비스 등록 + 자동 시작
> - AWS CLI v2
> - 앱 배포 디렉토리 (`/opt/app`)
>
> EC2 생성이 완료되면 SSH 접속 후 바로 JAR/WAR을 배포할 수 있습니다.  
> **MySQL `root` 비밀번호**: `Scoula123!` (Step 2-1과 동일)

105. 스택 이름(`s3-app-ec2`)을 클릭하여 상세 페이지로 이동합니다.
106. 상단 탭에서 **Outputs** 탭을 클릭합니다.
107. **PublicIP** 값을 메모합니다. 이후 SSH 접속, SCP 전송, API 테스트에서 모두 이 IP를 사용합니다.

> [!TIP]
> Outputs 탭에는 SSH 명령어(`SSHCommand`)와 앱 URL(`AppURL`)도 표시됩니다.  
> SSH 명령어를 그대로 복사하면 편리합니다 (키 파일 경로만 본인 것으로 변경).

> [!OUTPUT]
> Outputs 탭에 `PublicIP`와 값(예: `3.35.xxx.xxx`)이 표시됩니다.

> [!TROUBLESHOOTING]
> | 증상 | 원인 | 해결 |
> |------|------|------|
> | `CREATE_FAILED` | KeyPair 이름 오타 또는 Subnet이 Private | KeyPair 이름 확인, Public Subnet으로 변경 |
> | Outputs 탭이 비어있음 | 아직 생성 중 | Events 탭에서 진행 상황 확인, 3~5분 대기 |

### SSH 접속 + 설치 확인

📍 **실행 위치: EC2** (SSH 접속한 상태)

108. EC2에 SSH로 접속합니다:

> [!NOTE]
> 아래 명령어에서 변경할 부분:
> - `~/Downloads/my-keypair.pem` → 본인의 키 파일 실제 경로
> - `{EC2-Public-IP}` → 위 107번에서 메모한 Public IP
>
> Windows에서는 경로를 `C:\Users\{사용자명}\Downloads\my-keypair.pem`으로 변경하세요.

```bash
ssh -i ~/Downloads/my-keypair.pem ec2-user@{EC2-Public-IP}
```

> [!OUTPUT]
> ```
>        __|  __|_  )
>        _|  (     /   Amazon Linux 2023
>       ___|\___|___|
> ```
> Amazon Linux 환영 메시지가 표시되면 접속 성공입니다.

109. UserData 설치가 정상 완료되었는지 확인합니다:

```bash
cat /opt/app/setup.log
```

> [!OUTPUT]
> ```
> === UserData Setup Log ===
> Completed at: Sat Jun 14 ...
> openjdk version "17.0.x" ...
> mysql  Ver 8.4.x for Linux on x86_64 (MySQL Community Server - GPL)
> Tomcat: Server number: 9.0.106.0
> ```
>
> Java 17, MySQL 8.4, Tomcat 9가 모두 표시되면 설치 성공입니다.

> [!TIP]
> setup.log에 내용이 없거나 파일이 없으면 UserData가 아직 실행 중일 수 있습니다.  
> 1~2분 기다린 후 다시 확인하세요. 그래도 안 되면 `sudo cat /var/log/cloud-init-output.log | tail -50`으로 상세 로그를 확인합니다.

110. 각 서비스가 정상 실행 중인지 확인합니다:

```bash
# MySQL 상태 확인
sudo systemctl status mysqld

# Tomcat 상태 확인 - q로 종료 
sudo systemctl status tomcat

# Java 버전 확인
java -version

# Swap 확인
free -h
```

> [!OUTPUT]
> - `mysqld`: `Active: active (running)` 표시
> - `tomcat`: `Active: active (running)` 표시
> - `java -version`: `openjdk version "17.0.x"` 표시
> - `free -h`: Swap 행에 `2.0Gi` 표시

> [!TROUBLESHOOTING]
> | 증상 | 원인 | 해결 |
> |------|------|------|
> | setup.log 비어있음 | UserData 아직 실행 중 | 1~2분 대기 후 재확인 |
> | `mysqld` inactive | 설치 실패 또는 디스크 부족 | `sudo journalctl -u mysqld -n 30` 확인 |
> | `tomcat` inactive | wget 다운로드 실패 | `ls /opt/tomcat/bin/` 확인, 없으면 수동 설치 |

✅ **태스크 완료**: EC2가 생성되고 Java 17 + MySQL 8.4 + Tomcat 9 + Swap이 설치·실행 확인되었습니다.

---

## 태스크 8: IAM Policy + Role 수동 생성 → EC2에 연결

EC2에서 S3에 접근하려면 **IAM Role**이 필요합니다.  
로컬에서는 `~/.aws/credentials`를 사용했지만, EC2에서는 Role을 연결하면 Access Key 없이 자동으로 자격 증명을 획득합니다.

> [!CONCEPT] 왜 EC2에서 Access Key 대신 IAM Role을 사용하는가?
>
> | 항목           | Access Key 방식          | IAM Role 방식              |
> | -------------- | ------------------------ | -------------------------- |
> | 자격 증명 위치 | 코드/파일에 저장         | EC2 메타데이터에서 자동 제공 |
> | 키 로테이션    | 수동 교체 필요           | 자동 (임시 자격 증명)       |
> | 유출 위험      | Git 커밋, 로그 노출 가능 | 인스턴스 외부 유출 불가     |
> | AWS 권장       | ❌                       | ✅                          |

### IAM Role 생성

📍 **실행 위치: 로컬 PC (브라우저 — AWS 콘솔)**

> [!NOTE]
> IAM Policy(`S3AppBucketPolicy`)는 태스크 1에서 이미 생성했습니다.  
> 여기서는 그 정책을 EC2용 **Role**에 연결합니다.

111. 상단 검색창에 `IAM`을 입력하고 **IAM** 서비스를 선택합니다.
112. 왼쪽 메뉴에서 **Roles**를 선택합니다.
113. [[Create role]]을 클릭합니다.
114. **Trusted entity type**: `AWS service`를 선택합니다.
115. **Service or use case** 드롭다운에서 `EC2`를 선택합니다.
116. 아래 **Use case** 라디오 목록에서 첫 번째 `EC2` ("Allows EC2 instances to call AWS services on your behalf.")를 선택합니다.
117. [[Next]]를 클릭합니다.
118. **Permissions policies** 검색창에 `S3AppBucketPolicy`를 입력합니다.
119. `S3AppBucketPolicy` 체크박스를 선택합니다.
120. [[Next]]를 클릭합니다.
121. **Role name**: `ec2-s3-access-role`을 입력합니다.
122. **Tags** 섹션에서 [[Add new tag]]를 클릭하여 다음 태그를 추가합니다:
     - `CreatedBy` = `admin-user`
     - `Step` = `step5`
     - `Session` = `5-2`
123. [[Create role]]을 클릭합니다.

> [!OUTPUT]
> "Role ec2-s3-access-role created" 메시지가 표시됩니다.

### EC2에 IAM Role 연결

📍 **실행 위치: 로컬 PC (브라우저 — AWS 콘솔)**

124. 상단 검색창에 `EC2`를 입력하고 **EC2** 서비스를 선택합니다.
125. 왼쪽 메뉴에서 **Instances**를 선택합니다.
126. 태스크 7에서 생성한 EC2 인스턴스의 체크박스를 선택합니다.
127. 상단 **Actions** → **Security** → **Modify IAM role**을 클릭합니다.
128. **IAM role** 드롭다운에서 `ec2-s3-access-role`을 선택합니다.
129. [[Update IAM role]]을 클릭합니다.

> [!OUTPUT]
> "Successfully attached ec2-s3-access-role to instance" 메시지가 표시됩니다.

### EC2에서 Role 동작 확인

📍 **실행 위치: EC2** (SSH 접속한 상태)

130. EC2에 SSH로 접속합니다 (태스크 7에서 이미 접속 중이면 건너뛰세요):

```bash
ssh -i ~/Downloads/my-keypair.pem ec2-user@{EC2-Public-IP}
```

131. IAM Role이 연결되었는지 확인합니다:

```bash
aws sts get-caller-identity
```

> [!OUTPUT]
> ```json
> {
>   "Arn": "arn:aws:sts::123456789012:assumed-role/ec2-s3-access-role/i-0abc..."
> }
> ```
>
> `ec2-s3-access-role`이 포함되어 있으면 IAM Role이 정상 연결된 것입니다.

132. S3 버킷에 접근 가능한지 테스트합니다:

```bash
aws s3 ls s3://{닉네임}-starter-app/
```

> [!OUTPUT]
> 에러 없이 빈 결과 또는 기존 파일 목록이 표시되면 성공입니다.  
> `AccessDenied` 에러가 나면 IAM Policy의 Resource ARN에서 버킷 이름이 맞는지 확인하세요.

✅ **태스크 완료**: IAM Policy → Role 생성 → EC2 연결이 완료되었습니다. Access Key 없이 S3에 접근할 수 있습니다.

---

## 태스크 9: EC2 배포 + 테스트

### (기존 MVC 프로젝트용) DB 세팅

📍 **실행 위치: EC2** (SSH 접속한 상태)

> [!NOTE]
> **Spring Boot 새 프로젝트**를 사용하는 경우 DB가 필요 없으면 이 섹션을 건너뛰세요.  
> **기존 MVC 프로젝트** (게시판 등)를 배포하는 경우, EC2의 MySQL에 사용자와 스키마를 생성해야 합니다.

133. EC2에 SSH로 접속한 상태에서 MySQL에 root로 접속합니다:

```bash
mysql -u root -p
```

> 비밀번호: `Scoula123!` (UserData에서 설정한 값)

134. 애플리케이션용 사용자와 데이터베이스를 생성합니다:

```sql
-- 사용자 생성 (본인 프로젝트의 DB 설정에 맞게 변경)
CREATE USER 'scoula'@'%' IDENTIFIED BY 'Scoula123!';

-- 데이터베이스 생성
CREATE DATABASE scoula_db DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 권한 부여
GRANT ALL PRIVILEGES ON scoula_db.* TO 'scoula'@'%';
FLUSH PRIVILEGES;

EXIT;
```

> [!TIP]
> 사용자명, 비밀번호, 데이터베이스명은 본인 프로젝트의 `application.properties` (또는 `root-context.xml`)에 설정된 값과 일치시키세요.

135. (선택) 로컬에서 SQL 파일을 EC2로 전송하고 실행합니다:

**로컬 터미널에서 (EC2가 아닌 새 터미널):**

```bash
scp -i ~/Downloads/my-keypair.pem \
  board.sql member.sql travel* \
  ec2-user@{EC2-Public-IP}:~/
```

**EC2에서:**

```bash
mysql -u root -pScoula123! --local-infile=1
```

MySQL 접속 후 다음을 실행합니다:

```sql
-- SQL 파일 실행
SOURCE /home/ec2-user/board.sql;
SOURCE /home/ec2-user/member.sql;
SOURCE /home/ec2-user/travel.sql;

-- travel 데이터 CSV 임포트
SET GLOBAL local_infile=1;
USE scoula_db;

LOAD DATA LOCAL INFILE '/home/ec2-user/travel.csv'
INTO TABLE tbl_travel
FIELDS TERMINATED BY ',' ENCLOSED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 ROWS
(no, district, title, description, address, phone);

LOAD DATA LOCAL INFILE '/home/ec2-user/travel_image.csv'
INTO TABLE tbl_travel_image
FIELDS TERMINATED BY ',' ENCLOSED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 ROWS
(filename, travel_no);

EXIT;
```

> [!NOTE]
> SQL 파일은 본인 프로젝트에 있는 파일을 사용하세요.  
> 파일이 여러 개라면 테이블 생성 순서(FK 의존 관계)를 고려하여 실행합니다.

### (선택) 기존 이미지 파일을 S3에 업로드

> [!NOTE]
> 프로젝트에서 이미지를 로컬 디스크에 저장하고 있었다면, S3로 전환하기 위해 기존 파일을 업로드해야 합니다.  
> 이미지가 없거나 새 프로젝트라면 이 섹션을 건너뛰세요.

**기존 MVC 프로젝트 (예: travel 이미지가 프로젝트 내에 있는 경우):**

IntelliJ 터미널을 열면 프로젝트 루트에서 바로 작업할 수 있습니다.  
이미지 폴더(예: `travel-image/`)가 프로젝트 내에 있다면 상대 경로로 바로 업로드합니다:

```bash
aws s3 sync travel-image/ s3://{닉네임}-starter-app/public/travel/ --profile s3-dev
```

> [!TIP]
> ExFAT 외장 드라이브에서 작업하면 `._` 메타데이터 파일이 자동 생성됩니다.  
> 이 파일들이 S3에 올라가지 않도록 `--exclude` 옵션을 추가하세요:
>
> ```bash
> aws s3 sync travel-image/ s3://{닉네임}-starter-app/public/travel/ --profile s3-dev --exclude "._*"
> ```

> [!OUTPUT]
> ```
> upload: travel-image/001-1.jpg to s3://{닉네임}-starter-app/public/travel/001-1.jpg
> upload: travel-image/001-2.jpg to s3://{닉네임}-starter-app/public/travel/001-2.jpg
> ...
> ```

**별도 프로젝트 (본인 이미지 폴더에 맞게):**

```bash
aws s3 sync {이미지폴더경로}/ s3://{닉네임}-starter-app/public/{폴더명}/ --profile s3-dev
```

> [!TIP]
> - `public/` prefix로 업로드하면 버킷 정책(태스크 0에서 설정)에 의해 URL로 직접 접근 가능합니다.
> - DB에 저장된 파일명(예: `001-1.jpg`)이 S3 key의 마지막 부분과 일치해야 합니다.
> - 업로드 후 브라우저에서 확인: `https://{닉네임}-starter-app.s3.ap-northeast-2.amazonaws.com/public/travel/001-1.jpg`
> - 코드에서 `TravelImageDTO.getUrl()`이 이 URL을 반환하도록 수정되어 있습니다 (`application.properties`의 버킷/리전 값 사용).

### 로컬에서 빌드

📍 **실행 위치: 로컬 PC** (IntelliJ 터미널)

> [!NOTE]
> 이 단계는 **본인 PC의 터미널**(EC2가 아님)에서 실행합니다.

136. IntelliJ 터미널에서 빌드합니다 (프로젝트 루트에서 바로 실행 가능):

**Boot 프로젝트 (JAR):**

```bash
./gradlew clean build -x test
```

**MVC 프로젝트 (WAR):**

```bash
chmod +x gradlew
./gradlew clean build -x test
```

> [!OUTPUT]
> ```
> BUILD SUCCESSFUL in 12s
> ```

> [!TIP]
> **ExFAT 외장 드라이브에서 `clean` 실패 시:**  
> macOS가 자동 생성하는 `._` 메타데이터 파일 때문에 `build/` 디렉토리 삭제가 실패할 수 있습니다.  
> `clean` 전에 다음 명령을 먼저 실행하세요:
>
> ```bash
> find build -name '._*' -delete 2>/dev/null; ./gradlew clean build -x test
> ```

137. 빌드된 파일을 확인합니다:

```bash
ls build/libs/
```

> [!OUTPUT]
> ```
> demo-0.0.1-SNAPSHOT.jar    ← Boot 프로젝트
> ```
> 또는
> ```
> backend-1.0-SNAPSHOT.war   ← MVC 프로젝트
> ```
>
> 여기 표시된 파일명을 아래 SCP 명령에서 사용합니다.

### EC2로 전송

📍 **실행 위치: 로컬 PC** (터미널)

138. 빌드 결과물을 EC2에 전송합니다:

> [!NOTE]
> - `{파일명}` → 137번에서 확인한 실제 파일명 (예: `demo-0.0.1-SNAPSHOT`)
> - `{EC2-Public-IP}` → 태스크 7에서 메모한 IP

**Boot (JAR):**

```bash
scp -i ~/Downloads/my-keypair.pem \
  build/libs/{파일명}.jar \
  ec2-user@{EC2-Public-IP}:/opt/app/app.jar
```

**MVC (WAR):**

```bash
scp -i ~/Downloads/my-keypair.pem \
  build/libs/{파일명}.war \
  ec2-user@{EC2-Public-IP}:/opt/app/app.war
```

> [!OUTPUT]
> ```
> demo-0.0.1-SNAPSHOT.jar   100%   25MB   5.2MB/s   00:05
> ```

### EC2에서 실행

📍 **실행 위치: EC2** (SSH 접속한 상태)

139. EC2에 SSH로 접속합니다 (이미 접속 중이면 건너뛰세요):

```bash
ssh -i ~/Downloads/my-keypair.pem ec2-user@{EC2-Public-IP}
```

140. 애플리케이션을 실행합니다:

**Boot:**

```bash
nohup java -jar /opt/app/app.jar --server.port=8080 > /opt/app/app.log 2>&1 &
```

**MVC (Tomcat):**

```bash
sudo systemctl stop tomcat
rm -rf /opt/tomcat/webapps/ROOT
cp /opt/app/app.war /opt/tomcat/webapps/ROOT.war
sudo systemctl start tomcat
```

141. 앱이 정상 시작되었는지 로그를 확인합니다:

**Boot:**

```bash
tail -f /opt/app/app.log
```

**MVC (Tomcat):**

```bash
tail -f /opt/tomcat/logs/catalina.out
```

> [!OUTPUT]
> ```
> Started DemoApplication in 5.234 seconds
> ```
> 또는 Tomcat 로그에 배포 완료 메시지가 표시되면 성공. `Ctrl+C`로 종료합니다.

> [!TROUBLESHOOTING]
> | 증상 | 원인 | 해결 |
> |------|------|------|
> | `Error: Unable to access jarfile` | scp 경로 오류 | `ls /opt/app/` 으로 파일 존재 확인 |
> | `Port 8080 already in use` | Tomcat이 이미 사용 중 | Boot 사용 시 `sudo systemctl stop tomcat` 먼저 실행 |
> | `NoSuchBucket` | application.yml 버킷 이름 오류 | 로컬에서 수정 후 재빌드·재전송 |
> | DB 연결 실패 | MySQL 사용자/스키마 미생성 | 138~139번 DB 세팅 확인 |

### EC2에서 API 테스트

📍 **실행 위치: EC2 + 로컬 PC** (두 터미널 사용)

> [!NOTE]
> 앞서 `tail -f`로 로그를 보고 있다면 `Ctrl+C`로 종료한 후 테스트합니다.  
> 로그를 실시간으로 확인하면서 테스트하려면 **새 터미널**을 열어 EC2에 SSH 접속하세요:
> ```bash
> ssh -i ~/Downloads/my-keypair.pem ec2-user@{EC2-Public-IP}
> ```

142. **EC2 내부**에서 업로드를 테스트합니다 (SSH 접속 상태에서):

```bash
echo "Hello S3 from EC2! " > /tmp/test.txt
curl -X POST http://localhost:8080/api/files/upload \
  -F "file=@/tmp/test.txt" \
  -F "directory=test"
```

> [!OUTPUT]
> ```json
> {
>   "key": "test/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.txt",
>   "url": "https://{닉네임}-starter-app.s3.ap-northeast-2.amazonaws.com/test/..."
> }
> ```
>
> `key`와 `url`이 반환되면 EC2에서 S3 업로드가 성공한 것입니다.  
> IAM Role 덕분에 Access Key 없이도 동작합니다.

143. **본인 PC**(로컬 터미널)에서 외부 접근을 테스트합니다:

> [!NOTE]
> EC2 터미널이 아닌 **새 터미널**을 열어서 실행하세요.

```bash
curl http://{EC2-Public-IP}:8080/api/files?prefix=test/
```

> [!OUTPUT]
> ```json
> ["test/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.txt"]
> ```
>
> EC2에서 업로드한 파일이 목록에 표시되면 외부 접근도 정상입니다.

> [!TROUBLESHOOTING]
> | 증상 | 원인 | 해결 |
> |------|------|------|
> | 연결 시간 초과 | Security Group에 8080 미허용 | EC2 콘솔 → Security Group → Inbound rules → 8080 포트 추가 |
> | `Connection refused` | 앱이 실행 중이 아님 | EC2에서 로그 확인 |
> | `AccessDenied` (S3) | IAM Role 미연결 또는 정책 오류 | 태스크 8 재확인 |

### TROUBLESHOOTING (종합)

| 증상 | 원인 | 해결 |
| ---- | ---- | ---- |
| `NoSuchBucket` | application.yml 버킷 이름 오류 | 실제 버킷 이름으로 수정 후 재빌드·재배포 |
| `AccessDenied` | IAM Policy의 Resource ARN 불일치 | IAM Policy에서 버킷 이름 확인 |
| `Unable to locate credentials` | IAM Role 미연결 | EC2 → Actions → Security → Modify IAM role 확인 |
| `Port 8080 already in use` | 기존 프로세스 점유 | `lsof -i :8080` 확인 후 `kill -9 {PID}` |
| `SignatureDoesNotMatch` | Presigned URL Content-Type 불일치 | URL 발급 시와 동일한 Content-Type 사용 |
| 외부에서 접근 불가 | Security Group 8080 미허용 | Inbound rules에 Custom TCP 8080 추가 |
| SSH 접속 불가 | Security Group 22 미허용 또는 키 파일 권한 | `chmod 400 my-keypair.pem`, Inbound rules 22 확인 |

✅ **태스크 완료**: EC2에 배포하고 IAM Role을 통해 S3에 접근하는 것을 확인했습니다.

---

## 🎯 셀프 미션: 프론트엔드 배포 + S3 이미지 확인

> [!NOTE]
> 이 미션은 선택 사항입니다. 백엔드 배포가 정상 동작하는 것을 확인한 후, 프론트엔드도 EC2에 올려서 S3에서 이미지가 정상 로드되는지 확인해 봅니다.

### 목표

- 프론트엔드(Vue) 빌드 결과물(`dist/`)을 EC2에 배포
- Nginx 또는 Tomcat의 정적 파일 서빙으로 프론트엔드 접근
- 브라우저에서 travel 페이지의 이미지가 S3 URL로 정상 로드되는지 확인

### 힌트

📍 **로컬 PC** — 프론트엔드 빌드:

```bash
cd frontend
npm run build
```

📍 **로컬 PC** — dist 폴더를 EC2로 전송:

```bash
# ._ 파일 제거 후 전송
find ./dist -name '._*' -delete
scp -i ~/Downloads/my-keypair.pem -r ./dist/ ec2-user@{EC2-Public-IP}:~/dist/
```

📍 **EC2** — Nginx 설치 + 프록시 설정:

```bash
# Nginx 설치
sudo dnf install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Nginx 설정 수정
sudo vi /etc/nginx/conf.d/app.conf
```

`app.conf` 내용:

```nginx
server {
    listen 80;

    # 프론트엔드 정적 파일 서빙
    location / {
        root /home/ec2-user/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # API 요청은 Tomcat(8080)으로 프록시
    location /api/ {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

```bash
# 기본 설정의 server 블록 비활성화 (충돌 방지)
sudo sed -i 's/listen       80;/# listen       80;/' /etc/nginx/nginx.conf

# Nginx 재시작
sudo nginx -t && sudo systemctl restart nginx
```

> [!NOTE]
> Nginx(80) → 프론트 정적 파일 + API 프록시(8080) 구조입니다.  
> 브라우저에서 `http://{EC2-Public-IP}` (포트 80)로 접속하면 됩니다.  
> Security Group에 **80 포트 Inbound 허용**을 추가해야 합니다 (EC2 콘솔 → Security Group → Inbound rules → HTTP 80 추가).

### 확인 포인트

- 브라우저에서 `http://{EC2-Public-IP}:8080` 접속 → 프론트 화면 로드
- travel 목록 페이지에서 이미지가 표시되는지 확인
- 브라우저 개발자 도구(F12) → Network 탭에서 이미지 URL이 `https://{버킷}.s3.ap-northeast-2.amazonaws.com/public/travel/...` 형태인지 확인
- S3에서 직접 로드되므로 서버 부하 없이 이미지가 빠르게 표시됨

> [!TIP]
> Nginx를 사용하는 경우 Step 2-3의 Nginx 프록시 설정을 참고하세요.  
> 프론트(`/`) → dist 정적 파일, API(`/api/`) → Tomcat 8080으로 프록시하면 완전한 구조가 됩니다.

---

## 마무리

다음을 성공적으로 수행했습니다:

- 로컬 환경에서 AWS CLI 자격 증명으로 S3에 접근하여 개발·테스트했습니다.
- Spring 프로젝트에 AWS SDK v2를 설정하고 S3 업로드/다운로드/삭제 API를 구현했습니다.
- Presigned URL을 활용한 클라이언트 직접 업로드 방식을 구현했습니다.
- CloudFormation으로 EC2를 생성하고 UserData로 Java를 자동 설치했습니다.
- IAM Policy(최소 권한) → IAM Role → EC2 연결을 수동으로 수행하여 Access Key 없이 S3에 접근했습니다.

> [!TIP]
> **핵심 포인트:**
> - 로컬: `~/.aws/credentials`로 인증 → 개발 편의
> - EC2: IAM Role로 인증 → 보안 강화, 키 유출 불가
> - **코드 변경 없이** 동일한 SDK가 환경에 따라 자동으로 적절한 인증 방식을 선택합니다.

---




# 🗑️ 리소스 정리

> [!WARNING]
> **EC2는 실행 중이면 시간당 과금됩니다.** 실습이 끝나면 즉시 삭제하세요.
>
> | 리소스 | 방치 시 비용 | 비고 |
> | ------ | ------------ | ---- |
> | EC2 t3.micro | ~$0.013/시간 (~$9.4/월) | 중지해도 EBS 비용 발생 |
> | S3 테스트 파일 | 거의 없음 | 소량이면 무시 가능 |
> | IAM Role/Policy | 무료 | 비용 없지만 정리 권장 |

---

### 단계 1: Tag Editor로 생성된 리소스 확인

📍 **실행 위치: 로컬 PC (브라우저 — AWS 콘솔)**

삭제 전에 이 실습에서 생성한 리소스를 확인합니다.

1. AWS Management Console 상단 검색창에 `Resource Groups & Tag Editor`를 입력하고 선택합니다.
2. 왼쪽 메뉴에서 **Tag Editor**를 클릭합니다.
3. **Find resources to tag** 섹션에서 다음과 같이 설정합니다:
   - **Regions**: `ap-northeast-2` (서울)
   - **Resource types**: `All supported resource types`
4. **Tags** 섹션에서 [[Add tag]] 버튼을 클릭합니다.
5. **Tag key**에 `Session`, **Tag value**에 `5-2`를 입력합니다.
6. [[Search resources]] 버튼을 클릭합니다.
7. 검색 결과에 이 실습에서 생성한 리소스들이 표시되는지 확인합니다.

> [!OUTPUT]
> EC2 Instance, Security Group, IAM Role, IAM Policy 등이 목록에 표시됩니다.  
> `step5-2-ec2-with-vpc.yaml`을 사용한 경우 VPC, Subnet, Route Table 등도 함께 표시됩니다.

> [!TIP]
> Tag Editor는 리소스를 **찾는 용도**로만 사용합니다.  
> 여기서 직접 삭제할 수는 없습니다. 실제 삭제는 다음 단계에서 각 서비스 콘솔에서 수행합니다.

---

### 단계 2: EC2 애플리케이션 종료

📍 **실행 위치: EC2** (SSH 접속한 상태)

8. 터미널을 열고 EC2에 SSH로 접속합니다:

```bash
ssh -i ~/Downloads/my-keypair.pem ec2-user@{EC2-Public-IP}
```

> [!NOTE]
> `~/Downloads/my-keypair.pem`은 본인의 키 파일 경로, `{EC2-Public-IP}`는 태스크 7에서 메모한 IP로 변경하세요.

9. 실행 중인 애플리케이션을 종료합니다:

**Boot (JAR) 사용한 경우:**

```bash
pkill -f 'java -jar' || true
```

**MVC (Tomcat) 사용한 경우:**

```bash
sudo systemctl stop tomcat
```

10. 프로세스가 종료되었는지 확인합니다:

```bash
ps aux | grep -E 'java|tomcat' | grep -v grep
```

> [!OUTPUT]
> 아무것도 표시되지 않으면 정상 종료된 것입니다.

11. SSH 접속을 종료합니다:

```bash
exit
```

---

### 단계 3: EC2에서 IAM Role 분리

📍 **실행 위치: 로컬 PC (브라우저 — AWS 콘솔)**

> [!NOTE]
> CloudFormation 스택 삭제 전에 IAM Role을 먼저 분리해야 합니다.  
> 분리하지 않으면 스택 삭제가 실패할 수 있습니다.

12. 상단 검색창에 `EC2`를 입력하고 **EC2** 서비스를 선택합니다.
13. 왼쪽 메뉴에서 **Instances**를 클릭합니다.
14. 태스크 7에서 생성한 EC2 인스턴스의 체크박스를 선택합니다.
15. 상단 **Actions** → **Security** → **Modify IAM role**을 클릭합니다.
16. **IAM role** 드롭다운에서 빈 값을 선택합니다 (`No IAM Role` — 아무것도 선택하지 않은 상태).
17. [[Update IAM role]] 버튼을 클릭합니다.

> [!OUTPUT]
> "Successfully detached IAM role from instance" 또는 상단에 녹색 성공 배너가 표시됩니다.

---

### 단계 4: CloudFormation 스택 삭제

📍 **실행 위치: 로컬 PC (브라우저 — AWS 콘솔)**

> [!NOTE]
> 스택을 삭제하면 스택이 생성한 **모든** 리소스가 자동으로 함께 삭제됩니다:
> - `step5-2-ec2.yaml` 사용한 경우: EC2 + Security Group 삭제
> - `step5-2-ec2-with-vpc.yaml` 사용한 경우: EC2 + Security Group + VPC + Subnet 4개 + IGW + Route Table 모두 삭제

18. 상단 검색창에 `CloudFormation`을 입력하고 **CloudFormation** 서비스를 선택합니다.
19. 스택 목록에서 `s3-app-ec2`를 클릭하여 선택합니다 (라디오 버튼 또는 이름 클릭).
20. 우측 상단 [[Delete]] 버튼을 클릭합니다.
21. 확인 팝업이 표시됩니다. [[Delete stack]]을 클릭합니다.
22. 스택 상태가 `DELETE_IN_PROGRESS` → `DELETE_COMPLETE`로 변경될 때까지 기다립니다 (약 2~3분).
    - 자동 새로고침이 안 되면 🔄 버튼을 클릭하세요.

> [!OUTPUT]
> 스택이 `DELETE_COMPLETE` 상태로 변경되거나 목록에서 사라지면 정상입니다.

> [!TROUBLESHOOTING]
> | 증상 | 원인 | 해결 |
> |------|------|------|
> | `DELETE_FAILED` | IAM Role 미분리 | 단계 3을 먼저 수행 후 스택 삭제 재시도 |
> | `DELETE_FAILED` (다른 원인) | 리소스 의존 관계 | Events 탭에서 실패 리소스 확인 → 해당 리소스 수동 삭제 → 재시도 |

---

### 단계 5: IAM Role 삭제

📍 **실행 위치: 로컬 PC (브라우저 — AWS 콘솔)**

> [!NOTE]
> Role을 삭제하려면 먼저 연결된 정책(Policy)을 분리해야 합니다.

23. 상단 검색창에 `IAM`을 입력하고 **IAM** 서비스를 선택합니다.
24. 왼쪽 메뉴에서 **Roles**를 클릭합니다.
25. 검색창에 `ec2-s3-access-role`을 입력합니다.
26. `ec2-s3-access-role`을 클릭하여 상세 페이지로 이동합니다.
27. **Permissions policies** 섹션에서 `S3AppBucketPolicy` 오른쪽의 ✕ (Remove) 버튼을 클릭합니다.
28. 확인 팝업에서 [[Remove policy]]를 클릭합니다.

> [!OUTPUT]
> 정책이 분리되면 Permissions policies 목록이 비어집니다.

29. 왼쪽 메뉴에서 **Roles**를 다시 클릭하여 목록으로 돌아갑니다.
30. `ec2-s3-access-role` 왼쪽의 라디오 버튼을 선택합니다.
31. [[Delete]] 버튼을 클릭합니다.
32. 확인 필드에 `ec2-s3-access-role`을 정확히 입력합니다.
33. [[Delete]] 버튼을 클릭합니다.

> [!OUTPUT]
> "Role ec2-s3-access-role deleted" 메시지가 표시됩니다.

---

### 단계 6: IAM Policy 삭제

34. 왼쪽 메뉴에서 **Policies**를 클릭합니다.
35. 상단 **Filter policies** 드롭다운에서 `Customer managed`를 선택합니다 (AWS 관리형 정책 제외).
36. 검색창에 `S3AppBucketPolicy`를 입력합니다.
37. `S3AppBucketPolicy` 왼쪽의 라디오 버튼을 선택합니다.
38. **Actions** 드롭다운 → [[Delete]]를 클릭합니다.
39. 확인 필드에 `S3AppBucketPolicy`를 정확히 입력합니다.
40. [[Delete]] 버튼을 클릭합니다.

> [!OUTPUT]
> "Policy S3AppBucketPolicy deleted" 메시지가 표시됩니다.

---

### 단계 7: S3 테스트 파일 삭제

📍 **실행 위치: 로컬 PC (브라우저 — AWS 콘솔)**

41. 상단 검색창에 `S3`를 입력하고 **S3** 서비스를 선택합니다.
42. 버킷 목록에서 본인의 버킷(예: `{닉네임}-starter-app`)을 클릭합니다.
43. `test/` 폴더 왼쪽의 체크박스를 클릭합니다.
    - `public/travel/` 이미지도 더 이상 필요 없다면 함께 선택합니다.
44. [[Delete]] 버튼을 클릭합니다.
45. 확인 필드에 `permanently delete`를 입력합니다.
46. [[Delete objects]] 버튼을 클릭합니다.

> [!OUTPUT]
> "Successfully deleted X objects" 메시지가 표시됩니다.

> [!NOTE]
> **버킷 자체는 삭제하지 않습니다** — 다른 실습에서 재사용할 수 있습니다.

> [!TIP]
> 터미널에서 한번에 삭제할 수도 있습니다:
> ```bash
> aws s3 rm s3://{닉네임}-starter-app/test/ --recursive --profile s3-dev
> ```

---

### 단계 8: IAM 사용자 정리 (선택)

📍 **실행 위치: 로컬 PC (브라우저 — AWS 콘솔)**

> [!NOTE]
> 태스크 1에서 생성한 `s3-dev-user`와 Access Key를 정리합니다.  
> 이후 실습에서 S3를 다시 사용할 예정이라면 **이 단계를 건너뛰어도 됩니다**.

47. IAM 콘솔 왼쪽 메뉴에서 **Users**를 클릭합니다.
48. `s3-dev-user`를 클릭하여 상세 페이지로 이동합니다.
49. **Security credentials** 탭을 선택합니다.
50. **Access keys** 섹션에서 해당 키의 **Actions** → **Deactivate**를 클릭합니다.
51. 확인 후 다시 **Actions** → **Delete**를 클릭합니다.
52. (선택) 사용자 자체를 삭제하려면:
    - 왼쪽 메뉴에서 **Users**를 클릭합니다.
    - `s3-dev-user` 왼쪽의 체크박스를 선택합니다.
    - [[Delete]] 버튼을 클릭합니다.
    - 확인 필드에 `s3-dev-user`를 입력합니다.
    - [[Delete]] 버튼을 클릭합니다.

> [!TIP]
> 로컬의 AWS 자격 증명 파일도 정리하려면:
> ```bash
> # s3-dev 프로파일 섹션 확인
> cat ~/.aws/credentials
>
> # 필요 없으면 해당 [s3-dev] 섹션을 텍스트 에디터에서 삭제
> ```

---

### 단계 9: Tag Editor로 최종 확인

📍 **실행 위치: 로컬 PC (브라우저 — AWS 콘솔)**

53. 단계 1과 동일하게 **Tag Editor**에서 다시 검색합니다:
    - **Regions**: `ap-northeast-2`
    - **Tag key**: `Session`, **Tag value**: `5-2`
    - [[Search resources]] 클릭
54. 검색 결과가 비어있는지 확인합니다 (S3 버킷은 남아있을 수 있음 — 정상).

> [!OUTPUT]
> 결과가 비어있거나 S3 버킷만 표시되면 모든 리소스가 정상 정리된 것입니다.  
> 다른 리소스가 남아있다면 해당 리소스를 클릭하여 서비스 콘솔에서 수동 삭제합니다.

---

### 삭제 확인 체크리스트

| 확인 항목 | 확인 방법 | 정상 상태 |
| --------- | --------- | --------- |
| EC2 인스턴스 | EC2 콘솔 → Instances | `Terminated` |
| CloudFormation 스택 | CloudFormation 콘솔 | `DELETE_COMPLETE` 또는 목록에서 사라짐 |
| IAM Role | IAM → Roles → `ec2-s3-access-role` 검색 | 결과 없음 |
| IAM Policy | IAM → Policies → `S3AppBucketPolicy` 검색 | 결과 없음 |
| S3 테스트 파일 | S3 → 버킷 → `test/` 폴더 | 비어있음 |
| Tag Editor | `Session=5-2` 검색 | 결과 없음 (또는 S3 버킷만) |
| IAM 사용자 (선택) | IAM → Users → `s3-dev-user` | 삭제됨 또는 키 비활성화 |

> [!NOTE]
> Terminated 인스턴스는 약 1시간 후 콘솔 목록에서 자동으로 사라집니다.

> [!TIP]
> **키 페어는 삭제하지 마세요.** 비용이 발생하지 않으며, 다음 실습에서 재사용할 수 있습니다.

✅ **실습 종료**: 모든 리소스가 정리되었습니다.

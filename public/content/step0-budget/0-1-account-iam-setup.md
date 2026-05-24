---
title: 'AWS 계정 생성 및 IAM 사용자 설정'
week: 0
session: 1
awsServices:
  - AWS IAM
learningObjectives:
  - AWS 계정을 생성하고 무료 플랜을 선택할 수 있습니다.
  - Root 계정의 보안 위험을 이해하고 MFA를 설정할 수 있습니다.
  - IAM 사용자를 생성하고 관리자 권한을 부여할 수 있습니다.
  - IAM 사용자로 로그인하여 일상 작업을 수행할 수 있습니다.
prerequisites:
  - 이메일 주소
  - 신용카드 또는 체크카드 (본인 인증용, 무료 플랜 선택 시 과금 없음)
estimatedCost: 무료
---

이 실습에서는 AWS 계정을 생성하고, 보안 모범 사례에 따라 Root 계정을 보호한 뒤 일상 작업용 IAM 사용자를 생성합니다. 이후 모든 실습은 이 IAM 사용자로 진행합니다.

> [!WARNING]
> Root 계정은 AWS 계정의 모든 권한을 가진 최상위 계정입니다. Root 계정이 탈취되면 모든 리소스가 위험에 노출됩니다. **Root 계정은 초기 설정 후 일상 작업에 사용하지 마세요.**

## 태스크 1: AWS 계정 생성

> [!NOTE]
> 이미 AWS 계정이 있다면 이 태스크를 건너뛰고 태스크 2로 이동합니다.

1. 브라우저에서 [https://aws.amazon.com](https://aws.amazon.com)에 접속합니다.
2. [[무료 계정 생성]] 또는 [[Create an AWS Account]] 버튼을 클릭합니다.
3. **Root user email address**에 본인 이메일을 입력합니다.
4. **AWS account name**에 계정 이름을 입력합니다 (예: `my-aws-account`).
5. [[Verify email address]]를 클릭합니다.
6. 이메일로 전송된 인증 코드를 입력합니다.
7. Root 계정 비밀번호를 설정합니다.

> [!WARNING]
> Root 비밀번호는 최소 12자 이상, 대문자/소문자/숫자/특수문자를 포함하여 강력하게 설정하세요. 이 비밀번호는 계정의 최종 방어선입니다.

8. **Contact information** 페이지에서 연락처 정보를 입력합니다:
   - **Account type**: `Personal` 선택
   - 이름, 전화번호, 주소 입력
9. **Payment information** 페이지에서 카드 정보를 입력합니다.

> [!NOTE]
> 카드 등록은 본인 인증 목적입니다. 무료 플랜을 선택하면 유료 전환 전까지 과금되지 않습니다. 일부 카드에서 $1 임시 결제 후 취소될 수 있습니다.

10. **Identity verification** 페이지에서 전화번호 인증을 완료합니다.
11. **Select a support plan** 페이지에서 `Basic support - Free`를 선택합니다.
12. **Choose a plan** 페이지에서 **Free plan**을 선택합니다.

> [!CONCEPT] 무료 플랜 (Free Plan) 선택
> 2025년 7월 15일 이후 신규 가입자는 가입 시 무료 플랜 또는 유료 플랜을 선택합니다.
>
> - **무료 플랜**: 유료 전환 전까지 요금 없음. 학습 목적에 적합.
> - **유료 플랜**: 크레딧 소진 후 과금. 실제 프로젝트에 적합.
>
> 이 가이드에서는 **무료 플랜**을 선택합니다.

13. [[Complete sign up]]을 클릭합니다.
14. 계정 활성화 이메일을 확인합니다 (최대 수 분 소요).

✅ **태스크 완료**: AWS 계정이 생성되었습니다.

## 태스크 2: Root 계정 MFA 설정

MFA(Multi-Factor Authentication)를 설정하면 비밀번호가 유출되어도 계정을 보호할 수 있습니다.

> [!CONCEPT] MFA (다중 인증)
> 로그인 시 비밀번호 외에 추가 인증 수단(스마트폰 앱의 6자리 코드)을 요구합니다. 비밀번호가 유출되어도 MFA 기기 없이는 로그인할 수 없습니다.
>
> 지원하는 MFA 앱:
>
> - Google Authenticator (iOS/Android)
> - Microsoft Authenticator (iOS/Android)
> - Authy (iOS/Android/Desktop)

15. Root 계정으로 AWS Management Console에 로그인합니다.
16. 우측 상단의 **계정 이름**을 클릭하고 **Security credentials**를 선택합니다.
17. **Multi-factor authentication (MFA)** 섹션에서 [[Assign MFA device]]를 클릭합니다.
18. **Device name**에 `my-root-mfa`를 입력합니다.
19. **MFA device type**에서 **Authenticator app**을 선택합니다.
20. [[Next]]를 클릭합니다.
21. **Set up the authenticator app** 페이지에서:
    - 스마트폰의 인증 앱(Google Authenticator 등)을 엽니다.
    - 앱에서 QR 코드를 스캔합니다.
    - 앱에 표시되는 6자리 코드를 **MFA code 1**에 입력합니다.
    - 30초 후 새로 표시되는 6자리 코드를 **MFA code 2**에 입력합니다.
22. [[Add MFA]]를 클릭합니다.

> [!OUTPUT]
> "MFA device assigned successfully" 메시지가 표시됩니다.

> [!WARNING]
> MFA 기기(스마트폰)를 분실하면 Root 계정에 접근할 수 없습니다. 인증 앱의 백업 기능을 활용하거나, 복구 코드를 안전한 곳에 보관하세요.

✅ **태스크 완료**: Root 계정에 MFA가 설정되었습니다.

## 태스크 3: IAM 사용자 생성

Root 계정 대신 일상 작업에 사용할 IAM 사용자를 생성합니다.

> [!CONCEPT] Root 계정 vs IAM 사용자
>
> | 구분      | Root 계정             | IAM 사용자       |
> | --------- | --------------------- | ---------------- |
> | 권한      | 모든 권한 (제한 불가) | 부여된 권한만    |
> | 용도      | 초기 설정, 계정 관리  | 일상 작업, 개발  |
> | 삭제      | 불가                  | 가능             |
> | MFA       | 필수                  | 권장             |
> | 모범 사례 | 사용 최소화           | 일상 작업에 사용 |
>
> AWS는 Root 계정을 일상 작업에 사용하지 말 것을 강력히 권장합니다.

23. 상단 검색창에 `IAM`을 입력하고 **IAM** 서비스를 선택합니다.
24. 왼쪽 메뉴에서 **Users**를 클릭합니다.
25. [[Create user]]를 클릭합니다.
26. **User name**에 `admin-user`를 입력합니다.
27. ✅ **Provide user access to the AWS Management Console** 체크합니다.
28. **Console password** 섹션에서:
    - **Custom password**를 선택합니다.
    - 비밀번호를 입력합니다.
    - ☐ **Users must create a new password at next sign-in** 체크 해제 (본인이 사용할 것이므로)
29. [[Next]]를 클릭합니다.

### 권한 설정 (그룹 방식)

30. **Set permissions** 페이지에서 **Add user to group**을 선택합니다.
31. [[Create group]] 버튼을 클릭합니다.
32. **User group name**에 `Administrators`를 입력합니다.
33. 검색창에 `AdministratorAccess`를 입력합니다.
34. ✅ **AdministratorAccess** 정책을 체크합니다.
35. [[Create user group]]을 클릭합니다.
36. 생성된 `Administrators` 그룹이 체크되어 있는지 확인합니다.

> [!CONCEPT] 왜 사용자에게 직접 권한을 주지 않나요?
> AWS 모범 사례는 **사용자에게 직접 정책을 붙이지 않고, 그룹에 정책을 연결한 뒤 사용자를 그룹에 추가**하는 것입니다.
>
> - **관리 편의성**: 팀원이 추가되면 그룹에 넣기만 하면 됨 (정책을 일일이 붙일 필요 없음)
> - **일관성**: 같은 역할의 사용자들이 동일한 권한을 가짐
> - **감사 용이**: 그룹 단위로 권한을 파악할 수 있어 보안 감사가 쉬움
> - **변경 용이**: 정책을 변경하면 그룹 내 모든 사용자에게 즉시 반영

> [!NOTE]
> `AdministratorAccess`는 Billing을 제외한 모든 AWS 서비스에 대한 전체 권한을 부여합니다. 학습 목적에서는 이 정책이 편리합니다. 실무에서는 필요한 최소 권한만 부여하는 것이 모범 사례입니다.

37. [[Next]]를 클릭합니다.
38. **Review and create** 페이지에서 설정을 확인합니다:
    - User name: `admin-user`
    - Groups: `Administrators`
39. [[Create user]]를 클릭합니다.

> [!OUTPUT]
> 사용자가 생성되면 **Console sign-in URL**이 표시됩니다:
> `https://123456789012.signin.aws.amazon.com/console`
>
> 이 URL을 북마크해 두세요. IAM 사용자로 로그인할 때 사용합니다.

> [!TIP]
> Console sign-in URL의 숫자(`123456789012`)는 AWS 계정 ID입니다. IAM → Dashboard에서도 확인할 수 있으며, 계정 별칭(alias)을 설정하면 기억하기 쉬운 URL을 만들 수 있습니다.

✅ **태스크 완료**: IAM 사용자(`admin-user`)가 생성되었습니다.

## 태스크 4: IAM 사용자에 MFA 설정

IAM 사용자에도 MFA를 설정하여 보안을 강화합니다.

40. IAM 콘솔 → **Users** → `admin-user`를 클릭합니다.
41. **Security credentials** 탭을 선택합니다.
42. **Multi-factor authentication (MFA)** 섹션에서 [[Assign MFA device]]를 클릭합니다.
43. **Device name**에 `admin-user-mfa`를 입력합니다.
44. **Authenticator app**을 선택하고 [[Next]]를 클릭합니다.
45. 스마트폰 인증 앱에서 QR 코드를 스캔합니다.
46. 연속된 두 개의 MFA 코드를 입력합니다.
47. [[Add MFA]]를 클릭합니다.

> [!TIP]
> Root 계정과 IAM 사용자의 MFA는 별도로 관리됩니다. 인증 앱에서 두 개의 항목이 표시되며, 각각 다른 코드를 생성합니다. 구분하기 쉽도록 앱에서 이름을 설정하세요 (예: "AWS Root", "AWS Admin").

✅ **태스크 완료**: IAM 사용자에 MFA가 설정되었습니다.

## 태스크 5: IAM 사용자로 로그인 테스트

48. 현재 Root 계정에서 로그아웃합니다.
49. IAM 사용자 로그인 URL로 접속합니다:
    - `https://123456789012.signin.aws.amazon.com/console`
    - 또는 AWS 로그인 페이지에서 **IAM user** 선택 → Account ID 입력

50. 다음 정보로 로그인합니다:
    - **Account ID**: `123456789012` (본인 계정 ID)
    - **IAM user name**: `admin-user`
    - **Password**: 설정한 비밀번호
    - **MFA code**: 인증 앱의 6자리 코드

> [!OUTPUT]
> 로그인 성공 시 AWS Management Console 홈 화면이 표시됩니다. 우측 상단에 `admin-user @ 123456789012`로 표시됩니다.

51. 상단 검색창에 `EC2`를 입력하고 접속하여 권한이 정상 동작하는지 확인합니다.

> [!NOTE]
> 이후 모든 실습은 이 IAM 사용자(`admin-user`)로 진행합니다. Root 계정은 Billing 설정 변경이나 계정 삭제 등 특수한 경우에만 사용합니다.

✅ **태스크 완료**: IAM 사용자로 로그인하여 정상 동작을 확인했습니다.

## 태스크 6: Billing 접근 권한 활성화

IAM 사용자가 Billing 정보를 볼 수 있도록 Root 계정에서 권한을 활성화합니다. (Step 0-2 Budget 설정에 필요)

52. IAM 사용자에서 로그아웃합니다.
53. **Root 계정**으로 다시 로그인합니다.
54. 우측 상단 계정 이름 → **Account**를 클릭합니다.
55. 페이지를 스크롤하여 **IAM User and Role Access to Billing Information** 섹션을 찾습니다.
56. [[Edit]]를 클릭합니다.
57. ✅ **Activate IAM Access**를 체크합니다.
58. [[Update]]를 클릭합니다.

> [!NOTE]
> 이 설정을 활성화하지 않으면 IAM 사용자가 AdministratorAccess 권한이 있어도 Billing 페이지에 접근할 수 없습니다.

59. Root 계정에서 로그아웃합니다.
60. IAM 사용자(`admin-user`)로 다시 로그인합니다.

✅ **태스크 완료**: IAM 사용자의 Billing 접근 권한이 활성화되었습니다.

## 마무리

다음을 성공적으로 수행했습니다:

- AWS 계정을 생성하고 무료 플랜을 선택했습니다.
- Root 계정에 MFA를 설정하여 보안을 강화했습니다.
- IAM 사용자(`admin-user`)를 생성하고 관리자 권한을 부여했습니다.
- IAM 사용자에도 MFA를 설정했습니다.
- IAM 사용자로 로그인하여 정상 동작을 확인했습니다.
- Billing 접근 권한을 활성화했습니다.

> [!WARNING]
> **이후 모든 실습은 IAM 사용자(`admin-user`)로 진행합니다.** Root 계정은 다음 경우에만 사용하세요:
>
> - 계정 설정 변경 (이름, 이메일, 결제 정보)
> - IAM 사용자 Billing 접근 활성화/비활성화
> - 계정 해지
> - Support Plan 변경

# 🗑️ 리소스 정리

> [!NOTE]
> 이 실습에서 생성한 리소스는 모두 무료이므로 삭제하지 않아도 비용이 발생하지 않습니다.

---

### 단계 1: 리소스 유지 안내

이 실습에서 생성한 리소스는 삭제하지 않습니다.

- **IAM 사용자 (`admin-user`)**: 이후 모든 실습에서 사용합니다.
- **MFA 설정 (Root + IAM 사용자)**: 계정 보안을 위해 반드시 유지합니다.
- **Billing 접근 권한 설정**: 비용 모니터링을 위해 유지합니다.

> [!NOTE]
> IAM 사용자, MFA, Billing 접근 설정은 모두 무료입니다. 이후 모든 실습의 기반이 되므로 절대 삭제하지 마세요.

✅ **실습 종료**: 모든 리소스가 무료이며, 이후 실습을 위해 유지됩니다.

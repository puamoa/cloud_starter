---
title: 'AWS 계정 생성 및 IAM 사용자 설정'
week: 0
session: 1
awsServices:
  - AWS IAM
learningObjectives:
  - AWS 계정을 생성하고 무료 플랜을 선택할 수 있습니다.
  - 계정 별칭(Account Alias)을 설정하여 로그인 URL을 간소화할 수 있습니다.
  - Root 계정의 보안 위험을 이해하고 MFA를 설정할 수 있습니다.
  - IAM 그룹을 생성하고 IAM 사용자에 관리자 권한을 부여할 수 있습니다.
  - IAM 사용자로 로그인하여 MFA를 설정할 수 있습니다.
  - IAM 사용자에서 Billing 접근 권한을 활성화하고 비용을 확인할 수 있습니다.
prerequisites:
  - 이메일 주소
  - 신용카드 또는 체크카드 (본인 인증용, 무료 플랜 선택 시 과금 없음)
estimatedCost: 무료
---

이 실습에서는 AWS 계정을 생성하고, 보안 모범 사례에 따라 Root 계정을 보호한 뒤 일상 작업용 IAM 사용자를 생성합니다.  
이후 모든 실습은 이 IAM 사용자로 진행합니다.

> [!WARNING]
> Root 계정은 AWS 계정의 모든 권한을 가진 최상위 계정입니다. Root 계정이 탈취되면 모든 리소스가 위험에 노출됩니다.  
> **Root 계정은 초기 설정 후 일상 작업에 사용하지 마세요.**

## 태스크 1: AWS 계정 생성

> [!NOTE]
> 이미 AWS 계정이 있다면 이 태스크를 건너뛰고 태스크 2로 이동합니다.

1. 브라우저에서 [https://aws.amazon.com](https://aws.amazon.com)에 접속합니다.
2. 오른쪽 상단의 [[계정 생성]] 또는 [[Create account]] 버튼을 클릭합니다.

    <img src="/images/step0/0-1-step2-create-account.png" alt="AWS 계정 생성 버튼" class="guide-img-sm" />

3. **Root user email address**에 본인 이메일을 입력합니다.
4. **AWS account name**에 계정 이름을 입력합니다 (예: `my-aws-account`).
5. [[Verify email address]]를 클릭합니다.

    <img src="/images/step0/0-1-step5-verify-email.png" alt="Verify email address 클릭" class="guide-img-md" />

6. 이메일로 전송된 인증 코드를 입력하고 [[Verify]] 버튼을 클릭합니다.

    <img src="/images/step0/0-1-step6-verify-code.png" alt="인증 코드 입력 후 Verify" class="guide-img-md" />

### 1단계: 비밀번호 생성

7. **Root user password**에 비밀번호를 입력합니다.
8. **Confirm root user password**에 동일한 비밀번호를 다시 입력합니다.
9. "Matches"가 표시되면 [[Continue]]를 클릭합니다.

    <img src="/images/step0/0-1-step9-password.png" alt="비밀번호 설정 후 Continue" class="guide-img-md" />

> [!WARNING]
> Root 비밀번호는 최소 12자 이상, 대문자/소문자/숫자/특수문자를 포함하여 강력하게 설정하세요. 이 비밀번호는 계정의 최종 방어선입니다.

### 2단계: 계정 플랜 선택

10. **계정 플랜 선택** 페이지에서 **무료(6개월)** 플랜을 선택합니다.

> [!CONCEPT] 무료 플랜 vs 유료 플랜
>
> | 구분           | 무료(6개월)                                  | 유료                    |
> | -------------- | -------------------------------------------- | ----------------------- |
> | 크레딧         | 최대 200 USD (기본 $100 + 활동 $100)         | 동일                    |
> | 서비스 접근    | 일부 서비스                                  | 모든 AWS 서비스 및 기능 |
> | 크레딧 소진 후 | 유료 플랜으로 업그레이드 가능 (안 하면 해지) | 종량제 요금 부과        |
>
> 학습 목적이라면 **무료 플랜**을 선택합니다.

11. [[무료 플랜 선택]]을 클릭합니다.

    <img src="/images/step0/0-1-step11-plan-select.png" alt="무료 플랜 선택" class="guide-img-md" />

플랜을 선택하면 연락처 정보 입력 화면(2/5단계)이 표시됩니다.

12. **전체 이름**을 입력합니다.
13. **조직 이름**(선택 사항)은 비워두거나 입력합니다.
14. **국가 코드**에서 `🇰🇷 +82`를 선택하고, **전화 번호**를 입력합니다.
15. **국가 또는 리전**에서 `대한민국`을 선택합니다.
16. **주소 라인 1**에 도로명 주소를 입력합니다.
17. **주소 라인 2**(선택 사항)에 상세 주소를 입력합니다 (아파트, 동, 호수 등).
18. **시**를 입력합니다.
19. **시, 도 또는 리전**을 선택합니다.
20. **우편 번호**를 입력합니다.
21. **AWS 이용계약**을 읽었으며 이에 동의합니다 체크박스를 선택합니다.
22. [[동의 후 계속(2/5단계)]]을 클릭합니다.

    <img src="/images/step0/0-1-step22-contact-info.png" alt="연락처 정보 입력 완료" class="guide-img-md" />

> [!TIP]
> **기존 계정 (2025.07.15 이전 가입자)**: 플랜 선택 화면이 표시되지 않습니다.  
> 기존 계정은 "Legacy AWS Free Tier" 프로그램이 적용되어 가입일로부터 12개월간 서비스별 무료 한도가 제공됩니다.(예: EC2 t2.micro 750시간/월)  
> 이 가이드의 실습은 기존 계정으로도 동일하게 진행할 수 있습니다.

> [!WARNING]
> **"무료 플랜 대상이 아님" 메시지가 표시되는 경우**: 이전에 AWS 계정을 생성한 적이 있는 사용자 정보(이메일, 전화번호, 카드 등)로 가입하면  
> "무료 플랜은 AWS 신규 고객에게만 독점 제공됩니다"라는 메시지와 함께 자동으로 **유료 플랜**으로 업그레이드됩니다.  
> 이 경우:
>
> - 200 USD 크레딧이 적립되지 않음
> - 요금은 종량제 기반으로 즉시 부과
> - 프리 티어 한도를 넘거나 혜택이 만료되면 청구서 발급
>
> 이 상황에서는 AWS Budgets 설정(Step 0-2)을 반드시 먼저 진행하고, 실습 후 리소스를 즉시 정리하세요.

### 3단계: 결제 정보

23. **청구 국가**에서 `대한민국`을 선택합니다.
24. **신용카드 번호**를 입력합니다.
25. **만료 날짜**에서 월/년을 선택합니다.
26. **보안 코드(CVV/CVC)**는 현재 입력하지 않아도 됩니다 ("지금은 보안 코드가 필요하지 않습니다" 표시).
27. **카드 소유자 이름**을 입력합니다.
28. **청구지 주소**에서 `내 연락처 주소 사용`을 선택합니다 (2단계에서 입력한 주소가 자동 표시됨).
29. **이메일 주소**를 확인합니다 (AWS와의 거래를 위한 VAT 영수증 발송용).
30. [[계속(3/5단계)]]를 클릭합니다.

    <img src="/images/step0/0-1-step30-payment-info.png" alt="결제 정보 입력 완료" class="guide-img-md" />

> [!NOTE]
> AWS 인증 프로세스는 1 USD(또는 그에 상당하는 금액)를 3~5일간 예치하여 계정을 인증하고 사기 행위를 방지합니다.  
> 무료 플랜을 선택했으므로 유료 플랜으로 업그레이드할 때까지 요금이 발생하지 않습니다.

31. 카드사 인증 팝업이 나타나면 카드번호, 비밀번호, 생년월일을 입력합니다.
32. **서비스 이용에 대한 전체동의**를 체크합니다.
33. [[다음]]을 클릭하여 카드 인증을 완료합니다.

    <img src="/images/step0/0-1-step33-card-auth.png" alt="카드 인증 완료" class="guide-img-md" />

### 4단계: 자격 증명 확인

34. **국가 또는 리전 코드**에서 `대한민국 (+82)`를 선택합니다.
35. **휴대전화 번호**를 입력합니다.
36. [[SMS 전송]]를 클릭합니다.

    <img src="/images/step0/0-1-step36-sms-verify.png" alt="SMS 인증 코드 전송" class="guide-img-md" />

37. 수신된 인증 코드를 입력합니다.

### 5단계: 완료

38. "축하합니다!" 화면이 표시되면 계정 생성이 완료된 것입니다.

    <img src="/images/step0/0-1-step38-complete.png" alt="계정 생성 완료" class="guide-img-md" />

39. 계정 활성화 이메일을 확인합니다 (최대 수 분 소요).
40. [[AWS Management Console로 이동]]을 클릭합니다.

✅ **태스크 완료**: AWS 계정이 생성되었습니다.

> [!WARNING]
> 계정 생성이 완료되었습니다. 실습을 계속 진행하기 전에 이 가이드 하단의 [📚 참고: AWS 프리 티어 크레딧 주의사항](#reference) 섹션을 반드시 읽어주세요.  
> 크레딧이 소멸되는 조건, 유료 플랜 전환, 기존 가입자 안내 등 비용 사고를 예방하는 중요한 내용이 포함되어 있습니다.

## 태스크 1.5: 계정 별칭(Account Alias) 설정

계정 별칭을 설정하면 IAM 사용자 로그인 URL이 기억하기 쉬워지고, MFA 앱에서도 별칭으로 표시되어 여러 계정을 구분하기 편합니다.

41. [https://aws.amazon.com](https://aws.amazon.com)에 접속합니다.
42. 오른쪽 상단의 [[콘솔에 로그인]] 버튼을 클릭합니다.
43. **Root user**를 선택하고, 계정 생성 시 사용한 **이메일 주소**를 입력합니다.
44. [[Next]]를 클릭합니다.

    <img src="/images/step0/0-1-step44-root-login.png" alt="Root user 이메일 입력" class="guide-img-md" />

45. **보안 확인**(CAPTCHA)이 표시되면 지시에 따라 완료합니다.
46. **Password**에 Root 비밀번호를 입력하고 [[Sign in]]을 클릭합니다.

    <img src="/images/step0/0-1-step46-root-password.png" alt="Root 비밀번호 입력" class="guide-img-md" />

47. AWS Management Console 홈 화면이 표시되면 로그인 성공입니다.
48. 상단 검색창에 `IAM`을 입력하고 **IAM** 서비스를 선택합니다.

    <img src="/images/step0/0-1-step48-iam-dashboard.png" alt="IAM 서비스 검색" class="guide-img-md" />

49. IAM Dashboard 우측의 **AWS Account** 섹션에서 **Account Alias** 옆의 [[Create]]를 클릭합니다.

    <img src="/images/step0/0-1-step49-create-alias.png" alt="Account Alias Create 클릭" class="guide-img-md" />
50. **Create alias for AWS account** 팝업에서 **Preferred alias**에 별칭을 입력합니다 (예: `my-aws-lab`).

> [!NOTE]
>
> - 최대 63자, 영문 소문자(a-z), 숫자(0-9), 하이픈(-)만 사용 가능
> - 전 세계적으로 고유해야 합니다 (이미 사용 중이면 다른 이름 시도)
> - 입력하면 아래에 **New sign-in URL**이 미리보기로 표시됩니다

51. [[Create alias]]를 클릭합니다.

    <img src="/images/step0/0-1-step51-alias-created.png" alt="Alias 생성 완료" class="guide-img-sm" />

> [!NOTE]
> "Alias [별칭] created for this account." 성공 메시지가 표시됩니다.  
> IAM Dashboard의 **AWS Account** 섹션에서 **Account Alias**에 설정한 별칭이 표시되고,  
> **Sign-in URL for IAM users in this account**가 `https://[별칭].signin.aws.amazon.com/console`로 변경됩니다.

> [!TIP]
> MFA 앱에서 이 별칭이 계정 이름으로 표시되므로, 나중에 여러 AWS 계정을 구분할 때 유용합니다.  
> 별칭을 설정한 후에도 기존 계정 ID 기반 URL(`https://123456789012.signin.aws.amazon.com/console`)은 계속 사용할 수 있습니다.

✅ **태스크 완료**: 계정 별칭이 설정되었습니다.

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

> [!NOTE]
> 태스크 1.5에서 이미 Root 계정으로 로그인한 상태라면 53번부터 진행하세요.

52. 우측 상단의 **계정 이름**을 클릭하고 **Security credentials**를 선택합니다.

    <img src="/images/step0/0-1-step52-security-credentials.png" alt="Security credentials 선택" class="guide-img-md" />

53. **Multi-factor authentication (MFA)** 섹션에서 [[Assign MFA device]]를 클릭합니다.

    <img src="/images/step0/0-1-step53-assign-mfa.png" alt="Assign MFA device 클릭" class="guide-img-md" />

54. **Device name**에 `my-root-mfa`를 입력합니다.
55. **MFA device type**에서 **Authenticator app**을 선택합니다.
56. [[Next]]를 클릭합니다.

    <img src="/images/step0/0-1-step56-mfa-next.png" alt="MFA device 설정" class="guide-img-md" />

57. **Set up the authenticator app** 페이지에서:
    - [[Show QR code]]를 클릭하여 QR 코드를 표시합니다.
    - 스마트폰의 인증 앱(Google Authenticator 등)을 엽니다.
    - 앱에서 QR 코드를 스캔합니다.
    - 앱에 표시되는 6자리 코드를 **MFA code 1**에 입력합니다.
    - 30초 후 새로 표시되는 6자리 코드를 **MFA code 2**에 입력합니다.

    <img src="/images/step0/0-1-step57-qr-code.png" alt="QR 코드 표시" class="guide-img-sm" />

    <img src="/images/step0/0-1-step57-mfa-codes.png" alt="MFA 코드 입력" class="guide-img-md" />

58. [[Add MFA]]를 클릭합니다.

> [!OUTPUT]
> "MFA device assigned successfully" 메시지가 표시됩니다.

> [!WARNING]
> MFA 기기(스마트폰)를 분실하면 Root 계정에 접근할 수 없습니다.  
> 인증 앱의 백업 기능을 활용하거나, 복구 코드를 안전한 곳에 보관하세요.

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

59. 상단 검색창에 `IAM`을 입력하고 **IAM** 서비스를 선택합니다.
60. 왼쪽 메뉴에서 **IAM Users**를 클릭합니다.
61. [[Create user]]를 클릭합니다.

    <img src="/images/step0/0-1-step61-create-user.png" alt="Create user 클릭" class="guide-img-md" />

62. **User name**에 `admin-user`를 입력합니다.
63. ✅ **Provide user access to the AWS Management Console** 체크합니다.
64. **Console password** 섹션에서:
    - **Custom password**를 선택합니다.
    - 비밀번호를 입력합니다.
    - ☐ **Users must create a new password at next sign-in** 체크 해제 (본인이 사용할 것이므로)

> [!TIP]
> 실무에서 다른 팀원에게 IAM 사용자를 만들어줄 때는 이 옵션을 체크하세요.  
>  첫 로그인 시 임시 비밀번호를 본인만 아는 비밀번호로 변경하도록 강제하여 보안을 유지할 수 있습니다.

65. [[Next]]를 클릭합니다.

    <img src="/images/step0/0-1-step65-user-details.png" alt="User details 설정 완료" class="guide-img-md" />

### 권한 설정 (그룹 방식)

66. **Set permissions** 페이지에서 **Add user to group**을 선택합니다.
67. [[Create group]] 버튼을 클릭합니다.
68. 팝업 창의 **User group name**에 `Administrators`를 입력합니다.
69. 검색창에 `AdministratorAccess`를 입력합니다.
70. ✅ **AdministratorAccess** 정책을 체크합니다.
71. [[Create user group]]을 클릭합니다.

    <img src="/images/step0/0-1-step71-create-group.png" alt="Create user group" class="guide-img-sm" />

    <img src="/images/step0/0-1-step71-group-checked.png" alt="그룹 체크 확인" class="guide-img-sm" />

72. 생성된 `Administrators` 그룹이 체크되어 있는지 확인합니다. 체크되어 있지 않으면 생성된 그룹을 체크합니다.

> [!CONCEPT] 왜 사용자에게 직접 권한을 주지 않나요?
> AWS 모범 사례는 **사용자에게 직접 정책을 붙이지 않고, 그룹에 정책을 연결한 뒤 사용자를 그룹에 추가**하는 것입니다.
>
> - **관리 편의성**: 팀원이 추가되면 그룹에 넣기만 하면 됨 (정책을 일일이 붙일 필요 없음)
> - **일관성**: 같은 역할의 사용자들이 동일한 권한을 가짐
> - **감사 용이**: 그룹 단위로 권한을 파악할 수 있어 보안 감사가 쉬움
> - **변경 용이**: 정책을 변경하면 그룹 내 모든 사용자에게 즉시 반영
> - **퇴사/이동 처리**: 사용자를 그룹에서 제거하거나 삭제해도 그룹과 다른 멤버에게는 영향 없음

> [!NOTE]
> `AdministratorAccess`는 Billing을 제외한 모든 AWS 서비스에 대한 전체 권한을 부여합니다.  
> 학습 목적에서는 이 정책이 편리합니다. 실무에서는 필요한 최소 권한만 부여하는 것이 모범 사례입니다.

73. [[Next]]를 클릭합니다.

    <img src="/images/step0/0-1-step73-next-permissions.png" alt="권한 설정 완료 후 Next" class="guide-img-md" />

74. **Review and create** 페이지에서 설정을 확인합니다:
    - User name: `admin-user`
    - Groups: `Administrators`

    <img src="/images/step0/0-1-step74-review-create.png" alt="Review and create 확인" class="guide-img-md" />

75. [[Create user]]를 클릭합니다.

    <img src="/images/step0/0-1-step75-user-created.png" alt="User 생성 완료" class="guide-img-md" />

> [!NOTE]
> "User created successfully" 메시지와 함께 **Retrieve password** 페이지가 표시됩니다.  
> 이 페이지에서 다음 정보를 확인할 수 있습니다:
>
> - **Console sign-in URL**: `https://[별칭].signin.aws.amazon.com/console`
> - **User name**: `admin-user`
> - **Console password**: `**************` ([[Show]]를 클릭하면 확인 가능)
>
> 이 정보는 이 화면에서만 확인할 수 있습니다.

> [!TIP]
>
> - [[Download .csv file]]: 로그인 정보(URL, 사용자명, 비밀번호)를 CSV 파일로 저장합니다. 다른 사용자에게 계정을 전달할 때 유용합니다.
> - [[Email sign-in instructions]]: 사용자에게 로그인 안내를 이메일로 직접 보낼 수 있습니다.
> - 비밀번호는 이 화면을 벗어나면 다시 확인할 수 없으므로 반드시 저장하세요.

✅ **태스크 완료**: IAM 사용자(`admin-user`)가 생성되었습니다.

## 태스크 4: IAM 사용자로 로그인 및 MFA 설정

Root 계정에서 로그아웃하고, 생성한 IAM 사용자로 로그인한 뒤 본인이 직접 MFA를 설정합니다.

76. **시크릿 창**(Chrome: Ctrl+Shift+N / Safari: Cmd+Shift+N) 또는 **다른 브라우저**를 열어 IAM 사용자로 로그인합니다.

> [!TIP]
> Root 계정은 태스크 5(Billing 접근 권한 활성화)에서 다시 사용하므로,  
> 기존 브라우저의 Root 세션을 유지한 채 별도 창에서 IAM 사용자로 로그인하면 편리합니다.

77. IAM 사용자 로그인 URL로 접속합니다:
    - `https://[별칭].signin.aws.amazon.com/console`
    - 또는 AWS 로그인 페이지에서 **IAM user** 선택 → Account ID 또는 별칭 입력

78. 다음 정보로 로그인합니다:
    - **Account ID**: 계정 별칭 또는 12자리 계정 ID
    - **IAM user name**: `admin-user`
    - **Password**: 태스크 3에서 설정한 비밀번호

    <img src="/images/step0/0-1-step78-iam-login.png" alt="IAM 사용자 로그인" class="guide-img-md" />

79. 로그인 후 우측 상단의 **계정 이름**을 클릭하고 **Security credentials**를 선택합니다.

    <img src="/images/step0/0-1-step79-security-creds.png" alt="Security credentials 선택" class="guide-img-md" />

80. **Multi-factor authentication (MFA)** 섹션에서 [[Assign MFA device]]를 클릭합니다.

    <img src="/images/step0/0-1-step80-assign-mfa-iam.png" alt="Assign MFA device" class="guide-img-md" />

81. **Device name**에 `admin-user-mfa`를 입력합니다.
82. **Authenticator app**을 선택하고 [[Next]]를 클릭합니다.
83. [[Show QR code]]를 클릭하여 QR 코드를 표시합니다.
84. 스마트폰 인증 앱에서 QR 코드를 스캔합니다.
85. 앱에 표시되는 6자리 코드를 **MFA code 1**에 입력합니다.
86. 30초 후 새로 표시되는 6자리 코드를 **MFA code 2**에 입력합니다.

    <img src="/images/step0/0-1-step86-mfa-codes-iam.png" alt="MFA 코드 입력" class="guide-img-md" />

87. [[Add MFA]]를 클릭합니다.

> [!TIP]
> Root 계정과 IAM 사용자의 MFA는 별도로 관리됩니다.  
> 인증 앱에서 두 개의 항목이 표시되며, 각각 다른 코드를 생성합니다.  
> 계정 별칭을 설정했으므로 앱에서 별칭으로 구분할 수 있습니다.

88. 상단 검색창에 `EC2`를 입력하고 접속하여 권한이 정상 동작하는지 확인합니다.

    <img src="/images/step0/0-1-step88-ec2-check.png" alt="EC2 접속 권한 확인" class="guide-img-md" />

> [!NOTE]
> 이후 모든 실습은 이 IAM 사용자(`admin-user`)로 진행합니다.  
> Root 계정은 Billing 설정 변경이나 계정 삭제 등 특수한 경우에만 사용합니다.

✅ **태스크 완료**: IAM 사용자로 로그인하고 MFA가 설정되었습니다.

## 태스크 5: Billing 접근 권한 활성화

IAM 사용자가 Billing 정보를 볼 수 있도록 Root 계정에서 권한을 활성화합니다.

> [!NOTE]
> 태스크 4에서 시크릿 창/다른 브라우저를 사용했다면, Root 계정이 로그인된 기존 브라우저에서 진행하세요.

89. Root 계정이 로그인된 브라우저에서 우측 상단 계정 이름 → **Account**를 클릭합니다.

    <img src="/images/step0/0-1-step89-account-menu.png" alt="Account 메뉴 클릭" class="guide-img-sm" />

90. 페이지를 스크롤하여 **IAM user and role access to Billing information** 섹션을 찾습니다.
91. [[Edit]]를 클릭합니다.

    <img src="/images/step0/0-1-step91-billing-edit.png" alt="Billing 접근 Edit 클릭" class="guide-img-md" />

92. ✅ **Activate IAM Access**를 체크합니다.

    <img src="/images/step0/0-1-step92-activate-iam.png" alt="Activate IAM Access 체크" class="guide-img-md" />

93. [[Update]]를 클릭한 후 **Activated** 상태인지 확인합니다.

    <img src="/images/step0/0-1-step93-activated.png" alt="Activated 상태 확인" class="guide-img-md" />

> [!NOTE]
> 이 설정을 활성화하지 않으면 IAM 사용자가 AdministratorAccess 권한이 있어도 Billing 페이지에 접근할 수 없습니다.

✅ **태스크 완료**: IAM 사용자의 Billing 접근 권한이 활성화되었습니다.

## 태스크 6: IAM 사용자에서 Billing 확인

IAM 사용자로 Billing 페이지에 접근할 수 있는지 확인합니다.

94. IAM 사용자(`admin-user`)로 로그인된 브라우저에서 상단 검색창에 `Billing`을 입력합니다.
95. **Billing and Cost Management**를 선택합니다.

    <img src="/images/step0/0-1-step95-billing-dashboard.png" alt="Billing 대시보드" class="guide-img-md" />

96. Billing 대시보드가 정상적으로 표시되는지 확인합니다.

> [!TIP]
> **Billing and Cost Management 주요 메뉴:**
>
> | 카테고리                    | 메뉴                   | 설명                                       |
> | --------------------------- | ---------------------- | ------------------------------------------ |
> | **Billing and Payments**    | Bills                  | 월별 청구서 상세 내역                      |
> |                             | Payments               | 결제 내역 및 결제 수단 관리                |
> |                             | Credits                | 보유 크레딧 잔액 및 사용 내역 확인         |
> | **Cost and Usage Analysis** | Cost Explorer          | 서비스별/일별/리전별 비용 시각화           |
> |                             | Free Tier              | 프리 티어 사용량 및 크레딧 소진율 확인     |
> |                             | Cost Anomaly Detection | 비정상적 비용 증가 자동 감지               |
> | **기타**                    | Budgets                | 예산 설정 및 알림 관리 (Step 0-2에서 설정) |

> [!NOTE]
> Billing 페이지가 접근 거부되면 태스크 5의 IAM Access 활성화가 정상적으로 완료되었는지 확인하세요.  
> 활성화 후 반영까지 몇 분이 소요될 수 있습니다.

✅ **태스크 완료**: IAM 사용자에서 Billing 접근이 확인되었습니다.

## 마무리

다음을 성공적으로 수행했습니다:

- AWS 계정을 생성하고 무료 플랜을 선택했습니다.
- 계정 별칭을 설정하여 로그인 URL을 간소화했습니다.
- Root 계정에 MFA를 설정하여 보안을 강화했습니다.
- IAM 그룹(`Administrators`)을 생성하고 IAM 사용자(`admin-user`)에 관리자 권한을 부여했습니다.
- IAM 사용자로 로그인하여 MFA를 설정했습니다.
- Billing 접근 권한을 활성화하고 IAM 사용자에서 확인했습니다.

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

---

## 📚 참고: AWS 프리 티어 크레딧 주의사항

계정 생성 후 프리 티어/크레딧을 유지하기 위해 반드시 알아야 할 사항입니다.

### 크레딧이 삭제되거나 사용 불가한 조건

| 조건 | 결과 |
| ---- | ---- |
| **AWS Organization에 참여** | 무료 플랜 계정이 Organization에 초대되어 참여하면 프리 티어 크레딧이 **즉시 소멸**됩니다. |
| **무료 플랜 만료** (가입 후 6개월) | 크레딧 잔액이 남아있어도 무료 플랜이 종료되며, 유료 플랜으로 업그레이드하지 않으면 서비스 접근이 제한됩니다. |
| **크레딧 전액 소진** | 무료 플랜이 즉시 종료됩니다. |
| **계정 간 양도** | 크레딧은 다른 AWS 계정으로 양도할 수 없습니다. |

> [!WARNING]
> **Organization 참여 주의**:  
> 회사나 교육 기관에서 "Organization에 초대"를 받았을 때, 무료 플랜 계정으로 참여하면 크레딧이 사라집니다.  
> 반드시 별도 계정을 사용하세요.

### 유료 플랜 전환 관련

무료 플랜 만료(6개월) 또는 더 많은 AWS 서비스가 필요할 때 유료 플랜으로 전환할 수 있습니다.

- 무료 플랜 → 유료 플랜 업그레이드 시 **잔여 크레딧은 유지**됩니다. (소멸 아님)
- 유료 플랜은 크레딧 소진 후 **종량제 과금**이 시작됩니다.
- 유료 플랜에서 다시 무료 플랜으로 **다운그레이드는 불가**합니다.

**전환 방법:**  
AWS 콘솔에서 Billing → Account → **Upgrade to paid plan** 페이지에 접근하면 아래와 같은 화면이 표시됩니다.
    <img src="/images/step0/0-1-upgrade-plan.png" alt="Upgrade to paid plan 화면" class="guide-img-sm" />

[[Upgrade plan]]을 클릭하면 전환이 완료됩니다.
    <img src="/images/step0/0-1-upgrade-complete.png" alt="유료 플랜 전환 완료" class="guide-img-sm" />

> [!NOTE]
> 전환 후에도 잔여 크레딧은 그대로 사용 가능합니다. (단, 위에서 안내한 Organization 참여 등 크레딧 소멸 조건에 해당하지 않는 경우)  
> 크레딧이 모두 소진된 이후부터 종량제 요금이 청구됩니다.

### 기존 가입자 안내 (2025.07.15 이전 가입)

기존에 AWS 계정을 생성한 적이 있는 사용자 정보(이메일, 전화번호, 카드 등)로 새 계정을 가입하면 아래와 같은 화면이 표시됩니다.
    <img src="/images/step0/0-1-free-plan-unavailable.png" alt="무료 플랜을 이용할 수 없습니다" class="guide-img-sm" />

> [!WARNING]
> **"무료 플랜을 이용할 수 없습니다"** 메시지가 표시되면 자동으로 **유료 플랜**으로 업그레이드됩니다.  
> 이 경우:
>
> - 200 USD 크레딧이 지급되지 않습니다.
> - 요금은 종량제 기반으로 즉시 부과됩니다.
> - 프리 티어 한도를 넘거나 혜택이 만료되면 청구서가 발급됩니다.
>
> 이 상황에서는 **AWS Budgets 설정(Step 0-2)을 반드시 먼저 진행**하고, 실습 후 리소스를 즉시 정리하세요.  
> 비용 관련 문의 사항은 과정 제작자에게 문의해주세요.

> [!TIP]
> 자세한 내용은 [AWS 프리 티어 FAQ](https://aws.amazon.com/ko/free/free-tier-faqs/)를 참고하세요.

---
title: '보안과 자격 증명 관리 이론'
week: 6
session: 0
type: theory
learningObjectives:
  - Spring Boot와 Spring MVC 레거시의 설정 구조 차이를 설명할 수 있습니다.
  - '@Profile'을 사용하여 환경별 설정을 분리할 수 있습니다.
  - JDBC 드라이버(log4jdbc vs 일반)의 차이와 URL 규칙을 이해할 수 있습니다.
  - 인증(Authentication)과 인가(Authorization)의 차이를 설명할 수 있습니다.
  - 대칭키와 비대칭키 암호화 원리를 이해할 수 있습니다.
  - KMS(Key Management Service) 개념을 이해할 수 있습니다.
  - 비밀값 관리의 중요성과 하드코딩 위험을 설명할 수 있습니다.
  - 환경 변수와 비밀 저장소를 비교할 수 있습니다.
  - 최소 권한 원칙(Principle of Least Privilege)을 설명할 수 있습니다.
  - Zero Trust 보안 모델을 이해할 수 있습니다.
---

# 보안과 자격 증명 관리 이론

---

## 1. Spring 설정 구조 이해

> [!CONCEPT] 왜 설정 구조를 먼저 알아야 하나?
> 이번 Step부터 **로컬 개발 환경**과 **AWS 배포 환경**에서 설정이 달라집니다.  
> DB 접속 정보, API 키 등이 환경마다 다르고, 관리 방식도 다릅니다.  
> 이를 안전하게 처리하려면 Spring의 설정 구조를 이해하고, 환경별로 분리하는 방법을 알아야 합니다.

### Spring Boot vs Spring MVC 레거시 설정 비교

| 항목 | Spring Boot | Spring MVC 레거시 |
| ---- | ----------- | ----------------- |
| 설정 방식 | 자동 설정 (Auto-configuration) | 수동 설정 (@Configuration 클래스 또는 XML) |
| DataSource | `application.properties`에 작성하면 자동 생성 | `@Bean` 메서드로 직접 생성 |
| 트랜잭션 | `@EnableTransactionManagement` 자동 | 수동 설정 필요 |
| 서블릿 등록 | 내장 Tomcat이 자동 처리 | WebConfig에서 직접 등록 |
| 설정 파일 | `application.properties` 또는 `application.yml` | `application.properties` + Java Config 클래스들 |
| 환경 분리 | `application-{profile}.properties` | `@Profile` 어노테이션 |

### Spring Boot 설정 구조

Boot는 **Convention over Configuration** 철학으로, 대부분의 설정을 자동으로 처리합니다:

```
Spring Boot 프로젝트
├── src/main/resources/
│   ├── application.properties            ← DB, 서버 포트 등 모든 설정
│   ├── application-local.properties      ← 로컬 전용 설정 (선택)
│   └── application-aws.properties        ← AWS 배포 전용 설정 (선택)
└── src/main/java/
    └── com/example/demo/
        ├── DemoApplication.java          ← @SpringBootApplication (자동 설정 시작점)
        └── config/
            └── (필요할 때만 추가)        ← 자동 설정으로 부족할 때 직접 작성
```

```properties
# application.properties — 이것만으로 DataSource가 자동 생성됨
spring.datasource.url=jdbc:mysql://localhost:3306/mydb
spring.datasource.username=admin
spring.datasource.password=1234
spring.datasource.driver-class-name=com.mysql.cj.jdbc.Driver
```

> [!TIP]
> Boot에서는 `@Configuration` 클래스를 직접 작성하지 않아도 대부분 동작합니다.  
> 자동 설정을 **덮어쓰고 싶을 때만** (예: Parameter Store에서 값을 가져올 때) 직접 Bean을 정의합니다.

### Spring MVC 레거시 설정 구조

레거시에서는 **모든 설정을 개발자가 직접** 작성합니다:

```
Spring MVC 레거시 프로젝트
├── src/main/resources/
│   └── application.properties           ← DB 접속 정보 등 외부 설정값
└── src/main/java/
    └── org/scoula/config/
        ├── WebConfig.java               ← 웹 애플리케이션 초기화 (web.xml 대체)
        ├── RootConfig.java              ← 비즈니스 계층 설정 (DataSource, MyBatis, 서비스)
        ├── ServletConfig.java           ← 웹 계층 설정 (Controller, ViewResolver)
        └── SecurityConfig.java          ← 보안 설정 (인증/인가)
```

### 각 설정 파일의 역할

> [!CONCEPT] WebConfig — 모든 설정의 시작점
> `WebConfig`는 `AbstractAnnotationConfigDispatcherServletInitializer`를 상속하며, 기존 `web.xml`의 역할을 대체합니다.  
> 여기서 **어떤 설정 클래스를 어디에 등록할지** 결정합니다.
>
> ```java
> public class WebConfig extends AbstractAnnotationConfigDispatcherServletInitializer {
>
>     @Override
>     protected Class<?>[] getRootConfigClasses() {
>         // 비즈니스 계층 설정 — 앱 전체에서 공유
>         return new Class[] { RootConfig.class, SecurityConfig.class };
>     }
>
>     @Override
>     protected Class<?>[] getServletConfigClasses() {
>         // 웹 계층 설정 — DispatcherServlet에서만 사용
>         return new Class[] { ServletConfig.class };
>     }
>
>     @Override
>     protected String[] getServletMappings() {
>         return new String[] { "/" };
>     }
> }
> ```

| 설정 클래스 | 역할 | 등록 위치 | 주요 내용 |
| ----------- | ---- | --------- | --------- |
| **WebConfig** | 앱 초기화 (web.xml 대체) | — (Servlet 컨테이너가 자동 감지) | Root/Servlet 설정 등록 |
| **RootConfig** | 비즈니스 계층 | `getRootConfigClasses()` | DataSource, MyBatis, Service, 트랜잭션 |
| **ServletConfig** | 웹 계층 | `getServletConfigClasses()` | Controller, ViewResolver, 인터셉터 |
| **SecurityConfig** | 보안 | `getRootConfigClasses()` | 인증/인가, 필터 체인 |

> [!NOTE]
> **클래스 이름은 관례일 뿐 강제가 아닙니다.**  
> `RootConfig`를 `AppConfig`로, `ServletConfig`를 `WebMvcConfig`로 바꿔도 동작합니다.  
> 중요한 것은 **역할과 등록 위치**입니다.

### RootConfig 상세 구조 (현재 백엔드 프로젝트 기준)

```java
@Configuration
@PropertySource({"classpath:/application.properties"})    // 외부 설정 파일 로드
@MapperScan(basePackages = {"org.scoula.board.mapper"})   // MyBatis Mapper 스캔
@ComponentScan(basePackages = {"org.scoula.config", ...}) // Bean 자동 스캔
@EnableTransactionManagement                               // 트랜잭션 활성화
public class RootConfig {

    @Value("${jdbc.url}") String url;      // application.properties에서 값 주입

    @Bean
    public DataSource dataSource() { ... }           // DB 연결 풀

    @Bean
    public SqlSessionFactory sqlSessionFactory() { ... }  // MyBatis 설정

    @Bean
    public DataSourceTransactionManager transactionManager() { ... }  // 트랜잭션
}
```

> [!CONCEPT] @PropertySource + @Value 흐름
> ```
>  application.properties           @Value("${jdbc.url}")          DataSource Bean
> ┌──────────────────────┐         ┌──────────────────┐          ┌───────────────┐
> │ jdbc.url=localhost.. │ ──────→ │ String url 필드  │ ──────→  │ setJdbcUrl()  │
> │ jdbc.password=1234   │         │ String password  │          │ setPassword() │ 
> └──────────────────────┘         └──────────────────┘          └───────────────┘
> ```
> `@PropertySource`로 파일을 로드하고, `@Value`로 개별 값을 필드에 주입합니다.

### @ComponentScan과 설정 클래스 자동 등록

외부에 별도 `@Configuration` 클래스를 만들면, `@ComponentScan`이 자동으로 찾아서 등록합니다:

```java
// RootConfig.java
@ComponentScan(basePackages = {"org.scoula.config", ...})
//                              ↑ 이 패키지 안의 @Configuration 클래스를 자동 스캔
```

```
org/scoula/config/
├── RootConfig.java              ← @ComponentScan 선언
├── LocalDataSourceConfig.java   ← @Configuration → 자동 등록됨
├── AwsDataSourceConfig.java     ← @Configuration → 자동 등록됨
└── ParameterStoreService.java   ← @Component → 자동 등록됨
```

> [!CONCEPT] @ComponentScan이 스캔하는 대상
> `@ComponentScan`은 지정된 패키지 안의 다음 어노테이션이 붙은 클래스를 **모두** Bean으로 등록합니다:
>
> | 어노테이션 | 용도 | 예시 |
> | ---------- | ---- | ---- |
> | `@Component` | 범용 Bean | 유틸리티, 헬퍼 |
> | `@Service` | 비즈니스 로직 | BoardService |
> | `@Repository` | 데이터 접근 | BoardMapper |
> | `@Configuration` | 설정 클래스 | DataSourceConfig |
> | `@Controller` | 웹 요청 처리 | BoardController |
>
> 따라서 **WebConfig에 직접 등록하지 않아도**, `@ComponentScan` 범위 안에 있으면 자동으로 Spring 컨테이너에 등록됩니다.

> [!TIP]
> 새 설정 파일을 추가할 때 확인할 것:
>
> 1. 파일의 패키지가 `@ComponentScan`의 `basePackages`에 포함되는지
> 2. 클래스에 `@Configuration` (또는 `@Component`)이 붙어있는지
>
> 이 두 조건만 만족하면 별도 등록 없이 자동으로 인식됩니다.

### 설정이 퍼져나가는 전체 흐름

Spring 레거시에서 Bean 등록은 **트리 구조**로 퍼져나갑니다:

```
Servlet Container (Tomcat 시작)
  │
  └── WebConfig (시작점 — web.xml 대체)
        │
        ├── getRootConfigClasses() ─── 비즈니스 계층 (앱 전체 공유)
        │     │
        │     ├── RootConfig
        │     │     │
        │     │     └── @ComponentScan(basePackages = {...})
        │     │           │
        │     │           ├── [설정 클래스] @Configuration
        │     │           │     ├── LocalDataSourceConfig
        │     │           │     ├── AwsDataSourceConfig
        │     │           │     └── ParameterStoreService (@Component)
        │     │           │
        │     │           ├── [서비스 계층] @Service
        │     │           │     ├── BoardService
        │     │           │     ├── MemberService
        │     │           │     └── TravelService
        │     │           │
        │     │           ├── [데이터 접근] @MapperScan
        │     │           │     ├── BoardMapper (MyBatis)
        │     │           │     ├── MemberMapper
        │     │           │     └── TravelMapper
        │     │           │
        │     │           └── [유틸리티] @Component
        │     │                 └── FileUtil 등
        │     │
        │     └── SecurityConfig
        │           └── 인증/인가 필터, UserDetailsService 등
        │
        └── getServletConfigClasses() ─── 웹 계층 (DispatcherServlet 전용)
              │
              └── ServletConfig
                    │
                    └── @ComponentScan(basePackages = {"org.scoula.controller"})
                          │
                          ├── [컨트롤러] @Controller / @RestController
                          │     ├── BoardController
                          │     ├── MemberController
                          │     └── TravelController
                          │
                          └── [웹 설정]
                                ├── ViewResolver (JSP/Thymeleaf)
                                ├── MultipartResolver (파일 업로드)
                                └── Interceptor (인터셉터)
```

> [!CONCEPT] Root Context vs Servlet Context
>
> | 구분 | Root Context | Servlet Context |
> | ---- | ------------ | --------------- |
> | 설정 | RootConfig, SecurityConfig | ServletConfig |
> | Bean | Service, Repository, DataSource | Controller, ViewResolver |
> | 범위 | 앱 전체에서 공유 | DispatcherServlet에서만 사용 |
> | 접근 | Servlet Context에서 Root Bean 접근 **가능** | Root에서 Servlet Bean 접근 **불가** |
>
> Controller(Servlet Context)에서 Service(Root Context)를 `@Autowired`로 주입받을 수 있지만,  
> 반대로 Service에서 Controller를 주입받을 수는 없습니다.

> [!TIP]
> **핵심 원리**: WebConfig에서 설정 클래스를 직접 등록하고, 각 설정 클래스의 `@ComponentScan`이 하위 Bean들을 자동으로 끌어옵니다.  
> 새 파일을 추가할 때 WebConfig을 수정할 필요 없이, `@ComponentScan` 범위 안에 넣으면 됩니다.

### XML 설정 방식 (참고)

> [!NOTE]
> 과거에는 Java Config 대신 **XML 파일**로 동일한 설정을 했습니다.  
> 현재 프로젝트는 Java Config 방식이지만, 구형 프로젝트에서는 아래 구조를 볼 수 있습니다:
>
> | Java Config | XML 동등물 |
> | ----------- | ---------- |
> | `WebConfig.java` | `web.xml` |
> | `RootConfig.java` | `applicationContext.xml` (또는 `root-context.xml`) |
> | `ServletConfig.java` | `dispatcher-servlet.xml` (또는 `servlet-context.xml`) |
>
> 역할과 계층 구조는 동일합니다. 표현 방식만 다릅니다.

### JDBC 드라이버 이해: log4jdbc vs 일반 드라이버

> [!CONCEPT] JDBC 드라이버란?
> JDBC 드라이버는 Java 애플리케이션이 데이터베이스와 통신하기 위한 **어댑터**입니다.  
> 프로젝트에서 어떤 드라이버를 사용하느냐에 따라 URL 형식과 부가 기능이 달라집니다.

| 드라이버 | 클래스명 | URL 형식 | 용도 |
| -------- | -------- | -------- | ---- |
| **MySQL 기본** | `com.mysql.cj.jdbc.Driver` | `jdbc:mysql://host:3306/db` | 순수 DB 연결 |
| **log4jdbc** | `net.sf.log4jdbc.sql.jdbcapi.DriverSpy` | `jdbc:log4jdbc:mysql://host:3306/db` | SQL 로깅 + DB 연결 |

> [!CONCEPT] log4jdbc란?
> `log4jdbc`는 JDBC 드라이버를 **래핑(wrapping)**하여 실행되는 SQL, 파라미터 바인딩, 실행 시간 등을 자동으로 로깅해주는 라이브러리입니다.
>
> ```
> 일반 드라이버:
>   Application → com.mysql.cj.jdbc.Driver → MySQL
>   (SQL 로그 없음)
>
> log4jdbc 드라이버:
>   Application → DriverSpy(로깅) → com.mysql.cj.jdbc.Driver → MySQL
>   (SQL + 파라미터 + 실행 시간 자동 로깅)
> ```
>
> - **개발 환경**: SQL을 보면서 디버깅해야 하므로 `log4jdbc` 사용 (권장)
> - **운영 환경**: 로깅 오버헤드를 줄이기 위해 일반 드라이버 사용 (또는 log4jdbc 유지 + 로그 레벨 조정)

**중요**: 드라이버와 URL은 **반드시 쌍으로 맞춰야** 합니다:

```properties
# ✅ 올바른 조합 1: log4jdbc 드라이버 + log4jdbc URL
jdbc.driver=net.sf.log4jdbc.sql.jdbcapi.DriverSpy
jdbc.url=jdbc:log4jdbc:mysql://localhost:3306/mydb

# ✅ 올바른 조합 2: 일반 드라이버 + 일반 URL
jdbc.driver=com.mysql.cj.jdbc.Driver
jdbc.url=jdbc:mysql://localhost:3306/mydb

# ❌ 잘못된 조합: log4jdbc 드라이버 + 일반 URL → 에러 발생!
jdbc.driver=net.sf.log4jdbc.sql.jdbcapi.DriverSpy
jdbc.url=jdbc:mysql://localhost:3306/mydb
# → "DriverSpy claims to not accept jdbcUrl" 에러
```

> [!TIP]
> 현재 로컬 프로젝트(`application.properties`)는 `log4jdbc`를 사용하고 있습니다:
>
> ```properties
> jdbc.driver=net.sf.log4jdbc.sql.jdbcapi.DriverSpy
> jdbc.url=jdbc:log4jdbc:mysql://localhost:3306/scoula_db
> ```
>
> AWS 배포 시 Parameter Store에 값을 넣을 때도 이 규칙을 지켜야 합니다.  
> 드라이버를 바꾸면 URL도 함께 바꿔야 합니다.

---

### @Profile — 환경별 설정 분리

`@Profile`을 사용하면 실행 환경에 따라 다른 Bean을 활성화할 수 있습니다:

```java
@Configuration
@Profile("local")    // 로컬 개발 시에만 활성화
public class LocalDataSourceConfig { ... }

@Configuration
@Profile("aws")      // AWS 배포 시에만 활성화
public class AwsDataSourceConfig { ... }
```

**프로필 활성화 방법:**

| 환경 | 방법 |
| ---- | ---- |
| 로컬 (IntelliJ) | Run Configuration → VM options: `-Dspring.profiles.active=local` |
| 로컬 (Boot) | `application.properties`에 `spring.profiles.active=local` |
| EC2 배포 | `java -jar app.jar --spring.profiles.active=aws` |
| Tomcat WAR | `catalina.sh`에 `JAVA_OPTS="-Dspring.profiles.active=aws"` |

> [!TIP]
> `@Profile("!aws")`는 "aws가 **아닌** 모든 경우"를 의미합니다.  
> 프로필을 지정하지 않으면 기본적으로 `default` 프로필이 활성화됩니다.  
> `@Profile("!aws")`는 `default` 프로필에서도 활성화되므로, 로컬에서 별도 프로필 설정 없이도 동작합니다.

---

## 2. 비밀값 관리의 중요성


### 주요 용어

| 용어 | 설명 |
| --- | --- |
| **비밀값 (Secret)** | DB 비밀번호, API 키, 토큰 등 외부에 노출되면 안 되는 민감 정보 |
| **하드코딩** | 비밀값을 소스 코드에 직접 작성하는 것 (보안 위험) |
| **AWS Secrets Manager** | 비밀값을 안전하게 저장하고 자동 로테이션하는 AWS 서비스 |
| **Parameter Store** | AWS Systems Manager의 설정값/비밀값 저장소 (무료 티어 있음) |
> [!CONCEPT] 비밀값 하드코딩의 위험성
> **비밀값**(Secrets)은 DB 비밀번호, API 키, 토큰 등 노출되면 보안 사고로 이어지는 민감한 정보입니다. 소스 코드에 하드코딩하면 Git 히스토리에 영구 기록되어 유출 위험이 극도로 높아집니다.

### 하드코딩의 위험성

```
❌ 절대 하지 말아야 할 것:

// application.properties
spring.datasource.password=MySecretP@ss123

// .env (Git에 커밋됨)
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY

// 소스 코드
const API_KEY = "sk-1234567890abcdef";
```

### 비밀값 유출 시나리오

```
개발자가 비밀번호를 코드에 하드코딩
    │
    ▼
Git commit & push (GitHub Public Repo)
    │
    ▼
봇이 수 초 내에 감지 (GitHub 스캔 봇)
    │
    ├── AWS Access Key → 수 분 내 채굴 인스턴스 생성
    │   └── 수백만 원 비용 청구 💸
    │
    ├── DB 비밀번호 → 데이터 유출/삭제
    │
    └── API Key → 무단 사용, 과금 폭탄
```

### 비밀값 관리 성숙도 모델

| 수준 | 방법                            |  보안   | 관리 |
| :--: | ------------------------------- | :-----: | :--: |
|  1   | 소스 코드 하드코딩              | ❌ 최악 |  ❌  |
|  2   | .env 파일 (gitignore)           | ⚠️ 부족 |  ⚠️  |
|  3   | 환경 변수 (서버 설정)           | 🔶 보통 |  🔶  |
|  4   | Parameter Store                 | ✅ 좋음 |  ✅  |
|  5   | Secrets Manager + 자동 로테이션 | ✅ 최고 |  ✅  |

---

## 3. 환경 변수 vs 비밀 저장소


### 주요 용어

| 용어 | 설명 |
| --- | --- |
| **환경 변수 (Environment Variable)** | OS 레벨에서 애플리케이션에 설정값을 주입하는 방법 |
| **비밀 저장소 (Secret Store)** | 비밀값을 중앙에서 암호화하여 관리하는 전용 서비스 |
| **.env 파일** | 환경 변수를 파일로 관리하는 방법 (.gitignore에 반드시 등록) |
> [!CONCEPT] 환경 변수와 비밀 저장소 비교
> **환경 변수**는 OS 레벨에서 설정하는 키-값 쌍이고, **비밀 저장소**는 암호화된 중앙 저장소에서 비밀값을 관리하는 전용 서비스입니다. 환경 변수는 간편하지만 암호화/감사/로테이션이 어렵습니다.

### 비교표

| 항목               | 환경 변수      | Parameter Store       | Secrets Manager  |
| ------------------ | -------------- | --------------------- | ---------------- |
| **암호화**         | ❌ 평문        | ✅ SecureString (KMS) | ✅ 기본 암호화   |
| **버전 관리**      | ❌             | ✅                    | ✅               |
| **접근 제어**      | OS 사용자 권한 | IAM 정책              | IAM 정책         |
| **감사 로그**      | ❌             | ✅ CloudTrail         | ✅ CloudTrail    |
| **자동 로테이션**  | ❌             | ❌                    | ✅ (Lambda 연동) |
| **비용**           | 무료           | 무료 (Standard)       | $0.40/비밀/월    |
| **크기 제한**      | OS 의존        | 8KB                   | 64KB             |
| **교차 계정 공유** | ❌             | ✅                    | ✅               |

### AWS 비밀 관리 서비스 선택 가이드

```
비밀값 관리가 필요한가?
    │
    ├── 단순 설정값 (비밀 아님) → Systems Manager Parameter Store (String)
    │
    ├── 비밀번호/API 키 (정적) → Parameter Store (SecureString)
    │   └── 무료, KMS 암호화, IAM 제어
    │
    └── DB 비밀번호 (자동 로테이션 필요) → Secrets Manager
        └── 유료, 자동 로테이션, RDS 통합
```

---

## 4. 인증(Authentication) vs 인가(Authorization)


### 주요 용어

| 용어 | 설명 |
| --- | --- |
| **인증 (Authentication, AuthN)** | "누구인가?" — 사용자의 신원을 확인하는 과정 |
| **인가 (Authorization, AuthZ)** | "무엇을 할 수 있는가?" — 인증된 사용자의 권한을 확인하는 과정 |
| **MFA (Multi-Factor Authentication)** | 비밀번호 외 추가 인증 수단을 요구하는 다중 인증 |
| **OAuth / OIDC** | 제3자 인증을 위한 표준 프로토콜 (소셜 로그인 등) |
> [!CONCEPT] 인증과 인가의 차이
> **인증**(Authentication, AuthN)은 "당신이 누구인지" 확인하는 과정이고, **인가**(Authorization, AuthZ)는 "당신이 무엇을 할 수 있는지" 결정하는 과정입니다. 인증이 먼저 이루어진 후 인가가 수행됩니다.

### 인증과 인가의 흐름

```
            사용자 요청
                 │
                 ▼
┌──────────────────────────────────────────┐
│  1단계: 인증 (Authentication)            │
│  "당신은 누구입니까?"                    │
│                                          │
│  • ID/Password 확인                      │
│  • MFA 코드 검증                         │
│  • Access Key 확인                       │
│  • 인증서 검증                           │
│                                          │
│  결과: 신원 확인됨 (예: user-kim)        │
└────────────────┬─────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────┐
│  2단계: 인가 (Authorization)             │
│  "무엇을 할 수 있습니까?"                │
│                                          │
│  • IAM 정책 평가                         │
│  • 리소스 기반 정책 확인                 │
│  • 권한 경계 확인                        │
│                                          │
│  결과: Allow 또는 Deny                   │
└────────────────┬─────────────────────────┘
                 │
                 ▼
         요청 처리 또는 거부
```

### AWS에서의 인증/인가 비교

| 항목           | 인증 (AuthN)              | 인가 (AuthZ)                |
| -------------- | ------------------------- | --------------------------- |
| **질문**       | "누구인가?"               | "무엇을 할 수 있는가?"      |
| **AWS 서비스** | IAM, Cognito, SSO         | IAM Policy, Resource Policy |
| **방법**       | 비밀번호, MFA, Access Key | JSON 정책 문서              |
| **실패 시**    | 401 Unauthorized          | 403 Forbidden               |
| **예시**       | 로그인 성공               | S3 버킷 읽기 허용           |

### 인증 방식 종류

| 방식            | 설명                  | AWS 적용          |
| --------------- | --------------------- | ----------------- |
| **지식 기반**   | 비밀번호, PIN         | IAM 콘솔 로그인   |
| **소유 기반**   | 토큰, 스마트카드      | MFA 디바이스      |
| **생체 기반**   | 지문, 얼굴            | (AWS 직접 미지원) |
| **인증서 기반** | X.509 인증서          | IoT 디바이스 인증 |
| **키 기반**     | Access Key/Secret Key | AWS CLI/SDK       |

---

## 5. 최소 권한 원칙 (Principle of Least Privilege)


### 주요 용어

| 용어 | 설명 |
| --- | --- |
| **최소 권한 원칙 (PoLP)** | 작업에 필요한 최소한의 권한만 부여하는 보안 원칙 |
| **IAM Policy** | AWS에서 권한을 정의하는 JSON 문서 (Allow/Deny + Action + Resource) |
| **권한 경계 (Permission Boundary)** | IAM 사용자/역할이 가질 수 있는 최대 권한을 제한하는 정책 |
> [!CONCEPT] 최소 권한 원칙
> **최소 권한 원칙**은 사용자나 서비스에게 작업 수행에 필요한 **최소한의 권한만** 부여하는 보안 원칙입니다. 과도한 권한은 보안 사고 시 피해 범위를 확대시킵니다.

### 최소 권한 적용 예시

```
❌ 나쁜 예: 모든 권한 부여
{
  "Effect": "Allow",
  "Action": "*",
  "Resource": "*"
}
→ 모든 AWS 서비스에 모든 작업 가능 (위험!)

✅ 좋은 예: 필요한 권한만 부여
{
  "Effect": "Allow",
  "Action": [
    "s3:GetObject",
    "s3:PutObject"
  ],
  "Resource": "arn:aws:s3:::my-app-bucket/uploads/*"
}
→ 특정 버킷의 특정 경로에서 읽기/쓰기만 가능
```

### 최소 권한 구현 전략

| 전략               | 설명                                   |
| ------------------ | -------------------------------------- |
| **시작은 제로**    | 권한 없이 시작, 필요할 때 추가         |
| **서비스별 역할**  | EC2, Lambda 각각 별도 IAM Role         |
| **리소스 한정**    | `*` 대신 구체적 ARN 지정               |
| **조건 추가**      | IP 제한, MFA 필수, 시간 제한           |
| **정기 검토**      | IAM Access Analyzer로 미사용 권한 확인 |
| **임시 자격 증명** | 장기 Access Key 대신 Role + STS        |

### 권한 에스컬레이션 방지

```
┌─────────────────────────────────────────────────────┐
│  권한 경계 (Permissions Boundary)                   │
│                                                     │
│  IAM 정책이 허용하더라도,                           │
│  권한 경계를 넘는 작업은 거부됨                     │
│                                                     │
│  ┌─── IAM 정책 ────┐                                │
│  │ S3 Full Access  │                                │
│  │ EC2 Full Access │                                │
│  │ RDS Full Access │                                │
│  └────────┬────────┘                                │
│           │                                         │
│  ┌────────┴────── 권한 경계 ───────┐                │
│  │ S3: 허용                        │                │
│  │ EC2: 허용                       │                │
│  │ RDS: ❌ 차단 (경계 밖)          │                │
│  └─────────────────────────────────┘                │
│                                                     │
│  실제 권한 = IAM 정책 ∩ 권한 경계                   │
└─────────────────────────────────────────────────────┘
```

---

## 6. 대칭키 / 비대칭키 암호화


### 주요 용어

| 용어 | 설명 |
| --- | --- |
| **대칭키 암호화** | 암호화와 복호화에 같은 키를 사용. 빠르지만 키 공유가 어려움 (예: AES-256) |
| **비대칭키 암호화** | 공개키로 암호화, 개인키로 복호화. 키 공유 문제 해결 (예: RSA) |
| **공개키 (Public Key)** | 누구에게나 공개하는 키. 암호화 또는 서명 검증에 사용 |
| **개인키 (Private Key)** | 소유자만 보관하는 키. 복호화 또는 서명 생성에 사용 |
| **해시 (Hash)** | 임의 길이 데이터를 고정 길이 값으로 변환. 단방향 (복원 불가) |
> [!CONCEPT] 대칭키와 비대칭키 암호화
> **대칭키 암호화**는 암호화와 복호화에 같은 키를 사용하고, **비대칭키 암호화**는 공개키(암호화)와 개인키(복호화)라는 서로 다른 키 쌍을 사용합니다. 대칭키는 빠르지만 키 교환이 어렵고, 비대칭키는 느리지만 키 교환이 안전합니다.

### 대칭키 암호화

```
┌───────────┐     같은 키      ┌───────────┐
│   평문    │ ──────────────►  │  암호문   │
│  "Hello"  │   암호화 (키 A)  │  "x7#kQ"  │
└───────────┘                  └───────────┘

┌───────────┐     같은 키      ┌───────────┐
│  암호문   │ ──────────────►  │  평문     │
│  "x7#kQ"  │   복호화 (키 A)  │  "Hello"  │
└───────────┘                  └───────────┘

장점: 빠른 처리 속도
단점: 키를 안전하게 전달하는 방법이 필요
예시: AES-256, AES-128
```

### 비대칭키 암호화

```
키 쌍 생성:
┌──────────────┐     ┌────────────────┐
│  공개키      │     │  개인키        │
│ (Public Key) │     │ (Private Key)  │
│ 누구나 공개  │     │ 소유자만 보관  │
└──────────────┘     └────────────────┘

암호화 (공개키 사용):
┌────────┐  공개키로 암호화 ┌────────┐
│  평문  │ ───────────────► │ 암호문 │
└────────┘                  └────────┘

복호화 (개인키 사용):
┌────────┐  개인키로 복호화 ┌────────┐
│ 암호문 │ ───────────────► │  평문  │
└────────┘                  └────────┘

장점: 키 교환 문제 해결, 디지털 서명 가능
단점: 대칭키보다 1000배 느림
예시: RSA, ECDSA
```

### 실제 사용: 하이브리드 암호화 (TLS/SSL)

```
1. 비대칭키로 대칭키를 안전하게 교환
2. 이후 대칭키로 실제 데이터 암호화 (빠름)

클라이언트                            서버
    │                                  │
    │───── 서버 공개키 요청 ──────────►│
    │◄──── 공개키 + 인증서 ────────────│
    │                                  │
    │ 대칭키 생성 후 공개키로 암호화   │
    │───── 암호화된 대칭키 ───────────►│
    │                                  │ 개인키로 복호화
    │                                  │ → 대칭키 획득
    │◄════ 대칭키로 암호화 통신 ═══════│
    │     (빠른 속도)                  │
```

---

## 7. KMS (Key Management Service) 개념


### 주요 용어

| 용어 | 설명 |
| --- | --- |
| **KMS (Key Management Service)** | 암호화 키를 생성, 저장, 관리하는 AWS 서비스 |
| **CMK (Customer Master Key)** | KMS에서 관리하는 마스터 키. 데이터 키를 암호화하는 데 사용 |
| **봉투 암호화 (Envelope Encryption)** | 데이터 키로 데이터를 암호화하고, 마스터 키로 데이터 키를 암호화하는 이중 구조 |
| **키 로테이션 (Key Rotation)** | 보안을 위해 암호화 키를 주기적으로 교체하는 것 |
> [!CONCEPT] KMS와 봉투 암호화
> **AWS KMS**는 암호화 키를 생성, 저장, 관리하는 완전 관리형 서비스입니다. 데이터 암호화에 사용되는 키를 안전하게 보관하며, 키 사용 이력을 CloudTrail로 감사할 수 있습니다.

### KMS 암호화 구조 (Envelope Encryption)

```
┌─────────────────────────────────────────────────────┐
│  Envelope Encryption (봉투 암호화)                  │
│                                                     │
│  ┌───────────────────────────────────────────┐      │
│  │  CMK (Customer Master Key)                │      │
│  │  • KMS 내부에 안전하게 저장               │      │
│  │  • 절대 외부로 나가지 않음                │      │
│  │  • Data Key를 암호화/복호화하는 데 사용   │      │
│  └──────────────────┬────────────────────────┘      │
│                     │                               │
│                     │ CMK로 Data Key 암호화         │
│                     ▼                               │
│  ┌────────────────────────────────────────────┐     │
│  │  Data Key (데이터 키)                      │     │
│  │  • 실제 데이터를 암호화하는 대칭키         │     │
│  │  • 평문 Data Key: 암호화 작업 후 즉시 삭제 │     │
│  │  • 암호화된 Data Key: 데이터와 함께 저장   │     │
│  └──────────────────┬─────────────────────────┘     │
│                     │                               │
│                     │ Data Key로 데이터 암호화      │
│                     ▼                               │
│  ┌───────────────────────────────────────────┐      │
│  │  암호화된 데이터 + 암호화된 Data Key      │      │
│  │  (S3, EBS, RDS 등에 저장)                 │      │
│  └───────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────┘
```

### KMS 키 유형

| 유형                | 관리 주체 | 비용             | 사용 사례               |
| ------------------- | --------- | ---------------- | ----------------------- |
| **AWS 관리형 키**   | AWS       | 무료             | S3 기본 암호화 (aws/s3) |
| **고객 관리형 키**  | 사용자    | $1/월 + API 호출 | 세밀한 제어 필요 시     |
| **사용자 가져오기** | 사용자    | $1/월 + API 호출 | 기존 키 마이그레이션    |

### KMS와 AWS 비밀 관리 서비스의 관계

실습에서 사용하는 Parameter Store와 Secrets Manager는 내부적으로 KMS를 사용하여 비밀값을 암호화합니다:

```
┌─────────────────────────────────────────────────────────────┐
│              KMS ↔ 비밀 관리 서비스 관계                      │
│                                                             │
│  [SSM Parameter Store - SecureString]                       │
│       │                                                     │
│       │ 저장 시: KMS 키(alias/aws/ssm)로 암호화             │
│       │ 조회 시: withDecryption=true → KMS로 복호화         │
│       │                                                     │
│       └──→ KMS (alias/aws/ssm) — AWS 관리형 키, 무료       │
│                                                             │
│  [Secrets Manager]                                          │
│       │                                                     │
│       │ 저장 시: KMS 키(aws/secretsmanager)로 자동 암호화   │
│       │ 조회 시: GetSecretValue → 자동 복호화               │
│       │                                                     │
│       └──→ KMS (aws/secretsmanager) — AWS 관리형 키, 무료   │
└─────────────────────────────────────────────────────────────┘
```

| 서비스 | 사용하는 KMS 키 | 암호화 시점 | 복호화 시점 | 추가 비용 |
|--------|----------------|-------------|-------------|-----------|
| Parameter Store (SecureString) | `alias/aws/ssm` | 파라미터 저장 시 | `--with-decryption` 옵션 사용 시 | 무료 (기본 키) |
| Secrets Manager | `aws/secretsmanager` | 비밀 저장 시 (자동) | `GetSecretValue` API 호출 시 (자동) | 무료 (기본 키) |

> [!CONCEPT] 실습에서의 KMS 키 선택
>
> - **Parameter Store**: SecureString 생성 시 "KMS Key ID"로 `alias/aws/ssm`을 선택합니다.  
>   이 키는 AWS가 자동으로 생성·관리하며, 비용이 발생하지 않습니다.
> - **Secrets Manager**: 비밀 생성 시 "Encryption key"로 `aws/secretsmanager`를 유지합니다.  
>   이 역시 AWS 관리형 키로 무료입니다.
>
> 두 서비스 모두 **기본 AWS 관리형 키를 사용하면 KMS 관련 추가 비용은 없습니다.**  
> 커스텀 키(고객 관리형 키)를 사용하면 키당 월 $1 + API 호출 비용이 발생합니다.

> [!TIP]
> IAM 정책에서 SecureString을 복호화하려면 `kms:Decrypt` 권한이 필요합니다.  
> 6-1 태스크 6에서 IAM 정책에 `kms:Decrypt` Action을 포함하는 이유가 바로 이것입니다.  
> Secrets Manager는 `secretsmanager:GetSecretValue` 권한만 있으면 복호화가 자동으로 처리됩니다.

---

## 8. Zero Trust 보안 모델


### 주요 용어

| 용어 | 설명 |
| --- | --- |
| **Zero Trust** | "아무도 신뢰하지 않는다" — 네트워크 위치와 무관하게 모든 접근을 검증하는 보안 모델 |
| **경계 기반 보안 (Perimeter Security)** | 내부 네트워크는 신뢰하고 외부만 차단하는 전통적 모델 (VPN 등) |
| **마이크로 세그멘테이션** | 네트워크를 세밀하게 분리하여 횡적 이동을 차단하는 기법 |
> [!CONCEPT] Zero Trust 보안 모델
> **Zero Trust**는 "아무것도 신뢰하지 않고, 항상 검증한다(Never Trust, Always Verify)"는 보안 모델입니다. 네트워크 위치(내부/외부)에 관계없이 모든 접근 요청을 검증합니다. 전통적인 경계 기반 보안(Castle-and-Moat)의 한계를 극복합니다.

### 전통 보안 vs Zero Trust

```
전통적 보안 (Castle-and-Moat):
┌─────────────────────────────────────┐
│  방화벽 (성벽)                      │
│  ┌───────────────────────────────┐  │
│  │  내부 네트워크 = 신뢰 영역    │  │
│  │  • 내부 통신은 검증 없음      │  │
│  │  • 한 번 침입하면 자유 이동   │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘

Zero Trust:
┌─────────────────────────────────────┐
│  모든 접근 = 검증 필요              │
│  ┌───┐  검증  ┌───┐  검증  ┌───┐    │
│  │ A │ ◄────► │ B │ ◄────► │ C │    │
│  └───┘        └───┘        └───┘    │
│  • 내부 통신도 암호화               │
│  • 모든 요청마다 인증/인가          │
│  • 최소 권한 접근                   │
│  • 지속적 모니터링                  │
└─────────────────────────────────────┘
```

### Zero Trust 핵심 원칙

| 원칙                  | 설명                     | AWS 구현                 |
| --------------------- | ------------------------ | ------------------------ |
| **항상 검증**         | 모든 요청을 인증/인가    | IAM, STS                 |
| **최소 권한**         | 필요한 최소 접근만 허용  | IAM Policy, SG           |
| **침해 가정**         | 이미 침입당했다고 가정   | GuardDuty, CloudTrail    |
| **마이크로 세그먼트** | 네트워크를 작게 분리     | VPC, Subnet, SG          |
| **암호화**            | 전송 중 + 저장 시 암호화 | TLS, KMS                 |
| **지속 모니터링**     | 실시간 이상 탐지         | CloudWatch, Security Hub |

---

## 핵심 정리

| 개념            | 한 줄 요약                                      |
| --------------- | ----------------------------------------------- |
| Spring 설정 구조 | Boot=자동, 레거시=수동 (WebConfig→RootConfig→ServletConfig) |
| @Profile        | 환경별(local/aws) Bean을 분리하여 충돌 없이 관리 |
| 비밀값 관리     | 하드코딩 금지, 전용 저장소 사용 필수            |
| 환경 변수 vs 저장소 | 환경 변수는 간편, 비밀 저장소는 암호화+감사+로테이션 |
| 인증 vs 인가    | 누구인지 확인 vs 무엇을 할 수 있는지 결정       |
| 최소 권한 원칙  | 필요한 최소한의 권한만 부여                     |
| 대칭키 암호화   | 같은 키로 암호화/복호화 (빠름, 키 교환 어려움)  |
| KMS             | AWS 암호화 키 관리 서비스 (Envelope Encryption) |
| Zero Trust      | 위치 무관, 모든 접근을 항상 검증                |

---

## 다음 단계

이 이론을 바탕으로 **Session 1: SSM Parameter Store로 DB 비밀번호 관리** 실습에서 안전한 비밀값 관리를 직접 구현해봅니다.

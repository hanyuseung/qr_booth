# Supabase 연결과 운영 배포

현재 저장소는 로컬 체험 모드로 실행할 수 있다. 실제 Supabase 프로젝트와 도메인은 사용자가 준비한 뒤 아래 순서로 연결한다. 개발·테스트와 실제 행사는 서로 다른 Supabase 프로젝트를 사용하는 것을 권장한다.

## 1. Supabase 프로젝트 생성

1. Supabase에서 프로젝트를 만든다.
2. 프로젝트 URL과 공개용 **publishable key**를 확인한다.
3. Auth 설정에서 **Anonymous Sign-Ins**를 활성화한다. 익명 가입을 위해 전역 사용자 가입을 허용하되, 이메일 계정의 공개 가입은 비활성화하고 운영자 계정은 대시보드에서 생성한다.
4. Auth의 Site URL을 참가자 사이트 주소로 설정한다. 개발 중에는 `http://localhost:5173`, 운영 시에는 최종 HTTPS 주소를 사용한다.
5. 실제 참가자 수와 행사장 공용 Wi-Fi 사용을 고려해 익명 가입 제한을 확인한다. 많은 참가자가 같은 공인 IP를 공유할 수 있다.
6. 운영 시 Auth의 CAPTCHA를 활성화하고 Cloudflare Turnstile을 설정한다. 사이트 키는 프론트엔드에, 비밀 키는 Supabase Auth 설정에 입력한다. 사이트 키를 넣지 않은 개발 환경에서는 Supabase 쪽 CAPTCHA도 꺼져 있어야 한다.

공개용 키는 RLS와 함께 사용하는 브라우저용 키다. `service_role` 또는 secret key를 `VITE_` 변수에 넣으면 안 된다. Edge Functions는 Supabase가 제공하는 `SUPABASE_SERVICE_ROLE_KEY`를 내부에서만 사용한다. [API 키 안내](https://supabase.com/docs/guides/getting-started/api-keys) · [익명 인증 안내](https://supabase.com/docs/guides/auth/auth-anonymous)

## 2. 데이터베이스 적용

```bash
npm ci
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npm run db:push
```

`YOUR_PROJECT_REF`는 생성한 프로젝트 식별자로 바꾼다. CLI가 요청하는 데이터베이스 비밀번호는 본인 터미널에서 입력한다.

마이그레이션은 다음을 만든다.

- 행사, 부스, QR, 스탬프, 운영자 목록, 적립 요청 제한 테이블.
- 공개 행사·활성 부스 조회와 참가자 본인 스탬프 조회 정책.
- 참가자의 직접 쓰기 및 QR 원문·운영자 권한 조회 차단.
- `(participant_id, booth_id)` 유일성 제약과 원자적 적립 함수.
- 부스별 활성 QR 1개 제약과 원자적 QR 교체 함수.

초기 버전은 프로젝트당 행사 1개만 허용한다. 여러 행사를 동시에 운영하려면 `one_event_per_installation` 인덱스와 운영자 화면의 행사 선택 기능을 함께 변경해야 한다. 행사 주소 이름은 QR 발급 후에도 바뀌지 않도록 생성 이후 변경을 차단한다.

마이그레이션은 샘플 행사나 참가자를 운영 데이터베이스에 넣지 않는다.

## 3. 운영자 계정 등록

Supabase Auth 대시보드에서 이메일·비밀번호로 운영자 사용자를 만들고 이메일 확인 상태를 완료한다. 해당 사용자의 UUID를 확인한 뒤 SQL Editor에서 다음을 실행한다.

```sql
insert into public.admin_users (user_id)
values ('여기에-운영자-사용자-UUID')
on conflict do nothing;
```

`admin_users`는 브라우저에서 편집할 수 없다. 운영 권한을 회수할 때도 SQL Editor에서 해당 행을 제거한다. 일반 참가자 계정과 운영자 계정의 로그인 세션은 서로 다른 브라우저 저장 키를 사용한다.

## 4. Edge Functions 배포

허용할 프론트엔드 출처를 먼저 등록하고 함수를 배포한다.

```bash
npx supabase secrets set ALLOWED_ORIGINS=https://stamp.example.com
npm run functions:deploy
```

예시 도메인은 실제 주소로 바꾼다. 개발 주소도 함께 필요하면 쉼표로 연결한다.

```bash
npx supabase secrets set ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,https://stamp.example.com
```

`supabase/config.toml`의 두 함수는 `verify_jwt=false`로 설정되어 있다. 함수 내부에서 **모든 POST 요청의 Bearer JWT를 `auth.getUser()`로 검증**하고, 운영자 API는 익명 계정을 거부한 뒤 `admin_users`를 확인한다. CORS만으로 접근을 통제하지 않는다. [함수 인증 안내](https://supabase.com/docs/guides/functions/auth)

적립 함수는 사용자당 1분에 최대 60회 요청을 허용한다. 유효한 형식의 잘못된 QR 요청도 집계한다. 이 제한은 익명 가입 자체의 제한을 대신하지 않으므로 Auth의 요청 제한과 CAPTCHA를 함께 설정한다.

## 5. 프론트엔드 환경 변수

```bash
cp .env.example .env.local
```

`.env.local`을 다음과 같이 설정한다. 실제 키를 저장소에 커밋하지 않는다.

```dotenv
VITE_APP_MODE=live
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
VITE_DEFAULT_EVENT_SLUG=fall-festival
VITE_PUBLIC_SITE_URL=https://stamp.example.com
VITE_TURNSTILE_SITE_KEY=YOUR_TURNSTILE_SITE_KEY
```

- `VITE_DEFAULT_EVENT_SLUG`: 운영자 화면에서 만들 행사의 주소 이름과 일치시킨다.
- `VITE_PUBLIC_SITE_URL`: 경로·쿼리 없는 최종 도메인. 운영 모드에서는 HTTPS 주소가 있어야 QR을 생성·인쇄할 수 있다.
- `VITE_TURNSTILE_SITE_KEY`: Supabase Auth에서 CAPTCHA를 끈 개발 환경에서만 비워 둔다.

환경 변수를 바꾼 후 개발 서버를 재시작한다. 운영 모드의 프로젝트 URL이나 공개 키가 없으면 실행·빌드를 중단한다. `VITE_APP_MODE`를 생략하면 체험 모드이므로, 호스팅에도 반드시 `live` 값을 설정한다.

```bash
npm run dev
```

`/admin`에서 운영자로 로그인하고 행사·부스를 만든다. 첫 방문 화면이 “행사를 찾을 수 없어요”인 경우 주소 이름이 일치하는 공개 행사가 아직 없는지 확인한다.

## 6. Cloudflare Pages와 도메인

1. 저장소를 호스팅 서비스에 연결하거나 빌드 결과물을 업로드한다.
2. 빌드 명령은 `npm run build`, 출력 디렉터리는 `dist`, Node.js는 22.12 이상으로 설정한다.
3. 위 `VITE_` 변수들을 호스팅의 빌드 환경에도 입력한다.
4. 확보한 도메인을 Pages에 연결하고 HTTPS 발급을 확인한다.
5. Supabase Auth의 Site URL, 허용 리디렉션 주소, `ALLOWED_ORIGINS`, Turnstile 허용 도메인을 최종 주소에 맞춘다.
6. 최종 주소로 다시 빌드한 뒤 운영용 QR을 생성한다.

`public/_redirects`가 빌드 결과에 포함되어 QR 하위 경로 직접 접속도 앱으로 연결된다. `public/_headers`에는 QR 주소의 외부 전달을 줄이는 Referrer-Policy와 기본 응답 헤더가 들어 있다. [Pages 페이지 제공 방식](https://developers.cloudflare.com/pages/configuration/serving-pages/) · [커스텀 도메인 연결](https://developers.cloudflare.com/pages/configuration/custom-domains/)

참가자 모집 전에 도메인을 확정한다. 인쇄된 QR의 주소는 자동 변경되지 않고, 임시 도메인의 익명 세션도 최종 도메인으로 자동 이전되지 않는다.

## 7. 운영자 사용 순서

1. **행사 만들기**: 행사명, 주소 이름, 장소, 시작·종료 시간을 입력한다. 시간 입력은 운영자 기기의 시간대를 사용하며 DB에는 UTC로 저장한다.
2. **부스 추가**: 이름, 소개, 위치, 아이콘, 색상, 순서를 정한다.
3. **QR**: 부스별 QR을 발급하고 PNG로 다운로드한다.
4. **전체 QR 인쇄**: 모든 활성 부스에 QR이 발급되었는지 확인하고 인쇄한다. A4 한 장에 부스 2개, 배율 100% 기준이다.
5. **행사 공개**: 공개 상태와 운영 기간을 확인한다. 공개 상태여도 운영 시간 밖에는 적립되지 않는다.
6. **현장 부착**: 실제 인쇄물을 스마트폰으로 테스트한 뒤 부스에 부착한다.

부스를 비활성화하면 기존 기록은 보존되지만 참가자 화면과 완료 목표에서 제외된다. QR 재발급은 기존 QR을 즉시 폐기하므로 인쇄물도 교체한다. 재발급하더라도 이미 받은 스탬프는 추가로 적립되지 않는다.

## 8. 실제 운영 전 검증

- 새 브라우저의 QR 첫 접속 → 익명 인증 → 적립 → 스탬프 화면.
- 동일 QR 재스캔과 여러 탭의 동시 요청에서 부스당 1개 유지.
- 다른 참가자의 스탬프가 보이지 않고 일반 계정의 관리 API가 거부됨.
- 재발급된 QR, 비활성 부스, 준비·종료 상태, 운영 시간 밖의 요청 처리.
- 인터넷 끊김 후 재시도와 기존 탭 복귀 시 기록 갱신.
- 행사장 공용 Wi-Fi에서 익명 인증, CAPTCHA, 요청 제한 동작.
- iOS·Android 카메라와 실제 인쇄물의 QR 인식, HTTPS 하위 경로 직접 접속.
- 예상 참가자 수에 맞춘 Supabase Auth·DB·Edge Functions 한도와 비용.

자동 테스트는 클라우드 설정, 실제 행사장 통신 상태, 실제 인쇄 품질까지 검증하지 않는다. 고정 QR의 링크 공유와 브라우저 변경에 따른 익명 참가자 중복 생성도 운영 정책으로 고려해야 한다.

## 9. 문제 해결

| 증상                            | 확인 사항                                                                  |
| ------------------------------- | -------------------------------------------------------------------------- |
| 체험 모드 배너가 계속 보임      | `VITE_APP_MODE=live` 설정 후 재시작 또는 재빌드                            |
| 행사 조회 실패                  | 프로젝트 URL·공개 키, 마이그레이션 적용, 공개 상태, 기본 행사 주소 이름    |
| 처음 QR 스캔에서 인증 실패      | Anonymous Sign-Ins, 가입 허용 설정, CAPTCHA 사이트 키와 비밀 키, Auth 제한 |
| 운영자 로그인 거부              | 이메일·비밀번호, 이메일 확인 상태, `admin_users`에 등록한 사용자 UUID      |
| 적립·운영자 요청 실패           | 함수 배포, `ALLOWED_ORIGINS`, 함수 로그의 오류 코드, 사용자 인증 세션      |
| QR 발급 시 도메인 오류          | `VITE_PUBLIC_SITE_URL`에 경로 없는 최종 HTTPS 주소 설정                    |
| QR 직접 접속에서 404            | `dist/_redirects` 배포 및 호스팅 SPA 경로 설정                             |
| 다른 브라우저에서 스탬프가 없음 | 익명 세션은 브라우저마다 별개이므로 처음 사용한 브라우저 확인              |

## 10. 선택: 로컬 Supabase로 통합 개발

Docker가 설치된 환경에서는 클라우드 프로젝트 없이 로컬 Supabase를 실행할 수 있다.

```bash
npx supabase start
cp supabase/functions/.env.example supabase/functions/.env
npx supabase functions serve --env-file supabase/functions/.env
```

CLI가 출력하는 로컬 API URL과 공개 키를 프론트엔드의 운영 모드 설정에 넣는다. 로컬 Studio에서 운영자 계정을 만들고 같은 방식으로 `admin_users`를 등록한다. 실제 인쇄용 QR 생성은 최종 HTTPS 도메인에서 수행하고, 로컬 검증은 부스 토큰을 사용하는 `/e/<행사 주소 이름>/scan/<토큰>` 경로로 진행한다.

로컬 전체 Supabase 스택 실행은 필수가 아니며, 기본 `npm test`는 Docker 없이 데이터베이스 로직을 검증한다.

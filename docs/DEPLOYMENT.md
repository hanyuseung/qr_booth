# Supabase 연결과 Vercel 배포

운영 주소는 **https://boryeongculture.site**이며 현재 `www.boryeongculture.site`로 이동해 열린다. 기존 **https://qr-booth.vercel.app**도 유지된다. 프론트엔드는 Vercel, 데이터베이스·인증·적립 API는 Supabase를 사용한다.

도메인 설정은 [새 도메인 연결 안내](DOMAIN.md)에 정리했다.

## 2026-10-05 추가 기능 배포

- [x] `202610050001_booth_management.sql` 운영 DB 적용: 썸네일 경로, 부스 삭제 시 QR·방문 기록 정리, 기존 토큰을 보존하는 QR 일괄 생성 함수
- [x] `202610050002_thumbnail_storage.sql` 운영 DB 적용: 공개 읽기용 `booth-thumbnails` 버킷, WebP만 허용, 최대 256KiB
- [x] 변경된 `admin-action` Edge Function 배포
- [ ] 이번 프론트엔드 코드를 Vercel Production에 배포

**현재 Supabase 변경은 적용 완료이며 Vercel 프론트엔드 배포만 남았다.** 이 환경에는 Vercel 로그인 정보가 없어 Vercel 배포를 실행하지 않았다. 변경 코드를 연결된 Git 저장소에 올려 배포하거나, Vercel CLI로 이 프로젝트를 배포한다. 기존 배포에서 Redeploy만 누르면 아직 Git에 올리지 않은 로컬 코드는 포함되지 않는다.

Vercel의 Production 환경 변수 `VITE_PUBLIC_SITE_URL`을 `https://boryeongculture.site`로 설정한다. `.env.vercel.local`에도 같은 값을 준비했다. 이 파일에는 공개용 키가 있으므로 저장소에 커밋하지 않는다.

배포 후 `/admin`에서 다음을 확인한다.

1. 수정·QR 옆 **삭제** 버튼과 삭제 확인창. 실제 삭제는 테스트 부스에서만 확인한다.
2. **부스별 QR 일괄 생성** → QR이 없는 운영 부스만 발급 → 전체 QR 인쇄. 기존 인쇄 QR은 유지된다.
3. **사이트 접속 QR** → `boryeongculture.site` 링크 확인·PNG 다운로드·안내문 인쇄. 이 QR 자체는 방문 스탬프를 적립하지 않는다.
4. 부스 수정 → **썸네일 사진** 업로드 → 저장. 브라우저가 JPG·PNG·WebP(원본 최대 10MB)를 최대 512px WebP로 변환한다. DB에는 파일 경로만 저장된다.
5. 모든 운영 부스 방문 후 참가자 화면의 첫 4개 카드 위에 전체 완료 도장이 보이는지 확인한다.

사진 저장 실패 시 새 업로드를 정리하고 기존 사진을 보존한다. 사진 교체·삭제 후 Storage 정리에 일시적인 오류가 나면 기능 저장 자체는 완료되며 함수 로그에 `Thumbnail cleanup failed`가 남는다. 이 경우 참조되지 않는 파일은 Storage에서 별도로 정리할 수 있다. 참가자는 사진 업로드·삭제 권한이 없으며 운영자 API에서만 처리한다. [Supabase 공개 버킷 및 접근 제어](https://supabase.com/docs/guides/storage/buckets/fundamentals)

검증: TypeScript·운영용 빌드, 단위/DB 테스트 25개, 함수 테스트 16개, 데스크톱·모바일 브라우저 테스트 22개 통과. 운영 API에서는 새 컬럼 조회(200), 두 도메인의 CORS 사전 요청(204), 비로그인 운영자 조회 거부(401)를 확인했다. 실제 운영 데이터의 삭제·방문 적립은 실행하지 않았다.

## 최초 설치 상태와 기본 절차

2026-10-05 기준:

- [x] Supabase 프로젝트 연결 및 데이터베이스 적용 확인
- [x] 익명 인증 활성화 및 이메일 로그인 사용 가능 확인
- [x] `claim-stamp`, `admin-action` 함수 배포
- [x] `https://qr-booth.vercel.app` 및 로컬 개발 주소의 API 호출 허용
- [x] Vercel 빌드·QR 하위 경로·응답 헤더 설정 (`vercel.json`)
- [x] 로컬 `.env.local`의 실제 연결 모드 전환 및 `.env.vercel.local` 준비
- [ ] 운영자 계정 등록 확인 (3번)
- [x] 기존 프론트엔드 Vercel 배포 및 도메인 연결 확인 (이번 추가 기능은 위 배포 상태 참고)
- [ ] 운영자 로그인 → 행사·부스 등록 → QR 첫 스캔 확인 (7번)

현재 연결된 Supabase에는 신규 마이그레이션까지 적용했다. 별도 프로젝트에 설치하는 경우 아래 DB·함수 배포 절차를 모두 진행한다.

이번 첫 배포 테스트는 **CAPTCHA OFF**, `VITE_TURNSTILE_SITE_KEY`는 비운 상태로 진행한다. 공개 행사 운영 전에는 아래 설명을 참고해 CAPTCHA와 가입 제한을 설정한다.

## 1. Supabase 프로젝트 생성

1. Supabase에서 프로젝트를 만든다.
2. 프로젝트 URL과 공개용 **publishable key**를 확인한다.
3. Auth 설정에서 **Anonymous Sign-Ins**를 활성화한다. 익명 가입을 위해 전역 사용자 가입을 허용하되, 이메일 계정의 공개 가입은 비활성화하고 운영자 계정은 대시보드에서 생성한다.
4. Supabase의 **Authentication → URL Configuration → Site URL**을 `https://boryeongculture.site`로 설정한다. 리디렉션 허용 주소에도 이 주소를 등록한다.
5. 첫 배포 테스트에서는 CAPTCHA를 끄고 진행할 수 있다. 아래의 가입 제한과 CAPTCHA 설명은 실제 행사 운영 전에 적용한다.

### 공인 IP 공유와 가입 제한은 무슨 뜻인가?

공인 IP는 인터넷에서 보이는 접속 주소다. 예를 들어 행사장 Wi-Fi 하나에 100명이 연결하면, Supabase에는 여러 참가자가 같은 공인 IP에서 접속하는 것으로 보일 수 있다.

Supabase 익명 가입은 기본적으로 **IP당 시간당 30회**로 제한된다. 이 제한은 스탬프 30개 제한이 아니라 **처음 참여하는 사람의 익명 계정을 만드는 요청 제한**이다. 기존 세션을 사용하는 참가자는 매 부스마다 새로 가입하지 않는다. [공식 제한 안내](https://supabase.com/docs/guides/auth/rate-limits)

지금 소수 인원으로 테스트할 때는 기본값으로 시작한다. 실제 행사 전에는 **Authentication → Rate Limits → Anonymous sign-ins**에서 같은 Wi-Fi로 한 시간 동안 처음 들어올 참가자 수에 맞춰 값을 정한다. 예상 인원이 아직 없으므로 이번 작업에서 임의로 한도를 올리지 않았다. 참가자 수뿐 아니라 여러 브라우저 사용·재시도도 고려한다.

### CAPTCHA는 무엇이고, 지금 꼭 필요한가?

CAPTCHA는 봇이 익명 계정을 대량 생성하는 것을 줄이는 인증이다. 첫 기능 확인을 위해 반드시 켜야 하는 기능은 아니므로 **이번에는 꺼 둔 상태로 배포 테스트**한다. 공개 행사 운영에는 Supabase가 CAPTCHA 사용을 권장한다. [익명 인증 안내](https://supabase.com/docs/guides/auth/auth-anonymous)

나중에 활성화할 때는 다음을 한 세트로 설정한다.

1. Cloudflare 계정에서 **Turnstile → Add widget**을 열고 Managed 방식으로 생성한다. 사이트 호스팅은 계속 Vercel을 사용한다.
2. 허용 호스트 이름에 `qr-booth.vercel.app`을 등록한다. 로컬에서도 테스트하려면 `localhost`도 추가한다.
3. 발급된 **Site key**를 Vercel의 `VITE_TURNSTILE_SITE_KEY`에 입력하고 재배포한다.
4. Supabase의 **Authentication → Bot and Abuse Protection → CAPTCHA protection**에서 제공자를 Turnstile로 선택하고 **Secret key**를 저장한 뒤 활성화한다.
5. 첫 QR 접속과 운영자 로그인을 모두 확인한다. 두 화면 모두 CAPTCHA 토큰 전달을 지원한다.

Supabase에서만 CAPTCHA를 켜고 프론트엔드 사이트 키를 비워 두면 인증이 실패한다. CAPTCHA를 켜도 IP별 가입 제한은 따로 적용된다. [Supabase CAPTCHA 안내](https://supabase.com/docs/guides/auth/auth-captcha)

**이메일 신규 가입 차단과 이메일 로그인 기능 해제는 다르다.** 운영자 로그인에 이메일·비밀번호를 사용하므로 Email provider는 켜 두고, 일반 사용자의 신규 이메일 가입만 차단한다. 운영자는 아래 3번처럼 대시보드에서 생성한다.

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
npx supabase secrets set ALLOWED_ORIGINS=https://boryeongculture.site,https://www.boryeongculture.site,https://qr-booth.vercel.app,http://localhost:5173,http://127.0.0.1:5173
npm run functions:deploy
```

허용 주소를 변경할 때는 전체 목록을 쉼표로 연결한다. Vercel이 자동 생성하는 매번 다른 Preview 주소는 허용하지 않았으므로, 이번 실제 API 확인은 `qr-booth.vercel.app`에서 진행한다.

```bash
npx supabase functions deploy claim-stamp admin-action --use-api
```

`supabase/config.toml`의 두 함수는 `verify_jwt=false`로 설정되어 있다. 함수 내부에서 **모든 POST 요청의 Bearer JWT를 `auth.getUser()`로 검증**하고, 운영자 API는 익명 계정을 거부한 뒤 `admin_users`를 확인한다. CORS만으로 접근을 통제하지 않는다. [함수 인증 안내](https://supabase.com/docs/guides/functions/auth)

마지막 명령의 `--use-api`는 Docker 없이 함수를 배포하는 방법이다. 적립 함수는 사용자당 1분에 최대 60회 요청을 허용한다. 유효한 형식의 잘못된 QR 요청도 집계한다. 이 제한과 Auth의 익명 가입 제한은 서로 다른 제한이다.

## 5. 프론트엔드 환경 변수

```bash
cp .env.example .env.local
```

기존 `.env.local`이 있다면 위 복사 명령으로 덮어쓰지 않고 필요한 값만 수정한다. 현재 작업 폴더의 `.env.local`은 이미 실제 연결 모드와 Vercel 주소로 설정했다. 예시는 다음과 같다. 실제 키를 저장소에 커밋하지 않는다.

```dotenv
VITE_APP_MODE=live
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
VITE_DEFAULT_EVENT_SLUG=fall-festival
VITE_PUBLIC_SITE_URL=https://boryeongculture.site
VITE_TURNSTILE_SITE_KEY=
```

- `VITE_DEFAULT_EVENT_SLUG`: 운영자 화면에서 만들 행사의 주소 이름과 일치시킨다.
- `VITE_PUBLIC_SITE_URL`: 경로·쿼리 없는 최종 도메인. 운영 모드에서는 HTTPS 주소가 있어야 QR을 생성·인쇄할 수 있다.
- `VITE_TURNSTILE_SITE_KEY`: 이번 첫 배포 테스트에서는 비운다. Supabase Auth의 CAPTCHA도 꺼 둔다.

환경 변수를 바꾼 후 개발 서버를 재시작한다. 운영 모드의 프로젝트 URL이나 공개 키가 없으면 실행·빌드를 중단한다. Vercel에서는 `VITE_APP_MODE=live` 또는 올바른 `VITE_PUBLIC_SITE_URL`이 빠지면 빌드를 실패시켜 체험 모드가 잘못 배포되는 것을 막는다.

```bash
npm run dev
```

`/admin`에서 운영자로 로그인하고 행사·부스를 만든다. 첫 방문 화면이 “행사를 찾을 수 없어요”인 경우 주소 이름이 일치하는 공개 행사가 아직 없는지 확인한다.

## 6. Vercel에 배포하기

1. 이번 변경 파일을 Git 저장소에 커밋하고 push한다. `.env.local`과 `.env.vercel.local`은 Git에 올리지 않는다.
2. Vercel에서 **Add New → Project**로 `qr_booth` 저장소를 가져온다. 이미 연결한 프로젝트가 있다면 해당 프로젝트의 Settings를 연다.
3. 프로젝트 이름은 `qr-booth`, Framework Preset은 **Vite**, Root Directory는 저장소 루트로 설정한다.
4. Build Command는 `npm run build`, Output Directory는 `dist`, Install Command는 `npm ci`다. 저장소의 `vercel.json`에도 설정되어 있다. Node.js는 **24.x**로 설정한다.
5. **Environment Variables**에서 아래 값을 등록한다. 새 프로젝트 화면의 **Import .env**가 있다면 작업 폴더의 `.env.vercel.local`을 가져올 수 있다. 이 파일에는 이번 사이트에 필요한 `VITE_` 변수만 들어 있다. 없으면 표대로 직접 입력한다.
6. **Deploy**를 누른다. 기존 프로젝트의 변수를 바꾼 경우 **Redeploy**한다. Vite 환경 변수는 빌드할 때 반영된다.
7. **Settings → Domains**에서 `boryeongculture.site`와 `www.boryeongculture.site`의 연결을 확인한다. 인쇄 전에 QR 기준 주소와 최종 접속 주소가 모두 정상으로 열리는지 확인한다.

| 변수                            | 이번 배포 값                     |
| ------------------------------- | -------------------------------- |
| `VITE_APP_MODE`                 | `live`                           |
| `VITE_SUPABASE_URL`             | `.env.local`의 기존 프로젝트 URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `.env.local`의 기존 공개용 키    |
| `VITE_DEFAULT_EVENT_SLUG`       | `fall-festival`                  |
| `VITE_PUBLIC_SITE_URL`          | `https://boryeongculture.site`   |
| `VITE_TURNSTILE_SITE_KEY`       | 등록하지 않거나 빈 값            |

최소한 **Production** 환경에 등록한다. Preview 빌드도 만들 계획이라면 필수 변수는 Preview에도 등록하되, API 기능 테스트는 허용된 실제 운영 주소에서 한다. 참가자가 Vercel 로그인 없이 접근할 수 있는지도 시크릿 창에서 확인한다.

Vercel은 `public/_redirects`나 `public/_headers` 대신 **`vercel.json`**을 사용한다. 이 파일에 SPA 경로 재작성과 응답 헤더를 넣었으므로 `/admin`, `/e/fall-festival`, QR 하위 경로를 직접 열거나 새로고침해도 앱이 열린다. [Vercel의 Vite 배포 안내](https://vercel.com/docs/frameworks/frontend/vite)

배포 후 먼저 **https://boryeongculture.site/admin**에서 로그인한다. 아직 공개 행사가 없다면 참가자 첫 화면에 “행사를 찾을 수 없어요”가 나올 수 있다. 운영자 화면에서 주소 이름이 `fall-festival`인 행사를 생성하고 공개하면 참가자 화면이 열린다.

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

### 운영자 로그인에서 CORS 오류가 보일 때

1. 먼저 `https://qr-booth.vercel.app/admin`에서 접속했는지 확인한다. 별도의 Vercel Preview 주소나 다른 포트의 로컬 주소는 기본 허용 목록에 없다.
2. `Provisional headers are shown` 표시는 원인 자체를 알려주지 않는다. Console의 실제 CORS 오류 문장과 Network에서 실패한 **Request URL**을 확인한다.
3. `/auth/v1/token` 요청이면 Supabase Auth 로그인 단계이고, `/functions/v1/admin-action`이면 로그인 뒤 운영자 권한을 확인하는 단계다. 각각 다른 서버 설정을 사용한다.
4. Edge Function의 OPTIONS 응답은 요청 출처와 SDK 요청 헤더를 허용해야 한다. 함수는 SDK의 `corsHeaders`에서 허용 헤더 목록만 가져오며, 허용 출처는 계속 `ALLOWED_ORIGINS`에 지정된 주소로 제한한다.
5. 정확히 허용된 주소에서도 실패한다면 Console 오류 문장과 Request URL을 확인한다. 비밀번호, Bearer 토큰, 세션 저장소 내용은 공유하지 않는다.

함수 코드 변경은 `npx supabase functions deploy claim-stamp admin-action --use-api`로 반영한다. CORS 함수만 수정했으면 Vercel 프론트엔드 재배포는 필요하지 않다. [Supabase CORS 안내](https://supabase.com/docs/guides/functions/cors)

| 증상                            | 확인 사항                                                                  |
| ------------------------------- | -------------------------------------------------------------------------- |
| 체험 모드 배너가 계속 보임      | `VITE_APP_MODE=live` 설정 후 재시작 또는 재빌드                            |
| 행사 조회 실패                  | 프로젝트 URL·공개 키, 마이그레이션 적용, 공개 상태, 기본 행사 주소 이름    |
| 처음 QR 스캔에서 인증 실패      | Anonymous Sign-Ins, 가입 허용 설정, CAPTCHA 사이트 키와 비밀 키, Auth 제한 |
| 운영자 로그인 거부              | 이메일·비밀번호, 이메일 확인 상태, `admin_users`에 등록한 사용자 UUID      |
| 적립·운영자 요청 실패           | 함수 배포, `ALLOWED_ORIGINS`, 함수 로그의 오류 코드, 사용자 인증 세션      |
| QR 발급 시 도메인 오류          | `VITE_PUBLIC_SITE_URL`에 경로 없는 최종 HTTPS 주소 설정                    |
| QR 직접 접속에서 404            | 저장소 루트의 `vercel.json` 포함 여부 및 재배포                            |
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

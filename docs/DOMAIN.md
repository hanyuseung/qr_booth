# boryeongculture.site 연결

도메인 구매처는 가비아, 사이트 호스팅은 기존 Vercel `qr-booth` 프로젝트를 사용한다. 대표 주소는 `https://boryeongculture.site`로 정하고, `www`를 추가할 경우 대표 주소로 리디렉션한다.

## 현재 상태

2026-10-05 조회 기준:

- 기존 `https://qr-booth.vercel.app` 사이트는 배포되어 있다.
- Supabase `ALLOWED_ORIGINS`에 새 도메인과 `www`를 추가했다. `admin-action`·`claim-stamp` 모두 새 도메인, `www`, 기존 Vercel 주소에서 사전 요청이 HTTP 204와 해당 출처 허용 헤더로 응답하는 것을 확인했다.
- 후속 조회에서 루트 도메인의 A 레코드가 `216.198.79.1`로 확인됐다. 사용자는 Vercel의 루트 도메인 상태가 Valid임을 확인했다.
- 후속 HTTPS 확인에서 루트 도메인은 `https://www.boryeongculture.site/`로 HTTP 308 리디렉션하고, `www`는 HTTP 200으로 정상 응답했다. 현재 두 주소 모두 접속 가능하다.
- 현재 최종 접속 주소는 `www`다. 기존 대표 주소 계획으로 변경하려면 Vercel에서 루트를 Production에 직접 연결하고 `www`를 루트로 리디렉션한다. 이미 현장 참여를 시작했다면 세션이 분리되지 않도록 현재 최종 주소를 유지한다.
- 이 작업 환경에는 가비아 DNS 및 Vercel 계정 연결이 없어 두 서비스의 관리 화면 변경은 사용자가 진행해야 한다.
- `.env.local`과 `.env.vercel.local`의 QR 기준 주소는 `https://boryeongculture.site`로 설정했다. Vercel 환경 변수에도 같은 값을 적용하고 이번 코드를 배포해야 한다.

## 1. Vercel에 도메인 추가

1. Vercel에서 `qr-booth` 프로젝트를 연다.
2. **Settings → Domains → Add Domain**에서 `boryeongculture.site`를 추가한다.
3. Production 배포에 연결한다. `www`를 대표 주소로 바꾸라는 선택지가 나오면, 이번에는 `boryeongculture.site`가 대표 주소가 되도록 선택한다.
4. 표시되는 DNS 레코드의 **Type / Name / Value**를 확인한다. 루트 도메인은 보통 `A / @ / IP 주소` 형태다.
5. `www`도 사용하려면 `www.boryeongculture.site`를 별도로 추가하고 `https://boryeongculture.site`로 리디렉션하도록 설정한다.

프로젝트별 권장 IP·CNAME 값은 다를 수 있으므로 **Vercel 화면에 표시된 값을 우선 사용한다**. 공식 문서의 공용 A 레코드 값은 `76.76.21.21`이지만, 이번 프로젝트의 실제 권장값을 조회한 것은 아니다. [Vercel 도메인 연결 안내](https://vercel.com/docs/domains/set-up-custom-domain)

## 2. 가비아 DNS 레코드 입력

가비아 네임서버를 사용하는 경우 다음 화면에서 입력한다.

**My가비아 → 서비스 관리 → DNS 관리툴 → boryeongculture.site 선택 → DNS 설정 → 레코드 추가**

| 타입                | 호스트 | 값                            | TTL    |
| ------------------- | ------ | ----------------------------- | ------ |
| A                   | `@`    | Vercel에서 표시한 A 레코드 IP | 기본값 |
| CNAME (www 사용 시) | `www`  | Vercel에서 표시한 CNAME 대상  | 기본값 |

가비아는 CNAME 대상 끝에 마침표를 요구한다. 예를 들어 Vercel 값이 `example.vercel-dns-017.com`이면 가비아에는 `example.vercel-dns-017.com.`으로 입력한다. A 레코드에는 `https://`나 경로 없이 숫자 IP만 넣는다. 각 행의 **확인** 후 하단 **저장**까지 누른다. [가비아 DNS 설정 안내](https://customer.gabia.com/manual/domain/287/1201)

가비아 기본 네임서버를 유지하며 레코드를 연결할 수 있다. 기존 MX·TXT 등 다른 용도의 레코드는 변경하지 않는다. 동일한 `@` 호스트에 기존 A·AAAA 레코드가 있다면 기존 용도를 확인하고 충돌하는 웹 연결 레코드만 수정한다.

## 3. 연결과 HTTPS 확인

1. Vercel Domains 화면에서 DNS 설정이 유효하다고 표시되는지 확인한다.
2. HTTPS 인증서 발급 후 `https://boryeongculture.site`와 `/admin`이 정상적으로 열리는지 확인한다.
3. `www`를 추가했다면 대표 주소로 이동하면서 `/admin` 또는 QR 경로가 유지되는지 확인한다.

확인 명령:

```bash
dig boryeongculture.site A +short
dig boryeongculture.site NS +short
dig www.boryeongculture.site CNAME +short
curl -I https://boryeongculture.site/admin
```

등록·DNS 변경 반영에는 시간이 걸릴 수 있다. DNS 설정이 유효해졌는데도 HTTPS가 실패하면 Vercel의 인증서 상태를 먼저 확인한다.

## 4. 앱 설정 전환

DNS와 HTTPS가 확인된 다음 진행한다.

1. Vercel **Settings → Environment Variables**에서 `VITE_PUBLIC_SITE_URL=https://boryeongculture.site`로 변경하고 Production을 다시 배포한다. 로컬에 준비한 `.env.vercel.local`에도 이 값이 들어 있다.
2. Supabase **Authentication → URL Configuration → Site URL**을 새 주소로 설정하고 Redirect URLs에도 새 주소를 등록한다.
3. Turnstile을 사용하는 경우에만 허용 호스트에 `boryeongculture.site`를 추가한다.
4. 새 도메인의 `/admin`에서 로그인하고 QR 링크의 주소가 새 도메인인지 확인한다.
5. 테스트 QR로 적립을 확인한 다음 운영용 QR을 인쇄한다.

Supabase 함수의 허용 출처는 다음 주소들을 함께 사용한다.

```text
https://boryeongculture.site
https://www.boryeongculture.site
https://qr-booth.vercel.app
http://localhost:5173
http://127.0.0.1:5173
```

기존 `qr-booth.vercel.app`의 익명 참가자 세션은 새 도메인으로 자동 이전되지 않는다. 같은 행사 도중 주소를 섞어 배포하면 참가자 기록이 나뉠 수 있으므로, 현장 참여를 시작하기 전에 대표 주소를 확정한다.

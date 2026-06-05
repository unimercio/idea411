# E2E tests

Playwright suite that signs in as a real user and verifies navbar destinations
and the `/hermes` UI.

## One-time setup

```bash
bunx playwright install chromium
```

## Credentials

Tests read `E2E_TEST_EMAIL` and `E2E_TEST_PASSWORD` from the environment.
Create `.env.local` (gitignored) or export them in your shell:

```bash
export E2E_TEST_EMAIL=unimercio@gmail.com
export E2E_TEST_PASSWORD='...'
```

Optional: `E2E_BASE_URL` (defaults to `https://idea411.lovable.app`).

## Run

```bash
bunx playwright test                  # headless, all specs
bunx playwright test --ui             # interactive runner
bunx playwright show-report           # last HTML report
```

The `auth.setup.ts` project signs in once and saves the session to
`tests/e2e/.auth/user.json`. Subsequent specs reuse it.

## Structure

- `auth.setup.ts`   — logs in, persists storageState
- `navbar.spec.ts`  — dashboard nav link destinations + Claim sysadmin guard
- `hermes.spec.ts`  — `/hermes` loads cleanly, brand is IdeaForge (not "Hermes"),
                       tab navigation works, no console errors

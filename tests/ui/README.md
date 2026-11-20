# UI smoke tests

Cài Playwright (một lần):

```bash
cd hkt/frontend
npm i -D @playwright/test
npx playwright install chromium
```

Chạy (frontend :3000 + backend :8081):

```bash
cd hkt/frontend
npx playwright test ../tests/ui/smoke.spec.ts
```

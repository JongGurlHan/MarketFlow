# Step 0: monorepo-setup

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `CLAUDE.md` (기술 스택·아키텍처 규칙·명령어)
- `docs/ARCHITECTURE.md` (모노레포 구조·빌드 순서)
- `docs/ADR.md` (단일 앱·인메모리 버스 결정)

## 작업

npm workspaces 모노레포의 **스캐폴드**를 만든다. 이 step은 뼈대만 만든다 — 실제 도메인 로직(스키마·커넥터·API·UI)은 다음 step들에서 채운다.

### 1. 루트 `package.json`
- `"private": true`
- `"workspaces": ["packages/shared", "apps/server", "apps/web"]` — **순서 중요**: `packages/shared`가 첫 번째여야 빌드가 먼저 된다.
- 스크립트:
  - `"build": "npm run build --workspaces --if-present"`
  - `"lint": "npm run lint --workspaces --if-present"`
  - `"test": "npm run test --workspaces --if-present"`
  - `"dev": "concurrently -n server,web -c blue,green \"npm run start:dev --workspace=@market/server\" \"npm run dev --workspace=web\""`
- devDependencies: `concurrently`, `typescript`.

### 2. 루트 `tsconfig.base.json`
- `compilerOptions`: `strict: true`, `target: "ES2021"`, `module: "commonjs"`, `moduleResolution: "node"`, `esModuleInterop: true`, `skipLibCheck: true`, `declaration: true`, `experimentalDecorators: true`, `emitDecoratorMetadata: true`.
- `paths`: `{ "@market/shared": ["packages/shared/src"] }`, `baseUrl: "."`.
- 각 workspace의 tsconfig는 이 파일을 `extends` 한다.

### 3. `packages/shared` (뼈대)
- `package.json`: name `@market/shared`, `main "dist/index.js"`, `types "dist/index.d.ts"`, scripts: `build "tsc -p tsconfig.json"`, `lint "eslint src --ext .ts"`, `test "jest --passWithNoTests"`. devDeps: `typescript`, `jest`, `ts-jest`, `@types/jest`, `eslint`, `zod`(dependencies).
- `tsconfig.json`: `extends ../../tsconfig.base.json`, `outDir dist`, `rootDir src`, `include ["src"]`.
- `jest.config.js`: ts-jest preset, testEnvironment node.
- `src/index.ts`: 임시 `export const SHARED_READY = true;` (다음 step에서 스키마로 대체)
- 최소 ESLint 설정(통과 가능한 관대한 구성).

### 4. `apps/server` (NestJS 뼈대 — `nest new` 대화형 도구 쓰지 말고 파일을 직접 생성)
- `package.json`: name `@market/server`, scripts: `build "nest build"`, `start:dev "nest start --watch"`, `start "node dist/main"`, `lint "eslint src --ext .ts"`, `test "jest"`. dependencies: `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`, `reflect-metadata`, `rxjs`, `@market/shared: "*"`. devDeps: `@nestjs/cli`, `@nestjs/schematics`, `@nestjs/testing`, `typescript`, `ts-jest`, `jest`, `@types/jest`, `@types/node`, `supertest`, `@types/supertest`, `source-map-support`, `eslint`.
- `nest-cli.json`, `tsconfig.json`(extends base + `outDir dist`), `tsconfig.build.json`.
- `src/main.ts`: `NestFactory.create(AppModule)`, `PORT` 환경변수(기본 `4000`)로 listen.
- `src/app.module.ts`: `HealthController`만 등록(다음 step에서 collector·distribution 모듈 추가).
- `src/health/health.controller.ts`: `GET /health` → `{ status: 'ok' }`.
- `jest.config.js`(ts-jest) + `src/health/health.controller.spec.ts`(health가 `{status:'ok'}` 반환 검증).
- 최소 ESLint 설정.

### 5. `apps/web` (Next.js 15 뼈대 — `create-next-app` 대화형 도구 쓰지 말고 파일을 직접 생성)
- `package.json`: name `web`, private, scripts: `dev "next dev -p 3000"`, `build "next build"`, `start "next start -p 3000"`, `lint "next lint"`, `test "jest --passWithNoTests"`. dependencies: `next`(15.x), `react`, `react-dom`, `@market/shared: "*"`. devDeps: `typescript`, `@types/react`, `@types/node`, `eslint`, `eslint-config-next`, `jest`, `jest-environment-jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `@types/jest`.
- `next.config.js`: `transpilePackages: ['@market/shared']`, `reactStrictMode: true`.
- `tsconfig.json`(Next 표준 + `paths`에 `@market/shared` 추가), `next-env.d.ts`.
- `src/app/layout.tsx`(다크 배경 `#0a0a0a`, 기본 폰트), `src/app/page.tsx`(임시 "MarketStream" 헤더 — 다음 step에서 대시보드로 대체).
- `.eslintrc.json`: `{ "extends": "next/core-web-vitals" }`.

### 6. 정리
- `apps/api`, `apps/collector` 디렉토리가 있으면 제거한다(구버전 잔해).
- 포트 규약: server `4000`, web `3000`. web은 `NEXT_PUBLIC_API_URL`(기본 `http://localhost:4000`)로 백엔드를 참조한다(다음 step에서 사용).

## Acceptance Criteria

```bash
npm install
npm run lint
npm run build
npm run test
```

네 커맨드가 모두 에러 없이 통과해야 한다. (`next build`는 최초 페이지만 빌드하면 됨. 테스트는 health 1건 + shared/web은 `--passWithNoTests`.)

## 검증 절차

1. 위 AC 커맨드를 순서대로 실행한다.
2. 아키텍처 체크리스트:
   - `docs/ARCHITECTURE.md`의 디렉토리 구조(packages/shared, apps/server, apps/web)를 따르는가?
   - workspaces 배열에서 `packages/shared`가 첫 번째인가?
   - `@market/shared` path alias가 tsconfig에 설정됐는가?
3. 결과에 따라 `phases/0-mvp/index.json`의 step 0을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"`에 생성한 workspace·핵심 스크립트·포트 규약을 한 줄로 요약.
   - 3회 시도 후 실패 → `"status": "error"`, `"error_message"`에 구체적 에러.

## 금지사항

- `nest new` / `create-next-app` 등 **대화형 스캐폴딩 CLI를 실행하지 마라.** 이유: 비대화형 실행(execute.py)에서 멈추거나 불필요한 파일을 대량 생성한다. 파일을 직접 작성하라.
- 도메인 로직(스키마 필드, 커넥터, REST/WS 핸들러, 대시보드 UI)을 이 step에서 구현하지 마라. 이유: 이 step은 뼈대만. 다음 step의 범위다.
- ESLint 규칙을 과도하게 설정해 스스로 lint를 막지 마라. 통과 가능한 최소 구성으로 시작하라.
- 기존 테스트를 깨뜨리지 마라.

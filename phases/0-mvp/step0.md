# Step 0: monorepo-setup

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md`
- `/docs/ARCHITECTURE.md`
- `/docs/ADR.md`

이 step은 첫 step이다. 이전 코드는 없다.

## 작업

npm workspaces 기반 TypeScript 모노레포 뼈대를 만든다. **`apps/web`(Next.js)은 이 step에서 만들지 않는다 (step 7).**

### 1. 루트
- `package.json`: `"private": true`, `"workspaces": ["packages/*", "apps/*"]`, `"engines": { "node": ">=20" }`.
  - scripts:
    - `"lint": "npm run lint --workspaces --if-present"`
    - `"build": "npm run build --workspaces --if-present"`
    - `"test": "npm run test --workspaces --if-present"`
    - `"dev": "concurrently -n collector,api \"npm run start:dev -w apps/collector\" \"npm run start:dev -w apps/api\""`
  - devDependencies: `typescript`(~5.4), `concurrently`, `@types/node`(^20), `eslint`, `@typescript-eslint/parser`, `@typescript-eslint/eslint-plugin`, `jest`, `ts-jest`, `@types/jest`.
- `tsconfig.base.json`: `strict: true`, `target: ES2021`, `module: CommonJS`, `moduleResolution: node`, `esModuleInterop: true`, `declaration: true`, `skipLibCheck: true`, `forceConsistentCasingInFileNames: true`.

### 2. `packages/shared` (`@market/shared`)
- `package.json`: `"name": "@market/shared"`, `"version": "0.0.0"`, `"main": "./dist/index.js"`, `"types": "./dist/index.d.ts"`.
  - scripts: `"build": "tsc -p tsconfig.json"`, `"test": "jest --passWithNoTests"`, `"lint": "eslint \"src/**/*.ts\""`.
- `src/index.ts`: 지금은 플레이스홀더만. `export const SHARED_PLACEHOLDER = true;` (실제 스키마는 step 1).
- `tsconfig.json`: base 상속, `rootDir: src`, `outDir: dist`.
- jest 설정(ts-jest, preset). 최소 통과 테스트 1개(`src/index.spec.ts`)로 `SHARED_PLACEHOLDER === true` 검증.

### 3. `apps/collector` (NestJS)
- NestJS 10 앱. deps: `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`, `reflect-metadata`, `rxjs`, `@market/shared`(`"*"`). devDeps: `@nestjs/cli`, `@nestjs/testing`, `@nestjs/schematics`, `ts-jest`, `jest`, `supertest`, `@types/supertest`, `source-map-support`.
- `HealthController`: `GET /health` → `{ status: 'ok', service: 'collector' }`.
- `main.ts`: `PORT`(env, 기본 `3001`)로 부트스트랩.
- package scripts: `"build": "nest build"`, `"start": "node dist/main"`, `"start:dev": "nest start --watch"`, `"test": "jest --passWithNoTests"`, `"lint": "eslint \"{src,test}/**/*.ts\""`.
- **jest 설정에 `moduleNameMapper`를 넣어 `@market/shared`를 `packages/shared/src`로 매핑하라** (테스트가 빌드 없이 소스를 참조하도록). 예: `"^@market/shared$": "<rootDir>/../../packages/shared/src"`.
- health에 대한 통과 테스트 1개.

### 4. `apps/api` (NestJS)
- collector와 동일한 셋업. `HealthController`: `GET /health` → `{ status: 'ok', service: 'api' }`. `PORT` 기본 `3002`.

### 5. 공통 규칙
- 모든 jest 스크립트는 `--passWithNoTests`를 포함해 "테스트 없음"으로 실패하지 않게 하라.
- `packages/shared`가 workspaces에서 먼저 빌드되도록 `"workspaces": ["packages/*", "apps/*"]` 순서를 유지하라 (`apps`가 빌드 시 `@market/shared`의 `dist` 타입을 참조).
- ESLint는 워크스페이스별로 두되, `npm run lint`가 **에러 0**으로 통과하도록 구성하라(경고는 허용).

## Acceptance Criteria

```bash
npm install
npm run lint
npm run build
npm run test
```
위 4개 명령이 모두 exit 0 이어야 한다.

## 검증 절차

1. 위 AC 커맨드를 순서대로 실행한다.
2. 아키텍처 체크리스트:
   - ARCHITECTURE.md의 디렉토리 구조(`apps/collector`, `apps/api`, `packages/shared`)를 따르는가?
   - collector와 api가 서로를 import하지 않는가?
   - ADR 기술 스택(NestJS 10, TS strict, npm workspaces)을 벗어나지 않았는가?
3. 결과에 따라 `phases/0-mvp/index.json`의 step 0을 업데이트:
   - 성공 → `"status": "completed"`, `"summary"`에 생성한 워크스페이스/스크립트 요약(한 줄)
   - 3회 시도 후 실패 → `"status": "error"`, `"error_message"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason"` 후 중단

## 금지사항

- `apps/web`(Next.js)를 만들지 마라. 이유: step 7에서 별도로 스캐폴드한다. 지금 만들면 step 0 복잡도·실패 위험이 커진다.
- 수집기/정규화/Redis 로직을 구현하지 마라. 이유: 이 step은 뼈대만. 각각 step 2/3/4다.
- 실 Redis·외부 네트워크에 연결하는 코드를 넣지 마라.
- 기존 테스트를 깨뜨리지 마라.

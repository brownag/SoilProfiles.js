# Execution Plan 2: Fix Munsell Hue Collapse via Continuous Numerical Approximation (G5)

## Goal & Scope

Replace the 6-hue collapse in `munsellToRgbApprox` (`src/utils/munsell-approx.ts`) with a continuous Munsell hue-angle numerical approximation (compact anchor grid + smooth CIELAB `a*, b*` interpolation calibrated against `soilprofiles-munsell/munsell-data.json`) so that `munsellToHex` produces distinct, accurate hex colors across all soil hues (`2.5YR`, `5YR`, `7.5YR`, `10YR`, `2.5Y`, `5Y`, etc.) without bundling the 10,450-row lookup table into `dist/`.

### In Scope
- **Continuous Munsell Hue-Angle Numerical Model**: Upgrade `src/utils/munsell-approx.ts` to parse any valid Munsell hue onto the continuous 0–100 Munsell hue circle and interpolate CIELAB `a*, b*` smoothly using a compact, calibrated anchor grid (no runtime LUT dependency).
- **Core Wrapper & Unit/Calibration Tests**: Verify `src/core/munsell.ts` preserves neutral `N` hue handling and invalid-input behavior, and add Jest unit tests in `tests/munsell.test.ts` verifying hue distinctness, accuracy against `soilprofiles-munsell/munsell-data.json` (read in tests only), neutral hues, and invalid inputs.
- **Build & ESM Bundle Verification**: Verify `npm test && npm run build` pass cleanly, confirm `dist/core.esm.js` remains lightweight (no 10,450-row LUT bundled), and verify via Node ESM import (`./dist/index.esm.js`) that `10YR 4/2` and `5YR 4/2` return distinct hex colors.

### Out of Scope
- Bundling `soilprofiles-munsell/munsell-data.json` as a runtime lookup table in `src/core/` or `dist/` (explicitly superseded by Decision 2026-11-26).
- Modifying `soilprofiles-munsell/` legacy files.
- Modifying unrelated renderers (`src/render/three3d.ts`, `src/render/interactive.ts`).
- Switching to or modifying branch `v020`.

### Verbatim Constraints
- "Do not modify unrelated renderers (`three3d`, `interactive`)."
- "Do not commit temporary/scratch files."
- "Preserve existing neutral `N` hue handling (e.g., `N 4/0`) and invalid-input behavior."
- "Run `npm test && npm run build` and verify both exit 0."
- "Confirm from Node that importing `./dist/index.esm.js` returns distinct hex colors for `10YR 4/2` and `5YR 4/2`."

---

## Decision Log

- **2026-11-26**: **Target branch**: Create a new branch off `main` (e.g., `fix/munsell-hue-approx`) rather than working on `v020` or committing directly to `main`. Note: `AGENTS.md` exists only on `v020`, not `main`.
- **2026-11-26**: **No runtime LUT**: Supersede the LUT-bundling approach in `G5_SOILPROFILES_PROMPT.md`. The core design goal of `SoilProfiles.js` is to avoid shipping a large lookup table and instead use a numerical method with LUT-grade precision.
- **2026-11-26**: **Numerical method**: Use continuous Munsell hue-angle (0–100 circle) with a compact anchor grid + smooth CIELAB `a*, b*` interpolation in `src/utils/munsell-approx.ts`, calibrated and validated in Jest against `soilprofiles-munsell/munsell-data.json` (test-only reference, never bundled in `dist/`).
- **2026-11-26**: **Planning artifacts**: Track `planning/EXECUTION_PLAN_2.md`, `planning/PROMPT_TEMPLATE_2.md`, and `planning/STATE_2.md` in git on the new branch, committed separately with `docs(planning):`.
- **2026-11-26**: **Worker & escalation models**: Run workers on `flash`; escalate to `hydrogen` on failure per the wave-orchestration escalation ladder.

---

## Recon & Hazard Notes

- **Baseline**: `npm test` passes 8/8 suites, 173/173 tests in ~2.0s on `main` (`5d6081e`).
- **Build command**: `npm run build` runs `tsc && node esbuild.config.js`. `dist/` is gitignored.
- **Reference data hazard**: `soilprofiles-munsell/munsell-data.json` (10,451 lines) uses JS object-literal syntax with unquoted keys (`{ hue: '10B', value: 1, chroma: 1, r: 0.0700, g: 0.1023, b: 0.1256 }`), NOT strict JSON. Any test or offline calibration script reading it must parse it accordingly (e.g., regex extraction or `new Function('return ' + raw)()`), and must NEVER import it from `src/`.
- **Planning `.gitignore` hazard**: `planning/.gitignore` currently contains `*`. When committing Orchestration 2 planning artifacts with `docs(planning):`, use `git add -f planning/EXECUTION_PLAN_2.md planning/PROMPT_TEMPLATE_2.md planning/STATE_2.md` (keeping `planning/tasks/*.todo.md` untracked unless explicitly added).
- **Pre-Wave 1 setup**: Before spawning Wave 1, orchestrator creates branch `fix/munsell-hue-approx` off `main`, commits the approved planning files (`docs(planning):`), and verifies `npm run build` passes cleanly, recording the result in `planning/STATE_2.md`.
- **Temp/scratch location**: `.development/` is not in `.gitignore`. If a worker uses `.development/` for a temporary calibration script, it MUST delete `.development/` before reporting; never commit scratch files.
- **Serial suite rule**: Full `npm test && npm run build` is run serially by the orchestrator at wave end; workers run only the targeted test command in their spec.
- **Escalation rules**:
  1. Micro-plan off-spec twice -> orchestrator writes the micro-TODO itself and hands it to the worker as fixed input.
  2. Acceptance fails after one retry (retry = failure output fed back with `FAILED VERIFICATION: ...`) -> stop the `flash` worker and re-run on `hydrogen`. Never a third small-model attempt.
  3. Malformed/missing report -> one retry with feedback, then escalate to `hydrogen`.
  4. Out-of-scope edit needed -> re-scope task spec in `EXECUTION_PLAN_2.md`; do not widen worker permissions ad hoc.

---

## Wave / Dependency Table

| Wave | Task ID | Title | Files in Scope | Depends On |
|------|---------|-------|----------------|------------|
| **1** | `2.1.1` | Implement continuous Munsell hue-angle interpolation | `src/utils/munsell-approx.ts` | None |
| **2** | `2.2.1` | Verify core wrapper and add Munsell distinctness & calibration tests | `tests/munsell.test.ts`, `src/core/munsell.ts` (if needed) | `2.1.1` |
| **3** | `2.3.1` | Add ESM dist Munsell verification and validate build | `tests/package.test.ts` | `2.2.1` |

---

## Task Specifications

### Task 2.1.1: Implement continuous Munsell hue-angle interpolation
- **Task ID**: `2.1.1`
- **Repo**: `/home/andrew/workspace/SoilProfiles.js`
- **Files in Scope**:
  - Must edit: `src/utils/munsell-approx.ts`
  - Temp/scratch: `.development/` (delete before reporting)
  - Cannot touch: `src/render/three3d.ts`, `src/render/interactive.ts`, `soilprofiles-munsell/*`, or any other file
- **Depends On**: None
- **Spec Prose**:
  Upgrade `src/utils/munsell-approx.ts` to eliminate the 6-hue collapse (`5R, 5YR, 5Y, 5G, 5B, 5P` suffix fallback) while keeping the implementation compact and LUT-free at runtime:
  1. Add a helper to parse any valid Munsell hue string (e.g., `2.5YR`, `5YR`, `7.5YR`, `10YR`, `2.5Y`, `5Y`, `10R`, `7.5BG`, etc.) into a continuous hue angle in `[0, 100)` around the 10-family Munsell circle (`R`: 0–10, `YR`: 10–20, `Y`: 20–30, `GY`: 30–40, `G`: 40–50, `BG`: 50–60, `B`: 60–70, `PB`: 70–80, `P`: 80–90, `RP`: 90–100). Return `null` for invalid hue families or out-of-range numbers (`<= 0` or `> 10`).
  2. Replace the 6-hue `hueData` table with a compact calibrated anchor grid covering all 10 major hue families (e.g., 10 or 20 evenly spaced hue anchors at representative chromas, calibrated offline against `soilprofiles-munsell/munsell-data.json`) so that CIELAB `(a*, b*)` can be smoothly interpolated across both circular hue angle and chroma (and optionally value-adjusted if needed for accuracy).
  3. Update `interpolateLab(hue, chroma)` and `munsellToRgbApprox(munsellString)` to use continuous circular hue-angle interpolation between the two bracketing hue anchors (handling wrap-around across 0/100 between `RP` and `R`).
  4. Preserve neutral `N` hue handling (`a = 0, b = 0`), `munsellValueToY`, `labToXyz`, `xyzToRgb`, and `null` returns for invalid inputs.
  5. Do NOT import or embed `soilprofiles-munsell/munsell-data.json` in `src/`.
- **Reference Implementation**:
  Existing `munsellValueToY`, `labToXyz`, `xyzToRgb`, and `interpolateLab` in `src/utils/munsell-approx.ts`.
- **Grep Anchors**:
  - `src/utils/munsell-approx.ts:27`: `export const hueData: Record<string, ChromaPoint[]> = {`
  - `src/utils/munsell-approx.ts:88`: `export function interpolateLab(hue: string, chroma: number): { a: number; b: number } | null {`
  - `src/utils/munsell-approx.ts:196`: `export function munsellToRgbApprox(munsellString: string): string | null {`
  - `src/utils/munsell-approx.ts:227`: `if (isNeutral) {`
- **Targeted Test Command**: `npm test -- tests/munsell.test.ts`
- **Acceptance Criteria**:
  - `npm test -- tests/munsell.test.ts` passes with 0 failures.
  - `! grep -rn "munsell-data" src/` exits 0 (no runtime import or reference to `munsell-data.json` in `src/`).
  - `wc -l src/utils/munsell-approx.ts` is `<= 600` lines (compact numerical model, no large LUT embedded).
  - `npx tsc --noEmit` exits 0.

### Task 2.2.1: Verify core wrapper and add Munsell distinctness & calibration tests
- **Task ID**: `2.2.1`
- **Repo**: `/home/andrew/workspace/SoilProfiles.js`
- **Files in Scope**:
  - Must edit: `tests/munsell.test.ts`
  - Can edit (only if edge-case normalization fix is needed): `src/core/munsell.ts`
  - Cannot touch: `src/utils/munsell-approx.ts`, `src/render/three3d.ts`, `src/render/interactive.ts`, or any other file
- **Depends On**: `2.1.1`
- **Spec Prose**:
  1. Inspect `src/core/munsell.ts` to confirm `munsellToHex` cleanly delegates to `munsellToRgbApprox` while preserving neutral `N` hue handling (`N 4/0`, `N 2/`, `N 2/-`, case-insensitivity) and invalid-input `null` returns.
  2. Expand `tests/munsell.test.ts` with unit tests verifying:
     - `munsellToHex('10YR', 4, 2) !== munsellToHex('5YR', 4, 2)`
     - Distinct hex values across common soil hues (`2.5YR`, `5YR`, `7.5YR`, `10YR`, `2.5Y`, `5Y`) at the same value/chroma (e.g., `4/2` and `5/6`), asserting all 6 are unique valid hex strings.
     - Calibration accuracy test reading `soilprofiles-munsell/munsell-data.json` (parsed in the test file only via `fs.readFileSync`) and verifying that across common soil hues (`2.5YR`, `5YR`, `7.5YR`, `10YR`, `2.5Y`, `5Y`) at typical soil values/chromas (value 2–8, chroma 1–8), `munsellToHex` closely approximates the reference sRGB values with mean per-channel RGB error `<= 15/255`.
     - Neutral `N` hues (`N 4/0`, `N 2/0`, `N 2/`, `N 2/-`, `n 2/-`) and out-of-range/invalid inputs (`value < 0`, `value > 10`, `chroma < 0`, invalid hue strings, `undefined`) still behave as expected.
- **Reference Implementation**:
  Existing tests in `tests/munsell.test.ts`.
- **Grep Anchors**:
  - `src/core/munsell.ts:12`: `export function munsellToHex(`
  - `tests/munsell.test.ts:63`: `it('should handle common soil hues', () => {`
  - `tests/munsell.test.ts:87`: `it('should support neutral hues (gray shades) with various chroma formats', () => {`
- **Targeted Test Command**: `npm test -- tests/munsell.test.ts`
- **Acceptance Criteria**:
  - `npm test -- tests/munsell.test.ts` passes with all new assertions green.
  - Neutral `N` and invalid-input tests remain green.

### Task 2.3.1: Add ESM dist Munsell verification and validate build
- **Task ID**: `2.3.1`
- **Repo**: `/home/andrew/workspace/SoilProfiles.js`
- **Files in Scope**:
  - Must edit: `tests/package.test.ts`
  - Can create/update (build output): `dist/`
  - Cannot touch: `src/**/*`, `esbuild.config.js`, `package.json`, or any other file
- **Depends On**: `2.2.1`
- **Spec Prose**:
  1. Run `npm run build` so `dist/` reflects the updated `src/utils/munsell-approx.ts`.
  2. Add a test case in `tests/package.test.ts` verifying that importing `munsellToHex` from the built ESM bundle (`./dist/index.esm.js`) returns distinct, valid hex colors for `('10YR', 4, 2)` and `('5YR', 4, 2)`.
  3. Confirm via Node CLI that `import('./dist/index.esm.js')` returns distinct hex colors for `10YR 4/2` and `5YR 4/2`, and verify `dist/core.esm.js` remains lightweight (`< 50 KB`, confirming no 10,450-row LUT was bundled).
- **Reference Implementation**:
  Existing export subpath existence checks in `tests/package.test.ts` (lines 44–77).
- **Grep Anchors**:
  - `tests/package.test.ts:1`: `import { existsSync, readFileSync } from 'fs';`
- **Targeted Test Command**: `npm run build && npm test -- tests/package.test.ts`
- **Acceptance Criteria**:
  - `npm run build && npm test -- tests/package.test.ts` exits 0.
  - `node -e "import('./dist/index.esm.js').then(m => { const a = m.munsellToHex('10YR', 4, 2); const b = m.munsellToHex('5YR', 4, 2); console.log({a, b}); if (!a || !b || a === b) process.exit(1); })"` exits 0.
  - `node -e "const sz = require('fs').statSync('dist/core.esm.js').size; console.log({coreEsmBytes: sz}); if (sz >= 51200) process.exit(1);"` exits 0.

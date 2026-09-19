# TODO

## Goal
Prepare and release v0.2.0 with parsers, bundled entry points, and verified deployment workflow.

## Tasks

### 1. Verification
- [x] Run demo (`make demo`) and verify soil profiles render in browser ✓ (demo server running at http://localhost:4173)
- [x] Test CommonJS import ✓ (renderStaticSVG function loads)
- [x] Verify ESM bundle exists (dist/index.esm.js generated, intended for bundlers not direct Node.js import)
- [x] Verify parser imports ✓ (parseOSDJson function loads)

### 2. Commit & Tag
- [x] Stage changes ✓
- [x] Create commit ✓ (0eee05f)
- [x] Create git tag v0.2.0 ✓ (annotated)
- [x] Push branch and tags to origin ✓

### 3. Release
- [ ] **MANUAL**: Create GitHub release from v0.2.0 tag (https://github.com/brownag/SoilProfiles.js/releases) with NEWS.md content — triggers publish.yml
- [ ] **MANUAL**: Verify publish workflow runs and succeeds (check GitHub Actions tab)
- [ ] **MANUAL**: Confirm `npm view soilprofiles@0.2.0` shows on npm registry

## Notes
- All 150 tests pass, build clean
- publish.yml triggers on GitHub release published (requires NPM_TOKEN secret)
- No breaking changes; parser APIs are stable
- Bundle sizes stable (~40-84 KB)

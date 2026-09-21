# himmel workspace

Porting [osgHimmel](https://github.com/cgcostume/osghimmel) (a C++/OpenSceneGraph sky-rendering
library the user, Daniel Limberger, github: cgcostume, wrote as his own HPI master's thesis,
2011-2012) to modern TypeScript + WebGPU (compute-first), as a family of small, independent,
composable libraries. Goal: drop any single one into an existing WebGPU renderer without pulling
in the rest.

A read-only reference clone of the original lives at `./osghimmel` (kept here, not `/tmp`, so it
survives across sessions). Check it when porting a new module, don't guess at the original
algorithm from memory.

## Repo topology

**Monorepo** at `cgcostume/himmel` (this directory is the repo root), pnpm workspace. What stays
independent are the **npm packages**, not the repos: each library under `packages/*` is its own
published `@himmel/*` package with its own `package.json`, `dist`, README and version. The earlier
polyrepo (`cgcostume/himmel-sternzeit`, `cgcostume/himmel-dunstkreis`) was dropped without history
and is to be deleted by the user.

```
packages/<name>/   one directory per published @himmel/* package
site/              sternwarte: the single website (Astro), private, never published to npm
osghimmel/         read-only reference clone, gitignored
```

| npm package | Directory | Status |
|---|---|---|
| `@himmel/sternzeit` (astronomy/sidereal time math) | `packages/sternzeit` | Julian Day, sidereal time, sun/moon/earth positions, moon phase, sun direction from the moon and earthshine done (precise + approx); stars stubbed |
| `@himmel/dunstkreis` (WebGPU atmosphere, Bruneton precise + Hillaire fast) | `packages/dunstkreis` | Hillaire pipeline + dev page working; Bruneton, IBL, performance pending |
| `@himmel/sternwarte` (the website, `private: true`) | `site/` | sternzeit chapter done (glossary tooltips, references); dunstkreis chapter placeholder; no Pages deploy yet |
| `@himmel/gewoelk` (clouds) | not created yet | later |
| `@himmel/sternenzelt` (star rendering) | not created yet | later |
| `@himmel/nachtgestirn` (moon rendering) | not created yet | later |

**sternwarte** is one site for all libraries, structured like a blog with one chapter per library:
explains the techniques, showcases them, makes them explorable (WebGPU canvases, zdog
visualizations, sliders/buttons, code examples). Plus a generated API reference (TypeDoc to
Markdown). Terms are explained only as hover tooltips, in the text (`<Term>`) and in tables, from one
site-wide glossary (`site/src/data/glossary.json`); no glossary pages, no per-package GLOSSARY.md.
Sources are cited with `<Cite>` and listed at the end of each chapter (`site/src/data/references.ts`).
Final showpiece: one comprehensive demo
combining sun, moon, atmosphere, stars, clouds. Audience: developers who want to use the
libraries; should be a joy to read, educational, and nerdy. Hard requirements, non-negotiable:
runs locally with a single command, deploys as static files to GitHub Pages, no other hosting.
The per-package `static/` dev pages are interim and get deleted once their chapter exists in the
site.

**No cross-module hard dependencies.** `dunstkreis` doesn't depend on `sternzeit`, it takes a
sun/moon direction vector + time as plain inputs. Whoever embeds it computes that vector however
they like. Keep this decoupling for every future module too.

**Directions are ENU** (x east, y north, z up, right-handed) in every package: sternzeit's
`horizontalToDirection` and `moon.sunDirection`, dunstkreis' `sunDirection` input and view rays. Azimuths are
compass azimuths (from north through east). A y-up engine converts with `(x, z, -y)`.

**Dropped from the port:** the original's stateful OOP facade (`AbstractAstronomy` to
`Astronomy`/`Astronomy2`, holding mutable time/lat/lon). Everything is plain functions instead,
simpler, tree-shakeable, no hidden state. Don't reintroduce a class hierarchy when porting more of
`astronomy.cpp`.

**Precise + fast variants.** The original ships both a Meeus-precision implementation and a
cheaper Jensen et al. approximation for sun/moon/earth/sidereal-time math (`sun.cpp` vs
`sun2.cpp`, etc.). Port both as a pair of functions (see `meanSiderealTime` /
`meanSiderealTimeApprox` in `sternzeit` for the established naming pattern), not just the precise
one.

## Local dev setup

Open this directory as a plain VS Code folder (single root). `pnpm install` at the root installs
everything; one `pnpm-lock.yaml`, one `biome.json`, one `tsconfig.base.json` (each package's
`tsconfig.json` extends it). Cross-package dependencies use `workspace:*` (e.g. dunstkreis' dev page
uses sternzeit), which pnpm rewrites to real version ranges on publish.

Root scripts: `pnpm dev` (site at http://localhost:4321/himmel/), `pnpm build`, `pnpm typecheck`, `pnpm test` (recursive), `pnpm lint`, `pnpm format`, `pnpm clean` (removes everything generated, including `node_modules`).

## Tooling (same across every `@himmel/*` package)

- **TypeScript**, strict, ESM-only (`type: module`, no CJS output).
- **pnpm** as the only package manager (no npm/yarn).
- **Rolldown** (+ `rolldown-plugin-dts`) as the bundler, chosen over tsup after comparing
  GitHub activity/stars; Vite itself is migrating to Rolldown internally.
- **Playwright** as the *only* test runner, including pure-math unit tests (no Vitest). Test files
  that never touch the `page`/`browser` fixtures run with zero browser overhead, so this doesn't
  cost anything for e.g. `sternzeit`'s golden-value tests, and it unifies with visual-regression
  tests once there's something to render.
- **Biome** (not Prettier/ESLint) for formatting + linting. Needs the `biomejs.biome` VS Code
  extension installed manually. Config: 4-space indent, 120-column line width, `formatOnSave` on.
- **Shared config lives at the root** (`biome.json`, `tsconfig.base.json`), not in a config package.
- **Astro** for the site (`site/`): content collections + MDX per chapter, zero JS by default,
  every interactive demo is an island. Only acceptable as long as it stays static-exportable to
  GitHub Pages and runs locally with one command. The site pins TypeScript 6: `astro check` needs the
  programmatic compiler API, which TypeScript 7 (native) does not ship yet.
- **MIT license**, no NOTICE/BSD-carryover needed. The user is the sole author/rights-holder of
  the original osgHimmel work (his own thesis, not employer-commissioned), so relicensing is his
  call.

## Working conventions

- **Never commit without explicit approval in the moment**, even for setup/scaffolding work.
- No em-dash characters anywhere: not in code, comments, docs, or commit messages. Use a comma,
  colon, parentheses, or split into two sentences instead.
- Prefer one-line code and comments (including JSDoc) whenever it fits ~120 columns and stays
  readable; don't wrap just because that's how it was first typed.
- Large binary/data assets (e.g. the ~9k-star catalog in `sternzeit`): keep a checked-in CSV as
  the human-readable source of truth, generate a binary (flat `Float32Array`, matching whatever
  precision the original C data actually had, don't over-precision to float64) via a dedicated,
  rerunnable package script. One-shot conversions (e.g. extracting data out of vendored original
  C++ source) don't need to stay as a repo script once their output is checked in.

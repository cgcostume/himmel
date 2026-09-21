# @himmel/sternzeit

Sidereal time and astronomical position math (sun, moon, stars) for sky
rendering. A TypeScript port of the astronomy core of
[osgHimmel](https://github.com/cgcostume/osghimmel), with no rendering or
DOM dependencies, usable from Node, a worker, or any renderer.

Part of the `@himmel/*` family (see [dunstkreis](https://github.com/cgcostume/himmel/tree/main/packages/dunstkreis)
for atmosphere rendering). Modules are intentionally decoupled: consumers
compute positions here and pass plain vectors/angles into the rendering
packages themselves.

New to terms like nutation, obliquity, or libration? The [himmel site](https://github.com/cgcostume/himmel) explains every one of them, right where it is used.

## Status

Julian Day conversions, mean sidereal time, and Sun/Moon/Earth position math
(coordinates, orbital elements, nutation, apparent position, distance,
libration, parallactic angle, atmospheric refraction in both directions) are
implemented, each with a precise (Meeus) and a cheaper approximate (Jensen
et al.) variant; see `.` vs. `./approx` in `package.json#exports`. The bright
star catalog is checked in (`src/data/`), but there is no star API yet.

Stars are next, and the reason the package is named `sternzeit` at all:
apparent position (proper motion and precession of the J2000 catalog
coordinates), the B-V to color-temperature to sRGB colorimetry, apparent
magnitude to linear radiance, and an optionally importable loader for the
~290 KB binary catalog. `src/stars.ts` sketches the intended surface.

## References

osgHimmel itself originated as [Daniel Limberger](https://daniellimberger.de)'s (né Müller) master's thesis at
HPI: ["Photorealistisches Rendering atmosphärischer Effekte in geovirtuellen 3D-Umgebungen in
Echtzeit"](https://daniellimberger.de/resources/2012%20%E2%80%93%20Mueller%20%28now%20Limberger%29%20%E2%80%93%20Photorealistisches%20Rendering%20atmosphaerischer%20Effekte%20in%20geovirtuellen%203D-Umgebungen%20in%20Echtzeit.pdf)
(2012, German).

The primary sources cited throughout the code (see individual function docstrings for exact section/equation numbers):

- Jean Meeus, *Astronomical Algorithms* (2nd ed., Willmann-Bell, 1998): the precise variants' main source.
- H. Wann Jensen, F. Durand, J. Dorsey, M. M. Stark, P. Shirley, S. Premože,
  ["A Physically-Based Night Sky Model"](https://graphics.cs.yale.edu/publications/physically-based-night-sky-model)
  (SIGGRAPH 2001): the approximate variants' main source.
- NSSDC planetary fact sheets: [Earth](http://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html),
  [Moon](http://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html),
  [Sun](http://nssdc.gsfc.nasa.gov/planetary/factsheet/sunfact.html): mean radii and similar constants.
- P. Bretagnon, *Théorie du mouvement de l'ensemble des planètes. Solution VSOP82* (1982): Earth's orbital eccentricity.
- G. G. Bennett, "The Calculation of Astronomical Refraction in Marine Navigation" (Journal of Navigation,
  1982), and Þorsteinn Sæmundsson, "Atmospheric Refraction" (Sky and Telescope, 1986): atmospheric refraction.
  Meeus gives both directions as separate empirical fits: Bennett's (15.3) takes the apparent altitude
  (`atmosphericRefractionFromApparent`, what a renderer warping a camera ray needs), Sæmundsson's (15.4) the
  true one (`atmosphericRefraction`). They differ by ~5' at the horizon and are not interchangeable.
- T. Nishita, T. Sirai, K. Tadamura, E. Nakamae, "Display of the Earth Taking into Account Atmospheric
  Scattering" (SIGGRAPH 1993), and E. Bruneton, F. Neyret, "Precomputed Atmospheric Scattering" (2008):
  atmosphere thickness constant.
- Daniel Müller (now Limberger), Juri Engel, Jürgen Döllner,
  ["Single-Pass Rendering of Day and Night Sky Phenomena"](https://diglib.eg.org/items/0b9332fd-d155-452a-b9e0-1c605d557730)
  (VMV 2012): lunar eclipse phase parameterization (`eclipse.ts`).

## Development

Part of the [himmel monorepo](https://github.com/cgcostume/himmel); run these from the repository root.

```sh
pnpm install     # everything, once
pnpm build       # rolldown -> dist/*.js + dist/*.d.ts, for every package
pnpm typecheck
pnpm lint        # biome, repo-wide
pnpm test        # playwright
pnpm dev         # the site, where this library's chapter lives: http://localhost:4321/himmel/sternzeit/
```

`pnpm generate:catalog` (inside `packages/sternzeit`) regenerates the binary star catalog from its CSV.

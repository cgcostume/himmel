# Data

## Tables

- `nutation.json`: the 63 terms of the IAU 1980 nutation, Meeus table 22.A.
- `moon.json`: the Moon's periodic terms for longitude, distance and latitude, Meeus tables 47.A and 47.B.
- `deltat.json`: the observed ΔT on January 1 of each year since 1962, from the IERS. Regenerate with
  `pnpm generate:deltat`, e.g. once a year.

Each table names its source and columns. All three are cross-checked in `tests/astronomia.spec.ts`.

## Star catalog

`brightstars.csv` (9,093 stars: `vmag,ra,de,pmRa,pmDe,sRgbR,sRgbG,sRgbB`) is
the checked-in source of truth, originally extracted from
[osgHimmel](https://github.com/cgcostume/osghimmel)'s `brightstars.cpp`.

**Provenance:** star positions/magnitudes/proper motion (RA, DE, Vmag, pmRA,
pmDE) originate from the Yale Bright Star Catalogue (BSC5). The sRGB columns
were precomputed for osgHimmel from each star's B-V color index via
`Stars::sRgbColor()`: B-V → color temperature → Planckian locus in CIE xy →
CIE XYZ tristimulus → sRGB.

`brightstars.bin` is generated from the CSV, a flat little-endian
`Float32Array`, matching the original C++ `float` precision:

```sh
pnpm generate:catalog
```

Run that whenever `brightstars.csv` is hand-edited.

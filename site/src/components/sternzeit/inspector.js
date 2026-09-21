import * as precise from "@himmel/sternzeit";
import * as approx from "@himmel/sternzeit/approx";
import { formatDMS } from "./format.js";
import { onChange, state } from "./state.js";

// Unit of each export's return value (or of an object return's fields, which all share one unit here).
// Anything not listed defaults to degrees, the overwhelming majority.
const UNITS = {
    MEAN_RADIUS_KM: "km",
    ATMOSPHERE_THICKNESS_KM: "km",
    ATMOSPHERE_THICKNESS_NON_UNIFORM_KM: "km",
    APPARENT_MAGNITUDE_LIMIT: "mag",
    distance: "km",
    viewDistanceWithinAtmosphere: "km",
    orbitEccentricity: "",
    apparentAngularSunDiameter: "rad",
    apparentAngularMoonDiameter: "rad",
    "solar.phase": "",
    "solar.linearPhase": "",
    "lunar.axisOffsetKm": "km",
    "lunar.phase": "",
    "lunar.linearPhase": "",
};
const DEFAULT_UNIT = "deg";

// One-sentence, plain-language descriptions shown as each row's title-attribute tooltip. Keyed by name, or
// "name.field" for object-returning exports; same name means the same kind of quantity regardless of which
// domain (sun/moon) it's under, so most entries don't need a body-specific variant.
const DESCRIPTIONS = {
    MEAN_RADIUS_KM: "The body's mean radius, in kilometers.",
    ATMOSPHERE_THICKNESS_KM:
        "The uniform-density atmosphere thickness used for simplified scattering models, in kilometers.",
    ATMOSPHERE_THICKNESS_NON_UNIFORM_KM:
        "The atmosphere thickness accounting for its actual density falloff with altitude, in kilometers.",
    APPARENT_MAGNITUDE_LIMIT: "The faintest apparent magnitude generally considered visible to the naked eye.",
    atmosphericRefraction:
        "How much refraction lifts the Sun above its true, geometric altitude right now (at the horizon while it is down).",
    atmosphericRefractionFromApparent:
        "The same refraction, computed from the apparent altitude instead: what a renderer bending its view rays needs.",
    orbitEccentricity:
        "How far Earth's orbit around the Sun deviates from a perfect circle (0 = circular, closer to 1 = more elongated).",
    apparentAngularSunDiameter: "The Sun's apparent angular width as seen from Earth, in radians.",
    apparentAngularMoonDiameter: "The Moon's apparent angular width as seen from Earth, in radians.",
    longitudeNutation:
        "The small periodic wobble in the direction of the equinox, caused mainly by the Moon's pull on Earth's equatorial bulge.",
    obliquityNutation:
        "The small periodic wobble in Earth's axial tilt itself, the companion effect to longitudeNutation.",
    meanObliquity:
        "Earth's axial tilt relative to its orbital plane, smoothed to remove the short-term nutation wobble.",
    trueObliquity: "Earth's actual axial tilt relative to its orbital plane right now, including the nutation wobble.",
    viewDistanceWithinAtmosphere:
        "How far a line of sight towards the Sun travels through Earth's atmosphere before leaving it, in kilometers.",
    meanAnomaly:
        "How far the body has traveled along its orbit since perihelion, as if the orbit were circular and traversed at constant speed.",
    meanLongitude: "The body's ecliptical longitude if its orbit were circular and traversed at constant speed.",
    center: "The correction added to the Sun's mean anomaly to account for its orbit's actual, elliptical (not circular) shape.",
    trueAnomaly: "How far the body has actually traveled along its real, elliptical orbit since perihelion.",
    trueLongitude:
        "The Sun's actual ecliptical longitude: meanLongitude corrected for the orbit's true elliptical shape.",
    "apparentPosition.rightAscension":
        "The body's east-west sky coordinate, like celestial longitude, measured along the celestial equator from the vernal equinox.",
    "apparentPosition.declination":
        "The body's north-south sky coordinate, like celestial latitude, measured from the celestial equator.",
    "horizontalPosition.altitude": "How high the body appears above the observer's local horizon, in degrees.",
    "horizontalPosition.azimuth": "The compass-like direction of the body along the observer's local horizon.",
    distance: "Distance from Earth's center to the body's center, in kilometers.",
    meanElongation: "The Moon's mean angular separation from the Sun, as seen from Earth.",
    meanArgumentOfLatitude:
        "The Moon's mean angular distance from where its orbit crosses Earth's orbital plane, its ascending node.",
    meanAscendingNodeLongitude:
        "The ecliptical longitude of the point where the Moon's orbit crosses Earth's orbital plane heading north.",
    "position.longitude":
        "The Moon's ecliptical longitude: its position along the ecliptic, measured from the vernal equinox.",
    "position.latitude": "The Moon's ecliptical latitude: how far it strays north or south of the ecliptic plane.",
    "opticalLibrations.longitude":
        "How far the Moon's near side rocks east-west beyond its average-facing hemisphere, letting us see a little past its edge.",
    "opticalLibrations.latitude":
        "How far the Moon's near side rocks north-south beyond its average-facing hemisphere, letting us see a little past its pole.",
    parallacticAngle:
        "The angle between the Moon's north pole direction and straight up (the local zenith) as seen by the observer.",
    positionAngleOfAxis: "The angle between the Moon's rotation axis and celestial north, as seen from Earth.",
    "solar.separation": "Apparent center-to-center separation between Sun and Moon as seen by the observer.",
    "solar.positionAngle":
        "Direction from the Sun's center to the Moon's center in the observer's sky, from up through east.",
    "solar.phase":
        "0 (centered) to 1 (discs just touching), 0.5 at the total/annular-to-partial boundary; above 1 means no eclipse.",
    "solar.linearPhase": "Same as solar.phase, but as one global linear fraction (0.5 doesn't mean the same thing).",
    "lunar.separation": "The Moon's angular distance from the axis of Earth's shadow, as seen geocentrically.",
    "lunar.axisOffsetKm": "The Moon's linear distance from the axis of Earth's shadow, at the Moon's own distance.",
    "lunar.positionAngle":
        "Direction from Earth's shadow axis to the Moon, in ecliptical degrees from north through east.",
    "lunar.phase":
        "0 (umbra center) to 1 (penumbra edge), 0.5 at the umbra/penumbra boundary; above 1 means no eclipse.",
    "lunar.linearPhase": "Same as lunar.phase, but as one global linear fraction (0.5 doesn't mean the same thing).",
};

function describe(name, field) {
    return DESCRIPTIONS[field ? `${name}.${field}` : name] ?? "";
}

// How to call an export that isn't just fn(julianDay). Anything not listed here falls back to
// fn.length === 0 ? fn() : fn(jd).
// The Sun's current true altitude, clamped to the horizon while it is down: what the refraction and view-distance
// rows are evaluated for, since they need a direction and the Sun's is the one a sky renderer cares about most.
function sunAltitude(jd) {
    const { altitude } = precise.sun.horizontalPosition(precise.fromJulianDay(jd), state.latitude, state.longitude);
    return Math.max(0, altitude);
}

// How to call an export that isn't just fn(julianDay). Anything not listed here falls back to
// fn.length === 0 ? fn() : fn(jd).
const CALL_OVERRIDES = {
    atmosphericRefraction: (fn, jd) => fn(sunAltitude(jd)),
    // Fed the apparent altitude it expects: the true one lifted by the refraction from the row above.
    atmosphericRefractionFromApparent: (fn, jd) =>
        fn(sunAltitude(jd) + precise.earth.atmosphericRefraction(sunAltitude(jd))),
    // y = sin(altitude), the vertical component of a unit view direction vector.
    viewDistanceWithinAtmosphere: (fn, jd) => fn(Math.sin(sunAltitude(jd) * DEG_TO_RAD)),
    // jd is already an absolute instant; fromJulianDay(jd) (offset 0) round-trips it as a UT AstronomicalTime,
    // which is what julianDayUT() inside horizontalPosition/parallacticAngle expects. A nonzero offset here
    // would double-shift the instant, since jd carries no timezone to begin with.
    horizontalPosition: (fn, jd) => fn(precise.fromJulianDay(jd), state.latitude, state.longitude),
    topocentricPosition: (fn, jd) => fn(precise.fromJulianDay(jd), state.latitude, state.longitude),
    parallacticAngle: (fn, jd) => fn(precise.fromJulianDay(jd), state.latitude, state.longitude),
    // lunar takes just jd like the fn(jd) default already handles; only solar needs observer location too.
    solar: (fn, jd) => fn(precise.fromJulianDay(jd), state.latitude, state.longitude),
};

const DECIMALS = 4;

// Fixed decimal count + a reserved sign column (a space where "-" would go) so that, combined with the
// monospace font and right-aligned cells, digits/decimal points/signs all line up down a column. Thousands
// separators (km values can run into the hundreds of millions) don't break that: they only ever land left
// of the decimal point, so the fixed-width decimal tail every row ends with stays aligned regardless.
function formatDecimal(n, unit) {
    const sign = n < 0 ? "-" : " ";
    const formatted = Math.abs(n).toLocaleString("en-US", {
        minimumFractionDigits: DECIMALS,
        maximumFractionDigits: DECIMALS,
        useGrouping: unit === "km",
    });
    return sign + formatted;
}

// Widest value this app ever formats here, "(-330.7170°)", fixes the group's width so left-padding it
// (rather than padding the digits inside) lines up the closing paren, and therefore the DMS notation
// that follows, on the same column every row.
const DEG_PAREN_WIDTH = 12;

// The parenthetical shows the raw value in its own actual unit (matching the unit column: "°" for deg,
// nothing extra for rad since the column already says "rad"), while the DMS notation after it is always
// the degrees breakdown regardless of which unit the row is actually in.
function formatDegreesLike(rawValue, rawSuffix, degreesValue) {
    const sign = rawValue < 0 ? "-" : "";
    const paren = `(${sign}${Math.abs(rawValue).toFixed(DECIMALS)}${rawSuffix})`.padStart(DEG_PAREN_WIDTH, " ");
    return `${paren}  ${formatDMS(degreesValue)}`;
}

const RAD_TO_DEG = 180 / Math.PI;
const DEG_TO_RAD = Math.PI / 180;

function formatNumber(n, unit) {
    if (!Number.isFinite(n)) return String(n);
    if (unit === "deg") return formatDegreesLike(n, "°", n);
    // The unit column still says "rad" (that's genuinely what the export returns); only the DMS half
    // converts to degrees; the parenthetical stays the actual raw radian value, not a converted one.
    if (unit === "rad") return formatDegreesLike(n, "", n * RAD_TO_DEG);
    return formatDecimal(n, unit);
}

function formatValue(value, unit) {
    if (typeof value === "number") return formatNumber(value, unit);
    if (typeof value === "object" && value !== null) {
        return Object.entries(value)
            .map(([k, v]) => `${k}: ${formatValue(v, unit)}`)
            .join(", ");
    }
    return String(value);
}

function callExport(name, entry, jd) {
    if (typeof entry === "number") return entry;
    if (typeof entry !== "function") return undefined;
    const override = CALL_OVERRIDES[name];
    try {
        return override ? override(entry, jd) : entry.length === 0 ? entry() : entry(jd);
    } catch (err) {
        return `error: ${err.message}`;
    }
}

function isPlainObject(value) {
    return typeof value === "object" && value !== null;
}

function cell(value, present, unit) {
    return present ? `<td class="value">${formatValue(value, unit)}</td>` : `<td class="value missing">—</td>`;
}

// Delta as a signed, fixed-decimal value with the row's own unit suffix, e.g. "Δ +0.0004°". Kept as a plain
// signed decimal rather than formatNumber's full DMS breakdown: a tooltip is for "how far off is this",
// not a value to read precision out of.
function formatDelta(delta, unit) {
    const sign = delta < 0 ? "-" : "+";
    const suffix = unit === "deg" ? "°" : unit === "rad" ? " rad" : unit ? ` ${unit}` : "";
    const formatted = Math.abs(delta).toLocaleString("en-US", {
        minimumFractionDigits: DECIMALS,
        maximumFractionDigits: DECIMALS,
    });
    return `Δ ${sign}${formatted}${suffix}`;
}

// Same as cell(), but for the approx column: adds a title tooltip showing the delta to the precise value,
// so the value cells themselves stay plain numbers (not replaced by the delta), while the "how far off" is
// still a hover away.
function approxCell(value, present, unit, preciseValue, precisePresent) {
    if (!present) return `<td class="value missing">—</td>`;
    const hasDelta = precisePresent && typeof value === "number" && typeof preciseValue === "number";
    const title = hasDelta ? ` title="${formatDelta(value - preciseValue, unit)}"` : "";
    return `<td class="value"${title}>${formatValue(value, unit)}</td>`;
}

function computeRows(names, preciseNs, approxNs, jd) {
    return names
        .flatMap((name) => {
            const hasPrecise = name in preciseNs;
            const hasApprox = name in approxNs;
            const preciseValue = hasPrecise ? callExport(name, preciseNs[name], jd) : undefined;
            const approxValue = hasApprox ? callExport(name, approxNs[name], jd) : undefined;
            const unit = UNITS[name] ?? DEFAULT_UNIT;

            // Object results (apparentPosition, horizontalPosition, position, opticalLibrations, ...) get one row
            // per field instead of one combined "key: value, key: value" row.
            if (isPlainObject(preciseValue) || isPlainObject(approxValue)) {
                const fields = [
                    ...new Set([
                        ...(isPlainObject(preciseValue) ? Object.keys(preciseValue) : []),
                        ...(isPlainObject(approxValue) ? Object.keys(approxValue) : []),
                    ]),
                ];
                return fields.map((field) => {
                    const preciseHasField = isPlainObject(preciseValue) && field in preciseValue;
                    const approxHasField = isPlainObject(approxValue) && field in approxValue;
                    // Most object exports (apparentPosition, position, ...) have every field share one unit, but
                    // eclipse states mix degrees/km/dimensionless/strings, so a "name.field" entry wins if present.
                    const fieldUnit = UNITS[`${name}.${field}`] ?? unit;
                    return `<tr><td title="${describe(name, field)}">${name}.${field}</td><td>${fieldUnit}</td>${cell(preciseValue?.[field], preciseHasField, fieldUnit)}${approxCell(approxValue?.[field], approxHasField, fieldUnit, preciseValue?.[field], preciseHasField)}</tr>`;
                });
            }

            return [
                `<tr><td title="${describe(name)}">${name}</td><td>${unit}</td>${cell(preciseValue, hasPrecise, unit)}${approxCell(approxValue, hasApprox, unit, preciseValue, hasPrecise)}</tr>`,
            ];
        })
        .join("");
}

// biome-ignore lint/performance/noDynamicNamespaceImportAccess: the inspector lists every export, so it needs the whole namespace anyway
const namespacesOf = (domainName) => [precise[domainName], approx[domainName]];

function renderDomain(domainName, jd) {
    const [preciseNs, approxNs] = namespacesOf(domainName);
    // Not alphabetized: preserves each namespace's own hand-grouped declaration order (index.ts/approx.ts),
    // e.g. apparentPosition/equatorialHorizontalParallax/topocentricPosition/horizontalPosition stay adjacent
    // as a pipeline, which sorting would scatter (a.../e.../h.../t...).
    const names = [...new Set([...Object.keys(preciseNs), ...Object.keys(approxNs)])];
    const rows = computeRows(names, preciseNs, approxNs, jd);

    return `
        <table>
            <colgroup><col class="name" /><col class="unit" /><col class="value" /><col class="value" /></colgroup>
            <thead><tr><th>${domainName}.*</th><th>unit</th><th class="value">precise</th><th class="value">approx</th></tr></thead>
            <tbody>${rows}</tbody>
        </table>
    `;
}

// One container per domain, placed wherever the chapter text discusses it (see Table.astro).
const tableContainers = document.querySelectorAll(".sternzeit-table[data-domain]");

function render() {
    for (const container of tableContainers) container.innerHTML = renderDomain(container.dataset.domain, state.jd);
}

onChange(render);
render();

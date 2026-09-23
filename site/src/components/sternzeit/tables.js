import * as precise from "@himmel/sternzeit";
import * as approx from "@himmel/sternzeit/approx";
import { lookupEntry } from "../../lib/glossary";
import { escapeText } from "./figure.js";
import { formatDMS } from "./format.js";
import { GLOSSARY_TERMS } from "./glossary-map.js";
import { REFRACTION_FLOOR_DEG } from "./horizon.js";
import { onChange, state } from "./state.js";

// Unit of each export's return value (or of an object return's fields, which all share one unit here).
// Anything not listed defaults to degrees, the overwhelming majority.
const UNITS = {
    MEAN_RADIUS_KM: "km",
    ATMOSPHERE_THICKNESS_KM: "km",
    ATMOSPHERE_THICKNESS_NON_UNIFORM_KM: "km",
    PRESSURE_SCALE_HEIGHT_M: "m",
    airPressureRatio: "",
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
    "lunar.umbraRadiusKm": "km",
    "lunar.penumbraRadiusKm": "km",
    illuminatedFraction: "",
    sunDirection: "",
    earthshine: "",
};
const DEFAULT_UNIT = "deg";

// Title and description for rows the glossary has no entry for (see glossary-map.js), shown in the same tooltip
// style as glossary terms. Keyed by name or "name.field".
const DESCRIPTIONS = {
    MEAN_RADIUS_KM: ["Mean radius", "The body's mean radius, in kilometers."],
    ATMOSPHERE_THICKNESS_KM: [
        "Atmosphere thickness",
        "The uniform-density atmosphere thickness used for simplified scattering models, in kilometers.",
    ],
    ATMOSPHERE_THICKNESS_NON_UNIFORM_KM: [
        "Atmosphere thickness, non-uniform",
        "The atmosphere thickness accounting for its actual density falloff with altitude, in kilometers.",
    ],
    APPARENT_MAGNITUDE_LIMIT: [
        "Apparent magnitude limit",
        "The faintest apparent magnitude generally considered visible to the naked eye.",
    ],
    PRESSURE_SCALE_HEIGHT_M: [
        "Pressure scale height",
        "The height over which air pressure drops by a factor of e, in the standard atmosphere, in meters.",
    ],
    airPressureRatio: [
        "Air pressure ratio",
        "Air pressure relative to sea level, at the observer's height: exp(-height / pressure scale height).",
    ],
    viewDistanceWithinAtmosphere: [
        "View distance within the atmosphere",
        "How far a line of sight towards the Sun travels through the atmosphere, in kilometers: to its top, or to the ground if the Sun is below the horizon.",
    ],
    distance: ["Distance", "Distance from Earth's center to the body's center, in kilometers."],
    sunDirection: [
        "Sun direction from the Moon",
        "Unit vector from the Moon's center to the Sun, in the observer's ENU frame (x east, y north, z up): the light to shade the Moon with.",
    ],
    "solar.separation": [
        "Separation",
        "Apparent center-to-center separation between Sun and Moon as seen by the observer.",
    ],
    "lunar.separation": [
        "Separation",
        "The Moon's angular distance from the axis of Earth's shadow, as seen geocentrically.",
    ],
    "lunar.axisOffsetKm": [
        "Shadow axis offset",
        "The Moon's linear distance from the axis of Earth's shadow, at the Moon's own distance.",
    ],
};

// Row-specific context shown beneath the glossary definition, e.g. what a row is evaluated for here.
const NOTES = {
    atmosphericRefraction:
        "Here: from the Sun's true altitude right now, at the observer's height; n/a once it is more than 1° below the horizon.",
    atmosphericRefractionFromApparent:
        "Here: from the Sun's apparent altitude, the direction a renderer's view ray already has.",
    horizonDip: "Here: at the observer's height.",
};

// Same markup and styling as the Term component in the text: a dotted underline with a tooltip.
function tooltip(label, tipHtml) {
    return `<span class="term" tabindex="0">${label}<span class="term-tip" role="tooltip">${tipHtml}</span></span>`;
}

function nameCell(name, field) {
    const key = field ? `${name}.${field}` : name;
    const label = field ? `${name}.${field}` : name;
    const glossaryName = GLOSSARY_TERMS[key] ?? GLOSSARY_TERMS[name];
    const entry = glossaryName ? lookupEntry(glossaryName) : undefined;
    const own = DESCRIPTIONS[key] ?? (field ? undefined : DESCRIPTIONS[name]);
    const note = NOTES[key] ?? NOTES[name];
    if (!entry && !own) return `<td>${label}</td>`;
    const [title, text] = entry ? [entry.term, entry.html] : [own[0], escapeText(own[1])];
    const context = note ? `<span class="tip-note">${escapeText(note)}</span>` : "";
    const definition = `<strong>${escapeText(title)}</strong> ${text}${context}`;
    return `<td>${tooltip(label, definition)}</td>`;
}

// The Sun's current true altitude: what the refraction and view-distance rows are evaluated for, since they need a
// direction and the Sun's is the one a sky renderer cares about most.
function sunAltitude(jd) {
    return precise.sun.horizontalPosition(precise.fromJulianDay(jd), state.latitude, state.longitude).altitude;
}

// Refraction is only meaningful for a body at or near the horizon, not for one well below it: null reads as n/a.
function refractionTowardsSun(fn, jd, apparent) {
    const altitude = sunAltitude(jd);
    if (altitude < REFRACTION_FLOOR_DEG) return null;
    const conditions = { observerHeightM: state.heightM };
    return fn(apparent ? altitude + precise.earth.atmosphericRefraction(altitude, conditions) : altitude, conditions);
}

// How to call an export that isn't just fn(julianDay). Anything not listed here falls back to
// fn.length === 0 ? fn() : fn(jd).
const CALL_OVERRIDES = {
    atmosphericRefraction: (fn, jd) => refractionTowardsSun(fn, jd, false),
    // Fed the apparent altitude it expects: the true one lifted by the refraction from the row above.
    atmosphericRefractionFromApparent: (fn, jd) => refractionTowardsSun(fn, jd, true),
    // y = sin(altitude), the vertical component of a unit view direction vector.
    viewDistanceWithinAtmosphere: (fn, jd) =>
        fn(Math.sin(sunAltitude(jd) * precise.DEG_TO_RAD), { observerHeightM: state.heightM }),
    // jd is already an absolute instant; fromJulianDay(jd) (offset 0) round-trips it as a UT AstronomicalTime,
    // which is what julianDayUT() inside horizontalPosition/parallacticAngle expects. A nonzero offset here
    // would double-shift the instant, since jd carries no timezone to begin with.
    horizontalPosition: (fn, jd) => fn(precise.fromJulianDay(jd), state.latitude, state.longitude),
    topocentricPosition: (fn, jd) => fn(precise.fromJulianDay(jd), state.latitude, state.longitude),
    parallacticAngle: (fn, jd) => fn(precise.fromJulianDay(jd), state.latitude, state.longitude),
    sunDirection: (fn, jd) => fn(precise.fromJulianDay(jd), state.latitude, state.longitude),
    airPressureRatio: (fn) => fn(state.heightM),
    horizonDip: (fn) => fn(state.heightM),
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

function formatNumber(n, unit) {
    if (!Number.isFinite(n)) return String(n);
    if (unit === "deg") return formatDegreesLike(n, "°", n);
    // The unit column still says "rad" (that's genuinely what the export returns); only the DMS half
    // converts to degrees; the parenthetical stays the actual raw radian value, not a converted one.
    if (unit === "rad") return formatDegreesLike(n, "", n * precise.RAD_TO_DEG);
    return formatDecimal(n, unit);
}

function formatValue(value, unit) {
    if (typeof value === "number") return formatNumber(value, unit);
    // Vectors in one row, as a tuple: "( 0.6951, -0.4916, -0.5245)".
    if (Array.isArray(value)) return `(${value.map((n) => formatDecimal(n, unit)).join(", ")})`;
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

// Objects get one row per field; arrays (vectors) stay one row, see formatValue.
function isPlainObject(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cell(value, present, unit) {
    return present ? `<td class="value">${formatValue(value, unit)}</td>` : `<td class="value missing">n/a</td>`;
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

// Same as cell(), but for the approx column: adds a tooltip showing the delta to the precise value,
// so the value cells themselves stay plain numbers (not replaced by the delta), while the "how far off" is
// still a hover away.
function approxCell(value, present, unit, preciseValue, precisePresent) {
    if (!present) return `<td class="value approx missing">n/a</td>`;
    const formatted = formatValue(value, unit);
    const hasDelta =
        precisePresent && typeof value === "number" && typeof preciseValue === "number" && value !== preciseValue;
    if (!hasDelta) return `<td class="value approx">${formatted}</td>`;
    const tip = `<strong>${formatDelta(value - preciseValue, unit)}</strong> off the precise value.`;
    return `<td class="value approx">${tooltip(formatted, tip)}</td>`;
}

function computeRows(names, preciseNs, approxNs, jd) {
    return names.flatMap((name) => {
        let hasPrecise = name in preciseNs;
        let hasApprox = name in approxNs;
        const preciseValue = hasPrecise ? callExport(name, preciseNs[name], jd) : undefined;
        const approxValue = hasApprox ? callExport(name, approxNs[name], jd) : undefined;
        // An override returning null means "not meaningful right now", shown as n/a like a missing variant.
        if (preciseValue === null) hasPrecise = false;
        if (approxValue === null) hasApprox = false;
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
                return `<tr>${nameCell(name, field)}<td class="unit">${fieldUnit}</td>${cell(preciseValue?.[field], preciseHasField, fieldUnit)}${approxCell(approxValue?.[field], approxHasField, fieldUnit, preciseValue?.[field], preciseHasField)}</tr>`;
            });
        }

        return [
            `<tr>${nameCell(name)}<td class="unit">${unit}</td>${cell(preciseValue, hasPrecise, unit)}${approxCell(approxValue, hasApprox, unit, preciseValue, hasPrecise)}</tr>`,
        ];
    });
}

// biome-ignore lint/performance/noDynamicNamespaceImportAccess: the tables list every export, so it needs the whole namespace anyway
const namespacesOf = (domainName) => [precise[domainName], approx[domainName]];

function renderDomain(domainName, jd, open) {
    const [preciseNs, approxNs] = namespacesOf(domainName);
    // Not alphabetized: preserves each namespace's own hand-grouped declaration order (index.ts/approx.ts),
    // e.g. apparentPosition/equatorialHorizontalParallax/topocentricPosition/horizontalPosition stay adjacent
    // as a pipeline, which sorting would scatter (a.../e.../h.../t...).
    const names = [...new Set([...Object.keys(preciseNs), ...Object.keys(approxNs)])];
    const rows = computeRows(names, preciseNs, approxNs, jd);

    // Foldable, because on a phone a table of this length is a wall to scroll past; open unless the cards are showing.
    // Where only one of the two value columns fits, the button in its heading swaps which one that is.
    const swap = (other) =>
        `<button type="button" class="value-swap" title="Show the ${other} values">${other}</button>`;
    return `
        <details class="table-fold"${open ? " open" : ""}>
            <summary>${domainName}.* <span class="note">${rows.length} values</span></summary>
            <p class="table-note note">Every card gives the precise value and, dimmed, the one the approximate math arrives at.</p>
            <table>
                <colgroup><col class="name" /><col class="unit" /><col class="value" /><col class="approx" /></colgroup>
                <thead><tr><th>${domainName}.*</th><th>unit</th><th class="value">precise${swap("approx")}</th><th class="value approx">approx${swap("precise")}</th></tr></thead>
                <tbody>${rows.join("")}</tbody>
            </table>
        </details>
    `;
}

// One container per domain, placed wherever the chapter text discusses it (see Table.astro).
const tableContainers = document.querySelectorAll(".sternzeit-table[data-domain]");
// Below this the rows are stacked as cards (see sternzeit.css), so the tables start folded.
const cards = matchMedia("(max-width: 48rem)");

// The set of controls the chapter places right after a table (see the .mdx); a script tag may sit in between.
function controlsAfter(container) {
    for (let node = container.nextElementSibling, hop = 0; node && hop < 2; node = node.nextElementSibling, hop++) {
        if (node.classList.contains("moment")) return node;
    }
    return null;
}

// A folded-away table leaves nothing for its controls to act on, so they fold with it rather than standing alone.
function syncControls(container) {
    const controls = controlsAfter(container);
    const fold = container.querySelector(".table-fold");
    if (controls) controls.hidden = Boolean(fold && cards.matches && !fold.open);
}

function render() {
    for (const container of tableContainers) {
        // Rerendered on every change, so whether the reader folded it open is carried over by hand.
        const fold = container.querySelector(".table-fold");
        const open = fold ? fold.open : !cards.matches;
        container.innerHTML = renderDomain(container.dataset.domain, state.jd, open);
        syncControls(container);
    }
}

// The details element's toggle event does not bubble, so it is caught on the way down instead.
for (const container of tableContainers) {
    container.addEventListener("toggle", () => syncControls(container), true);
    // On the container, not on the button, which is rewritten with the rest of the table on every change.
    container.addEventListener("click", (event) => {
        if (!event.target.closest(".value-swap")) return;
        container.dataset.show = container.dataset.show === "approx" ? "precise" : "approx";
    });
}

onChange(render);
// Crossing the breakpoint decides afresh: folded where the cards take over, open where the table fits.
cards.addEventListener("change", () => {
    for (const container of tableContainers) container.innerHTML = "";
    render();
});
render();

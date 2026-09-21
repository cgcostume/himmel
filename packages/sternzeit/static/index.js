import * as approx from "../dist/approx.js";
import * as precise from "../dist/index.js";

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
        "How much atmospheric refraction lifts a body's apparent altitude above its true, geometric altitude.",
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
        "How far a given line of sight travels through Earth's atmosphere before leaving it, in kilometers.",
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
const CALL_OVERRIDES = {
    atmosphericRefraction: (fn) => fn(Number(altitudeInput.value)),
    // y = sin(altitude), the vertical component of a unit view direction vector; see the #altitude note.
    viewDistanceWithinAtmosphere: (fn) => fn(Math.sin(Number(altitudeInput.value) * DEG_TO_RAD)),
    // jd is already an absolute instant; fromJulianDay(jd) (offset 0) round-trips it as a UT AstronomicalTime,
    // which is what julianDayUT() inside horizontalPosition/parallacticAngle expects. A nonzero offset here
    // would double-shift the instant, since jd carries no timezone to begin with.
    horizontalPosition: (fn, jd) =>
        fn(precise.fromJulianDay(jd), Number(latitudeInput.value), Number(longitudeInput.value)),
    topocentricPosition: (fn, jd) =>
        fn(precise.fromJulianDay(jd), Number(latitudeInput.value), Number(longitudeInput.value)),
    parallacticAngle: (fn, jd) =>
        fn(precise.fromJulianDay(jd), Number(latitudeInput.value), Number(longitudeInput.value)),
    // lunar takes just jd like the fn(jd) default already handles; only solar needs observer location too.
    solar: (fn, jd) => fn(precise.fromJulianDay(jd), Number(latitudeInput.value), Number(longitudeInput.value)),
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

// Degrees/minutes/seconds, the conventional astronomical notation. Every field is fixed-width (sign always
// present, degrees padded to 3 digits, minutes/seconds zero-padded) so the whole string is constant-width,
// which is what lets the deg column stay right-aligned like every other value column.
function formatDMS(n) {
    const sign = n < 0 ? "-" : " ";
    const abs = Math.abs(n);
    const d = Math.floor(abs);
    const minFloat = (abs - d) * 60;
    const m = Math.floor(minFloat);
    const s = (minFloat - m) * 60;
    return `${sign}${String(d).padStart(3, " ")}° ${String(m).padStart(2, "0")}′ ${s.toFixed(2).padStart(5, "0")}″`;
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

// data-domain/data-name/data-field identify each row for the hover -> visualization link (see the
// "inspector:hover" CustomEvent dispatched below); viz.js listens for it independently, no import between them.
function computeRows(domainName, names, preciseNs, approxNs, jd) {
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
                    return `<tr data-domain="${domainName}" data-name="${name}" data-field="${field}"><td title="${describe(name, field)}">${name}.${field}</td><td>${fieldUnit}</td>${cell(preciseValue?.[field], preciseHasField, fieldUnit)}${approxCell(approxValue?.[field], approxHasField, fieldUnit, preciseValue?.[field], preciseHasField)}</tr>`;
                });
            }

            return [
                `<tr data-domain="${domainName}" data-name="${name}"><td title="${describe(name)}">${name}</td><td>${unit}</td>${cell(preciseValue, hasPrecise, unit)}${approxCell(approxValue, hasApprox, unit, preciseValue, hasPrecise)}</tr>`,
            ];
        })
        .join("");
}

// biome-ignore lint/performance/noDynamicNamespaceImportAccess: dev-only inspector, never bundled
const namespacesOf = (domainName) => [precise[domainName], approx[domainName]];

// tablesDiv.innerHTML is fully rebuilt on every render() (any input change), so a plain hardcoded `open`
// would re-expand every group each time; this survives that by living outside render() entirely, updated by
// the delegated "toggle" listener below and read back in when regenerating the markup.
const domainOpenState = { earth: true, eclipse: true, sun: true, moon: true };

function renderDomain(domainName, jd) {
    const [preciseNs, approxNs] = namespacesOf(domainName);
    // Not alphabetized: preserves each namespace's own hand-grouped declaration order (index.ts/approx.ts),
    // e.g. apparentPosition/equatorialHorizontalParallax/topocentricPosition/horizontalPosition stay adjacent
    // as a pipeline, which sorting would scatter (a.../e.../h.../t...).
    const names = [...new Set([...Object.keys(preciseNs), ...Object.keys(approxNs)])];
    const rows = computeRows(domainName, names, preciseNs, approxNs, jd);

    return `
        <details class="domain" data-domain="${domainName}" ${domainOpenState[domainName] ? "open" : ""}>
            <summary>${domainName}</summary>
            <table>
                <colgroup><col class="name" /><col class="unit" /><col class="value" /><col class="value" /></colgroup>
                <thead><tr><th>export</th><th>unit</th><th class="value">precise</th><th class="value">approx</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </details>
    `;
}

// fromJulianDay(jd) always comes back with utcOffsetSeconds: 0 (see the CALL_OVERRIDES comment above), i.e.
// UT; shown here in the viewer's own local timezone (more readable than raw UT) rather than as a plain "Z"
// string. Embedding the local offset explicitly (not just local wall-clock digits with no suffix) keeps the
// pasted `new Date(...)` exact regardless of which machine's timezone later evaluates it.
function formatJsDate(time) {
    const utcMs = Date.UTC(time.year, time.month - 1, time.day, time.hour, time.minute, time.second);
    const local = new Date(utcMs);
    const pad = (n) => String(n).padStart(2, "0");
    const offsetMinutes = -local.getTimezoneOffset();
    const offsetSign = offsetMinutes >= 0 ? "+" : "-";
    const offset = `${offsetSign}${pad(Math.floor(Math.abs(offsetMinutes) / 60))}:${pad(Math.abs(offsetMinutes) % 60)}`;
    return `new Date("${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())}T${pad(local.getHours())}:${pad(local.getMinutes())}:${pad(local.getSeconds())}.000${offset}")`;
}

function render() {
    const jd = Number(jdInput.value);
    calendarSpan.textContent = jd ? formatJsDate(precise.fromJulianDay(jd)) : "";
    tablesDiv.innerHTML = ["earth", "eclipse", "sun", "moon"].map((domain) => renderDomain(domain, jd)).join("");
    // Read-only, mirrors whatever the decimal input holds; formatDMS's fixed-width padding (built for the
    // table columns) just needs trimming for a plain label.
    latitudeDmsSpan.textContent = formatDMS(Number(latitudeInput.value)).trim();
    longitudeDmsSpan.textContent = formatDMS(Number(longitudeInput.value)).trim();
    altitudeDmsSpan.textContent = formatDMS(Number(altitudeInput.value)).trim();
}

const jdInput = document.getElementById("jd");
const jdStepSelect = document.getElementById("jdStep");
const nowButton = document.getElementById("now");
const liveCheckbox = document.getElementById("live");
const calendarSpan = document.getElementById("calendar");
const copyCalendarButton = document.getElementById("copyCalendar");
const tablesDiv = document.getElementById("tables");
const latitudeInput = document.getElementById("latitude");
const latitudeStepSelect = document.getElementById("latitudeStep");
const latitudeDmsSpan = document.getElementById("latitudeDms");
const longitudeInput = document.getElementById("longitude");
const longitudeStepSelect = document.getElementById("longitudeStep");
const longitudeDmsSpan = document.getElementById("longitudeDms");
const geolocateButton = document.getElementById("geolocate");
const locationSpan = document.getElementById("location");
const altitudeInput = document.getElementById("altitude");
const altitudeStepSelect = document.getElementById("altitudeStep");
const altitudeDmsSpan = document.getElementById("altitudeDms");

copyCalendarButton.addEventListener("click", () => navigator.clipboard.writeText(calendarSpan.textContent));

// Each select's value is that granularity in the input's own unit (days for jd, degrees for lat/long).
// Deliberately NOT done via input.step + the native arrow-key/scroll/spinner stepping: the browser's
// stepUp()/stepDown() only accepts a value that's already an exact multiple of `step` (relative to 0, not
// relative to the current value), which our values essentially never are. It doesn't error, it just
// silently no-ops, so after the first (slightly-off) native step the control looks entirely dead. Instead
// input.step stays "any" (no native validation to fight) and arrow-key/wheel are handled here by hand;
// the native spinner arrows are hidden in CSS since a bare click on them can't be intercepted this way.
function minStepOf(select) {
    return Math.min(...[...select.options].map((option) => Number(option.value)));
}

// Never show more precision than is meaningful: repeated arrow-key/wheel stepping, "now", and geolocation
// all produce far more decimal digits than that (float drift, full GPS precision). `decimals` defaults to
// the fewest digits that distinguish adjacent steps of minStep (+2 safety digits, see below); lat/long
// pass a fixed 7 instead, regardless of the selected step, since that's what's wanted there.
function roundToStep(value, minStep, decimals = Math.max(0, Math.ceil(-Math.log10(minStep)) + 2)) {
    // Snapping to an exact multiple of minStep (not just rounding the decimal display) matters because
    // minStep itself is a repeating decimal (1/86400, 1/3600, ...): truncating to "enough" decimal places
    // is never actually exact, so a step could land a hair off a whole-second/arcsecond boundary and the
    // calendar breakdown's second field (which truncates via toInt) would show an inconsistent, janky
    // increment.
    const snapped = Math.round(value / minStep) * minStep;
    return Number(snapped.toFixed(decimals));
}

// Just a decimal-place cap, no grid-snapping: for values that didn't come from stepping (typed/pasted,
// geolocated, the HTML default), where snapping to even the finest step's grid would silently throw away
// real sub-arcsecond precision instead of just tidying up float noise from an addition.
function capDecimals(value, decimals) {
    return Number(value.toFixed(decimals));
}

const LATLONG_DECIMALS = 7;

// Returns minStep so callers that set .value programmatically elsewhere (setToNow, geolocate) can round
// to the same precision this uses.
function wireStepping(input, stepSelect, decimals) {
    input.step = "any";
    const minStep = minStepOf(stepSelect);
    const applyStep = (sign) => {
        const next = (Number(input.value) || 0) + sign * Number(stepSelect.value);
        input.value = roundToStep(next, minStep, decimals);
        input.dispatchEvent(new Event("input", { bubbles: true }));
    };
    input.addEventListener("keydown", (event) => {
        if (event.key === "ArrowUp" || event.key === "ArrowDown") {
            event.preventDefault();
            applyStep(event.key === "ArrowUp" ? 1 : -1);
        }
    });
    input.addEventListener(
        "wheel",
        (event) => {
            if (document.activeElement !== input) return;
            event.preventDefault();
            applyStep(event.deltaY < 0 ? 1 : -1);
        },
        { passive: false },
    );
    return minStep;
}
const jdMinStep = wireStepping(jdInput, jdStepSelect);
// Return value unused here: geolocate/initial-load use capDecimals (no grid-snap), not roundToStep, so
// they don't need latitude/longitudeStepSelect's minStep the way setToNow() below still needs jdMinStep.
wireStepping(latitudeInput, latitudeStepSelect, LATLONG_DECIMALS);
wireStepping(longitudeInput, longitudeStepSelect, LATLONG_DECIMALS);
wireStepping(altitudeInput, altitudeStepSelect, LATLONG_DECIMALS);

// "toggle" doesn't bubble, but a capturing listener on an ancestor still sees it on the way down to the
// target, so this still works delegated (rather than needing to re-bind after every innerHTML rebuild).
tablesDiv.addEventListener(
    "toggle",
    (event) => {
        const details = event.target.closest("details.domain");
        if (details) domainOpenState[details.dataset.domain] = details.open;
    },
    true,
);

// Delegated on the stable container rather than per-row, so it survives tablesDiv.innerHTML being
// rebuilt on every render() without needing to re-bind. viz.js listens for this independently.
tablesDiv.addEventListener("mouseover", (event) => {
    const row = event.target.closest("tr[data-domain]");
    if (!row) return;
    // 3rd <td> is the precise-column value cell (export/unit/precise/approx); reused as-is (already
    // formatted, deg notation and all) rather than recomputing it, so the tooltip text always matches
    // exactly what the row itself is showing.
    const preciseCell = row.children[2];
    window.dispatchEvent(
        new CustomEvent("inspector:hover", {
            detail: {
                domain: row.dataset.domain,
                name: row.dataset.name,
                field: row.dataset.field ?? null,
                value: preciseCell?.textContent.trim() ?? null,
            },
        }),
    );
});
tablesDiv.addEventListener("mouseout", (event) => {
    const row = event.target.closest("tr[data-domain]");
    if (!row || row.contains(event.relatedTarget)) return;
    window.dispatchEvent(new CustomEvent("inspector:hover", { detail: null }));
});

let liveIntervalId = null;

function stopLive() {
    liveCheckbox.checked = false;
    clearInterval(liveIntervalId);
    liveIntervalId = null;
}

liveCheckbox.addEventListener("change", () => {
    if (liveCheckbox.checked) {
        liveIntervalId = setInterval(() => {
            setToNow();
            render();
        }, 1000);
    } else {
        clearInterval(liveIntervalId);
        liveIntervalId = null;
    }
});

geolocateButton.addEventListener("click", () => {
    if (!navigator.geolocation) {
        locationSpan.textContent = "geolocation not supported by this browser";
        return;
    }
    locationSpan.textContent = "requesting location...";
    navigator.geolocation.getCurrentPosition(
        (position) => {
            // Full GPS precision (~15 decimal digits) is noise against a UI whose finest step is arcseconds.
            latitudeInput.value = capDecimals(position.coords.latitude, LATLONG_DECIMALS);
            longitudeInput.value = capDecimals(position.coords.longitude, LATLONG_DECIMALS);
            locationSpan.textContent = "";
            render();
        },
        (err) => {
            locationSpan.textContent = `geolocation failed: ${err.message}`;
        },
        { timeout: 5000 },
    );
});

function setToNow() {
    const now = new Date();
    jdInput.value = roundToStep(
        precise.julianDay({
            year: now.getUTCFullYear(),
            month: now.getUTCMonth() + 1,
            day: now.getUTCDate(),
            hour: now.getUTCHours(),
            minute: now.getUTCMinutes(),
            second: now.getUTCSeconds(),
            utcOffsetSeconds: 0,
        }),
        jdMinStep,
    );
}

nowButton.addEventListener("click", () => {
    setToNow();
    render();
});
jdInput.addEventListener("input", () => {
    // Only fires for genuine user interaction, not for our own `jdInput.value = ...` assignments
    // (setToNow(), including from the live tick), so this can't cancel live mode's own ticks.
    stopLive();
    render();
});
latitudeInput.addEventListener("input", render);
longitudeInput.addEventListener("input", render);
altitudeInput.addEventListener("input", render);

// Normalizes the HTML defaults' raw precision to the same fixed digit count everything else uses.
latitudeInput.value = capDecimals(Number(latitudeInput.value), LATLONG_DECIMALS);
longitudeInput.value = capDecimals(Number(longitudeInput.value), LATLONG_DECIMALS);
altitudeInput.value = capDecimals(Number(altitudeInput.value), LATLONG_DECIMALS);

setToNow();
render();

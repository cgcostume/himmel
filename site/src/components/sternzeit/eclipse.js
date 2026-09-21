import * as precise from "@himmel/sternzeit";
import { onChange, state, update } from "./state.js";

// Both panels share a 200 x 200 viewBox centered on the origin: the Sun, or the axis of Earth's shadow, sits in the middle.
const HALF = 100;
// Solar panel: the Sun's disc gets this radius, so the discs still fit when they just touch (Moon up to ~7% larger).
const SUN_RADIUS_UNITS = 30;
// Lunar panel: kilometers at the Moon's distance per unit, so the penumbra (~8,200 km) fills most of the panel.
const KM_PER_UNIT = 110;
// Off-panel bodies get an arrow along the panel's rim instead, pointing where they are.
const ARROW_FROM = 78;
const ARROW_TO = 94;
// A Sun hidden completely gets its corona, this many solar radii wide.
const CORONA_RADII = 2.4;

// The two examples the chapter text mentions, each from a place where it was visible.
const JUMPS = {
    solar: { jd: 2461265.2708333, latitude: 42.34, longitude: -3.7, live: false },
    lunar: { jd: 2461102.9833333, latitude: 21.31, longitude: -157.86, live: false },
};

let idCount = 0;
const f = (n) => n.toFixed(2);
const circle = (x, y, r, cls, extra = "") => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" class="${cls}" ${extra}/>`;

/** A body outside the panel: an arrow along the rim pointing towards it, its distance labeled at the bottom (top, if the arrow points down). */
function offPanelArrow(dx, dy, label) {
    const length = Math.hypot(dx, dy);
    const [ux, uy] = [dx / length, dy / length];
    const [x0, y0, x1, y1] = [ux * ARROW_FROM, uy * ARROW_FROM, ux * ARROW_TO, uy * ARROW_TO];
    const [hx, hy] = [-uy * 4, ux * 4];
    const head = `${f(x1)},${f(y1)} ${f(x1 - ux * 7 + hx)},${f(y1 - uy * 7 + hy)} ${f(x1 - ux * 7 - hx)},${f(y1 - uy * 7 - hy)}`;
    return `<line x1="${f(x0)}" y1="${f(y0)}" x2="${f(x1)}" y2="${f(y1)}" class="eclipse-arrow"/>
        <polygon points="${head}" class="eclipse-arrowhead"/>
        <text x="0" y="${uy > 0.6 ? 8 - HALF : HALF - 8}" class="eclipse-label">${label}</text>`;
}

function renderSolar(jd) {
    const time = precise.fromJulianDay(jd);
    const eclipse = precise.eclipse.solar(time, state.latitude, state.longitude);
    const sunAltitude = precise.sun.horizontalPosition(time, state.latitude, state.longitude).altitude;
    const sunRadiusDeg = (precise.sun.apparentAngularDiameter(jd) * precise.RAD_TO_DEG) / 2;
    const moonRadiusDeg = (precise.moon.apparentAngularDiameter(jd) * precise.RAD_TO_DEG) / 2;
    const scale = SUN_RADIUS_UNITS / sunRadiusDeg;
    const moonRadius = moonRadiusDeg * scale;

    // Position angle is measured from the zenith towards increasing azimuth, which is to the right for anyone facing the Sun.
    const angle = eclipse.positionAngle * precise.DEG_TO_RAD;
    const distance = eclipse.separation * scale;
    const [mx, my] = [Math.sin(angle) * distance, -Math.cos(angle) * distance];

    const inner = Math.abs(sunRadiusDeg - moonRadiusDeg);
    const outer = sunRadiusDeg + moonRadiusDeg;
    const total = eclipse.separation <= inner && moonRadiusDeg > sunRadiusDeg;

    let svg = "";
    if (total) {
        const corona = `eclipse-corona-${++idCount}`;
        svg += `<radialGradient id="${corona}"><stop offset="${f(1 / CORONA_RADII)}" class="eclipse-corona-inner"/><stop offset="1" class="eclipse-corona-outer"/></radialGradient>`;
        svg += circle(0, 0, SUN_RADIUS_UNITS * CORONA_RADII, "", `fill="url(#${corona})"`);
    }
    svg += circle(0, 0, SUN_RADIUS_UNITS, "eclipse-sun");
    const onPanel = distance < HALF * Math.SQRT2 + moonRadius;
    if (onPanel) svg += circle(mx, my, moonRadius, "eclipse-moon-new");

    // The Sun sits at the center, so the horizon is its altitude below it; the ground veils whatever is beneath.
    const horizon = sunAltitude * scale;
    if (horizon < HALF) {
        const top = Math.max(horizon, -HALF);
        svg += `<rect x="${-HALF}" y="${f(top)}" width="${2 * HALF}" height="${f(HALF - top)}" class="eclipse-veil"/>`;
        if (horizon > -HALF)
            svg += `<line x1="${-HALF}" y1="${f(horizon)}" x2="${HALF}" y2="${f(horizon)}" class="eclipse-horizon"/>`;
        else svg += `<text x="0" y="${SUN_RADIUS_UNITS + 16}" class="eclipse-veil-label">below the horizon</text>`;
    }
    if (!onPanel) svg += offPanelArrow(mx, my, `Moon, ${eclipse.separation.toFixed(1)}°`);

    let status;
    if (eclipse.separation <= inner) status = total ? "total, only the corona is left" : "annular";
    else if (eclipse.separation < outer) {
        const covered = (outer - eclipse.separation) / (2 * sunRadiusDeg);
        status = `partial, ${Math.round(covered * 100)}% of the Sun's diameter covered`;
    } else status = `none, the Moon is ${eclipse.separation.toFixed(1)}° away`;
    if (sunAltitude < 0) status += " (the Sun is below the horizon)";
    return { svg, status };
}

function renderLunar(jd) {
    const eclipse = precise.eclipse.lunar(jd);
    const moonRadius = precise.moon.MEAN_RADIUS_KM / KM_PER_UNIT;
    const umbra = eclipse.umbraRadiusKm / KM_PER_UNIT;
    const penumbra = eclipse.penumbraRadiusKm / KM_PER_UNIT;

    // Ecliptic position angle, from north through increasing longitude (east), which is to the left on the sky.
    const angle = eclipse.positionAngle * precise.DEG_TO_RAD;
    const distance = eclipse.axisOffsetKm / KM_PER_UNIT;
    const [mx, my] = [-Math.sin(angle) * distance, -Math.cos(angle) * distance];

    const clip = `eclipse-moon-clip-${++idCount}`;
    let svg = circle(0, 0, penumbra, "eclipse-penumbra") + circle(0, 0, umbra, "eclipse-umbra");
    if (distance < HALF * Math.SQRT2 + moonRadius) {
        svg += `<clipPath id="${clip}">${circle(mx, my, moonRadius, "")}</clipPath>`;
        svg += circle(mx, my, moonRadius, "eclipse-moon-full");
        // The shadow, only where it falls on the Moon: a dimming in the penumbra, the reddish dark of the umbra.
        svg += `<g clip-path="url(#${clip})">${circle(0, 0, penumbra, "eclipse-penumbra-on-moon")}${circle(0, 0, umbra, "eclipse-umbra-on-moon")}</g>`;
    } else svg += offPanelArrow(mx, my, `Moon, ${eclipse.separation.toFixed(1)}°`);
    svg += circle(0, 0, penumbra, "eclipse-edge") + circle(0, 0, umbra, "eclipse-edge");
    svg += `<text x="0" y="${f(-umbra + 9)}" class="eclipse-label">umbra</text>`;
    svg += `<text x="0" y="${f(-penumbra + 9)}" class="eclipse-label">penumbra</text>`;

    const km = eclipse.axisOffsetKm;
    const moonKm = precise.moon.MEAN_RADIUS_KM;
    let status;
    if (km + moonKm <= eclipse.umbraRadiusKm) status = "total, the Moon is entirely inside the umbra";
    else if (km - moonKm < eclipse.umbraRadiusKm) {
        const inside = (eclipse.umbraRadiusKm + moonKm - km) / (2 * moonKm);
        status = `partial, ${Math.round(inside * 100)}% of the Moon's diameter in the umbra`;
    } else if (km - moonKm < eclipse.penumbraRadiusKm) status = "penumbral, the Moon dims only slightly";
    else status = `none, the Moon is ${eclipse.separation.toFixed(1)}° from the shadow axis`;

    // An eclipse happens for everyone at once, but only those with the Moon above their horizon get to see it.
    const moonAltitude = precise.moon.horizontalPosition(
        precise.fromJulianDay(jd),
        state.latitude,
        state.longitude,
    ).altitude;
    if (moonAltitude < 0) {
        svg += `<rect x="${-HALF}" y="${-HALF}" width="${2 * HALF}" height="${2 * HALF}" class="eclipse-veil"/>`;
        svg += `<text x="0" y="${16 - HALF}" class="eclipse-veil-label">below the horizon</text>`;
        status += " (the Moon is below the horizon at the chosen place)";
    }
    return { svg, status };
}

const RENDERERS = { solar: renderSolar, lunar: renderLunar };
const views = document.querySelectorAll(".eclipse-view[data-kind]");

function render() {
    for (const view of views) {
        const { svg, status } = RENDERERS[view.dataset.kind](state.jd);
        view.querySelector("svg").innerHTML = svg;
        view.querySelector('[data-field="status"]').textContent = status;
    }
}

for (const button of document.querySelectorAll(".eclipse-view [data-jump]")) {
    button.addEventListener("click", () => update(JUMPS[button.dataset.jump]));
}

onChange(render);
render();

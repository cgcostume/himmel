import { formatDMS } from "./format.js";
import { julianDayNow, onChange, state, update } from "./state.js";

// Every set of controls on the page (see Controls.astro) is wired the same way: user input writes to the shared
// state, and every state change is written back to all of them, so they always show the one moment and place.
const roots = [...document.querySelectorAll(".moment")];
const LATLONG_DECIMALS = 7;

// jd is UT; shown in the viewer's own timezone. JD 2451545 is 2000-01-01 12:00 UT.
const toDate = (jd) => new Date(Date.UTC(2000, 0, 1, 12) + (jd - 2451545) * 86400000);

// One-liner in every set's summary, so the current moment and place stay readable while it is folded.
function formatSummary() {
    const when = toDate(state.jd).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "medium" });
    const lat = `${Math.abs(state.latitude).toFixed(2)}° ${state.latitude >= 0 ? "N" : "S"}`;
    const lon = `${Math.abs(state.longitude).toFixed(2)}° ${state.longitude >= 0 ? "E" : "W"}`;
    return `${when}, ${lat} ${lon}, ${state.heightM} m${state.live ? ", live" : ""}`;
}

// Snapping to an exact multiple of minStep (not just rounding the display) matters because the steps themselves are
// repeating decimals (1/86400, 1/3600, ...): a step landing a hair off a whole second would make the time jitter.
function roundToStep(value, minStep, decimals = Math.max(0, Math.ceil(-Math.log10(minStep)) + 2)) {
    return Number((Math.round(value / minStep) * minStep).toFixed(decimals));
}

const capDecimals = (value, decimals) => Number(value.toFixed(decimals));
const minStepOf = (select) => Math.min(...[...select.options].map((option) => Number(option.value)));

// Arrow keys and wheel step by the selected granularity, by hand rather than via input.step: the browser's
// stepUp()/stepDown() silently no-ops on values that aren't exact multiples of `step`, which ours never are.
function wireStepping(input, stepSelect, commit, decimals) {
    input.step = "any";
    const minStep = minStepOf(stepSelect);
    const applyStep = (sign) => {
        input.value = roundToStep((Number(input.value) || 0) + sign * Number(stepSelect.value), minStep, decimals);
        commit();
    };
    input.addEventListener("keydown", (event) => {
        if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
        event.preventDefault();
        applyStep(event.key === "ArrowUp" ? 1 : -1);
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
}

let liveIntervalId = null;

function setLive(live, source) {
    clearInterval(liveIntervalId);
    liveIntervalId = live ? setInterval(() => update({ jd: julianDayNow() }), 1000) : null;
    update({ live, ...(live ? { jd: julianDayNow() } : {}) }, source);
}

for (const root of roots) {
    const field = (name) => root.querySelector(`[data-field="${name}"]`);
    const jd = field("jd");
    const latitude = field("latitude");
    const longitude = field("longitude");
    const height = field("height");

    const commitJd = () => {
        if (state.live) setLive(false, root);
        update({ jd: Number(jd.value) }, root);
    };
    const commitLatLong = () => update({ latitude: Number(latitude.value), longitude: Number(longitude.value) }, root);

    wireStepping(jd, field("jdStep"), commitJd);
    wireStepping(latitude, field("latitudeStep"), commitLatLong, LATLONG_DECIMALS);
    wireStepping(longitude, field("longitudeStep"), commitLatLong, LATLONG_DECIMALS);
    // The formulas take heights within the atmosphere they model; the input keeps to that range.
    const commitHeight = () => {
        height.value = Math.min(8000, Math.max(0, Number(height.value) || 0));
        update({ heightM: Number(height.value) }, root);
    };
    wireStepping(height, field("heightStep"), commitHeight, 0);
    jd.addEventListener("input", commitJd);
    latitude.addEventListener("input", commitLatLong);
    longitude.addEventListener("input", commitLatLong);
    height.addEventListener("change", commitHeight);

    field("now").addEventListener("click", () => update({ jd: julianDayNow() }));
    field("live").addEventListener("change", (event) => setLive(event.target.checked, root));
    field("geolocate").addEventListener("click", () => {
        const status = field("location");
        if (!navigator.geolocation) {
            status.textContent = "geolocation not supported by this browser";
            return;
        }
        status.textContent = "requesting location...";
        navigator.geolocation.getCurrentPosition(
            (position) => {
                status.textContent = "";
                update({
                    latitude: capDecimals(position.coords.latitude, LATLONG_DECIMALS),
                    longitude: capDecimals(position.coords.longitude, LATLONG_DECIMALS),
                });
            },
            (err) => {
                status.textContent = `geolocation failed: ${err.message}`;
            },
            { timeout: 5000 },
        );
    });
}

// Writes the state into every set of controls, except into the input the change is being typed into, so its caret and
// partial input stay put.
function sync(source) {
    for (const root of roots) {
        const field = (name) => root.querySelector(`[data-field="${name}"]`);
        const set = (input, value) => {
            if (!(root === source && input === document.activeElement)) input.value = value;
        };
        set(field("jd"), state.jd);
        set(field("latitude"), state.latitude);
        set(field("longitude"), state.longitude);
        set(field("height"), state.heightM);
        field("live").checked = state.live;
        field("latitudeDms").textContent = formatDMS(state.latitude).trim();
        field("longitudeDms").textContent = formatDMS(state.longitude).trim();
        field("summary").textContent = formatSummary();
    }
}

onChange(sync);
sync(null);

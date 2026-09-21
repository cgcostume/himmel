import { julianDay } from "@himmel/sternzeit";

/**
 * The one moment and place the whole page shows. Every set of controls writes here, and the tables and the scene
 * read from here, so any number of controls on the page stay in sync by construction.
 */
export const state = { jd: 0, latitude: 52.3920607, longitude: 13.0925765, live: false };

const changes = new EventTarget();

/** Applies `patch` and notifies every listener; `source` is the controls element the change came from, if any. */
export function update(patch, source = null) {
    Object.assign(state, patch);
    changes.dispatchEvent(new CustomEvent("change", { detail: source }));
}

export function onChange(listener) {
    changes.addEventListener("change", (event) => listener(event.detail));
}

/** Seconds, the finest step any control offers; "now" and stepping snap to it. */
const JD_MIN_STEP = 1 / 86400;

export function julianDayNow() {
    const now = new Date();
    const jd = julianDay({
        year: now.getUTCFullYear(),
        month: now.getUTCMonth() + 1,
        day: now.getUTCDate(),
        hour: now.getUTCHours(),
        minute: now.getUTCMinutes(),
        second: now.getUTCSeconds(),
        utcOffsetSeconds: 0,
    });
    return Number((Math.round(jd / JD_MIN_STEP) * JD_MIN_STEP).toFixed(7));
}

state.jd = julianDayNow();

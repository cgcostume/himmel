import { execFileSync } from "node:child_process";
import { statSync } from "node:fs";

/** When a page's content last changed: the date of the last commit touching the file, or its mtime outside a checkout. */
export function lastUpdated(path: string): Date {
    try {
        const committed = execFileSync("git", ["log", "-1", "--format=%cI", "--", path], { encoding: "utf8" }).trim();
        if (committed) return new Date(committed);
    } catch {
        // Not a git checkout, or git is missing; the file's own timestamp is the next best thing.
    }
    return statSync(path).mtime;
}

export function formatUpdated(date: Date): string {
    return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

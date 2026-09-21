import { getEntry } from "astro:content";
import { type Reference, references } from "../data/references";

/** The chapter's references numbered by first citation in its text, like a paper; throws for an unknown id. */
export async function chapterReferences(chapter: string): Promise<{ id: string; reference: Reference }[]> {
    const entry = await getEntry("chapters", chapter);
    const body = entry?.body ?? "";
    const firstCite = (id: string) => body.indexOf(`<Cite id="${id}"`) >>> 0; // uncited (-1) sorts last
    return [...(entry?.data.references ?? [])]
        .sort((a, b) => firstCite(a) - firstCite(b))
        .map((id) => {
            const reference = references[id];
            if (!reference) throw new Error(`chapter "${chapter}" lists unknown reference "${id}"`);
            return { id, reference };
        });
}

export const formatReference = (r: Reference) => `${r.authors}: ${r.title}. ${r.venue}, ${r.year}.`;

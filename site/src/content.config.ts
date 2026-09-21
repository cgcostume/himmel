import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

/** One chapter per @himmel/* library, ordered by `order` in the navigation. */
const chapters = defineCollection({
    loader: glob({ pattern: "*.mdx", base: "./src/content/chapters" }),
    schema: z.object({
        title: z.string(),
        package: z.string(),
        summary: z.string(),
        order: z.number(),
        /** Ids from src/data/references.ts; each must be cited in the text via <Cite>, which also sets the numbering. */
        references: z.array(z.string()).default([]),
    }),
});

export const collections = { chapters };

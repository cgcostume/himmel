import { defineConfig } from "rolldown";
import { dts } from "rolldown-plugin-dts";

export default defineConfig({
    input: {
        index: "src/index.ts",
        approx: "src/approx.ts",
    },
    plugins: [dts()],
    output: {
        dir: "dist",
        format: "es",
    },
});

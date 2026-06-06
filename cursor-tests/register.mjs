import "./setup-dom.mjs";
import { register } from "node:module";

await register(new URL("./loader.mjs", import.meta.url).href, import.meta.url);

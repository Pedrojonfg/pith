import "./setup-dom.mjs";
import { register } from "node:module";
import { pathToFileURL } from "node:url";

await register(pathToFileURL(new URL("./loader.mjs", import.meta.url).pathname).href, import.meta.url);

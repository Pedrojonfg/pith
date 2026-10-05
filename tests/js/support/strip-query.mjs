// Node loader: strips ?v= cache-bust queries and maps the browser CDN supabase import to the npm package.
const SUPABASE_CDN = "https://esm.sh/@supabase/supabase-js";

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith(SUPABASE_CDN)) return nextResolve("@supabase/supabase-js", context);
  const spec = specifier.includes("?") ? specifier.replace(/\?v=[^#&]+/g, "").replace(/\?$/, "") : specifier;
  return nextResolve(spec, context);
}

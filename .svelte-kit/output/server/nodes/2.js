import * as universal from '../entries/pages/_page.ts.js';

export const index = 2;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/_page.svelte.js')).default;
export { universal };
export const universal_id = "src/routes/+page.ts";
export const imports = ["_app/immutable/nodes/2.Dy5wULtR.js","_app/immutable/chunks/D3JBsBjB.js","_app/immutable/chunks/DqNjuCGP.js","_app/immutable/chunks/DVZSfy1l.js","_app/immutable/chunks/BAiInTrc.js","_app/immutable/chunks/Cnmjy6Er.js","_app/immutable/chunks/Ci9jLH6B.js"];
export const stylesheets = ["_app/immutable/assets/CitationModal.DHXnDTez.css","_app/immutable/assets/2.DXkCJ1Qi.css"];
export const fonts = [];

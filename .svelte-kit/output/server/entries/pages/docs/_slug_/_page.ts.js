import { error } from "@sveltejs/kit";
import { l as loadAllDocuments } from "../../../../chunks/documents.js";
const __variableDynamicImportRuntimeHelper = (glob, path, segs) => {
  const v = glob[path];
  if (v) {
    return typeof v === "function" ? v() : Promise.resolve(v);
  }
  return new Promise((_, reject) => {
    (typeof queueMicrotask === "function" ? queueMicrotask : setTimeout)(
      reject.bind(
        null,
        new Error(
          "Unknown variable dynamic import: " + path + (path.split("/").length !== segs ? ". Note that variables only represent file names one level deep." : "")
        )
      )
    );
  });
};
const prerender = true;
const entries = () => {
  const docs = loadAllDocuments();
  return docs.map((doc) => ({ slug: doc.slug }));
};
const load = async ({ params }) => {
  try {
    const post = await __variableDynamicImportRuntimeHelper(/* @__PURE__ */ Object.assign({ "../../../content/documents/2026-07-20-perspective-action-agenda-on-health-issues.md": () => import("../../../../chunks/documents.js").then((n) => n._), "../../../content/documents/2026-07-20-the-annihilation-of-caste-a-marxist-perspective.md": () => import("../../../../chunks/documents.js").then((n) => n.a), "../../../content/documents/2026-07-27-review-of-assembly-election-results-july-2026.md": () => import("../../../../chunks/documents.js").then((n) => n.b) }), `../../../content/documents/${params.slug}.md`, 6);
    return {
      meta: post.metadata,
      content: post.default
    };
  } catch (e) {
    throw error(404, `Document '${params.slug}' not found in archive.`);
  }
};
export {
  entries,
  load,
  prerender
};

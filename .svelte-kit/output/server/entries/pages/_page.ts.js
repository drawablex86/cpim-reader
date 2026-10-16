import { l as loadAllDocuments } from "../../chunks/documents.js";
const prerender = true;
const load = () => {
  const documents = loadAllDocuments();
  return { documents };
};
export {
  load,
  prerender
};

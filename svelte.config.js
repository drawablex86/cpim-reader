import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { mdsvex } from 'mdsvex';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';

const HTML_TAG_REGEX = /<(?:\/?[a-zA-Z][a-zA-Z0-9]*(?:\s+[^<>]*)?\/?>|!--[\s\S]*?--|\!DOCTYPE[^<>]*>)/g;
const VALID_TAGS = new Set([
  'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a', 'strong', 'em', 'b', 'i', 'u', 's',
  'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'blockquote',
  'code', 'pre', 'br', 'hr', 'span', 'div', 'img', 'sup', 'sub', 'mark', 'del', 'ins',
  'script', 'style'
]);

/**
 * Preprocessor for Markdown files to safely escape characters like { and }
 * and stray < in prose that cause Svelte syntax/compile errors.
 */
const markdownSafePreprocessor = {
  markup({ content, filename }) {
    if (!filename || !filename.endsWith('.md')) return;

    // 1. Protect valid HTML tags and escape prose <
    const tags = [];
    let protectedContent = content.replace(HTML_TAG_REGEX, (m) => {
      const match = m.match(/^<\/?([a-zA-Z0-9]+)/);
      const tagName = match ? match[1].toLowerCase() : '';
      if (VALID_TAGS.has(tagName) || m.startsWith('<!--')) {
        tags.push(m);
        return `___HTML_TAG_${tags.length - 1}___`;
      }
      return m;
    });

    // Escape stray < in prose
    protectedContent = protectedContent.replace(/</g, '&lt;');

    // Restore valid HTML tags
    protectedContent = protectedContent.replace(/___HTML_TAG_(\d+)___/g, (_, i) => tags[Number(i)]);

    return { code: protectedContent };
  }
};

/**
 * Post-MDSveX preprocessor that converts unescaped { and } into HTML entities
 * while leaving script and style blocks intact.
 */
const markdownPostEscapePreprocessor = {
  markup({ content, filename }) {
    if (!filename || !filename.endsWith('.md')) return;

    const scriptRegex = /<script(?:\s+[^>]*)?>[\s\S]*?<\/script>/gi;
    const styleRegex = /<style(?:\s+[^>]*)?>[\s\S]*?<\/style>/gi;
    const preserved = [];

    let processed = content
      .replace(scriptRegex, (m) => {
        preserved.push(m);
        return `___BLOCK_PRESERVE_${preserved.length - 1}___`;
      })
      .replace(styleRegex, (m) => {
        preserved.push(m);
        return `___BLOCK_PRESERVE_${preserved.length - 1}___`;
      });

    // Convert curly braces in prose into safe HTML entities
    processed = processed.replace(/\{/g, '&#123;').replace(/\}/g, '&#125;');

    processed = processed.replace(/___BLOCK_PRESERVE_(\d+)___/g, (_, idx) => preserved[Number(idx)]);

    return { code: processed };
  }
};

/** @type {import('@sveltejs/kit').Config} */
const config = {
  extensions: ['.svelte', '.md'],
  preprocess: [
    vitePreprocess(),
    markdownSafePreprocessor,
    mdsvex({
      extensions: ['.md'],
      rehypePlugins: [rehypeSlug, [rehypeAutolinkHeadings, { behavior: 'wrap' }]]
    }),
    markdownPostEscapePreprocessor
  ],
  kit: {
    adapter: adapter({
      pages: 'build',
      assets: 'build',
      fallback: undefined,
      precompress: true,
      strict: true
    }),
    prerender: {
      handleHttpError: ({ path, referrer, message }) => {
        // Log warning for broken internal anchor links from archived source markdown without failing build
        console.warn(`[prerender notice] ${message} at ${path} (from ${referrer})`);
      }
    }
  }
};

export default config;
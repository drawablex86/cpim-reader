
import root from '../root.js';
import { set_building, set_prerendering } from '$app/env/internal';
import { set_assets } from '$app/paths/internal/server';
import { set_manifest, set_read_implementation } from '__sveltekit/server';
import { set_private_env, set_public_env } from '../../../node_modules/@sveltejs/kit/src/runtime/shared-server.js';
import error from '../shared/error-template.js';

export const options = {
	app_template_contains_nonce: false,
	async: false,
	csp: {"mode":"auto","directives":{"upgrade-insecure-requests":false,"block-all-mixed-content":false},"reportOnly":{"upgrade-insecure-requests":false,"block-all-mixed-content":false}},
	csrf_check_origin: true,
	csrf_trusted_origins: [],
	embedded: false,
	env_public_prefix: 'PUBLIC_',
	env_private_prefix: '',
	hash_routing: false,
	hooks: null, // added lazily, via `get_hooks`
	preload_strategy: "modulepreload",
	root,
	service_worker: false,
	service_worker_options: undefined,
	server_error_boundaries: false,
	templates: {
		app: ({ head, body, assets, nonce, env }) => "<!DOCTYPE html>\n<html lang=\"en\">\n\t<head>\n\t\t<meta charset=\"utf-8\" />\n\t\t<link rel=\"icon\" href=\"https://cpim.org/wp-content/uploads/2024/04/cropped-ham-sic-website-2-copy-32x32.png\" />\n\t\t<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />\n\t\t<title>CPI(M) Official Documents Archive & Research Environment</title>\n\t\t\n\t\t<!-- Typography: Soviet Constructivist Display + Scholarly Editorial Prose + Archival Mono -->\n\t\t<link rel=\"preconnect\" href=\"https://fonts.googleapis.com\">\n\t\t<link rel=\"preconnect\" href=\"https://fonts.gstatic.com\" crossorigin>\n\t\t<link href=\"https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;0,6..72,700;1,6..72,400;1,6..72,600&family=Space+Grotesk:wght@500;600;700&display=swap\" rel=\"stylesheet\">\n\n\t\t<style>\n\t\t\t:root {\n\t\t\t\t/* CONSTRUCTIVIST PALETTE */\n\t\t\t\t--color-red-primary: #C41E3A;\n\t\t\t\t--color-red-dark: #9A1428;\n\t\t\t\t--color-red-light: #FCE8E6;\n\t\t\t\t--color-gold: #D4A017;\n\t\t\t\t--color-gold-muted: #E6C665;\n\t\t\t\t--color-black: #121212;\n\t\t\t\t--color-charcoal: #232323;\n\t\t\t\t--color-gray-dark: #404040;\n\t\t\t\t--color-gray-medium: #707070;\n\t\t\t\t--color-gray-light: #DDD9CF;\n\t\t\t\t--color-paper: #F4F1EA;\n\t\t\t\t--color-paper-light: #FAF8F5;\n\t\t\t\t--color-paper-dark: #E6E1D5;\n\t\t\t\t--color-surface-pure: #FFFFFF;\n\n\t\t\t\t/* BORDERS & SHADOWS */\n\t\t\t\t--border-heavy: 3px solid var(--color-black);\n\t\t\t\t--border-medium: 2px solid var(--color-black);\n\t\t\t\t--border-fine: 1px solid var(--color-gray-dark);\n\t\t\t\t--border-accent: 3px solid var(--color-red-primary);\n\t\t\t\t--shadow-hard-sm: 2px 2px 0px var(--color-black);\n\t\t\t\t--shadow-hard-md: 4px 4px 0px var(--color-black);\n\t\t\t\t--shadow-hard-lg: 6px 6px 0px var(--color-black);\n\n\t\t\t\t/* EDITORIAL READER */\n\t\t\t\t--reader-bg: var(--color-paper-light);\n\t\t\t\t--reader-ink: #1F2022;\n\t\t\t\t--reader-ink-secondary: #525357;\n\t\t\t\t--reader-link: var(--color-red-primary);\n\t\t\t\t--reader-measure: 68ch;\n\t\t\t\t--reader-line-height: 1.78;\n\n\t\t\t\t/* FONTS */\n\t\t\t\t--font-display: 'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;\n\t\t\t\t--font-prose: 'Newsreader', Georgia, serif;\n\t\t\t\t--font-mono: 'JetBrains Mono', 'Courier New', monospace;\n\t\t\t}\n\n\t\t\t*, *::before, *::after {\n\t\t\t\tbox-sizing: border-box;\n\t\t\t\tborder-radius: 0px !important; /* Strict Constructivist 90-degree angular forms */\n\t\t\t}\n\n\t\t\tbody {\n\t\t\t\tmargin: 0;\n\t\t\t\tpadding: 0;\n\t\t\t\tbackground-color: var(--color-paper);\n\t\t\t\tcolor: var(--color-black);\n\t\t\t\tfont-family: var(--font-display);\n\t\t\t\tline-height: 1.5;\n\t\t\t\t-webkit-font-smoothing: antialiased;\n\t\t\t\t-moz-osx-font-smoothing: grayscale;\n\t\t\t}\n\n\t\t\ta {\n\t\t\t\tcolor: inherit;\n\t\t\t\ttext-decoration: none;\n\t\t\t}\n\n\t\t\t::selection {\n\t\t\t\tbackground-color: var(--color-red-primary);\n\t\t\t\tcolor: #FFFFFF;\n\t\t\t}\n\t\t</style>\n\t\t" + head + "\n\t</head>\n\t<body data-sveltekit-preload-data=\"hover\">\n\t\t<div style=\"display: contents\">" + body + "</div>\n\t</body>\n</html>\n",
		error
	},
	version_hash: "1lmyv94"
};

export async function get_hooks() {
	let handle;
	let handleFetch;
	let handleError;
	let handleValidationError;
	let init;
	

	let reroute;
	let transport;
	

	return {
		handle,
		handleFetch,
		handleError,
		handleValidationError,
		init,
		reroute,
		transport
	};
}

export { set_assets, set_building, set_manifest, set_prerendering, set_private_env, set_public_env, set_read_implementation };

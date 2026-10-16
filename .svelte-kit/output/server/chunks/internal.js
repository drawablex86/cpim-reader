import { r as root } from "./root.js";
import "./server.js";
let read_implementation = null;
function set_read_implementation(fn) {
  read_implementation = fn;
}
function set_manifest(_) {
}
let public_env = {};
function set_private_env(environment) {
}
function set_public_env(environment) {
  public_env = environment;
}
const error = ({ status, message }) => '<!doctype html>\n<html lang="en">\n	<head>\n		<meta charset="utf-8" />\n		<title>' + message + `</title>

		<style>
			body {
				--bg: white;
				--fg: #222;
				--divider: #ccc;
				background: var(--bg);
				color: var(--fg);
				font-family:
					system-ui,
					-apple-system,
					BlinkMacSystemFont,
					'Segoe UI',
					Roboto,
					Oxygen,
					Ubuntu,
					Cantarell,
					'Open Sans',
					'Helvetica Neue',
					sans-serif;
				display: flex;
				align-items: center;
				justify-content: center;
				height: 100vh;
				margin: 0;
			}

			.error {
				display: flex;
				align-items: center;
				max-width: 32rem;
				margin: 0 1rem;
			}

			.status {
				font-weight: 200;
				font-size: 3rem;
				line-height: 1;
				position: relative;
				top: -0.05rem;
			}

			.message {
				border-left: 1px solid var(--divider);
				padding: 0 0 0 1rem;
				margin: 0 0 0 1rem;
				min-height: 2.5rem;
				display: flex;
				align-items: center;
			}

			.message h1 {
				font-weight: 400;
				font-size: 1em;
				margin: 0;
			}

			@media (prefers-color-scheme: dark) {
				body {
					--bg: #222;
					--fg: #ddd;
					--divider: #666;
				}
			}
		</style>
	</head>
	<body>
		<div class="error">
			<span class="status">` + status + '</span>\n			<div class="message">\n				<h1>' + message + "</h1>\n			</div>\n		</div>\n	</body>\n</html>\n";
const options = {
  app_template_contains_nonce: false,
  async: false,
  csp: { "mode": "auto", "directives": { "upgrade-insecure-requests": false, "block-all-mixed-content": false }, "reportOnly": { "upgrade-insecure-requests": false, "block-all-mixed-content": false } },
  csrf_check_origin: true,
  csrf_trusted_origins: [],
  embedded: false,
  env_public_prefix: "PUBLIC_",
  env_private_prefix: "",
  hash_routing: false,
  hooks: null,
  // added lazily, via `get_hooks`
  preload_strategy: "modulepreload",
  root,
  service_worker: false,
  service_worker_options: void 0,
  server_error_boundaries: false,
  templates: {
    app: ({ head, body, assets, nonce, env }) => `<!DOCTYPE html>
<html lang="en">
	<head>
		<meta charset="utf-8" />
		<link rel="icon" href="https://cpim.org/wp-content/uploads/2024/04/cropped-ham-sic-website-2-copy-32x32.png" />
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		<title>CPI(M) Official Documents Archive & Research Environment</title>
		
		<!-- Typography: Soviet Constructivist Display + Scholarly Editorial Prose + Archival Mono -->
		<link rel="preconnect" href="https://fonts.googleapis.com">
		<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
		<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;0,6..72,700;1,6..72,400;1,6..72,600&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">

		<style>
			:root {
				/* CONSTRUCTIVIST PALETTE */
				--color-red-primary: #C41E3A;
				--color-red-dark: #9A1428;
				--color-red-light: #FCE8E6;
				--color-gold: #D4A017;
				--color-gold-muted: #E6C665;
				--color-black: #121212;
				--color-charcoal: #232323;
				--color-gray-dark: #404040;
				--color-gray-medium: #707070;
				--color-gray-light: #DDD9CF;
				--color-paper: #F4F1EA;
				--color-paper-light: #FAF8F5;
				--color-paper-dark: #E6E1D5;
				--color-surface-pure: #FFFFFF;

				/* BORDERS & SHADOWS */
				--border-heavy: 3px solid var(--color-black);
				--border-medium: 2px solid var(--color-black);
				--border-fine: 1px solid var(--color-gray-dark);
				--border-accent: 3px solid var(--color-red-primary);
				--shadow-hard-sm: 2px 2px 0px var(--color-black);
				--shadow-hard-md: 4px 4px 0px var(--color-black);
				--shadow-hard-lg: 6px 6px 0px var(--color-black);

				/* EDITORIAL READER */
				--reader-bg: var(--color-paper-light);
				--reader-ink: #1F2022;
				--reader-ink-secondary: #525357;
				--reader-link: var(--color-red-primary);
				--reader-measure: 68ch;
				--reader-line-height: 1.78;

				/* FONTS */
				--font-display: 'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
				--font-prose: 'Newsreader', Georgia, serif;
				--font-mono: 'JetBrains Mono', 'Courier New', monospace;
			}

			*, *::before, *::after {
				box-sizing: border-box;
				border-radius: 0px !important; /* Strict Constructivist 90-degree angular forms */
			}

			body {
				margin: 0;
				padding: 0;
				background-color: var(--color-paper);
				color: var(--color-black);
				font-family: var(--font-display);
				line-height: 1.5;
				-webkit-font-smoothing: antialiased;
				-moz-osx-font-smoothing: grayscale;
			}

			a {
				color: inherit;
				text-decoration: none;
			}

			::selection {
				background-color: var(--color-red-primary);
				color: #FFFFFF;
			}
		</style>
		` + head + '\n	</head>\n	<body data-sveltekit-preload-data="hover">\n		<div style="display: contents">' + body + "</div>\n	</body>\n</html>\n",
    error
  },
  version_hash: "8ajus6"
};
async function get_hooks() {
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
export {
  set_public_env as a,
  set_read_implementation as b,
  set_manifest as c,
  get_hooks as g,
  options as o,
  public_env as p,
  read_implementation as r,
  set_private_env as s
};

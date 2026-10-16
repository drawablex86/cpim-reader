
// this file is generated — do not edit it


/// <reference types="@sveltejs/kit" />

/**
 * This module provides access to environment variables that are injected _statically_ into your bundle at build time and are limited to _private_ access.
 * 
 * |         | Runtime                                                                    | Build time                                                               |
 * | ------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
 * | Private | [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private) | [`$env/static/private`](https://svelte.dev/docs/kit/$env-static-private) |
 * | Public  | [`$env/dynamic/public`](https://svelte.dev/docs/kit/$env-dynamic-public)   | [`$env/static/public`](https://svelte.dev/docs/kit/$env-static-public)   |
 * 
 * Static environment variables are [loaded by Vite](https://vitejs.dev/guide/env-and-mode.html#env-files) from `.env` files and `process.env` at build time and then statically injected into your bundle at build time, enabling optimisations like dead code elimination.
 * 
 * **_Private_ access:**
 * 
 * - This module cannot be imported into client-side code
 * - This module only includes variables that _do not_ begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) _and do_ start with [`config.kit.env.privatePrefix`](https://svelte.dev/docs/kit/configuration#env) (if configured)
 * 
 * For example, given the following build time environment:
 * 
 * ```env
 * ENVIRONMENT=production
 * PUBLIC_BASE_URL=http://site.com
 * ```
 * 
 * With the default `publicPrefix` and `privatePrefix`:
 * 
 * ```ts
 * import { ENVIRONMENT, PUBLIC_BASE_URL } from '$env/static/private';
 * 
 * console.log(ENVIRONMENT); // => "production"
 * console.log(PUBLIC_BASE_URL); // => throws error during build
 * ```
 * 
 * The above values will be the same _even if_ different values for `ENVIRONMENT` or `PUBLIC_BASE_URL` are set at runtime, as they are statically replaced in your code with their build time values.
 */
declare module '$env/static/private' {
	export const INFOPATH: string;
	export const GEM_PATH: string;
	export const npm_lifecycle_script: string;
	export const npm_config_cache: string;
	export const CHROME_DEVTOOLS_MCP_JS: string;
	export const ANTIGRAVITY_LS_ADDRESS: string;
	export const ANTIGRAVITY_TRAJECTORY_ID: string;
	export const HOME: string;
	export const npm_config_prefix: string;
	export const SHLVL: string;
	export const XPC_SERVICE_NAME: string;
	export const npm_package_version: string;
	export const ZSH_TMUX_AUTOSTARTED: string;
	export const ANTIGRAVITY_CSRF_TOKEN: string;
	export const npm_config_npm_version: string;
	export const LANG: string;
	export const EDITOR: string;
	export const RUBY_VERSION: string;
	export const npm_lifecycle_event: string;
	export const NODE_EXTRA_CA_CERTS: string;
	export const DISABLE_AUTO_UPDATE: string;
	export const npm_config_node_gyp: string;
	export const PWD: string;
	export const XPC_FLAGS: string;
	export const npm_command: string;
	export const __CF_USER_TEXT_ENCODING: string;
	export const npm_config_init_module: string;
	export const npm_execpath: string;
	export const npm_config_userconfig: string;
	export const LaunchInstanceID: string;
	export const ANTIGRAVITY_CONVERSATION_ID: string;
	export const PATH: string;
	export const rvm_version: string;
	export const RPC_PROXY_DEST_OVERRIDE: string;
	export const PIP_CERT: string;
	export const ANTIGRAVITY_PROJECT_ID: string;
	export const HTTP_PROXY: string;
	export const npm_package_json: string;
	export const AGY_BROWSER_WS_URL: string;
	export const HTTPS_PROXY: string;
	export const COLOR: string;
	export const MY_RUBY_HOME: string;
	export const ANTIGRAVITY_LS_VERSION: string;
	export const PAGER: string;
	export const SECURITYSESSIONID: string;
	export const SSH_AUTH_SOCK: string;
	export const SVELTEKIT_FORK: string;
	export const npm_node_execpath: string;
	export const _: string;
	export const ANTIGRAVITY_SOURCE_METADATA: string;
	export const rvm_path: string;
	export const npm_config_user_agent: string;
	export const REQUESTS_CA_BUNDLE: string;
	export const npm_config_globalconfig: string;
	export const COMMAND_MODE: string;
	export const AGY_BROWSER_ACTIVE_PORT_FILE: string;
	export const GRPC_DEFAULT_SSL_ROOTS_FILE_PATH: string;
	export const __CFBundleIdentifier: string;
	export const GIT_SSL_CAINFO: string;
	export const USER: string;
	export const http_proxy: string;
	export const SERVER_AUTHORIZATION_ENABLED_ASK_TO_USE: string;
	export const https_proxy: string;
	export const rvm_prefix: string;
	export const SHELL: string;
	export const LOGNAME: string;
	export const npm_config_local_prefix: string;
	export const npm_package_name: string;
	export const npm_config_noproxy: string;
	export const ANTIGRAVITY_APP_DATA_DIR: string;
	export const FPATH: string;
	export const ANTIGRAVITY_AGENTAPI_EXE: string;
	export const RPC_PROXY_HEADER_AS_EXTENSION: string;
	export const npm_config_cafile: string;
	export const RPC_DEFAULT_CAN_USE_UDP: string;
	export const IRBRC: string;
	export const TERM: string;
	export const TMPDIR: string;
	export const CURL_CA_BUNDLE: string;
	export const NODE: string;
	export const INIT_CWD: string;
	export const npm_config_global_prefix: string;
	export const ZSH_TMUX_AUTOSTART: string;
	export const rvm_bin_path: string;
	export const NODE_ENV: string;
	export const AWS_CA_BUNDLE: string;
	export const OSLogRateLimit: string;
	export const GEM_HOME: string;
	export const GIT_PAGER: string;
	export const HOMEBREW_CELLAR: string;
	export const SSL_CERT_FILE: string;
	export const HOMEBREW_PREFIX: string;
	export const HOMEBREW_REPOSITORY: string;
	export const ANTIGRAVITY_AGENT: string;
}

/**
 * This module provides access to environment variables that are injected _statically_ into your bundle at build time and are _publicly_ accessible.
 * 
 * |         | Runtime                                                                    | Build time                                                               |
 * | ------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
 * | Private | [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private) | [`$env/static/private`](https://svelte.dev/docs/kit/$env-static-private) |
 * | Public  | [`$env/dynamic/public`](https://svelte.dev/docs/kit/$env-dynamic-public)   | [`$env/static/public`](https://svelte.dev/docs/kit/$env-static-public)   |
 * 
 * Static environment variables are [loaded by Vite](https://vitejs.dev/guide/env-and-mode.html#env-files) from `.env` files and `process.env` at build time and then statically injected into your bundle at build time, enabling optimisations like dead code elimination.
 * 
 * **_Public_ access:**
 * 
 * - This module _can_ be imported into client-side code
 * - **Only** variables that begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) (which defaults to `PUBLIC_`) are included
 * 
 * For example, given the following build time environment:
 * 
 * ```env
 * ENVIRONMENT=production
 * PUBLIC_BASE_URL=http://site.com
 * ```
 * 
 * With the default `publicPrefix` and `privatePrefix`:
 * 
 * ```ts
 * import { ENVIRONMENT, PUBLIC_BASE_URL } from '$env/static/public';
 * 
 * console.log(ENVIRONMENT); // => throws error during build
 * console.log(PUBLIC_BASE_URL); // => "http://site.com"
 * ```
 * 
 * The above values will be the same _even if_ different values for `ENVIRONMENT` or `PUBLIC_BASE_URL` are set at runtime, as they are statically replaced in your code with their build time values.
 */
declare module '$env/static/public' {
	
}

/**
 * This module provides access to environment variables set _dynamically_ at runtime and that are limited to _private_ access.
 * 
 * |         | Runtime                                                                    | Build time                                                               |
 * | ------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
 * | Private | [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private) | [`$env/static/private`](https://svelte.dev/docs/kit/$env-static-private) |
 * | Public  | [`$env/dynamic/public`](https://svelte.dev/docs/kit/$env-dynamic-public)   | [`$env/static/public`](https://svelte.dev/docs/kit/$env-static-public)   |
 * 
 * Dynamic environment variables are defined by the platform you're running on. For example if you're using [`adapter-node`](https://github.com/sveltejs/kit/tree/main/packages/adapter-node) (or running [`vite preview`](https://svelte.dev/docs/kit/cli)), this is equivalent to `process.env`.
 * 
 * **_Private_ access:**
 * 
 * - This module cannot be imported into client-side code
 * - This module includes variables that _do not_ begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) _and do_ start with [`config.kit.env.privatePrefix`](https://svelte.dev/docs/kit/configuration#env) (if configured)
 * 
 * > [!NOTE] In `dev`, `$env/dynamic` includes environment variables from `.env`. In `prod`, this behavior will depend on your adapter.
 * 
 * > [!NOTE] To get correct types, environment variables referenced in your code should be declared (for example in an `.env` file), even if they don't have a value until the app is deployed:
 * >
 * > ```env
 * > MY_FEATURE_FLAG=
 * > ```
 * >
 * > You can override `.env` values from the command line like so:
 * >
 * > ```sh
 * > MY_FEATURE_FLAG="enabled" npm run dev
 * > ```
 * 
 * For example, given the following runtime environment:
 * 
 * ```env
 * ENVIRONMENT=production
 * PUBLIC_BASE_URL=http://site.com
 * ```
 * 
 * With the default `publicPrefix` and `privatePrefix`:
 * 
 * ```ts
 * import { env } from '$env/dynamic/private';
 * 
 * console.log(env.ENVIRONMENT); // => "production"
 * console.log(env.PUBLIC_BASE_URL); // => undefined
 * ```
 */
declare module '$env/dynamic/private' {
	export const env: {
		INFOPATH: string;
		GEM_PATH: string;
		npm_lifecycle_script: string;
		npm_config_cache: string;
		CHROME_DEVTOOLS_MCP_JS: string;
		ANTIGRAVITY_LS_ADDRESS: string;
		ANTIGRAVITY_TRAJECTORY_ID: string;
		HOME: string;
		npm_config_prefix: string;
		SHLVL: string;
		XPC_SERVICE_NAME: string;
		npm_package_version: string;
		ZSH_TMUX_AUTOSTARTED: string;
		ANTIGRAVITY_CSRF_TOKEN: string;
		npm_config_npm_version: string;
		LANG: string;
		EDITOR: string;
		RUBY_VERSION: string;
		npm_lifecycle_event: string;
		NODE_EXTRA_CA_CERTS: string;
		DISABLE_AUTO_UPDATE: string;
		npm_config_node_gyp: string;
		PWD: string;
		XPC_FLAGS: string;
		npm_command: string;
		__CF_USER_TEXT_ENCODING: string;
		npm_config_init_module: string;
		npm_execpath: string;
		npm_config_userconfig: string;
		LaunchInstanceID: string;
		ANTIGRAVITY_CONVERSATION_ID: string;
		PATH: string;
		rvm_version: string;
		RPC_PROXY_DEST_OVERRIDE: string;
		PIP_CERT: string;
		ANTIGRAVITY_PROJECT_ID: string;
		HTTP_PROXY: string;
		npm_package_json: string;
		AGY_BROWSER_WS_URL: string;
		HTTPS_PROXY: string;
		COLOR: string;
		MY_RUBY_HOME: string;
		ANTIGRAVITY_LS_VERSION: string;
		PAGER: string;
		SECURITYSESSIONID: string;
		SSH_AUTH_SOCK: string;
		SVELTEKIT_FORK: string;
		npm_node_execpath: string;
		_: string;
		ANTIGRAVITY_SOURCE_METADATA: string;
		rvm_path: string;
		npm_config_user_agent: string;
		REQUESTS_CA_BUNDLE: string;
		npm_config_globalconfig: string;
		COMMAND_MODE: string;
		AGY_BROWSER_ACTIVE_PORT_FILE: string;
		GRPC_DEFAULT_SSL_ROOTS_FILE_PATH: string;
		__CFBundleIdentifier: string;
		GIT_SSL_CAINFO: string;
		USER: string;
		http_proxy: string;
		SERVER_AUTHORIZATION_ENABLED_ASK_TO_USE: string;
		https_proxy: string;
		rvm_prefix: string;
		SHELL: string;
		LOGNAME: string;
		npm_config_local_prefix: string;
		npm_package_name: string;
		npm_config_noproxy: string;
		ANTIGRAVITY_APP_DATA_DIR: string;
		FPATH: string;
		ANTIGRAVITY_AGENTAPI_EXE: string;
		RPC_PROXY_HEADER_AS_EXTENSION: string;
		npm_config_cafile: string;
		RPC_DEFAULT_CAN_USE_UDP: string;
		IRBRC: string;
		TERM: string;
		TMPDIR: string;
		CURL_CA_BUNDLE: string;
		NODE: string;
		INIT_CWD: string;
		npm_config_global_prefix: string;
		ZSH_TMUX_AUTOSTART: string;
		rvm_bin_path: string;
		NODE_ENV: string;
		AWS_CA_BUNDLE: string;
		OSLogRateLimit: string;
		GEM_HOME: string;
		GIT_PAGER: string;
		HOMEBREW_CELLAR: string;
		SSL_CERT_FILE: string;
		HOMEBREW_PREFIX: string;
		HOMEBREW_REPOSITORY: string;
		ANTIGRAVITY_AGENT: string;
		[key: `PUBLIC_${string}`]: undefined;
		[key: `${string}`]: string | undefined;
	}
}

/**
 * This module provides access to environment variables set _dynamically_ at runtime and that are _publicly_ accessible.
 * 
 * |         | Runtime                                                                    | Build time                                                               |
 * | ------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
 * | Private | [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private) | [`$env/static/private`](https://svelte.dev/docs/kit/$env-static-private) |
 * | Public  | [`$env/dynamic/public`](https://svelte.dev/docs/kit/$env-dynamic-public)   | [`$env/static/public`](https://svelte.dev/docs/kit/$env-static-public)   |
 * 
 * Dynamic environment variables are defined by the platform you're running on. For example if you're using [`adapter-node`](https://github.com/sveltejs/kit/tree/main/packages/adapter-node) (or running [`vite preview`](https://svelte.dev/docs/kit/cli)), this is equivalent to `process.env`.
 * 
 * **_Public_ access:**
 * 
 * - This module _can_ be imported into client-side code
 * - **Only** variables that begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) (which defaults to `PUBLIC_`) are included
 * 
 * > [!NOTE] In `dev`, `$env/dynamic` includes environment variables from `.env`. In `prod`, this behavior will depend on your adapter.
 * 
 * > [!NOTE] To get correct types, environment variables referenced in your code should be declared (for example in an `.env` file), even if they don't have a value until the app is deployed:
 * >
 * > ```env
 * > MY_FEATURE_FLAG=
 * > ```
 * >
 * > You can override `.env` values from the command line like so:
 * >
 * > ```sh
 * > MY_FEATURE_FLAG="enabled" npm run dev
 * > ```
 * 
 * For example, given the following runtime environment:
 * 
 * ```env
 * ENVIRONMENT=production
 * PUBLIC_BASE_URL=http://example.com
 * ```
 * 
 * With the default `publicPrefix` and `privatePrefix`:
 * 
 * ```ts
 * import { env } from '$env/dynamic/public';
 * console.log(env.ENVIRONMENT); // => undefined, not public
 * console.log(env.PUBLIC_BASE_URL); // => "http://example.com"
 * ```
 * 
 * ```
 * 
 * ```
 */
declare module '$env/dynamic/public' {
	export const env: {
		[key: `PUBLIC_${string}`]: string | undefined;
	}
}

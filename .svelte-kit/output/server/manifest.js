export const manifest = (() => {
function __memo(fn) {
	let value;
	return () => value ??= (value = fn());
}

return {
	appDir: "_app",
	appPath: "_app",
	assets: new Set([]),
	mimeTypes: {},
	_: {
		client: {start:"_app/immutable/entry/start.BzqCo-v2.js",app:"_app/immutable/entry/app.C2-9WzDs.js",imports:["_app/immutable/entry/start.BzqCo-v2.js","_app/immutable/chunks/DqNjuCGP.js","_app/immutable/chunks/C94CGQzX.js","_app/immutable/chunks/UcPn02SY.js","_app/immutable/chunks/B0XwC4Ot.js","_app/immutable/chunks/-UyI9lYi.js","_app/immutable/entry/app.C2-9WzDs.js","_app/immutable/chunks/DL_NRuCZ.js","_app/immutable/chunks/DqNjuCGP.js","_app/immutable/chunks/Ci9jLH6B.js","_app/immutable/chunks/BAiInTrc.js","_app/immutable/chunks/DVZSfy1l.js","_app/immutable/chunks/UcPn02SY.js","_app/immutable/chunks/Cnmjy6Er.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
		nodes: [
			__memo(() => import('./nodes/0.js')),
			__memo(() => import('./nodes/1.js'))
		],
		remotes: {
			
		},
		routes: [
			
		],
		prerendered_routes: new Set(["/","/docs/2026-07-27-review-of-assembly-election-results-july-2026","/docs/2026-07-20-perspective-action-agenda-on-health-issues","/docs/2026-07-20-the-annihilation-of-caste-a-marxist-perspective"]),
		matchers: async () => {
			
			return {  };
		},
		server_assets: {}
	}
}
})();

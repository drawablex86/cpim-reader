import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, type Plugin } from 'vite';
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

/**
 * Dev-only plugin to trigger and stream python sync pipeline execution.
 * 'apply: serve' strictly ensures this plugin is NEVER compiled into production builds.
 */
function devSyncPlugin(): Plugin {
	return {
		name: 'dev-sync-plugin',
		apply: 'serve',
		configureServer(server) {
			server.middlewares.use('/api/dev/sync', async (req, res) => {
				if (req.method !== 'POST') {
					res.statusCode = 405;
					return res.end(JSON.stringify({ error: 'Method Not Allowed' }));
				}

				let body = '';
				req.on('data', (chunk) => {
					body += chunk;
				});

				req.on('end', () => {
					let opts: { provider?: string; limit?: number; dryRun?: boolean; force?: boolean } = {};
					try {
						opts = body ? JSON.parse(body) : {};
					} catch {
						opts = {};
					}

					const pythonBin = fs.existsSync(path.resolve('.venv/bin/python3'))
						? path.resolve('.venv/bin/python3')
						: 'python3';

					const args = ['scripts/sync.py'];
					if (opts.provider) {
						args.push('--provider', opts.provider);
					}
					if (opts.limit) {
						args.push('--limit', String(opts.limit));
					}
					if (opts.dryRun) {
						args.push('--dry-run');
					}
					if (opts.force) {
						args.push('--force');
					}

					res.setHeader('Content-Type', 'text/plain; charset=utf-8');
					res.setHeader('Transfer-Encoding', 'chunked');
					res.setHeader('Cache-Control', 'no-cache');

					res.write(`[DEV PIPELINE INITIATED]\nExecuting: ${pythonBin} ${args.join(' ')}\n\n`);

					const child = spawn(pythonBin, args, {
						cwd: process.cwd(),
						env: process.env
					});

					child.stdout.on('data', (data) => {
						res.write(data.toString());
					});

					child.stderr.on('data', (data) => {
						res.write(data.toString());
					});

					child.on('close', (code) => {
						res.write(`\n\n[PROCESS TERMINATED WITH CODE ${code}]\n`);
						res.end();
					});

					child.on('error', (err) => {
						res.write(`\n[SPAWN ERROR]: ${err.message}\n`);
						res.end();
					});
				});
			});
		}
	};
}

export default defineConfig({
	plugins: [sveltekit(), devSyncPlugin()]
});

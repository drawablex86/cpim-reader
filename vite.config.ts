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

/**
 * Dev-only plugin to trigger and stream python semantic embedding pipeline execution.
 * 'apply: serve' strictly ensures this plugin is NEVER compiled into production builds.
 */
function devEmbedPlugin(): Plugin {
	return {
		name: 'dev-embed-plugin',
		apply: 'serve',
		configureServer(server) {
			server.middlewares.use('/api/dev/embed', async (req, res) => {
				if (req.method !== 'POST') {
					res.statusCode = 405;
					return res.end(JSON.stringify({ error: 'Method Not Allowed' }));
				}

				let body = '';
				req.on('data', (chunk) => {
					body += chunk;
				});

				req.on('end', () => {
					let opts: { model?: string; dim?: number; force?: boolean } = {};
					try {
						opts = body ? JSON.parse(body) : {};
					} catch {
						opts = {};
					}

					const pythonBin = fs.existsSync(path.resolve('.venv/bin/python3'))
						? path.resolve('.venv/bin/python3')
						: 'python3';

					const args = ['scripts/embed.py'];
					if (opts.model) {
						args.push('--model', opts.model);
					}
					if (opts.dim) {
						args.push('--dim', String(opts.dim));
					}
					if (opts.force) {
						args.push('--force');
					}

					res.setHeader('Content-Type', 'text/plain; charset=utf-8');
					res.setHeader('Transfer-Encoding', 'chunked');
					res.setHeader('Cache-Control', 'no-cache');

					res.write(`[DEV EMBED PIPELINE INITIATED]\nExecuting: ${pythonBin} ${args.join(' ')}\n\n`);

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

/**
 * Dev-only plugin for tracking translation models and executing single-document translation.
 * 'apply: serve' strictly ensures this plugin is NEVER compiled into production builds.
 */
function devTranslatePlugin(): Plugin {
	return {
		name: 'dev-translate-plugin',
		apply: 'serve',
		configureServer(server) {
			// Health check endpoint for translation models
			server.middlewares.use('/api/dev/models', async (req, res) => {
				if (req.method !== 'GET') {
					res.statusCode = 405;
					return res.end(JSON.stringify({ error: 'Method Not Allowed' }));
				}

				res.setHeader('Content-Type', 'application/json');

				// 1. Ollama status check
				let ollamaStatus = {
					status: 'offline',
					models: [] as string[],
					hasQwen: false,
					hasIndicTransInOllama: false,
					indicOllamaNote:
						'IndicTrans2 is an encoder-decoder (Seq2Seq) model and is not packaged in GGUF for Ollama. Ollama serves multilingual causal LLM qwen2.5:7b instead.'
				};

				try {
					const controller = new AbortController();
					const timeoutId = setTimeout(() => controller.abort(), 1500);
					const ollamaRes = await fetch('http://127.0.0.1:11434/api/tags', {
						signal: controller.signal
					});
					clearTimeout(timeoutId);

					if (ollamaRes.ok) {
						const data = (await ollamaRes.json()) as { models?: Array<{ name: string }> };
						const modelNames = (data.models || []).map((m) => m.name);
						ollamaStatus.status = 'online';
						ollamaStatus.models = modelNames;
						ollamaStatus.hasQwen = modelNames.some((m) => m.includes('qwen2.5:7b'));
					}
				} catch {
					// Ollama offline or unreachable
				}

				// 1. Quantized IndicTrans2 CTranslate2 INT8 model check (Ultra-Fast)
				const ct2Path = path.resolve('.cache/models/indictrans2/ct2-200m/en-indic-200m-ct2/ctranslate2_model');
				const ct2Exists = fs.existsSync(path.join(ct2Path, 'model.bin'));
				const ct2Status = {
					status: ct2Exists ? 'installed' : 'missing',
					path: '.cache/models/indictrans2/ct2-200m/',
					architecture: 'IndicTrans2 200M Distilled (CTranslate2 INT8 Quantized)',
					size: '807 MB',
					speed: '⚡ Sub-second (~0.4s/paragraph)'
				};

				// 2. IndicTrans2 1B local model check (PyTorch full)
				const indicPath = path.resolve('.cache/models/indictrans2/1b');
				const indicWeightsExist =
					fs.existsSync(path.join(indicPath, 'model.safetensors')) ||
					fs.existsSync(path.join(indicPath, 'pytorch_model.bin'));
				const indictrans2Status = {
					status: indicWeightsExist ? 'installed' : 'missing',
					path: '.cache/models/indictrans2/1b',
					architecture: 'AI4Bharat IndicTrans2 1B (PyTorch / Transformers Seq2Seq)',
					size: '4.5 GB'
				};

				// 3. OpenRouter check
				let hasOpenRouterKey = Boolean(process.env.OPENROUTER_API_KEY);
				if (!hasOpenRouterKey && fs.existsSync(path.resolve('.env'))) {
					const envContent = fs.readFileSync(path.resolve('.env'), 'utf-8');
					hasOpenRouterKey = /OPENROUTER_API_KEY=sk-or-/.test(envContent);
				}
				const openrouterStatus = {
					status: hasOpenRouterKey ? 'configured' : 'missing',
					model: 'google/gemma-4-31b-it:free'
				};

				res.statusCode = 200;
				res.end(
					JSON.stringify({
						ct2: ct2Status,
						ollama: ollamaStatus,
						indictrans2: indictrans2Status,
						openrouter: openrouterStatus
					})
				);
			});

			// Translation Catalog endpoint: lists all documents, tracking Malayalam translation status
			server.middlewares.use('/api/dev/translation-catalog', async (req, res) => {
				if (req.method !== 'GET') {
					res.statusCode = 405;
					return res.end(JSON.stringify({ error: 'Method Not Allowed' }));
				}

				const url = new URL(req.url || '', 'http://localhost');
				const lang = url.searchParams.get('lang') || 'ml';

				const docsDir = path.resolve('src/content/documents');
				const transDir = path.resolve(`src/content/translations/${lang}`);
				const manifestPath = path.resolve('data/manifest.json');

				let manifestDocs: Record<string, any> = {};
				if (fs.existsSync(manifestPath)) {
					try {
						const manifestData = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
						manifestDocs = manifestData.documents || {};
					} catch {
						manifestDocs = {};
					}
				}

				const files = fs.existsSync(docsDir)
					? fs.readdirSync(docsDir).filter((f) => f.endsWith('.md'))
					: [];

				const documents = files.map((file) => {
					const slug = file.replace(/\.md$/, '');
					const docPath = path.join(docsDir, file);
					const transFile = path.join(transDir, file);
					const isCompleted = fs.existsSync(transFile);

					// Read frontmatter title and date
					let title = slug;
					let date = '';
					let category = 'Document';
					try {
						const content = fs.readFileSync(docPath, 'utf-8');
						const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
						if (fmMatch) {
							const fmLines = fmMatch[1].split('\n');
							for (const line of fmLines) {
								if (line.startsWith('title:')) {
									title = line.replace(/^title:\s*/, '').replace(/^["']|["']$/g, '');
								} else if (line.startsWith('date:')) {
									date = line.replace(/^date:\s*/, '').replace(/^["']|["']$/g, '');
								} else if (line.startsWith('category:')) {
									category = line.replace(/^category:\s*/, '').replace(/^["']|["']$/g, '');
								}
							}
						}
					} catch {
						// Fallback to slug
					}

					// Check manifest metadata
					let engine = '';
					let updatedAt = '';
					for (const docInfo of Object.values(manifestDocs)) {
						if (
							docInfo.translations &&
							docInfo.translations[lang] &&
							(docInfo.file?.includes(slug) || docInfo.translations[lang].file?.includes(slug))
						) {
							engine = docInfo.translations[lang].engine || '';
							updatedAt = docInfo.translations[lang].updated_at || '';
							break;
						}
					}

					return {
						slug,
						title,
						date,
						category,
						status: isCompleted ? 'completed' : 'pending',
						engine: engine || (isCompleted ? 'archived' : ''),
						updated_at: updatedAt
					};
				});

				// Sort newest date first
				documents.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

				const completedCount = documents.filter((d) => d.status === 'completed').length;
				const pendingCount = documents.filter((d) => d.status === 'pending').length;

				res.setHeader('Content-Type', 'application/json');
				res.statusCode = 200;
				res.end(
					JSON.stringify({
						lang,
						total: documents.length,
						completed: completedCount,
						pending: pendingCount,
						documents
					})
				);
			});

			// Translation execution stream endpoint
			server.middlewares.use('/api/dev/translate', async (req, res) => {
				if (req.method !== 'POST') {
					res.statusCode = 405;
					return res.end(JSON.stringify({ error: 'Method Not Allowed' }));
				}

				let body = '';
				req.on('data', (chunk) => {
					body += chunk;
				});

				req.on('end', () => {
					let opts: {
						slug?: string;
						engine?: string;
						lang?: string;
						save?: boolean;
					} = {};
					try {
						opts = body ? JSON.parse(body) : {};
					} catch {
						opts = {};
					}

					const pythonBin = fs.existsSync(path.resolve('.venv/bin/python3'))
						? path.resolve('.venv/bin/python3')
						: 'python3';

					const slug =
						opts.slug || '2025-04-04-resolution-to-condemn-israels-genocidal-attacks-on-gaza';
					const engine = opts.engine || 'ct2';
					const lang = opts.lang || 'ml';

					const args = ['scripts/translate_single.py', '--slug', slug, '--engine', engine, '--lang', lang];
					if (opts.save !== false) {
						args.push('--save');
					}

					res.setHeader('Content-Type', 'text/plain; charset=utf-8');
					res.setHeader('Transfer-Encoding', 'chunked');
					res.setHeader('Cache-Control', 'no-cache');

					res.write(
						`[DEV TRANSLATE PIPELINE INITIATED]\n` +
							`Target Document : ${slug}\n` +
							`Engine          : ${engine.toUpperCase()}\n` +
							`Language        : ${lang.toUpperCase()} (Malayalam)\n` +
							`Executing       : ${pythonBin} ${args.join(' ')}\n\n`
					);

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
	plugins: [sveltekit(), devSyncPlugin(), devEmbedPlugin(), devTranslatePlugin()]
});

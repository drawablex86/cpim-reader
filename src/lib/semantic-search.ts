/**
 * Client-side semantic search engine using Google's EmbeddingGemma 2.
 * Executes offline in the browser via @huggingface/transformers (WebGPU / WASM).
 * 
 * Vectors are pre-built at dev time into static/vectors.json (256-dim MRL).
 * At search time, user query is embedded into the same 256-dim vector space
 * and scored against all documents via cosine similarity in <10ms.
 */

export interface SimilarDoc {
  slug: string;
  title: string;
  score: number;
}

export interface VectorDoc {
  slug: string;
  title: string;
  date: string;
  category: string;
  model: string;
  vector: number[];
  similar: SimilarDoc[];
}

export interface VectorIndex {
  model: string;
  dim: number;
  generated_at: string;
  count: number;
  documents: VectorDoc[];
}

export interface SearchResult {
  doc: VectorDoc;
  score: number;
}

// Module-level singletons (survive component re-mounts)
let indexCache: VectorIndex | null = null;
let pipelineCache: any = null;
let isPipelineLoading = false;
let modelProgress = 0;
let progressListeners: Array<(progress: number, status: string) => void> = [];

export function onModelProgress(callback: (progress: number, status: string) => void) {
  progressListeners.push(callback);
  // Emit current state immediately
  callback(modelProgress, isPipelineLoading ? 'loading' : pipelineCache ? 'ready' : 'idle');
  return () => {
    progressListeners = progressListeners.filter((l) => l !== callback);
  };
}

function notifyProgress(p: number, status: string) {
  modelProgress = p;
  progressListeners.forEach((cb) => cb(p, status));
}

/**
 * Loads pre-computed vectors.json from the static site assets.
 */
export async function loadVectorIndex(): Promise<VectorIndex> {
  if (indexCache) return indexCache;

  const res = await fetch('/vectors.json');
  if (!res.ok) {
    throw new Error('VECTOR_INDEX_NOT_FOUND');
  }

  indexCache = await res.json();
  return indexCache!;
}

/**
 * Initializes the Transformers.js pipeline in browser with EmbeddingGemma 2.
 */
export async function loadEmbeddingModel(): Promise<any> {
  if (pipelineCache) return pipelineCache;
  if (isPipelineLoading) {
    // Wait for in-flight initialization
    while (isPipelineLoading) {
      await new Promise((r) => setTimeout(r, 100));
    }
    if (pipelineCache) return pipelineCache;
  }

  isPipelineLoading = true;
  notifyProgress(5, 'initializing');

  try {
    const { pipeline, env } = await import('@huggingface/transformers');

    // Allow browser cache (Cache API / IndexedDB)
    env.allowLocalModels = false;

    // Use onnx-community quantized export for EmbeddingGemma 2
    pipelineCache = await pipeline('feature-extraction', 'onnx-community/embeddinggemma-2-ONNX', {
      device: 'webgpu', // Will fall back to 'wasm' automatically
      dtype: 'q4',
      progress_callback: (item: any) => {
        if (item?.status === 'progress' && item?.progress) {
          notifyProgress(Math.min(99, Math.round(item.progress)), 'downloading');
        } else if (item?.status === 'ready') {
          notifyProgress(100, 'ready');
        }
      }
    });

    notifyProgress(100, 'ready');
    return pipelineCache;
  } catch (err: any) {
    // If onnx-community/embeddinggemma-2-ONNX fails (e.g. network restricted), try fallback or dev API
    notifyProgress(0, 'error');
    isPipelineLoading = false;
    throw err;
  } finally {
    isPipelineLoading = false;
  }
}

/**
 * Cosine similarity between two float vectors.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  const len = Math.min(a.length, b.length);

  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-9);
}

/**
 * Executes dense vector search using EmbeddingGemma 2.
 * Supports task-specific prefixing: "task: search query | query: {query}"
 */
export async function semanticSearch(query: string, topK = 10): Promise<SearchResult[]> {
  const cleanQ = query.trim();
  if (!cleanQ) return [];

  const [index, model] = await Promise.all([loadVectorIndex(), loadEmbeddingModel()]);

  // EmbeddingGemma 2 instruction prefix for queries
  const inputStr = `task: search query | query: ${cleanQ}`;

  const output = await model(inputStr, {
    pooling: 'mean',
    normalize: true
  });

  // Extract query vector and truncate to index dimensions (MRL)
  const rawArray = Array.from(output.data as Float32Array);
  const queryVec = rawArray.slice(0, index.dim);

  const scored: SearchResult[] = index.documents.map((doc) => ({
    doc,
    score: cosineSimilarity(queryVec, doc.vector)
  }));

  // Sort descending by highest cosine similarity
  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, topK);
}

/**
 * Quick retrieval of pre-computed top-5 similar documents for a given document slug.
 * Zero model computation required.
 */
export async function getSimilarDocuments(slug: string): Promise<SimilarDoc[]> {
  try {
    const index = await loadVectorIndex();
    const doc = index.documents.find((d) => d.slug === slug);
    return doc?.similar || [];
  } catch {
    return [];
  }
}

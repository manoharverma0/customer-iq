// HuggingFace Embedding Generation
// Model: sentence-transformers/all-MiniLM-L6-v2 (384 dimensions, free tier)

const EMBEDDING_MODEL = 'sentence-transformers/all-MiniLM-L6-v2';
const HF_API_BASE = 'https://api-inference.huggingface.co/models';

/**
 * Generate a 384-dimensional embedding vector for a given text string.
 * Used for vector similarity search in pgvector.
 */
export async function generateEmbedding(text) {
  const hfToken = process.env.HF_TOKEN;
  if (!hfToken) {
    console.warn('HF_TOKEN not set — embedding generation unavailable');
    return null;
  }

  try {
    const response = await fetch(`${HF_API_BASE}/${EMBEDDING_MODEL}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${hfToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: text.slice(0, 512), // Model max tokens
        options: { wait_for_model: true },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.warn(`Embedding API error ${response.status}:`, err.slice(0, 100));
      return null;
    }

    const data = await response.json();

    // API returns: [[float, ...]] for batch or [float, ...] for single
    if (Array.isArray(data) && Array.isArray(data[0])) {
      return data[0]; // batch response — take first item
    }
    if (Array.isArray(data)) {
      return data; // single response
    }

    console.warn('Unexpected embedding response shape:', typeof data);
    return null;
  } catch (err) {
    console.warn('Embedding generation failed:', err.message);
    return null;
  }
}

/**
 * Generate embeddings for multiple texts in parallel (up to 5 at a time).
 */
export async function generateEmbeddings(texts) {
  const chunks = [];
  for (let i = 0; i < texts.length; i += 5) {
    chunks.push(texts.slice(i, i + 5));
  }

  const results = [];
  for (const chunk of chunks) {
    const embeddings = await Promise.all(chunk.map(t => generateEmbedding(t)));
    results.push(...embeddings);
  }
  return results;
}

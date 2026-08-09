import { pipeline, env } from "@xenova/transformers"

// Configure env to cache models in the local directory so it doesn't redownload
// on Render if possible, though Render free tier ephemeral filesystem means
// it will download on startup. all-MiniLM-L6-v2 is small (~90MB).
env.cacheDir = "./.cache"

let extractor = null

/**
 * Initialize the embedding model.
 */
async function initExtractor() {
  if (!extractor) {
    // using feature-extraction pipeline to get embeddings
    extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2")
  }
  return extractor
}

/**
 * Generate embedding for a given text.
 */
export async function embedText(text) {
  const ext = await initExtractor()
  const output = await ext(text, { pooling: 'mean', normalize: true })
  // Convert Float32Array to standard JS Array
  return Array.from(output.data)
}

/**
 * Compute cosine similarity between two vectors.
 */
function cosineSimilarity(vecA, vecB) {
  let dotProduct = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i]
    normA += vecA[i] * vecA[i]
    normB += vecB[i] * vecB[i]
  }
  if (normA === 0 || normB === 0) return 0
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

/**
 * Find the most relevant files for a given query using semantic search.
 * @param {string} query User's chat message
 * @param {Array<{path: string, content: string}>} files Array of fetched files
 * @param {number} topK Number of top results to return
 * @returns {Array<{path: string, content: string, score: number}>}
 */
export async function findRelevantFiles(query, files, topK = 5) {
  if (!files || files.length === 0) return []

  const queryEmbedding = await embedText(query)

  const scoredFiles = []
  for (const file of files) {
    // We combine the path and a snippet of the content to generate the embedding
    // Truncating content so we don't blow up the embedding model (max length 512 tokens)
    const textToEmbed = `File: ${file.path}\nContent: ${file.content.substring(0, 1500)}`
    
    try {
      const fileEmbedding = await embedText(textToEmbed)
      const score = cosineSimilarity(queryEmbedding, fileEmbedding)
      scoredFiles.push({ ...file, score })
    } catch (err) {
      console.warn(`Failed to embed file ${file.path}`, err)
      // If embedding fails, push with a low score
      scoredFiles.push({ ...file, score: -1 })
    }
  }

  // Sort descending by score
  scoredFiles.sort((a, b) => b.score - a.score)
  
  return scoredFiles.slice(0, topK)
}

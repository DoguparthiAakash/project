import { buildReviewPrompt } from "../prompts/reviewPrompt.js"
import { generateReview } from "../services/aiService.js"

const SUPPORTED_LANGUAGES = [
  "python", "java", "javascript", "typescript", "c", "cpp",
  "go", "rust", "html", "css", "php", "csharp",
]

const SUPPORTED_PROVIDERS = ["grok", "openai", "gemini", "anthropic", "groq", "nvidia", "openrouter"]

const MAX_CODE_LENGTH = 50000

export async function reviewCode(req, res) {
  const {
    code, language, mode = "review",
    // Provider settings from the frontend Settings dialog
    provider, apiKey, model,
  } = req.body

  if (!code || typeof code !== "string" || code.trim().length === 0) {
    return res.status(400).json({ message: "Code is required and cannot be empty." })
  }
  if (code.length > MAX_CODE_LENGTH) {
    return res.status(400).json({ message: `Code exceeds maximum length of ${MAX_CODE_LENGTH} characters.` })
  }
  if (!language || !SUPPORTED_LANGUAGES.includes(language.toLowerCase())) {
    return res.status(400).json({ message: `Unsupported language. Supported: ${SUPPORTED_LANGUAGES.join(", ")}` })
  }
  if (!["review", "explain", "refactor", "tests", "docs"].includes(mode)) {
    return res.status(400).json({ message: "Invalid mode." })
  }
  if (provider && !SUPPORTED_PROVIDERS.includes(provider)) {
    return res.status(400).json({ message: `Unknown provider: ${provider}` })
  }

  const prompt = buildReviewPrompt(code, language, mode)

  let rawText
  try {
    rawText = await generateReview(prompt, {
      provider: provider || undefined,
      apiKey:   typeof apiKey === "string" && apiKey.trim() ? apiKey.trim() : undefined,
      model:    typeof model  === "string" && model.trim()  ? model.trim()  : undefined,
    })
  } catch (err) {
    const msg = err.message || ""
    if (msg.includes("API key") || msg.includes("api key") || msg.includes("No API key")) {
      return res.status(401).json({ message: msg })
    }
    if (msg.toLowerCase().includes("quota") || msg.toLowerCase().includes("rate")) {
      return res.status(429).json({ message: "AI rate limit reached. Please try again shortly." })
    }
    return res.status(500).json({ message: `AI generation failed: ${msg}` })
  }

  let parsed
  try {
    const cleaned = rawText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
    parsed = JSON.parse(cleaned)
  } catch {
    return res.status(500).json({ message: "AI returned an invalid response. Please try again." })
  }

  return res.json({
    score:           Math.min(10, Math.max(1, Number(parsed.score) || 5)),
    summary:         String(parsed.summary || ""),
    bugs:            Array.isArray(parsed.bugs)            ? parsed.bugs            : [],
    security:        Array.isArray(parsed.security)        ? parsed.security        : [],
    performance:     Array.isArray(parsed.performance)     ? parsed.performance     : [],
    maintainability: Array.isArray(parsed.maintainability) ? parsed.maintainability : [],
    codeSmells:      Array.isArray(parsed.codeSmells)      ? parsed.codeSmells      : [],
    readability:     Array.isArray(parsed.readability)     ? parsed.readability     : [],
    bestPractices:   Array.isArray(parsed.bestPractices)   ? parsed.bestPractices   : [],
    timeComplexity:  String(parsed.timeComplexity  || ""),
    spaceComplexity: String(parsed.spaceComplexity || ""),
    optimizedCode:   String(parsed.optimizedCode   || ""),
    explanation:     String(parsed.explanation     || ""),
    ...(parsed.unitTests     ? { unitTests:     String(parsed.unitTests)     } : {}),
    ...(parsed.documentation ? { documentation: String(parsed.documentation) } : {}),
  })
}

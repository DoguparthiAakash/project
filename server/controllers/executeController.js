import { executeSandbox } from "../utils/sandbox.js"

const SUPPORTED = new Set([
  "python", "javascript", "typescript", "go", "php",
  "c", "cpp", "java", "rust",
])

const MAX_CODE_BYTES = 100_000
const MAX_STDIN_BYTES = 10_000

export async function executeCode(req, res) {
  const { code, language, stdin = "" } = req.body

  if (!code || typeof code !== "string" || !code.trim()) {
    return res.status(400).json({ message: "Code is required." })
  }
  if (Buffer.byteLength(code, "utf8") > MAX_CODE_BYTES) {
    return res.status(400).json({ message: "Code too large (max 100 KB)." })
  }
  if (!language || !SUPPORTED.has(language)) {
    return res.status(400).json({ message: `Language '${language}' is not supported.` })
  }
  if (typeof stdin === "string" && Buffer.byteLength(stdin, "utf8") > MAX_STDIN_BYTES) {
    return res.status(400).json({ message: "Stdin too large (max 10 KB)." })
  }

  // Timeout: 10 s for interpreted, 30 s for compiled
  const compiled = ["c", "cpp", "java", "rust"].includes(language)
  const timeout = compiled ? 30_000 : 10_000

  try {
    const result = await executeSandbox(code, language, stdin, timeout)
    return res.json(result)
  } catch (err) {
    return res.status(500).json({ message: `Execution failed: ${err.message}` })
  }
}

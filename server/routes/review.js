import { Router } from "express"
import { reviewCode } from "../controllers/reviewController.js"

const router = Router()

// POST /api/review — main code review endpoint
router.post("/review", reviewCode)

// GET /api/providers — returns which providers are pre-configured via env vars
// (lets the frontend show a green dot for server-side keys even without user input)
router.get("/providers", (_req, res) => {
  res.json({
    grok:      !!process.env.XAI_API_KEY,
    openai:    !!process.env.OPENAI_API_KEY,
    gemini:    !!process.env.GEMINI_API_KEY,
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    groq:      !!process.env.GROQ_API_KEY,
  })
})

export default router

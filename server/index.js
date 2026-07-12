import "dotenv/config"
import express    from "express"
import cors       from "cors"
import cookieParser from "cookie-parser"
import jwt        from "jsonwebtoken"
import path       from "path"
import { fileURLToPath } from "url"
import reviewRoutes  from "./routes/review.js"
import executeRoutes from "./routes/execute.js"
import authRoutes    from "./routes/auth.js"
import githubRoutes  from "./routes/github.js"
import projectRoutes from "./routes/project.js"
import agentRoutes   from "./routes/agent.js"

const app  = express()
const PORT = process.env.PORT || 3001

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ─── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.CLIENT_URL || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim())

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true)
      cb(new Error(`CORS: origin ${origin} not allowed`))
    },
    credentials: true,
  })
)

// Allow frontend (which has COEP: require-corp) to fetch from backend
app.use((req, res, next) => {
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  next();
});

// ─── Body + Cookie parsing ────────────────────────────────────────────────────
app.use(express.json({ limit: "2mb" }))
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())

// ─── JWT auth middleware ──────────────────────────────────────────────────────
// Attaches req.userId when a valid codesage_token cookie is present.
// Does NOT reject unauthenticated requests — individual routes/controllers do that.
const COOKIE_NAME = "codesage_token"

app.use((req, _res, next) => {
  const token = req.cookies?.[COOKIE_NAME]
  if (token) {
    try {
      const secret  = process.env.JWT_SECRET
      if (secret) {
        const decoded = jwt.verify(token, secret)
        req.userId    = decoded.sub
      }
    } catch {
      // expired / invalid — req.userId stays undefined, controller will 401
    }
  }
  next()
})

// ─── Routes ───────────────────────────────────────────────────────────────────
app.get("/health", (_, res) =>
  res.json({
    status:    "ok",
    version:   "3.0.0",
    ai:        process.env.GROQ_API_KEY      ? "Groq"      :
               process.env.XAI_API_KEY       ? "Grok (xAI)" :
               process.env.OPENAI_API_KEY    ? "OpenAI"    :
               process.env.GEMINI_API_KEY    ? "Gemini"    :
               process.env.ANTHROPIC_API_KEY ? "Anthropic" : "⚠ none",
    github:    !!process.env.GITHUB_CLIENT_ID,
    supabase:  !!process.env.SUPABASE_URL,
  })
)

app.use("/auth",       authRoutes)
app.use("/api",        reviewRoutes)
app.use("/api",        executeRoutes)
app.use("/api/git",    githubRoutes) // using the generalized controller
app.use("/api/project", projectRoutes)
app.use("/api/agent",  agentRoutes)

// ─── Serve Static Frontend (Production) ───────────────────────────────────────
app.use(express.static(path.join(__dirname, "../dist")))

app.get("*", (req, res, next) => {
  // If it's an API route that wasn't found, let it pass to the 404/error handler
  if (req.path.startsWith("/api") || req.path.startsWith("/auth")) {
    return next()
  }
  // Otherwise serve the React frontend index.html
  res.sendFile(path.join(__dirname, "../dist/index.html"))
})

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ message: err.message || "Internal server error" })
})

app.listen(PORT, () => {
  console.log(`\nCodeSage AI server v3 running on :${PORT}`)
  console.log(`  Supabase : ${process.env.SUPABASE_URL         ? "✓ connected" : "⚠ SUPABASE_URL not set"}`)
  console.log(`  GitHub   : ${process.env.GITHUB_CLIENT_ID     ? "✓ OAuth configured" : "⚠ GITHUB_CLIENT_ID not set"}`)
  console.log(`  JWT      : ${process.env.JWT_SECRET            ? "✓ secret set" : "⚠ JWT_SECRET not set"}`)
})

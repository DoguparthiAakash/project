/**
 * aiService.js
 *
 * Supports 5 AI providers selectable per-request:
 *   grok        — xAI Grok via OpenAI-compatible API
 *   openai      — OpenAI GPT models
 *   gemini      — Google Gemini via @google/generative-ai
 *   anthropic   — Anthropic Claude via @anthropic-ai/sdk
 *   groq        — Groq LPU inference via OpenAI-compatible API
 *
 * The caller (reviewController) passes { provider, apiKey, model }.
 * If apiKey is provided in the request it takes precedence over env vars,
 * allowing per-user keys from the frontend settings dialog.
 */
import OpenAI          from "openai"
import Anthropic       from "@anthropic-ai/sdk"
import { GoogleGenerativeAI } from "@google/generative-ai"

// ─── helpers ──────────────────────────────────────────────────────────────────

function resolveKey(requestKey, envKey, label) {
  const key = requestKey?.trim() || process.env[envKey]
  if (!key) throw new Error(`No API key for ${label}. Set ${envKey} on the server or add your key in Settings.`)
  return key
}

// ─── Grok (xAI) ───────────────────────────────────────────────────────────────

export async function generateWithGrok(prompt, { apiKey, model } = {}) {
  const key   = resolveKey(apiKey, "XAI_API_KEY", "Grok")
  const mdl   = model || process.env.GROK_MODEL || "grok-3-mini"
  const client = new OpenAI({ apiKey: key, baseURL: "https://api.x.ai/v1" })
  const res = await client.chat.completions.create({
    model: mdl,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
    max_tokens: 8192,
  })
  return res.choices[0].message.content
}

// ─── OpenAI ───────────────────────────────────────────────────────────────────

export async function generateWithOpenAI(prompt, { apiKey, model } = {}) {
  const key   = resolveKey(apiKey, "OPENAI_API_KEY", "OpenAI")
  const mdl   = model || process.env.OPENAI_MODEL || "gpt-4o-mini"
  const client = new OpenAI({ apiKey: key })
  const res = await client.chat.completions.create({
    model: mdl,
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0.2,
  })
  return res.choices[0].message.content
}

// ─── Google Gemini ────────────────────────────────────────────────────────────

export async function generateWithGemini(prompt, { apiKey, model } = {}) {
  const key   = resolveKey(apiKey, "GEMINI_API_KEY", "Gemini")
  const mdl   = model || "gemini-2.0-flash"
  const client = new GoogleGenerativeAI(key)
  const genModel = client.getGenerativeModel({
    model: mdl,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.2,
      maxOutputTokens: 8192,
    },
  })
  const result = await genModel.generateContent(prompt)
  return result.response.text()
}

// ─── Anthropic Claude ─────────────────────────────────────────────────────────

export async function generateWithAnthropic(prompt, { apiKey, model } = {}) {
  const key   = resolveKey(apiKey, "ANTHROPIC_API_KEY", "Anthropic")
  const mdl   = model || "claude-3-5-haiku-20241022"
  const client = new Anthropic({ apiKey: key })
  const msg = await client.messages.create({
    model: mdl,
    max_tokens: 8192,
    temperature: 0.2,
    messages: [{ role: "user", content: prompt }],
  })
  return msg.content[0].type === "text" ? msg.content[0].text : ""
}

// ─── Groq ─────────────────────────────────────────────────────────────────────

export async function generateWithGroq(prompt, { apiKey, model } = {}) {
  const key   = resolveKey(apiKey, "GROQ_API_KEY", "Groq")
  const mdl   = model || "llama-3.3-70b-versatile"
  const client = new OpenAI({ apiKey: key, baseURL: "https://api.groq.com/openai/v1" })
  const res = await client.chat.completions.create({
    model: mdl,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
    max_tokens: 8192,
    response_format: { type: "json_object" },
  })
  return res.choices[0].message.content
}

// ─── NVIDIA NIM ─────────────────────────────────────────────────────────────────

export async function generateWithNvidia(prompt, { apiKey, model } = {}) {
  const key   = resolveKey(apiKey, "NVIDIA_API_KEY", "NVIDIA NIM")
  const mdl   = model || "meta/llama-3.1-70b-instruct"
  const client = new OpenAI({ apiKey: key, baseURL: "https://integrate.api.nvidia.com/v1" })
  const res = await client.chat.completions.create({
    model: mdl,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
    max_tokens: 8192,
  })
  return res.choices[0].message.content
}

// ─── OpenRouter ───────────────────────────────────────────────────────────────

export async function generateWithOpenRouter(prompt, { apiKey, model } = {}) {
  const key   = resolveKey(apiKey, "OPENROUTER_API_KEY", "OpenRouter")
  const mdl   = model || "anthropic/claude-3.5-sonnet"
  const client = new OpenAI({ apiKey: key, baseURL: "https://openrouter.ai/api/v1" })
  const res = await client.chat.completions.create({
    model: mdl,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
    max_tokens: 8192,
  })
  return res.choices[0].message.content
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

const GENERATORS = {
  grok:      generateWithGrok,
  openai:    generateWithOpenAI,
  gemini:    generateWithGemini,
  anthropic: generateWithAnthropic,
  groq:      generateWithGroq,
  nvidia:    generateWithNvidia,
  openrouter: generateWithOpenRouter,
}

/**
 * Main entry point with auto-fallback.
 * @param {string} prompt
 * @param {{ provider?: string, apiKey?: string, model?: string }} options
 */
export async function generateReview(prompt, { provider, apiKey, model } = {}) {
  // Ordered list of providers to try
  const fallbackChain = [
    { id: "groq", envKey: "GROQ_API_KEY" },
    { id: "grok", envKey: "XAI_API_KEY" },
    { id: "gemini", envKey: "GEMINI_API_KEY" },
    { id: "openai", envKey: "OPENAI_API_KEY" },
    { id: "anthropic", envKey: "ANTHROPIC_API_KEY" },
    { id: "nvidia", envKey: "NVIDIA_API_KEY" },
    { id: "openrouter", envKey: "OPENROUTER_API_KEY" }
  ];

  // If the user specified a provider/key in the frontend, try that first.
  if (provider || apiKey) {
    const gen = GENERATORS[provider];
    if (gen) {
      try {
        return await gen(prompt, { apiKey, model });
      } catch (err) {
        console.warn(`Primary provider ${provider} failed: ${err.message}. Attempting auto-switch...`);
        // If it failed, we'll continue to fallbacks below
      }
    }
  }

  // Try auto-switching across all available environment providers
  let lastError;
  for (const { id, envKey } of fallbackChain) {
    if (process.env[envKey]) {
      try {
        console.log(`Auto-switching: trying ${id}...`);
        return await GENERATORS[id](prompt, {}); // uses env key and default model
      } catch (err) {
        console.warn(`Fallback ${id} failed: ${err.message}`);
        lastError = err;
      }
    }
  }

  throw new Error(
    "No AI provider available or all rate limits reached. " +
    "Add a key in Settings or set an environment variable " +
    "(GROQ_API_KEY, XAI_API_KEY, GEMINI_API_KEY, etc.). Last error: " + (lastError?.message || "None")
  );
}

export async function generateDockerfileForProject(filesSummary, { provider, apiKey, model } = {}) {
  const prompt = `You are a DevOps expert. Based on the following files present in the root directory of a project, write a completely valid, production-ready Dockerfile. 
Your response MUST be in JSON format: { "dockerfile": "FROM ..." }
If this is a web app, make sure to EXPOSE the correct port (e.g., 3000, 5173, 8080).
If there is no package manager or standard structure, use a basic Ubuntu or Alpine image that lists the files.

Files summary:
${filesSummary.substring(0, 50000)}`

  const rawText = await generateReview(prompt, { provider, apiKey, model })
  try {
    const cleaned = rawText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
    const parsed = JSON.parse(cleaned)
    return parsed.dockerfile || "FROM ubuntu:22.04\nWORKDIR /app\nCOPY . .\nCMD [\"ls\", \"-la\"]"
  } catch (err) {
    return "FROM ubuntu:22.04\nWORKDIR /app\nCOPY . .\nCMD [\"ls\", \"-la\"]"
  }
}

export async function generateWithFallback(prompt, fallbackProviders) {
  if (!fallbackProviders || fallbackProviders.length === 0) {
    throw new Error("No fallback providers configured.");
  }
  
  let lastError;
  for (const providerConfig of fallbackProviders) {
    try {
      console.log(`Attempting generation with provider: ${providerConfig.provider} (${providerConfig.model})`);
      const rawRes = await generateReview(prompt, {
        provider: providerConfig.provider,
        apiKey: providerConfig.apiKey,
        model: providerConfig.model
      });
      return rawRes;
    } catch (err) {
      console.warn(`Provider ${providerConfig.provider} failed: ${err.message}. Trying next fallback...`);
      lastError = err;
    }
  }
  
  throw new Error(`All fallback providers failed. Last error: ${lastError.message}`);
}

// ─── Project Generation ────────────────────────────────────────────────────────

export async function generateProjectWorkspace(prompt, { fallbackProviders, onProgress } = {}) {
  
  if (onProgress) onProgress("Agent 1: Managing dependencies and configuration...")
  const depPrompt = `You are Agent 1 (Dependency & Configuration Manager).
The user wants to scaffold a new project based on their prompt.
Your task is to analyze the project requirements and generate ALL necessary configuration files (e.g., package.json, tsconfig.json, .env.example, webpack/vite configs, etc.).
DO NOT write source code logic, only configuration and dependencies.
Your response MUST be in strict JSON format exactly like this:
{
  "files": [
    { "path": "package.json", "content": "..." }
  ]
}
Return ONLY raw JSON.
CRITICAL: When generating JSON files (like package.json), you MUST properly escape all nested double quotes inside the "content" string using backslashes (e.g., \\") so the outer JSON remains valid.

User Request: ${prompt}`

  let depFiles = []
  try {
    const rawDep = await generateWithFallback(depPrompt, fallbackProviders)
    const cleaned = rawDep.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
    depFiles = JSON.parse(cleaned).files || []
  } catch (err) {
    throw new Error("Agent 1 (Dependencies) failed: " + err.message)
  }

  if (onProgress) onProgress("Agent 2: Writing source code logic...")
  const codePrompt = `You are Agent 2 (Code Developer).
The user wants to scaffold a new project. 
Agent 1 has already prepared the following configuration files:
${depFiles.map(f => f.path).join(", ")}

Your task is to focus exclusively on writing the core application logic, components, and services.
Your response MUST be in strict JSON format exactly like this:
{
  "files": [
    { "path": "src/App.tsx", "content": "..." }
  ]
}
Return ONLY raw JSON.

User Request: ${prompt}`

  let codeFiles = []
  try {
    const rawCode = await generateWithFallback(codePrompt, fallbackProviders)
    const cleaned = rawCode.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
    codeFiles = JSON.parse(cleaned).files || []
  } catch (err) {
    throw new Error("Agent 2 (Code) failed: " + err.message)
  }

  if (onProgress) onProgress("Agent 3: Verifying and finalizing project...")
  const combinedFiles = [...depFiles, ...codeFiles]
  
  const verifierPrompt = `You are Agent 3 (Verifier & Reviewer).
Here are the files generated by Agent 1 (Dependencies) and Agent 2 (Code):
${combinedFiles.map(f => f.path).join(", ")}

Your task is to review all the files to ensure imports match dependencies, check for completeness, and fix any obvious errors. 
However, due to context limits, you don't need to rewrite all files. Only return files that need fixing or missing files that need to be created.
Your response MUST be in strict JSON format exactly like this:
{
  "files": [
    { "path": "src/App.tsx", "content": "..." }
  ]
}
Return ONLY raw JSON. If everything looks perfect and no changes are needed, return { "files": [] }.

User Request: ${prompt}`

  let fixedFiles = []
  try {
    const rawVerifier = await generateWithFallback(verifierPrompt, fallbackProviders)
    const cleaned = rawVerifier.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
    fixedFiles = JSON.parse(cleaned).files || []
  } catch (err) {
    // If verifier fails, we just fall back to the combined files
    console.warn("Agent 3 failed parsing or generating, using original files", err)
  }

  // Merge fixedFiles into combinedFiles
  const finalMap = new Map()
  combinedFiles.forEach(f => finalMap.set(f.path, f.content))
  fixedFiles.forEach(f => finalMap.set(f.path, f.content))

  return Array.from(finalMap.entries()).map(([path, content]) => ({ path, content }))
}

// ─── Chat Generators (History Support) ─────────────────────────────────────────


export async function chatWithGrok(messages, { apiKey, model } = {}) {
  const key   = resolveKey(apiKey, "XAI_API_KEY", "Grok")
  const mdl   = model || process.env.GROK_MODEL || "grok-3-mini"
  const client = new OpenAI({ apiKey: key, baseURL: "https://api.x.ai/v1" })
  const res = await client.chat.completions.create({
    model: mdl,
    messages,
    temperature: 0.2,
    max_tokens: 8192,
  })
  return res.choices[0].message.content
}

export async function chatWithOpenAI(messages, { apiKey, model } = {}) {
  const key   = resolveKey(apiKey, "OPENAI_API_KEY", "OpenAI")
  const mdl   = model || process.env.OPENAI_MODEL || "gpt-4o-mini"
  const client = new OpenAI({ apiKey: key })

  const formattedMessages = messages.map(m => {
    if (m.attachments && m.attachments.length > 0) {
      return {
        role: m.role,
        content: [
          { type: "text", text: m.content },
          ...m.attachments.map(url => ({ type: "image_url", image_url: { url } }))
        ]
      }
    }
    return { role: m.role, content: m.content }
  })

  const res = await client.chat.completions.create({
    model: mdl,
    messages: formattedMessages,
    response_format: { type: "json_object" },
    temperature: 0.2,
  })
  return res.choices[0].message.content
}

export async function chatWithGemini(messages, { apiKey, model } = {}) {
  const key   = resolveKey(apiKey, "GEMINI_API_KEY", "Gemini")
  const mdl   = model || "gemini-2.0-flash"
  const client = new GoogleGenerativeAI(key)
  const genModel = client.getGenerativeModel({
    model: mdl,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.2,
      maxOutputTokens: 8192,
    },
  })
  
  // Gemini expects history formatted specifically (role: 'user' | 'model', parts: [{text: ''} | {inlineData: ...}])
  const formatMsg = (m) => {
    const parts = [{ text: m.content }]
    if (m.attachments && m.attachments.length > 0) {
      m.attachments.forEach(url => {
        const [meta, data] = url.split(",")
        const mimeType = meta.match(/:(.*?);/)?.[1] || "image/jpeg"
        parts.push({ inlineData: { data, mimeType } })
      })
    }
    return parts
  }

  const history = messages.slice(0, -1).map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: formatMsg(m)
  }))
  
  const lastMessageObj = messages[messages.length - 1]
  const chat = genModel.startChat({ history })
  const result = await chat.sendMessage(formatMsg(lastMessageObj))
  return result.response.text()
}

export async function chatWithAnthropic(messages, { apiKey, model } = {}) {
  const key   = resolveKey(apiKey, "ANTHROPIC_API_KEY", "Anthropic")
  const mdl   = model || "claude-3-5-haiku-20241022"
  const client = new Anthropic({ apiKey: key })
  
  // Filter out system messages if they exist, or handle them via system parameter
  let systemMsg = ""
  const anthropicMessages = messages.filter(m => {
    if (m.role === "system") {
      systemMsg = m.content
      return false
    }
    return true
  }).map(m => {
    const content = []
    if (m.attachments && m.attachments.length > 0) {
      m.attachments.forEach(url => {
        const [meta, data] = url.split(",")
        const mimeType = meta.match(/:(.*?);/)?.[1] || "image/jpeg"
        content.push({ type: "image", source: { type: "base64", media_type: mimeType, data } })
      })
    }
    content.push({ type: "text", text: m.content })
    
    return {
      role: m.role === "assistant" ? "assistant" : "user",
      content: content.length === 1 ? content[0].text : content
    }
  })

  const msg = await client.messages.create({
    model: mdl,
    max_tokens: 8192,
    temperature: 0.2,
    system: systemMsg || undefined,
    messages: anthropicMessages,
  })
  return msg.content[0].type === "text" ? msg.content[0].text : ""
}

export async function chatWithGroq(messages, { apiKey, model } = {}) {
  const key   = resolveKey(apiKey, "GROQ_API_KEY", "Groq")
  const mdl   = model || "llama-3.3-70b-versatile"
  const client = new OpenAI({ apiKey: key, baseURL: "https://api.groq.com/openai/v1" })

  // Groq's default model does not support vision, strip attachments
  const formattedMessages = messages.map(m => ({ role: m.role, content: m.content }))

  const res = await client.chat.completions.create({
    model: mdl,
    messages: formattedMessages,
    temperature: 0.2,
    max_tokens: 8192,
    response_format: { type: "json_object" },
  })
  return res.choices[0].message.content
}

export async function chatWithNvidia(messages, { apiKey, model } = {}) {
  const key   = resolveKey(apiKey, "NVIDIA_API_KEY", "NVIDIA NIM")
  const mdl   = model || "meta/llama-3.1-70b-instruct"
  const client = new OpenAI({ apiKey: key, baseURL: "https://integrate.api.nvidia.com/v1" })

  const formattedMessages = messages.map(m => ({ role: m.role, content: m.content }))

  const res = await client.chat.completions.create({
    model: mdl,
    messages: formattedMessages,
    temperature: 0.2,
    max_tokens: 8192,
  })
  return res.choices[0].message.content
}

export async function chatWithOpenRouter(messages, { apiKey, model } = {}) {
  const key   = resolveKey(apiKey, "OPENROUTER_API_KEY", "OpenRouter")
  const mdl   = model || "anthropic/claude-3.5-sonnet"
  const client = new OpenAI({ apiKey: key, baseURL: "https://openrouter.ai/api/v1" })

  const formattedMessages = messages.map(m => ({ role: m.role, content: m.content }))

  const res = await client.chat.completions.create({
    model: mdl,
    messages: formattedMessages,
    temperature: 0.2,
    max_tokens: 8192,
  })
  return res.choices[0].message.content
}

const CHAT_GENERATORS = {
  grok:      chatWithGrok,
  openai:    chatWithOpenAI,
  gemini:    chatWithGemini,
  anthropic: chatWithAnthropic,
  groq:      chatWithGroq,
  nvidia:    chatWithNvidia,
  openrouter: chatWithOpenRouter,
}

/**
 * Chat entry point with auto-fallback.
 * @param {Array<{role: string, content: string}>} messages
 * @param {{ provider?: string, apiKey?: string, model?: string }} options
 */
export async function generateChat(messages, { provider, apiKey, model } = {}) {
  const fallbackChain = [
    { id: "groq", envKey: "GROQ_API_KEY" },
    { id: "grok", envKey: "XAI_API_KEY" },
    { id: "gemini", envKey: "GEMINI_API_KEY" },
    { id: "openai", envKey: "OPENAI_API_KEY" },
    { id: "anthropic", envKey: "ANTHROPIC_API_KEY" },
    { id: "nvidia", envKey: "NVIDIA_API_KEY" },
    { id: "openrouter", envKey: "OPENROUTER_API_KEY" }
  ];

  if (provider || apiKey) {
    const gen = CHAT_GENERATORS[provider];
    if (gen) {
      try {
        return await gen(messages, { apiKey, model });
      } catch (err) {
        console.warn(`Primary chat provider ${provider} failed: ${err.message}. Attempting auto-switch...`);
      }
    }
  }

  let lastError;
  for (const { id, envKey } of fallbackChain) {
    if (process.env[envKey]) {
      try {
        console.log(`Auto-switching chat: trying ${id}...`);
        return await CHAT_GENERATORS[id](messages, {});
      } catch (err) {
        console.warn(`Fallback chat ${id} failed: ${err.message}`);
        lastError = err;
      }
    }
  }

  throw new Error(
    "No AI provider available or all rate limits reached. " +
    "Add a key in Settings or set an environment variable. Last error: " + (lastError?.message || "None")
  );
}

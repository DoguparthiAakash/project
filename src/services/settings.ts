import type { AIProvider, AIProviderId, AppSettings, ProviderSettings } from "@/types/settings"

// ─── Provider metadata (static) ──────────────────────────────────────────────
// Order = tab order in SettingsDialog. Groq is first and the default provider.

export const AI_PROVIDERS: AIProvider[] = [
  {
    id: "groq",
    name: "Groq",
    description: "Ultra-fast inference via custom LPU chips. Best for instant feedback on any file size.",
    docsUrl: "https://console.groq.com/keys",
    keyPlaceholder: "gsk_...",
    badge: "Recommended",
    models: [
      { value: "llama-3.3-70b-versatile",       label: "Llama 3.3 70B Versatile" },
      { value: "llama-3.1-8b-instant",          label: "Llama 3.1 8B Instant (fastest)" },
      { value: "mixtral-8x7b-32768",            label: "Mixtral 8x7B" },
      { value: "deepseek-r1-distill-llama-70b", label: "DeepSeek R1 70B" },
    ],
    defaultModel: "llama-3.3-70b-versatile",
  },
  {
    id: "openai",
    name: "OpenAI",
    description: "Industry-standard GPT models. Reliable JSON output with strong code understanding.",
    docsUrl: "https://platform.openai.com/api-keys",
    keyPlaceholder: "sk-...",
    models: [
      { value: "gpt-4o",        label: "GPT-4o (best)" },
      { value: "gpt-4o-mini",   label: "GPT-4o Mini (fast)" },
      { value: "gpt-4-turbo",   label: "GPT-4 Turbo" },
      { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" },
    ],
    defaultModel: "gpt-4o-mini",
  },
  {
    id: "gemini",
    name: "Google Gemini",
    description: "Google's latest multimodal model. Strong code analysis with a free tier available.",
    docsUrl: "https://aistudio.google.com/app/apikey",
    keyPlaceholder: "AIza...",
    badge: "Free tier",
    models: [
      { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash (fast)" },
      { value: "gemini-1.5-pro",   label: "Gemini 1.5 Pro (best)" },
      { value: "gemini-1.5-flash", label: "Gemini 1.5 Flash" },
    ],
    defaultModel: "gemini-2.0-flash",
  },
  {
    id: "anthropic",
    name: "Anthropic Claude",
    description: "Claude 3.x models excel at nuanced code review with detailed explanations.",
    docsUrl: "https://console.anthropic.com/settings/keys",
    keyPlaceholder: "sk-ant-...",
    models: [
      { value: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet (best)" },
      { value: "claude-3-5-haiku-20241022",  label: "Claude 3.5 Haiku (fast)" },
      { value: "claude-3-opus-20240229",     label: "Claude 3 Opus" },
    ],
    defaultModel: "claude-3-5-haiku-20241022",
  },
  {
    id: "nvidia",
    name: "NVIDIA NIM",
    description: "NVIDIA's API catalog for accelerated AI inference.",
    docsUrl: "https://build.nvidia.com/",
    keyPlaceholder: "nvapi-...",
    models: [
      { value: "meta/llama-3.1-70b-instruct", label: "Llama 3.1 70B (NVIDIA)" },
      { value: "meta/llama-3.1-405b-instruct", label: "Llama 3.1 405B (NVIDIA)" },
      { value: "mistralai/mixtral-8x22b-instruct-v0.1", label: "Mixtral 8x22B (NVIDIA)" },
    ],
    defaultModel: "meta/llama-3.1-70b-instruct",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    description: "Access dozens of models via a single standardized API.",
    docsUrl: "https://openrouter.ai/keys",
    keyPlaceholder: "sk-or-...",
    models: [
      { value: "anthropic/claude-3.5-sonnet", label: "Claude 3.5 Sonnet" },
      { value: "meta-llama/llama-3.1-405b-instruct", label: "Llama 3.1 405B" },
      { value: "google/gemini-pro-1.5", label: "Gemini 1.5 Pro" },
    ],
    defaultModel: "anthropic/claude-3.5-sonnet",
  },
  {
    id: "grok",
    name: "Grok (xAI)",
    description: "xAI's Grok model with a massive 128k context window. Excellent for large file reviews.",
    docsUrl: "https://console.x.ai",
    keyPlaceholder: "xai-...",
    models: [
      { value: "grok-3-mini", label: "Grok 3 Mini (fast)" },
      { value: "grok-3",      label: "Grok 3 (best quality)" },
      { value: "grok-2",      label: "Grok 2" },
    ],
    defaultModel: "grok-3-mini",
  },
]

// ─── Defaults ─────────────────────────────────────────────────────────────────

function defaultSettings(): AppSettings {
  const providers = {} as Record<AIProviderId, ProviderSettings>
  for (const p of AI_PROVIDERS) {
    providers[p.id] = { apiKey: "", model: p.defaultModel }
  }
  return { 
    activeProvider: "groq", 
    providers,
    devopsAgentPermission: "ask",
    colors: {
      light: {
        background: "#f4f6fa",
        foreground: "#111111",
        card: "#ffffff",
        border: "#e2e8f0",
        primary: "#0A21C0",
      },
      dark: {
        background: "#0a0a0a",
        foreground: "#fafafa",
        card: "#171717",
        border: "#262626",
        primary: "#3b82f6",
      }
    }
  }
}

// ─── Persistence ──────────────────────────────────────────────────────────────

const STORAGE_KEY = "codesage_settings"

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultSettings()
    const parsed = JSON.parse(raw) as Partial<AppSettings>
    // Merge with defaults to handle new providers added later
    const defaults = defaultSettings()
    return {
      activeProvider: parsed.activeProvider ?? defaults.activeProvider,
      providers: { ...defaults.providers, ...(parsed.providers ?? {}) },
      devopsAgentPermission: parsed.devopsAgentPermission ?? defaults.devopsAgentPermission,
      colors: {
        light: { ...defaults.colors.light, ...(parsed.colors?.light ?? {}) },
        dark: { ...defaults.colors.dark, ...(parsed.colors?.dark ?? {}) }
      }
    }
  } catch {
    return defaultSettings()
  }
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  window.dispatchEvent(new Event("settingsUpdated"))
}

export function getActiveProviderSettings(settings: AppSettings): {
  provider: AIProviderId
  apiKey: string
  model: string
} {
  const p = settings.activeProvider
  return {
    provider: p,
    apiKey:   settings.providers[p]?.apiKey ?? "",
    model:    settings.providers[p]?.model  ?? (AI_PROVIDERS.find((x) => x.id === p)?.defaultModel ?? ""),
  }
}

export function hasValidKey(settings: AppSettings): boolean {
  const { apiKey } = getActiveProviderSettings(settings)
  return apiKey.trim().length > 0
}

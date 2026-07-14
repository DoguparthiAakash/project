export type AIProviderId = "grok" | "openai" | "gemini" | "anthropic" | "groq" | "nvidia" | "openrouter"

export interface AIProvider {
  id: AIProviderId
  name: string
  description: string
  docsUrl: string
  keyPlaceholder: string
  models: { value: string; label: string }[]
  defaultModel: string
  badge?: string  // e.g. "Recommended", "Free tier"
}

export interface ProviderSettings {
  apiKey: string
  model: string
}

export interface ThemeColors {
  background: string
  foreground: string
  primary: string
  border: string
  card: string
}

export interface AppSettings {
  agents: {
    planner: AIProviderId
    coder: AIProviderId
    fallback: AIProviderId
  }
  providers: Record<AIProviderId, ProviderSettings>
  devopsAgentPermission: 'ask' | 'auto'
  colors: {
    light: ThemeColors
    dark: ThemeColors
  }
}

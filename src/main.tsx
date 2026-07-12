import { StrictMode, Component } from "react"
import type { ReactNode, ErrorInfo } from "react"
import { createRoot } from "react-dom/client"

import "./index.css"
import App from "./App.tsx"
import { ThemeProvider } from "@/components/theme-provider.tsx"

// ─── Error Boundary ───────────────────────────────────────────────────────────
// Catches any render-time crash and shows a readable error instead of blank page.
interface EBState { hasError: boolean; error: Error | null }

class ErrorBoundary extends Component<{ children: ReactNode }, EBState> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error: Error): EBState {
    return { hasError: true, error }
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[CodeSage] Render error:", error, info.componentStack)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          fontFamily: "system-ui, sans-serif",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          minHeight: "100vh", padding: "2rem",
          background: "#0a0a0a", color: "#fafafa"
        }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "1rem" }}>
            Something went wrong
          </h1>
          <pre style={{
            background: "#1a1a1a", padding: "1rem", borderRadius: "0.5rem",
            maxWidth: "700px", width: "100%", overflow: "auto",
            fontSize: "0.8rem", color: "#f87171", whiteSpace: "pre-wrap"
          }}>
            {this.state.error?.message}
            {"\n\n"}
            {this.state.error?.stack}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: "1.5rem", padding: "0.6rem 1.5rem",
              borderRadius: "0.5rem", border: "none",
              background: "#3b82f6", color: "#fff", cursor: "pointer",
              fontSize: "0.95rem"
            }}
          >
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

// ─── Mount ────────────────────────────────────────────────────────────────────
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>
)

import { useEffect } from "react"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import LandingPage from "@/pages/LandingPage"
import DashboardPage from "@/pages/DashboardPage"
import { loadSettings } from "@/services/settings"

export default function App() {
  useEffect(() => {
    const applyColors = () => {
      const settings = loadSettings()
      if (!settings.colors) return
      
      const isDark = document.documentElement.classList.contains("dark")
      const activeColors = isDark ? settings.colors.dark : settings.colors.light
      
      if (!activeColors) return

      const root = document.documentElement
      if (activeColors.background) root.style.setProperty("--background", activeColors.background)
      if (activeColors.foreground) root.style.setProperty("--foreground", activeColors.foreground)
      if (activeColors.primary) {
        root.style.setProperty("--primary", activeColors.primary)
        root.style.setProperty("--brand-blue", activeColors.primary)
      }
      if (activeColors.border) root.style.setProperty("--border", activeColors.border)
      if (activeColors.card) {
        root.style.setProperty("--card", activeColors.card)
        root.style.setProperty("--sidebar", activeColors.card)
      }
    }

    applyColors()

    const handleSettingsUpdate = () => applyColors()
    window.addEventListener("settingsUpdated", handleSettingsUpdate)
    window.addEventListener("storage", handleSettingsUpdate)
    
    // Re-apply when dark class changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === "class") {
          applyColors()
        }
      })
    })
    
    observer.observe(document.documentElement, { attributes: true })

    return () => {
      window.removeEventListener("settingsUpdated", handleSettingsUpdate)
      window.removeEventListener("storage", handleSettingsUpdate)
      observer.disconnect()
    }
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

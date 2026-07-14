import { motion } from "framer-motion"
import { Link } from "react-router-dom"
import {
  ArrowRight, Brain, Zap,
  Terminal, Package, ShieldCheck, CheckCircle2,
  ExternalLink, Sparkles
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { ModeToggle } from "@/components/mode-toggle"

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  )
}

const agents = [
  {
    icon: Package,
    title: "Dependency Manager",
    description: "Autonomously orchestrates and installs project dependencies, ensuring compatibility and secure versions.",
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  {
    icon: Terminal,
    title: "Code Architect",
    description: "Writes, refactors, and structures clean code modules based on best practices and design patterns.",
    color: "text-primary",
    bg: "bg-primary/10",
  },
  {
    icon: ShieldCheck,
    title: "Process Verifier",
    description: "Acts as the final reviewer, validating generated outputs, testing logic, and ensuring a flawless execution.",
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
  },
]

const features = [
  {
    icon: Zap,
    title: "Unmatched Speed",
    description: "Parallel agent execution allows multiple tasks to be completed simultaneously, reducing project build times by 70%.",
  },
  {
    icon: Brain,
    title: "Intelligent Synergy",
    description: "Agents communicate in real-time, sharing context and refining outputs collaboratively for higher quality results.",
  },
  {
    icon: CheckCircle2,
    title: "Self-Healing Workflows",
    description: "The verification agent automatically identifies errors and loops back to the code architect to patch bugs instantly.",
  }
]

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.07 } },
}
const item = {
  hidden: { opacity: 0, y: 20 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.45 } },
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Navbar */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2.5">
              <img src="/logo.png" alt="Logo" className="size-8 rounded-xl object-contain shadow-sm" />
              <span className="font-bold text-lg tracking-tight">
                AgentForge <span className="text-primary">AI</span>
              </span>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex gap-2">
                <a href="https://github.com" target="_blank" rel="noopener noreferrer">
                  <GithubIcon className="size-4" /> GitHub
                </a>
              </Button>
              <ModeToggle />
              <Button asChild size="sm" className="gap-1.5 rounded-xl px-5 shadow-sm">
                <Link to="/dashboard">
                  Launch Platform <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <Badge variant="outline" className="mb-6 gap-2 px-4 py-1.5 text-sm rounded-full bg-primary/5 text-primary border-primary/20">
              <Sparkles className="size-3.5" />
              Next-Generation Multi-Agent Ecosystem
            </Badge>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-balance mb-6 leading-[1.1]"
          >
            The Future of Code is{" "}
            <span className="text-primary">Collaborative AI.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-7"
          >
            Harness the power of three specialized agents working in unison. From dependency management to code generation and rigorous verification, build perfect applications faster than ever.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3"
          >
            <Button asChild size="lg"
              className="gap-2 rounded-xl px-8 shadow-sm text-base h-12">
              <Link to="/dashboard">
                Start Building <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="gap-2 text-base rounded-xl h-12">
              <a href="https://github.com" target="_blank" rel="noopener noreferrer">
                <GithubIcon className="size-4" /> View Documentation
              </a>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Agents Overview */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-muted/40 border-y border-border">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              Meet Your Engineering Team
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Our unique tripartite agent architecture divides and conquers complex software development workflows.
            </p>
          </div>
          <motion.div
            variants={container} initial="hidden"
            whileInView="show" viewport={{ once: true, margin: "-80px" }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
          >
            {agents.map((agent) => (
              <motion.div key={agent.title} variants={item}>
                <Card className="sneat-card h-full">
                  <div className={`inline-flex size-14 rounded-2xl ${agent.bg} items-center justify-center mb-6`}>
                    <agent.icon className={`size-6 ${agent.color}`} />
                  </div>
                  <h3 className="font-bold text-xl mb-3">{agent.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{agent.description}</p>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-6">
                Why Multi-Agent Synergy?
              </h2>
              <p className="text-lg text-muted-foreground mb-8">
                Single-agent systems get overwhelmed. By delegating responsibilities, our agents maintain deep context within their specific domain, resulting in enterprise-grade output.
              </p>
              <div className="space-y-8">
                {features.map((feature, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="mt-1 bg-primary/10 p-2.5 rounded-xl h-fit">
                      <feature.icon className="size-5 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-lg mb-1">{feature.title}</h4>
                      <p className="text-muted-foreground">{feature.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-transparent blur-3xl rounded-full" />
              <div className="relative sneat-card border-2 border-primary/20 p-8 shadow-2xl flex flex-col gap-4">
                <div className="flex justify-between items-center bg-background rounded-xl p-4 border border-border">
                  <div className="flex items-center gap-3">
                    <Package className="text-blue-500 size-5" />
                    <span className="font-medium">Dependencies Resolved</span>
                  </div>
                  <CheckCircle2 className="text-emerald-500 size-5" />
                </div>
                <div className="flex justify-between items-center bg-background rounded-xl p-4 border border-border ml-6">
                  <div className="flex items-center gap-3">
                    <Terminal className="text-primary size-5" />
                    <span className="font-medium">Core Logic Synthesized</span>
                  </div>
                  <CheckCircle2 className="text-emerald-500 size-5" />
                </div>
                <div className="flex justify-between items-center bg-background rounded-xl p-4 border border-border ml-12">
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="text-emerald-500 size-5" />
                    <span className="font-medium">Verification Passed</span>
                  </div>
                  <CheckCircle2 className="text-emerald-500 size-5" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <Card className="sneat-card bg-primary text-primary-foreground border-0 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-12 opacity-10">
              <Brain className="size-64" />
            </div>
            <div className="relative z-10 p-12 sm:p-16 text-center">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
                Ready to experience Agentic AI?
              </h2>
              <p className="text-lg opacity-90 mb-10 max-w-2xl mx-auto">
                Step into the future of software development. Configure your LLM providers, and let the agents do the heavy lifting.
              </p>
              <Button asChild size="lg"
                className="bg-background text-foreground hover:bg-background/90 rounded-xl px-10 h-14 text-base shadow-sm">
                <Link to="/dashboard">
                  Initialize Workspace <ArrowRight className="size-4 ml-2" />
                </Link>
              </Button>
            </div>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12 px-4 sm:px-6 lg:px-8 bg-muted/20">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2.5">
              <img src="/logo.png" alt="Logo" className="size-7 rounded-lg object-contain" />
              <span className="font-bold">AgentForge AI</span>
            </div>

            <Separator orientation="vertical" className="hidden sm:block h-5" />

            <p className="text-sm text-muted-foreground text-center">
              Built with React, Tailwind v4 & the Multi-Agent Framework
            </p>

            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link to="/dashboard" className="hover:text-foreground transition-colors">
                Dashboard
              </Link>
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors flex items-center gap-1.5"
              >
                <ExternalLink className="size-3.5" /> GitHub
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

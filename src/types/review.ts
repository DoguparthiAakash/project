export type Severity = "critical" | "high" | "medium" | "low"

export interface ReviewIssue {
  title: string
  description: string
  severity: Severity
  line?: number
}

export interface ReviewResult {
  score: number
  summary: string
  bugs: ReviewIssue[]
  security: ReviewIssue[]
  performance: ReviewIssue[]
  maintainability: ReviewIssue[]
  codeSmells: ReviewIssue[]
  readability: ReviewIssue[]
  bestPractices: ReviewIssue[]
  timeComplexity: string
  spaceComplexity: string
  optimizedCode: string
  explanation: string
  unitTests?: string
  documentation?: string
}

export type ReviewMode = "review" | "explain" | "refactor" | "tests" | "docs"

export interface ReviewRequest {
  code: string
  language: string
  mode: ReviewMode
}

export interface StoredReview {
  id: string
  timestamp: number
  language: string
  codeSnippet: string
  result: ReviewResult
  mode: ReviewMode
}

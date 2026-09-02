/**
 * languageMap.ts
 * Maps file extensions (and special filenames) to Monaco editor language IDs.
 * Monaco's built-in language IDs: https://code.visualstudio.com/docs/languages/identifiers
 */

const EXT_TO_LANG: Record<string, string> = {
  // TypeScript / JavaScript
  ts:         "typescript",
  tsx:        "typescript",
  js:         "javascript",
  jsx:        "javascript",
  mjs:        "javascript",
  cjs:        "javascript",
  // Web
  html:       "html",
  htm:        "html",
  css:        "css",
  scss:       "scss",
  sass:       "scss",
  less:       "less",
  svelte:     "html",       // nearest approximation
  vue:        "html",
  // Data / Config
  json:       "json",
  jsonc:      "jsonc",
  yaml:       "yaml",
  yml:        "yaml",
  toml:       "ini",        // Monaco has no TOML; ini is closest
  xml:        "xml",
  // Python
  py:         "python",
  pyw:        "python",
  // Rust
  rs:         "rust",
  // Go
  go:         "go",
  // Java / Kotlin
  java:       "java",
  kt:         "kotlin",
  kts:        "kotlin",
  // C family
  c:          "c",
  h:          "c",
  cpp:        "cpp",
  cc:         "cpp",
  cxx:        "cpp",
  hpp:        "cpp",
  hxx:        "cpp",
  cs:         "csharp",
  // Ruby
  rb:         "ruby",
  // PHP
  php:        "php",
  // Shell
  sh:         "shell",
  bash:       "shell",
  zsh:        "shell",
  fish:       "shell",
  ps1:        "powershell",
  psm1:       "powershell",
  psd1:       "powershell",
  bat:        "bat",
  cmd:        "bat",
  // SQL
  sql:        "sql",
  // Markdown
  md:         "markdown",
  mdx:        "markdown",
  // Docker
  dockerfile: "dockerfile",
  // Terraform / HCL
  tf:         "hcl",
  hcl:        "hcl",
  // GraphQL
  graphql:    "graphql",
  gql:        "graphql",
  // Swift
  swift:      "swift",
  // Dart
  dart:       "dart",
  // R
  r:          "r",
  // Lua
  lua:        "lua",
  // Scala
  scala:      "scala",
  // Elixir / Erlang (no official Monaco ID; plain text)
  ex:         "plaintext",
  exs:        "plaintext",
  erl:        "plaintext",
  // WASM text
  wat:        "plaintext",
  // Misc text
  txt:        "plaintext",
  log:        "plaintext",
  env:        "shell",      // .env files look like shell exports
  lock:       "plaintext",
  // Prisma
  prisma:     "prisma",
  // CSV
  csv:        "plaintext",
  // Diff / patch
  diff:       "diff",
  patch:      "diff",
  // Ini / properties
  ini:        "ini",
  cfg:        "ini",
  conf:       "ini",
  properties: "ini",
}

/** Special full filenames (lowercased) */
const NAME_TO_LANG: Record<string, string> = {
  "dockerfile":          "dockerfile",
  ".dockerignore":       "ignore",
  ".gitignore":          "ignore",
  ".gitattributes":      "ini",
  ".eslintrc":           "json",
  ".prettierrc":         "json",
  ".babelrc":            "json",
  "makefile":            "makefile",
  "gnumakefile":         "makefile",
  "cmakelists.txt":      "cmake",
  "tsconfig.json":       "json",
  "package.json":        "json",
  "package-lock.json":   "json",
}

/**
 * Returns the Monaco language ID for a given file path.
 * Falls back to "plaintext" for unknown types.
 */
export function getMonacoLanguage(filePath: string): string {
  const name = filePath.split("/").pop()?.toLowerCase() ?? ""

  // Exact filename matches first
  if (NAME_TO_LANG[name]) return NAME_TO_LANG[name]

  // .env and variants
  if (name === ".env" || name.startsWith(".env.")) return "shell"

  // Extension lookup
  const parts = name.split(".")
  if (parts.length >= 2) {
    const ext = parts[parts.length - 1]
    return EXT_TO_LANG[ext] ?? "plaintext"
  }

  return "plaintext"
}

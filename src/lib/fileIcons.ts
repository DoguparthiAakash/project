/**
 * fileIcons.ts
 * Maps file extensions to a display icon character, a Tailwind color class,
 * and a short language label used in editor tabs and the breadcrumb.
 */

export interface FileIconInfo {
  /** Unicode / emoji icon displayed next to the filename */
  icon: string
  /** Tailwind text-color class */
  color: string
  /** Short language label, e.g. "TS", "PY" */
  label: string
}

const EXT_MAP: Record<string, FileIconInfo> = {
  // TypeScript / JavaScript
  ts:         { icon: "󰛦", color: "text-blue-400",    label: "TS"         },
  tsx:        { icon: "󰛦", color: "text-blue-300",    label: "TSX"        },
  js:         { icon: "󰌞", color: "text-yellow-400",  label: "JS"         },
  jsx:        { icon: "󰌞", color: "text-yellow-300",  label: "JSX"        },
  mjs:        { icon: "󰌞", color: "text-yellow-400",  label: "MJS"        },
  cjs:        { icon: "󰌞", color: "text-yellow-400",  label: "CJS"        },
  // Web
  html:       { icon: "󰌝", color: "text-orange-400",  label: "HTML"       },
  htm:        { icon: "󰌝", color: "text-orange-400",  label: "HTML"       },
  css:        { icon: "󰌜", color: "text-pink-400",    label: "CSS"        },
  scss:       { icon: "󰌜", color: "text-pink-500",    label: "SCSS"       },
  sass:       { icon: "󰌜", color: "text-pink-500",    label: "SASS"       },
  less:       { icon: "󰌜", color: "text-indigo-400",  label: "LESS"       },
  svelte:     { icon: "󰡄", color: "text-orange-500",  label: "SVELTE"     },
  vue:        { icon: "󰡄", color: "text-emerald-400", label: "VUE"        },
  // Python
  py:         { icon: "󰌠", color: "text-green-400",   label: "PY"         },
  pyw:        { icon: "󰌠", color: "text-green-400",   label: "PY"         },
  // Rust
  rs:         { icon: "󱘗", color: "text-orange-500",  label: "RS"         },
  // Go
  go:         { icon: "󰟓", color: "text-cyan-400",    label: "GO"         },
  // Java / Kotlin
  java:       { icon: "󰬷", color: "text-red-400",     label: "JAVA"       },
  kt:         { icon: "󱈙", color: "text-purple-400",  label: "KT"         },
  kts:        { icon: "󱈙", color: "text-purple-400",  label: "KTS"        },
  // C family
  c:          { icon: "󰙲", color: "text-blue-500",    label: "C"          },
  h:          { icon: "󰙲", color: "text-blue-400",    label: "H"          },
  cpp:        { icon: "󰙲", color: "text-blue-600",    label: "C++"        },
  cc:         { icon: "󰙲", color: "text-blue-600",    label: "C++"        },
  hpp:        { icon: "󰙲", color: "text-blue-500",    label: "HPP"        },
  cs:         { icon: "󰌛", color: "text-purple-500",  label: "C#"         },
  // Ruby
  rb:         { icon: "󰴭", color: "text-red-500",     label: "RB"         },
  // PHP
  php:        { icon: "󰌟", color: "text-indigo-400",  label: "PHP"        },
  // Config / data
  json:       { icon: "󰘦", color: "text-amber-400",   label: "JSON"       },
  jsonc:      { icon: "󰘦", color: "text-amber-400",   label: "JSONC"      },
  yaml:       { icon: "󰈙", color: "text-red-300",     label: "YAML"       },
  yml:        { icon: "󰈙", color: "text-red-300",     label: "YAML"       },
  toml:       { icon: "󰈙", color: "text-orange-300",  label: "TOML"       },
  xml:        { icon: "󰈛", color: "text-orange-400",  label: "XML"        },
  // Markdown / text
  md:         { icon: "󰍔", color: "text-zinc-300",    label: "MD"         },
  mdx:        { icon: "󰍔", color: "text-zinc-300",    label: "MDX"        },
  txt:        { icon: "󰈙", color: "text-zinc-400",    label: "TXT"        },
  // Shell
  sh:         { icon: "󰆍", color: "text-green-500",   label: "SH"         },
  bash:       { icon: "󰆍", color: "text-green-500",   label: "BASH"       },
  zsh:        { icon: "󰆍", color: "text-green-500",   label: "ZSH"        },
  fish:       { icon: "󰆍", color: "text-green-400",   label: "FISH"       },
  ps1:        { icon: "󰆍", color: "text-blue-400",    label: "PS1"        },
  bat:        { icon: "󰆍", color: "text-zinc-400",    label: "BAT"        },
  // Docker / infra
  dockerfile: { icon: "󰡨", color: "text-blue-400",    label: "DOCKER"     },
  // SQL
  sql:        { icon: "󰆼", color: "text-amber-300",   label: "SQL"        },
  // Lock / package
  lock:       { icon: "󰌾", color: "text-zinc-500",    label: "LOCK"       },
  // Env
  env:        { icon: "󰒋", color: "text-yellow-600",  label: "ENV"        },
  // Prisma
  prisma:     { icon: "󰡖", color: "text-teal-400",    label: "PRISMA"     },
  // GraphQL
  graphql:    { icon: "󱄾", color: "text-pink-400",    label: "GQL"        },
  gql:        { icon: "󱄾", color: "text-pink-400",    label: "GQL"        },
  // Misc
  swift:      { icon: "󰛥", color: "text-orange-400",  label: "SWIFT"      },
  dart:       { icon: "󰈕", color: "text-cyan-500",    label: "DART"       },
  r:          { icon: "󰟔", color: "text-blue-400",    label: "R"          },
  lua:        { icon: "󰢱", color: "text-indigo-300",  label: "LUA"        },
  tf:         { icon: "󱁢", color: "text-purple-500",  label: "TF"         },
  hcl:        { icon: "󱁢", color: "text-purple-500",  label: "HCL"        },
  wasm:       { icon: "󰐅", color: "text-purple-400",  label: "WASM"       },
}

const FILENAME_MAP: Record<string, FileIconInfo> = {
  "dockerfile":         { icon: "󰡨", color: "text-blue-400",   label: "DOCKER" },
  ".dockerignore":      { icon: "󰡨", color: "text-zinc-500",   label: "DOCKER" },
  ".gitignore":         { icon: "󰊢", color: "text-orange-400", label: "GIT"    },
  ".gitattributes":     { icon: "󰊢", color: "text-orange-400", label: "GIT"    },
  ".eslintrc":          { icon: "󰱺", color: "text-purple-400", label: "ESLINT" },
  ".eslintignore":      { icon: "󰱺", color: "text-purple-400", label: "ESLINT" },
  ".prettierrc":        { icon: "󰏤", color: "text-pink-400",   label: "FMT"    },
  ".prettierignore":    { icon: "󰏤", color: "text-pink-400",   label: "FMT"    },
  "package.json":       { icon: "󰎙", color: "text-red-400",    label: "NPM"    },
  "package-lock.json":  { icon: "󰎙", color: "text-red-300",    label: "LOCK"   },
  "tsconfig.json":      { icon: "󰛦", color: "text-blue-400",   label: "TS"     },
  "vite.config.ts":     { icon: "󱐋", color: "text-purple-400", label: "VITE"   },
  "vite.config.js":     { icon: "󱐋", color: "text-purple-400", label: "VITE"   },
  "tailwind.config.js": { icon: "󱏿", color: "text-cyan-400",   label: "TW"     },
  "tailwind.config.ts": { icon: "󱏿", color: "text-cyan-400",   label: "TW"     },
  "next.config.js":     { icon: "󰜈", color: "text-zinc-200",   label: "NEXT"   },
  "next.config.ts":     { icon: "󰜈", color: "text-zinc-200",   label: "NEXT"   },
  "readme.md":          { icon: "󰍔", color: "text-blue-300",   label: "README" },
}

const DEFAULT: FileIconInfo = { icon: "󰈔", color: "text-zinc-400", label: "FILE" }

export function getFileIcon(filePath: string): FileIconInfo {
  const name = filePath.split("/").pop()?.toLowerCase() ?? ""
  if (FILENAME_MAP[name]) return FILENAME_MAP[name]

  // Handle dotfiles like .env, .env.local
  if (name.startsWith(".env")) return EXT_MAP["env"]

  const parts = name.split(".")
  if (parts.length >= 2) {
    const ext = parts[parts.length - 1]
    if (EXT_MAP[ext]) return EXT_MAP[ext]
  }

  return DEFAULT
}

/** Returns true if the file is a known image type */
export function isImageFile(filePath: string): boolean {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? ""
  return ["png", "jpg", "jpeg", "gif", "svg", "webp", "ico", "bmp"].includes(ext)
}

/** Returns true if the file is likely binary (not editable as text) */
export function isBinaryFile(filePath: string): boolean {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? ""
  return ["wasm", "zip", "tar", "gz", "exe", "bin", "pdf", "ttf", "otf", "woff", "woff2"]
    .includes(ext)
}

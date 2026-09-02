/**
 * MonacoEditor.tsx
 *
 * A fully-configured Monaco editor wrapper that enables VS Code-level features:
 *  - Custom "CodeSage Dark" theme with vibrant token colors
 *  - IntelliSense, parameter hints, quick suggestions
 *  - Bracket-pair colorization, indent guides, sticky scroll
 *  - Format on paste / type, smart formatting
 *  - All keyboard shortcuts: Ctrl+S, Ctrl+/, Alt+↑↓, Shift+Alt+↑↓, Ctrl+G …
 *  - Right-click context menu: Ask AI, Explain, Generate Tests
 *  - Cursor position reporting
 *  - Exposes the raw editor instance via onEditorMount
 */

import { useRef, useCallback } from "react"
import MonacoReact, { type OnMount, type Monaco } from "@monaco-editor/react"
import type * as monaco from "monaco-editor"
import { getMonacoLanguage } from "@/lib/languageMap"

// ─── Types ─────────────────────────────────────────────────────────────────────

export type ContextMenuAction = "ask-ai" | "explain" | "generate-tests"

export interface MonacoEditorProps {
  value: string
  filePath: string
  onChange?: (value: string | undefined) => void
  /** Called when the user triggers Ctrl+S */
  onSave?: () => void
  /** Called whenever the cursor moves: line, column, total selection count */
  onCursorChange?: (line: number, col: number, selections: number) => void
  /** Fired when a right-click AI action is chosen with the selected text */
  onContextMenuAction?: (action: ContextMenuAction, selectedText: string) => void
  /** Raw editor + Monaco access for parent (toolbar actions etc.) */
  onEditorMount?: (
    editor: monaco.editor.IStandaloneCodeEditor,
    monacoInstance: Monaco
  ) => void
  showMinimap?: boolean
  wordWrap?: "off" | "on" | "wordWrapColumn" | "bounded"
  fontSize?: number
  readOnly?: boolean
}

// ─── Custom theme definition ────────────────────────────────────────────────────

function defineCodeSageTheme(monacoInstance: Monaco) {
  monacoInstance.editor.defineTheme("codesage-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      // Keywords — vivid violet
      { token: "keyword",             foreground: "c792ea", fontStyle: "italic" },
      { token: "keyword.control",     foreground: "c792ea", fontStyle: "italic" },
      // Types — cyan
      { token: "type",                foreground: "80cbc4" },
      { token: "type.identifier",     foreground: "80cbc4" },
      { token: "entity.name.type",    foreground: "80cbc4" },
      // Classes / components — yellow-orange
      { token: "entity.name.class",   foreground: "ffcb6b" },
      { token: "support.class",       foreground: "ffcb6b" },
      // Functions — light blue
      { token: "entity.name.function", foreground: "82aaff" },
      { token: "support.function",    foreground: "82aaff" },
      // Strings — green
      { token: "string",              foreground: "c3e88d" },
      { token: "string.template",     foreground: "c3e88d" },
      // Numbers — orange
      { token: "number",              foreground: "f78c6c" },
      { token: "constant.numeric",    foreground: "f78c6c" },
      // Comments — muted grey-green, italic
      { token: "comment",             foreground: "546e7a", fontStyle: "italic" },
      { token: "comment.line",        foreground: "546e7a", fontStyle: "italic" },
      { token: "comment.block",       foreground: "546e7a", fontStyle: "italic" },
      // Operators
      { token: "delimiter",           foreground: "89ddff" },
      { token: "delimiter.bracket",   foreground: "89ddff" },
      // Constants / booleans / null
      { token: "constant",            foreground: "f78c6c" },
      { token: "constant.language",   foreground: "f78c6c", fontStyle: "bold" },
      // HTML tags
      { token: "tag",                 foreground: "f07178" },
      { token: "tag.attribute.name",  foreground: "ffcb6b" },
      { token: "tag.attribute.value", foreground: "c3e88d" },
      // RegExp
      { token: "regexp",              foreground: "f78c6c" },
      // Parameters (italic for distinction)
      { token: "variable.parameter",  foreground: "f07178", fontStyle: "italic" },
      { token: "parameter",           foreground: "f07178", fontStyle: "italic" },
      // Decorators
      { token: "decorator",           foreground: "82aaff", fontStyle: "italic" },
    ],
    colors: {
      // Editor chrome
      "editor.background":               "#0d1117",
      "editor.foreground":               "#cdd6f4",
      "editorLineNumber.foreground":     "#3d4555",
      "editorLineNumber.activeForeground": "#6e7681",
      "editorCursor.foreground":         "#58a6ff",
      // Selection
      "editor.selectionBackground":      "#264f78aa",
      "editor.inactiveSelectionBackground": "#264f7855",
      // Search
      "editor.findMatchBackground":      "#f6a33244",
      "editor.findMatchHighlightBackground": "#f6a33222",
      // Gutter
      "editorGutter.background":         "#0d1117",
      "editorGutter.addedBackground":    "#238636",
      "editorGutter.modifiedBackground": "#9e6a03",
      "editorGutter.deletedBackground":  "#da3633",
      // Bracket pair colorization
      "editorBracketHighlight.foreground1": "#89ddff",
      "editorBracketHighlight.foreground2": "#c792ea",
      "editorBracketHighlight.foreground3": "#ffcb6b",
      "editorBracketHighlight.foreground4": "#82aaff",
      // Indent guides
      "editorIndentGuide.background":    "#21262d",
      "editorIndentGuide.activeBackground": "#30363d",
      // Widgets
      "editorWidget.background":         "#161b22",
      "editorWidget.border":             "#30363d",
      "editorSuggestWidget.background":  "#161b22",
      "editorSuggestWidget.border":      "#30363d",
      "editorSuggestWidget.selectedBackground": "#1f6feb44",
      "editorHoverWidget.background":    "#161b22",
      "editorHoverWidget.border":        "#30363d",
      // Scrollbar
      "scrollbarSlider.background":      "#30363d66",
      "scrollbarSlider.hoverBackground": "#30363d99",
      "scrollbarSlider.activeBackground":"#30363dcc",
      // Current line highlight
      "editor.lineHighlightBackground":  "#21262d55",
      "editor.lineHighlightBorder":      "#21262d00",
      // Minimap
      "minimap.background":              "#0d1117",
      // Overview ruler
      "editorOverviewRuler.border":      "#21262d",
    },
  })
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function MonacoEditor({
  value,
  filePath,
  onChange,
  onSave,
  onCursorChange,
  onContextMenuAction,
  onEditorMount,
  showMinimap = false,
  wordWrap = "on",
  fontSize = 14,
  readOnly = false,
}: MonacoEditorProps) {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<Monaco | null>(null)
  // Keep save handler stable across re-renders via ref
  const onSaveRef = useRef(onSave)
  onSaveRef.current = onSave
  const onContextRef = useRef(onContextMenuAction)
  onContextRef.current = onContextMenuAction

  const language = getMonacoLanguage(filePath)

  const handleMount: OnMount = useCallback((editor, monacoInstance) => {
    editorRef.current = editor
    monacoRef.current = monacoInstance

    // ── Define + apply theme
    defineCodeSageTheme(monacoInstance)
    monacoInstance.editor.setTheme("codesage-dark")

    // ── Cursor change reporting
    editor.onDidChangeCursorSelection((e) => {
      const pos = editor.getPosition()
      if (pos) {
        const selections = editor.getSelections()?.filter(
          s => !s.isEmpty()
        ).length ?? 0
        onCursorChange?.(pos.lineNumber, pos.column, selections)
      }
    })

    // ── Keyboard shortcuts
    const { KeyMod, KeyCode } = monacoInstance

    // Ctrl+S → save
    editor.addCommand(KeyMod.CtrlCmd | KeyCode.KeyS, () => {
      onSaveRef.current?.()
    })

    // Ctrl+/ already handled natively by Monaco (toggle line comment)

    // Ctrl+D → select next occurrence (Monaco built-in: "editor.action.addSelectionToNextFindMatch")
    // already built-in

    // Ctrl+Shift+K → delete line (already built-in)

    // Ctrl+Shift+P → command palette (we intercept at window level for our custom palette;
    //   prevent Monaco's default F1 palette from opening)
    editor.addCommand(KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyP, () => {
      // Bubble up — handled by CommandPalette in parent
      window.dispatchEvent(new CustomEvent("codesage:openPalette"))
    })

    // Ctrl+P → quick open (same event, parent decides)
    editor.addCommand(KeyMod.CtrlCmd | KeyCode.KeyP, () => {
      window.dispatchEvent(new CustomEvent("codesage:openPalette"))
    })

    // Ctrl+G → go to line (Monaco built-in, but make sure it's wired)
    editor.addCommand(KeyMod.CtrlCmd | KeyCode.KeyG, () => {
      editor.getAction("editor.action.gotoLine")?.run()
    })

    // Ctrl+Shift+F → find in files (bubble to our sidebar)
    editor.addCommand(KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyF, () => {
      window.dispatchEvent(new CustomEvent("codesage:openFindInFiles"))
    })

    // ── Right-click context menu items
    if (onContextRef.current) {
      editor.addAction({
        id: "codesage.askAI",
        label: "✨ Ask AI about this",
        contextMenuGroupId: "codesage",
        contextMenuOrder: 1,
        run: (ed) => {
          const sel = ed.getModel()?.getValueInRange(ed.getSelection()!) ?? ""
          onContextRef.current?.("ask-ai", sel)
        },
      })
      editor.addAction({
        id: "codesage.explain",
        label: "󰮦 Explain this code",
        contextMenuGroupId: "codesage",
        contextMenuOrder: 2,
        run: (ed) => {
          const sel = ed.getModel()?.getValueInRange(ed.getSelection()!) ?? ""
          onContextRef.current?.("explain", sel)
        },
      })
      editor.addAction({
        id: "codesage.generateTests",
        label: "󰙨 Generate tests for this",
        contextMenuGroupId: "codesage",
        contextMenuOrder: 3,
        run: (ed) => {
          const sel = ed.getModel()?.getValueInRange(ed.getSelection()!) ?? ""
          onContextRef.current?.("generate-tests", sel)
        },
      })
    }

    // Expose to parent
    onEditorMount?.(editor, monacoInstance)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <MonacoReact
      height="100%"
      language={language}
      value={value}
      onChange={onChange}
      onMount={handleMount}
      options={{
        // ── Appearance
        theme:                         "codesage-dark",
        fontSize,
        fontFamily:                    "'JetBrains Mono', 'Cascadia Code', 'Fira Code', 'Consolas', monospace",
        fontLigatures:                 true,
        lineHeight:                    1.6,
        letterSpacing:                 0.3,
        padding:                       { top: 16, bottom: 16 },

        // ── Layout
        wordWrap,
        minimap:                       { enabled: showMinimap, scale: 1, showSlider: "mouseover" },
        scrollBeyondLastLine:          false,
        smoothScrolling:               true,
        mouseWheelScrollSensitivity:   1.2,

        // ── Gutter
        lineNumbers:                   "on",
        lineNumbersMinChars:           3,
        glyphMargin:                   true,  // enables breakpoint/git gutter icons
        folding:                       true,
        foldingStrategy:               "indentation",
        showFoldingControls:           "mouseover",

        // ── Guides
        guides: {
          bracketPairs:              true,
          bracketPairsHorizontal:    true,
          indentation:               true,
          highlightActiveIndentation: true,
        },

        // ── Sticky scroll (class/fn header stays visible)
        stickyScroll:                  { enabled: true, maxLineCount: 3 },

        // ── Bracket colorization
        bracketPairColorization:       { enabled: true, independentColorPoolPerBracketType: true },

        // ── IntelliSense
        quickSuggestions:              { other: true, comments: false, strings: false },
        quickSuggestionsDelay:         100,
        suggestOnTriggerCharacters:    true,
        acceptSuggestionOnEnter:       "on",
        tabCompletion:                 "on",
        wordBasedSuggestions:          "matchingDocuments",
        parameterHints:                { enabled: true, cycle: true },
        lightbulb:                     { enabled: "on" as any },
        hover:                         { enabled: true, delay: 300, sticky: true },

        // ── Formatting
        formatOnPaste:                 true,
        formatOnType:                  false,      // can be noisy; opt-in per user
        autoIndent:                    "full",

        // ── Selection
        multiCursorModifier:           "alt",
        columnSelection:               false,
        mouseWheelZoom:                true,

        // ── Rendering
        renderWhitespace:              "selection",
        renderControlCharacters:       true,
        renderLineHighlight:           "all",
        renderValidationDecorations:   "on",
        occurrencesHighlight:          "singleFile",
        selectionHighlight:            true,
        matchBrackets:                 "always",

        // ── Code actions
        codeActionsOnSaveTimeout:      750,

        // ── Linked editing (auto-rename HTML closing tag)
        linkedEditing:                 true,


        // ── Misc
        cursorBlinking:                "smooth",
        cursorSmoothCaretAnimation:    "on",
        cursorStyle:                   "line",
        cursorWidth:                   2,
        readOnly,
        domReadOnly:                   readOnly,
        accessibilitySupport:          "auto",
        scrollbar: {
          vertical:                    "auto",
          horizontal:                  "auto",
          useShadows:                  true,
          verticalScrollbarSize:       8,
          horizontalScrollbarSize:     8,
        },
      }}
    />
  )
}

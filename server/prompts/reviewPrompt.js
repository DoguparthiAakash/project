/**
 * Build the structured prompt for the Gemini/OpenAI API.
 * @param {string} code
 * @param {string} language
 * @param {string} mode
 * @returns {string}
 */
export function buildReviewPrompt(code, language, mode) {
  const baseInstruction = `You are an expert code reviewer. Analyze the following ${language} code and respond ONLY with a valid JSON object. Do NOT include any markdown, code fences, or explanatory text outside of the JSON. The JSON must be parseable directly.`

  const codeBlock = `\n\nCode to analyze:\n\`\`\`${language}\n${code}\n\`\`\``

  const schema = `
Respond with this exact JSON structure (fill all fields, use empty arrays if nothing found):
{
  "score": <integer 1-10>,
  "summary": "<overall summary string>",
  "bugs": [{"title":"<string>","description":"<string>","severity":"critical|high|medium|low","line":<number or null>}],
  "security": [{"title":"<string>","description":"<string>","severity":"critical|high|medium|low","line":<number or null>}],
  "performance": [{"title":"<string>","description":"<string>","severity":"critical|high|medium|low","line":<number or null>}],
  "maintainability": [{"title":"<string>","description":"<string>","severity":"critical|high|medium|low","line":<number or null>}],
  "codeSmells": [{"title":"<string>","description":"<string>","severity":"critical|high|medium|low","line":<number or null>}],
  "readability": [{"title":"<string>","description":"<string>","severity":"critical|high|medium|low","line":<number or null>}],
  "bestPractices": [{"title":"<string>","description":"<string>","severity":"critical|high|medium|low","line":<number or null>}],
  "timeComplexity": "<Big-O notation and explanation>",
  "spaceComplexity": "<Big-O notation and explanation>",
  "optimizedCode": "<complete optimized version of the code as a string>",
  "explanation": "<detailed explanation of all improvements made>"
}`

  const modeExtras = {
    review: "",
    tests: `\nAlso include a "unitTests" field with a string containing comprehensive unit tests for this code.`,
    docs: `\nAlso include a "documentation" field with a string containing complete JSDoc/docstring documentation for this code.`,
    explain: `\nFocus the summary and explanation on deeply explaining what this code does, its algorithms, and patterns. Make optimizedCode the same as the input but with clarifying comments added.`,
    refactor: `\nFocus heavily on refactoring. The optimizedCode should be a fully refactored version following SOLID principles and best practices for ${language}.`,
  }

  return `${baseInstruction}${codeBlock}\n${schema}${modeExtras[mode] || ""}`
}

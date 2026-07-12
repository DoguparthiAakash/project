import { runRepoInDocker, execInPersistentContainer } from "../utils/dockerSandbox.js"
import { getRepoTree, getFileContent, commitMultipleFiles } from "../services/githubService.js"
import { generateReview, generateChat } from "../services/aiService.js"
import { 
  getGitHubToken, 
  getChatThreads, 
  createChatThread, 
  getThreadHistory, 
  deleteChatThread, 
  clearChatHistory, 
  saveChatMessage 
} from "../services/supabaseService.js"

async function getToken(req) {
  const userId = req.userId
  if (!userId) throw Object.assign(new Error("Not authenticated"), { status: 401 })
  const token = await getGitHubToken(userId)
  return token
}

function handleErr(res, err) {
  const status = err.status || 500
  res.status(status).json({ message: err.message })
}

const IGNORED_DIRS = ["node_modules", ".git", "dist", "build", "coverage", "vendor", "venv", ".venv", "__pycache__"]
const IGNORED_EXTS = [".png", ".jpg", ".jpeg", ".gif", ".ico", ".svg", ".mp4", ".mp3", ".wav", ".zip", ".tar", ".gz", ".pdf", ".exe", ".dll", ".so", ".dylib", ".class", ".jar"]

export async function handleRunProject(req, res) {
  try {
    const token = await getToken(req)
    const { owner, repo, branch } = req.params
    const { provider, apiKey, model } = req.body || {}

    const result = await runRepoInDocker({ owner, repo, branch: branch || "main", token, provider, apiKey, model })
    res.json(result)
  } catch (err) { handleErr(res, err) }
}

export async function handleAnalyzeProject(req, res) {
  try {
    const token = await getToken(req)
    const { owner, repo } = req.params
    const branch = req.query.branch || "main"
    const { provider, apiKey, model, targetPath } = req.body

    // 1. Fetch the full tree
    const treeData = await getRepoTree(token, owner, repo, branch)
    if (!treeData || !treeData.tree) {
      throw new Error("Could not fetch repository tree.")
    }

    // 2. Filter files to analyze (to avoid token limits and junk files)
    const filesToFetch = treeData.tree.filter(node => {
      if (node.type !== "blob") return false
      
      // If targetPath is specified, only include files that match or are under that path
      if (targetPath) {
        if (!node.path.startsWith(targetPath)) return false
      } else {
        const pathParts = node.path.split("/")
        if (pathParts.some(part => IGNORED_DIRS.includes(part) || part.startsWith("."))) return false
        
        const ext = "." + (node.path.split(".").pop() || "").toLowerCase()
        if (IGNORED_EXTS.includes(ext)) return false
      }

      return true
    })

    // To prevent exceeding limits, we might want to restrict to top N files or specific size
    // For targeted scans, we allow more files, otherwise 50
    const limitedFiles = filesToFetch.slice(0, targetPath ? 100 : 50)

    // 3. Fetch contents
    let projectContext = ""
    for (const file of limitedFiles) {
      try {
        const data = await getFileContent(token, owner, repo, file.path, branch || "main")
        projectContext += `\n--- File: ${file.path} ---\n${data.content}\n`
      } catch (e) {
        // Skip files that fail to load
      }
    }

    if (!projectContext) {
      throw new Error("No readable source code found in the repository.")
    }

    // 4. Construct AI Prompt
    const prompt = `
You are an expert software engineer. Review the following project codebase and identify any bugs, security vulnerabilities, or architectural improvements.
${targetPath ? `\nFocus SPECIFICALLY on the file or folder: ${targetPath}` : ""}

Codebase context:
${projectContext.substring(0, 100000)} // Truncating to 100k chars for safety

Provide your response in JSON format exactly like this:
{
  "summary": "High-level summary of the findings",
  "issues": [
    { "type": "bug|security|improvement", "description": "Details", "file": "path/to/file", "suggestedFix": "Description of the fix" }
  ],
  "fixes": [
    { "path": "path/to/file", "content": "Full replacement content for the file to fix the issue" }
  ],
  "score": 8
}
`

    // 5. Call AI
    const rawText = await generateReview(prompt, { provider, apiKey, model })
    
    let parsed
    try {
      const cleaned = rawText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
      parsed = JSON.parse(cleaned)
    } catch {
      throw new Error("AI returned invalid JSON.")
    }

    res.json(parsed)
  } catch (err) { handleErr(res, err) }
}

export async function handlePushFixes(req, res) {
  try {
    const token = await getToken(req)
    const { owner, repo, branch } = req.params
    const { message, fixes } = req.body

    if (!Array.isArray(fixes) || fixes.length === 0) {
      return res.status(400).json({ message: "No fixes provided." })
    }

    const updatedRef = await commitMultipleFiles({
      token,
      owner,
      repo,
      branch: branch || "main",
      message: message || "Applied AI-suggested fixes",
      changes: fixes
    })

    // Automatically fix workflow permissions so GitHub Actions can deploy successfully
    try {
      const { fixWorkflowPermissions } = await import("../services/githubService.js");
      await fixWorkflowPermissions(token, owner, repo);
    } catch (permErr) {
      console.warn("Could not auto-fix workflow permissions. User may not be admin or repository belongs to an organization.", permErr.message);
    }

    res.json({ ok: true, commit: updatedRef })
  } catch (err) { handleErr(res, err) }
}

export async function handleExecProject(req, res) {
  try {
    const token = await getToken(req)
    const { owner, repo, branch } = req.params
    const { command } = req.body

    if (!command) {
      return res.status(400).json({ message: "No command provided." })
    }

    const result = await execInPersistentContainer({
      owner,
      repo,
      branch: branch || "main",
      token,
      command
    })

    res.json(result)
  } catch (err) { handleErr(res, err) }
}

export async function handleGetThreads(req, res) {
  try {
    const userId = req.userId
    const threads = await getChatThreads(userId)
    res.json(threads)
  } catch (err) { handleErr(res, err) }
}

export async function handleCreateThread(req, res) {
  try {
    const userId = req.userId
    const { owner, repo } = req.params
    const { title } = req.body
    const thread = await createChatThread(userId, owner, repo, title)
    res.json(thread)
  } catch (err) { handleErr(res, err) }
}

export async function handleGetThreadHistory(req, res) {
  try {
    const userId = req.userId
    const { threadId } = req.params
    const history = await getThreadHistory(userId, threadId)
    res.json(history)
  } catch (err) { handleErr(res, err) }
}

export async function handleDeleteThread(req, res) {
  try {
    const userId = req.userId
    const { threadId } = req.params
    await deleteChatThread(userId, threadId)
    res.json({ ok: true })
  } catch (err) { handleErr(res, err) }
}

export async function handleClearChatHistory(req, res) {
  try {
    const userId = req.userId
    const { owner, repo } = req.params
    await clearChatHistory(userId, owner, repo)
    res.json({ ok: true })
  } catch (err) { handleErr(res, err) }
}

export async function handleChatProject(req, res) {
  try {
    const token = await getToken(req)
    const userId = req.userId
    const { owner, repo, threadId } = req.params
    const branch = req.query.branch || "main"
    const { provider, apiKey, model, targetPath, message, attachments } = req.body

    // 1. Save the user's new message to the database
    await saveChatMessage(userId, threadId, owner, repo, 'user', message, [], attachments || [])

    // 2. Fetch the full chat history
    const history = await getThreadHistory(userId, threadId)

    // 3. Fetch codebase context (simplified for chat to stay within token limits)
    const treeData = await getRepoTree(token, owner, repo, branch)
    let projectContext = ""
    if (treeData && treeData.tree) {
      const filesToFetch = treeData.tree.filter(node => {
        if (node.type !== "blob") return false
        if (targetPath && !node.path.startsWith(targetPath)) return false
        const pathParts = node.path.split("/")
        if (pathParts.some(part => IGNORED_DIRS.includes(part) || part.startsWith("."))) return false
        const ext = "." + (node.path.split(".").pop() || "").toLowerCase()
        if (IGNORED_EXTS.includes(ext)) return false
        return true
      })

      const limitedFiles = filesToFetch.slice(0, targetPath ? 10 : 5)
      for (const file of limitedFiles) {
        try {
          const data = await getFileContent(token, owner, repo, file.path, branch || "main")
          projectContext += `\n--- File: ${file.path} ---\n${data.content}\n`
        } catch (e) {}
      }
    }

    // 4. Construct system message
    const systemMessage = {
      role: 'system',
      content: `You are an expert software engineer. Help the user by answering their questions and fixing their code. 
Project context (truncated):
${projectContext.substring(0, 15000)}

Provide your response in JSON format exactly like this:
{
  "message": "Your text response to the user",
  "command": "npm install && npm start",
  "fixes": [
    { "path": "path/to/file", "content": "Full replacement content for the file to fix the issue (if applicable)" }
  ]
}

CRITICAL RULES FOR CODE CHANGES:
1. If you are suggesting a code change, you MUST include it in the "fixes" array.
2. The "content" field MUST contain the ENTIRE file from the very first line to the very last line.
3. DO NOT use placeholders like "// rest of the code here" or "// unchanged".
4. DO NOT truncate the file. The UI will replace the file entirely with your output, so partial code will break the user's project.
5. DOCKER CONFIGURATION: If the user's request requires new dependencies, specific system packages, or custom build/run commands, you MUST create or update the "Dockerfile" in the root directory. Include "EXPOSE <port>" if it is a web app so the port can be previewed.
6. COMMAND EXECUTION: If the user asks to run the project, start a server, run tests, or execute terminal commands, provide the exact shell command in the "command" field. It will be executed inside the Docker container.
7. JSON ESCAPING: When generating the "content" of a JSON file (like package.json), you MUST properly escape all internal double quotes with backslashes (e.g. \\") to ensure the outer JSON object remains valid.`
    }

    // 5. Construct the messages array for the AI
    // Map the database history format to the format expected by the AI service
    const aiMessages = [
      systemMessage,
      ...history.map(msg => ({
        role: msg.role,
        content: msg.content,
        attachments: msg.attachments || []
      }))
    ]

    // 6. Call AI
    const rawText = await generateChat(aiMessages, { provider, apiKey, model })
    
    let parsed
    try {
      // Use RegExp to avoid syntax highlighter issues with backticks in regex literals
      const jsonRegex = new RegExp("```json\\n?", "g")
      const backtickRegex = new RegExp("```\\n?", "g")
      const cleaned = (rawText || "").replace(jsonRegex, "").replace(backtickRegex, "").trim()
      parsed = JSON.parse(cleaned)
    } catch (e) {
      // Fallback if not valid JSON
      parsed = { message: rawText || "", fixes: [] }
    }

    // 7. Save the assistant's response to the database
    // We add the command to the fixes array as a special object so it can be saved in the existing schema
    const fixesToSave = Array.isArray(parsed.fixes) ? parsed.fixes : []
    if (parsed.command) {
      fixesToSave.push({ path: "_command", content: parsed.command })
    }

    await saveChatMessage(userId, threadId, owner, repo, 'assistant', parsed.message || "", fixesToSave)

    res.json(parsed)
  } catch (err) {
    console.error("Error in handleChatProject:", err)
    handleErr(res, err)
  }
}


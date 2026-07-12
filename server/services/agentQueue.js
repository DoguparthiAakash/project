import { getProviderAdapter } from "./gitProviderService.js"
import { getGitToken } from "./supabaseService.js"
import { generateReview, generateProjectWorkspace } from "./aiService.js"

const taskQueue = []
let isProcessing = false

export function enqueueTask(task) {
  task.id = Date.now().toString()
  task.status = "queued"
  taskQueue.push(task)
  
  if (!isProcessing) {
    processQueue()
  }
  
  return task.id
}

export function getTaskStatus(id) {
  return taskQueue.find(t => t.id === id) || null
}

export function getAllTasks() {
  return taskQueue
}

async function processQueue() {
  if (taskQueue.length === 0) {
    isProcessing = false
    return
  }
  
  isProcessing = true
  const task = taskQueue.find(t => t.status === "queued")
  
  if (!task) {
    isProcessing = false
    return
  }
  
  task.status = "processing"
  
  try {
    await runAgentTask(task)
    task.status = "completed"
  } catch (err) {
    console.error("Agent task failed:", err)
    task.status = "failed"
    task.error = err.message
  }
  
  // Process next
  processQueue()
}

async function runAgentTask(task) {
  const { type, provider, userId, payload } = task
  
  const token = await getGitToken(userId, provider)
  const adapter = getProviderAdapter(provider)
  
  if (type === "generate_readme") {
    const { owner, repo, branch } = payload
    // Fetch repo tree
    const tree = await adapter.getRepoTree(token, owner, repo, branch || "main")
    
    // Simplistic analysis (would typically pull files, but doing file tree for now)
    const files = tree.tree.map(t => t.path).join("\\n")
    
    const prompt = `You are an AI developer. Write a comprehensive README.md for a GitHub repository with these files:\n${files}\n\nReturn ONLY the markdown content for the README.`
    
    const aiResponse = await generateReview(prompt, {
      provider: payload.aiProvider,
      apiKey: payload.aiKey,
      model: payload.aiModel,
    })
    
    // Commit back
    await adapter.commitFile({
      token,
      owner,
      repo,
      path: "README.md",
      message: "Automated README generation by CodeSage AI",
      content: aiResponse,
      branch: branch || "main"
    })
    
  } else if (type === "analyze_code") {
    // Other workloads...
  } else if (type === "generate_new_project") {
    const { name, description, isPrivate, prompt, techStack, fallbackProviders } = payload
    
    task.statusMessage = "Generating code with AI..."
    
    const fullPrompt = `Project Name: ${name}
Description: ${description}
Tech Stack / Field: ${techStack}
Requirements: ${prompt}
Generate a full foundational project structure.`

    const files = await generateProjectWorkspace(fullPrompt, {
      fallbackProviders: fallbackProviders || [{ provider: payload.aiProvider, apiKey: payload.aiKey, model: payload.aiModel }],
      onProgress: (msg) => { task.statusMessage = msg }
    })

    task.statusMessage = "Creating remote repository..."
    // Create the repo
    const repo = await adapter.createRepo(token, { name, description, private: isPrivate })
    const owner = repo.owner.login

    task.statusMessage = "Pushing generated files..."
    // Push the files
    await adapter.commitMultipleFiles({
      token,
      owner,
      repo: repo.name,
      branch: repo.default_branch || "main",
      message: "Initial commit by CodeSage AI",
      changes: files
    })

    // Store the resulting repo info so frontend can route to it
    task.result = { owner, repo: repo.name }

  } else {
    throw new Error("Unknown task type")
  }
}

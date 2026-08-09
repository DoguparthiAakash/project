import { getProviderAdapter } from "./gitProviderService.js"
import { getGitToken } from "./supabaseService.js"
import { generateReview, generateProjectWorkspace } from "./aiService.js"
import { Queue, Worker } from "bullmq"
import Redis from "ioredis"

// Render provides REDIS_URL when a Redis instance is attached
// Fallback to local docker-compose redis for development
const redisUrl = process.env.REDIS_URL || "redis://localhost:6379"

const connection = new Redis(redisUrl, {
  maxRetriesPerRequest: null // Required by bullmq
})

export const agentQueue = new Queue('agentTasks', { connection })

export async function enqueueTask(task) {
  // Adding job to bullmq
  const job = await agentQueue.add(task.type, task)
  return job.id
}

export async function getTaskStatus(id) {
  const job = await agentQueue.getJob(id)
  if (!job) return null

  const isCompleted = await job.isCompleted()
  const isFailed = await job.isFailed()
  const isActive = await job.isActive()

  let status = "queued"
  if (isActive) status = "processing"
  if (isCompleted) status = "completed"
  if (isFailed) status = "failed"

  return {
    id: job.id,
    userId: job.data.userId,
    type: job.data.type,
    status,
    statusMessage: job.progress || "",
    result: job.returnvalue || null,
    error: job.failedReason || null,
    data: job.data
  }
}

export async function getAllTasks(userId) {
  // We can fetch recent jobs and filter by userId
  const jobs = await agentQueue.getJobs(['waiting', 'active', 'completed', 'failed'])
  
  const tasks = await Promise.all(jobs
    .filter(job => job.data.userId === userId)
    .map(async job => {
      const isCompleted = await job.isCompleted()
      const isFailed = await job.isFailed()
      const isActive = await job.isActive()
      let status = "queued"
      if (isActive) status = "processing"
      if (isCompleted) status = "completed"
      if (isFailed) status = "failed"
      return {
        id: job.id,
        userId: job.data.userId,
        type: job.data.type,
        status,
        statusMessage: job.progress || "",
        result: job.returnvalue || null,
        error: job.failedReason || null,
        data: job.data
      }
    }))
    
  return tasks
}

// Set up Worker
const worker = new Worker('agentTasks', async (job) => {
  const { type, provider, userId, payload } = job.data
  
  const token = await getGitToken(userId, provider)
  const adapter = getProviderAdapter(provider)
  
  if (type === "generate_readme") {
    const { owner, repo, branch } = payload
    const tree = await adapter.getRepoTree(token, owner, repo, branch || "main")
    const files = tree.tree.map(t => t.path).join("\\n")
    const prompt = `You are an AI developer. Write a comprehensive README.md for a GitHub repository with these files:\n${files}\n\nReturn ONLY the markdown content for the README.`
    
    await job.updateProgress("Generating README...")
    const aiResponse = await generateReview(prompt, {
      provider: payload.aiProvider,
      apiKey: payload.aiKey,
      model: payload.aiModel,
    })
    
    await job.updateProgress("Committing README...")
    await adapter.commitFile({
      token,
      owner,
      repo,
      path: "README.md",
      message: "Automated README generation by CodeSage AI",
      content: aiResponse,
      branch: branch || "main"
    })
    return { success: true }
    
  } else if (type === "analyze_code") {
    // Other workloads...
    return { success: true }
  } else if (type === "generate_new_project") {
    const { name, description, isPrivate, prompt, techStack, fallbackProviders } = payload
    
    await job.updateProgress("Generating code with AI...")
    
    const fullPrompt = `Project Name: ${name}
Description: ${description}
Tech Stack / Field: ${techStack}
Requirements: ${prompt}
Generate a full foundational project structure.`

    const files = await generateProjectWorkspace(fullPrompt, {
      fallbackProviders: (fallbackProviders && fallbackProviders.length > 0) ? fallbackProviders : [{ provider: payload.aiProvider, apiKey: payload.aiKey, model: payload.aiModel }],
      onProgress: async (msg) => { await job.updateProgress(msg) }
    })

    await job.updateProgress("Creating remote repository...")
    const repo = await adapter.createRepo(token, { name, description, private: isPrivate })
    const owner = repo.owner.login

    await job.updateProgress("Pushing generated files...")
    await adapter.commitMultipleFiles({
      token,
      owner,
      repo: repo.name,
      branch: repo.default_branch || "main",
      message: "Initial commit by CodeSage AI",
      changes: files
    })

    return { owner, repo: repo.name }
  } else {
    throw new Error("Unknown task type")
  }
}, { connection })

worker.on('failed', (job, err) => {
  console.error(`Agent task ${job.id} failed:`, err)
})

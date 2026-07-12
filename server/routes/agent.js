import { Router } from "express"
import { enqueueTask, getTaskStatus, getAllTasks } from "../services/agentQueue.js"

const router = Router()

function requireAuth(req, res, next) {
  if (!req.userId) return res.status(401).json({ message: "Not authenticated" })
  next()
}

router.post("/workload", requireAuth, (req, res) => {
  const { type, provider, payload } = req.body
  
  if (!type || !provider || !payload) {
    return res.status(400).json({ message: "Missing required fields: type, provider, payload" })
  }
  
  const taskId = enqueueTask({
    userId: req.userId,
    type,
    provider,
    payload
  })
  
  res.json({ ok: true, taskId, message: "Task enqueued successfully" })
})

router.get("/tasks/:id", requireAuth, (req, res) => {
  const task = getTaskStatus(req.params.id)
  if (!task) return res.status(404).json({ message: "Task not found" })
  
  // Basic security: only allow the user who created it to view it
  if (task.userId !== req.userId) {
    return res.status(403).json({ message: "Forbidden" })
  }
  
  res.json(task)
})

router.get("/tasks", requireAuth, (req, res) => {
  const tasks = getAllTasks().filter(t => t.userId === req.userId)
  res.json(tasks)
})

export default router

import express from "express"
import { 
  handleRunProject, 
  handleAnalyzeProject, 
  handlePushFixes, 
  handleExecProject, 
  handleChatProject, 
  handleGetThreads,
  handleCreateThread,
  handleGetThreadHistory,
  handleDeleteThread,
  handleClearChatHistory 
} from "../controllers/projectController.js"

const router = express.Router()

router.post("/:owner/:repo/run", handleRunProject)
router.post("/:owner/:repo/analyze", handleAnalyzeProject)
router.post("/:owner/:repo/fixes", handlePushFixes)
router.post("/:owner/:repo/exec", handleExecProject)

router.get("/chat/threads", handleGetThreads)
router.post("/:owner/:repo/chat/threads", handleCreateThread)
router.get("/:owner/:repo/chat/:threadId/history", handleGetThreadHistory)
router.post("/:owner/:repo/chat/:threadId", handleChatProject)
router.delete("/:owner/:repo/chat/:threadId", handleDeleteThread)
router.delete("/:owner/:repo/chat/clear", handleClearChatHistory)

export default router

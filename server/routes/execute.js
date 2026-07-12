import { Router } from "express"
import { executeCode } from "../controllers/executeController.js"

const router = Router()

router.post("/execute", executeCode)

export default router

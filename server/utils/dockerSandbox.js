import { exec } from "child_process"
import { mkdir, rm, writeFile, readdir, readFile } from "fs/promises"
import { join } from "path"
import { tmpdir } from "os"
import { promisify } from "util"
import { existsSync } from "fs"
import { generateDockerfileForProject } from "../services/aiService.js"

const execAsync = promisify(exec)

// Keep track of running containers for exec
const runningContainers = new Map()

/**
 * Automatically generate a Dockerfile based on the project's files if one doesn't exist.
 */
async function generateDockerfile(dirPath, { provider, apiKey, model } = {}) {
  const files = await readdir(dirPath)
  let dockerfile = ""

  if (provider || apiKey || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.GEMINI_API_KEY) {
    try {
      // Build a summary of files to send to the AI
      let summary = files.join("\n")
      if (files.includes("package.json")) {
        summary += "\n\n--- package.json ---\n" + await readFile(join(dirPath, "package.json"), "utf8").catch(()=>"")
      }
      if (files.includes("requirements.txt")) {
        summary += "\n\n--- requirements.txt ---\n" + await readFile(join(dirPath, "requirements.txt"), "utf8").catch(()=>"")
      }
      dockerfile = await generateDockerfileForProject(summary, { provider, apiKey, model })
      await writeFile(join(dirPath, "Dockerfile"), dockerfile.trim())
      return
    } catch (e) {
      console.warn("AI Dockerfile generation failed, falling back to defaults", e)
    }
  }

  if (files.includes("package.json")) {
    // Node.js project
    dockerfile = `
FROM node:20-bullseye
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# Default to npm start, or node index.js
CMD if [ -f "package.json" ] && grep -q '"start"' package.json; then npm start; else node index.js; fi
`
  } else if (files.includes("requirements.txt") || files.includes("main.py")) {
    // Python project
    dockerfile = `
FROM python:3.11-slim
WORKDIR /app
COPY . .
RUN if [ -f "requirements.txt" ]; then pip install -r requirements.txt; fi
CMD if [ -f "main.py" ]; then python main.py; else python app.py; fi
`
  } else if (files.includes("go.mod") || files.includes("main.go")) {
    // Go project
    dockerfile = `
FROM golang:1.21-bullseye
WORKDIR /app
COPY . .
RUN go build -o main .
CMD ["./main"]
`
  } else {
    // Fallback: just a basic ubuntu container that lists files
    dockerfile = `
FROM ubuntu:22.04
WORKDIR /app
COPY . .
CMD ["ls", "-la"]
`
  }

  await writeFile(join(dirPath, "Dockerfile"), dockerfile.trim())
}

/**
 * Clones a repository, builds a Docker image, runs it, and returns the output.
 */
export async function runRepoInDocker({ owner, repo, branch = "main", token, provider, apiKey, model, timeoutMs = 60000 }) {
  const id = Math.random().toString(36).slice(2)
  const dir = join(tmpdir(), `codesage_repo_${owner}_${repo}_${id}`)
  const imageName = `codesage-${owner}-${repo}-${id}`.toLowerCase()

  try {
    // 1. Create temp directory
    await mkdir(dir, { recursive: true })

    // 2. Clone the repository
    const cloneUrl = `https://x-access-token:${token}@github.com/${owner}/${repo}.git`
    try {
      await execAsync(`git clone --depth 1 -b ${branch} ${cloneUrl} .`, { cwd: dir })
    } catch (err) {
      throw new Error(`Failed to clone repository: ${err.message}`)
    }

    // 3. Ensure a Dockerfile exists
    if (!existsSync(join(dir, "Dockerfile"))) {
      await generateDockerfile(dir, { provider, apiKey, model })
    }

    // 4. Build the Docker image
    try {
      await execAsync(`docker build -t ${imageName} .`, { cwd: dir })
    } catch (err) {
      throw new Error(`Docker build failed: ${err.message}`)
    }

    // 5. Check if it's a web project by looking for EXPOSE in Dockerfile
    const dockerfileContent = await readFile(join(dir, "Dockerfile"), "utf8").catch(()=>"")
    const exposeMatch = dockerfileContent.match(/EXPOSE\s+(\d+)/i)

    let stdout = ""
    let stderr = ""
    let exitCode = 0
    let startTime = Date.now()

    if (exposeMatch) {
      const exposedPort = exposeMatch[1]
      const randomPort = Math.floor(Math.random() * 10000) + 10000 // 10000-19999
      try {
        await execAsync(`docker run -d --rm --name ${imageName} -p ${randomPort}:${exposedPort} ${imageName}`, { cwd: dir })
        await new Promise(resolve => setTimeout(resolve, 2500)) // Wait for server to boot
        return {
          previewUrl: `http://localhost:${randomPort}`,
          stdout: "Server running in background",
          stderr: "",
          exitCode: 0,
          time: Date.now() - startTime
        }
      } catch (err) {
        stdout = err.stdout || ""
        stderr = err.stderr || err.message
        exitCode = err.code || 1
      }
    } else {
      try {
        // We run the container and automatically remove it
        // Added network none for basic security, can be removed if apps need internet
        const { stdout: runOut, stderr: runErr } = await execAsync(
          `docker run --rm --network none ${imageName}`,
          { cwd: dir, timeout: timeoutMs }
        )
        stdout = runOut
        stderr = runErr
      } catch (err) {
        stdout = err.stdout || ""
        stderr = err.stderr || err.message
        exitCode = err.code || 1
      }
    }

    // Clean up the image (container is auto-removed by --rm)
    await execAsync(`docker rmi ${imageName} -f`).catch(() => {})

    return {
      stdout,
      stderr,
      exitCode,
      time: Date.now() - startTime
    }

  } finally {
    // Clean up the cloned directory
    await rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}

/**
 * Starts a persistent container to run commands against.
 */
export async function startPersistentContainer({ owner, repo, branch = "main", token }) {
  const id = `${owner}-${repo}`.toLowerCase()
  if (runningContainers.has(id)) {
    return runningContainers.get(id)
  }

  const dir = join(tmpdir(), `codesage_persistent_${id}`)
  const imageName = `codesage-pers-${id}`.toLowerCase()
  const containerName = `codesage-cont-${id}`.toLowerCase()

  // Clean up any previous state in case of server restart
  await execAsync(`docker rm -f ${containerName}`).catch(() => {})
  await rm(dir, { recursive: true, force: true }).catch(() => {})

  await mkdir(dir, { recursive: true })
  const cloneUrl = `https://x-access-token:${token}@github.com/${owner}/${repo}.git`
  
  await execAsync(`git clone --depth 1 -b ${branch} ${cloneUrl} .`, { cwd: dir })
  
  if (!existsSync(join(dir, "Dockerfile"))) {
    await generateDockerfile(dir)
  }

  await execAsync(`docker build -t ${imageName} .`, { cwd: dir })
  
  // Start container in background (detached), overriding CMD to sleep so it stays alive
  await execAsync(`docker run -d --name ${containerName} --network none ${imageName} sleep infinity`, { cwd: dir })
  
  runningContainers.set(id, { containerName, dir, imageName })
  return { containerName, dir }
}

/**
 * Executes a command in a persistent container.
 */
export async function execInPersistentContainer({ owner, repo, branch, token, command }) {
  const id = `${owner}-${repo}`.toLowerCase()
  
  // Ensure container is running
  let containerInfo = runningContainers.get(id)
  if (!containerInfo) {
    try {
      containerInfo = await startPersistentContainer({ owner, repo, branch, token })
    } catch (e) {
      throw new Error(`Failed to start environment: ${e.message}`)
    }
  }

  try {
    // Use docker exec. We use sh -c to allow complex commands.
    const escapedCmd = command.replace(/"/g, '\\"')
    const { stdout, stderr } = await execAsync(`docker exec ${containerInfo.containerName} sh -c "${escapedCmd}"`, { timeout: 30000 })
    return { stdout, stderr, exitCode: 0 }
  } catch (err) {
    return {
      stdout: err.stdout || "",
      stderr: err.stderr || err.message,
      exitCode: err.code || 1
    }
  }
}

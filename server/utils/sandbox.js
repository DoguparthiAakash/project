import { exec, spawn } from "child_process"
import { writeFile, unlink, mkdir, rm } from "fs/promises"
import { join } from "path"
import { tmpdir } from "os"
import { promisify } from "util"
import { existsSync } from "fs"

const execAsync = promisify(exec)

// Language configurations
const LANG_CONFIG = {
  python: {
    ext: "py",
    run: (file) => ["python3", ["-u", file]],
  },
  javascript: {
    ext: "js",
    run: (file) => ["node", [file]],
  },
  typescript: {
    ext: "ts",
    // Transpile ts → js via Node --input-type or try ts-node
    compileAndRun: async (file, stdin, timeout) => {
      // Try converting TS to JS manually via basic strip-types approach
      const { readFileSync } = await import("fs")
      const tsCode = readFileSync(file, "utf-8")
      // Strip TypeScript-specific syntax via regex for simple cases
      const jsCode = tsCode
        .replace(/:\s*\w[\w<>\[\], |&?]*(\s*=|\s*\)|\s*,|\s*\}|\s*;)/g, (m, p1) => p1)
        .replace(/interface\s+\w+\s*\{[^}]*\}/gs, "")
        .replace(/type\s+\w+\s*=\s*[^;]+;/g, "")
        .replace(/<\w[\w<>, ]*>/g, "")
        .replace(/as\s+\w[\w<>\[\], |&?]*/g, "")
      const jsFile = file.replace(/\.ts$/, ".js")
      await writeFile(jsFile, jsCode)
      const result = await spawnWithStdin("node", [jsFile], stdin, timeout)
      await unlink(jsFile).catch(() => {})
      return result
    },
  },
  go: {
    ext: "go",
    run: (file) => ["go", ["run", file]],
  },
  php: {
    ext: "php",
    run: (file) => ["php", [file]],
  },
  c: {
    ext: "c",
    compile: (src, out) => ["gcc", [src, "-o", out, "-lm"]],
    run: (out) => [out, []],
  },
  cpp: {
    ext: "cpp",
    compile: (src, out) => ["g++", [src, "-o", out, "-std=c++17", "-lm"]],
    run: (out) => [out, []],
  },
  java: {
    ext: "java",
    // Java files must be named after the public class
    compile: (src) => ["javac", [src]],
    run: (_out, dir) => ["java", ["-cp", dir, "Main"]],
  },
  rust: {
    ext: "rs",
    compile: (src, out) => ["rustc", [src, "-o", out]],
    run: (out) => [out, []],
  },
}

async function spawnWithStdin(cmd, args, stdin, timeoutMs) {
  return new Promise((resolve) => {
    const startTime = Date.now()
    const child = spawn(cmd, args, { stdio: ["pipe", "pipe", "pipe"] })

    let stdout = ""
    let stderr = ""
    let killed = false

    const timer = setTimeout(() => {
      killed = true
      child.kill("SIGKILL")
    }, timeoutMs)

    child.stdout.on("data", (d) => { stdout += d.toString() })
    child.stderr.on("data", (d) => { stderr += d.toString() })

    if (stdin) {
      child.stdin.write(stdin)
    }
    child.stdin.end()

    child.on("close", (code) => {
      clearTimeout(timer)
      const time = Date.now() - startTime
      if (killed) {
        resolve({ stdout, stderr: stderr + "\n[Process killed: timeout exceeded]", exitCode: -1, time })
      } else {
        resolve({ stdout, stderr, exitCode: code ?? 0, time })
      }
    })

    child.on("error", (err) => {
      clearTimeout(timer)
      resolve({ stdout, stderr: err.message, exitCode: -1, time: Date.now() - startTime })
    })
  })
}

async function checkCommand(cmd) {
  try {
    await execAsync(`which ${cmd}`)
    return true
  } catch {
    return false
  }
}

export async function executeSandbox(code, language, stdin = "", timeoutMs = 10000) {
  const config = LANG_CONFIG[language]
  if (!config) {
    return {
      stdout: "",
      stderr: `Language '${language}' is not supported for execution.`,
      exitCode: 1,
      time: 0,
    }
  }

  // Create isolated temp directory
  const id = Math.random().toString(36).slice(2)
  const dir = join(tmpdir(), `codesage_${id}`)
  await mkdir(dir, { recursive: true })

  // For Java, file must be named Main.java (expect public class Main)
  const filename = language === "java" ? "Main.java" : `code.${config.ext}`
  const srcFile = join(dir, filename)

  try {
    await writeFile(srcFile, code)

    // TypeScript special case
    if (language === "typescript") {
      const result = await config.compileAndRun(srcFile, stdin, timeoutMs)
      return result
    }

    // Compiled languages
    if (config.compile) {
      const outFile = join(dir, language === "java" ? "Main" : "program")
      const [compileCmd, compileArgs] = config.compile(srcFile, outFile, dir)

      // Check compiler availability
      const compilerAvailable = await checkCommand(compileCmd)
      if (!compilerAvailable) {
        return {
          stdout: "",
          stderr: `Compiler '${compileCmd}' not found on this system. Install it to run ${language} code.`,
          exitCode: 127,
          time: 0,
          compiled: false,
          compileError: `${compileCmd} not installed`,
        }
      }

      // Compile
      const compileResult = await spawnWithStdin(compileCmd, compileArgs, null, 30000)
      if (compileResult.exitCode !== 0) {
        return {
          stdout: "",
          stderr: compileResult.stderr || compileResult.stdout,
          exitCode: compileResult.exitCode,
          time: compileResult.time,
          compiled: false,
          compileError: compileResult.stderr,
        }
      }

      // Run compiled output
      const [runCmd, runArgs] = language === "java"
        ? config.run(outFile, dir)
        : config.run(outFile)

      const runResult = await spawnWithStdin(runCmd, runArgs, stdin, timeoutMs)
      return { ...runResult, compiled: true }
    }

    // Interpreted languages
    const [cmd, args] = config.run(srcFile)
    const available = await checkCommand(cmd)
    if (!available) {
      return {
        stdout: "",
        stderr: `Runtime '${cmd}' not found on this system. Install it to run ${language} code.`,
        exitCode: 127,
        time: 0,
      }
    }

    return await spawnWithStdin(cmd, args, stdin, timeoutMs)
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}

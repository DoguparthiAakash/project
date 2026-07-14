import { executeCommand } from './webcontainer';
import { loadSettings, getAgentSettings } from './settings';

// Simple heuristic error detection
export function detectErrorInLogs(logLine: string): boolean {
  const lowerLog = logLine.toLowerCase();
  return (
    lowerLog.includes('error') ||
    lowerLog.includes('failed') ||
    lowerLog.includes('missing script') ||
    lowerLog.includes('crash') ||
    lowerLog.includes('exception')
  );
}

export interface DevOpsFixProposal {
  reasoning: string;
  command: string;
  args: string[];
}

export async function analyzeError(owner: string, repoName: string, errorLogs: string): Promise<DevOpsFixProposal | null> {
  const prompt = `You are an expert DevOps AI agent managing a WebContainer environment.
The server crashed or threw an error while running.
Project: ${owner}/${repoName}

Error Logs:
\`\`\`
${errorLogs}
\`\`\`

Analyze the error and propose a terminal command to fix it (e.g., installing a missing dependency, or running a different start command like "pip install -r requirements.txt").

Respond ONLY with a JSON object in this format:
{
  "reasoning": "Brief explanation of what went wrong and how to fix it.",
  "command": "npm",
  "args": ["install", "missing-package"]
}`;

  try {
    const settings = loadSettings();
    const { provider, apiKey, model } = getAgentSettings(settings, 'coder');

    if (!apiKey) {
      console.warn("[DevOps Agent] No API key configured. Skipping analysis.");
      return null;
    }

    let apiUrl = "https://api.anthropic.com/v1/messages";
    let headers: any = {
      "Content-Type": "application/json",
    };
    let body: any = {};

    // For simplicity in this demo, we'll try to use Anthropic API format if it's anthropic,
    // otherwise fallback to a generic OpenAI-compatible or just return null if not supported.
    // In a real app, you would route this through the backend like projectChat does.
    if (provider === "anthropic") {
      headers["x-api-key"] = apiKey;
      headers["anthropic-version"] = "2023-06-01";
      headers["anthropic-dangerously-allow-browser"] = "true";
      body = {
        model: model || "claude-3-5-sonnet-20241022",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }]
      };
    } else if (provider === "openai" || provider === "groq") {
      apiUrl = provider === "openai" ? "https://api.openai.com/v1/chat/completions" : "https://api.groq.com/openai/v1/chat/completions";
      headers["Authorization"] = `Bearer ${apiKey}`;
      body = {
        model: model,
        messages: [{ role: "user", content: prompt }]
      };
    } else {
      console.warn(`[DevOps Agent] Direct browser API calls not supported for ${provider}`);
      return null;
    }

    const response = await fetch(apiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.error("Failed to analyze error:", await response.text());
      return null;
    }

    const data = await response.json();
    let content = "";
    if (provider === "anthropic") {
      content = data.content[0].text;
    } else {
      content = data.choices[0].message.content;
    }
    
    // Extract JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.command && parsed.args) {
        return parsed as DevOpsFixProposal;
      }
    }
    
    return null;
  } catch (err) {
    console.error("DevOps Agent analysis error:", err);
    return null;
  }
}

export async function executeFix(proposal: DevOpsFixProposal, onData?: (data: string) => void) {
  if (onData) onData(`\r\n\x1b[1;33m[DevOps Agent] Executing fix:\x1b[0m ${proposal.command} ${proposal.args.join(' ')}\r\n`);
  return await executeCommand(proposal.command, proposal.args, onData);
}

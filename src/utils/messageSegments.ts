/**
 * Split an assistant reply into reasoning / tool-call / body parts.
 *
 * When the bot enables AstrBot's「显示思考内容」(display_reasoning_text) the
 * reasoning is injected into the reply chain as:
 *   `🤔 思考: <reasoning>\n\n────\n<body>`
 * and when「输出工具调用信息」(show_tool_use_status) is on, tool status arrives
 * as separate lines such as `🔨 调用工具: <name>`.
 *
 * This helper is intentionally conservative: when no markers are present the
 * whole text is returned as `body`, so plain replies render exactly as before.
 */
export interface MessageSegments {
  /** Thinking / reasoning content, empty when none. */
  reasoning: string;
  /** Tool-call status lines, empty when none. */
  tools: string[];
  /** The actual reply text shown as the message body. */
  body: string;
}

const TOOL_LINE_RE = /^(?:🔨|🔧|⚙️)?\s*调用工具[:：]?\s*(.*)$/;
const REASONING_LINE_RE = /^(?:🤔\s*)?思考[:：]\s*([\s\S]*)$/;
const RULE_RE = /^[─—\-_=]{3,}\s*$/;

export function parseMessage(raw: string | undefined | null): MessageSegments {
  const text = raw ?? "";
  const tools: string[] = [];
  let reasoning = "";
  const bodyLines: string[] = [];

  const lines = text.split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (TOOL_LINE_RE.test(trimmed)) {
      const label = trimmed.replace(/^(?:🔨|🔧|⚙️)\s*/, "").trim();
      if (label) tools.push(label);
      i += 1;
      continue;
    }

    const thinkMatch = !reasoning ? trimmed.match(REASONING_LINE_RE) : null;
    if (thinkMatch) {
      reasoning = thinkMatch[1];
      i += 1;
      while (i < lines.length && !RULE_RE.test(lines[i].trim())) {
        reasoning += "\n" + lines[i];
        i += 1;
      }
      if (i < lines.length) i += 1; // consume the trailing rule
      continue;
    }

    if (RULE_RE.test(trimmed)) {
      i += 1;
      continue;
    }

    bodyLines.push(line);
    i += 1;
  }

  return {
    reasoning: reasoning.trim(),
    tools,
    body: bodyLines.join("\n").trim(),
  };
}

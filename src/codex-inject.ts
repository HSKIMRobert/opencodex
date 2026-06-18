import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { resolveEnvValue } from "./config";
import type { OcxConfig, OcxProviderConfig } from "./types";

const CODEX_CONFIG_PATH = join(homedir(), ".codex", "config.toml");

const OCX_SECTION_MARKER = "# Auto-injected by opencodex";

function buildProviderBlock(port: number, modelIds: string[]): string {
  const lines = [
    "",
    OCX_SECTION_MARKER,
    "[model_providers.opencodex]",
    'name = "OpenCodex Proxy"',
    `base_url = "http://localhost:${port}/v1"`,
    'wire_api = "responses"',
  ];
  if (modelIds.length > 0) {
    lines.push(`model_ids = [${modelIds.map(id => `"${id}"`).join(", ")}]`);
  }
  return lines.join("\n") + "\n";
}

export async function fetchModelIds(config: OcxConfig): Promise<string[]> {
  const results: string[] = [];
  const fetches = Object.entries(config.providers).map(async ([, prov]: [string, OcxProviderConfig]) => {
    const apiKey = resolveEnvValue(prov.apiKey);
    const headers: Record<string, string> = { ...(prov.headers ?? {}) };
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
    try {
      const res = await fetch(`${prov.baseUrl}/models`, { headers, signal: AbortSignal.timeout(5000) });
      if (!res.ok) return;
      const json = await res.json() as { data?: { id: string }[] };
      if (json.data && Array.isArray(json.data)) {
        for (const m of json.data) results.push(m.id);
      }
    } catch { /* skip unreachable */ }
  });
  await Promise.all(fetches);
  return [...new Set(results)].sort();
}

export async function injectCodexConfig(port: number, config?: OcxConfig): Promise<{ success: boolean; message: string }> {
  if (!existsSync(CODEX_CONFIG_PATH)) {
    return { success: false, message: `Codex config not found at ${CODEX_CONFIG_PATH}. Is Codex installed?` };
  }

  let modelIds: string[] = [];
  if (config) {
    modelIds = await fetchModelIds(config);
  }

  let content = readFileSync(CODEX_CONFIG_PATH, "utf-8");

  if (content.includes("[model_providers.opencodex]")) {
    content = removeOcxSection(content);
  }

  const block = buildProviderBlock(port, modelIds);
  content = content.trimEnd() + "\n" + block;

  if (!content.includes("model_provider")) {
    const lines = content.split("\n");
    const insertIdx = lines.findIndex(l => l.startsWith("["));
    if (insertIdx > 0) {
      lines.splice(insertIdx, 0, 'model_provider = "opencodex"', "");
    } else {
      lines.unshift('model_provider = "opencodex"');
    }
    content = lines.join("\n");
  }

  writeFileSync(CODEX_CONFIG_PATH, content, "utf-8");
  const msg = modelIds.length > 0
    ? `Injected opencodex provider with ${modelIds.length} models into Codex config.`
    : `Injected opencodex provider into Codex config (no models discovered).`;
  return { success: true, message: msg };
}

function removeOcxSection(content: string): string {
  const lines = content.split("\n");
  const filtered: string[] = [];
  let inOcxSection = false;
  for (const line of lines) {
    if (line.includes(OCX_SECTION_MARKER)) { inOcxSection = true; continue; }
    if (inOcxSection) {
      if (line.startsWith("[") && !line.includes("model_providers.opencodex")) {
        inOcxSection = false;
        filtered.push(line);
      }
      continue;
    }
    filtered.push(line);
  }
  return filtered.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

export function removeCodexConfig(): { success: boolean; message: string } {
  if (!existsSync(CODEX_CONFIG_PATH)) {
    return { success: false, message: "Codex config not found." };
  }

  let content = readFileSync(CODEX_CONFIG_PATH, "utf-8");

  if (!content.includes("[model_providers.opencodex]")) {
    return { success: true, message: "opencodex not found in Codex config." };
  }

  content = removeOcxSection(content);
  const lines = content.split("\n");
  const filtered = lines.filter(l => l.trim() !== 'model_provider = "opencodex"');
  content = filtered.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";

  writeFileSync(CODEX_CONFIG_PATH, content, "utf-8");
  return { success: true, message: "Removed opencodex from Codex config." };
}

export function getCodexConfigPath(): string {
  return CODEX_CONFIG_PATH;
}

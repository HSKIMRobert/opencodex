import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";

interface ModelRow { provider: string; id: string; namespaced: string; disabled: boolean }

export default function Models({ apiBase }: { apiBase: string }) {
  const [models, setModels] = useState<ModelRow[]>([]);
  const [disabled, setDisabled] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const data = (await fetch(`${apiBase}/api/models`).then(r => r.json())) as ModelRow[];
      setModels(data);
      setDisabled(new Set(data.filter(m => m.disabled).map(m => m.namespaced)));
    } catch {
      setStatus("Failed to load models — is the proxy running?");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [apiBase]);

  const groups = useMemo(() => {
    const g: Record<string, ModelRow[]> = {};
    for (const m of models) (g[m.provider] ??= []).push(m);
    return Object.entries(g).sort(([a], [b]) => a.localeCompare(b));
  }, [models]);

  const apply = async (next: Set<string>) => {
    setBusy(true);
    setStatus("");
    try {
      const r = await fetch(`${apiBase}/api/disabled-models`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ models: [...next] }),
      });
      if (r.ok) { setDisabled(next); setStatus("✅ Applied — takes effect on the next Codex turn."); }
      else setStatus("Save failed");
    } catch {
      setStatus("Network error — is the proxy running?");
    } finally {
      setBusy(false);
    }
  };

  const toggle = (ns: string) => {
    const next = new Set(disabled);
    if (next.has(ns)) next.delete(ns); else next.add(ns);
    apply(next);
  };
  const toggleProvider = (rows: ModelRow[], enable: boolean) => {
    const next = new Set(disabled);
    for (const m of rows) { if (enable) next.delete(m.namespaced); else next.add(m.namespaced); }
    apply(next);
  };
  const toggleCollapse = (p: string) => {
    setCollapsed(prev => { const n = new Set(prev); if (n.has(p)) n.delete(p); else n.add(p); return n; });
  };

  if (loading) return <div>Loading…</div>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ fontSize: 16, margin: 0 }}>Models</h3>
        <span style={{ fontSize: 12, color: "#888" }}>{models.length - disabled.size}/{models.length} active</span>
      </div>
      <p style={{ fontSize: 13, color: "#666", lineHeight: 1.5 }}>
        Toggle which routed models Codex sees, grouped by provider (click a header to collapse). Disabled
        models are hidden from the catalog + model picker. Changes apply on the <b>next Codex turn</b> —
        opencodex invalidates Codex's 5-min model cache so no restart is needed.
      </p>
      {status && <div style={{ fontSize: 13, color: status.includes("✅") ? "#16a34a" : "#ef4444", marginBottom: 10 }}>{status}</div>}

      {groups.map(([provider, rows]) => {
        const isCollapsed = collapsed.has(provider);
        const activeCount = rows.filter(m => !disabled.has(m.namespaced)).length;
        return (
          <div key={provider} style={{ border: "1px solid #eee", borderRadius: 8, marginBottom: 8, overflow: "hidden" }}>
            <div onClick={() => toggleCollapse(provider)}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: "#f9fafb", cursor: "pointer" }}>
              <span style={{ width: 14, color: "#888" }}>{isCollapsed ? "▸" : "▾"}</span>
              <span style={{ fontWeight: 600, fontSize: 14 }}>{provider}</span>
              <span style={{ fontSize: 12, color: "#888" }}>{activeCount}/{rows.length} active</span>
              <div style={{ flex: 1 }} />
              <button onClick={e => { e.stopPropagation(); toggleProvider(rows, true); }} disabled={busy} style={miniBtn}>All on</button>
              <button onClick={e => { e.stopPropagation(); toggleProvider(rows, false); }} disabled={busy} style={miniBtn}>All off</button>
            </div>
            {!isCollapsed && (
              <div style={{ padding: "6px 12px" }}>
                {rows.map(m => {
                  const off = disabled.has(m.namespaced);
                  return (
                    <div key={m.namespaced} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0" }}>
                      <Switch on={!off} onClick={() => toggle(m.namespaced)} disabled={busy} />
                      <code style={{ fontSize: 13, color: off ? "#aaa" : "#222", textDecoration: off ? "line-through" : "none" }}>{m.id}</code>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      {groups.length === 0 && <div style={{ fontSize: 13, color: "#999" }}>No routed models — log into a provider or add one first.</div>}
    </div>
  );
}

function Switch({ on, onClick, disabled }: { on: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} aria-label={on ? "active" : "inactive"}
      style={{
        width: 36, height: 20, borderRadius: 999, border: "none", cursor: disabled ? "default" : "pointer",
        background: on ? "#22c55e" : "#d1d5db", position: "relative", flexShrink: 0, opacity: disabled ? 0.6 : 1,
      }}>
      <span style={{ position: "absolute", top: 2, left: on ? 18 : 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.15s" }} />
    </button>
  );
}

const miniBtn: CSSProperties = { fontSize: 12, padding: "3px 8px", borderRadius: 5, border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer", color: "#555" };

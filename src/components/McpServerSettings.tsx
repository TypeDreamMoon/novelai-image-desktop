// Fork addition: settings panel + renderer bridge for the local MCP server.
import { useCallback, useEffect, useState } from "react";
import type { AppSettings, McpServerStatus } from "../types";
import { useAppStore } from "../store";
import { Button, IconText, NumberInput, SecretInput, Toggle } from "./ui";

/** Refresh history / balance when an MCP client generated images. Mount once. */
export function McpEventSupport() {
  useEffect(() => window.naiDesktop.onMcpEvent?.((event) => {
    if (event.kind !== "history") return;
    const state = useAppStore.getState();
    void state.refreshHistory(event.date).catch(() => undefined);
    void state.refreshAccount().catch(() => undefined);
    state.setToast(`MCP：已生成 ${event.count} 张图片`);
  }), []);
  return null;
}

async function copy(text: string) {
  await navigator.clipboard.writeText(text);
  useAppStore.getState().setToast("已复制到剪贴板");
}

export function McpServerSettings({ settings, update }: {
  settings: AppSettings;
  update: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => Promise<void>;
}) {
  const refreshSettings = useAppStore((state) => state.refreshSettings);
  const [status, setStatus] = useState<McpServerStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const reload = useCallback(async () => setStatus(await window.naiDesktop.mcpStatus()), []);
  useEffect(() => { void reload(); }, [reload, settings.mcpServerEnabled, settings.mcpServerPort]);

  const enabled = settings.mcpServerEnabled === true;
  const port = settings.mcpServerPort ?? 39280;
  const token = settings.mcpServerToken ?? "";
  const url = status?.url || `http://127.0.0.1:${port}/mcp`;
  const piCommand = `pi mcp add langbai --url ${url} --header "Authorization=Bearer ${token || "<token>"}"`;
  const jsonConfig = JSON.stringify({
    mcpServers: { langbai: { url, headers: { Authorization: `Bearer ${token || "<token>"}` }, timeout: 600 } },
  }, null, 2);

  const run = async (operation: () => Promise<unknown>) => {
    setBusy(true);
    try { await operation(); await refreshSettings(); await reload(); }
    catch (error) { useAppStore.getState().setToast(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  };

  return (
    <div className="settings-form">
      <div className="info-card">
        <strong>本地 MCP 服务</strong>
        <span>
          让外部智能体（pi、Claude Code、Codex 等）通过 MCP 控制本软件：文生图、图生图、局部重绘、超分、查看历史和图片。
          仅监听 127.0.0.1，需要 Bearer Token；生成结果照常保存到历史记录。
        </span>
      </div>
      <div className="toggle-list">
        <Toggle
          checked={enabled}
          onChange={(value) => void run(() => update("mcpServerEnabled", value))}
          label="启用 MCP 服务"
          description={status?.running ? `运行中：${status.url}` : status?.error ? `启动失败：${status.error}` : "未运行"}
        />
      </div>
      <NumberInput
        label="端口"
        value={port}
        min={1024}
        max={65535}
        disabled={busy}
        onChange={(value) => void run(() => update("mcpServerPort", Math.trunc(value)))}
      />
      <NumberInput
        label="单次调用 Anlas 上限（0 = 只允许免费操作）"
        value={settings.mcpMaxAnlasPerCall ?? 0}
        min={0}
        max={100000}
        onChange={(value) => void update("mcpMaxAnlasPerCall", Math.max(0, Math.trunc(value)))}
      />
      <p className="settings-hint">
        每次付费操作执行前都会先估价，超过上限直接拒绝，不会扣点。Opus 免费范围：≤1MP、≤28 步、单张、无精准参考。
        精准参考每张额外 5 Anlas。
      </p>
      <SecretInput label="访问令牌（Bearer Token）" value={token} readOnly placeholder="启用后自动生成" />
      <div className="row-actions">
        <Button disabled={!token} onClick={() => void copy(token)}><IconText icon="copy">复制令牌</IconText></Button>
        <Button disabled={busy || !enabled} onClick={() => void run(() => window.naiDesktop.mcpRegenerateToken())}>
          <IconText icon="refresh">重新生成令牌</IconText>
        </Button>
      </div>
      <label className="field">
        <span>pi 接入命令</span>
        <textarea readOnly rows={2} value={piCommand} />
      </label>
      <div className="row-actions">
        <Button disabled={!token} onClick={() => void copy(piCommand)}><IconText icon="copy">复制 pi 命令</IconText></Button>
        <Button disabled={!token} onClick={() => void copy(jsonConfig)}><IconText icon="copy">复制 mcp.json 配置</IconText></Button>
      </div>
      <p className="settings-hint">
        长时间生成会通过进度通知保持连接；如果客户端不支持，请把 MCP 请求超时调到 600 秒（mcp.json 里的 timeout）。
      </p>
    </div>
  );
}

# Vision Relay MCP 🖼️

> A tiny MCP server that lets text-only coding models analyze images via Anthropic/OpenAI-compatible vision relay APIs.
>
> 一个轻量级 MCP 服务器，让不支持图片的编程模型也能借助视觉中继 API 分析截图、对比界面、解读报错。

---

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js 20+](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](package.json)
[![MCP](https://img.shields.io/badge/MCP-Compatible-blue)]()

---

## English

### What It Does

Vision Relay MCP solves a common pain point:

```
Your main coding model (DeepSeek, etc.)     Vision-capable model (Claude / GPT)
         │                                              │
         │  "What's in screenshot.png?"                 │
         │         ─────────────►                        │
         │              vision-relay MCP                 │
         │         ◄─────────────                        │
         │     "The screenshot shows a                    │
         │      NullPointerException at line 42..."       │
```

You use a cheap or text-only model for coding. When you need image analysis, this MCP forwards the image to a vision-capable model through your relay API and returns the result transparently.

### Features

- 🔌 **Dual protocol support** — Anthropic-compatible (`/v1/messages`) and OpenAI-compatible (`/v1/chat/completions`)
- 🖼️ **Two practical tools** — `analyze_image` for single images, `compare_images` for side-by-side comparison
- 🔒 **API keys stay safe** — All credentials read from environment variables, never in source code
- 🪶 **Minimal footprint** — Single 267-line file, zero dependencies beyond MCP SDK, extremely auditable
- 🎯 **Smart invocation** — Claude Code can auto-invoke it when images are present; you can also explicitly say "use vision-relay" for manual control

### Requirements

- Node.js 20 or newer (Node.js 22+ recommended)
- Claude Code or another MCP-compatible client
- A relay API key for a vision-capable model

### Quick Start

```powershell
# 1. Clone and install
git clone https://github.com/zhoucoolboy/vision-relay-mcp.git
cd vision-relay-mcp
npm install
```

Then choose one of the two methods below to register the MCP server with Claude Code.

### Add to Claude Code

#### Method A: CLI (recommended)

Run this in the project directory:

```powershell
claude mcp add -s user vision-relay `
  -e VISION_PROVIDER=anthropic `
  -e VISION_BASE_URL=https://your-relay.example.com `
  -e VISION_MODEL=claude-sonnet-4-6 `
  -e VISION_API_KEY=your_api_key_here `
  -- node "%CD%\index.js"
```

#### Method B: Edit `.claude.json` directly

Open your user-level Claude Code config file:

```powershell
notepad "$env:USERPROFILE\.claude.json"
```

Add the `vision-relay` entry under `mcpServers`:

```json
{
  "mcpServers": {
    "vision-relay": {
      "command": "node",
      "args": ["D:\\software\\Desktop\\vision-relay-mcp\\index.js"],
      "env": {
        "VISION_PROVIDER": "anthropic",
        "VISION_BASE_URL": "https://your-relay.example.com",
        "VISION_MODEL": "claude-sonnet-4-6",
        "VISION_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

> Replace the `args` path with the actual path to `index.js` on your machine.

#### Verify

```powershell
claude mcp list
claude mcp get vision-relay
```

You should see `vision-relay` with `Connected` status.

> **Note:** After changing environment variables or `.claude.json`, restart Claude Code for the changes to take effect.

### Usage

Put an image in your project directory and just ask Claude Code about it — the MCP may be auto-invoked:

```
What's in screenshot.png?
What does this error say? (with error.png in the project folder)
```

You can also explicitly call it:

```
Please call vision-relay to analyze screenshot.png.
Please use vision-relay to compare before.png and after.png.


### Supported Vision Models

This project does **not** limit which model you can use. **Any vision-capable model** accessible through your relay API works — as long as it supports image input.

The model is entirely determined by what you set in `VISION_MODEL`. For example:

- **Anthropic format** — `claude-sonnet-4-6` / `claude-opus-4-6` / any other Claude model that accepts images
- **OpenAI format** — `gpt-4o` / `gpt-4o-mini` / `gemini-2.5-pro` / `glm-4v` / `glm-4.5v` / any other vision model your relay provides

Just set `VISION_MODEL` to whatever your relay supports — check your relay provider's model list for details.

### Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `VISION_PROVIDER` | Yes | `anthropic` or `openai` — selects the API format |
| `VISION_BASE_URL` | Yes | Your relay API base URL |
| `VISION_MODEL` | Yes | Model name for vision analysis |
| `VISION_API_KEY` | Yes | Your relay API key |
| `VISION_MAX_TOKENS` | No | Max tokens for the vision response (default: `2000`) |

How to set these values depends on which method you chose above:
- **Method A (CLI)** — values are stored via `claude mcp add -e`. Update them with `claude mcp remove` then `claude mcp add` again.
- **Method B (`.claude.json`)** — values are in the `env` block. Edit the JSON file directly.

> **For OpenAI-compatible relays:** set `VISION_PROVIDER=openai` and make sure `VISION_BASE_URL` ends with `/v1` or `/v1/chat/completions`.

### Switching Models

**Method A (CLI):** remove and re-add:

```powershell
claude mcp remove vision-relay -s user
claude mcp add -s user vision-relay `
  -e VISION_PROVIDER=anthropic `
  -e VISION_BASE_URL=https://your-relay.example.com `
  -e VISION_MODEL=claude-opus-4-6 `
  -e VISION_API_KEY=your_api_key_here `
  -- node "%CD%\index.js"
```

**Method B (`.claude.json`):** edit the `VISION_MODEL` value in the `env` block directly, then restart Claude Code.

### Troubleshooting

| Symptom | Likely Cause |
|---------|-------------|
| `Missing environment variable(s): VISION_API_KEY` | Environment variables not set. Restart Claude Code after setting them. |
| `Vision relay failed (403)` | Relay restricts the endpoint. Try switching `VISION_PROVIDER`, or check your relay docs. |
| `Could not process image` | Image too large (>20MB), corrupt, or unsupported format. Use PNG/JPEG under 20MB. |
| Text works but images fail | Model doesn't support vision. Confirm with your relay provider. |
| `Connected` but analysis fails | MCP connection ≠ API works. Double-check API key, base URL, and model name. |

### Security Notes

- ⚠️ **Never commit real API keys** to source control
- ⚠️ Images are sent to your configured relay API — treat screenshots as sensitive data
- ⚠️ Rotate any API key that has been shared in chat, logs, screenshots, or public repos
- ⚠️ Prefer environment variables or a secret manager for credentials

### Architecture

```
Claude Code (MCP Client)
        │ stdio
        ▼
  index.js (MCP Server)
        │ HTTP POST (Bearer Token)
        ▼
  Your Relay API
  /v1/messages or /v1/chat/completions
        │
        ▼
  Vision model returns analysis
```

### Uninstall

```powershell
claude mcp remove vision-relay -s user
```

To also remove environment variables:

```powershell
[Environment]::SetEnvironmentVariable("VISION_PROVIDER", $null, "User")
[Environment]::SetEnvironmentVariable("VISION_BASE_URL", $null, "User")
[Environment]::SetEnvironmentVariable("VISION_MODEL", $null, "User")
[Environment]::SetEnvironmentVariable("VISION_API_KEY", $null, "User")
```

### License

MIT — see [LICENSE](LICENSE).

---

## 简体中文

### 它能做什么

Vision Relay MCP 解决了一个普遍痛点：

```
你用 DeepSeek 之类的模型写代码      有视觉能力的模型（Claude / GPT）
         │                                      │
         │  "screenshot.png 里有什么？"           │
         │         ─────────────►                │
         │              vision-relay MCP         │
         │         ◄─────────────                │
         │     "截图显示第 42 行有                  │
         │      NullPointerException..."          │
```

主力编程模型不支持图片？这个 MCP 把图片转发给视觉模型分析，结果透明返回给 Claude Code。

### 特性

- 🔌 **双协议支持** — 兼容 Anthropic 格式 (`/v1/messages`) 和 OpenAI 格式 (`/v1/chat/completions`)
- 🖼️ **两个实用工具** — `analyze_image` 分析单张图片，`compare_images` 对比两张图片
- 🔒 **密钥不进代码** — 全部走环境变量，仓库里不存任何密钥
- 🪶 **极致简洁** — 单文件 267 行，仅依赖 MCP SDK，极端可审计
- 🎯 **智能调用** — Claude Code 遇到图片时可自动调用，你也可以手动说"调用 vision-relay"来精准控制

### 你需要准备什么

```text
1. Node.js（20 以上，推荐 22+）
2. Claude Code 或其他 MCP 客户端
3. 一个支持图片输入的中转站 API
4. 一个支持视觉的模型名
```

> ⚠️ 注意：普通文本模型不行。模型必须真的支持图片输入。

### 快速开始

```powershell
# 1. 克隆并安装
git clone https://github.com/zhoucoolboy/vision-relay-mcp.git
cd vision-relay-mcp
npm install
```

然后从下面两种注册方式中选一种。

### 注册到 Claude Code

#### 方式 A：CLI 命令（推荐）

在项目目录下执行：

```powershell
claude mcp add -s user vision-relay `
  -e VISION_PROVIDER=anthropic `
  -e VISION_BASE_URL=https://你的中转站地址 `
  -e VISION_MODEL=你的视觉模型名 `
  -e VISION_API_KEY=你的API密钥 `
  -- node "%CD%\index.js"
```

#### 方式 B：直接编辑 `.claude.json`

打开用户级配置文件：

```powershell
notepad "$env:USERPROFILE\.claude.json"
```

在 `mcpServers` 下添加 `vision-relay`：

```json
{
  "mcpServers": {
    "vision-relay": {
      "command": "node",
      "args": ["D:\\software\\Desktop\\vision-relay-mcp\\index.js"],
      "env": {
        "VISION_PROVIDER": "anthropic",
        "VISION_BASE_URL": "https://你的中转站地址",
        "VISION_MODEL": "你的视觉模型名",
        "VISION_API_KEY": "你的API密钥"
      }
    }
  }
}
```

> 把 `args` 里的路径换成你电脑上 `index.js` 的实际路径。

#### 验证

```powershell
claude mcp list
claude mcp get vision-relay
```

看到 `vision-relay ... Connected` 就说明成功了。

> **注意：** 修改环境变量或 `.claude.json` 之后，需要重启 Claude Code 才能生效。

### 使用方式

把图片放到项目目录里，直接用自然语言问 Claude Code 就行——MCP 可能会自动被调用：

```
screenshot.png 里有什么？
这个报错是什么意思？（项目里有 error.png）
```

你也可以显式调用：

```
请调用 vision-relay 分析 screenshot.png
请用 vision-relay 看一下 error.png，告诉我报错的原因
请调用 vision-relay 对比 before.png 和 after.png
```

### 支持的视觉模型

本项目**不限制**你用什么模型。只要是**支持图片输入的视觉模型**，且你的中转站能访问到，就可以用。

模型完全由你设置的 `VISION_MODEL` 决定。举个例子：

- **Anthropic 格式** — `claude-sonnet-4-6` / `claude-opus-4-6` / 任何支持图片的 Claude 模型
- **OpenAI 格式** — `gpt-4o` / `gpt-4o-mini` / `gemini-2.5-pro` / `glm-4v` / `glm-4.5v` / 你的中转站提供的任何其他视觉模型

把你中转站支持的视觉模型名填到 `VISION_MODEL` 就行，具体去你的中转站后台看支持列表。

### 环境变量参考

| 变量 | 必填 | 说明 |
|------|------|------|
| `VISION_PROVIDER` | 是 | `anthropic` 或 `openai`，选择 API 格式 |
| `VISION_BASE_URL` | 是 | 你的中转站地址 |
| `VISION_MODEL` | 是 | 视觉模型名称 |
| `VISION_API_KEY` | 是 | 中转站 API 密钥 |
| `VISION_MAX_TOKENS` | 否 | 视觉模型最大返回 token 数（默认 `2000`） |

这些值的设置方式取决于你上面选的是哪种注册方式：
- **方式 A（CLI）** — 参数通过 `claude mcp add -e` 存储。想修改就先 `claude mcp remove` 再重新 `claude mcp add`。
- **方式 B（`.claude.json`）** — 参数在 `env` 块里，直接编辑 JSON 文件即可。

> **OpenAI 格式中转站：** 把 `VISION_PROVIDER` 设为 `openai`，`VISION_BASE_URL` 通常以 `/v1` 或 `/v1/chat/completions` 结尾。

### 换模型

**方式 A（CLI）：** 先删除再重新添加：

```powershell
claude mcp remove vision-relay -s user
claude mcp add -s user vision-relay `
  -e VISION_PROVIDER=anthropic `
  -e VISION_BASE_URL=https://你的中转站地址 `
  -e VISION_MODEL=claude-opus-4-6 `
  -e VISION_API_KEY=你的API密钥 `
  -- node "%CD%\index.js"
```

**方式 B（`.claude.json`）：** 直接编辑 `env` 块里的 `VISION_MODEL` 值，保存后重启 Claude Code 即可。

### 换中转站

**方式 A（CLI）：** 删掉重新添加，换掉 `VISION_BASE_URL` 或 `VISION_API_KEY`。

**方式 B（`.claude.json`）：** 直接编辑 `env` 块里的对应字段，保存后重启 Claude Code。

### 常见问题

| 现象 | 可能原因 |
|------|----------|
| `Missing environment variable(s): VISION_API_KEY` | 环境变量没设。设完记得重启 Claude Code。 |
| `Vision relay failed (403)` | 中转站限制端点或客户端类型。试试切换 `VISION_PROVIDER`。 |
| `Could not process image` | 图片太大（>20MB）、损坏或格式不支持。用 PNG/JPEG 且小于 20MB。 |
| 文字能返回但图片分析失败 | 模型不支持视觉。跟中转站确认该模型是否支持图片输入。 |
| MCP 显示 Connected 但识图失败 | Connected 只代表 Claude Code 能启动 MCP。真正识图还需要 API key 正确、模型支持图片、账号有额度。 |

### 安全提醒

- ⚠️ **绝对不要**把 API key 写进 `index.js` / `README.md` / `.env.example` 或提交到 GitHub
- ⚠️ 图片会发送到你配置的中转站，注意截图中的敏感信息
- ⚠️ 密钥一旦泄露（聊天记录、截图、公开仓库），请立即轮换
- ⚠️ 推荐放在 Windows 环境变量中

### 架构

```
Claude Code（MCP 客户端）
        │ stdio
        ▼
  index.js（MCP 服务器）
        │ HTTP POST（Bearer Token）
        ▼
  你的中继 API
  /v1/messages 或 /v1/chat/completions
        │
        ▼
  视觉模型返回分析结果
```

### 一句话理解

```text
Claude Code 负责写代码
vision-relay 负责接收图片
视觉模型负责看图
中转站负责转发 API 请求
```

大多数情况下，直接把图片放项目里问 Claude Code 就行，它会自动调用 vision-relay。欢迎验证！

### 卸载

```powershell
claude mcp remove vision-relay -s user
```

如果要同时删除环境变量：

```powershell
[Environment]::SetEnvironmentVariable("VISION_PROVIDER", $null, "User")
[Environment]::SetEnvironmentVariable("VISION_BASE_URL", $null, "User")
[Environment]::SetEnvironmentVariable("VISION_MODEL", $null, "User")
[Environment]::SetEnvironmentVariable("VISION_API_KEY", $null, "User")
```

### 许可证

MIT — 详见 [LICENSE](LICENSE)。

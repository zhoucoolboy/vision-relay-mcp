# Vision Relay MCP

![Version](https://img.shields.io/badge/version-1.1.0-blue)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)
![License](https://img.shields.io/badge/license-MIT-green)

A local MCP server that gives Claude Code vision capabilities — it relays
local images to a vision-capable API and returns the text response.

> This document is bilingual — English first, Chinese follows.

---

## What It Does

Claude Code cannot view images on its own. Vision Relay MCP bridges local
image files and a vision model:

```
Local Image(s) → Vision Relay MCP → Vision API → Text Result → Claude Code
```

Claude Code calls one tool — `process_images` — and the server handles file
reading, base64 encoding, API communication, and response extraction.

## How It Works

1. Claude Code invokes `process_images` with image paths and a prompt.
2. The server concurrently reads and validates each image, encodes them as
   base64, and builds a provider-specific request body.
3. The vision model processes the images and returns a text response.
4. Claude Code receives the text and continues the conversation.

The server is a single file (index.js, ~240 lines). It does not store images,
cache results, or communicate with any service other than the one you
configure.

## Quick Start

```bash
# 1. Clone the project
git clone https://github.com/zhoucoolboy/vision-relay-mcp.git
cd vision-relay-mcp

# 2. Install the single dependency
npm install

# 3. Verify the code parses correctly
npm run check
```

Then add the server to your Claude Code MCP configuration (see [Claude Code
Setup](#claude-code-setup)), restart Claude Code, and verify with
`claude mcp list`. You should see `vision-relay ... Connected`.

---

## Version History

### v1.1.0 (current)

A **single-entry-point upgrade** — replaces `analyze_image` and
`compare_images` from v0.1.0 with one `process_images` tool. Behavior is
prompt-driven rather than hard-coded by tool name.

**Changes from v0.1.0:**
- Single tool instead of two
- Supports any number of images (v0.1.0: 1 or exactly 2)
- All images sent in one API request (v0.1.0: sequential)
- Concurrent file reading via `Promise.all()` (v0.1.0: sequential)
- Configurable per-image size limit (VISION_MAX_IMAGE_SIZE)
- OpenAI-compatible endpoint support (v0.1.0: Anthropic only)

### v0.1.0 (first version)

Two purpose-specific tools: `analyze_image` (single image) and
`compare_images` (exactly two images).

| Aspect | v0.1.0 | v1.1.0 |
| --- | --- | --- |
| Tools | 2 | 1 |
| Images per call | 1 or exactly 2 | 1+ |
| Request strategy | One per image | All in one |
| File reading | Sequential | Concurrent |
| Size limit | None | Configurable |
| API formats | Anthropic only | Anthropic + OpenAI |

---

## Requirements

- Node.js ≥ 18.0.0
- An MCP-compatible client (Claude Code or similar)
- A vision-capable API endpoint (Anthropic Messages or OpenAI Chat
  Completions format)
- An API key

> The model in VISION_MODEL must support image input.

## Install

Clone the repository and install its single dependency:

```bash
git clone https://github.com/zhoucoolboy/vision-relay-mcp.git
cd vision-relay-mcp
npm install
```

Verify the JavaScript parses without errors:

```bash
npm run check
```

This runs `node --check index.js` — it validates syntax without starting the
server or making any network calls. No output means success.

The only runtime dependency is
[`@modelcontextprotocol/sdk`](https://www.npmjs.com/package/@modelcontextprotocol/sdk),
which provides the MCP server framework. There is no build step.

---

## Configuration

All settings via environment variables. No config file.

| Name | Required | Default | Description |
| --- | --- | --- | --- |
| VISION_PROVIDER | No | `anthropic` | `anthropic` or `openai` |
| VISION_API_KEY | Yes | — | API key |
| VISION_BASE_URL | Yes | — | Base URL (auto-completes `/v1/messages` or `/v1/chat/completions`) |
| VISION_MODEL | Yes | — | Vision-capable model name |
| VISION_MAX_TOKENS | No | `2000` | Max response tokens |
| VISION_MAX_IMAGE_SIZE | No | `0` (off) | Per-image byte limit |

**URL auto-completion:**

| Provider | You set | Actual request URL |
| --- | --- | --- |
| anthropic | `https://api.example.com` | `https://api.example.com/v1/messages` |
| anthropic | `https://api.example.com/v1` | `https://api.example.com/v1/messages` |
| openai | `https://api.example.com` | `https://api.example.com/v1/chat/completions` |
| openai | `https://api.example.com/v1` | `https://api.example.com/v1/chat/completions` |

If the URL already ends with the full path, it's used as-is.

**API key fallback:** VISION_API_KEY → ANTHROPIC_API_KEY or OPENAI_API_KEY.

---

## Claude Code Setup

Add the server to your Claude Code MCP configuration. The config file location
depends on your OS and preference:

- **User-level** (applies to all projects, recommended for most users):
  macOS: `~/.claude/claude_desktop_config.json`
  Windows: `%USERPROFILE%\.claude\claude_desktop_config.json`
- **Project-level** (only the current project): `.claude/settings.json`

Open the file in any text editor and add a `vision-relay` entry under
`mcpServers`. Replace the placeholder values with your actual configuration.

**For Anthropic-compatible endpoints** (VISION_PROVIDER = anthropic):

```json
{
  "mcpServers": {
    "vision-relay": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/vision-relay-mcp/index.js"],
      "env": {
        "VISION_PROVIDER": "anthropic",
        "VISION_BASE_URL": "https://your-relay.example.com",
        "VISION_MODEL": "your-model",
        "VISION_API_KEY": "your_key"
      }
    }
  }
}
```

**For OpenAI-compatible endpoints** (VISION_PROVIDER = openai):

```json
{
  "mcpServers": {
    "vision-relay": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/vision-relay-mcp/index.js"],
      "env": {
        "VISION_PROVIDER": "openai",
        "VISION_BASE_URL": "https://your-endpoint.example.com",
        "VISION_MODEL": "your-model",
        "VISION_API_KEY": "your_key"
      }
    }
  }
}
```

**Important details:**

- The `args` path must be an **absolute path** to the `index.js` file from
  step 1. Relative paths will not work because the MCP server's working
  directory is unpredictable.
  - Windows example: `C:\\Users\\yourname\\vision-relay-mcp\\index.js`
  - macOS/Linux example: `/Users/yourname/vision-relay-mcp/index.js`
- If the config file doesn't exist yet, create it with the full JSON
  structure shown above.
- After saving, **restart Claude Code** — MCP servers are loaded only at
  startup.
- Verify the connection by running `claude mcp list`. You should see
  `vision-relay ... Connected`. If you see `Disconnected` or the server is
  missing, run `node /path/to/index.js` manually to see the error.

---

## Tool Reference

### `process_images`

**Input:**
```json
{
  "image_paths": ["/abs/path/to/image.png"],
  "prompt": "Extract all visible text."
}
```

| Field | Required | Type | Description |
| --- | --- | --- | --- |
| `image_paths` | Yes | `string[]` | Absolute paths. All encoded and sent in one request. |
| `prompt` | No | `string` | Task instruction. Omitted = comprehensive default. |

### Examples

**OCR:**
```json
{ "image_paths": ["/abs/path/screenshot.png"], "prompt": "Extract all visible text. Preserve reading order." }
```

**Comparison:**
```json
{ "image_paths": ["/abs/path/v1.png", "/abs/path/v2.png"], "prompt": "List every visual difference between these two designs." }
```

**Structured extraction:**
```json
{ "image_paths": ["/abs/path/form.jpg"], "prompt": "Extract visible fields as a JSON object." }
```

**Multi-image:**
```json
{ "image_paths": ["/abs/path/1.png", "/abs/path/2.png", "/abs/path/3.png"], "prompt": "These show sequential steps. Describe each step." }
```

---

## Supported Image Formats

| Extension | MIME Type |
| --- | --- |
| `.png` | `image/png` |
| `.jpg` / `.jpeg` | `image/jpeg` |
| `.webp` | `image/webp` |
| `.gif` | `image/gif` |
| `.bmp` | `image/bmp` |

---

## Upgrade From v0.1.0

1. **Download v1.1.0** to a new directory (keep the old one as a backup):
   ```bash
   git clone https://github.com/zhoucoolboy/vision-relay-mcp.git vision-relay-mcp-v1.1
   cd vision-relay-mcp-v1.1
   npm install
   ```

2. **Update your MCP config** — change `args` to point to the v1.1.0
   `index.js`. Keep your existing environment variables unchanged.

3. **Replace old tool invocations.** v1.1.0 has only `process_images`, and
   the parameter changed from `image_path` (singular string) to
   `image_paths` (plural array):

   | v0.1.0 call | v1.1.0 equivalent |
   | --- | --- |
   | `analyze_image` with `image_path: "/img.png"` | `process_images` with `image_paths: ["/img.png"]` |
   | `compare_images` with two paths | `process_images` with `image_paths: ["/a.png", "/b.png"]` and a comparison prompt |

   Note: comparisons now require an explicit prompt like "Compare these two
   images and list the differences."

4. **Restart Claude Code** and run `claude mcp list` to confirm
   `vision-relay ... Connected`.

5. Once confirmed working, you can delete the old v0.1.0 directory.

---

## Security

- Never commit real API keys. Use the MCP `env` block.
- The server only calls VISION_BASE_URL. No telemetry, no caching, no disk
  writes.
- Rotate immediately if a key appears in logs, screenshots, or git history.

---

## Troubleshooting

```bash
node --version          # ≥ 18?
node --check index.js   # Syntax OK?
node index.js           # Does it start without crashing?
```

| Symptom | Likely cause | Check |
| --- | --- | --- |
| Not in `claude mcp list` | Path/Node issue | Verify `args` path, `node --version` |
| `Disconnected` | Crashed on start | Run `node index.js` manually |
| "Missing env var(s)" | Config incomplete | Check all three required vars |
| API 401/403 | Auth failed | Verify key, check VISION_PROVIDER |
| API 404 | Wrong URL/model | Verify VISION_BASE_URL and model name |
| API 4xx/5xx | Format/endpoint error | Switch provider, test with curl |
| "Unsupported extension" | Bad format | Use png/jpg/jpeg/webp/gif/bmp |
| "Image larger than X" | Size limit | Raise VISION_MAX_IMAGE_SIZE or compress |
| File not found | Path error | Use absolute paths |

---

## Project Structure

```
vision-relay-mcp/
├── index.js          # Server (single file, ~240 lines)
├── package.json
├── README.md         # English + 中文
├── README.zh-CN.md   # Chinese tutorial
├── LICENSE           # MIT
├── .env.example
└── .gitignore
```

## License

MIT — see [LICENSE](./LICENSE).

---

## 中文说明

1.1.0 是 v0.1.0 的**单入口升级版**，将 analyze_image 和 compare_images
合并为一个 process_images 工具。行为由提示词驱动而非工具名决定。

### 项目简介

Claude Code 不能直接看图片。Vision Relay MCP 是本地图片和视觉模型之间的桥梁：

```
本地图片 → Vision Relay MCP → 视觉模型 API → 文本结果 → Claude Code
```

你只需配置好接口，Claude Code 调用 process_images 即可自动完成文件读取、
编码、API 调用和结果返回。

### 工作原理

1. Claude Code 调用 process_images，传入图片路径和任务描述。
2. 服务并发读取图片，校验后 base64 编码，构造对应格式的请求体。
3. 视觉模型处理图片，返回文本。
4. Claude Code 收到文本，继续对话。

服务是单文件实现（index.js，约 240 行），不存储图片、不缓存、不回传数据。

### 版本历史

**v1.1.0（当前）：** 单入口升级。相比 v0.1.0 的变化：
- 1 个工具取代 2 个
- 支持任意张图片（v0.1.0：1 张或恰好 2 张）
- 多图合并为一次请求（v0.1.0：顺序分开发送）
- 并发读取文件（v0.1.0：顺序读取）
- 可配置图片大小限制
- 支持 OpenAI 兼容接口（v0.1.0：仅 Anthropic）

**v0.1.0（第一版）：** 两个独立工具 — analyze_image（单图）和
compare_images（双图对比）。

| 方面 | v0.1.0 | v1.1.0 |
| --- | --- | --- |
| 工具数 | 2 | 1 |
| 图片数 | 1 或恰好 2 | 1 张起 |
| 请求策略 | 分开发送 | 合并一次 |
| 文件读取 | 顺序 | 并发 |
| 大小限制 | 无 | 可配置 |
| 接口支持 | 仅 Anthropic | Anthropic + OpenAI |

### 快速开始

```bash
git clone https://github.com/zhoucoolboy/vision-relay-mcp.git
cd vision-relay-mcp
npm install
npm run check
```

然后配置 Claude Code MCP，重启，执行 claude mcp list 验证。

### 运行要求

- Node.js ≥ 18.0.0
- Claude Code 或其他 MCP 客户端
- 支持视觉能力的 API 接口 + API key
- VISION_MODEL 必须支持图片输入

### 配置项

所有配置通过环境变量传入。

| 名称 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- |
| VISION_PROVIDER | 否 | anthropic | anthropic 或 openai |
| VISION_API_KEY | 是 | — | API key |
| VISION_BASE_URL | 是 | — | 接口地址（自动补全路径） |
| VISION_MODEL | 是 | — | 视觉模型名 |
| VISION_MAX_TOKENS | 否 | 2000 | 最大返回 token |
| VISION_MAX_IMAGE_SIZE | 否 | 0 | 单图大小上限（字节），0=不限制 |

**URL 自动补全：**

| Provider | 设置为 | 实际请求 |
| --- | --- | --- |
| anthropic | `https://api.example.com` | `https://api.example.com/v1/messages` |
| openai | `https://api.example.com` | `https://api.example.com/v1/chat/completions` |

若已设置完整路径则直接使用。

**API key 回退：** VISION_API_KEY → ANTHROPIC_API_KEY / OPENAI_API_KEY。

### Claude Code 配置

- 用户级配置：~/.claude/claude_desktop_config.json
- 项目级配置：.claude/settings.json

```json
{
  "mcpServers": {
    "vision-relay": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/vision-relay-mcp/index.js"],
      "env": {
        "VISION_PROVIDER": "anthropic",
        "VISION_BASE_URL": "https://your-relay.example.com",
        "VISION_MODEL": "your-model",
        "VISION_API_KEY": "your_key"
      }
    }
  }
}
```

路径必须用绝对路径。Windows：C:\Users\...，macOS/Linux：/Users/...。
配置后重启 Claude Code，执行 claude mcp list 验证。

### 工具说明

**process_images** — 通用视觉工具。输入：

```json
{ "image_paths": ["/abs/path/img.png"], "prompt": "提取可见文字。" }
```

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| image_paths | 是 | 绝对路径数组，一次请求发送 |
| prompt | 否 | 任务描述，不传时使用默认提示词 |

**示例：**

OCR：`{"image_paths": ["/abs/screenshot.png"], "prompt": "提取所有可见文字，保持阅读顺序。"}`

对比：`{"image_paths": ["/abs/v1.png", "/abs/v2.png"], "prompt": "列出两张设计的所有视觉差异。"}`

提取：`{"image_paths": ["/abs/form.jpg"], "prompt": "将可见字段提取为 JSON。"}`

多图：`{"image_paths": ["/abs/1.png","/abs/2.png","/abs/3.png"], "prompt": "这是顺序步骤，描述每一步。"}`

### 支持的格式

png、jpg/jpeg、webp、gif、bmp

### 从 v0.1.0 升级

1. 下载 v1.1.0，执行 npm install
2. 更新 MCP 路径指向 v1.1.0 的 index.js
3. 替换调用方式：

| v0.1.0 | v1.1.0 |
| --- | --- |
| analyze_image + image_path | process_images + image_paths: ["..."] |
| compare_images + 两张路径 | process_images + 两张路径 + 对比提示词 |

4. 重启 Claude Code，验证连接。

### 安全说明

- 不要把 API key 写进代码或 README
- 服务器仅访问你配置的接口，不收集数据
- key 泄露后应立即轮换

### 常见问题

| 现象 | 原因 | 排查 |
| --- | --- | --- |
| 服务不显示 | 路径/Node 问题 | 确认 node ≥ 18，路径正确 |
| Disconnected | 启动崩溃 | 手动执行 node index.js |
| 缺少环境变量 | 配置不全 | 检查三个必填项 |
| API 401/403 | 认证失败 | 检查 key 和 provider |
| API 404 | URL/模型错误 | 检查地址和模型名 |
| 格式不支持 | 扩展名不对 | 用 png/jpg/jpeg/webp/gif/bmp |
| 文件太大 | 超限制 | 提高上限或压缩 |
| 找不到文件 | 路径错误 | 使用绝对路径 |

### 项目结构

```
vision-relay-mcp/
├── index.js          # 服务入口（单文件，约 240 行）
├── package.json
├── README.md         # 英文 + 中文
├── README.zh-CN.md   # 小白教程
├── LICENSE           # MIT
├── .env.example
└── .gitignore
```

### 许可证

MIT — 详见 [LICENSE](./LICENSE)。

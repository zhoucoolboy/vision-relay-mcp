# Vision Relay MCP

![Version](https://img.shields.io/badge/version-1.1.0-blue)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)
![License](https://img.shields.io/badge/license-MIT-green)

A lightweight local MCP server that gives Claude Code (or any MCP-compatible
client) the ability to "see" images — by relaying them to a vision-capable API
and returning the result.

> This document is bilingual — English first, Chinese follows.

---

## What It Does

Claude Code is text-only by default. When your workflow needs to read a
screenshot, compare two mockups, extract fields from a form scan, or ask a
question about a photo, you need a bridge between local images and a vision
model.

Vision Relay MCP is that bridge:

```
Local Image(s) → Vision Relay MCP → Vision API → Text Result → Claude Code
```

You configure which API to use (Anthropic-compatible or OpenAI-compatible).
Claude Code calls one tool — `process_images` — and the server handles the
rest: reading the file, encoding it, calling the vision API, and streaming the
result back.

## How It Works

1. **Claude Code** invokes the `process_images` MCP tool with one or more
   local image paths and an optional task description.
2. **Vision Relay MCP** reads each image file concurrently, validates the
   format and size, and encodes them as base64.
3. The server constructs a provider-specific request body (Anthropic Messages
   or OpenAI Chat Completions) and sends it to the configured endpoint.
4. The **vision model** processes the image(s) according to the prompt and
   returns a text response.
5. **Claude Code** receives the text and continues your conversation.

The server is intentionally single-file and zero-config beyond environment
variables. It does not store images, cache results, or communicate with any
service other than the one endpoint you configure.

## Quick Start

```bash
# 1. Clone the project
git clone https://github.com/your-org/vision-relay-mcp.git
cd vision-relay-mcp

# 2. Install the single dependency
npm install

# 3. Verify syntax
npm run check
```

Then add the server to your Claude Code MCP configuration (see
[Claude Code Setup](#claude-code-setup) below), restart Claude Code, and
start using it.

## Version History

### v1.1.0 (current)

v1.1.0 is a **single-entry-point upgrade** that replaces multiple
task-specific tools with one general-purpose entry.

**Design rationale:** The first version exposed `analyze_image` and
`compare_images` as separate tools. In practice, the distinction between
"analyze one image" and "compare two images" is artificial — both are just
"_send N images with a prompt_." The vision model itself is perfectly capable
of deciding how to handle the task based on the prompt. v1.1.0 embraces this
by providing exactly one tool whose behavior is driven by the prompt, not by
the tool name.

### v1.0.0 (first version)

The original version had two tools:

| Tool | Purpose |
| --- | --- |
| `analyze_image` | Send a single image for analysis, OCR, or description |
| `compare_images` | Send exactly two images for side-by-side comparison |

**What changed:**

| Aspect | v1.0.0 | v1.1.0 |
| --- | --- | --- |
| Tool count | 2 (`analyze_image`, `compare_images`) | 1 (`process_images`) |
| Image count | 1 or exactly 2 | 1 or more (no upper limit) |
| Request strategy | One image per request | All images in one request |
| File reading | Sequential | Concurrent (`Promise.all`) |
| Size limit | None | `VISION_MAX_IMAGE_SIZE` |
| Task routing | Fixed by tool name | Prompt-driven (model decides) |

## Requirements

- **Node.js** `18.0.0` or newer (uses `fetch`, `fs/promises`, ES modules)
- **An MCP-compatible client** — Claude Code, or any client that speaks the
  Model Context Protocol over stdio
- **A vision-capable API endpoint** — any service that accepts Anthropic
  Messages API or OpenAI Chat Completions API format with image support
- **An API key** for that endpoint

> The model set in `VISION_MODEL` **must** support image input. A text-only
> model will connect successfully but fail when an image is sent.

## Install

```bash
# Clone from GitHub
git clone https://github.com/your-org/vision-relay-mcp.git
cd vision-relay-mcp

# Install dependencies
npm install

# Verify the code parses correctly (does not start the server)
npm run check
```

The project has exactly one runtime dependency:
[`@modelcontextprotocol/sdk`](https://www.npmjs.com/package/@modelcontextprotocol/sdk).

## Configuration

All configuration is read from environment variables. There is no config file.

| Name | Required | Description |
| --- | --- | --- |
| `VISION_PROVIDER` | No | Provider format: `anthropic` or `openai`. Defaults to `anthropic`. |
| `VISION_API_KEY` | Yes | API key for the configured vision endpoint. |
| `VISION_BASE_URL` | Yes | Base URL for the configured endpoint. |
| `VISION_MODEL` | Yes | Vision-capable model name. |
| `VISION_MAX_TOKENS` | No | Max output tokens. Defaults to `2000`. |
| `VISION_MAX_IMAGE_SIZE` | No | Per-image byte limit. Set to `0` to disable. |

### URL format

The server auto-completes the endpoint path based on your provider setting:

| Provider | You set `VISION_BASE_URL` to | Resulting request URL |
| --- | --- | --- |
| `anthropic` | `https://api.example.com` | `https://api.example.com/v1/messages` |
| `anthropic` | `https://api.example.com/v1` | `https://api.example.com/v1/messages` |
| `openai` | `https://api.example.com` | `https://api.example.com/v1/chat/completions` |
| `openai` | `https://api.example.com/v1` | `https://api.example.com/v1/chat/completions` |

If you specify the full path (e.g., ending in `/v1/messages`), the server uses
it as-is without modification.

### Fallback API keys

If `VISION_API_KEY` is not set, the server falls back to:

1. `ANTHROPIC_API_KEY` (when `VISION_PROVIDER` is `anthropic`)
2. `OPENAI_API_KEY` (when `VISION_PROVIDER` is `openai`)

`VISION_API_KEY` always takes priority when set.

## Claude Code Setup

Add the server to your MCP configuration. The configuration location depends
on your setup:

- **User-level** (applies to all projects): `~/.claude/claude_desktop_config.json`
  or `claude mcp add-json`
- **Project-level**: `.claude/settings.json` in your project root

### Anthropic-compatible endpoint example

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
        "VISION_MODEL": "your-vision-model",
        "VISION_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

### OpenAI-compatible endpoint example

```json
{
  "mcpServers": {
    "vision-relay": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/vision-relay-mcp/index.js"],
      "env": {
        "VISION_PROVIDER": "openai",
        "VISION_BASE_URL": "https://your-openai-compatible-endpoint.example.com",
        "VISION_MODEL": "your-vision-model",
        "VISION_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

### Platform-specific paths

**Windows:**
```json
"args": ["C:\\Users\\you\\vision-relay-mcp\\index.js"]
```

**macOS / Linux:**
```json
"args": ["/Users/you/vision-relay-mcp/index.js"]
```

### Verify the connection

Restart Claude Code after making changes, then run:

```bash
claude mcp list
```

Look for `vision-relay ... Connected`. If you see `Disconnected` or the server
is missing, check the [Troubleshooting](#troubleshooting) section.

## Tool Reference

### `process_images`

**Description:** General-purpose vision tool for one or more local images. Use
it for OCR, extracting structured information, describing content, answering
questions, locating elements, summarizing screenshots, or reasoning across
multiple images in a single API call.

**Input schema:**

```json
{
  "image_paths": [
    "/absolute/path/to/image-1.png",
    "/absolute/path/to/image-2.jpg"
  ],
  "prompt": "Compare these images and extract any visible text."
}
```

**Fields:**

| Field | Required | Description |
| --- | --- | --- |
| `image_paths` | Yes | Array of absolute paths to local image files. All images are sent in one request. |
| `prompt` | No | Task instruction for the image set. If omitted, a comprehensive default prompt is used. |

### Reproducible Examples

**OCR — Extract text from a screenshot:**

```json
{
  "image_paths": ["/abs/path/to/screenshot.png"],
  "prompt": "Extract all visible text and preserve the reading order."
}
```

**Comparison — Find differences between two designs:**

```json
{
  "image_paths": [
    "/abs/path/to/design-v1.png",
    "/abs/path/to/design-v2.png"
  ],
  "prompt": "Compare these two UI designs and list every visual difference."
}
```

**Structured extraction — Parse a form into JSON:**

```json
{
  "image_paths": ["/abs/path/to/form.jpg"],
  "prompt": "Extract the visible fields as a JSON object. Use the field labels as keys."
}
```

**Multi-image reasoning — Analyze a sequence:**

```json
{
  "image_paths": [
    "/abs/path/to/step-1.png",
    "/abs/path/to/step-2.png",
    "/abs/path/to/step-3.png"
  ],
  "prompt": "These three screenshots show steps in a workflow. Describe what is happening at each step and how they connect."
}
```

**Default behavior — No prompt:**

```json
{
  "image_paths": ["/abs/path/to/image.png"]
}
```

When `prompt` is omitted, the tool sends a default instruction that asks the
model to analyze each image comprehensively: describe content, extract text,
identify objects / colors / layout, and note cross-image relationships.

## Supported Image Formats

| Extension | MIME Type |
| --- | --- |
| `.png` | `image/png` |
| `.jpg` / `.jpeg` | `image/jpeg` |
| `.webp` | `image/webp` |
| `.gif` | `image/gif` |
| `.bmp` | `image/bmp` |

## Upgrade From v1.0.0

1. Download or clone v1.1.0 to a new directory (or replace the old one).
2. Run `npm install` in the new directory.
3. Update your MCP configuration — point `args` to the v1.1.0 `index.js`.
4. Keep your existing environment variables, or update them if your endpoint
   or model has changed.
5. Replace old tool invocations:

| v1.0.0 call | v1.1.0 equivalent |
| --- | --- |
| `analyze_image` with `image_path: "..."` | `process_images` with `image_paths: ["..."]` |
| `compare_images` with two paths | `process_images` with `image_paths: ["...", "..."]` and a comparison prompt |

6. Restart Claude Code.
7. Run `claude mcp list` and confirm `vision-relay` shows `Connected`.

## Security

- **Never commit real API keys.** The `.env.example` file is a template, not a
  configuration file.
- **Do not hardcode secrets** in `index.js`, README, or any committed file.
- **Use environment variables** or a secrets manager. The MCP `env` block in
  your Claude Code config is the recommended place.
- **Rotate immediately** if a key appears in chat logs, screenshots, git
  history, or a public repository.
- The server makes outbound HTTPS requests only to the `VISION_BASE_URL` you
  configure. It does not phone home, collect telemetry, or communicate with
  any third party.

## Troubleshooting

| Symptom | Likely cause | What to check |
| --- | --- | --- |
| Server does not appear in `claude mcp list` | Path or Node.js issue | Confirm `node --version` ≥ 18; verify `args` points to the actual `index.js` file |
| `Disconnected` status | Server crashed on startup | Run `node index.js` manually in the project directory and read the error |
| "Missing environment variable(s)" | Config not set | Check that `VISION_API_KEY`, `VISION_BASE_URL`, and `VISION_MODEL` are all set in the `env` block |
| API request fails with 4xx | Auth or format issue | Verify the API key is valid; confirm `VISION_PROVIDER` matches the endpoint format |
| API request fails with 5xx | Server-side issue | Check if the endpoint is reachable; try `curl` with the same URL and key |
| "Unsupported image extension" | File format | Use png, jpg, jpeg, webp, gif, or bmp |
| "Image is larger than X MB" | Size limit | Increase `VISION_MAX_IMAGE_SIZE` or compress the image before sending |
| Image not found | Wrong path | Use absolute paths; relative paths depend on the MCP server's working directory |

## Project Structure

```
vision-relay-mcp/
├── index.js          # Server entry point (single file, ~240 lines)
├── package.json      # Project metadata and dependencies
├── README.md         # This file (English + 中文)
├── README.zh-CN.md   # Beginner-friendly Chinese tutorial
├── LICENSE           # MIT
├── .env.example      # Environment variable template (do not put real keys here)
└── .gitignore        # Excludes node_modules, .env, logs
```

## License

MIT — see [LICENSE](./LICENSE).

---

## 中文说明

`1.1.0` 是第一版 Vision Relay MCP 的**单入口升级版**，将原来的多个任务工具合并为一个通用入口。

### 项目简介

Claude Code 本身不能直接"看"图片。当你需要让它读取截图、对比设计稿、从扫描件提取字段，或根据照片回答问题，就需要一个桥梁，把本地图片交给视觉模型处理。

Vision Relay MCP 就是这个桥梁：

```
本地图片 → Vision Relay MCP → 视觉模型 API → 文本结果 → Claude Code
```

你只需配置好视觉接口，Claude Code 调用 `process_images` 一个工具即可，剩下的（读取文件、编码、调用 API、返回结果）由服务自动完成。

### 工作原理

1. **Claude Code** 调用 `process_images` 工具，传入本地图片路径和任务描述。
2. **Vision Relay MCP** 并发读取每张图片，校验格式和大小，编码为 base64。
3. 根据 `VISION_PROVIDER` 构造对应格式的请求体，发往你配置的接口。
4. **视觉模型** 根据提示词处理图片，返回文本结果。
5. **Claude Code** 收到文本，继续完成你的任务。

服务端是单文件实现（`index.js`，约 240 行），除了环境变量无需任何配置文件。它不存储图片、不缓存结果、不向除你配置的接口之外的任何服务发送数据。

### 版本说明

#### v1.1.0（当前版本）

**设计理念：** 第一版按"单图分析"和"双图对比"拆分为两个工具。实际上，"分析一张图"和"对比两张图"本质相同——都是"发送 N 张图片 + 提示词"。视觉模型完全有能力根据提示词自行判断任务类型。v1.1.0 顺应这一点，只提供一个入口，行为由提示词驱动而非工具名称。

#### v1.0.0（第一版）

第一版有两个工具：`analyze_image`（单图分析）和 `compare_images`（双图对比）。

**版本对比：**

| 方面 | v1.0.0 | v1.1.0 |
| --- | --- | --- |
| 工具数量 | 2 个 | 1 个 |
| 支持图片数 | 1 张或恰好 2 张 | 1 张起，无上限 |
| 请求策略 | 一张图一次请求 | 多图合并在一次请求中 |
| 文件读取 | 顺序读取 | 并发读取 |
| 图片大小限制 | 无 | 可配置 `VISION_MAX_IMAGE_SIZE` |
| 任务路由 | 由工具名决定 | 由提示词决定（模型自行判断） |

### 运行要求

- **Node.js** `18.0.0` 或更高版本
- **Claude Code** 或其他支持 MCP 的客户端
- 一个**支持视觉能力的 API 接口**（Anthropic Messages 或 OpenAI Chat Completions 格式）
- 对应接口的 **API key**

> `VISION_MODEL` 设置的模型**必须**支持图片输入。纯文本模型虽然能连上接口，但传图时会失败。

### 安装

```bash
# 克隆项目
git clone https://github.com/your-org/vision-relay-mcp.git
cd vision-relay-mcp

# 安装依赖（仅一个）
npm install

# 验证语法（不会启动服务）
npm run check
```

### 配置项

所有配置通过环境变量传入，无需配置文件。

| 名称 | 必填 | 说明 |
| --- | --- | --- |
| `VISION_PROVIDER` | 否 | 接口格式：`anthropic` 或 `openai`，默认 `anthropic` |
| `VISION_API_KEY` | 是 | 视觉接口或中转服务的 API key |
| `VISION_BASE_URL` | 是 | 视觉接口或中转服务的 base URL |
| `VISION_MODEL` | 是 | 支持视觉能力的模型名称 |
| `VISION_MAX_TOKENS` | 否 | 最大输出 token 数，默认 `2000` |
| `VISION_MAX_IMAGE_SIZE` | 否 | 单张图片的大小上限（字节），设为 `0` 则不限制 |

**URL 自动补全：**

| Provider | 设置 `VISION_BASE_URL` 为 | 实际请求地址 |
| --- | --- | --- |
| `anthropic` | `https://api.example.com` | `https://api.example.com/v1/messages` |
| `openai` | `https://api.example.com` | `https://api.example.com/v1/chat/completions` |

如果设置了完整路径（如末尾已包含 `/v1/messages`），服务会直接使用，不再追加。

**API key 回退顺序：** `VISION_API_KEY` → `ANTHROPIC_API_KEY` / `OPENAI_API_KEY`。

### Claude Code 配置

**Anthropic 兼容接口示例：**

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
        "VISION_MODEL": "your-vision-model",
        "VISION_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

**OpenAI 兼容接口示例：**

```json
{
  "mcpServers": {
    "vision-relay": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/vision-relay-mcp/index.js"],
      "env": {
        "VISION_PROVIDER": "openai",
        "VISION_BASE_URL": "https://your-openai-compatible-endpoint.example.com",
        "VISION_MODEL": "your-vision-model",
        "VISION_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

**平台路径示例：**

Windows: `"args": ["C:\\Users\\you\\vision-relay-mcp\\index.js"]`

macOS / Linux: `"args": ["/Users/you/vision-relay-mcp/index.js"]`

配置完成后重启 Claude Code，执行 `claude mcp list` 确认 `vision-relay ... Connected`。

### 工具说明

#### `process_images`

**输入格式：**

```json
{
  "image_paths": ["/abs/path/to/image.png"],
  "prompt": "提取所有可见文字，保持阅读顺序。"
}
```

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `image_paths` | 是 | 一张或多张本地图片路径，一次请求发送 |
| `prompt` | 否 | 对这组图片要执行的任务，不传时使用通用提示词 |

**可复现示例：**

单图 OCR：
```json
{ "image_paths": ["/abs/path/to/screenshot.png"], "prompt": "提取所有可见文字，保持阅读顺序。" }
```

多图对比：
```json
{ "image_paths": ["/abs/path/to/v1.png", "/abs/path/to/v2.png"], "prompt": "比较这两张 UI 设计，列出所有视觉差异。" }
```

结构化提取：
```json
{ "image_paths": ["/abs/path/to/form.jpg"], "prompt": "将可见字段提取为 JSON 对象，以字段标签作为 key。" }
```

多图推理：
```json
{ "image_paths": ["/abs/path/to/1.png", "/abs/path/to/2.png", "/abs/path/to/3.png"], "prompt": "这三张截图展示了一个操作流程，请描述每一步发生了什么。" }
```

不传 `prompt` 时，工具会要求模型综合描述图片内容、文字、对象、颜色、布局和跨图关系。

### 支持的图片格式

| 扩展名 | MIME 类型 |
| --- | --- |
| `.png` | `image/png` |
| `.jpg` / `.jpeg` | `image/jpeg` |
| `.webp` | `image/webp` |
| `.gif` | `image/gif` |
| `.bmp` | `image/bmp` |

### 从 v1.0.0 升级

1. 下载或克隆 v1.1.0 到新目录（或替换旧目录）。
2. 执行 `npm install`。
3. 将 MCP 配置中的 `args` 路径改为 v1.1.0 的 `index.js`。
4. 保留原有环境变量，或按需更新。
5. 替换旧工具调用：

| v1.0.0 调用方式 | v1.1.0 等价方式 |
| --- | --- |
| `analyze_image` + `image_path` | `process_images` + `image_paths: ["..."]` |
| `compare_images` + 两张路径 | `process_images` + 两张路径 + 对比提示词 |

6. 重启 Claude Code。
7. 执行 `claude mcp list`，确认 `vision-relay` 为 `Connected`。

### 安全说明

- **不要提交真实 API key。** `.env.example` 只是模板，不是配置文件。
- **不要把密钥写进** `index.js`、README 或任何提交到版本控制的文件。
- **推荐放在 MCP 配置的 `env` 块**，或系统环境变量、密钥管理工具中。
- 如果密钥曾出现在聊天、日志、截图或公开仓库中，**应立即轮换**。
- 服务器仅向 `VISION_BASE_URL` 发起 HTTPS 请求，不会回传数据、收集遥测或与第三方通信。

### 常见问题

| 现象 | 可能原因 | 排查方向 |
| --- | --- | --- |
| `claude mcp list` 看不到服务 | 路径或 Node.js 问题 | 确认 `node --version` ≥ 18；检查 `args` 是否指向 `index.js` |
| 显示 `Disconnected` | 服务启动即崩溃 | 手动执行 `node index.js` 查看错误信息 |
| 提示缺少环境变量 | 配置未设置 | 确认 `VISION_API_KEY`、`VISION_BASE_URL`、`VISION_MODEL` 均已配置 |
| API 返回 4xx | 鉴权或格式错误 | 检查 API key 是否正确；确认 `VISION_PROVIDER` 与接口格式匹配 |
| API 返回 5xx | 服务端异常 | 检查接口是否可达；用 `curl` 测试同样的 URL 和 key |
| "Unsupported image extension" | 格式不支持 | 使用 png、jpg、jpeg、webp、gif 或 bmp |
| "Image is larger than X MB" | 超过大小限制 | 提高 `VISION_MAX_IMAGE_SIZE` 或先压缩图片 |
| 找不到图片 | 路径错误 | 使用绝对路径；相对路径取决于 MCP 服务的工作目录 |

### 项目结构

```
vision-relay-mcp/
├── index.js          # 服务入口（单文件，约 240 行）
├── package.json      # 项目元数据和依赖
├── README.md         # 本文件（英文 + 中文）
├── README.zh-CN.md   # 中文小白部署教程
├── LICENSE           # MIT
├── .env.example      # 环境变量模板（勿填入真实 key）
└── .gitignore        # 忽略 node_modules、.env、日志
```

### 许可证

MIT — 详见 [LICENSE](./LICENSE)。

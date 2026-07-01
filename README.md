# Vision Relay MCP

![Version](https://img.shields.io/badge/version-1.1.0-blue)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)
![License](https://img.shields.io/badge/license-MIT-green)

A lightweight local MCP server that gives Claude Code — or any MCP-compatible
client — the ability to "see" images. It relays local image files to a
vision-capable API and returns the model's text response to the client.

> This document is bilingual — English first, Chinese follows.

---

## What It Does

Claude Code is a text-only tool. It cannot open, view, or interpret image files
on its own. When your workflow needs to read a screenshot, compare two UI
mockups, extract structured data from a scanned form, or answer a question
about a photograph, you need a bridge between your local files and a vision
model that can actually process images.

Vision Relay MCP is that bridge. It runs as a local MCP (Model Context
Protocol) server — a lightweight process that Claude Code launches and
communicates with over standard input/output. When Claude Code needs vision
capabilities, it calls the `process_images` tool through MCP, and the server
handles everything else: reading your files, encoding them, calling the vision
API, and returning the result.

```
Local Image(s)  →  Vision Relay MCP  →  Vision API  →  Text Result  →  Claude Code
```

### When to Use It

| Scenario | Without Vision Relay | With Vision Relay |
| --- | --- | --- |
| "What does this error screenshot say?" | You describe it manually | Claude reads it directly |
| "Compare these two design mockups" | Not possible | Side-by-side analysis |
| "Extract the fields from this scanned form" | Manual transcription | Automatic JSON output |
| "What's in this photo?" | Not possible | Full visual description |
| "Read the text from these 5 screenshots" | Not possible | Batch processing in one call |

### Key Design Decisions

- **Single-file server** (index.js, ~240 lines). No build step, no framework.
  Read the source in 5 minutes to verify exactly what it does.
- **One tool, prompt-driven.** Instead of separate tools for OCR, comparison,
  extraction, etc., v1.1.0 exposes one `process_images` tool and lets the
  vision model decide what to do based on your prompt.
- **Zero telemetry.** The server sends requests only to the endpoint you
  configure. It never phones home, collects analytics, or logs anything beyond
  what Node.js emits to stderr.
- **No image storage.** Images are read, encoded, sent, and discarded. Nothing
  is written to disk.

---

## How It Works

### Step-by-step Flow

1. **Claude Code** determines that a user request requires vision capabilities.
   It constructs a JSON-RPC call to the `process_images` MCP tool with one or
   more local image file paths and an optional task prompt.

2. **Vision Relay MCP** receives the request. It calls `Promise.all()` to read
   every specified image file **concurrently** (not one at a time), which keeps
   multi-image requests fast. Each file is validated against the supported
   extensions list and the optional size limit before being read into memory
   and encoded as a base64 data URL.

3. **The server constructs a provider-specific HTTP request.** If
   VISION_PROVIDER is `anthropic`, it builds an Anthropic Messages API request
   with `type: "image"` content blocks (base64-encoded with media_type). If
   `openai`, it builds an OpenAI Chat Completions request with `type:
   "image_url"` content blocks (data URL format). The prompt is sent as a text
   block alongside the images.

4. **The vision model** processes all images together in a single API call,
   following whatever instructions the prompt contains. It returns a structured
   JSON response containing text content.

5. **Vision Relay MCP** extracts the text from the API response and returns it
   to Claude Code through the MCP stdio channel.

6. **Claude Code** incorporates the vision model's text output into the
   ongoing conversation and continues working on your task.

### What "Concurrent File Reading" Means

When you send 3 images, the server issues 3 `readFile()` calls at the same
time via `Promise.all()`. They resolve as the OS returns data — typically
near-simultaneously for local SSD storage. This is a deliberate improvement
over v1.0.0, which read files one after another.

### Request Format Details

**Anthropic Messages API format:**
```json
{
  "model": "your-model",
  "max_tokens": 2000,
  "messages": [{
    "role": "user",
    "content": [
      { "type": "image", "source": { "type": "base64", "media_type": "image/png", "data": "..." }},
      { "type": "image", "source": { "type": "base64", "media_type": "image/jpeg", "data": "..." }},
      { "type": "text", "text": "Compare these images." }
    ]
  }]
}
```

**OpenAI Chat Completions format:**
```json
{
  "model": "your-model",
  "messages": [{
    "role": "user",
    "content": [
      { "type": "text", "text": "Compare these images." },
      { "type": "image_url", "image_url": { "url": "data:image/png;base64,..." }},
      { "type": "image_url", "image_url": { "url": "data:image/jpeg;base64,..." }}
    ]
  }]
}
```

The server handles this format translation automatically — you never need to
think about it. Just set VISION_PROVIDER correctly for your endpoint.

---

## Quick Start

```bash
# 1. Clone the project
git clone https://github.com/zhoucoolboy/vision-relay-mcp.git
cd vision-relay-mcp

# 2. Install the single dependency
npm install

# 3. Verify syntax (does not start the server)
npm run check
```

Then add the server to your Claude Code MCP configuration (see [Claude Code
Setup](#claude-code-setup) below), restart Claude Code, and you're ready.

---

## Version History

### v1.1.0 (current)

v1.1.0 is a **single-entry-point upgrade** that replaces multiple
task-specific tools with one general-purpose entry.

**Design rationale:** The first version exposed `analyze_image` and
`compare_images` as separate MCP tools. In practice, the distinction was
artificial — both tools did exactly the same thing (send images + prompt to an
API), differing only in how many images they accepted. The vision model itself
is perfectly capable of deciding what to do based on the prompt content.
v1.1.0 embraces this by providing exactly one tool whose behavior is
prompt-driven rather than hard-coded into the tool name.

**Key changes from v1.0.0:**
- Single tool (`process_images`) replaces two separate tools
- Supports any number of images (1, 2, 10, 50 — no hard limit beyond API constraints)
- All images sent in one API request instead of sequential calls
- Concurrent file reading via `Promise.all()` instead of sequential reads
- Configurable per-image size limit via VISION_MAX_IMAGE_SIZE
- Credentials read exclusively from environment variables

### v1.0.0 (first version)

The original release had two purpose-specific tools:

| Tool | Purpose | Limitation |
| --- | --- | --- |
| `analyze_image` | Analyze, OCR, or describe a single image | One image only |
| `compare_images` | Compare exactly two images side-by-side | Exactly two images |

**Full comparison:**

| Aspect | v1.0.0 | v1.1.0 |
| --- | --- | --- |
| Tool count | 2 | 1 |
| Image count | 1 or exactly 2 | 1 or more (no upper limit) |
| Request strategy | One image per request | All images in one request |
| File reading | Sequential (`await` in loop) | Concurrent (`Promise.all`) |
| Size limit | None | Configurable per-image (VISION_MAX_IMAGE_SIZE) |
| Task routing | Fixed by tool name | Prompt-driven (model decides) |
| API format support | Anthropic only | Anthropic + OpenAI compatible |

---

## Requirements

- **Node.js** `18.0.0` or newer — the server uses global `fetch()` (added in
  Node 18), `fs/promises`, and ES module syntax (`import`/`export`)
- **An MCP-compatible client** — Claude Code is the primary target, but any
  client implementing the Model Context Protocol over stdio will work
- **A vision-capable API endpoint** — any service that accepts the Anthropic
  Messages API or OpenAI Chat Completions API format and supports image input
  in requests
- **An API key** for that endpoint

> The model specified in VISION_MODEL **must** support image input. A
> text-only model will connect successfully (the API accepts the request) but
> will return an error or empty response when an image is included. Common
> vision-capable models include Claude 3.5 Sonnet and newer, GPT-4o, GPT-4
> Vision, and many open-source VLMs.

---

## Install

```bash
# Clone the repository
git clone https://github.com/zhoucoolboy/vision-relay-mcp.git
cd vision-relay-mcp

# Install the single runtime dependency
npm install

# Verify the JavaScript parses correctly (does not start the server)
npm run check
```

The project has exactly one runtime dependency:
[`@modelcontextprotocol/sdk`](https://www.npmjs.com/package/@modelcontextprotocol/sdk),
which provides the MCP server framework (Server class, stdio transport, and
request type definitions).

There is no build step, no TypeScript compilation, and no additional tooling
required. The server is a single JavaScript file you can read in its entirety.

---

## Configuration

All configuration is read from environment variables. There is no config file,
no CLI flags, and no interactive setup wizard. You set these once in your MCP
configuration and forget about them.

### Environment Variables

| Name | Required | Default | Description |
| --- | --- | --- | --- |
| VISION_PROVIDER | No | `anthropic` | Which API format to use: `anthropic` or `openai` |
| VISION_API_KEY | Yes | (none) | API key for your vision endpoint |
| VISION_BASE_URL | Yes | (none) | Base URL of the vision API to call |
| VISION_MODEL | Yes | (none) | Model name or ID that supports image input |
| VISION_MAX_TOKENS | No | `2000` | Maximum tokens in the model's response |
| VISION_MAX_IMAGE_SIZE | No | `0` (disabled) | Per-image size limit in bytes. `0` means no limit |

### VISION_PROVIDER

Controls which HTTP request format the server uses. Only two values are valid:

- `anthropic` — Uses the [Anthropic Messages
  API](https://docs.anthropic.com/en/api/messages) format. Images are sent as
  base64-encoded content blocks with explicit `media_type`. Both
  `anthropic-version: 2023-06-01` and `x-api-key` headers are included.

- `openai` — Uses the [OpenAI Chat
  Completions](https://platform.openai.com/docs/api-reference/chat) format.
  Images are sent as data URLs (`data:image/png;base64,...`). Only the
  standard `Authorization: Bearer` header is sent.

If your API provider or relay service documents itself as "Anthropic
compatible" or "OpenAI compatible", choose the matching provider. If unsure,
start with `anthropic` (the default) and test.

### VISION_BASE_URL

This is the address of the API endpoint the server will call. You do not need
to include the full API path — the server auto-completes it:

| Provider | You set VISION_BASE_URL to | Actual HTTP request sent to |
| --- | --- | --- |
| anthropic | `https://api.example.com` | `https://api.example.com/v1/messages` |
| anthropic | `https://api.example.com/v1` | `https://api.example.com/v1/messages` |
| anthropic | `https://api.example.com/v1/messages` | `https://api.example.com/v1/messages` (used as-is) |
| openai | `https://api.example.com` | `https://api.example.com/v1/chat/completions` |
| openai | `https://api.example.com/v1` | `https://api.example.com/v1/chat/completions` |
| openai | `https://api.example.com/v1/chat/completions` | `https://api.example.com/v1/chat/completions` (used as-is) |

The auto-completion logic strips any trailing slash, then appends the standard
API path suffix unless the path is already fully specified. This means you can
use the same base URL you would use with the official SDK.

### VISION_API_KEY

Your authentication key for the vision API. This is sent as:

- `x-api-key` header (Anthropic)
- `Authorization: Bearer <key>` header (OpenAI)

If VISION_API_KEY is not set, the server falls back to checking
`ANTHROPIC_API_KEY` (for anthropic provider) or `OPENAI_API_KEY` (for openai
provider). VISION_API_KEY takes priority over both.

### VISION_MODEL

The model ID string that supports vision. This value is sent directly in the
API request body as the `model` field. Examples:

- `claude-sonnet-4-6` (or any Claude model that supports vision)
- `gpt-4o`
- `gpt-4-vision-preview`
- Any custom model name your relay service recognizes

### VISION_MAX_TOKENS

Limits the length of the model's response. Defaults to 2000 tokens, which is
enough for most image descriptions and comparisons. Increase this if you need
very detailed analysis or are processing many images at once. This value has
no effect on how much the API call costs — input tokens (your images) are
billed separately.

### VISION_MAX_IMAGE_SIZE

Optional per-image file size limit, specified in bytes. Useful values:

| Value | Effect |
| --- | --- |
| `0` (default) | No size limit — any file the OS can read is sent |
| `5242880` | 5 MB limit — typical for API gateways |
| `20971520` | 20 MB limit — generous, covers most screenshots and photos |

If an image exceeds this limit, the server returns an error like `Image is
larger than 5.0 MB: /path/to/file.png` instead of sending it.

---

## Claude Code Setup

### Where to Put the Configuration

Claude Code reads MCP server configurations from two possible locations:

- **User-level** (applies to all your Claude Code projects):
  - macOS: `~/.claude/claude_desktop_config.json`
  - Windows: `%USERPROFILE%\.claude\claude_desktop_config.json`
  - Or use: `claude mcp add-json` to add interactively

- **Project-level** (only for one specific project):
  - `.claude/settings.json` in the project root directory

The project-level file takes precedence. If a server with the same name
appears in both, the project-level one wins.

### Anthropic-compatible Endpoint Example

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
        "VISION_MODEL": "your-vision-model-name",
        "VISION_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

### OpenAI-compatible Endpoint Example

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
        "VISION_MODEL": "your-vision-model-name",
        "VISION_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

### Platform-specific Path Examples

The `args` value must be an **absolute path** to `index.js`. Relative paths
will not work because the MCP server's working directory is not guaranteed to
match your expectation.

**Windows:**
```json
"args": ["C:\\Users\\yourname\\vision-relay-mcp\\index.js"]
```

**macOS / Linux:**
```json
"args": ["/Users/yourname/vision-relay-mcp/index.js"]
```

### Verify the Connection

1. Save your MCP configuration file.
2. **Restart Claude Code** (the server list is loaded at startup).
3. In Claude Code, run:
   ```bash
   claude mcp list
   ```
4. Look for `vision-relay ... Connected` in the output.

If you see `Disconnected` or the server name does not appear at all, see the
[Troubleshooting](#troubleshooting) section below.

---

## Tool Reference

### `process_images`

General-purpose vision tool for one or more local images. Use it for OCR,
extracting structured information, describing content, answering visual
questions, locating elements in screenshots, summarizing UI states, or
reasoning across multiple images in a single call.

**Input Schema:**

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

| Field | Required | Type | Description |
| --- | --- | --- | --- |
| `image_paths` | Yes | `string[]` | Array of absolute paths to local image files. Minimum 1 element. All images are base64-encoded and sent in a single API request. |
| `prompt` | No | `string` | Natural-language instruction for the vision model. If omitted, a comprehensive default prompt is used that asks for description, text extraction, object/color/layout analysis, and cross-image relationships. |

**Return value:** The model's text response as a string. This is whatever the
model returns — a description, a JSON structure, a comparison, or an answer
based on your prompt.

### Reproducible Examples

**OCR — Extract text from a screenshot:**

```json
{
  "image_paths": ["/abs/path/to/screenshot.png"],
  "prompt": "Extract all visible text from this screenshot. Preserve the reading order (top to bottom, left to right). Return only the extracted text, no commentary."
}
```

**Comparison — Find differences between two designs:**

```json
{
  "image_paths": ["/abs/path/to/design-v1.png", "/abs/path/to/design-v2.png"],
  "prompt": "Compare these two UI designs pixel by pixel. List every visual difference including: layout changes, color variations, text changes, spacing differences, and any added or removed elements. Be specific about the location of each difference."
}
```

**Structured extraction — Parse a form into JSON:**

```json
{
  "image_paths": ["/abs/path/to/form.jpg"],
  "prompt": "Extract the visible fields from this form as a JSON object. Use the field labels as keys. For checkboxes, use true/false. For dates, use YYYY-MM-DD format. Return only valid JSON."
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
  "prompt": "These three screenshots show sequential steps in a user workflow. For each step: (1) describe what is visible on screen, (2) identify what action the user took to reach the next step, (3) note any error states or unexpected behavior. End with a summary of the complete flow."
}
```

**Default behavior — No prompt:**

```json
{
  "image_paths": ["/abs/path/to/image.png"]
}
```

When `prompt` is omitted, the server sends the following default instruction:

> Analyze these images comprehensively. For each image, describe the main
> content, extract any visible text, and identify important objects, colors,
> layout, and notable details. Also mention relationships, sequence,
> similarities, or differences across the images when relevant.

### Prompt Writing Tips

- **Be specific about your output format.** "Return as JSON" or "List each
  difference on a new line" gives better results than open-ended prompts.
- **For OCR, mention reading order.** "Top to bottom, left to right" helps
  the model preserve the original layout.
- **For comparisons, ask for locations.** "Identify where in the image each
  difference appears" makes the output actionable.
- **For multi-image requests, describe the relationship.** "These are
  before/after screenshots" or "These are sequential steps" gives the model
  context for cross-image reasoning.

---

## Supported Image Formats

| Extension | MIME Type | Notes |
| --- | --- | --- |
| `.png` | `image/png` | Best for screenshots and UI — lossless, supports transparency |
| `.jpg` / `.jpeg` | `image/jpeg` | Best for photographs — smaller file size, lossy |
| `.webp` | `image/webp` | Modern format with good compression for both photos and graphics |
| `.gif` | `image/gif` | Supports animation (first frame only for most vision models) |
| `.bmp` | `image/bmp` | Uncompressed — large files, use only if you have no alternative |

SVG, PDF, TIFF, and HEIC are not supported. Convert these to PNG before
sending.

---

## Upgrade From v1.0.0

### Step-by-step Upgrade

1. **Download or clone v1.1.0** to a new directory (or replace the old one).
   Keep your old version as a backup until you confirm the new one works.
2. Run `npm install` in the v1.1.0 directory.
3. Update your MCP configuration — change the `args` path to point to the
   v1.1.0 `index.js`.
4. Keep your existing environment variables (VISION_PROVIDER, VISION_API_KEY,
   VISION_BASE_URL, VISION_MODEL). No changes needed unless your endpoint or
   model has changed.
5. **Replace old tool calls.** This is the only code change required:

| v1.0.0 call | v1.1.0 equivalent |
| --- | --- |
| `analyze_image` with `image_path: "/path/to/img.png"` | `process_images` with `image_paths: ["/path/to/img.png"]` |
| `compare_images` with `first_image_path` and `second_image_path` | `process_images` with `image_paths: ["/path/to/first.png", "/path/to/second.png"]` and a comparison prompt |

6. Restart Claude Code.
7. Run `claude mcp list` and confirm `vision-relay` shows `Connected`.

### Breaking Changes to Watch For

- **Parameter name changed:** `image_path` (singular) → `image_paths` (plural array)
- **Comparison requires a prompt now:** If you used `compare_images` before,
  you must now include a prompt explicitly requesting comparison (e.g.,
  "Compare these two images and list the differences.")
- **Tool name changed:** `analyze_image` and `compare_images` no longer
  exist. Only `process_images` is available.

---

## Security

### What You Should Do

- **Never commit real API keys.** The `.env.example` file is a template for
  reference — it contains placeholder values. Your actual keys belong in the
  MCP configuration `env` block or a secrets manager.
- **Do not hardcode secrets** in `index.js`, README, or any committed file.
  The server reads all credentials from `process.env` — there is no fallback
  to hardcoded values anywhere in the code.
- **Use the MCP `env` block** in your Claude Code configuration. It's the
  simplest and safest place. The values are stored in your local config file
  and never leave your machine except when sent as HTTP headers to the
  endpoint you configure.
- **Rotate keys immediately** if they appear in chat logs, screenshots, git
  history, or a public repository. Even a key that appears "redacted" in a
  screenshot may be recoverable.
- **Use .gitignore.** The project's `.gitignore` already excludes `node_modules/`,
  `.env`, and log files. Do not remove these entries.

### What the Server Does (and Doesn't Do)

- **Only calls the endpoint you configure.** The server makes outbound HTTPS
  requests exclusively to `VISION_BASE_URL`. It does not connect to analytics
  services, update servers, or any other host.
- **Does not store images.** Images are read into memory, base64-encoded,
  sent to the API, and then garbage-collected. Nothing is written to disk.
- **Does not cache results.** Each call is stateless. Results are returned to
  the client and immediately discarded.
- **Does not collect telemetry.** There are no tracking pixels, no usage
  statistics, no startup pings — nothing.

---

## Troubleshooting

### Diagnostic Checklist

Before diving into specific errors, run through this quick checklist:

```bash
# 1. Is Node.js installed and new enough?
node --version  # Should be >= 18.0.0

# 2. Does the server file exist and parse correctly?
node --check /path/to/vision-relay-mcp/index.js  # Should produce no output

# 3. Can you start the server manually? (It will wait for MCP input — press Ctrl+C to stop)
node /path/to/vision-relay-mcp/index.js  # Should not crash immediately

# 4. Are your environment variables set?
# In Claude Code: check the MCP config's "env" block
# Manually: run `echo $VISION_API_KEY` (but never print keys in shared sessions)
```

### Common Issues

| Symptom | Likely Cause | Diagnostic Steps |
| --- | --- | --- |
| Server does not appear in `claude mcp list` | Path or config issue | 1. Verify `node --version` ≥ 18<br>2. Check that `args` path is absolute and points to the actual `index.js` file<br>3. Confirm there are no JSON syntax errors in your MCP config |
| Status shows `Disconnected` | Server crashed on startup | 1. Run `node /path/to/index.js` manually in a terminal<br>2. Read the error message — common causes: missing `npm install`, wrong Node version, syntax error<br>3. If the error mentions `@modelcontextprotocol/sdk`, run `npm install` again |
| "Missing environment variable(s)" | Config not set | 1. Check that all three required variables (VISION_API_KEY, VISION_BASE_URL, VISION_MODEL) are in the `env` block<br>2. Variable names are case-sensitive — use UPPER_SNAKE_CASE exactly as shown |
| API returns 401 / 403 | Authentication failed | 1. Verify the API key is correct and has not expired<br>2. Check the key has permissions for the model you're using<br>3. Confirm VISION_PROVIDER matches your endpoint's auth format |
| API returns 404 | Wrong URL or model | 1. Check VISION_BASE_URL — try the URL in a browser or with curl<br>2. Confirm the model name exists at your endpoint<br>3. Verify the auto-completed path is correct (see URL format table above) |
| API returns 4xx (other) | Request format mismatch | 1. Confirm VISION_PROVIDER matches your endpoint<br>2. Try switching between `anthropic` and `openai` if unsure |
| API returns 5xx | Endpoint server error | 1. The issue is on the API side, not with Vision Relay<br>2. Try again in a few minutes<br>3. Contact your API provider if it persists |
| "Unsupported image extension" | File format not supported | 1. Check the file extension — only png, jpg, jpeg, webp, gif, bmp are supported<br>2. Convert unsupported formats (SVG, PDF, HEIC, TIFF) to PNG first<br>3. The check is case-insensitive, so `.PNG` and `.png` both work |
| "Image is larger than X MB" | File exceeds size limit | 1. Increase VISION_MAX_IMAGE_SIZE to a higher value<br>2. Or compress the image before sending (try resizing to ~2000px wide) |
| Image not found / "Not a file" | Path issue | 1. Use absolute paths — relative paths depend on the MCP server's working directory<br>2. Check that the file exists at the exact path specified<br>3. On Windows, use double backslashes in JSON: `C:\\Users\\...` |

---

## Project Structure

```
vision-relay-mcp/
├── index.js          # Server entry point — single file, ~240 lines
├── package.json      # Project metadata and single dependency
├── package-lock.json # Lockfile for reproducible installs
├── README.md         # This file — English + 中文
├── README.zh-CN.md   # Beginner-friendly Chinese tutorial
├── LICENSE           # MIT
├── .env.example      # Environment variable template (do not put real keys here)
└── .gitignore        # Excludes node_modules/, .env, *.log, OS files
```

---

## License

MIT — see [LICENSE](./LICENSE).

---

## 中文说明

1.1.0 是第一版 Vision Relay MCP 的**单入口升级版**，将原来的多个任务工具合并为一个通用入口。

### 项目简介

Claude Code 本身不能直接"看"图片。当你需要让它读取截图、对比设计稿、从扫描件提取字段，或根据照片回答问题时，就需要一个桥梁把本地图片交给视觉模型处理。

Vision Relay MCP 就是这个桥梁。它作为一个本地 MCP（Model Context Protocol）服务运行——Claude Code 启动这个轻量进程，通过标准输入/输出与之通信。当需要视觉能力时，Claude Code 通过 MCP 调用 process_images 工具，服务端负责文件读取、编码、API 调用和结果返回。

```
本地图片  →  Vision Relay MCP  →  视觉模型 API  →  文本结果  →  Claude Code
```

**典型使用场景：**

| 场景 | 没有 Vision Relay | 有了 Vision Relay |
| --- | --- | --- |
| "这张报错截图里写了什么？" | 你手动描述 | Claude 直接读取 |
| "对比这两张设计稿" | 做不到 | 并排分析差异 |
| "从这张扫描件提取字段" | 手动誊写 | 自动输出 JSON |
| "这张照片里有什么？" | 做不到 | 完整视觉描述 |
| "读取这 5 张截图里的文字" | 做不到 | 一次调用批量处理 |

**核心设计决策：**

- **单文件实现**（index.js，约 240 行）。没有构建步骤、没有框架依赖。5 分钟即可通读源码，验证它到底做了什么。
- **一个工具，提示词驱动。** v1.1.0 不区分"单图分析"和"多图对比"，只有一个 process_images 工具，具体做什么由你的提示词决定。
- **零遥测。** 服务只访问你配置的接口，不会回传数据、收集统计、或连接任何第三方。
- **不存储图片。** 图片读取、编码、发送后即被垃圾回收，不会写入磁盘。

### 工作原理

#### 逐步流程

1. **Claude Code** 判断用户请求需要视觉能力，构造一个 JSON-RPC 请求，调用 process_images 工具，传入本地图片路径和可选的任务描述。

2. **Vision Relay MCP** 收到请求后，通过 Promise.all() **并发读取**所有指定的图片文件（而非逐个读取），校验文件扩展名和大小限制，然后编码为 base64。

3. **服务端构造 HTTP 请求。** 如果 VISION_PROVIDER 为 anthropic，构建 Anthropic Messages API 格式（type: "image" 的 content block，含 media_type 和 base64 数据）。如果为 openai，构建 OpenAI Chat Completions 格式（type: "image_url" 的 content block，使用 data URL 格式）。提示词以文本块的形式与图片一起发送。

4. **视觉模型** 在单次 API 调用中一起处理所有图片，按提示词的指令返回结构化的 JSON 响应，其中包含文本内容。

5. **Vision Relay MCP** 从 API 响应中提取文本，通过 MCP stdio 通道返回给 Claude Code。

6. **Claude Code** 将视觉模型返回的文本内容纳入对话，继续完成你的任务。

#### 并发读取的含义

当你发送 3 张图片时，服务端同时发起 3 个 readFile() 调用。它们在操作系统返回数据时逐个完成——对于本地 SSD，几乎同时完成。这比 v1.0.0 的顺序读取（一张一张来）要快得多。

#### 请求格式详情

**Anthropic Messages API 格式**（VISION_PROVIDER=anthropic）：
```json
{
  "model": "your-model",
  "max_tokens": 2000,
  "messages": [{
    "role": "user",
    "content": [
      {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": "..."}},
      {"type": "text", "text": "Compare these images."}
    ]
  }]
}
```

**OpenAI Chat Completions 格式**（VISION_PROVIDER=openai）：
```json
{
  "model": "your-model",
  "messages": [{
    "role": "user",
    "content": [
      {"type": "text", "text": "Compare these images."},
      {"type": "image_url", "image_url": {"url": "data:image/png;base64,..."}}
    ]
  }]
}
```

服务端自动完成格式转换——你只需正确设置 VISION_PROVIDER 即可。

### 快速开始

```bash
# 1. 克隆项目
git clone https://github.com/zhoucoolboy/vision-relay-mcp.git
cd vision-relay-mcp

# 2. 安装唯一的依赖
npm install

# 3. 验证语法（不会启动服务）
npm run check
```

然后将服务添加到 Claude Code MCP 配置（见下方 [Claude Code 配置](#claude-code-配置)），重启 Claude Code 即可使用。

### 版本说明

#### v1.1.0（当前版本）

**设计理念：** 第一版按"单图分析"和"双图对比"拆分为两个 MCP 工具。实际上，"分析一张图"和"对比两张图"本质完全相同——都是"发送 N 张图片 + 提示词给 API"。视觉模型完全有能力根据提示词自行判断任务类型。v1.1.0 只提供一个入口，行为由提示词驱动而非工具名称。

**相比 v1.0.0 的关键变化：**
- 单一工具 process_images 取代两个独立工具
- 支持任意张图片（1 张、2 张、10 张、50 张——无硬性上限，取决于 API 限制）
- 所有图片合并为一次 API 请求，而非顺序调用
- 并发读取文件（Promise.all），而非顺序读取
- 可配置单图大小限制（VISION_MAX_IMAGE_SIZE）

#### v1.0.0（第一版）

第一版有两个专用工具：

| 工具 | 用途 | 限制 |
| --- | --- | --- |
| analyze_image | 分析、OCR 或描述单张图片 | 只能一张 |
| compare_images | 并排对比恰好两张图片 | 只能两张 |

**完整对比：**

| 方面 | v1.0.0 | v1.1.0 |
| --- | --- | --- |
| 工具数量 | 2 个 | 1 个 |
| 支持图片数 | 1 张或恰好 2 张 | 1 张起，无上限 |
| 请求策略 | 一张图一次请求 | 多图合并为一次请求 |
| 文件读取 | 顺序读取 | 并发读取（Promise.all） |
| 图片大小限制 | 无 | 可配置 VISION_MAX_IMAGE_SIZE |
| 任务路由 | 由工具名决定 | 由提示词决定（模型自行判断） |
| API 格式支持 | 仅 Anthropic | Anthropic + OpenAI 兼容 |

### 运行要求

- **Node.js** 18.0.0 或更高版本 — 使用了 Node 18 引入的全局 fetch()、fs/promises 和 ES module 语法
- **Claude Code** 或其他支持 MCP 的客户端
- 一个**支持视觉能力的 API 接口**（Anthropic Messages API 或 OpenAI Chat Completions 格式，且支持图片输入）
- 对应接口的 **API key**

> VISION_MODEL 设置的模型**必须**支持图片输入。纯文本模型虽然能连上接口（API 接受请求），但收到图片时会返回错误或空响应。常见的视觉模型包括 Claude 3.5 Sonnet 及以上、GPT-4o、GPT-4 Vision 和许多开源 VLM。

### 安装

```bash
# 克隆仓库
git clone https://github.com/zhoucoolboy/vision-relay-mcp.git
cd vision-relay-mcp

# 安装唯一运行时依赖
npm install

# 验证 JavaScript 语法（不会启动服务）
npm run check
```

唯一依赖：[@modelcontextprotocol/sdk](https://www.npmjs.com/package/@modelcontextprotocol/sdk)，提供 MCP 服务框架。没有构建步骤、无需编译。

### 配置项

所有配置通过环境变量传入，无需配置文件。

| 名称 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- |
| VISION_PROVIDER | 否 | anthropic | 接口格式：anthropic 或 openai |
| VISION_API_KEY | 是 | 无 | 视觉接口或中转服务的 API key |
| VISION_BASE_URL | 是 | 无 | 视觉接口或中转服务的 base URL |
| VISION_MODEL | 是 | 无 | 支持图片输入的模型名称 |
| VISION_MAX_TOKENS | 否 | 2000 | 模型响应的最大 token 数 |
| VISION_MAX_IMAGE_SIZE | 否 | 0（不限制） | 单张图片的大小上限（字节） |

**VISION_PROVIDER** — 决定 HTTP 请求格式：
- `anthropic` — 使用 Anthropic Messages API 格式，图片以 base64 content block 发送
- `openai` — 使用 OpenAI Chat Completions 格式，图片以 data URL 发送

**VISION_BASE_URL** — 无需包含完整路径，服务端自动补全：

| Provider | 你设置为 | 实际请求地址 |
| --- | --- | --- |
| anthropic | `https://api.example.com` | `https://api.example.com/v1/messages` |
| anthropic | `https://api.example.com/v1` | `https://api.example.com/v1/messages` |
| anthropic | `https://api.example.com/v1/messages` | 直接使用（不做补全） |
| openai | `https://api.example.com` | `https://api.example.com/v1/chat/completions` |
| openai | `https://api.example.com/v1` | `https://api.example.com/v1/chat/completions` |
| openai | `https://api.example.com/v1/chat/completions` | 直接使用（不做补全） |

**API key 回退：** 如果未设置 VISION_API_KEY，服务会依次尝试 ANTHROPIC_API_KEY（anthropic 时）或 OPENAI_API_KEY（openai 时）。VISION_API_KEY 始终优先。

**VISION_MAX_TOKENS** — 限制模型返回长度。2000 token 足够大多数图片描述和对比。需要非常详细的分析或一次处理很多图片时可适当增大。

**VISION_MAX_IMAGE_SIZE** — 常用值参考：
| 值 | 效果 |
| --- | --- |
| 0（默认） | 不限制 |
| 5242880（5 MB） | 适合大多数 API 网关 |
| 20971520（20 MB） | 覆盖大多数截图和照片 |

### Claude Code 配置

**配置位置：**

- **用户级**（所有项目生效）：
  - macOS: `~/.claude/claude_desktop_config.json`
  - Windows: `%USERPROFILE%\.claude\claude_desktop_config.json`
  - 或使用 `claude mcp add-json` 交互式添加
- **项目级**（仅当前项目）：`.claude/settings.json`

项目级配置优先于用户级。如果两个位置都有同名服务，项目级的生效。

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
        "VISION_MODEL": "your-vision-model-name",
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
        "VISION_MODEL": "your-vision-model-name",
        "VISION_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

**平台路径示例：**

Windows：
```json
"args": ["C:\\Users\\你的用户名\\vision-relay-mcp\\index.js"]
```

macOS / Linux：
```json
"args": ["/Users/你的用户名/vision-relay-mcp/index.js"]
```

**验证连接：**

1. 保存 MCP 配置文件。
2. **重启 Claude Code**（服务列表在启动时加载）。
3. 执行：`claude mcp list`
4. 确认显示 vision-relay ... Connected。

如果显示 Disconnected 或服务不存在，请查看[常见问题](#常见问题)。

---

### 工具说明

#### process_images

通用视觉工具，一次可处理一张或多张本地图片。用于 OCR、提取结构化信息、描述内容、回答问题、定位元素、总结截图，或多图推理。

**输入格式：**

```json
{
  "image_paths": ["/abs/path/to/image.png"],
  "prompt": "提取所有可见文字，保持阅读顺序。"
}
```

**字段说明：**

| 字段 | 必填 | 类型 | 说明 |
| --- | --- | --- | --- |
| image_paths | 是 | string[] | 本地图片的绝对路径数组，至少 1 个。所有图片会被 base64 编码并在一次 API 请求中发送 |
| prompt | 否 | string | 对图片的自然语言任务描述。不传时使用通用默认提示词 |

**返回值：** 模型的文本响应。具体内容取决于你的 prompt——可能是描述、JSON、对比结果等。

**可复现示例：**

单图 OCR（提取文字）：
```json
{ "image_paths": ["/abs/path/to/screenshot.png"], "prompt": "提取截图中的所有可见文字。保持从上到下、从左到右的阅读顺序。只返回提取的文字，不要加任何解释。" }
```

多图对比（找差异）：
```json
{ "image_paths": ["/abs/path/to/v1.png", "/abs/path/to/v2.png"], "prompt": "逐像素比较这两张 UI 设计。列出所有视觉差异：布局变化、颜色变化、文字改动、间距差异、新增或删除的元素。具体说明每个差异出现的位置。" }
```

结构化提取（表单转 JSON）：
```json
{ "image_paths": ["/abs/path/to/form.jpg"], "prompt": "将表单中的可见字段提取为 JSON 对象。以字段标签作为 key。复选框用 true/false，日期用 YYYY-MM-DD 格式。只返回 JSON。" }
```

多图推理（流程分析）：
```json
{ "image_paths": ["/abs/path/to/1.png", "/abs/path/to/2.png", "/abs/path/to/3.png"], "prompt": "这三张截图展示了一个用户操作流程的顺序步骤。请对每一步：（1）描述屏幕上的内容，（2）指出用户做了什么操作才到达下一步，（3）标注任何异常或意外行为。最后总结完整流程。" }
```

不传 prompt 时，工具会发送默认提示词要求模型综合描述图片内容、文字、对象、颜色、布局和跨图关系。

**提示词书写技巧：**
- **明确输出格式。** "返回 JSON"或"每行列一个差异"比开放式提问效果更好。
- **OCR 时指定阅读顺序。** "从上到下、从左到右"有助于保留原始版面。
- **对比时要求标注位置。** "说明每个差异出现的具体位置"让结果可用。
- **多图时描述关系。** "这是前后对比截图"或"这是顺序步骤"给模型提供推理上下文。

---

### 支持的图片格式

| 扩展名 | MIME 类型 | 说明 |
| --- | --- | --- |
| .png | image/png | 最适合截图和 UI——无损压缩，支持透明 |
| .jpg / .jpeg | image/jpeg | 最适合照片——文件小，有损压缩 |
| .webp | image/webp | 现代格式，照片和图形都适用 |
| .gif | image/gif | 支持动画（大多数视觉模型只看第一帧） |
| .bmp | image/bmp | 未压缩——文件大，除非别无选择否则避免使用 |

SVG、PDF、TIFF、HEIC 不支持。请先转换为 PNG 再发送。

---

### 从 v1.0.0 升级

1. 下载或克隆 v1.1.0 到新目录（保留旧版本作为备份）
2. 执行 `npm install`
3. 将 MCP 配置中的 args 路径改为 v1.1.0 的 index.js
4. 保留原有环境变量，或按需更新
5. 替换旧工具调用：

| v1.0.0 调用方式 | v1.1.0 等价方式 |
| --- | --- |
| analyze_image + image_path | process_images + image_paths: ["..."] |
| compare_images + 两张路径 | process_images + 两张路径 + 对比提示词 |

6. 重启 Claude Code
7. 执行 `claude mcp list`，确认 vision-relay 为 Connected

**注意破坏性变更：**
- 参数名变了：`image_path`（单数）→ `image_paths`（复数数组）
- 对比需要显式提示词：以前用 compare_images 自动对比，现在需要在 prompt 中明确说明
- 工具名变了：analyze_image 和 compare_images 不再存在，只有 process_images

---

### 安全说明

- **不要提交真实 API key** — .env.example 只是参考模板，实际 key 应放在 MCP 配置的 `env` 块中
- **不要把密钥写进** index.js、README 或任何提交到版本控制的文件 — 服务端只从 process.env 读取，代码中没有任何硬编码的默认 key
- **推荐使用 MCP 配置的 `env` 块**，这是最简单也最安全的方式。值保存在你的本地配置文件中，只作为 HTTP 头发送给你配置的接口
- 如果密钥曾出现在聊天、日志、截图或公开仓库中，**应立即轮换**
- 服务器**仅**向 VISION_BASE_URL 发起 HTTPS 请求，不连接任何分析服务、更新服务器或其他主机
- 图片在内存中处理，编码后发送，不写入磁盘
- 每次调用都是无状态的，结果返回后立即丢弃，不做缓存

---

### 常见问题

#### 诊断清单

在逐一排查之前，先快速检查：

```bash
# 1. Node.js 是否安装且版本够新？
node --version  # 应 ≥ 18.0.0

# 2. 服务文件是否存在且语法正确？
node --check /path/to/vision-relay-mcp/index.js

# 3. 手动启动服务是否报错？（按 Ctrl+C 停止）
node /path/to/vision-relay-mcp/index.js

# 4. 环境变量是否已设置？
# 在 Claude Code 中：检查 MCP 配置的 "env" 块
```

#### 常见问题

| 现象 | 可能原因 | 排查步骤 |
| --- | --- | --- |
| claude mcp list 看不到服务 | 路径或配置问题 | 1. 确认 node --version ≥ 18<br>2. 检查 args 路径是否为绝对路径且指向 index.js<br>3. 确认 MCP 配置 JSON 无语法错误 |
| 显示 Disconnected | 服务启动即崩溃 | 1. 手动执行 node index.js 查看错误<br>2. 常见原因：未安装依赖、Node 版本过低<br>3. 如提示找不到 @modelcontextprotocol/sdk，重新 npm install |
| 提示缺少环境变量 | 配置不完整 | 1. 确认 VISION_API_KEY、VISION_BASE_URL、VISION_MODEL 三个必填项都已设置<br>2. 变量名大小写敏感，需严格匹配 |
| API 返回 401 / 403 | 认证失败 | 1. 验证 API key 正确且未过期<br>2. 确认该 key 有权限访问你指定的模型<br>3. 确认 VISION_PROVIDER 与接口认证格式匹配 |
| API 返回 404 | URL 或模型名错误 | 1. 检查 VISION_BASE_URL 是否正确<br>2. 确认模型名在接口上存在<br>3. 验证自动补全后的完整路径是否正确 |
| API 返回其他 4xx | 请求格式不匹配 | 1. 确认 VISION_PROVIDER 与接口格式一致<br>2. 不确定时尝试切换 anthropic 和 openai |
| API 返回 5xx | 接口服务端错误 | 1. 问题在 API 端，不是 Vision Relay<br>2. 稍等几分钟重试<br>3. 如持续出现，联系接口提供方 |
| "Unsupported image extension" | 文件格式不支持 | 1. 仅支持 png、jpg、jpeg、webp、gif、bmp<br>2. 将不支持的格式（SVG、PDF、HEIC、TIFF）先转为 PNG<br>3. 扩展名检查不区分大小写 |
| "Image is larger than X MB" | 超过大小限制 | 1. 提高 VISION_MAX_IMAGE_SIZE<br>2. 或在发送前压缩图片（建议缩小到约 2000px 宽） |
| 找不到图片 | 路径问题 | 1. 使用绝对路径<br>2. 确认文件在指定路径确实存在<br>3. Windows 下 JSON 中使用双反斜杠：`C:\\Users\\...` |

---

### 项目结构

```
vision-relay-mcp/
├── index.js          # 服务入口（单文件，约 240 行）
├── package.json      # 项目元数据和唯一依赖
├── package-lock.json # 锁定文件，保证可复现安装
├── README.md         # 本文件（英文 + 中文）
├── README.zh-CN.md   # 中文小白部署教程
├── LICENSE           # MIT
├── .env.example      # 环境变量模板（勿填入真实 key）
└── .gitignore        # 忽略 node_modules/、.env、*.log、系统文件
```

---

### 许可证

MIT — 详见 [LICENSE](./LICENSE)。

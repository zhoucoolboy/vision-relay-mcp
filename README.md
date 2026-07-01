# Vision Relay MCP

![Version](https://img.shields.io/badge/version-1.1.0-blue)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)
![License](https://img.shields.io/badge/license-MIT-green)

A local MCP server that gives Claude Code image understanding through a
vision-capable API. It reads local image files, sends them to your configured
vision endpoint, and returns the text response to Claude Code.

This document is bilingual. English is first, Chinese follows.

---

## What It Does

Claude Code cannot view images by itself. Vision Relay MCP bridges local image
files and a vision model:

```text
Local image(s) -> Vision Relay MCP -> Vision API -> Text result -> Claude Code
```

Claude Code calls one tool, `process_images`. The server handles file reading,
validation, base64 encoding, API communication, and response extraction.

The server is a single local Node.js file. It does not store images, cache
results, or call any service other than the endpoint you configure.

## Version History

### v1.1.0 Current

v1.1.0 is a single-entry upgrade. It replaces the old `analyze_image` and
`compare_images` tools with one prompt-driven tool: `process_images`.

Upgrade highlights from v0.1.0:

- **One reusable entry point.** v0.1.0 separated single-image analysis and
  two-image comparison into two tools. v1.1.0 uses `process_images` for OCR,
  comparison, screenshot explanation, information extraction, visual Q&A, and
  any other image task the connected model can handle.
- **Prompt-driven behavior.** The task is no longer limited by the tool name.
  Tell the model what you need in `prompt`, such as "extract text",
  "compare these screenshots", or "return structured JSON".
- **Flexible image count.** v0.1.0 accepted one image for `analyze_image` or
  exactly two images for `compare_images`. v1.1.0 accepts one or more image
  paths in the same `image_paths` array.
- **One combined model request.** Multi-image tasks are sent together so the
  model can reason across all images in one context.
- **Concurrent local file reading.** Multiple image files are read with
  `Promise.all()` before the API call, reducing local preparation time for
  multi-image requests.
- **Optional image size guard.** `VISION_MAX_IMAGE_SIZE` can reject oversized
  images before they are sent to the API.
- **Broader endpoint compatibility.** v0.1.0 used the Anthropic Messages
  format. v1.1.0 supports both Anthropic-compatible and OpenAI-compatible
  vision endpoints.
- **More portable documentation.** The setup guide now covers Claude Code CLI,
  `.claude.json`, Windows path escaping, upgrade steps, and privacy guidance.

### v0.1.0 First Version

v0.1.0 exposed two task-specific tools:

- `analyze_image` for one image
- `compare_images` for exactly two images

| Aspect | v0.1.0 | v1.1.0 |
| --- | --- | --- |
| Tools | 2 | 1 |
| Images per call | 1 or exactly 2 | 1 or more |
| Request strategy | Task-specific | Prompt-driven |
| Multi-image handling | Limited to comparison | Any prompt-defined task |
| File reading | Sequential | Concurrent |
| Size limit | None | Optional |
| API formats | Anthropic | Anthropic and OpenAI |
| Setup docs | Basic | Step-by-step bilingual guides |

## Requirements

- Node.js `18.0.0` or newer
- Claude Code or another MCP-compatible client
- A vision-capable API endpoint
- An API key for that endpoint

The model set in `VISION_MODEL` must support image input. A text-only model can
connect successfully, but it will fail when an image is sent.

## Step 1: Install the Project

Clone or download the project, then install dependencies:

```bash
git clone https://github.com/zhoucoolboy/vision-relay-mcp.git
cd vision-relay-mcp
npm install
npm run check
```

`npm run check` runs `node --check index.js`. It validates syntax without
starting the MCP server or making network requests.

There is no build step.

## Step 2: Prepare Configuration Values

All runtime settings are read from environment variables.

| Name | Required | Default | Description |
| --- | --- | --- | --- |
| `VISION_PROVIDER` | No | `anthropic` | `anthropic` or `openai` |
| `VISION_API_KEY` | Yes | none | API key |
| `VISION_BASE_URL` | Yes | none | Base URL for the API |
| `VISION_MODEL` | Yes | none | Vision-capable model name |
| `VISION_MAX_TOKENS` | No | `2000` | Max response tokens |
| `VISION_MAX_IMAGE_SIZE` | No | `0` | Per-image byte limit |

`VISION_API_KEY` takes priority. If it is not set, the server also checks
`ANTHROPIC_API_KEY` and `OPENAI_API_KEY`.

### URL Handling

The server completes provider-specific paths for you.

| Provider | Base URL you set | Added path |
| --- | --- | --- |
| `anthropic` | host or `/v1` | `/v1/messages` |
| `openai` | host or `/v1` | `/v1/chat/completions` |

If `VISION_BASE_URL` already ends with the full request path, it is used as-is.

## Step 3: Add the MCP Server to Claude Code

The easiest and most portable setup is the Claude Code CLI.

### Option A: Claude Code CLI

Run this from the project directory. Replace every placeholder value first.

```bash
claude mcp add -s user vision-relay \
  -e VISION_PROVIDER=anthropic \
  -e VISION_BASE_URL=https://your-relay.example.com \
  -e VISION_MODEL=your-vision-model \
  -e VISION_API_KEY=your_api_key_here \
  -- node /absolute/path/to/vision-relay-mcp/index.js
```

For an OpenAI-compatible endpoint, use:

```bash
claude mcp add -s user vision-relay \
  -e VISION_PROVIDER=openai \
  -e VISION_BASE_URL=https://your-openai-compatible-endpoint.example.com \
  -e VISION_MODEL=your-vision-model \
  -e VISION_API_KEY=your_api_key_here \
  -- node /absolute/path/to/vision-relay-mcp/index.js
```

Windows users can use a Windows absolute path:

```powershell
claude mcp add -s user vision-relay `
  -e VISION_PROVIDER=anthropic `
  -e VISION_BASE_URL=https://your-relay.example.com `
  -e VISION_MODEL=your-vision-model `
  -e VISION_API_KEY=your_api_key_here `
  -- node C:\path\to\vision-relay-mcp\index.js
```

### Option B: Edit `.claude.json`

Claude Code also stores user-level MCP configuration in:

- Windows: `%USERPROFILE%\.claude.json`
- macOS/Linux: `~/.claude.json`

Add a `vision-relay` entry under `mcpServers`. Use an absolute path for
`index.js`.

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

For Windows JSON, escape backslashes:

```json
"args": ["C:\\path\\to\\vision-relay-mcp\\index.js"]
```

## Step 4: Restart and Verify Claude Code

After changing MCP configuration, restart Claude Code.

Verify the connection:

```bash
claude mcp list
```

You should see `vision-relay ... Connected`.

## Step 5: Use `process_images`

### Tool Input

Input:

```json
{
  "image_paths": ["/absolute/path/to/image.png"],
  "prompt": "Extract all visible text."
}
```

| Field | Required | Type | Description |
| --- | --- | --- | --- |
| `image_paths` | Yes | `string[]` | Absolute image paths |
| `prompt` | No | `string` | Task instruction |

If `prompt` is omitted, the server uses a general image analysis prompt.

### Examples

OCR:

```json
{
  "image_paths": ["/absolute/path/to/screenshot.png"],
  "prompt": "Extract all visible text. Preserve reading order."
}
```

Comparison:

```json
{
  "image_paths": [
    "/absolute/path/to/before.png",
    "/absolute/path/to/after.png"
  ],
  "prompt": "Compare these images and list meaningful differences."
}
```

Structured extraction:

```json
{
  "image_paths": ["/absolute/path/to/form.jpg"],
  "prompt": "Extract visible fields as a JSON object."
}
```

Multi-image sequence:

```json
{
  "image_paths": [
    "/absolute/path/to/step-1.png",
    "/absolute/path/to/step-2.png",
    "/absolute/path/to/step-3.png"
  ],
  "prompt": "These are sequential steps. Describe each step."
}
```

## Supported Image Formats

| Extension | MIME type |
| --- | --- |
| `.png` | `image/png` |
| `.jpg` / `.jpeg` | `image/jpeg` |
| `.webp` | `image/webp` |
| `.gif` | `image/gif` |
| `.bmp` | `image/bmp` |

Other formats, such as SVG, PDF, or HEIC, should be converted first.

## Upgrade From v0.1.0

Download v1.1.0 to a new directory:

```bash
git clone https://github.com/zhoucoolboy/vision-relay-mcp.git vision-relay-mcp-v1.1
cd vision-relay-mcp-v1.1
npm install
```

Then:

1. Update the MCP `args` path to the new `index.js`.
2. Keep your existing endpoint, model, and API key values.
3. Replace old tool usage as shown below.
4. Restart Claude Code.
5. Run `claude mcp list`.

| v0.1.0 | v1.1.0 |
| --- | --- |
| `analyze_image` + `image_path` | `process_images` + `image_paths` |
| `compare_images` + two paths | `process_images` + paths + prompt |

## Security

- Never commit real API keys.
- Keep secrets in the MCP `env` block or a secret manager.
- The server only calls `VISION_BASE_URL`.
- The server does not store images, cache results, or write analysis output.
- Rotate a key immediately if it appears in logs, screenshots, or git history.

## Troubleshooting

Basic checks:

```bash
node --version
node --check index.js
claude mcp list
```

| Symptom | Likely cause | Check |
| --- | --- | --- |
| Not listed | Config path issue | Check `args` and restart Claude Code |
| Disconnected | Startup crash | Run `node index.js` manually |
| Missing env vars | Config incomplete | Check key, base URL, and model |
| API 401 or 403 | Auth failed | Check API key and provider |
| API 404 | Wrong URL or model | Check base URL and model name |
| Format error | Provider mismatch | Switch `VISION_PROVIDER` |
| Unsupported extension | Bad image format | Use png, jpg, webp, gif, or bmp |
| File not found | Path error | Use absolute image paths |
| Image too large | Size limit | Raise limit or compress the image |

## Project Structure

```text
vision-relay-mcp/
├── index.js
├── package.json
├── package-lock.json
├── README.md
├── README.zh-CN.md
├── LICENSE
├── .env.example
└── .gitignore
```

## License

MIT. See [LICENSE](./LICENSE).

---

## 中文说明

`1.1.0` 是 `v0.1.0` 的单入口升级版。

它把旧版的 `analyze_image` 和 `compare_images` 合并为一个 `process_images` 工具。单图、多图、OCR、对比、提取信息等任务都通过同一个入口处理，具体做什么由提示词决定。

### 相比第一版升级了什么

- **入口更统一。** 第一版把单图分析和双图对比分成 `analyze_image`、`compare_images` 两个工具。新版只保留 `process_images`，使用时不用先判断该选哪个工具。
- **任务不再被工具名限制。** 第一版的 `compare_images` 更像专门的图片对比。新版由提示词决定任务，可以做 OCR、截图说明、设计稿对比、表单信息提取、多图流程总结等。
- **图片数量更灵活。** 第一版要么一张图，要么刚好两张图。新版的 `image_paths` 是数组，可以传一张，也可以传多张。
- **多图放在同一次模型请求里。** 新版会把多张图片一起交给模型，让模型在同一上下文里理解图片之间的关系。
- **本地读图改为并发。** 多张图片会先并发读取和编码，再统一请求接口，多图场景下准备速度更好。
- **增加图片大小保护。** 可以通过 `VISION_MAX_IMAGE_SIZE` 设置单图大小上限，避免过大的图片直接发到接口。
- **接口兼容范围更广。** 第一版主要面向 Anthropic Messages 格式。\
  新版支持 `anthropic` 和 `openai` 两种 provider，\
  能接 Anthropic 兼容接口，也能接 OpenAI Chat Completions 兼容接口。
- **文档更适合复现部署。** 新版补充了 Claude Code CLI、`.claude.json`、Windows 路径转义、升级步骤、常见问题和隐私注意事项。

### 项目简介

Claude Code 不能直接看图片。Vision Relay MCP 是本地图片和视觉模型之间的桥梁：

```text
本地图片 -> Vision Relay MCP -> 视觉模型 API -> 文本结果 -> Claude Code
```

Claude Code 调用 `process_images`，服务负责读取图片、校验格式、base64 编码、调用接口并返回文本结果。

服务是本地单文件实现，不存储图片、不缓存结果，也不会调用你配置之外的服务。

### 运行要求

- Node.js `18.0.0` 或更高版本
- Claude Code 或其他 MCP 客户端
- 支持图片输入的视觉模型接口
- 这个接口的 API key

`VISION_MODEL` 必须是支持图片输入的模型。纯文本模型不能识图。

### 第 1 步：安装项目

```bash
git clone https://github.com/zhoucoolboy/vision-relay-mcp.git
cd vision-relay-mcp
npm install
npm run check
```

`npm run check` 只检查语法，不会启动服务，也不会发起网络请求。

### 第 2 步：准备配置项

所有配置都通过环境变量传入。

| 名称 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `VISION_PROVIDER` | 否 | `anthropic` | `anthropic` 或 `openai` |
| `VISION_API_KEY` | 是 | 无 | API key |
| `VISION_BASE_URL` | 是 | 无 | 接口基础地址 |
| `VISION_MODEL` | 是 | 无 | 支持图片输入的模型名 |
| `VISION_MAX_TOKENS` | 否 | `2000` | 最大返回 token |
| `VISION_MAX_IMAGE_SIZE` | 否 | `0` | 单图大小上限 |

API key 回退顺序：

```text
VISION_API_KEY -> ANTHROPIC_API_KEY -> OPENAI_API_KEY
```

### 第 3 步：添加 Claude Code MCP 配置

推荐使用 Claude Code CLI：

```bash
claude mcp add -s user vision-relay \
  -e VISION_PROVIDER=anthropic \
  -e VISION_BASE_URL=https://your-relay.example.com \
  -e VISION_MODEL=your-vision-model \
  -e VISION_API_KEY=your_api_key_here \
  -- node /absolute/path/to/vision-relay-mcp/index.js
```

Windows PowerShell 示例：

```powershell
claude mcp add -s user vision-relay `
  -e VISION_PROVIDER=anthropic `
  -e VISION_BASE_URL=https://your-relay.example.com `
  -e VISION_MODEL=your-vision-model `
  -e VISION_API_KEY=your_api_key_here `
  -- node C:\path\to\vision-relay-mcp\index.js
```

也可以直接编辑 Claude Code 用户级配置文件：

- Windows: `%USERPROFILE%\.claude.json`
- macOS/Linux: `~/.claude.json`

示例：

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

Windows JSON 路径需要转义反斜杠：

```json
"args": ["C:\\path\\to\\vision-relay-mcp\\index.js"]
```

### 第 4 步：重启并验证 Claude Code

保存后重启 Claude Code，再执行：

```bash
claude mcp list
```

看到 `vision-relay ... Connected` 就说明 MCP 已启动。

### 第 5 步：开始使用

在 Claude Code 里直接说明图片路径和任务即可。

单图 OCR：

```text
请调用 vision-relay 分析这张截图，并提取所有文字：
C:\path\to\screenshot.png
```

多图对比：

```text
请调用 vision-relay 对比这两张设计稿：
C:\path\to\before.png
C:\path\to\after.png
```

结构化提取：

```text
请调用 vision-relay 读取这张表单图片，并整理成 JSON：
C:\path\to\form.jpg
```

底层工具输入格式：

```json
{
  "image_paths": [
    "/absolute/path/to/image-1.png",
    "/absolute/path/to/image-2.jpg"
  ],
  "prompt": "比较这些图片，并提取可见文字。"
}
```

如果不传 `prompt`，工具会使用默认提示词，让模型综合分析图片内容、文字、对象、颜色、布局和多图关系。

### 从 v0.1.0 升级

1. 下载 v1.1.0 到新目录。
2. 执行 `npm install`。
3. 把 MCP 配置里的 `args` 改成新版 `index.js` 路径。
4. 保留原来的接口地址、模型名和 API key。
5. 重启 Claude Code。
6. 执行 `claude mcp list`。

旧版和新版对应关系：

| v0.1.0 | v1.1.0 |
| --- | --- |
| `analyze_image` + 单张路径 | `process_images` + `image_paths` |
| `compare_images` + 两张路径 | `process_images` + 两张路径 + 提示词 |

### 常见问题

| 现象 | 常见原因 | 处理 |
| --- | --- | --- |
| 服务不显示 | 配置没加载 | 检查 `.claude.json` 并重启 |
| Disconnected | 启动失败 | 手动运行 `node index.js` |
| 缺少环境变量 | env 不完整 | 检查 key、base URL、model |
| API 401/403 | 认证失败 | 检查 API key |
| API 404 | 地址或模型错误 | 检查 base URL 和模型名 |
| 格式错误 | provider 不匹配 | 切换 `VISION_PROVIDER` |
| 找不到文件 | 图片路径错误 | 使用绝对路径 |
| 图片过大 | 超过大小限制 | 压缩图片或提高限制 |

### 安全说明

- 不要把真实 API key 写进代码、README、截图或聊天记录。
- 项目只会访问你配置的 `VISION_BASE_URL`。
- 如果 key 泄露，应立即轮换。

### 一句话总结

```text
Claude Code 负责对话和写代码
Vision Relay MCP 负责把图片交给视觉模型
视觉模型返回文字结果
Claude Code 继续处理你的任务
```

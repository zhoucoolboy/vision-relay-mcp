# Vision Relay MCP 小白使用教程

![Version](https://img.shields.io/badge/version-1.1.0-blue)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)
![License](https://img.shields.io/badge/license-MIT-green)

这是 vision-relay-mcp 的零基础部署教程，对应版本 1.1.0。完整的技术参考文档（含英文说明）见 [README.md](./README.md)。

---

## 这个项目是干什么的？

Claude Code 本身只能处理文字，**不能直接看图片**。当你想让它读取截图里的报错信息、对比两张设计稿、从扫描件提取字段、或者问它照片里有什么，就需要一个"翻译官"把图片交给视觉模型处理。

vision-relay-mcp 就是这个翻译官：

```
你的本地图片  →  Vision Relay MCP  →  视觉模型 API  →  文字结果  →  Claude Code
```

### 几个真实场景

| 场景 | 没有它 | 有了它 |
|------|--------|--------|
| "这张报错截图写了什么？" | 你手动敲出来 | Claude 直接读 |
| "对比这两张 UI 设计" | 做不到 | Claude 帮你分析差异 |
| "把这张扫描表格转成 JSON" | 手动誊写 | 自动输出结构化数据 |
| "这张照片里有什么？" | 做不到 | Claude 完整描述 |
| "把这三张流程截图串起来分析" | 做不到 | 一次搞定 |

### v1.1.0 和第一版的区别

第一版把"单图分析"（analyze_image）和"双图对比"（compare_images）拆成两个独立工具。但本质上它们做的是同一件事——发图片 + 给提示词。v1.1.0 合并为一个 process_images，一张图也好、十张图也好，全走同一个入口，做什么由你的提示词决定，而不是由工具名决定。

| | 第一版 | v1.1.0 |
|---|--------|--------|
| 工具数 | 2 个 | 1 个 |
| 一次能发几张 | 1 张或刚好 2 张 | 1 张起，不限 |
| 多张怎么发 | 分开请求 | 合并到一次请求 |
| 支持接口 | 仅 Anthropic | Anthropic + OpenAI 兼容 |

---

## 你需要准备什么

1. **Node.js** 18.0.0 或更高版本 — [下载地址](https://nodejs.org/)。装完后在终端执行 `node --version` 确认版本号。

2. **Claude Code** — [官方文档](https://docs.anthropic.com/en/docs/claude-code)。已经装好 Claude Code 就可以继续。

3. **一个支持图片输入的视觉模型接口**。可以是：
   - Anthropic 官方 API（需要能访问 anthropic.com）
   - OpenAI 官方 API（需要能访问 api.openai.com）
   - 任何兼容 Anthropic Messages 或 OpenAI Chat Completions 格式的中转服务

4. **这个接口的 API key**。通常是一串以 `sk-` 开头的字符。

5. **本项目代码**。下一步会告诉你怎么获取。

> ⚠️ 注意：VISION_MODEL 一定要填支持图片输入的模型。纯文本模型拿来识图会失败——API 请求本身会成功，但模型收到图片后不知道该怎么处理。

---

## 第 1 步：安装项目

打开终端（Windows 用 PowerShell 或 CMD，macOS/Linux 用终端）。

**进入项目目录：**

```bash
cd /path/to/vision-relay-mcp
```

Windows 示例：
```powershell
cd C:\Users\你的用户名\vision-relay-mcp
```

**安装依赖（只有 1 个包，大约 5 秒完成）：**

```bash
npm install
```

**验证代码能正常解析：**

```bash
npm run check
```

没有报错就 OK。这条命令只检查 JavaScript 语法，不会启动服务。

---

## 第 2 步：确认配置项

这个项目通过**环境变量**读取配置，没有配置文件，也没有网页管理后台。你需要搞清楚以下信息：

### 必填项（缺一不可）

| 名称 | 作用 | 怎么填 |
| --- | --- | --- |
| VISION_API_KEY | 你的 API 密钥 | 接口提供方会给你的 key，通常以 `sk-` 开头 |
| VISION_BASE_URL | 接口地址 | 如果用的中转服务，填服务商给你的地址。如果是官方 API，填 `https://api.anthropic.com` 或 `https://api.openai.com` |
| VISION_MODEL | 视觉模型名 | 必须支持图片输入。例如 `claude-sonnet-4-6`、`gpt-4o`，或中转服务提供的模型名 |

### 选填项（不改也能用）

| 名称 | 默认值 | 作用 |
| --- | --- | --- |
| VISION_PROVIDER | anthropic | 接口格式。填 `anthropic` 或 `openai`。不确定的话保持默认 |
| VISION_MAX_TOKENS | 2000 | 模型返回文本的最大长度。2000 字足够大多数场景 |
| VISION_MAX_IMAGE_SIZE | 0（不限制） | 单张图片大小上限，单位是字节。比如 `5242880` = 5MB |

### URL 自动补全规则

你不需要写完整的 API 路径，服务器会自动帮你补：

| 接口类型 | 你填的地址 | 实际请求的地址 |
| --- | --- | --- |
| Anthropic | `https://api.example.com` | `https://api.example.com/v1/messages` |
| Anthropic | `https://api.example.com/v1` | `https://api.example.com/v1/messages` |
| OpenAI | `https://api.example.com` | `https://api.example.com/v1/chat/completions` |
| OpenAI | `https://api.example.com/v1` | `https://api.example.com/v1/chat/completions` |

如果你已经填了完整路径（比如末尾带 `/v1/messages`），服务器就直接用，不再追加。

### API key 回退机制

如果没有设置 VISION_API_KEY，服务器会自动尝试读取：
- ANTHROPIC_API_KEY（当 VISION_PROVIDER 为 anthropic 时）
- OPENAI_API_KEY（当 VISION_PROVIDER 为 openai 时）

> 🔒 不要把 API key 写进代码、README、或截图里！放在 MCP 配置的 env 块中最安全。万一泄露了，第一时间去接口提供方那里重置 key。

---

## 第 3 步：配置 Claude Code

### 配置文件在哪？

Claude Code 的 MCP 配置有两个位置：

- **用户级**（所有项目生效）：
  - macOS: `~/.claude/claude_desktop_config.json`
  - Windows: `C:\Users\你的用户名\.claude\claude_desktop_config.json`
  - 也可以用命令添加：`claude mcp add-json`

- **项目级**（只对当前项目生效）：项目根目录下的 `.claude/settings.json`

项目级的配置优先级更高。

### Anthropic 兼容接口

如果你的接口是 Anthropic Messages API 格式，用这个配置：

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

### OpenAI 兼容接口

如果你的接口是 OpenAI Chat Completions 格式，用这个配置：

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

### 路径怎么写

**args 路径必须是绝对路径。** 相对路径很可能会出错，因为 MCP 服务启动时的工作目录不确定。

Windows：
```json
"args": ["C:\\Users\\你的用户名\\vision-relay-mcp\\index.js"]
```

macOS / Linux：
```json
"args": ["/Users/你的用户名/vision-relay-mcp/index.js"]
```

修改完配置文件后，**一定要重启 Claude Code**（MCP 服务列表只在启动时加载）。

---

## 第 4 步：检查是否连接成功

在 Claude Code 中执行：

```bash
claude mcp list
```

如果看到类似：
```text
vision-relay ... Connected
```

说明 Claude Code 已经能启动这个 MCP 服务了。

> ⚠️ Connected 只代表 MCP 服务本身能启动，**不代表**你的接口地址、模型名、API key 一定正确。真正识图的时候才会实际调用接口。如果调用时报错，请看[常见问题](#常见问题)。

### 快速诊断

如果连接不成功，先跑以下检查：

```bash
# 1. Node.js 版本够不够？
node --version  # 应该 ≥ 18.0.0

# 2. 服务文件语法有没有问题？
node --check /path/to/vision-relay-mcp/index.js

# 3. 手动启动会不会报错？（按 Ctrl+C 停止）
node /path/to/vision-relay-mcp/index.js
```

---

## 第 5 步：怎么使用

把图片放在本机任意位置，然后在 Claude Code 里直接描述你的需求即可。

### 看懂一张图

```
帮我看看这张截图里有什么文字：C:\Users\你\screenshot.png
```

### 对比两张图

```
帮我对比这两张设计稿的差异，列出所有视觉变化：
C:\Users\你\design-v1.png
C:\Users\你\design-v2.png
```

### 从图片提取结构化数据

```
读取这张表单图片，把字段整理成 JSON。用字段标签作为 key，日期用 YYYY-MM-DD 格式：
C:\Users\你\form.jpg
```

### 多图推理

```
这三张截图是一个操作流程的步骤，帮我描述每一步在做什么，以及步骤之间如何衔接：
C:\Users\你\step1.png
C:\Users\你\step2.png
C:\Users\你\step3.png
```

### Claude Code 实际调用的是什么？

当你对 Claude Code 说"帮我看看这张图"时，Claude Code 实际通过 MCP 协议调用 process_images 工具，发送的 JSON 格式如下：

```json
{
  "image_paths": ["/absolute/path/to/image.png"],
  "prompt": "提取所有可见文字，保持阅读顺序。"
}
```

两个参数：
- **image_paths** — 图片路径数组，必须是绝对路径。支持同时传多张
- **prompt** — 你要对图片做什么。不传的话工具会用默认提示词，做综合分析（描述、文字提取、对象识别、布局分析、多图关系）

### 提示词书写技巧

- **说清楚输出格式。** "返回 JSON"或"每行列一个差异"比"帮我看看"效果好得多
- **OCR 时指定顺序。** "从上到下、从左到右"帮助模型保留原文版面
- **对比时要求标位置。** "说明每个差异在图片中的位置"让结果更实用
- **多图时说明关系。** "这是前后对比"或"这是操作步骤"给模型推理上下文

### 支持的图片格式

png、jpg / jpeg、webp、gif、bmp

不支持 SVG、PDF、HEIC、TIFF。需要先转换成 PNG 再发送。

---

## 从第一版升级到 v1.1.0

第一版有两个工具入口：
```
analyze_image     → 单图分析
compare_images    → 双图对比
```

v1.1.0 合并为一个：
```
process_images    → 统一入口，单图多图都走这
```

### 升级步骤

1. 下载或克隆 v1.1.0 项目（建议放在新目录，保留旧版本做备份）
2. 在项目目录执行 `npm install`
3. 把 MCP 配置里的 index.js 路径改成 v1.1.0 的
4. 保留原来的接口地址、模型名和 API key（或按需更新）
5. 替换旧工具调用方式（见下表）
6. 重启 Claude Code
7. 执行 `claude mcp list`，确认 vision-relay 是 Connected

### 旧调用 → 新调用

| 第一版 | v1.1.0 |
| --- | --- |
| analyze_image + image_path: "路径" | process_images + image_paths: ["路径"] |
| compare_images + 两张路径 | process_images + 两张路径 + 对比提示词 |

### 注意破坏性变更

- **参数名变了**：`image_path`（单数）→ `image_paths`（复数数组）
- **对比需要显式提示词**：以前用 compare_images 自动对比，现在需要在 prompt 里明确说要对比
- **工具名变了**：analyze_image 和 compare_images 已不再存在

---

## 常见问题

### 1. 为什么显示 Connected，但识图失败？

Connected 只说明 MCP 服务成功启动了。识图失败通常是以下原因：

- VISION_BASE_URL 地址不对 — 检查地址拼写，可以用浏览器或 curl 测试
- VISION_API_KEY 不正确或已过期 — 去接口提供方确认 key 的状态
- VISION_MODEL 不是视觉模型 — 确认模型名支持图片输入
- VISION_PROVIDER 和接口实际格式不匹配 — 不确定时先试 `anthropic`，不行再换 `openai`
- 图片路径不存在或打不开 — 确认是绝对路径且文件确实在那里
- 图片格式不支持 — 只支持 png、jpg/jpeg、webp、gif、bmp

如果排查完还是不工作，在终端手动执行 `node index.js` 看报错信息，通常会直接告诉你哪里出了问题。

### 2. Anthropic 和 OpenAI provider 怎么选？

- 接口文档说是 Anthropic Messages 格式 → VISION_PROVIDER=anthropic
- 接口文档说是 OpenAI Chat Completions 格式 → VISION_PROVIDER=openai
- 不确定 → 先试 anthropic（默认值），不行再换 openai

两个格式的主要区别在于图片在 HTTP 请求体中的编码方式：
- Anthropic 格式：图片作为 `type: "image"` 的 content block，含 `media_type` 和 base64 数据
- OpenAI 格式：图片作为 `type: "image_url"` 的 content block，使用 data URL 格式

OpenAI 兼容接口的 VISION_BASE_URL 通常带 `/v1`，如 `https://api.example.com/v1`。

### 3. 为什么图片路径必须用绝对路径？

MCP 服务的工作目录不是你当前的项目目录，也不是 Claude Code 的工作目录。用相对路径的话，服务会从它的启动目录去找文件，几乎肯定找不到。绝对路径最稳，排查问题也最简单。

### 4. API key 放哪里最安全？

放在 Claude Code 的 MCP 配置的 `env` 块里最方便也最安全。不要写进 index.js、README、或 .env.example 里。万一 key 泄露了（出现在聊天记录、截图、git 历史里），马上去接口提供方重置。

### 5. 怎么卸载？

- 如果通过 MCP 配置文件添加的 → 删掉 vision-relay 那段配置，重启 Claude Code
- 如果通过 CLI 添加的 → 执行 `claude mcp remove vision-relay -s user`
- 最后删除项目文件夹即可

### 6. 服务的工作原理是什么？

服务端的工作流程：

1. 收到 MCP 请求 → 2. 并发读取所有图片文件 → 3. 校验格式和大小 → 4. base64 编码 → 5. 根据 VISION_PROVIDER 构造对应的 HTTP 请求体 → 6. 发送到 VISION_BASE_URL → 7. 将模型返回的文本通过 MCP 返回给 Claude Code

全部代码在 index.js 一个文件中（约 240 行），你可以直接用任何编辑器打开阅读。

### 7. 一张图片最大能多大？

默认不限制。如果你的 API 接口有大小限制，通过 VISION_MAX_IMAGE_SIZE 设置上限。常用值：
- `5242880`（5 MB）— 大多数 API 网关的限制
- `20971520`（20 MB）— 足够覆盖大多数截图和高清照片

超过限制时，服务器会返回明确的错误提示，而不是发送一个注定失败的请求。

---

## 项目文件说明

```
vision-relay-mcp/
├── index.js          # 核心代码（只有一个文件，约 240 行）
├── package.json      # 项目信息，唯一依赖 @modelcontextprotocol/sdk
├── package-lock.json # 锁定依赖版本，保证可复现
├── README.md         # 完整技术文档（英文 + 中文）
├── README.zh-CN.md   # 本文件（小白教程）
├── LICENSE           # MIT 许可证
├── .env.example      # 环境变量示例模板（不要填真实 key）
└── .gitignore        # Git 忽略规则
```

---

## 一句话总结

```
Claude Code   →   负责对话和写代码
Vision Relay  →   负责把图片交给视觉模型（base64 编码 + API 调用）
视觉模型      →   负责"看懂"图片并返回文字
Claude Code   →   拿到文字后继续帮你处理
```

v1.1.0 的核心变化：**不再区分"单图分析"和"多图对比"，统一走 process_images，由提示词决定做什么。**

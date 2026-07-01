# Vision Relay MCP 小白使用教程

![Version](https://img.shields.io/badge/version-1.1.0-blue)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)
![License](https://img.shields.io/badge/license-MIT-green)

这是 `vision-relay-mcp` 的零基础部署教程，对应版本 `1.1.0`。

## 这个项目是干什么的？

Claude Code 本身只能处理文字，**不能直接看图片**。这个项目充当一个"翻译官"——

```
你的本地图片  →  Vision Relay MCP  →  视觉模型 API  →  文字结果  →  Claude Code
```

具体流程：

1. 你在 Claude Code 中说"帮我看看这张截图"
2. Claude Code 通过 MCP 协议调用 `process_images` 工具
3. Vision Relay 读取你的图片文件，编码后发送给你配置的视觉模型
4. 视觉模型"看懂"图片，返回文字描述
5. Claude Code 拿到文字，继续帮你处理

整个过程对你是透明的——你只需要配置一次，之后就像和能"看"图的 Claude Code 对话一样。

### 第一版 vs v1.1.0

第一版有两个工具（`analyze_image` 和 `compare_images`），一个管单图、一个管对比。其实本质上都是"发图片 + 给提示词"，没必要拆开。

v1.1.0 合并为一个 `process_images`，一张图也好、十张图也好，全走同一个入口，具体做什么由你的提示词决定。

| | 第一版 | v1.1.0 |
|---|--------|--------|
| 工具数 | 2 个 | 1 个 |
| 一次能发几张 | 1 张或刚好 2 张 | 1 张起，不限 |
| 多张怎么发 | 分开多次请求 | 合并到一次请求 |

## 你需要准备什么

1. **Node.js** `18.0.0` 或更高版本（[下载地址](https://nodejs.org/)）
2. **Claude Code**（[官方文档](https://docs.anthropic.com/en/docs/claude-code)）
3. 一个**支持图片输入的视觉模型接口**
4. 这个接口的 **API key**
5. 本项目代码

> ⚠️ 注意：`VISION_MODEL` 一定要填支持图片输入的模型。纯文本模型拿来识图会失败。

## 第 1 步：安装项目

打开终端（Windows 用 PowerShell 或 CMD，macOS/Linux 用终端），执行：

```bash
# 进入项目目录（路径换成你自己的）
cd /path/to/vision-relay-mcp
```

Windows 示例：
```powershell
cd C:\Users\你的用户名\vision-relay-mcp
```

安装依赖（只有 1 个包，很快）：
```bash
npm install
```

验证代码没问题：
```bash
npm run check
```

没有报错就说明 OK。

## 第 2 步：确认配置项

这个项目通过**环境变量**读取配置，没有配置文件。你需要搞清楚以下信息：

| 名称 | 必填 | 作用 | 示例值 |
| --- | --- | --- | --- |
| `VISION_PROVIDER` | 否 | 接口类型 | `anthropic` 或 `openai` |
| `VISION_API_KEY` | 是 | 你的 API key | `sk-abc123...` |
| `VISION_BASE_URL` | 是 | 接口地址 | `https://api.example.com` |
| `VISION_MODEL` | 是 | 视觉模型名 | `claude-fable-5` 等 |
| `VISION_MAX_TOKENS` | 否 | 最大返回长度 | 默认 `2000` |
| `VISION_MAX_IMAGE_SIZE` | 否 | 单图大小上限 | `0` 表示不限制 |

### URL 自动补全规则

你不需要手动写全路径，服务器会自动补：

| 接口类型 | 你填的地址 | 实际请求地址 |
| --- | --- | --- |
| Anthropic | `https://api.example.com` | `https://api.example.com/v1/messages` |
| OpenAI | `https://api.example.com` | `https://api.example.com/v1/chat/completions` |

如果你已经填了完整路径（比如末尾带 `/v1/messages`），服务器就直接用，不再补。

> 🔒 **不要把 API key 写进代码或 README 里！** 放在 MCP 配置的 `env` 块中最安全。

## 第 3 步：配置 Claude Code

把以下配置加入 Claude Code 的 MCP 设置中。**示例里的路径、地址、模型名和 key 全都要换成你自己的！**

### Anthropic 兼容接口

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

### OpenAI 兼容接口

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

### 不同系统的路径写法

**Windows：**
```json
"args": ["C:\\Users\\你的用户名\\vision-relay-mcp\\index.js"]
```

**macOS / Linux：**
```json
"args": ["/Users/你的用户名/vision-relay-mcp/index.js"]
```

配置完成后，**重启 Claude Code**。

## 第 4 步：检查是否连接成功

在 Claude Code 中执行：
```bash
claude mcp list
```

如果看到：
```text
vision-relay ... Connected
```

说明 Claude Code 已经能启动这个 MCP 了。

> ⚠️ `Connected` 只代表 MCP 服务本身能启动，**不代表**你的接口地址、模型名、API key 一定正确。真正识图的时候才会实际调用接口。

## 第 5 步：怎么使用

把图片放在本机任意位置，然后在 Claude Code 里直接描述需求即可。

### 看懂一张图

```
帮我看看这张截图里有什么文字：C:\Users\你\screenshot.png
```

### 对比两张图

```
帮我对比这两张设计稿的差异：
C:\Users\你\design-v1.png
C:\Users\你\design-v2.png
```

### 从图片提取结构化数据

```
读取这张表单图片，把字段整理成 JSON：
C:\Users\你\form.jpg
```

### 多图推理

```
这三张截图是一个操作流程的步骤，帮我描述每一步在做什么：
C:\Users\你\step1.png
C:\Users\你\step2.png
C:\Users\你\step3.png
```

### 底层格式（供参考）

工具实际接收的 JSON 格式是：

```json
{
  "image_paths": [
    "/absolute/path/to/image-1.png",
    "/absolute/path/to/image-2.jpg"
  ],
  "prompt": "比较这些图片，并提取可见文字。"
}
```

- `image_paths`：图片路径数组，支持同时传多张
- `prompt`：你要对图片做什么。不传的话会用默认提示词做综合分析

### 支持的图片格式

png、jpg / jpeg、webp、gif、bmp

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

1. 下载或克隆 v1.1.0 项目。
2. 在项目目录执行 `npm install`。
3. 把 MCP 配置里的 `index.js` 路径改成 v1.1.0 的。
4. 保留原来的接口地址、模型名和 API key（或按需更新）。
5. 重启 Claude Code。
6. 执行 `claude mcp list`，确认 `vision-relay` 是 `Connected`。

### 旧调用 → 新调用

| 第一版 | v1.1.0 |
| --- | --- |
| `analyze_image` + 单张路径 | `process_images` + `image_paths: ["图片路径"]` |
| `compare_images` + 两张路径 | `process_images` + 两张路径 + 对比提示词 |

## 常见问题

### 1. 为什么显示 Connected，但识图失败？

`Connected` 只说明 MCP 服务成功启动。识图失败通常是这些原因：

- `VISION_BASE_URL` 地址不对
- `VISION_API_KEY` 不正确或已过期
- `VISION_MODEL` 不是视觉模型（填了纯文本模型）
- `VISION_PROVIDER` 和接口实际格式不匹配
- 图片路径不存在或格式不支持

### 2. Anthropic 和 OpenAI provider 怎么选？

看你的接口是什么格式：

- Anthropic Messages API 格式 → `VISION_PROVIDER=anthropic`
- OpenAI Chat Completions 格式 → `VISION_PROVIDER=openai`

不确定的话可以问接口提供方，或者两个都试一下。

OpenAI 兼容接口的 `VISION_BASE_URL` 通常带 `/v1`，如：
```
https://api.example.com/v1
```

### 3. 为什么图片路径必须用绝对路径？

MCP 服务的工作目录不是你当前的项目目录。用绝对路径最稳，不会出现"找不到文件"的问题。

### 4. API key 放哪里最安全？

放在 Claude Code 的 MCP 配置的 `env` 块里最方便也最安全。不要写进 `index.js`、README、或 `.env.example`。

### 5. 怎么卸载？

- 如果通过 MCP 配置文件添加的 → 删掉 `vision-relay` 那段配置，重启 Claude Code
- 如果通过 CLI 添加的 → 执行 `claude mcp remove vision-relay -s user`
- 最后删除项目文件夹即可

## 项目文件说明

```
vision-relay-mcp/
├── index.js          # 核心代码（只有一个文件）
├── package.json      # 项目信息
├── README.md         # 完整技术文档（英文 + 中文）
├── README.zh-CN.md   # 本文件（小白教程）
├── LICENSE           # MIT 许可证
├── .env.example      # 环境变量示例（不是真实配置）
└── .gitignore        # Git 忽略规则
```

## 一句话总结

```
Claude Code   →   负责对话和写代码
Vision Relay  →   负责把图片交给视觉模型
视觉模型      →   负责"看懂"图片并返回文字
Claude Code   →   拿到文字后继续帮你处理
```

v1.1.0 的核心变化：**不再区分"单图分析"和"多图对比"，统一走 `process_images`，由提示词决定做什么。**

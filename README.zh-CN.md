# Vision Relay MCP 小白使用教程

![Version](https://img.shields.io/badge/version-1.1.0-blue)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)
![License](https://img.shields.io/badge/license-MIT-green)

这是 `vision-relay-mcp` 的零基础部署教程，对应版本 `1.1.0`。

完整中英文说明见 [README.md](./README.md)。

## 这个项目是做什么的

Claude Code 不能直接看图片。这个项目负责把你的本地图片交给视觉模型，
再把视觉模型返回的文字结果交回 Claude Code。

```text
本地图片 -> Vision Relay MCP -> 视觉模型 API -> 文字结果 -> Claude Code
```

v1.1.0 只有一个工具入口：

```text
process_images
```

单图、多图、OCR、对比、截图总结、信息提取都走这个入口。

## v0.1.0 和 v1.1.0 的区别

v0.1.0 有两个工具：`analyze_image` 和 `compare_images`。
v1.1.0 合并为一个工具：`process_images`。

这次升级的核心不是“多加了一个功能”，而是把图片处理方式改成更通用的入口：
你只需要给图片路径，再告诉模型你想做什么。对比、OCR、截图解释、表格提取、
多图流程总结，都由同一个工具交给视觉模型处理。

主要升级点：

1. **入口从两个变成一个。** 第一版要区分 `analyze_image` 和
   `compare_images`。新版只有 `process_images`，单图、多图、对比、提取信息都
   走同一个入口。
2. **任务由提示词决定。** 第一版的工具名已经固定了用途，比如
   `compare_images` 主要就是图片对比。新版会把你的 prompt 一起发给视觉模型，
   所以你可以明确要求“提取文字”“比较差异”“整理成 JSON”“按步骤解释截图”。
3. **图片数量更灵活。** 第一版只能单图分析，或者刚好两张图对比。新版的
   `image_paths` 是数组，至少一张图，多张图也可以一次传入。
4. **多图放在一次请求里处理。** 新版会把多张图片放到同一次模型请求中，适合
   对比设计稿、分析连续截图、整理多页表单等场景。
5. **本地读图更快。** 多张图片会并发读取和编码，不再一张一张顺序读。这个优化
   只影响本地准备图片的速度，不限制模型能力。
6. **增加图片大小上限配置。** 如果你的接口对图片大小有限制，可以设置
   `VISION_MAX_IMAGE_SIZE`，让过大的图片在本地就被拦截。
7. **接口兼容更宽。** 第一版主要面向 Anthropic Messages 格式。新版支持
   `anthropic` 和 `openai` 两种 provider，可以接 Anthropic 兼容接口，也可以接
   OpenAI Chat Completions 兼容接口。
8. **文档更完整。** 新版补充了从下载、安装、配置 `.claude.json`、验证连接、
   使用示例到从 v0.1.0 升级的完整步骤，更适合别人照着复现。

| 项目 | v0.1.0 | v1.1.0 |
| --- | --- | --- |
| 工具数 | 2 个 | 1 个 |
| 单次图片数 | 1 张或刚好 2 张 | 1 张起 |
| 任务类型 | 工具名决定 | 提示词决定 |
| 多图用途 | 主要用于双图对比 | 由提示词决定 |
| 文件读取 | 顺序读取 | 并发读取 |
| 图片大小限制 | 无 | 可配置 |
| 接口格式 | Anthropic | Anthropic 和 OpenAI |
| 部署文档 | 基础说明 | 更完整的复现步骤 |

## 你需要准备什么

1. Node.js `18.0.0` 或更高版本
2. Claude Code
3. 支持图片输入的视觉模型接口
4. 这个接口的 API key
5. 本项目代码

注意：`VISION_MODEL` 必须是支持图片输入的模型。纯文本模型不能识图。

## 第 1 步：下载并安装项目

打开终端。Windows 可以使用 PowerShell，macOS/Linux 可以使用系统终端。

```bash
git clone https://github.com/zhoucoolboy/vision-relay-mcp.git
cd vision-relay-mcp
npm install
npm run check
```

`npm run check` 只检查语法，不会启动服务，也不会访问网络。

如果没有报错，说明项目本身可以正常运行。

## 第 2 步：准备配置信息

你需要从接口提供方拿到三项必填信息：

| 名称 | 说明 |
| --- | --- |
| `VISION_API_KEY` | 你的 API key |
| `VISION_BASE_URL` | 视觉接口或中转站基础地址 |
| `VISION_MODEL` | 支持图片输入的模型名 |

还有三个可选项：

| 名称 | 默认值 | 说明 |
| --- | --- | --- |
| `VISION_PROVIDER` | `anthropic` | `anthropic` 或 `openai` |
| `VISION_MAX_TOKENS` | `2000` | 最大返回 token |
| `VISION_MAX_IMAGE_SIZE` | `0` | 单张图片大小上限 |

不要把真实 key 写进代码、README、截图或聊天记录。

## 第 3 步：选择配置方式

推荐使用 Claude Code CLI 添加 MCP。

### 方式 A：使用 Claude Code CLI

```bash
claude mcp add -s user vision-relay \
  -e VISION_PROVIDER=anthropic \
  -e VISION_BASE_URL=https://your-relay.example.com \
  -e VISION_MODEL=your-vision-model \
  -e VISION_API_KEY=your_api_key_here \
  -- node /absolute/path/to/vision-relay-mcp/index.js
```

如果你的接口是 OpenAI 兼容格式，把 provider 改成 `openai`：

```bash
claude mcp add -s user vision-relay \
  -e VISION_PROVIDER=openai \
  -e VISION_BASE_URL=https://your-openai-compatible-endpoint.example.com \
  -e VISION_MODEL=your-vision-model \
  -e VISION_API_KEY=your_api_key_here \
  -- node /absolute/path/to/vision-relay-mcp/index.js
```

### Windows PowerShell 示例

```powershell
claude mcp add -s user vision-relay `
  -e VISION_PROVIDER=anthropic `
  -e VISION_BASE_URL=https://your-relay.example.com `
  -e VISION_MODEL=your-vision-model `
  -e VISION_API_KEY=your_api_key_here `
  -- node C:\path\to\vision-relay-mcp\index.js
```

路径必须指向你电脑上的 `index.js`。不要照抄示例路径。

### 方式 B：手动编辑 `.claude.json`

Claude Code 用户级配置文件通常在：

- Windows: `%USERPROFILE%\.claude.json`
- macOS/Linux: `~/.claude.json`

在 `mcpServers` 里添加：

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

Windows JSON 路径需要写成这样：

```json
"args": ["C:\\path\\to\\vision-relay-mcp\\index.js"]
```

## 第 4 步：重启 Claude Code

无论你使用方式 A 还是方式 B，配置完成后都要重启 Claude Code。

MCP 服务列表只在 Claude Code 启动时加载一次，不重启可能看不到新配置。

## 第 5 步：验证连接

执行：

```bash
claude mcp list
```

如果看到：

```text
vision-relay ... Connected
```

说明 MCP 已经启动。

注意：`Connected` 只代表 MCP 能启动。接口地址、API key 和模型名会在实际
识图时验证。

## 第 6 步：开始使用

在 Claude Code 里用自然语言说明图片路径和任务。

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

支持的图片格式：

```text
png, jpg, jpeg, webp, gif, bmp
```

SVG、PDF、HEIC 等格式需要先转换成 PNG 或 JPG。

## 从 v0.1.0 升级

1. 下载 v1.1.0 到新目录。
2. 执行 `npm install`。
3. 把 MCP 配置里的 `args` 改成新版 `index.js` 路径。
4. 保留原来的 API key、接口地址和模型名。
5. 重启 Claude Code。
6. 执行 `claude mcp list`。

旧版和新版对应关系：

| v0.1.0 | v1.1.0 |
| --- | --- |
| `analyze_image` + 单张图片 | `process_images` + `image_paths` |
| `compare_images` + 两张图片 | `process_images` + 两张路径 + 提示词 |

## 常见问题

### 显示 Connected，但识图失败

常见原因：

- `VISION_BASE_URL` 不正确
- `VISION_API_KEY` 不正确
- `VISION_MODEL` 不是视觉模型
- `VISION_PROVIDER` 和接口格式不匹配
- 图片路径不存在
- 图片格式不支持

### provider 怎么选

- Anthropic Messages 格式：`VISION_PROVIDER=anthropic`
- OpenAI Chat Completions 格式：`VISION_PROVIDER=openai`

不确定时先问接口提供方，或者两个格式都测试一次。

### 为什么建议用绝对路径

MCP 服务的工作目录不一定是你当前打开的项目目录。绝对路径最稳定。

### key 放哪里安全

放在 MCP 配置的 `env` 里，或放在系统环境变量、密钥管理工具里。

不要写进代码和 README。

### 怎么卸载

删除 MCP 配置中的 `vision-relay` 段，重启 Claude Code，然后删除项目文件夹。

## 项目文件

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

## 一句话总结

```text
Claude Code 负责对话和写代码
Vision Relay MCP 负责把图片交给视觉模型
视觉模型返回文字结果
Claude Code 继续处理你的任务
```

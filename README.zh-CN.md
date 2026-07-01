# Vision Relay MCP 小白使用教程

![Version](https://img.shields.io/badge/version-1.1.0-blue)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)
![License](https://img.shields.io/badge/license-MIT-green)

vision-relay-mcp 的零基础部署教程，对应 1.1.0。完整文档见 [README.md](./README.md)。

## 这个项目是干什么的？

Claude Code 不能直接看图片。这个项目充当"翻译官"：

```
你的本地图片 → Vision Relay MCP → 视觉模型 API → 文字结果 → Claude Code
```

1.1.0 只有一个工具入口 process_images，单图多图都走这里，做什么由提示词决定。

### v0.1.0 vs v1.1.0

v0.1.0 有两个工具（analyze_image、compare_images），v1.1.0 合并为一个。

| | v0.1.0 | v1.1.0 |
|---|--------|--------|
| 工具数 | 2 个 | 1 个 |
| 一次几张 | 1 或刚好 2 | 不限 |
| 发送方式 | 分开发 | 合并一次 |

## 你需要准备什么

1. Node.js ≥ 18.0.0（[下载](https://nodejs.org/)）
2. Claude Code
3. 支持图片输入的视觉模型接口 + API key
4. 本项目代码

> VISION_MODEL 必须支持图片输入。

## 第 1 步：下载并安装项目

首先把项目代码下载到你的电脑上。打开终端（Windows 用 PowerShell 或 CMD，macOS/Linux 用终端），执行：

```bash
git clone https://github.com/zhoucoolboy/vision-relay-mcp.git
```

这会在当前目录创建一个 vision-relay-mcp 文件夹。进入这个文件夹：

```bash
cd vision-relay-mcp
```

然后安装依赖。项目只有一个依赖包，几秒钟就能完成：

```bash
npm install
```

安装完成后，验证代码是否能正常解析（这条命令只检查语法，不会启动服务）：

```bash
npm run check
```

终端没有任何报错输出，就说明代码没问题，可以继续下一步。

## 第 2 步：搞清楚你的配置信息

这个项目不需要配置文件，所有设置通过环境变量传入。在继续之前，你需要从你的接口提供方那里拿到以下信息：

**必须有的三项（缺一个服务就启动不了）：**

1. **VISION_API_KEY** — 你的 API 密钥，通常是一串以 sk- 开头的字符。这是调用视觉接口的凭证。
2. **VISION_BASE_URL** — 接口地址。填你接口提供方给的基础地址即可，不需要写完整的 API 路径。比如填 https://api.example.com，服务器会自动补全为 https://api.example.com/v1/messages（Anthropic 格式）或 https://api.example.com/v1/chat/completions（OpenAI 格式）。如果你已经填了完整路径，服务器就直接用，不会重复追加。
3. **VISION_MODEL** — 模型名称。**必须是支持图片输入的模型**，纯文本模型收到图片会报错。

**可选的（不改也能正常用）：**

| 名称 | 默认值 | 作用 |
| --- | --- | --- |
| VISION_PROVIDER | anthropic | 接口协议格式。如果你的接口是 Anthropic Messages API 格式就填 anthropic，是 OpenAI Chat Completions 格式就填 openai。不确定的话保持默认值 |
| VISION_MAX_TOKENS | 2000 | 模型返回的最大文本长度。2000 足够描述一张图片，如果你要一次分析很多张图可以设大一些 |
| VISION_MAX_IMAGE_SIZE | 0 | 单张图片的大小上限（字节）。0 表示不限制。如果你的接口对图片大小有要求，可以设一个上限，比如 5242880（5MB） |

> 不要把这些信息写进代码或 README 里。下一步会告诉你怎么安全地配置。

## 第 3 步：写入 Claude Code 配置

现在把上一步准备好的信息写入 Claude Code 的 MCP 配置文件中。

**配置文件在哪？**

Claude Code 的 MCP 配置有两个位置，选一个即可：

- 用户级（推荐，所有项目都能用）：
  - macOS：~/.claude/claude_desktop_config.json
  - Windows：C:\Users\你的用户名\.claude\claude_desktop_config.json
- 项目级（只对当前项目生效）：项目根目录下的 .claude/settings.json

用任意文本编辑器打开对应的文件，在 `mcpServers` 字段中添加以下内容（如果文件是空的或不存在，就创建一个，写入下面的完整 JSON）：

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

**几个要点：**

- `args` 里的路径必须是你电脑上的**绝对路径**，指向第 1 步下载的 index.js。
  - Windows 示例：C:\Users\你的用户名\vision-relay-mcp\index.js（JSON 中写成 C:\\Users\\你的用户名\\vision-relay-mcp\\index.js）
  - macOS/Linux 示例：/Users/你的用户名/vision-relay-mcp/index.js
- `env` 里的四个值换成你在第 2 步准备好的真实信息。VISION_PROVIDER 如果用的是 OpenAI 兼容接口就改成 openai。
- `command` 保持 "node" 即可，前提是你的终端里能直接执行 node 命令（第 1 步装过 Node.js 就没问题）。

保存文件后，**必须重启 Claude Code**，因为 MCP 服务列表只在启动时加载一次。

## 第 4 步：验证连接

重启 Claude Code 后，在 Claude Code 中执行：

```bash
claude mcp list
```

如果看到类似以下输出，说明服务已成功连接：

```text
vision-relay ... Connected
```

如果显示 Disconnected 或列表中根本没有 vision-relay，说明配置有问题。常见原因：
- `args` 路径写错了，不是绝对路径或文件不存在
- JSON 格式有问题（多了或少了逗号、引号不匹配）
- Node.js 版本低于 18

可以手动执行 node /你的路径/index.js 看看报什么错，通常错误信息会直接指出问题所在。

> 注意：Connected 只代表 MCP 服务启动成功了，**不代表**你的接口地址、API key 和模型名一定正确。这些信息只有在你实际用的时候（第 5 步）才会被验证。

## 第 5 步：开始使用

配置完成并验证通过后，就可以在 Claude Code 中直接使用了。你不需要手动构造 JSON 请求——只需要用自然语言告诉 Claude Code 你想做什么，它会自动调用 process_images 工具。

**几个实际用法示例：**

单图识别文字：
```
帮我看看这张截图里有什么文字：C:\Users\你\screenshot.png
```

对比两张图：
```
帮我对比这两张设计稿，列出所有视觉差异：
C:\Users\你\design-v1.png
C:\Users\你\design-v2.png
```

从图片提取结构化数据：
```
读取这张表单，把里面所有字段提取成 JSON，用字段标签作为 key：
C:\Users\你\form.jpg
```

多图流程分析：
```
这三张截图是一个操作流程的三个步骤，帮我按顺序描述每一步在做什么：
C:\Users\你\step1.png
C:\Users\你\step2.png
C:\Users\你\step3.png
```

**如果你不指定要做什么**，工具会用默认提示词做综合分析——描述图片内容、提取可见文字、识别对象和颜色、分析布局。

**支持的图片格式：** png、jpg/jpeg、webp、gif、bmp。其他格式（如 SVG、PDF、HEIC）需要先转成 PNG。

## 从 v0.1.0 升级

如果你之前用的是 v0.1.0（有两个工具 analyze_image 和 compare_images），按以下步骤升级到 v1.1.0：

1. **下载新版本。** 克隆 v1.1.0 到一个新文件夹（建议保留旧版本作为备份，确认新版没问题后再删）。
   ```bash
   git clone https://github.com/zhoucoolboy/vision-relay-mcp.git vision-relay-mcp-v1.1
   cd vision-relay-mcp-v1.1
   npm install
   ```

2. **更新 MCP 配置。** 打开 Claude Code 的 MCP 配置文件，把 `args` 里的路径改成新版本 index.js 的位置。环境变量（VISION_API_KEY、VISION_BASE_URL、VISION_MODEL 等）保持不变。

3. **替换工具调用方式。** v1.1.0 只有一个 process_images 工具，参数名也从 image_path（单数）变成了 image_paths（复数数组）：

   | v0.1.0 的写法 | v1.1.0 的写法 |
   | --- | --- |
   | analyze_image(image_path="路径") | process_images(image_paths=["路径"]) |
   | compare_images(两张路径) | process_images(两张路径) + 在 prompt 中明确说要对比 |

4. **重启 Claude Code**，执行 claude mcp list 确认 vision-relay 显示 Connected。

5. **确认正常后**，可以删除旧版本文件夹。

## 常见问题

### 1. Connected 但识图失败？

- VISION_BASE_URL 地址不对
- VISION_API_KEY 不正确
- VISION_MODEL 不是视觉模型
- VISION_PROVIDER 和接口格式不匹配
- 图片路径不存在或格式不支持

手动执行 node index.js 看报错信息。

### 2. provider 怎么选？

- Anthropic Messages 格式 → anthropic
- OpenAI Chat Completions 格式 → openai

不确定的话两个都试试。

### 3. 为什么用绝对路径？

MCP 服务的工作目录不确定，绝对路径最稳。

### 4. key 放哪最安全？

MCP 配置的 env 块里。不要写进代码或 README。

### 5. 怎么卸载？

删掉 MCP 配置中的 vision-relay 段，重启 Claude Code，删项目文件夹。

## 项目文件

```
vision-relay-mcp/
├── index.js          # 核心代码（单文件，约 240 行）
├── package.json
├── README.md         # 完整文档
├── README.zh-CN.md   # 本文件
├── LICENSE           # MIT
├── .env.example
└── .gitignore
```

## 一句话总结

```
Claude Code   →   对话和写代码
Vision Relay  →   把图片交给视觉模型
视觉模型      →   看懂图片返回文字
Claude Code   →   继续处理任务
```

v1.1.0 的核心变化：**统一走 process_images，由提示词决定做什么。**

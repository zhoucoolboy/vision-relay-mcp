#!/usr/bin/env node
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from "@modelcontextprotocol/sdk/types.js";

const server = new Server(
  {
    name: "vision-relay-mcp",
    version: "0.1.0"
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

const mimeByExt = new Map([
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".gif", "image/gif"],
  [".bmp", "image/bmp"]
]);

function config() {
  return {
    provider: (process.env.VISION_PROVIDER || "anthropic").toLowerCase(),
    apiKey: process.env.VISION_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY,
    baseUrl: process.env.VISION_BASE_URL,
    model: process.env.VISION_MODEL,
    maxTokens: Number(process.env.VISION_MAX_TOKENS || 2000)
  };
}

function endpoint(baseUrl, provider) {
  const base = baseUrl.replace(/\/+$/, "");
  if (provider === "anthropic") {
    if (base.endsWith("/v1/messages")) return base;
    if (base.endsWith("/v1")) return `${base}/messages`;
    return `${base}/v1/messages`;
  }
  if (provider === "openai") {
    if (base.endsWith("/chat/completions")) return base;
    if (base.endsWith("/v1")) return `${base}/chat/completions`;
    return `${base}/v1/chat/completions`;
  }
  throw new Error(`Unsupported VISION_PROVIDER: ${provider}`);
}

async function readImage(imagePath) {
  const fullPath = path.resolve(imagePath);
  const info = await stat(fullPath);
  if (!info.isFile()) {
    throw new Error(`Not a file: ${fullPath}`);
  }
  if (info.size > 20 * 1024 * 1024) {
    throw new Error(`Image is larger than 20 MB: ${fullPath}`);
  }

  const ext = path.extname(fullPath).toLowerCase();
  const mediaType = mimeByExt.get(ext);
  if (!mediaType) {
    throw new Error(`Unsupported image extension "${ext}". Use png, jpg, jpeg, webp, gif, or bmp.`);
  }

  const bytes = await readFile(fullPath);
  return {
    data: bytes.toString("base64"),
    mediaType
  };
}

async function callAnthropic({ apiKey, baseUrl, model, maxTokens, prompt, images }) {
  const content = [];
  for (const image of images) {
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: image.mediaType,
        data: image.data
      }
    });
  }
  content.push({ type: "text", text: prompt });

  const response = await fetch(endpoint(baseUrl, "anthropic"), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "anthropic-version": "2023-06-01",
      "x-api-key": apiKey,
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature: 0,
      messages: [
        {
          role: "user",
          content
        }
      ]
    })
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Vision relay failed (${response.status}): ${text.slice(0, 2000)}`);
  }
  const data = JSON.parse(text);
  if (Array.isArray(data.content)) {
    return data.content.map((part) => part.text || JSON.stringify(part)).join("\n");
  }
  return JSON.stringify(data, null, 2);
}

async function callOpenAI({ apiKey, baseUrl, model, maxTokens, prompt, images }) {
  const content = [{ type: "text", text: prompt }];
  for (const image of images) {
    content.push({
      type: "image_url",
      image_url: {
        url: `data:${image.mediaType};base64,${image.data}`
      }
    });
  }

  const response = await fetch(endpoint(baseUrl, "openai"), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content }],
      temperature: 0,
      max_tokens: maxTokens
    })
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Vision relay failed (${response.status}): ${text.slice(0, 2000)}`);
  }
  const data = JSON.parse(text);
  const message = data?.choices?.[0]?.message?.content;
  if (typeof message === "string") return message;
  if (Array.isArray(message)) {
    return message.map((part) => part.text || JSON.stringify(part)).join("\n");
  }
  return JSON.stringify(data, null, 2);
}

async function callVision({ prompt, imagePaths }) {
  const cfg = config();
  const missing = [];
  if (!cfg.apiKey) missing.push("VISION_API_KEY");
  if (!cfg.baseUrl) missing.push("VISION_BASE_URL");
  if (!cfg.model) missing.push("VISION_MODEL");
  if (missing.length) {
    throw new Error(`Missing environment variable(s): ${missing.join(", ")}`);
  }

  const images = [];
  for (const imagePath of imagePaths) {
    images.push(await readImage(imagePath));
  }

  if (cfg.provider === "anthropic") {
    return callAnthropic({ ...cfg, prompt, images });
  }
  if (cfg.provider === "openai") {
    return callOpenAI({ ...cfg, prompt, images });
  }
  throw new Error(`Unsupported VISION_PROVIDER: ${cfg.provider}`);
}

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "analyze_image",
      description: "Analyze one local image through the configured vision relay model.",
      inputSchema: {
        type: "object",
        properties: {
          image_path: {
            type: "string",
            description: "Local path to the image file."
          },
          prompt: {
            type: "string",
            description: "Question or instruction for the image.",
            default: "Analyze this image and describe the important details."
          }
        },
        required: ["image_path"]
      }
    },
    {
      name: "compare_images",
      description: "Compare two local images through the configured vision relay model.",
      inputSchema: {
        type: "object",
        properties: {
          first_image_path: {
            type: "string",
            description: "Local path to the first image."
          },
          second_image_path: {
            type: "string",
            description: "Local path to the second image."
          },
          prompt: {
            type: "string",
            description: "Comparison instruction.",
            default: "Compare these two images and list the meaningful differences."
          }
        },
        required: ["first_image_path", "second_image_path"]
      }
    }
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;
    if (name === "analyze_image") {
      const text = await callVision({
        prompt: args.prompt || "Analyze this image and describe the important details.",
        imagePaths: [args.image_path]
      });
      return { content: [{ type: "text", text }] };
    }
    if (name === "compare_images") {
      const text = await callVision({
        prompt: args.prompt || "Compare these two images and list the meaningful differences.",
        imagePaths: [args.first_image_path, args.second_image_path]
      });
      return { content: [{ type: "text", text }] };
    }
    throw new Error(`Unknown tool: ${name}`);
  } catch (error) {
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: error instanceof Error ? error.message : String(error)
        }
      ]
    };
  }
});

await server.connect(new StdioServerTransport());

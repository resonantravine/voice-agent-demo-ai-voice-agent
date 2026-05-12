# Drive-Thru Voice Agent Demo

一个面向 AI 产品经理求职展示的 Voice Agent MVP。场景是 Drive-Thru / 电话客服订餐，因为它能自然覆盖 ASR、LLM policy、TTS、RTC/WebRTC、intent/slot、纠错、确认、人工升级和评测指标。

## Portfolio Summary

This prototype demonstrates a task-oriented voice agent for noisy, correction-heavy service conversations. It combines a live ElevenLabs Agent path with a deterministic mock path, so the project remains easy to review even when real-time audio permissions or network conditions vary.

**Product focus**

- Real-time voice ordering flow for Drive-Thru / phone support.
- Observable task state for intent, slots, confidence, correction handling, checkout readiness, and handoff risk.
- Guardrails for allergy uncertainty, angry users, manager requests, repeated corrections, and final confirmation.
- Evaluation framing around slot accuracy, correction recovery, confirmation burden, latency p95, and handoff precision.

## MVP 方案

**用户故事**

顾客通过语音点餐，Agent 在嘈杂、改口、信息缺失的情况下完成订单采集，只对高风险或价格相关信息做确认，并在过敏、投诉、重复纠错等场景升级人工。

**展示重点**

- 实时语音链路：ElevenLabs Conversational AI Agent 负责语音会话，前端通过 `@elevenlabs/client` 发起会话。
- 任务型对话：订单面板实时展示 intent、slot、confidence、stage、risk。
- 纠错体验：用户改口时采用最新表达，并只确认改动部分。
- Handoff：过敏和投诉类风险生成交接摘要。
- 评测意识：内置 slot accuracy、correction recovery、confirmation burden、latency p95、handoff precision。

## 本地运行

```bash
npm install
npm run dev
```

打开 Vite 输出的本地地址。

默认是 mock mode，可以点击 `Play next turn` 跑完整标准路径，也可以在输入框里输入：

- `Actually no pickles, make the tea unsweetened`
- `I have an allergy`
- `Yes, correct`

## 接入 ElevenLabs Agent

1. 在 ElevenLabs Conversational AI / ElevenAgents 控制台创建 Agent。
2. 把 [src/agentBlueprint.ts](/Users/martaliu/Documents/Codex/2026-05-12/voice-agent-demo-ai-voice-agent/src/agentBlueprint.ts) 里的 `agentSystemPrompt` 放进 Agent system prompt。
3. 在 Agent 里配置 client tools：
   - `update_order`
   - `handoff_to_human`
4. 复制 Agent ID 到本地环境变量：

```bash
cp .env.example .env
```

然后编辑 `.env`：

```bash
VITE_ELEVENLABS_AGENT_ID=agent_xxx
```

重启 `npm run dev` 后点击 `Start ElevenLabs`。公开 Agent 可直接使用 `agentId`；如果你的 Agent 需要私有鉴权，下一版可以加一个很薄的本地 token endpoint，用 API key 换 `conversationToken`。

## 部署到 GitHub Pages

这个项目已经包含 GitHub Actions 部署配置：[.github/workflows/deploy.yml](/Users/martaliu/Documents/Codex/2026-05-12/voice-agent-demo-ai-voice-agent/.github/workflows/deploy.yml)。

推荐流程：

1. 用 GitHub Desktop 发布仓库。
2. 在 GitHub repo 的 `Settings -> Pages` 中选择 `GitHub Actions`。
3. 推送到 `main` 后等待 `Deploy to GitHub Pages` workflow 完成。
4. 如果希望线上也能连接 ElevenLabs，在 repo 的 `Settings -> Secrets and variables -> Actions -> Variables` 里添加：

```text
VITE_ELEVENLABS_AGENT_ID=agent_xxx
```

不配置这个变量也没关系，公开站点会以 portfolio mock mode 运行。

## 面试讲法

**为什么选 Drive-Thru**

这是一个强任务型语音 Agent：用户目标明确，但输入会有噪音、停顿、改口、缺槽和风险信息。它比闲聊更贴近 JD 里的 ASR/LLM/TTS/RTC/SIP 链路和产品指标。

**MVP 边界**

当前版本不做完整 POS 集成，只做 client tool 级别的订单状态同步；不做真实支付，只在 checkout 阶段生成确认和窗口支付状态。

**下一版路线**

- 后端 token endpoint 支持私有 Agent。
- 加入菜单库存 API 和价格计算 API。
- 增加批量评测脚本，回放 30 条噪声/改口用例。
- 接 SIP 入站电话，把 WebRTC demo 延展到电话客服链路。

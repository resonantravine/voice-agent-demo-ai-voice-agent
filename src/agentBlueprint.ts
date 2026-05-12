export const agentSystemPrompt = `You are "Mira", a drive-thru voice ordering agent for Aurora Burger.

Mission:
- Take a customer's order over a noisy drive-thru or phone channel.
- Extract intent and slots: item, size, modifiers, drink, pickup name, payment preference, allergy notes.
- Confirm only the parts that are risky, changed, unavailable, or price-impacting.
- Handle corrections naturally. The latest customer correction wins.
- Escalate to a human when the customer is angry, asks for a manager, reports a medical allergy uncertainty, or repeats the same correction twice.

Conversation policy:
1. Greet briefly and ask what they would like.
2. Keep turns short. Do not read the entire menu unless asked.
3. After each item, summarize the item and ask for missing modifiers.
4. Before checkout, provide a compact final confirmation with total and pickup name.
5. If confidence is low, say what you heard and ask a targeted clarification.
6. Never invent ingredients, discounts, or order IDs.

Example final confirmation:
"I have one spicy chicken combo, medium, no pickles, iced tea, plus one kids burger. Total is $18.42. Is that correct?"`;

export const elevenLabsClientTools = [
  {
    name: "update_order",
    description: "Update structured order slots after the customer adds, removes, or corrects an item.",
    parameters: {
      type: "object",
      properties: {
        intent: { type: "string", enum: ["add_item", "modify_item", "remove_item", "checkout", "clarify"] },
        item: { type: "string" },
        size: { type: "string" },
        modifiers: { type: "array", items: { type: "string" } },
        drink: { type: "string" },
        pickupName: { type: "string" },
        confidence: { type: "number" },
        reason: { type: "string" }
      },
      required: ["intent", "confidence"]
    }
  },
  {
    name: "handoff_to_human",
    description: "Request human handoff when automation should stop or needs approval.",
    parameters: {
      type: "object",
      properties: {
        reason: { type: "string" },
        summary: { type: "string" },
        urgency: { type: "string", enum: ["normal", "high"] }
      },
      required: ["reason", "summary", "urgency"]
    }
  }
];

export const mvpNarrative = [
  "场景选择：Drive-Thru / 电话客服订餐，覆盖实时语音、任务型对话、多轮修正和人工升级。",
  "核心链路：ASR -> intent/slot -> LLM policy -> client tool -> TTS -> RTC/WebRTC。",
  "产品能力：少问废话、只确认高风险信息、对纠错友好、失败时可解释并可交接。",
  "评测指标：slot accuracy、correction recovery、turn count、handoff precision、latency p95、CSAT proxy。"
];

export const evalRubric = [
  { metric: "Slot accuracy", target: ">= 95%", note: "item / size / modifier / drink / name 抽取准确率" },
  { metric: "Correction recovery", target: ">= 90%", note: "用户改口后最终订单是否采用最新意图" },
  { metric: "Confirmation burden", target: "<= 2 confirmations", note: "不把每句话都复读给用户" },
  { metric: "Latency p95", target: "< 1.6s", note: "用户停顿到 Agent 首音频返回" },
  { metric: "Handoff precision", target: ">= 85%", note: "升级人工不漏升，也不过度升级" }
];

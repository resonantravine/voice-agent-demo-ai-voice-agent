import React, { useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Conversation } from "@elevenlabs/client";
import {
  Activity,
  BadgeCheck,
  Bot,
  ClipboardList,
  Headphones,
  Mic,
  PhoneCall,
  Play,
  RefreshCw,
  ShieldAlert,
  Square,
  UserRound,
  Wand2
} from "lucide-react";
import { agentSystemPrompt, elevenLabsClientTools, evalRubric, mvpNarrative } from "./agentBlueprint";
import "./styles.css";

type Speaker = "customer" | "agent" | "system";
type Stage = "Greeting" | "Collecting" | "Clarifying" | "Confirming" | "Handoff" | "Complete";
type ConnStatus = "mock" | "idle" | "connecting" | "connected" | "error";

type TranscriptLine = {
  speaker: Speaker;
  text: string;
  time: string;
};

type OrderState = {
  item: string;
  size: string;
  modifiers: string[];
  drink: string;
  pickupName: string;
  payment: string;
  total: string;
  confidence: number;
  intent: string;
  stage: Stage;
  risk: string;
};

const initialOrder: OrderState = {
  item: "",
  size: "",
  modifiers: [],
  drink: "",
  pickupName: "",
  payment: "",
  total: "$0.00",
  confidence: 0,
  intent: "waiting_for_order",
  stage: "Greeting",
  risk: "None"
};

const demoScript: Array<{ line: TranscriptLine; patch: Partial<OrderState> }> = [
  {
    line: { speaker: "agent", text: "Welcome to Aurora Burger. What can I get started for you?", time: "00:01" },
    patch: { stage: "Collecting", confidence: 0.98, intent: "greet" }
  },
  {
    line: { speaker: "customer", text: "Can I get a spicy chicken combo, medium, with iced tea?", time: "00:05" },
    patch: {
      item: "Spicy chicken combo",
      size: "Medium",
      drink: "Iced tea",
      total: "$12.80",
      confidence: 0.92,
      intent: "add_item"
    }
  },
  {
    line: { speaker: "agent", text: "Got it: medium spicy chicken combo with iced tea. Any changes to the sandwich?", time: "00:09" },
    patch: { stage: "Collecting", confidence: 0.94, intent: "confirm_item_light" }
  },
  {
    line: { speaker: "customer", text: "Actually no pickles, and make the tea unsweetened.", time: "00:13" },
    patch: {
      modifiers: ["No pickles"],
      drink: "Unsweetened iced tea",
      confidence: 0.9,
      intent: "modify_item"
    }
  },
  {
    line: { speaker: "agent", text: "No pickles and unsweetened tea. Anything else?", time: "00:16" },
    patch: { stage: "Collecting", confidence: 0.96, intent: "ack_correction" }
  },
  {
    line: { speaker: "customer", text: "Add a kids burger. Name is Maya.", time: "00:20" },
    patch: {
      pickupName: "Maya",
      total: "$18.42",
      confidence: 0.88,
      intent: "add_item",
      risk: "Bundle + add-on confirmation"
    }
  },
  {
    line: {
      speaker: "agent",
      text: "Final check: spicy chicken combo, medium, no pickles, unsweetened iced tea, plus a kids burger. Total is $18.42 for Maya. Correct?",
      time: "00:25"
    },
    patch: { stage: "Confirming", confidence: 0.95, intent: "checkout_confirm" }
  },
  {
    line: { speaker: "customer", text: "Yes, that's right.", time: "00:29" },
    patch: { stage: "Complete", payment: "Pay at window", confidence: 0.99, intent: "confirm_order", risk: "None" }
  }
];

const agentId = import.meta.env.VITE_ELEVENLABS_AGENT_ID as string | undefined;
const hasAgentId = Boolean(agentId?.trim());

function nowStamp() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function cx(...values: Array<string | false | undefined>) {
  return values.filter(Boolean).join(" ");
}

function inferPatch(text: string): Partial<OrderState> {
  const lower = text.toLowerCase();
  const patch: Partial<OrderState> = { confidence: 0.78, intent: "free_text_update", stage: "Collecting" };

  if (lower.includes("spicy") || lower.includes("chicken")) patch.item = "Spicy chicken combo";
  if (lower.includes("burger")) patch.item = lower.includes("kids") ? "Kids burger + current combo" : "Burger";
  if (lower.includes("medium")) patch.size = "Medium";
  if (lower.includes("large")) patch.size = "Large";
  if (lower.includes("tea")) patch.drink = lower.includes("unsweet") ? "Unsweetened iced tea" : "Iced tea";
  if (lower.includes("coke")) patch.drink = "Coke";
  if (lower.includes("no pickles")) patch.modifiers = ["No pickles"];
  if (lower.includes("allergy")) {
    patch.stage = "Handoff";
    patch.risk = "Allergy needs human verification";
    patch.intent = "handoff_required";
  }
  if (lower.includes("yes") || lower.includes("correct")) {
    patch.stage = "Complete";
    patch.payment = "Pay at window";
    patch.confidence = 0.96;
  }
  return patch;
}

function mergeOrder(prev: OrderState, patch: Partial<OrderState>): OrderState {
  return { ...prev, ...patch, modifiers: patch.modifiers ?? prev.modifiers };
}

function App() {
  const [order, setOrder] = useState<OrderState>(initialOrder);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([
    {
      speaker: "system",
      text: hasAgentId
        ? "Live mode is configured. Start ElevenLabs for a real voice session, or use the mock script for a deterministic walkthrough."
        : "Portfolio mock mode. Add VITE_ELEVENLABS_AGENT_ID locally or as a GitHub Pages repo variable to enable live voice.",
      time: nowStamp()
    }
  ]);
  const [scriptIndex, setScriptIndex] = useState(0);
  const [customerInput, setCustomerInput] = useState("No pickles, make the tea unsweetened");
  const [connectionStatus, setConnectionStatus] = useState<ConnStatus>(hasAgentId ? "idle" : "mock");
  const [liveMode, setLiveMode] = useState("listening");
  const [inputLevel, setInputLevel] = useState(0);
  const [outputLevel, setOutputLevel] = useState(0);
  const conversationRef = useRef<any>(null);
  const meterRef = useRef<number | null>(null);

  const readiness = useMemo(() => {
    const slots = [order.item, order.size, order.drink, order.pickupName];
    return Math.round((slots.filter(Boolean).length / slots.length) * 100);
  }, [order]);

  const addLine = (speaker: Speaker, text: string) => {
    setTranscript((prev) => [...prev, { speaker, text, time: nowStamp() }]);
  };

  const stopMeters = () => {
    if (meterRef.current) {
      window.clearInterval(meterRef.current);
      meterRef.current = null;
    }
    setInputLevel(0);
    setOutputLevel(0);
  };

  const startMeters = (conversation: any) => {
    stopMeters();
    meterRef.current = window.setInterval(() => {
      try {
        setInputLevel(Math.round((conversation.getInputVolume?.() ?? 0) * 100));
        setOutputLevel(Math.round((conversation.getOutputVolume?.() ?? 0) * 100));
      } catch {
        stopMeters();
      }
    }, 250);
  };

  const runNextScript = () => {
    const next = demoScript[scriptIndex % demoScript.length];
    addLine(next.line.speaker, next.line.text);
    setOrder((prev) => mergeOrder(prev, next.patch));
    setScriptIndex((prev) => prev + 1);
  };

  const resetDemo = async () => {
    if (conversationRef.current) {
      await conversationRef.current.endSession();
      conversationRef.current = null;
    }
    stopMeters();
    setOrder(initialOrder);
    setScriptIndex(0);
    setConnectionStatus(hasAgentId ? "idle" : "mock");
    setTranscript([
      {
        speaker: "system",
        text: hasAgentId ? "Demo reset. Live voice and mock script are ready." : "Demo reset. Public mock script and manual slot extraction are ready.",
        time: nowStamp()
      }
    ]);
  };

  const runMicCheck = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      addLine("system", "Mic check failed: this browser does not expose navigator.mediaDevices.getUserMedia.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      const devices = await navigator.mediaDevices.enumerateDevices();
      const micCount = devices.filter((device) => device.kind === "audioinput").length;
      addLine("system", `Mic check passed. Browser can access ${micCount} audio input device(s).`);
    } catch (error) {
      const message = error instanceof DOMException ? `${error.name}: ${error.message}` : error instanceof Error ? error.message : String(error);
      addLine("system", `Mic check failed: ${message}`);
    }
  };

  const startTextConversation = async () => {
    if (!hasAgentId) {
      addLine("system", "Add VITE_ELEVENLABS_AGENT_ID to .env, restart npm run dev, then start text test.");
      return;
    }

    try {
      setConnectionStatus("connecting");
      const conversation = await Conversation.startSession({
        agentId,
        textOnly: true,
        connectionType: "websocket",
        onConnect: ({ conversationId }) => {
          setConnectionStatus("connected");
          addLine("system", `Text-only ElevenLabs connected: ${conversationId}`);
        },
        onMessage: ({ role, message }) => addLine(role === "agent" ? "agent" : "customer", message),
        onDisconnect: (details) => {
          setConnectionStatus("idle");
          addLine("system", `Text-only ElevenLabs disconnected: ${details.reason}`);
        },
        onError: (message, context) => {
          setConnectionStatus("error");
          addLine("system", `Text-only ElevenLabs error: ${message}${context ? ` (${JSON.stringify(context)})` : ""}`);
        }
      });
      conversationRef.current = conversation;
      conversation.sendUserMessage("Hi, I want to order a spicy chicken combo.");
    } catch (error) {
      setConnectionStatus("error");
      const message = error instanceof DOMException ? `${error.name}: ${error.message}` : error instanceof Error ? error.message : String(error);
      addLine("system", `Text-only start failed: ${message}`);
    }
  };

  const submitCustomerLine = () => {
    const text = customerInput.trim();
    if (!text) return;
    addLine("customer", text);
    const patch = inferPatch(text);
    setOrder((prev) => mergeOrder(prev, patch));
    if (patch.stage === "Handoff") {
      addLine("agent", "I want to make sure we handle that safely. I am bringing in a teammate with the order summary.");
    } else if (patch.stage === "Complete") {
      addLine("agent", "Perfect, we will see you at the window.");
    } else {
      addLine("agent", "Got it. I updated the order and will confirm the changed part before checkout.");
    }
    setCustomerInput("");
  };

  const startLiveConversation = async () => {
    if (!hasAgentId) {
      addLine("system", "Live voice is disabled in this build. Add VITE_ELEVENLABS_AGENT_ID locally or as a GitHub Pages repo variable.");
      return;
    }

    try {
      setConnectionStatus("connecting");
      const conversation = await Conversation.startSession({
        agentId,
        textOnly: false,
        connectionType: "websocket",
        useWakeLock: false,
        clientTools: {
          update_order: async (params: any) => {
            setOrder((prev) =>
              mergeOrder(prev, {
                item: params.item || prev.item,
                size: params.size || prev.size,
                drink: params.drink || prev.drink,
                pickupName: params.pickupName || prev.pickupName,
                modifiers: params.modifiers || prev.modifiers,
                confidence: params.confidence ?? prev.confidence,
                intent: params.intent || prev.intent,
                risk: params.reason || prev.risk,
                stage: params.intent === "checkout" ? "Confirming" : prev.stage
              })
            );
            return "Order board updated.";
          },
          handoff_to_human: async (params: any) => {
            setOrder((prev) => mergeOrder(prev, { stage: "Handoff", risk: params.reason || "Human handoff requested" }));
            addLine("system", `Human handoff: ${params.summary || params.reason}`);
            return "Handoff summary captured.";
          }
        },
        onConnect: ({ conversationId }) => {
          setConnectionStatus("connected");
          addLine("system", `ElevenLabs connected: ${conversationId}`);
        },
        onDisconnect: () => {
          setConnectionStatus("idle");
          addLine("system", "ElevenLabs voice conversation disconnected.");
        },
        onModeChange: ({ mode }) => setLiveMode(mode),
        onStatusChange: ({ status }) => {
          if (status === "connected") setConnectionStatus("connected");
          if (status === "connecting") setConnectionStatus("connecting");
        },
        onMessage: ({ role, message }) => addLine(role === "agent" ? "agent" : "customer", message),
        onAgentResponseCorrection: ({ corrected_agent_response }) => {
          addLine("system", `Agent corrected response: ${corrected_agent_response}`);
        },
        onError: (message, context) => {
          setConnectionStatus("error");
          addLine("system", `ElevenLabs voice error: ${message}${context ? ` (${JSON.stringify(context)})` : ""}`);
        }
      });
      conversationRef.current = conversation;
      startMeters(conversation);
    } catch (error) {
      setConnectionStatus("error");
      const message = error instanceof DOMException ? `${error.name}: ${error.message}` : error instanceof Error ? error.message : String(error);
      addLine("system", `Voice start failed: ${message}`);
    }
  };

  const stopLiveConversation = async () => {
    if (conversationRef.current) {
      await conversationRef.current.endSession();
      conversationRef.current = null;
    }
    stopMeters();
    setConnectionStatus(hasAgentId ? "idle" : "mock");
  };

  return (
    <main className="appShell">
      <section className="topbar">
        <div>
          <p className="eyebrow">AI PM Portfolio MVP</p>
          <h1>Drive-Thru Voice Agent Demo</h1>
        </div>
        <div className="topActions">
          <button className="ghostButton" onClick={resetDemo}>
            <RefreshCw size={16} /> Reset
          </button>
          {connectionStatus === "connected" || connectionStatus === "connecting" ? (
            <button className="dangerButton" onClick={stopLiveConversation}>
              <Square size={16} /> Stop live
            </button>
          ) : (
            <button className="primaryButton" onClick={startLiveConversation}>
              <PhoneCall size={16} /> Start ElevenLabs
            </button>
          )}
        </div>
      </section>

      <section className="mvpStrip">
        {mvpNarrative.map((item) => (
          <div key={item} className="mvpPoint">
            <BadgeCheck size={16} />
            <span>{item}</span>
          </div>
        ))}
      </section>

      <section className="dashboardGrid">
        <div className="panel livePanel">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">Customer Channel</p>
              <h2>Call Simulator</h2>
            </div>
            <span className={cx("statusPill", connectionStatus === "connected" && "isLive")}>
              {connectionStatus === "mock" ? "Mock mode" : connectionStatus}
            </span>
          </div>

          <div className="driveScene" aria-label="Drive thru scene">
            <div className="menuBoard">
              <span>Aurora Burger</span>
              <strong>Combo lane</strong>
            </div>
            <div className="signalTower">
              <Mic size={22} />
            </div>
            <div className="carShape" />
          </div>

          <div className="callControls">
            <button className="primaryButton" onClick={runNextScript}>
              <Play size={16} /> Play next turn
            </button>
            <button className="ghostButton" onClick={runMicCheck}>
              <Mic size={16} /> Mic check
            </button>
            <button className="ghostButton" onClick={startTextConversation}>
              <Bot size={16} /> Text test
            </button>
            <div className="modeBadge">
              <Activity size={16} />
              {connectionStatus === "connected" ? `Live: ${liveMode}` : "Scripted evaluation path"}
            </div>
          </div>

          <div className="audioMeters" aria-label="Audio levels">
            <div>
              <span>Mic in</span>
              <progress value={inputLevel} max={100} />
              <b>{inputLevel}%</b>
            </div>
            <div>
              <span>Agent out</span>
              <progress value={outputLevel} max={100} />
              <b>{outputLevel}%</b>
            </div>
          </div>

          <div className="manualInput">
            <input
              value={customerInput}
              onChange={(event) => setCustomerInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") submitCustomerLine();
              }}
              placeholder="Type a customer correction or edge case"
            />
            <button className="ghostButton" onClick={submitCustomerLine}>
              <Wand2 size={16} /> Extract
            </button>
          </div>
        </div>

        <div className="panel transcriptPanel">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">ASR / LLM / TTS Trace</p>
              <h2>Transcript</h2>
            </div>
            <Headphones size={20} />
          </div>
          <div className="transcriptList">
            {transcript.map((line, index) => (
              <article key={`${line.time}-${index}`} className={cx("bubble", line.speaker)}>
                <div className="speaker">
                  {line.speaker === "agent" ? <Bot size={15} /> : line.speaker === "customer" ? <UserRound size={15} /> : <Activity size={15} />}
                  <span>{line.speaker}</span>
                  <time>{line.time}</time>
                </div>
                <p>{line.text}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="panel orderPanel">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">Intent / Slot State</p>
              <h2>Order Board</h2>
            </div>
            <ClipboardList size={20} />
          </div>

          <div className="stageRail">
            {(["Greeting", "Collecting", "Clarifying", "Confirming", "Handoff", "Complete"] as Stage[]).map((stage) => (
              <span key={stage} className={cx("stageDot", order.stage === stage && "active")}>
                {stage}
              </span>
            ))}
          </div>

          <div className="slotGrid">
            <Slot label="Intent" value={order.intent} />
            <Slot label="Item" value={order.item || "Missing"} />
            <Slot label="Size" value={order.size || "Ask"} />
            <Slot label="Drink" value={order.drink || "Ask"} />
            <Slot label="Modifiers" value={order.modifiers.join(", ") || "None"} />
            <Slot label="Pickup name" value={order.pickupName || "Ask"} />
            <Slot label="Payment" value={order.payment || "Pending"} />
            <Slot label="Total" value={order.total} />
          </div>

          <div className="readinessBlock">
            <div>
              <strong>{readiness}%</strong>
              <span>Checkout readiness</span>
            </div>
            <progress value={readiness} max={100} />
          </div>
        </div>

        <div className="panel evalPanel">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">PM Evaluation View</p>
              <h2>Quality Gates</h2>
            </div>
            <ShieldAlert size={20} />
          </div>

          <div className="metricHero">
            <span>Confidence</span>
            <strong>{Math.round(order.confidence * 100)}%</strong>
            <p>{order.risk}</p>
          </div>

          <div className="rubricList">
            {evalRubric.map((metric) => (
              <article key={metric.metric}>
                <div>
                  <strong>{metric.metric}</strong>
                  <span>{metric.note}</span>
                </div>
                <b>{metric.target}</b>
              </article>
            ))}
          </div>
        </div>

        <div className="panel promptPanel">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">ElevenLabs Agent Setup</p>
              <h2>Prompt + Client Tools</h2>
            </div>
            <Bot size={20} />
          </div>
          <pre>{agentSystemPrompt}</pre>
          <pre>{JSON.stringify(elevenLabsClientTools, null, 2)}</pre>
        </div>
      </section>
    </main>
  );
}

function Slot({ label, value }: { label: string; value: string }) {
  return (
    <div className="slot">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);

# Voice Checkout Agent

Drive-thru ordering MVP for real-time correction, confirmation, and human handoff.

[Live demo](https://resonantravine.github.io/voice-checkout-agent/) · Built with React, Vite, and ElevenLabs Conversational AI

## Overview

Voice Checkout Agent is a portfolio prototype for a task-oriented voice agent in a noisy, correction-heavy service scenario. The demo supports both a live ElevenLabs voice path and a deterministic mock path, so the product story remains easy to review even when real-time audio permissions or network conditions vary.

The scenario is a drive-thru / phone ordering workflow because it naturally exercises the core voice-agent loop: ASR, LLM policy, TTS, real-time audio, intent and slot tracking, correction handling, confirmation, and human handoff.

## What It Demonstrates

- Real-time voice ordering flow powered by ElevenLabs Agent.
- Observable task state for intent, slots, confidence, checkout readiness, and handoff risk.
- Correction handling where the latest customer correction wins.
- Human handoff rules for allergy uncertainty, angry users, manager requests, and repeated failed corrections.
- Product metrics framing: slot accuracy, correction recovery, confirmation burden, latency p95, and handoff precision.
- Public-safe mock mode when no ElevenLabs Agent ID is configured.

## Demo Flow

Use the mock script to show the product behavior without relying on live audio:

1. Click `Play next turn` to walk through a complete drive-thru order.
2. Try manual inputs such as:
   - `Actually no pickles, make the tea unsweetened`
   - `I have an allergy`
   - `Yes, correct`
3. Watch the order board update intent, slots, confidence, risk, and checkout readiness.

For live voice, configure an ElevenLabs Agent ID and click `Start ElevenLabs`.

## Local Setup

```bash
npm install
npm run dev
```

Open the local Vite URL printed in the terminal.

## ElevenLabs Setup

1. Create an Agent in ElevenLabs Conversational AI / ElevenAgents.
2. Copy the `agentSystemPrompt` from [src/agentBlueprint.ts](src/agentBlueprint.ts) into the Agent system prompt.
3. Configure optional client tools:
   - `update_order`
   - `handoff_to_human`
4. Add the Agent ID locally:

```bash
cp .env.example .env
```

```text
VITE_ELEVENLABS_AGENT_ID=agent_xxx
```

Restart `npm run dev` after changing `.env`.

## Deployment

This repo includes a GitHub Pages workflow at [.github/workflows/deploy.yml](.github/workflows/deploy.yml).

For a public live voice demo, add this GitHub Actions repository variable:

```text
VITE_ELEVENLABS_AGENT_ID=agent_xxx
```

Without that variable, the deployed site runs in portfolio mock mode.

## Notes

This is an MVP prototype, not a production POS integration. The current version focuses on the voice-agent product loop, observability, guardrails, and evaluation framing. A production version would add menu inventory APIs, price calculation, persisted orders, SIP phone routing, and a scripted evaluation set.

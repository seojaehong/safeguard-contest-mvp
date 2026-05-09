# SafeClaw Agent Architecture Roadmap (Phase 1)

## 1. Overview
This document outlines the Phase 1 refactoring plan to transition the SafeClaw MVP from a sequential API-calling script (`lib/workspace.ts`, `lib/search.ts`) into an Agentic Architecture inspired by OpenClaw/Hermes.

**Target Audience:** AI Coding Assistants (Claude Code, Codex, Cursor, etc.)
**Goal:** Refactor existing code into a modular, agent-based pattern *without* introducing heavy external frameworks (like LangGraph or CrewAI) yet.

## 2. Current State vs. Target State

### Current State (Sequential & Monolithic)
- `lib/search.ts` (`runAsk`): Monolithic function that sequentially calls weather, work24, kosha, lawgo, and then generates deliverables.
- `lib/ai-deliverables.ts`: Handles all document generation in one massive prompt/call.
- `lib/workspace.ts`: Defines the massive `WorkspaceState` type.

### Target State (Agentic Pattern)
- **Tools:** Existing API wrappers (`lib/weather.ts`, `lib/kosha.ts`, etc.) wrapped in a standard `Tool` interface.
- **Agents:** Domain-specific actors (e.g., `WeatherAgent`, `LegalAgent`, `DocumentAgent`) that use Tools.
- **Harness (Orchestrator):** A lightweight DAG/Pipeline runner that executes Agents based on dependencies.
- **Memory (Context Store):** A shared state object passed between Agents.

## 3. Core Interfaces to Implement

Create a new directory `lib/agents/` and define the core interfaces in `lib/agents/core.ts`:

```typescript
// lib/agents/core.ts

export interface AgentContext {
  query: string;
  location?: string;
  industry?: string;
  sharedMemory: Record<string, any>; // The "LLM Wiki" / Context Store
  logs: string[];
}

export interface Tool<TInput = any, TOutput = any> {
  name: string;
  description: string;
  execute: (input: TInput, ctx: AgentContext) => Promise<TOutput>;
}

export interface Agent<TResult = any> {
  name: string;
  role: string;
  tools: Tool[];
  execute: (ctx: AgentContext) => Promise<TResult>;
}

export interface HarnessConfig {
  maxRetries?: number;
  timeoutMs?: number;
}
```

## 4. Step-by-Step Refactoring Plan

### Step 1: Wrap Existing APIs into Tools
Move existing logic from `lib/weather.ts`, `lib/kosha.ts`, etc., into the `Tool` interface.
- Create `lib/agents/tools/weatherTool.ts`
- Create `lib/agents/tools/koshaTool.ts`
- Create `lib/agents/tools/lawgoTool.ts`

### Step 2: Create Domain Agents
Group tools into logical Agents.
- **`DataGatheringAgent`**: Uses Weather, KOSHA, Lawgo tools to populate `ctx.sharedMemory`.
- **`DocumentGenerationAgent`**: Reads `ctx.sharedMemory` and calls `generateAllDeliverables` (from `lib/ai-deliverables.ts`).
- **`ValidationAgent`**: Checks the output of `DocumentGenerationAgent` against `ctx.sharedMemory` (Schema-first validation).

### Step 3: Build the Lightweight Harness
Create `lib/agents/harness.ts` to orchestrate the Agents.

```typescript
// lib/agents/harness.ts
import { Agent, AgentContext } from "./core";

export class SafeClawHarness {
  private context: AgentContext;

  constructor(initialQuery: string) {
    this.context = { query: initialQuery, sharedMemory: {}, logs: [] };
  }

  async runPipeline(agents: Agent[]) {
    for (const agent of agents) {
      try {
        this.context.logs.push(`[Harness] Starting agent: ${agent.name}`);
        const result = await agent.execute(this.context);
        this.context.sharedMemory[agent.name] = result;
      } catch (error) {
        this.context.logs.push(`[Harness] Agent ${agent.name} failed: ${error}`);
        // Implement retry logic here
        throw error;
      }
    }
    return this.context;
  }
}
```

### Step 4: Refactor `runAsk` (`lib/search.ts`)
Replace the monolithic `runAsk` function with the new Harness.

```typescript
// Refactored lib/search.ts
import { SafeClawHarness } from "./agents/harness";
import { DataGatheringAgent } from "./agents/DataGatheringAgent";
import { DocumentGenerationAgent } from "./agents/DocumentGenerationAgent";

export async function runAsk(query: string) {
  const harness = new SafeClawHarness(query);
  
  const finalContext = await harness.runPipeline([
    new DataGatheringAgent(),
    new DocumentGenerationAgent()
  ]);

  // Map finalContext.sharedMemory back to the expected WorkspaceState format
  return mapToWorkspaceState(finalContext);
}
```

## 5. AI Assistant Instructions (For Claude Code / Codex)

When executing this refactoring:
1. **DO NOT break existing UI contracts:** The final output of `runAsk` MUST still match the `WorkspaceState` type defined in `lib/types.ts`.
2. **Incremental Commits:** Implement one Tool or Agent at a time. Test the API route (`/api/ask`) after each step.
3. **Error Handling:** Ensure the Harness catches errors from individual Agents and falls back gracefully (e.g., if `WeatherAgent` fails, `DocumentGenerationAgent` should still run but note the missing weather data).
4. **Preserve Schema-First Logic:** Do not alter the prompt structures in `lib/ai-deliverables.ts` during this phase. Only change *how* they are invoked.

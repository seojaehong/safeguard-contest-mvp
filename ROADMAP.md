# SafeClaw Technical Roadmap (Phase 1 to Phase 3)

## Vision
Transform SafeClaw from a monolithic API-calling script into a fully autonomous, multi-agent orchestration platform for industrial safety compliance.

## Phase 1: Agentic Pattern Refactoring (Current Focus)
**Goal:** Restructure existing codebase to mimic an agentic framework without introducing heavy external dependencies.

*   **Objective 1:** Define Core Interfaces (`Agent`, `Tool`, `AgentContext`, `Harness`).
*   **Objective 2:** Wrap existing API integrations (`weather.ts`, `kosha.ts`, `lawgo.ts`) into standard `Tool` implementations.
*   **Objective 3:** Create Domain Agents (`DataGatheringAgent`, `DocumentGenerationAgent`, `ValidationAgent`).
*   **Objective 4:** Implement a lightweight `SafeClawHarness` to orchestrate the Agents sequentially with basic error handling and retry logic.
*   **Objective 5:** Refactor `runAsk` in `lib/search.ts` to utilize the new Harness while maintaining the existing `WorkspaceState` output contract for the UI.

**Success Criteria:** The `/api/ask` endpoint functions identically to the user, but the underlying architecture is modular, testable, and agent-based.

## Phase 2: Framework Integration (Post-Funding)
**Goal:** Replace the lightweight custom Harness with a robust, production-ready open-source agent framework (e.g., LangGraph, CrewAI, or AutoGen).

*   **Objective 1:** Evaluate and select the optimal framework based on Phase 1 learnings (focusing on DAG capabilities, state management, and observability).
*   **Objective 2:** Migrate Phase 1 Agents and Tools to the selected framework's API.
*   **Objective 3:** Implement advanced state management (Long-term Memory) using the existing LLM Wiki infrastructure (`/api/knowledge`).
*   **Objective 4:** Introduce parallel execution for independent Data Gathering Agents (e.g., fetching Weather and KOSHA data simultaneously).
*   **Objective 5:** Enhance the Validation Agent to provide feedback loops (e.g., if a document fails schema validation, the Document Generation Agent automatically retries with the error context).

**Success Criteria:** SafeClaw utilizes a standard agent framework, demonstrating improved performance (parallel execution) and reliability (automated retry/correction loops).

## Phase 3: Full Autonomous Orchestration (Long-Term)
**Goal:** Achieve a fully autonomous safety compliance platform capable of proactive monitoring and multi-channel execution.

*   **Objective 1:** Implement Trigger Agents (e.g., monitoring legal updates, IoT sensor data, or scheduled compliance checks).
*   **Objective 2:** Develop specialized Execution Agents (e.g., `NotificationAgent` for Slack/Kakao, `AuditAgent` for compliance reporting).
*   **Objective 3:** Establish a complex, multi-step DAG where Trigger Agents initiate workflows, Analysis Agents determine necessary actions, and Execution Agents perform them.
*   **Objective 4:** Integrate Human-in-the-Loop (HITL) approval steps for critical actions within the Harness.

**Success Criteria:** SafeClaw operates proactively, automatically updating safety documents upon legal changes and notifying relevant personnel without manual initiation.

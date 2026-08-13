export const MCP_TOOL_NAMES: readonly [
  "run_safeclaw_harness_agent",
  "generate_reviewed_safety_docpack",
  "generate_safety_docpack",
  "get_weather_signals",
  "validate_safety_citations",
  "sanitize_emergency_contacts",
  "search_accident_cases",
  "get_evidence_mapping",
  "query_safety_knowledge",
  "qa_review_docpack",
];

export const MCP_TOOL_SCOPES: readonly string[];
export const MCP_DEFAULT_SCOPES: readonly ["tools:read"];

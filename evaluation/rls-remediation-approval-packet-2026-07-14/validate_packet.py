from __future__ import annotations

import argparse
import copy
import json
import re
import subprocess
import sys
from collections.abc import Iterator
from dataclasses import dataclass, field
from pathlib import Path


JsonDict = dict[str, object]

PACKET_RELATIVE_DIR = "evaluation/rls-remediation-approval-packet-2026-07-14"
EXPECTED_BRANCH = "docs/rls-remediation-approval-packet-2026-07-14"
AUTHORITATIVE_BASE_REVISION = "2684cb99de944aa9f54d143f2ae40b4ad6104f02"
AUDITED_PRODUCT_REVISION = "f45bba17bcce0d8ebb2690f82d014dbe42ae8191"
EVIDENCE_ROOT_REVISION = "d77205bb498080ac02b9f506d72bd44648f4a660"
EXTERNAL_INTEGRATION_REVISION = "ea7aa7223a056c884d5b0ba55563d602af328451"
AUDIT_RELATIVE_PATH = "evaluation/supabase-rls-audit-2026-07-14/report.json"
AUDIT_GIT_BLOB = "7ad1dd2d27be946a2f84b0fc57c25246c0f47b00"

EXPECTED_CANDIDATE_ROOT_PATHS = (
    f"{PACKET_RELATIVE_DIR}/logs/validator.log",
    f"{PACKET_RELATIVE_DIR}/report.json",
    f"{PACKET_RELATIVE_DIR}/report.md",
    f"{PACKET_RELATIVE_DIR}/validate_packet.py",
)
EXPECTED_PACKET_PATHS = (
    f"{PACKET_RELATIVE_DIR}/logs/tdd-red.log",
    *EXPECTED_CANDIDATE_ROOT_PATHS,
)
EXPECTED_REQUIRED_APPROVAL_ACTIONS = (
    "Any database policy, role, privilege, function, constraint, or FORCE state change.",
    "Any route, server library, or test implementation beyond this packet.",
    "Any staging or production identity, row, token, bucket, or object mutation.",
    "Any live credential use or live policy/grant inspection not already represented by the preserved audit artifacts.",
    "Any production rollout, rollback, or fixture cleanup.",
)
EXPECTED_NO_APPROVAL_ACTIONS = (
    "Read repository source and preserved redacted audit artifacts.",
    "Write report.json, report.md, the local validator, and validator evidence logs inside the approved evaluation directory.",
    "Run the local validator, its mutation-based attack cases, git diff scope checks, and local secret-pattern scans.",
    "Commit and push the documentation-only branch after pull --rebase.",
)
EXPECTED_BATCH_FINDINGS: dict[str, tuple[str, ...]] = {
    "A": ("P1-01", "P1-02", "P2-01", "P2-02", "P2-04", "P3-01", "P3-02", "P3-03"),
    "B": ("P1-02", "P1-03", "P2-03"),
    "C": ("P3-01",),
    "D": ("P1-03",),
    "E": ("P1-01", "P1-02", "P1-03", "P2-01", "P2-02", "P2-03", "P2-04", "P3-01", "P3-02", "P3-03"),
}
EXPECTED_FINDING_BATCHES: dict[str, tuple[str, ...]] = {
    "P1-01": ("A", "E"),
    "P1-02": ("A", "B", "E"),
    "P1-03": ("B", "D", "E"),
    "P2-01": ("A", "E"),
    "P2-02": ("A", "E"),
    "P2-03": ("B", "E"),
    "P2-04": ("A", "E"),
    "P3-01": ("A", "C", "E"),
    "P3-02": ("A", "E"),
    "P3-03": ("A", "E"),
}
EXPECTED_FINDING_ROUTES: dict[
    str, tuple[tuple[str, tuple[str, ...], str], ...]
] = {
    "P1-01": (),
    "P1-02": (
        ("/api/dispatch-logs", ("GET", "POST"), "app/api/dispatch-logs/route.ts:41-208"),
    ),
    "P1-03": (
        ("/api/education-records", ("POST",), "app/api/education-records/route.ts:31-56"),
        ("/api/dispatch-logs", ("POST",), "app/api/dispatch-logs/route.ts:184-208"),
        ("/api/workpacks/[id]/share-sessions", ("GET", "POST"), "app/api/workpacks/[id]/share-sessions/route.ts:34-55"),
        ("/api/workpacks/[id]/read-confirmations", ("GET", "POST"), "app/api/workpacks/[id]/read-confirmations/route.ts:32-119"),
        ("/api/workpacks/[id]/improvements", ("GET", "POST"), "app/api/workpacks/[id]/improvements/route.ts:176-338"),
    ),
    "P2-01": (
        ("/api/education-records", ("POST",), "app/api/education-records/route.ts:15-56"),
        ("/api/dispatch-logs", ("GET", "POST"), "app/api/dispatch-logs/route.ts:41-208"),
        ("/api/workpacks/[id]/read-confirmations", ("GET", "POST"), "app/api/workpacks/[id]/read-confirmations/route.ts:21-145"),
    ),
    "P2-02": (
        ("/api/safety-reference/status", ("GET",), "app/api/safety-reference/status/route.ts:6"),
    ),
    "P2-03": (
        ("/api/mcp/[transport]", ("GET", "POST", "DELETE"), "app/api/mcp/[transport]/route.ts:134-189"),
        ("/api/mcp-tokens", ("GET", "POST"), "app/api/mcp-tokens/route.ts:189-253"),
        ("/api/mcp-tokens/[id]", ("PATCH", "DELETE"), "app/api/mcp-tokens/[id]/route.ts:33-116"),
    ),
    "P2-04": (
        ("/api/ontology/graph", ("GET",), "app/api/ontology/graph/route.ts:10-11"),
    ),
    "P3-01": (),
    "P3-02": (
        ("/api/safety-reference/search", ("GET",), "app/api/safety-reference/search/route.ts:7-18"),
    ),
    "P3-03": (
        ("/api/ontology/graph", ("GET",), "app/api/ontology/graph/route.ts:10-11"),
    ),
}
EXPECTED_BOUNDARY_ROUTES: dict[str, tuple[str, ...]] = {
    "BND-DISPATCH": ("/api/dispatch-logs",),
}
EXPECTED_AUDIT_COUNTS: JsonDict = {
    "migrationFiles": 9,
    "migrationLines": 760,
    "applicationTables": 22,
    "managedTablesTouched": 1,
    "additionalManagedTenantDataBoundariesInventoried": 1,
    "totalInventoriedTableObjects": 24,
    "applicationClassification": {"tenant": 13, "public": 5, "operator": 3, "unclassified": 1},
    "allObjectClassification": {
        "tenant": 13,
        "public": 5,
        "operator": 4,
        "managedTenantDataBoundary": 1,
        "unclassified": 1,
    },
    "rlsEnabledApplicationTables": 20,
    "rlsMissingApplicationTables": 2,
    "forceRlsApplicationTables": 0,
    "policies": 20,
    "forAllPolicies": 13,
    "selectOnlyPolicies": 7,
    "policiesWithExplicitRole": 0,
    "functions": 1,
    "securityDefinerFunctions": 0,
    "triggers": 0,
    "grantOrRevokeStatements": 0,
    "findings": {"P0": 0, "P1": 3, "P2": 4, "P3": 3, "total": 10},
    "liveReadOnlyRequests": 44,
    "liveHttpStatusCounts": {"200": 30, "206": 4, "404": 10},
    "liveVerifiedPolicyAssertions": 0,
    "crossTenantNegativeCasesInventoried": 14,
    "crossTenantRuntimeCasesExecuted": 0,
    "freshLiveReadOnlyRequests": 44,
    "recoveredReadOnlyRequests": 88,
    "totalReadOnlyRequestsRepresented": 132,
    "expectedCrossTenantDenyAssertions": 56,
    "serviceRoleTenantAdminEntryPoints": 21,
    "serviceRoleTenantAdminDirectEntryPoints": 19,
    "serviceRoleTenantAdminBrokerEntryPoints": 2,
    "publicGlobalServiceRoleApiRoutes": 6,
    "publicGlobalServiceRoleServerPageSurfaces": 5,
    "publicGlobalServiceRoleHttpSurfaces": 11,
    "focusedTestFiles": 10,
    "focusedTests": 82,
}
EXPECTED_SERVICE_ROUTE_METHODS: dict[str, tuple[str, ...]] = {
    "/api/briefing/settings": ("GET", "POST"),
    "/api/dispatch-logs": ("GET", "POST"),
    "/api/education-records": ("POST",),
    "/api/workers": ("GET", "POST"),
    "/api/workpacks": ("GET", "POST"),
    "/api/workpacks/[id]": ("GET",),
    "/api/workflow/dispatch": ("POST",),
    "/api/workpacks/[id]/share-sessions": ("GET", "POST"),
    "/api/workpacks/[id]/read-confirmations": ("GET", "POST"),
    "/api/workpacks/[id]/improvements": ("GET", "POST"),
    "/api/workpacks/[id]/operation-graph": ("GET",),
    "/api/workpacks/[id]/learning-export": ("GET",),
    "/api/knowledge/ingest": ("POST",),
    "/api/knowledge/regenerate": ("POST",),
    "/api/input-photos/hazard-analysis": ("POST",),
    "/api/mcp/[transport]": ("GET", "POST", "DELETE"),
    "/api/mcp-tokens": ("GET", "POST"),
    "/api/mcp-tokens/[id]": ("PATCH", "DELETE"),
    "/api/briefing/run": ("GET",),
    "/api/agent/context": ("GET",),
    "/api/agent/chat": ("POST",),
}
WORKFLOW_DISPATCH_SEMANTICS = (
    "POST authenticates the caller, loads the caller-owned workpack operation context, "
    "and validates the active owned share session; it does not access dispatch_logs."
)
HAZARD_POST_SEMANTICS = (
    "POST creates the privileged client only for caller authentication before photo analysis."
)
HAZARD_GET_SEMANTICS = (
    "GET is a public provider-readiness response and does not create a privileged client or require authentication."
)
EXPECTED_DIRECTION_CASES: dict[str, dict[str, str]] = {
    "A-to-B": {
        "actor": "authenticatedA",
        "ownTenant": "organization A and site A",
        "foreignTenant": "organization B and site B",
    },
    "B-to-A": {
        "actor": "authenticatedB",
        "ownTenant": "organization B and site B",
        "foreignTenant": "organization A and site A",
    },
}
EXPECTED_SYMMETRIC_ACCOUNTING: JsonDict = {
    "uniqueBoundaryCases": 14,
    "directionsPerCase": 2,
    "commandsPerDirection": 4,
    "negativeAssertions": 112,
    "sameTenantPositiveControlsPerDirection": 1,
    "sameTenantPositiveAssertions": 28,
    "matrixAssertionsPerPhase": 140,
    "preExecutionsPlanned": 140,
    "postExecutionsPlanned": 140,
    "executedByPacket": 0,
}
EXPECTED_ATTACK_IDS = (
    "stale-finding-count",
    "stale-policy-count-with-mutated-audit",
    "missing-approval-flag",
    "deleted-required-db-approval-action",
    "accidental-migration-path",
    "undeclared-output-path",
    "create-policy-pseudocode",
    "drop-table-pseudocode",
    "alter-table-pseudocode",
    "truncate-table-pseudocode",
    "delete-from-pseudocode",
    "insert-into-pseudocode",
    "update-set-pseudocode",
    "grant-pseudocode",
    "revoke-pseudocode",
    "do-block-pseudocode",
    "psql-include-pseudocode",
    "with-delete-pseudocode",
    "markdown-bullet-drop-table",
    "base-revision-mutation",
    "asymmetric-finding-batch-map",
    "workflow-dispatch-dispatch-logs-misclassification",
    "hazard-get-service-role-misclassification",
    "missing-b-to-a-negative-direction",
    "missing-b-to-a-positive-control",
)
EXPECTED_TDD_RED_RESULTS = (
    "attack.stale-finding-count=REJECTED errors=1",
    "attack.stale-policy-count-with-mutated-audit=ACCEPTED_UNEXPECTEDLY errors=0",
    "attack.missing-approval-flag=REJECTED errors=1",
    "attack.deleted-required-db-approval-action=ACCEPTED_UNEXPECTEDLY errors=0",
    "attack.accidental-migration-path=REJECTED errors=2",
    "attack.undeclared-output-path=ACCEPTED_UNEXPECTEDLY errors=0",
    "attack.create-policy-pseudocode=REJECTED errors=1",
    "attack.drop-table-pseudocode=ACCEPTED_UNEXPECTEDLY errors=0",
    "attack.base-revision-mutation=ACCEPTED_UNEXPECTEDLY errors=0",
    "attack.asymmetric-finding-batch-map=ACCEPTED_UNEXPECTEDLY errors=0",
    "attack.workflow-dispatch-dispatch-logs-misclassification=ACCEPTED_UNEXPECTEDLY errors=0",
    "attack.hazard-get-service-role-misclassification=ACCEPTED_UNEXPECTEDLY errors=0",
    "attack.missing-b-to-a-negative-direction=ACCEPTED_UNEXPECTEDLY errors=0",
)
EXPECTED_CITED_SOURCE_PATHS = frozenset(
    {
        "app/api/agent/chat/route.ts",
        "app/api/agent/context/route.ts",
        "app/api/ask/route.ts",
        "app/api/ask/stream/route.ts",
        "app/api/briefing/run/route.ts",
        "app/api/briefing/settings/route.ts",
        "app/api/dispatch-logs/route.ts",
        "app/api/education-records/route.ts",
        "app/api/input-photos/hazard-analysis/route.ts",
        "app/api/knowledge/ingest/route.ts",
        "app/api/knowledge/regenerate/route.ts",
        "app/api/mcp-tokens/[id]/route.ts",
        "app/api/mcp-tokens/route.ts",
        "app/api/mcp/[transport]/route.ts",
        "app/api/ontology/graph/route.ts",
        "app/api/safety-reference/search/route.ts",
        "app/api/safety-reference/status/route.ts",
        "app/api/workers/route.ts",
        "app/api/workflow/dispatch/route.ts",
        "app/api/workpack/remediate/route.ts",
        "app/api/workpacks/[id]/improvements/route.ts",
        "app/api/workpacks/[id]/learning-export/route.ts",
        "app/api/workpacks/[id]/operation-graph/route.ts",
        "app/api/workpacks/[id]/read-confirmations/route.ts",
        "app/api/workpacks/[id]/route.ts",
        "app/api/workpacks/[id]/share-sessions/route.ts",
        "app/api/workpacks/route.ts",
        "app/ask/page.tsx",
        "app/evidence/page.tsx",
        "app/knowledge/page.tsx",
        "app/ontology/page.tsx",
        "app/ops/api/page.tsx",
        "lib/mcp-auth.ts",
        "lib/ontology/graph-store.ts",
        "lib/supabase-admin.ts",
        "lib/workpack-commercial.ts",
        "supabase/migrations/001_init.sql",
        "supabase/migrations/002_workspace_productization.sql",
        "supabase/migrations/003_knowledge_runtime.sql",
        "supabase/migrations/004_safety_reference_catalog.sql",
        "supabase/migrations/007_mcp_tokens.sql",
        "supabase/migrations/008_safety_ontology.sql",
        "supabase/migrations/010_commercial_operations.sql",
    }
)

REFERENCE_PATTERN = re.compile(
    r"^(?P<path>(?:app|lib|supabase|evaluation)/[^:]+):(?P<start>\d+)(?:-(?P<end>\d+))?$"
)
MARKDOWN_REFERENCE_PATTERN = re.compile(
    r"`((?:app|lib|supabase|evaluation)/[^`]+:\d+(?:-\d+)?)`"
)
SQL_FENCE_PATTERN = re.compile(r"```\s*(?:postgresql|postgres|psql|sql)\b", re.IGNORECASE)
SQL_STATEMENT_PATTERN = re.compile(
    r"""
    (?:^|[;\r\n])\s*
    (?:
        (?:create|alter|drop)\s+(?:or\s+replace\s+)?
            (?:table|schema|database|policy|function|procedure|trigger|role|extension|
               index|view|materialized\s+view|type|domain|sequence)\b
      | alter\s+default\s+privileges\b
      | drop\s+owned\s+by\b
      | reassign\s+owned\s+by\b
      | truncate(?:\s+table)?\s+[A-Za-z_\"][A-Za-z0-9_$\.\"]*
      | delete\s+from\b
      | insert\s+into\b
      | update\s+(?:only\s+)?[A-Za-z_\"][A-Za-z0-9_$\.\"]*\s+set\b
      | merge\s+into\b
      | with\b[^;\r\n]{0,1000}\b(?:delete\s+from|insert\s+into|
            update\s+(?:only\s+)?[A-Za-z_\"][A-Za-z0-9_$\.\"]*\s+set|merge\s+into)\b
      | grant\s+[^;\r\n]+\s+(?:on|to)\b
      | revoke\s+[^;\r\n]+\s+(?:on|from)\b
      | comment\s+on\b
      | security\s+label\s+on\b
      | refresh\s+materialized\s+view\b
      | (?:vacuum|analyze|reindex)\s+(?:table\s+)?[A-Za-z_\"][A-Za-z0-9_$\.\"]*\s*;
      | cluster\s+[A-Za-z_\"][A-Za-z0-9_$\.\"]*(?:\s+using\s+[A-Za-z_\"][A-Za-z0-9_$\.\"]*)?\s*;
      | lock\s+table\b
      | copy\s+[A-Za-z_\"][A-Za-z0-9_$\.\"]*\s+(?:to|from)\b
      | call\s+[A-Za-z_\"][A-Za-z0-9_$\.\"]*\s*\(
      | do\s+(?:\$\$|\$[A-Za-z_][A-Za-z0-9_]*\$)
      | execute\s+(?:[A-Za-z_\"][A-Za-z0-9_$\.\"]*|'.*?'|\$\$.*?\$\$)
            \s*(?:\([^;\r\n]*\))?\s*;
      | set\s+(?:role|session\s+authorization)\b
      | reset\s+(?:role|session\s+authorization)\b
      | (?:begin|commit|rollback)(?:\s+(?:transaction|work))?\s*;
      | \\(?:i|ir|include|include_relative|copy)\b
    )
    """,
    re.IGNORECASE | re.MULTILINE | re.VERBOSE,
)
SECRET_PATTERNS = [
    re.compile(r"\bsk-[A-Za-z0-9_-]{20,}\b"),
    re.compile(r"\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b"),
    re.compile(
        r"(?i)\b(?:SUPABASE_SERVICE_ROLE_KEY|SUPABASE_ANON_KEY)\b\s*[:=]\s*['\"][^'\"]+['\"]"
    ),
]


@dataclass
class ValidationResult:
    checks: int = 0
    reference_checks: int = 0
    markdown_checks: int = 0
    errors: list[str] = field(default_factory=list)

    def check(self, condition: bool, label: str, category: str = "general") -> None:
        self.checks += 1
        if category == "reference":
            self.reference_checks += 1
        elif category == "markdown":
            self.markdown_checks += 1
        if not condition:
            self.errors.append(label)


@dataclass(frozen=True)
class GitEvidence:
    branch: str
    head_revision: str
    audit_blob: str
    candidate_root_paths: tuple[str, ...]
    committed_paths: tuple[str, ...]
    working_paths: tuple[str, ...]
    product_delta_paths: tuple[str, ...]
    source_line_counts: dict[str, int]


class GitEvidenceError(RuntimeError):
    pass


def run_git(
    repo_root: Path,
    args: list[str],
    accepted_codes: tuple[int, ...] = (0,),
) -> subprocess.CompletedProcess[str]:
    try:
        completed = subprocess.run(
            ["git", *args],
            cwd=repo_root,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="strict",
            timeout=20,
            check=False,
        )
    except (OSError, subprocess.SubprocessError, UnicodeError) as error:
        raise GitEvidenceError(f"git {' '.join(args)} failed to run: {error}") from error
    if completed.returncode not in accepted_codes:
        detail = completed.stderr.strip() or completed.stdout.strip() or "no git diagnostic"
        raise GitEvidenceError(
            f"git {' '.join(args)} exited {completed.returncode}: {detail}"
        )
    return completed


def git_text(repo_root: Path, args: list[str]) -> str:
    return run_git(repo_root, args).stdout


def git_paths(repo_root: Path, args: list[str]) -> tuple[str, ...]:
    if "--" in args:
        separator_index = args.index("--")
        command = [*args[:separator_index], "-z", *args[separator_index:]]
    else:
        command = [*args, "-z"]
    raw = git_text(repo_root, command)
    return tuple(sorted(path for path in raw.split("\0") if path))


def git_file_text(repo_root: Path, revision: str, path: str) -> str:
    return git_text(repo_root, ["show", f"{revision}:{path}"])


def parse_json_text(raw: str, label: str) -> JsonDict:
    parsed = json.loads(raw)
    if not isinstance(parsed, dict):
        raise ValueError(f"JSON root must be an object: {label}")
    return parsed


def require_git_ancestor(repo_root: Path, ancestor: str, descendant: str) -> None:
    completed = run_git(
        repo_root,
        ["merge-base", "--is-ancestor", ancestor, descendant],
        accepted_codes=(0, 1),
    )
    if completed.returncode != 0:
        raise GitEvidenceError(
            f"required ancestor mismatch: {ancestor} is not an ancestor of {descendant}"
        )


def load_git_evidence(repo_root: Path) -> tuple[GitEvidence, JsonDict]:
    discovered_root = Path(git_text(repo_root, ["rev-parse", "--show-toplevel"]).strip()).resolve()
    if discovered_root != repo_root.resolve():
        raise GitEvidenceError(
            f"repository root mismatch: expected {repo_root.resolve()}, got {discovered_root}"
        )

    branch = git_text(repo_root, ["branch", "--show-current"]).strip()
    head_revision = git_text(repo_root, ["rev-parse", "HEAD^{commit}"]).strip()
    base_revision = git_text(
        repo_root, ["rev-parse", f"{AUTHORITATIVE_BASE_REVISION}^{{commit}}"]
    ).strip()
    evidence_root_revision = git_text(
        repo_root, ["rev-parse", f"{EVIDENCE_ROOT_REVISION}^{{commit}}"]
    ).strip()
    product_revision = git_text(
        repo_root, ["rev-parse", f"{AUDITED_PRODUCT_REVISION}^{{commit}}"]
    ).strip()
    if base_revision != AUTHORITATIVE_BASE_REVISION:
        raise GitEvidenceError(f"authoritative base resolved unexpectedly: {base_revision}")
    if evidence_root_revision != EVIDENCE_ROOT_REVISION:
        raise GitEvidenceError(
            f"evidence root resolved unexpectedly: {evidence_root_revision}"
        )
    if product_revision != AUDITED_PRODUCT_REVISION:
        raise GitEvidenceError(f"audited product resolved unexpectedly: {product_revision}")

    require_git_ancestor(repo_root, AUTHORITATIVE_BASE_REVISION, EVIDENCE_ROOT_REVISION)
    require_git_ancestor(repo_root, EVIDENCE_ROOT_REVISION, head_revision)

    audit_blob = git_text(
        repo_root,
        ["rev-parse", f"{AUTHORITATIVE_BASE_REVISION}:{AUDIT_RELATIVE_PATH}"],
    ).strip()
    audit_raw = git_file_text(repo_root, AUTHORITATIVE_BASE_REVISION, AUDIT_RELATIVE_PATH)
    audit = parse_json_text(audit_raw, f"{AUTHORITATIVE_BASE_REVISION}:{AUDIT_RELATIVE_PATH}")

    candidate_root_paths = git_paths(
        repo_root,
        ["diff", "--name-only", f"{AUTHORITATIVE_BASE_REVISION}..{EVIDENCE_ROOT_REVISION}", "--"],
    )
    committed_paths = git_paths(
        repo_root,
        ["diff", "--name-only", f"{AUTHORITATIVE_BASE_REVISION}..{head_revision}", "--"],
    )
    product_delta_paths = git_paths(
        repo_root,
        ["diff", "--name-only", f"{AUDITED_PRODUCT_REVISION}..{AUTHORITATIVE_BASE_REVISION}", "--", "app", "lib", "supabase"],
    )
    unstaged_paths = git_paths(repo_root, ["diff", "--name-only", "--"])
    staged_paths = git_paths(repo_root, ["diff", "--cached", "--name-only", "--"])
    untracked_paths = git_paths(
        repo_root, ["ls-files", "--others", "--exclude-standard"]
    )
    ignored_packet_paths = git_paths(
        repo_root,
        [
            "ls-files",
            "--others",
            "--ignored",
            "--exclude-standard",
            "--",
            PACKET_RELATIVE_DIR,
        ],
    )
    working_paths = tuple(
        sorted(
            set(unstaged_paths)
            | set(staged_paths)
            | set(untracked_paths)
            | set(ignored_packet_paths)
        )
    )

    source_line_counts: dict[str, int] = {}
    for path in sorted(EXPECTED_CITED_SOURCE_PATHS):
        source_line_counts[path] = len(
            git_file_text(repo_root, AUDITED_PRODUCT_REVISION, path).splitlines()
        )

    return (
        GitEvidence(
            branch=branch,
            head_revision=head_revision,
            audit_blob=audit_blob,
            candidate_root_paths=candidate_root_paths,
            committed_paths=committed_paths,
            working_paths=working_paths,
            product_delta_paths=product_delta_paths,
            source_line_counts=source_line_counts,
        ),
        audit,
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Validate the Supabase RLS remediation approval packet."
    )
    parser.add_argument(
        "--packet-dir",
        type=Path,
        default=Path(__file__).resolve().parent,
        help="Packet directory containing report.json and report.md.",
    )
    parser.add_argument(
        "--self-test",
        action="store_true",
        help="Run mutation-based rejection tests after the baseline validation.",
    )
    return parser.parse_args()


def read_json(path: Path) -> tuple[JsonDict, str]:
    raw = path.read_text(encoding="utf-8")
    return parse_json_text(raw, str(path)), raw


def as_dict(value: object) -> JsonDict:
    return value if isinstance(value, dict) else {}


def as_list(value: object) -> list[object]:
    return value if isinstance(value, list) else []


def as_string_list(value: object) -> list[str]:
    return [item for item in as_list(value) if isinstance(item, str)]


def get_path(root: JsonDict, *keys: str) -> object:
    current: object = root
    for key in keys:
        if not isinstance(current, dict):
            return None
        current = current.get(key)
    return current


def flatten_service_route_paths(audit: JsonDict) -> list[str]:
    service_routes = as_dict(audit.get("serviceRoleRoutes"))
    paths: list[str] = []
    for group_value in as_list(service_routes.get("groups")):
        group = as_dict(group_value)
        paths.extend(as_string_list(group.get("routes")))
    return paths


def collect_references(value: object) -> list[str]:
    references: list[str] = []
    if isinstance(value, str):
        if REFERENCE_PATTERN.fullmatch(value):
            references.append(value)
    elif isinstance(value, list):
        for item in value:
            references.extend(collect_references(item))
    elif isinstance(value, dict):
        for item in value.values():
            references.extend(collect_references(item))
    return references


def validate_reference(
    reference: str,
    source_line_counts: dict[str, int],
    result: ValidationResult,
) -> None:
    match = REFERENCE_PATTERN.fullmatch(reference)
    result.check(match is not None, f"invalid reference syntax: {reference}", "reference")
    if match is None:
        return

    source_path = match.group("path")
    line_count = source_line_counts.get(source_path)
    result.check(
        line_count is not None,
        f"reference file absent from pinned Git source set: {reference}",
        "reference",
    )
    if line_count is None:
        return

    start = int(match.group("start"))
    end = int(match.group("end") or start)
    result.check(start >= 1, f"reference start must be positive: {reference}", "reference")
    result.check(end >= start, f"reference range reversed: {reference}", "reference")
    result.check(end <= line_count, f"reference exceeds {line_count} lines: {reference}", "reference")


def validate_git_contract(
    packet: JsonDict,
    git_evidence: GitEvidence,
    result: ValidationResult,
) -> None:
    source = as_dict(packet.get("source"))
    result.check(git_evidence.branch == EXPECTED_BRANCH, "Git branch mismatch")
    result.check(git_evidence.audit_blob == AUDIT_GIT_BLOB, "authoritative audit Git blob mismatch")
    result.check(
        git_evidence.candidate_root_paths == EXPECTED_CANDIDATE_ROOT_PATHS,
        "evidence root changed-path set mismatch",
    )
    result.check(not git_evidence.product_delta_paths, "audited product changed before packet base")
    result.check(
        set(git_evidence.committed_paths).issubset(EXPECTED_PACKET_PATHS),
        "evidence descendant contains an undeclared committed path",
    )

    unexpected_working_paths = sorted(
        set(git_evidence.working_paths) - set(EXPECTED_PACKET_PATHS)
    )
    result.check(
        not unexpected_working_paths,
        f"worktree contains out-of-scope paths: {unexpected_working_paths}",
    )
    actual_packet_paths = sorted(
        set(git_evidence.committed_paths)
        | {
            path
            for path in git_evidence.working_paths
            if path.startswith(f"{PACKET_RELATIVE_DIR}/")
        }
    )
    result.check(
        actual_packet_paths == sorted(EXPECTED_PACKET_PATHS),
        f"actual packet changed-path set mismatch: {actual_packet_paths}",
    )

    expected_source_fields: dict[str, object] = {
        "packetBaseRevision": AUTHORITATIVE_BASE_REVISION,
        "auditArtifact": AUDIT_RELATIVE_PATH,
        "auditArtifactGitBlob": AUDIT_GIT_BLOB,
        "auditedProductRevision": AUDITED_PRODUCT_REVISION,
        "evidenceRootRevision": EVIDENCE_ROOT_REVISION,
        "externalIntegrationRevision": EXTERNAL_INTEGRATION_REVISION,
        "productSourceDeltaToPacketBase": "none for app, lib, and supabase",
        "evidenceDescendantPolicy": "HEAD must equal or descend from the evidence root and change only the immutable packet output set.",
        "evidenceMode": "read-only source and preserved redacted audit artifacts",
        "liveRefreshPerformedForPacket": False,
    }
    for key, expected in expected_source_fields.items():
        result.check(source.get(key) == expected, f"source contract drift: {key}")


def validate_audit_truth(packet: JsonDict, audit: JsonDict, result: ValidationResult) -> None:
    packet_truth = as_dict(packet.get("auditTruth"))
    audit_counts = as_dict(audit.get("counts"))
    audit_findings = as_dict(audit_counts.get("findings"))
    audit_app_class = as_dict(audit_counts.get("applicationClassification"))
    packet_findings = as_dict(packet_truth.get("findings"))
    packet_boundaries = as_dict(packet_truth.get("boundaries"))
    packet_rls = as_dict(packet_truth.get("rls"))
    packet_service = as_dict(packet_truth.get("serviceRoleSurfaces"))
    packet_negative = as_dict(packet_truth.get("negativeMatrix"))

    result.check(packet.get("schemaVersion") == "supabase-rls-remediation-approval-packet/v1", "schemaVersion mismatch")
    result.check(packet.get("packetType") == "approval-only", "packetType must remain approval-only")
    result.check(as_dict(audit.get("counts")) == EXPECTED_AUDIT_COUNTS, "pinned audit counts mismatch")
    audit_source = as_dict(audit.get("source"))
    audit_contract = as_dict(audit.get("audit"))
    result.check(audit_source.get("sourceSha") == AUDITED_PRODUCT_REVISION, "audit source revision mismatch")
    result.check(audit_contract.get("auditedRevision") == AUDITED_PRODUCT_REVISION, "audit product revision mismatch")
    result.check(audit.get("launchReadiness") is False, "pinned audit launchReadiness must be false")
    result.check(audit.get("noMutation") is True, "pinned audit noMutation must be true")
    result.check(packet_truth.get("launchReadiness") is audit.get("launchReadiness"), "launchReadiness drift")
    result.check(packet_truth.get("launchReadiness") is False, "launchReadiness must be false")
    result.check(packet_truth.get("noMutation") is audit.get("noMutation"), "noMutation drift")
    result.check(packet_truth.get("noMutation") is True, "noMutation must be true")

    for severity in ("P0", "P1", "P2", "P3", "total"):
        result.check(
            packet_findings.get(severity) == audit_findings.get(severity),
            f"finding count drift for {severity}",
        )

    result.check(packet_boundaries.get("applicationTables") == audit_counts.get("applicationTables"), "application table count drift")
    result.check(packet_boundaries.get("managedTablesTouched") == audit_counts.get("managedTablesTouched"), "managed table count drift")
    result.check(
        packet_boundaries.get("additionalManagedTenantDataBoundaries")
        == audit_counts.get("additionalManagedTenantDataBoundariesInventoried"),
        "managed tenant boundary count drift",
    )
    result.check(packet_boundaries.get("total") == audit_counts.get("totalInventoriedTableObjects"), "total boundary count drift")

    result.check(packet_rls.get("enabledApplicationTables") == audit_counts.get("rlsEnabledApplicationTables"), "RLS-enabled count drift")
    result.check(packet_rls.get("missingApplicationTables") == audit_counts.get("rlsMissingApplicationTables"), "RLS-missing count drift")
    audit_missing = sorted(
        str(item.get("table"))
        for item_value in as_list(audit.get("inventory"))
        if (item := as_dict(item_value)).get("rls") == "not-enabled-in-migrations"
    )
    result.check(sorted(as_string_list(packet_rls.get("missingTableNames"))) == audit_missing, "RLS-missing table names drift")
    result.check(packet_rls.get("forceEnabledApplicationTables") == audit_counts.get("forceRlsApplicationTables"), "FORCE count drift")
    result.check(packet_rls.get("policies") == audit_counts.get("policies"), "policy count drift")
    result.check(packet_rls.get("policiesWithExplicitRole") == audit_counts.get("policiesWithExplicitRole"), "explicit-role policy count drift")
    result.check(packet_rls.get("tenantTables") == audit_app_class.get("tenant"), "tenant table count drift")

    service_pairs = {
        "tenantAdminRoutes": "serviceRoleTenantAdminEntryPoints",
        "directRoutes": "serviceRoleTenantAdminDirectEntryPoints",
        "brokerMediatedRoutes": "serviceRoleTenantAdminBrokerEntryPoints",
        "publicGlobalApiRoutes": "publicGlobalServiceRoleApiRoutes",
        "publicServerPages": "publicGlobalServiceRoleServerPageSurfaces",
        "publicHttpSurfaces": "publicGlobalServiceRoleHttpSurfaces",
    }
    for packet_key, audit_key in service_pairs.items():
        result.check(packet_service.get(packet_key) == audit_counts.get(audit_key), f"service surface count drift: {packet_key}")

    result.check(packet_negative.get("cases") == audit_counts.get("crossTenantNegativeCasesInventoried"), "negative case count drift")
    result.check(packet_negative.get("expectedDenyAssertions") == audit_counts.get("expectedCrossTenantDenyAssertions"), "expected deny count drift")
    result.check(packet_negative.get("executedAssertions") == audit_counts.get("crossTenantRuntimeCasesExecuted"), "executed deny count drift")
    result.check(packet_negative.get("executedAssertions") == 0, "packet must preserve zero executed assertions")
    decision = as_dict(packet.get("decisionState"))
    result.check(decision.get("launchReadiness") is False, "decision launchReadiness must be false")
    result.check(
        decision.get("implementationAllowedByThisPacket") is False,
        "implementationAllowedByThisPacket must remain false",
    )


def validate_scope(packet: JsonDict, packet_dir: Path, result: ValidationResult) -> None:
    scope = as_dict(packet.get("scope"))
    required_true = ("noImplementation", "noMigrationSql", "noDatabaseMutation", "noNetworkDataMutation", "noLiveCredentials")
    for key in required_true:
        result.check(scope.get(key) is True, f"scope safety flag missing or false: {key}")

    allowed = as_string_list(scope.get("allowedWritePrefixes"))
    produced = as_string_list(scope.get("producedPaths"))
    result.check(
        allowed == [f"{PACKET_RELATIVE_DIR}/"],
        "allowedWritePrefixes must equal the evaluation-only packet directory",
    )
    result.check(
        produced == list(EXPECTED_PACKET_PATHS),
        "producedPaths must equal the immutable packet output set",
    )
    result.check(
        as_string_list(scope.get("forbiddenImplementationPrefixes"))
        == ["supabase/", "app/", "lib/", "components/", "tests/", "__tests__/"],
        "forbiddenImplementationPrefixes drift",
    )
    for path in produced:
        is_allowed = any(
            path.startswith(prefix) if prefix.endswith("/") else path == prefix
            for prefix in allowed
        )
        result.check(is_allowed, f"produced path outside write scope: {path}")
        result.check(not path.startswith("supabase/migrations/"), f"migration path produced: {path}")

    required_files = [
        "report.json",
        "report.md",
        "validate_packet.py",
        "logs/validator.log",
        "logs/tdd-red.log",
    ]
    for filename in required_files:
        result.check((packet_dir / filename).is_file(), f"required packet file missing: {filename}")


def validate_findings(packet: JsonDict, audit: JsonDict, result: ValidationResult) -> None:
    packet_findings = [as_dict(item) for item in as_list(packet.get("findings"))]
    audit_findings = [as_dict(item) for item in as_list(audit.get("findings"))]
    result.check(len(packet_findings) == len(audit_findings) == 10, "finding inventory must contain 10 entries")

    packet_by_id = {str(item.get("id")): item for item in packet_findings}
    audit_by_id = {str(item.get("id")): item for item in audit_findings}
    result.check(len(packet_by_id) == len(packet_findings), "duplicate packet finding ID")
    result.check(len(audit_by_id) == len(audit_findings), "duplicate audit finding ID")
    result.check(set(packet_by_id) == set(audit_by_id), "finding IDs drift from audit")

    for finding_id, audit_finding in audit_by_id.items():
        finding = packet_by_id.get(finding_id, {})
        result.check(finding.get("severity") == audit_finding.get("priority"), f"severity drift: {finding_id}")
        result.check(finding.get("title") == audit_finding.get("title"), f"title drift: {finding_id}")
        result.check(finding.get("tables") == audit_finding.get("tables"), f"table mapping drift: {finding_id}")
        result.check(finding.get("evidence") == audit_finding.get("evidence"), f"evidence mapping drift: {finding_id}")
        result.check(len(as_string_list(finding.get("exploitPrerequisites"))) > 0, f"exploit prerequisites missing: {finding_id}")
        result.check(len(as_string_list(finding.get("falsePositiveCaveats"))) > 0, f"false-positive caveats missing: {finding_id}")
        owner = as_dict(finding.get("remediationOwner"))
        result.check(isinstance(owner.get("primary"), str) and bool(owner.get("primary")), f"primary remediation owner missing: {finding_id}")
        result.check(
            tuple(as_string_list(finding.get("batchIds")))
            == EXPECTED_FINDING_BATCHES.get(finding_id),
            f"exact approval batch mapping drift: {finding_id}",
        )
        result.check(finding.get("status") == "open-not-remediated", f"finding closure claimed: {finding_id}")
        routes_value = finding.get("routes")
        result.check(isinstance(routes_value, list), f"routes must be an array: {finding_id}")
        normalized_routes: list[tuple[str, tuple[str, ...], str]] = []
        for route_value in as_list(routes_value):
            route = as_dict(route_value)
            result.check(isinstance(route.get("httpPath"), str), f"route path missing: {finding_id}")
            result.check(len(as_string_list(route.get("methods"))) > 0, f"route methods missing: {finding_id}")
            result.check(REFERENCE_PATTERN.fullmatch(str(route.get("sourceRef"))) is not None, f"route sourceRef invalid: {finding_id}")
            normalized_routes.append(
                (
                    str(route.get("httpPath")),
                    tuple(as_string_list(route.get("methods"))),
                    str(route.get("sourceRef")),
                )
            )
        result.check(
            tuple(normalized_routes) == EXPECTED_FINDING_ROUTES.get(finding_id),
            f"finding route contract drift: {finding_id}",
        )


def validate_approvals(packet: JsonDict, result: ValidationResult) -> None:
    batches = [as_dict(item) for item in as_list(packet.get("approvalDecisionTable"))]
    by_id = {str(item.get("id")): item for item in batches}
    result.check(len(by_id) == len(batches), "duplicate approval batch ID")
    result.check(list(by_id) == ["A", "B", "C", "D", "E"], "approval batches must be A through E in order")
    expected_hard_gate = {"A": True, "B": False, "C": True, "D": True, "E": True}
    for batch_id, expected_gate in expected_hard_gate.items():
        batch = by_id.get(batch_id, {})
        result.check(batch.get("requiresExplicitUserApproval") is True, f"explicit approval missing: Batch {batch_id}")
        result.check(batch.get("hardSafetyGate") is expected_gate, f"hard safety gate drift: Batch {batch_id}")
        result.check(batch.get("implementationAllowedByThisPacket") is False, f"implementation authorized by packet: Batch {batch_id}")
        result.check(isinstance(batch.get("smallestSafeScope"), str) and bool(batch.get("smallestSafeScope")), f"scope missing: Batch {batch_id}")
        result.check(
            tuple(as_string_list(batch.get("findingIds")))
            == EXPECTED_BATCH_FINDINGS[batch_id],
            f"exact finding map drift: Batch {batch_id}",
        )
        result.check(isinstance(batch.get("rollbackUnit"), str) and bool(batch.get("rollbackUnit")), f"rollback unit missing: Batch {batch_id}")

    reverse_from_batches: dict[str, list[str]] = {
        finding_id: [] for finding_id in EXPECTED_FINDING_BATCHES
    }
    for batch_id, finding_ids in EXPECTED_BATCH_FINDINGS.items():
        for finding_id in finding_ids:
            reverse_from_batches[finding_id].append(batch_id)
    result.check(
        {
            finding_id: tuple(batch_ids)
            for finding_id, batch_ids in reverse_from_batches.items()
        }
        == EXPECTED_FINDING_BATCHES,
        "internal expected finding/batch contract is not bidirectional",
    )

    packet_finding_batches = {
        str(finding.get("id")): tuple(as_string_list(finding.get("batchIds")))
        for finding_value in as_list(packet.get("findings"))
        if (finding := as_dict(finding_value))
    }
    batch_finding_pairs = {
        (finding_id, batch_id)
        for batch_id, batch in by_id.items()
        for finding_id in as_string_list(batch.get("findingIds"))
    }
    finding_batch_pairs = {
        (finding_id, batch_id)
        for finding_id, batch_ids in packet_finding_batches.items()
        for batch_id in batch_ids
    }
    result.check(
        finding_batch_pairs == batch_finding_pairs,
        "finding-to-batch and batch-to-finding mappings must be exact bidirectional sets",
    )

    result.check(
        tuple(as_string_list(packet.get("actionsNotRequiringAdditionalApprovalForThisPacket")))
        == EXPECTED_NO_APPROVAL_ACTIONS,
        "no-approval action contract drift",
    )
    result.check(
        tuple(as_string_list(packet.get("actionsRequiringExplicitApprovalBeforeExecution")))
        == EXPECTED_REQUIRED_APPROVAL_ACTIONS,
        "required approval action contract drift",
    )


def validate_policy_semantics(packet: JsonDict, audit: JsonDict, result: ValidationResult) -> None:
    semantics = as_dict(packet.get("proposedPolicySemantics"))
    result.check(semantics.get("pseudocodeOnly") is True, "policy semantics must be pseudocode-only")
    result.check(semantics.get("executableSqlIncluded") is False, "executable SQL must be absent")

    boundary_rows = [as_dict(item) for item in as_list(packet.get("boundaryCatalog"))]
    boundaries_by_id = {str(item.get("id")): item for item in boundary_rows}
    result.check(
        len(boundaries_by_id) == len(boundary_rows),
        "duplicate boundary inventory ID",
    )
    for boundary_id, expected_routes in EXPECTED_BOUNDARY_ROUTES.items():
        boundary = boundaries_by_id.get(boundary_id, {})
        result.check(
            tuple(as_string_list(boundary.get("routes"))) == expected_routes,
            f"boundary route contract drift: {boundary_id}",
        )

    audit_tenant_tables = {
        str(item.get("table"))
        for item_value in as_list(audit.get("inventory"))
        if (item := as_dict(item_value)).get("classification") == "tenant"
    }
    command_rows = [as_dict(item) for item in as_list(semantics.get("tenantCommandMatrix"))]
    command_tables = {str(item.get("table")) for item in command_rows}
    result.check(len(command_rows) == 13, "tenant command matrix must contain 13 rows")
    result.check(command_tables == audit_tenant_tables, "tenant command matrix table set drift")
    result.check(set(as_string_list(semantics.get("explicitNewRowCheckTables"))) == audit_tenant_tables, "explicit new-row-check table set drift")
    for row in command_rows:
        table = str(row.get("table"))
        for command in ("SELECT", "INSERT", "UPDATE", "DELETE"):
            result.check(isinstance(row.get(command), str) and bool(row.get(command)), f"{command} semantics missing: {table}")
        result.check("authenticated" in as_string_list(row.get("roles")), f"authenticated role missing: {table}")
        result.check(isinstance(row.get("serviceRoleBoundary"), str), f"service-role boundary missing: {table}")

    role_model = as_dict(packet.get("roleModel"))
    result.check(set(role_model) == {"authenticated", "anon", "service_role"}, "role model must contain authenticated, anon, and service_role")
    service_role = as_dict(role_model.get("service_role"))
    result.check(service_role.get("bypassesRls") is True, "service_role bypass truth missing")
    result.check(service_role.get("forceRlsConstrainsServiceRole") is False, "FORCE/service_role semantics drift")


def validate_service_surfaces(packet: JsonDict, audit: JsonDict, result: ValidationResult) -> None:
    surface = as_dict(packet.get("serviceRoleSurface"))
    tenant_routes = [as_dict(item) for item in as_list(surface.get("tenantAdminRoutes"))]
    audit_paths = flatten_service_route_paths(audit)
    packet_paths = [str(item.get("path")) for item in tenant_routes]
    result.check(packet_paths == audit_paths, "tenant/admin service-role route paths drift")
    result.check(len(tenant_routes) == 21, "tenant/admin route count must be 21")
    result.check(sum(item.get("kind") == "direct" for item in tenant_routes) == 19, "direct service-role route count must be 19")
    result.check(sum(item.get("kind") == "broker-mediated" for item in tenant_routes) == 2, "broker route count must be 2")
    routes_by_http_path = {str(item.get("httpPath")): item for item in tenant_routes}
    result.check(
        len(routes_by_http_path) == len(tenant_routes),
        "duplicate tenant/admin HTTP route",
    )
    result.check(
        set(routes_by_http_path) == set(EXPECTED_SERVICE_ROUTE_METHODS),
        "tenant/admin HTTP route set drift",
    )
    for route in tenant_routes:
        http_path = str(route.get("httpPath"))
        result.check(
            tuple(as_string_list(route.get("methods")))
            == EXPECTED_SERVICE_ROUTE_METHODS.get(http_path),
            f"service route method contract drift: {http_path}",
        )
        result.check(REFERENCE_PATTERN.fullmatch(str(route.get("sourceRef"))) is not None, f"service route sourceRef invalid: {route.get('path')}")

    workflow_route = routes_by_http_path.get("/api/workflow/dispatch", {})
    result.check(
        workflow_route.get("sourceRef")
        == "app/api/workflow/dispatch/route.ts:218-310",
        "workflow dispatch source range drift",
    )
    result.check(
        workflow_route.get("accessSemantics") == WORKFLOW_DISPATCH_SEMANTICS,
        "workflow dispatch authorization semantics drift",
    )
    result.check(
        as_string_list(workflow_route.get("accessedTables"))
        == ["workpacks", "workpack_share_sessions"],
        "workflow dispatch accessed-table contract drift",
    )

    hazard_route = routes_by_http_path.get("/api/input-photos/hazard-analysis", {})
    result.check(
        hazard_route.get("sourceRef")
        == "app/api/input-photos/hazard-analysis/route.ts:50-68",
        "hazard POST source range drift",
    )
    result.check(
        hazard_route.get("accessSemantics") == HAZARD_POST_SEMANTICS,
        "hazard POST service-role semantics drift",
    )
    result.check(
        as_string_list(hazard_route.get("accessedTables")) == [],
        "hazard POST must not claim application-table access",
    )
    readiness = as_dict(hazard_route.get("publicReadiness"))
    result.check(readiness.get("method") == "GET", "hazard readiness method must be GET")
    result.check(
        readiness.get("sourceRef")
        == "app/api/input-photos/hazard-analysis/route.ts:46-48",
        "hazard readiness source range drift",
    )
    result.check(
        readiness.get("accessSemantics") == HAZARD_GET_SEMANTICS,
        "hazard GET public-readiness semantics drift",
    )
    result.check(
        readiness.get("usesServiceRole") is False
        and readiness.get("requiresAuthentication") is False,
        "hazard GET must remain public and service-role-free",
    )

    public_surfaces = [as_dict(item) for item in as_list(surface.get("publicGlobalSurfaces"))]
    packet_api_paths = [str(item.get("path")) for item in public_surfaces if item.get("kind") == "api"]
    packet_page_paths = [str(item.get("path")) for item in public_surfaces if item.get("kind") == "server-page"]
    audit_service = as_dict(audit.get("serviceRoleRoutes"))
    result.check(packet_api_paths == as_string_list(audit_service.get("publicGlobalApiRoutes")), "public API surface paths drift")
    result.check(packet_page_paths == as_string_list(audit_service.get("publicServerPageSurfaces")), "public server page paths drift")
    result.check(len(packet_api_paths) == 6, "public API count must be 6")
    result.check(len(packet_page_paths) == 5, "public page count must be 5")
    result.check(len(public_surfaces) == 11, "public HTTP surface count must be 11")


def validate_test_plan(packet: JsonDict, audit: JsonDict, result: ValidationResult) -> None:
    test_plan = as_dict(packet.get("testPlan"))
    result.check(test_plan.get("currentExecutionStatus") == "not_executed", "test plan execution status drift")
    result.check(isinstance(test_plan.get("executionClaim"), str) and "No test" in str(test_plan.get("executionClaim")), "no-execution claim missing")

    direction_cases = [
        as_dict(item) for item in as_list(test_plan.get("directionCases"))
    ]
    direction_by_id = {str(item.get("id")): item for item in direction_cases}
    result.check(
        list(direction_by_id) == list(EXPECTED_DIRECTION_CASES),
        "direction case order must be A-to-B then B-to-A",
    )
    result.check(
        len(direction_by_id) == len(direction_cases) == 2,
        "direction cases must be unique and symmetric",
    )
    for direction_id, expected in EXPECTED_DIRECTION_CASES.items():
        direction = direction_by_id.get(direction_id, {})
        for key, expected_value in expected.items():
            result.check(
                direction.get(key) == expected_value,
                f"direction contract drift: {direction_id}.{key}",
            )

    packet_matrix = [as_dict(item) for item in as_list(test_plan.get("negativeMatrix"))]
    audit_matrix = [as_dict(item) for item in as_list(audit.get("crossTenantNegativeMatrix"))]
    result.check(len(packet_matrix) == len(audit_matrix) == 14, "negative matrix must contain 14 cases")
    result.check(
        [item.get("boundary") for item in packet_matrix] == [item.get("table") for item in audit_matrix],
        "negative matrix boundary order drift",
    )

    negative_assertion_count = 0
    positive_assertion_count = 0
    expected_commands = {"SELECT", "INSERT", "UPDATE", "DELETE"}
    for case in packet_matrix:
        boundary = str(case.get("boundary"))
        commands = as_string_list(case.get("commands"))
        direction_ids = as_string_list(case.get("directionIds"))
        result.check(len(commands) == 4 and set(commands) == expected_commands, f"command matrix drift: {boundary}")
        result.check(
            direction_ids == ["A-to-B", "B-to-A"],
            f"symmetric direction coverage drift: {boundary}",
        )
        result.check(case.get("expectedForeignOutcomePerCommand") == "deny", f"expected foreign outcome must deny: {boundary}")
        result.check(case.get("preExecutionStatus") == "not_executed", f"pre execution claimed: {boundary}")
        result.check(case.get("postExecutionStatus") == "not_executed", f"post execution claimed: {boundary}")
        result.check(isinstance(case.get("withCheckCase"), str) and bool(case.get("withCheckCase")), f"WITH CHECK case missing: {boundary}")
        result.check(
            isinstance(case.get("foreignTargetTemplate"), str)
            and "{foreignTenant}" in str(case.get("foreignTargetTemplate")),
            f"foreign target template missing: {boundary}",
        )
        result.check(
            isinstance(case.get("ownTenantPositiveControl"), str)
            and "{ownTenant}" in str(case.get("ownTenantPositiveControl")),
            f"same-tenant positive control missing: {boundary}",
        )
        negative_assertion_count += len(commands) * len(direction_ids)
        positive_assertion_count += len(direction_ids)

    accounting = as_dict(test_plan.get("negativeAssertionAccounting"))
    result.check(negative_assertion_count == 112, "symmetric negative assertions must total 112")
    result.check(positive_assertion_count == 28, "matrix positive controls must total 28")
    result.check(
        accounting == EXPECTED_SYMMETRIC_ACCOUNTING,
        "symmetric negative/positive assertion accounting drift",
    )

    positive_controls = [
        as_dict(item) for item in as_list(test_plan.get("sameTenantPositiveControls"))
    ]
    result.check(
        [item.get("id") for item in positive_controls]
        == [
            "POS-ORG",
            "POS-WORKPACK",
            "POS-HISTORY",
            "POS-SHARE",
            "POS-MCP",
            "POS-PUBLIC",
            "POS-STORAGE",
        ],
        "positive control scenario set drift",
    )
    for control in positive_controls:
        control_id = str(control.get("id"))
        expected_directions = (
            ["anon-public"]
            if control_id == "POS-PUBLIC"
            else ["A-to-B", "B-to-A"]
        )
        result.check(
            as_string_list(control.get("directionIds")) == expected_directions,
            f"positive control direction drift: {control_id}",
        )
        result.check(
            control.get("status") == "not_executed",
            f"positive control execution claimed: {control_id}",
        )

    fixtures = as_dict(test_plan.get("fixtures"))
    for key in ("organizationA", "organizationB", "siteA", "siteB", "authenticatedA", "authenticatedB", "anon", "serviceRole"):
        result.check(isinstance(fixtures.get(key), str) and bool(fixtures.get(key)), f"fixture missing: {key}")

    service_tests = as_dict(test_plan.get("serviceRoleTests"))
    result.check(service_tests.get("routeCount") == 21, "service-role test route count drift")
    result.check(service_tests.get("directCount") == 19, "service-role direct test count drift")
    result.check(service_tests.get("brokerMediatedCount") == 2, "service-role broker test count drift")
    public_tests = as_dict(test_plan.get("publicSurfaceTests"))
    result.check(public_tests.get("apiCount") == 6, "public test API count drift")
    result.check(public_tests.get("serverPageCount") == 5, "public test page count drift")
    result.check(public_tests.get("httpSurfaceCount") == 11, "public test surface count drift")


def validate_rollout(packet: JsonDict, result: ValidationResult) -> None:
    rollout = as_dict(packet.get("rolloutPlan"))
    result.check(rollout.get("stagingFirst") is True, "staging-first flag missing")
    result.check(rollout.get("productionAuthorized") is False, "production authorization must remain false")
    for key in (
        "backupAndEvidenceCapture",
        "preChangeDataIntegrityChecks",
        "rehearsalSequence",
        "postChangeDataIntegrityChecks",
        "launchGate",
    ):
        result.check(len(as_string_list(rollout.get(key))) > 0, f"rollout section missing: {key}")
    rollback = as_dict(rollout.get("rollback"))
    result.check(set(rollback) == {"A", "B", "C", "D", "E"}, "rollback map must cover A through E")
    telemetry = as_dict(rollout.get("telemetry"))
    result.check(len(as_string_list(telemetry.get("events"))) > 0, "telemetry events missing")
    result.check(len(as_string_list(telemetry.get("forbiddenFields"))) > 0, "telemetry forbidden fields missing")
    result.check(len(as_string_list(telemetry.get("stopSignals"))) > 0, "telemetry stop signals missing")


def validate_validation_contract(
    packet: JsonDict,
    packet_dir: Path,
    result: ValidationResult,
) -> None:
    contract = as_dict(packet.get("validationContract"))
    attacks = [as_dict(item) for item in as_list(contract.get("attackCases"))]
    controls = [as_dict(item) for item in as_list(contract.get("controlCases"))]
    result.check(
        tuple(str(item.get("id")) for item in attacks) == EXPECTED_ATTACK_IDS,
        "validation attack case set drift",
    )
    result.check(
        all(item.get("expectedValidatorResult") == "reject" for item in attacks),
        "validation attack expected result drift",
    )
    result.check(
        len(controls) == 1
        and controls[0].get("id") == "quoted-sql-explanatory-prose"
        and controls[0].get("expectedValidatorResult") == "accept",
        "quoted explanatory prose control drift",
    )

    red = as_dict(contract.get("tddRedEvidence"))
    result.check(
        red.get("log") == f"{PACKET_RELATIVE_DIR}/logs/tdd-red.log",
        "TDD RED log path drift",
    )
    result.check(red.get("head") == EVIDENCE_ROOT_REVISION, "TDD RED head drift")
    result.check(red.get("exitCode") == 1, "TDD RED exit code drift")
    result.check(red.get("attacksTotal") == 13, "TDD RED attack count drift")
    result.check(red.get("rejected") == 4, "TDD RED rejected count drift")
    result.check(red.get("acceptedUnexpectedly") == 9, "TDD RED false-green count drift")
    result.check(
        tuple(as_string_list(red.get("exactResults"))) == EXPECTED_TDD_RED_RESULTS,
        "TDD RED exact result set drift",
    )

    latest = as_dict(contract.get("latestValidatedResult"))
    expected_latest: dict[str, object] = {
        "command": f"python -B {PACKET_RELATIVE_DIR}/validate_packet.py --self-test",
        "exitCode": 0,
        "baseline": "PASS",
        "attacksTotal": 25,
        "attacksRejected": 25,
        "controlsTotal": 1,
        "controlsAccepted": 1,
        "runtimeClaimsMade": False,
        "launchReadiness": False,
    }
    result.check(latest == expected_latest, "latest validated result contract drift")

    red_log_path = packet_dir / "logs" / "tdd-red.log"
    try:
        red_log = red_log_path.read_text(encoding="utf-8")
    except OSError as error:
        result.check(False, f"TDD RED log unreadable: {error}")
        return
    for expected_line in EXPECTED_TDD_RED_RESULTS:
        result.check(
            expected_line in red_log,
            f"TDD RED log missing exact result: {expected_line}",
        )
    result.check(
        "attacks.total=13 rejected=4" in red_log,
        "TDD RED aggregate result missing",
    )


def validate_markdown(packet: JsonDict, markdown: str, result: ValidationResult) -> None:
    required_markers = [
        "launchReadiness=false",
        "noMutation=true",
        "implementationAllowedByThisPacket=false",
        "P0/P1/P2/P3=0/3/4/3",
        "Audit SPEC PASS != launch PASS",
        "14 x 4 = 56",
        "14 x 2 x 4 = 112",
        "same-tenant positive controls=28",
        "A-to-B",
        "B-to-A",
        "does not access `dispatch_logs`",
        "GET is public readiness; service-role authentication applies to POST only",
        "현재는 위 조건을 충족했다고 주장하지 않는다.",
    ]
    for marker in required_markers:
        result.check(marker in markdown, f"Markdown marker missing: {marker}", "markdown")

    result.check(re.search(r"[가-힣]", markdown) is not None, "report.md must contain Korean text", "markdown")
    result.check("launchReadiness=true" not in markdown, "Markdown claims launch readiness", "markdown")

    for finding_value in as_list(packet.get("findings")):
        finding = as_dict(finding_value)
        finding_id = str(finding.get("id"))
        title = str(finding.get("title"))
        result.check(finding_id in markdown, f"finding ID absent from Markdown: {finding_id}", "markdown")
        result.check(title in markdown, f"finding title absent from Markdown: {finding_id}", "markdown")
        for evidence in as_string_list(finding.get("evidence")):
            result.check(evidence in markdown, f"finding evidence absent from Markdown: {finding_id} {evidence}", "markdown")

    for batch_id in ("A", "B", "C", "D", "E"):
        result.check(f"| {batch_id} |" in markdown, f"approval table row absent from Markdown: {batch_id}", "markdown")


def iter_string_values(value: object, path: str = "$") -> Iterator[tuple[str, str]]:
    if isinstance(value, str):
        yield path, value
    elif isinstance(value, list):
        for index, item in enumerate(value):
            yield from iter_string_values(item, f"{path}[{index}]")
    elif isinstance(value, dict):
        for key, item in value.items():
            yield from iter_string_values(item, f"{path}.{key}")


def markdown_sql_candidates(markdown: str) -> Iterator[str]:
    for line in markdown.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        yield stripped
        without_prefix = re.sub(
            r"^(?:(?:[-*+]\s+|\d+\.\s+|>\s+))+",
            "",
            stripped,
        )
        if without_prefix != stripped:
            yield without_prefix
        if stripped.startswith("|"):
            for cell in stripped.strip("|").split("|"):
                candidate = cell.strip()
                if candidate:
                    yield candidate


def validate_forbidden_content(
    packet: JsonDict,
    json_text: str,
    markdown: str,
    result: ValidationResult,
) -> None:
    for value_path, value in iter_string_values(packet):
        result.check(
            SQL_FENCE_PATTERN.search(value) is None,
            f"SQL fence detected in JSON value: {value_path}",
        )
        result.check(
            SQL_STATEMENT_PATTERN.search(value) is None,
            f"executable SQL statement detected in JSON value: {value_path}",
        )
    result.check(
        SQL_FENCE_PATTERN.search(markdown) is None,
        "SQL fence detected in Markdown",
    )
    result.check(
        SQL_STATEMENT_PATTERN.search(markdown) is None,
        "executable SQL statement detected in Markdown",
    )
    markdown_statement = next(
        (
            candidate
            for candidate in markdown_sql_candidates(markdown)
            if SQL_STATEMENT_PATTERN.search(candidate) is not None
        ),
        None,
    )
    result.check(
        markdown_statement is None,
        f"executable SQL statement detected in Markdown structure: {markdown_statement}",
    )

    combined = f"{json_text}\n{markdown}"
    for pattern in SECRET_PATTERNS:
        result.check(pattern.search(combined) is None, f"secret-like content detected: {pattern.pattern}")


def validate_packet(
    packet: JsonDict,
    audit: JsonDict,
    json_text: str,
    markdown: str,
    packet_dir: Path,
    git_evidence: GitEvidence,
) -> ValidationResult:
    result = ValidationResult()
    validate_git_contract(packet, git_evidence, result)
    validate_audit_truth(packet, audit, result)
    validate_scope(packet, packet_dir, result)
    validate_findings(packet, audit, result)
    validate_approvals(packet, result)
    validate_policy_semantics(packet, audit, result)
    validate_service_surfaces(packet, audit, result)
    validate_test_plan(packet, audit, result)
    validate_rollout(packet, result)
    validate_validation_contract(packet, packet_dir, result)
    validate_markdown(packet, markdown, result)
    validate_forbidden_content(packet, json_text, markdown, result)

    json_references = collect_references(packet)
    markdown_references = MARKDOWN_REFERENCE_PATTERN.findall(markdown)
    result.check(len(json_references) > 0, "no JSON source references found", "reference")
    result.check(len(markdown_references) > 0, "no Markdown source references found", "reference")
    all_references = sorted(set(json_references) | set(markdown_references))
    cited_paths = {
        match.group("path")
        for reference in all_references
        if (match := REFERENCE_PATTERN.fullmatch(reference)) is not None
    }
    result.check(
        cited_paths == EXPECTED_CITED_SOURCE_PATHS,
        "cited Git source path set drift",
        "reference",
    )
    for reference in all_references:
        validate_reference(reference, git_evidence.source_line_counts, result)

    return result


def run_attack_cases(
    packet: JsonDict,
    audit: JsonDict,
    markdown: str,
    packet_dir: Path,
    git_evidence: GitEvidence,
) -> tuple[list[str], bool, int, int]:
    outputs: list[str] = []
    all_expected = True

    test_cases: list[tuple[str, JsonDict, JsonDict, str, bool]] = []

    stale_counts = copy.deepcopy(packet)
    stale_truth = as_dict(stale_counts.get("auditTruth"))
    stale_findings = as_dict(stale_truth.get("findings"))
    stale_findings["total"] = 9
    test_cases.append(("stale-finding-count", stale_counts, audit, markdown, True))

    stale_policy_packet = copy.deepcopy(packet)
    stale_policy_audit = copy.deepcopy(audit)
    stale_policy_truth = as_dict(stale_policy_packet.get("auditTruth"))
    as_dict(stale_policy_truth.get("rls"))["policies"] = 19
    as_dict(stale_policy_audit.get("counts"))["policies"] = 19
    test_cases.append(
        (
            "stale-policy-count-with-mutated-audit",
            stale_policy_packet,
            stale_policy_audit,
            markdown,
            True,
        )
    )

    missing_approval = copy.deepcopy(packet)
    approval_rows = as_list(missing_approval.get("approvalDecisionTable"))
    if approval_rows:
        as_dict(approval_rows[0]).pop("requiresExplicitUserApproval", None)
    test_cases.append(("missing-approval-flag", missing_approval, audit, markdown, True))

    deleted_approval_action = copy.deepcopy(packet)
    approval_actions = as_list(
        deleted_approval_action.get("actionsRequiringExplicitApprovalBeforeExecution")
    )
    if approval_actions:
        approval_actions.pop(0)
    test_cases.append(
        (
            "deleted-required-db-approval-action",
            deleted_approval_action,
            audit,
            markdown,
            True,
        )
    )

    migration_path = copy.deepcopy(packet)
    migration_scope = as_dict(migration_path.get("scope"))
    produced_paths = as_list(migration_scope.get("producedPaths"))
    produced_paths.append("supabase/migrations/999_packet_attack.sql")
    test_cases.append(
        ("accidental-migration-path", migration_path, audit, markdown, True)
    )

    undeclared_output_path = copy.deepcopy(packet)
    undeclared_scope = as_dict(undeclared_output_path.get("scope"))
    as_list(undeclared_scope.get("producedPaths")).append(
        "evaluation/rls-remediation-approval-packet-2026-07-14/rogue-output.sql"
    )
    test_cases.append(
        ("undeclared-output-path", undeclared_output_path, audit, markdown, True)
    )

    executable_sql = copy.deepcopy(packet)
    semantics = as_dict(executable_sql.get("proposedPolicySemantics"))
    semantics["attackPayload"] = "create policy packet_attack on protected_rows for select using (true);"
    test_cases.append(
        ("create-policy-pseudocode", executable_sql, audit, markdown, True)
    )

    drop_table = copy.deepcopy(packet)
    drop_semantics = as_dict(drop_table.get("proposedPolicySemantics"))
    drop_semantics["attackPayload"] = "DROP TABLE protected_rows;"
    test_cases.append(("drop-table-pseudocode", drop_table, audit, markdown, True))

    additional_sql_attacks = (
        ("alter-table-pseudocode", "ALTER TABLE protected_rows DISABLE ROW LEVEL SECURITY;"),
        ("truncate-table-pseudocode", "TRUNCATE TABLE protected_rows;"),
        ("delete-from-pseudocode", "DELETE FROM protected_rows;"),
        ("insert-into-pseudocode", "INSERT INTO protected_rows (id) VALUES (1);"),
        ("update-set-pseudocode", "UPDATE protected_rows SET owner_id = NULL;"),
        ("grant-pseudocode", "GRANT SELECT ON protected_rows TO anon;"),
        ("revoke-pseudocode", "REVOKE SELECT ON protected_rows FROM authenticated;"),
        ("do-block-pseudocode", "DO $$ BEGIN RAISE NOTICE 'attack'; END $$;"),
        ("psql-include-pseudocode", "\\i dangerous.sql"),
        (
            "with-delete-pseudocode",
            "WITH doomed AS (SELECT id FROM protected_rows) DELETE FROM protected_rows;",
        ),
    )
    for attack_id, payload in additional_sql_attacks:
        sql_mutant = copy.deepcopy(packet)
        sql_semantics = as_dict(sql_mutant.get("proposedPolicySemantics"))
        sql_semantics["attackPayload"] = payload
        test_cases.append((attack_id, sql_mutant, audit, markdown, True))

    markdown_sql = f"{markdown}\n\n- DROP TABLE protected_rows;\n"
    test_cases.append(
        (
            "markdown-bullet-drop-table",
            copy.deepcopy(packet),
            audit,
            markdown_sql,
            True,
        )
    )

    base_revision_mutation = copy.deepcopy(packet)
    as_dict(base_revision_mutation.get("source"))[
        "packetBaseRevision"
    ] = "0000000000000000000000000000000000000000"
    test_cases.append(
        ("base-revision-mutation", base_revision_mutation, audit, markdown, True)
    )

    asymmetric_mapping = copy.deepcopy(packet)
    asymmetric_batches = [
        as_dict(item)
        for item in as_list(asymmetric_mapping.get("approvalDecisionTable"))
    ]
    batch_a = next(
        (item for item in asymmetric_batches if item.get("id") == "A"), {}
    )
    batch_a_findings = as_list(batch_a.get("findingIds"))
    if "P1-01" in batch_a_findings:
        batch_a_findings.remove("P1-01")
    test_cases.append(
        ("asymmetric-finding-batch-map", asymmetric_mapping, audit, markdown, True)
    )

    workflow_misclassification = copy.deepcopy(packet)
    workflow_findings = [
        as_dict(item) for item in as_list(workflow_misclassification.get("findings"))
    ]
    p1_02 = next((item for item in workflow_findings if item.get("id") == "P1-02"), {})
    as_list(p1_02.get("routes")).append(
        {
            "httpPath": "/api/workflow/dispatch",
            "methods": ["POST"],
            "sourceRef": "app/api/workflow/dispatch/route.ts:218-310",
        }
    )
    workflow_boundaries = [
        as_dict(item)
        for item in as_list(workflow_misclassification.get("boundaryCatalog"))
    ]
    dispatch_boundary = next(
        (item for item in workflow_boundaries if item.get("id") == "BND-DISPATCH"),
        {},
    )
    as_list(dispatch_boundary.get("routes")).append("/api/workflow/dispatch")
    test_cases.append(
        (
            "workflow-dispatch-dispatch-logs-misclassification",
            workflow_misclassification,
            audit,
            markdown,
            True,
        )
    )

    hazard_get_service_role = copy.deepcopy(packet)
    hazard_surface = as_dict(hazard_get_service_role.get("serviceRoleSurface"))
    hazard_routes = [
        as_dict(item) for item in as_list(hazard_surface.get("tenantAdminRoutes"))
    ]
    hazard_route = next(
        (
            item
            for item in hazard_routes
            if item.get("httpPath") == "/api/input-photos/hazard-analysis"
        ),
        {},
    )
    as_list(hazard_route.get("methods")).insert(0, "GET")
    test_cases.append(
        (
            "hazard-get-service-role-misclassification",
            hazard_get_service_role,
            audit,
            markdown,
            True,
        )
    )

    missing_negative_direction = copy.deepcopy(packet)
    negative_plan = as_dict(missing_negative_direction.get("testPlan"))
    negative_matrix = [
        as_dict(item) for item in as_list(negative_plan.get("negativeMatrix"))
    ]
    if negative_matrix:
        direction_ids = as_list(negative_matrix[0].get("directionIds"))
        if "B-to-A" in direction_ids:
            direction_ids.remove("B-to-A")
    test_cases.append(
        (
            "missing-b-to-a-negative-direction",
            missing_negative_direction,
            audit,
            markdown,
            True,
        )
    )

    missing_positive_direction = copy.deepcopy(packet)
    positive_plan = as_dict(missing_positive_direction.get("testPlan"))
    positive_controls = [
        as_dict(item)
        for item in as_list(positive_plan.get("sameTenantPositiveControls"))
    ]
    if positive_controls:
        direction_ids = as_list(positive_controls[0].get("directionIds"))
        if "B-to-A" in direction_ids:
            direction_ids.remove("B-to-A")
    test_cases.append(
        (
            "missing-b-to-a-positive-control",
            missing_positive_direction,
            audit,
            markdown,
            True,
        )
    )

    quoted_prose = (
        f"{markdown}\n\n- \"DROP TABLE protected_rows;\" is a quoted forbidden example, "
        "not executable material.\n"
    )
    test_cases.append(
        ("quoted-sql-explanatory-prose", copy.deepcopy(packet), audit, quoted_prose, False)
    )

    attack_count = 0
    control_count = 0
    for case_id, mutant, mutant_audit, mutant_markdown, should_reject in test_cases:
        mutant_text = json.dumps(mutant, ensure_ascii=False, indent=2)
        attack_result = validate_packet(
            mutant,
            mutant_audit,
            mutant_text,
            mutant_markdown,
            packet_dir,
            git_evidence,
        )
        rejected = len(attack_result.errors) > 0
        expected = rejected if should_reject else not rejected
        all_expected = all_expected and expected
        if should_reject:
            attack_count += 1
            state = "REJECTED" if rejected else "ACCEPTED_UNEXPECTEDLY"
            prefix = "attack"
        else:
            control_count += 1
            state = "REJECTED_UNEXPECTEDLY" if rejected else "ACCEPTED"
            prefix = "control"
        outputs.append(f"{prefix}.{case_id}={state} errors={len(attack_result.errors)}")

    return outputs, all_expected, attack_count, control_count


def main() -> int:
    args = parse_args()
    packet_dir = args.packet_dir.resolve()
    repo_root = packet_dir.parents[1]
    packet_path = packet_dir / "report.json"
    markdown_path = packet_dir / "report.md"

    try:
        packet, packet_text = read_json(packet_path)
        markdown = markdown_path.read_text(encoding="utf-8")
        git_evidence, audit = load_git_evidence(repo_root)
    except (OSError, ValueError, json.JSONDecodeError, GitEvidenceError) as error:
        print(f"FAIL load_error={error}", file=sys.stderr)
        return 1

    result = validate_packet(
        packet,
        audit,
        packet_text,
        markdown,
        packet_dir,
        git_evidence,
    )

    if result.errors:
        print(f"FAIL packet_errors={len(result.errors)}")
        print(f"checks.total={result.checks}")
        print(f"checks.references={result.reference_checks}")
        print(f"checks.markdown={result.markdown_checks}")
        for error in result.errors:
            print(f"error={error}")
        return 1

    print("PASS packet")
    print(f"checks.total={result.checks}")
    print(f"checks.references={result.reference_checks}")
    print(f"checks.markdown={result.markdown_checks}")
    print(f"git.base={AUTHORITATIVE_BASE_REVISION}")
    print(f"git.product={AUDITED_PRODUCT_REVISION}")
    print(f"git.evidence_root={EVIDENCE_ROOT_REVISION}")
    print(f"git.evidence_head={git_evidence.head_revision}")
    print(f"git.changed_paths={len(EXPECTED_PACKET_PATHS)} product_delta_paths=0")
    print("findings.total=10 severity=P0:0,P1:3,P2:4,P3:3")
    print("boundaries.application=22 boundaries.total=24 rls.enabled=20 rls.missing=2 force=0 policies=20 tenant=13")
    print("service_routes.total=21 direct=19 broker=2 public_api=6 public_pages=5 public_http=11")
    print("audit_negative_cases=14 audit_expected_denials=56 executed=0")
    print("symmetric_negative_assertions=112 same_tenant_positive_controls=28 matrix_assertions_per_phase=140 executed=0")

    if args.self_test:
        attack_outputs, all_expected, attack_count, control_count = run_attack_cases(
            packet,
            audit,
            markdown,
            packet_dir,
            git_evidence,
        )
        for output in attack_outputs:
            print(output)
        rejected_count = sum(
            output.startswith("attack.") and "=REJECTED " in output
            for output in attack_outputs
        )
        accepted_control_count = sum(
            output.startswith("control.") and "=ACCEPTED " in output
            for output in attack_outputs
        )
        print(
            f"attacks.total={attack_count} rejected={rejected_count} "
            f"controls.total={control_count} accepted={accepted_control_count}"
        )
        if not all_expected:
            return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

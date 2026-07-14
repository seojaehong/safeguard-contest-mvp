from __future__ import annotations

import argparse
import copy
import json
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path


JsonDict = dict[str, object]

REFERENCE_PATTERN = re.compile(
    r"^(?P<path>(?:app|lib|supabase|evaluation)/[^:]+):(?P<start>\d+)(?:-(?P<end>\d+))?$"
)
MARKDOWN_REFERENCE_PATTERN = re.compile(
    r"`((?:app|lib|supabase|evaluation)/[^`]+:\d+(?:-\d+)?)`"
)
EXECUTABLE_SQL_PATTERNS = [
    re.compile(r"\bcreate\s+policy\b", re.IGNORECASE),
    re.compile(r"\bdrop\s+policy\b", re.IGNORECASE),
    re.compile(r"\balter\s+table\b", re.IGNORECASE),
    re.compile(r"\bcreate\s+(?:or\s+replace\s+)?function\b", re.IGNORECASE),
    re.compile(r"\bgrant\s+(?:select|insert|update|delete|execute|usage|all)\b", re.IGNORECASE),
    re.compile(r"\brevoke\s+(?:select|insert|update|delete|execute|usage|all)\b", re.IGNORECASE),
    re.compile(r"```sql", re.IGNORECASE),
]
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
    parsed = json.loads(raw)
    if not isinstance(parsed, dict):
        raise ValueError(f"JSON root must be an object: {path}")
    return parsed, raw


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


def validate_reference(reference: str, repo_root: Path, result: ValidationResult) -> None:
    match = REFERENCE_PATTERN.fullmatch(reference)
    result.check(match is not None, f"invalid reference syntax: {reference}", "reference")
    if match is None:
        return

    source_path = repo_root / match.group("path")
    result.check(source_path.is_file(), f"reference file missing: {reference}", "reference")
    if not source_path.is_file():
        return

    line_count = len(source_path.read_text(encoding="utf-8").splitlines())
    start = int(match.group("start"))
    end = int(match.group("end") or start)
    result.check(start >= 1, f"reference start must be positive: {reference}", "reference")
    result.check(end >= start, f"reference range reversed: {reference}", "reference")
    result.check(end <= line_count, f"reference exceeds {line_count} lines: {reference}", "reference")


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


def validate_scope(packet: JsonDict, packet_dir: Path, result: ValidationResult) -> None:
    scope = as_dict(packet.get("scope"))
    required_false = ("noImplementation", "noMigrationSql", "noDatabaseMutation", "noNetworkDataMutation", "noLiveCredentials")
    for key in required_false:
        result.check(scope.get(key) is True, f"scope safety flag missing or false: {key}")

    allowed = as_string_list(scope.get("allowedWritePrefixes"))
    produced = as_string_list(scope.get("producedPaths"))
    result.check(bool(allowed), "allowedWritePrefixes is empty")
    result.check(bool(produced), "producedPaths is empty")
    for path in produced:
        is_allowed = any(
            path.startswith(prefix) if prefix.endswith("/") else path == prefix
            for prefix in allowed
        )
        result.check(is_allowed, f"produced path outside write scope: {path}")
        result.check(not path.startswith("supabase/migrations/"), f"migration path produced: {path}")

    required_files = ["report.json", "report.md", "validate_packet.py"]
    for filename in required_files:
        result.check((packet_dir / filename).is_file(), f"required packet file missing: {filename}")


def validate_findings(packet: JsonDict, audit: JsonDict, result: ValidationResult) -> None:
    packet_findings = [as_dict(item) for item in as_list(packet.get("findings"))]
    audit_findings = [as_dict(item) for item in as_list(audit.get("findings"))]
    result.check(len(packet_findings) == len(audit_findings) == 10, "finding inventory must contain 10 entries")

    packet_by_id = {str(item.get("id")): item for item in packet_findings}
    audit_by_id = {str(item.get("id")): item for item in audit_findings}
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
        result.check(len(as_string_list(finding.get("batchIds"))) > 0, f"approval batch mapping missing: {finding_id}")
        result.check(finding.get("status") == "open-not-remediated", f"finding closure claimed: {finding_id}")
        routes_value = finding.get("routes")
        result.check(isinstance(routes_value, list), f"routes must be an array: {finding_id}")
        for route_value in as_list(routes_value):
            route = as_dict(route_value)
            result.check(isinstance(route.get("httpPath"), str), f"route path missing: {finding_id}")
            result.check(len(as_string_list(route.get("methods"))) > 0, f"route methods missing: {finding_id}")
            result.check(REFERENCE_PATTERN.fullmatch(str(route.get("sourceRef"))) is not None, f"route sourceRef invalid: {finding_id}")


def validate_approvals(packet: JsonDict, result: ValidationResult) -> None:
    batches = [as_dict(item) for item in as_list(packet.get("approvalDecisionTable"))]
    by_id = {str(item.get("id")): item for item in batches}
    result.check(list(by_id) == ["A", "B", "C", "D", "E"], "approval batches must be A through E in order")
    expected_hard_gate = {"A": True, "B": False, "C": True, "D": True, "E": True}
    for batch_id, expected_gate in expected_hard_gate.items():
        batch = by_id.get(batch_id, {})
        result.check(batch.get("requiresExplicitUserApproval") is True, f"explicit approval missing: Batch {batch_id}")
        result.check(batch.get("hardSafetyGate") is expected_gate, f"hard safety gate drift: Batch {batch_id}")
        result.check(batch.get("implementationAllowedByThisPacket") is False, f"implementation authorized by packet: Batch {batch_id}")
        result.check(isinstance(batch.get("smallestSafeScope"), str) and bool(batch.get("smallestSafeScope")), f"scope missing: Batch {batch_id}")
        result.check(len(as_string_list(batch.get("findingIds"))) > 0, f"finding map missing: Batch {batch_id}")
        result.check(isinstance(batch.get("rollbackUnit"), str) and bool(batch.get("rollbackUnit")), f"rollback unit missing: Batch {batch_id}")

    valid_batch_ids = set(by_id)
    for finding_value in as_list(packet.get("findings")):
        finding = as_dict(finding_value)
        for batch_id in as_string_list(finding.get("batchIds")):
            result.check(batch_id in valid_batch_ids, f"unknown batch {batch_id} in finding {finding.get('id')}")

    result.check(len(as_string_list(packet.get("actionsNotRequiringAdditionalApprovalForThisPacket"))) > 0, "no-approval action list missing")
    result.check(len(as_string_list(packet.get("actionsRequiringExplicitApprovalBeforeExecution"))) > 0, "approval-required action list missing")


def validate_policy_semantics(packet: JsonDict, audit: JsonDict, result: ValidationResult) -> None:
    semantics = as_dict(packet.get("proposedPolicySemantics"))
    result.check(semantics.get("pseudocodeOnly") is True, "policy semantics must be pseudocode-only")
    result.check(semantics.get("executableSqlIncluded") is False, "executable SQL must be absent")

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
    for route in tenant_routes:
        result.check(len(as_string_list(route.get("methods"))) > 0, f"service route methods missing: {route.get('path')}")
        result.check(REFERENCE_PATTERN.fullmatch(str(route.get("sourceRef"))) is not None, f"service route sourceRef invalid: {route.get('path')}")

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

    packet_matrix = [as_dict(item) for item in as_list(test_plan.get("negativeMatrix"))]
    audit_matrix = [as_dict(item) for item in as_list(audit.get("crossTenantNegativeMatrix"))]
    result.check(len(packet_matrix) == len(audit_matrix) == 14, "negative matrix must contain 14 cases")
    result.check(
        [item.get("boundary") for item in packet_matrix] == [item.get("table") for item in audit_matrix],
        "negative matrix boundary order drift",
    )

    assertion_count = 0
    expected_commands = {"SELECT", "INSERT", "UPDATE", "DELETE"}
    for case in packet_matrix:
        boundary = str(case.get("boundary"))
        commands = as_string_list(case.get("commands"))
        result.check(len(commands) == 4 and set(commands) == expected_commands, f"command matrix drift: {boundary}")
        result.check(case.get("expectedOutcomePerCommand") == "deny", f"expected outcome must deny: {boundary}")
        result.check(case.get("preExecutionStatus") == "not_executed", f"pre execution claimed: {boundary}")
        result.check(case.get("postExecutionStatus") == "not_executed", f"post execution claimed: {boundary}")
        result.check(isinstance(case.get("withCheckCase"), str) and bool(case.get("withCheckCase")), f"WITH CHECK case missing: {boundary}")
        assertion_count += len(commands)

    accounting = as_dict(test_plan.get("negativeAssertionAccounting"))
    result.check(assertion_count == 56, "expanded negative assertions must total 56")
    result.check(accounting.get("uniqueCases") == 14, "negative accounting case drift")
    result.check(accounting.get("commandsPerCase") == 4, "negative accounting command drift")
    result.check(accounting.get("uniqueAssertions") == 56, "negative accounting assertion drift")
    result.check(accounting.get("executedByPacket") == 0, "packet must execute zero negative assertions")

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


def validate_markdown(packet: JsonDict, markdown: str, result: ValidationResult) -> None:
    required_markers = [
        "launchReadiness=false",
        "noMutation=true",
        "P0/P1/P2/P3=0/3/4/3",
        "Audit SPEC PASS != launch PASS",
        "14 x 4 = 56",
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


def validate_forbidden_content(json_text: str, markdown: str, result: ValidationResult) -> None:
    combined = f"{json_text}\n{markdown}"
    for pattern in EXECUTABLE_SQL_PATTERNS:
        result.check(pattern.search(combined) is None, f"executable SQL-like content detected: {pattern.pattern}")
    for pattern in SECRET_PATTERNS:
        result.check(pattern.search(combined) is None, f"secret-like content detected: {pattern.pattern}")


def validate_packet(
    packet: JsonDict,
    audit: JsonDict,
    json_text: str,
    markdown: str,
    packet_dir: Path,
    repo_root: Path,
) -> ValidationResult:
    result = ValidationResult()
    validate_audit_truth(packet, audit, result)
    validate_scope(packet, packet_dir, result)
    validate_findings(packet, audit, result)
    validate_approvals(packet, result)
    validate_policy_semantics(packet, audit, result)
    validate_service_surfaces(packet, audit, result)
    validate_test_plan(packet, audit, result)
    validate_rollout(packet, result)
    validate_markdown(packet, markdown, result)
    validate_forbidden_content(json_text, markdown, result)

    json_references = collect_references(packet)
    markdown_references = MARKDOWN_REFERENCE_PATTERN.findall(markdown)
    result.check(len(json_references) > 0, "no JSON source references found", "reference")
    result.check(len(markdown_references) > 0, "no Markdown source references found", "reference")
    for reference in json_references:
        validate_reference(reference, repo_root, result)
    for reference in markdown_references:
        validate_reference(reference, repo_root, result)

    return result


def run_attack_cases(
    packet: JsonDict,
    audit: JsonDict,
    markdown: str,
    packet_dir: Path,
    repo_root: Path,
) -> tuple[list[str], bool]:
    outputs: list[str] = []
    all_rejected = True

    mutants: list[tuple[str, JsonDict]] = []

    stale_counts = copy.deepcopy(packet)
    stale_truth = as_dict(stale_counts.get("auditTruth"))
    stale_findings = as_dict(stale_truth.get("findings"))
    stale_findings["total"] = 9
    mutants.append(("stale-counts", stale_counts))

    missing_approval = copy.deepcopy(packet)
    approval_rows = as_list(missing_approval.get("approvalDecisionTable"))
    if approval_rows:
        as_dict(approval_rows[0]).pop("requiresExplicitUserApproval", None)
    mutants.append(("missing-approval", missing_approval))

    migration_path = copy.deepcopy(packet)
    migration_scope = as_dict(migration_path.get("scope"))
    produced_paths = as_list(migration_scope.get("producedPaths"))
    produced_paths.append("supabase/migrations/999_packet_attack.sql")
    mutants.append(("accidental-migration-path", migration_path))

    executable_sql = copy.deepcopy(packet)
    semantics = as_dict(executable_sql.get("proposedPolicySemantics"))
    semantics["attackPayload"] = "create policy packet_attack on protected_rows for select using (true);"
    mutants.append(("executable-sql", executable_sql))

    for attack_id, mutant in mutants:
        mutant_text = json.dumps(mutant, ensure_ascii=False, indent=2)
        attack_result = validate_packet(
            mutant,
            audit,
            mutant_text,
            markdown,
            packet_dir,
            repo_root,
        )
        rejected = len(attack_result.errors) > 0
        all_rejected = all_rejected and rejected
        state = "REJECTED" if rejected else "ACCEPTED_UNEXPECTEDLY"
        outputs.append(f"attack.{attack_id}={state} errors={len(attack_result.errors)}")

    return outputs, all_rejected


def main() -> int:
    args = parse_args()
    packet_dir = args.packet_dir.resolve()
    repo_root = packet_dir.parents[1]
    packet_path = packet_dir / "report.json"
    markdown_path = packet_dir / "report.md"
    audit_path = repo_root / "evaluation" / "supabase-rls-audit-2026-07-14" / "report.json"

    try:
        packet, packet_text = read_json(packet_path)
        audit, _ = read_json(audit_path)
        markdown = markdown_path.read_text(encoding="utf-8")
    except (OSError, ValueError, json.JSONDecodeError) as error:
        print(f"FAIL load_error={error}", file=sys.stderr)
        return 1

    result = validate_packet(
        packet,
        audit,
        packet_text,
        markdown,
        packet_dir,
        repo_root,
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
    print("findings.total=10 severity=P0:0,P1:3,P2:4,P3:3")
    print("boundaries.application=22 boundaries.total=24 rls.enabled=20 rls.missing=2 force=0 policies=20 tenant=13")
    print("service_routes.total=21 direct=19 broker=2 public_api=6 public_pages=5 public_http=11")
    print("negative_cases=14 expected_denials=56 executed=0")

    if args.self_test:
        attack_outputs, all_rejected = run_attack_cases(
            packet,
            audit,
            markdown,
            packet_dir,
            repo_root,
        )
        for output in attack_outputs:
            print(output)
        print(f"attacks.total={len(attack_outputs)} rejected={sum('=REJECTED' in output for output in attack_outputs)}")
        if not all_rejected:
            return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

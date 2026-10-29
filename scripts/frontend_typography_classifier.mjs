import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

// 타이포 역할 분류기 — 화면 감사 스크립트의 하나뿐인 구현(/correct 261027). vitest 계약은 감사를 돌린다.
// 표(역할·덮어쓰기)는 lib/frontend-design-contract.ts 에 있고, 쓰는 쪽이 읽어 넘긴다
// (감사 스크립트는 TS 를 실행하지 못해 AST 로 읽는다).

export function isInteractiveSelector(selector) {
  return /(^|[\s.:#>+~])(a|button|input|select|textarea)(?=$|[\s.:#>+~[])|\b(action|button|control|tab|chip|nav|link|toggle|filter)\b/i.test(selector);
}

export function browserHeadingRole(route, width, policy) {
  return policy.headingOverrides.find((entry) => entry.routes.includes(route)
    && width >= entry.minWidth && width <= entry.maxWidth)?.role ?? policy.defaultHeadingRole;
}

export function contractLiteral(source, exportName) {
  const ts = require("typescript");
  const sourceFile = ts.createSourceFile("frontend-design-contract.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const declaration = sourceFile.statements.filter(ts.isVariableStatement)
    .flatMap((statement) => [...statement.declarationList.declarations])
    .find((candidate) => ts.isIdentifier(candidate.name) && candidate.name.text === exportName);
  if (!declaration?.initializer) throw new Error(`${exportName} contract was not found`);
  function literalValue(input) {
    let node = input;
    while (ts.isAsExpression(node) || ts.isParenthesizedExpression(node) || ts.isSatisfiesExpression(node)) node = node.expression;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
    if (ts.isNumericLiteral(node)) return Number(node.text);
    if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
    if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
    if (node.kind === ts.SyntaxKind.NullKeyword) return null;
    if (ts.isArrayLiteralExpression(node)) return node.elements.map(literalValue);
    if (ts.isObjectLiteralExpression(node)) return Object.fromEntries(node.properties.map((property) => {
      if (!ts.isPropertyAssignment(property)) throw new Error(`${exportName} contains a non-literal property`);
      const name = ts.isIdentifier(property.name) || ts.isStringLiteral(property.name) || ts.isNumericLiteral(property.name) ? property.name.text : undefined;
      if (!name) throw new Error(`${exportName} contains an unsupported property name`);
      return [name, literalValue(property.initializer)];
    }));
    throw new Error(`${exportName} contains an unsupported literal value`);
  }
  return literalValue(declaration.initializer);
}

export function isTableHeaderSelector(selector) {
  return /(^|[\s>+~])th(?=$|[\s.:#>+~[])|table[^,{]*(head|header)|report-table[^,{]*strong/i.test(selector);
}

export function isHudSelector(rule, selector) {
  return rule.declarations["font-family"] === "var(--font-hud)"
    || rule.declarations["letter-spacing"] === "var(--tracking-hud)"
    || /\b(hud|status|eyebrow|kicker|badge|meta|metric|code|console|source|live|signal)\b/i.test(selector);
}

const BODY_SIZES = ["var(--text-body)", "var(--t-body)", "15px"];

export function createTypographyRoleClassifier(semanticRoleOverrides) {
  return function expectedTypographyRole(rule, selector) {
    const override = semanticRoleOverrides[selector];
    if (override) return override;
    const size = rule.declarations["font-size"];
    // 본문 크기의 여러 줄 입력창은 longform(긴 글 줄간격). 덮어쓰기 표에 일일이 적지 않는다.
    if (rule.selectors.every((candidate) => /textarea/i.test(candidate) && !/input/i.test(candidate))
      && BODY_SIZES.includes(size)) return "longform";
    if (isTableHeaderSelector(selector) && !isInteractiveSelector(selector)) return "tableHeader";
    if (["var(--text-display)", "var(--t-display)", "clamp(44px, 6vw, 72px)"].includes(size)) return "display";
    if (["var(--text-page-title)", "var(--t-hero)", "clamp(32px, 4vw, 40px)"].includes(size)) return "pageTitle";
    if (["var(--text-section-title)", "var(--t-title)", "clamp(24px, 3vw, 28px)"].includes(size)) return "sectionTitle";
    if (["var(--text-component-title)", "var(--t-h)", "20px"].includes(size)) return "componentTitle";
    if (["var(--text-body-lg)", "var(--t-body-lg)", "17px"].includes(size)) return "bodyLarge";
    if (BODY_SIZES.includes(size)) return "body";
    if (["var(--text-control)", "var(--text-support)", "14px"].includes(size)) {
      return isInteractiveSelector(selector) ? "control" : "support";
    }
    if (["var(--text-table)", "13px"].includes(size)) return "table";
    if (["var(--text-caption)", "var(--t-caption)", "12px"].includes(size)) return "caption";
    if (["var(--text-hud)", "var(--t-micro)"].includes(size) || size === "11px" && isHudSelector(rule, selector)) return "hud";
    if (size === "11px") return "caption";
    return undefined;
  };
}

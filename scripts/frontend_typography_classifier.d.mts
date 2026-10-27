export type TypographyRuleLike = { selectors: string[]; declarations: Record<string, string> };
export function isInteractiveSelector(selector: string): boolean;
export function isTableHeaderSelector(selector: string): boolean;
export function isHudSelector(rule: TypographyRuleLike, selector: string): boolean;
export function createTypographyRoleClassifier<Role extends string>(
  semanticRoleOverrides: Readonly<Record<string, Role>>,
): (rule: TypographyRuleLike, selector: string) => Role | "longform" | "tableHeader" | "display" | "pageTitle" | "sectionTitle" | "componentTitle" | "bodyLarge" | "body" | "control" | "support" | "table" | "caption" | "hud" | undefined;

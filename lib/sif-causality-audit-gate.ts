export interface SifCausalityAuditGateInput {
  rows: number;
  branchSum: number;
  corpusSha256: string;
  deterministic: boolean;
  mutationRun1: number;
  mutationRun2: number;
  rawControlAliasCount: number;
  rawTagStandaloneLeakCount: number;
  causalityFlagCount: number;
}

export interface SifCausalityAuditExpectation {
  rows: number;
  corpusSha256: string;
}

export function hasPoweredMachineryCausalSignal(overview: string): boolean {
  const specificMachinerySubject = /(?:천공기|로드|리프트|승강기|레버조립설비|자동화\s*라인|자동화설비|라미네이터|혼합기|교반기|분쇄기|파쇄기|사출성형기|로봇|인쇄기|병입기|쉐이빙기|언코일러|환편기|권취기|권취롤러|롤러|엔진|샤프트|에어실린더|투입기|동력기|코일이송장치|CNC선반|드릴(?:링)?\s*기계|드릴|드럼|컨베이어|회전(?:날|축|부)|회전체|가동부)/u.test(overview);
  const genericMachinerySubject = /(?:설비|기계(?!실))/u.test(overview);
  const poweredMotion = /(?:작동|가동|동작|회전|움직)/u.test(overview);
  const entanglement = /(?:끼어|끼여|끼임|협착|말리|말림)/u.test(overview);
  return (specificMachinerySubject || (genericMachinerySubject && poweredMotion)) && (poweredMotion || entanglement);
}

export function listSifCausalityAuditGateFailures(
  input: SifCausalityAuditGateInput,
  expected: SifCausalityAuditExpectation
): string[] {
  const failures: string[] = [];
  if (input.rows !== expected.rows) failures.push(`rows:${input.rows}`);
  if (input.corpusSha256 !== expected.corpusSha256) failures.push(`corpus-sha256:${input.corpusSha256}`);
  if (input.branchSum !== input.rows) failures.push(`branch-sum:${input.branchSum}`);
  if (!input.deterministic) failures.push("non-deterministic-output");
  const mutationCount = input.mutationRun1 + input.mutationRun2;
  if (mutationCount > 0) failures.push(`source-mutations:${mutationCount}`);
  if (input.rawControlAliasCount > 0) failures.push(`raw-control-aliases:${input.rawControlAliasCount}`);
  if (input.rawTagStandaloneLeakCount > 0) failures.push(`raw-tag-leaks:${input.rawTagStandaloneLeakCount}`);
  if (input.causalityFlagCount > 0) failures.push(`causality-flags:${input.causalityFlagCount}`);
  return failures;
}

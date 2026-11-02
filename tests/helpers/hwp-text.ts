// 시험용: 한글(hwp) 파일 첫 구역의 본문 문단과 표 칸(각 칸 첫 문단) 글자를 줄바꿈으로 이어 돌려준다.
import { HwpDocument } from "@rhwp/core";

function hwpAllText(document: HwpDocument): string {
  const texts: string[] = [];
  for (let paraIdx = 0; paraIdx < document.getParagraphCount(0); paraIdx += 1) {
    texts.push(document.getTextRange(0, paraIdx, 0, document.getParagraphLength(0, paraIdx)));
    const positions = JSON.parse(document.getControlTextPositions(0, paraIdx)) as unknown;
    if (!Array.isArray(positions)) continue;
    positions.forEach((_position, controlIdx) => {
      let dims: { rowCount: number; colCount: number } | null = null;
      try {
        dims = JSON.parse(document.getTableDimensions(0, paraIdx, controlIdx)) as { rowCount: number; colCount: number };
      } catch {
        dims = null;
      }
      if (!dims) return;
      for (let cellIdx = 0; cellIdx < dims.rowCount * dims.colCount; cellIdx += 1) {
        const length = document.getCellParagraphLength(0, paraIdx, controlIdx, cellIdx, 0);
        texts.push(document.getTextInCell(0, paraIdx, controlIdx, cellIdx, 0, 0, length));
      }
    });
  }
  return texts.join("\n");
}

export function hwpText(buffer: Buffer): string {
  const document = new HwpDocument(new Uint8Array(buffer));
  try {
    return hwpAllText(document);
  } finally {
    document.free();
  }
}

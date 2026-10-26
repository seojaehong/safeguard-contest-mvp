// PR-12(2026-10-26) 작업유형 overlay — 프레스 금형 교체 · 굴착 작업 · 폭염 작업.
//
// core-triples.json(자동 생성, 직접 수정 금지)에 없는 세 작업유형을 생성 전 패킷 주입용으로 보탠다.
// 조문은 2026-10-26 법제처 Open API(산업안전보건기준에 관한 규칙, 법령ID 007363)에서 제목·본문을 확인한
// 것만 넣었다. 조치 문구는 그 조문 본문을 줄인 것이다(원문 밖 조치 없음).
//
// 노무사 감수 전이다. SEED_NODES/SEED_EDGES 에 합치지 않고 이 파일에서만 내보내므로
// scripts/ontology/seed-load.mjs 가 운영 safety_ontology_* 에 올리지 않는다(운영 반영은 감수 뒤 별도 결정).
// lib/grounding-ontology-injection.ts 가 「DB published 그래프 ∪ 시드 published ∪ 이 overlay」로 조립한다.
import type { OntologyEdgeInput, OntologyNodeInput } from "@/lib/ontology/schema";

const LAW = "산업안전보건기준에 관한 규칙";
const MANUAL = "manual:PR-12_작업유형_overlay_2026-10-26(감수_전)";

function law(articleNo: string): string {
  return `law:${LAW}:제${articleNo}조`;
}

type ArticleDef = { no: string; title: string };
type ControlDef = { id: string; label: string; articles: readonly string[] };
type HazardDef = { id: string; label: string; controls: readonly string[] };
type TaskDef = { id: string; label: string; taskKey: string; articles: readonly string[]; hazards: readonly HazardDef[] };

const ARTICLES: readonly ArticleDef[] = [
  { no: "92", title: "정비 등의 작업 시의 운전정지 등" },
  { no: "103", title: "프레스 등의 위험 방지" },
  { no: "104", title: "금형조정작업의 위험 방지" },
  { no: "172", title: "접촉의 방지" },
  { no: "338", title: "굴착작업 사전조사 등" },
  { no: "339", title: "굴착면의 붕괴 등에 의한 위험방지" },
  { no: "340", title: "굴착작업 시 위험방지" },
  { no: "342", title: "굴착기계등에 의한 위험방지" },
  { no: "560", title: "온도ㆍ습도 조절 등" },
  { no: "562", title: "고열ㆍ폭염장해 예방 조치" },
  { no: "567", title: "휴게시설의 설치" }
];

const CONTROLS: readonly ControlDef[] = [
  // 프레스 금형 교체
  { id: "Control_안전블록_설치_후_금형_부착_해체_조정", label: "슬라이드 하강을 막는 안전블록 설치 후 금형 부착·해체·조정", articles: ["104"] },
  { id: "Control_프레스_운전정지_기동장치_잠금_열쇠_별도_관리", label: "프레스 운전정지 후 기동장치 잠금장치 설치, 열쇠 별도 관리 또는 표지판 설치", articles: ["92"] },
  { id: "Control_작업_전_압축_기체_액체_잔압_방출", label: "작업 전 압축된 기체·액체(공압·유압) 잔압 방출", articles: ["92"] },
  { id: "Control_방호장치_전환스위치_유효_상태_복구_후_시운전", label: "방호장치와 전환스위치를 유효한 상태로 되돌린 뒤 시운전", articles: ["103"] },
  { id: "Control_금형_운반_인양_구역_출입통제_작업지휘자_배치", label: "금형 운반·인양 구역 출입통제와 작업지휘자 배치", articles: ["92", "172"] },
  // 굴착 작업
  { id: "Control_굴착_전_부석_균열_함수_용수_동결_점검", label: "굴착 전 작업장소와 주변의 부석·균열, 함수·용수·동결 상태 점검", articles: ["338"] },
  { id: "Control_굴착면_기울기_기준_준수_또는_흙막이_붕괴_방지", label: "굴착면 기울기를 별표 11 기준에 맞추거나 흙막이 등 붕괴 방지 조치", articles: ["339"] },
  { id: "Control_측구_설치_굴착경사면_비닐_덮기_빗물_침투_방지", label: "측구 설치·굴착경사면 비닐 덮기로 빗물 침투 붕괴 예방", articles: ["339"] },
  { id: "Control_흙막이_지보공_방호망_설치_근로자_출입_금지", label: "흙막이 지보공·방호망 설치와 붕괴 우려 구역 근로자 출입 금지", articles: ["340"] },
  { id: "Control_지하_공작물_파손_우려_시_굴착기계_작업_중지", label: "가스도관·지중전선로 등 지하 공작물 파손 우려 시 굴착기계 작업 중지", articles: ["342"] },
  { id: "Control_굴착기계_운행경로_토석_적재장소_출입방법_주지", label: "굴착기계 운행경로와 토석 적재장소 출입방법을 정해 근로자에게 주지", articles: ["342"] },
  // 폭염 작업
  { id: "Control_폭염_온습도_조절장치_가동_작업시간대_조정_휴식_부여", label: "폭염작업 시 온·습도 조절장치 가동, 작업시간대 조정 또는 적절한 휴식시간 부여", articles: ["560"] },
  { id: "Control_체감온도_33도_이상_매_2시간_이내_20분_이상_휴식", label: "체감온도 33도 이상 폭염작업은 매 2시간 이내 20분 이상 휴식", articles: ["560"] },
  { id: "Control_폭염작업_장소_온습도계_상시_비치", label: "폭염작업 장소에 온·습도계 상시 비치", articles: ["562"] },
  { id: "Control_폭염작업_전_증상_예방조치_응급조치_요령_고지", label: "폭염작업 전 건강장해 증상·예방조치·응급조치 요령 고지", articles: ["562"] },
  { id: "Control_체감온도_조치사항_일자별_기록_보관", label: "폭염작업 일자별 체감온도와 조치사항 기록·보관", articles: ["562"] },
  { id: "Control_온열질환_의심_시_지체_없이_관할_소방관서_신고", label: "열사병 등 온열질환 의심 시 지체 없이 관할 소방관서(119) 신고", articles: ["562"] },
  { id: "Control_폭염_휴게시설_옥외_그늘진_휴식장소_제공", label: "휴게시설 제공, 옥외 폭염 노출 작업은 그늘진 휴식장소 제공", articles: ["567"] }
];

const TASKS: readonly TaskDef[] = [
  {
    id: "Task_press_die_change",
    label: "프레스 금형 교체",
    taskKey: "press",
    articles: ["92", "103", "104"],
    hazards: [
      {
        id: "Hazard_프레스_슬라이드_하강_불시기동_끼임",
        label: "프레스 슬라이드 하강·불시기동 끼임",
        controls: [
          "Control_안전블록_설치_후_금형_부착_해체_조정",
          "Control_프레스_운전정지_기동장치_잠금_열쇠_별도_관리",
          "Control_작업_전_압축_기체_액체_잔압_방출",
          "Control_방호장치_전환스위치_유효_상태_복구_후_시운전"
        ]
      },
      {
        id: "Hazard_금형_운반_중_낙하_충돌",
        label: "금형 운반·인양 중 낙하·충돌",
        controls: ["Control_금형_운반_인양_구역_출입통제_작업지휘자_배치"]
      }
    ]
  },
  {
    id: "Task_excavation",
    label: "굴착 작업",
    taskKey: "excavation",
    articles: ["338", "339", "340", "342"],
    hazards: [
      {
        id: "Hazard_굴착면_붕괴_토사_낙하_매몰",
        label: "굴착면 붕괴·토사 낙하 매몰",
        controls: [
          "Control_굴착_전_부석_균열_함수_용수_동결_점검",
          "Control_굴착면_기울기_기준_준수_또는_흙막이_붕괴_방지",
          "Control_측구_설치_굴착경사면_비닐_덮기_빗물_침투_방지",
          "Control_흙막이_지보공_방호망_설치_근로자_출입_금지"
        ]
      },
      {
        id: "Hazard_지하_매설물_파손",
        label: "지하 매설물(가스도관·지중전선로) 파손",
        controls: ["Control_지하_공작물_파손_우려_시_굴착기계_작업_중지"]
      },
      {
        id: "Hazard_굴착기계_운행경로_토석_적재_구역_충돌",
        label: "굴착기계 운행경로·토석 적재 구역 충돌",
        controls: ["Control_굴착기계_운행경로_토석_적재장소_출입방법_주지"]
      }
    ]
  },
  {
    id: "Task_heat_work",
    label: "폭염 작업",
    taskKey: "heat_work",
    articles: ["560", "562", "567"],
    hazards: [
      {
        id: "Hazard_폭염_온열질환",
        label: "폭염 온열질환(열사병·열탈진)",
        controls: [
          "Control_폭염_온습도_조절장치_가동_작업시간대_조정_휴식_부여",
          "Control_체감온도_33도_이상_매_2시간_이내_20분_이상_휴식",
          "Control_폭염작업_장소_온습도계_상시_비치",
          "Control_폭염작업_전_증상_예방조치_응급조치_요령_고지",
          "Control_체감온도_조치사항_일자별_기록_보관",
          "Control_온열질환_의심_시_지체_없이_관할_소방관서_신고",
          "Control_폭염_휴게시설_옥외_그늘진_휴식장소_제공"
        ]
      }
    ]
  }
];

const META = { overlay: "pr-12-task-overlay-2026-10", review_note: "노무사 감수 전" } as const;

function node(input: Omit<OntologyNodeInput, "text_excerpt" | "review_state"> & { text_excerpt?: string | null }): OntologyNodeInput {
  return { text_excerpt: null, review_state: "published", ...input };
}

function edge(src: string, rel: OntologyEdgeInput["rel"], dst: string, cited: readonly string[]): OntologyEdgeInput {
  return { src, rel, dst, cited_uids: [...cited], meta: { ...META }, review_state: "published" };
}

const articleNodes: OntologyNodeInput[] = ARTICLES.map((article) => node({
  node_id: `Article_기준규칙_${article.no}`,
  kind: "Article",
  label: `기준규칙 제${article.no}조(${article.title})`,
  cited_uids: [law(article.no), MANUAL],
  meta: { ...META, law: LAW, article_no: article.no }
}));

const controlNodes: OntologyNodeInput[] = CONTROLS.map((control) => node({
  node_id: control.id,
  kind: "Control",
  label: control.label,
  cited_uids: [...control.articles.map(law), MANUAL],
  meta: { ...META }
}));

const taskNodes: OntologyNodeInput[] = TASKS.map((task) => node({
  node_id: task.id,
  kind: "Task",
  label: task.label,
  cited_uids: [...task.articles.map(law), MANUAL],
  meta: { ...META, task_key: task.taskKey }
}));

const hazardNodes: OntologyNodeInput[] = TASKS.flatMap((task) => task.hazards.map((hazard) => node({
  node_id: hazard.id,
  kind: "Hazard",
  label: hazard.label,
  cited_uids: [...task.articles.map(law), MANUAL],
  meta: { ...META }
})));

const controlById = new Map(CONTROLS.map((control) => [control.id, control]));

const edges: OntologyEdgeInput[] = [
  ...TASKS.flatMap((task) => task.hazards.flatMap((hazard) => [
    edge(task.id, "entailsHazard", hazard.id, [...task.articles.map(law), MANUAL]),
    ...hazard.controls.map((controlId) => {
      const control = controlById.get(controlId);
      if (!control) throw new Error(`overlay control missing: ${controlId}`);
      return edge(hazard.id, "mitigatedBy", controlId, [...control.articles.map(law), MANUAL]);
    })
  ])),
  ...CONTROLS.flatMap((control) => control.articles.map((articleNo) => (
    edge(control.id, "mandatedBy", `Article_기준규칙_${articleNo}`, [law(articleNo), MANUAL])
  )))
];

export const TASK_OVERLAY_NODES: readonly OntologyNodeInput[] = [...taskNodes, ...hazardNodes, ...controlNodes, ...articleNodes];
export const TASK_OVERLAY_EDGES: readonly OntologyEdgeInput[] = edges;
export const TASK_OVERLAY_TASK_LABELS = TASKS.map((task) => task.label);

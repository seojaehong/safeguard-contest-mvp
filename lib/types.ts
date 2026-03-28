export type SourceType = "law" | "precedent";

export type SearchResult = {
  id: string;
  type: SourceType;
  title: string;
  summary: string;
  citation?: string;
  sourceLabel: string;
  tags?: string[];
};

export type DetailRecord = {
  id: string;
  type: SourceType;
  title: string;
  citation?: string;
  summary: string;
  body: string;
  points: string[];
  sourceUrl?: string;
  tags?: string[];
};

export type AskResponse = {
  answer: string;
  practicalPoints: string[];
  citations: SearchResult[];
  mode: "mock" | "live";
};

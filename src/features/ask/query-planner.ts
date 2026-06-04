import { tokenize } from "@/features/retrieval/tokenizer";

export type AskIntent =
  | "exact_lookup"
  | "document_lookup"
  | "topic_summary"
  | "general_question";

export type PlannedSearchQuery = {
  query: string;
  source: "original" | "keywords" | "entity" | "exact" | "document";
  priority: number;
};

export type AskQueryPlan = {
  originalQuery: string;
  intent: AskIntent;
  keywords: string[];
  entities: string[];
  exactTerms: string[];
  documentTerms: string[];
  searchQueries: PlannedSearchQuery[];
};

const MAX_KEYWORDS = 10;
const MAX_SEARCH_QUERIES = 5;

const ASK_STOP_WORDS = new Set([
  "answer",
  "answers",
  "based",
  "could",
  "document",
  "documents",
  "file",
  "files",
  "find",
  "from",
  "give",
  "have",
  "information",
  "local",
  "looking",
  "need",
  "please",
  "question",
  "retrieved",
  "search",
  "show",
  "tell",
  "that",
  "these",
  "this",
  "want",
  "whats",
  "with",
  "your",
]);

const EXACT_LOOKUP_TERMS = new Set([
  "aadhaar",
  "aadhar",
  "uidai",
  "number",
  "mobile",
  "phone",
  "contact",
  "roll",
  "application",
  "appl",
  "id",
  "dob",
  "birth",
  "date",
]);

const DOCUMENT_TERMS = new Set([
  "card",
  "certificate",
  "doc",
  "docs",
  "document",
  "documents",
  "file",
  "files",
  "pdf",
  "receipt",
  "resume",
  "report",
]);

const SUMMARY_TERMS = new Set(["about", "summarize", "summary", "explain", "overview"]);

export function planAskQuery(question: string): AskQueryPlan {
  const originalQuery = question.trim();
  const rawTokens = tokenize(originalQuery);
  const keywords = addSynonyms(
    unique(rawTokens.filter((term) => !ASK_STOP_WORDS.has(term))).slice(0, MAX_KEYWORDS)
  );
  const exactTerms = extractExactTerms(originalQuery, rawTokens);
  const documentTerms = keywords.filter((term) => DOCUMENT_TERMS.has(term) || term.length <= 5);
  const entities = extractEntities(originalQuery, keywords);
  const intent = classifyIntent(originalQuery, keywords, exactTerms);
  const searchQueries = buildSearchQueries({
    originalQuery,
    keywords,
    entities,
    exactTerms,
    documentTerms,
  });

  return {
    originalQuery,
    intent,
    keywords,
    entities,
    exactTerms,
    documentTerms,
    searchQueries,
  };
}

function classifyIntent(query: string, keywords: string[], exactTerms: string[]): AskIntent {
  const lower = query.toLowerCase();
  if (
    exactTerms.length > 0 ||
    keywords.some((term) => EXACT_LOOKUP_TERMS.has(term)) ||
    /\b(?:what|which)\b.+\b(?:number|date|id|dob)\b/i.test(query)
  ) {
    return "exact_lookup";
  }
  if (keywords.some((term) => DOCUMENT_TERMS.has(term)) || /\b(?:find|show|open)\b/i.test(query)) {
    return "document_lookup";
  }
  if (keywords.some((term) => SUMMARY_TERMS.has(term)) || lower.includes("tell me about")) {
    return "topic_summary";
  }
  return "general_question";
}

function extractExactTerms(query: string, tokens: string[]): string[] {
  const terms = new Set<string>();
  for (const match of query.matchAll(/\b\d[\d\s\-/:]{1,30}\d\b/g)) {
    const value = match[0].replace(/\s+/g, " ").trim();
    if (value.length >= 3) terms.add(value);
  }
  for (const token of tokens) {
    if (/^\d{3,}$/.test(token)) terms.add(token);
  }
  for (const match of query.matchAll(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g)) {
    terms.add(match[0]);
  }
  return Array.from(terms).slice(0, 8);
}

function extractEntities(query: string, keywords: string[]): string[] {
  const entities = new Set<string>();
  for (const match of query.matchAll(/\b[A-Z][a-z0-9]+(?:\s+[A-Z][a-z0-9]+){1,3}\b/g)) {
    entities.add(match[0].toLowerCase());
  }

  const personLike = keywords.filter(
    (term) => !EXACT_LOOKUP_TERMS.has(term) && !DOCUMENT_TERMS.has(term)
  );
  if (personLike.length >= 2) entities.add(personLike.slice(-2).join(" "));
  if (personLike.length === 1) entities.add(personLike[0]!);

  return Array.from(entities).slice(0, 4);
}

function buildSearchQueries({
  originalQuery,
  keywords,
  entities,
  exactTerms,
  documentTerms,
}: {
  originalQuery: string;
  keywords: string[];
  entities: string[];
  exactTerms: string[];
  documentTerms: string[];
}): PlannedSearchQuery[] {
  const queries: PlannedSearchQuery[] = [];
  addQuery(queries, originalQuery, "original", 100);
  if (keywords.length) addQuery(queries, keywords.join(" "), "keywords", 90);
  for (const exact of exactTerms) addQuery(queries, exact, "exact", 95);

  const entityQuery = unique([...entities, ...keywords.filter((term) => EXACT_LOOKUP_TERMS.has(term))]).join(" ");
  if (entityQuery) addQuery(queries, entityQuery, "entity", 80);

  const documentQuery = unique([...documentTerms, ...entities]).join(" ");
  if (documentQuery) addQuery(queries, documentQuery, "document", 70);

  return queries
    .sort((a, b) => b.priority - a.priority)
    .slice(0, MAX_SEARCH_QUERIES);
}

function addQuery(
  queries: PlannedSearchQuery[],
  query: string,
  source: PlannedSearchQuery["source"],
  priority: number
): void {
  const normalized = query.replace(/\s+/g, " ").trim();
  if (!normalized) return;
  if (queries.some((existing) => normalizeQuery(existing.query) === normalizeQuery(normalized))) return;
  queries.push({ query: normalized, source, priority });
}

function addSynonyms(keywords: string[]): string[] {
  const terms = new Set(keywords);
  if (terms.has("aadhaar")) terms.add("aadhar");
  if (terms.has("aadhar")) terms.add("aadhaar");
  if (terms.has("uidai")) {
    terms.add("aadhaar");
    terms.add("aadhar");
  }
  return Array.from(terms).slice(0, MAX_KEYWORDS);
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function normalizeQuery(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

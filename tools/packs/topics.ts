/**
 * S5 — context tags as a controlled vocabulary.
 *
 * kaikki's `topics` are English topic names applied to senses in any language,
 * so a finance term is tagged the same whether the sense is Spanish or
 * Vietnamese. That is what lets the tag live in the CORE layer and survive a
 * base-language swap. It only holds if the vocabulary is fixed and shared, so
 * the raw names are normalized here and anything unmappable is dropped — a tag
 * nobody can query is worse than no tag.
 *
 * Coverage is the open question, not the mechanism. Only ~10% of studiable
 * senses carry any topic at all, and topics attach to specialist vocabulary
 * while packs are selected by frequency, so the real figure for a shipped pack
 * is likely lower. The build reports it (S15) so the decision to keep or drop
 * this axis is made on the number rather than on principle. Tags are not part of
 * a key, so dropping them later disturbs no progress.
 */

/** The controlled set. Deliberately small — these are filter chips, not a taxonomy. */
export const CONTEXT_TAGS: readonly string[] = Object.freeze([
  'finance',
  'work',
  'food',
  'health',
  'science',
  'technology',
  'nature',
  'sport',
  'arts',
  'law',
  'politics',
  'travel',
  'home',
  'religion',
  'military',
]);

/**
 * kaikki topic name → controlled tag.
 *
 * Written against the real names in the extract, whose most common entries are
 * broad umbrellas — `sciences`, `lifestyle`, `natural-sciences`, `hobbies` —
 * rather than the specific labels the framework's examples suggest. 256 distinct
 * names appear, of which 42 cover 80% of uses; the long tail is left unmapped on
 * purpose.
 */
const TOPIC_MAP: Readonly<Record<string, string>> = Object.freeze({
  business: 'finance',
  economics: 'finance',
  finance: 'finance',
  banking: 'finance',
  accounting: 'finance',
  insurance: 'finance',
  trading: 'finance',
  marketing: 'finance',

  occupation: 'work',
  management: 'work',
  'human-sciences': 'work',
  education: 'work',
  engineering: 'technology',
  computing: 'technology',
  internet: 'technology',
  telecommunications: 'technology',
  electronics: 'technology',
  mathematics: 'science',

  food: 'food',
  cooking: 'food',
  drink: 'food',
  beverages: 'food',
  agriculture: 'nature',
  gastronomy: 'food',

  medicine: 'health',
  anatomy: 'health',
  pathology: 'health',
  pharmacology: 'health',
  psychology: 'health',
  'medical-signs-and-symptoms': 'health',

  sciences: 'science',
  'natural-sciences': 'science',
  'physical-sciences': 'science',
  physics: 'science',
  chemistry: 'science',
  astronomy: 'science',
  geology: 'science',

  biology: 'nature',
  botany: 'nature',
  zoology: 'nature',
  ecology: 'nature',
  weather: 'nature',
  geography: 'nature',

  sports: 'sport',
  'ball-games': 'sport',
  football: 'sport',
  hobbies: 'sport',
  games: 'sport',

  music: 'arts',
  entertainment: 'arts',
  literature: 'arts',
  art: 'arts',
  theater: 'arts',
  media: 'arts',
  film: 'arts',

  law: 'law',
  'criminal-law': 'law',
  justice: 'law',

  government: 'politics',
  politics: 'politics',
  history: 'politics',

  transport: 'travel',
  nautical: 'travel',
  aviation: 'travel',
  automotive: 'travel',
  tourism: 'travel',

  lifestyle: 'home',
  furniture: 'home',
  clothing: 'home',
  architecture: 'home',
  buildings: 'home',
  family: 'home',

  religion: 'religion',
  christianity: 'religion',
  mythology: 'religion',

  military: 'military',
  weaponry: 'military',
});

/**
 * Umbrella topics.
 *
 * kaikki's topics are a HIERARCHY, not a flat list: a computing sense carries
 * `["computing", "sciences", "engineering"]`. Mapping them flatly tagged every
 * technology word as science too — all 20 of them in a real build — along with
 * health+science 33 times and nature+science 15. These broad names are used
 * only when nothing more specific was found, so a chip means what it says.
 */
const UMBRELLA_TAGS: ReadonlySet<string> = new Set(['science']);

/**
 * Map a sense's raw topics onto the controlled set.
 *
 * Deduplicated and sorted so a pack rebuild produces byte-identical tags for an
 * unchanged sense, which keeps pack diffs readable.
 */
export function contextTagsFor(topics: readonly string[]): string[] {
  const out = new Set<string>();
  for (const topic of topics) {
    const mapped = TOPIC_MAP[topic.trim().toLowerCase()];
    if (mapped) out.add(mapped);
  }

  const specific = [...out].filter((t) => !UMBRELLA_TAGS.has(t));
  return (specific.length > 0 ? specific : [...out]).sort();
}

/** Names seen but not mapped, so the long tail can be reviewed if it matters. */
export function unmappedTopics(topics: readonly string[]): string[] {
  return topics.filter((t) => !TOPIC_MAP[t.trim().toLowerCase()]);
}

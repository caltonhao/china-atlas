import cultureFileJson from "../data/culture.json";
import ethnicityFileJson from "../data/ethnicities.json";
import surnameFileJson from "../data/surnames.json";

export type Mode = "surname" | "ethnicity";

export interface ProvinceRef {
  short: string;
  full: string;
}

export interface UnavailableProvince extends ProvinceRef {
  note: string;
}

interface ShareEntry {
  name: string;
  nationalShare: number;
  hint: string;
  shares: Record<string, number>;
}

export interface SurnameEntry extends ShareEntry {
  rank: number;
  alias: string[];
}

export interface EthnicEntry extends ShareEntry {}

interface Dataset {
  meta: { label: string; description: string };
  provinces: ProvinceRef[];
  unavailable: UnavailableProvince[];
  surnames?: SurnameEntry[];
  groups?: EthnicEntry[];
}

export const surnameFile = surnameFileJson as Dataset & { surnames: SurnameEntry[] };
export const ethnicityFile = ethnicityFileJson as Dataset & { groups: EthnicEntry[] };

export interface CultureNote {
  customs: string;
  sights: string;
  specialties: string;
}

export interface CultureFile {
  meta: { label: string; note: string };
  provinces: Record<string, CultureNote>;
  cities: Record<string, Record<string, CultureNote>>;
}

export const cultureFile = cultureFileJson as CultureFile;

export function cultureForProvince(short: string): CultureNote | undefined {
  return cultureFile.provinces[short];
}

export function cultureForCity(province: string, city: string): CultureNote | undefined {
  return cultureFile.cities[province]?.[city];
}

export const MAINLAND = surnameFile.provinces;
export const UNAVAILABLE = surnameFile.unavailable;

const fullByShort = new Map(
  [...MAINLAND, ...UNAVAILABLE].map((province) => [province.short, province.full]),
);

export function fullName(short: string): string {
  return fullByShort.get(short) ?? short;
}

export function isUnavailable(short: string): boolean {
  return UNAVAILABLE.some((province) => province.short === short);
}

export function isKnownProvince(short: string): boolean {
  return fullByShort.has(short);
}

export function unavailableNote(short: string): string {
  return UNAVAILABLE.find((province) => province.short === short)?.note ?? "暂无整理数据。";
}

export function formatPct(value: number): string {
  if (value > 0 && value < 0.1) {
    const text = value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
    return `${text}%`;
  }
  return `${value.toFixed(2)}%`;
}

export function isFlatSpread(values: number[]): boolean {
  if (values.length < 2) return true;
  const max = Math.max(...values);
  const min = Math.min(...values);
  return max - min < Math.max(0.004, max * 0.12);
}

export const ADCODE: Record<string, string> = {
  北京: "110000",
  天津: "120000",
  河北: "130000",
  山西: "140000",
  内蒙古: "150000",
  辽宁: "210000",
  吉林: "220000",
  黑龙江: "230000",
  上海: "310000",
  江苏: "320000",
  浙江: "330000",
  安徽: "340000",
  福建: "350000",
  江西: "360000",
  山东: "370000",
  河南: "410000",
  湖北: "420000",
  湖南: "430000",
  广东: "440000",
  广西: "450000",
  海南: "460000",
  重庆: "500000",
  四川: "510000",
  贵州: "520000",
  云南: "530000",
  西藏: "540000",
  陕西: "610000",
  甘肃: "620000",
  青海: "630000",
  宁夏: "640000",
  新疆: "650000",
};

export interface CityFile {
  meta: { label: string; note: string };
  province: string;
  adcode: string;
  cities: string[];
  surnameShares: Record<string, number[]>;
  ethnicity: Record<string, Record<string, number>>;
}

const cityCache = new Map<string, CityFile>();

export async function loadCityFile(short: string): Promise<CityFile> {
  const cached = cityCache.get(short);
  if (cached) return cached;
  const response = await fetch(`${import.meta.env.BASE_URL}data/cities/${encodeURIComponent(short)}.json`);
  if (!response.ok) throw new Error(`${fullName(short)}的地级数据加载失败`);
  const file = (await response.json()) as CityFile;
  cityCache.set(short, file);
  return file;
}

export function cityUnitShare(file: CityFile, mode: Mode, name: string, city: string, provinceShare: number): number {
  if (mode === "surname") {
    const row = file.surnameShares[name];
    const index = file.cities.indexOf(city);
    if (!row || index < 0) return provinceShare;
    return row[index] ?? provinceShare;
  }
  const custom = file.ethnicity[city];
  if (!custom) return provinceShare;
  return custom[name] ?? 0;
}

export function rankCities(file: CityFile, mode: Mode, name: string, province: string): RankedProvince[] {
  const entry = entryOf(mode, name);
  const provinceShare = entry?.shares[province] ?? 0;
  return file.cities
    .map((city) => ({
      short: city,
      full: city,
      share: cityUnitShare(file, mode, name, city, provinceShare),
    }))
    .sort((a, b) => b.share - a.share || a.short.localeCompare(b.short, "zh"));
}

export function topSurnamesAt(file: CityFile, city: string, province: string, count = 8): SurnameBar[] {
  return surnameFile.surnames
    .map((item) => ({
      name: item.name,
      share: cityUnitShare(file, "surname", item.name, city, item.shares[province] ?? 0),
    }))
    .sort((a, b) => b.share - a.share || a.name.localeCompare(b.name, "zh"))
    .slice(0, count);
}

export function trackedSurnameTotalAt(file: CityFile, city: string, province: string): number {
  return surnameFile.surnames.reduce(
    (sum, item) => sum + cityUnitShare(file, "surname", item.name, city, item.shares[province] ?? 0),
    0,
  );
}

function foldEthnic(rows: EthnicBar[]): EthnicBar[] {
  const notable = rows.filter((row) => row.share >= 0.1);
  const head = (notable.length > 0 ? notable : rows).slice(0, 8);
  const shown = head.reduce((sum, row) => sum + row.share, 0);
  const folded = Math.max(0, 100 - shown);
  if (folded >= 0.05) head.push({ name: "其他民族", share: Number(folded.toFixed(2)) });
  return head;
}

export function ethnicCompositionAt(file: CityFile, city: string, province: string): EthnicBar[] {
  const custom = file.ethnicity[city];
  if (!custom) return ethnicComposition(province);
  const rows = Object.entries(custom)
    .map(([name, share]) => ({ name, share }))
    .filter((row) => row.share > 0)
    .sort((a, b) => b.share - a.share || a.name.localeCompare(b.name, "zh"));
  return foldEthnic(rows);
}

export function cityHasLocalEthnicity(file: CityFile, city: string): boolean {
  return Boolean(file.ethnicity[city]);
}

export function esc(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return map[char];
  });
}

export interface Resolved {
  name: string;
  via?: string;
  hint: string;
  nationalShare: number;
}

export interface Suggestion {
  name: string;
  note: string;
}

function surnameByName(name: string): SurnameEntry | undefined {
  return surnameFile.surnames.find((item) => item.name === name);
}

function groupByName(name: string): EthnicEntry | undefined {
  return ethnicityFile.groups.find((item) => item.name === name);
}

export function entryOf(mode: Mode, name: string): ShareEntry | undefined {
  return mode === "surname" ? surnameByName(name) : groupByName(name);
}

export function resolveQuery(mode: Mode, raw: string): Resolved | null {
  const query = raw.trim();
  if (!query || query === "族") return null;
  if (mode === "surname") {
    const exact = surnameByName(query);
    if (exact) return { name: exact.name, hint: exact.hint, nationalShare: exact.nationalShare };
    const aliased = surnameFile.surnames.find((item) => item.alias.includes(query));
    if (!aliased) return null;
    return {
      name: aliased.name,
      via: query,
      hint: aliased.hint,
      nationalShare: aliased.nationalShare,
    };
  }
  const stem = query.replace(/族$/, "");
  const exact = ethnicityFile.groups.find((item) => item.name === query || item.name.replace(/族$/, "") === stem);
  if (!exact) return null;
  return { name: exact.name, hint: exact.hint, nationalShare: exact.nationalShare };
}

function ethnicScore(name: string, query: string): number {
  const stem = name.replace(/族$/, "");
  const needle = query.replace(/族$/, "");
  if (name === query || stem === needle) return 0;
  if (name.startsWith(query) || stem.startsWith(needle)) return 1;
  if (name.includes(query) || stem.includes(needle)) return 2;
  return -1;
}

export function suggestionsFor(mode: Mode, raw: string): Suggestion[] {
  const query = raw.trim();
  if (!query || query === "族") return [];
  if (mode === "surname") {
    const hits: Suggestion[] = [];
    for (const item of surnameFile.surnames) {
      if (item.name.includes(query)) hits.push({ name: item.name, note: item.hint });
      else if (item.alias.some((alias) => alias.includes(query))) {
        hits.push({ name: item.name, note: `亦作${item.alias.join("、")}` });
      }
    }
    return hits.slice(0, 8);
  }
  return ethnicityFile.groups
    .map((group) => ({ group, score: ethnicScore(group.name, query) }))
    .filter((item) => item.score >= 0)
    .sort((a, b) => a.score - b.score || b.group.nationalShare - a.group.nationalShare)
    .slice(0, 8)
    .map((item) => ({ name: item.group.name, note: item.group.hint }));
}

export interface RankedProvince {
  short: string;
  full: string;
  share: number;
}

export function rankProvinces(mode: Mode, name: string): RankedProvince[] {
  const entry = entryOf(mode, name);
  if (!entry) return [];
  return MAINLAND.map((province) => ({
    short: province.short,
    full: province.full,
    share: entry.shares[province.short] ?? 0,
  })).sort((a, b) => b.share - a.share || a.short.localeCompare(b.short, "zh"));
}

export interface SurnameBar {
  name: string;
  share: number;
}

export function topSurnames(short: string, count = 8): SurnameBar[] {
  return surnameFile.surnames
    .map((item) => ({ name: item.name, share: item.shares[short] ?? 0 }))
    .sort((a, b) => b.share - a.share || a.name.localeCompare(b.name, "zh"))
    .slice(0, count);
}

export function trackedSurnameTotal(short: string): number {
  return surnameFile.surnames.reduce((sum, item) => sum + (item.shares[short] ?? 0), 0);
}

export interface EthnicBar {
  name: string;
  share: number;
}

export function ethnicComposition(short: string): EthnicBar[] {
  const rows = ethnicityFile.groups
    .map((group) => ({ name: group.name, share: group.shares[short] ?? 0 }))
    .filter((row) => row.share > 0)
    .sort((a, b) => b.share - a.share || a.name.localeCompare(b.name, "zh"));
  const notable = rows.filter((row) => row.share >= 0.1);
  const head = (notable.length > 0 ? notable : rows).slice(0, 8);
  const shown = head.reduce((sum, row) => sum + row.share, 0);
  const folded = Math.max(0, 100 - shown);
  if (folded >= 0.05) head.push({ name: "其他民族", share: Number(folded.toFixed(2)) });
  return head;
}

export function provinceBlurb(short: string): string {
  const rows = ethnicityFile.groups
    .map((group) => ({ name: group.name, share: group.shares[short] ?? 0 }))
    .sort((a, b) => b.share - a.share);
  const han = rows.find((row) => row.name === "汉族")?.share ?? 0;
  const minority = rows.find((row) => row.name !== "汉族");
  if (han >= 97) return "汉族占绝大多数。下面的姓氏比例，是占全省人口的示意份额。";
  if (minority && minority.share >= 8) {
    return `${minority.name}等民族人口比例较高。姓氏比例按全省人口计算，少数民族人口高的地方，常见汉姓合计会相应较低。`;
  }
  return "姓氏与民族比例都是占该省级单位人口的示意份额。";
}

export function modeLabel(mode: Mode): string {
  return mode === "surname" ? "姓氏" : "民族";
}

export type SearchFilter = "all" | Mode | "place";

export interface SearchHit {
  kind: "surname" | "ethnicity" | "place";
  title: string;
  note: string;
  commit: string;
  via?: string;
  province?: string;
  city?: string | null;
  facet?: string;
  score: number;
  spot?: string;
}

export function popularSurnames(count = 10): string[] {
  return [...surnameFile.surnames]
    .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name, "zh"))
    .slice(0, count)
    .map((item) => item.name);
}

interface PlaceRecord {
  province: string;
  city: string | null;
  name: string;
  full: string;
  customs: string;
  sights: string;
  specialties: string;
}

const placeRecords: PlaceRecord[] = [];

for (const province of [...MAINLAND, ...UNAVAILABLE]) {
  const note = cultureFile.provinces[province.short];
  if (!note) continue;
  placeRecords.push({
    province: province.short,
    city: null,
    name: province.short,
    full: province.full,
    customs: note.customs,
    sights: note.sights,
    specialties: note.specialties,
  });
}

for (const [province, cities] of Object.entries(cultureFile.cities)) {
  for (const [city, note] of Object.entries(cities)) {
    placeRecords.push({
      province,
      city,
      name: city,
      full: city,
      customs: note.customs,
      sights: note.sights,
      specialties: note.specialties,
    });
  }
}

function snippetAround(text: string, index: number, length: number): string {
  const start = Math.max(0, index - 10);
  const end = Math.min(text.length, index + length + 12);
  let slice = text.slice(start, end).replace(/\s+/g, "");
  if (start > 0) slice = `…${slice}`;
  if (end < text.length) slice = `${slice}…`;
  return slice;
}

function placeNameScore(name: string, full: string, query: string): number {
  const bare = name.replace(/(特别行政区|自治区|自治州|自治县|地区|林区|市|盟|县|区)$/u, "");
  const exact = name === query || full === query || (bare.length >= 2 && bare === query);
  if (exact) return 0.4;
  const prefixed =
    name.startsWith(query) || full.startsWith(query) || (bare.length >= 2 && bare.startsWith(query));
  if (prefixed) return 1.4;
  if (query.length < 2) return -1;
  if (name.includes(query) || full.includes(query) || bare.includes(query)) return 2.4;
  return -1;
}

function placeWhere(record: PlaceRecord): string {
  if (!record.city) return record.full;
  return `${fullName(record.province)} · ${record.city}`;
}

function surnameHits(query: string): SearchHit[] {
  const hits: SearchHit[] = [];
  for (const item of surnameFile.surnames) {
    let score = -1;
    let via: string | undefined;
    if (item.name === query) score = 0;
    else if (item.alias.includes(query)) {
      score = 0.15;
      via = query;
    } else if (item.name.startsWith(query)) score = 1;
    else if (item.alias.some((alias) => alias.startsWith(query))) score = 1.15;
    else if (item.name.includes(query)) score = 2;
    else if (item.alias.some((alias) => alias.includes(query))) {
      score = 2.15;
      via = item.alias.find((alias) => alias.includes(query));
    }
    if (score < 0) continue;
    hits.push({
      kind: "surname",
      title: item.name,
      note: via ? `亦作${item.alias.join("、")}` : item.hint,
      commit: item.name,
      via,
      facet: "姓氏",
      score,
    });
  }
  return hits;
}

function ethnicityHits(query: string): SearchHit[] {
  return ethnicityFile.groups
    .map((group) => ({ group, score: ethnicScore(group.name, query) }))
    .filter((item) => item.score >= 0)
    .sort((a, b) => a.score - b.score || b.group.nationalShare - a.group.nationalShare)
    .map((item) => ({
      kind: "ethnicity" as const,
      title: item.group.name,
      note: item.group.hint,
      commit: item.group.name,
      facet: "民族",
      score: item.score + 0.05,
    }));
}

function placeHits(query: string, namesOnly = false): SearchHit[] {
  if (!query) return [];
  const hits: SearchHit[] = [];
  for (const record of placeRecords) {
    const named = placeNameScore(record.name, record.full, query);
    if (named >= 0) {
      hits.push({
        kind: "place",
        title: record.city ?? record.full,
        note: record.city ? fullName(record.province) : "省级",
        commit: record.city ?? record.full,
        province: record.province,
        city: record.city,
        facet: "地名",
        score: named + (record.city ? 0.05 : 0),
      });
      continue;
    }
    if (namesOnly || query.length < 2) continue;
    const fields: Array<[string, string, number]> = [
      ["景点", record.sights, 4],
      ["特色", record.specialties, 4.05],
      ["习俗", record.customs, 4.1],
    ];
    let best: SearchHit | null = null;
    for (const [facet, text, base] of fields) {
      const at = text.indexOf(query);
      if (at < 0) continue;
      const loose = at > 0 && !/[，。、；：\s（(]/.test(text[at - 1] ?? "");
      const score = base + (loose ? 0.4 : 0);
      if (best && score >= best.score) continue;
      best = {
        kind: "place",
        title: query,
        note: `${placeWhere(record)} · ${snippetAround(text, at, query.length)}`,
        commit: query,
        province: record.province,
        city: record.city,
        facet,
        score,
      };
    }
    if (best) hits.push(best);
  }
  hits.sort((a, b) => a.score - b.score || a.title.localeCompare(b.title, "zh") || a.note.localeCompare(b.note, "zh"));
  return hits.slice(0, 8);
}

export function regionSuggestions(raw: string): SearchHit[] {
  const query = raw.trim();
  if (!query) return [];
  return placeHits(query, true).slice(0, 8);
}

export interface AttractionPlace {
  province: string;
  city: string | null;
}

export interface AttractionLink {
  label: string;
  href: string;
}

export interface AttractionImage {
  src: string;
  page: string;
  author: string;
  license: string;
}

export interface Attraction {
  id: string;
  name: string;
  aliases: string[];
  province: string;
  city: string | null;
  places: AttractionPlace[];
  kind: "sight" | "custom" | "specialty";
  grade: "5A" | "4A" | null;
  depth: "full" | "short";
  history: string;
  tickets: string;
  visit: string;
  season: string;
  caution: string;
  access?: string;
  themes?: string[];
  seasons?: string[];
  links?: AttractionLink[];
  image?: AttractionImage;
}

let attractionList: Attraction[] = [];
let hubs: Record<string, string> = {};

export function setAttractions(list: Attraction[], nextHubs: Record<string, string> = {}) {
  attractionList = list;
  hubs = nextHubs;
}

export function hubFor(province: string): string {
  return hubs[province] ?? "";
}

export function browseAttractions(mode: "theme" | "season", id: string): Attraction[] {
  return attractionList
    .filter((item) => (mode === "theme" ? item.themes?.includes(id) : item.seasons?.includes(id)))
    .sort(
    (a, b) =>
      Number(b.grade === "5A") - Number(a.grade === "5A") ||
      Number(a.depth !== "full") - Number(b.depth !== "full") ||
      a.name.localeCompare(b.name, "zh"),
  );
}

export function attractionById(id: string): Attraction | undefined {
  return attractionList.find((item) => item.id === id);
}

export function attractionsInProvince(province: string): Attraction[] {
  return attractionList.filter((item) => item.province === province);
}

export function attractionsLoaded(): boolean {
  return attractionList.length > 0;
}

export function attractionsFor(province: string, city: string | null): Attraction[] {
  const list = attractionList.filter((item) =>
    item.places.some((place) => place.province === province && (place.city ?? null) === city),
  );
  const sights = list
    .filter((item) => item.kind === "sight")
    .sort((a, b) => Number(a.depth !== "full") - Number(b.depth !== "full") || Number(a.grade !== "5A") - Number(b.grade !== "5A"));
  const customs = list.filter((item) => item.kind === "custom");
  const specialties = list.filter((item) => item.kind === "specialty");
  return [...sights.slice(0, 6), ...customs.slice(0, 3), ...specialties.slice(0, 4)];
}

function spotHits(query: string): SearchHit[] {
  if (query.length < 2) return [];
  const hits: SearchHit[] = [];
  for (const spot of attractionList) {
    const names = [spot.name, ...spot.aliases];
    let score = -1;
    for (const name of names) {
      if (name === query) score = score < 0 ? 0.22 : Math.min(score, 0.22);
      else if (name.startsWith(query)) score = score < 0 ? 1.2 : Math.min(score, 1.2);
      else if (name.includes(query)) score = score < 0 ? 2.15 : Math.min(score, 2.15);
    }
    if (score < 0) continue;
    const where = spot.city ? `${fullName(spot.province)} · ${spot.city}` : fullName(spot.province);
    const kindLabel =
      spot.kind === "custom" ? "习俗" : spot.kind === "specialty" ? "特色" : spot.grade ? `景点 · 国家${spot.grade}级` : "景点";
    hits.push({
      kind: "place",
      title: spot.name,
      note: `${where} · ${kindLabel}`,
      commit: spot.name,
      province: spot.province,
      city: spot.city,
      facet: spot.kind === "custom" ? "习俗" : spot.kind === "specialty" ? "特色" : "景点",
      score,
      spot: spot.id,
    });
  }
  hits.sort((a, b) => a.score - b.score || a.title.localeCompare(b.title, "zh") || a.note.localeCompare(b.note, "zh"));
  return hits.slice(0, 6);
}

export function searchSuggestions(filter: SearchFilter, raw: string): SearchHit[] {
  const query = raw.trim();
  if (!query || query === "族") return [];
  const groups: SearchHit[][] = [];
  if (filter === "all" || filter === "surname") groups.push(surnameHits(query).slice(0, 6));
  if (filter === "all" || filter === "ethnicity") groups.push(ethnicityHits(query).slice(0, 4));
  if (filter === "all" || filter === "place") {
    groups.push(spotHits(query));
    groups.push(placeHits(query));
  }
  const merged = groups
    .flat()
    .sort((a, b) => a.score - b.score || a.title.localeCompare(b.title, "zh") || a.note.localeCompare(b.note, "zh"));
  const seen = new Set<string>();
  const out: SearchHit[] = [];
  for (const hit of merged) {
    const key = `${hit.kind}|${hit.province ?? ""}|${hit.city ?? ""}|${hit.facet ?? ""}|${hit.title}|${hit.note}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(hit);
    if (out.length >= 8) break;
  }
  return out;
}

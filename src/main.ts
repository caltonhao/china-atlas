import "./style.css";
import { legendGradient, mountMap, type AtlasMap } from "./map";
import {
  type CityFile,
  type Mode,
  type SearchFilter,
  type SearchHit,
  ADCODE,
  cityHasLocalEthnicity,
  cityUnitShare,
  type CultureNote,
  cultureForCity,
  cultureForProvince,
  entryOf,
  esc,
  ethnicComposition,
  ethnicCompositionAt,
  formatPct,
  fullName,
  isFlatSpread,
  isKnownProvince,
  isUnavailable,
  loadCityFile,
  modeLabel,
  popularSurnames,
  provinceBlurb,
  setAttractions,
  attractionById,
  attractionsFor,
  attractionsInProvince,
  attractionsLoaded,
  browseAttractions,
  hubFor,
  type Attraction,
  rankCities,
  rankProvinces,
  regionSuggestions,
  resolveQuery,
  searchSuggestions,
  topSurnames,
  topSurnamesAt,
  trackedSurnameTotal,
  trackedSurnameTotalAt,
  unavailableNote,
} from "./model";
import { ethnicColor } from "./palette";

const app = document.querySelector<HTMLElement>("#app");
if (!app) throw new Error("缺少应用根节点");

interface ComparePlace {
  province: string;
  city: string | null;
  pack: CityFile | null;
}

const state: {
  filter: SearchFilter;
  queryKind: Mode | null;
  query: string;
  via: string;
  find: string;
  province: string | null;
  city: string | null;
  level: "nation" | "province";
  cityPack: CityFile | null;
  compare: ComparePlace | null;
  suggestIndex: number;
  suggestOpen: boolean;
  rankExpanded: boolean;
  error: string;
  booted: boolean;
  drawerOpen: boolean;
  spot: string | null;
  browse: string | null;
  browseProvince: string | null;
  pair: string[];
} = {
  filter: "all",
  queryKind: null,
  query: "",
  via: "",
  find: "",
  province: null,
  city: null,
  level: "nation",
  cityPack: null,
  compare: null,
  suggestIndex: 0,
  suggestOpen: false,
  rankExpanded: false,
  error: "",
  booted: false,
  drawerOpen: false,
  spot: null,
  browse: null,
  browseProvince: null,
  pair: [],
};

interface SavedItem {
  key: string;
  label: string;
  province: string;
  city: string | null;
  spot: string | null;
}

const FAV_KEY = "china-atlas-favs";
const RECENT_KEY = "china-atlas-recent";

function readSaved(key: string): SavedItem[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "[]") as SavedItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeSaved(key: string, items: SavedItem[]) {
  localStorage.setItem(key, JSON.stringify(items.slice(0, 12)));
}

function isFav(key: string): boolean {
  return readSaved(FAV_KEY).some((item) => item.key === key);
}

function toggleFav(item: SavedItem) {
  const items = readSaved(FAV_KEY).filter((entry) => entry.key !== item.key);
  if (!isFav(item.key)) items.unshift(item);
  writeSaved(FAV_KEY, items);
}

function rememberView(item: SavedItem | null) {
  if (!item) return;
  const items = readSaved(RECENT_KEY).filter((entry) => entry.key !== item.key);
  items.unshift(item);
  writeSaved(RECENT_KEY, items);
}

function viewForSpot(id: string): SavedItem | null {
  const spot = attractionById(id);
  if (!spot) return null;
  return { key: `s:${spot.id}`, label: spot.name, province: spot.province, city: spot.city, spot: spot.id };
}

function viewForRegion(province: string, city: string | null): SavedItem {
  return {
    key: `r:${province}:${city ?? ""}`,
    label: city || fullName(province),
    province,
    city,
    spot: null,
  };
}

let drillToken = 0;
let composing = false;
let silenceUrl = false;
let atlas: AtlasMap | null = null;
let searchHits: SearchHit[] = [];
let compareHits: SearchHit[] = [];

app.innerHTML = `
  <a class="skip" href="#detail">跳到地区卡片</a>
  <header class="site-header">
    <div class="brand">
      <p class="seal" aria-hidden="true">图鉴</p>
      <div>
        <p class="eyebrow">省级分布 · 示意/整理数据</p>
        <h1>中国姓氏与民族图鉴</h1>
        <p class="lede">点击省份进入地级地图，再点城市查看这一地的卡片。搜索可以找姓氏、民族，也可以找地名、景点和特色。地址栏会记住当前位置，刷新或把链接发给别人，会回到同一层。</p>
      </div>
    </div>
    <form id="search-form" class="search-card" role="search">
      <div class="mode-switch" role="tablist" aria-label="搜索范围">
        <button type="button" class="mode is-on" data-filter="all" role="tab" aria-pressed="true">全部</button>
        <button type="button" class="mode" data-filter="surname" role="tab" aria-pressed="false">姓氏</button>
        <button type="button" class="mode" data-filter="ethnicity" role="tab" aria-pressed="false">民族</button>
        <button type="button" class="mode" data-filter="place" role="tab" aria-pressed="false">地点</button>
      </div>
      <div class="examples" id="quick-surnames">
        <span>常见姓</span>
      </div>
      <p class="examples-note">按现有姓氏表里靠前的姓排列。点一下就用原来的姓氏搜索着色，不是另一套官方排名。</p>
      <div class="examples">
        <span>民族</span>
        <button type="button" data-example="ethnicity:壮族">壮族</button>
        <button type="button" data-example="ethnicity:回族">回族</button>
        <button type="button" data-example="ethnicity:朝鲜族">朝鲜族</button>
      </div>
      <div class="search-row">
        <div class="search-field">
          <label class="sr-only" for="q">搜索姓氏、民族、地名、景点或特色</label>
          <input id="q" name="q" type="search" autocomplete="off" spellcheck="false" enterkeyhint="search" placeholder="搜索姓氏、民族、地名、景点或特色" />
          <div id="suggest" class="suggest" role="listbox" hidden></div>
        </div>
        <button type="submit" class="primary">查找</button>
        <button type="button" id="clear" class="ghost" disabled>清除</button>
      </div>
      <p id="form-note" class="form-note" aria-live="polite"></p>
    </form>
  </header>
  <main class="layout" id="layout">
    <section class="map-card" aria-labelledby="map-title">
      <div class="map-toolbar">
        <div>
          <div class="crumb-row">
            <nav id="crumbs" class="crumbs" aria-label="当前位置"></nav>
            <button type="button" id="back-nation" hidden>返回全国</button>
          </div>
          <h2 id="map-title">省级地图</h2>
          <div class="browse" id="browse" aria-label="按主题或季节浏览">
            <span>浏览</span>
            <button type="button" data-browse="theme:mountain">看山</button>
            <button type="button" data-browse="theme:heritage">看古建</button>
            <button type="button" data-browse="theme:festival">看节庆</button>
            <button type="button" data-browse="theme:water">看水景</button>
            <button type="button" data-browse="theme:town">看古镇</button>
            <button type="button" data-browse="theme:museum">看博物馆</button>
            <button type="button" data-browse="season:spring">春</button>
            <button type="button" data-browse="season:summer">夏</button>
            <button type="button" data-browse="season:autumn">秋</button>
            <button type="button" data-browse="season:winter">冬</button>
          </div>
        </div>
        <p id="map-status">可拖拽、滚轮缩放。点击省份进入地级地图。灰色表示暂无同口径数据。</p>
      </div>
      <div id="chart" class="chart" role="img" aria-label="中国省级地图。点击省份可查看详情。">
        <p id="chart-status" class="chart-status">正在加载省级底图…</p>
      </div>
      <div id="legend" class="legend"></div>
    </section>
    <aside class="side" id="side">
      <button type="button" id="drawer-toggle" class="drawer-handle" aria-controls="drawer-body" aria-expanded="false">
        <span class="handle-grip" aria-hidden="true"></span>
        <span class="handle-copy">
          <strong id="drawer-label">地区卡片</strong>
          <small id="drawer-sub">姓氏、民族与地方介绍</small>
        </span>
        <span id="drawer-action">展开</span>
      </button>
      <div class="drawer-body" id="drawer-body">
        <section id="saved" class="card saved-card">
          <header class="card-head">
            <p class="eyebrow">本机</p>
            <h2>收藏和最近看过</h2>
            <p class="hint">保存在这台浏览器里，不需要账号。</p>
          </header>
          <h3>收藏</h3>
          <div id="fav-list" class="saved-list"></div>
          <h3>最近看过</h3>
          <div id="recent-list" class="saved-list"></div>
        </section>
        <section id="rank" class="card" hidden></section>
        <section id="detail" class="card" tabindex="-1"></section>
        <section id="compare" class="card compare-card">
          <header class="card-head">
            <p class="eyebrow">对照</p>
            <h2>对比两个地区</h2>
          </header>
          <p id="compare-help" class="hint"></p>
          <div class="search-field">
            <label class="sr-only" for="compare-q">选择要对比的省或市</label>
            <input id="compare-q" type="search" autocomplete="off" spellcheck="false" enterkeyhint="search" placeholder="再选一个省或市，例如 四川 或 苏州市" />
            <div id="compare-suggest" class="suggest compare-suggest" role="listbox" hidden></div>
          </div>
          <button type="button" id="clear-compare" class="ghost compare-clear" hidden>退出对比</button>
        </section>
      </div>
    </aside>
  </main>
  <footer class="footer">
    <p><strong>示意数据。</strong>姓氏与民族比例是按公开普查摘要、常见姓氏排行和众所周知的区域格局整理的示意图，用来看相对高低。这不是户籍登记，也不是可以引用的人口普查公报。</p>
    <p><strong>整理介绍。</strong>习俗、景点、特色是公开地方常识写成的短文，不是文化和旅游部门的名录或申报材料。</p>
    <p>地图使用阿里云 DataV GeoAtlas 公开边界：全国为省级，下钻后为地级市、自治州、地区、盟，直辖市为市辖区，海南含省直辖县。香港、澳门和台湾暂无同口径的姓氏民族数据，仍可查看地方介绍。南海诸岛界线只作底图示意。</p>
  </footer>
  <div id="live" class="sr-only" aria-live="polite"></div>
`;

const quickSurnames = document.querySelector<HTMLElement>("#quick-surnames")!;
for (const name of popularSurnames(10)) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.example = `surname:${name}`;
  button.textContent = name;
  quickSurnames.append(button);
}

const form = document.querySelector<HTMLFormElement>("#search-form")!;
const input = document.querySelector<HTMLInputElement>("#q")!;
const suggest = document.querySelector<HTMLElement>("#suggest")!;
const clearButton = document.querySelector<HTMLButtonElement>("#clear")!;
const formNote = document.querySelector<HTMLElement>("#form-note")!;
const chartEl = document.querySelector<HTMLElement>("#chart")!;
const chartStatus = document.querySelector<HTMLElement>("#chart-status")!;
const legend = document.querySelector<HTMLElement>("#legend")!;
const rank = document.querySelector<HTMLElement>("#rank")!;
const detail = document.querySelector<HTMLElement>("#detail")!;
const live = document.querySelector<HTMLElement>("#live")!;
const mapStatus = document.querySelector<HTMLElement>("#map-status")!;
const mapTitle = document.querySelector<HTMLElement>("#map-title")!;
const backNation = document.querySelector<HTMLButtonElement>("#back-nation")!;
const crumbs = document.querySelector<HTMLElement>("#crumbs")!;
const layout = document.querySelector<HTMLElement>("#layout")!;
const side = document.querySelector<HTMLElement>("#side")!;
const drawerToggle = document.querySelector<HTMLButtonElement>("#drawer-toggle")!;
const drawerLabel = document.querySelector<HTMLElement>("#drawer-label")!;
const drawerSub = document.querySelector<HTMLElement>("#drawer-sub")!;
const drawerAction = document.querySelector<HTMLElement>("#drawer-action")!;
const compareHelp = document.querySelector<HTMLElement>("#compare-help")!;
const compareInput = document.querySelector<HTMLInputElement>("#compare-q")!;
const compareSuggest = document.querySelector<HTMLElement>("#compare-suggest")!;
const clearCompare = document.querySelector<HTMLButtonElement>("#clear-compare")!;
const filterButtons = [...document.querySelectorAll<HTMLButtonElement>("[data-filter]")];

function narrowScreen(): boolean {
  return window.innerWidth < 960;
}

function openDrawerIfNarrow() {
  if (narrowScreen()) state.drawerOpen = true;
}

function readUrl() {
  const params = new URLSearchParams(location.hash.replace(/^#/, ""));
  const mode = params.get("mode") === "ethnicity" ? "ethnicity" : "surname";
  return {
    province: params.get("p"),
    city: params.get("c"),
    level: params.get("lv") === "province" ? ("province" as const) : ("nation" as const),
    mode: mode as Mode,
    query: params.get("q") ?? "",
    find: params.get("find") ?? "",
    compareProvince: params.get("b"),
    compareCity: params.get("bc"),
    spot: params.get("spot"),
    browse: params.get("browse"),
    browseProvince: params.get("bp"),
    pair: [params.get("s1"), params.get("s2")].filter((item): item is string => Boolean(item)),
  };
}

function writeUrl() {
  if (silenceUrl) return;
  const params = new URLSearchParams();
  if (state.province) params.set("p", state.province);
  if (state.level === "province") params.set("lv", "province");
  if (state.city) params.set("c", state.city);
  if (state.query && state.queryKind) {
    params.set("q", state.query);
    params.set("mode", state.queryKind);
  }
  if (state.find) params.set("find", state.find);
  if (state.compare) {
    params.set("b", state.compare.province);
    if (state.compare.city) params.set("bc", state.compare.city);
  }
  if (state.spot) params.set("spot", state.spot);
  if (state.browse) params.set("browse", state.browse);
  if (state.browseProvince) params.set("bp", state.browseProvince);
  if (state.pair[0]) params.set("s1", state.pair[0]);
  if (state.pair[1]) params.set("s2", state.pair[1]);
  const current = new URLSearchParams(location.hash.replace(/^#/, ""));
  const keys = new Set([...params.keys(), ...current.keys()]);
  let same = true;
  for (const key of keys) {
    if ((params.get(key) ?? "") !== (current.get(key) ?? "")) same = false;
  }
  if (same) return;
  const next = params.toString();
  const url = next ? `${location.pathname}${location.search}#${next}` : `${location.pathname}${location.search}`;
  history.replaceState(null, "", url);
}

function closeSuggestions() {
  state.suggestOpen = false;
  suggest.hidden = true;
  suggest.innerHTML = "";
  searchHits = [];
}

function renderSuggestionButtons(target: HTMLElement, hits: SearchHit[]) {
  target.innerHTML = hits
    .map((item, index) => {
      const active = target === suggest && index === state.suggestIndex ? " is-active" : "";
      const selected = target === suggest && index === state.suggestIndex;
      return `<button type="button" class="suggest-item${active}" role="option" data-i="${index}" aria-selected="${selected}">
        <span class="tag">${esc(item.facet ?? "")}</span>
        <span class="suggest-title">${esc(item.title)}</span>
        <small>${esc(item.note)}</small>
      </button>`;
    })
    .join("");
}

function renderSuggestions() {
  searchHits = searchSuggestions(state.filter, input.value);
  if (!input.value.trim()) {
    closeSuggestions();
    return;
  }
  if (searchHits.length === 0) {
    state.suggestOpen = true;
    suggest.hidden = false;
    suggest.innerHTML = `<p class="suggest-empty">没有匹配的姓氏、民族或地点</p>`;
    return;
  }
  if (state.suggestIndex >= searchHits.length) state.suggestIndex = 0;
  state.suggestOpen = true;
  suggest.hidden = false;
  renderSuggestionButtons(suggest, searchHits);
}

function closeCompareSuggestions() {
  compareHits = [];
  compareSuggest.hidden = true;
  compareSuggest.innerHTML = "";
}

function renderCompareSuggestions() {
  compareHits = regionSuggestions(compareInput.value);
  if (!compareInput.value.trim() || compareHits.length === 0) {
    if (compareInput.value.trim()) {
      compareSuggest.hidden = false;
      compareSuggest.innerHTML = `<p class="suggest-empty">没有这个省或市</p>`;
      return;
    }
    closeCompareSuggestions();
    return;
  }
  compareSuggest.hidden = false;
  renderSuggestionButtons(compareSuggest, compareHits);
}

function renderChrome() {
  for (const button of filterButtons) {
    const on = button.dataset.filter === state.filter;
    button.classList.toggle("is-on", on);
    button.setAttribute("aria-pressed", String(on));
  }
  input.placeholder =
    state.filter === "surname"
      ? "搜索姓氏，例如 林、陈、马"
      : state.filter === "ethnicity"
        ? "搜索民族，例如 壮族、回族、朝鲜族"
        : state.filter === "place"
          ? "搜索地名、景点或特色，例如 西湖、龙井"
          : "搜索姓氏、民族、地名、景点或特色";
  clearButton.disabled = !state.query && !state.find && !input.value.trim();
  if (state.error) formNote.textContent = state.error;
  else if (state.query && state.via) formNote.textContent = `已按姓氏「${state.query}」高亮（${state.via} 是常见写法）`;
  else if (state.query && state.queryKind) formNote.textContent = `正在按${modeLabel(state.queryKind)}「${state.query}」高亮`;
  else if (state.find) formNote.textContent = `已按「${state.find}」打开对应地区`;
  else formNote.textContent = "姓氏和民族会给地图着色。地名、景点和特色会打开对应的省或市。";

  const spotName = state.spot ? attractionById(state.spot)?.name : "";
  const place = spotName || state.city || (state.province ? fullName(state.province) : "");
  drawerLabel.textContent = place || (state.query ? `「${state.query}」` : "地区卡片");
  drawerSub.textContent = place ? "姓氏、民族与地方介绍" : "点开省份或城市后在这里展开";
  drawerAction.textContent = state.drawerOpen ? "收起" : "展开";
  drawerToggle.setAttribute("aria-expanded", String(state.drawerOpen));
  side.classList.toggle("is-open", state.drawerOpen);
  for (const button of document.querySelectorAll<HTMLButtonElement>("[data-browse]")) {
    button.classList.toggle("is-on", button.dataset.browse === state.browse);
  }
  layout.classList.toggle("has-compare", Boolean(state.compare));

  const primary = state.city ?? (state.province ? fullName(state.province) : "");
  if (!primary) compareHelp.textContent = "先点开一个省或市。也可以在下面直接选，会先打开那一地。";
  else if (!state.compare) compareHelp.textContent = `再选一个省或市，和「${primary}」并排看姓氏、民族、习俗、景点和特色。`;
  else {
    const other = state.compare.city ?? fullName(state.compare.province);
    compareHelp.textContent = `正在对照「${primary}」和「${other}」。两边都是示意数据和整理介绍。`;
  }
  clearCompare.hidden = !state.compare;
}

function crumbButton(level: string, label: string, current: boolean): string {
  const here = current ? " is-here" : "";
  const aria = current ? ` aria-current="page"` : "";
  return `<button type="button" class="crumb-btn${here}" data-crumb="${level}"${aria}>${esc(label)}</button>`;
}

function renderCrumbs() {
  const drilled = state.level === "province" && Boolean(state.province);
  backNation.hidden = !drilled;
  const nationHere = state.level === "nation" && !state.province;
  const provinceHere = Boolean(state.province) && !state.city && !state.spot;
  const parts = [crumbButton("nation", "全国", nationHere)];
  if (state.province) {
    parts.push(`<span class="sep" aria-hidden="true">›</span>`);
    parts.push(crumbButton("province", fullName(state.province), provinceHere));
  }
  if (state.city && state.province) {
    parts.push(`<span class="sep" aria-hidden="true">›</span>`);
    parts.push(crumbButton("city", state.city, !state.spot));
  }
  const spot = state.spot ? attractionById(state.spot) : undefined;
  if (spot && spot.province === state.province) {
    parts.push(`<span class="sep" aria-hidden="true">›</span>`);
    parts.push(crumbButton("spot", spot.name, true));
  }
  crumbs.innerHTML = parts.join("");
  mapTitle.textContent = drilled ? `${fullName(state.province ?? "")} · 地级` : "省级地图";
}

function activeRanked() {
  if (!state.query || !state.queryKind) return [];
  if (state.level === "province" && state.cityPack && state.province) {
    return rankCities(state.cityPack, state.queryKind, state.query, state.province);
  }
  return rankProvinces(state.queryKind, state.query);
}

function renderLegend() {
  renderCrumbs();
  const drilled = state.level === "province" && state.province;
  if (!state.query || !state.queryKind) {
    legend.innerHTML = drilled
      ? `<p>当前是地级地图，底色不表示数值。搜索姓氏或民族后，按这一层的示意比例着色。</p>`
      : `<p>默认底图不表示数值。选择姓氏或民族后，颜色越深，示意比例越高。点击省份进入地级地图。灰色为暂无数据。</p>`;
    mapStatus.textContent = drilled
      ? "可拖拽、滚轮缩放。点击城市打开地区卡片。"
      : "可拖拽、滚轮缩放。点击省份进入地级地图。灰色表示暂无同口径数据。";
    return;
  }
  const ranked = activeRanked();
  const flat = isFlatSpread(ranked.map((item) => item.share));
  const max = ranked[0]?.share ?? 0;
  const scope = drilled ? "当前各地级单位" : "各省";
  if (flat) {
    legend.innerHTML = `<p>「${esc(state.query)}」在${scope}的示意比例很接近，没有明显高低差。最高约 ${esc(formatPct(max))}。</p>`;
  } else {
    legend.innerHTML = `
      <div class="legend-scale">
        <span>低</span>
        <div class="legend-bar" style="background:${legendGradient()}"></div>
        <span>${esc(formatPct(max))}</span>
      </div>
      <p>「${esc(state.query)}」占${scope}人口的示意比例。深色更高。这是示意数据。</p>
    `;
  }
  mapStatus.textContent = `正在按「${state.query}」在${drilled ? "地级" : "省级"}的比例着色。`;
}

function renderRank() {
  if (!state.query || !state.queryKind) {
    rank.hidden = true;
    rank.innerHTML = "";
    return;
  }
  const entry = entryOf(state.queryKind, state.query);
  const ranked = activeRanked();
  const cityMode = state.level === "province" && state.cityPack;
  if (!entry) {
    rank.hidden = true;
    return;
  }
  const positive = ranked.filter((province) => province.share > 0);
  const visible = state.rankExpanded ? positive : positive.slice(0, 8);
  const max = positive[0]?.share || 1;
  const hiddenZero = ranked.length - positive.length;
  rank.hidden = false;
  rank.innerHTML = `
    <header class="card-head">
      <p class="eyebrow">${cityMode ? "地级聚集" : `${modeLabel(state.queryKind)}聚集`}</p>
      <h2>「${esc(state.query)}」</h2>
      <p class="hint">${cityMode ? `按${esc(fullName(state.province ?? ""))}各地的示意比例排序。` : `${esc(entry.hint)}。全国参照份额 ${esc(formatPct(entry.nationalShare))}。`}</p>
    </header>
    <div class="rank-list">
      ${visible
        .map((province, index) => {
          const width = Math.max(0, (province.share / max) * 100);
          const selectedName = state.level === "province" ? state.city : state.province;
          const selected = selectedName === province.short ? " is-selected" : "";
          return `<button type="button" class="rank-row${selected}" data-province="${esc(province.short)}">
            <span class="rank-index">${index + 1}</span>
            <span class="rank-name">${esc(province.short)}</span>
            <span class="track" aria-hidden="true"><span class="surname-fill" style="width:${width.toFixed(2)}%"></span></span>
            <span class="pct">${esc(formatPct(province.share))}</span>
          </button>`;
        })
        .join("")}
    </div>
    ${
      positive.length > 8
        ? `<button type="button" id="expand-rank" class="text-btn">${state.rankExpanded ? "收起" : `展开全部 ${positive.length} 个有比例的单位`}</button>`
        : ""
    }
    ${hiddenZero ? `<p class="fine">其余 ${hiddenZero} 个单位的示意比例为 0.00%。</p>` : ""}
  `;
}

function dataNoteHtml(): string {
  return `<div class="data-note">
    <p><strong>示意数据。</strong>姓氏和民族比例是按公开排行和区域格局整理的示意图，用来看相对高低，不是户籍登记，也不是人口普查公报。</p>
    <p><strong>整理介绍。</strong>习俗、景点、特色是公开地方常识写成的短文，不是文化和旅游部门公布的名录。</p>
  </div>`;
}

function linkSpotText(text: string, spots: Attraction[]): string {
  const tokens = spots.flatMap((spot) => [spot.name, ...spot.aliases.filter((alias) => alias.length >= 2)].map((name) => ({ name, id: spot.id })));
  tokens.sort((a, b) => b.name.length - a.name.length);
  const used = new Array<boolean>(text.length).fill(false);
  const marks: { start: number; end: number; id: string; name: string }[] = [];
  for (const token of tokens) {
    let from = 0;
    while (from < text.length) {
      const at = text.indexOf(token.name, from);
      if (at < 0) break;
      const end = at + token.name.length;
      if (used.slice(at, end).some(Boolean)) {
        from = at + 1;
        continue;
      }
      for (let index = at; index < end; index += 1) used[index] = true;
      marks.push({ start: at, end, id: token.id, name: token.name });
      from = end;
    }
  }
  marks.sort((a, b) => a.start - b.start);
  let html = "";
  let cursor = 0;
  for (const mark of marks) {
    html += esc(text.slice(cursor, mark.start));
    html += `<button type="button" class="spot-link" data-spot="${esc(mark.id)}">${esc(mark.name)}</button>`;
    cursor = mark.end;
  }
  html += esc(text.slice(cursor));
  return html;
}

function spotButtons(spots: Attraction[]): string {
  if (!spots.length) return "";
  return `<div class="spot-list">${spots
    .map((spot) => {
      const grade = spot.grade ? `<small>国家${esc(spot.grade)}级</small>` : "";
      return `<button type="button" class="spot-chip" data-spot="${esc(spot.id)}">${esc(spot.name)}${grade}</button>`;
    })
    .join("")}</div>`;
}

function renderCulture(note: CultureNote | undefined, province: string, city: string | null): string {
  if (!note) return `<section class="culture"><h3>地方介绍</h3><p class="fine">暂无整理介绍。</p></section>`;
  const shown = attractionsFor(province, city);
  const linkable = attractionsInProvince(province);
  const customs = shown.filter((spot) => spot.kind === "custom");
  const sights = shown.filter((spot) => spot.kind === "sight");
  const specialties = shown.filter((spot) => spot.kind === "specialty");
  const hub = hubFor(province);
  const transport = hub
    ? `<h4>交通</h4><p>${city ? `到${esc(city)}，一般先进入${esc(fullName(province))}。` : ""}${esc(hub)}具体班次和景区接驳不在这里列。</p><p class="fine">整理说明，不是铁路、民航或景区时刻表。出发前核对官方或承运人信息。</p>`
    : "";
  return `<section class="culture">
    <h3>地方介绍</h3>
    <h4>习俗</h4>
    <p>${linkSpotText(note.customs, linkable.filter((spot) => spot.kind === "custom"))}</p>
    ${spotButtons(customs)}
    <h4>景点</h4>
    <p>${linkSpotText(note.sights, linkable.filter((spot) => spot.kind === "sight"))}</p>
    <p class="fine">点名字打开单独介绍。有国家A级的会标明，等级以最新公示为准。</p>
    ${spotButtons(sights)}
    <h4>特色</h4>
    <p>${linkSpotText(note.specialties, linkable.filter((spot) => spot.kind === "specialty"))}</p>
    ${spotButtons(specialties)}
    ${transport}
  </section>`;
}

function renderSpot(spot: Attraction, compact = false): string {
  const where = spot.city ? `${fullName(spot.province)} · ${spot.city}` : fullName(spot.province);
  const kindLabel = spot.kind === "custom" ? "习俗" : spot.kind === "specialty" ? "特色" : "景点";
  const historyTitle = spot.kind === "specialty" ? "是什么" : spot.kind === "custom" ? "怎么过" : "背景";
  const ticketTitle = spot.kind === "specialty" ? "花费" : spot.kind === "custom" ? "要不要门票" : "门票参考";
  const visitTitle = spot.kind === "specialty" ? "怎么认" : spot.kind === "custom" ? "什么时候去看" : "怎么逛";
  const grade = spot.grade
    ? `<p class="grade">公开资料中长期列为国家${esc(spot.grade)}级旅游景区。等级可能调整，不是实时公示。</p>`
    : "";
  const season = spot.season ? `<h3>季节</h3><p>${esc(spot.season)}</p>` : "";
  const caution = spot.caution ? `<h3>注意</h3><p>${esc(spot.caution)}</p>` : "";
  const access = spot.access
    ? `<h3>交通</h3><p>${esc(spot.access)}</p><p class="fine">整理说明，不是时刻表。出发前请核对铁路、民航、客运和景区的官方信息。</p>`
    : "";
  const links = spot.links?.length
    ? `<p class="official-links">${spot.links
        .map((link) => `<a class="official-link" href="${esc(link.href)}" target="_blank" rel="noreferrer">${esc(link.label)}</a>`)
        .join("")}</p><p class="fine">只放了能确认的官方或景区网站，用来自己核对开放和票务。没有把握的链接没有放。</p>`
    : "";
  const image = spot.image
    ? `<figure class="spot-photo"><img src="${esc(spot.image.src)}" alt="${esc(spot.name)}" loading="lazy" /><figcaption>照片：${esc(spot.image.author)}，${esc(spot.image.license)}。<a href="${esc(spot.image.page)}" target="_blank" rel="noreferrer">维基共享资源原文件</a></figcaption></figure>`
    : "";
  const backLabel = state.browse ? "返回浏览列表" : "返回地区卡片";
  const fav = viewForSpot(spot.id);
  const faved = fav ? isFav(fav.key) : false;
  const inPair = state.pair.includes(spot.id);
  return `<article class="region-card spot-page">
    <div class="card-actions">
      ${compact ? "" : `<button type="button" class="text-btn" data-back-region>${backLabel}</button>`}
      ${compact ? "" : `<button type="button" class="text-btn" data-copy-link>复制链接</button>`}
      <button type="button" class="text-btn${faved ? " is-on" : ""}" data-fav-spot="${esc(spot.id)}">${faved ? "已收藏" : "收藏"}</button>
      <button type="button" class="text-btn" data-pair-add="${esc(spot.id)}">${inPair ? "移出对比" : "加入对比"}</button>
    </div>
    <header class="card-head">
      <p class="eyebrow">${esc(where)} · ${kindLabel} · 整理介绍</p>
      <h2 tabindex="-1">${esc(spot.name)}</h2>
    </header>
    ${image}
    ${grade}
    ${links}
    <h3>${historyTitle}</h3>
    <p>${esc(spot.history)}</p>
    <h3>${ticketTitle}</h3>
    <p>${esc(spot.tickets)}</p>
    <p class="fine">若写了数字，只是整理时的公开参考，不是当日官价。出发前请在官方渠道核对。</p>
    <h3>${visitTitle}</h3>
    <p>${esc(spot.visit)}</p>
    ${access}
    ${season}
    ${caution}
  </article>`;
}

function renderSpotPair(left: Attraction, right: Attraction): string {
  return `<article class="region-card">
    <div class="card-actions">
      <button type="button" class="text-btn" data-clear-pair>退出景点对比</button>
      <button type="button" class="text-btn" data-copy-link>复制链接</button>
    </div>
    <header class="card-head">
      <p class="eyebrow">介绍对比 · 整理介绍</p>
      <h2>${esc(left.name)} 与 ${esc(right.name)}</h2>
      <p class="hint">对照背景、花费、怎么逛和交通。窄屏改成上下排列。</p>
    </header>
    <div class="compare-grid">
      <div class="compare-col">${renderSpot(left, true)}</div>
      <div class="compare-col">${renderSpot(right, true)}</div>
    </div>
  </article>`;
}

const BROWSE_LABELS: Record<string, string> = {
  mountain: "看山",
  heritage: "看古建",
  festival: "看节庆",
  water: "看水景",
  town: "看古镇",
  museum: "看博物馆",
  spring: "春天",
  summer: "夏天",
  autumn: "秋天",
  winter: "冬天",
};

function renderBrowse(): string {
  if (!state.browse) return "";
  const [mode, id] = state.browse.split(":") as ["theme" | "season", string];
  const matched = browseAttractions(mode, id);
  const provinces = [...new Set(matched.map((spot) => spot.province))];
  const filtered = state.browseProvince ? matched.filter((spot) => spot.province === state.browseProvince) : matched;
  const items = filtered.slice(0, 40);
  const options = [`<option value="">全部省份</option>`]
    .concat(provinces.map((province) => `<option value="${esc(province)}"${province === state.browseProvince ? " selected" : ""}>${esc(fullName(province))}</option>`))
    .join("");
  const rows = items
    .map((spot) => {
      const where = spot.city ? `${fullName(spot.province)} · ${spot.city}` : fullName(spot.province);
      return `<button type="button" class="browse-row" data-spot="${esc(spot.id)}" data-province="${esc(spot.province)}" data-city="${esc(spot.city ?? "")}">
        <span>${esc(spot.name)}</span><small>${esc(where)}</small>
      </button>`;
    })
    .join("");
  return `<section class="browse-card">
    <header class="card-head">
      <p class="eyebrow">浏览 · 整理</p>
      <h2>${esc(BROWSE_LABELS[id] ?? id)}</h2>
      <p class="hint">只列出名称或季节说明对得上的条目，不是官方主题名录。可以用省份缩小范围，点一条打开介绍。</p>
    </header>
    <label class="browse-filter">省份
      <select data-browse-province>${options}</select>
    </label>
    <div class="browse-list">${rows || `<p class="fine">这一类在当前省份还没有收进清单。</p>`}</div>
  </section>`;
}

function renderBars(rows: { name: string; share: number }[], tone: "surname" | "ethnic"): string {
  const max = Math.max(...rows.map((row) => row.share), 0.01);
  return rows
    .map((row) => {
      const width = ((row.share / max) * 100).toFixed(2);
      const fillStyle = tone === "ethnic" ? `width:${width}%;background:${ethnicColor(row.name)}` : `width:${width}%`;
      const fillClass = tone === "surname" ? "surname-fill" : "ethnic-fill";
      return `<div class="metric">
        <span class="metric-name">${esc(row.name)}</span>
        <span class="track" aria-hidden="true"><span class="${fillClass}" style="${fillStyle}"></span></span>
        <span class="pct">${esc(formatPct(row.share))}</span>
      </div>`;
    })
    .join("");
}

function shareCallout(province: string, city: string | null, pack: CityFile | null): string {
  if (!state.query || !state.queryKind || isUnavailable(province)) return "";
  const entry = entryOf(state.queryKind, state.query);
  if (!entry) return "";
  let share = entry.shares[province] ?? 0;
  if (city) {
    if (!pack) return "";
    share = cityUnitShare(pack, state.queryKind, state.query, city, share);
  }
  const where = city ?? fullName(province);
  const national = city ? "" : `（全国参照 ${esc(formatPct(entry.nationalShare))}）`;
  return `<p class="callout">「${esc(state.query)}」在${esc(where)}的示意比例为 <strong>${esc(formatPct(share))}</strong>${national}。</p>`;
}

function regionColumn(province: string, city: string | null, pack: CityFile | null, solo: boolean): string {
  const title = city ?? fullName(province);
  const eyebrow = city ? `${fullName(province)} · 地区卡片` : "地区卡片";
  const note = city ? cultureForCity(province, city) : cultureForProvince(province);
  const regionView = viewForRegion(province, city);
  const regionFaved = isFav(regionView.key);
  const actions = solo
    ? `<div class="card-actions">
        <button type="button" class="text-btn" data-copy-link>复制链接</button>
        <button type="button" class="text-btn${regionFaved ? " is-on" : ""}" data-fav-region="${esc(province)}" data-fav-city="${esc(city ?? "")}">${regionFaved ? "已收藏" : "收藏此地"}</button>
      </div>`
    : "";
  const head = `${actions}<header class="card-head">
      <p class="eyebrow">${esc(eyebrow)}</p>
      <h2 tabindex="-1">${esc(title)}</h2>
      ${solo && !city ? `<p class="hint">${esc(isUnavailable(province) ? unavailableNote(province) : provinceBlurb(province))}</p>` : ""}
      ${solo && city ? `<p class="hint">${pack && cityHasLocalEthnicity(pack, city) ? "民族构成按当地公开格局单列。姓氏只在市内差异清楚时才偏离全省。" : "民族构成沿用全省示意。没有单独列出的姓氏，与全省示意比例相同。"}</p>` : ""}
    </header>`;
  if (isUnavailable(province)) {
    return `<article class="region-card">${head}
      ${solo ? dataNoteHtml() : ""}
      <p class="hint">${esc(unavailableNote(province))}这里不提供可与内地对照的姓氏或民族比例。</p>
      ${renderCulture(note, province, city)}
    </article>`;
  }
  const surnames = city && pack ? topSurnamesAt(pack, city, province) : topSurnames(province);
  const ethnic = city && pack ? ethnicCompositionAt(pack, city, province) : ethnicComposition(province);
  const tracked = city && pack ? trackedSurnameTotalAt(pack, city, province) : trackedSurnameTotal(province);
  const drilledNote =
    solo && !city && state.level === "province"
      ? `<p class="fine">已进入地级地图。点一个城市，卡片会换成那一地自己的介绍。</p>`
      : "";
  return `<article class="region-card">
    ${head}
    ${solo ? dataNoteHtml() : ""}
    ${drilledNote}
    ${shareCallout(province, city, pack)}
    ${renderCulture(note, province, city)}
    <h3>常见姓氏</h3>
    <div class="metrics">${renderBars(surnames, "surname")}</div>
    <p class="fine">表内姓氏合计约占 ${esc(formatPct(tracked))}。这是示意数据，不是官方微观数据。</p>
    <h3>民族构成</h3>
    <div class="stack" aria-hidden="true">${ethnic
      .map((row) => `<span style="width:${row.share.toFixed(2)}%;background:${ethnicColor(row.name)}" title="${esc(row.name)} ${esc(formatPct(row.share))}"></span>`)
      .join("")}</div>
    <div class="metrics">${renderBars(ethnic, "ethnic")}</div>
  </article>`;
}

function renderSavedLists() {
  const favList = document.querySelector<HTMLElement>("#fav-list");
  const recentList = document.querySelector<HTMLElement>("#recent-list");
  if (!favList || !recentList) return;
  const paint = (items: SavedItem[], empty: string) =>
    items.length
      ? items
          .map(
            (item) =>
              `<button type="button" class="saved-row" data-open-province="${esc(item.province)}" data-open-city="${esc(item.city ?? "")}" data-open-spot="${esc(item.spot ?? "")}"><span>${esc(item.label)}</span></button>`,
          )
          .join("")
      : `<p class="fine">${empty}</p>`;
  favList.innerHTML = paint(readSaved(FAV_KEY), "还没有收藏。");
  recentList.innerHTML = paint(readSaved(RECENT_KEY), "打开地区或介绍后会出现在这里。");
}

function renderDetailSafe() {
  if (state.pair.length === 2 && attractionsLoaded()) {
    const left = attractionById(state.pair[0]);
    const right = attractionById(state.pair[1]);
    if (left && right) {
      detail.innerHTML = renderSpotPair(left, right);
      return;
    }
  }
  if (state.spot && state.province) {
    const spot = attractionById(state.spot);
    if (spot && spot.province === state.province) {
      detail.innerHTML = renderSpot(spot);
      return;
    }
    if (!spot && !attractionsLoaded()) {
      detail.innerHTML = `<article class="region-card"><p class="hint">正在打开景点介绍…</p></article>`;
      return;
    }
    state.spot = null;
  }
  if (!state.province) {
    detail.innerHTML = `${state.browse ? renderBrowse() : ""}
      <article class="region-card">
        <header class="card-head">
          <p class="eyebrow">地区卡片</p>
          <h2>点开一个省份</h2>
          <p class="hint">地图可选内地省级单位，以及香港、澳门、台湾。点开后，姓氏、民族和地方介绍在同一张卡片里。</p>
        </header>
        ${dataNoteHtml()}
      </article>
    `;
    return;
  }
  if (state.compare) {
    const left = state.city ?? fullName(state.province);
    const right = state.compare.city ?? fullName(state.compare.province);
    detail.innerHTML = `
      <article class="region-card">
        <header class="card-head">
          <p class="eyebrow">地区卡片 · 对比</p>
          <h2>${esc(left)} 与 ${esc(right)}</h2>
          <p class="hint">左右两栏都列出姓氏、民族，以及习俗、景点、特色。窄屏会改成上下排列。</p>
        </header>
        ${dataNoteHtml()}
        <div class="compare-grid">
          <div class="compare-col">${regionColumn(state.province, state.city, state.cityPack, false)}</div>
          <div class="compare-col">${regionColumn(state.compare.province, state.compare.city, state.compare.pack, false)}</div>
        </div>
      </article>
    `;
    return;
  }
  detail.innerHTML = `${state.browse ? renderBrowse() : ""}${regionColumn(state.province, state.city, state.cityPack, true)}`;
}

function refresh() {
  renderSavedLists();
  renderChrome();
  renderLegend();
  renderRank();
  renderDetailSafe();
  writeUrl();
  const ranked = activeRanked();
  const shares = state.query && state.queryKind ? new Map(ranked.map((item) => [item.short, item.share])) : null;
  atlas?.setView({
    level: state.level,
    adcode: state.level === "province" && state.province ? ADCODE[state.province] : null,
    selected: state.level === "province" ? state.city : state.province,
    query: state.query || null,
    shares,
    flat: isFlatSpread(ranked.map((item) => item.share)),
  });
  if (state.booted) {
    const queryText = state.query ? `已按${state.queryKind ? modeLabel(state.queryKind) : ""}「${state.query}」高亮` : state.find ? `已打开「${state.find}」` : "已恢复默认地图";
    const place = state.city ?? (state.province ? fullName(state.province) : "");
    live.textContent = `${queryText}${place ? `，当前为${place}` : ""}`;
  }
  state.booted = true;
}

async function openProvince(short: string) {
  const token = ++drillToken;
  if (!isKnownProvince(short)) return;
  if (isUnavailable(short)) {
    state.level = "nation";
    state.province = short;
    state.city = null;
    state.cityPack = null;
    openDrawerIfNarrow();
    refresh();
    focusDetail();
    return;
  }
  mapStatus.textContent = `正在打开${fullName(short)}的地级地图…`;
  try {
    const pack = await loadCityFile(short);
    if (token !== drillToken) return;
    await atlas?.ensureCity(ADCODE[short]);
    if (token !== drillToken) return;
    state.level = "province";
    state.province = short;
    state.city = null;
    state.cityPack = pack;
    state.rankExpanded = false;
    openDrawerIfNarrow();
    refresh();
    focusDetail();
  } catch (error) {
    if (token !== drillToken) return;
    state.error = error instanceof Error ? error.message : "地级地图加载失败";
    renderChrome();
  }
}

async function goToPlace(province: string, city: string | null) {
  if (!isKnownProvince(province)) return;
  if (isUnavailable(province)) {
    drillToken += 1;
    state.level = "nation";
    state.province = province;
    state.city = null;
    state.cityPack = null;
    openDrawerIfNarrow();
    refresh();
    focusDetail();
    if (state.province) rememberView(state.spot ? viewForSpot(state.spot) : viewForRegion(state.province, state.city));
    return;
  }
  if (state.level !== "province" || state.province !== province || !state.cityPack) {
    await openProvince(province);
    if (state.province !== province || state.level !== "province") return;
  }
  state.city = city && state.cityPack?.cities.includes(city) ? city : null;
  openDrawerIfNarrow();
  refresh();
  focusDetail();
  if (state.province) rememberView(state.spot ? viewForSpot(state.spot) : viewForRegion(state.province, state.city));
}

function backToNation() {
  drillToken += 1;
  state.level = "nation";
  state.city = null;
  state.cityPack = null;
  state.spot = null;
  refresh();
}

function focusDetail() {
  detail.querySelector<HTMLElement>("h2")?.focus();
}

async function applyHit(hit: SearchHit) {
  state.error = "";
  state.rankExpanded = false;
  closeSuggestions();
  if (hit.kind === "place") {
    if (!hit.province) return;
    state.query = "";
    state.queryKind = null;
    state.via = "";
    state.find = hit.commit;
    state.spot = hit.spot ?? null;
    input.value = hit.commit;
    await goToPlace(hit.province, hit.city ?? null);
    if (hit.spot) {
      state.spot = hit.spot;
      openDrawerIfNarrow();
      refresh();
      focusDetail();
    }
    return;
  }
  state.spot = null;
  state.find = "";
  state.queryKind = hit.kind;
  state.query = hit.title;
  state.via = hit.via ?? "";
  input.value = hit.title;
  refresh();
}

function clearQuery() {
  state.query = "";
  state.queryKind = null;
  state.via = "";
  state.find = "";
  state.error = "";
  state.rankExpanded = false;
  input.value = "";
  closeSuggestions();
  refresh();
}

function applyFromInput() {
  const raw = input.value.trim();
  if (!raw) {
    clearQuery();
    return;
  }
  const hits = searchHits.length ? searchHits : searchSuggestions(state.filter, raw);
  const picked = state.suggestOpen ? hits[state.suggestIndex] : undefined;
  if (picked) {
    void applyHit(picked);
    return;
  }
  if (state.filter !== "place") {
    const surname = state.filter === "ethnicity" ? null : resolveQuery("surname", raw);
    const ethnic = state.filter === "surname" ? null : resolveQuery("ethnicity", raw);
    if (surname && (raw === surname.name || raw === surname.via)) {
      void applyHit({
        kind: "surname",
        title: surname.name,
        note: surname.hint,
        commit: surname.name,
        via: surname.via,
        facet: "姓氏",
        score: 0,
      });
      return;
    }
    if (ethnic && (raw === ethnic.name || raw.replace(/族$/, "") === ethnic.name.replace(/族$/, ""))) {
      void applyHit({
        kind: "ethnicity",
        title: ethnic.name,
        note: ethnic.hint,
        commit: ethnic.name,
        facet: "民族",
        score: 0,
      });
      return;
    }
  }
  const place = hits.find((hit) => hit.kind === "place") ?? regionSuggestions(raw)[0];
  if (place) {
    void applyHit(place);
    return;
  }
  state.error = "没有匹配的姓氏、民族或地点";
  renderChrome();
}

function tryLiveApply() {
  const raw = input.value.trim();
  renderSuggestions();
  if (!raw) {
    if (state.query || state.find) clearQuery();
    return;
  }
  if (state.filter === "place") return;
  const hits = searchHits;
  const top = hits[0];
  if (!top || top.kind === "place") return;
  if (hits.some((hit) => hit.kind !== top.kind)) return;
  const exact = raw === top.title || raw === top.via || (top.kind === "ethnicity" && raw.replace(/族$/, "") === top.title.replace(/族$/, ""));
  const onlyKind = hits.every((hit) => hit.kind === top.kind);
  if (!exact && !(onlyKind && hits.length === 1)) return;
  if (state.query === top.title && state.queryKind === top.kind) return;
  void applyHit(top);
}

async function setCompare(province: string, city: string | null) {
  if (!isKnownProvince(province)) return;
  if (!state.province) {
    state.find = city ?? fullName(province);
    await goToPlace(province, city);
    return;
  }
  let pack: CityFile | null = null;
  let nextCity = city;
  if (!isUnavailable(province) && nextCity) {
    pack = state.province === province && state.cityPack ? state.cityPack : await loadCityFile(province);
    if (!pack.cities.includes(nextCity)) nextCity = null;
  } else {
    nextCity = null;
  }
  state.compare = { province, city: nextCity, pack };
  compareInput.value = "";
  closeCompareSuggestions();
  openDrawerIfNarrow();
  refresh();
  detail.scrollIntoView({ block: "nearest" });
}

async function showProvinceLevel() {
  if (!state.province) return;
  if (isUnavailable(state.province)) {
    state.level = "nation";
    state.city = null;
    state.find = "";
    state.spot = null;
    refresh();
    focusDetail();
    return;
  }
  if (state.level !== "province" || !state.cityPack) {
    state.find = "";
    await openProvince(state.province);
    return;
  }
  state.city = null;
  state.find = "";
  state.spot = null;
  refresh();
  focusDetail();
}

const attractionsReady = fetch(`${import.meta.env.BASE_URL}data/attractions.json`)
  .then((response) => {
    if (!response.ok) throw new Error("景点介绍加载失败");
    return response.json() as Promise<{ spots: Attraction[]; hubs?: Record<string, string> }>;
  })
  .then((file) => {
    setAttractions(file.spots, file.hubs ?? {});
  });

async function restoreFromUrl() {
  const url = readUrl();
  silenceUrl = true;
  try {
    await attractionsReady;
  } catch {
    state.error = "景点介绍暂时没有加载";
  }
  try {
    if (url.query) {
      const resolved = resolveQuery(url.mode, url.query);
      if (resolved && resolved.name === url.query) {
        state.queryKind = url.mode;
        state.query = resolved.name;
        input.value = resolved.name;
      }
    } else if (url.find) {
      state.find = url.find;
      input.value = url.find;
    }
    if (url.province && isKnownProvince(url.province)) {
      if (isUnavailable(url.province) || url.level === "nation") {
        state.level = "nation";
        state.province = url.province;
        state.city = null;
        state.cityPack = null;
      } else {
        await openProvince(url.province);
        if (url.city && state.cityPack?.cities.includes(url.city)) state.city = url.city;
      }
    }
    if (url.compareProvince && isKnownProvince(url.compareProvince)) {
      let pack: CityFile | null = null;
      let city = url.compareCity;
      if (city && !isUnavailable(url.compareProvince)) {
        pack =
          state.province === url.compareProvince && state.cityPack
            ? state.cityPack
            : await loadCityFile(url.compareProvince);
        if (!pack.cities.includes(city)) city = null;
      } else city = null;
      state.compare = { province: url.compareProvince, city, pack };
    }
    if (url.browse && /^(theme|season):/.test(url.browse)) state.browse = url.browse;
    if (url.browseProvince) state.browseProvince = url.browseProvince;
    state.pair = url.pair.filter((id) => Boolean(attractionById(id))).slice(0, 2);
    if (url.spot && state.province) {
      const spot = attractionById(url.spot);
      state.spot = spot && spot.province === state.province ? spot.id : null;
    }
    if (narrowScreen() && (state.province || state.spot || state.browse)) state.drawerOpen = true;
  } finally {
    silenceUrl = false;
  }
  if (state.spot) rememberView(viewForSpot(state.spot));
  else if (state.province) rememberView(viewForRegion(state.province, state.city));
  refresh();
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (composing) return;
  applyFromInput();
});

input.addEventListener("compositionstart", () => {
  composing = true;
});
input.addEventListener("compositionend", () => {
  composing = false;
  tryLiveApply();
});
input.addEventListener("input", () => {
  if (composing) return;
  tryLiveApply();
});
input.addEventListener("keydown", (event) => {
  if (!searchHits.length) return;
  if (event.key === "ArrowDown") {
    event.preventDefault();
    state.suggestIndex = (state.suggestIndex + 1) % searchHits.length;
    renderSuggestions();
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    state.suggestIndex = (state.suggestIndex - 1 + searchHits.length) % searchHits.length;
    renderSuggestions();
  }
});

suggest.addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-i]");
  if (!button) return;
  const hit = searchHits[Number(button.dataset.i)];
  if (!hit) return;
  void applyHit(hit);
});

clearButton.addEventListener("click", () => clearQuery());

for (const button of filterButtons) {
  button.addEventListener("click", () => {
    const filter = button.dataset.filter as SearchFilter;
    if (filter === state.filter) return;
    state.filter = filter;
    state.error = "";
    closeSuggestions();
    if (input.value.trim()) renderSuggestions();
    renderChrome();
  });
}

form.addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-example]");
  if (!button?.dataset.example) return;
  const [kind, name] = button.dataset.example.split(":") as [Mode, string];
  state.filter = "all";
  state.error = "";
  state.find = "";
  state.spot = null;
  state.queryKind = kind;
  state.query = name;
  state.via = "";
  state.rankExpanded = false;
  input.value = name;
  closeSuggestions();
  refresh();
});

rank.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  const provinceButton = target.closest<HTMLButtonElement>("button[data-province]");
  if (provinceButton?.dataset.province) {
    const unit = provinceButton.dataset.province;
    state.find = "";
    state.spot = null;
    if (state.level === "province") {
      state.city = unit;
      openDrawerIfNarrow();
      refresh();
    } else {
      void openProvince(unit);
    }
    focusDetail();
    return;
  }
  if (target.closest("#expand-rank")) {
    state.rankExpanded = !state.rankExpanded;
    renderRank();
  }
});

crumbs.addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-crumb]");
  if (!button?.dataset.crumb) return;
  const level = button.dataset.crumb;
  if (level === "nation") {
    if (state.level === "nation") {
      state.province = null;
      state.city = null;
      state.cityPack = null;
      state.find = "";
      state.spot = null;
      refresh();
      return;
    }
    backToNation();
    return;
  }
  if (level === "province") {
    state.spot = null;
    void showProvinceLevel();
    return;
  }
  if (level === "spot") {
    openDrawerIfNarrow();
    focusDetail();
    return;
  }
  state.spot = null;
  openDrawerIfNarrow();
  refresh();
  focusDetail();
});

backNation.addEventListener("click", () => backToNation());

drawerToggle.addEventListener("click", () => {
  state.drawerOpen = !state.drawerOpen;
  renderChrome();
});

compareInput.addEventListener("input", () => renderCompareSuggestions());
compareInput.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  const hit = compareHits[0] ?? regionSuggestions(compareInput.value)[0];
  if (!hit?.province) return;
  void setCompare(hit.province, hit.city ?? null);
});
compareSuggest.addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-i]");
  if (!button) return;
  const hit = compareHits[Number(button.dataset.i)];
  if (!hit?.province) return;
  void setCompare(hit.province, hit.city ?? null);
});
clearCompare.addEventListener("click", () => {
  state.compare = null;
  closeCompareSuggestions();
  refresh();
});

document.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  if (!target.closest("#search-form .search-field")) closeSuggestions();
  if (!target.closest("#compare .search-field")) closeCompareSuggestions();
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (state.suggestOpen) {
    closeSuggestions();
    return;
  }
  if (state.drawerOpen && narrowScreen()) {
    state.drawerOpen = false;
    renderChrome();
    return;
  }
  if (state.query || state.find || input.value) clearQuery();
});

window.addEventListener("hashchange", () => {
  void restoreFromUrl();
});

silenceUrl = true;
refresh();

detail.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  if (target.closest("[data-back-region]")) {
    state.spot = null;
    refresh();
    focusDetail();
    return;
  }
  const copyButton = target.closest<HTMLButtonElement>("[data-copy-link]");
  if (copyButton) {
    const original = "复制链接";
    navigator.clipboard
      .writeText(location.href)
      .then(() => {
        copyButton.textContent = "已复制";
      })
      .catch(() => {
        copyButton.textContent = "复制失败";
      })
      .finally(() => {
        window.setTimeout(() => {
          copyButton.textContent = original;
        }, 1600);
      });
    return;
  }
  const favSpot = target.closest<HTMLButtonElement>("[data-fav-spot]");
  if (favSpot?.dataset.favSpot) {
    const item = viewForSpot(favSpot.dataset.favSpot);
    if (item) toggleFav(item);
    refresh();
    return;
  }
  const favRegion = target.closest<HTMLButtonElement>("[data-fav-region]");
  if (favRegion?.dataset.favRegion) {
    toggleFav(viewForRegion(favRegion.dataset.favRegion, favRegion.dataset.favCity || null));
    refresh();
    return;
  }
  const pairAdd = target.closest<HTMLButtonElement>("[data-pair-add]");
  if (pairAdd?.dataset.pairAdd) {
    const id = pairAdd.dataset.pairAdd;
    if (state.pair.includes(id)) state.pair = state.pair.filter((item) => item !== id);
    else state.pair = [...state.pair, id].slice(-2);
    refresh();
    return;
  }
  if (target.closest("[data-clear-pair]")) {
    state.pair = [];
    refresh();
    return;
  }
  const spotButton = target.closest<HTMLButtonElement>("[data-spot]");
  if (!spotButton?.dataset.spot) return;
  const nextSpot = spotButton.dataset.spot;
  const province = spotButton.dataset.province;
  const city = spotButton.dataset.city ? spotButton.dataset.city : null;
  state.spot = nextSpot;
  if (province && isKnownProvince(province) && (province !== state.province || city !== state.city)) {
    void goToPlace(province, city).then(() => {
      state.spot = nextSpot;
      openDrawerIfNarrow();
      refresh();
      focusDetail();
    });
    return;
  }
  openDrawerIfNarrow();
  refresh();
  focusDetail();
});

detail.addEventListener("change", (event) => {
  const select = (event.target as HTMLElement).closest<HTMLSelectElement>("[data-browse-province]");
  if (!select) return;
  state.browseProvince = select.value || null;
  refresh();
});

document.querySelector("#saved")?.addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-open-province]");
  if (!button?.dataset.openProvince) return;
  const province = button.dataset.openProvince;
  const city = button.dataset.openCity || null;
  const spot = button.dataset.openSpot || null;
  state.spot = spot;
  void goToPlace(province, city).then(() => {
    state.spot = spot;
    openDrawerIfNarrow();
    refresh();
    focusDetail();
  });
});

document.querySelector("#browse")?.addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-browse]");
  if (!button?.dataset.browse) return;
  state.browse = state.browse === button.dataset.browse ? null : button.dataset.browse;
  state.spot = null;
  state.pair = [];
  openDrawerIfNarrow();
  refresh();
});

mountMap(chartEl, (name) => {
  state.find = "";
  state.spot = null;
  if (state.level === "province") {
    state.city = name;
    openDrawerIfNarrow();
    refresh();
    focusDetail();
    return;
  }
  void openProvince(name);
})
  .then(async (map) => {
    atlas = map;
    chartStatus.hidden = true;
    await restoreFromUrl();
  })
  .catch((error: unknown) => {
    chartStatus.hidden = false;
    chartStatus.textContent = error instanceof Error ? error.message : "底图加载失败";
  });

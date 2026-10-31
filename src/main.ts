import "./style.css";
import { legendGradient, mountMap, type AtlasMap } from "./map";
import {
  type CityFile,
  type Mode,
  ADCODE,
  cityHasLocalEthnicity,
  entryOf,
  esc,
  ethnicComposition,
  ethnicCompositionAt,
  formatPct,
  fullName,
  isFlatSpread,
  isUnavailable,
  loadCityFile,
  modeLabel,
  provinceBlurb,
  rankCities,
  rankProvinces,
  resolveQuery,
  suggestionsFor,
  topSurnames,
  topSurnamesAt,
  trackedSurnameTotal,
  trackedSurnameTotalAt,
  unavailableNote,
} from "./model";
import { ethnicColor } from "./palette";

const app = document.querySelector<HTMLElement>("#app");
if (!app) throw new Error("缺少应用根节点");

const state: {
  mode: Mode;
  query: string;
  via: string;
  province: string | null;
  city: string | null;
  level: "nation" | "province";
  cityPack: CityFile | null;
  suggestIndex: number;
  suggestOpen: boolean;
  rankExpanded: boolean;
  error: string;
  booted: boolean;
} = {
  mode: "surname",
  query: "",
  via: "",
  province: null,
  city: null,
  level: "nation",
  cityPack: null,
  suggestIndex: 0,
  suggestOpen: false,
  rankExpanded: false,
  error: "",
  booted: false,
};

let drillToken = 0;

let composing = false;
let atlas: AtlasMap | null = null;

app.innerHTML = `
  <a class="skip" href="#detail">跳到省份详情</a>
  <header class="site-header">
    <div class="brand">
      <p class="seal" aria-hidden="true">图鉴</p>
      <div>
        <p class="eyebrow">省级分布 · 示意/整理数据</p>
        <h1>中国姓氏与民族图鉴</h1>
        <p class="lede">点击省份进入地级地图，再点城市查看示意构成。搜索姓氏或民族时，按当前这一层的聚集程度着色。</p>
      </div>
    </div>
    <form id="search-form" class="search-card" role="search">
      <div class="mode-switch" role="tablist" aria-label="搜索类型">
        <button type="button" class="mode is-on" data-mode="surname" role="tab" aria-pressed="true">姓氏</button>
        <button type="button" class="mode" data-mode="ethnicity" role="tab" aria-pressed="false">民族</button>
      </div>
      <div class="search-row">
        <div class="search-field">
          <label class="sr-only" for="q">搜索姓氏或民族</label>
          <input id="q" name="q" type="search" autocomplete="off" spellcheck="false" enterkeyhint="search" placeholder="搜索姓氏，例如 林、陈、马" />
          <div id="suggest" class="suggest" role="listbox" hidden></div>
        </div>
        <button type="submit" class="primary">高亮</button>
        <button type="button" id="clear" class="ghost" disabled>清除</button>
      </div>
      <p id="form-note" class="form-note" aria-live="polite"></p>
      <div class="examples">
        <span>试一试</span>
        <button type="button" data-example="surname:林">林</button>
        <button type="button" data-example="surname:陈">陈</button>
        <button type="button" data-example="surname:马">马</button>
        <button type="button" data-example="surname:欧阳">欧阳</button>
        <button type="button" data-example="ethnicity:壮族">壮族</button>
        <button type="button" data-example="ethnicity:回族">回族</button>
        <button type="button" data-example="ethnicity:朝鲜族">朝鲜族</button>
      </div>
    </form>
  </header>
  <main class="layout">
    <section class="map-card" aria-labelledby="map-title">
      <div class="map-toolbar">
        <div>
          <p class="crumb" id="crumb"><button type="button" id="back-nation" hidden>返回全国</button><span id="crumb-here">全国</span></p>
          <h2 id="map-title">省级地图</h2>
        </div>
        <p id="map-status">可拖拽、滚轮缩放。点击省份进入地级地图。灰色表示暂无同口径数据。</p>
      </div>
      <div id="chart" class="chart" role="img" aria-label="中国省级地图。点击省份可查看详情。">
        <p id="chart-status" class="chart-status">正在加载省级底图…</p>
      </div>
      <div id="legend" class="legend"></div>
    </section>
    <aside class="side">
      <section id="rank" class="card" hidden></section>
      <section id="detail" class="card" tabindex="-1"></section>
    </aside>
  </main>
  <footer class="footer">
    <p><strong>数据说明。</strong>本站姓氏与民族比例均为示意/整理数据，依据公开的人口普查摘要、常见姓氏排行和众所周知的区域分布格局整理，用来做省级地理浏览。这不是官方微观数据，不能当作统计公报、户籍或研究采信依据。</p>
    <p>地图使用阿里云 DataV GeoAtlas 公开边界：全国为省级，下钻后为地级市、自治州、地区、盟，直辖市为市辖区，海南含省直辖县。香港、澳门和台湾暂无同口径整理数据。南海诸岛界线只作底图示意。</p>
  </footer>
  <div id="live" class="sr-only" aria-live="polite"></div>
`;

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
const crumbHere = document.querySelector<HTMLElement>("#crumb-here")!;
const modeButtons = [...document.querySelectorAll<HTMLButtonElement>("[data-mode]")];

function currentSuggestions() {
  return suggestionsFor(state.mode, input.value);
}

function closeSuggestions() {
  state.suggestOpen = false;
  suggest.hidden = true;
  suggest.innerHTML = "";
}

function renderSuggestions() {
  const items = currentSuggestions();
  if (!input.value.trim() || items.length === 0) {
    if (input.value.trim()) {
      suggest.hidden = false;
      state.suggestOpen = true;
      suggest.innerHTML = `<p class="suggest-empty">没有匹配的${modeLabel(state.mode)}</p>`;
      return;
    }
    closeSuggestions();
    return;
  }
  if (state.suggestIndex >= items.length) state.suggestIndex = 0;
  state.suggestOpen = true;
  suggest.hidden = false;
  suggest.innerHTML = items
    .map((item, index) => {
      const active = index === state.suggestIndex ? " is-active" : "";
      return `<button type="button" class="suggest-item${active}" role="option" data-name="${esc(item.name)}" aria-selected="${index === state.suggestIndex}">
        <span>${esc(item.name)}</span><small>${esc(item.note)}</small>
      </button>`;
    })
    .join("");
}

function applyResolved(name: string, via = "") {
  state.query = name;
  state.via = via;
  state.error = "";
  state.rankExpanded = false;
  input.value = name;
  closeSuggestions();
  refresh();
}

function clearQuery() {
  state.query = "";
  state.via = "";
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
  const items = currentSuggestions();
  const picked = state.suggestOpen ? items[state.suggestIndex] : undefined;
  const resolved = resolveQuery(state.mode, picked?.name ?? raw);
  if (!resolved) {
    state.error = `没有匹配的${modeLabel(state.mode)}`;
    renderChrome();
    return;
  }
  applyResolved(resolved.name, resolved.via ?? "");
}

function tryLiveApply() {
  const raw = input.value.trim();
  renderSuggestions();
  if (!raw) {
    if (state.query) clearQuery();
    return;
  }
  const resolved = resolveQuery(state.mode, raw);
  const items = currentSuggestions();
  if (!resolved) return;
  const unambiguous = raw === resolved.name || items.length === 1;
  if (!unambiguous || state.query === resolved.name) return;
  state.query = resolved.name;
  state.via = resolved.via ?? "";
  state.error = "";
  state.rankExpanded = false;
  refresh();
}

function renderChrome() {
  for (const button of modeButtons) {
    const on = button.dataset.mode === state.mode;
    button.classList.toggle("is-on", on);
    button.setAttribute("aria-pressed", String(on));
  }
  input.placeholder = state.mode === "surname" ? "搜索姓氏，例如 林、陈、马" : "搜索民族，例如 壮族、回族、朝鲜族";
  clearButton.disabled = !state.query && !input.value.trim();
  if (state.error) formNote.textContent = state.error;
  else if (state.query && state.via) formNote.textContent = `已按「${state.query}」高亮（${state.via} 是常见写法）`;
  else if (state.query) formNote.textContent = `正在按${modeLabel(state.mode)}「${state.query}」高亮`;
  else formNote.textContent = "清除后恢复不着色的默认底图。点开省份时，姓氏和民族会一起显示。";
}

function activeRanked() {
  if (!state.query) return [];
  if (state.level === "province" && state.cityPack && state.province) {
    return rankCities(state.cityPack, state.mode, state.query, state.province);
  }
  return rankProvinces(state.mode, state.query);
}

function renderLegend() {
  const drilled = state.level === "province" && state.province;
  backNation.hidden = !drilled;
  crumbHere.textContent = drilled ? fullName(state.province ?? "") : "全国";
  mapTitle.textContent = drilled ? `${fullName(state.province ?? "")} · 地级` : "省级地图";
  if (!state.query) {
    legend.innerHTML = drilled
      ? `<p>当前是地级地图，底色不表示数值。搜索后按这一层的示意比例着色。点「返回全国」回到省级。</p>`
      : `<p>默认底图不表示数值。选择姓氏或民族后，颜色越深，示意比例越高。点击省份进入地级地图。灰色为暂无数据。</p>`;
    mapStatus.textContent = drilled
      ? "可拖拽、滚轮缩放。点击城市查看示意构成。"
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
      <p>「${esc(state.query)}」占${scope}人口的示意比例。深色更高。</p>
    `;
  }
  mapStatus.textContent = `正在按「${state.query}」在${drilled ? "地级" : "省级"}的比例着色。`;
}

function renderRank() {
  if (!state.query) {
    rank.hidden = true;
    rank.innerHTML = "";
    return;
  }
  const entry = entryOf(state.mode, state.query);
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
      <p class="eyebrow">${cityMode ? "地级聚集" : `${modeLabel(state.mode)}聚集`}</p>
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

function renderCityDetail(city: string, pack: CityFile, province: string) {
  const surnames = topSurnamesAt(pack, city, province);
  const ethnic = ethnicCompositionAt(pack, city, province);
  const tracked = trackedSurnameTotalAt(pack, city, province);
  const entry = state.query ? entryOf(state.mode, state.query) : undefined;
  const activeShare = entry ? cityUnitShareSafe(pack, city, province) : null;
  const callout =
    entry && activeShare !== null
      ? `<p class="callout">「${esc(state.query)}」在${esc(city)}的示意比例为 <strong>${esc(formatPct(activeShare))}</strong>。</p>`
      : "";
  const localEthnic = cityHasLocalEthnicity(pack, city);
  detail.innerHTML = `
    <header class="card-head">
      <p class="eyebrow">${esc(fullName(province))} · 示意/整理数据</p>
      <h2 tabindex="-1">${esc(city)}</h2>
      <p class="hint">${localEthnic ? "民族构成按当地公开格局单列，姓氏只在市内差异清楚时才偏离全省。" : "这一级没有单独拉开的民族差异，民族构成沿用全省示意。没有单独列出的姓氏，与全省示意比例相同。"}</p>
    </header>
    ${callout}
    <h3>常见姓氏</h3>
    <div class="metrics">${renderBars(surnames, "surname")}</div>
    <p class="fine">表内姓氏合计约占 ${esc(formatPct(tracked))}。地级数字是示意，不是官方微观数据。</p>
    <h3>民族构成</h3>
    <div class="stack" aria-hidden="true">${ethnic
      .map((row) => `<span style="width:${row.share.toFixed(2)}%;background:${ethnicColor(row.name)}" title="${esc(row.name)} ${esc(formatPct(row.share))}"></span>`)
      .join("")}</div>
    <div class="metrics">${renderBars(ethnic, "ethnic")}</div>
  `;
}

function cityUnitShareSafe(pack: CityFile, city: string, province: string): number {
  if (!state.query) return 0;
  const entry = entryOf(state.mode, state.query);
  const provinceShare = entry?.shares[province] ?? 0;
  return state.mode === "surname"
    ? (pack.surnameShares[state.query]?.[pack.cities.indexOf(city)] ?? provinceShare)
    : pack.ethnicity[city]
      ? (pack.ethnicity[city][state.query] ?? 0)
      : provinceShare;
}

function renderDetailSafe() {
  if (state.level === "province" && state.city && state.cityPack && state.province) {
    renderCityDetail(state.city, state.cityPack, state.province);
    return;
  }
  if (!state.province) {
    detail.innerHTML = `
      <header class="card-head">
        <p class="eyebrow">省份详情</p>
        <h2>点开一个省份</h2>
        <p class="hint">地图可选 31 个内地省级单位，以及香港、澳门、台湾。详情里会同时列出常见姓氏和民族构成，和当前搜索类型无关。</p>
      </header>
    `;
    return;
  }
  if (isUnavailable(state.province)) {
    detail.innerHTML = `
      <header class="card-head">
        <p class="eyebrow">暂无同口径数据</p>
        <h2 tabindex="-1">${esc(fullName(state.province))}</h2>
        <p class="hint">${esc(unavailableNote(state.province))}地图仍标出该地区。这里不提供姓氏或民族比例。</p>
      </header>
    `;
    return;
  }
  const name = state.province;
  const surnames = topSurnames(name);
  const ethnic = ethnicComposition(name);
  const title = fullName(name);
  const tracked = trackedSurnameTotal(name);
  const entry = state.query ? entryOf(state.mode, state.query) : undefined;
  const activeShare = entry ? (entry.shares[name] ?? 0) : null;
  const callout =
    entry && activeShare !== null
      ? `<p class="callout">「${esc(state.query)}」在${esc(title)}的示意比例为 <strong>${esc(formatPct(activeShare))}</strong>（全国参照 ${esc(formatPct(entry.nationalShare))}）。</p>`
      : "";
  detail.innerHTML = `
    <header class="card-head">
      <p class="eyebrow">省份详情 · 示意/整理数据</p>
      <h2 tabindex="-1">${esc(title)}</h2>
      <p class="hint">${esc(provinceBlurb(name))}</p>
    </header>
    ${state.level === "province" ? `<p class="fine">已进入地级地图。点击城市，查看该地的姓氏和民族示意。</p>` : ""}
    ${callout}
    <h3>常见姓氏</h3>
    <div class="metrics">${renderBars(surnames, "surname")}</div>
    <p class="fine">表内约一百个常见姓合计约占 ${esc(formatPct(tracked))}。其余为其他姓氏，或未纳入这套姓氏的命名。</p>
    <h3>民族构成</h3>
    <div class="stack" aria-hidden="true">${ethnic
      .map((row) => `<span style="width:${row.share.toFixed(2)}%;background:${ethnicColor(row.name)}" title="${esc(row.name)} ${esc(formatPct(row.share))}"></span>`)
      .join("")}</div>
    <div class="metrics">${renderBars(ethnic, "ethnic")}</div>
  `;
}

function renderBars(rows: { name: string; share: number }[], tone: "surname" | "ethnic"): string {
  const max = Math.max(...rows.map((row) => row.share), 0.01);
  return rows
    .map((row) => {
      const width = ((row.share / max) * 100).toFixed(2);
      const fillStyle =
        tone === "ethnic"
          ? `width:${width}%;background:${ethnicColor(row.name)}`
          : `width:${width}%`;
      const fillClass = tone === "surname" ? "surname-fill" : "ethnic-fill";
      return `<div class="metric">
        <span class="metric-name">${esc(row.name)}</span>
        <span class="track" aria-hidden="true"><span class="${fillClass}" style="${fillStyle}"></span></span>
        <span class="pct">${esc(formatPct(row.share))}</span>
      </div>`;
    })
    .join("");
}

function refresh() {
  renderChrome();
  renderLegend();
  renderRank();
  renderDetailSafe();
  const ranked = activeRanked();
  const shares = state.query ? new Map(ranked.map((item) => [item.short, item.share])) : null;
  atlas?.setView({
    level: state.level,
    adcode: state.level === "province" && state.province ? ADCODE[state.province] : null,
    selected: state.level === "province" ? state.city : state.province,
    query: state.query || null,
    shares,
    flat: isFlatSpread(ranked.map((item) => item.share)),
  });
  if (state.booted) {
    const queryText = state.query ? `已按${modeLabel(state.mode)}「${state.query}」高亮` : "已恢复默认地图";
    const place = state.city ?? (state.province ? fullName(state.province) : "");
    const selectedText = place ? `，当前为${place}` : "";
    live.textContent = queryText + selectedText;
  }
  state.booted = true;
}

async function openProvince(short: string) {
  const token = ++drillToken;
  if (isUnavailable(short)) {
    state.level = "nation";
    state.province = short;
    state.city = null;
    state.cityPack = null;
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
    refresh();
    focusDetail();
  } catch (error) {
    if (token !== drillToken) return;
    state.error = error instanceof Error ? error.message : "地级地图加载失败";
    renderChrome();
  }
}

function backToNation() {
  drillToken += 1;
  state.level = "nation";
  state.city = null;
  state.cityPack = null;
  refresh();
}

function focusDetail() {
  detail.querySelector<HTMLElement>("h2")?.focus();
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
  const items = currentSuggestions();
  if (event.key === "ArrowDown" && items.length) {
    event.preventDefault();
    state.suggestIndex = (state.suggestIndex + 1) % items.length;
    renderSuggestions();
  } else if (event.key === "ArrowUp" && items.length) {
    event.preventDefault();
    state.suggestIndex = (state.suggestIndex - 1 + items.length) % items.length;
    renderSuggestions();
  }
});

suggest.addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-name]");
  if (!button?.dataset.name) return;
  const resolved = resolveQuery(state.mode, button.dataset.name);
  if (!resolved) return;
  applyResolved(resolved.name, resolved.via ?? "");
});

clearButton.addEventListener("click", () => clearQuery());

for (const button of modeButtons) {
  button.addEventListener("click", () => {
    const mode = button.dataset.mode as Mode;
    if (mode === state.mode) return;
    state.mode = mode;
    state.error = "";
    if (state.query && !entryOf(mode, state.query)) {
      state.query = "";
      state.via = "";
      input.value = "";
    }
    closeSuggestions();
    refresh();
  });
}

form.addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-example]");
  if (!button?.dataset.example) return;
  const [mode, name] = button.dataset.example.split(":") as [Mode, string];
  state.mode = mode;
  state.error = "";
  applyResolved(name);
});

rank.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  const provinceButton = target.closest<HTMLButtonElement>("button[data-province]");
  if (provinceButton?.dataset.province) {
    const unit = provinceButton.dataset.province;
    if (state.level === "province") {
      state.city = unit;
      refresh();
    } else {
      void openProvince(unit);
    }
    if (window.innerWidth < 960) detail.scrollIntoView({ behavior: "smooth", block: "start" });
    focusDetail();
    return;
  }
  if (target.closest("#expand-rank")) {
    state.rankExpanded = !state.rankExpanded;
    renderRank();
  }
});

document.addEventListener("click", (event) => {
  if (!(event.target as HTMLElement).closest(".search-field")) closeSuggestions();
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (state.suggestOpen) {
    closeSuggestions();
    return;
  }
  if (state.query || input.value) clearQuery();
});

refresh();

backNation.addEventListener("click", () => backToNation());

mountMap(chartEl, (name) => {
  if (state.level === "province") {
    state.city = name;
    refresh();
    if (window.innerWidth < 960) detail.scrollIntoView({ behavior: "smooth", block: "start" });
    focusDetail();
    return;
  }
  void openProvince(name);
  if (window.innerWidth < 960) detail.scrollIntoView({ behavior: "smooth", block: "start" });
})
  .then((map) => {
    atlas = map;
    chartStatus.hidden = true;
    refresh();
  })
  .catch((error: unknown) => {
    chartStatus.hidden = false;
    chartStatus.textContent = error instanceof Error ? error.message : "底图加载失败";
  });

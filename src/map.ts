import { init, registerMap, use, type EChartsType } from "echarts/core";
import { MapChart } from "echarts/charts";
import { TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { MAINLAND, UNAVAILABLE, esc, formatPct, fullName, isUnavailable } from "./model";
import { DEFAULT_AREA, EMPTY_AREA, INK, PAPER, RAMP, SEA_LINE, SELECTED_BORDER, UI_FONT, rampColor } from "./palette";

use([MapChart, TooltipComponent, CanvasRenderer]);

interface GeoFeature {
  properties: { name?: string };
}

interface GeoCollection {
  features: GeoFeature[];
}

export interface MapView {
  level: "nation" | "province";
  adcode: string | null;
  selected: string | null;
  query: string | null;
  shares: Map<string, number> | null;
  flat: boolean;
}

export interface AtlasMap {
  ensureCity(adcode: string): Promise<void>;
  setView(view: MapView): void;
}

const FULL_TO_SHORT = new Map(
  [...MAINLAND, ...UNAVAILABLE].map((province) => [province.full, province.short]),
);

export async function mountMap(el: HTMLElement, onSelect: (name: string) => void): Promise<AtlasMap> {
  const response = await fetch(`${import.meta.env.BASE_URL}geo/china.json`);
  if (!response.ok) throw new Error(`底图加载失败（${response.status}）`);
  const nation = (await response.json()) as GeoCollection;
  const nationNames: string[] = [];
  for (const feature of nation.features) {
    const current = feature.properties.name ?? "";
    if (!current || current === "南海诸岛") {
      feature.properties.name = "南海诸岛";
      nationNames.push("南海诸岛");
      continue;
    }
    const short = FULL_TO_SHORT.get(current) ?? current;
    feature.properties.name = short;
    nationNames.push(short);
  }
  registerMap("china", nation as Parameters<typeof registerMap>[1]);

  const cityCache = new Map<string, string[]>();
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const chart: EChartsType = init(el, undefined, { renderer: "canvas" });
  let view: MapView = {
    level: "nation",
    adcode: null,
    selected: null,
    query: null,
    shares: null,
    flat: false,
  };
  let paintedMap = "";

  const paint = () => {
    const mapName = view.level === "province" && view.adcode ? `p-${view.adcode}` : "china";
    const regionNames = mapName === "china" ? nationNames : (cityCache.get(view.adcode ?? "") ?? []);
    const shares = view.shares;
    let max = 0;
    if (shares) {
      for (const value of shares.values()) max = Math.max(max, value);
    }
    const many = regionNames.length > 18;
    const showLabels = el.clientWidth >= (many ? 900 : 720);
    const data = regionNames.map((name) => {
      if (name === "南海诸岛") {
        return {
          name,
          value: 0,
          label: { show: false },
          itemStyle: { areaColor: SEA_LINE, borderColor: SEA_LINE, borderWidth: 1.1 },
          emphasis: { disabled: true, label: { show: false }, itemStyle: { areaColor: SEA_LINE } },
          tooltip: { show: false },
        };
      }
      const unavailable = view.level === "nation" && isUnavailable(name);
      const value = shares?.get(name);
      const colored = Boolean(view.query) && !unavailable && value !== undefined && max > 0;
      const ratio = colored && !view.flat ? (value ?? 0) / max : null;
      const areaColor = unavailable
        ? EMPTY_AREA
        : view.flat && view.query
          ? rampColor(0.38)
          : ratio === null
            ? DEFAULT_AREA
            : rampColor(ratio);
      const selected = view.selected === name;
      return {
        name,
        value: unavailable ? null : (value ?? 0),
        label: {
          show: showLabels,
          color: ratio !== null && ratio > 0.68 ? "#fffaf6" : "#243028",
          fontSize: many ? 10 : el.clientWidth >= 1100 ? 12 : 11,
          fontFamily: UI_FONT,
        },
        itemStyle: {
          areaColor,
          borderColor: selected ? SELECTED_BORDER : "#f7f4ee",
          borderWidth: selected ? 2.4 : 0.75,
        },
      };
    });

    const formatter = (params: { name?: string }) => {
      const name = String(params.name ?? "");
      if (!name || name === "南海诸岛") return "";
      const title = esc(view.level === "nation" ? fullName(name) : name);
      if (view.level === "nation" && isUnavailable(name)) return `${title}<br/>暂无整理数据`;
      if (!view.query || !view.shares) {
        return view.level === "nation" ? `${title}<br/>点击进入地级地图` : `${title}<br/>点击查看姓氏与民族构成`;
      }
      const value = view.shares.get(name) ?? 0;
      return `${title}<br/>${esc(view.query)}　${formatPct(value)}`;
    };

    const series = {
      type: "map" as const,
      map: mapName,
      roam: true,
      selectedMode: false as const,
      aspectScale: 0.86,
      layoutCenter: ["50%", "50%"],
      layoutSize: "100%",
      scaleLimit: { min: 1, max: 8 },
      labelLayout: { hideOverlap: true },
      itemStyle: { borderColor: "#f7f4ee", borderWidth: 0.75 },
      emphasis: {
        itemStyle: { areaColor: "#f3d48a", borderColor: "#8a5a1a", borderWidth: 1 },
        label: { color: INK, fontWeight: 700 },
      },
      data,
    };

    if (!paintedMap || paintedMap !== mapName) {
      chart.setOption(
        {
          animationDurationUpdate: reducedMotion ? 0 : 280,
          tooltip: {
            trigger: "item",
            confine: true,
            backgroundColor: PAPER,
            borderColor: "#e4d7c4",
            textStyle: { color: INK, fontFamily: UI_FONT, fontSize: 13 },
            formatter,
          },
          series: [series],
        },
        { replaceMerge: ["series"] },
      );
      paintedMap = mapName;
      return;
    }

    chart.setOption({
      tooltip: { formatter },
      series: [{ data, label: { show: showLabels } }],
    });
  };

  chart.on("click", (params) => {
    const name = String((params as { name?: string }).name ?? "");
    if (!name || name === "南海诸岛") return;
    onSelect(name);
  });

  const observer = new ResizeObserver(() => {
    chart.resize();
    if (el.clientWidth > 0) paint();
  });
  observer.observe(el);
  paint();

  return {
    async ensureCity(adcode: string) {
      if (cityCache.has(adcode)) return;
      const cityResponse = await fetch(`${import.meta.env.BASE_URL}geo/cities/${adcode}.json`);
      if (!cityResponse.ok) throw new Error("地级底图加载失败");
      const geo = (await cityResponse.json()) as GeoCollection;
      const names = geo.features.map((feature) => feature.properties?.name).filter((name): name is string => Boolean(name));
      registerMap(`p-${adcode}`, geo as Parameters<typeof registerMap>[1]);
      cityCache.set(adcode, names);
    },
    setView(next) {
      view = next;
      paint();
      const scope = view.level === "province" ? "地级地图" : "省级地图";
      const queryText = view.query ? `，当前高亮${view.query}` : "";
      const selectedText = view.selected ? `，已选${view.level === "nation" ? fullName(view.selected) : view.selected}` : "";
      el.setAttribute("aria-label", `中国${scope}${queryText}${selectedText}`);
    },
  };
}

export function legendGradient(): string {
  return `linear-gradient(90deg, ${RAMP.join(", ")})`;
}

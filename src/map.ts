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
  selected: string | null;
  query: string | null;
  shares: Map<string, number> | null;
}

export interface AtlasMap {
  setView(view: MapView): void;
}

const FULL_TO_SHORT = new Map(
  [...MAINLAND, ...UNAVAILABLE].map((province) => [province.full, province.short]),
);

export async function mountMap(el: HTMLElement, onSelect: (name: string) => void): Promise<AtlasMap> {
  const response = await fetch(`${import.meta.env.BASE_URL}geo/china.json`);
  if (!response.ok) throw new Error(`底图加载失败（${response.status}）`);
  const geo = (await response.json()) as GeoCollection;
  const regionNames: string[] = [];
  for (const feature of geo.features) {
    const current = feature.properties.name ?? "";
    if (!current || current === "南海诸岛") {
      feature.properties.name = "南海诸岛";
      regionNames.push("南海诸岛");
      continue;
    }
    const short = FULL_TO_SHORT.get(current) ?? current;
    feature.properties.name = short;
    regionNames.push(short);
  }
  registerMap("china", geo as Parameters<typeof registerMap>[1]);

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const chart: EChartsType = init(el, undefined, { renderer: "canvas" });
  let view: MapView = { selected: null, query: null, shares: null };
  let ready = false;

  const paint = () => {
    const shares = view.shares;
    let max = 0;
    if (shares) {
      for (const value of shares.values()) max = Math.max(max, value);
    }
    const showLabels = el.clientWidth >= 760;
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
      const unavailable = isUnavailable(name);
      const value = shares?.get(name);
      const colored = Boolean(view.query) && !unavailable && value !== undefined && max > 0;
      const ratio = colored ? (value ?? 0) / max : null;
      const areaColor = unavailable ? EMPTY_AREA : ratio === null ? DEFAULT_AREA : rampColor(ratio);
      const selected = view.selected === name;
      return {
        name,
        value: unavailable ? null : (value ?? 0),
        label: {
          show: showLabels,
          color: ratio !== null && ratio > 0.68 ? "#fffaf6" : "#243028",
          fontSize: el.clientWidth >= 1100 ? 12 : 11,
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
      const title = esc(fullName(name));
      if (isUnavailable(name)) return `${title}<br/>暂无整理数据`;
      if (!view.query || !view.shares) return `${title}<br/>点击查看姓氏与民族构成`;
      const value = view.shares.get(name) ?? 0;
      return `${title}<br/>${esc(view.query)}　${formatPct(value)}`;
    };

    const series = {
      type: "map" as const,
      map: "china",
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

    if (!ready) {
      chart.setOption({
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
      });
      ready = true;
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
    setView(next) {
      view = next;
      paint();
      const queryText = view.query ? `，当前高亮${view.query}` : "";
      const selectedText = view.selected ? `，已选${fullName(view.selected)}` : "";
      el.setAttribute("aria-label", `中国省级地图${queryText}${selectedText}。点击省份可查看详情。`);
    },
  };
}

export function legendGradient(): string {
  return `linear-gradient(90deg, ${RAMP.join(", ")})`;
}

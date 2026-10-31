export const RAMP = ["#f7f1df", "#f3d7a4", "#e59a52", "#c24e36", "#8c2c32"];
export const DEFAULT_AREA = "#d5e3da";
export const EMPTY_AREA = "#ddd6cc";
export const SEA_LINE = "#1d3e5c";
export const PAPER = "#fffaf3";
export const INK = "#1c1915";
export const SELECTED_BORDER = "#16324f";

export const UI_FONT =
  '"PingFang SC", "Hiragino Sans GB", "Noto Sans SC", "Microsoft YaHei", "Source Han Sans SC", sans-serif';

const ETHNIC_COLORS: Record<string, string> = {
  汉族: "#8ea0b0",
  壮族: "#d36b4f",
  回族: "#3e8f7a",
  满族: "#d2a24e",
  维吾尔族: "#6d8c3e",
  苗族: "#7b68b0",
  彝族: "#b5523a",
  土家族: "#c4844e",
  藏族: "#3c6e9c",
  蒙古族: "#c44755",
  侗族: "#4e8c9a",
  布依族: "#5b7d4a",
  瑶族: "#b07a3a",
  白族: "#c5c0dc",
  朝鲜族: "#3f6f8f",
  哈尼族: "#8c5a3c",
  黎族: "#c46b6b",
  哈萨克族: "#6a8f6a",
  傣族: "#4f9a86",
  畲族: "#a36b4a",
  其他民族: "#d9d3c7",
};

const FALLBACK_COLORS = ["#8d6e63", "#607d8b", "#78909c", "#a1887f", "#90a4ae", "#6d7f6a"];

export function ethnicColor(name: string): string {
  if (ETHNIC_COLORS[name]) return ETHNIC_COLORS[name];
  let hash = 0;
  for (const char of name) hash = (hash * 33 + char.charCodeAt(0)) >>> 0;
  return FALLBACK_COLORS[hash % FALLBACK_COLORS.length];
}

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
}

function rgbToHex(rgb: [number, number, number]): string {
  return `#${rgb.map((channel) => Math.round(channel).toString(16).padStart(2, "0")).join("")}`;
}

function mix(from: string, to: string, amount: number): string {
  const start = hexToRgb(from);
  const end = hexToRgb(to);
  return rgbToHex(start.map((channel, index) => channel + (end[index] - channel) * amount) as [number, number, number]);
}

export function rampColor(amount: number): string {
  const clamped = Math.min(1, Math.max(0, amount));
  const scaled = clamped * (RAMP.length - 1);
  const index = Math.min(RAMP.length - 2, Math.floor(scaled));
  return mix(RAMP[index], RAMP[index + 1], scaled - index);
}

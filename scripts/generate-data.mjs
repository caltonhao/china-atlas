import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { writeCityFiles } from "./city-layer.mjs";
import { EXTRA_SPEC, tokenizeYuan, YUAN_TEXT } from "./extra-surnames.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Illustrative province-level surname shares.
 * National magnitudes follow commonly cited public rankings of frequent surnames.
 * Provincial shape comes from well-known regional patterns, then iterative
 * proportional fitting so that:
 *   - population-weighted means match the national reference shares
 *   - each province's tracked surnames sum in proportion to how much of its
 *     population uses this surname system (lower in Tibet, Xinjiang, etc.)
 * Figures are 示意/整理数据, not official microdata.
 */

const MAINLAND = [
  ["北京", "北京市", 2189, 0.97],
  ["天津", "天津市", 1387, 0.98],
  ["河北", "河北省", 7461, 0.98],
  ["山西", "山西省", 3492, 0.99],
  ["内蒙古", "内蒙古自治区", 2405, 0.88],
  ["辽宁", "辽宁省", 4259, 0.97],
  ["吉林", "吉林省", 2407, 0.96],
  ["黑龙江", "黑龙江省", 3185, 0.97],
  ["上海", "上海市", 2487, 0.98],
  ["江苏", "江苏省", 8475, 0.995],
  ["浙江", "浙江省", 6457, 0.99],
  ["安徽", "安徽省", 6103, 0.99],
  ["福建", "福建省", 4154, 0.98],
  ["江西", "江西省", 4519, 0.995],
  ["山东", "山东省", 10153, 0.995],
  ["河南", "河南省", 9937, 0.99],
  ["湖北", "湖北省", 5775, 0.97],
  ["湖南", "湖南省", 6644, 0.95],
  ["广东", "广东省", 12601, 0.98],
  ["广西", "广西壮族自治区", 5013, 0.93],
  ["海南", "海南省", 1008, 0.88],
  ["重庆", "重庆市", 3205, 0.96],
  ["四川", "四川省", 8367, 0.95],
  ["贵州", "贵州省", 3856, 0.8],
  ["云南", "云南省", 4721, 0.76],
  ["西藏", "西藏自治区", 365, 0.15],
  ["陕西", "陕西省", 3953, 0.995],
  ["甘肃", "甘肃省", 2502, 0.91],
  ["青海", "青海省", 592, 0.7],
  ["宁夏", "宁夏回族自治区", 720, 0.92],
  ["新疆", "新疆维吾尔自治区", 2585, 0.52],
];

const UNAVAILABLE = [
  ["香港", "香港特别行政区"],
  ["澳门", "澳门特别行政区"],
  ["台湾", "台湾省"],
];

const UNAVAILABLE_NOTE = "暂无与内地省级口径对照的整理数据。";

const REGIONS = {
  north: ["北京", "天津", "河北", "山西", "内蒙古", "辽宁", "吉林", "黑龙江", "山东", "河南", "陕西"],
  northeast: ["辽宁", "吉林", "黑龙江"],
  jiangnan: ["上海", "江苏", "浙江", "安徽"],
  minyue: ["福建", "广东", "海南"],
  central: ["湖北", "湖南", "江西"],
  southwest: ["重庆", "四川", "贵州", "云南"],
  northwest: ["甘肃", "青海", "宁夏", "新疆"],
  lingnan: ["广东", "广西", "海南"],
};

const PROVINCES = MAINLAND.map(([short]) => short);

function weights(spec) {
  const map = Object.fromEntries(PROVINCES.map((name) => [name, 1]));
  for (const [region, value] of Object.entries(spec.regions ?? {})) {
    const list = REGIONS[region];
    if (!list) throw new Error(`未知区域 ${region}`);
    for (const name of list) map[name] = value;
  }
  for (const [name, value] of Object.entries(spec.provinces ?? {})) {
    if (!(name in map)) throw new Error(`未知省份 ${name}`);
    map[name] = value;
  }
  for (const name of PROVINCES) {
    if (!(map[name] > 0)) throw new Error(`${name} 的权重无效`);
  }
  return map;
}

function parseSpec(spec) {
  if (!spec) return weights({});
  const [provincePart, regionPart = ""] = spec.split("|");
  const provinces = {};
  const regions = {};
  for (const item of provincePart.split(",").filter(Boolean)) {
    const [name, value] = item.split(":");
    provinces[name] = Number(value);
  }
  for (const item of regionPart.split(",").filter(Boolean)) {
    const [name, value] = item.split(":");
    regions[name] = Number(value);
  }
  return weights({ provinces, regions });
}

const RAW_SURNAMES = [
  ["王", 7.25, "山东:1.9,河南:1.65,河北:1.6,山西:1.45,北京:1.35,天津:1.3,内蒙古:1.35,辽宁:1.5,吉林:1.45,黑龙江:1.45,陕西:1.3,甘肃:1.15|minyue:0.52,jiangnan:0.78,central:0.9"],
  ["李", 7.19, "河南:1.4,山东:1.35,河北:1.25,四川:1.35,重庆:1.25,辽宁:1.3,吉林:1.25,黑龙江:1.25,广东:1.2,广西:1.15,云南:1.15|northwest:0.9"],
  ["张", 6.83, "河北:1.55,河南:1.4,山东:1.35,山西:1.25,辽宁:1.4,吉林:1.35,黑龙江:1.35,陕西:1.25,四川:1.2,北京:1.2|minyue:0.72"],
  ["刘", 5.38, "河南:1.55,河北:1.4,山东:1.35,湖南:1.45,江西:1.3,湖北:1.2,四川:1.25,重庆:1.2,辽宁:1.3,吉林:1.25,黑龙江:1.25|minyue:0.7"],
  ["陈", 4.53, "广东:3.5,福建:3.3,海南:2.7,广西:1.8,浙江:1.45,江西:1.25,湖南:1.1|north:0.42,northwest:0.4,southwest:0.85"],
  ["杨", 3.08, "四川:2.15,重庆:1.9,云南:1.75,贵州:1.65,湖北:1.35,湖南:1.25,陕西:1.2|north:0.85,minyue:0.9"],
  ["黄", 2.23, "广东:3.1,广西:2.7,海南:2.4,福建:2.15,江西:1.9,湖南:1.75,湖北:1.2|north:0.36,northwest:0.34"],
  ["赵", 2.04, "河北:1.9,山东:1.7,河南:1.55,山西:1.5,北京:1.4,天津:1.35,陕西:1.3,辽宁:1.25|minyue:0.48,southwest:0.7,jiangnan:0.75"],
  ["吴", 2.01, "江苏:2.3,浙江:2.05,上海:2,安徽:1.45,福建:1.85,广东:1.6,江西:1.5,广西:1.2|north:0.55,northwest:0.5"],
  ["周", 1.9, "湖南:1.9,浙江:1.65,江苏:1.45,江西:1.55,湖北:1.5,四川:1.35,上海:1.3|north:0.7,northwest:0.6"],
  ["徐", 1.45, "江苏:2.15,浙江:1.65,上海:1.6,安徽:1.55,山东:1.35,江西:1.2|minyue:0.7,northwest:0.6"],
  ["孙", 1.42, "山东:2.35,河北:1.6,辽宁:1.75,吉林:1.65,黑龙江:1.65,河南:1.35,内蒙古:1.3|minyue:0.45,southwest:0.65"],
  ["马", 1.28, "宁夏:4.6,青海:3.8,甘肃:3.5,新疆:3.2,河南:1.55,陕西:1.4,河北:1.25,云南:1.2|minyue:0.55,jiangnan:0.6"],
  ["朱", 1.26, "江苏:1.9,安徽:1.65,浙江:1.55,江西:1.45,上海:1.4,湖北:1.2|north:0.75"],
  ["胡", 1.16, "湖北:2.3,湖南:1.9,江西:1.8,安徽:1.55,重庆:1.3|north:0.6,northwest:0.55,minyue:0.75"],
  ["郭", 1.15, "河南:1.85,山西:1.75,河北:1.55,山东:1.45,陕西:1.55,辽宁:1.2|minyue:0.55"],
  ["何", 1.08, "湖南:2.1,四川:1.8,广东:1.65,广西:1.6,重庆:1.55,贵州:1.4|north:0.6"],
  ["高", 1.02, "山东:2,河北:1.6,辽宁:1.7,吉林:1.55,黑龙江:1.55,河南:1.35,内蒙古:1.3|minyue:0.5,southwest:0.7"],
  ["林", 1.01, "福建:5.2,海南:4.4,广东:2.9,浙江:1.4,广西:1.25,江西:1.05|north:0.28,northwest:0.25,southwest:0.5,central:0.65"],
  ["罗", 0.86, "湖南:1.9,江西:1.8,四川:1.65,广东:1.55,广西:1.55,重庆:1.4,贵州:1.35|north:0.55"],
  ["郑", 0.84, "福建:2.9,广东:1.9,河南:1.65,浙江:1.55,海南:1.5|north:0.7"],
  ["梁", 0.78, "广东:2.8,广西:2.6,海南:1.7,福建:1.2|north:0.4,northwest:0.35,southwest:0.6"],
  ["谢", 0.72, "福建:2.3,广东:2.05,湖南:1.65,江西:1.55,海南:1.5|north:0.55"],
  ["宋", 0.7, "山东:1.9,河南:1.55,河北:1.5,山西:1.3,辽宁:1.25|minyue:0.5"],
  ["唐", 0.68, "湖南:2.3,四川:1.65,广西:1.55,重庆:1.45,贵州:1.3|north:0.6"],
  ["许", 0.65, "福建:2.3,广东:1.85,河南:1.65,海南:1.45,浙江:1.2|north:0.75"],
  ["韩", 0.64, "河南:1.85,山东:1.65,山西:1.55,陕西:1.45,辽宁:1.35,河北:1.35|minyue:0.5"],
  ["冯", 0.63, "广东:2.5,广西:2.1,海南:1.4,河南:1.35,河北:1.15|north:0.7"],
  ["邓", 0.61, "四川:2.1,湖南:1.9,江西:1.75,广东:1.65,广西:1.55,重庆:1.5|north:0.55"],
  ["曹", 0.59, "山东:1.8,河南:1.55,河北:1.45,安徽:1.35,山西:1.25|minyue:0.55"],
  ["彭", 0.57, "湖南:2.5,江西:1.9,四川:1.55,湖北:1.35,重庆:1.3|north:0.5"],
  ["曾", 0.55, "湖南:2.3,江西:2.1,广东:1.9,福建:1.65,四川:1.45,广西:1.4|north:0.42"],
  ["萧", 0.53, "湖南:2,江西:1.8,广东:1.65,福建:1.55,四川:1.45,广西:1.3|north:0.5"],
  ["田", 0.51, "河南:1.55,湖南:1.65,湖北:1.45,贵州:1.55,四川:1.35,重庆:1.3|minyue:0.6"],
  ["董", 0.49, "山东:1.9,河北:1.55,山西:1.45,辽宁:1.5,吉林:1.4,黑龙江:1.4|minyue:0.45"],
  ["袁", 0.47, "河南:1.65,湖南:1.65,江西:1.55,四川:1.45,湖北:1.3|minyue:0.65"],
  ["潘", 0.46, "广东:2.1,广西:1.9,浙江:1.65,江苏:1.45,安徽:1.35,海南:1.4|north:0.55"],
  ["于", 0.45, "山东:2.5,辽宁:2.15,吉林:1.95,黑龙江:1.95,河北:1.3,内蒙古:1.35|minyue:0.35,southwest:0.45,jiangnan:0.55"],
  ["蒋", 0.44, "江苏:1.9,浙江:1.65,湖南:1.55,四川:1.45,上海:1.4,广西:1.2|north:0.6"],
  ["蔡", 0.43, "福建:2.7,广东:1.9,浙江:1.45,河南:1.35,海南:1.55,江西:1.2|north:0.6"],
  ["余", 0.42, "江西:2.3,湖北:1.75,四川:1.55,广东:1.45,重庆:1.4|north:0.5"],
  ["杜", 0.41, "陕西:1.9,河南:1.55,河北:1.35,四川:1.35,山西:1.3|minyue:0.55"],
  ["叶", 0.4, "广东:2.5,福建:2.15,浙江:1.7,海南:1.45,江西:1.2|north:0.45"],
  ["程", 0.39, "安徽:2.3,河南:1.65,湖北:1.45,江西:1.25|minyue:0.55,northwest:0.6"],
  ["苏", 0.38, "广东:2.3,广西:2.1,福建:1.65,海南:1.4|north:0.45,southwest:0.6"],
  ["魏", 0.37, "河南:1.65,河北:1.45,陕西:1.55,山东:1.25,山西:1.25|minyue:0.5"],
  ["吕", 0.36, "山东:1.8,河南:1.45,山西:1.45,安徽:1.35,陕西:1.25|minyue:0.55"],
  ["丁", 0.35, "江苏:1.9,安徽:1.65,山东:1.45,河南:1.35,上海:1.4|minyue:0.6,southwest:0.65"],
  ["任", 0.34, "河南:1.65,山西:1.55,陕西:1.45,山东:1.35,河北:1.25|minyue:0.55"],
  ["沈", 0.33, "浙江:2.55,江苏:2.3,上海:2.35,安徽:1.25|north:0.45,southwest:0.5,northwest:0.4"],
  ["姚", 0.32, "浙江:1.9,江苏:1.55,安徽:1.45,河南:1.35,上海:1.4|northwest:0.6,minyue:0.75"],
  ["卢", 0.31, "广西:2.6,广东:1.9,福建:1.55,海南:1.4,河北:1.25|northwest:0.55"],
  ["姜", 0.3, "山东:2.35,辽宁:1.9,吉林:1.75,黑龙江:1.75,河北:1.2|minyue:0.4,southwest:0.5"],
  ["崔", 0.29, "山东:2.15,河北:1.6,辽宁:1.7,吉林:1.85,黑龙江:1.55,河南:1.2|minyue:0.45"],
  ["钟", 0.28, "广东:2.55,江西:2.1,广西:1.9,福建:1.55,海南:1.35|north:0.4"],
  ["谭", 0.27, "湖南:2.7,广东:1.85,广西:1.7,四川:1.45,海南:1.3|north:0.42"],
  ["陆", 0.26, "广西:3.1,江苏:1.9,浙江:1.55,广东:1.45,上海:1.4|north:0.45,northwest:0.4"],
  ["汪", 0.25, "安徽:2.5,江西:1.9,湖北:1.55,浙江:1.45,江苏:1.25|north:0.55"],
  ["范", 0.24, "河南:1.75,山东:1.45,河北:1.35,安徽:1.35,山西:1.2|minyue:0.55"],
  ["金", 0.23, "吉林:8,黑龙江:4.2,辽宁:3.2,浙江:1.7,上海:1.4,江苏:1.15,宁夏:1.5,甘肃:1.35|southwest:0.55,minyue:0.6"],
  ["石", 0.22, "河北:1.55,山东:1.45,贵州:1.7,湖南:1.35,河南:1.25|minyue:0.6"],
  ["廖", 0.21, "江西:2.3,湖南:1.9,广东:1.75,广西:1.65,福建:1.55,四川:1.45|north:0.45"],
  ["贾", 0.2, "山西:2.3,河北:1.65,河南:1.55,山东:1.35,陕西:1.3|minyue:0.4,southwest:0.55"],
  ["夏", 0.19, "江苏:1.8,浙江:1.55,湖北:1.45,河南:1.35,安徽:1.3|northwest:0.55"],
  ["韦", 0.19, "广西:8.5,广东:0.7,海南:0.5|north:0.15,jiangnan:0.25,northwest:0.2,southwest:0.35,central:0.3,minyue:0.4"],
  ["傅", 0.18, "湖南:1.9,湖北:1.6,江西:1.55,河南:1.4,山东:1.2|minyue:0.7"],
  ["方", 0.18, "安徽:2.1,河南:1.55,浙江:1.45,江苏:1.3|northwest:0.55,minyue:0.7"],
  ["白", 0.17, "陕西:1.9,河北:1.45,山西:1.4,辽宁:1.2,河南:1.25|minyue:0.5"],
  ["邹", 0.17, "江西:2.3,湖南:1.65,四川:1.45,湖北:1.3|north:0.55"],
  ["孟", 0.16, "山东:2.3,河南:1.55,河北:1.45,山西:1.25,辽宁:1.2|minyue:0.45"],
  ["熊", 0.16, "江西:2.3,湖北:1.9,湖南:1.6,四川:1.25|north:0.5"],
  ["秦", 0.15, "甘肃:2.15,陕西:1.8,江苏:1.55,河南:1.35,山西:1.2|minyue:0.55"],
  ["邱", 0.15, "福建:2.55,广东:1.9,江西:1.65,海南:1.45,浙江:1.2|north:0.45"],
  ["江", 0.15, "江西:2.1,福建:1.75,安徽:1.55,广东:1.45,四川:1.35,浙江:1.25|north:0.55"],
  ["尹", 0.14, "湖南:1.9,山东:1.55,河南:1.35,江西:1.3|northwest:0.6"],
  ["薛", 0.14, "山西:1.9,陕西:1.65,河南:1.45,江苏:1.35,山东:1.25|minyue:0.55"],
  ["闫", 0.14, "山西:2.35,河南:1.65,陕西:1.55,河北:1.45,山东:1.2|minyue:0.4,southwest:0.55"],
  ["段", 0.13, "云南:1.9,山西:1.65,陕西:1.45,河南:1.35,湖南:1.2|jiangnan:0.7"],
  ["雷", 0.13, "陕西:1.8,河南:1.45,湖南:1.45,四川:1.35,山西:1.25|jiangnan:0.7"],
  ["侯", 0.13, "河南:1.9,山西:1.65,河北:1.45,陕西:1.3,山东:1.25|minyue:0.45"],
  ["龙", 0.12, "湖南:2.3,贵州:2.1,四川:1.55,广西:1.6,重庆:1.45,湖北:1.35|north:0.45"],
  ["史", 0.12, "江苏:1.65,浙江:1.45,河南:1.35,河北:1.35,山东:1.25,上海:1.35|minyue:0.55"],
  ["陶", 0.12, "江苏:1.9,浙江:1.65,安徽:1.55,江西:1.45,上海:1.4|north:0.6"],
  ["黎", 0.11, "海南:12,广东:2.2,广西:1.8,湖南:1.1|north:0.3,northwest:0.25"],
  ["贺", 0.11, "湖南:1.9,陕西:1.65,山西:1.45,甘肃:1.2|minyue:0.5"],
  ["顾", 0.11, "江苏:2.7,上海:2.5,浙江:1.9|north:0.4,southwest:0.45,northwest:0.35,central:0.55,minyue:0.5"],
  ["毛", 0.11, "浙江:2.1,湖南:1.65,江西:1.45,江苏:1.2|north:0.55,northwest:0.5"],
  ["郝", 0.1, "山西:2.3,河北:1.65,河南:1.45,陕西:1.55,山东:1.2|minyue:0.4"],
  ["龚", 0.1, "湖南:1.9,湖北:1.65,江西:1.55,四川:1.45,上海:1.15|north:0.55"],
  ["邵", 0.1, "江苏:1.9,浙江:1.65,安徽:1.55,河南:1.35,上海:1.4|minyue:0.55,southwest:0.65"],
  ["万", 0.1, "江西:1.9,湖北:1.65,四川:1.45,重庆:1.4|north:0.55"],
  ["钱", 0.09, "江苏:2.55,浙江:2.35,上海:2.4,安徽:1.3|north:0.4,southwest:0.4,northwest:0.35,central:0.6,minyue:0.45"],
  ["严", 0.09, "浙江:1.9,江苏:1.55,四川:1.35,上海:1.4,安徽:1.25|north:0.6,northwest:0.55"],
  ["覃", 0.09, "广西:9,广东:0.85,海南:0.7|north:0.12,jiangnan:0.2,southwest:0.3,central:0.25,northwest:0.15,minyue:0.4"],
  ["武", 0.09, "山西:2.3,河南:1.65,河北:1.45,陕西:1.35,山东:1.2|minyue:0.4,southwest:0.55"],
  ["戴", 0.09, "江苏:1.8,安徽:1.65,湖南:1.45,江西:1.45,浙江:1.35|northwest:0.55"],
  ["莫", 0.08, "广西:2.8,广东:1.9,海南:1.3|north:0.4,southwest:0.55,northwest:0.35"],
  ["孔", 0.08, "山东:2.7,河南:1.55,河北:1.25,辽宁:1.15|minyue:0.45,southwest:0.55"],
  ["向", 0.08, "湖南:2.1,湖北:1.85,重庆:1.9,四川:1.55,贵州:1.45|north:0.45,minyue:0.5"],
  ["汤", 0.08, "湖南:1.8,江苏:1.45,安徽:1.45,福建:1.45,浙江:1.25|northwest:0.55"],
];

const ALIAS = {
  萧: ["肖"],
  傅: ["付"],
  闫: ["阎"],
  邱: ["丘"],
};

const ALIAS_SKIP = new Set(Object.values(ALIAS).flat());
const baseNames = new Set(RAW_SURNAMES.map(([name]) => name));
const extraNames = [];
for (const name of tokenizeYuan(YUAN_TEXT)) {
  if (baseNames.has(name) || ALIAS_SKIP.has(name) || extraNames.includes(name)) continue;
  extraNames.push(name);
}
if (extraNames.length < 250) throw new Error(`扩展姓氏过少：${extraNames.length}`);
const extraStart = 0.062;
const extraEnd = 0.01;
const extraRatio = extraNames.length === 1 ? 1 : (extraEnd / extraStart) ** (1 / (extraNames.length - 1));
let extraValue = extraStart;
const extraRaw = extraNames.map((name) => {
  const nationalShare = Number(extraValue.toFixed(4));
  extraValue *= extraRatio;
  return [name, nationalShare, EXTRA_SPEC[name] ?? ""];
});
const extraSum = extraRaw.reduce((sum, item) => sum + item[1], 0);
const extraScale = 8 / extraSum;
for (const item of extraRaw) item[1] = Number((item[1] * extraScale).toFixed(4));

const ALL_SURNAMES = [...RAW_SURNAMES, ...extraRaw];
if (ALL_SURNAMES.length < 380 || ALL_SURNAMES.length > 460) {
  throw new Error(`姓氏数量应在 380 到 460 之间，实际 ${ALL_SURNAMES.length}`);
}

const surnames = ALL_SURNAMES.map(([name, nationalShare, spec], index) => ({
  name,
  rank: index + 1,
  referenceShare: nationalShare,
  alias: ALIAS[name] ?? [],
  weights: parseSpec(spec),
}));

const population = Object.fromEntries(MAINLAND.map(([short, , pop]) => [short, pop]));
const coverage = Object.fromEntries(MAINLAND.map(([short, , , cov]) => [short, cov]));
const totalPop = PROVINCES.reduce((sum, name) => sum + population[name], 0);
const nationalSum = surnames.reduce((sum, item) => sum + item.referenceShare, 0);
const weightedCoverage =
  PROVINCES.reduce((sum, name) => sum + coverage[name] * population[name], 0) / totalPop;
const columnTarget = Object.fromEntries(
  PROVINCES.map((name) => [name, (coverage[name] / weightedCoverage) * nationalSum]),
);

const matrix = surnames.map((item) =>
  PROVINCES.map((name) => item.referenceShare * item.weights[name] * coverage[name]),
);

function scaleRows() {
  for (let s = 0; s < surnames.length; s += 1) {
    let weighted = 0;
    for (let p = 0; p < PROVINCES.length; p += 1) {
      weighted += matrix[s][p] * population[PROVINCES[p]];
    }
    const average = weighted / totalPop;
    const factor = surnames[s].referenceShare / average;
    if (!Number.isFinite(factor) || factor <= 0) {
      throw new Error(`${surnames[s].name} 行缩放失败`);
    }
    for (let p = 0; p < PROVINCES.length; p += 1) matrix[s][p] *= factor;
  }
}

function scaleColumns() {
  for (let p = 0; p < PROVINCES.length; p += 1) {
    let sum = 0;
    for (let s = 0; s < surnames.length; s += 1) sum += matrix[s][p];
    const factor = columnTarget[PROVINCES[p]] / sum;
    if (!Number.isFinite(factor) || factor <= 0) {
      throw new Error(`${PROVINCES[p]} 列缩放失败`);
    }
    for (let s = 0; s < surnames.length; s += 1) matrix[s][p] *= factor;
  }
}

for (let i = 0; i < 60; i += 1) {
  scaleRows();
  scaleColumns();
}

function roundShare(value) {
  if (!(value > 0)) return 0;
  return Number(value.toFixed(value < 1 ? 3 : 2));
}

const shares = surnames.map((item, s) => {
  const row = {};
  PROVINCES.forEach((name, p) => {
    row[name] = roundShare(matrix[s][p]);
  });
  return row;
});

for (let p = 0; p < PROVINCES.length; p += 1) {
  const name = PROVINCES[p];
  let sum = 0;
  let maxIndex = 0;
  for (let s = 0; s < surnames.length; s += 1) {
    sum += shares[s][name];
    if (shares[s][name] > shares[maxIndex][name]) maxIndex = s;
  }
  const drift = Number((columnTarget[name] - sum).toFixed(2));
  shares[maxIndex][name] = Number((shares[maxIndex][name] + drift).toFixed(2));
}

function weightedShare(row) {
  let sum = 0;
  for (const name of PROVINCES) sum += row[name] * population[name];
  return sum / totalPop;
}

const surnameRecords = surnames.map((item, index) => {
  const row = shares[index];
  const ranked = PROVINCES.map((name) => ({ name, share: row[name] })).sort((a, b) => b.share - a.share);
  const maxShare = ranked[0]?.share ?? 0;
  const medianShare = ranked[Math.floor(ranked.length / 2)]?.share ?? 0;
  const peaked = maxShare >= medianShare * 1.8 && maxShare >= medianShare + 0.01;
  return {
    name: item.name,
    rank: item.rank,
    nationalShare: Number(weightedShare(row).toFixed(item.referenceShare < 0.2 ? 3 : 2)),
    alias: item.alias,
    hint: peaked
      ? `示意上相对集中于${ranked.slice(0, 3).map((entry) => entry.name).join("、")}`
      : "省际差异不大，多数地方只有很低的示意比例",
    shares: row,
  };
});

function shareOf(surname, province) {
  const found = surnameRecords.find((item) => item.name === surname);
  if (!found) throw new Error(surname);
  return found.shares[province];
}

function topNames(province, count = 5) {
  return surnameRecords
    .map((item) => ({ name: item.name, share: item.shares[province] }))
    .sort((a, b) => b.share - a.share)
    .slice(0, count);
}

function columnSum(province) {
  return surnameRecords.reduce((sum, item) => sum + item.shares[province], 0);
}

const failures = [];
function expect(condition, message) {
  if (!condition) failures.push(message);
}

expect(shareOf("林", "福建") > shareOf("林", "山东") * 2, "林应明显集中于福建而非山东");
expect(shareOf("陈", "广东") > shareOf("陈", "北京") * 1.8, "陈应明显集中于广东");
expect(shareOf("韦", "广西") > shareOf("韦", "江苏") * 4, "韦应高度集中于广西");
expect(shareOf("覃", "广西") > shareOf("覃", "山东") * 4, "覃应高度集中于广西");
expect(shareOf("马", "宁夏") > shareOf("马", "浙江") * 2, "马应在宁夏更高");
expect(shareOf("金", "吉林") > shareOf("金", "河南"), "金应在吉林高于河南");
expect(shareOf("王", "山东") > shareOf("王", "广东"), "王应在山东高于广东");
expect(shareOf("沈", "江苏") > shareOf("沈", "河南"), "沈应在江苏更高");
expect(shareOf("钱", "浙江") > shareOf("钱", "山西"), "钱应在浙江更高");
expect(shareOf("黎", "海南") > shareOf("黎", "北京") * 2, "黎应在海南更高");
expect(shareOf("黎", "海南") > 1, "黎在海南应形成可见聚集");
expect(shareOf("金", "吉林") > shareOf("金", "浙江") * 1.4, "金应在吉林高于浙江");
expect(shareOf("杨", "四川") > shareOf("杨", "北京"), "杨应在四川高于北京");
expect(shareOf("欧阳", "江西") > shareOf("欧阳", "山东") * 1.8, "欧阳应集中于江西");
expect(shareOf("朴", "吉林") > shareOf("朴", "河南"), "朴应在吉林更高");
expect(shareOf("区", "广东") > shareOf("区", "山东") * 2, "区应集中于广东");
expect(surnames.length >= 380, "扩展后的姓氏不足");
expect(["王", "李", "张", "刘", "孙"].includes(topNames("山东")[0].name), `山东首位异常：${topNames("山东")[0].name}`);
expect(["陈", "林", "黄", "李"].includes(topNames("广东")[0].name), `广东首位异常：${topNames("广东")[0].name}`);
expect(["陈", "林", "黄"].includes(topNames("福建")[0].name), `福建首位异常：${topNames("福建")[0].name}`);
expect(["王", "李", "张", "刘"].includes(topNames("河南")[0].name), `河南首位异常：${topNames("河南")[0].name}`);
expect(columnSum("西藏") < columnSum("山东") * 0.45, "西藏常见汉姓合计应明显更低");
expect(columnSum("新疆") < columnSum("江苏"), "新疆常见汉姓合计应低于江苏");
expect(columnSum("宁夏") > 40, "宁夏仍应有可观的常见姓覆盖");

for (const name of PROVINCES) {
  const sum = columnSum(name);
  expect(sum > 8 && sum < 98, `${name} 姓氏合计 ${sum.toFixed(2)} 超出预期`);
  for (const item of surnameRecords) {
    expect(item.shares[name] >= 0, `${item.name} 在 ${name} 为负`);
  }
}

for (const item of surnameRecords) {
  const drift = Math.abs(item.nationalShare - surnames[item.rank - 1].referenceShare);
  expect(drift < 0.08, `${item.name} 全国份额漂移 ${drift.toFixed(3)}`);
}

if (failures.length) {
  console.error(failures.join("\n"));
  throw new Error(`姓氏校验未通过（${failures.length}）`);
}

const provinces = MAINLAND.map(([short, full]) => ({ short, full }));
const unavailable = UNAVAILABLE.map(([short, full]) => ({
  short,
  full,
  note: UNAVAILABLE_NOTE,
}));

const surnameFile = {
  meta: {
    label: "示意/整理数据",
    description:
      "约四百个常见姓的省级示意比例。前一百姓沿用公开常见姓排行的量级，其后姓氏按公开四百大姓的顺序延伸。只在格局清楚的姓上拉开省际差距，其余保持低而分散的份额。不是官方微观数据。",
    method:
      "以常见姓全国参照份额为行目标，以各省对这套姓氏体系的覆盖程度为列目标，经区域权重播种后做比例拟合。港澳台未纳入。",
    unit: "占该省级单位人口的百分比",
  },
  provinces,
  unavailable,
  surnames: surnameRecords,
};

const ETHNIC_HINTS = {
  汉族: "全国多数省级行政区的主体民族",
  壮族: "高度集中于广西，云南、广东等地也有分布",
  回族: "宁夏比例最高，甘肃、青海、新疆、河南等地亦成片分布",
  满族: "以辽宁为中心，兼及河北、吉林、黑龙江、北京",
  维吾尔族: "主要聚居于新疆",
  苗族: "贵州、湖南、云南、重庆、广西、湖北等地较为集中",
  彝族: "主要分布在云南、四川、贵州",
  土家族: "集中于湖南、湖北、重庆、贵州交界地带",
  藏族: "西藏为中心，青海、四川、甘肃、云南亦有重要分布",
  蒙古族: "内蒙古为主要聚居区，辽宁、新疆、青海、吉林等地也有分布",
  侗族: "主要分布在贵州、湖南、广西交界地带",
  布依族: "主要分布在贵州",
  瑶族: "广西、湖南、广东、云南等地较多",
  白族: "主要聚居于云南，湖南等地亦有分布",
  朝鲜族: "主要聚居于吉林，并见于黑龙江、辽宁",
  哈尼族: "主要分布在云南",
  黎族: "主要聚居于海南",
  哈萨克族: "主要分布在新疆",
  傣族: "主要分布在云南",
  畲族: "福建、浙江较为集中，江西、广东、安徽等地也有",
  傈僳族: "主要分布在云南",
  东乡族: "主要集中于甘肃",
  仡佬族: "主要分布在贵州",
  拉祜族: "主要分布在云南",
  佤族: "主要分布在云南",
  水族: "主要分布在贵州",
  纳西族: "主要分布在云南",
  羌族: "主要聚居于四川",
  土族: "主要分布在青海，甘肃也有",
  仫佬族: "主要分布在广西",
  锡伯族: "辽宁、新疆均有分布",
  柯尔克孜族: "主要分布在新疆",
  景颇族: "主要分布在云南",
  达斡尔族: "主要分布在内蒙古、黑龙江",
  撒拉族: "主要分布在青海",
  毛南族: "主要分布在广西",
  布朗族: "主要分布在云南",
  塔吉克族: "主要分布在新疆",
  京族: "主要分布在广西",
  高山族: "普查口径中人数很少，福建等地有少量分布",
  门巴族: "主要分布在西藏",
  珞巴族: "主要分布在西藏",
  鄂温克族: "主要分布在内蒙古",
  鄂伦春族: "内蒙古、黑龙江等地有少量分布",
  赫哲族: "主要分布在黑龙江",
  裕固族: "主要分布在甘肃",
  保安族: "主要分布在甘肃",
  乌孜别克族: "主要分布在新疆",
};

const ETHNIC = {
  北京: { 汉族: 95.7, 满族: 1.8, 回族: 1.8, 蒙古族: 0.3 },
  天津: { 汉族: 97, 回族: 1.7, 满族: 0.6, 蒙古族: 0.2 },
  河北: { 汉族: 95.8, 满族: 2.9, 回族: 0.8, 蒙古族: 0.3 },
  山西: { 汉族: 99.3, 回族: 0.5, 满族: 0.1, 蒙古族: 0.1 },
  内蒙古: { 汉族: 78.7, 蒙古族: 17.2, 满族: 2, 回族: 0.9, 达斡尔族: 0.3, 鄂温克族: 0.1, 鄂伦春族: 0.05 },
  辽宁: { 汉族: 84, 满族: 12.5, 蒙古族: 1.4, 回族: 0.6, 朝鲜族: 0.5, 锡伯族: 0.4 },
  吉林: { 汉族: 90.5, 朝鲜族: 4.3, 满族: 3.5, 蒙古族: 0.6, 回族: 0.5 },
  黑龙江: { 汉族: 94.8, 满族: 2.9, 朝鲜族: 0.9, 蒙古族: 0.4, 回族: 0.3, 达斡尔族: 0.2, 鄂伦春族: 0.05, 赫哲族: 0.02 },
  上海: { 汉族: 98.4, 回族: 0.5, 满族: 0.2, 朝鲜族: 0.1 },
  江苏: { 汉族: 99.5, 回族: 0.3, 满族: 0.1 },
  浙江: { 汉族: 98.8, 畲族: 0.4, 回族: 0.2, 苗族: 0.1 },
  安徽: { 汉族: 99.3, 回族: 0.5, 畲族: 0.1 },
  福建: { 汉族: 97.8, 畲族: 1, 回族: 0.3, 高山族: 0.1, 满族: 0.1 },
  江西: { 汉族: 99.6, 畲族: 0.2, 回族: 0.1 },
  山东: { 汉族: 99.2, 回族: 0.6, 满族: 0.1, 蒙古族: 0.1 },
  河南: { 汉族: 98.7, 回族: 1.1, 满族: 0.1, 蒙古族: 0.1 },
  湖北: { 汉族: 95.4, 土家族: 3.6, 苗族: 0.5, 侗族: 0.2, 回族: 0.2 },
  湖南: { 汉族: 89.7, 土家族: 4.2, 苗族: 3, 侗族: 1.3, 瑶族: 0.9, 白族: 0.3, 回族: 0.2 },
  广东: { 汉族: 97, 壮族: 0.8, 瑶族: 0.7, 畲族: 0.3, 苗族: 0.3, 回族: 0.2 },
  广西: { 汉族: 62.4, 壮族: 31.5, 瑶族: 3.4, 苗族: 1.1, 侗族: 0.8, 仫佬族: 0.4, 毛南族: 0.2, 回族: 0.1, 京族: 0.1 },
  海南: { 汉族: 82.5, 黎族: 15.4, 苗族: 0.8, 壮族: 0.6, 回族: 0.3 },
  重庆: { 汉族: 93.2, 土家族: 4.6, 苗族: 1.5, 回族: 0.2 },
  四川: { 汉族: 93.4, 彝族: 2.9, 藏族: 1.8, 羌族: 0.4, 回族: 0.3, 苗族: 0.2, 土家族: 0.2 },
  贵州: { 汉族: 62, 苗族: 12.2, 布依族: 8, 侗族: 5.5, 土家族: 4.1, 彝族: 2.5, 仡佬族: 1.5, 水族: 1.1, 白族: 0.5, 回族: 0.4 },
  云南: { 汉族: 66, 彝族: 11, 哈尼族: 3.6, 白族: 3.4, 傣族: 2.7, 壮族: 2.7, 苗族: 2.6, 回族: 1.6, 傈僳族: 1.5, 拉祜族: 1, 佤族: 0.8, 纳西族: 0.7, 瑶族: 0.5, 藏族: 0.4, 景颇族: 0.3, 布朗族: 0.2, 布依族: 0.2 },
  西藏: { 藏族: 86, 汉族: 12, 回族: 0.4, 门巴族: 0.3, 珞巴族: 0.1, 纳西族: 0.1 },
  陕西: { 汉族: 99.4, 回族: 0.4, 满族: 0.1, 蒙古族: 0.1 },
  甘肃: { 汉族: 90.6, 回族: 4.9, 藏族: 2, 东乡族: 2, 土族: 0.2, 满族: 0.1, 裕固族: 0.1, 保安族: 0.1 },
  青海: { 汉族: 49.8, 藏族: 25.2, 回族: 15.2, 土族: 3.6, 撒拉族: 1.9, 蒙古族: 1.8 },
  宁夏: { 汉族: 62.8, 回族: 35.8, 满族: 0.5, 蒙古族: 0.4 },
  新疆: { 维吾尔族: 44.5, 汉族: 42, 哈萨克族: 6.8, 回族: 4.5, 柯尔克孜族: 0.9, 蒙古族: 0.6, 塔吉克族: 0.2, 锡伯族: 0.2, 满族: 0.1, 乌孜别克族: 0.1 },
};

for (const name of PROVINCES) {
  if (!ETHNIC[name]) throw new Error(`缺少民族数据 ${name}`);
  let sum = 0;
  for (const [group, value] of Object.entries(ETHNIC[name])) {
    if (!(value >= 0)) throw new Error(`${name} ${group} 无效`);
    if (!ETHNIC_HINTS[group]) throw new Error(`缺少民族说明 ${group}`);
    sum += value;
  }
  if (sum < 97 || sum > 100.02) throw new Error(`${name} 民族合计 ${sum.toFixed(2)}`);
}

const groupNames = [...new Set(Object.values(ETHNIC).flatMap((row) => Object.keys(row)))];
const groups = groupNames.map((name) => {
  const row = {};
  for (const province of PROVINCES) row[province] = ETHNIC[province][name] ?? 0;
  let weighted = 0;
  for (const province of PROVINCES) weighted += row[province] * population[province];
  return {
    name,
    nationalShare: Number((weighted / totalPop).toFixed(2)),
    hint: ETHNIC_HINTS[name],
    shares: row,
  };
});
groups.sort((a, b) => b.nationalShare - a.nationalShare || a.name.localeCompare(b.name, "zh"));

const ethnicFailures = [];
function expectEthnic(condition, message) {
  if (!condition) ethnicFailures.push(message);
}
function ethnicShare(group, province) {
  return groups.find((item) => item.name === group).shares[province];
}
expectEthnic(ethnicShare("壮族", "广西") > 30, "壮族广西");
expectEthnic(ethnicShare("藏族", "西藏") > 80, "藏族西藏");
expectEthnic(ethnicShare("回族", "宁夏") > 30, "回族宁夏");
expectEthnic(ethnicShare("维吾尔族", "新疆") > 40, "维吾尔族新疆");
expectEthnic(ethnicShare("黎族", "海南") > 12, "黎族海南");
expectEthnic(ethnicShare("朝鲜族", "吉林") > ethnicShare("朝鲜族", "广东"), "朝鲜族吉林");
expectEthnic(ethnicShare("满族", "辽宁") > 8, "满族辽宁");
expectEthnic(ethnicShare("蒙古族", "内蒙古") > 15, "蒙古族内蒙古");
expectEthnic(ethnicShare("汉族", "山西") > 98, "汉族山西");
expectEthnic(ethnicShare("苗族", "贵州") > ethnicShare("苗族", "山东"), "苗族贵州");
if (ethnicFailures.length) {
  console.error(ethnicFailures.join("\n"));
  throw new Error("民族校验未通过");
}

const ethnicityFile = {
  meta: {
    label: "示意/整理数据",
    description:
      "主要民族在各省级单位的示意比例，按公开人口普查摘要中的区域格局整理并四舍五入，便于地图对照。未含港澳台。不是官方微观数据。",
    unit: "占该省级单位人口的百分比",
    nationalNote: "全国参照值按内地 31 个省级单位的人口权重汇总，未含港澳台。",
  },
  provinces,
  unavailable,
  groups,
};

writeFileSync(join(root, "data/surnames.json"), `${JSON.stringify(surnameFile, null, 2)}\n`);
writeFileSync(join(root, "data/ethnicities.json"), `${JSON.stringify(ethnicityFile, null, 2)}\n`);

const cityIndex = writeCityFiles(root, surnameRecords);
console.log(`姓氏 ${surnameRecords.length}，民族 ${groups.length}，省份 ${PROVINCES.length}，地级数据 ${Object.keys(cityIndex).length}`);
console.log(`常见姓全国参照合计 ${nationalSum.toFixed(2)}%，加权覆盖 ${weightedCoverage.toFixed(3)}`);
for (const name of PROVINCES) {
  const top = topNames(name, 4)
    .map((item) => `${item.name}${item.share.toFixed(2)}`)
    .join(" ");
  console.log(`${name.padEnd(4, "　")} 合计${columnSum(name).toFixed(1).padStart(5)}  ${top}`);
}

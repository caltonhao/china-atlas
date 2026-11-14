import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { catalog } from "./attractions/catalog.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const culture = JSON.parse(readFileSync(join(root, "data/culture.json"), "utf8"));

const NO_PRICE = "这里没有收录可核对的稳定票价。是否收费、要不要预约，以景区或主办方当日公告为准。";
const LEADING =
  /^(从|沿|在|到|看|有|是|把|将|对|向|往|去|来|上|下|进|出|回|过|经|靠|临|其|该|这|那|和|与|及|或|而|就|也|还|更|最|很|不|没|的|了|着|过|被|让|给|为|以|等|如|若|但|则|并|且|另|再|又|已|正|才|只|都|共|约|座|条|片|处|些|个|座|可|能|会|要|一个|一座|一条|一处|一片)+/;

const SUFFIXES = [
  "风景名胜区",
  "博物馆",
  "纪念馆",
  "植物园",
  "步行街",
  "大瀑布",
  "古镇",
  "古城",
  "石窟",
  "长城",
  "瀑布",
  "湿地",
  "故居",
  "山庄",
  "大峡谷",
  "峡谷",
  "雪山",
  "水洞",
  "溶洞",
  "苗寨",
  "古寨",
  "大桥",
  "园林",
  "寺庙",
  "道观",
  "天池",
  "牌坊",
  "动物园",
  "科技馆",
  "关",
  "湖",
  "山",
  "岛",
  "洞",
  "峡",
  "寨",
  "桥",
  "园",
  "庙",
  "寺",
  "楼",
  "阁",
  "府",
  "宫",
  "峰",
  "潭",
  "泉",
  "湾",
].sort((a, b) => b.length - a.length);

const FESTIVALS = ["厂甸庙会", "那达慕", "泼水节", "火把节", "博饼", "祭孔", "冰雪节", "龙舟", "妈祖绕境", "天灯", "社火", "花会", "庙会"];

const GENERIC = new Set([
  "古城",
  "古镇",
  "公园",
  "博物馆",
  "纪念馆",
  "故居",
  "长城",
  "寺庙",
  "山庄",
  "湿地",
  "沙漠",
  "草原",
  "瀑布",
  "石窟",
  "园林",
  "大桥",
  "小岛",
  "风景",
  "景区",
  "城市",
  "山上",
  "海边",
  "湖边",
  "江边",
  "河边",
  "水边",
  "城区",
  "市区",
  "老城",
  "新城",
  "大山",
  "小山",
  "高山",
  "名山",
  "石山",
  "土山",
  "关城",
  "宫殿",
  "楼阁",
  "古庙",
  "禅寺",
  "道观",
  "主峰",
  "海湾",
  "大坝",
  "水洞",
  "溶洞",
  "大佛",
  "古塔",
  "王府",
  "王陵",
  "陵园",
  "胡杨",
  "影城",
  "码头",
  "老街",
  "步行街",
  "这山",
  "那山",
  "一山",
  "全山",
  "进山",
  "上山",
  "下山",
  "看山",
  "有山",
  "湖水",
  "江水",
  "河水",
  "海水",
]);

const CLIMATE = {
  北京: "春秋最合适。夏天热，冬天风大，台阶会结冰。",
  天津: "春秋适合走路。夏天热，冬天风硬。",
  河北: "春秋清楚。夏天晒，山区冬天会结冰。",
  山西: "春秋最合适。冬天冷、风大，夏天中午晒。",
  内蒙古: "夏秋看草原或沙漠最合适。冬天极冷。",
  辽宁: "春秋舒服。冬天冷，沿海风大。",
  吉林: "夏秋适合上山。冬天是冰雪，也要防滑。",
  黑龙江: "夏天短。冬天极冷，冰雪是看点也要防寒。",
  上海: "春秋最舒服。夏天闷热，梅雨天地面滑。",
  江苏: "春秋最合适。夏天热，梅雨季石板滑。",
  浙江: "春秋最合适。梅雨和台风天要看开放公告。",
  安徽: "春秋适合爬山。夏天热，山区雨后路滑。",
  福建: "春秋舒服。夏天热而湿，台风天船和山路会停。",
  江西: "春秋最合适。夏天热，山区雨多。",
  山东: "春秋最合适。夏天晒，海边冬天风硬。",
  河南: "春秋最合适。夏天热，冬天可能有雾。",
  湖北: "春秋最合适。夏天热，山区天气变得快。",
  湖南: "春秋最合适。夏天热而湿，山区雨后滑。",
  广东: "冬天和春天更舒服。夏天热、雨多，台风天要看公告。",
  广西: "春秋舒服。夏天热，喀斯特石阶雨后滑。",
  海南: "十一月到次年四月更稳。夏天热，台风季船会停。",
  重庆: "春秋最合适。夏天极热，冬天湿冷，山城台阶多。",
  四川: "盆地夏天热，川西高原要防高反和降温。",
  贵州: "春秋最合适。雨多，石阶经常是湿的。",
  云南: "干湿季差别大。高原地区要防海拔和紫外线。",
  西藏: "海拔高，走路要慢。冬天白天短、夜里冷，夏天紫外线强。",
  陕西: "春秋最合适。夏天晒，山区冬天会结冰。",
  甘肃: "春秋最清楚。河西走廊风大、紫外线强，冬天更冷。",
  青海: "夏秋是主要季节。海拔高，冬天极冷。",
  宁夏: "春秋最合适。夏天晒，冬天风硬。",
  新疆: "北疆夏秋、南疆要注意高温或严寒。距离远，不要把几处排进同一天。",
  香港: "秋天到春天更清楚。夏天热而湿，台风天渡轮和缆车会停。",
  澳门: "冬天到春天舒服。夏天热，台风天少出门。",
  台湾: "春秋最合适。台风和大雨时山路、船会停。",
};

const spots = [];
const idSet = new Set();

function pushSpot(entry) {
  const id = `${entry.province}-${entry.name}`;
  if (idSet.has(id)) return;
  idSet.add(id);
  const cityOk = entry.city && culture.cities[entry.province]?.[entry.city];
  if (entry.city && !cityOk) {
    console.warn(`城市对不上，改为只挂省级：${entry.province}/${entry.city}/${entry.name}`);
  }
  const places = [{ province: entry.province, city: null }];
  if (cityOk) places.push({ province: entry.province, city: entry.city });
  spots.push({
    id,
    name: entry.name,
    aliases: entry.aliases ?? [],
    province: entry.province,
    city: cityOk ? entry.city : null,
    places,
    kind: entry.kind ?? "sight",
    grade: entry.grade ?? null,
    depth: "full",
    history: entry.history,
    tickets: entry.tickets,
    visit: entry.visit,
    season: entry.season || CLIMATE[entry.province] || "",
    caution: entry.caution || "",
  });
}

for (const entry of catalog) pushSpot(entry);

function cleanName(raw) {
  let name = raw.replace(LEADING, "");
  name = name.replace(/^(和|与|及|或)/, "");
  if (name.length < 2 || name.length > 10) return "";
  if (GENERIC.has(name)) return "";
  if (/^[一二三四五六七八九十]/.test(name)) return "";
  return name;
}

function sentencesOf(text) {
  return text.split(/(?<=。)/).map((item) => item.trim()).filter(Boolean);
}

function relatedText(text, name) {
  const picked = sentencesOf(text).filter((line) => line.includes(name) && !/这些地点在|要走到近处|沿水走一段|按路牌|天气好时能看清/.test(line));
  if (picked.length) return picked.join("");
  const fallback = sentencesOf(text).find((line) => line.includes(name));
  return fallback || "";
}

function cautionFor(name, province) {
  if (/西藏|青海/.test(province) || /雪山|冰川|天池/.test(name)) return "海拔或天气会和城里差一截。走慢，不要离开开放路线。";
  if (/洞|峡|瀑布/.test(name)) return "地面湿滑。跟着栈道走，不要靠近没有护栏的跌水。";
  if (/山|峰|长城|栈道/.test(name)) return "台阶和天气变化都要留余量。雨雪天防滑，不要翻越护栏。";
  if (/湖|海|江|河|岛|湾/.test(name)) return "水边不要越过护栏。船和栈道的末班时间先问清。";
  return "";
}

function extractNames(text) {
  const names = [];
  const seen = new Set();
  for (let index = 0; index < text.length; index += 1) {
    const suffix = SUFFIXES.find((item) => text.startsWith(item, index));
    if (!suffix) continue;
    const after = text[index + suffix.length] ?? "";
    if (/[\u4e00-\u9fa5]/.test(after) && !/^[沿在有能的是和与还就可会要看从把被到往上下里中旁边外内前后对向水面门口，。、；]/.test(after)) continue;
    const start = Math.max(0, index - 8);
    let raw = text.slice(start, index + suffix.length);
    const cut = Math.max(raw.lastIndexOf("。"), raw.lastIndexOf("，"), raw.lastIndexOf("、"), raw.lastIndexOf("；"), raw.lastIndexOf("："));
    if (cut >= 0) raw = raw.slice(cut + 1);
    raw = raw.split(/的|是|在|和|与|沿|从|有|能|还|不|就|把|被|这|那|看|要|着|或|再|到|走|进|连/).pop() ?? "";
    const name = cleanName(raw);
    if (!name.endsWith(suffix) || name.length < Math.max(3, suffix.length + 1) || name.length > 12) continue;
    if (/^(两段|清入|明清皇|明代园|高山|山坡|城市公园|入湿地|大瀑布|明长城|后三宫|红石山)/.test(name)) continue;
    if (/特|凝|爬|教|写|学|校|砾|咸|村寨|进峡|写字|教学|主题|校园|行政|部分|纪念|地宫|进山|海峡|皇家|大楼|高楼|堰塞|看|要|走|坐|进入|连着|顺着|再进|上山|下山/.test(name)) continue;
    if (seen.has(name)) continue;
    seen.add(name);
    names.push(name);
    if (names.length >= 4) break;
  }
  return names;
}

function addShort(province, city, name, kind, history) {
  const id = `${province}-${name}`;
  if (idSet.has(id)) return;
  const owned = spots.some(
    (spot) =>
      spot.province === province &&
      (spot.name === name || spot.aliases.includes(name) || name.includes(spot.name) || spot.name.includes(name)),
  );
  if (owned) return;
  idSet.add(id);
  spots.push({
    id,
    name,
    aliases: [],
    province,
    city: city ?? null,
    places: [{ province, city: city ?? null }],
    kind,
    grade: null,
    depth: "short",
    history,
    tickets:
      kind === "custom"
        ? "这是节令或社区活动，一般没有景区式大门票。摊位和饮食另算。当年办不办、要不要预约，看主办方公告。"
        : NO_PRICE,
    visit:
      kind === "custom"
        ? "时间对了才遇得上，平日去不一定看得到。跟着当地人的秩序看，不要挤进仪式队伍。"
        : `「${name}」可以按介绍里的看点单独留出时间，不要只在路口看一眼名字。入口、步行方向和开放范围以景区当日导览为准。`,
    season: CLIMATE[province] || "",
    caution: kind === "sight" ? cautionFor(name, province) : "节庆人多，看管好孩子和随身物品。",
  });
}

function addExtracted(province, city, text) {
  if (!text) return;
  for (const name of extractNames(text)) {
    const history = relatedText(text, name);
    if (history.length < 12) continue;
    addShort(province, city, name, "sight", `${history}更具体的沿革这里不展开，避免把传说写成定论。`);
  }
}

function addFestivals(province, city, text) {
  if (!text) return;
  for (const name of FESTIVALS) {
    if (!text.includes(name)) continue;
    const history = relatedText(text, name);
    if (history.length < 8) continue;
    addShort(province, city, name, "custom", `${history}这是当地节令，不是每天重演的节目。`);
  }
}

for (const [province, note] of Object.entries(culture.provinces)) {
  addExtracted(province, null, note.sights);
  addFestivals(province, null, note.customs);
}
for (const [province, cities] of Object.entries(culture.cities)) {
  for (const [city, note] of Object.entries(cities)) {
    addExtracted(province, city, note.sights);
    addFestivals(province, city, note.customs);
  }
}

const covered = new Set();
for (const spot of spots) {
  if (spot.kind !== "sight") continue;
  for (const place of spot.places) covered.add(`${place.province}/${place.city ?? ""}`);
}
function ensureSight(province, city, sights) {
  const key = `${province}/${city ?? ""}`;
  if (covered.has(key)) return;
  const label = city ? `${city}看点` : `${province}看点`;
  const id = `${province}-${label}`;
  if (idSet.has(id)) return;
  idSet.add(id);
  spots.push({
    id,
    name: label,
    aliases: [],
    province,
    city: city ?? null,
    places: [{ province, city: city ?? null }],
    kind: "sight",
    grade: null,
    depth: "short",
    history: sights,
    tickets: NO_PRICE,
    visit: "按介绍里的看点选一两处慢慢走。开放范围以当地当日公告为准。",
    season: CLIMATE[province] || "",
    caution: "",
  });
  covered.add(key);
}
for (const [province, note] of Object.entries(culture.provinces)) ensureSight(province, null, note.sights);
for (const [province, cities] of Object.entries(culture.cities)) {
  for (const [city, note] of Object.entries(cities)) ensureSight(province, city, note.sights);
}

const file = {
  meta: {
    label: "整理介绍",
    note: "景区和节令条目据公开常识编写，不是文化和旅游部门名录。国家A级只在有把握时标注，并可能调整。票价若出现数字，只是整理时的公开参考，不是当日官价。",
  },
  spots,
};

writeFileSync(join(root, "public/data/attractions.json"), JSON.stringify(file));
const full = spots.filter((spot) => spot.depth === "full");
const graded = full.filter((spot) => spot.grade);
console.log(
  `attractions ${spots.length}, full ${full.length}, graded ${graded.length}, 5A ${graded.filter((spot) => spot.grade === "5A").length}, 4A ${graded.filter((spot) => spot.grade === "4A").length}`,
);

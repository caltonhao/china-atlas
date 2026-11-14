import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { catalog } from "./attractions/catalog.mjs";
import { upgrades } from "./attractions/upgrades.mjs";

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
    themes: entry.themes === undefined ? null : entry.themes,
    seasons: entry.seasons === undefined ? null : entry.seasons,
    access: entry.access || "",
  });
}

for (const entry of catalog) pushSpot(entry);
for (const entry of upgrades) pushSpot(entry);

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
    if (/^(两段|清入|明清皇|明代园|高山|山坡|城市公园|入湿地|大瀑布|明长城|后三宫|红石山|中俄界湖|内陆湖)/.test(name)) continue;
    if (/特|凝|爬|教|写|学|校|砾|咸|村寨|进峡|写字|教学|主题|校园|行政|部分|纪念|地宫|进山|海峡|皇家|大楼|高楼|堰塞|看|要|走|坐|进入|连着|顺着|再进|上山|下山/.test(name)) continue;
    if (seen.has(name)) continue;
    seen.add(name);
    names.push(name);
    if (names.length >= 4) break;
  }
  return names;
}

function addShort(province, city, name, kind, sentence) {
  const id = `${province}-${name}`;
  if (idSet.has(id)) return;
  const owned = spots.some((spot) => {
    if (spot.province !== province) return false;
    const names = [spot.name, ...(spot.aliases || [])];
    return names.some((known) => known === name || name.includes(known) || known.includes(name));
  });
  if (owned) return;
  idSet.add(id);
  const place = city || province;
  const localNote = name.endsWith("看点") ? sentence : `${sentence}这是${place}可以单独去看的一处，不是把全省名字合成一个景区。`;
  let visit = `把「${name}」单独留出时间，按门口导览走完开放路线，不要只在路口看一眼名字。末班和开放范围以当日公告为准。`;
  if (/山|峰|峡|岭|崖|长城/.test(name)) {
    visit = `「${name}」按开放的山路、城墙或栈道走。索道若有，是另外计费的。第一次到主要观景点即可，不要临时加未开放的小路。留出半天更从容。`;
  } else if (/寺|庙|宫|塔|庵|观/.test(name)) {
    visit = `「${name}」按开放的殿宇顺序看。香火、功德和门票不是一回事。留一到两小时，殿内保持安静。`;
  } else if (/博物馆|纪念馆/.test(name)) {
    visit = `「${name}」以室内展陈为主，跟着展线看。很多馆周一或固定日闭馆，出发前先查公告。`;
  } else if (/湖|江|海|岛|湾|瀑|泉/.test(name)) {
    visit = `「${name}」看水和岸。游船、轮渡若有，通常和大门票分开。先留下返程时间。`;
  } else if (/古城|古镇|街|园/.test(name)) {
    visit = `「${name}」多半是街区、园子或镇子。主路和侧巷不一样，留两小时，早晚比中午安静。`;
  }
  if (name.endsWith("看点")) {
    visit = "介绍里提到的几处不要塞进同一个小时。每处按门口导览走，开放范围以当日公告为准。";
  }
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
    history: localNote,
    tickets:
      kind === "custom"
        ? "这是节令或社区活动，一般没有景区式大门票。摊位和饮食另算。当年办不办、要不要预约，看主办方公告。"
        : NO_PRICE,
    visit:
      kind === "custom"
        ? "时间对了才遇得上，平日去不一定看得到。跟着当地人的秩序看，不要挤进仪式队伍。"
        : visit,
    season: CLIMATE[province] || "",
    caution: kind === "sight" ? cautionFor(name, province) : "节庆人多，看管好孩子和随身物品。",
  });
}

function addExtracted(province, city, text) {
  if (!text) return;
  for (const name of extractNames(text)) {
    const history = relatedText(text, name);
    if (history.length < 12) continue;
    addShort(province, city, name, "sight", history);
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

const PRODUCTS = [
  "烤鸭", "豆汁", "京剧", "狗不理", "麻花", "炸糕", "驴肉火烧", "老陈醋", "汾酒", "刀削面", "奶茶", "奶豆腐", "烤全羊",
  "锅包肉", "酸菜", "冷面", "人参", "红肠", "小笼包", "生煎", "盐水鸭", "大闸蟹", "苏绣", "云锦", "龙井", "黄酒", "臭鳜鱼",
  "宣纸", "徽墨", "佛跳墙", "沙茶面", "乌龙茶", "寿山石", "瓷器", "瓦罐汤", "煎饼", "阿胶", "热干面", "臭豆腐", "剁椒",
  "肠粉", "早茶", "螺蛳粉", "桂林米粉", "过桥米线", "酥油茶", "青稞", "羊肉泡馍", "肉夹馍", "凉皮", "牛肉面", "酿皮",
  "手抓羊肉", "馕", "葡萄干", "火锅", "豆花", "腊肉", "米粉", "椰子", "菠萝", "饵块", "枸杞", "青稞酒", "马头琴", "剪纸",
  "漆器", "蜀绣", "蜡染", "扎染", "batik",
];

function addSpecialties(province, city, text) {
  if (!text) return;
  let added = 0;
  for (const name of PRODUCTS) {
    if (!text.includes(name) || added >= 3) continue;
    const sentence = relatedText(text, name) || text;
    const id = `${province}-${name}`;
    if (idSet.has(id)) continue;
    idSet.add(id);
    added += 1;
    spots.push({
      id,
      name,
      aliases: [],
      province,
      city: city ?? null,
      places: [{ province, city: city ?? null }],
      kind: "specialty",
      grade: null,
      depth: "short",
      history: `${sentence}这是当地能遇到的吃食或手艺，用来说明味道和做法，不是官方名录。`,
      tickets: "这不是景区门票。馆子、作坊和商店各自标价，这里不写死价格。",
      visit: `想尝或想看「${name}」，就到本地馆子、早市或作坊，问清是不是当季、是不是现场做的。旅游专柜上的礼盒和日常吃的不一定是同一种。`,
      season: /春|夏|秋|冬|时令|上市/.test(sentence) ? sentence : CLIMATE[province] || "",
      caution: "招牌和实物要对上。贵重工艺品看清是不是现场制作。",
    });
  }
}
for (const [province, note] of Object.entries(culture.provinces)) addSpecialties(province, null, note.specialties);
for (const [province, cities] of Object.entries(culture.cities)) {
  for (const [city, note] of Object.entries(cities)) addSpecialties(province, city, note.specialties);
}

const HUBS = {
  北京: "高铁多在北京南、北京西、北京站，飞机在首都机场或大兴机场。市内再换乘地铁或公交。",
  天津: "高铁常用天津站、天津西站，飞机在滨海机场。市内地铁能接到主要市区。",
  河北: "进省多从石家庄站或各地级市高铁站，再转汽车进山。",
  山西: "高铁多到太原南或各地市车站，再转汽车上山。",
  内蒙古: "省会方向常用呼和浩特站和白塔机场，草原和沙漠景点还要再转长途车。",
  辽宁: "沈阳、大连有高铁和机场，再转市内交通或汽车。",
  吉林: "长春、吉林市有高铁，长白山方向还要从延边或白山转景区车。",
  黑龙江: "哈尔滨站和太平机场是常见入口，再转高铁或汽车。",
  上海: "高铁在虹桥站或上海站，飞机在浦东或虹桥机场，市内地铁密集。",
  江苏: "南京南、苏州、无锡等站都有高铁，再转地铁或公交。",
  浙江: "杭州东是常用高铁站，萧山机场在杭州，再转高铁或汽车到各市。",
  安徽: "合肥站、黄山北等是常见高铁口，黄山还要再转景区交通。",
  福建: "福州、厦门有高铁和机场，武夷山、土楼还要再转汽车。",
  江西: "南昌西和各地市高铁站是入口，庐山、三清山要再上山。",
  山东: "济南西、青岛等站有高铁，泰山从泰安站更近。",
  河南: "郑州东是主要高铁枢纽，再转高铁或汽车到洛阳、开封等地。",
  湖北: "武汉有高铁和天河机场，武当山、神农架、恩施还要再转。",
  湖南: "长沙南是常用高铁站，张家界、凤凰还要再转火车或汽车。",
  广东: "广州南、深圳北高铁很密，白云、宝安等机场后再转地铁或城际。",
  广西: "南宁东、桂林有高铁和机场，漓江游船从桂林或阳朔码头走。",
  海南: "飞机到海口美兰或三亚凤凰较常见，环岛有高铁，再转汽车。",
  重庆: "重庆北、重庆西有高铁，江北机场进城后，山区景区还要再转汽车。",
  四川: "成都东和双流、天府机场是常见入口，九寨沟、峨眉山要再转。",
  贵州: "贵阳北和龙洞堡机场是入口，黄果树、西江还要再转汽车。",
  云南: "昆明南和长水机场是入口，丽江、大理、香格里拉多再乘飞机或高铁。",
  西藏: "多数人先飞拉萨贡嘎机场，或乘青藏铁路到拉萨站。进藏注意海拔。",
  陕西: "西安北有高铁，咸阳机场进城后，华山从华山北站更近。",
  甘肃: "兰州西是主要高铁站，敦煌、嘉峪关多再乘火车或飞机。",
  青海: "西宁站和曹家堡机场是入口，青海湖还要再沿环湖公路走。",
  宁夏: "银川站和河东机场是入口，沙坡头在中卫，沙湖在石嘴山方向。",
  新疆: "乌鲁木齐站和地窝堡机场是常见入口，北疆南疆景点距离远，往往还要再飞或坐火车。",
  香港: "高铁可到香港西九龙站，飞机在香港国际机场，市内靠地铁和渡轮。",
  澳门: "常见是从横琴或珠海口岸入境，澳门国际机场也可飞。市内距离短。",
  台湾: "高铁沿西部城市停靠，桃园机场在台北附近。东部和山区要再转火车或汽车。",
};

function inferThemes(spot) {
  if (spot.name.endsWith("看点")) return [];
  const themes = [];
  if (spot.kind === "custom") themes.push("festival");
  if (spot.kind === "sight" && /山|峰|岳|峡|岭|崖|长城|雪山/.test(spot.name)) themes.push("mountain");
  if (spot.kind === "sight" && /湖|江|海|岛|瀑|湾|泉|潭|溪/.test(spot.name)) themes.push("water");
  if (spot.kind === "sight" && /古城|古镇|周庄|乌镇|同里/.test(spot.name)) themes.push("town");
  if (spot.kind === "sight" && /博物馆|纪念馆/.test(spot.name)) themes.push("museum");
  if (
    spot.kind === "sight" &&
    !/博物馆|纪念馆/.test(spot.name) &&
    /寺|庙|塔|陵|古城|古镇|石窟|长城|府|阁|园林|牌坊|故居|宫|楼|园/.test(spot.name)
  ) {
    themes.push("heritage");
  }
  return themes;
}

function inferSeasons(text) {
  const seasons = new Set();
  if (/全年/.test(text)) ["spring", "summer", "autumn", "winter"].forEach((item) => seasons.add(item));
  if (/春|三月|四月|清明|花/.test(text)) seasons.add("spring");
  if (/夏|六月|七月|八月|避暑/.test(text)) seasons.add("summer");
  if (/秋|九月|十月|彩林|候鸟/.test(text)) seasons.add("autumn");
  if (/冬|冰雪|雾凇|结冰|腊月/.test(text)) seasons.add("winter");
  return [...seasons];
}

function accessFor(spot) {
  if (spot.kind === "specialty") return "在当地馆子、早市或作坊就能遇到，不必当成景区大门来找。价格各家不同。";
  if (spot.province === "海南" && (spot.name.includes("三沙") || spot.name.includes("永兴"))) {
    return "三沙没有可以自由购票的高铁或民航机场。岛上往来靠规定航线和补给船，不是景区班车。这里不编造船期。";
  }
  if (/图木舒克|阿拉尔|铁门关|可克达拉|昆玉|胡杨河|双河|北屯|五家渠|石河子/.test(spot.city || spot.name)) {
    return "这些兵团城镇多从乌鲁木齐或邻近地州中转，班次不固定。这里不编造时刻和票价。";
  }
  const hub = HUBS[spot.province];
  if (!hub) return "";
  const local = spot.city ? `先到${spot.city}。` : `先到${spot.province}。`;
  return `${local}${hub}景区里的区间车、索道或游船以当日公告为准，这里不列班次和票价。`;
}

const LINKS = {
  "北京-故宫": [
    { label: "官方网站", href: "https://www.dpm.org.cn/" },
    { label: "预约入口", href: "https://ticket.dpm.org.cn/" },
  ],
  "陕西-秦始皇兵马俑": [{ label: "官方网站", href: "https://www.bmy.com.cn/" }],
  "甘肃-莫高窟": [{ label: "官方网站", href: "https://www.dha.ac.cn/" }],
  "四川-九寨沟": [{ label: "官方网站", href: "https://www.jiuzhai.com/" }],
  "安徽-黄山": [{ label: "景区网站", href: "https://www.huangshan.com.cn/" }],
  "四川-青城山": [{ label: "都江堰景区网站", href: "https://www.djy517.com/" }],
  "上海-上海博物馆": [{ label: "官方网站", href: "https://www.shanghaimuseum.net/" }],
  "北京-中国国家博物馆": [{ label: "官方网站", href: "https://www.chnmuseum.cn/" }],
  "江苏-苏州博物馆": [{ label: "官方网站", href: "https://www.szmuseum.com/" }],
  "北京-首都博物馆": [{ label: "官方网站", href: "https://www.capitalmuseum.org.cn/" }],
  "四川-三星堆博物馆": [{ label: "官方网站", href: "https://www.sxd.cn/" }],
  "四川-四川博物院": [{ label: "官方网站", href: "https://www.scmuseum.cn/" }],
  "云南-云南省博物馆": [{ label: "官方网站", href: "https://www.ynmuseum.org/" }],
  "陕西-陕西历史博物馆": [{ label: "官方网站", href: "https://www.sxhm.com/" }],
  "河南-龙门石窟": [{ label: "官方网站", href: "http://www.lmsk.cn/" }],
  "辽宁-沈阳故宫": [{ label: "官方网站", href: "https://www.sypm.org.cn/" }],
  "浙江-灵隐寺": [{ label: "官方网站", href: "https://www.lingyinsi.org/" }],
  "福建-武夷山": [{ label: "景区网站", href: "https://www.wyschina.com/" }],
  "山东-崂山": [{ label: "景区网站", href: "https://www.qdlaoshan.cn/" }],
  "陕西-华清宫": [{ label: "官方网站", href: "https://www.hqc.cn/" }],
  "宁夏-沙坡头": [{ label: "景区网站", href: "http://www.shapotou.com/" }],
  "山东-刘公岛": [{ label: "官方网站", href: "http://www.liugongdao.com.cn/" }],
  "浙江-天一阁": [{ label: "官方网站", href: "http://www.tianyige.com.cn/" }],
  "上海-东方明珠": [{ label: "官方网站", href: "http://www.opg.cn/" }],
  "黑龙江-虎头旅游景区": [{ label: "政府名录", href: "https://www.jixi.gov.cn/jixi/c101258/common_list.shtml" }],
  "黑龙江-当壁镇兴凯湖旅游度假区": [{ label: "政府名录", href: "https://www.jixi.gov.cn/jixi/c101258/common_list.shtml" }],
  "黑龙江-兴凯湖新开流景区": [{ label: "政府名录", href: "https://www.jixi.gov.cn/jixi/c101258/common_list.shtml" }],
  "香港-维多利亚港": [{ label: "官方旅游资讯", href: "https://www.discoverhongkong.com/" }],
  "香港-太平山": [{ label: "官方旅游资讯", href: "https://www.discoverhongkong.com/" }],
  "澳门-大三巴": [{ label: "官方旅游资讯", href: "https://www.macaotourism.gov.mo/" }],
  "澳门-妈阁庙": [{ label: "官方旅游资讯", href: "https://www.macaotourism.gov.mo/" }],
  "台湾-日月潭": [{ label: "官方观光资讯", href: "https://www.taiwan.net.tw/" }],
  "台湾-阿里山": [{ label: "官方观光资讯", href: "https://www.taiwan.net.tw/" }],
  "台湾-台北101": [{ label: "官方观光资讯", href: "https://www.taiwan.net.tw/" }],
};

const IMAGES = {
  "北京-故宫": {
    src: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2c/Beijing_China_Forbidden-City-07.jpg/960px-Beijing_China_Forbidden-City-07.jpg",
    page: "https://commons.wikimedia.org/wiki/File:Beijing_China_Forbidden-City-07.jpg",
    author: "CEphoto, Uwe Aranas",
    license: "CC BY-SA 3.0",
  },
  "北京-八达岭长城": {
    src: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/50/Badaling_China_Great-Wall-of-China-01.jpg/960px-Badaling_China_Great-Wall-of-China-01.jpg",
    page: "https://commons.wikimedia.org/wiki/File:Badaling_China_Great-Wall-of-China-01.jpg",
    author: "CEphoto, Uwe Aranas",
    license: "CC BY-SA 3.0",
  },
  "浙江-西湖": {
    src: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/20090524_Hangzhou_West_Lake_7531.jpg/960px-20090524_Hangzhou_West_Lake_7531.jpg",
    page: "https://commons.wikimedia.org/wiki/File:20090524_Hangzhou_West_Lake_7531.jpg",
    author: "Jakub Hałun",
    license: "CC BY-SA 3.0",
  },
  "安徽-黄山": {
    src: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d6/Huangshan%2C_September_2018_26.jpg/960px-Huangshan%2C_September_2018_26.jpg",
    page: "https://commons.wikimedia.org/wiki/File:Huangshan,_September_2018_26.jpg",
    author: "De-Shao Liu",
    license: "CC BY-SA 4.0",
  },
  "陕西-秦始皇兵马俑": {
    src: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/56/Qin_Terracotta_Army%2C_Pit_1_01.jpg/960px-Qin_Terracotta_Army%2C_Pit_1_01.jpg",
    page: "https://commons.wikimedia.org/wiki/File:Qin_Terracotta_Army,_Pit_1_01.jpg",
    author: "Gary Lee Todd",
    license: "CC0",
  },
  "广西-漓江": {
    src: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/1_li_jiang_guilin_yangshuo_2011.jpg/960px-1_li_jiang_guilin_yangshuo_2011.jpg",
    page: "https://commons.wikimedia.org/wiki/File:1_li_jiang_guilin_yangshuo_2011.jpg",
    author: "chensiyuan",
    license: "CC BY-SA 4.0",
  },
  "四川-九寨沟": {
    src: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Jiuzhaigou_Sichuan_China_Panda-Lake-01.jpg/960px-Jiuzhaigou_Sichuan_China_Panda-Lake-01.jpg",
    page: "https://commons.wikimedia.org/wiki/File:Jiuzhaigou_Sichuan_China_Panda-Lake-01.jpg",
    author: "CEphoto, Uwe Aranas",
    license: "CC BY-SA 3.0",
  },
  "四川-峨眉山": {
    src: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/China_-_Mount_Emei_-_EmeiShan_-_Sichuan_01.jpg/960px-China_-_Mount_Emei_-_EmeiShan_-_Sichuan_01.jpg",
    page: "https://commons.wikimedia.org/wiki/File:China_-_Mount_Emei_-_EmeiShan_-_Sichuan_01.jpg",
    author: "Vanvelthem Cédric",
    license: "CC BY-SA 4.0",
  },
  "云南-丽江古城": {
    src: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/74/1_lijiang_old_town_night.jpg/960px-1_lijiang_old_town_night.jpg",
    page: "https://commons.wikimedia.org/wiki/File:1_lijiang_old_town_night.jpg",
    author: "chensiyuan",
    license: "CC BY-SA 4.0",
  },
  "福建-鼓浪屿": {
    src: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/Gulangyu_Island_from_Zhongshan_Road%2C_Xiamen.jpg/960px-Gulangyu_Island_from_Zhongshan_Road%2C_Xiamen.jpg",
    page: "https://commons.wikimedia.org/wiki/File:Gulangyu_Island_from_Zhongshan_Road,_Xiamen.jpg",
    author: "Slyronit",
    license: "CC BY-SA 4.0",
  },
  "湖南-武陵源": {
    src: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/af/Pilier_rocheux_couronn%C3%A9_de_pins%2C_monts_Tianzi_%282026%29.jpg/960px-Pilier_rocheux_couronn%C3%A9_de_pins%2C_monts_Tianzi_%282026%29.jpg",
    page: "https://commons.wikimedia.org/wiki/File:Pilier_rocheux_couronn%C3%A9_de_pins,_monts_Tianzi_(2026).jpg",
    author: "ICOLEF",
    license: "CC BY-SA 4.0",
  },
  "江苏-拙政园": {
    src: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f5/Humble_Administrator%27s_Garden_Suzhou_November_2017_005.jpg/960px-Humble_Administrator%27s_Garden_Suzhou_November_2017_005.jpg",
    page: "https://commons.wikimedia.org/wiki/File:Humble_Administrator%27s_Garden_Suzhou_November_2017_005.jpg",
    author: "King of Hearts",
    license: "CC BY-SA 4.0",
  },
  "青海-青海湖": {
    src: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fd/202606_Qinghai_Lake_04.jpg/960px-202606_Qinghai_Lake_04.jpg",
    page: "https://commons.wikimedia.org/wiki/File:202606_Qinghai_Lake_04.jpg",
    author: "Jonashtand",
    license: "CC BY-SA 4.0",
  },
  "山东-泰山": {
    src: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/76/Mount_tai_south_gate_to_heaven_2006_09_1.jpg/960px-Mount_tai_south_gate_to_heaven_2006_09_1.jpg",
    page: "https://commons.wikimedia.org/wiki/File:Mount_tai_south_gate_to_heaven_2006_09_1.jpg",
    author: "Rolf Müller",
    license: "CC BY-SA 3.0",
  },
  "西藏-布达拉宫": {
    src: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4f/Potala.jpg/960px-Potala.jpg",
    page: "https://commons.wikimedia.org/wiki/File:Potala.jpg",
    author: "Ondřej Žváček",
    license: "CC BY 2.5",
  },
  "北京-天坛": {
    src: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/86/20200110_Temple_of_Heaven-1.jpg/960px-20200110_Temple_of_Heaven-1.jpg",
    page: "https://commons.wikimedia.org/wiki/File:20200110_Temple_of_Heaven-1.jpg",
    author: "Balon Greyjoy",
    license: "CC0",
  },
  "北京-颐和园": {
    src: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fb/20090530_Beijing_Summer_Palace_8467.jpg/960px-20090530_Beijing_Summer_Palace_8467.jpg",
    page: "https://commons.wikimedia.org/wiki/File:20090530_Beijing_Summer_Palace_8467.jpg",
    author: "Jakub Hałun",
    license: "CC BY-SA 4.0",
  },
  "河南-龙门石窟": {
    src: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9f/27333-Luoyang%2C_Longmen_Grottoes.jpg/960px-27333-Luoyang%2C_Longmen_Grottoes.jpg",
    page: "https://commons.wikimedia.org/wiki/File:27333-Luoyang,_Longmen_Grottoes.jpg",
    author: "xiquinhosilva",
    license: "CC BY 2.0",
  },
  "山西-平遥古城": {
    src: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/1_pingyao_ancient_city_aerial_pano_2019.jpg/960px-1_pingyao_ancient_city_aerial_pano_2019.jpg",
    page: "https://commons.wikimedia.org/wiki/File:1_pingyao_ancient_city_aerial_pano_2019.jpg",
    author: "chensiyuan",
    license: "CC BY-SA 4.0",
  },
  "浙江-乌镇": {
    src: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cc/Aerial_panorama_of_Wuzhen_%E4%B9%8C%E9%95%87_Water_Town._December_2023.jpg/960px-Aerial_panorama_of_Wuzhen_%E4%B9%8C%E9%95%87_Water_Town._December_2023.jpg",
    page: "https://commons.wikimedia.org/wiki/File:Aerial_panorama_of_Wuzhen_%E4%B9%8C%E9%95%87_Water_Town._December_2023.jpg",
    author: "Wanderingchina",
    license: "CC BY 4.0",
  },
  "贵州-黄果树瀑布": {
    src: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/HuangguoshuFall.jpg/960px-HuangguoshuFall.jpg",
    page: "https://commons.wikimedia.org/wiki/File:HuangguoshuFall.jpg",
    author: "WaitinZ",
    license: "CC BY-SA 3.0",
  },
  "黑龙江-虎头旅游景区": {
    src: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f8/%E4%BE%B5%E5%8D%8E%E6%97%A5%E5%86%9B%E8%99%8E%E5%A4%B4%E8%A6%81%E5%A1%9E%E5%8D%9A%E7%89%A9%E9%A6%86_10.jpg/960px-%E4%BE%B5%E5%8D%8E%E6%97%A5%E5%86%9B%E8%99%8E%E5%A4%B4%E8%A6%81%E5%A1%9E%E5%8D%9A%E7%89%A9%E9%A6%86_10.jpg",
    page: "https://commons.wikimedia.org/wiki/File:%E4%BE%B5%E5%8D%8E%E6%97%A5%E5%86%9B%E8%99%8E%E5%A4%B4%E8%A6%81%E5%A1%9E%E5%8D%9A%E7%89%A9%E9%A6%86_10.jpg",
    author: "호고호",
    license: "CC0",
  },
  "甘肃-莫高窟": {
    src: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/Mogao_Cave_329.jpg/960px-Mogao_Cave_329.jpg",
    page: "https://commons.wikimedia.org/wiki/File:Mogao_Cave_329.jpg",
    author: "Unknown author",
    license: "Public domain",
  },
  "四川-青城山": {
    src: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Mount_Qingcheng_Kina_2009_0208_%284141812386%29.jpg/960px-Mount_Qingcheng_Kina_2009_0208_%284141812386%29.jpg",
    page: "https://commons.wikimedia.org/wiki/File:Mount_Qingcheng_Kina_2009_0208_(4141812386).jpg",
    author: "Einar Fredriksen",
    license: "CC BY-SA 2.0",
  },
  "山西-云冈石窟": {
    src: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/Datong_Yungang_Grottoes_Buddhist_statues.jpg/960px-Datong_Yungang_Grottoes_Buddhist_statues.jpg",
    page: "https://commons.wikimedia.org/wiki/File:Datong_Yungang_Grottoes_Buddhist_statues.jpg",
    author: "BabelStone",
    license: "CC BY-SA 3.0",
  },
  "山西-五台山": {
    src: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/46/Wutai_2009_378.jpg/960px-Wutai_2009_378.jpg",
    page: "https://commons.wikimedia.org/wiki/File:Wutai_2009_378.jpg",
    author: "G41rn8",
    license: "CC BY-SA 4.0",
  },
  "河北-避暑山庄": {
    src: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/Chengde_Mountain_Resort%2C_Pagoda.jpg/960px-Chengde_Mountain_Resort%2C_Pagoda.jpg",
    page: "https://commons.wikimedia.org/wiki/File:Chengde_Mountain_Resort,_Pagoda.jpg",
    author: "Алексей Бондаренко",
    license: "CC BY-SA 3.0",
  },
  "辽宁-沈阳故宫": {
    src: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/dc/A_sundial_in_Mukden_Palace.jpg/960px-A_sundial_in_Mukden_Palace.jpg",
    page: "https://commons.wikimedia.org/wiki/File:A_sundial_in_Mukden_Palace.jpg",
    author: "Pauloleong2002",
    license: "CC BY-SA 4.0",
  },
  "吉林-长白山": {
    src: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Changbai_Mountain_%E9%95%B7%E7%99%BD%E5%B1%B1_-_panoramio.jpg/960px-Changbai_Mountain_%E9%95%B7%E7%99%BD%E5%B1%B1_-_panoramio.jpg",
    page: "https://commons.wikimedia.org/wiki/File:Changbai_Mountain_%E9%95%B7%E7%99%BD%E5%B1%B1_-_panoramio.jpg",
    author: "lienyuan lee",
    license: "CC BY 3.0",
  },
  "浙江-灵隐寺": {
    src: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/43/20260423_Stone_Dhvaja_of_Lingyin_Temple_03.jpg/960px-20260423_Stone_Dhvaja_of_Lingyin_Temple_03.jpg",
    page: "https://commons.wikimedia.org/wiki/File:20260423_Stone_Dhvaja_of_Lingyin_Temple_03.jpg",
    author: "Windmemories",
    license: "CC BY-SA 4.0",
  },
  "福建-武夷山": {
    src: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d6/20121029_Mount_Wuyi_02.jpg/960px-20121029_Mount_Wuyi_02.jpg",
    page: "https://commons.wikimedia.org/wiki/File:20121029_Mount_Wuyi_02.jpg",
    author: "Windmemories",
    license: "CC BY-SA 4.0",
  },
  "山东-三孔": {
    src: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Kongzi_%28Confucius%29_Temple%2C_Qufu_%2813036087263%29.jpg/960px-Kongzi_%28Confucius%29_Temple%2C_Qufu_%2813036087263%29.jpg",
    page: "https://commons.wikimedia.org/wiki/File:Kongzi_(Confucius)_Temple,_Qufu_(13036087263).jpg",
    author: "Gary Todd",
    license: "CC0",
  },
  "山东-崂山": {
    src: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/56/Laoshan%2C_Qingdao%2C_Shandong%2C_China_-_panoramio_%2841%29.jpg/960px-Laoshan%2C_Qingdao%2C_Shandong%2C_China_-_panoramio_%2841%29.jpg",
    page: "https://commons.wikimedia.org/wiki/File:Laoshan,_Qingdao,_Shandong,_China_-_panoramio_(41).jpg",
    author: "Kobe Bryn",
    license: "CC BY 3.0",
  },
  "湖南-天门山": {
    src: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/Zhangjiajie_from_Tianmen_Mountain_01.jpg/960px-Zhangjiajie_from_Tianmen_Mountain_01.jpg",
    page: "https://commons.wikimedia.org/wiki/File:Zhangjiajie_from_Tianmen_Mountain_01.jpg",
    author: "Codas",
    license: "CC BY-SA 4.0",
  },
  "湖南-衡山": {
    src: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f5/Entrance_of_the_Grand_Temple_of_Mount_Heng%2C_25_February_2018%2C_picture1.jpg/960px-Entrance_of_the_Grand_Temple_of_Mount_Heng%2C_25_February_2018%2C_picture1.jpg",
    page: "https://commons.wikimedia.org/wiki/File:Entrance_of_the_Grand_Temple_of_Mount_Heng,_25_February_2018,_picture1.jpg",
    author: "Huangdan2060",
    license: "CC0",
  },
  "广东-丹霞山": {
    src: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ed/20251102_Danxia_Shan_%28121211%29.jpg/960px-20251102_Danxia_Shan_%28121211%29.jpg",
    page: "https://commons.wikimedia.org/wiki/File:20251102_Danxia_Shan_(121211).jpg",
    author: "Yumeto",
    license: "CC BY-SA 4.0",
  },
  "云南-玉龙雪山": {
    src: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Jade_Dragon_Snow_Mountain_20260221-1.jpg/960px-Jade_Dragon_Snow_Mountain_20260221-1.jpg",
    page: "https://commons.wikimedia.org/wiki/File:Jade_Dragon_Snow_Mountain_20260221-1.jpg",
    author: "ShuQizhe",
    license: "CC BY-SA 4.0",
  },
  "云南-石林": {
    src: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9b/1996_-255-35A_Kunming_Stone_Forest_of_Lunan_%285069088484%29.jpg/960px-1996_-255-35A_Kunming_Stone_Forest_of_Lunan_%285069088484%29.jpg",
    page: "https://commons.wikimedia.org/wiki/File:1996_-255-35A_Kunming_Stone_Forest_of_Lunan_(5069088484).jpg",
    author: "Dan Lundberg",
    license: "CC BY-SA 2.0",
  },
  "陕西-华山": {
    src: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e6/%E6%97%A5%E5%87%BA%2C_%E5%8D%8E%E5%B1%B1%E4%B8%9C%E5%B3%B0%2C_%E9%99%95%E8%A5%BF_HuaShan%2C_WeiNan%2C_ShanXi_20-11-11_-_panoramio.jpg/960px-%E6%97%A5%E5%87%BA%2C_%E5%8D%8E%E5%B1%B1%E4%B8%9C%E5%B3%B0%2C_%E9%99%95%E8%A5%BF_HuaShan%2C_WeiNan%2C_ShanXi_20-11-11_-_panoramio.jpg",
    page: "https://commons.wikimedia.org/wiki/File:%E6%97%A5%E5%87%BA,_%E5%8D%8E%E5%B1%B1%E4%B8%9C%E5%B3%B0,_%E9%99%95%E8%A5%BF_HuaShan,_WeiNan,_ShanXi_20-11-11_-_panoramio.jpg",
    author: "jaysonh",
    license: "CC BY 3.0",
  },
  "甘肃-嘉峪关": {
    src: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d2/Jiayuguan-DetailOfBuildingM.jpg/960px-Jiayuguan-DetailOfBuildingM.jpg",
    page: "https://commons.wikimedia.org/wiki/File:Jiayuguan-DetailOfBuildingM.jpg",
    author: "ArishG",
    license: "CC BY-SA 3.0",
  },
  "甘肃-鸣沙山月牙泉": {
    src: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d9/Crescent_Lake_from_the_Singing_Sand_Dunes_%2820230918101214%29.jpg/960px-Crescent_Lake_from_the_Singing_Sand_Dunes_%2820230918101214%29.jpg",
    page: "https://commons.wikimedia.org/wiki/File:Crescent_Lake_from_the_Singing_Sand_Dunes_(20230918101214).jpg",
    author: "N509FZ",
    license: "CC BY-SA 4.0",
  },
  "新疆-喀纳斯": {
    src: "https://upload.wikimedia.org/wikipedia/commons/6/6f/Kanas_Lake%2C_China%2C_LandSat_image.jpg",
    page: "https://commons.wikimedia.org/wiki/File:Kanas_Lake,_China,_LandSat_image.jpg",
    author: "NASA",
    license: "Public domain",
  },
  "新疆-天山天池": {
    src: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Tianchi_%28Heaven_Lake%29.jpg/960px-Tianchi_%28Heaven_Lake%29.jpg",
    page: "https://commons.wikimedia.org/wiki/File:Tianchi_(Heaven_Lake).jpg",
    author: "Daniel",
    license: "CC BY 2.0",
  },
  "黑龙江-当壁镇兴凯湖旅游度假区": {
    src: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/da/Lake_Khanka_Landsat_7_2001-09-25.jpg/960px-Lake_Khanka_Landsat_7_2001-09-25.jpg",
    page: "https://commons.wikimedia.org/wiki/File:Lake_Khanka_Landsat_7_2001-09-25.jpg",
    author: "Jesse Allen",
    license: "Public domain",
  },
  "四川-乐山大佛": {
    src: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/Leshan_Giant_Buddha%2C_20161102.jpg/960px-Leshan_Giant_Buddha%2C_20161102.jpg",
    page: "https://commons.wikimedia.org/wiki/File:Leshan_Giant_Buddha,_20161102.jpg",
    author: "王计",
    license: "CC BY 2.5",
  },
};

for (const spot of spots) {
  if (spot.themes == null) spot.themes = inferThemes(spot);
  if (spot.seasons == null) spot.seasons = inferSeasons(`${spot.season || ""}${spot.history || ""}`);
  if (!spot.access) spot.access = accessFor(spot);
  if (LINKS[spot.id]) spot.links = LINKS[spot.id];
  if (IMAGES[spot.id]) spot.image = IMAGES[spot.id];
}

const file = {
  meta: {
    label: "整理介绍",
    note: "景区、节令和特色据公开常识编写，不是文化和旅游部门名录。国家A级只在有把握时标注，并可能调整。票价若出现数字，只是整理时的公开参考，不是当日官价。交通是整理说明，不是时刻表。",
  },
  hubs: HUBS,
  spots,
};

writeFileSync(join(root, "public/data/attractions.json"), JSON.stringify(file));
const full = spots.filter((spot) => spot.depth === "full");
const graded = full.filter((spot) => spot.grade);
const customs = spots.filter((spot) => spot.kind === "custom").length;
const specialties = spots.filter((spot) => spot.kind === "specialty").length;
const links = spots.filter((spot) => spot.links?.length).length;
const images = spots.filter((spot) => spot.image).length;
console.log(
  `attractions ${spots.length}, full ${full.length}, short ${spots.length - full.length}, custom ${customs}, specialty ${specialties}, links ${links}, images ${images}, 5A ${graded.filter((spot) => spot.grade === "5A").length}, 4A ${graded.filter((spot) => spot.grade === "4A").length}`,
);

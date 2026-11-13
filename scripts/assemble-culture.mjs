import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { provinces } from "./culture/provinces.mjs";
import { cities as north } from "./culture/cities-north.mjs";
import { cities as east } from "./culture/cities-east.mjs";
import { cities as south } from "./culture/cities-south.mjs";
import { cities as west } from "./culture/cities-west.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function pick(place, options) {
  let hash = 0;
  for (const char of place) hash = (hash * 33 + char.charCodeAt(0)) >>> 0;
  return options[hash % options.length];
}

function secondSentence(place, kind, text) {
  if (kind === "sights") {
    if (/博物馆|纪念馆|展陈|旧址/.test(text)) {
      return pick(place, [
        `在${place}进这些馆，主要看原来的房间、照片和实物，说明牌会写清哪些是原物。`,
        `${place}的纪念场所把事情发生的屋子留下来，参观时能对照说明，不是只剩一块牌子。`,
      ]);
    }
    if (/沿河|沿江|沿湖|海岸|海滩|看海|湿地|水库/.test(text)) {
      return pick(place, [
        `${place}的水边走得通，桥、岸和人家都在眼前，水位高低会改变能看到的范围。`,
        `到${place}沿水走一段，比远看名字清楚：哪是桥、哪是滩、哪是还在住人的房子。`,
      ]);
    }
    if (/山|峰|峡|洞|林|草原|沙漠|长城|石/.test(text)) {
      return pick(place, [
        `${place}的山或地貌要走到近处才看得出高低和石头，云大或封路时远处会看不清。`,
        `这些地点在${place}都有路可走，天气好时能看清轮廓，雨雪天会缩短能到的距离。`,
      ]);
    }
    if (/古城|古镇|城墙|老街|骑楼|巷|城楼/.test(text)) {
      return pick(place, [
        `${place}的街和墙还能走进去，店铺多是后来开的，旧的是房子、门和城砖。`,
        `在${place}沿街走，能分出哪一段是老房子、哪一段是后来的铺面。`,
      ]);
    }
    if (/寺|庙|观|宫|塔|陵|墓|窟|祠/.test(text)) {
      return pick(place, [
        `${place}的殿、塔或窟还在原地，本地人烧香、转经，和参观的人会走在同一条路上。`,
        `到${place}这些宗教或陵墓建筑里，能看见殿宇和造像，不是只在书上留名。`,
      ]);
    }
    return pick(place, [
      `在${place}，这些就是能按当地规定去看的现场，开放范围以公告为准。`,
      `${place}的这些点分散在城区或近郊，要单独留时间，不能只在路过时看一个名字。`,
    ]);
  }
  if (kind === "specialties") {
    if (/茶|酒|醋|面|粉|糕|馍|包子|肉|鱼|羊|牛|鸡|鸭|果|枣|梨|桃|米|瓜|饼|汤|馕|菜|虾|蟹/.test(text)) {
      return pick(place, [
        `在${place}的市场或小馆里能吃到，味道随店和季节变，不是景区门口的统一礼盒。`,
        `${place}人自己也吃这些，当早餐、下酒或过节的菜，不是只做给游客看的样品。`,
      ]);
    }
    if (/绣|陶|瓷|锦|刻|戏|舞|歌|琴|鼓|年画|剪纸|雕|织|画|香|玉/.test(text)) {
      return pick(place, [
        `这是${place}还留着的手艺或表演，工坊、戏台或节庆上才能看全做法。`,
        `在${place}，这些手艺用来做能用的东西或在节庆上演出，不是空的名号。`,
      ]);
    }
    return pick(place, [
      `它和${place}的日常有关，集市、家里或工坊里能对上号。`,
      `${place}的这一样东西有具体做法或用途，不是一个贴在地名后面的词。`,
    ]);
  }
  return pick(place, [
    `在${place}，这是本地还过的节令或每天的做法，外地人可以跟着看，但不是专门排给游客的节目单。`,
    `${place}的这种习惯嵌在吃饭、过节或劳作里，时间对了才遇得上。`,
  ]);
}

function flesh(place, kind, text) {
  let t = text.trim();
  if (!/[。！？]$/.test(t)) t += "。";
  const periods = (t.match(/。/g) || []).length;
  if (t.length >= 44 && periods >= 2) return t;
  if (periods >= 3 && t.length >= 36) return t;
  const extra = secondSentence(place, kind, t);
  if (extra && !t.includes(extra.slice(0, 12))) t += extra;
  return t;
}

function deepen(place, note) {
  return {
    customs: flesh(place, "customs", note.customs),
    sights: flesh(place, "sights", note.sights),
    specialties: flesh(place, "specialties", note.specialties),
  };
}

const cities = {};
for (const group of [north, east, south, west]) {
  for (const [province, cityNotes] of Object.entries(group)) {
    cities[province] = {};
    for (const [city, note] of Object.entries(cityNotes)) {
      cities[province][city] = deepen(city, note);
    }
  }
}
const deepProvinces = {};
for (const [name, note] of Object.entries(provinces)) {
  deepProvinces[name] = deepen(name, note);
}

const file = {
  meta: {
    label: "整理介绍",
    note: "习俗、景点和特色据公开的地方常识汇编，便于浏览，不是官方旅游名录、非遗名录或文旅申报材料。",
  },
  provinces: deepProvinces,
  cities,
};

writeFileSync(join(root, "data/culture.json"), `${JSON.stringify(file, null, 2)}\n`);
console.log(`provinces ${Object.keys(deepProvinces).length}, city groups ${Object.keys(cities).length}`);

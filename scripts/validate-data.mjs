import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const surnames = JSON.parse(readFileSync(join(root, "data/surnames.json"), "utf8"));
const ethnicities = JSON.parse(readFileSync(join(root, "data/ethnicities.json"), "utf8"));

const failures = [];
function expect(condition, message) {
  if (!condition) failures.push(message);
}

const provinces = surnames.provinces.map((item) => item.short);
expect(provinces.length === 31, "应有 31 个内地省级单位");
expect(surnames.unavailable.map((item) => item.short).join(",") === "香港,澳门,台湾", "港澳台应标记为暂无");
expect(ethnicities.provinces.map((item) => item.short).join(",") === provinces.join(","), "两份数据的省份列表应一致");
expect(surnames.meta.label.includes("示意"), "姓氏数据应标注示意");
expect(ethnicities.meta.label.includes("示意"), "民族数据应标注示意");
expect(surnames.surnames.length === 400, `姓氏应为 400 个，实际 ${surnames.surnames.length}`);

const seen = new Set();
for (const item of surnames.surnames) {
  expect(!seen.has(item.name), `姓氏重复 ${item.name}`);
  seen.add(item.name);
  expect(item.rank === surnames.surnames.indexOf(item) + 1, `${item.name} 排名不连续`);
  expect(item.nationalShare > 0, `${item.name} 全国份额无效`);
  for (const province of provinces) {
    const value = item.shares[province];
    expect(typeof value === "number" && value >= 0 && value < 30, `${item.name}/${province} 份额异常 ${value}`);
  }
  for (const place of surnames.unavailable) {
    expect(item.shares[place.short] === undefined, `${item.name} 不应包含 ${place.short}`);
  }
}

function share(name, province) {
  const item = surnames.surnames.find((entry) => entry.name === name);
  expect(item, `缺少姓氏 ${name}`);
  return item ? item.shares[province] : 0;
}

function columnSum(province) {
  return surnames.surnames.reduce((sum, item) => sum + item.shares[province], 0);
}

expect(share("林", "福建") > share("林", "山东") * 2, "林应集中于福建");
expect(share("陈", "广东") > share("陈", "北京"), "陈应集中于广东");
expect(share("陈", "福建") > 8, "福建的陈应形成高值");
expect(share("韦", "广西") > share("韦", "江苏") * 4, "韦应集中于广西");
expect(share("覃", "广西") > share("覃", "山东") * 4, "覃应集中于广西");
expect(share("马", "宁夏") > share("马", "浙江") * 2, "马应在宁夏更高");
expect(share("金", "吉林") > share("金", "浙江"), "金应在吉林高于浙江");
expect(share("杨", "四川") > share("杨", "北京"), "杨应在四川更高");
expect(share("黄", "广东") > share("黄", "山东") * 2, "黄应集中于广东");
expect(share("欧阳", "江西") > share("欧阳", "山东"), "欧阳应集中于江西");
expect(share("朴", "吉林") > share("朴", "河南"), "朴应在吉林更高");
expect(share("区", "广东") > share("区", "山东"), "区应集中于广东");
expect(columnSum("西藏") < columnSum("山东") * 0.5, "西藏常见姓合计应更低");
expect(columnSum("新疆") < columnSum("江苏"), "新疆常见姓合计应低于江苏");
for (const province of provinces) {
  const sum = columnSum(province);
  expect(sum > 8 && sum < 98, `${province} 姓氏合计 ${sum.toFixed(2)} 异常`);
}

expect(ethnicities.groups.length >= 40, "主要民族覆盖不足");
for (const group of ethnicities.groups) {
  expect(group.hint, `${group.name} 缺少说明`);
  let sum = 0;
  for (const province of provinces) {
    const value = group.shares[province];
    expect(typeof value === "number" && value >= 0 && value <= 100, `${group.name}/${province} 无效`);
    sum += value;
  }
  expect(sum > 0, `${group.name} 没有任何省级份额`);
}

function ethnic(name, province) {
  const item = ethnicities.groups.find((entry) => entry.name === name);
  expect(item, `缺少民族 ${name}`);
  return item ? item.shares[province] : 0;
}

for (const province of provinces) {
  const sum = ethnicities.groups.reduce((total, group) => total + group.shares[province], 0);
  expect(sum >= 97 && sum <= 100.02, `${province} 民族合计 ${sum.toFixed(2)}`);
}

expect(ethnic("壮族", "广西") > 30, "壮族应集中于广西");
expect(ethnic("藏族", "西藏") > 80, "藏族应是西藏主体");
expect(ethnic("回族", "宁夏") > 30, "回族应在宁夏形成高比例");
expect(ethnic("维吾尔族", "新疆") > 40, "维吾尔族应是新疆高比例民族");
expect(ethnic("黎族", "海南") > 12, "黎族应集中于海南");
expect(ethnic("朝鲜族", "吉林") > 3, "朝鲜族应在吉林较高");
expect(ethnic("满族", "辽宁") > 8, "满族应在辽宁较高");
expect(ethnic("蒙古族", "内蒙古") > 15, "蒙古族应在内蒙古较高");
expect(ethnic("汉族", "山西") > 98, "山西汉族比例应很高");
expect(ethnicities.groups.find((item) => item.name === "汉族").nationalShare > 88, "汉族全国参照应为主导");

for (const province of provinces) {
  const file = JSON.parse(readFileSync(join(root, `public/data/cities/${province}.json`), "utf8"));
  expect(file.province === province, `${province} 地级文件省份不符`);
  expect(file.cities.length >= 5, `${province} 地级单位过少`);
  expect(file.meta.label.includes("示意"), `${province} 地级数据应标注示意`);
  for (const [surname, row] of Object.entries(file.surnameShares)) {
    expect(row.length === file.cities.length, `${province} ${surname} 地级份额长度不符`);
    expect(row.every((value) => typeof value === "number" && value >= 0), `${province} ${surname} 地级份额无效`);
  }
  for (const [city, groups] of Object.entries(file.ethnicity)) {
    expect(file.cities.includes(city), `${province} 有未知城市 ${city}`);
    const sum = Object.values(groups).reduce((total, value) => total + value, 0);
    expect(Math.abs(sum - 100) < 0.2, `${city} 民族合计 ${sum}`);
  }
}

const guangdong = JSON.parse(readFileSync(join(root, "public/data/cities/广东.json"), "utf8"));
const chaozhou = guangdong.cities.indexOf("潮州市");
const shaoguan = guangdong.cities.indexOf("韶关市");
expect(guangdong.surnameShares["林"][chaozhou] > guangdong.surnameShares["林"][shaoguan], "潮州的林应高于韶关");
const jilin = JSON.parse(readFileSync(join(root, "public/data/cities/吉林.json"), "utf8"));
expect(jilin.ethnicity["延边朝鲜族自治州"]["朝鲜族"] > 25, "延边朝鲜族应明显更高");
const xinjiang = JSON.parse(readFileSync(join(root, "public/data/cities/新疆.json"), "utf8"));
expect(xinjiang.ethnicity["喀什地区"]["维吾尔族"] > 80, "喀什维吾尔族应很高");
const hainan = JSON.parse(readFileSync(join(root, "public/data/cities/海南.json"), "utf8"));
expect(hainan.ethnicity["白沙黎族自治县"]["黎族"] > 40, "白沙黎族应很高");

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`数据校验通过：${surnames.surnames.length} 个姓氏，${ethnicities.groups.length} 个民族，${provinces.length} 个省级单位。`);

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
expect(surnames.surnames.length === 100, `姓氏应为 100 个，实际 ${surnames.surnames.length}`);

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
expect(columnSum("西藏") < columnSum("山东") * 0.5, "西藏常见姓合计应更低");
expect(columnSum("新疆") < columnSum("江苏"), "新疆常见姓合计应低于江苏");
for (const province of provinces) {
  const sum = columnSum(province);
  expect(sum > 8 && sum < 96, `${province} 姓氏合计 ${sum.toFixed(2)} 异常`);
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

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`数据校验通过：${surnames.surnames.length} 个姓氏，${ethnicities.groups.length} 个民族，${provinces.length} 个省级单位。`);

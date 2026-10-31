import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const ADCODE = {
  北京: "110000",
  天津: "120000",
  河北: "130000",
  山西: "140000",
  内蒙古: "150000",
  辽宁: "210000",
  吉林: "220000",
  黑龙江: "230000",
  上海: "310000",
  江苏: "320000",
  浙江: "330000",
  安徽: "340000",
  福建: "350000",
  江西: "360000",
  山东: "370000",
  河南: "410000",
  湖北: "420000",
  湖南: "430000",
  广东: "440000",
  广西: "450000",
  海南: "460000",
  重庆: "500000",
  四川: "510000",
  贵州: "520000",
  云南: "530000",
  西藏: "540000",
  陕西: "610000",
  甘肃: "620000",
  青海: "630000",
  宁夏: "640000",
  新疆: "650000",
};

function group(names, weights) {
  return Object.fromEntries(names.map((name) => [name, weights]));
}

const CHAOSHAN = group(["潮州市", "汕头市", "揭阳市"], {
  林: 2.6,
  陈: 1.7,
  黄: 1.9,
  郑: 1.6,
  蔡: 1.7,
  许: 1.5,
  吴: 1.35,
  张: 0.75,
  王: 0.7,
  李: 0.85,
});
const HAKKA_GD = group(["梅州市", "河源市", "惠州市", "韶关市", "清远市"], {
  李: 1.45,
  张: 1.35,
  钟: 1.8,
  刘: 1.25,
  黄: 1.15,
  陈: 0.85,
  林: 0.7,
});

const CITY_BOOST = {
  广东: {
    ...CHAOSHAN,
    ...HAKKA_GD,
    湛江市: { 陈: 1.35, 李: 1.2, 黄: 1.25, 林: 0.85 },
    茂名市: { 陈: 1.3, 李: 1.2, 黄: 1.2, 林: 0.85 },
    阳江市: { 陈: 1.25, 关: 1.3, 林: 0.9 },
  },
  福建: {
    泉州市: { 陈: 1.45, 林: 1.7, 黄: 1.45, 吴: 1.3, 郑: 1.25, 蔡: 1.3 },
    漳州市: { 陈: 1.4, 林: 1.65, 黄: 1.5, 吴: 1.25, 张: 0.85 },
    厦门市: { 陈: 1.35, 林: 1.45, 黄: 1.3, 吴: 1.2 },
    福州市: { 林: 1.55, 陈: 1.35, 郑: 1.2, 黄: 1.1 },
    莆田市: { 林: 1.4, 陈: 1.35, 郑: 1.25, 黄: 1.15 },
    龙岩市: { 林: 1.15, 张: 1.25, 李: 1.2, 陈: 0.95 },
    宁德市: { 陈: 1.2, 林: 1.25, 黄: 1.1 },
    三明市: { 陈: 1.05, 林: 0.95, 张: 1.1, 李: 1.1 },
    南平市: { 陈: 1.05, 林: 0.9, 张: 1.1, 李: 1.1 },
  },
  浙江: {
    温州市: { 陈: 1.7, 林: 1.8, 黄: 1.45, 吴: 1.15, 沈: 0.7, 钱: 0.65 },
    台州市: { 陈: 1.35, 林: 1.25, 黄: 1.15 },
    杭州市: { 沈: 1.35, 钱: 1.3, 吴: 1.2, 陈: 0.9 },
    嘉兴市: { 沈: 1.25, 钱: 1.2, 吴: 1.15 },
    湖州市: { 沈: 1.25, 吴: 1.2, 钱: 1.15 },
    宁波市: { 陈: 1.15, 王: 1.1, 吴: 1.15 },
    绍兴市: { 王: 1.15, 陈: 1.1, 吴: 1.1 },
    丽水市: { 陈: 1.15, 林: 1.15, 刘: 1.1 },
    金华市: { 陈: 1.15, 吴: 1.1, 王: 1.05 },
  },
  江苏: {
    苏州市: { 顾: 1.7, 沈: 1.55, 钱: 1.5, 吴: 1.35, 王: 0.85 },
    无锡市: { 顾: 1.45, 沈: 1.35, 钱: 1.3, 吴: 1.25 },
    常州市: { 吴: 1.25, 沈: 1.2, 陈: 1.1 },
    南京市: { 王: 1.05, 张: 1.05, 李: 1.05, 陈: 1.05 },
    徐州市: { 王: 1.35, 李: 1.25, 张: 1.25, 刘: 1.15, 顾: 0.6, 沈: 0.65 },
    连云港市: { 王: 1.3, 李: 1.2, 张: 1.2, 刘: 1.1 },
    宿迁市: { 王: 1.25, 李: 1.2, 张: 1.15 },
    南通市: { 陈: 1.15, 王: 1.1, 张: 1.05 },
  },
  广西: {
    百色市: { 韦: 1.9, 覃: 1.7, 黄: 1.35, 陆: 1.3, 李: 0.85 },
    河池市: { 韦: 1.85, 覃: 1.6, 黄: 1.3, 蓝: 1.4 },
    崇左市: { 韦: 1.7, 黄: 1.45, 农: 1.6, 陆: 1.25 },
    来宾市: { 韦: 1.55, 覃: 1.4, 黄: 1.25 },
    柳州市: { 韦: 1.2, 陈: 1.1, 李: 1.1 },
    桂林市: { 陈: 1.2, 李: 1.15, 王: 1.15, 韦: 0.55, 覃: 0.5 },
    玉林市: { 陈: 1.25, 李: 1.2, 梁: 1.2, 韦: 0.6 },
    北海市: { 陈: 1.2, 李: 1.15, 黄: 1.1 },
    南宁市: { 黄: 1.15, 韦: 1.15, 陈: 1.05 },
  },
  海南: {
    海口市: { 陈: 1.15, 林: 0.9, 王: 1.05 },
    三亚市: { 陈: 1.1, 李: 1.05, 黄: 1.05 },
    文昌市: { 林: 1.25, 陈: 1.15, 云: 1.2 },
    琼海市: { 陈: 1.15, 林: 1.1 },
  },
};

function roundShare(value) {
  if (!(value > 0)) return 0;
  return Number(value.toFixed(value < 1 ? 3 : 2));
}

function sealEthnic(parts) {
  const entries = Object.entries(parts).filter(([, value]) => value > 0);
  const sum = entries.reduce((total, [, value]) => total + value, 0);
  if (Math.abs(sum - 100) > 3) throw new Error(`地级民族合计 ${sum}: ${JSON.stringify(parts)}`);
  let maxIndex = 0;
  entries.forEach((entry, index) => {
    if (entry[1] > entries[maxIndex][1]) maxIndex = index;
  });
  const drift = Number((100 - sum).toFixed(2));
  entries[maxIndex][1] = Number((entries[maxIndex][1] + drift).toFixed(2));
  return Object.fromEntries(entries);
}

const ETHNIC_CITY = {
  承德市: sealEthnic({ 汉族: 78, 满族: 18, 回族: 2.5, 蒙古族: 1 }),
  阜新市: sealEthnic({ 汉族: 80, 蒙古族: 14, 满族: 5, 回族: 0.6 }),
  抚顺市: sealEthnic({ 汉族: 72, 满族: 24, 朝鲜族: 1.5, 回族: 1, 蒙古族: 1 }),
  本溪市: sealEthnic({ 汉族: 74, 满族: 22, 回族: 2, 朝鲜族: 1 }),
  丹东市: sealEthnic({ 汉族: 78, 满族: 18, 朝鲜族: 2, 蒙古族: 1 }),
  延边朝鲜族自治州: sealEthnic({ 汉族: 60, 朝鲜族: 35, 满族: 3.5, 回族: 0.8, 蒙古族: 0.5 }),
  兴安盟: sealEthnic({ 汉族: 50, 蒙古族: 46, 满族: 2, 回族: 1 }),
  通辽市: sealEthnic({ 汉族: 50, 蒙古族: 46, 满族: 2, 回族: 1 }),
  赤峰市: sealEthnic({ 汉族: 76, 蒙古族: 20, 满族: 2.5, 回族: 1 }),
  呼伦贝尔市: sealEthnic({ 汉族: 80, 蒙古族: 12, 达斡尔族: 3, 鄂温克族: 1.5, 回族: 1, 满族: 1.5 }),
  锡林郭勒盟: sealEthnic({ 汉族: 66, 蒙古族: 31, 回族: 1.5, 满族: 1 }),
  阿拉善盟: sealEthnic({ 汉族: 72, 蒙古族: 25, 回族: 2 }),
  恩施土家族苗族自治州: sealEthnic({ 汉族: 46, 土家族: 46, 苗族: 6, 侗族: 1, 回族: 0.5 }),
  湘西土家族苗族自治州: sealEthnic({ 汉族: 32, 土家族: 36, 苗族: 30, 回族: 1 }),
  黔东南苗族侗族自治州: sealEthnic({ 汉族: 22, 苗族: 42, 侗族: 32, 水族: 1, 布依族: 1 }),
  黔南布依族苗族自治州: sealEthnic({ 汉族: 45, 布依族: 32, 苗族: 14, 水族: 5, 瑶族: 2 }),
  黔西南布依族苗族自治州: sealEthnic({ 汉族: 55, 布依族: 32, 苗族: 8, 彝族: 3, 回族: 1 }),
  楚雄彝族自治州: sealEthnic({ 汉族: 66, 彝族: 30, 傈僳族: 1, 苗族: 1, 回族: 1 }),
  红河哈尼族彝族自治州: sealEthnic({ 汉族: 44, 彝族: 24, 哈尼族: 18, 苗族: 6, 傣族: 3, 壮族: 3, 瑶族: 1 }),
  文山壮族苗族自治州: sealEthnic({ 汉族: 44, 壮族: 30, 苗族: 14, 彝族: 6, 瑶族: 4, 回族: 1 }),
  西双版纳傣族自治州: sealEthnic({ 汉族: 30, 傣族: 32, 哈尼族: 20, 彝族: 6, 拉祜族: 4, 布朗族: 4, 瑶族: 2 }),
  大理白族自治州: sealEthnic({ 汉族: 50, 白族: 34, 彝族: 8, 回族: 3, 傈僳族: 2, 苗族: 1, 纳西族: 1 }),
  德宏傣族景颇族自治州: sealEthnic({ 汉族: 50, 傣族: 30, 景颇族: 12, 傈僳族: 3, 阿昌族: 2, 德昂族: 1 }),
  怒江傈僳族自治州: sealEthnic({ 傈僳族: 48, 白族: 14, 汉族: 19, 怒族: 6, 普米族: 2, 独龙族: 1, 藏族: 2, 彝族: 8 }),
  迪庆藏族自治州: sealEthnic({ 藏族: 36, 傈僳族: 28, 汉族: 18, 纳西族: 10, 白族: 4, 彝族: 2, 普米族: 1 }),
  凉山彝族自治州: sealEthnic({ 彝族: 54, 汉族: 44, 藏族: 0.6, 蒙古族: 0.4, 回族: 0.5 }),
  甘孜藏族自治州: sealEthnic({ 藏族: 80, 汉族: 18, 彝族: 1, 羌族: 0.4, 回族: 0.3 }),
  阿坝藏族羌族自治州: sealEthnic({ 藏族: 57, 羌族: 18, 汉族: 23, 回族: 1.5 }),
  临夏回族自治州: sealEthnic({ 回族: 52, 东乡族: 22, 汉族: 23, 保安族: 1.5, 撒拉族: 0.8, 土族: 0.4 }),
  甘南藏族自治州: sealEthnic({ 藏族: 56, 汉族: 40, 回族: 3, 土族: 0.5 }),
  西宁市: sealEthnic({ 汉族: 74, 回族: 16, 藏族: 5.5, 土族: 2, 蒙古族: 1, 撒拉族: 1 }),
  海东市: sealEthnic({ 汉族: 56, 回族: 22, 藏族: 10, 土族: 8, 蒙古族: 2, 撒拉族: 1.5 }),
  海北藏族自治州: sealEthnic({ 汉族: 38, 藏族: 28, 回族: 24, 蒙古族: 8, 土族: 1.5 }),
  黄南藏族自治州: sealEthnic({ 藏族: 68, 汉族: 16, 回族: 10, 蒙古族: 4, 土族: 1, 撒拉族: 0.5 }),
  海南藏族自治州: sealEthnic({ 藏族: 66, 汉族: 26, 回族: 5, 蒙古族: 2, 土族: 0.6 }),
  果洛藏族自治州: sealEthnic({ 藏族: 92, 汉族: 6, 回族: 1, 撒拉族: 0.4, 蒙古族: 0.3 }),
  玉树藏族自治州: sealEthnic({ 藏族: 96, 汉族: 3.2, 回族: 0.4, 撒拉族: 0.2, 蒙古族: 0.2 }),
  海西蒙古族藏族自治州: sealEthnic({ 汉族: 66, 藏族: 14, 蒙古族: 8, 回族: 8, 土族: 2, 撒拉族: 1.5 }),
  银川市: sealEthnic({ 汉族: 74, 回族: 24, 满族: 1, 蒙古族: 0.5 }),
  石嘴山市: sealEthnic({ 汉族: 78, 回族: 20, 满族: 1, 蒙古族: 0.5 }),
  吴忠市: sealEthnic({ 汉族: 48, 回族: 50, 满族: 1, 蒙古族: 0.6 }),
  固原市: sealEthnic({ 汉族: 50, 回族: 48, 满族: 0.8, 蒙古族: 0.6 }),
  中卫市: sealEthnic({ 汉族: 64, 回族: 34, 满族: 1, 蒙古族: 0.5 }),
  拉萨市: sealEthnic({ 藏族: 72, 汉族: 26, 回族: 1.2, 门巴族: 0.2 }),
  日喀则市: sealEthnic({ 藏族: 96, 汉族: 3.2, 回族: 0.4 }),
  昌都市: sealEthnic({ 藏族: 95, 汉族: 4.2, 回族: 0.4 }),
  林芝市: sealEthnic({ 藏族: 74, 汉族: 22, 门巴族: 1.5, 珞巴族: 0.8, 回族: 0.5 }),
  山南市: sealEthnic({ 藏族: 94, 汉族: 5.2, 回族: 0.4, 珞巴族: 0.2 }),
  那曲市: sealEthnic({ 藏族: 97, 汉族: 2.5, 回族: 0.3 }),
  阿里地区: sealEthnic({ 藏族: 96, 汉族: 3.4, 回族: 0.3 }),
  乌鲁木齐市: sealEthnic({ 汉族: 74, 维吾尔族: 13, 回族: 8, 哈萨克族: 3, 蒙古族: 0.6, 满族: 0.4 }),
  克拉玛依市: sealEthnic({ 汉族: 80, 维吾尔族: 12, 回族: 4, 哈萨克族: 3, 蒙古族: 0.5 }),
  吐鲁番市: sealEthnic({ 维吾尔族: 72, 汉族: 24, 回族: 3, 哈萨克族: 0.6 }),
  哈密市: sealEthnic({ 汉族: 66, 维吾尔族: 20, 哈萨克族: 9, 回族: 4, 蒙古族: 0.5 }),
  昌吉回族自治州: sealEthnic({ 汉族: 74, 回族: 11, 哈萨克族: 8, 维吾尔族: 5, 蒙古族: 1 }),
  博尔塔拉蒙古自治州: sealEthnic({ 汉族: 65, 维吾尔族: 15, 哈萨克族: 10, 蒙古族: 7, 回族: 2.5 }),
  巴音郭楞蒙古自治州: sealEthnic({ 汉族: 58, 维吾尔族: 34, 蒙古族: 4, 回族: 3, 哈萨克族: 0.6 }),
  阿克苏地区: sealEthnic({ 维吾尔族: 80, 汉族: 17, 回族: 1.5, 柯尔克孜族: 0.8 }),
  克孜勒苏柯尔克孜自治州: sealEthnic({ 维吾尔族: 64, 柯尔克孜族: 28, 汉族: 6, 塔吉克族: 1, 回族: 0.6 }),
  喀什地区: sealEthnic({ 维吾尔族: 92, 汉族: 6, 塔吉克族: 0.8, 回族: 0.6, 柯尔克孜族: 0.4 }),
  和田地区: sealEthnic({ 维吾尔族: 96.5, 汉族: 3, 回族: 0.3 }),
  伊犁哈萨克自治州: sealEthnic({ 汉族: 40, 哈萨克族: 27, 维吾尔族: 17, 回族: 10, 蒙古族: 2, 锡伯族: 2, 柯尔克孜族: 1 }),
  塔城地区: sealEthnic({ 汉族: 56, 哈萨克族: 25, 回族: 8, 维吾尔族: 5, 蒙古族: 3, 达斡尔族: 1 }),
  阿勒泰地区: sealEthnic({ 哈萨克族: 51, 汉族: 40, 回族: 4, 维吾尔族: 2, 蒙古族: 2 }),
  石河子市: sealEthnic({ 汉族: 92, 维吾尔族: 3, 回族: 2, 哈萨克族: 2 }),
  五家渠市: sealEthnic({ 汉族: 90, 回族: 4, 维吾尔族: 3, 哈萨克族: 2 }),
  北屯市: sealEthnic({ 汉族: 70, 哈萨克族: 24, 回族: 3, 维吾尔族: 2 }),
  双河市: sealEthnic({ 汉族: 72, 哈萨克族: 16, 维吾尔族: 6, 回族: 4 }),
  可克达拉市: sealEthnic({ 汉族: 68, 哈萨克族: 18, 维吾尔族: 8, 回族: 4 }),
  胡杨河市: sealEthnic({ 汉族: 70, 维吾尔族: 16, 哈萨克族: 8, 回族: 4 }),
  阿拉尔市: sealEthnic({ 汉族: 42, 维吾尔族: 54, 回族: 3 }),
  图木舒克市: sealEthnic({ 汉族: 38, 维吾尔族: 58, 回族: 2.5, 柯尔克孜族: 1 }),
  铁门关市: sealEthnic({ 汉族: 45, 维吾尔族: 50, 蒙古族: 3, 回族: 1.5 }),
  昆玉市: sealEthnic({ 维吾尔族: 70, 汉族: 28, 回族: 1.5 }),
  百色市: sealEthnic({ 壮族: 72, 汉族: 22, 瑶族: 4, 苗族: 1, 彝族: 0.5 }),
  河池市: sealEthnic({ 壮族: 66, 汉族: 20, 瑶族: 8, 毛南族: 2, 苗族: 2, 仫佬族: 1, 水族: 0.5 }),
  崇左市: sealEthnic({ 壮族: 82, 汉族: 15, 瑶族: 2, 京族: 0.4 }),
  来宾市: sealEthnic({ 壮族: 62, 汉族: 34, 瑶族: 2.5, 苗族: 1 }),
  柳州市: sealEthnic({ 汉族: 52, 壮族: 40, 瑶族: 3, 苗族: 2, 侗族: 1.5, 仫佬族: 1 }),
  南宁市: sealEthnic({ 汉族: 50, 壮族: 46, 瑶族: 2, 苗族: 1, 回族: 0.5 }),
  桂林市: sealEthnic({ 汉族: 82, 壮族: 8, 瑶族: 6, 回族: 1.5, 苗族: 1.5, 侗族: 0.5 }),
  玉林市: sealEthnic({ 汉族: 97, 壮族: 2, 瑶族: 0.6 }),
  北海市: sealEthnic({ 汉族: 96, 壮族: 2.5, 京族: 0.4 }),
  梧州市: sealEthnic({ 汉族: 94, 壮族: 4, 瑶族: 1.5 }),
  贵港市: sealEthnic({ 汉族: 84, 壮族: 14, 瑶族: 1.5 }),
  钦州市: sealEthnic({ 汉族: 88, 壮族: 11, 京族: 0.4 }),
  防城港市: sealEthnic({ 汉族: 55, 壮族: 40, 京族: 4, 瑶族: 0.8 }),
  贺州市: sealEthnic({ 汉族: 82, 壮族: 10, 瑶族: 6, 苗族: 1 }),
  白沙黎族自治县: sealEthnic({ 黎族: 62, 汉族: 36, 苗族: 1, 壮族: 0.5 }),
  昌江黎族自治县: sealEthnic({ 黎族: 48, 汉族: 50, 苗族: 1, 壮族: 0.5 }),
  乐东黎族自治县: sealEthnic({ 黎族: 40, 汉族: 58, 苗族: 1.2, 壮族: 0.5 }),
  陵水黎族自治县: sealEthnic({ 黎族: 45, 汉族: 52, 苗族: 2, 壮族: 0.5 }),
  保亭黎族苗族自治县: sealEthnic({ 黎族: 58, 苗族: 8, 汉族: 32, 壮族: 1 }),
  琼中黎族苗族自治县: sealEthnic({ 黎族: 50, 苗族: 8, 汉族: 40, 壮族: 1 }),
  五指山市: sealEthnic({ 黎族: 62, 汉族: 34, 苗族: 3 }),
  东方市: sealEthnic({ 汉族: 78, 黎族: 18, 苗族: 2, 壮族: 1 }),
  三沙市: sealEthnic({ 汉族: 96, 黎族: 2, 回族: 1 }),
  海口市: sealEthnic({ 汉族: 97.5, 黎族: 1.2, 苗族: 0.4, 壮族: 0.3, 回族: 0.3 }),
  三亚市: sealEthnic({ 汉族: 88, 黎族: 8, 苗族: 1.5, 回族: 1, 壮族: 1 }),
  石柱土家族自治县: sealEthnic({ 土家族: 55, 汉族: 44, 苗族: 0.6 }),
  秀山土家族苗族自治县: sealEthnic({ 土家族: 48, 苗族: 28, 汉族: 23 }),
  酉阳土家族苗族自治县: sealEthnic({ 土家族: 55, 苗族: 22, 汉族: 22 }),
  彭水苗族土家族自治县: sealEthnic({ 苗族: 42, 土家族: 28, 汉族: 29 }),
  黔江区: sealEthnic({ 汉族: 55, 土家族: 32, 苗族: 12 }),
};

function mergeBoost(target, source) {
  if (!source) return;
  for (const [city, weights] of Object.entries(source)) {
    target[city] = { ...(target[city] ?? {}), ...weights };
  }
}

export function writeCityFiles(root, surnameRecords) {
  const outDir = join(root, "public/data/cities");
  mkdirSync(outDir, { recursive: true });
  const index = {};
  for (const [province, adcode] of Object.entries(ADCODE)) {
    const geo = JSON.parse(readFileSync(join(root, `public/geo/cities/${adcode}.json`), "utf8"));
    const cities = geo.features.map((feature) => feature.properties?.name).filter(Boolean);
    if (cities.length < 2) throw new Error(`${province} 地级单位过少`);
    const boosts = {};
    mergeBoost(boosts, CITY_BOOST[province]);
    const surnameShares = {};
    for (const record of surnameRecords) {
      const base = record.shares[province] ?? 0;
      const modifiers = cities.map((city) => boosts[city]?.[record.name] ?? 1);
      const varied = modifiers.some((value) => Math.abs(value - 1) > 0.02);
      if (!varied) continue;
      const mean = modifiers.reduce((sum, value) => sum + value, 0) / modifiers.length;
      surnameShares[record.name] = modifiers.map((value) => roundShare((base * value) / mean));
    }
    const ethnicity = {};
    for (const city of cities) {
      if (ETHNIC_CITY[city]) ethnicity[city] = ETHNIC_CITY[city];
    }
    const file = {
      meta: {
        label: "示意/整理数据",
        note: "地级比例按省内已知格局整理。没有单独抬高的姓氏，各地与全省示意比例相同，不另外制造聚集点。民族只在自治地方和格局清楚的城市单列，其余沿用全省示意。",
      },
      province,
      adcode,
      cities,
      surnameShares,
      ethnicity,
    };
    writeFileSync(join(outDir, `${province}.json`), JSON.stringify(file));
    index[province] = { adcode, cities, variedSurnames: Object.keys(surnameShares).length, ethnicCities: Object.keys(ethnicity).length };
  }
  writeFileSync(join(root, "public/data/city-index.json"), `${JSON.stringify({ label: "示意/整理数据", provinces: index }, null, 2)}\n`);
  return index;
}

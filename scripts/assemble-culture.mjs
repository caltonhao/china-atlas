import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { provinces } from "./culture/provinces.mjs";
import { cities as north } from "./culture/cities-north.mjs";
import { cities as east } from "./culture/cities-east.mjs";
import { cities as south } from "./culture/cities-south.mjs";
import { cities as west } from "./culture/cities-west.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cities = { ...north, ...east, ...south, ...west };

const file = {
  meta: {
    label: "整理介绍",
    note: "习俗、景点和特色据公开的地方常识汇编，便于浏览，不是官方旅游名录、非遗名录或文旅申报材料。",
  },
  provinces,
  cities,
};

writeFileSync(join(root, "data/culture.json"), `${JSON.stringify(file, null, 2)}\n`);
console.log(`provinces ${Object.keys(provinces).length}, city groups ${Object.keys(cities).length}`);

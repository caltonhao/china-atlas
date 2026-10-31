# 中国姓氏与民族图鉴

省级交互地图，可下钻到地级：查看常见姓氏份额与主要民族构成，也可按姓氏或民族搜索，并按当前地图层级的聚集程度高亮。

站点是静态页面。姓氏和民族比例都是**示意/整理数据**，依据公开的人口普查摘要、常见姓氏排行和众所周知的区域分布格局整理，不是官方微观数据。

线上地址：<https://caltonhao.github.io/china-atlas/>

## 本地运行

需要 Node.js 22（或 20+）。

```bash
npm install
npm run dev
```

开发服务器使用 Vite 的 `base: '/china-atlas/'`。请打开：

<http://localhost:5173/china-atlas/>

## 生产构建

```bash
npm run build
npm run preview
```

构建产物在 `dist/`。预览地址同样带 `/china-atlas/` 前缀，例如 <http://localhost:4173/china-atlas/>。

`vite.config.ts` 里的 `base` 必须保持为 `/china-atlas/`，否则 GitHub 项目 Pages 下的脚本和底图路径会错。

## GitHub Pages

推送到 `main` 后，`.github/workflows/pages.yml` 会执行 `npm ci` 与 `npm run build`，并用官方的 `actions/upload-pages-artifact` 与 `actions/deploy-pages` 发布 `dist/`。

仓库 Pages 来源需设为 **GitHub Actions**。部署完成后打开 <https://caltonhao.github.io/china-atlas/>。

## 数据

- `data/surnames.json`：400 个常见姓在内地 31 个省级单位的示意比例。前一百姓沿用公开排行量级，其余按公开「四百大姓」顺序延伸；只有格局清楚的姓才拉开地区差距。
- `data/ethnicities.json`：主要民族的省级示意比例。
- `public/data/cities/`：下钻后的地级示意。没有单独抬高的姓氏与全省比例相同。
- 香港、澳门、台湾出现在地图上，但没有同口径数据，页面会显示暂无，也不能下钻。

重新生成数据：

```bash
npm run generate-data
```

生成脚本在 `scripts/generate-data.mjs`。`npm run build` 会先跑 `scripts/validate-data.mjs`，检查省份覆盖和若干众所周知的区域格局是否还在。

## 地图底图

边界来自阿里云 DataV GeoAtlas 公开数据。全国底图是 `100000_full.json`，下钻使用各省 `{adcode}_full.json`（地级市、自治州、地区、盟；直辖市为市辖区；海南含省直辖县）。文件在 `public/geo/`。

## 技术栈

Vite、TypeScript、ECharts。页面文案为简体中文，并按窄屏折成单列。

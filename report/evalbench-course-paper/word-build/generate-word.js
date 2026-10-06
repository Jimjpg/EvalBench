// EvalBench 课程论文 Word 版生成脚本（docx-js）
// 输入：../assets/*.png、./appendix_b.json
// 输出：../EvalBench课程论文.docx
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun,
  Footer, AlignmentType, LevelFormat, HeadingLevel, BorderStyle, WidthType,
  ShadingType, VerticalAlign, PageNumber, PageBreak, TableLayoutType, TableOfContents,
} = require("docx");

const ASSETS = path.resolve(__dirname, "..", "assets");
const OUT = path.resolve(__dirname, "..", "EvalBench课程论文.docx");
const APPENDIX_B = JSON.parse(fs.readFileSync(path.join(__dirname, "appendix_b.json"), "utf-8"));

// ---------- 字体与版面 ----------
const F_SONG = { ascii: "Times New Roman", hAnsi: "Times New Roman", eastAsia: "SimSun" };
const F_HEI = { ascii: "Times New Roman", hAnsi: "Times New Roman", eastAsia: "SimHei" };
const F_MONO = { ascii: "Consolas", hAnsi: "Consolas", eastAsia: "SimSun" };
const CONTENT_W = 8312; // A4 11906 - 2*1797

// ---------- 行内标记解析：**粗体**、((n)) 上标引文、`代码` ----------
function parseRuns(text, base) {
  const b = base || {};
  const runs = [];
  const push = (t, extra) => runs.push(new TextRun(Object.assign({}, b, extra, { text: t })));
  text.split("**").forEach((seg, i) => {
    const bold = (i % 2 === 1) || b.bold;
    seg.split(/(\(\(\d+(?:,\d+)*\)\))/).forEach((cp) => {
      if (!cp) return;
      const m = cp.match(/^\(\((\d+(?:,\d+)*)\)\)$/);
      if (m) { push("[" + m[1] + "]", { superScript: true, bold: bold }); return; }
      cp.split(/(`[^`]+`)/).forEach((kp) => {
        if (!kp) return;
        if (kp.length > 2 && kp.charAt(0) === "`" && kp.charAt(kp.length - 1) === "`") {
          push(kp.slice(1, -1), { font: F_MONO, bold: bold });
        } else {
          let firstLine = true;
          kp.split("\n").forEach((lp) => {
            push(lp, { bold: bold, break: firstLine ? undefined : 1 });
            firstLine = false;
          });
        }
      });
    });
  });
  return runs;
}

// ---------- 段落助手 ----------
function p(text, opts) {
  const o = opts || {};
  return new Paragraph({
    children: parseRuns(text, o.run),
    alignment: o.align,
    spacing: { line: 360, lineRule: "auto", before: o.before || 0, after: o.after || 0 },
    indent: o.noIndent ? undefined : { firstLine: 480 },
    keepNext: o.keepNext,
    pageBreakBefore: o.pageBreakBefore,
  });
}

function h1(text, opts) {
  const o = opts || {};
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    pageBreakBefore: o.pageBreak !== false,
    children: [new TextRun({ text: text })],
  });
}
function h2(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: text })] });
}
function h3(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun({ text: text })] });
}

function bullets(items) {
  return items.map((t) => new Paragraph({
    numbering: { reference: "bullets", level: 0 },
    spacing: { line: 360, lineRule: "auto" },
    children: parseRuns(t),
  }));
}
function numbered(ref, items) {
  return items.map((t) => new Paragraph({
    numbering: { reference: ref, level: 0 },
    spacing: { line: 360, lineRule: "auto" },
    children: parseRuns(t),
  }));
}

// ---------- 表格 ----------
const TB = { style: BorderStyle.SINGLE, size: 4, color: "8A97A8" };
const TBORDERS = { top: TB, bottom: TB, left: TB, right: TB };

function tcell(spec, w, opts) {
  const o = opts || {};
  const isObj = typeof spec === "object" && spec !== null;
  const text = isObj ? spec.text : spec;
  const bold = (isObj && spec.bold) || o.header;
  const align = (isObj && spec.align) || o.align || "l";
  const alignment = align === "r" ? AlignmentType.RIGHT : (align === "c" ? AlignmentType.CENTER : AlignmentType.LEFT);
  return new TableCell({
    borders: TBORDERS,
    width: { size: w, type: WidthType.DXA },
    margins: { top: 40, bottom: 40, left: 80, right: 80 },
    verticalAlign: VerticalAlign.CENTER,
    rowSpan: isObj ? spec.rowSpan : undefined,
    shading: o.header ? { fill: "DEE7F2", type: ShadingType.CLEAR } : undefined,
    children: [new Paragraph({
      alignment: alignment,
      spacing: { line: 260, lineRule: "auto" },
      children: parseRuns(text, { size: o.size || 18, bold: bold }),
    })],
  });
}

function makeTable(headers, rows, widths, opts) {
  const o = opts || {};
  const size = o.size || 18;
  const headerRow = new TableRow({
    cantSplit: true, tableHeader: true,
    children: headers.map((hd, i) => tcell(hd, widths[i], { header: true, size: size, align: (o.aligns && o.aligns[i]) || "c" })),
  });
  const bodyRows = rows.map((r) => {
    const cells = [];
    r.forEach((c, idx) => {
      if (c === null || c === undefined || c === "") return;
      cells.push(tcell(c, widths[idx], { size: size, align: o.aligns && o.aligns[idx] }));
    });
    return new TableRow({ cantSplit: true, children: cells });
  });
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    rows: [headerRow].concat(bodyRows),
  });
}

function tcap(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    keepNext: true,
    spacing: { before: 160, after: 80, line: 300, lineRule: "auto" },
    children: parseRuns(text, { size: 21, bold: true }),
  });
}

// ---------- 图 ----------
function figure(file, capText, w, h) {
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER, keepNext: true,
      spacing: { before: 160, after: 40 },
      children: [new ImageRun({
        type: "png",
        data: fs.readFileSync(path.join(ASSETS, file)),
        transformation: { width: w, height: h },
        altText: { title: capText, description: capText, name: file },
      })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 160, line: 300, lineRule: "auto" },
      children: parseRuns(capText, { size: 21, bold: true }),
    }),
  ];
}

// ---------- 代码块 ----------
function codeBlock(lines) {
  return lines.map((ln, i) => new Paragraph({
    spacing: { line: 240, lineRule: "auto", before: i === 0 ? 80 : 0, after: i === lines.length - 1 ? 120 : 0 },
    shading: { type: ShadingType.CLEAR, fill: "F2F4F7" },
    indent: { left: 240, right: 240 },
    children: [new TextRun({ text: ln.length ? ln : " ", font: F_MONO, size: 18 })],
  }));
}

// ---------- 提示框 ----------
const CB = { style: BorderStyle.SINGLE, size: 6, color: "0969DA" };
function callout(title, text) {
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [CONTENT_W],
    layout: TableLayoutType.FIXED,
    borders: { top: CB, bottom: CB, left: CB, right: CB },
    rows: [new TableRow({
      cantSplit: true,
      children: [new TableCell({
        width: { size: CONTENT_W, type: WidthType.DXA },
        borders: { top: CB, bottom: CB, left: CB, right: CB },
        shading: { fill: "F5F8FC", type: ShadingType.CLEAR },
        margins: { top: 120, bottom: 120, left: 200, right: 200 },
        children: [
          new Paragraph({
            spacing: { line: 320, lineRule: "auto", after: 60 },
            children: [new TextRun({ text: title, bold: true, size: 22, font: F_HEI })],
          }),
          new Paragraph({ spacing: { line: 320, lineRule: "auto" }, children: parseRuns(text) }),
        ],
      })],
    })],
  });
}

// ---------- 公式行 ----------
function formula(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 60, after: 60, line: 320, lineRule: "auto" },
    children: parseRuns(text, { size: 24 }),
  });
}

// ---------- 参考文献条目 ----------
function ref(text) {
  return new Paragraph({
    spacing: { line: 320, lineRule: "auto", after: 60 },
    indent: { left: 480, hanging: 480 },
    children: parseRuns(text, { size: 21 }),
  });
}

// ================================================================
// 内容
// ================================================================
const content = [];

// ---------- 封面 ----------
content.push(
  new Paragraph({ spacing: { before: 2600, line: 360, lineRule: "auto" }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: "《优化理论方法》课程大作业", font: F_HEI, size: 32 })] }),
  new Paragraph({ spacing: { before: 1400, line: 360, lineRule: "auto" }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: "成本受控、可复现的 LLM 与 OR 评测体系", font: F_HEI, size: 44, bold: true })] }),
  new Paragraph({ spacing: { before: 240, line: 360, lineRule: "auto" }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: "——EvalBench 的设计、实现与实证", font: F_HEI, size: 32, bold: true })] }),
  new Paragraph({ spacing: { before: 1800, line: 360, lineRule: "auto" }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: "研究方向五　成本受控、可复现的 LLM 与 OR 评测体系", font: F_SONG, size: 28 })] }),
  new Paragraph({ spacing: { before: 1600, line: 400, lineRule: "auto" }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: "作　　者：李万叶", font: F_SONG, size: 28 })] }),
  new Paragraph({ spacing: { line: 400, lineRule: "auto" }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: "完成日期：2026 年 10 月 6 日", font: F_SONG, size: 28 })] }),
  new Paragraph({ spacing: { before: 2200, line: 360, lineRule: "auto" }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: "实验规模：360 runs（主实验 90 + 稳定性实验 270）", font: F_SONG, size: 24 })] }),
  new Paragraph({ spacing: { line: 360, lineRule: "auto" }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: "API 总成本：账单实测 ¥2.59（牌价折算 ¥4.36；预算熔断线 ¥50，未触达）", font: F_SONG, size: 24 })] }),
  new Paragraph({ spacing: { line: 360, lineRule: "auto" }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: "代码版本：v0.1-smoke 锚点之后 12 commits，40 个单元测试全绿", font: F_SONG, size: 24 })] }),
  new Paragraph({ spacing: { line: 360, lineRule: "auto" }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: "关键发现：可行率规模断崖（H1）· 约束违背占失败 93%（H2）· 性价比假设证伪（H4）", font: F_SONG, size: 24 })] }),
  new Paragraph({ children: [new PageBreak()] })
);

// ---------- 目录 ----------
content.push(
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 240, after: 240, line: 360, lineRule: "auto" },
    children: [new TextRun({ text: "目　\ufeff录", font: F_HEI, size: 32, bold: true })],
  }),
  new TableOfContents("TOC", { hyperlink: true, headingStyleRange: "1-2" })
);

// ---------- 摘要 ----------
content.push(h1("摘　要"));
content.push(p("大语言模型（LLM）与运筹优化（OR）的结合正在快速发展，但领域评测实践存在系统性缺陷：指标口径不统一、成本维度缺失、可复现协议不完整、失败模式仅有定性描述、稳定性几乎无人报告。本工作面向“成本受控、可复现的 LLM 与 OR 评测体系”这一选题，完成了从文献分析、体系设计、原型实现到实验实证的完整闭环。主要贡献包括：（1）基于六篇代表性文献的精读，构建 5 基准 × 8 维度能力矩阵，提炼出六条领域缺陷 D1–D6；（2）设计并实现评测系统 EvalBench——统一多维指标（primal gap / quality / QYI / stability_cv / 五列成本计量）、三重预算控制器（调用次数 / token 总量 / 墙钟时间）、审计式可复现协议（YAML 配置快照 + git 哈希 + 提示词版本化 + 全量 transcript 落盘）、F1–F6 失败模式自动分类；（3）以 TDD 开发全部核心模块（40 个测试全部通过）；（4）在 2 模型 × 3 问题 × 3 规模上完成主实验（90 runs）与稳定性实验（270 runs），按预登记假设组织统计检验。"));
content.push(p("关键实证发现：可行率随规模断崖式下降（如 qwen-plus 调度问题从 100% 跌至 0%，Fisher 精确检验 p = 1.5×10⁻¹¹）；约束违背 F2 占全部失败的 93%（二项检验 p = 5.2×10⁻⁹）；预登记的“两模型 QYI 接近但性价比差异 ≥2 倍”假设被证伪——实际 QYI 差 0.132，牌价口径性价比比仅 1.45，账单口径下（两模型实际支出几乎持平：¥1.30 vs ¥1.29）比值进一步跌至 0.67、方向反转；经典启发式基线（NN+2-opt / FFD / LPT）以零 API 成本全面优于两个 LLM 的直接求解。全部实验的账单实测总成本 ¥2.59（deepseek ¥1.30 + qwen ¥1.29），仅为 ¥20 预算估算的约 1/8，验证了成本受控设计的有效性。"));
content.push(p("**关键词：**大语言模型；运筹优化；评测体系；成本控制；可复现性；失败模式分类；组合优化", { noIndent: true }));

// ---------- 1 引言 ----------
content.push(h1("1　引言"));
content.push(h2("1.1　研究背景"));
content.push(p("大语言模型正在被系统性引入运筹优化领域：从自然语言建模优化问题（NL4Opt）、生成启发式算法（FunSearch、EOH、ReEvo），到直接作为求解智能体输出组合优化问题的解。Ros 等人对 103 篇文献的 PRISMA 系统综述表明，该方向在 2022—2024 年间呈爆发式增长，路由、调度、装箱等经典 OR 问题均有 LLM 应用的尝试((6))。与此同时，一系列评测基准（CO-Bench、HeuriGym、FrontierCO、DynaSchedBench）相继提出，试图回答“LLM 在 OR 问题上的能力边界在哪里”。"));
content.push(p("然而，当把视角从“LLM 能力有多强”转向“评测本身是否可信”时，领域暴露出系统性问题。Ros 综述记录的乱象包括：103 篇研究动用 70 个 LLM 且命名混乱、7 篇完全不写用了什么模型、提示词普遍不公开、chat 补全接口的非确定性无人讨论((6))。更结构性的缺陷在于：几乎所有基准把“成本”当作事后统计量而非事前控制变量，把“失败”当作散文式轶事而非可统计编码，把“稳定性”留给读者想象。这意味着文献中报告的“进步”既无法归因、也无法复现，更无法回答实践者最关心的问题：**给定预算与锁定协议，模型的能力—成本曲线长什么样？失败以什么模式发生？**"));
content.push(h2("1.2　研究问题与选题定位"));
content.push(p("本作业选择课程方向五“成本受控、可复现的 LLM 与 OR 评测体系”。区别于“再做一个更大的基准”（CO-Bench 36 类问题 6,482 实例((1))、FrontierCO 百万节点级实例((3))沿“问题覆盖 × 规模”军备竞赛路线），本工作刻意反向取舍：**以三个可确定性机器验证的经典问题（TSP、一维装箱、平行机调度）为载体，把评测的深度做在“成本受控”与“可复现”两个被领域系统性忽视的维度上**。四大基准回答“LLM 能力边界在哪”，EvalBench 回答“给定预算与锁定协议，能力—成本关系与失败结构长什么样”。"));
content.push(h2("1.3　工作概览与贡献"));
content.push(p("本工作按“文献分析 → 体系设计 → 原型实现 → 实验实证”四阶段推进，全部产物（文献笔记、设计文档、代码、实验数据、本报告）随 git 仓库版本化。主要贡献可概括为四点："));
content.push(...bullets([
  "**C1 领域缺陷清单**：精读六篇代表性文献（四篇 OR 评测基准、一篇系统综述、一篇方法论迁移文献），构建 5 基准 × 8 维度能力矩阵，提炼六条领域缺陷 D1–D6，为设计提供逐条对应的文献依据（第 2 章）。",
  "**C2 评测体系设计**：统一多维指标体系（含稳定性这一被全矩阵忽视的维度）、三重预算控制器、审计式可复现协议、F1–F6 失败模式分类法——每项设计均明确对应一条缺陷的对策（第 3 章）。",
  "**C3 原型实现**：Python 评测系统 EvalBench，测试驱动开发，40 个单元测试全绿；工程过程中发现并修复计划代码中的两处真实缺陷（第 4 章）。",
  "**C4 实证与假设检验**：主实验 + 稳定性实验共 360 次运行、账单实测总成本 ¥2.59（牌价折算 ¥4.36）；按预登记假设组织统计检验，其中一条预登记假设被数据证伪——这本身是预注册方法价值的直接证据（第 5 章）。",
]));

// ---------- 2 相关工作 ----------
content.push(h1("2　相关工作与领域缺陷分析"));
content.push(h2("2.1　六篇文献概览"));
content.push(p("本节基于六篇文献的结构化精读笔记。四篇为 2025—2026 年的 LLM×OR 评测基准（CO-Bench、HeuriGym、FrontierCO、DynaSchedBench），一篇为领域首篇 PRISMA 系统综述（Ros 等），一篇为软件工程领域的方法论迁移参考（FuzzGPT——其“用历史失败样本做种子引导困难输入生成”的方法可迁移到 OR 评测的困难实例生成）。表 1 汇总六篇文献的定位与评测要素，随后对各篇做要点展开。"));
content.push(tcap("表 1　六篇文献概览（详细笔记见仓库 notes/ 目录）"));
content.push(makeTable(
  ["文献", "发表", "定位与规模", "质量指标", "成本维度", "可复现性", "失败分析"],
  [
    [{ text: "**CO-Bench**((1))", align: "l" }, "arXiv 2025", "36 类 CO 问题、6,482 实例；评测 LLM agent 搜索**算法**的能力", "AvgScore（min/max 比值）+ BTScore、Above Human", "✗ 不记 token/费用", "△ 代码数据公开，未锁种子与提示词", "△ 定性 5 条"],
    [{ text: "**HeuriGym**((2))", align: "l" }, "ICLR 2026", "9 个 CO 问题、218 实例；评测 LLM 生成**启发式程序**的能力", "QUALITY 截断比 + **QYI 调和平均** + SOLVE 三阶段", "✓ token 全记录 + 价格表 + 成本散点图，但**无预算闸门**", "✓ API 快照锁定、提示词全文公开", "✓ 四分类 + 六类异常"],
    [{ text: "**FrontierCO**((3))", align: "l" }, "ICLR 2026", "8 个 CO 问题、约 300+ 实例；**真实世界与极端规模**（TSP 至千万城市）", "**primal gap**（严格有界 [0,1]）", "✗ 无 token 量化", "△ 基线锁定，但底座模型版本未披露", "△ 定性观察（高方差、OOM）"],
    [{ text: "**DynaSchedBench**((4))", align: "l" }, "ICML 2026", "动态柔性作业车间调度单域；难度校准的实例生成（SESC/SSI）", "归一化 makespan（含 p50/p90）", "✓ token 一等指标，但**无预算上限**", "✓ 快照仿真 + 5 种子 + 温度 0", "△ 机理级个案条目"],
    [{ text: "**Ros 等综述**((6))", align: "l" }, "ACM CSUR 2025", "103 篇 PRISMA 系统综述；领域乱象与开放问题的权威清单", "附录罗列大量异构指标", "✗ 无 per-study 成本字段", "—（记录他人不可复现）", "—"],
    [{ text: "**FuzzGPT**((5))", align: "l" }, "ICSE 2024", "（迁移文献）DL 库模糊测试；历史失败做种子引导困难输入生成", "—", "—", "—", "✓ 失败样本系统再利用"],
  ],
  [1050, 900, 2050, 1550, 950, 1000, 812],
  { aligns: ["l", "l", "l", "l", "l", "l", "l"] }
));
content.push(p("CO-Bench((1)) 是首个面向“LLM 智能体搜索组合优化算法”的大规模基准，覆盖 36 类 CO 问题、6,482 个实例，横跨从课程作业级到竞赛级的难度谱系。其指标体系采用 min/max 比值形式的 AvgScore，辅以 BTScore 与 Above Human 等相对人类基线的刻画；失败分析停留在 5 条定性观察（如“难以保证解的可行性”）。CO-Bench 不记录 token 消耗与费用，代码与数据公开但未锁定种子与提示词版本。它的价值在于把“算法搜索”确立为 LLM×OR 的一种被测对象，而其指标口径的缺陷（比值在目标值符号相反时失真）正是本工作 D1 的文献证据之一。"));
content.push(p("HeuriGym((2))（ICLR 2026）把被测对象换成“LLM 生成的启发式程序”，覆盖 9 个 CO 问题、218 个实例，提出 QUALITY 截断比、QYI 调和平均与 SOLVE 三阶段评测协议。它是四个基准中评测工程最完整的一家：token 全记录、附价格表与成本—质量散点图，API 快照锁定、提示词全文公开，失败按四分类加六类异常整理。EvalBench 的指标层直接继承其 QYI 设计，成本计量沿用其价格表口径。但 HeuriGym 的成本仍是事后统计——没有预算上限，更没有预算档位实验，这是本工作 D2 的核心证据。"));
content.push(p("FrontierCO((3))（ICLR 2026）聚焦真实世界与极端规模：8 个 CO 问题、约 300+ 实例，TSP 达千万城市量级。其质量指标 primal gap 严格有界 [0,1]、对目标值符号异常免疫，是本工作直接采用的口径（渊源可追溯至 Berthold 2006/2013）。该基准观察到 FunSearch 在 TSP-hard 上的跨实例方差高达 ±25.62%、MDS-hard 上神经方法 gap 全为 100%——区分度坍塌使其报告更多反映“能否产出可行解”而非解质量梯度。其基线锁定但底座模型版本未披露，也无 token 量化。"));
content.push(p("DynaSchedBench((4))（ICML 2026）是单域（动态柔性作业车间调度）深度基准，特色是难度校准的实例生成（SESC/SSI 指标），把“难度”变成受控变量；token 消耗被升为一等指标（L1+Tool 12.6M vs L1 CoT 4.0M，三倍成本未见收益），快照仿真 + 5 种子 + 温度 0 的协议是该领域最接近可复现标准的实践。其核心发现是“可观测性悖论”：全部 LLM 聚集在强启发式的窄性能带内，充当“稳健的安全近似器”而非超越者。EvalBench“把预算变成受控变量”的设计直接受其“把难度变成受控变量”的启发。"));
content.push(p("Ros 等人的 PRISMA 系统综述((6))（ACM CSUR 2025）覆盖 103 篇文献，是领域乱象的权威清单：70 个 LLM 命名混乱、7 篇不写模型、提示词普遍不公开、输出非确定性无人讨论；数据集两极失衡——多数自产数据集仅被 1 篇使用且往往就是提出者本人。综述把“开发标准化评测协议与识别合适指标”列为领域公开问题。本工作六条缺陷清单 D1–D6 中，D1、D3、D6 的文献证据直接来自该综述。"));
content.push(p("FuzzGPT((5))（ICSE 2024）来自软件工程领域，是本工作的方法论迁移参考：其核心思想是用历史失败样本做种子，引导 LLM 生成同分布的困难输入（对 DL 库 API 做模糊测试）。两点对本工作有直接影响：其一，其主力模型 Codex 已被弃用，主结果无法严格复现——跨领域实证了“不锁定模型版本”的后果（D3 证据）；其二，其“失败样本系统再利用”的方法论可迁移到 OR 评测的困难实例生成，已列入本工作的后续工作（6.5 节）。"));
content.push(h2("2.2　能力矩阵与六条缺陷"));
content.push(p("将四篇基准沿八个评测维度（问题覆盖、实例规模、质量指标、可行性指标、成本记录、预算控制、可复现协议、失败模式分析）逐格对照，得到一个清晰的格局：领域沿“问题覆盖 × 规模”方向军备竞赛，而在成本与失败两个维度系统性薄弱——CO-Bench 与 FrontierCO 完全不记 token，HeuriGym 与 DynaSchedBench 记录了 token 却都无预算上限；四家的失败分析至多是“分类列表 + 异常日志”，无一家与预算或规模交叉统计。由此提炼六条缺陷，每条均有明确文献证据："));
content.push(...bullets([
  "**D1 指标口径不统一**：CO-Bench 的 min/max 比值在目标值符号相反时失真（h=−5、h*=3 得 0.6，明显高估）；路由文献惯用 gap 可超 100%；FrontierCO 的有界 primal gap 与前两者不可换算。Ros 综述明言“开发标准化评测协议与识别合适指标”是领域公开问题((6))。",
  "**D2 成本维度缺失或浅表**：成本在整个领域至多是事后统计量，没有任何基准设预算上限、更没有预算档位实验。HeuriGym 画了成本—质量散点图但无熔断机制；DynaSchedBench 把 token 升为一等指标（L1+Tool 12.6M vs L1 CoT 4.0M，三倍成本未见收益）但同样不设上限((2))((4))。",
  "**D3 可复现协议不完整**：模型版本不锁定（Ros 综述期间多款模型已弃用；FunSearch/ReEvo 底座模型未披露）、提示词不透明、输出非确定性三重叠加。FuzzGPT 主力模型 Codex 已被弃用致主结果无法严格复现，跨领域实证了不锁定版本的后果((3))((5))。HeuriGym 的 API 快照锁定是领域最佳实践((2))。",
  "**D4 失败模式只有定性描述**：CO-Bench 归纳 5 条（如“struggle to ensure the feasibility of solutions”）；FrontierCO 报告高方差与 OOM 但无编码；做得最完整的 HeuriGym 也未与成本或预算关联((1))((3))。",
  "**D5 稳定性几乎无人报告**：四基准均为单次运行；FrontierCO 观察到 FunSearch TSP-hard 方差 ±25.62%，但其标准差来自跨实例而非重复；最接近的 DynaSchedBench 每配置 5 种子控制的也只是实例生成侧随机性((3))((4))。",
  "**D6 基准规模两极失衡**：一端是 10—100 条目的 toy 数据集自产自销（Ros 综述：多数数据集仅被 1 篇使用且往往就是提出者）；另一端是千万节点级实例上区分度坍塌（FrontierCO：MDS-hard 上神经方法 gap 全 100%，“大量 gap=1 的记录更多反映能否产出可行解而非解质量梯度”）((3))((6))。",
]));
content.push(callout("能力矩阵的取舍逻辑",
  "EvalBench 在规模上以三个数量级以上的差距小于 CO-Bench / FrontierCO（3 问题 3 规模 45 实例 vs 6,482 实例 / 千万节点），用“成本受控 + 可复现”的深度换问题广度。这一取舍显式回应 D6：规模档（TSP n=10/50/200 等）选在“可确定性机器验证、中小规模、有质量梯度”的中间地带，全部可行性由组合性质精确判定，不依赖大规模参考求解器。"));

// ---------- 3 体系设计 ----------
content.push(h1("3　EvalBench 评测体系设计"));
content.push(h2("3.1　设计原则与总体架构"));
content.push(p("EvalBench 的智能体循环为“生成 → 解析 → 验证 → 反馈”四步，每次运行受三重预算约束，全过程落盘。四个环节的职责如下："));
content.push(...numbered("steps", [
  "**生成**：题面由 `problems/*.py` 的 `prompt()` 方法渲染——问题定义、输入数据、输出格式约束一次性给出；提示词固化在代码中，随 git 哈希版本化（见 3.4 节）。",
  "**解析**：对模型输出做容错提取，支持 markdown 代码围栏与前后缀噪声；提取失败即计为 F1（解析失败）。",
  "**验证**：验证器逐约束检查——TSP 的城市数、整数性、越界、不重不漏；装箱的物品全覆盖、不重复、容量；调度的指派长度、整数性、机器编号——并输出结构化违规描述。",
  "**反馈**：违规描述作为反馈注入下一轮对话，至多迭代 `max_iters=5` 轮，直至可行或触发迭代/预算上限。",
]));
content.push(p("设计遵循三条原则：**每个指标有精确公式与文献出处**（对策 D1）、**预算是事前硬约束而非事后统计**（对策 D2）、**配置 + 日志全留存的审计式可复现**（对策 D3）。三条原则分别落在指标层、成本层、协议层，共同约束本章四项子系统设计。"));
content.push(h2("3.2　指标体系（对策 D1、D5）"));
content.push(p("指标层直接收编两家精华：FrontierCO 的 primal gap 双分支公式（严格有界、符号异常防护）+ HeuriGym 的 QYI 调和平均（强惩罚质量—可行率失衡），并补上全矩阵无人作为一等指标报告的稳定性。每个指标执行五要素定义——名称、精确公式、取值范围、采集列、文献出处——并以 TDD 锁死在代码里。指标总表见表 2。"));
content.push(tcap("表 2　EvalBench 指标总表（summary.csv 共 18 列，此处列 8 个核心指标）"));
content.push(makeTable(
  ["指标", "精确公式", "范围", "出处"],
  [
    [{ text: "**primal_gap**", align: "l" }, "cost 为 None/非有限或 cost·ref<0 时取 1；否则 |cost−ref| / max{|cost|,|ref|}", "[0,1]，不可行=1", "FrontierCO 式 2（渊源 Berthold 2006/2013）"],
    [{ text: "**quality**", align: "l" }, "cost 为 None 或 ≤0 时取 0；否则 clip(ref/cost, 0, 1)", "[0,1]", "HeuriGym QUALITY 截断比"],
    [{ text: "**QYI**", align: "l" }, "2·q·y/(q+y)，q=组内 quality 均值，y=组内可行率", "[0,1]", "HeuriGym（类比 F-score）"],
    [{ text: "**tokens_in/out、calls/seconds**", align: "l" }, "逐轮 API usage 求和 / Budget 计数与墙钟", "≥0", "HeuriGym Table 24；DynaSchedBench"],
    [{ text: "**api_cost**", align: "l" }, "Σ [tokens_in/10⁶×p_in + tokens_out/10⁶×p_out]，价格表带核对日期", "≥0 元", "HeuriGym Table 6"],
    [{ text: "**stability_cv**", align: "l" }, "pstdev/mean（同实例 k 次重复的 primal_gap 序列）", "[0,∞)，完美稳定=0", "本工作提出（对策 D5）"],
    [{ text: "**failure_class**", align: "l" }, "F1–F6 自动编码，优先级 F5>F1>F3>F4>F2>F6", "{F1…F6, 无}", "扩展 HeuriGym 四分类（对策 D4）"],
  ],
  [1750, 3350, 1300, 1912],
  { aligns: ["l", "l", "l", "l"] }
));
content.push(p("核心指标的公式展开如下："));
content.push(formula("primal_gap(cost, ref) = 1，若 cost 为 None / 非有限，或 cost·ref < 0"));
content.push(formula("primal_gap(cost, ref) = |cost − ref| / max{|cost|, |ref|}，其余情形"));
content.push(formula("quality = clip(ref / cost, 0, 1)（cost 为 None 或 ≤ 0 时取 0）"));
content.push(formula("QYI = 2qy / (q + y)，q 为组内 quality 均值，y 为组内可行率"));
content.push(formula("stability_cv = pstdev(gap₁, …, gap_k) / mean(gap₁, …, gap_k)，同实例 k 次重复"));
content.push(formula("api_cost = Σ [ tokens_in/10⁶ × p_in + tokens_out/10⁶ × p_out ]"));
content.push(p("三个设计决策值得论证。**其一，primal_gap 与 quality 双指标并存**：前者严格有界且满足“不可行解永不优于可行解”的评测公理，后者语义自解释（0.8 = 花了参考 1.25 倍的成本）；两者由同一 (cost, reference) 对计算、零额外采集成本，在“参考解非严格最优”的现实下互补。**其二，QYI 用调和平均**：算术平均在 q=1.0、y=0.1 时得 0.55（看似过半），调和平均得 0.18（暴露“解得好但十次九次不可行”）——评测要回答的恰恰是模型均衡还是偏科。**其三，stability_cv 用变异系数而非标准差**：同样 σ=0.05 在 μ=0.1 的组是 50% 相对波动、在 μ=0.8 的组只有 6%，CV 无量纲、跨组可比。"));
content.push(p("**参考解口径**：所有 reference 由本地确定性求解器计算并缓存（references.json）。三问题的 small 档全部落在精确分支（TSP n≤10 全排列枚举；装箱 ≤25 项 CP-SAT；调度 ≤25 作业 CP-SAT），medium/large 档为启发式或限时搜索（TSP 用 OR-Tools 路由求解器 GUIDED_LOCAL_SEARCH 30 秒；装箱 >25 项用 FFD 上界；调度 >25 作业用 LPT）。因此全部 gap/quality 读作“相对 OR-Tools 30 秒口径参考解”，不读作“相对真最优”——口径诚实声明写入协议文档。"));
content.push(h2("3.3　成本受控机制（对策 D2）"));
content.push(p("预算控制分三层。**运行级**：三重预算控制器 `Budget(max_calls=10, max_tokens=60000, max_seconds=600)` 随每次求解构造、每轮迭代先检查再调用；任一闸门触发即抛出 `BudgetExhausted` 异常，运行**正常收尾**并计为失败类 F5——预算耗尽不是事故而是被编码的实验事件。**项目级**：成本熔断线 ¥50，超出立即中止排查。**机制级双保险**：单运行 token 闸封顶 60K，360 runs 的极端上界约 21.6M tokens，即使全部按较贵的 DeepSeek 单价折算也仅约 ¥86 的理论极限（实际路径远低于此）。"));
content.push(p("成本换算采用带核对日期的价格表（每百万 token，2026 年 10 月核对）：deepseek-chat 输入 ¥2.0 / 输出 ¥8.0；qwen-plus 输入 ¥0.8 / 输出 ¥2.0——qwen-plus 单价约为 deepseek-chat 的 1/3—1/4，这一差异正是 5.5 节性价比假设 H4 的出发点。"));
content.push(p("**账单口径的补充核对**：实验结束后与服务商账单对账发现，两家提供商均未按上述牌价表计费——DeepSeek 账单显示实际计费档位为 deepseek-flash（闲时资费，输入缓存未命中 ¥1/百万、缓存命中 ¥0.02/百万），阿里云账单显示计费档位为 qwen3.8-flash（输入 ¥0.8 / 输出 ¥2.7/百万，缓存命中 ¥0.1/百万），且两平台的上下文缓存机制显著降低了实际支出。全周期账单实测：deepseek ¥1.30（532 次调用、828,396 tokens，与实验记录的 527 次/810,072 tokens 吻合，差额为少量实验外调用）、qwen ¥1.29，合计 **¥2.59**——牌价折算口径（¥4.36）高估了 68%。请求别名（deepseek-chat/qwen-plus）与实际服务计费档位（deepseek-flash/qwen3.8-flash）的**别名漂移**本身构成一个可复现性发现：评测协议仅记录请求侧模型名不足以锁定被测对象，还应记录响应 model 字段与账单计费档位（本工作 transcript 未记录响应侧字段，已列入 6.5 节改进项）。下文所有总量结论以账单实测为准，逐 run 成本分解保留牌价折算口径（预登记口径）并明确标注。"));
content.push(p("与四大基准的本质区别在于：HeuriGym 的成本是“跑了多少”的事后统计，EvalBench 的预算是“最多许跑多少”的事前约束——同预算下的比较才构成公平比较（主实验全部 90 runs 统一 standard 档预算，不随问题难度浮动）。"));
content.push(h2("3.4　可复现协议（对策 D3）"));
content.push(p("协议的核心等式是**“实验 = 目录 + 配置”**：每次运行的 run_id（时间戳 + 随机后缀）对应一个自包含目录，内含四件套："));
content.push(...bullets([
  "`config.yaml`——配置原样快照（模型、问题、规模、实例数、重复数、预算参数）；",
  "`manifest.json`——版本锚：run_id、创建时间、git commit 哈希、prompt_version、system_prompt 全文；",
  "`summary.csv`——18 列结构化结果，每 run 一行（状态、可行性、cost、reference、gap、quality、失败类、token 计量、耗时）；",
  "`transcripts/`——每次 LLM 调用的完整输入输出，含逐轮延迟与 token 计量。",
]));
content.push(p("三层版本锚定：（a）模型与采样参数写入 YAML 快照；（b）提示词不放在配置里，而是**固化在 problems/*.py 的 prompt() 方法中**——“提示词即代码，代码即版本”，一个 git 哈希同时锁定提示词、验证器与反馈话术；（c）依赖随 requirements.txt 版本化。断点续跑机制使“中断恢复”不需要任何额外记账：重启时从既有 summary.csv 重建已完成集合，同配置自动跳过。"));
content.push(p("**诚实性声明**：商用 API 即使固定温度也不承诺逐 token 复现，因此 EvalBench 不宣称位级复现，而承诺**审计式可复现**——任何人可在同一 git 哈希下重建输入、核对 transcript 原文、重算指标；每个数字可追溯到一次具体的 API 调用，但重跑不保证相同数字。输出波动不是被回避的缺陷而是被测量的对象（stability_cv）。把不可消除的随机性升为一等指标、把不可完整锁定的版本做成可审计链条，这本身是对 D3/D5 的方法论回应。"));
content.push(h2("3.5　失败模式分类（对策 D4）"));
content.push(p("HeuriGym 的失败分类对象是**程序执行过程**（其被测智能体输出完整启发式程序，失败以异常类型出现）；EvalBench 的智能体输出**解的 JSON 表示**，失败发生在解的生成过程。两套分类维度不同、互不可替代。F1–F6 定义与判定信号见表 3，全部判定自动、机器可复判。"));
content.push(tcap("表 3　失败模式分类法：定义、代码信号与事前预测频率"));
content.push(makeTable(
  ["类", "名称", "定义", "确定性代码信号", "事前预测"],
  [
    [{ text: "**F1**", align: "c" }, "解析失败", "无法从输出提取规定 JSON", "末轮 parsed == False", "中（大规模升高）"],
    [{ text: "**F2**", align: "c" }, "约束违背", "解结构合法但不满足组合/容量约束（缺失、重复、超容量）", "末轮 violations 非空且不含越界词", "**高（最大类）**"],
    [{ text: "**F3**", align: "c" }, "幻觉", "引用不存在的实体（下标越界）", "violations 含“越界/不存在”", "中（随规模上升）"],
    [{ text: "**F4**", align: "c" }, "搜索停滞", "连续两轮 cost 完全相同", "末两轮 cost 相等且非 None", "低（当前问题族预期 0）"],
    [{ text: "**F5**", align: "c" }, "预算耗尽", "预算闸门先于迭代上限关闸", "捕获 BudgetExhausted 异常", "低—中（集中大规模）"],
    [{ text: "**F6**", align: "c" }, "其他", "以上皆否", "兜底分支（人工复核）", "低"],
  ],
  [550, 950, 2450, 2600, 1762],
  { aligns: ["c", "l", "l", "l", "l"] }
));
content.push(p("判定优先级 F5 > F1 > F3 > F4 > F2 > F6 的排序理由：F5 是唯一来自运行环境而非解内容的信号，若不优先，预算截断会被误归因为模型失败；F1 在一切解层面判定之前（解析失败时解对象不存在）；F3（“世界模型”级错误——引用了解空间外的实体）先于 F2（“搜索推理”级错误），因为两者的对症改进方向不同——F3 指向提示词与格式约束，F2 指向反馈质量与推理能力。"));

// ---------- 4 原型实现 ----------
content.push(h1("4　原型实现"));
content.push(h2("4.1　代码结构"));
content.push(p("EvalBench 以 Python 实现，模块划分与职责如下："));
content.push(...codeBlock([
  "evalbench/",
  "├── problems/          # 问题域：TSP / 一维装箱 / 平行机调度",
  "│   ├── base.py        #   Problem 基类：generate(n, seed) / prompt() / parse() / evaluate()",
  "│   ├── tsp.py         #   验证器：城市数、整数性、越界、不重不漏",
  "│   ├── binpacking.py  #   验证器：物品全覆盖、不重复、容量",
  "│   └── pmachine.py    #   验证器：指派长度、整数性、机器编号",
  "├── llm/",
  "│   ├── client.py      # OpenAI 兼容客户端（DeepSeek / Qwen），token 与延迟计量",
  "│   └── budget.py      # 三重预算控制器：calls / tokens / seconds",
  "├── baselines/         # NN+2-opt / FFD / LPT 经典基线 + OR-Tools 参考解（30s 口径）",
  "├── metrics/           # primal_gap / quality / QYI / stability_cv",
  "├── runner/            # 智能体循环、失败标注、断点续跑、全量落盘",
  "└── analysis/          # 5 图 1 表 + 假设检验",
  "configs/               # exp_smoke.yaml / exp_main.yaml / exp_stability.yaml",
  "evalbench/tests/       # 40 个单元测试（pytest）",
]));
content.push(p("仓库共 12 个 commit，冒烟通过后打 `v0.1-smoke` 标签作为可复现锚点。规模档取值：TSP n = 10/50/200；装箱物品 20/60/120（容量 100）；调度作业 20/60/120 × 机器 4/8/12。"));
content.push(h2("4.2　测试驱动开发"));
content.push(p("全部核心模块按 TDD 开发：先写失败测试再写实现。指标模块 12 个测试锁死四个口径（如 primal_gap(110,100)=10/110、quality(125,100)=0.8、QYI 边界、CV 定义）；问题域测试覆盖验证器的全部违规路径与解析器的容错路径（markdown 围栏、垃圾输入返回 None）；runner 测试覆盖端到端循环（FakeLLM 离线验证）与断点续跑。**40 个测试全部通过**（8.29s）。测试分布见表 4。"));
content.push(tcap("表 4　单元测试覆盖明细（pytest，离线运行无需 API）"));
content.push(makeTable(
  ["测试文件", "数量", "覆盖内容"],
  [
    [{ text: "test_metrics.py", align: "l" }, "12", "指标口径锁死：primal_gap(110,100)=10/110、quality(125,100)=0.8、QYI 边界（q 或 y 为 0）、CV 定义与完美稳定值"],
    [{ text: "test_budget.py", align: "l" }, "5", "三重预算控制器：三个闸门的独立触发、边界值（恰好等于上限）、计数正确性"],
    [{ text: "test_problems.py", align: "l" }, "13", "三问题验证器的全部违规路径（缺失、重复、越界、超容量）与解析器容错路径（markdown 围栏、垃圾输入返回 None）"],
    [{ text: "test_runner.py", align: "l" }, "10", "端到端循环（FakeLLM 离线验证）、失败自动标注（F1/F2/F3 判定）、断点续跑（目录复用与拒绝未知目录）"],
    [{ text: "**合计**", align: "l" }, { text: "**40**", align: "c" }, { text: "**8.29 秒全绿，覆盖全部宣称机制**", align: "l" }],
  ],
  [2200, 800, 5312],
  { aligns: ["l", "c", "l"] }
));
content.push(h2("4.3　工程过程中的两个真实缺陷"));
content.push(p("实现期发现并修复了执行计划代码中的两处缺陷，均如实记录："));
content.push(...bullets([
  "**装箱参考解约束方向写反**：计划中 CP-SAT 精确分支的容量约束方向有误，会使参考解恒为 0。TDD 的参考解测试在冒烟前抓住该缺陷并修复——若无此测试，参考解恒 0 会静默污染全部 gap/quality 读数，整个实验作废。",
  "**断点续跑生成新目录**：主实验因 API 账户欠费中断后，重启发现 runner 每次生成新 run_id 新目录、从头重跑（多消耗 13 个重复 run 后被终止清理）。按 TDD 补 2 个续跑测试后修复：Runner 接受可选 run_id 参数复用原目录，续跑不再重复调用已完成的 LLM。此缺陷的存在本身印证了“断点续跑”这类机制若无测试覆盖，宣称与实现可能悄然脱节。",
]));
content.push(callout("工程教训",
  "两次修复的共同点：缺陷都藏在“计划文档宣称了某机制”与“代码实际实现了某机制”之间的缝隙里。TDD 的价值不在于证明代码正确，而在于把宣称变成可执行断言——参考解测试锁住“参考解不恒 0”，续跑测试锁住“续跑不重复调用”。这对评测系统的意义尤为直接：评测系统自身的正确性是全部下游结论的前提。"));

// ---------- 5 实验与结果 ----------
content.push(h1("5　实验与结果"));
content.push(h2("5.1　实验设置与预登记假设"));
content.push(p("实验矩阵两组：主实验（2 模型 × 3 问题 × 3 规模 × 5 实例 × 1 重复 = 90 runs）测平均能力地图；稳定性实验（同构但 3 实例 × 5 重复 = 270 runs）测同配置重复的采样方差，温度固定 0.7。全部 360 runs 统一 standard 档预算（calls=10, tokens=60000, seconds=600）。实验矩阵总览见表 5。"));
content.push(tcap("表 5　实验矩阵总览"));
content.push(makeTable(
  ["维度", "主实验 exp_main.yaml", "稳定性实验 exp_stability.yaml"],
  [
    [{ text: "模型", align: "l" }, "deepseek-chat、qwen-plus（temperature 0.7）", "同左"],
    [{ text: "问题", align: "l" }, "TSP / 一维装箱 / 平行机调度，各 3 规模", "同左"],
    [{ text: "实例", align: "l" }, "每规模 5 个（共 45）", "每规模 3 个（共 27）"],
    [{ text: "重复", align: "l" }, "1", "5"],
    [{ text: "运行数", align: "l" }, "2×3×3×5×1 = 90", "2×3×3×3×5 = 270"],
    [{ text: "预算", align: "l" }, "calls=10 / tokens=60000 / seconds=600", "同左"],
    [{ text: "目的", align: "l" }, "平均能力地图", "同配置重复的采样方差（stability_cv）"],
  ],
  [1400, 3456, 3456],
  { aligns: ["l", "l", "l"] }
));
content.push(p("预算档位实验（tight/standard/loose 三档 × 假设 H3）按预定降级预案①裁剪——课程时间约束下的显式取舍，恢复路径与配置模板留档（见 6.5 节）。三条预登记假设（判伪标准在实验前写入设计文档）："));
content.push(...bullets([
  "**H1**：对每个 (模型, 问题) 组合，small→large 可行率单调下降且降幅超出重复波动。",
  "**H2**：验证反馈迭代提升累计可行率，但边际收益递减（第 3 轮后增量 <10 个百分点）。",
  "**H4**：两模型 QYI 接近（差 <0.1）但性价比 QYI/¥ 差异显著（比值 ≥2）。",
]));
content.push(p("统计方法：可行率组间比较用 Fisher 精确检验（小样本精确方法），规模趋势辅以序数逻辑回归，gap 分布比较用 Mann-Whitney U，失败主导性用单侧二项检验。显著性水平 0.05。"));
content.push(h2("5.2　总体结果与成本核算"));
content.push(p("表 6 汇总两组实验的总体结果：实验总量、API 总成本、模型级 QYI 与性价比。360 runs 两模型全量跑完、无中断丢失（欠费中断经修复后的续跑机制恢复）；账单实测总成本 ¥2.59，仅为 ¥20 预算估算的约 1/8（牌价折算口径 ¥4.36、约 1/5，见 3.3 节对账说明），熔断线 ¥50 远未触达。"));
content.push(tcap("表 6　总体结果与成本核算（主实验 + 稳定性实验）"));
content.push(makeTable(
  ["指标", "数值", "说明"],
  [
    [{ text: "实验总量", align: "l" }, { text: "360 runs", align: "c" }, "主实验 90 + 稳定性 270，两模型全量跑完，无中断丢失（欠费中断经续跑机制恢复）"],
    [{ text: "API 总成本", align: "l" }, { text: "实测 ¥2.59", align: "c" }, "账单口径：deepseek ¥1.30（含约 ¥0.17 的中断重跑与冒烟测试）+ qwen ¥1.29；牌价折算口径 ¥4.36（主实验 ¥1.06 + 稳定性 ¥3.30）。远低于 ¥20 预算估算，熔断线 ¥50 未触达"],
    [{ text: "模型级 QYI", align: "l" }, { text: "0.529 vs 0.397", align: "c" }, "deepseek-chat 显著高于 qwen-plus（可行率 0.60 vs 0.49，可行解平均 gap 0.21 vs 0.32）"],
    [{ text: "性价比 QYI/¥", align: "l" }, { text: "1.45× → 0.67×", align: "c" }, "牌价口径：qwen 1.10 vs deepseek 0.76（1.45 倍，低于预登记 2 倍阈值）；账单口径：qwen 1.28 vs deepseek 1.92（0.67 倍，方向反转）——H4 在两种口径下均被证伪且账单口径更强（见 5.5 节）"],
  ],
  [1500, 1700, 5112],
  { aligns: ["l", "c", "l"] }
));
content.push(...figure("fig1_cost_quality.png", "图 1　成本—质量前沿（主实验）", 520, 361));
content.push(p("图 1 中 deepseek-chat 以 1.9 倍的牌价折算成本换取 0.132 的 QYI 优势；qwen-plus 占据前沿左下低成本区（注：横轴为牌价折算口径；账单口径下两模型主实验支出几乎持平——deepseek ¥0.28 vs qwen ¥0.31，前沿形态随之改变，见 5.10 节）。纵轴为模型级加权 QYI，横轴为 90 runs 的 api_cost 总和（元，牌价折算）。表 7 给出两组实验的 token 与成本分解：两模型合计消耗约 192 万 token、1,094 次 API 调用；qwen-plus 在两组实验中均消耗更多 token（主实验 292K vs 172K，稳定性 925K vs 535K）——高失败率带来的重复迭代部分抵消了其单价优势。"));
content.push(tcap("表 7　token 与成本分解（按模型 × 实验；成本列为牌价折算口径，账单实测见说明）"));
content.push(makeTable(
  ["模型", "实验", "runs", "输入 tokens", "输出 tokens", "调用次数", "成本（元）"],
  [
    ["deepseek-chat", "主实验", "45", "113,395", "58,636", "121", "0.70"],
    ["qwen-plus", "主实验", "45", "187,491", "104,532", "150", "0.36"],
    ["deepseek-chat", "稳定性", "135", "357,446", "177,608", "375", "2.14"],
    ["qwen-plus", "稳定性", "135", "575,479", "349,831", "448", "1.16"],
    [{ text: "**合计**" }, { text: "**—**" }, { text: "**360**" }, { text: "**1,233,811**" }, { text: "**690,607**" }, { text: "**1,094**" }, { text: "**4.36****" }],
  ],
  [1500, 1100, 900, 1400, 1400, 1000, 1012],
  { aligns: ["l", "l", "r", "r", "r", "r", "r"] }
));
content.push(p("表 7 成本列为牌价折算口径（3.3 节价格表）。账单口径对账：360 runs 有效实验的账单分摊成本约 ¥2.42（按提供商内 token 比例分摊：deepseek ¥1.13、qwen ¥1.29），加上中断重跑（14 runs，¥0.16）与冒烟测试，全周期账单合计 ¥2.59——牌价口径高估 68%，差异来自 flash 计费档位、闲时资费与上下文缓存三项（详见 3.3 节）。"));
content.push(p("表 8 为主实验 (模型 × 问题 × 规模) 全量汇总，是后续所有分析的底表。"));
content.push(tcap("表 8　主实验汇总（90 runs；gap 为 primal_gap 均值，不可行解记 1；成本列为该组牌价折算 api_cost 总和）"));
content.push(makeTable(
  ["模型", "问题", "规模", "gap 均值", "可行率", "成本（元）", "tokens"],
  [
    [{ text: "deepseek-chat", rowSpan: 9 }, { text: "TSP", rowSpan: 3 }, "small (n=10)", "0.109", "1.00", "0.005", "1,666"],
    ["", "", "medium (n=50)", "0.229", "1.00", "0.013", "4,360"],
    ["", "", "large (n=200)", "0.978", "0.20", "0.453", "100,444"],
    ["", { text: "装箱", rowSpan: 3 }, "small", "0.800", "0.20", "0.022", "6,911"],
    ["", "", "medium", "1.000", "0.00", "0.063", "17,132"],
    ["", "", "large", "1.000", "0.00", "0.094", "27,703"],
    ["", { text: "调度", rowSpan: 3 }, "small", "0.265", "1.00", "0.006", "1,845"],
    ["", "", "medium", "0.173", "1.00", "0.014", "4,245"],
    ["", "", "large", "0.190", "1.00", "0.026", "7,725"],
    [{ text: "qwen-plus", rowSpan: 9 }, { text: "TSP", rowSpan: 3 }, "small", "0.124", "1.00", "0.002", "1,613"],
    ["", "", "medium", "0.414", "1.00", "0.010", "10,442"],
    ["", "", "large", "0.958", "0.40", "0.162", "127,801"],
    ["", { text: "装箱", rowSpan: 3 }, "small", "1.000", "0.00", "0.010", "9,263"],
    ["", "", "medium", "1.000", "0.00", "0.026", "22,230"],
    ["", "", "large", "1.000", "0.00", "0.049", "41,134"],
    ["", { text: "调度", rowSpan: 3 }, "small", "0.279", "1.00", "0.002", "2,129"],
    ["", "", "medium", "0.224", "1.00", "0.009", "9,185"],
    ["", "", "large", "1.000", "0.00", "0.090", "68,226"],
  ],
  [1450, 800, 1500, 1150, 1100, 1200, 1112],
  { aligns: ["l", "l", "l", "r", "r", "r", "r"] }
));
content.push(h2("5.3　H1：可行率随规模下降（支持，4/6 组合显著）"));
content.push(p("六个 (模型, 问题) 组合中四个呈显著规模断崖，一个是地板效应（装箱问题从 small 即接近 0，无下降空间），一个不下降（deepseek 调度全规模满分）。最强的两组：deepseek-chat TSP 从 1.00 跌至 0.05（Fisher p = 3.1×10⁻¹⁰）；qwen-plus 调度从 1.00 跌至 0.00（p = 1.5×10⁻¹¹）。qwen-plus TSP 的序数逻辑回归趋势也显著（β = −4.08，p = 2.8×10⁻⁴）。图 2 与图 3 分别给出可行率与 primal gap 随规模的衰减曲线，表 9 为检验明细。"));
content.push(...figure("fig3_feasible_vs_scale.png", "图 2　可行率随规模衰减（主实验，按模型）", 500, 403));
content.push(...figure("fig2_gap_vs_scale.png", "图 3　primal gap 随规模变化（主实验，按模型）", 500, 403));
content.push(tcap("表 9　H1 检验：small vs large 可行率（Fisher 精确检验）"));
content.push(makeTable(
  ["模型", "问题", "feas(small)", "feas(large)", "p 值", "结论"],
  [
    ["deepseek-chat", "TSP", "1.00", "0.05", "3.1×10⁻¹⁰", "显著下降"],
    ["deepseek-chat", "装箱", "0.10", "0.00", "0.49", "地板效应"],
    ["deepseek-chat", "调度", "1.00", "1.00", "1.00", "不下降"],
    ["qwen-plus", "TSP", "1.00", "0.25", "7.7×10⁻⁷", "显著下降"],
    ["qwen-plus", "装箱", "0.15", "0.00", "0.23", "地板效应"],
    ["qwen-plus", "调度", "1.00", "0.00", "1.5×10⁻¹¹", "显著下降"],
  ],
  [1500, 900, 1300, 1300, 1700, 1612],
  { aligns: ["l", "l", "r", "r", "r", "l"] }
));
content.push(p("图 2 中六条曲线五条在 large 档坍塌，唯一例外是 deepseek-chat 的调度问题（全规模 1.0）；图 3 与之同向——不可行解 gap=1 推高组均值，大规模档 gap 均值趋近 1。这一结果与 HeuriGym（SOLVE^III 在大规模问题上坍塌，全局布线 9 模型全 0）和 FrontierCO（LEHD 从合成基准 0.72% gap 到 hard TSP 77%）的规模效应报告一致((2))((3))。值得注意的细节是 deepseek-chat 调度问题的反例：大规模全可行（gap 0.19）说明规模断崖并非普适规律，而是问题结构依赖的——调度问题的解是“每作业一个 0..m−1 的机器编号”序列，比 TSP 的全排列约束更局部、更易维护完整性。这一异质性本身就是评测体系的价值：单一问题基准会把它误读成模型能力。"));
content.push(h2("5.4　H2：迭代反馈的边际收益（支持）"));
content.push(p("由 status 列（solved_iter1…5）构造累计可行率曲线。两模型的反馈迭代均有效但收益集中在前两轮：deepseek-chat 累计可行率 @1=0.533 → @2=0.578（+4.5pp）→ @5=0.600（第 2 轮后仅 +2.2pp）；qwen-plus @1=0.333 → @2=0.422（+8.9pp）→ @5=0.489（第 2 轮后 +6.7pp，其中第 3 轮后仅 +4.4pp）。判伪标准（第 3 轮后增量 ≥10pp）未触发，“边际收益递减”成立；稳定性实验给出一致的曲线形态（deepseek @1=0.548→@5=0.563；qwen @1=0.348→@5=0.467）。"));
content.push(tcap("表 10　累计可行率 @k = P(在 ≤k 轮内解出)（主实验 90 runs）"));
content.push(makeTable(
  ["模型", "@1", "@2", "@3", "@4", "@5", "轮内分布"],
  [
    ["deepseek-chat", "0.533", "0.578", "0.600", "0.600", "0.600", "24/2/1/0/0"],
    ["qwen-plus", "0.333", "0.422", "0.444", "0.467", "0.489", "15/4/1/1/1"],
  ],
  [1600, 850, 850, 850, 850, 850, 2462],
  { aligns: ["l", "r", "r", "r", "r", "r", "c"] }
));
content.push(p("规模分层看，迭代收益高度不均匀：deepseek-chat 的收益几乎全部来自 small 档（@1=0.60→@5=0.73），medium 档第 1 轮后完全饱和（@1=0.67=@5），large 档合计仅 +6.7pp；qwen-plus 的反馈收益集中在中规模档——全问题合并从 @1=0.33 涨到 @5=0.67（+34pp），其中调度问题从 @1=0.60 修复至 @5=1.00（+40pp，最依赖反馈修复的组）——而 large 档两模型迭代几乎无效（qwen large @1=0→@5=0.13，仅 TSP 在第 2、5 轮偶发解出）。与 HeuriGym 的先验对照：GPT-o4-mini-high SOLVE^III 前 5 轮 +16.5pp、后 5 轮仅 +5.1pp((2))——EvalBench 两模型的收益衰减更快，且大规模档“反馈无效”的形态提示：反馈修复的是**局部格式与计数错误**（小规模的主要失败模式），修不了**结构性的组合搜索失败**（大规模的主要失败模式）。"));
content.push(h2("5.5　H4：模型对比与性价比（按原陈述证伪）"));
content.push(p("预登记的 H4 陈述两半均被数据否定：（a）两模型 QYI 差 0.529 − 0.397 = **0.132 ≥ 0.1**，“接近”不成立；（b）QYI/¥ 比值 1.104/0.760 = **1.45 < 2**，单价优势（qwen 单价约为 deepseek 的 1/3—1/4）未转化为 2 倍性价比——因为 qwen-plus 消耗了更多 token（主实验 292K vs 172K，稳定性实验 925K vs 535K），高失败率带来的重复迭代吃掉了单价优势。"));
content.push(p("**账单口径的稳健性复核**：上节比值按牌价表折算，而账单实测（3.3 节）显示两模型全周期支出几乎持平——deepseek ¥1.30、qwen ¥1.29（主实验分摊：¥0.28 vs ¥0.31）。以账单口径重算，QYI/¥ 为 deepseek 1.92、qwen 1.28，比值 **0.67×——方向反转**：qwen 不仅没有兑现低价优势，反而因 QYI 更低而性价比更差。证伪在两种口径下均成立且账单口径更强，结论对价格假设稳健；其机制在于 flash 计费档位 + 上下文缓存抹平了两模型的单位 token 价格差，使“token 消耗量 × 单价”中的单价项近乎对齐，而 qwen 在消耗量（1.7 倍）与质量（QYI 差 0.132）上双双处于劣势。这一复核同时说明：**性价比结论对计费口径敏感**，评测报告若只按牌价表折算，可能在方向上误判——账单对账应成为成本报告的标准环节。"));
content.push(p("实际图景比预登记假设更有结构：**差异是问题依赖的**。调度问题上 deepseek-chat 全面占优（可行率 1.00 vs 0.63，Fisher p = 4.5×10⁻⁸；gap 0.207 vs 0.527，MWU p = 5.8×10⁻⁹）；TSP 上 qwen-plus 可行率反而略高（0.73 vs 0.68，不显著），gap 也略差但边缘（p = 0.064）；装箱上两模型同归于尽（0.03 vs 0.05，无差异）。**不存在全能模型，也不存在稳定的性价比排序**——这正解释了为何 HeuriGym 观察到“中端模型质量接近而单价分化”的简单性价比叙事((2))不能外推：在可行性成为瓶颈的问题上，失败率差异会逆转单价优势。"));
content.push(h2("5.6　稳定性（部分实例存在翻转）"));
content.push(p("270 runs 的稳定性实验（54 实例 × 5 重复）给出三层结果。**其一，总体稳定**：49/54 实例在 5 次重复中可行/不可行结论完全一致。**其二，翻转集中**：5 个实例发生翻转（表 12），其中 4 个属于 qwen-plus——qwen 的不稳定性约为 deepseek 的 4 倍，且翻转实例全部位于各组的能力边界（可行率 0.2—0.8），呈“掷硬币”形态而非“稳定好/稳定差”。**其三，gap 波动可控**：可行实例的组内变异系数普遍 <0.35（deepseek 调度各实例 CV 0.03—0.36），小规模 TSP 例外（约 0.5，因 gap 基数小）。"));
content.push(...figure("fig4_stability.png", "图 4　稳定性（稳定性实验，270 runs）：primal gap 的实例内变异系数", 500, 441));
content.push(p("图 4 为 primal gap 的实例内变异系数热图（问题 × 模型），颜色越深波动越大；可行率坍塌组（gap 恒 1）CV 为 0，是“稳定的失败”而非波动。表 11 给出稳定性实验的 (模型 × 问题 × 规模) 聚合视图（每组 15 runs = 3 实例 × 5 重复）。"));
content.push(tcap("表 11　稳定性实验聚合（270 runs；每组 15 runs = 3 实例 × 5 重复）"));
content.push(makeTable(
  ["模型", "问题", "规模", "runs", "可行率", "gap 均值"],
  [
    [{ text: "deepseek-chat", rowSpan: 9 }, { text: "TSP", rowSpan: 3 }, "small", "15", "1.000", "0.132"],
    ["", "", "medium", "15", "1.000", "0.208"],
    ["", "", "large", "15", "0.000", "1.000"],
    ["", { text: "装箱", rowSpan: 3 }, "small", "15", "0.067", "0.941"],
    ["", "", "medium", "15", "0.000", "1.000"],
    ["", "", "large", "15", "0.000", "1.000"],
    ["", { text: "调度", rowSpan: 3 }, "small", "15", "1.000", "0.235"],
    ["", "", "medium", "15", "1.000", "0.203"],
    ["", "", "large", "15", "1.000", "0.183"],
    [{ text: "qwen-plus", rowSpan: 9 }, { text: "TSP", rowSpan: 3 }, "small", "15", "1.000", "0.170"],
    ["", "", "medium", "15", "0.933", "0.450"],
    ["", "", "large", "15", "0.200", "0.979"],
    ["", { text: "装箱", rowSpan: 3 }, "small", "15", "0.200", "0.863"],
    ["", "", "medium", "15", "0.000", "1.000"],
    ["", "", "large", "15", "0.000", "1.000"],
    ["", { text: "调度", rowSpan: 3 }, "small", "15", "1.000", "0.256"],
    ["", "", "medium", "15", "0.867", "0.352"],
    ["", "", "large", "15", "0.000", "1.000"],
  ],
  [1450, 800, 1400, 1000, 1600, 2062],
  { aligns: ["l", "l", "l", "r", "r", "r"] }
));
content.push(p("表 11 的三个观察：其一，主实验的规模断崖形态在 270 runs 中完整复现——deepseek-chat 的装箱（除 small 0.067）与 TSP large、qwen-plus 的装箱全档与调度 large 可行率均为 0，而 deepseek-chat 调度全规模 1.00；其二，个别边界组与主实验读数有出入（qwen 调度 medium 0.867 vs 主实验 1.00；deepseek TSP large 0.000 vs 0.20）——这是 3 实例子集相对 5 实例全集的抽样差异，与表 12 中翻转实例全部位于能力边界的观察互为印证；其三，可行组的 gap 均值与主实验同向（deepseek TSP medium 0.208 vs 主实验 0.229；调度 small 0.235 vs 0.265），质量维度上两组实验口径一致。"));
content.push(tcap("表 12　发生可行/不可行翻转的实例（5 次重复）"));
content.push(makeTable(
  ["模型", "实例", "可行率", "flip 率", "gap 均值", "gap CV"],
  [
    ["deepseek-chat", "bpp_n20_s3", "0.20", "0.20", "0.822", "0.483"],
    ["qwen-plus", "bpp_n20_s2", "0.60", "0.40", "0.588", "0.651"],
    ["qwen-plus", "pm_n60_s1", "0.60", "0.40", "0.627", "0.547"],
    ["qwen-plus", "tsp_n200_s3", "0.60", "0.40", "0.937", "0.061"],
    ["qwen-plus", "tsp_n50_s1", "0.80", "0.20", "0.536", "0.489"],
  ],
  [1500, 1900, 1100, 1100, 1350, 1362],
  { aligns: ["l", "l", "r", "r", "r", "r"] }
));
content.push(p("对照文献：FrontierCO 观察到 FunSearch TSP-hard 方差 ±25.62% 但只能报告跨实例标准差（单次运行的固有限制）((3))；DynaSchedBench 的 5 种子控制的是实例生成侧随机性((4))。EvalBench 是本矩阵中唯一把“同实例同配置重复”作为受控实验设计、并把 CV 升为一等指标的体系——本节全部数字在四大基准中均无对应物。"));
content.push(h2("5.7　失败模式：预测与实测（事前预测 4/6 命中）"));
content.push(p("主实验 41 个失败 run 的自动归类：F2 约束违背 38（93%）、F1 解析失败 2、F3 幻觉 1。F2 的主导性显著（单侧二项检验 p = 5.2×10⁻⁹），与事前预测“F2 为最大类”一致，也与 HeuriGym“约束误解”为主要失败类、CO-Bench“struggle to ensure feasibility”的领域共识同构((1))((2))。稳定性实验的 131 个失败 run 中 F2 占 113（86%）、F1 11、F3 7——分布形态与主实验一致，F2 主导不是小样本偶然。"));
content.push(...figure("fig5_failure_modes.png", "图 5　失败模式分布（主实验 + 稳定性实验，按模型堆叠）", 490, 469));
content.push(tcap("表 13　失败分类的事前预测 vs 实测（主实验 41 个失败 run）"));
content.push(makeTable(
  ["类", "事前预测", "实测", "评注"],
  [
    [{ text: "F1 解析失败", align: "l" }, "中（大规模升高）", "2", "两个均发生在 TSP n=200（见 5.8 节）"],
    [{ text: "F2 约束违背", align: "l" }, "**高（最大类）**", "38 (93%)", "命中，二项检验 p=5.2×10⁻⁹"],
    [{ text: "F3 幻觉", align: "l" }, "中（随规模上升）", "1", "偏低（小样本下单例）"],
    [{ text: "F4 搜索停滞", align: "l" }, "低（预期 0）", "0", "可达性分析预测命中"],
    [{ text: "F5 预算耗尽", align: "l" }, "低—中（集中大规模）", "0", "未命中：standard 档下预算从未成为约束（见正文）"],
    [{ text: "F6 其他", align: "l" }, "低", "0", "自动兜底为空，无需人工复核"],
  ],
  [1500, 2200, 1100, 3512],
  { aligns: ["l", "l", "c", "l"] }
));
content.push(p("F5 的缺席本身是发现：standard 档下（max_iters=5 < max_calls=10），迭代上限先于全部三重闸门到达——最长的 run（qwen-plus 调度大规模）325 秒、约 20K token，均远低于 600 秒 / 60K 限值。即**在标准预算下，失败是模型驱动的（F2）而非环境驱动的（F5）**；预算作为约束的“存在感”要通过更紧的档位才能检验——这正是被裁剪的预算档位实验（原 H3）要回答的问题，留作后续工作。F4 的零实测验证了设计文档的可达性分析：当前问题族对不可行解不报告 cost，停滞形态被 F2 吸收。"));
content.push(h2("5.8　失败个案复核"));
content.push(p("对全部非 F2 失败（F1×2、F3×1）做 transcript 级人工复核："));
content.push(...bullets([
  "**F1 ×2（deepseek、qwen 各一，均为 TSP n=200）**：两例的 completion_tokens 均**恰好等于 4096**——模型生成 200 城市完整排列的 JSON 时打满输出上限、被截断，解析随之失败。这是“输出预算成为独立失败模式”的直接证据：大规模下失败不仅来自推理，也来自物理输出长度约束。讽刺的是，这恰是预算受控设计的注脚——不监控输出 token 的评测会把这类失败误读为“模型不会解题”。",
  "**F3 ×1（qwen-plus，装箱 n=60）**：解引用了不存在的物品下标（越界），自动归类正确。幻觉对象从 HeuriGym 的“库 API”换成本实验的“解空间实体”，印证幻觉现象跨任务维度稳定存在((2))。",
]));
content.push(h2("5.9　基线对照：LLM 直接求解 vs 经典启发式"));
content.push(p("表 14 为三层对照（LLM / 经典启发式 / OR-Tools 参考解）。结论一边倒：**经典启发式以零 API 成本、毫秒级耗时全面优于两个 LLM**——NN+2-opt 相对参考解 gap 5.9—7.5%（TSP），FFD/LPT 在其充当参考解口径的组 gap 为 0；而 LLM 即使产出可行解，gap 也高达 10.9—41.4%（小/中规模），大规模则多数不可行。"));
content.push(tcap("表 14　基线对照表（目标值均值；LLM 列括号内为可行率；经典启发式与参考解零 API 成本）"));
content.push(makeTable(
  ["问题/规模", "经典启发式", "OR-Tools 参考", "deepseek-chat", "qwen-plus"],
  [
    ["TSP small", "340.5", "316.6", "358.0 (1.00)", "364.1 (1.00)"],
    ["TSP medium", "632.9", "585.0", "762.6 (1.00)", "1003.8 (1.00)"],
    ["TSP large", "1178.5", "1109.4", "— (0.20)", "— (0.40)"],
    ["装箱 small", "7.8", "7.6", "8.0 (0.20)", "— (0.00)"],
    ["装箱 medium", "21.6", "21.6", "— (0.00)", "— (0.00)"],
    ["装箱 large", "43.4", "43.4", "— (0.00)", "— (0.00)"],
    ["调度 small", "54.5", "53.7", "73.6 (1.00)", "76.9 (1.00)"],
    ["调度 medium", "82.7", "82.7", "100.6 (1.00)", "107.7 (1.00)"],
    ["调度 large", "106.5", "106.5", "132.1 (1.00)", "— (0.00)"],
  ],
  [1800, 1550, 1600, 1680, 1682],
  { aligns: ["l", "r", "r", "r", "r"] }
));
content.push(p("这一结果与领域文献的结论链一致：DynaSchedBench 观察到全部 LLM 聚集在强启发式的窄性能带、充当“稳健的安全近似器”而非超越者((4))；HeuriGym 发现进化框架 EoH/ReEvo 的 QYI 反而低于裸启发式基线((2))；Ros 综述中 LLM 的价值定位更多在建模、算法设计与人机交互而非直接求解((6))。EvalBench 的贡献是把这条结论在三个全新问题、双模型、等预算受控协议下再次量化——并给出具体的量化差距（可行解 gap 2—7 倍于经典启发式）。"));
content.push(h2("5.10　成本的单位经济分析"));
content.push(p("总量之外，成本的结构信息对评测实践更有参考价值。表 15 将 5.2 节的总量折算为四个单位口径：单 run 成本、每可行解成本、成本集中度与调用强度；每个成本指标同时给出牌价折算口径（预登记口径，3.3 节价格表）与账单分摊口径（按提供商内 token 比例分摊账单实测值）。"));
content.push(tcap("表 15　单位经济指标（主实验 90 runs；牌价 = 3.3 节价格表折算，账单 = 账单实测按 token 比例分摊）"));
content.push(makeTable(
  ["指标", "deepseek-chat", "qwen-plus", "解读"],
  [
    [{ text: "单 run 成本", align: "l" }, "牌价 ¥0.0156\n账单 ¥0.0061", "牌价 ¥0.0080\n账单 ¥0.0069", "账单口径下两者趋同（deepseek 反而略低）；稳定性实验账单口径 ¥0.0064 / ¥0.0073——两次独立实验互相印证"],
    [{ text: "每可行解成本", align: "l" }, "牌价 ¥0.026\n账单 ¥0.010", "牌价 ¥0.016\n账单 ¥0.014", "牌价口径 qwen 便宜 1.58×；账单口径 deepseek 便宜 1.38×——计入口径后排序反转，qwen 的高失败率（22 vs 27 个可行解）吞掉全部价格优势"],
    [{ text: "成本集中度", align: "l" }, "TSP large 占 58%", "TSP large 占 44%", "token 口径（100,444 / 127,801 tokens）；deepseek 该组 5 runs 仅 1 个可行解——最贵的组恰恰产出最差"],
    [{ text: "调用强度", align: "l" }, "2.69 次/run", "3.33 次/run", "稳定性实验为 2.78 / 3.32；qwen 平均多约 24% 的调用源于更高的首轮失败率"],
  ],
  [1250, 1600, 1450, 4012],
  { aligns: ["l", "c", "c", "l"] }
));
content.push(p("三个结构性事实值得单独强调。**其一，token 结构以输入为主**：全量输入/输出 token 之比约 1.8:1（1.23M : 0.69M）——提示词中的实例数据与逐轮验证反馈是成本主体，输出侧的压缩空间有限。这解释了为何 qwen 的牌价单价优势（约为 deepseek 的 1/3—1/4）无法兑现：它无法靠少输出来省钱，而高失败率迫使它多轮重试（调用强度 3.33 vs 2.69），输入侧反而更贵——牌价口径下尚剩 1.45× 的账面性价比，账单口径下（flash 档位 + 上下文缓存抹平单价差）连这 1.45× 也归零反转（0.67×，见 5.5 节）。**其二，成本的尾部集中**：deepseek-chat 58% 的主实验 token 消耗在单一组（TSP large）上，而该组 5 runs 仅产出 1 个可行解——评测预算的工程价值恰恰在于封住这类尾部：若无三重闸门，一个失控的重试循环（如 4.3 节续跑缺陷那种重复调用）的成本上界是不可计算的。**其三，登记与实测的 7.7 倍差距**：事前按 ¥20 登记、账单实测 ¥2.59；折算到 360 runs，事前口径约 ¥0.056/run，账单实测约 ¥0.007/run。评测者登记预算时应同时给出“按 run 计”与“按 token 计”两条基线——后者对大规模组更紧，也更贴近真实约束。"));

// ---------- 6 讨论 ----------
content.push(h1("6　讨论"));
content.push(h2("6.1　主要发现"));
content.push(p("本实证的四条核心发现："));
content.push(...numbered("findings", [
  "**可行率的规模断崖是问题结构依赖的**——deepseek-chat 在调度上全规模满分、在 TSP 上从 100% 跌至 5%，说明“LLM 不能处理大规模”的笼统说法掩盖了失败机制差异（解的表示局部性 vs 全局排列约束）；",
  "**失败高度集中于约束违背（93%）**，且反馈迭代只能修复小规模的局部计数错误、修不了大规模的结构性搜索失败——对症改进的方向应是验证器反馈的结构化（如增量修复提示）而非简单加轮数；",
  "**预登记假设被证伪是有信息量的**：H4 的两半（QYI 接近、性价比差 ≥2 倍）都不成立，揭示了“单价便宜”与“性价比高”在失败率高的任务上的解耦；",
  "**输出 token 上限是独立的失败模式**（两例 F1 均为恰好 4096 截断），评测若不监控输出预算会误读失败成因。",
]));
content.push(h2("6.2　与已有基准的对照"));
content.push(p("EvalBench 的定位不是替代四大基准，而是补上它们系统性缺失的维度。与各家对照：HeuriGym 提供了 QYI 与成本记录的范本，EvalBench 补上预算闸门与稳定性；FrontierCO 提供了 primal gap 的严格口径，EvalBench 补上失败编码与可复现协议；DynaSchedBench 的难度校准思想（把难度变成受控变量）在本体系中对应“把预算变成受控变量”——虽然后者因降级只保留了单档，但机制与代码路径完整保留。Ros 综述呼吁的“标准化评测协议”((6))在本作业的尺度上被具体化为：指标五要素定义 + 配置快照 + 版本锚 + 全量日志的可执行组合。"));
content.push(h2("6.3　效度威胁"));
content.push(p("按实验研究的效度框架对本实证做一次自查，与 6.4 节的覆盖面局限互补——后者多数属外部效度范畴，此处不再重复。"));
content.push(h3("6.3.1　内部效度"));
content.push(...bullets([
  "**主实验每实例单次运行**：每个 (模型, 问题, 规模, 实例) 组合仅 1 run，单 run 结论嵌入了采样噪声。模型级与组级结论依赖 45/90 runs 的聚合，并有 270 runs 稳定性实验佐证；5.6 节的 5 个翻转实例给出了噪声量级的直接估计——可行率 0.2—0.8 的边界组，单次结论不应被单独引用。",
  "**失败复核的编码者主观性**：F1/F3 的个案判定由作者人工复核 transcripts 完成，无第二编码者与一致性检验（如 Cohen's κ）；自动可判的 F1/F2/F5 规则不受此影响。课程尺度下这是可接受的省略，正式发表需补双人编码。",
  "**参考解口径的方向性**：medium/large 档参考解为启发式/限时搜索口径，gap 读数依赖参考解质量。本实验中经典基线显著强于两个 LLM（5.9 节），该偏差不改变“LLM 远弱于经典”的排序结论，但影响 gap 绝对值与其他基准的可比性。",
]));
content.push(h3("6.3.2　构念效度"));
content.push(...bullets([
  "**可行性的二元化**：可行/不可行两档判定使装箱“超载 1 件”与“超载一半”同记 F2，丢失了“接近可行”的梯度信息；相对违约度（如超容量比例）是更细的构念，留作指标体系的扩展点。",
  "**QYI 的等权隐含假设**：调和平均隐含质量与可行性同等重要。若下游应用更看重其一（如实时调度只要可行解），等权 QYI 会误排序；本体系实现的是等权版本，权重可配置是自然的扩展方向。",
  "**gap=1 惩罚的尺度混用**：不可行解 gap 记 1，把“不可行”与“最差可行”放上同一尺度。QYI 的 Y 分量正是为分离这两种失败而设，但阅读组级 gap 均值（如表 8）时须意识到可行率差异已被折叠进均值。",
]));
content.push(h3("6.3.3　统计效度"));
content.push(...bullets([
  "**多重比较未校正**：全部检验共约 19 次（H1 的 6 组 Fisher 与 6 组序数 logit、H4 的 3 组 Fisher 与 3 组 MWU、H2 的 1 次二项检验），未做族错误率校正。其中 6 个 p 值低于 10⁻⁶（最弱为 7.7×10⁻⁷），Bonferroni ×19 校正后仍显著；但 TSP gap 的 MWU p = 0.064 这类边缘值在任何校正下都不应读作趋势证据——本报告将其如实标注为“边缘”而非“接近显著”。",
  "**独立性假设**：主实验每实例仅 1 run，Fisher/MWU 的观测独立性成立；稳定性实验的 270 runs 存在实例内相关，故仅以描述统计（翻转率、CV）进入报告而不做推断检验——若对逐 run 数据直接检验，会低估方差、夸大显著性。",
]));
content.push(h2("6.4　局限性"));
content.push(...bullets([
  "**规模与问题覆盖**：3 问题 45 实例相对四大基准是刻意的小；结论向其他 OR 问题（混合整数、随机、多目标）外推未经验证。这是课程资源约束下的显式取舍（D6 对策），非设计缺陷，但读者应知边界。",
  "**预算维度未展开**：预算档位实验（原 H3）按降级预案裁剪，“预算—性能曲线”与“失败 × 预算 × 规模”三维交叉留作后续工作；当前数据只能说“standard 档下预算不是瓶颈”，不能说预算不重要。",
  "**参考解非严格最优**：medium/large 档参考为 30 秒限时搜索或启发式上界，gap/quality 应读作相对口径值；若 LLM 解优于参考，quality 截断会低估领先幅度（需回看原始 cost 列）。",
  "**API 版本无法逐字锁定**：DeepSeek/Qwen 商用端点不提供带日期的快照版本号，权重可能随服务端漂移；本体系以 manifest 时间戳 + 全量 transcript 实现事后审计，弱于 HeuriGym 的 API 快照锁定。",
  "**单温度设定**：温度固定 0.7，未做温度消融；稳定性量化的是“同配置重复”方差，不含温度敏感性。",
]));
content.push(h2("6.5　后续工作"));
content.push(...bullets([
  "**预算档位实验**（最高优先）：恢复 tight/standard/loose 三档 × 3 规模的 54 runs，检验 H3（预算收紧对大规模伤害最大），把 F5 从零实测变成有变化的分布；配置模板已留档，增量成本按账单口径不足 ¥1（牌价口径约 ¥5）。",
  "**记录响应侧模型字段与账单档位**：本次对账暴露的别名漂移（请求 deepseek-chat/qwen-plus、计费 deepseek-flash/qwen3.8-flash，3.3 节）说明仅记录请求侧模型名不足以锁定被测对象——后续版本将在 transcript 中落盘响应的 model 字段、usage 中的缓存命中 token 数，并在 manifest 中登记账单计费档位，使成本口径可逐 run 审计。",
  "**失败驱动的困难实例生成**：迁移 FuzzGPT 方法论——以 transcripts 中的历史失败样本为种子，引导 LLM 生成同分布的更难实例((5))；本体系的全量 transcript 落盘为此保留了完整原料。",
  "**结构化反馈消融**：把验证器的违规描述升级为结构化修复提示（如“城市 37 与 82 重复，请交换”），检验 F2 主导失败对反馈粒度的敏感度。",
  "**评测对象扩展**：从“直接求解”扩展到 HeuriGym 式“启发式生成”与 CO-Bench 式“算法搜索”，使同一预算—审计框架覆盖 LLM×OR 的三种参与模式。",
]));

// ---------- 7 结论 ----------
content.push(h1("7　结论"));
content.push(p("本作业面向“成本受控、可复现的 LLM 与 OR 评测体系”完成了从文献到实证的完整闭环：六篇文献精读产出能力矩阵与六条领域缺陷；针对缺陷设计的 EvalBench 以统一指标、三重预算控制器、审计式可复现协议与失败自动分类构成小型而完整的评测体系；TDD 实现的 40 个测试守护了系统自身的正确性；360 次运行、账单实测总成本 ¥2.59 的实验按预登记假设组织检验，产出四条有统计支撑的发现，其中一条预登记假设被证伪——预注册的价值在课程尺度上得到直接演示。"));
content.push(p("体系层面的核心主张经受住了实验检验：**成本可以成为事前受控变量**（账单实测总成本 ¥2.59，为预算估算的约 1/8，熔断线远未触达），**可复现可以做成审计链**（每个数字可回溯到一次具体调用），**失败可以成为统计对象**（93% 的失败集中于约束违背这一可对症的类别）。同时实验也划出了边界：在直接求解设定下，经典启发式以零成本全面优于被测的两个 LLM——LLM 在 OR 中的价值更可能在建模、算法设计与人机协作中实现，这与其作为“能力边界探针”的评测使命并不矛盾，反而是评测体系应当如实报告的事实。"));
content.push(p("对后续的 LLM×OR 评测实践，本作业的可迁移经验凝结为五条："));
content.push(...numbered("advice", [
  "**预算事前登记、熔断兜底、账单对账**：在配置文件中声明三重上限并在运行时强制执行，而非事后记账。本实验账单实测成本为登记值的约 1/8（¥2.59 vs ¥20）——且对账发现了计费档位漂移与缓存折扣（3.3 节），这类信息只有账单口径才能暴露；熔断线的意义在于让“最坏情况可计算”成为设计性质而非运气。",
  "**假设预登记并写明判伪标准**：把“什么结果算证伪”写在看数据之前。本作业 H4 被证伪的过程本身演示了该方法的价值——若无预登记，0.132 的 QYI 差距很容易被事后解释掉。",
  "**把失败模式当一等统计对象**：93% 的失败集中于约束违背这类可对症的类别，失败编码把“模型不行”细化为“哪类不行、为何不行”，直接指向改进方向。",
  "**稳定性必报**：可行率 0.2—0.8 的边界组存在掷硬币式翻转，任何单次运行结论都应以重复实验的方差来度量可信度。",
  "**全量 transcript 落盘**：360 runs 的完整调用日志合计约 1.7 MB，却是失败复核、口径审计与后续困难实例生成的全部原料——单位成本的事后价值最高的一项投入。",
]));
content.push(p("评测体系的终点不是给模型排名，而是把“LLM 在组合优化中能做什么、做不到什么、为什么”变成可累积、可审计的证据。EvalBench 在课程尺度上给出的答案是：直接求解不是当前 LLM 的位置——但把这个结论量出来、解释清楚、并让它可被任何人复现，正是评测体系自身的独立价值。"));

// ---------- 参考文献 ----------
content.push(h1("参考文献"));
content.push(ref("[1] Sun W, Feng S, Li S, Yang Y. CO-Bench: Benchmarking LLM Agents in Algorithm Search for Combinatorial Optimization. arXiv:2504.04310, 2025."));
content.push(ref("[2] Chen X, et al. HeuriGym: An Agentic Benchmark for LLM-Crafted Heuristics in Combinatorial Optimization. ICLR 2026, arXiv:2506.07972."));
content.push(ref("[3] Feng S, Sun W, Li S, Talwalkar A, Yang Y. FrontierCO: Real-World and Large-Scale Evaluation of Machine Learning Solvers for Combinatorial Optimization. ICLR 2026."));
content.push(ref("[4] Cao S, Yuan Y, Liu J, et al. DynaSchedBench: Calibrated Dynamic Scheduling Benchmarks and Observability Paradox in LLM-based Scheduling Agents. ICML 2026, arXiv:2605.27566."));
content.push(ref("[5] Deng Y, Xia C S, Yang C, Zhang S D, Yang S, Zhang L. Large Language Models are Edge-Case Generators: Fuzzing Deep Learning Library APIs via LLMs. ICSE 2024. DOI: 10.1145/3597503.3623343."));
content.push(ref("[6] Da Ros F, Soprano M, Di Gaspero L, Roitero K. Large Language Models for Combinatorial Optimization: A Systematic Review. ACM Computing Surveys, 2025, 58(11). DOI: 10.1145/3801961."));

// ---------- 附录 A ----------
content.push(h1("附录 A　复现指南"));
content.push(p("全部产物随 git 仓库版本化（12 commits，冒烟锚点标签 `v0.1-smoke`）。复现步骤："));
content.push(...codeBlock([
  "# 1. 环境与密钥",
  "pip install -r requirements.txt",
  "# .env 写入：LLM_API_KEY=sk-...（DeepSeek）、DASHSCOPE_API_KEY=sk-...（阿里百炼）",
  " ",
  "# 2. 单元测试（40 个，离线，无需 API）",
  "python -m pytest evalbench/tests -q",
  " ",
  "# 3. 冒烟（1 run，验证端到端五件套）",
  "python -m evalbench.runner.runner configs/exp_smoke.yaml",
  " ",
  "# 4. 主实验（90 runs，可中断重跑；中断后传 run_id 续跑）",
  "python -m evalbench.runner.runner configs/exp_main.yaml",
  "# 续跑：python -m evalbench.runner.runner configs/exp_main.yaml <run_id>",
  " ",
  "# 5. 稳定性实验（270 runs）",
  "python -m evalbench.runner.runner configs/exp_stability.yaml",
  " ",
  "# 6. 图表与假设检验",
  "python -m evalbench.analysis.report results/<run_id>",
  "python -m evalbench.analysis.hypo_tests results/<主实验run_id> results/<稳定性run_id>",
]));
content.push(p("仓库结构：notes/（六篇文献笔记与能力矩阵）、docs/design/（四份设计文档：指标体系 / 评测协议 / 失败模式分类 / 实验设计）、evalbench/（系统代码）、configs/（实验配置）、results/（运行目录，含 config 快照 / manifest / summary / transcripts 全量审计链）。本报告引用的运行：主实验 `20261006-013713-c4e51a`、稳定性实验 `20261006-071634-f8a98c`。"));

// ---------- 附录 B ----------
content.push(h1("附录 B　稳定性实验逐实例统计"));
content.push(p("表 B-1 给出稳定性实验（270 runs = 54 实例 × 5 重复）的逐实例统计。可行率为 5 次重复中产出可行解的比例；翻转率为少数类频率 min(可行次数, 不可行次数)/5，衡量同实例重复中可行/不可行结论的翻转程度；gap 均值与标准差基于 5 次重复的 primal_gap 序列；CV = pstdev/mean。发生翻转的 5 个实例以粗体标出，与正文表 12 一致。"));
(function () {
  const pname = { binpacking: "装箱", pmachine: "调度", tsp: "TSP" };
  const rows = APPENDIX_B.map((r) => {
    const flip = r.flip > 0;
    const f = (v) => (flip ? { text: "**" + v + "**" } : String(v));
    return [
      f(r.model), f(pname[r.problem] || r.problem), f(r.instance),
      f(r.repeats), f(r.feas.toFixed(2)), f(r.flip.toFixed(2)),
      f(r.gap_mean.toFixed(3)), f(r.gap_std.toFixed(3)), f(r.cv.toFixed(3)),
    ];
  });
  content.push(tcap("表 B-1　稳定性实验逐实例统计（54 实例 × 5 重复；粗体行为发生翻转的实例）"));
  content.push(makeTable(
    ["模型", "问题", "实例", "重复", "可行率", "翻转率", "gap 均值", "gap 标准差", "gap CV"],
    rows,
    [1150, 950, 1450, 600, 900, 900, 950, 750, 662],
    { aligns: ["l", "l", "l", "r", "r", "r", "r", "r", "r"] }
  ));
})();

// ================================================================
// 文档组装
// ================================================================
const doc = new Document({
  creator: "李万叶",
  title: "成本受控、可复现的 LLM 与 OR 评测体系——EvalBench 的设计、实现与实证",
  description: "《优化理论方法》课程大作业（研究方向五）",
  styles: {
    default: {
      document: { run: { font: F_SONG, size: 24 } },
    },
    paragraphStyles: [
      {
        id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 32, bold: true, font: F_HEI, color: "000000" },
        paragraph: {
          spacing: { before: 240, after: 240, line: 360, lineRule: "auto" },
          alignment: AlignmentType.CENTER, outlineLevel: 0, keepNext: false, keepLines: false,
        },
      },
      {
        id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, font: F_HEI, color: "000000" },
        paragraph: {
          spacing: { before: 200, after: 120, line: 360, lineRule: "auto" },
          outlineLevel: 1, keepNext: false, keepLines: false,
        },
      },
      {
        id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 24, bold: true, font: F_HEI, color: "000000" },
        paragraph: {
          spacing: { before: 160, after: 80, line: 360, lineRule: "auto" },
          outlineLevel: 2, keepNext: false, keepLines: false,
        },
      },
    ],
  },
  numbering: {
    config: [
      {
        reference: "bullets",
        levels: [{
          level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        }],
      },
      {
        reference: "steps",
        levels: [{
          level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        }],
      },
      {
        reference: "findings",
        levels: [{
          level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        }],
      },
      {
        reference: "advice",
        levels: [{
          level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        }],
      },
    ],
  },
  sections: [{
    properties: {
      titlePage: true,
      page: {
        size: { width: 11906, height: 16838 },
        margin: { top: 1440, bottom: 1440, left: 1797, right: 1797 },
      },
    },
    footers: {
      first: new Footer({ children: [new Paragraph({ children: [] })] }),
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, font: F_SONG })],
        })],
      }),
    },
    children: content,
  }],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(OUT, buf);
  console.log("written:", OUT, "(" + buf.length + " bytes)");
  console.log("blocks:", content.length);
});

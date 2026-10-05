# 文献笔记：HeuriGym: An Agentic Benchmark for LLM-Crafted Heuristics in Combinatorial Optimization
- **来源**：ICLR 2026（Cornell / Harvard / NVIDIA，Chen et al.），arXiv 2506.07972（v2 2025-01-28 标注系转换稿乱序，正文为会议版）
- **研究问题**：现有 LLM 评测范式的两大缺陷——(1) 客观题基准（AIME、HumanEval、GPQA Diamond、HLE）天花板效应 + 数据污染 + 封闭式答案无法反映真实问题求解；(2) 主观偏好评测（Chatbot Arena 等）方差大、重表面轻推理。核心问题：**LLM 能否在"目标明确 + 解空间巨大"的组合优化（CO）问题上，从零生成完整启发式算法程序，并利用代码执行反馈迭代精化？** 为此提出智能体评测框架 HeuriGym 与统一指标 QYI，评测 9 个前沿模型，揭示工具使用、规划、自适应推理的持续缺陷。定位与 FunSearch/AlphaEvolve（需评估上千候选）、LLM4AD/EoH/ReEvo（模板脚手架）不同：HeuriGym 不给模板，要求 LLM 生成含自定义数据结构与端到端流水线的**完整自包含程序**（典型 300+ 行），并默认只跑 10 轮迭代而非大规模进化搜索。
- **基准构成**：
  - **问题数**：9 个 CO 问题，覆盖 4 大域（引言表述为计算机系统、科学推理、计算生物、物流、EDA 五类）：
    - EDA 电子设计自动化（3）：Operator scheduling 算子调度（高层综合 HLS，⋆）、Technology mapping 工艺映射（K-LUT FPGA 覆盖，K=6，⋆⋆）、Global routing 全局布线（⋆⋆⋆）
    - 编译器/计算机系统（2）：E-graph extraction e-图提取（⋆）、Intra-operator parallelism 算子内并行（分布式 ML 计算图切分，⋆⋆）
    - 计算生物（2）：Protein sequence design 蛋白质序列设计（Grand Canonical H/P 模型逆折叠，⋆）、Mendelian error detection 孟德尔误差检测（家系一致性，NP-complete，⋆⋆）
    - 物流（2）：Airline crew pairing 航空机组配对（⋆⋆）、Pickup and delivery with time windows 带时间窗取送货 PDPTW（⋆⋆⋆）
  - **实例数**：共 **218 个**评估实例（24+31+24+23+28+24+20+14+30），每问题 5 个演示实例 + 数十个大规模评估实例（两者规模相差 ≥1 个数量级）；另**预留数百个私测实例**未发布。
  - **数据来源**（全部源自真实应用，Table 25）：EXRESS 基准（算子调度）、EPFL+ISCAS85（工艺映射）、ISPD'24 Contest（全局布线）、SmoothE（e-graph）、ASPLOS'25 Contest（算子内并行）、PDB 蛋白质数据库（序列设计）、Cost Function Library（孟德尔误差）、全国研究生数学建模竞赛'21 F 题（机组配对）、MetaPDPTW / Li & Lim 数据集（PDPTW）。
  - **问题准入标准**：① Google Scholar 最高被引 <1000 次（截至 2025-05，刻意排除 TSP/SAT 等必被记忆化的教科书问题）；② 纯自然语言 + LaTeX 数学式可无歧义表述；③ 解空间巨大（如算子内并行达 10^65000）；④ 演示集/评估集双分离且规模可扩；⑤ 附可复现专家基线（QYI=1.0 基准），部分问题另给 Gurobi MIP 公式仅用于小实例理解最优差距。问题描述经**人在环**精化：弱模型（DeepSeek-V3）标记歧义 → 人工迭代消除，且此流程仅用于澄清题面、不用于提升求解器。
  - **智能体交互循环**（与静态基准的本质区别）：问题三段式描述（Background / Formalization / Input-Output Format）→ LLM 按标准函数签名 `def solve(input_file: str, solution_file: str)` 生成完整程序（C++ 编译或 Python 解释）→ 三阶段流水线评估（Stage I 执行 / Stage II 产出解 / Stage III 验证器约束检查）→ **将本轮生成代码、执行日志、验证结果、演示集上的目标分数全部追加进提示词**，驱动下一轮精化，默认 10 轮。系统提示词锁定环境（8 核 CPU、超时秒数、Python 3.12、numpy==2.2.5 / networkx==3.4.2 / pandas==2.2.3），初始轮不给任何数据结构/算法提示。
- **指标定义**：
  - **SOLVE^s@i**（s ∈ {I, II, III}，i 为允许迭代轮数）：前 i 轮内通过阶段 s 的实例比率——`SOLVE^s@i := (1/N) Σ_{n=1}^{N} 1(在第 i 轮前通过阶段 s)`，其中 N 为喂给 LLM 的实例总数。三阶段：Stage I 执行（编译/解释通过 + 基本 I/O）；Stage II 解生成（超时内产出非空、格式合规输出）；Stage III 验证（问题专属验证器确认全部约束满足，如算子调度的依赖保持）。意义：**定位智能体推理在哪一里程碑失败**（可执行性 vs 产解率 vs 可行率）。
  - **QUALITY**（截断版）：`QUALITY = (1/N̂) Σ_{n=1}^{N̂} min(1, c*_n / c_n)`，c_n 与 c*_n 分别为 LLM 解与专家解的成本（优化目标值），N̂ 为单次迭代中通过 Stage III 验证的实例数；另有不截断版 `1/N̂ Σ c*_n/c_n` 可度量 LLM 超越专家的情形。
  - **YIELD**：`YIELD = N̂ / N`（可行解产出率）。
  - **QYI（Quality-Yield Index）**：quality 与 yield 的调和平均（类比 F-score，β=1 时为标准调和平均，比算术平均更强惩罚失衡）：
    `QYI = (1+β²)·QUALITY·YIELD / (β²·QUALITY + YIELD)`，默认 **β=1**。取值 [0,1]：0=全部错误或低质，1=专家水平（专家基线即 QYI=1.0）；另定义**加权 QYI**（按各任务实例数加权平均）作总量指标，同时仍逐问题报告 QUALITY/YIELD 以便检查权衡。
  - 设计动机：PASS@k 只适合单轮确定性判分，无法反映"理解约束—按反馈调试—多轮精化"的智能体能力。
- **成本与预算处理**：**记录但未设硬预算闸门**——
  - Token 全量记录（Table 24，单次完整基准一轮 10 迭代的实测）：如 Gemini-2.5-Pro 2,880,737 prompt + 455,739 completion tokens；GPT-o4-mini-high 1.06M+0.98M；Gemini-2.5-Flash 2.74M+0.33M；LLaMA-3.3 最省（0.97M+0.08M）。
  - **API 价格表入正文**（Table 6，$/百万 token 输入/输出）：GPT-o4-mini-high 1.1/4.4、Claude-3.7-Sonnet 3/15、Gemini-2.5-Pro 1.25/10.0、Gemini-2.5-Flash 0.15/3.5、DeepSeek-V3 0.27/1.10、DeepSeek-R1 0.55/2.19、Qwen3-235B 0.29/2.86、LLaMA-3.3 0.07/0.33、LLaMA-4-Maverick 0.27/0.85；由 token 数 × 单价得**每模型估计 API 成本**并画入图 2 右图（0–10 美元量级）。
  - 预算的体现形式是**计算资源与轮数约束**：每实例 8 核 CPU + 问题专属超时（Table 7：多数 10s，全局布线 300s，算子内并行与 PDPTW 60s）；迭代上限 i∈{1,5,10}（默认 10）；进化框架对比实验固定外循环 10 轮、种群 10（更大种群会上下文溢出）；few-shot 消融自述"由于预算约束只测代表性模型"。
  - 温度固定 0（o 系列仅支持 1.0）；未对"最多花多少钱"设熔断机制——成本是**事后统计量**而非控制变量。
- **可复现处理**：**高水平**——
  - 代码/数据/基准全部开源（开源许可证，评审期以补充材料发布）；仓库附逐步复现说明。
  - 提示词全文公开（附录 B：系统提示词含 {NUM_CPU_CORES}/{TIMEOUT} 占位符、用户提示词含 {PROBLEM_DESCRIPTION}+函数模板、两套迭代改进引导提示词——验证失败版列 6 条修复指引，全部通过版引导引入更高效算法、题目歧义澄清提示词）。
  - **模型版本锁定**：以 API 名精确到快照（gemini-2.5-flash-preview-04-17、gemini-2.5-pro-preview-05-06、claude-3-7-sonnet-20250219、deepseek-chat(0324) 等，Table 6）；全部经官方 API 访问（Meta 模型走 OpenRouter）；第三方库版本钉死（numpy==2.2.5 等）；问题→超时配置表（Table 7）公开；每问题附领域验证器+评估器，独立评审员确认专家求解器能复现已发表结果。
  - 另有数百私有测试实例作为未来防污染手段。局限：商业求解器（Gurobi）公式仅用于理解差距。
- **报告的 LLM 失败模式**：正文四分类（Fig 3 按此统计各模型失败测试例占比，含 API Error / ImportError / RuntimeError / SyntaxError / TimeoutError / VerificationError 六类）：
  1. **幻觉 API**（Hallucinated APIs）：调用不存在或过时的库接口——如 `from ortools.sat.python import cp_model` 触发 ModuleNotFoundError（环境明示只有 numpy/networkx/pandas，暴露指令遵循缺陷）；
  2. **API 误用**： misunderstanding 库接口，如直接 `random()` 从 random 模块调用（module is not callable）；
  3. **算法逻辑错误**：整体思路合理但实现有缺陷（如迭代字典时修改字典 RuntimeError；while 条件括号不匹配 SyntaxError）；
  4. **约束误解**：忽略或误读问题约束（VerificationError）；
  5. **超时**：无输出或超出时限（TimeoutError，常因无剪枝的指数级枚举）。
  结论层面归纳为四大持续局限（对应四维评测）：**工具增强推理缺陷、多步规划不足、指令遵循（约束保真）弱、迭代精化（自适应推理）局限**。量化证据：全局布线 9 模型 SOLVE^III 全为 0（无一能产出单个可行解）；PDPTW 多数模型 SOLVE^III@10<30%；总体 GPT-o4-mini-high SOLVE^III@10 仅 74.8%。
  **进化框架失灵原因**（Table 4：EoH QYI 0.4492 / ReEvo 0.4486 / HSEvo 0.4491，均低于裸 Gemini-2.5-Pro 基线 0.6170）：① **未融入程序执行反馈**（错误与验证结果不回流提示词）；② 跨迭代断上下文，反复修补同一个有缺陷的初始程序而无实质进展；③ 这类框架原设计针对 <20 行玩具问题（TSP/装箱），而 HeuriGym 需 300+ 行、必须做策略发现而非套用预置元启发式；④ 简单堆叠全部采样程序到提示词不可扩展（上下文溢出限制种群规模），且缺机制整合多候选的冲突反馈。
- **可搬进 EvalBench 的零件**：
  1. **QYI 指标族 + 加权聚合**（直接照搬公式）：EvalBench 已计划用 primal gap，可把 `QUALITY = (1/N̂)Σ min(1, c*/c)` 的截断比作为 primal gap 的对偶表述（c*/c 即"专家达成度"），配合可行率作 YIELD，用 β=1 调和平均合成 QYI；跨问题汇总时用按实例数加权的 weighted QYI；同时逐问题分报 QUALITY/YIELD 以暴露"能解题但解得差"vs"解得好但常不可行"的权衡——这与我们三问题（TSP/装箱/调度）三档规模的结构完全同构。
  2. **成本-质量前沿散点图（图 2 右图范本）**：x 轴 = 估计 API 成本（$，由"每模型 token 实测 × 官方单价表"计算），y 轴 = QYI [0,1]，每模型一个点，专家基线画 y=1 参考线；搬法：预算控制器已记录每次调用 token 与单价 → 直接产出"每模型每问题每预算档"成本向量，与 QYI 一起画帕累托前沿，用"性价比最优点"（论文中 Gemini-2.5-Flash）做结论锚点。左图（Quality-Yield 平面 + QYI=0.2/0.4/0.6/0.8 双曲线等高线）也值得复刻，它能直观展示温度/预算档位移动时的质量-产量权衡。
  3. **SOLVE@i 三阶段漏斗 + 失败模式六分类日志**：把每次运行按 Stage I（可执行）/ II（产出合规解）/ III（约束可行）打标，形成"漏斗式"诊断表；执行异常自动归类 ImportError/SyntaxError/RuntimeError/TimeoutError/VerificationError/幻觉 API，跨模型堆叠成占比条形图（Fig 3 范本）。搬法：EvalBench 的失败标注复核流程可直接用这套枚举做分类法（taxonomy），且"反馈只回传演示集结果、评估集保密"的分割机制也一并照搬，防止迭代中向 LLM 泄漏考题。
- **局限**：
  1. 全部实验用 Python（易采用但执行慢）；C++ 初步实验显示单轮 yield 即可超 Python 十轮（0.7742 vs 0.7419，因快而免超时），但领域库依赖与并行代码生成难度使完整集成未完成。
  2. 智能体流水线仅用标准配置，未纳入高级提示工程/多智能体/上下文压缩策略——这既是局限也是他们声称的"通用 testbed"卖点。
  3. 代理指标（proxy metric）与真实世界性能有差距：科学域最终需物理实验验证、EDA 需耗时后端综合确认质量；长反馈回路的延迟管理是未解问题。
  4. 迭代自精化本质是测试时扩展（TTS），受 10 轮预算限制；best-of-N/束搜索等更充分搜索策略未系统展开（初步实验 2@5 与 1@10 相当：QYI 0.6160 vs 0.6170，但前者 quality 更高 0.7698）。
  5. 专家基线取"文献最好已知启发式"而非真最优（大规模实例最优不可得），QYI=1 的语义依赖基线质量；MIP 公式仅覆盖小实例。
  6. 消融显示敏感面：温度 0→1 提升 quality 但压 yield（质量-产量基本权衡）；反馈轮数并非越多越好（Gemini-2.5-Pro：1 轮 0.6253 / 5 轮 0.6259 / 10 轮 0.6170，过量反馈反噬）；few-shot 半量演示可能因不代表性而过拟合（half-shot 0.5361 < zero-shot 0.5999）。
  7. 评测对象限 2024 末–2025 中的 9 个大模型（排除小模型），模型迭代快、快照版本会过时；数据来自公开竞赛/基准，长期仍有污染风险（靠私测集缓解）。

---

## 附：关键数据备查（写综述/设计文档时直接引用）

**图 2 结构（成本-质量前沿图范本）**：双子图。左图：x=Yield [0,1]，y=Quality [0,1]，叠加 QYI=0.20/0.40/0.60/0.80 双曲线等高线；模型位置：Gemini-2.5-Pro 质量最高（~0.67），GPT-o4-mini 产量最高，Claude-3.7/Qwen3/DeepSeek-R1/Gemini-Flash 居中，LLaMA 双子垫底。右图：x=估计 API 成本（$，0–10），y=QYI（0–1）；GPT-o4-mini（~$9，QYI≈0.61）与 Gemini-2.5-Pro（~$6，0.62）在高成本高位，Gemini-2.5-Flash（~$2–4，0.57）与 DeepSeek-R1 构成左上高性价比区，LLaMA-3.3/Maverick 在左下角（便宜但 QYI≈0.30）；论文结论"Gemini-2.5-Flash 性价比最优"即取自该图（0.15/3.5 的单价 + 0.5682 的 QYI）。

**Table 3 总体 SOLVE@i（T=0）**：GPT-o4-mini-high SOLVE^III：@10=74.8% / @5=69.7% / @1=53.2%（全场最佳，且 SOLVE^I@1=100%）；DeepSeek-R1 73.4%/72.9%/44.0%；Gemini-2.5-Flash 67.4%（@1 仅 25.2%）；Gemini-2.5-Pro 65.1%；Claude-3.7-Sonnet 60.1%（@1 仅 9.2%，依赖迭代修复）；LLaMA 双子 <36%。迭代收益显著：GPT-o4-mini 从 @1 53.2% → @10 74.8%。

**Table 17 加权 QYI（T=0，capped）**：Gemini-2.5-Pro 0.6170 > Gemini-2.5-Flash 0.5682 > DeepSeek-R1 0.5498 > Claude-3.7 0.5034 > Qwen3-235B 0.4355 > DeepSeek-V3 0.3707 > LLaMA-4-Maverick 0.2955 ≈ LLaMA-3.3 0.2951（GPT-o4-mini-high 仅支持 T=1：0.6089）。摘要结论：顶级模型 QYI ≈ 0.6，远低于专家基线 1。

**案例研究（工艺映射，GPT-o4-mini-high，Fig 5 + 附录 F）**：迭代 1 无剪枝 cut 枚举 + DP（质量高但大实例超时）→ 迭代 2 矫枉过正改朴素 6-LUT 复制（全部通过但质量差）→ 迭代 3 静态剪枝（每节点截断 cut 至 M=20）→ 迭代 4 放宽 M=30 → 最终收敛于平衡产量/质量的 DP 策略取得最高 QYI；即便如此仍仅为专家工具 ABC（动态规划 + 优先 cut 剪枝）约 60% 水平。

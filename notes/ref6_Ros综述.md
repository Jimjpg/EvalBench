# 文献笔记：Large Language Models for Combinatorial Optimization: A Systematic Review
- **来源**：ACM Computing Surveys 58 (2025), DOI 10.1145/3801961（UniUd，Da Ros, Soprano, Di Gaspero, Roitero）。本笔记依据 arXiv 预印本全文：arXiv:2507.03637v1 (2025-07-04)，本地文件 `ros_review.pdf`，转换文本 `_md\ref6_ros_review.md`。该校级主页（smdc.uniud.it）标注正式卷期为 CSUR vol. 58, no. 11（Q1 期刊）。这是 LLM×CO 领域首篇 PRISMA 系统综述。

- **研究问题**：（系统综述的问题范围、检索方法、纳入文献数量）
  - 六个研究问题（RQ）：(i) LLM 目前如何应用于组合优化问题（COP）？(ii) 优化流程中哪些任务由 LLM 辅助？(iii) 哪些 LLM 架构与训练范式对 CO 最有效？(iv) 哪些应用领域在 CO 中使用 LLM？(v) 主要趋势？(vi) 可能的研究方向？
  - 检索方法：严格遵循 **PRISMA 2020** 指南；2025-01-07 检索 Scopus（1,396 条）与 Google Scholar（648 条），共 **2,044 条记录**、14 组查询（含 "NL4Opt"/"Ner4Opt"）；去重去无作者后 1,472 条筛题录；2025-01-13 引文追踪补充 420 条（去重后 319）；8 项纳入/排除标准（英文、主题须为"LLM 用于 CO"（排除"CO 用于 LLM"与连续优化）、≥2016 年、限定文献类型）；三人独立全文阅读 + 交叉核验 + 冲突仲裁。
  - 最终纳入 **103 项研究**（数据库 70 + 引文追踪 33）；其中 82 篇（80%）发表于 2024 年，17 篇 2023、4 篇 2022；**49% 为 arXiv 预印本**，期刊 25 篇（24%）、会议 28 篇（27%）；84 篇研究论文 + 11 篇综述 + 7 篇立场论文 + 1 篇技术报告。文献截至 2024 年底。

- **综述发现——LLM 用于 CO 的方法分类**：（按其分类体系归纳）
  - **第一层：按优化流程步骤分类**（86/103 篇实验研究，§6.1，附录 C 表4）。流程为：自然语言描述 → 问题建模 → 求解方法 → 验证 → 基准评测：
    - 问题建模 38 篇（37%）：领域知识抽取 11、实体识别 25、模型创建 25（常伴随代码生成）；
    - 求解方法 64 篇（63%，最大类）：**代码生成 36**（LLM 生成启发式/求解器代码，如 FunSearch、ReEvo 一系；30 篇产出 Python）、**直接生成解 28**（供元启发式初始解/进化算子/变异交叉用）、参数调优 4、算法选择 1；
    - 验证 9 篇（9%）：解验证 5、模型验证 6（如诊断不可行 MILP 的最小冲突约束子集）；
    - 基准评测 7 篇（7%）：可视化分析 3（如用 LLM 解释 Search Trajectory Networks）、可解释性 4（如 VRP 决策过程解释）；
    - 仅 24 篇（23%）覆盖流程中多个步骤。
  - **底层模型/算法类型**：LP 19 篇、MILP 18、CP 7、ILP 2、(元)启发式 20（启发式 9、超启发式 3、GA 3、EA 3）、多目标 3、SAT 1。LP 占比高源于 NL4Opt 竞赛。
  - **第二层：按 LLM 分类**（§6.2，附录 D 表5）：70 个 LLM、22 种架构；62 篇用生成式架构（**GPT-4 43 篇、GPT-3.5 24 篇**最多；LLaMa 2 9、Claude 3.5 7、LLaMa 3 7、DeepSeek 6、PaLM 2 3、Qwen 3、Mistral 2 等）；9 篇用文本输入架构（T5 3、BART 3、UnixCoder 1 等）；9 篇用 2024 年多模态架构（Gemini 5、Mixtral 2、GPT-4-Vision 1、OpenCoder 1）。
  - **应用领域**（§6.4，附录 F 表7）：64 篇涉及具体领域——路由 26（TSP/VRP/定向问题/旅行规划）、调度与规划 14（含 PFSP、会议排程）、网络与图 10、装箱 9、组合数学 4、工程 3、金融 3、生物信息 3、供应链 1、字符串 1；9 篇跨多领域（多基于 MIPLIB 等问题库）。

- **综述发现——评测方法学现状**：（重点：各研究用什么基准/实例规模/评价指标）
  - **专用基准数据集**（§6.3，附录 E 表6）：仅 29/103 篇使用为 LLM×CO 专门开发的基准。使用频次：LPWP/NL4Opt **16 篇**（最大：4,216 条 NL 问题描述、源自 1,101 个 LP 问题、6 个领域）；ComplexOR 3 篇（**仅 37 个问题**：25 LP + 12 MILP）；NLP4LP 3 篇（67 个问题，后被扩充至 200+）；IndustryOR 2 篇（8 个行业 100 个真实问题）；Mamo 2 篇（652 简单 + 211 复杂 LP）；GraphInstruct 2 篇（21 个图推理问题）。**其余数据集全部只被 1 篇研究使用，且多数就是提出该数据集的论文本身**（如 Almonacid 10 条 MiniZinc 指令、Michailidis 18 个 CP 问题、OptiChat 63 个不可行 MILP、OptiBench 816 问题 + ReSocratic-29k、SearchBench 1,107 实例、Ju et al. 旅行规划 17.37 万训练 + 2.18 万测试）。另有研究直接用经典 CO 问题库（MIPLIB、ASLIB）与通用数学推理数据集（GSM8K、MultiArith、AquA、BIG-Bench/Hard）。
  - **实例规模**：综述**未系统报告**各研究所用实例的规模（如 TSP 城市数），只汇总数据集的"问题条目数"——这本身说明原文献对此报告不规范，规模信息难以从二手文献回收。
  - **评价指标**（§6.2.1 末段 + 附录 D 表5 Metrics 列）：**无统一指标**。Accuracy 最常见但语义随任务而变；研究者常自定义"问题特定 score"；解质量多比较目标函数值与最优/已知最优解，最通用的是**最优性差距 gap = 100×(Z_llm − Z_best)/Z_best**；表5 还可见大量异构指标：Hypervolume、IGD、F1、PAR10、Compile/Runtime Error Rate、Correctness/Success Rate、API Call Rate、Throughput、Runtime、Rank 等。未来方向明言：COP 有多重表示、多种编码方式、常缺乏已知最优解，"**开发标准化评测协议与合适指标**"是待研究方向。

- **评测乱象清单**：（逐条，附原文位置——本笔记灵魂，直接支撑"为什么要做统一评测体系"的问题陈述）
  1. **基准规模小、碎片化、自产自销**：多数专用数据集仅 10~100 量级条目（Almonacid 10、Michailidis 18、ComplexOR 37、OptiChat 63、NLP4LP 67、IndustryOR 100），仅 NL4Opt/LPWP（16 篇）形成事实公共标准；§6.3 原文："The remaining datasets have been used exclusively in one out of the retrieved studies – many times this being the study proposing the dataset on the first place."（其余数据集均只被 1 篇研究使用——且往往就是提出该数据集的那篇）。
  2. **模型版本不统一、命名混乱、快速弃用**：103 篇研究动用 70 个 LLM/22 种架构；附录 D 说明："Overlapping naming conventions often create confusion, as the same term can refer to both a general architecture and specific models... it is sometimes unclear whether researchers fine-tuned a model directly or used a version adapted for conversational purposes"，未指明时综述只能退而标注 "Family"；§6.2.1：综述期间多款模型已弃用/被替换（Text-Davinci-003/Edit-001 → GPT-4-Turbo/GPT-4o；Bard→Gemini；PaLM 2→Gemini 1.x/2.x；LLaMa 2→3；Mixtral/Qwen/DeepSeek 均已换代），"Given the rapid evolution of LLMs, readers should consider the latest available models when interpreting our findings."
  3. **提示词不透明、输出非确定性**：§6.2.1："Documenting the exact prompts used is crucial, as LLMs are highly sensitive to prompt variations, which can lead to significantly different outcomes"；即使固定模型版本也无一致性保证——"there is no guarantee of consistent responses even when using different versions of the same models, especially since chat completions are not deterministic by default"。
  4. **模型信息彻底缺失**：§6.2.1："a limited number of studies (7) that conducted experiments in this area did not provide any details about the LLM employed"（7 篇实验研究完全不写用了什么 LLM）。
  5. **闭源模型依赖、付费门槛**：§6.2.1：多数高性能模型（OpenAI GPT-3.5/4、Google PaLM 2/Gemini、Anthropic Claude 3.5、Cohere Command-R+）"are closed source and require paid access"，Mixtral 经付费 API 商业化、DeepSeek-V2 许可更严；附录 D 表5 专设 F/P（免费/付费）与 O/C（开源/闭源）两列。§8：闭源系统"restricts access to their full methodologies and inner workings, which creates significant challenges for understanding and replicating the reported findings"。
  6. **正面结果偏倚（发表/选择偏倚）**：§8 Limitations 原文："following PRISMA guidelines might have led to the inclusion of too many studies that report positive outcomes or successful applications of LLM over those that do not, potentially overstating the effectiveness or applicability of LLM in this field due to inherent selection bias"——综述作者自认文献池系统性偏向 LLM 成功案例。
  7. **无标准化评测协议**：§7 Evaluation Protocol："Evaluating the performance of LLMs on COPs remains challenging due to several factors: problems can have multiple representations, various encoding methods, and often lack known optimal solutions... a promising research direction involves developing standardized evaluation protocols and identifying suitable metrics."
  8. **数据泄漏/训练集污染风险**：§6.2.1：了解 LLM 训练数据有助于识别"data leakage, biases, or knowledge gaps that might affect results"（引 Balloccu et al. "Leak, Cheat, Repeat"）；§6.3：SearchBench 刻意微调约束描述以"reduce the likelihood that LLMs encountered identical problems during their training phase"——撞题风险已被benchmark设计者正面应对。
  9. **预印本主导、评审缺位**：49% 纳入文献为 arXiv 预印本（§5.3.4 表2、§8），结论可信度参差。
  （小结：上述 1–9 条构成"小基准 + 快变模型 + 不可复现提示 + 闭源付费 + 正面偏倚"的系统性评测乱象图景，是 EvalBench 问题陈述的一手系统综述证据。）

- **成本与预算处理**：综述**没有系统收集或报告**各研究的 API 成本/推理成本/时间预算——通篇无 per-study cost 字段，这本身是显著缺口。仅有的相关内容：(a) 附录 D 表5 指标列零星出现 Runtime、Throughput、API Call Rate（如 GPT-3.5 Family 条目），属个别研究自发报告；(b) §6.1.5 指出传统 CO 基准评测惯例应含 computational times 与统计检验（如 Friedman 检验），但 LLM 研究普遍未继承；(c) §8/§9 呼吁关注 LLM 资源的环境成本，并援引 Singla et al. 将"响应质量 vs 推理成本"建为双目标 CO 问题；(d) 提及 GPT-3.5-Turbo 是面向"更低成本更快"的变体。**结论：成本报告在现有文献中近乎空白 → EvalBench 的"成本受控评测"定位恰好填补该空白。**

- **可搬进 EvalBench 的零件**：
  1. **优化流程四步分类框架**（问题建模/求解方法/验证/基准评测 + 二级活动：实体识别、模型创建、代码生成、解生成、参数调优、算法选择…）→ 直接用作 EvalBench 的任务维度设计（§6.1 + 附录 C）。
  2. **最优性差距指标** gap = 100×(Z_llm − Z_best)/Z_best 及"与 best-known 解对比"惯例 → EvalBench 核心指标之一。
  3. **基准数据集地图**（附录 E 表6）：NL4Opt/LPWP（最大、16 篇验证）、ComplexOR、NLP4LP、IndustryOR、Mamo、ORQUA、SearchBench 等 → 任务实例来源清单；NL4Opt 可作公共锚点基准。
  4. **表5 的 F/P（免费/付费）与 O/C（开源/闭源）标注体系** → EvalBench 模型卡（model card）必备字段，天然支持成本受控对比（闭源 API vs 本地开源模型）。
  5. **可复现报告检查单**（§6.2.1）：确切提示词、模型版本+日期戳（如 GPT-4-0613）、配置与微调情况、训练数据意识（泄漏排查）、预处理/后处理步骤 → EvalBench 运行日志 schema 的直接蓝本。
  6. **版本钉扎与日期戳惯例**："GPT-4-0613 (a version of GPT-4 released or fine-tuned on June 13, 2023)" 式记录 → EvalBench 强制字段。
  7. **SearchBench 的防撞题设计**（微调约束降低与训练集重合概率）→ 数据泄漏缓解策略。
  8. **传统 OR 评测实践移植**：computational times、统计检验（Friedman）、箱线图（§6.1.5）→ 与 LLM 评测（gap、accuracy）合并为统一报告。
  9. **"标准化评测协议"作为被明确呼吁的 open problem**（§7）→ EvalBench 立项正当性的直接引用源；结论 §9 还呼吁"开发评估与报告闭源模型的方法以提升透明度与可复现性"。

- **局限**：
  - 综述自身：领域演化极快，无法穷尽（文献截至 2024 年底，检索 2025 年 1 月）；证据质量受制于二手研究自身的偏倚；如上所述可能过度纳入正面结果；49% 预印本未经评审；包含闭源 LLM 研究导致复现困难；作者计划按 PRISMA 惯例做 living review 定期更新。
  - 范围限定：只覆盖"LLM 用于 CO"，刻意排除"CO 用于 LLM"（如用元启发式搜索提示词）与连续优化。
  - 对 EvalBench 而言的局限：不提供 per-study 实例规模、运行成本、提示词原文等底层细节（止步于分类计数），做问题陈述依据足够，做基准设计需回溯其所引一手文献；无定量元分析（无效果量合成）；指标部分仅罗列名称未深入比较优劣。

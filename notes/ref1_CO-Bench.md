# 文献笔记：CO-Bench: Benchmarking LLM Agents in Algorithm Search for Combinatorial Optimization
- **来源**：arXiv 2504.04310v1（2025-04-06 提交，Preprint / Under review）。作者：Weiwei Sun*、Shengyu Feng*（同等贡献）、Shanda Li、Yiming Yang，Carnegie Mellon University。代码与数据公开：https://github.com/sunnweiwei/CO-Bench 。定位：**第一个评测 LLM agent 为组合优化（CO）问题"开发算法"能力**（而非直接解题或调用求解器）的基准，环境设计沿用 MLE-bench（Chan et al., 2024）的"限时竞赛"范式。

- **研究问题**：
  LLM agent 能否只依据抽象的问题自然语言描述，在受控时间预算内**端到端地搜索出高效（甚至超越人类知识边界）的 CO 算法**？与（a）同等时间预算下人类专家手写算法、（b）通用求解器（Gurobi/OR-Tools）、（c）文献最优/已知最好解（best-known）相比如何？
  形式化（原文式 1–2）：CO 问题实例 p 上求 `min_{x∈S_c(p)} f_c(x;p) + g_c(x;p)`，其中 `g_c` 为约束违反项（可行解取 0，不可行取 +∞），记 `h_c(x;p) = f_c + g_c`；算法搜索问题为 `min_{A∈A} E_{p∼D, x∼A(p)}[h(x;p)]`。与神经 CO 求解器（直接用网络参数化 A）不同，CO-Bench 的搜索空间 **A 是符号化的**：所有可用 ≤d 个 token 的 Python 程序表示的算法（d 由 LLM 输出长度上限决定）；随机化算法的 A(p) 视为解的分布。
  **主要实验结论**（Table 2 / Figure 3-4）：
  1. 一次性生成（Direct Answer）中 **reasoning 模型稳定优于普通模型**：o3-mini(high) AvgScore 0.6495、Claude-3.7-Sonnet-Thinking 0.6500（均约 0.65），显著高于 GPT-4o（0.3999）、DeepSeek-V3（0.4348）；同家族内 DeepSeek-R1(0.4746) > DeepSeek-V3(0.4348)。
  2. **agent 框架显著放大 LLM 能力**：FunSearch(o3-mini-medium) AvgScore 0.8423（Table 2；正文写 0.8444，应为笔误），Greedy Refinement(o3-mini) 0.8401，两者均超过人类专家基线 0.8025；FunSearch 约在 50 步后收敛，且 o3-mini 的推理时扩展（inference-scaling）曲线优于 GPT-4o。
  3. **在 25 个问题上 AI 生成算法超过 30 分钟预算下的专家基线**（Greedy Refinement 的 Above Human = 0.6944 = 25/36），**在 3 个问题上超过文献已知最好解**（摘要原话 "on 3 problems, they surpassed the best-known solutions"）。
  4. 在 TSP/MIS 上与神经求解器（DIMES、DIFUSCO、T2T、LEHD+ReEvo）相比，相近时间预算下有竞争力（如 TSP-500：FunSearch 17.20 / 19.1min，Gurobi 16.55 / 45.6h）。

- **基准构成**：问题数 / 实例数 / 最大规模 / 数据来源
  - **36 个问题类型，6,482 个测试实例，最大测试实例 11,000 个变量**（如最大图的节点数）；每题另配若干实例组成开发集（dev set），开发期可见、测试集不可见。
  - 数据来源：**主要取自 OR-Library（Beasley, 1990）**——OR 界 30 余年积累的公开数据档案，经论文作者严格筛选与清洗；覆盖 8 个问题族：packing（装箱/背包/容器装载/不等圆与矩形装箱）、cutting（下料/切割）、facility location（仓库选址、p-median）、scheduling（飞机着陆、机组排班、公共工期、flow/job/open shop、混合重入车间）、routing（TSP、周期车辆路径、资源约束最短路）、assignment（约束/无约束指派）、tree（欧氏 Steiner、公司架构优化）、graph and set（最大独立集、图着色、均等划分、集合划分、集合覆盖）。
  - 每题人工标注三件套：(1) 自然语言形式化的问题描述 + 指定签名的 `solve()` 起始代码；(2) `load_data()` 数据加载/预处理函数；(3) 严格稳健的 `eval_func` 评测函数。
  - 与现有基准对比（原文 Table 1，⋆ 为基于 GitHub 公开处理数据的统计）：

    | 基准 | 支持算法开发 | 问题类型数 | 测试实例数 | 最大变量数 |
    |---|---|---|---|---|
    | **CO-Bench** | ✓ | **36** | **6,482** | **11,000** |
    | NPHardEval | ✗ | 9 | 900 | 24 |
    | NL4OPT | ✗ | 5 | 289 | 3 |
    | OptiBench | ✗ | 4 | 605 | 18 |
    | ComplexOR | ✗ | 20⋆ | 100 | 9⋆ |
    | ReEvo | ✓ | 7 | 597 | 1,000 |

    差异点：既有基准要么把 CO 当 QA 题（GraphArena 等），要么只测"调用现成求解器/建模"的正确性（小规模、参数可完整写进 prompt）；CO-Bench 强调**大规模实例上的算法效率**与端到端算法搜索。

- **指标定义**（逐条抄录式 (5)–(9) 及规则）：
  1. **AvgScore**（主指标，类似 Primal Gap，Berthold 2006）——候选解原始目标值 h(x,p) 对预计算的最优/已知最好目标值 h*_p 的归一化：
     `s(x,p) = min{|h(x,p)|, |h*_p|} / max{|h(x,p)|, |h*_p|}`（式 5）
     越高越好，1 表示达到最优/已知最好；**程序报错或不可行解一律计 0.0 分**。某求解器在某问题上的得分 = 其所有测试实例得分的平均；基准总分 = 36 个问题级得分的平均（双层宏平均）。
  2. **Valid Solution**——生成代码在**该问题全部测试实例上都正确**的问题占比；任一实例抛错（约束违反、超时等）即记 invalid 信号，则**整题判无效**（即使其他实例结果有效）。
  3. **BTScore（Bradley-Terry Score）**——`P(i ≻ j) = θ_i / (θ_i + θ_j)`（式 6）。每个评测实例上所有模型两两比较：分高者胜，平局各计半胜；`W_i = Σ_{j≠i} w_ij`（式 8）；能力参数迭代更新 `θ_i^(t+1) = W_i / Σ_{j≠i} [ n_ij / (θ_i^(t) + θ_j^(t)) ]`（式 9），初值全 1，迭代至最大变化 < 1e-6 或达迭代上限。
  4. **Above Human**——在 30 分钟预算内超过人类专家基线的问题占比（Table 2 注写 "test instances"，§3.3 定义为 "portion of problems"，按 0.6944=25/36 核对应为问题级）。
  5. **Survival Rate**——每个问题中，得分**高于参考分（文献报告的最优/已知最好解分数）99%** 的测试实例占比；高门槛指标，只有非常接近或超过历史最好算法才得分。

- **成本与预算处理**：
  - **三层预算上限机制**：(a) 每个测试实例求解限时 **10 秒（单 CPU）**，刻意使多数实例上精确求解不可行，超时/报错计 0 分；(b) agent 开发期最多 **64 个 research steps**，每一步定义为"向评测系统提交一次候选解并在开发集上观察一次评测结果"；(c) 人机对齐的 **每题约 30 分钟研究预算**（Figure 4 明确 "within a 30-minute budget"）。
  - **时间有记录**：Table 3 报告各方法在 TSP-500/1000/10000、ER-Small/Large 上的求解时间（Gurobi TSP-500 需 45.6h vs GreedyRefine 19.1min；FunSearch 在 TSP-10000 仅 2.5min）；人类专家的中间解按时间记录，可与 agent 的 score-vs-steps 曲线同图对比。
  - **token 未记录**：正文与附录均无 token 消耗 / API 费用统计——"等时间预算"未覆盖"等金钱/算力预算"维度，这是其成本控制叙事的主要缺口（对我们项目恰是切入点）。

- **可复现处理**：
  - 代码+数据公开（GitHub: sunnweiwei/CO-Bench）；数据源自公开 OR-Library；每题的问题描述、`load_data`、`eval_func`、dev/test 划分随库发布。
  - 评测管线：agent 在沙箱（Linux 机器）中工作，仅获得问题描述 + 开发集 + **提交 API 端点**；独立评测系统带内置安全防护、**并行**对开发集打分；开发期内 `eval_func` 与测试数据均不可见（防偷看/过拟合）；有限步数后提交最终解上测试集。
  - 模型版本：15 个模型（5 开源 + 10 闭源），表格中标注具体版本与 reasoning effort 档位（o3-mini medium/high、o1 medium/high 等），参考文献给出部分模型的访问日期（2025-03-24）；**但正文未说明 API snapshot/随机种子锁定机制，也未声明 prompt 全量公开**（论文反而批评先前工作依赖 handcrafted prompts）。
  - 基线可复现性：Gurobi/OR-Tools 的问题建模由 o3-mini(high) 起草 + 人工修订保证正确性；神经求解器（DIMES/DIFUSCO/T2T）数字直接取自原论文（跨环境可比性存疑）。

- **报告的 LLM 失败模式**（逐条）：
  1. **一次性生成常不可执行/次优**（§2.2）：one-time generation 通常产生 inexecutable code 或 suboptimal algorithms，需 agent 框架做迭代精化。
  2. **可行性约束处理不足**（§5.1 + 结论）：从 Valid Solution 看，一次性生成 LLM 正确率仅约 30%（o3-mini(high) 0.3888），最好的 agent 也只有 0.5555（Greedy Refinement / ReEvo），远低于人类专家 0.6111——"current agents often struggle to ensure the feasibility of solutions"、"they struggle to understand the problem constraints"；任何实例上的约束违反即整题判无效，放大了这一短板。
  3. **规划能力弱，复杂框架不如随机采样**（§5.1）：AIDE（0.7534）反而低于简单得多的 BestOfN（0.7743）——"planning capabilities of these agents are still preliminary and often fail to outperform random sampling"。
  4. **算法新颖性有限**（§5.4 案例 + 摘要）：TSP 上的全部改进点都是成熟技术的组合：向量化数据结构与 K-D 树提速 → 增加搜索迭代数 + 扰动逃离局部最优 → 引入模拟退火平衡探索/利用 → 按实例规模切换自适应启发式；结论是 "LLMs excel at applying established techniques … despite the lack of algorithmic novelty"。
  5. **重试错、轻创新**（结论段）："rely heavily on trial-and-error rather than innovative thinking"，呼吁提升问题理解与创造性推理。
  6. 佐证数字：通用求解器直接硬套 36 题效果差（OR-Tools AvgScore 0.3005、Gurobi 0.3161，Valid Solution 仅 0.0833/0.2500），说明"会建模≠会算法"，也侧面刻画了任务难度结构。

- **可搬进 EvalBench 的零件**（3 个，含搬法）：
  1. **等时间预算人机公平比较协议**（§3.2，源自 Re-Bench，Wijk et al. 2024）。机制：每题固定 wall-clock 预算（30 min）；人类专家在预算内可用**任意**工具——搜索引擎、任何 AI、开发集、任何软件包——以模拟真实场景、避免"束缚人类"的质疑；人类是领域专家（论文作者，相关方向多篇发表）；**人类中间解按时间记录**，与 agent 的步数轨迹在同一横轴（时间/步数）上对比，Above-Human 按问题数计比例。搬法：EvalBench 为每个任务设统一 budget（课程规模可降到 15 min/题），所有被评对象（模型、agent、人类基线）共用同一提交-评分管线；每次提交记录 (时间戳, 代码哈希, dev 分数)，取预算截止时刻最佳提交计分，绘制 score-vs-time 曲线；人类基线请 2–3 名有 OR 背景的同学在受控环境完成并留存过程解，供审计与轨迹对比。
  2. **min/max 比值归一化 + 零分哨兵 + 双层宏平均**（式 5）。机制：`s = min{|h|,|h*|}/max{|h|,|h*|}` 无需约定目标值符号即稳健；报错/不可行/超时三类失败统一计 0 并打原因标签；问题分 = 实例均分、总分 = 问题均分，防止实例多的任务主导排名。搬法：EvalBench 每题预存 h*（最优或 best-known），评分器内置 timeout/error/infeasible 哨兵与失败原因统计；再补一个 Survival-Rate 式阈值指标（≥99% 参考分才计存活）作为高门槛排名，与 AvgScore 形成"平均质量/顶尖质量"双视图。
  3. **dev/test 隔离的沙箱提交评测 + 步数记账**（§3.1 + §4.2）。机制：agent 只见题目描述、dev 集、提交 API；`eval_func` 与测试集开发期不可见；独立评测系统并行打分；每实例硬限时（10 s/单 CPU）；每步提交全部入账，最终取 dev 最优进测试集。搬法：EvalBench 实现一个轻量 submission server（POST 代码包 → Docker 沙箱限时运行 → 返回 dev 分数与错误栈），测试集与评测脚本哈希锁定、评测期末才解封；提交流水自动产出 score-vs-steps 曲线，并**在每步记账中加记 token 用量与费用**——正好补上 CO-Bench 未做的成本核算，实现"成本受控"的评测目标。

- **局限**：
  - 论文自述（LLM/agent 层面）：算法新颖性有限（只是既有技术的组合与工程优化）；可行性/约束处理不足（Valid Solution 大幅低于人类）；规划能力弱（AIDE 不敌 BestOfN）；依赖试错而非创新思维；对问题约束理解不足。
  - 论文自述（基准层面，Broader Impact）：不评估所发现算法的社会/伦理影响（如公平性、资源分配偏差）；提醒勿在无人类监督时过度依赖 LLM 输出。
  - 笔记作者观察（非原文）：(a) **成本维度缺位**——无 token/费用统计，"30 分钟"预算未换算成可比较的算力成本；(b) 人类基线由论文作者自任，虽保证专家水平，但出题人对题目的熟悉度可能高于一般专家，且每题仅单一专家样本；(c) 10 s/实例的统一限时对不同问题族的"难度含义"不等价，跨题可比性仅靠归一化分数部分缓解；(d) min/max 比值在 h 与 h* 符号相反或跨越 0 时会失真（如 h=−5, h*=3 得 s=0.6，明显高估），EvalBench 选题时需检查目标值取值区间；(e) 神经基线数字取自原论文、运行环境未必一致；(f) 行文存在小不一致（FunSearch 0.8444 vs 表内 0.8423；Above Human 的 instances/problems 两种表述），引用数字时以 Table 2 为准。

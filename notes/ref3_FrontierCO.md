# 文献笔记：FrontierCO: Real-World and Large-Scale Evaluation of Machine Learning Solvers for Combinatorial Optimization

- **来源**：ICLR 2026（CMU 计算机学院，Shengyu Feng*、Weiwei Sun*、Shanda Li、Ameet Talwalk、Yiming Yang；*共同一作）。数据集：https://huggingface.co/datasets/CO-Bench/FrontierCO ；代码：https://github.com/sunnweiwei/FrontierCO

- **研究问题**：ML 求解器（端到端神经求解器 + LLM 符号求解器/agent）能否在**真实世界结构与极端规模**的 CO 问题上匹配或超越 SOTA 人工设计求解器？论文指出现有 ML4CO 基准的三大缺陷：(i) 规模（scale）——多用比真实应用小若干数量级的 toy 实例（如早期神经 TSP 研究 ≤100 节点，DIMES 也只到 10K）；(ii) 真实性（realism）——合成数据缺乏结构多样性；(iii) 数据真实性与覆盖——依赖合成生成器，无法洞察不规则、非欧氏、竞赛级实例上的表现（经典求解器日常处理这类实例）。此前文献报告的进展因此可能被高估：LEHD 在标准合成基准上仅 0.72% gap，在本基准 easy TSP 上扩大到 10%、hard TSP 上达 77%。

- **基准构成**：8 个 CO 问题、五大类——路径规划（TSP、CVRP）、调度（FJSP）、设施选址（CFLP、CPMP）、图问题（MIS、MDS）、树问题（STP）。测试实例全部来自竞赛与公开仓库：TSPLib、DIMACS 挑战（2nd 最大团挑战→MIS 补图；8th TSP；11th Steiner 树；12th VRP）、CFLP 测试床（Avella & Boccia 2009 TestBed1 / Avella et al. 2009 TestBedB）、PACE Challenge 2025（MDS）、BHOSLib（SAT 归约 MIS）、CVRPLib、SteinLib、GB21-MH、OR-Brescia 等；附录 F 另加非欧 ATSP（Jordan Srour & van de Velde 2013 真实数据）。
  - **easy/hard 双测试集**（每问题各一套）：easy = 历史上有挑战、但现在 SOTA 经典求解器 1 小时预算内 optimality gap < 1% 可解（用于验证 ML 基线有效性，且能拿到可靠 c*）；hard = 开放或计算密集（多数无已知最优解、现有启发式无法企及），**不易被 heuristic hacking**（防止神经求解器依赖手工解码策略或记忆先验解）。hard **不按规模定义**，而强调结构复杂案例（如 STP 的 PUC 超立方图仅 64–4,096 节点却多数 1 小时内 SCIP-Jack 解不动、缺乏已知最优；MIS 的 SAT 诱导实例 BHOSLib 仅 1,150–4,000 节点）。
  - 实例数与规模（Table 1，easy/hard）：MIS 36/16 个，节点 1,404–7,995,464 / 1,150–4,000；MDS 20/20 个，节点 2,671–675,952 / 1,053,686–4,298,062；TSP 29/19 个，城市 1,002–18,512 / 10,000–**10,000,000**；CVRP 20/10 个，城市 200–483 / 3,000–30,000；CFLP 20/30 个（附录 B.5），设施 1,000/2,000、客户 1,000/2,000；CPMP 31/12 个，设施 100–4,461 / 10,510–498,378；FJSP（Behnke & Geiger + Naderi & Roshanaei）10–100 作业、10–60 机器；STP（Vienna-GEO + PUC）节点 7,565–71,184 / 64–4,096。合计约 300+ 测试实例。
  - **规模对比**：TSP 达 10M 节点、MIS 达 8M 节点（7,995,464），对比此前 ML 评测 TSP 10K（DIMES）/MIS 11K（Qiu et al. 2022），高出约三个数量级。
  - 训练/验证数据由问题特定合成生成器生成（与测试同分布族但规模/结构有差异，见"可复现处理"）。
  - **评测对象 = 16 个代表性 ML 求解器 vs SOTA 经典求解器**（跨范式统一评测）。ML 阵营三类：端到端神经求解器/神经增强启发式共 14 个（正文 3.2 节）——MIS/MDS：DiffUCO（无监督扩散，拉格朗日松弛目标）、SDDS（DiffUCO 可扩展版）、RLNN（强制采样距离的神经采样框架）；TSP/CVRP：LEHD（混合编码器-解码器）、DIFUSCO（图扩散）、SIL（线性复杂度 transformer，可达 10 万城市）、DeepACO（神经增强蚁群）；MIP 类：tMDP（分支过程树状 MDP 的 RL）、SORREL（次优示范+自模仿分支）、GCNN（GNN 引导 branch-and-bound）、IL-LNS/CL-LNS（神经大邻域搜索）；FJSP：MPGN（多指针图网络 RL）、L-RHO（学习引导滚动时域）；STP 因缺乏现成神经方法，补 RL/SL 基线预测 Steiner 点 + Takahashi–Matsuyama (1980) 算法解码。LLM agent 3 个（正文 3.3 节，按 CO-Bench 评测协议 Sun et al. 2025）：FunSearch（进化搜索+回溯剪枝）、Self-Refine（反馈驱动自精炼）、ReEvo（反思进化的超启发式 agent），在全部 8 个问题上评测。SOTA 经典基线：KaMIS（MIS）、LKH-3（TSP）、HGS（CVRP）、GB21-MH（CPMP 混合元启发式）、SCIP-Jack（STP，精确）；无主导问题专用求解器的用商业求解器 Gurobi（MDS、CFLP，MIP）与 CPLEX（FJSP，约束规划）；其中 Gurobi/CPLEX/SCIP-Jack 为精确求解器，其余为启发式。

- **指标定义**：
  - 统一形式化（式 1，沿 Papadimitriou & Steiglitz 1982 记号）：min_{x∈X_s} c(x) = cost(x;s) + valid(x;s)，其中 cost(x;s) 为问题特定目标（如路由的路径长度），valid(x;s) 惩罚约束违反——x 不可行取 ∞、可行取 0；所有最大化问题通过目标取负统一转为最小化版本评测。
  - **primal gap（式 2，核心统一质量指标）**：

    pg(x;s) = 1，若 x 不可行（infeasible）或 cost(x;s)·c* < 0；

    pg(x;s) = |cost(x;s) − c*| / max{|cost(x;s)|, |c*|}，否则。

    其中 c* 为实例 s 的（预计算）最优或最好已知成本（BKS）。
  - 性质：严格有界 [0,1]（0 最优、1 最差）；任何可行解的 gap 严格小于 1；不可行解一律置 1 以标记失败，符合"不可行解永不优于可行解"的直觉。脚注 1 指出该定义与路由文献常用 gap（Kool 2019、Sun & Yang 2023、Luo 2023，即相对 c* 的百分比，可超 100%）不同。
  - **渊源**：该指标源自经典求解器 primal heuristic 评测——Berthold (2006, ZIB 博士论文 Primal Heuristics for Mixed Integer Programs)、Berthold (2013, Operations Research Letters, Measuring the Impact of Primal Heuristics)、Achterberg et al. (2012)、11th DIMACS Implementation Challenge (2013-2014)，后被近期神经求解器采用（Nair et al. 2020、Chmiela et al. 2021、Huang et al. 2023）。
  - 汇总方式：primal gap 取**算术平均**（±标准差），求解时间取**几何平均**（±几何标准差）；不可行/超时统一记 gap = 1、time = 3600 s。求解时间仅作参考（受 CPU vs GPU、精确 vs 启发式、C++ vs Python 影响大），primal gap 为主指标。

- **成本与预算处理**：
  - **时间预算上限**：每实例最长求解 1 小时（3600 s）；不可行解或超时未得可行解 → gap=1 且 time=3600 s（表 4–11 中标 * 的方法即至少一例 OOM/超时）。
  - **LLM agent 两级预算**：开发阶段 64 次迭代、每次 dev 集评估超时 300 s（提示 LLM 按 3600 s 超时编写算法）；迭代结束后最佳 dev 代码在测试集以 3600 s 超时终评。即 LLM 方法每实例总成本 ≈ 64×300 s 开发 + 3600 s 测试。
  - **硬件标准化**：经典与 ML 求解器限单 CPU core（dual AMD EPYC 7313 16-Core），神经求解器另配单块 NVIDIA RTX A6000 GPU。
  - **未记录 token 数/API 花费**：全文无 token 计数或货币成本量化；附录 G 仅定性讨论部署成本——神经求解器重度依赖 GPU 且内存远超经典求解器、部署更贵；LLM 求解器在进化/开发阶段消耗大量 API credits 或训练资源，但定稿后推理（部署）成本较低。这是该工作与我们"成本受控评测"目标的关键缺口。

- **可复现处理**：
  - **数据公开**：HuggingFace 数据集 CO-Bench/FrontierCO（含测试集与 BKS）。
  - **代码公开**：GitHub sunnweiwei/FrontierCO（经典求解器、BKS 计算、LLM agent 求解器全套代码）；神经求解器取各方法**官方公开仓库**实现，附录 C.1 逐个锁定 checkpoint 与超参（如 DiffUCO/SDDS 用官方 RB-Large 训练 checkpoint、MIS 推理步数增至 50、MDS-easy 回归默认 3 步；DIFUSCO 用官方 TSP-10000 checkpoint + greedy+2-OPT 解码；LEHD 用官方最优 TSP/CVRP checkpoint、PRC 解码迭代至 3600 s 预算耗尽；GCNN 的 CFLP 模型由 10,000 实例上的 100,000 强分支样本训练等）。
  - **BKS 标准化**：从公开文献与竞赛排行榜收集，并用对应 SOTA 求解器在作者服务器上验证；对缺 BKS 的实例（MDS 的 PACE 2025）或文献过时的（CFLP），用指定 SOTA 求解器跑至多 2 小时获得高质量参考解——解决自生成合成测试集因随机种子、Python 版本等实现细节导致的跨论文不可比问题。
  - **训练/验证资源标准化**：为神经求解器提供标准化训练集、为 LLM agent 提供 development set（附录 B 逐问题给出生成器与规模：MIS 用 RB 模型 800–1,200 节点 20 个；MDS 用 Barabási–Albert 图 800–1,200 节点 20 个；TSP 单位方均匀采样、复用 1,000 节点 DIMACS 实例做 LLM 验证；CVRP 按 DeepACO 协议 20/100/500 城市各 5 个；CFLP 按 Cornuejols et al. 1991 生成 100×100 共 20 个；CPMP 按 Osman 法 500 设施、medians∈{5,10,20,50} 各 5 个；FJSP 20 机器 10 作业 20 个；STP 超立方 6–10 维 10 个 LLM 验证实例 + GeoSteiner 25,000 节点 + 45 个改编 TSPLib 训练实例）。
  - **防泄漏工具包**：提供 dataloader、评估函数、抽象求解模板（自然语言问题描述 + 指定输入输出格式的 Python starter code，附录 C.3 有 TSP 示例）；dataloader 与评估函数对 agent 隐藏以防数据泄漏。
  - **LLM 设置部分锁定**：Self-Refine 用 o4-mini（medium reasoning budget、默认采样参数）64 迭代；FunSearch 用官方实现改 prompt（10 岛、每 prompt 2 函数、reset 周期 2 小时、64 迭代）；ReEvo 用官方实现（种群 10、初始 4、变异率 0.5、64 迭代）。但 FunSearch/ReEvo 底层模型版本在文中未明确写出——模型版本锁定不完全。附录 A 声明 LLM 仅用于辅助（适配基线、处理数据、画图、润色），不参与数据收集/实验设计/结果分析。

- **报告的 LLM 失败模式**（逐条，含出处。先列论文三大核心发现：(i) ML 方法仍显著落后 SOTA 人工求解器，且 hard 实例上差距更大（LEHD 从合成基准 0.72% 恶化到 easy TSP 10%、hard TSP 77%，主因是训练/测试间规模与结构分布偏移）；(ii) 神经方法能增强简单启发式，但受限于可扩展性、非局部结构、分布偏移——消融显示 DIFUSCO 显著优于 2-OPT（TSP-easy 4.19% vs 20.09%）、GCNN 显著优于 SCIP（CFLP-easy 3.22% vs 6.50%），但 LKH-3（0.03%）/Gurobi（0.00%）仍远优，即神经增益只在弱基础算法上实现；过参数化导致 8 个问题中 4 个出现 OOM，LEHD 在最大 TSP 实例需自回归跑 transformer 10M 步、1 小时内无解；快速模式对比（Table 12）中 LKH-3 POPMUSIC 在 18,512 节点仅 5 s 近优，DIFUSCO 需多 6 分钟、LEHD 超 1 小时才得单个可行解；非欧 STP 上 GNN 训练 F1 毫无进展（欧氏图则快速收敛），证明现有 GNN 隐式依赖局部性、无法捕捉全局结构；(iii) LLM 求解器有时超越 SOTA（Self-Refine easy MIS 1.30% 超 KaMIS 1.51%；FunSearch hard CVRP 6.52% 超 HGS 6.74%）但方差极大，"high variance due to their incapability in understanding effectiveness of different algorithms"。LLM 侧失败模式细列如下）：
  1. **高方差、无法评估算法有效性**：LLM 虽接触过多样人工启发式并能新颖组合，但"generally lack the ability to reliably assess the effectiveness of the generated algorithms"，每次采样可能随机得到不同且未必有效的策略——表现为 hard CVRP 上与 SOTA HGS 相当（FunSearch 6.52% vs 6.74% 甚至反超）、却在同为路由问题的 TSP 上惨败（FunSearch 35.82%、ReEvo 37.77% vs LKH-3 2.89%）。
  2. **缺乏内部推理能力**：将其适用性限制在 hard-to-verify 任务之外，当前 agent 框架强依赖外部反馈、只聚焦"难但易验证"的问题。
  3. **资源安全风险**：对大实例生成资源密集型算法，演化期间频繁 OOM（CPMP 上 FunSearch hard 达 77.32%、Self-Refine 74.05%、ReEvo 70.64%，均含不可行运行）。
  4. **无新颖算法推理**：词云分析（Figure 4）显示生成算法集中于经典元启发式（模拟退火 SA、大邻域搜索 LNS 为基础），"cannot be mapped to existing ones" 的新算法未出现，只是复现已知元启发式与问题特定技术。
  5. **多数设置仍逊于 SOTA**：三 agent 平均 gap（Table 2）FunSearch 20.35%（easy 10.05%/hard 30.65%）、Self-Refine 15.11%（8.18%/22.03%）、ReEvo 13.25%（7.25%/19.25%），hard 集全面劣化；个别问题灾难性失败（MDS-hard FunSearch 95.21%；CFLP-easy Self-Refine 27.08%）。
  6. **效率劣势**：所有 LLM agent 在所有测试集均打满 3600 s（KaMIS 仅 223 s 等），纯时间维度无竞争力。
  7. **数值不稳定**：结果标准差大（如 FunSearch TSP-hard ±25.62%、MDS-easy ±48.67%），跨问题/跨运行表现抖动。
  - 同时报告正面案例：Self-Refine 在 easy MIS 超越 KaMIS（1.30% vs 1.51%），其生成算法具算法精巧性——kernelization 化简 + Tomita 式 max-clique 精确解小核 + ARW 式启发式（解池、交叉、path-relinking）；FunSearch 在 hard CVRP 超 HGS（构建 Iterated Local Search + regret insertion + Variable Neighborhood Descent）；且性能不关键依赖集成现有求解器，可自主构建合理且常有效的算法，在 zero/few-shot 算法设计场景有潜力。

- **可搬进 EvalBench 的零件**（3 个）：
  1. **primal gap 双分支公式作为统一质量指标**：逐字搬式 (2)——不可行或 cost(x;s)·c*<0 时 pg=1，否则 pg=|cost−c*|/max{|cost|,|c*|}；配套三条工程规则：(a) 所有问题统一转最小化（最大化问题目标取负），valid(x;s) 用 ∞/0 二值罚纳入统一目标；(b) 不可行解一律 gap=1 并记满预算时间，杜绝"部分可行"的灰色计分；(c) gap 取算术平均、时间取几何平均汇总。落地法：在我们三个问题上，小实例用精确求解器预计算 c*，大实例跑 1–2 小时参考求解器得 BKS 存库（沿其"BKS 标准化+验证"流程）；好处是指标有界 [0,1]、跨问题跨范式可比，且可直接与经典 OR 文献（Berthold 2006/2013、DIMACS 挑战）对话。
  2. **easy/hard 双测试集机制**：搬其"难度按可解性而非规模"的定义——easy 集 = 现有 SOTA 求解器 1 小时内 gap<1% 可解、有可靠 c* 的历史难题（验证 LLM 生成求解器的可信度、提供真值），hard 集 = 开放/计算密集、无已知最优、含结构病态实例（提供区分度并防 heuristic hacking 与记忆先验解）。落地法：在我们三个问题上各建两档，例如 TSP：easy 用 TSPLib 千级节点已知最优实例、hard 用 DIMACS 万级+或非欧 ATSP；并在 easy 集上额外报告"LLM 是否复现/超越经典算法"的可验证结论，在 hard 集上只比 gap 不比最优性声明。
  3. **两级预算 + 失败统一计分 + 隐藏评估工具包**：搬其成本控制骨架——LLM agent 开发阶段限定 N 次迭代×短超时（300 s×64）、终评一次 3600 s 超时，总成本上限 = N×300+3600 s 可预估；OOM/超时/不可行统一记 gap=1、time=3600 s，使失败也有确定成本；dataloader 与评估函数对 agent 隐藏、只暴露自然语言问题描述 + starter code（含 yield 式多解流接口），防止数据泄漏与针对测试集过拟合。此零件直接实现我们"成本受控、可复现"的核心诉求，且可把其未做的 token 计数补上，形成"时间预算 + token 预算"双上限。

- **局限**：
  1. **BKS 依赖**：gap 相对 BKS 计算，hard 集无已知最优时绝对值不反映实例内在难度（原文自认）；BKS 本身由求解器 2 小时运行给出，可能有偏。
  2. **成本记录不完整**：无 token/API 花费量化，只有定性部署成本讨论（附录 G）；LLM 方法每实例约 64×300 s + 3600 s 的复合成本未被显式核算，"公平比较"在总计算资源维度上不成立。
  3. **时间仅作参考**：因硬件/求解器类型/实现语言差异放弃时间主指标，且所有 LLM agent 均打满 3600 s，时间维度信息量低。
  4. **SOTA 基线可能有保守偏差**：FJSP 最强方法（Naderi & Roshanaei 的 CP-based Benders 分解）代码不公开，只能退而用 CPLEX CP；MDS/CFLP 用通用 Gurobi 而非问题专用最强算法——经典上界或被低估。
  5. **硬件不对称**：神经求解器额外获 A6000 GPU，与经典求解器单核 CPU 的时间对比不完全公平（虽为通行做法）。
  6. **LLM 覆盖窄**：仅 3 种 agent 框架、Self-Refine 单一模型 o4-mini，未系统比较不同 LLM 底座与版本；FunSearch/ReEvo 底层模型未披露，模型版本锁定不完全。
  7. **训练/验证仍是合成分布**：标准训练资源与真实测试集存在有意为之的分布偏移，测的是泛化而非同分布上限——对以"评测体系设计"为目标的我们而言，需注意其结论混入了"分布偏移"这一干预变量。
  8. **规模的双刃剑**：10M 级实例使多数神经方法直接 OOM/超时，hard 集上大量 gap=1 的记录更多反映"能否产出可行解"而非解质量梯度，区分度在极端规模上反而下降（如 MDS-hard 神经方法全部 100%）。

# 文献笔记：Large Language Models are Edge-Case Generators (FuzzGPT)
- **来源**：ICSE 2024（UIUC，Yinlin Deng, Chunqiu Steven Xia, Chenyuan Yang, Shizhuo Dylan Zhang, Shujing Yang, Lingming Zhang），DOI 10.1145/3597503.3623343。Artifact 公开：https://github.com/ise-uiuc/FuzzGPT 。**入选理由（本项目视角）**：它不是 OR 基准论文，而是 DL 库模糊测试论文；其方法论价值在于"用历史失败样本做种子，引导 LLM 生成同分布的更刁钻测试输入"，可直接迁移到 EvalBench 的"失败模式驱动的困难 CO 实例生成"模块（见"方法论迁移"节）。

- **研究问题**：
  如何让 LLM 生成**不寻常（unusual）的程序**来模糊测试 DL 库（PyTorch/TensorFlow）？背景动机分两层：
  1. **任务难点**：DL 库的 fuzzing 输入是完整 Python 程序，须同时满足 Python 语法/语义（动态类型）与张量/算子约束（如乘法要求维度匹配），人工构造生成器成本极高；TitanFuzz（ISSTA'23，同组前作）首次证明 LLM 隐式学到了这些约束、能生成**有效**程序。
  2. **TitanFuzz 的缺口（本文切入点）**：LLM 生成基于 token 自然性（naturalness，Hindle et al.），倾向于产出与预训练语料（GitHub）中典型程序相似的**普通程序**，只能覆盖常见/标准库行为；而 fuzzing 恰恰需要边缘输入——非常规 dtype 组合、维度错配、特殊值（NaN）、0 维张量等（论文 Figure 1：文档标准用法是两个同 dtype 的 int8 张量做 `torch.logical_or`，而历史 bug 代码是 bfloat16 与 float32 混用且 `out=` 写入 float64 空张量）。
  **核心假设**：历史 bug 触发程序包含对找 bug 重要的**稀有/有价值的代码成分**（rare/valuable code ingredients）。先前利用该假设的工作（LangFuzz、JavaTailor 等）需要大量人工设计专用生成器并保证语法/语义有效性；本文证明这一过程可由 LLM 的 in-context learning 与 fine-tuning **全自动**完成。

- **方法构成**：种子来源 / 三种注入方式 / 目标系统
  - **种子来源（§3.1 数据集构建）**：HTML 爬虫（requests 库）抓取目标库 GitHub 仓库的全部 issues 和 PRs，从两个来源提取 bug 触发代码块并拼接：(1) 关联 accepted/pending PR 的 issue 中的复现代码；(2) PR commit messages 中的代码块（有些 PR 不开 issue 直接修 bug）。同时提取 issue/PR 标题作为 bug 描述。清洗规则：过滤错误消息、删除仅含执行输入/输出的行、必须通过语法检查、长度 ≤256 tokens。最终 **PyTorch 1750 条、TensorFlow 633 条**（TF 较少因其开发者不活跃、PR 里少有代码块）。
  - **自动 buggy API 标注（self-training）**：每段代码常调用多个 API，真正的 buggy API 不明确。人工标注 K=6 个示例作 few-shot 示例，让 Codex 以 temperature=0（确定性贪心解码）为其余片段预测 buggy API 标签——类似自训练：小标注集放大到大标注集。标注精度 76%（随机选 API 仅 26%）；消融显示**即使随机标注也能超过不微调的 CodeGen-6B**——标注不必精确，只要 (API, 代码) 对中 API 确实出现在代码里，模型仍能学会"生成调用目标 API 的程序"这一基本任务。
  - **三种注入方式（§3.2，对应 LLM 的两大适配范式）**：
    1. **Few-shot（in-context）**：prompt 前置 K 个示例，每条为 (API 名, bug 描述=issue/PR 标题, bug 触发代码) 三元组，末尾接目标 API 查询；借鉴 Chain-of-Thought：让模型**先生成 "Bug description:"（预测一个可能的 bug 成因）再生成代码**，形式化为 M(c|E_K, p_target) = M(c|E_K, p, d_fs)·M(d_fs|E_K, p_target)。默认 K=6；K=0 最差，随 K 增大覆盖率急升，但 **K 过大反而下降**（过多历史示例分散注意力、限制生成创造力，引 NLP 先例）。
    2. **Zero-shot**（两个变体）：(a) **completion（默认）**——自然语言注释 `# The following code reveals a bug in {target_api}` + 随机删去后缀的历史 bug 代码前缀，让模型补全，形式化 M(c_zs-comp | p_comp, c_e[:j])；(b) **editing**——注释 `# Edit the code to use {target_api}` + 完整历史 bug 代码，让模型改写以调用目标 API。历史代码片段可直接复用（含特殊值、边缘张量形状等成分），且可把历史 bug 模式打到新 API 上。
    3. **Fine-tuning**：在 (API, 描述, 代码) 数据集上自回归训练（损失 L = -1/n Σ log M(t_i|T_<i)），**每个库微调一个独立模型**；微调后模型可从全部历史 bug 模式中"选择/混合"成分来针对特定 API 生成。超参：batch_size=32，lr=5e-5，AdamW，10 epochs，10% warmup 线性调度。
  - **目标系统**：PyTorch 与 TensorFlow（对比实验用 v1.12 / v2.10，与 TitanFuzz 完全对齐、同一套公开 Python API 集；找新 bug 用 nightly 版）。**Oracle 三件套（§3.3）**：crash（abort/段错误/INTERNAL_ASSERT_FAILED）；CPU-GPU 差分（跨后端输出不一致，带显著性容忍阈值）；AD oracle（反向模式 AD vs 前向模式 AD vs 数值微分 ND 的梯度不一致，源自 ∇Fuzz）。
  - **基座模型**：Codex（code-davinci-002，闭源 API 访问，**不可微调**，故 FS/ZS 用它）与 CodeGen（350M/2B/6B-mono，开源、HuggingFace，**可微调**，故 FT 用它）；另附加实验：ChatGPT 纯指令跟随（**无任何历史信息**，知识截止 2021-09），System message "You are a pytorch fuzzer"，指令如 "generate a program which uses the API in a way that hasn't been seen in your training dataset" / "in a very strange way"，对照 baseline "demonstrate the example usage"——各指令均覆盖显著更多 API（valid rate 更低），说明指令跟随能力本身也能引导"不寻常"生成。

- **指标定义**：覆盖率如何度量、bug 如何确认
  - **代码覆盖率**：coverage.py 度量 **Python 行覆盖**，沿用 DL 库 fuzzing 惯例；**排除 oracle 检查代码带来的覆盖**以保证公平比较。代码库规模：PyTorch 113,538 行 / 1,593 API，TensorFlow 269,448 行 / 3,316 API。
  - **API 覆盖**：被至少一个生成程序实际调用的 DL API 数（测试充分性指标）。
  - **有效程序（unique valid programs）**：程序无异常执行成功**且**至少调用目标 API 一次，去重后的数量；Valid(%) = 有效 / 全部去重程序。这是生成质量与过滤漏斗的关键度量。
  - **唯一 crash（unique crashes）**：定义比文献更严——**人工检查每个 crash 的根因，同因合并为一个**；且全部唯一 crash 均经开发者确认为真实 bug。
  - **bug 确认流程**：生成程序跑三 oracle → 报告给库开发者 → 按开发者反馈分类为 Confirmed-Unknown（新 bug）/ Confirmed-Known / Pending / Won't Fix（多为精度或效率问题不予修复），并单列 High-Priority（含安全漏洞）。

- **成本与预算处理**：
  - **生成预算**：默认**每目标 API 生成 100 个程序**；FS 每 API 构造 10 个 prompt（各含 6 个随机 6-shot 示例）× 每 prompt 采样 10 次；ZS 随机选 10 个历史片段构造 10 个 prompt 做补全/编辑；FT 固定任务描述查询模型 10 次 ×10。采样参数固定：top-p=0.95，temperature=0.8，max_tokens=256（沿用 TitanFuzz）。
  - **等成本对比**：设 FuzzGPT-FS-25（只用 Codex 生成 25 个程序/API，与 TitanFuzz 种子阶段同量），结果仍大幅超过 TitanFuzz 全量（后者还要额外用 InCoder 做变异）——**失败种子化的 few-shot 生成在低预算下效率极高**，这是对我们成本受控项目最有直接参考价值的发现。
  - **消融限缩**：因成本巨大（"due to huge costs"），RQ3 消融只在 PyTorch 随机抽 50 个 API 上做、报 5 次运行平均；RQ4 找 bug 因人工报告成本极高，只跑默认 FuzzGPT-FS + 全部 oracle。
  - **训练成本**：FT 需为每个库单独训练/存储一个模型，论文明确承认这在算力与存储上昂贵，且需收集高质量数据集；Codex 为 API 计费、闭源。作者也声明不同 LLM 间（CPU/GPU/云成本不同）难以精确比较效率，只能力求公平。硬件：64 核 / 256GB RAM / 4×RTX A6000。

- **可复现处理**：代码/种子数据是否公开？
  - **是**：artifact 公开（github.com/ise-uiuc/FuzzGPT）；种子数据挖掘自公开 GitHub issues/PRs（1750/633 条），清洗规则全部写明（语法检查、≤256 tokens、过滤错误消息等）；自动标注的 prompt 格式（Figure 3）与三种注入方式的 prompt 模板（Figure 4）均给出。
  - **超参全给**：微调（batch 32 / lr 5e-5 / AdamW / 10 epochs / 10% warmup）、标注（temp=0 贪心）、生成（temp 0.8 / top-p 0.95 / max 256 tokens）；评测版本钉死（PyTorch v1.12、TF v2.10，与 TitanFuzz 同版同 API 集）；消融报 5 次平均。
  - **风险**：主力模型 Codex (code-davinci-002) 为闭源 API 且**现已被 OpenAI 弃用**，FS/ZS 主结果无法严格复现；可复现路径只能靠开源 CodeGen（论文证明微调后的 CodeGen-6B 覆盖可比 Codex，部分缓解）。ChatGPT 附加实验未公开 prompt 全集（只列代表性 prompt）。

- **报告的失败/发现**：
  1. **覆盖率**（Table 2）：最佳变体达 TensorFlow 54.37% 行覆盖（FuzzGPT-FS）、PyTorch 33.72%（FuzzGPT-ZS），**比 SOTA TitanFuzz 分别高 36.03% / 60.70%**；且 API 覆盖与 TitanFuzz 相近但代码覆盖高得多——说明历史种子换来的是"更有趣的代码行为/路径"而非更多 API。覆盖率在 100 程序/API 后仍未饱和（Figure 5），历史数据集可持续供给价值。
  2. **三种范式权衡**（Table 1）：FS 覆盖 API 数与有效程序数最多（丰富上下文可组合多种 bug 模式）；ZS 有效率最低（PyTorch 5.91%、TF 1.99%——补全约束空间小、需与遗留代码兼容）但靠复用历史片段在 PyTorch 拿到最高覆盖率；FT 有效率最高（PyTorch 27.69%，模型参数化吸收了全部 bug 模式）。
  3. **Crash 检出**：默认 FS 发现的唯一 crash 是 TitanFuzz 的 **2.5 倍**；FS+ZS+FT 合计 19 个不同 crash，其中 **14 个 TitanFuzz 找不到**，TitanFuzz 独有仅 1 个。
  4. **Bug 总量**（Table 8）：**76 个 bug，49 个确认为前所未知的的新 bug（6 个已修复），11 个高优先级 bug 或安全漏洞**（PyTorch 43 总/33 新/3 高优；TF 33 总/16 新/8 高优）。49 个新 bug = 25 crashes + 24 inconsistencies，其中 30 个 AD 相关；**只有 11 个能被（加上本文 oracle 的）TitanFuzz 找到、2 个能被直接重跑历史程序找到**——即 ~76% 的新 bug 依赖"种子化生成"而非"重放"。
  5. **两个范例 bug**：(a) PyTorch `PixelShuffle` 作用在形状 (1,1,1,1,0) 的 0 维张量上再 `jacrev` 求梯度 → 浮点异常，高优先级、立即修复——该输入由 in-context 历史示例（0 维张量触发 crash 的模式）泛化而来；(b) TF 中 `tf.experimental.numpy.copy` 的 buffer sharing bug：copy 后改原数组 x[3]=42，CPU 上副本随之改变而 GPU 不变——由 **CoT 提示让模型先预测 bug 成因描述（"buffer sharing issue when copying array..."）再生成代码**命中，被 Google 安全团队确认为安全漏洞（可静默篡改数组拷贝）。这两个案例分别演示了"示例模式泛化"与"CoT 成因先验"两条生成路径。
  6. **消融洞见**：CoT（bug 描述中间步）显著提升覆盖率（23,945 vs 22,922）与独特 API 数，代价是 valid rate 略降（不寻常程序更易抛异常）；模型规模：CodeGen 350M→2B→6B 覆盖持续升，6B 可比 Codex；FT 中 2B 的有效程序反而最多——**validity-unusualness 权衡**（越偏不寻常越损失有效性）；MMR 相似性/多样性示例选择并不优于**随机选择**（现代 LLM 足以从 dissimilar 示例学习，随机还提供多样成分）——省掉了示例检索工程。

- **方法论迁移（本笔记重点）**：如何把"LLM 生成边缘案例"迁移到"失败模式驱动的困难 CO 实例生成"
  **同构映射表**（FuzzGPT 概念 → EvalBench 对应物）：
  | FuzzGPT | EvalBench 迁移对象 |
  |---|---|
  | 被测系统：DL 库（PyTorch/TF） | 被测对象：LLM 建模/求解管线（含求解 agent） |
  | 测试输入：Python 程序 | 测试输入：CO 问题实例（LP/MILP/TSP/装箱…）或其自然语言表述 |
  | 历史资源：GitHub issues/PRs 中的 bug 触发代码 | 历史资源：EvalBench transcripts 中积累的 **LLM 失败实例** |
  | (bug 代码, buggy API) 标注对 | (失败实例, 失败模式标签) 对：解析失败 / 约束违背 / 幻觉（引用不存在的变量、API、系数）/ 次优或错误答案 |
  | Oracle：crash、CPU-GPU 差分、AD 差分 | Oracle：参考求解器（如 Gurobi）差分、可行性检查、与已知最优比较 |
  | "稀有代码成分"假设 | "稀有结构特征"假设：退化（degenerate）约束、近不可行、大系数数值不稳、高对称性、规模边界等诱发失败的结构 |
  | 覆盖率度量"不寻常"的收益 | 需自造代理：成功率降幅、失败模式多样性、实例特征分布距离 |
  **迁移逻辑链（六步闭环）**：
  1. **失败矿工**（对应 §3.1 数据集挖掘）：EvalBench 每轮评测的 transcripts 天然记录逐实例行为——解析失败（输出不合格式）、约束违背（建模与 ground truth 不符/解不可行）、幻觉、错误答案（参考求解器能解对而 LLM 不能）。抽取 (失败实例, 失败模式标签) 对。**迁移优势**：FuzzGPT 的 buggy API 标注要靠 self-training（精度仅 76%，还要人工标 6 条种子），而我们的失败标签由评测 harness 确定性产生，标注环节近乎零成本、零误差。
  2. **CoT 失败成因先验**（对应 few-shot 的 bug description 中间步）：让生成模型**先描述失败成因再生成实例**（如"该实例因约束矩阵接近奇异，导致 agent 幻觉对偶变量"）。依据：FuzzGPT Table 3/6 证明 CoT 中间步一致提升覆盖率与输出多样性，TF buffer-sharing bug 正是靠"先预测成因"命中的。
  3. **三种注入方式落地**：(a) **few-shot（首选）**——prompt = K 个 (失败模式描述, 实例) 示例 + "生成一个使 agent 出现失败模式 X 的 LP 实例"；K 取小值（3–6，FuzzGPT 证明 K 过大反而抑制多样性与覆盖）；示例**随机选即可**（MMR 消融：随机不劣于精心检索），免去检索系统。(b) **zero-shot completion**——给失败实例前缀（部分约束集/参数表头）让模型补全为新实例，天然继承稀有结构成分。(c) **fine-tuning（仅设计层面保留，课程项目不实现）**——在失败对上微调小开源模型可学全量失败模式库并"混搭"成分，但 FuzzGPT 已证明其每任务单独训练的算力/存储成本，明确排除，报告作为扩展路径。
  4. **三道验证闸**（对应 §3.3 oracle）：(a) **有效性过滤**——实例良构且可行（参考求解器能解出有限最优），对应 FuzzGPT 的 valid program 定义；**预期 valid rate 偏低**（FuzzGPT-ZS 仅 5.91%），预算须按"生成→过滤"漏斗放大冗余；(b) **差分 oracle**——被测 agent 输出 vs 参考求解器输出，思想同 CPU-GPU 双后端差分；(c) **难度确认**——复跑确认目标 agent 确实失败/显著退化，否则丢弃（防止混入"伪困难"实例）。
  5. **成本台账**（对应 FS-25 发现）：FuzzGPT-FS-25 以 25 程序/API 超过 TitanFuzz 全量，说明**失败种子化生成在极低预算下高效**；EvalBench 每问题类只需 10–25 个失败种子生成，采样参数（temp/top-p）与每类生成数写入成本台账，即构成"成本受控"的困难实例扩充模块。
  6. **自适应难度闭环**：eval → transcripts 沉淀失败 → 失败种子生成新困难实例 → 过滤确认 → 回灌测试集再 eval。每轮输出失败模式分布诊断（哪类失败最多→定向生成更多），这是"history-driven fuzzing"在评测语境的对应物：**history-driven benchmark hardening（历史驱动的基准加固）**。
  **可行性与边界**：
  - 可行：(i) 种子数据免费（transcripts 本就存在）；(ii) 标签自动（harness 判定，无 self-training 需要）；(iii) few-shot 路径零训练成本（纯 API 调用）；(iv) CoT 成因先验有 FuzzGPT 消融证据背书。
  - 边界一：**失败归因前提**。DL 库 bug 有明确稀有代码成分（0 维张量）；而 CO 失败可能是**能力性**（模型推理弱）而非**结构性**（实例刁钻）——若失败主要源于能力，"同分布生成"只会复制同难度实例、收益递减。故须先做失败归因，只把**结构诱发型失败**（退化、近不可行、数值不稳等）当种子。
  - 边界二：**有效性-难度权衡**（对应 validity-unusualness trade-off）：越刁钻越可能不可行/无意义，参考求解器过滤闸不可省。
  - 边界三：**平凡失败污染**：parse failure 这类格式性失败做种子只会生成格式性困难，评测价值低，应优先结构诱发的推理失败。
  - 边界四：**同源偏差/确认循环**：同一 LLM 家族既当被测对象又当生成器，会产出"该族恰好失败"的实例，损害基准公平性（类似训练-测试污染）；缓解：生成器与被测对象跨家族，或人工抽查生成实例合理性。
  - 边界五：**良构判定更难**：FuzzGPT 有 Python 语法这道客观闸门；CO 实例"良构"需可行性与有界性检查，过滤成本更高。
  - 边界六：**覆盖率代理缺失**是迁移中真正的新工作：没有现成的"CO 实例覆盖率"工具，需自造难度/多样性度量。
  **课程项目定位**：只论证到设计层面 incorporation——在 EvalBench 设计文档中加入该模块（失败矿工 → CoT few-shot 种子化生成 → 参考求解器过滤 → 难度确认 → 成本台账），微调路径标注为 future work；若时间允许可对单一失败模式（如"约束违背"）做最小可行 demo。

- **局限**：
  1. **论文自述**：FT 需每库/每任务单独训练模型并收集高质量数据集，算力与存储成本大；zero-shot editing 有效率仅 1.22%（全自动改写程序太难）；TensorFlow 种子少（633 条）导致 ZS 在 TF 上明显变弱；TF 新 bug 确认少并非技术原因，而是开发者不活跃——**外部确认流程成为指标噪声源**；K 过大降低覆盖（干扰效应）；API 标注可能错标（76% 精度，虽证明鲁棒）；不同 LLM 间成本不可精确对齐，效率比较只能定性。
  2. **复现层面**：Codex 已弃用且闭源，主结果严格复现受阻（开源 CodeGen-6B 微调部分缓解）；ChatGPT 附加实验未给全 prompt；RQ4 的 bug 确认依赖 2023 年的 nightly 版本与开发者响应，事后无法重放。
  3. **方法层面（含我们视角）**：validity-unusualness 权衡是内生矛盾，论文未给自动平衡机制；"不寻常"的收益始终用覆盖率间接度量，缺少对"何种不寻常才诱发 bug"的可解释刻画（哪个成分起作用不可知，CoT 描述只是启发式）；对历史数据的依赖意味着对"沉默失败"（从未被报告的 bug 模式）覆盖不足——种子分布天然偏向开发者看得见的 bug；将 LLM 既当 fuzzer 又隐式当被测环境的一部分，与我们的确认循环问题同构。

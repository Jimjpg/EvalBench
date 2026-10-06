# EvalBench

**一套成本受控、可复现的 LLM × 运筹优化（OR）评测体系。**

用统一的指标、三重预算熔断和审计式全量日志，公平地回答一个问题：

> 大语言模型到底能不能求解运筹优化问题？能解到什么质量？要花多少钱？结果稳不稳定？

本项目是"LLM 与 OR 研究方向"课程大作业的完整产出：从文献分析、体系设计、原型实现到 360 次真实 API 实验与假设检验的全流程闭环。全部实验账单实测总成本仅 **¥2.59**。

---

## 为什么需要它

调研六篇 2025–2026 年 LLM×OR 评测文献（CO-Bench、HeuriGym、FrontierCO、DynaSchedBench 等）后发现，领域评测实践存在六条系统性缺陷（D1–D6）：

| 缺陷 | 领域现状 | EvalBench 的对策 |
|---|---|---|
| 指标口径不统一 | 各基准各算各的 | primal gap / quality / **QYI**（质量-可行调和均值）/ stability_cv 统一指标 |
| 成本维度缺失 | 只报结果不报花费 | **五列成本计量**（调用数 / tokens / 秒 / 折算价 / 元） |
| 成本不受控 | 跑飞了才知道 | **三重预算控制器**：调用次数 + token 总量 + 墙钟时间，任一触顶即熔断 |
| 可复现性不完整 | 只有代码没有配置 | YAML 配置快照 + git 哈希 + 提示词版本 + 全量对话落盘 |
| 失败只有散文描述 | "模型表现不佳" | **F1–F6 失败模式自动分类**（见下表） |
| 稳定性无人报告 | 单次运行下结论 | 5 次重复实验 + 变异系数 stability_cv 必报 |

## 核心特性

- **三重预算熔断** —— 每个实验在配置里事前声明 `max_calls / max_tokens / max_seconds`，运行时强制执行。失控的重试循环在花掉第 N 次调用之前就会被掐断，"最坏情况成本可计算"是设计性质而非运气。
- **审计式可复现** —— 每次 run 落盘"五件套"：`config.yaml`（配置快照）、`manifest.json`（运行清单）、`summary.csv`（逐 run 指标）、`transcripts/`（全量对话日志）、`figs/`（图表）。报告里每个数字都能回溯到一次具体的 API 调用。
- **F1–F6 失败自动分类** —— 失败不再是一句"模型不行"，而是可统计、可对症的六类编码：

  | 编码 | 含义 |
  |---|---|
  | F1 | 输出无法解析（JSON 格式错误） |
  | F2 | 解析成功但违背问题约束 |
  | F3 | 引用越界或不存在的元素 |
  | F4 | 迭代停滞（连续两轮成本相同） |
  | F5 | 预算耗尽（触发熔断） |
  | F6 | 其他/未归类 |

- **可中断续跑** —— 实验中断（断网、欠费、误关终端）后传入 run_id 即可从断点继续，已完成的 run 不会重复计费。
- **离线可测** —— 40 个单元测试全部使用 FakeLLM，不需要 API key、不消耗一分钱额度。
- **经典基线对照** —— 内置 NN+2-opt（TSP）、FFD（装箱）、LPT（调度）三个零成本启发式基线，让 LLM 的表现有参照系。

## 快速开始

### 本地运行

```bash
# 1. 环境（Python 3.10+）
pip install -r requirements.txt

# 2. 密钥：项目根目录创建 .env
#    LLM_API_KEY=sk-...        （DeepSeek 平台）
#    DASHSCOPE_API_KEY=sk-...  （阿里百炼平台）

# 3. 单元测试（40 个，离线，无需 API key）
python -m pytest evalbench/tests -q

# 4. 冒烟（1 run，几分钱，验证端到端五件套）
python -m evalbench.runner.runner configs/exp_smoke.yaml

# 5. 主实验（90 runs）与稳定性实验（270 runs）
python -m evalbench.runner.runner configs/exp_main.yaml
python -m evalbench.runner.runner configs/exp_stability.yaml
# 中断后续跑：python -m evalbench.runner.runner configs/exp_main.yaml <run_id>

# 6. 图表与假设检验
python -m evalbench.analysis.report results/<run_id>
python -m evalbench.analysis.hypo_tests results/<主实验run_id> results/<稳定性run_id>
```

### GitHub Codespaces（推荐，完全不碰自己电脑）

1. 点击仓库页面 **Code → Codespaces → Create codespace**
2. 云端 Ubuntu 环境中：`pip install -r requirements.txt`
3. `python -m pytest evalbench/tests -q` —— 40 个测试 + FakeLLM 验证**不需要 API key、不消耗额度**
4. 想跑真实实验：把两个密钥写入云端 `.env`（Codespaces 的 Secrets 功能更安全），再执行上面的第 4–6 步

## 项目结构

```
evalbench/
├── llm/         # LLM 客户端与三重预算控制器（Budget / BudgetExhausted）
├── problems/    # 问题定义：TSP / 装箱 / 并行机调度 + 注册表
├── metrics/     # primal gap / quality / QYI 等指标
├── runner/      # 评测主循环、失败分类、续跑、经典基线参照
├── analysis/    # 五张图 + summary 表、H1–H4 假设检验
└── tests/       # 40 个单元测试（FakeLLM，离线）
configs/         # 冒烟 / 主实验 / 稳定性实验三份 YAML（可直接改模型名接入其他 LLM）
docs/            # 设计文档（指标体系、失败模式分类、实验设计等）
notes/           # 六篇文献的结构化精读笔记
report/          # 课程论文（HTML / Word）与图表
scripts/         # 成本对账等辅助脚本
results/         # 每次运行的五件套产物（.gitignore 排除，不入库）
```

## 实验设计与主要发现

**设计**：2 模型（deepseek-chat / qwen-plus）× 3 问题（TSP / 装箱 / 并行机调度）× 3 规模（small / medium / large），主实验 90 runs + 稳定性实验 270 runs，按预登记假设组织统计检验。

**四条有统计支撑的发现**：

1. **可行率随规模断崖式坍塌**（H1 支持）——qwen 调度问题从 100% 跌至 0%，Fisher 精确检验 p = 1.5×10⁻¹¹
2. **约束违背 F2 占全部失败的 93%**（H2 支持）——失败高度集中、可对症，二项检验 p = 5.2×10⁻⁹
3. **预登记的性价比假设被证伪**（H4）——"两模型 QYI 接近且性价比差 ≥2 倍"被数据推翻；账单口径下两模型实际支出几乎持平（¥1.30 vs ¥1.29），性价比方向反转。证伪本身演示了预注册方法的价值
4. **经典启发式以零成本全面胜出**——NN+2-opt / FFD / LPT 在直接求解设定下优于两个 LLM；LLM 在 OR 中的价值更可能在建模与算法设计，而非直接求解

**成本**：360 runs 账单实测总成本 ¥2.59（deepseek ¥1.30 + qwen ¥1.29），仅为事前预算估算（¥20）的约 1/8，熔断线（¥50）远未触达。对账还发现计费档位漂移（请求别名 ≠ 实际计费模型）——这类信息只有账单口径才能暴露。

## 接入你自己的模型

`configs/*.yaml` 里的 `models` 列表就是接入点：改 `name / base_url / env_key` 即可评测任何 OpenAI 兼容接口的模型，预算与指标体系自动生效：

```yaml
models:
  - name: your-model
    base_url: https://your-endpoint/v1
    env_key: YOUR_API_KEY
    temperature: 0.7
```

## 局限

- 仅覆盖 3 个经典 OR 问题、3 个规模档；未覆盖混合整数规划等更复杂建模
- 实验中发现的"别名漂移"提示：transcript 应记录响应侧 `model` 字段与账单计费档位（已列入改进项）
- 单问题单实例的设计用于课程尺度验证，扩展到统计意义上更强的实例采样是后续工作

## 文档

- 课程论文：`report/`（含完整的方法、实验、效度威胁与可迁移建议）
- 设计文档：`docs/design/`（指标体系、失败模式分类、实验设计）
- 文献笔记：`notes/`（六篇 LLM×OR 评测文献的结构化精读）

## 引用

```bibtex
@misc{evalbench2026,
  title  = {EvalBench: A Cost-Controlled and Reproducible Evaluation System for LLM x OR},
  author = {Li, Wanye},
  year   = {2026},
  url    = {https://github.com/Jimjpg/EvalBench}
}
```

## 许可证

[MIT](LICENSE)

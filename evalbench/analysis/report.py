import os
import sys

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd

plt.rcParams["font.sans-serif"] = [  # 跨平台中文回退链
    "Microsoft YaHei",      # Windows
    "Noto Sans CJK SC",     # Ubuntu (fonts-noto-cjk)
    "PingFang SC",          # macOS
    "SimHei",               # Windows 备选
    "DejaVu Sans",
]
plt.rcParams["axes.unicode_minus"] = False

# 元 / 1M tokens（输入, 输出）——运行当日到官网核对并更新注释日期
PRICE = {
    "deepseek-chat": (2.0, 8.0),
    "qwen-plus": (0.8, 2.0),
}


def _api_cost_yuan(df):
    cost = pd.Series(0.0, index=df.index)
    for model, (pi, po) in PRICE.items():
        sel = df["model"] == model
        cost[sel] = (df.loc[sel, "tokens_in"] / 1e6 * pi
                     + df.loc[sel, "tokens_out"] / 1e6 * po)
    return cost


def make_all(run_dir):
    df = pd.read_csv(os.path.join(run_dir, "summary.csv"))
    df["cost_yuan"] = _api_cost_yuan(df)
    figs = os.path.join(run_dir, "figs")
    os.makedirs(figs, exist_ok=True)

    # 图1 成本-质量前沿：每模型 (总成本, 加权 QYI)
    rows = []
    for model, g in df.groupby("model"):
        q = g["quality"].mean()
        y = g["feasible"].mean()
        qyi = 2 * q * y / (q + y) if (q + y) > 0 else 0.0
        rows.append({"model": model, "qyi": qyi, "cost": g["cost_yuan"].sum()})
    f1 = pd.DataFrame(rows)
    ax = f1.plot.scatter(x="cost", y="qyi", s=120, c="#3C2ECA")
    for _, r in f1.iterrows():
        ax.annotate(r["model"], (r["cost"], r["qyi"]),
                    xytext=(6, 6), textcoords="offset points")
    ax.set_xlabel("API 总成本（元）")
    ax.set_ylabel("QYI（质量-产量指数）")
    ax.set_title("成本-质量前沿")
    plt.savefig(os.path.join(figs, "fig1_cost_quality.png"), dpi=150,
                bbox_inches="tight")
    plt.close()

    # 图2 规模泛化：primal_gap 均值 vs 规模（按模型）
    fig, ax = plt.subplots()
    for model, g in df.groupby("model"):
        agg = g.groupby("scale")["primal_gap"].mean().reindex(
            ["small", "medium", "large"])
        ax.plot(agg.index, agg.values, marker="o", label=model)
    ax.set_xlabel("实例规模")
    ax.set_ylabel("primal gap 均值")
    ax.set_title("跨规模泛化")
    ax.legend()
    plt.savefig(os.path.join(figs, "fig2_gap_vs_scale.png"), dpi=150,
                bbox_inches="tight")
    plt.close()

    # 图3 可行率 vs 规模（按模型）
    fig, ax = plt.subplots()
    for model, g in df.groupby("model"):
        agg = g.groupby("scale")["feasible"].mean().reindex(
            ["small", "medium", "large"])
        ax.plot(agg.index, agg.values, marker="s", label=model)
    ax.set_xlabel("实例规模")
    ax.set_ylabel("可行率")
    ax.set_ylim(-0.05, 1.05)
    ax.set_title("可行率随规模衰减")
    ax.legend()
    plt.savefig(os.path.join(figs, "fig3_feasible_vs_scale.png"), dpi=150,
                bbox_inches="tight")
    plt.close()

    # 图4 稳定性：同实例多次重复的 primal_gap CV（按模型×问题）
    from ..metrics.metrics import stability_cv
    cvs = (df.groupby(["model", "problem", "instance"])["primal_gap"]
             .apply(stability_cv).reset_index(name="cv"))
    if len(cvs):
        piv = cvs.pivot_table(index="problem", columns="model", values="cv")
        piv.plot.bar()
        plt.ylabel("primal_gap 变异系数")
        plt.title("多次运行稳定性")
        plt.savefig(os.path.join(figs, "fig4_stability.png"), dpi=150,
                    bbox_inches="tight")
        plt.close()

    # 图5 失败模式分布（按模型）
    fails = df[df["failure_class"].notna() & (df["failure_class"] != "")]
    if len(fails):
        piv = (fails.groupby(["model", "failure_class"]).size()
               .unstack(fill_value=0))
        piv.plot.bar(stacked=True)
        plt.ylabel("失败 run 数")
        plt.title("失败模式分布")
        plt.savefig(os.path.join(figs, "fig5_failure_modes.png"), dpi=150,
                    bbox_inches="tight")
        plt.close()

    # 表1 汇总：模型×问题×规模 的 QYI / gap / 可行率 / 成本
    tbl = (df.groupby(["model", "problem", "scale"])
             .agg(gap=("primal_gap", "mean"),
                  feasible=("feasible", "mean"),
                  yuan=("cost_yuan", "sum"),
                  tokens=("tokens", "sum"))
             .round(4).reset_index())
    tbl.to_csv(os.path.join(run_dir, "table1_summary.csv"),
               index=False, encoding="utf-8-sig")
    print(f"图表已输出到 {figs}")


if __name__ == "__main__":
    make_all(sys.argv[1])

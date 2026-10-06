"""假设检验 H1/H2/H4 与稳定性统计。

H1 可行率随规模显著下降（小规模 vs 大规模，Fisher 精确检验，逐模型×问题）
H2 约束违背 F2 是主导失败模式（二项检验，F2 占失败总数比例 > 50%）
H4 模型间表现差异显著（可行率 Fisher 精确检验 + gap Mann-Whitney U，逐问题）
"""
import argparse
import sys
import warnings

import pandas as pd
from scipy import stats

warnings.filterwarnings("ignore")

SCALE_ORDER = {"small": 0, "medium": 1, "large": 2}


def load(path):
    df = pd.read_csv(f"{path}/summary.csv")
    df["feasible"] = df["feasible"].astype(int)
    df["scale_ord"] = df["scale"].map(SCALE_ORDER)
    return df


def h1_feasibility_trend(df):
    rows = []
    for (m, p), g in df.groupby(["model", "problem"]):
        small = g[g["scale"] == "small"]
        large = g[g["scale"] == "large"]
        tab = [[int(small["feasible"].sum()),
                len(small) - int(small["feasible"].sum())],
               [int(large["feasible"].sum()),
                len(large) - int(large["feasible"].sum())]]
        orr, pval = stats.fisher_exact(tab)
        # 附加趋势检验（序数逻辑回归；完美分离时 beta 发散，视为 p→0）
        try:
            import statsmodels.api as sm
            fit = sm.Logit(g["feasible"], sm.add_constant(g["scale_ord"])).fit(
                disp=0, maxiter=200)
            beta = float(fit.params.iloc[1])
            p_trend = float(fit.pvalues.iloc[1])
            if abs(beta) > 50 or p_trend != p_trend:  # 分离：系数爆炸
                beta, p_trend = -float("inf"), 0.0
        except Exception:
            beta, p_trend = float("nan"), float("nan")
        rows.append({
            "model": m, "problem": p,
            "feas_small": f"{small['feasible'].mean():.2f}",
            "feas_large": f"{large['feasible'].mean():.2f}",
            "OR_small_vs_large": round(orr, 2),
            "p_fisher": f"{pval:.2e}",
            "beta_trend": round(beta, 2) if beta == beta else "",
            "p_trend_logit": f"{p_trend:.2e}" if p_trend == p_trend else "",
        })
    return pd.DataFrame(rows)


def h2_failure_dominance(df):
    fails = df[df["failure_class"].notna()]
    n = len(fails)
    n_f2 = int((fails["failure_class"] == "F2").sum())
    # 检验 F2 占比 > 0.5（单侧二项检验，以 0.5 为原假设）
    pval = stats.binomtest(n_f2, n, 0.5, alternative="greater").pvalue
    counts = fails["failure_class"].value_counts().to_dict()
    return n, n_f2, counts, pval


def h4_model_difference(df):
    rows = []
    for p, g in df.groupby("problem"):
        d = g[g["model"] == "deepseek-chat"]
        q = g[g["model"] == "qwen-plus"]
        tab = [[int(d["feasible"].sum()), len(d) - int(d["feasible"].sum())],
               [int(q["feasible"].sum()), len(q) - int(q["feasible"].sum())]]
        orr, p_f = stats.fisher_exact(tab)
        gd = d["primal_gap"].dropna()
        gq = q["primal_gap"].dropna()
        if len(gd) > 0 and len(gq) > 0:
            u, p_u = stats.mannwhitneyu(gd, gq, alternative="two-sided")
        else:
            u, p_u = float("nan"), float("nan")
        rows.append({
            "problem": p,
            "feas_ds": f"{d['feasible'].mean():.2f}",
            "feas_qw": f"{q['feasible'].mean():.2f}",
            "OR": round(orr, 2), "p_fisher": f"{p_f:.2e}",
            "gap_ds": f"{gd.mean():.3f}", "gap_qw": f"{gq.mean():.3f}",
            "p_mwu": f"{p_u:.2e}",
        })
    return pd.DataFrame(rows)


def stability_stats(df):
    rows = []
    for (m, p, inst), g in df.groupby(["model", "problem", "instance"]):
        feas = g["feasible"].values
        gap = g["primal_gap"].dropna()
        flip = 1 - max(feas.mean(), 1 - feas.mean())  # 偏离多数类的比例
        rows.append({
            "model": m, "problem": p, "instance": inst,
            "repeats": len(g),
            "feas_rate": feas.mean(),
            "flip_rate": flip,
            "gap_mean": gap.mean() if len(gap) else float("nan"),
            "gap_std": gap.std(ddof=1) if len(gap) > 1 else float("nan"),
            "gap_cv": (gap.std(ddof=1) / gap.mean() if len(gap) > 1
                       and gap.mean() > 0 else float("nan")),
        })
    return pd.DataFrame(rows)


def fmt_md(title, df):
    return f"\n## {title}\n\n{df.to_markdown(index=False)}\n"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("main_dir")
    ap.add_argument("stab_dir")
    ap.add_argument("-o", "--out", default=None)
    args = ap.parse_args()

    main_df = load(args.main_dir)
    stab_df = load(args.stab_dir)

    out = ["# 假设检验与稳定性统计结果\n"]

    out.append(f"\n主实验 {len(main_df)} runs，稳定性实验 {len(stab_df)} runs。"
               f"检验均为双侧（H2 为单侧），显著性水平 0.05。\n")

    out.append(fmt_md("H1 可行率随规模下降（Fisher + 序数 Logit 趋势）",
                      h1_feasibility_trend(pd.concat([main_df, stab_df]))))

    n, n_f2, counts, pval = h2_failure_dominance(main_df)
    out.append(f"\n## H2 失败模式主导性\n\n失败 run 共 {n} 个：{counts}。"
               f"F2 占比 {n_f2}/{n} = {n_f2/n:.0%}，"
               f"单侧二项检验 p = {pval:.2e}"
               f"{'（显著，F2 为主导失败模式）' if pval < 0.05 else '（不显著）'}。\n")

    out.append(fmt_md("H4 模型间差异（deepseek-chat vs qwen-plus）",
                      h4_model_difference(pd.concat([main_df, stab_df]))))

    ss = stability_stats(stab_df)
    out.append(fmt_md("稳定性统计（逐实例，5 次重复）",
                      ss.round(3)))

    flip_any = ss[ss["flip_rate"] > 0]
    out.append(f"\n翻转（同一实例 5 次重复中可行/不可行不一致）实例数："
               f"{len(flip_any)} / {len(ss)}"
               f"（{'存在不稳定性' if len(flip_any) else '完全稳定'}）\n")
    if len(flip_any):
        out.append(fmt_md("发生可行/不可行翻转的实例", flip_any.round(3)))

    text = "".join(out)
    print(text)
    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            f.write(text)


if __name__ == "__main__":
    sys.exit(main())

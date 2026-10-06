"""生成基线对照表：LLM（两模型）vs 经典启发式 vs OR-Tools 参考解。

行 = (问题, 规模) × 方法；列 = 目标值均值、primal_gap 均值、可行率、
tokens、api_cost（仅 LLM 行）。LLM 行来自主实验 summary.csv；
经典基线与参考解由 evalbench.baselines 确定性重算。
"""
import json

import pandas as pd

from evalbench.baselines.baselines import (
    first_fit_decreasing, lpt_makespan, nearest_neighbor_tour,
    tour_cost, two_opt)
from evalbench.problems.registry import PROBLEMS

MAIN = "results/20261006-013713-c4e51a"
PRICE = {"deepseek-chat": (2.0, 8.0), "qwen-plus": (0.8, 2.0)}

refs = json.load(open("results/references.json", encoding="utf-8"))
df = pd.read_csv(f"{MAIN}/summary.csv")

rows = []
for pname in ["tsp", "binpacking", "pmachine"]:
    prob = PROBLEMS[pname]()
    for scale, n in prob.sizes.items():
        insts = [prob.generate(n, s) for s in range(1, 6)]
        if pname == "tsp":
            base = [round(tour_cost(i.data["points"], two_opt(
                i.data["points"], nearest_neighbor_tour(i.data["points"]))), 3)
                for i in insts]
        elif pname == "binpacking":
            base = [len(first_fit_decreasing(i.data["sizes"],
                                             i.data["capacity"]))
                    for i in insts]
        else:
            base = [round(lpt_makespan(i.data["jobs"], i.data["m"]), 3)
                    for i in insts]
        ref = [refs[f"{pname}/{i.name}"] for i in insts]
        base_gap = [abs(b - r) / max(abs(b), abs(r))
                    for b, r in zip(base, ref)]
        rows.append({
            "problem": pname, "scale": scale, "method": "经典启发式",
            "detail": "NN+2opt / FFD / LPT",
            "cost": round(sum(base) / 5, 3),
            "gap": round(sum(base_gap) / 5, 4),
            "feasible": 1.0, "tokens": "", "yuan": "",
        })
        rows.append({
            "problem": pname, "scale": scale, "method": "OR-Tools参考",
            "detail": "精确(≤25)/限时30s" if scale == "small" else "精确/启发式",
            "cost": round(sum(ref) / 5, 3), "gap": 0.0,
            "feasible": 1.0, "tokens": "", "yuan": "",
        })
        # LLM 行
        for m in ["deepseek-chat", "qwen-plus"]:
            g = df[(df["model"] == m) & (df["problem"] == pname)
                   & (df["scale"] == scale)]
            yuan = (g["tokens_in"] / 1e6 * PRICE[m][0]
                    + g["tokens_out"] / 1e6 * PRICE[m][1]).sum()
            rows.append({
                "problem": pname, "scale": scale, "method": m,
                "detail": "5轮迭代+反馈",
                "cost": round(g["cost"].dropna().mean()
                              if g["cost"].notna().any() else float("nan"), 3),
                "gap": round(g["primal_gap"].mean(), 4),
                "feasible": round(g["feasible"].mean(), 2),
                "tokens": int(g["tokens"].sum()),
                "yuan": round(yuan, 3),
            })

out = pd.DataFrame(rows)
out.to_csv("results/基线对照表.csv", index=False, encoding="utf-8-sig")
print(out.to_string(index=False))

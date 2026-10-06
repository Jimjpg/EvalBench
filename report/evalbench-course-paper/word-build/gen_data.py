import pandas as pd
import json

stab = pd.read_csv(r"..\..\..\results\20261006-071634-f8a98c\summary.csv")

rows = []
for (model, problem, instance), g in stab.groupby(["model", "problem", "instance"]):
    n = len(g)
    feas = g["feasible"].sum()
    feas_rate = feas / n
    flip = min(feas, n - feas) / n
    gap_mean = g["primal_gap"].mean()
    gap_std = g["primal_gap"].std(ddof=0)
    cv = gap_std / gap_mean if gap_mean > 0 else 0.0
    rows.append({
        "model": model, "problem": problem, "instance": instance, "repeats": n,
        "feas": round(feas_rate, 2), "flip": round(flip, 2),
        "gap_mean": round(gap_mean, 3), "gap_std": round(gap_std, 3), "cv": round(cv, 3),
    })

order = {"binpacking": 0, "pmachine": 1, "tsp": 2}
rows.sort(key=lambda r: (r["model"], order[r["problem"]], r["instance"]))
with open("appendix_b.json", "w", encoding="utf-8") as f:
    json.dump(rows, f, ensure_ascii=False, indent=1)
print("rows:", len(rows))
print("flips:", sum(1 for r in rows if r["flip"] > 0))

import pandas as pd
import re

PRICE = {"deepseek-chat": (2.0, 8.0), "qwen-plus": (0.8, 2.0)}

def with_cost(df):
    pi, po = PRICE[df.iloc[0]["model"]]
    df = df.copy()
    df["api_cost"] = df["tokens_in"] / 1e6 * pi + df["tokens_out"] / 1e6 * po
    return df

main = with_cost(pd.read_csv(r"..\..\..\results\20261006-013713-c4e51a\summary.csv"))
stab = with_cost(pd.read_csv(r"..\..\..\results\20261006-071634-f8a98c\summary.csv"))

print("=== MAIN rows:", len(main), " STAB rows:", len(stab))

for name, df in [("main", main), ("stab", stab)]:
    print(f"\n--- {name}: model summary ---")
    g = df.groupby("model").agg(
        runs=("model", "size"), feas=("feasible", "mean"), gap=("primal_gap", "mean"),
        cost=("api_cost", "sum"), tokens=("tokens", "sum"),
        tin=("tokens_in", "sum"), tout=("tokens_out", "sum"), calls=("calls", "sum"))
    print(g.round(3).to_string())
    print("total cost:", round(df.api_cost.sum(), 4))

print("\n--- STAB aggregate model x problem x scale ---")
g = stab.groupby(["model", "problem", "scale"]).agg(n=("feasible", "size"), feas=("feasible", "mean"), gap=("primal_gap", "mean"))
print(g.round(3).to_string())

print("\n--- cumulative feasibility by iter ---")
def iter_of(s):
    m = re.match(r"solved_iter(\d)", str(s))
    return int(m.group(1)) if m else None
for name, df in [("main", main), ("stab", stab)]:
    for model in ["deepseek-chat", "qwen-plus"]:
        sub = df[df.model == model]
        iters = sub["status"].map(iter_of)
        n = len(sub)
        cum = [(iters <= k).sum() / n for k in range(1, 6)]
        print(name, model, [round(c, 3) for c in cum])

print("\n--- STAB per-instance gap CV (feasible instances, by model x problem) ---")
inst = stab.groupby(["model", "problem", "instance"]).agg(
    feas=("feasible", "mean"), gap=("primal_gap", "mean"),
    gapstd=("primal_gap", lambda x: x.std(ddof=0)))
inst["cv"] = inst.apply(lambda r: (r.gapstd / r.gap) if r.gap and r.gap > 0 else 0.0, axis=1)
fi = inst[inst.feas > 0]
agg = fi.groupby(["model", "problem"]).agg(cv_mean=("cv", "mean"), cv_max=("cv", "max"), n=("cv", "size"))
print(agg.round(3).to_string())

print("\n--- failure classes main ---")
print(main["failure_class"].fillna("none").value_counts())
print("\n--- failure classes stab ---")
print(stab["failure_class"].fillna("none").value_counts())

print("\n--- QYI check (main, per model) ---")
for model in ["deepseek-chat", "qwen-plus"]:
    sub = main[main.model == model]
    q = sub[sub.feasible == 1].quality.mean()
    y = sub.feasible.mean()
    qyi = 2 * q * y / (q + y)
    cost = sub.api_cost.sum()
    print(model, "q=", round(q, 3), "y=", round(y, 3), "QYI=", round(qyi, 3), "cost=", round(cost, 4), "QYI/yuan=", round(qyi / cost, 3))

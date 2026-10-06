import pandas as pd

df = pd.read_csv("results/20261006-013713-c4e51a/summary.csv")
PRICE = {"deepseek-chat": (2.0, 8.0), "qwen-plus": (0.8, 2.0)}
for m, g in df.groupby("model"):
    q = g["quality"].mean()
    y = g["feasible"].mean()
    qyi = 2 * q * y / (q + y) if q + y > 0 else 0
    yuan = (g["tokens_in"] / 1e6 * PRICE[m][0]
            + g["tokens_out"] / 1e6 * PRICE[m][1]).sum()
    sol = g[g["feasible"] == 1]
    gap = sol["primal_gap"].mean()
    print(f"{m}: quality={q:.3f} feasible={y:.3f} QYI={qyi:.3f} "
          f"cost={yuan:.3f} QYI_per_yuan={qyi/yuan:.3f}")
    print(f"  feasible_runs={len(sol)}/{len(g)}, mean_gap_on_feasible={gap:.3f}")

stab = pd.read_csv("results/20261006-071634-f8a98c/summary.csv")
print()
print("稳定性实验 token/成本:")
for m, g in stab.groupby("model"):
    yuan = (g["tokens_in"] / 1e6 * PRICE[m][0]
            + g["tokens_out"] / 1e6 * PRICE[m][1]).sum()
    print(f"  {m}: tokens={g['tokens'].sum()}, cost={yuan:.3f}")

import pandas as pd

main = pd.read_csv(r"results/20261006-013713-c4e51a/summary.csv")
stab = pd.read_csv(r"results/20261006-071634-f8a98c/summary.csv")
dup = pd.read_csv(r"results/20261006-015800-bfc0c4/summary.csv")

print("=== QYI (main) ===")
for m, g in main.groupby("model"):
    q = g[g.feasible == 1].quality.mean()
    y = g.feasible.mean()
    qyi = 2 * q * y / (q + y)
    print(f"{m}: Q={q:.4f} Y={y:.4f} QYI={qyi:.4f} feas={int(g.feasible.sum())}/{len(g)}")

print()
tot = {}
for name, df in [("main", main), ("stab", stab), ("dup", dup)]:
    for m, g in df.groupby("model"):
        tot[(name, m)] = (
            int(g.tokens_in.sum()),
            int(g.tokens_out.sum()),
            int(g.tokens.sum()),
            int(g.calls.sum()),
        )
        print(
            f"{name}/{m}: in={tot[(name, m)][0]} out={tot[(name, m)][1]} "
            f"tok={tot[(name, m)][2]} calls={tot[(name, m)][3]}"
        )

ds_main = tot[("main", "deepseek-chat")]
ds_stab = tot[("stab", "deepseek-chat")]
ds_dup = tot[("dup", "deepseek-chat")]
qw_main = tot[("main", "qwen-plus")]
qw_stab = tot[("stab", "qwen-plus")]
ds_all = ds_main[2] + ds_stab[2] + ds_dup[2] + 272
qw_all = qw_main[2] + qw_stab[2]
print(f"\ndeepseek all tokens={ds_all}  qwen all tokens={qw_all}")

print("\n=== 账单口径分摊（token 比例） ===")
ds_main_cost = 1.30 * ds_main[2] / ds_all
qw_main_cost = 1.29 * qw_main[2] / qw_all
ds_ms = 1.30 * (ds_main[2] + ds_stab[2]) / ds_all
qw_ms = 1.29 * (qw_main[2] + qw_stab[2]) / qw_all
print(f"deepseek main={ds_main_cost:.4f}  main+stab={ds_ms:.4f}")
print(f"qwen     main={qw_main_cost:.4f}  main+stab={qw_ms:.4f}")

print("\n=== 单位经济（main，账单口径） ===")
for m, cost in [("deepseek-chat", ds_main_cost), ("qwen-plus", qw_main_cost)]:
    g = main[main.model == m]
    q = g[g.feasible == 1].quality.mean()
    y = g.feasible.mean()
    qyi = 2 * q * y / (q + y)
    print(
        f"{m}: per_run={cost/len(g):.5f} per_feas={cost/g.feasible.sum():.4f} "
        f"QYI_per_yuan={qyi/cost:.3f} gap_on_feas={g[g.feasible==1].primal_gap.mean():.3f}"
    )

print("\n=== 牌价口径对照 ===")
P = {"deepseek-chat": (2.0, 8.0), "qwen-plus": (0.8, 2.0)}
for m, g in main.groupby("model"):
    c = g.tokens_in.sum() / 1e6 * P[m][0] + g.tokens_out.sum() / 1e6 * P[m][1]
    q = g[g.feasible == 1].quality.mean()
    y = g.feasible.mean()
    qyi = 2 * q * y / (q + y)
    print(
        f"{m}: cost={c:.3f} per_run={c/len(g):.5f} per_feas={c/g.feasible.sum():.4f} "
        f"QYI_per_yuan={qyi/c:.3f}"
    )

print("\n=== 稳定性实验单位成本（账单口径） ===")
ds_stab_cost = 1.30 * ds_stab[2] / ds_all
qw_stab_cost = 1.29 * qw_stab[2] / qw_all
print(f"deepseek stab per_run={ds_stab_cost/135:.5f}  qwen stab per_run={qw_stab_cost/135:.5f}")

print("\n=== 成本集中度（deepseek main，token 口径） ===")
g = main[(main.model == "deepseek-chat") & (main.problem == "tsp") & (main.scale == "large")]
print(f"tsp/large tokens={int(g.tokens.sum())}, share_of_ds_main={g.tokens.sum()/ds_main[2]:.3f}")
print(f"按账单分摊该组成本={ds_main_cost * g.tokens.sum()/ds_main[2]:.4f}")

print("\n=== 登记预算对照 ===")
print(f"campaign 总支出 = 2.59, /50 cap = {2.59/50:.3f}, /20 登记 = {2.59/20:.3f}")
print(f"按 run: 2.59/361 = {2.59/361:.5f} (361=90+270+14smoke+1... 实际360+15)")

import json

CASES = [
    ("deepseek-chat_tsp_tsp_n200_s4_r1.json", "F1"),
    ("qwen-plus_tsp_tsp_n200_s1_r1.json", "F1"),
    ("qwen-plus_binpacking_bpp_n60_s4_r1.json", "F3"),
]

for fname, fc in CASES:
    path = "results/20261006-013713-c4e51a/transcripts/" + fname
    t = json.load(open(path, encoding="utf-8"))
    print("===", fc, fname, "| 顶层类型", type(t).__name__, "===")
    if isinstance(t, dict) and "transcript" in t:
        iters = t["transcript"]
        print("row信息:", {k: t["row"].get(k) for k in
                          ("model", "instance", "feasible", "failure_class")
                          if k in t["row"]})
    elif isinstance(t, dict):
        print("keys:", list(t.keys()))
        iters = t.get("iterations", [])
    else:
        iters = t
    for i, it in enumerate(iters[-1:]):
        resp = str(it.get("response", ""))[:200].replace("\n", " | ")
        print("末轮回复:", resp)
        print("解析结果:", str(it.get("parsed", it.get("parse_ok", "")))[:100])
        print("校验反馈:", str(it.get("feedback", it.get("violations", "")))[:260].replace("\n", " | "))
    print()

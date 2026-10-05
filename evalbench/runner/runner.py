import csv
import json
import os
import subprocess
import uuid
from datetime import datetime

import yaml

from ..llm.budget import Budget, BudgetExhausted
from ..llm.client import LLMClient
from ..metrics.metrics import primal_gap, quality_score
from .references import get_reference

SYSTEM_PROMPT = "你是一名运筹优化专家，必须严格按用户要求的 JSON 格式输出。"
PROMPT_VERSION = "v1"


def label_failure(status, transcript):
    """F5 > F1 > F3 > F4 > F2 > F6，详见 docs/design/失败模式分类.md"""
    if status.startswith("solved"):
        return ""
    if status == "budget_exhausted":
        return "F5"
    if not transcript:
        return "F6"
    if not transcript[-1].get("parsed"):
        return "F1"
    viol = ";".join(transcript[-1].get("violations", []))
    if "越界" in viol or "不存在" in viol:
        return "F3"
    costs = [t.get("cost") for t in transcript]
    if (len(costs) >= 2 and costs[-1] is not None
            and costs[-1] == costs[-2]):
        return "F4"
    if viol:
        return "F2"
    return "F6"


def solve_once(problem, inst, llm, reference, budget_cfg, max_iters=5):
    """单实例智能体循环：生成 -> 解析 -> 验证 -> 反馈迭代。返回 (row, transcript)。"""
    budget = Budget(**(budget_cfg or {}))
    feedback, best, transcript, status = None, None, [], "exhausted_iters"
    try:
        for it in range(1, max_iters + 1):
            budget.check()
            user = problem.prompt(inst)
            if feedback is not None:
                user += "\n\n你上一轮的尝试未通过验证，错误信息：\n" + feedback \
                        + "\n请修正后重新输出完整 JSON。"
            resp = llm.chat(SYSTEM_PROMPT, user)
            budget.record_call(resp["prompt_tokens"] + resp["completion_tokens"])
            sol = problem.parse(resp["text"], inst)
            if sol is None:
                ev = {"feasible": False, "cost": None, "violations": ["解析失败"]}
            else:
                ev = problem.evaluate(inst, sol)
            transcript.append({
                "iter": it, "raw": resp["text"], "parsed": sol is not None,
                "prompt_tokens": resp["prompt_tokens"],
                "completion_tokens": resp["completion_tokens"],
                "latency": resp["latency"],
                "feasible": ev["feasible"], "cost": ev["cost"],
                "violations": ev["violations"],
            })
            if ev["feasible"]:
                best, status = ev, f"solved_iter{it}"
                break
            feedback = "; ".join(ev["violations"]) or "解不可行"
    except BudgetExhausted:
        status = "budget_exhausted"
    cost = best["cost"] if best else None
    row = {
        "model": llm.model, "problem": problem.name, "scale": inst.scale,
        "instance": inst.name, "status": status,
        "feasible": int(best is not None and best["feasible"]),
        "cost": cost, "reference": reference,
        "primal_gap": primal_gap(cost, reference),
        "quality": quality_score(cost, reference),
        "failure_class": label_failure(status, transcript),
        "tokens_in": sum(t["prompt_tokens"] for t in transcript),
        "tokens_out": sum(t["completion_tokens"] for t in transcript),
        **budget.snapshot(),
    }
    return row, transcript


class Runner:
    def __init__(self, config_path, out_root="results"):
        with open(config_path, encoding="utf-8") as f:
            self.cfg = yaml.safe_load(f)
        self.run_id = (datetime.now().strftime("%Y%m%d-%H%M%S")
                       + "-" + uuid.uuid4().hex[:6])
        self.out_dir = os.path.join(out_root, self.run_id)
        os.makedirs(os.path.join(self.out_dir, "transcripts"), exist_ok=True)
        with open(os.path.join(self.out_dir, "config.yaml"), "w",
                  encoding="utf-8") as f:
            yaml.safe_dump(self.cfg, f, allow_unicode=True)

    def _manifest(self):
        try:
            rev = subprocess.run(
                ["git", "rev-parse", "--short", "HEAD"],
                capture_output=True, text=True).stdout.strip()
        except Exception:
            rev = "unknown"
        manifest = {
            "run_id": self.run_id,
            "created": datetime.now().isoformat(timespec="seconds"),
            "git_commit": rev,
            "prompt_version": PROMPT_VERSION,
            "system_prompt": SYSTEM_PROMPT,
        }
        with open(os.path.join(self.out_dir, "manifest.json"), "w",
                  encoding="utf-8") as f:
            json.dump(manifest, f, ensure_ascii=False, indent=2)

    def _append_csv(self, row, path, fields):
        new = not os.path.exists(path)
        with open(path, "a", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=fields)
            if new:
                w.writeheader()
            w.writerow(row)

    def run(self, llm_factory=None):
        from ..problems.registry import PROBLEMS
        if llm_factory is None:
            llm_factory = lambda m: LLMClient(   # noqa: E731
                model=m["name"], base_url=m["base_url"],
                api_key=os.environ.get(m["env_key"]),
                temperature=m.get("temperature", 0.7))
        self._manifest()
        summary_path = os.path.join(self.out_dir, "summary.csv")
        fields = ["run_id", "model", "problem", "scale", "instance", "repeat",
                  "status", "feasible", "cost", "reference", "primal_gap",
                  "quality", "failure_class", "tokens_in", "tokens_out",
                  "calls", "tokens", "seconds"]
        done = set()
        if os.path.exists(summary_path):
            with open(summary_path, encoding="utf-8") as f:
                done = {(r["model"], r["problem"], r["scale"],
                         r["instance"], r["repeat"])
                        for r in csv.DictReader(f)}
        for m in self.cfg["models"]:
            llm = llm_factory(m)
            for p in self.cfg["problems"]:
                problem = PROBLEMS[p["name"]]()
                for scale in p["scales"]:
                    n = problem.sizes[scale]
                    for seed in range(1, self.cfg["instances_per_scale"] + 1):
                        inst = problem.generate(n, seed)
                        ref = get_reference(problem, inst)
                        for rep in range(1, self.cfg.get("repeats", 1) + 1):
                            if (m["name"], problem.name, scale,
                                    inst.name, str(rep)) in done:
                                continue
                            row, transcript = solve_once(
                                problem, inst, llm, ref,
                                self.cfg.get("budget"),
                                self.cfg.get("max_iters", 5))
                            row["run_id"] = self.run_id
                            row["repeat"] = rep
                            self._append_csv(row, summary_path, fields)
                            tpath = os.path.join(
                                self.out_dir, "transcripts",
                                f"{m['name']}_{problem.name}_{inst.name}_r{rep}.json")
                            with open(tpath, "w", encoding="utf-8") as f:
                                json.dump({"row": row, "transcript": transcript},
                                          f, ensure_ascii=False, indent=2)
                            print(f"[{self.run_id}] {m['name']} {inst.name} "
                                  f"r{rep}: {row['status']}")
        print(f"完成。结果目录：{self.out_dir}")


if __name__ == "__main__":
    import sys
    from dotenv import load_dotenv
    load_dotenv()
    Runner(sys.argv[1]).run()

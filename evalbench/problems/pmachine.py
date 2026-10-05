import json
import random
import re

from .base import Instance, Problem


class ParallelSchedulingProblem(Problem):
    """平行机调度 P||Cmax：solution = 每个作业的机器编号列表，cost = makespan。"""

    name = "pmachine"
    sizes = {"small": 20, "medium": 60, "large": 120}
    machines = {"small": 4, "medium": 8, "large": 12}

    def generate(self, n, seed):
        rng = random.Random(seed)
        scale = self.scale_of(n)
        m = self.machines.get(scale, 4)
        jobs = [round(rng.uniform(1, 20), 1) for _ in range(n)]
        return Instance(name=f"pm_n{n}_s{seed}", scale=scale,
                        data={"jobs": jobs, "m": m, "n": n})

    def evaluate(self, inst, solution):
        jobs, m, n = inst.data["jobs"], inst.data["m"], inst.data["n"]
        if not isinstance(solution, list) or len(solution) != n:
            return {"feasible": False, "cost": None,
                    "violations": ["指派长度不等于作业数"]}
        if not all(isinstance(x, int) for x in solution):
            return {"feasible": False, "cost": None,
                    "violations": ["指派含非整数元素"]}
        if any(x < 0 or x >= m for x in solution):
            return {"feasible": False, "cost": None,
                    "violations": ["机器编号越界"]}
        loads = [0.0] * m
        for j, k in enumerate(solution):
            loads[k] += jobs[j]
        return {"feasible": True, "cost": round(max(loads), 3), "violations": []}

    def reference(self, inst):
        from ..baselines.baselines import pmachine_reference
        return pmachine_reference(inst.data["jobs"], inst.data["m"])

    def prompt(self, inst):
        jobs, m = inst.data["jobs"], inst.data["m"]
        items = ", ".join(f"作业{i}(时长{p})" for i, p in enumerate(jobs))
        return (
            f"你是运筹优化专家。将下列 {len(jobs)} 个作业分配到 {m} 台同速机器上，"
            "每个作业恰好分给一台机器，最小化最大机器负载（makespan）。\n"
            f"作业（编号(时长)）：{items}\n\n"
            "输出要求：只输出一个 JSON 对象，形如 "
            '{"assign": [0, 2, 1, ...]}，assign[j] 为作业 j 分配到的机器编号'
            f"（0 到 {m - 1}），列表长度等于作业数。不要输出任何其他文字。"
        )

    def parse(self, text, inst):
        m = re.search(r"\{.*\}", text, re.S)
        if not m:
            return None
        try:
            obj = json.loads(m.group(0))
        except json.JSONDecodeError:
            return None
        a = obj.get("assign") if isinstance(obj, dict) else None
        return a if isinstance(a, list) else None

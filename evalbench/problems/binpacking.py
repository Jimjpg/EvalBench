import json
import random
import re

from .base import Instance, Problem


class BinPackingProblem(Problem):
    """一维装箱：solution = 箱的列表，每箱是物品下标列表，cost = 箱数。"""

    name = "binpacking"
    sizes = {"small": 20, "medium": 60, "large": 120}
    capacity = 100

    def generate(self, n, seed):
        rng = random.Random(seed)
        sizes = [rng.randint(10, 60) for _ in range(n)]
        return Instance(name=f"bpp_n{n}_s{seed}", scale=self.scale_of(n),
                        data={"sizes": sizes, "capacity": self.capacity, "n": n})

    def evaluate(self, inst, solution):
        cap, n = inst.data["capacity"], inst.data["n"]
        if (not isinstance(solution, list)
                or not all(isinstance(b, list) for b in solution)):
            return {"feasible": False, "cost": None,
                    "violations": ["解不是箱的列表"]}
        flat = [x for b in solution for x in b]
        if sorted(flat) != list(range(n)):
            missing = set(range(n)) - set(flat)
            extra = [x for x in flat if x < 0 or x >= n]
            why = []
            if extra:
                why.append("物品下标越界")
            if missing and not extra:
                why.append("物品缺失或重复装箱")
            if not missing and not extra and len(flat) != len(set(flat)):
                why.append("物品缺失或重复装箱")
            return {"feasible": False, "cost": None, "violations": why or ["物品集合不正确"]}
        loads = [sum(inst.data["sizes"][i] for i in b) for b in solution]
        if any(l > cap for l in loads):
            return {"feasible": False, "cost": None,
                    "violations": ["存在箱子超过容量"]}
        return {"feasible": True, "cost": len(solution), "violations": []}

    def reference(self, inst):
        from ..baselines.baselines import bpp_reference_cost
        return bpp_reference_cost(inst.data["sizes"], inst.data["capacity"])

    def prompt(self, inst):
        sizes, cap = inst.data["sizes"], inst.data["capacity"]
        items = ", ".join(f"{i}(体积{s})" for i, s in enumerate(sizes))
        return (
            "你是运筹优化专家。将下列物品装入容量为 "
            f"{cap} 的箱子，每个物品恰好装入一箱且不得超容量，最小化使用箱数。\n"
            f"物品（编号(体积)）：{items}\n\n"
            "输出要求：只输出一个 JSON 对象，形如 "
            '{"bins": [[0, 3], [1, 2]]}，bins 的每个子列表是一箱内的物品编号。'
            "不要输出任何其他文字。"
        )

    def parse(self, text, inst):
        m = re.search(r"\{.*\}", text, re.S)
        if not m:
            return None
        try:
            obj = json.loads(m.group(0))
        except json.JSONDecodeError:
            return None
        bins = obj.get("bins") if isinstance(obj, dict) else None
        return bins if isinstance(bins, list) else None

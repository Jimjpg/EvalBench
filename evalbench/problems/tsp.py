import json
import math
import random
import re

from .base import Instance, Problem


class TSPProblem(Problem):
    """欧氏 TSP：solution = 按访问顺序的城市下标列表。"""

    name = "tsp"
    sizes = {"small": 10, "medium": 50, "large": 200}

    def generate(self, n, seed):
        rng = random.Random(seed)
        pts = [(round(rng.uniform(0, 100), 2), round(rng.uniform(0, 100), 2))
               for _ in range(n)]
        return Instance(name=f"tsp_n{n}_s{seed}", scale=self.scale_of(n),
                        data={"points": pts, "n": n})

    def evaluate(self, inst, solution):
        n, pts = inst.data["n"], inst.data["points"]
        if not isinstance(solution, list) or len(solution) != n:
            return {"feasible": False, "cost": None,
                    "violations": ["路线城市数不等于 n"]}
        if not all(isinstance(x, int) for x in solution):
            return {"feasible": False, "cost": None,
                    "violations": ["路线含非整数元素"]}
        if any(x < 0 or x >= n for x in solution):
            return {"feasible": False, "cost": None,
                    "violations": ["城市下标越界"]}
        if sorted(solution) != list(range(n)):
            return {"feasible": False, "cost": None,
                    "violations": ["城市缺失或重复访问"]}
        tour = [pts[i] for i in solution]
        cost = sum(math.dist(tour[i], tour[(i + 1) % n]) for i in range(n))
        return {"feasible": True, "cost": round(cost, 3), "violations": []}

    def reference(self, inst):
        from ..baselines.baselines import tsp_reference_cost
        return tsp_reference_cost(inst.data["points"])

    def prompt(self, inst):
        pts, n = inst.data["points"], inst.data["n"]
        coord = "\n".join(f"{i}: ({x}, {y})" for i, (x, y) in enumerate(pts))
        return (
            "你是运筹优化专家。求解如下旅行商问题（TSP）：从城市 0 出发，"
            "访问每个城市恰好一次并回到起点，最小化总欧氏距离。\n"
            f"城市坐标（编号: (x, y)）：\n{coord}\n\n"
            "输出要求：只输出一个 JSON 对象，形如 "
            '{"tour": [0, 3, 1, 2]}，tour 必须是 0 到 '
            f"{n - 1} 的一个排列。不要输出任何其他文字。"
        )

    def parse(self, text, inst):
        m = re.search(r"\{.*\}", text, re.S)
        if not m:
            return None
        try:
            obj = json.loads(m.group(0))
        except json.JSONDecodeError:
            return None
        tour = obj.get("tour") if isinstance(obj, dict) else None
        return tour if isinstance(tour, list) else None

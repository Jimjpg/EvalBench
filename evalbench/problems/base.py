from dataclasses import dataclass, field
from typing import Any, Optional


@dataclass
class Instance:
    name: str
    scale: str            # small / medium / large
    data: dict
    meta: dict = field(default_factory=dict)


class Problem:
    """所有问题的统一接口。solution 的具体类型由子类定义。"""

    name: str = "base"
    sizes: dict = {}      # {"small": n, "medium": n, "large": n}

    def scale_of(self, n) -> str:
        for k, v in self.sizes.items():
            if v == n:
                return k
        return "small"    # 测试用任意 n 的兜底

    def generate(self, n, seed) -> Instance:
        raise NotImplementedError

    def evaluate(self, inst: Instance, solution: Any) -> dict:
        """返回 {"feasible": bool, "cost": float|None, "violations": [str]}"""
        raise NotImplementedError

    def reference(self, inst: Instance) -> float:
        raise NotImplementedError

    def prompt(self, inst: Instance) -> str:
        raise NotImplementedError

    def parse(self, text: str, inst: Instance) -> Optional[Any]:
        raise NotImplementedError

import pytest

from evalbench.problems.tsp import TSPProblem

SQ = [(0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0)]  # 单位正方形


def test_tsp_generate_deterministic():
    p = TSPProblem()
    a = p.generate(4, seed=1)
    b = p.generate(4, seed=1)
    assert a.data["points"] == b.data["points"]
    assert a.scale == "small" and a.name == "tsp_n4_s1"


def test_tsp_evaluate_square_optimal():
    p = TSPProblem()
    inst = p.generate(4, seed=1)
    inst.data["points"] = SQ
    ev = p.evaluate(inst, [0, 1, 2, 3])
    assert ev["feasible"] is True
    assert abs(ev["cost"] - 4.0) < 1e-6


def test_tsp_evaluate_rejected_on_repeat():
    p = TSPProblem()
    inst = p.generate(4, seed=1)
    inst.data["points"] = SQ
    ev = p.evaluate(inst, [0, 0, 1, 2])
    assert ev["feasible"] is False and ev["cost"] is None


def test_tsp_evaluate_rejected_on_out_of_range():
    p = TSPProblem()
    inst = p.generate(4, seed=1)
    inst.data["points"] = SQ
    ev = p.evaluate(inst, [0, 1, 2, 9])
    assert ev["feasible"] is False
    assert any("越界" in v for v in ev["violations"])


def test_tsp_parse_from_markdown_fence():
    p = TSPProblem()
    inst = p.generate(4, seed=1)
    sol = p.parse('好的，结果如下：\n```json\n{"tour": [0, 2, 1, 3]}\n```', inst)
    assert sol == [0, 2, 1, 3]


def test_tsp_parse_garbage_returns_none():
    p = TSPProblem()
    inst = p.generate(4, seed=1)
    assert p.parse("我不会做这道题", inst) is None


from evalbench.problems.binpacking import BinPackingProblem
from evalbench.problems.pmachine import ParallelSchedulingProblem


def test_bpp_evaluate_feasible():
    p = BinPackingProblem()
    inst = p.generate(3, seed=1)
    inst.data["sizes"] = [50, 50, 60]
    inst.data["capacity"] = 100
    ev = p.evaluate(inst, [[0, 1], [2]])
    assert ev["feasible"] is True and ev["cost"] == 2


def test_bpp_evaluate_overload():
    p = BinPackingProblem()
    inst = p.generate(3, seed=1)
    inst.data["sizes"] = [60, 60, 50]
    inst.data["capacity"] = 100
    ev = p.evaluate(inst, [[0, 1], [2]])
    assert ev["feasible"] is False
    assert any("容量" in v for v in ev["violations"])


def test_bpp_evaluate_missing_item():
    p = BinPackingProblem()
    inst = p.generate(3, seed=1)
    inst.data["sizes"] = [50, 50, 60]
    inst.data["capacity"] = 100
    ev = p.evaluate(inst, [[0, 1]])
    assert ev["feasible"] is False


def test_bpp_parse():
    p = BinPackingProblem()
    inst = p.generate(3, seed=1)
    sol = p.parse('结果：{"bins": [[0, 2], [1]]}', inst)
    assert sol == [[0, 2], [1]]


def test_pmachine_evaluate_makespan():
    p = ParallelSchedulingProblem()
    inst = p.generate(3, seed=1)
    inst.data["jobs"] = [3.0, 3.0, 2.0]
    inst.data["m"] = 2
    ev = p.evaluate(inst, [0, 0, 1])
    assert ev["feasible"] is True and abs(ev["cost"] - 6.0) < 1e-9


def test_pmachine_evaluate_bad_assign():
    p = ParallelSchedulingProblem()
    inst = p.generate(3, seed=1)
    inst.data["jobs"] = [3.0, 3.0, 2.0]
    inst.data["m"] = 2
    ev = p.evaluate(inst, [0, 1])          # 长度不足
    assert ev["feasible"] is False
    ev2 = p.evaluate(inst, [0, 1, 5])      # 机器号越界
    assert ev2["feasible"] is False


def test_registry_contains_three_problems():
    from evalbench.problems.registry import PROBLEMS
    assert set(PROBLEMS) == {"tsp", "binpacking", "pmachine"}

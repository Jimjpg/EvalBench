import csv
import json
import os

from evalbench.problems.tsp import TSPProblem
from evalbench.runner.runner import Runner, label_failure, solve_once


class FakeLLM:
    model = "fake-model"

    def __init__(self, replies):
        self.replies = list(replies)
        self.i = 0

    def chat(self, system, user, max_tokens=4096):
        r = self.replies[min(self.i, len(self.replies) - 1)]
        self.i += 1
        return {"text": r, "prompt_tokens": 10,
                "completion_tokens": 10, "latency": 0.01}


def _square_inst():
    p = TSPProblem()
    inst = p.generate(4, seed=1)
    inst.data["points"] = [(0, 0), (0, 10), (10, 10), (10, 0)]
    return p, inst


def test_solve_once_success_first_iter():
    p, inst = _square_inst()
    llm = FakeLLM(['{"tour": [0, 1, 2, 3]}'])
    budget_cfg = {"max_calls": 3}
    row, transcript = solve_once(p, inst, llm, 40.0, budget_cfg, max_iters=3)
    assert row["feasible"] == 1
    assert abs(row["cost"] - 40.0) < 1e-6
    assert row["primal_gap"] == 0.0
    assert row["status"].startswith("solved")
    assert row["failure_class"] == ""
    assert len(transcript) == 1


def test_solve_once_parse_then_fix():
    p, inst = _square_inst()
    llm = FakeLLM(["我不会做", '{"tour": [0, 1, 2, 3]}'])
    row, transcript = solve_once(p, inst, llm, 40.0, {}, max_iters=3)
    assert row["feasible"] == 1 and len(transcript) == 2


def test_solve_once_budget_exhausted():
    p, inst = _square_inst()
    llm = FakeLLM(["我不会做"])
    row, transcript = solve_once(p, inst, llm, 40.0,
                                 {"max_calls": 1}, max_iters=5)
    assert row["feasible"] == 0
    assert row["status"] == "budget_exhausted"
    assert row["failure_class"] == "F5"


def test_label_failure_f1():
    t = [{"parsed": False}]
    assert label_failure("exhausted_iters", t) == "F1"


def test_label_failure_f3_on_out_of_range():
    t = [{"parsed": True,
          "violations": ["城市下标越界"]}]
    assert label_failure("exhausted_iters", t) == "F3"


def test_label_failure_f2_plain_infeasible():
    t = [{"parsed": True, "violations": ["城市缺失或重复访问"]}]
    assert label_failure("exhausted_iters", t) == "F2"


def test_label_failure_solved_empty():
    assert label_failure("solved_iter2", []) == ""


def test_runner_end_to_end(tmp_path):
    import yaml
    cfg = {
        "run_name": "ut",
        "models": [{"name": "fake-model", "base_url": "http://x",
                    "env_key": "LLM_API_KEY", "temperature": 0.7}],
        "problems": [{"name": "tsp", "scales": ["small"]}],
        "instances_per_scale": 1,
        "repeats": 1,
        "max_iters": 2,
        "budget": {"max_calls": 3},
    }
    cfg_path = tmp_path / "cfg.yaml"
    cfg_path.write_text(yaml.safe_dump(cfg), encoding="utf-8")
    r = Runner(str(cfg_path), out_root=str(tmp_path / "results"))
    monkey_llm = FakeLLM(['{"tour": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]}'])
    r.run(llm_factory=lambda m: monkey_llm)
    summary = os.path.join(r.out_dir, "summary.csv")
    assert os.path.exists(summary)
    rows = list(csv.DictReader(open(summary, encoding="utf-8")))
    assert len(rows) == 1 and rows[0]["feasible"] == "1"
    assert os.path.exists(os.path.join(r.out_dir, "manifest.json"))


def test_runner_resume_reuses_directory(tmp_path):
    import yaml
    cfg = {
        "run_name": "ut",
        "models": [{"name": "fake-model", "base_url": "http://x",
                    "env_key": "LLM_API_KEY", "temperature": 0.7}],
        "problems": [{"name": "tsp", "scales": ["small"]}],
        "instances_per_scale": 2,
        "repeats": 1,
        "max_iters": 2,
        "budget": {"max_calls": 3},
    }
    cfg_path = tmp_path / "cfg.yaml"
    cfg_path.write_text(yaml.safe_dump(cfg), encoding="utf-8")
    out_root = str(tmp_path / "results")

    class RefuseLLM:
        model = "fake-model"

        def chat(self, *a, **k):
            raise AssertionError("续跑不应重复调用 LLM")

    r1 = Runner(str(cfg_path), out_root=out_root)
    r1.run(llm_factory=lambda m: FakeLLM(
        ['{"tour": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]}']))
    before_manifest = open(os.path.join(r1.out_dir, "manifest.json"),
                           encoding="utf-8").read()

    r2 = Runner(str(cfg_path), out_root=out_root, run_id=r1.run_id)
    assert r2.out_dir == r1.out_dir
    r2.run(llm_factory=lambda m: RefuseLLM())

    rows = list(csv.DictReader(open(
        os.path.join(r2.out_dir, "summary.csv"), encoding="utf-8")))
    assert len(rows) == 2
    after_manifest = open(os.path.join(r2.out_dir, "manifest.json"),
                          encoding="utf-8").read()
    assert before_manifest == after_manifest


def test_runner_resume_rejects_unknown_dir(tmp_path):
    import yaml
    import pytest
    cfg = {
        "run_name": "ut",
        "models": [{"name": "fake-model", "base_url": "http://x",
                    "env_key": "LLM_API_KEY", "temperature": 0.7}],
        "problems": [{"name": "tsp", "scales": ["small"]}],
        "instances_per_scale": 1,
        "repeats": 1,
    }
    cfg_path = tmp_path / "cfg.yaml"
    cfg_path.write_text(yaml.safe_dump(cfg), encoding="utf-8")
    with pytest.raises(FileNotFoundError):
        Runner(str(cfg_path), out_root=str(tmp_path / "results"),
               run_id="nonexistent")

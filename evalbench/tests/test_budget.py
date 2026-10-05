import pytest

from evalbench.llm.budget import Budget, BudgetExhausted


def test_call_limit():
    b = Budget(max_calls=2)
    b.record_call(10)
    b.check()
    b.record_call(10)
    with pytest.raises(BudgetExhausted):
        b.check()


def test_token_limit():
    b = Budget(max_tokens=100)
    b.record_call(101)
    with pytest.raises(BudgetExhausted):
        b.check()


def test_time_limit():
    b = Budget(max_seconds=-1)     # 已过期
    with pytest.raises(BudgetExhausted):
        b.check()


def test_snapshot_counts():
    b = Budget()
    b.record_call(30)
    b.record_call(20)
    s = b.snapshot()
    assert s["calls"] == 2 and s["tokens"] == 50 and s["seconds"] >= 0


def test_unlimited_never_raises():
    b = Budget()
    b.record_call(10**9)
    b.check()

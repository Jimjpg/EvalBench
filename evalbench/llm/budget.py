import time


class BudgetExhausted(Exception):
    """预算耗尽，由 runner 捕获并正常收尾。"""


class Budget:
    """三重预算：调用次数 / token 总量 / 墙钟时间。"""

    def __init__(self, max_calls=None, max_tokens=None, max_seconds=None):
        self.max_calls = max_calls
        self.max_tokens = max_tokens
        self.max_seconds = max_seconds
        self.start = time.monotonic()
        self.calls = 0
        self.tokens = 0

    def record_call(self, tokens: int):
        self.calls += 1
        self.tokens += tokens

    @property
    def elapsed(self) -> float:
        return time.monotonic() - self.start

    def check(self):
        if self.max_calls is not None and self.calls >= self.max_calls:
            raise BudgetExhausted(f"调用次数达到上限 {self.max_calls}")
        if self.max_tokens is not None and self.tokens >= self.max_tokens:
            raise BudgetExhausted(f"token 达到上限 {self.max_tokens}")
        if self.max_seconds is not None and self.elapsed >= self.max_seconds:
            raise BudgetExhausted(f"时间达到上限 {self.max_seconds}s")

    def snapshot(self) -> dict:
        return {"calls": self.calls, "tokens": self.tokens,
                "seconds": round(self.elapsed, 2)}

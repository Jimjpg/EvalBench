import math
from statistics import mean, pstdev


def primal_gap(cost, reference):
    """FrontierCO 式 primal gap：0=达到参考解，1=不可行或符号异常。"""
    if cost is None or not math.isfinite(cost):
        return 1.0
    denom = max(abs(cost), abs(reference))
    if denom == 0:
        return 0.0
    if cost * reference < 0:
        return 1.0
    return abs(cost - reference) / denom


def quality_score(cost, reference):
    """HeuriGym 式质量分：达到/超过参考=1，越差越低，不可行=0。"""
    if cost is None or cost <= 0:
        return 0.0
    return max(0.0, min(1.0, reference / cost))


def qyi(quality, yield_rate):
    """Quality-Yield Index：quality 与 yield 的调和平均。"""
    if quality + yield_rate == 0:
        return 0.0
    return 2.0 * quality * yield_rate / (quality + yield_rate)


def stability_cv(values):
    """多次运行的变异系数（对 primal_gap 序列用）。单值返回 0。"""
    vals = [v for v in values if v is not None and math.isfinite(v)]
    if len(vals) < 2:
        return 0.0
    m = mean(vals)
    return (pstdev(vals) / m) if m != 0 else 0.0

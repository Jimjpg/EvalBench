import math
from statistics import pstdev

from evalbench.metrics.metrics import primal_gap, quality_score, qyi, stability_cv


def test_gap_optimal_is_zero():
    assert primal_gap(100.0, 100.0) == 0.0

def test_gap_basic():
    assert abs(primal_gap(110.0, 100.0) - 10 / 110) < 1e-9

def test_gap_infeasible_is_one():
    assert primal_gap(None, 100.0) == 1.0

def test_gap_sign_flip_is_one():
    assert primal_gap(-5.0, 100.0) == 1.0

def test_gap_both_zero():
    assert primal_gap(0.0, 0.0) == 0.0

def test_quality_better_than_ref_capped_at_one():
    assert quality_score(90.0, 100.0) == 1.0

def test_quality_worse():
    assert abs(quality_score(125.0, 100.0) - 0.8) < 1e-9

def test_quality_infeasible_is_zero():
    assert quality_score(None, 100.0) == 0.0

def test_qyi_harmonic_mean():
    assert abs(qyi(1.0, 0.5) - (2 * 1.0 * 0.5 / 1.5)) < 1e-9

def test_qyi_zero_when_both_zero():
    assert qyi(0.0, 0.0) == 0.0

def test_stability_cv_matches_definition():
    vals = [0.1, 0.2, 0.3]
    assert abs(stability_cv(vals) - pstdev(vals) / 0.2) < 1e-9

def test_stability_single_value_is_zero():
    assert stability_cv([0.5]) == 0.0

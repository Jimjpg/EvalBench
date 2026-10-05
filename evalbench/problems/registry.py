from .binpacking import BinPackingProblem
from .pmachine import ParallelSchedulingProblem
from .tsp import TSPProblem

PROBLEMS = {
    TSPProblem.name: TSPProblem,
    BinPackingProblem.name: BinPackingProblem,
    ParallelSchedulingProblem.name: ParallelSchedulingProblem,
}

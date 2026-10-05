import itertools
import math

from ortools.constraint_solver import routing_enums_pb2, pywrapcp
from ortools.sat.python import cp_model


# ---------- TSP ----------

def tour_cost(pts, tour):
    n = len(tour)
    return sum(math.dist(pts[tour[i]], pts[tour[(i + 1) % n]])
               for i in range(n))


def nearest_neighbor_tour(pts):
    n = len(pts)
    unvisited, tour = set(range(1, n)), [0]
    while unvisited:
        cur = tour[-1]
        nxt = min(unvisited, key=lambda j: math.dist(pts[cur], pts[j]))
        tour.append(nxt)
        unvisited.remove(nxt)
    return tour


def two_opt(pts, tour):
    n, improved = len(tour), True
    while improved:
        improved = False
        for i in range(1, n - 2):
            a, b = tour[i - 1], tour[i]
            for j in range(i + 1, n - 1):
                c, d = tour[j], tour[j + 1]
                delta = (math.dist(pts[a], pts[c]) + math.dist(pts[b], pts[d])
                         - math.dist(pts[a], pts[b]) - math.dist(pts[c], pts[d]))
                if delta < -1e-9:
                    tour[i:j + 1] = reversed(tour[i:j + 1])
                    improved = True
    return tour


def tsp_reference_cost(pts, time_limit_s=30):
    """小规模(<=10)暴力精确；否则 OR-Tools 路由求解器(GLS, 30s 限时)。"""
    n = len(pts)
    if n <= 10:
        best = min(tour_cost(pts, [0] + list(p))
                   for p in itertools.permutations(range(1, n)))
        return round(best, 3)
    manager = pywrapcp.RoutingIndexManager(n, 1, 0)
    routing = pywrapcp.RoutingModel(manager)

    def cb(i, j):
        return int(round(
            math.dist(pts[manager.IndexToNode(i)],
                      pts[manager.IndexToNode(j)]) * 1000))

    transit = routing.RegisterTransitCallback(cb)
    routing.SetArcCostEvaluatorOfAllVehicles(transit)
    search = pywrapcp.DefaultRoutingSearchParameters()
    search.first_solution_strategy = (
        routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC)
    search.local_search_metaheuristic = (
        routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH)
    search.time_limit.FromSeconds(time_limit_s)
    sol = routing.SolveWithParameters(search)
    if sol is None:  # OR-Tools 失败时退回 NN+2opt，口径需在报告注明
        return round(tour_cost(pts, two_opt(pts, nearest_neighbor_tour(pts))), 3)
    return round(sol.ObjectiveValue() / 1000.0, 3)


# ---------- BPP ----------

def first_fit_decreasing(sizes, capacity):
    bins = []
    for s in sorted(sizes, reverse=True):
        for b in bins:
            if sum(b) + s <= capacity:
                b.append(s)
                break
        else:
            bins.append([s])
    return bins


def bpp_reference_cost(sizes, capacity, time_limit_s=30):
    """>=25 项用 FFD 启发式；否则 CP-SAT 精确。"""
    if len(sizes) > 25:
        return len(first_fit_decreasing(sizes, capacity))
    n = len(sizes)
    ub = len(first_fit_decreasing(sizes, capacity))
    model = cp_model.CpModel()
    x = [[model.NewBoolVar(f"x{i}_{b}") for b in range(ub)] for i in range(n)]
    used = [model.NewBoolVar(f"u{b}") for b in range(ub)]
    for i in range(n):
        model.AddExactlyOne(x[i])
    for b in range(ub):
        load = sum(sizes[i] * x[i][b] for i in range(n))
        model.Add(load <= capacity)
        # 修正（2026-10-05）：计划原代码为 model.Add(load >= used[b])，
        # 方向反了——允许 used=0 但箱内有物品，最小化会把 used 全压 0，
        # 目标恒为 0。正确联结：used=0 则该箱负载必须为 0。
        model.Add(load <= capacity * used[b])
    model.Minimize(sum(used))
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = time_limit_s
    status = solver.Solve(model)
    if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return int(round(solver.ObjectiveValue()))
    return ub


# ---------- P||Cmax ----------

def lpt_makespan(jobs, m):
    loads = [0.0] * m
    for p in sorted(jobs, reverse=True):
        loads[loads.index(min(loads))] += p
    return round(max(loads), 3)


def pmachine_reference(jobs, m, time_limit_s=30):
    """>=25 项用 LPT 启发式；否则 CP-SAT 精确 makespan。"""
    if len(jobs) > 25:
        return lpt_makespan(jobs, m)
    n = len(jobs)
    model = cp_model.CpModel()
    x = [[model.NewBoolVar(f"x{i}_{k}") for k in range(m)] for i in range(n)]
    scaled_ub = int(sum(jobs) * 10) + 1
    ms = model.NewIntVar(0, scaled_ub, "ms")   # 时长×10 取整后进入 CP-SAT
    for i in range(n):
        model.AddExactlyOne(x[i])
    for k in range(m):
        model.Add(sum(int(round(jobs[i] * 10)) * x[i][k] for i in range(n))
                  <= ms)
    model.Minimize(ms)
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = time_limit_s
    status = solver.Solve(model)
    if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return solver.ObjectiveValue() / 10.0
    return lpt_makespan(jobs, m)

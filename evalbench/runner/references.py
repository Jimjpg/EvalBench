import json
import os

DEFAULT_CACHE = os.path.join("results", "references.json")


def get_reference(problem, inst, cache_path=DEFAULT_CACHE):
    os.makedirs(os.path.dirname(cache_path), exist_ok=True)
    cache = {}
    if os.path.exists(cache_path):
        with open(cache_path, encoding="utf-8") as f:
            cache = json.load(f)
    key = f"{problem.name}/{inst.name}"
    if key not in cache:
        cache[key] = problem.reference(inst)
        with open(cache_path, "w", encoding="utf-8") as f:
            json.dump(cache, f, ensure_ascii=False, indent=2)
    return cache[key]

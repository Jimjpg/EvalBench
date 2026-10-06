import re
import subprocess
import sys

files = subprocess.run(
    ["git", "ls-files"], capture_output=True, text=True, encoding="utf-8"
).stdout.splitlines()

skip_dirs = ("report/", "node_modules/", "docs/plans/")
patterns = [
    (re.compile(r"sk-[a-zA-Z0-9]{20,}"), "DeepSeek/DashScope style key"),
    (re.compile(r"(?i)api[_-]?key\s*[=:]\s*['\"][a-zA-Z0-9]{16,}"), "assigned key literal"),
    (re.compile(r"(?i)bearer\s+[a-zA-Z0-9_\-\.]{24,}"), "bearer token"),
]

hits = 0
for f in files:
    if f.startswith(skip_dirs):
        continue
    try:
        text = open(f, encoding="utf-8", errors="ignore").read()
    except OSError:
        continue
    for i, line in enumerate(text.splitlines(), 1):
        for pat, label in patterns:
            m = pat.search(line)
            if m:
                hits += 1
                print(f"SUSPECT [{label}] {f}:{i}: {line.strip()[:120]}")

print(f"scanned {len(files)} tracked files, {hits} suspect lines")
sys.exit(0)

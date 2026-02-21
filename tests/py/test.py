#!/usr/bin/env python3
"""
Placeholder Python test runner.
Iterates fixtures and marks each as failed until the Python renderer is implemented.
Keeps `make test` failing as a reminder.
"""

import json
import sys
from pathlib import Path


def color(code: str) -> str:
    return f"\033[{code}m"


COL_RED = color("31")
COL_GREEN = color("32")
COL_DIM = color("2")
COL_RESET = color("0")

ROOT = Path(__file__).resolve().parents[1]
FIXTURE_DIR = ROOT / "fixtures"


def load_fixtures():
    for tpl_path in sorted(FIXTURE_DIR.glob("*.template.md")):
        base = tpl_path.stem.replace(".template", "")
        json_path = FIXTURE_DIR / f"{base}.data.json"
        out_path = FIXTURE_DIR / f"{base}.result.md"
        yield base, tpl_path, json_path, out_path


def main():
    args = [a for a in sys.argv[1:] if a != "update"]
    key = args[0] if args else None
    selected = []
    for base, tpl, js, outp in load_fixtures():
        if key and not base.startswith(key):
            continue
        selected.append((base, tpl, js, outp))

    if not selected:
        print(f"{COL_RED}✗{COL_RESET} no fixtures match", file=sys.stderr)
        sys.exit(1)

    failed = 0
    for base, tpl, js, outp in selected:
        print(f"{COL_RED}✗{COL_RESET} {base}")
        failed += 1

    if failed:
        print(f"{COL_RED}✖ fail{COL_RESET} ({failed}/{len(selected)} failed)")
        sys.exit(1)
    else:
        print(f"{COL_GREEN}✔ pass{COL_RESET} ({len(selected)}/{len(selected)} passed)")


if __name__ == "__main__":
    main()

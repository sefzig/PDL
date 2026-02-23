#!/usr/bin/env python3
"""Smoke runner for the Python PDL lib.

Renders fixtures (template + data [+ variables]) and prints the markdown.
This is analogous to tests/js/run.js.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "packages" / "py"))

from pdl import render  # type: ignore  # noqa: E402

FIXTURES_DIR = REPO_ROOT / "tests" / "fixtures"


def load_fixtures(prefix: str | None):
    bases = sorted(p.stem.replace(".template", "") for p in FIXTURES_DIR.glob("*.template.md"))
    if prefix:
        bases = [b for b in bases if b.startswith(prefix)]
        if not bases:
            raise SystemExit(f'No fixture matching key "{prefix}". Available: {", ".join(sorted(p.stem.replace(".template", "") for p in FIXTURES_DIR.glob("*.template.md")))}')
    for base in bases:
        tpl_path = FIXTURES_DIR / f"{base}.template.md"
        data_path = FIXTURES_DIR / f"{base}.data.json"
        vars_path = FIXTURES_DIR / f"{base}.variables.json"
        if not data_path.exists():
            raise FileNotFoundError(f"Missing data for fixture {base}: {data_path}")
        with tpl_path.open("r", encoding="utf-8") as f_tpl:
            template = f_tpl.read()
        with data_path.open("r", encoding="utf-8") as f_data:
            data = json.load(f_data)
        variables = {}
        if vars_path.exists():
            with vars_path.open("r", encoding="utf-8") as f_vars:
                variables = json.load(f_vars)
        yield base, template, data, variables


def main():
    prefix = sys.argv[1] if len(sys.argv) > 1 else None
    for base, template, data, variables in load_fixtures(prefix):
        print(f"\n=== {base} ===\n")
        res = render(template, data, {"variables": variables})
        markdown = res["markdown"] if isinstance(res, dict) else res
        print(markdown if markdown is not None else "<no output>")
        print()


if __name__ == "__main__":
    main()

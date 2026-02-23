#!/usr/bin/env python3
"""Dependency-free fixture runner for the Python PDL port.

Loads shared fixtures, renders with Python PDL, compares to expected markdown,
and exits non-zero on mismatch. No external deps required.
"""

import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "packages" / "py"))

from pdl import render  # type: ignore  # noqa: E402


FIXTURES_DIR = REPO_ROOT / "tests" / "fixtures"

COL = {
    "green": "\033[32m",
    "red": "\033[31m",
    "dim": "\033[2m",
    "reset": "\033[0m",
}


def green(text: str) -> str:
    return f"{COL['green']}{text}{COL['reset']}"


def red(text: str) -> str:
    return f"{COL['red']}{text}{COL['reset']}"


def load_fixtures(prefix=None):
    for tpl_path in sorted(FIXTURES_DIR.glob("*.template.md")):
        base = tpl_path.stem.replace(".template", "")
        if prefix and not base.startswith(prefix):
            continue
        data_path = FIXTURES_DIR / f"{base}.data.json"
        vars_path = FIXTURES_DIR / f"{base}.variables.json"
        if not data_path.exists():
            continue
        with tpl_path.open("r", encoding="utf-8") as f_tpl:
            template = f_tpl.read()
        with data_path.open("r", encoding="utf-8") as f_data:
            data = json.load(f_data)
        variables = {}
        if vars_path.exists():
            with vars_path.open("r", encoding="utf-8") as f_vars:
                variables = json.load(f_vars)
        yield base, data, template, variables


def main():
    prefix = sys.argv[1] if len(sys.argv) > 1 else None
    failed = 0
    total = 0
    for name, data, template, variables in load_fixtures(prefix):
        total += 1
        try:
            result = render(template, data, {"variables": variables})
            markdown = result["markdown"] if isinstance(result, dict) else result
            expected_path = FIXTURES_DIR / f"{name}.result.md"
            with expected_path.open("r", encoding="utf-8") as f_exp:
                expected = f_exp.read()

            actual_norm = markdown if markdown.endswith("\n") else markdown + "\n"
            expected_norm = expected if expected.endswith("\n") else expected + "\n"

            if actual_norm != expected_norm:
                failed += 1
                print(f"{red('✗')} {name}")
            else:
                print(f"{green('✓')} {name}")
        except Exception as exc:  # pylint: disable=broad-except
            failed += 1
            print(f"{red('✗')} {name} (error: {exc})")

    if failed:
        print(f"\n{red('✖ fail')} ({failed}/{total} failed)")
        sys.exit(1)
    print(f"{green('✔ pass')} ({total}/{total} passed)")


if __name__ == "__main__":
    main()

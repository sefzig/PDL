#!/usr/bin/env python3
"""Dependency-free fixture runner for the Python PDL port.

Loads shared fixtures, renders with Python PDL, compares to expected markdown,
and exits non-zero on mismatch. No external deps required.
"""

import json
import sys
import time
import difflib
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
    args = sys.argv[1:]
    wants_diff = "diff" in args
    diff_only = "diff-only" in args
    no_summary = "no-summary" in args
    prefix = None
    for a in args:
        if a in ("diff", "diff-only", "no-summary"):
            continue
        prefix = a
        break
    failed = 0
    total = 0
    total_ms = 0
    pass_ms = 0
    fail_ms = 0
    pass_count = 0
    for name, data, template, variables in load_fixtures(prefix):
        total += 1
        start = time.perf_counter()
        try:
            result = render(template, data, {"variables": variables})
            markdown = result["markdown"] if isinstance(result, dict) else result
            expected_path = FIXTURES_DIR / f"{name}.result.md"
            with expected_path.open("r", encoding="utf-8") as f_exp:
                expected = f_exp.read()

            actual_norm = markdown if markdown.endswith("\n") else markdown + "\n"
            expected_norm = expected if expected.endswith("\n") else expected + "\n"
            elapsed_ms = int((time.perf_counter() - start) * 1000)
            total_ms += elapsed_ms

            if actual_norm != expected_norm:
                failed += 1
                if not diff_only:
                    print(f"{red('✗')} {name}\033[2m {elapsed_ms}ms\033[0m")
                if wants_diff:
                    diff = "\n".join(
                        difflib.unified_diff(
                            expected_norm.splitlines(),
                            actual_norm.splitlines(),
                            lineterm="",
                        )
                    )
                    if diff:
                        dim = "\033[2m"
                        reset = "\033[0m"
                        print(f"{dim}{diff}{reset}")
                fail_ms += elapsed_ms
            else:
                if not diff_only:
                    print(f"{green('✓')} {name}\033[2m {elapsed_ms}ms\033[0m")
                pass_ms += elapsed_ms
                pass_count += 1
        except Exception as exc:  # pylint: disable=broad-except
            failed += 1
            elapsed_ms = int((time.perf_counter() - start) * 1000)
            total_ms += elapsed_ms
            if not diff_only:
                print(f"{red('✗')} {name} (error: {exc})\033[2m {elapsed_ms}ms\033[0m")
            fail_ms += elapsed_ms

    if not no_summary:
        if failed:
            print(f"{green(f'✓ pass: {pass_count}/{total}')} \033[2m{pass_ms}ms\033[0m")
            print(f"{red(f'✖ fail: {failed}/{total}')} \033[2m{fail_ms}ms\033[0m")
            sys.exit(1)
        print(f"{green(f'✔ pass: {total}/{total}')} \033[2m{total_ms}ms\033[0m")
    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    main()

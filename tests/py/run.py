#!/usr/bin/env python3
"""Smoke runner for the Python PDL lib.

Iterates shared fixtures (JSON + MD) and calls the Python render function.
Currently the render function is a placeholder; this runner will surface that.
"""

import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "packages" / "py"))

from pdl import render  # type: ignore  # noqa: E402


FIXTURES_DIR = REPO_ROOT / "tests" / "fixtures"


def load_fixtures():
    for json_path in FIXTURES_DIR.glob("*.json"):
        base = json_path.stem
        md_path = FIXTURES_DIR / f"{base}.md"
        if not md_path.exists():
            raise FileNotFoundError(f"Missing template for fixture {base}: {md_path}")
        with json_path.open("r", encoding="utf-8") as f_json:
            data = json.load(f_json)
        with md_path.open("r", encoding="utf-8") as f_md:
            template = f_md.read()
        yield base, data, template


def main():
    for name, data, template in load_fixtures():
        print(f"\n=== {name} ===")
        try:
            result = render(template, data)
            markdown = result[0] if isinstance(result, (list, tuple)) else result
            print(markdown if markdown is not None else "<no output>")
        except Exception as exc:  # pylint: disable=broad-except
            print(f"Error: {exc}")


if __name__ == "__main__":
    main()

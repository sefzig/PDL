#!/usr/bin/env python3
"""Fixture-driven tests for the Python PDL port."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from pdl import render

ROOT = Path(__file__).resolve().parents[1]
FIXTURE_DIR = ROOT / "fixtures"


def load_fixtures():
    cases = []
    for tpl_path in sorted(FIXTURE_DIR.glob("*.template.md")):
        base = tpl_path.stem.replace(".template", "")
        data_path = FIXTURE_DIR / f"{base}.data.json"
        result_path = FIXTURE_DIR / f"{base}.result.md"
        variables_path = FIXTURE_DIR / f"{base}.variables.json"

        if not data_path.exists() or not result_path.exists():
            continue

        with tpl_path.open("r", encoding="utf-8") as f_tpl:
            template = f_tpl.read()
        with data_path.open("r", encoding="utf-8") as f_data:
            data = json.load(f_data)
        with result_path.open("r", encoding="utf-8") as f_res:
            expected = f_res.read()

        variables = {}
        if variables_path.exists():
            with variables_path.open("r", encoding="utf-8") as f_vars:
                variables = json.load(f_vars)

        cases.append((base, template, data, variables, expected))
    return cases


@pytest.mark.parametrize("base,template,data,variables,expected", load_fixtures())
def test_fixtures_match_js(base, template, data, variables, expected):
    result = render(template, data, {"variables": variables})
    assert result["markdown"] == expected, f"Fixture {base} mismatch"


def test_condense_unmatched_tokens_are_removed():
    template = "[condense]A\nB[condense-end] [condense]X[condense-end]"
    out = render(template, {}, {})["markdown"]
    assert out == "A B X"


def test_time_invalid_unit_increments_parse_error():
    res = render("[value:x time=\"%H\" unit=fortnight]", {"x": 5}, {})
    assert res["rawStats"].errors_parse == 1
    assert res["markdown"] == "[invalid time]"

"""Python port of PDL (Prompt Data Language).

This file mirrors `packages/js/src/pdl.js` with behavior parity and minimal
Python-specific changes. Public surface and defaults intentionally match the JS
version for cross-language fixtures and docs.
"""

from __future__ import annotations

import json
import math
import re
import unicodedata
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from zoneinfo import ZoneInfo


# ================================================================
# 1) Constants & Config
# ================================================================


class PDL:
    VALUE_PREFIX = "[value:"
    GET_PREFIX = "[get:"
    SET_PREFIX = "[set:"
    LOOP_IDX = "[loop-index]"

    IF_START = "[if:"
    ELIF = "[if-elif:"
    ELSE = "[if-else]"
    IF_END = "[if-end]"

    LOOP_START = "[loop:"
    LOOP_END = "[loop-end]"

    CONDENSE_START = "[condense]"
    CONDENSE_END = "[condense-end]"

    OPS2 = {"<=", ">=", "!=", "^=", "$=", "*="}
    OPS1 = {"<", ">", "="}
    NUMERIC_OPS = {"<", "<=", ">", ">="}

    MAX_DEPTH = 40
    MAX_EXPANSIONS = 30000

    DATE_TZ = "Europe/Berlin"
    INVALID_DATE_DEFAULT = "[invalid date]"
    INVALID_TIME_DEFAULT = "[invalid time]"

    HL_BEFORE = ""
    HL_AFTER = ""


VAR_NAME_RE = re.compile(r"^[A-Za-z0-9_]+$")


# ================================================================
# 2) Utilities
# ================================================================


def compact_json(value: Any) -> str:
    try:
        return json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    except Exception:
        return str(value)


def normalize_str(v: Any) -> Any:
    if not isinstance(v, str):
        return v
    try:
        return unicodedata.normalize("NFC", v).strip()
    except Exception:
        return v.strip()


def to_bool(s: Any) -> Optional[bool]:
    if s is None:
        return None
    t = str(s).strip().lower()
    if t in {"true", "yes", "on", "1"}:
        return True
    if t in {"false", "no", "off", "0"}:
        return False
    return None


def markdown_escape(s: Any) -> Any:
    if not isinstance(s, str):
        return s
    out = s.replace("\\", "\\\\")
    for ch in ("*", "_", "`", "~", "[", "]", "(", ")", "#", "+", "-", "!", ">", "|"):
        out = out.replace(ch, "\\" + ch)
    return out


NUMERIC_RE = re.compile(r"^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?$")


def coerce_number(x: Any) -> Optional[float]:
    if isinstance(x, (int, float)) and not (isinstance(x, float) and (math.isnan(x) or math.isinf(x))):
        return x
    if not isinstance(x, str):
        return None
    s = x.strip()
    if not NUMERIC_RE.match(s):
        return None
    n = float(s)
    if not math.isfinite(n):
        return None
    if n.is_integer():
        return int(n)
    return n


def bump_exp(stats: "RenderStats", n: int = 1) -> bool:
    stats.expansions += n
    if stats.expansions > PDL.MAX_EXPANSIONS:
        stats.errors_parse += 1
        stats.halted = True
        return False
    return True


def plural(n: int, singular: str) -> str:
    return singular if n == 1 else f"{singular}s"


def pad(num: int, length: int = 2) -> str:
    s = str(int(abs(num)))
    return s.zfill(length)


def render_tokens(fmt: str, comp: Dict[str, int], mode: str) -> str:
    out = ""
    s = str(fmt or "")
    i = 0
    while i < len(s):
        ch = s[i]
        if ch != "%":
            out += ch
            i += 1
            continue
        if i + 1 >= len(s):
            out += "%"
            i += 1
            continue
        t = s[i + 1]
        if t == "%":
            out += "%"
            i += 2
            continue
        mapper = {
            "Y": lambda: pad(comp.get("Y", 0), 4),
            "y": lambda: pad(comp.get("Y", 0) % 100, 2),
            "m": lambda: pad(comp.get("m", 0), 2),
            "d": lambda: pad(comp.get("d", 0), 2),
            "H": lambda: pad(comp.get("H", 0), 2),
            "M": lambda: pad(comp.get("M", 0), 2),
            "S": lambda: pad(comp.get("S", 0), 2),
            "L": lambda: pad(comp.get("L", 0), 3),
        }
        out += mapper.get(t, lambda: "%" + t)()
        i += 2
    return out


def tz_offset_ms(utc_ms: float, tz: str) -> int:
    dt_utc = datetime.fromtimestamp(utc_ms / 1000.0, tz=timezone.utc)
    tz_dt = dt_utc.astimezone(ZoneInfo(tz))
    offset = tz_dt.utcoffset() or timezone.utc.utcoffset(dt_utc)
    return int(offset.total_seconds() * 1000) if offset else 0


def parse_date_input(raw: Any) -> Tuple[Optional[int], bool]:
    if raw is None:
        return None, False
    if isinstance(raw, datetime):
        try:
            ms = int(raw.timestamp() * 1000)
            return ms, False
        except Exception:
            return None, True

    num = coerce_number(raw)
    if num is not None:
        ms = num * 1000 if num < 1e12 else num
        return int(ms), False

    s = str(raw).strip()
    if not s:
        return None, True

    has_tz = bool(re.search(r"[zZ]|([+-]\d{2}:?\d{2})$", s))
    try:
        if has_tz:
            iso = s.replace("Z", "+00:00") if s.endswith("Z") else s
            dt = datetime.fromisoformat(iso)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return int(dt.timestamp() * 1000), False
        else:
            # treat naive as local time in DATE_TZ
            iso = s
            dt = datetime.fromisoformat(iso)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=ZoneInfo(PDL.DATE_TZ))
            ms = int(dt.timestamp() * 1000)
            return ms, False
    except Exception:
        pass

    # fallback mimic JS behavior: attempt parsing as UTC string then adjust tz offset
    try:
        base_utc = datetime.fromisoformat((s + "Z") if not s.endswith("Z") else s.replace("Z", "+00:00"))
        if base_utc.tzinfo is None:
            base_utc = base_utc.replace(tzinfo=timezone.utc)
        ms = int(base_utc.timestamp() * 1000)
        offset = tz_offset_ms(ms, PDL.DATE_TZ)
        return ms - offset, False
    except Exception:
        return None, True


def components_from_date_ms(ms: int, tz: str) -> Dict[str, int]:
    dt = datetime.fromtimestamp(ms / 1000.0, tz=ZoneInfo(tz))
    return {
        "Y": dt.year,
        "y": dt.year % 100,
        "m": dt.month,
        "d": dt.day,
        "H": dt.hour,
        "M": dt.minute,
        "S": dt.second,
        "L": int(ms % 1000),
    }


def break_down_duration(ms: Any) -> Dict[str, int]:
    out = {"Y": 0, "y": 0, "m": 0, "d": 0, "H": 0, "M": 0, "S": 0, "L": 0}
    try:
        total = math.trunc(ms)
    except Exception:
        return out
    if not math.isfinite(total) or total < 0:
        return out

    out["L"] = total % 1000
    total //= 1000
    out["S"] = total % 60
    total //= 60
    out["M"] = total % 60
    total //= 60
    out["H"] = total % 24
    total //= 24
    out["d"] = total
    out["m"] = out["d"] // 30
    out["d"] = out["d"] % 30
    out["Y"] = out["m"] // 12
    out["m"] = out["m"] % 12
    out["y"] = out["Y"] % 100
    return out


def is_pure_token_format(fmt: str) -> bool:
    parts = [p for p in str(fmt or "").strip().split() if p]
    if not parts:
        return False
    return all(re.fullmatch(r"%[YymdHMSL]", p) for p in parts)


def apply_case_basic(s: str, upper: bool = False, lower: bool = False, title: bool = False) -> str:
    if title:
        try:
            return re.sub(r"\w\S*", lambda m: m.group(0)[0].upper() + m.group(0)[1:].lower(), s)
        except Exception:
            return s
    if upper:
        return s.upper()
    if lower:
        return s.lower()
    return s


def to_words(s: str) -> List[str]:
    x = str(s or "")
    x = re.sub(r"[^\w]+", " ", x)
    x = re.sub(r"([a-z0-9])([A-Z])", r"\1 \2", x)
    return [w for w in x.strip().split() if w]


def camel_case(s: str, upper: bool) -> str:
    words = to_words(s)
    if not words:
        return ""
    first = words[0].lower()
    rest = [w[:1].upper() + w[1:].lower() for w in words[1:]]
    if upper:
        return "".join(w[:1].upper() + w[1:].lower() for w in words)
    return first + "".join(rest)


def snake_case(s: str, upper: bool) -> str:
    words = [w.lower() for w in to_words(s)]
    base = "_".join(words)
    return base.upper() if upper else base


def apply_truncate(s: str, limit: int, suffix: Optional[str]) -> str:
    if not isinstance(limit, int) or limit <= 0:
        return s
    if suffix is not None and suffix != "":
        return s[:limit] + str(suffix) if len(s) > limit else s
    return s[:limit] if len(s) > limit else s


def split_args(raw: str) -> List[str]:
    s = str(raw or "").strip()
    if not s:
        return []
    out: List[str] = []
    cur = ""
    in_single = False
    in_double = False
    esc = False
    for ch in s:
        if esc:
            cur += ch
            esc = False
            continue
        if ch == "\\" and (in_single or in_double):
            esc = True
            cur += ch
            continue
        if ch == "'" and not in_double:
            in_single = not in_single
            cur += ch
            continue
        if ch == '"' and not in_single:
            in_double = not in_double
            cur += ch
            continue
        if not in_single and not in_double and ch.isspace():
            if cur.strip():
                out.append(cur.strip())
            cur = ""
            continue
        cur += ch
    if cur.strip():
        out.append(cur.strip())
    return out


def strip_outer_quotes(v: Any) -> str:
    s = str(v or "")
    if len(s) >= 2 and ((s.startswith('"') and s.endswith('"')) or (s.startswith("'") and s.endswith("'"))):
        return s[1:-1].replace('\\"', '"').replace("\\'", "'")
    return s


def parse_kv_flags(raw: str, *, first_positional: Optional[str] = None, types: Optional[Dict[str, Any]] = None, defaults: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    s = str(raw or "").strip()
    data: Dict[str, Any] = {}
    if defaults:
        data.update(defaults)
    if not s:
        return data

    try:
        parts = split_args(s)
    except Exception:
        parts = s.split()

    if first_positional and parts:
        data[first_positional] = parts[0]
        parts = parts[1:]

    for token in parts:
        if "=" not in token:
            continue
        idx = token.find("=")
        k = token[:idx]
        v = token[idx + 1 :]

        if types and k in types:
            T = types[k]
            if T is bool:
                b = to_bool(v)
                data[k] = b if b is not None else bool(v)
            elif T is int or T is float or T is (int | float):
                try:
                    n = float(v) if T is float else int(v)
                    data[k] = n
                except Exception:
                    if defaults and k in defaults:
                        data[k] = defaults[k]
            elif T is str:
                data[k] = strip_outer_quotes(v)
            else:
                data[k] = strip_outer_quotes(v)
        else:
            low = str(v).lower()
            if low in {"true", "false"}:
                data[k] = low == "true"
            else:
                data[k] = v
    return data


def format_index(indices: List[int], dots: bool) -> str:
    if not indices:
        return "0"
    return ".".join(str(i) for i in indices) if dots else str(indices[-1])


def exists_for_success(value: Any) -> bool:
    if value is None:
        return False
    if isinstance(value, str) and value == "":
        return False
    return True


def apply_replace(s: str, spec: str) -> str:
    if not spec:
        return s
    if spec.startswith("s/"):
        m = re.match(r"^s/((?:\\.|[^/])*)/((?:\\.|[^/])*)/([gimsGIMS]*)$", spec)
        if not m:
            return s
        pat_raw = m.group(1).replace("\\/", "/")
        repl_raw = m.group(2).replace("\\/", "/")
        flags_raw = m.group(3) or ""
        flag_set = set()
        for ch in flags_raw.lower():
            if ch in {"i", "m", "s", "g"}:
                flag_set.add(ch)
        flags = 0
        if "i" in flag_set:
            flags |= re.IGNORECASE
        if "m" in flag_set:
            flags |= re.MULTILINE
        if "s" in flag_set:
            flags |= re.DOTALL
        try:
            pattern = re.compile(pat_raw, flags)
            if "g" in flag_set:
                return pattern.sub(repl_raw, s)
            return pattern.sub(repl_raw, s, count=1)
        except Exception:
            return s

    for part in [p for p in spec.split(";") if p != ""]:
        if ":" not in part:
            continue
        old_val, new_val = part.split(":", 1)
        if old_val in s:
            return s.replace(old_val, new_val)
    return s


def to_render_text(value: Any, stringify_flag: bool) -> Optional[str]:
    if stringify_flag:
        try:
            return json.dumps(value, ensure_ascii=False, separators=(",", ":"))
        except Exception:
            return str(value)
    if value is None:
        return None
    if isinstance(value, (list, dict)):
        return compact_json(value)
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value)


def parse_scalar_or_json(raw: str) -> Any:
    s = str(raw or "").strip()
    if s.startswith("{") or s.startswith("["):
        try:
            return json.loads(s)
        except Exception:
            return s
    if (s.startswith('"') and s.endswith('"')) or (s.startswith("'") and s.endswith("'")):
        return s[1:-1].replace('\"', '"').replace("\'", "'")
    if s == "true":
        return True
    if s == "false":
        return False
    if s == "null":
        return None
    n = coerce_number(s)
    if n is not None:
        return n
    return s


def escape_regexp(s: str) -> str:
    return re.sub(r"[.*+?^${}()|[\]\\]", r"\\\\&", str(s))

def highlight_config(before: Any, after: Any) -> dict:
    b = before
    a = after
    enabled = not ((b == "" and a == "") or (b is False and a is False))
    return {"enabled": enabled, "before": b, "after": a}


def wrap_highlight(text: str, highlight: dict, hl_flag: bool = True) -> str:
    if not highlight or not highlight.get("enabled") or hl_flag is False:
        return text
    before = "" if highlight.get("before") is None else str(highlight.get("before"))
    after = "" if highlight.get("after") is None else str(highlight.get("after"))
    return f"{before}{text}{after}"


def apply_highlight_heuristics(text: str, highlight: dict) -> str:
    if not highlight or not highlight.get("enabled"):
        return text
    before = str(highlight.get("before") or "")
    after = str(highlight.get("after") or "")
    b_esc = escape_regexp(before)
    a_esc = escape_regexp(after)
    out = str(text)

    link_re = re.compile(rf"(\\!?\\[[^\\]]*\\]\\()\\s*{b_esc}(.*?){a_esc}\\s*(\\))")
    out = link_re.sub(rf"{before}\1\2\3{after}", out)

    attr_re = re.compile(rf"([A-Za-z_:][-A-Za-z0-9_:.]*\\s*=\\s*\"?){b_esc}(.*?){a_esc}(\"?)")
    out = attr_re.sub(rf"{before}\1\2\3{after}", out)

    return out


def apply_string_variables(template: str, vars: Dict[str, Any] | None = None, highlight: Dict[str, Any] | None = None) -> str:
    s = str(template or "")
    hl = highlight or {"enabled": False}
    out = []
    depth = 0  # bracket depth for directives
    i = 0
    while i < len(s):
        ch = s[i]
        if ch == "[":
            depth += 1
        elif ch == "]" and depth > 0:
            depth -= 1

        if ch == "{":
            close = s.find("}", i + 1)
            if close != -1:
                name = s[i + 1 : close]
                if vars is not None and name in vars:
                    val = "" if vars[name] is None else str(vars[name])
                    if depth == 0 and hl.get("enabled"):
                        val = wrap_highlight(val, hl, True)
                    out.append(val)
                    i = close + 1
                    continue
        out.append(ch)
        i += 1
    return "".join(out)


# ================================================================
# 3) Stats & Scope
# ================================================================


class RenderStats:
    def __init__(self) -> None:
        self.loops = 0
        self.conds_true = 0
        self.conds_false = 0
        self.errors_parse = 0
        self.errors_inline = 0
        self.expansions = 0
        self.halted = False

    def summary(self) -> str:
        parts = [f"Expanded {self.loops} loop(s)", f"{self.conds_true + self.conds_false} condition(s)"]
        if self.expansions:
            parts.append(f"{self.expansions} expansion(s)")
        if self.errors_parse:
            parts.append(f"{self.errors_parse} parse issue(s)")
        if self.errors_inline:
            parts.append(f"{self.errors_inline} inline issue(s)")
        return "; ".join(parts)


@dataclass
class VarBinding:
    value: Any
    const: bool = True
    humble: bool = False


class Scope:
    def __init__(self, *, root: Any, aliases: Dict[str, Any] | None = None, index_chain: List[int] | None = None, dots: bool = True, var_frames: List[Dict[str, VarBinding]] | None = None, highlight: Dict[str, Any] | None = None):
        self.root = root
        self.aliases = aliases or {}
        self.index_chain = index_chain or []
        self.dots = dots
        self.var_frames: List[Dict[str, VarBinding]] = var_frames or [dict()]
        self.highlight = highlight or {}

    def get_var_binding(self, name: str) -> Tuple[Optional[VarBinding], Optional[int]]:
        if not VAR_NAME_RE.match(str(name or "")):
            return None, None
        for idx in range(len(self.var_frames) - 1, -1, -1):
            frame = self.var_frames[idx]
            if name in frame:
                return frame[name], idx
        return None, None

    def get_var_value(self, name: str) -> Any:
        vb, _ = self.get_var_binding(name)
        return vb.value if vb else None

    def set_var(self, name: str, value: Any, *, scope_local: bool = False, const_flag: Optional[bool] = None, humble_flag: Optional[bool] = None, allow_value_update_if_const_flip: bool = False) -> None:
        if not VAR_NAME_RE.match(str(name or "")):
            return

        target_idx = (len(self.var_frames) - 1) if (scope_local and self.var_frames) else 0
        target_frame = self.var_frames[target_idx]
        binding = target_frame.get(name)

        if value is None:
            if binding:
                target_frame.pop(name, None)
            return

        if not binding:
            target_frame[name] = VarBinding(
                value,
                const=True if const_flag is None else bool(const_flag),
                humble=False if humble_flag is None else bool(humble_flag),
            )
            return

        if const_flag is not None:
            binding.const = bool(const_flag)
        if humble_flag is not None:
            binding.humble = bool(humble_flag)

        if binding.const:
            if allow_value_update_if_const_flip and const_flag is False:
                binding.value = value
        else:
            binding.value = value


# ================================================================
# 4) PathResolver
# ================================================================


class PathResolver:
    def __init__(self) -> None:
        self.SEGMENT_RE = re.compile(r"(?P<name>[A-Za-z_]\w*|\"(?:\\.|[^\"])+\")(?:\[(?P<sel>[^\]]*)\])?(?:\.|$)")
        self.FIRST_SEGMENT_RE = re.compile(r"^(?P<name>[A-Za-z_]\w*|\"(?:\\.|[^\"])+\")(?:\[(?P<sel>[^\]]*)\])?(?:\.(?P<rest>.*))?$")

    def resolve_scoped(self, path: str, scope: Scope, *, default_ci: bool = False) -> Any:
        self.scope_aliases = scope.aliases or {}
        if not isinstance(path, str) or not path.strip():
            return None
        p = path.strip()

        m0 = re.match(r"^([A-Za-z_]\w*)$", p)
        if m0:
            name = m0.group(1)
            vb, _ = scope.get_var_binding(name)
            if vb:
                if vb.humble is False:
                    return vb.value
                if name in scope.aliases:
                    return scope.aliases[name]
                rv = self._eval(p, scope.root, default_ci=default_ci)
                return rv if rv is not None else vb.value
            if name in scope.aliases:
                return scope.aliases[name]
            return self._eval(p, scope.root, default_ci=default_ci)

        mdot = re.match(r'^("?[A-Za-z_]\w*"?)\.(.+)$', p)
        if mdot:
            base = mdot.group(1)
            rest = mdot.group(2)
            base_key = base.replace('"', "")
            vb, _ = scope.get_var_binding(base_key)
            if vb:
                if vb.humble is False:
                    return self._eval(rest, vb.value, default_ci=default_ci)
                if base_key in scope.aliases:
                    return self._eval(rest, scope.aliases[base_key], default_ci=default_ci)
                if isinstance(scope.root, dict) and base_key in scope.root:
                    return self._eval(rest, scope.root[base_key], default_ci=default_ci)
                return self._eval(rest, vb.value, default_ci=default_ci)
            if base_key in scope.aliases:
                return self._eval(rest, scope.aliases[base_key], default_ci=default_ci)
            if isinstance(scope.root, dict) and base_key in scope.root:
                return self._eval(rest, scope.root[base_key], default_ci=default_ci)
            return None

        mfirst = self.FIRST_SEGMENT_RE.match(p)
        if mfirst and mfirst.groupdict():
            name_raw = mfirst.group("name")
            sel = mfirst.group("sel")
            rest = mfirst.group("rest")
            base_name = name_raw.replace('"', "")

            base_obj = self._resolve_base_identifier(base_name, scope, default_ci=default_ci)
            if base_obj is not None:
                cur = base_obj
                if sel is not None:
                    cur = self._apply_bracket_or_selector(cur, sel, default_ci=default_ci)
                    if cur is None:
                        return None
                if rest:
                    return self._eval(rest, cur, default_ci=default_ci)
                return cur

        return self._eval(p, scope.root, default_ci=default_ci)

    def resolve_for_loop(self, path: str, scope: Scope, *, default_ci: bool = False) -> List[Any]:
        self.scope_aliases = scope.aliases or {}
        if not isinstance(path, str) or not path.strip():
            return []
        p = path.strip()

        m0 = re.match(r"^([A-Za-z_]\w*)$", p)
        if m0:
            name = m0.group(1)
            base_obj = self._resolve_base_identifier(name, scope, default_ci=default_ci)
            if base_obj is not None:
                v = base_obj
                if isinstance(v, list):
                    return v
                return [] if v is None else [v]
            v = self._eval(p, scope.root, default_ci=default_ci)
            if isinstance(v, list):
                return v
            return [] if v is None else [v]

        mfirst = self.FIRST_SEGMENT_RE.match(p)
        if mfirst and mfirst.groupdict():
            name_raw = mfirst.group("name")
            sel = mfirst.group("sel")
            rest = mfirst.group("rest")
            base_name = name_raw.replace('"', "")
            base_obj = self._resolve_base_identifier(base_name, scope, default_ci=default_ci)
            if base_obj is not None:
                cur = base_obj
                if sel is not None:
                    cur = self._apply_bracket_or_selector(cur, sel, default_ci=default_ci)
                    if cur is None:
                        return []
                v = self._eval_all(rest, cur, default_ci=default_ci) if rest else cur
                if isinstance(v, list):
                    return v
                return [] if v is None else [v]

        v = self._eval_all(p, scope.root, default_ci=default_ci)
        if isinstance(v, list):
            return v
        return [] if v is None else [v]

    # --- helpers ---
    def _resolve_base_identifier(self, name: str, scope: Scope, *, default_ci: bool = False) -> Any:
        vb, _ = scope.get_var_binding(name)
        if vb:
            if vb.humble is False:
                return vb.value
            if name in scope.aliases:
                return scope.aliases[name]
            rv = self._eval(name, scope.root, default_ci=default_ci)
            return rv if rv is not None else vb.value
        if name in scope.aliases:
            return scope.aliases[name]
        return None

    def _parse_bracket_key(self, sel: str) -> Optional[str]:
        s = str(sel or "").strip()
        if len(s) >= 2 and ((s[0] == '"' and s[-1] == '"') or (s[0] == "'" and s[-1] == "'")):
            body = s[1:-1].replace('\"', '"').replace("\'", "'")
            return body
        return None

    def _apply_bracket_or_selector(self, cur: Any, sel: str, *, default_ci: bool = False) -> Any:
        if isinstance(cur, dict):
            quoted = self._parse_bracket_key(sel)
            key = quoted if quoted is not None else str(sel).strip()
            if key in cur:
                return cur[key]
            if default_ci:
                for k in cur.keys():
                    if k.lower() == key.lower():
                        return cur[k]
            return None
        if isinstance(cur, list):
            return self._apply_selector_first(cur, sel, default_ci=default_ci)
        return None

    def _eval(self, path: str, root: Any, *, default_ci: bool = False) -> Any:
        cur = root

        if isinstance(cur, list) and len(cur) == 1 and isinstance(cur[0], dict):
            cur = cur[0]

        first = True
        for m in self.SEGMENT_RE.finditer(path.strip()):
            name_raw = m.group("name")
            sel = m.group("sel")
            name = name_raw.replace('"', "")

            if isinstance(cur, list) and len(cur) == 1 and isinstance(cur[0], dict):
                cur = cur[0]

            if first and name in (self.scope_aliases or {}):
                cur = self.scope_aliases[name]
            elif isinstance(cur, dict) and name in cur:
                cur = cur[name]
            else:
                return None
            first = False

            if sel is not None:
                applied = self._apply_bracket_or_selector(cur, sel, default_ci=default_ci)
                if applied is None:
                    return None
                cur = applied
        return cur

    def _eval_all(self, path: str, root: Any, *, default_ci: bool = False) -> Any:
        cur = root

        if isinstance(cur, list) and len(cur) == 1 and isinstance(cur[0], dict):
            cur = cur[0]

        first = True
        for m in self.SEGMENT_RE.finditer(path.strip()):
            name_raw = m.group("name")
            sel = m.group("sel")
            name = name_raw.replace('"', "")

            if isinstance(cur, list) and len(cur) == 1 and isinstance(cur[0], dict):
                cur = cur[0]

            if first and name in (self.scope_aliases or {}):
                cur = self.scope_aliases[name]
            elif isinstance(cur, dict) and name in cur:
                cur = cur[name]
            else:
                return []
            first = False

            if sel is not None:
                if isinstance(cur, dict):
                    quoted = self._parse_bracket_key(sel)
                    key = quoted if quoted is not None else str(sel).strip()
                    if key in cur:
                        cur = cur[key]
                    else:
                        return []
                elif isinstance(cur, list):
                    cur = self._apply_selector_all(cur, sel, default_ci=default_ci)
                else:
                    return []
        return cur if isinstance(cur, list) else [cur]

    def _split_top_level(self, expr: str, sep: str) -> List[str]:
        out: List[str] = []
        cur = ""
        in_str = False
        esc = False
        depth = 0
        for ch in str(expr or ""):
            if esc:
                cur += ch
                esc = False
                continue
            if ch == "\\" and in_str:
                esc = True
                cur += ch
                continue
            if ch == '"':
                in_str = not in_str
                cur += ch
                continue
            if not in_str:
                if ch == "[":
                    depth += 1
                    cur += ch
                    continue
                if ch == "]" and depth > 0:
                    depth -= 1
                    cur += ch
                    continue
            if not in_str and depth == 0 and ch == sep:
                part = cur.strip()
                if part:
                    out.append(part)
                cur = ""
                continue
            cur += ch
        last = cur.strip()
        if last:
            out.append(last)
        return out

    def _find_top_level_op(self, s: str) -> Tuple[Optional[str], int]:
        in_str = False
        esc = False
        depth = 0
        for i, ch in enumerate(s):
            if esc:
                esc = False
                continue
            if ch == "\\" and in_str:
                esc = True
                continue
            if ch == '"':
                in_str = not in_str
                continue
            if not in_str:
                if ch == "[":
                    depth += 1
                    continue
                if ch == "]" and depth > 0:
                    depth -= 1
                    continue
                if depth == 0:
                    if i + 1 < len(s):
                        op2 = s[i : i + 2]
                        if op2 in PDL.OPS2:
                            return op2, i
                    if ch in PDL.OPS1:
                        return ch, i
        return None, -1

    def _parse_value_token(self, tok: str) -> Any:
        t = str(tok or "").strip()
        if (t.startswith('"') and t.endswith('"')) or (t.startswith("'") and t.endswith("'")):
            return t[1:-1].replace('\"', '"').replace("\'", "'")
        n = coerce_number(t)
        if n is not None:
            return n
        lower = t.lower()
        if lower == "true":
            return True
        if lower == "false":
            return False
        if t == "null":
            return None
        return t

    def _extract_ci(self, s: str) -> Tuple[str, bool]:
        m = re.search(r"\sci=(true|false)\s*$", str(s or ""), re.IGNORECASE)
        if m:
            ci = m.group(1).lower() == "true"
            return str(s)[: m.start()].rstrip(), ci
        return str(s or ""), False

    def _parse_predicate(self, expr: str) -> List[List[Tuple[str, str, Any]]]:
        core, _ = self._extract_ci(expr)
        or_parts = self._split_top_level(core, "|")
        result: List[List[Tuple[str, str, Any]]] = []
        for part in or_parts:
            ands = self._split_top_level(part, "&")
            conds: List[Tuple[str, str, Any]] = []
            for c in ands:
                op, pos = self._find_top_level_op(c)
                if not op:
                    continue
                key = c[:pos].strip()
                val = self._parse_value_token(c[pos + len(op) :].strip())
                conds.append((key, op, val))
            if conds:
                result.append(conds)
        return result

    def _resolve_predicate_key(self, key: str, scope: Scope, *, default_ci: bool = False) -> Any:
        k = str(key or "").strip()
        m = re.match(r"^\[get:([A-Za-z0-9_]+)(?:[^\]]*)\]$", k)
        if m:
            return scope.get_var_value(m.group(1))
        return self.resolve_scoped(k, scope, default_ci=default_ci)

    def eval_condition(self, cond_expr: str, scope: Scope, *, default_ci: bool = False) -> bool:
        chopped, ci_in = self._extract_ci(cond_expr)
        ci = ci_in or default_ci
        clauses = self._parse_predicate(chopped)
        if not clauses:
            val = self.resolve_scoped(chopped, scope, default_ci=ci)
            return exists_for_success(val)
        for ands in clauses:
            ok_all = True
            for k, op, v in ands:
                left = self._resolve_predicate_key(k, scope, default_ci=ci)
                if not self._cmp(left, op, v, case_insensitive=ci):
                    ok_all = False
                    break
            if ok_all:
                return True
        return False

    def _cmp(self, left: Any, op: str, right: Any, *, case_insensitive: bool = False) -> bool:
        Lnum = coerce_number(left)
        Rnum = coerce_number(right)
        if Lnum is not None and Rnum is not None and (op in PDL.NUMERIC_OPS or op in {"=", "!="}):
            try:
                if op == "=":
                    return Lnum == Rnum
                if op == "!=":
                    return Lnum != Rnum
                if op == "<":
                    return Lnum < Rnum
                if op == "<=":
                    return Lnum <= Rnum
                if op == ">":
                    return Lnum > Rnum
                if op == ">=":
                    return Lnum >= Rnum
            except Exception:
                return False

        L = normalize_str(left)
        R = normalize_str(right)
        if isinstance(L, str) and isinstance(R, str):
            if case_insensitive:
                L = L.lower()
                R = R.lower()
            try:
                if op == "=":
                    return L == R
                if op == "!=":
                    return L != R
                if op == "^=":
                    return L.startswith(R)
                if op == "$=":
                    return L.endswith(R)
                if op == "*=":
                    return R in L
            except Exception:
                return False

        try:
            if op == "=":
                return L == R
            if op == "!=":
                return L != R
        except Exception:
            return False
        return False

    def _get_nested(self, obj: Any, key_path: str) -> Any:
        if key_path == "":
            return obj
        cur = obj
        for part in str(key_path).split('.'):
            if isinstance(cur, dict) and part in cur:
                cur = cur[part]
            else:
                return None
        return cur

    def _apply_selector_first(self, arr: List[Any], selector: str, *, default_ci: bool = False) -> Any:
        s = str(selector or "").strip()
        if s == "":
            return arr[0] if arr else None
        if re.fullmatch(r"\d+", s):
            idx = int(s)
            return arr[idx] if 0 <= idx < len(arr) else None
        core, ci_sel = self._extract_ci(s)
        ci = default_ci or ci_sel
        clauses = self._parse_predicate(core)
        for item in arr:
            ok = any(
                all(self._cmp(self._get_nested(item, k), op, v, case_insensitive=ci) for k, op, v in ands)
                for ands in clauses
            )
            if ok:
                return item
        return None

    def _apply_selector_all(self, arr: List[Any], selector: str, *, default_ci: bool = False) -> List[Any]:
        s = str(selector or "").strip()
        if s == "":
            return list(arr)
        if re.fullmatch(r"\d+", s):
            idx = int(s)
            return [arr[idx]] if 0 <= idx < len(arr) else []
        core, ci_sel = self._extract_ci(s)
        ci = default_ci or ci_sel
        clauses = self._parse_predicate(core)
        out: List[Any] = []
        for item in arr:
            ok = any(
                all(self._cmp(self._get_nested(item, k), op, v, case_insensitive=ci) for k, op, v in ands)
                for ands in clauses
            )
            if ok:
                out.append(item)
        return out


# ================================================================
# 5) Common helpers (comments + nested expr expansion)
# ================================================================


class CommentHandler:
    @staticmethod
    def strip(text: str) -> str:
        fence_re = re.compile(r"^(```|~~~)")
        lines = str(text or "").split("\n")
        out: List[str] = []
        in_code = False
        for line in lines:
            if fence_re.match(line):
                in_code = not in_code
                out.append(line)
                continue
            if in_code:
                out.append(line)
                continue
            stripped = line.lstrip()
            if stripped.startswith("//"):
                continue
            m = re.search(r"[ \t]//", line)
            if m:
                cut = m.start()
                line = line[:cut].rstrip()
            out.append(line)
        return "\n".join(out)


def resolve_nested_in_expr(expr: str, scope: Scope, resolver: PathResolver) -> str:
    if not expr:
        return expr
    s = str(expr)
    if PDL.LOOP_IDX in s:
        s = s.replace(PDL.LOOP_IDX, format_index(scope.index_chain, scope.dots))

    def expand_token(segment: str, prefix: str, getter):
        while prefix in segment:
            out = ""
            pos = 0
            changed = False
            while pos < len(segment):
                k = segment.find(prefix, pos)
                if k == -1:
                    out += segment[pos:]
                    break
                out += segment[pos:k]
                depth = 0
                p = k
                found = False
                while p < len(segment):
                    ch = segment[p]
                    if ch == "[":
                        depth += 1
                    elif ch == "]":
                        depth -= 1
                        if depth == 0:
                            inner = segment[k + len(prefix) : p].strip()
                            inner_resolved = resolve_nested_in_expr(inner, scope, resolver)
                            val = getter(inner_resolved)
                            out += val
                            pos = p + 1
                            changed = True
                            found = True
                            break
                    p += 1
                if not found:
                    out += segment[k:]
                    pos = len(segment)
            if not changed or out == segment:
                segment = out
                break
            segment = out
        return segment

    def val_getter(inner: str) -> str:
        val = resolver.resolve_scoped(inner, scope, default_ci=False)
        if val is None:
            return f"{PDL.VALUE_PREFIX}{inner}]"
        if isinstance(val, (list, dict)):
            return compact_json(val)
        if isinstance(val, bool):
            return "true" if val else "false"
        return str(val)

    def get_getter(inner_raw: str) -> str:
        first_sp = re.search(r"\s", inner_raw)
        name = inner_raw if not first_sp else inner_raw[: first_sp.start()].strip()
        val = scope.get_var_value(name) if VAR_NAME_RE.match(name) else None
        if val is None:
            return "null"
        if isinstance(val, (list, dict)):
            return compact_json(val)
        if isinstance(val, bool):
            return "true" if val else "false"
        return str(val)

    s = expand_token(s, PDL.VALUE_PREFIX, val_getter)
    s = expand_token(s, PDL.GET_PREFIX, get_getter)
    return s


# ================================================================
# 6) Directive layer (inline if/loop + set/get + value expansion)
# ================================================================


class InlineIfHelper:
    @staticmethod
    def find_closing_bracket(s: str, start_pos: int, end_limit: int) -> int:
        in_str = False
        esc = False
        depth = 0
        for i in range(start_pos, end_limit):
            ch = s[i]
            if esc:
                esc = False
                continue
            if ch == "\\" and in_str:
                esc = True
                continue
            if ch == '"':
                in_str = not in_str
                continue
            if not in_str:
                if ch == "[":
                    depth += 1
                    continue
                if ch == "]":
                    if depth == 0:
                        return i
                    depth -= 1
        return -1

    @staticmethod
    def apply(line: str, scope: Scope, resolver: PathResolver, stats: RenderStats) -> Tuple[str, bool]:
        if PDL.IF_START not in str(line):
            return line, False

        def eval_chain(raw_cond: str) -> bool:
            cleaned = resolve_nested_in_expr(raw_cond, scope, resolver)
            m = re.search(r"\sci=(true|false)\s*$", cleaned, re.IGNORECASE)
            default_ci = bool(m and m.group(1).lower() == "true")
            cond_core = cleaned[: m.start()].rstrip() if m else cleaned
            return resolver.eval_condition(cond_core, scope, default_ci=default_ci)

        s = str(line)
        changed_any = False

        while True:
            start = s.find(PDL.IF_START)
            if start == -1:
                break
            end = s.find(PDL.IF_END, start)
            if end == -1:
                stats.errors_inline += 1
                break

            cond_start = start + len(PDL.IF_START)
            cond_close = InlineIfHelper.find_closing_bracket(s, cond_start, end)
            if cond_close == -1:
                stats.errors_inline += 1
                break

            cond_if = s[cond_start:cond_close].strip()
            cursor = cond_close + 1

            parts: List[Tuple[Optional[str], str]] = []

            def read_until_next_tag(cpos: int) -> Tuple[str, int]:
                next_elif = s.find(PDL.ELIF, cpos)
                next_else = s.find(PDL.ELSE, cpos)
                candidates = [x for x in (next_elif, next_else, end) if x != -1 and x <= end]
                stop = min(candidates) if candidates else end
                return s[cpos:stop], stop

            text_if, cursor = read_until_next_tag(cursor)
            parts.append((cond_if, text_if))

            while cursor < end:
                if s.startswith(PDL.ELIF, cursor):
                    cursor += len(PDL.ELIF)
                    rb = InlineIfHelper.find_closing_bracket(s, cursor, end)
                    if rb == -1:
                        stats.errors_inline += 1
                        break
                    cnd = s[cursor:rb].strip()
                    cursor = rb + 1
                    txt, cursor = read_until_next_tag(cursor)
                    parts.append((cnd, txt))
                    continue
                if s.startswith(PDL.ELSE, cursor):
                    cursor += len(PDL.ELSE)
                    txt, cursor = read_until_next_tag(cursor)
                    parts.append((None, txt))
                    break
                break

            chosen = ""
            triggered = False
            for cond, text in parts:
                if cond is None:
                    if not triggered:
                        chosen = text
                    break
                if eval_chain(cond):
                    stats.conds_true += 1
                    chosen = text
                    triggered = True
                    break
                else:
                    stats.conds_false += 1

            s = s[:start] + chosen + s[end + len(PDL.IF_END) :]
            changed_any = True

        drop_line = changed_any and s.strip() == ""
        return s, drop_line


class InlineLoopExpander:
    @staticmethod
    def find_header_end(s: str) -> int:
        in_str = False
        esc = False
        depth = 0
        for i, ch in enumerate(s):
            if esc:
                esc = False
                continue
            if ch == "\\" and in_str:
                esc = True
                continue
            if ch == '"':
                in_str = not in_str
                continue
            if not in_str:
                if ch == "[":
                    depth += 1
                    continue
                if ch == "]":
                    if depth == 0:
                        return i
                    depth -= 1
        return -1

    @staticmethod
    def apply(line: str, scope: Scope, resolver: PathResolver, stats: RenderStats) -> str:
        original = str(line)
        s = original
        while True:
            a = s.find(PDL.LOOP_START)
            if a == -1:
                break
            b = s.find(PDL.LOOP_END, a)
            if b == -1:
                break

            head_and_rest = s[a + len(PDL.LOOP_START) : b]
            rb = InlineLoopExpander.find_header_end(head_and_rest)
            if rb == -1:
                break

            head = head_and_rest[:rb].strip()
            body = head_and_rest[rb + 1 :]

            params = parse_kv_flags(
                head,
                first_positional="path",
                types={"as": str, "start": int, "join": str, "empty": str, "dots": bool, "ci": bool},
                defaults={"as": None, "start": 1, "join": None, "empty": None, "dots": True, "ci": False},
            )

            arr = resolver.resolve_for_loop(str(params.get("path", "")), scope, default_ci=bool(params.get("ci")))

            rendered: List[str] = []
            hit_limit = False
            for k, item in enumerate(arr):
                if not bump_exp(stats, 1):
                    hit_limit = True
                    break
                child_scope = Scope(
                    root=scope.root,
                    aliases={**scope.aliases, **({params["as"]: item} if params.get("as") else {})},
                    index_chain=[*scope.index_chain, int(params.get("start", 1)) + k],
                    dots=bool(params.get("dots", True)),
                    var_frames=[*scope.var_frames, {}],
                    highlight=scope.highlight,
                )

                seg, drop = InlineIfHelper.apply(body, child_scope, resolver, stats)
                if not drop:
                    seg = InlineLoopExpander.apply(seg, child_scope, resolver, stats)
                    seg = expand_values_and_get_inline(seg, child_scope, resolver, stats)
                    seg_clean = seg.strip()
                    if seg_clean:
                        rendered.append(seg_clean)

            if not rendered:
                repl = "" if params.get("empty") is None else str(params.get("empty"))
            else:
                repl = (
                    "".join(rendered)
                    if params.get("join") is None
                    else str(params.get("join")).join(rendered)
                )

            s = s[:a] + repl + s[b + len(PDL.LOOP_END) :]
            if hit_limit:
                return s
        return s


class InlineSetDirective:
    def apply(self, line: str, scope: Scope, resolver: PathResolver, stats: RenderStats) -> str:
        s = str(line)
        while True:
            a = s.find(PDL.SET_PREFIX)
            if a == -1:
                break

            p = a
            depth = 0
            end = -1
            while p < len(s):
                ch = s[p]
                if ch == "[":
                    depth += 1
                elif ch == "]":
                    depth -= 1
                    if depth == 0:
                        end = p
                        break
                p += 1
            if end == -1:
                break

            inner = s[a + len(PDL.SET_PREFIX) : end].strip()
            try:
                parts = split_args(inner)
            except Exception:
                parts = inner.split()
            head = parts[0].strip() if parts else ""
            flags_raw = " ".join(parts[1:]).strip()

            name = head
            raw_value = None
            if "=" in head:
                idx = head.find("=")
                name = head[:idx].strip()
                raw_value = head[idx + 1 :].strip()

            params = parse_kv_flags(flags_raw, types={"const": bool, "humble": bool, "scope": bool}, defaults=None)

            had_const = "const" in params
            had_humble = "humble" in params
            had_scope = "scope" in params

            if not VAR_NAME_RE.match(str(name or "")):
                s = s[:a] + s[end + 1 :]
                continue

            has_value = raw_value is not None
            value_obj = None
            if has_value:
                expanded = resolve_nested_in_expr(raw_value, scope, resolver)
                value_obj = parse_scalar_or_json(expanded)

            const_flag = bool(params.get("const")) if had_const else None
            humble_flag = bool(params.get("humble")) if had_humble else None
            scope_local = bool(params.get("scope")) if had_scope else False
            if scope_local and len(scope.var_frames) == 1:
                scope_local = False

            target_frame = scope.var_frames[-1] if scope_local else scope.var_frames[0]
            binding_in_target = target_frame.get(name)

            if has_value:
                allow_flip_update = bool(binding_in_target and binding_in_target.const and had_const and const_flag is False)
                scope.set_var(
                    name,
                    value_obj,
                    scope_local=scope_local,
                    const_flag=const_flag,
                    humble_flag=humble_flag,
                    allow_value_update_if_const_flip=allow_flip_update,
                )
            else:
                if binding_in_target:
                    if had_const:
                        binding_in_target.const = bool(const_flag)
                    if had_humble:
                        binding_in_target.humble = bool(humble_flag)

            s = s[:a] + s[end + 1 :]
        return s


# ================================================================
# 8) Inline value/get expansion
# ================================================================


def expand_values_and_get_inline(text: str, scope: Scope, resolver: PathResolver, stats: RenderStats) -> str:
    t = str(text or "")
    if not any(tok in t for tok in (PDL.VALUE_PREFIX, PDL.LOOP_IDX, PDL.GET_PREFIX)):
        return t

    out = ""
    i = 0
    while i < len(t):
        a_val = t.find(PDL.VALUE_PREFIX, i)
        a_idx = t.find(PDL.LOOP_IDX, i)
        a_get = t.find(PDL.GET_PREFIX, i)

        candidates: List[Tuple[str, int]] = []
        if a_val != -1:
            candidates.append(("val", a_val))
        if a_idx != -1:
            candidates.append(("idx", a_idx))
        if a_get != -1:
            candidates.append(("get", a_get))

        if not candidates:
            out += t[i:]
            break

        candidates.sort(key=lambda x: x[1])
        kind, a = candidates[0]
        out += t[i:a]

        if kind == "idx":
            if not bump_exp(stats, 1):
                out += t[a:]
                break
            out += format_index(scope.index_chain, scope.dots)
            i = a + len(PDL.LOOP_IDX)
            continue

        p = a
        depth = 0
        end = -1
        while p < len(t):
            ch = t[p]
            if ch == "[":
                depth += 1
            elif ch == "]":
                depth -= 1
                if depth == 0:
                    end = p
                    break
            p += 1
        if end == -1:
            out += t[a:]
            break

        prefix_len = len(PDL.VALUE_PREFIX) if kind == "val" else len(PDL.GET_PREFIX)
        inner_raw = t[a + prefix_len : end].strip()

        def find_split(s: str) -> int:
            depth = 0
            in_s = False
            in_d = False
            esc = False
            for idx, ch in enumerate(s):
                if esc:
                    esc = False
                    continue
                if ch == "\\" and (in_s or in_d):
                    esc = True
                    continue
                if ch == "'" and not in_d:
                    in_s = not in_s
                    continue
                if ch == '"' and not in_s:
                    in_d = not in_d
                    continue
                if not in_s and not in_d:
                    if ch == "[":
                        depth += 1
                    elif ch == "]" and depth > 0:
                        depth -= 1
                    elif depth == 0 and ch.isspace():
                        return idx
            return -1

        split_idx = find_split(inner_raw)
        head = inner_raw if split_idx == -1 else inner_raw[:split_idx].strip()
        params_raw = "" if split_idx == -1 else inner_raw[split_idx:].strip()

        params = parse_kv_flags(
            params_raw,
            types={
                "escapeMarkdown": bool,
                "trim": bool,
                "upper": bool,
                "lower": bool,
                "title": bool,
                "lowerCamel": bool,
                "upperCamel": bool,
                "lowerSnake": bool,
                "upperSnake": bool,
                "truncate": int,
                "stringify": bool,
                "ci": bool,
                "time": str,
                "date": str,
                "empty": str,
                "unit": str,
                "success": str,
                "failure": str,
                "fallback": str,
                "replace": str,
                "hl": bool,
            },
            defaults={
                "escapeMarkdown": False,
                "trim": False,
                "upper": False,
                "lower": False,
                "title": False,
                "lowerCamel": False,
                "upperCamel": False,
                "lowerSnake": False,
                "upperSnake": False,
                "truncate": 0,
                "stringify": False,
                "ci": False,
                "time": None,
                "date": None,
                "empty": None,
                "unit": "ms",
                "success": None,
                "failure": None,
                "fallback": None,
                "replace": None,
                "hl": True,
            },
        )

        if not bump_exp(stats, 1):
            out += t[a:]
            break

        if kind == "val":
            resolved_path = resolve_nested_in_expr(head, scope, resolver)
            original = None

            if original is None and isinstance(resolved_path, str):
                path_str = resolved_path.strip()
                m = re.match(r"^([A-Za-z_]\w*)\.([A-Za-z_]\w*)\[(.+)\]\.([A-Za-z_]\w*)$", path_str)
                if m:
                    base_obj = (
                        scope.aliases.get(m.group(1))
                        if m.group(1) in scope.aliases
                        else scope.root.get(m.group(1)) if isinstance(scope.root, dict) and m.group(1) in scope.root else None
                    )
                    if isinstance(base_obj, dict):
                        arr = base_obj.get(m.group(2))
                        if isinstance(arr, list):
                            sel = m.group(3).strip()
                            key = m.group(4)
                            ci = bool(params.get("ci"))
                            op_match = re.match(r"^([A-Za-z_]\w*)\s*(<|<=|>|>=|=|\^=|\$=|\*=)\s*(.+)$", sel)
                            if op_match:
                                k = op_match.group(1)
                                op = op_match.group(2)
                                rhs = op_match.group(3).strip()
                                if (rhs.startswith('"') and rhs.endswith('"')) or (rhs.startswith("'") and rhs.endswith("'")):
                                    rhs = rhs[1:-1]

                                def cmp(L, R):
                                    if ci and isinstance(L, str) and isinstance(R, str):
                                        L = L.lower()
                                        R = R.lower()
                                    if op == "=":
                                        return L == R
                                    if op == "^=":
                                        return isinstance(L, str) and L.startswith(R)
                                    if op == "$=":
                                        return isinstance(L, str) and L.endswith(R)
                                    if op == "*=":
                                        return isinstance(L, str) and R in L
                                    return False

                                for it in arr:
                                    if isinstance(it, dict) and k in it:
                                        L = normalize_str(it[k])
                                        R = normalize_str(rhs)
                                        if cmp(L, R) and key in it:
                                            original = it[key]
                                            break

            if original is None:
                original = resolver.resolve_scoped(resolved_path, scope, default_ci=bool(params.get("ci")))
                if original is None and isinstance(resolved_path, str) and "[" in resolved_path:
                    alt_arr = resolver.resolve_for_loop(resolved_path, scope, default_ci=bool(params.get("ci")))
                    if isinstance(alt_arr, list) and alt_arr:
                        original = alt_arr[0]
        else:
            name = head
            original = scope.get_var_value(name) if VAR_NAME_RE.match(str(name or "")) else None

        value_out = original
        resolved = value_out is not None

        if re.search(r"\bdefault\s*=", params_raw):
            stats.errors_parse += 1

        if not resolved and params.get("fallback"):
            def_expr = strip_outer_quotes(params.get("fallback"))
            def_path = resolve_nested_in_expr(def_expr, scope, resolver)
            def_resolved = resolver.resolve_scoped(def_path, scope, default_ci=bool(params.get("ci")))
            if def_resolved is not None:
                value_out = def_resolved
                resolved = True

        if not resolved:
            if params.get("failure"):
                value_out = params.get("failure")
            else:
                out += t[a : end + 1]
                i = end + 1
                continue
        elif isinstance(value_out, str) and value_out == "":
            value_out = params.get("empty", "") if params.get("empty") is not None else ""
        else:
            if params.get("success") is not None:
                value_out = params.get("success")

        if re.search(r"\bformat\s*=", params_raw):
            stats.errors_parse += 1

        has_date = params.get("date") not in (None, "")
        has_time = params.get("time") not in (None, "")
        if has_date and has_time:
            stats.errors_parse += 1
            value_out = PDL.INVALID_TIME_DEFAULT
        elif has_date:
            ms, bad = parse_date_input(value_out)
            if ms is None or bad:
                stats.errors_parse += 1
                value_out = PDL.INVALID_DATE_DEFAULT
            else:
                comp = components_from_date_ms(ms, PDL.DATE_TZ)
                value_out = render_tokens(str(params.get("date")), comp, "date")
        elif has_time:
            empty_time = params.get("empty")
            if empty_time in (None, ""):
                empty_time = PDL.INVALID_TIME_DEFAULT
            unit = str(params.get("unit", "ms")).strip().lower()
            num = coerce_number(value_out)
            if num is None:
                stats.errors_parse += 1
                value_out = str(empty_time)
            else:
                num_ms = float(num)
                if unit == "ms":
                    pass
                elif unit == "s":
                    num_ms *= 1000
                elif unit == "m":
                    num_ms *= 60000
                elif unit == "h":
                    num_ms *= 3600000
                elif unit == "d":
                    num_ms *= 86400000
                else:
                    stats.errors_parse += 1
                    num_ms = None
                    value_out = str(empty_time)

                if num_ms is not None:
                    comp = break_down_duration(num_ms)
                    fmt = str(params.get("time"))
                    cleaned = str(fmt or "")
                    has_letters_outside_tokens = bool(re.search(r"[A-Za-z]", re.sub(r"%[YymdHMSL]", "", cleaned)))
                    if not has_letters_outside_tokens:
                        order = ["Y", "m", "d", "H", "M", "S", "L"]
                        words = {"Y": "year", "m": "month", "d": "day", "H": "hour", "M": "minute", "S": "second", "L": "millisecond"}
                        seq = [(tok, comp[tok]) for tok in order]
                        first = next((idx for idx, (_, val) in enumerate(seq) if val != 0), -1)
                        last = next((idx for idx in range(len(seq) - 1, -1, -1) if seq[idx][1] != 0), -1)
                        if first == -1 or last == -1:
                            value_out = "0 seconds"
                        else:
                            parts = [f"{val} {plural(val, words[tok])}" for tok, val in seq[first : last + 1]]
                            value_out = " ".join(parts)
                    else:
                        value_out = render_tokens(fmt, comp, "duration")

        if isinstance(value_out, str):
            if params.get("replace"):
                value_out = apply_replace(value_out, strip_outer_quotes(params.get("replace")))
            if params.get("escapeMarkdown"):
                value_out = markdown_escape(value_out)
            if params.get("trim"):
                value_out = value_out.strip()
            value_out = apply_case_basic(value_out, upper=bool(params.get("upper")), lower=bool(params.get("lower")), title=bool(params.get("title")))
            if params.get("lowerCamel"):
                value_out = camel_case(value_out, False)
            if params.get("upperCamel"):
                value_out = camel_case(value_out, True)
            if params.get("lowerSnake"):
                value_out = snake_case(value_out, False)
            if params.get("upperSnake"):
                value_out = snake_case(value_out, True)
            trunc = params.get("truncate")
            if isinstance(trunc, int) and trunc > 0:
                value_out = apply_truncate(value_out, trunc, params.get("suffix"))

        text_out = to_render_text(value_out, bool(params.get("stringify")))
        if text_out is None:
            text_out = ""

        text_out = wrap_highlight(text_out, scope.highlight if hasattr(scope, "highlight") else getattr(resolver, "highlight", None) or {}, params.get("hl", True))

        out += text_out
        i = end + 1

    return out


# ================================================================
# 7) Engine (block directives + inline pipeline)
# ================================================================


class IfBlockDirective:
    def __init__(self) -> None:
        self._IF = re.compile(r"^\s*\[if:(.+)\]\s*$")
        self._ELIF = re.compile(r"^\s*\[if-elif:(.+)\]\s*$")
        self._ELSE = re.compile(r"^\s*\[if-else\]\s*$")
        self._END = re.compile(r"^\s*\[if-end\]\s*$")

    def match(self, line: str) -> bool:
        return bool(self._IF.match(line))

    def expand(self, engine: "Engine", lines: List[str], i: int, scope: Scope, depth: int) -> Tuple[List[str], int]:
        m_if = self._IF.match(lines[i])
        cond_root = m_if.group(1).strip() if m_if else ""

        depth_ctr = 1
        j = i + 1
        branches: List[Tuple[Optional[str], List[str]]] = []
        cur_cond = cond_root
        cur_block: List[str] = []
        seen_else = False

        while j < len(lines):
            l_raw = lines[j]
            l_norm, _ = InlineIfHelper.apply(l_raw, scope, engine.resolver, engine.stats)

            if self._IF.match(l_norm):
                depth_ctr += 1
                cur_block.append(l_raw)
            elif self._END.match(l_norm):
                depth_ctr -= 1
                if depth_ctr == 0:
                    branches.append((cur_cond, cur_block))
                    j += 1
                    break
                cur_block.append(l_raw)
            elif depth_ctr == 1 and not seen_else and self._ELIF.match(l_norm):
                m_elif = self._ELIF.match(l_norm)
                branches.append((cur_cond, cur_block))
                cur_cond = m_elif.group(1).strip() if m_elif else ""
                cur_block = []
            elif depth_ctr == 1 and not seen_else and self._ELSE.match(l_norm):
                branches.append((cur_cond, cur_block))
                cur_cond = None
                cur_block = []
                seen_else = True
            else:
                cur_block.append(l_raw)
            j += 1

        def eval_cond(expr: Optional[str]) -> bool:
            if expr is None:
                return False
            m = re.search(r"\sci=(true|false)\s*$", str(expr), re.IGNORECASE)
            ci = bool(m and m.group(1).lower() == "true")
            core = str(expr)[: m.start()].rstrip() if m else str(expr)
            core2 = resolve_nested_in_expr(core, scope, engine.resolver)
            return engine.resolver.eval_condition(core2, scope, default_ci=ci)

        chosen: List[str] = []
        triggered = False
        for cond, block in branches:
            if cond is None:
                if not triggered:
                    chosen = block
                break
            if eval_cond(cond):
                engine.stats.conds_true += 1
                chosen = block
                triggered = True
                break
            else:
                engine.stats.conds_false += 1

        emitted = engine.expand_lines(
            chosen,
            Scope(
                root=scope.root,
                aliases=scope.aliases,
                index_chain=scope.index_chain,
                dots=scope.dots,
                var_frames=[*scope.var_frames, {}],
                highlight=scope.highlight,
            ),
            depth + 1,
        )

        if not emitted and j < len(lines):
            probe, _ = InlineIfHelper.apply(lines[j], scope, engine.resolver, engine.stats)
            if probe.strip() == "":
                return emitted, j + 1

        return emitted, j


class LoopBlockDirective:
    def __init__(self) -> None:
        self._START = re.compile(r"^\s*\[loop:(.+)\]\s*$")
        self._END = re.compile(r"^\s*\[loop-end\]\s*$")

    def match(self, line: str) -> bool:
        if PDL.LOOP_END in str(line):
            return False
        return bool(self._START.match(line))

    def expand(self, engine: "Engine", lines: List[str], i: int, scope: Scope, depth: int) -> Tuple[List[str], int]:
        m = self._START.match(lines[i])
        raw = m.group(1) if m else ""

        params = parse_kv_flags(
            raw,
            first_positional="path",
            types={"as": str, "start": int, "join": str, "empty": str, "dots": bool, "ci": bool},
            defaults={"as": None, "start": 1, "join": None, "empty": None, "dots": True, "ci": False},
        )

        depth_ctr = 1
        j = i + 1
        while j < len(lines) and depth_ctr > 0:
            ln = lines[j]
            ln_norm, _ = InlineIfHelper.apply(ln, scope, engine.resolver, engine.stats)
            if self._START.match(ln_norm):
                depth_ctr += 1
            elif self._END.match(ln_norm):
                depth_ctr -= 1
            j += 1

        body = lines[i + 1 : j - 1]
        engine.stats.loops += 1

        arr = engine.resolver.resolve_for_loop(str(params.get("path", "")), scope, default_ci=bool(params.get("ci")))

        next_is_blank = False
        if j < len(lines):
            probe, _ = InlineIfHelper.apply(lines[j], scope, engine.resolver, engine.stats)
            next_is_blank = probe.strip() == ""

        if not isinstance(arr, list) or not arr:
            if params.get("empty"):
                return [str(params.get("empty"))], j
            return [], j

        iter_blocks: List[List[str]] = []
        for k, item in enumerate(arr):
            if not bump_exp(engine.stats, 1):
                break
            new_index = [*scope.index_chain, int(params.get("start", 1)) + k]
            child_scope = Scope(
                root=scope.root,
                aliases={**scope.aliases, **({params.get("as"): item} if params.get("as") else {})},
                index_chain=new_index,
                dots=bool(params.get("dots", True)),
                var_frames=[*scope.var_frames, {}],
                highlight=scope.highlight,
            )

            sub_lines = engine.expand_lines(body, child_scope, depth + 1)
            resolved = [expand_values_and_get_inline(ln, child_scope, engine.resolver, engine.stats) for ln in sub_lines]
            if any(x.strip() != "" for x in resolved):
                iter_blocks.append(resolved)
            if engine.stats.halted:
                break

        if engine.stats.halted:
            merged = Engine.coalesce_loop_blocks(iter_blocks)
            return merged, j

        if params.get("join") is not None:
            joined_blocks = ["\n".join(b) for b in iter_blocks]
            merged = str(params.get("join")).join(joined_blocks).split("\n")
        else:
            merged = Engine.coalesce_loop_blocks(iter_blocks)

        if next_is_blank:
            while merged and merged[-1].strip() == "":
                merged.pop()

        return merged, j


class Engine:
    def __init__(self, *, highlight: Dict[str, Any] | None = None) -> None:
        self.resolver = PathResolver()
        self.stats = RenderStats()
        self.highlight = highlight or {}
        self.block_registry = [LoopBlockDirective(), IfBlockDirective()]
        self.inline_registry = [InlineSetDirective(), InlineLoopExpander(), lambda line, s, r, st: expand_values_and_get_inline(line, s, r, st)]

    def _check_limits(self, depth: int) -> bool:
        if self.stats.halted:
            return True
        if depth > PDL.MAX_DEPTH:
            self.stats.errors_parse += 1
            self.stats.halted = True
            return True
        return False

    @staticmethod
    def trim_block_edges(block: List[str]) -> List[str]:
        if not block:
            return block
        lead = 0
        while lead < len(block) and block[lead].strip() == "":
            lead += 1
        kept_lead = 1 if lead > 0 else 0

        trail = 0
        for t in range(len(block) - 1, -1, -1):
            if block[t].strip() == "":
                trail += 1
            else:
                break
        kept_trail = 1 if trail > 0 else 0

        core = block[lead : len(block) - trail if trail > 0 else len(block)]
        out: List[str] = []
        if kept_lead:
            out.append("")
        out.extend(core)
        if kept_trail:
            out.append("")
        return out

    @staticmethod
    def coalesce_loop_blocks(blocks: List[List[str]]) -> List[str]:
        out: List[str] = []
        for b in blocks:
            bb = Engine.trim_block_edges(b)
            if not out:
                out.extend(bb)
                continue
            k = 0
            if out and out[-1].strip() == "":
                while k < len(bb) and bb[k].strip() == "":
                    k += 1
            out.extend(bb[k:])
        return out

    def expand_lines(self, lines: List[str], scope: Scope, depth: int = 0) -> List[str]:
        emitted: List[str] = []
        i = 0
        n = len(lines)
        previous_was_blank = False
        skip_next_blank_after_empty_block = False
        previous_block_emitted_content = False
        while i < n:
            if self._check_limits(depth):
                emitted.extend(lines[i:])
                break

            raw = lines[i]
            line, drop = InlineIfHelper.apply(raw, scope, self.resolver, self.stats)
            if drop:
                i += 1
                continue

            used_block = False
            for directive in self.block_registry:
                if directive.match(line):
                    blk, new_i = directive.expand(self, lines, i, scope, depth)
                    emitted.extend(blk)
                    i = new_i
                    used_block = True
                    blk_has_content = any(x.strip() != "" for x in blk)
                    if blk_has_content:
                        previous_was_blank = blk[-1].strip() == ""
                        skip_next_blank_after_empty_block = False
                    else:
                        skip_next_blank_after_empty_block = True
                    if self.stats.halted:
                        emitted.extend(lines[i:])
                    break
            if self.stats.halted:
                break
            if used_block:
                continue

            original_line = line
            for inline in self.inline_registry:
                line = inline.apply(line, scope, self.resolver, self.stats) if hasattr(inline, "apply") else inline(line, scope, self.resolver, self.stats)
                if self.stats.halted:
                    emitted.append(line)
                    emitted.extend(lines[i + 1 :])
                    return emitted

            only_spaces = line.strip() == ""
            only_set = (
                only_spaces
                and "[set:" in original_line
                and "[loop:" not in original_line
                and "[if:" not in original_line
            )

            if only_set:
                # Suppress whitespace-only set lines entirely (no blank-line emission)
                i += 1
                continue

            is_blank = line.strip() == ""
            if is_blank:
                if skip_next_blank_after_empty_block:
                    skip_next_blank_after_empty_block = False
                    i += 1
                    continue
                if not previous_was_blank:
                    emitted.append("")
                    previous_was_blank = True
            else:
                emitted.append(line)
                previous_was_blank = False
                skip_next_blank_after_empty_block = False

            i += 1

        return emitted


# ================================================================
# 9) Condense post-pass
# ================================================================


class CondenseProcessor:
    @staticmethod
    def _apply_rules(s: str) -> str:
        if s is None:
            return ""
        x = str(s)
        x = x.replace("\r\n", "\n").replace("\r", "\n")
        x = x.replace("\n", " ")
        x = re.sub(r" {2,}", " ", x)
        x = re.sub(r"\s+([.,!?;])", r"\1", x)
        x = re.sub(r"\(\s+", "(", x)
        x = re.sub(r"\s+\)", ")", x)
        x = x.replace("(, ", "(").replace(", )", ")")
        x = x.replace("( ", "(").replace(" )", ")")
        return x.strip()

    @staticmethod
    def apply_all(text: str) -> str:
        start_tok = PDL.CONDENSE_START
        end_tok = PDL.CONDENSE_END
        if start_tok not in str(text) and end_tok not in str(text):
            return text

        s = str(text)
        stack: List[int] = []
        i = 0
        while i < len(s):
            a = s.find(start_tok, i)
            b = s.find(end_tok, i)
            if a == -1 and b == -1:
                break
            if a != -1 and (b == -1 or a < b):
                stack.append(a)
                i = a + len(start_tok)
                continue
            if b != -1:
                if stack:
                    start_idx = stack.pop()
                    inner = s[start_idx + len(start_tok) : b]
                    replaced = CondenseProcessor._apply_rules(inner)
                    s = s[:start_idx] + replaced + s[b + len(end_tok) :]
                    i = start_idx + len(replaced)
                    continue
                else:
                    s = s[:b] + s[b + len(end_tok) :]
                    i = b
                    continue
        while stack:
            idx = stack.pop()
            s = s[:idx] + s[idx + len(start_tok) :]
        return s


# ================================================================
# 10) PostFormat
# ================================================================


class PostFormat:
    @staticmethod
    def drop_first_header_line(text: str, enabled: bool) -> str:
        if not enabled:
            return text
        lines = str(text or "").split("\n")
        if not lines:
            return text
        if re.match(r"^(#{1,6})[ \t]+.+$", lines[0]):
            lines.pop(0)
            if lines and lines[0].strip() == "":
                lines.pop(0)
        return "\n".join(lines)

    @staticmethod
    def apply_header_level_preset(text: str, preset: str) -> str:
        pad_count = max(0, len(str(preset or "#")) - 1)
        if pad_count == 0:
            return text

        out: List[str] = []
        in_code = False
        fence_re = re.compile(r"^(```|~~~)")
        heading_re = re.compile(r"^(#{1,6})([ \t]+)(.*)$")

        for line in str(text or "").split("\n"):
            if fence_re.match(line):
                in_code = not in_code
                out.append(line)
                continue
            if in_code:
                out.append(line)
                continue
            m = heading_re.match(line)
            if not m:
                out.append(line)
                continue
            hashes = m.group(1)
            rest = m.group(3)
            new_count = min(6, len(hashes) + pad_count)
            out.append("#" * new_count + " " + str(rest).strip())
        return "\n".join(out)


# ================================================================
# 11) PDLParser
# ================================================================


class PDLParser:
    def __init__(self, template: str, json_root: Any, *, aliases: Dict[str, Any] | None = None, variables: Dict[str, Any] | None = None, highlight: Dict[str, Any] | None = None) -> None:
        self.template = template
        self.json_root = json_root
        self.aliases = aliases or {}
        self.variables = variables or {}
        self.stats = RenderStats()
        self.highlight = highlight or {}

    def render(self) -> Tuple[str, RenderStats]:
        stripped = CommentHandler.strip(self.template)
        engine = Engine(highlight=self.highlight)
        scope = Scope(root=self.json_root, aliases=self.aliases, index_chain=[], dots=True, highlight=self.highlight)
        if isinstance(self.variables, dict):
            for k, v in self.variables.items():
                scope.set_var(k, v, const_flag=True)

        expanded_lines = engine.expand_lines(stripped.split("\n"), scope, 0)
        expanded_lines = [expand_values_and_get_inline(line, scope, engine.resolver, engine.stats) for line in expanded_lines]

        text = "\n".join(expanded_lines)
        text = CondenseProcessor.apply_all(text)

        self.stats = engine.stats
        return text, self.stats


# ================================================================
# Run
# ================================================================


def normalize_root(raw: Any) -> Any:
    json_root_raw = raw if isinstance(raw, dict) or isinstance(raw, list) else {}
    if isinstance(json_root_raw, list) and len(json_root_raw) == 1 and isinstance(json_root_raw[0], dict):
        return json_root_raw[0]
    return json_root_raw


def render(template: str, data: Dict[str, Any], options: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    opts = options or {}
    header_indentation = opts.get("headerIndentation", "#")
    drop_first_header = bool(opts.get("dropFirstHeader", False))
    variables = opts.get("variables", {})
    hl_before_opt = opts.get("hlBefore", None)
    hl_after_opt = opts.get("hlAfter", None)

    effective_before = PDL.HL_BEFORE if hl_before_opt is None else hl_before_opt
    effective_after = PDL.HL_AFTER if hl_after_opt is None else hl_after_opt
    highlight = highlight_config(effective_before, effective_after)

    json_root = normalize_root(data)
    templ_with_vars = apply_string_variables(str(template or ""), variables, highlight)

    parser = PDLParser(templ_with_vars, json_root, aliases={"data": json_root}, variables=variables, highlight=highlight)
    expanded_text, stats = parser.render()

    def collapse_blank_runs(text: str) -> str:
        out: List[str] = []
        prev_blank = False
        for line in str(text).split("\n"):
            is_blank = line.strip() == ""
            if is_blank:
                if prev_blank:
                    continue
                prev_blank = True
                out.append("")
            else:
                prev_blank = False
                out.append(line)
        return "\n".join(out)

    expanded_text = collapse_blank_runs(expanded_text)

    expanded_text = apply_highlight_heuristics(expanded_text, highlight)
    expanded_text = PostFormat.drop_first_header_line(expanded_text, drop_first_header)
    expanded_text = PostFormat.apply_header_level_preset(expanded_text, str(header_indentation or "#"))

    return {
        "markdown": expanded_text,
        "stats": stats.summary(),
        "rawStats": stats,
    }


__all__ = ["render", "PDL", "PDLParser", "PostFormat", "RenderStats"]

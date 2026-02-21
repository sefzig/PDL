"""
PDL Python entrypoint (source-only for now).

TODO: port the Langflow implementation and expose a real render function.
"""

from typing import Any, Dict, Tuple


def render(
    template: str,
    data: Dict[str, Any],
    *,
    header_indentation: str = "#",
    drop_first_header: bool = False,
) -> Tuple[str, Dict[str, Any]]:
    """Render PDL template against data (placeholder)."""
    raise NotImplementedError("PDL Python render not implemented yet.")

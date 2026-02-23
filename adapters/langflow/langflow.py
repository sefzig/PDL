"""Langflow component wrapper that delegates rendering to the PDL library.

This file stays small on purpose. The actual PDL engine lives in
`packages/py/pdl/pdl.py` and is inlined into `dist/langflow.py` by
`scripts/build-langflow.py`.
"""

from __future__ import annotations

import json

from langflow.custom import Component
from langflow.io import (
    PromptInput,
    MessageTextInput,
    DataInput,
    DropdownInput,
    BoolInput,
    Output,
    HandleInput,
)
from langflow.schema.message import Message
from langflow.base.prompts.api_utils import process_prompt_template
from langflow.template.utils import update_template_values

# Prefer the installed pdl package; when inlined, globals() already define render/PDL.
try:  # pragma: no cover - defensive import for Langflow runtime
    from pdl import render, PDL  # type: ignore
except Exception:  # pragma: no cover - fallback for inlined build artifact
    render = globals().get("render")
    PDL = globals().get("PDL")


# ================================================================
# 11) PromptComponent (Langflow integration)
# ================================================================

DOCUMENTATION = (
    "https://github.com/sefzig/aims-langflow/tree/main/components/{FolderName}/{ComponentName}/README.md"
)


class PromptComponent(Component):
    name = "Prompt"
    display_name: str = "Prompt Engineering α"
    folder_name = "Prompt"
    icon = "square-pen"
    description: str = "Create a prompt with PDL capabilities."
    documentation: str = DOCUMENTATION.replace("{FolderName}", folder_name).replace("{ComponentName}", name)
    trace_type = "prompt"

    inputs = [
        PromptInput(
            name="template",
            display_name="Template",
            info="Prompt template with PDL directives.",
            required=True,
        ),
        HandleInput(
            name="template_wired",
            display_name="Template (wired)",
            input_types=["Message"],
            required=False,
            advanced=True,
            info="Optional wired template input. Overrides 'Template' if it contains real text.",
        ),
        MessageTextInput(
            name="V_JSON",
            display_name="JSON",
            info="JSON source string used to resolve [value: …] directives.",
            value="",
            required=False,
            advanced=False,
            input_types=["Message", "Text"],
        ),
        DataInput(
            name="W_JSONData",
            display_name="JSON (Data handle)",
            info="Alternative Data input (.value as dict/list or JSON string).",
            required=False,
            advanced=True,
            input_types=["Data"],
        ),
        DropdownInput(
            name="X_HeaderLevel",
            display_name="Header Level",
            options=["#", "##", "###", "####", "#####", "######"],
            value="#",
            advanced=True,
            info="Baseline heading level when embedding this output into a larger prompt.",
        ),
        BoolInput(
            name="Y_DropFirstHeader",
            display_name="Drop First Header",
            value=False,
            advanced=True,
            info="If enabled and the very first line is an ATX header (#…######), remove it (and one trailing blank line).",
        ),
        MessageTextInput(
            name="Z_ToolPlaceholder",
            display_name="Tool Placeholder",
            tool_mode=True,
            advanced=True,
        ),
    ]

    outputs = [Output(display_name="Prompt", name="prompt", method="build_prompt")]

    def _pick_json_text(self) -> str:
        data_in = getattr(self, "W_JSONData", None)
        if data_in is not None:
            v = getattr(data_in, "value", None) or getattr(data_in, "data", None)
            if isinstance(v, (dict, list)):
                return json.dumps(v, ensure_ascii=False)
            if isinstance(v, str) and v.strip():
                return v
        j = getattr(self, "V_JSON", "")
        return j.text if hasattr(j, "text") else (j or "")

    async def build_prompt(self) -> Message:
        wired_msg = getattr(self, "template_wired", None)
        wired_text = None
        if wired_msg is not None and hasattr(wired_msg, "text"):
            wt = wired_msg.text if wired_msg.text is not None else ""
            wt_stripped = str(wt).strip()
            if wt_stripped:
                wired_text = wt_stripped

        if wired_text:
            prompt = Message(text=wired_text)
        else:
            prompt = Message.from_template(**self._attributes)

        template_text = prompt.text or ""

        json_text = self._pick_json_text()
        try:
            json_root = json.loads(json_text) if (json_text or "").strip() else {}
        except Exception:
            json_root = {}

        header = getattr(self, "X_HeaderLevel", "#")
        drop = getattr(self, "Y_DropFirstHeader", False)

        result = render(
            template_text,
            json_root,
            {
                "headerIndentation": str(getattr(header, "value", header)),
                "dropFirstHeader": bool(getattr(drop, "value", drop)),
                "variables": {},
                "hlBefore": getattr(PDL, "HL_BEFORE", ""),
                "hlAfter": getattr(PDL, "HL_AFTER", ""),
            },
        )

        prompt.text = result.get("markdown", template_text)
        self.status = result.get("stats", "")
        return prompt

    def _update_template(self, frontend_node: dict):
        prompt_template = frontend_node["template"]["template"]["value"]
        custom_fields = frontend_node["custom_fields"]
        process_prompt_template(
            template=prompt_template,
            name="template",
            custom_fields=custom_fields,
            frontend_node_template=frontend_node["template"],
        )
        return frontend_node

    async def update_frontend_node(self, new_frontend_node: dict, current_frontend_node: dict):
        frontend_node = await super().update_frontend_node(new_frontend_node, current_frontend_node)
        template = frontend_node["template"]["template"]["value"]
        process_prompt_template(
            template=template,
            name="template",
            custom_fields=frontend_node["custom_fields"],
            frontend_node_template=frontend_node["template"],
        )
        update_template_values(new_template=frontend_node, previous_template=current_frontend_node["template"])
        return frontend_node

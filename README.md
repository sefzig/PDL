# PDL: Prompt Data Language

One Prompt Data Language, two lightweight libraries (JS + Python), one set of shared fixtures, and small adapters you can paste into hosts like n8n. Everything here is source-first so we can evolve quickly before publishing packages.

## Structure

```
packages/
  js/src/          # JavaScript PDL library (source-only for now)
  py/pdl/          # Python PDL library (source-only for now)
adapters/          # Source adapters (import the libs)
  n8n/             # n8n code-node source (built/copied into dist for paste)
  langflow/        # Langflow adapter placeholder
dist/              # Built, single-file artifacts ready to paste into hosts
original/          # Legacy Langflow component kept for reference
tests/
  fixtures/        # Shared cross-language test data/templates
examples/          # Usage demos (to be added)
docs/              # Design notes and spec (to be added)
scripts/           # Helper scripts for builds/tests (to be added)
```

# Directives

This section contains human-readable notes per directive
The normative, machine-readable contract for PDL lives in `README.yaml`.

## Value

## Get/set

## Conditional

## Loop

## Convenience

# Testing

The library can be tested in the terminal.

## Fixtures

Tests in `tests/fixtures` are intended to run against both language implementations to keep behavior aligned.
Fixtures follow this naming convention (all parts share the same `XX_name` prefix):
- `XX_name.template.md` – the PDL template
- `XX_name.data.json` – the data payload
- `XX_name.variables.md` – integration-supplied variables (JSON, can be `{}`)
- `XX_name.result.md` – expected rendered output

## Smoke test

- Run all JS fixtures: `make run js`
- Run a single JS fixture: `make run js 01`

## Golden output

- Deterministic tests (JS only): `make test js` or `make test js 01`
- Full suite (JS + PY placeholder): `make test`
- Refresh expected outputs: add `update`, e.g., `make test js update 01` (must be cleared by human)

# Integrations

The library can be included in other systems. 
This sections describes the integrations as well as the build process for them.

## n8n

The library can be integrated in n8n as a code node. 
The code of the node is built by the script in this repository.

Inputs expected on the parent node `Config` JSON:
- `Data` (object): the data context
- `Template` (string): PDL markdown template
- `Variables` (object, optional): `{Name: Value}` substitutions for `{Name}` placeholders in the Template
- `HeaderIndentation` (string, optional): baseline header level, default `#`
- `DropFirstHeader` (bool, optional): drop first heading line

Build and paste:
1) `make build n8n` to regenerate `dist/n8n.js`
2) Copy the contents of `dist/n8n.js` into an n8n Code node (JavaScript)

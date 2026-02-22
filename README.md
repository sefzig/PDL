# PDL

Prompt Data Language fuses a text template and JSON data to dynamically create Markdown. 

Humans as well as AIs like well written language. 
With PDL, you create deterministic natural language from data. 
Use it to create pretty Markdown documents or to engineer your prompts.

This repository contains a Javascript and a Python library to integrate PDL into your app. 
Adapters for n8n and Langflow allow for quick integration into your automations.

> Use the [Playground](https://github.com/sefzig/PDL/blob/main/playground/index.html) to work with PDL and preview the results live.

Repository structure:

```
adapters/          # Source adapters
  n8n/             # n8n code-node code
  langflow/        # Langflow component code
dist/              # Built artifacts ready to use
packages/
  js/src/          # JavaScript PDL library
  py/pdl/          # Python PDL library
playground/        # A webapp providing an live editor
scripts/           # Helper scripts for builds/tests
tests/
  fixtures/        # Shared cross-language test files
  js/              # Javascript tests for Codex to use
  py/              # Python tests for Codex to use
```

# Directives

PDL uses its own syntax to fuse data with a text template. 
The main elements are `[directives:...]`, which describe the logic that creates text from data.

* `[value:...]`   Retrieve a value from the data and format it
* `[loop:...]`    Iterate over a list of data and use advanced matching
* `[if:...]`      Generate text depending on actual data and variables
* `[set/get:...]` Write and read variables, mutate and scope them
* `[condense]`    Compact complex logic to simple natural language

Take a look at all the available directives in the [tutorial](https://github.com/sefzig/PDL/blob/main/tests/fixtures/01_tutorial.template.md) (or the [cheatsheet](https://github.com/sefzig/PDL/blob/main/tests/fixtures/02_cheatsheet.template.md), if you have gone through the tutorial already). Both are available in the playground.

The normative, machine-readable contract for PDL lives in `README.yaml`.

# Testing

The library can be tested in the playground and your terminal.

## Fixtures

Tests in `tests/fixtures` are intended to run against both language implementations with aligned behaviour.

Fixtures follow this naming convention (all parts share the same `XX_name` prefix):
- `XX_name.data.json` – the data payload
- `XX_name.result.md` – expected rendered output
- `XX_name.template.md` – the PDL template
- `XX_name.variables.json` – integration-supplied variables

## Smoke test

- Run all JS fixtures: `make run js`
- Run a single JS fixture: `make run js 01`

## Playground build

- Build the browser bundle + fixtures manifest for the playground: `make build playground`
- Open `playground/index.html` in a browser (loads `dist/browser.js` and `playground/fixtures.json`)
- Choose from the provided fixtures or create your Custom template.

## Golden output

- Full suite (JS + PY): `make test`
- Deterministic tests (JS only): `make test js`
- Deterministic tests (JS and fixture 01 only): `make test js 01`
- Refresh expected outputs: add `update`, e.g., `make test js 01 update`

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

## Langflow

The Langflow component is not yet available.

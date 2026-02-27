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
adapters/    # Automation integrations
- n8n/       # n8n code-node code
- langflow/  # Langflow component code
dist/        # Built artifacts ready to use
packages/
- js/src/    # JavaScript PDL library
- py/pdl/    # Python PDL library
playground/  # A webapp providing an live editor
scripts/     # Helper scripts for builds/tests
tests/
- fixtures/  # Shared cross-language test files
- js/        # Javascript tests for Codex to use
- py/        # Python tests for Codex to use
```

# Directives

PDL uses its own syntax to bake data into the template text. 
The main elements are `[directives:...]`, which describe the logic that will create text from data.

* `[value:...]`   Retrieve a value from the data and format it
* `[loop:...]`    Iterate over a list of data and use advanced matching
* `[if:...]`      Generate text depending on actual data and variables
* `[set/get:...]` Write and read variables, mutate and scope them
* `[condense]`    Compact complex logic to simple natural language

Take a look at all the available directives in the [tutorial](https://github.com/sefzig/PDL/blob/main/tests/fixtures/01_tutorial.template.md) (or the [cheatsheet](https://github.com/sefzig/PDL/blob/main/tests/fixtures/02_cheatsheet.template.md), if you have gone through the tutorial already). Both are available in the interactive playground.

## Highlight wrappers

- Render options `hlBefore` / `hlAfter` (JS/Py) default to empty strings; wrapping activates when at least one marker is non-empty and both aren’t `false`.
- `[value:...]` and `[get:...]` outputs are wrapped after transforms unless `hl=false` is set on the directive.
- A light heuristic widens the wrap to the full Markdown link/image or HTML attribute when the directive is used as the URL/attribute value.
- Defaults keep current output unchanged until configured.

The normative, machine-readable contract for PDL lives in `README.yaml`.

# Testing

The library can be tested in terminal (and the playground). 

## Fixtures

Tests in `tests/fixtures` run against all language implementations.

Fixtures follow this naming convention (all parts share the same `XX_name` prefix):
- `XX_name.data.json` – the data payload
- `XX_name.result.md` – expected rendered output
- `XX_name.template.md` – the PDL template
- `XX_name.variables.json` – integration-supplied variables

## Smoke test

You can render a fixture right in your terminal:
- Run all fixtures:                `make run`
- Run fixtures with Javascript:    `make run js`
- Run fixtures with Python:        `make run py`
- Run a single fixture:            `make run 01`

If no language is chosen, the commands default to `js`.

## Golden output

Tests can be run accross the fixtures:
- Test all fixtures and languages: `make test`
- Test all fixtures in Javascript: `make test js`
- Test all fixtures with Python:   `make test py`
- Test specific fixtures:          `make test 01`
- Test and update fixture results: `make test update`

Flags for language, fixtures, and updates can be combined freely.

# Integrations

The library can be included in other apps and systems. 

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
2) Copy the contents of `dist/n8n.js` into an n8n JavaScript code node

## Langflow

The repository ships a Langflow custom component that wraps the Python PDL engine (inlined for portability).

Inputs exposed in Langflow:
- `Template` (string): prompt template with PDL directives
- `Template (wired)` (Message, optional): overrides `Template` when wired and non-empty
- `JSON` (string): JSON text used as data source
- `JSON (Data handle)` (Data, optional): alternative input; uses `.value`/`.data` if dict/list or JSON string
- `Header Level` (dropdown): baseline heading level, default `#`
- `Drop First Header` (bool): drop the first ATX header line and its following blank line, if present

Build and add:
1) `make build langflow` to regenerate `dist/langflow.py`.
2) Import `dist/langflow.py` into Langflow (e.g., Components → Upload in the UI, or place the file in your Langflow `components/` directory and restart).

## Browsers

The library can run in the browser as part of any web app. 

Build and add:
1) Run `make build browser` to produce `dist/browser.js`.
2) Add `dist/browser.js` to your app
3) Load it via <script> tag.

# Playground 

In the playground, you can test all PDL fixtures and work on your Custom one.

## Build

Run `make build playground` to produce a browser bundle and a fixtures manifest. 

The build now emits two manifests:
- `playground/fixtures.json` — gitignore-filtered fixtures (tracked or untracked, but not ignored)
- `playground/fixtures-local.json` — all local fixtures, including gitignored ones (ignored by git)

## Use

Open `playground/index.html` in your browser and choose from the provided fixtures.
The playground will try to load `fixtures-local.json` first (if present); it falls back to `fixtures.json` and blends both, with local entries overriding bundled ones. Only fixtures that exist *only* locally are marked “local” in the UI; public fixtures that are overridden locally stay unmarked.
In the app, the fixture (`Custom`) is persisted in your Local Storage until you reset it.
Use the Export function to produce fixture files for other systems.

# Niceties

- **VSC**: Do you use Visual Studio Code? A ready-to-package syntax extension lives in `vsc/` to highlight PDL inline in Markdown, inside ```pdl``` fences, and in `.pdl` files. Build a `.vsix` with `npm install && npx vsce package`, then install it via “Extensions → ... → Install from VSIX…”.

- **License**: MIT

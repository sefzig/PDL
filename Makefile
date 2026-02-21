.PHONY: run build

# Usage:
#   make run js 01     # run JS fixtures (optional key)
#   make run           # defaults to js, all fixtures
#   make build n8n     # build dist/n8n.js

run:
	@set -- $(filter-out $@,$(MAKECMDGOALS)); \
	lang=$${1:-js}; key=$${2:-}; \
	if [ "$$lang" = "js" ]; then ./scripts/pdl js $$key; \
	elif [ "$$lang" = "py" ]; then ./scripts/pdl py $$key; \
	else echo "Unknown language: $$lang (use js|py)"; exit 1; fi

build:
	@set -- $(filter-out $@,$(MAKECMDGOALS)); \
	target=$${1:-n8n}; \
	if [ "$$target" = "n8n" ]; then node scripts/build-n8n.js; \
	elif [ "$$target" = "browser" ]; then node scripts/build-browser.js && node scripts/build-fixtures.js; \
	else echo "Unknown build target: $$target"; exit 1; fi

.PHONY: test

test:
	@set -- $(filter-out $@,$(MAKECMDGOALS)); \
	target="py"; update=0; key=""; \
	for arg in "$$@"; do \
		if [ "$$arg" = "js" ] || [ "$$arg" = "py" ]; then target="$$arg"; \
		elif [ "$$arg" = "update" ]; then update=1; \
		elif [ -z "$$key" ]; then key="$$arg"; fi; \
	done; \
	if [ "$$target" = "js" ]; then \
		if [ $$update -eq 1 ]; then \
			if [ -n "$$key" ]; then node tests/js/test.js update $$key; else node tests/js/test.js update; fi; \
		else \
			if [ -n "$$key" ]; then node tests/js/test.js $$key; else node tests/js/test.js; fi; \
		fi; \
	else \
		python3 tests/py/test.py $$key; \
	fi

# Swallow extra goals (like fixture keys / update) so make doesn't error.
%:
	@:

# Swallow extra goals (like `js` / `01`) so make doesn't error.
%:
	@:

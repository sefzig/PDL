.PHONY: run build

# Usage:
#   make run js 01     # run JS fixtures (optional key)
#   make run           # defaults to js, all fixtures
#   make build n8n     # build dist/n8n.js
#   make build php     # build dist/pdl.php

run:
	@set -- $(filter-out $@,$(MAKECMDGOALS)); \
	lang="js"; key=""; \
	for arg in "$$@"; do \
		if [ "$$arg" = "js" ] || [ "$$arg" = "py" ] || [ "$$arg" = "php" ]; then lang="$$arg"; \
		elif [ -z "$$key" ]; then key="$$arg"; fi; \
	done; \
	if [ "$$lang" = "js" ]; then ./scripts/pdl js $$key; \
	elif [ "$$lang" = "py" ]; then ./scripts/pdl py $$key; \
	elif [ "$$lang" = "php" ]; then ./scripts/pdl php $$key; \
	else echo "Unknown language: $$lang (use js|py)"; exit 1; fi

build:
	@set -- $(filter-out $@,$(MAKECMDGOALS)); \
	target=$${1:-n8n}; \
	if [ "$$target" = "n8n" ]; then node scripts/build-n8n.js; \
	elif [ "$$target" = "playground" ]; then node scripts/build-browser.js && node scripts/build-playground.js; \
	elif [ "$$target" = "browser" ]; then node scripts/build-browser.js; \
	elif [ "$$target" = "langflow" ]; then python3 scripts/build-langflow.py; \
	elif [ "$$target" = "php" ]; then mkdir -p dist && cp packages/php/src/pdl.php dist/pdl.php; \
	else echo "Unknown build target: $$target"; exit 1; fi

.PHONY: test

test:
	@set -- $(filter-out $@,$(MAKECMDGOALS)); \
	target="all"; update=0; key=""; \
	for arg in "$$@"; do \
		if [ "$$arg" = "js" ] || [ "$$arg" = "py" ] || [ "$$arg" = "php" ] || [ "$$arg" = "all" ]; then target="$$arg"; \
		elif [ "$$arg" = "update" ]; then update=1; \
		elif [ -z "$$key" ]; then key="$$arg"; fi; \
	done; \
	if [ "$$target" = "js" ]; then \
		if [ $$update -eq 1 ]; then \
			if [ -n "$$key" ]; then node tests/js/test.js update $$key; else node tests/js/test.js update; fi; \
		else \
			if [ -n "$$key" ]; then node tests/js/test.js $$key; else node tests/js/test.js; fi; \
		fi; \
	elif [ "$$target" = "py" ]; then \
		if [ -n "$$key" ]; then python3 tests/py/run.py $$key; else python3 tests/py/run.py; fi; \
	elif [ "$$target" = "php" ]; then \
		if command -v php >/dev/null 2>&1; then \
			if [ -n "$$key" ]; then php tests/php/run.php $$key; else php tests/php/run.php; fi; \
		else \
			echo "php binary not found; skipping"; \
		fi; \
	else \
		if [ $$update -eq 1 ]; then \
			if [ -n "$$key" ]; then node tests/both/test.js update $$key; else node tests/both/test.js update; fi; \
		else \
			if [ -n "$$key" ]; then node tests/both/test.js $$key; else node tests/both/test.js; fi; \
		fi; \
	fi

# Swallow extra goals (like fixture keys / update) so make doesn't error.
%:
	@:

# Swallow extra goals (like `js` / `01`) so make doesn't error.
%:
	@:

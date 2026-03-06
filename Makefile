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
	target="all"; update=0; diff=0; noerr=1; key=""; \
	for arg in "$$@"; do \
		if [ "$$arg" = "js" ] || [ "$$arg" = "py" ] || [ "$$arg" = "php" ] || [ "$$arg" = "go" ] || [ "$$arg" = "all" ]; then target="$$arg"; \
		elif [ "$$arg" = "update" ]; then update=1; \
		elif [ "$$arg" = "diff" ]; then diff=1; \
		elif [ "$$arg" = "strict" ]; then noerr=0; \
		elif [ "$$arg" = "noerr" ]; then noerr=1; \
		elif [ -z "$$key" ]; then key="$$arg"; fi; \
	done; \
	if [ "$$target" = "js" ]; then \
		args=""; \
		[ $$update -eq 1 ] && args="$$args update"; \
		[ -n "$$key" ] && args="$$args $$key"; \
		[ $$diff -eq 1 ] && args="$$args diff"; \
		set -- $$args; node tests/js/test.js "$$@"; status=$$?; \
		[ $$noerr -eq 1 ] || exit $$status; \
	elif [ "$$target" = "py" ]; then \
		args=""; \
		[ -n "$$key" ] && args="$$args $$key"; \
		[ $$diff -eq 1 ] && args="$$args diff"; \
		set -- $$args; python3 tests/py/run.py "$$@"; status=$$?; \
		[ $$noerr -eq 1 ] || exit $$status; \
	elif [ "$$target" = "go" ]; then \
		if command -v go >/dev/null 2>&1; then \
			if [ -n "$$key" ]; then \
				args=""; \
				[ $$update -eq 1 ] && args="$$args update"; \
				args="$$args $$key"; \
				[ $$diff -eq 1 ] && args="$$args diff"; \
				tmpbin=$$(mktemp /tmp/pdl-go-XXXXXX); \
				set -- $$args; cd packages/go/pdl && GOCACHE=/tmp/gocache GOTMPDIR=/tmp go build -o $$tmpbin ./cmd/testrun && $$tmpbin "$$@"; status=$$?; rm -f $$tmpbin; \
			else \
				args=""; \
				[ $$update -eq 1 ] && args="$$args update"; \
				[ $$diff -eq 1 ] && args="$$args diff"; \
				tmpbin=$$(mktemp /tmp/pdl-go-XXXXXX); \
				set -- $$args; cd packages/go/pdl && GOCACHE=/tmp/gocache GOTMPDIR=/tmp go build -o $$tmpbin ./cmd/testrun && $$tmpbin "$$@"; status=$$?; rm -f $$tmpbin; \
			fi; \
			[ $$noerr -eq 1 ] || exit $$status; \
		else \
			echo "go binary not found; skipping"; \
		fi; \
	elif [ "$$target" = "php" ]; then \
		if command -v php >/dev/null 2>&1; then \
			args=""; \
			[ -n "$$key" ] && args="$$args $$key"; \
			[ $$diff -eq 1 ] && args="$$args diff"; \
			set -- $$args; php tests/php/run.php "$$@"; status=$$?; \
			[ $$noerr -eq 1 ] || exit $$status; \
		else \
			echo "php binary not found; skipping"; \
		fi; \
	else \
		if [ $$update -eq 1 ]; then \
			if [ -n "$$key" ]; then node tests/both/test.js update $$key; else node tests/both/test.js update; fi; \
		else \
			green="\033[32m"; red="\033[31m"; dim="\033[2m"; reset="\033[0m"; \
			[ $$diff -eq 1 ] && show_diff=1 || show_diff=0; \
			php_avail=1; command -v php >/dev/null 2>&1 || php_avail=0; \
			go_avail=1; command -v go >/dev/null 2>&1 || go_avail=0; \
			pass_js=0; pass_py=0; pass_php=0; pass_go=0; total=0; total_js=0; total_py=0; total_php=0; total_go=0; \
			bases=$$(cd tests/fixtures && ls *.template.md | sed 's/.template.md//' | sort -V); \
			for base in $$bases; do \
				total=$$((total+1)); fail=""; \
				node tests/js/test.js $$base >/dev/null 2>&1 && pass_js=$$((pass_js+1)) || fail="js"; total_js=$$((total_js+1)); \
				python3 tests/py/run.py $$base >/dev/null 2>&1 && pass_py=$$((pass_py+1)) || fail="$$fail$${fail:+,}py"; total_py=$$((total_py+1)); \
				if [ $$php_avail -eq 1 ]; then \
					php tests/php/run.php $$base >/dev/null 2>&1 && pass_php=$$((pass_php+1)) || fail="$$fail$${fail:+,}php"; total_php=$$((total_php+1)); \
				fi; \
				if [ $$go_avail -eq 1 ]; then \
					total_go=$$((total_go+1)); \
					if cd packages/go/pdl && GOCACHE=/tmp/gocache GOTMPDIR=/tmp go test -count=1 -run "TestRenderFixtures/$$base" ./... >/dev/null 2>&1; then \
						pass_go=$$((pass_go+1)); \
					else \
						fail="$$fail$${fail:+,}go"; \
					fi; \
					cd - >/dev/null 2>&1; \
				fi; \
				if [ -z "$$fail" ]; then \
					printf "$${green}✓$${reset} %s\n" $$base; \
				else \
					fail_sorted=$$(printf "%s" "$$fail" | tr ',' '\n' | sort | paste -sd',' - | sed 's/,/, /g'); \
					printf "$${red}✗$${reset} %s $${dim}%s$${reset}\n" $$base "$$fail_sorted"; \
					if [ $$show_diff -eq 1 ]; then \
						first_fail=$${fail%%,*}; \
						if [ "$$first_fail" = "js" ]; then node tests/js/test.js diff diff-only no-summary $$base; \
						elif [ "$$first_fail" = "py" ]; then python3 tests/py/run.py diff diff-only no-summary $$base; \
						elif [ "$$first_fail" = "php" ]; then php tests/php/run.php diff diff-only no-summary $$base; \
						elif [ "$$first_fail" = "go" ]; then cd packages/go/pdl && GOCACHE=/tmp/gocache GOTMPDIR=/tmp go run ./cmd/testrun diff diff-only no-summary $$base && cd - >/dev/null 2>&1; \
						fi; \
					fi; \
				fi; \
			done; \
			[ $$pass_js -eq $$total_js ] && printf "$${green}✓ pass js: %d/%d$${reset}\n" $$pass_js $$total_js || printf "$${red}✗ fail js: %d/%d$${reset}\n" $$((total_js-pass_js)) $$total_js; \
			[ $$pass_py -eq $$total_py ] && printf "$${green}✓ pass py: %d/%d$${reset}\n" $$pass_py $$total_py || printf "$${red}✗ fail py: %d/%d$${reset}\n" $$((total_py-pass_py)) $$total_py; \
			if [ $$php_avail -eq 1 ]; then \
				[ $$pass_php -eq $$total_php ] && printf "$${green}✓ pass php: %d/%d$${reset}\n" $$pass_php $$total_php || printf "$${red}✗ fail php: %d/%d$${reset}\n" $$((total_php-pass_php)) $$total_php; \
			else \
				printf "$${yellow:-}php binary not found; skipped$${reset}\n"; \
			fi; \
			if [ $$go_avail -eq 1 ]; then \
				[ $$pass_go -eq $$total_go ] && printf "$${green}✓ pass go: %d/%d$${reset}\n" $$pass_go $$total_go || printf "$${red}✗ fail go: %d/%d$${reset}\n" $$((total_go-pass_go)) $$total_go; \
			else \
				printf "$${yellow:-}go binary not found; skipped$${reset}\n"; \
			fi; \
			exit 0; \
		fi; \
	fi

# Swallow extra goals (like fixture keys / update) so make doesn't error.
%:
	@:

# Swallow extra goals (like `js` / `01`) so make doesn't error.
%:
	@:

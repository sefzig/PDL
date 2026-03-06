package main

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/sefzig/PDL/packages/go/pdl"
)

var (
	colorGreen  = func(s string) string { return "\x1b[32m" + s + "\x1b[0m" }
	colorRed    = func(s string) string { return "\x1b[31m" + s + "\x1b[0m" }
	colorYellow = func(s string) string { return "\x1b[33m" + s + "\x1b[0m" }
	colorDim    = func(s string) string { return "\x1b[2m" + s + "\x1b[0m" }
)

func fmtMs(ms int64) string { return colorDim(fmt.Sprintf(" %dms", ms)) }

const fixturesDir = "../../../tests/fixtures"

type fixture struct {
	base      string
	template  string
	data      any
	variables map[string]any
	expected  string
	outPath   string
}

func listFixtures() ([]string, error) {
	entries, err := os.ReadDir(fixturesDir)
	if err != nil {
		return nil, fmt.Errorf("read fixtures dir: %w", err)
	}
	var bases []string
	for _, e := range entries {
		name := e.Name()
		if strings.HasSuffix(name, ".template.md") {
			base := strings.TrimSuffix(name, ".template.md")
			bases = append(bases, base)
		}
	}
	sort.Strings(bases)
	return bases, nil
}

func readFile(path string) (string, error) {
	b, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

func loadFixture(base string) (fixture, error) {
	root := fixturesDir

	tpl, err := readFile(filepath.Join(root, base+".template.md"))
	if err != nil {
		return fixture{}, fmt.Errorf("load template: %w", err)
	}
	dataPath := filepath.Join(root, base+".data.json")
	var data any
	if b, err := os.ReadFile(dataPath); err != nil {
		return fixture{}, fmt.Errorf("load data: %w", err)
	} else if err := json.Unmarshal(b, &data); err != nil {
		return fixture{}, fmt.Errorf("decode data: %w", err)
	}

	expPath := filepath.Join(root, base+".result.md")
	expected, err := readFile(expPath)
	if err != nil && !os.IsNotExist(err) {
		return fixture{}, fmt.Errorf("load expected: %w", err)
	}

	var vars map[string]any
	varsPath := filepath.Join(root, base+".variables.json")
	if b, err := os.ReadFile(varsPath); err == nil {
		if err := json.Unmarshal(b, &vars); err != nil {
			return fixture{}, fmt.Errorf("decode variables: %w", err)
		}
	}

	return fixture{
		base:      base,
		template:  tpl,
		data:      data,
		variables: vars,
		expected:  expected,
		outPath:   expPath,
	}, nil
}

func writeTemp(content, suffix string) (string, error) {
	f, err := os.CreateTemp("", "pdl-*"+suffix)
	if err != nil {
		return "", err
	}
	if _, err := f.WriteString(content); err != nil {
		f.Close()
		return "", err
	}
	if err := f.Close(); err != nil {
		return "", err
	}
	return f.Name(), nil
}

func diffStrings(expected, actual string) (string, error) {
	aFile, err := writeTemp(expected, ".expected")
	if err != nil {
		return "", err
	}
	bFile, err := writeTemp(actual, ".actual")
	if err != nil {
		return "", err
	}
	cmd := exec.Command("diff", "-u", aFile, bFile)
	out, _ := cmd.CombinedOutput() // diff exits non-zero on differences; we still want output
	lines := strings.Split(strings.TrimSpace(string(out)), "\n")
	for i, line := range lines {
		switch {
		case strings.HasPrefix(line, "---"), strings.HasPrefix(line, "+++"), strings.HasPrefix(line, "@@"):
			lines[i] = colorDim(line)
		case strings.HasPrefix(line, "+"), strings.HasPrefix(line, "-"):
			lines[i] = colorDim(line)
		default:
			lines[i] = colorDim(line)
		}
	}
	return strings.Join(lines, "\n"), nil
}

func normalizeNewline(s string) string {
	if !strings.HasSuffix(s, "\n") {
		return s + "\n"
	}
	return s
}

func runFixture(f fixture, update bool, diff bool, diffOnly bool) (bool, int64, error) {
	start := time.Now()
	result, err := pdl.Render(f.template, f.data, pdl.Options{Variables: f.variables})
	elapsed := time.Since(start).Milliseconds()
	if err != nil {
		return false, elapsed, fmt.Errorf("render: %w", err)
	}
	actual := normalizeNewline(result.Markdown)

	if update {
		if err := os.WriteFile(f.outPath, []byte(actual), 0o644); err != nil {
			return false, elapsed, fmt.Errorf("write expected: %w", err)
		}
		fmt.Printf("%s updated %s%s\n", colorYellow("↻"), f.outPath, fmtMs(elapsed))
		return true, elapsed, nil
	}

	if f.expected == "" {
		fmt.Printf("%s missing expected output: %s%s\n", colorRed("✗"), f.outPath, fmtMs(elapsed))
		return false, elapsed, nil
	}

	expNorm := normalizeNewline(f.expected)
	if expNorm == actual {
		fmt.Printf("%s %s%s\n", colorGreen("✓"), f.base, fmtMs(elapsed))
		return true, elapsed, nil
	}

	if !diffOnly {
		fmt.Printf("%s %s%s\n", colorRed("✗"), f.base, fmtMs(elapsed))
	}
	if diff {
		d, err := diffStrings(expNorm, actual)
		if err != nil {
			return false, elapsed, fmt.Errorf("diff: %w", err)
		}
		fmt.Println(d)
	}
	return false, elapsed, nil
}

func filterFixtures(all []string, key string) []string {
	if key == "" {
		return all
	}
	var out []string
	for _, base := range all {
		if strings.HasPrefix(base, key) {
			out = append(out, base)
		}
	}
	return out
}

func main() {
	args := os.Args[1:]
	update := false
	diff := false
	diffOnly := false
	noSummary := false
	key := ""
	for _, a := range args {
		if a == "update" {
			update = true
			continue
		}
		if a == "diff" {
			diff = true
			continue
		}
		if a == "diff-only" {
			diffOnly = true
			continue
		}
		if a == "no-summary" {
			noSummary = true
			continue
		}
		if key == "" {
			key = a
		}
	}

	all, err := listFixtures()
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	selected := filterFixtures(all, key)
	if len(selected) == 0 {
		fmt.Fprintf(os.Stderr, "No fixtures match %q. Available: %s\n", key, strings.Join(all, ", "))
		os.Exit(1)
	}

	ok := true
	count := 0
	failed := 0
	var totalMs int64
	var passMs int64
	var failMs int64
	passCount := 0
	for _, base := range selected {
		fx, err := loadFixture(base)
		if err != nil {
			fmt.Fprintf(os.Stderr, "%s %s\n", colorRed("✗"), err)
			ok = false
			failed++
			continue
		}
		res, ms, err := runFixture(fx, update, diff, diffOnly)
		if err != nil {
			fmt.Fprintf(os.Stderr, "%s %s\n", colorRed("✗"), err)
			ok = false
			failed++
			continue
		}
		count++
		totalMs += ms
		if !res {
			ok = false
			failed++
			failMs += ms
		} else {
			passCount++
			passMs += ms
		}
	}

	if !update && !noSummary {
		if failed == 0 {
			fmt.Printf("%s%s\n", colorGreen(fmt.Sprintf("✔ pass: %d/%d", count, count)), fmtMs(totalMs))
		} else {
			fmt.Printf("%s%s\n", colorGreen(fmt.Sprintf("✓ pass: %d/%d", passCount, count)), fmtMs(passMs))
			fmt.Printf("%s%s\n", colorRed(fmt.Sprintf("✖ fail: %d/%d", failed, count)), fmtMs(failMs))
		}
	}

	if !ok && !update {
		os.Exit(1)
	}
}

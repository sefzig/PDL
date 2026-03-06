package pdl

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"
)

type fixture struct {
	base      string
	template  string
	data      any
	variables map[string]any
	expected  string
}

func listFixtures(t *testing.T) []string {
	t.Helper()
	fixturesDir := filepath.Join("..", "..", "..", "tests", "fixtures")
	entries, err := os.ReadDir(fixturesDir)
	if err != nil {
		t.Fatalf("read fixtures dir: %v", err)
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
	return bases
}

func loadFixture(t *testing.T, base string) fixture {
	t.Helper()
	root := filepath.Join("..", "..", "..", "tests", "fixtures")

	read := func(path string) string {
		b, err := os.ReadFile(path)
		if err != nil {
			t.Fatalf("read %s: %v", path, err)
		}
		return string(b)
	}

	var decodeJSON = func(path string, dst *any) {
		b, err := os.ReadFile(path)
		if err != nil {
			t.Fatalf("read %s: %v", path, err)
		}
		if err := json.Unmarshal(b, dst); err != nil {
			t.Fatalf("decode %s: %v", path, err)
		}
	}

	tpl := read(filepath.Join(root, base+".template.md"))
	exp := read(filepath.Join(root, base+".result.md"))

	var data any
	decodeJSON(filepath.Join(root, base+".data.json"), &data)

	var vars map[string]any
	varsPath := filepath.Join(root, base+".variables.json")
	if b, err := os.ReadFile(varsPath); err == nil {
		if err := json.Unmarshal(b, &vars); err != nil {
			t.Fatalf("decode %s: %v", varsPath, err)
		}
	} else if !os.IsNotExist(err) {
		t.Fatalf("read %s: %v", varsPath, err)
	}

	return fixture{
		base:      base,
		template:  tpl,
		data:      data,
		variables: vars,
		expected:  exp,
	}
}

func normalizeNewline(s string) string {
	s = strings.ReplaceAll(s, "\r\n", "\n")
	if !strings.HasSuffix(s, "\n") {
		return s + "\n"
	}
	return s
}

func TestRenderFixtures(t *testing.T) {
	for _, base := range listFixtures(t) {
		fixture := loadFixture(t, base)
		t.Run(base, func(t *testing.T) {
			opts := Options{Variables: fixture.variables}
			res, err := Render(fixture.template, fixture.data, opts)
			if err != nil {
				t.Fatalf("render error: %v", err)
			}
			actual := normalizeNewline(res.Markdown)
			expected := normalizeNewline(fixture.expected)
			if actual != expected {
				t.Fatalf("mismatch\nexpected:\n%s\nactual:\n%s", expected, actual)
			}
		})
	}
}

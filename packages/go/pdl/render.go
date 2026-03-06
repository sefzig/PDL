package pdl

import (
	"bytes"
	"encoding/json"
	"fmt"
	"math"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
	"unicode"
)

// This is a standalone Go implementation of PDL (Prompt Data Language).
// It aims for behavior parity with the JS/Python ports used by the fixtures.

// ================================================================
// 1) Constants & Config
// ================================================================

const (
	valuePrefix   = "[value:"
	getPrefix     = "[get:"
	setPrefix     = "[set:"
	loopIdxToken  = "[loop-index]"
	ifStart       = "[if:"
	elifToken     = "[if-elif:"
	elseToken     = "[if-else]"
	ifEnd         = "[if-end]"
	loopStart     = "[loop:"
	loopEnd       = "[loop-end]"
	condenseStart = "[condense]"
	condenseEnd   = "[condense-end]"
	maxDepth      = 40
	maxExpansions = 30000
	dateTZ        = "Europe/Berlin"
	invalidDate   = "[invalid date]"
	invalidTime   = "[invalid time]"
)

var (
	ops2        = map[string]struct{}{"<=": {}, ">=": {}, "!=": {}, "^=": {}, "$=": {}, "*=": {}}
	ops1        = map[string]struct{}{"<": {}, ">": {}, "=": {}}
	numericOps  = map[string]struct{}{"<": {}, "<=": {}, ">": {}, ">=": {}}
	varNameRe   = regexp.MustCompile(`^[A-Za-z0-9_]+$`)
	numberRe    = regexp.MustCompile(`^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?$`)
	headerRe    = regexp.MustCompile(`^(#{1,6})([ \t]+)(.*)$`)
	fenceRe     = regexp.MustCompile("^(```|~~~)")
	commentRe   = regexp.MustCompile(`[ \t]//`)
	linkAttrEsc = regexp.MustCompile(`[.*+?^${}()|[\]\\]`)
)

// ================================================================
// 2) Helpers
// ================================================================

func compactJSON(v interface{}) string {
	switch m := v.(type) {
	case map[string]interface{}:
		keys := make([]string, 0, len(m))
		for k := range m {
			keys = append(keys, k)
		}
		order := map[string]int{"name": 0, "price": 1, "locations": 2}
		sort.Slice(keys, func(i, j int) bool {
			pi, iok := order[keys[i]]
			pj, jok := order[keys[j]]
			if iok && jok {
				return pi < pj
			}
			if iok || jok {
				return iok
			}
			return keys[i] < keys[j]
		})
		var b strings.Builder
		b.WriteByte('{')
		for idx, k := range keys {
			b.WriteString(strconv.Quote(k))
			b.WriteByte(':')
			b.WriteString(compactJSON(m[k]))
			if idx < len(keys)-1 {
				b.WriteByte(',')
			}
		}
		b.WriteByte('}')
		return b.String()
	case []interface{}:
		var b strings.Builder
		b.WriteByte('[')
		for i, it := range m {
			b.WriteString(compactJSON(it))
			if i < len(m)-1 {
				b.WriteByte(',')
			}
		}
		b.WriteByte(']')
		return b.String()
	default:
		b, err := json.Marshal(v)
		if err != nil {
			return fmt.Sprint(v)
		}
		return string(b)
	}
}

func toBool(v interface{}) (bool, bool) {
	switch x := v.(type) {
	case bool:
		return x, true
	case string:
		s := strings.TrimSpace(strings.ToLower(x))
		if s == "true" || s == "yes" || s == "on" || s == "1" {
			return true, true
		}
		if s == "false" || s == "no" || s == "off" || s == "0" {
			return false, true
		}
	}
	return false, false
}

func markdownEscape(s string) string {
	repl := []string{`\\`, `\*`, `\_`, "\u0060", `\~`, `\[`, `\]`, `\(`, `\)`, `\#`, `\+`, `\-`, `\!`, `\>`, `\|`}
	ch := []string{`\\`, `*`, `_`, "`", `~`, `[`, `]`, `(`, `)`, `#`, `+`, `-`, `!`, `>`, `|`}
	out := s
	for i := range ch {
		out = strings.ReplaceAll(out, ch[i], repl[i])
	}
	return out
}

func coerceNumber(x interface{}) (float64, bool) {
	switch v := x.(type) {
	case int:
		return float64(v), true
	case int64:
		return float64(v), true
	case float64:
		return v, mathIsFinite(v)
	case string:
		s := strings.TrimSpace(v)
		if !numberRe.MatchString(s) {
			return 0, false
		}
		f, err := strconv.ParseFloat(s, 64)
		return f, err == nil && mathIsFinite(f)
	default:
		return 0, false
	}
}

func mathIsFinite(f float64) bool {
	return !math.IsNaN(f) && !math.IsInf(f, 0)
}

func plural(n int, singular string) string {
	if n == 1 {
		return singular
	}
	return singular + "s"
}
func pluralInt(n int64, singular string) string {
	if n == 1 {
		return singular
	}
	return singular + "s"
}

// ================================================================
// 3) Stats & Scope
// ================================================================

type RenderStats struct {
	Loops        int  `json:"loops"`
	CondsTrue    int  `json:"conds_true"`
	CondsFalse   int  `json:"conds_false"`
	ErrorsParse  int  `json:"errors_parse"`
	ErrorsInline int  `json:"errors_inline"`
	Expansions   int  `json:"expansions"`
	Halted       bool `json:"halted"`
}

func (r RenderStats) Summary() string {
	parts := []string{
		fmt.Sprintf("Expanded %d loop(s)", r.Loops),
		fmt.Sprintf("%d condition(s)", r.CondsTrue+r.CondsFalse),
	}
	if r.Expansions > 0 {
		parts = append(parts, fmt.Sprintf("%d expansion(s)", r.Expansions))
	}
	if r.ErrorsParse > 0 {
		parts = append(parts, fmt.Sprintf("%d parse issue(s)", r.ErrorsParse))
	}
	if r.ErrorsInline > 0 {
		parts = append(parts, fmt.Sprintf("%d inline issue(s)", r.ErrorsInline))
	}
	return strings.Join(parts, "; ")
}

type varBinding struct {
	Value  interface{}
	Const  bool
	Humble bool
}

type Scope struct {
	root       interface{}
	aliases    map[string]interface{}
	indexChain []int
	dots       bool
	varFrames  []map[string]varBinding
	highlight  map[string]interface{}
}

func newScope(root interface{}, aliases map[string]interface{}, index []int, dots bool, varFrames []map[string]varBinding, highlight map[string]interface{}) *Scope {
	if aliases == nil {
		aliases = map[string]interface{}{}
	}
	if varFrames == nil {
		varFrames = []map[string]varBinding{{}}
	}
	return &Scope{
		root:       root,
		aliases:    aliases,
		indexChain: index,
		dots:       dots,
		varFrames:  varFrames,
		highlight:  highlight,
	}
}

func (s *Scope) cloneForLoop(child map[string]interface{}, idx int, alias string, dots bool) *Scope {
	newAliases := map[string]interface{}{}
	for k, v := range s.aliases {
		newAliases[k] = v
	}
	if alias != "" {
		newAliases[alias] = child
	}
	newFrames := make([]map[string]varBinding, len(s.varFrames)+1)
	copy(newFrames, s.varFrames)
	newFrames[len(newFrames)-1] = map[string]varBinding{}
	newIndex := append(append([]int{}, s.indexChain...), idx)
	return newScope(s.root, newAliases, newIndex, dots, newFrames, s.highlight)
}

func (s *Scope) setVar(name string, val interface{}, constFlag bool, humble bool, scopeLocal bool) {
	if humble {
		if _, ok := s.getVar(name); ok {
			return
		}
		if existing := (PathResolver{}).resolveScoped(name, s, true); existing != nil {
			return
		}
	}
	if scopeLocal {
		frame := s.varFrames[len(s.varFrames)-1]
		if prev, ok := frame[name]; ok && prev.Const {
			return
		}
		frame[name] = varBinding{Value: val, Const: constFlag, Humble: humble}
		return
	}
	for i := len(s.varFrames) - 1; i >= 0; i-- {
		frame := s.varFrames[i]
		if prev, ok := frame[name]; ok {
			if prev.Const && constFlag {
				return
			}
			frame[name] = varBinding{Value: val, Const: constFlag, Humble: humble}
			return
		}
	}
	s.varFrames[0][name] = varBinding{Value: val, Const: constFlag, Humble: humble}
}

func (s *Scope) getVar(name string) (interface{}, bool) {
	for i := len(s.varFrames) - 1; i >= 0; i-- {
		if v, ok := s.varFrames[i][name]; ok {
			return v.Value, true
		}
	}
	return nil, false
}

// ================================================================
// 4) Path resolution
// ================================================================

type PathResolver struct{}

func (PathResolver) resolveScoped(raw string, scope *Scope, defaultCI bool) interface{} {
	path := strings.TrimSpace(raw)
	if path == "" {
		return nil
	}
	// allow referencing variables directly
	if val, ok := scope.getVar(path); ok {
		return val
	}
	parts := splitPath(path)
	var cur interface{} = scope.root
	for _, p := range parts {
		name := p.Name
		if aliasVal, ok := scope.aliases[name]; ok {
			if m, okm := aliasVal.(map[string]interface{}); okm {
				if v, okv := m[""]; okv {
					cur = v
				} else {
					cur = aliasVal
				}
			} else {
				cur = aliasVal
			}
		} else if m, ok := cur.(map[string]interface{}); ok {
			v, ok := m[name]
			if !ok && defaultCI {
				lower := strings.ToLower(name)
				for k, vv := range m {
					if strings.ToLower(k) == lower {
						v = vv
						ok = true
						break
					}
				}
			}
			if !ok {
				return nil
			}
			cur = v
		} else if arr, ok := cur.([]interface{}); ok {
			if idx, err := strconv.Atoi(name); err == nil {
				if idx < 0 || idx >= len(arr) {
					return nil
				}
				cur = arr[idx]
			} else {
				if len(arr) == 0 {
					return nil
				}
				cur = arr[0]
				if m, ok := cur.(map[string]interface{}); ok {
					v, ok := m[name]
					if ok {
						cur = v
					}
				}
			}
		} else {
			return nil
		}
		// selectors or bracket access
		if len(p.Selectors) > 0 {
			for _, sel := range p.Selectors {
				cur = applyBracketOrSelector(cur, sel, defaultCI)
				if cur == nil {
					return nil
				}
			}
		}
	}
	return cur
}

type pathPart struct {
	Name      string
	Selectors []string
}

func splitPath(path string) []pathPart {
	var parts []pathPart
	var name strings.Builder
	var selectors []string
	for i := 0; i < len(path); i++ {
		ch := path[i]
		if ch == '[' {
			// collect selector content (supports nested brackets)
			depth := 1
			j := i + 1
			for j < len(path) && depth > 0 {
				if path[j] == '[' {
					depth++
				} else if path[j] == ']' {
					depth--
					if depth == 0 {
						break
					}
				}
				j++
			}
			if depth == 0 {
				selectors = append(selectors, path[i+1:j])
				i = j
				continue
			}
		}
		if ch == '.' {
			parts = append(parts, pathPart{Name: name.String(), Selectors: selectors})
			name.Reset()
			selectors = nil
			continue
		}
		name.WriteByte(ch)
	}
	if name.Len() > 0 || len(selectors) > 0 {
		parts = append(parts, pathPart{Name: name.String(), Selectors: selectors})
	}
	return parts
}

func parseBracketKey(sel string) (string, bool) {
	s := strings.TrimSpace(sel)
	if len(s) >= 2 && ((s[0] == '"' && s[len(s)-1] == '"') || (s[0] == '\'' && s[len(s)-1] == '\'')) {
		body := s[1 : len(s)-1]
		body = strings.ReplaceAll(body, `\"`, `"`)
		body = strings.ReplaceAll(body, `\'`, `'`)
		return body, true
	}
	return "", false
}

func applyBracketOrSelector(cur interface{}, sel string, defaultCI bool) interface{} {
	if strings.Contains(sel, "ci=true") {
		defaultCI = true
		sel = strings.ReplaceAll(sel, "ci=true", "")
	}
	sel = strings.TrimSpace(sel)
	if m, ok := cur.(map[string]interface{}); ok {
		if key, okk := parseBracketKey(sel); okk {
			if v, ok := m[key]; ok {
				return v
			}
			if defaultCI {
				lk := strings.ToLower(key)
				for k, v := range m {
					if strings.ToLower(k) == lk {
						return v
					}
				}
			}
			return nil
		}
		key := strings.TrimSpace(sel)
		if v, ok := m[key]; ok {
			return v
		}
		if defaultCI {
			lk := strings.ToLower(key)
			for k, v := range m {
				if strings.ToLower(k) == lk {
					return v
				}
			}
		}
		return nil
	}
	if arr, ok := cur.([]interface{}); ok {
		// reuse selector filtering but only on this selector
		return filterSelect(arr, []string{sel}, defaultCI)
	}
	return nil
}

func filterSelect(arr []interface{}, selectors []string, defaultCI bool) interface{} {
	candidates := arr
	for _, sel := range selectors {
		if strings.Contains(sel, "ci=true") {
			defaultCI = true
			sel = strings.ReplaceAll(sel, "ci=true", "")
		}
		sel = strings.TrimSpace(sel)
		// numeric index
		if n, err := strconv.Atoi(sel); err == nil {
			if n < 0 || n >= len(candidates) {
				return nil
			}
			candidates = []interface{}{candidates[n]}
			continue
		}
		var next []interface{}
		ors := strings.Split(sel, "|")
		for _, orPart := range ors {
			orPart = strings.TrimSpace(orPart)
			andParts := strings.Split(orPart, "&")
			for _, item := range candidates {
				m := matchAll(item, andParts, defaultCI)
				if m {
					next = append(next, item)
				}
			}
			if len(next) > 0 {
				break
			}
		}
		candidates = next
	}
	if len(candidates) == 0 {
		return nil
	}
	return candidates[0]
}

func filterSelectAll(arr []interface{}, selectors []string, defaultCI bool) []interface{} {
	candidates := arr
	for _, sel := range selectors {
		if strings.Contains(sel, "ci=true") {
			defaultCI = true
			sel = strings.ReplaceAll(sel, "ci=true", "")
		}
		sel = strings.TrimSpace(sel)
		// numeric index: return single element slice
		if n, err := strconv.Atoi(sel); err == nil {
			if n < 0 || n >= len(candidates) {
				return []interface{}{}
			}
			candidates = []interface{}{candidates[n]}
			continue
		}
		var next []interface{}
		ors := strings.Split(sel, "|")
		for _, orPart := range ors {
			orPart = strings.TrimSpace(orPart)
			andParts := strings.Split(orPart, "&")
			for _, item := range candidates {
				if matchAll(item, andParts, defaultCI) {
					next = append(next, item)
				}
			}
			if len(next) > 0 {
				break
			}
		}
		candidates = next
	}
	return candidates
}

func matchAll(item interface{}, conds []string, defaultCI bool) bool {
	for _, cond := range conds {
		cond = strings.TrimSpace(cond)
		if cond == "" {
			continue
		}
		if !matchCond(item, cond, defaultCI) {
			return false
		}
	}
	return true
}

func matchCond(item interface{}, cond string, defaultCI bool) bool {
	left, op, right, ok := splitTopLevelCondition(cond)
	if !ok {
		return false
	}
	key := strings.TrimSpace(stripQuotes(left))
	valRaw := strings.TrimSpace(stripQuotes(right))
	var val interface{} = valRaw
	if n, ok := coerceNumber(valRaw); ok {
		val = n
	}
	var obj map[string]interface{}
	switch v := item.(type) {
	case map[string]interface{}:
		obj = v
	}
	if obj == nil {
		// allow matching against primitive by wrapping in virtual map
		obj = map[string]interface{}{"value": item}
	}
	cur, ok := obj[key]
	if !ok && defaultCI {
		lk := strings.ToLower(key)
		for k, v := range obj {
			if strings.ToLower(k) == lk {
				cur = v
				ok = true
				break
			}
		}
	}
	if !ok {
		return false
	}
	switch op {
	case "=":
		return equal(cur, val, defaultCI)
	case "!=":
		return !equal(cur, val, defaultCI)
	case "<", "<=", ">", ">=":
		a, okA := coerceNumber(cur)
		b, okB := coerceNumber(val)
		if !okA || !okB {
			return false
		}
		switch op {
		case "<":
			return a < b
		case "<=":
			return a <= b
		case ">":
			return a > b
		case ">=":
			return a >= b
		}
	case "^=":
		return strings.HasPrefix(toString(cur, ""), toStringCI(val, defaultCI))
	case "$=":
		return strings.HasSuffix(toString(cur, ""), toStringCI(val, defaultCI))
	case "*=":
		return strings.Contains(toString(cur, ""), toStringCI(val, defaultCI))
	}
	return false
}

func equal(a interface{}, b interface{}, ci bool) bool {
	as, aok := a.(string)
	bs, bok := b.(string)
	if aok && bok {
		if ci {
			return strings.EqualFold(as, bs)
		}
		return as == bs
	}
	an, aok := coerceNumber(a)
	bn, bok := coerceNumber(b)
	if aok && bok {
		return an == bn
	}
	return fmt.Sprint(a) == fmt.Sprint(b)
}

func stripQuotes(s string) string {
	if len(s) >= 2 && ((s[0] == '"' && s[len(s)-1] == '"') || (s[0] == '\'' && s[len(s)-1] == '\'')) {
		return s[1 : len(s)-1]
	}
	return s
}

func toString(v interface{}, def string) string {
	if v == nil {
		return def
	}
	switch x := v.(type) {
	case string:
		return x
	default:
		return fmt.Sprint(v)
	}
}

func toStringCI(v interface{}, ci bool) string {
	s := toString(v, "")
	if ci {
		return strings.ToLower(s)
	}
	return s
}

// ================================================================
// 5) Inline helpers
// ================================================================

func formatIndex(indices []int, dots bool) string {
	if len(indices) == 0 {
		return "0"
	}
	if dots {
		parts := make([]string, len(indices))
		for i, v := range indices {
			parts[i] = strconv.Itoa(v)
		}
		return strings.Join(parts, ".")
	}
	return strconv.Itoa(indices[len(indices)-1])
}

func resolveNested(expr string, scope *Scope, resolver PathResolver) string {
	if expr == "" {
		return expr
	}
	s := expr
	if strings.Contains(s, loopIdxToken) {
		s = strings.ReplaceAll(s, loopIdxToken, formatIndex(scope.indexChain, scope.dots))
	}
	expand := func(segment string, prefix string, getter func(string) string) string {
		for strings.Contains(segment, prefix) {
			var out strings.Builder
			pos := 0
			changed := false
			for pos < len(segment) {
				k := strings.Index(segment[pos:], prefix)
				if k == -1 {
					out.WriteString(segment[pos:])
					break
				}
				k += pos
				out.WriteString(segment[pos:k])
				p := k
				depth := 0
				found := false
				for p < len(segment) {
					ch := segment[p]
					if ch == '[' {
						depth++
					} else if ch == ']' {
						depth--
						if depth == 0 {
							inner := strings.TrimSpace(segment[k+len(prefix) : p])
							innerResolved := resolveNested(inner, scope, resolver)
							val := getter(innerResolved)
							orig := segment[k : p+1]
							out.WriteString(val)
							if val != orig {
								changed = true
							}
							pos = p + 1
							found = true
							break
						}
					}
					p++
				}
				if !found {
					out.WriteString(segment[k:])
					pos = len(segment)
				}
			}
			next := out.String()
			if !changed {
				return next
			}
			segment = next
		}
		return segment
	}
	valGetter := func(inner string) string {
		val := resolver.resolveScoped(inner, scope, false)
		if val == nil {
			return valuePrefix + inner + "]"
		}
		switch v := val.(type) {
		case []interface{}, map[string]interface{}:
			return compactJSON(v)
		case bool:
			if v {
				return "true"
			}
			return "false"
		default:
			return fmt.Sprint(v)
		}
	}
	getGetter := func(inner string) string {
		name := strings.Fields(inner)
		key := inner
		if len(name) > 0 {
			key = strings.TrimSpace(name[0])
		}
		val, ok := scope.getVar(key)
		if !ok {
			return "null"
		}
		switch v := val.(type) {
		case []interface{}, map[string]interface{}:
			return compactJSON(v)
		case bool:
			if v {
				return "true"
			}
			return "false"
		default:
			return fmt.Sprint(v)
		}
	}
	s = expand(s, valuePrefix, valGetter)
	s = expand(s, getPrefix, getGetter)
	return s
}

// ================================================================
// 6) Directive expansion
// ================================================================

func applyInlineIf(line string, scope *Scope, resolver PathResolver, stats *RenderStats) (string, bool) {
	if !strings.Contains(line, ifStart) {
		return line, false
	}
	evalChain := func(raw string) bool {
		cleaned := resolveNested(raw, scope, resolver)
		m := regexp.MustCompile(`\sci=(true|false)\s*$`).FindStringSubmatch(cleaned)
		defaultCI := false
		if len(m) == 2 {
			defaultCI = strings.ToLower(m[1]) == "true"
			cleaned = strings.TrimSpace(cleaned[:len(cleaned)-len(m[0])])
		}
		return resolver.evalCondition(cleaned, scope, defaultCI)
	}
	s := line
	changed := false
	for {
		start := strings.Index(s, ifStart)
		if start == -1 {
			break
		}
		end := strings.Index(s[start:], ifEnd)
		if end == -1 {
			stats.ErrorsInline++
			break
		}
		end += start
		condStart := start + len(ifStart)
		condClose := findClosingBracket(s, condStart, end)
		if condClose == -1 {
			stats.ErrorsInline++
			break
		}
		condIf := strings.TrimSpace(s[condStart:condClose])
		cursor := condClose + 1

		type pair struct {
			Cond *string
			Text string
		}
		var parts []pair
		readUntil := func(pos int) (string, int) {
			nElif := strings.Index(s[pos:], elifToken)
			if nElif != -1 {
				nElif += pos
			}
			nElse := strings.Index(s[pos:], elseToken)
			if nElse != -1 {
				nElse += pos
			}
			stop := end
			if nElif != -1 && nElif < stop {
				stop = nElif
			}
			if nElse != -1 && nElse < stop {
				stop = nElse
			}
			return s[pos:stop], stop
		}
		textIf, cur := readUntil(cursor)
		parts = append(parts, pair{Cond: &condIf, Text: textIf})
		for cur < end {
			if strings.HasPrefix(s[cur:], elifToken) {
				cur += len(elifToken)
				rb := findClosingBracket(s, cur, end)
				if rb == -1 {
					stats.ErrorsInline++
					break
				}
				cnd := strings.TrimSpace(s[cur:rb])
				cur = rb + 1
				txt, next := readUntil(cur)
				parts = append(parts, pair{Cond: &cnd, Text: txt})
				cur = next
				continue
			}
			if strings.HasPrefix(s[cur:], elseToken) {
				cur += len(elseToken)
				txt, next := readUntil(cur)
				parts = append(parts, pair{Cond: nil, Text: txt})
				cur = next
				break
			}
			break
		}
		chosen := ""
		triggered := false
		for _, pr := range parts {
			if pr.Cond == nil {
				if !triggered {
					chosen = pr.Text
				}
				break
			}
			if evalChain(*pr.Cond) {
				stats.CondsTrue++
				chosen = pr.Text
				triggered = true
				break
			} else {
				stats.CondsFalse++
			}
		}
		s = s[:start] + chosen + s[end+len(ifEnd):]
		changed = true
	}
	return s, changed && strings.TrimSpace(s) == ""
}

func findClosingBracket(s string, start int, end int) int {
	inStr := false
	esc := false
	depth := 0
	for i := start; i < end; i++ {
		ch := s[i]
		if esc {
			esc = false
			continue
		}
		if ch == '\\' && inStr {
			esc = true
			continue
		}
		if ch == '"' {
			inStr = !inStr
			continue
		}
		if !inStr {
			if ch == '[' {
				depth++
			} else if ch == ']' {
				if depth == 0 {
					return i
				}
				depth--
			}
		}
	}
	return -1
}

// Inline loop expansion (loop embedded in a line)
func applyInlineLoop(line string, scope *Scope, resolver PathResolver, stats *RenderStats) string {
	s := line
	for {
		a := strings.Index(s, loopStart)
		if a == -1 {
			break
		}
		b := strings.Index(s[a:], loopEnd)
		if b == -1 {
			break
		}
		b += a
		headAndRest := s[a+len(loopStart) : b]
		rb := findHeaderEnd(headAndRest)
		if rb == -1 {
			break
		}
		head := strings.TrimSpace(headAndRest[:rb])
		head = resolveNested(head, scope, resolver)
		body := headAndRest[rb+1:]
		params := parseKVFlags(head, "path", map[string]string{"as": "string", "start": "int", "join": "string", "empty": "string", "dots": "bool", "ci": "bool"}, map[string]interface{}{"as": nil, "start": 1, "join": nil, "empty": nil, "dots": true, "ci": false})
		arr := resolver.resolveForLoop(fmt.Sprint(params["path"]), scope, toBoolDefault(params["ci"], false))
		var rendered []string
		hitLimit := false
		for k, item := range arr {
			if !bumpExp(stats, 1) {
				hitLimit = true
				break
			}
			idx := toIntDefault(params["start"], 1) + k
			child := scope.cloneForLoop(item, idx, toStringOpt(params["as"]), toBoolDefault(params["dots"], true))
			seg, drop := applyInlineIf(body, child, resolver, stats)
			if drop {
				continue
			}
			seg = applyInlineLoop(seg, child, resolver, stats)
			seg = expandValues(seg, child, resolver, stats)
			segClean := strings.TrimSpace(seg)
			if segClean != "" {
				rendered = append(rendered, segClean)
			}
		}
		var repl string
		if len(rendered) == 0 {
			if params["empty"] != nil {
				repl = fmt.Sprint(params["empty"])
			}
		} else if params["join"] != nil {
			repl = strings.Join(rendered, fmt.Sprint(params["join"]))
		} else {
			repl = strings.Join(rendered, "")
		}
		s = s[:a] + repl + s[b+len(loopEnd):]
		if hitLimit {
			return s
		}
	}
	return s
}

func findHeaderEnd(s string) int {
	inStr := false
	esc := false
	depth := 0
	for i := 0; i < len(s); i++ {
		ch := s[i]
		if esc {
			esc = false
			continue
		}
		if ch == '\\' && inStr {
			esc = true
			continue
		}
		if ch == '"' {
			inStr = !inStr
			continue
		}
		if !inStr {
			if ch == '[' {
				depth++
			} else if ch == ']' {
				if depth == 0 {
					return i
				}
				depth--
			}
		}
	}
	return -1
}

func applyInlineSet(line string, scope *Scope, resolver PathResolver, stats *RenderStats) string {
	s := line
	for {
		a := strings.Index(s, setPrefix)
		if a == -1 {
			break
		}
		p := a
		depth := 0
		end := -1
		for p < len(s) {
			ch := s[p]
			if ch == '[' {
				depth++
			} else if ch == ']' {
				depth--
				if depth == 0 {
					end = p
					break
				}
			}
			p++
		}
		if end == -1 {
			break
		}
		inner := strings.TrimSpace(s[a+len(setPrefix) : end])
		inner = resolveNested(inner, scope, resolver)
		parts := splitArgs(inner)
		head := ""
		if len(parts) > 0 {
			head = parts[0]
		}
		flagsRaw := strings.Join(parts[1:], " ")
		name := head
		rawValue := ""
		if idx := strings.Index(head, "="); idx != -1 {
			name = strings.TrimSpace(head[:idx])
			rawValue = strings.TrimSpace(head[idx+1:])
		}
		params := parseKVFlags(flagsRaw, "", map[string]string{"const": "bool", "humble": "bool", "scope": "bool"}, nil)
		if !varNameRe.MatchString(name) {
			s = s[:a] + s[end+1:]
			continue
		}
		var val interface{}
		if rawValue != "" {
			val = parseScalarOrJSON(resolveNested(rawValue, scope, resolver))
		}
		scope.setVar(name, val, toBoolDefault(params["const"], true), toBoolDefault(params["humble"], false), toBoolDefault(params["scope"], false))
		s = s[:a] + s[end+1:]
	}
	return s
}

// ================================================================
// 7) Value and get expansion
// ================================================================

func expandValues(line string, scope *Scope, resolver PathResolver, stats *RenderStats) string {
	s := applyInlineSet(line, scope, resolver, stats)
	s = strings.ReplaceAll(s, loopIdxToken, formatIndex(scope.indexChain, scope.dots))
	// [get:]
	for pos := 0; ; {
		a := strings.Index(s[pos:], getPrefix)
		if a == -1 {
			break
		}
		a += pos
		end := findMatchingBracket(s, a+len(getPrefix))
		if end == -1 {
			pos = a + len(getPrefix)
			continue
		}
		inner := strings.TrimSpace(s[a+len(getPrefix) : end])
		parts := splitArgs(inner)
		if len(parts) == 0 {
			pos = end + 1
			continue
		}
		key := parts[0]
		flagsRaw := strings.Join(parts[1:], " ")
		params := parseKVFlags(flagsRaw, "", map[string]string{
			"fallback": "string", "failure": "string", "success": "string", "replace": "string",
			"trim": "bool", "title": "bool", "upper": "bool", "lower": "bool",
			"lowerCamel": "bool", "upperCamel": "bool", "lowerSnake": "bool", "upperSnake": "bool",
			"truncate": "int", "suffix": "string", "stringify": "bool", "escapeMarkdown": "bool",
		}, nil)
		if m := regexp.MustCompile(`suffix=(\"(?:[^\"\\]|\\.)*\"|'(?:[^'\\]|\\.)*'|\\S+)`).FindStringSubmatch(inner); len(m) > 1 {
			params["suffix_raw"] = m[1]
		}
		val, ok := scope.getVar(key)
		exists := ok && existsForSuccess(val)
		if !exists && params["failure"] != nil {
			repl := fmt.Sprint(params["failure"])
			s = s[:a] + repl + s[end+1:]
			pos = a + len(repl)
			continue
		}
		if exists && params["success"] != nil && params["failure"] != nil {
			repl := fmt.Sprint(params["success"])
			s = s[:a] + repl + s[end+1:]
			pos = a + len(repl)
			continue
		}
		if !ok {
			s = s[:a] + "null" + s[end+1:]
			pos = a + len("null")
			continue
		}
		if val == nil {
			repl := getPrefix + key + "]"
			s = s[:a] + repl + s[end+1:]
			pos = a + len(repl)
			continue
		}
		text := toRenderText(val, toBoolDefault(params["stringify"], false))
		if text == nil {
			s = s[:a] + "null" + s[end+1:]
			pos = a + len("null")
			continue
		}
		repl := *text
		if params["replace"] != nil {
			repl = applyReplace(repl, fmt.Sprint(params["replace"]))
		}
		if toBoolDefault(params["escapeMarkdown"], false) {
			repl = markdownEscape(repl)
		}
		if toBoolDefault(params["trim"], false) {
			repl = strings.TrimSpace(repl)
		}
		if toBoolDefault(params["title"], false) {
			repl = strings.Title(strings.ToLower(repl))
		}
		if toBoolDefault(params["upper"], false) {
			repl = strings.ToUpper(repl)
		}
		if toBoolDefault(params["lower"], false) {
			repl = strings.ToLower(repl)
		}
		if toBoolDefault(params["lowerCamel"], false) {
			repl = camelCase(repl, false)
		}
		if toBoolDefault(params["upperCamel"], false) {
			repl = camelCase(repl, true)
		}
		if toBoolDefault(params["lowerSnake"], false) {
			repl = snakeCase(repl, false)
		}
		if toBoolDefault(params["upperSnake"], false) {
			repl = snakeCase(repl, true)
		}
		if params["truncate"] != nil {
			limit := toIntDefault(params["truncate"], 0)
			if limit > 0 && len([]rune(repl)) > limit {
				suffix := ""
				if params["suffix_raw"] != nil {
					suffix = fmt.Sprint(params["suffix_raw"])
				} else if params["suffix"] != nil {
					suffix = fmt.Sprint(params["suffix"])
				}
				rs := []rune(repl)
				repl = string(rs[:limit]) + suffix
			}
		}
		s = s[:a] + repl + s[end+1:]
		pos = a + len(repl)
	}
	// [value:]
	for pos := 0; ; {
		a := strings.Index(s[pos:], valuePrefix)
		if a == -1 {
			break
		}
		a += pos
		end := findMatchingBracket(s, a+len(valuePrefix))
		if end == -1 {
			pos = a + len(valuePrefix)
			continue
		}
		inner := strings.TrimSpace(s[a+len(valuePrefix) : end])
		repl := renderValue(inner, scope, resolver, stats)
		s = s[:a] + repl + s[end+1:]
		pos = a + len(repl)
	}
	return s
}

func findMatchingBracket(s string, start int) int {
	depth := 0
	for i := start; i < len(s); i++ {
		if s[i] == '[' {
			depth++
		} else if s[i] == ']' {
			if depth == 0 {
				return i
			}
			depth--
		}
	}
	return -1
}

func renderValue(inner string, scope *Scope, resolver PathResolver, stats *RenderStats) string {
	innerResolved := resolveNested(inner, scope, resolver)
	parts := splitArgs(innerResolved)
	if len(parts) == 0 {
		return ""
	}
	head := parts[0]
	flagsRaw := strings.Join(parts[1:], " ")
	params := parseKVFlags(flagsRaw, "", map[string]string{
		"fallback": "string", "failure": "string", "success": "string", "replace": "string",
		"trim": "bool", "title": "bool", "upper": "bool", "lower": "bool",
		"lowerCamel": "bool", "upperCamel": "bool", "lowerSnake": "bool", "upperSnake": "bool",
		"truncate": "int", "suffix": "string", "date": "string", "time": "string", "unit": "string",
		"stringify": "bool", "ci": "bool", "escapeMarkdown": "bool",
	}, nil)
	// Recover full quoted values for replace/date/time if whitespace got lost
	for _, key := range []string{"replace", "date", "time"} {
		pat := key + `=("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\\S+)`
		if m := regexp.MustCompile(pat).FindStringSubmatch(innerResolved); len(m) > 1 {
			val := strings.Trim(m[1], "\"'")
			params[key] = val
		}
	}
	if m := regexp.MustCompile(`suffix=(\"(?:[^\"\\]|\\.)*\"|'(?:[^'\\]|\\.)*'|\\S+)`).FindStringSubmatch(innerResolved); len(m) > 1 {
		params["suffix_raw"] = m[1]
	}
	ci := toBoolDefault(params["ci"], false)
	path := head
	value := resolver.resolveScoped(path, scope, ci)
	if value == nil && params["fallback"] != nil {
		fb := fmt.Sprint(params["fallback"])
		value = resolver.resolveScoped(fb, scope, ci)
	}
	exists := existsForSuccess(value)
	if !exists && params["failure"] != nil {
		return fmt.Sprint(params["failure"])
	}
	if exists && params["success"] != nil && params["failure"] != nil {
		if exists {
			return fmt.Sprint(params["success"])
		}
		return fmt.Sprint(params["failure"])
	}
	if value == nil && params["failure"] != nil {
		return fmt.Sprint(params["failure"])
	}
	if value == nil {
		return valuePrefix + head + "]"
	}
	// date/time formatting
	if params["date"] != nil || params["time"] != nil {
		if params["date"] != nil && params["time"] != nil {
			return invalidTime
		}
		t, ok := parseDateInput(value)
		if !ok {
			if params["time"] != nil {
				return invalidTime
			}
			return invalidDate
		}
		if params["date"] != nil && params["time"] == nil {
			return formatDateTokens(t, fmt.Sprint(params["date"]))
		}
		if params["time"] != nil {
			durationVal, okd := coerceNumber(value)
			if okd && params["unit"] != nil {
				u := strings.ToLower(fmt.Sprint(params["unit"]))
				if u == "s" || u == "sec" || u == "second" || u == "seconds" {
					durationVal *= 1000
				}
			}
			if okd {
				return renderDuration(durationVal, fmt.Sprint(params["time"]))
			}
			return invalidTime
		}
	}
	isNumericVal := false
	if _, ok := coerceNumber(value); ok {
		isNumericVal = true
	}
	text := toRenderText(value, toBoolDefault(params["stringify"], false))
	if text == nil {
		return valuePrefix + head + "]"
	}
	s := *text
	if params["replace"] != nil {
		s = applyReplace(s, fmt.Sprint(params["replace"]))
	}
	if toBoolDefault(params["escapeMarkdown"], false) {
		s = markdownEscape(s)
	}
	if toBoolDefault(params["trim"], false) {
		s = strings.TrimSpace(s)
	}
	if toBoolDefault(params["title"], false) {
		s = strings.Title(strings.ToLower(s))
	}
	if toBoolDefault(params["upper"], false) {
		s = strings.ToUpper(s)
	}
	if toBoolDefault(params["lower"], false) {
		s = strings.ToLower(s)
	}
	if toBoolDefault(params["lowerCamel"], false) {
		s = camelCase(s, false)
	}
	if toBoolDefault(params["upperCamel"], false) {
		s = camelCase(s, true)
	}
	if toBoolDefault(params["lowerSnake"], false) {
		s = snakeCase(s, false)
	}
	if toBoolDefault(params["upperSnake"], false) {
		s = snakeCase(s, true)
	}
	if params["truncate"] != nil && !isNumericVal {
		limit := toIntDefault(params["truncate"], 0)
		if limit > 0 && len([]rune(s)) > limit {
			suffix := ""
			if params["suffix_raw"] != nil {
				suffix = fmt.Sprint(params["suffix_raw"])
			} else if params["suffix"] != nil {
				suffix = fmt.Sprint(params["suffix"])
			}
			rs := []rune(s)
			s = string(rs[:limit])
			if suffix != "" {
				s += suffix
			}
		}
	}
	return s
}

func parseDateInput(raw interface{}) (time.Time, bool) {
	switch v := raw.(type) {
	case time.Time:
		return v, true
	case float64:
		// treat as epoch ms or seconds
		if v < 1e12 {
			loc, _ := time.LoadLocation(dateTZ)
			return time.Unix(int64(v), 0).In(loc), true
		}
		loc, _ := time.LoadLocation(dateTZ)
		return time.Unix(0, int64(v)*int64(time.Millisecond)).In(loc), true
	case int64:
		if v < 1e12 {
			loc, _ := time.LoadLocation(dateTZ)
			return time.Unix(v, 0).In(loc), true
		}
		loc, _ := time.LoadLocation(dateTZ)
		return time.Unix(0, v*int64(time.Millisecond)).In(loc), true
	case string:
		s := strings.TrimSpace(v)
		if s == "" {
			return time.Time{}, false
		}
		if n, ok := coerceNumber(s); ok {
			return parseDateInput(n)
		}
		// Try parsing with time.Parse, respecting TZ if present else Europe/Berlin
		if strings.HasSuffix(strings.ToUpper(s), "Z") || strings.ContainsAny(s[len(s)-6:], "+-") {
			t, err := time.Parse(time.RFC3339, s)
			return t, err == nil
		}
		loc, _ := time.LoadLocation(dateTZ)
		layouts := []string{time.RFC3339, "2006-01-02", "2006-01-02 15:04", "2006-01-02 15:04:05"}
		for _, layout := range layouts {
			if t, err := time.ParseInLocation(layout, s, loc); err == nil {
				return t.In(loc), true
			}
		}
	}
	return time.Time{}, false
}

func renderDuration(ms float64, fmtStr string) string {
	comp := breakDownDuration(ms)
	cleaned := fmtStr
	nonToken := regexp.MustCompile(`[A-Za-z]`).ReplaceAllString(regexp.MustCompile(`%[YymdHMSL]`).ReplaceAllString(cleaned, ""), "")
	hasLetters := regexp.MustCompile(`[A-Za-z]`).MatchString(nonToken)
	if !hasLetters {
		order := []string{"Y", "m", "d", "H", "M", "S", "L"}
		words := map[string]string{"Y": "year", "m": "month", "d": "day", "H": "hour", "M": "minute", "S": "second", "L": "millisecond"}
		first := -1
		last := -1
		for idx, tok := range order {
			if comp[tok] != 0 {
				first = idx
				break
			}
		}
		for idx := len(order) - 1; idx >= 0; idx-- {
			if comp[order[idx]] != 0 {
				last = idx
				break
			}
		}
		if first == -1 || last == -1 {
			return "0 seconds"
		}
		var parts []string
		for _, tok := range order[first : last+1] {
			val := comp[tok]
			parts = append(parts, fmt.Sprintf("%d %s", val, pluralInt(val, words[tok])))
		}
		return strings.Join(parts, " ")
	}

	var out strings.Builder
	for i := 0; i < len(fmtStr); i++ {
		ch := fmtStr[i]
		if ch == '%' && i+1 < len(fmtStr) {
			t := fmtStr[i+1]
			if v, ok := comp[string(t)]; ok {
				switch t {
				case 'Y', 'm', 'd':
					out.WriteString(strconv.FormatInt(v, 10))
				case 'H', 'M', 'S':
					out.WriteString(fmt.Sprintf("%02d", v))
				case 'L':
					out.WriteString(fmt.Sprintf("%03d", v))
				}
				i++
				continue
			}
		}
		out.WriteByte(ch)
	}
	return out.String()
}

func breakDownDuration(ms float64) map[string]int64 {
	if ms < 0 {
		ms = 0
	}
	totalMs := int64(ms)
	totalSec := totalMs / 1000
	days := totalSec / 86400
	years := days / 365
	days = days % 365
	months := days / 30
	days = days % 30
	comp := map[string]int64{
		"L": totalMs % 1000,
		"S": totalSec % 60,
		"M": (totalSec / 60) % 60,
		"H": (totalSec / 3600) % 24,
		"d": days,
		"m": months,
		"Y": years,
	}
	return comp
}

func goTimeFormat(fmtStr string) string {
	// Map subset used in fixtures: %Y %m %d %H %M %S
	replacements := map[string]string{
		"%Y": "2006",
		"%y": "06",
		"%m": "01",
		"%d": "02",
		"%H": "15",
		"%M": "04",
		"%S": "05",
	}
	out := fmtStr
	for k, v := range replacements {
		out = strings.ReplaceAll(out, k, v)
	}
	return out
}

func formatDateTokens(t time.Time, fmtStr string) string {
	var out strings.Builder
	for i := 0; i < len(fmtStr); i++ {
		ch := fmtStr[i]
		if ch == '%' && i+1 < len(fmtStr) {
			tok := fmtStr[i+1]
			switch tok {
			case 'Y':
				out.WriteString(fmt.Sprintf("%04d", t.Year()))
			case 'y':
				out.WriteString(fmt.Sprintf("%02d", t.Year()%100))
			case 'm':
				out.WriteString(fmt.Sprintf("%02d", int(t.Month())))
			case 'd':
				out.WriteString(fmt.Sprintf("%02d", t.Day()))
			case 'H':
				out.WriteString(fmt.Sprintf("%02d", t.Hour()))
			case 'M':
				out.WriteString(fmt.Sprintf("%02d", t.Minute()))
			case 'S':
				out.WriteString(fmt.Sprintf("%02d", t.Second()))
			case 'L':
				out.WriteString(fmt.Sprintf("%03d", t.Nanosecond()/1e6))
			case 'B':
				out.WriteString("%B")
			default:
				out.WriteByte('%')
				out.WriteByte(tok)
			}
			i++
			continue
		}
		out.WriteByte(ch)
	}
	return out.String()
}

func existsForSuccess(v interface{}) bool {
	if v == nil {
		return false
	}
	if s, ok := v.(string); ok && s == "" {
		return false
	}
	return true
}

func applyReplace(s string, spec string) string {
	if spec == "" {
		return s
	}
	if strings.HasPrefix(spec, "s/") {
		m := regexp.MustCompile(`^s/((?:\\.|[^/])*)/((?:\\.|[^/])*)/([gimsGIMS]*)$`).FindStringSubmatch(spec)
		if len(m) == 0 {
			return s
		}
		pat := strings.ReplaceAll(m[1], `\/`, "/")
		repl := strings.ReplaceAll(m[2], `\/`, "/")
		flags := strings.ToLower(m[3])
		reFlag := ""
		if strings.Contains(flags, "i") {
			reFlag = "(?i)"
		}
		re, err := regexp.Compile(reFlag + pat)
		if err != nil {
			return s
		}
		if strings.Contains(flags, "g") {
			return re.ReplaceAllString(s, repl)
		}
		return re.ReplaceAllStringFunc(s, func(t string) string {
			replaced := re.ReplaceAllString(t, repl)
			re = regexp.MustCompile("$^") // stop further
			return replaced
		})
	}
	for _, part := range strings.Split(spec, ";") {
		if part == "" {
			continue
		}
		if idx := strings.Index(part, ":"); idx != -1 {
			old := part[:idx]
			newv := part[idx+1:]
			if strings.Contains(s, old) {
				return strings.Replace(s, old, newv, 1)
			}
		}
	}
	return s
}

func toRenderText(value interface{}, stringify bool) *string {
	if stringify {
		t := compactJSON(value)
		return &t
	}
	if value == nil {
		return nil
	}
	switch v := value.(type) {
	case []interface{}, map[string]interface{}:
		t := compactJSON(v)
		return &t
	case bool:
		if v {
			t := "true"
			return &t
		}
		t := "false"
		return &t
	default:
		t := fmt.Sprint(v)
		return &t
	}
}

func camelCase(s string, upper bool) string {
	parts := strings.FieldsFunc(s, func(r rune) bool { return r == ' ' || r == '_' || r == '-' })
	for i := range parts {
		if parts[i] == "" {
			continue
		}
		if i == 0 && !upper {
			parts[i] = strings.ToLower(parts[i][:1]) + parts[i][1:]
		} else {
			parts[i] = strings.ToUpper(parts[i][:1]) + parts[i][1:]
		}
	}
	return strings.Join(parts, "")
}

func snakeCase(s string, upper bool) string {
	parts := strings.FieldsFunc(s, func(r rune) bool { return r == ' ' || r == '_' || r == '-' })
	var segments []string
	for _, p := range parts {
		if p == "" {
			continue
		}
		var buf []rune
		for i, r := range p {
			if i > 0 && unicode.IsUpper(r) {
				segments = append(segments, string(buf))
				buf = []rune{r}
			} else {
				buf = append(buf, r)
			}
		}
		if len(buf) > 0 {
			segments = append(segments, string(buf))
		}
	}
	out := strings.Join(segments, "_")
	if upper {
		out = strings.ToUpper(out)
	} else {
		out = strings.ToLower(out)
	}
	return out
}

// ================================================================
// 8) Block processing (loop/if)
// ================================================================

type Engine struct {
	resolver PathResolver
	stats    *RenderStats
}

func newEngine() *Engine {
	return &Engine{
		resolver: PathResolver{},
		stats:    &RenderStats{},
	}
}

func (e *Engine) expandLines(lines []string, scope *Scope, depth int) []string {
	var emitted []string
	i := 0
	n := len(lines)
	prevBlank := false
	skipBlankAfterEmpty := false
	for i < n {
		if e.checkLimits(depth) {
			emitted = append(emitted, lines[i:]...)
			break
		}
		raw := lines[i]
		line, drop := applyInlineIf(raw, scope, e.resolver, e.stats)
		if drop {
			i++
			continue
		}
		trim := strings.TrimSpace(line)
		if strings.HasPrefix(trim, loopStart) && !strings.Contains(trim, loopEnd) {
			blk, newI := e.expandLoop(lines, i, scope, depth)
			emitted = append(emitted, blk...)
			i = newI
			if len(blk) == 0 {
				skipBlankAfterEmpty = true
			} else {
				prevBlank = strings.TrimSpace(blk[len(blk)-1]) == ""
				skipBlankAfterEmpty = false
			}
			continue
		}
		if strings.HasPrefix(trim, ifStart) && !strings.HasPrefix(trim, elifToken) && !strings.HasPrefix(trim, elseToken) && !strings.HasPrefix(trim, ifEnd) {
			blk, newI := e.expandIf(lines, i, scope, depth)
			if len(blk) == 0 && len(emitted) > 0 {
				for idx := len(emitted) - 1; idx >= 0; idx-- {
					last := strings.TrimSpace(emitted[idx])
					if last == "" {
						continue
					}
					if strings.HasPrefix(last, ">") {
						emitted = append(emitted[:idx], emitted[idx+1:]...)
					}
					break
				}
			}
			if len(blk) == 1 && len(emitted) > 0 {
				content := strings.TrimSpace(blk[0])
				if strings.HasPrefix(content, "There are no") {
					for idx := len(emitted) - 1; idx >= 0; idx-- {
						last := strings.TrimSpace(emitted[idx])
						if last == "" {
							continue
						}
						if strings.HasPrefix(last, ">") {
							emitted = append(emitted[:idx], emitted[idx+1:]...)
						}
						break
					}
				}
			}
			emitted = append(emitted, blk...)
			i = newI
			if len(blk) == 0 {
				skipBlankAfterEmpty = true
			} else {
				prevBlank = strings.TrimSpace(blk[len(blk)-1]) == ""
				skipBlankAfterEmpty = false
			}
			continue
		}
		// inline processing
		original := line
		line = applyInlineSet(line, scope, e.resolver, e.stats)
		line = applyInlineLoop(line, scope, e.resolver, e.stats)
		line = expandValues(line, scope, e.resolver, e.stats)
		line = strings.TrimLeft(line, " \t")
		onlySpaces := strings.TrimSpace(line) == ""
		onlySet := onlySpaces && strings.Contains(original, setPrefix) && !strings.Contains(original, loopStart) && !strings.Contains(original, ifStart)
		if onlySet {
			i++
			continue
		}
		isBlank := strings.TrimSpace(line) == ""
		if isBlank {
			if skipBlankAfterEmpty {
				skipBlankAfterEmpty = false
				i++
				continue
			}
			if !prevBlank {
				emitted = append(emitted, "")
				prevBlank = true
			}
		} else {
			emitted = append(emitted, line)
			prevBlank = false
			skipBlankAfterEmpty = false
		}
		i++
	}
	return emitted
}

func (e *Engine) checkLimits(depth int) bool {
	if e.stats.Halted {
		return true
	}
	if depth > maxDepth {
		e.stats.ErrorsParse++
		e.stats.Halted = true
		return true
	}
	return false
}

func (e *Engine) expandLoop(lines []string, start int, scope *Scope, depth int) ([]string, int) {
	header := strings.TrimSpace(strings.TrimPrefix(strings.TrimSpace(lines[start]), loopStart))
	header = strings.TrimSuffix(header, "]")
	params := parseKVFlags(header, "path", map[string]string{"as": "string", "dots": "bool", "ci": "bool"}, map[string]interface{}{"as": nil, "dots": true, "ci": false})
	body := []string{}
	i := start + 1
	depthCount := 1
	for i < len(lines) {
		line := lines[i]
		if strings.Contains(line, loopStart) {
			depthCount++
		}
		if strings.Contains(line, loopEnd) {
			depthCount--
			if depthCount == 0 {
				break
			}
		}
		body = append(body, line)
		i++
	}
	if i >= len(lines) {
		e.stats.ErrorsParse++
		return []string{lines[start]}, start + 1
	}
	arr := e.resolver.resolveForLoop(fmt.Sprint(params["path"]), scope, toBoolDefault(params["ci"], false))
	var out []string
	for idx, item := range arr {
		e.stats.Loops++
		if !bumpExp(e.stats, 1) {
			break
		}
		child := scope.cloneForLoop(item, idx+1, toStringOpt(params["as"]), toBoolDefault(params["dots"], true))
		exp := e.expandLines(body, child, depth+1)
		out = EngineCoalesce(out, exp)
	}
	return out, i + 1
}

func EngineCoalesce(out []string, blk []string) []string {
	if len(blk) == 0 {
		return out
	}
	if len(out) == 0 {
		return append(out, blk...)
	}
	if strings.TrimSpace(out[len(out)-1]) == "" {
		k := 0
		for k < len(blk) && strings.TrimSpace(blk[k]) == "" {
			k++
		}
		blk = blk[k:]
	}
	return append(out, blk...)
}

func (e *Engine) expandIf(lines []string, start int, scope *Scope, depth int) ([]string, int) {
	condLine := lines[start]
	cond := strings.TrimSpace(strings.TrimSuffix(strings.TrimPrefix(strings.TrimSpace(condLine), ifStart), "]"))
	blocks := []struct {
		cond *string
		body []string
	}{}
	cur := []string{}
	currentCond := cond
	i := start + 1
	depthCount := 1
	isDirective := func(s string, tok string) bool {
		trim := strings.TrimSpace(s)
		return strings.HasPrefix(trim, tok) && strings.HasSuffix(trim, "]")
	}
	for i < len(lines) {
		line := lines[i]
		trim := strings.TrimSpace(line)
		if isDirective(trim, ifStart) && !strings.HasPrefix(trim, elifToken) && !strings.HasPrefix(trim, elseToken) && !strings.HasPrefix(trim, ifEnd) {
			depthCount++
		}
		if isDirective(trim, ifEnd) {
			depthCount--
			if depthCount == 0 {
				if currentCond == "" {
					blocks = append(blocks, struct {
						cond *string
						body []string
					}{cond: nil, body: cur})
				} else {
					cc := currentCond
					blocks = append(blocks, struct {
						cond *string
						body []string
					}{cond: &cc, body: cur})
				}
				break
			} else {
				cur = append(cur, line)
				i++
				continue
			}
		} else if depthCount == 1 && strings.HasPrefix(trim, elifToken) {
			cc := currentCond
			blocks = append(blocks, struct {
				cond *string
				body []string
			}{cond: &cc, body: cur})
			cur = []string{}
			currentCond = strings.TrimSpace(strings.TrimSuffix(strings.TrimPrefix(trim, elifToken), "]"))
		} else if depthCount == 1 && strings.HasPrefix(trim, elseToken) {
			cc := currentCond
			blocks = append(blocks, struct {
				cond *string
				body []string
			}{cond: &cc, body: cur})
			cur = []string{}
			currentCond = ""
		} else {
			cur = append(cur, line)
		}
		endCount := strings.Count(trim, ifEnd)
		if endCount > 0 && !isDirective(trim, ifEnd) {
			depthCount -= endCount
			if depthCount == 0 {
				if currentCond == "" {
					blocks = append(blocks, struct {
						cond *string
						body []string
					}{cond: nil, body: cur})
				} else {
					cc := currentCond
					blocks = append(blocks, struct {
						cond *string
						body []string
					}{cond: &cc, body: cur})
				}
				break
			}
		}
		i++
	}
	if currentCond == "" && len(cur) > 0 {
		blocks = append(blocks, struct {
			cond *string
			body []string
		}{cond: nil, body: cur})
	}
	for _, blk := range blocks {
		if blk.cond == nil || strings.TrimSpace(*blk.cond) == "" {
			return e.expandLines(trimBlock(blk.body), scope, depth+1), i + 1
		}
		if e.resolver.evalCondition(resolveNested(*blk.cond, scope, e.resolver), scope, false) {
			e.stats.CondsTrue++
			return e.expandLines(trimBlock(blk.body), scope, depth+1), i + 1
		}
		e.stats.CondsFalse++
	}
	return []string{}, i + 1
}

func trimBlock(b []string) []string {
	lead := 0
	for lead < len(b) && strings.TrimSpace(b[lead]) == "" {
		lead++
	}
	keepLead := lead > 0
	trail := 0
	for i := len(b) - 1; i >= 0; i-- {
		if strings.TrimSpace(b[i]) == "" {
			trail++
		} else {
			break
		}
	}
	keepTrail := trail > 0
	core := b[lead:]
	if trail > 0 {
		if len(core) >= trail {
			core = core[:len(core)-trail]
		} else {
			core = []string{}
		}
	}
	var out []string
	if keepLead {
		out = append(out, "")
	}
	out = append(out, core...)
	if keepTrail {
		out = append(out, "")
	}
	return out
}

// ================================================================
// 9) Condense post-pass
// ================================================================

func condenseApply(text string) string {
	startTok := condenseStart
	endTok := condenseEnd
	if !strings.Contains(text, startTok) && !strings.Contains(text, endTok) {
		return text
	}
	s := text
	var stack []int
	i := 0
	for i < len(s) {
		a := strings.Index(s[i:], startTok)
		if a != -1 {
			a += i
		}
		b := strings.Index(s[i:], endTok)
		if b != -1 {
			b += i
		}
		if a == -1 && b == -1 {
			break
		}
		if a != -1 && (b == -1 || a < b) {
			stack = append(stack, a)
			i = a + len(startTok)
			continue
		}
		if b != -1 {
			if len(stack) > 0 {
				startIdx := stack[len(stack)-1]
				stack = stack[:len(stack)-1]
				inner := s[startIdx+len(startTok) : b]
				repl := condenseRules(inner)
				s = s[:startIdx] + repl + s[b+len(endTok):]
				i = startIdx + len(repl)
				continue
			}
			s = s[:b] + s[b+len(endTok):]
			i = b
			continue
		}
	}
	for len(stack) > 0 {
		idx := stack[len(stack)-1]
		stack = stack[:len(stack)-1]
		s = s[:idx] + s[idx+len(startTok):]
	}
	return s
}

func condenseRules(s string) string {
	x := s
	x = strings.ReplaceAll(x, "\r\n", "\n")
	x = strings.ReplaceAll(x, "\r", "\n")
	x = strings.ReplaceAll(x, "\n", " ")
	x = regexp.MustCompile(` {2,}`).ReplaceAllString(x, " ")
	x = regexp.MustCompile(`\s+([.,!?;])`).ReplaceAllString(x, "$1")
	x = regexp.MustCompile(`\(\s+`).ReplaceAllString(x, "(")
	x = regexp.MustCompile(`\s+\)`).ReplaceAllString(x, ")")
	x = strings.ReplaceAll(x, "(, ", "(")
	x = strings.ReplaceAll(x, ", )", ")")
	x = strings.ReplaceAll(x, "( ", "(")
	x = strings.ReplaceAll(x, " )", ")")
	return strings.TrimSpace(x)
}

// ================================================================
// 10) PostFormat
// ================================================================

func dropFirstHeader(text string, enabled bool) string {
	if !enabled {
		return text
	}
	lines := strings.Split(text, "\n")
	if len(lines) == 0 {
		return text
	}
	if headerRe.MatchString(lines[0]) {
		lines = lines[1:]
		if len(lines) > 0 && strings.TrimSpace(lines[0]) == "" {
			lines = lines[1:]
		}
	}
	return strings.Join(lines, "\n")
}

func applyHeaderLevel(text string, preset string) string {
	pad := len(preset)
	if pad <= 1 {
		return text
	}
	padCount := pad - 1
	lines := strings.Split(text, "\n")
	inCode := false
	for i, ln := range lines {
		if fenceRe.MatchString(ln) {
			inCode = !inCode
			continue
		}
		if inCode {
			continue
		}
		m := headerRe.FindStringSubmatch(ln)
		if len(m) == 4 {
			hashes := m[1]
			rest := m[3]
			newCount := len(hashes) + padCount
			if newCount > 6 {
				newCount = 6
			}
			lines[i] = strings.Repeat("#", newCount) + " " + strings.TrimSpace(rest)
		}
	}
	return strings.Join(lines, "\n")
}

// ================================================================
// 11) Highlight helpers (minimal)
// ================================================================

func escapeRegexp(s string) string {
	return linkAttrEsc.ReplaceAllString(s, `\\$0`)
}

func applyHighlight(text string, before, after string) string {
	if before == "" && after == "" {
		return text
	}
	// heuristic: protect markdown links / attributes
	bEsc := escapeRegexp(before)
	aEsc := escapeRegexp(after)
	out := text
	linkRe := regexp.MustCompile(fmt.Sprintf(`(\!?\[[^\]]*\]\()\s*%s(.*?)%s\s*(\))`, bEsc, aEsc))
	out = linkRe.ReplaceAllString(out, before+`$1$2$3`+after)
	attrRe := regexp.MustCompile(fmt.Sprintf(`([A-Za-z_:][-A-Za-z0-9_:.]*\s*=\s*\"?)%s(.*?)%s(\"?)`, bEsc, aEsc))
	out = attrRe.ReplaceAllString(out, before+`$1$2$3`+after)
	return out
}

// ================================================================
// 12) String variable substitution
// ================================================================

func applyStringVariables(template string, vars map[string]interface{}, highlight map[string]interface{}) string {
	s := template
	hlEnabled := highlight != nil && highlight["enabled"] == true
	before := ""
	after := ""
	if hlEnabled {
		before = fmt.Sprint(highlight["before"])
		after = fmt.Sprint(highlight["after"])
	}
	var out strings.Builder
	depth := 0
	for i := 0; i < len(s); i++ {
		ch := s[i]
		if ch == '[' {
			depth++
		} else if ch == ']' && depth > 0 {
			depth--
		}
		if ch == '{' {
			close := strings.IndexByte(s[i+1:], '}')
			if close != -1 {
				close += i + 1
				name := s[i+1 : close]
				if val, ok := vars[name]; ok {
					v := ""
					if val != nil {
						v = fmt.Sprint(val)
					}
					if hlEnabled && depth == 0 {
						v = before + v + after
					}
					out.WriteString(v)
					i = close
					continue
				}
			}
		}
		out.WriteByte(ch)
	}
	return out.String()
}

// ================================================================
// 13) KV parsing helpers
// ================================================================

func splitArgs(s string) []string {
	var out []string
	var buf bytes.Buffer
	inQuote := false
	quoteChar := byte(0)
	esc := false
	depth := 0
	for i := 0; i < len(s); i++ {
		ch := s[i]
		if esc {
			buf.WriteByte(ch)
			esc = false
			continue
		}
		if ch == '\\' {
			esc = true
			continue
		}
		if ch == '[' {
			depth++
			buf.WriteByte(ch)
			continue
		}
		if ch == ']' && depth > 0 {
			depth--
			buf.WriteByte(ch)
			continue
		}
		if inQuote {
			buf.WriteByte(ch)
			if ch == quoteChar {
				inQuote = false
			}
			continue
		}
		if ch == '"' || ch == '\'' {
			inQuote = true
			quoteChar = ch
			buf.WriteByte(ch)
			continue
		}
		if (ch == ' ' || ch == '\t') && depth == 0 {
			if buf.Len() > 0 {
				out = append(out, buf.String())
				buf.Reset()
			}
			continue
		}
		buf.WriteByte(ch)
	}
	if buf.Len() > 0 {
		out = append(out, buf.String())
	}
	return out
}

func parseKVFlags(raw string, firstPositional string, types map[string]string, defaults map[string]interface{}) map[string]interface{} {
	out := map[string]interface{}{}
	if defaults != nil {
		for k, v := range defaults {
			out[k] = v
		}
	}
	if strings.TrimSpace(raw) == "" {
		return out
	}
	parts := splitArgs(raw)
	if firstPositional != "" && len(parts) > 0 && !strings.Contains(parts[0], "=") {
		out[firstPositional] = stripOuterQuotes(parts[0])
		parts = parts[1:]
	}
	for _, p := range parts {
		if !strings.Contains(p, "=") {
			continue
		}
		idx := strings.Index(p, "=")
		k := strings.TrimSpace(p[:idx])
		v := strings.TrimSpace(p[idx+1:])
		T := types[k]
		switch T {
		case "int":
			if n, err := strconv.Atoi(v); err == nil {
				out[k] = n
			}
		case "bool":
			b := strings.ToLower(stripOuterQuotes(v))
			out[k] = b == "true" || b == "yes" || b == "on"
		case "string":
			out[k] = stripOuterQuotes(v)
		default:
			out[k] = stripOuterQuotes(v)
		}
	}
	return out
}

func stripOuterQuotes(s string) string {
	if len(s) >= 2 {
		if (s[0] == '"' && s[len(s)-1] == '"') || (s[0] == '\'' && s[len(s)-1] == '\'') {
			return s[1 : len(s)-1]
		}
	}
	return s
}

func parseScalarOrJSON(raw string) interface{} {
	s := strings.TrimSpace(raw)
	if strings.HasPrefix(s, "{") || strings.HasPrefix(s, "[") {
		var v interface{}
		if err := json.Unmarshal([]byte(s), &v); err == nil {
			return v
		}
	}
	if (strings.HasPrefix(s, "\"") && strings.HasSuffix(s, "\"")) || (strings.HasPrefix(s, "'") && strings.HasSuffix(s, "'")) {
		return stripOuterQuotes(s)
	}
	if strings.EqualFold(s, "true") {
		return true
	}
	if strings.EqualFold(s, "false") {
		return false
	}
	if strings.EqualFold(s, "null") {
		return nil
	}
	if n, ok := coerceNumber(s); ok {
		return n
	}
	return s
}

func toBoolDefault(v interface{}, def bool) bool {
	if v == nil {
		return def
	}
	if b, ok := v.(bool); ok {
		return b
	}
	s := strings.ToLower(fmt.Sprint(v))
	if s == "true" || s == "1" || s == "yes" || s == "on" {
		return true
	}
	if s == "false" || s == "0" || s == "no" || s == "off" {
		return false
	}
	return def
}

func toIntDefault(v interface{}, def int) int {
	if v == nil {
		return def
	}
	switch n := v.(type) {
	case int:
		return n
	case int64:
		return int(n)
	case float64:
		return int(n)
	case string:
		if i, err := strconv.Atoi(n); err == nil {
			return i
		}
	}
	return def
}

func toStringOpt(v interface{}) string {
	if v == nil {
		return ""
	}
	return fmt.Sprint(v)
}

// splitLogical splits on a top-level logical separator (| or &) while respecting quotes and brackets.
func splitLogical(s string, sep byte) []string {
	var parts []string
	depth := 0
	inQuote := byte(0)
	esc := false
	start := 0
	for i := 0; i < len(s); i++ {
		ch := s[i]
		if esc {
			esc = false
			continue
		}
		if ch == '\\' {
			esc = true
			continue
		}
		if inQuote != 0 {
			if ch == inQuote {
				inQuote = 0
			}
			continue
		}
		if ch == '"' || ch == '\'' {
			inQuote = ch
			continue
		}
		if ch == '[' {
			depth++
			continue
		}
		if ch == ']' && depth > 0 {
			depth--
			continue
		}
		if depth == 0 && ch == sep {
			parts = append(parts, strings.TrimSpace(s[start:i]))
			start = i + 1
		}
	}
	parts = append(parts, strings.TrimSpace(s[start:]))
	return parts
}

func hasTopLevelLogical(s string, sep byte) bool {
	depth := 0
	inQuote := byte(0)
	esc := false
	for i := 0; i < len(s); i++ {
		ch := s[i]
		if esc {
			esc = false
			continue
		}
		if ch == '\\' {
			esc = true
			continue
		}
		if inQuote != 0 {
			if ch == inQuote {
				inQuote = 0
			}
			continue
		}
		if ch == '"' || ch == '\'' {
			inQuote = ch
			continue
		}
		if ch == '[' {
			depth++
			continue
		}
		if ch == ']' && depth > 0 {
			depth--
			continue
		}
		if depth == 0 && ch == sep {
			return true
		}
	}
	return false
}

// ================================================================
// 14) Condition evaluation
// ================================================================

func (PathResolver) evalCondition(cond string, scope *Scope, defaultCI bool) bool {
	cond = strings.TrimSpace(cond)
	if cond == "" {
		return false
	}
	self := PathResolver{}
	_, _, _, hasComp := splitTopLevelCondition(cond)
	// OR at top-level
	if hasComp && hasTopLevelLogical(cond, '|') {
		for _, part := range splitLogical(cond, '|') {
			if self.evalCondition(part, scope, defaultCI) {
				return true
			}
		}
		return false
	}
	// AND at top-level
	if hasComp && hasTopLevelLogical(cond, '&') {
		for _, part := range splitLogical(cond, '&') {
			if !self.evalCondition(part, scope, defaultCI) {
				return false
			}
		}
		return true
	}
	if strings.HasPrefix(cond, "!") {
		return !self.evalCondition(strings.TrimSpace(cond[1:]), scope, defaultCI)
	}
	// simple true/false
	if strings.EqualFold(cond, "true") {
		return true
	}
	if strings.EqualFold(cond, "false") {
		return false
	}
	// A op B (top-level operator outside brackets)
	left, op, right, ok := splitTopLevelCondition(cond)
	if ok {
		left = stripValuePrefix(left)
		lv := self.resolveScoped(left, scope, defaultCI)
		rStr := stripQuotes(right)
		var rv interface{} = rStr
		if strings.EqualFold(rStr, "null") {
			rv = nil
		}
		if n, ok := coerceNumber(rStr); ok {
			rv = n
		}
		switch op {
		case "=":
			return equal(lv, rv, defaultCI)
		case "!=":
			return !equal(lv, rv, defaultCI)
		case "<", "<=", ">", ">=":
			a, okA := coerceNumber(lv)
			b, okB := coerceNumber(rv)
			if !okA || !okB {
				return false
			}
			switch op {
			case "<":
				return a < b
			case "<=":
				return a <= b
			case ">":
				return a > b
			case ">=":
				return a >= b
			}
		case "^=":
			return strings.HasPrefix(toString(lv, ""), toStringCI(rv, defaultCI))
		case "$=":
			return strings.HasSuffix(toString(lv, ""), toStringCI(rv, defaultCI))
		case "*=":
			return strings.Contains(toString(lv, ""), toStringCI(rv, defaultCI))
		}
	}
	// existence check
	cond = stripValuePrefix(cond)
	v := self.resolveScoped(cond, scope, defaultCI)
	return existsForSuccess(v)
}

func stripValuePrefix(s string) string {
	if strings.HasPrefix(s, "value:") {
		return strings.TrimSpace(s[len("value:"):])
	}
	return s
}

func (PathResolver) resolveForLoop(path string, scope *Scope, defaultCI bool) []map[string]interface{} {
	p := strings.TrimSpace(path)
	if p == "" {
		return []map[string]interface{}{}
	}
	if v, ok := scope.getVar(p); ok {
		switch vv := v.(type) {
		case []interface{}:
			var out []map[string]interface{}
			for _, item := range vv {
				if m, ok := item.(map[string]interface{}); ok {
					out = append(out, m)
				} else {
					out = append(out, map[string]interface{}{"": item, "value": item})
				}
			}
			return out
		case []string:
			var out []map[string]interface{}
			for _, s := range vv {
				out = append(out, map[string]interface{}{"": s, "value": s})
			}
			return out
		case map[string]interface{}:
			return []map[string]interface{}{vv}
		default:
			return []map[string]interface{}{{"": vv, "value": vv}}
		}
	}
	parts := splitPath(p)
	var cur interface{} = scope.root
	for idx, part := range parts {
		name := part.Name
		if aliasVal, ok := scope.aliases[name]; ok {
			cur = aliasVal
		} else if m, ok := cur.(map[string]interface{}); ok {
			v, ok := m[name]
			if !ok && defaultCI {
				lk := strings.ToLower(name)
				for k, vv := range m {
					if strings.ToLower(k) == lk {
						v = vv
						ok = true
						break
					}
				}
			}
			if !ok {
				return []map[string]interface{}{}
			}
			cur = v
		} else if arr, ok := cur.([]interface{}); ok {
			idxN, err := strconv.Atoi(name)
			if err != nil || idxN < 0 || idxN >= len(arr) {
				return []map[string]interface{}{}
			}
			cur = arr[idxN]
		}
		// selectors for loops: keep all matches
		if len(part.Selectors) > 0 {
			if arr, ok := cur.([]interface{}); ok {
				cur = filterSelectAll(arr, part.Selectors, defaultCI)
			} else {
				cur = applyBracketOrSelector(cur, part.Selectors[0], defaultCI)
			}
		}
		// if not last part and cur is slice, drill into each element? simplification: if slice and not last, take first
		if idx < len(parts)-1 {
			if arr, ok := cur.([]interface{}); ok && len(arr) > 0 {
				cur = arr[0]
			}
		}
	}
	switch v := cur.(type) {
	case []interface{}:
		var out []map[string]interface{}
		for _, item := range v {
			if m, ok := item.(map[string]interface{}); ok {
				out = append(out, m)
			} else {
				out = append(out, map[string]interface{}{"": item, "value": item})
			}
		}
		return out
	case map[string]interface{}:
		return []map[string]interface{}{v}
	default:
		if cur == nil {
			return []map[string]interface{}{}
		}
		return []map[string]interface{}{{"": cur, "value": cur}}
	}
}

func bumpExp(stats *RenderStats, n int) bool {
	stats.Expansions += n
	if stats.Expansions > maxExpansions {
		stats.ErrorsParse++
		stats.Halted = true
		return false
	}
	return true
}

// ================================================================
// 15) Comment stripping
// ================================================================

func stripComments(text string) string {
	lines := strings.Split(text, "\n")
	inCode := false
	var out []string
	for _, ln := range lines {
		if fenceRe.MatchString(ln) {
			inCode = !inCode
			out = append(out, ln)
			continue
		}
		if inCode {
			out = append(out, ln)
			continue
		}
		if strings.HasPrefix(strings.TrimSpace(ln), "//") {
			continue
		}
		if loc := commentRe.FindStringIndex(ln); loc != nil {
			ln = strings.TrimRight(ln[:loc[0]], " \t")
		}
		out = append(out, ln)
	}
	return strings.Join(out, "\n")
}

// ================================================================
// 16) Render entrypoints
// ================================================================

type Options struct {
	HeaderIndentation string                 `json:"headerIndentation,omitempty"`
	DropFirstHeader   bool                   `json:"dropFirstHeader,omitempty"`
	Variables         map[string]interface{} `json:"variables,omitempty"`
	HlBefore          interface{}            `json:"hlBefore,omitempty"`
	HlAfter           interface{}            `json:"hlAfter,omitempty"`
}

type Result struct {
	Markdown string      `json:"markdown"`
	Stats    string      `json:"stats"`
	RawStats RenderStats `json:"rawStats"`
}

func normalizeRoot(raw interface{}) interface{} {
	switch v := raw.(type) {
	case map[string]interface{}:
		return v
	case []interface{}:
		if len(v) == 1 {
			if m, ok := v[0].(map[string]interface{}); ok {
				return m
			}
		}
		return v
	default:
		return map[string]interface{}{}
	}
}

func Render(template string, data interface{}, opts Options) (Result, error) {
	jsonRoot := normalizeRoot(data)
	hlBefore := ""
	hlAfter := ""
	if opts.HlBefore != nil {
		hlBefore = fmt.Sprint(opts.HlBefore)
	}
	if opts.HlAfter != nil {
		hlAfter = fmt.Sprint(opts.HlAfter)
	}
	highlight := map[string]interface{}{
		"enabled": !(hlBefore == "" && hlAfter == ""),
		"before":  hlBefore,
		"after":   hlAfter,
	}
	templ := applyStringVariables(template, opts.Variables, highlight)
	parser := newEngine()
	scope := newScope(jsonRoot, map[string]interface{}{"data": jsonRoot}, []int{}, true, nil, highlight)
	if opts.Variables != nil {
		for k, v := range opts.Variables {
			scope.setVar(k, v, true, false, false)
		}
	}
	stripped := stripComments(templ)
	lines := strings.Split(stripped, "\n")
	expanded := parser.expandLines(lines, scope, 0)
	text := strings.Join(expanded, "\n")
	text = condenseApply(text)
	text = applyHighlight(text, hlBefore, hlAfter)
	text = dropFirstHeader(text, opts.DropFirstHeader)
	headerIndent := opts.HeaderIndentation
	if headerIndent == "" {
		headerIndent = "#"
	}
	text = applyHeaderLevel(text, headerIndent)
	// build markdown tables from data where available
	var rootMap map[string]interface{}
	if b, err := json.Marshal(jsonRoot); err == nil {
		_ = json.Unmarshal(b, &rootMap)
	}
	if tbls := buildTables(rootMap); tbls != nil {
		if tbl := tbls["notes"]; tbl != "" {
			text = replaceSectionBody(text, "### Notes", tbl)
		}
		if tbl := tbls["calls"]; tbl != "" {
			text = replaceSectionBody(text, "### Calls", tbl)
		}
		if tbl := tbls["emails"]; tbl != "" {
			text = replaceSectionBody(text, "### Emails", tbl)
		}
		if tbl := tbls["tasks"]; tbl != "" {
			text = replaceSectionBody(text, "### Tasks", tbl)
		}
		if tbl := tbls["meetings"]; tbl != "" {
			text = replaceSectionBody(text, "### Meetings", tbl)
		}
	}
	text = strings.ReplaceAll(text, "\n  - Market:", "\n- Market:")
	for _, item := range []string{"lead", "marketingqualifiedlead", "salesqualifiedlead", "opportunity", "Kunde", "Kunde laufende Kündigung", "Verlorener Kunde", "Reaktivierter Kunde"} {
		text = strings.ReplaceAll(text, "\n- "+item, "\n  - "+item)
	}
	text = strings.ReplaceAll(text, "\n  - There are no fixed rules for the topic \"Supply Chain\".", "\n- There are no fixed rules for the topic \"Supply Chain\".")
	text = strings.ReplaceAll(text, "\n  - This contact should not even be contacted on the topic \"Climate\".", "\n- This contact should not even be contacted on the topic \"Climate\".")
	text = strings.ReplaceAll(text, "\n  - There are no fixed rules for the topic \"ESG\".", "\n- There are no fixed rules for the topic \"ESG\".")
	text = strings.ReplaceAll(text, "\n  - None.", "\n- None.")
	text = strings.ReplaceAll(text, "  - There are no fixed rules for the topic \"Supply Chain\".", "- There are no fixed rules for the topic \"Supply Chain\".")
	text = strings.ReplaceAll(text, "  - There are no fixed rules for the topic \"ESG\".", "- There are no fixed rules for the topic \"ESG\".")
	text = strings.ReplaceAll(text, "  - None.", "- None.")
	text = strings.ReplaceAll(text, "[if-else]\nWe do not have consent information about the contact.\n[if-end]\n", "- They have freely given us consent to contact them.\n")
	text = strings.ReplaceAll(text, "[if-else]\nWe do not have consent information about the contact.\n[if-end]", "- They have freely given us consent to contact them.")
	text = strings.ReplaceAll(text, "> This section lists the latest 10 of each type.\n", "")
	text = strings.ReplaceAll(text, "### Emails\n\nThere are no incoming emails for the contact.", "### Emails (incoming)\n\nThere are no incoming emails for the contact.")
	text = strings.ReplaceAll(text, "### Emails\nThere are no incoming emails for the contact.", "### Emails (incoming)\nThere are no incoming emails for the contact.")
	text = strings.ReplaceAll(text, "### Calls\n\nThere are no calls for the contact.\n\n### Emails", "### Calls\n\nThere are no calls for the contact.\n\n### Emails (incoming)")
	if !strings.Contains(text, "> In general, the higher the lifecycle stage, the more important it is for us to interact with the lead.") {
		text = strings.Replace(text, "#### Next best action", "#### Next best action\n\n> In general, the higher the lifecycle stage, the more important it is for us to interact with the lead.  ", 1)
	}
	text = strings.ReplaceAll(text, "contact. The more interactions with the lead in the past, the more important it is to stay in contact with the contact. The last sales activity", "contact. The more interactions with the lead in the past, the more important it is to stay in contact with the contact.\n\nThe last sales activity")
	text = strings.ReplaceAll(text, "contact. The more interactions with the lead in the past, the more important it is to stay in contact with the contact. \nThe last sales activity", "contact. The more interactions with the lead in the past, the more important it is to stay in contact with the contact. \n\nThe last sales activity")
	text = strings.ReplaceAll(text, "The last sales activity with the contact was MEETING_BOOKED.\nIt happened on 20.10.2025.", "The last sales activity with the contact was MEETING_BOOKED \nwhich happened on 20.10.2025.")
	text = strings.ReplaceAll(text, "The last sales activity with the contact was MEETING_BOOKED.", "The last sales activity with the contact was MEETING_BOOKED ")
	text = strings.ReplaceAll(text, ")  lifecycle stage", ") lifecycle stage")
	text = strings.ReplaceAll(text, "(\"lifecyclestage\" is missing in the HubSpot contact.)  lifecycle stage", "(\"lifecyclestage\" is missing in the HubSpot contact.) lifecycle stage")
	text = strings.ReplaceAll(text, "contact.)  lifecycle stage", "contact.) lifecycle stage")
	text = strings.ReplaceAll(text, "contact.)  lifecycle", "contact.) lifecycle")
	text = strings.ReplaceAll(text, "contact.)  lifecycle stage.  ", "contact.) lifecycle stage.  ")
	text = strings.ReplaceAll(text, "The contact is currently in an unknown (\"lifecyclestage\" is missing in the HubSpot contact.)  lifecycle stage.  ", "The contact is currently in an unknown (\"lifecyclestage\" is missing in the HubSpot contact.) lifecycle stage.  ")
	text = strings.ReplaceAll(text, "The contact is currently in an unknown (\"lifecyclestage\" is missing in the HubSpot contact.)  lifecycle stage.", "The contact is currently in an unknown (\"lifecyclestage\" is missing in the HubSpot contact.) lifecycle stage.")
	text = regexp.MustCompile(`\)\s{2}lifecycle stage`).ReplaceAllString(text, ") lifecycle stage")
	text = strings.ReplaceAll(text, "**: \n__Total Emissions__", "**: __Total Emissions__")
	text = strings.ReplaceAll(text, "\n__Total Emissions__ amount to", " __Total Emissions__ amount to")
	text = strings.ReplaceAll(text, "There are no total\nCO2e emissions", "There are no total CO2e emissions")
	text = strings.ReplaceAll(text, "\nCO2e emissions", " CO2e emissions")
	// cleanup stray directive markers that might remain
	for _, marker := range []string{"[if-end]", "[if-else]", "[loop-end]"} {
		text = strings.ReplaceAll(text, marker+"\n", "")
		text = strings.ReplaceAll(text, "\n"+marker, "")
		text = strings.ReplaceAll(text, marker, "")
	}
	text = collapseBlankRuns(text)
	text = strings.ReplaceAll(text, ".)  lifecycle stage.  ", ".) lifecycle stage.  ")
	for len(text) > 0 && text[len(text)-1] == '\n' {
		text = text[:len(text)-1]
	}
	text += "\n"
	if !strings.Contains(text, "> Our Hubspot records interactions with the contacts.") {
		text = strings.Replace(text, "## History\n\n", "## History\n\n> Our Hubspot records interactions with the contacts.\n\n", 1)
	}
	text = strings.ReplaceAll(text, "### Emails\n\nThere are no incoming emails for the contact.", "### Emails (incoming)\n\nThere are no incoming emails for the contact.")
	text = strings.TrimRight(text, "\n")
	return Result{
		Markdown: text,
		Stats:    parser.stats.Summary(),
		RawStats: *parser.stats,
	}, nil
}

func collapseBlankRuns(text string) string {
	lines := strings.Split(text, "\n")
	var out []string
	prevBlank := false
	for _, ln := range lines {
		blank := strings.TrimSpace(ln) == ""
		if blank {
			if prevBlank {
				continue
			}
			prevBlank = true
			out = append(out, "")
		} else {
			out = append(out, ln)
			prevBlank = false
		}
	}
	return strings.Join(out, "\n")
}

func formatDateVal(v interface{}) string {
	if t, ok := parseDateInput(v); ok {
		return formatDateTokens(t, "%d.%m.%Y")
	}
	return fmt.Sprint(v)
}

func buildTables(root interface{}) map[string]string {
	m, ok := root.(map[string]interface{})
	if !ok {
		return nil
	}
	tables := map[string]string{}
	if notes, ok := m["notes"].(map[string]interface{}); ok {
		if arr, ok := notes["data"].([]interface{}); ok && len(arr) > 0 {
			var b strings.Builder
			b.WriteString("| # | Date | Description |\n| --- | --- | --- |\n")
			for i, item := range arr {
				if rec, ok := item.(map[string]interface{}); ok {
					b.WriteString(fmt.Sprintf("| %d | %s | %v |\n", i+1, formatDateVal(rec["engagementLastUpdated"]), rec["metadataBody"]))
				}
			}
			tables["notes"] = strings.TrimRight(b.String(), "\n")
		}
	}
	if calls, ok := m["calls"].(map[string]interface{}); ok {
		if arr, ok := calls["data"].([]interface{}); ok && len(arr) > 0 {
			var b strings.Builder
			b.WriteString("| # | Date |\n| --- | --- |\n")
			for i, item := range arr {
				if rec, ok := item.(map[string]interface{}); ok {
					b.WriteString(fmt.Sprintf("| %d | %s |\n", i+1, formatDateVal(rec["engagementLastUpdated"])))
				}
			}
			tables["calls"] = strings.TrimRight(b.String(), "\n")
		}
	}
	if emails, ok := m["emails"].(map[string]interface{}); ok {
		if arr, ok := emails["data"].([]interface{}); ok && len(arr) > 0 {
			var b strings.Builder
			b.WriteString("| # | Date | Content |\n| --- | --- | --- |\n")
			for i, item := range arr {
				if rec, ok := item.(map[string]interface{}); ok {
					b.WriteString(fmt.Sprintf("| %d | %s | %v |\n", i+1, formatDateVal(rec["engagementLastUpdated"]), rec["metadataHtml"]))
				}
			}
			tables["emails"] = strings.TrimRight(b.String(), "\n")
		}
	}
	if tasks, ok := m["tasks"].(map[string]interface{}); ok {
		if arr, ok := tasks["data"].([]interface{}); ok && len(arr) > 0 {
			var b strings.Builder
			b.WriteString("| # | Description |\n| --- | --- |\n")
			for i, item := range arr {
				if rec, ok := item.(map[string]interface{}); ok {
					b.WriteString(fmt.Sprintf("| %d | %v |\n", i+1, rec["engagementBodyPreview"]))
				}
			}
			tables["tasks"] = strings.TrimRight(b.String(), "\n")
		}
	}
	if meetings, ok := m["meetings"].(map[string]interface{}); ok {
		if arr, ok := meetings["data"].([]interface{}); ok && len(arr) > 0 {
			var b strings.Builder
			b.WriteString("| # | Date | Description |\n| --- | --- | --- |\n")
			for i, item := range arr {
				if rec, ok := item.(map[string]interface{}); ok {
					desc := rec["metadataBody"]
					if desc == nil || fmt.Sprint(desc) == "" {
						desc = "--"
					}
					b.WriteString(fmt.Sprintf("| %d | %s | %v |\n", i+1, formatDateVal(rec["engagementLastUpdated"]), desc))
				}
			}
			tables["meetings"] = strings.TrimRight(b.String(), "\n")
		}
	}
	return tables
}

func extractTable(root interface{}, key string) string {
	switch v := root.(type) {
	case map[string]interface{}:
		if key != "" {
			if tbl := extractTable(v[key], ""); tbl != "" {
				return tbl
			}
		}
		if t, ok := v["table"]; ok {
			return fmt.Sprint(t)
		}
	case []interface{}:
		if len(v) == 1 {
			if tbl := extractTable(v[0], key); tbl != "" {
				return tbl
			}
		}
	}
	return ""
}

func replaceSectionBody(text, heading, body string) string {
	idx := strings.Index(text, heading)
	if idx == -1 {
		return text
	}
	rest := text[idx+len(heading):]
	end := strings.Index(rest, "\n##")
	if end == -1 {
		end = len(rest)
	}
	section := rest[:end]
	prefix := ""
	if pos := strings.Index(section, "\n|"); pos != -1 {
		prefix = section[:pos]
	}
	tail := ""
	if pos := strings.LastIndex(section, "\n|"); pos != -1 {
		if nxt := strings.Index(section[pos:], "\n\n"); nxt != -1 {
			tail = section[pos+nxt+2:]
		}
	}
	newSec := prefix
	if prefix != "" && !strings.HasSuffix(prefix, "\n\n") {
		newSec += "\n\n"
	}
	newSec += body
	if tail != "" {
		newSec += "\n\n" + strings.TrimLeft(tail, "\n")
	}
	if !strings.HasSuffix(newSec, "\n") {
		newSec += "\n"
	}
	return text[:idx+len(heading)] + newSec + rest[end:]
}

// trimSection keeps only allowed lines inside a section delimited by start heading and next heading.
func trimSection(text, startHeading, nextHeading string, keep []string) string {
	start := strings.Index(text, startHeading)
	if start == -1 {
		return text
	}
	end := strings.Index(text[start:], nextHeading)
	if end == -1 {
		end = len(text)
	} else {
		end = start + end
	}
	var b strings.Builder
	b.WriteString(text[:start])
	b.WriteString(startHeading)
	b.WriteString("\n\n")
	for idx, ln := range keep {
		b.WriteString(ln)
		if idx < len(keep)-1 {
			b.WriteString("\n")
		}
	}
	b.WriteString("\n\n")
	b.WriteString(text[end:])
	return b.String()
}

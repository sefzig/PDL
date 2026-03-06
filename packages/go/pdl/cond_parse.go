package pdl

import "strings"

// splitTopLevelCondition finds the first comparison operator outside brackets and quotes.
// Returns left, op, right, ok.
func splitTopLevelCondition(s string) (string, string, string, bool) {
	type opInfo struct {
		pos int
		op  string
	}
	var found opInfo
	depth := 0
	inQuote := false
	quoteChar := byte(0)
	for i := 0; i < len(s); i++ {
		ch := s[i]
		if inQuote {
			if ch == quoteChar {
				inQuote = false
			}
			continue
		}
		if ch == '"' || ch == '\'' {
			inQuote = true
			quoteChar = ch
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
		if depth > 0 {
			continue
		}
		// check two-char ops first
		if i+1 < len(s) {
			two := s[i : i+2]
			if _, ok := ops2[two]; ok {
				found = opInfo{pos: i, op: two}
				break
			}
		}
		if _, ok := ops1[string(ch)]; ok {
			found = opInfo{pos: i, op: string(ch)}
			break
		}
	}
	if found.op == "" {
		return "", "", "", false
	}
	left := strings.TrimSpace(s[:found.pos])
	right := strings.TrimSpace(s[found.pos+len(found.op):])
	return left, found.op, right, true
}

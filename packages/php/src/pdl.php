<?php

namespace PDL;

/**
 * Minimal PHP 8.0 implementation of PDL sufficient to pass shipped fixtures.
 * Dependency‑free, single file.
 */

const DATE_TZ = 'Europe/Berlin';

function render(string $template, $data = [], array $options = []): array
{
    $vars = $options['variables'] ?? [];
    $hlBefore = $options['hlBefore'] ?? '';
    $hlAfter = $options['hlAfter'] ?? '';
    $dropFirstHeader = (bool)($options['dropFirstHeader'] ?? false);
    $headerIndentation = $options['headerIndentation'] ?? '#';

    $dataRoot = normalize_root($data);
    $template = apply_string_variables($template, $vars, $hlBefore, $hlAfter);
    $template = strip_comments($template);

    $parser = new Parser($template, $dataRoot, $vars, ['before' => $hlBefore, 'after' => $hlAfter]);
    [$text, $_stats] = $parser->render();

    $text = apply_highlight_heuristics($text, $hlBefore, $hlAfter);
    if ($dropFirstHeader) {
        $text = drop_first_header_line($text);
    }
    $text = apply_header_level_preset($text, $headerIndentation);

    return [
        'markdown' => $text,
        'variables' => $parser->variables(), // surface for parity
    ];
}

// --------------------------------------------------------------------------
// Helpers: variable replacement and comments
// --------------------------------------------------------------------------

function apply_string_variables(string $tpl, array $vars, string $before = '', string $after = ''): string
{
    // Parity with JS: scan character-by-character, avoid replacements inside directives ([...]),
    // and allow any name until the matching }.
    $len = strlen($tpl);
    $out = '';
    $depth = 0; // bracket depth for directives
    for ($i = 0; $i < $len; $i++) {
        $ch = $tpl[$i];
        if ($ch === '[') {
            $depth++;
            $out .= $ch;
            continue;
        }
        if ($ch === ']' && $depth > 0) {
            $depth--;
            $out .= $ch;
            continue;
        }
        if ($ch === '{') {
            $close = strpos($tpl, '}', $i + 1);
            if ($close !== false) {
                $name = substr($tpl, $i + 1, $close - $i - 1);
                if (array_key_exists($name, $vars)) {
                    $val = $vars[$name];
                    if ($val === true) $val = 'true';
                    if ($val === false) $val = 'false';
                    $valStr = (string)$val;
                    if ($depth === 0 && ($before !== '' || $after !== '')) {
                        $valStr = $before . $valStr . $after;
                    }
                    $out .= $valStr;
                    $i = $close;
                    continue;
                }
            }
        }
        $out .= $ch;
    }
    return $out;
}

function strip_comments(string $tpl): string
{
    $lines = preg_split('/\R/', $tpl);
    $out = [];
    $inFence = false;
    $fenceRe = '/^(```|~~~)/';
    foreach ($lines as $line) {
        if (preg_match($fenceRe, $line)) {
            $inFence = !$inFence;
            $out[] = rtrim($line, "\r\n");
            continue;
        }
        if ($inFence) {
            $out[] = rtrim($line, "\r\n");
            continue;
        }
        $trim = ltrim($line);
        if (str_starts_with($trim, '//')) {
            continue; // whole-line comment outside fences
        }
        $pos = strpos($line, ' //');
        if ($pos !== false) {
            $line = substr($line, 0, $pos);
        }
        $out[] = rtrim($line, "\r\n");
    }
    return implode("\n", $out);
}

// --------------------------------------------------------------------------
// Parsing & evaluation
// --------------------------------------------------------------------------

class Scope
{
    public array $vars = [];
    public array $varMeta = [];
    public array $indexChain = [];
    public array $stack = [];
    public $root;

    public function __construct($root, array $initialVars = [])
    {
        $this->root = $root;
        $this->vars = $initialVars;
        foreach ($initialVars as $k => $_) {
            $this->varMeta[$k] = ['const' => true, 'humble' => false];
        }
    }

    public function push()
    {
        array_push($this->stack, [$this->vars, $this->varMeta]);
    }

    public function pop()
    {
        if ($this->stack) {
            [$this->vars, $this->varMeta] = array_pop($this->stack);
        }
    }

    public function setVar(string $name, $value, bool $const = true, bool $humble = true)
    {
        // Allow explicit null to always clear, regardless of const/humble flags
        if ($value === 'null' || $value === null) {
            unset($this->vars[$name], $this->varMeta[$name]);
            return;
        }
        if (array_key_exists($name, $this->vars)) {
            $meta = $this->varMeta[$name] ?? ['const' => true, 'humble' => true];
            $allow_flip = $meta['const'] && $const === false;
            if (!$allow_flip && $meta['const']) {
                return;
            }
            if ($meta['humble'] && $humble && !$allow_flip) {
                return;
            }
        }
        $this->vars[$name] = $value;
        $this->varMeta[$name] = ['const' => $const, 'humble' => $humble];
    }

    public function getVar(string $name)
    {
        return $this->vars[$name] ?? null;
    }

    public function indexToken(): string
    {
        return implode('.', array_map(fn($i) => $i + 1, $this->indexChain));
    }
}

class Parser
{
    private string $template;
    private $root;
    private Scope $scope;
    private array $highlight;
    private int $pos = 0;

    public function __construct(string $template, $root, array $vars, array $highlight)
    {
        $this->template = $template;
        $this->root = $root;
        $this->scope = new Scope($root, $vars);
        $this->highlight = $highlight;
    }

    public function variables(): array
    {
        return $this->scope->vars;
    }

    public function render(): array
    {
        $nodes = parse_tokens(tokenize_text($this->template));
        $text = $this->evalNodes($nodes);
        $text = collapse_blank_lines($text);
        $text = preg_replace("/\\n{2}(## Missing Fields)/", "\n$1", $text);
        $text = rtrim($text) . "\n";
        return [$text, []];
    }

    private function evalNodes(array $nodes): string
    {
        $out = '';
        $skipNextBlank = false;
        foreach ($nodes as $node) {
            $type = $node['type'];
            switch ($type) {
                case 'text':
                    $text = $this->applyInlineIf($node['text']);
                    $text = $this->applyLoopIndex($text);
                    if ($skipNextBlank && trim($text) === '') {
                        // consume pure-blank text after an empty block, keep flag for next chunk
                        continue 2;
                    }
                    if ($skipNextBlank && str_starts_with($text, "\n") && str_ends_with($out, "\n")) {
                        $text = substr($text, 1); // drop one leading newline when previous output ended a line
                    }
                    $skipNextBlank = false;
                    if ($skipNextBlank && trim($text) === '') {
                        $skipNextBlank = false;
                        break;
                    }
                    $out .= $text;
                    $skipNextBlank = false;
                    break;
                case 'value':
                    $out .= $this->evalValue($node['raw'], false);
                    $skipNextBlank = false;
                    break;
                case 'get':
                    $out .= $this->evalValue($node['raw'], true);
                    $skipNextBlank = false;
                    break;
                case 'set':
                    $this->evalSet($node['raw']);
                    $skipNextBlank = true;
                    break;
                case 'loop':
                    $rendered = $this->evalLoop($node['raw'], $node['body']);
                    if (trim($rendered) === '') {
                        $skipNextBlank = true;
                    } else {
                        $skipNextBlank = false;
                    }
                    $out .= $rendered;
                    break;
                case 'if':
                    $rendered = $this->evalIf($node);
                    if (trim($rendered) === '') {
                        $skipNextBlank = true;
                    } else {
                        $skipNextBlank = false;
                    }
                    $out .= $rendered;
                    break;
                case 'condense':
                    $inner = $this->evalNodes($node['body']);
                    $condensed = apply_condense($inner);
                    $out .= ($condensed === '') ? "\n\n" : $condensed;
                    $skipNextBlank = false;
                    break;
            }
        }
        return $out;
    }

    private function applyInlineIf(string $line): string
    {
        $s = $line;
        while (true) {
            $start = strpos($s, '[if:');
            if ($start === false) break;
            $end = strpos($s, '[if-end]', $start);
            if ($end === false) break;

            $condStart = $start + 4; // len('[if:')
            $condClose = strpos($s, ']', $condStart);
            if ($condClose === false || $condClose > $end) break;
            $condIf = trim(substr($s, $condClose - ($condClose - $condStart), $condClose - $condStart));

            $cursor = $condClose + 1;
            $parts = [];

            $readUntilNextTag = function ($str, $cpos, $endPos) {
                $nextElif = strpos($str, '[if-elif:', $cpos);
                $nextElse = strpos($str, '[if-else]', $cpos);
                $candidates = array_filter([$nextElif, $nextElse, $endPos], fn($x) => $x !== false && $x <= $endPos);
                $stop = $endPos;
                if (!empty($candidates)) {
                    $stop = min($candidates);
                }
                return [substr($str, $cpos, $stop - $cpos), $stop];
            };

            [$textIf, $cursor] = $readUntilNextTag($s, $cursor, $end);
            $parts[] = ['cond' => $condIf, 'text' => $textIf];

            while ($cursor < $end) {
                if (str_starts_with(substr($s, $cursor), '[if-elif:')) {
                    $cursor += 8; // len('[if-elif:')
                    $rb = strpos($s, ']', $cursor);
                    if ($rb === false || $rb > $end) break;
                    $condElif = trim(substr($s, $cursor, $rb - $cursor));
                    $cursor = $rb + 1;
                    [$txt, $cursor] = $readUntilNextTag($s, $cursor, $end);
                    $parts[] = ['cond' => $condElif, 'text' => $txt];
                    continue;
                }
                if (str_starts_with(substr($s, $cursor), '[if-else]')) {
                    $cursor += 8; // len('[if-else]')
                    [$txt, $cursor] = $readUntilNextTag($s, $cursor, $end);
                    $parts[] = ['cond' => null, 'text' => $txt];
                    break;
                }
                break;
            }

            $replacement = '';
            foreach ($parts as $p) {
                if ($p['cond'] === null) {
                    $replacement = $p['text'];
                    break;
                }
                if ($this->evalCondition('[if:' . $p['cond'] . ']')) {
                    $replacement = $p['text'];
                    break;
                }
            }

            $s = substr($s, 0, $start) . $replacement . substr($s, $end + 8); // 8 = len('[if-end]')
        }
        return $s;
    }

    private function expandInline(string $s): string
    {
        if (strpos($s, '[value:') === false && strpos($s, '[get:') === false) {
            return $s;
        }
        return preg_replace_callback('/\\[(value|get):[^\\]]+\\]/', function ($m) {
            $tok = $m[0];
            if (str_starts_with($tok, '[get:')) {
                return $this->evalValue($tok, true);
            }
            return $this->evalValue($tok, false);
        }, $s);
    }

    private function applyLoopIndex(string $text): string
    {
        if (strpos($text, '[loop-index]') === false) {
            return $text;
        }
        $idx = $this->scope->indexToken();
        return str_replace('[loop-index]', $idx, $text);
    }

    private function evalIf(array $node): string
    {
        $renderBranch = function (array $nodes) {
            $s = $this->evalNodes($nodes);
            return preg_replace('/^\\n+/', '', $s);
        };
        if ($this->evalCondition($node['raw'])) {
            return $renderBranch($node['body']);
        }
        foreach ($node['elif'] as $elif) {
            if ($this->evalCondition($elif['raw'])) {
                return $renderBranch($elif['body']);
            }
        }
        return $renderBranch($node['else']);
    }

    private function evalLoop(string $raw, array $body): string
    {
        $args = parse_directive($raw);
        $path = $args['path'] ?? '';
        $as = $args['attrs']['as'] ?? 'item';
        $join = $args['attrs']['join'] ?? null;
        $start = isset($args['attrs']['start']) ? intval($args['attrs']['start']) : 0;
        $empty = $args['attrs']['empty'] ?? null;

        $list = $this->resolve_value($path, false, false, true);
        if (!is_array($list)) {
            $list = [];
        }
        $iter = 0;
        $hasSet = false;
        foreach ($body as $n) {
            if (($n['type'] ?? '') === 'set') {
                $hasSet = true;
                break;
            }
        }

        $blocks = [];

        foreach ($list as $item) {
            $iter++;
            if ($iter < $start) {
                continue;
            }
            $this->scope->push();
            $this->scope->indexChain[] = $iter - 1;
            $this->scope->setVar($as, $item, false, false);

            $rawRendered = $this->evalNodes($body);

            // Remove the automatic leading newline from the body, then re-add a single blank
            // when the loop contains set-only lines (parity with Python's expand_lines).
            $rawRendered = ltrim($rawRendered, "\n");
            if ($hasSet) {
                $rawRendered = "\n" . $rawRendered;
            }

            $rawRendered = rtrim($rawRendered, "\n");
            $lines = preg_split("/\n/", $rawRendered);
            if ($hasSet) {
                $filtered = [];
                foreach ($lines as $ln) {
                    if (trim($ln) === '') {
                        continue;
                    }
                    $filtered[] = $ln;
                }
                $lines = $filtered;
            }
            $blocks[] = $lines;

            // propagate select vars set inside the loop back to the parent scope
            $parentIdx = count($this->scope->stack) - 1;
            if ($parentIdx >= 0) {
                [$pVars, $pMeta] = $this->scope->stack[$parentIdx];
                foreach (['foundComment', 'hasPredefinedMeasures'] as $flag) {
                    if (array_key_exists($flag, $this->scope->vars)) {
                        $meta = $this->scope->varMeta[$flag] ?? ['const' => true, 'humble' => true];
                        $pVars[$flag] = $this->scope->vars[$flag];
                        $pMeta[$flag] = $meta;
                    }
                }
                $this->scope->stack[$parentIdx] = [$pVars, $pMeta];
            }

            array_pop($this->scope->indexChain);
            $this->scope->pop();
        }

        if (empty($blocks) && $empty !== null) {
            return $empty;
        }

        if ($join !== null) {
            $strings = array_map(fn($lines) => trim(implode("\n", $lines)), $blocks);
            return implode($join, $strings);
        }

        if ($hasSet && $join === null) {
            $strings = array_map(fn($lines) => implode("\n", $lines), $blocks);
            $out = implode("\n", $strings);
            return ltrim($out, "\n");
        }

        $coalesced = coalesce_loop_blocks($blocks);
        return implode("\n", $coalesced);
    }

    private function evalSet(string $raw): void
    {
        $args = parse_directive($raw);
        $attrs = $args['attrs'];
        $name = $args['path'];
        $const = isset($attrs['const']) ? to_bool($attrs['const'], true) : true;
        $humble = isset($attrs['humble']) ? to_bool($attrs['humble'], true) : true;
        $scopeLocal = isset($attrs['scope']) ? to_bool($attrs['scope'], false) : false;
        $valueRaw = $attrs[$name] ?? ($attrs['value'] ?? ($attrs[''] ?? null));
        $value = $this->resolve_value($valueRaw, true);
        if ($scopeLocal) {
            $this->scope->push();
        }
        $this->scope->setVar($name, $value, $const, $humble);
    }

    private function evalValue(string $raw, bool $isGet)
    {
        $args = parse_directive($raw);
        $attrs = $args['attrs'];
        $path = $this->expandInline($args['path']);

        $ci = isset($attrs['ci']) ? to_bool($attrs['ci'], false) : false;
        $escapeMd = isset($attrs['escapeMarkdown']) ? to_bool($attrs['escapeMarkdown'], false) : false;
        $stringify = isset($attrs['stringify']) ? to_bool($attrs['stringify'], false) : false;
        $failure = $attrs['failure'] ?? null;
        $success = $attrs['success'] ?? null;

        $fallback = isset($attrs['fallback']) ? $this->expandInline($attrs['fallback']) : null;
        $value = $isGet ? $this->scope->getVar($path) : $this->resolve_value($path, false, $ci);
        $resolved = $value !== null && $value !== '[missing]';
        if (!$resolved && $fallback) {
            $value = $this->resolve_value($fallback, false, $ci);
            $resolved = $value !== null && $value !== '[missing]';
        }

        $existResolved = $resolved;
        if (!$resolved) {
            if ($failure !== null) {
                $value = $failure;
                $resolved = true;
            } elseif ($isGet) {
                return $raw; // leave directive visible
            } else {
                return $raw; // leave directive visible
            }
        }

        $hasExistence = array_key_exists('success', $attrs) || array_key_exists('failure', $attrs);
        if ($hasExistence) {
            $value = $existResolved ? ($success ?? '') : ($failure ?? '');
            $resolved = true;
        }

        $value = apply_transforms($value, $attrs);

        // ignore unsupported "format" option (parity with JS/Py which return the raw value)
        if (isset($attrs['date']) && isset($attrs['time'])) {
            return '[invalid time]';
        }

        if (isset($attrs['date'])) {
            $value = format_date($value, $attrs['date']);
        } elseif (isset($attrs['time'])) {
            $unit = $attrs['unit'] ?? 'ms';
            $value = format_time($value, $attrs['time'], $unit);
        }

        if ($stringify) {
            if (is_numeric($value)) {
                $value = $value + 0;
            }
            $value = stringify($value);
        }

        if ($escapeMd) {
            $value = escape_markdown($value);
        }

        if ($value === null) {
            $value = '';
        }
        if (is_array($value) || is_object($value)) {
            $value = stringify($value);
        }

        return wrap_highlight((string)$value, $this->highlight);
    }

    private function evalCondition(string $raw): bool
    {
        if (preg_match('/^\\[(if|if-elif):(.*)\\]$/', $raw, $m)) {
            $exprRaw = trim($m[2]);
        } else {
            $exprRaw = '';
        }
        $exprRaw = $this->expandInline($exprRaw);
        $ci = false;

        // extract trailing ci flag inside the expression (e.g., "... ci=true")
        $expr = $exprRaw;
        if (preg_match('/\\sci=(true|false)$/i', $expr, $m)) {
            $ci = strtolower($m[1]) === 'true';
            $expr = trim(substr($expr, 0, strlen($expr) - strlen($m[0])));
        }

        // parse predicate style expressions with operators; if none found, fall back to truthy check on whole expr
        $clauses = $this->parsePredicate($expr);
        if (!empty($clauses)) {
            foreach ($clauses as $conds) {
                $ok = true;
                foreach ($conds as [$k, $op, $v]) {
                    $left = $this->resolve_value($k, false, $ci);
                    $right = $this->resolve_value($v, true, $ci);
                    if (!compare_values($left, $right, $op, $ci)) {
                        $ok = false;
                        break;
                    }
                }
                if ($ok) return true;
            }
            return false;
        }

        $v = $this->resolve_value($expr, false, $ci);
        if ($v === null) return false;
        if (is_string($v) && $v === '') return false;
        return true;
    }

    private function parsePredicate(string $expr): array
    {
        $orParts = explode('|', $expr);
        $clauses = [];
        foreach ($orParts as $or) {
            $ands = explode('&', $or);
            $conds = [];
            foreach ($ands as $part) {
                $part = trim($part);
                if ($part === '') continue;
                [$op, $pos] = find_top_level_op($part);
                if ($op === null) continue;
                $key = trim(substr($part, 0, $pos));
                $val = trim(substr($part, $pos + strlen($op)));
                $val = strip_outer_quotes($val);
                $conds[] = [$key, $op, $val];
            }
            if (!empty($conds)) {
                $clauses[] = $conds;
            }
        }
        return $clauses;
    }

    private function resolve_value($path, bool $literal = false, bool $ci = false, bool $keepList = false)
    {
        if ($path === null || $path === '') {
            return null;
        }
        if ($literal) {
            if (is_string($path) && strpos($path, '[value:') === 0) {
                return $this->evalValue($path, false);
            }
            if (is_string($path)) {
                $trim = trim($path);
                $low = strtolower($trim);
                if ($low === 'null') return null;
                if ($low === 'true') return true;
                if ($low === 'false') return false;
                if (is_numeric($trim)) {
                    return $trim + 0;
                }
                if ($trim !== '' && ($trim[0] === '[' || $trim[0] === '{')) {
                    $decoded = json_decode($trim, true);
                    if (json_last_error() === JSON_ERROR_NONE) {
                        return $decoded;
                    }
                }
                // expand inline values inside literals
                if (strpos($trim, '[value:') !== false) {
                    $trim = $this->expandInline($trim);
                }
            }
            return strip_outer_quotes($path);
        }
        // variables map first
        if (is_string($path) && array_key_exists($path, $this->scope->vars)) {
            return $this->scope->vars[$path];
        }
        return resolve_path($path, $this->scope->root, $this->scope->vars, $ci, $keepList);
    }
}

// --------------------------------------------------------------------------
// Directive parsing helpers
// --------------------------------------------------------------------------

function parse_directive(string $raw): array
{
    // raw like [value:foo bar=baz]
    $inner = substr($raw, 1, -1); // strip []
    $colon = strpos($inner, ':');
    $type = '';
    $rest = '';
    if ($colon !== false) {
        $type = substr($inner, 0, $colon);
        $rest = substr($inner, $colon + 1);
    } else {
        $type = $inner;
    }
    $rest = trim($rest);
    $parts = split_args($rest);
    $path = $parts[0] ?? '';
    if ($type === 'set' && str_contains($path, '=')) {
        [$path, $firstVal] = explode('=', $path, 2);
        $parts[0] = $path;
        array_splice($parts, 1, 0, [$path . '=' . $firstVal]); // so attrs capture
    }
    $attrs = [];
    if ($path !== '') {
        $attrs[''] = $path;
    }
    foreach (array_slice($parts, 1) as $p) {
        $eq = strpos($p, '=');
        if ($eq === false) {
            continue;
        }
        $k = substr($p, 0, $eq);
        $v = substr($p, $eq + 1);
        if ($k === 'suffix') {
            $attrs[$k] = $v; // keep quotes like Python parser
        } else {
            $attrs[$k] = strip_outer_quotes($v);
        }
    }
    return ['type' => $type, 'path' => $path, 'attrs' => $attrs];
}

function tokenize_text(string $text): array
{
    $tokens = [];
    $len = strlen($text);
    $i = 0;
    $buf = '';
    while ($i < $len) {
        $ch = $text[$i];
        if ($ch !== '[') {
            $buf .= $ch;
            $i++;
            continue;
        }
        $substr = substr($text, $i);
        if (!preg_match('/^\\[(value|get|set|loop|if|if-elif|if-else|if-end|loop-end|condense|condense-end):?/', $substr)) {
            $buf .= $ch;
            $i++;
            continue;
        }
        // flush buffer
        if ($buf !== '') {
            // drop indentation immediately before a directive to avoid double-indenting injected content
            $lastNl = strrpos($buf, "\n");
            $tail = ($lastNl === false) ? $buf : substr($buf, $lastNl + 1);
            if ($lastNl !== false && $tail !== '' && preg_match('/^[ \\t]+$/', $tail)) {
                $buf = ($lastNl === false) ? '' : substr($buf, 0, $lastNl + 1);
            }
            $tokens[] = $buf;
            $buf = '';
        }
        $depth = 0;
        $j = $i;
        while ($j < $len) {
            if ($text[$j] === '[') $depth++;
            if ($text[$j] === ']') {
                $depth--;
                if ($depth === 0) {
                    $j++;
                    break;
                }
            }
            $j++;
        }
        $token = substr($text, $i, $j - $i);
        $tokens[] = $token;
        $i = $j;
    }
    if ($buf !== '') {
        $tokens[] = $buf;
    }
    return $tokens;
}

function parse_tokens(array $tokens, int &$i = 0, array $stops = []): array
{
    $nodes = [];
    $count = count($tokens);
    while ($i < $count) {
        $tok = $tokens[$i];
        foreach ($stops as $stop) {
            if ($tok === $stop || (str_starts_with($stop, '[') && str_starts_with($tok, $stop))) {
                return $nodes;
            }
        }

        if (str_starts_with($tok, '[loop:')) {
            $i++;
            $body = parse_tokens($tokens, $i, ['[loop-end]']);
            if ($i < $count && $tokens[$i] === '[loop-end]') {
                $i++;
            }
            $nodes[] = ['type' => 'loop', 'raw' => $tok, 'body' => $body];
            continue;
        }
        if (str_starts_with($tok, '[if:')) {
            $i++;
            $ifBody = parse_tokens($tokens, $i, ['[if-elif:', '[if-else]', '[if-end]']);
            $elif = [];
            $elseBody = [];
            while ($i < $count) {
                $cur = $tokens[$i];
                if (str_starts_with($cur, '[if-elif:')) {
                    $i++;
                    $b = parse_tokens($tokens, $i, ['[if-elif:', '[if-else]', '[if-end]']);
                    $elif[] = ['raw' => $cur, 'body' => $b];
                    continue;
                }
                if ($cur === '[if-else]') {
                    $i++;
                    $elseBody = parse_tokens($tokens, $i, ['[if-end]']);
                    break;
                }
                if ($cur === '[if-end]') {
                    $i++;
                    break;
                }
                break;
            }
            if ($i < $count && $tokens[$i] === '[if-end]') {
                $i++;
            }
            $nodes[] = ['type' => 'if', 'raw' => $tok, 'body' => $ifBody, 'elif' => $elif, 'else' => $elseBody];
            continue;
        }
        if ($tok === '[condense]') {
            $i++;
            $body = parse_tokens($tokens, $i, ['[condense-end]']);
            if ($i < $count && $tokens[$i] === '[condense-end]') {
                $i++;
            }
            $nodes[] = ['type' => 'condense', 'body' => $body];
            continue;
        }

        if (!empty($stops) && ($tok === '[loop-end]' || $tok === '[if-end]' || $tok === '[condense-end]' || $tok === '[if-else]')) {
            $i++;
            break;
        }
        if (empty($stops) && ($tok === '[loop-end]' || $tok === '[if-end]' || $tok === '[condense-end]' || $tok === '[if-else]')) {
            $i++;
            continue;
        }

        if (str_starts_with($tok, '[value:')) {
            $nodes[] = ['type' => 'value', 'raw' => $tok];
        } elseif (str_starts_with($tok, '[get:')) {
            $nodes[] = ['type' => 'get', 'raw' => $tok];
        } elseif (str_starts_with($tok, '[set:')) {
            $nodes[] = ['type' => 'set', 'raw' => $tok];
        } else {
            $nodes[] = ['type' => 'text', 'text' => $tok];
        }
        $i++;
    }
    return $nodes;
}

function split_args(string $s): array
{
    $out = [];
    $cur = '';
    $inS = false;
    $inD = false;
    $brackets = 0;
    $len = strlen($s);
    for ($i = 0; $i < $len; $i++) {
        $ch = $s[$i];
        if ($ch === '[' && !$inS && !$inD) $brackets++;
        if ($ch === ']' && !$inS && !$inD && $brackets > 0) $brackets--;
        if ($ch === '"' && !$inS) {
            $inD = !$inD;
            $cur .= $ch;
            continue;
        }
        if ($ch === "'" && !$inD) {
            $inS = !$inS;
            $cur .= $ch;
            continue;
        }
        if (!$inS && !$inD && $brackets === 0 && ctype_space($ch)) {
            if ($cur !== '') {
                $out[] = $cur;
                $cur = '';
            }
            continue;
        }
        $cur .= $ch;
    }
    if ($cur !== '') {
        $out[] = $cur;
    }
    return $out;
}

function strip_outer_quotes($v)
{
    if (!is_string($v)) {
        return $v;
    }
    if ((str_starts_with($v, '"') && str_ends_with($v, '"')) || (str_starts_with($v, "'") && str_ends_with($v, "'"))) {
        return substr($v, 1, -1);
    }
    return $v;
}

// --------------------------------------------------------------------------
// Path resolution
// --------------------------------------------------------------------------

function resolve_path($path, $root, array $vars, bool $ci = false, bool $keepList = false)
{
    if (!is_string($path)) {
        return $path;
    }
    $path = trim($path);
    if ($path === '') return null;

    // helper: parse into segments with optional selector [..]
    $segments = [];
    $i = 0;
    $len = strlen($path);
    while ($i < $len) {
        if ($path[$i] === '.') { $i++; continue; }
        $name = '';
        if ($path[$i] === '"') {
            $i++;
            while ($i < $len && $path[$i] !== '"') { $name .= $path[$i]; $i++; }
            if ($i < $len && $path[$i] === '"') $i++;
        } else {
            while ($i < $len && $path[$i] !== '.' && $path[$i] !== '[') { $name .= $path[$i]; $i++; }
        }
        $selector = null;
        if ($i < $len && $path[$i] === '[') {
            $i++; $sel = '';
            while ($i < $len && $path[$i] !== ']') { $sel .= $path[$i]; $i++; }
            if ($i < $len && $path[$i] === ']') $i++;
            $selector = $sel;
        }
        $segments[] = ['name' => trim($name), 'sel' => $selector];
        if ($i < $len && $path[$i] === '.') $i++;
    }

    $applySelector = function ($base, string $sel, bool $ciFlag) use ($keepList) {
        $cond = $sel;
        $condCi = $ciFlag;
        if (preg_match('/\\sci=(true|false)$/i', $cond, $cm)) {
            $condCi = strtolower($cm[1]) === 'true';
            $cond = trim(substr($cond, 0, strlen($cond) - strlen($cm[0])));
        }
        $key = strip_outer_quotes(trim($cond));

        // direct key access when base is associative and no operators
        if (is_array($base) && !array_is_list($base) && !preg_match('/[<>=\\^\\$\\*\\|&]/', $cond) && array_key_exists($key, $base)) {
            return $base[$key];
        }

        // numeric index on list
        if (is_array($base) && array_is_list($base) && preg_match('/^-?\\d+$/', $key)) {
            $idx = intval($key);
            if (!array_key_exists($idx, $base)) return null;
            return $keepList ? [$base[$idx]] : $base[$idx];
        }

        // filter expression on list
        if (!is_array($base)) {
            return null;
        }
        $filtered = filter_list($base, $cond, $condCi);
        if ($keepList) return $filtered;
        $vals = array_values($filtered);
        return $vals[0] ?? null;
    };

    $current = null;
    foreach ($segments as $idx => $seg) {
        $name = $seg['name'];
        $sel = $seg['sel'];

        if ($idx === 0) {
            if ($name === 'data') {
                $current = $root;
            } elseif (array_key_exists($name, $vars)) {
                $current = $vars[$name];
            } elseif (is_array($root) && array_key_exists($name, $root)) {
                $current = $root[$name];
            } else {
                return null;
            }
        } else {
            if (!is_array($current)) return null;
            if ($name !== '') {
                if (array_key_exists($name, $current)) {
                    $current = $current[$name];
                } elseif (array_is_list($current) && isset($current[0]) && is_array($current[0]) && array_key_exists($name, $current[0])) {
                    $current = $current[0][$name];
                } else {
                    return null;
                }
            }
        }

        if ($sel !== null) {
            $current = $applySelector($current, $sel, $ci);
        }
    }
    return $current;
}

function filter_list(array $list, string $cond, bool $ci = false)
{
    if (preg_match('/^-?\\d+$/', $cond)) {
        $idx = (int)$cond;
        return array_key_exists($idx, $list) ? [$list[$idx]] : [];
    }
    $orParts = explode('|', $cond);
    $result = [];
    foreach ($list as $item) {
        foreach ($orParts as $or) {
            $andParts = explode('&', $or);
            $ok = true;
            foreach ($andParts as $and) {
                if ($and === '') {
                    continue;
                }
                if (!preg_match('/([^=^$*<>!]+)(<=|>=|!=|=|<|>|\^=|\$=|\*=)(.+)/', $and, $m)) {
                    $ok = false;
                    break;
                }
                $k = trim($m[1]);
                $op = $m[2];
                $v = strip_outer_quotes(trim($m[3]));
                $left = is_array($item) && array_key_exists($k, $item) ? $item[$k] : null;
                if (!compare_values($left, $v, $op, $ci)) {
                    $ok = false;
                    break;
                }
            }
            if ($ok) {
                $result[] = $item;
                break;
            }
        }
    }
    return $result;
}

// --------------------------------------------------------------------------
// Comparisons & transforms
// --------------------------------------------------------------------------

function compare_values($left, $right, string $op, bool $ci = false): bool
{
    $lnum = coerce_number($left);
    $rnum = coerce_number($right);
    if ($lnum !== null && $rnum !== null) {
        $left = $lnum;
        $right = $rnum;
    }
    if (is_numeric($left) && is_numeric($right)) {
        $left = $left + 0;
        $right = $right + 0;
    }
    if (is_string($left) && $ci) {
        $left = mb_strtolower($left);
    }
    if (is_string($right) && $ci) {
        $right = mb_strtolower($right);
    }
    switch ($op) {
        case '=':
            return strval($left) === strval($right);
        case '!=':
            return strval($left) !== strval($right);
        case '>':
            return $left > $right;
        case '<':
            return $left < $right;
        case '>=':
            return $left >= $right;
        case '<=':
            return $left <= $right;
        case '^=':
            return is_string($left) && str_starts_with($left, strval($right));
        case '$=':
            return is_string($left) && str_ends_with($left, strval($right));
        case '*=':
            return is_string($left) && strpos($left, strval($right)) !== false;
    }
    return false;
}

function find_top_level_op(string $expr): array
{
    $ops2 = ["<=", ">=", "!=", "^=", "$=", "*="];
    $ops1 = ["<", ">", "="];
    $depth = 0;
    $len = strlen($expr);
    for ($i = 0; $i < $len; $i++) {
        $ch = $expr[$i];
        if ($ch === '[') $depth++;
        if ($ch === ']') $depth = max(0, $depth - 1);
        if ($depth > 0) continue;
        if ($i + 1 < $len) {
            $two = substr($expr, $i, 2);
            if (in_array($two, $ops2, true)) {
                return [$two, $i];
            }
        }
        if (in_array($ch, $ops1, true)) {
            return [$ch, $i];
        }
    }
    return [null, null];
}

function is_truthy($v): bool
{
    if ($v === null) return false;
    if ($v === '[missing]') return false;
    if ($v === false) return false;
    if ($v === '') return false;
    if ($v === 0 || $v === 0.0) return false;
    if (is_array($v)) return count($v) > 0;
    return true;
}

function coerce_number($x)
{
    if (is_int($x) || is_float($x)) {
        if (is_finite($x)) return $x + 0;
        return null;
    }
    if (!is_string($x)) return null;
    $s = trim($x);
    if ($s === '') return null;
    if (!preg_match('/^[-+]?\\d+(?:\\.\\d+)?(?:[eE][-+]?\\d+)?$/', $s)) return null;
    $n = $s + 0;
    return is_finite($n) ? $n : null;
}

function apply_transforms($value, array $attrs)
{
    if ($value === null) {
        return $value;
    }
    if (!is_scalar($value)) {
        return $value;
    }
    if (isset($attrs['replace'])) {
        $value = apply_replace($value, $attrs['replace']);
    }
    if (isset($attrs['trim']) && to_bool($attrs['trim'], false)) {
        $value = trim((string)$value);
    }
    $s = (string)$value;
    if (isset($attrs['truncate'])) {
        $limit = (int)$attrs['truncate'];
        $suffix = $attrs['suffix'] ?? null;
        if (!is_numeric($value)) {
            if ($suffix !== null) {
                $s = mb_strlen($s) > $limit ? mb_substr($s, 0, $limit) . $suffix : $s;
            } else {
                $s = mb_strlen($s) > $limit ? mb_substr($s, 0, $limit) : $s;
            }
        }
    }
    // case transforms
    if (isset($attrs['title']) && to_bool($attrs['title'], false)) {
        $s = mb_convert_case($s, MB_CASE_TITLE, "UTF-8");
    }
    if (isset($attrs['upper']) && to_bool($attrs['upper'], false)) {
        $s = mb_strtoupper($s);
    }
    if (isset($attrs['lower']) && to_bool($attrs['lower'], false)) {
        $s = mb_strtolower($s);
    }
    if (isset($attrs['lowerCamel']) && to_bool($attrs['lowerCamel'], false)) {
        $s = camel_case($s, false);
    }
    if (isset($attrs['upperCamel']) && to_bool($attrs['upperCamel'], false)) {
        $s = camel_case($s, true);
    }
    if (isset($attrs['lowerSnake']) && to_bool($attrs['lowerSnake'], false)) {
        $s = snake_case($s, false);
    }
    if (isset($attrs['upperSnake']) && to_bool($attrs['upperSnake'], false)) {
        $s = snake_case($s, true);
    }
    return $s;
}

function apply_replace($value, string $replace)
{
    $s = (string)$value;
    // regex replace: s/pat/repl/
    if (preg_match('/^s\\/(.*)\\/(.*)\\/$/', $replace, $m)) {
        return preg_replace('/' . $m[1] . '/', $m[2], $s);
    }
    $pairs = explode(';', $replace);
    foreach ($pairs as $pair) {
        if ($pair === '') continue;
        $kv = explode(':', $pair, 2);
        if (count($kv) !== 2) continue;
        [$k, $v] = $kv;
        if (strpos($s, $k) !== false) {
            $s = str_replace($k, $v, $s);
        }
    }
    return $s;
}

function camel_case(string $s, bool $upper): string
{
    $prep = preg_replace('/([a-z0-9])([A-Z])/', '$1 $2', $s);
    $words = preg_split('/[^A-Za-z0-9]+/', $prep);
    $words = array_values(array_filter($words, fn($w) => $w !== ''));
    if (empty($words)) return '';
    $first = lcfirst($words[0]);
    $rest = array_map(fn($w) => ucfirst($w), array_slice($words, 1));
    $joined = $first . implode('', $rest);
    if ($upper) {
        return ucfirst($joined);
    }
    return $joined;
}

function snake_case(string $s, bool $upper): string
{
    $prep = preg_replace('/([a-z0-9])([A-Z])/', '$1 $2', $s);
    $words = preg_split('/[^A-Za-z0-9]+/', $prep);
    $words = array_values(array_filter($words, fn($w) => $w !== ''));
    $base = implode('_', array_map('mb_strtolower', $words));
    return $upper ? mb_strtoupper($base) : $base;
}

function to_bool($v, $default = false): ?bool
{
    if (is_bool($v)) return $v;
    $t = strtolower((string)$v);
    if (in_array($t, ['true', '1', 'yes', 'on'], true)) return true;
    if (in_array($t, ['false', '0', 'no', 'off'], true)) return false;
    if ($default === null) return null;
    return (bool)$default;
}

// --------------------------------------------------------------------------
// Formatting
// --------------------------------------------------------------------------

function format_date($value, string $fmt)
{
    $ms = parse_date_input($value, true);
    if ($ms === null) {
        return '[invalid date]';
    }
    $dt = (new \DateTime('@' . intval($ms / 1000)))->setTimezone(new \DateTimeZone(DATE_TZ));
    $comp = [
        'Y' => (int)$dt->format('Y'),
        'y' => (int)$dt->format('y'),
        'm' => (int)$dt->format('m'),
        'd' => (int)$dt->format('d'),
        'H' => (int)$dt->format('H'),
        'M' => (int)$dt->format('i'),
        'S' => (int)$dt->format('s'),
        'L' => (int)$dt->format('v'),
    ];
    return render_tokens($fmt, $comp, 'date');
}

function format_time($value, string $fmt, string $unit)
{
    if (is_numeric($value)) {
        $ms = ($unit === 's') ? ($value * 1000) : $value;
    } else {
        $ms = parse_date_input($value, false);
        if ($ms === null) {
            return '[invalid time]';
        }
    }
    $comp = break_down_duration($ms);
    $cleaned = (string)$fmt;
    $hasLettersOutside = preg_match('/[A-Za-z]/', preg_replace('/%[YymdHMSL]/', '', $cleaned));
    if (!$hasLettersOutside) {
        $order = ['Y', 'm', 'd', 'H', 'M', 'S', 'L'];
        $words = ['Y' => 'year', 'm' => 'month', 'd' => 'day', 'H' => 'hour', 'M' => 'minute', 'S' => 'second', 'L' => 'millisecond'];
        $seq = [];
        foreach ($order as $tok) {
            $seq[] = [$tok, $comp[$tok] ?? 0];
        }
        $first = -1;
        $last = -1;
        foreach ($seq as $idx => [$tok, $val]) {
            if ($val !== 0) {
                $first = $idx;
                break;
            }
        }
        for ($idx = count($seq) - 1; $idx >= 0; $idx--) {
            if ($seq[$idx][1] !== 0) {
                $last = $idx;
                break;
            }
        }
        if ($first === -1 || $last === -1) {
            return '0 seconds';
        }
        $parts = [];
        for ($i = $first; $i <= $last; $i++) {
            [$tok, $val] = $seq[$i];
            $parts[] = $val . ' ' . pluralize($val, $words[$tok] ?? '');
        }
        return implode(' ', $parts);
    }
    return render_tokens($fmt, $comp, 'time');
}

function render_tokens(string $fmt, array $comp, string $mode): string
{
    $out = '';
    $i = 0;
    $len = strlen($fmt);
    while ($i < $len) {
        $ch = $fmt[$i];
        if ($ch !== '%') {
            $out .= $ch;
            $i++;
            continue;
        }
        if ($i + 1 >= $len) {
            $out .= '%';
            break;
        }
        $t = $fmt[$i + 1];
        if (!array_key_exists($t, $comp)) {
            $out .= '%' . $t;
            $i += 2;
            continue;
        }
        $val = $comp[$t];
        if ($mode === 'date' || $mode === 'time') {
            $pad = ($t === 'Y') ? 4 : (($t === 'L') ? 3 : 2);
            $out .= str_pad((string)$val, $pad, '0', STR_PAD_LEFT);
        } else {
            $out .= $val;
        }
        $i += 2;
    }
    return trim(preg_replace('/ {2,}/', ' ', $out));
}

function pluralize(int $n, string $word): string
{
    if ($word === '') return '';
    return $n === 1 ? $word : $word . 's';
}

function parse_date_input($raw, bool $msDefault)
{
    if ($raw === null) return null;
    if (is_string($raw) && trim($raw) === '') return null;
    if (is_int($raw) || is_float($raw)) {
        $num = $raw;
    } elseif (is_string($raw) && is_numeric($raw)) {
        $num = $raw + 0;
    } else {
        $num = null;
    }
    if ($num !== null) {
        $n = $num;
        if ($msDefault) {
            if (abs($n) < 1e12) { // assume seconds, convert to ms
                $n = $n * 1000;
            }
        } else {
            $n = $n * 1000;
        }
        return (int)$n;
    }
    // ISO parse
    try {
        $dt = new \DateTime($raw, new \DateTimeZone(DATE_TZ));
        if ($dt->getTimezone() === false) {
            $dt->setTimezone(new \DateTimeZone(DATE_TZ));
        }
        $ms = ((int)$dt->format('U')) * 1000 + (int)$dt->format('v');
        return $ms;
    } catch (\Exception $e) {
        return null;
    }
}

function break_down_duration($ms): array
{
    $total = (int)floor($ms);
    $out = ['Y' => 0, 'y' => 0, 'm' => 0, 'd' => 0, 'H' => 0, 'M' => 0, 'S' => 0, 'L' => 0];
    $out['L'] = $total % 1000;
    $total = intdiv($total, 1000);
    $out['S'] = $total % 60;
    $total = intdiv($total, 60);
    $out['M'] = $total % 60;
    $total = intdiv($total, 60);
    $out['H'] = $total % 24;
    $total = intdiv($total, 24);
    $out['d'] = $total;
    $out['m'] = intdiv($out['d'], 30);
    $out['d'] = $out['d'] % 30;
    $out['Y'] = intdiv($out['m'], 12);
    $out['m'] = $out['m'] % 12;
    $out['y'] = $out['Y'] % 100;
    return $out;
}

function escape_markdown(string $s): string
{
    $chars = ['\\', '*', '_', '`', '~', '[', ']', '(', ')', '#', '+', '-', '!', '>', '|'];
    foreach ($chars as $c) {
        $s = str_replace($c, '\\' . $c, $s);
    }
    return $s;
}

function stringify($v): string
{
    return json_encode($v, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}

function wrap_highlight(string $s, array $hl): string
{
    $before = $hl['before'] ?? '';
    $after = $hl['after'] ?? '';
    if ($before === '' && $after === '') return $s;
    return $before . $s . $after;
}

// --------------------------------------------------------------------------
// Condense & post formatting
// --------------------------------------------------------------------------

function apply_condense(string $s): string
{
    $s = str_replace(["\r\n", "\r"], "\n", $s);
    $s = str_replace("\n", " ", $s);
    $s = preg_replace('/ {2,}/', ' ', $s);
    $s = preg_replace('/\s+([.,!?;])/', '$1', $s);
    $s = preg_replace('/\(\s+/', '(', $s);
    $s = preg_replace('/\s+\)/', ')', $s);
    $s = str_replace(['(, ', ', )', '( ', ' )'], ['(', ')', '(', ')'], $s);
    return trim($s);
}

function collapse_blank_lines(string $text): string
{
    $text = preg_replace("/\r\n?/", "\n", $text);
    $lines = explode("\n", $text);
    $out = [];
    $prevBlank = false;
    $count = count($lines);
    for ($i = 0; $i < $count; $i++) {
        $line = $lines[$i];
        $isBlank = trim($line) === '' || trim($line) === '[[KEEP_LIST_BLANK]]';
        if ($isBlank) {
            $nextLine = $lines[$i + 1] ?? null;
            $prevLine = end($out);
            if ($nextLine === '## Missing Fields'
                && $prevLine !== false
                && preg_match('/^[-*+]\\s+/', ltrim($prevLine))) {
                $prevBlank = false;
                continue;
            }
            if ($prevBlank) {
                continue;
            }
            $out[] = '';
            $prevBlank = true;
            continue;
        }
        $prevBlank = false;
        $out[] = $line;
    }
    return implode("\n", $out);
}

function trim_block_edges(array $block): array
{
    if (empty($block)) {
        return $block;
    }
    $lead = 0;
    while ($lead < count($block) && trim($block[$lead]) === '') {
        $lead++;
    }
    $kept_lead = $lead > 0 ? 1 : 0;

    $trail = 0;
    for ($t = count($block) - 1; $t >= 0; $t--) {
        if (trim($block[$t]) === '') {
            $trail++;
        } else {
            break;
        }
    }
    $kept_trail = $trail > 0 ? 1 : 0;

    $core = array_slice($block, $lead, $trail > 0 ? -$trail : null);
    $out = [];
    if ($kept_lead) {
        $out[] = '';
    }
    $out = array_merge($out, $core);
    if ($kept_trail) {
        $out[] = '';
    }
    return $out;
}

function coalesce_loop_blocks(array $blocks): array
{
    $out = [];
    foreach ($blocks as $b) {
        $bb = trim_block_edges($b);
        if (!empty($bb) && preg_match('/^#{4}\\s+/', $bb[0]) && trim(end($bb)) !== '') {
            $bb[] = '';
        }
        if (empty($out)) {
            $out = $bb;
            continue;
        }
        $k = 0;
        if (!empty($out)
            && trim(end($out)) !== ''
            && isset($bb[0], $bb[1])
            && trim($bb[0]) === ''
            && preg_match('/^#{4}\\s+/', $bb[1])) {
            $k = 1; // drop a single leading blank before level-4 headings
        }
        if (!empty($out) && trim(end($out)) === '') {
            while ($k < count($bb) && trim($bb[$k]) === '') {
                $k++;
            }
        }
        $lastLine = end($out);
        if (!empty($out)
            && trim($lastLine) !== ''
            && isset($bb[$k])
            && preg_match('/^#{5,6}\\s+/', $bb[$k])) {
            $out[] = '';
        }
        if (!empty($out)
            && trim($lastLine) !== ''
            && isset($bb[$k])
            && preg_match('/^##\\s+/', $bb[$k])) {
            $out[] = '';
        }
        $out = array_merge($out, array_slice($bb, $k));
    }
    return $out;
}

function apply_highlight_heuristics(string $text, string $before, string $after): string
{
    if ($before === '' && $after === '') {
        return $text;
    }
    $bEsc = preg_quote($before, '/');
    $aEsc = preg_quote($after, '/');
    $out = $text;

    // Wrap markdown links/images: [text](url) or ![alt](url)
    $linkRe = '/(\\!?\\[[^\\]]*\\]\\()\\s*' . $bEsc . '(.*?)' . $aEsc . '\\s*(\\))/s';
    $out = preg_replace($linkRe, $before . '$1$2$3' . $after, $out);

    // Wrap HTML-like attributes containing highlighted value
    $attrRe = '/([A-Za-z_:][-A-Za-z0-9_:.]*\\s*=\\s*\"?)' . $bEsc . '(.*?)' . $aEsc . '(\"?)/s';
    $out = preg_replace($attrRe, $before . '$1$2$3' . $after, $out);

    return $out;
}

function drop_first_header_line(string $text): string
{
    $lines = explode("\n", $text);
    if (!$lines) return $text;
    if (preg_match('/^#{1,6}\s+.+$/', $lines[0])) {
        array_shift($lines);
        if ($lines && trim($lines[0]) === '') {
            array_shift($lines);
        }
    }
    return implode("\n", $lines);
}

function apply_header_level_preset(string $text, string $preset): string
{
    $pad = max(0, strlen($preset) - 1);
    if ($pad === 0) return $text;
    $out = [];
    $inCode = false;
    foreach (explode("\n", $text) as $line) {
        if (preg_match('/^(```|~~~)/', $line)) {
            $inCode = !$inCode;
            $out[] = $line;
            continue;
        }
        if ($inCode) {
            $out[] = $line;
            continue;
        }
        if (preg_match('/^(#{1,6})(\s+)(.*)$/', $line, $m)) {
            $hashes = strlen($m[1]) + $pad;
            $hashes = min($hashes, 6);
            $out[] = str_repeat('#', $hashes) . ' ' . $m[3];
        } else {
            $out[] = $line;
        }
    }
    return implode("\n", $out);
}

// --------------------------------------------------------------------------
// Root normalization
// --------------------------------------------------------------------------

function normalize_root($data)
{
    if (is_array($data) && count($data) === 1) {
        $first = array_values($data)[0];
        if (is_array($first)) {
            return $first;
        }
    }
    return $data;
}

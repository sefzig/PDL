#!/usr/bin/env php
<?php
require __DIR__ . '/../../packages/php/index.php';

use function PDL\render;

function assert_lines($actual, $expected, $label) {
    if ($actual !== $expected) {
        fwrite(STDERR, sprintf(
            "%s failed\nExpected: %s\nActual:   %s\n",
            $label,
            json_encode($expected),
            json_encode($actual)
        ));
        exit(1);
    }
}

function lines(string $s): array {
    return explode("\n", $s);
}

$out = render("[if:ok]\n  The text.\n[if-end]", ['ok' => true])['markdown'];
assert_lines(lines($out), ['The text.', ''], 'if basic');

$out = render("[if:ok]\n  The text.\n  [if:ok]\n    Another text.\n  [if-end]\n[if-end]", ['ok' => true])['markdown'];
assert_lines(lines($out), ['The text.', 'Another text.', ''], 'nested if');

$out = render("[if:ok]\n      Line A\n        Line B\n[if-end]", ['ok' => true])['markdown'];
assert_lines(lines($out), ['    Line A', '      Line B', ''], 'mixed indent');

$out = render("\t[if:ok]\n\t  Text\n\t[if-end]", ['ok' => true])['markdown'];
assert_lines(lines($out), ['Text', ''], 'tabs');

$out = render("[if:ok]\n  Line A\n  \n  Line B\n[if-end]", ['ok' => true])['markdown'];
assert_lines(lines($out), ['Line A', '', 'Line B', ''], 'blank preserved');

$out = render("[loop:items as=x]\n    - [value:x]\n[loop-end]", ['items' => ['A'], 'dummy' => 1])['markdown'];
assert_lines(lines($out), ['  - A', ''], 'loop indent');

fwrite(STDOUT, "indentation tests passed\n");
exit(0);

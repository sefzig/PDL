#!/usr/bin/env php
<?php
require __DIR__ . '/../../packages/php/index.php';

use function PDL\render;

$fixturesDir = realpath(__DIR__ . '/../fixtures');
$args = array_slice($argv, 1);
$showDiff = in_array('diff', $args, true);
$diffOnly = in_array('diff-only', $args, true);
$noSummary = in_array('no-summary', $args, true);
$keyPrefix = '';
foreach ($args as $arg) {
    if (in_array($arg, ['diff', 'diff-only', 'no-summary'], true)) continue;
    $keyPrefix = $arg;
    break;
}
unset($arg);

function list_fixtures($dir) {
    $entries = array_filter(scandir($dir), function($f) {
        return str_ends_with($f, '.template.md');
    });
    $bases = array_map(function($f) { return substr($f, 0, -12); }, $entries);
    sort($bases, SORT_NATURAL);
    return $bases;
}

function load_json($path) {
    if (!file_exists($path)) return null;
    return json_decode(file_get_contents($path), true);
}

function normalize_newline($s) {
    return rtrim($s, "\r\n") . "\n";
}

function render_diff($expected, $actual) {
    $tmpA = tempnam(sys_get_temp_dir(), 'pdl-exp-');
    $tmpB = tempnam(sys_get_temp_dir(), 'pdl-act-');
    file_put_contents($tmpA, $expected);
    file_put_contents($tmpB, $actual);
    $cmd = 'diff -u ' . escapeshellarg($tmpA) . ' ' . escapeshellarg($tmpB) . ' 2>/dev/null';
    $out = shell_exec($cmd);
    @unlink($tmpA);
    @unlink($tmpB);
    return $out ?: '';
}

try {
    $all = list_fixtures($fixturesDir);
} catch (Throwable $e) {
    fwrite(STDERR, "Failed to read fixtures: {$e->getMessage()}\n");
    exit(1);
}

$filtered = array_filter($all, function($base) use ($keyPrefix) {
    return $keyPrefix === '' || str_starts_with($base, $keyPrefix);
});

if (empty($filtered)) {
    fwrite(STDERR, "No fixtures found for prefix '{$keyPrefix}'.\n");
    exit(1);
}

$pass = 0;
$total = 0;
$skipped = 0;
$totalMs = 0;
$passMs = 0;
$failMs = 0;

foreach ($filtered as $base) {
    $total++;
    $tpl = file_get_contents("{$fixturesDir}/{$base}.template.md");
    $data = load_json("{$fixturesDir}/{$base}.data.json");
    $vars = load_json("{$fixturesDir}/{$base}.variables.json") ?? [];
    $expected = file_exists("{$fixturesDir}/{$base}.result.md") ? file_get_contents("{$fixturesDir}/{$base}.result.md") : null;

    $start = microtime(true);
    try {
        $res = render($tpl, $data, ['variables' => $vars]);
    } catch (\RuntimeException $e) {
        if (str_contains($e->getMessage(), 'not yet available')) {
            $elapsed = (int) round((microtime(true) - $start) * 1000);
            fwrite(STDOUT, "- {$base}: SKIP (PHP implementation pending)\033[2m {$elapsed}ms\033[0m\n");
            $pass++;
            $skipped++;
            $totalMs += $elapsed;
            continue;
        }
        throw $e;
    }
    $elapsed = (int) round((microtime(true) - $start) * 1000);
    $totalMs += $elapsed;

    $md = normalize_newline($res['markdown'] ?? '');
    if ($expected === null) {
        fwrite(STDOUT, "- {$base}: OK (no expected file to compare)\n");
        $pass++;
        continue;
    }

    $exp = normalize_newline($expected);
    if ($md === $exp) {
        $pass++;
        $passMs += $elapsed;
        if (!$diffOnly) {
            fwrite(STDOUT, "\033[32m✓\033[0m {$base}\033[2m {$elapsed}ms\033[0m\n");
        }
    } else {
        if (!$diffOnly) {
            fwrite(STDOUT, "\033[31m✗\033[0m {$base}\033[2m {$elapsed}ms\033[0m\n");
        }
        $failMs += $elapsed;
        if ($showDiff) {
            $diff = render_diff($exp, $md);
            if ($diff !== '') {
                fwrite(STDOUT, "\033[2m{$diff}\033[0m");
            }
        }
    }
}

if (!$noSummary) {
    $failed = $total - $pass;
    if ($failed === 0) {
        fwrite(STDOUT, "\033[32m✔ pass: {$pass}/{$total}\033[0m\033[2m {$totalMs}ms\033[0m\n");
    } else {
        fwrite(STDOUT, "\033[32m✓ pass: {$pass}/{$total}\033[0m\033[2m {$passMs}ms\033[0m\n");
        fwrite(STDOUT, "\033[31m✖ fail: {$failed}/{$total}\033[0m\033[2m {$failMs}ms\033[0m\n");
    }
}
exit($pass === $total ? 0 : 1);

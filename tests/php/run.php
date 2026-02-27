#!/usr/bin/env php
<?php
require __DIR__ . '/../../packages/php/index.php';

use function PDL\render;

$fixturesDir = realpath(__DIR__ . '/../fixtures');
$keyPrefix = $argv[1] ?? '';

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

foreach ($filtered as $base) {
    $total++;
    $tpl = file_get_contents("{$fixturesDir}/{$base}.template.md");
    $data = load_json("{$fixturesDir}/{$base}.data.json");
    $vars = load_json("{$fixturesDir}/{$base}.variables.json") ?? [];
    $expected = file_exists("{$fixturesDir}/{$base}.result.md") ? file_get_contents("{$fixturesDir}/{$base}.result.md") : null;

    try {
        $res = render($tpl, $data, ['variables' => $vars]);
    } catch (\RuntimeException $e) {
        if (str_contains($e->getMessage(), 'not yet available')) {
            fwrite(STDOUT, "- {$base}: SKIP (PHP implementation pending)\n");
            continue;
        }
        throw $e;
    }

    $md = normalize_newline($res['markdown'] ?? '');
    if ($expected === null) {
        fwrite(STDOUT, "- {$base}: OK (no expected file to compare)\n");
        $pass++;
        continue;
    }

    $exp = normalize_newline($expected);
    if ($md === $exp) {
        $pass++;
        fwrite(STDOUT, "\033[32m✓\033[0m {$base}\n");
    } else {
        fwrite(STDOUT, "\033[31m✗\033[0m {$base}\n");
    }
}

if ($pass === $total) {
    exit(0);
}

exit(1);

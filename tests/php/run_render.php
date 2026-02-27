#!/usr/bin/env php
<?php
require __DIR__ . '/../../packages/php/index.php';

use function PDL\render;

if ($argc < 2) {
    fwrite(STDERR, "Usage: php run_render.php <fixture_base>\n");
    exit(1);
}

$base = $argv[1];
$fix = realpath(__DIR__ . '/../fixtures');
$tpl = file_get_contents("{$fix}/{$base}.template.md");
$data = json_decode(file_get_contents("{$fix}/{$base}.data.json"), true);
$varsPath = "{$fix}/{$base}.variables.json";
$vars = file_exists($varsPath) ? json_decode(file_get_contents($varsPath), true) : [];

try {
    $res = render($tpl, $data, ['variables' => $vars]);
} catch (\RuntimeException $e) {
    if (str_contains($e->getMessage(), 'not yet available')) {
        fwrite(STDOUT, "[PDL PHP implementation pending]\n");
        exit(0);
    }
    throw $e;
}

fwrite(STDOUT, $res['markdown'] ?? '');

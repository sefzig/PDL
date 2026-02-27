#!/usr/bin/env php
<?php
$root = realpath(__DIR__ . '/..');
if ($root === false) {
    fwrite(STDERR, "Failed to locate repo root\n");
    exit(1);
}
$src = $root . '/packages/php/src/pdl.php';
$dst = $root . '/dist/pdl.php';
if (!is_dir($root . '/dist')) {
    mkdir($root . '/dist', 0777, true);
}
if (!copy($src, $dst)) {
    fwrite(STDERR, "Copy failed\n");
    exit(1);
}
fwrite(STDOUT, "Wrote dist/pdl.php\n");

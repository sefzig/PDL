<?php
declare(strict_types=1);

// Reference demo: load the PHP PDL engine (adjust path if moved)
require __DIR__ . '/../../packages/php/src/pdl.php';

use function PDL\render;

$fixtureDir = __DIR__ . '/../../tests/fixtures';
$defaultTemplate = file_get_contents($fixtureDir . '/00_hello-world.template.md') ?: '';


$defaultData = file_get_contents($fixtureDir . '/00_hello-world.data.json') ?: '';
$defaultVars = file_get_contents($fixtureDir . '/00_hello-world.variables.json') ?: '';

$templateInput = $_GET['template'] ?? $defaultTemplate;
$dataInput = $_GET['data'] ?? $defaultData;
$varsInput = $_GET['variables'] ?? $defaultVars;

$error = null;
$markdown = '';

$decode = static function (string $raw, string $label) {
    $decoded = json_decode($raw, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new \RuntimeException($label . ' JSON error: ' . json_last_error_msg());
    }
    return $decoded;
};

try {
    $data = $decode($dataInput, 'Data');
    $vars = $decode($varsInput, 'Variables');
    $rendered = render($templateInput, $data, ['variables' => $vars]);
    $markdown = $rendered['markdown'] ?? '';
} catch (\Throwable $t) {
    $error = $t->getMessage();
}

function h(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

?>
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>PDL PHP Form Demo</title>
</head>
<body>
<?php if ($error !== null): ?>
<div><?php echo h($error); ?></div>
<?php endif; ?>
<form method="get">
  <div>
    <label>Template</label><br>
    <textarea name="template" rows="16" cols="100"><?php echo h($templateInput); ?></textarea>
  </div>
  <div>
    <label>Data (JSON)</label><br>
    <textarea name="data" rows="12" cols="100"><?php echo h($dataInput); ?></textarea>
  </div>
  <div>
    <label>Variables (JSON)</label><br>
    <textarea name="variables" rows="4" cols="100"><?php echo h($varsInput); ?></textarea>
  </div>
  <div>
    <button type="submit">Render</button>
  </div>
</form>
<div>
  <label>Rendered Markdown</label><br>
  <textarea rows="20" cols="100" readonly><?php echo h($markdown); ?></textarea>
</div>
</body>
</html>

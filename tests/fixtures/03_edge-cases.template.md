## Bracketed Keys

Quoted key: [value:question["Name Short"]]

## Case-Insensitive Filter

[value:people[role="Owner" ci=true].name]

## Inline If with Nested Value

Status: [if:flags.ready]ready[if-else]pending[if-end]

## Highlight in Links

See [Docs]({Link}) and <a href="{Link}">link</a>

## Set-Only Line

Above
[set:foo=1]
Below

## Condense Cleanup

[condense]
 ( [value:note], )
[condense-end]

## Success / Failure

[value:missing.path failure="fallback"]
[value:present.path success="ok" failure="bad"]

## Invalid Date + Time

[value:timestamp date="%Y-%m-%d" time="%H:%M"]

## List Blank Suppression

- First
[if:missing.key]
- Hidden
[if-end]
- Second

## Humble and Const

[set:bar="local" humble=true]
bar: [value:bar]

[set:baz=1]
[set:baz=2]
baz: [value:baz]

[set:qux=1 const=false]
[set:qux=2]
qux: [value:qux]

## Primitive Loop Join

[loop:tagsPrim as=tag join=", "][value:tag][loop-end]

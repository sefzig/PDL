# PDL Cheatsheet

## Global Variables

* `Screen`

## Directive: Value

Simple paths
* `Digital`
* `[value:release.hero.fallback]`

Filtered paths (number)
* `Screen`
* `Widget`
* `Demo`
* `Widget`
* `Widget`

Filtered paths (combine)
* `Widget`
* `Demo`

Filtered paths (string)
* `30`
* `Widget`
* `Widget`
* `Widget`
* `Widget`

Fallback paths
* `Digital`
* `Screen`
* `missing`

Nested values
* `[value:products[name=[value:release.hero.fallback]].price]`

Existence option
* `yes`
* `no`

Replace values
* `Presentation`
* `Dee`
* `**digital**`

Trim values
* `digital`
* `Digital`
* `DIGITAL`
* `digital`

Tuncate values
* `Lorem ipsum`
* `Lorem ipsum"..."`
* `30`

Format casing
* `diGiTaLProduct`
* `DiGiTaLProduct`
* `di_gi_ta_l_product`
* `DI_GI_TA_L_PRODUCT`

Format dates
* `[value:release.launch.dateUtc date="%d.%m.%Y"]`
* `[value:release.launch.announceLocal date="%d.%m.%Y %H:%M Uhr"]`
* `[value:release.events.launchEpoch date="%d. %B %Y, %H:%M Uhr"]`

Format time
* `[value:release.campaign.durationMs time="%d %H %M"]`
* `[value:release.events.pressConferenceSec time="%H %M" unit=s]`

Escape Markdown
* `[value:release.campaign.noteMd]`
* `[value:release.campaign.noteMd escapeMarkdown=true]`

Stringify data
* `"Digital"`
* `30`
* `{"name":"Demo","price":0,"locations":["Hamburg","München"]}`
* `["Hamburg","München"]`

## Directive: Conditional

Block conditional:
- Premium

Inline conditionals
* `confirms`
* `available`
* `missing`
* `match`
* `prefix`
* `contains`
* `suffix`
* `ci-match`

## Directive: Loop

Simple loop
- `Demo`
- `Widget`
- `Screen`

Filtered loop
- `Widget`
- `Screen`

Inline loop
* `Demo, Widget, Screen`

Indexed loop
- `1`: `Demo`
- `2`: `Widget`
- `3`: `Screen`

Nested loop
- `Demo`
  - `1.1`: `Hamburg`
  - `1.2`: `München`
- `Widget`
  - `2.1`: `Berlin`
  - `2.2`: `München`
- `Screen`
  - `3.1`: `Berlin`
  - `3.2`: `Hamburg`

## Directive: Get / Set

Regular set 
* `Screen Launch`

Mutable set 
* `Revised`

Set array 
* `Web and Email`

Get trimmed 
* `Digital`

Set humble 
* `Digital`

Set in scope
- `Demo`
- `Widget`
- `Screen`
* `missing`

Unset 
* `[get:feature]`

## Directive: Condense

- Launch, ready!

## Comments

* No comment.
* http://example.com//path
* a//b

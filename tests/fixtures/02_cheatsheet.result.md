# PDL Cheatsheet

## Global Variables

* `{Product}`

## Directive: Value

* `Digital`
* `[value:release.hero.fallback]`
* `[value:products[name={Product}].price]`

* `Screen`
* `Screen`
* `Widget`
* `Demo`
* `Widget`
* `Widget`
* `Widget`
* `Widget`
* `Demo`
* `Screen`
* `Screen`

* `[value:products[name=[value:release.hero.fallback]].price]`

* `Digital`
* `[value:missing.key fallback="products[name={Product}].name"]`
* `missing`

* `yes`
* `no`

* `Presentation`
* `Dee`
* `**digital**`

* `digital`
* `Digital`
* `DIGITAL`
* `digital`
* `diGiTaLProduct`
* `DiGiTaLProduct`
* `di_gi_ta_l_product`
* `DI_GI_TA_L_PRODUCT`
* `Lorem ipsum`
* `Lorem ipsum"..."`
* `30`

* `[value:release.launch.dateUtc date="%d.%m.%Y"]`
* `[value:release.launch.announceLocal date="%d.%m.%Y %H:%M Uhr"]`
* `[value:release.events.launchEpoch date="%d. %B %Y, %H:%M Uhr"]`

* `[value:release.campaign.durationMs time="%d %H %M"]`
* `[value:release.events.pressConferenceSec time="%H %M" unit=s]`

* `[value:release.campaign.noteMd]`
* `[value:release.campaign.noteMd escapeMarkdown=true]`

* `"Digital"`
* `30`
* `{"name":"Demo","price":0,"locations":["Hamburg","München"]}`
* `["Hamburg","München"]`

## Directive: Conditional

Undefined

* `confirms`
* `unavailable`
* `missing`
* `match`
* `prefix`
* `contains`
* `suffix`
* `ci-match`

## Directive: Loop

- `Demo`
- `Screen`
- `Widget`

- `Screen`
- `Widget`

* `Demo, Screen, Widget`

- `1`: `Demo`
- `2`: `Screen`
- `3`: `Widget`

- `Demo`
  - `1.1`: `Hamburg`
  - `1.2`: `München`
- `Screen`
  - `2.1`: `Berlin`
  - `2.2`: `Hamburg`
- `Widget`
  - `3.1`: `Berlin`
  - `3.2`: `München`

## Directive: Get / Set

* ``
* `{Product} Launch`

* ``
* `Revised`

* ``
* `Web and Email`

* ``
* `Digital`

* ``
* `Analog`
* ``
* `Digital`


- `Demo`

- `Screen`

- `Widget`

* `missing`

* ``
* `beta`

* ``
* `{"family":"Digital","products":[{"name":"Demo","price":0,"locations":["Hamburg","München"]},{"name":"Screen","price":30,"locations":["Berlin","Hamburg"]},{"name":"Widget","price":10,"locations":["Berlin","München"]}],"locations":[{"name":"Berlin","products":["Screen","Widget"]},{"name":"Hamburg","products":["Demo","Screen"]},{"name":"München","products":["Demo","Widget"]}],"recommendation":"Demo"}`

## Directive: Condense

Launch, ready!

## Comments

* Text
* http://example.com//path
* a//b

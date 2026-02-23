# PDL Cheatsheet

// =================================================
## Global Variables
// =================================================

* {Product} // "Screen"


// =================================================
## Directive: Value
// =================================================

Simple paths
* [value:family] // "Digital"
* [value:release.hero.fallback] // "Widget"

Filtered paths (number)
* [value:products[price=30].name] // "Screen"
* [value:products[price>0].name] // "Widget"
* [value:products[price<=10].name] // "Widget"
* [value:products[price>=10].name] // "Widget"
* [value:products[price!=0].name] // "Widget"

Filtered paths (combine)
* [value:products[name=Widget&price=10].name] // "Widget"
* [value:products[name=Missing|name=Demo].name] // "Demo"

Filtered paths (string)
* [value:products[name={Product}].price] // "30"
* [value:products[name="WiDgEt"].name ci=true] // "Widget"
* [value:products[name^="Wid"].name] // "Widget"
* [value:products[name$="get"].name] // "Widget"
* [value:products[name*="idg"].name] // "Widget"

Fallback paths
* [value:missing.key fallback=family] // "Digital"
* [value:missing.key fallback="products[name={Product}].name"] // "Screen"
* [value:missing.key fallback=another.missing.key failure="missing"] // "missing"

Nested values
* [value:products[name=[value:release.hero.fallback]].price] // "10"

Existence option
* [value:family success="yes" failure="no"] // "yes"
* [value:missing.key success="yes" failure="no"] // "no"

Replace values
* [value:products[name=Demo].name replace="Demo:Presentation"] // "Presentation"
* [value:products[name=Demo].name replace="emo:ee"] // "Dee"
* [value:family replace="s/Digital/**digital**/"] // "**Digital**"

Trim values
* [value:family replace="Digital:  digital  " trim=true] // "digital"
* [value:family replace="Digital:DiGiTaL" title=true] // "Digital"
* [value:family replace="Digital:DiGiTaL" upper=true] // "DIGITAL"
* [value:family replace="Digital:DiGiTaL" lower=true] // "digital"

Tuncate values
* [value:family replace="Digital:Lorem ipsum dolor sit amet" truncate=11] // "Lorem ipsum"
* [value:family replace="Digital:Lorem ipsum dolor sit amet" truncate=11 suffix="..."] // "Lorem ipsum..."
* [value:products[name=Screen].price truncate=1 suffix="?"] // "30"

Format casing
* [value:family replace="Digital:DiGiTaL product" lowerCamel=true] // "digitalProduct"
* [value:family replace="Digital:DiGiTaL product" upperCamel=true] // "DigitalProduct"
* [value:family replace="Digital:DiGiTaL product" lowerSnake=true] // "digital_product"
* [value:family replace="Digital:DiGiTaL product" upperSnake=true] // "DIGITAL_PRODUCT"

Format dates
* [value:release.launch.dateUtc date="%d.%m.%Y"] // "06.02.2026"
* [value:release.launch.announceLocal date="%d.%m.%Y %H:%M Uhr"] // "01.02.2026 09:00 Uhr"
* [value:release.events.launchEpoch date="%d. %B %Y, %H:%M Uhr"] // "06. Februar 2026, 10:00 Uhr"

Format time
* [value:release.campaign.durationMs time="%d %H %M"] // "7 Tage"
* [value:release.events.pressConferenceSec time="%H %M" unit=s] // "1 Stunde 30 Minuten"

Escape Markdown
* [value:release.campaign.noteMd] // "Launch **Today**"
* [value:release.campaign.noteMd escapeMarkdown=true] // "Launch \*\*Today\*\*"

Stringify data
* [value:family stringify=true] // "\"Digital\""
* [value:products[name=Screen].price stringify=true] // "30"
* [value:products[0] stringify=true] // {"name":"Demo","price":0,"locations":["Hamburg","München"]}
* [value:products[name=Demo].locations stringify=true] // ["Hamburg","München"]


// =================================================
## Directive: Conditional
// =================================================

Block conditional:
[if:products[name={Product}].price>20]
- Premium
[if-elif:products[name={Product}].price>10]
- Mid
[if-elif:products[name={Product}].price>0]
- Affordable
[if-else]
- Undefined
[if-end]

Inline conditionals
* [if:products[name=Screen].price=30]confirms[if-else]denies[if-end] // "confirms"
* [if:products[name={Product}].price>0]available[if-else]unavailable[if-end] // "available"
* [if:release.hero.fallback]exists[if-else]missing[if-end] // "exists"
* [if:family="Digital"]match[if-else]no-match[if-end] // "match"
* [if:family^="Dig"]prefix[if-else]no-prefix[if-end] // "prefix"
* [if:family*="git"]contains[if-else]no-contains[if-end] // "contains"
* [if:family$="tal"]suffix[if-else]no-suffix[if-end] // "suffix"
* [if:family="digital" ci=true]ci-match[if-else]no[if-end] // "ci-match"


// =================================================
## Directive: Loop
// =================================================

Simple loop
[loop:products as=product]
- [value:product.name]
[loop-end]

Filtered loop
[loop:products[price>0] as=product]
- [value:product.name]
[loop-end]

Inline loop
* [loop:products as=product join=", "][value:product.name][loop-end] // "Demo, Screen, Widget"

Indexed loop
[loop:products as=product]
- [loop-index]: [value:product.name]
[loop-end]

Nested loop
[loop:products as=product]
- [value:product.name]
  [loop:product.locations as=location]
  - [loop-index]: [value:location]
  [loop-end]
[loop-end]


// =================================================
## Directive: Get / Set
// =================================================

Regular set [set:headline="{Product} Launch"]
* [get:headline] // "Screen Launch"

Mutable set [set:headline="Revised" const=false]
* [get:headline] // "Revised"

Set array [set:channels=["Web","Email"]]
* [loop:channels as=channel join=" and "][value:channel][loop-end] // "Web and Email"

Get trimmed [set:label="  digital  "]
* [get:label trim=true title=true] // "Digital"

Set humble [set:family="Analog" const=false][set:family="Digital" humble=false]
* [value:family] // "Analog"

Set in scope
[loop:products as=p]
[set:temp=[value:p.name] scope=true]- [value:temp] // Fix in library: Set uses a line
[loop-end]
* [get:temp failure="missing"] // "missing"

Unset [set:feature=null]
* [get:feature] // the directive


// =================================================
## Directive: Condense
// =================================================

- [condense]
Launch ,  ready !
[condense-end]


// =================================================
## Comments
// =================================================

* No comment. // This comment is removed
* http://example.com//path // "http://example.com//path"
* a//b // "a//b"

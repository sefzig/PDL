# PDL Cheatsheet

// =================================================
## Global Variables
// =================================================

* `{Product}` // "Screen"


// =================================================
## Directive: Value
// =================================================

* `[value:family]` // "Digital"
* `[value:release.hero.fallback]` // "Widget"
* `[value:products[name={Product}].price]` // "30"

* `[value:products[price>0].name]` // "Widget"
* `[value:products[price=30].name]` // "Screen"
* `[value:products[name=Widget&price=10].name]` // "Widget"
* `[value:products[name=Missing|name=Demo].name]` // "Demo"
* `[value:products[name="WiDgEt"].name ci=true]` // "Widget"
* `[value:products[name^="Wid"].name]` // "Widget"
* `[value:products[name$="get"].name]` // "Widget"
* `[value:products[name*="idg"].name]` // "Widget"
* `[value:products[price<=10].name]` // "Widget"
* `[value:products[price>=10].name]` // "Widget"
* `[value:products[price!=0].name]` // "Widget"

* `[value:products[name=[value:release.hero.fallback]].price]` // "10"

* `[value:missing.key fallback=family]` // "Digital"
* `[value:missing.key fallback="products[name={Product}].name"]` // "Screen"
* `[value:missing.key fallback=another.missing.key failure="missing"]` // "missing"

* `[value:family success="yes" failure="no"]` // "yes"
* `[value:missing.key success="yes" failure="no"]` // "no"

* `[value:products[name=Demo].name replace="Demo:Presentation"]` // "Presentation"
* `[value:products[name=Demo].name replace="emo:ee"]` // "Dee"
* `[value:family replace="s/Digital/**digital**/"]` // "**Digital**"

* `[value:family replace="Digital:  digital  " trim=true]` // "digital"
* `[value:family replace="Digital:DiGiTaL" title=true]` // "Digital"
* `[value:family replace="Digital:DiGiTaL" upper=true]` // "DIGITAL"
* `[value:family replace="Digital:DiGiTaL" lower=true]` // "digital"
* `[value:family replace="Digital:DiGiTaL product" lowerCamel=true]` // "digitalProduct"
* `[value:family replace="Digital:DiGiTaL product" upperCamel=true]` // "DigitalProduct"
* `[value:family replace="Digital:DiGiTaL product" lowerSnake=true]` // "digital_product"
* `[value:family replace="Digital:DiGiTaL product" upperSnake=true]` // "DIGITAL_PRODUCT"
* `[value:family replace="Digital:Lorem ipsum dolor sit amet" truncate=11]` // "Lorem ipsum"
* `[value:family replace="Digital:Lorem ipsum dolor sit amet" truncate=11 suffix="..."]` // "Lorem ipsum..."
* `[value:products[name=Screen].price truncate=1 suffix="?"]` // "30"

* `[value:release.launch.dateUtc date="%d.%m.%Y"]` // "06.02.2026"
* `[value:release.launch.announceLocal date="%d.%m.%Y %H:%M Uhr"]` // "01.02.2026 09:00 Uhr"
* `[value:release.events.launchEpoch date="%d. %B %Y, %H:%M Uhr"]` // "06. Februar 2026, 10:00 Uhr"

* `[value:release.campaign.durationMs time="%d %H %M"]` // "7 Tage"
* `[value:release.events.pressConferenceSec time="%H %M" unit=s]` // "1 Stunde 30 Minuten"

* `[value:release.campaign.noteMd]` // "Launch **Today**"
* `[value:release.campaign.noteMd escapeMarkdown=true]` // "Launch \*\*Today\*\*"

* `[value:family stringify=true]` // "\"Digital\""
* `[value:products[name=Screen].price stringify=true]` // "30"
* `[value:products[0] stringify=true]` // {"name":"Demo","price":0,"locations":["Hamburg","München"]}
* `[value:products[name=Demo].locations stringify=true]` // ["Hamburg","München"]


// =================================================
## Directive: Conditional
// =================================================

[if:products[name={Product}].price>20]
Premium
[if-elif:products[name={Product}].price>10]
Mid
[if-elif:products[name={Product}].price>0]
Affordable
[if-else]
Undefined
[if-end]

* `[if:products[name=Screen].price=30]confirms[if-else]denies[if-end]` // "confirms"
* `[if:products[name={Product}].price>0]available[if-else]unavailable[if-end]` // "available"
* `[if:release.hero.fallback]exists[if-else]missing[if-end]` // "exists"
* `[if:family="Digital"]match[if-else]no-match[if-end]` // "match"
* `[if:family^="Dig"]prefix[if-else]no-prefix[if-end]` // "prefix"
* `[if:family*="git"]contains[if-else]no-contains[if-end]` // "contains"
* `[if:family$="tal"]suffix[if-else]no-suffix[if-end]` // "suffix"
* `[if:family="digital" ci=true]ci-match[if-else]no[if-end]` // "ci-match"


// =================================================
## Directive: Loop
// =================================================

[loop:products as=product]
- `[value:product.name]`
[loop-end]

[loop:products[price>0] as=product]
- `[value:product.name]`
[loop-end]

* `[loop:products as=product join=", "][value:product.name][loop-end]` // "Demo, Screen, Widget"

[loop:products as=product]
- `[loop-index]`: `[value:product.name]`
[loop-end]

[loop:products as=product]
- `[value:product.name]`
  [loop:product.locations as=location]
  - `[loop-index]`: `[value:location]`
  [loop-end]
[loop-end]


// =================================================
## Directive: Get / Set
// =================================================

* `[set:headline="{Product} Launch"]`
* `[get:headline]` // "Screen Launch"

* `[set:headline="Revised" const=false]`
* `[get:headline]` // "Revised"

* `[set:channels=["Web","Email"]]`
* `[loop:channels as=channel join=" and "][value:channel][loop-end]` // "Web and Email"

* `[set:label="  digital  "]`
* `[get:label trim=true title=true]` // "Digital"

* `[set:family="Analog" const=false]`
* `[value:family]` // "Analog"
* `[set:family="Digital" humble=false]`
* `[value:family]` // "Digital"

[loop:products as=p]
[set:temp=[value:p.name] scope=true]
- `[value:temp]`
[loop-end]

* `[get:temp failure="missing"]` // "missing"

* `[set:feature=alpha][set:feature=beta const=false]`
* `[get:feature]` // "beta"

* `[set:feature=null]`
* `[get:feature fallback="{Product}"]` // "Screen"


// =================================================
## Directive: Condense
// =================================================

[condense]
Launch ,  ready !
[condense-end]


// =================================================
## Comments
// =================================================

* Text // removed
* http://example.com//path // "http://example.com//path"
* a//b // "a//b"
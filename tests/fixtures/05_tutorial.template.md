# PDL: Prompt Data Language

_PDL combines data and a template to produce Markdown._

In this template, we will prepare a small product launch briefing together using structured data.
The JSON data provided contains all products, locations, and release information.
It is structured with named fields, nested objects, and lists.

The sections below are grouped by capability.
Lines that contain PDL (like `[directive:...]`) end with `// "expected output"` so you can verify the result as you read.


// =================================================
## Global Variables ✔
// =================================================

_Before we dive in, let's understand how dynamic PDL is._

Any automation can inject global variables:
* The product chosen for the launch (in `.variable.json`) is `{Product}`. // "Screen"

Any word in curly braces is a candidate for a global variable. 
If it exists in `.variable.json`, it will be replaced before PDL is processed.

This template will make extensive use of this, so watch out for the curly braces!_


// =================================================
## Directive: Value ✔
// =================================================

_We begin by retrieving the facts needed for the briefing._

// -------------------------------------------------
### Value retrieval ✔
// -------------------------------------------------

*Read a field directly from the data.*

Let's get a value from the data by providing its key:
* The product belongs to the `[value:family]` family. // "Digital"

We can also provide a path:
* If `{Product}` doesn't work, we will advertise the `[value:release.hero.fallback]`. // "Widget"

// -------------------------------------------------
### Filtering values ✔
// -------------------------------------------------

*Select the first item that matches a condition.*

Filtered by number:
* The cheapest priced product is `[value:products[price>0].name]`. // "Widget"
* The product that costs 30€ is `[value:products[price=30].name]`. // "Screen"

Filtered by name:
* The {Product} costs `[value:products[name={Product}].price]`€. // "30"
* Customers like the Widget for `[value:products[name=Widget].price]`€. // "10"

Combine conditions:
* AND: `[value:products[name=Widget&price=10].name]` (name=Widget&price=10) // "Widget"
* OR:  `[value:products[name=Missing|name=Demo].name]` (name=Missing|name=Demo) // "Demo"

Case-insensitive matching:
* A WiDgEt is a `[value:products[name="WiDgEt"].name ci=true]`, period. // "Widget"
* And a Widget stays a `[value:products[name="Widget"].name ci=true]`. // "Widget"
* And so does wIdGeT: `[value:products[name="wIdGeT" ci].name]`. // "Widget"

// -------------------------------------------------
### Nested values ✔
// -------------------------------------------------

*Resolve one value inside another when data depends on data.*

Global variables can live inside directives:
* We recommend the `{Product}` for the price of `[value:products[name={Product}].price]`€. // "Screen"; "30"

And so can PDL values:
* But if `{Product}` is broken, we recommend the `[value:release.hero.fallback]` for `[value:products[name=[value:release.hero.fallback]].price]`€. // "Widget"; "10"

// -------------------------------------------------
### Unresolved values ✔
// -------------------------------------------------

*When a path cannot be resolved, behavior is explicit.*

Missing data keeps the directive visible (so it’s easy to spot):
* The missing value is `[value:missing.key]`. // "[value:missing.key]"

We can provide an alternative path:
* The fallback family is `[value:missing.family fallback=family]`. // "Digital"

The fallback can be a nested path:
* The fallback product is `[value:missing.key fallback="products[name={Product}].name"]`. // "Screen"

If nothing resolves, we will use a failure value:
* `[value:missing.key fallback=another.missing.key failure="We are missing data here."]` // "We are missing data here."

// -------------------------------------------------
### Existence checks ✔
// -------------------------------------------------

*Sometimes we only need to know whether the original path resolves.*

Existing keys will succeed:
* The family `[value:family success="exists" failure="is missing"]`. // "exists"

But missing keys will fail:
* This key `[value:missing.key success="exists" failure="is missing"]`. // "is missing"

The fallback path might help:
* The family `[value:missing.key fallback=family success="exists" failure="is missing"]`. // "exists"
* A missing key `[value:missing.key fallback=another.missing.key success="exists" failure="is missing"]`. // "is missing"

// -------------------------------------------------
### Selector variants ✔
// -------------------------------------------------

*Selectors support different comparisons and matching styles.*

PDL supports most common operators:
* Price filter with `!=`: `[value:products[price!=0&name!=Widget].name]` // "Screen"
* Cheapest item priced `<=10`: `[value:products[price<=10].name]` // "Widget"
* Name starting with "Wid" (`^=`): `[value:products[name^="Wid"].name]` // "Widget"
* Name ending with "get" (`$=`): `[value:products[name$="get"].name]` // "Widget"

Eventually the path is complicated:
* We will spend `[value:release.campaign.metrics["Ad Spend €"]]`€ on ads... // "120000"
* ...because the product is `[value:release.campaign.taglineWrap.tagline]`. // "Future-ready"

// -------------------------------------------------
### Replacing values ✔
// -------------------------------------------------

*Before publishing, we might want to adjust the wording.*

We can replace certain values:
* We will replace "Demo" with `[value:products[name=Demo].name replace="Demo:Presentation"]`. // "Presentation"

Or just parts of them:
* For the younger audience, we will call it `[value:products[name=Demo].name replace="emo:ee"]`. // "Dee"

We can keep this flexible too:
* You will like our `[value:products[name={Product}].name replace="Demo:Presentation;Screen:Page;Widget:Module"]`! // "Presentation" or "Page" or "Module"

Or we use Regex for total freedom:
* Let us emphasize the product is `[value:family replace="s/Digital/**digital**/"]`. // "**Digital**"

// -------------------------------------------------
### Formatting strings ✔
// -------------------------------------------------

_Also, we will make sure the presentation is well formatted._

We might need to trim whitespace:
* Leading:     `[value:family replace="Digital:    digital" trim=true]` // "digital"
* Trailing:    `[value:family replace="Digital:digital    " trim=true]` // "digital"
* Surrounding: `[value:family replace="Digital:  digital  " trim=true]` // "digital"
* None:        `[value:family replace="Digital:digital"     trim=true]` // "digital"

We might want to adjust the casing:
* Title case: `[value:family replace="Digital:DiGiTaL" title=true]` // "Digital"
* Upper case: `[value:family replace="Digital:DiGiTaL" upper=true]` // "DIGITAL"
* Lower case: `[value:family replace="Digital:DiGiTaL" lower=true]` // "digital"
* Lower camel case: `[value:family replace="Digital:DiGiTaL product" lowerCamel=true]` // "digitalProduct"
* Upper camel case: `[value:family replace="Digital:DiGiTaL product" upperCamel=true]` // "DigitalProduct"
* Lower Snake case: `[value:family replace="Digital:DiGiTaL product" lowerSnake=true]` // "digital_product"
* Upper Snake case: `[value:family replace="Digital:DiGiTaL product" upperSnake=true]` // "DIGITAL_PRODUCT"

We can truncate long texts:
* `[value:family replace="Digital:Lorem ipsum dolor sit amet, consectetur adipiscing elit." truncate=11]` dolor sit amet, ... // "Lorem ipsum"

We can truncate with an ellipsis too:
* `[value:family replace="Digital:Lorem ipsum dolor sit amet, consectetur adipiscing elit." truncate=11 suffix="..."]` // "Lorem ipsum..."

But we cannot truncate numbers:
* `[value:products[name=Screen].price truncate=1 suffix="?"]` // "30"

// -------------------------------------------------
### Formatting date and time ✔
// -------------------------------------------------

*Temporal values can be formatted explicitly and consistently.*

Absolute dates require the "date" option:
* Release date (UTC): `[value:release.launch.dateUtc date="%d.%m.%Y"]` // "06.02.2026"
* Campaign start (Europe/Berlin): `[value:release.launch.announceLocal date="%d.%m.%Y %H:%M Uhr"]` // "01.02.2026 09:00 Uhr"
* Launch event (epoch seconds): `[value:release.events.launchEpoch date="%d. %B %Y, %H:%M Uhr"]` // "06. Februar 2026, 10:00 Uhr"

Relative durations require the "time" option:
* Campaign duration: `[value:release.campaign.durationMs time="%d %H %M"]` // "7 Tage"
* Press conference (unit=s): `[value:release.events.pressConferenceSec time="%H %M" unit=s]` // "1 Stunde 30 Minuten"

Invalid inputs remain explicit:
* `[value:family date="%Y-%m-%d"]` // "[invalid date]"
* `[value:family time="%H %M"]` // "[invalid time]"
* `[value:release.campaign.durationMs date="%Y" time="%H"]` // "[invalid time]"
* `[value:release.launch.dateUtc format="%Y"]` // "[invalid time]"

// -------------------------------------------------
### Formatting data ✔
// -------------------------------------------------

_JSON and Markdown are snowflakes and need careful handling._

Markdown is our default, but we can escape it:
* We will `[value:release.campaign.noteMd]`! // "Launch **Today**"
* But we will `[value:release.campaign.noteMd escapeMarkdown=true]` in a safe way. // "Launch \*\*Today\*\*"

When needed, values can be rendered as stringified JSON:
* `[value:family stringify=true]` // "Digital"
* `[value:products[name=Screen].price stringify=true]` // "30"
* `[value:products[0] stringify=true]` // Stringified object
* `[value:products[name=Demo].locations stringify=true]` // Stringified array

// =================================================
## Directive: Conditional ✔
// =================================================

_Conditions allow the briefing to adapt to the data._

// -------------------------------------------------
### Choosing a branch ✔
// -------------------------------------------------

_Select a statement depending on the facts._

Price assessment for `{Product}`:

[if:products[name={Product}].price>20]
- The `{Product}` is positioned as a premium product.
[if-elif:products[name={Product}].price>10]
- The `{Product}` sits comfortably in the mid-range.
[if-elif:products[name={Product}].price>0]
- The `{Product}` remains accessible in pricing.
[if-elif:products[name={Product}].price=0]
- The `{Product}` is offered free of charge.
[if-else]
- The price of `{Product}` is currently undefined.
[if-end]

// -------------------------------------------------
### Inline decisions ✔
// -------------------------------------------------

_Conditions can control individual words inside a sentence._

We can use the comparisons as in the value directive:
* The pricing review `[if:products[name=Screen].price=30]confirms[if-else]does not confirm[if-end]` that Screen costs exactly 30€. // "confirms"

Also, we can use the global variables for that:
* Including `{Product}` in the campaign `[if:products[name={Product}].price>0]makes sense[if-else]requires reconsideration[if-end]`. // "makes sense"

// -------------------------------------------------
### Checking existence ✔
// -------------------------------------------------

_When no operator is given, existence is evaluated._

If a condition is met, the if branch is printed:
* The fallback product `[if:release.hero.fallback]is available[if-else]is not available[if-end]`. // "is available"

If a condition is not met, the else branch is printed:
* The missing product `[if:missing.key]is available[if-else]is not available[if-end]`. // "is not available"

Conditional branches can be stacked with if-elif:
* But a product from the same family `[if:missing.key]is available[if-elif:family]may be available[if-else]is not available[if-end]`. // "may be available"

// -------------------------------------------------
### Comparing numbers ✔
// -------------------------------------------------

_Numeric comparisons integrate directly into language._

Let us check whether a price is an exact number:
* The {Product} `[if:products[name={Product}].price=30]costs exactly[if-else]does not cost[if-end]` 30€. // "costs exactly"

Let us check whether a price is higher:
* The pricing of `{Product}` does `[if:products[name={Product}].price>20]support[if-else]contradict[if-end]` a premium strategy. // "support"

Let us check whether a price is lower:
* A discount scenario `[if:products[name={Product}].price<20]applies[if-else]does not apply[if-end]` to `{Product}`. // "does not apply"

Values that look numeric are compared numerically:
* The stored price `"30"` `[if:products[name={Product}].price="30"]matches[if-else]differs from[if-end]` the numeric value 30. // "matches"

// -------------------------------------------------
### Comparing text ✔
// -------------------------------------------------

_Text comparisons shape positioning._

We will compare whether the product name matches in various ways:
* Our product line `[if:family="Digital"]belongs[if-else]does not belong[if-end]` to the Digital family. // "belongs"
* The category name `[if:family^="Dig"]starts[if-else]does not start[if-end]` with “Dig”. // "starts"
* The family description `[if:family*="git"]contains[if-else]does not contain[if-end]` the fragment “git”. // "contains"
* Case-insensitive comparison `[if:family="digital" ci=true]recognizes[if-else]ignores[if-end]` lowercase input. // "recognizes"

// -------------------------------------------------
### Nesting conditions ✔
// -------------------------------------------------

_Conditions can refine each other._

[if:products[name={Product}].name=release.hero.fallback]
- `{Product}` matches the configured fallback product.
[if-else]
- `{Product}` differs from the fallback.
  [if:products[name={Product}].price>0]
- Nevertheless, it remains commercially available.
  [if-end]
[if-end]

// -------------------------------------------------
### Handling whitespace ✔
// -------------------------------------------------

_When no branch produces output, spacing adjusts automatically._

This list remains clean:
- First item.
[if:missing.key]
- Hidden item.
[if-end]
- Second item.

// =================================================
## Directive: Loop ✔
// =================================================

_When multiple entries exist, repetition is handled declaratively._

// -------------------------------------------------
### Listing items ✔
// -------------------------------------------------

_Generate structured content from collections._

The launch briefing includes:
[loop:products as=product empty="No products available."]
- The product `[value:product.name]`, offered for `[value:product.price]`€.
[loop-end]

A compact overview:
* The portfolio consists of `[loop:products as=product join=", "][value:product.name][loop-end]`. // "Demo, Screen, Widget"

// -------------------------------------------------
### Filtering lists ✔
// -------------------------------------------------

_Conditions narrow the selection before repetition._

The paid products are:
[loop:products[price>0] as=product empty="No paid products."]
- `[value:product.name]` contributes to revenue.
[loop-end]

A compact overview:
* The portfolio consists of `[loop:products[price>0] as=product join=", "][value:product.name][loop-end]`. // "Screen, Widget"

// -------------------------------------------------
### Nested lists ✔
// -------------------------------------------------

_Structure can mirror data depth._

Each product is available in:
[loop:products as=product empty="No products available."]
- `[value:product.name]`
  [loop:product.locations as=location empty="No locations."]
  - Market: `[value:location]`
  [loop-end]
[loop-end]

// -------------------------------------------------
### Using the index ✔
// -------------------------------------------------

_An index reflects position automatically._

Ordered overview:
[loop:products as=product]
- Position `[loop-index]`: `[value:product.name]`
[loop-end]

// =================================================
## Directive: Get/Set ✔
// =================================================

_Variables allow structured decisions within the template._

// -------------------------------------------------
### Defining variables ✔
// -------------------------------------------------

_Variables are constant unless declared otherwise._

We compute and set a local variable: [set:headline="{Product} Launch"]
* The campaign headline currently reads `[get:headline]`. // "Screen Launch"

We try to overwrite the local variable: [set:headline="Revised Launch"]
* The headline still reads `[get:headline]`. // "Screen Launch"

// -------------------------------------------------
### Variable lists ✔
// -------------------------------------------------

_Variables can store collections._

We define a local variable with a list: [set:channels=["Web","Email"]]
* The campaign runs across `[loop:channels as=channel join=" and "][value:channel][loop-end]`. // "Web and Email"

// -------------------------------------------------
### Formatting variables ✔
// -------------------------------------------------

_Formatting applies at retrieval time._

We define a malformed label: [set:label="  digital  "]
* The label however is formated as `[get:label trim=true title=true]`. // "DIGITAL"

// -------------------------------------------------
### Humble variables ✔
// -------------------------------------------------

_A humble variable defers to existing data._

Variables can be configured to be writable: [set:family="Analog" const=false]
* The temporary family setting shows as `[value:family]`. // "Analog"

But only if configured as non-humble: [set:family="Digital" humble=false]
* The updated family setting shows as `[value:family]`. // "Digital"

// -------------------------------------------------
### Scoped variables ✔
// -------------------------------------------------

_A scoped variable exists only within its block._

Here are scoped variables in a loop:
[loop:products as=p]
[set:temp=[value:p.name] scope=true]- Reviewing `[value:temp]` in detail.
[loop-end]

Outside the loop, the scoped variable `[get:temp failure="is no longer available"]`. // "is no longer available"

// -------------------------------------------------
### Variables in conditions ✔
// -------------------------------------------------

_Variables can guide conditional output._

We can compare variable values as if they were paths:
[if:headline="{Product} Launch"]
- The headline aligns with the globally selected product.
[if-else]
- The headline deviates from the globally selected product.
[if-end]

// -------------------------------------------------
### Edge behavior ✔
// -------------------------------------------------

_Subtle precedence rules remain explicit._

We set a variable twice, but make it non-constant: [set:feature=alpha][set:feature=beta const=false]
- The active feature is `[get:feature]`. // "beta"

Non-constant variables can be nullified: [set:feature=null]
- The feature is `[get:feature failure="gone"]` now. // "gone"


// =================================================
## Miscellaneous ✔
// =================================================

_Smaller features refine presentation and boundaries._

// -------------------------------------------------
### Condensing text ✔
// -------------------------------------------------

_Condense tightens whitespace and punctuation._

This is the final headline:
[condense]
- Launch ,  ready !
[condense-end]

// -------------------------------------------------
### Performance limits ✔
// -------------------------------------------------

_Expansion limits ensure predictable rendering._

* The family name repeated five times becomes `[value:family] [value:family] [value:family] [value:family] [value:family]`. // "Digital Digital Digital Digital Digital"

_To not crush this demo, we do not repeat 50 times..._

// -------------------------------------------------
### Comments ✔
// -------------------------------------------------

_Comments are ignored outside code blocks._

To remind ourselves of information, we can comment inline
* Text // This remark is removed

Which does not harm common syntax like urls and math:
* http://example.com//path // "http://example.com//path"
* a//b // "a//b"

// We can even comment out whole lines
End of the demo!
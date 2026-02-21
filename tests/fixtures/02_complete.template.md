# Test Template

_This prompt template is used to test and document the functionality that PDL directives provide._
_At the end of every line containing an inline directive, a comment shows what the directive is expected to return._ // This is a comment

The selected recommendation is `[value:recommendation]`. // "Demo" or "Screen" or "Widget"

// =================================================
## Directive: Value
// =================================================

_Retrieving a value from the JSON input._

// -------------------------------------------------
### Plain value retrieval
// -------------------------------------------------

The products are in the `[value:family]` family. // "Digital"

// -------------------------------------------------
### Filtered value retrieval
// -------------------------------------------------

Filtered by numeral: // only the first matching item is used
- First priced product in JSON is `[value:products[price>0].name]`. // "Screen"
- First priced product price is `[value:products[price>0].price]`. // "30" // Using bracket-notation alternative to dot-notation?

Filtered by string: // only the first matching item is used
- First product named Demo is `[value:products[name=Demo].name]`. // "Demo"
- Customers like the Widget for `[value:products[name=Widget].price]`€. // "10"

Filtered with AND/OR predicate: // plus numeric type-safety
- AND: `[value:products[name=Widget&price=10].name]` (name=Widget&price=10) // "Widget"
- OR:  `[value:products[name=Missing|name=Demo].name]` (name=Missing|name=Demo) // "Demo"

Case-insensitive filtering:
- Case-insensitive prefix in selector: `[value:products[name^="wid"].name ci=true]` // "Widget"

// -------------------------------------------------
### Nested value retrieval
// -------------------------------------------------

Using recommendation from data vs variable:
* Usually we recommend the `[value:recommendation]` for the price of `[value:products[name=[value:recommendation]].price]`€. // "Demo" or "Screen" or "Widget"; "0" or "30" or "10"
* But to you we recommend the `[value:recommendation]` for `[value:products[name=[value:recommendation]].price]`€. // "Demo" or "Screen" or "Widget"; "0" or "30" or "10"

// -------------------------------------------------
### Unresolved values 
// -------------------------------------------------

This directive should remain visible:
- Missing key: `[value:data.missing.key]` // "[value:data.missing.key]"

This should try to use a default path instead:
- Missing key: `[value:data.missing.key fallback=data.family]` // "Digital"

This should yield an alternative path value:
- Missing key: `[value:data.missing.key fallback="data.products[name=Widget].name"]` // "Widget"

This should yield the default value:
- Missing key: `[value:data.missing.key fallback=data.another.missing.key failure="None worked."]` // "None worked."

// -------------------------------------------------
### Replacement
// -------------------------------------------------

Replace all or parts of the value:
- Replace `Demo` with `Presentation`: `[value:products[name=Demo].name replace="Demo:Presentation"]` // "Presentation"
- Replace `Screen` with `Page`: `[value:products[name=Screen].name replace="Screen:Page"]` // "Page"
- Replace `Widget` with `Module`: `[value:products[name=Widget].name replace="Widget:Module;Widget:Element"]` // "Module" (first pair wins)
- Replace `[value:recommendation]`: `[value:products[name=[value:recommendation]].name replace="Demo:Presentation;Screen:Page;Widget:Module"]` // "Demo" or "Screen" or "Widget"
- Replace with Regex: `[value:family replace="s/Digital/**Digital**/"]` // "**Digital**"

// -------------------------------------------------
### String operations
// -------------------------------------------------

Trim whitespaces:
- Trim "  digital  ": `[value:family replace="Digital:  digital  " trim=true]` // "digital"
- Trim "digital    ": `[value:family replace="Digital:digital    " trim=true]` // "digital"
- Trim "    digital": `[value:family replace="Digital:    digital" trim=true]` // "digital"
- Trim "digital": `[value:family replace="Digital:digital" trim=true]` // "digital"

Adjust case of "DiGiTaL":
- Title Case: `[value:family replace="Digital:DiGiTaL" title=true]` // "Digital"
- Upper Case: `[value:family replace="Digital:DiGiTaL" upper=true]` // "DIGITAL"
- Lower Case: `[value:family replace="Digital:DiGiTaL" lower=true]` // "digital"
- LowerCamel: `[value:family replace="Digital:Digital Product" lowerCamel=true]` // "digitalProduct"
- UpperCamel: `[value:family replace="Digital:Digital Product" upperCamel=true]` // "DigitalProduct"
- LowerSnake: `[value:family replace="Digital:Digital Product" lowerSnake=true]` // "digital_product"
- UpperSnake: `[value:family replace="Digital:Digital Product" upperSnake=true]` // "DIGITAL_PRODUCT"

Truncate strings: // default is no suffix (false)
- Truncate: `[value:family replace="Digital:Lorem ipsum dolor sit amet, consectetur adipiscing elit." truncate=11]` // "Lorem ipsum" (11 characters)
- Truncate suffix: `[value:family replace="Digital:Lorem ipsum dolor sit amet, consectetur adipiscing elit." truncate=11 suffix="..."]` // "Lorem ipsum..." (11 characters plus the elipsis)
- Non-string: `[value:products[name=Screen].price truncate=1 suffix="?"]` // "30" (Truncate number is ignored)

Numeric coercion:
- Selector using numeric-looking string: `[value:products[price="10"].name]` // "Widget"

Escape Markdown or not (default):
- Escape Markdown: `[value:family replace="Digital:**digital**" escapeMarkdown=true]` // "\*\*digital\*\*"
- Do not escape: `[value:family replace="Digital:**Digital**" escapeMarkdown=false]` // "**Digital**"

// -------------------------------------------------
### Selector variants and matching
// -------------------------------------------------

- Price filter with != : first paid product that is not Widget → `[value:products[price!=0&name!=Widget].name]` // "Screen"
- Cheapest item priced <=10: `[value:products[price<=10].name]` // "Widget"
- Name ending with "get" ($=): `[value:products[name$="get"].name]` // "Widget"
- Case-insensitive product search: `[value:products[name="Widget Pro" ci].name]` // "widget pro"

- Bracketed key with space: `[value:release.campaign.metrics["Ad Spend €"]]` // "120000"
- Singleton root is unwrapped: `[value:release.campaign.taglineWrap.tagline]` // "Future-ready"
- Markdown passes through by default: `[value:release.campaign.noteMd]` // "Launch **Jetzt**"
- Markdown with escaping: `[value:release.campaign.noteMd escapeMarkdown=true]` // "Launch \\*\\*Jetzt\\*\\*"

// -------------------------------------------------
### Data Rendering
// -------------------------------------------------

Stringify values:
- String: `[value:family stringify=true]` // "Digital"
- Number: `[value:products[name=Screen].price stringify=true]` // "30" (no quotes in the output)
- Object: `[value:products[0] stringify=true]` // Stringified object
- Array:  `[value:products[name=Demo].locations stringify=true]` // Stringified array

// -------------------------------------------------
### Date and time formatting
// -------------------------------------------------

Everybody is looking forward to the product launch
- Release date (UTC): `[value:release.launch.dateUtc date="%d.%m.%Y"]` // "06.02.2026"

The campaign doesnt even require influencers
- Campaign start (Europe/Berlin): `[value:release.launch.announceLocal date="%d.%m.%Y %H:%M Uhr"]` // "01.02.2026 09:00 Uhr"
- Campaign duration: `[value:release.campaign.durationMs time="%d %H %M"]` // "7 Tage"

Get ready for the physical events
- Launch event (epoch seconds): `[value:release.events.launchEpoch date="%d. %B %Y, %H:%M Uhr"]` // "06. Februar 2026, 10:00 Uhr"
- Press conference (unit=s): `[value:release.events.pressConferenceSec time="%H %M" unit=s]` // "1 Stunde 30 Minuten"

Hopefully nothing goes wrong
- Invalid date using existing string: `[value:family date="%Y-%m-%d"]` // "[invalid date]"
- Invalid duration using existing string: `[value:family time="%H %M"]` // "[invalid time]"
- Mutually exclusive (date + time together): `[value:release.campaign.durationMs date="%Y" time="%H"]` // "[invalid time]"
- Deprecated option format=: `[value:release.launch.dateUtc format="%Y"]` // "[invalid time]" (increments errors_parse)

// -------------------------------------------------
### Existence checks
// -------------------------------------------------

This list checks the existence of keys: // existence based on original, before default. Even with default supplied, existence is checked on the original → still "failure".
- Success on existing: `[value:family success="Success" failure="Failure"]` // "Success"
- Failure on missing:  `[value:data.missing.key success="Success" failure="Failure"]` // "Failure"
- Failure fires even with default: `[value:data.missing.key fallback="Fallback" success="Success" failure="Failure"]` // "Failure"

// -------------------------------------------------
### Null handling
// -------------------------------------------------

- Hero product falls back when null: `[value:release.hero.product fallback=release.hero.fallback]` // "Screen"
- Same with stringify=true (fallback still used): `[value:release.hero.product fallback=release.hero.fallback stringify=true]` // "\"Screen\""
- Null without fallback stays unresolved: `[value:release.hero.product]` // "[value:release.hero.product]"

// =================================================
## Directive: Conditional
// =================================================

_Behave based on JSON data and variables._

// -------------------------------------------------
### Block conditional
// -------------------------------------------------

This is the price assessment for `[value:recommendation]`:
[if:products[name=[value:recommendation]].price>20]
- The price of `[value:recommendation]` is an expensive `[value:products[name=[value:recommendation]].price]`€. // "Demo" or "Screen" or "Widget"; "0" or "30" or "10"
[if-elif:products[name=[value:recommendation]].price>10]
- The price of `[value:recommendation]` is a normal `[value:products[name=[value:recommendation]].price]`€. // "Demo" or "Screen" or "Widget"; "0" or "30" or "10"
[if-elif:products[name=[value:recommendation]].price>0]
- The price of `[value:recommendation]` is a cheap `[value:products[name=[value:recommendation]].price]`€. // "Demo" or "Screen" or "Widget"; "0" or "30" or "10"
[if-elif:products[name=[value:recommendation]].price=0]
- The `[value:recommendation]` is not for sale. // "Demo" or "Screen" or "Widget"
[if-else]
- The price of `[value:recommendation]` is not available. // "Demo" or "Screen" or "Widget"
[if-end]

// -------------------------------------------------
### Inline conditional
// -------------------------------------------------

Sentences with dynamic wording:
- Take the Screen? `[if:products[name=Screen].price>10]Yes[if-elif:products[name=Screen].price>0]Maybe[if-else]No[if-end]`. // "Yes"
- The `[value:recommendation]` is `[if:products[name=[value:recommendation]].price>20]expensive[if-elif:products[name=[value:recommendation]].price>0]cheap[if-elif:products[name=[value:recommendation]].price=0]free[if-else]wrong[if-end]`. // "expensive" or "cheap" or "free"

// -------------------------------------------------
### Comparisons by existence
// -------------------------------------------------

If no operator is used, the path is checked for existence:
- The campaign hero fallback `[if:release.hero.fallback]exists[if-else]is missing[if-end]` // "exists"

// -------------------------------------------------
### Numeric comparisons
// -------------------------------------------------

A list of typesafe comparisons:
* Widget price == 10: `[if:products[name=Widget].price=10]true[if-else]false[if-end]`  // "true"
* Widget price <= 10: `[if:products[name=Widget].price<=10]true[if-else]false[if-end]` // "true"
* Widget price >= 10: `[if:products[name=Widget].price>=10]true[if-else]false[if-end]` // "true"
* Widget price < 10: `[if:products[name=Widget].price<10]true[if-else]false[if-end]`   // "false"
* Widget price > "10": `[if:products[name=Widget].price>10]true[if-else]false[if-end]` // "false"
* Family > 0: `[if:family>0]true[if-else]false[if-end]` // "false"

// -------------------------------------------------
### Coercive comparisons
// -------------------------------------------------

Strings and numbers are comparable:
- "30" = 30: `[if:products[name=Widget].price="10"]true[if-else]false[if-end]` // "true"
- "30" >= 30: `[if:products[name=Screen].price>="30"]true[if-else]false[if-end]` // "true"

// -------------------------------------------------
### String comparisons
// -------------------------------------------------

A value equals:
- Family equals Digital: `[if:family="Digital"]true[if-else]false[if-end]` // "true"
- Family equals Analog:  `[if:family="Analog"]true[if-else]false[if-end]` // "false"

A value does not equal:
- Family not equals Analog:  `[if:family!="Analog"]true[if-else]false[if-end]` // "true"
- Family not equals Digital: `[if:family!="Digital"]true[if-else]false[if-end]` // "false"

A value starts with:
- Family starts with Dig: `[if:family^="Dig"]true[if-else]false[if-end]` // "true"
- Family starts with Ana: `[if:family^="Ana"]true[if-else]false[if-end]` // "false"

A value contains:
- Family contains git: `[if:family*="git"]true[if-else]false[if-end]` // "true"
- Family contains nal: `[if:family*="nal"]true[if-else]false[if-end]` // "false"

A value ends with:
- Family ends with tal: `[if:family$="tal"]true[if-else]false[if-end]` // "true"
- Family ends with log: `[if:family$="log"]true[if-else]false[if-end]` // "false"

Escaped quote literal parsing: // inequality expected
- "Di\"gital" results in `[if:family="Di\"gital"]true[if-else]false[if-end]` but does not break. // "false"

Umlauts should compare:
- München is München: `[if:locations[name="München"].name="München"]true[if-else]false[if-end]` // "true"

Case-insensitive comparison:
- Case-insensitive matching: `[if:family="digital" ci=true]true[if-else]false[if-end]` // "true"
- Not-equal and <= with ci: `[if:products[name=widget pro ci].price<=12]true[if-else]false[if-end]` // "true"

// -------------------------------------------------
### Nested conditional
// -------------------------------------------------

Lines based on the recommendation:
[if:products[name=Demo].name=[value:recommendation]]
- We strongly recommend the Demo. 
  [if:products[name=Demo].price=0]
- Why? Because it is free!
  [if-else]
- But its not free :/.
  [if-end]
[if-else]
- Choose "Demo" as Recommendation (not `[value:recommendation]`) to test. // "Demo" or "Screen" or "Widget"
[if-end]

// -------------------------------------------------
### Whitespace folding
// -------------------------------------------------

This list should have two items: // no extra blank lines
- This is one item.
[if:data.missing=missed]
- This should not render.
[if-end]
- This is another item. // This line must immediately follow "This is one item." without an extra blank line.

Inline-only line removal: // no extra blank lines
[if:products[name=Nope].price>0]invisible[if-elif:products[name=Nope].price=0]still invisible[if-else][if-end] // ""
This line should appear immediately after `Inline-only line removal`.

// =================================================
## Directive: Loop
// =================================================

_Iterate over arrays in the JSON or variables._

// -------------------------------------------------
### Basic loop
// -------------------------------------------------

This is a list of all products:
[loop:products as=product empty="There are no products in the data."]
- `[value:product.name]`: `[value:product.price]`€ // "Demo" or "Screen" or "Widget"; "0" or "30" or "10"
[loop-end]

This is a list that is missing: // missing key
[loop:data.missing as=miss empty="- The data is (intentionally) missing."]
- `[value:miss.name]` // ""
[loop-end]

// -------------------------------------------------
### Filtered loop
// -------------------------------------------------

This is a filtered list: // all non-free products
[loop:products[price>0] as=product empty="- There are no non-free products in the data."]
- `[value:product.name]`: `[value:product.price]`€ // "Demo" or "Screen" or "Widget"; "0" or "30" or "10"
[loop-end]

Case-insensitive filter:
[loop:products[name=widget pro ci] as=product join=", " empty="- No matching products."]
[value:product.name]
[loop-end] // "widget pro"

This is an overfiltered list: // products over 100€
[loop:products[price>100] as=product empty="- No product is that expensive."]
- `[value:product.name]` // ""
[loop-end]

// -------------------------------------------------
### Nested loop
// -------------------------------------------------

This is a list of all products and their locations:
[loop:products as=product empty="There are no products in the data."]
- [value:product.name]:
  [loop:product.locations as=location empty="No locations available."]
  - `[value:location]` // Tbd
  [loop-end]
[loop-end]

// -------------------------------------------------
### Loop index
// -------------------------------------------------

This is a list with indices:
[loop:products as=product empty="There are no products in the data."]
- `[loop-index]`: `[value:product.name]` // "n"; "Demo" or "Screen" or "Widget"
[loop-end]

This is a list with indices starting at 4:
[loop:products as=product start=4 empty="There are no products in the data."]
- `[loop-index]`: `[value:product.name]` // "n"; "Demo" or "Screen" or "Widget"
[loop-end]

This is a nested list with indices:
[loop:products as=product empty="There are no products in the data."]
- `[loop-index]`: `[value:product.name]` // "n"; "Demo" or "Screen" or "Widget"
  [loop:product.locations as=location dots=true empty="No locations available."]
  - `[loop-index]`: `[value:location]` // "n.n"; "Berlin" or "Hamburg" or "München"
  [loop-end]
[loop-end]

This is a nested list with flat indices:
[loop:products as=product empty="There are no products in the data."]
- `[value:product.name]`
  [loop:product.locations as=location dots=false empty="No locations available."]
  - `[loop-index]`: `[value:location]` // "n"; "Berlin" or "Hamburg" or "München"
  [loop-end]
[loop-end]

// -------------------------------------------------
### Loop join
// -------------------------------------------------

Inline list from block loop:
[loop:products as=product join="\n---\n"]
- `[value:product.name]` (`[value:product.price]`€)
[loop-end]

Inline list from inline loop:
- `[loop:products as=product join=", "][value:product.name][loop-end]` // "Demo, Screen, Widget, widget pro"

// =================================================
## Directive: Get/Set
// =================================================

_Getting and setting a variable._

// -------------------------------------------------
### Immutable variables (default)
// -------------------------------------------------

Set an immutable variable and try to overwrite it:
- Set "myString" to "Hello world". [set:myString="Hello World"] // const is true by default
- The variable "myString" is `[get:myString]`. // "Hello world"
- Set "myString" to "Hallo Welt". [set:myString="Hallo Welt"]
- The variable "myString" is still `[get:myString]`. // "Hello world"

// -------------------------------------------------
### Mutable variables
// -------------------------------------------------

Set a mutable variable and try to overwrite it:
- Set "myNumber" to "42". [set:myNumber=42 const=false] // setting const to false on purpose
- The variable "myNumber" is `[get:myNumber]`. // "42"
- Set "myNumber" to "43". [set:myNumber=43]
- The variable "myNumber" is now `[get:myNumber]`. // "43"

// -------------------------------------------------
### Get formatting & fallback
// -------------------------------------------------

We have an empty variable set: [set:tempTech=""]
- Empty string: `[get:tempTech fallback=Typescript empty="(empty)" failure="(missing)"]` // "(empty)"
- Missing var triggers failure=: `[get:missingVar failure="(missing)"]` // "(missing)"

String operations:
- Trim + title + replace: [set:aliasTech="  java  "] → `[get:aliasTech trim=true title=true replace="Java:TypeScript"]` // "Typescript"
- Truncate with suffix: [set:longTech="TypeScript for Frontends"] → `[get:longTech truncate=10 suffix="…"]` // "TypeScript…"

Some edge cases to consider:
- Null stays unresolved but fallback works: [set:nullish=null] → `[get:nullish fallback=Typescript stringify=true]` // "\"Typescript\""
- Unsupported default (ignored, parse error): `[get:aliasTech default="PHP" failure="(ignored)"]` // "Typescript"
- Duration formatting on var: [set:sprintMs=5400000] → `[get:sprintMs time="%H %M"]` // "1 hour 30 minutes"

// -------------------------------------------------
### Array variables
// -------------------------------------------------

[set:technologies=["Python","Php"]]
Our technologies are `[loop:technologies as=technology join=" and "][value:technology][loop-end]`. // "Python and Php"

// -------------------------------------------------
### Humble variables
// -------------------------------------------------

[set:technology=Javascript const=false] 
Our humble technology is `[value:technology]`: // "Javascript"
[loop:technologies as=technology] // Using the array variable
- But we use [value:technology]. // "Walking" or "Talking"
[loop-end]

[set:technology=Typescript humble=false] 
But our favorite technology is `[value:technology]`: // "Typescript"
[loop:technologies as=technology] // Using the array variable
- So we use [value:technology]. // "Typescript"
[loop-end]

// -------------------------------------------------
### Scoped variables
// -------------------------------------------------

Shall we use some "Technologia"?
[loop:technologies as=technology] // Using the array variable
  [set:technology=Technologia scope=true humble=false] // Overwriting only within the loop iteration
- Considering to use [value:technology]. // "Technologia"
[loop-end]
- Anyhow, let's stick to [value:technology]. // "Typescript"

// -------------------------------------------------
### Set edge cases
// -------------------------------------------------

- Const flip in same call: [set:feature=alpha] [set:feature=beta const=false] → `[get:feature]` // "beta"
- Scoped temp stays local: [loop:products as=p][set:ghost=[value:p.name] scope=true][loop-end] → `[get:ghost failure="(missing)"]` // "(missing)"
- Null assignment falls back: [set:maybe=null] → `[get:maybe fallback="Typescript"]` // "Typescript"

// -------------------------------------------------
### Variables in conditionals
// -------------------------------------------------

This is how we feel about the technologies:
[if:technology=Typescript]
- Typescript is great!
[if-elif:technology=Javascript]
- Javascript is ok.
[if-elif:technology=Python]
- Python is a pain.
[if-elif:technology=Php]
- Is Php still a thing?
[if-else]
- No known technology...
[if-end]

// =================================================
## Miscellaneous
// =================================================

_Tests that fit no other category._

// -------------------------------------------------
### Condense
// -------------------------------------------------

The condense directive removes all whitespace and certain combinations of special chars into one inline text.

The chosen technology is Typescript: [condense]
  [if:technology=Typescript]
    true
  [if-else]
    false
  [if-end]
[condense-end].

Punctuation tightening: [condense]
Hello ,  world  ( test ) !
[condense-end] // "Hello, world (test)!"

// -------------------------------------------------
### Comments
// -------------------------------------------------

PDL allows for whole-line and in-line comments.

- Inline comment removed // This is an in-line comment (it has whitespace before the `//`
- Literal double-slash are preserved: a//b // "a//b"
- URLs are preserved: http://example.com//path // "http://example.com//path"
- URLs with comment-like syntax are preserved: http://example.com//path // "http://example.com//path"

// -------------------------------------------------
### Performance
// -------------------------------------------------

Expansion budget smoke (many inlines, should not exceed caps)
- Many inlines: `[value:family] [value:family] [value:family] [value:family] [value:family]` // "Digital Digital Digital Digital Digital"
- Budget check: `[loop:products as=p][value:p.name] [loop-end]` // "Demo Screen Widget widget pro "

// =================================================
# End
// =================================================

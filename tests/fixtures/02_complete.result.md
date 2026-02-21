# Test Template

_This prompt template is used to test and document the functionality that PDL directives provide._
_At the end of every line containing an inline directive, a comment shows what the directive is expected to return._

The selected recommendation is `Demo`.

## Directive: Value

_Retrieving a value from the JSON input._

### Plain value retrieval

The products are in the `Digital` family.

### Filtered value retrieval

Filtered by numeral:
- First priced product in JSON is `Screen`.
- First priced product price is `30`.

Filtered by string:
- First product named Demo is `Demo`.
- Customers like the Widget for `10`€.

Filtered with AND/OR predicate:
- AND: `Widget` (name=Widget&price=10)
- OR:  `Demo` (name=Missing|name=Demo)

Case-insensitive filtering:
- Case-insensitive prefix in selector: `Widget`

### Nested value retrieval

Using recommendation from data vs variable:
* Usually we recommend the `Demo` for the price of `0`€.
* But to you we recommend the `Demo` for `0`€.

### Unresolved values 

This directive should remain visible:
- Missing key: `[value:data.missing.key]`

This should try to use a default path instead:
- Missing key: `Digital`

This should yield an alternative path value:
- Missing key: `Widget`

This should yield the default value:
- Missing key: `None worked.`

### Replacement

Replace all or parts of the value:
- Replace `Demo` with `Presentation`: `Presentation`
- Replace `Screen` with `Page`: `Page`
- Replace `Widget` with `Module`: `Module`
- Replace `Demo`: `Presentation`
- Replace with Regex: `**Digital**`

### String operations

Trim whitespaces:
- Trim "  digital  ": `digital`
- Trim "digital    ": `digital`
- Trim "    digital": `digital`
- Trim "digital": `digital`

Adjust case of "DiGiTaL":
- Title Case: `Digital`
- Upper Case: `DIGITAL`
- Lower Case: `digital`
- LowerCamel: `digitalProduct`
- UpperCamel: `DigitalProduct`
- LowerSnake: `digital_product`
- UpperSnake: `DIGITAL_PRODUCT`

Truncate strings:
- Truncate: `Lorem ipsum`
- Truncate suffix: `Lorem ipsum"..."`
- Non-string: `30`

Numeric coercion:
- Selector using numeric-looking string: `Widget`

Escape Markdown or not (default):
- Escape Markdown: `\*\*digital\*\*`
- Do not escape: `**Digital**`

### Selector variants and matching

- Price filter with != : first paid product that is not Widget → `Screen`
- Cheapest item priced <=10: `Demo`
- Name ending with "get" ($=): `Widget`
- Case-insensitive product search: `[value:products[name="Widget Pro" ci].name]`

- Bracketed key with space: `120000`
- Singleton root is unwrapped: `Future-ready`
- Markdown passes through by default: `Launch **Jetzt**`
- Markdown with escaping: `Launch \*\*Jetzt\*\*`

### Data Rendering

Stringify values:
- String: `"Digital"`
- Number: `30`
- Object: `{"name":"Demo","price":0,"locations":["Hamburg","München"]}`
- Array:  `["Hamburg","München"]`

### Date and time formatting

Everybody is looking forward to the product launch
- Release date (UTC): `06.02.2026`

The campaign doesnt even require influencers
- Campaign start (Europe/Berlin): `01.02.2026 09:00 Uhr`
- Campaign duration: `7 days`

Get ready for the physical events
- Launch event (epoch seconds): `06. %B 2026, 11:00 Uhr`
- Press conference (unit=s): `1 hour 30 minutes`

Hopefully nothing goes wrong
- Invalid date using existing string: `[invalid date]`
- Invalid duration using existing string: `[invalid time]`
- Mutually exclusive (date + time together): `[invalid time]`
- Deprecated option format=: `2026-02-06T10:00:00Z`

### Existence checks

This list checks the existence of keys:
- Success on existing: `Success`
- Failure on missing:  `Failure`
- Failure fires even with default: `Failure`

### Null handling

- Hero product falls back when null: `Screen`
- Same with stringify=true (fallback still used): `"Screen"`
- Null without fallback stays unresolved: `[value:release.hero.product]`

## Directive: Conditional

_Behave based on JSON data and variables._

### Block conditional

This is the price assessment for `Demo`:
- The `Demo` is not for sale.

### Inline conditional

Sentences with dynamic wording:
- Take the Screen? `Yes`.
- The `Demo` is `free`.

### Comparisons by existence

If no operator is used, the path is checked for existence:
- The campaign hero fallback `exists`

### Numeric comparisons

A list of typesafe comparisons:
* Widget price == 10: `true`
* Widget price <= 10: `true`
* Widget price >= 10: `true`
* Widget price < 10: `false`
* Widget price > "10": `false`
* Family > 0: `false`

### Coercive comparisons

Strings and numbers are comparable:
- "30" = 30: `true`
- "30" >= 30: `true`

### String comparisons

A value equals:
- Family equals Digital: `true`
- Family equals Analog:  `false`

A value does not equal:
- Family not equals Analog:  `true`
- Family not equals Digital: `false`

A value starts with:
- Family starts with Dig: `true`
- Family starts with Ana: `false`

A value contains:
- Family contains git: `true`
- Family contains nal: `false`

A value ends with:
- Family ends with tal: `true`
- Family ends with log: `false`

Escaped quote literal parsing:
- "Di\"gital" results in `false` but does not break.

Umlauts should compare:
- München is München: `true`

Case-insensitive comparison:
- Case-insensitive matching: `true`
- Not-equal and <= with ci: `false`

### Nested conditional

Lines based on the recommendation:
- We strongly recommend the Demo. 
- Why? Because it is free!

### Whitespace folding

This list should have two items:
- This is one item.
- This is another item.

Inline-only line removal:
This line should appear immediately after `Inline-only line removal`.

## Directive: Loop

_Iterate over arrays in the JSON or variables._

### Basic loop

This is a list of all products:
- `Demo`: `0`€
- `Screen`: `30`€
- `Widget`: `10`€
- `widget pro`: `12`€

This is a list that is missing:
- The data is (intentionally) missing.

### Filtered loop

This is a filtered list:
- `Screen`: `30`€
- `Widget`: `10`€
- `widget pro`: `12`€

Case-insensitive filter:
- No matching products.

This is an overfiltered list:
- No product is that expensive.

### Nested loop

This is a list of all products and their locations:
- Demo:
  - `Hamburg`
  - `München`
- Screen:
  - `Berlin`
  - `Hamburg`
- Widget:
  - `Berlin`
  - `München`
- widget pro:
  - `Berlin`

### Loop index

This is a list with indices:
- `1`: `Demo`
- `2`: `Screen`
- `3`: `Widget`
- `4`: `widget pro`

This is a list with indices starting at 4:
- `4`: `Demo`
- `5`: `Screen`
- `6`: `Widget`
- `7`: `widget pro`

This is a nested list with indices:
- `1`: `Demo`
  - `1.1`: `Hamburg`
  - `1.2`: `München`
- `2`: `Screen`
  - `2.1`: `Berlin`
  - `2.2`: `Hamburg`
- `3`: `Widget`
  - `3.1`: `Berlin`
  - `3.2`: `München`
- `4`: `widget pro`
  - `4.1`: `Berlin`

This is a nested list with flat indices:
- `Demo`
  - `1`: `Hamburg`
  - `2`: `München`
- `Screen`
  - `1`: `Berlin`
  - `2`: `Hamburg`
- `Widget`
  - `1`: `Berlin`
  - `2`: `München`
- `widget pro`
  - `1`: `Berlin`

### Loop join

Inline list from block loop:
- `Demo` (`0`€)\n---\n- `Screen` (`30`€)\n---\n- `Widget` (`10`€)\n---\n- `widget pro` (`12`€)

Inline list from inline loop:
- `Demo, Screen, Widget, widget pro`

## Directive: Get/Set

_Getting and setting a variable._

### Immutable variables (default)

Set an immutable variable and try to overwrite it:
- Set "myString" to "Hello world". 
- The variable "myString" is `Hello World`.
- Set "myString" to "Hallo Welt". 
- The variable "myString" is still `Hello World`.

### Mutable variables

Set a mutable variable and try to overwrite it:
- Set "myNumber" to "42". 
- The variable "myNumber" is `42`.
- Set "myNumber" to "43". 
- The variable "myNumber" is now `43`.

### Get formatting & fallback

We have an empty variable set: 
- Empty string: `(empty)`
- Missing var triggers failure=: `(missing)`

String operations:
- Trim + title + replace:  → `Java`
- Truncate with suffix:  → `TypeScript"…"`

Some edge cases to consider:
- Null stays unresolved but fallback works:  → `[get:nullish fallback=Typescript stringify=true]`
- Unsupported default (ignored, parse error): `  java  `
- Duration formatting on var:  → `1 hour 30 minutes`

### Array variables

Our technologies are `Python and Php`.

### Humble variables

Our humble technology is `Javascript`:
- But we use Javascript.
- But we use Javascript.

But our favorite technology is `Typescript`:
- So we use Typescript.
- So we use Typescript.

### Scoped variables

Shall we use some "Technologia"?
- Considering to use Technologia.
- Considering to use Technologia.
- Anyhow, let's stick to Typescript.

### Set edge cases

- Const flip in same call:   → `beta`
- Scoped temp stays local:  → `[value:p.name]`
- Null assignment falls back:  → `[get:maybe fallback="Typescript"]`

### Variables in conditionals

This is how we feel about the technologies:
- Typescript is great!

## Miscellaneous

_Tests that fit no other category._

### Condense

The condense directive removes all whitespace and certain combinations of special chars into one inline text.

The chosen technology is Typescript: true.

Punctuation tightening: Hello, world (test)!

### Comments

PDL allows for whole-line and in-line comments.

- Inline comment removed
- Literal double-slash are preserved: a//b
- URLs are preserved: http://example.com//path
- URLs with comment-like syntax are preserved: http://example.com//path

### Performance

Expansion budget smoke (many inlines, should not exceed caps)
- Many inlines: `Digital Digital Digital Digital Digital`
- Budget check: `DemoScreenWidgetwidget pro`

# End

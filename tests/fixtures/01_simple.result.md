# PDL Tests

## Value

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

### Existence checks

This list checks the existence of keys:
- Success on existing: `Success`
- Success fires because default works: `Success`
- Failure on missing:  `Failure`
- Failure fires even with default: `Failure`

### Data Rendering

Stringify values:
- String: `"Digital"`
- Number: `30`
- Object: `{"name":"Demo","price":0,"locations":["Hamburg","München"]}`
- Array:  `["Hamburg","München"]`

## Conditional

_Decide based on JSON data and variables._

### Block conditional

This is the price assessment for `Demo`:
- The `Demo` is not for sale.

### Inline conditional

Sentences with dynamic wording:
- Take the Screen? `Yes`.
- The `Demo` is `free`.

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

## Loop

_Iterate over arrays in the JSON or variables._

### Basic loop

This is a list of all products:
- `Demo`: `0`€
- `Screen`: `30`€
- `Widget`: `10`€

This is a list that is missing:
- The data is (intentionally) missing.

### Filtered loop

This is a filtered list:
- `Screen`: `30`€
- `Widget`: `10`€

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

### Loop index

This is a list with indices:
- `1`: `Demo`
- `2`: `Screen`
- `3`: `Widget`

This is a list with indices starting at 4:
- `4`: `Demo`
- `5`: `Screen`
- `6`: `Widget`

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

### Loop join

Inline list from block loop:
Demo, Screen, Widget

Inline list from inline loop:
- `Demo, Screen, Widget`

## Get/Set

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

### Variables in conditionals

This is how we feel about the technologies:
- Typescript is great!

## Miscellaneous

_Tests that fit no other category._

### Performance

Expansion budget smoke (many inlines, should not exceed caps)
- Many inlines: `Digital Digital Digital Digital Digital`

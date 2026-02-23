# PDL: Tutorial

_Prompt Data Language fuses a template with data to produce natural language._

In this template, we will prepare a small product launch briefing together using structured data.
The JSON data provided contains all products, locations, and release information.
It is structured with named fields, nested objects, and lists.

The sections below are grouped by capability.
Lines that contain PDL (like `[directive:...]`) end with `// "expected output"` so you can verify the result as you read.

## Global Variables

_Before we dive in, let's understand how dynamic PDL is._

Any automation can inject global variables:
* The product chosen for the launch (in `.variable.json`) is Screen.

Any word in curly braces is a candidate for a global variable. 
If it exists in `.variable.json`, it will be replaced before PDL is processed.

_This template will make extensive use of this, so watch out for the curly braces!_

## Directive: Value

_We begin by retrieving the facts needed for the briefing._

### Value retrieval

_Read a field directly from the data._

Let's get a value from the data by providing its key:
* The product belongs to the Digital family.

We can also provide a path:
* If Screen doesn't work, we will advertise the Widget.

### Filtering values

_Select the first item that matches a condition._

Filtered by number:
* The first paid product is Widget.
* The product that costs 30€ is Screen.

Filtered by name:
* The Screen costs 30€.
* Customers like the Widget for 10€.

Combine conditions:
* AND: Widget (name=Widget&price=10)
* OR:  Demo (name=Missing|name=Demo)

Case-insensitive matching:
* A WiDgEt is a Widget, period.
* And a Widget stays a Widget.
* And so does wIdGeT: Widget.

### Nested values

_Resolve one value inside another when data depends on data._

Global variables can live inside directives:
* We recommend the Screen for the price of 30€.

And so can PDL values:
* But if Screen is broken, we recommend the Widget for 10€.

### Unresolved values

_When a path cannot be resolved, behavior is explicit._

Missing data keeps the directive visible (so it’s easy to spot):
* The missing value is [value:missing.key].

We can provide an alternative path:
* The fallback family is Digital.

The fallback can be a nested path:
* The fallback product is Screen.

If nothing resolves, we will use a failure value:
* We are missing data here.

### Existence checks

_Sometimes we only need to know whether the original path resolves._

Existing keys will succeed:
* The family exists.

But missing keys will fail:
* This key is missing.

The fallback path might help:
* The fallback exists.

### Selector variants

_Selectors support different comparisons and matching styles._

PDL supports most common operators:
* The first paid product is Widget.
* The discount product is Widget.
* The product starting with "Wid" is Widget.
* The product ending with "get" is Widget.

Sometimes the path becomes more complex:
* We will spend 120000€ on ads...
* ...because the product is Future-ready.

### Replacing values

_Before publishing, we might want to adjust the wording._

We can replace certain values:
* We will replace "Demo" with Presentation.

Or just parts of them:
* For the younger audience, we will call it Dee.

We can keep this flexible too:
* You will like our Page!

Or we use Regex for total freedom:
* Let us emphasize the product is **digital**.

### Formatting strings

_Also, we will make sure the presentation is well formatted._

We might need to trim whitespace:
* Leading:     digital
* Trailing:    digital
* Surrounding: digital
* None:        digital

We might want to adjust the casing:
* Title case: Digital
* Upper case: DIGITAL
* Lower case: digital
* Lower camel case: diGiTaLProduct
* Upper camel case: DiGiTaLProduct
* Lower Snake case: di_gi_ta_l_product
* Upper Snake case: DI_GI_TA_L_PRODUCT

We can truncate long texts:
* Lorem ipsum dolor sit amet.

We can truncate with an ellipsis too:
* Lorem ipsum...

But we cannot truncate numbers:
* 30

### Formatting date and time

_Temporal values can be formatted explicitly and consistently._

Absolute dates require the "date" option:
* Release date (UTC): 06.02.2026
* Campaign start (Europe/Berlin): 01.02.2026 09:00 Uhr
* Launch event (epoch seconds): 06. %B 2026, 11:00 Uhr

Relative durations require the "time" option:
* Campaign duration: 7 days
* Press conference (unit=s): 1 hour 30 minutes

Invalid inputs remain explicit:
* [invalid date]
* [invalid time]
* [invalid time]
* 2026-02-06T10:00:00Z

### Formatting data

_JSON and Markdown are snowflakes and need careful handling._

Markdown is our default, but we can escape it:
* We will Launch **Today**!
* But we will Launch \*\*Today\*\* in a safe way.

When needed, values can be rendered as stringified JSON:
* "Digital"
* 30
* {"name":"Demo","price":0,"locations":["Hamburg","München"]}
* ["Hamburg","München"]

## Directive: Conditional

_Conditions allow the briefing to adapt to the data._

### Choosing a branch

_Select a statement depending on the facts._

Price assessment for Screen:

- The Screen is positioned as a premium product.

### Inline decisions

_Conditions can control individual words inside a sentence._

We can use the comparisons as in the value directive:
* The pricing review confirms that Screen costs exactly 30€.

Also, we can use the global variables for that:
* Including Screen in the campaign makes sense.

### Checking existence

_When no operator is given, existence is evaluated._

If a condition is met, the if branch is printed:
* The fallback product is available.

If a condition is not met, the else branch is printed:
* The missing product is not available.

Conditional branches can be stacked with if-elif:
* But a product from the same family may be available.

### Comparing numbers

_Numeric comparisons integrate directly into language._

Let us check whether the price equals a specific value:
* The Screen costs exactly 30€.

Let us check whether a price is higher:
* The pricing of Screen does support a premium strategy.

Let us check whether a price is lower:
* A discount scenario does not apply to Screen.

Values that look numeric are compared numerically:
* The stored price "30" matches the numeric value 30.

### Comparing text

_Text comparisons shape positioning._

We will compare whether the product name matches in various ways:
* Our product line belongs to the Digital family.
* The category name starts with “Dig”.
* The family description contains the fragment “git”.
* Case-insensitive comparison recognizes lowercase input.

### Nesting conditions

_Conditions can refine each other._

- Screen differs from the fallback.
- Nevertheless, it remains commercially available.

### Handling whitespace

_When no branch produces output, spacing adjusts automatically._

This list remains clean:
- First item.
- Second item.

## Directive: Loop

_When multiple entries exist, repetition is handled declaratively._

### Listing items

_Generate structured content from collections._

The launch briefing includes:
- The product Demo, offered for 0€.
- The product Widget, offered for 10€.
- The product Screen, offered for 30€.

A compact overview:
* The portfolio consists of Demo, Widget, Screen.

### Filtering lists

_Conditions narrow the selection before repetition._

The paid products are:
- Widget contributes to revenue.
- Screen contributes to revenue.

A compact overview:
* The portfolio consists of Widget, Screen.

### Nested lists

_Structure can mirror data depth._

Each product is available in:
- Demo
  - Market: Hamburg
  - Market: München
- Widget
  - Market: Berlin
  - Market: München
- Screen
  - Market: Berlin
  - Market: Hamburg

### Using the index

_An index reflects position automatically._

Ordered overview:
- Position 1: Demo
- Position 2: Widget
- Position 3: Screen

## Directive: Get/Set

_Variables allow structured decisions within the template._

### Defining variables

_Variables are constant unless declared otherwise._

We compute and set a local variable: 
* The campaign headline currently reads Screen Launch.

We try to overwrite the local variable: 
* The headline still reads Screen Launch.

### Variable lists

_Variables can store collections._

We define a local variable with a list: 
* The campaign runs across Web and Email.

### Formatting variables

_Formatting applies at retrieval time._

We define a malformed label: 
* The label however is formated as Digital.

### Humble variables

_A humble variable defers to existing data._

Variables can be configured to be writable: 
* The temporary family setting shows as Analog.

But only if configured as non-humble: 
* The updated family setting shows as Digital.

### Scoped variables

_A scoped variable exists only within its block._

Here are scoped variables in a loop:

- Reviewing Demo in detail.

- Reviewing Widget in detail.

- Reviewing Screen in detail.

Outside the loop, the scoped variable is no longer available.

### Variables in conditions

_Variables can guide conditional output._

We can compare variable values as if they were paths:
- The headline aligns with the globally selected product.

### Edge behavior

_Subtle precedence rules remain explicit._

We set a variable twice, but make it non-constant: 
- The active feature is beta.

Non-constant variables can be nullified: 
- The feature is gone now.

## Miscellaneous

_Smaller features refine presentation and boundaries._

### Condensing text

_Condense tightens whitespace and punctuation._

This is the final headline:
- Launch, ready!

### Performance limits

_Expansion limits ensure predictable rendering._

Here is a naive test for the limits set in configuration:
* The family name repeated five times becomes Digital Digital Digital Digital Digital.

_To keep this demo concise, we do not repeat 50 times..._

### Comments

_Comments are ignored outside code blocks._

To remind ourselves of information, we can comment inline
* Text

Which does not interfere with URLs or other expressions containing double slashes:
* http://example.com//path
* a//b

End of the demo!

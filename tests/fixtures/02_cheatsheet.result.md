# PDL Cheatsheet

## Global Variables

* Screen

## Directive: Value

Simple paths
* Digital
* Widget

Filtered paths (number)
* Screen
* Widget
* Demo
* Widget
* Widget

Filtered paths (combine)
* Widget
* Demo

Filtered paths (string)
* 30
* Widget
* Widget
* Widget
* Widget

Fallback paths
* Digital
* Screen
* missing

Nested values
* 10

Existence option
* yes
* no

Replace values
* Presentation
* Dee
* **digital**

Trim values
* digital
* Digital
* DIGITAL
* digital

Tuncate values
* Lorem ipsum
* Lorem ipsum"..."
* 30

Format casing
* diGiTaLProduct
* DiGiTaLProduct
* di_gi_ta_l_product
* DI_GI_TA_L_PRODUCT

Format dates
* 06.02.2026
* 01.02.2026 09:00 Uhr
* 06. %B 2026, 11:00 Uhr

Format time
* 7 days
* 1 hour 30 minutes

Escape Markdown
* Launch **Today**
* Launch \*\*Today\*\*

Stringify data
* "Digital"
* 30
* {"name":"Demo","price":0,"locations":["Hamburg","München"]}
* ["Hamburg","München"]

## Directive: Conditional

Block conditional:
- Premium

Inline conditionals
* confirms
* available
* exists
* match
* prefix
* contains
* suffix
* ci-match

## Directive: Loop

Simple loop
- Demo
- Widget
- Screen

Filtered loop
- Widget
- Screen

Inline loop
* Demo, Widget, Screen

Indexed loop
- 1: Demo
- 2: Widget
- 3: Screen

Nested loop
- Demo
  - 1.1: Hamburg
  - 1.2: München
- Widget
  - 2.1: Berlin
  - 2.2: München
- Screen
  - 3.1: Berlin
  - 3.2: Hamburg

## Directive: Get / Set

Regular set 
* Screen Launch

Mutable set 
* Revised

Set array 
* Web and Email

Get trimmed 
* Digital

Set humble 
* Digital

Set in scope
- Demo
- Widget
- Screen
* missing

Unset 
* [get:feature]

## Directive: Condense

- Launch, ready!

## Comments

* No comment.
* http://example.com//path
* a//b

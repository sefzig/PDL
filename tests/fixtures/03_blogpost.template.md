# Example

[value:report.author], 
[value:report.date date="%d.%m.%Y"]

// This is the PDL example from the blogpost:

These are the emissions from the products used for the [value:report.subject].
[loop:products as=product]
- *[value:product.name title=true]*: [value:product.emissions] [value:product.unit] -
  [if:product.emissions>{Goal}]
    _We strive to reduce emissions below {Goal}_.
  [if-else]
    Produces sufficiently minimal emissions.
  [if-end]
[loop-end]

// See the "Data" tab for the incoming data.
// See the "Variables" tab for the defined goal.

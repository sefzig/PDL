
# Datapoints Report

[loop:questions as=question start=1 empty="Input is not valid."]
## [value:question[Name Short]]

[if:tables=true|tables="true"]
| Field | Value |
|---|---|
| Name | [value:question[Name Short]] |
| Area | [value:question.Area] |
| VSME | [value:question.VSME] |
| Disclosure Requirement | [value:question[Disclosure Requirement]] |
| Paragraph | [value:question.Paragraph] |
| Tags | [value:question.Tags] |
| Responsible person | [value:question[Responsible person]] |
| Status | [value:question.Status] |
| Activity level | [value:question[Activity level]] |
| Footnote | [value:question.Footnote] |
| Reporting period | [value:question[Reporting period]] |
[if-end]

### Question

[value:question.Question]

### Answer

[condense]
  [if:question.Value!=""&question.Value!=null]
    [value:question.Value]
  [if-else]
    --
  [if-end]
[condense-end]

[loop-end]

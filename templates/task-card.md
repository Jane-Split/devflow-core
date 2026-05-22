# Task Card Template

---
taskId: {{TASK_ID}}
title: {{TITLE}}
type: {{TYPE}} # api-endpoint | ui-component | service | bugfix | refactor | test
priority: {{PRIORITY}} # high | medium | low
status: {{STATUS}} # pending | in_progress | completed | blocked
complexity: {{COMPLEXITY}} # low | medium | high
created: {{CREATED_DATE}}
updated: {{UPDATED_DATE}}
designDocId: {{DESIGN_DOC_ID}}
requirementId: {{REQUIREMENT_ID}}
dependsOn:
  - {{DEPENDENCY_1}}
  - {{DEPENDENCY_2}}
---

## Description

{{DESCRIPTION}}

## Context

### Background

<!-- Provide background context for this task -->

### Related Files

- `{{FILE_PATH_1}}`
- `{{FILE_PATH_2}}`

## Acceptance Criteria

- [ ] {{CRITERIA_1}}
- [ ] {{CRITERIA_2}}
- [ ] {{CRITERIA_3}}

## Technical Specification

### Input

{{INPUT_SPECIFICATION}}

### Output

{{OUTPUT_SPECIFICATION}}

### Interface

```typescript
interface {{INTERFACE_NAME}} {
  // Define interface
}
```

## Implementation Notes

<!-- Add any implementation-specific notes -->

## Output Files

- [ ] `{{OUTPUT_FILE_1}}`
- [ ] `{{OUTPUT_FILE_2}}`

## Testing

### Unit Tests

- [ ] Test: {{TEST_CASE_1}}
- [ ] Test: {{TEST_CASE_2}}

### Integration Tests

- [ ] Test: {{TEST_CASE_1}}

## Verification Checklist

- [ ] Code follows project conventions
- [ ] All acceptance criteria met
- [ ] Tests written and passing
- [ ] No linting errors
- [ ] Documentation updated
- [ ] PR ready for review

## Execution Log

| Timestamp | Action | Result |
|:---|:---|:---|
| {{TIMESTAMP}} | {{ACTION}} | {{RESULT}} |

## Notes

<!-- Additional notes -->

---

*This task card is managed by DevFlow.*

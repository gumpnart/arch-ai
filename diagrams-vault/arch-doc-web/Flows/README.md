# Flows

This folder holds user flows, business process flows, and state machine diagrams.

## Document Types

| Type | Format | Purpose |
|---|---|---|
| User Flow | mermaid flowchart | Step-by-step user journey |
| Business Process | mermaid flowchart | Cross-system process flow |
| State Machine | mermaid stateDiagram | Entity lifecycle / state transitions |

## Mermaid Examples

**Flowchart:**
```mermaid
flowchart TD
  Start([Start]) --> Step1[Step One]
  Step1 --> Decision{Condition?}
  Decision -- Yes --> Step2[Step Two]
  Decision -- No --> End([End])
  Step2 --> End
```

**State Diagram:**
```mermaid
stateDiagram-v2
  [*] --> Draft
  Draft --> InReview : submit
  InReview --> Approved : approve
  InReview --> Draft : reject
  Approved --> [*]
```

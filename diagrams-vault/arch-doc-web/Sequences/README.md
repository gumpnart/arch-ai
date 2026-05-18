# Sequences

This folder holds sequence and interaction diagrams showing how components communicate over time.

## Document Types

| Type | Format | Purpose |
|---|---|---|
| API Call Flow | mermaid sequenceDiagram | REST / gRPC interaction between services |
| Auth Flow | mermaid sequenceDiagram | Login, token refresh, OAuth handshake |
| Event Flow | mermaid sequenceDiagram | Async message / event-driven interactions |

## Mermaid Example

```mermaid
sequenceDiagram
  actor User
  participant Gateway as API Gateway
  participant Auth as Auth Service
  participant Service as Target Service

  User->>Gateway: POST /request
  Gateway->>Auth: Validate token
  Auth-->>Gateway: 200 OK
  Gateway->>Service: Forward request
  Service-->>Gateway: Response
  Gateway-->>User: 200 OK
```

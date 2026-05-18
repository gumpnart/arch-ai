# Infrastructure

This folder holds deployment, cloud, networking, and disaster-recovery documentation.

## Document Types

| Type | Format | Purpose |
|---|---|---|
| Deployment Topology | mermaid graph | Physical / cloud deployment layout |
| Network Diagram | mermaid graph | VPCs, subnets, security groups |
| DR Plan | markdown | Recovery objectives and runbook links |
| CI/CD Pipeline | mermaid flowchart | Build → test → deploy pipeline |

## Mermaid Example

```mermaid
graph TB
  subgraph cloud["Cloud Region"]
    subgraph public["Public Subnet"]
      LB[Load Balancer]
    end
    subgraph private["Private Subnet"]
      App1[App Server 1]
      App2[App Server 2]
      DB[(Database)]
    end
  end
  Internet([Internet]) --> LB
  LB --> App1
  LB --> App2
  App1 --> DB
  App2 --> DB
```

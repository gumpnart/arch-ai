export const TEMPLATES = {
    sad: {
        id: "sad",
        abbr: "SAD",
        name: "Solution Architecture Document",
        category: "foundation",
        mandatory: true,
        when: "Project initiation",
        audience: "Stakeholders, engineers, architects",
        purpose: "Define the overall architecture, decisions, and rationale",
        vaultPath: "vault/Architecture/sad.md",
        frontmatterType: "sad",
        content: `---
title: "{{system_name}} — Solution Architecture Document"
type: sad
status: draft
created: {{date}}
updated: {{date}}
owner: {{author}}
tags: [architecture, sad, {{system_name_slug}}]
relates_to: []
---

# {{system_name}} — Solution Architecture Document

## 1. Executive Summary

{{executive_summary}}

## 2. Business Context

### 2.1 Business Goals
{{business_goals}}

### 2.2 Stakeholders

| Stakeholder | Role | Interest |
|---|---|---|
| {{stakeholder_name}} | {{stakeholder_role}} | {{stakeholder_interest}} |

## 3. System Overview

### 3.1 Scope
{{system_scope}}

### 3.2 System Context

\`\`\`mermaid
C4Context
  title System Context — {{system_name}}
  Person(user, "{{primary_user}}", "{{user_description}}")
  System(system, "{{system_name}}", "{{system_description}}")
  System_Ext(ext1, "{{external_system_1}}", "{{ext1_description}}")
  Rel(user, system, "{{user_interaction}}")
  Rel(system, ext1, "{{system_ext1_interaction}}")
\`\`\`

## 4. Architecture Decisions

### 4.1 Key Decisions

| Decision | Rationale | Alternatives Considered |
|---|---|---|
| {{decision_1}} | {{rationale_1}} | {{alternatives_1}} |

## 5. Architecture Views

### 5.1 Logical Architecture
{{logical_architecture_description}}

### 5.2 Physical Architecture
{{physical_architecture_description}}

## 6. Quality Attributes

| Attribute | Requirement | Mechanism |
|---|---|---|
| Availability | {{availability_target}} | {{availability_mechanism}} |
| Performance | {{performance_target}} | {{performance_mechanism}} |
| Security | {{security_requirement}} | {{security_mechanism}} |
| Scalability | {{scalability_requirement}} | {{scalability_mechanism}} |

## 7. Technology Stack

| Layer | Technology | Version | Rationale |
|---|---|---|---|
| Frontend | {{frontend_tech}} | {{frontend_version}} | {{frontend_rationale}} |
| Backend | {{backend_tech}} | {{backend_version}} | {{backend_rationale}} |
| Database | {{database_tech}} | {{database_version}} | {{database_rationale}} |
| Infrastructure | {{infra_tech}} | {{infra_version}} | {{infra_rationale}} |

## 8. Cross-Cutting Concerns

### 8.1 Security
{{security_approach}}

### 8.2 Observability
{{observability_approach}}

### 8.3 Disaster Recovery
- RTO: {{rto}}
- RPO: {{rpo}}

## 9. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| {{risk_1}} | {{likelihood_1}} | {{impact_1}} | {{mitigation_1}} |

## 10. Open Questions
- [ ] {{open_question_1}}
`,
    },
    nfr: {
        id: "nfr",
        abbr: "NFR",
        name: "Non-Functional Requirements",
        category: "foundation",
        mandatory: true,
        when: "Design phase",
        audience: "Engineers, QA, architects",
        purpose: "Define measurable quality attributes and constraints",
        vaultPath: "vault/Architecture/non-functional-requirements.md",
        frontmatterType: "nfr",
        content: `---
title: "{{system_name}} — Non-Functional Requirements"
type: nfr
status: draft
created: {{date}}
updated: {{date}}
owner: {{author}}
tags: [nfr, quality-attributes, {{system_name_slug}}]
relates_to: [Architecture/sad]
---

# {{system_name}} — Non-Functional Requirements

## 1. Performance

| Metric | Requirement | Measurement Method |
|---|---|---|
| API P99 latency | {{p99_latency}} | APM percentile |
| API P95 latency | {{p95_latency}} | APM percentile |
| Throughput | {{throughput}} | Load test |
| Page load time | {{page_load_time}} | Lighthouse |

## 2. Availability & Reliability

| Metric | Target | Notes |
|---|---|---|
| SLA uptime | {{sla_uptime}} | Measured monthly |
| MTTR | {{mttr}} | From alert to resolution |
| MTBF | {{mtbf}} | Between incidents |
| Error rate | {{error_rate}} | 5xx responses / total |

## 3. Scalability

- **Concurrent users**: {{concurrent_users}}
- **Data volume**: {{data_volume}}
- **Growth projection**: {{growth_projection}}
- **Scale strategy**: {{scale_strategy}}

## 4. Security

| Requirement | Standard/Control | Implementation |
|---|---|---|
| Authentication | {{auth_standard}} | {{auth_implementation}} |
| Authorization | {{authz_standard}} | {{authz_implementation}} |
| Data encryption at rest | {{encryption_at_rest}} | {{encryption_at_rest_impl}} |
| Data encryption in transit | TLS 1.3 | {{tls_implementation}} |
| Compliance | {{compliance_standard}} | {{compliance_scope}} |

## 5. Maintainability

- **Code coverage target**: {{code_coverage}}
- **Documentation**: {{documentation_requirement}}
- **Dependency policy**: {{dependency_policy}}
- **Deployment frequency**: {{deployment_frequency}}

## 6. Observability

| Signal | Tool | Retention | SLO |
|---|---|---|---|
| Metrics | {{metrics_tool}} | {{metrics_retention}} | {{metrics_slo}} |
| Logs | {{logs_tool}} | {{logs_retention}} | {{logs_slo}} |
| Traces | {{traces_tool}} | {{traces_retention}} | {{traces_slo}} |

## 7. Infrastructure Constraints

- **Cloud provider**: {{cloud_provider}}
- **Regions**: {{regions}}
- **Environment parity**: {{env_parity}}
- **Cost ceiling**: {{cost_ceiling}}

## 8. Compliance & Data

- **Data residency**: {{data_residency}}
- **Data retention**: {{data_retention}}
- **PII handling**: {{pii_handling}}
- **Audit logging**: {{audit_logging}}
`,
    },
    "c4-context": {
        id: "c4-context",
        abbr: "C4-L1",
        name: "C4 System Context Diagram",
        category: "diagrams",
        mandatory: true,
        when: "Design phase",
        audience: "All stakeholders",
        purpose: "Show system boundary, users, and external dependencies",
        vaultPath: "vault/Architecture/Diagrams/system-context.md",
        frontmatterType: "c4-context",
        content: `---
title: "{{system_name}} — System Context (C4 Level 1)"
type: c4-context
status: draft
created: {{date}}
updated: {{date}}
owner: {{author}}
tags: [c4, context, diagram, {{system_name_slug}}]
relates_to: [Architecture/sad]
---

# {{system_name}} — System Context

> C4 Level 1: shows {{system_name}} and its relationship to users and external systems.

\`\`\`mermaid
C4Context
  title System Context — {{system_name}}

  Person(primaryUser, "{{primary_user_name}}", "{{primary_user_description}}")
  Person_Ext(extUser, "{{external_user_name}}", "{{external_user_description}}")

  System(mainSystem, "{{system_name}}", "{{system_description}}")

  System_Ext(extSystem1, "{{external_system_1_name}}", "{{external_system_1_description}}")
  System_Ext(extSystem2, "{{external_system_2_name}}", "{{external_system_2_description}}")

  Rel(primaryUser, mainSystem, "{{primary_user_interaction}}", "HTTPS")
  Rel(mainSystem, extSystem1, "{{system_ext1_interaction}}", "{{protocol_1}}")
  Rel(mainSystem, extSystem2, "{{system_ext2_interaction}}", "{{protocol_2}}")
\`\`\`

## Actors

| Actor | Type | Description |
|---|---|---|
| {{primary_user_name}} | Human | {{primary_user_description}} |
| {{external_user_name}} | External User | {{external_user_description}} |

## External Systems

| System | Owner | Integration | Data Exchanged |
|---|---|---|---|
| {{external_system_1_name}} | {{ext1_owner}} | {{ext1_integration}} | {{ext1_data}} |
| {{external_system_2_name}} | {{ext2_owner}} | {{ext2_integration}} | {{ext2_data}} |

## Key Decisions
- {{context_decision_1}}
`,
    },
    "c4-container": {
        id: "c4-container",
        abbr: "C4-L2",
        name: "C4 Container Diagram",
        category: "diagrams",
        mandatory: true,
        when: "Design phase",
        audience: "Engineers, architects",
        purpose: "Show deployable units, technologies, and communication",
        vaultPath: "vault/Architecture/Diagrams/container-diagram.md",
        frontmatterType: "c4-container",
        content: `---
title: "{{system_name}} — Container Diagram (C4 Level 2)"
type: c4-container
status: draft
created: {{date}}
updated: {{date}}
owner: {{author}}
tags: [c4, container, diagram, {{system_name_slug}}]
relates_to: [Architecture/Diagrams/system-context]
---

# {{system_name}} — Container Diagram

> C4 Level 2: shows all deployable containers within {{system_name}}.

\`\`\`mermaid
C4Container
  title Container Diagram — {{system_name}}

  Person(user, "{{user_name}}", "{{user_description}}")

  System_Boundary(sys, "{{system_name}}") {
    Container(frontend, "{{frontend_name}}", "{{frontend_tech}}", "{{frontend_description}}")
    Container(api, "{{api_name}}", "{{api_tech}}", "{{api_description}}")
    Container(worker, "{{worker_name}}", "{{worker_tech}}", "{{worker_description}}")
    ContainerDb(db, "{{db_name}}", "{{db_tech}}", "{{db_description}}")
    ContainerDb(cache, "{{cache_name}}", "{{cache_tech}}", "{{cache_description}}")
    Container(queue, "{{queue_name}}", "{{queue_tech}}", "{{queue_description}}")
  }

  System_Ext(extSystem, "{{external_system}}", "{{ext_description}}")

  Rel(user, frontend, "{{user_frontend_interaction}}", "HTTPS")
  Rel(frontend, api, "API calls", "JSON/HTTPS")
  Rel(api, db, "Reads/Writes", "{{db_protocol}}")
  Rel(api, cache, "Cache", "{{cache_protocol}}")
  Rel(api, queue, "Publishes events", "{{queue_protocol}}")
  Rel(worker, queue, "Consumes events", "{{queue_protocol}}")
  Rel(api, extSystem, "{{api_ext_interaction}}", "{{ext_protocol}}")
\`\`\`

## Containers

| Container | Technology | Responsibility |
|---|---|---|
| {{frontend_name}} | {{frontend_tech}} | {{frontend_responsibility}} |
| {{api_name}} | {{api_tech}} | {{api_responsibility}} |
| {{db_name}} | {{db_tech}} | {{db_responsibility}} |

## Communication Matrix

| From | To | Protocol | Auth |
|---|---|---|---|
| {{frontend_name}} | {{api_name}} | HTTPS | {{frontend_api_auth}} |
| {{api_name}} | {{db_name}} | {{db_protocol}} | {{api_db_auth}} |
`,
    },
    "c4-component": {
        id: "c4-component",
        abbr: "C4-L3",
        name: "C4 Component Diagram",
        category: "diagrams",
        mandatory: false,
        when: "Design phase — per service",
        audience: "Engineers",
        purpose: "Show internal components within a container",
        vaultPath: "vault/Components/{{service_name}}.md",
        frontmatterType: "c4-component",
        content: `---
title: "{{service_name}} — Component Diagram (C4 Level 3)"
type: c4-component
status: draft
created: {{date}}
updated: {{date}}
owner: {{author}}
tags: [c4, component, diagram, {{service_name_slug}}]
relates_to: [Architecture/Diagrams/container-diagram]
---

# {{service_name}} — Component Diagram

> C4 Level 3: internal components of the {{service_name}} container.

\`\`\`mermaid
C4Component
  title Component Diagram — {{service_name}}

  Container_Boundary(svc, "{{service_name}}") {
    Component(controller, "{{controller_name}}", "{{controller_tech}}", "{{controller_description}}")
    Component(service, "{{service_layer_name}}", "{{service_tech}}", "{{service_description}}")
    Component(repo, "{{repository_name}}", "{{repo_tech}}", "{{repo_description}}")
    Component(publisher, "{{publisher_name}}", "{{publisher_tech}}", "{{publisher_description}}")
  }

  ContainerDb(db, "{{db_name}}", "{{db_tech}}", "{{db_description}}")
  Container(queue, "{{queue_name}}", "{{queue_tech}}", "{{queue_description}}")

  Rel(controller, service, "Delegates to")
  Rel(service, repo, "Reads/Writes via")
  Rel(service, publisher, "Publishes via")
  Rel(repo, db, "Queries", "{{db_protocol}}")
  Rel(publisher, queue, "Sends to", "{{queue_protocol}}")
\`\`\`

## Components

| Component | Pattern | Responsibility |
|---|---|---|
| {{controller_name}} | Controller | {{controller_responsibility}} |
| {{service_layer_name}} | Service | {{service_responsibility}} |
| {{repository_name}} | Repository | {{repo_responsibility}} |
| {{publisher_name}} | Publisher | {{publisher_responsibility}} |

## Dependencies
- {{dependency_1}}: {{dependency_1_reason}}
`,
    },
    adr: {
        id: "adr",
        abbr: "ADR",
        name: "Architecture Decision Record",
        category: "decisions",
        mandatory: true,
        when: "When a significant architectural decision is made",
        audience: "Engineers, architects, future team members",
        purpose: "Record architectural decisions with context and consequences",
        vaultPath: "vault/Architecture/ADR/ADR-{{number}}-{{slug}}.md",
        frontmatterType: "adr",
        content: `---
title: "ADR-{{number}}: {{decision_title}}"
type: adr
status: draft
created: {{date}}
updated: {{date}}
owner: {{author}}
deciders: [{{deciders}}]
tags: [adr, decision, {{system_name_slug}}]
relates_to: [Architecture/sad]
---

# ADR-{{number}}: {{decision_title}}

## Status
**{{adr_status}}** — {{date}}

## Context

{{context_description}}

### Forces
- {{force_1}}
- {{force_2}}
- {{force_3}}

## Decision

{{decision_statement}}

## Consequences

### Positive
- {{positive_consequence_1}}
- {{positive_consequence_2}}

### Negative
- {{negative_consequence_1}}
- {{negative_consequence_2}}

### Risks
- {{risk_1}}

## Alternatives Considered

### Option 1: {{option_1_name}}
**Pros**: {{option_1_pros}}
**Cons**: {{option_1_cons}}

### Option 2: {{option_2_name}}
**Pros**: {{option_2_pros}}
**Cons**: {{option_2_cons}}

## Implementation Notes
{{implementation_notes}}

## Review Date
{{review_date}}
`,
    },
    "data-architecture": {
        id: "data-architecture",
        abbr: "DA",
        name: "Data Architecture Document",
        category: "architecture",
        mandatory: true,
        when: "Design phase",
        audience: "Engineers, DBAs, data team",
        purpose: "Document data models, flows, ownership, and governance",
        vaultPath: "vault/Architecture/data-architecture.md",
        frontmatterType: "data-architecture",
        content: `---
title: "{{system_name}} — Data Architecture"
type: data-architecture
status: draft
created: {{date}}
updated: {{date}}
owner: {{author}}
tags: [data, architecture, {{system_name_slug}}]
relates_to: [Architecture/sad, Architecture/Diagrams/container-diagram]
---

# {{system_name}} — Data Architecture

## 1. Data Model

\`\`\`mermaid
erDiagram
  {{entity_1}} {
    {{pk_type}} id PK
    {{field_1_type}} {{field_1_name}}
    {{field_2_type}} {{field_2_name}}
    timestamp created_at
    timestamp updated_at
  }
  {{entity_2}} {
    {{pk_type}} id PK
    {{fk_type}} {{entity_1_fk}} FK
    {{field_3_type}} {{field_3_name}}
  }
  {{entity_3}} {
    {{pk_type}} id PK
    {{fk_type}} {{entity_2_fk}} FK
    {{field_4_type}} {{field_4_name}}
  }
  {{entity_1}} ||--o{ {{entity_2}} : "{{rel_1_label}}"
  {{entity_2}} ||--o{ {{entity_3}} : "{{rel_2_label}}"
\`\`\`

## 2. Data Stores

| Store | Technology | Type | Consistency | Use Case |
|---|---|---|---|---|
| {{store_1_name}} | {{store_1_tech}} | {{store_1_type}} | {{store_1_consistency}} | {{store_1_use}} |
| {{store_2_name}} | {{store_2_tech}} | {{store_2_type}} | {{store_2_consistency}} | {{store_2_use}} |

## 3. Data Flows

### Write Path
{{write_path_description}}

### Read Path
{{read_path_description}}

## 4. Data Governance

| Attribute | Policy |
|---|---|
| PII classification | {{pii_classification}} |
| Retention period | {{retention_period}} |
| Backup schedule | {{backup_schedule}} |
| Encryption | {{encryption_policy}} |

## 5. Data Access Patterns

| Pattern | Query | Index Strategy |
|---|---|---|
| {{pattern_1_name}} | {{pattern_1_query}} | {{pattern_1_index}} |
| {{pattern_2_name}} | {{pattern_2_query}} | {{pattern_2_index}} |

## 6. Migration Strategy
{{migration_strategy}}
`,
    },
    "integration-architecture": {
        id: "integration-architecture",
        abbr: "IA",
        name: "Integration Architecture Document",
        category: "architecture",
        mandatory: true,
        when: "Design phase",
        audience: "Engineers, integration team",
        purpose: "Document API contracts, event flows, and external integrations",
        vaultPath: "vault/Architecture/integration-architecture.md",
        frontmatterType: "integration-architecture",
        content: `---
title: "{{system_name}} — Integration Architecture"
type: integration-architecture
status: draft
created: {{date}}
updated: {{date}}
owner: {{author}}
tags: [integration, api, events, {{system_name_slug}}]
relates_to: [Architecture/sad, Architecture/Diagrams/container-diagram]
---

# {{system_name}} — Integration Architecture

## 1. Integration Overview

\`\`\`mermaid
sequenceDiagram
  participant client as {{client_name}}
  participant gateway as {{gateway_name}}
  participant service as {{service_name}}
  participant db as {{db_name}}
  participant ext as {{external_system_name}}

  client->>gateway: {{request_1}} ({{protocol_1}})
  gateway->>service: {{request_2}}
  service->>db: {{db_operation}}
  db-->>service: {{db_result}}
  service->>ext: {{ext_call}}
  ext-->>service: {{ext_response}}
  service-->>gateway: {{response_1}}
  gateway-->>client: {{response_2}}
\`\`\`

## 2. API Contracts

### {{api_1_name}} ({{api_1_version}})

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| {{endpoint_1_path}} | {{endpoint_1_method}} | {{endpoint_1_auth}} | {{endpoint_1_desc}} |
| {{endpoint_2_path}} | {{endpoint_2_method}} | {{endpoint_2_auth}} | {{endpoint_2_desc}} |

### Request/Response Schema
\`\`\`json
{
  "{{field_1}}": "{{field_1_type}}",
  "{{field_2}}": "{{field_2_type}}"
}
\`\`\`

## 3. Event Catalog

| Event | Producer | Consumers | Schema | Retention |
|---|---|---|---|---|
| {{event_1_name}} | {{event_1_producer}} | {{event_1_consumers}} | {{event_1_schema}} | {{event_1_retention}} |
| {{event_2_name}} | {{event_2_producer}} | {{event_2_consumers}} | {{event_2_schema}} | {{event_2_retention}} |

## 4. External Integrations

| System | Protocol | Auth Method | SLA | Error Handling |
|---|---|---|---|---|
| {{ext_1_name}} | {{ext_1_protocol}} | {{ext_1_auth}} | {{ext_1_sla}} | {{ext_1_error}} |

## 5. Error Handling Strategy
{{error_handling_strategy}}

## 6. Idempotency & Retry Policy
{{idempotency_policy}}
`,
    },
    "security-architecture": {
        id: "security-architecture",
        abbr: "SA",
        name: "Security Architecture Document",
        category: "architecture",
        mandatory: true,
        when: "Design phase",
        audience: "Security team, architects, engineers",
        purpose: "Document security controls, threat model, and compliance",
        vaultPath: "vault/Architecture/security-architecture.md",
        frontmatterType: "security-architecture",
        content: `---
title: "{{system_name}} — Security Architecture"
type: security-architecture
status: draft
created: {{date}}
updated: {{date}}
owner: {{author}}
tags: [security, architecture, {{system_name_slug}}]
relates_to: [Architecture/sad, Architecture/non-functional-requirements]
---

# {{system_name}} — Security Architecture

## 1. Security Overview

\`\`\`mermaid
flowchart TB
  subgraph internet["Internet"]
    user["{{user_type}}"]
  end
  subgraph dmz["DMZ"]
    waf["WAF / CDN"]
    lb["Load Balancer"]
  end
  subgraph app["Application Zone"]
    api["API Layer"]
    auth["Auth Service"]
    worker["Worker"]
  end
  subgraph data["Data Zone"]
    db[("{{db_name}}")]
    secret["Secrets Manager"]
  end

  user -->|HTTPS| waf
  waf --> lb
  lb -->|TLS| api
  api <--> auth
  api --> worker
  api --> db
  api --> secret
\`\`\`

## 2. Threat Model

| Threat | Category | Likelihood | Impact | Control |
|---|---|---|---|---|
| {{threat_1}} | {{threat_1_category}} | {{threat_1_likelihood}} | {{threat_1_impact}} | {{threat_1_control}} |
| {{threat_2}} | {{threat_2_category}} | {{threat_2_likelihood}} | {{threat_2_impact}} | {{threat_2_control}} |

## 3. Authentication & Authorization

### Authentication
- **Method**: {{auth_method}}
- **Token type**: {{token_type}}
- **Token lifetime**: {{token_lifetime}}
- **MFA**: {{mfa_policy}}

### Authorization
- **Model**: {{authz_model}} (RBAC/ABAC/ReBAC)
- **Roles**: {{roles_list}}
- **Policy enforcement**: {{policy_enforcement_point}}

## 4. Network Security

| Control | Implementation | Scope |
|---|---|---|
| TLS | {{tls_version}} | All internal & external traffic |
| WAF | {{waf_solution}} | {{waf_scope}} |
| Network segmentation | {{segmentation_approach}} | {{segmentation_scope}} |

## 5. Data Security

| Classification | Encryption at Rest | Encryption in Transit | Access Control |
|---|---|---|---|
| {{classification_1}} | {{at_rest_1}} | {{in_transit_1}} | {{access_1}} |
| {{classification_2}} | {{at_rest_2}} | {{in_transit_2}} | {{access_2}} |

## 6. Compliance

| Standard | Scope | Controls | Evidence |
|---|---|---|---|
| {{compliance_1}} | {{compliance_1_scope}} | {{compliance_1_controls}} | {{compliance_1_evidence}} |

## 7. Security Testing
- **SAST**: {{sast_tool}}
- **DAST**: {{dast_tool}}
- **Penetration testing**: {{pentest_schedule}}
- **Dependency scanning**: {{dep_scan_tool}}

## 8. Incident Response
{{incident_response_summary}}
`,
    },
    "infrastructure-architecture": {
        id: "infrastructure-architecture",
        abbr: "INFRA",
        name: "Infrastructure Architecture Document",
        category: "architecture",
        mandatory: true,
        when: "Design phase",
        audience: "DevOps, SRE, architects",
        purpose: "Document cloud topology, networking, DR, and IaC",
        vaultPath: "vault/Infrastructure/infrastructure-architecture.md",
        frontmatterType: "infrastructure-architecture",
        content: `---
title: "{{system_name}} — Infrastructure Architecture"
type: infrastructure-architecture
status: draft
created: {{date}}
updated: {{date}}
owner: {{author}}
tags: [infrastructure, cloud, devops, {{system_name_slug}}]
relates_to: [Architecture/sad, Architecture/security-architecture]
---

# {{system_name}} — Infrastructure Architecture

## 1. Infrastructure Overview

\`\`\`mermaid
flowchart TB
  subgraph cloud["{{cloud_provider}} — {{region}}"]
    subgraph vpc["VPC {{vpc_cidr}}"]
      subgraph public["Public Subnets"]
        lb["Load Balancer"]
        nat["NAT Gateway"]
      end
      subgraph private["Private Subnets"]
        asg["Auto Scaling Group\n{{compute_type}}"]
        workers["Workers\n{{worker_type}}"]
      end
      subgraph data["Data Subnets"]
        db[("{{db_name}}\n{{db_engine}}")]
        cache[("{{cache_name}}\n{{cache_engine}}")]
      end
    end
    cdn["CDN\n{{cdn_solution}}"]
    s3["Object Storage\n{{storage_solution}}"]
  end

  internet["Internet"] --> cdn
  cdn --> lb
  lb --> asg
  asg --> db
  asg --> cache
  asg --> s3
\`\`\`

## 2. Compute

| Component | Type | Instance | Count | Auto-scale |
|---|---|---|---|---|
| {{compute_1_name}} | {{compute_1_type}} | {{compute_1_instance}} | {{compute_1_count}} | {{compute_1_autoscale}} |
| {{compute_2_name}} | {{compute_2_type}} | {{compute_2_instance}} | {{compute_2_count}} | {{compute_2_autoscale}} |

## 3. Networking

| Resource | CIDR / Config | Purpose |
|---|---|---|
| VPC | {{vpc_cidr}} | {{vpc_purpose}} |
| Public subnets | {{public_subnets}} | {{public_subnets_purpose}} |
| Private subnets | {{private_subnets}} | {{private_subnets_purpose}} |

## 4. Data Services

| Service | Engine | Version | HA Config | Backup |
|---|---|---|---|---|
| {{db_name}} | {{db_engine}} | {{db_version}} | {{db_ha}} | {{db_backup}} |
| {{cache_name}} | {{cache_engine}} | {{cache_version}} | {{cache_ha}} | N/A |

## 5. Disaster Recovery

| Target | Value |
|---|---|
| RTO | {{rto}} |
| RPO | {{rpo}} |
| DR Strategy | {{dr_strategy}} |
| Failover Region | {{failover_region}} |

## 6. IaC & CI/CD

- **IaC tool**: {{iac_tool}}
- **State backend**: {{iac_state_backend}}
- **CI/CD platform**: {{cicd_platform}}
- **Deployment strategy**: {{deployment_strategy}}

## 7. Environments

| Env | Purpose | Data | Scale |
|---|---|---|---|
| dev | Development | Synthetic | Minimal |
| staging | Pre-prod validation | Anonymized | Reduced |
| prod | Production | Live | Full |

## 8. Cost Estimate
- Monthly estimate: {{monthly_cost_estimate}}
- Cost optimization: {{cost_optimization}}
`,
    },
    "risk-register": {
        id: "risk-register",
        abbr: "RISK",
        name: "Risk Register",
        category: "governance",
        mandatory: true,
        when: "Project initiation and ongoing",
        audience: "Project manager, architects, stakeholders",
        purpose: "Track and manage architecture and delivery risks",
        vaultPath: "vault/Architecture/risk-register.md",
        frontmatterType: "risk-register",
        content: `---
title: "{{system_name}} — Risk Register"
type: risk-register
status: draft
created: {{date}}
updated: {{date}}
owner: {{author}}
tags: [risk, governance, {{system_name_slug}}]
relates_to: [Architecture/sad]
---

# {{system_name}} — Risk Register

## Risk Matrix

| ID | Risk | Category | Probability | Impact | Score | Status | Mitigation | Owner |
|---|---|---|---|---|---|---|---|---|
| R001 | {{risk_1_description}} | {{risk_1_category}} | {{risk_1_probability}} | {{risk_1_impact}} | {{risk_1_score}} | Open | {{risk_1_mitigation}} | {{risk_1_owner}} |
| R002 | {{risk_2_description}} | {{risk_2_category}} | {{risk_2_probability}} | {{risk_2_impact}} | {{risk_2_score}} | Open | {{risk_2_mitigation}} | {{risk_2_owner}} |
| R003 | {{risk_3_description}} | {{risk_3_category}} | {{risk_3_probability}} | {{risk_3_impact}} | {{risk_3_score}} | Open | {{risk_3_mitigation}} | {{risk_3_owner}} |

**Score = Probability × Impact (1=Low, 2=Medium, 3=High, 4=Critical)**

## Risk Categories

- **Technical**: Architecture, technology, integration complexity
- **Delivery**: Timeline, resource, dependency risks
- **Security**: Threats, vulnerabilities, compliance gaps
- **Operational**: Performance, reliability, support risks
- **Business**: Scope change, stakeholder alignment

## Review Schedule
- Weekly: High and Critical risks
- Monthly: All open risks
- Quarterly: Full register review

## Closed Risks

| ID | Risk | Closed Date | Resolution |
|---|---|---|---|
| {{closed_risk_id}} | {{closed_risk_description}} | {{closed_date}} | {{resolution}} |
`,
    },
    runbook: {
        id: "runbook",
        abbr: "RB",
        name: "Operations Runbook",
        category: "operations",
        mandatory: false,
        when: "Pre-go-live",
        audience: "On-call engineers, SRE",
        purpose: "Step-by-step operational procedures for incidents and maintenance",
        vaultPath: "vault/Runbooks/{{service_name}}-runbook.md",
        frontmatterType: "runbook",
        content: `---
title: "{{service_name}} — Operations Runbook"
type: runbook
status: draft
created: {{date}}
updated: {{date}}
owner: {{author}}
tags: [runbook, operations, {{service_name_slug}}]
relates_to: [Architecture/sad, Infrastructure/infrastructure-architecture]
---

# {{service_name}} — Operations Runbook

## Service Overview

| Property | Value |
|---|---|
| Service | {{service_name}} |
| Team | {{team_name}} |
| PagerDuty | {{pagerduty_service}} |
| Slack | {{slack_channel}} |
| Dashboard | {{dashboard_url}} |
| Logs | {{logs_url}} |

## Incident Response Flow

\`\`\`mermaid
flowchart TD
  A([Alert Fires]) --> B{Severity?}
  B -->|P1/P2| C[Page On-call]
  B -->|P3/P4| D[Create ticket]
  C --> E[Acknowledge alert]
  E --> F{Service down?}
  F -->|Yes| G[Initiate rollback]
  F -->|No| H[Check recent deploys]
  G --> I{Rollback worked?}
  H --> J[Check {{primary_metric}}]
  I -->|Yes| K[Monitor 30min]
  I -->|No| L[Escalate to lead]
  J --> M{Root cause found?}
  M -->|Yes| N[Apply fix]
  M -->|No| O[Escalate to team]
  K --> P([Resolve incident])
  N --> P
\`\`\`

## Common Alerts

### {{alert_1_name}}
- **Trigger**: {{alert_1_trigger}}
- **Severity**: {{alert_1_severity}}
- **Likely cause**: {{alert_1_cause}}
- **Steps**:
  1. {{alert_1_step_1}}
  2. {{alert_1_step_2}}
  3. {{alert_1_step_3}}

### {{alert_2_name}}
- **Trigger**: {{alert_2_trigger}}
- **Severity**: {{alert_2_severity}}
- **Steps**:
  1. {{alert_2_step_1}}
  2. {{alert_2_step_2}}

## Deployment Runbook

### Standard Deploy
\`\`\`bash
# 1. Verify prerequisites
{{deploy_prereq_command}}

# 2. Deploy to staging
{{deploy_staging_command}}

# 3. Run smoke tests
{{smoke_test_command}}

# 4. Deploy to production
{{deploy_prod_command}}

# 5. Verify deployment
{{verify_deploy_command}}
\`\`\`

### Rollback Procedure
\`\`\`bash
{{rollback_command}}
\`\`\`

## Scaling Operations

### Scale Up
\`\`\`bash
{{scale_up_command}}
\`\`\`

### Scale Down
\`\`\`bash
{{scale_down_command}}
\`\`\`

## Database Operations

### Backup
\`\`\`bash
{{db_backup_command}}
\`\`\`

### Restore
\`\`\`bash
{{db_restore_command}}
\`\`\`

## Contacts

| Role | Name | Contact |
|---|---|---|
| Primary On-call | {{primary_oncall}} | {{primary_oncall_contact}} |
| Escalation | {{escalation_contact}} | {{escalation_contact_info}} |
| Vendor support | {{vendor_name}} | {{vendor_support}} |
`,
    },
};
export const CATEGORIES = {
    foundation: {
        label: "Foundation",
        color: "#2563eb",
        docIds: ["sad", "nfr"],
    },
    diagrams: {
        label: "Diagrams",
        color: "#7c3aed",
        docIds: ["c4-context", "c4-container", "c4-component"],
    },
    decisions: {
        label: "Decisions",
        color: "#d97706",
        docIds: ["adr"],
    },
    architecture: {
        label: "Architecture",
        color: "#059669",
        docIds: ["data-architecture", "integration-architecture", "security-architecture", "infrastructure-architecture"],
    },
    governance: {
        label: "Governance",
        color: "#dc2626",
        docIds: ["risk-register"],
    },
    operations: {
        label: "Operations",
        color: "#6b7280",
        docIds: ["runbook"],
    },
};
export const ALL_TEMPLATE_IDS = Object.keys(TEMPLATES);

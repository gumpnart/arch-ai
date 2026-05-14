# Sample Project — Obsidian-Centric Documentation Workflow

The primary output of this workflow is an **Obsidian vault** with structured markdown documents and embedded diagrams.
Excalidraw is an optional live-preview canvas. Diagram renderers (Kroki, Eraser.io) are pluggable tools.

```
┌─────────────────────────────────────────────────────────┐
│  MCP commands                                           │
│                                                         │
│  init_project  ──────────────►  Obsidian vault          │
│  create_diagram (Kroki)  ────►  {folder}/Assets/*.svg   │
│  create_eraser_diagram  ─────►  {folder}/Assets/*.png   │
│  create_document  ───────────►  Notes/*.md              │
│                                 (embeds diagrams)        │
│                                                         │
│  (optional) scene param  ────►  Excalidraw live view    │
└─────────────────────────────────────────────────────────┘
```

## Prerequisites

```bash
docker compose up --build -d
```

To enable Eraser.io (get a key at https://app.eraser.io/workspace/settings):

```powershell
$env:ERASER_API_KEY = "your-key"
docker compose up -d mcp-server mcp-http
```

---

## Workflow: Order Management System docs

### Step 1 — Initialise the project vault

```
MCP: init_project
  name: "order-management"
  description: "Order Management System documentation"
```

Creates `diagrams-vault/order-management/` — open this folder as an Obsidian vault.

```
order-management/
├── .obsidian/app.json
├── .gitignore
├── README.md
├── Architecture/
├── Flows/
├── Sequences/
├── Infrastructure/
├── Notes/
└── Assets/
```

---

### Step 2 — Architecture diagram (Mermaid, inline — no file asset needed)

Mermaid renders natively in Obsidian. No SVG is saved; the code block IS the diagram.

```
MCP: create_diagram
  folder: "order-management/Architecture"
  name: "system-overview"
  title: "System Overview"
  format: "mermaid"
  description: "High-level component view"
  tags: ["architecture"]
  source: |
    graph LR
      Browser["Browser"] --> Gateway["API Gateway"]
      Gateway --> Auth["Auth Service"]
      Gateway --> Orders["Order Service"]
      Orders --> DB[("PostgreSQL")]
      Orders --> Queue["RabbitMQ"]
      Queue --> Fulfillment["Fulfillment Service"]
```

Result in vault:
- `order-management/Architecture/system-overview.md` — contains the mermaid code block

---

### Step 3 — Sequence diagram (PlantUML via Kroki → SVG asset)

Non-Mermaid Kroki formats render to SVG and save to `Assets/`.

```
MCP: create_diagram
  folder: "order-management/Sequences"
  name: "order-placement"
  title: "Order Placement Sequence"
  format: "plantuml"
  tags: ["sequences", "api"]
  source: |
    @startuml
    actor Customer
    participant "API Gateway" as GW
    participant "Order Service" as OS
    participant "Payment Service" as PS
    participant "Fulfillment" as FS

    Customer -> GW: POST /orders
    GW -> OS: createOrder(items)
    OS -> PS: chargeCard(amount)
    PS --> OS: paymentConfirmed
    OS -> FS: scheduleShipment(orderId)
    FS --> OS: shipmentScheduled
    OS --> GW: 201 Created
    GW --> Customer: orderConfirmed
    @enduml
```

Result in vault:
- `order-management/Sequences/Assets/order-placement.svg` — rendered SVG
- `order-management/Sequences/order-placement.md` — contains `![[Sequences/Assets/order-placement.svg]]`

---

### Step 4 — Cloud diagram (Eraser.io → PNG asset)

```
MCP: create_eraser_diagram
  folder: "order-management/Infrastructure"
  name: "cloud-architecture"
  title: "Cloud Architecture"
  diagram_type: "cloudArchitectureDiagram"
  theme: "light"
  description: "AWS deployment topology"
  tags: ["infrastructure", "aws"]
  source: |
    Internet
    Load Balancer [icon: aws-elb]
    ECS Cluster [icon: aws-ecs] {
      API Gateway [icon: aws-api-gateway]
      Order Service [icon: aws-ecs-service]
      Payment Service [icon: aws-ecs-service]
    }
    RDS PostgreSQL [icon: aws-rds]
    SQS Queue [icon: aws-sqs]
    Internet > Load Balancer
    Load Balancer > API Gateway
    API Gateway > Order Service
    Order Service > RDS PostgreSQL
    Order Service > SQS Queue
```

Result in vault:
- `order-management/Infrastructure/Assets/cloud-architecture.png` — rendered PNG
- `order-management/Infrastructure/cloud-architecture.md` — contains `![[Infrastructure/Assets/cloud-architecture.png]]`

---

### Step 5 — Compose the documentation document

`create_document` reads the diagram `.md` files and auto-inserts the correct embed format.

```
MCP: create_document
  folder: "order-management/Notes"
  name: "architecture-overview"
  title: "Order Management System — Architecture Overview"
  tags: ["documentation", "architecture"]
  body: |
    This document describes the architecture of the Order Management System (OMS),
    covering components, key interactions, and deployment topology.
  sections:
    - heading: "System Components"
      body: |
        The OMS is composed of five services coordinated through an API Gateway.

        | Service           | Responsibility                      |
        |---|---|
        | API Gateway       | Request routing, auth validation    |
        | Auth Service      | JWT issuance and verification       |
        | Order Service     | Order lifecycle management          |
        | Payment Service   | Stripe integration                  |
        | Fulfillment       | Warehouse picking and shipping      |
      diagram: "order-management/Architecture/system-overview.md"

    - heading: "Order Placement Flow"
      body: "End-to-end sequence from customer request to fulfillment scheduling."
      diagram: "order-management/Sequences/order-placement.md"

    - heading: "Deployment Topology"
      body: "The system runs on AWS ECS with RDS PostgreSQL and SQS for async messaging."
      diagram: "order-management/Infrastructure/cloud-architecture.md"

    - heading: "Design Decisions"
      body: |
        - **Async fulfillment** via SQS decouples order confirmation from warehouse operations.
        - **PostgreSQL** is the single source of truth for order state.
        - **JWT tokens** expire after 1 hour; refresh tokens have a 30-day rolling window.
        - All error responses follow RFC 9457 Problem Details format.
```

Result in vault:
- `order-management/Notes/architecture-overview.md` — complete document with:
  - Inline mermaid block (system overview)
  - `![[Sequences/Assets/order-placement.svg]]` (PlantUML sequence)
  - `![[Infrastructure/Assets/cloud-architecture.png]]` (Eraser.io cloud diagram)

---

## Final vault structure

```
order-management/
├── .obsidian/app.json
├── .gitignore
├── README.md
├── Architecture/
│   └── system-overview.md         ← mermaid inline (Obsidian renders natively)
├── Flows/
├── Sequences/
│   ├── order-placement.md         ← embeds the SVG below
│   └── Assets/
│       └── order-placement.svg    ← rendered by Kroki
├── Infrastructure/
│   ├── cloud-architecture.md      ← embeds the PNG below
│   └── Assets/
│       └── cloud-architecture.png ← rendered by Eraser.io
├── Notes/
│   └── architecture-overview.md   ← full document, all diagrams embedded
└── Assets/
```

Open `order-management/` as an **Obsidian vault**. All diagrams render inline in Reading mode.

See `vault/` in this directory for a pre-built example of the expected output.

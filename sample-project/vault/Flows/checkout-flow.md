---
title: Checkout Flow
format: eraser
diagramType: flowchart
asset: Flows/Assets/checkout-flow.png
tags: [flow, checkout]
created: 2026-05-14
updated: 2026-05-14
---

# Checkout Flow

> Customer checkout to payment confirmation

![[Flows/Assets/checkout-flow.png]]

```eraser
Customer places order
Order Service validates items and stock
Payment Service charges card
if payment succeeds
  Order marked as confirmed
  Fulfillment Service picks and ships
  Customer notified by email
else
  Order marked as failed
  Customer shown error
```

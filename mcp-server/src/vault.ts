import fs from "node:fs/promises";
import path from "node:path";
import type { Dirent } from "node:fs";
import { simpleGit } from "simple-git";

const VAULT_PATH = path.resolve(process.env.VAULT_PATH ?? "./diagrams-vault");

// ── Path safety ──────────────────────────────────────────────────────────────

export function safePath(relativePath: string): string {
  // Normalize separators, then resolve against vault root
  const normalized = relativePath.replace(/\\/g, "/").replace(/^\//, "");
  const abs = path.resolve(VAULT_PATH, normalized);
  if (!abs.startsWith(VAULT_PATH + path.sep) && abs !== VAULT_PATH) {
    throw new Error(`Path "${relativePath}" escapes the vault`);
  }
  return abs;
}

export function vaultRelative(absPath: string): string {
  return path.relative(VAULT_PATH, absPath).replace(/\\/g, "/");
}

// ── Markdown helpers ─────────────────────────────────────────────────────────

function isoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function buildDiagramMarkdown(opts: {
  title: string;
  format: string;
  source: string;
  description?: string;
  tags?: string[];
  created?: string;
}): string {
  const date = isoDate();
  const tags = opts.tags?.length ? `[${opts.tags.join(", ")}]` : "[]";
  let md =
    `---\ntitle: ${opts.title}\nformat: ${opts.format}\ntags: ${tags}\n` +
    `created: ${opts.created ?? date}\nupdated: ${date}\n---\n\n` +
    `# ${opts.title}\n\n`;
  if (opts.description) md += `> ${opts.description}\n\n`;
  md += `\`\`\`${opts.format}\n${opts.source.trim()}\n\`\`\`\n`;
  return md;
}

export function buildDocumentMarkdown(opts: {
  title: string;
  folder: string;
  tags?: string[];
  body?: string;
}): string {
  const date = isoDate();
  const tags = opts.tags?.length ? `[${opts.tags.join(", ")}]` : "[]";
  let md =
    `---\ntitle: ${opts.title}\ntype: document\nfolder: ${opts.folder}\ntags: ${tags}\n` +
    `created: ${date}\nupdated: ${date}\n---\n\n` +
    `# ${opts.title}\n\n`;
  if (opts.body) md += opts.body.trim() + "\n";
  return md;
}

export interface DiagramInfo {
  path: string;
  title: string;
  format: string;
  source: string;
  tags: string[];
  created: string;
  updated: string;
}

export function parseDiagramMarkdown(content: string, relativePath: string): DiagramInfo {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) throw new Error("No YAML frontmatter found");

  const fm: Record<string, string> = {};
  for (const line of fmMatch[1].split("\n")) {
    const colon = line.indexOf(":");
    if (colon > 0) {
      fm[line.slice(0, colon).trim()] = line.slice(colon + 1).trim();
    }
  }

  const format = fm.format ?? "mermaid";
  // Match the first code fence with the expected format language
  const codeRe = new RegExp("```" + format + "\\n([\\s\\S]*?)\\n```");
  const codeMatch = content.match(codeRe);
  const source = codeMatch ? codeMatch[1] : "";

  const rawTags = (fm.tags ?? "[]").replace(/[\[\]]/g, "");
  const tags = rawTags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  return {
    path: relativePath,
    title: fm.title ?? "Untitled",
    format,
    source,
    tags,
    created: fm.created ?? "",
    updated: fm.updated ?? "",
  };
}

export function updateDiagramSource(
  content: string,
  format: string,
  newSource: string
): string {
  const date = isoDate();
  // Update the 'updated' frontmatter field
  let updated = content.replace(/^(updated:\s*).*$/m, `$1${date}`);
  // Replace the code fence body
  const codeRe = new RegExp("(```" + format + "\\n)[\\s\\S]*?(\\n```)", "m");
  if (codeRe.test(updated)) {
    updated = updated.replace(codeRe, `$1${newSource.trim()}$2`);
  } else {
    // Append new fence if not found
    updated = updated.trimEnd() + `\n\n\`\`\`${format}\n${newSource.trim()}\n\`\`\`\n`;
  }
  return updated;
}

// ── File operations ───────────────────────────────────────────────────────────

export async function writeVaultFile(
  relativePath: string,
  content: string
): Promise<string> {
  const abs = safePath(relativePath);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, content, "utf-8");
  return relativePath;
}

export async function readVaultFile(relativePath: string): Promise<string> {
  return fs.readFile(safePath(relativePath), "utf-8");
}

export async function deleteVaultFile(relativePath: string): Promise<void> {
  await fs.unlink(safePath(relativePath));
}

export async function listVaultFiles(folder?: string): Promise<string[]> {
  const base = folder ? safePath(folder) : VAULT_PATH;
  const files: string[] = [];

  async function walk(dir: string): Promise<void> {
    let entries: Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name.startsWith(".") || e.name === "Assets") continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        await walk(full);
      } else if (e.name.endsWith(".md")) {
        files.push(vaultRelative(full));
      }
    }
  }

  await walk(base);
  return files.sort();
}

// ── Git ───────────────────────────────────────────────────────────────────────

export async function gitStatus(): Promise<string> {
  const git = simpleGit(VAULT_PATH);
  try {
    const status = await git.status();
    const remote = await git.remote(["get-url", "origin"]).catch(() => "(no remote)");
    const branch = status.current ?? "unknown";
    const changed = status.files.length;
    return `Branch: ${branch}\nRemote: ${String(remote).trim()}\nChanged files: ${changed}`;
  } catch (err) {
    return `Git error: ${(err as Error).message}`;
  }
}

export async function gitCommitAndPush(message: string): Promise<string> {
  const git = simpleGit(VAULT_PATH);
  try {
    await git.add(".");
    const result = await git.commit(message);
    const sha = result.commit;
    if (!sha) return "Nothing to commit";
    await git.push().catch(() => {/* silent — no remote is fine */ });
    return `Committed ${sha}: ${message}`;
  } catch (err) {
    return `Git error: ${(err as Error).message}`;
  }
}

// ── Project scaffolding ───────────────────────────────────────────────────────

const VAULT_FOLDERS = ["Architecture", "Flows", "Sequences", "Infrastructure", "Notes"];

// ── Starter template constants ────────────────────────────────────────────────

const ARCH_README = `# Architecture

This folder holds all architecture-level documentation for the project.

## Document Types

| Type | Naming | Purpose |
|---|---|---|
| SAD | \`SAD-<project>.md\` | Solution Architecture Document — the primary reference |
| ADR | \`ADR/ADR-NNN-<title>.md\` | Architecture Decision Records |
| C4 Context | \`Diagrams/system-context.md\` | C4 Level 1 — system boundary |
| C4 Container | \`Diagrams/container.md\` | C4 Level 2 — containers/services |
| C4 Component | \`Diagrams/component-<svc>.md\` | C4 Level 3 — internal components |
| NFR | \`nfr.md\` | Non-Functional Requirements |
| Risk Register | \`risk-register.md\` | Risks and mitigations |

## Getting Started

1. Copy \`SAD-template.md\` → rename to \`SAD-<your-project>.md\` and fill in placeholders
2. Copy \`ADR/ADR-000-template.md\` → \`ADR/ADR-001-<decision-title>.md\` for first decision
3. Run \`create_diagram\` with format \`mermaid\` to generate a system context diagram
`;

const FLOWS_README = `# Flows

This folder holds user flows, business process flows, and state machine diagrams.

## Document Types

| Type | Format | Purpose |
|---|---|---|
| User Flow | mermaid flowchart | Step-by-step user journey |
| Business Process | mermaid flowchart | Cross-system process flow |
| State Machine | mermaid stateDiagram | Entity lifecycle / state transitions |

## Mermaid Examples

**Flowchart:**
\`\`\`mermaid
flowchart TD
  Start([Start]) --> Step1[Step One]
  Step1 --> Decision{Condition?}
  Decision -- Yes --> Step2[Step Two]
  Decision -- No --> End([End])
  Step2 --> End
\`\`\`

**State Diagram:**
\`\`\`mermaid
stateDiagram-v2
  [*] --> Draft
  Draft --> InReview : submit
  InReview --> Approved : approve
  InReview --> Draft : reject
  Approved --> [*]
\`\`\`
`;

const SEQ_README = `# Sequences

This folder holds sequence and interaction diagrams showing how components communicate over time.

## Document Types

| Type | Format | Purpose |
|---|---|---|
| API Call Flow | mermaid sequenceDiagram | REST / gRPC interaction between services |
| Auth Flow | mermaid sequenceDiagram | Login, token refresh, OAuth handshake |
| Event Flow | mermaid sequenceDiagram | Async message / event-driven interactions |

## Mermaid Example

\`\`\`mermaid
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
\`\`\`
`;

const INFRA_README = `# Infrastructure

This folder holds deployment, cloud, networking, and disaster-recovery documentation.

## Document Types

| Type | Format | Purpose |
|---|---|---|
| Deployment Topology | mermaid graph | Physical / cloud deployment layout |
| Network Diagram | mermaid graph | VPCs, subnets, security groups |
| DR Plan | markdown | Recovery objectives and runbook links |
| CI/CD Pipeline | mermaid flowchart | Build → test → deploy pipeline |

## Mermaid Example

\`\`\`mermaid
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
\`\`\`
`;

const NOTES_README = `# Notes

This folder holds meeting notes, spike reports, overview documents, and other unstructured content.

## Document Types

| Type | Naming | Purpose |
|---|---|---|
| Meeting Note | \`YYYY-MM-DD-<topic>.md\` | Decision log from architecture reviews |
| Spike Report | \`spike-<topic>.md\` | Time-boxed investigation findings |
| Overview | \`overview.md\` | Narrative introduction to the project |
| Glossary | \`glossary.md\` | Project-specific terms and acronyms |
`;

function buildSadTemplate(name: string, description: string, date: string): string {
  return `---
title: "${name} — Solution Architecture Document"
type: sad
status: draft
created: ${date}
updated: ${date}
owner: "[PLACEHOLDER: Team Name]"
tags: [architecture, sad]
relates_to: []
---

# ${name} — Solution Architecture Document

## 1. Executive Summary

[PLACEHOLDER: 2–3 sentences describing what this system does and why it exists.]

## 2. Business Context

### 2.1 Business Goals

- [PLACEHOLDER: Goal 1]
- [PLACEHOLDER: Goal 2]
- [PLACEHOLDER: Goal 3]

### 2.2 Stakeholders

| Stakeholder | Role | Interest |
|---|---|---|
| [PLACEHOLDER] | [PLACEHOLDER] | [PLACEHOLDER] |

## 3. System Overview

### 3.1 Scope

[PLACEHOLDER: Define what is in scope and what is explicitly out of scope.]

### 3.2 System Context

\`\`\`mermaid
flowchart TB
  subgraph users["Users"]
    User["[PLACEHOLDER: User]"]
  end
  subgraph system["${name}"]
    Core["[PLACEHOLDER: Core Service]"]
  end
  subgraph external["External Systems"]
    Ext["[PLACEHOLDER: External System]"]
  end

  User -->|"[PLACEHOLDER: action]"| Core
  Core -->|"[PLACEHOLDER: integration]"| Ext
\`\`\`

## 4. Architecture Decisions

### 4.1 Key Decisions

| Decision | Rationale | Alternatives Considered |
|---|---|---|
| [PLACEHOLDER] | [PLACEHOLDER] | [PLACEHOLDER] |

## 5. Architecture Views

### 5.1 Logical Architecture

[PLACEHOLDER: Describe the major logical layers or domains.]

### 5.2 Physical Architecture

[PLACEHOLDER: Describe deployment topology — cloud, on-prem, containers, etc.]

## 6. Quality Attributes

| Attribute | Requirement | Mechanism |
|---|---|---|
| Availability | [PLACEHOLDER] | [PLACEHOLDER] |
| Performance | [PLACEHOLDER] | [PLACEHOLDER] |
| Security | [PLACEHOLDER] | [PLACEHOLDER] |
| Scalability | [PLACEHOLDER] | [PLACEHOLDER] |

## 7. Technology Stack

| Layer | Technology | Version | Rationale |
|---|---|---|---|
| [PLACEHOLDER] | [PLACEHOLDER] | [PLACEHOLDER] | [PLACEHOLDER] |

## 8. Cross-Cutting Concerns

### 8.1 Security

[PLACEHOLDER: Authentication, authorisation, secrets management.]

### 8.2 Observability

[PLACEHOLDER: Logging, metrics, tracing approach.]

### 8.3 Disaster Recovery

- RTO: [PLACEHOLDER]
- RPO: [PLACEHOLDER]

## 9. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| [PLACEHOLDER] | Low/Med/High | Low/Med/High | [PLACEHOLDER] |

## 10. Open Questions

- [ ] [PLACEHOLDER: Question 1]
- [ ] [PLACEHOLDER: Question 2]
`;
}

function buildAdrTemplate(date: string): string {
  return `---
title: "ADR-000: [PLACEHOLDER: Decision Title]"
type: adr
status: proposed
created: ${date}
updated: ${date}
owner: "[PLACEHOLDER: Team Name]"
deciders: ["[PLACEHOLDER: Name]"]
tags: [adr, decision]
relates_to: [Architecture/SAD-template]
---

# ADR-000: [PLACEHOLDER: Decision Title]

## Status

**Proposed** — ${date}

## Context

[PLACEHOLDER: Describe the situation that forces a decision. What is the problem? What constraints exist?]

### Forces

* [PLACEHOLDER: Force 1 — e.g. a requirement, constraint, or goal]
* [PLACEHOLDER: Force 2]
* [PLACEHOLDER: Force 3]

## Decision

[PLACEHOLDER: State the decision clearly in one or two sentences. "We will …"]

## Consequences

### Positive

* [PLACEHOLDER: Benefit 1]
* [PLACEHOLDER: Benefit 2]

### Negative

* [PLACEHOLDER: Trade-off 1]
* [PLACEHOLDER: Trade-off 2]

### Risks

* [PLACEHOLDER: Risk 1 and how it will be managed]

## Alternatives Considered

### Option 1: [PLACEHOLDER: Name]

**Pros**: [PLACEHOLDER]\\
**Cons**: [PLACEHOLDER]

### Option 2: [PLACEHOLDER: Name]

**Pros**: [PLACEHOLDER]\\
**Cons**: [PLACEHOLDER]

## Implementation Notes

[PLACEHOLDER: Any specific implementation guidance, links to code, or follow-up tasks.]

## Review Date

[PLACEHOLDER: YYYY-MM-DD — set ~6 months from decision date]
`;
}

export async function initProject(name: string, description?: string): Promise<string> {
  const projectPath = path.join(VAULT_PATH, name);
  const date = isoDate();
  const desc = description ?? "Diagram-as-code project";

  await fs.mkdir(projectPath, { recursive: true });

  for (const folder of VAULT_FOLDERS) {
    await fs.mkdir(path.join(projectPath, folder), { recursive: true });
  }
  await fs.mkdir(path.join(projectPath, "Architecture", "ADR"), { recursive: true });

  const readme =
    `---\ntitle: ${name}\ntype: readme\nstatus: draft\ncreated: ${date}\nupdated: ${date}\ntags: [project, readme]\nrelates_to: []\n---\n\n` +
    `# ${name}\n\n${desc}\n\n` +
    `## Quick Start\n\n` +
    `1. Fill in \`Architecture/SAD-template.md\` — rename it and replace all \`[PLACEHOLDER]\` markers\n` +
    `2. Copy \`Architecture/ADR/ADR-000-template.md\` → \`ADR-001-<decision>.md\` for your first decision\n` +
    `3. Ask Claude: *"Create a system context diagram for ${name} in Architecture/Diagrams/"*\n` +
    `4. Ask Claude: *"Create an overview document in Notes/ for ${name}"*\n\n` +
    `## Folder Guide\n\n` +
    `| Folder | Purpose | Typical Documents |\n` +
    `|---|---|---|\n` +
    `| \`Architecture/\` | System structure and decisions | SAD, ADRs, C4 diagrams, NFRs, Risk Register |\n` +
    `| \`Flows/\` | User and business process flows | Flowcharts, state machines |\n` +
    `| \`Sequences/\` | Component interaction over time | Sequence diagrams, API call flows |\n` +
    `| \`Infrastructure/\` | Deployment and operations | Topology diagrams, DR plan, CI/CD pipeline |\n` +
    `| \`Notes/\` | Unstructured working documents | Meeting notes, spike reports, glossary |\n\n` +
    `## Document Status Lifecycle\n\n` +
    `- \`status: draft\` — AI-generated or in progress, awaiting human review\n` +
    `- \`status: in-review\` — PR open, under peer review\n` +
    `- \`status: stable\` — Merged, human-verified, published\n` +
    `- \`status: deprecated\` — Superseded, kept for history\n\n` +
    `## Conventions\n\n` +
    `- Diagrams stored as Mermaid DSL in code blocks — never binary images\n` +
    `- Every doc has YAML frontmatter with \`title\`, \`type\`, \`status\`, \`tags\`, \`relates_to\`\n` +
    `- Use wikilinks \`[[note-name]]\` for cross-references between documents\n` +
    `- Git branch naming: \`docs/feat-*\` for new docs, \`docs/fix-*\` for corrections\n` +
    `- PR review required before merging to \`main\`\n`;

  await fs.writeFile(path.join(projectPath, "README.md"), readme, "utf-8");

  const obsidianConfig = {
    defaultViewMode: "source",
    alwaysUpdateLinks: true,
    showUnsupportedFiles: false,
  };
  const obsidianDir = path.join(projectPath, ".obsidian");
  await fs.mkdir(obsidianDir, { recursive: true });
  await fs.writeFile(
    path.join(obsidianDir, "app.json"),
    JSON.stringify(obsidianConfig, null, 2),
    "utf-8"
  );

  const gitignore = ".obsidian/workspace\n.obsidian/workspace.json\n";
  await fs.writeFile(path.join(projectPath, ".gitignore"), gitignore, "utf-8");

  await writeVaultFile(`${name}/Architecture/README.md`, ARCH_README);
  await writeVaultFile(`${name}/Flows/README.md`, FLOWS_README);
  await writeVaultFile(`${name}/Sequences/README.md`, SEQ_README);
  await writeVaultFile(`${name}/Infrastructure/README.md`, INFRA_README);
  await writeVaultFile(`${name}/Notes/README.md`, NOTES_README);
  await writeVaultFile(`${name}/Architecture/SAD-template.md`, buildSadTemplate(name, desc, date));
  await writeVaultFile(`${name}/Architecture/ADR/ADR-000-template.md`, buildAdrTemplate(date));

  return vaultRelative(projectPath);
}

# CRM Workflow — VividCRM

## Entities Covered
Lead · Deal · Contact · Company · Campaign · Mailing

---

## 1. Lead Lifecycle

### State Machine

```
                        ┌─────────────┐
                        │     NEW     │  ← Created (manual, import, form, API)
                        └──────┬──────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                ▼                ▼
        ┌──────────┐    ┌──────────┐    ┌───────────┐
        │ATTEMPTING│    │CONTACTED │    │DISQUALIFIED│
        │ CONTACT  │    │          │    │           │
        └────┬─────┘    └────┬─────┘    └───────────┘
             │               │
             │ (reached)     │
             ▼               ▼
        ┌──────────────────────┐
        │      QUALIFIED       │  ← Meets ICP criteria, budget confirmed
        └──────────┬───────────┘
                   │
         ┌─────────┴──────────┐
         │                    │
         ▼                    ▼
  ┌─────────────┐    ┌──────────────┐
  │  CONVERTED  │    │ DISQUALIFIED │
  │ (→ Deal)    │    │              │
  └─────────────┘    └──────────────┘
```

### States

| State | Description | Who Can Set |
|---|---|---|
| `NEW` | Lead created, not yet worked | System, ADMIN, TEAM_LEAD |
| `ATTEMPTING_CONTACT` | Outreach started, no response yet | ADMIN, TEAM_LEAD |
| `CONTACTED` | Two-way communication established | ADMIN, TEAM_LEAD |
| `QUALIFIED` | Lead confirmed as viable opportunity | ADMIN, TEAM_LEAD |
| `DISQUALIFIED` | Not a fit — budget, timing, need mismatch | ADMIN, TEAM_LEAD |
| `CONVERTED` | Lead promoted to a Deal | ADMIN, TEAM_LEAD (triggers Deal creation) |

### Transitions

| From | To | Trigger | Actor | Side Effect |
|---|---|---|---|---|
| `NEW` | `ATTEMPTING_CONTACT` | First outreach action logged | ADMIN / TEAM_LEAD | Activity log entry created |
| `NEW` | `CONTACTED` | Direct response received | ADMIN / TEAM_LEAD | Activity log entry created |
| `NEW` | `DISQUALIFIED` | Immediate rejection | ADMIN / TEAM_LEAD | Reason required (dropdown + note) |
| `ATTEMPTING_CONTACT` | `CONTACTED` | Response received | ADMIN / TEAM_LEAD | — |
| `ATTEMPTING_CONTACT` | `DISQUALIFIED` | No response after N attempts | ADMIN / TEAM_LEAD | Reason required |
| `CONTACTED` | `QUALIFIED` | Budget + need + timeline confirmed | ADMIN / TEAM_LEAD | Qualification checklist saved |
| `CONTACTED` | `DISQUALIFIED` | Not a fit after discovery | ADMIN / TEAM_LEAD | Reason required |
| `QUALIFIED` | `CONVERTED` | Owner clicks "Convert to Deal" | ADMIN / TEAM_LEAD | Deal created; Contact auto-created if not exists; Company linked |
| `QUALIFIED` | `DISQUALIFIED` | Changed circumstances | ADMIN / TEAM_LEAD | Reason required |
| `DISQUALIFIED` | `NEW` | Re-evaluation (reopen) | ADMIN | Audit log entry; reason required |

### Lead Conversion Flow

```
[Lead: QUALIFIED]
       │
       │ Owner clicks "Convert to Deal"
       ▼
[System checks]
  ├── Does a Contact exist for this lead's email?
  │     Yes → Link existing Contact
  │     No  → Create new Contact (name, email, phone from lead data)
  │
  ├── Does a Company exist for this lead's company name?
  │     Yes → Link existing Company
  │     No  → Create new Company stub
  │
  └── Create Deal in stage: QUALIFICATION
        ├── Deal.title = Lead.title or "Deal with {Contact name}"
        ├── Deal.contactId = (linked contact)
        ├── Deal.companyId = (linked company)
        ├── Deal.assignedTo = Lead.assignedTo
        └── Deal.sourceLeadId = Lead.id

[Lead status → CONVERTED]
[Deal status → QUALIFICATION]
```

---

## 2. Deal Lifecycle

### State Machine

```
┌───────────────┐
│ QUALIFICATION │  ← Created (from Lead conversion or manually)
└───────┬───────┘
        │
        ▼
┌───────────────┐
│   PROPOSAL    │  ← Proposal/quote sent to prospect
└───────┬───────┘
        │
        ▼
┌───────────────┐
│ NEGOTIATION   │  ← Terms being discussed
└───────┬───────┘
        │
   ┌────┴─────┐
   │          │
   ▼          ▼
┌─────┐   ┌──────┐
│ WON │   │ LOST │
└──┬──┘   └──────┘
   │
   ▼
┌──────────────┐
│ PROJECT      │  ← Optional: spawns a Project in Task module
│ CREATED      │
└──────────────┘
```

### States

| State | Description | Typical Duration |
|---|---|---|
| `QUALIFICATION` | Evaluating fit, discovery calls | 1–14 days |
| `PROPOSAL` | Proposal/quote sent, awaiting response | 3–21 days |
| `NEGOTIATION` | Terms, pricing, contract discussion | 1–14 days |
| `WON` | Contract signed, deal closed | Terminal |
| `LOST` | Prospect chose competitor or no decision | Terminal |
| `ON_HOLD` | Paused by prospect (budget freeze, etc.) | Indefinite |

### Transitions

| From | To | Trigger | Actor | Side Effect |
|---|---|---|---|---|
| `QUALIFICATION` | `PROPOSAL` | Proposal document sent | ADMIN / TEAM_LEAD | Document attached to deal; activity logged |
| `QUALIFICATION` | `LOST` | Early exit | ADMIN / TEAM_LEAD | Loss reason required; lost deal report updated |
| `QUALIFICATION` | `ON_HOLD` | Prospect requests pause | ADMIN / TEAM_LEAD | Follow-up date set |
| `PROPOSAL` | `NEGOTIATION` | Prospect responds with counter | ADMIN / TEAM_LEAD | Activity logged |
| `PROPOSAL` | `WON` | Proposal accepted as-is | ADMIN / TEAM_LEAD | See Win Flow below |
| `PROPOSAL` | `LOST` | Proposal rejected | ADMIN / TEAM_LEAD | Loss reason required |
| `PROPOSAL` | `ON_HOLD` | — | ADMIN / TEAM_LEAD | Follow-up date set |
| `NEGOTIATION` | `WON` | Agreement reached | ADMIN / TEAM_LEAD | See Win Flow below |
| `NEGOTIATION` | `LOST` | Negotiations failed | ADMIN / TEAM_LEAD | Loss reason required |
| `ON_HOLD` | `QUALIFICATION` | Prospect re-engages | ADMIN / TEAM_LEAD | — |
| `ON_HOLD` | `LOST` | Timeout or confirmed no-go | ADMIN / TEAM_LEAD | — |
| `WON` | — | Terminal (cannot reopen) | — | Reopen only via SUPER_ADMIN override |
| `LOST` | `QUALIFICATION` | Deal reopened after reassessment | ADMIN | Audit log + reason |

### Deal Win Flow

```
[Deal: NEGOTIATION or PROPOSAL]
       │
       │ Actor marks deal as WON
       ▼
[System prompts]
  ├── Confirm deal value (₹)
  ├── Confirm close date
  ├── Attach signed contract (optional but flagged if missing)
  └── "Create Project?" toggle (Yes / No)

       │
  ┌────┴─────────────────────────────┐
  │ Yes                              │ No
  ▼                                  ▼
[Project created in Tasks module]  [Deal marked WON, no project]
  ├── Project.name = Deal.title       │
  ├── Project.clientId = Deal.contact │
  ├── Project.dealId = Deal.id        │
  └── Project.teamId = Deal.team      │
                                      │
[Deal.status → WON] ◄─────────────────┘
[Revenue report updated]
[Campaign attribution recorded if deal came from a campaign]
```

### Deal Loss Flow

```
[Actor marks deal as LOST]
       │
       ▼
[System requires]
  ├── Loss reason (dropdown):
  │     PRICE · COMPETITOR · NO_BUDGET · NO_NEED ·
  │     TIMING · NO_DECISION · OTHER
  └── Loss note (free text, optional)

[Deal.status → LOST]
[Lost deal added to win/loss report]
[Assigned owner notified]
```

---

## 3. Contact Lifecycle

### States

| State | Description |
|---|---|
| `ACTIVE` | Reachable, in use, linked to deals or companies |
| `INACTIVE` | No recent activity, not linked to open deals |
| `ARCHIVED` | Soft-deleted, no longer in active pipeline |

### Transitions

| From | To | Trigger | Actor |
|---|---|---|---|
| (New) | `ACTIVE` | Created manually, via lead conversion, or CSV import | ADMIN / TEAM_LEAD |
| `ACTIVE` | `INACTIVE` | No deal activity in past 90 days (auto) or manual flag | System / ADMIN |
| `INACTIVE` | `ACTIVE` | New deal or activity logged against this contact | System / ADMIN |
| `ACTIVE` | `ARCHIVED` | "Archive" action | ADMIN / SUPER_ADMIN |
| `INACTIVE` | `ARCHIVED` | "Archive" action | ADMIN / SUPER_ADMIN |
| `ARCHIVED` | `ACTIVE` | "Restore" action | ADMIN / SUPER_ADMIN |

---

## 4. Company Lifecycle

Mirrors Contact lifecycle. Additionally:

- A Company can have many Contacts
- Archiving a Company does not archive its Contacts — they remain active but their `companyId` is retained for historical reference
- A Company cannot be archived while it has open Deals linked to it

---

## 5. Campaign Lifecycle

### State Machine

```
┌──────────┐    ┌─────────┐    ┌─────────┐    ┌──────────┐    ┌───────────┐
│  DRAFT   │───▶│SCHEDULED│───▶│ RUNNING │───▶│COMPLETED │    │ CANCELLED │
└──────────┘    └─────────┘    └─────────┘    └──────────┘    └───────────┘
     │               │               │
     └───────────────┴───────────────┴──────────────────────────────────────▶
                                                                    CANCELLED
```

### Transitions

| From | To | Trigger | Actor | Side Effect |
|---|---|---|---|---|
| `DRAFT` | `SCHEDULED` | Launch date set and confirmed | ADMIN | BullMQ job scheduled |
| `DRAFT` | `CANCELLED` | Campaign abandoned | ADMIN | — |
| `SCHEDULED` | `RUNNING` | Launch date reached | System (BullMQ) | Mailing jobs dispatched |
| `SCHEDULED` | `CANCELLED` | Cancelled before launch | ADMIN | BullMQ job removed |
| `RUNNING` | `COMPLETED` | All sends completed | System | Campaign report generated |
| `RUNNING` | `CANCELLED` | Manual abort | ADMIN | In-flight emails complete; queued emails cancelled |

---

## 6. Mailing (Email Broadcast) Lifecycle

### State Machine

```
┌──────────┐   ┌──────────┐   ┌─────────┐   ┌──────────┐
│  DRAFT   │──▶│  REVIEW  │──▶│SCHEDULED│──▶│ SENDING  │
└──────────┘   └──────────┘   └─────────┘   └────┬─────┘
                                                   │
                                        ┌──────────┴──────────┐
                                        │                     │
                                        ▼                     ▼
                                   ┌─────────┐          ┌─────────┐
                                   │  SENT   │          │  FAILED │
                                   └─────────┘          └─────────┘
```

### Transitions

| From | To | Trigger | Actor | Side Effect |
|---|---|---|---|---|
| `DRAFT` | `REVIEW` | Preview confirmed, recipient list locked | ADMIN | List snapshot taken; cannot add/remove recipients |
| `REVIEW` | `SCHEDULED` | Send time confirmed | ADMIN | BullMQ job queued |
| `REVIEW` | `DRAFT` | Edits needed after review | ADMIN | Recipient list unlocked |
| `SCHEDULED` | `SENDING` | Send time reached | System | BullMQ workers pick up batch jobs; Brevo API called |
| `SENDING` | `SENT` | All batches delivered | System | Open/click tracking activated; report created |
| `SENDING` | `FAILED` | API error or hard bounce rate exceeded threshold | System | Error logged; ADMIN notified |
| `FAILED` | `SCHEDULED` | Retry triggered | ADMIN | New BullMQ job queued for undelivered recipients only |

---

## 7. Activity Log

Every CRM entity (Lead, Deal, Contact, Company) maintains an append-only activity log. Activity types:

| Activity Type | Trigger |
|---|---|
| `NOTE_ADDED` | Manual note by any permitted user |
| `EMAIL_SENT` | Manual or mailing-triggered email |
| `CALL_LOGGED` | Call logged manually |
| `MEETING_SCHEDULED` | Calendar event created and linked |
| `STATUS_CHANGED` | Any status transition on the parent entity |
| `DEAL_CREATED` | Lead converted to Deal |
| `DOCUMENT_ATTACHED` | File linked to the record |
| `ASSIGNEE_CHANGED` | Deal/Lead reassigned |
| `FIELD_UPDATED` | Any field change on the record |

Activity log entries are immutable. They cannot be edited or deleted by any role.

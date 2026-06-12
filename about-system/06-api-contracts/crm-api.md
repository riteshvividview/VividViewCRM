# CRM API — VividCRM

## Pagination Convention

All list endpoints accept:

| Query Param | Type | Default | Description |
|---|---|---|---|
| `page` | number | 1 | Page number (1-based) |
| `limit` | number | 25 | Records per page (max 100) |
| `sortBy` | string | `createdAt` | Sort field |
| `sortOrder` | `asc` \| `desc` | `desc` | Sort direction |

All list responses return:
```json
{
  "data": [...],
  "meta": {
    "total": 142,
    "page": 1,
    "limit": 25,
    "totalPages": 6
  }
}
```

---

## Leads

---

### POST `/api/v1/leads`

Create a new lead.

**Permission:** `SUPER_ADMIN`, `ADMIN`, `TEAM_LEAD`

**Request Body:**
```ts
class CreateLeadDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  title: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  firstName: string

  @IsOptional()
  @IsString()
  @MaxLength(50)
  lastName?: string

  @IsOptional()
  @IsEmail()
  email?: string

  @IsOptional()
  @IsPhoneNumber()
  phone?: string

  @IsOptional()
  @IsString()
  @MaxLength(100)
  company?: string

  @IsOptional()
  @IsString()
  @MaxLength(100)
  jobTitle?: string

  @IsOptional()
  @IsString()
  source?: string  // WEBSITE | REFERRAL | CAMPAIGN | IMPORT | MANUAL

  @IsOptional()
  @IsUUID()
  assignedToId?: string

  @IsOptional()
  @IsUUID()
  teamId?: string

  @IsOptional()
  @IsUUID()
  campaignId?: string

  @IsOptional()
  @IsString()
  notes?: string
}
```

**Response `201`:** Full lead object (see GET response shape).

**Validation:**
- `title` + `firstName` required
- `email` — valid email if provided
- `assignedToId` — must be an active user in the workspace
- `teamId` — must be a team in the workspace
- TEAM_LEAD: `teamId` must be one of their own teams; `assignedToId` must be in their team

**Side Effects:**
- `CrmActivity` created: type=`STATUS_CHANGED`, metadata: `{ toStatus: "NEW" }`
- `AuditLog` entry: action=`CREATE`

---

### GET `/api/v1/leads`

List leads with filtering.

**Permission:** `SUPER_ADMIN`, `ADMIN` → all leads; `TEAM_LEAD` → own team only

**Query Parameters:**
| Param | Type | Description |
|---|---|---|
| `status` | `LeadStatus` | Filter by status |
| `assignedToId` | string | Filter by assignee |
| `teamId` | string | Filter by team |
| `source` | string | Filter by lead source |
| `campaignId` | string | Filter by campaign |
| `search` | string | Full-text search on name, email, company |
| `createdFrom` | date | Created after this date |
| `createdTo` | date | Created before this date |

**Response `200`:**
```json
{
  "data": [
    {
      "id": "lead_abc",
      "title": "Website Redesign Enquiry",
      "firstName": "Rahul",
      "lastName": "Mehta",
      "email": "rahul@startup.com",
      "phone": "+919876543210",
      "company": "StartupXYZ",
      "jobTitle": "CTO",
      "status": "CONTACTED",
      "source": "WEBSITE",
      "assignedTo": { "id": "user_123", "firstName": "Jane", "lastName": "Smith" },
      "team": { "id": "team_1", "name": "Sales" },
      "campaignId": null,
      "convertedAt": null,
      "convertedDealId": null,
      "createdAt": "2025-06-01T09:00:00.000Z",
      "updatedAt": "2025-06-01T10:00:00.000Z"
    }
  ],
  "meta": { "total": 142, "page": 1, "limit": 25, "totalPages": 6 }
}
```

---

### GET `/api/v1/leads/:id`

Get a single lead with full details.

**Permission:** `SUPER_ADMIN`, `ADMIN`; `TEAM_LEAD` → own team only

**Response `200`:**
```json
{
  "id": "lead_abc",
  "title": "Website Redesign Enquiry",
  "firstName": "Rahul",
  "lastName": "Mehta",
  "email": "rahul@startup.com",
  "phone": "+919876543210",
  "company": "StartupXYZ",
  "jobTitle": "CTO",
  "status": "CONTACTED",
  "source": "WEBSITE",
  "notes": "Interested in a 3-month project.",
  "assignedTo": { "id": "user_123", "firstName": "Jane", "lastName": "Smith" },
  "team": { "id": "team_1", "name": "Sales" },
  "campaign": null,
  "convertedAt": null,
  "convertedDealId": null,
  "disqualifiedReason": null,
  "createdById": "user_123",
  "createdAt": "2025-06-01T09:00:00.000Z",
  "updatedAt": "2025-06-01T10:00:00.000Z",
  "_count": { "activities": 3, "documents": 1 }
}
```

**Error Responses:**
| Status | Condition |
|---|---|
| 404 | Lead not found or outside caller's scope |

---

### PATCH `/api/v1/leads/:id`

Update a lead.

**Permission:** `SUPER_ADMIN`, `ADMIN`; `TEAM_LEAD` → own team only

**Request Body:**
```ts
class UpdateLeadDto {
  @IsOptional() @IsString() @MaxLength(100) title?: string
  @IsOptional() @IsString() @MaxLength(50) firstName?: string
  @IsOptional() @IsString() @MaxLength(50) lastName?: string
  @IsOptional() @IsEmail() email?: string
  @IsOptional() @IsPhoneNumber() phone?: string
  @IsOptional() @IsString() @MaxLength(100) company?: string
  @IsOptional() @IsString() @MaxLength(100) jobTitle?: string
  @IsOptional() @IsEnum(LeadStatus) status?: LeadStatus
  @IsOptional() @IsString() source?: string
  @IsOptional() @IsUUID() assignedToId?: string
  @IsOptional() @IsUUID() teamId?: string
  @IsOptional() @IsString() notes?: string
  @IsOptional() @IsString() disqualifiedReason?: string
}
```

**Response `200`:** Updated lead object.

**Validation:**
- Status transitions enforced: cannot jump from `NEW` to `CONVERTED` directly
- `disqualifiedReason` required when `status` = `DISQUALIFIED`
- Cannot update status to `CONVERTED` directly — use `POST /leads/:id/convert`

**Side Effects:**
- `CrmActivity` created for status changes, assignee changes, field updates
- `AuditLog` entry: action=`UPDATE`

---

### DELETE `/api/v1/leads/:id`

Soft-delete a lead.

**Permission:** `SUPER_ADMIN`, `ADMIN`

**Response `200`:**
```json
{ "message": "Lead deleted successfully." }
```

**Validation:**
- Cannot delete a lead that has been `CONVERTED` (deal already exists)

---

### POST `/api/v1/leads/:id/convert`

Convert a qualified lead into a Deal. Optionally creates a Contact and Company.

**Permission:** `SUPER_ADMIN`, `ADMIN`, `TEAM_LEAD` (own team)

**Request Body:**
```ts
class ConvertLeadDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  dealTitle?: string  // defaults to lead title if omitted

  @IsOptional()
  @IsNumber()
  @Min(0)
  dealValue?: number

  @IsOptional()
  @IsUUID()
  existingContactId?: string  // link to existing Contact instead of creating new

  @IsOptional()
  @IsUUID()
  existingCompanyId?: string  // link to existing Company

  @IsOptional()
  @IsBoolean()
  createContact?: boolean  // default true

  @IsOptional()
  @IsBoolean()
  createCompany?: boolean  // default true if company name is on lead
}
```

**Response `201`:**
```json
{
  "deal": {
    "id": "deal_xyz",
    "title": "StartupXYZ — Website Redesign",
    "status": "QUALIFICATION",
    "value": 0
  },
  "contact": {
    "id": "contact_abc",
    "firstName": "Rahul",
    "lastName": "Mehta",
    "email": "rahul@startup.com"
  },
  "company": {
    "id": "company_1",
    "name": "StartupXYZ"
  },
  "lead": {
    "id": "lead_abc",
    "status": "CONVERTED",
    "convertedDealId": "deal_xyz",
    "convertedAt": "2025-06-01T11:00:00.000Z"
  }
}
```

**Validation:**
- Lead must be in `QUALIFIED` status
- If `existingContactId` provided, it must exist in workspace
- Cannot convert an already-converted lead

---

### POST `/api/v1/leads/:id/activities`

Log a manual activity on a lead.

**Permission:** `SUPER_ADMIN`, `ADMIN`, `TEAM_LEAD` (own team)

**Request Body:**
```ts
class CreateCrmActivityDto {
  @IsEnum(CrmActivityType)
  type: CrmActivityType  // NOTE_ADDED | EMAIL_SENT | CALL_LOGGED | MEETING_SCHEDULED

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  content?: string

  @IsOptional()
  metadata?: Record<string, unknown>
}
```

**Response `201`:** Activity object.

---

### GET `/api/v1/leads/:id/activities`

Get activity feed for a lead (most recent first).

**Permission:** `SUPER_ADMIN`, `ADMIN`, `TEAM_LEAD` (own team)

**Query Parameters:** `page`, `limit` (default limit: 50)

**Response `200`:**
```json
{
  "data": [
    {
      "id": "act_1",
      "type": "STATUS_CHANGED",
      "content": null,
      "metadata": { "fromStatus": "NEW", "toStatus": "CONTACTED" },
      "actor": { "id": "user_123", "firstName": "Jane", "lastName": "Smith" },
      "createdAt": "2025-06-01T10:00:00.000Z"
    }
  ],
  "meta": { "total": 3, "page": 1, "limit": 50, "totalPages": 1 }
}
```

---

## Deals

---

### POST `/api/v1/deals`

Create a new deal.

**Permission:** `SUPER_ADMIN`, `ADMIN`, `TEAM_LEAD`

**Request Body:**
```ts
class CreateDealDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string

  @IsOptional()
  @IsNumber()
  @Min(0)
  value?: number

  @IsOptional()
  @IsUUID()
  contactId?: string

  @IsOptional()
  @IsUUID()
  companyId?: string

  @IsOptional()
  @IsUUID()
  assignedToId?: string

  @IsOptional()
  @IsUUID()
  teamId?: string

  @IsOptional()
  @IsISO8601()
  expectedCloseDate?: string

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  probability?: number
}
```

**Response `201`:** Full deal object.

---

### GET `/api/v1/deals`

List deals with pipeline filtering.

**Permission:** `SUPER_ADMIN`, `ADMIN` → all; `TEAM_LEAD` → own team only

**Query Parameters:**
| Param | Type | Description |
|---|---|---|
| `status` | `DealStatus` | Pipeline stage filter |
| `assignedToId` | string | Filter by owner |
| `teamId` | string | Filter by team |
| `contactId` | string | Deals for a specific contact |
| `companyId` | string | Deals for a specific company |
| `closedFrom` | date | Close date range start |
| `closedTo` | date | Close date range end |
| `minValue` | number | Min deal value |
| `maxValue` | number | Max deal value |
| `search` | string | Search on title |

**Response `200`:** Paginated list of deals. Each deal includes `contact`, `company`, `assignedTo`, `team` (embedded summary objects).

---

### GET `/api/v1/deals/:id`

Get a deal with full details including linked contact, company, projects, and invoices.

**Permission:** `SUPER_ADMIN`, `ADMIN`; `TEAM_LEAD` → own team only

**Response `200`:**
```json
{
  "id": "deal_xyz",
  "title": "StartupXYZ — Website Redesign",
  "value": 150000,
  "currency": "INR",
  "status": "PROPOSAL",
  "probability": 60,
  "expectedCloseDate": "2025-07-15T00:00:00.000Z",
  "closedAt": null,
  "lossReason": null,
  "contact": { "id": "contact_abc", "firstName": "Rahul", "lastName": "Mehta" },
  "company": { "id": "company_1", "name": "StartupXYZ" },
  "assignedTo": { "id": "user_123", "firstName": "Jane", "lastName": "Smith" },
  "team": { "id": "team_1", "name": "Sales" },
  "sourceLeadId": "lead_abc",
  "projects": [{ "id": "proj_1", "name": "Website Redesign", "status": "ACTIVE" }],
  "invoices": [],
  "createdAt": "2025-06-01T11:00:00.000Z",
  "updatedAt": "2025-06-01T11:00:00.000Z",
  "_count": { "activities": 5, "documents": 2 }
}
```

---

### PATCH `/api/v1/deals/:id`

Update deal fields, stage, value, or assignee.

**Permission:** `SUPER_ADMIN`, `ADMIN`; `TEAM_LEAD` → own team only

**Request Body:**
```ts
class UpdateDealDto {
  @IsOptional() @IsString() @MaxLength(200) title?: string
  @IsOptional() @IsNumber() @Min(0) value?: number
  @IsOptional() @IsEnum(DealStatus) status?: DealStatus
  @IsOptional() @IsUUID() contactId?: string
  @IsOptional() @IsUUID() companyId?: string
  @IsOptional() @IsUUID() assignedToId?: string
  @IsOptional() @IsUUID() teamId?: string
  @IsOptional() @IsISO8601() expectedCloseDate?: string
  @IsOptional() @IsInt() @Min(0) @Max(100) probability?: number
}
```

**Validation:**
- Cannot update `status` to `WON` or `LOST` via PATCH — use dedicated endpoints
- Status transitions must follow the defined state machine

---

### POST `/api/v1/deals/:id/win`

Mark a deal as Won.

**Permission:** `SUPER_ADMIN`, `ADMIN`; `TEAM_LEAD` → own team only

**Request Body:**
```ts
class CloseDealWonDto {
  @IsNumber()
  @Min(0)
  finalValue: number

  @IsISO8601()
  closeDate: string

  @IsOptional()
  @IsBoolean()
  createProject?: boolean  // default false

  @IsOptional()
  @IsString()
  projectName?: string  // required if createProject: true

  @IsOptional()
  @IsBoolean()
  createInvoice?: boolean  // default false
}
```

**Response `200`:**
```json
{
  "deal": { "id": "deal_xyz", "status": "WON", "closedAt": "2025-06-01T..." },
  "project": { "id": "proj_2", "name": "Website Redesign", "status": "PLANNING" },
  "invoiceDraft": null
}
```

**Side Effects:**
- `CrmActivity`: type=`STATUS_CHANGED`, `{ fromStatus: "NEGOTIATION", toStatus: "WON" }`
- Revenue report data updated
- If `createProject`: Project created in PLANNING status, TEAM_LEAD notified

---

### POST `/api/v1/deals/:id/lose`

Mark a deal as Lost.

**Permission:** `SUPER_ADMIN`, `ADMIN`; `TEAM_LEAD` → own team only

**Request Body:**
```ts
class CloseDealLostDto {
  @IsEnum(['PRICE', 'COMPETITOR', 'NO_BUDGET', 'NO_NEED', 'TIMING', 'NO_DECISION', 'OTHER'])
  lossReason: string

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  lossNote?: string
}
```

**Response `200`:** Updated deal object with `status: "LOST"`.

---

### DELETE `/api/v1/deals/:id`

Soft-delete a deal.

**Permission:** `SUPER_ADMIN`, `ADMIN`

**Validation:** Cannot delete a deal with status `WON` that has linked projects or unpaid invoices.

---

### GET `/api/v1/deals/:id/activities`
### POST `/api/v1/deals/:id/activities`

Same shape as Lead activities endpoints.

---

## Contacts

---

### POST `/api/v1/contacts`

**Permission:** `SUPER_ADMIN`, `ADMIN`, `TEAM_LEAD`

**Request Body:**
```ts
class CreateContactDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  firstName: string

  @IsOptional() @IsString() @MaxLength(50) lastName?: string
  @IsOptional() @IsEmail() email?: string
  @IsOptional() @IsPhoneNumber() phone?: string
  @IsOptional() @IsString() @MaxLength(100) jobTitle?: string
  @IsOptional() @IsUUID() companyId?: string
  @IsOptional() @IsString() address?: string
  @IsOptional() @IsString() @MaxLength(100) city?: string
  @IsOptional() @IsString() @MaxLength(100) state?: string
  @IsOptional() @IsString() country?: string
  @IsOptional() @IsString() @MaxLength(20) pincode?: string
  @IsOptional() @IsString() @MaxLength(15) gstin?: string
}
```

**Response `201`:** Full contact object.

**Validation:**
- `email` unique per workspace (soft-enforced: warns on duplicate, does not block)
- `companyId` must exist in workspace

---

### GET `/api/v1/contacts`

**Permission:** `SUPER_ADMIN`, `ADMIN`, `TEAM_LEAD`

**Query Parameters:** `status`, `companyId`, `search` (name/email/phone), standard pagination

---

### GET `/api/v1/contacts/:id`
### PATCH `/api/v1/contacts/:id`
### DELETE `/api/v1/contacts/:id`

Standard CRUD. DELETE checks for open deals linked to this contact.

---

## Companies

---

### POST `/api/v1/companies`

**Permission:** `SUPER_ADMIN`, `ADMIN`, `TEAM_LEAD`

**Request Body:**
```ts
class CreateCompanyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string

  @IsOptional() @IsString() industry?: string
  @IsOptional() @IsUrl() website?: string
  @IsOptional() @IsPhoneNumber() phone?: string
  @IsOptional() @IsEmail() email?: string
  @IsOptional() @IsString() @MaxLength(15) gstin?: string
  @IsOptional() @IsString() @MaxLength(10) pan?: string
  @IsOptional() @IsString() address?: string
  @IsOptional() @IsString() @MaxLength(100) city?: string
  @IsOptional() @IsString() @MaxLength(100) state?: string
  @IsOptional() @IsString() country?: string
  @IsOptional() @IsString() @MaxLength(20) pincode?: string
}
```

**Response `201`:** Full company object.

---

### GET `/api/v1/companies`

**Query Parameters:** `status`, `industry`, `search`, standard pagination.

---

### GET `/api/v1/companies/:id`

Returns company with embedded `contacts` list summary and `deals` count.

---

### PATCH `/api/v1/companies/:id`
### DELETE `/api/v1/companies/:id`

DELETE blocked if company has open deals.

---

## Campaigns

---

### POST `/api/v1/campaigns`

**Permission:** `SUPER_ADMIN`, `ADMIN`

**Request Body:**
```ts
class CreateCampaignDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsISO8601()
  scheduledAt?: string
}
```

**Response `201`:** Campaign object.

---

### GET `/api/v1/campaigns`

**Permission:** `SUPER_ADMIN`, `ADMIN`

**Query Parameters:** `status`, `search`, standard pagination.

---

### GET `/api/v1/campaigns/:id`
### PATCH `/api/v1/campaigns/:id`
### DELETE `/api/v1/campaigns/:id`

---

### POST `/api/v1/campaigns/:id/launch`

Set campaign status to RUNNING (or SCHEDULED if future date).

**Permission:** `SUPER_ADMIN`, `ADMIN`

**Request Body:**
```ts
class LaunchCampaignDto {
  @IsOptional()
  @IsISO8601()
  scheduledAt?: string  // if omitted: launch immediately
}
```

---

## Mailing

---

### POST `/api/v1/mailings`

**Permission:** `SUPER_ADMIN`, `ADMIN`

**Request Body:**
```ts
class CreateMailingDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  subject: string

  @IsString()
  @IsNotEmpty()
  bodyHtml: string

  @IsOptional()
  @IsString()
  bodyText?: string

  @IsOptional()
  @IsUUID()
  campaignId?: string

  @IsOptional()
  @IsISO8601()
  scheduledAt?: string

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MailingRecipientDto)
  recipients: MailingRecipientDto[]
}

class MailingRecipientDto {
  @IsEmail()
  email: string

  @IsOptional()
  @IsString()
  name?: string

  @IsOptional()
  @IsUUID()
  contactId?: string
}
```

**Response `201`:** Mailing object with recipient count.

**Validation:**
- `subject` max 200 chars
- `recipients` — min 1 recipient
- `recipients[].email` — valid email for each

---

### GET `/api/v1/mailings`

**Permission:** `SUPER_ADMIN`, `ADMIN`

**Query Parameters:** `status`, `campaignId`, standard pagination.

---

### GET `/api/v1/mailings/:id`

Returns mailing with aggregated stats (`totalSent`, `totalOpened`, etc.).

---

### PATCH `/api/v1/mailings/:id`

Only editable when `status` is `DRAFT`.

---

### POST `/api/v1/mailings/:id/send`

Move mailing from `REVIEW` to `SCHEDULED` or `SENDING`.

**Permission:** `SUPER_ADMIN`, `ADMIN`

**Request Body:**
```ts
class SendMailingDto {
  @IsOptional()
  @IsISO8601()
  scheduledAt?: string  // if omitted: send immediately
}
```

---

### GET `/api/v1/mailings/:id/recipients`

Paginated recipient list with per-recipient delivery status.

**Permission:** `SUPER_ADMIN`, `ADMIN`

**Query Parameters:** `status` (SENT | OPENED | CLICKED | BOUNCED | UNSUBSCRIBED), standard pagination.

---

## Reports (CRM)

---

### GET `/api/v1/crm/reports/pipeline`

Pipeline summary grouped by status.

**Permission:** `SUPER_ADMIN`, `ADMIN`; `TEAM_LEAD` → own team only

**Query Parameters:** `teamId`, `assignedToId`, `from`, `to`

**Response `200`:**
```json
{
  "summary": [
    { "status": "QUALIFICATION", "count": 12, "totalValue": 840000 },
    { "status": "PROPOSAL", "count": 7, "totalValue": 620000 },
    { "status": "NEGOTIATION", "count": 3, "totalValue": 280000 },
    { "status": "WON", "count": 5, "totalValue": 450000 },
    { "status": "LOST", "count": 2, "totalValue": 90000 }
  ],
  "totalPipelineValue": 2280000,
  "winRate": 71.4
}
```

---

### GET `/api/v1/crm/reports/lead-sources`

Lead count and conversion rate by source.

**Permission:** `SUPER_ADMIN`, `ADMIN`

**Query Parameters:** `from`, `to`

---

### GET `/api/v1/crm/reports/revenue`

Monthly revenue from WON deals.

**Permission:** `SUPER_ADMIN`, `ADMIN`

**Query Parameters:** `year`, `groupBy` (month | quarter)

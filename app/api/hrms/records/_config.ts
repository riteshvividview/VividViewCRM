/**
 * Declarative config for the generic HRMS records API (/api/hrms/records/[resource]).
 * Each resource maps to one hr_* table and declares who can read/write which fields.
 *
 * Scopes:
 *  - read "workspace": every workspace member sees all rows (announcements, jobs…)
 *  - read "own":       employees see rows where employee_id = self; HR sees all
 *  - read "hr":        HR/super_admin only
 *  - create "any":     any employee can create; employee_id is forced to self unless HR
 *  - create "hr":      HR/super_admin only
 *
 * `ownerFields` are the fields a non-HR owner may change on their own row (only while
 * `ownerEditableWhen` matches, e.g. a pending claim). Everything else is HR-only.
 */

export type ReadScope = "workspace" | "own" | "hr";
export type CreateScope = "any" | "hr";

export interface ResourceConfig {
  table: string;
  select: string;
  order: { column: string; ascending: boolean };
  read: ReadScope;
  create: CreateScope;
  /** Fields accepted on create/update (whitelist). */
  fields: string[];
  required: string[];
  ownerFields?: string[];
  ownerEditableWhen?: { field: string; values: string[] };
  /** Status values an owner may set on their own row (anything else is HR-only). */
  ownerStatuses?: string[];
  /** Extra filterable query params (?status=…). */
  filters?: string[];
  /** Additional columns where the caller also counts as "owner" (e.g. reviewer). */
  extraOwnerColumns?: string[];
  stampCreatedBy?: boolean;
  /** When status moves to one of these values, decided_by/decided_at are stamped. */
  decisionStatuses?: string[];
}

const EMP = "employee:hr_employees!employee_id(id, employee_code, designation, profiles(full_name, avatar_url))";

export const RESOURCES: Record<string, ResourceConfig> = {
  assets: {
    table: "hr_assets",
    select: `*, ${EMP}`,
    order: { column: "created_at", ascending: false },
    read: "own", create: "hr",
    fields: ["name", "asset_tag", "category", "serial_number", "status", "employee_id", "assigned_on", "purchase_date", "cost", "notes"],
    required: ["name"],
    filters: ["status", "category", "employee_id"],
  },
  expenses: {
    table: "hr_expense_claims",
    select: `*, ${EMP}`,
    order: { column: "expense_date", ascending: false },
    read: "own", create: "any",
    fields: ["employee_id", "category", "amount", "expense_date", "description", "receipt_url", "status", "rejection_reason"],
    required: ["amount", "expense_date"],
    ownerFields: ["category", "amount", "expense_date", "description", "receipt_url"],
    ownerEditableWhen: { field: "status", values: ["pending"] },
    filters: ["status", "employee_id"],
    decisionStatuses: ["approved", "rejected", "paid"],
  },
  loans: {
    table: "hr_loans",
    select: `*, ${EMP}`,
    order: { column: "created_at", ascending: false },
    read: "own", create: "any",
    fields: ["employee_id", "loan_type", "amount", "emi_amount", "outstanding", "reason", "status"],
    required: ["amount"],
    ownerFields: ["loan_type", "amount", "reason"],
    ownerEditableWhen: { field: "status", values: ["pending"] },
    filters: ["status", "employee_id"],
    decisionStatuses: ["active", "rejected"],
  },
  announcements: {
    table: "hr_announcements",
    select: "*",
    order: { column: "created_at", ascending: false },
    read: "workspace", create: "hr",
    fields: ["title", "body", "category", "pinned", "expires_on"],
    required: ["title", "body"],
    stampCreatedBy: true,
  },
  tickets: {
    table: "hr_tickets",
    select: `*, ${EMP}`,
    order: { column: "created_at", ascending: false },
    read: "own", create: "any",
    fields: ["employee_id", "category", "subject", "description", "priority", "status", "resolution"],
    required: ["subject"],
    ownerFields: ["subject", "description", "priority"],
    ownerEditableWhen: { field: "status", values: ["open"] },
    filters: ["status", "priority", "employee_id"],
  },
  goals: {
    table: "hr_goals",
    select: `*, ${EMP}`,
    order: { column: "created_at", ascending: false },
    read: "own", create: "any",
    fields: ["employee_id", "title", "description", "goal_type", "period", "due_date", "progress", "status"],
    required: ["title"],
    ownerFields: ["title", "description", "goal_type", "period", "due_date", "progress", "status"],
    ownerStatuses: ["not_started", "on_track", "at_risk", "behind", "completed"],
    filters: ["status", "employee_id"],
  },
  "review-cycles": {
    table: "hr_review_cycles",
    select: "*",
    order: { column: "created_at", ascending: false },
    read: "workspace", create: "hr",
    fields: ["name", "start_date", "end_date", "status"],
    required: ["name"],
  },
  reviews: {
    table: "hr_reviews",
    select: `*, ${EMP}, reviewer:hr_employees!reviewer_employee_id(id, profiles(full_name)), cycle:hr_review_cycles(name)`,
    order: { column: "created_at", ascending: false },
    read: "own", create: "hr",
    fields: ["cycle_id", "employee_id", "reviewer_employee_id", "review_type", "rating", "strengths", "improvements", "comments", "status"],
    required: ["employee_id"],
    ownerFields: ["rating", "strengths", "improvements", "comments", "status"],
    ownerEditableWhen: { field: "status", values: ["pending"] },
    extraOwnerColumns: ["reviewer_employee_id"],
    ownerStatuses: ["pending", "submitted"],
    filters: ["cycle_id", "status", "employee_id"],
  },
  feedback: {
    table: "hr_feedback",
    select: `*, ${EMP}, recipient:hr_employees!to_employee_id(id, profiles(full_name, avatar_url))`,
    order: { column: "created_at", ascending: false },
    read: "workspace", create: "any",
    fields: ["employee_id", "to_employee_id", "kind", "badge", "message"],
    required: ["to_employee_id", "message"],
    ownerFields: ["badge", "message"],
    filters: ["kind", "to_employee_id"],
  },
  jobs: {
    table: "hr_jobs",
    select: "*, department:hr_departments(name)",
    order: { column: "created_at", ascending: false },
    read: "workspace", create: "hr",
    fields: ["title", "department_id", "location", "employment_type", "openings", "description", "status"],
    required: ["title"],
    filters: ["status", "department_id"],
  },
  candidates: {
    table: "hr_candidates",
    select: "*, job:hr_jobs(title)",
    order: { column: "created_at", ascending: false },
    read: "hr", create: "hr",
    fields: ["job_id", "full_name", "email", "phone", "source", "resume_url", "stage", "rating", "expected_ctc", "offered_ctc", "interview_at", "notes"],
    required: ["full_name"],
    filters: ["job_id", "stage"],
  },
  checklists: {
    table: "hr_checklist_items",
    select: `*, ${EMP}`,
    order: { column: "created_at", ascending: true },
    read: "own", create: "hr",
    fields: ["employee_id", "kind", "title", "owner", "due_date", "done"],
    required: ["employee_id", "title"],
    ownerFields: ["done"],
    filters: ["kind", "employee_id", "done"],
  },
  exits: {
    table: "hr_exits",
    select: `*, ${EMP}`,
    order: { column: "created_at", ascending: false },
    read: "own", create: "any",
    fields: ["employee_id", "exit_type", "resignation_date", "last_working_day", "reason", "status", "fnf_amount", "fnf_status", "exit_interview_notes"],
    required: [],
    ownerFields: ["reason", "last_working_day", "status"],
    ownerStatuses: ["withdrawn"],
    ownerEditableWhen: { field: "status", values: ["requested"] },
    filters: ["status", "employee_id"],
  },
  "comp-offs": {
    table: "hr_comp_offs",
    select: `*, ${EMP}`,
    order: { column: "worked_date", ascending: false },
    read: "own", create: "any",
    fields: ["employee_id", "worked_date", "days", "reason", "status"],
    required: ["worked_date"],
    ownerFields: ["worked_date", "days", "reason"],
    ownerEditableWhen: { field: "status", values: ["pending"] },
    filters: ["status", "employee_id"],
    decisionStatuses: ["approved", "rejected"],
  },
  "tax-declarations": {
    table: "hr_tax_declarations",
    select: `*, ${EMP}`,
    order: { column: "financial_year", ascending: false },
    read: "own", create: "any",
    fields: ["employee_id", "financial_year", "regime", "sec_80c", "sec_80d", "sec_80ccd_1b", "home_loan_interest", "annual_rent_paid", "metro_city", "other_deductions", "status", "remarks"],
    required: ["financial_year"],
    ownerFields: ["financial_year", "regime", "sec_80c", "sec_80d", "sec_80ccd_1b", "home_loan_interest", "annual_rent_paid", "metro_city", "other_deductions"],
    // Employees can revise until HR verifies; a rejected declaration can be corrected and resubmitted.
    ownerEditableWhen: { field: "status", values: ["submitted", "rejected"] },
    filters: ["financial_year", "status", "employee_id"],
  },
};

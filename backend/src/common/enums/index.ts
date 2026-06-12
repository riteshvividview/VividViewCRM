// ─────────────────────────────────────────────────────────────────────────────
// All application enums — mirrors prisma/schema.prisma exactly.
// These TypeScript enums are the single source of truth for business logic.
// The Prisma schema enums are generated from the DB; these drive validation
// and business rules throughout the application layer.
// ─────────────────────────────────────────────────────────────────────────────

// ── Core ─────────────────────────────────────────────────────────────────────

export enum Role {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  HR = 'HR',
  TEAM_LEAD = 'TEAM_LEAD',
  EMPLOYEE = 'EMPLOYEE',
}

// ── CRM ──────────────────────────────────────────────────────────────────────

export enum LeadStatus {
  NEW = 'NEW',
  ATTEMPTING_CONTACT = 'ATTEMPTING_CONTACT',
  CONTACTED = 'CONTACTED',
  QUALIFIED = 'QUALIFIED',
  DISQUALIFIED = 'DISQUALIFIED',
  CONVERTED = 'CONVERTED',
}

export enum DealStatus {
  QUALIFICATION = 'QUALIFICATION',
  PROPOSAL = 'PROPOSAL',
  NEGOTIATION = 'NEGOTIATION',
  WON = 'WON',
  LOST = 'LOST',
  ON_HOLD = 'ON_HOLD',
}

export enum ContactStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  ARCHIVED = 'ARCHIVED',
}

export enum CampaignStatus {
  DRAFT = 'DRAFT',
  SCHEDULED = 'SCHEDULED',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum MailStatus {
  DRAFT = 'DRAFT',
  REVIEW = 'REVIEW',
  SCHEDULED = 'SCHEDULED',
  SENDING = 'SENDING',
  SENT = 'SENT',
  FAILED = 'FAILED',
}

export enum CrmActivityType {
  NOTE_ADDED = 'NOTE_ADDED',
  EMAIL_SENT = 'EMAIL_SENT',
  CALL_LOGGED = 'CALL_LOGGED',
  MEETING_SCHEDULED = 'MEETING_SCHEDULED',
  STATUS_CHANGED = 'STATUS_CHANGED',
  DEAL_CREATED = 'DEAL_CREATED',
  DOCUMENT_ATTACHED = 'DOCUMENT_ATTACHED',
  ASSIGNEE_CHANGED = 'ASSIGNEE_CHANGED',
  FIELD_UPDATED = 'FIELD_UPDATED',
  CONVERTED = 'CONVERTED',
}

// ── Tasks ────────────────────────────────────────────────────────────────────

export enum TaskStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  BLOCKED = 'BLOCKED',
  IN_REVIEW = 'IN_REVIEW',
  DONE = 'DONE',
  CANCELLED = 'CANCELLED',
  ARCHIVED = 'ARCHIVED',
}

export enum TaskPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export enum BlockerType {
  DEPENDENCY = 'DEPENDENCY',
  EXTERNAL = 'EXTERNAL',
  RESOURCE = 'RESOURCE',
  UNCLEAR_REQUIREMENTS = 'UNCLEAR_REQUIREMENTS',
  OTHER = 'OTHER',
}

export enum TimeEntryStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  BILLED = 'BILLED',
}

export enum ProjectStatus {
  PLANNING = 'PLANNING',
  ACTIVE = 'ACTIVE',
  ON_HOLD = 'ON_HOLD',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum ProjectType {
  CLIENT = 'CLIENT',
  INTERNAL = 'INTERNAL',
  MAINTENANCE = 'MAINTENANCE',
}

export enum SprintStatus {
  DRAFT = 'DRAFT',
  PLANNED = 'PLANNED',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum RecurringFrequency {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  BIWEEKLY = 'BIWEEKLY',
  MONTHLY = 'MONTHLY',
  CUSTOM = 'CUSTOM',
}

export enum RecurringTemplateStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  ENDED = 'ENDED',
  ARCHIVED = 'ARCHIVED',
}

// ── HRMS ─────────────────────────────────────────────────────────────────────

export enum EmployeeStatus {
  ONBOARDING = 'ONBOARDING',
  ACTIVE = 'ACTIVE',
  ON_LEAVE = 'ON_LEAVE',
  SUSPENDED = 'SUSPENDED',
  EXITING = 'EXITING',
  TERMINATED = 'TERMINATED',
}

export enum EmploymentType {
  FULL_TIME = 'FULL_TIME',
  PART_TIME = 'PART_TIME',
  CONTRACT = 'CONTRACT',
  INTERN = 'INTERN',
}

export enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  OTHER = 'OTHER',
  PREFER_NOT_TO_SAY = 'PREFER_NOT_TO_SAY',
}

export enum AttendanceStatus {
  ABSENT = 'ABSENT',
  PRESENT = 'PRESENT',
  HALF_DAY = 'HALF_DAY',
  LEAVE = 'LEAVE',
  HOLIDAY = 'HOLIDAY',
  WEEKEND = 'WEEKEND',
  REGULARISED = 'REGULARISED',
}

export enum ClockEventType {
  CLOCK_IN = 'CLOCK_IN',
  CLOCK_OUT = 'CLOCK_OUT',
}

export enum ClockSource {
  WEB = 'WEB',
  MOBILE = 'MOBILE',
  KIOSK = 'KIOSK',
}

export enum RegularisationStatus {
  SUBMITTED = 'SUBMITTED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum LeaveApprovalRoute {
  NONE = 'NONE',
  L1_ONLY = 'L1_ONLY',
  L1_AND_L2 = 'L1_AND_L2',
  L2_ONLY = 'L2_ONLY',
}

export enum LeaveApplicationStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  PENDING_L1 = 'PENDING_L1',
  PENDING_L2 = 'PENDING_L2',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
  WITHDRAWN = 'WITHDRAWN',
  EXPIRED = 'EXPIRED',
}

export enum HolidayType {
  NATIONAL = 'NATIONAL',
  REGIONAL = 'REGIONAL',
  COMPANY = 'COMPANY',
}

export enum PayrollRunStatus {
  DRAFT = 'DRAFT',
  UNDER_REVIEW = 'UNDER_REVIEW',
  APPROVED = 'APPROVED',
  FINALISED = 'FINALISED',
  DISBURSED = 'DISBURSED',
  CANCELLED = 'CANCELLED',
}

export enum PayslipStatus {
  PENDING = 'PENDING',
  GENERATED = 'GENERATED',
  DISTRIBUTED = 'DISTRIBUTED',
  DOWNLOADED = 'DOWNLOADED',
}

export enum SalaryStructureStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  SUPERSEDED = 'SUPERSEDED',
  ARCHIVED = 'ARCHIVED',
}

export enum SalaryComponentType {
  EARNING = 'EARNING',
  DEDUCTION = 'DEDUCTION',
}

export enum DeductionBasis {
  FIXED = 'FIXED',
  PERCENTAGE_OF_BASIC = 'PERCENTAGE_OF_BASIC',
  PERCENTAGE_OF_GROSS = 'PERCENTAGE_OF_GROSS',
}

export enum BonusType {
  PERFORMANCE = 'PERFORMANCE',
  FESTIVAL = 'FESTIVAL',
  REFERRAL = 'REFERRAL',
  JOINING = 'JOINING',
  RETENTION = 'RETENTION',
  OTHER = 'OTHER',
}

export enum EmployeeExitType {
  RESIGNATION = 'RESIGNATION',
  TERMINATION = 'TERMINATION',
  RETIREMENT = 'RETIREMENT',
  CONTRACT_END = 'CONTRACT_END',
  ABSCONDING = 'ABSCONDING',
}

export enum ProbationStatus {
  UNDER_PROBATION = 'UNDER_PROBATION',
  CONFIRMED = 'CONFIRMED',
  EXTENDED = 'EXTENDED',
  FAILED = 'FAILED',
}

export enum ExitChecklistItemStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  WAIVED = 'WAIVED',
}

export enum OnboardingItemStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  WAIVED = 'WAIVED',
}

export enum PerformanceReviewStatus {
  DRAFT = 'DRAFT',
  SELF_ASSESSMENT = 'SELF_ASSESSMENT',
  MANAGER_REVIEW = 'MANAGER_REVIEW',
  HR_REVIEW = 'HR_REVIEW',
  COMPLETED = 'COMPLETED',
}

export enum PerformanceReviewType {
  ANNUAL = 'ANNUAL',
  QUARTERLY = 'QUARTERLY',
  PROBATION = 'PROBATION',
}

export enum ProfileChangeStatus {
  SUBMITTED = 'SUBMITTED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

// ── Invoice ──────────────────────────────────────────────────────────────────

export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  READY_TO_SEND = 'READY_TO_SEND',
  SENT = 'SENT',
  VIEWED = 'VIEWED',
  OVERDUE = 'OVERDUE',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  PAID = 'PAID',
  VOIDED = 'VOIDED',
}

export enum GstType {
  CGST_SGST = 'CGST_SGST',
  IGST = 'IGST',
  EXEMPT = 'EXEMPT',
}

export enum PaymentMethod {
  BANK_TRANSFER = 'BANK_TRANSFER',
  UPI = 'UPI',
  CHEQUE = 'CHEQUE',
  CASH = 'CASH',
  ONLINE_GATEWAY = 'ONLINE_GATEWAY',
  OTHER = 'OTHER',
}

export enum CreditNoteStatus {
  ISSUED = 'ISSUED',
  APPLIED = 'APPLIED',
  EXPIRED = 'EXPIRED',
}

// ── Documents ────────────────────────────────────────────────────────────────

export enum DocumentCategory {
  HR = 'HR',
  CRM = 'CRM',
  PROJECT = 'PROJECT',
  INVOICE = 'INVOICE',
  GENERAL = 'GENERAL',
}

export enum DocumentStatus {
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
  DELETED = 'DELETED',
}

// ── Approvals ────────────────────────────────────────────────────────────────

export enum ApprovalSubjectType {
  LEAVE_APPLICATION = 'LEAVE_APPLICATION',
  ATTENDANCE_REGULARISATION = 'ATTENDANCE_REGULARISATION',
  TIME_ENTRY = 'TIME_ENTRY',
  PAYROLL_RUN = 'PAYROLL_RUN',
  INVOICE = 'INVOICE',
  EMPLOYEE_PROFILE_CHANGE = 'EMPLOYEE_PROFILE_CHANGE',
  ONBOARDING_COMPLETION = 'ONBOARDING_COMPLETION',
  EXIT_CLEARANCE = 'EXIT_CLEARANCE',
  PROBATION_REVIEW = 'PROBATION_REVIEW',
  PERFORMANCE_REVIEW = 'PERFORMANCE_REVIEW',
  DOCUMENT_ACKNOWLEDGEMENT = 'DOCUMENT_ACKNOWLEDGEMENT',
}

export enum ApprovalRequestStatus {
  PENDING = 'PENDING',
  UNDER_REVIEW = 'UNDER_REVIEW',
  ESCALATED = 'ESCALATED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
  WITHDRAWN = 'WITHDRAWN',
}

export enum ApprovalActionType {
  OPENED = 'OPENED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  ESCALATED = 'ESCALATED',
  DELEGATED = 'DELEGATED',
  WITHDRAWN = 'WITHDRAWN',
}

// ── Notifications ────────────────────────────────────────────────────────────

export enum NotificationChannel {
  IN_APP = 'IN_APP',
  EMAIL = 'EMAIL',
  BOTH = 'BOTH',
}

// ── Audit ────────────────────────────────────────────────────────────────────

export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  SOFT_DELETE = 'SOFT_DELETE',
  RESTORE = 'RESTORE',
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
  ESCALATE = 'ESCALATE',
  EXPORT = 'EXPORT',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  ROLE_CHANGE = 'ROLE_CHANGE',
  PERMISSION_CHANGE = 'PERMISSION_CHANGE',
  PAYROLL_UNLOCK = 'PAYROLL_UNLOCK',
  SALARY_CHANGE = 'SALARY_CHANGE',
}

// ── Sort direction ────────────────────────────────────────────────────────────

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

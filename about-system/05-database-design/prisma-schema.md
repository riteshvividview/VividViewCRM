# Prisma Schema — VividCRM

Complete production schema. Place this in `prisma/schema.prisma`.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================================
// ENUMS
// ============================================================

enum Role {
  SUPER_ADMIN
  ADMIN
  HR
  TEAM_LEAD
  EMPLOYEE
}

enum LeadStatus {
  NEW
  ATTEMPTING_CONTACT
  CONTACTED
  QUALIFIED
  DISQUALIFIED
  CONVERTED
}

enum DealStatus {
  QUALIFICATION
  PROPOSAL
  NEGOTIATION
  WON
  LOST
  ON_HOLD
}

enum ContactStatus {
  ACTIVE
  INACTIVE
  ARCHIVED
}

enum CampaignStatus {
  DRAFT
  SCHEDULED
  RUNNING
  COMPLETED
  CANCELLED
}

enum MailStatus {
  DRAFT
  REVIEW
  SCHEDULED
  SENDING
  SENT
  FAILED
}

enum CrmActivityType {
  NOTE_ADDED
  EMAIL_SENT
  CALL_LOGGED
  MEETING_SCHEDULED
  STATUS_CHANGED
  DEAL_CREATED
  DOCUMENT_ATTACHED
  ASSIGNEE_CHANGED
  FIELD_UPDATED
  CONVERTED
}

enum TaskStatus {
  TODO
  IN_PROGRESS
  BLOCKED
  IN_REVIEW
  DONE
  CANCELLED
  ARCHIVED
}

enum TaskPriority {
  LOW
  MEDIUM
  HIGH
  URGENT
}

enum BlockerType {
  DEPENDENCY
  EXTERNAL
  RESOURCE
  UNCLEAR_REQUIREMENTS
  OTHER
}

enum TimeEntryStatus {
  DRAFT
  SUBMITTED
  APPROVED
  REJECTED
  BILLED
}

enum ProjectStatus {
  PLANNING
  ACTIVE
  ON_HOLD
  COMPLETED
  CANCELLED
}

enum ProjectType {
  CLIENT
  INTERNAL
  MAINTENANCE
}

enum SprintStatus {
  DRAFT
  PLANNED
  ACTIVE
  COMPLETED
  CANCELLED
}

enum RecurringFrequency {
  DAILY
  WEEKLY
  BIWEEKLY
  MONTHLY
  CUSTOM
}

enum RecurringTemplateStatus {
  ACTIVE
  PAUSED
  ENDED
  ARCHIVED
}

enum EmployeeStatus {
  ONBOARDING
  ACTIVE
  ON_LEAVE
  SUSPENDED
  EXITING
  TERMINATED
}

enum EmploymentType {
  FULL_TIME
  PART_TIME
  CONTRACT
  INTERN
}

enum Gender {
  MALE
  FEMALE
  OTHER
  PREFER_NOT_TO_SAY
}

enum AttendanceStatus {
  ABSENT
  PRESENT
  HALF_DAY
  LEAVE
  HOLIDAY
  WEEKEND
  REGULARISED
}

enum ClockEventType {
  CLOCK_IN
  CLOCK_OUT
}

enum ClockSource {
  WEB
  MOBILE
  KIOSK
}

enum RegularisationStatus {
  SUBMITTED
  UNDER_REVIEW
  APPROVED
  REJECTED
}

enum LeaveApprovalRoute {
  NONE
  L1_ONLY
  L1_AND_L2
  L2_ONLY
}

enum LeaveApplicationStatus {
  DRAFT
  SUBMITTED
  PENDING_L1
  PENDING_L2
  APPROVED
  REJECTED
  CANCELLED
  WITHDRAWN
  EXPIRED
}

enum HolidayType {
  NATIONAL
  REGIONAL
  COMPANY
}

enum PayrollRunStatus {
  DRAFT
  UNDER_REVIEW
  APPROVED
  FINALISED
  DISBURSED
  CANCELLED
}

enum PayslipStatus {
  PENDING
  GENERATED
  DISTRIBUTED
  DOWNLOADED
}

enum SalaryStructureStatus {
  DRAFT
  ACTIVE
  SUPERSEDED
  ARCHIVED
}

enum SalaryComponentType {
  EARNING
  DEDUCTION
}

enum DeductionBasis {
  FIXED
  PERCENTAGE_OF_BASIC
  PERCENTAGE_OF_GROSS
}

enum BonusType {
  PERFORMANCE
  FESTIVAL
  REFERRAL
  JOINING
  RETENTION
  OTHER
}

enum EmployeeExitType {
  RESIGNATION
  TERMINATION
  RETIREMENT
  CONTRACT_END
  ABSCONDING
}

enum ProbationStatus {
  UNDER_PROBATION
  CONFIRMED
  EXTENDED
  FAILED
}

enum ExitChecklistItemStatus {
  PENDING
  IN_PROGRESS
  COMPLETED
  WAIVED
}

enum OnboardingItemStatus {
  PENDING
  IN_PROGRESS
  COMPLETED
  WAIVED
}

enum PerformanceReviewStatus {
  DRAFT
  SELF_ASSESSMENT
  MANAGER_REVIEW
  HR_REVIEW
  COMPLETED
}

enum PerformanceReviewType {
  ANNUAL
  QUARTERLY
  PROBATION
}

enum ProfileChangeStatus {
  SUBMITTED
  UNDER_REVIEW
  APPROVED
  REJECTED
}

enum InvoiceStatus {
  DRAFT
  READY_TO_SEND
  SENT
  VIEWED
  OVERDUE
  PARTIALLY_PAID
  PAID
  VOIDED
}

enum GstType {
  CGST_SGST
  IGST
  EXEMPT
}

enum PaymentMethod {
  BANK_TRANSFER
  UPI
  CHEQUE
  CASH
  ONLINE_GATEWAY
  OTHER
}

enum CreditNoteStatus {
  ISSUED
  APPLIED
  EXPIRED
}

enum DocumentCategory {
  HR
  CRM
  PROJECT
  INVOICE
  GENERAL
}

enum DocumentStatus {
  ACTIVE
  ARCHIVED
  DELETED
}

enum ApprovalSubjectType {
  LEAVE_APPLICATION
  ATTENDANCE_REGULARISATION
  TIME_ENTRY
  PAYROLL_RUN
  INVOICE
  EMPLOYEE_PROFILE_CHANGE
  ONBOARDING_COMPLETION
  EXIT_CLEARANCE
  PROBATION_REVIEW
  PERFORMANCE_REVIEW
  DOCUMENT_ACKNOWLEDGEMENT
}

enum ApprovalRequestStatus {
  PENDING
  UNDER_REVIEW
  ESCALATED
  APPROVED
  REJECTED
  EXPIRED
  WITHDRAWN
}

enum ApprovalActionType {
  OPENED
  APPROVED
  REJECTED
  ESCALATED
  DELEGATED
  WITHDRAWN
}

enum NotificationChannel {
  IN_APP
  EMAIL
  BOTH
}

enum AuditAction {
  CREATE
  UPDATE
  DELETE
  SOFT_DELETE
  RESTORE
  APPROVE
  REJECT
  ESCALATE
  EXPORT
  LOGIN
  LOGOUT
  ROLE_CHANGE
  PERMISSION_CHANGE
  PAYROLL_UNLOCK
  SALARY_CHANGE
}

// ============================================================
// CORE / SHARED
// ============================================================

model Workspace {
  id   String @id @default(cuid())
  name String
  slug String @unique

  logoUrl   String?
  timezone  String  @default("Asia/Kolkata")
  locale    String  @default("en-IN")
  currency  String  @default("INR")

  // Business identity
  businessName    String?
  gstin           String?
  pan             String?
  businessAddress String?
  businessCity    String?
  businessState   String?
  businessPincode String?

  // Feature flags — SaaS plan control
  isCrmEnabled     Boolean @default(true)
  isTasksEnabled   Boolean @default(true)
  isHrmsEnabled    Boolean @default(true)
  isInvoiceEnabled Boolean @default(true)

  // SaaS plan
  plan String @default("INTERNAL")

  // Payroll config
  payrollCycleDay   Int    @default(28)
  payrollStartMonth String @default("APRIL")

  // Leave year config
  leaveYearStart String @default("APRIL")

  // Invoice config
  defaultPaymentTermsDays Int    @default(30)
  invoiceNumberPrefix     String @default("INV")
  nextInvoiceSeq          Int    @default(1)

  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  deletedAt DateTime?

  // Relations
  users               User[]
  teams               Team[]
  leads               Lead[]
  deals               Deal[]
  contacts            Contact[]
  companies           Company[]
  campaigns           Campaign[]
  mailings            Mailing[]
  projects            Project[]
  tasks               Task[]
  sprints             Sprint[]
  recurringTemplates  RecurringTaskTemplate[]
  employees           Employee[]
  departments         Department[]
  shifts              Shift[]
  holidays            Holiday[]
  leaveTypes          LeaveType[]
  leavePolicies       LeavePolicy[]
  salaryStructures    SalaryStructure[]
  payrollRuns         PayrollRun[]
  invoices            Invoice[]
  invoiceTemplates    InvoiceTemplate[]
  documents           Document[]
  notifications       Notification[]
  auditLogs           AuditLog[]
  approvalRequests    ApprovalRequest[]
  approvalDelegations ApprovalDelegation[]
  taskLabels          TaskLabel[]

  @@map("workspaces")
}

model User {
  id          String @id @default(cuid())
  workspaceId String
  workspace   Workspace @relation(fields: [workspaceId], references: [id])

  email        String
  passwordHash String
  firstName    String
  lastName     String
  avatarUrl    String?
  phone        String?

  role         Role
  isActive     Boolean @default(true)
  tokenVersion Int     @default(0)

  lastLoginAt DateTime?

  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  deletedAt DateTime?

  // 1:1 HRMS record
  employee Employee?

  // CRM
  assignedLeads Lead[] @relation("LeadAssignee")
  assignedDeals Deal[] @relation("DealAssignee")
  crmActivities CrmActivity[]

  // Tasks
  assignedTasks  Task[]        @relation("TaskAssignee")
  createdTasks   Task[]        @relation("TaskCreator")
  taskComments   TaskComment[]
  timeEntries    TimeEntry[]

  // Teams
  teamMemberships TeamMember[]
  ledTeams        Team[]       @relation("TeamLead")

  // Projects
  projectMemberships ProjectMember[]

  // Approvals
  approvalActionsPerformed ApprovalAction[]
  delegationsGiven         ApprovalDelegation[] @relation("DelegationGiver")
  delegationsReceived      ApprovalDelegation[] @relation("DelegationReceiver")

  // Notifications
  notifications Notification[] @relation("NotificationRecipient")
  notificationPreference NotificationPreference?

  // Audit
  auditLogs AuditLog[] @relation("AuditActor")

  @@unique([workspaceId, email])
  @@index([workspaceId])
  @@index([workspaceId, role])
  @@index([workspaceId, isActive])
  @@map("users")
}

model Team {
  id          String    @id @default(cuid())
  workspaceId String
  workspace   Workspace @relation(fields: [workspaceId], references: [id])

  name        String
  description String?

  teamLeadId String?
  teamLead   User?   @relation("TeamLead", fields: [teamLeadId], references: [id])

  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  deletedAt DateTime?

  members  TeamMember[]
  leads    Lead[]
  deals    Deal[]
  projects Project[]

  @@index([workspaceId])
  @@map("teams")
}

model TeamMember {
  id     String @id @default(cuid())
  teamId String
  team   Team   @relation(fields: [teamId], references: [id])
  userId String
  user   User   @relation(fields: [userId], references: [id])

  joinedAt DateTime @default(now())

  @@unique([teamId, userId])
  @@index([teamId])
  @@index([userId])
  @@map("team_members")
}

// ============================================================
// CRM
// ============================================================

model Lead {
  id          String    @id @default(cuid())
  workspaceId String
  workspace   Workspace @relation(fields: [workspaceId], references: [id])

  title     String
  firstName String
  lastName  String?
  email     String?
  phone     String?
  company   String?
  jobTitle  String?

  status LeadStatus @default(NEW)
  source String?

  assignedToId String?
  assignedTo   User?   @relation("LeadAssignee", fields: [assignedToId], references: [id])

  teamId String?
  team   Team?   @relation(fields: [teamId], references: [id])

  campaignId String?
  campaign   Campaign? @relation(fields: [campaignId], references: [id])

  // Conversion
  convertedAt     DateTime?
  convertedDealId String?

  // Disqualification
  disqualifiedReason String?

  notes String? @db.Text

  createdById String
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  deletedAt   DateTime?

  activities  CrmActivity[]
  attachments DocumentAttachment[]

  @@index([workspaceId])
  @@index([workspaceId, status])
  @@index([workspaceId, assignedToId])
  @@index([workspaceId, teamId])
  @@index([workspaceId, createdAt])
  @@index([workspaceId, email])
  @@map("leads")
}

model Deal {
  id          String    @id @default(cuid())
  workspaceId String
  workspace   Workspace @relation(fields: [workspaceId], references: [id])

  title    String
  value    Decimal @default(0) @db.Decimal(15, 2)
  currency String  @default("INR")

  status DealStatus @default(QUALIFICATION)

  contactId String?
  contact   Contact? @relation(fields: [contactId], references: [id])

  companyId String?
  company   Company? @relation(fields: [companyId], references: [id])

  assignedToId String?
  assignedTo   User?   @relation("DealAssignee", fields: [assignedToId], references: [id])

  teamId String?
  team   Team?   @relation(fields: [teamId], references: [id])

  sourceLeadId String?

  expectedCloseDate DateTime?
  closedAt          DateTime?

  lossReason  String?
  lossNote    String? @db.Text
  probability Int?

  createdById String
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  deletedAt   DateTime?

  activities  CrmActivity[]
  attachments DocumentAttachment[]
  invoices    Invoice[]
  projects    Project[]

  @@index([workspaceId])
  @@index([workspaceId, status])
  @@index([workspaceId, assignedToId])
  @@index([workspaceId, teamId])
  @@index([workspaceId, closedAt])
  @@index([workspaceId, expectedCloseDate])
  @@map("deals")
}

model Contact {
  id          String    @id @default(cuid())
  workspaceId String
  workspace   Workspace @relation(fields: [workspaceId], references: [id])

  firstName String
  lastName  String?
  email     String?
  phone     String?
  jobTitle  String?

  status ContactStatus @default(ACTIVE)

  companyId String?
  company   Company? @relation(fields: [companyId], references: [id])

  address String?
  city    String?
  state   String?
  country String  @default("India")
  pincode String?
  gstin   String?

  createdById String
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  deletedAt   DateTime?

  deals       Deal[]
  invoices    Invoice[]          @relation("InvoiceContact")
  activities  CrmActivity[]
  attachments DocumentAttachment[]

  @@unique([workspaceId, email])
  @@index([workspaceId])
  @@index([workspaceId, status])
  @@index([workspaceId, companyId])
  @@map("contacts")
}

model Company {
  id          String    @id @default(cuid())
  workspaceId String
  workspace   Workspace @relation(fields: [workspaceId], references: [id])

  name     String
  industry String?
  website  String?
  phone    String?
  email    String?

  status ContactStatus @default(ACTIVE)

  gstin String?
  pan   String?

  address String?
  city    String?
  state   String?
  country String  @default("India")
  pincode String?

  createdById String
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  deletedAt   DateTime?

  contacts    Contact[]
  deals       Deal[]
  invoices    Invoice[]          @relation("InvoiceCompany")
  activities  CrmActivity[]
  attachments DocumentAttachment[]

  @@index([workspaceId])
  @@index([workspaceId, status])
  @@map("companies")
}

model Campaign {
  id          String    @id @default(cuid())
  workspaceId String
  workspace   Workspace @relation(fields: [workspaceId], references: [id])

  name        String
  description String?
  status      CampaignStatus @default(DRAFT)

  scheduledAt DateTime?
  startedAt   DateTime?
  completedAt DateTime?

  createdById String
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  deletedAt   DateTime?

  mailings Mailing[]
  leads    Lead[]

  @@index([workspaceId])
  @@index([workspaceId, status])
  @@map("campaigns")
}

model Mailing {
  id          String    @id @default(cuid())
  workspaceId String
  workspace   Workspace @relation(fields: [workspaceId], references: [id])

  subject  String
  bodyHtml String @db.Text
  bodyText String? @db.Text

  status MailStatus @default(DRAFT)

  campaignId String?
  campaign   Campaign? @relation(fields: [campaignId], references: [id])

  scheduledAt DateTime?
  sentAt      DateTime?

  totalSent    Int @default(0)
  totalOpened  Int @default(0)
  totalClicked Int @default(0)
  totalBounced Int @default(0)

  createdById String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  recipients MailingRecipient[]

  @@index([workspaceId])
  @@index([workspaceId, status])
  @@index([workspaceId, campaignId])
  @@map("mailings")
}

model MailingRecipient {
  id        String  @id @default(cuid())
  mailingId String
  mailing   Mailing @relation(fields: [mailingId], references: [id])

  email     String
  name      String?
  contactId String?

  sentAt         DateTime?
  openedAt       DateTime?
  clickedAt      DateTime?
  bouncedAt      DateTime?
  unsubscribedAt DateTime?

  @@index([mailingId])
  @@index([mailingId, email])
  @@map("mailing_recipients")
}

model CrmActivity {
  id          String          @id @default(cuid())
  workspaceId String

  type CrmActivityType

  leadId    String?
  lead      Lead?    @relation(fields: [leadId], references: [id])
  dealId    String?
  deal      Deal?    @relation(fields: [dealId], references: [id])
  contactId String?
  contact   Contact? @relation(fields: [contactId], references: [id])
  companyId String?
  company   Company? @relation(fields: [companyId], references: [id])

  content  String? @db.Text
  metadata Json?

  actorId String
  actor   User   @relation(fields: [actorId], references: [id])

  createdAt DateTime @default(now())

  @@index([workspaceId])
  @@index([leadId])
  @@index([dealId])
  @@index([contactId])
  @@index([companyId])
  @@index([workspaceId, createdAt])
  @@map("crm_activities")
}

// ============================================================
// TASK MANAGEMENT
// ============================================================

model Project {
  id          String    @id @default(cuid())
  workspaceId String
  workspace   Workspace @relation(fields: [workspaceId], references: [id])

  name        String
  description String?     @db.Text
  status      ProjectStatus @default(PLANNING)
  type        ProjectType   @default(CLIENT)

  contactId String?
  dealId    String?
  deal      Deal?   @relation(fields: [dealId], references: [id])

  teamId     String?
  team       Team?   @relation(fields: [teamId], references: [id])
  teamLeadId String?

  startDate   DateTime?
  endDate     DateTime?
  completedAt DateTime?

  createdById String
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  deletedAt   DateTime?

  members     ProjectMember[]
  boards      Board[]
  tasks       Task[]
  sprints     Sprint[]
  timeEntries TimeEntry[]
  invoices    Invoice[]          @relation("InvoiceProject")
  attachments DocumentAttachment[]

  @@index([workspaceId])
  @@index([workspaceId, status])
  @@index([workspaceId, teamId])
  @@index([workspaceId, dealId])
  @@map("projects")
}

model ProjectMember {
  id        String  @id @default(cuid())
  projectId String
  project   Project @relation(fields: [projectId], references: [id])
  userId    String
  user      User    @relation(fields: [userId], references: [id])

  joinedAt  DateTime  @default(now())
  removedAt DateTime?

  @@unique([projectId, userId])
  @@index([projectId])
  @@index([userId])
  @@map("project_members")
}

model Board {
  id        String  @id @default(cuid())
  projectId String
  project   Project @relation(fields: [projectId], references: [id])

  name  String
  order Int    @default(0)

  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  deletedAt DateTime?

  columns BoardColumn[]

  @@index([projectId])
  @@map("boards")
}

model BoardColumn {
  id      String @id @default(cuid())
  boardId String
  board   Board  @relation(fields: [boardId], references: [id])

  name         String
  order        Int
  wipLimit     Int?
  mappedStatus TaskStatus @default(IN_PROGRESS)

  tasks Task[]

  @@index([boardId])
  @@map("board_columns")
}

model TaskLabel {
  id          String    @id @default(cuid())
  workspaceId String
  workspace   Workspace @relation(fields: [workspaceId], references: [id])

  name  String
  color String @default("#94a3b8")

  assignments TaskLabelAssignment[]

  @@index([workspaceId])
  @@map("task_labels")
}

model TaskLabelAssignment {
  id      String    @id @default(cuid())
  taskId  String
  task    Task      @relation(fields: [taskId], references: [id])
  labelId String
  label   TaskLabel @relation(fields: [labelId], references: [id])

  @@unique([taskId, labelId])
  @@map("task_label_assignments")
}

model Task {
  id          String    @id @default(cuid())
  workspaceId String
  workspace   Workspace @relation(fields: [workspaceId], references: [id])

  title       String
  description String?      @db.Text
  status      TaskStatus   @default(TODO)
  priority    TaskPriority @default(MEDIUM)

  projectId String?
  project   Project? @relation(fields: [projectId], references: [id])

  boardColumnId String?
  boardColumn   BoardColumn? @relation(fields: [boardColumnId], references: [id])

  sprintId String?
  sprint   Sprint?  @relation(fields: [sprintId], references: [id])

  assigneeId String?
  assignee   User?   @relation("TaskAssignee", fields: [assigneeId], references: [id])

  createdById String
  createdBy   User   @relation("TaskCreator", fields: [createdById], references: [id])

  dueDate     DateTime?
  startedAt   DateTime?
  completedAt DateTime?

  estimatedHours Decimal? @db.Decimal(6, 2)

  // Hierarchy
  parentTaskId String?
  parentTask   Task?   @relation("TaskSubtasks", fields: [parentTaskId], references: [id])
  subtasks     Task[]  @relation("TaskSubtasks")

  // Blocker
  isBlocked          Boolean     @default(false)
  blockerType        BlockerType?
  blockerDescription String?
  blockerTaskId      String?
  blockerResolvedAt  DateTime?

  // Recurring task link
  recurringTemplateId String?
  recurringTemplate   RecurringTaskTemplate? @relation(fields: [recurringTemplateId], references: [id])

  order Int @default(0)

  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  deletedAt DateTime?

  comments    TaskComment[]
  timeEntries TimeEntry[]
  watchers    TaskWatcher[]
  labels      TaskLabelAssignment[]

  @@index([workspaceId])
  @@index([workspaceId, status])
  @@index([workspaceId, assigneeId])
  @@index([projectId])
  @@index([projectId, status])
  @@index([sprintId])
  @@index([parentTaskId])
  @@index([workspaceId, dueDate])
  @@map("tasks")
}

model TaskComment {
  id     String @id @default(cuid())
  taskId String
  task   Task   @relation(fields: [taskId], references: [id])

  content String @db.Text

  authorId String
  author   User   @relation(fields: [authorId], references: [id])

  isEdited  Boolean   @default(false)
  editedAt  DateTime?
  isDeleted Boolean   @default(false)
  deletedAt DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  mentions TaskMention[]

  @@index([taskId])
  @@index([taskId, createdAt])
  @@map("task_comments")
}

model TaskMention {
  id        String      @id @default(cuid())
  commentId String
  comment   TaskComment @relation(fields: [commentId], references: [id])

  userId     String
  notified   Boolean   @default(false)
  notifiedAt DateTime?

  @@index([commentId])
  @@index([userId])
  @@map("task_mentions")
}

model TaskWatcher {
  id     String @id @default(cuid())
  taskId String
  task   Task   @relation(fields: [taskId], references: [id])
  userId String

  addedAt DateTime @default(now())

  @@unique([taskId, userId])
  @@index([taskId])
  @@index([userId])
  @@map("task_watchers")
}

model TimeEntry {
  id          String @id @default(cuid())
  workspaceId String

  taskId    String
  task      Task    @relation(fields: [taskId], references: [id])
  projectId String?
  project   Project? @relation(fields: [projectId], references: [id])
  userId    String
  user      User    @relation(fields: [userId], references: [id])

  date        DateTime        @db.Date
  hours       Decimal         @db.Decimal(5, 2)
  description String?

  status      TimeEntryStatus @default(DRAFT)
  isBillable  Boolean         @default(true)
  billableRate Decimal?       @db.Decimal(10, 2)

  invoiceLineItemId String?
  invoiceId         String?

  submittedAt  DateTime?
  approvedAt   DateTime?
  approvedById String?
  rejectedAt   DateTime?
  rejectedById String?
  rejectionReason String?

  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  deletedAt DateTime?

  @@index([workspaceId])
  @@index([taskId])
  @@index([projectId])
  @@index([userId])
  @@index([userId, date])
  @@index([projectId, status])
  @@index([invoiceId])
  @@map("time_entries")
}

model Sprint {
  id          String    @id @default(cuid())
  workspaceId String
  workspace   Workspace @relation(fields: [workspaceId], references: [id])

  projectId String
  project   Project @relation(fields: [projectId], references: [id])

  name   String
  goal   String?     @db.Text
  status SprintStatus @default(DRAFT)

  startDate   DateTime?
  endDate     DateTime?
  completedAt DateTime?

  plannedPoints   Int?
  completedPoints Int?
  carryOverCount  Int?

  createdById String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  tasks Task[]

  @@index([workspaceId])
  @@index([projectId])
  @@index([projectId, status])
  @@map("sprints")
}

model RecurringTaskTemplate {
  id          String    @id @default(cuid())
  workspaceId String
  workspace   Workspace @relation(fields: [workspaceId], references: [id])

  title          String
  description    String? @db.Text
  projectId      String?
  priority       TaskPriority @default(MEDIUM)
  estimatedHours Decimal?     @db.Decimal(6, 2)
  assigneeId     String?

  frequency      RecurringFrequency
  cronExpression String?
  status         RecurringTemplateStatus @default(ACTIVE)

  startDate       DateTime
  endDate         DateTime?
  maxOccurrences  Int?
  occurrenceCount Int       @default(0)
  lastGeneratedAt DateTime?
  nextGenerateAt  DateTime?

  createdById String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  tasks Task[]

  @@index([workspaceId])
  @@index([workspaceId, status])
  @@index([workspaceId, nextGenerateAt])
  @@map("recurring_task_templates")
}

// ============================================================
// HRMS — PEOPLE
// ============================================================

model Department {
  id          String    @id @default(cuid())
  workspaceId String
  workspace   Workspace @relation(fields: [workspaceId], references: [id])

  name        String
  description String?
  headId      String?

  parentDepartmentId String?
  parentDepartment   Department?  @relation("DeptHierarchy", fields: [parentDepartmentId], references: [id])
  childDepartments   Department[] @relation("DeptHierarchy")

  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  deletedAt DateTime?

  employees     Employee[]
  leavePolicies LeavePolicy[]

  @@index([workspaceId])
  @@index([workspaceId, parentDepartmentId])
  @@map("departments")
}

model Employee {
  id          String    @id @default(cuid())
  workspaceId String
  workspace   Workspace @relation(fields: [workspaceId], references: [id])

  userId String @unique
  user   User   @relation(fields: [userId], references: [id])

  employeeCode String?

  // Personal
  dateOfBirth DateTime? @db.Date
  gender      Gender?

  // Contact
  personalPhone            String?
  emergencyContactName     String?
  emergencyContactPhone    String?
  emergencyContactRelation String?

  // Address
  currentAddress   String?
  permanentAddress String?
  city             String?
  state            String?
  pincode          String?

  // Government IDs (encrypted at application layer)
  pan     String?
  aadhaar String?

  // Employment
  status         EmployeeStatus @default(ONBOARDING)
  employmentType EmploymentType @default(FULL_TIME)
  designation    String

  departmentId String?
  department   Department? @relation(fields: [departmentId], references: [id])

  reportingManagerId String?

  dateOfJoining    DateTime        @db.Date
  probationEndDate DateTime?       @db.Date
  probationStatus  ProbationStatus?

  // Exit fields
  exitType        EmployeeExitType?
  noticeStartDate DateTime?         @db.Date
  lastWorkingDay  DateTime?         @db.Date
  exitInterviewDone Boolean         @default(false)

  // Payroll / Banking (encrypted at application layer)
  currentSalaryStructureId String?
  bankAccountNumber         String?
  bankIfsc                  String?
  bankName                  String?
  pfAccountNumber           String?
  esiNumber                 String?

  createdById String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  shiftAssignments       ShiftAssignment[]
  attendanceRecords      AttendanceRecord[]
  clockEvents            ClockEvent[]
  regularisationRequests RegularisationRequest[]
  leaveBalances          LeaveBalance[]
  leaveApplications      LeaveApplication[]
  payrollLineItems       PayrollLineItem[]
  payslips               Payslip[]
  salaryAssignments      SalaryStructureAssignment[]
  performanceReviews     PerformanceReview[]         @relation("ReviewEmployee")
  conductedReviews       PerformanceReview[]         @relation("ReviewManager")
  onboardingChecklist    OnboardingChecklist?
  exitRecord             ExitRecord?
  profileChangeRequests  ProfileChangeRequest[]
  bonuses                Bonus[]

  @@index([workspaceId])
  @@index([workspaceId, status])
  @@index([workspaceId, departmentId])
  @@index([workspaceId, reportingManagerId])
  @@map("employees")
}

model Shift {
  id          String    @id @default(cuid())
  workspaceId String
  workspace   Workspace @relation(fields: [workspaceId], references: [id])

  name         String
  startTime    String
  endTime      String
  breakMinutes Int    @default(60)

  // Bitmask: Mon=1 Tue=2 Wed=4 Thu=8 Fri=16 Sat=32 Sun=64
  workingDaysMask Int @default(31)

  overtimeThresholdMinutes Int @default(540)

  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  deletedAt DateTime?

  assignments ShiftAssignment[]

  @@index([workspaceId])
  @@map("shifts")
}

model ShiftAssignment {
  id         String   @id @default(cuid())
  employeeId String
  employee   Employee @relation(fields: [employeeId], references: [id])
  shiftId    String
  shift      Shift    @relation(fields: [shiftId], references: [id])

  effectiveFrom DateTime  @db.Date
  effectiveTo   DateTime? @db.Date

  assignedById String
  assignedAt   DateTime @default(now())

  @@index([employeeId])
  @@index([employeeId, effectiveFrom])
  @@map("shift_assignments")
}

model Holiday {
  id          String    @id @default(cuid())
  workspaceId String
  workspace   Workspace @relation(fields: [workspaceId], references: [id])

  name  String
  date  DateTime    @db.Date
  type  HolidayType @default(NATIONAL)

  applicableToAll Boolean  @default(true)
  departmentIds   String[]

  createdById String
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  deletedAt   DateTime?

  @@index([workspaceId])
  @@index([workspaceId, date])
  @@map("holidays")
}

// ============================================================
// HRMS — ATTENDANCE
// ============================================================

model AttendanceRecord {
  id          String   @id @default(cuid())
  workspaceId String
  employeeId  String
  employee    Employee @relation(fields: [employeeId], references: [id])

  date   DateTime         @db.Date
  status AttendanceStatus @default(ABSENT)

  firstClockIn  DateTime?
  lastClockOut  DateTime?
  totalMinutes  Int?
  isLate        Boolean @default(false)
  isOvertime    Boolean @default(false)
  overtimeMinutes Int?

  leaveApplicationId String?
  holidayId          String?
  regularisationId   String?

  correctedByHrId String?
  correctedAt     DateTime?
  correctionReason String?
  originalStatus  AttendanceStatus?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([employeeId, date])
  @@index([workspaceId])
  @@index([employeeId])
  @@index([employeeId, date])
  @@index([workspaceId, date])
  @@index([workspaceId, status])
  @@map("attendance_records")
}

model ClockEvent {
  id         String         @id @default(cuid())
  employeeId String
  employee   Employee       @relation(fields: [employeeId], references: [id])

  type      ClockEventType
  timestamp DateTime
  source    ClockSource    @default(WEB)

  ipAddress String?
  location  String?

  createdAt DateTime @default(now())

  @@index([employeeId])
  @@index([employeeId, timestamp])
  @@map("clock_events")
}

model RegularisationRequest {
  id          String   @id @default(cuid())
  workspaceId String
  employeeId  String
  employee    Employee @relation(fields: [employeeId], references: [id])

  attendanceDate   DateTime         @db.Date
  requestedStatus  AttendanceStatus
  claimedClockIn   DateTime?
  claimedClockOut  DateTime?
  reason           String           @db.Text

  status RegularisationStatus @default(SUBMITTED)

  approvedByHrId  String?
  approvedAt      DateTime?
  rejectedByHrId  String?
  rejectedAt      DateTime?
  rejectionReason String?

  supportingDocumentId String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([workspaceId])
  @@index([employeeId])
  @@index([employeeId, status])
  @@map("regularisation_requests")
}

// ============================================================
// HRMS — LEAVE
// ============================================================

model LeaveType {
  id          String    @id @default(cuid())
  workspaceId String
  workspace   Workspace @relation(fields: [workspaceId], references: [id])

  name String
  code String

  annualEntitlement    Decimal            @default(0) @db.Decimal(5, 2)
  accrualType          String             @default("ANNUAL_UPFRONT")
  carryForwardLimit    Decimal?           @db.Decimal(5, 2)
  encashable           Boolean            @default(false)
  requiresDocument     Boolean            @default(false)
  minAdvanceNoticeDays Int                @default(0)
  maxConsecutiveDays   Int?
  approvalRoute        LeaveApprovalRoute @default(L1_ONLY)
  genderRestriction    String             @default("NONE")
  isActive             Boolean            @default(true)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  policyRules       LeavePolicyRule[]
  leaveApplications LeaveApplication[]
  leaveBalances     LeaveBalance[]

  @@unique([workspaceId, code])
  @@index([workspaceId])
  @@map("leave_types")
}

model LeavePolicy {
  id          String    @id @default(cuid())
  workspaceId String
  workspace   Workspace @relation(fields: [workspaceId], references: [id])

  name         String
  departmentId String?
  department   Department? @relation(fields: [departmentId], references: [id])

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  rules LeavePolicyRule[]

  @@index([workspaceId])
  @@index([workspaceId, departmentId])
  @@map("leave_policies")
}

model LeavePolicyRule {
  id          String      @id @default(cuid())
  policyId    String
  policy      LeavePolicy @relation(fields: [policyId], references: [id])
  leaveTypeId String
  leaveType   LeaveType   @relation(fields: [leaveTypeId], references: [id])

  overrideEntitlement Decimal? @db.Decimal(5, 2)

  @@unique([policyId, leaveTypeId])
  @@map("leave_policy_rules")
}

model LeaveBalance {
  id          String   @id @default(cuid())
  workspaceId String
  employeeId  String
  employee    Employee @relation(fields: [employeeId], references: [id])
  leaveTypeId String
  leaveType   LeaveType @relation(fields: [leaveTypeId], references: [id])

  year Int

  openingBalance Decimal @default(0) @db.Decimal(6, 2)
  allocated      Decimal @default(0) @db.Decimal(6, 2)
  carriedForward Decimal @default(0) @db.Decimal(6, 2)
  used           Decimal @default(0) @db.Decimal(6, 2)
  pending        Decimal @default(0) @db.Decimal(6, 2)
  lapsed         Decimal @default(0) @db.Decimal(6, 2)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([employeeId, leaveTypeId, year])
  @@index([employeeId])
  @@index([workspaceId])
  @@map("leave_balances")
}

model LeaveApplication {
  id          String   @id @default(cuid())
  workspaceId String
  employeeId  String
  employee    Employee @relation(fields: [employeeId], references: [id])

  leaveTypeId String
  leaveType   LeaveType @relation(fields: [leaveTypeId], references: [id])

  startDate DateTime @db.Date
  endDate   DateTime @db.Date
  totalDays Decimal  @db.Decimal(5, 2)

  reason String @db.Text
  status LeaveApplicationStatus @default(DRAFT)

  approvalRoute LeaveApprovalRoute

  l1ApproverId      String?
  l1ApprovedAt      DateTime?
  l1RejectedAt      DateTime?
  l1RejectionReason String?

  l2ApproverId      String?
  l2ApprovedAt      DateTime?
  l2RejectedAt      DateTime?
  l2RejectionReason String?

  approvalRequestId String?

  documentId String?

  submittedAt    DateTime?
  expiresAt      DateTime?
  withdrawnAt    DateTime?
  cancelledAt    DateTime?
  cancelledById  String?
  cancelledReason String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([workspaceId])
  @@index([employeeId])
  @@index([employeeId, status])
  @@index([workspaceId, startDate])
  @@index([workspaceId, status])
  @@map("leave_applications")
}

// ============================================================
// HRMS — PAYROLL
// ============================================================

model SalaryStructure {
  id          String    @id @default(cuid())
  workspaceId String
  workspace   Workspace @relation(fields: [workspaceId], references: [id])

  name        String
  description String?
  status      SalaryStructureStatus @default(DRAFT)

  createdById String
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  deletedAt   DateTime?

  components  SalaryComponent[]
  assignments SalaryStructureAssignment[]

  @@index([workspaceId])
  @@index([workspaceId, status])
  @@map("salary_structures")
}

model SalaryComponent {
  id                String          @id @default(cuid())
  salaryStructureId String
  salaryStructure   SalaryStructure @relation(fields: [salaryStructureId], references: [id])

  name            String
  type            SalaryComponentType
  isFixed         Boolean             @default(true)
  fixedAmount     Decimal?            @db.Decimal(12, 2)
  deductionBasis  DeductionBasis?
  percentageValue Decimal?            @db.Decimal(5, 2)
  isTaxable       Boolean             @default(true)
  isStatutory     Boolean             @default(false)
  order           Int                 @default(0)

  @@index([salaryStructureId])
  @@map("salary_components")
}

model SalaryStructureAssignment {
  id                String          @id @default(cuid())
  employeeId        String
  employee          Employee        @relation(fields: [employeeId], references: [id])
  salaryStructureId String
  salaryStructure   SalaryStructure @relation(fields: [salaryStructureId], references: [id])

  effectiveFrom DateTime  @db.Date
  effectiveTo   DateTime? @db.Date
  grossCtc      Decimal?  @db.Decimal(12, 2)

  assignedById String
  assignedAt   DateTime @default(now())
  reason       String?

  @@index([employeeId])
  @@index([employeeId, effectiveFrom])
  @@map("salary_structure_assignments")
}

model PayrollRun {
  id          String    @id @default(cuid())
  workspaceId String
  workspace   Workspace @relation(fields: [workspaceId], references: [id])

  month Int
  year  Int

  status PayrollRunStatus @default(DRAFT)

  totalGross      Decimal @default(0) @db.Decimal(15, 2)
  totalDeductions Decimal @default(0) @db.Decimal(15, 2)
  totalNet        Decimal @default(0) @db.Decimal(15, 2)
  employeeCount   Int     @default(0)

  initiatedById     String
  approvedByHrId    String?
  approvedAt        DateTime?
  disbursedAt       DateTime?
  disbursedById     String?

  isUnlocked        Boolean   @default(false)
  unlockReason      String?
  unlockedByAdminId String?
  unlockedAt        DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  lineItems PayrollLineItem[]
  payslips  Payslip[]
  bonuses   Bonus[]

  @@unique([workspaceId, month, year])
  @@index([workspaceId])
  @@index([workspaceId, status])
  @@map("payroll_runs")
}

model PayrollLineItem {
  id           String     @id @default(cuid())
  payrollRunId String
  payrollRun   PayrollRun @relation(fields: [payrollRunId], references: [id])
  employeeId   String
  employee     Employee   @relation(fields: [employeeId], references: [id])

  workingDaysInPeriod Int
  daysPresent         Int
  daysAbsent          Int
  daysOnLeave         Int
  daysOnHoliday       Int
  lopDays             Decimal @db.Decimal(5, 2)
  overtimeHours       Decimal @default(0) @db.Decimal(5, 2)

  grossSalary     Decimal @db.Decimal(12, 2)
  totalDeductions Decimal @db.Decimal(12, 2)
  netSalary       Decimal @db.Decimal(12, 2)

  earningsBreakdown   Json
  deductionsBreakdown Json

  isOverridden  Boolean @default(false)
  overrideNote  String?
  overrideById  String?

  isProRated      Boolean  @default(false)
  proRationFactor Decimal? @db.Decimal(6, 4)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([payrollRunId, employeeId])
  @@index([payrollRunId])
  @@index([employeeId])
  @@map("payroll_line_items")
}

model Payslip {
  id           String     @id @default(cuid())
  payrollRunId String
  payrollRun   PayrollRun @relation(fields: [payrollRunId], references: [id])
  employeeId   String
  employee     Employee   @relation(fields: [employeeId], references: [id])

  status PayslipStatus @default(PENDING)

  pdfUrl         String?
  pdfGeneratedAt DateTime?
  distributedAt  DateTime?
  firstDownloadAt DateTime?
  downloadCount  Int       @default(0)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([payrollRunId, employeeId])
  @@index([payrollRunId])
  @@index([employeeId])
  @@map("payslips")
}

model Bonus {
  id           String     @id @default(cuid())
  payrollRunId String
  payrollRun   PayrollRun @relation(fields: [payrollRunId], references: [id])
  employeeId   String
  employee     Employee   @relation(fields: [employeeId], references: [id])

  type      BonusType
  amount    Decimal   @db.Decimal(12, 2)
  isTaxable Boolean   @default(true)
  reason    String

  createdById String
  createdAt   DateTime @default(now())

  @@index([payrollRunId])
  @@index([employeeId])
  @@map("bonuses")
}

// ============================================================
// HRMS — LIFECYCLE
// ============================================================

model PerformanceReview {
  id          String @id @default(cuid())
  workspaceId String

  employeeId String
  employee   Employee @relation("ReviewEmployee", fields: [employeeId], references: [id])

  managerId String
  manager   Employee @relation("ReviewManager", fields: [managerId], references: [id])

  reviewPeriod String
  reviewType   PerformanceReviewType   @default(ANNUAL)
  status       PerformanceReviewStatus @default(DRAFT)

  selfRating        Int?
  selfComments      String?   @db.Text
  selfSubmittedAt   DateTime?

  managerRating      Int?
  managerComments    String?   @db.Text
  managerSubmittedAt DateTime?

  hrComments      String?   @db.Text
  hrSignedOffAt   DateTime?
  hrSignedOffById String?

  finalRating Int?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([workspaceId])
  @@index([employeeId])
  @@index([managerId])
  @@map("performance_reviews")
}

model OnboardingChecklist {
  id          String   @id @default(cuid())
  workspaceId String
  employeeId  String   @unique
  employee    Employee @relation(fields: [employeeId], references: [id])

  completedAt     DateTime?
  signedOffByHrId String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  items OnboardingChecklistItem[]

  @@map("onboarding_checklists")
}

model OnboardingChecklistItem {
  id          String              @id @default(cuid())
  checklistId String
  checklist   OnboardingChecklist @relation(fields: [checklistId], references: [id])

  title            String
  description      String?
  isMandatory      Boolean             @default(true)
  assignedToUserId String?
  status           OnboardingItemStatus @default(PENDING)

  completedAt   DateTime?
  completedById String?
  linkedTaskId  String?
  order         Int     @default(0)

  @@index([checklistId])
  @@map("onboarding_checklist_items")
}

model ExitRecord {
  id          String   @id @default(cuid())
  workspaceId String
  employeeId  String   @unique
  employee    Employee @relation(fields: [employeeId], references: [id])

  exitType EmployeeExitType

  resignationDate    DateTime? @db.Date
  noticeStartDate    DateTime? @db.Date
  noticePeriodDays   Int?
  lastWorkingDay     DateTime? @db.Date
  noticeShortfallDays Decimal? @db.Decimal(5, 2)

  ffsAmount      Decimal?  @db.Decimal(12, 2)
  ffsDisbursedAt DateTime?

  exitInterviewCompleted Boolean @default(false)
  exitInterviewNotes     String? @db.Text

  initiatedById String
  initiatedAt   DateTime @default(now())

  terminatedAt   DateTime?
  terminatedById String?

  updatedAt DateTime @updatedAt

  checklistItems ExitChecklistItem[]

  @@map("exit_records")
}

model ExitChecklistItem {
  id           String     @id @default(cuid())
  exitRecordId String
  exitRecord   ExitRecord @relation(fields: [exitRecordId], references: [id])

  title            String
  description      String?
  isMandatory      Boolean                 @default(true)
  assignedToUserId String?
  status           ExitChecklistItemStatus @default(PENDING)

  completedAt   DateTime?
  completedById String?
  order         Int     @default(0)

  @@index([exitRecordId])
  @@map("exit_checklist_items")
}

model ProfileChangeRequest {
  id          String   @id @default(cuid())
  workspaceId String
  employeeId  String
  employee    Employee @relation(fields: [employeeId], references: [id])

  fieldName String
  oldValue  String?
  newValue  String
  reason    String?

  status ProfileChangeStatus @default(SUBMITTED)

  approvedByHrId  String?
  approvedAt      DateTime?
  rejectedByHrId  String?
  rejectedAt      DateTime?
  rejectionReason String?

  supportingDocumentId String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([workspaceId])
  @@index([employeeId])
  @@index([employeeId, status])
  @@map("profile_change_requests")
}

// ============================================================
// INVOICE
// ============================================================

model Invoice {
  id          String    @id @default(cuid())
  workspaceId String
  workspace   Workspace @relation(fields: [workspaceId], references: [id])

  invoiceNumber String
  status        InvoiceStatus @default(DRAFT)

  contactId String?
  contact   Contact? @relation("InvoiceContact", fields: [contactId], references: [id])
  companyId String?
  company   Company? @relation("InvoiceCompany", fields: [companyId], references: [id])

  // Snapshot at issuance
  clientName    String
  clientEmail   String?
  clientAddress String?
  clientGstin   String?
  clientState   String?

  dealId    String?
  deal      Deal?    @relation(fields: [dealId], references: [id])
  projectId String?
  project   Project? @relation("InvoiceProject", fields: [projectId], references: [id])

  invoiceDate  DateTime @db.Date
  dueDate      DateTime @db.Date
  sentAt       DateTime?
  viewedAt     DateTime?
  paidAt       DateTime?

  paymentTerms String @default("NET_30")
  currency     String @default("INR")

  subtotal    Decimal @default(0) @db.Decimal(15, 2)
  totalCgst   Decimal @default(0) @db.Decimal(15, 2)
  totalSgst   Decimal @default(0) @db.Decimal(15, 2)
  totalIgst   Decimal @default(0) @db.Decimal(15, 2)
  totalTax    Decimal @default(0) @db.Decimal(15, 2)
  grandTotal  Decimal @default(0) @db.Decimal(15, 2)
  totalPaid   Decimal @default(0) @db.Decimal(15, 2)
  outstanding Decimal @default(0) @db.Decimal(15, 2)

  gstType GstType @default(CGST_SGST)

  isDisputed  Boolean @default(false)
  disputeNote String?

  notes            String? @db.Text
  paymentTermsText String? @db.Text

  pdfUrl         String?
  pdfGeneratedAt DateTime?

  voidedAt   DateTime?
  voidReason String?

  templateId   String?
  createdById  String
  approvedById String?
  approvedAt   DateTime?

  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  deletedAt DateTime?

  lineItems   InvoiceLineItem[]
  payments    Payment[]
  creditNotes CreditNote[]

  @@unique([workspaceId, invoiceNumber])
  @@index([workspaceId])
  @@index([workspaceId, status])
  @@index([workspaceId, contactId])
  @@index([workspaceId, companyId])
  @@index([workspaceId, dueDate])
  @@index([workspaceId, dealId])
  @@map("invoices")
}

model InvoiceLineItem {
  id        String  @id @default(cuid())
  invoiceId String
  invoice   Invoice @relation(fields: [invoiceId], references: [id])

  description String
  quantity    Decimal @default(1) @db.Decimal(10, 3)
  unitPrice   Decimal @db.Decimal(12, 2)

  gstRate     Decimal @default(18) @db.Decimal(5, 2)
  hsnSacCode  String?
  isTaxExempt Boolean @default(false)

  taxableAmount Decimal @db.Decimal(12, 2)
  cgstAmount    Decimal @default(0) @db.Decimal(12, 2)
  sgstAmount    Decimal @default(0) @db.Decimal(12, 2)
  igstAmount    Decimal @default(0) @db.Decimal(12, 2)
  lineTotal     Decimal @db.Decimal(12, 2)

  timeEntryId String?
  order       Int     @default(0)

  @@index([invoiceId])
  @@map("invoice_line_items")
}

model Payment {
  id        String  @id @default(cuid())
  invoiceId String
  invoice   Invoice @relation(fields: [invoiceId], references: [id])

  amount      Decimal       @db.Decimal(12, 2)
  paymentDate DateTime      @db.Date
  method      PaymentMethod @default(BANK_TRANSFER)
  reference   String?
  notes       String?

  recordedById String
  createdAt    DateTime @default(now())

  @@index([invoiceId])
  @@map("payments")
}

model CreditNote {
  id          String @id @default(cuid())
  workspaceId String

  creditNoteNumber  String
  originalInvoiceId String
  originalInvoice   Invoice @relation(fields: [originalInvoiceId], references: [id])

  amount Decimal @db.Decimal(12, 2)
  reason String

  status CreditNoteStatus @default(ISSUED)

  issuedAt           DateTime @default(now())
  appliedAt          DateTime?
  appliedToInvoiceId String?
  expiredAt          DateTime?

  createdById String
  createdAt   DateTime @default(now())

  @@index([workspaceId])
  @@index([originalInvoiceId])
  @@map("credit_notes")
}

model InvoiceTemplate {
  id          String    @id @default(cuid())
  workspaceId String
  workspace   Workspace @relation(fields: [workspaceId], references: [id])

  name         String
  description  String?
  paymentTerms String?
  notes        String?

  createdById String
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  deletedAt   DateTime?

  lineItems InvoiceTemplateLineItem[]

  @@index([workspaceId])
  @@map("invoice_templates")
}

model InvoiceTemplateLineItem {
  id         String          @id @default(cuid())
  templateId String
  template   InvoiceTemplate @relation(fields: [templateId], references: [id])

  description String
  quantity    Decimal @default(1) @db.Decimal(10, 3)
  unitPrice   Decimal @db.Decimal(12, 2)
  gstRate     Decimal @default(18) @db.Decimal(5, 2)
  hsnSacCode  String?
  order       Int     @default(0)

  @@index([templateId])
  @@map("invoice_template_line_items")
}

// ============================================================
// APPROVALS
// ============================================================

model ApprovalRequest {
  id          String    @id @default(cuid())
  workspaceId String
  workspace   Workspace @relation(fields: [workspaceId], references: [id])

  subjectType ApprovalSubjectType
  subjectId   String

  status       ApprovalRequestStatus @default(PENDING)
  currentLevel Int                   @default(1)
  totalLevels  Int                   @default(1)

  submittedById String
  submittedAt   DateTime @default(now())

  expiresAt  DateTime?
  expiredAt  DateTime?

  withdrawnById String?
  withdrawnAt   DateTime?

  finalOutcome   String?
  finalOutcomeAt DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  levels  ApprovalLevel[]
  actions ApprovalAction[]

  @@index([workspaceId])
  @@index([workspaceId, subjectType])
  @@index([workspaceId, status])
  @@index([subjectId])
  @@map("approval_requests")
}

model ApprovalLevel {
  id                String          @id @default(cuid())
  approvalRequestId String
  approvalRequest   ApprovalRequest @relation(fields: [approvalRequestId], references: [id])

  level         Int
  approverRole  Role
  approverUserId String?

  status String @default("PENDING")

  escalationWindowHours Int       @default(48)
  escalatedAt           DateTime?
  delegatedToUserId     String?
  activatedAt           DateTime?
  actionedAt            DateTime?

  @@index([approvalRequestId])
  @@map("approval_levels")
}

model ApprovalAction {
  id                String          @id @default(cuid())
  approvalRequestId String
  approvalRequest   ApprovalRequest @relation(fields: [approvalRequestId], references: [id])

  level  Int
  action ApprovalActionType

  actorId             String
  actor               User   @relation(fields: [actorId], references: [id])
  delegatedForUserId  String?

  reason String?

  createdAt DateTime @default(now())

  @@index([approvalRequestId])
  @@index([actorId])
  @@map("approval_actions")
}

model ApprovalDelegation {
  id          String    @id @default(cuid())
  workspaceId String
  workspace   Workspace @relation(fields: [workspaceId], references: [id])

  delegatorId String
  delegator   User   @relation("DelegationGiver", fields: [delegatorId], references: [id])
  delegateId  String
  delegate    User   @relation("DelegationReceiver", fields: [delegateId], references: [id])

  subjectTypes ApprovalSubjectType[]

  startDate DateTime @db.Date
  endDate   DateTime @db.Date
  isActive  Boolean  @default(true)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([workspaceId])
  @@index([delegatorId])
  @@index([delegateId])
  @@map("approval_delegations")
}

// ============================================================
// DOCUMENTS
// ============================================================

model Document {
  id          String    @id @default(cuid())
  workspaceId String
  workspace   Workspace @relation(fields: [workspaceId], references: [id])

  name        String
  description String?

  category DocumentCategory @default(GENERAL)
  status   DocumentStatus   @default(ACTIVE)

  fileUrl       String
  fileKey       String
  fileMimeType  String
  fileSizeBytes Int
  fileHash      String?

  isPublicWithinWorkspace Boolean @default(false)

  version           Int     @default(1)
  previousVersionId String?

  requiresAcknowledgement Boolean @default(false)

  uploadedById String
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  deletedAt    DateTime?

  attachments DocumentAttachment[]
  shares      DocumentShare[]

  @@index([workspaceId])
  @@index([workspaceId, category])
  @@index([workspaceId, status])
  @@map("documents")
}

model DocumentAttachment {
  id         String   @id @default(cuid())
  documentId String
  document   Document @relation(fields: [documentId], references: [id])

  leadId    String?
  lead      Lead?    @relation(fields: [leadId], references: [id])
  dealId    String?
  deal      Deal?    @relation(fields: [dealId], references: [id])
  contactId String?
  contact   Contact? @relation(fields: [contactId], references: [id])
  companyId String?
  company   Company? @relation(fields: [companyId], references: [id])
  projectId String?
  project   Project? @relation(fields: [projectId], references: [id])

  attachedById String
  attachedAt   DateTime @default(now())

  @@index([documentId])
  @@index([leadId])
  @@index([dealId])
  @@index([projectId])
  @@map("document_attachments")
}

model DocumentShare {
  id         String   @id @default(cuid())
  documentId String
  document   Document @relation(fields: [documentId], references: [id])
  userId     String

  canEdit  Boolean @default(false)
  sharedById String
  sharedAt  DateTime @default(now())

  @@unique([documentId, userId])
  @@index([documentId])
  @@index([userId])
  @@map("document_shares")
}

// ============================================================
// NOTIFICATIONS
// ============================================================

model Notification {
  id          String    @id @default(cuid())
  workspaceId String
  workspace   Workspace @relation(fields: [workspaceId], references: [id])

  recipientId String
  recipient   User   @relation("NotificationRecipient", fields: [recipientId], references: [id])

  type  String
  title String
  body  String

  module       String?
  resourceType String?
  resourceId   String?

  channel NotificationChannel @default(BOTH)

  isRead  Boolean   @default(false)
  readAt  DateTime?

  emailSentAt   DateTime?
  emailDelivered Boolean   @default(false)

  createdAt DateTime @default(now())

  @@index([workspaceId])
  @@index([recipientId])
  @@index([recipientId, isRead])
  @@index([recipientId, createdAt])
  @@map("notifications")
}

model NotificationPreference {
  id     String @id @default(cuid())
  userId String @unique
  user   User   @relation(fields: [userId], references: [id])

  preferences Json @default("{}")

  updatedAt DateTime @updatedAt

  @@map("notification_preferences")
}

// ============================================================
// AUDIT LOG
// ============================================================

model AuditLog {
  id          String    @id @default(cuid())
  workspaceId String
  workspace   Workspace @relation(fields: [workspaceId], references: [id])

  action AuditAction

  actorId    String?
  actor      User?   @relation("AuditActor", fields: [actorId], references: [id])
  actorRole  Role?
  actorEmail String

  module     String
  entityType String
  entityId   String

  before Json?
  after  Json?

  reason      String?
  isSensitive Boolean @default(false)

  ipAddress String?
  userAgent String?
  sessionId String?

  createdAt DateTime @default(now())

  @@index([workspaceId])
  @@index([workspaceId, entityType, entityId])
  @@index([workspaceId, actorId])
  @@index([workspaceId, action])
  @@index([workspaceId, createdAt])
  @@index([workspaceId, isSensitive])
  @@map("audit_logs")
}
```

// ─────────────────────────────────────────────────────────────────────────────
// Application-wide constants
// ─────────────────────────────────────────────────────────────────────────────

// ── Injection Tokens ─────────────────────────────────────────────────────────
export const REDIS_CLIENT = 'REDIS_CLIENT';
export const WINSTON_LOGGER = 'WINSTON_LOGGER';

// ── Metadata Keys ────────────────────────────────────────────────────────────
export const IS_PUBLIC_KEY = 'isPublic';
export const ROLES_KEY = 'roles';
export const AUDIT_KEY = 'audit';
export const SKIP_TRANSFORM_KEY = 'skipTransform';

// ── Workspace ────────────────────────────────────────────────────────────────
export const WORKSPACE_CONTEXT_KEY = 'workspaceId';

// ── Pagination ───────────────────────────────────────────────────────────────
export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 25;
export const MAX_LIMIT = 100;

// ── Auth ─────────────────────────────────────────────────────────────────────
export const BCRYPT_ROUNDS = 12;
export const MAX_LOGIN_ATTEMPTS = 10;
export const LOGIN_LOCKOUT_SECONDS = 900; // 15 minutes

// ── Audit ────────────────────────────────────────────────────────────────────
export const AUDIT_QUEUE = 'audit-log';
export const SENSITIVE_EXPORT_RATE_LIMIT = 5; // per hour

// ── BullMQ Queue Names ───────────────────────────────────────────────────────
export const QUEUES = {
  EMAIL_NOTIFICATIONS: 'email-notifications',
  AUDIT_LOG: 'audit-log',
  PDF_GENERATION: 'pdf-generation',
  ATTENDANCE_COMPUTE: 'attendance-compute',
  PAYROLL_COMPUTE: 'payroll-compute',
  RECURRING_TASKS: 'recurring-tasks',
  CAMPAIGN_SEND: 'campaign-send',
  REPORT_GENERATE: 'report-generate',
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

// ── File Storage ─────────────────────────────────────────────────────────────
export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'text/plain',
] as const;

export const STORAGE_CATEGORIES = {
  AVATARS: 'avatars',
  DOCUMENTS: 'documents',
  INVOICES: 'invoices',
  PAYSLIPS: 'payslips',
  HRMS: 'hrms',
} as const;

// ── Cron Schedules ───────────────────────────────────────────────────────────
export const CRON = {
  ATTENDANCE_COMPUTE: '30 23 * * *',    // 11:30 PM daily
  INVOICE_OVERDUE: '0 9 * * *',         // 9:00 AM daily
  LEAVE_EXPIRY: '0 * * * *',            // Every hour
  RECURRING_TASKS: '* * * * *',         // Every minute
  NOTIFICATION_CLEANUP: '0 2 * * *',   // 2:00 AM daily
  PROBATION_ALERT: '0 9 * * *',         // 9:00 AM daily
} as const;

// ── HTTP ─────────────────────────────────────────────────────────────────────
export const REQUEST_ID_HEADER = 'X-Request-ID';
export const VERSION_HEADER = 'X-API-Version';

// ── Socket.IO ────────────────────────────────────────────────────────────────
export const WS_MAX_CONNECTIONS_PER_USER = 5;
export const WS_CLOSE_CODES = {
  UNAUTHORIZED: 4001,
  WORKSPACE_MISMATCH: 4002,
  ACCOUNT_DEACTIVATED: 4003,
  TOO_MANY_CONNECTIONS: 4004,
} as const;

export const WS_EVENTS = {
  // Task events
  TASK_STATUS_CHANGED: 'task.status_changed',
  TASK_ASSIGNED: 'task.assigned',
  TASK_COMMENTED: 'task.comment_added',
  TASK_MENTIONED: 'task.mentioned',
  BOARD_TASK_MOVED: 'board.task_moved',
  SPRINT_ACTIVATED: 'sprint.activated',

  // HRMS events
  LEAVE_STATUS_CHANGED: 'leave.status_changed',
  PAYSLIP_READY: 'payslip.ready',
  ATTENDANCE_CLOCKED: 'attendance.clocked',

  // Invoice events
  INVOICE_PAYMENT_RECEIVED: 'invoice.payment_received',

  // Notification events
  NOTIFICATION_NEW: 'notification.new',
  NOTIFICATION_READ: 'notification.read',
  NOTIFICATION_READ_ALL: 'notification.read_all',
  NOTIFICATION_DELETED: 'notification.deleted',

  // Approval events
  APPROVAL_REQUIRED: 'approval.required',
  APPROVAL_ACTION_TAKEN: 'approval.action_taken',

  // Presence
  PRESENCE_CHANGED: 'presence.changed',
} as const;

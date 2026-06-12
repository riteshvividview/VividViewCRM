# HRMS API — VividCRM

## Scope Rules

- `SUPER_ADMIN` — full access to all HRMS data
- `HR` — full HRMS access; cannot modify own salary record
- `TEAM_LEAD` — read team members' basic profiles, attendance summary, leave applications; approve L1 leaves and time entries
- `EMPLOYEE` — read own profile, own attendance, own leaves, own payslips; submit self-service updates

---

## Employees

---

### POST `/api/v1/employees`

Create a new employee record and linked user account.

**Permission:** `SUPER_ADMIN`, `HR`

**Request Body:**
```ts
class CreateEmployeeDto {
  // User account fields
  @IsEmail()
  workEmail: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  firstName: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  lastName: string

  // Employment
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  designation: string

  @IsEnum(EmploymentType)
  employmentType: EmploymentType

  @IsISO8601()
  dateOfJoining: string

  @IsOptional()
  @IsUUID()
  departmentId?: string

  @IsOptional()
  @IsString()
  reportingManagerId?: string  // another employee's id

  @IsOptional()
  @IsISO8601()
  probationEndDate?: string

  // Personal (optional at creation)
  @IsOptional()
  @IsISO8601()
  dateOfBirth?: string

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender

  @IsOptional()
  @IsPhoneNumber()
  personalPhone?: string

  @IsOptional()
  @IsString()
  employeeCode?: string  // auto-generated if omitted

  @IsOptional()
  @IsUUID()
  salaryStructureId?: string  // assign at creation or defer
}
```

**Response `201`:**
```json
{
  "employee": {
    "id": "emp_abc",
    "employeeCode": "E042",
    "userId": "user_xyz",
    "designation": "Frontend Developer",
    "employmentType": "FULL_TIME",
    "status": "ONBOARDING",
    "dateOfJoining": "2025-07-01",
    "department": { "id": "dept_eng", "name": "Engineering" },
    "probationEndDate": "2025-10-01"
  },
  "user": {
    "id": "user_xyz",
    "email": "arjun@agency.com",
    "role": "EMPLOYEE",
    "isActive": true
  },
  "onboardingChecklist": {
    "id": "checklist_1",
    "itemCount": 7,
    "mandatoryCount": 5
  }
}
```

**Side Effects:**
- User account created with role `EMPLOYEE` and temporary password
- Welcome email dispatched via BullMQ
- Onboarding checklist generated from workspace template
- Onboarding tasks created in Task Management module
- `AuditLog` entry: action=`CREATE`

---

### GET `/api/v1/employees`

**Permission:** `SUPER_ADMIN`, `HR` → all fields; `ADMIN` → basic fields only; `TEAM_LEAD` → own team members, basic fields

**Query Parameters:**
| Param | Type | Description |
|---|---|---|
| `status` | `EmployeeStatus` | ONBOARDING / ACTIVE / SUSPENDED / EXITING / TERMINATED |
| `departmentId` | string | Filter by department |
| `employmentType` | `EmploymentType` | FULL_TIME / CONTRACT / etc. |
| `reportingManagerId` | string | Direct reports of a manager |
| `search` | string | Name / email / employee code |

**Response `200`:** Paginated. Salary fields excluded from ADMIN and TEAM_LEAD responses.

---

### GET `/api/v1/employees/:id`

**Permission:** `SUPER_ADMIN`, `HR` → full profile; `ADMIN` → basic fields; `TEAM_LEAD` → own team, basic; `EMPLOYEE` → own profile only

**Response `200` (full, HR/SUPER_ADMIN):**
```json
{
  "id": "emp_abc",
  "employeeCode": "E042",
  "userId": "user_xyz",
  "user": { "email": "arjun@agency.com", "role": "EMPLOYEE" },
  "firstName": "Arjun",
  "lastName": "Nair",
  "designation": "Frontend Developer",
  "employmentType": "FULL_TIME",
  "status": "ACTIVE",
  "dateOfJoining": "2025-07-01",
  "probationEndDate": "2025-10-01",
  "probationStatus": "UNDER_PROBATION",
  "department": { "id": "dept_eng", "name": "Engineering" },
  "reportingManager": { "id": "emp_lead", "firstName": "Priya", "lastName": "K" },
  "dateOfBirth": "1998-04-15",
  "gender": "MALE",
  "personalPhone": "+919876543210",
  "currentAddress": "123 MG Road, Bengaluru",
  "pan": "ABCDE1234F",
  "bankName": "HDFC Bank",
  "bankIfsc": "HDFC0001234",
  "currentSalaryStructureId": "struct_1",
  "emergencyContactName": "Suresh Nair",
  "emergencyContactPhone": "+919876543211"
}
```

**Response `200` (basic, ADMIN/TEAM_LEAD):** Excludes `pan`, `aadhaar`, `bankAccountNumber`, `bankIfsc`, `salaryStructure`, `dateOfBirth`, `personalPhone`.

---

### PATCH `/api/v1/employees/:id`

**Permission:** `SUPER_ADMIN`, `HR` → most fields; `EMPLOYEE` → self-service fields only (see profile-changes flow for sensitive fields)

**Request Body (HR):**
```ts
class UpdateEmployeeDto {
  @IsOptional() @IsString() @MaxLength(100) designation?: string
  @IsOptional() @IsEnum(EmploymentType) employmentType?: EmploymentType
  @IsOptional() @IsUUID() departmentId?: string
  @IsOptional() @IsString() reportingManagerId?: string
  @IsOptional() @IsISO8601() probationEndDate?: string
  @IsOptional() @IsEnum(ProbationStatus) probationStatus?: ProbationStatus
  @IsOptional() @IsEnum(EmployeeStatus) status?: EmployeeStatus
}
```

**Request Body (EMPLOYEE — self-service):**
```ts
class UpdateOwnProfileDto {
  @IsOptional() @IsPhoneNumber() personalPhone?: string
  @IsOptional() @IsString() currentAddress?: string
  @IsOptional() @IsString() emergencyContactName?: string
  @IsOptional() @IsPhoneNumber() emergencyContactPhone?: string
  @IsOptional() @IsString() emergencyContactRelation?: string
}
```

**Validation:**
- HR cannot change `designation` or `salaryStructure` for their own record (conflict of interest)
- Status transitions must follow the employee lifecycle state machine

**Side Effects:** `AuditLog` entry: action=`UPDATE`, includes before/after snapshot for sensitive fields.

---

### POST `/api/v1/employees/:id/suspend`

**Permission:** `SUPER_ADMIN`, `HR`

**Request Body:**
```ts
class SuspendEmployeeDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(20)
  reason: string
}
```

**Side Effects:** User account deactivated; all active JWT sessions invalidated (`tokenVersion` incremented); team notified.

---

### POST `/api/v1/employees/:id/reinstate`

**Permission:** `SUPER_ADMIN`, `HR`

Lifts suspension. Reactivates user account.

**Request Body:**
```ts
class ReinstateEmployeeDto {
  @IsOptional()
  @IsString()
  note?: string
}
```

---

## Profile Change Requests

---

### GET `/api/v1/employees/:id/profile-changes`

**Permission:** `SUPER_ADMIN`, `HR` → all; `EMPLOYEE` → own requests only

**Query Parameters:** `status`, `fieldName`, standard pagination.

---

### POST `/api/v1/employees/:id/profile-changes`

Submit a request to change a sensitive field (requires HR approval).

**Permission:** `EMPLOYEE` (own record), `HR` (any employee)

**Request Body:**
```ts
class CreateProfileChangeRequestDto {
  @IsString()
  @IsNotEmpty()
  fieldName: string  // bankAccountNumber | pan | aadhaar | address

  @IsString()
  @IsNotEmpty()
  newValue: string

  @IsOptional()
  @IsString()
  reason?: string

  @IsOptional()
  @IsUUID()
  supportingDocumentId?: string
}
```

---

### POST `/api/v1/profile-changes/:changeId/approve`

**Permission:** `SUPER_ADMIN`, `HR`

**Validation:** HR cannot approve their own change request.

**Side Effects:** Field value updated on employee record; `AuditLog` entry: action=`APPROVE`, isSensitive=`true`.

---

### POST `/api/v1/profile-changes/:changeId/reject`

**Permission:** `SUPER_ADMIN`, `HR`

**Request Body:**
```ts
class RejectProfileChangeDto {
  @IsString()
  @IsNotEmpty()
  reason: string
}
```

---

## Departments

---

### POST `/api/v1/departments`

**Permission:** `SUPER_ADMIN`, `HR`

**Request Body:**
```ts
class CreateDepartmentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsUUID()
  parentDepartmentId?: string

  @IsOptional()
  @IsUUID()
  headId?: string  // employee ID
}
```

---

### GET `/api/v1/departments`

**Permission:** `SUPER_ADMIN`, `ADMIN`, `HR` → all; `TEAM_LEAD`, `EMPLOYEE` → own department only

**Response `200`:** Tree-structured departments with `children[]` and `_count.employees`.

---

### GET `/api/v1/departments/:id`

Includes `employees[]` summary, `leavePolicy`.

---

### PATCH `/api/v1/departments/:id`

**Permission:** `SUPER_ADMIN`, `HR`

---

### DELETE `/api/v1/departments/:id`

**Permission:** `SUPER_ADMIN`

**Validation:** Department must have zero active employees.

---

## Shifts

---

### POST `/api/v1/shifts`

**Permission:** `SUPER_ADMIN`, `HR`

**Request Body:**
```ts
class CreateShiftDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string

  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  startTime: string  // HH:MM

  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  endTime: string  // HH:MM

  @IsInt()
  @Min(0)
  @Max(120)
  breakMinutes: number

  @IsInt()
  @Min(0)
  @Max(127)
  workingDaysMask: number  // bitmask: Mon=1 Tue=2 Wed=4 Thu=8 Fri=16 Sat=32 Sun=64

  @IsOptional()
  @IsInt()
  @Min(0)
  overtimeThresholdMinutes?: number  // default 540
}
```

---

### GET `/api/v1/shifts`
### GET `/api/v1/shifts/:id`
### PATCH `/api/v1/shifts/:id`
### DELETE `/api/v1/shifts/:id`

---

### POST `/api/v1/employees/:id/shift-assignments`

Assign a shift to an employee.

**Permission:** `SUPER_ADMIN`, `HR`

**Request Body:**
```ts
class AssignShiftDto {
  @IsUUID()
  shiftId: string

  @IsISO8601()
  effectiveFrom: string  // date only

  @IsOptional()
  @IsISO8601()
  effectiveTo?: string
}
```

**Side Effects:** Employee notified. If `effectiveFrom` is in past, attendance records are flagged for recomputation.

---

### GET `/api/v1/employees/:id/shift-assignments`

Assignment history with effective dates.

---

## Attendance

---

### GET `/api/v1/attendance`

**Permission:** `SUPER_ADMIN`, `HR` → all; `TEAM_LEAD` → own team; `EMPLOYEE` → own only (use `/attendance/my`)

**Query Parameters:**
| Param | Type | Description |
|---|---|---|
| `employeeId` | string | Filter by employee |
| `departmentId` | string | Filter by department |
| `dateFrom` | date | Date range start |
| `dateTo` | date | Date range end |
| `status` | `AttendanceStatus` | ABSENT / PRESENT / HALF_DAY / LEAVE / etc. |

**Response `200`:**
```json
{
  "data": [
    {
      "id": "att_1",
      "employeeId": "emp_abc",
      "employee": { "firstName": "Arjun", "lastName": "Nair", "employeeCode": "E042" },
      "date": "2025-06-16",
      "status": "PRESENT",
      "firstClockIn": "2025-06-16T09:02:00.000Z",
      "lastClockOut": "2025-06-16T18:15:00.000Z",
      "totalMinutes": 553,
      "isLate": false,
      "isOvertime": false
    }
  ],
  "meta": { "total": 22, "page": 1, "limit": 25, "totalPages": 1 }
}
```

---

### GET `/api/v1/attendance/my`

**Permission:** Any authenticated employee.

**Query Parameters:** `dateFrom`, `dateTo`, `status`, standard pagination.

Returns own attendance records only.

---

### POST `/api/v1/attendance/clock-in`

**Permission:** `EMPLOYEE`, `TEAM_LEAD`, `HR`

**Request Body:** None (employee derived from JWT).

**Response `201`:**
```json
{
  "clockEvent": {
    "id": "clock_1",
    "type": "CLOCK_IN",
    "timestamp": "2025-06-16T09:02:00.000Z",
    "source": "WEB"
  },
  "attendance": {
    "date": "2025-06-16",
    "status": "PRESENT",
    "isLate": false
  }
}
```

**Validation:**
- No existing open clock-in (already clocked in today)
- Date must be today (workspace timezone)
- Not a HOLIDAY or WEEKEND (allowed with a warning flag in response)

---

### POST `/api/v1/attendance/clock-out`

**Permission:** `EMPLOYEE`, `TEAM_LEAD`, `HR`

**Request Body:** None.

**Response `200`:**
```json
{
  "clockEvent": { "id": "clock_2", "type": "CLOCK_OUT", "timestamp": "2025-06-16T18:15:00.000Z" },
  "attendance": {
    "date": "2025-06-16",
    "totalMinutes": 553,
    "isOvertime": false
  }
}
```

**Validation:** Must have an open clock-in for today.

---

## Regularisation Requests

---

### POST `/api/v1/regularisations`

**Permission:** `EMPLOYEE`, `TEAM_LEAD`, `HR`

**Request Body:**
```ts
class CreateRegularisationDto {
  @IsISO8601()
  attendanceDate: string  // date to correct (YYYY-MM-DD)

  @IsEnum(AttendanceStatus)
  requestedStatus: AttendanceStatus

  @IsOptional()
  @IsISO8601()
  claimedClockIn?: string

  @IsOptional()
  @IsISO8601()
  claimedClockOut?: string

  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  reason: string

  @IsOptional()
  @IsUUID()
  supportingDocumentId?: string
}
```

**Validation:**
- `attendanceDate` must be within 30 days for EMPLOYEE; any date in current payroll period for HR
- Cannot regularise a date in a FINALISED payroll period (without SUPER_ADMIN override)

---

### GET `/api/v1/regularisations`

**Permission:** `SUPER_ADMIN`, `HR` → all; `EMPLOYEE` → own only

**Query Parameters:** `status`, `employeeId`, `dateFrom`, `dateTo`, standard pagination.

---

### GET `/api/v1/regularisations/:id`

---

### POST `/api/v1/regularisations/:id/approve`

**Permission:** `SUPER_ADMIN`, `HR`

**Side Effects:** Attendance record corrected; status recomputed; employee notified.

---

### POST `/api/v1/regularisations/:id/reject`

**Permission:** `SUPER_ADMIN`, `HR`

**Request Body:**
```ts
class RejectRegularisationDto {
  @IsString()
  @IsNotEmpty()
  reason: string
}
```

---

## Holidays

---

### POST `/api/v1/holidays`

**Permission:** `SUPER_ADMIN`, `HR`

**Request Body:**
```ts
class CreateHolidayDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string

  @IsISO8601()
  date: string  // YYYY-MM-DD

  @IsEnum(HolidayType)
  type: HolidayType  // NATIONAL | REGIONAL | COMPANY

  @IsOptional()
  @IsBoolean()
  applicableToAll?: boolean  // default true

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  departmentIds?: string[]  // if not applicable to all
}
```

**Side Effects:** BullMQ job queued to update all affected attendance records for that date.

---

### GET `/api/v1/holidays`

**Permission:** All authenticated users

**Query Parameters:** `year`, `type`, `month`

---

### DELETE `/api/v1/holidays/:id`

**Permission:** `SUPER_ADMIN`, `HR`

Triggers BullMQ job to recompute affected attendance records.

---

## Leave Types

---

### POST `/api/v1/leave-types`

**Permission:** `SUPER_ADMIN`, `HR`

**Request Body:**
```ts
class CreateLeaveTypeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  @Matches(/^[A-Z_]+$/)
  code: string  // EL | SL | CL | ML | PL | CO | UPL

  @IsNumber()
  @Min(0)
  @Max(365)
  annualEntitlement: number

  @IsEnum(['ANNUAL_UPFRONT', 'MONTHLY_ACCRUAL'])
  accrualType: string

  @IsOptional()
  @IsNumber()
  @Min(0)
  carryForwardLimit?: number  // null = unlimited

  @IsBoolean()
  encashable: boolean

  @IsBoolean()
  requiresDocument: boolean

  @IsInt()
  @Min(0)
  minAdvanceNoticeDays: number

  @IsOptional()
  @IsInt()
  @Min(1)
  maxConsecutiveDays?: number

  @IsEnum(LeaveApprovalRoute)
  approvalRoute: LeaveApprovalRoute

  @IsEnum(['NONE', 'FEMALE_ONLY', 'MALE_ONLY'])
  genderRestriction: string
}
```

**Validation:** `code` must be unique per workspace.

---

### GET `/api/v1/leave-types`

**Permission:** All authenticated users (read-only for EMPLOYEE)

---

### PATCH `/api/v1/leave-types/:id`

**Permission:** `SUPER_ADMIN`, `HR`

---

## Leave Applications

---

### POST `/api/v1/leaves`

**Permission:** All authenticated users (apply for own leave)

**Request Body:**
```ts
class CreateLeaveApplicationDto {
  @IsUUID()
  leaveTypeId: string

  @IsISO8601()
  startDate: string  // YYYY-MM-DD

  @IsISO8601()
  endDate: string  // YYYY-MM-DD

  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(2000)
  reason: string

  @IsOptional()
  @IsUUID()
  documentId?: string  // for leave types requiring document
}
```

**Response `201`:**
```json
{
  "id": "leave_1",
  "leaveType": { "id": "lt_1", "name": "Earned Leave", "code": "EL" },
  "startDate": "2025-07-10",
  "endDate": "2025-07-14",
  "totalDays": 5,
  "status": "SUBMITTED",
  "approvalRoute": "L1_AND_L2",
  "remainingBalance": 10
}
```

**Validation:**
- `startDate` must not be in the past (except HR submitting for another employee)
- `endDate` >= `startDate`
- Sufficient leave balance (checks `LeaveBalance.allocated - used - pending`)
- No overlap with existing APPROVED or PENDING leave
- `minAdvanceNoticeDays` satisfied
- `requiresDocument` = true → `documentId` required
- EMPLOYEE cannot apply on behalf of others

**Side Effects:**
- Leave balance `pending` field incremented
- ApprovalRequest created, L1 approver (TEAM_LEAD) notified

---

### GET `/api/v1/leaves`

**Permission:** `SUPER_ADMIN`, `HR` → all; `TEAM_LEAD` → own team; `EMPLOYEE` → own only

**Query Parameters:**
| Param | Type | Description |
|---|---|---|
| `employeeId` | string | Filter by employee |
| `leaveTypeId` | string | Filter by type |
| `status` | `LeaveApplicationStatus` | Filter by status |
| `dateFrom` | date | Leave start date range |
| `dateTo` | date | Leave end date range |
| `approvalRoute` | string | L1_ONLY / L1_AND_L2 |

---

### GET `/api/v1/leaves/:id`

---

### PATCH `/api/v1/leaves/:id`

**Permission:** `EMPLOYEE` (own, DRAFT or SUBMITTED only); `HR` (any)

**Request Body:** `startDate`, `endDate`, `reason`, `documentId` (all optional). Same validation as create.

---

### POST `/api/v1/leaves/:id/withdraw`

**Permission:** `EMPLOYEE` (own, when DRAFT / SUBMITTED / PENDING_L1 only)

**Response `200`:** Updated leave with `status: "WITHDRAWN"`.

**Side Effects:** Leave balance `pending` decremented; L1 approver notified.

---

### POST `/api/v1/leaves/:id/approve-l1`

**Permission:** `TEAM_LEAD` (own team members), `HR`, `SUPER_ADMIN`

**Validation:** Cannot approve own leave application. Leave must be in `PENDING_L1` status.

**Response `200`:**
```json
{
  "leave": { "id": "leave_1", "status": "PENDING_L2" },
  "nextApprover": "HR"
}
```

**Side Effects:** If `approvalRoute = L1_ONLY` → `status: APPROVED`; calendar and attendance updated; balance deducted.

---

### POST `/api/v1/leaves/:id/reject-l1`

**Permission:** `TEAM_LEAD` (own team), `HR`, `SUPER_ADMIN`

**Request Body:**
```ts
class RejectLeaveDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string
}
```

**Side Effects:** Balance `pending` released; employee notified.

---

### POST `/api/v1/leaves/:id/approve-l2`

**Permission:** `HR`, `SUPER_ADMIN`

Leave must be in `PENDING_L2`. Cannot approve own leave.

**Side Effects:** `status: APPROVED`; calendar entries created; attendance records pre-set to LEAVE; balance `used` incremented, `pending` decremented; employee and TEAM_LEAD notified.

---

### POST `/api/v1/leaves/:id/reject-l2`

**Permission:** `HR`, `SUPER_ADMIN`

---

### POST `/api/v1/leaves/:id/cancel`

Cancel an already-approved leave (before the leave date).

**Permission:** `HR`, `SUPER_ADMIN`

**Request Body:**
```ts
class CancelLeaveDto {
  @IsString()
  @IsNotEmpty()
  reason: string
}
```

**Side Effects:** Balance restored; calendar entries removed; attendance records reverted.

---

### GET `/api/v1/employees/:id/leave-balances`

**Permission:** `SUPER_ADMIN`, `HR` → any employee; `EMPLOYEE` → own only

**Query Parameters:** `year`

**Response `200`:**
```json
{
  "year": 2025,
  "balances": [
    {
      "leaveType": { "id": "lt_1", "name": "Earned Leave", "code": "EL" },
      "allocated": 15,
      "carriedForward": 3,
      "used": 5,
      "pending": 2,
      "lapsed": 0,
      "available": 11
    }
  ]
}
```

---

## Salary Structures

---

### POST `/api/v1/salary-structures`

**Permission:** `SUPER_ADMIN`, `HR`

**Request Body:**
```ts
class CreateSalaryStructureDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string

  @IsOptional()
  @IsString()
  description?: string

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SalaryComponentDto)
  components: SalaryComponentDto[]
}

class SalaryComponentDto {
  @IsString()
  @IsNotEmpty()
  name: string

  @IsEnum(SalaryComponentType)
  type: SalaryComponentType  // EARNING | DEDUCTION

  @IsBoolean()
  isFixed: boolean

  @IsOptional()
  @IsNumber()
  @Min(0)
  fixedAmount?: number  // required if isFixed = true

  @IsOptional()
  @IsEnum(DeductionBasis)
  deductionBasis?: DeductionBasis  // required if isFixed = false

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  percentageValue?: number  // required if isFixed = false

  @IsBoolean()
  isTaxable: boolean

  @IsBoolean()
  isStatutory: boolean

  @IsInt()
  @Min(0)
  order: number
}
```

---

### GET `/api/v1/salary-structures`

**Permission:** `SUPER_ADMIN`, `HR`

---

### GET `/api/v1/salary-structures/:id`

---

### PATCH `/api/v1/salary-structures/:id`

**Validation:** Cannot edit a structure that is `ACTIVE` (assigned to employees). Must clone and create new.

---

### POST `/api/v1/employees/:id/salary-assignments`

Assign a salary structure to an employee.

**Permission:** `SUPER_ADMIN`, `HR` (HR cannot assign to themselves)

**Request Body:**
```ts
class AssignSalaryStructureDto {
  @IsUUID()
  salaryStructureId: string

  @IsISO8601()
  effectiveFrom: string  // date only

  @IsOptional()
  @IsNumber()
  @Min(0)
  grossCtc?: number  // override CTC if different from structure default

  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  reason: string
}
```

**Side Effects:** `AuditLog`: action=`SALARY_CHANGE`, isSensitive=`true`.

---

### GET `/api/v1/employees/:id/salary-assignments`

Salary assignment history.

**Permission:** `SUPER_ADMIN`, `HR`

---

## Payroll Runs

---

### POST `/api/v1/payroll-runs`

Initiate a new payroll run.

**Permission:** `SUPER_ADMIN`, `HR`

**Request Body:**
```ts
class CreatePayrollRunDto {
  @IsInt()
  @Min(1)
  @Max(12)
  month: number

  @IsInt()
  @Min(2020)
  year: number
}
```

**Validation:** No existing DRAFT or later run for the same month/year.

**Response `201`:**
```json
{
  "id": "run_1",
  "month": 6,
  "year": 2025,
  "status": "DRAFT",
  "employeeCount": 0,
  "totalGross": 0,
  "message": "Payroll computation started. Refresh in a few seconds."
}
```

**Side Effects:** BullMQ job queued to compute attendance, leaves, and salary for all active employees.

---

### GET `/api/v1/payroll-runs`

**Permission:** `SUPER_ADMIN`, `HR`

**Query Parameters:** `status`, `year`, `month`

---

### GET `/api/v1/payroll-runs/:id`

**Response `200`:**
```json
{
  "id": "run_1",
  "month": 6,
  "year": 2025,
  "status": "UNDER_REVIEW",
  "employeeCount": 42,
  "totalGross": 2100000,
  "totalDeductions": 350000,
  "totalNet": 1750000,
  "initiatedBy": { "firstName": "Neha", "lastName": "HR" },
  "createdAt": "2025-06-28T10:00:00.000Z"
}
```

---

### GET `/api/v1/payroll-runs/:id/line-items`

Per-employee salary breakdown for this run.

**Permission:** `SUPER_ADMIN`, `HR`

**Query Parameters:** `search` (employee name/code), standard pagination.

**Response `200`:**
```json
{
  "data": [
    {
      "employeeId": "emp_abc",
      "employee": { "firstName": "Arjun", "lastName": "Nair", "employeeCode": "E042" },
      "daysPresent": 22,
      "daysAbsent": 0,
      "daysOnLeave": 1,
      "lopDays": 0,
      "grossSalary": 55000,
      "totalDeductions": 8100,
      "netSalary": 46900,
      "earningsBreakdown": { "Basic": 30000, "HRA": 12000, "SpecialAllowance": 13000 },
      "deductionsBreakdown": { "PF": 3600, "ESI": 413, "PT": 200, "TDS": 3887 },
      "isProRated": false,
      "isOverridden": false
    }
  ],
  "meta": { "total": 42 }
}
```

---

### PATCH `/api/v1/payroll-runs/:id/line-items/:employeeId`

Override a line item (e.g., add manual correction).

**Permission:** `SUPER_ADMIN`, `HR`

**Validation:** Run must be in `DRAFT` or `UNDER_REVIEW` status.

**Request Body:**
```ts
class OverridePayrollLineItemDto {
  @IsNumber()
  @Min(0)
  netSalary: number

  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  overrideNote: string
}
```

---

### POST `/api/v1/payroll-runs/:id/submit`

Move run from DRAFT to UNDER_REVIEW.

**Permission:** `SUPER_ADMIN`, `HR`

---

### POST `/api/v1/payroll-runs/:id/approve`

Approve the payroll run. Triggers payslip generation.

**Permission:** `SUPER_ADMIN`, `HR`

**Validation:** HR cannot approve a run where their own salary was overridden.

**Side Effects:** BullMQ job queued to generate all payslips.

---

### POST `/api/v1/payroll-runs/:id/finalise`

Mark run as FINALISED. Payment instructions prepared.

**Permission:** `SUPER_ADMIN`, `HR`

**Validation:** All payslips must be in `GENERATED` status.

---

### POST `/api/v1/payroll-runs/:id/disburse`

Confirm salaries disbursed.

**Permission:** `SUPER_ADMIN`, `HR`

---

### POST `/api/v1/payroll-runs/:id/bonuses`

Add a one-time bonus to a specific employee in this run.

**Permission:** `SUPER_ADMIN`, `HR`

**Validation:** Run must be in `DRAFT` or `UNDER_REVIEW`.

**Request Body:**
```ts
class CreateBonusDto {
  @IsUUID()
  employeeId: string

  @IsEnum(BonusType)
  type: BonusType  // PERFORMANCE | FESTIVAL | REFERRAL | JOINING | RETENTION | OTHER

  @IsNumber()
  @Min(1)
  amount: number

  @IsBoolean()
  isTaxable: boolean

  @IsString()
  @IsNotEmpty()
  reason: string
}
```

---

## Payslips

---

### GET `/api/v1/employees/:id/payslips`

**Permission:** `SUPER_ADMIN`, `HR` → any employee; `EMPLOYEE` → own only

**Query Parameters:** `year`, standard pagination.

**Response `200`:**
```json
{
  "data": [
    {
      "id": "payslip_1",
      "payrollRun": { "month": 6, "year": 2025 },
      "status": "DISTRIBUTED",
      "netSalary": 46900,
      "pdfUrl": "/api/v1/payslips/payslip_1/download",
      "distributedAt": "2025-07-01T10:00:00.000Z"
    }
  ]
}
```

---

### GET `/api/v1/payslips/:id/download`

Download payslip PDF.

**Permission:** `SUPER_ADMIN`, `HR`; `EMPLOYEE` → own payslip only

**Response `200`:** PDF file (binary stream). `Content-Type: application/pdf`.

**Side Effects:** `AuditLog`: action=`EXPORT`, module=`HRMS`, isSensitive=`true`.

---

## Performance Reviews

---

### POST `/api/v1/performance-reviews`

**Permission:** `SUPER_ADMIN`, `HR`

**Request Body:**
```ts
class CreatePerformanceReviewDto {
  @IsUUID()
  employeeId: string

  @IsUUID()
  managerId: string  // the reviewing manager's employee ID

  @IsString()
  @IsNotEmpty()
  reviewPeriod: string  // "Q1 2025" | "FY 2024-25"

  @IsEnum(PerformanceReviewType)
  reviewType: PerformanceReviewType
}
```

---

### GET `/api/v1/performance-reviews`

**Permission:** `SUPER_ADMIN`, `HR` → all; `TEAM_LEAD` → own team; `EMPLOYEE` → own reviews only

**Query Parameters:** `employeeId`, `managerId`, `status`, `reviewType`

---

### POST `/api/v1/performance-reviews/:id/self-assessment`

Employee submits self-assessment.

**Permission:** The review's `employeeId` user, `HR`, `SUPER_ADMIN`

**Request Body:**
```ts
class SelfAssessmentDto {
  @IsInt()
  @Min(1)
  @Max(5)
  selfRating: number

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  selfComments: string
}
```

---

### POST `/api/v1/performance-reviews/:id/manager-review`

Manager submits their assessment.

**Permission:** The review's `managerId` user, `HR`, `SUPER_ADMIN`

**Validation:** Self-assessment must be submitted first.

**Request Body:**
```ts
class ManagerReviewDto {
  @IsInt()
  @Min(1)
  @Max(5)
  managerRating: number

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  managerComments: string
}
```

---

### POST `/api/v1/performance-reviews/:id/hr-sign-off`

HR finalises the review.

**Permission:** `HR`, `SUPER_ADMIN`

**Request Body:**
```ts
class HrSignOffDto {
  @IsInt()
  @Min(1)
  @Max(5)
  finalRating: number

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  hrComments?: string
}
```

---

## Onboarding

---

### GET `/api/v1/employees/:id/onboarding`

**Permission:** `SUPER_ADMIN`, `HR`, the employee themselves

**Response `200`:** Full checklist with items, statuses, assigned users.

---

### PATCH `/api/v1/onboarding/items/:itemId`

Update a checklist item status.

**Permission:** Assigned user, `HR`, `SUPER_ADMIN`

**Request Body:**
```ts
class UpdateChecklistItemDto {
  @IsEnum(OnboardingItemStatus)
  status: OnboardingItemStatus
}
```

---

### POST `/api/v1/employees/:id/onboarding/complete`

Mark onboarding as complete and transition employee to ACTIVE.

**Permission:** `SUPER_ADMIN`, `HR`

**Validation:** All mandatory items must be COMPLETED.

---

## Exit Management

---

### POST `/api/v1/employees/:id/exit`

Initiate the exit process.

**Permission:** `SUPER_ADMIN`, `HR`

**Request Body:**
```ts
class InitiateExitDto {
  @IsEnum(EmployeeExitType)
  exitType: EmployeeExitType

  @IsOptional()
  @IsISO8601()
  resignationDate?: string

  @IsISO8601()
  lastWorkingDay: string

  @IsOptional()
  @IsInt()
  @Min(0)
  noticePeriodDays?: number
}
```

**Side Effects:** Employee status → EXITING; exit checklist generated; team lead notified.

---

### GET `/api/v1/employees/:id/exit`

**Permission:** `SUPER_ADMIN`, `HR`

Full exit record with checklist.

---

### PATCH `/api/v1/exit/items/:itemId`

**Permission:** Assigned user, `HR`, `SUPER_ADMIN`

Same shape as onboarding item update.

---

### POST `/api/v1/employees/:id/terminate`

Finalize termination after all checklist items complete and FFS disbursed.

**Permission:** `SUPER_ADMIN`

**Validation:** All mandatory exit checklist items must be COMPLETED. FFS must be disbursed.

**Side Effects:** Employee status → TERMINATED; user account deactivated; all JWT sessions invalidated.

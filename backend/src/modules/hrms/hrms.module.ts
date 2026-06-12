import { Module } from '@nestjs/common';
import { EmployeeModule } from './employee/employee.module';
import { DepartmentModule } from './department/department.module';
import { LeaveModule } from './leave/leave.module';
import { AttendanceModule } from './attendance/attendance.module';
import { PayrollModule } from './payroll/payroll.module';

@Module({
  imports: [EmployeeModule, DepartmentModule, LeaveModule, AttendanceModule, PayrollModule],
})
export class HrmsModule {}

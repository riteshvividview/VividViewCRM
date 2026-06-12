import {
  Controller, Get, Post, Param, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Body } from '@nestjs/common';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '@common/decorators/current-user.decorator';
import { Role } from '@common/enums';
import { PayrollService } from './payroll.service';
import { CreatePayrollRunDto } from './dto/create-payroll-run.dto';

@ApiTags('HRMS — Payroll')
@ApiBearerAuth()
@Controller('hrms/payroll')
export class PayrollController {
  constructor(private readonly svc: PayrollService) {}

  @Post('runs')
  @Roles(Role.ADMIN, Role.HR)
  @ApiOperation({ summary: 'Create a payroll run (draft)' })
  createRun(@Body() dto: CreatePayrollRunDto, @CurrentUser() user: AuthenticatedUser) {
    return this.svc.createRun(dto, user);
  }

  @Get('runs')
  @Roles(Role.ADMIN, Role.HR)
  @ApiOperation({ summary: 'List payroll runs' })
  getRuns(@CurrentUser() user: AuthenticatedUser) {
    return this.svc.getRuns(user.workspaceId);
  }

  @Post('runs/:id/process')
  @Roles(Role.ADMIN, Role.HR)
  @ApiOperation({ summary: 'Process payroll run (calculate payslips)' })
  processRun(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.svc.processRun(id, user);
  }

  @Get('runs/:id/payslips')
  @Roles(Role.ADMIN, Role.HR)
  @ApiOperation({ summary: 'Get all payslips for a run' })
  getPayslips(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.svc.getPayslips(id, user.workspaceId);
  }

  @Get('employees/:employeeId/payslips')
  @ApiOperation({ summary: 'Get payslip history for an employee' })
  getEmployeePayslips(@Param('employeeId', ParseUUIDPipe) employeeId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.svc.getEmployeePayslips(employeeId, user.workspaceId);
  }
}

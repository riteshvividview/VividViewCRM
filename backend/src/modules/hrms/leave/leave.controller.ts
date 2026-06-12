import {
  Controller, Get, Post, Body, Param, Query, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '@common/decorators/current-user.decorator';
import { Role } from '@common/enums';
import { LeaveService } from './leave.service';
import { CreateLeaveTypeDto } from './dto/create-leave-type.dto';
import { ApplyLeaveDto } from './dto/apply-leave.dto';
import { ApproveLeaveDto } from './dto/approve-leave.dto';

@ApiTags('HRMS — Leaves')
@ApiBearerAuth()
@Controller('hrms')
export class LeaveController {
  constructor(private readonly svc: LeaveService) {}

  @Post('leave-types')
  @Roles(Role.ADMIN, Role.HR)
  @ApiOperation({ summary: 'Create leave type' })
  createType(@Body() dto: CreateLeaveTypeDto, @CurrentUser() user: AuthenticatedUser) {
    return this.svc.createLeaveType(dto, user);
  }

  @Get('leave-types')
  @ApiOperation({ summary: 'List leave types' })
  getTypes(@CurrentUser() user: AuthenticatedUser) {
    return this.svc.getLeaveTypes(user.workspaceId);
  }

  @Post('employees/:employeeId/leaves')
  @ApiOperation({ summary: 'Apply for leave' })
  apply(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body() dto: ApplyLeaveDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.svc.apply(employeeId, dto, user);
  }

  @Get('leave-applications')
  @Roles(Role.ADMIN, Role.HR, Role.TEAM_LEAD)
  @ApiOperation({ summary: 'List leave applications' })
  @ApiQuery({ name: 'employee_id', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'year', required: false, type: Number })
  getApplications(
    @CurrentUser() user: AuthenticatedUser,
    @Query('employee_id') employee_id?: string,
    @Query('status') status?: string,
    @Query('year') year?: string,
  ) {
    return this.svc.getApplications(user.workspaceId, {
      employee_id,
      status,
      year: year ? Number(year) : undefined,
    });
  }

  @Post('leave-applications/:id/decide')
  @Roles(Role.ADMIN, Role.HR, Role.TEAM_LEAD)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Approve or reject leave application' })
  decide(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveLeaveDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.svc.decide(id, dto, user);
  }

  @Get('employees/:employeeId/leave-balances')
  @ApiOperation({ summary: 'Get leave balances for employee' })
  getBalances(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('year') year?: string,
  ) {
    return this.svc.getBalances(employeeId, year ? Number(year) : new Date().getFullYear(), user.workspaceId);
  }
}

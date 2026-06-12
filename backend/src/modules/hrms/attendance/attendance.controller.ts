import {
  Controller, Get, Post, Patch, Body, Param, Query, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '@common/decorators/current-user.decorator';
import { Role } from '@common/enums';
import { IsObject, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { AttendanceService } from './attendance.service';
import { MarkAttendanceDto, RegularizeAttendanceDto } from './dto/mark-attendance.dto';

class CheckInDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  location?: { lat: number; lng: number };
}

@ApiTags('HRMS — Attendance')
@ApiBearerAuth()
@Controller('hrms/attendance')
export class AttendanceController {
  constructor(private readonly svc: AttendanceService) {}

  @Post('mark')
  @Roles(Role.ADMIN, Role.HR)
  @ApiOperation({ summary: 'Mark attendance for an employee (admin)' })
  mark(@Body() dto: MarkAttendanceDto, @CurrentUser() user: AuthenticatedUser) {
    return this.svc.mark(dto, user);
  }

  @Post('check-in')
  @ApiOperation({ summary: 'Self check-in' })
  selfCheckIn(@Body() dto: CheckInDto, @CurrentUser() user: AuthenticatedUser) {
    return this.svc.selfCheckIn(user.id, dto.location, user);
  }

  @Post('check-out')
  @ApiOperation({ summary: 'Self check-out' })
  selfCheckOut(@Body() dto: CheckInDto, @CurrentUser() user: AuthenticatedUser) {
    return this.svc.selfCheckOut(user.id, dto.location, user);
  }

  @Get('today')
  @Roles(Role.ADMIN, Role.HR)
  @ApiOperation({ summary: 'Get today\'s attendance for all employees' })
  getToday(@CurrentUser() user: AuthenticatedUser, @Query('page') page = '1', @Query('limit') limit = '50') {
    const today = new Date().toISOString().split('T')[0];
    return this.svc.getForDate(user.workspaceId, today, Number(page), Number(limit));
  }

  @Get('date/:date')
  @Roles(Role.ADMIN, Role.HR)
  @ApiOperation({ summary: 'Get attendance for a specific date' })
  getForDate(
    @Param('date') date: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page = '1',
  ) {
    return this.svc.getForDate(user.workspaceId, date, Number(page));
  }

  @Get('summary')
  @Roles(Role.ADMIN, Role.HR)
  @ApiOperation({ summary: 'Attendance summary for a date' })
  @ApiQuery({ name: 'date', required: false })
  getSummary(@CurrentUser() user: AuthenticatedUser, @Query('date') date?: string) {
    const d = date ?? new Date().toISOString().split('T')[0];
    return this.svc.getSummary(user.workspaceId, d);
  }

  @Get('employee/:employeeId')
  @ApiOperation({ summary: 'Get attendance for an employee over a date range' })
  @ApiQuery({ name: 'from', required: true })
  @ApiQuery({ name: 'to', required: true })
  getForEmployee(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.svc.getForEmployee(employeeId, user.workspaceId, from, to);
  }

  @Patch(':id/regularize')
  @ApiOperation({ summary: 'Regularize attendance record' })
  regularize(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RegularizeAttendanceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.svc.regularize(id, dto, user);
  }
}

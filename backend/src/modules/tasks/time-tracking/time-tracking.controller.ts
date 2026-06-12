import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@common/decorators/current-user.decorator';
import { Role } from '@common/enums';
import { TimeTrackingService } from './time-tracking.service';
import { StartTimerDto } from './dto/start-timer.dto';
import { CreateTimeEntryDto } from './dto/create-time-entry.dto';
import { UpdateTimeEntryDto } from './dto/update-time-entry.dto';

@ApiTags('Time Tracking')
@ApiBearerAuth()
@Controller()
export class TimeTrackingController {
  constructor(private readonly timeTrackingService: TimeTrackingService) {}

  @Post('tasks/:taskId/timer/start')
  @ApiOperation({ summary: 'Start timer on task' })
  startTimer(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: StartTimerDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.timeTrackingService.startTimer(taskId, dto, user);
  }

  @Post('tasks/:taskId/timer/stop')
  @ApiOperation({ summary: 'Stop running timer' })
  stopTimer(
    @Param('taskId', ParseUUIDPipe) _taskId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.timeTrackingService.stopTimer(user.id, user.workspaceId);
  }

  @Get('time-entries/running')
  @ApiOperation({ summary: 'Get current running timer' })
  getRunning(@CurrentUser() user: AuthenticatedUser) {
    return this.timeTrackingService.getRunningTimer(user.id, user.workspaceId);
  }

  @Post('tasks/:taskId/time-entries')
  @ApiOperation({ summary: 'Create manual time entry' })
  createManual(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: CreateTimeEntryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.timeTrackingService.createManual(taskId, dto, user);
  }

  @Get('tasks/:taskId/time-entries')
  @ApiOperation({ summary: 'List time entries for task' })
  getTaskEntries(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.timeTrackingService.getTaskEntries(taskId, user.workspaceId);
  }

  @Patch('time-entries/:id')
  @ApiOperation({ summary: 'Update time entry (owner only)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTimeEntryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.timeTrackingService.update(id, dto, user);
  }

  @Delete('time-entries/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete time entry (owner only)' })
  delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.timeTrackingService.delete(id, user);
  }

  @Get('time-entries/report')
  @Roles(Role.ADMIN, Role.TEAM_LEAD, Role.HR)
  @ApiOperation({ summary: 'Time report (admin/team lead/HR)' })
  @ApiQuery({ name: 'user_id', required: false })
  @ApiQuery({ name: 'project_id', required: false })
  @ApiQuery({ name: 'from_date', required: false })
  @ApiQuery({ name: 'to_date', required: false })
  @ApiQuery({ name: 'is_billable', required: false, type: Boolean })
  getReport(
    @CurrentUser() user: AuthenticatedUser,
    @Query('user_id') user_id?: string,
    @Query('project_id') project_id?: string,
    @Query('from_date') from_date?: string,
    @Query('to_date') to_date?: string,
    @Query('is_billable') is_billable?: string,
  ) {
    return this.timeTrackingService.getReport(user.workspaceId, {
      user_id,
      project_id,
      from_date,
      to_date,
      is_billable: is_billable !== undefined ? is_billable === 'true' : undefined,
    });
  }
}

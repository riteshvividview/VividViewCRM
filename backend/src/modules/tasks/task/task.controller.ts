import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@common/decorators/current-user.decorator';
import { Role } from '@common/enums';
import { IsArray, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TaskService } from './task.service';
import { ActivityService } from '../activity/activity.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { MoveTaskDto } from './dto/move-task.dto';
import { FilterTasksDto } from './dto/filter-tasks.dto';

class AssignUsersDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsUUID('4', { each: true })
  user_ids!: string[];
}

@ApiTags('Tasks')
@ApiBearerAuth()
@Controller('tasks')
export class TaskController {
  constructor(
    private readonly taskService: TaskService,
    private readonly activityService: ActivityService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create task' })
  create(@Body() dto: CreateTaskDto, @CurrentUser() user: AuthenticatedUser) {
    return this.taskService.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'List tasks with filters' })
  findAll(@Query() filters: FilterTasksDto, @CurrentUser() user: AuthenticatedUser) {
    return this.taskService.findAll(user.workspaceId, filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get task detail' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.taskService.findById(id, user.workspaceId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update task' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaskDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.taskService.update(id, dto, user);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.TEAM_LEAD)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete task' })
  delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.taskService.delete(id, user);
  }

  @Post(':id/move')
  @ApiOperation({ summary: 'Move task to column (drag-drop)' })
  move(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MoveTaskDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.taskService.move(id, dto, user);
  }

  @Post(':id/assignees')
  @Roles(Role.ADMIN, Role.TEAM_LEAD)
  @ApiOperation({ summary: 'Add assignees to task' })
  assign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignUsersDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.taskService.assign(id, dto.user_ids, user);
  }

  @Delete(':id/assignees/:userId')
  @Roles(Role.ADMIN, Role.TEAM_LEAD)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unassign user from task' })
  unassign(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.taskService.unassign(id, userId, user);
  }

  @Post(':id/watch')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Subscribe to task notifications' })
  watch(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.taskService.watch(id, user.id, user.workspaceId);
  }

  @Delete(':id/watch')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unsubscribe from task notifications' })
  unwatch(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.taskService.unwatch(id, user.id, user.workspaceId);
  }

  @Post(':id/labels/:labelId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Apply label to task' })
  applyLabel(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('labelId', ParseUUIDPipe) labelId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.taskService.applyLabel(id, labelId, user);
  }

  @Delete(':id/labels/:labelId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove label from task' })
  removeLabel(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('labelId', ParseUUIDPipe) labelId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.taskService.removeLabel(id, labelId, user);
  }

  @Get(':id/activity')
  @ApiOperation({ summary: 'Get task activity log' })
  getActivity(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
  ) {
    return this.activityService.findByTask(id, user.workspaceId, Number(page), Number(limit));
  }

  @Get(':id/subtasks')
  @ApiOperation({ summary: 'Get subtasks of a task' })
  getSubtasks(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() filters: FilterTasksDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.taskService.findAll(user.workspaceId, { ...filters, parent_task_id: id });
  }
}

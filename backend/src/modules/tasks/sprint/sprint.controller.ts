import {
  Controller, Get, Post, Patch, Body, Param, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@common/decorators/current-user.decorator';
import { Role } from '@common/enums';
import { SprintService } from './sprint.service';
import { CreateSprintDto } from './dto/create-sprint.dto';
import { UpdateSprintDto } from './dto/update-sprint.dto';
import { CompleteSprintDto } from './dto/complete-sprint.dto';

@ApiTags('Sprints')
@ApiBearerAuth()
@Controller()
export class SprintController {
  constructor(private readonly sprintService: SprintService) {}

  @Post('boards/:boardId/sprints')
  @Roles(Role.ADMIN, Role.TEAM_LEAD)
  @ApiOperation({ summary: 'Create sprint on board' })
  create(
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Body() dto: CreateSprintDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sprintService.create(boardId, dto, user);
  }

  @Get('boards/:boardId/sprints')
  @ApiOperation({ summary: 'List sprints for board' })
  findAll(
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sprintService.findAll(boardId, user.workspaceId);
  }

  @Get('boards/:boardId/sprints/active')
  @ApiOperation({ summary: 'Get active sprint for board' })
  findActive(
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sprintService.findActive(boardId, user.workspaceId);
  }

  @Patch('sprints/:id')
  @Roles(Role.ADMIN, Role.TEAM_LEAD)
  @ApiOperation({ summary: 'Update sprint' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSprintDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sprintService.update(id, dto, user);
  }

  @Post('sprints/:id/start')
  @Roles(Role.ADMIN, Role.TEAM_LEAD)
  @ApiOperation({ summary: 'Start sprint' })
  start(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sprintService.start(id, user);
  }

  @Post('sprints/:id/complete')
  @Roles(Role.ADMIN, Role.TEAM_LEAD)
  @ApiOperation({ summary: 'Complete sprint and handle incomplete tasks' })
  complete(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CompleteSprintDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sprintService.complete(id, dto, user);
  }

  @Get('sprints/:id/velocity')
  @ApiOperation({ summary: 'Get sprint velocity report' })
  getVelocity(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sprintService.getVelocity(id, user.workspaceId);
  }
}

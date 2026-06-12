import {
  Controller, Get, Post, Patch, Delete, Body, Param,
  Query, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@common/decorators/current-user.decorator';
import { Role } from '@common/enums';
import { BoardService } from './board.service';
import { CreateBoardDto } from './dto/create-board.dto';
import { UpdateBoardDto } from './dto/update-board.dto';
import { CreateColumnDto } from './dto/create-column.dto';
import { ReorderColumnsDto } from './dto/reorder-columns.dto';

@ApiTags('Boards')
@ApiBearerAuth()
@Controller('boards')
export class BoardController {
  constructor(private readonly boardService: BoardService) {}

  @Post()
  @Roles(Role.ADMIN, Role.TEAM_LEAD)
  @ApiOperation({ summary: 'Create board' })
  create(@Body() dto: CreateBoardDto, @CurrentUser() user: AuthenticatedUser) {
    return this.boardService.create(dto, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get board with columns and active sprint' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.boardService.findById(id, user.workspaceId);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.TEAM_LEAD)
  @ApiOperation({ summary: 'Update board settings' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBoardDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.boardService.update(id, dto, user);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Archive board' })
  archive(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.boardService.archive(id, user);
  }

  @Get(':id/tasks')
  @ApiOperation({ summary: 'Get board tasks grouped by column' })
  @ApiQuery({ name: 'sprint_id', required: false })
  getTasksByColumn(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('sprint_id') sprint_id?: string,
  ) {
    return this.boardService.getTasksByColumn(id, user.workspaceId, sprint_id);
  }

  @Post(':id/columns')
  @Roles(Role.ADMIN, Role.TEAM_LEAD)
  @ApiOperation({ summary: 'Add column to board' })
  addColumn(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateColumnDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.boardService.addColumn(id, dto, user);
  }

  @Patch(':id/columns/reorder')
  @Roles(Role.ADMIN, Role.TEAM_LEAD)
  @ApiOperation({ summary: 'Reorder board columns' })
  reorderColumns(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReorderColumnsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.boardService.reorderColumns(id, dto, user);
  }

  @Delete(':boardId/columns/:columnId')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete column (must be empty)' })
  deleteColumn(
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Param('columnId', ParseUUIDPipe) columnId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.boardService.deleteColumn(boardId, columnId, user);
  }
}

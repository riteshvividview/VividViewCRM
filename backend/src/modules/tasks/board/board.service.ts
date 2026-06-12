import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';
import { AuthenticatedUser } from '@common/decorators/current-user.decorator';
import { CreateBoardDto, BoardType } from './dto/create-board.dto';
import { UpdateBoardDto } from './dto/update-board.dto';
import { CreateColumnDto } from './dto/create-column.dto';
import { ReorderColumnsDto } from './dto/reorder-columns.dto';

const DEFAULT_COLUMNS: Record<string, { name: string; color: string; is_done_column: boolean }[]> = {
  [BoardType.KANBAN]: [
    { name: 'To Do', color: '#e5e7eb', is_done_column: false },
    { name: 'In Progress', color: '#bfdbfe', is_done_column: false },
    { name: 'In Review', color: '#fef08a', is_done_column: false },
    { name: 'Done', color: '#bbf7d0', is_done_column: true },
  ],
  [BoardType.SCRUM]: [
    { name: 'Backlog', color: '#e5e7eb', is_done_column: false },
    { name: 'To Do', color: '#ddd6fe', is_done_column: false },
    { name: 'In Progress', color: '#bfdbfe', is_done_column: false },
    { name: 'In Review', color: '#fef08a', is_done_column: false },
    { name: 'Done', color: '#bbf7d0', is_done_column: true },
  ],
  [BoardType.LIST]: [
    { name: 'Open', color: '#e5e7eb', is_done_column: false },
    { name: 'Closed', color: '#bbf7d0', is_done_column: true },
  ],
  [BoardType.TIMELINE]: [
    { name: 'Planned', color: '#e5e7eb', is_done_column: false },
    { name: 'In Progress', color: '#bfdbfe', is_done_column: false },
    { name: 'Done', color: '#bbf7d0', is_done_column: true },
  ],
};

@Injectable()
export class BoardService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateBoardDto, user: AuthenticatedUser) {
    const project = await this.prisma.task_projects.findFirst({
      where: { id: dto.project_id, workspace_id: user.workspaceId },
      select: { id: true },
    });
    if (!project) throw new NotFoundException('Project not found');

    const boardType = dto.type ?? BoardType.KANBAN;
    const defaultCols = DEFAULT_COLUMNS[boardType] ?? DEFAULT_COLUMNS[BoardType.KANBAN];

    const board = await this.prisma.task_boards.create({
      data: {
        project_id: dto.project_id,
        workspace_id: user.workspaceId,
        name: dto.name,
        description: dto.description,
        type: boardType,
        is_private: dto.is_private ?? false,
        owner_id: user.id,
        created_by: user.id,
      },
    });

    await this.prisma.task_board_columns.createMany({
      data: defaultCols.map((col, idx) => ({
        board_id: board.id,
        workspace_id: user.workspaceId,
        name: col.name,
        color: col.color,
        position: idx,
        is_done_column: col.is_done_column,
      })),
    });

    return this.findById(board.id, user.workspaceId);
  }

  async findById(id: string, workspaceId: string) {
    const board = await this.prisma.task_boards.findFirst({
      where: { id, workspace_id: workspaceId },
      include: {
        task_board_columns: { orderBy: { position: 'asc' } },
        task_sprints: {
          where: { status: 'active' },
          select: { id: true, name: true, end_date: true, status: true },
          take: 1,
        },
        _count: { select: { tasks: true } },
      },
    });
    if (!board) throw new NotFoundException('Board not found');
    return board;
  }

  async update(id: string, dto: UpdateBoardDto, user: AuthenticatedUser) {
    await this.assertExists(id, user.workspaceId);
    return this.prisma.task_boards.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.is_private !== undefined && { is_private: dto.is_private }),
        updated_at: new Date(),
      },
    });
  }

  async archive(id: string, user: AuthenticatedUser) {
    await this.assertExists(id, user.workspaceId);
    await this.prisma.task_boards.update({
      where: { id },
      data: { archived_at: new Date(), updated_at: new Date() },
    });
  }

  async addColumn(boardId: string, dto: CreateColumnDto, user: AuthenticatedUser) {
    await this.assertExists(boardId, user.workspaceId);

    const maxPosition = await this.prisma.task_board_columns.aggregate({
      where: { board_id: boardId },
      _max: { position: true },
    });
    const position = dto.position ?? (maxPosition._max.position ?? -1) + 1;

    return this.prisma.task_board_columns.create({
      data: {
        board_id: boardId,
        workspace_id: user.workspaceId,
        name: dto.name,
        color: dto.color,
        position,
        is_done_column: dto.is_done_column ?? false,
        task_limit: dto.task_limit,
      },
    });
  }

  async reorderColumns(boardId: string, dto: ReorderColumnsDto, user: AuthenticatedUser) {
    await this.assertExists(boardId, user.workspaceId);

    await this.prisma.$transaction(
      dto.order.map((columnId, idx) =>
        this.prisma.task_board_columns.update({
          where: { id: columnId },
          data: { position: idx },
        }),
      ),
    );

    return this.prisma.task_board_columns.findMany({
      where: { board_id: boardId },
      orderBy: { position: 'asc' },
    });
  }

  async deleteColumn(boardId: string, columnId: string, user: AuthenticatedUser) {
    await this.assertExists(boardId, user.workspaceId);
    const col = await this.prisma.task_board_columns.findFirst({
      where: { id: columnId, board_id: boardId },
      select: { id: true, _count: { select: { tasks: true } } },
    });
    if (!col) throw new NotFoundException('Column not found');
    if (col._count.tasks > 0) {
      throw new ConflictException('Cannot delete column with tasks — move tasks first');
    }
    await this.prisma.task_board_columns.delete({ where: { id: columnId } });
  }

  async getTasksByColumn(boardId: string, workspaceId: string, sprintId?: string) {
    await this.assertExists(boardId, workspaceId);

    const columns = await this.prisma.task_board_columns.findMany({
      where: { board_id: boardId },
      orderBy: { position: 'asc' },
    });

    const taskFilter: Record<string, unknown> = { board_id: boardId, workspace_id: workspaceId };
    if (sprintId) taskFilter['sprint_id'] = sprintId;

    const tasks = await this.prisma.tasks.findMany({
      where: taskFilter,
      orderBy: { position: 'asc' },
      include: {
        task_assignees: {
          include: {
            users_task_assignees_user_idTousers: {
              select: { id: true, raw_user_meta_data: true },
            },
          },
        },
        task_label_assignments: {
          include: { task_labels: { select: { id: true, name: true, color: true } } },
        },
        _count: { select: { task_comments: true, other_tasks: true } },
      },
    });

    const grouped: Record<string, { column: typeof columns[0]; tasks: typeof tasks }> = {};
    for (const col of columns) {
      grouped[col.id] = { column: col, tasks: [] };
    }
    for (const task of tasks) {
      if (task.column_id && grouped[task.column_id]) {
        grouped[task.column_id].tasks.push(task);
      }
    }
    return grouped;
  }

  private async assertExists(id: string, workspaceId: string) {
    const board = await this.prisma.task_boards.findFirst({
      where: { id, workspace_id: workspaceId },
      select: { id: true },
    });
    if (!board) throw new NotFoundException('Board not found');
  }
}

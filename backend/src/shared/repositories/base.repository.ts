import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';
import { buildPaginationMeta, toPrismaPagination } from '@common/utils';
import { createPaginatedResponse, PaginatedResponseDto } from '../dto/paginated-response.dto';
import { PaginationDto } from '../dto/pagination.dto';

/**
 * Generic base repository providing common CRUD operations with workspace scoping.
 *
 * Every business module repository should extend this class and pass the
 * Prisma delegate (e.g. this.prisma.lead) as the `delegate` parameter.
 *
 * Extension points:
 *  - Override findOne() to add default includes (related records)
 *  - Override buildWhereClause() to add module-specific filters
 *  - Transactions are available via this.prisma.transaction()
 *
 * Multi-tenancy: workspaceId is always injected by the Prisma middleware
 * (see PrismaService.registerMiddleware). Repositories do NOT need to
 * manually add workspaceId to every where clause — the middleware does it.
 * However, for explicit safety, module repositories may add it redundantly.
 */
@Injectable()
export abstract class BaseRepository<
  TModel,
  TCreateInput,
  TUpdateInput,
  TWhereInput = Record<string, unknown>,
> {
  constructor(protected readonly prisma: PrismaService) {}

  // Subclasses provide the Prisma model delegate
  protected abstract get delegate(): {
    findUnique(args: { where: { id: string } & Record<string, unknown>; include?: Record<string, unknown> }): Promise<TModel | null>;
    findMany(args?: {
      where?: TWhereInput;
      orderBy?: Record<string, unknown> | Record<string, unknown>[];
      skip?: number;
      take?: number;
      include?: Record<string, unknown>;
    }): Promise<TModel[]>;
    count(args?: { where?: TWhereInput }): Promise<number>;
    create(args: { data: TCreateInput; include?: Record<string, unknown> }): Promise<TModel>;
    update(args: { where: { id: string }; data: TUpdateInput; include?: Record<string, unknown> }): Promise<TModel>;
    delete(args: { where: { id: string } }): Promise<TModel>;
  };

  async findById(id: string): Promise<TModel | null> {
    return this.delegate.findUnique({ where: { id } });
  }

  async findByIdOrThrow(id: string, entityName = 'Record'): Promise<TModel> {
    const record = await this.findById(id);
    if (!record) throw new NotFoundException(`${entityName} not found`);
    return record;
  }

  async findAll(
    where?: TWhereInput,
    pagination?: PaginationDto,
  ): Promise<PaginatedResponseDto<TModel>> {
    const { skip, take } = toPrismaPagination({
      page: pagination?.page,
      limit: pagination?.limit,
    });

    const orderBy = pagination?.sortBy
      ? { [pagination.sortBy]: pagination.sortOrder ?? 'desc' }
      : { createdAt: 'desc' as const };

    const [data, total] = await Promise.all([
      this.delegate.findMany({ where, skip, take, orderBy }),
      this.delegate.count({ where }),
    ]);

    const meta = buildPaginationMeta(total, {
      page: pagination?.page,
      limit: pagination?.limit,
    });

    return createPaginatedResponse(data, meta.total, meta.page, meta.limit);
  }

  async create(data: TCreateInput): Promise<TModel> {
    return this.delegate.create({ data });
  }

  async update(id: string, data: TUpdateInput): Promise<TModel> {
    return this.delegate.update({ where: { id }, data });
  }

  async softDelete(id: string): Promise<TModel> {
    // Prisma middleware converts delete → update with deletedAt
    return this.delegate.delete({ where: { id } });
  }

  async exists(where: TWhereInput): Promise<boolean> {
    const count = await this.delegate.count({ where });
    return count > 0;
  }
}

import { DEFAULT_LIMIT, DEFAULT_PAGE, MAX_LIMIT } from '../constants';

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PrismaFindManyArgs {
  skip: number;
  take: number;
}

/**
 * Convert page/limit into Prisma skip/take values.
 */
export function toPrismaPagination(params: PaginationParams): PrismaFindManyArgs {
  const page = Math.max(1, params.page ?? DEFAULT_PAGE);
  const limit = Math.min(MAX_LIMIT, Math.max(1, params.limit ?? DEFAULT_LIMIT));
  return {
    skip: (page - 1) * limit,
    take: limit,
  };
}

/**
 * Build the pagination meta object from raw total count.
 */
export function buildPaginationMeta(
  total: number,
  params: PaginationParams,
): PaginationMeta {
  const page = Math.max(1, params.page ?? DEFAULT_PAGE);
  const limit = Math.min(MAX_LIMIT, Math.max(1, params.limit ?? DEFAULT_LIMIT));
  return {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

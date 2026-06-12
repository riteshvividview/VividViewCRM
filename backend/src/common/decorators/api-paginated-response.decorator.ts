import { applyDecorators, Type } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger';
import { PaginatedResponseDto } from '@shared/dto/paginated-response.dto';

/**
 * Swagger decorator for paginated list responses.
 * Generates correct schema showing data: T[] + meta object.
 *
 * Usage: @ApiPaginatedResponse(LeadResponseDto)
 */
export const ApiPaginatedResponse = <T>(dto: Type<T>) =>
  applyDecorators(
    ApiExtraModels(PaginatedResponseDto, dto),
    ApiOkResponse({
      schema: {
        allOf: [
          { $ref: getSchemaPath(PaginatedResponseDto) },
          {
            properties: {
              data: {
                type: 'array',
                items: { $ref: getSchemaPath(dto) },
              },
            },
          },
        ],
      },
    }),
  );

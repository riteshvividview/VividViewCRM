import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationDto } from './pagination.dto';

/**
 * Base DTO for any list endpoint that supports full-text search.
 * Module-specific filter DTOs extend this.
 */
export class SearchDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Full-text search query', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}

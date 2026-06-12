import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional, IsUUID, IsString, IsBoolean, IsDateString,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { PaginationDto } from '@shared/dto/pagination.dto';

export class FilterTasksDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  project_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  board_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  sprint_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  column_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assignee_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  parent_task_id?: string;

  @ApiPropertyOptional({ description: 'Comma-separated statuses' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Comma-separated priorities' })
  @IsOptional()
  @IsString()
  priority?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  due_before?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  due_after?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }: { value: string }) => value === 'true')
  @IsBoolean()
  is_overdue?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }: { value: string }) => value === 'true')
  @IsBoolean()
  has_no_assignee?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CompleteSprintDto {
  @ApiPropertyOptional({
    description: 'Where to move incomplete tasks: backlog | next_sprint | <column_id>',
    example: 'backlog',
  })
  @IsOptional()
  @IsString()
  move_incomplete_to?: string;
}

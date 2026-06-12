import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsInt, IsOptional, Min } from 'class-validator';

export class MoveTaskDto {
  @ApiProperty()
  @IsUUID()
  column_id!: string;

  @ApiProperty({ example: 0 })
  @IsInt()
  @Min(0)
  position!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  sprint_id?: string;
}

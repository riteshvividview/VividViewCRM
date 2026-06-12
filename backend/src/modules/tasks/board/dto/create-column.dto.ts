import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString, IsOptional, IsInt, IsBoolean, MaxLength, Min,
} from 'class-validator';

export class CreateColumnDto {
  @ApiProperty({ example: 'In Review' })
  @IsString()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ example: '#f59e0b' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  color?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  is_done_column?: boolean;

  @ApiPropertyOptional({ description: 'WIP limit. null = unlimited' })
  @IsOptional()
  @IsInt()
  @Min(1)
  task_limit?: number;
}

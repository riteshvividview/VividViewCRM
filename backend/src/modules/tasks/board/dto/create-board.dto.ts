import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString, IsOptional, IsEnum, IsUUID, IsBoolean, MaxLength,
} from 'class-validator';

export enum BoardType {
  KANBAN = 'kanban',
  SCRUM = 'scrum',
  LIST = 'list',
  TIMELINE = 'timeline',
}

export class CreateBoardDto {
  @ApiProperty()
  @IsUUID()
  project_id!: string;

  @ApiProperty({ example: 'Sprint Board' })
  @IsString()
  @MaxLength(150)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: BoardType, default: BoardType.KANBAN })
  @IsOptional()
  @IsEnum(BoardType)
  type?: BoardType;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  is_private?: boolean;
}

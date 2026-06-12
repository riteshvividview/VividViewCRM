import { PartialType } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CreateSprintDto } from './create-sprint.dto';

export class UpdateSprintDto extends PartialType(CreateSprintDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  retrospective?: string;
}

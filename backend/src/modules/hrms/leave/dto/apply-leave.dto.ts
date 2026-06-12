import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsUUID, IsDateString, IsOptional, IsString, IsBoolean,
} from 'class-validator';

export class ApplyLeaveDto {
  @ApiProperty()
  @IsUUID()
  leave_type_id!: string;

  @ApiProperty({ example: '2026-06-10' })
  @IsDateString()
  from_date!: string;

  @ApiProperty({ example: '2026-06-12' })
  @IsDateString()
  to_date!: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  is_half_day?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  half_day_date?: string;

  @ApiPropertyOptional({ example: 'Family function' })
  @IsOptional()
  @IsString()
  reason?: string;
}

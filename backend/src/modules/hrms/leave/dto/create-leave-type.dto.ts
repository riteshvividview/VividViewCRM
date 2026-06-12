import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString, IsOptional, IsNumber, IsBoolean, MaxLength, Min,
} from 'class-validator';

export class CreateLeaveTypeDto {
  @ApiProperty({ example: 'Casual Leave' })
  @IsString()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: 'CL' })
  @IsString()
  @MaxLength(10)
  code!: string;

  @ApiProperty({ example: 12 })
  @IsNumber()
  @Min(0)
  days_per_year!: number;

  @ApiPropertyOptional({ example: 5, description: 'Max days that can carry forward' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  carry_forward_limit?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  is_paid?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  requires_approval?: boolean;

  @ApiPropertyOptional({ example: 'all', description: 'all | male | female' })
  @IsOptional()
  @IsString()
  applicable_gender?: string;
}

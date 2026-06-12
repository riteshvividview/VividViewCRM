import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum LeaveDecision {
  APPROVE = 'approved',
  REJECT = 'rejected',
}

export class ApproveLeaveDto {
  @ApiProperty({ enum: LeaveDecision })
  @IsEnum(LeaveDecision)
  decision!: LeaveDecision;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  rejection_reason?: string;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString, IsOptional, IsEmail, IsUUID, IsInt,
  IsEnum, MaxLength, Min, Max,
} from 'class-validator';

export enum LeadStatus {
  NEW = 'New', CONTACTED = 'Contacted', QUALIFIED = 'Qualified',
  PROPOSAL = 'Proposal', NEGOTIATION = 'Negotiation', WON = 'Won', LOST = 'Lost',
}

export enum LeadSource {
  WEBSITE = 'Website', REFERRAL = 'Referral', COLD_CALL = 'Cold Call',
  EMAIL = 'Email', SOCIAL_MEDIA = 'Social Media', ADVERTISEMENT = 'Advertisement', OTHER = 'Other',
}

export class CreateLeadDto {
  @ApiProperty({ example: 'Ravi Kumar' })
  @IsString()
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  company?: string;

  @ApiPropertyOptional({ enum: LeadSource })
  @IsOptional()
  @IsEnum(LeadSource)
  source?: LeadSource;

  @ApiPropertyOptional({ enum: LeadStatus, default: LeadStatus.NEW })
  @IsOptional()
  @IsEnum(LeadStatus)
  status?: LeadStatus;

  @ApiPropertyOptional({ example: 75, description: '0-100' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  score?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assigned_to?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assigned_name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

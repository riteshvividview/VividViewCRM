import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString, IsOptional, IsUUID, IsDateString, IsNumber,
  IsEnum, MaxLength, Min,
} from 'class-validator';

export enum EmploymentType {
  FULL_TIME = 'full_time',
  PART_TIME = 'part_time',
  CONTRACT = 'contract',
  INTERN = 'intern',
}

export enum EmployeeStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ON_NOTICE = 'on_notice',
  TERMINATED = 'terminated',
}

export enum WorkLocation {
  OFFICE = 'office',
  REMOTE = 'remote',
  HYBRID = 'hybrid',
}

export class CreateEmployeeDto {
  @ApiProperty({ example: 'EMP-001' })
  @IsString()
  @MaxLength(50)
  employee_code!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  user_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  department_id?: string;

  @ApiProperty({ example: 'Software Engineer' })
  @IsString()
  @MaxLength(150)
  designation!: string;

  @ApiPropertyOptional({ enum: EmploymentType, default: EmploymentType.FULL_TIME })
  @IsOptional()
  @IsEnum(EmploymentType)
  employment_type?: EmploymentType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  reporting_manager_id?: string;

  @ApiProperty({ example: '2026-06-01' })
  @IsDateString()
  date_of_joining!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  probation_end_date?: string;

  @ApiPropertyOptional({ enum: WorkLocation, default: WorkLocation.OFFICE })
  @IsOptional()
  @IsEnum(WorkLocation)
  work_location?: WorkLocation;

  @ApiPropertyOptional({ example: 1200000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  salary_ctc?: number;

  @ApiPropertyOptional({ example: 600000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  salary_basic?: number;

  @ApiPropertyOptional({ description: 'Stored encrypted' })
  @IsOptional()
  @IsString()
  pan_number?: string;

  @ApiPropertyOptional({ description: 'Stored encrypted' })
  @IsOptional()
  @IsString()
  aadhaar_number?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  uan_number?: string;

  @ApiPropertyOptional({ description: 'Stored encrypted' })
  @IsOptional()
  @IsString()
  bank_account_number?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bank_ifsc?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bank_name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  emergency_contact_name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  emergency_contact_phone?: string;
}

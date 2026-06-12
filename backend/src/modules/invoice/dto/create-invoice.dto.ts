import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString, IsOptional, IsUUID, IsDateString, IsArray,
  IsNumber, IsEnum, ValidateNested, MaxLength, Min, ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum DiscountType { NONE = 'none', PERCENT = 'percent', FLAT = 'flat' }
export enum InvoiceStatus {
  DRAFT = 'draft', SENT = 'sent', VIEWED = 'viewed',
  PARTIAL = 'partial', PAID = 'paid', OVERDUE = 'overdue', CANCELLED = 'cancelled',
}

export class InvoiceItemDto {
  @ApiProperty({ example: 'Website Development' })
  @IsString()
  @MaxLength(500)
  description!: string;

  @ApiPropertyOptional({ example: '998314' })
  @IsOptional()
  @IsString()
  hsn_sac?: string;

  @ApiProperty({ example: 1 })
  @IsNumber()
  @Min(0.001)
  quantity!: number;

  @ApiPropertyOptional({ example: 'Nos' })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiProperty({ example: 50000 })
  @IsNumber()
  @Min(0)
  unit_price!: number;

  @ApiPropertyOptional({ example: 18, description: 'Tax rate %: 0, 5, 12, 18, 28' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  tax_rate?: number;
}

export class CreateInvoiceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  contact_id?: string;

  @ApiProperty({ example: 'Acme Corp' })
  @IsString()
  @MaxLength(200)
  client_name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  client_email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  client_phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  client_address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  client_city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  client_state?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  client_pincode?: string;

  @ApiPropertyOptional({ example: '29ABCDE1234F1Z5' })
  @IsOptional()
  @IsString()
  client_gstin?: string;

  @ApiProperty({ example: '2026-06-01' })
  @IsDateString()
  issue_date!: string;

  @ApiPropertyOptional({ example: '2026-06-30' })
  @IsOptional()
  @IsDateString()
  due_date?: string;

  @ApiProperty({ type: [InvoiceItemDto], minItems: 1 })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  items!: InvoiceItemDto[];

  @ApiPropertyOptional({ enum: DiscountType, default: DiscountType.NONE })
  @IsOptional()
  @IsEnum(DiscountType)
  discount_type?: DiscountType;

  @ApiPropertyOptional({ example: 10, description: '10 = 10% or ₹10 flat' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discount_value?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  terms?: string;
}

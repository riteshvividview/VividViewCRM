import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumber, IsEnum, MaxLength, Min } from 'class-validator';

export enum TaxType { CGST_SGST = 'cgst_sgst', IGST = 'igst', NO_TAX = 'no_tax' }

export class UpdateInvoiceSettingsDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) business_name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() gst_number?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() pan_number?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() address?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() city?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() state?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() pincode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() bank_name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() bank_account?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() bank_ifsc?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() bank_branch?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() invoice_prefix?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(1) default_payment_days?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() default_notes?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() default_terms?: string;
  @ApiPropertyOptional({ enum: TaxType }) @IsOptional() @IsEnum(TaxType) tax_type?: TaxType;
}

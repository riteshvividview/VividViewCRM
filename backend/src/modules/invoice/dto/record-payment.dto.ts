import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsDateString, IsString, IsOptional, IsEnum, Min } from 'class-validator';

export enum PaymentMethod {
  BANK_TRANSFER = 'bank_transfer',
  UPI = 'upi',
  CASH = 'cash',
  CHEQUE = 'cheque',
  OTHER = 'other',
}

export class RecordPaymentDto {
  @ApiProperty({ example: 50000 })
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @ApiProperty({ example: '2026-06-15' })
  @IsDateString()
  payment_date!: string;

  @ApiPropertyOptional({ enum: PaymentMethod, default: PaymentMethod.BANK_TRANSFER })
  @IsOptional()
  @IsEnum(PaymentMethod)
  payment_method?: PaymentMethod;

  @ApiPropertyOptional({ example: 'UTR123456' })
  @IsOptional()
  @IsString()
  reference_number?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

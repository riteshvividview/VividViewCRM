import {
  Controller, Get, Post, Patch, Body, Param,
  Query, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { CurrentUser, AuthenticatedUser } from '@common/decorators/current-user.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { Role } from '@common/enums';
import { IsString, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { InvoiceService } from './invoice.service';
import { CreateInvoiceDto, InvoiceStatus } from './dto/create-invoice.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { UpdateInvoiceSettingsDto } from './dto/update-settings.dto';

class UpdateStatusDto {
  @ApiProperty({ enum: InvoiceStatus })
  @IsEnum(InvoiceStatus)
  status!: InvoiceStatus;
}

@ApiTags('Invoices')
@ApiBearerAuth()
@Controller('invoices')
export class InvoiceController {
  constructor(private readonly svc: InvoiceService) {}

  // ── Settings ──────────────────────────────────────────────────────────────────

  @Get('settings')
  @ApiOperation({ summary: 'Get business/invoice settings' })
  getSettings(@CurrentUser() user: AuthenticatedUser) {
    return this.svc.getSettings(user.workspaceId);
  }

  @Patch('settings')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update invoice settings (logo, GST, bank details)' })
  updateSettings(@Body() dto: UpdateInvoiceSettingsDto, @CurrentUser() user: AuthenticatedUser) {
    return this.svc.updateSettings(user.workspaceId, dto);
  }

  // ── Stats ─────────────────────────────────────────────────────────────────────

  @Get('stats')
  @ApiOperation({ summary: 'Invoice dashboard stats' })
  getStats(@CurrentUser() user: AuthenticatedUser) {
    return this.svc.getStats(user.workspaceId);
  }

  // ── Invoice CRUD ──────────────────────────────────────────────────────────────

  @Post()
  @ApiOperation({ summary: 'Create invoice with line items' })
  create(@Body() dto: CreateInvoiceDto, @CurrentUser() user: AuthenticatedUser) {
    return this.svc.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'List invoices' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'from_date', required: false })
  @ApiQuery({ name: 'to_date', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('from_date') from_date?: string,
    @Query('to_date') to_date?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.svc.findAll(user.workspaceId, { status, search, from_date, to_date }, Number(page), Number(limit));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get invoice detail with items and payments' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.svc.findById(id, user.workspaceId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update invoice' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Partial<CreateInvoiceDto>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.svc.update(id, dto, user);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update invoice status' })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.svc.updateStatus(id, dto.status, user);
  }

  @Post(':id/payments')
  @ApiOperation({ summary: 'Record a payment against this invoice' })
  recordPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordPaymentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.svc.recordPayment(id, dto, user);
  }
}

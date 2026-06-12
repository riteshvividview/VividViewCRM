import {
  Injectable, NotFoundException, ConflictException, BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';
import { AuthenticatedUser } from '@common/decorators/current-user.decorator';
import { CreateInvoiceDto, InvoiceItemDto, DiscountType } from './dto/create-invoice.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { UpdateInvoiceSettingsDto } from './dto/update-settings.dto';
import { Prisma } from '@prisma/client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

@Injectable()
export class InvoiceService {
  constructor(private readonly prisma: PrismaService) {}
  private get db(): DB { return this.prisma; }

  // ── Settings ────────────────────────────────────────────────────────────────

  async getSettings(workspaceId: string) {
    let settings = await this.db.inv_settings.findUnique({ where: { workspace_id: workspaceId } });
    if (!settings) {
      settings = await this.db.inv_settings.create({ data: { workspace_id: workspaceId } });
    }
    return settings;
  }

  async updateSettings(workspaceId: string, dto: UpdateInvoiceSettingsDto) {
    return this.db.inv_settings.upsert({
      where: { workspace_id: workspaceId },
      create: { workspace_id: workspaceId, ...dto },
      update: { ...dto, updated_at: new Date() },
    });
  }

  // ── Invoice CRUD ─────────────────────────────────────────────────────────────

  async create(dto: CreateInvoiceDto, user: AuthenticatedUser) {
    const settings = await this.getSettings(user.workspaceId);
    const invoiceNumber = await this.generateNumber(user.workspaceId, settings);

    const { subtotal, discountAmount, taxBreakdown, totalAmount } = this.computeTotals(dto, settings.tax_type);

    const invoice = await this.db.invoices.create({
      data: {
        workspace_id: user.workspaceId,
        invoice_number: invoiceNumber,
        contact_id: dto.contact_id,
        client_name: dto.client_name,
        client_email: dto.client_email ?? '',
        client_phone: dto.client_phone ?? '',
        client_address: dto.client_address ?? '',
        client_city: dto.client_city ?? '',
        client_state: dto.client_state ?? '',
        client_pincode: dto.client_pincode ?? '',
        client_gstin: dto.client_gstin ?? '',
        issue_date: new Date(dto.issue_date),
        due_date: dto.due_date ? new Date(dto.due_date) : this.defaultDueDate(dto.issue_date, settings.default_payment_days),
        status: 'draft',
        subtotal,
        discount_type: dto.discount_type ?? 'none',
        discount_value: dto.discount_value ?? 0,
        discount_amount: discountAmount,
        cgst_amount: taxBreakdown.cgst,
        sgst_amount: taxBreakdown.sgst,
        igst_amount: taxBreakdown.igst,
        tax_amount: taxBreakdown.total,
        total_amount: totalAmount,
        amount_paid: 0,
        amount_due: totalAmount,
        notes: dto.notes ?? settings.default_notes ?? '',
        terms: dto.terms ?? settings.default_terms ?? '',
        created_by: user.id,
      },
    });

    // Create line items
    await this.db.invoice_items.createMany({
      data: dto.items.map((item, idx) => {
        const amount = Number(item.quantity) * Number(item.unit_price);
        const taxRate = item.tax_rate ?? 18;
        const itemTax = Math.round(amount * (taxRate / 100) * 100) / 100;
        return {
          invoice_id: invoice.id,
          workspace_id: user.workspaceId,
          description: item.description,
          hsn_sac: item.hsn_sac ?? '',
          quantity: item.quantity,
          unit: item.unit ?? 'Nos',
          unit_price: item.unit_price,
          tax_rate: taxRate,
          amount,
          tax_amount: itemTax,
          total: amount + itemTax,
          position: idx,
        };
      }),
    });

    // Increment invoice number counter
    await this.db.inv_settings.update({
      where: { workspace_id: user.workspaceId },
      data: { next_invoice_number: { increment: 1 } },
    });

    return this.findById(invoice.id, user.workspaceId);
  }

  async findAll(workspaceId: string, filters: {
    status?: string; search?: string; from_date?: string; to_date?: string;
  }, page = 1, limit = 20) {
    const where: Record<string, unknown> = { workspace_id: workspaceId };
    if (filters.status && filters.status !== 'all') where['status'] = filters.status;
    if (filters.search) {
      where['OR'] = [
        { invoice_number: { contains: filters.search, mode: 'insensitive' } },
        { client_name: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    if (filters.from_date || filters.to_date) {
      where['issue_date'] = {
        ...(filters.from_date && { gte: new Date(filters.from_date) }),
        ...(filters.to_date && { lte: new Date(filters.to_date) }),
      };
    }

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.db.invoices.findMany({
        where, skip, take: limit,
        orderBy: { created_at: 'desc' },
        include: { invoice_items: { select: { id: true } } },
      }),
      this.db.invoices.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string, workspaceId: string) {
    const inv = await this.db.invoices.findFirst({
      where: { id, workspace_id: workspaceId },
      include: {
        invoice_items: { orderBy: { position: 'asc' } },
        invoice_payments: { orderBy: { payment_date: 'desc' } },
      },
    });
    if (!inv) throw new NotFoundException('Invoice not found');
    return inv;
  }

  async update(id: string, dto: Partial<CreateInvoiceDto>, user: AuthenticatedUser) {
    const inv = await this.db.invoices.findFirst({
      where: { id, workspace_id: user.workspaceId }, select: { id: true, status: true },
    });
    if (!inv) throw new NotFoundException('Invoice not found');
    if (['paid', 'cancelled'].includes(inv.status)) {
      throw new BadRequestException('Cannot edit a paid or cancelled invoice');
    }

    const settings = await this.getSettings(user.workspaceId);
    const updateData: Record<string, unknown> = { updated_at: new Date() };

    const fieldMap: Record<string, string> = {
      client_name: 'client_name', client_email: 'client_email', client_phone: 'client_phone',
      client_address: 'client_address', client_city: 'client_city', client_state: 'client_state',
      client_pincode: 'client_pincode', client_gstin: 'client_gstin',
      notes: 'notes', terms: 'terms',
    };

    for (const [key, field] of Object.entries(fieldMap)) {
      if ((dto as Record<string, unknown>)[key] !== undefined) {
        updateData[field] = (dto as Record<string, unknown>)[key];
      }
    }

    if (dto.issue_date) updateData['issue_date'] = new Date(dto.issue_date);
    if (dto.due_date) updateData['due_date'] = new Date(dto.due_date);

    if (dto.items?.length) {
      await this.db.invoice_items.deleteMany({ where: { invoice_id: id } });
      const fullDto = dto as CreateInvoiceDto;
      const { subtotal, discountAmount, taxBreakdown, totalAmount } = this.computeTotals(fullDto, settings.tax_type);

      await this.db.invoice_items.createMany({
        data: dto.items.map((item, idx) => {
          const amount = Number(item.quantity) * Number(item.unit_price);
          const taxRate = item.tax_rate ?? 18;
          return {
            invoice_id: id, workspace_id: user.workspaceId,
            description: item.description, hsn_sac: item.hsn_sac ?? '',
            quantity: item.quantity, unit: item.unit ?? 'Nos', unit_price: item.unit_price,
            tax_rate: taxRate, amount, tax_amount: amount * (taxRate / 100),
            total: amount + amount * (taxRate / 100), position: idx,
          };
        }),
      });

      const currentPaid = (await this.db.invoices.findFirst({ where: { id }, select: { amount_paid: true } }))?.amount_paid ?? 0;
      updateData['subtotal'] = subtotal;
      updateData['discount_type'] = dto.discount_type ?? 'none';
      updateData['discount_value'] = dto.discount_value ?? 0;
      updateData['discount_amount'] = discountAmount;
      updateData['cgst_amount'] = taxBreakdown.cgst;
      updateData['sgst_amount'] = taxBreakdown.sgst;
      updateData['igst_amount'] = taxBreakdown.igst;
      updateData['tax_amount'] = taxBreakdown.total;
      updateData['total_amount'] = totalAmount;
      updateData['amount_due'] = totalAmount - Number(currentPaid);
    }

    return this.db.invoices.update({ where: { id }, data: updateData });
  }

  async updateStatus(id: string, status: string, user: AuthenticatedUser) {
    await this.assertExists(id, user.workspaceId);
    return this.db.invoices.update({ where: { id }, data: { status, updated_at: new Date() } });
  }

  async recordPayment(id: string, dto: RecordPaymentDto, user: AuthenticatedUser) {
    const inv = await this.db.invoices.findFirst({
      where: { id, workspace_id: user.workspaceId },
      select: { id: true, total_amount: true, amount_paid: true, amount_due: true, status: true },
    });
    if (!inv) throw new NotFoundException('Invoice not found');
    if (inv.status === 'cancelled') throw new BadRequestException('Cannot record payment on cancelled invoice');

    const newPaid = Number(inv.amount_paid) + Number(dto.amount);
    const newDue = Number(inv.total_amount) - newPaid;
    const newStatus = newDue <= 0 ? 'paid' : 'partial';

    await this.db.invoice_payments.create({
      data: {
        invoice_id: id,
        workspace_id: user.workspaceId,
        amount: dto.amount,
        payment_date: new Date(dto.payment_date),
        payment_method: dto.payment_method ?? 'bank_transfer',
        reference_number: dto.reference_number ?? '',
        notes: dto.notes ?? '',
        created_by: user.id,
      },
    });

    return this.db.invoices.update({
      where: { id },
      data: { amount_paid: newPaid, amount_due: Math.max(0, newDue), status: newStatus, updated_at: new Date() },
    });
  }

  async getStats(workspaceId: string) {
    const [all, paid, overdue] = await Promise.all([
      this.db.invoices.aggregate({ where: { workspace_id: workspaceId, status: { notIn: ['cancelled'] } }, _sum: { total_amount: true, amount_due: true, amount_paid: true }, _count: true }),
      this.db.invoices.aggregate({ where: { workspace_id: workspaceId, status: 'paid' }, _sum: { total_amount: true }, _count: true }),
      this.db.invoices.count({ where: { workspace_id: workspaceId, status: { in: ['sent', 'viewed', 'partial'] }, due_date: { lt: new Date() } } }),
    ]);

    return {
      total_invoiced: Number(all._sum.total_amount ?? 0),
      total_paid: Number(paid._sum.total_amount ?? 0),
      total_outstanding: Number(all._sum.amount_due ?? 0),
      overdue_count: overdue,
      invoice_count: all._count,
      paid_count: paid._count,
    };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private computeTotals(dto: CreateInvoiceDto, taxType: string) {
    let subtotal = 0;
    let totalTaxOnItems = 0;
    let cgstTotal = 0, sgstTotal = 0, igstTotal = 0;

    for (const item of dto.items) {
      const amount = Number(item.quantity) * Number(item.unit_price);
      subtotal += amount;
      const rate = item.tax_rate ?? 18;
      const itemTax = amount * (rate / 100);
      totalTaxOnItems += itemTax;
      if (taxType === 'cgst_sgst') { cgstTotal += itemTax / 2; sgstTotal += itemTax / 2; }
      else if (taxType === 'igst') { igstTotal += itemTax; }
    }

    let discountAmount = 0;
    if (dto.discount_type === DiscountType.PERCENT && dto.discount_value) {
      discountAmount = subtotal * (dto.discount_value / 100);
    } else if (dto.discount_type === DiscountType.FLAT && dto.discount_value) {
      discountAmount = dto.discount_value;
    }

    const taxableAmount = subtotal - discountAmount;
    const ratio = subtotal > 0 ? taxableAmount / subtotal : 1;
    cgstTotal *= ratio; sgstTotal *= ratio; igstTotal *= ratio;
    const totalTax = taxType === 'no_tax' ? 0 : totalTaxOnItems * ratio;
    const totalAmount = taxableAmount + totalTax;

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      discountAmount: Math.round(discountAmount * 100) / 100,
      taxBreakdown: {
        cgst: Math.round(cgstTotal * 100) / 100,
        sgst: Math.round(sgstTotal * 100) / 100,
        igst: Math.round(igstTotal * 100) / 100,
        total: Math.round(totalTax * 100) / 100,
      },
      totalAmount: Math.round(totalAmount * 100) / 100,
    };
  }

  private async generateNumber(workspaceId: string, settings: { invoice_prefix: string; next_invoice_number: number }) {
    const year = new Date().getFullYear();
    const num = String(settings.next_invoice_number).padStart(4, '0');
    return `${settings.invoice_prefix}-${year}-${num}`;
  }

  private defaultDueDate(issueDate: string, paymentDays: number): Date {
    const d = new Date(issueDate);
    d.setDate(d.getDate() + paymentDays);
    return d;
  }

  private async assertExists(id: string, workspaceId: string) {
    const inv = await this.db.invoices.findFirst({ where: { id, workspace_id: workspaceId }, select: { id: true } });
    if (!inv) throw new NotFoundException('Invoice not found');
  }
}

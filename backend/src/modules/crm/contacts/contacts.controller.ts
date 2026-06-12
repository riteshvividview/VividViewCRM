import {
  Controller, Get, Post, Patch, Delete, Body, Param,
  Query, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { CurrentUser, AuthenticatedUser } from '@common/decorators/current-user.decorator';
import { ContactsService } from './contacts.service';
import { CreateContactDto } from './dto/create-contact.dto';

@ApiTags('CRM — Contacts')
@ApiBearerAuth()
@Controller('crm/contacts')
export class ContactsController {
  constructor(private readonly svc: ContactsService) {}

  @Post()
  @ApiOperation({ summary: 'Create contact' })
  create(@Body() dto: CreateContactDto, @CurrentUser() user: AuthenticatedUser) {
    return this.svc.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'List contacts' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'company', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('search') search?: string,
    @Query('company') company?: string,
    @Query('status') status?: string,
    @Query('page') page = '1',
  ) {
    return this.svc.findAll(user.workspaceId, { search, company, status }, Number(page));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get contact by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.svc.findById(id, user.workspaceId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update contact' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: Partial<CreateContactDto>, @CurrentUser() user: AuthenticatedUser) {
    return this.svc.update(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete contact' })
  delete(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.svc.delete(id, user);
  }
}

import {
  Controller, Get, Post, Patch, Delete, Body, Param,
  Query, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { CurrentUser, AuthenticatedUser } from '@common/decorators/current-user.decorator';
import { IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';
import { LeadsService } from './leads.service';
import { CreateLeadDto } from './dto/create-lead.dto';

class AddActivityDto {
  @ApiProperty() @IsString() type!: string;
  @ApiProperty() @IsString() content!: string;
}

@ApiTags('CRM — Leads')
@ApiBearerAuth()
@Controller('crm/leads')
export class LeadsController {
  constructor(private readonly svc: LeadsService) {}

  @Post()
  @ApiOperation({ summary: 'Create lead' })
  create(@Body() dto: CreateLeadDto, @CurrentUser() user: AuthenticatedUser) {
    return this.svc.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'List leads' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'source', required: false })
  @ApiQuery({ name: 'assigned_to', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: string,
    @Query('source') source?: string,
    @Query('assigned_to') assigned_to?: string,
    @Query('search') search?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
  ) {
    return this.svc.findAll(user.workspaceId, { status, source, assigned_to, search }, Number(page), Number(limit));
  }

  @Get('stats')
  @ApiOperation({ summary: 'Lead pipeline stats' })
  getStats(@CurrentUser() user: AuthenticatedUser) {
    return this.svc.getStats(user.workspaceId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get lead by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.svc.findById(id, user.workspaceId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update lead' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: Partial<CreateLeadDto>, @CurrentUser() user: AuthenticatedUser) {
    return this.svc.update(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete lead' })
  delete(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.svc.delete(id, user);
  }

  @Post(':id/activities')
  @ApiOperation({ summary: 'Add activity to lead' })
  addActivity(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AddActivityDto, @CurrentUser() user: AuthenticatedUser) {
    return this.svc.addActivity(id, dto.type, dto.content, user);
  }
}

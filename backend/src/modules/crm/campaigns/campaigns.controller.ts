import {
  Controller, Get, Post, Patch, Body, Param,
  Query, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { CurrentUser, AuthenticatedUser } from '@common/decorators/current-user.decorator';
import { CampaignsService } from './campaigns.service';

@ApiTags('CRM — Campaigns')
@ApiBearerAuth()
@Controller('crm/campaigns')
export class CampaignsController {
  constructor(private readonly svc: CampaignsService) {}

  @Get()
  @ApiOperation({ summary: 'List campaigns' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  findAll(@CurrentUser() user: AuthenticatedUser, @Query('status') status?: string, @Query('page') page = '1') {
    return this.svc.findAll(user.workspaceId, status, Number(page));
  }

  @Get('stats')
  @ApiOperation({ summary: 'Campaign stats by status' })
  getStats(@CurrentUser() user: AuthenticatedUser) {
    return this.svc.getStats(user.workspaceId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get campaign by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.svc.findById(id, user.workspaceId);
  }

  @Post()
  @ApiOperation({ summary: 'Create campaign' })
  create(@Body() dto: { name: string; subject: string; preview_text?: string; template_id?: string }, @CurrentUser() user: AuthenticatedUser) {
    return this.svc.create(dto, user);
  }

  @Patch(':id/status')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Update campaign status' })
  updateStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: { status: string }, @CurrentUser() user: AuthenticatedUser) {
    return this.svc.updateStatus(id, dto.status, user);
  }
}

import {
  Controller, Get, Post, Patch, Delete, Body, Param,
  Query, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { CurrentUser, AuthenticatedUser } from '@common/decorators/current-user.decorator';
import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { DealsService } from './deals.service';
import { CreateDealDto } from './dto/create-deal.dto';

class AddDealActivityDto {
  @ApiProperty() @IsString() type!: string;
  @ApiProperty() @IsString() content!: string;
}

@ApiTags('CRM — Deals')
@ApiBearerAuth()
@Controller('crm/deals')
export class DealsController {
  constructor(private readonly svc: DealsService) {}

  @Post()
  @ApiOperation({ summary: 'Create deal' })
  create(@Body() dto: CreateDealDto, @CurrentUser() user: AuthenticatedUser) {
    return this.svc.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'List deals' })
  @ApiQuery({ name: 'stage', required: false })
  @ApiQuery({ name: 'assigned_to', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('stage') stage?: string,
    @Query('assigned_to') assigned_to?: string,
    @Query('search') search?: string,
    @Query('page') page = '1',
  ) {
    return this.svc.findAll(user.workspaceId, { stage, assigned_to, search }, Number(page));
  }

  @Get('pipeline')
  @ApiOperation({ summary: 'Deal pipeline by stage (count + value)' })
  getPipeline(@CurrentUser() user: AuthenticatedUser) {
    return this.svc.getPipeline(user.workspaceId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get deal by ID with activities' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.svc.findById(id, user.workspaceId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update deal' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: Partial<CreateDealDto>, @CurrentUser() user: AuthenticatedUser) {
    return this.svc.update(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete deal' })
  delete(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.svc.delete(id, user);
  }

  @Post(':id/activities')
  @ApiOperation({ summary: 'Add activity to deal' })
  addActivity(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AddDealActivityDto, @CurrentUser() user: AuthenticatedUser) {
    return this.svc.addActivity(id, dto.type, dto.content, user);
  }
}

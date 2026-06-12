import {
  Controller, Get, Post, Patch, Delete, Body, Param,
  ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@common/decorators/current-user.decorator';
import { Role } from '@common/enums';
import { LabelService } from './label.service';
import { CreateLabelDto } from './dto/create-label.dto';

@ApiTags('Labels')
@ApiBearerAuth()
@Controller('labels')
export class LabelController {
  constructor(private readonly labelService: LabelService) {}

  @Post()
  @Roles(Role.ADMIN, Role.TEAM_LEAD)
  @ApiOperation({ summary: 'Create workspace label' })
  create(@Body() dto: CreateLabelDto, @CurrentUser() user: AuthenticatedUser) {
    return this.labelService.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'List workspace labels' })
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.labelService.findAll(user.workspaceId);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.TEAM_LEAD)
  @ApiOperation({ summary: 'Update label' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateLabelDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.labelService.update(id, dto, user);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete label' })
  delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.labelService.delete(id, user);
  }
}

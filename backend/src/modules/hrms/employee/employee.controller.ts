import {
  Controller, Get, Post, Patch, Body, Param,
  Query, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '@common/decorators/current-user.decorator';
import { Role } from '@common/enums';
import { EmployeeService } from './employee.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

@ApiTags('HRMS — Employees')
@ApiBearerAuth()
@Controller('hrms/employees')
export class EmployeeController {
  constructor(private readonly svc: EmployeeService) {}

  @Post()
  @Roles(Role.ADMIN, Role.HR)
  @ApiOperation({ summary: 'Create employee' })
  create(@Body() dto: CreateEmployeeDto, @CurrentUser() user: AuthenticatedUser) {
    return this.svc.create(dto, user);
  }

  @Get()
  @Roles(Role.ADMIN, Role.HR, Role.TEAM_LEAD)
  @ApiOperation({ summary: 'List employees' })
  @ApiQuery({ name: 'department_id', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'employment_type', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('department_id') department_id?: string,
    @Query('status') status?: string,
    @Query('employment_type') employment_type?: string,
    @Query('search') search?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.svc.findAll(user.workspaceId, { department_id, status, search, employment_type }, Number(page), Number(limit));
  }

  @Get('stats')
  @Roles(Role.ADMIN, Role.HR)
  @ApiOperation({ summary: 'Employee headcount stats' })
  getStats(@CurrentUser() user: AuthenticatedUser) {
    return this.svc.getStats(user.workspaceId);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.HR, Role.TEAM_LEAD)
  @ApiOperation({ summary: 'Get employee by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.svc.findById(id, user.workspaceId);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.HR)
  @ApiOperation({ summary: 'Update employee' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmployeeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.svc.update(id, dto, user);
  }
}

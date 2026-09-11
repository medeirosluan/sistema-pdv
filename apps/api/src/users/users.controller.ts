import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { RequirePermission } from '../auth/decorators/permissions.decorator.js';
import type { AuthUser } from '../auth/types/auth-user.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { QueryUsersDto } from './dto/query-users.dto.js';
import { UpdateUserPasswordDto } from './dto/update-user-password.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { UsersService } from './users.service.js';

@RequirePermission('users.manage')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: QueryUsersDto) {
    return this.usersService.list(user.tenantId, query);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.usersService.findOne(user.tenantId, id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateUserDto) {
    return this.usersService.create(user.tenantId, user, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.update(user.tenantId, user, id, dto);
  }

  @Patch(':id/password')
  updatePassword(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserPasswordDto,
  ) {
    return this.usersService.updatePassword(user.tenantId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.usersService.remove(user.tenantId, user.userId, id);
  }
}

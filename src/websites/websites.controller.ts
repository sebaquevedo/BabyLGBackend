import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { WebsiteGuard } from '../common/guards/website.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { WebsitesService } from './websites.service.js';
import { CreateWebsiteDto, OverviewQueryDto, UpdateWebsiteDto } from './dto/website.dto.js';

/**
 * Two guard layers, on purpose: `JwtAuthGuard` proves who is calling, `WebsiteGuard` proves the
 * caller has a membership in the site's account and answers 404 (never 403) when they do not.
 * Mutations add `RolesGuard`, which reads the membership the previous guard attached.
 */
@ApiTags('websites')
@ApiBearerAuth()
@Controller('websites')
export class WebsitesController {
  constructor(private readonly websites: WebsitesService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Sites of the accounts the caller belongs to' })
  list(@CurrentUser('sub') userId: string) {
    return this.websites.list(userId);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Add a website to the caller’s account' })
  create(@CurrentUser('sub') userId: string, @Body() dto: CreateWebsiteDto) {
    return this.websites.create(userId, dto);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, WebsiteGuard)
  @ApiOperation({ summary: 'One website' })
  findOne(@Param('id') id: string) {
    return this.websites.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, WebsiteGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Rename the site or change its publishing policy' })
  update(@Param('id') id: string, @Body() dto: UpdateWebsiteDto) {
    return this.websites.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, WebsiteGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete the site and everything under it' })
  async remove(@Param('id') id: string): Promise<void> {
    await this.websites.remove(id);
  }

  @Get(':id/overview')
  @UseGuards(JwtAuthGuard, WebsiteGuard)
  @ApiOperation({ summary: 'Everything the Overview screen needs, in one round trip' })
  overview(@Param('id') id: string, @Query() query: OverviewQueryDto) {
    return this.websites.overview(id, query.date);
  }
}

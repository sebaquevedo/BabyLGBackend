import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { WebsitesController } from './websites.controller.js';
import { WebsitesService } from './websites.service.js';
import { OverviewService } from './overview.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { WebsiteGuard } from '../common/guards/website.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule, JwtModule.register({})],
  controllers: [WebsitesController],
  providers: [WebsitesService, OverviewService, JwtAuthGuard, WebsiteGuard, RolesGuard],
  exports: [WebsitesService, OverviewService],
})
export class WebsitesModule {}

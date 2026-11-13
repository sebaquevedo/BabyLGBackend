import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { WebsitesModule } from './websites/websites.module.js';

@Module({
  imports: [
    // `env.example` is the template; a local `.env` is gitignored. Every module reads
    // `process.env` directly, so making this global is enough — no ConfigService plumbing.
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env'] }),
    PrismaModule,
    AuthModule,
    WebsitesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { APP_GUARD, APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';
import configuration from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { KnowledgeModule } from './modules/knowledge/knowledge.module';
import { AiModule } from './modules/ai/ai.module';
import { MessagesModule } from './modules/messages/messages.module';
import { LeadsModule } from './modules/leads/leads.module';
import { ChatsModule } from './modules/chats/chats.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from './modules/auth/guards/roles.guard';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    EventEmitterModule.forRoot(),
    DatabaseModule,
    AuthModule,
    UsersModule,
    OrganizationsModule,
    KnowledgeModule,
    AiModule,
    MessagesModule,
    LeadsModule,
    ChatsModule,
    AnalyticsModule,
  ],
  providers: [
    // Apply JWT guard globally — use @Public() to opt-out specific routes
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // Apply roles guard globally
    { provide: APP_GUARD, useClass: RolesGuard },
    // Global logging interceptor: logs all HTTP requests, responses, latencies and errors
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    // Global response transform interceptor: { statusCode, data, error: null }
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    // Global HTTP exception filter: { statusCode, data: null, error }
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}

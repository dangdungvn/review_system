import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiGenerationLog } from './entities/ai-generation-log.entity';
import { AiSetting } from './entities/ai-setting.entity';
import { AiService } from './ai.service';
import { AiSettingsService } from './ai-settings.service';

@Module({
  imports: [TypeOrmModule.forFeature([AiGenerationLog, AiSetting])],
  providers: [AiService, AiSettingsService],
  exports: [AiService, AiSettingsService, TypeOrmModule],
})
export class AiModule {}

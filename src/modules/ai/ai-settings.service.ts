import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { AiSetting } from './entities/ai-setting.entity';

export interface EffectiveAiSettings {
  apiKey: string;
  hasApiKey: boolean;
  apiKeySource: 'database' | 'environment' | 'none';
  model: string;
  maxInputChars: number;
  examTotalQuestions: number;
  trueFalseTotalQuestions: number;
  promptOverrides: {
    exam: string | null;
    flashcards: string | null;
    summary: string | null;
    trueFalse: string | null;
  };
}

export interface AiSettingsPatch {
  apiKey?: string;
  model?: string;
  maxInputChars?: number;
  examTotalQuestions?: number;
  trueFalseTotalQuestions?: number;
  examPrompt?: string | null;
  flashcardPrompt?: string | null;
  summaryPrompt?: string | null;
  trueFalsePrompt?: string | null;
}

@Injectable()
export class AiSettingsService {
  private readonly defaultModel = 'gemini-3-flash-preview';

  constructor(
    @InjectRepository(AiSetting)
    private readonly settingRepo: Repository<AiSetting>,
    private readonly configService: ConfigService,
  ) {}

  async getEffectiveSettings(): Promise<EffectiveAiSettings> {
    const settings = await this.getSettingsMap();
    const databaseApiKey = this.decryptSecret(settings.get('gemini_api_key') || '');
    const envApiKey = this.configService.get<string>('GEMINI_API_KEY', '');
    const apiKey = databaseApiKey || envApiKey || '';

    return {
      apiKey,
      hasApiKey: Boolean(apiKey),
      apiKeySource: databaseApiKey
        ? 'database'
        : envApiKey
          ? 'environment'
          : 'none',
      model:
        settings.get('gemini_model') ||
        this.configService.get<string>('GEMINI_MODEL', this.defaultModel),
      maxInputChars: this.toPositiveInt(settings.get('max_input_chars'), 30000),
      examTotalQuestions: this.toPositiveInt(
        settings.get('exam_total_questions'),
        50,
      ),
      trueFalseTotalQuestions: this.toPositiveInt(
        settings.get('true_false_total_questions'),
        30,
      ),
      promptOverrides: {
        exam: settings.get('prompt_exam') || null,
        flashcards: settings.get('prompt_flashcards') || null,
        summary: settings.get('prompt_summary') || null,
        trueFalse: settings.get('prompt_true_false') || null,
      },
    };
  }

  async getAdminSettings() {
    const settings = await this.getEffectiveSettings();
    return {
      hasApiKey: settings.hasApiKey,
      apiKeySource: settings.apiKeySource,
      apiKeyMasked: this.maskSecret(settings.apiKey),
      model: settings.model,
      maxInputChars: settings.maxInputChars,
      examTotalQuestions: settings.examTotalQuestions,
      trueFalseTotalQuestions: settings.trueFalseTotalQuestions,
      prompts: settings.promptOverrides,
    };
  }

  async updateSettings(patch: AiSettingsPatch) {
    await Promise.all([
      this.setSecretIfProvided('gemini_api_key', patch.apiKey),
      this.setIfProvided('gemini_model', patch.model),
      this.setIfProvided('max_input_chars', patch.maxInputChars),
      this.setIfProvided('exam_total_questions', patch.examTotalQuestions),
      this.setIfProvided(
        'true_false_total_questions',
        patch.trueFalseTotalQuestions,
      ),
      this.setNullableIfProvided('prompt_exam', patch.examPrompt),
      this.setNullableIfProvided('prompt_flashcards', patch.flashcardPrompt),
      this.setNullableIfProvided('prompt_summary', patch.summaryPrompt),
      this.setNullableIfProvided('prompt_true_false', patch.trueFalsePrompt),
    ]);

    return this.getAdminSettings();
  }

  private async getSettingsMap() {
    const rows = await this.settingRepo.find();
    return new Map(rows.map((row) => [row.key, row.value || '']));
  }

  private async setIfProvided(key: string, value: unknown) {
    if (value === undefined || value === null || value === '') {
      return;
    }
    await this.upsert(key, String(value).trim());
  }

  private async setSecretIfProvided(key: string, value: unknown) {
    if (value === undefined || value === null || value === '') {
      return;
    }
    await this.upsert(key, this.encryptSecret(String(value).trim()));
  }

  private async setNullableIfProvided(key: string, value: string | null | undefined) {
    if (value === undefined) {
      return;
    }
    await this.upsert(key, value?.trim() || null);
  }

  private async upsert(key: string, value: string | null) {
    const existing = await this.settingRepo.findOne({ where: { key } });
    if (existing) {
      existing.value = value;
      await this.settingRepo.save(existing);
      return;
    }

    await this.settingRepo.save(this.settingRepo.create({ key, value }));
  }

  private toPositiveInt(value: string | undefined, fallback: number) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
  }

  private maskSecret(secret: string) {
    if (!secret) {
      return null;
    }
    if (secret.length <= 8) {
      return '********';
    }
    return `${secret.slice(0, 4)}...${secret.slice(-4)}`;
  }

  private getEncryptionKey() {
    const secret =
      this.configService.get<string>('AI_SETTINGS_ENCRYPTION_KEY') ||
      this.configService.get<string>('JWT_SECRET') ||
      'development-ai-settings-key';

    return createHash('sha256').update(secret).digest();
  }

  private encryptSecret(secret: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.getEncryptionKey(), iv);
    const encrypted = Buffer.concat([
      cipher.update(secret, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    return [
      'enc:v1',
      iv.toString('base64'),
      tag.toString('base64'),
      encrypted.toString('base64'),
    ].join(':');
  }

  private decryptSecret(value: string) {
    if (!value || !value.startsWith('enc:v1:')) {
      return value;
    }

    const [, , ivBase64, tagBase64, encryptedBase64] = value.split(':');
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.getEncryptionKey(),
      Buffer.from(ivBase64, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(tagBase64, 'base64'));

    return Buffer.concat([
      decipher.update(Buffer.from(encryptedBase64, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }
}

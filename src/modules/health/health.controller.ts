import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Health')
@Controller('health')
@Public()
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Get('liveness')
  @ApiOperation({ summary: 'Liveness check - ứng dụng đang chạy' })
  @ApiResponse({ status: 200, description: 'Alive' })
  liveness() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('readiness')
  @ApiOperation({ summary: 'Readiness check - ứng dụng sẵn sàng nhận traffic' })
  @ApiResponse({ status: 200, description: 'Ready' })
  @ApiResponse({ status: 503, description: 'Not ready' })
  async readiness() {
    // Kiểm tra kết nối database
    const dbOk = this.dataSource.isInitialized;

    return {
      status: dbOk ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      checks: {
        database: dbOk ? 'ok' : 'error',
      },
    };
  }
}

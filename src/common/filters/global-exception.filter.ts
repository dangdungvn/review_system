import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;

    const ctx = host.switchToHttp();
    const request = ctx.getRequest<{ url: string; method: string }>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const response = exception.getResponse();
      if (typeof response === 'object' && response !== null) {
        const res = response as { message?: string | string[]; error?: string };
        message = res.message || message;
        error = res.error || error;
      } else if (typeof response === 'string') {
        message = response;
      }

      // Log 4xx as warn, 5xx as error
      if (statusCode >= 500) {
        this.logger.error(
          `[${request.method}] ${request.url} → ${statusCode}`,
          exception instanceof Error ? exception.stack : String(exception),
        );
      } else {
        this.logger.warn(
          `[${request.method}] ${request.url} → ${statusCode}: ${Array.isArray(message) ? message.join(', ') : message}`,
        );
      }
    } else {
      // Unknown exceptions (not HttpException)
      this.logger.error(
        `[${request.method}] ${request.url} → Unhandled exception`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const responseBody = {
      statusCode,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    httpAdapter.reply(ctx.getResponse(), responseBody, statusCode);
  }
}

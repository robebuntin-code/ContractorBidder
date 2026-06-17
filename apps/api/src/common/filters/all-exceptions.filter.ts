import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Request, Response } from 'express';

/**
 * Normalizes every error into a machine-readable JSON envelope with a
 * correlation id, matching the spec's error-handling contract.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const correlationId = randomUUID();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message: unknown = 'An unexpected error occurred.';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
        code = this.codeForStatus(status);
      } else if (body && typeof body === 'object') {
        const obj = body as Record<string, unknown>;
        code = (obj.code as string) ?? this.codeForStatus(status);
        message = obj.message ?? exception.message;
      }
    }

    if (status >= 500) {
      this.logger.error(
        `[${correlationId}] ${req.method} ${req.url} -> ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    res.status(status).json({ statusCode: status, code, message, correlationId });
  }

  private codeForStatus(status: number): string {
    const map: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE_ENTITY',
      429: 'RATE_LIMITED',
    };
    return map[status] ?? 'ERROR';
  }
}

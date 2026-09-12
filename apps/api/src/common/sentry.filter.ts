import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import * as Sentry from '@sentry/node';

/**
 * Filtro global: mantém o formato de resposta padrão do Nest para
 * HttpException e reporta ao Sentry apenas erros inesperados (não-HTTP ou
 * 5xx), evitando ruído de erros de validação/negócio esperados (400, 401,
 * 403, 404 etc.).
 */
@Catch()
export class SentryExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    if (!isHttpException || status >= 500) {
      Sentry.captureException(exception);
    }

    const body = isHttpException
      ? exception.getResponse()
      : { statusCode: status, message: 'Erro interno do servidor' };

    response
      .status(status)
      .json(typeof body === 'string' ? { statusCode: status, message: body } : body);
  }
}

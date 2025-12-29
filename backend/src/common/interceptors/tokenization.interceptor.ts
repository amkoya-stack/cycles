import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import { TokenizationService } from '../services/tokenization.service';
import {
  TOKENIZE_FIELDS_KEY,
  DETOKENIZE_FIELDS_KEY,
} from '../decorators/tokenize.decorator';

/**
 * TokenizationInterceptor
 * 
 * Automatically detokenizes sensitive fields in API responses
 * based on @Detokenize decorator metadata.
 * 
 * For tokenization on input (saving to DB), use TokenizationService
 * directly in services.
 */
@Injectable()
export class TokenizationInterceptor implements NestInterceptor {
  constructor(
    private readonly tokenization: TokenizationService,
    private readonly reflector: Reflector,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const handler = context.getHandler();
    const detokenizeFields = this.reflector.get<string[]>(
      DETOKENIZE_FIELDS_KEY,
      handler,
    );

    // If no detokenize decorator, pass through
    if (!detokenizeFields || detokenizeFields.length === 0) {
      return next.handle();
    }

    return next.handle().pipe(
      map(async (data) => {
        // Handle arrays
        if (Array.isArray(data)) {
          return Promise.all(
            data.map((item) => this.detokenizeFields(item, detokenizeFields)),
          );
        }

        // Handle single objects
        return this.detokenizeFields(data, detokenizeFields);
      }),
    ) as Observable<any>;
  }

  private async detokenizeFields(
    data: any,
    fields: string[],
  ): Promise<any> {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const result = { ...data };

    for (const field of fields) {
      if (result[field] != null) {
        result[field] = await this.tokenization.detokenize(
          result[field],
          field,
        );
      }
    }

    return result;
  }
}


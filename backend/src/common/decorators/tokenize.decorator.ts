/**
 * Decorator to mark fields that should be tokenized
 * Used with TokenizationInterceptor to automatically tokenize/detokenize
 */
export const TOKENIZE_FIELDS_KEY = 'tokenize:fields';

/**
 * Decorator to specify which fields should be tokenized
 * 
 * @param fields - Array of field names to tokenize
 * 
 * @example
 * ```typescript
 * @Tokenize(['email', 'phone', 'id_number'])
 * async getUserProfile() { ... }
 * ```
 */
export function Tokenize(fields: string[]) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    Reflect.defineMetadata(TOKENIZE_FIELDS_KEY, fields, descriptor.value);
  };
}

/**
 * Decorator to specify which fields should be detokenized in responses
 * 
 * @param fields - Array of field names to detokenize
 * 
 * @example
 * ```typescript
 * @Detokenize(['email', 'phone', 'id_number'])
 * async getUserProfile() { ... }
 * ```
 */
export const DETOKENIZE_FIELDS_KEY = 'detokenize:fields';

export function Detokenize(fields: string[]) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    Reflect.defineMetadata(DETOKENIZE_FIELDS_KEY, fields, descriptor.value);
  };
}


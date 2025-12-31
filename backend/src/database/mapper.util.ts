/**
 * Database Mapper Utility
 * 
 * Lightweight helpers for mapping between database rows (snake_case) 
 * and TypeScript objects (camelCase) without requiring an ORM.
 * 
 * Usage:
 *   const user = mapRow<User>(row, { dateFields: ['createdAt', 'updatedAt'] });
 *   const users = mapRows<User>(result.rows, { dateFields: ['createdAt'] });
 */

/**
 * Convert snake_case string to camelCase
 */
function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Convert camelCase string to snake_case
 */
function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/**
 * Convert object keys from snake_case to camelCase
 */
function keysToCamelCase(obj: Record<string, any>): Record<string, any> {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return obj;
  }

  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = toCamelCase(key);
    result[camelKey] = value;
  }
  return result;
}

/**
 * Convert object keys from camelCase to snake_case
 */
function keysToSnakeCase(obj: Record<string, any>): Record<string, any> {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return obj;
  }

  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = toSnakeCase(key);
    result[snakeKey] = value;
  }
  return result;
}

export interface MapOptions {
  /**
   * Fields that should be converted to Date objects
   */
  dateFields?: string[];
  /**
   * Fields that should be converted to numbers
   */
  numberFields?: string[];
  /**
   * Fields that should be converted to booleans
   */
  booleanFields?: string[];
  /**
   * Fields that should be parsed as JSON
   */
  jsonFields?: string[];
  /**
   * Custom field transformations
   */
  transforms?: Record<string, (value: any) => any>;
  /**
   * Skip key conversion (use as-is)
   */
  skipKeyConversion?: boolean;
}

/**
 * Map a single database row to a TypeScript object
 */
export function mapRow<T = any>(
  row: any,
  options: MapOptions = {},
): T | null {
  if (!row) {
    return null;
  }

  // Convert keys if needed
  let mapped = options.skipKeyConversion ? row : keysToCamelCase(row);

  // Apply type conversions
  const {
    dateFields = [],
    numberFields = [],
    booleanFields = [],
    jsonFields = [],
    transforms = {},
  } = options;

  // Convert dates
  for (const field of dateFields) {
    if (mapped[field] != null) {
      mapped[field] = new Date(mapped[field]);
    }
  }

  // Convert numbers
  for (const field of numberFields) {
    if (mapped[field] != null && mapped[field] !== '') {
      mapped[field] = parseFloat(mapped[field]);
    }
  }

  // Convert booleans
  for (const field of booleanFields) {
    if (mapped[field] != null) {
      mapped[field] = Boolean(mapped[field]);
    }
  }

  // Parse JSON fields
  for (const field of jsonFields) {
    if (mapped[field] != null && typeof mapped[field] === 'string') {
      try {
        mapped[field] = JSON.parse(mapped[field]);
      } catch {
        // Keep original value if parsing fails
      }
    }
  }

  // Apply custom transforms
  for (const [field, transform] of Object.entries(transforms)) {
    if (mapped[field] != null) {
      mapped[field] = transform(mapped[field]);
    }
  }

  return mapped as T;
}

/**
 * Map multiple database rows to an array of TypeScript objects
 */
export function mapRows<T = any>(
  rows: any[],
  options: MapOptions = {},
): T[] {
  if (!rows || rows.length === 0) {
    return [];
  }

  return rows.map((row) => mapRow<T>(row, options)).filter((item) => item !== null) as T[];
}

/**
 * Convert a TypeScript object to database row format (camelCase to snake_case)
 */
export function toRow<T extends Record<string, any> = any>(
  obj: T,
  options: {
    /**
     * Fields to exclude from conversion
     */
    excludeFields?: string[];
    /**
     * Fields to include only
     */
    includeFields?: string[];
    /**
     * Custom field transformations
     */
    transforms?: Record<string, (value: any) => any>;
  } = {},
): Record<string, any> {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const { excludeFields = [], includeFields, transforms = {} } = options;

  // Convert to snake_case
  let row = keysToSnakeCase(obj as Record<string, any>);

  // Apply field filters
  if (includeFields && includeFields.length > 0) {
    const filtered: Record<string, any> = {};
    for (const field of includeFields) {
      const snakeKey = toSnakeCase(field);
      if (row[snakeKey] !== undefined) {
        filtered[snakeKey] = row[snakeKey];
      }
    }
    row = filtered;
  } else if (excludeFields.length > 0) {
    for (const field of excludeFields) {
      const snakeKey = toSnakeCase(field);
      delete row[snakeKey];
    }
  }

  // Apply custom transforms
  for (const [field, transform] of Object.entries(transforms)) {
    const snakeKey = toSnakeCase(field);
    if (row[snakeKey] !== undefined) {
      row[snakeKey] = transform(row[snakeKey]);
    }
  }

  return row;
}

/**
 * Extract values for INSERT statement
 * Returns array of values in the order of fieldNames
 */
export function extractValues(
  obj: Record<string, any>,
  fieldNames: string[],
): any[] {
  return fieldNames.map((field) => {
    const snakeKey = toSnakeCase(field);
    return obj[snakeKey] ?? obj[field] ?? null;
  });
}

/**
 * Build SET clause for UPDATE statement
 * Returns { setClause: "field1 = $1, field2 = $2", values: [val1, val2] }
 */
export function buildUpdateSet(
  obj: Record<string, any>,
  options: {
    excludeFields?: string[];
    prefix?: string; // For parameterized queries ($1, $2, etc.)
  } = {},
): { setClause: string; values: any[] } {
  const { excludeFields = [], prefix = '$' } = options;
  const row = toRow(obj, { excludeFields });
  
  const entries = Object.entries(row);
  if (entries.length === 0) {
    return { setClause: '', values: [] };
  }

  const setParts: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  for (const [key, value] of entries) {
    setParts.push(`${key} = ${prefix}${paramIndex}`);
    values.push(value);
    paramIndex++;
  }

  return {
    setClause: setParts.join(', '),
    values,
  };
}

/**
 * Type-safe query result mapper
 * Automatically maps result.rows using provided options
 */
export function mapQueryResult<T = any>(
  result: { rows: any[] },
  options: MapOptions = {},
): T[] {
  return mapRows<T>(result.rows, options);
}

/**
 * Type-safe single row mapper
 * Maps result.rows[0] or returns null
 */
export function mapQueryRow<T = any>(
  result: { rows: any[] },
  options: MapOptions = {},
): T | null {
  if (!result.rows || result.rows.length === 0) {
    return null;
  }
  return mapRow<T>(result.rows[0], options);
}


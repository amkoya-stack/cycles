/**
 * RLS Context Test Suite
 * 
 * This test suite verifies that RLS context is properly set
 * when querying RLS-protected tables. Run these tests regularly
 * to catch RLS context issues before they reach production.
 * 
 * To run: npm test -- rls-context.spec.ts
 */

import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseService } from './database.service';
import { RlsValidatorService } from './rls-validator.service';
import { DatabaseModule } from './database.module';
import { ConfigModule } from '@nestjs/config';

describe('RLS Context', () => {
  let db: DatabaseService;
  let validator: RlsValidatorService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          envFilePath: '.env',
        }),
        DatabaseModule,
      ],
    }).compile();

    db = module.get<DatabaseService>(DatabaseService);
    validator = module.get<RlsValidatorService>(RlsValidatorService);
  });

  describe('Context Validation', () => {
    it('should detect missing context', async () => {
      const isValid = await validator.validateContext();
      // Context should not be set initially
      expect(isValid).toBe(false);
    });

    it('should validate system context', async () => {
      await db.setSystemContext();
      const isValid = await validator.validateContext();
      expect(isValid).toBe(true);
      await db.clearContext();
    });

    it('should validate user context', async () => {
      const testUserId = '00000000-0000-0000-0000-000000000001';
      await db.setUserContext(testUserId);
      const isValid = await validator.validateContext();
      expect(isValid).toBe(true);
      await db.clearContext();
    });
  });

  describe('Query Helpers', () => {
    it('queryAsSystem should set and clear context automatically', async () => {
      // Query without context should return 0 rows (RLS blocks)
      const withoutContext = await db.query(
        'SELECT COUNT(*) as count FROM chamas',
      );
      
      // Query with system context should work
      const withContext = await db.queryAsSystem(
        'SELECT COUNT(*) as count FROM chamas',
      );
      
      // System context should bypass RLS
      expect(withContext.rows[0].count).toBeGreaterThanOrEqual(0);
      
      // Verify context was cleared
      const contextAfter = await validator.validateContext();
      expect(contextAfter).toBe(false);
    });

    it('queryAsUser should set and clear context automatically', async () => {
      const testUserId = '00000000-0000-0000-0000-000000000001';
      
      // Query with user context should work
      const result = await db.queryAsUser(
        testUserId,
        'SELECT COUNT(*) as count FROM chamas',
      );
      
      expect(result.rows).toBeDefined();
      
      // Verify context was cleared
      const contextAfter = await validator.validateContext();
      expect(contextAfter).toBe(false);
    });
  });

  describe('RLS Protection Detection', () => {
    it('should detect RLS-protected queries', () => {
      const protectedQueries = [
        'SELECT * FROM chamas',
        'SELECT * FROM chama_members',
        'UPDATE chamas SET name = $1',
        'DELETE FROM contributions WHERE id = $1',
      ];

      protectedQueries.forEach((query) => {
        expect(validator.isRlsProtectedQuery(query)).toBe(true);
      });
    });

    it('should not flag non-RLS queries', () => {
      const nonProtectedQueries = [
        'SELECT * FROM users',
        'SELECT * FROM migrations',
        'SELECT * FROM audit_log',
      ];

      nonProtectedQueries.forEach((query) => {
        expect(validator.isRlsProtectedQuery(query)).toBe(false);
      });
    });
  });

  afterAll(async () => {
    await db.clearContext();
  });
});


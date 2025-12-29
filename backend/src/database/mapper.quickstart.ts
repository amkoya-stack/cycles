/**
 * Quick Start Guide - Replace Manual Mappers
 * 
 * This shows how to replace existing manual mapper functions
 * with the new mapper utility.
 */

import { mapQueryRow, mapQueryResult, toRow, buildUpdateSet } from './mapper.util';

// ==========================================
// EXAMPLE: Replace mapReputationScore
// ==========================================

interface ReputationScore {
  id: string;
  userId: string;
  chamaId: string;
  totalScore: number;
  contributionScore: number;
  loanRepaymentScore: number;
  meetingAttendanceScore: number;
  votingParticipationScore: number;
  disputePenalty: number;
  tier: string;
  contributionConsistencyRate: number;
  loanRepaymentRate: number;
  meetingAttendanceRate: number;
  votingRate: number;
  disputeCount: number;
  contributionStreakMonths: number;
  earlyPaymentCount: number;
  perfectAttendanceMonths: number;
  completedLoans: number;
  loanDefaultCount: number;
  lastCalculatedAt: Date;
}

// OLD WAY (manual mapping):
/*
private mapReputationScore(row: any): ReputationScore {
  return {
    id: row.id,
    userId: row.user_id,
    chamaId: row.chama_id,
    totalScore: row.total_score,
    contributionScore: row.contribution_score,
    loanRepaymentScore: row.loan_repayment_score,
    meetingAttendanceScore: row.meeting_attendance_score,
    votingParticipationScore: row.voting_participation_score,
    disputePenalty: row.dispute_penalty,
    tier: row.tier,
    contributionConsistencyRate: parseFloat(row.contribution_consistency_rate),
    loanRepaymentRate: parseFloat(row.loan_repayment_rate),
    meetingAttendanceRate: parseFloat(row.meeting_attendance_rate),
    votingRate: parseFloat(row.voting_rate),
    disputeCount: row.dispute_count,
    contributionStreakMonths: row.contribution_streak_months,
    earlyPaymentCount: row.early_payment_count,
    perfectAttendanceMonths: row.perfect_attendance_months,
    completedLoans: row.completed_loans,
    loanDefaultCount: row.loan_default_count,
    lastCalculatedAt: row.last_calculated_at,
  };
}
*/

// NEW WAY (using mapper):
async function getReputationScore(db: any, userId: string, chamaId: string) {
  const result = await db.query(
    'SELECT * FROM reputation_scores WHERE user_id = $1 AND chama_id = $2',
    [userId, chamaId]
  );
  
  return mapQueryRow<ReputationScore>(result, {
    dateFields: ['lastCalculatedAt'],
    numberFields: [
      'totalScore',
      'contributionScore',
      'loanRepaymentScore',
      'meetingAttendanceScore',
      'votingParticipationScore',
      'disputePenalty',
      'contributionConsistencyRate',
      'loanRepaymentRate',
      'meetingAttendanceRate',
      'votingRate',
      'disputeCount',
      'contributionStreakMonths',
      'earlyPaymentCount',
      'perfectAttendanceMonths',
      'completedLoans',
      'loanDefaultCount',
    ],
  });
}

// ==========================================
// EXAMPLE: Replace mapBadge
// ==========================================

interface Badge {
  id: string;
  code: string;
  name: string;
  description: string;
  tier: string;
  iconUrl: string;
  pointsRequired: number;
  criteria: Record<string, any>;
  isActive: boolean;
}

// OLD WAY:
/*
private mapBadge(row: any): Badge {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    tier: row.tier,
    iconUrl: row.icon_url,
    pointsRequired: row.points_required,
    criteria: row.criteria,
    isActive: row.is_active,
  };
}
*/

// NEW WAY:
async function getBadge(db: any, id: string) {
  const result = await db.query('SELECT * FROM badges WHERE id = $1', [id]);
  
  return mapQueryRow<Badge>(result, {
    numberFields: ['pointsRequired'],
    booleanFields: ['isActive'],
    jsonFields: ['criteria'],
  });
}

// ==========================================
// EXAMPLE: UPDATE with buildUpdateSet
// ==========================================

async function updateUserProfile(db: any, userId: string, updates: Partial<User>) {
  const { setClause, values } = buildUpdateSet(updates, {
    excludeFields: ['id', 'createdAt'], // Don't update these
  });
  
  if (!setClause) {
    throw new Error('No fields to update');
  }
  
  const query = `
    UPDATE users
    SET ${setClause}, updated_at = NOW()
    WHERE id = $${values.length + 1}
    RETURNING *
  `;
  
  const result = await db.query(query, [...values, userId]);
  return mapQueryRow<User>(result, {
    dateFields: ['createdAt', 'updatedAt'],
  });
}

interface User {
  id: string;
  email: string;
  fullName: string;
  createdAt: Date;
  updatedAt: Date;
}


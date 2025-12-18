import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import {
  CreateRotationOrderDto,
  SkipRotationPositionDto,
  SwapRotationPositionsDto,
} from './dto/rotation.dto';
import { randomBytes } from 'crypto';
import { v4 as uuidv4 } from 'uuid';

interface Member {
  id: string;
  userId: string;
  fullName: string;
  activityScore: number;
  joinedAt: Date;
}

interface RotationOrder {
  id: string;
  chamaId: string;
  rotationType: string;
  currentPosition: number;
  totalPositions: number;
  status: string;
}

interface RotationPosition {
  id: string;
  rotationOrderId: string;
  memberId: string;
  position: number;
  status: string;
  meritScore: number | null;
}

@Injectable()
export class RotationService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Create a new rotation order for a chama
   */
  async createRotationOrder(dto: CreateRotationOrderDto) {
    return this.db.transaction(async (client) => {
      // Validate chama exists and get contribution amount
      const chamaResult = await client.query(
        'SELECT id, admin_user_id, contribution_amount FROM chamas WHERE id = $1',
        [dto.chamaId],
      );

      if (chamaResult.rowCount === 0) {
        throw new NotFoundException('Chama not found');
      }

      const chama = chamaResult.rows[0];
      const contributionAmount = chama.contribution_amount || 1000; // Default to 1000 if not set

      // Check if there's already an active rotation
      const existingResult = await client.query(
        `SELECT id FROM rotation_orders 
         WHERE chama_id = $1 AND status = 'active'`,
        [dto.chamaId],
      );

      if (existingResult.rowCount > 0) {
        throw new BadRequestException(
          'Chama already has an active rotation order',
        );
      }

      // Get all active members
      const membersResult = await client.query(
        `SELECT cm.id, cm.user_id, u.full_name, cm.activity_score, cm.joined_at
         FROM chama_members cm
         JOIN users u ON cm.user_id = u.id
         WHERE cm.chama_id = $1 AND cm.status = 'active'
         ORDER BY cm.joined_at ASC`,
        [dto.chamaId],
      );

      const members: Member[] = membersResult.rows;

      if (members.length === 0) {
        throw new BadRequestException('No active members found in chama');
      }

      // Create rotation order
      const rotationResult = await client.query(
        `INSERT INTO rotation_orders (
          chama_id, rotation_type, cycle_duration_months, 
          status, start_date, current_position, total_positions
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *`,
        [
          dto.chamaId,
          dto.rotationType,
          dto.cycleDurationMonths,
          'active',
          dto.startDate,
          0, // Start at position 0
          members.length,
        ],
      );

      const rotationOrder = rotationResult.rows[0];

      // Assign positions based on rotation type
      const positions = await this.assignMemberPositions(
        client,
        rotationOrder.id,
        members,
        dto.rotationType,
        dto.customOrder,
      );

      // Automatically create the first contribution cycle
      const cycleId = uuidv4();
      const startDate = new Date(dto.startDate);
      const dueDate = new Date(startDate);
      dueDate.setMonth(dueDate.getMonth() + dto.cycleDurationMonths);

      // Get the first position member as payout recipient
      const firstPosition = positions.find((p: any) => p.position === 1) as any;
      const payoutRecipientId = firstPosition ? firstPosition.memberId : null;

      await client.query(
        `INSERT INTO contribution_cycles (
          id, chama_id, cycle_number, expected_amount, start_date, due_date,
          payout_recipient_id, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')`,
        [
          cycleId,
          dto.chamaId,
          1, // First cycle
          contributionAmount, // Use chama's contribution amount
          startDate,
          dueDate,
          payoutRecipientId,
        ],
      );

      return {
        rotationOrder,
        firstCycleId: cycleId,
        totalMembers: members.length,
        message: `Rotation order created with ${members.length} members and first contribution cycle`,
      };
    });
  }

  /**
   * Assign members to rotation positions
   */
  private async assignMemberPositions(
    client: any,
    rotationOrderId: string,
    members: Member[],
    rotationType: string,
    customOrder?: string[],
  ) {
    let orderedMembers: Member[];

    switch (rotationType) {
      case 'sequential':
        // Use join order (already sorted by joined_at)
        orderedMembers = members;
        break;

      case 'random':
        // Cryptographically random shuffle
        orderedMembers = this.shuffleArray([...members]);
        break;

      case 'merit_based':
        // Calculate merit scores and sort
        const membersWithScores = await Promise.all(
          members.map(async (m) => ({
            ...m,
            meritScore: await this.calculateMeritScore(client, m.id),
          })),
        );
        orderedMembers = membersWithScores.sort(
          (a, b) => b.meritScore - a.meritScore,
        );
        break;

      case 'custom':
        if (!customOrder || customOrder.length !== members.length) {
          throw new BadRequestException(
            'Custom order must include all members',
          );
        }
        // Order by custom array
        orderedMembers = customOrder.map((memberId) => {
          const member = members.find((m) => m.id === memberId);
          if (!member) {
            throw new BadRequestException(`Member ${memberId} not found`);
          }
          return member;
        });
        break;

      default:
        throw new BadRequestException('Invalid rotation type');
    }

    // Insert positions and collect them
    const positions: any[] = [];
    for (let i = 0; i < orderedMembers.length; i++) {
      const member = orderedMembers[i];
      const meritScore =
        rotationType === 'merit_based'
          ? await this.calculateMeritScore(client, member.id)
          : null;

      const result = await client.query(
        `INSERT INTO rotation_positions (
          rotation_order_id, member_id, position, 
          status, merit_score, assigned_at
        ) VALUES ($1, $2, $3, $4, $5, NOW())
        RETURNING *`,
        [
          rotationOrderId,
          member.id,
          i + 1, // 1-indexed positions
          i === 0 ? 'current' : 'pending',
          meritScore,
        ],
      );
      positions.push(result.rows[0]);
    }

    return positions;
  }

  /**
   * Calculate merit score for merit-based rotation
   * Score = (on-time rate * 40) + (activity score * 30) + (penalty-free rate * 30)
   */
  async calculateMeritScore(client: any, memberId: string): Promise<number> {
    // Get contribution stats
    const statsResult = await client.query(
      `SELECT 
        COUNT(*) FILTER (WHERE status = 'completed') as total_contributions,
        COUNT(*) FILTER (WHERE status = 'completed' AND contributed_at <= (
          SELECT due_date FROM contribution_cycles WHERE id = contributions.cycle_id
        )) as on_time_contributions
       FROM contributions
       WHERE member_id = $1`,
      [memberId],
    );

    const stats = statsResult.rows[0];
    const totalContributions = parseInt(stats.total_contributions) || 0;
    const onTimeContributions = parseInt(stats.on_time_contributions) || 0;

    // Calculate on-time rate (40 points)
    const onTimeRate =
      totalContributions > 0
        ? (onTimeContributions / totalContributions) * 40
        : 0;

    // Get activity score (30 points max, normalize from 0-100 scale)
    const memberResult = await client.query(
      'SELECT activity_score FROM chama_members WHERE id = $1',
      [memberId],
    );
    const activityScore = (memberResult.rows[0]?.activity_score || 0) * 0.3;

    // Get penalty-free rate (30 points)
    const penaltyResult = await client.query(
      `SELECT COUNT(*) as penalty_count
       FROM contribution_penalties
       WHERE member_id = $1 AND status = 'pending'`,
      [memberId],
    );
    const penaltyCount = parseInt(penaltyResult.rows[0]?.penalty_count) || 0;
    const penaltyFreeScore =
      totalContributions > 0
        ? Math.max(0, 30 - penaltyCount * 5) // Deduct 5 points per penalty
        : 30;

    return Math.round(onTimeRate + activityScore + penaltyFreeScore);
  }

  /**
   * Get next recipient based on rotation type
   */
  async getNextRecipient(rotationOrderId: string) {
    return this.db.transaction(async (client) => {
      const rotationResult = await client.query(
        'SELECT * FROM rotation_orders WHERE id = $1',
        [rotationOrderId],
      );

      if (rotationResult.rowCount === 0) {
        throw new NotFoundException('Rotation order not found');
      }

      const rotation: RotationOrder = rotationResult.rows[0];

      if (rotation.status !== 'active') {
        throw new BadRequestException('Rotation order is not active');
      }

      // Get next position
      const nextPosition = (rotation.currentPosition || 0) + 1;

      if (nextPosition > rotation.totalPositions) {
        return {
          nextRecipient: null,
          message: 'Rotation completed - all members have received payout',
        };
      }

      const positionResult = await client.query(
        `SELECT rp.*, cm.user_id, u.full_name, u.phone, u.email
         FROM rotation_positions rp
         JOIN chama_members cm ON rp.member_id = cm.id
         JOIN users u ON cm.user_id = u.id
         WHERE rp.rotation_order_id = $1 AND rp.position = $2`,
        [rotationOrderId, nextPosition],
      );

      if (positionResult.rowCount === 0) {
        throw new NotFoundException('Next position not found');
      }

      return {
        nextRecipient: positionResult.rows[0],
        currentPosition: rotation.currentPosition,
        nextPosition,
        totalPositions: rotation.totalPositions,
      };
    });
  }

  /**
   * Skip a rotation position
   */
  async skipPosition(dto: SkipRotationPositionDto) {
    return this.db.transaction(async (client) => {
      const positionResult = await client.query(
        `SELECT rp.*, ro.status as rotation_status
         FROM rotation_positions rp
         JOIN rotation_orders ro ON rp.rotation_order_id = ro.id
         WHERE rp.id = $1`,
        [dto.positionId],
      );

      if (positionResult.rowCount === 0) {
        throw new NotFoundException('Rotation position not found');
      }

      const position: RotationPosition = positionResult.rows[0];

      if (position.status === 'completed') {
        throw new BadRequestException('Cannot skip completed position');
      }

      if (position.status === 'skipped') {
        throw new BadRequestException('Position already skipped');
      }

      // Update position status
      await client.query(
        `UPDATE rotation_positions 
         SET status = 'skipped', skipped_reason = $1, updated_at = NOW()
         WHERE id = $2`,
        [dto.reason || 'Skipped by admin', dto.positionId],
      );

      return {
        message: 'Position skipped successfully',
        position: position.position,
      };
    });
  }

  /**
   * Swap two rotation positions
   */
  async swapPositions(dto: SwapRotationPositionsDto) {
    return this.db.transaction(async (client) => {
      // Get both positions
      const positions = await client.query(
        `SELECT rp.*, ro.status as rotation_status
         FROM rotation_positions rp
         JOIN rotation_orders ro ON rp.rotation_order_id = ro.id
         WHERE rp.id = ANY($1::uuid[])`,
        [[dto.position1Id, dto.position2Id]],
      );

      if (positions.rowCount !== 2) {
        throw new NotFoundException('One or both positions not found');
      }

      const [pos1, pos2] = positions.rows;

      // Validate same rotation
      if (pos1.rotation_order_id !== pos2.rotation_order_id) {
        throw new BadRequestException(
          'Positions must be in the same rotation order',
        );
      }

      // Cannot swap completed positions
      if (pos1.status === 'completed' || pos2.status === 'completed') {
        throw new BadRequestException('Cannot swap completed positions');
      }

      // Swap positions
      await client.query(
        'UPDATE rotation_positions SET position = $1 WHERE id = $2',
        [pos2.position, pos1.id],
      );

      await client.query(
        'UPDATE rotation_positions SET position = $1 WHERE id = $2',
        [pos1.position, pos2.id],
      );

      return {
        message: 'Positions swapped successfully',
        swapped: {
          position1: {
            id: pos1.id,
            oldPosition: pos1.position,
            newPosition: pos2.position,
          },
          position2: {
            id: pos2.id,
            oldPosition: pos2.position,
            newPosition: pos1.position,
          },
        },
      };
    });
  }

  /**
   * Get rotation status for a chama
   */
  async getRotationStatus(chamaId: string) {
    const result = await this.db.query(
      `SELECT 
        ro.*,
        c.name as chama_name,
        (SELECT COUNT(*) FROM rotation_positions WHERE rotation_order_id = ro.id AND status = 'completed') as completed_positions,
        (SELECT COUNT(*) FROM rotation_positions WHERE rotation_order_id = ro.id AND status = 'skipped') as skipped_positions
       FROM rotation_orders ro
       JOIN chamas c ON ro.chama_id = c.id
       WHERE ro.chama_id = $1 AND ro.status = 'active'`,
      [chamaId],
    );

    if (result.rowCount === 0) {
      return {
        hasRotation: false,
        message: 'No active rotation order found',
      };
    }

    const rotation = result.rows[0];

    // Get all positions
    const positionsResult = await this.db.query(
      `SELECT rp.*, cm.user_id, u.full_name, u.phone
       FROM rotation_positions rp
       JOIN chama_members cm ON rp.member_id = cm.id
       JOIN users u ON cm.user_id = u.id
       WHERE rp.rotation_order_id = $1
       ORDER BY rp.position ASC`,
      [rotation.id],
    );

    return {
      hasRotation: true,
      rotation,
      positions: positionsResult.rows,
      progress: {
        current: rotation.current_position || 0,
        total: rotation.total_positions,
        completed: parseInt(rotation.completed_positions),
        skipped: parseInt(rotation.skipped_positions),
        remaining:
          rotation.total_positions -
          parseInt(rotation.completed_positions) -
          parseInt(rotation.skipped_positions),
      },
    };
  }

  /**
   * Advance rotation to next position (called after payout)
   */
  async advanceRotation(rotationOrderId: string, currentPositionId: string) {
    return this.db.transaction(async (client) => {
      // Mark current position as completed
      await client.query(
        `UPDATE rotation_positions 
         SET status = 'completed', completed_at = NOW()
         WHERE id = $1`,
        [currentPositionId],
      );

      // Get rotation
      const rotationResult = await client.query(
        'SELECT * FROM rotation_orders WHERE id = $1',
        [rotationOrderId],
      );

      const rotation: RotationOrder = rotationResult.rows[0];
      const nextPosition = (rotation.currentPosition || 0) + 1;

      // Check if rotation is complete
      if (nextPosition >= rotation.totalPositions) {
        await client.query(
          `UPDATE rotation_orders 
           SET status = 'completed', completed_at = NOW()
           WHERE id = $1`,
          [rotationOrderId],
        );

        return {
          rotationCompleted: true,
          message: 'Rotation completed - all members have received payout',
        };
      }

      // Update current position (trigger will handle this automatically)
      // Mark next position as current
      await client.query(
        `UPDATE rotation_positions 
         SET status = 'current'
         WHERE rotation_order_id = $1 AND position = $2`,
        [rotationOrderId, nextPosition + 1],
      );

      return {
        rotationCompleted: false,
        nextPosition: nextPosition + 1,
        remainingPositions: rotation.totalPositions - nextPosition,
      };
    });
  }

  /**
   * Cryptographically secure array shuffle (Fisher-Yates)
   */
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      // Generate cryptographically random index
      const randomBuffer = randomBytes(4);
      const randomValue = randomBuffer.readUInt32BE(0) / 0xffffffff;
      const j = Math.floor(randomValue * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Get rotation positions for a chama
   */
  async getRotationPositions(chamaId: string) {
    const result = await this.db.query(
      `SELECT rp.*, cm.user_id, u.full_name, u.phone, u.email, ro.rotation_type
       FROM rotation_positions rp
       JOIN rotation_orders ro ON rp.rotation_order_id = ro.id
       JOIN chama_members cm ON rp.member_id = cm.id
       JOIN users u ON cm.user_id = u.id
       WHERE ro.chama_id = $1 AND ro.status = 'active'
       ORDER BY rp.position ASC`,
      [chamaId],
    );

    return result.rows;
  }
}

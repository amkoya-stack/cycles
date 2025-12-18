/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unused-vars */
// Example: How to integrate activity logging into existing services

import {
  ActivityService,
  ActivityCategory,
  ActivityType,
} from '../activity/activity.service';
import {
  NotificationService,
  NotificationChannel,
  NotificationPriority,
} from '../activity/notification.service';

// ============================================
// Example 1: Log Member Role Change
// ============================================
export async function updateMemberRole(
  chamaId: string,
  memberId: string,
  newRole: string,
  adminUserId: string,
  req: any,
) {
  // Get old role
  const member = await this.getMember(memberId);
  const oldRole = member.role;

  // Update role in database
  await this.db.query('UPDATE chama_members SET role = $1 WHERE id = $2', [
    newRole,
    memberId,
  ]);

  // Create activity log with audit trail
  const activityId = await this.activityService.createActivityWithAudit(
    {
      chamaId,
      userId: adminUserId,
      category: ActivityCategory.MEMBERSHIP,
      activityType: ActivityType.ROLE_CHANGED,
      title: `${member.name} promoted to ${newRole}`,
      description: `Role changed from ${oldRole} to ${newRole}`,
      metadata: {
        memberId,
        memberName: member.name,
        oldRole,
        newRole,
      },
      entityType: 'member',
      entityId: memberId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    },
    [{ field: 'role', oldValue: oldRole, newValue: newRole }],
  );

  // Notify all chama members
  await this.notificationService.notifyChamaMembers(
    chamaId,
    {
      channel: NotificationChannel.PUSH,
      priority: NotificationPriority.MEDIUM,
      title: 'Member Role Updated',
      message: `${member.name} is now a ${newRole}`,
      activityLogId: activityId,
    },
    adminUserId, // Don't notify the admin who made the change
  );
}

// ============================================
// Example 2: Log Contribution
// ============================================
export async function recordContribution(
  chamaId: string,
  userId: string,
  amount: number,
  contributionId: string,
  req: any,
) {
  // Record contribution in database
  // ... contribution logic ...

  // Create activity log
  const activityId = await this.activityService.createActivityLog({
    chamaId,
    userId,
    category: ActivityCategory.FINANCIAL,
    activityType: ActivityType.CONTRIBUTION_MADE,
    title: `Contribution of KES ${amount.toLocaleString()}`,
    description: `Member contributed KES ${amount.toLocaleString()} to the chama`,
    metadata: {
      amount,
      contributionId,
      currency: 'KES',
    },
    entityType: 'contribution',
    entityId: contributionId,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  // Notify chama admins only (not all members)
  const admins = await this.getChamaAdmins(chamaId);
  await this.notificationService.queueBulkNotifications(
    admins.map((a) => a.user_id),
    {
      chamaId,
      channel: NotificationChannel.PUSH,
      priority: NotificationPriority.LOW,
      title: 'New Contribution',
      message: `A member contributed KES ${amount.toLocaleString()}`,
      activityLogId: activityId,
    },
  );
}

// ============================================
// Example 3: Log Vote Creation
// ============================================
export async function createVote(
  chamaId: string,
  creatorId: string,
  voteData: any,
  req: any,
) {
  // Create vote in database
  const voteId = await this.insertVote(voteData);

  // Create activity log
  const activityId = await this.activityService.createActivityLog({
    chamaId,
    userId: creatorId,
    category: ActivityCategory.GOVERNANCE,
    activityType: ActivityType.VOTE_CREATED,
    title: `New vote: ${voteData.title}`,
    description: voteData.description,
    metadata: {
      voteId,
      options: voteData.options,
      deadline: voteData.deadline,
    },
    entityType: 'vote',
    entityId: voteId,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  // Notify ALL members (high priority - they need to vote)
  await this.notificationService.notifyChamaMembers(
    chamaId,
    {
      channel: NotificationChannel.PUSH,
      priority: NotificationPriority.HIGH,
      title: 'New Vote Created',
      message: `${voteData.title} - Vote now!`,
      activityLogId: activityId,
      metadata: {
        voteId,
        deadline: voteData.deadline,
      },
    },
    creatorId,
  );
}

// ============================================
// Example 4: Log Settings Change
// ============================================
export async function updateChamaSettings(
  chamaId: string,
  adminUserId: string,
  updates: Record<string, any>,
  req: any,
) {
  // Get old settings
  const oldSettings = await this.getChamaSettings(chamaId);

  // Update settings in database
  await this.updateSettings(chamaId, updates);

  // Get new settings
  const newSettings = await this.getChamaSettings(chamaId);

  // Create audit trail for each changed field
  const changes = Object.keys(updates).map((field) => ({
    field,
    oldValue: oldSettings[field],
    newValue: newSettings[field],
  }));

  // Create activity log with audit
  const activityId = await this.activityService.createActivityWithAudit(
    {
      chamaId,
      userId: adminUserId,
      category: ActivityCategory.GOVERNANCE,
      activityType: ActivityType.SETTINGS_CHANGED,
      title: 'Chama settings updated',
      description: `${changes.length} setting(s) changed`,
      metadata: {
        changedFields: Object.keys(updates),
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    },
    changes,
  );

  // Notify members (medium priority)
  await this.notificationService.notifyChamaMembers(chamaId, {
    channel: NotificationChannel.IN_APP,
    priority: NotificationPriority.MEDIUM,
    title: 'Settings Updated',
    message: 'Chama settings have been updated',
    activityLogId: activityId,
  });
}

// ============================================
// Example 5: System Activities (No User)
// ============================================
export async function completeCycle(chamaId: string, cycleId: string) {
  // Complete cycle logic
  // ...

  // Log system activity (no userId - it's automatic)
  const activityId = await this.activityService.createActivityLog({
    chamaId,
    userId: null, // System action
    category: ActivityCategory.SYSTEM,
    activityType: ActivityType.CYCLE_COMPLETED,
    title: 'Contribution cycle completed',
    description: 'Monthly contribution cycle has been completed',
    metadata: {
      cycleId,
      completedAt: new Date().toISOString(),
    },
    entityType: 'cycle',
    entityId: cycleId,
  });

  // Notify all members (low priority)
  await this.notificationService.notifyChamaMembers(chamaId, {
    channel: NotificationChannel.EMAIL,
    priority: NotificationPriority.LOW,
    title: 'Cycle Completed',
    message: 'The contribution cycle has been completed',
    activityLogId: activityId,
  });
}

// ============================================
// Example 6: Critical Activity with SMS
// ============================================
export async function removeMember(
  chamaId: string,
  memberId: string,
  adminUserId: string,
  reason: string,
  req: any,
) {
  const member = await this.getMember(memberId);
  const chama = await this.getChama(chamaId);
  const chamaName = chama.name;

  // Remove member from database
  await this.db.query(
    'UPDATE chama_members SET status = $1, left_at = NOW() WHERE id = $2',
    ['removed', memberId],
  );

  // Create activity log
  const activityId = await this.activityService.createActivityLog({
    chamaId,
    userId: adminUserId,
    category: ActivityCategory.MEMBERSHIP,
    activityType: ActivityType.MEMBER_REMOVED,
    title: `${member.name} removed from chama`,
    description: reason,
    metadata: {
      memberId,
      memberName: member.name,
      reason,
    },
    entityType: 'member',
    entityId: memberId,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  // Notify the removed member via SMS (critical)
  await this.notificationService.queueNotification({
    userId: member.user_id,
    chamaId,
    channel: NotificationChannel.SMS,
    priority: NotificationPriority.CRITICAL,
    title: 'Removed from Chama',
    message: `You have been removed from ${chamaName}. Reason: ${reason}`,
    activityLogId: activityId,
  });

  // Notify other members via push
  await this.notificationService.notifyChamaMembers(
    chamaId,
    {
      channel: NotificationChannel.PUSH,
      priority: NotificationPriority.HIGH,
      title: 'Member Removed',
      message: `${member.name} has been removed from the chama`,
      activityLogId: activityId,
    },
    adminUserId,
  );
}

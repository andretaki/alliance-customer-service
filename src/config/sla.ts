import { NOTIFICATION_EMAILS } from '@/config/test-data';

// SLA Configuration for different request types
export const SLA_MINUTES: Record<string, number> = {
  quote: 120,     // 2 hours
  coa: 60,        // 1 hour
  freight: 240,   // 4 hours
  claim: 1440,    // 1 day (24 hours)
  other: 240      // 4 hours default
};

// Escalation thresholds (percentage of SLA)
export const ESCALATION_THRESHOLDS = {
  warning: 0.75,  // 75% of SLA time
  urgent: 0.9,    // 90% of SLA time
  breach: 1.0     // 100% of SLA time
};

// Email recipients for escalations - using configured emails
export const ESCALATION_RECIPIENTS = {
  warning: [NOTIFICATION_EMAILS.escalation.supervisor],
  urgent: [NOTIFICATION_EMAILS.escalation.supervisor, NOTIFICATION_EMAILS.escalation.manager],
  breach: [NOTIFICATION_EMAILS.escalation.supervisor, NOTIFICATION_EMAILS.escalation.manager, NOTIFICATION_EMAILS.escalation.coo]
};

// SLA business hours (optional - if you want to exclude nights/weekends)
export const BUSINESS_HOURS = {
  enabled: false, // Set to true if you want to only count business hours
  start: 8,      // 8 AM
  end: 18,       // 6 PM
  timezone: 'America/Chicago',
  excludeWeekends: true
};
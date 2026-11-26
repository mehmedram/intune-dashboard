export const CLASSIFICATIONS = {
  security_update: 'Security Update',
  cumulative_update: 'Cumulative Update',
  feature_update: 'Feature Update',
  servicing_stack_update: 'Servicing Stack Update',
  preview_update: 'Preview Update',
  out_of_band_update: 'Out-of-band Update',
  hotfix: 'Hotfix',
  definition_update: 'Definition Update',
  driver_update: 'Driver Update',
  service_announcement: 'Service Announcement',
  feature_retirement: 'Feature Retirement',
  product_lifecycle_change: 'Product Lifecycle Change',
  other: 'Other',
} as const

export const SEVERITIES = {
  critical: 'Critical',
  important: 'Important',
  moderate: 'Moderate',
  low: 'Low',
  informational: 'Informational',
} as const

export const CVE_SEVERITIES = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  none: 'None',
  unknown: 'Unknown',
} as const

export const DEPLOYMENT_STATUSES = {
  not_reviewed: 'Not Reviewed',
  under_assessment: 'Under Assessment',
  testing: 'Testing',
  approved: 'Approved',
  scheduled: 'Scheduled',
  deploying: 'Deploying',
  deployed: 'Successfully Deployed',
  failed: 'Failed',
  deferred: 'Deferred',
  rejected: 'Rejected',
} as const

export const REPORT_STATUSES = {
  draft: 'Draft',
  under_review: 'Under Review',
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  rejected: 'Rejected',
  published: 'Published',
  archived: 'Archived',
} as const

export const RISK_LEVELS = { low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical' } as const

export const RECOMMENDATIONS = {
  deploy_immediately: 'Deploy Immediately',
  prioritize: 'Prioritize',
  next_maintenance_window: 'Deploy During Next Maintenance Window',
  test_before_deployment: 'Test Before Deployment',
  monitor: 'Monitor',
  defer: 'Defer',
  not_applicable: 'Not Applicable',
} as const

export const ENVIRONMENTS = {
  development: 'Development',
  test: 'Test',
  staging: 'Staging',
  production: 'Production',
} as const

export const TESTING_RESULTS = { not_tested: 'Not Tested', passed: 'Passed', failed: 'Failed', partial: 'Partial' } as const
export const ROLLBACK_STATUSES = { not_required: 'Not Required', planned: 'Planned', performed: 'Performed', failed: 'Failed' } as const

export const REBOOT = { yes: 'Yes', no: 'No', maybe: 'May be required', unknown: 'Unknown' } as const

export const SOURCE_TYPES = {
  manual: 'Manual entry',
  msrc: 'Microsoft MSRC',
  graph_message_center: 'M365 Message Center',
  graph_service_health: 'M365 Service Health',
  windows_release_health: 'Windows Release Health',
  update_catalog: 'Microsoft Update Catalog',
  other: 'Other source',
} as const

export const VERIFICATION = { unverified: 'Unverified', verified: 'Verified', disputed: 'Disputed' } as const

export const EXPLOITATION = {
  not_known: 'No known exploitation',
  publicly_disclosed: 'Publicly disclosed',
  exploitation_more_likely: 'Exploitation more likely',
  exploited: 'Exploited in the wild',
} as const

export const EXPOSURE = {
  not_assessed: 'Not assessed',
  not_affected: 'Not affected',
  affected: 'Product in use (exposure unconfirmed)',
  confirmed_exposed: 'Confirmed exposure',
} as const

export const REMEDIATION = {
  open: 'Open',
  in_progress: 'In progress',
  mitigated: 'Mitigated',
  remediated: 'Remediated',
  risk_accepted: 'Risk accepted',
} as const

export function label<T extends Record<string, string>>(map: T, key: string | null | undefined, fallback = '—') {
  if (!key) return fallback
  return (map as Record<string, string>)[key] ?? key
}

export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'critical'

export function severityTone(s?: string | null): Tone {
  switch (s) {
    case 'critical':
      return 'critical'
    case 'important':
    case 'high':
      return 'danger'
    case 'moderate':
    case 'medium':
      return 'warning'
    case 'low':
      return 'info'
    default:
      return 'neutral'
  }
}

export function statusTone(s?: string | null): Tone {
  switch (s) {
    case 'approved':
    case 'published':
    case 'deployed':
    case 'remediated':
    case 'ok':
    case 'success':
    case 'sent':
    case 'connected':
    case 'verified':
    case 'passed':
      return 'success'
    case 'rejected':
    case 'failed':
    case 'error':
    case 'disputed':
    case 'exploited':
    case 'confirmed_exposed':
      return 'danger'
    case 'pending_approval':
    case 'under_review':
    case 'under_assessment':
    case 'testing':
    case 'scheduled':
    case 'deploying':
    case 'in_progress':
    case 'needs_configuration':
    case 'running':
    case 'pending':
    case 'partial':
    case 'mitigated':
      return 'warning'
    case 'draft':
    case 'open':
    case 'affected':
      return 'info'
    default:
      return 'neutral'
  }
}

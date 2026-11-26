'use client'

import { ActionForm, SubmitButton } from '@/components/app/action-form'
import { TextAreaField, SelectField } from '@/components/app/form-fields'
import { RISK_LEVELS, RECOMMENDATIONS } from '@/lib/constants'
import type { ActionResult } from '@/lib/action-result'

const FIELDS: [string, string][] = [
  ['security_impact', 'Security impact'],
  ['infrastructure_impact', 'Infrastructure impact'],
  ['application_compatibility', 'Application compatibility'],
  ['user_impact', 'User impact'],
  ['service_availability', 'Service availability'],
  ['reboot_requirements', 'Reboot requirements'],
  ['backup_requirements', 'Backup requirements'],
  ['maintenance_window', 'Maintenance window'],
  ['prerequisites', 'Prerequisites'],
  ['testing_requirements', 'Testing requirements'],
  ['rollback_plan', 'Rollback plan'],
  ['deployment_strategy', 'Deployment strategy'],
  ['technical_recommendation', 'Technical recommendation'],
  ['notes_html', 'Engineering notes'],
]

export function AssessmentForm({
  action,
  values,
  readOnly,
}: {
  action: (prev: unknown, fd: FormData) => Promise<ActionResult>
  values: Record<string, unknown>
  readOnly: boolean
}) {
  const v = (k: string) => (values[k] as string | null | undefined) ?? null
  return (
    <ActionForm action={action} className="group flex flex-col gap-4">
      <fieldset disabled={readOnly} className="grid gap-4 rounded-lg border bg-card p-4 md:grid-cols-2">
        <SelectField name="overall_risk" label="Overall risk" options={RISK_LEVELS} allowEmpty="Not assessed" defaultValue={v('overall_risk')} />
        <SelectField name="recommendation" label="Recommendation" options={RECOMMENDATIONS} allowEmpty="Not set" defaultValue={v('recommendation')} />
        {FIELDS.map(([name, lbl]) => (
          <TextAreaField key={name} name={name} label={lbl} defaultValue={v(name)} />
        ))}
      </fieldset>
      {!readOnly && (
        <div className="flex justify-end">
          <SubmitButton>Save assessment</SubmitButton>
        </div>
      )}
    </ActionForm>
  )
}

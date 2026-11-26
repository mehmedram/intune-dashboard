'use client'

import { ActionForm, SubmitButton } from '@/components/app/action-form'
import { TextField, TextAreaField, SelectField } from '@/components/app/form-fields'
import { StatusBadge } from '@/components/app/status-badge'
import { DEPLOYMENT_STATUSES, ENVIRONMENTS, TESTING_RESULTS, ROLLBACK_STATUSES, label, statusTone } from '@/lib/constants'
import type { ActionResult } from '@/lib/action-result'

export function DeploymentForm({
  environment,
  action,
  values,
  readOnly,
}: {
  environment: keyof typeof ENVIRONMENTS
  action: (prev: unknown, fd: FormData) => Promise<ActionResult>
  values: Record<string, unknown>
  readOnly: boolean
}) {
  const v = (k: string) => (values[k] as string | null | undefined) ?? null
  return (
    <ActionForm action={action} className="group flex flex-col rounded-lg border bg-card">
      <input type="hidden" name="environment" value={environment} />
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="text-sm font-semibold">{ENVIRONMENTS[environment]}</h3>
        <StatusBadge tone={statusTone(v('status'))}>{label(DEPLOYMENT_STATUSES, v('status') ?? 'not_reviewed')}</StatusBadge>
      </div>
      <fieldset disabled={readOnly} className="grid gap-3 p-4 sm:grid-cols-2">
        <SelectField name="status" label="Status" options={DEPLOYMENT_STATUSES} defaultValue={v('status') ?? 'not_reviewed'} />
        <TextField name="deployment_date" label="Deployment date" type="date" defaultValue={v('deployment_date')} />
        <TextField name="assigned_engineer" label="Assigned engineer" defaultValue={v('assigned_engineer')} />
        <SelectField name="testing_result" label="Testing result" options={TESTING_RESULTS} allowEmpty="—" defaultValue={v('testing_result')} />
        <SelectField name="rollback_status" label="Rollback" options={ROLLBACK_STATUSES} allowEmpty="—" defaultValue={v('rollback_status')} />
        <TextField name="final_outcome" label="Final outcome" defaultValue={v('final_outcome')} />
        <TextAreaField name="notes" label="Notes" rows={2} defaultValue={v('notes')} className="sm:col-span-2" />
      </fieldset>
      {!readOnly && (
        <div className="flex justify-end border-t px-4 py-3">
          <SubmitButton variant="outline">Save {ENVIRONMENTS[environment].toLowerCase()}</SubmitButton>
        </div>
      )}
    </ActionForm>
  )
}

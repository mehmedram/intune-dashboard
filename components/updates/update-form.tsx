'use client'

import { ActionForm, SubmitButton } from '@/components/app/action-form'
import { TextField, TextAreaField, SelectField } from '@/components/app/form-fields'
import { CLASSIFICATIONS, SEVERITIES, REBOOT, DEPLOYMENT_STATUSES, VERIFICATION } from '@/lib/constants'
import type { ActionResult } from '@/lib/action-result'

type UpdateValues = Partial<Record<string, string | null>>

export function UpdateForm({
  action,
  products,
  values = {},
  cves = '',
  submitLabel,
  redirect,
}: {
  action: (prev: unknown, fd: FormData) => Promise<ActionResult<{ id: string } | undefined>>
  products: { id: string; name: string; category: string }[]
  values?: UpdateValues
  cves?: string
  submitLabel: string
  redirect?: boolean
}) {
  return (
    <ActionForm action={action} redirectTo={redirect ? (id) => `/updates/${id}` : undefined} className="group flex flex-col gap-6">
      <div className="grid gap-4 rounded-lg border bg-card p-4 md:grid-cols-2">
        <TextField name="title" label="Title" required defaultValue={values.title} className="md:col-span-2" />
        <SelectField
          name="product_id"
          label="Product"
          allowEmpty="Not specified"
          defaultValue={values.product_id}
          options={products.map((p) => ({ value: p.id, label: `${p.name} (${p.category})` }))}
        />
        <TextField name="kb_number" label="KB number" placeholder="KB5031234" defaultValue={values.kb_number} />
        <TextField name="release_date" label="Release date" type="date" defaultValue={values.release_date} />
        <TextField name="build_number" label="Build number" defaultValue={values.build_number} />
        <TextField name="version" label="Version" defaultValue={values.version} />
        <TextField name="source_url" label="Official source URL" type="url" defaultValue={values.source_url} />
        <SelectField name="classification" label="Classification" options={CLASSIFICATIONS} defaultValue={values.classification ?? 'other'} />
        <SelectField name="severity" label="Severity" options={SEVERITIES} defaultValue={values.severity ?? 'informational'} />
        <SelectField name="reboot_required" label="Reboot required" options={REBOOT} defaultValue={values.reboot_required ?? 'unknown'} />
        <SelectField name="deployment_status" label="Deployment status" options={DEPLOYMENT_STATUSES} defaultValue={values.deployment_status ?? 'not_reviewed'} />
        <SelectField name="verification_status" label="Verification" options={VERIFICATION} defaultValue={values.verification_status ?? 'unverified'} />
        <TextField name="cves" label="Associated CVEs" placeholder="CVE-2026-12345, CVE-2026-23456" defaultValue={cves} hint="Comma or space separated. New CVEs will be enriched on the next NVD sync." />
      </div>
      <div className="grid gap-4 rounded-lg border bg-card p-4 md:grid-cols-2">
        <TextAreaField name="description" label="Description" rows={5} defaultValue={values.description} className="md:col-span-2" />
        <TextAreaField name="known_issues" label="Known issues" defaultValue={values.known_issues} />
        <TextAreaField name="prerequisites" label="Prerequisites" defaultValue={values.prerequisites} />
        <TextAreaField name="user_impact" label="User impact" defaultValue={values.user_impact} />
        <TextAreaField name="infrastructure_impact" label="Infrastructure impact" defaultValue={values.infrastructure_impact} />
        <TextAreaField name="deployment_recommendation" label="Deployment recommendation" defaultValue={values.deployment_recommendation} className="md:col-span-2" />
      </div>
      <div className="flex justify-end">
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </ActionForm>
  )
}

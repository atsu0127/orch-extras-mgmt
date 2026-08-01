import type { ChangeEvent } from 'react'
import type { VenueOption } from '../venues/queries'
import { Field } from './admin-form'
import { AppSelect } from './form-controls'

type VenueSelectFieldProps = {
  id: string
  label: string
  value: string
  venues: ReadonlyArray<VenueOption>
  onChange: (venueId: string) => void
  error?: string | undefined
}

/** 会場の任意選択。未設定とヒント文言を管理画面で揃える */
export function VenueSelectField({
  id,
  label,
  value,
  venues,
  onChange,
  error,
}: VenueSelectFieldProps) {
  return (
    <Field
      id={id}
      label={label}
      hint={venues.length === 0 ? '会場を登録すると選べます' : undefined}
      error={error}
    >
      <AppSelect
        id={id}
        value={value}
        onChange={(event: ChangeEvent<HTMLSelectElement>) =>
          onChange(event.target.value)
        }
      >
        <option value="">未設定</option>
        {venues.map((venue) => (
          <option key={venue.id} value={venue.id}>
            {venue.name}
          </option>
        ))}
      </AppSelect>
    </Field>
  )
}

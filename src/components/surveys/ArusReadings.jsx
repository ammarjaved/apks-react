import { useEffect, useRef } from 'react'
import { imageUrl } from '../../utils/imageUrl'

/**
 * The pole form's leakage-current readings — a repeatable group of rows.
 *
 * A pole takes several readings (one per phase or feeder leg), so they are child
 * rows in tbl_arus rather than two columns on the pole. Each row is
 * `{ id?, reading, leakage_current }` and carries its own photos.
 *
 * The whole group is saved in one call by SurveyForm; see `arusApi.replace`.
 * Rows are held in the parent's state so a save can read them, and so the two
 * photo slots on a row can be filled before the row exists on the server.
 *
 * **A row's `id` is what holds its photos.** Editing a row must never discard
 * its id — `survey_images` points at arus rows by id with no foreign key, so a
 * row that comes back without one is created afresh and the photos on the old
 * row are orphaned. Removing a row here only drops it from the list; the save
 * then omits it, and the server soft-deletes it. Nothing calls DELETE per row,
 * so a removal can still be undone by cancelling the form.
 */

// The two image types the API allows on a reading. They are no longer offered on
// the pole itself — GET /image-types/by-survey/tbl_savr no longer returns them.
const PHOTO_SLOTS = [
  { code: 'image_pole_no', label: 'Pole No / Equipment' },
  { code: 'eqp_reading', label: 'Equipment Reading' },
]

let rowCounter = 0
export function newArusRow() {
  // A client-side key, not an id: it never goes to the server. React needs a
  // stable key per row, and a new row has no id to use until it is saved.
  rowCounter += 1
  return { key: `new-${rowCounter}`, id: null, reading: '', leakage_current: false, photos: {}, photo_count: 0 }
}

/** Turn what GET /savr/{id} embedded as `arus` into editable rows. */
export function arusRowsFromRecord(record) {
  return (record?.arus || []).map((r) => ({
    key: r.id,
    id: r.id,
    reading: r.reading ?? '',
    leakage_current: Boolean(r.leakage_current),
    photos: {},
    photo_count: r.photo_count ?? 0,
  }))
}

export default function ArusReadings({ rows, onChange, disabled, onViewImage }) {
  // Object URLs for freshly picked files have to be released by hand, or every
  // re-pick leaks one for as long as the tab is open.
  const previews = useRef(new Map())
  useEffect(() => () => {
    for (const { url } of previews.current.values()) URL.revokeObjectURL(url)
    previews.current.clear()
  }, [])

  /**
   * A slot holds one of:
   *   - `null` / absent           nothing here
   *   - a `File`                  freshly picked, not uploaded yet
   *   - `{ id, url }`             already stored against this reading
   *
   * Only the File case needs an object URL; a stored photo is fetched from the
   * API host. Getting this wrong is what made saved leakage photos invisible in
   * the edit form — the slot held `{ id, url }` and nothing rendered it.
   */
  const previewFor = (row, code) => {
    const val = row.photos?.[code]
    if (!val) return null
    if (!(val instanceof File)) return imageUrl(val.url)
    const key = `${row.key}:${code}`
    const existing = previews.current.get(key)
    if (existing?.file === val) return existing.url
    if (existing) URL.revokeObjectURL(existing.url)
    const url = URL.createObjectURL(val)
    previews.current.set(key, { file: val, url })
    return url
  }

  const isPending = (row, code) => row.photos?.[code] instanceof File

  const setRow = (index, patch) => {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  const addRow = () => onChange([...rows, newArusRow()])

  const removeRow = (index) => onChange(rows.filter((_, i) => i !== index))

  const leaking = rows.filter((r) => r.leakage_current).length

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-gray-500">
          {rows.length === 0
            ? 'No readings recorded on this pole.'
            : `${rows.length} reading${rows.length === 1 ? '' : 's'}${leaking ? ` · ${leaking} leaking` : ''}`}
          <span className="text-gray-400">
            {' '}· accepted or rejected with the pole, not separately
          </span>
        </p>
        <button type="button" onClick={addRow} disabled={disabled} className="btn-secondary btn-sm">
          + Add reading
        </button>
      </div>

      {rows.map((row, index) => (
        <div key={row.key} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <div className="flex items-start gap-3">
            <span className="mt-2 text-xs font-medium text-gray-400 w-5 flex-shrink-0">
              {index + 1}
            </span>

            <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Reading</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. 3.5 A"
                  value={row.reading ?? ''}
                  disabled={disabled}
                  onChange={(e) => setRow(index, { reading: e.target.value })}
                />
              </div>

              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-gray-300 text-primary-600"
                    checked={Boolean(row.leakage_current)}
                    disabled={disabled}
                    onChange={(e) => setRow(index, { leakage_current: e.target.checked })}
                  />
                  Leakage detected
                </label>
              </div>

              <div className="sm:col-span-2 grid grid-cols-2 gap-3">
                {PHOTO_SLOTS.map((slot) => {
                  const preview = previewFor(row, slot.code)
                  return (
                    <div key={slot.code}>
                      <label className="label text-xs">{slot.label}</label>
                      {preview ? (
                        <div className="relative">
                          <img
                            src={preview}
                            alt={slot.label}
                            onClick={() => onViewImage?.(preview, `${slot.label} — reading ${index + 1}`)}
                            className="w-full h-24 object-cover rounded-lg border border-gray-200 cursor-zoom-in"
                          />
                          <button
                            type="button"
                            disabled={disabled}
                            onClick={() => setRow(index, { photos: { ...row.photos, [slot.code]: null } })}
                            className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-5 h-5 text-xs leading-none"
                            aria-label={`Remove ${slot.label}`}
                          >
                            &times;
                          </button>
                          {isPending(row, slot.code)
                            ? <p className="text-xs text-primary-600 mt-0.5">Uploads on save</p>
                            : <p className="text-xs text-gray-400 mt-0.5">Saved</p>}
                        </div>
                      ) : (
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          disabled={disabled}
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) setRow(index, { photos: { ...row.photos, [slot.code]: file } })
                          }}
                          className="block w-full text-xs text-gray-500 file:mr-2 file:py-1.5 file:px-2 file:rounded file:border-0 file:text-xs file:bg-gray-200 file:text-gray-700"
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={() => removeRow(index)}
              disabled={disabled}
              className="mt-6 text-red-600 hover:text-red-700 text-sm px-2 flex-shrink-0"
              aria-label={`Remove reading ${index + 1}`}
            >
              Remove
            </button>
          </div>

          <p className="text-xs text-gray-400 mt-2 pl-8">
            {/* Count the slots on screen. `photo_count` from the server is a
                snapshot taken before this form's uploads, so trusting it made a
                just-uploaded photo read as "0 photos attached". */}
            {(() => {
              const filled = PHOTO_SLOTS.filter((s) => row.photos?.[s.code]).length
              const pending = PHOTO_SLOTS.filter((s) => isPending(row, s.code)).length
              if (!row.id && filled === 0) return 'New reading — saved with the form'
              return `${filled} of ${PHOTO_SLOTS.length} photos`
                + (pending ? ` · ${pending} waiting to upload` : '')
            })()}
          </p>
        </div>
      ))}
    </div>
  )
}

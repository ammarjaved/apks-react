import { useState, useEffect, useMemo, useRef } from 'react'
import { surveyApi, geometryApi, arusApi, assetLinkApi } from '../../api/surveys'
import { lookupApi } from '../../api/lookups'
import { workPackageApi } from '../../api/workpackages'
import { imageApi } from '../../api/images'
import { errorMessage } from '../../utils/apiError'
import FormField from '../ui/FormField'
import ArusReadings, { arusRowsFromRecord } from './ArusReadings'
import ImageLightbox from '../ui/ImageLightbox'
import StatusBadge from '../ui/StatusBadge'
import { imageUrl } from '../../utils/imageUrl'
import MapView from '../map/MapView'
import { useAuth } from '../../context/AuthContext'
import { defectOptions } from '../../config/surveyConfigs'

export default function SurveyForm({ config, record, onSave, onCancel, onQaAction }) {
  const { user } = useAuth()
  const isEdit = !!record?.id
  const isWizard = !!config.isWizard
  const isAdmin = user?.is_admin || user?.roles?.includes('admin')
  const userBaId = isAdmin ? null : user?.ba_id

  const [bas, setBas] = useState([])

  // Fetch BAs once. /ba carries ppb_zone + region, which /users/bas omits.
  useEffect(() => {
    lookupApi.listBA({ page_size: 100 }).then((d) => setBas(d.items || [])).catch(() => {})
  }, [])

  // Build BA dropdown options
  const baOptions = useMemo(() => [
    { value: '', label: '— Select BA —' },
    ...bas.map((ba) => ({
      value: ba.id,
      label: ba.business_area || ba.short_name || ba.label || ba.id,
    })),
  ], [bas])

  // Find zone from BA
  const zoneFromBa = (baId) => {
    const ba = bas.find((b) => b.id === baId)
    return ba?.ppb_zone || ba?.region || null
  }

  const [formData, setFormData] = useState(() => {
    const defaults = {}
    const collectFields = (sections) => {
      sections.forEach((section) => {
        section.fields.forEach((field) => {
          // Image slots live in their own state — a survey record has no image
          // columns, and an image slot may share a name with a real column
          // (e.g. Height Clearance has both an `other` checkbox and an
          // `other` image type).
          if (field.type === 'image') return
          if (field.hidden) return
          // An asset picker owns two columns — the id and the type that says which
          // table the id is in. Seed both, or an edit that touches only one end
          // would send an id whose type never came along.
          if (field.type === 'asset-select' && field.typeField) {
            defaults[field.typeField] = record?.[field.typeField] ?? null
          }
          if (field.type === 'span-group') defaults[field.name] = record?.[field.name] || {}
          else if (field.type === 'checkbox') defaults[field.name] = record?.[field.name] ?? false
          else defaults[field.name] = record?.[field.name] ?? null
        })
      })
    }
    if (isWizard) {
      config.wizardSteps.forEach((step) => collectFields(step.sections))
    } else {
      collectFields(config.sections)
    }

    // Auto BA from user if not admin
    const userBa = user?.ba_id || null
    return {
      ...defaults,
      latitude: record?.geometry?.latitude ?? null,
      longitude: record?.geometry?.longitude ?? null,
      geometry_id: record?.geometry_id || null,
      ba_id: record?.ba_id || userBa,
      zone: record?.zone || user?.zone || null,
      cycle: record?.cycle || 1,
      workpackage_id: record?.workpackage_id || null,
      workpackage_name: record?.workpackage_name || null,
      workpackage_resolved: Boolean(record?.workpackage_id),
    }
  })

  const [packages, setPackages] = useState([])
  const [wpPreview, setWpPreview] = useState({ loading: false, ambiguous: false, unmatched: false })

  useEffect(() => {
    const params = { page_size: 200 }
    if (formData.ba_id) params.ba_id = formData.ba_id
    workPackageApi.list(params).then(setPackages).catch(() => {})
  }, [formData.ba_id])

  useEffect(() => {
    if (!formData.workpackage_id || formData.workpackage_name) return
    workPackageApi.get(formData.workpackage_id).then((wp) => {
      setFormData((prev) => ({ ...prev, workpackage_name: wp.package_name || null }))
    }).catch(() => {})
  }, [formData.workpackage_id, formData.workpackage_name])

  /**
   * Image slots, keyed by field name (which doubles as the API `image_type`).
   * A slot holds either an existing `{ id, url }` from the record or a freshly
   * picked `File`.
   */
  const [imageData, setImageData] = useState(() => {
    const slots = {}
    for (const img of record?.images || []) {
      // One photo per slot. A second upload of the same type (the mobile app
      // can send two `substation_2`s) goes to `extraImages` below instead.
      if (!slots[img.image_type]) slots[img.image_type] = { id: img.id, url: img.image_url }
    }
    return slots
  })

  /**
   * Photos on the record that have no slot of their own: a duplicate of a
   * slot type, or a type this form has no field for. They used to be invisible
   * in edit (while the detail view listed them), so the counts disagreed. They
   * show in an "Additional Photos" strip where they can be dragged into an
   * empty slot or deleted. Keys `extra:<id>` share the slot drag channel.
   */
  const EXTRA_PREFIX = 'extra:'
  const [extraImages, setExtraImages] = useState(() => {
    const seen = new Set()
    const extras = []
    for (const img of record?.images || []) {
      if (seen.has(img.image_type)) {
        extras.push({ id: img.id, url: img.image_url, type: img.image_type, label: img.image_label })
      } else {
        seen.add(img.image_type)
      }
    }
    return extras
  })

  const handleImageChange = (name, file) => {
    setImageData((prev) => ({ ...prev, [name]: file }))
  }

  const [draggingImage, setDraggingImage] = useState(null)
  const [extraBusy, setExtraBusy] = useState(null)

  const handleExtraDelete = async (img) => {
    if (!window.confirm('Delete this photo from the record? This cannot be undone.')) return
    setExtraBusy(img.id)
    try {
      await imageApi.delete(img.id)
      setExtraImages((prev) => prev.filter((e) => e.id !== img.id))
      setError('')
    } catch (err) {
      setError(errorMessage(err, 'Could not delete the photo.'))
    } finally {
      setExtraBusy(null)
    }
  }

  const slotHasImage = (val) => {
    if (!val) return false
    if (val instanceof File) return true
    if (typeof val === 'string') return Boolean(val)
    return Boolean(val.url || val.id)
  }

  const handleImageMove = async (fromName, toName) => {
    if (!fromName || !toName || fromName === toName) return
    if (toName.startsWith(EXTRA_PREFIX)) return

    // From the "Additional Photos" strip into an empty slot.
    if (fromName.startsWith(EXTRA_PREFIX)) {
      const extra = extraImages.find((e) => e.id === fromName.slice(EXTRA_PREFIX.length))
      if (!extra || slotHasImage(imageData[toName])) return
      try {
        await imageApi.updateType(extra.id, toName)
      } catch (err) {
        setError(errorMessage(err, 'Could not move the photo to that slot. The destination may already have an image.'))
        return
      }
      setError('')
      setExtraImages((prev) => prev.filter((e) => e.id !== extra.id))
      setImageData((prev) => ({ ...prev, [toName]: { id: extra.id, url: extra.url } }))
      return
    }

    const source = imageData[fromName]
    if (!slotHasImage(source) || slotHasImage(imageData[toName])) return

    if (!(source instanceof File) && source?.id) {
      try {
        await imageApi.updateType(source.id, toName)
      } catch (err) {
        setError(errorMessage(err, 'Could not move the photo to that slot. The destination may already have an image.'))
        return
      }
    }

    setError('')
    setImageData((prev) => {
      const next = { ...prev }
      next[toName] = prev[fromName]
      delete next[fromName]
      return next
    })
  }

  /**
   * Leakage readings, when this form has an 'arus' section (SAVR only).
   *
   * GET /savr/{id} embeds them, so there is no second fetch. They are child rows
   * with their own save call, not columns on the record — keeping them out of
   * `formData` stops them being posted to the survey endpoint, which would drop
   * them silently.
   */
  /** The required `savr-select` field, when this survey has one (FFW, height clearance). */
  const [requiresPole, poleFieldLabel, poleStepIndex] = useMemo(() => {
    const steps = isWizard ? config.wizardSteps : [{ sections: config.sections }]
    for (const [idx, step] of steps.entries()) {
      for (const sec of step.sections || []) {
        for (const f of sec.fields || []) {
          if (f.type === 'savr-select' && f.required) return [true, f.label, idx]
        }
      }
    }
    return [false, null, 0]
  }, [config, isWizard])

  const hasArus = useMemo(() => {
    const steps = isWizard ? config.wizardSteps : [{ sections: config.sections }]
    return steps.some((step) => (step.sections || []).some((sec) => sec.component === 'arus'))
  }, [config, isWizard])
  const [arusRows, setArusRows] = useState(() => arusRowsFromRecord(record))
  /**
   * The reading photos as the SERVER last had them, keyed arusId -> slot -> {id,url}.
   * Needed to tell a slot the user left alone from one they replaced or cleared,
   * so a replaced photo's old row can be deleted instead of piling up.
   */
  const arusStoredPhotos = useRef({})

  /**
   * Pull each reading's photos into its slots.
   *
   * GET /savr/{id} embeds the readings but only a `photo_count`, not the photos
   * themselves — so without this the edit form showed empty slots for readings
   * that already had pictures, which reads as "the upload never happened".
   * One bulk request, not one per row.
   */
  useEffect(() => {
    const ids = arusRowsFromRecord(record).map((r) => r.id).filter(Boolean)
    if (!hasArus || ids.length === 0) return
    let cancelled = false
    arusApi.imagesFor(ids)
      .then((byRow) => {
        if (cancelled) return
        arusStoredPhotos.current = byRow
        setArusRows((rows) => rows.map((r) => (
          // Anything the user has already picked wins over what the server had,
          // in case this resolves after they started editing.
          r.id ? { ...r, photos: { ...(byRow[r.id] || {}), ...r.photos } } : r
        )))
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [record?.id, hasArus])

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [dropMode, setDropMode] = useState(!(isEdit || config.attachToPole))
  const [activeTab, setActiveTab] = useState('form')
  const [wizardStep, setWizardStep] = useState(0)
  // Index into `gallery` for the side panel, and for the full-screen lightbox.
  const [viewerIndex, setViewerIndex] = useState(null)
  const [lightboxIndex, setLightboxIndex] = useState(null)
  const [qaBusy, setQaBusy] = useState(false)
  const [arusViewer, setArusViewer] = useState(null)
  /**
   * The span's two ends as the API resolved them, plus the measured length.
   *
   * GET /height-clearance/{id}/span labels an asset that may sit outside the
   * pickers' search radius, and reports `exists: false` for one since deleted —
   * a polymorphic reference has no foreign key behind it, so that happens.
   */
  const [span, setSpan] = useState(null)
  const spanFields = useMemo(() => {
    const steps = isWizard ? config.wizardSteps : [{ sections: config.sections }]
    return steps.flatMap((st) => (st.sections || []).flatMap((sec) =>
      (sec.fields || []).filter((f) => f.type === 'asset-select')))
  }, [config, isWizard])
  const hasSpanPickers = spanFields.length > 0

  useEffect(() => {
    if (!hasSpanPickers || !record?.id) { setSpan(null); return }
    let cancelled = false
    assetLinkApi.span(record.id)
      .then((d) => { if (!cancelled) setSpan(d) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [hasSpanPickers, record?.id])

  const handleChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }))
    // Auto-set zone when ba_id changes
    if (name === 'ba_id') {
      const zone = zoneFromBa(value)
      if (zone) setFormData((prev) => ({ ...prev, zone }))
    }
  }

  /**
   * A new position for the point, from either a click in drop mode or a drag of
   * the marker. The work package is resolved again from the new coordinates —
   * moving an asset can move it into a different package, and the record must
   * not keep the old one.
   */
  const handleMapClick = ({ lng, lat }) => {
    if (config.attachToPole) return
    handleChange('longitude', lng)
    handleChange('latitude', lat)
    setDropMode(false)
    setWpPreview({ loading: true, ambiguous: false, unmatched: false })
    workPackageApi
      .atPoint(lat, lng)
      .then((result) => {
        const matched = Boolean(result.matched && result.workpackage_id)
        setFormData((prev) => ({
          ...prev,
          workpackage_id: matched ? result.workpackage_id : null,
          workpackage_name: matched ? result.workpackage_name : null,
          workpackage_resolved: matched,
        }))
        setWpPreview({
          loading: false,
          ambiguous: Boolean(result.ambiguous),
          unmatched: !matched,
          candidates: result.candidates || [],
        })
      })
      .catch(() => {
        setFormData((prev) => ({
          ...prev,
          workpackage_id: null,
          workpackage_name: null,
          workpackage_resolved: false,
        }))
        setWpPreview({ loading: false, ambiguous: false, unmatched: true })
      })
  }

  /**
   * Save the pole's leakage readings, then any photos picked for them.
   * Returns an error message, or '' when everything landed.
   *
   * One PUT carries the whole set. Every row the user kept goes back **with its
   * id**, which is what keeps its photos: survey_images points at arus rows by
   * id and no foreign key enforces it, so a row resent without its id becomes a
   * different row and the photos on the old one are orphaned — still on the
   * server, attached to nothing. Rows the user removed are simply absent, and
   * the server soft-deletes them. `arusApi.replace` does the id mapping; do not
   * strip ids on the way in.
   */
  const saveArusReadings = async (savrId) => {
    /*
     * Brand-new rows are created one at a time FIRST, so each comes back with
     * its own id and its photos can be attached to the right reading.
     *
     * The tempting shortcut — one PUT, then assume the ids in the response that
     * we did not send are the new rows in the order we sent them — is wrong.
     * The endpoint orders by (created_at, id), and rows inserted in the same
     * flush share an identical created_at, so the tiebreak is a random uuid4:
     * send ["3.5 A", "7.2 A"] and the reply can come back ["7.2 A", "3.5 A"].
     * Photos then land on the wrong reading, silently.
     */
    const resolved = []
    for (const row of arusRows) {
      if (row.id) { resolved.push(row); continue }
      try {
        const created = await arusApi.add(savrId, row)
        resolved.push({ ...row, id: created.id })
      } catch (err) {
        return errorMessage(err, 'The pole was saved, but a new leakage reading could not be added.')
      }
    }

    // Then one PUT with the complete set: applies edits, and soft-deletes the
    // readings the user removed. Every row now carries an id, so this can only
    // update — which is what keeps each reading's photos attached to it.
    try {
      await arusApi.replace(savrId, resolved)
    } catch (err) {
      // All-or-nothing on the server: a rejected call changed nothing.
      return errorMessage(err, 'The pole was saved, but its leakage readings were not. Nothing was changed on them.')
    }

    // Slot by slot against what the server last had, so a replaced photo does not
    // leave the old one behind and a cleared slot actually clears.
    const stored = arusStoredPhotos.current
    const failed = []
    for (const row of resolved) {
      const was = (row.id && stored[row.id]) || {}
      const slots = new Set([...Object.keys(row.photos || {}), ...Object.keys(was)])
      for (const imageType of slots) {
        const now = row.photos?.[imageType]
        const before = was[imageType]

        if (now instanceof File) {
          if (!row.id) { failed.push(imageType); continue }
          try {
            // Against the reading's id, never the pole's.
            await arusApi.uploadImage(row.id, now, imageType)
            // Only once the replacement is safely stored.
            if (before?.id) await imageApi.delete(before.id).catch(() => {})
          } catch (e) {
            console.error('Arus image upload failed:', row.id, imageType, e)
            failed.push(imageType)
          }
        } else if (!now && before?.id) {
          // The user emptied the slot.
          await imageApi.delete(before.id).catch(() => {})
        }
      }
    }

    // Re-read rather than reusing the PUT's response: that was built BEFORE the
    // uploads above, so its photo_count is already stale, and reseeding from it
    // made a photo that had just uploaded show as "0 photos attached".
    try {
      const fresh = await arusApi.list(savrId)
      const photos = await arusApi.imagesFor((fresh.items || []).map((r) => r.id))
      arusStoredPhotos.current = photos
      setArusRows((fresh.items || []).map((r) => ({
        key: r.id,
        id: r.id,
        reading: r.reading ?? '',
        leakage_current: Boolean(r.leakage_current),
        photos: { ...(photos[r.id] || {}) },
        photo_count: r.photo_count ?? 0,
      })))
    } catch {
      // The save itself landed; a failed refresh is cosmetic until reopen.
    }

    if (failed.length > 0) {
      return `Readings saved, but these photos failed to upload: ${failed.join(', ')}`
    }
    return ''
  }

  /**
   * Write the record and its images. Returns true when everything landed, so
   * a caller can chain a QA decision onto a successful save.
   */
  const persist = async () => {
    setError('')

    if (!formData.latitude || !formData.longitude) {
      setError(config.attachToPole
        ? 'This pole has no map location. Open height clearance from a pole point on the map.'
        : 'Please set a location on the map before saving.')
      setActiveTab('map')
      return false
    }

    // Any form with a required pole picker. `savr_id` is NOT NULL on the child
    // survey tables, so without this the drop-point call fails on a database
    // constraint and the surveyor sees a raw "Invalid reference" instead of
    // being told which field is missing.
    if (requiresPole && !formData.savr_id) {
      setError(`${config.title} must be linked to a pole. Choose one under ${poleFieldLabel}.`)
      setActiveTab('form')
      if (isWizard) setWizardStep(poleStepIndex)
      return false
    }

    // Require BA for admin
    if (isAdmin && !formData.ba_id) {
      setError('Please select a Business Area.')
      return false
    }

    // Both ends, plus the two rules the API enforces — checked here so the
    // surveyor gets a field name instead of a raw 422 body.
    for (const f of spanFields) {
      if (f.required && !formData[f.name]) {
        setError(`Please choose the ${f.label}.`)
        setActiveTab('form')
        return false
      }
      if (Boolean(formData[f.name]) !== Boolean(formData[f.typeField])) {
        setError(`The ${f.label} is incomplete — pick it again from the list.`)
        setActiveTab('form')
        return false
      }
    }
    if (spanFields.length === 2 && formData[spanFields[0].name]
        && formData[spanFields[0].name] === formData[spanFields[1].name]) {
      setError(`${spanFields[0].label} and ${spanFields[1].label} cannot be the same — a span needs two ends.`)
      setActiveTab('form')
      return false
    }

    setSaving(true)
    try {
      // Only slots holding a newly picked File need uploading; untouched slots
      // still hold their existing `{ id, url }`.
      const heldIds = new Set([
        ...Object.values(imageData)
          .filter((val) => val && !(val instanceof File) && val.id)
          .map((val) => val.id),
        // Still parked in the "Additional Photos" strip; a replaced slot must
        // drop its own former occupant, not one of these.
        ...extraImages.map((e) => e.id),
      ])
      const imageFields = Object.entries(imageData)
        .filter(([, val]) => val instanceof File)
        .map(([name, file]) => ({
          name,
          file,
          // Only delete the previous occupant when it is no longer in another
          // slot (a drag-move already reassigned that row's image_type).
          replaces: record?.images?.find((i) => i.image_type === name && !heldIds.has(i.id))?.id,
        }))

      const textData = { ...formData }

      Object.keys(textData).forEach((k) => {
        if (textData[k] === '') textData[k] = null
      })

      const { latitude, longitude, workpackage_resolved, workpackage_name, ...rest } = textData
      const payload = { ...rest }
      // A conditional field whose trigger is off is not shown, so whatever it
      // held is stale — clear it rather than saving remarks for a defect that
      // is no longer ticked.
      const clearHidden = (sections) => {
        for (const sec of sections || []) {
          for (const f of sec.fields || []) {
            if (f.showWhen && !payload[f.showWhen] && f.name in payload) payload[f.name] = null
          }
          clearHidden(sec.sections)
        }
      }
      for (const step of (isWizard ? config.wizardSteps : [{ sections: config.sections }])) clearHidden(step.sections)
      // total_defects is a stored column the table badge, map colour and
      // dashboard read; the API keeps whatever the client sends. Count the
      // ticked defect fields (same definition as the Defects filter), so
      // registration data like Daftar Aset on the pole form never adds to it.
      // Height clearance has no such column on the API.
      if (config.key !== 'height_clearance') {
        payload.total_defects = defectOptions(config).reduce(
          (n, f) => n + (payload[f.value] === true || payload[f.value] === '1' ? 1 : 0), 0)
      }
      // The parent pole is not a separate question — it is the pole the span
      // starts at. savr_id is NOT NULL, so this is what keeps the record valid
      // without asking the surveyor for the same pole twice.
      if (config.savrIdFrom && payload[config.savrIdFrom]) {
        payload.savr_id = payload[config.savrIdFrom]
      }
      delete payload.workpackage_ambiguous
      let geometryId = payload.geometry_id
      let wpId = payload.workpackage_id || null

      if (geometryId) {
        // Pole-attached surveys keep the location of the parent pole; do not
        // move the height-clearance geometry independently.
        if (!config.attachToPole) {
          const geom = await geometryApi.update(config.endpoint, geometryId, latitude, longitude)
          if (geom.workpackage_id) wpId = geom.workpackage_id
          else if (workpackage_resolved) wpId = null
        }
      } else {
        const override = workpackage_resolved ? undefined : wpId
        const geom = await geometryApi.create(config.endpoint, latitude, longitude, payload.ba_id, {
          cycle: payload.cycle,
          workpackageId: override || undefined,
          savrId: payload.savr_id || undefined,
        })
        geometryId = geom.geometry_id || geom.geom_id || geom.id
        if (geom.workpackage_id) wpId = geom.workpackage_id
      }
      payload.geometry_id = geometryId
      if (wpId) payload.workpackage_id = wpId
      else delete payload.workpackage_id

      let createdId = record?.id

      if (isEdit) {
        await surveyApi.update(config.endpoint, record.id, payload)
      } else {
        const result = await surveyApi.create(config.endpoint, payload)
        createdId = result.id
      }

      const failedUploads = []
      if (imageFields.length > 0 && createdId) {
        for (const img of imageFields) {
          try {
            // The field name doubles as the API's `image_type` code.
            await surveyApi.uploadImage(
              config.endpoint, createdId, img.file, img.name, null, payload.cycle
            )
            // Drop the image this one replaced so the slot keeps a single photo.
            if (img.replaces) {
              await imageApi.delete(img.replaces).catch(() => {})
            }
          } catch (e) {
            console.error('Image upload failed:', img.name, e)
            failedUploads.push(img.name)
          }
        }
      }

      if (hasArus && createdId) {
        const arusError = await saveArusReadings(createdId)
        if (arusError) {
          setError(arusError)
          return false
        }
      }

      if (failedUploads.length > 0) {
        setError(`Record saved, but these images failed to upload: ${failedUploads.join(', ')}`)
        return false
      }

      return true
    } catch (err) {
      setError(errorMessage(err, 'Failed to save record.'))
      return false
    } finally {
      setSaving(false)
    }
  }

  const handleSave = async () => {
    if (await persist()) onSave()
  }

  /**
   * Save first, then record the QA decision, so the reviewer never accepts a
   * version of the record that differs from what is on screen.
   */
  const handleSaveAndQa = async (action) => {
    if (!onQaAction) return
    setQaBusy(true)
    try {
      if (!(await persist())) return
      // The record is already saved at this point, so a failed decision leaves
      // the form open with the reason rather than dropping back to the list.
      if ((await onQaAction(action)) === false) {
        setError(`Record saved, but it could not be marked ${action.toLowerCase()}ed. Try again from here.`)
        return
      }
      onSave()
    } finally {
      setQaBusy(false)
    }
  }

  const hasGeometry = formData.latitude != null && formData.longitude != null

  /**
   * Every filled image slot in the whole form (all wizard steps), in config
   * order — this is what the side panel pages through with prev / next.
   */
  const imageSlotLabels = useMemo(() => {
    const steps = isWizard ? config.wizardSteps : [{ sections: config.sections }]
    const out = {}
    const walk = (sections) => {
      for (const sec of sections || []) {
        for (const f of sec.fields || []) if (f.type === 'image') out[f.name] = f.label
        walk(sec.sections)
      }
    }
    for (const step of steps) walk(step.sections)
    return out
  }, [config, isWizard])

  const gallery = useMemo(() => {
    const steps = isWizard ? config.wizardSteps : [{ sections: config.sections }]
    const out = []
    const walk = (sections) => {
      for (const sec of sections || []) {
        // Reading photos are uploaded per arus row, not into a form-wide slot,
        // so they are not part of this gallery.
        for (const f of sec.fields || []) {
          if (f.type !== 'image') continue
          const val = imageData[f.name]
          const src = val instanceof File ? val.preview : val ? imageUrl(typeof val === 'string' ? val : val.url) : null
          if (src) out.push({ name: f.name, label: f.label, section: sec.title, url: src, isNew: val instanceof File })
        }
        walk(sec.sections)
      }
    }
    for (const step of steps) walk(step.sections)
    return out
  }, [config, isWizard, imageData])

  // A slot emptied or replaced can leave the panel pointing past the end.
  useEffect(() => {
    if (viewerIndex != null && viewerIndex >= gallery.length) {
      setViewerIndex(gallery.length ? gallery.length - 1 : null)
    }
  }, [gallery.length, viewerIndex])

  /**
   * Open the photo for a slot. Wide screens get the docked panel so the form
   * stays visible and editable beside it; anything narrower has no room for a
   * split view, so it opens the full-screen lightbox instead.
   */
  const openImage = (fieldName) => {
    const idx = gallery.findIndex((g) => g.name === fieldName)
    if (idx < 0) return
    const wide = typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches
    if (wide) setViewerIndex(idx)
    else setLightboxIndex(idx)
  }

  // QA is only meaningful on an existing record, and only for a user the
  // module decided may review (it passes no handler otherwise).
  const showQa = isEdit && Boolean(onQaAction) && Boolean(record)
  const busy = saving || qaBusy

  const stepImage = (delta) => {
    if (viewerIndex == null || gallery.length === 0) return
    setViewerIndex((viewerIndex + delta + gallery.length) % gallery.length)
  }

  const allSteps = isWizard ? config.wizardSteps : [{ title: 'Form', sections: config.sections }]
  const currentStepData = allSteps[wizardStep] || allSteps[0]

  // Build a custom BA field that replaces the static zone/ba fields
  const baField = {
    name: 'ba_id',
    label: 'Business Area',
    type: 'select',
    required: !user?.ba_id,
    options: baOptions,
  }

  // Check if user has a locked BA (non-admin with ba_id)
  const baLocked = !isAdmin && user?.ba_id

  // Render the BA selector (auto-filled or dropdown)
  const renderBAField = () => {
    if (baLocked) {
      const baName = bas.find((b) => b.id === formData.ba_id)?.business_area || 'Your BA'
      return (
        <div>
          <label className="label">
            Business Area
          </label>
          <div className="px-3 py-2 bg-gray-100 rounded-lg text-sm text-gray-700 border border-gray-200">
            {baName} <span className="text-xs text-gray-400 ml-1">(auto-assigned)</span>
          </div>
        </div>
      )
    }
    return (
      <div>
        <label className="label">
          Business Area
          {!user?.ba_id && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        <select
          value={formData.ba_id || ''}
          onChange={(e) => handleChange('ba_id', e.target.value || null)}
          className="input"
        >
          {baOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
    )
  }

  const renderWorkPackageField = () => {
    if (!hasGeometry) {
      return (
        <div className="sm:col-span-2">
          <label className="label">Work Package</label>
          <div className="px-3 py-2 bg-gray-100 rounded-lg text-sm text-gray-500 border border-gray-200">
            Drop a pin on the map — assigned from the package polygons
          </div>
        </div>
      )
    }

    if (wpPreview.loading) {
      return (
        <div className="sm:col-span-2">
          <label className="label">Work Package</label>
          <div className="px-3 py-2 bg-gray-100 rounded-lg text-sm text-gray-500 border border-gray-200">
            Resolving from coordinates…
          </div>
        </div>
      )
    }

    if (formData.workpackage_resolved && formData.workpackage_id) {
      const overlap = wpPreview.ambiguous && wpPreview.candidates?.length
        ? wpPreview.candidates.slice(1).map((c) => c.package_name).filter(Boolean)
        : []
      return (
        <div className="sm:col-span-2">
          <label className="label">Work Package</label>
          <div className="px-3 py-2 bg-gray-100 rounded-lg text-sm text-gray-700 border border-gray-200">
            {formData.workpackage_name || 'Assigned'}
            <span className="text-xs text-gray-400 ml-1">(from location)</span>
          </div>
          {overlap.length > 0 && (
            <p className="text-xs text-amber-600 mt-1">
              Also overlaps {overlap.join(', ')}. Smallest polygon was chosen.
            </p>
          )}
        </div>
      )
    }

    return (
      <div className="sm:col-span-2">
        <label className="label">Work Package</label>
        <select
          value={formData.workpackage_id || ''}
          onChange={(e) => handleChange('workpackage_id', e.target.value || null)}
          className="input"
        >
          <option value="">— None (valid) —</option>
          {packages.map((wp) => (
            <option key={wp.id} value={wp.id}>
              {wp.package_name}{wp.has_geom ? '' : ' (no polygon)'}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-400 mt-1">
          This pin is outside every work-package polygon. Leaving it empty is valid.
        </p>
      </div>
    )
  }
  // `showWhen: '<field>'` on a config field shows it only while that other
  // field is truthy (e.g. a remarks box behind an "Other" checkbox).
  const filterFields = (fields) =>
    fields.filter((f) =>
      !f.hidden && f.name !== 'zone' && f.name !== 'ba' && f.name !== 'ba_id'
      && (!f.showWhen || Boolean(formData[f.showWhen]))
    )

  return (
    <div className="flex flex-col h-full">
      {/* Tab switcher */}
      <div className="flex gap-1 border-b border-gray-200 px-6 pt-2">
        <button
          onClick={() => setActiveTab('form')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${activeTab === 'form' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          {isWizard ? `Step ${wizardStep + 1}: ${currentStepData.title}` : 'Form Data'}
        </button>
        <button
          onClick={() => setActiveTab('map')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${activeTab === 'map' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Map
          {!hasGeometry && <span className="ml-1 text-red-500">●</span>}
          {hasGeometry && <span className="ml-1 text-xs text-gray-400">{formData.latitude.toFixed(5)}, {formData.longitude.toFixed(5)}</span>}
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'form' && (
          <div className="space-y-6 max-w-4xl">
            {/* Wizard step tabs */}
            {isWizard && (
              <div className="flex gap-1 border-b border-gray-200 pb-2 overflow-x-auto">
                {allSteps.map((step, idx) => (
                  <button
                    key={idx}
                    onClick={() => setWizardStep(idx)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${wizardStep === idx ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  >
                    {idx + 1}. {step.title}
                  </button>
                ))}
              </div>
            )}

            {/* BA auto-select row — always shown at top of first step */}
            {wizardStep === 0 && (
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-100">Location Assignment</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {renderBAField()}
                  <div>
                    <label className="label">Zone</label>
                    <div className="px-3 py-2 bg-gray-100 rounded-lg text-sm text-gray-700 border border-gray-200">
                      {formData.zone || zoneFromBa(formData.ba_id) || '—'} <span className="text-xs text-gray-400 ml-1">(auto from BA)</span>
                    </div>
                  </div>
                  {renderWorkPackageField()}
                </div>
              </div>
            )}

            {/* Render sections for current step */}
            {currentStepData.sections.map((section) => (
              <div key={section.title} className="card p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-100">{section.title}</h3>
                {section.component === 'arus' ? (
                  <ArusReadings
                    rows={arusRows}
                    onChange={setArusRows}
                    disabled={busy}
                    // Reading photos are per row, so they are not in `gallery`
                    // (which pages the pole's own slots). Show the one clicked.
                    onViewImage={(url, label) => setArusViewer({ url, label })}
                  />
                ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filterFields(section.fields).map((field) => {
                    const isImage = field.type === 'image'
                    return (
                      <div key={field.type + ':' + field.name} className={field.wide ? 'sm:col-span-2 lg:col-span-3' : undefined}>
                        <FormField
                          field={field}
                          value={isImage ? imageData[field.name] : formData[field.name]}
                          onChange={isImage ? handleImageChange : handleChange}
                          onImageView={isImage ? openImage : undefined}
                          disabled={field.name === 'savr_id' && config.attachToPole}
                          // The pickers that search by distance need the point
                          // the record sits at; `savr-select` uses it to offer
                          // the nearest poles instead of every pole there is.
                          context={field.type === 'asset-select' || field.type === 'savr-select' ? {
                            latitude: formData.latitude,
                            longitude: formData.longitude,
                            resolved: { from_id: span?.from, to_id: span?.to },
                            typeValues: { from_type: formData.from_type, to_type: formData.to_type },
                          } : undefined}
                          imageDrag={isImage ? {
                            from: draggingImage,
                            onStart: setDraggingImage,
                            onEnd: () => setDraggingImage(null),
                            onMove: handleImageMove,
                          } : undefined}
                        />
                      </div>
                    )
                  })}
                </div>
                )}
              </div>
            ))}

            {/* Photos with no slot of their own (duplicate type / unknown type). */}
            {extraImages.length > 0 && (
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-1 pb-2 border-b border-gray-100">
                  Additional Photos ({extraImages.length})
                </h3>
                <p className="text-xs text-gray-500 mb-3">
                  These photos share a slot with another photo. Drag one onto an empty slot to keep it there, or delete it.
                </p>
                <div className="flex flex-wrap gap-4">
                  {extraImages.map((img) => {
                    const key = EXTRA_PREFIX + img.id
                    const src = imageUrl(img.url)
                    const slotLabel = imageSlotLabels[img.type] || img.type
                    return (
                      <div key={img.id} className="flex items-center gap-3 w-full sm:w-auto">
                        <button
                          type="button"
                          draggable={!busy}
                          onDragStart={(e) => {
                            e.dataTransfer.setData('application/x-apks-image-slot', key)
                            e.dataTransfer.effectAllowed = 'move'
                            setDraggingImage(key)
                          }}
                          onDragEnd={() => setDraggingImage(null)}
                          className="relative group w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden border border-gray-200 cursor-grab active:cursor-grabbing"
                          aria-label={`View extra ${slotLabel}`}
                          onClick={() => setArusViewer({ url: src, label: `${slotLabel} (extra)` })}
                        >
                          <img src={src} alt={slotLabel} className="w-full h-full object-cover pointer-events-none" />
                        </button>
                        <div className="min-w-0">
                          <p className="text-sm text-gray-800 truncate">{slotLabel}</p>
                          <p className="text-xs text-gray-400 truncate">{img.url.split('/').pop()}</p>
                          <button
                            type="button"
                            disabled={busy || extraBusy === img.id}
                            onClick={() => handleExtraDelete(img)}
                            className="text-xs text-red-600 hover:text-red-700 mt-1 disabled:opacity-50"
                          >
                            {extraBusy === img.id ? 'Deleting...' : 'Delete photo'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Wizard nav buttons */}
            {isWizard && (
              <div className="flex justify-between pt-2">
                <button
                  onClick={() => setWizardStep(Math.max(0, wizardStep - 1))}
                  disabled={wizardStep === 0}
                  className="btn-secondary"
                >
                  ← Previous
                </button>
                <button
                  onClick={() => setWizardStep(Math.min(allSteps.length - 1, wizardStep + 1))}
                  disabled={wizardStep === allSteps.length - 1}
                  className="btn-secondary"
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'map' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">
                  {config.attachToPole ? 'Pole Location' : 'Set Location'}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {config.attachToPole
                    ? (hasGeometry
                      ? `Pole: ${formData.latitude.toFixed(6)}, ${formData.longitude.toFixed(6)}${formData.workpackage_name ? ` · ${formData.workpackage_name}` : ''}`
                      : 'Location comes from the selected pole')
                    : (hasGeometry
                      ? `Location: ${formData.latitude.toFixed(6)}, ${formData.longitude.toFixed(6)}${formData.workpackage_name ? ` · ${formData.workpackage_name}` : wpPreview.unmatched ? ' · outside every work package' : ''} · drag the marker to move it`
                      : 'Click on the map to place the inspection point')}
                </p>
              </div>
              {hasGeometry && !config.attachToPole && (
                <button onClick={() => setDropMode(true)} className="btn-secondary btn-sm">Reposition</button>
              )}
            </div>
            <MapView
              surveyConfig={config}
              dropMode={config.attachToPole ? false : dropMode}
              onMapClick={config.attachToPole ? undefined : handleMapClick}
              baId={formData.ba_id || userBaId}
              height={450}
              highlightCoords={hasGeometry ? [formData.longitude, formData.latitude] : null}
              // Drag to move the point. Not offered on the pole-attached forms,
              // whose location belongs to the parent pole, and not while drop
              // mode is waiting for a click.
              draggableMarker={hasGeometry && !config.attachToPole && !dropMode}
              onMarkerDragEnd={handleMapClick}
              initialCenter={hasGeometry ? [formData.longitude, formData.latitude] : undefined}
              initialZoom={hasGeometry ? 16 : 11}
            />
          </div>
        )}
      </div>

      {/* Docked photo viewer — the form stays editable beside it. */}
      {viewerIndex != null && gallery[viewerIndex] && (
        <aside className="hidden lg:flex w-[380px] xl:w-[440px] flex-shrink-0 flex-col border-l border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-white">
            <h3 className="text-sm font-semibold text-gray-900 truncate">{gallery[viewerIndex].label}</h3>
            <button
              type="button"
              onClick={() => setViewerIndex(null)}
              className="text-gray-400 hover:text-gray-700 text-xl leading-none px-1"
              aria-label="Close viewer"
            >
              &times;
            </button>
          </div>

          <div className="flex-1 min-h-0 flex items-center justify-center p-3">
            <img
              src={gallery[viewerIndex].url}
              alt={gallery[viewerIndex].label}
              className="max-w-full max-h-full object-contain rounded-lg border border-gray-200 bg-white cursor-zoom-in"
              onClick={() => setLightboxIndex(viewerIndex)}
              onError={(e) => { e.target.src = ''; e.target.alt = 'Image not available' }}
            />
          </div>

          <div className="px-4 py-2 border-t border-gray-200 bg-white space-y-2">
            <p className="text-xs text-gray-500 truncate">
              {gallery[viewerIndex].section}
              {gallery[viewerIndex].isNew && <span className="ml-2 text-primary-600 font-medium">Not yet uploaded</span>}
            </p>
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => stepImage(-1)}
                disabled={gallery.length < 2}
                className="btn-secondary btn-sm disabled:opacity-40"
              >
                &larr; Prev
              </button>
              <span className="text-xs text-gray-500 whitespace-nowrap">
                {viewerIndex + 1} / {gallery.length}
              </span>
              <button
                type="button"
                onClick={() => stepImage(1)}
                disabled={gallery.length < 2}
                className="btn-secondary btn-sm disabled:opacity-40"
              >
                Next &rarr;
              </button>
            </div>
            <button
              type="button"
              onClick={() => setLightboxIndex(viewerIndex)}
              className="btn-secondary btn-sm w-full"
            >
              Full screen &amp; zoom
            </button>
          </div>
        </aside>
      )}
      </div>

      {error && <div className="px-6 py-2 bg-red-50 border-t border-red-200 text-sm text-red-700">{error}</div>}

      <div className="flex flex-wrap items-center justify-end gap-3 px-6 py-3 border-t border-gray-200 bg-gray-50">
        {/* QA on the edit screen: a reviewer who has just corrected a record
            can decide it here instead of going back to the detail view. */}
        {showQa && (
          <span className="mr-auto flex items-center gap-2 text-xs text-gray-500">
            QA status <StatusBadge status={record.qa_status} />
          </span>
        )}
        <button onClick={onCancel} className="btn-secondary" disabled={busy}>Cancel</button>
        {showQa && record.qa_status !== 'Reject' && (
          <button
            onClick={() => handleSaveAndQa('Reject')}
            disabled={busy}
            className="btn-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 px-3 py-2 text-sm font-medium"
          >
            Save &amp; Reject
          </button>
        )}
        <button onClick={handleSave} disabled={busy} className={showQa ? 'btn-secondary' : 'btn-primary'}>
          {saving && !qaBusy ? 'Saving...' : isEdit ? 'Update Record' : 'Create Record'}
        </button>
        {showQa && record.qa_status !== 'Accept' && (
          <button
            onClick={() => handleSaveAndQa('Accept')}
            disabled={busy}
            className="btn-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 px-3 py-2 text-sm font-medium"
          >
            {qaBusy ? 'Working...' : 'Save & Accept'}
          </button>
        )}
      </div>

      <ImageLightbox
        images={gallery}
        index={lightboxIndex}
        onIndexChange={setLightboxIndex}
        onClose={() => setLightboxIndex(null)}
      />

      <ImageLightbox
        images={arusViewer ? [arusViewer] : []}
        index={arusViewer ? 0 : null}
        onIndexChange={() => {}}
        onClose={() => setArusViewer(null)}
      />
    </div>
  )
}

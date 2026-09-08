/**
 * Survey field configurations — V4 schema.
 * Defects are individual boolean columns (not JSONB).
 * Field types: text, textarea, number, date, time, select, radio, checkbox,
 * checkbox-group, span-group, image, savr-select
 */

const ZONE_OPTIONS = [
  { value: '', label: '— Select Zone —' },
  { value: 'W1', label: 'W1' },
  { value: 'B1', label: 'B1' },
  { value: 'B2', label: 'B2' },
  { value: 'B4', label: 'B4' },
]

/**
 * Yes/No columns stored as varchar rather than boolean (`grass_status`,
 * `tree_branches_status`, `advertise_poster_status`).
 *
 * The values are `'1'`/`'0'` because that is what the mobile app writes and what
 * is already in the database. Submitting `'Yes'`/`'No'` from the web would split
 * the column across two conventions; `optionLabel` in SurveyDetail still renders
 * either spelling, so rows written before this are unaffected.
 */
const YES_NO = [
  { value: '', label: '— Select —' },
  { value: '1', label: 'Yes' },
  { value: '0', label: 'No' },
]

export const SURVEY_TYPES = {
  // ================================================================
  // SAVR — Tiang (multi-step wizard)
  // ================================================================
  savr: {
    key: 'savr',
    endpoint: 'savr',
    tableName: 'tbl_savr',
    title: 'SAVR',
    subtitle: 'Tiang + Talian VT & VR',
    icon: 'utilitypole',
    color: '#2563eb',
    isWizard: true,
    filters: [
      { name: 'cycle', label: 'Cycle', type: 'number', default: 1 },
      { name: 'qa_status', label: 'QA Status', type: 'select', default: '', options: [{ value: '', label: 'All' }, { value: 'Pending', label: 'Pending' }, { value: 'Accept', label: 'Accepted' }, { value: 'Reject', label: 'Rejected' }] },
    ],
    columns: [
      { key: 'tiang_no', label: 'Tiang No' },
      { key: 'fp_name', label: 'Feeder Pillar' },
      { key: 'fp_road', label: 'Road' },
      { key: 'size_tiang', label: 'Size' },
      { key: 'jenis_tiang', label: 'Type' },
      { key: 'total_defects', label: 'Defects', type: 'badge' },
      { key: 'qa_status', label: 'QA', type: 'qa_status' },
      { key: 'updated_at', label: 'Updated', type: 'datetime' },
    ],
    wizardSteps: [
      {
        title: 'Info',
        sections: [
          {
            title: 'General Info',
            fields: [
              { name: 'fp_name', label: 'Name of Substation / Feeder Pillar', type: 'text', required: true },
              { name: 'fp_road', label: 'Feeder Name / Street Name', type: 'text', required: true },
              { name: 'section_from', label: 'Section From', type: 'text' },
              { name: 'section_to', label: 'Section To', type: 'text' },
              { name: 'tiang_no', label: 'Tiang No', type: 'text', required: true },
              { name: 'visit_date', label: 'Visit Date', type: 'date', required: true },
              { name: 'name_contractor', label: 'Contractor Name', type: 'text' },
              { name: 'start_date', label: 'Start Date', type: 'date', hidden: true },
              { name: 'end_date', label: 'End Date', type: 'date', hidden: true },
            ],
          },
        ],
      },
      {
        title: 'Images',
        sections: [
          {
            title: 'Pole Images',
            fields: [
              { name: 'savr_1', label: 'Pole Image 1 (TIANG 1)', type: 'image', required: true },
              { name: 'savr_2', label: 'Pole Image 2 (TIANG 2)', type: 'image', required: true },
              { name: 'eqp_reading', label: 'Equipment Reading Image', type: 'image' },
              { name: 'other', label: 'Other Image', type: 'image' },
            ],
          },
          {
            // Codes accepted by GET /image-types/by-survey/tbl_savr
            title: 'Defect Images',
            fields: [
              { name: 'tiang_defect', label: 'Tiang Defect', type: 'image' },
              { name: 'talian_defect', label: 'Talian Defect', type: 'image' },
              { name: 'umbang_defect', label: 'Umbang Defect', type: 'image' },
              { name: 'ipc_defect', label: 'IPC Defect', type: 'image' },
              { name: 'pembumian_defect', label: 'Pembumian Defect', type: 'image' },
              { name: 'black_box_defect', label: 'Black Box Defect', type: 'image' },
              { name: 'jumper_defect', label: 'Jumper Defect', type: 'image' },
              { name: 'kilat_defect', label: 'Kilat Defect', type: 'image' },
              { name: 'servis_defect', label: 'Servis Defect', type: 'image' },
              { name: 'papan_defect', label: 'Papan Tanda Defect', type: 'image' },
              { name: 'hazard_defect', label: 'Hazard Defect', type: 'image' },
            ],
          },
        ],
      },
      {
        title: 'Daftar Aset',
        sections: [
          {
            title: 'Pole Details',
            fields: [
              {
                name: 'size_tiang', label: 'Pole Size', type: 'radio',
                options: [{ value: '7.5', label: '7.5' }, { value: '9', label: '9' }, { value: '10', label: '10' }],
              },
              {
                name: 'jenis_tiang', label: 'Pole Type', type: 'radio',
                options: [{ value: 'spun', label: 'Spun' }, { value: 'concrete', label: 'Concrete' }, { value: 'iron', label: 'Iron' }, { value: 'wood', label: 'Wood' }],
              },
              { name: 'main_line_service', label: 'Talian Utama / Servis', type: 'checkbox' },
              { name: 'number_of_services', label: 'Bilangan Servis', type: 'number' },
            ],
          },
          {
            title: 'Span Data',
            fields: [
              // `aliases` are the JSON keys the mobile app writes for the same
              // conductor size (3x185, >3x16, 19/064 ...). The form reads either
              // spelling and writes back to whichever one the record already uses.
              { name: 'abc_span', label: 'ABC Span', type: 'span-group', subFields: [
                { key: 's3_185', label: '3 X 185', aliases: ['3x185'] },
                { key: 's3_95', label: '3 X 95', aliases: ['3x95'] },
                { key: 's3_16', label: '3 X 16', aliases: ['>3x16', '3x16'] },
                { key: 's1_16', label: '1 X 16', aliases: ['1x16'] },
              ]},
              { name: 'pvc_span', label: 'PVC Span', type: 'span-group', subFields: [
                { key: 's19_064', label: '19/064', aliases: ['19/064'] },
                { key: 's7_083', label: '7/083', aliases: ['7/083'] },
                { key: 's7_044', label: '7/044', aliases: ['7/044'] },
              ]},
              { name: 'bare_span', label: 'BARE Span', type: 'span-group', subFields: [
                { key: 's7_173', label: '7/173', aliases: ['7/173'] },
                { key: 's7_122', label: '7/122', aliases: ['7/122'] },
                { key: 's3_132', label: '3/132', aliases: ['3/132'] },
              ]},
              { name: 'bil_umbang', label: 'BIL Umbang', type: 'text' },
              { name: 'bil_black_box', label: 'Bil Black Box', type: 'text' },
              { name: 'bil_lvpt', label: 'BIL LVPT', type: 'text' },
              { name: 'bil_size_tiang', label: 'BIL Size Tiang', type: 'text' },
              { name: 'bil_jenis_tiang', label: 'BIL Jenis Tiang', type: 'text' },
            ],
          },
        ],
      },
      {
        title: 'Defects',
        sections: [
          {
            title: 'Tiang (Pole) Defects',
            fields: [
              { name: 'tiang_cracked', label: 'Reput', type: 'checkbox' },
              { name: 'tiang_leaning', label: 'Condong', type: 'checkbox' },
              { name: 'tiang_dim', label: 'Pudar', type: 'checkbox' },
              { name: 'tiang_creepers', label: 'Creepers', type: 'checkbox' },
              { name: 'tiang_other', label: 'Others', type: 'checkbox' },
              { name: 'tiang_other_desc', label: 'Other Description', type: 'text' },
            ],
          },
          {
            title: 'Talian (Cable) Defects',
            fields: [
              { name: 'talian_dbrac', label: 'D-Brac ABC', type: 'checkbox' },
              { name: 'talian_joint_ipc', label: 'Joint - IPC/Maruku Joint', type: 'checkbox' },
              { name: 'talian_need_rentis', label: 'Need Rentis - Perlu Rentis', type: 'checkbox' },
              // Hidden on the web UI only — the column stays in the API / mobile app.
              { name: 'talian_joint_conn', label: 'Joint - Joint Connection', type: 'checkbox', hidden: true },
              { name: 'talian_ground', label: 'Ground Clearance', type: 'checkbox' },
              { name: 'talian_bumbung', label: 'Talian atas sentuh bumbung', type: 'checkbox' },
              { name: 'talian_other', label: 'Others', type: 'checkbox' },
              { name: 'talian_other_desc', label: 'Other Description', type: 'text' },
            ],
          },
          {
            title: 'Umbang (Stay Wire) Defects',
            fields: [
              { name: 'umbang_putus', label: 'Kendur/Putus', type: 'checkbox' },
              { name: 'umbang_creepers', label: 'Creepers', type: 'checkbox' },
              { name: 'umbang_damage', label: 'Insulator Damage', type: 'checkbox' },
              { name: 'umbang_stay_plate', label: 'Stay Plate', type: 'checkbox' },
              { name: 'umbang_other', label: 'Others', type: 'checkbox' },
              { name: 'umbang_other_desc', label: 'Other Description', type: 'text' },
            ],
          },
          {
            // A pole takes several leakage readings, so they are child rows in
            // tbl_arus rather than two columns here. `component` swaps the usual
            // field grid for the repeatable group; `fields: []` keeps the code
            // that walks every section's fields (detail view, image gallery)
            // working without a special case.
            title: 'Leakage Current Readings',
            component: 'arus',
            fields: [],
          },
          {
            title: 'IPC Defects',
            fields: [
              { name: 'ipc_kurang_nos', label: 'IPC kurang 2 nos', type: 'checkbox' },
              { name: 'ipc_cap_tida', label: 'End Cap tiada', type: 'checkbox' },
              { name: 'ipc_other', label: 'Others', type: 'checkbox' },
              { name: 'ipc_other_desc', label: 'Other Description', type: 'text' },
            ],
          },
          {
            title: 'Pembumian Defects',
            fields: [
              { name: 'pembumian_tiada_neutral', label: 'Tiada Sambungan ke Neutral', type: 'checkbox' },
              { name: 'pembumian_other', label: 'Others', type: 'checkbox' },
              { name: 'pembumian_other_desc', label: 'Other Description', type: 'text' },
            ],
          },
          {
            title: 'Blackbox Defects',
            fields: [
              { name: 'blackbox_kesan_bakar', label: 'Kesan Bakar', type: 'checkbox' },
              { name: 'blackbox_other', label: 'Others', type: 'checkbox' },
              { name: 'blackbox_other_desc', label: 'Other Description', type: 'text' },
            ],
          },
          {
            title: 'Jumper Defects',
            fields: [
              { name: 'jumper_tiada_sleve', label: 'Tiada UV Sleeve', type: 'checkbox' },
              { name: 'jumper_kesan_bakar', label: 'Kesan Bakar', type: 'checkbox' },
              { name: 'jumper_other', label: 'Others', type: 'checkbox' },
              { name: 'jumper_other_desc', label: 'Other Description', type: 'text' },
            ],
          },
          {
            title: 'Kilat Defects',
            fields: [
              { name: 'kilat_rosak', label: 'Rosak', type: 'checkbox' },
              { name: 'kilat_other', label: 'Others', type: 'checkbox' },
              { name: 'kilat_other_desc', label: 'Other Description', type: 'text' },
            ],
          },
          {
            title: 'Servis Defects',
            fields: [
              { name: 'servis_atas_bumbung', label: 'Talian servis atas bumbung', type: 'checkbox' },
              { name: 'servis_won_piece', label: 'Won-piece tanggal', type: 'checkbox' },
              { name: 'servis_d_bracket', label: 'D-Bracket tanggal', type: 'checkbox' },
              { name: 'servis_other', label: 'Others', type: 'checkbox' },
              { name: 'servis_other_desc', label: 'Other Description', type: 'text' },
            ],
          },
          {
            title: 'Papan Tanda Defects',
            fields: [
              { name: 'papan_rosak', label: 'Pudar/Rosak/Tiada', type: 'checkbox' },
              { name: 'papan_other', label: 'Others', type: 'checkbox' },
              { name: 'papan_other_desc', label: 'Other Description', type: 'text' },
            ],
          },
          {
            title: 'Hazard Defects',
            fields: [
              { name: 'hazard_haiwan', label: 'Haiwan merbahaya/berbisa', type: 'checkbox' },
              { name: 'hazard_other', label: 'Others', type: 'checkbox' },
              { name: 'hazard_other_desc', label: 'Other Description', type: 'text' },
            ],
          },
        ],
      },
    ],
  },

  // ================================================================
  // Substation (Pencawang)
  // ================================================================
  substation: {
    key: 'substation',
    endpoint: 'substation',
    tableName: 'tbl_substation',
    title: 'Substation',
    subtitle: 'Pencawang (PE) Inspection',
    icon: 'building',
    color: '#7c3aed',
    filters: [
      { name: 'cycle', label: 'Cycle', type: 'number', default: 1 },
      { name: 'qa_status', label: 'QA Status', type: 'select', default: '', options: [{ value: '', label: 'All' }, { value: 'Pending', label: 'Pending' }, { value: 'Accept', label: 'Accepted' }, { value: 'Reject', label: 'Rejected' }] },
    ],
    columns: [
      { key: 'name', label: 'Name' },
      { key: 'fl', label: 'FL' },
      { key: 'voltage', label: 'Voltage' },
      { key: 'type', label: 'Type' },
      { key: 'total_defects', label: 'Defects', type: 'badge' },
      { key: 'qa_status', label: 'QA', type: 'qa_status' },
      { key: 'updated_at', label: 'Updated', type: 'datetime' },
    ],
    sections: [
      {
        title: 'General Info',
        fields: [
          { name: 'fl', label: 'FL Substation', type: 'text', required: true },
          { name: 'name', label: 'Substation/Feeder Pillar Name', type: 'text', required: true },
          { name: 'type', label: 'Type', type: 'select', options: [{ value: '', label: '—' }, { value: 'Indoor', label: 'Indoor' }, { value: 'Attach Building', label: 'Attach Building' }, { value: 'Outdoor', label: 'Outdoor' }, { value: 'Padat', label: 'Padat' }, { value: 'PET', label: 'PE Atas Tiang (PET)' }] },
          { name: 'voltage', label: 'Voltage', type: 'select', options: [{ value: '', label: '—' }, { value: '11kv', label: '11kv' }, { value: '33kv', label: '33kv' }] },
          { name: 'visit_date', label: 'Survey Date', type: 'date', required: true },
          { name: 'patrol_time', label: 'Patrol Time', type: 'time', hidden: true },
          { name: 'is_surveyed', label: 'Surveyed', type: 'checkbox' },
        ],
      },
      {
        title: 'Gate Status',
        fields: [
          { name: 'gate_locked', label: 'Gate Locked (No Defect)', type: 'checkbox' },
          { name: 'gate_damaged', label: 'Gate Damaged', type: 'checkbox' },
          { name: 'gate_other', label: 'Gate Other', type: 'checkbox' },
        ],
      },
      {
        title: 'Grounds & Building',
        fields: [
          { name: 'grass_status', label: 'Long Grass (Semak/Rumput Panjang)', type: 'select', options: YES_NO },
          { name: 'tree_branches_status', label: 'Tree Branches in P.E', type: 'select', options: YES_NO },
          { name: 'advertise_poster_status', label: 'Cleaning Illegal Ads/Banners', type: 'select', options: YES_NO, wide: true },
          { name: 'building_broken_roof', label: 'Building - Broken Roof', type: 'checkbox' },
          { name: 'building_broken_gutter', label: 'Building - Broken Gutter', type: 'checkbox' },
          { name: 'building_broken_base', label: 'Building - Broken Base', type: 'checkbox' },
          { name: 'building_other', label: 'Building - Other', type: 'checkbox' },
        ],
      },
      {
        title: 'Substation Images',
        fields: [
          { name: 'substation_1', label: 'Substation Image 1', type: 'image', required: true },
          { name: 'substation_2', label: 'Substation Image 2', type: 'image', required: true },
          { name: 'gate_locked', label: 'Gate Locked', type: 'image' },
          { name: 'gate_before', label: 'Gate Before', type: 'image' },
          { name: 'banner_before', label: 'Banner Before', type: 'image' },
          { name: 'gate_during', label: 'Gate During', type: 'image' },
          { name: 'banner_during', label: 'Banner During', type: 'image' },
          { name: 'gate_after', label: 'Gate After', type: 'image' },
          { name: 'banner_after', label: 'Banner After', type: 'image' },
          { name: 'rumput_panjang', label: 'Long Grass Image', type: 'image' },
          { name: 'dahan_masuk_pe', label: 'Tree Branches Image', type: 'image' },
          { name: 'bangunan', label: 'Building Image', type: 'image' },
          { name: 'other', label: 'Other Image', type: 'image' },
          { name: 'other_1', label: 'Other Image 1', type: 'image' },
          { name: 'other_2', label: 'Other Image 2', type: 'image' },
          { name: 'other_3', label: 'Other Image 3', type: 'image' },
        ],
      },
    ],
  },

  // ================================================================
  // Feeder Pillar
  // ================================================================
  feeder_pillar: {
    key: 'feeder_pillar',
    endpoint: 'feeder-pillar',
    tableName: 'tbl_feeder_pillar',
    title: 'Feeder Pillar',
    subtitle: 'Feeder Pillar Inspection',
    icon: 'box',
    color: '#ea580c',
    filters: [
      { name: 'cycle', label: 'Cycle', type: 'number', default: 1 },
      { name: 'qa_status', label: 'QA Status', type: 'select', default: '', options: [{ value: '', label: 'All' }, { value: 'Pending', label: 'Pending' }, { value: 'Accept', label: 'Accepted' }, { value: 'Reject', label: 'Rejected' }] },
    ],
    columns: [
      { key: 'area', label: 'PE Name/Street Name' },
      { key: 'size', label: 'Size' },
      { key: 'total_defects', label: 'Defects', type: 'badge' },
      { key: 'cycle', label: 'Cycle' },
      { key: 'qa_status', label: 'QA', type: 'qa_status' },
      { key: 'updated_at', label: 'Updated', type: 'datetime' },
    ],
    sections: [
      {
        title: 'General Info',
        fields: [
          { name: 'feeder_involved', label: 'Feeder Involved', type: 'text', hidden: true },
          { name: 'area', label: 'PE Name/Street Name', type: 'text' },
          { name: 'size', label: 'Size', type: 'select', required: true, options: [{ value: '', label: '—' }, { value: '400', label: '400' }, { value: '800', label: '800' }, { value: '1600', label: '1600' }] },
          { name: 'visit_date', label: 'Survey Date', type: 'date', required: true },
          { name: 'patrol_time', label: 'Patrol Time', type: 'time', hidden: true },
        ],
      },
      {
        title: 'Gate Status',
        fields: [
          { name: 'gate_locked', label: 'Gate Locked (No Defect)', type: 'checkbox' },
          { name: 'gate_damaged', label: 'Gate Damaged', type: 'checkbox' },
          { name: 'gate_other', label: 'Gate Other', type: 'checkbox' },
          { name: 'gate_other_remarks', label: 'Gate Other Remarks', type: 'textarea', wide: true, showWhen: 'gate_other' },
        ],
      },
      {
        title: 'Defects',
        fields: [
          { name: 'vandalism_status', label: 'Vandalism', type: 'checkbox' },
          { name: 'leaning_status', label: 'Leaning', type: 'checkbox' },
          { name: 'rust_status', label: 'Rust', type: 'checkbox' },
          { name: 'guard_status', label: 'FP Guard', type: 'checkbox' },
          { name: 'paint_status', label: 'Paint Faded', type: 'checkbox' },
          { name: 'advertise_poster_status', label: 'Advertisement/Poster', type: 'checkbox' },
          { name: 'other_status', label: 'Others', type: 'checkbox' },
          { name: 'other_remarks', label: 'Others Remarks', type: 'textarea', wide: true },
          // Kept for the API / mobile app / QR leaning column. Replaced on the web by Others.
          { name: 'leaning_angle', label: 'Leaning Angle', type: 'text', hidden: true },
        ],
      },
      {
        title: 'Feeder Pillar Images',
        fields: [
          { name: 'feeder_pillar_1', label: 'Feeder Pillar Image 1', type: 'image', required: true },
          { name: 'feeder_pillar_2', label: 'Feeder Pillar Image 2', type: 'image', required: true },
          { name: 'gate_locked', label: 'Gate Locked', type: 'image' },
          { name: 'name_plate', label: 'Name Plate Image', type: 'image', required: true },
          { name: 'gate_before', label: 'Gate Before', type: 'image' },
          { name: 'gate_during', label: 'Gate During', type: 'image' },
          { name: 'gate_after', label: 'Gate After', type: 'image' },
          { name: 'banner_before', label: 'Banner Before', type: 'image' },
          { name: 'banner_during', label: 'Banner During', type: 'image' },
          { name: 'banner_after', label: 'Banner After', type: 'image' },
          { name: 'vandalism', label: 'Vandalism Image', type: 'image' },
          { name: 'leaning', label: 'Leaning Image', type: 'image' },
          { name: 'rust', label: 'Rust Image', type: 'image' },
          { name: 'other', label: 'Other Image', type: 'image' },
          { name: 'other_1', label: 'Other Image 1', type: 'image' },
          { name: 'other_2', label: 'Other Image 2', type: 'image' },
          { name: 'other_3', label: 'Other Image 3', type: 'image' },
        ],
      },
    ],
  },

  // ================================================================
  // Link Box
  // ================================================================
  link_box: {
    key: 'link_box',
    endpoint: 'link-box',
    tableName: 'tbl_link_box',
    title: 'Link Box',
    subtitle: 'Link Box Pelbagai Voltan',
    icon: 'link',
    color: '#0891b2',
    filters: [
      { name: 'cycle', label: 'Cycle', type: 'number', default: 1 },
      { name: 'qa_status', label: 'QA Status', type: 'select', default: '', options: [{ value: '', label: 'All' }, { value: 'Pending', label: 'Pending' }, { value: 'Accept', label: 'Accepted' }, { value: 'Reject', label: 'Rejected' }] },
    ],
    columns: [
      { key: 'area', label: 'PE Name/Street Name' },
      { key: 'type', label: 'Voltage' },
      { key: 'total_defects', label: 'Defects', type: 'badge' },
      { key: 'qa_status', label: 'QA', type: 'qa_status' },
      { key: 'updated_at', label: 'Updated', type: 'datetime' },
    ],
    sections: [
      {
        title: 'General Info',
        fields: [
          { name: 'section_from', label: 'Section Dari', type: 'text' },
          { name: 'section_to', label: 'Section Ke', type: 'text' },
          { name: 'type', label: 'Voltage', type: 'select', options: [{ value: '', label: '—' }, { value: '11KV', label: '11KV' }, { value: '33KV', label: '33KV' }] },
          { name: 'area', label: 'PE Name/Street Name', type: 'text' },
          { name: 'feeder_involved', label: 'Feeder Involved', type: 'text', hidden: true },
          { name: 'visit_date', label: 'Visit Date', type: 'date', hidden: true },
          { name: 'patrol_time', label: 'Patrol Time', type: 'time', hidden: true },
        ],
      },
      {
        title: 'Defects',
        fields: [
          { name: 'cover_status', label: 'Cover Tutup', type: 'checkbox' },
          // The API has no lock flag for link box; the client's defect list wants
          // "Locked" in this position, so guard_status carries it. Column name
          // unchanged on the API.
          { name: 'guard_status', label: 'Locked', type: 'checkbox' },
          { name: 'vandalism_status', label: 'Vandalism', type: 'checkbox' },
          { name: 'leaning_status', label: 'Condong', type: 'checkbox' },
          { name: 'rust_status', label: 'Berkarat', type: 'checkbox' },
          { name: 'paint_status', label: 'Cat Pudar', type: 'checkbox' },
          { name: 'advertise_poster_status', label: 'Iklan Haram/Banner', type: 'checkbox' },
          { name: 'leaning_angle', label: 'Leaning Angle', type: 'text', hidden: true },
          { name: 'bushes_status', label: 'Bushy', type: 'checkbox', hidden: true },
          { name: 'semak', label: 'Semak', type: 'checkbox', hidden: true },
        ],
      },
      {
        title: 'Link Box Images',
        fields: [
          { name: 'link_box_1', label: 'Link Box Image 1', type: 'image', required: true },
          { name: 'link_box_2', label: 'Link Box Image 2', type: 'image', required: true },
          { name: 'name_plate', label: 'Name Plate Image', type: 'image' },
          { name: 'gate_locked', label: 'Gate Locked', type: 'image' },
          { name: 'gate_before', label: 'Gate Before', type: 'image' },
          { name: 'gate_during', label: 'Gate During', type: 'image' },
          { name: 'gate_after', label: 'Gate After', type: 'image' },
          { name: 'banner_before', label: 'Banner Before', type: 'image' },
          { name: 'banner_during', label: 'Banner During', type: 'image' },
          { name: 'banner_after', label: 'Banner After', type: 'image' },
          { name: 'crepers_before', label: 'Bushy/Creepers Before', type: 'image' },
          { name: 'crepers_during', label: 'Bushy/Creepers During', type: 'image' },
          { name: 'crepers_after', label: 'Bushy/Creepers After', type: 'image' },
          { name: 'semak', label: 'Semak Image', type: 'image' },
          { name: 'vandalism', label: 'Vandalism Image', type: 'image' },
          { name: 'leaning', label: 'Leaning Image', type: 'image' },
          { name: 'rust', label: 'Rust Image', type: 'image' },
          { name: 'other', label: 'Other Image', type: 'image' },
          { name: 'other_1', label: 'Other Image 1', type: 'image' },
          { name: 'other_2', label: 'Other Image 2', type: 'image' },
          { name: 'other_3', label: 'Other Image 3', type: 'image' },
        ],
      },
    ],
  },

  // ================================================================
  // Cable Bridge
  // ================================================================
  cable_bridge: {
    key: 'cable_bridge',
    endpoint: 'cable-bridge',
    tableName: 'tbl_cable_bridge',
    title: 'Cable Bridge',
    subtitle: 'Cable Bridge Inspection',
    icon: 'bridge',
    color: '#16a34a',
    filters: [
      { name: 'cycle', label: 'Cycle', type: 'number', default: 1 },
      { name: 'qa_status', label: 'QA Status', type: 'select', default: '', options: [{ value: '', label: 'All' }, { value: 'Pending', label: 'Pending' }, { value: 'Accept', label: 'Accepted' }, { value: 'Reject', label: 'Rejected' }] },
    ],
    columns: [
      { key: 'feeder_involved', label: 'Feeder' },
      { key: 'voltage', label: 'Voltage' },
      { key: 'total_defects', label: 'Defects', type: 'badge' },
      { key: 'qa_status', label: 'QA', type: 'qa_status' },
      { key: 'updated_at', label: 'Updated', type: 'datetime' },
    ],
    sections: [
      {
        title: 'General Info',
        fields: [
          { name: 'feeder_involved', label: 'Feeder Involved', type: 'text', hidden: true },
          { name: 'area', label: 'PE Name/Street Name', type: 'text', hidden: true },
          { name: 'start_date', label: 'Start Date', type: 'date', hidden: true },
          { name: 'end_date', label: 'End Date', type: 'date', hidden: true },
          { name: 'voltage', label: 'Voltage', type: 'select', options: [{ value: '', label: '—' }, { value: '11kv', label: '11kv' }, { value: '33kv', label: '33kv' }] },
          { name: 'visit_date', label: 'Survey Date', type: 'date', required: true },
          { name: 'patrol_time', label: 'Patrol Time', type: 'time', hidden: true },
        ],
      },
      {
        title: 'Defects',
        fields: [
          { name: 'vandalism_status', label: 'Vandalism', type: 'checkbox' },
          { name: 'pipe_status', label: 'Paip pecah', type: 'checkbox' },
          { name: 'collapsed_status', label: 'Runtuh', type: 'checkbox' },
          { name: 'rust_status', label: 'Berkarat', type: 'checkbox' },
          { name: 'danger_sign', label: 'Sign Bahaya', type: 'checkbox' },
          { name: 'anti_crossing_device', label: 'Anti-Cross', type: 'checkbox' },
          { name: 'condong', label: 'Conding', type: 'checkbox' },
          { name: 'pencerobohan', label: 'Pencerobohan', type: 'checkbox' },
          { name: 'bushes_status', label: 'Semak samun', type: 'checkbox' },
          { name: 'kebersihan_jabatan', label: 'Kebersihan', type: 'checkbox' },
        ],
      },
      {
        title: 'Cable Bridge Images',
        fields: [
          { name: 'cable_bridge_1', label: 'Cable Bridge Image 1', type: 'image', required: true },
          { name: 'cable_bridge_2', label: 'Cable Bridge Image 2', type: 'image', required: true },
          { name: 'name_plate', label: 'Name Plate Image', type: 'image' },
          { name: 'vandalism', label: 'Vandalism Image', type: 'image' },
          { name: 'leaning', label: 'Leaning Image', type: 'image' },
          { name: 'rust', label: 'Rust Image', type: 'image' },
          { name: 'collapsed', label: 'Collapsed Image', type: 'image' },
          { name: 'pipe_broken', label: 'Pipe Broken Image', type: 'image' },
          { name: 'anti_crossing', label: 'Anti-Crossing Image', type: 'image' },
          { name: 'danger_sign', label: 'Danger Sign Image', type: 'image' },
          { name: 'other', label: 'Other Image', type: 'image' },
          { name: 'other_1', label: 'Other Image 1', type: 'image' },
          { name: 'other_2', label: 'Other Image 2', type: 'image' },
          { name: 'other_3', label: 'Other Image 3', type: 'image' },
        ],
      },
    ],
  },

  // ================================================================
  // Height Clearance
  // ================================================================
  height_clearance: {
    key: 'height_clearance',
    endpoint: 'height-clearance',
    tableName: 'tbl_height_clerance',
    // Height clearance drops its OWN pin: it has its own geometry table
    // (height_clerance_geometry) and its own POST /geometry/height-clearance.
    // It was configured as attachToPole, which painted SAVR poles on the map and
    // hid the create button, leaving no way to add a record from the web at all.
    // It still belongs to a pole — savr_id is NOT NULL — but the surveyor is not
    // asked for it separately: `savrIdFrom` says the parent pole is whichever pole
    // the span starts at, and the form copies it across on save.
    savrIdFrom: 'from_id',
    title: 'Height Clearance',
    subtitle: 'Clearance Distance Inspection',
    icon: 'ruler',
    color: '#9333ea',
    filters: [
      { name: 'cycle', label: 'Cycle', type: 'number', default: 1 },
      { name: 'qa_status', label: 'QA Status', type: 'select', default: '', options: [{ value: '', label: 'All' }, { value: 'Pending', label: 'Pending' }, { value: 'Accept', label: 'Accepted' }, { value: 'Reject', label: 'Rejected' }] },
    ],
    columns: [
      { key: 'savr_tiang_no', label: 'From Pole' },
      { key: 'clearance_distance_m', label: 'Clearance (m)' },
      { key: 'comply', label: 'Comply', type: 'badge' },
      { key: 'qa_status', label: 'QA', type: 'qa_status' },
      { key: 'updated_at', label: 'Updated', type: 'datetime' },
    ],
    sections: [
      {
        // A clearance is a span between two poles, so those two ARE the general
        // info — there is nothing else to ask here.
        //
        // There is no separate parent-pole picker. tbl_height_clerance.savr_id is
        // NOT NULL, but asking for the same pole a third time is a question the
        // surveyor should not have to answer: the record's parent pole IS the pole
        // the span starts at, so the form sets savr_id from "From Pole".
        title: 'General Info',
        fields: [
          // Poles only. Either end could in principle be a link box, cable bridge
          // or feeder pillar — the columns are polymorphic — but a height clearance
          // is measured pole to pole, and restricting the type is also what lets
          // savr_id be taken from the From end.
          { name: 'from_id', typeField: 'from_type', assetType: 'tbl_savr',
            label: 'From Pole', type: 'asset-select', required: true },
          { name: 'to_id', typeField: 'to_type', assetType: 'tbl_savr',
            label: 'To Pole', type: 'asset-select', required: true },
        ],
      },
      {
        title: 'Site Condition',
        fields: [
          { name: 'crossing_road', label: 'Melintasi Jalan Raya', type: 'checkbox' },
          { name: 'side_walk', label: 'Tanah Lapang', type: 'checkbox' },
          { name: 'no_vehicle_entry_area', label: 'Kenderaan Tidak Boleh Masuk', type: 'checkbox' },
          { name: 'paddy_f', label: 'Sawah Padi', type: 'checkbox' },
          { name: 'road', label: 'Jalan', type: 'checkbox' },
          { name: 'forest', label: 'Hutan', type: 'checkbox' },
          { name: 'other', label: 'Others', type: 'checkbox' },
        ],
      },
      {
        title: 'Clearance',
        fields: [
          { name: 'comply', label: 'Comply', type: 'checkbox' },
          { name: 'clearance_distance_m', label: 'Clearance Distance (m)', type: 'number', step: '0.01' },
        ],
      },
      {
        title: 'Equipment Images',
        fields: [
          { name: 'image_pole_no', label: 'Image Pole No / Equipment', type: 'image', required: true },
          { name: 'eqp_reading', label: 'Image Equipment Reading', type: 'image', required: true },
          { name: 'other', label: 'Other Image', type: 'image' },
        ],
      },
    ],
  },

  // ================================================================
  // FFW (Five Foot Way)
  // ================================================================
  ffw: {
    key: 'ffw',
    endpoint: 'ffw',
    tableName: 'tbl_ffw',
    title: 'FFW',
    subtitle: 'Five Foot Way Inspection',
    icon: 'home',
    color: '#0891b2',
    filters: [
      { name: 'cycle', label: 'Cycle', type: 'number', default: 1 },
      { name: 'qa_status', label: 'QA Status', type: 'select', default: '', options: [{ value: '', label: 'All' }, { value: 'Pending', label: 'Pending' }, { value: 'Accept', label: 'Accepted' }, { value: 'Reject', label: 'Rejected' }] },
    ],
    columns: [
      { key: 'savr_id', label: 'SAVR Ref' },
      { key: 'house_no', label: 'House No' },
      { key: 'arus_bocor', label: 'Arus Bocor', type: 'badge' },
      { key: 'qa_status', label: 'QA', type: 'qa_status' },
      { key: 'updated_at', label: 'Updated', type: 'datetime' },
    ],
    sections: [
      {
        title: 'General Info',
        fields: [
          { name: 'savr_id', label: 'Parent SAVR Record', type: 'savr-select', required: true },
        ],
      },
      {
        title: 'FFW Reading',
        fields: [
          { name: 'house_no', label: 'House No', type: 'text' },
          { name: 'arus_bocor', label: 'Arus Bocor (Leakage Current)', type: 'checkbox' },
        ],
      },
      {
        title: 'Equipment Images',
        fields: [
          { name: 'image_pole_no', label: 'Image Pole No / Equipment', type: 'image', required: true },
          { name: 'eqp_reading', label: 'Image Equipment Reading', type: 'image', required: true },
          { name: 'ffw_cable', label: 'FFW Cable Image', type: 'image' },
          { name: 'cable_supply', label: 'Cable Supply Image', type: 'image' },
          { name: 'meter_box', label: 'Meter Box Image', type: 'image' },
          { name: 'front_house', label: 'Front House Image', type: 'image' },
          { name: 'other', label: 'Other Image', type: 'image' },
        ],
      },
    ],
  },
}

/**
 * The defect fields a module's table can be filtered by: every checkbox and
 * yes/no select in the sections that record defects, labelled by section so
 * the many "Others" stay distinguishable. Field names double as the API's
 * column names for the list endpoint's `defects` param.
 */
const DEFECT_SECTION = /defect|gate status|grounds|site condition|ffw reading/i
// Ticked-when-fine, not a defect.
const NOT_A_DEFECT = new Set(['gate_locked', 'comply', 'is_surveyed', 'main_line_service'])

export function defectOptions(config) {
  const out = []
  const walk = (sections) => {
    for (const sec of sections || []) {
      if (DEFECT_SECTION.test(sec.title || '')) {
        for (const f of sec.fields || []) {
          if (f.hidden || NOT_A_DEFECT.has(f.name)) continue
          const yesNo = f.type === 'select' && (f.options || []).some((o) => o.value === '1')
          if (f.type !== 'checkbox' && !yesNo) continue
          out.push({ value: f.name, label: f.label, group: sec.title.replace(/\s*defects?$/i, '') })
        }
      }
      walk(sec.sections)
    }
  }
  if (config.isWizard) for (const step of config.wizardSteps || []) walk(step.sections)
  else walk(config.sections)
  return out
}

export const SURVEY_LIST = Object.values(SURVEY_TYPES)

// Survey types that exist in the API but are not offered as their own module in
// the web UI. Arus used to be listed here; it is not a survey type at all any
// more, so its config is gone rather than hidden — leakage readings are child
// rows edited inside the SAVR pole form (see the 'arus' component section).
export const HIDDEN_SURVEY_KEYS = []

export const VISIBLE_SURVEY_LIST = SURVEY_LIST.filter(
  (survey) => !HIDDEN_SURVEY_KEYS.includes(survey.key)
)

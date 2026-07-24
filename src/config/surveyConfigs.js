/**
 * Survey field configurations — mirrors the old Laravel forms exactly.
 * Field types: text, textarea, number, date, time, select, radio, checkbox,
 * defect-group, span-group, image
 */

const ZONE_OPTIONS = [
  { value: '', label: '— Select Zone —' },
  { value: 'W1', label: 'W1' },
  { value: 'B1', label: 'B1' },
  { value: 'B2', label: 'B2' },
  { value: 'B4', label: 'B4' },
]

const YES_NO = [
  { value: '', label: '— Select —' },
  { value: 'Yes', label: 'Yes' },
  { value: 'No', label: 'No' },
]

export const SURVEY_TYPES = {
  // ================================================================
  // SAVR — Tiang (6-step wizard)
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
              { name: 'ba', label: 'BA', type: 'select', required: true, options: ZONE_OPTIONS },
              { name: 'fp_name', label: 'Name of Substation / Feeder Pillar', type: 'text', required: true },
              { name: 'fp_road', label: 'Feeder Name / Street Name', type: 'text', required: true },
              { name: 'section_from', label: 'Section From', type: 'text' },
              { name: 'section_to', label: 'Section To', type: 'text' },
              { name: 'tiang_no', label: 'Tiang No', type: 'text', required: true },
              { name: 'review_date', label: 'Visit Date', type: 'date', required: true },
              {
                name: 'talian_utama_servis', label: 'Main Line (M) / Servis (S)', type: 'radio',
                options: [{ value: 'm', label: 'Main Line' }, { value: 's', label: 'Service Line' }],
              },
              { name: 'talian_utama', label: 'Number of Services (1 user only)', type: 'number' },
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
              { name: 'pole_image_1', label: 'Pole Image 1', type: 'image', required: true },
              { name: 'pole_image_2', label: 'Pole Image 2', type: 'image', required: true },
              { name: 'pole_image_3', label: 'Pole Image 3', type: 'image' },
              { name: 'pole_image_4', label: 'Pole Image 4', type: 'image' },
              { name: 'pole_image_5', label: 'Pole Image 5', type: 'image' },
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
                name: 'size_tiang', label: 'Pole Size Bill', type: 'radio',
                options: [{ value: '7.5', label: '7.5' }, { value: '9', label: '9' }, { value: '10', label: '10' }],
              },
              {
                name: 'jenis_tiang', label: 'Pole Type', type: 'radio',
                options: [{ value: 'spun', label: 'Spun' }, { value: 'concrete', label: 'Concrete' }, { value: 'iron', label: 'Iron' }, { value: 'wood', label: 'Wood' }],
              },
            ],
          },
          {
            title: 'Span Data',
            fields: [
              {
                name: 'abc_span', label: 'ABC Span', type: 'span-group',
                subFields: [
                  { key: 's3_185', label: '3 X 185' }, { key: 's3_95', label: '3 X 95' }, { key: 's3_16', label: '3 X 16' }, { key: 's1_16', label: '1 X 16' },
                ],
              },
              {
                name: 'pvc_span', label: 'PVC Span', type: 'span-group',
                subFields: [
                  { key: 's19_064', label: '19/064' }, { key: 's7_083', label: '7/083' }, { key: 's7_044', label: '7/044' },
                ],
              },
              {
                name: 'bare_span', label: 'BARE Span', type: 'span-group',
                subFields: [
                  { key: 's7_173', label: '7/173' }, { key: 's7_122', label: '7/122' }, { key: 's3_132', label: '3/132' },
                ],
              },
              {
                name: 'bil_counts', label: 'Counts', type: 'span-group',
                subFields: [
                  { key: 'bil_umbang', label: 'BIL UMBANG' }, { key: 'bil_black_box', label: 'Bil BLACK BOX' }, { key: 'bil_lvpt', label: 'BIL LVPT' },
                ],
              },
            ],
          },
        ],
      },
      {
        title: 'Kejanggalan',
        sections: [
          {
            title: 'Defects',
            fields: [
              { name: 'tiang_defect', label: 'Pole', type: 'defect-group', checkboxes: ['cracked', 'leaning', 'dim', 'creepers', 'other'] },
              { name: 'talian_defect', label: 'Line (Main/Service)', type: 'defect-group', checkboxes: ['joint', 'need_rentis', 'ground', 'talian_sbum', 'other'] },
              { name: 'umbang_defect', label: 'Umbang', type: 'defect-group', checkboxes: ['breaking', 'creepers', 'cracked', 'stay_palte', 'other'] },
              { name: 'ipc_defect', label: 'IPC', type: 'defect-group', checkboxes: ['burn', 'ipc_n_krg2', 'ec_tiada', 'other'] },
              { name: 'blackbox_defect', label: 'Black Box', type: 'defect-group', checkboxes: ['cracked', 'other'] },
              { name: 'jumper', label: 'Jumper', type: 'defect-group', checkboxes: ['sleeve', 'burn', 'other'] },
              { name: 'kilat_defect', label: 'Lightning Catcher', type: 'defect-group', checkboxes: ['broken', 'other'] },
              { name: 'servis_defect', label: 'Service', type: 'defect-group', checkboxes: ['roof', 'won_piece', 'other'] },
              { name: 'pembumian_defect', label: 'Grounding', type: 'defect-group', checkboxes: ['netural', 'other'] },
              { name: 'bekalan_dua_defect', label: 'Two Way Supply Signage', type: 'defect-group', checkboxes: ['damage', 'other'] },
              { name: 'kaki_lima_defect', label: 'Main Street', type: 'defect-group', checkboxes: ['date_wire', 'burn', 'usikan_pengguna', 'other'] },
            ],
          },
        ],
      },
      {
        title: 'Height Clearance',
        sections: [
          {
            title: 'Site Conditions',
            fields: [
              { name: 'tapak_condition', label: 'Site Condition', type: 'defect-group', checkboxes: ['road', 'side_walk', 'vehicle_entry'] },
              { name: 'kawasan', label: 'Area', type: 'defect-group', checkboxes: ['bend', 'road', 'forest', 'other'] },
              { name: 'jarak_kelegaan', label: 'Clearance Distance', type: 'text' },
              {
                name: 'talian_spec', label: 'Line Clearance Spec', type: 'radio',
                options: [{ value: 'comply', label: 'Comply' }, { value: 'uncomply', label: 'Not Comply' }],
              },
            ],
          },
        ],
      },
      {
        title: 'Kebocoran Arus',
        sections: [
          {
            title: 'Current Leakage',
            fields: [
              { name: 'tiang_defect_current_leakage', label: 'Current Leakage on Pole', type: 'radio', options: [{ value: 'No', label: 'No' }, { value: 'Yes', label: 'Yes' }] },
              { name: 'umbang_defect_current_leakage', label: 'Current Leakage on Umbang', type: 'radio', options: [{ value: 'No', label: 'No' }, { value: 'Yes', label: 'Yes' }] },
              { name: 'hazard_defect', label: 'Hazard Defect', type: 'radio', options: [{ value: 'No', label: 'No' }, { value: 'Yes', label: 'Yes' }] },
              { name: 'five_feet_away', label: 'Five Feet Away', type: 'text' },
              { name: 'ffa_no_of_houses', label: 'FFA No of Houses', type: 'text' },
              { name: 'ffa_house_no', label: 'FFA House No', type: 'textarea' },
            ],
          },
          {
            title: 'Cleanup Images',
            fields: [
              { name: 'clean_banner_image', label: 'Clean Banner', type: 'image' },
              { name: 'remove_creepers_image', label: 'Remove Creepers', type: 'image' },
              { name: 'current_leakage_image', label: 'Current Leakage', type: 'image' },
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
          { name: 'zone', label: 'Zone', type: 'select', required: true, options: ZONE_OPTIONS },
          { name: 'ba', label: 'BA', type: 'select', required: true, options: [{ value: '', label: '— Select BA —' }] },
          { name: 'fl', label: 'FL Substation', type: 'text', required: true },
          { name: 'name', label: 'Substation/Feeder Pillar Name', type: 'text', required: true },
          { name: 'type', label: 'Type', type: 'select', options: [{ value: '', label: '—' }, { value: 'Indoor', label: 'Indoor' }, { value: 'Attach Building', label: 'Attach Building' }, { value: 'Outdoor', label: 'Outdoor' }, { value: 'Padat', label: 'Padat' }, { value: 'PAT', label: 'Pencawang Atas Tiang (PAT)' }] },
          { name: 'voltage', label: 'Voltage', type: 'select', options: [{ value: '', label: '—' }, { value: '11kv', label: '11kv' }, { value: '13kv', label: '13kv' }] },
          { name: 'visit_date', label: 'Survey Date', type: 'date', required: true },
          { name: 'patrol_time', label: 'Patrol Time', type: 'time', required: true },
        ],
      },
      {
        title: 'Gate Status',
        fields: [
          {
            name: 'gate_status', label: 'Gate', type: 'defect-group',
            checkboxes: ['locked', 'unlocked', 'demaged', 'other'],
            radioKeys: ['locked', 'unlocked'],
          },
          { name: 'grass_status', label: 'Long Grass', type: 'select', options: YES_NO },
          { name: 'tree_branches_status', label: 'Tree Branches in P.E', type: 'select', options: YES_NO },
        ],
      },
      {
        title: 'Building Defects',
        fields: [
          { name: 'building_status', label: 'Building', type: 'defect-group', checkboxes: ['broken_roof', 'broken_gutter', 'broken_base', 'other'] },
          { name: 'advertise_poster_status', label: 'Cleaning Illegal Ads/Banners', type: 'select', options: YES_NO },
        ],
      },
      {
        title: 'Substation Images',
        fields: [
          { name: 'substation_image_1', label: 'Substation Image 1', type: 'image', required: true },
          { name: 'substation_image_2', label: 'Substation Image 2', type: 'image', required: true },
        ],
      },
      {
        title: 'Gate Images',
        fields: [
          { name: 'image_gate', label: 'Image Gate', type: 'image' },
          { name: 'image_gate_2', label: 'Image Gate 2', type: 'image' },
          { name: 'images_gate_after_lock', label: 'Gate After Lock', type: 'image' },
          { name: 'images_gate_after_lock_2', label: 'Gate After Lock 2', type: 'image' },
        ],
      },
      {
        title: 'Defect Images',
        fields: [
          { name: 'image_grass', label: 'Image Grass', type: 'image' },
          { name: 'image_grass_2', label: 'Image Grass 2', type: 'image' },
          { name: 'image_tree_branches', label: 'Image Tree Branches', type: 'image' },
          { name: 'image_tree_branches_2', label: 'Image Tree Branches 2', type: 'image' },
          { name: 'image_building', label: 'Image Building', type: 'image' },
          { name: 'image_building_2', label: 'Image Building 2', type: 'image' },
          { name: 'image_advertisement_before_1', label: 'Advertise Poster', type: 'image' },
          { name: 'image_advertisement_before_2', label: 'Advertise Poster 2', type: 'image' },
          { name: 'image_advertisement_after_1', label: 'Advertise Poster Removal', type: 'image' },
          { name: 'image_advertisement_after_2', label: 'Advertise Poster Removal 2', type: 'image' },
          { name: 'other_image', label: 'Other Image', type: 'image' },
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
      { key: 'area', label: 'Area' },
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
          { name: 'zone', label: 'Zone', type: 'select', required: true, options: ZONE_OPTIONS },
          { name: 'ba', label: 'BA', type: 'select', required: true, options: [{ value: '', label: '— Select BA —' }] },
          { name: 'size', label: 'Size', type: 'select', required: true, options: [{ value: '', label: '—' }, { value: '400', label: '400' }, { value: '800', label: '800' }, { value: '1600', label: '1600' }] },
          { name: 'visit_date', label: 'Survey Date', type: 'date', required: true },
          { name: 'patrol_time', label: 'Patrol Time', type: 'time', required: true },
        ],
      },
      {
        title: 'Gate Status',
        fields: [
          { name: 'gate_status', label: 'Gate', type: 'defect-group', checkboxes: ['unlocked', 'demaged', 'other'] },
        ],
      },
      {
        title: 'Defects',
        fields: [
          { name: 'vandalism_status', label: 'Vandalism', type: 'select', options: YES_NO },
          { name: 'leaning_status', label: 'Leaning', type: 'select', options: YES_NO },
          { name: 'leaning_angle', label: 'Leaning Angle', type: 'text' },
          { name: 'rust_status', label: 'Rusty', type: 'select', options: YES_NO },
          { name: 'guard_status', label: 'FP Guard', type: 'select', options: YES_NO },
          { name: 'paint_status', label: 'Paint Faded', type: 'select', options: YES_NO },
          { name: 'advertise_poster_status', label: 'Cleaning Illegal Ads/Banners', type: 'select', options: YES_NO },
        ],
      },
      {
        title: 'Feeder Pillar Images',
        fields: [
          { name: 'feeder_pillar_image_1', label: 'Feeder Pillar Image 1', type: 'image', required: true },
          { name: 'feeder_pillar_image_2', label: 'Feeder Pillar Image 2', type: 'image', required: true },
          { name: 'image_name_plate', label: 'Name Plate Image', type: 'image', required: true },
        ],
      },
      {
        title: 'Defect Images',
        fields: [
          { name: 'image_gate', label: 'Image Gate', type: 'image' },
          { name: 'image_gate_2', label: 'Image Gate 2', type: 'image' },
          { name: 'image_vandalism', label: 'Image Vandalism', type: 'image' },
          { name: 'image_vandalism_2', label: 'Image Vandalism 2', type: 'image' },
          { name: 'image_leaning', label: 'Image Leaning', type: 'image' },
          { name: 'image_leaning_2', label: 'Image Leaning 2', type: 'image' },
          { name: 'image_rust', label: 'Image Rust', type: 'image' },
          { name: 'image_rust_2', label: 'Image Rust 2', type: 'image' },
          { name: 'images_advertise_poster', label: 'Advertise Poster', type: 'image' },
          { name: 'images_advertise_poster_2', label: 'Advertise Poster 2', type: 'image' },
          { name: 'image_advertisement_after_1', label: 'Advertise Poster Removal', type: 'image' },
          { name: 'image_advertisement_after_2', label: 'Advertise Poster Removal 2', type: 'image' },
          { name: 'other_image', label: 'Other Image', type: 'image' },
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
      { key: 'feeder_involved', label: 'Feeder' },
      { key: 'type', label: 'Type' },
      { key: 'total_defects', label: 'Defects', type: 'badge' },
      { key: 'qa_status', label: 'QA', type: 'qa_status' },
      { key: 'updated_at', label: 'Updated', type: 'datetime' },
    ],
    sections: [
      {
        title: 'General Info',
        fields: [
          { name: 'zone', label: 'Zone', type: 'select', required: true, options: ZONE_OPTIONS },
          { name: 'ba', label: 'BA', type: 'select', required: true, options: [{ value: '', label: '— Select BA —' }] },
          { name: 'start_date', label: 'From (section)', type: 'text' },
          { name: 'end_date', label: 'To (section)', type: 'text' },
          { name: 'type', label: 'Type', type: 'select', options: [{ value: '', label: '—' }, { value: '11KV', label: '11KV' }, { value: '33KV', label: '33KV' }] },
          { name: 'visit_date', label: 'Visit Date', type: 'date', required: true },
          { name: 'patrol_time', label: 'Patrol Time', type: 'time', required: true },
        ],
      },
      {
        title: 'Defects',
        fields: [
          { name: 'cover_status', label: 'Cover is not closed', type: 'select', options: YES_NO },
          { name: 'vandalism_status', label: 'Vandalism', type: 'select', options: YES_NO },
          { name: 'leaning_status', label: 'Leaning', type: 'select', options: YES_NO },
          { name: 'leaning_angle', label: 'Leaning Angle', type: 'text' },
          { name: 'rust_status', label: 'Rusty', type: 'select', options: YES_NO },
          { name: 'paint_status', label: 'Paint Faded', type: 'select', options: YES_NO },
          { name: 'advertise_poster_status', label: 'Cleaning Illegal Ads/Banners', type: 'select', options: YES_NO },
          { name: 'bushes_status', label: 'Bushy', type: 'select', options: YES_NO },
        ],
      },
      {
        title: 'Link Box Images',
        fields: [
          { name: 'link_box_image_1', label: 'Link Box Image 1', type: 'image', required: true },
          { name: 'link_box_image_2', label: 'Link Box Image 2', type: 'image', required: true },
        ],
      },
      {
        title: 'Defect Images',
        fields: [
          { name: 'image_cover', label: 'Cover Image', type: 'image' },
          { name: 'image_cover_2', label: 'Cover Image 2', type: 'image' },
          { name: 'image_vandalism', label: 'Image Vandalism', type: 'image' },
          { name: 'image_vandalism_2', label: 'Image Vandalism 2', type: 'image' },
          { name: 'image_leaning', label: 'Image Leaning', type: 'image' },
          { name: 'image_leaning_2', label: 'Image Leaning 2', type: 'image' },
          { name: 'image_rust', label: 'Image Rust', type: 'image' },
          { name: 'image_rust_2', label: 'Image Rust 2', type: 'image' },
          { name: 'images_advertise_poster', label: 'Advertise Poster', type: 'image' },
          { name: 'images_advertise_poster_2', label: 'Advertise Poster 2', type: 'image' },
          { name: 'image_advertisement_after_1', label: 'Advertise Poster Removal', type: 'image' },
          { name: 'image_advertisement_after_2', label: 'Advertise Poster Removal 2', type: 'image' },
          { name: 'images_bushes', label: 'Image Bushes', type: 'image' },
          { name: 'images_bushes_2', label: 'Image Bushes 2', type: 'image' },
          { name: 'other_image', label: 'Other Image', type: 'image' },
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
          { name: 'zone', label: 'Zone', type: 'select', required: true, options: ZONE_OPTIONS },
          { name: 'ba', label: 'BA', type: 'select', required: true, options: [{ value: '', label: '— Select BA —' }] },
          { name: 'start_date', label: 'From (section)', type: 'text' },
          { name: 'end_date', label: 'To (section)', type: 'text' },
          { name: 'voltage', label: 'Voltage', type: 'select', options: [{ value: '', label: '—' }, { value: '11kv', label: '11kv' }, { value: '13kv', label: '13kv' }] },
          { name: 'visit_date', label: 'Survey Date', type: 'date', required: true },
          { name: 'patrol_time', label: 'Patrol Time', type: 'time', required: true },
        ],
      },
      {
        title: 'Defects',
        fields: [
          { name: 'vandalism_status', label: 'Vandalism', type: 'select', options: YES_NO },
          { name: 'pipe_status', label: 'Pipe Broken', type: 'select', options: YES_NO },
          { name: 'collapsed_status', label: 'Collapsed', type: 'select', options: YES_NO },
          { name: 'rust_status', label: 'Rusty', type: 'select', options: YES_NO },
          { name: 'danger_sign', label: 'Danger Sign', type: 'select', options: YES_NO },
          { name: 'anti_crossing_device', label: 'Anti Crossing Device', type: 'select', options: YES_NO },
          { name: 'condong', label: 'Leaning', type: 'select', options: YES_NO },
          { name: 'pencerobohan', label: 'Trespass', type: 'select', options: YES_NO },
          { name: 'bushes_status', label: 'Bushy', type: 'select', options: YES_NO },
          { name: 'kebersihan_jabatan', label: 'Cleanliness', type: 'select', options: YES_NO },
        ],
      },
      {
        title: 'Cable Bridge Images',
        fields: [
          { name: 'cable_bridge_image_1', label: 'Cable Bridge Image 1', type: 'image', required: true },
          { name: 'cable_bridge_image_2', label: 'Cable Bridge Image 2', type: 'image', required: true },
        ],
      },
      {
        title: 'Defect Images',
        fields: [
          { name: 'image_vandalism', label: 'Image Vandalism', type: 'image' },
          { name: 'image_vandalism_2', label: 'Image Vandalism 2', type: 'image' },
          { name: 'image_pipe', label: 'Image Pipe', type: 'image' },
          { name: 'image_pipe_2', label: 'Image Pipe 2', type: 'image' },
          { name: 'image_collapsed', label: 'Image Collapsed', type: 'image' },
          { name: 'image_collapsed_2', label: 'Image Collapsed 2', type: 'image' },
          { name: 'image_rust', label: 'Image Rust', type: 'image' },
          { name: 'image_rust_2', label: 'Image Rust 2', type: 'image' },
          { name: 'danger_sign_img', label: 'Danger Sign Image', type: 'image' },
          { name: 'anti_cross_device_img', label: 'Anti Crossing Device Image', type: 'image' },
          { name: 'images_bushes', label: 'Image Bushes', type: 'image' },
          { name: 'images_bushes_2', label: 'Image Bushes 2', type: 'image' },
          { name: 'other_image', label: 'Other Image', type: 'image' },
        ],
      },
    ],
  },
}

export const SURVEY_LIST = Object.values(SURVEY_TYPES)

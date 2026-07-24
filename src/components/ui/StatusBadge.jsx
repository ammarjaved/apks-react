const STATUS_CONFIG = {
  Accept: { label: 'Accepted', class: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
  Reject: { label: 'Rejected', class: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
  Pending: { label: 'Pending', class: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-500' },
  None: { label: 'Unsurveyed', class: 'bg-gray-100 text-gray-500', dot: 'bg-gray-400' },
}

export default function StatusBadge({ status }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.None
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${config.class}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  )
}

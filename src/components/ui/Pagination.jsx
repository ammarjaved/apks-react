export function TableCount({ total, noun = 'records' }) {
  const n = Number(total) || 0
  return (
    <p className="text-sm text-gray-500">
      Total <span className="font-medium text-gray-700">{n.toLocaleString()}</span>{' '}
      {n === 1 ? singular(noun) : noun}
    </p>
  )
}

function singular(noun) {
  if (noun.endsWith('ies')) return `${noun.slice(0, -3)}y`
  if (noun.endsWith('s')) return noun.slice(0, -1)
  return noun
}

export default function Pagination({ pagination, onPageChange }) {
  if (!pagination) return null
  const { page, total, total_pages, has_next, has_previous } = pagination

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
      <TableCount total={total} />
      <div className="flex items-center gap-3">
        <p className="text-sm text-gray-500">
          Page <span className="font-medium text-gray-700">{page}</span> of{' '}
          <span className="font-medium text-gray-700">{total_pages || 1}</span>
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={!has_previous}
            className="btn-secondary btn-sm"
          >
            Previous
          </button>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={!has_next}
            className="btn-secondary btn-sm"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  )
}

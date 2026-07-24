export default function Pagination({ pagination, onPageChange }) {
  if (!pagination) return null
  const { page, total_pages, has_next, has_previous } = pagination

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
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
  )
}

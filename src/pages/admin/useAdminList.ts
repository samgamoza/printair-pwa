import { useCallback, useEffect, useState } from 'react';
import type { PagedResult } from '@/lib/api/admin';

/**
 * Shared paginated-list state for the admin tables. Every admin page was
 * previously hand-rolling its own fetch effect — several without a .catch,
 * which left a page spinning forever on any network/RLS error. Centralizing
 * it here also gives every table pagination for free.
 */
export function useAdminList<T>(fetcher: (page: number, pageSize: number) => Promise<PagedResult<T>>, pageSize: number) {
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<T[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher(page, pageSize);
      setRows(result.rows);
      setCount(result.count);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong loading this list.');
    } finally {
      setLoading(false);
    }
  }, [fetcher, page, pageSize]);

  useEffect(() => {
    load();
  }, [load]);

  return { rows, count, page, setPage, loading, error, reload: load };
}

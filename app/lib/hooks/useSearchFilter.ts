import { useState, useMemo, useCallback } from 'react';
import { debounce } from '~/utils/debounce';

interface UseSearchFilterOptions<T extends object> {
  items: T[];
  searchFields?: (keyof T)[];
  debounceMs?: number;
}

export function useSearchFilter<T extends object>({
  items = [],
  searchFields,
  debounceMs = 300,
}: UseSearchFilterOptions<T>) {
  const [searchQuery, setSearchQuery] = useState('');
  const fields = searchFields ?? (['description'] as (keyof T)[]);

  const debouncedSetSearch = useCallback(debounce(setSearchQuery, debounceMs), [debounceMs]);

  const handleSearchChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      debouncedSetSearch(event.target.value);
    },
    [debouncedSetSearch],
  );

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) {
      return items;
    }

    const query = searchQuery.toLowerCase();

    return items.filter((item) =>
      fields.some((field) => {
        const value = item[field];

        if (typeof value === 'string') {
          return value.toLowerCase().includes(query);
        }

        return false;
      }),
    );
  }, [items, searchQuery, fields]);

  return {
    searchQuery,
    filteredItems,
    handleSearchChange,
  };
}

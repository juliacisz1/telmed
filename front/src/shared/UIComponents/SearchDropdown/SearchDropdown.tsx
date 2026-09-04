import {useState, useEffect, useRef, useCallback, useMemo, useId, type KeyboardEvent} from 'react';
import './SearchDropdown.css'
import '../../Styles/PageStyle.css'
import type {SearchItem} from "../../../types.ts";
import {MIN_QUERY_LENGTH, SEARCH_DEBOUNCE_MS} from '../../../constants.ts';
//https://dev.to/shahjalalbu/tutorial-how-to-build-a-searchable-dropdown-component-in-react-3fi4
//https://www.w3.org/WAI/ARIA/apg/patterns/combobox/

const useDebounce = (value: string, delay: number) => {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
        const handler = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(handler);
    }, [value, delay]);

    return debouncedValue;
};

type SearchDropdownBaseProps = {
    displayValue?: (item: SearchItem) => string;
    placeholder: string;
    onSelect?: (item: SearchItem) => void;
    onQueryChange?: (query: string) => void;
    initialQuery?: string;
    clearOnSelect?: boolean;
};

type LocalOptionsProps = {
    options: SearchItem[];
    fetchOptions?: never;
    fetchSuggestions?: never;
};

type RemoteOptionsProps = {
    options?: never;
    fetchOptions: (query: string) => Promise<SearchItem[]>;
    fetchSuggestions?: () => Promise<SearchItem[]>;
};

type SearchDropdownProps = SearchDropdownBaseProps & (LocalOptionsProps | RemoteOptionsProps);

function SearchDropdown({options, fetchOptions, fetchSuggestions, displayValue = (item) => item.label,
                            onSelect, onQueryChange, placeholder, clearOnSelect = false, initialQuery = ''}: SearchDropdownProps) {
    const [query, setQuery] = useState(initialQuery);
    const [fetchedOptions, setFetchedOptions] = useState<SearchItem[]>([]);
    const [defaultOptions, setDefaultOptions] = useState<SearchItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showDropdown, setShowDropdown] = useState(false);
    const [focusedIndex, setFocusedIndex] = useState(-1);
    const debouncedQuery = useDebounce(query, SEARCH_DEBOUNCE_MS);
    const lastSelected = useRef<string | null>(initialQuery || null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const requestId = useRef(0);
    const listboxId = useId();

    useEffect(() => {
        if (!fetchSuggestions) return;
        fetchSuggestions()
            .then(setDefaultOptions)
            .catch(() => setDefaultOptions([]));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!fetchOptions) return;

        const currentRequest = ++requestId.current;

        if (debouncedQuery.trim() && debouncedQuery.trim() === lastSelected.current) {
            setLoading(false);
            setError(null);
            setShowDropdown(false);
            return;
        }

        if (debouncedQuery.trim().length < MIN_QUERY_LENGTH) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setLoading(false);
            setError(null);
            setFetchedOptions([]);
            setShowDropdown(false);
            setFocusedIndex(-1);
            return;
        }

        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                const results = await fetchOptions(debouncedQuery.trim());
                if (currentRequest !== requestId.current) return;
                setFetchedOptions(results || []);
                setShowDropdown(true);
            } catch {
                if (currentRequest !== requestId.current) return;
                setError('Nie udało się pobrać wyników.');
                setFetchedOptions([]);
            } finally {
                if (currentRequest === requestId.current) {
                    setLoading(false);
                    setFocusedIndex(-1);
                }
            }
        };

        fetchData();
    }, [debouncedQuery, fetchOptions]);

    const displayItems = useMemo(() => {
        const trimmed = query.trim();
        if (options) {
            if (!trimmed) return options;
            const needle = trimmed.toLowerCase();
            return options.filter(item => displayValue(item).toLowerCase().includes(needle));
        }
        return trimmed ? fetchedOptions : defaultOptions;
    }, [options, query, displayValue, fetchedOptions, defaultOptions]);


    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node)
            ) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () =>
            document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = useCallback(
        (item: SearchItem) => {
            const nextQuery = clearOnSelect ? '' : displayValue(item);

            lastSelected.current = displayValue(item);
            onSelect?.(item);
            setQuery(nextQuery);
            onQueryChange?.(nextQuery);
            setShowDropdown(false);
            setFetchedOptions([]);
            setFocusedIndex(-1);

            requestId.current++;
            setLoading(false);
            setError(null);
        },
        [displayValue, onSelect, onQueryChange, clearOnSelect]
    );

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (!showDropdown || displayItems.length === 0) return;

        switch (event.key) {
            case 'ArrowDown':
                event.preventDefault();
                setFocusedIndex(prev => (prev + 1) % displayItems.length);
                break;
            case 'ArrowUp':
                event.preventDefault();
                setFocusedIndex(prev => (prev <= 0 ? displayItems.length - 1 : prev - 1));
                break;
            case 'Enter':
                event.preventDefault();
                if (focusedIndex >= 0) handleSelect(displayItems[focusedIndex]);
                break;
            case 'Escape':
                setShowDropdown(false);
                break;
        }
    };

    const renderedOptions = useMemo(() => {
        if (loading) return <li role='presentation' className='muted'>Ładowanie...</li>;
        if (error) return <li role='presentation' className='muted'>{error}</li>;

        const searchStarted = options ? query.trim().length > 0 : query.length >= MIN_QUERY_LENGTH;
        if (displayItems.length === 0 && searchStarted)
            return <li role='presentation' className='muted'>Brak wyników</li>;

        return displayItems.map((option, index) => {
            const isSelected = index === focusedIndex;
            return (
                <li
                    key={`${option.kind}:${option.id}`}
                    id={`${listboxId}-option-${index}`}
                    role='option'
                    aria-selected={isSelected}
                    onClick={() => handleSelect(option)}
                    onMouseEnter={() => setFocusedIndex(index)}
                    className={`dropdownItem ${isSelected ? 'dropdownItemActive' : ''}`}
                >{displayValue(option)}</li>
            );
        });
    }, [
        loading,
        error,
        options,
        displayItems,
        focusedIndex,
        query,
        displayValue,
        handleSelect,
        listboxId,
    ]);

    return (
        <div className='dropdownWrap' ref={dropdownRef}>
            <input
                type='text'
                placeholder={placeholder}
                value={query}
                onChange={event => {
                    lastSelected.current = null;
                    setQuery(event.target.value);
                    onQueryChange?.(event.target.value);
                }}
                onFocus={() => setShowDropdown(true)}
                onKeyDown={handleKeyDown}
                role='combobox'
                aria-autocomplete='list'
                aria-haspopup='listbox'
                aria-expanded={showDropdown}
                aria-controls={listboxId}
                aria-activedescendant={focusedIndex >= 0 ? `${listboxId}-option-${focusedIndex}` : undefined}
                className='input'
            />

            {showDropdown && (
                <ul id={listboxId} role='listbox' className='dropdown'>
                    {renderedOptions}
                </ul>
            )}
        </div>
    );
}

export default SearchDropdown;
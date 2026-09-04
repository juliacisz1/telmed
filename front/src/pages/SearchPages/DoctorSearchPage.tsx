import './DoctorSearchPage.css';
import '../../shared/Styles/PageStyle.css';
import {useState, useEffect, useRef} from 'react';
import {useNavigate, useSearchParams} from 'react-router-dom';
import {getDoctors} from '../../api/users.ts';
import {TopBar} from '../../shared/UIComponents/TopBar/TopBar.tsx';
import SearchDropdown from '../../shared/UIComponents/SearchDropdown/SearchDropdown.tsx';
import {fetchSpecialtySuggestions, searchDoctorsAndSpecialties} from '../../api/search.ts';
import {useAuth} from '../../context/AuthContext.tsx';
import type {DoctorPublic, SearchItem} from '../../types.ts';
import {TITLE_LABELS} from "../../constants.ts";

//https://react.dev/learn/preserving-and-resetting-state

export function DoctorSearchPage() {
    const [searchParams] = useSearchParams();
    const queryFromUrl = searchParams.get('q') ?? '';
    return <DoctorSearchView key={queryFromUrl} queryFromUrl={queryFromUrl} />;
}

function DoctorSearchView({queryFromUrl}: {queryFromUrl: string}) {
    const navigate = useNavigate();
    const {user} = useAuth();

    const [query, setQuery] = useState(queryFromUrl);
    const [results, setResults] = useState<DoctorPublic[]>([]);
    const [searchedQuery, setSearchedQuery] = useState<string | null>(null);
    const [error, setError] = useState('');
    const requestId = useRef(0);

    async function fetchDoctors(searchText: string) {
        const currentRequest = ++requestId.current;
        const trimmed = searchText.trim();

        setError('');
        try {
            const doctors = await getDoctors(trimmed);
            if (currentRequest !== requestId.current) return;
            setResults(doctors);
            setSearchedQuery(trimmed);
        } catch {
            if (currentRequest !== requestId.current) return;
            setResults([]);
            setSearchedQuery(trimmed);
            setError('Nie udało się wyszukać lekarzy.');
        }
    }

    useEffect(() => {
        if (queryFromUrl.trim()) {
            fetchDoctors(queryFromUrl);
        }
    }, []);

    function handleSearch() {
        const trimmed = query.trim();
        if (trimmed === queryFromUrl) {
            fetchDoctors(trimmed);
            return;
        }
        navigate(`/search?q=${encodeURIComponent(trimmed)}`, {replace: true});
    }

    function handleSelect(item: SearchItem) {
        if (item.kind === 'doctor') {
            navigate(`/doctors/${item.id}`);
            return;
        }
        setQuery(item.label);
        navigate(`/search?q=${encodeURIComponent(item.label)}`, {replace: true});
    }

    return (
        <div className="page">
            <TopBar logoTo={ user?.role === 'doctor' ? '/doctor' :
                user?.role === 'patient' ? '/patient' : '/'}
            >
                <button className="greenBtn"
                        type='button'
                        onClick={() => navigate(-1)}
                >
                    Powrót
                </button>
            </TopBar>

            <main className="searchMain">
                <section className="card">
                    <h1>Znajdź lekarza</h1>
                    <div className="row">
                        <SearchDropdown
                            fetchSuggestions={fetchSpecialtySuggestions}
                            fetchOptions={searchDoctorsAndSpecialties}
                            placeholder="Specjalizacja lub imię lekarza"
                            initialQuery={query}
                            onSelect={handleSelect}
                            onQueryChange={setQuery}
                        />
                        <button className="greenBtn"
                                type="button"
                                onClick={handleSearch}
                        >
                            Szukaj
                        </button>
                    </div>
                </section>

                {error && <p className="formError">{error}</p>}

                {!error && searchedQuery !== null && results.length === 0 && (<p className="muted">Brak wyników</p>)}

                {results.length > 0 && (
                    <section className="searchResults">
                        {results.map((doctor) => (
                            <div key={doctor.doctor_id} className="card clickableCard"
                                 onClick={() => navigate(`/doctors/${doctor.doctor_id}`)}
                            >
                                <div className="doctorCardHeader">
                                    <span className="rowTitle">
                                        {TITLE_LABELS[doctor.title] ? `${TITLE_LABELS[doctor.title]} ` : ''}
                                        {doctor.first_name} {doctor.last_name}
                                    </span>
                                    <div className="specTags">
                                        {doctor.specialties.map((specialty) => (
                                            <span key={specialty.id} className="badge badgeGreen">{specialty.name}</span>
                                        ))}
                                    </div>
                                </div>
                                {doctor.bio && <p>{doctor.bio}</p>}
                            </div>
                        ))}
                    </section>
                )}
            </main>
        </div>
    );
}
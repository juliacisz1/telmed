import '../shared/Styles/PageStyle.css'
import {useNavigate} from "react-router-dom";
import SearchDropdown from "../shared/UIComponents/SearchDropdown/SearchDropdown.tsx";
import {TopBar} from "../shared/UIComponents/TopBar/TopBar.tsx";
import {fetchSpecialtySuggestions, searchDoctorsAndSpecialties} from "../api/search.ts";
import {useState} from "react";

export function HomePage() {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');

    function handleSearch() {
        navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }

    return(
        <div className="page">
            <TopBar>
                <button className="linkBtn"
                        type='button'
                        onClick={()=>navigate('/register')}>
                    Dołącz do <span className="logoText">TelMed</span>
                </button>
                <button className="greenBtn"
                        type='button'
                        onClick={()=>navigate('/login')}>
                    Zaloguj się
                </button>
            </TopBar>

            <main className="main">
                <section className="card">
                    <h1>Znajdź lekarza i umów wizytę już dziś!</h1>
                    <div className="row">
                        <SearchDropdown
                            fetchSuggestions={fetchSpecialtySuggestions}
                            fetchOptions={searchDoctorsAndSpecialties}
                            placeholder="Specjalizacja lub imię lekarza"
                            onQueryChange={setSearchQuery}
                        />
                        <button className="greenBtn"
                                type="button"
                                onClick={handleSearch}
                                disabled={!searchQuery.trim()}
                        >
                            Szukaj
                        </button>
                    </div>
                </section>
            </main>
        </div>
    )
}
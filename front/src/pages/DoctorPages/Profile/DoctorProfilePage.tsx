import './DoctorProfilePage.css';
import '../../../shared/Styles/Profile.css';
import '../../../shared/Styles/PageStyle.css';
import {useNavigate} from "react-router-dom";
import {getUser, updateUser} from "../../../api/users.ts";
import {useEffect, useState, type ChangeEvent, type SubmitEvent} from "react";
import {useAuth} from "../../../context/AuthContext.tsx";
import SearchDropdown from "../../../shared/UIComponents/SearchDropdown/SearchDropdown.tsx";
import {ChangePasswordSection} from "../../../shared/UIComponents/Account/PasswordChange/PasswordChange.tsx";
import {DeleteAccountSection} from "../../../shared/UIComponents/Account/DeleteAccount/DeleteAccount.tsx";
import {TopBar} from "../../../shared/UIComponents/TopBar/TopBar.tsx";
import {fetchSpecialtySuggestions} from "../../../api/search.ts";
import {getErrorMessage} from "../../../api/errors.ts";
import type {SearchItem} from "../../../types.ts";
import {MAX_SPECIALTIES, TITLE_LABELS} from '../../../constants.ts';

export function DoctorProfilePage() {
    const navigate = useNavigate();
    const { user, logout, setUser } = useAuth();

    const [form, setForm] = useState({
        title: '',
        first_name: '',
        last_name: '',
        email: '',
        bio: '',
        pwz_number: '',
    });
    const [deleted, setDeleted] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState('');
    const [selectedSpecialties, setSelectedSpecialties] = useState<{id: string, label: string}[]>([]);
    const [availableSpecialties, setAvailableSpecialties] = useState<SearchItem[]>([]);
    const [showNewSpec, setShowNewSpec] = useState(false);
    const [saving, setSaving] = useState(false);
    const [specQuery, setSpecQuery] = useState('');


    useEffect(() => {
        if (user) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setForm({
                title: user.title || '',
                first_name: user.first_name || '',
                last_name: user.last_name || '',
                email: user.email || '',
                bio: user.bio || '',
                pwz_number: user.pwz_number || '',
            });
            if (user.specialties) {
                setSelectedSpecialties(
                    user.specialties.map(specialty => ({ id: String(specialty.id), label: specialty.name }))
                );
            }
        }
    }, [user]);

    useEffect(() => {
        fetchSpecialtySuggestions()
            .then(data => {
                setAvailableSpecialties(data);
                setError('');
            })
            .catch(() => {
                setAvailableSpecialties([]);
                setError('Nie udało się pobrać specjalizacji.');
            })
    }, []);

    function handleChange(event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
        setForm({...form, [event.target.name]: event.target.value});
    }

    async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
        event.preventDefault();
        if (saving) return;

        const query = specQuery.trim();
        if (query && !availableSpecialties.some(
            item => item.label.toLowerCase() === query.toLowerCase())) {
            setError('Wybierz specjalizację z listy.');
            return;
        }

        setError('');
        setSaving(true);
        try {
            setUser(await updateUser({
                ...form, specialties: selectedSpecialties.map(specialty => Number(specialty.id)),
            }));
            setSaved(true);
        } catch (er) {
            setError(getErrorMessage(er, 'Nie udało się zapisać zmian.'));
        } finally {
            setSaving(false);
        }
    }

    async function handleCancel() {
        if (saving) return;
        setError('');
        setSaving(true);
        try {
            setUser(await getUser());
        } catch {
            setError('Nie udało się przywrócić zapisanych danych.');
        } finally {
            setSaving(false);
        }
    }

    function handleAddSpec(item: SearchItem) {
        if (selectedSpecialties.length >= MAX_SPECIALTIES) return;
        if (selectedSpecialties.find(specialty => specialty.id === item.id)) return;
        setSelectedSpecialties([...selectedSpecialties, { id: item.id, label: item.label }]);
    }

    function handleRemoveSpec(id: string) {
        setSelectedSpecialties(selectedSpecialties.filter(specialty => specialty.id !== id));
    }

    function handleGoHomeAfterDelete() {
        navigate('/');
        logout();
    }

    return(
        <div className="page">
            <TopBar logoTo="/doctor">
                <button className="greenBtn"
                        type='button'
                        onClick={() => navigate('/doctor')}
                >
                    Powrót
                </button>
            </TopBar>

            <main className="main">
                <div className="profileColumn">
                    <h1>Panel lekarza</h1>
                    <div className="card">
                        {deleted ? (
                            <section style={{ textAlign: 'center' }}>
                                <p className="formError">Konto zostało usunięte.</p>
                                <button className="greenBtn"
                                        type="button"
                                        onClick={handleGoHomeAfterDelete}
                                >
                                    Przejdź do strony głównej
                                </button>
                            </section>
                        ) : (
                            <section>
                                <h1>Ustawienia Konta</h1>
                                <form onSubmit={handleSubmit} onChange={() => setSaved(false)}>
                                    <h3>Dane osobowe</h3>
                                    <div className="formSection">
                                        <div className="field">
                                            <label htmlFor="title">Tytuł</label>
                                            <select
                                                id="title"
                                                className="input"
                                                name="title"
                                                value={form.title}
                                                onChange={handleChange}
                                            >
                                                <option value="">-- wybierz --</option>
                                                {Object.entries(TITLE_LABELS).map(([value, label]) => (
                                                    <option key={value} value={value}>{label}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="field">
                                            <label htmlFor="firstName">Imię</label>
                                            <input id="firstName"
                                                   className="input"
                                                   name="first_name"
                                                   type="text"
                                                   value={form.first_name}
                                                   onChange={handleChange}
                                            />
                                        </div>

                                        <div className="field">
                                            <label htmlFor="lastName">Nazwisko</label>
                                            <input id="lastName"
                                                   className="input"
                                                   name="last_name"
                                                   type="text"
                                                   value={form.last_name}
                                                   onChange={handleChange}
                                            />
                                        </div>
                                    </div>

                                    <h3>Dane kontaktowe</h3>
                                    <div className="formSection">
                                        <div className="field">
                                            <label htmlFor="email">E-mail</label>
                                            <input id="email"
                                                   className="input"
                                                   name="email"
                                                   type="email"
                                                   value={form.email}
                                                   onChange={handleChange}
                                            />
                                        </div>
                                    </div>

                                    <h3>Opis</h3>
                                    <div className="formSection">
                                        <div className="field">
                                            <label htmlFor="bio">Dodaj opis o sobie</label>
                                            <input id="bio"
                                                   className="input"
                                                   name="bio"
                                                   value={form.bio}
                                                   onChange={handleChange}
                                            />
                                        </div>
                                    </div>

                                    <h3>Wykształcenie</h3>
                                    <div className="formSection">
                                        <div className="field">
                                            <label htmlFor="pwz_number">Numer PWZ</label>
                                            <input id="pwz_number"
                                                   className="input"
                                                   name="pwz_number"
                                                   type="text"
                                                   maxLength={7}
                                                   value={form.pwz_number}
                                                   onChange={handleChange}
                                            />
                                        </div>

                                        {selectedSpecialties.map(spec => (
                                            <div key={spec.id} className="field">
                                                <label>Specjalizacja</label>
                                                <div className="row">
                                                    <span className="input specName">{spec.label}</span>
                                                    {selectedSpecialties.length > 1 && (
                                                        <button className="dangerLinkBtn"
                                                                type="button"
                                                                onClick={() => handleRemoveSpec(spec.id)}
                                                        >
                                                            ✕
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}

                                        {showNewSpec && (
                                            <div className="field">
                                                <label>Nowa specjalizacja</label>
                                                <SearchDropdown
                                                    placeholder="Specjalizacja"
                                                    options={availableSpecialties.filter(
                                                        item => !selectedSpecialties.some(spec => spec.id === item.id)
                                                    )}
                                                    clearOnSelect
                                                    onQueryChange={(query) => {
                                                        setSpecQuery(query);
                                                        setError('');
                                                    }}
                                                    onSelect={(item) => {
                                                        handleAddSpec(item);
                                                        setSpecQuery('');
                                                        setError('');
                                                        setShowNewSpec(false);
                                                    }}
                                                />
                                            </div>
                                        )}

                                        {selectedSpecialties.length < MAX_SPECIALTIES && !showNewSpec && (
                                            <button className="linkBtn"
                                                    type="button"
                                                    onClick={() => setShowNewSpec(true)}
                                            >
                                                + Dodaj specjalizację
                                            </button>
                                        )}
                                    </div>

                                    <h3>Bezpieczeństwo</h3>
                                    <div className="formSection">
                                        <ChangePasswordSection />
                                        <DeleteAccountSection onDeleted={() => setDeleted(true)} />
                                    </div>

                                    {error && <p className="formError">{error}</p>}
                                    {saved && <p className="formSuccess">Zmiany zostały zapisane.</p>}

                                    <div className="row rowEnd">
                                        <button className="whiteBtn"
                                                type="button"
                                                onClick={handleCancel}
                                        >
                                            Anuluj
                                        </button>
                                        <button className="greenBtn"
                                                type="submit"
                                                disabled={saving}
                                        >
                                            {saving ? 'Zapisywanie...' : 'Zapisz'}
                                        </button>
                                    </div>

                                </form>
                            </section>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
import '../../shared/Styles/PageStyle.css'
import {useNavigate} from "react-router-dom";
import {useEffect, useRef, useState, type ChangeEvent, type SubmitEvent} from "react";
import {useAuth} from "../../context/AuthContext.tsx";
import {registerDoctor} from "../../api/users.ts";
import {getFieldErrors} from "../../api/errors.ts";
import {fetchSpecialtySuggestions} from "../../api/search.ts";
import SearchDropdown from "../../shared/UIComponents/SearchDropdown/SearchDropdown.tsx";
import {TopBar} from "../../shared/UIComponents/TopBar/TopBar.tsx";
import {validatePassword} from "../../api/validation.ts";
import type {SearchItem} from "../../types.ts";



export function DoctorRegisterPage() {
    const navigate = useNavigate();
    const { user, login } = useAuth();

    const [form, setForm] = useState({
        first_name: '',
        last_name: '',
        email: '',
        pwz_number: '',
        password: '',
        password_confirm: '',
        specialty: '',
    });
    const [saving, setSaving] = useState(false);
    const [accountCreated, setAccountCreated] = useState(false);
    const [errors, setErrors] = useState<{
        first_name?: string;
        last_name?: string;
        email?: string;
        pwz_number?: string;
        specialty?: string;
        password?: string;
        password_confirm?: string;
    }>({});
    const [availableSpecialties, setAvailableSpecialties] = useState<SearchItem[]>([]);
    const selectedSpecialtyLabel = useRef('');

    useEffect(() => {
        fetchSpecialtySuggestions()
            .then(data => {
                setAvailableSpecialties(data);
            })
            .catch(() => {
                setAvailableSpecialties([]);
                setErrors({specialty: 'Nie udało się pobrać listy specjalizacji.'});
            })
    }, []);

    useEffect(() => {
        if (user?.role === 'doctor') navigate('/doctor');
    }, [navigate, user]);

    function handleChange(event: ChangeEvent<HTMLInputElement>) {
        setForm({...form, [event.target.name]: event.target.value});
    }

    async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
        event.preventDefault();
        setErrors({});

        if (!form.first_name) {
            setErrors({first_name: 'Imię jest wymagane!'});
            return;
        }
        if (!form.last_name) {
            setErrors({last_name: 'Nazwisko jest wymagane!'});
            return;
        }
        if (!form.email) {
            setErrors({email: 'E-mail jest wymagany!'});
            return;
        }
        if (!form.pwz_number) {
            setErrors({pwz_number: 'Numer PWZ jest wymagany!'});
            return;
        }

        const passwordError = validatePassword(form.password, form.password_confirm);
        if (passwordError) {
            setErrors({[passwordError.field]: passwordError.message});
            return;
        }

        if (!form.specialty) {
            setErrors({specialty: 'Wybierz specjalizację'});
            return;
        }

        setSaving(true);
        try {
            await registerDoctor({...form, specialty: Number(form.specialty)});
        } catch (er) {
            const data = getFieldErrors(er);
            if (data.email) {
                setErrors({email: 'Użytkownik z takim adresem e-mail już istnieje'});
            } else if (data.pwz_number) {
                setErrors({pwz_number: 'Lekarz z takim numerem PWZ już istnieje'});
            } else if (data.specialty) {
                setErrors({specialty: 'Wybierz poprawną specjalizację'});
            } else if (data.password) {
                setErrors({password: data.password[0]});
            } else {
                setErrors({password_confirm: 'Rejestracja nie powiodła się.'});
            }
            setSaving(false);
            return;
        }

        try {
            await login(form.email, form.password);
        } catch {
            setAccountCreated(true);
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="page">
            <TopBar />

            <main className="main">
                <section className="card narrowCard">
                    <div className="title">
                        Dołącz jako Lekarz
                    </div>

                    {accountCreated ? (
                        <div className="row rowCenter">
                            <p>Zaloguj się przy użyciu podanego adresu e-mail i hasła.</p>
                            <button type="button" className="greenBtn fullWidth"
                                    onClick={() => navigate('/login')}>
                                Przejdź do logowania
                            </button>
                        </div>
                    ) : (
                        <>
                            <form className="form" onSubmit={handleSubmit}>
                                <div className="fieldRow">
                                    <input
                                        className="input"
                                        type="text"
                                        name="first_name"
                                        placeholder="Imię"
                                        autoComplete="given-name"
                                        value={form.first_name}
                                        onChange={handleChange}
                                    />

                                    <input
                                        className="input"
                                        type="text"
                                        name="last_name"
                                        placeholder="Nazwisko"
                                        autoComplete="family-name"
                                        value={form.last_name}
                                        onChange={handleChange}
                                    />
                                </div>
                                {errors.first_name && <p className="formError">{errors.first_name}</p>}
                                {errors.last_name && <p className="formError">{errors.last_name}</p>}

                                <input className="input"
                                       type='email'
                                       name="email"
                                       placeholder="Email"
                                       autoComplete="email"
                                       value={form.email}
                                       onChange={handleChange}
                                />
                                {errors.email && <p className="formError">{errors.email}</p>}

                                <input className="input"
                                       type="text"
                                       name="pwz_number"
                                       placeholder="Numer PWZ"
                                       inputMode="numeric"
                                       maxLength={7}
                                       value={form.pwz_number}
                                       onChange={handleChange}
                                />
                                {errors.pwz_number && <p className="formError">{errors.pwz_number}</p>}

                                <SearchDropdown
                                    options={availableSpecialties}
                                    placeholder="Specjalizacja"
                                    onSelect={(item) => {
                                        setForm(prev => ({...prev, specialty: item.id}));
                                        selectedSpecialtyLabel.current = item.label;
                                        setErrors(prev => ({...prev, specialty: undefined}));
                                    }}
                                    onQueryChange={(input) => {
                                        if (input !== selectedSpecialtyLabel.current) {
                                            setForm(prev => ({...prev, specialty: ''}));
                                        }
                                    }}
                                />
                                {errors.specialty && <p className="formError">{errors.specialty}</p>}

                                <input className="input"
                                       type="password"
                                       name="password"
                                       placeholder="Hasło"
                                       autoComplete="new-password"
                                       value={form.password}
                                       onChange={handleChange}
                                />
                                {errors.password && <p className="formError">{errors.password}</p>}

                                <input className="input"
                                       type="password"
                                       name="password_confirm"
                                       placeholder="Powtórz hasło"
                                       autoComplete="new-password"
                                       value={form.password_confirm}
                                       onChange={handleChange}
                                />
                                {errors.password_confirm && <p className="formError">{errors.password_confirm}</p>}

                                <button className="greenBtn fullWidth"
                                        type="submit"
                                        disabled={saving }
                                >
                                    {saving ? 'Rejestracja...' : 'Zarejestruj się'}
                                </button>
                            </form>

                            <div className="row rowCenter">
                                <p>Masz już konto?</p>
                                <button className="linkBtn"
                                        type="button"
                                        onClick={() => navigate('/login')}
                                >
                                    Zaloguj się
                                </button>
                            </div>
                        </>
                    )}

                </section>
            </main>
        </div>
    );
}
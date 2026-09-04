import '../../../shared/Styles/PageStyle.css';
import '../../../shared/Styles/Profile.css';
import {useNavigate} from "react-router-dom";
import {getUser, updateUser} from "../../../api/users.ts";
import {useEffect, useState, type ChangeEvent, type SubmitEvent} from "react";
import {useAuth} from "../../../context/AuthContext.tsx";
import {ChangePasswordSection} from "../../../shared/UIComponents/Account/PasswordChange/PasswordChange.tsx";
import {DeleteAccountSection} from "../../../shared/UIComponents/Account/DeleteAccount/DeleteAccount.tsx";
import {TopBar} from "../../../shared/UIComponents/TopBar/TopBar.tsx";
import {getFieldErrors} from "../../../api/errors.ts";
import {PESEL_LENGTH} from "../../../constants.ts";

export function PatientProfilePage() {
    const navigate = useNavigate();
    const { user, logout, setUser } = useAuth();

    const [form, setForm] = useState({
        first_name: '',
        last_name: '',
        date_of_birth: '',
        pesel: '',
        email: '',
    });
    const [deleted, setDeleted] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState('')
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (user) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setForm({
                first_name: user.first_name || '',
                last_name: user.last_name || '',
                date_of_birth: user.date_of_birth || '',
                pesel: user.pesel || '',
                email: user.email || '',
            });
        }
    }, [user]);

    function handleChange(event: ChangeEvent<HTMLInputElement>) {
        setForm({...form, [event.target.name]: event.target.value});
    }

    async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
        e.preventDefault();
        if (saving) return;
        setError('');
        setSaving(true);
        try {
            setUser(await updateUser({
                first_name: form.first_name,
                last_name: form.last_name,
                email: form.email,
                date_of_birth: form.date_of_birth || null,
                pesel: form.pesel || null,
            }));
            setSaved(true);
        } catch (err) {
            const data = getFieldErrors(err);
            setError(data.pesel?.[0] || data.email?.[0] || 'Nie udało się zapisać zmian.');
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
    function handleGoHomeAfterDelete() {
        navigate('/');
        logout();
    }

    return(
        <div className="page">
            <TopBar logoTo="/patient">
                <button className="greenBtn"
                        type='button'
                        onClick={() => navigate('/patient')}
                >
                    Powrót
                </button>
            </TopBar>

            <main className="main">
                <div className="profileColumn">
                    <h1>Panel pacjenta</h1>
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

                                        <div className="field">
                                            <label htmlFor="birthDate">Data urodzenia</label>
                                            <input id="birthDate"
                                                   className="input"
                                                   name="date_of_birth"
                                                   type="date"
                                                   value={form.date_of_birth}
                                                   onChange={handleChange}
                                            />
                                        </div>

                                        <div className="field">
                                            <label htmlFor="pesel">PESEL</label>
                                            <input id="pesel"
                                                   className="input"
                                                   name="pesel"
                                                   type="text"
                                                   inputMode="numeric"
                                                   maxLength={PESEL_LENGTH}
                                                   value={form.pesel}
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
                                                disabled={saving}>
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
    )
}
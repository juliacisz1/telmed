import '../../shared/Styles/PageStyle.css';
import {useState, type ChangeEvent, type SubmitEvent} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import {confirmPasswordReset} from '../../api/users.ts';
import {getErrorMessage} from '../../api/errors.ts';
import {validatePassword} from '../../api/validation.ts';
import {TopBar} from '../../shared/UIComponents/TopBar/TopBar.tsx';

//https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/autocomplete

export function ResetPasswordPage() {
    const {uid = '', token = ''} = useParams();
    const navigate = useNavigate();

    const [form, setForm] = useState({password: '', password_confirm: ''});
    const [changed, setChanged] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    function handleChange(event: ChangeEvent<HTMLInputElement>) {
        setForm({...form, [event.target.name]: event.target.value});
    }

    async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
        event.preventDefault();
        if (saving) return;

        const passwordError = validatePassword(form.password, form.password_confirm);
        if (passwordError) {
            setError(passwordError.message);
            return;
        }

        setError('');
        setSaving(true);
        try {
            await confirmPasswordReset(uid, token, form.password);
            setChanged(true);
        } catch (er) {
            setError(getErrorMessage(er, 'Nie udało się zmienić hasła.'));
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="page">
            <TopBar/>
            <main className="main">
                <section className="card narrowCard">
                    <h1>Ustaw nowe hasło</h1>

                    {changed ? (
                        <>
                            <p>Hasło zostało zmienione.</p>
                            <button type="button" className="greenBtn fullWidth" onClick={() => navigate('/login')}>
                                Przejdź do logowania
                            </button>
                        </>
                    ) : (
                        <form className="form" onSubmit={handleSubmit}>
                            <label htmlFor="password">Nowe hasło</label>
                            <input id="password"
                                   className="input"
                                   name="password"
                                   type="password"
                                   autoComplete="new-password"
                                   required
                                   value={form.password}
                                   onChange={handleChange}
                            />

                            <label htmlFor="password_confirm">Powtórz nowe hasło</label>
                            <input id="password_confirm"
                                   className="input"
                                   name="password_confirm"
                                   type="password"
                                   autoComplete="new-password"
                                   required
                                   value={form.password_confirm}
                                   onChange={handleChange}
                            />

                            {error && <p className="formError">{error}</p>}

                            <button className="greenBtn fullWidth"
                                    type="submit"
                                    disabled={saving}>
                                {saving ? 'Zapisywanie...' : 'Zapisz hasło'}
                            </button>
                        </form>
                    )}
                </section>
            </main>
        </div>
    );
}
import '../../shared/Styles/PageStyle.css'
import {useNavigate} from "react-router-dom";
import {useEffect, useState, type ChangeEvent, type SubmitEvent} from "react";
import {useAuth} from "../../context/AuthContext.tsx";
import {registerPatient} from "../../api/users.ts";
import {getFieldErrors} from "../../api/errors.ts";
import {TopBar} from "../../shared/UIComponents/TopBar/TopBar.tsx";
import {validatePassword} from "../../api/validation.ts";

//https://learnetto.com/blog/react-form-validation
//https://coreui.io/answers/how-to-build-a-signup-page-in-react/

export function PatientRegisterPage() {
    const navigate = useNavigate();
    const { user, login } = useAuth();

    const [form, setForm] = useState({
        first_name: '',
        last_name: '',
        email: '',
        password: '',
        password_confirm: '',
    });
    const [saving, setSaving] = useState(false);
    const [accountCreated, setAccountCreated] = useState(false);
    const [errors, setErrors] = useState<{
        first_name?: string;
        last_name?: string;
        email?: string;
        password?: string;
        password_confirm?: string;
    }>({});

    useEffect(() => {
        if (user?.role === 'patient') navigate('/patient');
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
        const passwordError = validatePassword(form.password, form.password_confirm);
        if (passwordError) {
            setErrors({[passwordError.field]: passwordError.message});
            return;
        }

        setSaving(true);

        try {
            await registerPatient(form);
        } catch (er) {
            const data = getFieldErrors(er);
            if (data.email) {
                setErrors({email: 'Użytkownik z takim adresem e-mail już istnieje'});
            } else if (data.password) {
                setErrors({ password: data.password[0]});
            } else {
                setErrors({password_confirm: 'Nie udało się stworzyć konta.'});
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
                        Dołącz jako Pacjent
                    </div>

                    {accountCreated ? (
                        <div className="row rowCenter">
                            <p>Zaloguj się przy użyciu podanego adresu e-mail i hasła.</p>
                            <button className="greenBtn fullWidth"
                                    type="button"
                                    onClick={() => navigate('/login')}
                            >
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
                                        disabled={saving}
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
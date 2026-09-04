import '../../shared/Styles/PageStyle.css'
import {useNavigate, useLocation} from "react-router-dom";
import {useEffect, useState, type ChangeEvent, type SubmitEvent} from "react";
import {useAuth} from '../../context/AuthContext.tsx'
import {getErrorStatus} from '../../api/errors.ts'
import {TopBar} from '../../shared/UIComponents/TopBar/TopBar.tsx'


export function LoginPage() {
    const navigate = useNavigate();
    const [form, setForm] = useState({
        email: '',
        password: ''
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const { login, user } = useAuth();
    const location = useLocation();

    function handleChange(event: ChangeEvent<HTMLInputElement>) {
        setForm({...form, [event.target.name]: event.target.value});
    }

    async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
        event.preventDefault();
        setError('');
        setSaving(true);

        try {
            await login(form.email, form.password);
        } catch (er) {
            const status = getErrorStatus(er);
            if (status === 400 || status === 401) {
                setError('Nieprawidłowy e-mail lub hasło.');
            } else {
                setError('Usługa jest chwilowo niedostępna.');
            }
        } finally {
            setSaving(false);
        }
    }

    useEffect(() => {
        const from = location.state?.from;
        if (user?.role === 'patient') navigate(from ?? '/patient');
        else if (user?.role === 'doctor') navigate('/doctor');
    }, [navigate, user, location]);

    return(
        <div className="page">
            <TopBar />

            <main className="main">
                <section className="card narrowCard">
                    <div className="title">Zaloguj się</div>
                    <div>Wpisz e-mail i hasło, aby przejść do swojego konta</div>

                    <form className="form" onSubmit={handleSubmit}>
                        <input className="input"
                               type='email'
                               name="email"
                               placeholder="Email"
                               autoComplete="username"
                               required
                               value={form.email}
                               onChange={handleChange}
                        />

                        <input className="input"
                               type="password"
                               name="password"
                               placeholder="Hasło"
                               autoComplete="current-password"
                               required
                               value={form.password}
                               onChange={handleChange}
                        />

                        {error && <p className="formError">{error}</p>}

                        <button className="greenBtn fullWidth"
                                type="submit"
                                disabled={saving}
                        >
                            {saving ? 'Logowanie...' : 'Zaloguj'}
                        </button>
                    </form>

                    <div className="row rowCenter">
                        <button className="linkBtn"
                                type="button"
                                onClick={() => navigate('/forgot-password')}
                        >
                            Nie pamiętasz hasła?
                        </button>
                        <button className="linkBtn"
                                type="button"
                                onClick={()=> navigate('/register')}
                        >
                            Zarejestruj się
                        </button>
                    </div>

                </section>
            </main>
        </div>
    )
}
import '../../shared/Styles/PageStyle.css';
import {useState, type SubmitEvent} from 'react';
import {useNavigate} from 'react-router-dom';
import {requestPasswordReset} from '../../api/users.ts';
import {TopBar} from '../../shared/UIComponents/TopBar/TopBar.tsx';

export function ForgotPasswordPage() {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [sent, setSent] = useState(false);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');

    async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
        event.preventDefault();
        if (sending) return;

        setError('');
        setSending(true);
        try {
            await requestPasswordReset(email.trim());
            setSent(true);
        } catch {
            setError('Nie udało się wysłać wiadomości.');
        } finally {
            setSending(false);
        }
    }

    return (
        <div className="page">
            <TopBar/>
            <main className="main">
                <section className="card narrowCard">
                    <h1>Odzyskiwanie hasła</h1>

                    {sent ? (
                        <>
                            <p>Jeśli takie konto istnieje, odnośnik zostanie wysłany na podany adres e-mail.</p>
                            <button className="greenBtn fullWidth"
                                    type="button"
                                    onClick={() => navigate('/login')}
                            >
                                Wróć do logowania
                            </button>
                        </>
                    ) : (
                        <>
                            <p>Podaj adres e-mail.</p>
                            <form className="form" onSubmit={handleSubmit}>
                                <label htmlFor="email">Adres e-mail</label>
                                <input id="email"
                                       className="input"
                                       type="email"
                                       value={email}
                                       autoComplete="username"
                                       onChange={(event) => setEmail(event.target.value)} required
                                />

                                {error && <p className="formError">{error}</p>}

                                <button className="greenBtn fullWidth"
                                        type="submit"
                                        disabled={sending}
                                >
                                    {sending ? 'Wysyłanie...' : 'Wyślij'}
                                </button>
                            </form>
                        </>
                    )}
                </section>
            </main>
        </div>
    );
}
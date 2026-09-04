import {useState, type ChangeEvent} from 'react';
import {changePassword} from '../../../../api/users.ts';
import {getFieldErrors} from '../../../../api/errors.ts';
import {validatePassword} from "../../../../api/validation.ts";

const PASSWORD_CHANGE_FORM = {
    old_password: '',
    new_password: '',
    new_password_confirm: '',
};

export function ChangePasswordSection() {
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState(PASSWORD_CHANGE_FORM);
    const [error, setError] = useState('');
    const [changed, setChanged] = useState(false);
    const [saving, setSaving] = useState(false);

    function handleChange(event: ChangeEvent<HTMLInputElement>) {
        setForm({...form, [event.target.name]: event.target.value});
    }

    async function handleSave() {
        if (saving) return;
        setError('');
        setChanged(false);

        const passwordError = validatePassword(form.new_password, form.new_password_confirm);
        if (passwordError) {
            setError(passwordError.message);
            return;
        }

        setSaving(true);
        try {
            await changePassword(form);
            setChanged(true);
            setForm(PASSWORD_CHANGE_FORM);
            setShowForm(false);
        } catch (er) {
            const data = getFieldErrors(er);
            if (data.old_password) {
                setError('Nieprawidłowe obecne hasło');
            } else {
                setError(data.new_password?.[0] ?? data.new_password_confirm?.[0] ?? 'Nie udało się zmienić hasła');
            }
        } finally {
            setSaving(false);
        }
    }

    if (!showForm) {
        return (
            <div className="field">
                <button className="linkBtn"
                        type="button"
                        onClick={() => setShowForm(true)}
                >
                    Zmień hasło
                </button>
                {changed && <p className="formSuccess">Hasło zostało zmienione</p>}
            </div>
        );
    }

    return (
        <div className="field">
            <label>Stare hasło</label>
            <input className="input"
                   type="password"
                   name="old_password"
                   autoComplete="current-password"
                   value={form.old_password} onChange={handleChange}
            />

            <label>Nowe hasło</label>
            <input className="input"
                   type="password"
                   name="new_password"
                   autoComplete="new-password"
                   value={form.new_password} onChange={handleChange}
            />

            <label>Powtórz nowe hasło</label>
            <input className="input"
                   type="password"
                   name="new_password_confirm"
                   autoComplete="new-password"
                   value={form.new_password_confirm} onChange={handleChange}
            />

            {error && <p className="formError">{error}</p>}

            <div className="fieldRow">
                <button className="greenBtn"
                        type="button"
                        disabled={saving}
                        onClick={() => void handleSave()}
                >
                    {saving ? 'Zapisywanie...' : 'Zapisz nowe hasło'}
                </button>
                <button className="whiteBtn"
                        type="button"
                        onClick={() => setShowForm(false)}
                >
                    Anuluj
                </button>
            </div>
        </div>
    );
}
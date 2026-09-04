import {useState} from 'react';
import {deleteUser} from '../../../../api/users.ts';

type DeleteAccountSectionProps = {
    onDeleted: () => void;
};

export function DeleteAccountSection({onDeleted}: DeleteAccountSectionProps) {
    const [showConfirm, setShowConfirm] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState('');

    async function handleDelete() {
        setError('');
        setDeleting(true);
        try {
            await deleteUser();
            onDeleted();
        } catch {
            setError('Nie udało się usunąć konta.');
        } finally {
            setDeleting(false);
        }
    }

    if (!showConfirm) {
        return (
            <div className="field">
                <button className="dangerLinkBtn" type="button"
                        onClick={() => setShowConfirm(true)}>Usuń konto</button>
            </div>
        );
    }

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
            width: '100%',
            textAlign: 'center',
            marginTop: '8px'
        }}
        >
            <p className="rowTitle">Czy na pewno chcesz usunąć konto? Tej operacji nie można cofnąć.</p>

            {error && <p className="formError">{error}</p>}

            <div className="row rowCenter">
                <button className="redBtn"
                        type="button"
                        disabled={deleting}
                        onClick={handleDelete}
                >
                    {deleting ? 'Usuwanie...' : 'Tak, usuń konto'}
                </button>
                <button className="greenBtn"
                        type="button"
                        disabled={deleting}
                        style={{background: 'white', color: 'black', width: 'auto', fontSize: '14px', padding: '10px 20px'}}
                        onClick={() => setShowConfirm(false)}
                >
                    Anuluj
                </button>
            </div>
        </div>
    );
}
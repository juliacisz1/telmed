import '../../../shared/Styles/PageStyle.css';
import {useEffect, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {getPatientDocuments} from '../../../api/appointments.ts';
import {TopBar} from '../../../shared/UIComponents/TopBar/TopBar.tsx';
import SearchDropdown from '../../../shared/UIComponents/SearchDropdown/SearchDropdown.tsx';
import type {MedicalDocument, SearchItem} from '../../../types.ts';
import {DateTime} from 'luxon';
import {downloadFile} from "../../../api/api.ts";

const TYPE_FILTERS = [
    {value: 'all', label: 'Wszystkie'},
    {value: 'prescription', label: 'Recepty'},
    {value: 'referral', label: 'Skierowania'},
    {value: 'sick_leave', label: 'Zwolnienia'},
];

export function PatientDocumentsPage() {
    const navigate = useNavigate();
    const [documents, setDocuments] = useState<MedicalDocument[]>([]);
    const [filter, setFilter] = useState('all');
    const [doctorSearch, setDoctorSearch] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        getPatientDocuments()
            .then(setDocuments)
            .catch(() => setError('Nie udało się pobrać dokumentów.'));
    }, []);

    async function handleOpenDocument(doc: MedicalDocument) {
        if (!doc.pdf) return;
        setError('');
        try {
            await downloadFile(doc.pdf, `${doc.doc_type_display}.pdf`);
        } catch {
            setError('Nie udało się pobrać dokumentu.');
        }
    }

    const doctors: SearchItem[] = documents
        .filter((document, index, all) =>
            document.doctor_name !== undefined
            && all.findIndex(other => other.doctor_name === document.doctor_name) === index)
        .map(document => ({
            kind: 'doctor',
            id: document.doctor_name ?? '',
            label: document.doctor_name ?? '',
            specialization: '',
        }));

    const filtered = documents
        .filter(document => filter === 'all' || document.doc_type === filter)
        .filter(document => document.doctor_name?.toLowerCase().includes(doctorSearch.trim().toLowerCase()));

    return (
        <div className="page">
            <TopBar logoTo="/patient">
                <button className="greenBtn"
                        type='button'
                        onClick={() => navigate(-1)}
                >
                    Powrót
                </button>
            </TopBar>

            <main className="documentsMain">
                <h1>Moje dokumenty</h1>

                <div className="row">
                    {TYPE_FILTERS.map(typeFilter => (
                        <button key={typeFilter.value}
                                className={filter === typeFilter.value ? 'slot slotActive' : 'slot'}
                                type="button"
                                onClick={() => setFilter(typeFilter.value)}
                        >
                            {typeFilter.label}
                        </button>
                    ))}
                </div>

                <SearchDropdown
                    options={doctors}
                    placeholder='Wyszukaj lekarza'
                    onQueryChange={setDoctorSearch}
                />

                {error && <p className="formError">{error}</p>}

                {!error && filtered.length === 0 && (<p className="muted">Brak dokumentów.</p>)}

                {filtered.map(document => (
                    <div key={document.id} className="card rowCard" onClick={() => void handleOpenDocument(document)}>
                        <div className="row">
                            <span className="rowTitle">{document.doc_type_display}</span>
                            <span className="muted">
                                {DateTime.fromISO(document.created_at).toFormat('dd.MM.yyyy')}
                            </span>
                        </div>
                        <div className="muted">{document.doctor_name}</div>

                        {document.doc_type === 'prescription' && document.drug_display && (
                            <div className="muted">
                                {document.drug_display}
                                {document.dosage && `, ${document.dosage}`}
                                {document.quantity && `, ${document.quantity}`}
                            </div>
                        )}

                        {document.doc_type === 'referral' && document.target_display && (
                            <div className="muted">
                                {document.target_display}
                                {document.target === 'doctor' && document.specialty_display
                                    && `: ${document.specialty_display}`}
                                {document.target === 'exam' && document.exam_name
                                    && `: ${document.exam_name}`}
                            </div>
                        )}

                        {document.doc_type === 'sick_leave' && document.date_from && document.date_to && (
                            <div className="muted">
                                Zwolnienie: {DateTime.fromISO(document.date_from).toFormat('dd.MM.yyyy')}
                                {' – '}
                                {DateTime.fromISO(document.date_to).toFormat('dd.MM.yyyy')}
                            </div>
                        )}
                        {!document.pdf && <div className="muted">Nie udało się wygenerować pliku PDF</div>}
                    </div>
                ))}
            </main>
        </div>
    );
}
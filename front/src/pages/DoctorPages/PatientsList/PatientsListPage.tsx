import './PatientsListPage.css';
import '../../../shared/Styles/PageStyle.css';
import {useEffect, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {getDoctorPatients} from '../../../api/appointments.ts';
import {TopBar} from '../../../shared/UIComponents/TopBar/TopBar.tsx';
import type {DoctorPatient, SearchItem} from "../../../types.ts";
import SearchDropdown from "../../../shared/UIComponents/SearchDropdown/SearchDropdown.tsx";

export function PatientsListPage() {
    const navigate = useNavigate();
    const [patients, setPatients] = useState<DoctorPatient[]>([]);
    const [search, setSearch] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        getDoctorPatients()
            .then(setPatients)
            .catch(() => setError('Nie udało się pobrać listy pacjentów.'));
    }, []);

    const people: SearchItem[] = patients.map(patient => ({
        kind: 'patient',
        id: String(patient.id),
        label: `${patient.first_name} ${patient.last_name}`,
    }));

    const filtered = patients.filter(patient =>
        `${patient.first_name} ${patient.last_name}`.toLowerCase().includes(search.trim().toLowerCase())
    );

    return (
        <div className="page">
            <TopBar logoTo="/doctor">
                <button className="greenBtn"
                        type='button'
                        onClick={() => navigate('/doctor')}
                >
                    Powrót
                </button>
            </TopBar>

            <main className="patientsMain">
                <h1>Moi pacjenci</h1>
                <div className="row">
                    <SearchDropdown
                        options={people}
                        placeholder='Szukaj pacjenta'
                        onQueryChange={setSearch}
                    />
                </div>

                {error ? <p className="formError">{error}</p> : filtered.length === 0 && <p className="muted">Brak pacjentów.</p>}

                {filtered.map(patient => (
                    <div key={patient.id}
                         className="card rowCard"
                         onClick={() => navigate(`/doctor/patients/${patient.id}`)}>
                        <div className="rowTitle">{patient.first_name} {patient.last_name}</div>
                        <div className="muted">{patient.email}</div>
                    </div>
                ))}
            </main>
        </div>
    );
}
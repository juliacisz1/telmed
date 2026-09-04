import {useEffect, useRef, useState, type ChangeEvent} from 'react';
import {createDocument, searchDrugs, searchDiagnoses} from '../../../../api/appointments.ts';
import {fetchSpecialtySuggestions} from '../../../../api/search.ts';
import {PopUp} from '../../PopUp/PopUp.tsx';
import SearchDropdown from "../../SearchDropdown/SearchDropdown.tsx";
import type {SearchItem} from '../../../../types.ts';
export type DocType = 'prescription' | 'referral' | 'sick_leave';
const DOC_LABELS: Record<DocType, string> = {
    prescription: 'Recepta',
    referral: 'Skierowanie',
    sick_leave: 'Zwolnienie lekarskie',
};
type MedicalDocumentPopUpProps = {
    appointmentId: number;
    docType: DocType;
    onCreated?: () => void;
    onClose: () => void;
};
export function MedicalDocumentPopUp({appointmentId, docType, onCreated, onClose}: MedicalDocumentPopUpProps) {
    const [form, setForm] = useState({
        dosage: '',
        quantity: '',
        comment: '',
        description: '',
        date_from: '',
        date_to: '',
        exam_name: '',
    });
    const [drugId, setDrugId] = useState<number | null>(null);
    const [diagnosisId, setDiagnosisId] = useState<number | null>(null);
    const [specialtyId, setSpecialtyId] = useState<number | null>(null);
    const [target, setTarget] = useState<'doctor' | 'exam'>('doctor');
    const [specialties, setSpecialties] = useState<SearchItem[]>([]);
    const [error, setError] = useState('');
    const drugLabelRef = useRef('');
    const diagnosisLabelRef = useRef('');
    const specialtyLabelRef = useRef('');
    useEffect(() => {
        if (docType !== 'referral') return;
        fetchSpecialtySuggestions()
            .then(setSpecialties)
            .catch(() => setSpecialties([]));
    }, [docType]);
    function handleChange(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
        setForm({...form, [event.target.name]: event.target.value});
    }
    function handleTargetChange(event: ChangeEvent<HTMLSelectElement>) {
        setTarget(event.target.value as 'doctor' | 'exam');
        setSpecialtyId(null);
        setForm({...form, exam_name: ''});
    }
    function handleDrugSelect(item: SearchItem) {
        drugLabelRef.current = item.label;
        setDrugId(Number(item.id));
    }
    function handleDrugQueryChange(query: string) {
        if (query !== drugLabelRef.current) setDrugId(null);
    }
    function handleDiagnosisSelect(item: SearchItem) {
        diagnosisLabelRef.current = item.label;
        setDiagnosisId(Number(item.id));
    }
    function handleDiagnosisQueryChange(query: string) {
        if (query !== diagnosisLabelRef.current) setDiagnosisId(null);
    }
    function handleSpecialtySelect(item: SearchItem) {
        specialtyLabelRef.current = item.label;
        setSpecialtyId(Number(item.id));
    }
    function handleSpecialtyQueryChange(query: string) {
        if (query !== specialtyLabelRef.current) setSpecialtyId(null);
    }
    function buildPayload() {
        if (docType === 'prescription') {
            return {
                doc_type: docType,
                drug: drugId,
                diagnosis: diagnosisId,
                dosage: form.dosage,
                quantity: form.quantity,
                description: form.description,
                comment: form.comment,
            };
        }
        if (docType === 'sick_leave') {
            return {
                doc_type: docType,
                diagnosis: diagnosisId,
                date_from: form.date_from,
                date_to: form.date_to,
                comment: form.comment,
            };
        }
        return {
            doc_type: docType,
            diagnosis: diagnosisId,
            target,
            specialty: target === 'doctor' ? specialtyId : null,
            exam_name: target === 'exam' ? form.exam_name : '',
            description: form.description,
            comment: form.comment,
        };
    }
    async function handleSave() {
        setError('');
        if (!diagnosisId) {
            setError('Wybierz rozpoznanie z listy.');
            return;
        }
        if (docType === 'prescription' && (!drugId || !form.dosage || !form.quantity)) {
            setError('Uzupełnij wszystkie pola');
            return;
        }
        if (docType === 'referral' && target === 'doctor' && !specialtyId) {
            setError('Wybierz specjalizację z listy.');
            return;
        }
        if (docType === 'referral' && target === 'exam' && !form.exam_name) {
            setError('Podaj rodzaj badania.');
            return;
        }
        if (docType === 'sick_leave' && (!form.date_from || !form.date_to)) {
            setError('Podaj okres zwolnienia.');
            return;
        }
        if (docType === 'sick_leave' && form.date_to < form.date_from) {
            setError('Data końca zwolnienia nie może być wcześniejsza niż data początku.');
            return;
        }

        try {
            await createDocument(appointmentId, buildPayload());
            onCreated?.();
            onClose();
        } catch {
            setError('Nie udało się wystawić dokumentu.');
        }
    }
    return (
        <PopUp title={DOC_LABELS[docType]} onClose={onClose}>
            {docType === 'prescription' && (
                <>
                    <label>Lek</label>
                    <SearchDropdown
                        fetchOptions={searchDrugs}
                        placeholder="Wyszukaj lek"
                        onSelect={handleDrugSelect}
                        onQueryChange={handleDrugQueryChange}
                    />
                    <label>Dawkowanie</label>
                    <input className="input smallInput"
                           type="text"
                           name="dosage"
                           value={form.dosage}
                           onChange={handleChange}
                    />
                    <label>Ilość</label>
                    <input className="input smallInput"
                           type="text"
                           name="quantity"
                           value={form.quantity}
                           onChange={handleChange}
                    />
                </>
            )}
            {docType === 'referral' && (
                <>
                    <label>Rodzaj skierowania</label>
                    <select className="input smallInput" value={target} onChange={handleTargetChange}>
                        <option value="doctor">Do lekarza specjalisty</option>
                        <option value="exam">Na badanie</option>
                    </select>
                    {target === 'doctor' ? (
                        <>
                            <label>Specjalizacja</label>
                            <SearchDropdown
                                options={specialties}
                                placeholder="Wyszukaj specjalizację"
                                onSelect={handleSpecialtySelect}
                                onQueryChange={handleSpecialtyQueryChange}
                            />
                        </>
                    ) : (
                        <>
                            <label>Rodzaj badania</label>
                            <input className="input smallInput"
                                   type="text"
                                   name="exam_name"
                                   value={form.exam_name}
                                   onChange={handleChange}
                            />
                        </>
                    )}
                </>
            )}
            {docType === 'sick_leave' && (
                <div className="row">
                    <label>Od</label>
                    <input className="input smallInput" type="date" name="date_from"
                           value={form.date_from} onChange={handleChange}/>
                    <label>Do</label>
                    <input className="input smallInput" type="date" name="date_to"
                           value={form.date_to} onChange={handleChange}/>
                </div>
            )}

            <label>Rozpoznanie</label>
            <SearchDropdown
                fetchOptions={searchDiagnoses}
                placeholder="Wyszukaj rozpoznanie"
                onSelect={handleDiagnosisSelect}
                onQueryChange={handleDiagnosisQueryChange}
            />

            {docType === 'prescription' && (
                <>
                    <label>Informacja dla pacjenta</label>
                    <textarea className="input"
                              rows={2}
                              name="description"
                              value={form.description}
                              onChange={handleChange}
                    />
                </>
            )}
            {docType === 'referral' && (
                <>
                    <label>Opis</label>
                    <textarea className="input"
                              rows={3}
                              name="description"
                              value={form.description}
                              onChange={handleChange}
                    />
                </>
            )}
            <label>Uwagi</label>
            <textarea className="input"
                      rows={docType === 'prescription' ? 2 : 3}
                      name="comment"
                      value={form.comment}
                      onChange={handleChange}
            />

            {error && <p className="formError">{error}</p>}

            <div className="row rowEnd">
                <button className="greenBtn"
                        type="button"
                        onClick={handleSave}
                >
                    Wystaw
                </button>
            </div>
        </PopUp>
    );
}
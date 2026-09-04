import './RatingPopUp.css';
import {useState} from 'react';
import {createReview} from '../../../../api/appointments.ts';
import {getErrorMessage} from '../../../../api/errors.ts';
import {PopUp} from '../../PopUp/PopUp.tsx';

//https://dev.to/michaelburrows/create-a-custom-react-star-rating-component-5o6

type RatingPopUpProps = {
    doctorName: string;
    appointmentId: number;
    onClose: () => void;
};

export function RatingPopUp({doctorName, appointmentId, onClose}: RatingPopUpProps) {
    const [rating, setRating] = useState(0);
    const [hover, setHover] = useState(0);
    const [comment, setComment] = useState('');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    async function handleSubmit() {
        if (saving) return;

        setError('');
        setSaving(true);
        try {
            await createReview({appointment: appointmentId, rating, comment});
            onClose();
        } catch (er) {
            setError(getErrorMessage(er, 'Nie udało się zapisać opinii.'));
        } finally {
            setSaving(false);
        }
    }

    return (
        <PopUp title="Oceń wizytę" onClose={onClose}>
            <p className="ratingPrompt">Oceń wizytę u {doctorName}?</p>

            <div className="row rowCenter">
                {[...Array(5)].map((_star, index) => {
                    index += 1;
                    return (
                        <button type="button"
                                key={index}
                                className={`starButton ${index <= (hover || rating) ? 'starActive' : ''}`}
                                disabled={saving}
                                onClick={() => setRating(index)}
                                onMouseEnter={() => setHover(index)}
                                onMouseLeave={() => setHover(rating)}>
                            <span className="star">&#9733;</span>
                        </button>
                    );
                })}
            </div>

            <textarea className="input" rows={4}
                      placeholder="Napisz opinię (opcjonalnie)"
                      value={comment}
                      onChange={(event) => setComment(event.target.value)}/>

            {error && <p className="formError">{error}</p>}

            <div className="row rowEnd">
                <button type="button" className="linkBtn" onClick={onClose} disabled={saving}>
                    Pomiń
                </button>
                <button type="button" className="greenBtn"
                        disabled={rating === 0}
                        onClick={handleSubmit}>
                    Dodaj opinię
                </button>
            </div>
        </PopUp>
    );
}
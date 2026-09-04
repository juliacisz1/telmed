import '../../Styles/PopUp.css';
import {createPortal} from 'react-dom';
import type {ReactNode} from 'react';

type PopUpProps = {
    title: string;
    onClose: () => void;
    children: ReactNode;
};

export function PopUp({title, onClose, children}: PopUpProps) {

    return createPortal(
        <div className="popupOverlay" onClick={onClose}>
            <div className="popup" onClick={(event) => event.stopPropagation()}>
                <div className="popupHeader">
                    <h2>{title}</h2>
                    <button className="popupCloseBtn"
                            type="button"
                            onClick={onClose}
                    >
                        ✕
                    </button>
                </div>
                <div className="popupBody">
                    {children}
                </div>
            </div>
        </div>,
        document.body
    );
}
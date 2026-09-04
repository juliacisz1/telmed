import '../../Styles/PageStyle.css';
import {useNavigate} from 'react-router-dom';
import type {ReactNode} from 'react';

type TopBarProps = {
    logoTo?: string;
    children?: ReactNode;
};

export function TopBar({logoTo = '/', children}: TopBarProps) {
    const navigate = useNavigate();

    return (
        <header className="topBar">
            <div className="topBarInner">
                <button type="button" className="logoBtn" onClick={() => navigate(logoTo)}> Platforma TelMed</button>
                {children && <div className="row">{children}</div>}
            </div>
        </header>
    );
}
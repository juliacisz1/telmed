import 'react-datepicker/dist/react-datepicker.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './shared/Styles/base.css'
import './shared/Styles/forms.css'
import './shared/Styles/cards.css'
import './shared/Styles/buttons.css'
import {AuthProvider} from "./context/AuthContext.tsx";
import {Settings} from 'luxon';

Settings.defaultLocale = 'pl';
createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <AuthProvider>
            <App />
        </AuthProvider>
    </StrictMode>,
)
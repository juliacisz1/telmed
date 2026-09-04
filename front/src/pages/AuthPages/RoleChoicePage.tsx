import '../../shared/Styles/PageStyle.css'
import {TileButton} from "../../shared/UIComponents/TileButton/TileButton.tsx";
import {TopBar} from "../../shared/UIComponents/TopBar/TopBar.tsx";

export function RoleChoicePage() {
    return(
        <div className="page">
            <TopBar />

            <main className="main">
                <section className="card wideCard">
                    <h1>Dołącz do <span className="logoText">TelMed</span></h1>
                    <div>Określ, czy chcesz się zarejestrować jako pacjent czy lekarz</div>
                    <div className="row rowCenter">
                        <TileButton
                            icon={<img src="/PatientIcon/patient.svg" alt="" width={40} height={40} />}
                            title="Pacjent"
                            description="Dołącz jako pacjent i umawiaj wizyty online"
                            to="/register-patient"
                        />
                        <TileButton
                            icon={<img src="/DoctorIcon/doctor.svg" alt="" width={40} height={40} />}
                            title="Lekarz"
                            description="Dołącz jako lekarz i rozpocznij przyjmowanie pacjentów"
                            to="/register-doctor"
                        />
                    </div>
                </section>
            </main>
        </div>
    )
}
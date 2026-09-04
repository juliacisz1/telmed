import {appointmentStatus, type Appointment} from '../../../../types.ts';
import {STATUS_LABEL} from '../../../../constants.ts';

type StatusBadgeProps = {
    appointment: Appointment;
};

export function StatusBadge({appointment}: StatusBadgeProps) {
    const status = appointmentStatus(appointment);
    const color = status === 'booked' ? 'badgeGreen' : status === 'cancelled' ? 'badgeRed' : '';
    return (
        <span className={`badge ${color}`}>
            {STATUS_LABEL[status]}
        </span>
    );
}
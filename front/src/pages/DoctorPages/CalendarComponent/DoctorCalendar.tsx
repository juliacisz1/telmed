import 'react-big-calendar/lib/css/react-big-calendar.css';
import './calendar-overrides.css';
import {useMemo, useState} from 'react';
import {Calendar, Views, luxonLocalizer, type View} from 'react-big-calendar';
import {DateTime} from 'luxon';
import type {Appointment, DaySchedule, Absence} from '../../../types.ts';
import {CALENDAR_END_HOUR, CALENDAR_START_HOUR} from '../../../constants.ts';

const localizer = luxonLocalizer(DateTime, {firstDayOfWeek: 1});

const CALENDAR_START_TIME = `${String(CALENDAR_START_HOUR).padStart(2, '0')}:00`;
const CALENDAR_END_TIME = `${String(CALENDAR_END_HOUR).padStart(2, '0')}:00`;

function toWeekday(tsDay: number) {
    return tsDay === 0 ? 6 : tsDay - 1;
}

type CalendarEvent = {
    id: number;
    kind: 'appointment' | 'absence';
    title: string;
    start: Date;
    end: Date;
};

type DoctorCalendarProps = {
    appointments: Appointment[];
    schedule: DaySchedule[];
    absences: Absence[];
    onSelectAppointment: (id: number) => void;
    onSelectAbsence: (absence: Absence) => void;
};

export function DoctorCalendar({appointments, schedule, absences, onSelectAppointment, onSelectAbsence}: DoctorCalendarProps) {
    const [date, setDate] = useState(new Date());
    const [view, setView] = useState<View>(Views.WEEK);

    const events: CalendarEvent[] = useMemo(() => appointments
            .filter(appointment => appointment.status !== 'cancelled')
            .map(appointment => ({
                id: appointment.id,
                kind: 'appointment',
                title: appointment.patient_name,
                start: new Date(appointment.start_time),
                end: new Date(appointment.end_time),
            })),
        [appointments]
    );

    const absenceEvents: CalendarEvent[] = useMemo(() => {
        const result: CalendarEvent[] = [];
        for (const absence of absences) {
            let day = DateTime.fromISO(absence.start_date);
            const lastDay = DateTime.fromISO(absence.end_date);
            while (day <= lastDay) {
                const dateStr = day.toFormat('yyyy-MM-dd');
                result.push({
                    id: absence.id,
                    kind: 'absence',
                    title: absence.description || 'Nieobecność',
                    start: absence.all_day ? DateTime.fromISO(`${dateStr}T${CALENDAR_START_TIME}`).toJSDate() : DateTime.fromISO(`${dateStr}T${absence.start_time}`).toJSDate(),
                    end: absence.all_day ? DateTime.fromISO(`${dateStr}T${CALENDAR_END_TIME}`).toJSDate() : DateTime.fromISO(`${dateStr}T${absence.end_time}`).toJSDate(),
                });
                day = day.plus({days: 1});
            }
        }
        return result;
    }, [absences]);

    function slotPropGetter(slotDate: Date) {
        if (schedule.length === 0) return {};
        const time = slotDate.getHours() * 60 + slotDate.getMinutes();
        const daySchedule = schedule.find(entry => entry.day_of_week === toWeekday(slotDate.getDay()));

        if (!daySchedule || !daySchedule.is_working
            || !daySchedule.start_time || !daySchedule.end_time) {
            return {className: 'calendarOffHours'};
        }

        const [startH, startM] = daySchedule.start_time.split(':').map(Number);
        const [endH, endM] = daySchedule.end_time.split(':').map(Number);
        const start = startH * 60 + startM;
        const end = endH * 60 + endM;

        if (time < start || time >= end) {
            return {className: 'calendarOffHours'};
        }

        return {};
    }

    function dayPropGetter(dayDate: Date) {
        if (view !== Views.MONTH) return {};
        const daySchedule = schedule.find(entry => entry.day_of_week === toWeekday(dayDate.getDay()));
        const notWorking = !daySchedule || !daySchedule.is_working;

        const dateStr = DateTime.fromJSDate(dayDate).toFormat('yyyy-MM-dd');
        const hasAllDayAbsence = absences.some(
            absence => absence.all_day && absence.start_date <= dateStr && absence.end_date >= dateStr
        );

        if (notWorking || hasAllDayAbsence) {
            return {className: 'calendarOffHours'};
        }
        return {};
    }

    return (
        <Calendar
            className="doctorCalendar"
            localizer={localizer}
            events={view === Views.MONTH ? [...events, ...absenceEvents] : events}
            backgroundEvents={view === Views.MONTH ? [] : absenceEvents}
            date={date}
            view={view}
            onNavigate={setDate}
            onView={setView}
            onSelectEvent={(event) => {
                if (event.kind === 'absence') {
                    const absence = absences.find(item => item.id === event.id);
                    if (absence) {
                        onSelectAbsence(absence);
                    }
                } else {
                    onSelectAppointment(event.id);
                }
            }}
            selectable
            onSelectSlot={(slotInfo) => {
                if (view === Views.MONTH) {
                    setDate(slotInfo.start);
                    setView(Views.DAY);
                }
            }}
            eventPropGetter={(event) => {
                if (event.kind === 'absence') return {className: 'calendarAbsenceEvent'};
                return event.end < new Date() ? {className: 'calendarPastEvent'} : {};
            }}
            views={[Views.WEEK, Views.DAY, Views.MONTH]}
            step={30}
            timeslots={1}
            min={new Date(2000, 0, 1, CALENDAR_START_HOUR, 0)}
            max={new Date(2000, 0, 1, CALENDAR_END_HOUR, 0)}
            slotPropGetter={slotPropGetter}
            dayPropGetter={dayPropGetter}
            messages={{
                today: 'Dziś',
                previous: '<',
                next: '>',
                week: 'Tydzień',
                day: 'Dzień',
                month: 'Miesiąc',
            }}
        />
    );
}
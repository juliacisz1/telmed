from datetime import timedelta
from django.utils import timezone

JOIN_EARLY_MINUTES = 10
LEAVE_LATE_MINUTES = 30


def visit_room_open(appointment):
    if appointment.status != 'booked':
        return False
    now = timezone.now()
    return (appointment.start_time - timedelta(minutes=JOIN_EARLY_MINUTES)
            <= now
            <= appointment.end_time + timedelta(minutes=LEAVE_LATE_MINUTES))
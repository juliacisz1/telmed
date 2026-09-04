from django.db import models
from encrypted_files.fields import EncryptedFileField

from TelMed.users.models import Doctor, Patient, Specialty


#https://docs.djangoproject.com/en/6.0/topics/db/models/#multi-table-inheritance
#https://docs.djangoproject.com/en/6.0/ref/models/options/
#https://stackoverflow.com/questions/56860065/date-validation-end-date-must-be-greater-than-start-date

class DoctorSchedule(models.Model):
    DAYS_OF_WEEK = [
        (0, 'Poniedziałek'),
        (1, 'Wtorek'),
        (2, 'Środa'),
        (3, 'Czwartek'),
        (4, 'Piątek'),
        (5, 'Sobota'),
        (6, 'Niedziela')
    ]

    doctor = models.ForeignKey(Doctor, on_delete=models.CASCADE, related_name='schedule')
    day_of_week = models.IntegerField(choices=DAYS_OF_WEEK)
    is_working = models.BooleanField(default=False)
    start_time = models.TimeField(null=True, blank=True)
    end_time = models.TimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['doctor', 'day_of_week'], name='unique_doctor_day'),
            models.CheckConstraint(
                condition=models.Q(end_time__gte=models.F('start_time')),
                name='schedule_end_time_gte_start'
            )
        ]
        ordering = ['day_of_week']
        verbose_name = 'Doctor\'s schedule'
        verbose_name_plural = 'Doctor\'s schedules'


    def __str__(self):
        return f"{self.doctor} – {self.get_day_of_week_display()} {self.start_time}-{self.end_time}"


class Appointment(models.Model):
    STATUS_CHOICES = [
        ('booked', 'Umówiona'),
        ('completed', 'Zakończona'),
        ('cancelled', 'Anulowana'),
    ]

    doctor = models.ForeignKey(Doctor, on_delete=models.CASCADE, related_name='appointments')
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='appointments')
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    status = models.CharField(choices=STATUS_CHOICES, default='booked', max_length=10)
    advice = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    reminder_task_id = models.CharField(max_length=255, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['start_time']
        constraints = [
            models.CheckConstraint(
                condition=models.Q(end_time__gt=models.F('start_time')), name='appointment_end_after_start'
            )
        ]

    def __str__(self):
        return f"{self.patient} u {self.doctor} – {self.start_time:%d.%m.%Y %H:%M}"

class DoctorAbsence(models.Model):
    doctor = models.ForeignKey(Doctor, on_delete=models.CASCADE, related_name='absences')
    start_date = models.DateField()
    end_date = models.DateField()
    all_day = models.BooleanField(default=False)
    start_time = models.TimeField(null=True, blank=True)
    end_time = models.TimeField(null=True, blank=True)
    description = models.CharField(max_length=100, blank=True)

    class Meta:
        verbose_name = 'Doctor\'s absence'
        verbose_name_plural = 'Doctor\'s absences'
        constraints = [
            models.CheckConstraint(
                condition=models.Q(end_date__gte=models.F('start_date')),
                name='absence_end_date_gte_start'
            ),
            models.CheckConstraint(
                condition=models.Q(end_time__gt=models.F('start_time')),
                name='absence_end_time_gt_start'
            ),
            models.CheckConstraint(
                condition=models.Q(all_day=True, start_time__isnull=True, end_time__isnull=True)
                          | models.Q(all_day=False, start_time__isnull=False, end_time__isnull=False),
                name='absence_times_match_all_day'
            ),
        ]

    def __str__(self):
        return f'{self.doctor} - nieobecność od {self.start_date} do {self.end_date}'

class MedicalDocument(models.Model):
    TYPE_CHOICES = [
        ('prescription', 'Recepta'),
        ('referral', 'Skierowanie'),
        ('sick_leave', 'Zwolnienie lekarskie'),
    ]

    appointment = models.ForeignKey(Appointment, on_delete=models.CASCADE, related_name='documents')
    doc_type = models.CharField(choices=TYPE_CHOICES, max_length=15)
    comment = models.TextField(blank=True)
    pdf_file = EncryptedFileField(upload_to='documents/', null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.get_doc_type_display()} – {self.appointment}"

class Diagnosis(models.Model):
    code = models.CharField(max_length=10, unique=True)
    name = models.CharField(max_length=1000)

    class Meta:
        ordering = ['code']

    def __str__(self):
        return f"({self.code}) {self.name}"

class Drug(models.Model):
    name = models.CharField(max_length=1000)
    strength = models.CharField(max_length=1000, blank=True)
    form = models.CharField(max_length=1000, blank=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f"{self.name}, {self.form}, {self.strength}"

class Prescription(MedicalDocument):
    drug = models.ForeignKey(Drug, on_delete=models.PROTECT, related_name='prescriptions')
    diagnosis = models.ForeignKey(Diagnosis, on_delete=models.PROTECT, related_name='prescriptions')
    dosage = models.CharField(max_length=200)
    quantity = models.CharField(max_length=100)
    description = models.TextField(blank=True)

    def save(self, **kwargs):
        self.doc_type = 'prescription'
        super().save(**kwargs)

class Referral(MedicalDocument):
    TARGET_CHOICES = [
        ('doctor', 'Do lekarza specjalisty'),
        ('exam', 'Na badanie'),
    ]

    diagnosis = models.ForeignKey(Diagnosis, on_delete=models.PROTECT, related_name='referrals')
    target = models.CharField(choices=TARGET_CHOICES, max_length=10)
    specialty = models.ForeignKey(Specialty, on_delete=models.PROTECT, related_name='referrals', null=True, blank=True)
    exam_name = models.CharField(max_length=300, blank=True)
    description = models.TextField(blank=True)

    def save(self, **kwargs):
        self.doc_type = 'referral'
        super().save(**kwargs)

class SickLeave(MedicalDocument):
    diagnosis = models.ForeignKey(Diagnosis, on_delete=models.PROTECT, related_name='sick_leaves')
    date_from = models.DateField()
    date_to = models.DateField()

    def save(self, **kwargs):
        self.doc_type = 'sick_leave'
        super().save(**kwargs)

class Review(models.Model):
    doctor = models.ForeignKey(Doctor, on_delete=models.CASCADE, related_name='reviews')
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='reviews')
    appointment = models.OneToOneField(Appointment, on_delete=models.SET_NULL, null=True, blank=True, related_name='review')
    rating = models.IntegerField()
    comment = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=models.Q(rating__gte=1) & models.Q(rating__lte=5), name='rating_in_(1-5)'
            )
        ]
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.rating}/5 – {self.doctor} od {self.patient}"
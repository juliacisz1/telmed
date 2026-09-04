import csv

from django.core.management.base import BaseCommand, CommandError

from TelMed.appointments.models import Diagnosis, Drug
from TelMed.users.models import Specialty


def import_drugs(path):
    with open(path, encoding='utf-8-sig', newline='') as csvfile:
        reader = csv.DictReader(csvfile, delimiter=';')
        drugs = [
            Drug(
                name=row['Nazwa Produktu Leczniczego'],
                strength=row['Moc'],
                form=row['Postać farmaceutyczna'],
            )
            for row in reader
            if row['Nazwa Produktu Leczniczego']
        ]
    Drug.objects.bulk_create(drugs, batch_size=1000)
    return len(drugs)


def import_diagnosis(path):
    with open(path, encoding='utf-8-sig', newline='') as csvfile:
        reader = csv.DictReader(csvfile, delimiter=';')
        diagnoses = {}
        for row in reader:
            if row['icd10Code'] and row['icd10Title']:
                diagnoses[row['icd10Code']] = Diagnosis(code=row['icd10Code'], name=row['icd10Title'])
    Diagnosis.objects.bulk_create(diagnoses.values(), batch_size=1000)
    return len(diagnoses)


def import_specialties(path):
    with open(path, encoding='utf-8-sig', newline='') as csvfile:
        reader = csv.DictReader(csvfile, delimiter=';')
        specialties = {}
        for row in reader:
            if row['name']:
                specialties[row['name']] = Specialty(name=row['name'])
    Specialty.objects.bulk_create(specialties.values(), batch_size=1000)
    return len(specialties)


class Command(BaseCommand):
    help = 'Wczytuje leki, rozpoznania i specjalizacje z plików CSV.'

    def add_arguments(self, parser):
        parser.add_argument('--drugs')
        parser.add_argument('--diagnoses')
        parser.add_argument('--specialties')

    def handle(self, *args, **options):
        if not options['drugs'] and not options['diagnoses'] and not options['specialties']:
            raise CommandError('Podaj --drugs, --diagnoses albo --specialties.')

        if options['diagnoses']:
            count = import_diagnosis(options['diagnoses'])
            self.stdout.write(self.style.SUCCESS(f'Wczytano rozpoznania: {count}'))

        if options['drugs']:
            count = import_drugs(options['drugs'])
            self.stdout.write(self.style.SUCCESS(f'Wczytano leki: {count}'))

        if options['specialties']:
            count = import_specialties(options['specialties'])
            self.stdout.write(self.style.SUCCESS(f'Wczytano specjalizacje: {count}'))
import io
from xml.sax.saxutils import escape

from django.conf import settings
from django.core.files.base import ContentFile
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

FONT_NAME = 'DejaVu'
FONT_PATH = settings.BASE_DIR / 'fonts' / 'DejaVuSans.ttf'
FONT_REGISTERED = False

try:
    pdfmetrics.registerFont(TTFont(FONT_NAME, str(FONT_PATH)))
    FONT_REGISTERED = True
except Exception:
    FONT_REGISTERED = False


DOC_TITLES = {
    'prescription': 'Recepta',
    'referral': 'Skierowanie',
    'sick_leave': 'Zwolnienie lekarskie',
}

TITLE_STYLE = ParagraphStyle('title', fontName=FONT_NAME, fontSize=18, leading=22)
HEADER_STYLE = ParagraphStyle('header', fontName=FONT_NAME, fontSize=10, leading=16)
LABEL_STYLE = ParagraphStyle('label', fontName=FONT_NAME, fontSize=11, leading=15, spaceBefore=0.35 * cm)
VALUE_STYLE = ParagraphStyle('value', fontName=FONT_NAME, fontSize=11, leading=15, leftIndent=2.5 * cm)


def line(story, label, value):
    if not value:
        return
    story.append(Paragraph(f'{label}:', LABEL_STYLE))
    story.append(Paragraph(escape(str(value)), VALUE_STYLE))


def generate_document_pdf(document):
    if not FONT_REGISTERED:
        raise RuntimeError('Brak czcionki.')

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=2 * cm, rightMargin=2 * cm, topMargin=3 * cm, bottomMargin=2 * cm)

    doctor = document.appointment.doctor
    patient = document.appointment.patient

    story = [
        Paragraph(DOC_TITLES.get(document.doc_type, 'Dokument'), TITLE_STYLE),
        Spacer(1, 0.8 * cm),
        Paragraph(f'Lekarz: {escape(str(doctor))}', HEADER_STYLE),
        Paragraph(f'Pacjent: {escape(str(patient))}', HEADER_STYLE),
        Paragraph(f'Data wystawienia: {document.created_at:%d.%m.%Y}', HEADER_STYLE),
        Spacer(1, 0.8 * cm),
    ]

    if document.doc_type == 'prescription':
        line(story, 'Lek', document.drug.name)
        line(story, 'Moc', document.drug.strength)
        line(story, 'Postać', document.drug.form)
        line(story, 'Dawkowanie', document.dosage)
        line(story, 'Ilość', document.quantity)
        line(story, 'Rozpoznanie', document.diagnosis)
        line(story, 'Informacja dla pacjenta', document.description)
        line(story, 'Uwagi', document.comment)
    elif document.doc_type == 'sick_leave':
        line(story, 'Rozpoznanie', document.diagnosis)
        if document.date_from and document.date_to:
            line(story, 'Okres', f'{document.date_from:%d.%m.%Y} – {document.date_to:%d.%m.%Y}')
        line(story, 'Uwagi', document.comment)
    elif document.doc_type == 'referral':
        line(story, 'Rodzaj', document.get_target_display())
        if document.target == 'doctor' and document.specialty:
            line(story, 'Specjalizacja', document.specialty.name)
        if document.target == 'exam':
            line(story, 'Badanie', document.exam_name)
        line(story, 'Rozpoznanie', document.diagnosis)
        line(story, 'Opis', document.description)
        line(story, 'Uwagi', document.comment)

    doc.build(story)
    buffer.seek(0)
    document.pdf_file.save(f"{document.doc_type}_{document.id}.pdf", ContentFile(buffer.read()), save=True)
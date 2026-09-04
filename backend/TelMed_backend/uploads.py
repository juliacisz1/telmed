import os

MAX_UPLOAD_SIZE = 5242880  #5 MB
ALLOWED_UPLOAD_TYPES = {'application/pdf', 'image/jpeg', 'image/png'}
ALLOWED_FILE_TYPES = {'.pdf', '.jpg', '.jpeg', '.png'}
FILE_SIGNATURES = {
    '.pdf': (b'%PDF-',),
    '.jpg': (b'\xff\xd8\xff',),
    '.jpeg': (b'\xff\xd8\xff',),
    '.png': (b'\x89PNG\r\n\x1a\n',),
}

def validate_upload(uploaded_file):
    if uploaded_file is None:
        return 'Brak pliku.'
    if uploaded_file.size > MAX_UPLOAD_SIZE:
        return 'Plik jest za duży. Maksymalny rozmiar to 5 MB.'
    extension = os.path.splitext(uploaded_file.name)[1].lower()
    if extension not in ALLOWED_FILE_TYPES or uploaded_file.content_type not in ALLOWED_UPLOAD_TYPES:
        return 'Dozwolone są wyłącznie pliki PDF, JPG i PNG.'
    head = uploaded_file.read(8)
    uploaded_file.seek(0)
    if not head.startswith(FILE_SIGNATURES.get(extension, ())):
        return 'Zawartość pliku nie odpowiada jego rozszerzeniu.'
    return None
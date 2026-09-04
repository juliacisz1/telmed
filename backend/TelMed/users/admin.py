from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.forms import UserCreationForm, UserChangeForm

from TelMed.users.models import User, Doctor, Patient, Specialty


# Register your models here.
#https://docs.djangoproject.com/en/6.0/topics/auth/customizing/#a-full-example
#https://docs.djangoproject.com/en/6.0/ref/contrib/admin/


#panel admina
#https://docs.djangoproject.com/en/5.0/_modules/django/contrib/auth/forms/
#te formularze już mają wszystkie funkcje walidujące dane
#nadpisuje tylko meta fields bo jest rola
class CustomUserCreationForm(UserCreationForm):
    class Meta:
        model = User
        fields = ('email','first_name', 'last_name', 'role')


class CustomUserChangeForm(UserChangeForm):
    class Meta:
        model = User
        fields = ('email', 'first_name', 'last_name', 'role')

class CustomUserAdmin(UserAdmin):
    model = User
    add_form = CustomUserCreationForm
    form = CustomUserChangeForm
    list_display = ['email', 'first_name', 'last_name', 'role']
    search_fields = ['email', 'first_name', 'last_name']
    ordering = ['email']
    list_filter = ['role', 'is_staff', 'is_superuser', 'is_active']
    filter_horizontal = []
    readonly_fields = ['last_login', 'date_joined', 'updated_at']

    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('User details', {'fields': ('first_name', 'last_name', 'role')}),
        ('Permissions', {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('Dates', {'fields': ('last_login', 'date_joined', 'updated_at')}),
    )

    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'first_name', 'last_name', 'password1', 'password2', 'role'),
        }),
    )

admin.site.register(User, CustomUserAdmin)

@admin.register(Doctor)
class DoctorAdmin(admin.ModelAdmin):
    list_display = ['__str__', 'get_specialties']
    search_fields = ['user__first_name', 'user__last_name', 'pwz_number']
    filter_horizontal = ['specialties']

    @admin.display(description="Specialties")
    def get_specialties(self, obj):
        return ", ".join(s.name for s in obj.specialties.all())


@admin.register(Patient)
class PatientAdmin(admin.ModelAdmin):
    list_display = ['__str__', 'get_email']
    search_fields = ['user__first_name', 'user__last_name', 'user__email']

    @admin.display(description="E-mail")
    def get_email(self, obj):
        return obj.user.email


@admin.register(Specialty)
class SpecialtyAdmin(admin.ModelAdmin):
    search_fields = ['name']

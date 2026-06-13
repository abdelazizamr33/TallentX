import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-recruiter-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './recruiter-settings.html',
})
export class RecruiterSettingsPage {
  private authService = inject(AuthService);
  private toastService = inject(ToastService);

  email = localStorage.getItem('ies_email') || '';
  isSaving = false;
  profilePicUrl: string | null = localStorage.getItem('ies_recruiter_profile_pic');

  formData = {
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  };

  onProfilePicSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        this.toastService.error('File size exceeds 5MB limit.');
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (e) => {
        this.profilePicUrl = e.target?.result as string;
        // Since there is no backend endpoint for recruiter profile pictures,
        // we store it locally so it persists across sessions.
        localStorage.setItem('ies_recruiter_profile_pic', this.profilePicUrl);
        this.toastService.success('Profile picture updated successfully!');
      };
      reader.readAsDataURL(file);
    }
  }

  saveChanges(): void {
    if (!this.formData.currentPassword || !this.formData.newPassword) {
      this.toastService.error('Please enter current and new password.');
      return;
    }

    if (this.formData.newPassword !== this.formData.confirmPassword) {
      this.toastService.error('New passwords do not match.');
      return;
    }

    this.isSaving = true;
    this.authService.changePassword({
      currentPassword: this.formData.currentPassword,
      newPassword: this.formData.newPassword
    }).subscribe({
      next: () => {
        this.isSaving = false;
        this.toastService.success('Password changed successfully!');
        this.formData = { currentPassword: '', newPassword: '', confirmPassword: '' };
      },
      error: (err) => {
        this.isSaving = false;
        this.toastService.error(err.error?.message || 'Failed to change password');
      }
    });
  }
}

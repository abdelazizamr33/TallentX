import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { RegisterCompanyRequest, RegisterRecruiterRequest } from '../../core/models/auth.models';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-employer-register-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './employer-register.html',
})
export class EmployerRegisterPage {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private authService = inject(AuthService);
  private toast = inject(ToastService);

  mode: 'join' | 'create' = 'join';
  joinForm: FormGroup;
  createForm: FormGroup;
  
  isLoading = false;
  showPassword = false;

  constructor() {
    // Common validators
    const passwordValidators = [
      Validators.required,
      Validators.minLength(8),
      Validators.pattern('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$')
    ];

    // Form for Joining an existing company
    this.joinForm = this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', passwordValidators],
      phoneNumber: ['', Validators.required],
      gender: ['Male', Validators.required],
      dateOfBirth: ['', Validators.required],
      inviteCode: ['', Validators.required]
    });

    // Form for Creating a new company
    this.createForm = this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', passwordValidators],
      phoneNumber: ['', Validators.required],
      gender: ['Male', Validators.required],
      dateOfBirth: ['', Validators.required],
      companyName: ['', Validators.required],
      industry: ['', Validators.required],
      website: [''],
      description: ['']
    });
  }

  get activeForm(): FormGroup {
    return this.mode === 'join' ? this.joinForm : this.createForm;
  }

  get f() { 
    return this.activeForm.controls; 
  }

  setMode(newMode: 'join' | 'create') {
    this.mode = newMode;
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  onSubmit() {
    if (this.activeForm.invalid) {
      this.activeForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    const raw = this.activeForm.value;

    if (this.mode === 'join') {
      const payload: RegisterRecruiterRequest = {
        firstName: raw.firstName,
        lastName: raw.lastName,
        email: raw.email,
        password: raw.password,
        phoneNumber: raw.phoneNumber,
        gender: raw.gender,
        dateOfBirth: raw.dateOfBirth ? new Date(raw.dateOfBirth).toISOString() : raw.dateOfBirth,
        inviteCode: raw.inviteCode
      };

      this.authService.registerRecruiter(payload).pipe(
        finalize(() => this.isLoading = false)
      ).subscribe({
        next: (res) => {
          if (res) {
            this.toast.success('Successfully joined the company! Welcome to TallentX.');
            this.router.navigate(['/recruiter/dashboard']);
          }
        },
        error: (err) => {
          const message = err?.error?.message || 'Failed to join company. Please check your invite code.';
          this.toast.error(message);
        }
      });
    } else {
      const payload: RegisterCompanyRequest = {
        firstName: raw.firstName,
        lastName: raw.lastName,
        email: raw.email,
        password: raw.password,
        phoneNumber: raw.phoneNumber,
        gender: raw.gender,
        dateOfBirth: raw.dateOfBirth ? new Date(raw.dateOfBirth).toISOString() : undefined,
        companyName: raw.companyName,
        industry: raw.industry,
        website: raw.website,
        taxNumber: 'N/A' // Send N/A to satisfy backend if required
      };

      this.authService.registerCompany(payload).pipe(
        finalize(() => this.isLoading = false)
      ).subscribe({
        next: (res) => {
          if (res) {
            this.toast.success('Company registered successfully! You are now the Administrator.');
            this.router.navigate(['/recruiter/dashboard']);
          }
        },
        error: (err) => {
          const message = err?.error?.message || 'Company registration failed. Please review your data.';
          this.toast.error(message);
        }
      });
    }
  }
}

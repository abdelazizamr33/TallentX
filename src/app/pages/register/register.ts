import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { RegisterRequest } from '../../core/models/auth.models';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './register.html',
  styleUrls: ['./register.css'],
})
export class Register {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private toast = inject(ToastService);

  registerForm: FormGroup;
  isLoading = false;
  showPassword = false;
  errorMessage = '';

  constructor() {
    this.registerForm = this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phoneNumber: ['', Validators.required],
      gender: ['Male', Validators.required],
      dateOfBirth: ['', Validators.required],
      terms: [false, Validators.requiredTrue],
      password: [
        '',
        [
          Validators.required,
          Validators.minLength(8),
          Validators.pattern('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$'),
        ]
      ]
    });
  }

  get f() { return this.registerForm.controls; }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  private toIsoDate(dateValue: string): string {
    const d = new Date(dateValue);
    if (Number.isNaN(d.getTime())) {
      throw new Error('Invalid date');
    }
    return d.toISOString();
  }

  private buildRegisterRequest(): RegisterRequest {
    const v = this.registerForm.getRawValue();
    const dateOfBirth = this.toIsoDate(v.dateOfBirth as string);

    return {
      firstName: String(v.firstName ?? '').trim(),
      lastName: String(v.lastName ?? '').trim(),
      email: String(v.email ?? '').trim(),
      password: v.password as string,
      phoneNumber: String(v.phoneNumber ?? '').trim(),
      gender: v.gender as 'Male' | 'Female' | 'Other',
      dateOfBirth,
      userType: 'Candidate'
    };
  }

  onSubmit() {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    let payload: RegisterRequest;
    try {
      payload = this.buildRegisterRequest();
    } catch {
      this.registerForm.get('dateOfBirth')?.setErrors({ invalidDate: true });
      this.registerForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    this.authService.register(payload).pipe(
      finalize(() => {
        this.isLoading = false;
      })
    ).subscribe({
      next: (res) => {
        if (res) {
          this.toast.success('Registration successful! Welcome to TallentX.');
          this.router.navigate(['/candidate/dashboard']);
        }
      },
      error: (err) => {
        const message = err?.error?.message || 'Registration failed. Please check your data and try again.';
        this.errorMessage = message;
        this.toast.error(message);
        console.error('Register error:', err);
      }
    });
  }
}

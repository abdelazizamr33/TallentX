import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/services/auth.service';
import { CompanyService } from '../../core/services/company.service';
import { ToastService } from '../../core/services/toast.service';
import { catchError, of } from 'rxjs';

@Component({
  selector: 'app-recruiter-layout',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './recruiter-layout.component.html',
  styles: [`
    :host {
      display: contents;
    }
  `]
})
export class RecruiterLayoutComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);
  private companyService = inject(CompanyService);
  private toast = inject(ToastService);

  companyName = signal<string>('');
  companyLogo = signal<string>('/logo.jpeg');
  isAdmin = signal<boolean>(false);

  ngOnInit(): void {
    const recruiterRole = this.authService.getRecruiterRole();
    const globalRole = this.authService.getRole();
    const userId = this.authService.getUserId();
    
    this.isAdmin.set(
      recruiterRole === 'Admin' || 
      recruiterRole === 'admin' || 
      globalRole === 'Admin' || 
      globalRole === 'admin'
    );

    const companyId = this.authService.getCompanyId();
    if (companyId) {
      this.companyService.getCompany(companyId).pipe(catchError(() => of(null))).subscribe(company => {
        if (company) {
          this.companyName.set(company.name);
          if (userId && company.adminId === userId) {
            this.isAdmin.set(true);
          }
          if (company.logoPath) {
            const normalizedPath = company.logoPath.replace(/\\/g, '/');
            const logoUrl = normalizedPath.startsWith('http') 
              ? normalizedPath 
              : `${environment.baseUrl}${normalizedPath.startsWith('/') ? '' : '/'}${normalizedPath}`;
            this.companyLogo.set(logoUrl);
          }
        }
      });
    }
  }

  createNewJob(): void {
    this.router.navigate(['/recruiter/jobs/new']);
  }

  onLogoError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (img.src !== '/logo.jpeg') {
      img.src = '/logo.jpeg';
    }
  }

  logout(): void {
    this.authService.logout('manual');
    this.toast.success('You have been logged out.');
    this.router.navigate(['/landing']);
  }
}

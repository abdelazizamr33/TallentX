import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { RecruiterService, RecruiterStats, RecruiterJob, Applicant } from '../../core/services/recruiter';
import { ToastService } from '../../core/services/toast.service';
import { forkJoin, catchError, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AnalyticsService } from '../../core/services/analytics.service';
import { AuthService } from '../../core/services/auth.service';
import { InterviewDto } from '../../core/models/interview.models';
import { CompanyService } from '../../core/services/company.service';

interface PipelinePoint {
  day: string;
  value: number;
}

@Component({
  selector: 'app-recruiter-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './recruiter-dashboard.html',
  styles: [`
    :host {
      display: contents;
    }
  `]
})
export class RecruiterDashboard implements OnInit {
  private recruiterService = inject(RecruiterService);
  private toast = inject(ToastService);
  private analyticsService = inject(AnalyticsService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private companyService = inject(CompanyService);

  isLoading = signal<boolean>(true);
  stats = signal<RecruiterStats | null>(null);
  companyName = signal<string>('');
  adminName = signal<string>('');
  companyLogo = signal<string>('/logo.jpeg');
  recentJobs = signal<RecruiterJob[]>([]);
  recentApplicants = signal<Applicant[]>([]);
  upcomingInterviews = signal<InterviewDto[]>([]);

  chartData = signal<PipelinePoint[]>([]);

  get recruiterGreeting(): string {
    const email = localStorage.getItem('ies_email') || '';
    if (!email) {
      return 'there';
    }

    const localPart = email.split('@')[0] || email;
    return localPart
      .replace(/[._-]+/g, ' ')
      .replace(/\b\w/g, char => char.toUpperCase());
  }

  ngOnInit(): void {
    this.loadDashboardData();
  }

  loadDashboardData(): void {
    this.isLoading.set(true);
    
    const companyId = this.authService.getCompanyId();
    if (companyId) {
      this.companyService.getCompany(companyId).pipe(catchError(() => of(null))).subscribe(company => {
        if (company) {
          this.companyName.set(company.name);
          this.adminName.set(company.adminName || '');
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

    forkJoin({
      stats: this.recruiterService.getDashboardStats().pipe(catchError(() => of(null))),
      jobs: this.recruiterService.getJobPostings().pipe(catchError(() => of([]))),
      applicants: this.recruiterService.getApplicants().pipe(catchError(() => of([]))),
      interviews: this.recruiterService.getRecruiterInterviews(1, 5).pipe(catchError(() => of([])))
    }).subscribe(result => {
      if (result.stats) this.stats.set(result.stats);
      this.recentJobs.set(result.jobs.slice(0, 3)); // show top 3
      this.recentApplicants.set(result.applicants.slice(0, 5)); // show top 5
      this.upcomingInterviews.set(
        [...result.interviews]
          .sort((a, b) => new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime())
          .slice(0, 3)
      );

      this.loadAnalyticsChart();
      
      if (!result.stats) {
        console.warn('[RecruiterDashboard] Stats unavailable – using defaults.');
      }
      this.isLoading.set(false);
    });
  }

  private loadAnalyticsChart(): void {
    const companyId = this.authService.getCompanyId();
    if (!companyId) {
      this.chartData.set([]);
      return;
    }

    this.analyticsService.getCompanyAnalytics(companyId).pipe(
      catchError(() => of(null))
    ).subscribe(analytics => {
      if (!analytics?.applicationTrends?.length) {
        this.chartData.set([]);
        return;
      }

      const points = analytics.applicationTrends
        .slice(-7)
        .map(item => ({
          day: new Date(item.date).toLocaleDateString([], { weekday: 'short' }).toUpperCase(),
          value: Number(item.count ?? 0)
        }));

      this.chartData.set(points);
    });
  }

  get chartMaxValue(): number {
    const max = Math.max(...this.chartData().map(item => item.value), 0);
    return max > 0 ? max : 1;
  }

  getBarHeight(value: number): number {
    return Math.max(8, Math.round((value / this.chartMaxValue) * 100));
  }

  createNewJob(): void {
    this.router.navigate(['/recruiter/jobs/new']);
  }

  goToInterviewScheduling(): void {
    this.router.navigate(['/recruiter/interviews']);
  }

  showComingSoon(feature: string): void {
    this.toast.show(`${feature} is coming soon.`, 'info');
  }

  exportReport(): void {
    const statsData = this.stats();
    if (!statsData) {
      this.toast.show('No data to export', 'error');
      return;
    }
    
    // Client-side CSV export since there's no backend dashboard export
    const csvContent = "data:text/csv;charset=utf-8," 
        + "Metric,Value\n"
        + `Interviews Scheduled,${statsData.interviewsScheduled}\n`
        + `Total Applicants,${statsData.totalApplicants}\n`
        + `Active Job Posts,${statsData.activeJobs}\n`;
        
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `dashboard_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    this.toast.success('Report exported successfully');
  }

  shareDashboard(): void {
    navigator.clipboard.writeText(window.location.href);
    this.toast.success('Dashboard link copied to clipboard');
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


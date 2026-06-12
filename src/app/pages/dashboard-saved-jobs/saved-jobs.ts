import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { CandidateService } from '../../core/services/candidate.service';
import { JobListDto } from '../../core/models/job.models';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-saved-jobs-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './saved-jobs.html',
})
export class SavedJobsPage implements OnInit {
  private candidateService = inject(CandidateService);
  private toast = inject(ToastService);

  readonly jobs = signal<JobListDto[]>([]);
  readonly isLoading = signal<boolean>(true);

  readonly topMatches = computed(() =>
    [...this.jobs()].sort((left, right) => (right.applicantsCount ?? 0) - (left.applicantsCount ?? 0)).slice(0, 3)
  );

  ngOnInit(): void {
    this.loadSavedJobs();
  }

  loadSavedJobs(): void {
    this.isLoading.set(true);
    import('rxjs').then(({ forkJoin }) => {
      forkJoin({
        saved: this.candidateService.getSavedJobs(),
        apps: this.candidateService.getApplications()
      })
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: ({ saved, apps }) => {
          const appliedIds = apps.map(a => a.jobPostingId);
          const items = saved || [];
          items.forEach(job => {
            if (appliedIds.includes(Number(job.id ?? 0))) {
              job.applicantsCount = Math.max(job.applicantsCount || 0, 1);
            }
          });
          this.jobs.set(items);
        },
        error: () => {
          this.jobs.set([]);
          this.toast.error('Failed to load saved jobs.');
        }
      });
    });
  }

  unsave(jobId: number): void {
    this.candidateService.saveJob(jobId).subscribe({
      next: () => {
        this.jobs.update((current) => current.filter((job) => job.id !== jobId));
        this.toast.success('Job removed from saved list.');
      },
      error: () => this.toast.error('Failed to update saved job.')
    });
  }

  getCompanyName(job: any): string {
    if (!job) return 'Company';
    if (job.companyName) return job.companyName;
    if (typeof job.company === 'string') return job.company;
    if (job.company && typeof job.company === 'object') return job.company.name || 'Company';
    return 'Company';
  }
}

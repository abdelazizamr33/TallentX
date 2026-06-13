import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { RecruiterService } from '../../core/services/recruiter';
import { JobApplicationDto, ApplicationStatuses } from '../../core/models/job.models';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-recruiter-applicants-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './recruiter-applicants.html',
})
export class RecruiterApplicantsPage implements OnInit {
  private route = inject(ActivatedRoute);
  private recruiterService = inject(RecruiterService);
  private toast = inject(ToastService);

  readonly applicationStatuses = ApplicationStatuses;

  readonly applicants = signal<JobApplicationDto[]>([]);
  readonly isLoading = signal<boolean>(true);
  readonly searchTerm = signal<string>('');
  readonly selectedStatus = signal<string>('All');

  readonly filteredApplicants = computed(() => {
    const query = this.searchTerm().trim().toLowerCase();
    const status = this.selectedStatus();

    return this.applicants().filter((item) => {
      const matchesText = !query ||
        (item.candidateName ?? '').toLowerCase().includes(query) ||
        (item.jobTitle ?? '').toLowerCase().includes(query) ||
        item.candidateId.toLowerCase().includes(query);

      const matchesStatus = status === 'All' || item.status.toLowerCase() === status.toLowerCase();
      return matchesText && matchesStatus;
    });
  });

  ngOnInit(): void {
    const rawJobId = this.route.snapshot.paramMap.get('jobId');
    if (!rawJobId) {
      // Global applicants mode
      this.loadAllApplicants();
      return;
    }

    const jobId = Number(rawJobId);
    if (!Number.isFinite(jobId) || jobId <= 0) {
      this.isLoading.set(false);
      this.toast.error('Invalid job id.');
      return;
    }

    this.loadApplicants(jobId);
  }

  loadApplicants(jobId: number): void {
    this.isLoading.set(true);
    this.recruiterService.getJobApplicants(jobId)
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (applications) => {
          const activeApps = (applications ?? []).filter(a => a.status?.toLowerCase() !== 'withdrawn');
          this.applicants.set(activeApps);
        },
        error: () => {
          this.applicants.set([]);
          this.toast.error('Failed to load applicants.');
        }
      });
  }

  loadAllApplicants(): void {
    this.isLoading.set(true);
    this.recruiterService.getAllApplicants()
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (applications) => {
          const activeApps = (applications ?? []).filter(a => a.status?.toLowerCase() !== 'withdrawn');
          this.applicants.set(activeApps);
        },
        error: () => {
          this.applicants.set([]);
          this.toast.error('Failed to load all applicants.');
        }
      });
  }

  setSearchTerm(value: string): void {
    this.searchTerm.set(value);
  }

  setStatus(value: string): void {
    this.selectedStatus.set(value);
  }

  updateStatus(application: JobApplicationDto, status: string): void {
    if (application.status.toLowerCase() === status.toLowerCase()) {
      return;
    }

    let notes: string | undefined;
    if (status.toLowerCase() === 'rejected') {
      const input = prompt('Please enter the rejection reason (required):');
      if (!input || input.trim() === '') {
        this.toast.error('Rejection reason is required.');
        this.applicants.set([...this.applicants()]);
        return;
      }
      notes = input.trim();
    }

    this.recruiterService.updateApplicationStatus(application.id, status, notes).subscribe({
      next: (updated) => {
        this.applicants.update((current) =>
          current.map((item) => item.id === application.id ? updated : item)
        );
        this.toast.success(`Application moved to ${status}.`);
      },
      error: () => {
        this.toast.error('Failed to update applicant status.');
        this.applicants.set([...this.applicants()]);
      }
    });
  }

  getStatusColorClass(status: string): string {
    if (!status) return '';
    const s = status.toLowerCase();
    switch (s) {
      case 'accepted':
      case 'completed':
      case 'offered':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'interview':
      case 'interviewing':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'assessment':
        return 'bg-violet-100 text-violet-800 border-violet-300';
      case 'underreview':
      case 'in progress':
        return 'bg-sky-100 text-sky-800 border-sky-300';
      case 'pending':
      case 'new':
      case 'submitted':
        return 'bg-slate-100 text-slate-800 border-slate-300';
      case 'rejected':
      case 'failed':
        return 'bg-rose-100 text-rose-800 border-rose-300';
      case 'withdrawn':
        return 'bg-neutral-100 text-neutral-800 border-neutral-300';
      default:
        return 'bg-surface-container text-on-surface-variant border-outline-variant/30';
    }
  }
}

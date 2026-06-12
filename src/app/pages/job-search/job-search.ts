import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { forkJoin, of } from 'rxjs';
import { JobService } from '../../core/services/job';
import { AuthService } from '../../core/services/auth.service';
import { JobModel } from '../../core/models/candidate.models';
import { JobCardComponent } from '../../shared/components/job-card/job-card';
import { jobListDtoToJobModel } from '../../core/utils/job.mapper';
import { JobCategory, JOB_CATEGORY_OPTIONS } from '../../core/data/job-categories';
import { CandidateService } from '../../core/services/candidate.service';
import { ToastService } from '../../core/services/toast.service';

const CAREER_LEVELS = [
  { value: '', label: 'Any experience' },
  { value: 'Entry', label: 'Entry' },
  { value: 'Junior', label: 'Junior' },
  { value: 'MidLevel', label: 'Mid-level' },
  { value: 'Senior', label: 'Senior' },
  { value: 'Lead', label: 'Lead' },
  { value: 'Manager', label: 'Manager' },
  { value: 'Director', label: 'Director' },
];

const WORK_LOCATIONS = [
  { value: '', label: 'Any workplace' },
  { value: 'Remote', label: 'Remote' },
  { value: 'Hybrid', label: 'Hybrid' },
  { value: 'OnSite', label: 'On-site' },
];

@Component({
  selector: 'app-job-search',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, JobCardComponent],
  templateUrl: './job-search.html',
})
export class JobSearch implements OnInit {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private jobService = inject(JobService);
  private authService = inject(AuthService);
  private candidateService = inject(CandidateService);
  private toastService = inject(ToastService);

  readonly categoryOptions = JOB_CATEGORY_OPTIONS;
  readonly careerLevels = CAREER_LEVELS;
  readonly workLocations = WORK_LOCATIONS;

  readonly jobs = signal<JobModel[]>([]);
  readonly isLoading = signal(false);
  readonly hasSearched = signal(false);
  readonly totalCount = signal(0);
  readonly pageNumber = signal(1);
  readonly pageSize = signal(12);
  readonly totalPages = computed(() => {
    const total = this.totalCount();
    const size = this.pageSize();
    return Math.max(1, Math.ceil(total / size));
  });

  readonly canApply = computed(
    () => this.authService.isAuthenticated() && this.authService.getRole() === 'Candidate'
  );

  readonly searchForm = this.fb.nonNullable.group({
    keyword: [''],
    location: [''],
    jobType: [''],
    category: ['' as JobCategory | ''],
    careerLevel: [''],
    workLocation: [''],
    salaryMin: [''],
    salaryMax: [''],
  });

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      const q = params.get('q') ?? '';
      const location = params.get('location') ?? '';
      const page = Number(params.get('page') ?? 1);

      this.searchForm.patchValue(
        {
          keyword: q,
          location,
        },
        { emitEvent: false }
      );

      if (page > 0) {
        this.pageNumber.set(page);
      }

      this.loadJobs();
    });
  }

  search(): void {
    this.pageNumber.set(1);
    this.syncQueryParams();
    this.loadJobs();
  }

  clearFilters(): void {
    this.searchForm.reset({
      keyword: '',
      location: '',
      jobType: '',
      category: '',
      careerLevel: '',
      workLocation: '',
      salaryMin: '',
      salaryMax: '',
    });
    this.pageNumber.set(1);
    this.syncQueryParams();
    this.loadJobs();
  }

  pageNumbers(): number[] {
    return Array.from({ length: this.totalPages() }, (_, i) => i + 1);
  }

  onApply(job: JobModel): void {
    const id = job.id ?? job.jobPostId;
    if (id == null) return;
    this.router.navigate(['/jobs', id]);
  }

  onSave(job: JobModel): void {
    const id = job.id ?? job.jobPostId;
    if (id == null) return;
    
    // Optimistic UI update
    job.isSaved = !job.isSaved;
    
    this.candidateService.saveJob(id).subscribe({
      next: (res) => {
        if (res && res.fallback) {
           job.isSaved = res.isSaved;
        }
        this.toastService.success(job.isSaved ? 'Job saved!' : 'Job removed from saved list');
      },
      error: () => {
        job.isSaved = !job.isSaved; // Revert
        this.toastService.error('Failed to update job status.');
      }
    });
  }

  goToPage(page: number): void {
    const next = Math.min(Math.max(1, page), this.totalPages());
    if (next === this.pageNumber()) return;
    this.pageNumber.set(next);
    this.syncQueryParams();
    this.loadJobs();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private syncQueryParams(): void {
    const v = this.searchForm.getRawValue();
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        q: v.keyword?.trim() || null,
        location: v.location?.trim() || null,
        page: this.pageNumber() > 1 ? this.pageNumber() : null,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private loadJobs(): void {
    const formValue = this.searchForm.getRawValue();

    this.isLoading.set(true);
    this.hasSearched.set(true);

    const jobsReq = this.jobService.getPublicJobs({
        keyword: formValue.keyword?.trim() || undefined,
        location: formValue.location?.trim() || undefined,
        jobType: formValue.jobType || undefined,
        category: (formValue.category as JobCategory) || undefined,
        careerLevel: formValue.careerLevel || undefined,
        workLocation: formValue.workLocation || undefined,
        salaryMin: formValue.salaryMin ? Number(formValue.salaryMin) : undefined,
        salaryMax: formValue.salaryMax ? Number(formValue.salaryMax) : undefined,
        pageNumber: this.pageNumber(),
        pageSize: this.pageSize(),
      });

    const savedIdsReq = this.canApply() ? this.candidateService.getSavedJobIds() : of([]);
    const appsReq = this.canApply() ? this.candidateService.getApplications() : of([]);

    forkJoin({
      page: jobsReq,
      savedIds: savedIdsReq,
      apps: appsReq
    })
    .pipe(finalize(() => this.isLoading.set(false)))
    .subscribe(({ page, savedIds, apps }) => {
      const appliedJobIds = apps.map(a => a.jobPostingId);
      const mapped = page.items.map(jobListDtoToJobModel);
      mapped.forEach(job => {
        const jId = Number(job.id ?? job.jobPostId);
        if (savedIds.includes(jId)) {
          job.isSaved = true;
        }
        if (appliedJobIds.includes(jId)) {
          job.hasApplied = true;
          // Frontend fallback: if backend search endpoint fails to return applications, enforce at least 1
          job.applicantsCount = Math.max(job.applicantsCount || 0, 1);
        }
      });
      this.jobs.set(mapped);
      this.totalCount.set(page.totalCount);
    });
  }
}

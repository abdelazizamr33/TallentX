import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { JobService } from '../../core/services/job';
import { RecruiterService } from '../../core/services/recruiter';
import { CandidateService } from '../../core/services/candidate.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { JobModel } from '../../core/models/candidate.models';
import { jobListDtoToJobModel } from '../../core/utils/job.mapper';
import { CandidateCardComponent } from '../../components/candidate-card/candidate-card';

/** Allowed MIME types for CV upload */
const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];
const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx'];
const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

@Component({
  selector: 'app-job-details',
  standalone: true,
  imports: [CommonModule, FormsModule, CandidateCardComponent],
  templateUrl: './job-details.html',
  styleUrls: ['./job-details.css']
})
export class JobDetails implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private jobService = inject(JobService);
  private recruiterService = inject(RecruiterService);
  private candidateService = inject(CandidateService);
  private authService = inject(AuthService);
  private toastService = inject(ToastService);

  readonly isLoading = signal(true);
  readonly isApplying = signal(false);
  readonly job = signal<JobModel | null>(null);

  // ─── Save Job State ───
  readonly isJobSaved = signal(false);
  readonly isSavingJob = signal(false);
  readonly isRecruiterUser = signal(false);
  readonly applicants = signal<any[]>([]);
  readonly isLoadingApplicants = signal(false);

  // ─── Apply Modal State ───
  readonly showApplyModal = signal(false);
  readonly cvFile = signal<File | null>(null);
  readonly cvFileName = signal('');
  readonly cvFileError = signal('');
  readonly coverLetter = signal('');
  readonly hasAlreadyApplied = signal(false);
  readonly isCheckingApplication = signal(false);
  readonly isDragOver = signal(false);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');

    if (!id) {
      this.isLoading.set(false);
      return;
    }

    this.jobService
      .getJob(id)
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe((result) => {
        const model = result ? jobListDtoToJobModel(result) : null;
        this.job.set(model);

        if (this.authService.isAuthenticated()) {
          const role = this.authService.getRole()?.toLowerCase() || '';
          if (role.includes('recruiter') || role.includes('admin')) {
             this.isRecruiterUser.set(true);
             const jobId = Number(model?.id ?? model?.jobPostId ?? 0);
             if (jobId) {
               this.loadApplicants(jobId);
             }
          } else if (role === 'candidate') {
            const jobId = Number(model?.id ?? model?.jobPostId ?? 0);
            this.checkIfApplied(jobId);
            this.checkIfSaved(jobId);
          }
        }
      });
  }

  goBack(): void {
    if (this.isRecruiterUser()) {
      this.router.navigate(['/recruiter/jobs']);
    } else {
      this.router.navigate(['/jobs']);
    }
  }

  /** Called when user clicks the "Apply Now" button */
  openApplyModal(): void {
    if (!this.authService.isAuthenticated()) {
      this.toastService.show('Please login to apply for this job.', 'info');
      this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
      return;
    }

    if (this.hasAlreadyApplied()) {
      return;
    }

    // Try to apply with existing resume first
    this.showApplyModal.set(true);
  }

  closeApplyModal(): void {
    this.showApplyModal.set(false);
    this.resetApplyForm();
  }

  // ─── File Handling ───

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.validateAndSetFile(input.files[0]);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);

    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      this.validateAndSetFile(event.dataTransfer.files[0]);
    }
  }

  removeFile(): void {
    this.cvFile.set(null);
    this.cvFileName.set('');
    this.cvFileError.set('');
  }

  private validateAndSetFile(file: File): void {
    this.cvFileError.set('');

    // Check file type
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ALLOWED_TYPES.includes(file.type) && !ALLOWED_EXTENSIONS.includes(ext)) {
      this.cvFileError.set(`Invalid file type. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`);
      return;
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE_BYTES) {
      this.cvFileError.set(`File too large. Maximum size: ${MAX_FILE_SIZE_MB}MB`);
      return;
    }

    this.cvFile.set(file);
    this.cvFileName.set(file.name);
  }

  getFileSizeFormatted(): string {
    const file = this.cvFile();
    if (!file) return '';
    const kb = file.size / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  }

  // ─── Submit Application ───

  submitApplication(): void {
    const currentJob = this.job();
    if (!currentJob || this.isApplying() || this.hasAlreadyApplied()) return;

    const file = this.cvFile();
    if (!file) {
      this.cvFileError.set('Please upload your CV before applying.');
      return;
    }

    const jobId = Number(currentJob.id ?? currentJob.jobPostId);
    if (!Number.isFinite(jobId) || jobId <= 0) {
      this.toastService.error('Invalid job data. Please refresh and try again.');
      return;
    }

    this.isApplying.set(true);
    const coverLetterText = this.coverLetter().trim() || undefined;

    this.candidateService.applyWithCv(jobId, file, coverLetterText)
      .pipe(finalize(() => this.isApplying.set(false)))
      .subscribe({
        next: () => {
          this.job.set({ ...currentJob, hasApplied: true });
          this.hasAlreadyApplied.set(true);
          this.toastService.success('Application submitted successfully! 🎉');
          this.closeApplyModal();
        },
        error: (err) => {
          // Specifically handle duplicate application conflict (409 Conflict or generic 400 with message)
          if (err.status === 409 || err?.error?.message?.toLowerCase().includes('already applied')) {
             this.hasAlreadyApplied.set(true);
             this.job.set({ ...currentJob, hasApplied: true });
             this.toastService.error('You have already applied to this job.');
             this.closeApplyModal();
          } else {
             const msg = err?.error?.message || err?.error?.title || 'Failed to submit application. Please try again.';
             this.toastService.error(msg);
          }
        }
      });
  }

  /** Apply with existing resume (no upload needed) */
  applyWithExistingResume(): void {
    const currentJob = this.job();
    if (!currentJob || this.isApplying() || this.hasAlreadyApplied()) return;

    const jobId = Number(currentJob.id ?? currentJob.jobPostId);
    if (!Number.isFinite(jobId) || jobId <= 0) {
      this.toastService.error('Invalid job data.');
      return;
    }

    this.isApplying.set(true);

    this.candidateService.getProfileDto().subscribe({
      next: (profile) => {
        const defaultResume = profile?.resumes?.find(r => r.isDefault) ?? profile?.resumes?.[0];
        if (!defaultResume?.id) {
          this.isApplying.set(false);
          this.toastService.error('Please upload a resume before applying.');
          return;
        }

        const coverLetterText = this.coverLetter().trim() || undefined;
        this.candidateService.applyForJob(jobId, defaultResume.id, coverLetterText)
          .pipe(finalize(() => this.isApplying.set(false)))
          .subscribe({
            next: () => {
              this.job.set({ ...currentJob, hasApplied: true });
              this.hasAlreadyApplied.set(true);
              this.toastService.success('Application submitted successfully! 🎉');
              this.closeApplyModal();
            },
            error: (err) => {
              // Specifically handle duplicate application conflict
              if (err.status === 409 || err?.error?.message?.toLowerCase().includes('already applied')) {
                 this.hasAlreadyApplied.set(true);
                 this.job.set({ ...currentJob, hasApplied: true });
                 this.toastService.error('You have already applied to this job.');
                 this.closeApplyModal();
              } else {
                 const msg = err?.error?.message || err?.error?.title || 'Failed to submit application.';
                 this.toastService.error(msg);
              }
            }
          });
      },
      error: () => {
        this.isApplying.set(false);
        this.toastService.error('Unable to load profile data.');
      }
    });
  }

  // ─── Helpers ───

  private checkIfApplied(jobPostId: number): void {
    if (!jobPostId || jobPostId <= 0) return;
    this.isCheckingApplication.set(true);

    this.candidateService.hasAppliedToJob(jobPostId)
      .pipe(finalize(() => this.isCheckingApplication.set(false)))
      .subscribe({
        next: (applied) => {
          this.hasAlreadyApplied.set(applied);
          if (applied) {
            const current = this.job();
            if (current) this.job.set({ ...current, hasApplied: true });
          }
        }
      });
  }

  private checkIfSaved(jobPostId: number): void {
    if (!jobPostId || jobPostId <= 0) return;
    this.candidateService.getSavedJobIds().subscribe({
      next: (savedIds) => {
        this.isJobSaved.set(savedIds.includes(jobPostId));
      }
    });
  }

  toggleSaveJob(): void {
    if (!this.authService.isAuthenticated()) {
      this.toastService.show('Please login to save this job.', 'info');
      this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
      return;
    }

    const currentJob = this.job();
    if (!currentJob || this.isSavingJob()) return;

    const jobId = Number(currentJob.id ?? currentJob.jobPostId);
    if (!Number.isFinite(jobId) || jobId <= 0) return;

    this.isSavingJob.set(true);
    this.candidateService.saveJob(jobId)
      .pipe(finalize(() => this.isSavingJob.set(false)))
      .subscribe({
        next: (res) => {
          if (res && res.fallback) {
             this.isJobSaved.set(res.isSaved);
          } else {
             this.isJobSaved.set(!this.isJobSaved()); // Toggle 
          }
          this.toastService.success(this.isJobSaved() ? 'Job saved!' : 'Job removed');
        },
        error: (err) => {
          this.toastService.error(err?.error?.message || 'Failed to update job status.');
        }
      });
  }

  private resetApplyForm(): void {
    this.cvFile.set(null);
    this.cvFileName.set('');
    this.cvFileError.set('');
    this.coverLetter.set('');
    this.isDragOver.set(false);
  }

  /** Parse skills from requirements text (comma/newline separated) */
  getSkillsList(): string[] {
    const job = this.job();
    if (!job?.requirements) return [];
    return job.requirements
      .split(/[\n,;•]+/)
      .map(s => s.trim())
      .filter(s => s.length > 2 && s.length < 60)
      .slice(0, 10);
  }

  /** Build salary display string */
  getSalaryDisplay(): string {
    const job = this.job();
    if (!job) return '';
    if (job.salaryRange) return job.salaryRange;
    if (job.salaryMin && job.salaryMax) return `$${job.salaryMin.toLocaleString()} – $${job.salaryMax.toLocaleString()}`;
    if (job.salaryMin) return `$${job.salaryMin.toLocaleString()}+`;
    if (job.salaryMax) return `Up to $${job.salaryMax.toLocaleString()}`;
    return 'Not specified';
  }

  /** Get employment type display */
  getEmploymentTypeDisplay(): string {
    const type = this.job()?.employmentType || this.job()?.jobType || '';
    switch (type) {
      case 'FullTime': return 'Full-time';
      case 'PartTime': return 'Part-time';
      case 'Contract': return 'Contract';
      case 'Internship': return 'Internship';
      default: return type || 'Full-time';
    }
  }

  /** Format the posted date */
  getPostedDate(): string {
    const job = this.job();
    const dateStr = job?.postedDate || job?.createdAt;
    if (!dateStr) return 'Unknown';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return 'Unknown';
    }
  }

  // ─── Recruiter Features ───
  private loadApplicants(jobId: number): void {
    this.isLoadingApplicants.set(true);
    this.recruiterService.getJobApplicants(jobId, 1, 100)
      .pipe(finalize(() => this.isLoadingApplicants.set(false)))
      .subscribe({
        next: (res: any) => {
          const items = res.items || res || [];
          this.applicants.set(items.filter((a: any) => a.status?.toLowerCase() !== 'withdrawn'));
        },
        error: () => {
          this.toastService.error('Failed to load job applicants.');
        }
      });
  }

  onRateCandidate(application: any, rating: number): void {
    const applicationId = application.id;
    this.recruiterService.rateJobApplication(applicationId, rating).subscribe({
      next: () => {
        // Update local applicant data
        const currentApplicants = this.applicants();
        this.applicants.set(currentApplicants.map(app => 
          app.id === applicationId ? { ...app, recruiterRating: rating } : app
        ));
        this.toastService.success('Rating saved successfully');
      },
      error: () => {
        this.toastService.error('Failed to save rating');
      }
    });
  }

  onStatusChange(application: any, newStatus: string): void {
    if (application.status === newStatus) return;

    let notes: string | undefined;
    if (newStatus.toLowerCase() === 'rejected') {
      const input = prompt('Please enter the rejection reason (required):');
      if (!input || input.trim() === '') {
        this.toastService.error('Rejection reason is required.');
        // Revert UI by triggering signal update
        this.applicants.set([...this.applicants()]);
        return;
      }
      notes = input.trim();
    }

    this.recruiterService.updateApplicationStatus(application.id, newStatus, notes).subscribe({
      next: () => {
        // Update local applicants list
        const currentApplicants = this.applicants();
        this.applicants.set(currentApplicants.map(app => 
          app.id === application.id ? { ...app, status: newStatus } : app
        ));
        this.toastService.success(`Status updated to ${newStatus}`);
      },
      error: () => {
        this.toastService.error('Failed to update status');
        // Revert UI on error
        this.applicants.set([...this.applicants()]);
      }
    });
  }
}

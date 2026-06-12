import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { JobService } from '../../core/services/job';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { CreateJobPostingDto } from '../../core/models/job.models';

@Component({
  selector: 'app-edit-job-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './edit-job.html'
})
export class EditJobPage implements OnInit {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private jobService = inject(JobService);
  private authService = inject(AuthService);
  private toast = inject(ToastService);

  isLoading = signal(true);
  isSaving = signal(false);
  jobId = signal<number | null>(null);
  isActive = signal<boolean>(true);

  form = this.fb.group({
    title: ['', [Validators.required, Validators.minLength(3)]],
    description: [''],
    requirementsText: [''],
    location: [''],
    employmentType: ['FullTime', [Validators.required]],
    department: [''],
    gpa: [null as number | null],
    gpaPriority: ['Low'],
    experienceMinYears: [null as number | null],
    experienceMaxYears: [null as number | null],
    experiencePriority: ['Low'],
    salaryMin: [null as number | null],
    salaryMax: [null as number | null],
    currency: ['USD'],
    applicationDeadline: [''],
    requiredSkills: ['']
  });

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!Number.isFinite(id) || id <= 0) {
      this.toast.error('Invalid job id.');
      this.router.navigate(['/recruiter/jobs']);
      return;
    }

    this.jobId.set(id);
    this.jobService.getJob(id).subscribe({
      next: (job) => {
        if (!job) {
          this.toast.error('Job not found.');
          this.router.navigate(['/recruiter/jobs']);
          return;
        }

        let salaryMin = job.salaryMin ?? null;
        let salaryMax = job.salaryMax ?? null;
        let currency = job.currency ?? 'USD';

        const salaryRangeStr = (job as any).salaryRange;
        if (salaryRangeStr) {
          const curMatch = salaryRangeStr.match(/([A-Z]{3})/);
          if (curMatch) currency = curMatch[1];
          
          const numbers = salaryRangeStr.replace(/,/g, '').match(/\d+(\.\d+)?/g);
          if (numbers) {
            if (salaryRangeStr.includes('-') && numbers.length >= 2) {
              salaryMin = parseFloat(numbers[0]);
              salaryMax = parseFloat(numbers[1]);
            } else if (salaryRangeStr.includes('Up to') && numbers.length >= 1) {
              salaryMax = parseFloat(numbers[0]);
            } else if (salaryRangeStr.includes('+') && numbers.length >= 1) {
              salaryMin = parseFloat(numbers[0]);
            } else if (numbers.length >= 2) {
              salaryMin = parseFloat(numbers[0]);
              salaryMax = parseFloat(numbers[1]);
            }
          }
        }

        const skillsArr = job.skills?.length ? job.skills : job.requiredSkills;
        let requiredSkillsStr = '';
        if (skillsArr && Array.isArray(skillsArr) && skillsArr.length > 0) {
          if (typeof skillsArr[0] === 'string') {
            requiredSkillsStr = skillsArr.join(', ');
          } else if (skillsArr[0].skillName) {
            requiredSkillsStr = skillsArr.map((s: any) => s.skillName).join(', ');
          } else if (skillsArr[0].name) {
            requiredSkillsStr = skillsArr.map((s: any) => s.name).join(', ');
          }
        }

        let deadlineStr = '';
        if (job.applicationDeadline) {
          deadlineStr = job.applicationDeadline.includes('T') 
            ? job.applicationDeadline.slice(0, 16) 
            : new Date(job.applicationDeadline).toISOString().slice(0, 16);
        }

        this.isActive.set(job.isActive ?? true);

        this.form.patchValue({
          title: job.title ?? '',
          description: job.description ?? '',
          requirementsText: job.requirements ?? '',
          location: job.location ?? '',
          employmentType: job.employmentType || job.jobType || 'FullTime',
          department: job.department ?? '',
          gpa: job.gpa ?? null,
          gpaPriority: job.gpaPriority ?? 'Low',
          experienceMinYears: job.experienceMinYears ?? null,
          experienceMaxYears: job.experienceMaxYears ?? null,
          experiencePriority: job.experiencePriority ?? 'Low',
          salaryMin: salaryMin,
          salaryMax: salaryMax,
          currency: currency,
          applicationDeadline: deadlineStr,
          requiredSkills: requiredSkillsStr
        });

        this.isLoading.set(false);
      },
      error: () => {
        this.toast.error('Failed to load job.');
        this.router.navigate(['/recruiter/jobs']);
      }
    });
  }

  save(): void {
    if (this.form.invalid || !this.jobId()) {
      console.warn('[EditJobPage] Form is invalid! Cannot save.', this.form.value, this.form.errors);
      this.form.markAllAsTouched();
      this.toast.error('Please correct the validation errors before saving.');
      return;
    }

    const value = this.form.getRawValue();
    const requirements = (value.requirementsText ?? '').trim();

    const salaryRange = this.buildSalaryRange(
      value.salaryMin,
      value.salaryMax,
      value.currency
    );

    const requiredSkillsArr = (value.requiredSkills ?? '')
      .split(',')
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0);

    const skills = requiredSkillsArr.map(s => ({ skillName: s, skillPriority: 'Medium' }));

    // Format application deadline to match ASP.NET expectations (append seconds)
    let safeDeadline = value.applicationDeadline || undefined;
    if (safeDeadline && safeDeadline.includes('T') && !safeDeadline.includes(':00', safeDeadline.length - 3)) {
      safeDeadline = safeDeadline + ':00';
    }

    const payload: Partial<CreateJobPostingDto> = {
      title: value.title ?? '',
      description: value.description ?? '',
      requirements,
      location: value.location || undefined,
      employmentType: value.employmentType ?? 'FullTime',
      department: value.department || undefined,
      gpa: value.gpa ? Number(value.gpa) : undefined,
      gpaPriority: value.gpaPriority as any || undefined,
      experienceMinYears: value.experienceMinYears ? Number(value.experienceMinYears) : undefined,
      experienceMaxYears: value.experienceMaxYears ? Number(value.experienceMaxYears) : undefined,
      experiencePriority: value.experiencePriority as any || undefined,
      isActive: this.isActive(),
      salaryRange: salaryRange || undefined,
      applicationDeadline: safeDeadline,
      skills: skills.length > 0 ? skills : undefined
    };

    console.log('[EditJob] Payload:', payload);

    this.isSaving.set(true);
    this.jobService.updateJob(this.jobId()!, payload).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.toast.success('Job updated successfully.');
        this.router.navigate(['/recruiter/jobs']);
      },
      error: (err) => {
        this.isSaving.set(false);
        const serverMsg = err?.error?.title || err?.error?.message || 'Failed to update job.';
        this.toast.error(serverMsg);
        console.error('[EditJobPage] Update failed:', err);
      }
    });
  }

  private buildSalaryRange(
    min: number | null,
    max: number | null,
    currency: string | null
  ): string {
    const cur = currency || 'USD';
    if (min && max) {
      return `${cur} ${min.toLocaleString()} - ${max.toLocaleString()}`;
    }
    if (min) {
      return `${cur} ${min.toLocaleString()}+`;
    }
    if (max) {
      return `Up to ${cur} ${max.toLocaleString()}`;
    }
    return '';
  }
}


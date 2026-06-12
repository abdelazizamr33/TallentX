import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { AssessmentService } from '../../core/services/assessment.service';
import { AssessmentDetailDto } from '../../core/models/assessment.models';
import { RecruiterService, RecruiterJob } from '../../core/services/recruiter';
import { ToastService } from '../../core/services/toast.service';
import { finalize } from 'rxjs/operators';

@Component({
  selector: 'app-assessment-details',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './assessment-details.html',
})
export class AssessmentDetailsPage implements OnInit {
  private route = inject(ActivatedRoute);
  private assessmentService = inject(AssessmentService);
  private recruiterService = inject(RecruiterService);
  private toast = inject(ToastService);

  readonly assessment = signal<AssessmentDetailDto | null>(null);
  readonly jobs = signal<RecruiterJob[]>([]);
  readonly isLoading = signal(true);

  ngOnInit() {
    this.recruiterService.getJobPostings().subscribe({
      next: (jobs) => this.jobs.set(jobs),
      error: () => this.toast.error('Failed to load job postings.')
    });

    this.route.paramMap.subscribe(params => {
      const idStr = params.get('id');
      if (idStr) {
        this.loadAssessment(Number(idStr));
      }
    });
  }

  getJobTitle(jobId: number | undefined): string {
    if (!jobId) return 'Unknown Job';
    const job = this.jobs().find(j => Number(j.id) === jobId);
    return job ? job.title : `Job #${jobId}`;
  }

  loadAssessment(id: number) {
    this.isLoading.set(true);
    this.assessmentService.getById(id)
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (data) => {
          // Parse options if they are string
          const parsedData = {
            ...data,
            questions: (data.questions ?? []).map((q: any) => {
              let parsedOptions: string[] = [];
              if (typeof q.options === 'string') {
                try {
                  parsedOptions = JSON.parse(q.options);
                } catch {
                  parsedOptions = [];
                }
              } else if (Array.isArray(q.options)) {
                parsedOptions = q.options;
              }
              return {
                ...q,
                options: parsedOptions,
                correctOptionIndex: Number(q.correctOptionIndex ?? q.correctAnswer ?? 0)
              };
            })
          };
          this.assessment.set(parsedData);
        },
        error: (err) => {
          this.toast.error('Failed to load assessment details.');
        }
      });
  }
}

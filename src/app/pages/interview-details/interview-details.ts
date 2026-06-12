import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RecruiterService } from '../../core/services/recruiter';
import { ToastService } from '../../core/services/toast.service';
import { StarRatingComponent } from '../../components/star-rating/star-rating';
import { finalize } from 'rxjs/operators';

@Component({
  selector: 'app-interview-details',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, StarRatingComponent],
  templateUrl: './interview-details.html',
})
export class InterviewDetailsPage implements OnInit {
  private route = inject(ActivatedRoute);
  private recruiterService = inject(RecruiterService);
  private toast = inject(ToastService);
  private fb = inject(FormBuilder);

  readonly interview = signal<any | null>(null);
  readonly isLoading = signal(true);
  readonly isSubmitting = signal(false);

  readonly evaluationForm = this.fb.group({
    rating: [0, [Validators.required, Validators.min(1), Validators.max(5)]],
    feedbackComments: ['', [Validators.required, Validators.minLength(10)]]
  });

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      const idStr = params.get('id');
      if (idStr) {
        this.loadInterview(Number(idStr));
      }
    });
  }

  loadInterview(id: number) {
    this.isLoading.set(true);
    this.recruiterService.getInterviewDetailsForRecruiter(id)
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (data) => {
          this.interview.set(data);
          if (data.rating) {
            this.evaluationForm.patchValue({
              rating: data.rating,
              feedbackComments: data.notes || ''
            });
            this.evaluationForm.disable();
          }
        },
        error: () => {
          this.toast.error('Failed to load interview details.');
        }
      });
  }

  submitEvaluation() {
    if (this.evaluationForm.invalid) {
      this.evaluationForm.markAllAsTouched();
      return;
    }

    const val = this.evaluationForm.value;
    const interviewId = this.interview()?.interviewId;
    
    if (!interviewId) return;

    this.isSubmitting.set(true);
    this.recruiterService.evaluateInterview(interviewId, val.rating!, val.feedbackComments!)
      .pipe(finalize(() => this.isSubmitting.set(false)))
      .subscribe({
        next: () => {
          this.toast.success('Evaluation submitted successfully.');
          this.evaluationForm.disable();
          
          this.interview.update(curr => ({
            ...curr,
            rating: val.rating,
            notes: val.feedbackComments
          }));
        },
        error: () => {
          this.toast.error('Failed to submit evaluation.');
        }
      });
  }
}

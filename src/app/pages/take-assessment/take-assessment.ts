import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { AssessmentService } from '../../core/services/assessment.service';
import { ToastService } from '../../core/services/toast.service';
import { CandidateAssessmentDto } from '../../core/models/assessment.models';

@Component({
  selector: 'app-take-assessment-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './take-assessment.html',
})
export class TakeAssessmentPage implements OnInit {
  private assessmentService = inject(AssessmentService);
  private toast = inject(ToastService);

  readonly assessments = signal<CandidateAssessmentDto[]>([]);
  readonly isLoading = signal<boolean>(true);

  readonly pendingAssessments = computed(() => 
    this.assessments().filter(a => !a.isCompleted)
  );

  readonly completedAssessments = computed(() => 
    this.assessments().filter(a => a.isCompleted).sort((a, b) => 
      new Date(b.submittedAt || '').getTime() - new Date(a.submittedAt || '').getTime()
    )
  );

  ngOnInit() {
    this.loadAssessments();
  }

  loadAssessments() {
    this.isLoading.set(true);
    this.assessmentService.getMyAssessments()
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (items) => this.assessments.set(items || []),
        error: () => this.toast.error('Failed to load assessments.')
      });
  }
}

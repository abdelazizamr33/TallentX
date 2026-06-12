import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { AssessmentService } from '../../core/services/assessment.service';
import { AssessmentCandidateDetailDto } from '../../core/models/assessment.models';
import { ToastService } from '../../core/services/toast.service';
import { finalize } from 'rxjs/operators';

@Component({
  selector: 'app-candidate-assessment-result',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './candidate-assessment-result.html',
})
export class CandidateAssessmentResultPage implements OnInit {
  private route = inject(ActivatedRoute);
  private assessmentService = inject(AssessmentService);
  private toast = inject(ToastService);

  readonly result = signal<AssessmentCandidateDetailDto | null>(null);
  readonly isLoading = signal(true);

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      const assessmentIdStr = params.get('assessmentId');
      const candidateIdStr = params.get('candidateId');
      
      if (assessmentIdStr && candidateIdStr) {
        this.loadResult(Number(assessmentIdStr), candidateIdStr);
      }
    });
  }

  loadResult(assessmentId: number, candidateId: string) {
    this.isLoading.set(true);
    this.assessmentService.getCandidateAssessmentDetails(assessmentId, candidateId)
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (data) => {
          this.result.set(data);
        },
        error: (err) => {
          this.toast.error('Failed to load candidate assessment result.');
        }
      });
  }
}

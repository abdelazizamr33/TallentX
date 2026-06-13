import { Component, OnInit, signal, computed, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { AssessmentService } from '../../core/services/assessment.service';
import { ToastService } from '../../core/services/toast.service';
import { CandidateAssessmentDto, QuestionDto } from '../../core/models/assessment.models';

@Component({
  selector: 'app-assessment-quiz',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './assessment-quiz.html',
})
export class AssessmentQuizPage implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private assessmentService = inject(AssessmentService);
  private toast = inject(ToastService);

  readonly isLoading = signal(true);
  readonly isSubmitting = signal(false);
  readonly candidateAssessment = signal<CandidateAssessmentDto | null>(null);
  
  readonly currentQuestionIndex = signal(0);
  readonly answers = signal<{ [questionId: number]: number | string }>({});

  readonly timeRemainingSeconds = signal(0);
  private timerInterval: any;

  readonly currentQuestion = computed(() => {
    const ca = this.candidateAssessment();
    if (!ca || !ca.assessment?.questions) return null;
    return ca.assessment.questions[this.currentQuestionIndex()];
  });

  readonly isLastQuestion = computed(() => {
    const ca = this.candidateAssessment();
    if (!ca || !ca.assessment?.questions) return true;
    return this.currentQuestionIndex() === ca.assessment.questions.length - 1;
  });

  readonly isFirstQuestion = computed(() => {
    return this.currentQuestionIndex() === 0;
  });

  readonly formattedTime = computed(() => {
    const totalSeconds = this.timeRemainingSeconds();
    if (totalSeconds <= 0) return '00:00';
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  });

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      const id = params.get('id'); // CandidateAssessment ID
      const jobAppId = this.route.snapshot.queryParamMap.get('jobApplicationId');
      
      if (id) {
        this.startOrLoadAssessment(Number(id), Number(jobAppId || 0));
      }
    });
  }

  ngOnDestroy() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
  }

  startOrLoadAssessment(candidateAssessmentId: number, jobApplicationId: number) {
    this.isLoading.set(true);
    // Call Start API. If already started, it should return the active assessment.
    this.assessmentService.start(candidateAssessmentId, jobApplicationId)
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (ca) => {
          this.candidateAssessment.set(ca);
          
          if (ca.isCompleted) {
            this.toast.show('This assessment has already been completed.', 'info');
            this.router.navigate(['/candidate/assessments']);
            return;
          }

          this.initializeTimer();
        },
        error: (err) => {
          this.toast.error(err.error?.message || 'Failed to start assessment.');
          this.router.navigate(['/candidate/assessments']);
        }
      });
  }

  initializeTimer() {
    const ca = this.candidateAssessment();
    if (!ca || !ca.startedAt || !ca.assessment?.timeLimitMinutes) return;

    const startedDate = new Date(ca.startedAt);
    const timeLimitMs = ca.assessment.timeLimitMinutes * 60000;
    const deadline = startedDate.getTime() + timeLimitMs;

    this.updateTimer(deadline);
    this.timerInterval = setInterval(() => this.updateTimer(deadline), 1000);
  }

  updateTimer(deadline: number) {
    const now = Date.now();
    const remainingMs = deadline - now;
    
    if (remainingMs <= 0) {
      this.timeRemainingSeconds.set(0);
      clearInterval(this.timerInterval);
      this.toast.show('Time is up! Submitting your assessment...', 'info');
      this.submitAssessment();
    } else {
      this.timeRemainingSeconds.set(Math.floor(remainingMs / 1000));
    }
  }

  parseOptions(optionsData: any): string[] {
    if (!optionsData) return [];
    if (Array.isArray(optionsData)) return optionsData;
    if (typeof optionsData === 'string') {
      try {
        return JSON.parse(optionsData);
      } catch {
        return optionsData.split(',').map(s => s.trim());
      }
    }
    return [];
  }

  selectOption(questionId: number, index: number) {
    this.answers.update(ans => ({ ...ans, [questionId]: index }));
  }

  nextQuestion() {
    if (!this.isLastQuestion()) {
      this.currentQuestionIndex.update(idx => idx + 1);
    }
  }

  prevQuestion() {
    if (!this.isFirstQuestion()) {
      this.currentQuestionIndex.update(idx => idx - 1);
    }
  }

  submitAssessment() {
    const ca = this.candidateAssessment();
    if (!ca) return;

    // Convert answers dictionary to JSON string
    const answersPayload = {
      assessmentId: ca.assessmentId,
      answers: JSON.stringify(this.answers())
    };

    this.isSubmitting.set(true);
    this.assessmentService.submit(ca.assessmentId, answersPayload)
      .pipe(finalize(() => this.isSubmitting.set(false)))
      .subscribe({
        next: (result) => {
          this.toast.show(`Assessment submitted successfully!`, 'success');
          this.router.navigate(['/candidate/assessments']);
        },
        error: (err) => this.toast.error(err.error?.message || 'Failed to submit assessment.')
      });
  }
}

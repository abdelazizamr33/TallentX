import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { CandidateService } from '../../core/services/candidate.service';
import { JobApplicationDto } from '../../core/models/job.models';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-application-tracking',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './application-tracking.html'
})
export class ApplicationTrackingPage implements OnInit {
  private route = inject(ActivatedRoute);
  private candidateService = inject(CandidateService);
  private toast = inject(ToastService);

  readonly isLoading = signal(true);
  readonly application = signal<JobApplicationDto | null>(null);

  // Mapping string status to step index (1 to 4)
  readonly currentStepIndex = computed(() => {
    const app = this.application();
    if (!app) return 0;
    
    const status = app.status.toLowerCase();
    
    // Status mappings based on lifecycle
    if (['pending', 'underreview'].includes(status)) return 1;
    if (status === 'assessment') return 2;
    if (status === 'interview') return 3;
    if (['accepted', 'rejected'].includes(status)) return 4;
    
    // Withdrawn case
    if (status === 'withdrawn') return 0; // Special visual state
    
    return 1; // Default
  });

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.loadApplication(Number(id));
      }
    });
  }

  loadApplication(id: number) {
    this.isLoading.set(true);
    this.candidateService.getApplicationById(id)
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (app) => this.application.set(app),
        error: () => this.toast.error('Failed to load application details')
      });
  }

  withdraw() {
    const app = this.application();
    if (!app || app.status.toLowerCase() === 'withdrawn') return;

    if (confirm('Are you sure you want to withdraw your application?')) {
      this.candidateService.withdrawApplication(app.id).subscribe({
        next: () => {
          this.application.update(current => current ? { ...current, status: 'Withdrawn' } : null);
          this.toast.success('Application withdrawn successfully');
        },
        error: () => this.toast.error('Failed to withdraw application')
      });
    }
  }
}

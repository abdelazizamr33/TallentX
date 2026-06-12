import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { RecruiterService } from '../../core/services/recruiter';
import { ToastService } from '../../core/services/toast.service';
import { finalize } from 'rxjs/operators';

@Component({
  selector: 'app-candidate-profile',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './candidate-profile.html',
})
export class CandidateProfilePage implements OnInit {
  private route = inject(ActivatedRoute);
  private recruiterService = inject(RecruiterService);
  private toast = inject(ToastService);

  readonly profile = signal<any | null>(null);
  readonly isLoading = signal(true);

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      const idStr = params.get('id');
      if (idStr) {
        this.loadProfile(idStr);
      }
    });
  }

  loadProfile(candidateId: string) {
    this.isLoading.set(true);
    this.recruiterService.getCandidateProfileForRecruiter(candidateId)
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (data) => {
          this.profile.set(data);
        },
        error: () => {
          this.toast.error('Failed to load candidate profile.');
        }
      });
  }

  viewResume(url: string | null | undefined) {
    if (url) {
      window.open(url, '_blank');
    } else {
      this.toast.error('No resume available for this candidate.');
    }
  }
}

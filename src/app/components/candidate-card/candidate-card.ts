import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApplicationStatuses } from '../../core/models/job.models';

@Component({
  selector: 'app-candidate-card',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './candidate-card.html',
})
export class CandidateCardComponent {
  @Input() candidateId!: string;
  @Input() name!: string;
  @Input() email?: string;
  @Input() imageUrl?: string;
  @Input() dateLabel = 'Date';
  @Input() dateValue?: string;
  @Input() score?: number | null;
  @Input() maxScore?: number;
  @Input() status?: string;
  @Input() fitStatus?: string;
  @Input() recruiterRating?: number | null;
  
  @Input() canChangeStatus = false;
  
  @Output() cardClick = new EventEmitter<void>();
  @Output() rate = new EventEmitter<number>();
  @Output() statusChange = new EventEmitter<string>();

  readonly applicationStatuses = ApplicationStatuses;

  onClick() {
    this.cardClick.emit();
  }

  onRateChange(event: Event) {
    event.stopPropagation();
    const input = event.target as HTMLInputElement;
    const val = Number(input.value);
    if (val >= 1 && val <= 10) {
      this.rate.emit(val);
    }
  }

  onStatusSelect(status: string) {
    this.statusChange.emit(status);
  }

  getStatusColorClass(status: string): string {
    if (!status) return '';
    const s = status.toLowerCase();
    switch (s) {
      case 'accepted':
      case 'completed':
      case 'offered':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'interview':
      case 'interviewing':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'assessment':
        return 'bg-violet-100 text-violet-800 border-violet-300';
      case 'underreview':
      case 'in progress':
        return 'bg-sky-100 text-sky-800 border-sky-300';
      case 'pending':
      case 'new':
      case 'submitted':
        return 'bg-slate-100 text-slate-800 border-slate-300';
      case 'rejected':
      case 'failed':
        return 'bg-rose-100 text-rose-800 border-rose-300';
      case 'withdrawn':
        return 'bg-neutral-100 text-neutral-800 border-neutral-300';
      default:
        return 'bg-surface-container text-on-surface-variant border-outline-variant/30';
    }
  }
}

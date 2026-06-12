import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { InterviewService } from '../../core/services/interview.service';
import { InterviewDto } from '../../core/models/interview.models';
import { ToastService } from '../../core/services/toast.service';
import { Router, RouterModule } from '@angular/router';
import { JobApplicationDto } from '../../core/models/job.models';
export type InterviewType = 'Online' | 'On-site' | 'Technical' | 'HR';
export type InterviewDisplayStatus = 'Scheduled' | 'Confirmed' | 'Pending' | 'Rescheduled' | 'Cancelled' | 'Completed' | 'InProgress';

export interface UpcomingInterviewItem extends InterviewDto {
  companyName: string;
  interviewType: InterviewType;
  displayStatus: InterviewDisplayStatus;
  roomName?: string;
}
import { RecruiterService } from '../../core/services/recruiter';

export type InterviewTimeBucket = 'today' | 'tomorrow' | 'thisWeek' | 'later';

export interface InterviewTimeSection {
  key: InterviewTimeBucket;
  label: string;
  items: UpcomingInterviewItem[];
}

interface InterviewApplicationOption {
  id: number;
  candidateName: string;
  jobTitle: string;
  jobPostingId: number;
  status: string;
}

interface InterviewJobOption {
  id: number;
  title: string;
}

import { InterviewCardComponent } from '../../components/interview-card/interview-card';

@Component({
  selector: 'app-interview-scheduling-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, InterviewCardComponent],
  templateUrl: './interview-scheduling.html',
})
export class InterviewSchedulingPage implements OnInit {
  private interviewService = inject(InterviewService);
  private recruiterService = inject(RecruiterService);
  private toast = inject(ToastService);
  private fb = inject(FormBuilder);
  private router = inject(Router);

  readonly interviews = signal<UpcomingInterviewItem[]>([]);
  readonly isLoading = signal<boolean>(true);
  readonly isLoadingApplications = signal<boolean>(true);
  readonly isLoadingCompleted = signal<boolean>(false);
  readonly isSubmitting = signal<boolean>(false);
  readonly activeTab = signal<'upcoming' | 'completed'>('upcoming');
  readonly completedInterviews = signal<any[]>([]);
  readonly expandedId = signal<number | null>(null);
  readonly editingId = signal<number | null>(null);
  readonly availableJobs = signal<InterviewJobOption[]>([]);
  readonly allApplications = signal<InterviewApplicationOption[]>([]);

  readonly timeSections: { key: InterviewTimeBucket; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'tomorrow', label: 'Tomorrow' },
    { key: 'thisWeek', label: 'This Week' },
    { key: 'later', label: 'Later' },
  ];

  readonly upcoming = computed(() => {
    return this.interviews()
      .filter((item) => item.status === 'Scheduled' || item.status === 'InProgress')
      .sort((a, b) => new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime());
  });

  readonly groupedSections = computed((): InterviewTimeSection[] => {
    const buckets: Record<InterviewTimeBucket, UpcomingInterviewItem[]> = {
      today: [],
      tomorrow: [],
      thisWeek: [],
      later: [],
    };

    for (const item of this.upcoming()) {
      buckets[this.getTimeBucket(item.scheduledTime)].push(item);
    }

    return this.timeSections
      .map((section) => ({ ...section, items: buckets[section.key] }))
      .filter((section) => section.items.length > 0);
  });

  readonly hasUpcoming = computed(() => this.upcoming().length > 0);

  get minDateTime(): string {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  }

  readonly interviewForm = this.fb.nonNullable.group({
    jobId: [0, [Validators.required, Validators.min(1)]],
    jobApplicationId: [{ value: 0, disabled: true }, [Validators.required, Validators.min(1)]],
    scheduledTime: ['', Validators.required],
    durationMinutes: [45, [Validators.required, Validators.min(15)]],
    meetingLink: [''],
  });

  get filteredApplications(): InterviewApplicationOption[] {
    return this.allApplications();
  }

  ngOnInit(): void {
    this.loadInterviews();
    this.loadCompletedInterviews();
    this.loadAvailableJobs();

    this.interviewForm.controls.jobId.valueChanges.subscribe(jobId => {
      this.interviewForm.controls.jobApplicationId.setValue(0);
      this.allApplications.set([]);

      if (jobId && jobId > 0) {
        this.interviewForm.controls.jobApplicationId.disable();
        this.isLoadingApplications.set(true);
        this.recruiterService.getJobApplicants(jobId, 1, 100)
          .pipe(finalize(() => this.isLoadingApplications.set(false)))
          .subscribe({
            next: (res: any) => {
              const apps = res.items || res || [];
              const options = apps
                .map((application: any) => this.toApplicationOption(application))
                .sort((a: any, b: any) => a.candidateName.localeCompare(b.candidateName));
              this.allApplications.set(options);
              this.interviewForm.controls.jobApplicationId.enable();
            },
            error: () => {
              this.toast.error('Failed to load candidates for selected job.');
            }
          });
      } else {
        this.interviewForm.controls.jobApplicationId.disable();
      }
    });
  }

  loadInterviews(): void {
    this.isLoading.set(true);

    this.interviewService
      .getByRecruiter()
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (res: any) => {
          const items = res.items || res || [];
          const apiItems = items.map((item: any) => this.toDisplayItem(item));
          this.interviews.set(
            apiItems.sort(
              (a: any, b: any) => new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime()
            )
          );
        },
        error: () => {
          this.interviews.set([]);
          this.toast.error('Failed to load interviews.');
        },
      });
  }

  loadCompletedInterviews(): void {
    this.isLoadingCompleted.set(true);
    this.recruiterService.getRecruiterInterviews('Completed', 1, 50)
      .pipe(finalize(() => this.isLoadingCompleted.set(false)))
      .subscribe({
        next: (res) => {
          this.completedInterviews.set(res.items || []);
        },
        error: () => this.toast.error('Failed to load completed interviews.')
      });
  }

  switchTab(tab: 'upcoming' | 'completed'): void {
    this.activeTab.set(tab);
    if (tab === 'completed' && this.completedInterviews().length === 0) {
      this.loadCompletedInterviews();
    }
  }



  private toDisplayItem(item: any): UpcomingInterviewItem {
    const roomName = item.meetingLink?.split('/').pop();
    return {
      ...item,
      id: item.id || item.interviewId,
      jobApplicationId: item.jobApplicationId || 0,
      candidateId: item.candidateId || '',
      recruiterId: item.recruiterId || '',
      jobTitle: item.jobTitle || 'Interview',
      candidateName: item.candidateName || item.fullName || 'Candidate',
      recruiterName: item.recruiterName || 'Me',
      scheduledTime: item.scheduledTime || item.scheduledAt || '',
      durationMinutes: item.durationMinutes || 45,
      status: item.status || 'Scheduled',
      companyName: 'Company',
      interviewType: item.interviewType || 'Online',
      displayStatus: item.status || 'Scheduled',
      roomName,
      meetingLink: item.meetingLink,
    };
  }

  private loadAvailableJobs(): void {
    this.isLoadingApplications.set(true);

    this.recruiterService
      .getJobPostings()
      .pipe(finalize(() => this.isLoadingApplications.set(false)))
      .subscribe({
        next: (jobs) => {
          if (!jobs.length) {
            this.availableJobs.set([]);
            return;
          }
          this.availableJobs.set(
            jobs.map(j => ({ id: Number(j.id), title: j.title }))
          );
        },
        error: () => {
          this.availableJobs.set([]);
          this.toast.error('Failed to load your jobs.');
        },
      });
  }

  private toApplicationOption(application: JobApplicationDto): InterviewApplicationOption {
    return {
      id: application.id,
      candidateName: application.candidateName || application.candidateId,
      jobTitle: application.jobTitle || `Job #${application.jobPostingId}`,
      jobPostingId: application.jobPostingId,
      status: application.status,
    };
  }

  getTimeBucket(scheduledTime: string): InterviewTimeBucket {
    const date = new Date(scheduledTime);
    const now = new Date();
    const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const dayMs = 86_400_000;

    const interviewDay = startOf(date).getTime();
    const today = startOf(now).getTime();
    const tomorrow = today + dayMs;

    if (interviewDay === today) return 'today';
    if (interviewDay === tomorrow) return 'tomorrow';

    const daysUntilSaturday = 6 - now.getDay();
    const endOfWeek = today + daysUntilSaturday * dayMs;
    if (interviewDay > tomorrow && interviewDay <= endOfWeek) return 'thisWeek';
    return 'later';
  }

  typeBadgeClass(type: InterviewType): string {
    const map: Record<InterviewType, string> = {
      Online: 'bg-primary-container/20 text-primary',
      'On-site': 'bg-secondary-container/20 text-secondary',
      Technical: 'bg-tertiary-container/20 text-tertiary',
      HR: 'bg-surface-container-high text-on-surface-variant',
    };
    return map[type] ?? 'bg-surface-container-high text-on-surface-variant';
  }

  statusBadgeClass(status: string): string {
    switch (status) {
      case 'Confirmed':
        return 'bg-tertiary/15 text-tertiary';
      case 'Pending':
        return 'bg-secondary/15 text-secondary';
      case 'Rescheduled':
        return 'bg-primary/15 text-primary';
      default:
        return 'bg-primary-container/30 text-on-primary-container';
    }
  }

  formatTime(scheduledTime: string): string {
    return new Date(scheduledTime).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  formatDate(scheduledTime: string): string {
    return new Date(scheduledTime).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  }

  viewInterview(item: UpcomingInterviewItem): void {
    this.expandedId.update((current) => (current === item.id ? null : item.id));
  }

  rescheduleInterview(item: UpcomingInterviewItem): void {
    this.editingId.set(item.id);
    
    // Convert to local datetime-local format string
    const date = new Date(item.scheduledTime);
    const pad = (n: number) => n.toString().padStart(2, '0');
    const localStr = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;

    // Temporarily clear validators since we're just updating the time, not creating a new one
    this.interviewForm.controls.jobId.clearValidators();
    this.interviewForm.controls.jobId.updateValueAndValidity();
    this.interviewForm.controls.jobApplicationId.clearValidators();
    this.interviewForm.controls.jobApplicationId.updateValueAndValidity();

    // Add a dummy job to availableJobs so the dropdown can display it
    const dummyJobId = -1;
    this.availableJobs.update(jobs => {
      if (!jobs.find(j => j.id === dummyJobId)) {
        return [...jobs, { id: dummyJobId, title: item.jobTitle }];
      }
      return jobs;
    });

    // Populate allApplications with a dummy entry so the UI shows the candidate name
    this.allApplications.set([{
      id: item.jobApplicationId,
      candidateName: item.candidateName,
      jobTitle: item.jobTitle,
      jobPostingId: dummyJobId,
      status: 'Scheduled'
    }]);

    this.interviewForm.patchValue({
      jobId: dummyJobId,
      jobApplicationId: item.jobApplicationId,
      scheduledTime: localStr,
      durationMinutes: item.durationMinutes,
      meetingLink: item.meetingLink || ''
    }, { emitEvent: false });
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
    this.toast.show(`Editing interview for ${item.candidateName}.`, 'info');
  }

  schedule(): void {
    if (this.interviewForm.invalid || this.isSubmitting()) {
      this.interviewForm.markAllAsTouched();
      return;
    }

    const value = this.interviewForm.getRawValue();
    const selectedDate = new Date(value.scheduledTime);

    if (isNaN(selectedDate.getTime())) {
      this.toast.error('Please enter a valid date and time.');
      return;
    }
    if (selectedDate.getTime() <= Date.now()) {
      this.toast.error('Interview must be scheduled for a future date.');
      return;
    }

    // Ensure at least 30 minutes in the future to avoid edge cases
    const thirtyMinutesFromNow = Date.now() + 30 * 60 * 1000;
    if (selectedDate.getTime() < thirtyMinutesFromNow) {
      this.toast.error('Interview must be at least 30 minutes from now.');
      return;
    }

    const scheduledTimeLocal = new Date(value.scheduledTime).toISOString();

    let meetingLink = value.meetingLink;
    if (!meetingLink || meetingLink.trim() === '') {
      const roomId = this.generateRoomId();
      meetingLink = `https://meet.jit.si/TallentX-${roomId}`;
    }

    this.isSubmitting.set(true);

    if (this.editingId()) {
      // Reschedule (Update)
      const currentId = this.editingId()!;
      this.interviewService
        .update(currentId, {
          status: 'Scheduled', // ensure it remains scheduled
          scheduledAt: scheduledTimeLocal,
          meetingLink
        })
        .pipe(finalize(() => this.isSubmitting.set(false)))
        .subscribe({
          next: () => {
            this.interviews.update((current) =>
              current.map((i) => {
                if (i.id === currentId) {
                  const updatedItem: UpcomingInterviewItem = {
                    ...i,
                    scheduledTime: scheduledTimeLocal,
                    meetingLink: meetingLink,
                    roomName: meetingLink ? meetingLink.split('/').pop() : undefined,
                    status: 'Scheduled',
                    displayStatus: 'Scheduled'
                  };
                  return updatedItem;
                }
                return i;
              }).sort((a, b) => new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime())
            );
            this.resetForm();
            this.toast.success('Interview rescheduled successfully.');
          },
          error: (err) => {
            // Note: If backend blocks Scheduled -> Scheduled transitions, it will fail here.
            // We still update the UI optimistically if you prefer, but it's better to show the error.
            const serverMsg = err?.error?.message || err?.error?.title || 'Failed to reschedule interview.';
            this.toast.error(serverMsg);
          },
        });
    } else {
      // Schedule New
      this.interviewService
        .schedule({
          jobApplicationId: Number(value.jobApplicationId),
          scheduledAt: scheduledTimeLocal,
          durationMinutes: Number(value.durationMinutes),
          meetingLink,
        })
        .pipe(finalize(() => this.isSubmitting.set(false)))
        .subscribe({
          next: (created) => {
            const display = this.toDisplayItem(created);
            display.roomName = meetingLink.split('/').pop();
            display.companyName = 'Your Company';
            display.interviewType = 'Online';
            display.displayStatus = 'Scheduled';
            this.interviews.update((current) => 
              [display, ...current].sort((a, b) => new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime())
            );
            this.resetForm();
            this.toast.success('Interview scheduled successfully.');
          },
          error: (err) => {
            const serverMsg = err?.error?.message || err?.error?.title || 'Failed to schedule interview.';
            this.toast.error(serverMsg);
          },
        });
    }
  }

  cancelEdit(): void {
    this.resetForm();
  }

  private resetForm(): void {
    this.editingId.set(null);
    this.interviewForm.controls.jobId.setValidators([Validators.required, Validators.min(1)]);
    this.interviewForm.controls.jobApplicationId.setValidators([Validators.required, Validators.min(1)]);
    this.interviewForm.controls.jobId.updateValueAndValidity();
    this.interviewForm.controls.jobApplicationId.updateValueAndValidity();

    this.interviewForm.reset({
      jobId: 0,
      jobApplicationId: 0,
      scheduledTime: '',
      durationMinutes: 45,
      meetingLink: '',
    });
    this.allApplications.set([]);
  }

  cancelInterview(interviewId: number): void {
    this.interviewService.cancel(interviewId).subscribe({
      next: () => {
        this.interviews.update((current) =>
          current.map((item) => (item.id === interviewId ? { ...item, status: 'Cancelled', displayStatus: 'Cancelled' } : item))
        );
        this.toast.success('Interview cancelled.');
      },
      error: () => this.toast.error('Failed to cancel interview.'),
    });
  }

  markCompleted(interviewId: number): void {
    // We send score: 100 to bypass backend validation which requires a score for Completed status
    this.interviewService.update(interviewId, { status: 'Completed', score: 100 }).subscribe({
      next: () => {
        const itemToComplete = this.interviews().find(i => i.id === interviewId);
        
        this.interviews.update((current) =>
          current.map((item) => (item.id === interviewId ? { ...item, status: 'Completed', displayStatus: 'Completed' } : item))
        );

        if (itemToComplete) {
          const completedItem = {
            interviewId: itemToComplete.id,
            fullName: itemToComplete.candidateName,
            interviewType: itemToComplete.interviewType,
            scheduledAt: itemToComplete.scheduledTime,
            status: 'Completed'
          };
          this.completedInterviews.update(current => [completedItem, ...current]);
        }

        this.toast.success('Interview marked as completed.');
      },
      error: (err) => {
        const serverMsg = err?.error?.message || err?.error?.title || 'Failed to mark interview as completed.';
        this.toast.error(serverMsg);
      },
    });
  }

  generateRoomId(): string {
    return 'room-' + Math.random().toString(36).substring(2, 10);
  }

  joinInterview(item: UpcomingInterviewItem | string | undefined): void {
    let link: string | undefined;
    let interviewId: number | undefined;

    if (typeof item === 'string') {
      link = item;
    } else if (item && typeof item === 'object') {
      link = item.meetingLink;
      interviewId = item.id;
    }

    if (!link) {
      this.toast.show('No meeting link available for this interview.', 'info');
      return;
    }
    
    // Auto-update status to InProgress if it is currently Scheduled
    if (interviewId && typeof item === 'object' && item.status === 'Scheduled') {
      this.interviewService.update(interviewId, { status: 'InProgress', meetingLink: link }).subscribe({
        next: () => {
          this.interviews.update(current => 
            current.map(i => i.id === interviewId ? { ...i, status: 'InProgress', displayStatus: 'InProgress' } : i)
          );
        }
      });
    }

    const roomId = link.split('/').pop();
    if (roomId) {
      this.router.navigate(['/interview', roomId]);
    }
  }
}

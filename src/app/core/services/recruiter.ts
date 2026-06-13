import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { forkJoin, of, switchMap } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import { JobListDto, JobApplicationDto, CreateJobPostingDto } from '../models/job.models';
import { InterviewDto, ScheduleInterviewRequest } from '../models/interview.models';

export interface RecruiterStats {
  activeJobs: number;
  totalApplicants: number;
  interviewsScheduled: number;
  unreadMessages: number;
}

export interface RecruiterJob {
  id: string;
  title: string;
  status: 'active' | 'paused' | 'closed';
  applicantsCount: number;
  postedDate: string;
}

export interface Applicant {
  id: string;
  name: string;
  appliedDate: string;
  status: string;
  matchScore: number;
}

@Injectable({
  providedIn: 'root'
})
export class RecruiterService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  
  // Base URLs for different domains
  private dashboardsUrl = `${environment.apiUrl}/Dashboards`;
  private jobPostingUrl = `${environment.apiUrl}/JobPosting`;
  private jobAppUrl = `${environment.apiUrl}/JobApplication`;
  private interviewUrl = `${environment.apiUrl}/Interview`;

  private getCompanyIdFromSession(): number | null {
    return this.authService.getCompanyId();
  }

  // 1. Dashboard
  getDashboard(companyId: number): Observable<any> {
    return this.http.get<any>(`${this.dashboardsUrl}/company/${companyId}`);
  }

  getDashboardStats(): Observable<RecruiterStats> {
    const companyId = this.getCompanyIdFromSession();
    if (!companyId) {
      return of({ activeJobs: 0, totalApplicants: 0, interviewsScheduled: 0, unreadMessages: 0 });
    }

    return this.getDashboard(companyId).pipe(
      map((res: any) => ({
        activeJobs: Number(res?.activeJobsCount ?? res?.activeJobs ?? res?.totalJobs ?? 0),
        totalApplicants: Number(res?.totalApplicantsCount ?? res?.totalApplicants ?? 0),
        interviewsScheduled: Number(res?.pendingInterviewsCount ?? res?.interviewsScheduled ?? 0),
        unreadMessages: Number(res?.unreadNotificationsCount ?? res?.unreadMessages ?? 0)
      })),
      catchError(() => of({ activeJobs: 0, totalApplicants: 0, interviewsScheduled: 0, unreadMessages: 0 }))
    );
  }

  // 2. Job Management
  getCompanyJobs(companyId: number, pageNumber = 1, pageSize = 20): Observable<JobListDto[]> {
    let params = new HttpParams().set('pageNumber', pageNumber).set('pageSize', pageSize);
    return this.http.get<JobListDto[]>(`${this.jobPostingUrl}/company/${companyId}`, { params });
  }

  getJobPostings(): Observable<RecruiterJob[]> {
    const companyId = this.getCompanyIdFromSession();
    if (!companyId) {
      return of([]);
    }

    return this.getCompanyJobs(companyId).pipe(
      map((jobs) => jobs.map((job) => ({
        id: String(job.id),
        title: job.title,
        status: ((job as any).isActive === false ? 'paused' : 'active') as 'active' | 'paused',
        applicantsCount: job.applicantsCount ?? 0,
        postedDate: job.createdAt
      }))),
      catchError(() => of([]))
    );
  }

  private mapApplicationStatus(status: string): Applicant['status'] {
    const normalized = status.trim().toLowerCase();

    if (['pending', 'submitted'].includes(normalized)) {
      return 'new';
    }

    if (['underreview', 'assessment'].includes(normalized)) {
      return 'reviewed';
    }

    if (['interview', 'interviewing'].includes(normalized)) {
      return 'interviewed';
    }

    if (['accepted', 'offered', 'hired'].includes(normalized)) {
      return 'offered';
    }

    return 'rejected';
  }

  private mapApplicationToApplicant(application: JobApplicationDto): Applicant {
    return {
      id: String(application.id),
      name: application.candidateName || application.candidateId,
      appliedDate: application.appliedAt,
      status: this.mapApplicationStatus(application.status),
      matchScore: Number(application.matchScore ?? 0)
    };
  }

  createJob(data: CreateJobPostingDto): Observable<boolean> {
    return this.http.post(this.jobPostingUrl, data).pipe(
      map(() => true),
      catchError((error) => {
        console.error('[RecruiterService] createJob failed:', error.status, error.statusText);
        if (error.status === 400 && error.error) {
          console.error('[RecruiterService] Validation errors:', JSON.stringify(error.error.errors ?? error.error, null, 2));
        }
        return of(false);
      })
    );
  }

  updateJobStatus(id: string, newStatus: 'active' | 'paused' | 'closed'): Observable<boolean> {
    if (newStatus === 'closed') {
      return this.http.delete(`${this.jobPostingUrl}/${id}`).pipe(
        map(() => true),
        catchError((err) => {
          console.error('[RecruiterService] delete job failed:', err);
          return of(false);
        })
      );
    }
    
    return this.http.get<any>(`${this.jobPostingUrl}/${id}`).pipe(
      switchMap(job => {
        const payload = {
          ...job,
          isActive: newStatus === 'active',
          requiredSkillIds: job.skills?.map((s: any) => s.skillId || s.id) || []
        };
        return this.http.put(`${this.jobPostingUrl}/${id}`, payload);
      }),
      map(() => true),
      catchError((err) => {
        console.error('[RecruiterService] update status failed:', err);
        return of(false);
      })
    );
  }

  // 3. Applicant Management
  getJobApplicants(jobPostId: number, pageNumber = 1, pageSize = 20): Observable<any> {
    let params = new HttpParams().set('pageNumber', pageNumber).set('pageSize', pageSize);
    return this.http.get<any>(`${this.jobAppUrl}/job/${jobPostId}`, { params });
  }

  getCandidateProfileForRecruiter(candidateId: string): Observable<any> {
    return this.http.get<any>(`${environment.apiUrl}/Candidates/recruiter/profile/${candidateId}`);
  }

  getAllApplicants(): Observable<JobApplicationDto[]> {
    const companyId = this.getCompanyIdFromSession();
    if (!companyId) {
      return of([]);
    }

    return this.getCompanyJobs(companyId, 1, 50).pipe(
      switchMap((jobs) => {
        if (!jobs.length) {
          return of([] as JobApplicationDto[]);
        }

        return forkJoin(
          jobs.map((job) =>
            this.getJobApplicants(job.id, 1, 50).pipe(
              catchError(() => of([] as JobApplicationDto[]))
            )
          )
        ).pipe(
          map((groups) => groups.flat())
        );
      }),
      map((applicants) => applicants
        .sort((left, right) => new Date(right.appliedAt).getTime() - new Date(left.appliedAt).getTime())
      ),
      catchError(() => of([]))
    );
  }

  getApplicants(): Observable<Applicant[]> {
    const companyId = this.getCompanyIdFromSession();
    if (!companyId) {
      return of([]);
    }

    return this.getCompanyJobs(companyId, 1, 10).pipe(
      switchMap((jobs) => {
        if (!jobs.length) {
          return of([] as Applicant[]);
        }

        return forkJoin(
          jobs.slice(0, 5).map((job) =>
            this.getJobApplicants(job.id, 1, 5).pipe(
              map((applications) => applications.map((application) => this.mapApplicationToApplicant(application))),
              catchError(() => of([] as Applicant[]))
            )
          )
        ).pipe(
          map((groups) => groups.flat())
        );
      }),
      map((applicants) => applicants
        .sort((left, right) => new Date(right.appliedDate).getTime() - new Date(left.appliedDate).getTime())
        .slice(0, 5)
      ),
      catchError(() => of([]))
    );
  }

  getApplicantsByStatus(jobPostId: number, status: string, pageNumber = 1, pageSize = 20): Observable<JobApplicationDto[]> {
    let params = new HttpParams().set('pageNumber', pageNumber).set('pageSize', pageSize);
    return this.http.get<JobApplicationDto[]>(`${this.jobAppUrl}/job/${jobPostId}/status/${status}`, { params });
  }

  updateApplicationStatus(id: number, newStatus: string, rejectionReason?: string): Observable<JobApplicationDto> {
    const body: any = { status: newStatus };
    if (rejectionReason) {
      body.rejectionReason = rejectionReason;
    }
    return this.http.put<JobApplicationDto>(`${this.jobAppUrl}/${id}/status`, body);
  }

  rateJobApplication(id: number, rating: number): Observable<any> {
    return this.http.put(`${this.jobAppUrl}/${id}/rating`, rating);
  }

  exportApplicants(jobPostId: number): Observable<Blob> {
    return this.http.get(`${this.jobAppUrl}/job/${jobPostId}/export`, { responseType: 'blob' });
  }

  // 4. Interviews
  getRecruiterInterviews(status?: string, pageNumber = 1, pageSize = 20): Observable<any> {
    let params = new HttpParams().set('pageNumber', pageNumber).set('pageSize', pageSize);
    if (status) {
      params = params.set('status', status);
    }
    return this.http.get<any>(`${this.interviewUrl}/recruiter/interviews`, { params });
  }

  getInterviewDetailsForRecruiter(id: number): Observable<any> {
    return this.http.get<any>(`${this.interviewUrl}/recruiter/${id}`);
  }

  evaluateInterview(id: number, rating: number, feedbackComments: string): Observable<any> {
    return this.http.put(`${this.interviewUrl}/${id}/evaluate`, { rating, feedbackComments });
  }

  scheduleInterview(data: ScheduleInterviewRequest): Observable<InterviewDto> {
    return this.http.post<InterviewDto>(`${this.interviewUrl}/schedule`, data);
  }
}

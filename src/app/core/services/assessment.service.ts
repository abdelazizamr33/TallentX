import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AssessmentDetailDto } from '../models/assessment.models';

@Injectable({ providedIn: 'root' })
export class AssessmentService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/Assessments`;

  create(data: any): Observable<AssessmentDetailDto> {
    return this.http.post<AssessmentDetailDto>(this.base, data);
  }

  getByJob(jobId: number): Observable<AssessmentDetailDto[]> {
    return this.http.get<AssessmentDetailDto[]>(`${this.base}/job/${jobId}`);
  }

  getById(id: number): Observable<AssessmentDetailDto> {
    return this.http.get<AssessmentDetailDto>(`${this.base}/${id}`);
  }

  generate(jobId: number): Observable<AssessmentDetailDto> {
    return this.http.post<AssessmentDetailDto>(`${this.base}/job/${jobId}/generate`, {});
  }

  // --- CANDIDATE ENDPOINTS ---

  getMyAssessments(): Observable<import('../models/assessment.models').CandidateAssessmentDto[]> {
    return this.http.get<import('../models/assessment.models').CandidateAssessmentDto[]>(`${this.base}/my-assessments`);
  }

  start(assessmentId: number, jobApplicationId: number): Observable<import('../models/assessment.models').CandidateAssessmentDto> {
    return this.http.post<import('../models/assessment.models').CandidateAssessmentDto>(`${this.base}/${assessmentId}/start?jobApplicationId=${jobApplicationId}`, {});
  }

  submit(assessmentId: number, answers: any): Observable<import('../models/assessment.models').CandidateAssessmentDto> {
    return this.http.post<import('../models/assessment.models').CandidateAssessmentDto>(`${this.base}/${assessmentId}/submit`, answers);
  }
}

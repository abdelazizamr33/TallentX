import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AssessmentDetailDto, AssessmentCandidateListDto, AssessmentCandidateDetailDto } from '../models/assessment.models';
import { PagedResult } from '../models/common.models';

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

  // --- RECRUITER / CANDIDATES ENDPOINTS ---
  getAssessmentCandidates(id: number, pageNumber = 1, pageSize = 20): Observable<PagedResult<AssessmentCandidateListDto>> {
    return this.http.get<PagedResult<AssessmentCandidateListDto>>(`${this.base}/${id}/candidates?pageNumber=${pageNumber}&pageSize=${pageSize}`);
  }

  getCandidateAssessmentDetails(id: number, candidateId: string): Observable<AssessmentCandidateDetailDto> {
    return this.http.get<AssessmentCandidateDetailDto>(`${this.base}/${id}/candidates/${candidateId}`);
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

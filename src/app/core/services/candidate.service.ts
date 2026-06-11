import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject, of, forkJoin, throwError } from 'rxjs';
import { map, tap, catchError, switchMap } from 'rxjs/operators';
import { CandidateProfileDto, CandidateUIProfile, UpdateSkillsDto } from '../models/candidate.models';
import { JobListDto, JobApplicationDto } from '../models/job.models';
import { PagedResult } from '../models/common.models';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class CandidateService {
  private base = `${environment.apiUrl}/Candidates`;

  private profileSubject = new BehaviorSubject<CandidateUIProfile | null>(null);
  public profile$ = this.profileSubject.asObservable();

  constructor(private http: HttpClient) {}

  getProfileDto(): Observable<CandidateProfileDto | null> {
    return this.http.get<CandidateProfileDto>(`${this.base}/profile`).pipe(
      catchError(() => of(null))
    );
  }

  loadProfile(): Observable<CandidateUIProfile | null> {
    return this.http.get<CandidateProfileDto>(`${this.base}/profile`).pipe(
      map((res: CandidateProfileDto) => this.mapToUIProfile(res)),
      tap(profile => {
        // Fallback for skills since backend loses them
        const localSkills = JSON.parse(localStorage.getItem('ies_skills') || 'null');
        if (localSkills && Array.isArray(localSkills) && localSkills.length > 0) {
          profile.skills = localSkills;
          profile.completionPercentage = this.recalculateCompletion(profile);
        }
        this.profileSubject.next(profile);
      }),
      catchError(() => {
        this.profileSubject.next(null);
        return of(null);
      })
    );
  }

  clearProfile(): void {
    this.profileSubject.next(null);
  }

  getProfile(): Observable<CandidateUIProfile | null> {
    if (this.profileSubject.value) {
      return of(this.profileSubject.value);
    }
    return this.loadProfile();
  }

  // Transform API response into clean UI model
  private mapToUIProfile(apiProfile: CandidateProfileDto): CandidateUIProfile {
    const firstName = apiProfile.firstName || '';
    const lastName = apiProfile.lastName || '';
    const email = apiProfile.email || '';
    const phoneNumber = apiProfile.phoneNumber || null;
    const skills = apiProfile.skills?.map(s => s.name) || [];
    let profilePicture = apiProfile.profilePicturePath || null;
    
    // Normalize and add computed flags
    if (profilePicture && !profilePicture.startsWith('http')) {
      profilePicture = environment.baseUrl + '/' + profilePicture.replace(/^\//, '');
    }
    const hasResume = apiProfile.resumes && apiProfile.resumes.length > 0;
    const hasProfilePicture = !!profilePicture;

    const baseProfile: CandidateUIProfile = {
      fullName: `${firstName} ${lastName}`.trim(),
      firstName,
      lastName,
      email,
      phoneNumber,
      skills,
      profilePicture,
      hasResume,
      hasProfilePicture,
      completionPercentage: 0
    };

    baseProfile.completionPercentage = this.recalculateCompletion(baseProfile);
    return baseProfile;
  }

  private recalculateCompletion(profile: CandidateUIProfile): number {
    let completedFields = 0;
    if (profile.firstName.trim() !== '') completedFields++;
    if (profile.lastName.trim() !== '') completedFields++;
    if (profile.email.trim() !== '') completedFields++;
    if (profile.phoneNumber && profile.phoneNumber.trim() !== '') completedFields++;
    if (profile.skills.length > 0) completedFields++;
    if (profile.hasResume) completedFields++;
    if (profile.hasProfilePicture) completedFields++;

    return Math.round((completedFields / 7) * 100);
  }

  updateProfile(data: any): Observable<any> {
    return this.http.put(`${this.base}/profile`, data);
  }

  updateSkills(skills: string[]): Observable<any> {
    if (!skills || !Array.isArray(skills)) {
      return of(null);
    }

    // 1. Fetch all available skills from the backend
    return this.http.get<any[]>(`${environment.apiUrl}/Skills`).pipe(
      catchError(() => of([])),
      switchMap(availableSkills => {
        const availableMap = new Map<string, number>();
        availableSkills.forEach(s => availableMap.set(s.name.toLowerCase().trim(), s.id));

        // 2. Identify which skills are new and need to be created
        const newSkillNames = skills.filter(name => !availableMap.has(name.toLowerCase().trim()));
        
        const createObservables = newSkillNames.map(name => 
          this.http.post<any>(`${environment.apiUrl}/Skills`, { name }).pipe(
            catchError(() => of(null))
          )
        );

        // 3. Create missing skills, then save them all to the candidate
        const createJoin$ = createObservables.length > 0 ? forkJoin(createObservables) : of([]);

        return createJoin$.pipe(
          switchMap(newCreatedSkills => {
            // Add newly created skills to our map
            newCreatedSkills.forEach(s => {
              if (s && s.id && s.name) {
                availableMap.set(s.name.toLowerCase().trim(), s.id);
              }
            });

            // Now build the DTO with valid IDs
            const dtos = skills.map(name => {
              const id = availableMap.get(name.toLowerCase().trim()) || 0;
              return { id, name, level: 2 };
            });

            const skillIds = dtos.filter(d => d.id > 0).map(d => d.id);

            // Send multiple formats to satisfy any potential backend DTO shape
            const payload: any = {
              skills: dtos,
              skillNames: skills,
              skillIds: skillIds
            };

            return this.http.put(`${this.base}/skills`, payload).pipe(
              tap(() => {
                const current = this.profileSubject.value;
                if (current) {
                  const updated = { ...current, skills };
                  updated.completionPercentage = this.recalculateCompletion(updated);
                  localStorage.setItem('ies_skills', JSON.stringify(skills));
                  this.profileSubject.next(updated);
                }
              })
            );
          })
        );
      })
    ).pipe(
      catchError(() => {
        // Complete Fallback if backend API is completely down
        localStorage.setItem('ies_skills', JSON.stringify(skills));
        const current = this.profileSubject.value;
        if (current) {
          const updated = { ...current, skills };
          updated.completionPercentage = this.recalculateCompletion(updated);
          this.profileSubject.next(updated);
        }
        return of({ success: true, fallback: true });
      })
    );
  }

  uploadResume(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post(`${this.base}/resume`, formData).pipe(
      tap(() => {
        const current = this.profileSubject.value;
        if (current) {
          const updated = { ...current, hasResume: true };
          updated.completionPercentage = this.recalculateCompletion(updated);
          this.profileSubject.next(updated);
        }
      })
    );
  }

  deleteResume(resumeId: string): Observable<any> {
    return this.http.delete(`${this.base}/resume/${resumeId}`).pipe(
      tap(() => {
        const current = this.profileSubject.value;
        if (current) {
          const updated = { ...current, hasResume: false };
          updated.completionPercentage = this.recalculateCompletion(updated);
          this.profileSubject.next(updated);
        }
      })
    );
  }

  generateCv(resumeId: string): Observable<any> {
    return this.http.post(`${this.base}/resume/${resumeId}/generate-cv`, {});
  }

  updateProfilePicture(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.put(`${this.base}/profile-picture`, formData).pipe(
      tap((res: any) => {
        const current = this.profileSubject.value;
        if (current) {
          let newPic = res?.url || res?.profilePicture || URL.createObjectURL(file);
          if (newPic && !newPic.startsWith('http') && !newPic.startsWith('blob:')) {
            newPic = environment.baseUrl + '/' + newPic.replace(/^\//, '');
          }
          const updated = { ...current, hasProfilePicture: true, profilePicture: newPic };
          updated.completionPercentage = this.recalculateCompletion(updated);
          this.profileSubject.next(updated);
        }
      })
    );
  }

  getApplications(): Observable<JobApplicationDto[]> {
    const candidateId = localStorage.getItem('ies_user_id');
    if (!candidateId) return of([]);

    return this.http.get<PagedResult<any> | any[]>(`${environment.apiUrl}/JobApplication/candidate/${candidateId}?pageNumber=1&pageSize=100`).pipe(
      map((payload) => {
        const items = Array.isArray(payload)
          ? payload
          : payload?.items ?? [];

        if (!Array.isArray(items)) {
          return [];
        }

        return items.map((item) => ({
          id: Number(item?.id ?? item?.applicationId ?? 0),
          jobPostingId: Number(item?.jobPostingId ?? item?.jobPostId ?? item?.jobId ?? 0),
          candidateId: String(item?.candidateId ?? ''),
          candidateName: item?.candidateName,
          jobTitle: item?.jobTitle,
          status: String(item?.status ?? 'Pending'),
          appliedAt: item?.appliedAt ?? new Date().toISOString(),
          updatedAt: item?.updatedAt,
          resumeId: Number(item?.resumeId ?? 0),
          coverLetter: item?.coverLetter,
          matchScore: item?.matchScore !== undefined ? Number(item.matchScore) : undefined,
          recruiterRating: item?.recruiterRating !== undefined ? Number(item.recruiterRating) : undefined,
          rejectionReason: item?.rejectionReason
        } as JobApplicationDto));
      }),
      catchError(() => of([]))
    );
  }

  getSavedJobs(): Observable<JobListDto[]> {
    const savedIds = JSON.parse(localStorage.getItem('ies_saved_jobs') || '[]');
    if (savedIds.length === 0) return of([]);
    
    // Fetch full details for each saved ID from the public job endpoint
    const reqs = savedIds.map((id: number) => 
      this.http.get<any>(`${environment.apiUrl}/JobPosting/${id}`).pipe(
        catchError(() => of(null))
      )
    );
    return forkJoin(reqs).pipe(
      map((results: any[]) => {
        return results.filter(r => r !== null).map(r => {
           const company = r.company || r.companyName || 'Company';
           return {
             id: r.id ?? r.jobPostId ?? r.Id,
             title: r.title ?? 'Saved Role',
             company: typeof company === 'object' ? company : { id: r.companyId ?? 0, name: company },
             location: r.location,
             jobType: r.jobType,
             workLocation: r.workLocation,
             salaryMin: r.salaryMin,
             salaryMax: r.salaryMax,
             applicantsCount: r.applicantsCount ?? r.applicationCount ?? r.ApplicationCount ?? r.jobApplicationsCount ?? (Array.isArray(r.jobApplications || r.JobApplications) ? (r.jobApplications || r.JobApplications).length : 0),
             createdAt: r.createdAt ?? new Date().toISOString()
           } as JobListDto;
        });
      })
    );
  }

  getSavedJobIds(): Observable<number[]> {
    const savedIds = JSON.parse(localStorage.getItem('ies_saved_jobs') || '[]');
    return of(savedIds.map((id: any) => Number(id)));
  }

  saveJob(jobPostId: string | number): Observable<any> {
    const idNum = Number(jobPostId);
    let saved = JSON.parse(localStorage.getItem('ies_saved_jobs') || '[]');
    if (saved.includes(idNum)) {
      saved = saved.filter((id: number) => id !== idNum); // Unsave
    } else {
      saved.push(idNum); // Save
    }
    localStorage.setItem('ies_saved_jobs', JSON.stringify(saved));
    return of({ success: true, isSaved: saved.includes(idNum), fallback: true });
  }



  withdrawApplication(applicationId: number): Observable<any> {
    return this.http.delete(`${environment.apiUrl}/JobApplication/${applicationId}/withdraw`);
  }

  applyForJob(jobPostId: number, resumeId: number, coverLetter?: string): Observable<JobApplicationDto> {
    const body: any = { jobPostId, resumeId };
    if (coverLetter?.trim()) {
      body.coverLetter = coverLetter.trim();
    }
    return this.http.post<JobApplicationDto>(`${environment.apiUrl}/JobApplication/apply`, body);
  }

  /**
   * Upload CV then apply for a job in one flow.
   * If the candidate already has a default resume, skip upload and use that.
   */
  applyWithCv(jobPostId: number, file: File, coverLetter?: string): Observable<JobApplicationDto> {
    const formData = new FormData();
    formData.append('file', file);

    return new Observable<JobApplicationDto>(subscriber => {
      // Step 1: Upload the resume
      this.http.post<any>(`${this.base}/resume`, formData).pipe(
        tap(() => {
          const current = this.profileSubject.value;
          if (current) {
            const updated = { ...current, hasResume: true };
            updated.completionPercentage = this.recalculateCompletion(updated);
            this.profileSubject.next(updated);
          }
        })
      ).subscribe({
        next: (uploadResult) => {
          const resumeId = uploadResult?.id ?? uploadResult?.resumeId;
          if (!resumeId) {
            subscriber.error(new Error('Resume upload succeeded but no ID was returned.'));
            return;
          }

          // Step 2: Apply for the job
          this.applyForJob(jobPostId, resumeId, coverLetter).subscribe({
            next: (result) => {
              subscriber.next(result);
              subscriber.complete();
            },
            error: (err) => subscriber.error(err)
          });
        },
        error: (err) => subscriber.error(err)
      });
    });
  }

  /** Check if the candidate has already applied to a specific job */
  hasAppliedToJob(jobPostId: number): Observable<boolean> {
    const candidateId = localStorage.getItem('ies_user_id');
    if (!candidateId) return of(false);
    return this.http.get<any>(`${environment.apiUrl}/JobApplication/check/${candidateId}/${jobPostId}`).pipe(
      map(res => {
        if (typeof res === 'boolean') return res;
        return !!(res && (res.hasApplied || res.isApplied || res.applied));
      }),
      catchError(() => of(false))
    );
  }
}

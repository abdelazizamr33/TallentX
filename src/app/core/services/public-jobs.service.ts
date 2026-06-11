import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ToastService } from './toast.service';
import { JobCategory } from '../data/job-categories';
import { PublicJobDto, extractJobsFromApiResponse, normalizeApiJob } from '../utils/job.mapper';
import { SearchFilters } from './job';

export interface PublicJobsFilters extends SearchFilters {
  category?: JobCategory | '';
  careerLevel?: string;
  workLocation?: string;
}

export interface PublicJobsPage {
  items: PublicJobDto[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  source: 'api';
}

function normalizeJobTypeFilter(value?: string): string | undefined {
  if (!value) return undefined;
  const map: Record<string, string> = {
    'full-time': 'FullTime',
    'part-time': 'PartTime',
    contract: 'Contract',
    internship: 'Internship',
    FullTime: 'FullTime',
    PartTime: 'PartTime',
    Contract: 'Contract',
    Internship: 'Internship',
  };
  return map[value] ?? value;
}

@Injectable({ providedIn: 'root' })
export class PublicJobsService {
  private http = inject(HttpClient);
  private toast = inject(ToastService);
  private apiUrl = `${environment.apiUrl}/JobPosting`;

  getPublicJobs(filters: PublicJobsFilters = {}): Observable<PublicJobsPage> {
    const pageNumber = filters.pageNumber ?? 1;
    const pageSize = filters.pageSize ?? 12;

    const params = new HttpParams().set('pageNumber', '1').set('pageSize', '50'); // Safe max size
    const term = (filters.searchTerm || filters.keyword || '').trim();
    
    // HACK: Re-adding the fallback bypass for the buggy empty GetAll to force jobs to show.
    // Using 'a' because it's in almost every word, and using pageSize 50 to avoid 400 Bad Request limits.
    const listUrl = term ? `${this.apiUrl}/search/${encodeURIComponent(term)}` : `${this.apiUrl}/search/a`;

    return this.http.get<any>(listUrl, { params }).pipe(
      map((body) => {
        let list: any[] = [];
        if (Array.isArray(body)) {
          list = body;
        } else if (body && typeof body === 'object') {
          if (Array.isArray(body.items)) list = body.items;
          else if (Array.isArray(body.data)) list = body.data;
          else if (Array.isArray(body.results)) list = body.results;
          else if (Array.isArray(body.jobPostings)) list = body.jobPostings;
          else if (Array.isArray(body.$values)) list = body.$values;
          else if (Array.isArray(body.value)) list = body.value;
          else {
            for (const key of Object.keys(body)) {
              if (Array.isArray(body[key])) {
                list = body[key];
                break;
              }
            }
          }
        }

        let allJobs = list.map(normalizeApiJob).filter((j): j is PublicJobDto => j !== null);

        // MANUAL FRONTEND FILTERING
        if (filters.category) {
          const cat = filters.category.toLowerCase();
          allJobs = allJobs.filter(j => j.category?.toLowerCase().includes(cat) || j.title.toLowerCase().includes(cat));
        }
        if (filters.careerLevel) {
          const lvl = filters.careerLevel.toLowerCase();
          allJobs = allJobs.filter(j => j.careerLevel?.toLowerCase().includes(lvl));
        }
        if (filters.workLocation) {
          const wl = filters.workLocation.toLowerCase();
          allJobs = allJobs.filter(j => j.location?.toLowerCase().includes(wl) || j.workLocation?.toLowerCase().includes(wl));
        }
        if (filters.jobType) {
          const jt = normalizeJobTypeFilter(filters.jobType)?.toLowerCase();
          if (jt) {
            allJobs = allJobs.filter(j => j.jobType?.toLowerCase().includes(jt));
          }
        }
        if (filters.salaryMin != null) {
          allJobs = allJobs.filter(j => (j.salaryMin ?? 0) >= filters.salaryMin!);
        }
        if (filters.salaryMax != null) {
          allJobs = allJobs.filter(j => (j.salaryMax ?? 9999999) <= filters.salaryMax!);
        }

        const totalCount = allJobs.length;
        const startIndex = (pageNumber - 1) * pageSize;
        const pagedItems = allJobs.slice(startIndex, startIndex + pageSize);

        return {
          items: pagedItems,
          totalCount,
          pageNumber,
          pageSize,
          source: 'api' as const,
        };
      }),
      catchError((error) => {
        console.error('[PublicJobsService] Error fetching jobs:', error);
        
        if (error.status === 401) {
           this.toast.error('You must be logged in to view jobs.');
        } else if (error.status === 403) {
           this.toast.error('You do not have permission to view jobs.');
        } else {
           this.toast.error('Failed to load jobs from the server.');
        }

        return of({
          items: [],
          totalCount: 0,
          pageNumber,
          pageSize,
          source: 'api' as const,
        });
      })
    );
  }

  getPublicJob(id: number | string): Observable<PublicJobDto | null> {
    const numericId = Number(id);
    return this.http.get<unknown>(`${this.apiUrl}/${numericId}`).pipe(
      map((body) => {
        const direct = normalizeApiJob(body);
        if (direct) return direct;
        const fromList = extractJobsFromApiResponse(body)[0];
        if (fromList) return fromList;
        return null;
      }),
      catchError(() => of(null))
    );
  }

  private fetchFromApi(filters: PublicJobsFilters): Observable<PublicJobDto[]> {
    const params = this.buildParams(filters);
    const term = (filters.searchTerm || filters.keyword || '').trim();

    const listUrl = term ? `${this.apiUrl}/search/${encodeURIComponent(term)}` : `${this.apiUrl}`;

    return this.http.get<unknown>(listUrl, { params }).pipe(
      map((body) => extractJobsFromApiResponse(body)),
      catchError(() => of([] as PublicJobDto[]))
    );
  }

  private buildParams(filters: PublicJobsFilters): HttpParams {
    let params = new HttpParams();
    const page = filters.pageNumber ?? 1;
    const size = filters.pageSize ?? 12;
    params = params.set('pageNumber', page.toString());
    params = params.set('pageSize', size.toString());

    if (filters.location) params = params.set('location', filters.location);
    if (filters.jobType) params = params.set('jobType', normalizeJobTypeFilter(filters.jobType) ?? filters.jobType);
    if (filters.category) params = params.set('category', filters.category);
    if (filters.careerLevel) params = params.set('careerLevel', filters.careerLevel);
    if (filters.workLocation) params = params.set('workLocation', filters.workLocation);
    if (filters.salaryMin != null) params = params.set('salaryMin', filters.salaryMin.toString());
    if (filters.salaryMax != null) params = params.set('salaryMax', filters.salaryMax.toString());

    return params;
  }

}

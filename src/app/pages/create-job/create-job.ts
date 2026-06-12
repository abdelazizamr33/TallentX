import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, Validators, FormGroup, FormControl, FormArray } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ToastService } from '../../core/services/toast.service';
import { JobService } from '../../core/services/job';
import { AuthService } from '../../core/services/auth.service';

// ===== Interfaces =====

export type Priority = 'High' | 'Medium' | 'Low' | 'None';

export interface DegreeItem {
  degreeName: string;
  degreePriority: Priority;
}

export interface RoleItem {
  roleName: string;
  rolePriority: Priority;
}

export interface SkillItem {
  skillName: string;
  skillPriority: Priority;
}

export interface NewJobFormValue {
  title: string;
  location: string;
  MinSalary: string;
  MaxSalary: string;

  // ✅ الـ fields الجديدة
  EducationDiscription: string;
  ExperienceDiscription: string;
  TechnicalSkillDiscription: string;
  JobDiscription: string;

  department: string;
  employmentType: string;
  GPA: string;
  GPAPriority: Priority;
  ExperienceMinYears: string;
  ExperienceMaxYears: string;
  ExperiencePriority: Priority;
  degrees: DegreeItem[];
  roles: RoleItem[];
  skills: SkillItem[];
}

// ===== Component =====

@Component({
  selector: 'app-create-job-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './create-job.html',
  styleUrl: './create-job.css'
})
export class CreateJobPage {

  // ===== Services =====
  private jobService = inject(JobService);
  private authService = inject(AuthService);
  private toastService = inject(ToastService);
  private router = inject(Router);

  // ===== Dropdowns Data =====
  departments = ['Engineering', 'Product', 'Design', 'Marketing', 'Sales', 'HR'];
  EmploymentType = ['FullTime', 'PartTime', 'Contract', 'Internship'];
  PriorityS: Priority[] = ['High', 'Medium', 'Low', 'None'];

  // ===== Form =====
  newJobForm: FormGroup = new FormGroup({
    title: new FormControl('', Validators.required),
    location: new FormControl('', Validators.required),
    MinSalary: new FormControl('', Validators.required),
    MaxSalary: new FormControl('', Validators.required),

    EducationDiscription: new FormControl('', Validators.required),
    ExperienceDiscription: new FormControl('', Validators.required),
    TechnicalSkillDiscription: new FormControl('', Validators.required),
    JobDiscription: new FormControl('', Validators.required),

    department: new FormControl('', Validators.required),
    employmentType: new FormControl('', Validators.required),
    GPA: new FormControl('', [Validators.required, Validators.min(0), Validators.max(4)]),
    GPAPriority: new FormControl('', Validators.required),
    ExperienceMinYears: new FormControl('', Validators.required),
    ExperienceMaxYears: new FormControl('', Validators.required),
    ExperiencePriority: new FormControl('', Validators.required),
    degrees: new FormArray([]),
    roles: new FormArray([]),
    skills: new FormArray([])
  });

  // ===== Getters =====

  get title() { return this.newJobForm.get('title'); }
  get location() { return this.newJobForm.get('location'); }
  get MinSalary() { return this.newJobForm.get('MinSalary'); }
  get MaxSalary() { return this.newJobForm.get('MaxSalary'); }

  // ✅ الـ getters الجديدة
  get EducationDiscription() { return this.newJobForm.get('EducationDiscription'); }
  get ExperienceDiscription() { return this.newJobForm.get('ExperienceDiscription'); }
  get TechnicalSkillDiscription() { return this.newJobForm.get('TechnicalSkillDiscription'); }
  get JobDiscription() { return this.newJobForm.get('JobDiscription'); }

  get department() { return this.newJobForm.get('department'); }
  get employmentType() { return this.newJobForm.get('employmentType'); }
  get GPA() { return this.newJobForm.get('GPA'); }
  get GPAPriority() { return this.newJobForm.get('GPAPriority'); }
  get ExperienceMinYears() { return this.newJobForm.get('ExperienceMinYears'); }
  get ExperienceMaxYears() { return this.newJobForm.get('ExperienceMaxYears'); }
  get ExperiencePriority() { return this.newJobForm.get('ExperiencePriority'); }

  get degrees() { return this.newJobForm.get('degrees') as FormArray; }
  get roles() { return this.newJobForm.get('roles') as FormArray; }
  get skills() { return this.newJobForm.get('skills') as FormArray; }

  // ===== Degrees Methods =====

  addDegree() {
    this.degrees.push(
      new FormGroup({
        degreeName: new FormControl('', Validators.required),
        degreePriority: new FormControl('', Validators.required)
      })
    );
  }

  removeDegree(index: number) {
    this.degrees.removeAt(index);
  }

  // ===== Roles Methods =====

  addRole() {
    this.roles.push(
      new FormGroup({
        roleName: new FormControl('', Validators.required),
        rolePriority: new FormControl('', Validators.required)
      })
    );
  }

  removeRole(index: number) {
    this.roles.removeAt(index);
  }

  // ===== Skills Methods =====

  addSkill() {
    this.skills.push(
      new FormGroup({
        skillName: new FormControl('', Validators.required),
        skillPriority: new FormControl('', Validators.required)
      })
    );
  }

  removeSkill(index: number) {
    this.skills.removeAt(index);
  }

  // ===== Submit =====

  onSubmit() {
    if (this.newJobForm.invalid) {
      this.newJobForm.markAllAsTouched();
      this.toastService.error('Please fill in all required fields before publishing.');
      return;
    }

    const formValue = this.newJobForm.value as NewJobFormValue;
    
    // Combine salary min and max into a salaryRange
    let salaryRangeStr = '';
    if (formValue.MinSalary && formValue.MaxSalary) {
      salaryRangeStr = `USD ${formValue.MinSalary}-${formValue.MaxSalary}`;
    } else if (formValue.MinSalary) {
      salaryRangeStr = `USD ${formValue.MinSalary}+`;
    } else if (formValue.MaxSalary) {
      salaryRangeStr = `Up to USD ${formValue.MaxSalary}`;
    }

    const payload = {
      title: formValue.title,
      description: formValue.JobDiscription,
      requirements: formValue.TechnicalSkillDiscription, // Map TechnicalSkillDiscription as primary requirements
      salaryRange: salaryRangeStr || undefined,
      location: formValue.location || undefined,
      employmentType: formValue.employmentType || 'FullTime',
      department: formValue.department || undefined,
      gpa: formValue.GPA ? parseFloat(formValue.GPA) : undefined,
      gpaPriority: formValue.GPAPriority || undefined,
      experienceMinYears: formValue.ExperienceMinYears ? parseInt(formValue.ExperienceMinYears, 10) : undefined,
      experienceMaxYears: formValue.ExperienceMaxYears ? parseInt(formValue.ExperienceMaxYears, 10) : undefined,
      experiencePriority: formValue.ExperiencePriority || undefined,
      degrees: formValue.degrees?.length ? formValue.degrees : undefined,
      roles: formValue.roles?.length ? formValue.roles : undefined,
      skills: formValue.skills?.length ? formValue.skills : undefined,
      companyId: this.authService.getCompanyId() || 1,
      isActive: true
    };

    this.jobService.createJob(payload).subscribe({
      next: (response) => {
        console.log('Job created successfully', response);
        this.toastService.success('Job published successfully!');
        this.router.navigate(['/recruiter/jobs']);
      },
      error: (err) => {
        console.error('Error creating job:', err);
        const serverMsg = err?.error?.title || err?.error?.message || 'Failed to create job.';
        this.toastService.error(serverMsg);
      }
    });
  }

}
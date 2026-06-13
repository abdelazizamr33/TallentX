import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CompanyService } from '../../core/services/company.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { InviteCodeDto } from '../../core/models/company.models';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-company-settings-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './company-settings.html',
})
export class CompanySettingsPage implements OnInit {
  private companyService = inject(CompanyService);
  private authService = inject(AuthService);
  private toast = inject(ToastService);

  inviteCodes = signal<InviteCodeDto[]>([]);
  isLoadingCodes = signal<boolean>(false);
  isGenerating = signal<boolean>(false);
  showGenerateForm = signal<boolean>(false);

  // Company Details
  companyName = signal<string>('');
  companyIndustry = signal<string>('');
  companyWebsite = signal<string>('');
  companyDescription = signal<string>('');
  companyLogoUrl = signal<string | null>(null);
  selectedLogoFile = signal<File | null>(null);

  isAdmin = signal<boolean>(false);
  isSaving = signal<boolean>(false);

  // Form fields for generating new code
  maxUses = signal<number>(5);
  validDays = signal<number>(30);

  ngOnInit(): void {
    const recruiterRole = this.authService.getRecruiterRole();
    const globalRole = this.authService.getRole();
    
    // Check if any of the role claims indicate admin
    this.isAdmin.set(
      recruiterRole === 'Admin' || 
      recruiterRole === 'admin' || 
      globalRole === 'Admin' || 
      globalRole === 'admin'
    );
    
    this.loadInviteCodes();
  }

  loadInviteCodes(): void {
    const companyId = this.authService.getCompanyId();
    if (!companyId) return;

    this.isLoadingCodes.set(true);
    this.companyService.getInviteCodes(companyId).subscribe({
      next: (codes) => {
        this.inviteCodes.set(codes || []);
        this.isLoadingCodes.set(false);
      },
      error: () => {
        this.toast.error('Failed to load invite codes');
        this.isLoadingCodes.set(false);
      }
    });

    this.companyService.getCompany(companyId).subscribe({
      next: (company) => {
        if (company) {
          this.companyName.set(company.name || '');
          this.companyIndustry.set(company.industry || '');
          this.companyWebsite.set(company.website || '');
          this.companyDescription.set(company.description || '');
          
          let logo = company.logoPath || null;
          if (logo && !logo.startsWith('http')) {
            logo = environment.baseUrl + '/' + logo.replace(/^\//, '');
          }
          this.companyLogoUrl.set(logo);
          
          // Fallback check: If the logged-in user is the recorded admin of the company
          const currentUserId = this.authService.getUserId();
          if (currentUserId && company.adminId === currentUserId) {
            this.isAdmin.set(true);
          }
        }
      }
    });
  }

  saveCompanyDetails(): void {
    if (!this.isAdmin()) return;
    
    const companyId = this.authService.getCompanyId();
    if (!companyId) return;

    let finalWebsite = this.companyWebsite()?.trim() || '';
    if (finalWebsite && !finalWebsite.startsWith('http://') && !finalWebsite.startsWith('https://')) {
      finalWebsite = 'https://' + finalWebsite;
    }

    this.isSaving.set(true);
    this.companyService.updateCompany(companyId, {
      name: this.companyName(),
      industry: this.companyIndustry(),
      website: finalWebsite,
      description: this.companyDescription()
    }).subscribe({
      next: (updatedCompany) => {
        const file = this.selectedLogoFile();
        if (file) {
          this.companyService.updateCompanyLogo(companyId, file).subscribe({
            next: (res) => {
              let logoPath = res.picturePath;
              if (logoPath && !logoPath.startsWith('http')) {
                logoPath = environment.baseUrl + '/' + logoPath.replace(/^\//, '');
              }
              this.companyLogoUrl.set(logoPath);
              this.selectedLogoFile.set(null);
              this.finalizeSave(updatedCompany);
            },
            error: () => {
              this.toast.error('Company details updated, but failed to upload logo');
              this.isSaving.set(false);
            }
          });
        } else {
          this.finalizeSave(updatedCompany);
        }
      },
      error: () => {
        this.toast.error('Failed to update company details');
        this.isSaving.set(false);
      }
    });
  }

  private finalizeSave(updatedCompany: any): void {
    this.companyName.set(updatedCompany.name);
    this.companyIndustry.set(updatedCompany.industry);
    this.companyWebsite.set(updatedCompany.website || '');
    this.companyDescription.set(updatedCompany.description || '');
    this.toast.success('Company details updated successfully');
    this.isSaving.set(false);
  }

  onLogoSelected(event: any): void {
    if (!this.isAdmin()) return;
    
    const file = event.target.files[0] as File;
    if (file) {
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
      if (!allowedTypes.includes(file.type)) {
        this.toast.error('Only JPG and PNG files are allowed');
        return;
      }
      
      // Validate file size (5MB max)
      const maxSize = 5 * 1024 * 1024;
      if (file.size > maxSize) {
        this.toast.error('Image size must be less than 5MB');
        return;
      }

      this.selectedLogoFile.set(file);
      
      // Create a preview
      const reader = new FileReader();
      reader.onload = (e) => {
        this.companyLogoUrl.set(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  }

  generateNewCode(): void {
    const companyId = this.authService.getCompanyId();
    if (!companyId) return;

    if (this.maxUses() <= 0 || this.validDays() <= 0) {
      this.toast.error('Please enter valid values');
      return;
    }

    this.isGenerating.set(true);
    this.companyService.generateInviteCode(companyId, {
      maxUses: this.maxUses(),
      validDaysFromNow: this.validDays()
    }).subscribe({
      next: (response) => {
        this.toast.success(`Code generated: ${response.code}`);
        this.maxUses.set(5);
        this.validDays.set(30);
        this.showGenerateForm.set(false);
        this.isGenerating.set(false);
        this.loadInviteCodes(); // Reload the list
      },
      error: () => {
        this.toast.error('Failed to generate invite code');
        this.isGenerating.set(false);
      }
    });
  }

  revokeCode(codeId: number): void {
    const companyId = this.authService.getCompanyId();
    if (!companyId) return;

    if (!confirm('Are you sure you want to revoke this invite code?')) return;

    this.companyService.revokeInviteCode(companyId, codeId).subscribe({
      next: () => {
        this.toast.success('Invite code revoked');
        this.loadInviteCodes();
      },
      error: () => {
        this.toast.error('Failed to revoke invite code');
      }
    });
  }

  copyToClipboard(code: string): void {
    navigator.clipboard.writeText(code).then(() => {
      this.toast.success('Code copied to clipboard');
    }).catch(() => {
      this.toast.error('Failed to copy code');
    });
  }

  isCodeExpired(expiresAt: string): boolean {
    return new Date(expiresAt) < new Date();
  }

  isCodeExhausted(code: InviteCodeDto): boolean {
    return code.currentUses >= code.maxUses;
  }

  getDaysUntilExpiry(expiresAt: string): number {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diff = expiry.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString();
  }
}

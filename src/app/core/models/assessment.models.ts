export interface AssessmentDetailDto {
  id: number;
  jobPostId?: number;
  jobPostingId?: number; // legacy compatibility
  title: string;
  description?: string;
  type?: string;
  timeLimitMinutes?: number;
  totalScore?: number;
  passingScore?: number;
  isAiGenerated?: boolean;
  isActive?: boolean;
  createdAt?: string;
  questions: QuestionDto[];
}

export interface QuestionDto {
  id: number;
  text: string;
  type?: string;
  options: string[] | string | any;
  correctOptionIndex?: number;
  points?: number;
  orderIndex?: number;
}

export interface CandidateAssessmentDto {
  id: number;
  candidateId: string;
  assessmentId: number;
  jobApplicationId: number;
  answers?: string;
  score?: number;
  startedAt?: string;
  submittedAt?: string;
  isCompleted: boolean;
  assessment: AssessmentDetailDto;
}

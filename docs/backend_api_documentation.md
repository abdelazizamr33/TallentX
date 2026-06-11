# 📘 IES API Documentation

**Base URL**: `https://ies.runasp.net`  
**Version**: v1  
**Swagger**: `https://ies.runasp.net/swagger`

---

## Table of Contents

- [🔐 Auth](#-auth)
- [👤 Candidates](#-candidates)
- [🏢 Company](#-company)
- [📋 Job Posting](#-job-posting)
- [📝 Job Application](#-job-application)
- [🎤 Interview](#-interview)
- [🛠 Skills](#-skills)
- [🎓 Education](#-education)
- [💼 Experience](#-experience)
- [📝 Assessments](#-assessments)
- [💬 Messages](#-messages)
- [🔔 Notifications](#-notifications)
- [📊 Analytics](#-analytics)
- [📈 Dashboards](#-dashboards)
- [📜 Activity Logs](#-activity-logs)
- [🤖 TalentX Webhook](#-talentx-webhook)

---

## 🔐 Auth

**Base Route**: `/api/Auth`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/register` | ❌ | Register a new candidate |
| `POST` | `/register/company` | ❌ | Register a new company |
| `POST` | `/register/recruiter` | ❌ | Register a recruiter (with invite code) |
| `POST` | `/login` | ❌ | Login and get JWT token |
| `POST` | `/logout` | ✅ | Logout current user |
| `POST` | `/forgot-password` | ❌ | Request password reset email |
| `POST` | `/reset-password` | ❌ | Reset password with token |
| `POST` | `/change-password` | ✅ | Change password (authenticated) |

### POST `/api/Auth/login`
```json
{
  "email": "user@example.com",
  "password": "Password123!"
}
```
**Response** `200`:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "...",
  "userId": "guid",
  "email": "user@example.com",
  "roles": ["Candidate"]
}
```

### POST `/api/Auth/register`
```json
{
  "email": "user@example.com",
  "password": "Password123!",
  "firstName": "Ahmed",
  "lastName": "Ali",
  "phoneNumber": "01012345678"
}
```

---

## 👤 Candidates

**Base Route**: `/api/Candidates`  
**Auth**: ✅ Required (all endpoints)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/profile` | Get current candidate profile |
| `PUT` | `/profile` | Update candidate profile |
| `PUT` | `/skills` | Update candidate skills |
| `POST` | `/resume` | Upload resume (multipart/form-data) |
| `DELETE` | `/resume/{resumeId}` | Delete a resume |
| `PUT` | `/profile-picture` | Upload/update profile picture |
| `GET` | `/applications` | Get candidate's job applications |
| `GET` | `/saved-jobs` | Get saved/bookmarked jobs |
| `POST` | `/saved-jobs/{jobPostId}` | Save/bookmark a job |

---

## 🏢 Company

**Base Route**: `/api/Company`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/` | ❌ | Get all companies (paginated) with active job counts |
| `POST` | `/` | ❌ | Create a new company (multipart/form-data) |
| `GET` | `/{companyId}` | ✅ | Get company profile |
| `PUT` | `/{companyId}` | ✅ Admin | Update company info |
| `POST` | `/{companyId}/transfer-admin` | ✅ Admin | Transfer admin role |
| `GET` | `/{companyId}/active-invitations-count` | ✅ Admin | Get active invite codes count |
| `POST` | `/{companyId}/invite-codes` | ✅ Admin | Generate invite code |
| `GET` | `/{companyId}/invite-codes` | ✅ Admin | List active invite codes |
| `DELETE` | `/{companyId}/invite-codes/{codeId}` | ✅ Admin | Revoke an invite code |

### GET `/api/Company`
**Query Parameters**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `pageNumber` | int | 1 | Page number |
| `pageSize` | int | 20 | Items per page |

**Response** `200`:
```json
[
  {
    "id": "1",
    "name": "TechCorp",
    "taxNumber": "123456",
    "industry": "Technology",
    "website": "https://techcorp.com",
    "description": "A tech company",
    "logoPath": null,
    "activeJobPostsCount": 5,
    "recruiterCount": 3,
    "adminId": "guid",
    "adminName": "Ahmed Ali",
    "createdAt": "2026-01-01T00:00:00Z"
  }
]
```

---

## 📋 Job Posting

**Base Route**: `/api/JobPosting`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/` | ❌ | Get all active job postings (paginated) |
| `GET` | `/{id}` | ❌ | Get job posting details |
| `GET` | `/company/{companyId}` | ✅ | Get company's job postings |
| `POST` | `/` | ✅ Recruiter | Create a new job posting |
| `PUT` | `/{id}` | ✅ Recruiter | Update a job posting |
| `DELETE` | `/{id}` | ✅ Recruiter | Delete a job posting |
| `GET` | `/search/{searchTerm}` | ❌ | Search jobs by keyword |
| `GET` | `/skill/{skillId}` | ❌ | Get jobs by skill |
| `GET` | `/type/{employmentType}` | ❌ | Get jobs by employment type |

### GET `/api/JobPosting`
**Query Parameters**:
| Param | Type | Default |
|-------|------|---------|
| `pageNumber` | int | 1 |
| `pageSize` | int | 20 |

### POST `/api/JobPosting` — Create Job
```json
{
  "title": "Senior .NET Developer",
  "description": "Looking for experienced .NET developer",
  "requirements": "C#, ASP.NET Core",
  "salaryRange": "15000-25000 EGP",
  "location": "Cairo, Egypt",
  "applicationDeadline": "2026-08-01T00:00:00Z",
  "department": "Engineering",
  "employmentType": "FullTime",
  "gpa": 2.5,
  "gpaPriority": "Low",
  "experienceMinYears": 3,
  "experienceMaxYears": 7,
  "experiencePriority": "High",
  "degrees": [
    { "degreeName": "Bachelor of CS", "degreePriority": "High" }
  ],
  "roles": [
    { "roleName": "Backend Developer", "rolePriority": "High" }
  ],
  "skills": [
    { "skillName": "C#", "skillPriority": "High" },
    { "skillName": "ASP.NET Core", "skillPriority": "Medium" }
  ]
}
```

**Response** `201`:
```json
{
  "id": 15,
  "title": "Senior .NET Developer",
  "description": "...",
  "department": "Engineering",
  "employmentType": "FullTime",
  "gpa": 2.5,
  "gpaPriority": "Low",
  "experienceMinYears": 3,
  "experienceMaxYears": 7,
  "experiencePriority": "High",
  "degrees": [{ "degreeName": "Bachelor of CS", "degreePriority": "High" }],
  "roles": [{ "roleName": "Backend Developer", "rolePriority": "High" }],
  "skills": [{ "skillName": "C#", "skillPriority": "High" }],
  "companyId": 1,
  "companyName": "TechCorp",
  "isActive": true,
  "requiredSkills": ["c#", "asp.net core"],
  "applicationCount": 0,
  "createdAt": "2026-06-07T00:00:00Z"
}
```

> **Priority Values**: `"None"`, `"Low"`, `"Medium"`, `"High"`  
> **Employment Types**: `"FullTime"`, `"PartTime"`, `"Contract"`, `"Internship"`

---

## 📝 Job Application

**Base Route**: `/api/JobApplication`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/apply` | ✅ Candidate | Apply for a job |
| `GET` | `/{id}` | ✅ | Get application details |
| `GET` | `/candidate/{candidateId}` | ✅ | Get candidate's applications |
| `GET` | `/job/{jobPostId}` | ✅ Recruiter | Get applications for a job |
| `GET` | `/job/{jobPostId}/export` | ✅ Recruiter | Export applications |
| `GET` | `/job/{jobPostId}/status/{status}` | ✅ Recruiter | Filter by status |
| `GET` | `/check/{candidateId}/{jobPostId}` | ✅ | Check if already applied |
| `PUT` | `/{id}/status` | ✅ Recruiter | Update application status |
| `DELETE` | `/{id}/withdraw` | ✅ Candidate | Withdraw application |

### POST `/api/JobApplication/apply`
```json
{
  "jobPostId": 7,
  "resumeId": 3,
  "coverLetter": "I am excited to apply..."
}
```

---

## 🎤 Interview

**Base Route**: `/api/Interview`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/schedule` | ✅ Recruiter | Schedule a new interview |
| `GET` | `/{id}` | ✅ | Get interview details |
| `GET` | `/application/{applicationId}` | ✅ | Get interviews for an application |
| `GET` | `/candidate/{candidateId}` | ✅ | Get candidate's interviews |
| `GET` | `/recruiter/interviews` | ✅ Recruiter | Get recruiter's interviews |
| `GET` | `/status/{status}` | ✅ Recruiter | Get interviews by status |
| `PUT` | `/{id}` | ✅ Recruiter | Update interview |
| `DELETE` | `/{id}/cancel` | ✅ Recruiter | Cancel interview |

### POST `/api/Interview/schedule`
```json
{
  "jobApplicationId": 2,
  "interviewType": "Live",
  "scheduledAt": "2026-06-15T14:00:00Z",
  "durationMinutes": 45,
  "meetingLink": "https://meet.google.com/abc-defg-hij",
  "aiQuestions": ""
}
```

> **Interview Types**: `"AI"`, `"Live"`  
> **Status Values**: `"Scheduled"`, `"InProgress"`, `"Completed"`, `"Cancelled"`

### PUT `/api/Interview/{id}` — Update/Complete
```json
{
  "status": "Completed",
  "score": 85,
  "meetingLink": null,
  "aiTranscript": "Interview transcript...",
  "feedbackNotes": "Strong candidate"
}
```

---

## 🛠 Skills

**Base Route**: `/api/Skill`  
**Auth**: ✅ Required (all endpoints)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Get all candidate skills |
| `GET` | `/{skillId}` | Get a specific skill |
| `POST` | `/` | Add a new skill |
| `PUT` | `/{skillId}` | Update skill level |
| `DELETE` | `/{skillId}` | Remove a skill |
| `GET` | `/level/{level}` | Get skills by level |

---

## 🎓 Education

**Base Route**: `/api/Education`  
**Auth**: ✅ Required (all endpoints)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Get all education records |
| `GET` | `/{educationId}` | Get specific education |
| `POST` | `/` | Add education |
| `PUT` | `/{educationId}` | Update education |
| `DELETE` | `/{educationId}` | Delete education |

---

## 💼 Experience

**Base Route**: `/api/Experience`  
**Auth**: ✅ Required (all endpoints)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Get all experience records |
| `GET` | `/{experienceId}` | Get specific experience |
| `POST` | `/` | Add experience |
| `PUT` | `/{experienceId}` | Update experience |
| `DELETE` | `/{experienceId}` | Delete experience |

---

## 📝 Assessments

**Base Route**: `/api/Assessments`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/` | ✅ Recruiter | Create assessment |
| `GET` | `/{id}` | ✅ | Get assessment details |
| `GET` | `/job/{jobPostId}` | ✅ | Get assessments for a job |
| `POST` | `/{id}/start` | ✅ Candidate | Start an assessment |
| `POST` | `/{id}/submit` | ✅ Candidate | Submit assessment answers |
| `GET` | `/my-assessments` | ✅ Candidate | Get my assessments |

---

## 💬 Messages

**Base Route**: `/api/Messages`  
**Auth**: ✅ Required (all endpoints)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/send` | Send a message |
| `GET` | `/conversation/{userId}` | Get conversation with a user |
| `GET` | `/conversations` | Get all conversations |
| `GET` | `/unread-count` | Get unread messages count |
| `PATCH` | `/{id}/mark-read` | Mark message as read |

---

## 🔔 Notifications

**Base Route**: `/api/Notifications`  
**Auth**: ✅ Required (all endpoints)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Get all notifications |
| `GET` | `/unread-count` | Get unread count |
| `PATCH` | `/{id}/mark-read` | Mark as read |
| `PATCH` | `/read-all` | Mark all as read |

---

## 📊 Analytics

**Base Route**: `/api/Analytics`  
**Auth**: ✅ Required

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/company/{companyId}` | Company analytics (jobs, applications, etc.) |
| `GET` | `/candidate` | Candidate analytics |

---

## 📈 Dashboards

**Base Route**: `/api/Dashboards`  
**Auth**: ✅ Required

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/candidate` | Candidate dashboard data |
| `GET` | `/company/{companyId}` | Company dashboard data |

---

## 📜 Activity Logs

**Base Route**: `/api/ActivityLogs`  
**Auth**: ✅ Required

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Get activity logs |

---

## 🤖 TalentX Webhook

**Base Route**: `/api/webhooks/talentx`  
**Auth**: ❌ Not required

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/scoring` | Receive AI scoring results from TalentX |

### POST `/api/webhooks/talentx/scoring`
```json
{
  "candidate_id": "4423",
  "job_id": 7,
  "status": "completed",
  "final_score": 89.5,
  "fit_status": "fit",
  "raw_resume_data": {
    "name": "Ali Ahmed",
    "email": "ali@test.com",
    "skills": ["C#", "ASP.NET Core"]
  },
  "matching_details": {
    "skills": { "score": 0.93, "matched": ["C#"] }
  },
  "error_message": null,
  "idempotency_key": "talentx-match-4423-7-2026-05-24"
}
```

---

## 🔑 Authentication

All protected endpoints require a **JWT Bearer Token** in the `Authorization` header:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

To obtain a token, use `POST /api/Auth/login`.

## ⚠️ Error Responses

All endpoints may return:

| Code | Description |
|------|-------------|
| `400` | Bad Request — validation errors |
| `401` | Unauthorized — missing or invalid token |
| `403` | Forbidden — insufficient permissions |
| `404` | Not Found — resource doesn't exist |
| `500` | Internal Server Error |

Error format:
```json
{
  "message": "Error description"
}
```

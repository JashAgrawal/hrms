# Attendance Absence Automation

## Overview
Automatically marks employees as absent if they don't check out by 12 PM (end of day).

## How It Works
1. **Cutoff Time**: 12:00 PM (noon)
2. **Eligibility**: Employees who checked in but haven't checked out by 12 PM
3. **Action**: Status changed to `ABSENT` with audit log

## Usage

### Admin Interface
1. Go to **Dashboard > Attendance > Admin** tab
2. Select target date
3. Click **"Preview Eligible Employees"**
4. Review and click **"Mark X Employees as Absent"**

### API Endpoints
```bash
# Preview
GET /api/admin/attendance/mark-absent?targetDate=2024-01-01T00:00:00.000Z

# Execute
POST /api/admin/attendance/mark-absent
{
  "targetDate": "2024-01-01T00:00:00.000Z",
  "employeeId": "optional-single-employee-id",
  "reason": "optional-custom-reason"
}
```

### Automated Execution
Set up a cron job to run daily after the cutoff time. Default is 6:05 PM:
```bash
5 18 * * * curl -X POST "https://your-domain.com/api/admin/attendance/mark-absent"
```

## Permissions
- Only `ADMIN` and `HR` roles can access this functionality

## Files
- `lib/jobs/attendance-absence-scheduler.ts` - Core logic
- `app/api/admin/attendance/mark-absent/route.ts` - API endpoints  
- `components/admin/attendance-absence-manager.tsx` - UI component
- `lib/jobs/__tests__/attendance-absence-scheduler.test.ts` - Tests

## Configuration

### Environment Variables
Configure the attendance cutoff time using environment variables:

```env
# Attendance cutoff time (24-hour format)
ATTENDANCE_CUTOFF_HOUR=18    # Default: 18 (6:00 PM)
ATTENDANCE_CUTOFF_MINUTE=0   # Default: 0 (on the hour)
```

### Cron Job Schedule
Update your cron job to run after the configured cutoff time:
```bash
# For 6:00 PM cutoff, run at 6:05 PM
5 18 * * * curl -X POST "https://your-domain.com/api/admin/attendance/mark-absent"

# For custom cutoff time, adjust accordingly
```

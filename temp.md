i am sending this message for nth time so some of the things are already there use them if possible. 
if the task is already complete then recheck it if everything is complete and works properly whole flow .
make sure everything just works right and works together this time .
Every single thing listed in this 

---

### 1 — Location-based attendance

* In **employee add/edit/details section**, HR/Admin can assign up to 5 allowed locations per employee (custom or office).
* Each location has radius.
* Employee can only check-in if inside radius.
* If outside, request goes to manager → if not set then HR → for approval.

---

### 2 — Onboarding

* Fix current broken flow.
* Make steps configurable by HR/Admin.
* Must track completion status per employee.

---

### 3 — Notifications (Emails)

* Trigger mails to employee, manager, HR on key actions:

  * Leave request sent / approved / rejected
  * Attendance request sent / approved / rejected
  * Expense request sent / approved / rejected
  * Onboarding steps completed
* Emails should be automatic and role-aware.

---

### 4 — Salary structure

* Enable creating salary components (basic, hra, etc).
* Build full salary structure using these components.
* Link salary structure to employees.
* Ensure salary structure shows in employee profile.

---

### 5 — Large selections

* Replace normal dropdown selects with searchable command select (for employees, managers, etc).

---

### 6 — Field employees petrol expense

* Employees marked as FIELD get extra “Check in to site” button.
* Track sequence of locations from check-in → site1 → site2 … → checkout.
* Calculate distance using Google Distance API.
* Total distance × admin-set rate = daily petrol expense.
* Show daily travel and expense preview to employee.
* At month end, auto-generate reimbursement request in Expenses module.
* Expenses module must support attachments/bills and approval flow.
* Keep separate from payroll.

---
### 7 — RBAC

* Apply proper role-based access on pages and components.
* Hide admin/HR pages (like leave policy, salary setup, etc.) from employees.
* Only show pages allowed for that user role.
* Eg:- Only Hr/admin can create leave policies but i can still do it when i login as employee this should'nt be the case

---
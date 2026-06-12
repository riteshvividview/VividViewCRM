| schemaname | tablename             | policyname                                       | permissive | roles          | cmd    |
| ---------- | --------------------- | ------------------------------------------------ | ---------- | -------------- | ------ |
| public     | calendar_events       | Workspace members can manage calendar events     | PERMISSIVE | {public}       | ALL    |
| public     | campaigns             | Workspace members can manage campaigns           | PERMISSIVE | {public}       | ALL    |
| public     | contacts              | Workspace members can manage contacts            | PERMISSIVE | {public}       | ALL    |
| public     | deal_activities       | Workspace members can manage deal activities     | PERMISSIVE | {public}       | ALL    |
| public     | deals                 | Workspace members can manage deals               | PERMISSIVE | {public}       | ALL    |
| public     | documents             | Workspace members can manage documents           | PERMISSIVE | {public}       | ALL    |
| public     | email_accounts        | Workspace members can manage email accounts      | PERMISSIVE | {public}       | ALL    |
| public     | email_templates       | Workspace members can manage email templates     | PERMISSIVE | {public}       | ALL    |
| public     | hr_attendance         | hr_attendance_isolation                          | PERMISSIVE | {public}       | ALL    |
| public     | hr_departments        | hr_departments_isolation                         | PERMISSIVE | {public}       | ALL    |
| public     | hr_employees          | hr_employees_isolation                           | PERMISSIVE | {public}       | ALL    |
| public     | hr_leave_applications | hr_leave_applications_isolation                  | PERMISSIVE | {public}       | ALL    |
| public     | hr_leave_balances     | hr_leave_balances_isolation                      | PERMISSIVE | {public}       | ALL    |
| public     | hr_leave_types        | hr_leave_types_isolation                         | PERMISSIVE | {public}       | ALL    |
| public     | hr_payroll_runs       | hr_payroll_runs_isolation                        | PERMISSIVE | {public}       | ALL    |
| public     | hr_payslips           | hr_payslips_isolation                            | PERMISSIVE | {public}       | ALL    |
| public     | inv_settings          | inv_settings_isolation                           | PERMISSIVE | {public}       | ALL    |
| public     | invoice_items         | invoice_items_isolation                          | PERMISSIVE | {public}       | ALL    |
| public     | invoice_payments      | invoice_payments_isolation                       | PERMISSIVE | {public}       | ALL    |
| public     | invoices              | invoices_isolation                               | PERMISSIVE | {public}       | ALL    |
| public     | lead_activities       | Workspace members can manage lead activities     | PERMISSIVE | {public}       | ALL    |
| public     | leads                 | Workspace members can manage leads               | PERMISSIVE | {public}       | ALL    |
| public     | marketing_campaigns   | Workspace members can manage marketing campaigns | PERMISSIVE | {public}       | ALL    |
| public     | notifications         | Users can manage their own notifications         | PERMISSIVE | {public}       | ALL    |
| public     | otp_verifications     | service_role_all                                 | PERMISSIVE | {service_role} | ALL    |
| public     | profiles              | Users can update their own profile               | PERMISSIVE | {public}       | UPDATE |
| public     | profiles              | Users can view profiles in their workspace       | PERMISSIVE | {public}       | SELECT |
| public     | profiles              | Users can insert their own profile               | PERMISSIVE | {public}       | INSERT |
| public     | targets               | Workspace members can manage targets             | PERMISSIVE | {public}       | ALL    |
| public     | task_activity_log     | task_activity_log_workspace_isolation            | PERMISSIVE | {public}       | ALL    |
| public     | task_board_columns    | task_board_columns_workspace_isolation           | PERMISSIVE | {public}       | ALL    |
| public     | task_boards           | task_boards_workspace_isolation                  | PERMISSIVE | {public}       | ALL    |
| public     | task_comments         | task_comments_workspace_isolation                | PERMISSIVE | {public}       | ALL    |
| public     | task_labels           | task_labels_workspace_isolation                  | PERMISSIVE | {public}       | ALL    |
| public     | task_mentions         | task_mentions_workspace_isolation                | PERMISSIVE | {public}       | ALL    |
| public     | task_projects         | task_projects_workspace_isolation                | PERMISSIVE | {public}       | ALL    |
| public     | task_recurrence_rules | task_recurrence_rules_workspace_isolation        | PERMISSIVE | {public}       | ALL    |
| public     | task_sprints          | task_sprints_workspace_isolation                 | PERMISSIVE | {public}       | ALL    |
| public     | task_time_entries     | task_time_entries_workspace_isolation            | PERMISSIVE | {public}       | ALL    |
| public     | tasks                 | Users can manage their workspace tasks           | PERMISSIVE | {public}       | ALL    |
| public     | team_members          | Workspace members can view team memberships      | PERMISSIVE | {public}       | ALL    |
| public     | teams                 | Workspace members can manage teams               | PERMISSIVE | {public}       | ALL    |
| public     | territories           | Workspace members can manage territories         | PERMISSIVE | {public}       | ALL    |
| public     | workspaces            | Workspace members can view their workspace       | PERMISSIVE | {public}       | SELECT |
| public     | workspaces            | Workspace owner can update workspace             | PERMISSIVE | {public}       | UPDATE |
| storage    | objects               | Owner delete avatar                              | PERMISSIVE | {public}       | DELETE |
| storage    | objects               | Owner update avatar                              | PERMISSIVE | {public}       | UPDATE |
| storage    | objects               | Owner upload avatar                              | PERMISSIVE | {public}       | INSERT |
| storage    | objects               | Public read avatars                              | PERMISSIVE | {public}       | SELECT |
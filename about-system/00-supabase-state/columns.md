| table_schema | table_name             | column_name                  | data_type                | is_nullable | column_default                             |
| ------------ | ---------------------- | ---------------------------- | ------------------------ | ----------- | ------------------------------------------ |
| auth         | audit_log_entries      | instance_id                  | uuid                     | YES         | null                                       |
| auth         | audit_log_entries      | id                           | uuid                     | NO          | null                                       |
| auth         | audit_log_entries      | payload                      | json                     | YES         | null                                       |
| auth         | audit_log_entries      | created_at                   | timestamp with time zone | YES         | null                                       |
| auth         | audit_log_entries      | ip_address                   | character varying        | NO          | ''::character varying                      |
| auth         | custom_oauth_providers | id                           | uuid                     | NO          | gen_random_uuid()                          |
| auth         | custom_oauth_providers | provider_type                | text                     | NO          | null                                       |
| auth         | custom_oauth_providers | identifier                   | text                     | NO          | null                                       |
| auth         | custom_oauth_providers | name                         | text                     | NO          | null                                       |
| auth         | custom_oauth_providers | client_id                    | text                     | NO          | null                                       |
| auth         | custom_oauth_providers | client_secret                | text                     | NO          | null                                       |
| auth         | custom_oauth_providers | acceptable_client_ids        | ARRAY                    | NO          | '{}'::text[]                               |
| auth         | custom_oauth_providers | scopes                       | ARRAY                    | NO          | '{}'::text[]                               |
| auth         | custom_oauth_providers | pkce_enabled                 | boolean                  | NO          | true                                       |
| auth         | custom_oauth_providers | attribute_mapping            | jsonb                    | NO          | '{}'::jsonb                                |
| auth         | custom_oauth_providers | authorization_params         | jsonb                    | NO          | '{}'::jsonb                                |
| auth         | custom_oauth_providers | enabled                      | boolean                  | NO          | true                                       |
| auth         | custom_oauth_providers | email_optional               | boolean                  | NO          | false                                      |
| auth         | custom_oauth_providers | issuer                       | text                     | YES         | null                                       |
| auth         | custom_oauth_providers | discovery_url                | text                     | YES         | null                                       |
| auth         | custom_oauth_providers | skip_nonce_check             | boolean                  | NO          | false                                      |
| auth         | custom_oauth_providers | cached_discovery             | jsonb                    | YES         | null                                       |
| auth         | custom_oauth_providers | discovery_cached_at          | timestamp with time zone | YES         | null                                       |
| auth         | custom_oauth_providers | authorization_url            | text                     | YES         | null                                       |
| auth         | custom_oauth_providers | token_url                    | text                     | YES         | null                                       |
| auth         | custom_oauth_providers | userinfo_url                 | text                     | YES         | null                                       |
| auth         | custom_oauth_providers | jwks_uri                     | text                     | YES         | null                                       |
| auth         | custom_oauth_providers | created_at                   | timestamp with time zone | NO          | now()                                      |
| auth         | custom_oauth_providers | updated_at                   | timestamp with time zone | NO          | now()                                      |
| auth         | flow_state             | id                           | uuid                     | NO          | null                                       |
| auth         | flow_state             | user_id                      | uuid                     | YES         | null                                       |
| auth         | flow_state             | auth_code                    | text                     | YES         | null                                       |
| auth         | flow_state             | code_challenge_method        | USER-DEFINED             | YES         | null                                       |
| auth         | flow_state             | code_challenge               | text                     | YES         | null                                       |
| auth         | flow_state             | provider_type                | text                     | NO          | null                                       |
| auth         | flow_state             | provider_access_token        | text                     | YES         | null                                       |
| auth         | flow_state             | provider_refresh_token       | text                     | YES         | null                                       |
| auth         | flow_state             | created_at                   | timestamp with time zone | YES         | null                                       |
| auth         | flow_state             | updated_at                   | timestamp with time zone | YES         | null                                       |
| auth         | flow_state             | authentication_method        | text                     | NO          | null                                       |
| auth         | flow_state             | auth_code_issued_at          | timestamp with time zone | YES         | null                                       |
| auth         | flow_state             | invite_token                 | text                     | YES         | null                                       |
| auth         | flow_state             | referrer                     | text                     | YES         | null                                       |
| auth         | flow_state             | oauth_client_state_id        | uuid                     | YES         | null                                       |
| auth         | flow_state             | linking_target_id            | uuid                     | YES         | null                                       |
| auth         | flow_state             | email_optional               | boolean                  | NO          | false                                      |
| auth         | identities             | provider_id                  | text                     | NO          | null                                       |
| auth         | identities             | user_id                      | uuid                     | NO          | null                                       |
| auth         | identities             | identity_data                | jsonb                    | NO          | null                                       |
| auth         | identities             | provider                     | text                     | NO          | null                                       |
| auth         | identities             | last_sign_in_at              | timestamp with time zone | YES         | null                                       |
| auth         | identities             | created_at                   | timestamp with time zone | YES         | null                                       |
| auth         | identities             | updated_at                   | timestamp with time zone | YES         | null                                       |
| auth         | identities             | email                        | text                     | YES         | null                                       |
| auth         | identities             | id                           | uuid                     | NO          | gen_random_uuid()                          |
| auth         | instances              | id                           | uuid                     | NO          | null                                       |
| auth         | instances              | uuid                         | uuid                     | YES         | null                                       |
| auth         | instances              | raw_base_config              | text                     | YES         | null                                       |
| auth         | instances              | created_at                   | timestamp with time zone | YES         | null                                       |
| auth         | instances              | updated_at                   | timestamp with time zone | YES         | null                                       |
| auth         | mfa_amr_claims         | session_id                   | uuid                     | NO          | null                                       |
| auth         | mfa_amr_claims         | created_at                   | timestamp with time zone | NO          | null                                       |
| auth         | mfa_amr_claims         | updated_at                   | timestamp with time zone | NO          | null                                       |
| auth         | mfa_amr_claims         | authentication_method        | text                     | NO          | null                                       |
| auth         | mfa_amr_claims         | id                           | uuid                     | NO          | null                                       |
| auth         | mfa_challenges         | id                           | uuid                     | NO          | null                                       |
| auth         | mfa_challenges         | factor_id                    | uuid                     | NO          | null                                       |
| auth         | mfa_challenges         | created_at                   | timestamp with time zone | NO          | null                                       |
| auth         | mfa_challenges         | verified_at                  | timestamp with time zone | YES         | null                                       |
| auth         | mfa_challenges         | ip_address                   | inet                     | NO          | null                                       |
| auth         | mfa_challenges         | otp_code                     | text                     | YES         | null                                       |
| auth         | mfa_challenges         | web_authn_session_data       | jsonb                    | YES         | null                                       |
| auth         | mfa_factors            | id                           | uuid                     | NO          | null                                       |
| auth         | mfa_factors            | user_id                      | uuid                     | NO          | null                                       |
| auth         | mfa_factors            | friendly_name                | text                     | YES         | null                                       |
| auth         | mfa_factors            | factor_type                  | USER-DEFINED             | NO          | null                                       |
| auth         | mfa_factors            | status                       | USER-DEFINED             | NO          | null                                       |
| auth         | mfa_factors            | created_at                   | timestamp with time zone | NO          | null                                       |
| auth         | mfa_factors            | updated_at                   | timestamp with time zone | NO          | null                                       |
| auth         | mfa_factors            | secret                       | text                     | YES         | null                                       |
| auth         | mfa_factors            | phone                        | text                     | YES         | null                                       |
| auth         | mfa_factors            | last_challenged_at           | timestamp with time zone | YES         | null                                       |
| auth         | mfa_factors            | web_authn_credential         | jsonb                    | YES         | null                                       |
| auth         | mfa_factors            | web_authn_aaguid             | uuid                     | YES         | null                                       |
| auth         | mfa_factors            | last_webauthn_challenge_data | jsonb                    | YES         | null                                       |
| auth         | oauth_authorizations   | id                           | uuid                     | NO          | null                                       |
| auth         | oauth_authorizations   | authorization_id             | text                     | NO          | null                                       |
| auth         | oauth_authorizations   | client_id                    | uuid                     | NO          | null                                       |
| auth         | oauth_authorizations   | user_id                      | uuid                     | YES         | null                                       |
| auth         | oauth_authorizations   | redirect_uri                 | text                     | NO          | null                                       |
| auth         | oauth_authorizations   | scope                        | text                     | NO          | null                                       |
| auth         | oauth_authorizations   | state                        | text                     | YES         | null                                       |
| auth         | oauth_authorizations   | resource                     | text                     | YES         | null                                       |
| auth         | oauth_authorizations   | code_challenge               | text                     | YES         | null                                       |
| auth         | oauth_authorizations   | code_challenge_method        | USER-DEFINED             | YES         | null                                       |
| auth         | oauth_authorizations   | response_type                | USER-DEFINED             | NO          | 'code'::auth.oauth_response_type           |
| auth         | oauth_authorizations   | status                       | USER-DEFINED             | NO          | 'pending'::auth.oauth_authorization_status |
| auth         | oauth_authorizations   | authorization_code           | text                     | YES         | null                                       |
| auth         | oauth_authorizations   | created_at                   | timestamp with time zone | NO          | now()                                      |
| auth         | oauth_authorizations   | expires_at                   | timestamp with time zone | NO          | (now() + '00:03:00'::interval)             |
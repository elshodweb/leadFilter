# Authentication transition

This change needs deployment coordination. It does not migrate existing accounts automatically.

1. Set distinct, randomly generated JWT secrets of at least 32 characters. The application now refuses to start with missing, short, or identical secrets. Rotate previously shared or default secrets; rotation invalidates existing JWTs.
2. Review existing `ADMIN` accounts. That role has access across organizations. Public registration previously assigned it, so legitimate organization membership alone is not enough to trust an existing administrator.
3. `POST /auth/register` now requires an active global administrator. The frontend's anonymous registration screen must be removed or changed before rollout. Organization owners are not given global administration through a new role interpretation.
4. Refresh tokens now use a SHA-256 digest before bcrypt and a unique JWT ID. Existing stored hashes will not match the new format; users must log in again. Only one concurrent refresh can replace a stored token. The frontend should serialize refresh attempts.
5. Demo seeding is opt-in for local development and disabled in production, including the standalone seed command. Existing demo accounts and data are not removed. Verify a trusted administrator exists before rollout; this patch does not add a production bootstrap command.

Access tokens default to 15 minutes. Set `JWT_ACCESS_EXPIRES_IN` explicitly only if a different lifetime is required. HTTP authentication and incoming WebSocket events read the account's current status and role instead of trusting stale JWT role claims.

## Boundaries

- Administrator access across organizations is intentional in the current model. A separate organization-owner permission model is not implemented here.
- `messages:list` and `message:send` look up the chat with the caller's organization scope. A global administrator can access another organization, but saved messages and emitted events use the chat's organization.
- Logout invalidates the stored refresh token. It does not revoke an otherwise valid access token.
- Existing WebSocket room subscriptions are not actively disconnected when an account is disabled or an access token expires. Incoming events are checked, but server broadcasts require connection-level revocation work before stronger session guarantees can be claimed.
- Refresh rotation uses a conditional MongoDB update. The concurrency test uses an in-memory store; a real MongoDB concurrency test is still needed.
- Registration creates an organization and a user in separate writes. Registration rollback, webhook signature verification, webhook deduplication, concurrent lead ordering, and durable message delivery remain separate work.
- Runtime startup migrations and external Instagram/OpenAI behavior are not covered by the isolated HTTP test suite.

The branch is intended for review before merging: pushes to `main` trigger the existing deployment workflow.

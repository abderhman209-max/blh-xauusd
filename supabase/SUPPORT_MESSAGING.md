# Private support conversations

Members open `#support`, send a text message and receive replies in that same conversation. Existing FAQs remain below it. Super Admins open `#admin`, choose a conversation in the support inbox and reply. The last sender determines the inbox's “Awaiting a reply” / “Replied” label; this is not an online indicator or a promise of immediate service.

Messages persist in Supabase. The browser checks for new messages every 15 seconds while the relevant page is visible, on return to the tab and on manual refresh. History loads 50 messages at a time, with earlier-message and incremental cursors. The admin inbox has 50-conversation pagination. Text is rendered with `textContent`, not HTML. English, German, French, Spanish, Arabic and Darija labels follow the existing site language.

## Access and storage

- `support_threads`: one conversation per account, display name and latest-message summary; account deletion cascades to its support history.
- `support_messages`: immutable text, server-generated sequence/time, retry UUID, validated sender and server-derived sender role.
- Authenticated direct database reads are owner scoped and require `private.pipvoria_session_is_current()`. Clients have no insert/update/delete privileges; anonymous clients have no table privileges. Direct client reads never grant cross-account access based on admin JWT claims.
- `/api?route=support/messages` and `support/send` authenticate the current session and derive the owner from it. `/api?route=admin/support/inbox`, `admin/support/messages` and `admin/support/send` additionally verify the latest Supabase `app_metadata.role === 'super_admin'`. User-editable metadata cannot authorize an admin.
- `pipvoria_support_send` is a security-invoker transaction callable only by `service_role`. The trusted API supplies validated IDs/role/session ID. The function verifies the current session, serializes writes per conversation, updates the inbox summary atomically and deduplicates successful retries. Customer writes cannot target another owner. Admin replies require an existing conversation.
- Text is trimmed, limited to 2,000 characters and rejects unsafe control characters at the API. Ten messages per minute per conversation and sender role are permitted; successful retries are still accepted after the rate limit. There are no attachments, email sends, new staff permissions or external chat dependencies.

The migration was applied as `20261007121308_pipvoria_private_support_messaging`. `supabase/tests/support_messaging.sql` runs real database checks inside a rollback-only transaction, using temporary sessions for existing owners without creating users, sending emails or leaving fixture messages behind. API tests verify owner/admin authorization, session replacement, validation, pagination, retry/error mapping and response privacy. Browser testing uses a separate local synthetic fixture that is never deployed.

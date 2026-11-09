# GT's seeding and Sloud notices

- Admin → **GT's seeding** controls visibility. First deployment opens the event and queues a student popup. Hiding blocks starts, drafts, submissions and study heartbeats without deleting records. Reopening sends one new notice; repeated saves do not resend it.
- The student sidebar highlights the event. Visibility and notifications refresh every 15 seconds while the page is visible. Popups wait for other dialogs.
- The supplied AI basics and MNIST/CIFAR-10 documents were converted into 92 server-only short-answer/code-blank questions in `server/questions/seeding.js`. Existing official questions and releases remain separate.
- Each set draws 30 unique questions. Students see all 30 together, can save/reload drafts and submit all answers at once. The server validates ownership and revision, grades normalized answers and reveals answers/explanations only after submission.
- Finishing a set grants **500P regardless of score**. Each new finished set earns another 500P. A transaction, completed-session check and unique ledger key prevent duplicate payouts from retries or simultaneous submissions.
- Active study uses the existing heartbeat with the same visibility, inactivity and multi-tab controls, recorded under the deep-learning subject. Time adds to the existing cumulative **over two hours** legendary condition. This does not introduce a second claim for an already claimed condition.
- Every new admin Sloud post is a notice, sorted before student posts, with a student popup and timeline entry linking to the post. Retried saves do not duplicate notices; deleted posts stop appearing in notifications. Existing posts do not generate retroactive popups.
- No production data is reset. New settings, notices and sessions use additive `CREATE TABLE IF NOT EXISTS` initialization. No credentials or answer lists are bundled in the client.

Validation: `npm run build`, `npm run test:server`, `npm run test:cards-alerts`, `npm run test:seeding`. Tests use isolated databases; browser tests write ignored screenshots under `artifacts/seeding` and cover 1366px, 390px and 320px layouts.

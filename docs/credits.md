# Credits

Credits meter usage of enrichment and comparison so we can control cost. They are visible in the UI and enforced before jobs run.

## Cost mapping

| Action | Credits |
|--------|---------|
| Enrich (full) | 3 |
| Enrich (tags only) | 1 |
| Compare (2 items) | 5 |
| Compare (3 items) | 6 |
| Compare (4 items) | 7 |
| Compare (5 items) | 8 |

## Monthly reset

Credits reset on the **first of each month (UTC)**. Each user has a `monthly_grant` (e.g. 100 for MVP). When the reset date is reached, the grant is added to the balance and the next reset date is set to the first of the following month.

## No refund on failure

If an enrich or compare job fails after credits have been spent, credits are **not** refunded. The ledger records the spend. This keeps the model simple for MVP; internal errors could be handled with refunds in a later iteration.

## Enforcement

- **Enqueue (enrich):** Before a new enrich job is created, the user’s balance is checked. If it’s below the cost (3 or 1), the job is not enqueued and the API returns 402 with a message.
- **Job runner (enrich):** When processing an enrich job, credits are deducted atomically before running the job. If deduction fails (e.g. balance was spent elsewhere), the job is marked failed with “Insufficient credits”.
- **Compare:** Before running a comparison, balance is checked and credits are deducted. If insufficient, the API returns 402.

## Admin grant

For testing, credits can be granted via:

```http
POST /api/admin/credits/grant
x-citestack-admin-secret: <CITESTACK_ADMIN_SECRET>
Content-Type: application/json

{ "userId": "<uuid>", "amount": 100 }
```

The same secret is used as for `/api/jobs/run`.

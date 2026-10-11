// Existing accounts retain access; every newer identity requires an explicit review.
// This cutoff is fixed at feature implementation, never computed per request.
export const APPROVAL_REQUIRED_FROM = '2026-10-11T03:40:44.000Z';
export function accountApproval(user) {
  if (user?.app_metadata?.role === 'super_admin') return 'approved';
  const review = user?.app_metadata?.pipvoria_approval;
  if (review !== undefined) return ['approved','pending','rejected'].includes(review?.status) ? review.status : 'pending';
  const created = Date.parse(user?.created_at);
  return Number.isFinite(created) && created < Date.parse(APPROVAL_REQUIRED_FROM) ? 'approved' : 'pending';
}
export function requireAccountApproval(user) {
  const status = accountApproval(user);
  if (status !== 'approved') throw Error(status === 'rejected' ? 'account_rejected' : 'account_pending');
}

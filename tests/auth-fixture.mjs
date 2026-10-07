export const fixtureSessionId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export function fixtureToken(userId, sessionId = fixtureSessionId) {
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({alg:'HS256',typ:'JWT'})}.${encode({sub:userId,session_id:sessionId})}.fixture-signature`;
}
export function sessionRpc(url) {
  return /\/rest\/v1\/rpc\/pipvoria_(session_active|claim_session|release_session)$/.test(String(url));
}

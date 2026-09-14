import { test, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SignJWT } from 'jose';
import { NextRequest } from 'next/server';
const temp = mkdtempSync(join(tmpdir(), 'pluma-test-'));
process.env.TURSO_DATABASE_URL = `file:${join(temp, 'test.db')}`;
delete process.env.TURSO_AUTH_TOKEN;
process.env.AUTH_SECRET = 'synthetic-auth-secret-used-only-in-offline-tests';
process.env.ADMIN_USERNAME = 'test-admin';
process.env.ADMIN_PASSWORD = 'synthetic-password';
const { checkCredentials, verifySessionToken } = await import('../src/lib/auth');
const { proxy } = await import('../src/proxy');
const { db } = await import('../src/db/index');
const { comments } = await import('../src/db/schema');
const { getApprovedComments, getApprovedCommentCounts, getPendingCommentCount } = await import('../src/lib/data');
await db.$client.execute(`CREATE TABLE comments (id TEXT PRIMARY KEY, article_id TEXT NOT NULL, parent_id TEXT, username TEXT NOT NULL, content TEXT NOT NULL, ip_hash TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', created_at INTEGER NOT NULL DEFAULT (unixepoch()*1000))`);
after(() => { db.$client.close(); rmSync(temp,{recursive:true,force:true}); });
beforeEach(async () => { await db.delete(comments); });
async function signed(payload: Record<string,unknown> = {sub:'test-admin',role:'admin'}, expiration: string|number = '1h', secret=process.env.AUTH_SECRET!) {
 return new SignJWT(payload).setProtectedHeader({alg:'HS256'}).setIssuedAt().setExpirationTime(expiration).sign(new TextEncoder().encode(secret));
}
test('configured credentials match exactly, including Unicode and length differences', () => {
 assert.equal(checkCredentials('test-admin','synthetic-password'),true);
 for (const [u,p] of [['TEST-ADMIN','synthetic-password'],['test-admin','wrong'],['test-admin\0','synthetic-password']]) assert.equal(checkCredentials(u,p),false);
});
test('missing credential configuration fails closed', () => {
 const old=process.env.ADMIN_PASSWORD; delete process.env.ADMIN_PASSWORD;
 try { assert.equal(checkCredentials('test-admin',''),false); } finally { process.env.ADMIN_PASSWORD=old; }
});
test('valid admin session accepted', async () => assert.equal(await verifySessionToken(await signed()),true));
test('missing and malformed sessions rejected', async () => {
 for(const token of [undefined,'','a.b.c']) assert.equal(await verifySessionToken(token),false);
});
test('expired and wrong-key sessions rejected', async () => {
 assert.equal(await verifySessionToken(await signed(undefined,1)),false);
 assert.equal(await verifySessionToken(await signed(undefined,'1h','unrelated-synthetic-secret')),false);
});
test('session must carry an admin role and a subject', async () => {
 for(const payload of [{sub:'test-admin',role:'reader'},{role:'admin'},{sub:'',role:'admin'}]) assert.equal(await verifySessionToken(await signed(payload)),false);
});
test('admin page redirects anonymous visitor to login with next path', async () => {
 const r=await proxy(new NextRequest('http://localhost/admin/comentarios'));
 assert.equal(r.status,307);
 assert.equal(r.headers.get('location'),'http://localhost/admin/login?next=%2Fadmin%2Fcomentarios');
});
test('login remains accessible anonymously', async () => {
 assert.equal((await proxy(new NextRequest('http://localhost/admin/login'))).status,200);
});
test('valid session can enter admin and skips login', async () => {
 const headers={cookie:`pluma_session=${await signed()}`};
 assert.equal((await proxy(new NextRequest('http://localhost/admin/comentarios',{headers}))).status,200);
 assert.equal((await proxy(new NextRequest('http://localhost/admin/login',{headers}))).headers.get('location'),'http://localhost/admin');
});
test('public comments and counts exclude pending, rejected and other articles', async () => {
 for(const [id,articleId,status] of [['a','one','approved'],['b','one','pending'],['c','one','rejected'],['d','two','approved']] as const) {
  await db.insert(comments).values({id,articleId,status,username:'Synthetic',content:'Fixture',ipHash:'synthetic-hash'});
 }
 assert.deepEqual((await getApprovedComments('one')).map(c=>c.id),['a']);
 const counts=await getApprovedCommentCounts(['one']);
 assert.equal(counts.get('one'),1);
 assert.equal(await getPendingCommentCount(),1);
});
test('new comments default to pending',async()=>{
 await db.insert(comments).values({id:'new',articleId:'one',username:'Synthetic',content:'Fixture',ipHash:'synthetic-hash'});
 assert.deepEqual(await getApprovedComments('one'),[]);
 assert.equal(await getPendingCommentCount(),1);
});

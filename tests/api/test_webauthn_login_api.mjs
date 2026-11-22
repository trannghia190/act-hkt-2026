/**
 * Đăng nhập bằng Passkey (WebAuthn) — test API thuần, KHÔNG cần trình duyệt.
 *
 * Tự đóng vai authenticator phần cứng bằng Node crypto:
 *   - tạo cặp khóa ES256 (P-256) đóng vai Secure Enclave/KeyStore,
 *   - dựng attestation "none" + COSE public key để đăng ký passkey cho thiết bị,
 *   - ký assertion thật (DER ECDSA trên authenticatorData || SHA-256(clientDataJSON))
 *     để đăng nhập usernameless và nhận JWT.
 *
 * Kiểm tra cả các nhánh từ chối: chữ ký sai, phát lại challenge đã dùng, origin lạ.
 * Chạy (backend :8080, `npm run dev` DB sẵn sàng):
 *   node tests/api/test_webauthn_login_api.mjs
 */
import {
  createHash, generateKeyPairSync, randomBytes, sign as ecdsaSign,
} from 'node:crypto';
import { execFileSync } from 'node:child_process';

const API = 'http://localhost:8080/api/v1';
const ORIGIN = 'http://localhost:3000';
const EMPLOYEE = '136ACT';

const sha256 = (buf) => createHash('sha256').update(buf).digest();
const b64u = (buf) => Buffer.from(buf).toString('base64url');
const fromB64u = (s) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

const check = (name, cond, extra = '') => {
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond ? '' : ' — ' + String(extra).slice(0, 500)));
  if (!cond) process.exit(1);
};

const psql = (sql) => execFileSync(
  'psql', ['-h', '127.0.0.1', '-d', 'pulse_db', '-tAc', sql], { encoding: 'utf8' },
).trim();

const cleanup = () => psql(
  "delete from devices where device_fingerprint like 'passkey-%' "
  + "and user_id=(select id from users where employee_code='" + EMPLOYEE + "')",
);

const call = async (method, path, { token, body, headers = {}, expect } = {}) => {
  const res = await fetch(API + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (expect && res.status !== expect) {
    console.log(`FAIL ${method} ${path}: want ${expect} got ${res.status} ${JSON.stringify(json).slice(0, 400)}`);
    process.exit(1);
  }
  return { code: res.status, json };
};

// ── CBOR tối giản: int / bytes / text / map (đủ cho attestationObject + COSE) ──
const head = (major, n) => {
  if (n < 24) return Buffer.from([(major << 5) | n]);
  if (n < 256) return Buffer.from([(major << 5) | 24, n]);
  if (n < 65536) { const b = Buffer.alloc(3); b[0] = (major << 5) | 25; b.writeUInt16BE(n, 1); return b; }
  const b = Buffer.alloc(5); b[0] = (major << 5) | 26; b.writeUInt32BE(n, 1); return b;
};
const cborInt = (n) => (n >= 0 ? head(0, n) : head(1, -1 - n));
const cborBytes = (buf) => Buffer.concat([head(2, buf.length), buf]);
const cborText = (s) => { const b = Buffer.from(s, 'utf8'); return Buffer.concat([head(3, b.length), b]); };
const cborMap = (entries) => Buffer.concat([head(5, entries.length), ...entries.flat()]);

const clientData = (type, challenge) => Buffer.from(JSON.stringify({
  type, challenge, origin: ORIGIN, crossOrigin: false,
}));

const serverChallenge = (options) => {
  const pk = options?.options?.publicKey;
  if (!pk?.challenge) {
    console.log('FAIL server không trả PublicKeyCredentialOptions.publicKey — ' + JSON.stringify(options).slice(0, 400));
    process.exit(1);
  }
  return pk;
};

// ── Chuẩn bị: đăng nhập mật khẩu + dọn passkey cũ của tài khoản test ──
cleanup();
const loginRes = await call('POST', '/auth/login', {
  body: { employeeCodeOrEmail: EMPLOYEE, password: '123456' }, expect: 200,
});
const passwordToken = loginRes.json.data.accessToken;
check('Đăng nhập mật khẩu lấy token', !!passwordToken);

// ── 1. Đăng ký passkey: dựng attestation "none" như authenticator thật ──
const regOptions = (await call('POST', '/webauthn/register/options', {
  token: passwordToken, body: {}, headers: { Origin: ORIGIN }, expect: 200,
})).json.data;
const regPk = serverChallenge(regOptions);
const rpId = regPk.rp.id;
const userHandle = fromB64u(regPk.user.id);
check('Options đăng ký có rp.id + user.id', !!rpId && userHandle.length > 0, regPk);

const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const jwk = publicKey.export({ format: 'jwk' });
const x = fromB64u(jwk.x);
const y = fromB64u(jwk.y);
const credentialId = randomBytes(32);

const coseKey = cborMap([
  [cborInt(1), cborInt(2)],    // kty: EC2
  [cborInt(3), cborInt(-7)],   // alg: ES256
  [cborInt(-1), cborInt(1)],   // crv: P-256
  [cborInt(-2), cborBytes(x)],
  [cborInt(-3), cborBytes(y)],
]);
const regAuthData = Buffer.concat([
  sha256(Buffer.from(rpId, 'utf8')),
  Buffer.from([0x45]),                       // UP | UV | AT
  Buffer.from([0, 0, 0, 0]),                 // signCount = 0
  Buffer.alloc(16, 0),                       // AAGUID
  Buffer.from([credentialId.length >> 8, credentialId.length & 0xff]),
  credentialId,
  coseKey,
]);
const attestationObject = cborMap([
  [cborText('fmt'), cborText('none')],
  [cborText('attStmt'), head(5, 0)],
  [cborText('authData'), cborBytes(regAuthData)],
]);
const regClientData = clientData('webauthn.create', regPk.challenge);

const regVerify = (await call('POST', '/webauthn/register/verify', {
  token: passwordToken,
  body: {
    challengeId: regOptions.challengeId,
    credential: {
      id: b64u(credentialId),
      rawId: b64u(credentialId),
      type: 'public-key',
      clientExtensionResults: {},
      response: {
        clientDataJSON: b64u(regClientData),
        attestationObject: b64u(attestationObject),
      },
    },
  },
  expect: 200,
})).json.data;
check('Server verify attestation + lưu credential', regVerify.hasPasskey === true, regVerify);

if (!regVerify.approved) {
  const hrToken = (await call('POST', '/auth/login', {
    body: { employeeCodeOrEmail: '01HR', password: '123456' }, expect: 200,
  })).json.data.accessToken;
  await call('POST', `/admin/devices/${regVerify.deviceId}/approve`, { token: hrToken, body: {}, expect: 200 });
}
const status = (await call('GET', '/webauthn/status', { token: passwordToken, expect: 200 })).json.data;
check('Trạng thái tài khoản có passkey', status.hasPasskey === true, status);
check('DB lưu credential_id dạng base64url',
  psql("select count(*) from devices where credential_id='" + b64u(credentialId) + "'") === '1');

// ── 2. Đăng nhập usernameless: challenge → ký assertion → JWT ──
const signCount = 1;
const loginOptions = (await call('POST', '/webauthn/login/options', {
  body: {}, headers: { Origin: ORIGIN }, expect: 200,
})).json.data;
const loginPk = serverChallenge(loginOptions);
const assertAuthData = Buffer.concat([
  sha256(Buffer.from(loginPk.rpId || rpId, 'utf8')),
  Buffer.from([0x05]),                       // UP | UV
  (() => { const b = Buffer.alloc(4); b.writeUInt32BE(signCount, 0); return b; })(),
]);
const assertClientData = clientData('webauthn.get', loginPk.challenge);
const signature = ecdsaSign('sha256', Buffer.concat([assertAuthData, sha256(assertClientData)]), privateKey);

const loginBody = {
  challengeId: loginOptions.challengeId,
  credential: {
    id: b64u(credentialId),
    rawId: b64u(credentialId),
    type: 'public-key',
    clientExtensionResults: {},
    response: {
      clientDataJSON: b64u(assertClientData),
      authenticatorData: b64u(assertAuthData),
      signature: b64u(signature),
      userHandle: b64u(userHandle),
    },
  },
};
const loginVerify = await call('POST', '/webauthn/login/verify', { body: loginBody, expect: 200 });
const passkeyToken = loginVerify.json.data.accessToken;
check('Đăng nhập passkey trả accessToken', !!passkeyToken, loginVerify.json);
check('JWT passkey mang đúng nhân viên', loginVerify.json.data.employeeCode === EMPLOYEE, loginVerify.json.data);

const me = await call('GET', '/webauthn/status', { token: passkeyToken, expect: 200 });
check('Token passkey gọi được API cần đăng nhập', me.json.data.hasPasskey === true, me.json);
check('signature_count trên DB tăng theo assertion',
  psql("select signature_count from devices where credential_id='" + b64u(credentialId) + "'") === String(signCount));

// ── 3. Các nhánh phải bị từ chối ──
const replay = await call('POST', '/webauthn/login/verify', { body: loginBody });
check('Phát lại challenge đã dùng bị từ chối', replay.code !== 200, replay);

const badOptions = (await call('POST', '/webauthn/login/options', {
  body: {}, headers: { Origin: ORIGIN }, expect: 200,
})).json.data;
const badPk = serverChallenge(badOptions);
const badAuthData = Buffer.concat([
  sha256(Buffer.from(badPk.rpId || rpId, 'utf8')),
  Buffer.from([0x05]), Buffer.from([0, 0, 0, 2]),
]);
const badClientData = clientData('webauthn.get', badPk.challenge);
const goodSig = ecdsaSign('sha256', Buffer.concat([badAuthData, sha256(badClientData)]), privateKey);
goodSig[goodSig.length - 1] ^= 0xff;          // lật 1 byte → chữ ký sai
const tampered = await call('POST', '/webauthn/login/verify', {
  body: {
    challengeId: badOptions.challengeId,
    credential: {
      id: b64u(credentialId), rawId: b64u(credentialId), type: 'public-key',
      clientExtensionResults: {},
      response: {
        clientDataJSON: b64u(badClientData),
        authenticatorData: b64u(badAuthData),
        signature: b64u(goodSig),
        userHandle: b64u(userHandle),
      },
    },
  },
});
check('Chữ ký sai bị từ chối', tampered.code !== 200, tampered);

const evilOrigin = await call('POST', '/webauthn/login/options', {
  body: {}, headers: { Origin: 'https://evil.example' },
});
check('Origin lạ bị từ chối', evilOrigin.code !== 200, evilOrigin);

// ── 4. Thiết bị bị thu hồi thì không đăng nhập được ──
await call('POST', `/admin/devices/${regVerify.deviceId}/revoke`, {
  token: (await call('POST', '/auth/login', {
    body: { employeeCodeOrEmail: '01HR', password: '123456' }, expect: 200,
  })).json.data.accessToken,
  body: { reason: 'ZZ webauthn login test' }, expect: 200,
});
const revokedOptions = (await call('POST', '/webauthn/login/options', {
  body: {}, headers: { Origin: ORIGIN }, expect: 200,
})).json.data;
const revokedPk = serverChallenge(revokedOptions);
const revokedAuthData = Buffer.concat([
  sha256(Buffer.from(revokedPk.rpId || rpId, 'utf8')),
  Buffer.from([0x05]), Buffer.from([0, 0, 0, 3]),
]);
const revokedClientData = clientData('webauthn.get', revokedPk.challenge);
const revoked = await call('POST', '/webauthn/login/verify', {
  body: {
    challengeId: revokedOptions.challengeId,
    credential: {
      id: b64u(credentialId), rawId: b64u(credentialId), type: 'public-key',
      clientExtensionResults: {},
      response: {
        clientDataJSON: b64u(revokedClientData),
        authenticatorData: b64u(revokedAuthData),
        signature: b64u(ecdsaSign('sha256',
          Buffer.concat([revokedAuthData, sha256(revokedClientData)]), privateKey)),
        userHandle: b64u(userHandle),
      },
    },
  },
});
check('Passkey đã bị thu hồi không đăng nhập được', revoked.code !== 200, revoked);

cleanup();
console.log('\nALL WEBAUTHN LOGIN (API) CHECKS PASSED');

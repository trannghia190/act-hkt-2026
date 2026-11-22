/**
 * WebAuthn/Passkey — lớp khóa thiết bị phần cứng khi chấm công.
 * Private key nằm trong Secure Enclave/KeyStore; server chỉ nhận public credential.
 */

export interface SignedAssertion {
  challengeId: string;
  credential: unknown;
}

const authToken = (): string => {
  try {
    const u = JSON.parse(localStorage.getItem('pulse_auth_user') || '{}');
    return u?.accessToken || '';
  } catch {
    return '';
  }
};

const toBase64Url = (buf: ArrayBuffer): string => {
  const bytes = new Uint8Array(buf);
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64Url = (value: string): Uint8Array => {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
    + '='.repeat((4 - (value.length % 4)) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
};

export const isWebAuthnSupported = (): boolean =>
  typeof window !== 'undefined' && !!window.PublicKeyCredential && !!navigator.credentials;

const request = async (path: string, body?: unknown): Promise<any> => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = authToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`/api/v1${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.message || 'Không xác thực được passkey.');
  return json?.data;
};

export const getWebAuthnStatus = async (): Promise<{ hasPasskey: boolean; approvedDevices: number }> => {
  try {
    const data = await request('/webauthn/status');
    return { hasPasskey: !!data?.hasPasskey, approvedDevices: data?.approvedDevices ?? 0 };
  } catch {
    return { hasPasskey: false, approvedDevices: 0 };
  }
};

/** Chuyển JSON options của server thành PublicKeyCredential*Options (hỗ trợ trình duyệt cũ). */
const toCreationOptions = (options: any): PublicKeyCredentialCreationOptions => {
  if (typeof PublicKeyCredential !== 'undefined'
    && typeof (PublicKeyCredential as any).parseCreationOptionsFromJSON === 'function') {
    return (PublicKeyCredential as any).parseCreationOptionsFromJSON(options);
  }
  return {
    ...options,
    challenge: fromBase64Url(options.challenge),
    user: { ...options.user, id: fromBase64Url(options.user.id) },
    excludeCredentials: (options.excludeCredentials || []).map((c: any) => ({
      ...c, id: fromBase64Url(c.id),
    })),
  } as PublicKeyCredentialCreationOptions;
};

const toRequestOptions = (options: any): PublicKeyCredentialRequestOptions => {
  if (typeof PublicKeyCredential !== 'undefined'
    && typeof (PublicKeyCredential as any).parseRequestOptionsFromJSON === 'function') {
    return (PublicKeyCredential as any).parseRequestOptionsFromJSON(options);
  }
  return {
    ...options,
    challenge: fromBase64Url(options.challenge),
    allowCredentials: (options.allowCredentials || []).map((c: any) => ({
      ...c, id: fromBase64Url(c.id),
    })),
  } as PublicKeyCredentialRequestOptions;
};

const serializeCredential = (cred: any): unknown => {
  // Chrome mới trả thêm publicKey/publicKeyAlgorithm trong response.toJSON(); server
  // dùng parser CTAP2 chặt nên chỉ gửi đúng các trường của spec.
  const raw = typeof cred.toJSON === 'function' ? cred.toJSON() : null;
  const response = raw?.response ?? {
    clientDataJSON: toBase64Url(cred.response.clientDataJSON),
    attestationObject: cred.response.attestationObject
      ? toBase64Url(cred.response.attestationObject) : undefined,
    authenticatorData: cred.response.authenticatorData
      ? toBase64Url(cred.response.authenticatorData) : undefined,
    signature: cred.response.signature ? toBase64Url(cred.response.signature) : undefined,
    userHandle: cred.response.userHandle ? toBase64Url(cred.response.userHandle) : undefined,
    transports: cred.response.getTransports ? cred.response.getTransports() : undefined,
  };
  return {
    id: raw?.id ?? cred.id,
    rawId: raw?.rawId ?? toBase64Url(cred.rawId),
    type: raw?.type ?? cred.type,
    authenticatorAttachment: raw?.authenticatorAttachment ?? cred.authenticatorAttachment,
    clientExtensionResults: raw?.clientExtensionResults ?? cred.getClientExtensionResults?.() ?? {},
    response: {
      clientDataJSON: response.clientDataJSON,
      ...(response.attestationObject ? { attestationObject: response.attestationObject } : {}),
      ...(response.authenticatorData ? { authenticatorData: response.authenticatorData } : {}),
      ...(response.signature ? { signature: response.signature } : {}),
      ...(response.userHandle ? { userHandle: response.userHandle } : {}),
      ...(response.transports ? { transports: response.transports } : {}),
    },
  };
};

/** Dấu "thiết bị này đã đăng ký passkey" — lưu theo tài khoản vì cùng máy có thể nhiều người dùng. */
export interface LocalPasskeyMark {
  deviceId: string;
  credentialId: string;
  registeredAt: string;
}

const PASSKEY_MARK_PREFIX = 'pulse_passkey_device_';

const currentEmployeeCode = (): string => {
  try {
    return JSON.parse(localStorage.getItem('pulse_auth_user') || '{}')?.employeeCode || '';
  } catch {
    return '';
  }
};

const markKey = (employeeCode: string): string => `${PASSKEY_MARK_PREFIX}${employeeCode}`;

/** Passkey đã đăng ký trên trình duyệt này (null nếu chưa / thuộc tài khoản khác). */
export const getLocalPasskeyMark = (): LocalPasskeyMark | null => {
  const employeeCode = currentEmployeeCode();
  if (!employeeCode) return null;
  try {
    const mark = JSON.parse(localStorage.getItem(markKey(employeeCode)) || 'null');
    return mark?.deviceId ? mark : null;
  } catch {
    return null;
  }
};

export const clearLocalPasskeyMark = (): void => {
  const employeeCode = currentEmployeeCode();
  if (employeeCode) localStorage.removeItem(markKey(employeeCode));
};

const saveLocalPasskeyMark = (mark: LocalPasskeyMark): void => {
  const employeeCode = currentEmployeeCode();
  if (employeeCode) localStorage.setItem(markKey(employeeCode), JSON.stringify(mark));
};

/** Đăng ký passkey cho thiết bị — tạo yêu cầu chờ HR duyệt như thiết bị thường. */
export const registerPasskey = async (): Promise<{ deviceId?: string; approved: boolean; credentialId?: string }> => {
  if (!isWebAuthnSupported()) throw new Error('Trình duyệt không hỗ trợ passkey (WebAuthn).');
  const data = await request('/webauthn/register/options', {});
  const publicKey = data?.options?.publicKey;
  if (!publicKey) throw new Error('Máy chủ chưa trả về cấu hình passkey.');
  const cred = await navigator.credentials.create({ publicKey: toCreationOptions(publicKey) });
  if (!cred) throw new Error('Không tạo được passkey. Vui lòng thử lại.');
  const credential = serializeCredential(cred);
  const verified = await request('/webauthn/register/verify', {
    challengeId: data.challengeId,
    credential,
  });
  const credentialId = (credential as any)?.id || cred.id;
  if (verified?.deviceId) {
    saveLocalPasskeyMark({
      deviceId: verified.deviceId,
      credentialId: credentialId || '',
      registeredAt: new Date().toISOString(),
    });
  }
  return { deviceId: verified?.deviceId, approved: !!verified?.approved, credentialId };
};

/** Ký challenge để đưa vào payload chấm công; server verify trong giao dịch chấm công. */
export const signAttendanceAssertion = async (): Promise<SignedAssertion | null> => {
  if (!isWebAuthnSupported()) return null;
  const data = await request('/webauthn/assert/options', {});
  if (data?.needsRegistration) return null;
  const publicKey = data?.options?.publicKey;
  if (!publicKey) throw new Error('Máy chủ chưa trả về thử thách passkey.');
  const cred = await navigator.credentials.get({ publicKey: toRequestOptions(publicKey) });
  if (!cred) throw new Error('Bạn chưa xác thực bằng vân tay/Face ID.');
  return { challengeId: data.challengeId, credential: serializeCredential(cred) };
};

/**
 * Đăng nhập bằng passkey (usernameless): server trả challenge trống allowCredentials,
 * trình duyệt tự chọn passkey đã lưu, server verify chữ ký rồi cấp phiên như đăng nhập mật khẩu.
 */
export const loginWithPasskey = async (): Promise<{
  accessToken: string;
  refreshToken?: string;
  employeeCode: string;
  fullName?: string;
  email?: string;
  role: string;
  faceEnrolled?: boolean;
  mustChangePassword?: boolean;
  status?: string;
}> => {
  if (!isWebAuthnSupported()) {
    throw new Error('Trình duyệt không hỗ trợ passkey (WebAuthn).');
  }
  const data = await request('/webauthn/login/options', {});
  const publicKey = data?.options?.publicKey;
  if (!publicKey) throw new Error('Máy chủ chưa trả về thử thách đăng nhập passkey.');
  const cred = await navigator.credentials.get({ publicKey: toRequestOptions(publicKey) });
  if (!cred) throw new Error('Bạn chưa xác thực bằng vân tay/Face ID.');
  return request('/webauthn/login/verify', {
    challengeId: data.challengeId,
    credential: serializeCredential(cred),
  });
};

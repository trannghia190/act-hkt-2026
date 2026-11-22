/**
 * WebAuthn/Passkey — đăng nhập nhanh bằng vân tay / Face ID / Windows Hello.
 * Passkey KHÔNG dùng cho chấm công; chấm công vẫn dùng thiết bị đã đăng ký + khuôn mặt.
 * Private key nằm trong Secure Enclave/KeyStore; server chỉ nhận public credential.
 */

export interface PasskeySummary {
  id: string;
  label?: string;
  createdAt?: string;
  lastUsedAt?: string;
}

export interface WebAuthnStatus {
  hasPasskey: boolean;
  credentials: PasskeySummary[];
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

const request = async (path: string, body?: unknown, method?: string): Promise<any> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    // Server đọc X-App-Origin khi trình duyệt không gửi Origin (vd khi đứng sau proxy).
    'X-App-Origin': window.location.origin,
  };
  const token = authToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`/api/v1${path}`, {
    method: method || (body === undefined ? 'GET' : 'POST'),
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.message || 'Không xác thực được passkey.');
  return json?.data;
};

export const getWebAuthnStatus = async (): Promise<WebAuthnStatus> => {
  try {
    const data = await request('/webauthn/status');
    return {
      hasPasskey: !!data?.hasPasskey,
      credentials: Array.isArray(data?.credentials) ? data.credentials : [],
    };
  } catch {
    return { hasPasskey: false, credentials: [] };
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
      ? toBase64Url(cred.response.attestationObject)
      : undefined,
    authenticatorData: cred.response.authenticatorData
      ? toBase64Url(cred.response.authenticatorData)
      : undefined,
    signature: cred.response.signature
      ? toBase64Url(cred.response.signature)
      : undefined,
    userHandle: cred.response.userHandle
      ? toBase64Url(cred.response.userHandle)
      : undefined,
  };
  const {
    publicKey, publicKeyAlgorithm, ...rest
  } = response as any;
  return {
    id: cred.id,
    rawId: toBase64Url(cred.rawId),
    type: cred.type || 'public-key',
    authenticatorAttachment: cred.authenticatorAttachment ?? undefined,
    clientExtensionResults: cred.getClientExtensionResults?.() ?? {},
    response: rest,
  };
};

/** Đăng ký passkey để đăng nhập nhanh (dùng chung cho mọi thiết bị đã đăng nhập). */
export const registerPasskey = async (): Promise<{ id?: string; credentialId?: string; hasPasskey: boolean; message?: string }> => {
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
  return {
    id: verified?.id,
    credentialId,
    hasPasskey: !!verified?.hasPasskey,
    message: verified?.message,
  };
};

/** Gỡ passkey khỏi tài khoản — không ảnh hưởng thiết bị chấm công. */
export const removePasskey = async (id: string): Promise<void> => {
  await request(`/webauthn/credentials/${id}`, undefined, 'DELETE');
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
  let cred: Credential | null;
  try {
    cred = await navigator.credentials.get({ publicKey: toRequestOptions(publicKey) });
  } catch (e: any) {
    if (e?.name === 'NotAllowedError') {
      throw new Error('Không tìm thấy passkey trên thiết bị này — hãy đăng nhập bằng mật khẩu rồi đăng ký passkey trong Cài đặt.');
    }
    throw e;
  }
  if (!cred) throw new Error('Bạn chưa xác thực bằng vân tay/Face ID.');
  return request('/webauthn/login/verify', {
    challengeId: data.challengeId,
    credential: serializeCredential(cred),
  });
};

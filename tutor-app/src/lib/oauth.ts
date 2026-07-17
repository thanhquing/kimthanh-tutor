export interface GoogleCredentialResponse {
  credential?: string;
}

export interface FacebookLoginResponse {
  status?: string;
  authResponse?: { accessToken?: string } | null;
}

interface GoogleIdentity {
  accounts: {
    id: {
      initialize(config: { client_id: string; callback: (response: GoogleCredentialResponse) => void }): void;
      renderButton(element: HTMLElement, options: Record<string, string | number>): void;
      disableAutoSelect(): void;
    };
  };
}

interface FacebookSdk {
  init(config: { appId: string; cookie: boolean; xfbml: boolean; version: string }): void;
  login(callback: (response: FacebookLoginResponse) => void, options: { scope: string }): void;
}

declare global {
  interface Window {
    google?: GoogleIdentity;
    FB?: FacebookSdk;
    fbAsyncInit?: () => void;
  }
}

let googleReady: Promise<void> | null = null;
let googleInitializedFor = "";
let googleCallback: ((idToken: string) => void) | null = null;
let googleErrorCallback: ((message: string) => void) | null = null;
let facebookReady: Promise<void> | null = null;
let facebookInitializedFor = "";

function loadScript(id: string, src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(id) as HTMLScriptElement | null;
    if (existing?.dataset.loaded === "true") {
      resolve();
      return;
    }
    const script = existing ?? document.createElement("script");
    script.id = id;
    script.async = true;
    script.defer = true;
    script.crossOrigin = "anonymous";
    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = () => reject(new Error("Không tải được SDK đăng nhập."));
    if (!existing) {
      script.src = src;
      document.head.append(script);
    }
  });
}

export function googleCredentialFromCallback(response: GoogleCredentialResponse) {
  const credential = response.credential?.trim();
  if (!credential) throw new Error("Google không trả về thông tin xác thực.");
  return credential;
}

export function facebookAccessTokenFromCallback(response: FacebookLoginResponse) {
  const token = response.status === "connected" ? response.authResponse?.accessToken?.trim() : "";
  if (!token) throw new Error("Bạn đã hủy hoặc chưa hoàn tất đăng nhập Facebook.");
  return token;
}

export async function renderGoogleButton(
  element: HTMLElement,
  clientId: string,
  onCredential: (idToken: string) => void,
  onError: (message: string) => void,
) {
  if (!clientId) throw new Error("Google OAuth chưa được cấu hình.");
  googleCallback = onCredential;
  googleErrorCallback = onError;
  googleReady ??= loadScript("google-identity-services", "https://accounts.google.com/gsi/client?hl=vi");
  await googleReady;
  if (!window.google) throw new Error("Google Identity Services chưa sẵn sàng.");
  if (googleInitializedFor && googleInitializedFor !== clientId) {
    throw new Error("Google OAuth đang dùng client ID khác trong tab này.");
  }
  if (!googleInitializedFor) {
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: (response) => {
        try {
          googleCallback?.(googleCredentialFromCallback(response));
        } catch (error) {
          googleErrorCallback?.(error instanceof Error ? error.message : "Không thể đăng nhập Google.");
        }
      },
    });
    googleInitializedFor = clientId;
  }
  element.replaceChildren();
  window.google.accounts.id.renderButton(element, {
    theme: "outline",
    size: "large",
    shape: "rectangular",
    text: "continue_with",
    locale: "vi",
    width: Math.min(360, Math.max(240, element.clientWidth || 320)),
  });
}

export function disableGoogleAutoSelect() {
  window.google?.accounts.id.disableAutoSelect();
}

export async function loginWithFacebook(appId: string, version: string) {
  if (!appId) throw new Error("Facebook OAuth chưa được cấu hình.");
  if (!facebookReady) {
    facebookReady = new Promise<void>((resolve, reject) => {
      window.fbAsyncInit = () => resolve();
      loadScript("facebook-jssdk", "https://connect.facebook.net/vi_VN/sdk.js").catch(reject);
    });
  }
  await facebookReady;
  if (!window.FB) throw new Error("Facebook Login chưa sẵn sàng.");
  const key = `${appId}:${version}`;
  if (facebookInitializedFor && facebookInitializedFor !== key) {
    throw new Error("Facebook OAuth đang dùng cấu hình khác trong tab này.");
  }
  if (!facebookInitializedFor) {
    window.FB.init({ appId, cookie: false, xfbml: false, version });
    facebookInitializedFor = key;
  }
  return new Promise<string>((resolve, reject) => {
    window.FB!.login((response) => {
      try {
        resolve(facebookAccessTokenFromCallback(response));
      } catch (error) {
        reject(error);
      }
    }, { scope: "public_profile,email" });
  });
}

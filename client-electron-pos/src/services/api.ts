import axios from "axios";
import { isLicenseErrorCode, normalizeLicenseCode } from "@/lib/license";
import { useLicenseStore } from "@/stores/licenseStore";

const SERVER_URL = localStorage.getItem("server_url") || "http://localhost:8001";
let authToken = "";

const api = axios.create({
  baseURL: `${SERVER_URL}/api`,
  timeout: 10000,
});

api.interceptors.request.use((config) => {
  if (authToken) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const detail = error.response?.data?.detail;

    if (authToken && error.response?.status === 401) {
      clearAuthToken();
      useLicenseStore.getState().clearLicenseState();
      if (typeof window !== "undefined") {
        window.location.hash = "#/";
        window.location.reload();
      }
    }

    if (detail) {
      const code = typeof detail === "object" ? normalizeLicenseCode(detail.code) : "";
      const message = typeof detail === "object" ? detail.message : String(detail);
      if (error.response?.status === 403 && isLicenseErrorCode(code)) {
        useLicenseStore.getState().setBlockingLicense({ code, message });
      }

      error.message = typeof detail === "object" ? detail.message : String(detail);
    }

    return Promise.reject(error);
  },
);

export function setServerUrl(url: string) {
  localStorage.setItem("server_url", url);
  api.defaults.baseURL = `${url}/api`;
}

export function getServerUrl(): string {
  return localStorage.getItem("server_url") || "http://localhost:8001";
}

export function setAuthToken(token: string) {
  authToken = token.trim();
}

export function clearAuthToken() {
  authToken = "";
}

export default api;

import axios from "axios";

const SERVER_URL = localStorage.getItem("server_url") || "http://localhost:8000";

const api = axios.create({
  baseURL: `${SERVER_URL}/api`,
  timeout: 10000,
});

export function setServerUrl(url: string) {
  localStorage.setItem("server_url", url);
  api.defaults.baseURL = `${url}/api`;
}

export function getServerUrl(): string {
  return localStorage.getItem("server_url") || "http://localhost:8000";
}

export default api;

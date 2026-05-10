import axios from 'axios';

export const API_CONFIG = {
  PARLAY_API_URL: import.meta.env.VITE_PARLAY_API_URL || 'http://localhost:3001',
  OPTIONS_API_URL: import.meta.env.VITE_OPTIONS_API_URL || 'http://localhost:3002',
};

// Create axios instances for each service
export const parlayApi = axios.create({
  baseURL: `${API_CONFIG.PARLAY_API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const optionsApi = axios.create({
  baseURL: `${API_CONFIG.OPTIONS_API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Legacy single api instance (points to parlay service for backward compatibility)
export const api = parlayApi;

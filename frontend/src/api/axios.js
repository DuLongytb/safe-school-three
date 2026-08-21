import axios from 'axios';
import { auth } from '../firebase/config';

// Khởi tạo Axios Instance kết nối tới Backend API
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Axios Request Interceptor: Tự động đính kèm Firebase ID Token vào Header
api.interceptors.request.use(
  async (config) => {
    try {
      const currentUser = auth.currentUser;
      if (currentUser) {
        const token = await currentUser.getIdToken(false);
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('❌ Lỗi đính kèm token trong Axios Interceptor:', error);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Axios Response Interceptor: Xử lý lỗi tập trung
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const errorMsg = error.response?.data?.message || error.response?.data?.detail || error.message || 'Có lỗi xảy ra khi kết nối máy chủ';
    console.error('❌ Axios API Error:', errorMsg);
    return Promise.reject(new Error(errorMsg));
  }
);

export default api;

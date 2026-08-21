import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { collection, deleteDoc, doc, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/Common/ProtectedRoute';
import Header from './components/Layout/Header';
import Footer from './components/Layout/Footer';
import { db } from './firebase/config';

// User Pages
import Home from './Pages/Home';
import News from './Pages/News';
import CreatePost from './Pages/CreatePost';
import Report from './Pages/Report';
import Profile from './Pages/Profile';
import Chat from './Pages/Chat';
import Login from './Pages/Login';
import Register from './Pages/Register';
import SOS from "./Pages/SOS";
import Notifications from './Pages/Notifications';
import Consultation from './Pages/Consultation';

// Admin Layout & Pages
import AdminLayout from './components/Layout/AdminLayout';
import Dashboard from './Pages/admin/Dashboard';
import ManageUsers from './Pages/admin/ManageUsers';
import ManagePosts from './Pages/admin/ManagePosts';
import ManageReports from './Pages/admin/ManageReports';
import ManageChat from './Pages/admin/ManageChat';
import './Pages/Notifications.css';

const NO_HEADER_ROUTES = ['/register', '/login'];
const NO_FOOTER_ROUTES = ['/register', '/login', '/chat'];

function AppShell() {
  const { pathname } = useLocation();

  const isNoHeader = NO_HEADER_ROUTES.includes(pathname) || pathname.startsWith('/admin');
  const isNoFooter = NO_FOOTER_ROUTES.includes(pathname) || pathname.startsWith('/admin');

  return (
    <>
      {!isNoHeader && <Header />}

      <main className="app-main" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Routes>
          {/* Public User Routes */}
          <Route path="/" element={<Home />} />
          <Route path="/articles" element={<News />} />
          <Route path="/articles/:id" element={<News />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Trang SOS */}
          <Route path="/sos" element={<SOS />} />

          {/* Protected User Routes */}
          <Route path="/articles/create" element={<ProtectedRoute><CreatePost /></ProtectedRoute>} />
          <Route path="/articles/edit/:id" element={<ProtectedRoute><CreatePost /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute><Report /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
          <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
          <Route path="/consultation" element={<ProtectedRoute><Consultation /></ProtectedRoute>} />

          {/* Protected Admin Routes */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute requireAdmin={true}>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="users" element={<ManageUsers />} />
            <Route path="posts" element={<ManagePosts />} />
            <Route path="reports" element={<ManageReports />} />
            <Route path="chat" element={<ManageChat />} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {!isNoFooter && <Footer />}
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
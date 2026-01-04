import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AgentDashboard from './AgentDashboard';
import AdminDashboard from './AdminDashboard';
import LandingPage from './LandingPage';
import LeadCapture from './LeadCapture';

function App() {
    const [user, setUser] = useState(null);

    // 로그인 처리 함수
    const handleLogin = (username, password) => {
        fetch('http://127.0.0.1:8000/api/login/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        })
            .then(res => {
                if (res.ok) return res.json();
                throw new Error('로그인 실패');
            })
            .then(data => {
                if (data.token) {
                    localStorage.setItem('token', data.token);
                }
                setUser(data);
            })
            .catch(() => alert('아이디 또는 비밀번호가 일치하지 않습니다.'));
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        setUser(null);
    };

    return (
        <Router>
            <Routes>
                {/* 1. 고객용 상담 신청 페이지 (로그인 불필요) */}
                <Route path="/apply" element={<LeadCapture />} />

                {/* 2. 업무용 시스템 (로그인 여부에 따른 조건부 렌더링) */}
                <Route
                    path="/"
                    element={
                        /* ⭐️ 여기서 중괄호 한 세트를 제거했습니다. */
                        !user ? (
                            <LandingPage onLogin={handleLogin} />
                        ) : (
                            user.role === 'ADMIN' || user.username === 'admin' ? (
                                <AdminDashboard user={user} onLogout={handleLogout} />
                            ) : (
                                <AgentDashboard user={user} onLogout={handleLogout} />
                            )
                        )
                    }
                />

                {/* 잘못된 경로는 메인으로 */}
                <Route path="*" element={<Navigate to="/" />} />
            </Routes>
        </Router>
    );
}

export default App;
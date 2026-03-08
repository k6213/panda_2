import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AgentDashboard from './AgentDashboard';
import AdminDashboard from './AdminDashboard';
import LandingPage from './LandingPage';
import LeadCapture from './LeadCapture';

function App() {
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true); // 로딩 상태 추가

    // ⭐️ [신규] 앱 실행 시 세션 스토리지 확인 (새로고침 해도 로그인 유지)
    useEffect(() => {
        const savedToken = sessionStorage.getItem('token');
        const savedUser = sessionStorage.getItem('user');

        if (savedToken && savedUser) {
            try {
                setUser(JSON.parse(savedUser));
            } catch (e) {
                console.error("세션 복구 실패", e);
                sessionStorage.clear();
            }
        }
        setIsLoading(false);
    }, []);

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
                    // ⭐️ [수정] localStorage -> sessionStorage (탭별 독립 저장)
                    sessionStorage.setItem('token', data.token);
                    sessionStorage.setItem('user', JSON.stringify(data)); // 유저 정보도 저장
                }
                setUser(data);
            })
            .catch(() => alert('아이디 또는 비밀번호가 일치하지 않습니다.'));
    };

    const handleLogout = () => {
        // ⭐️ [수정] 로그아웃 시 세션 스토리지 비우기
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
        setUser(null);
    };

    if (isLoading) return null; // 로딩 중이면 깜빡임 방지

    return (
        <Router>
            <Routes>
                {/* 1. 고객용 상담 신청 페이지 (로그인 불필요) */}
                <Route path="/apply" element={<LeadCapture />} />

                {/* 2. 업무용 시스템 (로그인 여부에 따른 조건부 렌더링) */}
                <Route
                    path="/"
                    element={
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
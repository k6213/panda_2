import React, { useState } from 'react';
import AgentDashboard from './AgentDashboard';
import AdminDashboard from './AdminDashboard';
import LandingPage from './LandingPage'; // 새로 만든 업무용 랜딩페이지

function App() {
    const [user, setUser] = useState(null);

    // 로그인 처리 함수 (LandingPage에서 아이디/비번을 받아옴)
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
                // alert(`${data.username}님, 오늘도 좋은 하루 되세요! ☀️`); // (선택사항) 환영 메시지
                setUser(data);
            })
            .catch(() => alert('아이디 또는 비밀번호가 일치하지 않습니다.'));
    };

    const handleLogout = () => {
        setUser(null);
    };

    // 1. 로그인 전이면 -> 업무용 랜딩(로그인) 페이지 보여줌
    if (!user) {
        return <LandingPage onLogin={handleLogin} />;
    }

    // 2. 관리자 로그인 시
    if (user.role === 'ADMIN' || user.username === 'admin') {
        return <AdminDashboard user={user} onLogout={handleLogout} />;
    }

    // 3. 상담원 로그인 시
    return <AgentDashboard user={user} onLogout={handleLogout} />;
}

export default App;
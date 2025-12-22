import React, { useState } from 'react';
import AgentDashboard from './AgentDashboard';
import AdminDashboard from './AdminDashboard';
import LandingPage from './LandingPage';

function App() {
    const [user, setUser] = useState(null);

    // 로그인 처리 함수
    const handleLogin = (username, password) => {
        // ⚠️ 주의: 백엔드 CORS 설정 주소와 똑같이 맞춰주세요 (localhost 또는 127.0.0.1)
        fetch('https://panda-1-hd18.onrender.com/api/login/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        })
            .then(res => {
                if (res.ok) return res.json();
                throw new Error('로그인 실패');
            })
            .then(data => {
                // ⭐️ [핵심 수정] 서버가 준 'token'을 브라우저에 저장합니다.
                if (data.token) {
                    localStorage.setItem('token', data.token);
                }

                // 사용자 정보 상태 업데이트
                setUser(data);
            })
            .catch(() => alert('아이디 또는 비밀번호가 일치하지 않습니다.'));
    };

    const handleLogout = () => {
        // ⭐️ [핵심 수정] 로그아웃 시 저장된 토큰도 삭제합니다.
        localStorage.removeItem('token');
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
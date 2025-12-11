import React, { useState } from 'react';

function LandingPage({ onLogin }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    // 엔터키 치면 로그인
    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            onLogin(username, password);
        }
    };

    return (
        <div className="min-h-screen flex bg-[#1e1e1e] font-sans overflow-hidden">

            {/* [왼쪽] 비주얼 영역 (브랜딩 & 시스템 정보) */}
            <div className="hidden lg:flex w-1/2 bg-[#2b2b2b] relative justify-center items-center overflow-hidden border-r border-gray-700">
                {/* 배경 장식 (은은한 그라데이션 원) */}
                <div className="absolute top-[-20%] left-[-20%] w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[100px]"></div>
                <div className="absolute bottom-[-20%] right-[-20%] w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[100px]"></div>

                <div className="relative z-10 p-12 text-white max-w-lg">
                    <div className="text-6xl mb-6">🐼</div>
                    <h1 className="text-5xl font-bold mb-4 leading-tight">
                        Pandanet<br />
                        <span className="text-blue-500">CRM System</span>
                    </h1>
                    <p className="text-gray-400 text-lg mb-8 leading-relaxed">
                        판다넷 통합 영업 관리 시스템에 오신 것을 환영합니다.<br />
                        고객 DB 관리, 상담 내역 기록, 정산 관리까지<br />
                        하나의 플랫폼에서 효율적으로 처리하세요.
                    </p>

                    {/* 시스템 공지사항 박스 (예시) */}
                    <div className="bg-white/5 backdrop-blur-sm p-6 rounded-xl border border-white/10">
                        <h3 className="text-sm font-bold text-gray-300 mb-2">📢 시스템 공지</h3>
                        <ul className="text-sm text-gray-500 space-y-2">
                            <li>• 12월 플랫폼별 단가표가 업데이트되었습니다.</li>
                            <li>• 서버 정기 점검: 매주 일요일 04:00 ~ 05:00</li>
                            <li>• 보안을 위해 비밀번호를 3개월마다 변경해주세요.</li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* [오른쪽] 로그인 폼 영역 */}
            <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-8 bg-[#1e1e1e]">
                <div className="w-full max-w-md">

                    <div className="text-center mb-10">
                        <h2 className="text-3xl font-bold text-white mb-2">업무 시스템 접속</h2>
                        <p className="text-gray-500 text-sm">Authorized Personnel Only</p>
                    </div>

                    <div className="flex flex-col gap-5">
                        <div>
                            <label className="block text-gray-400 text-sm font-bold mb-2 ml-1">사번 / 아이디</label>
                            <input
                                className="w-full p-4 bg-[#2b2b2b] border border-gray-600 rounded-xl text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                                placeholder="아이디를 입력하세요"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="block text-gray-400 text-sm font-bold mb-2 ml-1">비밀번호</label>
                            <input
                                type="password"
                                className="w-full p-4 bg-[#2b2b2b] border border-gray-600 rounded-xl text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                                placeholder="비밀번호를 입력하세요"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                onKeyPress={handleKeyPress}
                            />
                        </div>

                        <button
                            onClick={() => onLogin(username, password)}
                            className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-900/30 transition transform active:scale-95 mt-4"
                        >
                            로그인
                        </button>
                    </div>

                    <div className="mt-8 text-center">
                        <p className="text-gray-600 text-sm">
                            계정 분실 및 접속 장애 문의<br />
                            <span className="text-blue-500 font-bold cursor-pointer hover:underline">IT 지원팀 : 02-1234-5678</span>
                        </p>
                    </div>

                    <div className="mt-12 flex justify-center gap-4 text-gray-600 text-xs">
                        <span>개인정보처리방침</span>
                        <span>|</span>
                        <span>보안 서약서 확인</span>
                    </div>

                </div>
            </div>
        </div>
    );
}

export default LandingPage;
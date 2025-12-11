import React, { useState, useEffect } from 'react';

function AdminDashboard({ user, onLogout }) {
    const [activeTab, setActiveTab] = useState('stats');

    const [stats, setStats] = useState(null);
    const [agents, setAgents] = useState([]);
    const [asRequests, setAsRequests] = useState([]);
    const [platforms, setPlatforms] = useState([]);
    const [reasons, setReasons] = useState([]);
    const [sharedCustomers, setSharedCustomers] = useState([]);
    const [allCustomers, setAllCustomers] = useState([]);

    // [NEW] 선택 및 배정 관련 상태
    const [selectedIds, setSelectedIds] = useState([]); // 체크된 DB ID들
    const [targetAgentId, setTargetAgentId] = useState(''); // 배정할 상담사 ID

    const [showUploadModal, setShowUploadModal] = useState(false);
    const [pasteData, setPasteData] = useState('');
    const [parsedData, setParsedData] = useState([]);

    const [newAgent, setNewAgent] = useState({ username: '', password: '' });
    const [newPlatform, setNewPlatform] = useState({ name: '', cost: '' });
    const [newReason, setNewReason] = useState('');
    const [statDetail, setStatDetail] = useState(null);

    // 10초 자동 갱신
    useEffect(() => {
        const fetchData = () => {
            if (activeTab === 'stats') fetch('http://127.0.0.1:8000/api/stats/').then(res => res.json()).then(setStats);
            else if (activeTab === 'shared') fetch('http://127.0.0.1:8000/api/customers/').then(res => res.json()).then(data => setSharedCustomers(data.filter(c => c.owner === null)));
            else if (activeTab === 'as_manage') fetch('http://127.0.0.1:8000/api/customers/').then(res => res.json()).then(data => setAsRequests(data.filter(c => c.status === 'AS요청')));
            else if (activeTab === 'users') fetch('http://127.0.0.1:8000/api/agents/').then(res => res.json()).then(setAgents);
            else if (activeTab === 'settings') {
                fetch('http://127.0.0.1:8000/api/platforms/').then(res => res.json()).then(setPlatforms);
                fetch('http://127.0.0.1:8000/api/failure_reasons/').then(res => res.json()).then(setReasons);
            }
            // 배정 기능을 위해 상담사 목록은 항상 필요할 수 있음
            fetch('http://127.0.0.1:8000/api/agents/').then(res => res.json()).then(setAgents);
            fetch('http://127.0.0.1:8000/api/customers/').then(res => res.json()).then(setAllCustomers);
        };

        fetchData();
        const interval = setInterval(() => {
            if (!showUploadModal && activeTab !== 'settings') fetchData();
        }, 10000);
        return () => clearInterval(interval);
    }, [activeTab, showUploadModal]);

    // --- 체크박스 핸들러 ---
    // 전체 선택/해제
    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedIds(sharedCustomers.map(c => c.id));
        } else {
            setSelectedIds([]);
        }
    };

    // 개별 선택/해제
    const handleCheck = (id) => {
        if (selectedIds.includes(id)) {
            setSelectedIds(selectedIds.filter(sid => sid !== id));
        } else {
            setSelectedIds([...selectedIds, id]);
        }
    };

    // --- [기능] 일괄 배정 실행 ---
    const handleAllocate = () => {
        if (selectedIds.length === 0) return alert("배정할 DB를 선택해주세요.");
        if (!targetAgentId) return alert("누구에게 줄지 상담사를 선택해주세요.");

        const agentName = agents.find(a => a.id === parseInt(targetAgentId))?.username;
        if (!window.confirm(`선택한 ${selectedIds.length}개의 DB를 '${agentName}'님에게 배정하시겠습니까?`)) return;

        fetch('http://127.0.0.1:8000/api/customers/allocate/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                customer_ids: selectedIds,
                agent_id: targetAgentId
            })
        }).then(res => res.json()).then(data => {
            alert(data.message);
            setSelectedIds([]); // 선택 초기화

            // 목록 새로고침
            fetch('http://127.0.0.1:8000/api/customers/').then(res => res.json()).then(data => setSharedCustomers(data.filter(c => c.owner === null)));
        });
    };

    // --- 기존 핸들러들 ---
    const handlePaste = (e) => {
        const text = e.target.value; setPasteData(text);
        const rows = text.trim().split('\n').map(row => {
            const cols = row.split('\t');
            return { name: cols[0] || '', phone: cols[1] || '', platform: cols[2] || '', last_memo: cols[3] || '', upload_date: new Date().toISOString().slice(0, 10) };
        });
        setParsedData(rows);
    };
    const handleBulkSubmit = () => {
        if (parsedData.length === 0) return;
        fetch('http://127.0.0.1:8000/api/customers/bulk_upload/', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customers: parsedData })
        }).then(res => res.json()).then(data => {
            alert(data.message); setShowUploadModal(false); setPasteData(''); setParsedData([]);
        });
    };
    const isDuplicate = (phone) => allCustomers.some(c => c.phone === phone);
    const handleCreateAgent = () => { fetch('http://127.0.0.1:8000/api/agents/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newAgent) }).then(res => { if (res.ok) { alert("완료"); setNewAgent({ username: '', password: '' }); } }); };
    const handleDeleteAgent = (id, name) => { if (window.confirm(`'${name}' 삭제?`)) fetch(`http://127.0.0.1:8000/api/agents/${id}/`, { method: 'DELETE' }); };
    const handleDeleteCustomer = (id) => { if (window.confirm("DB 삭제?")) fetch(`http://127.0.0.1:8000/api/customers/${id}/`, { method: 'DELETE' }); };
    const handleAsAction = (id, action) => { if (!window.confirm("처리?")) return; fetch(`http://127.0.0.1:8000/api/customers/${id}/handle_as/`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) }).then(res => res.json()).then(data => { alert(data.message); }); };
    const handleSavePlatform = () => { fetch('http://127.0.0.1:8000/api/platforms/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newPlatform) }).then(res => { if (res.ok) { alert("저장됨"); setNewPlatform({ name: '', cost: '' }); } }); };
    const handleDeletePlatform = (id) => { if (window.confirm("삭제?")) fetch(`http://127.0.0.1:8000/api/platforms/${id}/`, { method: 'DELETE' }); };
    const handleAddReason = () => { fetch('http://127.0.0.1:8000/api/failure_reasons/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: newReason }) }).then(() => { alert("추가됨"); setNewReason(''); }); };
    const handleDeleteReason = (id) => { if (!window.confirm("삭제?")) return; fetch(`http://127.0.0.1:8000/api/failure_reasons/${id}/`, { method: 'DELETE' }); };
    const handleApplyAllCosts = () => { if (window.confirm("전체 적용?")) fetch('http://127.0.0.1:8000/api/platforms/apply_all/', { method: 'POST' }).then(res => res.json()).then(data => alert(data.message)); };

    return (
        <div className="min-h-screen bg-[#2b2b2b] text-gray-100 p-5 font-sans">
            <header className="flex justify-between items-center bg-[#1e1e1e] p-4 rounded-xl shadow-lg mb-6 border-l-4 border-yellow-500">
                <h1 className="text-xl font-bold text-white flex items-center gap-2">👑 관리자 대시보드</h1>
                <div className="flex gap-2">
                    <button onClick={() => setShowUploadModal(true)} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-bold transition">📤 DB 등록</button>
                    <button onClick={onLogout} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-bold transition">로그아웃</button>
                </div>
            </header>

            <div className="flex justify-between items-end mb-4 border-b border-gray-600 pb-1">
                <div className="flex gap-2">
                    {['stats', 'shared', 'as_manage', 'users', 'settings'].map(tab => (
                        <button key={tab} onClick={() => setActiveTab(tab)} className={`px-6 py-3 rounded-t-lg font-bold transition duration-200 ${activeTab === tab ? 'bg-[#3498db] text-white' : 'bg-[#383838] text-gray-400 hover:bg-[#444]'}`}>
                            {tab === 'stats' && "📊 실적 현황"}
                            {tab === 'shared' && `🛒 공유DB (${sharedCustomers.length})`}
                            {tab === 'as_manage' && `🛠 AS 관리 (${asRequests.length})`}
                            {tab === 'users' && "👥 상담사 관리"}
                            {tab === 'settings' && "⚙️ 설정"}
                        </button>
                    ))}
                </div>
            </div>

            <div className="bg-[#383838] rounded-xl shadow-xl min-h-[600px] border border-gray-700 p-6 overflow-x-auto">
                {activeTab === 'stats' && stats && (
                    <div>
                        <h2 className="text-2xl font-bold mb-6 border-l-4 border-yellow-500 pl-4">📅 {stats.month}월 통합 영업 현황</h2>
                        <div className="grid grid-cols-4 gap-4 mb-8">
                            <div onClick={() => setStatDetail('db')} className={`bg-[#444] p-6 rounded-xl shadow cursor-pointer border border-gray-600 hover:border-blue-500 transition ${statDetail === 'db' ? 'ring-2 ring-blue-500' : ''}`}><h3 className="text-gray-400 text-sm">유효 DB 유입</h3><p className="text-3xl font-bold text-white mt-2">{stats.total_db}건</p></div>
                            <div className="bg-[#444] p-6 rounded-xl shadow border border-gray-600 text-center"><h3 className="text-gray-400 text-sm">총 접수</h3><p className="text-3xl font-bold text-blue-400 mt-2">{stats.success_count}건</p><span className="text-xs text-gray-500">접수율 {stats.success_rate}%</span></div>
                            <div onClick={() => setStatDetail('ad')} className={`bg-[#444] p-6 rounded-xl shadow cursor-pointer border border-gray-600 hover:border-blue-500 transition ${statDetail === 'ad' ? 'ring-2 ring-blue-500' : ''}`}><h3 className="text-gray-400 text-sm">예상 매출</h3><p className="text-3xl font-bold text-white mt-2">{stats.total_revenue.toLocaleString()}원</p></div>
                            <div onClick={() => setStatDetail('revenue')} className={`bg-[#1e3a2a] p-6 rounded-xl shadow cursor-pointer border border-green-600 hover:brightness-110 transition ${statDetail === 'revenue' ? 'ring-2 ring-green-500' : ''}`}><h3 className="text-green-300 text-sm">💰 순수익</h3><p className="text-3xl font-bold text-green-400 mt-2">{stats.net_profit.toLocaleString()}원</p><span className="text-xs text-green-200/50">광고비 -{stats.total_ad_cost.toLocaleString()}</span></div>
                        </div>
                        {statDetail && stats.details && (
                            <div className="bg-[#2b2b2b] p-4 rounded-xl border border-gray-600 mb-8 animate-fade-in-down">
                                <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-blue-400">📋 상세 내역</h3><button onClick={() => setStatDetail(null)} className="text-gray-400 hover:text-white">✖ 닫기</button></div>
                                <table className="w-full text-sm text-left"><thead className="bg-[#1e1e1e] text-gray-400"><tr><th className="p-2">날짜</th><th className="p-2">상담사</th><th className="p-2">고객명</th><th className="p-2">플랫폼</th><th className="p-2">내용</th></tr></thead>
                                    <tbody className="text-gray-300">{stats.details.map(c => <tr key={c.id} className="border-b border-gray-700 hover:bg-[#444]"><td className="p-2">{c.upload_date}</td><td className="p-2">{c.agent}</td><td className="p-2">{c.name}</td><td className="p-2">{c.platform}</td><td className="p-2">{statDetail === 'ad' && <span className="text-red-400">-{c.ad_cost.toLocaleString()}원</span>}{statDetail === 'revenue' && <span className={c.revenue > 0 ? 'text-green-400' : 'text-gray-500'}>{c.status} (익: {c.net_profit.toLocaleString()}원)</span>}{statDetail === 'db' && c.status}</td></tr>)}</tbody></table>
                            </div>
                        )}
                        <div className="bg-[#2b2b2b] p-4 rounded-xl border border-gray-600">
                            <h3 className="font-bold mb-4 text-white">🏆 상담사별 랭킹</h3>
                            <table className="w-full text-sm text-left"><thead className="bg-[#1e1e1e] text-gray-400"><tr><th className="p-3">순위</th><th className="p-3">상담사</th><th className="p-3">배정</th><th className="p-3">접수</th><th className="p-3">율</th><th className="p-3">기여도</th><th className="p-3">매출</th></tr></thead><tbody className="text-gray-300">{stats.agent_stats.map((agent, idx) => (<tr key={idx} className="border-b border-gray-700 hover:bg-[#444]"><td className="p-3">{idx + 1}위</td><td className="p-3 font-bold">{agent.name}</td><td className="p-3">{agent.total}</td><td className="p-3">{agent.count}</td><td className="p-3">{agent.rate}%</td><td className="p-3 w-1/4"><div className="w-full bg-gray-600 rounded h-2"><div className="bg-blue-500 h-2 rounded" style={{ width: `${(agent.revenue / stats.total_revenue * 100) || 0}%` }}></div></div></td><td className="p-3 font-bold text-green-400">{agent.revenue.toLocaleString()}원</td></tr>))}</tbody></table>
                        </div>
                    </div>
                )}

                {/* ⭐️ [수정] 공유 DB 탭 (일괄 배정 기능 추가) */}
                {activeTab === 'shared' && (
                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold">🛒 미배정 DB 관리</h2>

                            {/* 일괄 배정 컨트롤러 */}
                            <div className="flex gap-2 bg-[#2b2b2b] p-2 rounded border border-gray-600">
                                <select
                                    className="bg-[#444] text-white p-2 rounded border border-gray-500 text-sm"
                                    value={targetAgentId}
                                    onChange={e => setTargetAgentId(e.target.value)}
                                >
                                    <option value="">상담사 선택...</option>
                                    {agents.map(a => <option key={a.id} value={a.id}>{a.username}</option>)}
                                </select>
                                <button
                                    onClick={handleAllocate}
                                    className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded font-bold text-sm transition"
                                >
                                    {selectedIds.length > 0 ? `${selectedIds.length}건 배정` : '일괄 배정'}
                                </button>
                            </div>
                        </div>

                        <table className="w-full text-left text-sm text-gray-300">
                            <thead className="bg-[#1e1e1e]">
                                <tr>
                                    <th className="p-3 w-10">
                                        <input type="checkbox" className="w-4 h-4 cursor-pointer accent-blue-500" onChange={handleSelectAll} checked={sharedCustomers.length > 0 && selectedIds.length === sharedCustomers.length} />
                                    </th>
                                    <th className="p-3">날짜</th><th className="p-3">플랫폼</th><th className="p-3">이름</th><th className="p-3">번호</th><th className="p-3">광고비</th><th className="p-3">관리</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sharedCustomers.map(c => (
                                    <tr key={c.id} className={`border-b border-gray-700 hover:bg-[#444] ${selectedIds.includes(c.id) ? 'bg-[#3b3b4f]' : ''}`}>
                                        <td className="p-3">
                                            <input type="checkbox" className="w-4 h-4 cursor-pointer accent-blue-500" checked={selectedIds.includes(c.id)} onChange={() => handleCheck(c.id)} />
                                        </td>
                                        <td className="p-3">{c.upload_date}</td>
                                        <td className="p-3"><span className="bg-gray-600 px-2 py-1 rounded text-xs">{c.platform}</span></td>
                                        <td className="p-3 font-bold">{c.name}</td>
                                        <td className="p-3">{c.phone}</td>
                                        <td className="p-3">{c.ad_cost.toLocaleString()}</td>
                                        <td className="p-3"><button onClick={() => handleDeleteCustomer(c.id)} className="bg-red-600 text-white px-2 py-1 rounded text-xs">삭제</button></td>
                                    </tr>
                                ))}
                                {sharedCustomers.length === 0 && <tr><td colSpan="7" className="p-10 text-center text-gray-500">배정할 DB가 없습니다.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                )}

                {activeTab === 'as_manage' && (
                    <div>
                        <h2 className="text-xl font-bold mb-4">🚨 AS 요청 승인</h2>
                        <table className="w-full text-left text-sm text-gray-300"><thead className="bg-[#1e1e1e]"><tr><th className="p-3">상담사</th><th className="p-3">고객명</th><th className="p-3">사유</th><th className="p-3">관리</th></tr></thead><tbody>{asRequests.map(req => <tr key={req.id} className="border-b border-gray-700 hover:bg-[#444]"><td className="p-3">{req.owner}</td><td className="p-3">{req.name}</td><td className="p-3 text-red-400 font-bold">{req.as_reason}</td><td className="p-3"><button onClick={() => handleAsAction(req.id, 'approve')} className="bg-green-600 mr-2 px-2 py-1 rounded text-white text-xs">승인</button><button onClick={() => handleAsAction(req.id, 'reject')} className="bg-red-600 px-2 py-1 rounded text-white text-xs">반려</button></td></tr>)}</tbody></table>
                    </div>
                )}

                {activeTab === 'users' && (
                    <div className="flex gap-6">
                        <div className="w-1/3 bg-[#2b2b2b] p-6 rounded border border-gray-600">
                            <h3 className="font-bold mb-4">➕ 상담사 등록</h3>
                            <input className="w-full bg-[#444] p-2 rounded mb-2 border border-gray-600" placeholder="아이디" onChange={e => setNewAgent({ ...newAgent, username: e.target.value })} />
                            <input type="password" className="w-full bg-[#444] p-2 rounded mb-4 border border-gray-600" placeholder="비번" onChange={e => setNewAgent({ ...newAgent, password: e.target.value })} />
                            <button onClick={handleCreateAgent} className="w-full bg-blue-600 py-2 rounded text-white font-bold">등록</button>
                        </div>
                        <div className="w-2/3 bg-[#2b2b2b] p-6 rounded border border-gray-600">
                            <table className="w-full text-sm text-left text-gray-300"><thead className="bg-[#1e1e1e]"><tr><th className="p-2">아이디</th><th className="p-2">접속</th><th className="p-2">관리</th></tr></thead><tbody>{agents.map(a => <tr key={a.id} className="border-b border-gray-700"><td className="p-2">{a.username}</td><td className="p-2">{a.last_login}</td><td className="p-2"><button onClick={() => handleDeleteAgent(a.id, a.username)} className="text-red-400">삭제</button></td></tr>)}</tbody></table>
                        </div>
                    </div>
                )}

                {activeTab === 'settings' && (
                    <div className="grid grid-cols-2 gap-6">
                        <div className="bg-[#2b2b2b] p-6 rounded border border-gray-600">
                            <div className="flex justify-between items-center mb-4"><h3 className="font-bold">🏷️ 플랫폼 단가</h3><button onClick={handleApplyAllCosts} className="bg-green-600 px-2 py-1 rounded text-xs font-bold text-white">🔄 전체 적용</button></div>
                            <div className="flex gap-2 mb-4"><input className="bg-[#444] p-2 rounded w-1/3 border border-gray-600" placeholder="이름" onChange={e => setNewPlatform({ ...newPlatform, name: e.target.value })} /><input type="number" className="bg-[#444] p-2 rounded w-1/3 border border-gray-600" placeholder="단가" onChange={e => setNewPlatform({ ...newPlatform, cost: e.target.value })} /><button onClick={handleSavePlatform} className="bg-blue-600 px-4 rounded text-white">저장</button></div>
                            <table className="w-full text-sm text-gray-300"><thead className="bg-[#1e1e1e]"><tr><th className="p-2">플랫폼</th><th className="p-2">단가</th><th className="p-2">삭제</th></tr></thead><tbody>{platforms.map(p => <tr key={p.id} className="border-b border-gray-700"><td className="p-2">{p.name}</td><td className="p-2">{p.cost.toLocaleString()}</td><td className="p-2"><button onClick={() => handleDeletePlatform(p.id)} className="text-red-400">×</button></td></tr>)}</tbody></table>
                        </div>
                        <div className="bg-[#2b2b2b] p-6 rounded border border-gray-600">
                            <h3 className="font-bold mb-4">🚫 실패 사유</h3>
                            <div className="flex gap-2 mb-4"><input className="bg-[#444] p-2 rounded flex-1 border border-gray-600" placeholder="사유" onChange={e => setNewReason(e.target.value)} /><button onClick={handleAddReason} className="bg-blue-600 px-4 rounded text-white">추가</button></div>
                            <div className="flex flex-wrap gap-2">{reasons.map(r => <span key={r.id} className="bg-[#442b2b] text-red-300 px-3 py-1 rounded-full text-sm border border-red-900 flex items-center gap-2">{r.reason}<button onClick={() => handleDeleteReason(r.id)}>×</button></span>)}</div>
                        </div>
                    </div>
                )}
            </div>

            {showUploadModal && (
                <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center backdrop-blur-sm z-50">
                    <div className="bg-[#383838] p-6 rounded-xl w-[600px] border border-gray-600 text-white">
                        <h2 className="text-xl font-bold mb-4">📤 엑셀 복사 등록</h2>
                        <textarea placeholder="[이름] [번호] [플랫폼] [메모] 순서로 붙여넣기" className="w-full h-40 bg-[#2b2b2b] p-3 rounded border border-gray-600 text-sm font-mono mb-4" value={pasteData} onChange={handlePaste} />
                        <div className="flex justify-end gap-2"><button onClick={() => setShowUploadModal(false)} className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded">취소</button><button onClick={handleBulkSubmit} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded font-bold">등록하기</button></div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default AdminDashboard;
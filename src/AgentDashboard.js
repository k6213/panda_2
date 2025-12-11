import React, { useState, useEffect, useMemo } from 'react';

// AS 사유 리스트
const AS_REASONS = ["결번(없는번호)", "본인아님", "중복DB", "미성년자", "단순거절(욕설)", "기타"];

function AgentDashboard({ user, onLogout }) {
    const [customers, setCustomers] = useState([]);
    const [failureReasons, setFailureReasons] = useState([]);
    const [activeTab, setActiveTab] = useState('shared');
    const [searchTerm, setSearchTerm] = useState('');
    const [myStats, setMyStats] = useState(null);
    const [statDetail, setStatDetail] = useState(null);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [pasteData, setPasteData] = useState('');
    const [parsedData, setParsedData] = useState([]);
    const [newLog, setNewLog] = useState('');

    const [editData, setEditData] = useState({
        status: '', policy_amt: 0, support_amt: 0, installed_date: '', product_info: '',
        callback_schedule: '', rank: 1, ad_cost: 0, usim_info: '', checklist: [],
        additional_info: '', last_memo: '', as_reason: '', detail_reason: ''
    });

    // 데이터 로딩 함수
    const fetchCustomers = () => fetch('https://panda-1-hd18.onrender.com/api/customers/').then(res => res.json()).then(setCustomers);
    const fetchFailureReasons = () => fetch('https://panda-1-hd18.onrender.com/api/failure_reasons/').then(res => res.json()).then(setFailureReasons);
    const fetchMyStats = () => {
        if (!user) return;
        fetch(`https://panda-1-hd18.onrender.com/api/my_stats/?user_id=${user.user_id}`).then(res => res.json()).then(setMyStats);
    };

    // ⭐️ [핵심] 10초 자동 갱신 로직
    useEffect(() => {
        if (user) {
            // 1. 처음 접속 시 실행
            fetchCustomers();
            fetchFailureReasons();

            // 2. 10초마다 반복 실행 (폴링)
            const interval = setInterval(() => {
                // 팝업이 열려있지 않을 때만 갱신 (입력 중 방해 금지)
                if (!selectedCustomer && !showUploadModal) {
                    fetchCustomers();
                }
            }, 10000); // 10000ms = 10초

            // 3. 화면 끌 때 종료
            return () => clearInterval(interval);
        }
    }, [user, selectedCustomer, showUploadModal]);

    // 통계 탭 누를 때마다 갱신
    useEffect(() => { if (activeTab === 'report') fetchMyStats(); }, [activeTab]);

    const duplicateSet = useMemo(() => {
        const phoneCounts = {};
        const dups = new Set();
        customers.forEach(c => { const p = c.phone.trim(); phoneCounts[p] = (phoneCounts[p] || 0) + 1; });
        Object.keys(phoneCounts).forEach(phone => { if (phoneCounts[phone] > 1) dups.add(phone); });
        return dups;
    }, [customers]);

    // 핸들러 함수들
    const handleAssign = (id) => {
        if (!window.confirm("담당하시겠습니까?")) return;
        fetch(`https://panda-1-hd18.onrender.com/api/customers/${id}/assign/`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: user.user_id })
        }).then(() => { alert("배정 완료!"); fetchCustomers(); setActiveTab('consult'); });
    };

    const handleUpdateInfo = () => {
        if (!selectedCustomer) return;
        const payload = { ...editData, checklist: editData.checklist.join(',') };
        fetch(`https://panda-1-hd18.onrender.com/api/customers/${selectedCustomer.id}/update/`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        }).then(() => { alert("저장됨"); fetchCustomers(); setSelectedCustomer(null); });
    };

    const handleToggleComplete = (e, customer) => {
        e.stopPropagation();
        const currentList = customer.checklist ? customer.checklist.split(',') : [];
        const isDone = currentList.includes('완료');
        const newList = isDone ? [] : ['완료'];
        fetch(`https://panda-1-hd18.onrender.com/api/customers/${customer.id}/update/`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ checklist: newList.join(',') })
        }).then(() => {
            const updated = customers.map(c => c.id === customer.id ? { ...c, checklist: newList.join(',') } : c);
            setCustomers(updated);
        });
    };

    const handleAddLog = () => {
        if (!newLog) return;
        fetch(`https://panda-1-hd18.onrender.com/api/customers/${selectedCustomer.id}/add_log/`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: user.user_id, content: newLog })
        }).then(res => res.ok ? fetch('https://panda-1-hd18.onrender.com/api/customers/') : Promise.reject()).then(res => res.json()).then(data => { setCustomers(data); const updated = data.find(c => c.id === selectedCustomer.id); if (updated) setSelectedCustomer(updated); setNewLog(''); });
    };

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
        fetch('https://panda-1-hd18.onrender.com/api/customers/bulk_upload/', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customers: parsedData })
        }).then(res => res.json()).then(data => { alert(data.message); setShowUploadModal(false); setPasteData(''); setParsedData([]); fetchCustomers(); });
    };

    const openModal = (c) => {
        setSelectedCustomer(c);
        setEditData({
            status: c.status || '미통건', policy_amt: c.policy_amt || 0, support_amt: c.support_amt || 0, installed_date: c.installed_date || '', product_info: c.product_info || '', callback_schedule: c.callback_schedule || '', rank: c.rank || 1, ad_cost: c.ad_cost || 0, usim_info: c.usim_info || '', checklist: c.checklist ? c.checklist.split(',') : [], additional_info: c.additional_info || '', last_memo: c.last_memo || '', as_reason: c.as_reason || '', detail_reason: c.detail_reason || ''
        });
        setNewLog('');
    };

    const isDuplicate = (phone) => customers.some(c => c.phone === phone);
    const renderStars = (currentRank, setRank) => [...Array(5)].map((_, i) => (<span key={i} onClick={() => setRank && setRank(i + 1)} className={`cursor-pointer text-lg ${i < currentRank ? 'text-yellow-400' : 'text-gray-600'}`}>★</span>));
    const toManwon = (val) => (Number(val) * 10000).toLocaleString();

    const allMyCustomers = customers.filter(c => c.owner === user.user_id);
    const sharedDB = customers.filter(c => c.owner === null);
    const consultDB = allMyCustomers.filter(c => ['미통건', '부재', '재통', '가망', 'AS요청', 'AS승인', '실패'].includes(c.status));
    const salesDB = allMyCustomers.filter(c => ['접수완료', '개통완료', '해지진행', '접수취소'].includes(c.status));
    const thisMonthDB = allMyCustomers.filter(c => myStats && c.upload_date.startsWith(myStats.month));

    let currentData = activeTab === 'shared' ? sharedDB : activeTab === 'consult' ? consultDB : salesDB;
    currentData = currentData.filter(c => c.name.includes(searchTerm) || c.phone.includes(searchTerm));

    const getBadgeStyle = (status) => {
        switch (status) {
            case '접수완료': return 'bg-green-500 text-black';
            case '부재': return 'bg-red-500 text-white';
            case '가망': return 'bg-yellow-400 text-black';
            case 'AS요청': return 'bg-pink-500 text-white';
            case '실패': return 'bg-gray-500 text-gray-300 line-through';
            default: return 'bg-gray-600 text-white';
        }
    };

    return (
        <div className="min-h-screen bg-[#2b2b2b] text-gray-100 p-5 font-sans">
            <header className="flex justify-between items-center bg-[#1e1e1e] p-4 rounded-xl shadow-lg mb-6 border border-gray-700">
                <h1 className="text-xl font-bold text-white flex items-center gap-2">📞 {user.username}님의 워크스페이스</h1>
                <div className="flex gap-2">
                    <button onClick={() => setShowUploadModal(true)} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-bold transition">📤 DB 등록</button>
                    <button onClick={onLogout} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-bold transition">로그아웃</button>
                </div>
            </header>

            <div className="flex justify-between items-end mb-4 border-b border-gray-600 pb-1">
                <div className="flex gap-2">
                    {['shared', 'consult', 'sales', 'report'].map(tab => (
                        <button key={tab} onClick={() => setActiveTab(tab)} className={`px-6 py-3 rounded-t-lg font-bold transition duration-200 ${activeTab === tab ? 'bg-[#3498db] text-white' : 'bg-[#383838] text-gray-400 hover:bg-[#444]'}`}>
                            {tab === 'shared' && `🛒 공유DB (${sharedDB.length})`}
                            {tab === 'consult' && `📞 상담관리 (${consultDB.length})`}
                            {tab === 'sales' && `💰 접수관리 (${salesDB.length})`}
                            {tab === 'report' && `📊 통계`}
                        </button>
                    ))}
                </div>
                {activeTab !== 'report' && <input className="bg-[#444] border border-gray-600 rounded-full px-4 py-2 text-white outline-none focus:border-blue-500" placeholder="🔍 검색..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />}
            </div>

            <div className="bg-[#383838] rounded-xl shadow-xl min-h-[600px] border border-gray-700 p-4 overflow-x-auto">
                {activeTab !== 'report' ? (
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-[#2b2b2b] text-gray-400 border-b border-gray-600">
                                {activeTab === 'shared' && <><th className="p-3">등록일</th><th className="p-3">플랫폼</th><th className="p-3">이름</th><th className="p-3">전화번호</th><th className="p-3">메모</th><th className="p-3">상태</th><th className="p-3">관리</th></>}
                                {activeTab === 'consult' && <><th className="p-3">번호</th><th className="p-3">플랫폼</th><th className="p-3">상담일</th><th className="p-3">이름(진성도)</th><th className="p-3">번호</th><th className="p-3">재통일정</th><th className="p-3">상태</th><th className="p-3">내용</th></>}
                                {activeTab === 'sales' && <><th className="p-3">플랫폼</th><th className="p-3">접수일</th><th className="p-3">설치일</th><th className="p-3">이름</th><th className="p-3">번호</th><th className="p-3">정책</th><th className="p-3">지원</th><th className="p-3">수익</th><th className="p-3">상태</th><th className="p-3">상품/이력</th><th className="p-3 text-center">후처리</th></>}
                                <th className="p-3 text-red-400">비고</th>
                            </tr>
                        </thead>
                        <tbody>
                            {currentData.map((c) => {
                                const isDup = duplicateSet.has(c.phone.trim());
                                const isCompleted = c.checklist && c.checklist.includes('완료');
                                return (
                                    <tr key={c.id} onClick={() => activeTab !== 'shared' && openModal(c)} className={`border-b border-gray-600 hover:bg-[#444] transition cursor-pointer ${isDup ? 'bg-[#4a2b2b] hover:bg-[#5c3636]' : ''}`}>
                                        {activeTab === 'shared' && <>
                                            <td className="p-3">{c.upload_date}</td><td className="p-3"><span className="bg-gray-600 px-2 py-1 rounded text-xs">{c.platform}</span></td>
                                            <td className="p-3 font-bold">{c.name}</td><td className="p-3">{c.phone}</td><td className="p-3 text-gray-400 text-sm truncate max-w-[150px]">{c.last_memo}</td>
                                            <td className="p-3"><span className="bg-gray-500 px-2 py-1 rounded text-xs text-white">{c.status}</span></td>
                                            <td className="p-3"><button onClick={(e) => { e.stopPropagation(); handleAssign(c.id) }} className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm">⚡ 가져가기</button></td>
                                        </>}
                                        {activeTab === 'consult' && <>
                                            <td className="p-3">{c.id}</td><td className="p-3"><span className="bg-gray-600 px-2 py-1 rounded text-xs">{c.platform || '-'}</span></td><td className="p-3">{c.upload_date}</td>
                                            <td className="p-3 font-bold">{c.name}<div className="flex text-xs">{renderStars(c.rank)}</div></td><td className="p-3">{c.phone}</td>
                                            <td className="p-3">{c.callback_schedule ? <span className="bg-gray-700 text-yellow-400 px-2 py-1 rounded text-xs border border-yellow-500">{c.callback_schedule.replace('T', ' ')}</span> : '-'}</td>
                                            <td className="p-3"><span className={`px-2 py-1 rounded text-xs font-bold ${getBadgeStyle(c.status)}`}>{c.status}</span></td>
                                            <td className="p-3 text-gray-400 text-sm truncate max-w-[150px]">{c.last_memo || '-'}</td>
                                        </>}
                                        {activeTab === 'sales' && <>
                                            <td className="p-3"><span className="bg-gray-600 px-2 py-1 rounded text-xs">{c.platform || '-'}</span></td><td className="p-3">{c.upload_date}</td><td className="p-3 text-sm">{c.installed_date || <span className="text-red-400">미정</span>}</td>
                                            <td className="p-3 font-bold">{c.name}</td><td className="p-3">{c.phone}</td>
                                            <td className="p-3 text-sm">{c.policy_amt}만</td><td className="p-3 text-sm">{c.support_amt}만</td>
                                            <td className="p-3 font-bold text-green-400">{((c.policy_amt - c.support_amt) * 10000).toLocaleString()}원</td>
                                            <td className="p-3"><span className={`px-2 py-1 rounded text-xs font-bold ${getBadgeStyle(c.status)}`}>{c.status}</span></td>
                                            <td className="p-3 text-gray-400 text-sm truncate max-w-[150px]">{c.product_info}</td>
                                            <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}><input type="checkbox" className="w-5 h-5 accent-green-500 cursor-pointer" checked={isCompleted} onChange={(e) => handleToggleComplete(e, c)} /></td>
                                        </>}
                                        <td className="p-3 font-bold text-red-400">{isDup ? '❌ 중복' : ''}</td>
                                    </tr>
                                );
                            })}
                            {currentData.length === 0 && <tr><td colSpan="12" className="p-10 text-center text-gray-500">데이터가 없습니다.</td></tr>}
                        </tbody>
                    </table>
                ) : (
                    myStats && (
                        <div className="p-4">
                            <h2 className="text-2xl font-bold mb-6 border-l-4 border-yellow-500 pl-4">📊 {myStats.month}월 성적표</h2>
                            <div className="grid grid-cols-4 gap-4 mb-8">
                                <div onClick={() => setStatDetail('db')} className={`bg-[#444] p-6 rounded-xl shadow cursor-pointer border border-gray-600 hover:border-blue-500 transition ${statDetail === 'db' ? 'ring-2 ring-blue-500' : ''}`}>
                                    <h3 className="text-gray-400 text-sm">총 할당 DB</h3><p className="text-3xl font-bold text-white mt-2">{myStats.total_db}건</p>
                                </div>
                                <div className="bg-[#444] p-6 rounded-xl shadow border border-gray-600">
                                    <h3 className="text-gray-400 text-sm">접수율</h3><p className="text-3xl font-bold text-blue-400 mt-2">{myStats.accept_rate}%</p><span className="text-xs text-gray-500">{myStats.accept_count}건 접수</span>
                                </div>
                                <div onClick={() => setStatDetail('ad')} className={`bg-[#444] p-6 rounded-xl shadow cursor-pointer border border-gray-600 hover:border-blue-500 transition ${statDetail === 'ad' ? 'ring-2 ring-blue-500' : ''}`}>
                                    <h3 className="text-gray-400 text-sm">광고비 합계</h3><p className="text-3xl font-bold text-red-400 mt-2">-{myStats.total_ad_cost.toLocaleString()}</p>
                                </div>
                                <div onClick={() => setStatDetail('revenue')} className={`bg-[#1e3a2a] p-6 rounded-xl shadow cursor-pointer border border-green-600 hover:brightness-110 transition ${statDetail === 'revenue' ? 'ring-2 ring-green-500' : ''}`}>
                                    <h3 className="text-green-300 text-sm">💰 최종 순수익</h3><p className="text-3xl font-bold text-green-400 mt-2">{myStats.final_profit.toLocaleString()}원</p>
                                </div>
                            </div>
                            {statDetail && (
                                <div className="bg-[#2b2b2b] p-4 rounded-xl border border-gray-600 mb-8 animate-fade-in-down">
                                    <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-blue-400">📋 상세 내역 보기</h3><button onClick={() => setStatDetail(null)} className="text-gray-400 hover:text-white">✖ 닫기</button></div>
                                    <table className="w-full text-sm text-left"><thead className="bg-[#1e1e1e] text-gray-400"><tr><th className="p-2">날짜</th><th className="p-2">이름</th><th className="p-2">플랫폼</th><th className="p-2">내용</th></tr></thead><tbody className="text-gray-300">{thisMonthDB.map(c => <tr key={c.id} className="border-b border-gray-700 hover:bg-[#444]"><td className="p-2">{c.upload_date}</td><td className="p-2">{c.name}</td><td className="p-2">{c.platform}</td><td className="p-2">{statDetail === 'ad' && <span className="text-red-400">-{c.ad_cost.toLocaleString()}원</span>}{statDetail === 'revenue' && <span className={c.status === '접수완료' ? 'text-green-400' : 'text-gray-500'}>{c.status} (수익: {((c.policy_amt - c.support_amt) * 10000 - c.ad_cost).toLocaleString()}원)</span>}{statDetail === 'db' && c.status}</td></tr>)}</tbody></table>
                                </div>
                            )}
                            <div className="flex gap-6 mt-6">
                                <div className="flex-1 bg-[#2b2b2b] p-4 rounded-xl border border-gray-600"><h3 className="font-bold text-gray-300 mb-4">🚫 실패 사유</h3><table className="w-full text-sm text-left"><thead className="bg-[#1e1e1e] text-gray-400"><tr><th className="p-2">사유</th><th className="p-2">건수</th></tr></thead><tbody className="text-gray-300">{myStats.fail_reasons.map((item, i) => <tr key={i} className="border-b border-gray-700"><td className="p-2">{item.detail_reason}</td><td className="p-2">{item.count}건</td></tr>)}</tbody></table></div>
                                <div className="flex-1 bg-[#2b2b2b] p-4 rounded-xl border border-gray-600"><h3 className="font-bold text-gray-300 mb-4">↩️ 취소 사유</h3><table className="w-full text-sm text-left"><thead className="bg-[#1e1e1e] text-gray-400"><tr><th className="p-2">사유</th><th className="p-2">건수</th></tr></thead><tbody className="text-gray-300">{myStats.cancel_reasons.map((item, i) => <tr key={i} className="border-b border-gray-700"><td className="p-2">{item.detail_reason}</td><td className="p-2">{item.count}건</td></tr>)}</tbody></table></div>
                            </div>
                        </div>
                    )
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

            {selectedCustomer && (
                <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center backdrop-blur-sm z-50">
                    <div className="bg-[#383838] rounded-xl w-[1000px] h-[85vh] border border-gray-600 flex flex-col overflow-hidden text-gray-200">
                        <div className="flex justify-between items-center p-4 bg-[#2b2b2b] border-b border-gray-600">
                            <h2 className="text-xl font-bold">👤 {selectedCustomer.name} 통합 관리</h2>
                            <button onClick={() => setSelectedCustomer(null)} className="text-2xl hover:text-white">✖</button>
                        </div>
                        <div className="flex flex-1 overflow-hidden">

                            {/* ⭐️ [핵심 변경] 접수 관리일 때는 전체 너비(w-full), 아니면 반반(w-1/2) */}
                            <div className={`${activeTab === 'sales' ? 'w-full' : 'w-1/2 border-r'} p-6 overflow-y-auto border-gray-600 flex flex-col gap-4`}>

                                {/* A. 상담 관리 */}
                                {activeTab === 'consult' && (
                                    <>
                                        <div><label className="block text-gray-400 text-sm font-bold mb-1">진성도</label><div className="flex">{renderStars(editData.rank, r => setEditData({ ...editData, rank: r }))}</div></div>
                                        <div><label className="block text-gray-400 text-sm font-bold mb-1">상태</label><select className="w-full bg-[#444] border border-gray-600 rounded p-2" value={editData.status} onChange={e => setEditData({ ...editData, status: e.target.value })}>{['미통건', '부재', '재통', '가망', 'AS요청', '실패', '접수완료'].map(o => <option key={o} value={o}>{o}</option>)}</select></div>
                                        {editData.status === 'AS요청' && <div className="bg-red-900/30 p-3 rounded border border-red-800"><label className="text-red-400 text-sm font-bold block mb-1">🚨 AS 사유</label><select className="w-full bg-[#444] border border-red-500 rounded p-2" value={editData.as_reason} onChange={e => setEditData({ ...editData, as_reason: e.target.value })}><option value="">선택</option>{AS_REASONS.map(r => <option key={r} value={r}>{r}</option>)}</select></div>}
                                        {['실패', '접수취소', '해지진행'].includes(editData.status) && (
                                            <div className="bg-orange-900/30 p-3 rounded border border-orange-700 animate-fade-in-down">
                                                <label className="text-orange-400 text-sm font-bold block mb-1">🚫 상세 사유 (필수 선택)</label>
                                                <select className="w-full bg-[#444] border border-orange-500 rounded p-2" value={editData.detail_reason} onChange={e => setEditData({ ...editData, detail_reason: e.target.value })}><option value="">선택</option>{failureReasons.length > 0 ? failureReasons.map(r => (<option key={r.id} value={r.reason}>{r.reason}</option>)) : <option disabled>관리자가 등록한 사유가 없습니다.</option>}</select>
                                            </div>
                                        )}
                                        <div className="grid grid-cols-2 gap-2">
                                            <div><label className="block text-gray-400 text-sm font-bold mb-1">재통일정</label><input type="datetime-local" className="w-full bg-[#444] border border-gray-600 rounded p-2" value={editData.callback_schedule} onChange={e => setEditData({ ...editData, callback_schedule: e.target.value })} /></div>
                                        </div>
                                        <div><label className="block text-gray-400 text-sm font-bold mb-1">메모</label><textarea className="w-full bg-[#444] border border-gray-600 rounded p-2 h-24" value={editData.last_memo} onChange={e => setEditData({ ...editData, last_memo: e.target.value })} /></div>
                                    </>
                                )}

                                {/* B. 접수 관리 */}
                                {activeTab === 'sales' && (
                                    <>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div><label className="block text-gray-400 text-sm font-bold mb-1">상태 변경</label><select className="w-full bg-[#444] border border-gray-600 rounded p-3 text-lg" value={editData.status} onChange={e => setEditData({ ...editData, status: e.target.value })}>{['접수완료', '개통완료', '해지진행', '접수취소'].map(o => <option key={o} value={o}>{o}</option>)}</select></div>
                                            <div><label className="block text-gray-400 text-sm font-bold mb-1">설치 예정일</label><input type="date" className="w-full bg-[#444] border border-gray-600 rounded p-3 text-lg" value={editData.installed_date} onChange={e => setEditData({ ...editData, installed_date: e.target.value })} /></div>
                                        </div>
                                        {['실패', '접수취소', '해지진행'].includes(editData.status) && (
                                            <div className="bg-orange-900/30 p-3 rounded border border-orange-700 mt-2">
                                                <label className="text-orange-400 text-sm font-bold block mb-1">🚫 상세 사유 (필수 선택)</label>
                                                <select className="w-full bg-[#444] border border-orange-500 rounded p-2" value={editData.detail_reason} onChange={e => setEditData({ ...editData, detail_reason: e.target.value })}><option value="">선택</option>{failureReasons.map(r => <option key={r.id} value={r.reason}>{r.reason}</option>)}</select>
                                            </div>
                                        )}
                                        <div className="bg-[#2b2b2b] p-6 rounded-xl border border-gray-600 mt-4">
                                            <h4 className="text-gray-400 font-bold mb-3 border-b border-gray-600 pb-2">💸 정산 정보 입력</h4>
                                            <div className="flex gap-4 mb-4">
                                                <div className="flex-1"><label className="text-gray-400 text-sm block mb-1">정책금 (만원)</label><input type="number" className="w-full bg-[#444] border border-gray-600 rounded p-3 text-lg font-bold text-right" value={editData.policy_amt} onChange={e => setEditData({ ...editData, policy_amt: e.target.value })} /></div>
                                                <div className="flex-1"><label className="text-gray-400 text-sm block mb-1">지원금 (만원)</label><input type="number" className="w-full bg-[#444] border border-gray-600 rounded p-3 text-lg font-bold text-right text-red-300" value={editData.support_amt} onChange={e => setEditData({ ...editData, support_amt: e.target.value })} /></div>
                                            </div>
                                            <div className="bg-[#1e3a2a] text-green-400 text-xl font-bold text-center p-3 rounded border border-green-600">순수익: {((editData.policy_amt - editData.support_amt) * 10000).toLocaleString()} 원</div>
                                        </div>
                                        <div className="mt-4"><label className="block text-gray-400 text-sm font-bold mb-1">가입 상품 및 유심 정보</label><input className="w-full bg-[#444] border border-gray-600 rounded p-3" value={editData.product_info} onChange={e => setEditData({ ...editData, product_info: e.target.value })} /></div>
                                        <div className="mt-4"><label className="block text-orange-400 text-sm font-bold mb-1">⚠️ 후처리 및 특이사항 메모</label><textarea className="w-full bg-[#442b2b] border border-orange-500 rounded p-3 h-32 text-orange-100 placeholder-orange-300/50" value={editData.additional_info} onChange={e => setEditData({ ...editData, additional_info: e.target.value })} placeholder="후처리 내용..." /></div>
                                    </>
                                )}
                                <button onClick={handleUpdateInfo} className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold mt-auto transition shadow-lg text-lg">💾 정보 저장하기</button>
                            </div>

                            {/* ⭐️ [핵심 변경] 상담 탭일 때만 히스토리 영역 보임 */}
                            {activeTab === 'consult' && (
                                <div className="w-1/2 p-6 bg-[#2f2f2f] flex flex-col border-l border-gray-600">
                                    <h3 className="font-bold text-gray-400 mb-2">📜 상담 히스토리</h3>
                                    <div className="flex-1 overflow-y-auto bg-[#222] border border-gray-600 rounded p-4 mb-4 flex flex-col gap-3">
                                        {selectedCustomer.logs && selectedCustomer.logs.map((l, i) => (<div key={i} className="bg-[#333] p-3 rounded border border-gray-600 shadow-sm"><div className="text-xs text-gray-500 mb-1">{l.writer_name} | {l.created_at_fmt}</div><div className="text-sm text-gray-200">{l.content}</div></div>))}
                                    </div>
                                    <div className="flex gap-2"><textarea className="flex-1 bg-[#444] border border-gray-600 rounded p-2 h-16 resize-none" value={newLog} onChange={e => setNewLog(e.target.value)} placeholder="내용 입력..." /><button onClick={handleAddLog} className="w-20 bg-blue-600 hover:bg-blue-500 rounded font-bold shadow-lg">등록</button></div>
                                </div>
                            )}

                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default AgentDashboard;
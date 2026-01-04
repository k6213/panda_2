import React, { useState, useEffect, useCallback, useMemo } from 'react';

// ==================================================================================
// 1. 상수 및 설정값
// ==================================================================================
const API_BASE = "http://127.0.0.1:8000";

// 정산 관리 탭에 노출될 상태값들
const SETTLEMENT_TARGET_STATUSES = ['설치완료', '접수완료', '해지진행', '접수취소'];

// [초기값] 상담사 팝업 템플릿
const INITIAL_FORM_TEMPLATE = [
    {
        id: "KT", name: "KT", cost: 60,
        fields: [
            { id: "internet", label: "🌐 인터넷 속도", type: "select", options: "100M, 500M, 1G, 10G" },
            { id: "tv", label: "📺 TV 요금제", type: "select", options: "베이직, 라이트, 에센스, 넷플릭스 결합" },
            { id: "wifi", label: "📡 와이파이", type: "radio", options: "신청, 미신청" },
            { id: "gift", label: "🎁 사은품 메모", type: "text", options: "" }
        ]
    },
    {
        id: "SKT", name: "SKT", cost: 55,
        fields: [
            { id: "internet", label: "🌐 인터넷 상품", type: "select", options: "광랜(100M), 기가라이트(500M), 기가인터넷(1G)" },
            { id: "tv", label: "📺 B tv 상품", type: "select", options: "이코노미, 스탠다드, All" },
            { id: "mobile_combine", label: "📱 온가족 결합", type: "radio", options: "결합함, 안함" }
        ]
    },
    {
        id: "LG", name: "LG", cost: 65,
        fields: [
            { id: "internet", label: "🌐 인터넷", type: "select", options: "100M, 500M, 1G" },
            { id: "tv", label: "📺 U+ tv", type: "select", options: "베이직, 프리미엄, 프라임라이트" },
            { id: "iot", label: "🏠 스마트홈 IoT", type: "checkbox", options: "맘카(CCTV), 도어센서, 간편버튼" }
        ]
    }
];

// 금액 포맷팅 함수
const formatCurrency = (num) => {
    if (!num && num !== 0) return '0';
    return parseInt(num).toLocaleString();
};

function AdminDashboard({ user, onLogout }) {
    // ==================================================================================
    // 2. State 관리
    // ==================================================================================
    const [activeTab, setActiveTab] = useState('stats');
    const [periodFilter, setPeriodFilter] = useState('month');
    const [agents, setAgents] = useState([]);

    // --- 설정값 상태들 ---
    const [adChannels, setAdChannels] = useState([]);
    const [reasons, setReasons] = useState([]);
    const [customStatuses, setCustomStatuses] = useState([]);
    const [settlementStatuses, setSettlementStatuses] = useState([]);
    const [bankList, setBankList] = useState([]);

    // 폼 템플릿 관리 상태
    const [formTemplates, setFormTemplates] = useState(INITIAL_FORM_TEMPLATE);
    const [selectedTemplateIdx, setSelectedTemplateIdx] = useState(0);

    // 통합 고객 데이터
    const [allCustomers, setAllCustomers] = useState([]);
    const [sharedCustomers, setSharedCustomers] = useState([]);
    const [issueCustomers, setIssueCustomers] = useState([]);

    // 필터 상태들
    const [viewDuplicatesOnly, setViewDuplicatesOnly] = useState(false);
    const [issueSubTab, setIssueSubTab] = useState('fail');
    const [failReasonFilter, setFailReasonFilter] = useState('');
    const [totalDbAgentFilter, setTotalDbAgentFilter] = useState('');
    const [salesAgentFilter, setSalesAgentFilter] = useState('');
    const [settlementStatusFilter, setSettlementStatusFilter] = useState('ALL');

    // 선택 및 입력 상태
    const [selectedIds, setSelectedIds] = useState([]);
    const [targetAgentId, setTargetAgentId] = useState('');
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [pasteData, setPasteData] = useState('');
    const [parsedData, setParsedData] = useState([]);

    // 실적 상세 보기 상태 (인라인)
    const [statDetailType, setStatDetailType] = useState(null);

    // 설정 입력값들
    const [newAgent, setNewAgent] = useState({ username: '', password: '' });
    const [newAdChannel, setNewAdChannel] = useState({ name: '', cost: '' });
    const [newReason, setNewReason] = useState('');
    const [newStatus, setNewStatus] = useState('');
    const [newSettlementStatus, setNewSettlementStatus] = useState('');
    const [newBank, setNewBank] = useState('');
    const [newInstallProduct, setNewInstallProduct] = useState('');

    // =========================================================================
    // 🔐 토큰 헤더
    // =========================================================================
    const getAuthHeaders = () => {
        const token = localStorage.getItem('token');
        return { 'Content-Type': 'application/json', 'Authorization': `Token ${token}` };
    };

    // =========================================================================
    // 🔄 API 호출
    // =========================================================================

    // ⚠️ 기존 fetchStats 제거됨 (프론트엔드 직접 계산으로 변경)

    const fetchAllData = useCallback(() => {
        fetch(`${API_BASE}/api/customers/`, { headers: getAuthHeaders() })
            .then(res => res.json())
            .then(data => {
                setAllCustomers(Array.isArray(data) ? data : []);
                if (Array.isArray(data)) {
                    setSharedCustomers(data.filter(c => c.owner === null));
                    setIssueCustomers(data.filter(c => c.status === '실패' || c.status === 'AS요청'));
                }
            })
            .catch(err => console.error("데이터 로드 실패:", err));
    }, []);

    const fetchAgents = useCallback(() => {
        fetch(`${API_BASE}/api/agents/`, { headers: getAuthHeaders() }).then(res => res.json()).then(setAgents);
    }, []);

    const fetchSettings = useCallback(() => {
        const headers = getAuthHeaders();
        fetch(`${API_BASE}/api/ad_channels/`, { headers }).then(res => res.json()).then(setAdChannels).catch(() => setAdChannels([]));
        fetch(`${API_BASE}/api/failure_reasons/`, { headers }).then(res => res.json()).then(setReasons);
        fetch(`${API_BASE}/api/custom_statuses/`, { headers }).then(res => res.json()).then(setCustomStatuses);
        fetch(`${API_BASE}/api/settlement_statuses/`, { headers }).then(res => res.json()).then(data => setSettlementStatuses(data.length ? data : []));
        fetch(`${API_BASE}/api/banks/`, { headers }).then(res => res.json()).then(setBankList).catch(() => setBankList([]));
    }, []);

    const loadCurrentTabData = useCallback(() => {
        setSelectedIds([]);
        // 탭 상관없이 항상 전체 데이터를 가져와야 통계가 정확함
        fetchAllData();
        fetchAgents();

        if (activeTab === 'issue_manage') fetch(`${API_BASE}/api/failure_reasons/`, { headers: getAuthHeaders() }).then(res => res.json()).then(setReasons);
        if (activeTab === 'settlement') fetch(`${API_BASE}/api/settlement_statuses/`, { headers: getAuthHeaders() }).then(res => res.json()).then(setSettlementStatuses);
        if (activeTab === 'settings') fetchSettings();
    }, [activeTab, fetchAllData, fetchAgents, fetchSettings]);

    useEffect(() => {
        loadCurrentTabData();
        const interval = setInterval(() => {
            if (!showUploadModal && activeTab !== 'settings') {
                loadCurrentTabData();
            }
        }, 5000);
        return () => clearInterval(interval);
    }, [loadCurrentTabData, showUploadModal, activeTab]);

    // =========================================================================
    // 🧠 데이터 로직 & ⭐️ [통계 계산 수정]
    // =========================================================================

    // 1. 기간별 데이터 필터링 (통계용)
    const filteredCustomersByPeriod = useMemo(() => {
        if (!allCustomers) return [];

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // 시간 초기화

        return allCustomers.filter(c => {
            if (!c.upload_date) return false;
            const cDate = new Date(c.upload_date);
            const targetDate = new Date(cDate.getFullYear(), cDate.getMonth(), cDate.getDate()); // 시간 초기화

            if (periodFilter === 'today') {
                return targetDate.getTime() === today.getTime();
            }
            if (periodFilter === 'week') {
                const day = now.getDay(); // 0(일) ~ 6(토)
                const diff = now.getDate() - day + (day === 0 ? -6 : 1); // 월요일 기준 계산
                const monday = new Date(now);
                monday.setDate(diff);
                monday.setHours(0, 0, 0, 0);
                return targetDate >= monday;
            }
            if (periodFilter === 'month') {
                return targetDate.getMonth() === today.getMonth() && targetDate.getFullYear() === today.getFullYear();
            }
            return true; // all
        });
    }, [allCustomers, periodFilter]);

    // 2. 대시보드 통계 계산 (API 의존 제거)
    const dashboardStats = useMemo(() => {
        const data = filteredCustomersByPeriod;

        // (1) 총 유입 DB
        const total_db = data.length;

        // (2) 전체 접수 완료 (접수완료 + 설치완료)
        const success_list = data.filter(c => ['접수완료', '설치완료'].includes(c.status));
        const success_count = success_list.length;

        // (3) 총 광고비 집행
        const total_ad_cost = data.reduce((acc, c) => acc + (parseInt(c.ad_cost || 0)), 0);

        // (4) 설치 완료 매출 (설치완료 건의 정책금 합계)
        const installed_list = data.filter(c => c.status === '설치완료');
        const installed_revenue = installed_list.reduce((acc, c) => acc + (parseInt(c.policy_amt || 0) * 10000), 0);

        // (5) 전체 순수익 ((정책금 - 지원금) * 10000) -> 접수완료 + 설치완료 대상
        const net_profit = success_list.reduce((acc, c) => {
            const policy = parseInt(c.policy_amt || 0);
            const support = parseInt(c.support_amt || 0);
            return acc + ((policy - support) * 10000);
        }, 0);

        return { total_db, success_count, total_ad_cost, installed_revenue, net_profit };
    }, [filteredCustomersByPeriod]);

    // 3. 통계 상세 리스트 데이터
    const statDetailData = useMemo(() => {
        if (!statDetailType) return [];
        const data = filteredCustomersByPeriod;

        switch (statDetailType) {
            case 'total': return data;
            case 'success': return data.filter(c => ['접수완료', '설치완료'].includes(c.status));
            case 'ad': return data.filter(c => (c.ad_cost && c.ad_cost > 0));
            case 'installed': return data.filter(c => c.status === '설치완료');
            case 'profit': return data.filter(c => ['접수완료', '설치완료'].includes(c.status));
            default: return [];
        }
    }, [statDetailType, filteredCustomersByPeriod]);

    // 4. 기타 탭별 데이터 필터링
    const duplicateSet = useMemo(() => {
        const phoneCounts = {};
        const dups = new Set();
        sharedCustomers.forEach(c => {
            const p = c.phone ? c.phone.trim() : '';
            if (p) phoneCounts[p] = (phoneCounts[p] || 0) + 1;
        });
        Object.keys(phoneCounts).forEach(phone => { if (phoneCounts[phone] > 1) dups.add(phone); });
        return dups;
    }, [sharedCustomers]);

    const displayedData = useMemo(() => {
        let data = [];
        if (activeTab === 'shared') {
            data = viewDuplicatesOnly ? sharedCustomers.filter(c => duplicateSet.has(c.phone)).sort((a, b) => a.phone.localeCompare(b.phone)) : sharedCustomers;
        }
        else if (activeTab === 'total_manage') {
            data = allCustomers;
            if (totalDbAgentFilter) {
                if (totalDbAgentFilter === 'unassigned') data = data.filter(c => c.owner === null);
                else data = data.filter(c => c.owner === parseInt(totalDbAgentFilter));
            }
        }
        else if (activeTab === 'issue_manage') {
            if (issueSubTab === 'fail') {
                data = issueCustomers.filter(c => c.status === '실패');
                if (failReasonFilter) data = data.filter(c => c.detail_reason === failReasonFilter);
            } else { data = issueCustomers.filter(c => c.status === 'AS요청'); }
        }
        else if (activeTab === 'reception') data = allCustomers.filter(c => c.status === '접수완료');
        else if (activeTab === 'installation') data = allCustomers.filter(c => c.status === '설치완료');
        else if (activeTab === 'settlement') {
            data = allCustomers.filter(c => SETTLEMENT_TARGET_STATUSES.includes(c.status));
            if (settlementStatusFilter !== 'ALL') data = data.filter(c => c.status === settlementStatusFilter);
        }

        if (['reception', 'installation', 'settlement'].includes(activeTab) && salesAgentFilter) {
            data = data.filter(c => c.owner === parseInt(salesAgentFilter));
        }
        return data;
    }, [activeTab, allCustomers, sharedCustomers, issueCustomers, viewDuplicatesOnly, duplicateSet, totalDbAgentFilter, issueSubTab, failReasonFilter, salesAgentFilter, settlementStatusFilter]);

    // 탭별 요약 (접수/설치/정산용)
    const tabSummary = useMemo(() => {
        if (!displayedData) return null;
        const totalCount = displayedData.length;
        const totalAdCost = displayedData.reduce((acc, c) => acc + (parseInt(c.ad_cost || 0)), 0);
        const totalMargin = displayedData.reduce((acc, c) => {
            const hqPolicy = parseInt(c.policy_amt || 0);
            const supportAmt = parseInt(c.support_amt || 0);
            return acc + (hqPolicy - supportAmt) * 10000;
        }, 0);
        return { totalCount, totalAdCost, totalMargin };
    }, [displayedData]);

    // =========================================================================
    // 🎮 핸들러
    // =========================================================================
    const handleAddAdChannel = () => {
        if (!newAdChannel.name || !newAdChannel.cost) return alert("채널명과 단가를 입력해주세요.");
        fetch(`${API_BASE}/api/ad_channels/`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(newAdChannel) }).then(() => { alert("광고 채널 추가 완료"); setNewAdChannel({ name: '', cost: '' }); fetchSettings(); });
    };
    const handleDeleteAdChannel = (id) => {
        if (window.confirm("삭제하시겠습니까?")) fetch(`${API_BASE}/api/ad_channels/${id}/`, { method: 'DELETE', headers: getAuthHeaders() }).then(() => fetchSettings());
    };

    const handleAddPlatform = () => {
        const name = prompt("새로운 통신사 이름을 입력하세요");
        if (name) { setFormTemplates([...formTemplates, { id: name, name, cost: 0, fields: [] }]); setSelectedTemplateIdx(formTemplates.length); }
    };
    const handleDeletePlatform = (idx) => {
        if (window.confirm("삭제하시겠습니까?")) { const newTemplates = formTemplates.filter((_, i) => i !== idx); setFormTemplates(newTemplates); setSelectedTemplateIdx(0); }
    };
    const handleUpdatePlatformMeta = (key, value) => { const newTemplates = [...formTemplates]; newTemplates[selectedTemplateIdx][key] = value; setFormTemplates(newTemplates); };
    const handleAddField = () => { const newTemplates = [...formTemplates]; newTemplates[selectedTemplateIdx].fields.push({ id: `field_${Date.now()}`, label: "새 항목", type: "text", options: "" }); setFormTemplates(newTemplates); };
    const handleUpdateField = (fieldIdx, key, value) => { const newTemplates = [...formTemplates]; newTemplates[selectedTemplateIdx].fields[fieldIdx][key] = value; setFormTemplates(newTemplates); };
    const handleDeleteField = (fieldIdx) => { const newTemplates = [...formTemplates]; newTemplates[selectedTemplateIdx].fields = newTemplates[selectedTemplateIdx].fields.filter((_, i) => i !== fieldIdx); setFormTemplates(newTemplates); };
    const handleSaveSettings = () => { alert("✅ 저장되었습니다."); console.log(formTemplates); };

    const handleInlineUpdate = async (id, field, value) => {
        setAllCustomers(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
        try { await fetch(`${API_BASE}/api/customers/${id}/`, { method: 'PATCH', headers: getAuthHeaders(), body: JSON.stringify({ [field]: value }) }); } catch (error) { alert("수정 실패"); loadCurrentTabData(); }
    };

    const handleCreateAgent = () => { fetch(`${API_BASE}/api/agents/`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(newAgent) }).then(res => { if (res.ok) { alert("등록 완료"); setNewAgent({ username: '', password: '' }); fetchAgents(); } else res.json().then(d => alert(d.message)); }); };
    const handleDeleteAgent = (id, name) => { if (window.confirm(`'${name}' 삭제?`)) fetch(`${API_BASE}/api/agents/${id}/`, { method: 'DELETE', headers: getAuthHeaders() }).then(() => { alert("삭제 완료"); fetchAgents(); }); };

    const handleAddReason = () => { if (!newReason) return; fetch(`${API_BASE}/api/failure_reasons/`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ reason: newReason }) }).then(() => { alert("추가 완료"); setNewReason(''); fetchSettings(); }); };
    const handleDeleteReason = (id) => { if (window.confirm("삭제?")) fetch(`${API_BASE}/api/failure_reasons/${id}/`, { method: 'DELETE', headers: getAuthHeaders() }).then(() => fetchSettings()); };
    const handleAddStatus = () => { if (!newStatus) return; fetch(`${API_BASE}/api/custom_statuses/`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ status: newStatus }) }).then(() => { alert("추가 완료"); setNewStatus(''); fetchSettings(); }); };
    const handleDeleteStatus = (id) => { if (window.confirm("삭제?")) fetch(`${API_BASE}/api/custom_statuses/${id}/`, { method: 'DELETE', headers: getAuthHeaders() }).then(() => fetchSettings()); };
    const handleAddSettlementStatus = () => { if (!newSettlementStatus) return; fetch(`${API_BASE}/api/settlement_statuses/`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ status: newSettlementStatus }) }).then(() => { alert("추가 완료"); setNewSettlementStatus(''); fetchSettings(); }); };
    const handleDeleteSettlementStatus = (id) => { if (window.confirm("삭제?")) fetch(`${API_BASE}/api/settlement_statuses/${id}/`, { method: 'DELETE', headers: getAuthHeaders() }).then(() => fetchSettings()); };
    const handleAddBank = () => { if (!newBank) return; fetch(`${API_BASE}/api/banks/`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ name: newBank }) }).then(() => { alert("은행 추가 완료"); setNewBank(''); fetchSettings(); }); };
    const handleDeleteBank = (id) => { if (window.confirm("삭제?")) fetch(`${API_BASE}/api/banks/${id}/`, { method: 'DELETE', headers: getAuthHeaders() }).then(() => fetchSettings()); };
    const handleAddInstallProduct = () => { if (!newInstallProduct) return; fetch(`${API_BASE}/api/install_products/`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ name: newInstallProduct }) }).then(() => { alert("상품 추가 완료"); setNewInstallProduct(''); fetchSettings(); }); };
    const handleDeleteInstallProduct = (id) => { if (window.confirm("삭제?")) fetch(`${API_BASE}/api/install_products/${id}/`, { method: 'DELETE', headers: getAuthHeaders() }).then(() => fetchSettings()); };

    const handleAllocate = (refreshCallback) => {
        if (selectedIds.length === 0 || !targetAgentId) return alert("대상과 상담사를 선택하세요.");
        if (!window.confirm("이동하시겠습니까?")) return;
        fetch(`${API_BASE}/api/customers/allocate/`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ customer_ids: selectedIds, agent_id: targetAgentId }) }).then(res => res.json()).then(data => { alert(data.message); setSelectedIds([]); setTargetAgentId(''); if (typeof refreshCallback === 'function') refreshCallback(); else loadCurrentTabData(); });
    };

    const handleDeleteCustomer = (id) => { if (window.confirm("영구 삭제?")) fetch(`${API_BASE}/api/customers/${id}/`, { method: 'DELETE', headers: getAuthHeaders() }).then(() => loadCurrentTabData()); };
    const handlePaste = (e) => { const text = e.target.value; setPasteData(text); const rows = text.trim().split('\n').map(row => { const cols = row.split('\t').map(c => c.trim()); return { name: cols[0] || '이름없음', phone: cols[1] || '', platform: cols[2] || '기타', last_memo: cols.slice(2).filter(Boolean).join(' / '), upload_date: new Date().toISOString().slice(0, 10) }; }); setParsedData(rows); };
    const handleBulkSubmit = () => { if (parsedData.length === 0) return; fetch(`${API_BASE}/api/customers/bulk_upload/`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ customers: parsedData }) }).then(async (res) => { const data = await res.json(); if (res.ok) { alert(data.message); setShowUploadModal(false); setPasteData(''); setParsedData([]); loadCurrentTabData(); } else { alert(`오류: ${data.message}`); } }).catch(err => console.error(err)); };
    const handleSelectAll = (e, dataList) => { if (e.target.checked) setSelectedIds(dataList.map(c => c.id)); else setSelectedIds([]); };
    const handleCheck = (id) => { if (selectedIds.includes(id)) setSelectedIds(selectedIds.filter(sid => sid !== id)); else setSelectedIds([...selectedIds, id]); };
    const getAgentName = (id) => { if (!id) return '-'; const agent = agents.find(a => a.id === id); return agent ? agent.username : '알수없음'; };
    const handleToggleStatDetail = (type) => { if (statDetailType === type) setStatDetailType(null); else setStatDetailType(type); };

    // =========================================================================
    // 🖥️ 렌더링
    // =========================================================================
    return (
        <div className="min-h-screen bg-[#2b2b2b] text-gray-100 p-5 font-sans relative overflow-hidden">
            <header className="flex justify-between items-center bg-[#1e1e1e] p-4 rounded-xl shadow-lg mb-6 border-l-4 border-yellow-500">
                <h1 className="text-xl font-bold text-white flex items-center gap-2">👑 관리자 대시보드</h1>
                <div className="flex gap-2">
                    <button onClick={() => setShowUploadModal(true)} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-bold transition">📤 DB 등록</button>
                    <button onClick={onLogout} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-bold transition">로그아웃</button>
                </div>
            </header>

            <div className="flex gap-2 mb-4 border-b border-gray-600 pb-1 overflow-x-auto">
                {['stats', 'total_manage', 'shared', 'issue_manage', 'reception', 'installation', 'settlement', 'users', 'settings'].map(tab => (
                    <button key={tab} onClick={() => { setActiveTab(tab); setSalesAgentFilter(''); }}
                        className={`px-5 py-3 rounded-t-lg font-bold transition whitespace-nowrap ${activeTab === tab ? 'bg-[#3498db] text-white' : 'bg-[#383838] text-gray-400 hover:bg-[#444]'}`}>
                        {tab === 'stats' && "📊 실적"}
                        {tab === 'total_manage' && "🗂️ 전체 DB"}
                        {tab === 'shared' && "🛒 미배정(공유)"}
                        {tab === 'issue_manage' && "🛠 AS/실패"}
                        {tab === 'reception' && "📝 접수관리"}
                        {tab === 'installation' && "✅ 설치완료"}
                        {tab === 'settlement' && "💰 정산관리"}
                        {tab === 'users' && "👥 상담사"}
                        {tab === 'settings' && "⚙️ 설정"}
                    </button>
                ))}
            </div>

            <div className="bg-[#383838] rounded-xl shadow-xl min-h-[600px] border border-gray-700 p-6 overflow-x-auto">

                {/* 1. [실적 현황] - 프론트엔드 계산 사용 */}
                {activeTab === 'stats' && (
                    <div className="animate-fade-in">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold border-l-4 border-yellow-500 pl-4">통합 영업 지표</h2>
                            <div className="flex bg-[#222] rounded-lg p-1">
                                {['today:오늘', 'week:이번주', 'month:이번달', 'all:전체'].map((item) => {
                                    const [val, label] = item.split(':');
                                    return <button key={val} onClick={() => setPeriodFilter(val)} className={`px-4 py-2 rounded-md text-sm font-bold transition ${periodFilter === val ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}>{label}</button>;
                                })}
                            </div>
                        </div>
                        <div className="grid grid-cols-5 gap-4 mb-8">
                            <div onClick={() => handleToggleStatDetail('total')} className={`bg-[#444] p-5 rounded-xl border cursor-pointer hover:bg-[#555] transition transform hover:scale-105 ${statDetailType === 'total' ? 'border-yellow-400 ring-2 ring-yellow-400' : 'border-gray-600'}`}>
                                <h3 className="text-gray-400 text-xs flex justify-between">총 유입 DB <span>{statDetailType === 'total' ? '🔼 접기' : '🔽 상세'}</span></h3>
                                <p className="text-2xl font-bold text-white mt-1">{formatCurrency(dashboardStats.total_db)}건</p>
                            </div>
                            <div onClick={() => handleToggleStatDetail('success')} className={`bg-[#2c3e50] p-5 rounded-xl border cursor-pointer hover:bg-[#34495e] transition transform hover:scale-105 ${statDetailType === 'success' ? 'border-yellow-400 ring-2 ring-yellow-400' : 'border-blue-600'}`}>
                                <h3 className="text-blue-200 text-xs flex justify-between">전체 접수 완료 <span>{statDetailType === 'success' ? '🔼 접기' : '🔽 상세'}</span></h3>
                                <p className="text-2xl font-bold text-blue-400 mt-1">{formatCurrency(dashboardStats.success_count)}건</p>
                            </div>
                            <div onClick={() => handleToggleStatDetail('ad')} className={`bg-[#444] p-5 rounded-xl border cursor-pointer hover:bg-[#555] transition transform hover:scale-105 ${statDetailType === 'ad' ? 'border-yellow-400 ring-2 ring-yellow-400' : 'border-gray-600'}`}>
                                <h3 className="text-gray-400 text-xs flex justify-between">총 광고비 집행 <span>{statDetailType === 'ad' ? '🔼 접기' : '🔽 상세'}</span></h3>
                                <p className="text-2xl font-bold text-red-400 mt-1">{formatCurrency(dashboardStats.total_ad_cost)}원</p>
                            </div>
                            <div onClick={() => handleToggleStatDetail('installed')} className={`bg-[#1e3a2a] p-5 rounded-xl border cursor-pointer hover:bg-[#274b36] transition transform hover:scale-105 ${statDetailType === 'installed' ? 'border-yellow-400 ring-2 ring-yellow-400' : 'border-green-600'}`}>
                                <h3 className="text-green-300 text-xs flex justify-between">설치 완료 매출 <span>{statDetailType === 'installed' ? '🔼 접기' : '🔽 상세'}</span></h3>
                                <p className="text-2xl font-bold text-green-400 mt-1">{formatCurrency(dashboardStats.installed_revenue)}원</p>
                            </div>
                            <div onClick={() => handleToggleStatDetail('profit')} className={`bg-[#444] p-5 rounded-xl border cursor-pointer hover:bg-[#555] transition transform hover:scale-105 ${statDetailType === 'profit' ? 'border-yellow-400 ring-2 ring-yellow-400' : 'border-gray-600'}`}>
                                <h3 className="text-yellow-400 text-xs flex justify-between">💰 전체 순수익 <span>{statDetailType === 'profit' ? '🔼 접기' : '🔽 상세'}</span></h3>
                                <p className="text-2xl font-bold text-yellow-400 mt-1">{formatCurrency(dashboardStats.net_profit)}원</p>
                            </div>
                        </div>
                        {statDetailType && (
                            <div className="bg-[#2f2f2f] rounded-xl border border-gray-500 mb-8 overflow-hidden animate-fade-in-down shadow-2xl">
                                <div className="p-4 bg-[#252525] border-b border-gray-600 flex justify-between items-center">
                                    <h3 className="text-lg font-bold text-white flex items-center gap-2">🔎 상세 리스트</h3>
                                    <button onClick={() => setStatDetailType(null)} className="text-sm bg-gray-600 hover:bg-gray-500 px-3 py-1 rounded text-white transition">닫기 ✖</button>
                                </div>
                                <div className="max-h-[400px] overflow-y-auto">
                                    <table className="w-full text-left text-sm text-gray-300">
                                        <thead className="bg-[#1e1e1e] sticky top-0 z-10 shadow-md">
                                            <tr>
                                                <th className="p-3">등록일</th><th className="p-3">담당자</th><th className="p-3">고객명</th><th className="p-3">연락처</th><th className="p-3">플랫폼</th><th className="p-3">상태</th>
                                                {statDetailType === 'ad' && <th className="p-3 text-red-400 font-bold">광고비</th>}
                                                {(statDetailType === 'installed' || statDetailType === 'profit') && <><th className="p-3 text-green-400 font-bold">매출</th><th className="p-3 text-yellow-400 font-bold">마진</th></>}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {statDetailData.map((c) => {
                                                const revenue = parseInt(c.policy_amt || 0) * 10000;
                                                const margin = (parseInt(c.policy_amt || 0) - parseInt(c.support_amt || 0)) * 10000;
                                                return (
                                                    <tr key={c.id} className="border-b border-gray-700 hover:bg-[#444]">
                                                        <td className="p-3">{c.upload_date}</td><td className="p-3 font-bold text-yellow-400">{getAgentName(c.owner)}</td><td className="p-3 font-bold">{c.name}</td><td className="p-3">{c.phone}</td><td className="p-3">{c.platform}</td><td className="p-3"><span className="bg-gray-600 px-2 py-1 rounded text-xs">{c.status}</span></td>
                                                        {statDetailType === 'ad' && <td className="p-3 text-red-400 font-bold">{(c.ad_cost || 0).toLocaleString()}원</td>}
                                                        {(statDetailType === 'installed' || statDetailType === 'profit') && <><td className="p-3 text-green-400">{revenue.toLocaleString()}</td><td className="p-3 text-yellow-400">{margin.toLocaleString()}</td></>}
                                                    </tr>
                                                );
                                            })}
                                            {statDetailData.length === 0 && <tr><td colSpan="8" className="p-10 text-center text-gray-500">데이터가 없습니다.</td></tr>}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* 2. [전체 DB 관리] */}
                {activeTab === 'total_manage' && (
                    <div>
                        <div className="flex justify-between items-center mb-6"><h2 className="text-xl font-bold">🗂️ 전체 DB 통합 관리</h2><div className="flex gap-2 items-center bg-[#2b2b2b] p-2 rounded-lg border border-gray-600"><span className="text-sm font-bold text-gray-400 mr-2">♻️ 재분배:</span><select className="bg-[#444] text-white p-1.5 rounded border border-gray-500 text-sm" value={targetAgentId} onChange={e => setTargetAgentId(e.target.value)}><option value="">이동할 상담사...</option>{agents.map(a => <option key={a.id} value={a.id}>{a.username}</option>)}</select><button onClick={() => handleAllocate(loadCurrentTabData)} className="bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded font-bold text-sm">실행</button></div></div>

                        {tabSummary && (
                            <div className="bg-[#222] p-4 rounded-lg mb-4 flex items-center gap-6 border border-gray-700 shadow-md">
                                <span className="text-gray-400 font-bold border-r border-gray-600 pr-4">📊 전체 현황 요약</span>
                                <div>총 DB: <span className="text-white font-bold text-lg ml-1">{tabSummary.totalCount}건</span></div>
                                <div>💸 총 광고 집행비: <span className="text-red-400 font-bold text-lg ml-1">{tabSummary.totalAdCost.toLocaleString()}원</span></div>
                            </div>
                        )}

                        <div className="max-h-[600px] overflow-y-auto">
                            <table className="w-full text-left text-sm text-gray-300">
                                <thead className="bg-[#1e1e1e] sticky top-0 z-10 shadow-md"><tr><th className="p-3 w-10"><input type="checkbox" onChange={(e) => handleSelectAll(e, displayedData)} checked={displayedData.length > 0 && selectedIds.length === displayedData.length} /></th><th className="p-3">등록일</th><th className="p-3 text-yellow-400">현재 담당자</th><th className="p-3">고객명</th><th className="p-3">연락처</th><th className="p-3">플랫폼</th><th className="p-3">상태</th><th className="p-3">관리</th></tr></thead>
                                <tbody>{displayedData.map(c => (<tr key={c.id} className="border-b border-gray-700 hover:bg-[#444]"><td className="p-3"><input type="checkbox" checked={selectedIds.includes(c.id)} onChange={() => handleCheck(c.id)} /></td><td className="p-3">{c.upload_date}</td><td className="p-3 font-bold text-yellow-400">{getAgentName(c.owner)}</td><td className="p-3">{c.name}</td><td className="p-3">{c.phone}</td><td className="p-3">{c.platform}</td><td className="p-3"><span className="bg-gray-600 px-2 py-1 rounded text-xs">{c.status}</span></td><td className="p-3"><button onClick={() => handleDeleteCustomer(c.id)} className="text-red-400">삭제</button></td></tr>))}</tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* 3. [공유 DB] */}
                {activeTab === 'shared' && (
                    <div>
                        <div className="flex justify-between items-center mb-4"><h2 className="text-xl font-bold flex items-center gap-2">🛒 미배정 DB 관리</h2><div className="flex gap-2"><button onClick={() => setViewDuplicatesOnly(!viewDuplicatesOnly)} className={`px-3 py-1 rounded text-xs font-bold border ${viewDuplicatesOnly ? 'bg-red-600 border-red-500 animate-pulse' : 'bg-[#444] border-gray-500'}`}>{viewDuplicatesOnly ? '✅ 전체 보기' : '🚫 중복 DB만 보기'}</button><select className="bg-[#444] text-white p-2 rounded border border-gray-500 text-sm" value={targetAgentId} onChange={e => setTargetAgentId(e.target.value)}><option value="">상담사 선택...</option>{agents.map(a => <option key={a.id} value={a.id}>{a.username}</option>)}</select><button onClick={() => handleAllocate(loadCurrentTabData)} className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded font-bold text-sm">일괄 배정</button></div></div>

                        {tabSummary && (
                            <div className="bg-[#222] p-4 rounded-lg mb-4 flex items-center gap-6 border border-gray-700 shadow-md">
                                <span className="text-gray-400 font-bold border-r border-gray-600 pr-4">📊 미배정 현황</span>
                                <div>미배정 DB: <span className="text-white font-bold text-lg ml-1">{tabSummary.totalCount}건</span></div>
                                <div>💸 매몰(대기) 광고비: <span className="text-red-400 font-bold text-lg ml-1">{tabSummary.totalAdCost.toLocaleString()}원</span></div>
                            </div>
                        )}

                        <div className="max-h-[600px] overflow-y-auto"><table className="w-full text-left text-sm text-gray-300"><thead className="bg-[#1e1e1e] sticky top-0 z-10 shadow-md"><tr><th className="p-3 w-10"><input type="checkbox" onChange={(e) => handleSelectAll(e, displayedData)} checked={displayedData.length > 0 && selectedIds.length === displayedData.length} /></th><th className="p-3">날짜</th><th className="p-3">플랫폼</th><th className="p-3">이름</th><th className="p-3">번호</th><th className="p-3">광고비</th><th className="p-3">중복여부</th><th className="p-3">관리</th></tr></thead><tbody>{displayedData.map(c => { const isDup = duplicateSet.has(c.phone); return (<tr key={c.id} className={`border-b border-gray-700 hover:bg-[#444] ${isDup ? 'bg-red-900/20' : ''}`}><td className="p-3"><input type="checkbox" checked={selectedIds.includes(c.id)} onChange={() => handleCheck(c.id)} /></td><td className="p-3">{c.upload_date}</td><td className="p-3">{c.platform}</td><td className="p-3 font-bold">{c.name}</td><td className="p-3">{c.phone}</td><td className="p-3">{(c.ad_cost || 0).toLocaleString()}</td><td className="p-3">{isDup && <span className="bg-red-600 text-white px-2 py-0.5 rounded text-xs font-bold animate-pulse">중복됨</span>}</td><td className="p-3"><button onClick={() => handleDeleteCustomer(c.id)} className="text-red-400 font-bold">삭제</button></td></tr>); })}</tbody></table></div>
                    </div>
                )}

                {/* 4. [AS/실패 관리] */}
                {activeTab === 'issue_manage' && (<div><h2 className="text-xl font-bold mb-4">🛠 AS/실패 통합 관리</h2><div className="flex justify-between items-end mb-4 border-b border-gray-600 pb-1"><div className="flex gap-2"><button onClick={() => { setIssueSubTab('fail'); setSelectedIds([]); }} className={`px-6 py-2 rounded-t-lg font-bold transition ${issueSubTab === 'fail' ? 'bg-red-600 text-white' : 'bg-[#333] text-gray-400 hover:bg-[#444]'}`}>🚫 실패 DB 관리</button><button onClick={() => { setIssueSubTab('as'); setSelectedIds([]); }} className={`px-6 py-2 rounded-t-lg font-bold transition ${issueSubTab === 'as' ? 'bg-yellow-600 text-white' : 'bg-[#333] text-gray-400 hover:bg-[#444]'}`}>🚨 AS 요청 승인</button></div>{issueSubTab === 'fail' && (<select className="bg-[#444] border border-gray-600 rounded px-3 py-1 text-white text-sm" value={failReasonFilter} onChange={e => setFailReasonFilter(e.target.value)}><option value="">🔍 모든 실패 사유 보기</option>{reasons.map(r => <option key={r.id} value={r.reason}>{r.reason}</option>)}</select>)}</div><div className="max-h-[600px] overflow-y-auto"><table className="w-full text-left text-sm text-gray-300"><thead className="bg-[#1e1e1e]"><tr><th className="p-3">선택</th><th className="p-3">상태</th><th className="p-3">고객명</th><th className="p-3">사유</th><th className="p-3">관리</th></tr></thead><tbody>{displayedData.map(c => <tr key={c.id} className="border-b border-gray-700"><td className="p-3"><input type="checkbox" checked={selectedIds.includes(c.id)} onChange={() => handleCheck(c.id)} /></td><td className="p-3">{c.status}</td><td className="p-3">{c.name}</td><td className="p-3 text-yellow-400">{c.detail_reason || c.as_reason}</td><td className="p-3"><button onClick={() => handleDeleteCustomer(c.id)}>삭제</button></td></tr>)}</tbody></table></div></div>)}

                {/* 5. [📝 접수 관리] */}
                {activeTab === 'reception' && (
                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold flex items-center gap-2">📝 접수 관리 <span className="text-sm font-normal text-gray-400">(상태: 접수완료)</span></h2>
                            <select className="bg-[#333] border border-gray-600 rounded px-3 py-1 text-white text-sm" value={salesAgentFilter} onChange={e => setSalesAgentFilter(e.target.value)}><option value="">👤 전체 상담사 보기</option>{agents.map(a => <option key={a.id} value={a.id}>{a.username}</option>)}</select>
                        </div>

                        {tabSummary && (
                            <div className="bg-[#222] p-4 rounded-lg mb-4 flex items-center gap-6 border border-gray-700 shadow-md">
                                <span className="text-gray-400 font-bold border-r border-gray-600 pr-4">📊 접수 현황 요약</span>
                                <div>현재 목록 건수: <span className="text-white font-bold text-lg ml-1">{tabSummary.totalCount}건</span></div>
                                <div>💰 예상 순수익 합계: <span className="text-yellow-400 font-bold text-lg ml-1">{tabSummary.totalMargin.toLocaleString()}원</span></div>
                            </div>
                        )}

                        <div className="max-h-[600px] overflow-y-auto">
                            <table className="w-full text-left text-sm text-gray-300">
                                <thead className="bg-[#1e1e1e] sticky top-0 z-10 shadow-md"><tr><th className="p-3">접수일</th><th className="p-3 text-yellow-400">담당자</th><th className="p-3">고객명</th><th className="p-3">연락처</th><th className="p-3">플랫폼</th><th className="p-3">상품/메모</th><th className="p-3">상태 변경</th></tr></thead>
                                <tbody>
                                    {displayedData.map(c => (
                                        <tr key={c.id} className="border-b border-gray-700 hover:bg-[#444] transition">
                                            <td className="p-3">{c.upload_date}</td>
                                            <td className="p-3 font-bold text-yellow-400">{getAgentName(c.owner)}</td>
                                            <td className="p-3 font-bold">{c.name}</td>
                                            <td className="p-3">{c.phone}</td>
                                            <td className="p-3"><span className="bg-gray-600 px-2 py-1 rounded text-xs">{c.platform}</span></td>
                                            <td className="p-3 text-gray-400 truncate max-w-[200px]">{c.product_info}</td>
                                            <td className="p-3">
                                                <select className="bg-[#2b2b2b] border border-gray-500 rounded text-xs p-1 text-white" value={c.status} onChange={(e) => handleInlineUpdate(c.id, 'status', e.target.value)}>
                                                    <option value="접수완료">접수완료</option>
                                                    <option value="설치완료">✅ 설치완료</option>
                                                    <option value="접수취소">🚫 취소 처리</option>
                                                </select>
                                            </td>
                                        </tr>
                                    ))}
                                    {displayedData.length === 0 && <tr><td colSpan="7" className="p-10 text-center text-gray-500">접수완료된 건이 없습니다.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* 6. [✅ 설치 완료] */}
                {activeTab === 'installation' && (
                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold flex items-center gap-2">✅ 설치 완료 목록 <span className="text-sm font-normal text-gray-400">(현황 확인용)</span></h2>
                            <select className="bg-[#333] border border-gray-600 rounded px-3 py-1 text-white text-sm" value={salesAgentFilter} onChange={e => setSalesAgentFilter(e.target.value)}><option value="">👤 전체 상담사 보기</option>{agents.map(a => <option key={a.id} value={a.id}>{a.username}</option>)}</select>
                        </div>

                        {tabSummary && (
                            <div className="bg-[#222] p-4 rounded-lg mb-4 flex items-center gap-6 border border-gray-700 shadow-md">
                                <span className="text-gray-400 font-bold border-r border-gray-600 pr-4">📊 설치/개통 요약</span>
                                <div>설치 완료 건수: <span className="text-white font-bold text-lg ml-1">{tabSummary.totalCount}건</span></div>
                                <div>💵 확정 순수익 합계: <span className="text-green-400 font-bold text-lg ml-1">{tabSummary.totalMargin.toLocaleString()}원</span></div>
                            </div>
                        )}

                        <div className="max-h-[600px] overflow-y-auto">
                            <table className="w-full text-left text-sm text-gray-300">
                                <thead className="bg-[#1e1e1e] sticky top-0 z-10 shadow-md"><tr><th className="p-3">접수일</th><th className="p-3 text-yellow-400">담당자</th><th className="p-3">고객명</th><th className="p-3">연락처</th><th className="p-3">상품</th><th className="p-3">설치일</th><th className="p-3">상태</th></tr></thead>
                                <tbody>
                                    {displayedData.map(c => (
                                        <tr key={c.id} className="border-b border-gray-700 hover:bg-[#444] transition">
                                            <td className="p-3">{c.upload_date}</td>
                                            <td className="p-3 font-bold text-yellow-400">{getAgentName(c.owner)}</td>
                                            <td className="p-3 font-bold">{c.name}</td>
                                            <td className="p-3">{c.phone}</td>
                                            <td className="p-3 truncate max-w-[150px]">{c.product_info}</td>
                                            <td className="p-3 text-blue-300 font-bold">{c.installed_date || '-'}</td>
                                            <td className="p-3"><span className="bg-green-700 px-2 py-1 rounded text-xs text-white border border-green-500">설치완료</span></td>
                                        </tr>
                                    ))}
                                    {displayedData.length === 0 && <tr><td colSpan="7" className="p-10 text-center text-gray-500">설치 완료된 건이 없습니다.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* 7. [💰 정산 관리] */}
                {activeTab === 'settlement' && (
                    <div>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold flex items-center gap-2">💰 정산 실행 및 관리 <span className="text-sm font-normal text-gray-400">(설치완료건 포함)</span></h2>
                            <div className="flex gap-2">
                                <select className="bg-[#333] border border-gray-600 rounded px-3 py-1.5 text-white text-sm" value={settlementStatusFilter} onChange={e => setSettlementStatusFilter(e.target.value)}>
                                    <option value="ALL">📋 전체 상태</option>
                                    <option value="설치완료">✅ 설치완료 (정산대기)</option>
                                    <option value="접수완료">접수완료</option>
                                    <option value="접수취소">취소/해지</option>
                                </select>
                                <select className="bg-[#333] border border-gray-600 rounded px-3 py-1.5 text-white text-sm" value={salesAgentFilter} onChange={e => setSalesAgentFilter(e.target.value)}>
                                    <option value="">👤 전체 상담사</option>
                                    {agents.map(a => <option key={a.id} value={a.id}>{a.username}</option>)}
                                </select>
                            </div>
                        </div>

                        {tabSummary && (
                            <div className="bg-[#222] p-4 rounded-lg mb-4 flex items-center gap-6 border border-gray-700 shadow-md">
                                <span className="text-gray-400 font-bold border-r border-gray-600 pr-4">📊 현재 리스트 요약</span>
                                <div>총 건수: <span className="text-white font-bold text-lg ml-1">{tabSummary.totalCount}건</span></div>
                                <div>💰 예상 총마진: <span className="text-yellow-400 font-bold text-lg ml-1">{tabSummary.totalMargin.toLocaleString()}원</span></div>
                            </div>
                        )}

                        <div className="max-h-[600px] overflow-y-auto">
                            <table className="w-full text-left text-sm text-gray-300">
                                <thead className="bg-[#1e1e1e] sticky top-0 z-10 shadow-md">
                                    <tr>
                                        <th className="p-3 border-r border-gray-600 bg-[#2b2b2b]">담당자/고객</th>
                                        <th className="p-3 bg-[#2b2b2b]">상품/판매상태</th>
                                        <th className="p-3 bg-[#25332e] border-l border-gray-600 text-center">상담사 정책<br /><span className="text-[10px] text-gray-400">(입력값)</span></th>
                                        <th className="p-3 bg-[#25332e] text-center">본사 확정<br /><span className="text-[10px] text-yellow-400">(정산기준)</span></th>
                                        <th className="p-3 bg-[#25332e] text-center">검수</th>
                                        <th className="p-3 bg-[#25332e] text-center">지원금</th>
                                        <th className="p-3 bg-[#25332e] text-center">순수익</th>
                                        <th className="p-3 bg-[#25332e] text-center text-blue-300 font-bold">정산예정일</th>
                                        <th className="p-3 bg-[#25332e] text-center w-32">정산 상태</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {displayedData.map(c => {
                                        const agentPolicy = parseInt(c.agent_policy || 0);
                                        const hqPolicy = parseInt(c.policy_amt || 0);
                                        const isMatch = agentPolicy === hqPolicy;
                                        const diff = hqPolicy - agentPolicy;
                                        const netProfit = (hqPolicy - (c.support_amt || 0)) * 10000;

                                        return (
                                            <tr key={c.id} className="border-b border-gray-700 hover:bg-[#444] transition">
                                                <td className="p-3 border-r border-gray-600">
                                                    <div className="text-yellow-400 font-bold">{getAgentName(c.owner)}</div>
                                                    <div className="font-bold text-white mt-1">{c.name}</div>
                                                    <div className="text-xs text-gray-400">{c.phone}</div>
                                                </td>
                                                <td className="p-3 text-sm text-gray-300 max-w-[200px] whitespace-normal">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${c.status === '설치완료' ? 'bg-green-600 text-white' : 'bg-gray-600 text-gray-300'}`}>{c.status}</span>
                                                        <span className="text-xs text-gray-500">{c.platform}</span>
                                                    </div>
                                                    {c.product_info || '-'}
                                                </td>
                                                <td className="p-3 bg-[#1e2b26]/50 border-l border-gray-600 text-center text-gray-400 font-bold">{agentPolicy}만</td>
                                                <td className="p-3 bg-[#1e2b26]/50 text-center"><input type="number" className="w-14 bg-transparent text-white text-right outline-none border-b border-gray-500 focus:border-green-500 font-bold" defaultValue={hqPolicy} onBlur={(e) => handleInlineUpdate(c.id, 'policy_amt', e.target.value)} />만</td>
                                                <td className="p-3 bg-[#1e2b26]/50 text-center">{isMatch ? <span className="text-green-500 font-bold text-xs">✅ 일치</span> : <div className="flex flex-col items-center"><span className="text-red-500 font-bold text-xs animate-pulse">⚠️ 불일치</span><span className="text-[10px] text-red-300">({diff > 0 ? `+${diff}` : diff}만)</span></div>}</td>
                                                <td className="p-3 bg-[#1e2b26]/50 text-center"><input type="number" className="w-14 bg-transparent text-white text-right outline-none border-b border-gray-500 focus:border-green-500" defaultValue={c.support_amt} onBlur={(e) => handleInlineUpdate(c.id, 'support_amt', e.target.value)} />만</td>
                                                <td className={`p-3 bg-[#1e2b26]/50 font-bold text-right ${netProfit < 0 ? 'text-red-400' : 'text-green-400'}`}>{netProfit.toLocaleString()}원</td>
                                                <td className="p-3 bg-[#1e2b26]/50 text-center"><input type="date" className="bg-transparent text-white text-xs outline-none w-28 hover:text-blue-400 cursor-pointer border-b border-gray-600 focus:border-blue-500 text-center" value={c.settlement_due_date || ''} onChange={(e) => handleInlineUpdate(c.id, 'settlement_due_date', e.target.value)} /></td>
                                                <td className="p-3 bg-[#1e2b26]/50 text-center align-top">
                                                    <select className={`w-full bg-[#2b3a35] text-white text-xs p-1.5 rounded border border-gray-600 outline-none mb-1 ${c.settlement_status === '정산완료' ? 'text-green-400 border-green-500' : ''} ${c.settlement_status === '미정산' ? 'text-red-400' : ''}`} value={c.settlement_status || '미정산'} onChange={(e) => handleInlineUpdate(c.id, 'settlement_status', e.target.value)}>
                                                        {settlementStatuses.map(s => <option key={s.id} value={s.status}>{s.status}</option>)}
                                                        {settlementStatuses.length === 0 && <><option value="미정산">미정산</option><option value="정산완료">정산완료</option></>}
                                                    </select>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {displayedData.length === 0 && <tr><td colSpan="10" className="p-10 text-center text-gray-500">정산 대상 데이터가 없습니다.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* 8. [상담사 관리] */}
                {activeTab === 'users' && (<div className="flex gap-6"><div className="w-1/3 bg-[#2b2b2b] p-6 rounded border border-gray-600"><h3 className="font-bold mb-4">➕ 상담사 등록</h3><input className="w-full bg-[#444] p-2 rounded mb-2 border border-gray-600 text-white" placeholder="아이디" value={newAgent.username} onChange={e => setNewAgent({ ...newAgent, username: e.target.value })} /><input type="password" className="w-full bg-[#444] p-2 rounded mb-4 border border-gray-600 text-white" placeholder="비번" value={newAgent.password} onChange={e => setNewAgent({ ...newAgent, password: e.target.value })} /><button onClick={handleCreateAgent} className="w-full bg-blue-600 py-2 rounded text-white font-bold">등록</button></div><div className="w-2/3 bg-[#2b2b2b] p-6 rounded border border-gray-600"><table className="w-full text-sm text-left text-gray-300"><thead className="bg-[#1e1e1e]"><tr><th className="p-2">아이디</th><th className="p-2">관리</th></tr></thead><tbody>{agents.map(a => <tr key={a.id} className="border-b border-gray-700"><td className="p-2">{a.username}</td><td className="p-2"><button onClick={() => handleDeleteAgent(a.id, a.username)} className="text-red-400">삭제</button></td></tr>)}</tbody></table></div></div>)}

                {/* 9. [설정] */}
                {activeTab === 'settings' && (
                    <div className="flex gap-6 h-[800px]">
                        <div className="w-1/3 flex flex-col gap-4 overflow-y-auto pr-2">
                            <div className="bg-[#2b2b2b] p-6 rounded border border-purple-600 relative overflow-hidden shadow-lg">
                                <div className="absolute top-0 right-0 bg-purple-600 px-2 py-1 text-xs font-bold text-white rounded-bl">마케팅 설정</div>
                                <h3 className="font-bold mb-4 text-purple-400">📢 광고 채널 및 단가 관리</h3>
                                <div className="flex gap-2 mb-4">
                                    <input className="w-1/2 bg-[#444] p-2 rounded border border-gray-600 text-white text-sm" placeholder="채널명 (예: 네이버)" value={newAdChannel.name} onChange={e => setNewAdChannel({ ...newAdChannel, name: e.target.value })} />
                                    <input type="number" className="w-1/3 bg-[#444] p-2 rounded border border-gray-600 text-white text-sm" placeholder="단가(원)" value={newAdChannel.cost} onChange={e => setNewAdChannel({ ...newAdChannel, cost: e.target.value })} />
                                    <button onClick={handleAddAdChannel} className="bg-purple-600 px-3 rounded text-white font-bold text-sm">추가</button>
                                </div>
                                <div className="max-h-40 overflow-y-auto space-y-2">
                                    {adChannels.map(ad => (
                                        <div key={ad.id} className="flex justify-between items-center bg-[#3a2b3a] px-3 py-2 rounded border border-purple-900">
                                            <span className="text-sm font-bold text-purple-200">{ad.name}</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-gray-400">{parseInt(ad.cost).toLocaleString()}원</span>
                                                <button onClick={() => handleDeleteAdChannel(ad.id)} className="text-red-400 hover:text-white">×</button>
                                            </div>
                                        </div>
                                    ))}
                                    {adChannels.length === 0 && <div className="text-center text-gray-500 text-xs py-2">등록된 광고 채널이 없습니다.</div>}
                                </div>
                            </div>
                            <div className="bg-[#2b2b2b] p-4 rounded border border-gray-600">
                                <h3 className="font-bold mb-2">🚫 실패 사유</h3>
                                <div className="flex gap-2 mb-2"><input className="bg-[#444] p-2 rounded flex-1 border border-gray-600 text-white text-sm" placeholder="사유" value={newReason} onChange={e => setNewReason(e.target.value)} /><button onClick={handleAddReason} className="bg-blue-600 px-3 rounded text-white font-bold text-sm">추가</button></div>
                                <div className="flex flex-wrap gap-2">{reasons.map(r => <span key={r.id} className="bg-[#442b2b] text-red-300 px-2 py-1 rounded text-xs border border-red-900 flex items-center gap-1">{r.reason}<button onClick={() => handleDeleteReason(r.id)}>×</button></span>)}</div>
                            </div>
                            <div className="bg-[#2b2b2b] p-4 rounded border border-gray-600">
                                <h3 className="font-bold mb-2 text-teal-400">📞 상담 상태값 관리</h3>
                                <div className="flex gap-2 mb-2">
                                    <input className="bg-[#444] p-2 rounded flex-1 border border-gray-600 text-white text-sm" placeholder="예: 부재중, 재통화" value={newStatus} onChange={e => setNewStatus(e.target.value)} />
                                    <button onClick={handleAddStatus} className="bg-teal-600 px-3 rounded text-white font-bold text-sm">추가</button>
                                </div>
                                <div className="flex flex-wrap gap-2">{customStatuses.map(s => <span key={s.id} className="bg-[#2b4440] text-teal-300 px-2 py-1 rounded-full text-xs border border-teal-800 flex items-center gap-1">{s.status}<button onClick={() => handleDeleteStatus(s.id)}>×</button></span>)}</div>
                            </div>
                            <div className="bg-[#2b2b2b] p-4 rounded border border-gray-600">
                                <h3 className="font-bold mb-2 text-orange-400">💰 정산 상태값</h3>
                                <div className="flex gap-2 mb-2"><input className="bg-[#444] p-2 rounded flex-1 border border-gray-600 text-white text-sm" placeholder="예: 부분정산" value={newSettlementStatus} onChange={e => setNewSettlementStatus(e.target.value)} /><button onClick={handleAddSettlementStatus} className="bg-orange-600 px-3 rounded text-white font-bold text-sm">추가</button></div>
                                <div className="flex flex-wrap gap-2">{settlementStatuses.map(s => <span key={s.id} className="bg-[#44382b] text-orange-300 px-2 py-1 rounded-full text-xs border border-orange-800 flex items-center gap-1">{s.status}<button onClick={() => handleDeleteSettlementStatus(s.id)}>×</button></span>)}</div>
                            </div>
                        </div>

                        <div className="flex-1 bg-[#222] rounded-xl border border-blue-600 flex flex-col shadow-2xl overflow-hidden">
                            <div className="bg-[#1a1a1a] p-4 border-b border-gray-600 flex justify-between items-center">
                                <h3 className="text-lg font-bold text-blue-400 flex items-center gap-2">🛠️ 통신사 정책 및 팝업 설정</h3>
                                <button onClick={handleSaveSettings} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded font-bold text-sm transition">💾 전체 저장</button>
                            </div>
                            <div className="flex flex-1 overflow-hidden">
                                <div className="w-1/4 border-r border-gray-600 bg-[#2b2b2b] flex flex-col">
                                    <div className="p-3 border-b border-gray-600 bg-[#333]">
                                        <button onClick={handleAddPlatform} className="w-full bg-gray-600 hover:bg-gray-500 py-2 rounded text-white text-sm font-bold">+ 통신사 추가</button>
                                    </div>
                                    <div className="flex-1 overflow-y-auto">
                                        {formTemplates.map((tpl, idx) => (
                                            <div key={idx} onClick={() => setSelectedTemplateIdx(idx)} className={`p-4 cursor-pointer border-b border-gray-700 flex justify-between items-center hover:bg-[#383838] transition ${selectedTemplateIdx === idx ? 'bg-[#383838] border-l-4 border-l-blue-500' : 'text-gray-400'}`}>
                                                <div><div className="font-bold">{tpl.name}</div><div className="text-xs text-yellow-400 mt-1">정책: {tpl.cost}만</div></div>
                                                {formTemplates.length > 1 && <button onClick={(e) => { e.stopPropagation(); handleDeletePlatform(idx); }} className="text-red-400 hover:text-red-200 text-xs">삭제</button>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex-1 bg-[#1e1e1e] flex flex-col p-6 overflow-y-auto">
                                    <div className="mb-8 border-b border-gray-700 pb-6">
                                        <h4 className="text-white font-bold mb-4 flex items-center gap-2">📝 통신사 기본 정보</h4>
                                        <div className="flex gap-6">
                                            <div className="flex-1"><label className="block text-gray-400 text-xs mb-1">통신사 이름</label><input className="w-full bg-[#333] border border-gray-600 rounded p-2 text-white font-bold" value={formTemplates[selectedTemplateIdx]?.name} onChange={(e) => handleUpdatePlatformMeta('name', e.target.value)} /></div>
                                            <div className="flex-1"><label className="block text-yellow-400 text-xs mb-1">💰 기본 정책 단가 (단위: 만원)</label><input type="number" className="w-full bg-[#333] border border-yellow-600 rounded p-2 text-yellow-400 font-bold" value={formTemplates[selectedTemplateIdx]?.cost} onChange={(e) => handleUpdatePlatformMeta('cost', e.target.value)} /></div>
                                        </div>
                                    </div>
                                    <div>
                                        <div className="flex justify-between items-center mb-4"><h4 className="text-white font-bold flex items-center gap-2">🎨 상담사 팝업 입력 항목 <span className="text-gray-500 text-xs font-normal">(상담사가 접수 시 입력할 내용)</span></h4><button onClick={handleAddField} className="bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded text-xs font-bold">+ 항목 추가</button></div>
                                        <div className="space-y-3">
                                            {formTemplates[selectedTemplateIdx]?.fields.map((field, fIdx) => (
                                                <div key={field.id} className="bg-[#2b2b2b] p-4 rounded border border-gray-600 relative group hover:border-blue-500 transition">
                                                    <button onClick={() => handleDeleteField(fIdx)} className="absolute top-2 right-2 text-gray-500 hover:text-red-400">✖</button>
                                                    <div className="grid grid-cols-12 gap-4">
                                                        <div className="col-span-4"><label className="text-[10px] text-gray-400 block mb-1">라벨 (제목)</label><input className="w-full bg-[#444] border border-gray-600 rounded p-1.5 text-white text-sm" value={field.label} onChange={(e) => handleUpdateField(fIdx, 'label', e.target.value)} /></div>
                                                        <div className="col-span-3"><label className="text-[10px] text-gray-400 block mb-1">입력 타입</label><select className="w-full bg-[#444] border border-gray-600 rounded p-1.5 text-white text-sm" value={field.type} onChange={(e) => handleUpdateField(fIdx, 'type', e.target.value)}><option value="text">텍스트 (한 줄)</option><option value="select">선택 박스 (Dropdown)</option><option value="radio">라디오 버튼 (택1)</option><option value="checkbox">체크 박스 (다중)</option></select></div>
                                                        <div className="col-span-5"><label className="text-[10px] text-gray-400 block mb-1">옵션 (콤마 , 구분)</label><input disabled={field.type === 'text'} className={`w-full border rounded p-1.5 text-sm font-mono ${field.type === 'text' ? 'bg-[#222] border-gray-700 text-gray-600 cursor-not-allowed' : 'bg-[#333] border-gray-600 text-yellow-400'}`} value={field.options || ''} onChange={(e) => handleUpdateField(fIdx, 'options', e.target.value)} placeholder={field.type === 'text' ? "텍스트 타입은 옵션 없음" : "예: 100M, 500M, 1G"} /></div>
                                                    </div>
                                                </div>
                                            ))}
                                            {formTemplates[selectedTemplateIdx]?.fields.length === 0 && <div className="text-center text-gray-500 py-10 bg-[#252525] rounded border border-dashed border-gray-600">항목이 없습니다. '+ 항목 추가'를 눌러주세요.</div>}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {showUploadModal && <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center backdrop-blur-sm z-50"><div className="bg-[#383838] p-6 rounded-xl w-[600px] border border-gray-600 text-white"><h2 className="text-xl font-bold mb-4">📤 엑셀 복사 등록</h2><textarea placeholder="예: 홍길동  010-1234-5678  네이버  부재중..." className="w-full h-40 bg-[#2b2b2b] p-3 rounded border border-gray-600 text-sm font-mono mb-4 text-white" value={pasteData} onChange={handlePaste} /><div className="flex justify-end gap-2"><button onClick={() => setShowUploadModal(false)} className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded">취소</button><button onClick={handleBulkSubmit} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded font-bold">등록하기</button></div></div></div>}
        </div>
    );
}

export default AdminDashboard;
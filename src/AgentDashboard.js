import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';

// ==================================================================================
// 1. 상수 및 설정값
// ==================================================================================
const API_BASE = "https://panda-1-hd18.onrender.com";

const STATUS_OPTIONS = ['미통건', '부재', '재통', '가망', '장기가망', 'AS요청', '실패', '실패이관', '접수완료'];
const SALES_STATUS_OPTIONS = ['접수완료', '설치완료', '해지진행', '접수취소'];

const TIME_OPTIONS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
const QUICK_FILTERS = ['ALL', '재통', '가망', '부재', '미통건'];

// 통신사별 접수완료 팝업 템플릿
const FORM_TEMPLATES = {
    "KT": [
        { id: "internet", label: "🌐 인터넷 속도", type: "select", options: ["100M", "500M", "1G", "10G"] },
        { id: "tv", label: "📺 TV 요금제", type: "select", options: ["베이직 (기본)", "라이트 (스포츠)", "에센스 (영화/드라마)", "넷플릭스 결합"] },
        { id: "wifi", label: "📡 와이파이 추가", type: "radio", options: ["신청", "미신청"] },
        { id: "gift", label: "🎁 사은품 메모", type: "text", placeholder: "예: 현금 45만원" }
    ],
    "SKT": [
        { id: "internet", label: "🌐 인터넷 상품", type: "select", options: ["광랜(100M)", "기가라이트(500M)", "기가인터넷(1G)"] },
        { id: "tv", label: "📺 B tv 상품", type: "select", options: ["이코노미", "스탠다드", "All"] },
        { id: "mobile_combine", label: "📱 온가족 결합 여부", type: "radio", options: ["결합함", "안함"] }
    ],
    "LG": [
        { id: "internet", label: "🌐 인터넷", type: "select", options: ["100M", "500M", "1G"] },
        { id: "tv", label: "📺 U+ tv", type: "select", options: ["베이직", "프리미엄", "프라임라이트"] },
        { id: "iot", label: "🏠 스마트홈 IoT", type: "checkbox", options: ["맘카(CCTV)", "도어센서", "간편버튼"] }
    ]
};

const parseChecklist = (str) => {
    if (!str) return [];
    return str.split(',').map(s => s.trim()).filter(Boolean);
};

const formatCurrency = (num) => {
    if (!num && num !== 0) return '0';
    return parseInt(num).toLocaleString();
};

function AgentDashboard({ user, onLogout }) {
    // ==================================================================================
    // 2. State 관리
    // ==================================================================================
    const [customers, setCustomers] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('shared');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [searchTerm, setSearchTerm] = useState('');

    // 통계 관련 State
    const [periodFilter, setPeriodFilter] = useState('month');
    const [statUserId, setStatUserId] = useState('mine');

    // 팝업 관련 State
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [showNotiDropdown, setShowNotiDropdown] = useState(false);
    const [showReferralModal, setShowReferralModal] = useState(false);
    const [referralData, setReferralData] = useState({ name: '', phone: '', platform: 'KT', product_info: '' });
    const [selectedIds, setSelectedIds] = useState([]);

    // 접수완료 팝업 관련
    const [showCompletionModal, setShowCompletionModal] = useState(false);
    const [completionTarget, setCompletionTarget] = useState(null);
    const [selectedPlatform, setSelectedPlatform] = useState('KT');
    const [dynamicFormData, setDynamicFormData] = useState({});

    // 메모 팝업
    const [memoPopupTarget, setMemoPopupTarget] = useState(null);
    const [memoPopupText, setMemoPopupText] = useState('');
    const [memoFieldType, setMemoFieldType] = useState('');

    // 벌크 업로드
    const [pasteData, setPasteData] = useState('');
    const [parsedData, setParsedData] = useState([]);
    const [newLog, setNewLog] = useState('');

    // 포커스용 Ref
    const memoInputRef = useRef(null);

    const getAuthHeaders = useCallback(() => {
        const token = localStorage.getItem('token');
        return { 'Content-Type': 'application/json', 'Authorization': `Token ${token}` };
    }, []);

    // ==================================================================================
    // 3. Helper Functions & API
    // ==================================================================================
    const formatCallback = (isoString) => {
        if (!isoString) return '-';
        const date = new Date(isoString);
        return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}시`;
    };

    const formatLogDate = (isoString) => {
        if (!isoString) return '방금 전';
        const date = new Date(isoString);
        return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    };

    const getBadgeStyle = (status) => {
        switch (status) {
            case '접수완료': return 'bg-green-500 text-black';
            case '설치완료': return 'bg-green-700 text-white border border-green-500';
            case '해지진행': return 'bg-orange-600 text-white';
            case '접수취소': return 'bg-red-600 text-white';
            case '부재': return 'bg-red-500 text-white';
            case '재통': return 'bg-blue-500 text-white';
            case '가망': return 'bg-yellow-400 text-black';
            case '장기가망': return 'bg-purple-500 text-white';
            case 'AS요청': return 'bg-pink-500 text-white';
            case '실패': return 'bg-gray-500 text-gray-300';
            case '실패이관': return 'bg-[#e74c3c] text-white font-bold border border-red-300';
            default: return 'bg-gray-600 text-white';
        }
    };

    const fetchCustomers = useCallback(async () => {
        if (!user) return;
        try {
            const res = await fetch(`${API_BASE}/api/customers/`, { headers: getAuthHeaders() });
            if (!res.ok) throw new Error("Network Error");
            const data = await res.json();
            setCustomers(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Fetch error:", error);
            setCustomers([]);
        }
    }, [user, getAuthHeaders]);

    useEffect(() => {
        if (user) {
            setIsLoading(true);
            fetchCustomers().finally(() => setIsLoading(false));
            const interval = setInterval(() => {
                if (!selectedCustomer && !showUploadModal && !showCompletionModal && !showReferralModal && !memoPopupTarget) {
                    fetchCustomers();
                }
            }, 10000);
            return () => clearInterval(interval);
        }
    }, [user, fetchCustomers, selectedCustomer, showUploadModal, showCompletionModal, showReferralModal, memoPopupTarget]);

    useEffect(() => { setSelectedIds([]); }, [activeTab]);

    useEffect(() => {
        if (memoPopupTarget && memoInputRef.current) {
            setTimeout(() => memoInputRef.current.focus(), 100);
        }
    }, [memoPopupTarget]);

    // ==================================================================================
    // 5. Data Logic
    // ==================================================================================
    const myAllCustomers = useMemo(() => {
        return (customers || []).filter(c => c.owner === user.user_id);
    }, [customers, user]);

    const agentOptions = useMemo(() => {
        const agents = new Map();
        (customers || []).forEach(c => {
            if (c.owner) {
                const name = c.owner_name || `상담사 ${c.owner}`;
                agents.set(c.owner, name);
            }
        });
        return Array.from(agents, ([id, name]) => ({ id, name }));
    }, [customers]);

    const calculatedStats = useMemo(() => {
        const now = new Date();
        const todayStr = now.toDateString();

        let targetCustomers = [];
        if (statUserId === 'mine') {
            targetCustomers = customers.filter(c => c.owner === user.user_id);
        } else if (statUserId === 'ALL') {
            targetCustomers = customers.filter(c => c.owner !== null);
        } else {
            targetCustomers = customers.filter(c => c.owner === parseInt(statUserId));
        }

        const filteredCustomers = targetCustomers.filter(c => {
            const cDate = new Date(c.upload_date);
            if (periodFilter === 'today') {
                return cDate.toDateString() === todayStr;
            } else if (periodFilter === 'week') {
                const dayOfWeek = now.getDay() || 7;
                const monday = new Date(now);
                monday.setDate(now.getDate() - dayOfWeek + 1);
                monday.setHours(0, 0, 0, 0);
                return cDate >= monday;
            } else if (periodFilter === 'month') {
                return cDate.getMonth() === now.getMonth() && cDate.getFullYear() === now.getFullYear();
            } else {
                return true;
            }
        });

        const totalDB = filteredCustomers.length;
        const submissionList = filteredCustomers.filter(c => ['접수완료', '설치완료', '해지진행', '접수취소'].includes(c.status));
        const submissionCount = submissionList.length;
        const acceptRate = totalDB > 0 ? Math.round((submissionCount / totalDB) * 100) : 0;

        const profitList = filteredCustomers.filter(c => ['접수완료', '설치완료', '해지진행'].includes(c.status));
        const netProfit = profitList.reduce((acc, c) => {
            const policy = parseInt(c.agent_policy || 0);
            const support = parseInt(c.support_amt || 0);
            return acc + (policy - support) * 10000;
        }, 0);

        const installedList = filteredCustomers.filter(c => c.status === '설치완료');
        const installedRevenue = installedList.reduce((acc, c) => {
            const policy = parseInt(c.agent_policy || 0);
            const support = parseInt(c.support_amt || 0);
            return acc + (policy - support) * 10000;
        }, 0);

        const cancelCount = filteredCustomers.filter(c => c.status === '접수취소').length;
        const totalTry = submissionCount;
        const cancelRate = totalTry > 0 ? Math.round((cancelCount / totalTry) * 100) : 0;
        const installRate = totalTry > 0 ? Math.round((installedList.length / totalTry) * 100) : 0;

        let currentAgentLabel = '나';
        if (statUserId === 'ALL') currentAgentLabel = '전체';
        else if (statUserId !== 'mine') {
            const found = agentOptions.find(a => a.id === parseInt(statUserId));
            if (found) currentAgentLabel = found.name;
        }

        return {
            periodLabel: periodFilter === 'today' ? '오늘' : periodFilter === 'week' ? '이번 주' : periodFilter === 'month' ? '이번 달' : '전체',
            agentLabel: currentAgentLabel,
            total_db: totalDB,
            accept_count: submissionCount,
            accept_rate: acceptRate,
            net_profit: netProfit,
            installed_revenue: installedRevenue,
            cancel_rate: cancelRate,
            install_rate: installRate
        };
    }, [customers, periodFilter, statUserId, user.user_id, agentOptions]);

    const duplicateSet = useMemo(() => {
        const phoneCounts = {};
        const dups = new Set();
        (customers || []).forEach(c => {
            const p = c.phone ? c.phone.trim() : '';
            if (p) phoneCounts[p] = (phoneCounts[p] || 0) + 1;
        });
        Object.keys(phoneCounts).forEach(phone => { if (phoneCounts[phone] > 1) dups.add(phone); });
        return dups;
    }, [customers]);

    const notifications = useMemo(() => {
        if (!user) return [];
        const now = new Date().getTime();
        return (customers || []).filter(c => {
            if (c.owner !== user.user_id) return false;
            if (!c.callback_schedule) return false;
            if (['접수완료', '실패', '장기가망', '접수취소', '실패이관'].includes(c.status)) return false;
            return new Date(c.callback_schedule).getTime() <= now;
        }).sort((a, b) => new Date(a.callback_schedule) - new Date(b.callback_schedule));
    }, [customers, user]);

    const { sharedDB, consultDB, longTermDB, salesDB } = useMemo(() => {
        const rawShared = (customers || []).filter(c => c.owner === null);

        const uniqueMap = new Map();
        rawShared.forEach(c => { if (c.phone && !uniqueMap.has(c.phone)) uniqueMap.set(c.phone, c); });
        const sharedDB = Array.from(uniqueMap.values());

        sharedDB.sort((a, b) => {
            const phoneCompare = a.phone.localeCompare(b.phone);
            if (phoneCompare !== 0) return phoneCompare;
            return new Date(b.upload_date) - new Date(a.upload_date);
        });

        let consultDB = myAllCustomers.filter(c => ['미통건', '부재', '재통', '가망', 'AS요청', 'AS승인', '실패', '실패이관'].includes(c.status));
        let longTermDB = myAllCustomers.filter(c => c.status === '장기가망');
        const salesDB = myAllCustomers.filter(c => ['접수완료', '설치완료', '해지진행', '접수취소'].includes(c.status));

        const sortFunction = (a, b) => {
            const dateA = a.callback_schedule ? new Date(a.callback_schedule).getTime() : Infinity;
            const dateB = b.callback_schedule ? new Date(b.callback_schedule).getTime() : Infinity;
            return dateA - dateB;
        };
        consultDB.sort(sortFunction);
        longTermDB.sort(sortFunction);

        return { sharedDB, consultDB, longTermDB, salesDB };
    }, [customers, user, myAllCustomers]);

    const currentData = useMemo(() => {
        let data = [];
        if (activeTab === 'shared') data = sharedDB;
        else if (activeTab === 'consult') data = consultDB;
        else if (activeTab === 'long_term') data = longTermDB;
        else if (activeTab === 'sales') data = salesDB;

        if (activeTab === 'consult' && statusFilter !== 'ALL') {
            data = data.filter(c => c.status === statusFilter);
        }
        if (!data) data = [];
        return data.filter(c => (c.name || '').includes(searchTerm) || (c.phone || '').includes(searchTerm));
    }, [activeTab, sharedDB, consultDB, longTermDB, salesDB, statusFilter, searchTerm]);

    const summaryMetrics = useMemo(() => {
        if (['consult', 'long_term', 'shared'].includes(activeTab)) {
            return {
                total: currentData.length,
                potential: currentData.filter(c => c.status === '가망').length,
                callback: currentData.filter(c => c.status === '재통').length,
                pending: currentData.filter(c => c.status === '미통건').length,
                failed: currentData.filter(c => c.status === '실패').length,
            };
        } else if (activeTab === 'sales') {
            return {
                total: currentData.length,
                totalMargin: currentData.reduce((acc, c) => acc + ((parseInt(c.agent_policy || 0) || 0) - (parseInt(c.support_amt || 0) || 0)) * 10000, 0),
                installedMargin: currentData.filter(c => c.status === '설치완료').reduce((acc, c) => acc + ((parseInt(c.agent_policy || 0) || 0) - (parseInt(c.support_amt || 0) || 0)) * 10000, 0)
            };
        }
        return null;
    }, [currentData, activeTab]);

    // ==================================================================================
    // 6. Event Handlers
    // ==================================================================================
    const handleInlineUpdate = async (id, field, value) => {
        setCustomers(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
        try {
            await fetch(`${API_BASE}/api/customers/${id}/`, {
                method: 'PATCH',
                headers: getAuthHeaders(),
                body: JSON.stringify({ [field]: value })
            });
        } catch (error) { console.error(error); alert("저장 실패"); fetchCustomers(); }
    };

    const handleAssign = (id) => {
        if (!window.confirm("담당하시겠습니까?")) return;
        fetch(`${API_BASE}/api/customers/${id}/assign/`, {
            method: 'POST', headers: getAuthHeaders(),
            body: JSON.stringify({ user_id: user.user_id })
        }).then(() => { alert("배정 완료!"); fetchCustomers(); setActiveTab('consult'); });
    };

    const handleSelectAll = (e) => { if (e.target.checked) setSelectedIds(currentData.map(c => c.id)); else setSelectedIds([]); };
    const handleCheck = (id) => { if (selectedIds.includes(id)) setSelectedIds(selectedIds.filter(sid => sid !== id)); else setSelectedIds([...selectedIds, id]); };

    const handleBulkAssign = () => {
        if (selectedIds.length === 0) return alert("선택된 항목이 없습니다.");
        if (!window.confirm(`선택한 ${selectedIds.length}건을 내 담당으로 가져오시겠습니까?`)) return;
        fetch(`${API_BASE}/api/customers/allocate/`, {
            method: 'POST', headers: getAuthHeaders(),
            body: JSON.stringify({ customer_ids: selectedIds, agent_id: user.user_id })
        }).then(res => res.json()).then(data => { alert(data.message); setSelectedIds([]); fetchCustomers(); setActiveTab('consult'); });
    };

    // ⭐️ [수정] 실패이관 팝업 제거 -> 즉시 실행
    const handleStatusChangeRequest = async (id, newStatus) => {

        // CASE 1: 접수 완료
        if (newStatus === '접수완료') {
            const target = customers.find(c => c.id === id);
            setCompletionTarget(target);
            setSelectedPlatform(target.platform || 'KT');
            setDynamicFormData({});
            setShowCompletionModal(true);
            return;
        }

        // CASE 2: 실패 이관 (팀플레이/토스) - 팝업 없이 즉시 실행
        else if (newStatus === '실패이관') {
            try {
                // (1) 로그 자동 기록
                await fetch(`${API_BASE}/api/customers/${id}/add_log/`, {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({
                        user_id: user.user_id,
                        content: `[시스템] 빠른 실패이관 처리 (팝업생략)`
                    })
                });

                // (2) 상태 변경 및 소유권 해제 (owner: null)
                await fetch(`${API_BASE}/api/customers/${id}/`, {
                    method: 'PATCH',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({
                        status: '실패이관',
                        owner: null  // 공유풀 이동
                    })
                });

                // (3) 조용히 새로고침 (alert 제거)
                fetchCustomers();

            } catch (err) {
                console.error(err);
            }
            return;
        }

        // CASE 3: 일반 상태 변경
        handleInlineUpdate(id, 'status', newStatus);
    };

    const handleConfirmCompletion = () => {
        if (!completionTarget) return;
        const template = FORM_TEMPLATES[selectedPlatform] || [];
        const infoString = template.map(field => { const val = dynamicFormData[field.id]; if (field.type === 'checkbox' && !val) return null; if (!val) return null; return `${field.label}: ${val}`; }).filter(Boolean).join(' / ');
        const finalProductInfo = `[${selectedPlatform}] ${infoString}`;

        const payload = {
            status: '접수완료',
            platform: selectedPlatform,
            product_info: finalProductInfo,
            installed_date: null
        };

        fetch(`${API_BASE}/api/customers/${completionTarget.id}/`, {
            method: 'PATCH', headers: getAuthHeaders(), body: JSON.stringify(payload)
        }).then(() => {
            alert("🎉 접수가 완료되었습니다!\n'접수관리' 탭에서 정책금을 입력해주세요.");
            setShowCompletionModal(false); setCompletionTarget(null); fetchCustomers();
        }).catch(err => alert("오류 발생: " + err));
    };

    const handleCallbackChange = (customer, type, val) => {
        let current = customer.callback_schedule ? new Date(customer.callback_schedule) : new Date(); if (isNaN(current.getTime())) current = new Date(); let newDateStr = ""; let newDateObj = null;
        if (type === 'date') { const timePart = customer.callback_schedule ? new Date(customer.callback_schedule).toTimeString().split(' ')[0] : '09:00:00'; newDateStr = `${val}T${timePart}`; newDateObj = new Date(newDateStr); }
        else if (type === 'hour') { const datePart = customer.callback_schedule ? customer.callback_schedule.split('T')[0] : new Date().toISOString().split('T')[0]; const hour = val.toString().padStart(2, '0'); newDateStr = `${datePart}T${hour}:00:00`; newDateObj = new Date(newDateStr); }
        handleInlineUpdate(customer.id, 'callback_schedule', newDateStr);
        if (newDateObj) { const today = new Date(); const diffTime = newDateObj - today; const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); if (diffDays > 30 && customer.status !== '장기가망') { if (window.confirm("📅 30일 이후 일정입니다.\n'가망관리(장기)' 탭으로 이동시킬까요?")) { handleInlineUpdate(customer.id, 'status', '장기가망'); } } }
    };

    const handleReferralSubmit = () => {
        if (!referralData.phone) return alert("전화번호를 입력해주세요.");
        fetch(`${API_BASE}/api/customers/referral/`, {
            method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ ...referralData, user_id: user.user_id })
        }).then(async (res) => { const data = await res.json(); if (res.ok) { alert(data.message); setShowReferralModal(false); setReferralData({ name: '', phone: '', platform: 'KT', product_info: '' }); fetchCustomers(); setActiveTab('sales'); } else { alert(data.message); } });
    };

    const handleAddLog = () => {
        if (!newLog) return;
        fetch(`${API_BASE}/api/customers/${selectedCustomer.id}/add_log/`, {
            method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ user_id: user.user_id, content: newLog })
        }).then(res => res.ok ? fetch(`${API_BASE}/api/customers/`, { headers: getAuthHeaders() }) : Promise.reject()).then(res => res.json()).then(data => {
            setCustomers(data);
            const updated = data.find(c => c.id === selectedCustomer.id);
            if (updated) setSelectedCustomer(updated);
            setNewLog('');
        });
    };

    const handleTogglePostProcess = (e, customer) => {
        e.stopPropagation();
        const currentList = parseChecklist(customer.checklist);
        const isDone = currentList.includes('후처리완료');
        let newList = isDone ? currentList.filter(item => item !== '후처리완료') : [...currentList, '후처리완료'];
        const newStr = newList.join(',');
        setCustomers(prev => prev.map(c => c.id === customer.id ? { ...c, checklist: newStr } : c));
        fetch(`${API_BASE}/api/customers/${customer.id}/`, {
            method: 'PATCH', headers: getAuthHeaders(), body: JSON.stringify({ checklist: newStr })
        });
    };

    const openMemoPopup = (e, customer, field) => { e.stopPropagation(); setMemoPopupTarget(customer); setMemoFieldType(field); setMemoPopupText(customer[field] || ''); };
    const saveMemoPopup = () => { if (!memoPopupTarget || !memoFieldType) return; handleInlineUpdate(memoPopupTarget.id, memoFieldType, memoPopupText); setMemoPopupTarget(null); };
    const openHistoryModal = (c) => { setSelectedCustomer(c); setNewLog(''); };
    const handlePaste = (e) => { const text = e.target.value; setPasteData(text); const rows = text.trim().split('\n').map(row => { const cols = row.split('\t'); return { name: cols[0] || '', phone: cols[1] || '', platform: cols[2] || '', last_memo: cols[3] || '', upload_date: new Date().toISOString().slice(0, 10) }; }); setParsedData(rows); };
    const handleBulkSubmit = () => { if (parsedData.length === 0) return; fetch(`${API_BASE}/api/customers/bulk_upload/`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ customers: parsedData }) }).then(res => res.json()).then(data => { alert(data.message); setShowUploadModal(false); setPasteData(''); setParsedData([]); fetchCustomers(); }); };
    const renderInteractiveStars = (id, currentRank) => (
        <div className="flex cursor-pointer" onClick={(e) => e.stopPropagation()}>
            {[1, 2, 3, 4, 5].map(star => (<span key={star} className={`text-lg ${star <= currentRank ? 'text-yellow-400' : 'text-gray-600'} hover:scale-125 transition`} onClick={() => handleInlineUpdate(id, 'rank', star)}>★</span>))}
        </div>
    );

    // ==================================================================================
    // 8. Render
    // ==================================================================================
    return (
        <div className="min-h-screen bg-[#2b2b2b] text-gray-100 p-5 font-sans relative" onClick={() => setShowNotiDropdown(false)}>

            {isLoading && (<div className="fixed inset-0 bg-black/50 z-[100] flex justify-center items-center backdrop-blur-[2px]"><div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500"></div></div>)}

            <header className="flex justify-between items-center bg-[#1e1e1e] p-4 rounded-xl shadow-lg mb-6 border border-gray-700 relative z-20">
                <h1 className="text-xl font-bold text-white flex items-center gap-2">📞 {user.username}님의 워크스페이스</h1>
                <div className="flex items-center gap-4">
                    <div className="relative cursor-pointer" onClick={(e) => { e.stopPropagation(); setShowNotiDropdown(!showNotiDropdown); }}>
                        <span className="text-2xl hover:text-yellow-400 transition">🔔</span>
                        {notifications.length > 0 && <span className="absolute -top-1 -right-2 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-bounce">{notifications.length}</span>}
                        {showNotiDropdown && (
                            <div className="absolute right-0 top-10 w-80 bg-[#333] border border-gray-600 rounded-xl shadow-2xl overflow-hidden z-50">
                                <div className="bg-[#222] p-3 border-b border-gray-600 font-bold flex justify-between"><span>⏰ 재통화 알림 ({notifications.length})</span><button className="text-xs text-gray-400 hover:text-white" onClick={() => setShowNotiDropdown(false)}>닫기</button></div>
                                <div className="max-h-60 overflow-y-auto">{notifications.length === 0 ? <div className="p-4 text-center text-gray-500 text-sm">예정된 통화가 없습니다.</div> : notifications.map(n => (<div key={n.id} onClick={() => openHistoryModal(n)} className="p-3 border-b border-gray-700 hover:bg-[#444] cursor-pointer flex justify-between items-center"><div><div className="font-bold text-sm text-yellow-400">{n.name}</div><div className="text-xs text-gray-400">{n.phone}</div></div><div className="text-right"><span className={`text-xs px-1 rounded ${getBadgeStyle(n.status)}`}>{n.status}</span><div className="text-xs text-gray-300 mt-1">{formatCallback(n.callback_schedule)}</div></div></div>))}</div>
                            </div>
                        )}
                    </div>
                    <div className="flex gap-2">
                        {user.role === 'ADMIN' ? (
                            <button onClick={() => setShowUploadModal(true)} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-bold transition">📤 DB 대량 등록</button>
                        ) : (
                            <button onClick={() => setShowReferralModal(true)} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold transition flex items-center gap-2">🤝 소개/지인 등록</button>
                        )}
                        <button onClick={onLogout} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-bold transition">로그아웃</button>
                    </div>
                </div>
            </header>

            <div className="flex justify-between items-end mb-4 border-b border-gray-600 pb-1">
                <div className="flex gap-2">
                    {['shared', 'consult', 'long_term', 'sales', 'report'].map(tab => (
                        <button key={tab} onClick={() => { setActiveTab(tab); setStatusFilter('ALL'); }} className={`px-6 py-3 rounded-t-lg font-bold transition duration-200 ${activeTab === tab ? 'bg-[#3498db] text-white' : 'bg-[#383838] text-gray-400 hover:bg-[#444]'}`}>
                            {tab === 'shared' && `🛒 공유DB (${sharedDB.length})`}
                            {tab === 'consult' && `📞 상담관리 (${consultDB.length})`}
                            {tab === 'long_term' && `📅 가망관리 (${longTermDB.length})`}
                            {tab === 'sales' && `💰 접수관리 (${salesDB.length})`}
                            {tab === 'report' && `📊 통계`}
                        </button>
                    ))}
                </div>
                {activeTab !== 'report' && <input className="bg-[#444] border border-gray-600 rounded-full px-4 py-2 text-white outline-none focus:border-blue-500" placeholder="🔍 검색..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />}
            </div>

            {activeTab !== 'report' && summaryMetrics && (
                <div className="bg-[#1a1a1a] border-t-4 border-blue-500 p-3 mb-4 rounded-lg shadow-lg flex items-center justify-between text-sm animate-fade-in-down">
                    <div className="flex items-center gap-6 overflow-x-auto whitespace-nowrap">
                        <span className="font-bold text-gray-400 border-r border-gray-600 pr-4">📊 현재 목록 요약</span>
                        {['consult', 'long_term', 'shared'].includes(activeTab) && (
                            <>
                                <div>총 건수: <span className="text-white font-bold text-lg ml-1">{formatCurrency(summaryMetrics.total)}</span></div>
                                <div>🔥 가망: <span className="text-yellow-400 font-bold text-lg ml-1">{formatCurrency(summaryMetrics.potential)}</span></div>
                                <div>⏰ 재통: <span className="text-blue-400 font-bold text-lg ml-1">{formatCurrency(summaryMetrics.callback)}</span></div>
                                <div>✉️ 미통: <span className="text-gray-400 font-bold text-lg ml-1">{formatCurrency(summaryMetrics.pending)}</span></div>
                            </>
                        )}
                        {activeTab === 'sales' && (
                            <>
                                <div>총 접수: <span className="text-white font-bold text-lg ml-1">{formatCurrency(summaryMetrics.total)}건</span></div>
                                <div className="border-l border-gray-600 pl-4">💰 예상 총수익: <span className="text-yellow-400 font-bold text-lg ml-1">{formatCurrency(summaryMetrics.totalMargin || 0)}원</span></div>
                                <div className="border-l border-gray-600 pl-4">✅ 설치확정 수익: <span className="text-green-400 font-bold text-lg ml-1">{formatCurrency(summaryMetrics.installedMargin || 0)}원</span></div>
                            </>
                        )}
                    </div>
                    {activeTab === 'shared' && selectedIds.length > 0 && (
                        <button onClick={handleBulkAssign} className="bg-green-600 hover:bg-green-500 text-white px-4 py-1 rounded font-bold transition flex items-center gap-2 animate-bounce-subtle shadow-lg">
                            ⚡ {selectedIds.length}건 일괄 가져오기
                        </button>
                    )}
                </div>
            )}

            {activeTab === 'consult' && (<div className="flex gap-2 mb-4">{QUICK_FILTERS.map(filter => (<button key={filter} onClick={() => setStatusFilter(filter)} className={`px-4 py-2 rounded-full font-bold text-sm transition border ${statusFilter === filter ? 'bg-white text-black border-white shadow-lg transform scale-105' : 'bg-[#333] text-gray-400 border-gray-600 hover:border-gray-400 hover:text-white'}`}>{filter === 'ALL' ? '전체 보기' : filter}</button>))}<div className="ml-auto text-xs text-gray-500 flex items-center">ℹ️ 재통화 일정 순으로 자동 정렬됩니다.</div></div>)}
            {activeTab === 'long_term' && (<div className="bg-purple-900/30 border border-purple-500 p-3 rounded mb-4 text-purple-200 text-sm flex items-center gap-2">💡 <strong>장기 리드 보관함:</strong> 재통화 일정이 30일 이상 남은 건들이 자동으로 이곳에 보관됩니다.</div>)}

            <div className="bg-[#383838] rounded-xl shadow-xl min-h-[600px] border border-gray-700 p-4 overflow-x-auto">
                {activeTab !== 'report' ? (
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-[#2b2b2b] text-gray-400 border-b border-gray-600">
                                {activeTab === 'shared' && <><th className="p-3 w-10"><input type="checkbox" onChange={handleSelectAll} checked={currentData.length > 0 && selectedIds.length === currentData.length} /></th><th className="p-3">등록일</th><th className="p-3">플랫폼</th><th className="p-3">이름</th><th className="p-3">전화번호</th><th className="p-3">메모</th><th className="p-3">상태</th><th className="p-3">관리</th></>}
                                {(activeTab === 'consult' || activeTab === 'long_term') && <><th className="p-3">번호</th><th className="p-3">플랫폼</th><th className="p-3">상담일</th><th className="p-3">이름(진성도)</th><th className="p-3">번호</th><th className="p-3 text-yellow-400">🕒 재통일정</th><th className="p-3 text-blue-400">📌 상태</th><th className="p-3">내용(메모)</th></>}
                                {activeTab === 'sales' && <><th className="p-3">플랫폼</th><th className="p-3">접수일</th><th className="p-3">설치일</th><th className="p-3">이름</th><th className="p-3">번호</th><th className="p-3">정책금(만)</th><th className="p-3">지원금(만)</th><th className="p-3">순수익</th><th className="p-3">상태</th><th className="p-3">후처리(메모)</th><th className="p-3 text-center">확인</th></>}
                                <th className="p-3 text-red-400">비고</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(currentData || []).map((c) => {
                                const isDup = (activeTab === 'shared') ? duplicateSet.has(c.phone ? c.phone.trim() : '') : false;
                                const hasPostProcessIssue = c.additional_info && c.additional_info.trim().length > 0;
                                const checklistItems = parseChecklist(c.checklist);
                                const isPostProcessDone = checklistItems.includes('후처리완료');
                                const isUrgent = hasPostProcessIssue && !isPostProcessDone;

                                return (
                                    <tr key={c.id} onClick={() => (activeTab === 'consult' || activeTab === 'long_term') ? openHistoryModal(c) : null}
                                        className={`border-b border-gray-600 transition 
                                            ${(activeTab === 'consult' || activeTab === 'long_term') ? 'hover:bg-[#444] cursor-pointer' : ''}
                                            ${isDup ? 'bg-[#4a2b2b] hover:bg-[#5c3636]' : ''}
                                            ${activeTab === 'sales' && isUrgent ? 'bg-red-900/40 border-l-4 border-red-500 animate-pulse-slow' : ''}
                                        `}
                                    >
                                        {activeTab === 'shared' && <>
                                            <td className="p-3"><input type="checkbox" checked={selectedIds.includes(c.id)} onChange={() => handleCheck(c.id)} onClick={(e) => e.stopPropagation()} /></td>
                                            <td className="p-3">{c.upload_date}</td><td className="p-3"><span className="bg-gray-600 px-2 py-1 rounded text-xs">{c.platform}</span></td><td className="p-3 font-bold">{c.name}</td><td className="p-3">{c.phone}</td><td className="p-3 text-gray-400 text-sm truncate max-w-[150px]">{c.last_memo}</td><td className="p-3"><span className="bg-gray-500 px-2 py-1 rounded text-xs text-white">{c.status}</span></td><td className="p-3"><button onClick={(e) => { e.stopPropagation(); handleAssign(c.id) }} className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm">⚡ 가져가기</button></td>
                                        </>}
                                        {(activeTab === 'consult' || activeTab === 'long_term') && <>
                                            <td className="p-3">{c.id}</td>
                                            <td className="p-3"><span className="bg-gray-600 px-2 py-1 rounded text-xs">{c.platform || '-'}</span></td>
                                            <td className="p-3">{c.upload_date}</td>
                                            <td className="p-3 font-bold">{c.name}<div className="mt-1">{renderInteractiveStars(c.id, c.rank)}</div></td>
                                            <td className="p-3">{c.phone}</td>
                                            <td className="p-3" onClick={(e) => e.stopPropagation()}><div className="flex flex-col gap-1 w-28"><input type="date" className="bg-[#333] text-white p-1 rounded text-xs w-full outline-none border border-transparent hover:border-blue-500 focus:border-blue-500 transition" value={c.callback_schedule ? c.callback_schedule.split('T')[0] : ''} onChange={(e) => handleCallbackChange(c, 'date', e.target.value)} /><select className={`bg-[#333] p-1 rounded text-xs w-full outline-none border border-transparent hover:border-yellow-500 focus:border-yellow-500 transition cursor-pointer ${c.callback_schedule ? 'text-yellow-400 font-bold' : 'text-gray-500'}`} value={c.callback_schedule ? new Date(c.callback_schedule).getHours() : ""} onChange={(e) => handleCallbackChange(c, 'hour', e.target.value)}><option value="" disabled>시간 선택</option>{TIME_OPTIONS.map(h => <option key={h} value={h}>{h}시</option>)}</select></div></td>
                                            <td className="p-3" onClick={(e) => e.stopPropagation()}>
                                                <div className="relative">
                                                    <select
                                                        className={`w-full p-2 rounded text-xs font-bold cursor-pointer outline-none transition hover:opacity-90 ${getBadgeStyle(c.status)}`}
                                                        style={{ appearance: 'none', WebkitAppearance: 'none', textAlign: 'center' }}
                                                        value={c.status}
                                                        onChange={(e) => handleStatusChangeRequest(c.id, e.target.value)}
                                                    >
                                                        {STATUS_OPTIONS.map(opt => (
                                                            <option
                                                                key={opt}
                                                                value={opt}
                                                                className={opt === '실패이관' ? 'text-red-600 bg-red-50 font-bold' : 'text-black bg-white'}
                                                            >
                                                                {opt}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <div className="absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none text-white opacity-50 text-xs">▼</div>
                                                </div>
                                            </td>
                                            <td className="p-3 text-gray-400 text-sm max-w-[200px] cursor-pointer hover:bg-white/10 rounded px-2 transition" onClick={(e) => openMemoPopup(e, c, 'last_memo')}><div className="truncate">{c.last_memo || <span className="text-gray-600 text-xs">클릭하여 입력...</span>}</div></td>
                                        </>}
                                        {activeTab === 'sales' && <>
                                            <td className="p-3"><span className="bg-gray-600 px-2 py-1 rounded text-xs">{c.platform || '-'}</span></td>
                                            <td className="p-3">{c.upload_date}</td>
                                            <td className="p-3" onClick={(e) => e.stopPropagation()}><input type="date" className="bg-transparent text-white text-sm outline-none cursor-pointer hover:text-blue-400 w-28" value={c.installed_date || ''} onChange={(e) => handleInlineUpdate(c.id, 'installed_date', e.target.value)} /></td>
                                            <td className="p-3 font-bold">{c.name}</td>
                                            <td className="p-3">{c.phone}</td>
                                            <td className="p-3" onClick={(e) => e.stopPropagation()}><input type="number" className="w-14 bg-transparent text-white text-sm outline-none border-b border-gray-600 hover:border-yellow-500 focus:border-yellow-500 text-right font-bold text-yellow-400" defaultValue={c.agent_policy || 0} onBlur={(e) => handleInlineUpdate(c.id, 'agent_policy', e.target.value)} placeholder="0" /></td>
                                            <td className="p-3" onClick={(e) => e.stopPropagation()}><input type="number" className="w-12 bg-transparent text-white text-sm outline-none border-b border-transparent hover:border-gray-500 focus:border-blue-500 text-right" defaultValue={c.support_amt || 0} onBlur={(e) => handleInlineUpdate(c.id, 'support_amt', e.target.value)} /></td>
                                            <td className="p-3 font-bold text-green-400">{formatCurrency(((parseInt(c.agent_policy || 0) || 0) - (parseInt(c.support_amt || 0) || 0)) * 10000)}원</td>
                                            <td className="p-3" onClick={(e) => e.stopPropagation()}><div className="relative"><select className={`w-full p-2 rounded text-xs font-bold cursor-pointer outline-none transition hover:opacity-90 ${getBadgeStyle(c.status)}`} style={{ appearance: 'none', WebkitAppearance: 'none', textAlign: 'center' }} value={c.status} onChange={(e) => handleInlineUpdate(c.id, 'status', e.target.value)}>{SALES_STATUS_OPTIONS.map(opt => <option key={opt} value={opt} className="text-black bg-white">{opt}</option>)}</select><div className="absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none text-white opacity-50 text-xs">▼</div></div></td>
                                            <td className="p-3 text-sm max-w-[150px] cursor-pointer hover:bg-white/10 rounded transition" onClick={(e) => openMemoPopup(e, c, 'additional_info')}>{hasPostProcessIssue ? (<div className="flex flex-col"><span className={`text-xs font-bold mb-1 ${isPostProcessDone ? 'text-green-400' : 'text-orange-400'}`}>{isPostProcessDone ? '✅ 처리완료' : '⚠️ 후처리 필요'}</span><span className="text-gray-300 truncate text-[11px]">{c.additional_info}</span></div>) : <span className="text-gray-600 text-xs">클릭하여 메모 추가</span>}</td>
                                            <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>{hasPostProcessIssue ? (<input type="checkbox" className="w-6 h-6 accent-green-500 cursor-pointer" checked={isPostProcessDone} onChange={(e) => handleTogglePostProcess(e, c)} title="클릭하면 완료 처리되고 붉은색이 사라집니다." />) : <input type="checkbox" className="w-5 h-5 accent-gray-500 cursor-not-allowed opacity-10" disabled />}</td>
                                        </>}
                                        <td className="p-3 font-bold text-red-400">{isDup ? '❌ 중복' : ''}</td>
                                    </tr>
                                );
                            })}
                            {(currentData || []).length === 0 && <tr><td colSpan="12" className="p-10 text-center text-gray-500">데이터가 없습니다.</td></tr>}
                        </tbody>
                    </table>
                ) : (
                    <div className="p-4 animate-fade-in">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold border-l-4 border-yellow-500 pl-4 flex items-center gap-2">
                                📊
                                <span className="text-white">{calculatedStats.agentLabel}</span>님의
                                <span className="text-blue-400 ml-1">{calculatedStats.periodLabel}</span> 성적표
                            </h2>

                            <div className="flex gap-3">
                                <select
                                    className="bg-[#222] text-white border border-gray-600 rounded-md px-3 py-2 text-sm font-bold outline-none focus:border-blue-500"
                                    value={statUserId}
                                    onChange={(e) => setStatUserId(e.target.value)}
                                >
                                    <option value="mine">👤 내 통계 보기</option>
                                    <option value="ALL">🏢 전체 통합 통계</option>
                                    <optgroup label="다른 상담사 선택">
                                        {agentOptions
                                            .filter(agent => agent.id !== user.user_id)
                                            .map(agent => (
                                                <option key={agent.id} value={agent.id}>
                                                    {agent.name}
                                                </option>
                                            ))
                                        }
                                    </optgroup>
                                </select>

                                <div className="flex bg-[#222] rounded-lg p-1">
                                    {['today:오늘', 'week:이번주', 'month:이번달', 'all:전체'].map((item) => {
                                        const [val, label] = item.split(':');
                                        return <button key={val} onClick={() => setPeriodFilter(val)} className={`px-4 py-2 rounded-md text-sm font-bold transition ${periodFilter === val ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}>{label}</button>;
                                    })}
                                </div>
                            </div>
                        </div>
                        <div className="grid grid-cols-4 gap-4 mb-4">
                            <div className="bg-[#444] p-6 rounded-xl shadow border border-gray-600"><h3 className="text-gray-400 text-sm">총 할당 DB</h3><p className="text-3xl font-bold text-white mt-2">{formatCurrency(calculatedStats.total_db)}건</p></div>
                            <div className="bg-[#2c3e50] p-6 rounded-xl shadow border border-blue-500 relative overflow-hidden"><h3 className="text-blue-200 text-sm">🔥 총 접수 성과</h3><p className="text-3xl font-bold text-white mt-2">{formatCurrency(calculatedStats.accept_count)}건</p><span className="absolute top-4 right-4 text-4xl font-bold text-blue-400/20">{calculatedStats.accept_rate}%</span></div>
                            <div className="bg-[#444] p-6 rounded-xl shadow border border-gray-600"><h3 className="text-gray-400 text-sm">💰 예상 순수익</h3><p className="text-3xl font-bold text-yellow-400 mt-2">{formatCurrency(calculatedStats.net_profit)}원</p></div>
                            <div className="bg-[#1e3a2a] p-6 rounded-xl shadow border border-green-600"><h3 className="text-green-300 text-sm">💵 설치 확정 매출</h3><p className="text-3xl font-bold text-green-400 mt-2">{formatCurrency(calculatedStats.installed_revenue)}원</p></div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 mb-8">
                            <div className="bg-[#3d2b2b] p-5 rounded-xl border border-red-900/50 flex items-center justify-between"><div><h3 className="text-red-300 text-sm font-bold">📉 취소율 (방어율)</h3><p className="text-xs text-gray-400 mt-1">접수 건 중 취소된 비율</p></div><div className="text-right"><p className="text-3xl font-bold text-red-400">{calculatedStats.cancel_rate}%</p></div></div>
                            <div className="bg-[#2b3d33] p-5 rounded-xl border border-green-900/50 flex items-center justify-between"><div><h3 className="text-green-300 text-sm font-bold">✅ 개통율 (완성도)</h3><p className="text-xs text-gray-400 mt-1">접수 건 중 설치된 비율</p></div><div className="text-right"><p className="text-3xl font-bold text-green-400">{calculatedStats.install_rate}%</p></div></div>
                        </div>
                    </div>
                )}
            </div>

            {showCompletionModal && completionTarget && (
                <div className="fixed inset-0 bg-black bg-opacity-80 flex justify-center items-center backdrop-blur-sm z-50">
                    <div className="bg-[#383838] p-6 rounded-xl w-[500px] border border-green-500 shadow-2xl animate-fade-in-up">
                        <div className="flex justify-between items-center mb-6 border-b border-gray-600 pb-2"><h2 className="text-xl font-bold text-green-400">🎉 접수 완료</h2><button onClick={() => setShowCompletionModal(false)} className="text-gray-400 hover:text-white">✖</button></div>
                        <div className="mb-4"><label className="block text-sm font-bold text-gray-300 mb-2">통신사</label><div className="flex gap-2">{Object.keys(FORM_TEMPLATES).map(p => (<button key={p} onClick={() => { setSelectedPlatform(p); setDynamicFormData({}); }} className={`flex-1 py-2 rounded-lg font-bold border ${selectedPlatform === p ? 'bg-green-600 border-green-400' : 'bg-[#444] border-gray-600'}`}>{p}</button>))}</div></div>
                        <div className="bg-[#222] p-4 rounded-lg border border-gray-600 mb-4 max-h-[200px] overflow-y-auto">{(FORM_TEMPLATES[selectedPlatform] || []).map(f => (<div key={f.id} className="mb-3"><label className="block text-sm text-white mb-1">{f.label}</label>{f.type === 'select' && <select className="w-full bg-[#333] border border-gray-500 rounded p-2 text-white" onChange={e => setDynamicFormData({ ...dynamicFormData, [f.id]: e.target.value })}><option value="">선택</option>{f.options.map(o => <option key={o} value={o}>{o}</option>)}</select>}{f.type === 'text' && <input type="text" className="w-full bg-[#333] border border-gray-500 rounded p-2 text-white" placeholder={f.placeholder} onChange={e => setDynamicFormData({ ...dynamicFormData, [f.id]: e.target.value })} />}{f.type === 'radio' && <div className="flex gap-4">{f.options.map(o => <label key={o} className="flex gap-1 items-center"><input type="radio" name={f.id} className="accent-green-500" onChange={() => setDynamicFormData({ ...dynamicFormData, [f.id]: o })} />{o}</label>)}</div>}{f.type === 'checkbox' && <div className="flex gap-4">{f.options.map(o => <label key={o} className="flex gap-1 items-center"><input type="checkbox" className="accent-green-500" onChange={e => setDynamicFormData({ ...dynamicFormData, [f.id]: e.target.checked ? o : '' })} />{o}</label>)}</div>}</div>))}</div>
                        <button onClick={handleConfirmCompletion} className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-lg">완료 및 저장</button>
                    </div>
                </div>
            )}

            {memoPopupTarget && (
                <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center backdrop-blur-sm z-50">
                    <div className="bg-[#383838] p-6 rounded-xl w-[400px] border border-blue-500 text-white shadow-2xl animate-fade-in-up">
                        <h2 className="text-xl font-bold mb-2 text-blue-400">{memoFieldType === 'additional_info' ? '📝 후처리 메모' : '💬 상담 내용 메모'}</h2>
                        <textarea ref={memoInputRef} className="w-full h-32 bg-[#2b2b2b] p-3 rounded border border-gray-600 text-sm text-white resize-none outline-none focus:border-blue-500" value={memoPopupText} onChange={e => setMemoPopupText(e.target.value)} placeholder="내용을 입력하세요..." />
                        <div className="flex justify-end gap-2 mt-4"><button onClick={() => setMemoPopupTarget(null)} className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded">취소</button><button onClick={saveMemoPopup} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded font-bold">저장</button></div>
                    </div>
                </div>
            )}

            {selectedCustomer && (
                <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center backdrop-blur-sm z-50" onClick={() => setSelectedCustomer(null)}>
                    <div className="bg-[#2f2f2f] rounded-xl w-[600px] h-[70vh] border border-gray-600 flex flex-col overflow-hidden text-gray-200 shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center p-4 bg-[#2b2b2b] border-b border-gray-600"><h2 className="text-xl font-bold flex items-center gap-2">📜 {selectedCustomer.name} 상담 이력</h2><button onClick={() => setSelectedCustomer(null)} className="text-2xl text-gray-400 hover:text-white">✖</button></div>
                        <div className="flex-1 overflow-y-auto bg-[#222] p-4 flex flex-col gap-3">{(selectedCustomer.logs || []).length === 0 ? <div className="text-center text-gray-500 mt-10">아직 상담 이력이 없습니다.</div> : (selectedCustomer.logs || []).map((l, i) => (<div key={i} className="bg-[#333] p-3 rounded-lg border border-gray-600"><div className="flex justify-between mb-1"><span className="text-xs text-blue-300 font-bold">{l.writer_name}</span><span className="text--[10px] text-gray-500">{formatLogDate(l.created_at)}</span></div><div className="text-sm text-gray-200 whitespace-pre-wrap">{l.content}</div></div>))}</div>
                        <div className="p-4 bg-[#2b2b2b] border-t border-gray-600 flex gap-2"><textarea className="flex-1 bg-[#444] border border-gray-600 rounded p-3 h-16 text-white text-sm outline-none focus:border-blue-500 resize-none" placeholder="새로운 상담 내용을 입력하세요..." value={newLog} onChange={e => setNewLog(e.target.value)} /><button onClick={handleAddLog} className="bg-blue-600 hover:bg-blue-500 px-6 rounded text-white font-bold transition">등록</button></div>
                    </div>
                </div>
            )}

            {showReferralModal && (
                <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center backdrop-blur-sm z-50">
                    <div className="bg-[#383838] p-6 rounded-xl w-[400px] border border-green-500 text-white shadow-2xl animate-fade-in-up">
                        <h2 className="text-xl font-bold mb-4 text-green-400">🤝 소개/지인 접수 등록</h2>
                        <div className="flex flex-col gap-3"><div><label className="block text-xs text-gray-400 mb-1">고객명</label><input className="w-full bg-[#2b2b2b] border border-gray-600 rounded p-2 text-white" value={referralData.name} onChange={e => setReferralData({ ...referralData, name: e.target.value })} placeholder="이름" /></div><div><label className="block text-xs text-gray-400 mb-1">전화번호 (필수)</label><input className="w-full bg-[#2b2b2b] border border-gray-600 rounded p-2 text-white" value={referralData.phone} onChange={e => setReferralData({ ...referralData, phone: e.target.value })} placeholder="010-0000-0000" /></div><div><label className="block text-xs text-gray-400 mb-1">통신사</label><select className="w-full bg-[#2b2b2b] border border-gray-600 rounded p-2 text-white" value={referralData.platform} onChange={e => setReferralData({ ...referralData, platform: e.target.value })}><option value="KT">KT</option><option value="SKT">SKT</option><option value="LG">LG</option></select></div><div><label className="block text-xs text-gray-400 mb-1">상품 정보</label><input className="w-full bg-[#2b2b2b] border border-gray-600 rounded p-2 text-white" value={referralData.product_info} onChange={e => setReferralData({ ...referralData, product_info: e.target.value })} placeholder="예: 500M + 베이직 TV" /></div></div>
                        <div className="flex justify-end gap-2 mt-6"><button onClick={() => setShowReferralModal(false)} className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded">취소</button><button onClick={handleReferralSubmit} className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded font-bold">즉시 접수</button></div>
                    </div>
                </div>
            )}

            {showUploadModal && <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center backdrop-blur-sm z-50"><div className="bg-[#383838] p-6 rounded-xl w-[600px] border border-gray-600 text-white"><h2 className="text-xl font-bold mb-4">📤 엑셀 복사 등록</h2><textarea placeholder="붙여넣기..." className="w-full h-40 bg-[#2b2b2b] p-3 rounded border border-gray-600 text-sm font-mono mb-4 text-white" value={pasteData} onChange={handlePaste} /><div className="flex justify-end gap-2"><button onClick={() => setShowUploadModal(false)} className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded">취소</button><button onClick={handleBulkSubmit} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded font-bold">등록하기</button></div></div></div>}
        </div>
    );
}

export default AgentDashboard;
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';

// ==================================================================================
// 1. 상수 및 설정값
// ==================================================================================
const API_BASE = "http://127.0.0.1:8000"; // Django 서버 주소

const STATUS_OPTIONS = ['미통건', '부재', '재통', '가망', '장기가망', 'AS요청', '실패', '실패이관', '접수완료'];
const SALES_STATUS_OPTIONS = ['접수완료', '설치완료', '해지진행', '접수취소'];

const TIME_OPTIONS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
const QUICK_FILTERS = ['ALL', '재통', '가망', '부재', '미통건'];

// 기본 상용구 (처음 실행 시 자동 등록됨)
const DEFAULT_MACROS = [
    "안녕하세요! 전문 상담사입니다. 무엇을 도와드릴까요?",
    "네, 고객님. 잠시만 기다려 주시면 확인해 드리겠습니다.",
    "혹시 통화 가능하신 시간이 언제이실까요?",
    "상담해 주셔서 감사합니다. 좋은 하루 보내세요!",
    "부재중이셔서 문자 남깁니다. 편하실 때 연락 부탁드립니다."
];

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

    const [isChatOpen, setIsChatOpen] = useState(false);
    const [chatView, setChatView] = useState('LIST'); // 'LIST' or 'ROOM'
    const [chatTarget, setChatTarget] = useState(null);
    const [chatListSearch, setChatListSearch] = useState('');

    const [chatMessages, setChatMessages] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const chatScrollRef = useRef(null);
    const [isSending, setIsSending] = useState(false);

    // ⭐️ 상용구(매크로) 관련 State (패널 열림/닫힘)
    const [showMacroPanel, setShowMacroPanel] = useState(false);
    const [macros, setMacros] = useState(() => {
        const saved = localStorage.getItem('agent_macros');
        return saved ? JSON.parse(saved) : DEFAULT_MACROS;
    });
    const [newMacroText, setNewMacroText] = useState('');

    // 홍보 링크용 대상 번호 입력 변수
    const [chatInputNumber, setChatInputNumber] = useState('');

    const [customers, setCustomers] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('shared');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [searchTerm, setSearchTerm] = useState('');

    const [periodFilter, setPeriodFilter] = useState('month');
    const [statUserId, setStatUserId] = useState('mine');

    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [showNotiDropdown, setShowNotiDropdown] = useState(false);
    const [showReferralModal, setShowReferralModal] = useState(false);
    const [referralData, setReferralData] = useState({ name: '', phone: '', platform: 'KT', product_info: '' });
    const [selectedIds, setSelectedIds] = useState([]);

    const [showCompletionModal, setShowCompletionModal] = useState(false);
    const [completionTarget, setCompletionTarget] = useState(null);
    const [selectedPlatform, setSelectedPlatform] = useState('KT');
    const [dynamicFormData, setDynamicFormData] = useState({});

    const [memoPopupTarget, setMemoPopupTarget] = useState(null);
    const [memoPopupText, setMemoPopupText] = useState('');
    const [memoFieldType, setMemoFieldType] = useState('');

    const [pasteData, setPasteData] = useState('');
    const [parsedData, setParsedData] = useState([]);
    const [newLog, setNewLog] = useState('');

    const memoInputRef = useRef(null);

    const getAuthHeaders = useCallback(() => {
        const token = localStorage.getItem('token');
        return { 'Content-Type': 'application/json', 'Authorization': `Token ${token}` };
    }, []);

    // 상용구 저장 효과
    useEffect(() => {
        localStorage.setItem('agent_macros', JSON.stringify(macros));
    }, [macros]);

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
            }, 3000); // 3초마다 갱신
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

    const chatListCustomers = useMemo(() => {
        let list = myAllCustomers;
        if (chatListSearch) {
            list = list.filter(c =>
                (c.name && c.name.includes(chatListSearch)) ||
                (c.phone && c.phone.includes(chatListSearch))
            );
        }
        return list.sort((a, b) => new Date(b.upload_date) - new Date(a.upload_date));
    }, [myAllCustomers, chatListSearch]);

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

    useEffect(() => {
        let interval;
        if (isChatOpen && chatView === 'ROOM' && chatTarget) {
            fetchChatHistory();
            interval = setInterval(fetchChatHistory, 3000);
        }
        return () => clearInterval(interval);
    }, [isChatOpen, chatView, chatTarget]);

    useEffect(() => {
        if (isChatOpen && chatView === 'ROOM' && chatScrollRef.current) {
            chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
        }
    }, [chatMessages, isChatOpen, chatView]);

    const fetchChatHistory = async () => {
        if (!chatTarget) return;
        try {
            const res = await fetch(`${API_BASE}/api/sms/history/${chatTarget.id}/`, { headers: getAuthHeaders() });
            if (res.ok) {
                const data = await res.json();
                setChatMessages(data);
            }
        } catch (err) {
            console.error("채팅 로드 실패", err);
        }
    };

    const enterChatRoom = (customer) => {
        setChatTarget(customer);
        setChatView('ROOM');
        setChatMessages([]);
    };

    const backToChatList = () => {
        setChatView('LIST');
        setChatTarget(null);
        setChatMessages([]);
    };

    // ⚡️ [수정됨] 내가 보낸 문자 바로 반영 (Optimistic UI)
    const handleSendManualChat = async () => {
        if (!chatInput.trim() || !chatTarget) return;

        const messageToSend = chatInput;
        setIsSending(true);

        try {
            const res = await fetch(`${API_BASE}/api/sales/manual-sms/`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    customer_id: chatTarget.id,
                    message: messageToSend
                })
            });

            if (res.ok) {
                setChatInput('');

                // 화면에 즉시 추가 (노란색 말풍선)
                const tempMessage = {
                    id: Date.now(),
                    sender: 'me',
                    text: messageToSend,
                    created_at: '방금 전'
                };
                setChatMessages(prev => [...prev, tempMessage]);

                if (chatScrollRef.current) {
                    setTimeout(() => {
                        chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
                    }, 100);
                }

                setTimeout(() => fetchChatHistory(), 500);
            } else {
                alert("전송 실패 (앱 연결 상태를 확인하세요)");
            }
        } catch (err) {
            alert("오류 발생");
        } finally {
            setIsSending(false);
        }
    };

    const handleSendPromoChat = async () => {
        if (!chatInputNumber) return alert("번호를 입력해주세요.");
        setIsSending(true);
        const initialMessage = `[상담안내] 안녕하세요 고객님, 상담 요청해주셔서 감사합니다. 궁금하신 점 편하게 말씀해주세요.`;

        try {
            const res = await fetch(`${API_BASE}/api/leads/capture/`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    phone: chatInputNumber,
                    agent_id: user.user_id,
                    name: "신규문의",
                    message: initialMessage
                })
            });

            if (res.ok) {
                alert("✅ 발송 완료! '공유DB' 또는 '상담관리'에서 확인하세요.");
                setChatInputNumber('');
                fetchCustomers();
            } else {
                alert("발송 실패 (핸드폰 앱이 켜져있나요?)");
            }
        } catch (err) {
            alert("서버 연결 오류");
        } finally {
            setIsSending(false);
        }
    };

    const handleTestConnection = async () => {
        const testNum = prompt("본인의 핸드폰 번호를 입력하세요 (테스트 문자 발송)");
        if (!testNum) return;

        try {
            const res = await fetch(`${API_BASE}/api/leads/capture/`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    phone: testNum,
                    agent_id: user.user_id,
                    name: "시스템테스트",
                    message: "[시스템] 연결 테스트 성공입니다!"
                })
            });
            if (res.ok) {
                alert("테스트 성공! 문자가 도착했는지 확인하세요.");
            } else {
                alert("실패. PC에서 핸드폰 앱(IP)으로 접속할 수 없습니다.");
            }
        } catch (e) {
            alert("서버 오류");
        }
    };

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

    const handleStatusChangeRequest = async (id, newStatus) => {
        if (newStatus === '접수완료') {
            const target = customers.find(c => c.id === id);
            setCompletionTarget(target);
            setSelectedPlatform(target.platform || 'KT');
            setDynamicFormData({});
            setShowCompletionModal(true);
            return;
        } else if (newStatus === '실패이관') {
            try {
                await fetch(`${API_BASE}/api/customers/${id}/add_log/`, {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({
                        user_id: user.user_id,
                        content: `[시스템] 빠른 실패이관 처리 (팝업생략)`
                    })
                });
                await fetch(`${API_BASE}/api/customers/${id}/`, {
                    method: 'PATCH',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({
                        status: '실패이관',
                        owner: null
                    })
                });
                fetchCustomers();
            } catch (err) {
                console.error(err);
            }
            return;
        }
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

    // ⭐️ 상용구 관리 핸들러
    const handleAddMacro = () => {
        if (!newMacroText.trim()) return;
        setMacros([...macros, newMacroText]);
        setNewMacroText('');
    };

    const handleDeleteMacro = (index) => {
        const newMacros = macros.filter((_, i) => i !== index);
        setMacros(newMacros);
    };

    const handleSelectMacro = (text) => {
        setChatInput(text);
        // setShowMacroPanel(false); // 닫지 않고 연속 입력 가능하게 유지 (원하면 주석 해제)
    };

    // ==================================================================================
    // 8. Render
    // ==================================================================================
    return (
        <div className="min-h-screen bg-[#2b2b2b] text-gray-100 p-5 font-sans relative" onClick={() => setShowNotiDropdown(false)}>

            {isLoading && (<div className="fixed inset-0 bg-black/50 z-[100] flex justify-center items-center backdrop-blur-[2px]"><div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500"></div></div>)}

            <header className="flex justify-between items-center bg-[#1e1e1e] p-4 rounded-xl shadow-lg mb-6 border border-gray-700 relative z-20">
                <h1 className="text-xl font-bold text-white flex items-center gap-2">📞 {user.username}님의 워크스페이스</h1>

                <div className="flex items-center gap-6">

                    {/* 1. 채팅 아이콘 버튼 */}
                    <button
                        onClick={() => setIsChatOpen(!isChatOpen)}
                        className={`text-2xl p-2 rounded-full transition-all shadow-md ${isChatOpen ? 'bg-yellow-400 text-black scale-110' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                            }`}
                        title="실시간 문자 채팅"
                    >
                        💬
                    </button>

                    {/* 2. 폰 연결 상태 버튼 (토큰 입력 제거하고 '테스트' 버튼으로 변경) */}
                    <button
                        onClick={handleTestConnection}
                        className="text-xs font-bold px-4 py-2 rounded-lg border transition-all bg-blue-900/40 border-blue-500 text-blue-300 hover:bg-blue-800"
                    >
                        📶 연결 테스트
                    </button>

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

            {/* 기존 대시보드 리스트 및 탭 UI */}
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

            {/* ... Summary Metrics 및 Table 렌더링 코드 ... */}
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
                        {/* 테이블 내용은 그대로 유지 */}
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
                                            <td className="p-3" onClick={(e) => e.stopPropagation()}><div className="relative"><select className={`w-full p-2 rounded text-xs font-bold cursor-pointer outline-none transition hover:opacity-90 ${getBadgeStyle(c.status)}`} style={{ appearance: 'none', WebkitAppearance: 'none', textAlign: 'center' }} value={c.status} onChange={(e) => handleStatusChangeRequest(c.id, e.target.value)}>{STATUS_OPTIONS.map(opt => <option key={opt} value={opt} className="text-black bg-white">{opt}</option>)}</select><div className="absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none text-white opacity-50 text-xs">▼</div></div></td>
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
                    // 통계 화면 (기존 유지)
                    <div className="p-4 animate-fade-in">
                        {/* ... 통계 UI 코드 ... */}
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold border-l-4 border-yellow-500 pl-4 flex items-center gap-2">
                                📊 <span className="text-white">{calculatedStats.agentLabel}</span>님의 <span className="text-blue-400 ml-1">{calculatedStats.periodLabel}</span> 성적표
                            </h2>
                            <div className="flex gap-3">
                                <select className="bg-[#222] text-white border border-gray-600 rounded-md px-3 py-2 text-sm font-bold outline-none focus:border-blue-500" value={statUserId} onChange={(e) => setStatUserId(e.target.value)}>
                                    <option value="mine">👤 내 통계 보기</option>
                                    <option value="ALL">🏢 전체 통합 통계</option>
                                    <optgroup label="다른 상담사 선택">
                                        {agentOptions.filter(agent => agent.id !== user.user_id).map(agent => (
                                            <option key={agent.id} value={agent.id}>{agent.name}</option>
                                        ))}
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

            {/* 💬 우측 채팅 사이드바 (카카오톡 스타일) */}
            <div className={`fixed top-0 right-0 h-full w-[350px] bg-[#bacee0] shadow-2xl z-[150] transform transition-transform duration-300 flex flex-col ${isChatOpen ? 'translate-x-0' : 'translate-x-full'}`}>

                {/* 1. 상단 헤더 */}
                <div className="bg-[#a9bdce] p-4 flex justify-between items-center border-b border-gray-400/30 h-16">
                    {chatView === 'LIST' ? (
                        <h2 className="font-bold text-gray-800 text-lg">💬 채팅 목록</h2>
                    ) : (
                        <div className="flex items-center gap-2">
                            <button onClick={backToChatList} className="text-2xl text-gray-600 hover:text-black">⬅</button>
                            <div>
                                <h2 className="font-bold text-gray-800">{chatTarget?.name || '고객'}</h2>
                                <p className="text-xs text-gray-600">{chatTarget?.phone}</p>
                            </div>
                        </div>
                    )}
                    <button onClick={() => setIsChatOpen(false)} className="text-xl text-gray-600 hover:text-black">✕</button>
                </div>

                {/* 2. 컨텐츠 영역 (목록 OR 채팅방) */}
                <div className="flex-1 overflow-y-auto bg-white/50">

                    {/* [VIEW 1] 채팅 목록 화면 */}
                    {chatView === 'LIST' && (
                        <div className="flex flex-col">
                            {/* 상단: 검색 및 홍보발송 */}
                            <div className="p-4 bg-white border-b border-gray-200">
                                {/* 검색창 */}
                                <div className="mb-3">
                                    <label className="text-[10px] text-gray-500 font-bold ml-1">🔍 검색 (이름/번호)</label>
                                    <input
                                        className="w-full bg-gray-100 border-none rounded-lg px-4 py-2 text-sm outline-none"
                                        placeholder="이름 또는 뒷자리..."
                                        value={chatListSearch}
                                        onChange={(e) => setChatListSearch(e.target.value)}
                                    />
                                </div>

                                {/* 홍보 링크 발송기 (입력창 수정됨) */}
                                <div>
                                    <label className="text-[10px] text-gray-500 font-bold ml-1">✉️ 신규발송 (번호입력)</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="tel"
                                            autoComplete="off"
                                            className="flex-1 bg-black border border-gray-300 rounded px-2 py-1 text-sm outline-none focus:border-yellow-400"
                                            placeholder="01012345678"
                                            value={chatInputNumber}
                                            onChange={(e) => setChatInputNumber(e.target.value)}
                                        />
                                        <button onClick={handleSendPromoChat} className="bg-yellow-400 hover:bg-yellow-500 text-black px-3 py-1 rounded text-xs font-bold whitespace-nowrap">보내기</button>
                                    </div>
                                </div>
                            </div>

                            {/* 고객 리스트 */}
                            <div className="flex flex-col">
                                {chatListCustomers.length === 0 ? (
                                    <div className="p-10 text-center text-gray-500 text-sm">검색 결과가 없습니다.</div>
                                ) : (
                                    chatListCustomers.map(cust => (
                                        <div
                                            key={cust.id}
                                            onClick={() => enterChatRoom(cust)}
                                            className="flex items-center gap-3 p-3 hover:bg-white cursor-pointer border-b border-gray-100 transition"
                                        >
                                            {/* 프로필 프사 대용 */}
                                            <div className="w-10 h-10 rounded-xl bg-yellow-200 flex justify-center items-center text-lg shadow-sm">
                                                👤
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex justify-between">
                                                    <span className="font-bold text-gray-800 text-sm">{cust.name}</span>
                                                    <span className="text-[10px] text-gray-400">{cust.status}</span>
                                                </div>
                                                <div className="text-xs text-gray-500 truncate w-48">{cust.phone}</div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {/* [VIEW 2] 채팅방 화면 */}
                    {chatView === 'ROOM' && (
                        <div className="flex flex-col h-full relative overflow-hidden">
                            {/* 채팅 메시지 영역 */}
                            <div className="flex-1 p-4 flex flex-col gap-3 overflow-y-auto" ref={chatScrollRef}>
                                {chatMessages.length === 0 ? (
                                    <div className="text-center text-gray-500 mt-10 text-xs">대화 내역이 없습니다.<br />메시지를 보내보세요!</div>
                                ) : (
                                    chatMessages.map((msg) => (
                                        <div key={msg.id} className={`flex flex-col ${msg.sender === 'me' ? 'items-end' : 'items-start'}`}>
                                            <div className={`p-2 rounded-lg text-sm max-w-[80%] whitespace-pre-wrap shadow-sm border ${msg.sender === 'me'
                                                    ? 'bg-yellow-300 text-black border-yellow-400 rounded-tr-none'
                                                    : 'bg-white text-black border-gray-300 rounded-tl-none'
                                                }`}>
                                                {msg.text}
                                            </div>
                                            <span className="text-[9px] text-gray-500 mt-1 px-1">
                                                {msg.created_at} {msg.sender === 'other' && '📥'}
                                            </span>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* ⭐️ [수정됨] 상용구 패널 (왼쪽에서 나오는 서랍형 - 채팅창 바깥) */}
                            <div className={`fixed top-0 right-[350px] h-full w-64 bg-[#2b2b2b] border-r border-gray-600 shadow-2xl z-[140] flex flex-col transition-transform duration-300 ${showMacroPanel && isChatOpen ? 'translate-x-0' : 'translate-x-full pointer-events-none opacity-0'}`}>
                                <div className="flex justify-between items-center p-3 border-b border-gray-600 bg-[#333]">
                                    <span className="text-xs font-bold text-yellow-400">⚡ 자주 쓰는 문구</span>
                                    <button onClick={() => setShowMacroPanel(false)} className="text-gray-400 hover:text-white">✕</button>
                                </div>

                                {/* 리스트 영역 */}
                                <div className="flex-1 overflow-y-auto p-2 custom-scrollbar bg-[#2b2b2b]">
                                    {macros.length === 0 ? (
                                        <div className="text-center text-gray-500 text-xs mt-10">등록된 문구가 없습니다.</div>
                                    ) : (
                                        macros.map((macro, idx) => (
                                            <div key={idx} className="group flex items-center justify-between bg-[#383838] mb-2 p-2 rounded hover:bg-[#444] border border-gray-700 hover:border-blue-500 transition cursor-pointer shadow-sm">
                                                <div
                                                    className="text-xs text-gray-200 flex-1 leading-relaxed"
                                                    onClick={() => handleSelectMacro(macro)}
                                                    title="클릭하면 입력됩니다"
                                                >
                                                    {macro}
                                                </div>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleDeleteMacro(idx); }}
                                                    className="text-gray-500 hover:text-red-400 ml-2 opacity-0 group-hover:opacity-100 transition px-1"
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>

                                {/* 추가 입력 영역 */}
                                <div className="p-2 border-t border-gray-600 bg-[#333]">
                                    <div className="flex gap-1">
                                        <input
                                            className="flex-1 bg-[#222] border border-gray-500 rounded px-2 py-1 text-xs text-white outline-none focus:border-yellow-400"
                                            placeholder="새 문구..."
                                            value={newMacroText}
                                            onChange={(e) => setNewMacroText(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleAddMacro()}
                                        />
                                        <button onClick={handleAddMacro} className="bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded text-xs font-bold whitespace-nowrap">추가</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* 3. 하단 입력창 (채팅방일 때만 표시) */}
                {chatView === 'ROOM' && (
                    <div className="p-3 bg-white border-t border-gray-200 relative z-30">
                        {/* ⭐️ [수정] 상용구 버튼 */}
                        <div className="flex justify-end mb-2">
                            <button
                                onClick={() => setShowMacroPanel(!showMacroPanel)}
                                className={`text-xs px-3 py-1 rounded-full font-bold flex items-center gap-1 shadow-sm border transition ${showMacroPanel ? 'bg-yellow-400 text-black border-yellow-500' : 'bg-gray-200 text-gray-700 border-gray-300 hover:bg-gray-300'}`}
                            >
                                ⚡ 자주 쓰는 문구
                            </button>
                        </div>

                        <div className="flex flex-col gap-2">
                            <textarea
                                className="w-full h-16 border-none outline-none text-sm text-black resize-none bg-transparent"
                                placeholder="메시지 입력..."
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSendManualChat();
                                    }
                                }}
                            />
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] text-gray-400">Enter 전송 / Shift+Enter 줄바꿈</span>
                                <button
                                    onClick={handleSendManualChat}
                                    disabled={isSending}
                                    className={`px-4 py-1.5 rounded font-bold text-xs transition ${isSending ? 'bg-gray-300 text-gray-500' : 'bg-yellow-400 hover:bg-yellow-500 text-black'
                                        }`}
                                >
                                    {isSending ? "전송중..." : "전송"}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* 나머지 모달 컴포넌트들 (기존 유지) */}
            {showCompletionModal && completionTarget && (
                <div className="fixed inset-0 bg-black bg-opacity-80 flex justify-center items-center backdrop-blur-sm z-50">
                    <div className="bg-[#383838] p-6 rounded-xl w-[500px] border border-green-500 shadow-2xl animate-fade-in-up">
                        {/* ... 기존 모달 내용 유지 ... */}
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
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';

// ==================================================================================
// 1. 상수 및 설정값
// ==================================================================================
const API_BASE = "https://panda-1-hd18.onrender.com"; // Django 서버 주소

const STATUS_OPTIONS = ['미통건', '부재', '재통', '가망', '장기가망', 'AS요청', '실패', '실패이관', '접수완료'];
const SALES_STATUS_OPTIONS = ['접수완료', '설치완료', '해지진행', '접수취소'];

const TIME_OPTIONS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
const QUICK_FILTERS = ['ALL', '재통', '가망', '부재', '미통건'];

const SHARED_SUB_TABS = [
    { id: 'ALL', label: '전체 보기' },
    { id: '당근', label: '🥕 당근' },
    { id: '토스', label: '💸 토스' },
    { id: '실패DB', label: '🚫 실패DB' },
    { id: '기타', label: '🎸 기타' }
];

const REPORT_PLATFORM_FILTERS = [
    { id: 'ALL', label: '🏢 전체' },
    { id: '당근', label: '📱 당근' },
    { id: '1차콜', label: '📞 1차콜' },
    { id: '토스', label: '💸 토스' },
    { id: '3만디비', label: '📂 3만디비' }
];

const POLICY_TABS = ['KT', 'SK', 'LG', 'Sky'];

const DEFAULT_MACROS_GROUPED = {
    "공통": [
        "안녕하세요! 전문 상담사입니다. 무엇을 도와드릴까요?",
        "네, 고객님. 잠시만 기다려 주시면 확인해 드리겠습니다.",
        "혹시 통화 가능하신 시간이 언제이실까요?",
        "부재중이셔서 문자 남깁니다. 편하실 때 연락 부탁드립니다.",
        "상담해 주셔서 감사합니다. 좋은 하루 보내세요!"
    ],
    "KT": ["[KT] 인터넷 500M + TV 베이직 결합 시 월 3만원대!", "[KT] 기가지니3 셋톱박스 무상 업그레이드 프로모션 중입니다.", "[KT] 휴대폰 결합 시 추가 할인이 가능합니다."],
    "SK": ["[SKT] 온가족프리/온가족플랜 결합 시 요금 안내드립니다.", "[SKT] B tv All 요금제로 넷플릭스까지 한번에 즐겨보세요.", "[SKT] 광랜(100M) 상품 가성비 추천 드립니다."],
    "LG": ["[LG U+] 아이들나라 콘텐츠가 포함된 프리미엄 요금제 추천!", "[LG U+] 참 쉬운 가족 결합으로 모바일 요금까지 할인 받으세요.", "[LG U+] 스마트홈 IoT 패키지(CCTV) 추가 가능합니다."],
    "Sky": ["[Skylife] 알뜰한 요금! 인터넷+TV 월 20,900원(30% 할인)", "[Skylife] 약정 승계 및 사은품 최대 혜택 상담 드립니다.", "[Skylife] 30% 요금 할인 프로모션 마감 임박!"]
};

const MACRO_TABS = [
    { key: "공통", color: "bg-yellow-100 text-yellow-700 hover:bg-yellow-200", activeColor: "bg-white text-yellow-600 border-l-4 border-yellow-400" },
    { key: "KT", color: "bg-teal-100 text-teal-700 hover:bg-teal-200", activeColor: "bg-white text-teal-600 border-l-4 border-teal-400" },
    { key: "SK", color: "bg-orange-100 text-orange-700 hover:bg-orange-200", activeColor: "bg-white text-orange-600 border-l-4 border-orange-400" },
    { key: "LG", color: "bg-pink-100 text-pink-700 hover:bg-pink-200", activeColor: "bg-white text-pink-600 border-l-4 border-pink-400" },
    { key: "Sky", color: "bg-sky-100 text-sky-700 hover:bg-sky-200", activeColor: "bg-white text-sky-600 border-l-4 border-sky-400" }
];

const INITIAL_FORM_TEMPLATE = [
    {
        id: "KT", name: "KT", cost: 60,
        fields: [
            { id: "internet", label: "🌐 인터넷 속도", type: "select", options: "100M, 500M, 1G, 10G", policies: { "100M": 10, "500M": 15, "1G": 20, "10G": 25 } },
            { id: "tv", label: "📺 TV 요금제", type: "select", options: "베이직, 라이트, 에센스, 넷플릭스 결합", policies: { "베이직": 5, "라이트": 8, "에센스": 10 } },
            { id: "wifi", label: "📡 와이파이", type: "radio", options: "신청, 미신청", policies: { "신청": 2, "미신청": 0 } },
            { id: "gift", label: "🎁 사은품 메모", type: "text", options: "" }
        ]
    },
    {
        id: "SKT", name: "SKT", cost: 55,
        fields: [
            { id: "internet", label: "🌐 인터넷 상품", type: "select", options: "광랜(100M), 기가라이트(500M), 기가인터넷(1G)", policies: { "광랜(100M)": 8, "기가라이트(500M)": 14, "기가인터넷(1G)": 18 } },
            { id: "tv", label: "📺 B tv 상품", type: "select", options: "이코노미, 스탠다드, All", policies: { "이코노미": 4, "스탠다드": 7, "All": 12 } },
            { id: "mobile_combine", label: "📱 온가족 결합", type: "radio", options: "결합함, 안함" }
        ]
    },
    {
        id: "LG", name: "LG", cost: 65,
        fields: [
            { id: "internet", label: "🌐 인터넷", type: "select", options: "100M, 500M, 1G", policies: { "100M": 12, "500M": 18, "1G": 22 } },
            { id: "tv", label: "📺 U+ tv", type: "select", options: "베이직, 프리미엄, 프라임라이트", policies: { "베이직": 6, "프리미엄": 11 } },
            { id: "iot", label: "🏠 스마트홈 IoT", type: "checkbox", options: "맘카(CCTV), 도어센서, 간편버튼", policies: { "맘카(CCTV)": 5, "도어센서": 3 } }
        ]
    }
];

const INITIAL_VISIBLE_COLUMNS = {
    owner_name: true, db: true, accepted: true, installed: true, canceled: true,
    adSpend: true, acceptedRevenue: true, installedRevenue: true, netProfit: true,
    acceptRate: true, cancelRate: true, netInstallRate: true, avgMargin: true
};

const INITIAL_VISIBLE_CARDS = {
    adSpend: true, acceptedRevenue: true, installedRevenue: true, netProfit: true,
    totalDB: true, acceptedCount: true, installCount: true,
    cancelRate: true, netInstallRate: true
};

// ==================================================================================
// 2. 유틸리티 함수 & 팝업 컴포넌트
// ==================================================================================

const parseChecklist = (str) => {
    if (!str) return [];
    return str.split(',').map(s => s.trim()).filter(Boolean);
};

const formatCurrency = (num) => {
    if (!num && num !== 0) return '0';
    return parseInt(num).toLocaleString();
};

const formatCallback = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    if (y === new Date().getFullYear()) return `${m}/${d}`;
    return `${y}/${m}/${d}`;
};

const getBadgeStyle = (status) => {
    const baseStyle = "px-2 py-1 rounded-md text-xs font-bold border shadow-sm";
    switch (status) {
        case '접수완료': return `${baseStyle} bg-green-100 text-green-700 border-green-200`;
        case '설치완료': return `${baseStyle} bg-emerald-100 text-emerald-700 border-emerald-200`;
        case '해지진행': return `${baseStyle} bg-orange-100 text-orange-700 border-orange-200`;
        case '접수취소': return `${baseStyle} bg-red-100 text-red-700 border-red-200`;
        case '부재': return `${baseStyle} bg-rose-100 text-rose-700 border-rose-200`;
        case '재통': return `${baseStyle} bg-blue-100 text-blue-700 border-blue-200`;
        case '가망': return `${baseStyle} bg-amber-100 text-amber-700 border-amber-200`;
        case '장기가망': return `${baseStyle} bg-violet-100 text-violet-700 border-violet-200`;
        case 'AS요청': return `${baseStyle} bg-pink-100 text-pink-700 border-pink-200`;
        case '실패': return `${baseStyle} bg-gray-200 text-gray-500 border-gray-300`;
        default: return `${baseStyle} bg-gray-100 text-gray-600 border-gray-200`;
    }
};

const parseSmartDateOnly = (input) => {
    if (!input) return null;
    const now = new Date();
    if (input.includes('내일')) { now.setDate(now.getDate() + 1); return now.toISOString().split('T')[0]; }
    else if (input.includes('모레')) { now.setDate(now.getDate() + 2); return now.toISOString().split('T')[0]; }
    else if (input.includes('오늘')) { return now.toISOString().split('T')[0]; }
    const cleanInput = input.replace(/[^0-9]/g, '');
    if (cleanInput.length === 8) { const y = cleanInput.substring(0, 4); const m = cleanInput.substring(4, 6); const d = cleanInput.substring(6, 8); return `${y}-${m}-${d}`; }
    else if (cleanInput.length === 6) { const y = '20' + cleanInput.substring(0, 2); const m = cleanInput.substring(2, 4); const d = cleanInput.substring(4, 6); return `${y}-${m}-${d}`; }
    else if (cleanInput.length === 4) { const y = now.getFullYear(); const m = cleanInput.substring(0, 2); const d = cleanInput.substring(2, 4); return `${y}-${m}-${d}`; }
    else if (cleanInput.length === 3) { const y = now.getFullYear(); const m = '0' + cleanInput.substring(0, 1); const d = cleanInput.substring(1, 3); return `${y}-${m}-${d}`; }
    return null;
};

// 독립 윈도우 컴포넌트
const PopoutWindow = ({ title, onClose, children }) => {
    const [container, setContainer] = useState(null);
    const newWindow = useRef(null);
    useEffect(() => {
        if (!newWindow.current || newWindow.current.closed) {
            newWindow.current = window.open("", "", "width=920,height=750,left=200,top=100,menubar=no,toolbar=no,location=no,status=no");
        }
        if (newWindow.current) {
            const doc = newWindow.current.document;
            doc.title = title || "접수 완료 처리";
            const styles = document.querySelectorAll('style, link[rel="stylesheet"]');
            styles.forEach(styleNode => doc.head.appendChild(styleNode.cloneNode(true)));
            const script = doc.createElement('script');
            script.src = "https://cdn.tailwindcss.com";
            doc.head.appendChild(script);
            let div = doc.getElementById("popout-root");
            if (!div) {
                div = doc.createElement("div");
                div.id = "popout-root";
                doc.body.appendChild(div);
                doc.body.style.margin = "0";
                doc.body.style.backgroundColor = "#ffffff";
                doc.body.className = "font-sans antialiased";
            }
            setContainer(div);
            newWindow.current.onbeforeunload = () => onClose();
        } else {
            alert("팝업 차단이 설정되어 있습니다. 팝업을 허용해주세요.");
            onClose();
        }
        return () => { setTimeout(() => { if (newWindow.current) { newWindow.current.close(); newWindow.current = null; } }, 100); };
    }, []);
    return container ? ReactDOM.createPortal(children, container) : null;
};

// ==================================================================================
// 4. 메인 컴포넌트
// ==================================================================================
function AgentDashboard({ user, onLogout }) {
    // State 관리
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [chatView, setChatView] = useState('LIST');
    const [chatTarget, setChatTarget] = useState(null);
    const [chatListSearch, setChatListSearch] = useState('');
    const [chatMessages, setChatMessages] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const chatScrollRef = useRef(null);
    const [isSending, setIsSending] = useState(false);

    const [showMacroPanel, setShowMacroPanel] = useState(false);
    const [activeMacroTab, setActiveMacroTab] = useState("공통");
    const [macros, setMacros] = useState(() => {
        const saved = localStorage.getItem('agent_macros_grouped');
        return saved ? JSON.parse(saved) : DEFAULT_MACROS_GROUPED;
    });
    const [newMacroText, setNewMacroText] = useState('');

    const [chatInputNumber, setChatInputNumber] = useState('');
    const [customers, setCustomers] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('shared');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [searchTerm, setSearchTerm] = useState('');

    // 공유DB 세부 탭 State
    const [sharedSubTab, setSharedSubTab] = useState('ALL');

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

    // 정책금 계산용
    const [calculatedPolicy, setCalculatedPolicy] = useState(0);

    // 템플릿 State 추가
    const [formTemplates, setFormTemplates] = useState(INITIAL_FORM_TEMPLATE);

    // Missing States
    const [modalPosition, setModalPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

    const [memoPopupTarget, setMemoPopupTarget] = useState(null);
    const [memoPopupText, setMemoPopupText] = useState('');
    const [memoFieldType, setMemoFieldType] = useState('');

    const [pasteData, setPasteData] = useState('');
    const [parsedData, setParsedData] = useState([]);
    const [newLog, setNewLog] = useState('');

    // 개인 메모장 State
    const [notepadContent, setNotepadContent] = useState('');

    // 확인 요청 응답 모달 상태
    const [showResponseModal, setShowResponseModal] = useState(false);
    const [responseTarget, setResponseTarget] = useState(null);

    // 공지사항 및 정책 관련 상태
    const [notices, setNotices] = useState([]);
    const [policyImages, setPolicyImages] = useState({});
    const [activePolicyTab, setActivePolicyTab] = useState('KT');

    // 당일 이슈 배너 표시 여부
    const [isBannerVisible, setIsBannerVisible] = useState(true);

    // ⭐️ [신규] 통계(Report) 탭용 필터 & 커스터마이징 & 상담사 선택 State
    const [statPeriodType, setStatPeriodType] = useState('month'); // 'month' | 'week' | 'day'
    const [statDate, setStatDate] = useState(() => new Date().toISOString().substring(0, 7)); // YYYY-MM
    const [statPlatform, setStatPlatform] = useState('ALL');
    const [selectedStatAgent, setSelectedStatAgent] = useState('ALL'); // 'ALL' or user_id

    // 커스터마이징 모달
    const [showCustomModal, setShowCustomModal] = useState(false);

    // 보여줄 컬럼 및 카드 설정 (localStorage 저장)
    const [visibleColumns, setVisibleColumns] = useState(() => {
        const saved = localStorage.getItem('agent_stat_columns');
        return saved ? JSON.parse(saved) : INITIAL_VISIBLE_COLUMNS;
    });
    const [visibleCards, setVisibleCards] = useState(() => {
        const saved = localStorage.getItem('agent_stat_cards');
        return saved ? JSON.parse(saved) : INITIAL_VISIBLE_CARDS;
    });

    // ⭐️ [신규] 통계 상세 펼치기 (Set of agent IDs)
    const [expandedRows, setExpandedRows] = useState(new Set());

    const toggleRow = (id) => {
        const newSet = new Set(expandedRows);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setExpandedRows(newSet);
    };

    // ⭐️ [신규] 월별 광고비 저장소 (LocalStorage 연동)
    const [monthlyAdSpends, setMonthlyAdSpends] = useState(() => {
        const saved = localStorage.getItem('agent_monthly_ad_spends');
        return saved ? JSON.parse(saved) : {};
    });

    const memoInputRef = useRef(null);

    // 세션 스토리지 사용
    const getAuthHeaders = useCallback(() => {
        const token = sessionStorage.getItem('token');
        return { 'Content-Type': 'application/json', 'Authorization': `Token ${token}` };
    }, []);

    useEffect(() => {
        localStorage.setItem('agent_macros_grouped', JSON.stringify(macros));
    }, [macros]);

    // 커스터마이징 설정 저장
    useEffect(() => {
        localStorage.setItem('agent_stat_columns', JSON.stringify(visibleColumns));
    }, [visibleColumns]);
    useEffect(() => {
        localStorage.setItem('agent_stat_cards', JSON.stringify(visibleCards));
    }, [visibleCards]);

    // 월별 광고비 저장
    useEffect(() => {
        localStorage.setItem('agent_monthly_ad_spends', JSON.stringify(monthlyAdSpends));
    }, [monthlyAdSpends]);

    // 현재 선택된 월의 광고비 업데이트
    const handleAdSpendChange = (value) => {
        const cleanValue = value.replace(/[^0-9]/g, '');
        const currentMonthKey = statDate.substring(0, 7);
        setMonthlyAdSpends(prev => ({
            ...prev,
            [currentMonthKey]: cleanValue
        }));
    };

    // ⭐️ [수정] 중복 제거된 커스터마이징 토글 핸들러
    const handleColumnToggle = (col) => {
        setVisibleColumns(prev => ({ ...prev, [col]: !prev[col] }));
    };

    const handleCardToggle = (card) => {
        setVisibleCards(prev => ({ ...prev, [card]: !prev[card] }));
    };

    // 메모장 로드
    useEffect(() => {
        if (user) {
            const savedMemo = localStorage.getItem(`agent_memo_${user.user_id}`);
            if (savedMemo) setNotepadContent(savedMemo);
        }
    }, [user]);

    // 메모장 저장
    const handleNotepadChange = (e) => {
        const content = e.target.value;
        setNotepadContent(content);
        localStorage.setItem(`agent_memo_${user.user_id}`, content);
    };

    const autoResizeTextarea = (e) => {
        e.target.style.height = 'auto';
        e.target.style.height = e.target.scrollHeight + 'px';
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

    // 공지사항 및 정책 이미지 불러오기
    const fetchNoticesAndPolicies = useCallback(() => {
        // 공지사항
        fetch(`${API_BASE}/api/notices/`, { headers: getAuthHeaders() })
            .then(res => res.json())
            .then(data => setNotices(Array.isArray(data) ? data : []));

        // 정책 이미지
        fetch(`${API_BASE}/api/policies/latest/`, { headers: getAuthHeaders() })
            .then(res => res.json())
            .then(data => setPolicyImages(data));
    }, [getAuthHeaders]);

    useEffect(() => {
        if (user) {
            setIsLoading(true);
            fetchCustomers().finally(() => setIsLoading(false));
            fetchNoticesAndPolicies();

            const interval = setInterval(() => {
                if (!selectedCustomer && !showUploadModal && !showCompletionModal && !showReferralModal && !memoPopupTarget) {
                    fetchCustomers();
                }
            }, 60000);

            return () => clearInterval(interval);
        }
    }, [user, fetchCustomers, fetchNoticesAndPolicies, selectedCustomer, showUploadModal, showCompletionModal, showReferralModal, memoPopupTarget]);

    useEffect(() => {
        setSelectedIds([]);
        if (activeTab === 'policy') {
            fetchNoticesAndPolicies();
        }
    }, [activeTab, fetchNoticesAndPolicies]);

    useEffect(() => {
        if (memoPopupTarget && memoInputRef.current) {
            setTimeout(() => memoInputRef.current.focus(), 100);
        }
    }, [memoPopupTarget]);

    // 당일 주요 이슈 필터링
    const todayIssues = useMemo(() => {
        if (!notices || notices.length === 0) return [];
        const todayStr = new Date().toISOString().split('T')[0];
        return notices.filter(n => {
            if (!n.created_at) return false;
            return n.created_at.startsWith(todayStr);
        });
    }, [notices]);

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

    // 상담사 옵션 (ID -> Name 매핑용 + 선택용)
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
        // 기존 하단 통계 로직 (사용 안함, 유지)
        return {};
    }, []);

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

            const checklist = parseChecklist(c.checklist);
            if (!checklist.includes('알림ON')) return false;

            return new Date(c.callback_schedule).getTime() <= now;
        }).sort((a, b) => new Date(a.callback_schedule) - new Date(b.callback_schedule));
    }, [customers, user]);

    const { sharedDB, consultDB, longTermDB, salesDB } = useMemo(() => {
        const rawShared = (customers || []).filter(c => c.owner === null);
        const uniqueMap = new Map();
        rawShared.forEach(c => { if (c.phone && !uniqueMap.has(c.phone)) uniqueMap.set(c.phone, c); });
        const sharedDB = Array.from(uniqueMap.values());
        sharedDB.sort((a, b) => new Date(b.upload_date) - new Date(a.upload_date));

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

    // 메인 테이블 데이터 필터링
    const currentData = useMemo(() => {
        let data = [];
        if (activeTab === 'shared') {
            data = sharedDB;
            if (sharedSubTab !== 'ALL') {
                if (sharedSubTab === '기타') {
                    const known = ['당근', '토스', '실패DB'];
                    data = data.filter(c => !known.includes(c.platform));
                } else {
                    data = data.filter(c => c.platform === sharedSubTab);
                }
            }
        }
        else if (activeTab === 'consult') data = consultDB;
        else if (activeTab === 'long_term') data = longTermDB;
        else if (activeTab === 'sales') data = salesDB;

        if (activeTab === 'consult' && statusFilter !== 'ALL') {
            data = data.filter(c => c.status === statusFilter);
        }
        if (!data) data = [];

        data = data.filter(c => (c.name || '').includes(searchTerm) || (c.phone || '').includes(searchTerm));

        if (activeTab === 'consult' || activeTab === 'long_term') {
            data = data.sort((a, b) => {
                const aReq = a.request_status === 'REQUESTED' ? 1 : 0;
                const bReq = b.request_status === 'REQUESTED' ? 1 : 0;
                if (aReq !== bReq) return bReq - aReq;
                return 0;
            });
        }
        return data;
    }, [activeTab, sharedDB, consultDB, longTermDB, salesDB, statusFilter, searchTerm, sharedSubTab]);

    // ⭐️ [통계탭 전용 1] 상단 통합 지표 계산 (상담사 필터링 포함)
    const dashboardStats = useMemo(() => {
        if (!customers || customers.length === 0) return null;

        // 1. 기간 및 플랫폼 필터링
        let filtered = customers;

        if (statDate) {
            filtered = filtered.filter(c => {
                if (!c.upload_date) return false;
                if (statPeriodType === 'month') return c.upload_date.startsWith(statDate); // YYYY-MM
                if (statPeriodType === 'day') return c.upload_date === statDate; // YYYY-MM-DD
                return c.upload_date.startsWith(statDate.substring(0, 7));
            });
        }

        if (statPlatform !== 'ALL') {
            filtered = filtered.filter(c => c.platform === statPlatform);
        }

        // 2. 상담사 선택 필터링 (카드 데이터용)
        // 전체 DB수 파악을 위해 원본 필터링 데이터 보존
        const totalDBAllAgents = filtered.length;

        if (selectedStatAgent !== 'ALL') {
            filtered = filtered.filter(c => c.owner === parseInt(selectedStatAgent));
        }

        // 3. 통계 계산
        const totalDB = filtered.length;
        const acceptedList = filtered.filter(c => ['접수완료', '설치완료', '해지진행'].includes(c.status));
        const acceptedCount = acceptedList.length;

        const acceptRate = totalDB > 0 ? ((acceptedCount / totalDB) * 100).toFixed(1) : 0;

        const calcMargin = (list) => list.reduce((sum, c) => sum + ((parseInt(c.agent_policy || 0) || 0) - (parseInt(c.support_amt || 0) || 0)) * 10000, 0);

        const acceptedRevenue = calcMargin(acceptedList);
        const installedList = filtered.filter(c => c.status === '설치완료');
        const installedRevenue = calcMargin(installedList);
        const installCount = installedList.length;

        const cancelCount = filtered.filter(c => c.status === '접수취소').length;
        const cancelRate = (acceptedCount + cancelCount) > 0 ? ((cancelCount / (acceptedCount + cancelCount)) * 100).toFixed(1) : 0;

        const netInstallRate = acceptedCount > 0 ? ((installCount / acceptedCount) * 100).toFixed(1) : 0;
        const avgMargin = acceptedCount > 0 ? Math.round(acceptedRevenue / acceptedCount) : 0;

        // 광고비 가져오기 (월 단위)
        const currentMonthKey = statDate.substring(0, 7);
        const totalAdSpend = parseInt(monthlyAdSpends[currentMonthKey] || 0);

        // ⭐️ [신규] 상담사별 추정 광고비 계산: (전체 광고비 / 전체 DB) * 해당 상담사 DB
        let finalAdSpend = totalAdSpend;
        if (selectedStatAgent !== 'ALL') {
            finalAdSpend = totalDBAllAgents > 0 ? Math.round(totalAdSpend * (totalDB / totalDBAllAgents)) : 0;
        }

        // 순이익
        const netProfit = installedRevenue - finalAdSpend;

        return {
            totalDB,
            acceptedCount,
            acceptRate,
            acceptedRevenue,
            installedRevenue,
            installCount,
            cancelRate,
            netInstallRate,
            avgMargin,
            netProfit,
            adSpend: finalAdSpend
        };

    }, [customers, statDate, statPeriodType, statPlatform, monthlyAdSpends, selectedStatAgent]);

    // ⭐️ [통계탭 전용 2] 상담사별 통계 데이터 계산 (플랫폼별 상세 포함)
    const agentStats = useMemo(() => {
        if (!customers || customers.length === 0) return [];

        let filtered = customers;

        if (statDate) {
            filtered = filtered.filter(c => {
                if (!c.upload_date) return false;
                if (statPeriodType === 'month') return c.upload_date.startsWith(statDate);
                if (statPeriodType === 'day') return c.upload_date === statDate;
                return c.upload_date.startsWith(statDate.substring(0, 7));
            });
        }

        if (statPlatform !== 'ALL') {
            filtered = filtered.filter(c => c.platform === statPlatform);
        }

        const statsByUser = {};
        const totalDBCount = filtered.length;
        const currentMonthKey = statDate.substring(0, 7);
        const totalAdSpend = parseInt(monthlyAdSpends[currentMonthKey] || 0);

        // 초기화 헬퍼
        const getInitStats = (name, id) => ({
            id, name,
            db: 0, accepted: 0, installed: 0, canceled: 0,
            acceptedRevenue: 0, installedRevenue: 0
        });

        filtered.forEach(c => {
            const ownerId = c.owner || 'unknown';
            const platform = c.platform || '기타';

            if (!statsByUser[ownerId]) {
                const name = c.owner_name || (agentOptions.find(a => a.id === c.owner)?.name) || '미배정';
                statsByUser[ownerId] = {
                    ...getInitStats(name, ownerId),
                    platforms: {} // 플랫폼별 데이터 저장
                };
            }

            // 1. 상담사 전체 통계 누적
            const s = statsByUser[ownerId];
            s.db += 1;

            // 2. 플랫폼별 통계 초기화 및 누적
            if (!s.platforms[platform]) {
                s.platforms[platform] = getInitStats(platform, platform);
            }
            const p = s.platforms[platform];
            p.db += 1;

            const margin = ((parseInt(c.agent_policy || 0) || 0) - (parseInt(c.support_amt || 0) || 0)) * 10000;

            if (['접수완료', '설치완료', '해지진행'].includes(c.status)) {
                s.accepted += 1; s.acceptedRevenue += margin;
                p.accepted += 1; p.acceptedRevenue += margin;
            }

            if (c.status === '설치완료') {
                s.installed += 1; s.installedRevenue += margin;
                p.installed += 1; p.installedRevenue += margin;
            }

            if (c.status === '접수취소') {
                s.canceled += 1;
                p.canceled += 1;
            }
        });

        // 3. 지표 계산 및 배열 변환
        return Object.values(statsByUser).map(s => {
            // 상담사 전체 광고비 배분
            const adSpend = totalDBCount > 0 ? Math.round(totalAdSpend * (s.db / totalDBCount)) : 0;
            const netProfit = s.installedRevenue - adSpend;

            const acceptRate = s.db > 0 ? ((s.accepted / s.db) * 100).toFixed(1) : 0;
            const cancelRate = (s.accepted + s.canceled) > 0 ? ((s.canceled / (s.accepted + s.canceled)) * 100).toFixed(1) : 0;
            const netInstallRate = s.accepted > 0 ? ((s.installed / s.accepted) * 100).toFixed(1) : 0;
            const avgMargin = s.accepted > 0 ? Math.round(s.acceptedRevenue / s.accepted) : 0;

            // 플랫폼별 통계 계산
            const platformDetails = Object.values(s.platforms).map(p => {
                // 플랫폼별 광고비 배분 (상담사 할당 광고비 내에서 DB 비중으로 재배분)
                const pAdSpend = s.db > 0 ? Math.round(adSpend * (p.db / s.db)) : 0;
                const pNetProfit = p.installedRevenue - pAdSpend;

                const pAcceptRate = p.db > 0 ? ((p.accepted / p.db) * 100).toFixed(1) : 0;
                const pCancelRate = (p.accepted + p.canceled) > 0 ? ((p.canceled / (p.accepted + p.canceled)) * 100).toFixed(1) : 0;
                const pNetInstallRate = p.accepted > 0 ? ((p.installed / p.accepted) * 100).toFixed(1) : 0;
                const pAvgMargin = p.accepted > 0 ? Math.round(p.acceptedRevenue / p.accepted) : 0;

                return {
                    ...p,
                    adSpend: pAdSpend,
                    netProfit: pNetProfit,
                    acceptRate: pAcceptRate,
                    cancelRate: pCancelRate,
                    netInstallRate: pNetInstallRate,
                    avgMargin: pAvgMargin
                };
            }).sort((a, b) => b.db - a.db); // DB 많은 순 정렬

            return {
                ...s,
                adSpend,
                netProfit,
                acceptRate,
                cancelRate,
                netInstallRate,
                avgMargin,
                platformDetails // 하위 배열로 포함
            };
        }).sort((a, b) => b.netProfit - a.netProfit);

    }, [customers, statDate, statPeriodType, statPlatform, monthlyAdSpends, agentOptions]);

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

    const handleOpenChat = (e, customer) => {
        e.stopPropagation();
        e.preventDefault();
        setChatTarget(customer);
        setChatView('ROOM');
        setChatMessages([]);
        setIsChatOpen(true);
    };

    const handleSendManualChat = async (textToSend = null) => {
        const messageToSend = textToSend || chatInput;
        if (!messageToSend?.trim() || !chatTarget) return;

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
                if (!textToSend) setChatInput('');

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

    const handleToggleAlarm = (e, customer) => {
        e.stopPropagation();
        const currentList = parseChecklist(customer.checklist);
        const isAlarmOn = currentList.includes('알림ON');
        let newList;

        if (isAlarmOn) {
            newList = currentList.filter(item => item !== '알림ON');
        } else {
            newList = [...currentList, '알림ON'];
        }

        const newStr = newList.join(',');

        setCustomers(prev => prev.map(c => c.id === customer.id ? { ...c, checklist: newStr } : c));

        fetch(`${API_BASE}/api/customers/${customer.id}/`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify({ checklist: newStr })
        });
    };

    const handleAssign = (id) => {
        if (!window.confirm("담당하시겠습니까?")) return;
        fetch(`${API_BASE}/api/customers/${id}/assign/`, {
            method: 'POST', headers: getAuthHeaders(),
            body: JSON.stringify({ user_id: user.user_id })
        }).then(() => { alert("배정 완료!"); fetchCustomers(); setActiveTab('consult'); });
    };

    const handleBulkAssign = () => {
        if (selectedIds.length === 0) return alert("선택된 항목이 없습니다.");
        if (!window.confirm(`선택한 ${selectedIds.length}건을 내 담당으로 가져오시겠습니까?`)) return;
        fetch(`${API_BASE}/api/customers/allocate/`, {
            method: 'POST', headers: getAuthHeaders(),
            body: JSON.stringify({ customer_ids: selectedIds, agent_id: user.user_id })
        }).then(res => res.json()).then(data => { alert(data.message); setSelectedIds([]); fetchCustomers(); setActiveTab('consult'); });
    };

    const handleSelectAll = (e) => { if (e.target.checked) setSelectedIds(currentData.map(c => c.id)); else setSelectedIds([]); };
    const handleCheck = (id) => { if (selectedIds.includes(id)) setSelectedIds(selectedIds.filter(sid => sid !== id)); else setSelectedIds([...selectedIds, id]); };

    const handleStatusChangeRequest = async (id, newStatus) => {
        if (newStatus === '접수완료') {
            const target = customers.find(c => c.id === id);
            setCompletionTarget(target);
            setSelectedPlatform(target.platform || 'KT');
            setDynamicFormData({});
            setCalculatedPolicy(0);
            setModalPosition({ x: window.innerWidth / 2 - 450, y: window.innerHeight / 2 - 300 });
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

    const handleFormDataChange = (key, value, optionPolicies = null) => {
        const newData = { ...dynamicFormData, [key]: value };
        setDynamicFormData(newData);
        if (optionPolicies && optionPolicies[value]) {
            let totalPolicy = 0;
            const template = formTemplates.find(t => t.name === selectedPlatform || t.id === selectedPlatform);
            if (template && template.fields) {
                template.fields.forEach(field => {
                    const selectedVal = (field.id === key) ? value : newData[field.id];
                    if (selectedVal && field.policies && field.policies[selectedVal]) {
                        totalPolicy += field.policies[selectedVal];
                    }
                });
            }
            setCalculatedPolicy(totalPolicy);
        }
    };

    const handleConfirmCompletion = () => {
        if (!completionTarget) return;

        const template = formTemplates.find(t => t.name === selectedPlatform || t.id === selectedPlatform);
        const fields = template ? template.fields : [];

        const infoString = fields.map(field => {
            const val = dynamicFormData[field.id];
            if (field.type === 'checkbox' && !val) return null;
            if (!val) return null;
            return `${field.label}: ${val}`;
        }).filter(Boolean).join(' / ');

        const finalProductInfo = `[${selectedPlatform}] ${infoString}`;

        const payload = {
            status: '접수완료',
            platform: selectedPlatform,
            product_info: finalProductInfo,
            agent_policy: calculatedPolicy,
            installed_date: null
        };

        fetch(`${API_BASE}/api/customers/${completionTarget.id}/`, {
            method: 'PATCH', headers: getAuthHeaders(), body: JSON.stringify(payload)
        }).then(() => {
            const logContent = `[시스템 자동접수]\n통신사: ${selectedPlatform}\n상품내역: ${infoString}\n예상 정책금: ${calculatedPolicy}만원`;
            return fetch(`${API_BASE}/api/customers/${completionTarget.id}/add_log/`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    user_id: user.user_id,
                    content: logContent
                })
            });
        }).then(() => {
            alert("🎉 접수가 완료되었습니다!\n(정책금 및 상담이력이 자동 저장되었습니다)");
            setShowCompletionModal(false);
            setCompletionTarget(null);
            fetchCustomers();
            setActiveTab('sales');
        }).catch(err => alert("오류 발생: " + err));
    };

    const handleCallbackChange = (customer, type, val) => {
        let current = customer.callback_schedule ? new Date(customer.callback_schedule) : new Date();
        if (isNaN(current.getTime())) {
            current = new Date();
            current.setHours(9, 0, 0, 0);
        }

        let y = current.getFullYear();
        let m = current.getMonth() + 1;
        let d = current.getDate();
        let h = current.getHours();

        if (type === 'year') y = parseInt(val) || y;
        if (type === 'month') m = parseInt(val) || m;
        if (type === 'day') d = parseInt(val) || d;
        if (type === 'hour') h = parseInt(val) || h;

        const newDate = new Date(y, m - 1, d, h);
        const yy = newDate.getFullYear();
        const mm = String(newDate.getMonth() + 1).padStart(2, '0');
        const dd = String(newDate.getDate()).padStart(2, '0');
        const hh = String(newDate.getHours()).padStart(2, '0');

        const newDateStr = `${yy}-${mm}-${dd}T${hh}:00:00`;

        handleInlineUpdate(customer.id, 'callback_schedule', newDateStr);

        const today = new Date();
        const diffTime = newDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays > 30 && customer.status !== '장기가망') {
            if (window.confirm("📅 30일 이후 일정입니다.\n'가망관리(장기)' 탭으로 이동시킬까요?")) {
                handleInlineUpdate(customer.id, 'status', '장기가망');
            }
        }
    };

    const handleDateInputBlur = (id, field, value) => {
        const isoDate = parseSmartDateOnly(value);
        if (isoDate) {
            let currentSchedule = customers.find(c => c.id === id)?.callback_schedule ? new Date(customers.find(c => c.id === id).callback_schedule) : new Date();
            const timePart = currentSchedule.toTimeString().split(' ')[0];
            const newDateStr = `${isoDate}T${timePart}`;
            handleInlineUpdate(id, field, newDateStr);
        }
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
            {[1, 2, 3, 4, 5].map(star => (<span key={star} className={`text-lg ${star <= currentRank ? 'text-yellow-400' : 'text-gray-300'} hover:scale-125 transition`} onClick={() => handleInlineUpdate(id, 'rank', star)}>★</span>))}
        </div>
    );

    const handleAddMacro = () => {
        if (!newMacroText.trim()) return;
        const currentList = macros[activeMacroTab] || [];
        setMacros({
            ...macros,
            [activeMacroTab]: [...currentList, newMacroText]
        });
        setNewMacroText('');
    };

    const handleDeleteMacro = (tab, index) => {
        const currentList = macros[tab];
        const newList = currentList.filter((_, i) => i !== index);
        setMacros({
            ...macros,
            [tab]: newList
        });
    };

    const handleSelectMacro = (text) => {
        setChatInput(text);
        // setShowMacroPanel(false); 
    };

    const handleInstantSend = (e, text) => {
        e.stopPropagation();
        if (window.confirm("이 문구를 즉시 전송하시겠습니까?")) {
            handleSendManualChat(text);
        }
    };

    // 확인 요청 모달 열기 핸들러
    const openResponseModal = (customer) => {
        setResponseTarget(customer);
        setShowResponseModal(true);
    };

    // 요청에 대한 응답 처리 ('처리중' / '처리완료')
    const handleResponse = (status) => {
        if (!responseTarget) return;

        // 1. 낙관적 업데이트
        setCustomers(prev => prev.map(c => c.id === responseTarget.id ? { ...c, request_status: status } : c));

        // 2. 서버 전송
        fetch(`${API_BASE}/api/customers/${responseTarget.id}/`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify({ request_status: status })
        }).then(() => {
            alert("상태가 변경되었습니다.");
            setShowResponseModal(false);
            setResponseTarget(null);
        });
    };

    // ==================================================================================
    // 8. Render
    // ==================================================================================
    return (
        <div className="min-h-screen bg-slate-50 text-gray-800 p-5 font-sans relative" onClick={() => setShowNotiDropdown(false)}>

            {/* 1. 스타일 태그 (스핀박스 제거용) */}
            <style>
                {`
                /* 숫자 입력칸 화살표 제거 */
                .no-spin::-webkit-inner-spin-button, 
                .no-spin::-webkit-outer-spin-button { 
                    -webkit-appearance: none; 
                    margin: 0; 
                }
                .no-spin {
                    -moz-appearance: textfield;
                }
                
                /* 스크롤바 숨기기 (선택사항) */
                .no-scrollbar::-webkit-scrollbar {
                    display: none;
                }
                .no-scrollbar {
                    -ms-overflow-style: none; 
                    scrollbar-width: none; 
                }

                /* 🔥 붉은색 테두리 깜빡임 애니메이션 (당일 이슈 강조용) */
                @keyframes pulse-border {
                    0% { border-color: #ef4444; box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
                    70% { border-color: #f87171; box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); }
                    100% { border-color: #ef4444; box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
                }
                .animate-pulse-slow {
                    animation: pulse-border 3s infinite;
                }
            `}
            </style>

            {/* 헤더 & 탭바 (생략하지 않고 전체 포함) */}
            {isLoading && (<div className="fixed inset-0 bg-white/70 z-[100] flex justify-center items-center backdrop-blur-[1px]"><div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-indigo-400"></div></div>)}

            <header className="sticky top-0 z-40 flex justify-between items-center bg-white p-4 rounded-xl shadow-sm mb-6 border border-gray-200">
                <h1 className="text-xl font-extrabold text-indigo-900 flex items-center gap-2 tracking-tight">📞 {user.username}님의 워크스페이스</h1>
                <div className="flex items-center gap-6">
                    <button onClick={() => setIsChatOpen(!isChatOpen)} className={`text-2xl p-2 rounded-full transition-all shadow-sm ${isChatOpen ? 'bg-indigo-100 text-indigo-600 scale-110 ring-2 ring-indigo-200' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`} title="실시간 문자 채팅">💬</button>
                    <button onClick={handleTestConnection} className="text-xs font-bold px-4 py-2 rounded-lg border transition-all bg-indigo-50 border-indigo-200 text-indigo-600 hover:bg-indigo-100 hover:shadow-md">📶 연결 테스트</button>
                    <div className="relative cursor-pointer" onClick={(e) => { e.stopPropagation(); setShowNotiDropdown(!showNotiDropdown); }}>
                        <span className="text-2xl text-gray-400 hover:text-yellow-500 transition">🔔</span>
                        {notifications.length > 0 && <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-bounce shadow-sm">{notifications.length}</span>}
                        {showNotiDropdown && (
                            <div className="absolute right-0 top-10 w-80 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden z-50">
                                <div className="bg-indigo-50 p-3 border-b border-gray-200 font-bold flex justify-between text-indigo-900"><span>⏰ 재통화 알림 ({notifications.length})</span><button className="text-xs text-gray-400 hover:text-gray-600" onClick={() => setShowNotiDropdown(false)}>닫기</button></div>
                                <div className="max-h-60 overflow-y-auto">{notifications.length === 0 ? <div className="p-4 text-center text-gray-400 text-sm">예정된 통화가 없습니다.</div> : notifications.map(n => (<div key={n.id} onClick={() => openHistoryModal(n)} className="p-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer flex justify-between items-center"><div><div className="font-bold text-sm text-gray-800">{n.name}</div><div className="text-xs text-gray-500">{n.phone}</div></div><div className="text-right"><span className={`text-[10px] ${getBadgeStyle(n.status)}`}>{n.status}</span><div className="text-xs text-gray-400 mt-1">{formatCallback(n.callback_schedule)}</div></div></div>))}</div>
                            </div>
                        )}
                    </div>
                    <div className="flex gap-2">
                        {user.role === 'ADMIN' ? (
                            <button onClick={() => setShowUploadModal(true)} className="bg-violet-500 hover:bg-violet-600 text-white px-4 py-2 rounded-lg font-bold transition shadow-sm">📤 DB 대량 등록</button>
                        ) : (
                            <button onClick={() => setShowReferralModal(true)} className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold transition flex items-center gap-2 shadow-sm">🤝 소개/지인 등록</button>
                        )}
                        <button onClick={onLogout} className="bg-slate-400 hover:bg-slate-500 text-white px-4 py-2 rounded-lg font-bold transition shadow-sm">로그아웃</button>
                    </div>
                </div>
            </header>

            {/* 🔥 당일 주요 이슈 배너 (오늘 올라온 공지가 있을 때만 표시) */}
            {isBannerVisible && todayIssues.length > 0 && (
                <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-r-xl shadow-md animate-pulse-slow flex items-start gap-4">
                    <div className="flex-shrink-0 flex items-center gap-2">
                        <span className="bg-red-600 text-white text-xs font-black px-2 py-1 rounded uppercase tracking-wider animate-pulse">
                            🔥 TODAY ISSUES
                        </span>
                        <span className="text-red-600 font-bold text-sm">
                            오늘의 주요 이슈가 {todayIssues.length}건 있습니다!
                        </span>
                    </div>
                    <div className="flex-1 flex flex-col gap-1">
                        {todayIssues.map((issue, idx) => (
                            <div key={issue.id} className="flex items-center gap-2 text-sm text-gray-800">
                                <span className="text-red-400 font-bold">[{idx + 1}]</span>
                                <span
                                    className="font-bold cursor-pointer hover:underline hover:text-indigo-600"
                                    onClick={() => setActiveTab('policy')}
                                >
                                    {issue.title}
                                </span>
                                {issue.is_important && <span className="text-[10px] bg-red-100 text-red-600 px-1 rounded font-bold">필독</span>}
                            </div>
                        ))}
                    </div>
                    <button
                        onClick={() => setIsBannerVisible(false)}
                        className="text-gray-400 hover:text-gray-600 text-xs underline whitespace-nowrap"
                    >
                        닫기
                    </button>
                </div>
            )}

            <div className="sticky top-[80px] z-30 bg-slate-50 pb-1 flex justify-between items-end mb-4 border-b border-gray-200">
                <div className="flex gap-2">
                    {['shared', 'consult', 'long_term', 'sales', 'report', 'policy', 'notepad'].map(tab => (
                        <button key={tab} onClick={() => { setActiveTab(tab); setStatusFilter('ALL'); }} className={`px-6 py-3 rounded-t-xl font-bold transition duration-200 border-t border-l border-r ${activeTab === tab ? 'bg-white text-indigo-600 border-gray-200 border-b-white translate-y-[1px]' : 'bg-gray-100 text-gray-400 border-transparent hover:bg-gray-200'}`}>
                            {tab === 'shared' && `🛒 공유DB (${sharedDB.length})`}
                            {tab === 'consult' && `📞 상담관리 (${consultDB.length})`}
                            {tab === 'long_term' && `📅 가망관리 (${longTermDB.length})`}
                            {tab === 'sales' && `💰 접수관리 (${salesDB.length})`}
                            {tab === 'report' && `📊 통계`}
                            {tab === 'policy' && `📢 정책/공지`}
                            {tab === 'notepad' && `📝 개인 메모장`}
                        </button>
                    ))}
                </div>
                {/* 검색창: 리포트, 메모장, 정책 탭에서는 숨김 */}
                {activeTab !== 'report' && activeTab !== 'notepad' && activeTab !== 'policy' && <input className="bg-white border border-gray-300 rounded-full px-4 py-2 text-gray-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition shadow-sm" placeholder="🔍 이름/번호 검색..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />}
            </div>

            {/* ⭐️ [정책/공지] 탭 콘텐츠 */}
            {activeTab === 'policy' && (
                <div className="flex gap-6 h-[750px] animate-fade-in">
                    {/* 왼쪽: 공지사항 리스트 */}
                    <div className="w-1/3 flex flex-col h-full bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                        <h3 className="text-lg font-bold mb-4 text-indigo-900 border-b border-gray-100 pb-3">📢 공지사항</h3>
                        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3">
                            {notices.map(n => (
                                <div key={n.id} className={`p-4 rounded-xl border ${n.is_important ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200 hover:border-indigo-200'}`}>
                                    <div className="flex items-center gap-2 mb-1">
                                        {n.is_important && <span className="text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded font-bold">중요</span>}
                                        <span className="font-bold text-sm text-gray-800">{n.title}</span>
                                    </div>
                                    <p className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed">{n.content}</p>
                                    <div className="text-[10px] text-gray-400 mt-2 text-right">{n.created_at} · {n.writer_name}</div>
                                </div>
                            ))}
                            {notices.length === 0 && <div className="text-center text-gray-400 text-sm mt-10">등록된 공지사항이 없습니다.</div>}
                        </div>
                    </div>

                    {/* 오른쪽: 정책 이미지 뷰어 */}
                    <div className="flex-1 flex flex-col h-full bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="bg-gray-50 p-4 border-b border-gray-200 flex justify-between items-center">
                            <div className="flex gap-2">
                                {POLICY_TABS.map(p => (
                                    <button key={p} onClick={() => setActivePolicyTab(p)} className={`px-5 py-2 rounded-lg font-bold text-sm transition ${activePolicyTab === p ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-gray-500 border border-gray-300 hover:bg-gray-100'}`}>{p} 정책</button>
                                ))}
                            </div>
                        </div>
                        <div className="flex-1 bg-slate-100 p-6 flex justify-center items-center overflow-auto">
                            {policyImages[activePolicyTab] ? (
                                <img src={policyImages[activePolicyTab]} alt={`${activePolicyTab} 정책`} className="max-w-full max-h-full rounded-lg shadow-lg border border-gray-200 object-contain" />
                            ) : (
                                <div className="text-gray-400 text-center">
                                    <p className="text-4xl mb-2">🖼️</p>
                                    <p>현재 등록된 정책 이미지가 없습니다.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ⭐️ [개인 메모장] 탭 콘텐츠 */}
            {activeTab === 'notepad' && (
                <div className="h-[750px] bg-white rounded-xl shadow-lg border border-gray-200 p-6 animate-fade-in flex flex-col">
                    <h2 className="text-xl font-bold mb-4 text-indigo-900 flex items-center gap-2">📝 나만의 업무 노트 <span className="text-xs font-normal text-gray-400">(자동 저장됨)</span></h2>
                    <textarea
                        className="flex-1 w-full bg-yellow-50 p-6 rounded-xl border border-yellow-200 text-gray-800 leading-relaxed resize-none outline-none focus:ring-2 focus:ring-yellow-400 focus:bg-white transition text-base shadow-inner"
                        value={notepadContent}
                        onChange={handleNotepadChange}
                        placeholder="통화 중 필요한 메모나 할 일을 자유롭게 적어두세요..."
                    />
                </div>
            )}

            {/* 공유DB 세부 탭 */}
            {activeTab === 'shared' && (
                <div className="flex gap-2 mb-4 animate-fade-in-down">
                    {SHARED_SUB_TABS.map(subTab => (
                        <button
                            key={subTab.id}
                            onClick={() => setSharedSubTab(subTab.id)}
                            className={`px-4 py-1.5 rounded-full text-xs font-bold transition border ${sharedSubTab === subTab.id ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-gray-500 border-gray-200 hover:border-indigo-300 hover:text-indigo-500'}`}
                        >
                            {subTab.label}
                        </button>
                    ))}
                </div>
            )}

            {/* 기존 하단 배너는 이제 상단 고정 대시보드로 대체되었으므로, 공유DB의 일괄 할당 버튼만 남김 */}
            {activeTab === 'shared' && selectedIds.length > 0 && (
                <div className="bg-white border-l-4 border-indigo-400 p-4 mb-4 rounded-r-lg shadow-sm flex items-center justify-between text-sm animate-fade-in-down">
                    <span className="font-bold text-gray-500">✅ {selectedIds.length}건이 선택되었습니다.</span>
                    <button onClick={handleBulkAssign} className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-lg font-bold transition flex items-center gap-2 shadow-md hover:shadow-lg transform hover:-translate-y-0.5">⚡ 일괄 가져오기</button>
                </div>
            )}

            {activeTab === 'consult' && (<div className="flex gap-2 mb-4">{QUICK_FILTERS.map(filter => (<button key={filter} onClick={() => setStatusFilter(filter)} className={`px-4 py-2 rounded-full font-bold text-sm transition border ${statusFilter === filter ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-gray-500 border-gray-200 hover:border-indigo-300 hover:text-indigo-500'}`}>{filter === 'ALL' ? '전체 보기' : filter}</button>))}<div className="ml-auto text-xs text-gray-400 flex items-center">ℹ️ 재통화 일정 순으로 자동 정렬됩니다.</div></div>)}
            {activeTab === 'long_term' && (<div className="bg-purple-50 border border-purple-200 p-3 rounded-lg mb-4 text-purple-700 text-sm flex items-center gap-2 shadow-sm">💡 <strong>장기 리드 보관함:</strong> 재통화 일정이 30일 이상 남은 건들이 자동으로 이곳에 보관됩니다.</div>)}

            {/* ⭐️ 메인 테이블/통계 영역 */}
            {activeTab !== 'policy' && activeTab !== 'notepad' && (
                <div className="bg-white rounded-xl shadow-lg min-h-[600px] border border-gray-200 overflow-hidden flex flex-col">
                    {activeTab !== 'report' ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse table-fixed">
                                <thead>
                                    <tr className="bg-yellow-100 text-gray-700 border-b border-yellow-200 text-sm font-bold">
                                        {activeTab === 'shared' && <><th className="p-3 w-12 text-center"><input type="checkbox" className="accent-indigo-500" onChange={handleSelectAll} checked={currentData.length > 0 && selectedIds.length === currentData.length} /></th><th className="p-3 w-28">등록일</th><th className="p-3 w-24">플랫폼</th><th className="p-3 w-24">이름</th><th className="p-3 w-36">전화번호</th><th className="p-3">메모</th><th className="p-3 w-24">상태</th><th className="p-3 w-24">관리</th></>}
                                        {(activeTab === 'consult' || activeTab === 'long_term') && <>
                                            <th className="p-3 w-16 text-center border-r border-yellow-200">번호</th>
                                            <th className="p-3 w-24 text-center border-r border-yellow-200">플랫폼</th>
                                            <th className="p-3 w-28 text-center border-r border-yellow-200">상담일</th>
                                            <th className="p-3 w-28 border-r border-yellow-200">이름</th>
                                            <th className="p-3 w-40 border-r border-yellow-200">휴대폰번호</th>
                                            <th className="p-3 w-56 text-indigo-700 border-r border-yellow-200">재통화날짜</th>
                                            <th className="p-3 w-24 text-center border-r border-yellow-200">확인요청</th>
                                            <th className="p-3 w-28 text-indigo-700 border-r border-yellow-200">상담값</th>
                                            <th className="p-3 text-center">상담 내용(메모)</th>
                                        </>}
                                        {activeTab === 'sales' && <><th className="p-3 w-20">플랫폼</th><th className="p-3 w-28">접수일</th><th className="p-3 w-32">설치일</th><th className="p-3 w-24">이름</th><th className="p-3 w-36">번호</th><th className="p-3 w-20">정책금</th><th className="p-3 w-20">지원금</th><th className="p-3 w-28">순수익</th><th className="p-3 w-24">상태</th><th className="p-3">후처리(메모)</th><th className="p-3 w-16 text-center">확인</th></>}
                                        <th className="p-3 w-16 text-red-400 text-center">비고</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm text-gray-700">
                                    {(currentData || []).map((c, index) => {
                                        const isDup = (activeTab === 'shared') ? duplicateSet.has(c.phone ? c.phone.trim() : '') : false;
                                        const hasPostProcessIssue = c.additional_info && c.additional_info.trim().length > 0;
                                        const checklistItems = parseChecklist(c.checklist);
                                        const isPostProcessDone = checklistItems.includes('후처리완료');
                                        const isAlarmOn = checklistItems.includes('알림ON');
                                        const isUrgent = hasPostProcessIssue && !isPostProcessDone;
                                        const isRequested = c.request_status === 'REQUESTED';
                                        const rowBg = isRequested ? 'bg-red-50 border-l-4 border-red-500' : (index % 2 === 0 ? 'bg-white' : 'bg-gray-50');

                                        const scheduleDate = c.callback_schedule ? new Date(c.callback_schedule) : new Date();
                                        const currentY = isNaN(scheduleDate.getTime()) ? '' : scheduleDate.getFullYear();
                                        const currentM = isNaN(scheduleDate.getTime()) ? '' : scheduleDate.getMonth() + 1;
                                        const currentD = isNaN(scheduleDate.getTime()) ? '' : scheduleDate.getDate();
                                        const currentH = isNaN(scheduleDate.getTime()) ? '' : scheduleDate.getHours();

                                        return (
                                            <tr key={c.id} onClick={() => (activeTab === 'consult' || activeTab === 'long_term') ? openHistoryModal(c) : null}
                                                className={`border-b border-gray-100 transition hover:bg-yellow-50 
                                                            ${rowBg}
                                                            ${(activeTab === 'consult' || activeTab === 'long_term') ? 'cursor-pointer' : ''}
                                                            ${isDup ? 'bg-red-50 hover:bg-red-100' : ''}
                                                            ${activeTab === 'sales' && isUrgent ? 'bg-red-50 border-l-4 border-red-400' : ''}
                                                        `}
                                            >
                                                {/* 테이블 내용 생략 (기존과 동일) */}
                                                {activeTab === 'shared' && <>
                                                    <td className="p-3 text-center"><input type="checkbox" className="accent-indigo-500" checked={selectedIds.includes(c.id)} onChange={() => handleCheck(c.id)} onClick={(e) => e.stopPropagation()} /></td>
                                                    <td className="p-3 text-gray-500">{c.upload_date}</td><td className="p-3"><span className="bg-white text-gray-600 px-2 py-1 rounded text-xs border border-gray-200 shadow-sm">{c.platform}</span></td><td className="p-3 font-bold text-gray-800">{c.name}</td>
                                                    <td className="p-3 border-r border-gray-100">
                                                        <div className="flex flex-col">
                                                            <span className="text-gray-600 font-mono mb-1">{c.phone}</span>
                                                            <button
                                                                onClick={(e) => handleOpenChat(e, c)}
                                                                className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] rounded hover:bg-indigo-200 transition font-bold border border-indigo-200 flex items-center justify-center gap-1 w-full"
                                                                title="내부 채팅방 열기"
                                                            >
                                                                💬 SMS
                                                            </button>
                                                        </div>
                                                    </td>
                                                    <td className="p-3" onClick={(e) => e.stopPropagation()}>
                                                        <textarea
                                                            className="w-full bg-transparent border border-transparent hover:border-gray-300 focus:border-indigo-500 rounded p-1 outline-none text-gray-600 text-sm transition placeholder-gray-300 resize-none overflow-hidden leading-relaxed"
                                                            rows={1}
                                                            style={{ minHeight: '1.5rem', height: 'auto' }}
                                                            defaultValue={c.last_memo}
                                                            onInput={autoResizeTextarea}
                                                            onBlur={(e) => handleInlineUpdate(c.id, 'last_memo', e.target.value)}
                                                            placeholder="내용 입력..."
                                                        />
                                                    </td>
                                                    <td className="p-3"><span className={getBadgeStyle(c.status)}>{c.status}</span></td><td className="p-3"><button onClick={(e) => { e.stopPropagation(); handleAssign(c.id) }} className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1 rounded text-xs shadow-sm">⚡ 가져가기</button></td>
                                                </>}
                                                {/* 나머지 탭 로직... (생략하지 않고 위 코드 참조해서 넣음) */}
                                                {(activeTab === 'consult' || activeTab === 'long_term') && <>
                                                    <td className="p-3 text-center text-gray-400 border-r border-gray-100">
                                                        {c.id}
                                                        {isRequested && <span className="block text-[10px] bg-red-500 text-white px-1 rounded mt-1">확인</span>}
                                                    </td>
                                                    <td className="p-3 text-center border-r border-gray-100"><span className="bg-white text-gray-600 px-2 py-1 rounded text-xs border border-gray-200 shadow-sm">{c.platform || '-'}</span></td>
                                                    <td className="p-3 text-center text-gray-500 border-r border-gray-100">{c.upload_date}</td>
                                                    <td className="p-3 font-bold text-gray-800 border-r border-gray-100">
                                                        <div className="flex items-center gap-2">
                                                            {c.name}
                                                            <button
                                                                onClick={(e) => handleToggleAlarm(e, c)}
                                                                className={`text-sm transition-transform active:scale-95 ${isAlarmOn ? 'opacity-100' : 'opacity-30 hover:opacity-70'}`}
                                                                title={isAlarmOn ? "알림 켜짐 (클릭시 끔)" : "알림 꺼짐 (클릭시 켬)"}
                                                            >
                                                                {isAlarmOn ? '🔔' : '🔕'}
                                                            </button>
                                                        </div>
                                                        <div className="mt-1">{renderInteractiveStars(c.id, c.rank)}</div>
                                                    </td>
                                                    <td className="p-3 border-r border-gray-100">
                                                        <div className="flex flex-col">
                                                            <span className="text-gray-600 font-mono mb-1">{c.phone}</span>
                                                            <button
                                                                onClick={(e) => handleOpenChat(e, c)}
                                                                className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] rounded hover:bg-indigo-200 transition font-bold border border-indigo-200 flex items-center justify-center gap-1 w-full"
                                                                title="내부 채팅방 열기"
                                                            >
                                                                💬 SMS
                                                            </button>
                                                        </div>
                                                    </td>
                                                    <td className="p-3 border-r border-gray-100" onClick={(e) => e.stopPropagation()}>
                                                        <div className="flex flex-col gap-1">
                                                            <div className="flex items-center justify-center gap-1">
                                                                <input type="text" className="w-9 text-center bg-transparent border-b border-gray-300 focus:border-indigo-500 outline-none text-xs font-mono" placeholder="YYYY" defaultValue={currentY} onBlur={(e) => handleCallbackChange(c, 'year', e.target.value)} />
                                                                <span className="text-gray-300 text-[10px]">-</span>
                                                                <input type="text" className="w-5 text-center bg-transparent border-b border-gray-300 focus:border-indigo-500 outline-none text-xs font-mono" placeholder="MM" defaultValue={currentM} onBlur={(e) => handleCallbackChange(c, 'month', e.target.value)} />
                                                                <span className="text-gray-300 text-[10px]">-</span>
                                                                <input type="text" className="w-5 text-center bg-transparent border-b border-gray-300 focus:border-indigo-500 outline-none text-xs font-mono" placeholder="DD" defaultValue={currentD} onBlur={(e) => handleCallbackChange(c, 'day', e.target.value)} />
                                                            </div>
                                                            <select className={`w-full bg-gray-50 border border-gray-200 rounded p-1 text-xs outline-none focus:border-indigo-500 transition cursor-pointer text-center ${c.callback_schedule ? 'text-indigo-600 font-bold' : 'text-gray-400'}`} value={currentH || ""} onChange={(e) => handleCallbackChange(c, 'hour', e.target.value)}>
                                                                <option value="" disabled>시간 선택</option>
                                                                {TIME_OPTIONS.map(h => <option key={h} value={h}>{h}시</option>)}
                                                            </select>
                                                        </div>
                                                    </td>
                                                    <td className="p-3 text-center border-r border-gray-100" onClick={(e) => e.stopPropagation()}>
                                                        {c.request_status === 'REQUESTED' ? (
                                                            <button
                                                                onClick={() => openResponseModal(c)}
                                                                className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full text-xs font-bold animate-pulse hover:bg-yellow-200 transition shadow-sm"
                                                                title="관리자 확인 요청 도착!"
                                                            >
                                                                🔔 확인요청
                                                            </button>
                                                        ) : c.request_status === 'PROCESSING' ? (
                                                            <button
                                                                onClick={() => openResponseModal(c)}
                                                                className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs font-bold hover:bg-blue-200 transition"
                                                            >
                                                                🚧 처리중
                                                            </button>
                                                        ) : c.request_status === 'COMPLETED' ? (
                                                            <span className="text-green-600 text-xs font-bold">✅ 완료</span>
                                                        ) : (
                                                            <span className="text-gray-300 text-xs">-</span>
                                                        )}
                                                    </td>
                                                    <td className="p-3 border-r border-gray-100" onClick={(e) => e.stopPropagation()}><div className="relative"><select className={`w-full p-2 rounded-md text-xs font-bold cursor-pointer outline-none transition appearance-none text-center ${getBadgeStyle(c.status)}`} value={c.status} onChange={(e) => handleStatusChangeRequest(c.id, e.target.value)}>{STATUS_OPTIONS.map(opt => <option key={opt} value={opt} className="bg-white text-gray-800">{opt}</option>)}</select></div></td>
                                                    <td className="p-3" onClick={(e) => e.stopPropagation()}>
                                                        <textarea className="w-full bg-transparent border border-transparent hover:border-gray-300 focus:border-indigo-500 rounded p-1 outline-none text-gray-700 text-sm transition placeholder-gray-300 resize-none overflow-hidden leading-relaxed" rows={1} style={{ minHeight: '1.5rem', height: 'auto' }} defaultValue={c.last_memo} onInput={autoResizeTextarea} onBlur={(e) => handleInlineUpdate(c.id, 'last_memo', e.target.value)} placeholder="상담 내용 입력..." />
                                                    </td>
                                                </>}
                                                {activeTab === 'sales' && <>
                                                    <td className="p-3"><span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs border border-gray-200">{c.platform || '-'}</span></td>
                                                    <td className="p-3 text-gray-500">{c.upload_date}</td>
                                                    <td className="p-3" onClick={(e) => e.stopPropagation()}><input type="date" className="bg-transparent text-gray-700 text-sm outline-none cursor-pointer hover:text-indigo-600 w-full" value={c.installed_date || ''} onChange={(e) => handleInlineUpdate(c.id, 'installed_date', e.target.value)} /></td>
                                                    <td className="p-3 font-bold text-gray-800">{c.name}</td>
                                                    <td className="p-3">
                                                        <div className="flex flex-col">
                                                            <span className="text-gray-600 font-mono mb-1">{c.phone}</span>
                                                            <button
                                                                onClick={(e) => handleOpenChat(e, c)}
                                                                className="px-3 py-1 bg-indigo-500 hover:bg-indigo-600 text-white text-xs rounded transition font-bold shadow-sm"
                                                            >
                                                                💬 SMS
                                                            </button>
                                                        </div>
                                                    </td>
                                                    <td className="p-3" onClick={(e) => e.stopPropagation()}><input type="number" className="w-16 bg-transparent text-gray-800 text-sm outline-none border-b border-gray-300 hover:border-yellow-500 focus:border-yellow-500 text-right font-bold" defaultValue={c.agent_policy || 0} onBlur={(e) => handleInlineUpdate(c.id, 'agent_policy', e.target.value)} placeholder="0" /></td>
                                                    <td className="p-3" onClick={(e) => e.stopPropagation()}><input type="number" className="w-16 bg-transparent text-gray-600 text-sm outline-none border-b border-transparent hover:border-gray-400 focus:border-indigo-500 text-right" defaultValue={c.support_amt || 0} onBlur={(e) => handleInlineUpdate(c.id, 'support_amt', e.target.value)} /></td>
                                                    <td className="p-3 font-bold text-emerald-600 text-right">{formatCurrency(((parseInt(c.agent_policy || 0) || 0) - (parseInt(c.support_amt || 0) || 0)) * 10000)}</td>
                                                    <td className="p-3" onClick={(e) => e.stopPropagation()}><div className="relative"><select className={`w-full p-2 rounded text-xs font-bold cursor-pointer outline-none transition appearance-none text-center ${getBadgeStyle(c.status)}`} value={c.status} onChange={(e) => handleInlineUpdate(c.id, 'status', e.target.value)}>{SALES_STATUS_OPTIONS.map(opt => <option key={opt} value={opt} className="bg-white text-gray-800">{opt}</option>)}</select></div></td>
                                                    <td className="p-3" onClick={(e) => e.stopPropagation()}>
                                                        <div className="flex flex-col w-full">
                                                            {hasPostProcessIssue && <span className={`text-[10px] font-bold mb-1 ${isPostProcessDone ? 'text-green-600' : 'text-orange-500'}`}>{isPostProcessDone ? '✅ 처리완료' : '⚠️ 후처리 필요'}</span>}
                                                            <textarea
                                                                className="w-full bg-transparent border border-transparent hover:border-gray-300 focus:border-indigo-500 rounded p-1 outline-none text-gray-600 text-xs transition placeholder-gray-300 resize-none overflow-hidden leading-relaxed"
                                                                rows={1}
                                                                style={{ minHeight: '1.2rem', height: 'auto' }}
                                                                defaultValue={c.additional_info}
                                                                onInput={autoResizeTextarea}
                                                                onBlur={(e) => handleInlineUpdate(c.id, 'additional_info', e.target.value)}
                                                                placeholder="후처리 메모..."
                                                            />
                                                        </div>
                                                    </td>
                                                    <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>{hasPostProcessIssue ? (<input type="checkbox" className="w-5 h-5 accent-green-500 cursor-pointer" checked={isPostProcessDone} onChange={(e) => handleTogglePostProcess(e, c)} title="클릭하면 완료 처리됩니다." />) : <input type="checkbox" className="w-4 h-4 accent-gray-400 cursor-not-allowed opacity-20" disabled />}</td>
                                                </>}
                                                <td className="p-3 font-bold text-red-400 text-center">{isDup ? '❌' : ''}</td>
                                            </tr>
                                        );
                                    })}
                                    {(currentData || []).length === 0 && <tr><td colSpan="12" className="p-20 text-center text-gray-400">데이터가 없습니다.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        // ⭐️ [신규] 통계(Report) 탭 화면 - 엑셀 스타일 대시보드
                        <div className="p-6 bg-slate-50 min-h-screen">

                            {/* 1. 상단 헤더 & 필터 영역 */}
                            <div className="flex justify-between items-center mb-6">
                                <h1 className="text-2xl font-black text-gray-800 flex items-center gap-2">
                                    📊 판다넷 통계
                                    <span className="text-xs font-normal text-gray-400 ml-2">실시간 상담 및 매출 현황</span>
                                </h1>
                                <div className="flex gap-2">
                                    <div className="relative">
                                        <select
                                            className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-8 text-sm font-bold text-gray-700 shadow-sm focus:outline-none focus:border-indigo-500"
                                            value={selectedStatAgent}
                                            onChange={(e) => setSelectedStatAgent(e.target.value)}
                                        >
                                            <option value="ALL">👤 전체 보기</option>
                                            <optgroup label="상담사 목록">
                                                {agentOptions.map(agent => (
                                                    <option key={agent.id} value={agent.id}>{agent.name}</option>
                                                ))}
                                            </optgroup>
                                        </select>
                                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                                            <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setShowCustomModal(true)}
                                        className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-lg font-bold shadow-md transition flex items-center gap-1 text-sm"
                                    >
                                        🎨 커스터마이징
                                    </button>
                                    <div className="bg-white border border-gray-300 rounded-lg px-4 py-2 text-sm font-bold text-gray-700 shadow-sm flex items-center gap-2">
                                        🛠️ 관리자
                                    </div>
                                </div>
                            </div>

                            {/* 2. 기간 및 플랫폼 필터 */}
                            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 mb-6 flex justify-between items-center">
                                <div className="flex items-center gap-4">
                                    <div className="flex bg-gray-100 rounded-lg p-1">
                                        {['month:월별', 'week:주별', 'day:일별'].map(opt => {
                                            const [val, label] = opt.split(':');
                                            return (
                                                <button
                                                    key={val}
                                                    onClick={() => setStatPeriodType(val)}
                                                    className={`px-4 py-2 rounded-md text-sm font-bold transition ${statPeriodType === val ? 'bg-blue-500 text-white shadow' : 'text-gray-500 hover:text-gray-800'}`}
                                                >
                                                    {label === '월별' ? '📅 월별' : label === '주별' ? '📆 주별' : '📝 일별'}
                                                </button>
                                            )
                                        })}
                                    </div>
                                    <input
                                        type={statPeriodType === 'month' ? 'month' : 'date'}
                                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm font-bold outline-none focus:border-blue-500 transition"
                                        value={statDate}
                                        onChange={(e) => setStatDate(e.target.value)}
                                    />
                                </div>
                                <button className="bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-lg font-bold shadow-md transition flex items-center gap-2 text-sm">
                                    ⚙️ 플랫폼 관리
                                </button>
                            </div>

                            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                                {REPORT_PLATFORM_FILTERS.map(pf => (
                                    <button
                                        key={pf.id}
                                        onClick={() => setStatPlatform(pf.id)}
                                        className={`px-5 py-2.5 rounded-xl font-bold text-sm transition shadow-sm border ${statPlatform === pf.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                                    >
                                        {pf.label}
                                    </button>
                                ))}
                            </div>

                            {/* 3. 메인 대시보드 그리드 (Dashboard Cards) */}
                            {dashboardStats && (
                                <div className="grid grid-cols-2 gap-6 mb-6">
                                    {/* 왼쪽 컬럼 */}
                                    <div className="flex flex-col gap-4">
                                        {/* 총 광고비 */}
                                        {visibleCards.adSpend && (
                                            <div className="bg-red-50 border border-red-100 p-5 rounded-xl shadow-sm flex flex-col justify-center h-32 relative overflow-hidden group">
                                                <div className="absolute top-0 right-0 w-20 h-20 bg-red-100 rounded-full blur-xl opacity-50 -mr-4 -mt-4 transition group-hover:scale-125"></div>
                                                <div className="flex items-center gap-2 mb-2 z-10">
                                                    <span className="text-red-500 bg-red-100 p-1 rounded">💰</span>
                                                    <span className="text-red-800 font-bold text-sm">
                                                        {selectedStatAgent === 'ALL' ? '총 광고비' : `${agentOptions.find(a => a.id == selectedStatAgent)?.name}님 할당 광고비`}
                                                    </span>
                                                </div>
                                                <div className="z-10 flex items-end gap-1">
                                                    {selectedStatAgent === 'ALL' ? (
                                                        <input
                                                            type="text"
                                                            className="text-3xl font-black text-red-600 bg-transparent outline-none w-full placeholder-red-300"
                                                            value={formatCurrency(dashboardStats.adSpend)}
                                                            onChange={(e) => handleAdSpendChange(e.target.value)}
                                                            placeholder="0"
                                                        />
                                                    ) : (
                                                        <span className="text-3xl font-black text-red-600">
                                                            {formatCurrency(dashboardStats.adSpend)}
                                                        </span>
                                                    )}
                                                    <span className="text-red-400 font-bold mb-1">원</span>
                                                </div>
                                            </div>
                                        )}

                                        {/* 설치완료매출 */}
                                        {visibleCards.installedRevenue && (
                                            <div className="bg-emerald-50 border border-emerald-100 p-5 rounded-xl shadow-sm flex flex-col justify-center h-32 relative overflow-hidden group">
                                                <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-100 rounded-full blur-xl opacity-50 -mr-4 -mt-4 transition group-hover:scale-125"></div>
                                                <div className="flex items-center gap-2 mb-2 z-10">
                                                    <span className="text-emerald-500 bg-emerald-100 p-1 rounded">✅</span>
                                                    <span className="text-emerald-800 font-bold text-sm">설치완료매출</span>
                                                </div>
                                                <p className="text-3xl font-black text-emerald-600 z-10">{formatCurrency(dashboardStats.installedRevenue)}</p>
                                            </div>
                                        )}

                                        {/* 총 디비건수 */}
                                        {visibleCards.totalDB && (
                                            <div className="bg-white border border-gray-200 p-5 rounded-xl shadow-sm flex flex-col justify-center h-32 relative overflow-hidden group hover:border-gray-300 transition">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="text-gray-500 bg-gray-100 p-1 rounded">📊</span>
                                                    <span className="text-gray-600 font-bold text-sm">총 디비건수</span>
                                                </div>
                                                <p className="text-3xl font-black text-gray-800">{formatCurrency(dashboardStats.totalDB)}</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* 오른쪽 컬럼 */}
                                    <div className="flex flex-col gap-4">
                                        {/* 접수완료매출 */}
                                        {visibleCards.acceptedRevenue && (
                                            <div className="bg-blue-50 border border-blue-100 p-5 rounded-xl shadow-sm flex flex-col justify-center h-32 relative overflow-hidden group">
                                                <div className="absolute top-0 right-0 w-20 h-20 bg-blue-100 rounded-full blur-xl opacity-50 -mr-4 -mt-4 transition group-hover:scale-125"></div>
                                                <div className="flex items-center gap-2 mb-2 z-10">
                                                    <span className="text-blue-500 bg-blue-100 p-1 rounded">📝</span>
                                                    <span className="text-blue-800 font-bold text-sm">접수완료매출</span>
                                                </div>
                                                <p className="text-3xl font-black text-blue-600 z-10">{formatCurrency(dashboardStats.acceptedRevenue)}</p>
                                            </div>
                                        )}

                                        {/* 순이익 */}
                                        {visibleCards.netProfit && (
                                            <div className="bg-purple-600 border border-purple-600 p-5 rounded-xl shadow-lg flex flex-col justify-center h-32 relative overflow-hidden group text-white">
                                                <div className="absolute top-0 right-0 w-24 h-24 bg-white rounded-full blur-2xl opacity-20 -mr-6 -mt-6 transition group-hover:scale-125"></div>
                                                <div className="flex items-center gap-2 mb-2 z-10">
                                                    <span className="text-purple-600 bg-white p-1 rounded">🎯</span>
                                                    <span className="font-bold text-sm opacity-90">순이익</span>
                                                </div>
                                                <p className="text-3xl font-black z-10">{formatCurrency(dashboardStats.netProfit)}</p>
                                            </div>
                                        )}

                                        {/* 접수건수 */}
                                        {visibleCards.acceptedCount && (
                                            <div className="bg-white border border-gray-200 p-5 rounded-xl shadow-sm flex flex-col justify-center h-32 relative overflow-hidden group hover:border-gray-300 transition">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="text-gray-500 bg-gray-100 p-1 rounded">📋</span>
                                                    <span className="text-gray-600 font-bold text-sm">접수건수</span>
                                                </div>
                                                <p className="text-3xl font-black text-gray-800">{formatCurrency(dashboardStats.acceptedCount)}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* 4. 하단 상세 지표 (Rates) */}
                            {dashboardStats && (
                                <div className="grid grid-cols-3 gap-6 mb-8">
                                    {visibleCards.cancelRate && (
                                        <div className="bg-red-50 border border-red-200 p-4 rounded-xl shadow-sm">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-xs font-bold text-red-700">⚠️ 취소율</span>
                                            </div>
                                            <p className="text-2xl font-black text-red-600">{dashboardStats.cancelRate}%</p>
                                        </div>
                                    )}
                                    {visibleCards.netInstallRate && (
                                        <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl shadow-sm">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-xs font-bold text-emerald-700">🎉 순청약율</span>
                                            </div>
                                            <p className="text-2xl font-black text-emerald-600">{dashboardStats.netInstallRate}%</p>
                                        </div>
                                    )}
                                    <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl shadow-sm">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xs font-bold text-gray-600">💵 평균마진</span>
                                        </div>
                                        <p className="text-2xl font-black text-gray-700">{formatCurrency(dashboardStats.avgMargin)}</p>
                                    </div>
                                </div>
                            )}

                            {/* ⭐️ [신규] 5. 인원별 통계 테이블 (상세 아코디언 추가) */}
                            {agentStats && agentStats.length > 0 && (
                                <div className="mt-8">
                                    <div className="flex justify-between items-center mb-4">
                                        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                            👥 인원별 통계
                                        </h2>
                                        <div className="flex bg-white border border-gray-200 rounded-lg p-1">
                                            <button className="px-3 py-1 bg-blue-500 text-white text-xs font-bold rounded shadow-sm">테이블</button>
                                            <button className="px-3 py-1 text-gray-500 text-xs font-bold hover:bg-gray-50 rounded">카드</button>
                                        </div>
                                    </div>

                                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                        <table className="w-full text-sm text-center">
                                            <thead className="bg-gray-50 text-gray-700 font-bold border-b border-gray-200">
                                                <tr>
                                                    {visibleColumns.owner_name && <th className="py-4 px-2">담당자</th>}
                                                    {visibleColumns.db && <th className="py-4 px-2">디비</th>}
                                                    {visibleColumns.accepted && <th className="py-4 px-2 text-blue-600">접수</th>}
                                                    {visibleColumns.installed && <th className="py-4 px-2 text-emerald-600">설치</th>}
                                                    {visibleColumns.canceled && <th className="py-4 px-2 text-red-500">취소</th>}
                                                    {visibleColumns.adSpend && <th className="py-4 px-2 text-red-600">광고비</th>}
                                                    {visibleColumns.acceptedRevenue && <th className="py-4 px-2 text-blue-600">접수매출</th>}
                                                    {visibleColumns.installedRevenue && <th className="py-4 px-2 text-emerald-600">설치매출</th>}
                                                    {visibleColumns.netProfit && <th className="py-4 px-2 bg-purple-50 text-purple-700 border-l border-r border-purple-100">순이익</th>}
                                                    {visibleColumns.acceptRate && <th className="py-4 px-2">접수율</th>}
                                                    {visibleColumns.cancelRate && <th className="py-4 px-2">취소율</th>}
                                                    {visibleColumns.netInstallRate && <th className="py-4 px-2">순청약율</th>}
                                                    {visibleColumns.avgMargin && <th className="py-4 px-2">평균마진</th>}
                                                    <th className="py-4 px-2">상세</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {agentStats.map((agent) => (
                                                    <React.Fragment key={agent.id}>
                                                        <tr className="hover:bg-gray-50 transition">
                                                            {visibleColumns.owner_name && <td className="py-4 font-bold text-gray-800">{agent.name}</td>}
                                                            {visibleColumns.db && <td className="py-4 text-gray-600">{formatCurrency(agent.db)}</td>}
                                                            {visibleColumns.accepted && <td className="py-4 text-blue-600 font-bold">{formatCurrency(agent.accepted)}</td>}
                                                            {visibleColumns.installed && <td className="py-4 text-emerald-600 font-bold">{formatCurrency(agent.installed)}</td>}
                                                            {visibleColumns.canceled && <td className="py-4 text-red-500">{formatCurrency(agent.canceled)}</td>}
                                                            {visibleColumns.adSpend && <td className="py-4 text-red-600 font-medium">{formatCurrency(agent.adSpend)}</td>}
                                                            {visibleColumns.acceptedRevenue && <td className="py-4 text-blue-600 font-bold">{formatCurrency(agent.acceptedRevenue)}</td>}
                                                            {visibleColumns.installedRevenue && <td className="py-4 text-emerald-600 font-bold">{formatCurrency(agent.installedRevenue)}</td>}
                                                            {visibleColumns.netProfit && <td className="py-4 bg-purple-50 text-purple-700 font-black border-l border-r border-purple-100">{formatCurrency(agent.netProfit)}</td>}
                                                            {visibleColumns.acceptRate && <td className="py-4 text-gray-700">{agent.acceptRate}%</td>}
                                                            {visibleColumns.cancelRate && <td className="py-4 text-gray-500">{agent.cancelRate}%</td>}
                                                            {visibleColumns.netInstallRate && <td className="py-4 text-emerald-600 font-bold">{agent.netInstallRate}%</td>}
                                                            {visibleColumns.avgMargin && <td className="py-4 text-gray-800 font-bold">{formatCurrency(agent.avgMargin)}</td>}
                                                            <td className="py-4">
                                                                <button
                                                                    onClick={() => toggleRow(agent.id)}
                                                                    className={`text-xs px-2 py-1 rounded border transition ${expandedRows.has(agent.id) ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}
                                                                >
                                                                    {expandedRows.has(agent.id) ? '닫기▲' : '플랫폼▼'}
                                                                </button>
                                                            </td>
                                                        </tr>
                                                        {/* 상세 플랫폼별 통계 (아코디언) */}
                                                        {expandedRows.has(agent.id) && (
                                                            <tr>
                                                                <td colSpan="14" className="bg-blue-50/50 p-4 border-b border-gray-200">
                                                                    <div className="bg-white rounded-lg shadow-sm border border-blue-100 overflow-hidden">
                                                                        <div className="bg-blue-50 px-4 py-2 border-b border-blue-100 flex items-center gap-2">
                                                                            <span className="text-lg">📊</span>
                                                                            <span className="font-bold text-gray-800 text-sm">{agent.name} - 플랫폼별 상세</span>
                                                                        </div>
                                                                        <table className="w-full text-xs text-center">
                                                                            <thead className="bg-gray-50 text-gray-600 font-bold border-b border-gray-100">
                                                                                <tr>
                                                                                    <th className="py-3 px-2">플랫폼</th>
                                                                                    <th className="py-3 px-2">디비</th>
                                                                                    <th className="py-3 px-2">접수</th>
                                                                                    <th className="py-3 px-2">설치</th>
                                                                                    <th className="py-3 px-2">취소</th>
                                                                                    <th className="py-3 px-2">광고비</th>
                                                                                    <th className="py-3 px-2">접수매출</th>
                                                                                    <th className="py-3 px-2">설치매출</th>
                                                                                    <th className="py-3 px-2 text-purple-700">순이익</th>
                                                                                    <th className="py-3 px-2">접수율</th>
                                                                                    <th className="py-3 px-2">취소율</th>
                                                                                    <th className="py-3 px-2">순청약율</th>
                                                                                    <th className="py-3 px-2">평균마진</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody className="divide-y divide-gray-50">
                                                                                {agent.platformDetails.map((pf, pIdx) => (
                                                                                    <tr key={pIdx} className="hover:bg-gray-50 transition">
                                                                                        <td className="py-3 text-gray-600">{pf.name}</td>
                                                                                        <td className="py-3 text-gray-500">{formatCurrency(pf.db)}</td>
                                                                                        <td className="py-3 text-gray-700">{formatCurrency(pf.accepted)}</td>
                                                                                        <td className="py-3 text-gray-700">{formatCurrency(pf.installed)}</td>
                                                                                        <td className="py-3 text-gray-500">{formatCurrency(pf.canceled)}</td>
                                                                                        <td className="py-3 text-gray-500">{formatCurrency(pf.adSpend)}</td>
                                                                                        <td className="py-3 text-gray-600">{formatCurrency(pf.acceptedRevenue)}</td>
                                                                                        <td className="py-3 text-gray-600">{formatCurrency(pf.installedRevenue)}</td>
                                                                                        <td className="py-3 font-bold text-purple-600 bg-purple-50/50">{formatCurrency(pf.netProfit)}</td>
                                                                                        <td className="py-3 text-gray-500">{pf.acceptRate}%</td>
                                                                                        <td className="py-3 text-gray-500">{pf.cancelRate}%</td>
                                                                                        <td className="py-3 text-gray-500">{pf.netInstallRate}%</td>
                                                                                        <td className="py-3 text-gray-500">{formatCurrency(pf.avgMargin)}</td>
                                                                                    </tr>
                                                                                ))}
                                                                            </tbody>
                                                                        </table>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </React.Fragment>
                                                ))}
                                                {agentStats.length === 0 && (
                                                    <tr>
                                                        <td colSpan="14" className="py-8 text-center text-gray-400">데이터가 없습니다.</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* 커스터마이징 모달 */}
            {showCustomModal && (
                <PopoutWindow title="🎨 통계 화면 커스터마이징" onClose={() => setShowCustomModal(false)}>
                    <div className="bg-white h-full flex flex-col p-6">
                        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                            <span>👁️</span> 표시할 항목 선택
                        </h2>

                        <div className="mb-8">
                            <h3 className="font-bold text-gray-800 mb-4 border-b border-gray-100 pb-2">📋 테이블 컬럼</h3>
                            <div className="grid grid-cols-3 gap-4">
                                {Object.keys(INITIAL_VISIBLE_COLUMNS).map(col => (
                                    <label key={col} className="flex items-center gap-2 p-3 rounded-lg border border-gray-100 bg-gray-50 hover:bg-white hover:shadow-sm cursor-pointer transition">
                                        <input
                                            type="checkbox"
                                            className="w-5 h-5 accent-indigo-600 rounded"
                                            checked={visibleColumns[col]}
                                            onChange={() => handleColumnToggle(col)}
                                        />
                                        <span className="text-sm font-medium text-gray-700">
                                            {col === 'owner_name' ? '담당자' :
                                                col === 'db' ? '디비' :
                                                    col === 'accepted' ? '접수' :
                                                        col === 'installed' ? '설치' :
                                                            col === 'canceled' ? '취소' :
                                                                col === 'adSpend' ? '광고비' :
                                                                    col === 'acceptedRevenue' ? '접수매출' :
                                                                        col === 'installedRevenue' ? '설치매출' :
                                                                            col === 'netProfit' ? '순이익' :
                                                                                col === 'acceptRate' ? '접수율' :
                                                                                    col === 'cancelRate' ? '취소율' :
                                                                                        col === 'netInstallRate' ? '순청약율' : '평균마진'}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div>
                            <h3 className="font-bold text-gray-800 mb-4 border-b border-gray-100 pb-2">📊 상단 지표 카드</h3>
                            <div className="grid grid-cols-2 gap-4">
                                {Object.keys(INITIAL_VISIBLE_CARDS).map(card => (
                                    <label key={card} className="flex items-center gap-2 p-3 rounded-lg border border-gray-100 bg-gray-50 hover:bg-white hover:shadow-sm cursor-pointer transition">
                                        <input
                                            type="checkbox"
                                            className="w-5 h-5 accent-blue-600 rounded"
                                            checked={visibleCards[card]}
                                            onChange={() => handleCardToggle(card)}
                                        />
                                        <span className="text-sm font-medium text-gray-700">
                                            {card === 'adSpend' ? '💰 총 광고비' :
                                                card === 'acceptedRevenue' ? '📝 접수완료매출' :
                                                    card === 'installedRevenue' ? '✅ 설치완료매출' :
                                                        card === 'netProfit' ? '🎯 순이익' :
                                                            card === 'totalDB' ? '📊 총 디비건수' :
                                                                card === 'acceptedCount' ? '📋 접수건수' :
                                                                    card === 'installCount' ? '✨ 설치건수' :
                                                                        card === 'cancelRate' ? '⚠️ 취소율' : '🎉 순청약율'}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="mt-auto pt-6 border-t border-gray-100 flex justify-end">
                            <button onClick={() => setShowCustomModal(false)} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-md transition">
                                설정 완료
                            </button>
                        </div>
                    </div>
                </PopoutWindow>
            )}

            {/* 💬 우측 채팅 사이드바 (화이트 톤 변경) */}
            <div className={`fixed top-0 right-0 h-full w-[350px] bg-white shadow-2xl z-[150] transform transition-transform duration-300 flex flex-col border-l border-gray-200 ${isChatOpen ? 'translate-x-0' : 'translate-x-full'}`}>

                {/* 1. 상단 헤더 */}
                <div className="bg-indigo-50 p-4 flex justify-between items-center border-b border-indigo-100 h-16">
                    {chatView === 'LIST' ? (
                        <h2 className="font-bold text-indigo-900 text-lg">💬 채팅 목록</h2>
                    ) : (
                        <div className="flex items-center gap-2">
                            <button onClick={backToChatList} className="text-2xl text-gray-500 hover:text-indigo-600 transition">⬅</button>
                            <div>
                                <h2 className="font-bold text-gray-800">{chatTarget?.name || '고객'}</h2>
                                <p className="text-xs text-gray-500">{chatTarget?.phone}</p>
                            </div>
                        </div>
                    )}
                    <button onClick={() => setIsChatOpen(false)} className="text-xl text-gray-400 hover:text-gray-700">✕</button>
                </div>

                {/* 2. 컨텐츠 영역 */}
                <div className="flex-1 overflow-y-auto bg-slate-50">

                    {/* [VIEW 1] 채팅 목록 화면 */}
                    {chatView === 'LIST' && (
                        <div className="flex flex-col">
                            <div className="p-4 bg-white border-b border-gray-100 shadow-sm">
                                <div className="mb-3 relative">
                                    <span className="absolute left-3 top-2.5 text-gray-400">🔍</span>
                                    <input
                                        className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-9 pr-4 py-2 text-sm outline-none focus:border-indigo-400 focus:bg-white transition"
                                        placeholder="이름 또는 뒷자리 검색..."
                                        value={chatListSearch}
                                        onChange={(e) => setChatListSearch(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <div className="flex gap-2">
                                        <input
                                            type="tel"
                                            autoComplete="off"
                                            className="flex-1 bg-gray-50 border border-gray-200 rounded px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:bg-white transition"
                                            placeholder="01012345678"
                                            value={chatInputNumber}
                                            onChange={(e) => setChatInputNumber(e.target.value)}
                                        />
                                        <button onClick={handleSendPromoChat} className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded text-xs font-bold whitespace-nowrap shadow-sm">문자발송</button>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col">
                                {chatListCustomers.length === 0 ? (
                                    <div className="p-10 text-center text-gray-400 text-sm">검색 결과가 없습니다.</div>
                                ) : (
                                    chatListCustomers.map(cust => (
                                        <div
                                            key={cust.id}
                                            onClick={() => enterChatRoom(cust)}
                                            className="flex items-center gap-3 p-4 hover:bg-indigo-50 cursor-pointer border-b border-gray-100 transition"
                                        >
                                            <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-500 flex justify-center items-center text-lg font-bold border border-indigo-200">
                                                {cust.name.charAt(0)}
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="font-bold text-gray-800 text-sm">{cust.name}</span>
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${getBadgeStyle(cust.status)}`}>{cust.status}</span>
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
                        <div className="flex flex-col h-full relative overflow-hidden bg-[#eef1f6]">
                            <div className="flex-1 p-4 flex flex-col gap-3 overflow-y-auto" ref={chatScrollRef}>
                                {chatMessages.length === 0 ? (
                                    <div className="text-center text-gray-400 mt-10 text-xs">대화 내역이 없습니다.<br />메시지를 보내보세요!</div>
                                ) : (
                                    chatMessages.map((msg) => (
                                        <div key={msg.id} className={`flex flex-col ${msg.sender === 'me' ? 'items-end' : 'items-start'}`}>
                                            <div className={`p-3 rounded-2xl text-sm max-w-[85%] whitespace-pre-wrap shadow-sm border ${msg.sender === 'me'
                                                ? 'bg-yellow-300 text-gray-900 border-yellow-400 rounded-tr-none'
                                                : 'bg-white text-gray-800 border-gray-200 rounded-tl-none'
                                                }`}>
                                                {msg.text}
                                            </div>
                                            <span className="text-[10px] text-gray-400 mt-1 px-1 font-medium">
                                                {msg.created_at} {msg.sender === 'other' && '✔'}
                                            </span>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* 상용구 패널 (왼쪽 서랍형) */}
                            <div className={`fixed top-0 right-[350px] h-full w-72 bg-white border-r border-gray-200 shadow-xl z-[140] flex flex-col transition-transform duration-300 ${showMacroPanel && isChatOpen ? 'translate-x-0' : 'translate-x-full pointer-events-none opacity-0'}`}>
                                <div className="flex justify-between items-center p-3 border-b border-gray-200 bg-indigo-50">
                                    <span className="text-sm font-bold text-indigo-800">⚡ 자주 쓰는 문구</span>
                                    <button onClick={() => setShowMacroPanel(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                                </div>

                                {/* 탭 메뉴 */}
                                <div className="flex bg-gray-100 p-1 gap-1 overflow-x-auto no-scrollbar border-b border-gray-200">
                                    {MACRO_TABS.map(tab => (
                                        <button
                                            key={tab.key}
                                            onClick={() => setActiveMacroTab(tab.key)}
                                            className={`
                                                w-16 h-12 rounded-l-xl font-bold text-xs shadow-md transition-all transform flex items-center justify-center
                                                ${activeMacroTab === tab.key ? `${tab.activeColor} translate-x-0 w-20` : `${tab.color} translate-x-2 hover:translate-x-0`}
                                            `}
                                        >
                                            {tab.key}
                                        </button>
                                    ))}
                                </div>

                                <div className="flex-1 overflow-y-auto p-3 custom-scrollbar bg-white">
                                    {(macros[activeMacroTab] || []).length === 0 ? (
                                        <div className="text-center text-gray-400 text-xs mt-10">등록된 문구가 없습니다.</div>
                                    ) : (
                                        (macros[activeMacroTab] || []).map((macro, idx) => (
                                            <div key={idx} className="group flex items-center justify-between bg-gray-50 mb-2 p-3 rounded-lg hover:bg-indigo-50 border border-gray-200 hover:border-indigo-200 transition shadow-sm">
                                                <div
                                                    className="text-xs text-gray-700 flex-1 leading-relaxed cursor-pointer"
                                                    onClick={() => handleSelectMacro(macro)}
                                                    title="클릭하면 입력창에 들어갑니다"
                                                >
                                                    {macro}
                                                </div>
                                                <div className="flex items-center gap-1 ml-2">
                                                    <button
                                                        onClick={(e) => handleInstantSend(e, macro)}
                                                        className="text-[10px] bg-blue-100 text-blue-600 hover:bg-blue-200 px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition font-bold"
                                                        title="즉시 발송"
                                                    >
                                                        전송
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleDeleteMacro(activeMacroTab, idx); }}
                                                        className="text-[10px] bg-red-100 text-red-600 hover:bg-red-200 px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition font-bold"
                                                        title="삭제"
                                                    >
                                                        삭제
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>

                                <div className="p-3 border-t border-gray-200 bg-gray-50">
                                    <div className="flex gap-2">
                                        <input
                                            className="flex-1 bg-white border border-gray-300 rounded px-2 py-1.5 text-xs text-gray-800 outline-none focus:border-indigo-500 transition"
                                            placeholder="새 문구..."
                                            value={newMacroText}
                                            onChange={(e) => setNewMacroText(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleAddMacro()}
                                        />
                                        <button onClick={handleAddMacro} className="bg-indigo-500 hover:bg-indigo-600 text-white px-3 py-1.5 rounded text-xs font-bold whitespace-nowrap shadow-sm">추가</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* 3. 하단 입력창 */}
                {chatView === 'ROOM' && (
                    <div className="p-4 bg-white border-t border-gray-200 relative z-30">
                        <div className="flex justify-end mb-2">
                            <button
                                onClick={() => setShowMacroPanel(!showMacroPanel)}
                                className={`text-xs px-3 py-1.5 rounded-full font-bold flex items-center gap-1 shadow-sm border transition ${showMacroPanel ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'}`}
                            >
                                ⚡ 상용구
                            </button>
                        </div>

                        <div className="flex flex-col gap-2">
                            <textarea
                                className="w-full h-20 border border-gray-300 rounded-lg p-3 text-sm text-gray-800 resize-none outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-100 transition bg-gray-50"
                                placeholder="메시지를 입력하세요..."
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
                                <span className="text-[10px] text-gray-400 pl-1">Enter 전송 / Shift+Enter 줄바꿈</span>
                                <button
                                    onClick={() => handleSendManualChat()} // 인자 없이 호출
                                    disabled={isSending}
                                    className={`px-6 py-2 rounded-lg font-bold text-sm transition shadow-sm ${isSending ? 'bg-gray-300 text-gray-500' : 'bg-yellow-400 hover:bg-yellow-500 text-gray-900'
                                        }`}
                                >
                                    {isSending ? "..." : "전송"}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* 나머지 모달 컴포넌트들 (팝업도 화이트톤 변경) */}
            {/* ⭐️ [수정됨] 접수 완료 팝업 (독립 창 모드 + 스타일 복사) */}
            {showCompletionModal && completionTarget && (
                <PopoutWindow title={`[접수완료] ${completionTarget.name} 고객님`} onClose={() => setShowCompletionModal(false)}>
                    <div className="bg-white h-full w-full flex flex-col font-sans">
                        <div className="bg-indigo-600 p-4 flex justify-between items-center shrink-0">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                📝 접수 완료 처리
                            </h2>
                            <div className="text-indigo-200 text-sm">독립 윈도우 모드</div>
                        </div>

                        <div className="p-6 grid grid-cols-2 gap-8 flex-1 overflow-y-auto">
                            {/* 왼쪽: 통신사 및 기본 정보 */}
                            <div className="flex flex-col gap-4 border-r border-gray-100 pr-6">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">통신사 선택</label>
                                    <div className="flex gap-2">
                                        {Object.keys(INITIAL_FORM_TEMPLATE).map((_, idx) => {
                                            const p = INITIAL_FORM_TEMPLATE[idx].name;
                                            return (
                                                <button
                                                    key={p}
                                                    onClick={() => { setSelectedPlatform(p); setDynamicFormData({}); setCalculatedPolicy(0); }}
                                                    className={`flex-1 py-3 rounded-xl font-bold border transition shadow-sm ${selectedPlatform === p ? 'bg-indigo-600 text-white border-indigo-600 ring-2 ring-indigo-200' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}
                                                >
                                                    {p}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>

                                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                                    <h3 className="font-bold text-blue-800 mb-2 text-sm">💡 고객 기본 정보</h3>
                                    <div className="text-sm text-gray-600 space-y-1">
                                        <p><span className="w-16 inline-block font-bold">이름:</span> {completionTarget.name}</p>
                                        <p><span className="w-16 inline-block font-bold">연락처:</span> {completionTarget.phone}</p>
                                    </div>
                                </div>

                                {/* 자동 계산된 정책금 표시 */}
                                <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100 text-center">
                                    <p className="text-xs text-yellow-700 font-bold mb-1">예상 정책금 (자동계산)</p>
                                    <p className="text-3xl font-extrabold text-yellow-600">{calculatedPolicy} <span className="text-base text-yellow-500">만원</span></p>
                                </div>
                            </div>

                            {/* 오른쪽: 상품 상세 선택 */}
                            <div className="flex flex-col h-full">
                                <label className="block text-sm font-bold text-gray-700 mb-2">상품 상세 선택</label>
                                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-4">
                                    {(formTemplates.find(t => t.name === selectedPlatform)?.fields || []).map(f => (
                                        <div key={f.id} className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                                            <label className="block text-xs font-bold text-gray-600 mb-2">{f.label}</label>

                                            {f.type === 'select' && (
                                                <select
                                                    className="w-full bg-white border border-gray-300 rounded-lg p-2 text-sm focus:border-indigo-500 outline-none"
                                                    onChange={e => handleFormDataChange(f.id, e.target.value, f.policies)}
                                                >
                                                    <option value="">선택하세요</option>
                                                    {f.options.split(',').map(o => <option key={o.trim()} value={o.trim()}>{o.trim()}</option>)}
                                                </select>
                                            )}

                                            {f.type === 'text' && (
                                                <input
                                                    type="text"
                                                    className="w-full bg-white border border-gray-300 rounded-lg p-2 text-sm focus:border-indigo-500 outline-none"
                                                    placeholder={f.placeholder}
                                                    onChange={e => handleFormDataChange(f.id, e.target.value)}
                                                />
                                            )}

                                            {f.type === 'radio' && (
                                                <div className="flex gap-2 flex-wrap">
                                                    {f.options.split(',').map(o => (
                                                        <label key={o.trim()} className="flex items-center gap-1 cursor-pointer bg-white px-3 py-1.5 rounded border border-gray-200 hover:border-indigo-300 transition">
                                                            <input
                                                                type="radio"
                                                                name={f.id}
                                                                className="accent-indigo-600"
                                                                onChange={() => handleFormDataChange(f.id, o.trim(), f.policies)}
                                                            />
                                                            <span className="text-xs">{o.trim()}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            )}

                                            {f.type === 'checkbox' && (
                                                <div className="flex gap-2 flex-wrap">
                                                    {f.options.split(',').map(o => (
                                                        <label key={o.trim()} className="flex items-center gap-1 cursor-pointer bg-white px-3 py-1.5 rounded border border-gray-200 hover:border-indigo-300 transition">
                                                            <input
                                                                type="checkbox"
                                                                className="accent-indigo-600"
                                                                onChange={e => handleFormDataChange(f.id, e.target.checked ? o.trim() : '', f.policies)}
                                                            />
                                                            <span className="text-xs">{o.trim()}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* 하단 버튼 */}
                        <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3 shrink-0">
                            <button onClick={() => setShowCompletionModal(false)} className="px-6 py-3 rounded-xl bg-white border border-gray-300 text-gray-600 font-bold hover:bg-gray-100 transition">취소</button>
                            <button onClick={handleConfirmCompletion} className="px-8 py-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow-lg transition flex items-center gap-2">
                                <span>✅ 접수 완료 및 이력 저장</span>
                            </button>
                        </div>
                    </div>
                </PopoutWindow>
            )}

            {/* 나머지 모달들 */}
            {memoPopupTarget && (
                <div className="fixed inset-0 bg-black/40 flex justify-center items-center backdrop-blur-sm z-50">
                    <div className="bg-white p-6 rounded-2xl w-[400px] border border-gray-200 shadow-2xl animate-fade-in-up">
                        <h2 className="text-lg font-bold mb-3 text-indigo-800 border-b border-gray-100 pb-2">{memoFieldType === 'additional_info' ? '📝 후처리 메모' : '💬 상담 내용 메모'}</h2>
                        <textarea ref={memoInputRef} className="w-full h-40 bg-gray-50 p-4 rounded-xl border border-gray-300 text-sm text-gray-800 resize-none outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition" value={memoPopupText} onChange={e => setMemoPopupText(e.target.value)} placeholder="내용을 입력하세요..." />
                        <div className="flex justify-end gap-2 mt-4"><button onClick={() => setMemoPopupTarget(null)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg font-bold transition">취소</button><button onClick={saveMemoPopup} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-md transition">저장</button></div>
                    </div>
                </div>
            )}

            {showUploadModal && <div className="fixed inset-0 bg-black/40 flex justify-center items-center backdrop-blur-sm z-50"><div className="bg-white p-8 rounded-2xl w-[600px] border border-gray-200 shadow-2xl animate-fade-in-up"><h2 className="text-2xl font-bold mb-4 text-indigo-900">📤 엑셀 복사 등록</h2><textarea placeholder="엑셀에서 복사한 내용을 붙여넣으세요... (이름 / 전화번호 / 플랫폼 / 메모)" className="w-full h-48 bg-gray-50 p-4 rounded-xl border border-gray-300 text-sm font-mono mb-6 text-gray-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition" value={pasteData} onChange={handlePaste} /><div className="flex justify-end gap-3"><button onClick={() => setShowUploadModal(false)} className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg font-bold transition">취소</button><button onClick={handleBulkSubmit} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-md transition">일괄 등록하기</button></div></div></div>}

            {/* ⭐️ [신규] 확인 요청 응답 모달 */}
            {showResponseModal && responseTarget && (
                <div className="fixed inset-0 bg-black/40 flex justify-center items-center backdrop-blur-sm z-50">
                    <div className="bg-white p-6 rounded-2xl w-[400px] border border-gray-200 shadow-2xl animate-fade-in-up">
                        <h2 className="text-xl font-bold mb-4 text-indigo-900 border-b border-gray-100 pb-2 flex items-center gap-2">
                            🔔 관리자 확인 요청
                        </h2>

                        <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200 mb-6">
                            <span className="text-xs font-bold text-yellow-700 block mb-1">요청 내용:</span>
                            <p className="text-sm text-gray-800 font-medium">{responseTarget.request_message || "내용 없음"}</p>
                        </div>

                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => handleResponse('PROCESSING')}
                                className="w-full py-3 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-xl font-bold transition flex items-center justify-center gap-2"
                            >
                                🚧 지금 확인 중입니다
                            </button>
                            <button
                                onClick={() => handleResponse('COMPLETED')}
                                className="w-full py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-bold shadow-md transition flex items-center justify-center gap-2"
                            >
                                ✅ 처리 완료했습니다
                            </button>
                        </div>

                        <div className="mt-4 text-center">
                            <button onClick={() => setShowResponseModal(false)} className="text-xs text-gray-400 hover:text-gray-600">닫기</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default AgentDashboard;
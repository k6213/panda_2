import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';

// ==================================================================================
// 1. 상수 및 설정값
// ==================================================================================
const API_BASE = "https://panda-1-hd18.onrender.com";

const STATUS_OPTIONS = ['미통건', '부재', '재통', '가망', '장기가망', 'AS요청', '실패', '실패이관', '접수완료'];
const TIME_OPTIONS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
const QUICK_FILTERS = ['ALL', '재통', '가망', '부재', '미통건'];

const SHARED_SUB_TABS = [
    { id: 'ALL', label: '전체 보기' },
    { id: '당근', label: '🥕 당근' },
    { id: '토스', label: '💸 토스' },
    { id: '실패DB', label: '🚫 실패DB' },
    { id: '기타', label: '🎸 기타' }
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

const INITIAL_POLICY_DATA = {
    "KT": { internet: [], bundle: [], addon: [] },
    "SK": { internet: [], bundle: [], addon: [] },
    "LG": { internet: [], bundle: [], addon: [] },
    "LG헬로비전": { internet: [], bundle: [], addon: [] },
    "SK POP": { internet: [], bundle: [], addon: [] },
    "SKY LIFE": { internet: [], bundle: [], addon: [] },
};

// ==================================================================================
// 2. 유틸리티 함수
// ==================================================================================
const safeParseInt = (val) => {
    if (val === null || val === undefined || val === '') return 0;
    const num = parseInt(String(val).replace(/[^0-9-]/g, ''), 10);
    return isNaN(num) ? 0 : num;
};

const parseChecklist = (str) => {
    if (!str) return [];
    return str.split(',').map(s => s.trim()).filter(Boolean);
};

const formatCurrency = (num) => {
    if (num === null || num === undefined) return '0';
    if (isNaN(num)) return '0';
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
    if (cleanInput.length === 8) { return `${cleanInput.substring(0, 4)}-${cleanInput.substring(4, 6)}-${cleanInput.substring(6, 8)}`; }
    else if (cleanInput.length === 6) { return `20${cleanInput.substring(0, 2)}-${cleanInput.substring(2, 4)}-${cleanInput.substring(4, 6)}`; }
    else if (cleanInput.length === 4) { return `${now.getFullYear()}-${cleanInput.substring(0, 2)}-${cleanInput.substring(2, 4)}`; }
    return null;
};

const autoResizeTextarea = (e) => {
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';
};

// ==================================================================================
// 3. 팝업 컴포넌트
// ==================================================================================
// ==================================================================================
// 3. 팝업 컴포넌트 (스타일 복사 로직 강화)
// ==================================================================================
const PopoutWindow = ({ title, onClose, children }) => {
    const [containerEl, setContainerEl] = useState(null);
    const externalWindow = useRef(null);

    useEffect(() => {
        // 이미 창이 열려있지 않다면 새로 엽니다.
        if (!externalWindow.current || externalWindow.current.closed) {
            externalWindow.current = window.open("", "", "width=1000,height=800,left=200,top=100,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes");
        }

        const win = externalWindow.current;

        if (!win) {
            alert("⚠️ 팝업이 차단되었습니다! 브라우저 주소창 우측의 팝업 차단을 해제해주세요.");
            if (onClose) onClose();
            return;
        }

        // 1. 기본 HTML 구조 작성
        try {
            win.document.open();
            win.document.write(`
                <!DOCTYPE html>
                <html lang="ko">
                <head>
                    <meta charset="utf-8" />
                    <title>${title || "상담 관리 팝업"}</title>
                    <style>
                        body { margin: 0; padding: 0; background-color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
                        #popout-root { height: 100vh; overflow: auto; }
                        /* 스크롤바 숨김 처리 */
                        ::-webkit-scrollbar { display: none; }
                        * { -ms-overflow-style: none; scrollbar-width: none; }
                    </style>
                </head>
                <body>
                    <div id="popout-root"></div>
                </body>
                </html>
            `);
            win.document.close();
        } catch (e) {
            console.error("Popup Write Error:", e);
        }

        // ⭐️ [핵심 수정] 부모 창의 모든 스타일(Tailwind 포함)을 새 창으로 복사
        // 1) <link rel="stylesheet"> 복사
        document.querySelectorAll('link[rel="stylesheet"]').forEach(node => {
            win.document.head.appendChild(node.cloneNode(true));
        });
        // 2) <style> 태그 복사
        document.querySelectorAll('style').forEach(node => {
            win.document.head.appendChild(node.cloneNode(true));
        });

        // 3) Tailwind CDN 강제 주입 (부모 창에서 복사가 안 될 경우를 대비한 안전장치)
        const script = win.document.createElement('script');
        script.src = "https://cdn.tailwindcss.com";
        win.document.head.appendChild(script);

        // 컨테이너 설정 (React Portal 타겟)
        setTimeout(() => {
            const container = win.document.getElementById('popout-root');
            setContainerEl(container);
        }, 100);

        // 팝업이 닫혔는지 감시
        const timer = setInterval(() => {
            if (win.closed) {
                clearInterval(timer);
                if (onClose) onClose();
            }
        }, 500);

        // 컴포넌트 언마운트 시 팝업 닫기
        return () => {
            clearInterval(timer);
            if (win && !win.closed) {
                win.close();
            }
        };
    }, []);

    return containerEl ? ReactDOM.createPortal(children, containerEl) : null;
};

// ==================================================================================
// 4. 메인 컴포넌트
// ==================================================================================
function AgentDashboard({ user, onLogout }) {

    // [설정 데이터]
    const [config, setConfig] = useState(() => {
        try { return JSON.parse(localStorage.getItem('agent_system_config')); } catch { return null; }
    });

    const currentUserId = user ? String(user.user_id || user.id) : null;

    // [상태 변수들]
    const [activeTab, setActiveTab] = useState('shared');
    const [periodFilter, setPeriodFilter] = useState('month');
    const [agents, setAgents] = useState([]);
    const [isLoading, setIsLoading] = useState(false);


    const [showFailModal, setShowFailModal] = useState(false);
    const [failTarget, setFailTarget] = useState(null);
    const [selectedFailReason, setSelectedFailReason] = useState('');

    // 설정 관련 State
    const [adChannels, setAdChannels] = useState([]);
    const [reasons, setReasons] = useState([]);
    const [customStatuses, setCustomStatuses] = useState([]);
    const [settlementStatuses, setSettlementStatuses] = useState([]);
    const [bankList, setBankList] = useState([]);

    const [policyData, setPolicyData] = useState(() => {
        try {
            const saved = localStorage.getItem('agent_policy_data');
            return saved ? JSON.parse(saved) : INITIAL_POLICY_DATA;
        } catch { return INITIAL_POLICY_DATA; }
    });
    const [activePolicyTab, setActivePolicyTab] = useState('KT');

    // ⭐️ 데이터 통합
    const [allCustomers, setAllCustomers] = useState([]);

    // 필터링 State
    const [viewDuplicatesOnly, setViewDuplicatesOnly] = useState(false);
    const [issueSubTab, setIssueSubTab] = useState('fail');
    const [failReasonFilter, setFailReasonFilter] = useState('');
    const [salesAgentFilter, setSalesAgentFilter] = useState('');
    const [settlementStatusFilter, setSettlementStatusFilter] = useState('ALL');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [sharedSubTab, setSharedSubTab] = useState('ALL');
    const [selectedIds, setSelectedIds] = useState([]);
    const [targetAgentId, setTargetAgentId] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    // 모달 State
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [showNotiDropdown, setShowNotiDropdown] = useState(false);
    const [pasteData, setPasteData] = useState('');
    const [parsedData, setParsedData] = useState([]);
    const [showCompletionModal, setShowCompletionModal] = useState(false);
    const [completionTarget, setCompletionTarget] = useState(null);
    const [selectedPlatform, setSelectedPlatform] = useState('KT');
    const [dynamicFormData, setDynamicFormData] = useState({});
    const [calculatedPolicy, setCalculatedPolicy] = useState(0);

    const [newAgent, setNewAgent] = useState({ username: '', password: '' });
    const [newAdChannel, setNewAdChannel] = useState({ name: '', cost: '' });
    const [newReason, setNewReason] = useState('');
    const [newStatus, setNewStatus] = useState('');
    const [newSettlementStatus, setNewSettlementStatus] = useState('');
    const [notepadContent, setNotepadContent] = useState('');

    const [showResponseModal, setShowResponseModal] = useState(false);
    const [responseTarget, setResponseTarget] = useState(null);
    const [requestMessage, setRequestMessage] = useState('');
    const [requestTarget, setRequestTarget] = useState(null);
    const [showRequestModal, setShowRequestModal] = useState(false);

    const [memoPopupTarget, setMemoPopupTarget] = useState(null);
    const [memoPopupText, setMemoPopupText] = useState('');
    const [memoFieldType, setMemoFieldType] = useState('');

    const [notices, setNotices] = useState([]);
    const [policyImages, setPolicyImages] = useState({});
    const [newNotice, setNewNotice] = useState({ title: '', content: '', is_important: false });
    const [uploadImage, setUploadImage] = useState(null);
    const [isBannerVisible, setIsBannerVisible] = useState(true);
    const [showReferralModal, setShowReferralModal] = useState(false);
    const [referralData, setReferralData] = useState({ name: '', phone: '', platform: 'KT', product_info: '' });
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [newLog, setNewLog] = useState('');

    // ⭐️ [신규] 상단 실시간 지표 숨기기 토글
    const [isTopStatsVisible, setIsTopStatsVisible] = useState(true);

    // 채팅 관련 State
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [chatView, setChatView] = useState('LIST');
    const [chatTarget, setChatTarget] = useState(null);
    const [chatListSearch, setChatListSearch] = useState('');
    const [chatMessages, setChatMessages] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const [isSending, setIsSending] = useState(false);

    // 매크로
    const [showMacro, setShowMacro] = useState(false);
    const [activeMacroTab, setActiveMacroTab] = useState('공통');
    const [newMacroText, setNewMacroText] = useState('');
    const [macros, setMacros] = useState(() => {
        const saved = localStorage.getItem('agent_macros');
        return saved ? JSON.parse(saved) : {
            '공통': ['안녕하세요, 상담사입니다.', '잠시 통화 가능하실까요?', '부재중이셔서 문자 남깁니다.'],
            'KT': ['KT 결합상품 안내드립니다.', '기가지니 셋톱박스 혜택 안내'],
            'SK': ['SKT 온가족 할인 안내', 'SK브로드밴드 신규 가입 혜택'],
            'LG': ['LG U+ 참 쉬운 가족 결합', '아이들나라 콘텐츠 안내'],
            '기타': []
        };
    });

    const [chatInputNumber, setChatInputNumber] = useState('');
    const chatScrollRef = useRef(null);

    // 통계 State
    const [statPeriodType, setStatPeriodType] = useState('month');
    const [statDate, setStatDate] = useState(() => new Date().toISOString().substring(0, 7));
    const [statPlatform, setStatPlatform] = useState('ALL');
    const [selectedStatAgent, setSelectedStatAgent] = useState('ALL');
    const [serverStats, setServerStats] = useState(null);
    const [showCustomModal, setShowCustomModal] = useState(false);
    const [adSpend, setAdSpend] = useState(0);

    const [visibleColumns, setVisibleColumns] = useState(() => {
        try { return JSON.parse(localStorage.getItem('agent_stat_columns')) || INITIAL_VISIBLE_COLUMNS; } catch { return INITIAL_VISIBLE_COLUMNS; }
    });
    const [visibleCards, setVisibleCards] = useState(() => {
        try { return JSON.parse(localStorage.getItem('agent_stat_cards')) || INITIAL_VISIBLE_CARDS; } catch { return INITIAL_VISIBLE_CARDS; }
    });
    const [expandedRows, setExpandedRows] = useState(new Set());
    const [monthlyAdSpends, setMonthlyAdSpends] = useState(() => {
        try { return JSON.parse(localStorage.getItem('agent_monthly_ad_spends')) || {}; } catch { return {}; }
    });

    const memoInputRef = useRef(null);

    // 초기 로드
    useEffect(() => {
        fetch(`${API_BASE}/api/system/config/`).then(res => res.json()).then(data => {
            setConfig(data);
            if (data.default_macros) setMacros(data.default_macros);
        }).catch(console.error);
    }, []);

    useEffect(() => { localStorage.setItem('agent_policy_data', JSON.stringify(policyData)); }, [policyData]);
    // ⭐️ 매크로 저장
    useEffect(() => { localStorage.setItem('agent_macros', JSON.stringify(macros)); }, [macros]);

    useEffect(() => {
        const currentMonthKey = statDate.substring(0, 7);
        setAdSpend(safeParseInt(monthlyAdSpends[currentMonthKey]));
    }, [statDate, monthlyAdSpends]);

    useEffect(() => { localStorage.setItem('agent_monthly_ad_spends', JSON.stringify(monthlyAdSpends)); }, [monthlyAdSpends]);

    const getAuthHeaders = useCallback(() => {
        const token = sessionStorage.getItem('token');
        return { 'Content-Type': 'application/json', 'Authorization': `Token ${token}` };
    }, []);

    // ⭐️ 메모 로드 및 저장 핸들러
    useEffect(() => {
        if (currentUserId) {
            const savedMemo = localStorage.getItem(`agent_memo_${currentUserId}`);
            if (savedMemo) setNotepadContent(savedMemo);
        }
    }, [currentUserId]);

    const handleNotepadChange = (e) => {
        const content = e.target.value;
        setNotepadContent(content);
        localStorage.setItem(`agent_memo_${currentUserId}`, content);
    };

    // [데이터 로드]
    const fetchAllData = useCallback(() => {
        setIsLoading(true);
        fetch(`${API_BASE}/api/customers/`, { headers: getAuthHeaders() })
            .then(res => res.json())
            .then(data => {
                const list = Array.isArray(data) ? data : [];
                // ⭐️ ID 기준 중복 제거
                const uniqueList = Array.from(new Map(list.map(item => [item.id, item])).values());
                setAllCustomers(uniqueList);
            })
            .catch(err => console.error("데이터 로드 실패:", err))
            .finally(() => setIsLoading(false));
    }, [getAuthHeaders]);

    const fetchAgents = useCallback(() => { fetch(`${API_BASE}/api/agents/`, { headers: getAuthHeaders() }).then(res => res.json()).then(setAgents); }, [getAuthHeaders]);

    const fetchSettings = useCallback(() => {
        const headers = getAuthHeaders();
        fetch(`${API_BASE}/api/ad_channels/`, { headers }).then(res => res.json()).then(setAdChannels).catch(() => setAdChannels([]));
        fetch(`${API_BASE}/api/failure_reasons/`, { headers }).then(res => res.json()).then(setReasons);
        fetch(`${API_BASE}/api/custom_statuses/`, { headers }).then(res => res.json()).then(setCustomStatuses);
        fetch(`${API_BASE}/api/settlement_statuses/`, { headers }).then(res => res.json()).then(data => setSettlementStatuses(data.length ? data : []));
        fetch(`${API_BASE}/api/banks/`, { headers }).then(res => res.json()).then(setBankList).catch(() => setBankList([]));
    }, [getAuthHeaders]);

    const fetchNoticesAndPolicies = useCallback(() => {
        fetch(`${API_BASE}/api/notices/`, { headers: getAuthHeaders() }).then(res => res.json()).then(setNotices);
        fetch(`${API_BASE}/api/policies/latest/`, { headers: getAuthHeaders() }).then(res => res.json()).then(setPolicyImages);
    }, [getAuthHeaders]);

    // 🛠️ [수정할 fetchStatistics 함수]
    const fetchStatistics = useCallback(async () => {
        if (!user || activeTab !== 'report') return;

        // ⭐️ [수정] 날짜 형식이 안 맞더라도 강제로 형식을 맞춰서 서버에 요청
        let safeDate = statDate;

        if (statPeriodType === 'day') {
            // 일별 모드인데 '2026-01' 처럼 7자리만 있다면 '-01'을 붙여서 강제로 날짜 형식으로 변환
            if (safeDate.length === 7) safeDate = `${safeDate}-01`;
        } else if (statPeriodType === 'month') {
            // 월별 모드인데 '2026-01-12' 처럼 10자리가 있다면 앞 7자리만 사용
            if (safeDate.length === 10) safeDate = safeDate.substring(0, 7);
        }

        let url = `${API_BASE}/api/stats/advanced/?platform=${statPlatform}`;

        // 일별/월별에 따라 파라미터 구성
        if (statPeriodType === 'month') {
            url += `&start_date=${safeDate}`;
        } else if (statPeriodType === 'day') {
            // 일별 조회는 start와 end를 동일하게 보내서 하루치만 조회
            url += `&start_date=${safeDate}&end_date=${safeDate}`;
        }

        try {
            const res = await fetch(url, { headers: getAuthHeaders() });
            if (res.ok) {
                const data = await res.json();
                setServerStats(data);
            } else {
                setServerStats([]);
            }
        } catch (err) {
            console.error("통계 로드 실패:", err);
            setServerStats([]);
        }
    }, [user, activeTab, statDate, statPeriodType, statPlatform, getAuthHeaders]);

    const loadCurrentTabData = useCallback(() => {
        setSelectedIds([]);

        if (activeTab === 'report') {
            fetchStatistics();
        } else if (activeTab === 'policy') {
            fetchNoticesAndPolicies();
        } else {
            // 일반 탭(상담관리, 접수관리, 공유DB 등) 데이터 로드
            fetchAllData();
            fetchAgents();

            // 🟢 [수정됨] 실패 사유(reasons)를 항상 불러오도록 변경
            // (기존에는 issue_manage 탭 안에만 있어서 상담관리 탭에서는 목록이 비어있었음)
            fetch(`${API_BASE}/api/failure_reasons/`, { headers: getAuthHeaders() })
                .then(res => res.json())
                .then(setReasons);

            // 탭별 추가 데이터 로드
            if (activeTab === 'settlement') {
                fetch(`${API_BASE}/api/settlement_statuses/`, { headers: getAuthHeaders() })
                    .then(res => res.json())
                    .then(setSettlementStatuses);
            }
            if (activeTab === 'settings') {
                fetchSettings();
            }

            fetchNoticesAndPolicies();
        }
    }, [activeTab, fetchAllData, fetchAgents, fetchSettings, fetchNoticesAndPolicies, fetchStatistics, getAuthHeaders]);

    useEffect(() => {
        loadCurrentTabData();
        const interval = setInterval(() => {
            if (activeTab !== 'report' && activeTab !== 'settings' && !showUploadModal && !showCompletionModal) {
                loadCurrentTabData();
            }
        }, 60000);
        return () => clearInterval(interval);
    }, [loadCurrentTabData, showUploadModal, showCompletionModal, activeTab]);

    useEffect(() => {
        if (activeTab === 'report') fetchStatistics();
    }, [statDate, statPeriodType, statPlatform, selectedStatAgent, fetchStatistics]);

    // =========================================================================
    // ⚙️ 데이터 필터링 로직 (통합)
    // =========================================================================

    const myAllCustomers = useMemo(() =>
        (allCustomers || []).filter(c => String(c.owner) === String(currentUserId)),
        [allCustomers, currentUserId]);

    const sharedCustomers = useMemo(() =>
        (allCustomers || []).filter(c => c.owner === null),
        [allCustomers]);

    // ⭐️ [중요] 변수 선언 순서 수정 (displayedData, realTimeStats에서 사용하기 위해 먼저 선언)
    const { consultDB, longTermDB, salesDB } = useMemo(() => {
        // 🟢 ['접수완료']를 추가하여, 접수가 완료되면 상담 목록에서 사라지게 함
        let consult = myAllCustomers.filter(c => !['설치완료', '해지진행', '접수취소', '장기가망', '접수완료'].includes(c.status));
        let longTerm = myAllCustomers.filter(c => c.status === '장기가망');
        let sales = myAllCustomers.filter(c => c.status === '접수완료');

        const sortFn = (a, b) => {
            const dateA = a.callback_schedule ? new Date(a.callback_schedule).getTime() : Infinity;
            const dateB = b.callback_schedule ? new Date(b.callback_schedule).getTime() : Infinity;
            return dateA - dateB;
        };
        consult.sort(sortFn);
        longTerm.sort(sortFn);

        return { consultDB: consult, longTermDB: longTerm, salesDB: sales };
    }, [myAllCustomers]);

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

    const notifications = useMemo(() => {
        if (!user || !config) return [];
        const now = new Date().getTime();
        return allCustomers.filter(c => {
            if (c.owner !== user.user_id) return false;
            if (!c.callback_schedule) return false;
            if (['접수완료', '실패', '장기가망', '접수취소', '실패이관'].includes(c.status)) return false;
            const checklist = parseChecklist(c.checklist);
            if (!checklist.includes('알림ON')) return false;
            return new Date(c.callback_schedule).getTime() <= now;
        }).sort((a, b) => new Date(a.callback_schedule) - new Date(b.callback_schedule));
    }, [allCustomers, user, config]);

    const todayIssues = useMemo(() => {
        if (!notices || notices.length === 0) return [];
        const todayStr = new Date().toISOString().split('T')[0];
        return notices.filter(n => n.created_at && n.created_at.startsWith(todayStr));
    }, [notices]);

    const chatListCustomers = useMemo(() => {
        let list = myAllCustomers;
        if (chatListSearch) {
            const term = chatListSearch.toLowerCase();
            list = list.filter(c => (c.name && c.name.toLowerCase().includes(term)) || (c.phone && c.phone.includes(term)));
        }
        return list.sort((a, b) => new Date(b.upload_date) - new Date(a.upload_date));
    }, [myAllCustomers, chatListSearch]);

    // ⭐️ [핵심] Displayed Data
    const displayedData = useMemo(() => {
        let data = [];

        if (activeTab === 'total_manage') {
            data = myAllCustomers;
        } else if (activeTab === 'shared') {
            data = sharedCustomers;
            if (sharedSubTab !== 'ALL') {
                if (sharedSubTab === '기타') { const known = ['당근', '토스', '실패DB']; data = data.filter(c => !known.includes(c.platform)); }
                else { data = data.filter(c => c.platform === sharedSubTab); }
            }
            if (viewDuplicatesOnly) { data = data.filter(c => duplicateSet.has(c.phone)).sort((a, b) => a.phone.localeCompare(b.phone)); }
        } else if (activeTab === 'consult') {
            data = consultDB;
            if (statusFilter !== 'ALL') data = data.filter(c => c.status === statusFilter);
        } else if (activeTab === 'long_term') {
            data = longTermDB;
        } else if (activeTab === 'issue_manage') {
            if (issueSubTab === 'fail') {
                data = myAllCustomers.filter(c => c.status === '실패');
                if (failReasonFilter) data = data.filter(c => c.detail_reason === failReasonFilter);
            } else {
                data = myAllCustomers.filter(c => c.status === 'AS요청');
            }
        } else if (activeTab === 'reception') {
            data = myAllCustomers.filter(c => c.status === '접수완료');
        } else if (activeTab === 'installation') {
            data = myAllCustomers.filter(c => c.status === '설치완료');
        }

        if (['reception', 'installation', 'settlement'].includes(activeTab) && salesAgentFilter) {
            data = data.filter(c => String(c.owner) === String(salesAgentFilter));
        }

        if (searchTerm) {
            data = data.filter(c => (c.name && c.name.includes(searchTerm)) || (c.phone && c.phone.includes(searchTerm)));
        }

        return data;
    }, [activeTab, myAllCustomers, sharedCustomers, consultDB, longTermDB, duplicateSet, issueSubTab, failReasonFilter, settlementStatusFilter, statusFilter, searchTerm, sharedSubTab, config, salesAgentFilter, viewDuplicatesOnly]);

    // ⭐️ [신규] 상단 실시간 지표 계산 (이번 달 기준)
    // ⭐️ [수정 1] 최근 6개월 월별 데이터 계산 로직으로 변경
    const realTimeStats = useMemo(() => {
        const stats = [];
        const today = new Date();

        // 최근 6개월 반복 (i=5: 5달전, i=0: 이번달)
        for (let i = 5; i >= 0; i--) {
            const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const key = `${y}-${m}`;

            const monthCustomers = myAllCustomers.filter(c => c.upload_date && c.upload_date.startsWith(key));

            const totalDB = monthCustomers.length;
            const accepted = monthCustomers.filter(c => ['접수완료', '설치완료'].includes(c.status)).length;

            // 접수 매출 (접수완료 + 설치완료)
            const acceptedRevenue = monthCustomers
                .filter(c => ['접수완료', '설치완료'].includes(c.status))
                .reduce((acc, c) => acc + (safeParseInt(c.agent_policy) * 10000), 0);

            // 설치 매출 (설치완료만)
            const installedRevenue = monthCustomers
                .filter(c => c.status === '설치완료')
                .reduce((acc, c) => acc + (safeParseInt(c.agent_policy) * 10000), 0);

            const adSpend = safeParseInt(monthlyAdSpends[key] || 0);
            const rate = totalDB > 0 ? ((accepted / totalDB) * 100).toFixed(1) : 0;

            // 배열 앞쪽(위쪽)에 최신달이 오게 하려면 unshift, 과거순이면 push. 
            // 엑셀처럼 과거 -> 최신 순서라면 push 사용
            stats.push({
                monthName: `${m}월`, // 화면 표시용
                key: key,            // 데이터 저장 키 (YYYY-MM)
                totalDB,
                accepted,
                rate,
                acceptedRevenue,
                installedRevenue,
                adSpend
            });
        }
        // 최신 달이 위로 오게 하려면 아래 주석 해제 (.reverse())
        // return stats.reverse(); 
        return stats;
    }, [myAllCustomers, monthlyAdSpends]);


    // ⭐️ [통계] 데이터 가공 로직
    // ⭐️ [수정] 하단 통계 지표 (선택된 상담사 기준 계산)
    const dashboardStats = useMemo(() => {
        const currentStats = serverStats || [];

        // 🔴 [핵심 수정] 로그인한 사람이 아니라, '선택된 상담사' 기준으로 필터링
        let targetStats = currentStats;

        if (selectedStatAgent !== 'ALL') {
            // 특정 상담사를 선택했다면 그 사람 데이터만 남김
            targetStats = currentStats.filter(s => String(s.id) === String(selectedStatAgent));
        }

        // --- 이하 계산 로직은 기존과 동일 ---
        const totalDB = targetStats.reduce((acc, s) => acc + safeParseInt(s.db), 0);
        const acceptedCount = targetStats.reduce((acc, s) => acc + safeParseInt(s.accepted), 0);
        const acceptedRevenue = targetStats.reduce((acc, s) => acc + safeParseInt(s.acceptedRevenue), 0);
        const installedRevenue = targetStats.reduce((acc, s) => acc + safeParseInt(s.installedRevenue), 0);
        const installCount = targetStats.reduce((acc, s) => acc + safeParseInt(s.installed), 0);
        const cancelCount = targetStats.reduce((acc, s) => acc + safeParseInt(s.canceled), 0);

        // 🟢 서버에서 계산된 adSpend 사용
        const adSpend = targetStats.reduce((acc, s) => acc + safeParseInt(s.adSpend), 0);

        const netProfit = installedRevenue - adSpend;
        const acceptRate = totalDB > 0 ? ((acceptedCount / totalDB) * 100).toFixed(1) : 0;
        const cancelRate = (acceptedCount + cancelCount) > 0 ? ((cancelCount / (acceptedCount + cancelCount)) * 100).toFixed(1) : 0;

        return { totalDB, acceptedCount, acceptRate, acceptedRevenue, installedRevenue, installCount, cancelRate, netProfit, adSpend };
    }, [serverStats, selectedStatAgent]); // 👈 의존성 배열에 selectedStatAgent 추가됨

    // ⭐️ [수정] 통계 상세 테이블 데이터 (전체 상담사 표시)
    // ⭐️ [수정 1] 통계 상세 데이터 가공 (전체 상담사 표시로 변경)
    // ⭐️ [수정 1] 통계 상세 테이블 데이터 가공 (전체 상담사 표시로 변경)
    // ⭐️ [수정] 통계 상세 테이블 데이터 가공 (전체 상담사 표시 + 광고비 자동분배)
    const agentStats = useMemo(() => {
        if (!serverStats) return [];

        const currentMonthKey = statDate.substring(0, 7);
        // 월별 설정된 총 광고비 (없으면 0)
        const totalAdSpend = safeParseInt(monthlyAdSpends[currentMonthKey]);

        // 🔴 [핵심] 필터링 제거! (내 것만 보기 -> 전체 보기)
        const targetStats = serverStats.filter(s => s.id !== 'unknown');

        // 전체 DB 합계 계산 (광고비 분배 기준)
        const totalDBAllAgents = targetStats.reduce((acc, s) => acc + safeParseInt(s.db), 0);

        return targetStats.map(s => {
            const sTotalDB = safeParseInt(s.db);
            const sAccepted = safeParseInt(s.accepted);
            const sInstalled = safeParseInt(s.installed);
            const sCanceled = safeParseInt(s.canceled);
            const sAcceptedRev = safeParseInt(s.acceptedRevenue);
            const sInstalledRev = safeParseInt(s.installedRevenue);

            // 🟢 광고비 자동 분배 로직 (전체 DB 중 내 DB 비중 * 총 광고비)
            const adSpend = totalDBAllAgents > 0 ? Math.round(totalAdSpend * (sTotalDB / totalDBAllAgents)) : 0;

            const netProfit = sInstalledRev - adSpend;
            const acceptRate = sTotalDB > 0 ? ((sAccepted / sTotalDB) * 100).toFixed(1) : 0;
            const cancelRate = (sAccepted + sCanceled) > 0 ? ((sCanceled / (sAccepted + sCanceled)) * 100).toFixed(1) : 0;
            const netInstallRate = sAccepted > 0 ? ((sInstalled / sAccepted) * 100).toFixed(1) : 0;
            const avgMargin = sAccepted > 0 ? Math.round(sAcceptedRev / sAccepted) : 0;

            // 순이익율 계산
            const totalRevenue = sAcceptedRev + sInstalledRev;
            const netProfitMargin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : 0;

            const platformDetails = (s.platformDetails || []).map(p => {
                const pDB = safeParseInt(p.db);
                const pAccepted = safeParseInt(p.accepted);
                const pInstalled = safeParseInt(p.installed);
                const pCanceled = safeParseInt(p.canceled);
                const pAcceptedRev = safeParseInt(p.acceptedRevenue);
                const pInstalledRev = safeParseInt(p.installedRevenue);

                // 플랫폼별 광고비 분배
                const pAdSpend = sTotalDB > 0 ? Math.round(adSpend * (pDB / sTotalDB)) : 0;
                const pNetProfit = pInstalledRev - pAdSpend;

                const pAcceptRate = pDB > 0 ? ((pAccepted / pDB) * 100).toFixed(1) : 0;
                const pCancelRate = (pAccepted + pCanceled) > 0 ? ((pCanceled / (pAccepted + pCanceled)) * 100).toFixed(1) : 0;
                const pNetInstallRate = pAccepted > 0 ? ((pInstalled / pAccepted) * 100).toFixed(1) : 0;
                const pAvgMargin = pAccepted > 0 ? Math.round(pAcceptedRev / pAccepted) : 0;
                const pTotalRevenue = pAcceptedRev + pInstalledRev;
                const pNetProfitMargin = pTotalRevenue > 0 ? ((pNetProfit / pTotalRevenue) * 100).toFixed(1) : 0;

                return {
                    ...p,
                    adSpend: pAdSpend,
                    netProfit: pNetProfit,
                    acceptRate: pAcceptRate,
                    cancelRate: pCancelRate,
                    netInstallRate: pNetInstallRate,
                    avgMargin: pAvgMargin,
                    netProfitMargin: pNetProfitMargin
                };
            });

            return {
                ...s,
                db: sTotalDB, accepted: sAccepted, installed: sInstalled, canceled: sCanceled,
                acceptedRevenue: sAcceptedRev, installedRevenue: sInstalledRev,
                adSpend, netProfit, acceptRate, cancelRate, netInstallRate, avgMargin,
                netProfitMargin, platformDetails
            };
        });
    }, [serverStats, monthlyAdSpends, statDate, currentUserId]);


    // =========================================================================
    // 🎮 핸들러
    // =========================================================================
    const handleAssign = (id) => {
        if (window.confirm("담당하시겠습니까?")) {
            fetch(`${API_BASE}/api/customers/${id}/assign/`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ user_id: user.user_id })
            }).then(() => {
                alert("배정 완료!");
                loadCurrentTabData();
                setActiveTab('consult');
            });
        }
    };
    const getAgentName = (id) => { if (!id) return '-'; if (String(id) === String(currentUserId)) return '👤 나'; const agent = agents.find(a => String(a.id) === String(id)); return agent ? agent.username : '알수없음'; };
    const handleRestoreCustomer = (id) => { if (!window.confirm("복구하시겠습니까?")) return; handleInlineUpdate(id, 'status', '미통건'); };
    const handleDeleteCustomer = (id) => { if (window.confirm("삭제?")) fetch(`${API_BASE}/api/customers/${id}/`, { method: 'DELETE', headers: getAuthHeaders() }).then(() => loadCurrentTabData()); };
    const handleInlineUpdate = async (id, field, value) => { setAllCustomers(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c)); try { await fetch(`${API_BASE}/api/customers/${id}/`, { method: 'PATCH', headers: getAuthHeaders(), body: JSON.stringify({ [field]: value }) }); } catch (error) { alert("저장 실패"); loadCurrentTabData(); } };
    const handleAllocate = (refreshCallback) => { if (selectedIds.length === 0 || !targetAgentId) return alert("대상/상담사 선택"); if (!window.confirm("이동?")) return; fetch(`${API_BASE}/api/customers/allocate/`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ customer_ids: selectedIds, agent_id: targetAgentId }) }).then(res => res.json()).then(data => { alert(data.message); setSelectedIds([]); if (String(targetAgentId) === String(currentUserId)) { setActiveTab('consult'); } setTargetAgentId(''); if (typeof refreshCallback === 'function') refreshCallback(); else loadCurrentTabData(); }); };
    const handleSelectAll = (e) => { if (e.target.checked) setSelectedIds(displayedData.map(c => c.id)); else setSelectedIds([]); };
    const handleCheck = (id) => { if (selectedIds.includes(id)) setSelectedIds(selectedIds.filter(sid => sid !== id)); else setSelectedIds([...selectedIds, id]); };
    const openHistoryModal = (c) => { setSelectedCustomer(c); setNewLog(''); };
    const handleAdSpendChange = (value) => { const cleanValue = value.replace(/[^0-9]/g, ''); const currentMonthKey = statDate.substring(0, 7); setMonthlyAdSpends(prev => ({ ...prev, [currentMonthKey]: cleanValue })); setAdSpend(cleanValue); };
    const handleToggleAlarm = (e, customer) => { e.stopPropagation(); const currentList = parseChecklist(customer.checklist); const isAlarmOn = currentList.includes('알림ON'); const newList = isAlarmOn ? currentList.filter(item => item !== '알림ON') : [...currentList, '알림ON']; handleInlineUpdate(customer.id, 'checklist', newList.join(',')); };
    const handleCallbackChange = (customer, type, val) => { let current = customer.callback_schedule ? new Date(customer.callback_schedule) : new Date(); if (isNaN(current.getTime())) { current = new Date(); current.setHours(9, 0, 0, 0); } let y = current.getFullYear(); let m = current.getMonth() + 1; let d = current.getDate(); let h = current.getHours(); if (type === 'year') y = parseInt(val) || y; if (type === 'month') m = parseInt(val) || m; if (type === 'day') d = parseInt(val) || d; if (type === 'hour') h = parseInt(val) || h; const newDate = new Date(y, m - 1, d, h); const yy = newDate.getFullYear(); const mm = String(newDate.getMonth() + 1).padStart(2, '0'); const dd = String(newDate.getDate()).padStart(2, '0'); const hh = String(newDate.getHours()).padStart(2, '0'); handleInlineUpdate(customer.id, 'callback_schedule', `${yy}-${mm}-${dd}T${hh}:00:00`); };
    // 상태 변경 요청 핸들러
    // -----------------------------------------------------------
    // 1. 상태 변경 요청 핸들러 (수정됨: 함수 밖으로 로직 분리)
    // -----------------------------------------------------------
    const handleStatusChangeRequest = async (id, newStatus) => {
        // (1) 접수완료 처리
        if (newStatus === '접수완료') {
            const target = allCustomers.find(c => c.id === id);
            setCompletionTarget(target);
            setSelectedPlatform(target.platform || 'KT');
            setDynamicFormData({});
            setCalculatedPolicy(0);
            setShowCompletionModal(true);
            return;
        }

        // (2) 실패 처리 (모달 열기)
        else if (newStatus === '실패') {
            const target = allCustomers.find(c => c.id === id);
            setFailTarget(target);
            setSelectedFailReason('');
            setShowFailModal(true);
            return;
        }

        // (3) 실패이관 처리
        else if (newStatus === '실패이관') {
            try {
                await fetch(`${API_BASE}/api/customers/${id}/add_log/`, {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ user_id: user.user_id, content: `[시스템] 빠른 실패이관 처리` })
                });
                await fetch(`${API_BASE}/api/customers/${id}/`, {
                    method: 'PATCH',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ status: '실패이관', owner: null })
                });
                loadCurrentTabData();
                alert("실패 DB로 이관되었습니다.");
            } catch (err) { console.error(err); }
            return;
        }

        // (4) 그 외 상태 변경
        handleInlineUpdate(id, 'status', newStatus);
    };

    // -----------------------------------------------------------
    // 2. [추가됨] 실패 확정 핸들러 (반드시 handleStatusChangeRequest 밖, 메인 컴포넌트 바로 아래에 있어야 함)
    // -----------------------------------------------------------
    const handleConfirmFail = () => {
        if (!failTarget) return;
        if (!selectedFailReason) return alert("❌ 실패 사유를 선택해주세요.");

        fetch(`${API_BASE}/api/customers/${failTarget.id}/`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                status: '실패',
                detail_reason: selectedFailReason
            })
        })
            .then(() => {
                alert("처리되었습니다.");

                // 로컬 데이터 즉시 업데이트 (화면 갱신)
                setAllCustomers(prev => prev.map(c =>
                    c.id === failTarget.id
                        ? { ...c, status: '실패', detail_reason: selectedFailReason }
                        : c
                ));

                setShowFailModal(false);
                setFailTarget(null);

                // 실패 시 탭 이동을 원치 않으면 이 줄은 주석 유지
                // setActiveTab('issue_manage'); 
            })
            .catch(err => alert("오류 발생: " + err));
    };
    const handleFormDataChange = (key, value, optionPolicies = null) => { const newData = { ...dynamicFormData, [key]: value }; setDynamicFormData(newData); let totalPolicy = 0; if (optionPolicies && optionPolicies[value]) { const templates = config?.form_templates || []; const template = templates.find(t => t.name === selectedPlatform || t.id === selectedPlatform); if (template && template.fields) { template.fields.forEach(field => { const selectedVal = (field.id === key) ? value : newData[field.id]; if (selectedVal && field.policies && field.policies[selectedVal]) totalPolicy += field.policies[selectedVal]; }); } } else { const currentData = policyData[selectedPlatform]; if (currentData) { [...currentData.internet, ...currentData.bundle, ...currentData.addon].forEach(p => { if (p.name === value) totalPolicy += safeParseInt(p.policy || p.cost); }); } } if (totalPolicy > 0) setCalculatedPolicy(totalPolicy); };
    const handleConfirmCompletion = () => {
        if (!completionTarget) return;

        // 저장할 데이터 구성
        const finalProductInfo = `[${selectedPlatform}] ` + Object.entries(dynamicFormData).map(([k, v]) => `${k}:${v}`).join(', ');
        const payload = {
            status: '접수완료',
            platform: selectedPlatform,
            product_info: finalProductInfo,
            agent_policy: calculatedPolicy,
            installed_date: null
        };

        // 1. 서버 전송
        fetch(`${API_BASE}/api/customers/${completionTarget.id}/`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        })
            .then(() => {
                // 2. 로그 저장
                const logContent = `[시스템 자동접수]\n통신사: ${selectedPlatform}\n상품내역: ${finalProductInfo}\n예상 정책금: ${calculatedPolicy}만원`;
                return fetch(`${API_BASE}/api/customers/${completionTarget.id}/add_log/`, {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ user_id: user.user_id, content: logContent })
                });
            })
            .then(() => {
                alert("🎉 접수가 완료되었습니다!");

                // ⭐️ [핵심 수정] 로컬 데이터 즉시 업데이트 (이 코드가 있어야 화면에서 바로 사라짐)
                setAllCustomers(prev => prev.map(c =>
                    c.id === completionTarget.id
                        ? { ...c, ...payload } // 변경된 상태(접수완료)와 정보를 즉시 반영
                        : c
                ));

                setShowCompletionModal(false);
                setCompletionTarget(null);

                // 4. 탭 이동
                setActiveTab('reception');
            })
            .catch(err => alert("오류 발생: " + err));
    };
    const handleOpenChatGlobal = () => { setChatView('LIST'); setIsChatOpen(!isChatOpen); };
    const enterChatRoom = (c) => { setChatTarget(c); setChatView('ROOM'); setChatMessages([]); fetchChatHistory(c.id); };
    const backToChatList = () => { setChatView('LIST'); setChatTarget(null); setChatMessages([]); };
    const handleOpenChat = (e, c) => { e.stopPropagation(); e.preventDefault(); setChatTarget(c); setChatView('ROOM'); setIsChatOpen(true); fetchChatHistory(c.id); };
    const fetchChatHistory = async (cid) => { try { const res = await fetch(`${API_BASE}/api/sms/history/${cid}/`, { headers: getAuthHeaders() }); if (res.ok) setChatMessages(await res.json()); } catch { } };
    const handleSendManualChat = async () => { if (!chatInput?.trim() || !chatTarget) return; setIsSending(true); try { const res = await fetch(`${API_BASE}/api/sales/manual-sms/`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ customer_id: chatTarget.id, message: chatInput }) }); if (res.ok) { setChatInput(''); setChatMessages(prev => [...prev, { id: Date.now(), sender: 'me', text: chatInput, created_at: '방금 전' }]); } else alert("전송 실패"); } catch { alert("오류"); } finally { setIsSending(false); } };
    const handleAddMacro = () => { if (!newMacroText.trim()) return; setMacros(prev => ({ ...prev, [activeMacroTab]: [...(prev[activeMacroTab] || []), newMacroText.trim()] })); setNewMacroText(''); };
    const handleDeleteMacro = (idx) => { setMacros(prev => ({ ...prev, [activeMacroTab]: prev[activeMacroTab].filter((_, i) => i !== idx) })); };
    const handleMacroClick = (text) => { setChatInput(text); setShowMacro(false); };
    const renderInteractiveStars = (id, currentRank) => (<div className="flex cursor-pointer" onClick={(e) => e.stopPropagation()}>{[1, 2, 3, 4, 5].map(star => (<span key={star} className={`text-lg ${star <= currentRank ? 'text-yellow-400' : 'text-gray-300'} hover:scale-125 transition`} onClick={() => handleInlineUpdate(id, 'rank', star)}>★</span>))}</div>);
    const handleReferralSubmit = () => { if (!referralData.phone) return alert("번호 입력"); fetch(`${API_BASE}/api/customers/referral/`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ ...referralData, user_id: user.user_id }) }).then(async res => { if (res.ok) { alert("등록 완료"); setShowReferralModal(false); loadCurrentTabData(); setActiveTab('sales'); } }); };
    const handleColumnToggle = (col) => setVisibleColumns(prev => ({ ...prev, [col]: !prev[col] }));
    const handleCardToggle = (card) => setVisibleCards(prev => ({ ...prev, [card]: !prev[card] }));
    const toggleRow = (id) => { const newSet = new Set(expandedRows); if (newSet.has(id)) newSet.delete(id); else newSet.add(id); setExpandedRows(newSet); };

    // ⭐️ [대기 화면] 설정 로딩 중
    if (!config) {
        return (
            <div className="min-h-screen flex justify-center items-center bg-slate-50">
                <div className="flex flex-col items-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-indigo-500 mb-4"></div>
                    <p className="text-gray-500 font-bold">시스템 설정 로딩 중...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 text-gray-800 p-5 font-sans relative" onClick={() => setShowNotiDropdown(false)}>
            {/* ⭐️ [핵심] 스크롤바 숨김 CSS 적용 */}
            <style>{`
                .hide-scrollbar::-webkit-scrollbar { display: none; }
                .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                .no-spin::-webkit-inner-spin-button, .no-spin::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; } 
                .no-spin { -moz-appearance: textfield; } 
                .no-calendar::-webkit-calendar-picker-indicator { display: none !important; -webkit-appearance: none; }
            `}</style>

            {isLoading && (<div className="fixed inset-0 bg-white/70 z-[100] flex justify-center items-center backdrop-blur-[1px]"><div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-indigo-400"></div></div>)}

            <header className="sticky top-0 z-40 flex justify-between items-center bg-white p-4 rounded-xl shadow-sm mb-6 border border-gray-200">
                <h1 className="text-xl font-extrabold text-indigo-900 flex items-center gap-2 tracking-tight">📞 {user.username}님의 워크스페이스</h1>
                {/* ⭐️ [추가] 실시간 현황판 토글 */}
                <div className="flex items-center gap-6">
                    <button onClick={() => setIsTopStatsVisible(!isTopStatsVisible)} className={`text-xs font-bold px-3 py-1.5 rounded-full border transition ${isTopStatsVisible ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-200'}`}>📊 현황판 {isTopStatsVisible ? 'ON' : 'OFF'}</button>

                    {/* ⭐️ 상단 채팅 아이콘 */}
                    <div className="relative cursor-pointer" onClick={() => handleOpenChatGlobal()}>
                        <span className="text-2xl hover:scale-110 transition-transform">💬</span>
                    </div>

                    <div className="relative cursor-pointer" onClick={(e) => { e.stopPropagation(); setShowNotiDropdown(!showNotiDropdown); }}>
                        <span className="text-2xl text-gray-400 hover:text-yellow-500 transition">🔔</span>
                        {notifications.length > 0 && <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-bounce shadow-sm">{notifications.length}</span>}
                        {showNotiDropdown && (
                            <div className="absolute right-0 top-10 w-80 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden z-50">
                                <div className="bg-indigo-50 p-3 border-b border-gray-200 font-bold flex justify-between text-indigo-900"><span>⏰ 재통화 알림 ({notifications.length})</span><button className="text-xs text-gray-400 hover:text-gray-600" onClick={() => setShowNotiDropdown(false)}>닫기</button></div>
                                <div className="max-h-60 overflow-y-auto hide-scrollbar">
                                    {notifications.length === 0 ? <div className="p-4 text-center text-gray-400 text-sm">예정된 통화가 없습니다.</div> : notifications.map(n => (
                                        <div
                                            key={n.id}
                                            onClick={() => {
                                                const currentList = parseChecklist(n.checklist);
                                                const newList = currentList.filter(item => item !== '알림ON');
                                                handleInlineUpdate(n.id, 'checklist', newList.join(','));
                                                if (n.status === '장기가망') { setActiveTab('long_term'); } else { setActiveTab('consult'); }
                                                setStatusFilter('ALL');
                                                setSearchTerm(n.name);
                                                setShowNotiDropdown(false);
                                            }}
                                            className="p-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer flex justify-between items-center"
                                        >
                                            <div><div className="font-bold text-sm text-gray-800">{n.name}</div><div className="text-xs text-gray-500">{n.phone}</div></div>
                                            <div className="text-right"><span className={`text-[10px] ${getBadgeStyle(n.status)}`}>{n.status}</span><div className="text-xs text-gray-400 mt-1">{formatCallback(n.callback_schedule)}</div></div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => setShowReferralModal(true)} className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold transition flex items-center gap-2 shadow-sm">🤝 소개/지인 등록</button>
                        <button onClick={onLogout} className="bg-slate-400 hover:bg-slate-500 text-white px-4 py-2 rounded-lg font-bold transition shadow-sm">로그아웃</button>
                    </div>
                </div>
            </header>

            {/* ⭐️ [신규] 실시간 지표 대시보드 */}
            {/* ⭐️ [수정 2] 실시간 지표 대시보드 (최근 6개월 리스트 형태) */}
            {isTopStatsVisible && (
                <div className="mb-6 bg-white border border-gray-200 rounded-xl shadow-sm p-4 animate-fade-in-down">
                    <div className="flex justify-between items-end mb-3 border-b border-gray-100 pb-2">
                        <h2 className="text-sm font-extrabold text-gray-800 flex items-center gap-2">📊 월별 실적 현황 (최근 6개월)</h2>
                        <div className="text-[10px] text-gray-400">데이터 기준: 각 월별 등록된 DB</div>
                    </div>

                    {/* 7열 그리드 (월, 접수매출, 설치매출, 광고비, 접수율, 총DB, 총접수) */}
                    <div className="w-full text-sm text-center border border-gray-200 rounded-lg overflow-hidden">
                        {/* 헤더 (배경색 있음) */}
                        <div className="grid grid-cols-7 bg-gray-100 font-bold text-gray-600 text-xs uppercase">
                            <div className="p-2 border-r border-b border-gray-200">월</div>
                            <div className="p-2 border-r border-b border-gray-200 text-blue-600">접수 매출 (예상)</div>
                            <div className="p-2 border-r border-b border-gray-200 text-green-600">설치 매출 (확정)</div>
                            <div className="p-2 border-r border-b border-gray-200 text-red-500">광고비 (입력)</div>
                            <div className="p-2 border-r border-b border-gray-200">접수율</div>
                            <div className="p-2 border-r border-b border-gray-200">총 DB</div>
                            <div className="p-2 border-b border-gray-200">총 접수</div>
                        </div>

                        {/* 데이터 바디 (반복문) */}
                        {realTimeStats.map((stat, idx) => (
                            <div key={idx} className="grid grid-cols-7 hover:bg-gray-50 transition border-b last:border-b-0 border-gray-100 items-center">
                                <div className="p-3 font-bold text-gray-800 border-r border-gray-100">{stat.monthName}</div>
                                <div className="p-3 text-right font-bold text-blue-600 border-r border-gray-100">{formatCurrency(stat.acceptedRevenue)}원</div>
                                <div className="p-3 text-right font-bold text-green-600 border-r border-gray-100">{formatCurrency(stat.installedRevenue)}원</div>
                                <div className="p-3 text-right font-bold text-red-500 border-r border-gray-100 relative group">
                                    <input
                                        type="text"
                                        className="w-full text-right bg-transparent outline-none cursor-pointer hover:bg-red-50 focus:bg-red-50"
                                        value={stat.adSpend ? parseInt(stat.adSpend).toLocaleString() : ''}
                                        placeholder="0"
                                        onChange={(e) => {
                                            const val = e.target.value.replace(/[^0-9]/g, '');
                                            setMonthlyAdSpends(prev => ({ ...prev, [stat.key]: val }));
                                        }}
                                    />
                                </div>
                                <div className="p-3 font-bold text-indigo-600 border-r border-gray-100">{stat.rate}%</div>
                                <div className="p-3 border-r border-gray-100">{stat.totalDB}건</div>
                                <div className="p-3">{stat.accepted}건</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {isBannerVisible && todayIssues.length > 0 && (
                <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-r-xl shadow-md animate-pulse-slow flex items-start gap-4">
                    <div className="flex-shrink-0 flex items-center gap-2">
                        <span className="bg-red-600 text-white text-xs font-black px-2 py-1 rounded uppercase tracking-wider animate-pulse">🔥 TODAY ISSUES</span>
                        <span className="text-red-600 font-bold text-sm">오늘의 주요 이슈가 {todayIssues.length}건 있습니다!</span>
                    </div>
                    <div className="flex-1 flex flex-col gap-1">
                        {todayIssues.map((issue, idx) => (
                            <div key={issue.id} className="flex items-center gap-2 text-sm text-gray-800"><span className="text-red-400 font-bold">[{idx + 1}]</span><span className="font-bold cursor-pointer hover:underline hover:text-indigo-600" onClick={() => setActiveTab('policy')}>{issue.title}</span>{issue.is_important && <span className="text-[10px] bg-red-100 text-red-600 px-1 rounded font-bold">필독</span>}</div>
                        ))}
                    </div>
                    <button onClick={() => setIsBannerVisible(false)} className="text-gray-400 hover:text-gray-600 text-xs underline whitespace-nowrap">닫기</button>
                </div>
            )}

            <div className="sticky top-[80px] z-30 bg-slate-50 pb-1 flex justify-between items-end mb-4 border-b border-gray-200">
                <div className="flex gap-1 overflow-x-auto hide-scrollbar flex-wrap">
                    {['shared', 'consult', 'long_term', 'reception', 'installation', 'report', 'policy', 'notepad'].map(tab => (
                        <button key={tab} onClick={() => { setActiveTab(tab); setStatusFilter('ALL'); }} className={`px-4 py-2 rounded-t-lg text-[13px] font-bold transition whitespace-nowrap border-t border-l border-r ${activeTab === tab ? 'bg-white text-indigo-600 border-gray-200 border-b-white translate-y-[1px]' : 'bg-gray-100 text-gray-400 border-transparent hover:bg-gray-200'}`}>
                            {tab === 'shared' && `🛒 공유DB (${sharedCustomers.length})`}
                            {tab === 'consult' && `📞 상담관리 (${consultDB.length})`}
                            {tab === 'long_term' && `📅 가망관리`}
                            {tab === 'reception' && `📝 접수관리`}
                            {tab === 'installation' && `✅ 설치완료`}
                            {tab === 'report' && `📊 통계`}
                            {tab === 'policy' && `📢 정책/공지`}
                            {tab === 'notepad' && `📝 개인 메모장`}
                        </button>
                    ))}
                </div>
                {activeTab !== 'report' && activeTab !== 'notepad' && activeTab !== 'policy' && <input className="bg-white border border-gray-300 rounded-full px-4 py-2 text-gray-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition shadow-sm" placeholder="🔍 이름/번호 검색..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />}
            </div>

            <div className="bg-white rounded-xl shadow-lg min-h-[600px] border border-gray-200 p-6 overflow-hidden"> {/* overflow-x-auto -> overflow-hidden으로 변경 */}
                {/* ⭐️ [신규] 정책/공지사항 탭 */}
                {activeTab === 'policy' && (
                    <div className="flex gap-6 h-[750px] animate-fade-in">
                        <div className="w-1/3 flex flex-col h-full bg-white rounded-xl border border-gray-200 shadow-sm p-5"><h3 className="text-lg font-bold mb-4 text-indigo-900 border-b border-gray-100 pb-3">📢 공지사항</h3><div className="flex-1 overflow-y-auto pr-2 custom-scrollbar hide-scrollbar space-y-3">{notices.map(n => (<div key={n.id} className={`p-4 rounded-xl border relative group ${n.is_important ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200 hover:border-indigo-200'}`}><div className="flex items-center gap-2 mb-1">{n.is_important && <span className="text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded font-bold">중요</span>}<span className="font-bold text-sm text-gray-800">{n.title}</span></div><p className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed">{n.content}</p><div className="text-[10px] text-gray-400 mt-2 text-right">{n.created_at} · {n.writer_name}</div></div>))}</div></div>
                        <div className="flex-1 flex flex-col h-full bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"><div className="bg-gray-50 p-4 border-b border-gray-200 flex justify-between items-center"><div className="flex gap-2">{(config?.policy_tabs || ['KT', 'SK', 'LG']).map(p => (<button key={p} onClick={() => setActivePolicyTab(p)} className={`px-5 py-2 rounded-lg font-bold text-sm transition ${activePolicyTab === p ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-gray-500 border border-gray-300 hover:bg-gray-100'}`}>{p} 정책</button>))}</div></div>
                            <div className="flex-1 bg-slate-100 p-6 flex flex-col gap-4 overflow-auto hide-scrollbar">
                                {policyImages[activePolicyTab] ? (<img src={policyImages[activePolicyTab]} alt={`${activePolicyTab} 정책`} className="max-w-full rounded-lg shadow-md border border-gray-200 object-contain mb-4" />) : (<div className="text-gray-400 text-center p-10 bg-white rounded-lg border border-gray-200 mb-4"><p className="text-4xl mb-2">🖼️</p><p>현재 등록된 정책 이미지가 없습니다.</p></div>)}
                                <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm"><h4 className="font-bold text-indigo-800 mb-3 text-sm border-b pb-2">📋 {activePolicyTab} 정책표 (참고용)</h4><div className="grid grid-cols-3 gap-4">{['internet', 'bundle', 'addon'].map(cat => (<div key={cat} className="flex flex-col gap-2"><h5 className="font-bold text-xs text-gray-600 uppercase border-b border-gray-100 pb-1 mb-1">{cat === 'internet' ? '인터넷 단독' : cat === 'bundle' ? '인터넷+TV' : '추가상품'}</h5>{policyData[activePolicyTab]?.[cat]?.map((item, idx) => (<div key={idx} className="flex justify-between items-center text-xs bg-gray-50 p-2 rounded border border-gray-100"><span className="font-bold text-gray-700">{item.name}</span><span className="text-indigo-600 font-bold">{item.total || item.policy}</span></div>))}{(!policyData[activePolicyTab]?.[cat] || policyData[activePolicyTab][cat].length === 0) && <div className="text-[10px] text-gray-400 text-center py-2">데이터 없음</div>}</div>))}</div></div>
                            </div>
                        </div>
                    </div>
                )}

                {/* 5. 통계 탭 전체 영역 */}
                {activeTab === 'report' && dashboardStats && (
                    <div className="space-y-6 animate-fade-in">

                        {/* 🟢 (1) 상단 컨트롤 바: 날짜, 플랫폼, 상담사 선택, 설정 버튼 */}
                        <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-gray-50 rounded-xl border border-gray-200 shadow-sm">

                            {/* 왼쪽: 날짜 및 플랫폼 필터 */}
                            <div className="flex items-center gap-2">
                                <div className="flex bg-white rounded-lg border border-gray-300 overflow-hidden p-1">
                                    <button
                                        onClick={() => setStatPeriodType('month')}
                                        className={`px-3 py-1.5 text-xs font-bold rounded transition ${statPeriodType === 'month' ? 'bg-indigo-600 text-white' : 'hover:bg-gray-100'}`}
                                    >
                                        월별
                                    </button>
                                    <button
                                        onClick={() => { setStatPeriodType('day'); setStatDate(new Date().toISOString().split('T')[0]); }}
                                        className={`px-3 py-1.5 text-xs font-bold rounded transition ${statPeriodType === 'day' ? 'bg-indigo-600 text-white' : 'hover:bg-gray-100'}`}
                                    >
                                        일별
                                    </button>
                                </div>

                                <input
                                    type={statPeriodType === 'month' ? 'month' : 'date'}
                                    className="bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-sm font-bold text-gray-700 outline-none focus:border-indigo-500"
                                    value={statPeriodType === 'month' ? (statDate.length > 7 ? statDate.substring(0, 7) : statDate) : (statDate.length === 7 ? `${statDate}-01` : statDate)}
                                    onChange={(e) => setStatDate(e.target.value)}
                                />

                                <select
                                    className="bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-sm font-bold text-gray-700 outline-none focus:border-indigo-500"
                                    value={statPlatform}
                                    onChange={(e) => setStatPlatform(e.target.value)}
                                >
                                    <option value="ALL">전체 플랫폼</option>
                                    {config.report_platform_filters?.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                                </select>
                            </div>

                            {/* 🟢 오른쪽: 상담사 선택 (스크롤 박스) + 커스터마이징 버튼 */}
                            <div className="flex items-center gap-2">
                                <select
                                    className="bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-sm font-bold text-indigo-700 outline-none focus:border-indigo-500 shadow-sm cursor-pointer"
                                    value={selectedStatAgent}
                                    onChange={(e) => setSelectedStatAgent(e.target.value)}
                                >
                                    <option value="ALL">👥 전체 상담사 합계</option>
                                    {/* 미배정(unknown)을 제외한 상담사 목록 표시 */}
                                    {serverStats && serverStats.filter(s => s.id !== 'unknown').map(agent => (
                                        <option key={agent.id} value={agent.id}>
                                            {String(agent.id) === String(currentUserId) ? `👤 ${agent.name} (나)` : `👤 ${agent.name}`}
                                        </option>
                                    ))}
                                </select>

                                <button
                                    onClick={() => setShowCustomModal(true)}
                                    className="bg-white border border-gray-300 text-gray-500 p-1.5 rounded-lg hover:bg-gray-100 hover:text-indigo-600 transition shadow-sm"
                                    title="통계 화면 설정"
                                >
                                    ⚙️
                                </button>
                            </div>
                        </div>

                        {/* (2) 핵심 지표 카드 (dashboardStats 데이터 표시) */}
                        <div className="grid grid-cols-4 gap-4">
                            {visibleCards.totalDB && (
                                <div className="bg-white p-5 border border-gray-100 rounded-2xl shadow-sm flex flex-col justify-between">
                                    <div className="text-xs font-bold text-gray-500 mb-1">총 유입 DB</div>
                                    <div className="text-3xl font-extrabold text-gray-800">
                                        {dashboardStats.totalDB.toLocaleString()} <span className="text-sm font-normal text-gray-400">건</span>
                                    </div>
                                </div>
                            )}

                            {visibleCards.acceptedCount && (
                                <div className="bg-white p-5 border border-gray-100 rounded-2xl shadow-sm flex flex-col justify-between">
                                    <div className="text-xs font-bold text-indigo-500 mb-1">총 접수 건수</div>
                                    <div className="text-3xl font-extrabold text-indigo-600">
                                        {dashboardStats.acceptedCount.toLocaleString()} <span className="text-sm font-normal text-gray-400">건</span>
                                    </div>
                                </div>
                            )}

                            {visibleCards.installCount && (
                                <div className="bg-white p-5 border border-gray-100 rounded-2xl shadow-sm flex flex-col justify-between">
                                    <div className="text-xs font-bold text-green-500 mb-1">설치 완료</div>
                                    <div className="text-3xl font-extrabold text-green-600">
                                        {dashboardStats.installCount.toLocaleString()} <span className="text-sm font-normal text-gray-400">건</span>
                                    </div>
                                </div>
                            )}

                            {visibleCards.adSpend && (
                                <div className="bg-white p-5 border border-red-100 rounded-2xl shadow-sm flex flex-col justify-between">
                                    <div className="text-xs font-bold text-red-500 mb-1">광고비 (자동계산)</div>
                                    <div className="text-3xl font-extrabold text-red-600">
                                        {formatCurrency(dashboardStats.adSpend)} <span className="text-sm font-normal text-gray-400">원</span>
                                    </div>
                                </div>
                            )}

                            {visibleCards.acceptedRevenue && (
                                <div className="bg-white p-5 border border-gray-100 rounded-2xl shadow-sm flex flex-col justify-between">
                                    <div className="text-xs font-bold text-blue-500 mb-1">접수 매출 (예상)</div>
                                    <div className="text-2xl font-extrabold text-blue-600">
                                        {formatCurrency(dashboardStats.acceptedRevenue)} <span className="text-sm font-normal text-gray-400">원</span>
                                    </div>
                                </div>
                            )}

                            {visibleCards.installedRevenue && (
                                <div className="bg-white p-5 border border-gray-100 rounded-2xl shadow-sm flex flex-col justify-between">
                                    <div className="text-xs font-bold text-emerald-500 mb-1">설치 매출 (확정)</div>
                                    <div className="text-2xl font-extrabold text-emerald-600">
                                        {formatCurrency(dashboardStats.installedRevenue)} <span className="text-sm font-normal text-gray-400">원</span>
                                    </div>
                                </div>
                            )}

                            {visibleCards.netProfit && (
                                <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-5 rounded-2xl shadow-lg flex flex-col justify-between text-white">
                                    <div className="text-xs font-bold text-indigo-100 mb-1">최종 순수익 (매출-광고비)</div>
                                    <div className="text-3xl font-extrabold">
                                        {formatCurrency(dashboardStats.netProfit)} <span className="text-sm font-medium opacity-70">원</span>
                                    </div>
                                </div>
                            )}

                            {(visibleCards.cancelRate || visibleCards.netInstallRate) && (
                                <div className="bg-gray-50 p-5 rounded-2xl border border-gray-200 flex flex-col justify-around gap-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-bold text-gray-500">접수율</span>
                                        <span className="text-sm font-extrabold text-gray-800">{dashboardStats.acceptRate}%</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                                        <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${Math.min(dashboardStats.acceptRate, 100)}%` }}></div>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-bold text-gray-500">취소율</span>
                                        <span className="text-sm font-extrabold text-red-500">{dashboardStats.cancelRate}%</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                                        <div className="bg-red-500 h-1.5 rounded-full" style={{ width: `${Math.min(dashboardStats.cancelRate, 100)}%` }}></div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* (3) 상세 테이블 섹션 (전체 상담사 표시) */}
                        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-xs tracking-wider border-b border-slate-200 sticky top-0 z-10">
                                    <tr>
                                        <th className="px-4 py-3">담당자</th>
                                        <th className="px-4 py-3 text-right">디비</th>
                                        <th className="px-4 py-3 text-right text-blue-600">접수</th>
                                        <th className="px-4 py-3 text-right text-green-600">설치</th>
                                        <th className="px-4 py-3 text-right text-red-500">취소</th>
                                        <th className="px-4 py-3 text-right text-gray-500">광고비</th>
                                        <th className="px-4 py-3 text-right">접수매출</th>
                                        <th className="px-4 py-3 text-right">설치매출</th>
                                        <th className="px-4 py-3 text-right text-indigo-700 bg-indigo-50">순이익</th>
                                        <th className="px-4 py-3 text-right">접수율</th>
                                        <th className="px-4 py-3 text-right">취소율</th>
                                        <th className="px-4 py-3 text-right">순청약율</th>
                                        <th className="px-4 py-3 text-right">평균마진</th>
                                        <th className="px-4 py-3 text-right text-purple-600">순이익율</th>
                                        <th className="px-4 py-3 text-center">상세</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {agentStats.map(agent => (
                                        <React.Fragment key={agent.id}>
                                            <tr className="border-b border-slate-100 hover:bg-slate-50 transition duration-150 font-bold text-gray-800">
                                                <td className="px-4 py-3">
                                                    {String(agent.id) === String(currentUserId) ? `${agent.name} (나)` : agent.name}
                                                </td>
                                                <td className="px-4 py-3 text-right">{agent.db}</td>
                                                <td className="px-4 py-3 text-right text-blue-600">{agent.accepted}</td>
                                                <td className="px-4 py-3 text-right text-green-600">{agent.installed}</td>
                                                <td className="px-4 py-3 text-right text-red-500">{agent.canceled}</td>
                                                <td className="px-4 py-3 text-right text-red-400">{formatCurrency(agent.adSpend)}</td>
                                                <td className="px-4 py-3 text-right text-blue-500">{formatCurrency(agent.acceptedRevenue)}</td>
                                                <td className="px-4 py-3 text-right text-green-600">{formatCurrency(agent.installedRevenue)}</td>
                                                <td className="px-4 py-3 text-right text-indigo-700 bg-indigo-50">{formatCurrency(agent.netProfit)}</td>
                                                <td className="px-4 py-3 text-right">{agent.acceptRate}%</td>
                                                <td className="px-4 py-3 text-right">{agent.cancelRate}%</td>
                                                <td className="px-4 py-3 text-right">{agent.netInstallRate}%</td>
                                                <td className="px-4 py-3 text-right">{formatCurrency(agent.avgMargin)}</td>
                                                <td className="px-4 py-3 text-right text-purple-600">{agent.netProfitMargin}%</td>
                                                <td className="px-4 py-3 text-center">
                                                    <button onClick={() => toggleRow(agent.id)} className="text-xs bg-indigo-100 text-indigo-600 px-2 py-1 rounded hover:bg-indigo-200 transition">
                                                        {expandedRows.has(agent.id) ? '접기 ▲' : '플랫폼 ▼'}
                                                    </button>
                                                </td>
                                            </tr>
                                            {expandedRows.has(agent.id) && (
                                                <tr className="bg-gray-50">
                                                    <td colSpan="15" className="p-4">
                                                        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-inner">
                                                            <h4 className="text-xs font-bold text-gray-500 mb-2">📊 {agent.name}님 - 플랫폼별 상세</h4>
                                                            <table className="w-full text-xs text-gray-600">
                                                                <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-xs tracking-wider border-b border-slate-200">
                                                                    <tr>
                                                                        <th className="px-4 py-3">플랫폼</th>
                                                                        <th className="px-4 py-3 text-right">디비</th>
                                                                        <th className="px-4 py-3 text-right">접수</th>
                                                                        <th className="px-4 py-3 text-right">설치</th>
                                                                        <th className="px-4 py-3 text-right">취소</th>
                                                                        <th className="px-4 py-3 text-right">광고비</th>
                                                                        <th className="px-4 py-3 text-right">접수매출</th>
                                                                        <th className="px-4 py-3 text-right">설치매출</th>
                                                                        <th className="px-4 py-3 text-right bg-indigo-50 text-indigo-700 font-bold">순이익</th>
                                                                        <th className="px-4 py-3 text-right">접수율</th>
                                                                        <th className="px-4 py-3 text-right">취소율</th>
                                                                        <th className="px-4 py-3 text-right">순청약율</th>
                                                                        <th className="px-4 py-3 text-right">평균마진</th>
                                                                        <th className="px-4 py-3 text-right text-purple-600">순이익율</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-gray-100">
                                                                    {agent.platformDetails.map((pf, idx) => (
                                                                        <tr key={`${agent.id}-${idx}`} className="border-b border-slate-100 hover:bg-slate-50 transition duration-150">
                                                                            <td className="px-4 py-3 font-bold text-gray-700">{pf.name}</td>
                                                                            <td className="px-4 py-3 text-right">{pf.db}</td>
                                                                            <td className="px-4 py-3 text-right text-blue-600">{pf.accepted}</td>
                                                                            <td className="px-4 py-3 text-right text-green-600">{pf.installed}</td>
                                                                            <td className="px-4 py-3 text-right text-red-500">{pf.canceled}</td>
                                                                            <td className="px-4 py-3 text-right text-gray-400">{formatCurrency(pf.adSpend)}</td>
                                                                            <td className="px-4 py-3 text-right text-blue-500">{formatCurrency(pf.acceptedRevenue)}</td>
                                                                            <td className="px-4 py-3 text-right text-green-600">{formatCurrency(pf.installedRevenue)}</td>
                                                                            <td className="px-4 py-3 text-right text-indigo-700 font-bold bg-indigo-50">{formatCurrency(pf.netProfit)}</td>
                                                                            <td className="px-4 py-3 text-right">{pf.acceptRate}%</td>
                                                                            <td className="px-4 py-3 text-right">{pf.cancelRate}%</td>
                                                                            <td className="px-4 py-3 text-right">{pf.netInstallRate}%</td>
                                                                            <td className="px-4 py-3 text-right">{formatCurrency(pf.avgMargin)}</td>
                                                                            <td className="px-4 py-3 text-right text-purple-600">{pf.netProfitMargin}%</td>
                                                                        </tr>
                                                                    ))}
                                                                    {agent.platformDetails.length === 0 && (
                                                                        <tr><td colSpan="14" className="text-center py-4">데이터가 없습니다.</td></tr>
                                                                    )}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    ))}
                                    {agentStats.length === 0 && (
                                        <tr><td colSpan="15" className="p-10 text-center text-gray-400">데이터가 없습니다.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* 🟢 [수정됨] 통계 커스터마이징 모달 (사진과 동일한 UI) */}
                        {showCustomModal && (
                            <div className="fixed inset-0 bg-black/50 z-[9999] flex justify-center items-center backdrop-blur-sm animate-fade-in">
                                <div className="bg-white p-8 rounded-2xl shadow-2xl w-[800px] max-h-[90vh] overflow-y-auto border border-gray-200">

                                    {/* 헤더 */}
                                    <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
                                        <h3 className="font-extrabold text-2xl text-gray-800 flex items-center gap-2">
                                            ⚙️ 통계 화면 설정
                                        </h3>
                                        <button
                                            onClick={() => setShowCustomModal(false)}
                                            className="text-gray-400 hover:text-gray-600 transition text-2xl"
                                        >
                                            ✕
                                        </button>
                                    </div>

                                    {/* 1. 표시할 컬럼 설정 섹션 */}
                                    <div className="mb-8">
                                        <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                            👁 표시할 컬럼
                                        </h4>
                                        <div className="grid grid-cols-3 gap-3">
                                            {[
                                                { k: 'owner_name', l: '담당자' }, { k: 'db', l: '디비' }, { k: 'accepted', l: '접수' },
                                                { k: 'installed', l: '설치' }, { k: 'canceled', l: '취소' }, { k: 'adSpend', l: '광고비' },
                                                { k: 'acceptedRevenue', l: '접수매출' }, { k: 'installedRevenue', l: '설치매출' }, { k: 'netProfit', l: '순이익' },
                                                { k: 'acceptRate', l: '접수율' }, { k: 'cancelRate', l: '취소율' }, { k: 'netInstallRate', l: '순청약율' },
                                                { k: 'avgMargin', l: '평균마진' }, { k: 'netProfitMargin', l: '순이익율' } // 순이익율 추가됨
                                            ].map((item) => (
                                                <label
                                                    key={item.k}
                                                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition select-none
                                            ${visibleColumns[item.k]
                                                            ? 'bg-blue-50 border-blue-200 text-blue-700'
                                                            : 'bg-gray-50 border-transparent text-gray-500 hover:bg-gray-100'
                                                        }`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={visibleColumns[item.k] || false}
                                                        onChange={() => handleColumnToggle(item.k)}
                                                        className="w-5 h-5 accent-blue-600 rounded"
                                                    />
                                                    <span className="text-sm font-bold">{item.l}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    {/* 2. 표시할 지표 카드 설정 섹션 */}
                                    <div className="mb-6">
                                        <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                            📊 표시할 지표 카드
                                        </h4>
                                        <div className="grid grid-cols-2 gap-3">
                                            {[
                                                { k: 'adSpend', l: '💰 총 광고비' }, { k: 'acceptedRevenue', l: '📑 접수완료매출' },
                                                { k: 'installedRevenue', l: '✅ 설치완료매출' }, { k: 'netProfit', l: '🎯 순이익' },
                                                { k: 'totalDB', l: '📊 총 디비건수' }, { k: 'acceptedCount', l: '📝 접수건수' },
                                                { k: 'installCount', l: '✨ 설치건수' }, { k: 'acceptRate', l: '📈 접수율' },
                                                { k: 'cancelRate', l: '⚠️ 취소율' }, { k: 'netInstallRate', l: '🎉 순청약율' }
                                            ].map((item) => (
                                                <label
                                                    key={item.k}
                                                    className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition select-none
                                            ${visibleCards[item.k]
                                                            ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                                                            : 'bg-gray-50 border-transparent text-gray-500 hover:bg-gray-100'
                                                        }`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={visibleCards[item.k] || false}
                                                        onChange={() => handleCardToggle(item.k)}
                                                        className="w-5 h-5 accent-indigo-600 rounded"
                                                    />
                                                    <span className="text-sm font-bold">{item.l}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    {/* 하단 버튼 */}
                                    <div className="flex justify-end pt-6 border-t border-gray-100 mt-4">
                                        <button
                                            onClick={() => setShowCustomModal(false)}
                                            className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition shadow-lg flex items-center gap-2"
                                        >
                                            <span>설정 저장 및 닫기</span>
                                        </button>
                                    </div>

                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ⭐️ [수정됨] 개인 메모장 탭 (기능 복구) */}
                {activeTab === 'notepad' && (
                    <div className="h-full flex flex-col animate-fade-in">
                        <div className="flex justify-between items-center mb-4"><h2 className="text-xl font-bold flex items-center gap-2 text-indigo-800">📝 나만의 업무 노트 <span className="text-xs font-normal text-gray-400">(자동 저장됨)</span></h2></div>
                        <div className="flex-1 bg-yellow-50 rounded-xl border border-yellow-200 p-6 shadow-inner relative h-[600px]"><textarea className="w-full h-full bg-transparent outline-none resize-none text-gray-800 leading-relaxed text-base font-medium placeholder-yellow-400/50 focus:ring-0" placeholder="통화 중 필요한 메모나 할 일을 자유롭게 적어두세요..." value={notepadContent} onChange={handleNotepadChange} spellCheck="false" /></div>
                    </div>
                )}

                {/* ⭐️ 탭 컨텐츠 렌더링 (통계 제외한 모든 탭) */}
                {activeTab === 'shared' && (
                    <div className="animate-fade-in">
                        <div className="flex justify-between items-center mb-4"><h2 className="text-xl font-bold flex items-center gap-2 text-gray-800">🛒 미배정 DB 관리</h2><div className="flex gap-2"><button onClick={() => setViewDuplicatesOnly(!viewDuplicatesOnly)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border shadow-sm transition ${viewDuplicatesOnly ? 'bg-red-50 text-red-600 border-red-200' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>{viewDuplicatesOnly ? '✅ 전체 보기' : '🚫 중복 DB만 보기'}</button><button onClick={() => handleAllocate()} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-sm transition">일괄 배정</button></div></div>

                        <div className="flex gap-2 mb-4 animate-fade-in-down">
                            {SHARED_SUB_TABS.map(subTab => (
                                <button key={subTab.id} onClick={() => setSharedSubTab(subTab.id)} className={`px-4 py-1.5 rounded-full text-xs font-bold transition border ${sharedSubTab === subTab.id ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-gray-500 border-gray-200 hover:border-indigo-300 hover:text-indigo-500'}`}>{subTab.label}</button>
                            ))}
                        </div>

                        <div className="max-h-[600px] overflow-y-auto overflow-x-hidden hide-scrollbar border border-gray-200 rounded-lg"><table className="w-full text-left text-sm text-gray-700"><thead className="bg-slate-100 text-slate-600 font-bold uppercase text-xs tracking-wider border-b border-slate-200 sticky top-0 z-10"><tr><th className="px-4 py-3 w-10 text-center"><input type="checkbox" className="accent-indigo-600" onChange={handleSelectAll} checked={displayedData.length > 0 && selectedIds.length === displayedData.length} /></th><th className="px-4 py-3">날짜</th><th className="px-4 py-3">플랫폼</th><th className="px-4 py-3">이름</th><th className="px-4 py-3">번호</th><th className="px-4 py-3">광고비</th><th className="px-4 py-3">중복여부</th><th className="px-4 py-3">관리</th></tr></thead><tbody>{displayedData.map(c => {
                            const isDup = duplicateSet.has(c.phone); return (<tr key={c.id} className={`border-b border-slate-100 hover:bg-slate-50 transition duration-150 ${isDup ? 'bg-red-50' : ''}`}><td className="px-4 py-3 text-center"><input type="checkbox" className="accent-indigo-600" checked={selectedIds.includes(c.id)} onChange={() => handleCheck(c.id)} /></td><td className="px-4 py-3 text-gray-500">{c.upload_date}</td><td className="px-4 py-3"><span className="bg-gray-100 border border-gray-200 px-2 py-1 rounded text-xs text-gray-600">{c.platform}</span></td><td className="px-4 py-3 font-bold">{c.name}</td><td className="px-4 py-3 text-gray-500">{c.phone}</td><td className="px-4 py-3 font-bold text-gray-600">{(c.ad_cost || 0).toLocaleString()}</td><td className="px-4 py-3">{isDup && <span className="bg-red-100 text-red-600 border border-red-200 px-2 py-0.5 rounded text-xs font-bold">중복됨</span>}</td>
                                <td className="px-4 py-3 flex gap-2">
                                    <button onClick={() => handleAssign(c.id)} className="bg-emerald-500 hover:bg-emerald-600 text-white px-2 py-1 rounded text-xs font-bold shadow-sm transition">⚡ 가져가기</button>
                                </td></tr>);
                        })}</tbody></table></div>
                    </div>
                )}

                {(activeTab === 'consult' || activeTab === 'long_term') && (
                    <div className="animate-fade-in">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold flex items-center gap-2 text-indigo-800">
                                {activeTab === 'consult' ? '📞 내 상담 리스트' : '📅 내 장기 가망 리스트'}
                            </h2>
                            {activeTab === 'consult' && (
                                <div className="flex gap-2">
                                    {QUICK_FILTERS.map(filter => (<button key={filter} onClick={() => setStatusFilter(filter)} className={`px-3 py-1 rounded-full text-xs font-bold transition border ${statusFilter === filter ? 'bg-indigo-600 text-white' : 'bg-white text-gray-500'}`}>{filter}</button>))}
                                </div>
                            )}
                        </div>
                        <div className="overflow-hidden border border-gray-200 rounded-lg">
                            <table className="w-full text-left border-collapse table-fixed">
                                <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-xs tracking-wider border-b border-slate-200 sticky top-0 z-10">
                                    <tr>
                                        <th className="px-4 py-3 w-16 text-center">번호</th><th className="px-4 py-3 w-24">플랫폼</th><th className="px-4 py-3 w-28">등록일</th><th className="px-4 py-3 w-28">이름</th><th className="px-4 py-3 w-40">연락처</th><th className="px-4 py-3 w-56 text-indigo-700">재통화(년/월/일/시)</th><th className="px-4 py-3 w-28">상태</th><th className="px-4 py-3">상담 메모</th>
                                        {/* ⭐️ 채팅 버튼 컬럼 추가 */}
                                        <th className="px-4 py-3 w-12 text-center">채팅</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm text-gray-700">
                                    {displayedData.map(c => {
                                        const scheduleDate = c.callback_schedule ? new Date(c.callback_schedule) : new Date();
                                        const currentY = isNaN(scheduleDate.getTime()) ? '' : scheduleDate.getFullYear();
                                        const currentM = isNaN(scheduleDate.getTime()) ? '' : scheduleDate.getMonth() + 1;
                                        const currentD = isNaN(scheduleDate.getTime()) ? '' : scheduleDate.getDate();
                                        const currentH = isNaN(scheduleDate.getTime()) ? '' : scheduleDate.getHours();
                                        const checklistItems = parseChecklist(c.checklist);
                                        const isAlarmOn = checklistItems.includes('알림ON');

                                        return (
                                            <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50 transition duration-150">
                                                <td className="px-4 py-3 text-center text-gray-400">{c.id}</td>
                                                <td className="px-4 py-3"><span className="bg-gray-100 px-2 py-1 rounded text-xs border">{c.platform}</span></td>
                                                <td className="px-4 py-3 text-gray-500">{c.upload_date}</td>
                                                <td className="px-4 py-3 font-bold">
                                                    <div className="flex items-center gap-2">{c.name}<button onClick={(e) => handleToggleAlarm(e, c)} className={`text-sm transition-transform active:scale-95 ${isAlarmOn ? 'opacity-100' : 'opacity-30 hover:opacity-70'}`} title={isAlarmOn ? "알림 켜짐" : "알림 꺼짐"}>{isAlarmOn ? '🔔' : '🔕'}</button></div>
                                                    <div className="mt-1">{renderInteractiveStars(c.id, c.rank)}</div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    {/* ⭐️ SMS 전송 버튼 추가 */}
                                                    <div>{c.phone}</div>
                                                    <div className="mt-1">
                                                        <button
                                                            onClick={(e) => handleOpenChat(e, c)}
                                                            className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded border border-indigo-100 hover:bg-indigo-100 transition flex items-center gap-1 w-fit"
                                                        >
                                                            <span>💬</span> SMS전송
                                                        </button>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex flex-col gap-1">
                                                        <div className="flex items-center gap-1">
                                                            <input type="text" className="w-9 text-center bg-transparent border-b border-gray-300 focus:border-indigo-500 outline-none text-xs font-mono" placeholder="YYYY" defaultValue={currentY} onBlur={(e) => handleCallbackChange(c, 'year', e.target.value)} /><span className="text-gray-300 text-[10px]">-</span><input type="text" className="w-5 text-center bg-transparent border-b border-gray-300 focus:border-indigo-500 outline-none text-xs font-mono" placeholder="MM" defaultValue={currentM} onBlur={(e) => handleCallbackChange(c, 'month', e.target.value)} /><span className="text-gray-300 text-[10px]">-</span><input type="text" className="w-5 text-center bg-transparent border-b border-gray-300 focus:border-indigo-500 outline-none text-xs font-mono" placeholder="DD" defaultValue={currentD} onBlur={(e) => handleCallbackChange(c, 'day', e.target.value)} />
                                                        </div>
                                                        <select className="w-full bg-white border border-gray-200 rounded p-1 text-xs outline-none focus:border-indigo-500" value={currentH || ""} onChange={(e) => handleCallbackChange(c, 'hour', e.target.value)}>
                                                            <option value="" disabled>시간</option>
                                                            {TIME_OPTIONS.map(h => <option key={h} value={h}>{h}시</option>)}
                                                        </select>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <select className={`w-full p-2 rounded text-xs font-bold outline-none ${getBadgeStyle(c.status)}`} value={c.status} onChange={(e) => handleStatusChangeRequest(c.id, e.target.value)}>
                                                        {STATUS_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                                    </select>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <textarea className="w-full bg-transparent border border-transparent hover:border-gray-300 focus:border-indigo-500 rounded p-1 outline-none text-sm transition resize-none leading-relaxed" rows={1} style={{ minHeight: '1.5rem', height: 'auto' }} defaultValue={c.last_memo} onInput={autoResizeTextarea} onBlur={(e) => handleInlineUpdate(c.id, 'last_memo', e.target.value)} placeholder="내용 입력..." />
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {displayedData.length === 0 && <tr><td colSpan="8" className="p-10 text-center text-gray-400">데이터가 없습니다.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* [⭐️ 신규] AS/실패 관리 탭 */}
                {activeTab === 'issue_manage' && (
                    <div className="animate-fade-in">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold flex items-center gap-2 text-gray-800">🛠 AS 및 실패 리드 관리</h2>
                            <div className="flex gap-2">
                                <button onClick={() => setIssueSubTab('fail')} className={`px-4 py-2 rounded-lg text-sm font-bold border transition ${issueSubTab === 'fail' ? 'bg-red-500 text-white border-red-500 shadow-md' : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-50'}`}>🚫 실패 목록</button>
                                <button onClick={() => setIssueSubTab('as')} className={`px-4 py-2 rounded-lg text-sm font-bold border transition ${issueSubTab === 'as' ? 'bg-orange-500 text-white border-orange-500 shadow-md' : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-50'}`}>🆘 AS 요청</button>
                            </div>
                        </div>

                        <div className="max-h-[600px] overflow-y-auto overflow-x-hidden hide-scrollbar border border-gray-200 rounded-lg">
                            <table className="w-full text-left text-sm text-gray-700">
                                <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-xs tracking-wider border-b border-slate-200 sticky top-0 z-10">
                                    <tr>
                                        <th className="px-4 py-3 w-10 text-center"><input type="checkbox" className="accent-indigo-600" onChange={(e) => handleSelectAll(e)} checked={displayedData.length > 0 && selectedIds.length === displayedData.length} /></th>
                                        <th className="px-4 py-3">날짜</th>
                                        <th className="px-4 py-3 text-indigo-600">담당자</th>
                                        <th className="px-4 py-3">고객명</th>
                                        <th className="px-4 py-3">연락처</th>
                                        <th className="px-4 py-3">플랫폼</th>
                                        <th className="px-4 py-3">{issueSubTab === 'fail' ? '실패 사유' : 'AS 내용'}</th>
                                        <th className="px-4 py-3">관리</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {displayedData.map(c => (
                                        <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50 transition duration-150">
                                            <td className="px-4 py-3 text-center"><input type="checkbox" className="accent-indigo-600" checked={selectedIds.includes(c.id)} onChange={() => handleCheck(c.id)} /></td>
                                            <td className="px-4 py-3 text-gray-500">{c.upload_date}</td>
                                            <td className="px-4 py-3 font-bold text-indigo-600">{getAgentName(c.owner)}</td>
                                            <td className="px-4 py-3 font-bold">{c.name}</td>
                                            <td className="px-4 py-3 text-gray-500">{c.phone}</td>
                                            <td className="px-4 py-3"><span className="bg-gray-100 border border-gray-200 px-2 py-1 rounded text-xs text-gray-600">{c.platform}</span></td>
                                            <td className="px-4 py-3">
                                                {issueSubTab === 'fail'
                                                    ? <span className="bg-red-50 text-red-600 px-2 py-1 rounded text-xs border border-red-200 font-bold">{c.detail_reason || '사유 없음'}</span>
                                                    : <span className="text-orange-600 font-medium">{c.last_memo}</span>
                                                }
                                            </td>
                                            <td className="px-4 py-3 flex gap-2">
                                                <button onClick={() => handleRestoreCustomer(c.id)} className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold hover:bg-blue-200 transition">♻️ 복구</button>
                                                <button onClick={() => handleDeleteCustomer(c.id)} className="text-red-500 hover:text-red-700 font-bold text-xs border border-red-100 px-2 py-1 rounded hover:bg-red-50 transition">삭제</button>
                                            </td>
                                        </tr>
                                    ))}
                                    {displayedData.length === 0 && <tr><td colSpan="8" className="p-10 text-center text-gray-400">데이터가 없습니다.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'reception' && (
                    <div className="animate-fade-in">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold flex items-center gap-2 text-gray-800">📝 내 접수 현황 <span className="text-sm font-normal text-gray-400">(상태: 접수완료)</span></h2>
                        </div>
                        <div className="max-h-[600px] overflow-y-auto overflow-x-hidden hide-scrollbar border border-gray-200 rounded-lg">
                            <table className="w-full text-left text-sm text-gray-700">
                                {/* 🔹 [수정 1] 헤더: 줄바꿈 방지(whitespace-nowrap) 및 컬럼 순서 변경 */}
                                <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-xs tracking-wider border-b border-slate-200 sticky top-0 z-10 whitespace-nowrap">
                                    <tr>
                                        <th className="px-4 py-3">접수 날짜</th>
                                        <th className="px-4 py-3">플랫폼</th>
                                        <th className="px-4 py-3">이름</th>
                                        <th className="px-4 py-3">휴대폰 번호</th>
                                        <th className="px-4 py-3 text-center">정책</th>
                                        <th className="px-4 py-3 text-center">지원금</th>
                                        <th className="px-4 py-3 text-center">상태값</th>
                                        <th className="px-4 py-3">가입상품</th>
                                        <th className="px-4 py-3">상담이력</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {displayedData.map(c => (
                                        <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50 transition duration-150">
                                            {/* 1. 접수 날짜 */}
                                            <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{c.upload_date}</td>

                                            {/* 2. 플랫폼 */}
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <span className="bg-white border border-gray-200 px-2 py-1 rounded text-xs text-gray-600">{c.platform}</span>
                                            </td>

                                            {/* 3. 이름 */}
                                            <td className="px-4 py-3 font-bold whitespace-nowrap">{c.name}</td>

                                            {/* 4. 휴대폰 번호 */}
                                            <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{c.phone}</td>

                                            {/* 5. 정책 (스핀박스 제거, 0,000 형식, 글자 제외) */}
                                            <td className="px-4 py-3 text-center">
                                                <input
                                                    type="text"
                                                    className="w-24 bg-transparent text-right font-bold outline-none border border-transparent hover:border-gray-300 focus:border-indigo-500 rounded px-1"
                                                    placeholder="0"
                                                    // 숫자에 쉼표를 넣어 보여줌
                                                    value={c.agent_policy ? Number(c.agent_policy).toLocaleString() : ''}
                                                    // 입력 시 쉼표를 제거하고 숫자만 저장
                                                    onChange={(e) => {
                                                        const val = e.target.value.replace(/[^0-9]/g, '');
                                                        handleInlineUpdate(c.id, 'agent_policy', val);
                                                    }}
                                                />
                                            </td>

                                            {/* 6. 지원금 (스핀박스 제거, 0,000 형식, 글자 제외) */}
                                            <td className="px-4 py-3 text-center">
                                                <input
                                                    type="text"
                                                    className="w-24 bg-transparent text-right font-bold outline-none border border-transparent hover:border-gray-300 focus:border-indigo-500 rounded px-1"
                                                    placeholder="0"
                                                    value={c.support_amt ? Number(c.support_amt).toLocaleString() : ''}
                                                    onChange={(e) => {
                                                        const val = e.target.value.replace(/[^0-9]/g, '');
                                                        handleInlineUpdate(c.id, 'support_amt', val);
                                                    }}
                                                />
                                            </td>

                                            {/* 7. 상태값 */}
                                            <td className="px-4 py-3 text-center">
                                                <select
                                                    className="bg-white border border-gray-300 rounded text-xs p-1.5 text-gray-700 font-bold outline-none focus:border-indigo-500 cursor-pointer"
                                                    value={c.status}
                                                    onChange={(e) => {
                                                        const newVal = e.target.value;
                                                        if (newVal === '접수취소') {
                                                            // ⭐️ 접수 취소 선택 시 알림 후 '미통건'으로 상태 변경 -> 상담탭으로 이동됨
                                                            if (window.confirm("접수를 취소하고 상담 목록(미통건)으로 되돌리겠습니까?")) {
                                                                handleInlineUpdate(c.id, 'status', '미통건');
                                                            }
                                                        } else {
                                                            // 그 외(설치완료 등)는 선택한 값 그대로 반영
                                                            handleInlineUpdate(c.id, 'status', newVal);
                                                        }
                                                    }}
                                                >
                                                    <option value="접수완료">접수완료</option>
                                                    <option value="설치완료">✅ 설치완료</option>
                                                    <option value="접수취소">🚫 접수취소 (상담이동)</option>
                                                </select>
                                            </td>

                                            {/* 8. 가입상품 */}
                                            <td className="px-4 py-3 text-xs text-gray-600 truncate max-w-[150px]" title={c.product_info}>
                                                {c.product_info || '-'}
                                            </td>

                                            {/* 9. 상담이력 (메모) */}
                                            <td className="px-4 py-3">
                                                <textarea
                                                    className="w-full bg-transparent border border-transparent hover:border-gray-300 focus:border-indigo-500 rounded p-1 outline-none text-sm transition resize-none leading-relaxed"
                                                    rows={1}
                                                    style={{ minHeight: '1.5rem', height: 'auto', width: '150px' }}
                                                    defaultValue={c.last_memo}
                                                    onInput={autoResizeTextarea}
                                                    onBlur={(e) => handleInlineUpdate(c.id, 'last_memo', e.target.value)}
                                                    placeholder="메모..."
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                    {displayedData.length === 0 && <tr><td colSpan="9" className="p-10 text-center text-gray-400">접수완료된 건이 없습니다.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'installation' && (
                    <div className="animate-fade-in">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold flex items-center gap-2 text-gray-800">✅ 설치 완료 목록 <span className="text-sm font-normal text-gray-400">(현황 확인용)</span></h2>
                        </div>
                        <div className="max-h-[600px] overflow-y-auto overflow-x-hidden hide-scrollbar border border-gray-200 rounded-lg">
                            <table className="w-full text-left text-sm text-gray-700">
                                <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-xs tracking-wider border-b border-slate-200 sticky top-0 z-10 whitespace-nowrap">
                                    <tr>
                                        <th className="px-4 py-3">접수일</th>
                                        <th className="px-4 py-3">이름</th>
                                        <th className="px-4 py-3">연락처</th>
                                        <th className="px-4 py-3">상품</th>
                                        <th className="px-4 py-3">설치일(수정)</th>
                                        <th className="px-4 py-3">상태</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {displayedData.map(c => (
                                        <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50 transition duration-150">
                                            {/* 1. 접수일 */}
                                            <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{c.upload_date}</td>

                                            {/* 2. 이름 */}
                                            <td className="px-4 py-3 font-bold whitespace-nowrap">{c.name}</td>

                                            {/* 3. 연락처 */}
                                            <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{c.phone}</td>

                                            {/* 4. 상품 */}
                                            <td className="px-4 py-3 text-gray-600 truncate max-w-[200px]" title={c.product_info}>
                                                {c.product_info || '-'}
                                            </td>

                                            {/* 5. 설치날짜 */}
                                            <td className="px-4 py-3">
                                                <input
                                                    type="date"
                                                    className="bg-transparent text-blue-600 font-bold text-sm outline-none border border-transparent hover:border-gray-300 focus:border-indigo-500 rounded px-1 cursor-pointer no-calendar"
                                                    value={c.installed_date || ''}
                                                    onChange={(e) => handleInlineUpdate(c.id, 'installed_date', e.target.value)}
                                                />
                                            </td>

                                            <td className="px-4 py-3">
                                                <select
                                                    className="bg-white border border-gray-300 rounded text-xs p-1.5 text-gray-700 font-bold outline-none focus:border-indigo-500 cursor-pointer"
                                                    value={c.status}
                                                    onChange={(e) => handleInlineUpdate(c.id, 'status', e.target.value)}
                                                >
                                                    <option value="설치완료">✅ 설치완료</option>
                                                    <option value="접수완료">↩️ 접수완료(되돌리기)</option>
                                                    <option value="해지진행">⚠️ 해지진행</option>
                                                    <option value="접수취소">🚫 접수취소</option>
                                                </select>
                                            </td>
                                        </tr>
                                    ))}
                                    {displayedData.length === 0 && <tr><td colSpan="6" className="p-10 text-center text-gray-400">설치 완료된 건이 없습니다.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {showCompletionModal && completionTarget && (<PopoutWindow title={`[접수완료] ${completionTarget.name} 고객님`} onClose={() => setShowCompletionModal(false)}><div className="bg-white h-full w-full flex flex-col font-sans"><div className="bg-indigo-600 p-4 flex justify-between items-center shrink-0"><h2 className="text-xl font-bold text-white flex items-center gap-2">📝 접수 완료 처리</h2><div className="text-indigo-200 text-sm">독립 윈도우 모드</div></div><div className="p-6 grid grid-cols-2 gap-8 flex-1 overflow-y-auto"><div className="flex flex-col gap-4 border-r border-gray-100 pr-6"><div><label className="block text-sm font-bold text-gray-700 mb-2">통신사 선택</label><div className="flex gap-2 overflow-x-auto pb-2">{Object.keys(policyData).map((pName) => (<button key={pName} onClick={() => { setSelectedPlatform(pName); setDynamicFormData({}); setCalculatedPolicy(0); }} className={`flex-1 py-3 px-2 rounded-xl font-bold border transition shadow-sm whitespace-nowrap ${selectedPlatform === pName ? 'bg-indigo-600 text-white border-indigo-600 ring-2 ring-indigo-200' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>{pName}</button>))}</div></div><div className="bg-blue-50 p-4 rounded-xl border border-blue-100"><h3 className="font-bold text-blue-800 mb-2 text-sm">💡 고객 기본 정보</h3><div className="text-sm text-gray-600 space-y-1"><p><span className="w-16 inline-block font-bold">이름:</span> {completionTarget.name}</p><p><span className="w-16 inline-block font-bold">연락처:</span> {completionTarget.phone}</p></div></div><div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100 text-center"><p className="text-xs text-yellow-700 font-bold mb-1">예상 정책금 (자동계산)</p><p className="text-3xl font-extrabold text-yellow-600">{calculatedPolicy} <span className="text-base text-yellow-500">만원</span></p></div></div><div className="flex flex-col h-full"><label className="block text-sm font-bold text-gray-700 mb-2">상품 상세 선택</label><div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-4">
                {/* ⭐️ 정책 데이터 기반 렌더링 */}
                <div className="space-y-4">
                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                        <label className="block text-xs font-bold text-gray-600 mb-2">인터넷 상품</label>
                        <select className="w-full bg-white border border-gray-300 rounded-lg p-2 text-sm focus:border-indigo-500 outline-none" onChange={e => handleFormDataChange('internet', e.target.value)}>
                            <option value="">선택하세요</option>
                            {policyData[selectedPlatform]?.internet.map(p => <option key={p.id} value={p.name}>{p.name} ({p.policy}만)</option>)}
                        </select>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                        <label className="block text-xs font-bold text-gray-600 mb-2">번들 상품</label>
                        <select className="w-full bg-white border border-gray-300 rounded-lg p-2 text-sm focus:border-indigo-500 outline-none" onChange={e => handleFormDataChange('bundle', e.target.value)}>
                            <option value="">선택하세요</option>
                            {policyData[selectedPlatform]?.bundle.map(p => <option key={p.id} value={p.name}>{p.name} ({p.policy}만)</option>)}
                        </select>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                        <label className="block text-xs font-bold text-gray-600 mb-2">추가 상품 (비용)</label>
                        <div className="flex flex-wrap gap-2">
                            {policyData[selectedPlatform]?.addon.map(p => (
                                <label key={p.id} className="flex items-center gap-1 cursor-pointer bg-white px-3 py-1.5 rounded border border-gray-200 hover:border-indigo-300 transition">
                                    <input type="checkbox" className="accent-indigo-600" onChange={(e) => handleFormDataChange(p.name, e.target.checked ? p.name : '')} />
                                    <span className="text-xs">{p.name}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                        <label className="block text-xs font-bold text-gray-600 mb-2">사은품 메모</label>
                        <input className="w-full bg-white border border-gray-300 rounded-lg p-2 text-sm focus:border-indigo-500 outline-none" onChange={e => handleFormDataChange('gift', e.target.value)} />
                    </div>
                </div>
            </div></div></div><div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3 shrink-0"><button onClick={() => setShowCompletionModal(false)} className="px-6 py-3 rounded-xl bg-white border border-gray-300 text-gray-600 font-bold hover:bg-gray-100 transition">취소</button><button onClick={handleConfirmCompletion} className="px-8 py-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow-lg transition flex items-center gap-2"><span>✅ 접수 완료 및 이력 저장</span></button></div></div></PopoutWindow>)}
            {/* ⭐️ [복구] 채팅창 (Floating Panel + Macro) */}
            {isChatOpen && (
                <div className="fixed bottom-4 right-4 w-96 h-[600px] bg-white shadow-2xl rounded-2xl border border-gray-200 z-50 flex flex-col overflow-hidden animate-fade-in-up">
                    <div className="bg-indigo-600 p-4 flex justify-between items-center text-white shrink-0">
                        <div className="flex flex-col">
                            <span className="font-bold text-lg">{chatView === 'LIST' ? '💬 상담 채팅 목록' : chatTarget?.name}</span>
                            {chatView === 'ROOM' && <span className="text-xs opacity-80">{chatTarget?.phone}</span>}
                        </div>
                        <div className="flex gap-2">
                            {chatView === 'ROOM' && <button onClick={() => setShowMacro(!showMacro)} className="text-white hover:bg-white/20 rounded p-1 text-xs">문구</button>}
                            <button onClick={() => setIsChatOpen(false)} className="text-white hover:bg-white/20 rounded-full p-1 transition">✕</button>
                        </div>
                    </div>

                    {chatView === 'LIST' ? (
                        <div className="flex-1 flex flex-col bg-gray-50">
                            <div className="p-3 border-b border-gray-200 bg-white">
                                <input type="text" placeholder="이름 또는 번호 검색..." className="w-full bg-gray-100 rounded-lg px-3 py-2 text-sm outline-none" value={chatListSearch} onChange={(e) => setChatListSearch(e.target.value)} />
                            </div>
                            <div className="flex-1 overflow-y-auto custom-scrollbar hide-scrollbar">
                                {chatListCustomers.map(c => (
                                    <div key={c.id} onClick={() => enterChatRoom(c)} className="p-4 border-b border-gray-100 hover:bg-white cursor-pointer transition flex justify-between items-center">
                                        <div>
                                            <div className="font-bold text-gray-800">{c.name}</div>
                                            <div className="text-xs text-gray-500">{c.phone}</div>
                                        </div>
                                        <div className="text-right">
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${getBadgeStyle(c.status)}`}>{c.status}</span>
                                            <div className="text-[10px] text-gray-400 mt-1">{c.last_memo ? '메모 있음' : ''}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col bg-gray-50 relative">
                            {/* 매크로 패널 (슬라이드 오버) */}
                            {showMacro && (
                                <div className="absolute top-0 right-0 w-64 h-full bg-white shadow-xl border-l border-gray-200 z-10 flex flex-col animate-slide-in-right">
                                    <div className="flex border-b border-gray-200">
                                        {['공통', 'KT', 'SK', 'LG'].map(tab => (
                                            <button key={tab} onClick={() => setActiveMacroTab(tab)} className={`flex-1 py-2 text-[10px] font-bold ${activeMacroTab === tab ? 'bg-indigo-50 text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:bg-gray-50'}`}>{tab}</button>
                                        ))}
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-2 hide-scrollbar">
                                        {macros[activeMacroTab]?.map((text, i) => (
                                            <div key={i} className="group flex items-center justify-between p-2 hover:bg-gray-100 rounded cursor-pointer border-b border-gray-50">
                                                <span className="text-xs text-gray-700 truncate w-40" onClick={() => handleMacroClick(text)}>{text}</span>
                                                <button onClick={() => handleDeleteMacro(i)} className="text-red-300 hover:text-red-500 text-[10px] opacity-0 group-hover:opacity-100">삭제</button>
                                            </div>
                                        ))}
                                        {(!macros[activeMacroTab] || macros[activeMacroTab].length === 0) && <div className="text-xs text-gray-400 text-center py-4">등록된 문구가 없습니다.</div>}
                                    </div>
                                    <div className="p-2 border-t border-gray-200 bg-gray-50">
                                        <div className="flex gap-1">
                                            <input type="text" className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs outline-none" placeholder="새 문구..." value={newMacroText} onChange={(e) => setNewMacroText(e.target.value)} />
                                            <button onClick={handleAddMacro} className="bg-indigo-500 text-white px-2 py-1 rounded text-xs hover:bg-indigo-600">+</button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="bg-white border-b border-gray-200 p-2 flex items-center gap-2">
                                <button onClick={backToChatList} className="text-gray-500 hover:bg-gray-100 p-1 rounded">◀</button>
                                <span className="text-xs text-gray-400">상담 내용을 기록하세요 (실제 SMS 발송됨)</span>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar hide-scrollbar" ref={chatScrollRef}>
                                {chatMessages.length === 0 ? (
                                    <div className="h-full flex flex-col justify-center items-center text-gray-400 gap-2">
                                        <span className="text-4xl">💬</span>
                                        <p className="text-sm">대화 내역이 없습니다.</p>
                                    </div>
                                ) : (
                                    chatMessages.map((msg, idx) => (
                                        <div key={msg.id || idx} className={`flex mb-4 ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm shadow-sm ${msg.sender === 'me' ? 'bg-indigo-500 text-white rounded-tr-none' : 'bg-white text-gray-800 border border-gray-200 rounded-tl-none'}`}>
                                                {msg.text}
                                                <div className={`text-[10px] mt-1 text-right ${msg.sender === 'me' ? 'text-indigo-200' : 'text-gray-400'}`}>{msg.created_at}</div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                            <div className="p-3 bg-white border-t border-gray-200">
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        className="flex-1 bg-gray-100 rounded-full px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition"
                                        placeholder="메시지를 입력하세요..."
                                        value={chatInput}
                                        onChange={(e) => setChatInput(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && handleSendManualChat()}
                                    />
                                    <button
                                        onClick={() => handleSendManualChat()}
                                        disabled={isSending}
                                        className={`w-10 h-10 rounded-full flex justify-center items-center text-white transition shadow-md ${isSending ? 'bg-gray-400' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                                    >
                                        {isSending ? '...' : '➤'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ⭐️ [복구] 소개/지인 등록 모달 */}
            {showReferralModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex justify-center items-center backdrop-blur-sm animate-fade-in">
                    <div className="bg-white p-6 rounded-2xl shadow-2xl w-96 border border-gray-200">
                        <h3 className="font-bold text-xl mb-6 text-gray-800 flex items-center gap-2">🤝 소개/지인 고객 등록</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">고객명</label>
                                <input type="text" className="w-full border border-gray-300 p-2.5 rounded-lg text-sm outline-none focus:border-indigo-500 transition" value={referralData.name} onChange={e => setReferralData({ ...referralData, name: e.target.value })} placeholder="이름을 입력하세요" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">연락처</label>
                                <input type="text" className="w-full border border-gray-300 p-2.5 rounded-lg text-sm outline-none focus:border-indigo-500 transition" value={referralData.phone} onChange={e => setReferralData({ ...referralData, phone: e.target.value })} placeholder="010-0000-0000" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">희망 통신사</label>
                                <select className="w-full border border-gray-300 p-2.5 rounded-lg text-sm outline-none focus:border-indigo-500 transition bg-white" value={referralData.platform} onChange={e => setReferralData({ ...referralData, platform: e.target.value })}>
                                    <option value="KT">KT</option>
                                    <option value="SK">SK</option>
                                    <option value="LG">LG</option>
                                    <option value="SK알뜰">SK알뜰</option>
                                    <option value="LG알뜰">LG알뜰</option>
                                    <option value="KT알뜰">KT알뜰</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">문의 내용 (상품)</label>
                                <textarea className="w-full border border-gray-300 p-2.5 rounded-lg text-sm outline-none focus:border-indigo-500 transition resize-none" rows={3} value={referralData.product_info} onChange={e => setReferralData({ ...referralData, product_info: e.target.value })} placeholder="문의 내용을 입력하세요..."></textarea>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-6">
                            <button onClick={() => setShowReferralModal(false)} className="px-4 py-2 bg-gray-100 rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-200 transition">취소</button>
                            <button onClick={handleReferralSubmit} className="px-5 py-2 bg-emerald-500 rounded-lg text-sm font-bold text-white hover:bg-emerald-600 shadow-md transition">등록하기</button>
                        </div>
                    </div>
                </div>
            )}


            {/* 🔴 [추가] 실패 사유 선택 모달 */}
            {showFailModal && failTarget && (
                <div className="fixed inset-0 bg-black/50 z-[9999] flex justify-center items-center backdrop-blur-sm animate-fade-in">
                    <div className="bg-white p-6 rounded-2xl w-96 border border-gray-200 shadow-2xl">
                        <h3 className="text-xl font-bold text-red-600 mb-4 flex items-center gap-2">
                            🚫 실패 처리
                        </h3>

                        <div className="bg-red-50 p-3 rounded-lg mb-4">
                            <p className="text-sm text-gray-700 font-bold mb-1">{failTarget.name} 고객님</p>
                            <p className="text-xs text-gray-500">실패 사유를 선택하면 'AS/실패' 탭으로 이동됩니다.</p>
                        </div>

                        <div className="mb-6">
                            <label className="block text-sm font-bold text-gray-700 mb-2">실패 사유 선택</label>
                            <select
                                className="w-full p-3 border border-gray-300 rounded-xl outline-none focus:border-red-500 focus:ring-2 focus:ring-red-200 transition"
                                value={selectedFailReason}
                                onChange={(e) => setSelectedFailReason(e.target.value)}
                            >
                                <option value="">-- 사유를 선택하세요 --</option>
                                {/* 관리자가 설정한 reasons 목록 맵핑 */}
                                {reasons.map((r) => (
                                    <option key={r.id} value={r.reason}>
                                        {r.reason}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => { setShowFailModal(false); setFailTarget(null); }}
                                className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg font-bold hover:bg-gray-200 transition"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleConfirmFail}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 shadow-md transition"
                            >
                                확인 및 저장
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default AgentDashboard;
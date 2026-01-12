import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';

// ==================================================================================
// 1. 상수 및 설정값
// ==================================================================================
const API_BASE = "https://panda-1-hd18.onrender.com";

// ⭐️ 화면 렌더링용 상수
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
// ⭐️ [NaN 완전 방지] 숫자 변환 유틸리티
const safeParseInt = (val) => {
    if (val === null || val === undefined) return 0;
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

const autoResizeTextarea = (e) => {
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';
};

// ==================================================================================
// 3. 팝업 컴포넌트
// ==================================================================================
const PopoutWindow = ({ title, onClose, children }) => {
    const [containerEl, setContainerEl] = useState(null);
    const externalWindow = useRef(null);

    useEffect(() => {
        if (!externalWindow.current || externalWindow.current.closed) {
            externalWindow.current = window.open("", "", "width=920,height=750,left=200,top=100,menubar=no,toolbar=no,location=no,status=no");
        }
        const win = externalWindow.current;
        if (!win) { alert("팝업 차단 해제 필요"); if (onClose) onClose(); return; }

        win.document.title = title || "관리자 팝업";
        win.document.body.style.margin = '0';
        win.document.body.style.backgroundColor = '#ffffff';

        document.querySelectorAll('style, link[rel="stylesheet"]').forEach(node => {
            win.document.head.appendChild(node.cloneNode(true));
        });
        const script = win.document.createElement('script');
        script.src = "https://cdn.tailwindcss.com";
        win.document.head.appendChild(script);

        let root = win.document.getElementById('popout-root');
        if (!root) {
            root = win.document.createElement('div');
            root.id = 'popout-root';
            win.document.body.appendChild(root);
        }
        setContainerEl(root);
        win.onbeforeunload = () => { if (onClose) onClose(); };
        return () => { if (win && !win.closed) win.close(); };
    }, []);

    return containerEl ? ReactDOM.createPortal(children, containerEl) : null;
};

// ==================================================================================
// 4. 메인 컴포넌트
// ==================================================================================
function AdminDashboard({ user, onLogout }) {

    // [설정 데이터]
    const [config, setConfig] = useState(() => {
        try {
            const cached = localStorage.getItem('agent_system_config');
            return cached ? JSON.parse(cached) : null;
        } catch (e) { return null; }
    });

    const currentUserId = user ? String(user.user_id || user.id) : null;

    const [activeTab, setActiveTab] = useState('total_manage');
    const [periodFilter, setPeriodFilter] = useState('month');
    const [agents, setAgents] = useState([]);

    const [adChannels, setAdChannels] = useState([]);
    const [reasons, setReasons] = useState([]);
    const [customStatuses, setCustomStatuses] = useState([]);
    const [settlementStatuses, setSettlementStatuses] = useState([]);
    const [bankList, setBankList] = useState([]);

    // 정책 데이터
    const [policyData, setPolicyData] = useState(() => {
        try {
            const saved = localStorage.getItem('agent_policy_data');
            return saved ? JSON.parse(saved) : INITIAL_POLICY_DATA;
        } catch { return INITIAL_POLICY_DATA; }
    });
    const [activePolicyTab, setActivePolicyTab] = useState('KT');

    const [allCustomers, setAllCustomers] = useState([]);
    const [sharedCustomers, setSharedCustomers] = useState([]);
    const [issueCustomers, setIssueCustomers] = useState([]);

    const [viewDuplicatesOnly, setViewDuplicatesOnly] = useState(false);
    const [issueSubTab, setIssueSubTab] = useState('fail');
    const [failReasonFilter, setFailReasonFilter] = useState('');
    const [totalDbAgentFilter, setTotalDbAgentFilter] = useState('');
    const [salesAgentFilter, setSalesAgentFilter] = useState('');
    const [settlementStatusFilter, setSettlementStatusFilter] = useState('ALL');
    const [statusFilter, setStatusFilter] = useState('ALL');

    const [sharedSubTab, setSharedSubTab] = useState('ALL');
    const [selectedIds, setSelectedIds] = useState([]);
    const [targetAgentId, setTargetAgentId] = useState('');
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
    const [showRequestModal, setShowRequestModal] = useState(false);
    const [requestTarget, setRequestTarget] = useState(null);
    const [requestMessage, setRequestMessage] = useState('');

    const [memoPopupTarget, setMemoPopupTarget] = useState(null);
    const [memoPopupText, setMemoPopupText] = useState('');
    const [memoFieldType, setMemoFieldType] = useState('');
    const [isTopStatsVisible, setIsTopStatsVisible] = useState(true);

    const [notices, setNotices] = useState([]);
    const [policyImages, setPolicyImages] = useState({});
    const [newNotice, setNewNotice] = useState({ title: '', content: '', is_important: false });
    const [uploadImage, setUploadImage] = useState(null);
    const [isBannerVisible, setIsBannerVisible] = useState(true);

    const [isChatOpen, setIsChatOpen] = useState(false);
    const [chatView, setChatView] = useState('LIST');
    const [chatTarget, setChatTarget] = useState(null);
    const [chatListSearch, setChatListSearch] = useState('');
    const [chatMessages, setChatMessages] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const chatScrollRef = useRef(null);
    const [isSending, setIsSending] = useState(false);
    const [chatInputNumber, setChatInputNumber] = useState('');

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
        fetch(`${API_BASE}/api/system/config/`).then(res => res.json()).then(data => { setConfig(data); }).catch(console.error);
    }, []);

    // 정책 데이터 로컬 스토리지 저장
    useEffect(() => { localStorage.setItem('agent_policy_data', JSON.stringify(policyData)); }, [policyData]);

    // 광고비 로컬 스토리지 연동
    useEffect(() => {
        const currentMonthKey = statDate.substring(0, 7);
        setAdSpend(safeParseInt(monthlyAdSpends[currentMonthKey]));
    }, [statDate, monthlyAdSpends]);
    useEffect(() => { localStorage.setItem('agent_monthly_ad_spends', JSON.stringify(monthlyAdSpends)); }, [monthlyAdSpends]);

    const getAuthHeaders = useCallback(() => {
        const token = sessionStorage.getItem('token');
        return { 'Content-Type': 'application/json', 'Authorization': `Token ${token}` };
    }, []);

    useEffect(() => {
        if (currentUserId) {
            const savedMemo = localStorage.getItem(`admin_memo_${currentUserId}`);
            if (savedMemo) setNotepadContent(savedMemo);
        }
    }, [currentUserId]);

    const handleNotepadChange = (e) => {
        const content = e.target.value;
        setNotepadContent(content);
        localStorage.setItem(`admin_memo_${currentUserId}`, content);
    };

    const fetchAllData = useCallback(() => {
        fetch(`${API_BASE}/api/customers/`, { headers: getAuthHeaders() })
            .then(res => res.json())
            .then(data => {
                const list = Array.isArray(data) ? data : [];
                setAllCustomers(list);
                setSharedCustomers(list.filter(c => c.owner === null));
                setIssueCustomers(list.filter(c => c.status === '실패' || c.status === 'AS요청'));
            })
            .catch(err => console.error("데이터 로드 실패:", err));
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

    // ⭐️ [통계 API 호출]
    const fetchStatistics = useCallback(async () => {
        if (!user || activeTab !== 'stats') return;
        let url = `${API_BASE}/api/stats/advanced/?platform=${statPlatform}`;
        if (statPeriodType === 'month') url += `&start_date=${statDate}`;
        else if (statPeriodType === 'day') url += `&start_date=${statDate}&end_date=${statDate}`;

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
        if (activeTab === 'stats') {
            fetchStatistics();
        } else {
            fetchAllData();
            fetchAgents();
            if (activeTab === 'issue_manage') fetch(`${API_BASE}/api/failure_reasons/`, { headers: getAuthHeaders() }).then(res => res.json()).then(setReasons);
            if (activeTab === 'settlement') fetch(`${API_BASE}/api/settlement_statuses/`, { headers: getAuthHeaders() }).then(res => res.json()).then(setSettlementStatuses);
            if (activeTab === 'settings') fetchSettings();
            if (activeTab === 'policy') fetchNoticesAndPolicies();
        }
    }, [activeTab, fetchAllData, fetchAgents, fetchSettings, fetchNoticesAndPolicies, fetchStatistics, getAuthHeaders]);

    useEffect(() => {
        loadCurrentTabData();
        const interval = setInterval(() => {
            if (activeTab !== 'stats' && activeTab !== 'settings' && !showUploadModal && !showCompletionModal) {
                loadCurrentTabData();
            }
        }, 60000);
        return () => clearInterval(interval);
    }, [loadCurrentTabData, showUploadModal, showCompletionModal, activeTab]);

    useEffect(() => {
        if (activeTab === 'stats') fetchStatistics();
    }, [statDate, statPeriodType, statPlatform, selectedStatAgent, fetchStatistics]);

    // =========================================================================
    // ⚙️ 데이터 필터링 로직
    // =========================================================================
    const duplicateSet = useMemo(() => {
        const phoneCounts = {}; const dups = new Set();
        sharedCustomers.forEach(c => { const p = c.phone ? c.phone.trim() : ''; if (p) phoneCounts[p] = (phoneCounts[p] || 0) + 1; });
        Object.keys(phoneCounts).forEach(phone => { if (phoneCounts[phone] > 1) dups.add(phone); });
        return dups;
    }, [sharedCustomers]);

    const notifications = useMemo(() => {
        if (!currentUserId) return [];
        const now = new Date().getTime();
        return allCustomers.filter(c => {
            if (String(c.owner) !== String(currentUserId)) return false;
            if (!c.callback_schedule) return false;
            if (['접수완료', '실패', '장기가망', '접수취소', '실패이관'].includes(c.status)) return false;
            const checklist = parseChecklist(c.checklist);
            if (!checklist.includes('알림ON')) return false;
            return new Date(c.callback_schedule).getTime() <= now;
        }).sort((a, b) => new Date(a.callback_schedule) - new Date(b.callback_schedule));
    }, [allCustomers, currentUserId]);

    const todayIssues = useMemo(() => {
        if (!notices || notices.length === 0) return [];
        const todayStr = new Date().toISOString().split('T')[0];
        return notices.filter(n => n.created_at && n.created_at.startsWith(todayStr));
    }, [notices]);

    // ⭐️ [테이블 표시 데이터 로직]
    const displayedData = useMemo(() => {
        let data = [];
        if (activeTab === 'total_manage') {
            data = allCustomers;
            if (totalDbAgentFilter) {
                if (totalDbAgentFilter === 'unassigned') data = data.filter(c => c.owner === null);
                else data = data.filter(c => String(c.owner) === String(totalDbAgentFilter));
            }
        } else if (activeTab === 'shared') {
            data = sharedCustomers;
            if (sharedSubTab !== 'ALL') {
                if (sharedSubTab === '기타') { const known = ['당근', '토스', '실패DB']; data = data.filter(c => !known.includes(c.platform)); }
                else { data = data.filter(c => c.platform === sharedSubTab); }
            }
            if (viewDuplicatesOnly) { data = data.filter(c => duplicateSet.has(c.phone)).sort((a, b) => a.phone.localeCompare(b.phone)); }
        } else if (activeTab === 'consult') {
            data = allCustomers.filter(c => String(c.owner) === String(currentUserId) && !['설치완료', '해지진행', '접수취소'].includes(c.status));
            if (statusFilter !== 'ALL') data = data.filter(c => c.status === statusFilter);
            data.sort((a, b) => { const dateA = a.callback_schedule ? new Date(a.callback_schedule).getTime() : Infinity; const dateB = b.callback_schedule ? new Date(b.callback_schedule).getTime() : Infinity; return dateA - dateB; });
        } else if (activeTab === 'long_term') {
            data = allCustomers.filter(c => String(c.owner) === String(currentUserId) && c.status === '장기가망');
            data.sort((a, b) => new Date(a.callback_schedule || 0) - new Date(b.callback_schedule || 0));
        } else if (activeTab === 'issue_manage') {
            if (issueSubTab === 'fail') {
                data = allCustomers.filter(c => c.status === '실패');
                if (failReasonFilter) data = data.filter(c => c.detail_reason === failReasonFilter);
            } else {
                data = allCustomers.filter(c => c.status === 'AS요청');
            }
        } else if (activeTab === 'reception') {
            data = allCustomers.filter(c => c.status === '접수완료');
        } else if (activeTab === 'installation') {
            data = allCustomers.filter(c => c.status === '설치완료');
        } else if (activeTab === 'settlement') {
            const targets = (config && config.settlement_target_statuses) ? config.settlement_target_statuses : ['설치완료', '접수완료', '해지진행', '접수취소'];
            data = allCustomers.filter(c => targets.includes(c.status));
            if (settlementStatusFilter !== 'ALL') data = data.filter(c => c.status === settlementStatusFilter);
        }

        if (['reception', 'installation', 'settlement'].includes(activeTab) && salesAgentFilter) {
            data = data.filter(c => String(c.owner) === String(salesAgentFilter));
        }
        return data;
    }, [activeTab, allCustomers, sharedCustomers, duplicateSet, totalDbAgentFilter, issueSubTab, failReasonFilter, salesAgentFilter, settlementStatusFilter, statusFilter, sharedSubTab, config, currentUserId]);


    // ⭐️ [수정 1] 상단 실시간 지표: 최근 6개월 데이터 계산 (리스트 형태)
    // ⭐️ [수정됨] 상단 실시간 지표 계산 (최근 6개월, 전체 DB 기준)
    const realTimeStats = useMemo(() => {
        const stats = [];
        const today = new Date();

        // 5개월 전부터 이번 달까지 (총 6개월) 반복
        for (let i = 5; i >= 0; i--) {
            const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const key = `${y}-${m}`;

            // 🔴 [핵심 수정] 관리자 페이지이므로 'myAllCustomers' 대신 'allCustomers' 사용
            const monthCustomers = allCustomers.filter(c => c.upload_date && c.upload_date.startsWith(key));

            const totalDB = monthCustomers.length;
            const accepted = monthCustomers.filter(c => ['접수완료', '설치완료'].includes(c.status)).length;

            // 접수 매출 (예상)
            const acceptedRevenue = monthCustomers
                .filter(c => ['접수완료', '설치완료'].includes(c.status))
                .reduce((acc, c) => acc + (safeParseInt(c.agent_policy) * 10000), 0);

            // 설치 매출 (확정)
            const installedRevenue = monthCustomers
                .filter(c => c.status === '설치완료')
                .reduce((acc, c) => acc + (safeParseInt(c.agent_policy) * 10000), 0);

            // 해당 월의 광고비 (저장된 값)
            const adSpend = safeParseInt(monthlyAdSpends[key] || 0);

            // 접수율
            const rate = totalDB > 0 ? ((accepted / totalDB) * 100).toFixed(1) : 0;

            stats.push({
                monthName: `${m}월`,
                key: key,
                totalDB,
                accepted,
                rate,
                acceptedRevenue,
                installedRevenue,
                adSpend
            });
        }
        return stats;
    }, [allCustomers, monthlyAdSpends]); // 🔴 의존성 배열도 allCustomers로 변경

    // ⭐️ [수정됨] 최근 6개월 월별 요약 데이터 (관리자용: allCustomers 사용)
    const monthlySummaryData = useMemo(() => {
        const results = [];
        const today = new Date();

        // 최근 6개월 순회 (역순: 이번달 -> 6달 전)
        for (let i = 0; i < 6; i++) {
            const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const key = `${y}-${m}`;

            // 🔴 [핵심 수정] myAllCustomers -> allCustomers 로 변경
            const monthCustomers = allCustomers.filter(c => c.upload_date && c.upload_date.startsWith(key));

            const totalDB = monthCustomers.length;
            const accepted = monthCustomers.filter(c => ['접수완료', '설치완료'].includes(c.status)).length;

            const acceptedRevenue = monthCustomers
                .filter(c => ['접수완료', '설치완료'].includes(c.status))
                .reduce((acc, c) => acc + (safeParseInt(c.agent_policy) * 10000), 0);

            const installedRevenue = monthCustomers
                .filter(c => c.status === '설치완료')
                .reduce((acc, c) => acc + (safeParseInt(c.agent_policy) * 10000), 0);

            const adSpend = safeParseInt(monthlyAdSpends[key] || 0);
            const rate = totalDB > 0 ? ((accepted / totalDB) * 100).toFixed(1) : 0;

            results.push({
                month: `${d.getMonth() + 1}월`,
                key: key,
                acceptedRevenue,
                installedRevenue,
                adSpend,
                rate,
                totalDB,
                accepted
            });
        }
        return results;
    }, [allCustomers, monthlyAdSpends]); // 🔴 의존성 배열도 allCustomers로 변경

    // ⭐️ [통계] 데이터 가공 로직 (키값 수정 및 NaN 방어)
    const dashboardStats = useMemo(() => {
        if (!serverStats || serverStats.length === 0) return null;

        let targetStats = serverStats;

        // 백엔드에서 'db'라는 키로 내려줌 (total_db -> db)
        const totalDBAllAgents = serverStats.reduce((acc, s) => acc + safeParseInt(s.db), 0);

        if (selectedStatAgent !== 'ALL') {
            targetStats = serverStats.filter(s => String(s.id) === String(selectedStatAgent));
        }

        const totalDB = targetStats.reduce((acc, s) => acc + safeParseInt(s.db), 0);
        const acceptedCount = targetStats.reduce((acc, s) => acc + safeParseInt(s.accepted), 0);
        const acceptedRevenue = targetStats.reduce((acc, s) => acc + safeParseInt(s.acceptedRevenue), 0);
        const installedRevenue = targetStats.reduce((acc, s) => acc + safeParseInt(s.installedRevenue), 0);
        const installCount = targetStats.reduce((acc, s) => acc + safeParseInt(s.installed), 0);
        const cancelCount = targetStats.reduce((acc, s) => acc + safeParseInt(s.canceled), 0);

        const acceptRate = totalDB > 0 ? ((acceptedCount / totalDB) * 100).toFixed(1) : 0;
        const cancelRate = (acceptedCount + cancelCount) > 0 ? ((cancelCount / (acceptedCount + cancelCount)) * 100).toFixed(1) : 0;
        const netInstallRate = acceptedCount > 0 ? ((installCount / acceptedCount) * 100).toFixed(1) : 0;
        const avgMargin = acceptedCount > 0 ? Math.round(acceptedRevenue / acceptedCount) : 0;

        const currentMonthKey = statDate.substring(0, 7);
        const totalAdSpendInput = safeParseInt(monthlyAdSpends[currentMonthKey]);

        let finalAdSpend = totalAdSpendInput;
        if (selectedStatAgent !== 'ALL') {
            finalAdSpend = totalDBAllAgents > 0 ? Math.round(totalAdSpendInput * (totalDB / totalDBAllAgents)) : 0;
        }

        const netProfit = installedRevenue - finalAdSpend;

        return { totalDB, acceptedCount, acceptRate, acceptedRevenue, installedRevenue, installCount, cancelRate, netInstallRate, avgMargin, netProfit, adSpend: finalAdSpend };
    }, [serverStats, monthlyAdSpends, selectedStatAgent, statDate]);

    const agentStats = useMemo(() => {
        if (!serverStats) return [];
        const currentMonthKey = statDate.substring(0, 7);
        const totalAdSpend = safeParseInt(monthlyAdSpends[currentMonthKey]);
        const totalDBAllAgents = serverStats.reduce((acc, s) => acc + safeParseInt(s.db), 0);

        return serverStats.map(s => {
            const sTotalDB = safeParseInt(s.db);
            const sAccepted = safeParseInt(s.accepted);
            const sInstalled = safeParseInt(s.installed);
            const sCanceled = safeParseInt(s.canceled);
            const sAcceptedRev = safeParseInt(s.acceptedRevenue);
            const sInstalledRev = safeParseInt(s.installedRevenue);

            const adSpend = totalDBAllAgents > 0 ? Math.round(totalAdSpend * (sTotalDB / totalDBAllAgents)) : 0;
            const netProfit = sInstalledRev - adSpend;
            const acceptRate = sTotalDB > 0 ? ((sAccepted / sTotalDB) * 100).toFixed(1) : 0;
            const cancelRate = (sAccepted + sCanceled) > 0 ? ((sCanceled / (sAccepted + sCanceled)) * 100).toFixed(1) : 0;
            const netInstallRate = sAccepted > 0 ? ((sInstalled / sAccepted) * 100).toFixed(1) : 0;
            const avgMargin = sAccepted > 0 ? Math.round(sAcceptedRev / sAccepted) : 0;

            const platformDetails = (s.platformDetails || []).map(p => {
                const pDB = safeParseInt(p.db);
                const pAccepted = safeParseInt(p.accepted);
                const pInstalled = safeParseInt(p.installed);
                const pCanceled = safeParseInt(p.canceled);
                const pAcceptedRev = safeParseInt(p.acceptedRevenue);
                const pInstalledRev = safeParseInt(p.installedRevenue);

                const pAdSpend = sTotalDB > 0 ? Math.round(adSpend * (pDB / sTotalDB)) : 0;
                const pNetProfit = pInstalledRev - pAdSpend;
                const pAcceptRate = pDB > 0 ? ((pAccepted / pDB) * 100).toFixed(1) : 0;
                const pCancelRate = (pAccepted + pCanceled) > 0 ? ((pCanceled / (pAccepted + pCanceled)) * 100).toFixed(1) : 0;
                const pNetInstallRate = pAccepted > 0 ? ((pInstalled / pAccepted) * 100).toFixed(1) : 0;
                const pAvgMargin = pAccepted > 0 ? Math.round(pAcceptedRev / pAccepted) : 0;

                return { ...p, adSpend: pAdSpend, netProfit: pNetProfit, acceptRate: pAcceptRate, cancelRate: pCancelRate, netInstallRate: pNetInstallRate, avgMargin: pAvgMargin };
            });

            return {
                ...s, db: sTotalDB, accepted: sAccepted, installed: sInstalled, canceled: sCanceled,
                acceptedRevenue: sAcceptedRev, installedRevenue: sInstalledRev,
                adSpend, netProfit, acceptRate, cancelRate, netInstallRate, avgMargin, platformDetails
            };
        }).sort((a, b) => b.netProfit - a.netProfit);
    }, [serverStats, monthlyAdSpends, statDate]);


    // =========================================================================
    // 🎮 핸들러
    // =========================================================================
    const handleUpdatePolicyData = (category, index, field, value) => {
        setPolicyData(prev => ({ ...prev, [activePolicyTab]: { ...prev[activePolicyTab], [category]: prev[activePolicyTab][category].map((item, i) => i === index ? { ...item, [field]: value } : item) } }));
    };
    const handleAddPolicyItem = (category) => {
        setPolicyData(prev => ({ ...prev, [activePolicyTab]: { ...prev[activePolicyTab], [category]: [...prev[activePolicyTab][category], { id: Date.now(), name: '', policy: '', support: '', total: '' }] } }));
    };
    const handleDeletePolicyItem = (category, index) => {
        if (!window.confirm("삭제하시겠습니까?")) return;
        setPolicyData(prev => ({ ...prev, [activePolicyTab]: { ...prev[activePolicyTab], [category]: prev[activePolicyTab][category].filter((_, i) => i !== index) } }));
    };
    const handleAddCarrierTab = () => {
        const name = prompt("새로운 통신사 이름을 입력하세요");
        if (name && !policyData[name]) { setPolicyData(prev => ({ ...prev, [name]: { internet: [], bundle: [], addon: [] } })); setActivePolicyTab(name); }
    };
    const handleDeleteCarrierTab = (tabName) => {
        if (Object.keys(policyData).length <= 1) return alert("최소 1개는 있어야 합니다.");
        if (window.confirm(`${tabName} 탭을 삭제하시겠습니까?`)) { const newData = { ...policyData }; delete newData[tabName]; setPolicyData(newData); setActivePolicyTab(Object.keys(newData)[0]); }
    };
    const handleRestoreCustomer = (id) => { if (!window.confirm("복구하시겠습니까?")) return; handleInlineUpdate(id, 'status', '미통건'); };
    const handleDeleteCustomer = (id) => { if (window.confirm("삭제?")) fetch(`${API_BASE}/api/customers/${id}/`, { method: 'DELETE', headers: getAuthHeaders() }).then(() => loadCurrentTabData()); };

    // 기본 핸들러들
    const handleInlineUpdate = async (id, field, value) => { setAllCustomers(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c)); try { await fetch(`${API_BASE}/api/customers/${id}/`, { method: 'PATCH', headers: getAuthHeaders(), body: JSON.stringify({ [field]: value }) }); } catch (error) { alert("저장 실패"); loadCurrentTabData(); } };
    const handleAddAdChannel = () => { if (!newAdChannel.name || !newAdChannel.cost) return alert("입력 필요"); fetch(`${API_BASE}/api/ad_channels/`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(newAdChannel) }).then(() => { alert("완료"); setNewAdChannel({ name: '', cost: '' }); fetchSettings(); }); };
    const handleDeleteAdChannel = (id) => { if (window.confirm("삭제?")) fetch(`${API_BASE}/api/ad_channels/${id}/`, { method: 'DELETE', headers: getAuthHeaders() }).then(() => fetchSettings()); };
    const handleAddReason = () => { if (!newReason) return; fetch(`${API_BASE}/api/failure_reasons/`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ reason: newReason }) }).then(() => { alert("완료"); setNewReason(''); fetchSettings(); }); };
    const handleDeleteReason = (id) => { if (window.confirm("삭제?")) fetch(`${API_BASE}/api/failure_reasons/${id}/`, { method: 'DELETE', headers: getAuthHeaders() }).then(() => fetchSettings()); };
    const handleAddStatus = () => { if (!newStatus) return; fetch(`${API_BASE}/api/custom_statuses/`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ status: newStatus }) }).then(() => { alert("완료"); setNewStatus(''); fetchSettings(); }); };
    const handleDeleteStatus = (id) => { if (window.confirm("삭제?")) fetch(`${API_BASE}/api/custom_statuses/${id}/`, { method: 'DELETE', headers: getAuthHeaders() }).then(() => fetchSettings()); };
    const handleAddSettlementStatus = () => { if (!newSettlementStatus) return; fetch(`${API_BASE}/api/settlement_statuses/`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ status: newSettlementStatus }) }).then(() => { alert("완료"); setNewSettlementStatus(''); fetchSettings(); }); };
    const handleDeleteSettlementStatus = (id) => { if (window.confirm("삭제?")) fetch(`${API_BASE}/api/settlement_statuses/${id}/`, { method: 'DELETE', headers: getAuthHeaders() }).then(() => fetchSettings()); };
    const handleSaveSettings = () => { alert("✅ 저장되었습니다."); localStorage.setItem('agent_policy_data', JSON.stringify(policyData)); };
    const handleAllocate = (refreshCallback) => { if (selectedIds.length === 0 || !targetAgentId) return alert("대상/상담사 선택"); if (!window.confirm("이동?")) return; fetch(`${API_BASE}/api/customers/allocate/`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ customer_ids: selectedIds, agent_id: targetAgentId }) }).then(res => res.json()).then(data => { alert(data.message); setSelectedIds([]); if (String(targetAgentId) === String(currentUserId)) { setActiveTab('consult'); } setTargetAgentId(''); if (typeof refreshCallback === 'function') refreshCallback(); else loadCurrentTabData(); }); };
    const handlePaste = (e) => { const text = e.target.value; setPasteData(text); const rows = text.trim().split('\n').map(row => { const cols = row.split('\t').map(c => c.trim()); return { name: cols[0] || '이름없음', phone: cols[1] || '', platform: cols[2] || '기타', last_memo: cols.slice(2).filter(Boolean).join(' / '), upload_date: new Date().toISOString().slice(0, 10) }; }); setParsedData(rows); };
    const handleBulkSubmit = () => { if (parsedData.length === 0) return; fetch(`${API_BASE}/api/customers/bulk_upload/`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ customers: parsedData }) }).then(async (res) => { const data = await res.json(); if (res.ok) { alert(data.message); setShowUploadModal(false); setPasteData(''); setParsedData([]); loadCurrentTabData(); } else { alert(`오류: ${data.message}`); } }).catch(err => console.error(err)); };
    const handleSelectAll = (e, dataList) => { if (e.target.checked) setSelectedIds(dataList.map(c => c.id)); else setSelectedIds([]); };
    const handleCheck = (id) => { if (selectedIds.includes(id)) setSelectedIds(selectedIds.filter(sid => sid !== id)); else setSelectedIds([...selectedIds, id]); };
    const getAgentName = (id) => { if (!id) return '-'; if (String(id) === String(currentUserId)) return '👤 나 (관리자)'; const agent = agents.find(a => String(a.id) === String(id)); return agent ? agent.username : '알수없음'; };
    const handleAssignToMe = (id) => { if (!window.confirm("이 고객을 내 상담 리스트로 가져오시겠습니까?")) return; fetch(`${API_BASE}/api/customers/${id}/assign/`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ user_id: currentUserId }) }).then(() => { alert("배정 완료! '내 상담관리' 탭에서 확인하세요."); loadCurrentTabData(); setActiveTab('consult'); }); };
    const handleCreateNotice = () => { if (!newNotice.title || !newNotice.content) return alert("제목과 내용을 입력해주세요."); fetch(`${API_BASE}/api/notices/`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(newNotice) }).then(() => { alert("공지사항 등록 완료"); setNewNotice({ title: '', content: '', is_important: false }); fetchNoticesAndPolicies(); }); };
    const handleDeleteNotice = (id) => { if (!window.confirm("삭제하시겠습니까?")) return; fetch(`${API_BASE}/api/notices/${id}/`, { method: 'DELETE', headers: getAuthHeaders() }).then(() => fetchNoticesAndPolicies()); };
    const handleImageUpload = () => { if (!uploadImage) return alert("이미지를 선택해주세요."); const formData = new FormData(); formData.append('platform', activePolicyTab); formData.append('image', uploadImage); fetch(`${API_BASE}/api/policies/`, { method: 'POST', headers: { 'Authorization': `Token ${sessionStorage.getItem('token')}` }, body: formData }).then(() => { alert("정책 이미지 업로드 완료"); setUploadImage(null); fetchNoticesAndPolicies(); }); };
    const openRequestModal = (customer) => { setRequestTarget(customer); setShowRequestModal(true); };
    const sendRequest = () => { if (!requestTarget) return; setAllCustomers(prev => prev.map(c => c.id === requestTarget.id ? { ...c, request_status: 'REQUESTED', request_message: requestMessage } : c)); fetch(`${API_BASE}/api/customers/${requestTarget.id}/`, { method: 'PATCH', headers: getAuthHeaders(), body: JSON.stringify({ request_status: 'REQUESTED', request_message: requestMessage }) }).then(() => { alert("확인 요청이 전송되었습니다."); setShowRequestModal(false); setRequestMessage(''); setRequestTarget(null); }).catch(err => alert("요청 실패")); };
    const clearRequest = (id) => { if (!window.confirm("완료된 요청을 정리하시겠습니까?")) return; handleInlineUpdate(id, 'request_status', null); };
    const handleToggleAlarm = (e, customer) => { e.stopPropagation(); const currentList = parseChecklist(customer.checklist); const isAlarmOn = currentList.includes('알림ON'); const newList = isAlarmOn ? currentList.filter(item => item !== '알림ON') : [...currentList, '알림ON']; handleInlineUpdate(customer.id, 'checklist', newList.join(',')); };
    const handleCallbackChange = (customer, type, val) => { let current = customer.callback_schedule ? new Date(customer.callback_schedule) : new Date(); if (isNaN(current.getTime())) { current = new Date(); current.setHours(9, 0, 0, 0); } let y = current.getFullYear(); let m = current.getMonth() + 1; let d = current.getDate(); let h = current.getHours(); if (type === 'year') y = parseInt(val) || y; if (type === 'month') m = parseInt(val) || m; if (type === 'day') d = parseInt(val) || d; if (type === 'hour') h = parseInt(val) || h; const newDate = new Date(y, m - 1, d, h); const yy = newDate.getFullYear(); const mm = String(newDate.getMonth() + 1).padStart(2, '0'); const dd = String(newDate.getDate()).padStart(2, '0'); const hh = String(newDate.getHours()).padStart(2, '0'); handleInlineUpdate(customer.id, 'callback_schedule', `${yy}-${mm}-${dd}T${hh}:00:00`); };
    const openHistoryModal = (c) => { alert(`${c.name}님의 상세 정보로 이동합니다.`); };
    const handleAdSpendChange = (value) => { const cleanValue = value.replace(/[^0-9]/g, ''); const currentMonthKey = statDate.substring(0, 7); setMonthlyAdSpends(prev => ({ ...prev, [currentMonthKey]: cleanValue })); setAdSpend(cleanValue); };
    const handleColumnToggle = (col) => setVisibleColumns(prev => ({ ...prev, [col]: !prev[col] }));
    const handleCardToggle = (card) => setVisibleCards(prev => ({ ...prev, [card]: !prev[card] }));
    const toggleRow = (id) => { const newSet = new Set(expandedRows); if (newSet.has(id)) newSet.delete(id); else newSet.add(id); setExpandedRows(newSet); };

    // 상태 변경 핸들러
    const handleStatusChangeRequest = async (id, newStatus) => {
        if (newStatus === '접수완료') {
            const target = allCustomers.find(c => c.id === id);
            setCompletionTarget(target);
            // ⭐️ KT 기본값 설정
            setSelectedPlatform(target.platform || 'KT');
            setDynamicFormData({});
            setCalculatedPolicy(0);
            setShowCompletionModal(true);
            return;
        } else if (newStatus === '실패이관') {
            try {
                await fetch(`${API_BASE}/api/customers/${id}/add_log/`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ user_id: user.user_id, content: `[시스템] 빠른 실패이관 처리` }) });
                await fetch(`${API_BASE}/api/customers/${id}/`, { method: 'PATCH', headers: getAuthHeaders(), body: JSON.stringify({ status: '실패이관', owner: null }) });
                loadCurrentTabData();
            } catch (err) { console.error(err); }
            return;
        }
        handleInlineUpdate(id, 'status', newStatus);
    };

    // 정책 계산 핸들러
    const handleFormDataChange = (key, value) => {
        const newData = { ...dynamicFormData, [key]: value };
        setDynamicFormData(newData);

        let totalPolicy = 0;
        const currentData = policyData[selectedPlatform];
        if (currentData) {
            [...currentData.internet, ...currentData.bundle, ...currentData.addon].forEach(p => {
                if (p.name === value) {
                    totalPolicy += safeParseInt(p.policy || p.cost);
                }
            });
        }
        setCalculatedPolicy(totalPolicy);
    };

    const handleConfirmCompletion = () => { if (!completionTarget) return; const finalProductInfo = `[${selectedPlatform}] ` + Object.entries(dynamicFormData).map(([k, v]) => `${k}:${v}`).join(', '); const payload = { status: '접수완료', platform: selectedPlatform, product_info: finalProductInfo, agent_policy: calculatedPolicy, installed_date: null }; fetch(`${API_BASE}/api/customers/${completionTarget.id}/`, { method: 'PATCH', headers: getAuthHeaders(), body: JSON.stringify(payload) }).then(() => { const logContent = `[시스템 자동접수]\n통신사: ${selectedPlatform}\n상품내역: ${finalProductInfo}\n예상 정책금: ${calculatedPolicy}만원`; return fetch(`${API_BASE}/api/customers/${completionTarget.id}/add_log/`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ user_id: user.user_id, content: logContent }) }); }).then(() => { alert("🎉 접수가 완료되었습니다!"); setShowCompletionModal(false); setCompletionTarget(null); loadCurrentTabData(); setActiveTab('reception'); }).catch(err => alert("오류 발생: " + err)); };
    const openMemoPopup = (e, customer, field) => { e.stopPropagation(); setMemoPopupTarget(customer); setMemoFieldType(field); setMemoPopupText(customer[field] || ''); };
    const saveMemoPopup = () => { if (!memoPopupTarget || !memoFieldType) return; handleInlineUpdate(memoPopupTarget.id, memoFieldType, memoPopupText); setMemoPopupTarget(null); };
    const handleResponse = (status) => { if (!requestTarget) return; setAllCustomers(prev => prev.map(c => c.id === requestTarget.id ? { ...c, request_status: status } : c)); fetch(`${API_BASE}/api/customers/${requestTarget.id}/`, { method: 'PATCH', headers: getAuthHeaders(), body: JSON.stringify({ request_status: status }) }).then(() => { alert("처리됨"); setShowResponseModal(false); setRequestTarget(null); }); };
    const handleResponseAction = (status) => { if (!responseTarget) return; setAllCustomers(prev => prev.map(c => c.id === responseTarget.id ? { ...c, request_status: status } : c)); fetch(`${API_BASE}/api/customers/${responseTarget.id}/`, { method: 'PATCH', headers: getAuthHeaders(), body: JSON.stringify({ request_status: status }) }).then(() => { alert("처리됨"); setShowResponseModal(false); setResponseTarget(null); }); };
    const enterChatRoom = (c) => { setChatTarget(c); setChatView('ROOM'); setChatMessages([]); };
    const backToChatList = () => { setChatView('LIST'); setChatTarget(null); setChatMessages([]); };
    const handleOpenChat = (e, c) => { e.stopPropagation(); e.preventDefault(); setChatTarget(c); setChatView('ROOM'); setChatMessages([]); setIsChatOpen(true); };
    const handleSendManualChat = async (textToSend = null) => { const msg = textToSend || chatInput; if (!msg?.trim() || !chatTarget) return; setIsSending(true); try { const res = await fetch(`${API_BASE}/api/sales/manual-sms/`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ customer_id: chatTarget.id, message: msg }) }); if (res.ok) { if (!textToSend) setChatInput(''); setChatMessages(prev => [...prev, { id: Date.now(), sender: 'me', text: msg, created_at: '방금 전' }]); } else alert("전송 실패"); } catch { alert("오류"); } finally { setIsSending(false); } };
    const handleCreateAgent = () => { fetch(`${API_BASE}/api/agents/`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(newAgent) }).then(res => { if (res.ok) { alert("완료"); setNewAgent({ username: '', password: '' }); fetchAgents(); } else res.json().then(d => alert(d.message)); }); };
    const handleDeleteAgent = (id, name) => { if (window.confirm(`'${name}' 삭제?`)) fetch(`${API_BASE}/api/agents/${id}/`, { method: 'DELETE', headers: getAuthHeaders() }).then(() => { alert("삭제 완료"); fetchAgents(); }); };
    const renderInteractiveStars = (id, currentRank) => (<div className="flex cursor-pointer" onClick={(e) => e.stopPropagation()}>{[1, 2, 3, 4, 5].map(star => (<span key={star} className={`text-lg ${star <= currentRank ? 'text-yellow-400' : 'text-gray-300'} hover:scale-125 transition`} onClick={() => handleInlineUpdate(id, 'rank', star)}>★</span>))}</div>);

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
            <style>{`.no-spin::-webkit-inner-spin-button, .no-spin::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; } .no-spin { -moz-appearance: textfield; }`}</style>

            <header className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm mb-6 border border-gray-200 sticky top-0 z-40">
                <h1 className="text-xl font-extrabold text-indigo-900 flex items-center gap-2">👑 관리자 대시보드</h1>
                {/* ... (헤더 내용은 동일) ... */}
                <div className="flex items-center gap-6">
                    <button
                        onClick={() => setIsTopStatsVisible(!isTopStatsVisible)}
                        className={`text-xs font-bold px-3 py-1.5 rounded-full border transition 
                        ${isTopStatsVisible ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-200'}`}
                    >
                        📊 현황판 {isTopStatsVisible ? 'ON' : 'OFF'}
                    </button>
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
                        <button onClick={() => setShowUploadModal(true)} className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg font-bold transition shadow-sm">📤 DB 등록</button>
                        <button onClick={onLogout} className="bg-slate-400 hover:bg-slate-500 text-white px-4 py-2 rounded-lg font-bold transition shadow-sm">로그아웃</button>
                    </div>
                </div>
            </header>

            {/* ⭐️ [수정 2] 실시간 지표 대시보드 (최근 6개월 리스트 형태) */}
            {isTopStatsVisible && (
                <div className="mb-6 bg-white border border-gray-200 rounded-xl shadow-sm p-4 animate-fade-in-down">
                    <div className="flex justify-between items-end mb-3 border-b border-gray-100 pb-2">
                        <h2 className="text-sm font-extrabold text-gray-800 flex items-center gap-2">📊 월별 실적 현황 (최근 6개월)</h2>
                        <div className="text-[10px] text-gray-400">데이터 기준: 각 월별 등록된 내 DB</div>
                    </div>

                    {/* 7열 그리드 (월, 접수매출, 설치매출, 광고비, 접수율, 총DB, 총접수) */}
                    <div className="w-full text-sm text-center border border-gray-200 rounded-lg overflow-hidden">
                        {/* 헤더 */}
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
                                    <span className="absolute right-1 top-1 text-[8px] text-gray-300 opacity-0 group-hover:opacity-100 pointer-events-none">수정</span>
                                </div>
                                <div className="p-3 font-bold text-indigo-600 border-r border-gray-100">{stat.rate}%</div>
                                <div className="p-3 border-r border-gray-100">{stat.totalDB}건</div>
                                <div className="p-3">{stat.accepted}건</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 탭 메뉴 영역 */}
            <div className="flex gap-1 mb-4 border-b border-gray-200 pb-1 overflow-x-auto sticky top-[80px] z-30 bg-slate-50 hide-scrollbar">
                {[
                    { id: 'total_manage', label: '🗂️ 전체 DB' },
                    { id: 'shared', label: '🛒 미배정(공유)' },
                    { id: 'consult', label: '📞 내 상담관리', special: true },
                    { id: 'long_term', label: '📅 내 가망관리', special: true },
                    { id: 'reception', label: '📝 접수관리' },
                    { id: 'installation', label: '✅ 설치완료' },
                    { id: 'settlement', label: '💰 정산관리' },
                    { id: 'issue_manage', label: '🛠 AS/실패' },
                    { id: 'stats', label: '📊 통계' },
                    { id: 'users', label: '👥 상담사' },
                    { id: 'policy', label: '📢 정책/공지' },
                    { id: 'settings', label: '⚙️ 설정' },
                    { id: 'notepad', label: '📝 메모장', special: true }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => { setActiveTab(tab.id); setSalesAgentFilter(''); }}
                        className={`
                px-4 py-2 rounded-t-lg text-[13px] font-bold transition whitespace-nowrap border-t border-l border-r
                ${activeTab === tab.id
                                // 활성화된 탭 스타일 (흰색 배경 + 하단 테두리 제거로 콘텐츠와 연결된 느낌)
                                ? (tab.special
                                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200 border-b-white translate-y-[1px]'
                                    : 'bg-white text-indigo-600 border-gray-200 border-b-white translate-y-[1px]')
                                // 비활성화된 탭 스타일 (회색 배경)
                                : 'bg-gray-100 text-gray-400 border-transparent hover:bg-gray-200'}
            `}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="bg-white rounded-xl shadow-lg min-h-[600px] border border-gray-200 p-6 overflow-x-auto">
                {/* ⭐️ [신규] 정책/공지사항 탭 */}
                {activeTab === 'policy' && (
                    <div className="flex gap-6 h-[750px] animate-fade-in">
                        <div className="w-1/3 flex flex-col h-full bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                            <h3 className="text-lg font-bold mb-4 text-indigo-900 border-b border-gray-100 pb-3">📢 공지사항 작성</h3>
                            <div className="mb-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                                <input className="w-full mb-2 bg-white border border-gray-300 rounded p-2 text-sm font-bold outline-none focus:border-indigo-500" placeholder="공지 제목" value={newNotice.title} onChange={e => setNewNotice({ ...newNotice, title: e.target.value })} />
                                <textarea className="w-full h-24 mb-2 bg-white border border-gray-300 rounded p-2 text-sm outline-none focus:border-indigo-500 resize-none" placeholder="내용 입력..." value={newNotice.content} onChange={e => setNewNotice({ ...newNotice, content: e.target.value })} />
                                <div className="flex justify-between items-center">
                                    <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-red-500">
                                        <input type="checkbox" className="accent-red-500 w-4 h-4" checked={newNotice.is_important} onChange={e => setNewNotice({ ...newNotice, is_important: e.target.checked })} />
                                        중요 공지
                                    </label>
                                    <button onClick={handleCreateNotice} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-md transition">등록하기</button>
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3">
                                {notices.map(n => (
                                    <div key={n.id} className={`p-4 rounded-xl border relative group ${n.is_important ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200 hover:border-indigo-200'}`}>
                                        <button onClick={() => handleDeleteNotice(n.id)} className="absolute top-3 right-3 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition">✖</button>
                                        <div className="flex items-center gap-2 mb-1">
                                            {n.is_important && <span className="text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded font-bold">중요</span>}
                                            <span className="font-bold text-sm text-gray-800">{n.title}</span>
                                        </div>
                                        <p className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed">{n.content}</p>
                                        <div className="text-[10px] text-gray-400 mt-2 text-right">{n.created_at} · {n.writer_name}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex-1 flex flex-col h-full bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                            <div className="bg-gray-50 p-4 border-b border-gray-200 flex justify-between items-center">
                                <div className="flex gap-2">
                                    {config.policy_tabs.map(p => (
                                        <button key={p} onClick={() => setActivePolicyTab(p)} className={`px-5 py-2 rounded-lg font-bold text-sm transition ${activePolicyTab === p ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-gray-500 border border-gray-300 hover:bg-gray-100'}`}>{p} 정책</button>
                                    ))}
                                </div>
                                <div className="flex gap-2">
                                    <input type="file" accept="image/*" id="policyUpload" className="hidden" onChange={(e) => setUploadImage(e.target.files[0])} />
                                    <label htmlFor="policyUpload" className="bg-white border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm font-bold cursor-pointer hover:bg-gray-50 transition">{uploadImage ? uploadImage.name : '이미지 선택'}</label>
                                    {uploadImage && <button onClick={handleImageUpload} className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md transition">업로드</button>}
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

                {/* ⭐️ [신규] AS 및 실패 리드 관리 */}
                {activeTab === 'issue_manage' && (
                    <div className="animate-fade-in">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold flex items-center gap-2 text-gray-800">🛠 AS 및 실패 리드 관리</h2>
                            <div className="flex gap-2">
                                <button onClick={() => setIssueSubTab('fail')} className={`px-4 py-2 rounded-lg text-sm font-bold border transition ${issueSubTab === 'fail' ? 'bg-red-500 text-white border-red-500 shadow-md' : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-50'}`}>🚫 실패 목록</button>
                                <button onClick={() => setIssueSubTab('as')} className={`px-4 py-2 rounded-lg text-sm font-bold border transition ${issueSubTab === 'as' ? 'bg-orange-500 text-white border-orange-500 shadow-md' : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-50'}`}>🆘 AS 요청</button>

                                {issueSubTab === 'fail' && (
                                    <select className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-red-500" value={failReasonFilter} onChange={e => setFailReasonFilter(e.target.value)}>
                                        <option value="">🔍 전체 사유</option>
                                        {reasons.map(r => <option key={r.id} value={r.reason}>{r.reason}</option>)}
                                    </select>
                                )}
                            </div>
                        </div>

                        <div className="max-h-[600px] overflow-y-auto border border-gray-200 rounded-lg">
                            <table className="w-full text-left text-sm text-gray-700">
                                <thead className="bg-gray-100 sticky top-0 z-10 text-gray-500 font-bold uppercase text-xs">
                                    <tr>
                                        <th className="p-3 w-10 text-center"><input type="checkbox" className="accent-indigo-600" onChange={(e) => handleSelectAll(e, displayedData)} checked={displayedData.length > 0 && selectedIds.length === displayedData.length} /></th>
                                        <th className="p-3">날짜</th>
                                        <th className="p-3 text-indigo-600">담당자</th>
                                        <th className="p-3">고객명</th>
                                        <th className="p-3">연락처</th>
                                        <th className="p-3">플랫폼</th>
                                        <th className="p-3">{issueSubTab === 'fail' ? '실패 사유' : 'AS 내용'}</th>
                                        <th className="p-3">관리</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {displayedData.map(c => (
                                        <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                                            <td className="p-3 text-center"><input type="checkbox" className="accent-indigo-600" checked={selectedIds.includes(c.id)} onChange={() => handleCheck(c.id)} /></td>
                                            <td className="p-3 text-gray-500">{c.upload_date}</td>
                                            <td className="p-3 font-bold text-indigo-600">{getAgentName(c.owner)}</td>
                                            <td className="p-3 font-bold">{c.name}</td>
                                            <td className="p-3 text-gray-500">{c.phone}</td>
                                            <td className="p-3"><span className="bg-gray-100 border border-gray-200 px-2 py-1 rounded text-xs text-gray-600">{c.platform}</span></td>
                                            <td className="p-3">
                                                {issueSubTab === 'fail'
                                                    ? <span className="bg-red-50 text-red-600 px-2 py-1 rounded text-xs border border-red-200 font-bold">{c.detail_reason || '사유 없음'}</span>
                                                    : <span className="text-orange-600 font-medium">{c.last_memo}</span>
                                                }
                                            </td>
                                            <td className="p-3 flex gap-2">
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

                {/* 1. [전체 DB 관리] */}
                {activeTab === 'total_manage' && (
                    <div className="animate-fade-in">
                        <div className="flex justify-between items-center mb-6"><h2 className="text-xl font-bold text-gray-800">🗂️ 전체 DB 통합 관리</h2><div className="flex gap-2 items-center bg-gray-100 p-2 rounded-lg border border-gray-200"><span className="text-sm font-bold text-gray-500 mr-2">♻️ 재분배:</span><select className="bg-white text-gray-700 p-1.5 rounded border border-gray-300 text-sm outline-none focus:border-indigo-500" value={targetAgentId} onChange={e => setTargetAgentId(e.target.value)}><option value="">이동할 상담사...</option>{agents.map(a => <option key={a.id} value={a.id}>{a.username}</option>)}</select><button onClick={() => handleAllocate(loadCurrentTabData)} className="bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded-lg font-bold text-sm shadow-sm transition">실행</button></div></div>
                        <div className="max-h-[600px] overflow-y-auto border border-gray-200 rounded-lg">
                            <table className="w-full text-left text-sm text-gray-700">
                                <thead className="bg-gray-100 sticky top-0 z-10 text-gray-500 font-bold uppercase text-xs">
                                    <tr>
                                        <th className="p-3 w-10 text-center"><input type="checkbox" className="accent-indigo-600" onChange={(e) => handleSelectAll(e, displayedData)} checked={displayedData.length > 0 && selectedIds.length === displayedData.length} /></th>
                                        <th className="p-3">등록일</th><th className="p-3 text-indigo-600">현재 담당자</th><th className="p-3">고객명</th><th className="p-3">연락처</th><th className="p-3">플랫폼</th><th className="p-3">상태</th>
                                        <th className="p-3 text-center">확인요청</th>
                                        <th className="p-3">관리</th>
                                    </tr>
                                </thead>
                                <tbody>{displayedData.map(c => (
                                    <tr key={c.id} className="border-b border-gray-100 hover:bg-indigo-50 transition">
                                        <td className="p-3 text-center"><input type="checkbox" className="accent-indigo-600" checked={selectedIds.includes(c.id)} onChange={() => handleCheck(c.id)} /></td>
                                        <td className="p-3 text-gray-500">{c.upload_date}</td><td className="p-3 font-bold text-indigo-600">{getAgentName(c.owner)}</td><td className="p-3 font-bold">{c.name}</td><td className="p-3 text-gray-500">{c.phone}</td><td className="p-3"><span className="bg-gray-100 border border-gray-200 px-2 py-1 rounded text-xs text-gray-600">{c.platform}</span></td><td className="p-3"><span className={`px-2 py-1 rounded text-xs font-bold ${getBadgeStyle(c.status)}`}>{c.status}</span></td>
                                        <td className="p-3 text-center">
                                            {c.request_status === 'REQUESTED' ? (
                                                <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full text-xs font-bold cursor-help" title={`요청내용: ${c.request_message}`}>⏳ 확인대기</span>
                                            ) : c.request_status === 'PROCESSING' ? (
                                                <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs font-bold">🚧 처리중</span>
                                            ) : c.request_status === 'COMPLETED' ? (
                                                <button onClick={() => clearRequest(c.id)} className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-bold hover:bg-green-200 transition" title="클릭하여 완료 처리">✅ 처리완료</button>
                                            ) : (
                                                <button onClick={() => openRequestModal(c)} className="text-gray-400 hover:text-indigo-600 transition text-lg" title="확인 요청 보내기">🔔</button>
                                            )}
                                        </td>
                                        <td className="p-3"><button onClick={() => handleDeleteCustomer(c.id)} className="text-red-500 hover:text-red-700 font-bold text-xs">삭제</button></td>
                                    </tr>
                                ))}</tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* 2. [공유 DB] */}
                {activeTab === 'shared' && (
                    <div className="animate-fade-in">
                        <div className="flex justify-between items-center mb-4"><h2 className="text-xl font-bold flex items-center gap-2 text-gray-800">🛒 미배정 DB 관리</h2><div className="flex gap-2"><button onClick={() => setViewDuplicatesOnly(!viewDuplicatesOnly)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border shadow-sm transition ${viewDuplicatesOnly ? 'bg-red-50 text-red-600 border-red-200' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>{viewDuplicatesOnly ? '✅ 전체 보기' : '🚫 중복 DB만 보기'}</button><select className="bg-white text-gray-700 p-2 rounded-lg border border-gray-300 text-sm outline-none focus:border-indigo-500" value={targetAgentId} onChange={e => setTargetAgentId(e.target.value)}>
                            <option value="">상담사 선택...</option>
                            <option value={currentUserId}>👤 나 (관리자)</option>
                            {agents.map(a => <option key={a.id} value={a.id}>{a.username}</option>)}
                        </select><button onClick={() => handleAllocate(loadCurrentTabData)} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-sm transition">일괄 배정</button></div></div>

                        <div className="flex gap-2 mb-4 animate-fade-in-down">
                            {SHARED_SUB_TABS.map(subTab => (
                                <button key={subTab.id} onClick={() => setSharedSubTab(subTab.id)} className={`px-4 py-1.5 rounded-full text-xs font-bold transition border ${sharedSubTab === subTab.id ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-gray-500 border-gray-200 hover:border-indigo-300 hover:text-indigo-500'}`}>{subTab.label}</button>
                            ))}
                        </div>

                        <div className="max-h-[600px] overflow-y-auto border border-gray-200 rounded-lg"><table className="w-full text-left text-sm text-gray-700"><thead className="bg-gray-100 sticky top-0 z-10 text-gray-500 font-bold uppercase text-xs"><tr><th className="p-3 w-10 text-center"><input type="checkbox" className="accent-indigo-600" onChange={(e) => handleSelectAll(e, displayedData)} checked={displayedData.length > 0 && selectedIds.length === displayedData.length} /></th><th className="p-3">날짜</th><th className="p-3">플랫폼</th><th className="p-3">이름</th><th className="p-3">번호</th><th className="p-3">광고비</th><th className="p-3">중복여부</th><th className="p-3">관리</th></tr></thead><tbody>{displayedData.map(c => {
                            const isDup = duplicateSet.has(c.phone); return (<tr key={c.id} className={`border-b border-gray-100 hover:bg-indigo-50 transition ${isDup ? 'bg-red-50' : ''}`}><td className="p-3 text-center"><input type="checkbox" className="accent-indigo-600" checked={selectedIds.includes(c.id)} onChange={() => handleCheck(c.id)} /></td><td className="p-3 text-gray-500">{c.upload_date}</td><td className="p-3"><span className="bg-gray-100 border border-gray-200 px-2 py-1 rounded text-xs text-gray-600">{c.platform}</span></td><td className="p-3 font-bold">{c.name}</td><td className="p-3 text-gray-500">{c.phone}</td><td className="p-3 font-bold text-gray-600">{(c.ad_cost || 0).toLocaleString()}</td><td className="p-3">{isDup && <span className="bg-red-100 text-red-600 border border-red-200 px-2 py-0.5 rounded text-xs font-bold">중복됨</span>}</td>
                                <td className="p-3 flex gap-2">
                                    <button onClick={() => handleAssignToMe(c.id)} className="bg-emerald-500 hover:bg-emerald-600 text-white px-2 py-1 rounded text-xs font-bold shadow-sm transition">⚡ 가져가기</button>
                                    <button onClick={() => handleDeleteCustomer(c.id)} className="text-red-500 hover:text-red-700 font-bold text-xs border border-red-100 px-2 py-1 rounded hover:bg-red-50 transition">삭제</button>
                                </td></tr>);
                        })}</tbody></table></div>
                    </div>
                )}

                {/* 3. [내 상담관리] */}
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
                        <div className="overflow-x-auto border border-gray-200 rounded-lg">
                            <table className="w-full text-left border-collapse table-fixed">
                                <thead className="bg-gray-100 text-gray-700 text-sm font-bold">
                                    <tr>
                                        <th className="p-3 w-16 text-center">번호</th><th className="p-3 w-24">플랫폼</th><th className="p-3 w-28">등록일</th><th className="p-3 w-28">이름</th><th className="p-3 w-40">연락처</th><th className="p-3 w-56 text-indigo-700">재통화(년/월/일/시)</th><th className="p-3 w-28">상태</th><th className="p-3">상담 메모</th>
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
                                            <tr key={c.id} className="border-b border-gray-100 hover:bg-yellow-50 transition">
                                                <td className="p-3 text-center text-gray-400">{c.id}</td>
                                                <td className="p-3"><span className="bg-gray-100 px-2 py-1 rounded text-xs border">{c.platform}</span></td>
                                                <td className="p-3 text-gray-500">{c.upload_date}</td>
                                                <td className="p-3 font-bold">
                                                    <div className="flex items-center gap-2">{c.name}<button onClick={(e) => handleToggleAlarm(e, c)} className={`text-sm transition-transform active:scale-95 ${isAlarmOn ? 'opacity-100' : 'opacity-30 hover:opacity-70'}`} title={isAlarmOn ? "알림 켜짐" : "알림 꺼짐"}>{isAlarmOn ? '🔔' : '🔕'}</button></div>
                                                    <div className="mt-1">{renderInteractiveStars(c.id, c.rank)}</div>
                                                </td>
                                                <td className="p-3">{c.phone}</td>
                                                <td className="p-3">
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
                                                <td className="p-3">
                                                    <select className={`w-full p-2 rounded text-xs font-bold outline-none ${getBadgeStyle(c.status)}`} value={c.status} onChange={(e) => handleStatusChangeRequest(c.id, e.target.value)}>
                                                        {STATUS_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                                    </select>
                                                </td>
                                                <td className="p-3">
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

                {/* ⭐️ [신규] 개인 메모장 */}
                {activeTab === 'notepad' && (
                    <div className="h-full flex flex-col">
                        <h2 className="text-xl font-bold mb-4 text-indigo-900 flex items-center gap-2">📝 나만의 업무 노트 <span className="text-xs font-normal text-gray-400">(자동 저장됨)</span></h2>
                        <div className="flex-1 bg-yellow-50 rounded-xl border border-yellow-200 p-6 shadow-inner relative h-[600px]">
                            <textarea className="w-full h-full bg-transparent outline-none resize-none text-gray-800 leading-relaxed text-sm font-medium placeholder-yellow-300" placeholder="자유롭게 메모하세요..." value={notepadContent} onChange={handleNotepadChange} spellCheck="false" />
                        </div>
                    </div>
                )}

                {/* [접수 관리] */}
                {activeTab === 'reception' && (
                    <div className="animate-fade-in">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold flex items-center gap-2 text-gray-800">📝 접수 관리 <span className="text-sm font-normal text-gray-400">(상태: 접수완료)</span></h2>
                            <select className="bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-gray-700 text-sm outline-none focus:border-indigo-500" value={salesAgentFilter} onChange={e => setSalesAgentFilter(e.target.value)}><option value="">👤 전체 상담사 보기</option>{agents.map(a => <option key={a.id} value={a.id}>{a.username}</option>)}</select>
                        </div>
                        <div className="max-h-[600px] overflow-y-auto border border-gray-200 rounded-lg">
                            <table className="w-full text-left text-sm text-gray-700">
                                <thead className="bg-gray-100 sticky top-0 z-10 shadow-sm text-gray-500 font-bold uppercase text-xs"><tr><th className="p-3">접수일</th><th className="p-3 text-indigo-600">담당자</th><th className="p-3">고객명</th><th className="p-3">연락처</th><th className="p-3">플랫폼</th><th className="p-3">상품/메모</th><th className="p-3">상태 변경</th></tr></thead>
                                <tbody>
                                    {displayedData.map(c => (
                                        <tr key={c.id} className="border-b border-gray-100 hover:bg-indigo-50 transition">
                                            <td className="p-3 text-gray-500">{c.upload_date}</td>
                                            <td className="p-3 font-bold text-indigo-600">{getAgentName(c.owner)}</td>
                                            <td className="p-3 font-bold">{c.name}</td>
                                            <td className="p-3 text-gray-500">{c.phone}</td>
                                            <td className="p-3"><span className="bg-gray-100 border border-gray-200 px-2 py-1 rounded text-xs text-gray-600">{c.platform}</span></td>
                                            <td className="p-3 text-gray-600 truncate max-w-[200px]">{c.product_info}</td>
                                            <td className="p-3">
                                                <select className="bg-white border border-gray-300 rounded text-xs p-1 text-gray-700 font-bold outline-none focus:border-indigo-500" value={c.status} onChange={(e) => handleInlineUpdate(c.id, 'status', e.target.value)}>
                                                    <option value="접수완료">접수완료</option>
                                                    <option value="설치완료">✅ 설치완료</option>
                                                    <option value="접수취소">🚫 취소 처리</option>
                                                </select>
                                            </td>
                                        </tr>
                                    ))}
                                    {displayedData.length === 0 && <tr><td colSpan="7" className="p-10 text-center text-gray-400">접수완료된 건이 없습니다.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* [설치 완료] */}
                {activeTab === 'installation' && (
                    <div className="animate-fade-in">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold flex items-center gap-2 text-gray-800">✅ 설치 완료 목록 <span className="text-sm font-normal text-gray-400">(현황 확인용)</span></h2>
                            <select className="bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-gray-700 text-sm outline-none focus:border-indigo-500" value={salesAgentFilter} onChange={e => setSalesAgentFilter(e.target.value)}><option value="">👤 전체 상담사 보기</option>{agents.map(a => <option key={a.id} value={a.id}>{a.username}</option>)}</select>
                        </div>
                        <div className="max-h-[600px] overflow-y-auto border border-gray-200 rounded-lg">
                            <table className="w-full text-left text-sm text-gray-700">
                                <thead className="bg-gray-100 sticky top-0 z-10 shadow-sm text-gray-500 font-bold uppercase text-xs"><tr><th className="p-3">접수일</th><th className="p-3 text-indigo-600">담당자</th><th className="p-3">고객명</th><th className="p-3">연락처</th><th className="p-3">상품</th><th className="p-3">설치일</th><th className="p-3">상태</th></tr></thead>
                                <tbody>
                                    {displayedData.map(c => (
                                        <tr key={c.id} className="border-b border-gray-100 hover:bg-green-50 transition">
                                            <td className="p-3 text-gray-500">{c.upload_date}</td>
                                            <td className="p-3 font-bold text-indigo-600">{getAgentName(c.owner)}</td>
                                            <td className="p-3 font-bold">{c.name}</td>
                                            <td className="p-3 text-gray-500">{c.phone}</td>
                                            <td className="p-3 text-gray-600 truncate max-w-[150px]">{c.product_info}</td>
                                            <td className="p-3 text-blue-600 font-bold">{c.installed_date || '-'}</td>
                                            <td className="p-3"><span className="bg-green-100 px-2 py-1 rounded text-xs text-green-700 border border-green-200 font-bold">설치완료</span></td>
                                        </tr>
                                    ))}
                                    {displayedData.length === 0 && <tr><td colSpan="7" className="p-10 text-center text-gray-400">설치 완료된 건이 없습니다.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* [정산 관리] */}
                {activeTab === 'settlement' && (
                    <div className="animate-fade-in">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold flex items-center gap-2 text-gray-800">💰 정산 실행 및 관리 <span className="text-sm font-normal text-gray-400">(설치완료건 포함)</span></h2>
                            <div className="flex gap-2">
                                <select className="bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-gray-700 text-sm outline-none focus:border-indigo-500" value={settlementStatusFilter} onChange={e => setSettlementStatusFilter(e.target.value)}>
                                    <option value="ALL">📋 전체 상태</option>
                                    <option value="설치완료">✅ 설치완료 (정산대기)</option>
                                    <option value="접수완료">접수완료</option>
                                    <option value="접수취소">취소/해지</option>
                                </select>
                                <select className="bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-gray-700 text-sm outline-none focus:border-indigo-500" value={salesAgentFilter} onChange={e => setSalesAgentFilter(e.target.value)}>
                                    <option value="">👤 전체 상담사</option>
                                    {agents.map(a => <option key={a.id} value={a.id}>{a.username}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="max-h-[600px] overflow-y-auto border border-gray-200 rounded-lg">
                            <table className="w-full text-left text-sm text-gray-700">
                                <thead className="bg-gray-100 sticky top-0 z-10 shadow-sm text-gray-500 font-bold uppercase text-xs">
                                    <tr>
                                        <th className="p-3 border-r border-gray-200">담당자/고객</th>
                                        <th className="p-3 border-r border-gray-200">상품/판매상태</th>
                                        <th className="p-3 bg-indigo-50 text-center border-r border-indigo-100">상담사 정책<br /><span className="text-[10px] text-gray-400">(입력값)</span></th>
                                        <th className="p-3 bg-indigo-50 text-center border-r border-indigo-100">본사 확정<br /><span className="text-[10px] text-indigo-400">(정산기준)</span></th>
                                        <th className="p-3 bg-indigo-50 text-center border-r border-indigo-100">검수</th>
                                        <th className="p-3 bg-indigo-50 text-center border-r border-indigo-100">지원금</th>
                                        <th className="p-3 bg-indigo-50 text-center border-r border-indigo-100">순수익</th>
                                        <th className="p-3 bg-indigo-50 text-center text-blue-600 font-bold border-r border-indigo-100">정산예정일</th>
                                        <th className="p-3 bg-indigo-50 text-center w-32">정산 상태</th>
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
                                            <tr key={c.id} className="border-b border-gray-100 hover:bg-yellow-50 transition">
                                                <td className="p-3 border-r border-gray-100">
                                                    <div className="text-indigo-600 font-bold">{getAgentName(c.owner)}</div>
                                                    <div className="font-bold text-gray-800 mt-1">{c.name}</div>
                                                    <div className="text-xs text-gray-500">{c.phone}</div>
                                                </td>
                                                <td className="p-3 text-sm text-gray-600 max-w-[200px] whitespace-normal border-r border-gray-100">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${c.status === '설치완료' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{c.status}</span>
                                                        <span className="text-xs text-gray-500 border px-1 rounded">{c.platform}</span>
                                                    </div>
                                                    {c.product_info || '-'}
                                                </td>
                                                <td className="p-3 bg-indigo-50/30 border-r border-gray-100 text-center text-gray-500 font-bold no-spin">{agentPolicy}만</td>
                                                <td className="p-3 bg-indigo-50/30 border-r border-gray-100 text-center"><input type="number" className="w-14 bg-transparent text-gray-800 text-right outline-none border-b border-gray-300 focus:border-indigo-500 font-bold no-spin" defaultValue={hqPolicy} onBlur={(e) => handleInlineUpdate(c.id, 'policy_amt', e.target.value)} />만</td>
                                                <td className="p-3 bg-indigo-50/30 border-r border-gray-100 text-center">{isMatch ? <span className="text-green-600 font-bold text-xs">✅ 일치</span> : <div className="flex flex-col items-center"><span className="text-red-500 font-bold text-xs">⚠️ 불일치</span><span className="text-[10px] text-red-400 font-bold">({diff > 0 ? `+${diff}` : diff}만)</span></div>}</td>
                                                <td className="p-3 bg-indigo-50/30 border-r border-gray-100 text-center"><input type="number" className="w-14 bg-transparent text-gray-600 text-right outline-none border-b border-gray-300 focus:border-indigo-500 no-spin" defaultValue={c.support_amt} onBlur={(e) => handleInlineUpdate(c.id, 'support_amt', e.target.value)} />만</td>
                                                <td className={`p-3 bg-indigo-50/30 border-r border-gray-100 font-bold text-right ${netProfit < 0 ? 'text-red-500' : 'text-green-600'}`}>{netProfit.toLocaleString()}원</td>
                                                <td className="p-3 bg-indigo-50/30 border-r border-gray-100 text-center"><input type="date" className="bg-transparent text-gray-700 text-xs outline-none w-28 hover:text-indigo-600 cursor-pointer border-b border-gray-300 focus:border-indigo-500 text-center font-bold" value={c.settlement_due_date || ''} onChange={(e) => handleInlineUpdate(c.id, 'settlement_due_date', e.target.value)} /></td>
                                                <td className="p-3 bg-indigo-50/30 text-center align-top">
                                                    <select className={`w-full bg-white text-gray-700 text-xs p-1.5 rounded border border-gray-300 outline-none mb-1 font-bold ${c.settlement_status === '정산완료' ? 'text-green-600 border-green-500 bg-green-50' : ''} ${c.settlement_status === '미정산' ? 'text-red-500 bg-red-50 border-red-200' : ''}`} value={c.settlement_status || '미정산'} onChange={(e) => handleInlineUpdate(c.id, 'settlement_status', e.target.value)}>
                                                        {settlementStatuses.map(s => <option key={s.id} value={s.status}>{s.status}</option>)}
                                                        {settlementStatuses.length === 0 && <><option value="미정산">미정산</option><option value="정산완료">정산완료</option></>}
                                                    </select>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {displayedData.length === 0 && <tr><td colSpan="10" className="p-10 text-center text-gray-400">정산 대상 데이터가 없습니다.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* 8. [상담사 관리] */}
                {activeTab === 'users' && (
                    <div className="flex gap-6 h-full animate-fade-in">
                        <div className="w-1/3 bg-white p-6 rounded-xl border border-gray-200 shadow-md h-fit">
                            <h3 className="font-bold mb-6 text-lg text-indigo-900 border-b border-gray-100 pb-2">➕ 신규 상담사 등록</h3>
                            <input className="w-full bg-gray-50 p-3 rounded-lg mb-3 border border-gray-300 text-gray-800 text-sm outline-none focus:border-indigo-500 transition" placeholder="아이디 (ID)" value={newAgent.username} onChange={e => setNewAgent({ ...newAgent, username: e.target.value })} />
                            <input type="password" className="w-full bg-gray-50 p-3 rounded-lg mb-6 border border-gray-300 text-gray-800 text-sm outline-none focus:border-indigo-500 transition" placeholder="비밀번호 (Password)" value={newAgent.password} onChange={e => setNewAgent({ ...newAgent, password: e.target.value })} />
                            <button onClick={handleCreateAgent} className="w-full bg-indigo-600 hover:bg-indigo-700 py-3 rounded-lg text-white font-bold transition shadow-lg transform hover:-translate-y-0.5">상담사 계정 생성</button>
                        </div>
                        <div className="w-2/3 bg-white p-6 rounded-xl border border-gray-200 shadow-md flex flex-col">
                            <h3 className="font-bold mb-4 text-lg text-gray-800">👥 등록된 상담사 목록</h3>
                            <div className="flex-1 overflow-y-auto border border-gray-200 rounded-lg">
                                <table className="w-full text-sm text-left text-gray-700">
                                    <thead className="bg-gray-100 text-gray-500 uppercase text-xs sticky top-0"><tr><th className="p-3">아이디</th><th className="p-3 text-right">관리</th></tr></thead>
                                    <tbody>{agents.map(a => <tr key={a.id} className="border-b border-gray-100 hover:bg-gray-50"><td className="p-3 font-bold">{a.username}</td><td className="p-3 text-right"><button onClick={() => handleDeleteAgent(a.id, a.username)} className="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1 rounded text-xs font-bold transition">계정 삭제</button></td></tr>)}</tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* 9. [설정] ⭐️ 대폭 수정됨 (요청하신 UI 반영) */}
                {activeTab === 'settings' && (
                    <div className="flex gap-6 h-[750px] animate-fade-in">
                        {/* 왼쪽 사이드바 (기타 설정 - 기존 유지) */}
                        <div className="w-1/3 flex flex-col gap-4 overflow-y-auto pr-2 custom-scrollbar">
                            <div className="bg-white p-6 rounded-xl border border-indigo-200 relative overflow-hidden shadow-md">
                                <div className="absolute top-0 right-0 bg-indigo-100 px-2 py-1 text-[10px] font-bold text-indigo-600 rounded-bl-lg">마케팅 설정</div>
                                <h3 className="font-bold mb-4 text-indigo-800 text-sm">📢 광고 채널 및 단가</h3>
                                <div className="flex gap-2 mb-4">
                                    <input className="w-1/2 bg-gray-50 p-2 rounded border border-gray-300 text-gray-800 text-xs outline-none focus:border-indigo-500" placeholder="채널명" value={newAdChannel.name} onChange={e => setNewAdChannel({ ...newAdChannel, name: e.target.value })} />
                                    <input type="number" className="w-1/3 bg-gray-50 p-2 rounded border border-gray-300 text-gray-800 text-xs outline-none focus:border-indigo-500" placeholder="단가" value={newAdChannel.cost} onChange={e => setNewAdChannel({ ...newAdChannel, cost: e.target.value })} />
                                    <button onClick={handleAddAdChannel} className="bg-indigo-600 px-3 rounded text-white font-bold text-xs hover:bg-indigo-700 transition">추가</button>
                                </div>
                                <div className="max-h-40 overflow-y-auto space-y-2">
                                    {adChannels.map(ad => (
                                        <div key={ad.id} className="flex justify-between items-center bg-indigo-50 px-3 py-2 rounded border border-indigo-100">
                                            <span className="text-xs font-bold text-indigo-700">{ad.name}</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] text-gray-500">{parseInt(ad.cost).toLocaleString()}원</span>
                                                <button onClick={() => handleDeleteAdChannel(ad.id)} className="text-red-400 hover:text-red-600 font-bold">×</button>
                                            </div>
                                        </div>
                                    ))}
                                    {adChannels.length === 0 && <div className="text-center text-gray-400 text-[10px] py-2">등록된 채널 없음</div>}
                                </div>
                            </div>
                            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                                <h3 className="font-bold mb-2 text-sm text-gray-700">🚫 실패 사유 관리</h3>
                                <div className="flex gap-2 mb-3"><input className="bg-gray-50 p-2 rounded flex-1 border border-gray-300 text-gray-800 text-xs outline-none focus:border-red-400" placeholder="사유 입력" value={newReason} onChange={e => setNewReason(e.target.value)} /><button onClick={handleAddReason} className="bg-red-500 hover:bg-red-600 px-3 rounded text-white font-bold text-xs transition">추가</button></div>
                                <div className="flex flex-wrap gap-2">{reasons.map(r => <span key={r.id} className="bg-red-50 text-red-600 px-2 py-1 rounded text-[10px] border border-red-100 flex items-center gap-1 font-bold">{r.reason}<button onClick={() => handleDeleteReason(r.id)} className="hover:text-red-800">×</button></span>)}</div>
                            </div>
                            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                                <h3 className="font-bold mb-2 text-sm text-teal-700">📞 상담 상태값 관리</h3>
                                <div className="flex gap-2 mb-3">
                                    <input className="bg-gray-50 p-2 rounded flex-1 border border-gray-300 text-gray-800 text-xs outline-none focus:border-teal-400" placeholder="예: 재통화" value={newStatus} onChange={e => setNewStatus(e.target.value)} />
                                    <button onClick={handleAddStatus} className="bg-teal-600 hover:bg-teal-700 px-3 rounded text-white font-bold text-xs transition">추가</button>
                                </div>
                                <div className="flex flex-wrap gap-2">{customStatuses.map(s => <span key={s.id} className="bg-teal-50 text-teal-700 px-2 py-1 rounded-full text-[10px] border border-teal-100 flex items-center gap-1 font-bold">{s.status}<button onClick={() => handleDeleteStatus(s.id)} className="hover:text-teal-900">×</button></span>)}</div>
                            </div>
                            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                                <h3 className="font-bold mb-2 text-sm text-orange-600">💰 정산 상태값 관리</h3>
                                <div className="flex gap-2 mb-3"><input className="bg-gray-50 p-2 rounded flex-1 border border-gray-300 text-gray-800 text-xs outline-none focus:border-orange-400" placeholder="예: 부분정산" value={newSettlementStatus} onChange={e => setNewSettlementStatus(e.target.value)} /><button onClick={handleAddSettlementStatus} className="bg-orange-500 hover:bg-orange-600 px-3 rounded text-white font-bold text-xs transition">추가</button></div>
                                <div className="flex flex-wrap gap-2">{settlementStatuses.map(s => <span key={s.id} className="bg-orange-50 text-orange-600 px-2 py-1 rounded-full text-[10px] border border-orange-100 flex items-center gap-1 font-bold">{s.status}<button onClick={() => handleDeleteSettlementStatus(s.id)} className="hover:text-orange-800">×</button></span>)}</div>
                            </div>
                        </div>

                        {/* ⭐️ 오른쪽 메인: 상품 정책 관리 (요청하신 디자인 반영) */}
                        <div className="flex-1 bg-white rounded-xl border border-gray-300 flex flex-col shadow-xl overflow-hidden p-6">
                            <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
                                <h3 className="text-xl font-bold text-gray-800">🛠️ 상품 및 정책 관리</h3>
                                <div className="flex gap-2">
                                    {Object.keys(policyData).map(tab => (
                                        <button key={tab} onClick={() => setActivePolicyTab(tab)} className={`px-4 py-2 rounded-lg font-bold text-sm transition border ${activePolicyTab === tab ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>
                                            {tab}
                                            {Object.keys(policyData).length > 1 && <span onClick={(e) => { e.stopPropagation(); handleDeleteCarrierTab(tab); }} className="ml-2 text-xs opacity-50 hover:opacity-100">x</span>}
                                        </button>
                                    ))}
                                    <button onClick={handleAddCarrierTab} className="px-3 py-2 rounded-lg font-bold text-sm bg-gray-100 text-gray-600 hover:bg-gray-200">+</button>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                                {/* 1. 인터넷 단독 */}
                                <div className="mb-8">
                                    <div className="flex justify-between items-center mb-3">
                                        <h4 className="font-bold text-lg text-gray-800">인터넷 단독</h4>
                                        <button onClick={() => handleAddPolicyItem('internet')} className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-xs font-bold shadow transition">+ 추가</button>
                                    </div>
                                    <div className="grid grid-cols-3 gap-4">
                                        {policyData[activePolicyTab].internet.map((p, idx) => (
                                            <div key={p.id} className="border border-gray-200 rounded-lg p-3 bg-white shadow-sm hover:shadow-md transition relative group">
                                                <button onClick={() => handleDeletePolicyItem('internet', idx)} className="absolute top-2 right-2 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition">✖</button>
                                                <div className="text-xs font-bold text-gray-400 mb-1">{idx + 1}.</div>
                                                <input className="w-full border border-gray-300 rounded p-2 mb-2 text-sm font-bold text-gray-800 outline-none focus:border-indigo-500" placeholder="상품명" value={p.name} onChange={(e) => handleUpdatePolicyData('internet', idx, 'name', e.target.value)} />
                                                <input className="w-full border border-gray-300 rounded p-2 mb-2 text-sm text-gray-600 outline-none focus:border-indigo-500" placeholder="정책금" value={p.policy} onChange={(e) => handleUpdatePolicyData('internet', idx, 'policy', e.target.value)} />
                                                <input className="w-full border border-gray-300 rounded p-2 mb-2 text-sm text-gray-600 outline-none focus:border-indigo-500" placeholder="지원금" value={p.support} onChange={(e) => handleUpdatePolicyData('internet', idx, 'support', e.target.value)} />
                                                <input className="w-full border border-gray-300 rounded p-2 text-sm text-gray-600 outline-none focus:border-indigo-500 bg-gray-50" placeholder="총합" value={p.total} onChange={(e) => handleUpdatePolicyData('internet', idx, 'total', e.target.value)} />
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* 2. 번들 */}
                                <div className="mb-8">
                                    <div className="flex justify-between items-center mb-3">
                                        <h4 className="font-bold text-lg text-gray-800">번들</h4>
                                        <button onClick={() => handleAddPolicyItem('bundle')} className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-xs font-bold shadow transition">+ 추가</button>
                                    </div>
                                    <div className="space-y-2">
                                        {policyData[activePolicyTab].bundle.map((p, idx) => (
                                            <div key={p.id} className="flex gap-2 items-center group relative">
                                                <button onClick={() => handleDeletePolicyItem('bundle', idx)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition absolute -left-6">✖</button>
                                                <span className="font-bold text-sm w-6 text-gray-500">{idx + 1}.</span>
                                                <input className="flex-1 border border-gray-300 rounded p-2 text-sm font-bold text-gray-800 outline-none focus:border-indigo-500" placeholder="상품명" value={p.name} onChange={(e) => handleUpdatePolicyData('bundle', idx, 'name', e.target.value)} />
                                                <input className="w-24 border border-gray-300 rounded p-2 text-sm text-gray-600 outline-none focus:border-indigo-500" placeholder="정책" value={p.policy} onChange={(e) => handleUpdatePolicyData('bundle', idx, 'policy', e.target.value)} />
                                                <input className="w-24 border border-gray-300 rounded p-2 text-sm text-gray-600 outline-none focus:border-indigo-500" placeholder="지원" value={p.support} onChange={(e) => handleUpdatePolicyData('bundle', idx, 'support', e.target.value)} />
                                                <input className="w-24 border border-gray-300 rounded p-2 text-sm text-gray-600 outline-none focus:border-indigo-500 bg-gray-50" placeholder="총합" value={p.total} onChange={(e) => handleUpdatePolicyData('bundle', idx, 'total', e.target.value)} />
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* 3. 추가 */}
                                <div className="mb-8">
                                    <div className="flex justify-between items-center mb-3">
                                        <h4 className="font-bold text-lg text-gray-800">추가</h4>
                                        <button onClick={() => handleAddPolicyItem('addon')} className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-xs font-bold shadow transition">+ 추가</button>
                                    </div>
                                    <div className="grid grid-cols-3 gap-4">
                                        {policyData[activePolicyTab].addon.map((p, idx) => (
                                            <div key={p.id} className="flex gap-2 relative group">
                                                <button onClick={() => handleDeletePolicyItem('addon', idx)} className="absolute -top-2 -right-2 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition bg-white rounded-full border shadow-sm w-5 h-5 flex items-center justify-center text-[10px]">✖</button>
                                                <input className="w-full border border-gray-300 rounded p-2 text-sm font-bold text-gray-800 outline-none focus:border-indigo-500" placeholder="상품명" value={p.name} onChange={(e) => handleUpdatePolicyData('addon', idx, 'name', e.target.value)} />
                                                <input className="w-full border border-gray-300 rounded p-2 text-sm text-gray-600 outline-none focus:border-indigo-500" placeholder="비용" value={p.policy} onChange={(e) => handleUpdatePolicyData('addon', idx, 'policy', e.target.value)} />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="mt-4 pt-4 border-t border-gray-100">
                                <button onClick={handleSaveSettings} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold shadow-md transition transform active:scale-95">저장</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {showUploadModal && <div className="fixed inset-0 bg-black/40 flex justify-center items-center backdrop-blur-sm z-50"><div className="bg-white p-8 rounded-2xl w-[600px] border border-gray-200 shadow-2xl animate-fade-in-up"><h2 className="text-2xl font-bold mb-4 text-indigo-900">📤 엑셀 복사 등록</h2><textarea placeholder="엑셀에서 복사한 내용을 붙여넣으세요... (이름 / 전화번호 / 플랫폼 / 메모)" className="w-full h-48 bg-gray-50 p-4 rounded-xl border border-gray-300 text-sm font-mono mb-6 text-gray-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition" value={pasteData} onChange={handlePaste} /><div className="flex justify-end gap-3"><button onClick={() => setShowUploadModal(false)} className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg font-bold transition">취소</button><button onClick={handleBulkSubmit} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-md transition">일괄 등록하기</button></div></div></div>}
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
            {memoPopupTarget && (<div className="fixed inset-0 bg-black/40 flex justify-center items-center backdrop-blur-sm z-50"><div className="bg-white p-6 rounded-2xl w-[400px] border border-gray-200 shadow-2xl animate-fade-in-up"><h2 className="text-lg font-bold mb-3 text-indigo-800 border-b border-gray-100 pb-2">{memoFieldType === 'additional_info' ? '📝 후처리 메모' : '💬 상담 내용 메모'}</h2><textarea ref={memoInputRef} className="w-full h-40 bg-gray-50 p-4 rounded-xl border border-gray-300 text-sm text-gray-800 resize-none outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition" value={memoPopupText} onChange={e => setMemoPopupText(e.target.value)} placeholder="내용을 입력하세요..." /><div className="flex justify-end gap-2 mt-4"><button onClick={() => setMemoPopupTarget(null)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg font-bold transition">취소</button><button onClick={saveMemoPopup} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-md transition">저장</button></div></div></div>)}
            {showResponseModal && responseTarget && (<div className="fixed inset-0 bg-black/40 flex justify-center items-center backdrop-blur-sm z-50"><div className="bg-white p-6 rounded-2xl w-[400px] border border-gray-200 shadow-2xl animate-fade-in-up"><h2 className="text-xl font-bold mb-4 text-indigo-900 border-b border-gray-100 pb-2 flex items-center gap-2">🔔 관리자 확인 요청</h2><div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200 mb-6"><span className="text-xs font-bold text-yellow-700 block mb-1">요청 내용:</span><p className="text-sm text-gray-800 font-medium">{responseTarget.request_message || "내용 없음"}</p></div><div className="flex flex-col gap-3"><button onClick={() => handleResponse('PROCESSING')} className="w-full py-3 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-xl font-bold transition flex items-center justify-center gap-2">🚧 지금 확인 중입니다</button><button onClick={() => handleResponse('COMPLETED')} className="w-full py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-bold shadow-md transition flex items-center justify-center gap-2">✅ 처리 완료했습니다</button></div><div className="mt-4 text-center"><button onClick={() => setShowResponseModal(false)} className="text-xs text-gray-400 hover:text-gray-600">닫기</button></div></div></div>)}
            {showRequestModal && requestTarget && (<div className="fixed inset-0 bg-black/40 flex justify-center items-center backdrop-blur-sm z-50"><div className="bg-white p-6 rounded-2xl w-[400px] border border-gray-200 shadow-2xl animate-fade-in-up"><h2 className="text-xl font-bold mb-4 text-indigo-900 border-b border-gray-100 pb-2 flex items-center gap-2">🔔 관리자 확인 요청</h2><textarea className="w-full h-32 bg-gray-50 p-3 rounded-lg border border-gray-300 text-sm outline-none resize-none mb-4 focus:border-indigo-500 transition" placeholder="요청 사항을 입력하세요..." value={requestMessage} onChange={(e) => setRequestMessage(e.target.value)} /><div className="flex justify-end gap-2"><button onClick={() => setShowRequestModal(false)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg font-bold transition">취소</button><button onClick={sendRequest} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-md transition">요청 보내기</button></div></div></div>)}
            {showCustomModal && (<PopoutWindow title="🎨 통계 화면 커스터마이징" onClose={() => setShowCustomModal(false)}><div className="bg-white h-full flex flex-col p-6"><h2 className="text-xl font-bold mb-6 flex items-center gap-2"><span>👁️</span> 표시할 항목 선택</h2><div className="mb-8"><h3 className="font-bold text-gray-800 mb-4 border-b border-gray-100 pb-2">📋 테이블 컬럼</h3><div className="grid grid-cols-3 gap-4">{Object.keys(INITIAL_VISIBLE_COLUMNS).map(col => (<label key={col} className="flex items-center gap-2 p-3 rounded-lg border border-gray-100 bg-gray-50 hover:bg-white hover:shadow-sm cursor-pointer transition"><input type="checkbox" className="w-5 h-5 accent-indigo-600 rounded" checked={visibleColumns[col]} onChange={() => handleColumnToggle(col)} /><span className="text-sm font-medium text-gray-700">{col === 'owner_name' ? '담당자' : col === 'db' ? '디비' : col === 'accepted' ? '접수' : col === 'installed' ? '설치' : col === 'canceled' ? '취소' : col === 'adSpend' ? '광고비' : col === 'acceptedRevenue' ? '접수매출' : col === 'installedRevenue' ? '설치매출' : col === 'netProfit' ? '순이익' : col === 'acceptRate' ? '접수율' : col === 'cancelRate' ? '취소율' : col === 'netInstallRate' ? '순청약율' : '평균마진'}</span></label>))}</div></div><div><h3 className="font-bold text-gray-800 mb-4 border-b border-gray-100 pb-2">📊 상단 지표 카드</h3><div className="grid grid-cols-2 gap-4">{Object.keys(INITIAL_VISIBLE_CARDS).map(card => (<label key={card} className="flex items-center gap-2 p-3 rounded-lg border border-gray-100 bg-gray-50 hover:bg-white hover:shadow-sm cursor-pointer transition"><input type="checkbox" className="w-5 h-5 accent-blue-600 rounded" checked={visibleCards[card]} onChange={() => handleCardToggle(card)} /><span className="text-sm font-medium text-gray-700">{card === 'adSpend' ? '💰 총 광고비' : card === 'acceptedRevenue' ? '📝 접수완료매출' : card === 'installedRevenue' ? '✅ 설치완료매출' : card === 'netProfit' ? '🎯 순이익' : card === 'totalDB' ? '📊 총 디비건수' : card === 'acceptedCount' ? '📋 접수건수' : card === 'installCount' ? '✨ 설치건수' : card === 'cancelRate' ? '⚠️ 취소율' : '🎉 순청약율'}</span></label>))}</div></div><div className="mt-auto pt-6 border-t border-gray-100 flex justify-end"><button onClick={() => setShowCustomModal(false)} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-md transition">설정 완료</button></div></div></PopoutWindow>)}
        </div>
    );
}

export default AdminDashboard;
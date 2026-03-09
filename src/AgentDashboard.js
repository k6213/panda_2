import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';

// ==================================================================================
// 1. 상수 및 설정값
// ==================================================================================
const API_BASE = "http://127.0.0.1:8000";

// ⭐️ 화면 렌더링용 상수
const TIME_OPTIONS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];


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

const PopoutWindow = ({ title, onClose, children, width = 600, height = 800, windowKey = 'default_popup_pos', trigger }) => {
    const [containerEl, setContainerEl] = useState(null);
    const externalWindow = useRef(null);

    const initWindow = useCallback(() => {
        const savedPos = localStorage.getItem(windowKey);
        let left = (window.screen.width - width) / 2;
        let top = (window.screen.height - height) / 2;

        if (savedPos) {
            try {
                const parsed = JSON.parse(savedPos);
                left = parsed.x;
                top = parsed.y;
            } catch (e) { }
        }

        // 창이 없거나 닫혔을 때만 새로 엽니다.
        if (!externalWindow.current || externalWindow.current.closed) {
            externalWindow.current = window.open("", windowKey,
                `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes`
            );
        }

        const win = externalWindow.current;
        if (!win) return;

        // ⭐️ [핵심] 창이 이미 있어도 다시 포커스하고 저장된 위치로 이동
        win.focus();
        try {
            win.moveTo(left, top);
            win.resizeTo(width, height);
        } catch (e) { }

        if (!win.document.getElementById('popout-root')) {
            win.document.open();
            win.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8" /><title>${title}</title>
                    <style>body{margin:0;padding:0;background:#fff;} #popout-root{height:100vh;overflow:hidden;} ::-webkit-scrollbar{display:none;}</style>
                </head>
                <body><div id="popout-root"></div></body>
                </html>
            `);
            win.document.close();
            document.querySelectorAll('link[rel="stylesheet"]').forEach(n => win.document.head.appendChild(n.cloneNode(true)));
            document.querySelectorAll('style').forEach(n => win.document.head.appendChild(n.cloneNode(true)));
            const s = win.document.createElement('script');
            s.src = "https://cdn.tailwindcss.com";
            win.document.head.appendChild(s);
        }

        const container = win.document.getElementById('popout-root');
        if (container) setContainerEl(container);
    }, [title, width, height, windowKey]);

    useEffect(() => {
        initWindow(); // ⭐️ trigger가 바뀔 때마다 이 함수가 실행됩니다.
    }, [initWindow, trigger]); // ⭐️ trigger를 감시합니다.

    useEffect(() => {
        const win = externalWindow.current;
        const timer = setInterval(() => {
            if (!win || win.closed) {
                clearInterval(timer);
                onClose();
            } else {
                localStorage.setItem(windowKey, JSON.stringify({ x: win.screenX, y: win.screenY }));
            }
        }, 1000);
        return () => clearInterval(timer);
    }, [windowKey, onClose]);

    return containerEl ? ReactDOM.createPortal(children, containerEl) : null;
};


// 탭 기본 정보 정의 (ID, 라벨, 기본 표시 여부)
const DEFAULT_TABS_AGENT = [
    { id: 'shared', label: '🛒 미배정(공유)', visible: true },
    { id: 'consult', label: '📞 상담', visible: true },
    { id: 'long_term', label: '📅 가망', visible: true },
    { id: 'reception', label: '📝 접수', visible: true },
    { id: 'installation', label: '✅ 설치완료', visible: true },
    { id: 'stats', label: '📊 통계', visible: true },
    { id: 'notepad', label: 'To-Do 리스트', visible: true },
    { id: 'work_memo', label: '📒 메모장', visible: true }
];

// ==================================================================================
// 4. 메인 컴포넌트
// ==================================================================================
function AgentDashboard({ user, onLogout }) {
    // ==========================================================================
    // 1. 모든 useState (상태 선언) - 최상단 배치
    // ==========================================================================
    const [config, setConfig] = useState(() => {
        try {
            const cached = localStorage.getItem('agent_system_config');
            return cached ? JSON.parse(cached) : null;
        } catch (e) { return null; }
    });

    const [activeTab, setActiveTab] = useState('shared');
    const [statDate, setStatDate] = useState(() => new Date().toISOString().substring(0, 7));
    const [statPeriodType, setStatPeriodType] = useState('month');
    const [statPlatform, setStatPlatform] = useState('ALL');
    const [selectedStatAgent, setSelectedStatAgent] = useState('ALL');
    const [serverStats, setServerStats] = useState(null);
    const [allCustomers, setAllCustomers] = useState([]);
    const [sharedCustomers, setSharedCustomers] = useState([]);
    const [agents, setAgents] = useState([]);
    const [notices, setNotices] = useState([]);
    const [policyImages, setPolicyImages] = useState({});

    const [issueCustomers, setIssueCustomers] = useState([]);

    // 누락되었던 상태값들 복구
    const [adChannels, setAdChannels] = useState([]);
    const [reasons, setReasons] = useState([]);
    const [cancelReasons, setCancelReasons] = useState([]);

    const [isPolicyDragOver, setIsPolicyDragOver] = useState(false);
    const [focusedPolicyImage, setFocusedPolicyImage] = useState(null);
    const [chatFile, setChatFile] = useState(null);
    const [selectedIds, setSelectedIds] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortOrder, setSortOrder] = useState('desc');
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [viewDuplicatesOnly, setViewDuplicatesOnly] = useState(false);
    const [targetAgentId, setTargetAgentId] = useState('');
    const [dateFilter, setDateFilter] = useState({
        type: 'this_month',
        start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
        end: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0]
    });


    // 각 팝업마다 리프레시용 숫자를 만듭니다.
    const [completionTrigger, setCompletionTrigger] = useState(0);
    const [policyViewerTrigger, setPolicyViewerTrigger] = useState(0);

    const currentUserId = user ? String(user.user_id || user.id) : null;

    // ==========================================================================
    // 2. 기초 인증 함수 (가장 먼저 선언)
    // ==========================================================================
    const getAuthHeaders = useCallback(() => {
        const token = sessionStorage.getItem('token');
        return { 'Content-Type': 'application/json', 'Authorization': `Token ${token}` };
    }, []);

    // ==========================================================================
    // 3. 개별 데이터 취득 함수 (getAuthHeaders 사용)
    // ==========================================================================
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

    const fetchAgents = useCallback(() => {
        fetch(`${API_BASE}/api/agents/`, { headers: getAuthHeaders() })
            .then(res => res.json())
            .then(setAgents);
    }, [getAuthHeaders]);

    const fetchNoticesAndPolicies = useCallback(() => {
        const headers = getAuthHeaders();
        fetch(`${API_BASE}/api/notices/`, { headers }).then(res => res.json()).then(setNotices);
        fetch(`${API_BASE}/api/policies/latest/`, { headers })
            .then(res => res.ok ? res.json() : {})
            .then(setPolicyImages);
    }, [getAuthHeaders]);

    const fetchStatistics = useCallback(async () => {
        if (!user || activeTab !== 'stats') return;
        let url = `${API_BASE}/api/stats/advanced/?platform=${statPlatform}`;
        if (statPeriodType === 'month') url += `&start_date=${statDate}`;
        else if (statPeriodType === 'day') url += `&start_date=${statDate}&end_date=${statDate}`;
        try {
            const res = await fetch(url, { headers: getAuthHeaders() });
            if (res.ok) setServerStats(await res.json());
        } catch (err) { console.error(err); }
    }, [user, activeTab, statDate, statPeriodType, statPlatform, getAuthHeaders]);

    // ==========================================================================
    // 4. 종합 실행 함수 (상위 함수들을 호출)
    // ==========================================================================
    const loadCurrentTabData = useCallback(() => {
        setSelectedIds([]);
        if (activeTab === 'stats') {
            fetchStatistics();
        } else {
            fetchAllData();
            fetchAgents();
            fetchNoticesAndPolicies();
            fetchAssignedTasks();

            const headers = getAuthHeaders();
            fetch(`${API_BASE}/api/ad_channels/`, { headers }).then(res => res.json()).then(setAdChannels).catch(() => { });
            fetch(`${API_BASE}/api/failure_reasons/`, { headers }).then(res => res.json()).then(setReasons).catch(() => { });
            fetch(`${API_BASE}/api/cancel_reasons/`, { headers }).then(res => res.json()).then(setCancelReasons).catch(() => { });
        }
    }, [activeTab, fetchAllData, fetchAgents, fetchNoticesAndPolicies, fetchStatistics, getAuthHeaders]);

    const [periodFilter, setPeriodFilter] = useState('month');
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [chatView, setChatView] = useState('LIST');
    const [chatTarget, setChatTarget] = useState(null);
    const [chatListSearch, setChatListSearch] = useState('');
    const [chatMessages, setChatMessages] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [chatInputNumber, setChatInputNumber] = useState('');

    const [bankList, setBankList] = useState([]);

    const [clientFilter, setClientFilter] = useState('ALL'); // 정산 탭 필터링

    // 정책 데이터
    const [policyData, setPolicyData] = useState(() => {
        try {
            const saved = localStorage.getItem('agent_policy_data');
            return saved ? JSON.parse(saved) : INITIAL_POLICY_DATA;
        } catch { return INITIAL_POLICY_DATA; }
    });
    const [activePolicyTab, setActivePolicyTab] = useState('KT');



    const [issueSubTab, setIssueSubTab] = useState('fail');
    const [failReasonFilter, setFailReasonFilter] = useState('');
    const [totalDbAgentFilter, setTotalDbAgentFilter] = useState('');
    const [salesAgentFilter, setSalesAgentFilter] = useState('');
    const [settlementStatusFilter, setSettlementStatusFilter] = useState('ALL');
    const [statusFilter, setStatusFilter] = useState('ALL');

    // 🟢 상담사 페이지에서도 목록 조회를 위해 필요한 상태값들

    const [sharedSubTab, setSharedSubTab] = useState('ALL');

    const [showNotiDropdown, setShowNotiDropdown] = useState(false);
    const [pasteData, setPasteData] = useState('');
    const [parsedData, setParsedData] = useState([]);

    // 🟢 [신규] 등록 모달 모드 (single: 건별등록 / bulk: 엑셀일괄)
    const [uploadMode, setUploadMode] = useState('single');

    // 🟢 [신규] 건별 등록 입력 데이터
    const [singleData, setSingleData] = useState({
        platform: 'KT',       // 기본 선택값
        manualPlatform: '',   // 직접 입력값
        isManual: false,      // 직접 입력 모드 여부
        name: '',
        phone: '',
        memo: ''
    });


    // 탭 설정 로드 (순서 + 보이기/숨기기)
    const [tabsConfig, setTabsConfig] = useState(() => {
        const saved = localStorage.getItem('agent_tabs_v1');
        return saved ? JSON.parse(saved) : DEFAULT_TABS_AGENT;
    });

    const [draggedTabIdx, setDraggedTabIdx] = useState(null);
    const [showTabSettings, setShowTabSettings] = useState(false); // 탭 숨기기 설정 모달 토글

    // 설정 변경 시 저장
    useEffect(() => {
        localStorage.setItem('agent_tabs_v1', JSON.stringify(tabsConfig));
    }, [tabsConfig]);

    // -------------------------------------------------------------------------
    // 🛠️ 탭 드래그 앤 드롭 핸들러
    // -------------------------------------------------------------------------
    const handleTabDragStart = (idx) => {
        setDraggedTabIdx(idx);
    };

    const handleTabDrop = (targetIdx) => {
        if (draggedTabIdx === null || draggedTabIdx === targetIdx) return;

        const newTabs = [...tabsConfig];
        const draggedItem = newTabs.splice(draggedTabIdx, 1)[0];
        newTabs.splice(targetIdx, 0, draggedItem);

        setTabsConfig(newTabs);
        setDraggedTabIdx(null);
    };

    const toggleTabVisibility = (id) => {
        setTabsConfig(prev => prev.map(t =>
            t.id === id ? { ...t, visible: !t.visible } : t
        ));
    };

    // 1. 받은 지시사항 데이터 불러오기 함수
    const fetchAssignedTasks = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/api/todos/assigned/`, {
                headers: getAuthHeaders()
            });
            if (res.ok) {
                const data = await res.json();
                setAssignedTasks(data);
            }
        } catch (e) {
            console.error("지시사항 로드 실패:", e);
        }
    }, [getAuthHeaders]);

    // 2. 지시사항 완료 처리 함수 (완료 버튼 클릭 시 실행)
    const handleToggleAssignedTask = async (taskId) => {
        try {
            const res = await fetch(`${API_BASE}/api/todos/${taskId}/`, {
                method: 'PATCH',
                headers: getAuthHeaders(),
                body: JSON.stringify({ is_completed: true }) // 완료 상태로 변경
            });

            if (res.ok) {
                alert("✅ 업무가 완료 처리되었습니다.");
                fetchAssignedTasks(); // 목록 새로고침
            } else {
                alert("처리 중 오류가 발생했습니다.");
            }
        } catch (e) {
            alert("서버와 통신할 수 없습니다.");
        }
    };

    // 🟢 [수정] 건별 등록 제출 핸들러 (직접 입력값 자동 저장 기능 추가)
    const handleSingleSubmit = async () => {
        // 1. 플랫폼 값 결정
        const finalPlatform = singleData.isManual
            ? singleData.manualPlatform.trim()
            : singleData.platform;

        // 2. 유효성 검사
        if (!finalPlatform) return alert("통신사(플랫폼)를 선택하거나 입력해주세요.");
        if (!singleData.name.trim()) return alert("고객명을 입력해주세요.");
        if (!singleData.phone.trim()) return alert("연락처를 입력해주세요.");

        // 3. ⭐️ [핵심 추가] 직접 입력한 플랫폼이 기존 리스트에 없다면 자동으로 추가
        if (singleData.isManual && !platformList.includes(finalPlatform)) {
            const updatedList = [...platformList, finalPlatform];
            setPlatformList(updatedList);
            // 로컬스토리지에도 즉시 저장 (useEffect가 있지만 명시적으로 저장)
            localStorage.setItem('admin_platform_list', JSON.stringify(updatedList));
        }

        // 4. 전송할 데이터 구성
        const newCustomer = {
            owner_id: currentUserId,
            platform: finalPlatform, // ⭐️ 결정된 플랫폼 값 사용
            name: singleData.name.trim(),
            phone: singleData.phone.trim(),
            last_memo: singleData.memo,
            status: activeTab === 'consult' ? '미통건' :
                activeTab === 'long_term' ? '장기가망' :
                    activeTab === 'reception' ? '접수완료' : '미통건',
            upload_date: new Date().toISOString().split('T')[0]
        };

        try {
            const res = await fetch(`${API_BASE}/api/customers/bulk_upload/`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ customers: [newCustomer] })
            });

            if (res.ok) {
                alert(`✅ [${finalPlatform}] ${singleData.name} 고객님이 등록되었습니다.`);
                // 입력창 초기화 (isManual은 끄고, 새로 만든 플랫폼을 기본 선택값으로 지정)
                setSingleData({
                    platform: finalPlatform,
                    manualPlatform: '',
                    isManual: false,
                    name: '',
                    phone: '',
                    memo: ''
                });
                loadCurrentTabData();
            } else {
                const data = await res.json();
                alert(`오류: ${data.message}`);
            }
        } catch (err) {
            console.error(err);
            alert("서버 통신 오류가 발생했습니다.");
        }
    };

    // ... 기존 state들 ...

    // 🟢 [수정] 업무노트 데이터 State
    const [workMemos, setWorkMemos] = useState(() => {
        const saved = localStorage.getItem('admin_work_memos');
        return saved ? JSON.parse(saved) : [{ id: 1, title: '첫 번째 메모', content: '', color: 'bg-yellow-50' }];
    });

    // 🟢 [신규] 휴지통 데이터 State
    const [trashMemos, setTrashMemos] = useState(() => {
        const saved = localStorage.getItem('admin_trash_memos');
        return saved ? JSON.parse(saved) : [];
    });

    const [activeMemoId, setActiveMemoId] = useState(workMemos[0]?.id || null);
    const [viewMode, setViewMode] = useState('active'); // 'active' 또는 'trash'

    // 로컬 스토리지 자동 저장
    useEffect(() => { localStorage.setItem('admin_work_memos', JSON.stringify(workMemos)); }, [workMemos]);
    useEffect(() => { localStorage.setItem('admin_trash_memos', JSON.stringify(trashMemos)); }, [trashMemos]);

    // 🎮 메모장 핸들러들
    const handleAddMemoTab = () => {
        const colors = ['bg-yellow-50', 'bg-blue-50', 'bg-green-50', 'bg-pink-50', 'bg-purple-50'];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        const newId = Date.now();
        const newMemo = { id: newId, title: '새 메모', content: '', color: randomColor };
        setWorkMemos([...workMemos, newMemo]);
        setActiveMemoId(newId);
        setViewMode('active');
    };

    const handleMoveToTrash = (id) => {
        const memoToTrash = workMemos.find(m => m.id === id);
        if (!memoToTrash) return;

        setWorkMemos(workMemos.filter(m => m.id !== id));
        setTrashMemos([{ ...memoToTrash, deletedAt: new Date().toLocaleString() }, ...trashMemos]);

        if (activeMemoId === id) {
            const remaining = workMemos.filter(m => m.id !== id);
            setActiveMemoId(remaining.length > 0 ? remaining[0].id : null);
        }
    };

    const handleRestoreMemo = (id) => {
        const memoToRestore = trashMemos.find(m => m.id === id);
        if (!memoToRestore) return;

        setTrashMemos(trashMemos.filter(m => m.id !== id));
        setWorkMemos([...workMemos, memoToRestore]);
        setActiveMemoId(id);
        setViewMode('active');
        alert("메모가 복원되었습니다.");
    };

    // 영구 삭제
    const handlePermanentDelete = (id) => {
        if (window.confirm("영구 삭제하시겠습니까? 복구가 불가능합니다.")) {
            setTrashMemos(trashMemos.filter(m => m.id !== id));
        }
    };


    const handleDeleteMemoTab = (e, id) => {
        e.stopPropagation();
        if (workMemos.length === 1) return alert("최소 하나의 메모는 있어야 합니다.");
        if (!window.confirm("이 메모를 삭제하시겠습니까?")) return;

        const filtered = workMemos.filter(m => m.id !== id);
        setWorkMemos(filtered);
        // 삭제된 탭이 활성 탭이었다면 첫 번째 탭으로 이동
        if (activeMemoId === id) setActiveMemoId(filtered[0].id);
    };

    const handleUpdateMemo = (id, field, value) => {
        setWorkMemos(prev => prev.map(m => m.id === id ? { ...m, [field]: value } : m));
    };

    const [showCompletionModal, setShowCompletionModal] = useState(false);
    const [completionTarget, setCompletionTarget] = useState(null);
    const [selectedPlatform, setSelectedPlatform] = useState('KT');
    const [dynamicFormData, setDynamicFormData] = useState({});
    const [calculatedPolicy, setCalculatedPolicy] = useState(0);


    const [newAdChannel, setNewAdChannel] = useState({ name: '', cost: '' });
    const [newReason, setNewReason] = useState('');
    const [newStatus, setNewStatus] = useState('');
    const [newSettlementStatus, setNewSettlementStatus] = useState('');

    // 🟢 [신규] 접수 취소 모달 State
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [cancelTarget, setCancelTarget] = useState(null);
    const [selectedCancelReason, setSelectedCancelReason] = useState('');

    const [isMoveToPotential, setIsMoveToPotential] = useState(false); // 가망관리 이동 여부
    const [cancelMemo, setCancelMemo] = useState(''); // 취소 메모

    const [showPolicyViewer, setShowPolicyViewer] = useState(false); // 뷰어 창 열림 여부
    const [viewerPlatform, setViewerPlatform] = useState('KT');      // 뷰어 내부에서 선택한 통신사

    // 🟢 [추가] 정책뷰어 내부 탭 상태 ('policy' 또는 'notice')
    const [viewerTab, setViewerTab] = useState('policy');

    // 🟢 [추가] 정책뷰어 이미지 확대 보기 상태 (이미지 URL)
    const [zoomImg, setZoomImg] = useState(null);

    const [actionMemoTrigger, setActionMemoTrigger] = useState(0);
    // openActionMemo 함수 수정


    // 1. 상태 추가
    const [zoomScale, setZoomScale] = useState(1); // 확대 배율
    const [policyDeleteTarget, setPolicyDeleteTarget] = useState(null); // 삭제 대상

    // 2. 삭제 함수 추가
    const handleDeleteServerImage = (imgObj) => {
        if (!imgObj.id) return alert("이미지 ID를 찾을 수 없습니다.");
        setPolicyDeleteTarget(imgObj); // 삭제 확인 모달용
    };


    // 🟢 [수정됨] 접수 취소 확정 핸들러 (UI 입력값 기반)
    const handleConfirmCancel = async () => {
        if (!cancelTarget || !selectedCancelReason) return alert("취소 사유를 선택해주세요.");

        // 1. 상태 결정 (체크박스 체크 시 '가망', 아니면 '접수취소')
        const newStatus = isMoveToPotential ? '가망' : '접수취소';

        try {
            // 2. 로그 메시지 구성
            const logContent = `[접수취소처리] 사유: ${selectedCancelReason}\n메모: ${cancelMemo}\n(결과: ${newStatus} 상태로 변경됨)`;

            // 3. API 업데이트 (상태, 상세사유, 메모)
            // 상태 변경
            await fetch(`${API_BASE}/api/customers/${cancelTarget.id}/`, {
                method: 'PATCH',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    status: newStatus,
                    detail_reason: selectedCancelReason,
                    last_memo: cancelMemo ? cancelMemo : undefined // 메모가 있을 때만 업데이트
                })
            });

            // 4. 로그 저장
            await fetch(`${API_BASE}/api/customers/${cancelTarget.id}/add_log/`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    user_id: currentUserId,
                    content: logContent
                })
            });

            alert(isMoveToPotential ? "가망 리스트로 이동되었습니다." : "접수 취소 처리되었습니다.");

            // 5. 초기화 및 모달 닫기
            setShowCancelModal(false);
            setCancelTarget(null);
            setSelectedCancelReason('');
            setCancelMemo('');
            setIsMoveToPotential(false);

            // 6. 목록 갱신
            loadCurrentTabData();

        } catch (e) {
            console.error(e);
            alert("처리 중 오류가 발생했습니다.");
        }
    };


    // 2. 드래그 앤 드롭 이벤트
    const handlePolicyDragOver = (e) => {
        e.preventDefault();
        setIsPolicyDragOver(true);
    };

    const handlePolicyDragLeave = (e) => {
        e.preventDefault();
        setIsPolicyDragOver(false);
    };

    const handlePolicyDrop = (e) => {
        e.preventDefault();
        setIsPolicyDragOver(false);
        const files = e.dataTransfer.files;
        handlePolicyFileSelect(files);
    };


    // 🟢 정책 파일 선택 핸들러 (만약 정책 탭에서 업로드 UI를 아직 안 지웠다면 임시 정의)
    const handlePolicyFileSelect = (files) => {
        console.log("상담사는 정책을 수정할 수 없습니다.");
    };

    // 🟢 [수정됨] 이미지 복사/붙여넣기 통합 핸들러 (정책탭 + 채팅방)
    useEffect(() => {
        const handleGlobalPaste = (e) => {
            // 클립보드 데이터가 없으면 무시
            if (!e.clipboardData) return;

            const items = e.clipboardData.items;
            const pastedFiles = [];

            // 클립보드 아이템 중 이미지 파일만 추출
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    const file = items[i].getAsFile();
                    if (file) {
                        // 파일명 임의 지정 (paste_연월일시분초.png)
                        const now = new Date();
                        const timestamp = now.toISOString().replace(/[-:.]/g, "").slice(0, 15);
                        // 원본 파일 객체는 readOnly 속성이 있어 새 File 객체로 생성
                        const namedFile = new File([file], `paste_${timestamp}.png`, { type: file.type });
                        pastedFiles.push(namedFile);
                    }
                }
            }

            // 이미지가 없으면 리턴
            if (pastedFiles.length === 0) return;

            // [상황 1] 정책/공지 탭이 활성화된 경우 -> 리스트에 추가
            if (activeTab === 'policy') {
                e.preventDefault();
                handlePolicyFileSelect(pastedFiles);
            }
            // [상황 2] 채팅방이 열려있고, 채팅방 내부(ROOM)를 보고 있는 경우 -> 전송 대기 파일로 설정
            else if (isChatOpen && chatView === 'ROOM') {
                e.preventDefault();
                // 채팅방은 보통 한 번에 한 장 전송 (첫 번째 이미지 선택)
                setChatFile(pastedFiles[0]);
            }
        };

        // 전역 이벤트 리스너 등록
        window.addEventListener('paste', handleGlobalPaste);

        return () => {
            window.removeEventListener('paste', handleGlobalPaste);
        };
    }, [activeTab, isChatOpen, chatView, handlePolicyFileSelect]);

    // 🟢 [TO-DO LIST 전용 State]
    // 1. 카테고리 (소탭) 목록
    const [todoTabs, setTodoTabs] = useState(() => {
        const saved = localStorage.getItem('admin_todo_tabs');
        return saved ? JSON.parse(saved) : [
            { id: 'default', name: '📂 기본' },
            { id: 'personal', name: '🔒 개인업무' },
            { id: 'admin', name: '📢 관리자지시' }
        ];
    });

    // 2. 할 일 데이터 목록
    const [todos, setTodos] = useState(() => {
        const saved = localStorage.getItem('admin_todos');
        return saved ? JSON.parse(saved) : [];
    });

    // 3. 현재 선택된 소탭 (기본값: 'ALL' - 전체보기)
    const [activeTodoTab, setActiveTodoTab] = useState('ALL');
    const [newTodoInput, setNewTodoInput] = useState('');

    // 4. 로컬 스토리지 자동 저장
    useEffect(() => { localStorage.setItem('admin_todo_tabs', JSON.stringify(todoTabs)); }, [todoTabs]);
    useEffect(() => { localStorage.setItem('admin_todos', JSON.stringify(todos)); }, [todos]);


    const [showResponseModal, setShowResponseModal] = useState(false);
    const [responseTarget, setResponseTarget] = useState(null);
    const [showRequestModal, setShowRequestModal] = useState(false);
    const [requestTarget, setRequestTarget] = useState(null);
    const [requestMessage, setRequestMessage] = useState('');

    const [memoPopupTarget, setMemoPopupTarget] = useState(null);
    const [memoPopupText, setMemoPopupText] = useState('');
    const [memoFieldType, setMemoFieldType] = useState('');
    const [isTopStatsVisible, setIsTopStatsVisible] = useState(false);
    const [chatTrigger, setChatTrigger] = useState(0);

    const [newNotice, setNewNotice] = useState({ title: '', content: '', is_important: false });
    const [uploadImage, setUploadImage] = useState(null);
    const [isBannerVisible, setIsBannerVisible] = useState(true);


    const [showFailModal, setShowFailModal] = useState(false);
    const [failTarget, setFailTarget] = useState(null);
    const [selectedFailReason, setSelectedFailReason] = useState('');

    const [showCustomModal, setShowCustomModal] = useState(false);
    const [adSpend, setAdSpend] = useState(0);

    // 관리자로부터 받은 지시사항 목록을 저장할 상태
    const [assignedTasks, setAssignedTasks] = useState([]);

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

    const [settingsSubTab, setSettingsSubTab] = useState('policy');
    const [showHistoryModal, setShowHistoryModal] = useState(false); // 히스토리 팝업 표시 여부
    const [historyData, setHistoryData] = useState([]); // 불러온 히스토리 데이터
    const [historyTargetName, setHistoryTargetName] = useState(''); // 히스토리 대상 고객명
    const [highlightedId, setHighlightedId] = useState(null);

    // 1. 순수 상담 메모만 추출 (테이블 표시용)
    const extractUserMemo = (text) => {
        if (!text) return "";
        return text.split("■ 고객정보")[0].trim();
    };

    // 2. 시스템 접수 양식만 추출 (퀵버튼 모달용)
    const extractSystemForm = (text) => {
        if (!text || !text.includes("■ 고객정보")) return "";
        const startIndex = text.indexOf("■ 고객정보");
        return text.substring(startIndex).trim();
    };

    const [clientTemplates, setClientTemplates] = useState(() => {
        const saved = localStorage.getItem('admin_client_templates');
        return saved ? JSON.parse(saved) : {};
        // 예: { "농심본사": "■ 고객정보\n성명: {{NAME}}\n..." }
    });


    // 👇 [여기에 추가] 🟢 퀵 액션 메모용 State 및 핸들러 👇
    const [showActionMemo, setShowActionMemo] = useState(false);
    const [actionMemoTarget, setActionMemoTarget] = useState(null);
    const [actionMemoText, setActionMemoText] = useState('');
    const [targetAssignAgent, setTargetAssignAgent] = useState('');



    const handleActionSaveMemoOnly = async () => {
        if (!actionMemoTarget) return;
        const memoField = activeTab === 'settlement' ? 'settlement_memo' : 'last_memo';
        await handleInlineUpdate(actionMemoTarget.id, memoField, actionMemoText);
        alert("✅ 메모가 저장되었습니다.");
        setShowActionMemo(false);
    };




    // 🔔 [수정] 알림 클릭 시 처리 로직
    const handleNotificationClick = async (customer) => {
        // 1. '알림ON' 끄기 (체크리스트 업데이트)
        const currentList = parseChecklist(customer.checklist);
        const newList = currentList.filter(item => item !== '알림ON');
        await handleInlineUpdate(customer.id, 'checklist', newList.join(','));

        // 2. 고객 상태에 따라 적절한 탭으로 이동
        if (['가망', '장기가망', '접수완료'].includes(customer.status)) {
            setActiveTab('long_term');
        } else {
            setActiveTab('consult');
        }

        // 3. 해당 행 강조 및 자동 스크롤
        setHighlightedId(customer.id);
        setShowNotiDropdown(false); // 드롭다운 닫기

        setTimeout(() => {
            const row = document.getElementById(`row-${customer.id}`);
            if (row) {
                row.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 300); // 탭 전환 애니메이션 대기

        // 4. 3초 후 강조 효과 제거
        setTimeout(() => setHighlightedId(null), 3000);
    };

    const handleActionMoveToTodo = () => {
        if (!actionMemoText.trim()) return alert("메모 내용을 입력하세요.");
        const newItem = {
            id: Date.now(),
            text: `[${actionMemoTarget.name}] ${actionMemoText}`,
            done: false,
            tabId: 'default',
            created_at: new Date().toLocaleString()
        };
        setTodos(prev => [newItem, ...prev]);
        alert("✅ 내 TO-DO 리스트에 등록되었습니다.");
        setShowActionMemo(false);
    };

    const handleActionMoveToNotepad = () => {
        if (!actionMemoText.trim()) return alert("메모 내용을 입력하세요.");
        const newMemo = {
            id: Date.now(),
            title: `${actionMemoTarget.name} 고객 관련 메모`,
            content: actionMemoText,
            color: 'bg-yellow-50'
        };
        setWorkMemos(prev => [...prev, newMemo]);
        alert("✅ 메모장(새 탭)에 추가되었습니다.");
        setShowActionMemo(false);
    };

    const openActionMemo = (customer) => {
        setActionMemoTarget(customer);
        setActionMemoText(activeTab === 'settlement' ? (customer.settlement_memo || '') : (customer.last_memo || ''));
        setTargetAssignAgent('');
        setShowActionMemo(true);
        setActionMemoTrigger(Date.now()); // ⭐️ 새로운 창을 띄우거나 기존 창을 앞으로 가져오는 트리거
    };

    const handleActionAssignToAgent = async () => {
        if (!actionMemoText.trim() || !targetAssignAgent) {
            return alert("메모 내용과 전달할 상담원을 모두 선택해주세요.");
        }
        try {
            const res = await fetch(`${API_BASE}/api/todos/`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    content: `[${actionMemoTarget.name} 고객] ${actionMemoText}`,
                    assigned_to: targetAssignAgent === 'ALL' ? null : targetAssignAgent,
                    is_global: targetAssignAgent === 'ALL'
                })
            });
            if (res.ok) {
                alert("📢 선택한 상담원의 TO-DO 리스트로 업무가 전달되었습니다.");
                setShowActionMemo(false);
            } else {
                alert("전달 실패");
            }
        } catch (e) {
            alert("서버 오류가 발생했습니다.");
        }
    };
    // 👆 [여기까지 추가] 👆

    // 🟢 [신규] 접수 탭 상태 리스트 (기본값 설정)
    const [receptionList, setReceptionList] = useState(() => {
        const saved = localStorage.getItem('admin_reception_list');
        return saved ? JSON.parse(saved) : ['접수완료', '해지진행', '설치완료'];
    });

    // 🟢 [신규] 설치 탭 상태 리스트
    const [installList, setInstallList] = useState(() => {
        const saved = localStorage.getItem('admin_install_list');
        return saved ? JSON.parse(saved) : ['설치완료', '해지진행'];
    });

    // 입력값 State
    const [newReceptionInput, setNewReceptionInput] = useState('');
    const [newInstallInput, setNewInstallInput] = useState('');

    // 🟢 [신규] 로컬 스토리지 자동 저장 (useEffect 영역에 추가)
    useEffect(() => { localStorage.setItem('admin_reception_list', JSON.stringify(receptionList)); }, [receptionList]);
    useEffect(() => { localStorage.setItem('admin_install_list', JSON.stringify(installList)); }, [installList]);


    // 🟢 [변경] 고정 상수 대신, 로컬 스토리지에 저장되는 동적 리스트로 변경
    const [statusList, setStatusList] = useState(() => {
        const saved = localStorage.getItem('admin_status_list');
        return saved ? JSON.parse(saved) : ['미통건', '부재', '재통', '가망', '장기가망', 'AS요청', '실패', '실패이관', '접수완료'];
    });


    const [platformList, setPlatformList] = useState(() => {
        const saved = localStorage.getItem('admin_platform_list');
        return saved ? JSON.parse(saved) : ['KT', 'SK', 'LG', 'LG헬로비전', 'SK POP', 'SKY LIFE', '기타'];
    });

    const [newStatusInput, setNewStatusInput] = useState('');
    const [newPlatformInput, setNewPlatformInput] = useState('');

    useEffect(() => { localStorage.setItem('admin_status_list', JSON.stringify(statusList)); }, [statusList]);
    useEffect(() => { localStorage.setItem('admin_platform_list', JSON.stringify(platformList)); }, [platformList]);

    const [platformFilter, setPlatformFilter] = useState('ALL');




    useEffect(() => {
        localStorage.setItem('admin_client_templates', JSON.stringify(clientTemplates));
    }, [clientTemplates]);


    // 🟢 [TO-DO] 할 일 추가
    const handleAddTodo = () => {
        if (!newTodoInput.trim()) return;
        const targetTab = activeTodoTab === 'ALL' ? 'default' : activeTodoTab; // 전체보기 상태면 기본탭에 추가
        const newItem = {
            id: Date.now(),
            text: newTodoInput,
            done: false,
            tabId: targetTab,
            created_at: new Date().toLocaleString()
        };
        setTodos([newItem, ...todos]);
        setNewTodoInput('');
    };

    // 🟢 [TO-DO] 할 일 삭제
    const handleDeleteTodo = (id) => {
        if (window.confirm('삭제하시겠습니까?')) {
            setTodos(todos.filter(t => t.id !== id));
        }
    };

 

    // 🟢 [수정] 정산 관리 -> 담당자 To-Do로 즉시 업무 지시 전송
    const handleSettlementRequest = async (customer) => {
        if (!customer.owner) return alert("담당자가 지정되지 않은 건입니다.");

        const agentName = getAgentName(customer.owner);
        if (!window.confirm(`[${customer.name}] 건의 정산 오류를 ${agentName}님에게 업무 지시하시겠습니까?`)) return;

        try {
            // 1. 백엔드 To-Do API 호출 (관리자 지시 등록)
            const todoRes = await fetch(`${API_BASE}/api/todos/`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    content: `[정산오류 확인요청] ${customer.name} 고객님의 정산 정보(정책/지원금)를 확인하고 수정 바랍니다.`,
                    assigned_to: customer.owner, // 해당 고객의 담당자에게 직접 할당
                    is_global: false             // 전체 공지가 아닌 개인 지시
                })
            });

            if (!todoRes.ok) throw new Error("업무 지시 생성 실패");

            // 2. 고객 데이터 상태 업데이트 (시각적 강조용)
            await fetch(`${API_BASE}/api/customers/${customer.id}/`, {
                method: 'PATCH',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    request_status: 'REQUESTED',
                    request_message: '💰 정산 오류 확인 요청됨 (To-Do 전송완료)'
                })
            });

            // 3. 로그 기록
            await fetch(`${API_BASE}/api/customers/${customer.id}/add_log/`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    user_id: currentUserId,
                    content: `[팀장지시] 정산 정보 불일치. 담당자 To-Do 리스트로 확인 요청을 보냈습니다.`
                })
            });

            alert(`✅ ${agentName}님의 To-Do(관리자지시)에 업무가 추가되었습니다.`);
            loadCurrentTabData(); // 화면 새로고침
        } catch (e) {
            console.error(e);
            alert("업무 지시 전송 중 오류가 발생했습니다.");
        }
    };

    // 🟢 [TO-DO] 완료 상태 토글
    const handleToggleTodo = (id) => {
        setTodos(todos.map(t => t.id === id ? { ...t, done: !t.done } : t));
    };

    // 🟢 [TO-DO] 탭(카테고리) 추가
    const handleAddTodoTab = () => {
        const name = prompt("새로운 탭(폴더) 이름을 입력하세요:");
        if (name) {
            setTodoTabs([...todoTabs, { id: `tab_${Date.now()}`, name }]);
        }
    };

    // 🟢 [TO-DO] 탭 삭제 (포함된 할 일도 삭제됨)
    const handleDeleteTodoTab = (tabId, e) => {
        e.stopPropagation();
        if (window.confirm("이 탭을 삭제하면 내부의 할 일도 모두 삭제됩니다. 계속하시겠습니까?")) {
            setTodoTabs(todoTabs.filter(t => t.id !== tabId));
            setTodos(todos.filter(t => t.tabId !== tabId));
            setActiveTodoTab('ALL');
        }
    };

    const handleSearchEnter = async (e) => {
        if (e.key !== 'Enter' || !chatListSearch.trim()) return;

        const pureNumber = chatListSearch.replace(/[^0-9]/g, '');
        const isPhonePattern = /^01[0-9]{8,9}$/.test(pureNumber);

        if (isPhonePattern) {
            // 🚀 서버에 전용 액션 요청
            try {
                const res = await fetch(`${API_BASE}/api/customers/start_chat/`, {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({
                        phone: pureNumber,
                        name: `신규고객_${pureNumber.slice(-4)}`
                    })
                });

                const data = await res.json();

                if (res.ok) {
                    if (data.is_other_owner) {
                        // 다른 상담사 고객인 경우 경고
                        alert(data.message);
                    }

                    // 1. 전체 리스트 갱신 (새 고객이 생겼을 수 있으므로)
                    await fetchAllData();

                    // 2. 채팅방 타겟을 해당 고객으로 설정 (조회된 혹은 생성된 고객)
                    setChatTarget(data.customer);
                    fetchChatHistory(data.customer.id);

                    // 3. 검색어 비우기
                    setChatListSearch('');
                } else {
                    alert(data.message || "채팅방을 여는 중 오류가 발생했습니다.");
                }
            } catch (err) {
                console.error("Chat Create Error:", err);
                alert("서버와 통신할 수 없습니다.");
            }
        }
    };

    // 🟢 [채팅방] 위치 관리 (드래그 이동 + 로컬스토리지 저장)
    const [chatPos, setChatPos] = useState(() => {
        const saved = localStorage.getItem('admin_chat_pos');
        // 기본값: 화면 오른쪽 아래
        return saved ? JSON.parse(saved) : { x: window.innerWidth - 420, y: window.innerHeight - 650 };
    });
    const isDragging = useRef(false);
    const dragOffset = useRef({ x: 0, y: 0 });

    // 🟢 [채팅방] 드래그 시작
    const handleMouseDown = (e) => {
        isDragging.current = true;
        dragOffset.current = {
            x: e.clientX - chatPos.x,
            y: e.clientY - chatPos.y
        };
        // 드래그 중 텍스트 선택 방지
        document.body.style.userSelect = 'none';
    };


    // 🟢 [수정] 리스트 추가 핸들러 (통합)
    const handleAddList = (type) => {
        let inputVal = '';
        let currentList = [];
        let setFunc = null;
        let setInputFunc = null;

        if (type === 'status') {
            inputVal = newStatusInput; currentList = statusList; setFunc = setStatusList; setInputFunc = setNewStatusInput;
        } else if (type === 'platform') {
            inputVal = newPlatformInput; currentList = platformList; setFunc = setPlatformList; setInputFunc = setNewPlatformInput;
        } else if (type === 'reception') { // [추가] 접수
            inputVal = newReceptionInput; currentList = receptionList; setFunc = setReceptionList; setInputFunc = setNewReceptionInput;
        } else if (type === 'install') { // [추가] 설치
            inputVal = newInstallInput; currentList = installList; setFunc = setInstallList; setInputFunc = setNewInstallInput;
        }

        if (inputVal.trim() && !currentList.includes(inputVal.trim())) {
            setFunc([...currentList, inputVal.trim()]);
            setInputFunc('');
        }
    };

    // 🟢 [수정] 리스트 삭제 핸들러 (통합)
    const handleDeleteList = (type, item) => {
        if (!window.confirm(`'${item}' 항목을 삭제하시겠습니까?`)) return;

        if (type === 'status') setStatusList(statusList.filter(i => i !== item));
        else if (type === 'platform') setPlatformList(platformList.filter(i => i !== item));
        else if (type === 'reception') setReceptionList(receptionList.filter(i => i !== item));
        else if (type === 'install') setInstallList(installList.filter(i => i !== item));
    };


    // 🟢 [채팅방] 드래그 중 (전역 이벤트로 처리하기 위해 useEffect 사용)
    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!isDragging.current) return;
            setChatPos({
                x: e.clientX - dragOffset.current.x,
                y: e.clientY - dragOffset.current.y
            });
        };

        const handleMouseUp = () => {
            if (isDragging.current) {
                isDragging.current = false;
                document.body.style.userSelect = 'auto'; // 선택 방지 해제
                // 위치 저장
                localStorage.setItem('admin_chat_pos', JSON.stringify(chatPos));
            }
        };

        if (isChatOpen) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isChatOpen, chatPos]); // chatPos가 바뀔때마다 저장값 갱신 준비

    // 🟢 [채팅방] 이미지 드래그 앤 드롭 상태
    const [isDragOver, setIsDragOver] = useState(false);

    // 🟢 [채팅방] 파일 드롭 핸들러
    const handleFileDrop = (e) => {
        e.preventDefault();
        setIsDragOver(false);
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            const file = files[0];
            if (file.type.startsWith('image/')) {
                setChatFile(file); // 이미지 파일 상태 저장
            } else {
                alert("이미지 파일만 첨부 가능합니다.");
            }
        }
    };

    // 🟢 [채팅방] 키보드 입력 핸들러 (Enter 전송 / Ctrl+Enter 줄바꿈)
    const handleChatKeyDown = (e) => {
        if (e.key === 'Enter') {
            if (e.ctrlKey || e.shiftKey) {
                // 줄바꿈 허용 (기본 동작)
                return;
            } else {
                // 전송
                e.preventDefault();
                handleSendManualChat();
            }
        }
    };

    // -------------------------------------------------------------------------
    // 🟢 [수정] 공통 컨트롤 패널 (분류 버튼 + 검색바만 남김)
    // -------------------------------------------------------------------------
    const renderCommonControlPanel = () => {
        // 이 패널을 보여줄 탭 목록 (데이터 관련 탭들)
        const dataTabs = ['total_manage', 'shared', 'consult', 'long_term', 'reception', 'installation', 'settlement', 'issue_manage'];

        if (!dataTabs.includes(activeTab)) return null;

        return (
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 mb-4 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4 animate-fade-in">

                {/* [Left] 분류 필터 영역 (플랫폼 + 상태) */}
                <div className="flex flex-wrap gap-3 items-center w-full md:w-auto">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider hidden xl:block">Platform</span>
                        {renderPlatformFilter()}
                    </div>

                    <div className="hidden md:block h-5 w-px bg-gray-300 mx-1"></div>

                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider hidden xl:block">Status</span>
                        {renderStatusFilter()}
                    </div>
                </div>

                {/* [Right] 검색창 (깔끔하게 독립) */}
                <div className="w-full md:w-auto flex justify-end">
                    <div className="flex items-center bg-white border border-gray-300 rounded-full pl-4 pr-1 py-1.5 shadow-sm focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100 transition w-full md:w-80">
                        <input
                            className="bg-transparent outline-none text-sm text-gray-700 w-full placeholder-gray-400"
                            placeholder="고객명, 연락처 검색..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                        <button className="bg-indigo-600 text-white w-8 h-8 rounded-full flex justify-center items-center hover:bg-indigo-700 transition shrink-0">
                            🔍
                        </button>
                    </div>
                </div>
            </div>
        );
    };


    // 🟢 [드래그] 시작 (할 일 ID 저장)
    const handleDragStart = (e, todoId) => {
        e.dataTransfer.setData("todoId", todoId);
    };

    // 🟢 [드래그] 오버 (허용)
    const handleDragOver = (e) => {
        e.preventDefault();
    };

    // 🟢 [드랍] 탭 위로 떨어뜨렸을 때 (이동)
    const handleDropOnTab = (e, targetTabId) => {
        e.preventDefault();
        const todoId = Number(e.dataTransfer.getData("todoId"));
        if (!todoId) return;

        if (targetTabId === 'ALL') return; // 전체 탭으로는 이동 불가

        setTodos(prev => prev.map(t =>
            t.id === todoId ? { ...t, tabId: targetTabId } : t
        ));
    };

  
    // 🟢 [수정] 상담 메모 키보드 핸들러 (Ctrl+Enter 줄바꿈 기능 추가)
    const handleMemoKeyDown = async (e, id, name) => {
        if (e.key === 'Enter') {
            // 1. 줄바꿈 처리: Shift + Enter 또는 Ctrl + Enter
            if (e.shiftKey || e.ctrlKey) {
                // 브라우저 기본 동작으로 Shift+Enter는 줄바꿈이 되지만, 
                // Ctrl+Enter는 아무 동작 안 할 수 있으므로 수동으로 \n 삽입
                if (e.ctrlKey) {
                    e.preventDefault();
                    const val = e.target.value;
                    const start = e.target.selectionStart;
                    const end = e.target.selectionEnd;

                    // 커서 위치에 줄바꿈 삽입
                    e.target.value = val.substring(0, start) + "\n" + val.substring(end);

                    // 커서 위치 보정
                    e.target.selectionStart = e.target.selectionEnd = start + 1;

                    // 높이 자동 조절 적용
                    autoResizeTextarea(e);
                }
                return; // 저장 로직 실행 안 함
            }

            // 2. 저장 처리: (Enter 단독 입력 시)
            e.preventDefault(); // 기본 줄바꿈 막기
            const content = e.target.value.trim();

            try {
                // (1) 로그 저장 API 호출
                const res = await fetch(`${API_BASE}/api/customers/${id}/add_log/`, {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({
                        user_id: currentUserId,
                        content: `[상담메모] ${content}`
                    })
                });

                if (!res.ok) throw new Error("서버 저장 실패");

                // (2) 화면 데이터 업데이트
                await handleInlineUpdate(id, 'last_memo', content);

                // (3) UI 처리: 포커스 해제 및 높이 1줄로 복구
                e.target.blur();
                e.target.style.height = '2rem'; // Tailwind h-8 (32px) 크기로 강제 축소
                e.target.scrollTop = 0; // 스크롤 맨 위로

            } catch (err) {
                console.error("저장 실패:", err);
                alert("❌ 저장에 실패했습니다.");
            }
        }
    };

    // 🟢 [추가] 히스토리 조회 (더블클릭)
    const handleOpenHistory = async (customer) => {
        setHistoryTargetName(customer.name);
        setHistoryData([]); // 초기화
        setShowHistoryModal(true);

        try {
            // 로그/히스토리 불러오기
            const res = await fetch(`${API_BASE}/api/customers/${customer.id}/logs/`, { headers: getAuthHeaders() });
            if (res.ok) {
                const data = await res.json();
                // [상담메모] 태그가 있는 것만 필터링하거나 전체 표시
                setHistoryData(data);
            }
        } catch (err) {
            console.error(err);
        }
    };



    const [showMacro, setShowMacro] = useState(false);
    const [activeMacroTab, setActiveMacroTab] = useState('공통');
    const [newMacroText, setNewMacroText] = useState('');
    const [macros, setMacros] = useState(() => {
        const saved = localStorage.getItem('admin_macros'); // 키 이름을 admin_macros로 변경 권장
        return saved ? JSON.parse(saved) : {
            '공통': ['안녕하세요, 상담사입니다.', '잠시 통화 가능하실까요?', '부재중이셔서 문자 남깁니다.'],
            'KT': ['KT 결합상품 안내드립니다.', '기가지니 셋톱박스 혜택 안내'],
            'SK': ['SKT 온가족 할인 안내', 'SK브로드밴드 신규 가입 혜택'],
            'LG': ['LG U+ 참 쉬운 가족 결합', '아이들나라 콘텐츠 안내'],
            '기타': []
        };
    });

    const chatScrollRef = useRef(null);

    useEffect(() => {
        if (chatScrollRef.current) {
            chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
        }
    }, [chatMessages, isChatOpen, chatView]);


    // 🟢 [수정됨] 공통 상태 필터 렌더링 함수 (버튼 방식)
    // 🟢 [수정] 상태 필터 (statusList State 사용)
    const renderStatusFilter = () => (
        <div className="flex flex-wrap gap-1 items-center mr-2">
            <button
                onClick={() => setStatusFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border shadow-sm ${statusFilter === 'ALL' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-50'}`}
            >
                📂 전체
            </button>
            {statusList.map(opt => (
                <button
                    key={opt}
                    onClick={() => setStatusFilter(opt)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border shadow-sm ${statusFilter === opt ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-50'}`}
                >
                    {opt}
                </button>
            ))}
        </div>
    );


    // 📱 연동 테스트 모달 및 설정 State
    const [showMobileModal, setShowMobileModal] = useState(false);
    const [testPhoneNumber, setTestPhoneNumber] = useState("");
    const [smsConfig, setSmsConfig] = useState(() => {
        const saved = localStorage.getItem('sms_gateway_config');
        return saved ? JSON.parse(saved) : {
            url: "https://api.sms-gate.app/message",
            username: "",
            password: ""
        };
    });

    // 설정 변경 시 로컬 스토리지 자동 저장
    useEffect(() => {
        localStorage.setItem('sms_gateway_config', JSON.stringify(smsConfig));
    }, [smsConfig]);


    const handleExecuteMobileTest = async () => {
        if (!smsConfig.token || !testPhoneNumber) {
            return alert("기기 토큰과 테스트할 핸드폰 번호를 입력해주세요.");
        }

        try {
            const res = await fetch(`${API_BASE}/api/sms/test_connection/`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    phone: testPhoneNumber.replace(/[^0-9]/g, ''),
                    token: smsConfig.token // 백엔드에서 url은 고정 처리됨
                })
            });

            const data = await res.json();
            if (res.ok) {
                alert("🚀 테스트 신호 발송 성공!\n핸드폰의 Traccar 앱 로그와 실제 문자를 확인하세요.");
            } else {
                alert(`❌ 연동 실패: ${data.message}`);
            }
        } catch (e) {
            alert("서버 통신 오류가 발생했습니다.");
        }
    };

    // 🟢 [수정] 플랫폼 필터 (platformList State 사용)
    const renderPlatformFilter = () => (
        <div className="flex flex-wrap gap-1 items-center mr-2 bg-gray-100 p-1 rounded-lg border border-gray-200">
            <span className="text-[10px] font-bold text-gray-400 px-1">통신사:</span>
            <button
                onClick={() => setPlatformFilter('ALL')}
                className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all border shadow-sm ${platformFilter === 'ALL' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-50'}`}
            >
                ALL
            </button>
            {platformList.map(opt => (
                <button
                    key={opt}
                    onClick={() => setPlatformFilter(opt)}
                    className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all border shadow-sm ${platformFilter === opt ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-50'}`}
                >
                    {opt}
                </button>
            ))}
        </div>
    );

    // 🟢 [추가] 정렬 토글 버튼 렌더링 함수
    const renderSortToggle = () => (
        <button
            onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
            className="flex items-center gap-1 bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50 transition shadow-sm mr-2"
        >
            <span>{sortOrder === 'asc' ? '⬆️ 오래된순' : '⬇️ 최신순'}</span>
        </button>
    );


    // 🔵 [수정] 연동 테스트 버튼 핸들러
    const handleMobileTest = async () => {
        const testNumber = prompt("테스트 문자를 수신할 번호를 입력하세요 (- 제외):");
        if (!testNumber) return;

        try {
            const res = await fetch(`${API_BASE}/api/sms/test_connection/`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    phone: testNumber.replace(/[^0-9]/g, ''),
                    gateway_config: smsConfig // ⭐️ 현재 입력된 URL, ID, PW를 백엔드로 전송
                })
            });

            const data = await res.json();
            if (res.ok) alert("🚀 테스트 신호 발송 성공! 앱의 발송 이력을 확인하세요.");
            else alert(`❌ 연동 실패: ${data.message}`);
        } catch (e) {
            alert("서버 통신 오류가 발생했습니다.");
        }
    };

    // 🟢 [신규] 설정값 서버 저장 (선택 사항)
    const handleSaveSmsGateway = async () => {
        alert("✅ 브라우저와 연동 설정이 임시 저장되었습니다.\n테스트 버튼으로 연동 상태를 확인해 보세요.");
        // 필요 시 백엔드 DB에도 영구 저장하는 API를 호출할 수 있습니다.
    };

    // -------------------------------------------------------------------------
    // 🟢 [장기 가망 관리] 고급 폴더 시스템 상태
    // -------------------------------------------------------------------------

    // 1. 폴더 목록 (기본값: 프로모션, 위약금, 사은품)
    const [ltFolders, setLtFolders] = useState(() => {
        const saved = localStorage.getItem('lt_folders');
        return saved ? JSON.parse(saved) : [
            { id: 'promo', name: '🎁 프로모션 대상' },
            { id: 'penalty', name: '⚠️ 위약금 지원' },
            { id: 'gift', name: '💰 사은품 협의' }
        ];
    });


    const [columnOrder, setColumnOrder] = useState(() => {
        const saved = localStorage.getItem('admin_column_order');
        // 기본 순서 정의
        return saved ? JSON.parse(saved) : ['checkbox', 'date', 'agent', 'name', 'phone', 'platform', 'status', 'request', 'manage'];
    });

    const [draggedColIdx, setDraggedColIdx] = useState(null);
    const [overColIdx, setOverColIdx] = useState(null);


    // 칼럼 드래그 시작
    const handleColDragStart = (idx) => {
        setDraggedColIdx(idx);
    };

    // 칼럼을 놓았을 때 순서 교체
    const handleColDrop = (targetIdx) => {
        if (draggedColIdx === null || draggedColIdx === targetIdx) return;

        const newOrder = [...columnOrder];
        const draggedItem = newOrder.splice(draggedColIdx, 1)[0];
        newOrder.splice(targetIdx, 0, draggedItem);

        setColumnOrder(newOrder);
        localStorage.setItem('admin_column_order', JSON.stringify(newOrder));
        setDraggedColIdx(null);
        setOverColIdx(null);
    };
    // 2. 고객-폴더 매핑 정보 (어떤 고객이 어떤 폴더에 있는지 저장)
    const [ltAssignments, setLtAssignments] = useState(() => {
        const saved = localStorage.getItem('lt_assignments');
        return saved ? JSON.parse(saved) : {};
    });

    // 3. 현재 선택된 폴더
    const [activeLtFolder, setActiveLtFolder] = useState('ALL');

    // 4. 자동 저장 (로컬 스토리지)
    useEffect(() => { localStorage.setItem('lt_folders', JSON.stringify(ltFolders)); }, [ltFolders]);
    useEffect(() => { localStorage.setItem('lt_assignments', JSON.stringify(ltAssignments)); }, [ltAssignments]);

    // -------------------------------------------------------------------------
    // 🎮 [장기 가망] 핸들러 함수들
    // -------------------------------------------------------------------------

    // 폴더 추가
    const handleAddLtFolder = () => {
        const name = prompt("새 폴더 이름을 입력하세요:");
        if (name) {
            setLtFolders([...ltFolders, { id: `f_${Date.now()}`, name }]);
        }
    };

    // 폴더 삭제
    const handleDeleteLtFolder = (id, e) => {
        e.stopPropagation();
        if (window.confirm("폴더를 삭제하시겠습니까? (안의 데이터는 '미분류'로 이동됩니다)")) {
            setLtFolders(ltFolders.filter(f => f.id !== id));
            // 해당 폴더에 있던 고객들의 매핑 정보 삭제
            const newAssign = { ...ltAssignments };
            Object.keys(newAssign).forEach(key => {
                if (newAssign[key] === id) delete newAssign[key];
            });
            setLtAssignments(newAssign);
            setActiveLtFolder('ALL');
        }
    };

    // 1. 삭제 버튼 클릭 시 대상을 지정하는 함수
    const openDeleteModalInViewer = (imgObj) => {
        setPolicyDeleteTarget(imgObj); // 삭제할 이미지 정보를 상태에 저장
    };

    // [삭제 확정 함수]
    const executePolicyDelete = async () => {
        if (!policyDeleteTarget) return;
        try {
            const res = await fetch(`${API_BASE}/api/policies/${policyDeleteTarget.id}/`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });
            if (res.ok) {
                alert("✅ 정책서가 삭제되었습니다.");
                setPolicyDeleteTarget(null); // 모달 닫기
                fetchNoticesAndPolicies();   // 목록 새로고침
            }
        } catch (e) {
            alert("서버 통신 중 오류가 발생했습니다.");
        }
    };

    // 드래그 시작 (고객 ID 저장)
    const handleLtDragStart = (e, customerId) => {
        e.dataTransfer.setData("customerId", customerId);
    };

    // 드롭 (폴더 이동)
    const handleLtDrop = (e, folderId) => {
        e.preventDefault();
        const customerId = e.dataTransfer.getData("customerId");
        if (!customerId) return;

        setLtAssignments(prev => ({
            ...prev,
            [customerId]: folderId
        }));
    };


    // 🟢 [추가] 날짜 라벨 동적 계산
    const today = new Date();
    // 이번 달 (예: 1월)
    const thisMonthLabel = `${today.getMonth() + 1}월`;
    // 저번 달 계산 (예: 2025년 12월)
    const lastMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastMonthLabel = `${lastMonthDate.getFullYear()}년 ${lastMonthDate.getMonth() + 1}월`;

    // 🟢 [추가] 공통 날짜 필터 렌더링 함수
    const renderDateFilter = () => (
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg border border-gray-200 mr-2">
            <select
                className="bg-white text-xs p-1.5 rounded-md border border-gray-300 outline-none focus:border-indigo-500 font-bold text-gray-700 cursor-pointer"
                value={dateFilter.type}
                onChange={(e) => handleDateFilterChange(e.target.value)}
            >
                <option value="all">📅 전체 기간</option>
                {/* 👇 여기 글자를 수정했습니다 */}
                <option value="this_month">📅 이번달</option>
                <option value="last_month">📅 저번달</option>
                <option value="custom">📅 직접 날짜 선택</option>
            </select>

            {/* 직접 선택일 때만 날짜 입력창 표시 (이 아래는 기존 코드 유지) */}
            {dateFilter.type === 'custom' && (
                <div className="flex items-center gap-1 animate-fade-in-right">
                    <input
                        type="date"
                        className="text-xs p-1 rounded border border-gray-300 outline-none bg-white"
                        value={dateFilter.start}
                        onClick={(e) => e.target.showPicker()}
                        onChange={(e) => setDateFilter({ ...dateFilter, start: e.target.value })}
                    />
                    <span className="text-gray-400">~</span>
                    <input
                        type="date"
                        className="text-xs p-1 rounded border border-gray-300 outline-none bg-white"
                        value={dateFilter.end}
                        onClick={(e) => e.target.showPicker()}
                        onChange={(e) => setDateFilter({ ...dateFilter, end: e.target.value })}
                    />
                </div>
            )}
        </div>
    );


    const handleDateFilterChange = (type) => {
        const today = new Date();
        let start = dateFilter.start;
        let end = dateFilter.end;

        if (type === 'this_month') {
            start = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
            end = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
        } else if (type === 'last_month') {
            start = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString().split('T')[0];
            end = new Date(today.getFullYear(), today.getMonth(), 0).toISOString().split('T')[0];
        } else if (type === 'all') {
            start = '';
            end = '';
        }

        setDateFilter({ type, start, end });
    };


    useEffect(() => { localStorage.setItem('admin_macros', JSON.stringify(macros)); }, [macros]);

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



    const chatListCustomers = useMemo(() => {
        let list = allCustomers;
        if (chatListSearch) {
            const term = chatListSearch.toLowerCase();
            list = list.filter(c =>
                (c.name && c.name.toLowerCase().includes(term)) || // 이름 검색
                (c.phone && c.phone.includes(term)) ||             // 번호 검색
                (c.last_memo && c.last_memo.toLowerCase().includes(term)) // 👈 대화 내용(메모) 검색 추가
            );
        }
        return list.sort((a, b) => new Date(b.upload_date) - new Date(a.upload_date));
    }, [allCustomers, chatListSearch]);   

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
    // =========================================================================
    // ⚙️ 데이터 필터링 및 가공 로직 (순서 중요!)
    // =========================================================================

    // 1️⃣ [가장 먼저 선언] 중복 데이터 계산 (duplicateSet)
    const duplicateSet = useMemo(() => {
        const phoneCounts = {};
        const dups = new Set();
        sharedCustomers.forEach(c => {
            const p = c.phone ? c.phone.trim() : '';
            if (p) phoneCounts[p] = (phoneCounts[p] || 0) + 1;
        });
        Object.keys(phoneCounts).forEach(phone => {
            if (phoneCounts[phone] > 1) dups.add(phone);
        });
        return dups;
    }, [sharedCustomers]);


    const handlePasteIntoTable = (e) => {
        e.preventDefault();
        const clipboardData = e.clipboardData || window.clipboardData;
        const text = clipboardData.getData('Text');

        if (!text) return;

        const rows = text.trim().split(/\r\n|\n|\r/).map((row, index) => {
            const cols = row.split('\t').map(c => c.trim());
            return {
                id: Date.now() + index,
                platform: cols[0] || '',
                name: cols[1] || '',
                phone: cols[2] || '',
                last_memo: cols[3] || ''
            };
        });

        // ⭐️ 기존 데이터 뒤에 붙이는 게 아니라, 새로 붙여넣은 데이터로 교체 (엑셀 초기 입력 느낌)
        setParsedData(rows);
    };

    // 2️⃣ [그 다음 선언] 화면 표시용 데이터 (displayedData) -> duplicateSet을 사용함
    const displayedData = useMemo(() => {
        let data = [];

        // 1. [관리자 전용] 전체 DB
        if (activeTab === 'total_manage') {
            data = allCustomers;
            // 담당자 필터
            if (totalDbAgentFilter) {
                if (totalDbAgentFilter === 'unassigned') data = data.filter(c => c.owner === null);
                else data = data.filter(c => String(c.owner) === String(totalDbAgentFilter));
            }
            // 🟢 [수정] 플랫폼(통신사) 필터 로직 추가
            if (platformFilter !== 'ALL') {
                data = data.filter(c => c.platform === platformFilter);
            }
            // 상태 필터
            if (statusFilter !== 'ALL') {
                data = data.filter(c => c.status === statusFilter);
            }
        }

        // 2. 공유 DB (미배정)
        else if (activeTab === 'shared') {
            data = sharedCustomers;
            // 플랫폼 필터
            if (sharedSubTab !== 'ALL') {
                if (sharedSubTab === '기타') {
                    const known = ['당근', '토스', '실패DB'];
                    data = data.filter(c => !known.includes(c.platform));
                } else {
                    data = data.filter(c => c.platform === sharedSubTab);
                }
            }
            // 중복 보기 (여기서 duplicateSet을 사용하므로 순서가 중요함)
            if (viewDuplicatesOnly) {
                data = data.filter(c => duplicateSet.has(c.phone)).sort((a, b) => a.phone.localeCompare(b.phone));
            }
            // 상태 필터
            if (statusFilter !== 'ALL') {
                data = data.filter(c => c.status === statusFilter);
            }
        }

        // 3. 내 상담관리
        else if (activeTab === 'consult') {
            data = allCustomers.filter(c =>
                String(c.owner) === String(currentUserId) &&
                !['설치완료', '해지진행', '접수취소', '실패', '실패이관'].includes(c.status)
            );
            if (statusFilter !== 'ALL') {
                data = data.filter(c => c.status === statusFilter);
            }
            // 재통화 시간 순 정렬
            data.sort((a, b) => {
                const dateA = a.callback_schedule ? new Date(a.callback_schedule).getTime() : Infinity;
                const dateB = b.callback_schedule ? new Date(b.callback_schedule).getTime() : Infinity;
                return dateA - dateB;
            });
        }

        // 4. 내 가망관리
        else if (activeTab === 'long_term') {
            data = allCustomers.filter(c =>
                String(c.owner) === String(currentUserId) &&
                ['장기가망', '접수완료'].includes(c.status)
            );
            if (statusFilter !== 'ALL') {
                data = data.filter(c => c.status === statusFilter);
            }
            data.sort((a, b) => new Date(a.callback_schedule || 0) - new Date(b.callback_schedule || 0));
        }

        // 5. AS/실패 관리 (4개 탭으로 분리)
        else if (activeTab === 'issue_manage') {
            if (issueSubTab === 'fail') {
                // [실패]
                data = allCustomers.filter(c => c.status === '실패');
                if (failReasonFilter) data = data.filter(c => c.detail_reason === failReasonFilter);
            }
            else if (issueSubTab === 'cancel') {
                // [접수취소]
                data = allCustomers.filter(c => c.status === '접수취소');
            }
            else if (issueSubTab === 'termination') {
                // [해지] (해지, 해지진행 등 포함)
                data = allCustomers.filter(c => c.status === '해지' || c.status === '해지진행');
            }
            else {
                // [AS 요청] (기본값) - AS요청 및 승인 건
                data = allCustomers.filter(c => c.status === 'AS요청' || c.status === 'AS승인');
            }
        }

        // 6. 접수관리
        else if (activeTab === 'reception') {
            data = allCustomers.filter(c => ['접수완료', '해지진행', '설치완료', '접수취소'].includes(c.status));
        }
        // 7. 설치완료
        else if (activeTab === 'installation') {
            data = allCustomers.filter(c => ['설치완료', '해지진행'].includes(c.status));
        }
        // 8. 정산관리 (useMemo 내부)
        else if (activeTab === 'settlement') {
            const targets = (config && config.settlement_target_statuses) ? config.settlement_target_statuses : ['설치완료', '접수완료', '해지진행'];
            data = allCustomers.filter(c => targets.includes(c.status));
            data = data.filter(c => c.status !== '접수취소');
            if (settlementStatusFilter !== 'ALL') data = data.filter(c => c.status === settlementStatusFilter);

            // 🟢 [추가] 거래처 필터링 로직
            if (clientFilter !== 'ALL') {
                if (clientFilter === 'unassigned') {
                    // 거래처가 없는 데이터만 보기
                    data = data.filter(c => !c.client);
                } else {
                    // 선택된 거래처와 일치하는 데이터만 보기
                    data = data.filter(c => c.client === clientFilter);
                }
            }
        }

        // --- 공통 필터 ---
        if (['reception', 'installation', 'settlement'].includes(activeTab) && salesAgentFilter) {
            data = data.filter(c => String(c.owner) === String(salesAgentFilter));
        }
        if (searchTerm) {
            data = data.filter(c => (c.name && c.name.includes(searchTerm)) || (c.phone && c.phone.includes(searchTerm)));
        }
        if (dateFilter.type !== 'all' && dateFilter.start && dateFilter.end) {
            data = data.filter(c => {
                const date = c.upload_date ? c.upload_date.substring(0, 10) : '';
                return date >= dateFilter.start && date <= dateFilter.end;
            });
        }

        data.sort((a, b) => {
            // 1순위: 등록일시 (upload_date)
            const dateA = new Date(a.upload_date || 0).getTime();
            const dateB = new Date(b.upload_date || 0).getTime();

            if (dateA !== dateB) {
                return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
            }

            // 2순위: 등록일이 같을 경우 고유 ID로 순서 고정 (데이터 튐 방지)
            return sortOrder === 'asc' ? a.id - b.id : b.id - a.id;
        });

        return data;
    }, [
        activeTab, allCustomers, sharedCustomers, duplicateSet,
        totalDbAgentFilter, issueSubTab, failReasonFilter, salesAgentFilter,
        settlementStatusFilter, statusFilter, sharedSubTab, config, currentUserId,
        viewDuplicatesOnly, searchTerm, dateFilter, platformFilter,
        sortOrder
    ]);

    // 3️⃣ [마지막 선언] 가망관리 폴더 필터링 (filteredLongTermData) -> displayedData를 사용함
    const filteredLongTermData = useMemo(() => {
        return displayedData.filter(c => {
            const assignedFolder = ltAssignments[c.id] || 'unassigned';
            if (activeLtFolder === 'ALL') return true;
            if (activeLtFolder === 'unassigned') return !ltAssignments[c.id];
            return assignedFolder === activeLtFolder;
        });
    }, [displayedData, activeLtFolder, ltAssignments]);


    // 🔔 [수정] 실시간 알림 목록 계산 (현재 시간 기준)
    const notifications = useMemo(() => {
        if (!currentUserId) return [];
        const now = new Date().getTime();

        return allCustomers.filter(c => {
            // 1. 내 고객인지 확인
            if (String(c.owner) !== String(currentUserId)) return false;
            // 2. 일정이 있고, '알림ON' 체크가 되어있는지 확인
            if (!c.callback_schedule) return false;
            const checklist = parseChecklist(c.checklist);
            if (!checklist.includes('알림ON')) return false;
            // 3. 이미 종료된 상태(실패, 취소 등)는 알림에서 제외
            if (['실패', '접수취소', '실패이관'].includes(c.status)) return false;
            // 4. 예정 시간이 현재 시간보다 지났거나 현재인 경우만 표시
            return new Date(c.callback_schedule).getTime() <= now;
        }).sort((a, b) => new Date(a.callback_schedule) - new Date(b.callback_schedule));
    }, [allCustomers, currentUserId]);

    const todayIssues = useMemo(() => {
        if (!notices || notices.length === 0) return [];
        const todayStr = new Date().toISOString().split('T')[0];
        return notices.filter(n => n.created_at && n.created_at.startsWith(todayStr));
    }, [notices]);

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

    const handleOpenChatGlobal = () => { setChatView('LIST'); setIsChatOpen(!isChatOpen); };

    const fetchChatHistory = async (cid) => {
        try {
            const res = await fetch(`${API_BASE}/api/sms/history/${cid}/`, { headers: getAuthHeaders() });
            if (res.ok) setChatMessages(await res.json());
        } catch { }
    };

    // 매크로 핸들러
    const handleAddMacro = () => { if (!newMacroText.trim()) return; setMacros(prev => ({ ...prev, [activeMacroTab]: [...(prev[activeMacroTab] || []), newMacroText.trim()] })); setNewMacroText(''); };
    const handleDeleteMacro = (idx) => { setMacros(prev => ({ ...prev, [activeMacroTab]: prev[activeMacroTab].filter((_, i) => i !== idx) })); };
    const handleMacroClick = (text) => { setChatInput(text); setShowMacro(false); };


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

    // ⭐️ [통계] 데이터 가공 로직 (해지 통계 및 최종 순수익 추가)
    const dashboardStats = useMemo(() => {
        if (!serverStats || serverStats.length === 0) return null;

        let targetStats = serverStats;
        const currentMonthKey = statDate.substring(0, 7); // 예: "2023-10"

        // 1. 기본 통계 데이터 (서버 데이터 기반)
        const totalDBAllAgents = serverStats.reduce((acc, s) => acc + safeParseInt(s.db), 0);

        if (selectedStatAgent !== 'ALL') {
            targetStats = serverStats.filter(s => String(s.id) === String(selectedStatAgent));
        }

        const totalDB = targetStats.reduce((acc, s) => acc + safeParseInt(s.db), 0);
        const acceptedCount = targetStats.reduce((acc, s) => acc + safeParseInt(s.accepted), 0);
        const acceptedRevenue = targetStats.reduce((acc, s) => acc + safeParseInt(s.acceptedRevenue), 0);
        const installedRevenue = targetStats.reduce((acc, s) => acc + safeParseInt(s.installedRevenue), 0);
        const installCount = targetStats.reduce((acc, s) => acc + safeParseInt(s.installed), 0);

        // 2. 광고비 계산
        const totalAdSpendInput = safeParseInt(monthlyAdSpends[currentMonthKey]);
        let finalAdSpend = totalAdSpendInput;
        if (selectedStatAgent !== 'ALL') {
            finalAdSpend = totalDBAllAgents > 0 ? Math.round(totalAdSpendInput * (totalDB / totalDBAllAgents)) : 0;
        }

        // 🟢 3. [신규] 해지 통계 직접 계산 (allCustomers 기반)
        // 조건: 현재 월(statDate), 선택된 플랫폼, 선택된 상담사, 상태가 '해지'/'해지진행'
        const cancelData = allCustomers.filter(c => {
            // 날짜 필터
            if (!c.upload_date || !c.upload_date.startsWith(currentMonthKey)) return false;
            // 상담사 필터
            if (selectedStatAgent !== 'ALL' && String(c.owner) !== String(selectedStatAgent)) return false;
            // 플랫폼 필터
            if (statPlatform !== 'ALL' && c.platform !== statPlatform) return false;
            // 상태 필터 (해지, 해지진행만 환수 대상으로 간주)
            return ['해지', '해지진행'].includes(c.status);
        });

        const cancelCount = cancelData.length; // 해지 건수

        // 해지 금액 (환수금) 계산: (본사정책 - 지원금) * 10000 -> 즉, 받았던 순수익을 뱉어냄
        const cancelAmount = cancelData.reduce((acc, c) => {
            const policy = safeParseInt(c.policy_amt || 0);
            const support = safeParseInt(c.support_amt || 0);
            return acc + ((policy - support) * 10000);
        }, 0);

        // 4. 비율 및 최종 수익 계산
        const acceptRate = totalDB > 0 ? ((acceptedCount / totalDB) * 100).toFixed(1) : 0;
        // 취소율 (전체 취소 건수 대비) - serverStats의 canceled는 접수취소 등을 포함할 수 있음
        const serverCancelCount = targetStats.reduce((acc, s) => acc + safeParseInt(s.canceled), 0);
        const cancelRate = (acceptedCount + serverCancelCount) > 0 ? ((serverCancelCount / (acceptedCount + serverCancelCount)) * 100).toFixed(1) : 0;

        const netInstallRate = acceptedCount > 0 ? ((installCount / acceptedCount) * 100).toFixed(1) : 0;
        const avgMargin = acceptedCount > 0 ? Math.round(acceptedRevenue / acceptedCount) : 0;

        // 🟢 최종 순수익 = 설치매출(확정) - 광고비 - 해지환수금
        const netProfit = installedRevenue - finalAdSpend - cancelAmount;

        return {
            totalDB, acceptedCount, acceptRate,
            acceptedRevenue, installedRevenue, installCount,
            cancelRate, netInstallRate, avgMargin,
            netProfit, // 최종 순수익
            adSpend: finalAdSpend,
            cancelCount, // 🟢 해지 건수 (내보내기)
            cancelAmount // 🟢 해지 금액 (내보내기)
        };
    }, [serverStats, monthlyAdSpends, selectedStatAgent, statDate, statPlatform, allCustomers]); // allCustomers 의존성 필수

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
    const handleDeleteCustomer = (id) => {
        const target = allCustomers.find(c => c.id === id);

        // 🔒 AS 승인 건은 삭제 불가 처리
        if (target && target.status === 'AS승인') {
            alert("⚠️ AS 승인된 건은 이력 보존을 위해 삭제할 수 없습니다.");
            return;
        }

        if (window.confirm("정말로 삭제하시겠습니까?")) {
            fetch(`${API_BASE}/api/customers/${id}/`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            }).then(() => loadCurrentTabData());
        }
    };

    // 기본 핸들러들
    const handleInlineUpdate = async (id, field, value) => {
        const target = allCustomers.find(c => c.id === id);
        // 🔒 이미 AS승인된 건은 상태(status) 변경 외의 수정을 원천 차단 (필요 시)
        if (target && target.status === 'AS승인' && field !== 'status') {
            return;
        }

        setAllCustomers(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
        try {
            await fetch(`${API_BASE}/api/customers/${id}/`, {
                method: 'PATCH',
                headers: getAuthHeaders(),
                body: JSON.stringify({ [field]: value })
            });
        } catch (error) {
            alert("저장 실패");
            loadCurrentTabData();
        }
    };

    const handlePaste = (e) => {
        e.preventDefault();
        // 클립보드 데이터 가져오기
        const clipboardData = e.clipboardData || window.clipboardData;
        const text = clipboardData.getData('Text');

        // 줄바꿈으로 행 분리
        const rows = text.trim().split(/\r\n|\n|\r/).map((row, index) => {
            // 탭(\t)으로 열 분리 (엑셀은 탭으로 구분됨)
            const cols = row.split('\t').map(c => c.trim());

            // 데이터 매핑 (순서: 플랫폼 / 이름 / 연락처 / 상담내용)
            // 엑셀 열 순서가 다르다면 여기서 인덱스([0], [1]..)를 조정하세요.
            return {
                id: Date.now() + index, // 임시 ID
                platform: cols[0] || '기타', // 1열: 플랫폼 (없으면 기타)
                name: cols[1] || '이름미상',   // 2열: 이름
                phone: cols[2] || '',        // 3열: 연락처
                last_memo: cols[3] || ''     // 4열: 상담 내용 (메모)
            };
        });

        // 기존 데이터에 추가 (또는 덮어쓰기)
        setParsedData(prev => [...prev, ...rows]);
    };

    const handleBulkSubmit = () => {
        if (parsedData.length === 0) return;

        // 현재 탭에 맞춰 데이터 가공 (담당자 ID 주입)
        const finalData = parsedData.map(row => {
            const newRow = { ...row };

            // 1. '내 상담관리' 탭에서 등록 시 -> 나에게 배정 + 미통건
            if (activeTab === 'consult') {
                newRow.owner_id = currentUserId; // ⭐️ 내 ID 추가
                newRow.status = '미통건';
            }
            // 2. '내 가망관리' 탭에서 등록 시 -> 나에게 배정 + 장기가망
            else if (activeTab === 'long_term') {
                newRow.owner_id = currentUserId;
                newRow.status = '장기가망';
            }
            // 3. '접수관리' 탭에서 등록 시 -> 나에게 배정 + 접수완료
            else if (activeTab === 'reception') {
                newRow.owner_id = currentUserId;
                newRow.status = '접수완료';
            }
            // 4. 그 외(전체관리, 공유 등)는 기본값 유지

            return newRow;
        });

        fetch(`${API_BASE}/api/customers/bulk_upload/`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ customers: finalData }) // ⭐️ 가공된 데이터 전송
        })
            .then(async (res) => {
                const data = await res.json();
                if (res.ok) {
                    alert(data.message);
                    setShowUploadModal(false); // 모달 닫기
                    setPasteData('');          // 입력창 초기화
                    setParsedData([]);         // 데이터 초기화
                    loadCurrentTabData();      // ⭐️ 목록 새로고침 (즉시 반영)
                } else {
                    alert(`오류: ${data.message}`);
                }
            })
            .catch(err => console.error(err));
    };
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
    const handleCallbackChange = (customer, type, val) => {
        let current = customer.callback_schedule ? new Date(customer.callback_schedule) : new Date();
        if (isNaN(current.getTime())) { current = new Date(); current.setHours(9, 0, 0, 0); }
        let y = current.getFullYear(); let m = current.getMonth() + 1; let d = current.getDate(); let h = current.getHours();
        if (type === 'year') y = parseInt(val) || y;
        if (type === 'month') m = parseInt(val) || m;
        if (type === 'day') d = parseInt(val) || d;
        if (type === 'hour') h = parseInt(val) || h;
        const newDate = new Date(y, m - 1, d, h);
        const yy = newDate.getFullYear(); const mm = String(newDate.getMonth() + 1).padStart(2, '0'); const dd = String(newDate.getDate()).padStart(2, '0'); const hh = String(newDate.getHours()).padStart(2, '0');
        handleInlineUpdate(customer.id, 'callback_schedule', `${yy}-${mm}-${dd}T${hh}:00:00`);
    };
    const openHistoryModal = (c) => { alert(`${c.name}님의 상세 정보로 이동합니다.`); };
    const handleAdSpendChange = (value) => { const cleanValue = value.replace(/[^0-9]/g, ''); const currentMonthKey = statDate.substring(0, 7); setMonthlyAdSpends(prev => ({ ...prev, [currentMonthKey]: cleanValue })); setAdSpend(cleanValue); };
    const handleColumnToggle = (col) => setVisibleColumns(prev => ({ ...prev, [col]: !prev[col] }));
    const handleCardToggle = (card) => setVisibleCards(prev => ({ ...prev, [card]: !prev[card] }));
    const toggleRow = (id) => { const newSet = new Set(expandedRows); if (newSet.has(id)) newSet.delete(id); else newSet.add(id); setExpandedRows(newSet); };
    // 🟢 [추가] 미리보기 테이블 데이터 수정 핸들러
    const handleCellChange = (id, field, value) => {
        setParsedData(prev => prev.map(row =>
            row.id === id ? { ...row, [field]: value } : row
        ));
    };

    // 🟢 [추가] 미리보기 행 삭제
    const handleDeleteParsedRow = (id) => {
        setParsedData(prev => prev.filter(row => row.id !== id));
    };


    // 상태 변경 핸들러
    const handleStatusChangeRequest = async (id, newStatus) => {

        // handleStatusChangeRequest 함수 내부의 '가망등록' if문 전체 교체
        if (newStatus === '가망등록') {
            const target = allCustomers.find(c => c.id === id);
            if (!target) return;

            if (!window.confirm(`[${target.name}] 님을 '내 가망관리'로 복사하시겠습니까?\n과거 상담 이력을 모두 통합합니다.`)) return;

            try {
                // 1. 기존 로그(히스토리) API 호출
                const logRes = await fetch(`${API_BASE}/api/customers/${target.id}/logs/`, { headers: getAuthHeaders() });
                let combinedHistory = "";
                if (logRes.ok) {
                    const logs = await logRes.json();
                    combinedHistory = logs
                        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
                        .map(log => `[📅 ${new Date(log.created_at).toLocaleString()} / 👤 ${log.user_name || '시스템'}]\n${log.content}`)
                        .join('\n\n--------------------------------\n\n');
                }

                // 2. 현재 메모 + 과거 이력 + 시스템 태그 결합
                const finalMemo = (target.last_memo ? `[최근 메모]\n${extractUserMemo(target.last_memo)}\n\n` : "") +
                    `=========== 📜 과거 상담 이력 ===========\n\n` + combinedHistory;

                // 3. 신규 데이터로 전송 (복사)
                const res = await fetch(`${API_BASE}/api/customers/bulk_upload/`, {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({
                        customers: [{
                            name: target.name, phone: target.phone, platform: target.platform,
                            owner_id: currentUserId, status: '장기가망', last_memo: finalMemo,
                            upload_date: new Date().toISOString().split('T')[0]
                        }]
                    })
                });
                if (res.ok) alert("✅ 히스토리와 함께 가망 리스트로 복사되었습니다.");
            } catch (e) { alert("복사 중 오류 발생"); }
            return;
        }

        // 1. 접수완료 처리
        if (newStatus === '접수완료') {
            const target = allCustomers.find(c => String(c.id) === String(id));
            if (!target) return;

            setCompletionTarget(target);
            const platformKey = target.platform && policyData[target.platform] ? target.platform : 'KT';
            setSelectedPlatform(platformKey);

            setDynamicFormData({});
            setCalculatedPolicy(0);
            setShowCompletionModal(true);
            setCompletionTrigger(prev => prev + 1);
            return;
        }

        // 🟢 [추가] 2. 접수 취소 처리 (모달 띄우기 & 즉시 변경 방지)
        else if (newStatus === '접수취소') {
            const target = allCustomers.find(c => c.id === id);
            if (target) {
                setCancelTarget(target);           // 대상 설정
                setSelectedCancelReason('');       // 사유 초기화
                setCancelMemo('');                 // 메모 초기화
                setIsMoveToPotential(false);       // 이동 옵션 초기화
                setShowCancelModal(true);          // 모달 열기
            }
            return; // ⭐️ 여기서 리턴하여 handleInlineUpdate가 실행되지 않게 막음 (리스트에서 사라짐 방지)
        }

        // 3. 실패 처리 (모달 열기)
        else if (newStatus === '실패') {
            const target = allCustomers.find(c => c.id === id);
            setFailTarget(target);
            setSelectedFailReason('');
            setShowFailModal(true);
            return;
        }

        // 4. 실패이관 처리
        else if (newStatus === '실패이관') {
            // ... (기존 실패이관 코드 유지) ...
            try {
                await fetch(`${API_BASE}/api/customers/${id}/add_log/`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ user_id: user.user_id, content: `[시스템] 빠른 실패이관 처리` }) });
                await fetch(`${API_BASE}/api/customers/${id}/`, { method: 'PATCH', headers: getAuthHeaders(), body: JSON.stringify({ status: '실패이관', owner: null }) });
                loadCurrentTabData();
            } catch (err) { console.error(err); }
            return;
        }

        // 5. 그 외 상태 변경 (바로 변경)
        handleInlineUpdate(id, 'status', newStatus);
    };



    // 🟢 [추가] 실패 확정 핸들러
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
                // 로컬 데이터 즉시 업데이트
                setAllCustomers(prev => prev.map(c =>
                    c.id === failTarget.id
                        ? { ...c, status: '실패', detail_reason: selectedFailReason }
                        : c
                ));
                setShowFailModal(false);
                setFailTarget(null);
            })
            .catch(err => alert("오류 발생: " + err));
    };

    // 🟢 [수정] handleFormDataChange: 상품 선택 시 금액 및 양식 데이터 실시간 연동
    const handleFormDataChange = (category, productName) => {
        const categoryList = policyData[selectedPlatform][category] || [];
        const selectedProduct = categoryList.find(p => p.name === productName);

        if (!selectedProduct) {
            // 선택 해제 시 해당 카테고리 데이터 초기화
            const newFormData = { ...dynamicFormData };
            delete newFormData[category];
            setDynamicFormData(newFormData);
        } else {
            // 상품 정보 주입
            setDynamicFormData(prev => ({
                ...prev,
                [category]: {
                    name: selectedProduct.name,
                    fee: safeParseInt(selectedProduct.fee),
                    install_fee: safeParseInt(selectedProduct.install_fee),
                    policy: safeParseInt(selectedProduct.policy)
                }
            }));
        }

        // 정책금 및 합계 금액 계산은 렌더링 시 실시간 useMemo나 별도 변수로 처리
    };

    // 🟢 [추가] 최종 양식 텍스트 생성기
    const generateOrderText = () => {
        if (!completionTarget) return "";

        // 선택된 상품들 합산
        const products = Object.values(dynamicFormData);
        const bundleName = products.map(p => p.name).join(' + ');
        const totalFee = products.reduce((acc, cur) => acc + (cur.fee || 0), 0);
        const totalInstallFee = products.reduce((acc, cur) => acc + (cur.install_fee || 0), 0);
        const totalPolicy = products.reduce((acc, cur) => acc + (cur.policy || 0), 0);

        return `■ 고객정보
성명: ${completionTarget.name}
연락처: ${completionTarget.phone}
주민번호: ${dynamicFormData.jumin || ''}

■ 상품정보
번들상품: [${selectedPlatform}] ${bundleName}
월 이용료: ${formatCurrency(totalFee)}원
설치비: ${formatCurrency(totalInstallFee)}원
정책금: ${formatCurrency(totalPolicy * 10000)}원

■ 설치정보
주소지: ${dynamicFormData.address || ''}
설치희망일: ${dynamicFormData.hope_date || ''}
사은품: ${dynamicFormData.gift || ''}
자동이체: ${dynamicFormData.bank || ''}`;
    };

    const handleConfirmCompletion = (generatedText) => {
        if (!completionTarget) return;

        // 선택된 모든 상품의 정책 합계 계산
        const totalPolicy = Object.values(dynamicFormData).reduce((acc, cur) => acc + (cur.policy || 0), 0);

        const payload = {
            status: '접수완료', // 확실하게 접수완료로 전송
            platform: selectedPlatform,
            // 생성된 양식 텍스트를 메모에 저장
            last_memo: generatedText || completionTarget.last_memo,
            agent_policy: totalPolicy,
            installed_date: null
        };

        fetch(`${API_BASE}/api/customers/${completionTarget.id}/`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        })
            .then(async (res) => {
                if (res.ok) {
                    // 로그 기록 (양식 텍스트 포함)
                    const logContent = `[시스템 자동접수]\n통신사: ${selectedPlatform}\n예상 정책금: ${totalPolicy}만원\n\n${generatedText}`;

                    await fetch(`${API_BASE}/api/customers/${completionTarget.id}/add_log/`, {
                        method: 'POST',
                        headers: getAuthHeaders(),
                        body: JSON.stringify({ user_id: currentUserId, content: logContent })
                    });

                    alert("🎉 접수가 완료되었습니다!");
                    setShowCompletionModal(false);
                    setCompletionTarget(null);
                    loadCurrentTabData(); // 데이터 새로고침
                    setActiveTab('reception'); // 접수관리 탭으로 이동
                } else {
                    alert("접수 처리 중 서버 오류가 발생했습니다.");
                }
            })
            .catch(err => console.error(err));
    };

    const openMemoPopup = (e, customer, field) => { e.stopPropagation(); setMemoPopupTarget(customer); setMemoFieldType(field); setMemoPopupText(customer[field] || ''); };
    const saveMemoPopup = () => { if (!memoPopupTarget || !memoFieldType) return; handleInlineUpdate(memoPopupTarget.id, memoFieldType, memoPopupText); setMemoPopupTarget(null); };
    const handleResponse = (status) => { if (!requestTarget) return; setAllCustomers(prev => prev.map(c => c.id === requestTarget.id ? { ...c, request_status: status } : c)); fetch(`${API_BASE}/api/customers/${requestTarget.id}/`, { method: 'PATCH', headers: getAuthHeaders(), body: JSON.stringify({ request_status: status }) }).then(() => { alert("처리됨"); setShowResponseModal(false); setRequestTarget(null); }); };
    const handleResponseAction = (status) => { if (!responseTarget) return; setAllCustomers(prev => prev.map(c => c.id === responseTarget.id ? { ...c, request_status: status } : c)); fetch(`${API_BASE}/api/customers/${responseTarget.id}/`, { method: 'PATCH', headers: getAuthHeaders(), body: JSON.stringify({ request_status: status }) }).then(() => { alert("처리됨"); setShowResponseModal(false); setResponseTarget(null); }); };
    const enterChatRoom = (c) => { setChatTarget(c); setChatView('ROOM'); setChatMessages([]); fetchChatHistory(c.id); };
    const backToChatList = () => { setChatView('LIST'); setChatTarget(null); setChatMessages([]); };
    const handleOpenChat = (e, c) => { e.stopPropagation(); e.preventDefault(); setChatTarget(c); setChatView('ROOM'); setChatMessages([]); setIsChatOpen(true); fetchChatHistory(c.id); };
    // 🟢 [수정됨] 텍스트 + 이미지 전송 핸들러
    // AgentDashboard 내의 handleSendManualChat 수정
    // handleSendManualChat을 FormData 방식으로 교체
    const handleSendManualChat = async (textToSend = null) => {
        const msg = textToSend || chatInput;
        if ((!msg?.trim() && !chatFile) || !chatTarget) return;

        setIsSending(true);
        try {
            const formData = new FormData();
            formData.append('customer_id', chatTarget.id);
            formData.append('token', smsConfig.token); // 앱 설정에 따라 password 또는 token 사용

            if (msg?.trim()) formData.append('message', msg);
            if (chatFile) formData.append('image', chatFile);

            const headers = getAuthHeaders();
            delete headers['Content-Type']; // ⭐️ 필수: 브라우저가 자동 설정하게 함

            const res = await fetch(`${API_BASE}/api/sales/manual-sms/`, {
                method: 'POST',
                headers: headers,
                body: formData
            });

            if (res.ok) {
                setChatInput('');
                setChatFile(null);
                fetchChatHistory(chatTarget.id); // 즉시 갱신
            }
        } catch (e) { console.error(e); }
        finally { setIsSending(false); }
    };

    // useEffect 구역에 채팅 자동 새로고침 추가
    useEffect(() => {
        let interval;
        if (isChatOpen && chatTarget && chatView === 'ROOM') {
            interval = setInterval(() => fetchChatHistory(chatTarget.id), 5000);
        }
        return () => clearInterval(interval);
    }, [isChatOpen, chatTarget, chatView]);

    // AgentDashboard 내 useEffect들 사이에 추가
    useEffect(() => {
        let interval;
        if (isChatOpen && chatTarget && chatView === 'ROOM') {
            // 5초마다 대화 내역 리프레시
            interval = setInterval(() => {
                fetchChatHistory(chatTarget.id);
            }, 5000);
        }
        return () => clearInterval(interval);
    }, [isChatOpen, chatTarget, chatView]);

    const renderInteractiveStars = (id, currentRank) => (
        <div className="flex cursor-pointer" onClick={(e) => e.stopPropagation()}>
            {[1, 2, 3, 4, 5].map(star => (
                <span key={star} className={`text-lg ${star <= currentRank ? 'text-yellow-400' : 'text-gray-300'} hover:scale-125 transition`} onClick={() => handleInlineUpdate(id, 'rank', star)}>★</span>
            ))}
        </div>
    );

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
            <style>{`
    .no-spin::-webkit-inner-spin-button, .no-spin::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; } 
    .no-spin { -moz-appearance: textfield; }
    .hide-scrollbar::-webkit-scrollbar { display: none; } 
    .cursor-col-resize { cursor: col-resize; }
    .dragging-column { opacity: 0.5; background-color: #e0e7ff !important; }
    .drop-target-left { border-left: 3px solid #4f46e5 !important; }
    .drop-target-right { border-right: 3px solid #4f46e5 !important; }

    /* 🟢 스프레드시트 핵심 스타일 */
    .sheet-table { 
    border-collapse: collapse !important; 
    table-layout: auto; /* fixed에서 auto로 변경: 내용에 맞춰 너비 조절 */
    width: 100%; 
}
    .sheet-table th, .sheet-table td {
    white-space: nowrap; /* 텍스트가 줄바꿈되어 지저분해지는 것 방지 */
}
    .sheet-input { 
        font-size: 12px !important; 
        padding: 2px !important; 
        border: none !important; 
        background: transparent;
    }   


.excel-sheet {
    border-collapse: collapse;
    table-layout: fixed;
    width: 100%;
    background-color: white;
}
.excel-sheet th {
    background-color: #f8f9fa; /* 엑셀 헤더 색상 */
    border: 1px solid #c0c0c0;
    color: #444;
    font-size: 11px;
    font-weight: normal;
    text-align: center;
    height: 25px;
}
.excel-sheet td {
    border: 1px solid #dee2e6;
    padding: 0;
    height: 50px; /* ⭐️ 칸 높이 대폭 확대 */
}
.excel-sheet input {
    width: 100%;
    height: 100%;
    border: none;
    padding: 0 12px;
    font-size: 14px; /* ⭐️ 글자 크기 확대 */
    outline: none;
    background-color: transparent;
}
.excel-sheet input:focus {
    background-color: #f1f3ff;
    box-shadow: inset 0 0 0 2px #4c6ef5; /* 포커스 시 테두리 강조 */
}
.excel-col-index {
    background-color: #e9ecef !important;
    font-weight: bold !important;
    width: 50px;
    color: #868e96;
    text-align: center;
}
`}</style>
            <header className="flex justify-between items-center bg-white px-6 py-4 rounded-2xl shadow-sm mb-6 border border-gray-200 sticky top-0 z-40 backdrop-blur-md bg-white/90">

                {/* [LEFT] 타이틀 & 주요 도구 버튼군 */}
                <div className="flex items-center gap-6">
                    <h1 className="text-xl font-black text-indigo-900 flex items-center gap-2 shrink-0">
                        {/* 아이콘도 관리자(👑)에서 사용자(👤)로 변경해 보았습니다 */}
                        <span className="bg-indigo-600 text-white w-8 h-8 flex items-center justify-center rounded-lg shadow-indigo-200 shadow-lg">👤</span>

                        {/* 로그인한 사용자의 username 표시 */}
                        <span className="text-indigo-600">{user?.username || '상담사'}</span> 대시보드
                    </h1>

                    <div className="h-6 w-px bg-gray-200 mx-2 hidden md:block"></div>

                    <div className="flex items-center gap-2">
                        {/* 🖼️ 정책표 뷰어 (타이틀 옆으로 이동) */}
                        <button
                            onClick={() => {
                                setViewerPlatform('KT');
                                setShowPolicyViewer(true);
                                setPolicyViewerTrigger(prev => prev + 1);
                                fetchNoticesAndPolicies();
                            }}
                            className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                        >
                            <span className="text-sm">🖼️</span> 정책 뷰어
                        </button>

                        {/* 📱 핸드폰 연동 테스트 (신규) */}
                        <button
                            onClick={() => setShowMobileModal(true)}
                            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                        >
                            <span className="text-sm">📱</span> 연동 테스트
                        </button>
                    </div>
                </div>

                {/* [RIGHT] 유틸리티 및 시스템 버튼군 */}
                <div className="flex items-center gap-4">

                    {/* 상단 현황판 토글 */}
                    <button
                        onClick={() => setIsTopStatsVisible(!isTopStatsVisible)}
                        className={`flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-full border transition-all shadow-sm
            ${isTopStatsVisible ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}
                    >
                        📊 {isTopStatsVisible ? '현황판 숨기기' : '현황판 보기'}
                    </button>

                    <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-xl border border-gray-100">
                        {/* 문자(채팅) 아이콘 */}
                        <button
                            onClick={() => handleOpenChatGlobal()}
                            className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-white hover:text-indigo-600 text-gray-400 transition relative"
                            title="메시지 관리"
                        >
                            <span className="text-xl">💬</span>
                        </button>

                        {/* 🔔 헤더 알림 영역 교체 */}
                        <div className="relative">
                            <button
                                onClick={(e) => { e.stopPropagation(); setShowNotiDropdown(!showNotiDropdown); }}
                                className={`w-10 h-10 flex items-center justify-center rounded-lg transition-all relative ${showNotiDropdown ? 'bg-white text-yellow-500 shadow-sm' : 'text-gray-400 hover:bg-white hover:text-yellow-500'
                                    }`}
                            >
                                <span className="text-xl">{notifications.length > 0 ? '🔔' : '🔕'}</span>
                                {notifications.length > 0 && (
                                    <span className="absolute top-2 right-2 bg-red-500 text-white text-[9px] font-black px-1.5 rounded-full border-2 border-white animate-pulse">
                                        {notifications.length}
                                    </span>
                                )}
                            </button>

                            {/* 알림 드롭다운 창 */}
                            {showNotiDropdown && (
                                <div className="absolute right-0 top-12 w-80 bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden z-50 animate-fade-in-down">
                                    <div className="bg-indigo-50 p-4 border-b border-gray-200 font-bold flex justify-between items-center text-indigo-900 text-sm">
                                        <div className="flex items-center gap-2">
                                            <span>⏰ 재통화 알림</span>
                                            <span className="bg-indigo-600 text-white text-[10px] px-2 py-0.5 rounded-full">{notifications.length}</span>
                                        </div>
                                        <button className="text-xs text-gray-400 hover:text-gray-600" onClick={() => setShowNotiDropdown(false)}>닫기</button>
                                    </div>
                                    <div className="max-h-80 overflow-y-auto custom-scrollbar">
                                        {notifications.length === 0 ? (
                                            <div className="p-10 text-center flex flex-col items-center gap-2">
                                                <span className="text-3xl grayscale opacity-30">🔔</span>
                                                <p className="text-gray-400 text-xs italic">현재 예정된 재통화 일정이 없습니다.</p>
                                            </div>
                                        ) : (
                                            notifications.map(n => (
                                                <div
                                                    key={n.id}
                                                    onClick={() => handleNotificationClick(n)}
                                                    className="p-4 border-b border-gray-50 hover:bg-indigo-50/50 cursor-pointer flex justify-between items-center transition-colors"
                                                >
                                                    <div className="min-w-0">
                                                        <div className="font-bold text-sm text-gray-800 truncate">{n.name}</div>
                                                        <div className="text-[11px] text-gray-400 font-mono">{n.phone}</div>
                                                        <div className="text-[10px] text-indigo-500 font-bold mt-1">
                                                            {new Date(n.callback_schedule).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                        </div>
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded shadow-sm ${getBadgeStyle(n.status)}`}>
                                                            {n.status}
                                                        </span>
                                                        <div className="text-[10px] text-red-400 font-bold mt-2">지금 연락요망</div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <button
                        onClick={onLogout}
                        className="ml-2 bg-slate-800 hover:bg-black text-white px-5 py-2.5 rounded-xl text-xs font-bold transition shadow-lg flex items-center gap-2"
                    >
                        <span>🚪</span> 로그아웃
                    </button>
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
            <div className="sticky top-[85px] z-30 bg-slate-50 pt-2 pb-1 flex justify-between items-end mb-4 border-b border-gray-200">
                <div className="flex gap-1 overflow-x-auto hide-scrollbar flex-nowrap flex-1">
                    {tabsConfig.filter(t => t.visible).map((tab, idx) => (
                        <button
                            key={tab.id}
                            draggable
                            onDragStart={() => handleTabDragStart(idx)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() => handleTabDrop(idx)}
                            onClick={() => { setActiveTab(tab.id); setStatusFilter('ALL'); }}
                            className={`px-4 py-2 rounded-t-lg text-[13px] font-bold transition whitespace-nowrap border-t border-l border-r cursor-move
                    ${activeTab === tab.id
                                    ? 'bg-white text-indigo-600 border-gray-200 border-b-white translate-y-[1px]'
                                    : 'bg-gray-100 text-gray-400 border-transparent hover:bg-gray-200'}`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* 탭 관리 버튼 (우측 끝에 고정) */}
                <button
                    onClick={() => setShowTabSettings(true)}
                    className="px-3 py-2 mb-1 ml-2 bg-white border border-gray-300 rounded-lg text-xs font-bold text-gray-500 hover:bg-gray-50 shadow-sm transition"
                    title="탭 순서 및 표시 설정"
                >
                    ⚙️ 탭 관리
                </button>
            </div>

            {renderCommonControlPanel()}

            <div className="bg-white rounded-xl shadow-lg min-h-[600px] border border-gray-200 p-6 overflow-x-auto">

                {/* 5. 통계 탭 (관리자용) */}
                {activeTab === 'stats' && dashboardStats && (
                    <div className="space-y-6 animate-fade-in">

                        {/* (1) 상단 컨트롤 바 */}
                        <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-gray-50 rounded-xl border border-gray-200 shadow-sm">
                            <div className="flex items-center gap-2">
                                <div className="flex bg-white rounded-lg border border-gray-300 overflow-hidden p-1">
                                    <button onClick={() => setStatPeriodType('month')} className={`px-3 py-1.5 text-xs font-bold rounded transition ${statPeriodType === 'month' ? 'bg-indigo-600 text-white' : 'hover:bg-gray-100'}`}>월별</button>
                                    <button onClick={() => { setStatPeriodType('day'); setStatDate(new Date().toISOString().split('T')[0]); }} className={`px-3 py-1.5 text-xs font-bold rounded transition ${statPeriodType === 'day' ? 'bg-indigo-600 text-white' : 'hover:bg-gray-100'}`}>일별</button>
                                </div>

                                <input
                                    type={statPeriodType === 'month' ? 'month' : 'date'}
                                    className="bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-sm font-bold text-gray-700 outline-none focus:border-indigo-500"
                                    value={statPeriodType === 'month' ? (statDate.length > 7 ? statDate.substring(0, 7) : statDate) : (statDate.length === 7 ? `${statDate}-01` : statDate)}
                                    onChange={(e) => setStatDate(e.target.value)}
                                />

                                <select className="bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-sm font-bold text-gray-700 outline-none focus:border-indigo-500" value={statPlatform} onChange={(e) => setStatPlatform(e.target.value)}>
                                    <option value="ALL">전체 플랫폼</option>
                                    {config?.report_platform_filters?.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                                </select>
                            </div>

                            <div className="flex items-center gap-2">
                                {/* 상담사 선택 (미배정 제외) */}
                                <select
                                    className="bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-sm font-bold text-indigo-700 outline-none focus:border-indigo-500 shadow-sm cursor-pointer"
                                    value={selectedStatAgent}
                                    onChange={(e) => setSelectedStatAgent(e.target.value)}
                                >
                                    <option value="ALL">👥 전체 상담사 합계</option>
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

                        {/* (2) 핵심 지표 카드 */}
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

                            {/* 🟢 [신규] 해지 및 환수 카드 추가 */}
                            <div className="bg-white p-5 border border-red-100 rounded-2xl shadow-sm flex flex-col justify-between">
                                <div className="flex justify-between">
                                    <div className="text-xs font-bold text-red-500 mb-1">해지(환수)</div>
                                    <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold">{dashboardStats.cancelCount}건</span>
                                </div>
                                <div className="text-2xl font-extrabold text-red-600">
                                    -{formatCurrency(dashboardStats.cancelAmount)} <span className="text-sm font-normal text-gray-400">원</span>
                                </div>
                            </div>

                            {visibleCards.adSpend && (
                                <div className="bg-white p-5 border border-orange-100 rounded-2xl shadow-sm flex flex-col justify-between">
                                    <div className="text-xs font-bold text-orange-500 mb-1">광고비 (지출)</div>
                                    <div className="text-2xl font-extrabold text-orange-600">
                                        -{formatCurrency(dashboardStats.adSpend)} <span className="text-sm font-normal text-gray-400">원</span>
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

                            {/* 🟢 [수정] 최종 순수익 (해지금액 차감 반영됨) */}
                            {visibleCards.netProfit && (
                                <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-5 rounded-2xl shadow-lg flex flex-col justify-between text-white col-span-2 md:col-span-1">
                                    <div className="flex justify-between items-start">
                                        <div className="text-xs font-bold text-indigo-100 mb-1">최종 순수익</div>
                                        <div className="text-[10px] bg-white/20 px-1.5 rounded">매출-광고-해지</div>
                                    </div>
                                    <div className="text-3xl font-extrabold mt-2">
                                        {formatCurrency(dashboardStats.netProfit)} <span className="text-sm font-medium opacity-70">원</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* (3) 상세 테이블 섹션 (전체 상담사 표시) */}
                        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-xs tracking-wider border-b border-slate-200 sticky top-0 z-10">
                                    <tr>
                                        {visibleColumns.owner_name && <th className="px-4 py-3">담당자</th>}
                                        {visibleColumns.db && <th className="px-4 py-3 text-right">디비</th>}
                                        {visibleColumns.accepted && <th className="px-4 py-3 text-right text-blue-600">접수</th>}
                                        {visibleColumns.installed && <th className="px-4 py-3 text-right text-green-600">설치</th>}
                                        {visibleColumns.canceled && <th className="px-4 py-3 text-right text-red-500">취소</th>}
                                        {visibleColumns.adSpend && <th className="px-4 py-3 text-right text-gray-500">광고비</th>}
                                        {visibleColumns.acceptedRevenue && <th className="px-4 py-3 text-right">접수매출</th>}
                                        {visibleColumns.installedRevenue && <th className="px-4 py-3 text-right">설치매출</th>}
                                        {visibleColumns.netProfit && <th className="px-4 py-3 text-right text-indigo-700 bg-indigo-50">순이익</th>}
                                        {visibleColumns.acceptRate && <th className="px-4 py-3 text-right">접수율</th>}
                                        {visibleColumns.cancelRate && <th className="px-4 py-3 text-right">취소율</th>}
                                        {visibleColumns.netInstallRate && <th className="px-4 py-3 text-right">순청약율</th>}
                                        {visibleColumns.avgMargin && <th className="px-4 py-3 text-right">평균마진</th>}
                                        <th className="px-4 py-3 text-right text-purple-600">순이익율</th>
                                        <th className="px-4 py-3 text-center">상세</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {agentStats.map(agent => (
                                        <React.Fragment key={agent.id}>
                                            <tr className="border-b border-slate-100 hover:bg-slate-50 transition duration-150 font-bold text-gray-800">
                                                {visibleColumns.owner_name && <td className="px-4 py-3">{String(agent.id) === String(currentUserId) ? `${agent.name} (나)` : agent.name}</td>}
                                                {visibleColumns.db && <td className="px-4 py-3 text-right">{agent.db}</td>}
                                                {visibleColumns.accepted && <td className="px-4 py-3 text-right text-blue-600">{agent.accepted}</td>}
                                                {visibleColumns.installed && <td className="px-4 py-3 text-right text-green-600">{agent.installed}</td>}
                                                {visibleColumns.canceled && <td className="px-4 py-3 text-right text-red-500">{agent.canceled}</td>}
                                                {visibleColumns.adSpend && <td className="px-4 py-3 text-right text-red-400">{formatCurrency(agent.adSpend)}</td>}
                                                {visibleColumns.acceptedRevenue && <td className="px-4 py-3 text-right text-blue-500">{formatCurrency(agent.acceptedRevenue)}</td>}
                                                {visibleColumns.installedRevenue && <td className="px-4 py-3 text-right text-green-600">{formatCurrency(agent.installedRevenue)}</td>}
                                                {visibleColumns.netProfit && <td className="px-4 py-3 text-right text-indigo-700 bg-indigo-50">{formatCurrency(agent.netProfit)}</td>}
                                                {visibleColumns.acceptRate && <td className="px-4 py-3 text-right">{agent.acceptRate}%</td>}
                                                {visibleColumns.cancelRate && <td className="px-4 py-3 text-right">{agent.cancelRate}%</td>}
                                                {visibleColumns.netInstallRate && <td className="px-4 py-3 text-right">{agent.netInstallRate}%</td>}
                                                {visibleColumns.avgMargin && <td className="px-4 py-3 text-right">{formatCurrency(agent.avgMargin)}</td>}
                                                <td className="px-4 py-3 text-right text-purple-600">{agent.netProfitMargin}%</td>

                                                <td className="px-4 py-3 text-center">
                                                    <button
                                                        onClick={() => toggleRow(agent.id)}
                                                        className="text-xs bg-indigo-100 text-indigo-600 px-2 py-1 rounded hover:bg-indigo-200 transition"
                                                    >
                                                        {expandedRows.has(agent.id) ? '접기 ▲' : '플랫폼 ▼'}
                                                    </button>
                                                </td>
                                            </tr>

                                            {/* 확장된 상세 행 (플랫폼별 데이터) */}
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
                    </div>
                )}

                

                {/* 2. [공유 DB] - 수정됨: 하위 탭/검색바 삭제, 운영 툴바(정렬/날짜/중복/배정) 적용 */}
                {activeTab === 'shared' && (
                    <div className="animate-fade-in h-full flex flex-col">

                        {/* (1) 타이틀 영역 */}
                        <div className="mb-2 shrink-0">
                            <h2 className="text-xl font-extrabold text-gray-800 flex items-center gap-2">
                                🛒 미배정 DB 관리
                            </h2>
                        </div>

                        {/* 🟢 [신규] 공유 DB 전용 운영 툴바 */}
                        <div className="flex flex-wrap justify-between items-center mb-3 bg-white p-2 rounded-lg border border-gray-100 shadow-sm">

                            {/* 왼쪽: 정렬 + 날짜 + 중복토글 */}
                            <div className="flex gap-2 items-center">
                                {renderSortToggle()} {/* 👈 정렬 버튼 추가됨 */}
                                {renderDateFilter()}
                                <button
                                    onClick={() => setViewDuplicatesOnly(!viewDuplicatesOnly)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border shadow-sm transition ${viewDuplicatesOnly ? 'bg-red-50 text-red-600 border-red-200' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
                                >
                                    {viewDuplicatesOnly ? '✅ 전체 보기' : '🚫 중복 DB만 보기'}
                                </button>
                            </div>

                            {/* 오른쪽: 데이터 이동(배정) 기능 - 디자인 통일 */}
                            <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-lg p-1.5">
                                <span className="text-[11px] text-indigo-800 font-bold px-1">⚡ 상담사 배정:</span>
                                <select
                                    className="bg-white border border-indigo-200 text-gray-700 text-xs rounded h-8 px-2 outline-none cursor-pointer font-bold focus:border-indigo-500"
                                    value={targetAgentId}
                                    onChange={e => setTargetAgentId(e.target.value)}
                                >
                                    <option value="">선택하세요...</option>
                                    <option value={currentUserId}>👤 나 (관리자)</option>
                                    {agents.map(a => <option key={a.id} value={a.id}>{a.username}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* (3) 테이블 영역 */}
                        <div className="flex-1 overflow-auto border border-gray-200 rounded-xl shadow-sm relative bg-white" style={{ maxHeight: 'calc(100vh - 280px)' }}>
                            <table className="sheet-table w-full text-left">
                                <thead className="bg-gray-100 text-gray-500 font-bold uppercase text-xs">
                                    <tr>
                                        <th className="p-3 w-10 text-center sticky top-0 left-0 z-30 bg-gray-100 border-b border-r border-gray-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                            <input type="checkbox" className="accent-indigo-600" onChange={(e) => handleSelectAll(e, displayedData)} checked={displayedData.length > 0 && selectedIds.length === displayedData.length} />
                                        </th>
                                        <th className="p-3 sticky top-0 z-20 bg-gray-100 border-b border-gray-200">날짜</th>
                                        <th className="p-3 sticky top-0 z-20 bg-gray-100 border-b border-gray-200">플랫폼</th>
                                        <th className="p-3 sticky top-0 z-20 bg-gray-100 border-b border-gray-200">이름</th>
                                        <th className="p-3 sticky top-0 z-20 bg-gray-100 border-b border-gray-200">번호</th>
                                        <th className="p-3 sticky top-0 z-20 bg-gray-100 border-b border-gray-200">광고비</th>
                                        <th className="p-3 sticky top-0 z-20 bg-gray-100 border-b border-gray-200">중복여부</th>
                                        <th className="p-3 sticky top-0 z-20 bg-gray-100 border-b border-gray-200">관리</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 bg-white">
                                    {displayedData.map(c => {
                                        const isDup = duplicateSet.has(c.phone);
                                        return (
                                            <tr key={c.id} className={`border-b border-gray-100 hover:bg-indigo-50 transition ${isDup ? 'bg-red-50' : ''}`}>
                                                <td className="p-3 text-center sticky left-0 z-10 bg-white group-hover:bg-indigo-50 border-r border-gray-100">
                                                    <input type="checkbox" className="accent-indigo-600" checked={selectedIds.includes(c.id)} onChange={() => handleCheck(c.id)} />
                                                </td>
                                                <td className="p-3 text-gray-500 text-xs font-mono">{c.upload_date}</td>
                                                <td className="p-3">
                                                    <span className="bg-gray-100 border border-gray-200 px-2 py-1 rounded text-xs text-gray-600 font-bold">{c.platform}</span>
                                                </td>
                                                <td className="p-3 font-bold">{c.name}</td>
                                                <td className="p-3 text-gray-500 text-xs font-mono">{c.phone}</td>
                                                <td className="p-3 font-bold text-gray-600">{(c.ad_cost || 0).toLocaleString()}</td>
                                                <td className="p-3">
                                                    {isDup && <span className="bg-red-100 text-red-600 border border-red-200 px-2 py-0.5 rounded text-xs font-bold">중복됨</span>}
                                                </td>
                                                <td className="p-3 flex gap-2">
                                                    <button onClick={() => handleAssignToMe(c.id)} className="bg-emerald-500 hover:bg-emerald-600 text-white px-2 py-1 rounded text-xs font-bold shadow-sm transition">⚡ 가져가기</button>
                                                    <button onClick={() => handleDeleteCustomer(c.id)} className="text-red-500 hover:text-red-700 font-bold text-xs border border-red-100 px-2 py-1 rounded hover:bg-red-50 transition">삭제</button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {displayedData.length === 0 && (
                                        <tr><td colSpan="8" className="p-10 text-center text-gray-400">데이터가 없습니다.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* 3. [내 상담관리] - 수정됨: 운영 툴바 적용 (정렬/날짜/등록버튼) */}
                {activeTab === 'consult' && (
                    <div className="animate-fade-in h-full flex flex-col">

                        {/* (1) 타이틀 영역 */}
                        <div className="mb-2 shrink-0">
                            <h2 className="text-xl font-extrabold text-indigo-900 flex items-center gap-2">
                                📞 내 상담 리스트 (관리자용)
                            </h2>
                        </div>

                        {/* 🟢 [신규] 상담관리 전용 운영 툴바 */}
                        <div className="flex flex-wrap justify-between items-center mb-3 bg-white p-2 rounded-lg border border-gray-100 shadow-sm">

                            {/* 왼쪽: 정렬 + 날짜 */}
                            <div className="flex gap-2 items-center">
                                {renderSortToggle()}
                                {renderDateFilter()}
                            </div>

                            {/* 오른쪽: 고객 등록 버튼 */}
                            <div>
                                <button
                                    onClick={() => setShowUploadModal(true)}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white h-8 px-4 rounded text-xs font-bold transition shadow-sm flex items-center gap-1"
                                >
                                    ➕ 고객 등록
                                </button>
                            </div>
                        </div>

                        {/* 🟢 [수정됨] 상담관리 테이블: 최적화된 중간 사이즈 (Balanced Size) */}
                        <div className="flex-1 overflow-auto border border-gray-200 rounded-xl shadow-sm bg-white" style={{ maxHeight: 'calc(100vh - 280px)' }}>
                            <table className="sheet-table w-full text-left">
                                {/* 헤더: 적당한 높이와 폰트 사이즈 */}
                                <thead className="bg-slate-100 text-slate-500 font-bold uppercase text-[11px] tracking-tight border-b border-slate-200 sticky top-0 z-10">
                                    <tr>
                                        <th className="px-3 py-2 w-10 text-center border-r border-slate-200">
                                            <input
                                                type="checkbox"
                                                className="accent-indigo-600 cursor-pointer w-3.5 h-3.5"
                                                onChange={(e) => handleSelectAll(e, displayedData)}
                                                checked={displayedData.length > 0 && selectedIds.length === displayedData.length}
                                            />
                                        </th>
                                        <th className="px-3 py-2 w-12 text-center border-r border-slate-200">No.</th>
                                        <th className="px-3 py-2 w-24 border-r border-slate-200">플랫폼</th>
                                        <th className="px-3 py-2 w-24 border-r border-slate-200">등록일</th>
                                        <th className="px-3 py-2 w-24 border-r border-slate-200">이름</th>
                                        <th className="px-3 py-2 w-32 border-r border-slate-200">연락처</th>
                                        <th className="px-3 py-2 w-48 text-indigo-700 border-r border-slate-200">재통화(년/월/일/시)</th>
                                        <th className="px-3 py-2 w-28 text-center border-r border-slate-200">상태</th>
                                        <th className="px-3 py-2 min-w-[300px]">상담 메모</th>
                                    </tr>
                                </thead>

                                {/* 바디: text-xs(12px) + 적당한 패딩(px-3 py-2.5) */}
                                <tbody className="divide-y divide-gray-100 text-xs text-gray-700">
                                    {displayedData.map(c => {
                                        const scheduleDate = c.callback_schedule ? new Date(c.callback_schedule) : new Date();
                                        const currentH = isNaN(scheduleDate.getTime()) ? '' : scheduleDate.getHours();
                                        const checklistItems = parseChecklist(c.checklist);
                                        const isAlarmOn = checklistItems.includes('알림ON');

                                        return (
                                            <tr
                                                key={c.id}
                                                id={`row-${c.id}`}
                                                className={`transition duration-500 group ${c.id === highlightedId ? 'bg-yellow-200 ring-2 ring-yellow-400 z-10' : 'hover:bg-yellow-50/50'
                                                    }`}
                                            >

                                                {/* 1. 체크박스 */}
                                                <td className="px-3 py-2.5 text-center border-r border-slate-100">
                                                    <input
                                                        type="checkbox"
                                                        className="accent-indigo-600 cursor-pointer w-3.5 h-3.5"
                                                        checked={selectedIds.includes(c.id)}
                                                        onChange={() => handleCheck(c.id)}
                                                    />
                                                </td>

                                                {/* 2. 번호 */}
                                                <td className="px-3 py-2.5 text-center text-gray-400 border-r border-slate-100 font-mono">
                                                    {c.id}
                                                </td>

                                                {/* 3. 플랫폼 */}
                                                <td className="px-3 py-2.5 border-r border-slate-100">
                                                    <select
                                                        className="bg-transparent border-b border-transparent hover:border-gray-300 rounded text-xs font-bold text-gray-600 outline-none cursor-pointer w-full py-0.5"
                                                        value={c.platform}
                                                        onChange={(e) => handleInlineUpdate(c.id, 'platform', e.target.value)}
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        {platformList.map(p => <option key={p} value={p}>{p}</option>)}
                                                    </select>
                                                </td>

                                                {/* 4. 등록일 */}
                                                <td className="px-3 py-2.5 text-gray-400 text-[11px] font-mono border-r border-slate-100 whitespace-nowrap">
                                                    {c.upload_date?.substring(2, 10)}
                                                </td>

                                                {/* 5. 이름 */}
                                                <td className="px-3 py-2.5 border-r border-slate-100">
                                                    <input
                                                        type="text"
                                                        className="bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-500 outline-none w-full font-bold text-gray-800 transition py-0.5"
                                                        defaultValue={c.name}
                                                        onBlur={(e) => handleInlineUpdate(c.id, 'name', e.target.value)}
                                                    />
                                                    <div className="flex mt-1 gap-0.5">{[...Array(5)].map((_, i) => <span key={i} className={`text-[9px] leading-none cursor-pointer ${i < c.rank ? 'text-yellow-400' : 'text-gray-200'}`} onClick={() => handleInlineUpdate(c.id, 'rank', i + 1)}>★</span>)}</div>
                                                </td>

                                                {/* 6. 연락처 */}
                                                <td className="px-3 py-2.5 border-r border-slate-100">
                                                    <input
                                                        type="text"
                                                        className="bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-500 outline-none w-full text-gray-600 font-mono tracking-tight transition py-0.5"
                                                        defaultValue={c.phone}
                                                        onBlur={(e) => handleInlineUpdate(c.id, 'phone', e.target.value)}
                                                    />
                                                    <div className="mt-1">
                                                        <button onClick={(e) => handleOpenChat(e, c)} className="text-[10px] bg-white border border-gray-200 text-indigo-600 px-1.5 py-0.5 rounded hover:bg-indigo-50 transition flex items-center gap-1">
                                                            <span>💬</span> SMS
                                                        </button>
                                                    </div>
                                                </td>

                                                {/* 7. 재통화 일정 */}
                                                <td className="px-3 py-2.5 border-r border-slate-100">
                                                    <div className="flex items-center gap-1">
                                                        <input
                                                            type="date"
                                                            className="bg-transparent text-gray-700 text-xs outline-none hover:text-indigo-600 cursor-pointer font-bold w-24 py-0.5"
                                                            value={c.callback_schedule ? c.callback_schedule.split('T')[0] : ''}
                                                            onClick={(e) => e.target.showPicker()}
                                                            onChange={(e) => {
                                                                const newDate = e.target.value;
                                                                const formattedH = String(currentH).padStart(2, '0');
                                                                if (newDate) handleInlineUpdate(c.id, 'callback_schedule', `${newDate}T${formattedH}:00:00`);
                                                            }}
                                                        />
                                                        <select
                                                            className="bg-white border border-gray-200 rounded text-[11px] p-0.5 text-center outline-none focus:border-indigo-500 cursor-pointer h-6"
                                                            value={currentH}
                                                            onChange={(e) => {
                                                                const newH = String(e.target.value).padStart(2, '0');
                                                                const datePart = c.callback_schedule ? c.callback_schedule.split('T')[0] : new Date().toISOString().split('T')[0];
                                                                handleInlineUpdate(c.id, 'callback_schedule', `${datePart}T${newH}:00:00`);
                                                            }}
                                                        >
                                                            <option value="" disabled>시</option>
                                                            {TIME_OPTIONS.map(h => <option key={h} value={h}>{h}</option>)}
                                                        </select>
                                                        <button
                                                            onClick={(e) => handleToggleAlarm(e, c)}
                                                            className={`w-6 h-6 flex items-center justify-center rounded-full border transition-all ${isAlarmOn ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-300 border-gray-200'}`}
                                                            title="알림 토글"
                                                        >
                                                            <span className="text-[10px]">{isAlarmOn ? '🔔' : '🔕'}</span>
                                                        </button>
                                                    </div>
                                                </td>

                                                {/* 8. 상태 */}
                                                <td className="px-3 py-2.5 border-r border-slate-100">
                                                    <div className="relative w-full">
                                                        <select
                                                            className={`w-full py-1.5 pl-2 pr-6 rounded-lg text-[11px] font-bold outline-none border cursor-pointer appearance-none text-center transition-colors ${getBadgeStyle(c.status)}`}
                                                            value={c.status}
                                                            onChange={(e) => handleStatusChangeRequest(c.id, e.target.value)}
                                                        >
                                                            {statusList.map(opt => <option key={opt} value={opt} className="bg-white text-gray-700 text-xs">{opt}</option>)}
                                                        </select>
                                                        <div className="pointer-events-none absolute inset-y-0 right-1.5 flex items-center px-1 text-gray-500 opacity-50">
                                                            <svg className="fill-current h-3 w-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                                                        </div>
                                                    </div>
                                                </td>

                                                <td className="px-3 py-2.5 align-top">
                                                    <div className="flex items-start gap-2 w-full group relative">
                                                        <textarea
                                                            className="flex-1 bg-transparent border-b border-gray-100 hover:border-gray-300 focus:border-indigo-500 rounded p-1 transition-all resize-none leading-normal min-h-[32px] focus:bg-white focus:shadow-xl focus:z-50 focus:h-auto focus:min-h-[80px] py-1.5 text-[12px] overflow-hidden whitespace-nowrap focus:whitespace-pre-wrap"
                                                            rows={1}
                                                            /* ⭐️ 중요: 화면에는 내가 쓴 메모만 보여줌 */
                                                            value={extractUserMemo(c.last_memo)}
                                                            onChange={(e) => {
                                                                // 실시간 타이핑 가능하게 처리
                                                                const newNote = e.target.value;
                                                                const systemPart = extractSystemForm(c.last_memo);
                                                                // 저장 시에는 메모 + 기존 양식을 합쳐서 보냄
                                                                const merged = newNote + (systemPart ? "\n\n" + systemPart : "");
                                                                handleInlineUpdate(c.id, 'last_memo', merged);
                                                            }}
                                                            onBlur={(e) => e.target.style.height = '2rem'}
                                                            onInput={autoResizeTextarea}
                                                            onDoubleClick={() => handleOpenHistory(c)}
                                                            placeholder="메모..."
                                                            onKeyDown={(e) => handleMemoKeyDown(e, c.id, c.name)}
                                                        />
                                                        <button
                                                            onClick={() => openActionMemo(c)}
                                                            className="shrink-0 p-1.5 bg-indigo-50 text-indigo-600 rounded border border-indigo-200 hover:bg-indigo-600 hover:text-white transition shadow-sm"
                                                        >
                                                            📝
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {displayedData.length === 0 && (
                                        <tr><td colSpan="9" className="p-20 text-center text-gray-400">데이터가 없습니다.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* 2. [내 가망관리] - 🟢 (수정됨: 툴바 추가 - 정렬/날짜/등록버튼) */}
                {activeTab === 'long_term' && (
                    <div className="flex flex-col h-[750px] gap-2 animate-fade-in">

                        {/* (1) 타이틀 영역 */}
                        <div className="mb-1 shrink-0">
                            <h2 className="text-xl font-extrabold text-indigo-900 flex items-center gap-2">
                                📅 내 가망관리
                            </h2>
                        </div>

                        {/* 🟢 (2) 운영 툴바 (정렬 + 날짜 + 등록버튼) */}
                        <div className="flex flex-wrap justify-between items-center mb-1 bg-white p-2 rounded-lg border border-gray-100 shadow-sm shrink-0">
                            {/* 왼쪽: 정렬 + 날짜 */}
                            <div className="flex gap-2 items-center">
                                {renderSortToggle()}
                                {renderDateFilter()}
                            </div>

                            {/* 오른쪽: 고객 등록 버튼 */}
                            <div>
                                <button
                                    onClick={() => setShowUploadModal(true)}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white h-8 px-4 rounded text-xs font-bold transition shadow-sm flex items-center gap-1"
                                >
                                    ➕ 고객 등록
                                </button>
                            </div>
                        </div>

                        {/* (3) 상단 폴더 탭 영역 (가로 스크롤) */}
                        <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar pb-2 px-1 shrink-0">
                            {/* 전체 보기 */}
                            <button
                                onClick={() => setActiveLtFolder('ALL')}
                                className={`px-4 py-2.5 rounded-xl font-bold text-sm transition shadow-sm border whitespace-nowrap flex items-center gap-2
                    ${activeLtFolder === 'ALL'
                                        ? 'bg-indigo-600 text-white border-indigo-600 ring-2 ring-indigo-100'
                                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                            >
                                <span>🗂️ 전체 ({displayedData.length})</span>
                            </button>

                            {/* 미분류 (드롭 가능) */}
                            <button
                                onClick={() => setActiveLtFolder('unassigned')}
                                onDragOver={handleDragOver}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    const cid = e.dataTransfer.getData("customerId");
                                    const newMap = { ...ltAssignments };
                                    delete newMap[cid];
                                    setLtAssignments(newMap);
                                }}
                                className={`px-4 py-2.5 rounded-xl font-bold text-sm transition shadow-sm border whitespace-nowrap flex items-center gap-2
                    ${activeLtFolder === 'unassigned'
                                        ? 'bg-gray-600 text-white border-gray-600'
                                        : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50 border-dashed'}`}
                            >
                                <span>📁 미분류</span>
                            </button>

                            <div className="h-6 w-px bg-gray-300 mx-1"></div>

                            {/* 사용자 정의 폴더 (드롭 가능) */}
                            {ltFolders.map(folder => (
                                <div
                                    key={folder.id}
                                    onClick={() => setActiveLtFolder(folder.id)}
                                    onDragOver={handleDragOver}
                                    onDrop={(e) => handleLtDrop(e, folder.id)}
                                    className={`relative group px-4 py-2.5 rounded-xl font-bold text-sm transition shadow-sm border whitespace-nowrap cursor-pointer flex items-center gap-2
                        ${activeLtFolder === folder.id
                                            ? 'bg-indigo-50 text-white border-indigo-500'
                                            : 'bg-white text-gray-700 border-gray-200 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200'
                                        }`}
                                >
                                    <span>
                                        {folder.id === 'promo' ? '🎁' : folder.id === 'penalty' ? '⚠️' : folder.id === 'gift' ? '💰' : '📁'} {folder.name}
                                    </span>
                                    {/* 삭제 버튼 */}
                                    <span
                                        onClick={(e) => handleDeleteLtFolder(folder.id, e)}
                                        className={`ml-2 text-xs w-5 h-5 flex items-center justify-center rounded-full transition 
                            ${activeLtFolder === folder.id ? 'hover:bg-indigo-400 text-indigo-200' : 'hover:bg-red-100 text-gray-300 hover:text-red-500'}`}
                                    >
                                        ×
                                    </span>
                                </div>
                            ))}

                            {/* 폴더 추가 버튼 */}
                            <button
                                onClick={handleAddLtFolder}
                                className="px-3 py-2.5 rounded-xl font-bold text-sm text-gray-400 border border-dashed border-gray-300 hover:border-indigo-400 hover:text-indigo-500 transition whitespace-nowrap"
                            >
                                + 폴더 추가
                            </button>
                        </div>

                        {/* 🟢 [수정됨] 가망관리 테이블: 상담관리와 동일한 디자인 및 사이즈 적용 */}
                        <div className="flex-1 overflow-auto border border-gray-200 rounded-xl shadow-sm bg-white" style={{ maxHeight: 'calc(100vh - 280px)' }}>
                            <table className="sheet-table w-full text-left">
                                {/* 헤더 */}
                                <thead className="bg-slate-100 text-slate-500 font-bold uppercase text-[11px] tracking-tight border-b border-slate-200 sticky top-0 z-10">
                                    <tr>
                                        <th className="px-3 py-2 w-10 text-center border-r border-slate-200">
                                            <input
                                                type="checkbox"
                                                className="accent-indigo-600 cursor-pointer w-3.5 h-3.5"
                                                onChange={(e) => handleSelectAll(e, filteredLongTermData)}
                                                checked={filteredLongTermData.length > 0 && selectedIds.length === filteredLongTermData.length}
                                            />
                                        </th>
                                        <th className="px-3 py-2 w-12 text-center border-r border-slate-200">No.</th>
                                        <th className="px-3 py-2 w-24 border-r border-slate-200">분류</th> {/* 가망 전용 컬럼 */}
                                        <th className="px-3 py-2 w-24 border-r border-slate-200">플랫폼</th>
                                        <th className="px-3 py-2 w-24 border-r border-slate-200">등록일</th>
                                        <th className="px-3 py-2 w-24 border-r border-slate-200">이름</th>
                                        <th className="px-3 py-2 w-32 border-r border-slate-200">연락처</th>
                                        <th className="px-3 py-2 w-48 text-indigo-700 border-r border-slate-200">재통화(년/월/일/시)</th>
                                        <th className="px-3 py-2 w-28 text-center border-r border-slate-200">상태</th>
                                        <th className="px-3 py-2 min-w-[300px]">상담 메모</th>
                                    </tr>
                                </thead>

                                {/* 바디 */}
                                <tbody className="divide-y divide-gray-100 text-xs text-gray-700">
                                    {filteredLongTermData.map(c => {
                                        const scheduleDate = c.callback_schedule ? new Date(c.callback_schedule) : new Date();
                                        const currentH = isNaN(scheduleDate.getTime()) ? '' : scheduleDate.getHours();
                                        const checklistItems = parseChecklist(c.checklist);
                                        const isAlarmOn = checklistItems.includes('알림ON');

                                        // 가망관리 전용 변수
                                        const folderId = ltAssignments[c.id];
                                        const folderName = ltFolders.find(f => f.id === folderId)?.name || '미분류';

                                        return (
                                            <tr
                                                key={c.id}
                                                id={`row-${c.id}`}
                                                className={`transition duration-500 group cursor-grab active:cursor-grabbing ${c.id === highlightedId ? 'bg-yellow-200 ring-2 ring-yellow-400 z-10' : 'hover:bg-yellow-50/50'
                                                    }`}
                                            >

                                                {/* 1. 체크박스 */}
                                                <td className="px-3 py-2.5 text-center border-r border-slate-100">
                                                    <input
                                                        type="checkbox"
                                                        className="accent-indigo-600 cursor-pointer w-3.5 h-3.5"
                                                        checked={selectedIds.includes(c.id)}
                                                        onChange={() => handleCheck(c.id)}
                                                    />
                                                </td>

                                                {/* 2. 번호 */}
                                                <td className="px-3 py-2.5 text-center text-gray-400 border-r border-slate-100 font-mono">
                                                    {c.id}
                                                </td>

                                                {/* 3. 분류 (가망 전용) */}
                                                <td className="px-3 py-2.5 border-r border-slate-100">
                                                    <span className={`text-[10px] px-2 py-1 rounded border whitespace-nowrap font-bold ${folderId ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                                                        {folderId ? folderName : '미분류'}
                                                    </span>
                                                </td>

                                                {/* 4. 플랫폼 */}
                                                <td className="px-3 py-2.5 border-r border-slate-100">
                                                    <select
                                                        className="bg-transparent border-b border-transparent hover:border-gray-300 rounded text-xs font-bold text-gray-600 outline-none cursor-pointer w-full py-0.5"
                                                        value={c.platform}
                                                        onChange={(e) => handleInlineUpdate(c.id, 'platform', e.target.value)}
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        {platformList.map(p => <option key={p} value={p}>{p}</option>)}
                                                    </select>
                                                </td>

                                                {/* 5. 등록일 */}
                                                <td className="px-3 py-2.5 text-gray-400 text-[11px] font-mono border-r border-slate-100 whitespace-nowrap">
                                                    {c.upload_date?.substring(2, 10)}
                                                </td>

                                                {/* 6. 이름 */}
                                                <td className="px-3 py-2.5 border-r border-slate-100">
                                                    <input
                                                        type="text"
                                                        className="bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-500 outline-none w-full font-bold text-gray-800 transition py-0.5"
                                                        defaultValue={c.name}
                                                        onBlur={(e) => handleInlineUpdate(c.id, 'name', e.target.value)}
                                                    />
                                                    <div className="flex mt-1 gap-0.5">{[...Array(5)].map((_, i) => <span key={i} className={`text-[9px] leading-none cursor-pointer ${i < c.rank ? 'text-yellow-400' : 'text-gray-200'}`} onClick={() => handleInlineUpdate(c.id, 'rank', i + 1)}>★</span>)}</div>
                                                </td>

                                                {/* 7. 연락처 */}
                                                <td className="px-3 py-2.5 border-r border-slate-100">
                                                    <input
                                                        type="text"
                                                        className="bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-500 outline-none w-full text-gray-600 font-mono tracking-tight transition py-0.5"
                                                        defaultValue={c.phone}
                                                        onBlur={(e) => handleInlineUpdate(c.id, 'phone', e.target.value)}
                                                    />
                                                    <div className="mt-1">
                                                        <button onClick={(e) => handleOpenChat(e, c)} className="text-[10px] bg-white border border-gray-200 text-indigo-600 px-1.5 py-0.5 rounded hover:bg-indigo-50 transition flex items-center gap-1">
                                                            <span>💬</span> SMS
                                                        </button>
                                                    </div>
                                                </td>

                                                {/* 8. 재통화 일정 */}
                                                <td className="px-3 py-2.5 border-r border-slate-100">
                                                    <div className="flex items-center gap-1">
                                                        <input
                                                            type="date"
                                                            className="bg-transparent text-gray-700 text-xs outline-none hover:text-indigo-600 cursor-pointer font-bold w-24 py-0.5"
                                                            value={c.callback_schedule ? c.callback_schedule.split('T')[0] : ''}
                                                            // ⭐️👇 여기를 수정하세요 (onClick에 preventDefault 추가)
                                                            onClick={(e) => {
                                                                e.preventDefault(); // 드래그 방지
                                                                e.target.showPicker(); // 달력 열기
                                                            }}
                                                            // 드래그 기능과 충돌 방지를 위해 마우스 누름 이벤트 전파 차단
                                                            onMouseDown={(e) => e.stopPropagation()}
                                                            onChange={(e) => {
                                                                const newDate = e.target.value;
                                                                const formattedH = String(currentH).padStart(2, '0');
                                                                if (newDate) handleInlineUpdate(c.id, 'callback_schedule', `${newDate}T${formattedH}:00:00`);
                                                            }}
                                                        />
                                                        <select
                                                            className="bg-white border border-gray-200 rounded text-[11px] p-0.5 text-center outline-none focus:border-indigo-500 cursor-pointer h-6"
                                                            value={currentH}
                                                            onChange={(e) => {
                                                                const newH = String(e.target.value).padStart(2, '0');
                                                                const datePart = c.callback_schedule ? c.callback_schedule.split('T')[0] : new Date().toISOString().split('T')[0];
                                                                handleInlineUpdate(c.id, 'callback_schedule', `${datePart}T${newH}:00:00`);
                                                            }}
                                                        >
                                                            <option value="" disabled>시</option>
                                                            {TIME_OPTIONS.map(h => <option key={h} value={h}>{h}</option>)}
                                                        </select>
                                                        <button
                                                            onClick={(e) => handleToggleAlarm(e, c)}
                                                            className={`w-6 h-6 flex items-center justify-center rounded-full border transition-all ${isAlarmOn ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-300 border-gray-200'}`}
                                                            title="알림 토글"
                                                        >
                                                            <span className="text-[10px]">{isAlarmOn ? '🔔' : '🔕'}</span>
                                                        </button>
                                                    </div>
                                                </td>

                                                {/* 9. 상태 */}
                                                <td className="px-3 py-2.5 border-r border-slate-100">
                                                    <div className="relative w-full">
                                                        <select
                                                            className={`w-full py-1.5 pl-2 pr-6 rounded-lg text-[11px] font-bold outline-none border cursor-pointer appearance-none text-center transition-colors ${getBadgeStyle(c.status)}`}
                                                            value={c.status}
                                                            onChange={(e) => handleStatusChangeRequest(c.id, e.target.value)}
                                                        >
                                                            {statusList.map(opt => <option key={opt} value={opt} className="bg-white text-gray-700 text-xs">{opt}</option>)}
                                                        </select>
                                                        <div className="pointer-events-none absolute inset-y-0 right-1.5 flex items-center px-1 text-gray-500 opacity-50">
                                                            <svg className="fill-current h-3 w-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                                                        </div>
                                                    </div>
                                                </td>

                                                <td className="px-3 py-2.5 align-top">
                                                    <div className="flex items-start gap-2 w-full group relative">
                                                        <textarea
                                                            className="flex-1 bg-transparent border-b border-gray-100 hover:border-gray-300 focus:border-indigo-500 rounded p-1 transition-all resize-none leading-normal min-h-[32px] focus:bg-white focus:shadow-xl focus:z-50 focus:h-auto focus:min-h-[80px] py-1.5 text-[12px] overflow-hidden whitespace-nowrap focus:whitespace-pre-wrap"
                                                            rows={1}
                                                            /* ⭐️ 중요: 화면에는 내가 쓴 메모만 보여줌 */
                                                            value={extractUserMemo(c.last_memo)}
                                                            onChange={(e) => {
                                                                // 실시간 타이핑 가능하게 처리
                                                                const newNote = e.target.value;
                                                                const systemPart = extractSystemForm(c.last_memo);
                                                                // 저장 시에는 메모 + 기존 양식을 합쳐서 보냄
                                                                const merged = newNote + (systemPart ? "\n\n" + systemPart : "");
                                                                handleInlineUpdate(c.id, 'last_memo', merged);
                                                            }}
                                                            onBlur={(e) => e.target.style.height = '2rem'}
                                                            onInput={autoResizeTextarea}
                                                            onDoubleClick={() => handleOpenHistory(c)}
                                                            placeholder="메모..."
                                                            onKeyDown={(e) => handleMemoKeyDown(e, c.id, c.name)}
                                                        />
                                                        <button
                                                            onClick={() => openActionMemo(c)}
                                                            className="shrink-0 p-1.5 bg-indigo-50 text-indigo-600 rounded border border-indigo-200 hover:bg-indigo-600 hover:text-white transition shadow-sm"
                                                        >
                                                            📝
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {filteredLongTermData.length === 0 && (
                                        <tr><td colSpan="10" className="p-20 text-center text-gray-400">데이터가 없습니다.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}


                
                {/* 🟢 [수정완료] 13. 업무노트 (상단 탭 & 간편화 버전) */}
                {activeTab === 'work_memo' && (
                    <div className="flex flex-col h-[750px] bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden animate-fade-in">

                        {/* (Top) 메모 탭 바 & 컨트롤 영역 */}
                        <div className="bg-gray-50 border-b border-gray-200 p-2 flex items-center gap-2">

                            {/* 왼쪽: 휴지통/추가 버튼 */}
                            <div className="flex items-center gap-1 border-r border-gray-300 pr-2 shrink-0">
                                <button
                                    onClick={() => setViewMode(viewMode === 'active' ? 'trash' : 'active')}
                                    className={`p-2 rounded-lg transition-all ${viewMode === 'trash' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-200'}`}
                                    title={viewMode === 'active' ? '휴지통 보기' : '메모장으로 복귀'}
                                >
                                    {viewMode === 'active' ? '🗑️' : '📝'}
                                </button>
                                {viewMode === 'active' && (
                                    <button
                                        onClick={handleAddMemoTab}
                                        className="p-2 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors font-bold"
                                        title="새 메모 추가"
                                    >
                                        ➕ 새 메모
                                    </button>
                                )}
                            </div>

                            {/* 중간: 가로 스크롤 탭 리스트 */}
                            <div className="flex-1 flex gap-1 overflow-x-auto hide-scrollbar scroll-smooth px-2 items-center h-10">
                                {viewMode === 'active' ? (
                                    workMemos.length === 0 ? (
                                        <span className="text-xs text-gray-400 pl-2">작성된 메모가 없습니다.</span>
                                    ) : (
                                        workMemos.map(memo => (
                                            <div
                                                key={memo.id}
                                                onClick={() => setActiveMemoId(memo.id)}
                                                className={`px-4 py-1.5 rounded-t-lg cursor-pointer transition-all border-t border-l border-r flex items-center gap-2 min-w-[120px] max-w-[180px] shrink-0
                                    ${activeMemoId === memo.id
                                                        ? 'bg-white border-gray-200 text-indigo-600 font-bold translate-y-[5px] z-10 shadow-[0_-2px_10px_-3px_rgba(0,0,0,0.05)]'
                                                        : 'bg-gray-100 border-transparent text-gray-500 hover:bg-gray-200'}`}
                                            >
                                                <div className={`w-2 h-2 rounded-full ${(memo.color || 'bg-yellow-50').replace('bg-', 'bg-').replace('-50', '-400')}`}></div>
                                                <span className="text-xs truncate flex-1">{memo.title || '제목 없음'}</span>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleMoveToTrash(memo.id); }}
                                                    className="text-gray-400 hover:text-red-500 text-[10px] p-0.5"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        ))
                                    )
                                ) : (
                                    /* 휴지통 모드일 때 상단 표시 */
                                    <div className="flex gap-2 items-center overflow-x-auto">
                                        <span className="text-xs font-bold text-red-500 mr-2 shrink-0">🗑️ 휴지통 내역:</span>
                                        {trashMemos.map(memo => (
                                            <div key={memo.id} className="bg-red-50 border border-red-100 px-3 py-1 rounded-full flex items-center gap-2 shrink-0">
                                                <span className="text-xs text-red-700 font-medium">{memo.title || '제목 없음'}</span>
                                                <button onClick={() => handleRestoreMemo(memo.id)} className="text-[10px] text-blue-600 font-bold hover:underline">복원</button>
                                                <button onClick={() => handlePermanentDelete(memo.id)} className="text-[10px] text-red-600 font-bold hover:underline">삭제</button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* (Bottom) 메모 상세 편집 영역 */}
                        <div className="flex-1 flex flex-col bg-white overflow-hidden">
                            {activeMemoId && viewMode === 'active' ? (
                                (() => {
                                    const activeMemo = workMemos.find(m => m.id === activeMemoId);
                                    if (!activeMemo) return null;
                                    const memoColor = activeMemo.color || 'bg-yellow-50';
                                    return (
                                        <>
                                            {/* 제목 및 색상 선택바 */}
                                            <div className={`p-3 border-b flex justify-between items-center transition-colors ${memoColor}`}>
                                                <input
                                                    type="text"
                                                    className="bg-transparent border-none outline-none text-lg font-black text-gray-800 w-full placeholder-gray-400/60"
                                                    placeholder="여기에 제목을 입력하세요"
                                                    value={activeMemo.title}
                                                    onChange={(e) => handleUpdateMemo(activeMemo.id, 'title', e.target.value)}
                                                />
                                                <div className="flex gap-1.5 ml-4 bg-white/40 p-1.5 rounded-full backdrop-blur-sm shadow-inner">
                                                    {['bg-yellow-50', 'bg-blue-50', 'bg-green-50', 'bg-pink-50', 'bg-purple-50'].map(c => (
                                                        <div
                                                            key={c}
                                                            onClick={() => handleUpdateMemo(activeMemo.id, 'color', c)}
                                                            className={`w-4 h-4 rounded-full cursor-pointer border-2 transition-transform hover:scale-125 ${memoColor === c ? 'border-gray-700 scale-110' : 'border-transparent'} ${c.replace('50', '400')}`}
                                                        ></div>
                                                    ))}
                                                </div>
                                            </div>
                                            {/* 본문 에디터 */}
                                            <textarea
                                                className={`flex-1 w-full p-6 text-sm leading-relaxed outline-none resize-none custom-scrollbar transition-colors ${memoColor}`}
                                                placeholder="메모 내용을 작성해 보세요..."
                                                value={activeMemo.content}
                                                onChange={(e) => handleUpdateMemo(activeMemo.id, 'content', e.target.value)}
                                            />
                                            <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 flex justify-between items-center text-[10px] text-gray-400 font-medium">
                                                <span>글자 수: {activeMemo.content.length}자</span>
                                                <span className="flex items-center gap-1 font-bold text-green-500">
                                                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                                                    Cloud Auto Saved
                                                </span>
                                            </div>
                                        </>
                                    );
                                })()
                            ) : (
                                /* 미선택 시 중앙 안내 */
                                <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-300">
                                    <div className="text-6xl mb-2 opacity-50">📒</div>
                                    <p className="font-bold text-gray-400">편집할 메모를 상단 탭에서 선택하거나 새로 만드세요.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'reception' && (
                    <div className="flex flex-col h-[750px] gap-2 animate-fade-in">
                        {/* (1) 타이틀 영역 */}
                        <div className="mb-1 shrink-0">
                            <h2 className="text-xl font-extrabold text-gray-800 flex items-center gap-2">
                                📝 접수 및 환수 관리
                                <span className="text-xs font-normal text-gray-400 mt-1">(접수/설치/해지 통합)</span>
                            </h2>
                        </div>

                        {/* (2) 메인 리스트 영역 */}
                        <div className="flex-1 bg-white border border-gray-200 rounded-xl shadow-sm flex flex-col overflow-hidden mt-1">
                            {/* 상단 툴바 */}
                            <div className="p-3 border-b border-gray-200 flex justify-between items-center bg-white shrink-0">
                                <div className="flex items-center gap-3">
                                    <h2 className="text-sm font-bold text-gray-800">접수 현황 리스트</h2>
                                    <span className="bg-indigo-50 text-indigo-600 text-[11px] px-2 py-0.5 rounded-full font-bold border border-indigo-100">
                                        총 {displayedData.length}건
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {renderSortToggle()}
                                    <select
                                        className="bg-white border border-gray-300 rounded-lg px-2 py-1.5 text-gray-700 text-xs font-bold outline-none"
                                        value={salesAgentFilter}
                                        onChange={e => setSalesAgentFilter(e.target.value)}
                                    >
                                        <option value="">👤 전체 상담사</option>
                                        {agents.map(a => <option key={a.id} value={a.id}>{a.username}</option>)}
                                    </select>
                                    {renderDateFilter()}
                                    <button onClick={() => setShowUploadModal(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white h-8 px-3 rounded text-xs font-bold shadow-sm flex items-center gap-1">
                                        ➕ 고객 등록
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 overflow-auto border border-gray-200 rounded-xl shadow-sm bg-white mt-1" style={{ maxHeight: 'calc(100vh - 280px)' }}>
                                <table className="sheet-table w-full text-left">
                                    {/* 1. 헤더: 요청하신 순서로 재배치 (11개 컬럼) */}
                                    <thead className="bg-slate-100 text-slate-500 font-bold uppercase text-[11px] tracking-tight border-b border-slate-200 sticky top-0 z-10">
                                        <tr>
                                            <th className="px-3 py-2 w-20 text-right bg-indigo-50 text-indigo-700 border-r border-slate-200">순수익</th>
                                            <th className="px-3 py-2 w-24 border-r border-slate-200">플랫폼</th>
                                            <th className="px-3 py-2 w-24 border-r border-slate-200">접수일</th>
                                            <th className="px-3 py-2 w-28 border-r border-slate-200">설치일</th>
                                            <th className="px-3 py-2 w-24 border-r border-slate-200">고객명</th>
                                            <th className="px-3 py-2 w-32 border-r border-slate-200">연락처</th>
                                            <th className="px-3 py-2 w-16 text-center border-r border-slate-200">정책(만)</th>
                                            <th className="px-3 py-2 w-16 text-center border-r border-slate-200">지원(만)</th>
                                            <th className="px-3 py-2 w-12 text-center border-r border-slate-200 bg-emerald-50 text-emerald-700">체크</th>
                                            <th className="px-3 py-2 w-32 text-center border-r border-slate-200">상태</th>
                                            <th className="px-3 py-2 min-w-[250px]">후처리 메모 (누락방지)</th>
                                        </tr>
                                    </thead>

                                    {/* 2. 바디: 헤더와 동일한 순서로 데이터 출력 (11개 컬럼) */}
                                    <tbody className="divide-y divide-gray-100 text-xs text-gray-700">
                                        {displayedData.map(c => {
                                            const checklistItems = parseChecklist(c.checklist);
                                            const isPostProcessed = checklistItems.includes('후처리완료');
                                            const netProfit = safeParseInt(c.agent_policy) - safeParseInt(c.support_amt);

                                            const togglePostProcess = (e) => {
                                                e.stopPropagation();
                                                const newList = isPostProcessed
                                                    ? checklistItems.filter(item => item !== '후처리완료')
                                                    : [...checklistItems, '후처리완료'];
                                                handleInlineUpdate(c.id, 'checklist', newList.join(','));
                                            };

                                            return (
                                                <tr
                                                    key={c.id}
                                                    className={`transition-all duration-200 group ${isPostProcessed
                                                            ? 'bg-slate-300 text-gray-600' // ✅ 체크 시 확실히 어두운 회색 강조
                                                            : 'bg-white hover:bg-indigo-50/30'
                                                        }`}
                                                >
                                                    {/* 1. 순수익 */}
                                                    <td className={`px-3 py-2.5 text-right font-black border-r border-slate-100 ${isPostProcessed ? 'text-gray-500' : (netProfit >= 0 ? 'text-blue-600' : 'text-red-500')}`}>
                                                        {netProfit}만
                                                    </td>

                                                    {/* 2. 플랫폼 */}
                                                    <td className="px-3 py-2.5 border-r border-slate-100 font-bold">{c.platform}</td>

                                                    {/* 3. 접수일 */}
                                                    <td className="px-3 py-2.5 text-gray-400 border-r border-slate-100">{c.upload_date?.substring(2, 10)}</td>

                                                    {/* 4. 설치일 (달력 선택 가능하도록 수정) */}
                                                    <td className="px-3 py-2.5 border-r border-slate-100">
                                                        <input
                                                            type="date"
                                                            className="bg-transparent text-gray-800 font-bold outline-none w-full cursor-pointer hover:text-indigo-600 transition-colors"
                                                            value={c.installed_date || ''}
                                                            onClick={(e) => {
                                                                e.stopPropagation(); // 드래그 방지
                                                                e.target.showPicker(); // 클릭 시 달력 자동 팝업
                                                            }}
                                                            onChange={(e) => handleInlineUpdate(c.id, 'installed_date', e.target.value)}
                                                        />
                                                    </td>

                                                    {/* 5. 고객명 */}
                                                    <td className="px-3 py-2.5 border-r border-slate-100 font-bold">{c.name}</td>

                                                    {/* 6. 연락처 */}
                                                    <td className="px-3 py-2.5 border-r border-slate-100 font-mono">
                                                        <div className="flex flex-col">
                                                            <span>{c.phone}</span>
                                                            <button onClick={(e) => handleOpenChat(e, c)} className="text-[10px] text-indigo-500 hover:underline w-fit font-bold">💬 SMS</button>
                                                        </div>
                                                    </td>

                                                    {/* 7. 정책 */}
                                                    <td className="px-3 py-2.5 text-center border-r border-slate-100">{c.agent_policy}</td>

                                                    {/* 8. 지원 */}
                                                    <td className="px-3 py-2.5 text-center border-r border-slate-100">{c.support_amt}</td>

                                                    {/* 9. 체크 (후처리완료) */}
                                                    <td className="px-3 py-2.5 text-center border-r border-slate-100">
                                                        <input
                                                            type="checkbox"
                                                            className="w-5 h-5 accent-indigo-600 cursor-pointer"
                                                            checked={isPostProcessed}
                                                            onChange={togglePostProcess}
                                                        />
                                                    </td>

                                                    {/* 10. 상태 */}
                                                    <td className="px-3 py-2.5 border-r border-slate-100">
                                                        <select
                                                            className={`w-full py-1 rounded text-[10px] font-bold border outline-none ${getBadgeStyle(c.status)}`}
                                                            value={c.status}
                                                            onChange={(e) => handleStatusChangeRequest(c.id, e.target.value)}
                                                        >
                                                            {receptionList.map(status => <option key={status} value={status}>{status}</option>)}
                                                        </select>
                                                    </td>

                                                    {/* 11. 메모 */}
                                                    <td className="px-3 py-2.5 align-top">
                                                        <div className="flex items-start gap-2">
                                                            <textarea
                                                                className={`flex-1 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-500 rounded p-1 text-[11px] outline-none resize-none transition-all ${isPostProcessed ? 'text-gray-500' : 'text-gray-700'}`}
                                                                rows={1}
                                                                value={extractUserMemo(c.last_memo)}
                                                                onInput={autoResizeTextarea}
                                                                onChange={(e) => {
                                                                    const merged = e.target.value + "\n\n" + extractSystemForm(c.last_memo);
                                                                    handleInlineUpdate(c.id, 'last_memo', merged);
                                                                }}
                                                                onKeyDown={(e) => handleMemoKeyDown(e, c.id, c.name)}
                                                            />
                                                            <button onClick={() => openActionMemo(c)} className={`shrink-0 p-1 rounded border transition-colors ${isPostProcessed ? 'bg-gray-200 text-gray-400' : 'bg-gray-50 hover:bg-indigo-600 hover:text-white'}`}>📝</button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {displayedData.length === 0 && (
                                            <tr><td colSpan="11" className="p-20 text-center text-gray-400">데이터가 없습니다.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* [설치 완료] - 수정됨: 디자인 통일 (툴바 통합) */}
                {activeTab === 'installation' && (
                    <div className="flex flex-col h-[750px] gap-2 animate-fade-in">

                        {/* (1) 타이틀 영역 */}
                        <div className="mb-1 shrink-0">
                            <h2 className="text-xl font-extrabold text-gray-800 flex items-center gap-2">
                                ✅ 설치 완료 목록
                                <span className="text-xs font-normal text-gray-400 mt-1">(이력 유지 / 삭제 불가)</span>
                            </h2>
                        </div>

                        {/* (2) 메인 리스트 영역 */}
                        <div className="flex-1 bg-white border border-gray-200 rounded-xl shadow-sm flex flex-col overflow-hidden mt-1">

                            {/* 상단 툴바 */}
                            <div className="p-3 border-b border-gray-200 flex justify-between items-center bg-white shrink-0">

                                {/* 좌측: 타이틀 & 카운트 */}
                                <div className="flex items-center gap-3">
                                    <h2 className="text-lg font-bold text-gray-800">설치 완료 리스트</h2>
                                    <span className="bg-indigo-50 text-indigo-600 text-xs px-2.5 py-1 rounded-full font-bold border border-indigo-100">
                                        총 {displayedData.length}건
                                    </span>
                                </div>

                                {/* 우측: 컨트롤 필터 */}
                                <div className="flex items-center gap-2">
                                    {/* 정렬 */}
                                    {renderSortToggle()}

                                    {/* 상담사 필터 */}
                                    <select
                                        className="bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-gray-700 text-xs font-bold outline-none focus:border-indigo-500 shadow-sm cursor-pointer"
                                        value={salesAgentFilter}
                                        onChange={e => setSalesAgentFilter(e.target.value)}
                                    >
                                        <option value="">👤 전체 상담사</option>
                                        {agents.map(a => <option key={a.id} value={a.id}>{a.username}</option>)}
                                    </select>

                                    {/* 날짜 필터 */}
                                    {renderDateFilter()}
                                </div>
                            </div>

                            {/* 🟢 [수정완료] 설치완료 테이블: 글자 크기 상향, 버튼 상시 노출, 달력 자동 열기 */}
                            <div className="flex-1 overflow-auto border border-gray-200 rounded-xl shadow-sm relative bg-white mt-1" style={{ maxHeight: 'calc(100vh - 280px)' }}>
                                <table className="sheet-table w-full text-left">
                                    {/* 1. 테이블 헤더: 글자 크기 [12px] 상향 및 간격 재조정 */}
                                    <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-[12px] tracking-wider border-b border-slate-200 sticky top-0 z-10">
                                        <tr>
                                            <th className="px-2 py-3 w-[100px] bg-indigo-50 text-indigo-700 text-right border-r border-slate-200">매출(순익)</th>
                                            <th className="px-2 py-3 w-[85px] border-r border-slate-200">플랫폼</th>
                                            <th className="px-2 py-3 w-[90px] border-r border-slate-200">접수일</th>
                                            <th className="px-2 py-3 w-[105px] border-r border-slate-200">설치일</th>
                                            <th className="px-2 py-3 w-[80px] border-r border-slate-200">고객명</th>
                                            <th className="px-2 py-3 w-[120px] border-r border-slate-200">연락처</th>
                                            <th className="px-1 py-3 w-[55px] text-right border-r border-slate-200">정책</th>
                                            <th className="px-1 py-3 w-[55px] text-right border-r border-slate-200">지원</th>
                                            <th className="px-2 py-3 w-[115px] border-r border-slate-200 text-center">상태</th>
                                            <th className="px-4 py-3 min-w-[350px]">후처리 메모 (상세 내용)</th>
                                        </tr>
                                    </thead>

                                    {/* 2. 테이블 바디: 텍스트 [12px] 적용 및 버튼/달력 로직 수정 */}
                                    <tbody className="divide-y divide-gray-100 text-[12px]">
                                        {displayedData.map(c => {
                                            const policy = safeParseInt(c.agent_policy);
                                            const support = safeParseInt(c.support_amt);
                                            let revenue = (policy - support) * 10000;
                                            const currentChecklist = parseChecklist(c.checklist);
                                            const isRefunded = currentChecklist.includes('환수완료');

                                            if (c.status === '해지진행') {
                                                if (c.installed_date) {
                                                    const installDate = new Date(c.installed_date);
                                                    const today = new Date();
                                                    const isSameMonth = installDate.getFullYear() === today.getFullYear() && installDate.getMonth() === today.getMonth();
                                                    if (isSameMonth) revenue = 0;
                                                    else revenue = -Math.abs(revenue);
                                                } else { revenue = 0; }
                                            }

                                            const toggleRefundStatus = () => {
                                                const newChecklist = isRefunded ? currentChecklist.filter(item => item !== '환수완료') : [...currentChecklist, '환수완료'];
                                                handleInlineUpdate(c.id, 'checklist', newChecklist.join(','));
                                            };

                                            return (
                                                <tr key={c.id} className="hover:bg-green-50/50 transition duration-150">
                                                    {/* 1. 매출 */}
                                                    <td className={`px-2 py-2.5 text-right font-black border-r border-slate-100 ${revenue > 0 ? 'text-blue-600' : revenue < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                                                        {formatCurrency(revenue)}
                                                    </td>
                                                    {/* 2. 플랫폼 */}
                                                    <td className="px-2 py-2.5 border-r border-slate-100 font-bold text-gray-600">
                                                        {c.platform}
                                                    </td>
                                                    {/* 3. 접수일 */}
                                                    <td className="px-2 py-2.5 text-gray-400 font-mono border-r border-slate-100">
                                                        {c.upload_date?.substring(2, 10)}
                                                    </td>
                                                    {/* 4. 설치일 (⭐️ 클릭 시 달력 자동 팝업) */}
                                                    <td className="px-2 py-2.5 border-r border-slate-100">
                                                        <input
                                                            type="date"
                                                            className="bg-transparent text-gray-800 font-bold outline-none w-full cursor-pointer hover:text-indigo-600"
                                                            value={c.installed_date || ''}
                                                            onClick={(e) => e.target.showPicker()} // 👈 달력 호출
                                                            onChange={(e) => handleInlineUpdate(c.id, 'installed_date', e.target.value)}
                                                        />
                                                    </td>
                                                    {/* 5. 고객명 */}
                                                    <td className="px-2 py-2.5 border-r border-slate-100">
                                                        <input type="text" className="bg-transparent font-bold text-gray-800 outline-none w-full" defaultValue={c.name} onBlur={(e) => handleInlineUpdate(c.id, 'name', e.target.value)} />
                                                    </td>
                                                    {/* 6. 연락처 */}
                                                    <td className="px-2 py-2.5 border-r border-slate-100">
                                                        <div className="flex flex-col">
                                                            <span className="font-mono text-gray-600">{c.phone}</span>
                                                            <button onClick={(e) => handleOpenChat(e, c)} className="text-[10px] text-indigo-500 hover:underline w-fit font-bold">💬 SMS</button>
                                                        </div>
                                                    </td>
                                                    {/* 7. 정책 */}
                                                    <td className="px-1 py-2.5 text-right border-r border-slate-100">
                                                        <input type="number" className="w-full bg-transparent text-right outline-none font-bold text-indigo-600 no-spin" defaultValue={c.agent_policy} onBlur={(e) => handleInlineUpdate(c.id, 'agent_policy', e.target.value)} />
                                                    </td>
                                                    {/* 8. 지원금 */}
                                                    <td className="px-1 py-2.5 text-right border-r border-slate-100">
                                                        <input type="number" className="w-full bg-transparent text-right outline-none font-bold text-red-500 no-spin" defaultValue={c.support_amt} onBlur={(e) => handleInlineUpdate(c.id, 'support_amt', e.target.value)} />
                                                    </td>
                                                    {/* 9. 상태 */}
                                                    <td className="px-2 py-2.5 border-r border-slate-100">
                                                        <div className="flex flex-col gap-1">
                                                            <select className={`w-full py-1 rounded text-[11px] font-bold outline-none border cursor-pointer ${getBadgeStyle(c.status)}`} value={c.status} onChange={(e) => handleStatusChangeRequest(c.id, e.target.value)}>
                                                                {installList.map(status => <option key={status} value={status}>{status}</option>)}
                                                                <option value="가망등록">⚡ 가망복사</option>
                                                            </select>
                                                            {c.status === '해지진행' && (
                                                                <button onClick={toggleRefundStatus} className={`w-full py-0.5 rounded text-[10px] font-black border ${isRefunded ? 'bg-gray-100 text-gray-400' : 'bg-red-100 text-red-600 border-red-200'}`}>
                                                                    {isRefunded ? '✅ 환수완료' : '🚨 미환수'}
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-2.5 align-top">
                                                        <div className="flex items-start gap-2 w-full group relative">
                                                            <textarea
                                                                className="flex-1 bg-transparent border-b border-gray-100 hover:border-gray-300 focus:border-indigo-500 rounded p-1 transition-all resize-none leading-normal min-h-[32px] focus:bg-white focus:shadow-xl focus:z-50 focus:h-auto focus:min-h-[80px] py-1.5 text-[12px] overflow-hidden whitespace-nowrap focus:whitespace-pre-wrap"
                                                                rows={1}
                                                                /* ⭐️ 중요: 화면에는 내가 쓴 메모만 보여줌 */
                                                                value={extractUserMemo(c.last_memo)}
                                                                onChange={(e) => {
                                                                    // 실시간 타이핑 가능하게 처리
                                                                    const newNote = e.target.value;
                                                                    const systemPart = extractSystemForm(c.last_memo);
                                                                    // 저장 시에는 메모 + 기존 양식을 합쳐서 보냄
                                                                    const merged = newNote + (systemPart ? "\n\n" + systemPart : "");
                                                                    handleInlineUpdate(c.id, 'last_memo', merged);
                                                                }}
                                                                onBlur={(e) => e.target.style.height = '2rem'}
                                                                onInput={autoResizeTextarea}
                                                                onDoubleClick={() => handleOpenHistory(c)}
                                                                placeholder="메모..."
                                                                onKeyDown={(e) => handleMemoKeyDown(e, c.id, c.name)}
                                                            />
                                                            <button
                                                                onClick={() => openActionMemo(c)}
                                                                className="shrink-0 p-1.5 bg-indigo-50 text-indigo-600 rounded border border-indigo-200 hover:bg-indigo-600 hover:text-white transition shadow-sm"
                                                            >
                                                                📝
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* 🟢 [개편완료] 접수 완료 모달: 좌측 양식 / 우측 선택 / 상단 탭 */}
                {showCompletionModal && completionTarget && (
                    <PopoutWindow title="📝 접수 양식 작성 및 확정" onClose={() => setShowCompletionModal(false)} width={1100} height={850} windowKey="admin_reception_window">
                        <div className="flex flex-col h-full bg-slate-100 font-sans overflow-hidden">

                            {/* (1) 상단 통신사 탭 (폴더 스타일) */}
                            <div className="bg-white border-b border-gray-200 p-2 flex gap-1 overflow-x-auto hide-scrollbar shrink-0">
                                {Object.keys(policyData).map((pName) => (
                                    <button
                                        key={pName}
                                        onClick={() => { setSelectedPlatform(pName); setDynamicFormData({}); }}
                                        className={`px-6 py-2.5 rounded-t-xl font-bold text-sm transition-all border-t border-l border-r
                            ${selectedPlatform === pName
                                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-[0_-2px_10px_rgba(0,0,0,0.1)] translate-y-[2px] z-10'
                                                : 'bg-gray-100 text-gray-500 border-transparent hover:bg-gray-200'}`}
                                    >
                                        {pName}
                                    </button>
                                ))}
                            </div>

                            <div className="flex flex-1 overflow-hidden p-4 gap-4">

                                {/* (2) 좌측: 접수 양식 미리보기 및 상세입력 */}
                                <div className="w-[450px] bg-white rounded-2xl shadow-xl border border-gray-200 flex flex-col overflow-hidden animate-fade-in-right">
                                    <div className="bg-slate-800 text-white p-4 flex justify-between items-center">
                                        <span className="font-bold text-sm">📋 실시간 접수 양식 미리보기</span>
                                        <span className="text-[10px] bg-indigo-500 px-2 py-0.5 rounded">Auto-Fill</span>
                                    </div>

                                    <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-slate-50">
                                        {/* 양식 섹션 1: 고객정보 */}
                                        <div className="mb-6">
                                            <h4 className="text-xs font-black text-indigo-600 mb-3 border-b border-indigo-100 pb-1">■ 고객정보</h4>
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-bold text-gray-500 w-16">성명:</span>
                                                    <input type="text" className="flex-1 bg-white border-b border-gray-200 p-1 text-sm font-bold outline-none focus:border-indigo-500" defaultValue={completionTarget.name} />
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-bold text-gray-500 w-16">연락처:</span>
                                                    <input type="text" className="flex-1 bg-white border-b border-gray-200 p-1 text-sm font-mono outline-none focus:border-indigo-500" defaultValue={completionTarget.phone} />
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-bold text-gray-500 w-16 text-red-500">주민번호:</span>
                                                    <input type="text" className="flex-1 bg-white border border-red-200 rounded px-2 py-1 text-sm font-mono outline-none focus:ring-2 focus:ring-red-100"
                                                        placeholder="800101-1******"
                                                        onChange={e => setDynamicFormData(prev => ({ ...prev, jumin: e.target.value }))} />
                                                </div>
                                            </div>
                                        </div>

                                        {/* 양식 섹션 2: 상품정보 (우측 선택 시 자동 변환) */}
                                        <div className="mb-6 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                                            <h4 className="text-xs font-black text-indigo-600 mb-3 border-b border-indigo-100 pb-1">■ 상품정보</h4>
                                            <div className="space-y-2 text-sm">
                                                <p className="flex justify-between">
                                                    <span className="text-gray-500">상품:</span>
                                                    <span className="font-bold text-gray-800">
                                                        {Object.values(dynamicFormData).filter(v => v.name).map(v => v.name).join(' + ') || '(상품을 선택하세요)'}
                                                    </span>
                                                </p>
                                                <p className="flex justify-between">
                                                    <span className="text-gray-500">월 요금:</span>
                                                    <span className="font-black text-blue-600">
                                                        {formatCurrency(Object.values(dynamicFormData).reduce((acc, cur) => acc + (cur.fee || 0), 0))}원
                                                    </span>
                                                </p>
                                                <p className="flex justify-between">
                                                    <span className="text-gray-500">설치비:</span>
                                                    <span className="font-bold text-gray-700">
                                                        {formatCurrency(Object.values(dynamicFormData).reduce((acc, cur) => acc + (cur.install_fee || 0), 0))}원
                                                    </span>
                                                </p>
                                                <p className="flex justify-between border-t pt-2 mt-2">
                                                    <span className="text-gray-500">정책금:</span>
                                                    <span className="font-black text-indigo-600 text-lg">
                                                        {formatCurrency(Object.values(dynamicFormData).reduce((acc, cur) => acc + (cur.policy || 0), 0) * 10000)}원
                                                    </span>
                                                </p>
                                            </div>
                                        </div>

                                        {/* 양식 섹션 3: 설치정보 */}
                                        <div>
                                            <h4 className="text-xs font-black text-indigo-600 mb-3 border-b border-indigo-100 pb-1">■ 설치정보</h4>
                                            <div className="space-y-3">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-400 mb-1">설치 주소지</label>
                                                    <input type="text" className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs outline-none focus:border-indigo-500"
                                                        placeholder="서울시 강남구..."
                                                        onChange={e => setDynamicFormData(prev => ({ ...prev, address: e.target.value }))} />
                                                </div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-gray-400 mb-1">설치 희망일</label>
                                                        <input type="date" className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs outline-none focus:border-indigo-500"
                                                            onChange={e => setDynamicFormData(prev => ({ ...prev, hope_date: e.target.value }))} />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-gray-400 mb-1">자동이체 은행</label>
                                                        <input type="text" className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs outline-none focus:border-indigo-500"
                                                            placeholder="은행명"
                                                            onChange={e => setDynamicFormData(prev => ({ ...prev, bank: e.target.value }))} />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-400 mb-1">비고 및 사은품</label>
                                                    <input type="text" className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs outline-none focus:border-indigo-500 font-bold text-indigo-600"
                                                        placeholder="예: 공기청정기, 현금 지원 등"
                                                        onChange={e => setDynamicFormData(prev => ({ ...prev, gift: e.target.value }))} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* (3) 우측: 상품 상세 설정 (선택 구역) */}
                                <div className="flex-1 flex flex-col gap-4 overflow-hidden">

                                    {/* 인터넷 상품 리스트 */}
                                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm flex-1 flex flex-col overflow-hidden">
                                        <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 font-extrabold text-gray-700 flex items-center gap-2">
                                            🌐 인터넷 상품 선택
                                        </div>
                                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-2">
                                            {policyData[selectedPlatform]?.internet.map(p => (
                                                <div
                                                    key={p.id}
                                                    onClick={() => handleFormDataChange('internet', p.name)}
                                                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all hover:shadow-md flex justify-between items-center
                                        ${dynamicFormData.internet?.name === p.name ? 'border-indigo-500 bg-indigo-50 shadow-inner' : 'border-gray-100 hover:border-indigo-200'}`}
                                                >
                                                    <div>
                                                        <div className="font-bold text-gray-800">{p.name}</div>
                                                        <div className="text-[10px] text-gray-400 mt-1">요금: {formatCurrency(p.fee)}원 | 설치비: {formatCurrency(p.install_fee)}원</div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-indigo-600 font-black text-lg">+{p.policy}만</div>
                                                        {dynamicFormData.internet?.name === p.name && <span className="text-[10px] font-bold text-indigo-500">SELECTED</span>}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* TV/부가 서비스 리스트 */}
                                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm flex-1 flex flex-col overflow-hidden">
                                        <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 font-extrabold text-gray-700 flex items-center gap-2">
                                            📺 TV / 부가서비스 선택
                                        </div>
                                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-2">
                                            {[...(policyData[selectedPlatform]?.bundle || []), ...(policyData[selectedPlatform]?.addon || [])].map(p => (
                                                <div
                                                    key={p.id}
                                                    onClick={() => handleFormDataChange(p.id, p.name)} // ID별 개별 선택 가능하도록 처리 필요
                                                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all hover:shadow-md flex justify-between items-center
                                        ${dynamicFormData[p.id] ? 'border-emerald-500 bg-emerald-50' : 'border-gray-100 hover:border-emerald-200'}`}
                                                >
                                                    <div>
                                                        <div className="font-bold text-gray-800">{p.name}</div>
                                                        <div className="text-[10px] text-gray-400 mt-1">월 요금: {formatCurrency(p.fee)}원</div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-emerald-600 font-black text-lg">+{p.policy || p.cost}만</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* 하단 최종 액션 버튼 */}
                                    <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-lg flex gap-3">
                                        <button onClick={() => setShowCompletionModal(false)} className="flex-1 py-4 bg-gray-100 text-gray-500 rounded-xl font-bold hover:bg-gray-200 transition">취소</button>
                                        <button
                                            onClick={() => {
                                                const finalOrder = generateOrderText();
                                                // 실제 확정 로직 (PATCH 및 Log 기록)
                                                handleConfirmCompletion(finalOrder);
                                            }}
                                            className="flex-[2] py-4 bg-indigo-600 text-white rounded-xl font-black text-lg shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition transform active:scale-95"
                                        >
                                            🎉 접수 완료 및 양식 생성
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </PopoutWindow>
                )}

            {memoPopupTarget && (<div className="fixed inset-0 bg-black/40 flex justify-center items-center backdrop-blur-sm z-50"><div className="bg-white p-6 rounded-2xl w-[400px] border border-gray-200 shadow-2xl animate-fade-in-up"><h2 className="text-lg font-bold mb-3 text-indigo-800 border-b border-gray-100 pb-2">{memoFieldType === 'additional_info' ? '📝 후처리 메모' : '💬 상담 내용 메모'}</h2><textarea ref={memoInputRef} className="w-full h-40 bg-gray-50 p-4 rounded-xl border border-gray-300 text-sm text-gray-800 resize-none outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition" value={memoPopupText} onChange={e => setMemoPopupText(e.target.value)} placeholder="내용을 입력하세요..." /><div className="flex justify-end gap-2 mt-4"><button onClick={() => setMemoPopupTarget(null)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg font-bold transition">취소</button><button onClick={saveMemoPopup} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-md transition">저장</button></div></div></div>)}
            {showResponseModal && responseTarget && (<div className="fixed inset-0 bg-black/40 flex justify-center items-center backdrop-blur-sm z-50"><div className="bg-white p-6 rounded-2xl w-[400px] border border-gray-200 shadow-2xl animate-fade-in-up"><h2 className="text-xl font-bold mb-4 text-indigo-900 border-b border-gray-100 pb-2 flex items-center gap-2">🔔 관리자 확인 요청</h2><div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200 mb-6"><span className="text-xs font-bold text-yellow-700 block mb-1">요청 내용:</span><p className="text-sm text-gray-800 font-medium">{responseTarget.request_message || "내용 없음"}</p></div><div className="flex flex-col gap-3"><button onClick={() => handleResponse('PROCESSING')} className="w-full py-3 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-xl font-bold transition flex items-center justify-center gap-2">🚧 지금 확인 중입니다</button><button onClick={() => handleResponse('COMPLETED')} className="w-full py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-bold shadow-md transition flex items-center justify-center gap-2">✅ 처리 완료했습니다</button></div><div className="mt-4 text-center"><button onClick={() => setShowResponseModal(false)} className="text-xs text-gray-400 hover:text-gray-600">닫기</button></div></div></div>)}
            {showRequestModal && requestTarget && (<div className="fixed inset-0 bg-black/40 flex justify-center items-center backdrop-blur-sm z-50"><div className="bg-white p-6 rounded-2xl w-[400px] border border-gray-200 shadow-2xl animate-fade-in-up"><h2 className="text-xl font-bold mb-4 text-indigo-900 border-b border-gray-100 pb-2 flex items-center gap-2">🔔 관리자 확인 요청</h2><textarea className="w-full h-32 bg-gray-50 p-3 rounded-lg border border-gray-300 text-sm outline-none resize-none mb-4 focus:border-indigo-500 transition" placeholder="요청 사항을 입력하세요..." value={requestMessage} onChange={(e) => setRequestMessage(e.target.value)} /><div className="flex justify-end gap-2"><button onClick={() => setShowRequestModal(false)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg font-bold transition">취소</button><button onClick={sendRequest} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-md transition">요청 보내기</button></div></div></div>)}
            {showCustomModal && (<PopoutWindow title="🎨 통계 화면 커스터마이징" onClose={() => setShowCustomModal(false)}><div className="bg-white h-full flex flex-col p-6"><h2 className="text-xl font-bold mb-6 flex items-center gap-2"><span>👁️</span> 표시할 항목 선택</h2><div className="mb-8"><h3 className="font-bold text-gray-800 mb-4 border-b border-gray-100 pb-2">📋 테이블 컬럼</h3><div className="grid grid-cols-3 gap-4">{Object.keys(INITIAL_VISIBLE_COLUMNS).map(col => (<label key={col} className="flex items-center gap-2 p-3 rounded-lg border border-gray-100 bg-gray-50 hover:bg-white hover:shadow-sm cursor-pointer transition"><input type="checkbox" className="w-5 h-5 accent-indigo-600 rounded" checked={visibleColumns[col]} onChange={() => handleColumnToggle(col)} /><span className="text-sm font-medium text-gray-700">{col === 'owner_name' ? '담당자' : col === 'db' ? '디비' : col === 'accepted' ? '접수' : col === 'installed' ? '설치' : col === 'canceled' ? '취소' : col === 'adSpend' ? '광고비' : col === 'acceptedRevenue' ? '접수매출' : col === 'installedRevenue' ? '설치매출' : col === 'netProfit' ? '순이익' : col === 'acceptRate' ? '접수율' : col === 'cancelRate' ? '취소율' : col === 'netInstallRate' ? '순청약율' : '평균마진'}</span></label>))}</div></div><div><h3 className="font-bold text-gray-800 mb-4 border-b border-gray-100 pb-2">📊 상단 지표 카드</h3><div className="grid grid-cols-2 gap-4">{Object.keys(INITIAL_VISIBLE_CARDS).map(card => (<label key={card} className="flex items-center gap-2 p-3 rounded-lg border border-gray-100 bg-gray-50 hover:bg-white hover:shadow-sm cursor-pointer transition"><input type="checkbox" className="w-5 h-5 accent-blue-600 rounded" checked={visibleCards[card]} onChange={() => handleCardToggle(card)} /><span className="text-sm font-medium text-gray-700">{card === 'adSpend' ? '💰 총 광고비' : card === 'acceptedRevenue' ? '📝 접수완료매출' : card === 'installedRevenue' ? '✅ 설치완료매출' : card === 'netProfit' ? '🎯 순이익' : card === 'totalDB' ? '📊 총 디비건수' : card === 'acceptedCount' ? '📋 접수건수' : card === 'installCount' ? '✨ 설치건수' : card === 'cancelRate' ? '⚠️ 취소율' : '🎉 순청약율'}</span></label>))}</div></div><div className="mt-auto pt-6 border-t border-gray-100 flex justify-end"><button onClick={() => setShowCustomModal(false)} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-md transition">설정 완료</button></div></div></PopoutWindow>)}


            {/* 탭 관리 설정 모달 */}
            {showTabSettings && (
                <div className="fixed inset-0 bg-black/50 z-[10000] flex justify-center items-center backdrop-blur-sm animate-fade-in">
                    <div className="bg-white p-6 rounded-3xl w-[400px] shadow-2xl border border-gray-200">
                        <div className="flex justify-between items-center mb-4 border-b pb-3">
                            <h3 className="text-lg font-black text-gray-800">🛠 탭 표시 설정</h3>
                            <button onClick={() => setShowTabSettings(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                        </div>

                        <p className="text-[11px] text-indigo-500 font-bold mb-4">
                            💡 버튼을 클릭하여 메인 화면에서 탭을 숨기거나 보일 수 있습니다.<br />
                            💡 탭 바에서 직접 드래그하여 순서를 바꿀 수 있습니다.
                        </p>

                        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                            {tabsConfig.map((tab) => (
                                <div
                                    key={tab.id}
                                    className={`flex items-center justify-between p-3 rounded-xl border transition-all ${tab.visible ? 'bg-white border-gray-200' : 'bg-gray-50 border-transparent opacity-60'}`}
                                >
                                    <span className={`text-sm font-bold ${tab.visible ? 'text-gray-700' : 'text-gray-400'}`}>
                                        {tab.label}
                                    </span>
                                    <button
                                        onClick={() => toggleTabVisibility(tab.id)}
                                        className={`px-3 py-1 rounded-lg text-[10px] font-black transition ${tab.visible ? 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200' : 'bg-gray-200 text-gray-500 hover:bg-gray-300'}`}
                                    >
                                        {tab.visible ? '표시 중' : '숨김'}
                                    </button>
                                </div>
                            ))}
                        </div>

                        <div className="mt-6">
                            <button
                                onClick={() => setShowTabSettings(false)}
                                className="w-full py-3 bg-indigo-600 text-white rounded-xl font-black shadow-lg hover:bg-indigo-700 transition"
                            >
                                설정 완료
                            </button>
                            <button
                                onClick={() => { if (window.confirm('탭 설정을 초기화하시겠습니까?')) setTabsConfig(DEFAULT_TABS_AGENT); }}
                                className="w-full mt-2 py-2 text-[11px] text-gray-400 font-bold hover:text-red-500"
                            >
                                초기 기본값으로 되돌리기
                            </button>
                        </div>
                    </div>
                </div>
            )}

                {/* 🟢 [추가] 실패 사유 선택 모달 */}
                {showFailModal && failTarget && (
                    <div className="fixed inset-0 bg-black/50 z-[9999] flex justify-center items-center backdrop-blur-sm animate-fade-in">
                        <div className="bg-white p-6 rounded-2xl w-96 border border-gray-200 shadow-2xl">
                            <h3 className="text-xl font-bold text-red-600 mb-4 flex items-center gap-2">🚫 실패 처리</h3>
                            <div className="bg-red-50 p-3 rounded-lg mb-4">
                                <p className="text-sm text-gray-700 font-bold mb-1">{failTarget.name} 고객님</p>
                                <p className="text-xs text-gray-500">실패 사유를 선택하면 'AS/실패' 탭으로 이동됩니다.</p>
                            </div>
                            <div className="mb-6">
                                <label className="block text-sm font-bold text-gray-700 mb-2">실패 사유 선택</label>
                                <select
                                    className="w-full p-3 border border-gray-300 rounded-xl outline-none focus:border-red-500"
                                    value={selectedFailReason}
                                    onChange={(e) => setSelectedFailReason(e.target.value)}
                                >
                                    <option value="">-- 사유를 선택하세요 --</option>
                                    {reasons.map((r) => (
                                        <option key={r.id} value={r.reason}>{r.reason}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex justify-end gap-2">
                                <button onClick={() => { setShowFailModal(false); setFailTarget(null); }} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg font-bold hover:bg-gray-200">취소</button>
                                <button onClick={handleConfirmFail} className="px-4 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 shadow-md">확인 및 저장</button>
                            </div>
                        </div>
                    </div>
                )}


                {isChatOpen && (
                    <PopoutWindow
                        title="메시지 센터"
                        onClose={() => setIsChatOpen(false)}
                        width={1000}
                        height={800}
                        windowKey="samsung_messenger_v2"
                        trigger={chatTrigger}
                    >
                        <div className="flex flex-row h-screen bg-white font-sans overflow-hidden text-gray-800">

                            {/* ==========================================
                [LEFT] 채팅방 목록 영역
               ========================================== */}
                            <div className="w-[320px] flex flex-col border-r border-gray-200 bg-white shrink-0">
                                <div className="p-5 pb-3">
                                    <h2 className="text-2xl font-black text-gray-900 mb-4">메시지</h2>
                                    <div className="relative group">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                                        <input
                                            type="text"
                                            placeholder="이름 또는 번호 검색"
                                            className="w-full bg-gray-100 rounded-2xl pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
                                            value={chatListSearch}
                                            onChange={(e) => setChatListSearch(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto custom-scrollbar">
                                    {chatListCustomers.map(c => (
                                        <div
                                            key={c.id}
                                            onClick={() => { setChatTarget(c); fetchChatHistory(c.id); }}
                                            className={`px-5 py-4 flex items-center gap-4 cursor-pointer transition-all relative
                    ${chatTarget?.id === c.id ? 'bg-indigo-50 border-r-4 border-indigo-600' : 'hover:bg-gray-50 border-b border-gray-50'}`}
                                        >
                                            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold shrink-0 shadow-sm ${chatTarget?.id === c.id ? 'bg-indigo-600' : 'bg-gray-300'}`}>
                                                {c.name?.[0]}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-center mb-0.5">
                                                    <span className={`truncate text-sm ${chatTarget?.id === c.id ? 'font-black' : 'font-bold'}`}>{c.name}</span>
                                                    <span className="text-[10px] text-gray-400">{c.upload_date?.substring(5)}</span>
                                                </div>
                                                <div className="text-xs text-gray-500 truncate">{c.last_memo || '대화 내용 없음'}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* [RIGHT] 채팅방 상세 영역 */}
                            <div className="flex-1 flex flex-col bg-[#F4F4F4] min-w-0 relative">

                                {/* 1. 우측 통합 헤더 (채팅방 선택 여부와 상관없이 항상 노출) */}
                                <div className="bg-white/90 backdrop-blur-md px-6 py-3 flex items-center justify-between border-b border-gray-200 shrink-0 z-30 shadow-sm">
                                    {/* (Left) 선택된 고객 정보 - chatTarget이 있을 때만 표시 */}
                                    <div className="flex items-center gap-3 w-1/3 min-h-[40px]">
                                        {chatTarget ? (
                                            <>
                                                <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold shadow-sm">
                                                    {chatTarget.name?.[0]}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="font-black text-gray-900 truncate text-sm">{chatTarget.name}</div>
                                                    <div className="text-[10px] text-indigo-500 font-bold">{chatTarget.phone}</div>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="flex items-center gap-2 text-gray-400">
                                                <span className="text-sm font-bold italic">대화 상대를 선택하세요</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* (Center) ⭐️ 핵심: 검색 및 새 번호 입력바 (항상 노출) */}
                                    <div className="flex-1 max-w-sm px-4">
                                        <div className="relative group">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
                                                {/* 번호 패턴이면 아이콘 변경 */}
                                                {/^01[0-9]/.test(chatListSearch.replace(/[^0-9]/g, '')) ? '📱' : '🔍'}
                                            </span>
                                            <input
                                                type="text"
                                                placeholder="내용 검색 또는 새 번호 입력 후 Enter"
                                                className={`w-full rounded-xl pl-9 pr-4 py-2 text-xs outline-none transition-all border-2 
            ${/^01[0-9]/.test(chatListSearch.replace(/[^0-9]/g, ''))
                                                        ? 'border-indigo-400 bg-white ring-4 ring-indigo-50'
                                                        : 'border-transparent bg-gray-100 focus:bg-white focus:ring-2 focus:ring-indigo-100'}`}
                                                value={chatListSearch}
                                                onChange={(e) => setChatListSearch(e.target.value)}
                                                onKeyDown={handleSearchEnter} // 서버와 연동한 함수
                                            />
                                        </div>
                                    </div>

                                    {/* (Right) 헤더 우측 메뉴 */}
                                    <div className="flex items-center justify-end gap-1 w-1/3">
                                        {chatTarget && (
                                            <button
                                                onClick={() => setShowMacro(!showMacro)}
                                                className={`text-[11px] font-bold px-3 py-1.5 rounded-full border transition-all mr-1
            ${showMacro ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-50'}`}
                                            >
                                                문구
                                            </button>
                                        )}

                                        <div className="relative">
                                            <button
                                                onClick={() => setShowResponseModal(!showResponseModal)}
                                                className={`w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors ${showResponseModal ? 'bg-gray-100 text-gray-900' : 'text-gray-400'}`}
                                            >
                                                <span className="text-xl font-bold">⋮</span>
                                            </button>

                                            {showResponseModal && (
                                                <div className="absolute right-0 top-11 w-44 bg-white rounded-2xl shadow-2xl border border-gray-100 py-1.5 z-50 animate-fade-in-down">
                                                    <button
                                                        onClick={() => { setChatTarget(null); setShowResponseModal(false); }}
                                                        className="w-full text-left px-4 py-2.5 text-[13px] text-red-500 font-bold hover:bg-red-50 flex items-center gap-2 transition-colors"
                                                    >
                                                        <span>🚪</span> 채팅방 나가기
                                                    </button>
                                                    <button
                                                        onClick={() => setShowResponseModal(false)}
                                                        className="w-full text-left px-4 py-2.5 text-[13px] text-gray-500 hover:bg-gray-50 transition-colors"
                                                    >
                                                        취소
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* 2. 하단 컨텐츠 영역 (메시지 리스트 및 입력창) */}
                                {chatTarget ? (
                                    // 🟢 flex-1과 h-full을 주어 부모의 남은 높이를 꽉 채우도록 설정
                                    <div className="flex-1 flex flex-col min-h-0 relative"
                                        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                                        onDragLeave={() => setIsDragOver(false)}
                                        onDrop={handleFileDrop}>

                                        {/* 🟢 메시지 리스트 창: flex-1과 overflow-y-auto로 이 구역만 스크롤되게 고정 */}
                                        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-[#F4F4F4]" ref={chatScrollRef}>
                                            {chatMessages.map((msg, idx) => (
                                                <div key={msg.id || idx} className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'} animate-fade-in-up`}>
                                                    <div className="flex flex-col max-w-[75%]">
                                                        <div className={`px-4 py-2.5 text-sm shadow-sm relative transition-all leading-relaxed
                            ${msg.sender === 'me'
                                                                ? 'bg-indigo-600 text-white rounded-[20px] rounded-tr-none'
                                                                : 'bg-white text-gray-800 rounded-[20px] rounded-tl-none border border-gray-200'}`}>
                                                            <div className="whitespace-pre-wrap">{msg.text}</div>
                                                            {msg.image && <img src={msg.image} alt="첨부" className="mt-2 rounded-lg max-w-full border border-gray-100" />}
                                                        </div>
                                                        <span className={`text-[10px] text-gray-400 mt-1 px-1 ${msg.sender === 'me' ? 'text-right' : 'text-left'}`}>
                                                            {msg.created_at}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {/* [수정] 붙여넣은 이미지 미리보기 표시 */}
                                        {chatFile && (
                                            <div className="px-4 py-2 bg-indigo-50 border-t border-indigo-100 flex justify-between items-center animate-fade-in shrink-0">
                                                <div className="flex items-center gap-3">
                                                    {/* 🟢 실제 이미지 썸네일 추가 */}
                                                    <div className="w-10 h-10 rounded border border-indigo-200 overflow-hidden bg-white">
                                                        <img
                                                            src={URL.createObjectURL(chatFile)}
                                                            alt="pasted"
                                                            className="w-full h-full object-cover"
                                                        />
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-bold text-indigo-700 truncate max-w-[200px]">{chatFile.name}</span>
                                                        <span className="text-[10px] text-indigo-400">전송 버튼을 누르면 이미지와 텍스트가 함께 발송됩니다.</span>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => setChatFile(null)}
                                                    className="text-gray-400 hover:text-red-500 font-bold px-2 text-lg"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        )}

                                        {/* 🟢 하단 입력창 구역: shrink-0을 주어 메시지 창이 길어져도 절대 밀려나지 않게 고정 */}
                                        <div className="p-4 bg-white border-t border-gray-200 shrink-0">
                                            <div className="max-w-4xl mx-auto flex items-end gap-2 bg-[#F0F2F5] rounded-[26px] p-2">
                                                <label htmlFor="chat-file-input" className="p-2 cursor-pointer text-gray-500 hover:text-indigo-600 shrink-0">
                                                    <span className="text-2xl">📎</span>
                                                    <input type="file" id="chat-file-input" className="hidden" accept="image/*" onChange={(e) => setChatFile(e.target.files[0])} />
                                                </label>

                                                <textarea
                                                    className="flex-1 bg-transparent rounded-xl px-2 py-3 text-sm outline-none resize-none leading-relaxed custom-scrollbar overflow-y-auto"
                                                    placeholder="메시지를 입력하세요..."
                                                    value={chatInput}
                                                    style={{ height: '48px', minHeight: '48px', maxHeight: '48px' }}
                                                    onChange={(e) => setChatInput(e.target.value)}
                                                    onKeyDown={handleChatKeyDown}
                                                    // 🟢 [추가] 클립보드 붙여넣기 핸들러 연결
                                                    onPaste={(e) => {
                                                        const items = e.clipboardData.items;
                                                        for (let i = 0; i < items.length; i++) {
                                                            if (items[i].type.indexOf('image') !== -1) {
                                                                const file = items[i].getAsFile();
                                                                if (file) {
                                                                    // 파일명을 임의로 생성하여 세팅
                                                                    const namedFile = new File([file], `pasted_img_${Date.now()}.png`, { type: file.type });
                                                                    setChatFile(namedFile);
                                                                    e.preventDefault(); // 텍스트 영역에 이상한 문자가 들어가는 것 방지
                                                                }
                                                            }
                                                        }
                                                    }}
                                                />

                                                <button
                                                    onClick={() => handleSendManualChat()}
                                                    disabled={isSending || (!chatInput.trim() && !chatFile)}
                                                    className="w-11 h-11 rounded-full bg-indigo-600 text-white flex justify-center items-center shrink-0 shadow-lg disabled:bg-gray-300"
                                                >
                                                    {isSending ? "⏳" : "▲"}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    /* [DEFAULT] 채팅방 미선택 시 화면 */
                                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-slate-50">
                                        <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center text-6xl mb-6 opacity-30 grayscale">💬</div>
                                        <p className="font-black text-xl text-gray-400">대화할 상대를 선택하거나 번호를 입력하세요</p>
                                        <p className="text-sm mt-2 opacity-60 text-center">상단 검색바에 전화번호를 입력하고 엔터를 누르면<br />새로운 채팅방이 생성됩니다.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </PopoutWindow>
                )}


                {/* ⭐️ [상담원 전용] 메모장 + 받은 업무 지시 확인 기능 */}
                {activeTab === 'notepad' && (
                    <div className="flex h-full gap-6 animate-fade-in p-2">

                        {/* (Left) 카테고리 사이드바 */}
                        <div className="w-64 bg-white border border-gray-200 rounded-xl shadow-sm flex flex-col overflow-hidden shrink-0">
                            <div className="p-4 border-b border-gray-100 bg-gray-50">
                                <h3 className="font-bold text-gray-700 text-sm">📂 업무 도구함</h3>
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                                {/* 1. 개인 업무 */}
                                <div
                                    onClick={() => setActiveTodoTab('ALL')}
                                    className={`p-3 rounded-lg cursor-pointer flex justify-between items-center transition ${activeTodoTab === 'ALL' ? 'bg-indigo-100 text-indigo-700 font-bold' : 'hover:bg-gray-50 text-gray-600'}`}
                                >
                                    <span>📝 내 개인 할 일</span>
                                    <span className="text-xs bg-white px-2 py-0.5 rounded border border-gray-200">{todos.length}</span>
                                </div>

                                {/* 2. 사용자 폴더들 */}
                                {todoTabs.map(tab => (
                                    <div key={tab.id} onClick={() => setActiveTodoTab(tab.id)}
                                        onDragOver={handleDragOver} onDrop={(e) => handleDropOnTab(e, tab.id)}
                                        className={`p-3 rounded-lg cursor-pointer flex justify-between items-center transition ml-2 border-l-2 ${activeTodoTab === tab.id ? 'bg-indigo-50 border-indigo-400 text-indigo-700' : 'border-transparent hover:bg-gray-50'}`}>
                                        <span className="text-sm">└ 📁 {tab.name}</span>
                                        <button onClick={(e) => handleDeleteTodoTab(tab.id, e)} className="text-gray-300 hover:text-red-500">×</button>
                                    </div>
                                ))}
                                <button onClick={handleAddTodoTab} className="w-full text-xs text-gray-400 py-2 hover:text-indigo-600 text-left px-4">+ 폴더 추가</button>

                                <div className="h-px bg-gray-200 my-2"></div>

                                {/* 3. [변경] 관리자 업무 지시 (상담원 시점) */}
                                <div
                                    onClick={() => setActiveTodoTab('ADMIN_ASSIGN')}
                                    className={`p-3 rounded-lg cursor-pointer flex justify-between items-center transition ${activeTodoTab === 'ADMIN_ASSIGN' ? 'bg-red-50 text-red-700 font-bold border-l-4 border-red-500' : 'hover:bg-gray-50 text-gray-600'}`}
                                >
                                    <span>📢 받은 지시사항</span>
                                    {assignedTasks.filter(t => !t.is_completed).length > 0 && (
                                        <span className="text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded-full animate-bounce">
                                            {assignedTasks.filter(t => !t.is_completed).length}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* (Right) 컨텐츠 영역 */}
                        <div className="flex-1 bg-white border border-gray-200 rounded-xl shadow-sm flex flex-col overflow-hidden">

                            {/* [A] 받은 업무 지시 리스트 (상담원용 리뉴얼) */}
                            {activeTodoTab === 'ADMIN_ASSIGN' ? (
                                <div className="flex flex-col h-full bg-slate-50">
                                    <div className="p-5 border-b border-gray-200 bg-white">
                                        <h3 className="font-black text-gray-800 flex items-center gap-2">
                                            <span className="text-red-500">📢</span> 관리자 전달 사항
                                        </h3>
                                        <p className="text-xs text-gray-400 mt-1">본사 및 팀장님이 전달한 업무 지시 목록입니다.</p>
                                    </div>

                                    <div className="flex-1 overflow-y-auto p-6 space-y-3">
                                        {assignedTasks.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center h-full text-gray-300">
                                                <span className="text-5xl mb-4">🕊️</span>
                                                <p className="font-bold">현재 전달된 지시사항이 없습니다.</p>
                                            </div>
                                        ) : (
                                            assignedTasks.sort((a, b) => b.id - a.id).map(task => (
                                                <div key={task.id} className={`p-5 rounded-2xl border-2 transition-all shadow-sm flex flex-col gap-3 ${task.is_completed ? 'bg-gray-100 border-gray-200 opacity-60' : 'bg-white border-red-100 hover:border-red-300'}`}>
                                                    <div className="flex justify-between items-start">
                                                        <div className="flex flex-col gap-1">
                                                            <div className="flex items-center gap-2">
                                                                {task.is_global ? (
                                                                    <span className="bg-red-500 text-white text-[9px] px-2 py-0.5 rounded-full font-black">전체공지</span>
                                                                ) : (
                                                                    <span className="bg-indigo-100 text-indigo-600 text-[9px] px-2 py-0.5 rounded-full font-black">개인지시</span>
                                                                )}
                                                                <span className="text-[11px] text-gray-400 font-mono">{task.created_at}</span>
                                                            </div>
                                                            <p className={`text-base leading-relaxed mt-1 ${task.is_completed ? 'text-gray-500 line-through' : 'text-gray-800 font-bold'}`}>
                                                                {task.content}
                                                            </p>
                                                        </div>

                                                        {/* 완료 처리 버튼 */}
                                                        {!task.is_completed ? (
                                                            <button
                                                                onClick={() => {
                                                                    if (window.confirm("이 업무를 완료 처리하시겠습니까?")) {
                                                                        // API 호출 로직 (PATCH /api/todos/{id}/ 등)
                                                                        handleToggleAssignedTask(task.id);
                                                                    }
                                                                }}
                                                                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-xl text-xs font-black shadow-md transition-all active:scale-95 shrink-0"
                                                            >
                                                                완료하기
                                                            </button>
                                                        ) : (
                                                            <span className="text-green-500 font-black text-sm flex items-center gap-1">
                                                                <span className="text-lg">✓</span> 처리완료
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            ) : (
                                /* [B] 개인 To-Do List (기존 기능 유지) */
                                <div className="flex flex-col h-full bg-white animate-fade-in">
                                    <div className="p-6 border-b border-gray-100 bg-white shrink-0">
                                        <div className="flex justify-between items-end mb-4">
                                            <div>
                                                <h2 className="text-2xl font-extrabold text-gray-800 flex items-center gap-2">
                                                    📅 개인 메모 & 할 일
                                                </h2>
                                                <p className="text-sm text-gray-500 mt-1">
                                                    나만 볼 수 있는 개인 업무 노트입니다.
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-xl border border-gray-200 shadow-sm focus-within:ring-2 focus-within:ring-indigo-100 transition">
                                            <span className="text-gray-400 pl-2">➕</span>
                                            <input
                                                type="text"
                                                className="flex-1 bg-transparent text-sm font-medium text-gray-800 outline-none placeholder-gray-400"
                                                placeholder="기억해야 할 일을 입력하세요 (Enter)"
                                                value={newTodoInput}
                                                onChange={(e) => setNewTodoInput(e.target.value)}
                                                onKeyPress={(e) => e.key === 'Enter' && handleAddTodo()}
                                            />
                                        </div>
                                    </div>

                                    <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                                        {(() => {
                                            const currentTodos = todos.filter(t => activeTodoTab === 'ALL' ? true : t.tabId === activeTodoTab);
                                            const activeList = currentTodos.filter(t => !t.done).sort((a, b) => b.id - a.id);
                                            const doneList = currentTodos.filter(t => t.done).sort((a, b) => b.id - a.id);

                                            return (
                                                <div className="space-y-6">
                                                    {/* 진행 중 */}
                                                    <div className="space-y-2">
                                                        {activeList.map(todo => (
                                                            <div key={todo.id} draggable={true} onDragStart={(e) => handleDragStart(e, todo.id)}
                                                                className="group flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-200 shadow-sm hover:border-indigo-300 transition-all">
                                                                <div onClick={() => handleToggleTodo(todo.id)} className="w-5 h-5 rounded-full border-2 border-gray-300 cursor-pointer hover:border-indigo-500 transition shrink-0"></div>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-sm font-bold text-gray-800 truncate">{todo.text}</p>
                                                                </div>
                                                                <button onClick={() => handleDeleteTodo(todo.id)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition">🗑️</button>
                                                            </div>
                                                        ))}
                                                    </div>

                                                    {/* 완료됨 */}
                                                    {doneList.length > 0 && (
                                                        <div className="pt-4 border-t border-gray-100">
                                                            <h4 className="text-xs font-bold text-gray-400 mb-3 uppercase">완료된 항목</h4>
                                                            <div className="space-y-2">
                                                                {doneList.map(todo => (
                                                                    <div key={todo.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg opacity-60">
                                                                        <div onClick={() => handleToggleTodo(todo.id)} className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center text-white text-[10px] cursor-pointer">✓</div>
                                                                        <p className="text-sm text-gray-500 line-through flex-1">{todo.text}</p>
                                                                        <button onClick={() => handleDeleteTodo(todo.id)} className="text-gray-300 hover:text-red-500">✕</button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}


                {/* 🟢 [추가] 상담 메모 히스토리 모달 (읽기 전용) */}
                {showHistoryModal && (
                    <div className="fixed inset-0 bg-black/50 z-[9999] flex justify-center items-center backdrop-blur-sm animate-fade-in">
                        <div className="bg-white p-6 rounded-2xl w-[500px] border border-gray-200 shadow-2xl flex flex-col max-h-[70vh]">
                            <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-3">
                                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                    📖 {historyTargetName}님 상담 기록
                                </h3>
                                <button onClick={() => setShowHistoryModal(false)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 bg-gray-50 rounded-xl space-y-3">
                                {historyData.length === 0 ? (
                                    <p className="text-center text-gray-400 text-sm py-10">기록된 상담 내용이 없습니다.</p>
                                ) : (
                                    historyData.map((log, idx) => (
                                        <div key={idx} className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
                                            <div className="flex justify-between items-start mb-1">
                                                <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                                                    {log.user_name || '시스템'}
                                                </span>
                                                <span className="text-[10px] text-gray-400">{new Date(log.created_at).toLocaleString()}</span>
                                            </div>
                                            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                                                {log.content}
                                            </p>
                                        </div>
                                    ))
                                )}
                            </div>

                            <div className="mt-4 text-center">
                                <p className="text-xs text-red-400">※ 히스토리는 수정 및 삭제가 불가능합니다.</p>
                            </div>
                        </div>
                    </div>
                )}

            {/* 🟢 [수정완료] 고객 등록 모달 (슬림 엑셀 시트형 + 직접 붙여넣기) */}
            {showUploadModal && (
                <div className="fixed inset-0 bg-black/60 z-[9999] flex justify-center items-center backdrop-blur-sm animate-fade-in">
                    {/* 가로 1000px의 슬림한 대형 모달 */}
                    <div className="bg-white p-0 rounded-3xl w-[1000px] h-[700px] border border-gray-200 shadow-2xl flex flex-col overflow-hidden transition-all">

                        {/* 1. 상단 헤더 영역 */}
                        <div className="bg-indigo-600 p-5 shrink-0 shadow-md">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h2 className="text-xl font-black text-white flex items-center gap-2">
                                        <span className="text-2xl">📋</span> 고객 DB 등록 센터
                                    </h2>
                                    <p className="text-indigo-100 text-[11px] mt-1 font-medium">
                                        위치: <span className="bg-indigo-700 px-1.5 py-0.5 rounded text-white">{activeTab === 'consult' ? '내 상담 리스트' : activeTab === 'reception' ? '접수 관리' : activeTab === 'long_term' ? '내 가망 관리' : '미배정/공유'}</span>
                                    </p>
                                </div>
                                <button onClick={() => setShowUploadModal(false)} className="text-white/60 hover:text-white text-3xl transition">×</button>
                            </div>

                            {/* 탭 메뉴 */}
                            <div className="flex gap-1 bg-indigo-700/50 p-1 rounded-xl w-fit">
                                <button
                                    onClick={() => setUploadMode('single')}
                                    className={`px-8 py-1.5 rounded-lg text-xs font-bold transition-all ${uploadMode === 'single' ? 'bg-white text-indigo-600 shadow-sm' : 'text-indigo-100 hover:bg-indigo-500/50'}`}
                                >
                                    건별 등록
                                </button>
                                <button
                                    onClick={() => setUploadMode('bulk')}
                                    className={`px-8 py-1.5 rounded-lg text-xs font-bold transition-all ${uploadMode === 'bulk' ? 'bg-white text-indigo-600 shadow-sm' : 'text-indigo-100 hover:bg-indigo-500/50'}`}
                                >
                                    엑셀 일괄 붙여넣기
                                </button>
                            </div>
                        </div>

                        {/* 2. 본문 컨텐츠 영역 */}
                        <div className="flex-1 overflow-y-auto p-5 bg-slate-50 flex flex-col">

                            {uploadMode === 'single' ? (
                                /* [A] 건별 등록 UI */
                                <div className="max-w-xl mx-auto w-full flex flex-col gap-5 animate-fade-in-up py-4">
                                    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-400 mb-1 uppercase">📡 통신사 선택</label>
                                            <select
                                                className="w-full p-2.5 bg-slate-50 border border-gray-200 rounded-lg text-sm font-bold outline-none focus:border-indigo-500 transition-all cursor-pointer"
                                                value={singleData.platform}
                                                onChange={e => setSingleData({ ...singleData, platform: e.target.value })}
                                            >
                                                {platformList.map(p => <option key={p} value={p}>{p}</option>)}
                                            </select>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-[10px] font-black text-gray-400 mb-1 uppercase">👤 고객명</label>
                                                <input className="w-full p-2.5 bg-slate-50 border border-gray-200 rounded-lg text-sm font-bold" placeholder="홍길동" value={singleData.name} onChange={e => setSingleData({ ...singleData, name: e.target.value })} />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-gray-400 mb-1 uppercase">📞 연락처</label>
                                                <input className="w-full p-2.5 bg-slate-50 border border-gray-200 rounded-lg text-sm font-mono" placeholder="010-0000-0000" value={singleData.phone} onChange={e => setSingleData({ ...singleData, phone: e.target.value })} />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-400 mb-1 uppercase">💬 상담 메모</label>
                                            <textarea className="w-full h-24 p-2.5 bg-slate-50 border border-gray-200 rounded-lg text-sm outline-none resize-none" placeholder="내용 입력..." value={singleData.memo} onChange={e => setSingleData({ ...singleData, memo: e.target.value })} />
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                /* [B] 엑셀 일괄 등록 UI (슬림 버전) */
                                <div className="flex flex-col gap-3 h-full animate-fade-in">
                                    {/* 안내 바 */}
                                    <div className="bg-white px-4 py-2 rounded-xl border border-indigo-100 shadow-sm flex justify-between items-center shrink-0">
                                        <div className="flex items-center gap-3">
                                            <div className="bg-indigo-50 text-indigo-600 w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs">!</div>
                                            <div>
                                                <p className="text-[12px] font-bold text-gray-700">표의 <span className="text-indigo-600 font-black">A1(1번 통신사)</span> 칸을 클릭하고 <kbd className="bg-slate-100 px-1 py-0.5 rounded border text-[10px]">Ctrl+V</kbd> 하세요.</p>
                                                <p className="text-[10px] text-gray-400">데이터 순서: 플랫폼 → 성명 → 연락처 → 상담메모</p>
                                            </div>
                                        </div>
                                        {parsedData.length > 0 && (
                                            <button onClick={() => setParsedData([])} className="text-[11px] text-red-400 hover:text-red-600 font-bold underline">데이터 비우기</button>
                                        )}
                                    </div>

                                    {/* ⭐️ 슬림 엑셀형 테이블 (높이 32px 고정) */}
                                    <div className="flex-1 overflow-auto border border-gray-300 rounded-xl shadow-inner bg-white custom-scrollbar">
                                        <style>{`
                                .slim-sheet { border-collapse: collapse; width: 100%; table-layout: fixed; }
                                .slim-sheet th { background: #f8f9fa; border: 1px solid #dee2e6; color: #868e96; font-size: 11px; height: 28px; font-weight: bold; position: sticky; top: 0; z-index: 10; }
                                .slim-sheet td { border: 1px solid #dee2e6; padding: 0; height: 32px; }
                                .slim-sheet input { width: 100%; height: 100%; border: none; padding: 0 8px; font-size: 12px; outline: none; background: transparent; color: #495057; }
                                .slim-sheet input:focus { background: #f1f3ff; box-shadow: inset 0 0 0 1px #4c6ef5; }
                                .col-idx { background: #f1f3f5 !important; width: 40px; text-align: center; color: #adb5bd; font-size: 10px; font-weight: bold; }
                            `}</style>
                                        <table className="slim-sheet">
                                            <thead>
                                                <tr>
                                                    <th className="col-idx">#</th>
                                                    <th>A (플랫폼)</th>
                                                    <th>B (성명)</th>
                                                    <th>C (연락처)</th>
                                                    <th>D (메모)</th>
                                                    <th style={{ width: '50px' }}>삭제</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {parsedData.length > 0 ? (
                                                    parsedData.map((row, idx) => (
                                                        <tr key={row.id}>
                                                            <td className="col-idx">{idx + 1}</td>
                                                            <td><input value={row.platform} onPaste={handlePasteIntoTable} onChange={(e) => handleCellChange(row.id, 'platform', e.target.value)} /></td>
                                                            <td><input className="font-bold" value={row.name} onPaste={handlePasteIntoTable} onChange={(e) => handleCellChange(row.id, 'name', e.target.value)} /></td>
                                                            <td><input className="font-mono text-indigo-600" value={row.phone} onPaste={handlePasteIntoTable} onChange={(e) => handleCellChange(row.id, 'phone', e.target.value)} /></td>
                                                            <td><input value={row.last_memo} onPaste={handlePasteIntoTable} onChange={(e) => handleCellChange(row.id, 'last_memo', e.target.value)} /></td>
                                                            <td className="text-center bg-slate-50">
                                                                <button onClick={() => handleDeleteParsedRow(row.id)} className="text-red-300 hover:text-red-500 text-lg">×</button>
                                                            </td>
                                                        </tr>
                                                    ))
                                                ) : (
                                                    /* 데이터 없을 때의 빈 슬롯 (A1에서 입력을 유도) */
                                                    [...Array(15)].map((_, i) => (
                                                        <tr key={i}>
                                                            <td className="col-idx">{i + 1}</td>
                                                            <td>
                                                                <input
                                                                    placeholder={i === 0 ? "📥 클릭 후 붙여넣기" : ""}
                                                                    className={i === 0 ? "bg-indigo-50/50 placeholder-indigo-400 font-bold" : ""}
                                                                    onPaste={handlePasteIntoTable}
                                                                    readOnly={i !== 0}
                                                                />
                                                            </td>
                                                            <td><input onPaste={handlePasteIntoTable} readOnly /></td>
                                                            <td><input onPaste={handlePasteIntoTable} readOnly /></td>
                                                            <td><input onPaste={handlePasteIntoTable} readOnly /></td>
                                                            <td className="bg-slate-50"></td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 3. 하단 푸터 (버튼 영역) */}
                        <div className="p-4 border-t border-gray-100 bg-white flex justify-end items-center gap-3 shrink-0">
                            <div className="mr-auto px-4">
                                {parsedData.length > 0 && <span className="text-xs font-bold text-indigo-600">✨ 총 {parsedData.length}건 입력됨</span>}
                            </div>
                            <button onClick={() => setShowUploadModal(false)} className="px-6 py-2.5 bg-slate-100 text-gray-500 rounded-xl font-bold hover:bg-slate-200 transition text-xs border border-gray-200">닫기</button>
                            <button
                                onClick={uploadMode === 'single' ? handleSingleSubmit : handleBulkSubmit}
                                disabled={uploadMode === 'bulk' && parsedData.length === 0}
                                className={`px-10 py-2.5 rounded-xl font-black text-sm shadow-lg transition transform active:scale-95 flex items-center gap-2 ${uploadMode === 'single' ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-gray-300 disabled:shadow-none'
                                    }`}
                            >
                                {uploadMode === 'single' ? "💾 등록하기" : `🚀 ${parsedData.length}건 일괄 업로드`}
                            </button>
                        </div>
                    </div>
                </div>
                )}

                {/* 🟢 [수정됨] 접수 취소 사유 선택 모달 */}
                {showCancelModal && cancelTarget && (
                    <div className="fixed inset-0 bg-black/50 z-[9999] flex justify-center items-center backdrop-blur-sm animate-fade-in">
                        <div className="bg-white p-6 rounded-2xl w-[450px] border border-gray-200 shadow-2xl flex flex-col gap-4">

                            {/* 헤더 */}
                            <div className="border-b border-gray-100 pb-3">
                                <h3 className="text-xl font-bold text-red-600 flex items-center gap-2">
                                    🚫 접수 취소 처리
                                </h3>
                                <div className="mt-2 text-sm text-gray-600 bg-gray-50 p-2 rounded-lg">
                                    <p><span className="font-bold">고객명:</span> {cancelTarget.name}</p>
                                    <p><span className="font-bold">연락처:</span> {cancelTarget.phone}</p>
                                </div>
                            </div>

                            {/* 입력 폼 영역 */}
                            <div className="flex flex-col gap-4">

                                {/* 1. 사유 선택 */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">취소 사유 선택 (필수)</label>
                                    <select
                                        className="w-full p-3 border border-gray-300 rounded-lg outline-none focus:border-red-500 text-sm font-bold text-gray-700"
                                        value={selectedCancelReason}
                                        onChange={(e) => setSelectedCancelReason(e.target.value)}
                                    >
                                        <option value="">-- 사유를 선택하세요 --</option>
                                        {(cancelReasons || []).map((r) => (
                                            <option key={r.id} value={r.reason}>{r.reason}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* 2. 메모 작성 */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">취소 메모 (선택)</label>
                                    <textarea
                                        className="w-full p-3 border border-gray-300 rounded-lg outline-none focus:border-red-500 text-sm resize-none h-20"
                                        placeholder="특이사항이나 사유를 상세히 적어주세요."
                                        value={cancelMemo}
                                        onChange={(e) => setCancelMemo(e.target.value)}
                                    />
                                </div>

                                {/* 3. 가망 이동 옵션 */}
                                <label className="flex items-center gap-2 cursor-pointer bg-indigo-50 p-3 rounded-lg border border-indigo-100 hover:bg-indigo-100 transition">
                                    <input
                                        type="checkbox"
                                        className="w-5 h-5 accent-indigo-600"
                                        checked={isMoveToPotential}
                                        onChange={(e) => setIsMoveToPotential(e.target.checked)}
                                    />
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-indigo-900">가망 관리로 이동</span>
                                        <span className="text-[10px] text-indigo-500">체크 시 '접수취소' 대신 '가망' 상태로 변경됩니다.</span>
                                    </div>
                                </label>
                            </div>

                            {/* 버튼 영역 */}
                            <div className="flex justify-end gap-2 mt-2 pt-3 border-t border-gray-100">
                                <button
                                    onClick={() => {
                                        setShowCancelModal(false);
                                        setCancelTarget(null);
                                        setCancelMemo('');
                                        setIsMoveToPotential(false);
                                    }}
                                    className="px-4 py-2.5 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition text-sm"
                                >
                                    닫기
                                </button>
                                <button
                                    onClick={handleConfirmCancel}
                                    className="px-6 py-2.5 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 shadow-md transition flex items-center gap-2 text-sm"
                                >
                                    <span>확인 및 저장</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}


            {/* 🟢 [수정완료] 정책표 뷰어 (이미지 경로 자동 보정 및 레이아웃 최적화) */}
            {showPolicyViewer && (
                <PopoutWindow
                    title="📢 정책 및 공지사항 통합 뷰어"
                    onClose={() => setShowPolicyViewer(false)}
                    width={1100}
                    height={850}
                    windowKey="admin_policy_viewer_pos"
                    trigger={policyViewerTrigger}
                >
                    <div className="flex flex-col h-screen bg-slate-50 font-sans overflow-hidden">

                        {/* 1. 상단 메인 헤더 */}
                        <div className="bg-indigo-900 p-4 flex justify-between items-center text-white shrink-0 shadow-lg z-30">
                            <div className="flex gap-6 items-center">
                                <h2 className="text-xl font-black flex items-center gap-2 tracking-tight">
                                    <span className="bg-white/20 p-1.5 rounded-lg">🏢</span> 통합 정보 센터
                                </h2>
                                <div className="flex bg-indigo-800/50 rounded-xl p-1 border border-white/10">
                                    <button
                                        onClick={() => setViewerTab('policy')}
                                        className={`px-6 py-2 rounded-lg text-sm font-black transition-all ${viewerTab === 'policy' ? 'bg-white text-indigo-900 shadow-md scale-105' : 'text-indigo-200 hover:bg-indigo-700'}`}
                                    >
                                        🖼️ 실시간 정책표
                                    </button>
                                    <button
                                        onClick={() => setViewerTab('notice')}
                                        className={`px-6 py-2 rounded-lg text-sm font-black transition-all ${viewerTab === 'notice' ? 'bg-white text-indigo-900 shadow-md scale-105' : 'text-indigo-200 hover:bg-indigo-700'}`}
                                    >
                                        📢 전사 공지사항
                                    </button>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-[11px] text-indigo-300 font-bold bg-white/10 px-3 py-1.5 rounded-full border border-white/5">
                                    {viewerTab === 'policy' ? '💡 관리자는 이미지를 개별 삭제할 수 있습니다.' : '📅 최신 공지사항을 확인하세요.'}
                                </span>
                            </div>
                        </div>

                        {/* 2. 메인 컨텐츠 영역 */}
                        <div className="flex-1 overflow-hidden relative flex flex-col">

                            {/* [A] 정책표 모드 (다중 출력 + 개별 삭제 기능) */}
                            {viewerTab === 'policy' && (
                                <div className="flex flex-col h-full animate-fade-in">
                                    {/* 통신사 선택 탭 */}
                                    <div className="bg-white px-6 py-4 border-b border-gray-200 flex gap-2 overflow-x-auto hide-scrollbar shrink-0 shadow-sm z-20">
                                        {(config?.policy_tabs || ['KT', 'SK', 'LG', 'SK POP', 'SKY LIFE']).map(p => (
                                            <button
                                                key={p}
                                                onClick={() => { setViewerPlatform(p); setZoomImg(null); }}
                                                className={`px-6 py-2.5 rounded-xl font-black text-sm transition-all whitespace-nowrap border-2
                                    ${viewerPlatform === p
                                                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg'
                                                        : 'bg-white text-gray-400 border-gray-100 hover:border-indigo-200'}`}
                                            >
                                                {p}
                                            </button>
                                        ))}
                                    </div>

                                        {/* 🖼️ 정책표 탭 내용 부분 교체 */}
                                        <div className="flex-1 overflow-y-auto p-8 bg-slate-200/50 custom-scrollbar flex flex-col items-center gap-12">
                                            {(() => {
                                                const rawData = policyImages[viewerPlatform];
                                                const imageList = Array.isArray(rawData) ? rawData : (rawData ? [rawData] : []);

                                                return imageList.length > 0 ? (
                                                    imageList.map((imgObj, index) => {
                                                        const isObject = typeof imgObj === 'object' && imgObj !== null;
                                                        const imageId = isObject ? imgObj.id : null;
                                                        const imageUrl = isObject ? imgObj.url : imgObj;
                                                        const fullUrl = imageUrl.startsWith('http') ? imageUrl : `${API_BASE}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;

                                                        return (
                                                            <div key={imageId || index} className="relative group max-w-5xl w-full mb-10">
                                                                {/* 상단 툴바 (이름 및 삭제 버튼) */}
                                                                <div className="absolute -top-9 left-0 right-0 flex justify-between items-end px-1">
                                                                    <span className="bg-white px-3 py-1 rounded-t-lg border-t border-l border-r border-gray-300 text-[11px] font-bold text-gray-500 shadow-sm">
                                                                        📄 {viewerPlatform} 정책서 #{index + 1}
                                                                    </span>
                                                                </div>

                                                                {/* 이미지 카드 (클릭 시 확대) */}
                                                                <div className="relative shadow-2xl rounded-b-2xl overflow-hidden border-4 border-white bg-white cursor-zoom-in">
                                                                    <img
                                                                        src={fullUrl}
                                                                        alt="정책"
                                                                        className="w-full h-auto transition-transform duration-500 group-hover:scale-[1.01]"
                                                                        onClick={() => { setZoomImg(fullUrl); setZoomScale(1); }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        );
                                                    })
                                                ) : (
                                                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400 py-32">
                                                        <p className="text-xl font-black">등록된 정책이 없습니다.</p>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                </div>
                            )}

                            {policyDeleteTarget && (
                                <div className="absolute inset-0 z-[100] flex justify-center items-center bg-black/70 backdrop-blur-sm animate-fade-in p-4">
                                    <div className="bg-white p-8 rounded-[32px] shadow-2xl w-[420px] border border-gray-200 flex flex-col items-center text-center">
                                        <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center text-4xl mb-5 animate-pulse">⚠️</div>
                                        <h3 className="text-2xl font-black text-gray-800 mb-2">정책서를 삭제할까요?</h3>
                                        <p className="text-sm text-gray-500 mb-8 leading-relaxed">삭제된 이미지는 서버에서 완전히 제거되며<br />더 이상 복구할 수 없습니다.</p>

                                        {/* 삭제 대상 미리보기 */}
                                        <div className="w-full aspect-video rounded-2xl border border-gray-100 overflow-hidden bg-gray-50 mb-8 shadow-inner">
                                            <img src={policyDeleteTarget.url} alt="삭제대상" className="w-full h-full object-contain" />
                                        </div>

                                        <div className="flex gap-4 w-full">
                                            <button
                                                onClick={() => setPolicyDeleteTarget(null)}
                                                className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-2xl font-bold hover:bg-gray-200 transition-all text-sm"
                                            >
                                                아니오, 취소
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* [B] 공지사항 모드 (동일) */}
                            {viewerTab === 'notice' && (
                                <div className="h-full overflow-y-auto p-8 bg-white custom-scrollbar animate-fade-in">
                                    <div className="max-w-4xl mx-auto">
                                        <div className="flex items-center justify-between mb-8 border-b-2 border-gray-100 pb-5">
                                            <h3 className="font-black text-2xl text-gray-900 flex items-center gap-3">
                                                <span className="bg-indigo-100 text-indigo-600 p-2 rounded-xl text-xl">📢</span>
                                                전체 공지사항
                                            </h3>
                                            <span className="text-sm font-bold text-gray-400">총 {notices?.length || 0}개의 공지</span>
                                        </div>
                                        <div className="space-y-6">
                                            {notices && notices.length > 0 ? notices.map(n => (
                                                <div key={n.id} className={`p-6 rounded-2xl border-2 transition-all hover:border-indigo-200 hover:shadow-xl ${n.is_important ? 'bg-red-50/50 border-red-100 shadow-sm' : 'bg-white border-gray-50 shadow-sm'}`}>
                                                    <div className="flex justify-between items-start mb-4">
                                                        <div className="flex flex-col gap-2">
                                                            {n.is_important && (
                                                                <span className="bg-red-500 text-white text-[10px] px-3 py-1 rounded-full font-black w-fit shadow-md animate-pulse">URGENT</span>
                                                            )}
                                                            <span className="font-black text-xl text-gray-800 leading-tight">{n.title}</span>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded-lg mb-1">{n.created_at?.substring(0, 10)}</div>
                                                            <div className="text-[11px] text-indigo-400 font-black">BY. {n.writer_name || 'ADMIN'}</div>
                                                        </div>
                                                    </div>
                                                    <div className="text-gray-700 text-sm whitespace-pre-wrap leading-relaxed bg-white/50 p-4 rounded-xl border border-white/20">{n.content}</div>
                                                </div>
                                            )) : (
                                                <div className="text-center py-32 bg-slate-50 rounded-3xl border-2 border-dashed border-gray-200">
                                                    <span className="text-5xl mb-4 block">📭</span>
                                                    <p className="text-gray-400 font-bold">등록된 공지사항이 없습니다.</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                                {/* 🔍 이미지 확대 레이어 (휠 줌 기능 포함) */}
                                {zoomImg && (
                                    <div
                                        className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md flex flex-col justify-center items-center p-4 animate-fade-in overflow-hidden"
                                        onWheel={(e) => {
                                            setZoomScale(prev => {
                                                const next = prev + (e.deltaY > 0 ? -0.2 : 0.2);
                                                return Math.min(Math.max(next, 0.5), 5);
                                            });
                                        }}
                                        onClick={() => { setZoomImg(null); setZoomScale(1); }}
                                    >
                                        <div className="relative flex justify-center items-center transition-transform duration-200 ease-out"
                                            style={{ transform: `scale(${zoomScale})` }}
                                            onClick={(e) => e.stopPropagation()}>
                                            <img src={zoomImg} alt="확대보기" className="max-w-[90vw] max-h-[85vh] object-contain shadow-2xl rounded-lg border-4 border-white/10" />
                                        </div>
                                        <div className="absolute bottom-10 flex gap-4 z-[210]">
                                            <button onClick={() => window.open(zoomImg, '_blank')} className="bg-white/10 text-white px-8 py-3 rounded-xl font-bold border border-white/20">원본 보기</button>
                                            <button onClick={() => { setZoomImg(null); setZoomScale(1); }} className="bg-indigo-600 text-white px-12 py-3 rounded-xl font-black shadow-2xl">닫기 (ESC)</button>
                                        </div>
                                    </div>
                                )}

                                {/* ⚠️ 정책 삭제 확인 모달 */}
                                {policyDeleteTarget && (
                                    <div className="fixed inset-0 z-[220] bg-black/60 flex justify-center items-center backdrop-blur-sm animate-fade-in">
                                        <div className="bg-white p-8 rounded-[32px] w-[380px] text-center shadow-2xl border border-gray-100">
                                            <div className="text-4xl mb-4">⚠️</div>
                                            <h3 className="text-xl font-black text-gray-800 mb-2">이미지를 삭제할까요?</h3>
                                            <p className="text-sm text-gray-500 mb-8">서버에서 영구히 삭제됩니다.</p>
                                            <div className="flex gap-3 w-full">
                                                <button onClick={() => setPolicyDeleteTarget(null)} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold">취소</button>
                                                <button onClick={executePolicyDelete} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-black shadow-lg">삭제 실행</button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                        </div>
                    </div>
                </PopoutWindow>
            )}


                {/* 🟢 [수정됨] 상세 메모 및 퀵 액션: 독립된 팝업 윈도우로 변경 */}
                {showActionMemo && actionMemoTarget && (
                    <PopoutWindow
                        title={`📝 기록 관리 - ${actionMemoTarget.name}`}
                        onClose={() => setShowActionMemo(false)}
                        width={1000}
                        height={700}
                        windowKey="admin_action_memo_window"
                        trigger={actionMemoTrigger}
                    >
                        <div className="flex flex-col h-screen bg-slate-100 font-sans overflow-hidden">
                            {/* 상단 헤더 */}
                            <div className="bg-indigo-900 px-6 py-4 flex justify-between items-center text-white shrink-0 shadow-lg">
                                <div>
                                    <h3 className="text-lg font-black flex items-center gap-2">
                                        <span>📝 상세 기록 및 업무 관리</span>
                                        <span className="text-sm font-bold text-indigo-300 ml-2">| {actionMemoTarget.name} ({actionMemoTarget.phone})</span>
                                    </h3>
                                </div>
                                <div className="text-[11px] font-bold bg-white/10 px-3 py-1.5 rounded-full border border-white/10">
                                    독립 업무 모드
                                </div>
                            </div>

                            {/* 메인 컨텐츠 */}
                            <div className="flex flex-1 overflow-hidden p-6 gap-6">

                                {/* [LEFT] 메모 작성 및 저장 기능 */}
                                <div className="flex-[1.2] flex flex-col min-w-0 bg-white rounded-3xl border border-gray-200 shadow-sm p-6">
                                    <label className="text-[11px] font-black text-indigo-500 uppercase tracking-wider mb-2">✍️ 상담 메모 작성/수정</label>
                                    <textarea
                                        className="flex-1 w-full p-4 bg-slate-50 border border-gray-200 rounded-2xl text-sm leading-relaxed outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 focus:bg-white transition-all resize-none shadow-inner mb-6"
                                        placeholder="상담 내용을 입력하세요..."
                                        value={extractUserMemo(actionMemoText)}
                                        onChange={(e) => {
                                            const sysPart = extractSystemForm(actionMemoTarget.last_memo);
                                            setActionMemoText(e.target.value + (sysPart ? "\n\n" + sysPart : ""));
                                        }}
                                    />

                                    <div className="grid grid-cols-3 gap-3 mb-6">
                                        <button onClick={handleActionSaveMemoOnly} className="py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-lg hover:bg-indigo-700 transition transform active:scale-95">💾 메모 저장</button>
                                        <button onClick={handleActionMoveToTodo} className="py-4 bg-blue-50 text-blue-700 border border-blue-200 rounded-2xl font-bold text-sm hover:bg-blue-100 transition">📋 TO-DO 등록</button>
                                        <button onClick={handleActionMoveToNotepad} className="py-4 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-2xl font-bold text-sm hover:bg-yellow-100 transition">📒 개인노트</button>
                                    </div>

                                    <div className="pt-6 border-t border-gray-100">
                                        <label className="block text-[11px] font-black text-red-500 mb-2 uppercase">📢 담당 상담원 업무 전달</label>
                                        <div className="flex gap-2 bg-red-50 p-2 rounded-2xl border border-red-100">
                                            <select
                                                className="flex-1 p-3 bg-white border border-red-200 rounded-xl text-sm font-bold outline-none focus:border-red-500"
                                                value={targetAssignAgent}
                                                onChange={(e) => setTargetAssignAgent(e.target.value)}
                                            >
                                                <option value="">대상 선택...</option>
                                                <option value="ALL">📢 전체 공지</option>
                                                {agents.map(a => <option key={a.id} value={a.id}>{a.username}</option>)}
                                            </select>
                                            <button
                                                onClick={handleActionAssignToAgent}
                                                className="bg-red-500 text-white px-8 rounded-xl font-black text-sm hover:bg-red-600 transition shadow-md active:scale-95"
                                            >
                                                지시 전달
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* [RIGHT] 접수 양식 뷰어 */}
                                <div className="flex-1 flex flex-col min-w-0 bg-white rounded-3xl border border-gray-200 shadow-sm p-6">
                                    <label className="text-[11px] font-black text-emerald-600 uppercase tracking-wider mb-2">📄 등록된 접수 양식</label>
                                    <div className={`flex-1 rounded-2xl border-2 border-dashed flex flex-col overflow-hidden transition-all ${extractSystemForm(actionMemoTarget.last_memo) ? 'border-emerald-200 bg-emerald-50/10' : 'border-gray-200 bg-gray-50 items-center justify-center'}`}>
                                        {extractSystemForm(actionMemoTarget.last_memo) ? (
                                            <div className="flex flex-col h-full">
                                                <div className="p-5 flex-1 overflow-y-auto text-[13px] font-mono leading-relaxed text-gray-700 whitespace-pre-wrap select-all custom-scrollbar">
                                                    {extractSystemForm(actionMemoTarget.last_memo)}
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(extractSystemForm(actionMemoTarget.last_memo));
                                                        alert("양식이 복사되었습니다.");
                                                    }}
                                                    className="m-4 py-4 bg-emerald-600 text-white rounded-2xl font-black text-sm hover:bg-emerald-700 transition shadow-lg"
                                                >
                                                    📋 양식 전체 복사
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="text-center p-10">
                                                <span className="text-5xl mb-4 block opacity-10">📭</span>
                                                <p className="text-gray-400 text-sm font-bold">등록된 접수 내역 없음</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* 하단 바 */}
                            <div className="bg-white px-6 py-3 border-t text-[11px] text-gray-400 font-bold text-center">
                                ※ 이 창은 별도의 독립된 윈도우입니다. 메인 화면을 조작하면서 동시에 메모를 작성할 수 있습니다.
                            </div>
                        </div>
                    </PopoutWindow>
                )}

                {showMobileModal && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[10000] flex justify-center items-center animate-fade-in">
                        <div className="bg-white rounded-3xl shadow-2xl w-[480px] overflow-hidden border border-gray-200">
                            {/* 헤더: 더 깔끔하고 직관적인 제목 */}
                            <div className="bg-indigo-600 p-6 text-white flex justify-between items-center">
                                <div>
                                    <h3 className="text-xl font-black flex items-center gap-2">
                                        <span>📱</span> 기기 연동 실시간 설정
                                    </h3>
                                    <p className="text-indigo-100 text-[11px] opacity-80 mt-1">Traccar 앱의 Cloud Token을 입력하여 연동을 완료하세요.</p>
                                </div>
                                <button onClick={() => setShowMobileModal(false)} className="text-white/70 hover:text-white text-3xl">×</button>
                            </div>

                            <div className="p-6 space-y-6 bg-slate-50">
                                {/* 토큰 입력 섹션: 강조된 디자인 */}
                                <div className="space-y-2">
                                    <label className="block text-[11px] font-black text-indigo-500 uppercase ml-1">
                                        🔑 Cloud Token (기기 인증키)
                                    </label>
                                    <div className="relative group">
                                        <textarea
                                            className="w-full h-28 p-4 border-2 border-gray-100 rounded-2xl text-xs font-mono bg-white focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 outline-none transition-all break-all shadow-sm leading-relaxed"
                                            placeholder="핸드폰 Traccar 앱 -> Cloud Service 탭에서 복사한 토큰을 여기에 붙여넣으세요."
                                            value={smsConfig.token}
                                            onChange={(e) => setSmsConfig({ token: e.target.value })}
                                        />
                                        {smsConfig.token && (
                                            <button
                                                onClick={() => setSmsConfig({ token: "" })}
                                                className="absolute right-3 bottom-3 text-[10px] text-gray-300 hover:text-red-500 font-bold"
                                            >
                                                CLEAR
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* 테스트 번호 입력 섹션: 가시성 확보 */}
                                <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                                    <label className="block text-[11px] font-black text-gray-400 uppercase mb-2 ml-1">
                                        📲 테스트 수신 번호
                                    </label>
                                    <input
                                        type="text"
                                        className="w-full p-3 border-2 border-slate-100 rounded-xl text-base font-black text-indigo-600 outline-none focus:border-indigo-400 bg-slate-50 transition-all placeholder-gray-300"
                                        placeholder="01012345678"
                                        value={testPhoneNumber}
                                        onChange={(e) => setTestPhoneNumber(e.target.value)}
                                    />
                                    <p className="text-[10px] text-gray-400 mt-2 text-center">숫자만 입력해 주세요. 발송 시 국가번호(+82)가 자동 부여됩니다.</p>
                                </div>
                            </div>

                            {/* 하단 액션바 */}
                            <div className="p-5 bg-white border-t border-gray-100 flex gap-3">
                                <button
                                    onClick={() => setShowMobileModal(false)}
                                    className="flex-1 py-3.5 text-sm font-bold text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-2xl transition"
                                >
                                    취소
                                </button>
                                <button
                                    onClick={handleExecuteMobileTest}
                                    className="flex-[2.5] bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 rounded-2xl font-black text-sm shadow-lg shadow-indigo-100 transition-all active:scale-95 flex justify-center items-center gap-2"
                                >
                                    🚀 테스트 메시지 발송
                                </button>
                            </div>
                        </div>
                    </div>
                )}

            </div> 
        </div>
    );
}
export default AgentDashboard;
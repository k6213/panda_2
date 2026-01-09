import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom';

// ==================================================================================
// 1. 상수 및 설정값
// ==================================================================================
const API_BASE = "https://panda-1-hd18.onrender.com";

const STATUS_OPTIONS = ['미통건', '부재', '재통', '가망', '장기가망', 'AS요청', '실패', '실패이관', '접수완료'];
const SALES_STATUS_OPTIONS = ['접수완료', '설치완료', '해지진행', '접수취소'];
const TIME_OPTIONS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
const QUICK_FILTERS = ['ALL', '재통', '가망', '부재', '미통건'];
const SETTLEMENT_TARGET_STATUSES = ['설치완료', '접수완료', '해지진행', '접수취소'];

// 공유DB 세부 탭
const SHARED_SUB_TABS = [
    { id: 'ALL', label: '전체 보기' },
    { id: '당근', label: '🥕 당근' },
    { id: '토스', label: '💸 토스' },
    { id: '실패DB', label: '🚫 실패DB' },
    { id: '기타', label: '🎸 기타' }
];

// 통신사 탭 (정책용)
const POLICY_TABS = ['KT', 'SK', 'LG', 'Sky'];

// [초기값] 상담사 팝업 템플릿
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
    if (cleanInput.length === 8) { return `${cleanInput.substring(0, 4)}-${cleanInput.substring(4, 6)}-${cleanInput.substring(6, 8)}`; }
    else if (cleanInput.length === 6) { return `20${cleanInput.substring(0, 2)}-${cleanInput.substring(2, 4)}-${cleanInput.substring(4, 6)}`; }
    else if (cleanInput.length === 4) { return `${now.getFullYear()}-${cleanInput.substring(0, 2)}-${cleanInput.substring(2, 4)}`; }
    else if (cleanInput.length === 3) { return `${now.getFullYear()}-0${cleanInput.substring(0, 1)}-${cleanInput.substring(1, 3)}`; }
    return null;
};

// 독립 윈도우 컴포넌트
const PopoutWindow = ({ title, onClose, children }) => {
    const [container, setContainer] = useState(null);
    const newWindow = useRef(null);
    const closeTimeout = useRef(null);

    useEffect(() => {
        if (closeTimeout.current) {
            clearTimeout(closeTimeout.current);
            closeTimeout.current = null;
        }

        if (!newWindow.current || newWindow.current.closed) {
            newWindow.current = window.open("", "", "width=920,height=750,left=200,top=100,menubar=no,toolbar=no,location=no,status=no");
        }

        if (newWindow.current) {
            const doc = newWindow.current.document;
            doc.title = title || "접수 완료 처리";

            const styles = document.querySelectorAll('style, link[rel="stylesheet"]');
            styles.forEach((styleNode) => {
                doc.head.appendChild(styleNode.cloneNode(true));
            });

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

            newWindow.current.onbeforeunload = () => {
                onClose();
            };
        } else {
            alert("팝업 차단이 설정되어 있습니다. 팝업을 허용해주세요.");
            onClose();
        }

        return () => {
            closeTimeout.current = setTimeout(() => {
                if (newWindow.current) {
                    newWindow.current.close();
                    newWindow.current = null;
                }
            }, 100);
        };
    }, []);

    return container ? ReactDOM.createPortal(children, container) : null;
};

// ==================================================================================
// 3. 메인 컴포넌트
// ==================================================================================
function AdminDashboard({ user, onLogout }) {
    const currentUserId = user ? String(user.user_id || user.id) : null;

    const [activeTab, setActiveTab] = useState('total_manage');
    const [periodFilter, setPeriodFilter] = useState('month');
    const [agents, setAgents] = useState([]);

    const [adChannels, setAdChannels] = useState([]);
    const [reasons, setReasons] = useState([]);
    const [customStatuses, setCustomStatuses] = useState([]);
    const [settlementStatuses, setSettlementStatuses] = useState([]);
    const [bankList, setBankList] = useState([]);

    const [formTemplates, setFormTemplates] = useState(INITIAL_FORM_TEMPLATE);
    const [selectedTemplateIdx, setSelectedTemplateIdx] = useState(0);

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

    // 알림 드롭다운 상태
    const [showNotiDropdown, setShowNotiDropdown] = useState(false);

    const [pasteData, setPasteData] = useState('');
    const [parsedData, setParsedData] = useState([]);

    // 팝업 관련 상태
    const [showCompletionModal, setShowCompletionModal] = useState(false);
    const [completionTarget, setCompletionTarget] = useState(null);
    const [selectedPlatform, setSelectedPlatform] = useState('KT');
    const [dynamicFormData, setDynamicFormData] = useState({});
    const [calculatedPolicy, setCalculatedPolicy] = useState(0);

    const [statDetailType, setStatDetailType] = useState(null);

    // 설정 입력값들
    const [newAgent, setNewAgent] = useState({ username: '', password: '' });
    const [newAdChannel, setNewAdChannel] = useState({ name: '', cost: '' });
    const [newReason, setNewReason] = useState('');
    const [newStatus, setNewStatus] = useState('');
    const [newSettlementStatus, setNewSettlementStatus] = useState('');
    const [newBank, setNewBank] = useState('');
    const [newInstallProduct, setNewInstallProduct] = useState('');

    const [notepadContent, setNotepadContent] = useState('');

    // 확인 요청 모달 상태
    const [showRequestModal, setShowRequestModal] = useState(false);
    const [requestTarget, setRequestTarget] = useState(null);
    const [requestMessage, setRequestMessage] = useState('');

    // ⭐️ [신규] 정책/공지사항 관련 상태 (중복 제거됨)
    const [notices, setNotices] = useState([]);
    const [policyImages, setPolicyImages] = useState({});
    const [activePolicyTab, setActivePolicyTab] = useState('KT');
    const [newNotice, setNewNotice] = useState({ title: '', content: '', is_important: false });
    const [uploadImage, setUploadImage] = useState(null);

    // 디버깅용
    const debugInfo = useMemo(() => {
        const myDataCount = allCustomers.filter(c => String(c.owner) === String(currentUserId)).length;
        return { total: allCustomers.length, myData: myDataCount };
    }, [allCustomers, currentUserId]);

    const getAuthHeaders = () => {
        const token = sessionStorage.getItem('token');
        return { 'Content-Type': 'application/json', 'Authorization': `Token ${token}` };
    };

    const getMultipartHeaders = () => {
        const token = sessionStorage.getItem('token');
        return { 'Authorization': `Token ${token}` }; // Multipart는 Content-Type 자동 설정
    };

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

    // ⭐️ [신규] 공지사항 및 정책 이미지 불러오기
    const fetchNoticesAndPolicies = useCallback(() => {
        // 공지사항
        fetch(`${API_BASE}/api/notices/`, { headers: getAuthHeaders() })
            .then(res => res.json())
            .then(data => setNotices(Array.isArray(data) ? data : []));

        // 정책 이미지
        fetch(`${API_BASE}/api/policies/latest/`, { headers: getAuthHeaders() })
            .then(res => res.json())
            .then(data => setPolicyImages(data));
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
        fetchAllData();
        fetchAgents();

        if (activeTab === 'issue_manage') fetch(`${API_BASE}/api/failure_reasons/`, { headers: getAuthHeaders() }).then(res => res.json()).then(setReasons);
        if (activeTab === 'settlement') fetch(`${API_BASE}/api/settlement_statuses/`, { headers: getAuthHeaders() }).then(res => res.json()).then(setSettlementStatuses);
        if (activeTab === 'settings') fetchSettings();
        if (activeTab === 'policy') fetchNoticesAndPolicies(); // ⭐️ 정책 탭일 때 로드
    }, [activeTab, fetchAllData, fetchAgents, fetchSettings, fetchNoticesAndPolicies]);

    useEffect(() => {
        loadCurrentTabData();
        const interval = setInterval(() => {
            if (!showUploadModal && !showCompletionModal && activeTab !== 'settings' && activeTab !== 'policy') {
                loadCurrentTabData();
            }
        }, 60000);
        return () => clearInterval(interval);
    }, [loadCurrentTabData, showUploadModal, showCompletionModal, activeTab]);

    const myConsultData = useMemo(() => {
        return allCustomers.filter(c =>
            String(c.owner) === String(currentUserId) &&
            !['설치완료', '해지진행', '접수취소'].includes(c.status)
        );
    }, [allCustomers, currentUserId]);

    const myLongTermData = useMemo(() => {
        return allCustomers.filter(c => String(c.owner) === String(currentUserId) && c.status === '장기가망');
    }, [allCustomers, currentUserId]);

    const filteredCustomersByPeriod = useMemo(() => {
        if (!allCustomers) return [];
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        return allCustomers.filter(c => {
            if (!c.upload_date) return false;
            const cDate = new Date(c.upload_date);
            const targetDate = new Date(cDate.getFullYear(), cDate.getMonth(), cDate.getDate());

            if (periodFilter === 'today') {
                return targetDate.getTime() === today.getTime();
            }
            if (periodFilter === 'week') {
                const day = now.getDay();
                const diff = now.getDate() - day + (day === 0 ? -6 : 1);
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

    const dashboardStats = useMemo(() => {
        const data = filteredCustomersByPeriod;
        const total_db = data.length;
        const success_list = data.filter(c => ['접수완료', '설치완료'].includes(c.status));
        const success_count = success_list.length;
        const total_ad_cost = data.reduce((acc, c) => acc + (parseInt(c.ad_cost || 0)), 0);
        const installed_list = data.filter(c => c.status === '설치완료');
        const installed_revenue = installed_list.reduce((acc, c) => acc + (parseInt(c.policy_amt || 0) * 10000), 0);
        const net_profit = success_list.reduce((acc, c) => {
            const policy = parseInt(c.policy_amt || 0);
            const support = parseInt(c.support_amt || 0);
            return acc + ((policy - support) * 10000);
        }, 0);

        return { total_db, success_count, total_ad_cost, installed_revenue, net_profit };
    }, [filteredCustomersByPeriod]);

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
        if (!currentUserId) return [];
        const now = new Date().getTime();
        return (allCustomers || []).filter(c => {
            if (String(c.owner) !== String(currentUserId)) return false;
            if (!c.callback_schedule) return false;
            if (['접수완료', '실패', '장기가망', '접수취소', '실패이관'].includes(c.status)) return false;
            const checklist = parseChecklist(c.checklist);
            if (!checklist.includes('알림ON')) return false;
            return new Date(c.callback_schedule).getTime() <= now;
        }).sort((a, b) => new Date(a.callback_schedule) - new Date(b.callback_schedule));
    }, [allCustomers, currentUserId]);

    const displayedData = useMemo(() => {
        let data = [];
        if (activeTab === 'total_manage') {
            data = allCustomers;
            if (totalDbAgentFilter) {
                if (totalDbAgentFilter === 'unassigned') data = data.filter(c => c.owner === null);
                else data = data.filter(c => String(c.owner) === String(totalDbAgentFilter));
            }
        }
        else if (activeTab === 'shared') {
            data = sharedCustomers;
            if (sharedSubTab !== 'ALL') {
                if (sharedSubTab === '기타') {
                    const known = ['당근', '토스', '실패DB'];
                    data = data.filter(c => !known.includes(c.platform));
                } else {
                    data = data.filter(c => c.platform === sharedSubTab);
                }
            }
            if (viewDuplicatesOnly) {
                data = data.filter(c => duplicateSet.has(c.phone)).sort((a, b) => a.phone.localeCompare(b.phone));
            }
        }
        else if (activeTab === 'consult') {
            data = myConsultData;
            if (statusFilter !== 'ALL') data = data.filter(c => c.status === statusFilter);
            data.sort((a, b) => {
                const dateA = a.callback_schedule ? new Date(a.callback_schedule).getTime() : Infinity;
                const dateB = b.callback_schedule ? new Date(b.callback_schedule).getTime() : Infinity;
                return dateA - dateB;
            });
        }
        else if (activeTab === 'long_term') {
            data = myLongTermData;
            data.sort((a, b) => new Date(a.callback_schedule || 0) - new Date(b.callback_schedule || 0));
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
            data = data.filter(c => String(c.owner) === String(salesAgentFilter));
        }
        return data;
    }, [activeTab, allCustomers, sharedCustomers, issueCustomers, viewDuplicatesOnly, duplicateSet, totalDbAgentFilter, issueSubTab, failReasonFilter, salesAgentFilter, settlementStatusFilter, myConsultData, myLongTermData, statusFilter, sharedSubTab]);

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

    // =========================================================================
    // 🎮 핸들러
    // =========================================================================
    const handleAddAdChannel = () => { if (!newAdChannel.name || !newAdChannel.cost) return alert("입력 필요"); fetch(`${API_BASE}/api/ad_channels/`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(newAdChannel) }).then(() => { alert("완료"); setNewAdChannel({ name: '', cost: '' }); fetchSettings(); }); };
    const handleDeleteAdChannel = (id) => { if (window.confirm("삭제?")) fetch(`${API_BASE}/api/ad_channels/${id}/`, { method: 'DELETE', headers: getAuthHeaders() }).then(() => fetchSettings()); };
    const handleAddPlatform = () => { const name = prompt("통신사 이름"); if (name) { setFormTemplates([...formTemplates, { id: name, name, cost: 0, fields: [] }]); setSelectedTemplateIdx(formTemplates.length); } };
    const handleDeletePlatform = (idx) => { if (window.confirm("삭제?")) { const newTemplates = formTemplates.filter((_, i) => i !== idx); setFormTemplates(newTemplates); setSelectedTemplateIdx(0); } };
    const handleUpdatePlatformMeta = (key, value) => { const newTemplates = [...formTemplates]; newTemplates[selectedTemplateIdx][key] = value; setFormTemplates(newTemplates); };
    const handleAddField = () => { const newTemplates = [...formTemplates]; newTemplates[selectedTemplateIdx].fields.push({ id: `field_${Date.now()}`, label: "새 항목", type: "text", options: "" }); setFormTemplates(newTemplates); };
    const handleUpdateField = (fieldIdx, key, value) => { const newTemplates = [...formTemplates]; newTemplates[selectedTemplateIdx].fields[fieldIdx][key] = value; setFormTemplates(newTemplates); };
    const handleDeleteField = (fieldIdx) => { const newTemplates = [...formTemplates]; newTemplates[selectedTemplateIdx].fields = newTemplates[selectedTemplateIdx].fields.filter((_, i) => i !== fieldIdx); setFormTemplates(newTemplates); };
    const handleSaveSettings = () => { alert("✅ 저장되었습니다."); console.log(formTemplates); };
    const handleCreateAgent = () => { fetch(`${API_BASE}/api/agents/`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(newAgent) }).then(res => { if (res.ok) { alert("완료"); setNewAgent({ username: '', password: '' }); fetchAgents(); } else res.json().then(d => alert(d.message)); }); };
    const handleDeleteAgent = (id, name) => { if (window.confirm(`'${name}' 삭제?`)) fetch(`${API_BASE}/api/agents/${id}/`, { method: 'DELETE', headers: getAuthHeaders() }).then(() => { alert("삭제 완료"); fetchAgents(); }); };
    const handleAddReason = () => { if (!newReason) return; fetch(`${API_BASE}/api/failure_reasons/`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ reason: newReason }) }).then(() => { alert("완료"); setNewReason(''); fetchSettings(); }); };
    const handleDeleteReason = (id) => { if (window.confirm("삭제?")) fetch(`${API_BASE}/api/failure_reasons/${id}/`, { method: 'DELETE', headers: getAuthHeaders() }).then(() => fetchSettings()); };
    const handleAddStatus = () => { if (!newStatus) return; fetch(`${API_BASE}/api/custom_statuses/`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ status: newStatus }) }).then(() => { alert("완료"); setNewStatus(''); fetchSettings(); }); };
    const handleDeleteStatus = (id) => { if (window.confirm("삭제?")) fetch(`${API_BASE}/api/custom_statuses/${id}/`, { method: 'DELETE', headers: getAuthHeaders() }).then(() => fetchSettings()); };
    const handleAddSettlementStatus = () => { if (!newSettlementStatus) return; fetch(`${API_BASE}/api/settlement_statuses/`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ status: newSettlementStatus }) }).then(() => { alert("완료"); setNewSettlementStatus(''); fetchSettings(); }); };
    const handleDeleteSettlementStatus = (id) => { if (window.confirm("삭제?")) fetch(`${API_BASE}/api/settlement_statuses/${id}/`, { method: 'DELETE', headers: getAuthHeaders() }).then(() => fetchSettings()); };

    // 일괄 배정 핸들러 (관리자 본인일 경우 탭 이동)
    const handleAllocate = (refreshCallback) => {
        if (selectedIds.length === 0 || !targetAgentId) return alert("대상/상담사 선택");
        if (!window.confirm("이동?")) return;

        fetch(`${API_BASE}/api/customers/allocate/`, {
            method: 'POST', headers: getAuthHeaders(),
            body: JSON.stringify({ customer_ids: selectedIds, agent_id: targetAgentId })
        }).then(res => res.json()).then(data => {
            alert(data.message);
            setSelectedIds([]);
            if (String(targetAgentId) === String(currentUserId)) {
                setActiveTab('consult');
            }
            setTargetAgentId('');
            if (typeof refreshCallback === 'function') refreshCallback();
            else loadCurrentTabData();
        });
    };

    const handleDeleteCustomer = (id) => { if (window.confirm("삭제?")) fetch(`${API_BASE}/api/customers/${id}/`, { method: 'DELETE', headers: getAuthHeaders() }).then(() => loadCurrentTabData()); };
    const handlePaste = (e) => { const text = e.target.value; setPasteData(text); const rows = text.trim().split('\n').map(row => { const cols = row.split('\t').map(c => c.trim()); return { name: cols[0] || '이름없음', phone: cols[1] || '', platform: cols[2] || '기타', last_memo: cols.slice(2).filter(Boolean).join(' / '), upload_date: new Date().toISOString().slice(0, 10) }; }); setParsedData(rows); };
    const handleBulkSubmit = () => { if (parsedData.length === 0) return; fetch(`${API_BASE}/api/customers/bulk_upload/`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ customers: parsedData }) }).then(async (res) => { const data = await res.json(); if (res.ok) { alert(data.message); setShowUploadModal(false); setPasteData(''); setParsedData([]); loadCurrentTabData(); } else { alert(`오류: ${data.message}`); } }).catch(err => console.error(err)); };
    const handleSelectAll = (e, dataList) => { if (e.target.checked) setSelectedIds(dataList.map(c => c.id)); else setSelectedIds([]); };
    const handleCheck = (id) => { if (selectedIds.includes(id)) setSelectedIds(selectedIds.filter(sid => sid !== id)); else setSelectedIds([...selectedIds, id]); };

    // 관리자 본인 표시 (문자열 비교)
    const getAgentName = (id) => {
        if (!id) return '-';
        if (String(id) === String(currentUserId)) return '👤 나 (관리자)';
        const agent = agents.find(a => String(a.id) === String(id));
        return agent ? agent.username : '알수없음';
    };

    const handleToggleStatDetail = (type) => { if (statDetailType === type) setStatDetailType(null); else setStatDetailType(type); };

    // 단일 가져오기 핸들러
    const handleAssignToMe = (id) => {
        if (!window.confirm("이 고객을 내 상담 리스트로 가져오시겠습니까?")) return;
        fetch(`${API_BASE}/api/customers/${id}/assign/`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ user_id: currentUserId })
        }).then(() => {
            alert("배정 완료! '내 상담관리' 탭에서 확인하세요.");
            loadCurrentTabData();
            setActiveTab('consult');
        });
    };

    // ⭐️ [신규] 공지사항 추가 핸들러
    const handleCreateNotice = () => {
        if (!newNotice.title || !newNotice.content) return alert("제목과 내용을 입력해주세요.");
        fetch(`${API_BASE}/api/notices/`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(newNotice)
        }).then(() => {
            alert("공지사항 등록 완료");
            setNewNotice({ title: '', content: '', is_important: false });
            fetchNoticesAndPolicies();
        });
    };

    const handleDeleteNotice = (id) => {
        if (!window.confirm("삭제하시겠습니까?")) return;
        fetch(`${API_BASE}/api/notices/${id}/`, { method: 'DELETE', headers: getAuthHeaders() })
            .then(() => fetchNoticesAndPolicies());
    };

    // ⭐️ [신규] 정책 이미지 업로드 핸들러
    const handleImageUpload = () => {
        if (!uploadImage) return alert("이미지를 선택해주세요.");
        const formData = new FormData();
        formData.append('platform', activePolicyTab);
        formData.append('image', uploadImage);

        fetch(`${API_BASE}/api/policies/`, {
            method: 'POST',
            headers: {
                'Authorization': `Token ${sessionStorage.getItem('token')}` // Multipart는 Content-Type 자동 설정 필요
            },
            body: formData
        }).then(() => {
            alert("정책 이미지 업로드 완료");
            setUploadImage(null);
            fetchNoticesAndPolicies();
        });
    };

    // 확인 요청 모달 열기
    const openRequestModal = (customer) => {
        setRequestTarget(customer);
        setShowRequestModal(true);
    };

    // 확인 요청 전송
    const sendRequest = () => {
        if (!requestTarget) return;

        // 1. 낙관적 업데이트
        setAllCustomers(prev => prev.map(c => c.id === requestTarget.id ? { ...c, request_status: 'REQUESTED', request_message: requestMessage } : c));

        // 2. 서버 전송
        fetch(`${API_BASE}/api/customers/${requestTarget.id}/`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                request_status: 'REQUESTED',
                request_message: requestMessage
            })
        }).then(() => {
            alert("확인 요청이 전송되었습니다.");
            setShowRequestModal(false);
            setRequestMessage('');
            setRequestTarget(null);
        }).catch(err => alert("요청 실패"));
    };

    // 요청 완료 처리 (Clear)
    const clearRequest = (id) => {
        if (!window.confirm("완료된 요청을 정리하시겠습니까?")) return;
        handleInlineUpdate(id, 'request_status', null);
    };

    const handleInlineUpdate = async (id, field, value) => {
        setAllCustomers(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
        try { await fetch(`${API_BASE}/api/customers/${id}/`, { method: 'PATCH', headers: getAuthHeaders(), body: JSON.stringify({ [field]: value }) }); } catch (error) { alert("저장 실패"); loadCurrentTabData(); }
    };

    // 알림 토글 핸들러
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
        setAllCustomers(prev => prev.map(c => c.id === customer.id ? { ...c, checklist: newStr } : c));
        fetch(`${API_BASE}/api/customers/${customer.id}/`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify({ checklist: newStr })
        });
    };

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
        const newDateStr = `${yy}-${mm}-${dd}T${hh}:00:00`;
        handleInlineUpdate(customer.id, 'callback_schedule', newDateStr);
    };

    const autoResizeTextarea = (e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; };
    const renderInteractiveStars = (id, currentRank) => (
        <div className="flex cursor-pointer" onClick={(e) => e.stopPropagation()}>
            {[1, 2, 3, 4, 5].map(star => (<span key={star} className={`text-lg ${star <= currentRank ? 'text-yellow-400' : 'text-gray-300'} hover:scale-125 transition`} onClick={() => handleInlineUpdate(id, 'rank', star)}>★</span>))}
        </div>
    );

    // 팝업 관련 핸들러
    const handleStatusChangeRequest = async (id, newStatus) => {
        if (newStatus === '접수완료') {
            const target = allCustomers.find(c => c.id === id);
            setCompletionTarget(target);
            setSelectedPlatform(target.platform || 'KT');
            setDynamicFormData({});
            setCalculatedPolicy(0);
            setShowCompletionModal(true);
            return;
        }
        handleInlineUpdate(id, 'status', newStatus);
    };

    // 템플릿 State를 참조하여 정책금 계산
    const handleFormDataChange = (key, value, optionPolicies = null) => {
        const newData = { ...dynamicFormData, [key]: value };
        setDynamicFormData(newData);

        let totalPolicy = 0;
        const templateObj = formTemplates.find(t => t.name === selectedPlatform || t.id === selectedPlatform);
        if (templateObj && templateObj.fields) {
            templateObj.fields.forEach(field => {
                const selectedVal = (field.id === key) ? value : newData[field.id];
                if (selectedVal && field.policies && field.policies[selectedVal]) {
                    totalPolicy += field.policies[selectedVal];
                }
            });
        }
        setCalculatedPolicy(totalPolicy);
    };

    const handleConfirmCompletion = () => {
        if (!completionTarget) return;

        const templateObj = formTemplates.find(t => t.name === selectedPlatform || t.id === selectedPlatform);
        const fields = templateObj ? templateObj.fields : [];

        const infoString = fields.map(field => {
            const val = dynamicFormData[field.id];
            if (field.type === 'checkbox' && !val) return null;
            if (!val) return null;
            return `${field.label}: ${val}`;
        }).filter(Boolean).join(' / ');

        const finalProductInfo = `[${selectedPlatform}] ${infoString}`;
        const payload = { status: '접수완료', platform: selectedPlatform, product_info: finalProductInfo, agent_policy: calculatedPolicy, installed_date: null };

        fetch(`${API_BASE}/api/customers/${completionTarget.id}/`, { method: 'PATCH', headers: getAuthHeaders(), body: JSON.stringify(payload) })
            .then(() => {
                const logContent = `[시스템 자동접수]\n통신사: ${selectedPlatform}\n상품내역: ${infoString}\n예상 정책금: ${calculatedPolicy}만원`;
                fetch(`${API_BASE}/api/customers/${completionTarget.id}/add_log/`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ user_id: user.user_id, content: logContent }) });
            })
            .then(() => {
                alert("🎉 접수가 완료되었습니다!");
                setShowCompletionModal(false); setCompletionTarget(null); loadCurrentTabData(); setActiveTab('reception');
            })
            .catch(err => alert("오류 발생: " + err));
    };

    const openHistoryModal = (c) => {
        alert(`${c.name}님의 상세 정보로 이동합니다.`);
    };

    // =========================================================================
    // 🖥️ 렌더링
    // =========================================================================
    return (
        <div className="min-h-screen bg-slate-50 text-gray-800 p-5 font-sans relative" onClick={() => setShowNotiDropdown(false)}>

            {/* 스타일 (스핀박스 제거) */}
            <style>{`.no-spin::-webkit-inner-spin-button, .no-spin::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; } .no-spin { -moz-appearance: textfield; }`}</style>

            {/* 헤더 */}
            <header className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm mb-6 border border-gray-200 sticky top-0 z-40">
                <h1 className="text-xl font-extrabold text-indigo-900 flex items-center gap-2">👑 관리자 대시보드</h1>
                {/* ⭐️ 상단 디버깅용 표시 (나중에 삭제 가능) */}
                <div className="text-xs text-gray-400">
                    내 ID: {currentUserId} | 총 데이터: {allCustomers.length}건 | 내 담당: {debugInfo.myData}건
                </div>
                <div className="flex items-center gap-6">
                    {/* 알림 아이콘 추가 */}
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

            {/* 탭 메뉴 (순서 변경됨) */}
            <div className="flex gap-1 mb-4 border-b border-gray-200 pb-1 overflow-x-auto sticky top-[80px] z-30 bg-slate-50">
                {[
                    { id: 'total_manage', label: '🗂️ 전체 DB' },
                    { id: 'shared', label: '🛒 미배정(공유)' },
                    { id: 'consult', label: '📞 내 상담관리', special: true },
                    { id: 'long_term', label: '📅 내 가망관리', special: true },
                    { id: 'reception', label: '📝 접수관리' },
                    { id: 'installation', label: '✅ 설치완료' },
                    { id: 'settlement', label: '💰 정산관리' },
                    { id: 'issue_manage', label: '🛠 AS/실패' },
                    { id: 'stats', label: '📊 실적' },
                    { id: 'users', label: '👥 상담사' },
                    { id: 'policy', label: '📢 정책/공지' }, // ⭐️ 탭 추가
                    { id: 'settings', label: '⚙️ 설정' },
                    { id: 'notepad', label: '📝 메모장', special: true }
                ].map(tab => (
                    <button key={tab.id} onClick={() => { setActiveTab(tab.id); setSalesAgentFilter(''); }}
                        className={`px-4 py-2 rounded-t-xl font-bold transition whitespace-nowrap border-t border-l border-r text-sm 
                        ${activeTab === tab.id
                                ? (tab.special ? 'bg-indigo-50 text-indigo-700 border-indigo-200 translate-y-[1px] border-b-white' : 'bg-white text-gray-800 border-gray-200 translate-y-[1px]')
                                : 'bg-gray-100 text-gray-500 border-transparent hover:bg-gray-200'}`}>
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="bg-white rounded-xl shadow-lg min-h-[600px] border border-gray-200 p-6 overflow-x-auto">
                {/* ⭐️ [신규] 정책/공지사항 탭 */}
                {activeTab === 'policy' && (
                    <div className="flex gap-6 h-[750px] animate-fade-in">
                        {/* 왼쪽: 공지사항 관리 */}
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
                                {notices.length === 0 && <div className="text-center text-gray-400 text-sm mt-10">등록된 공지사항이 없습니다.</div>}
                            </div>
                        </div>

                        {/* 오른쪽: 요금표/정책 이미지 관리 */}
                        <div className="flex-1 flex flex-col h-full bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                            <div className="bg-gray-50 p-4 border-b border-gray-200 flex justify-between items-center">
                                <div className="flex gap-2">
                                    {POLICY_TABS.map(p => (
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
                                        <p>등록된 정책 이미지가 없습니다.</p>
                                    </div>
                                )}
                            </div>
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
                                        {/* ⭐️ 확인요청 컬럼 추가 */}
                                        <th className="p-3 text-center">확인요청</th>
                                        <th className="p-3">관리</th>
                                    </tr>
                                </thead>
                                <tbody>{displayedData.map(c => (
                                    <tr key={c.id} className="border-b border-gray-100 hover:bg-indigo-50 transition">
                                        <td className="p-3 text-center"><input type="checkbox" className="accent-indigo-600" checked={selectedIds.includes(c.id)} onChange={() => handleCheck(c.id)} /></td>
                                        <td className="p-3 text-gray-500">{c.upload_date}</td><td className="p-3 font-bold text-indigo-600">{getAgentName(c.owner)}</td><td className="p-3 font-bold">{c.name}</td><td className="p-3 text-gray-500">{c.phone}</td><td className="p-3"><span className="bg-gray-100 border border-gray-200 px-2 py-1 rounded text-xs text-gray-600">{c.platform}</span></td><td className="p-3"><span className={`px-2 py-1 rounded text-xs font-bold ${getBadgeStyle(c.status)}`}>{c.status}</span></td>

                                        {/* ⭐️ 확인요청 버튼 로직 */}
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
                            {/* ⭐️ 관리자 본인에게 일괄 배정할 수 있도록 옵션 추가 */}
                            <option value={currentUserId}>👤 나 (관리자)</option>
                            {agents.map(a => <option key={a.id} value={a.id}>{a.username}</option>)}
                        </select><button onClick={() => handleAllocate(loadCurrentTabData)} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-sm transition">일괄 배정</button></div></div>

                        {/* ⭐️ [신규] 공유DB 내부 세부 탭 (전체/당근/토스/...) */}
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

                        <div className="max-h-[600px] overflow-y-auto border border-gray-200 rounded-lg"><table className="w-full text-left text-sm text-gray-700"><thead className="bg-gray-100 sticky top-0 z-10 text-gray-500 font-bold uppercase text-xs"><tr><th className="p-3 w-10 text-center"><input type="checkbox" className="accent-indigo-600" onChange={(e) => handleSelectAll(e, displayedData)} checked={displayedData.length > 0 && selectedIds.length === displayedData.length} /></th><th className="p-3">날짜</th><th className="p-3">플랫폼</th><th className="p-3">이름</th><th className="p-3">번호</th><th className="p-3">광고비</th><th className="p-3">중복여부</th><th className="p-3">관리</th></tr></thead><tbody>{displayedData.map(c => {
                            const isDup = duplicateSet.has(c.phone); return (<tr key={c.id} className={`border-b border-gray-100 hover:bg-indigo-50 transition ${isDup ? 'bg-red-50' : ''}`}><td className="p-3 text-center"><input type="checkbox" className="accent-indigo-600" checked={selectedIds.includes(c.id)} onChange={() => handleCheck(c.id)} /></td><td className="p-3 text-gray-500">{c.upload_date}</td><td className="p-3"><span className="bg-gray-100 border border-gray-200 px-2 py-1 rounded text-xs text-gray-600">{c.platform}</span></td><td className="p-3 font-bold">{c.name}</td><td className="p-3 text-gray-500">{c.phone}</td><td className="p-3 font-bold text-gray-600">{(c.ad_cost || 0).toLocaleString()}</td><td className="p-3">{isDup && <span className="bg-red-100 text-red-600 border border-red-200 px-2 py-0.5 rounded text-xs font-bold">중복됨</span>}</td>
                                <td className="p-3 flex gap-2">
                                    {/* ⭐️ 가져가기 버튼 */}
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
                                        <th className="p-3 w-16 text-center">번호</th>
                                        <th className="p-3 w-24">플랫폼</th>
                                        <th className="p-3 w-28">등록일</th>
                                        <th className="p-3 w-28">이름</th>
                                        <th className="p-3 w-40">연락처</th>
                                        <th className="p-3 w-56 text-indigo-700">재통화(년/월/일/시)</th>
                                        <th className="p-3 w-28">상태</th>
                                        <th className="p-3">상담 메모</th>
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
                                                    <div className="flex items-center gap-2">
                                                        {c.name}
                                                        {/* 알림 토글 버튼 */}
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
                                                <td className="p-3">{c.phone}</td>
                                                <td className="p-3">
                                                    <div className="flex flex-col gap-1">
                                                        <div className="flex items-center gap-1">
                                                            <input type="text" className="w-9 text-center bg-transparent border-b border-gray-300 focus:border-indigo-500 outline-none text-xs font-mono" placeholder="YYYY" defaultValue={currentY} onBlur={(e) => handleCallbackChange(c, 'year', e.target.value)} />
                                                            <span className="text-gray-300 text-[10px]">-</span>
                                                            <input type="text" className="w-5 text-center bg-transparent border-b border-gray-300 focus:border-indigo-500 outline-none text-xs font-mono" placeholder="MM" defaultValue={currentM} onBlur={(e) => handleCallbackChange(c, 'month', e.target.value)} />
                                                            <span className="text-gray-300 text-[10px]">-</span>
                                                            <input type="text" className="w-5 text-center bg-transparent border-b border-gray-300 focus:border-indigo-500 outline-none text-xs font-mono" placeholder="DD" defaultValue={currentD} onBlur={(e) => handleCallbackChange(c, 'day', e.target.value)} />
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

                {/* ... (이하 기존 코드: 접수관리, 설치완료, 정산관리, AS실패, 실적, 상담사, 설정) ... */}
                {/* 4. [접수 관리] */}
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

                {/* 5. [설치 완료] */}
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

                {/* 6. [정산 관리] */}
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

                {/* 9. [설정] */}
                {activeTab === 'settings' && (
                    <div className="flex gap-6 h-[750px] animate-fade-in">
                        {/* 왼쪽 사이드바 (기타 설정) */}
                        <div className="w-1/3 flex flex-col gap-4 overflow-y-auto pr-2 custom-scrollbar">
                            {/* 광고 채널 설정 */}
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

                            {/* 실패 사유 설정 */}
                            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                                <h3 className="font-bold mb-2 text-sm text-gray-700">🚫 실패 사유 관리</h3>
                                <div className="flex gap-2 mb-3"><input className="bg-gray-50 p-2 rounded flex-1 border border-gray-300 text-gray-800 text-xs outline-none focus:border-red-400" placeholder="사유 입력" value={newReason} onChange={e => setNewReason(e.target.value)} /><button onClick={handleAddReason} className="bg-red-500 hover:bg-red-600 px-3 rounded text-white font-bold text-xs transition">추가</button></div>
                                <div className="flex flex-wrap gap-2">{reasons.map(r => <span key={r.id} className="bg-red-50 text-red-600 px-2 py-1 rounded text-[10px] border border-red-100 flex items-center gap-1 font-bold">{r.reason}<button onClick={() => handleDeleteReason(r.id)} className="hover:text-red-800">×</button></span>)}</div>
                            </div>

                            {/* 상태값 설정 */}
                            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                                <h3 className="font-bold mb-2 text-sm text-teal-700">📞 상담 상태값 관리</h3>
                                <div className="flex gap-2 mb-3">
                                    <input className="bg-gray-50 p-2 rounded flex-1 border border-gray-300 text-gray-800 text-xs outline-none focus:border-teal-400" placeholder="예: 재통화" value={newStatus} onChange={e => setNewStatus(e.target.value)} />
                                    <button onClick={handleAddStatus} className="bg-teal-600 hover:bg-teal-700 px-3 rounded text-white font-bold text-xs transition">추가</button>
                                </div>
                                <div className="flex flex-wrap gap-2">{customStatuses.map(s => <span key={s.id} className="bg-teal-50 text-teal-700 px-2 py-1 rounded-full text-[10px] border border-teal-100 flex items-center gap-1 font-bold">{s.status}<button onClick={() => handleDeleteStatus(s.id)} className="hover:text-teal-900">×</button></span>)}</div>
                            </div>

                            {/* 정산 상태값 설정 */}
                            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                                <h3 className="font-bold mb-2 text-sm text-orange-600">💰 정산 상태값 관리</h3>
                                <div className="flex gap-2 mb-3"><input className="bg-gray-50 p-2 rounded flex-1 border border-gray-300 text-gray-800 text-xs outline-none focus:border-orange-400" placeholder="예: 부분정산" value={newSettlementStatus} onChange={e => setNewSettlementStatus(e.target.value)} /><button onClick={handleAddSettlementStatus} className="bg-orange-500 hover:bg-orange-600 px-3 rounded text-white font-bold text-xs transition">추가</button></div>
                                <div className="flex flex-wrap gap-2">{settlementStatuses.map(s => <span key={s.id} className="bg-orange-50 text-orange-600 px-2 py-1 rounded-full text-[10px] border border-orange-100 flex items-center gap-1 font-bold">{s.status}<button onClick={() => handleDeleteSettlementStatus(s.id)} className="hover:text-orange-800">×</button></span>)}</div>
                            </div>
                        </div>

                        {/* 오른쪽 메인 (통신사 템플릿 설정) */}
                        <div className="flex-1 bg-white rounded-xl border border-gray-300 flex flex-col shadow-xl overflow-hidden">
                            <div className="bg-gray-50 p-4 border-b border-gray-200 flex justify-between items-center">
                                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">🛠️ 통신사 정책 및 팝업 템플릿</h3>
                                <button onClick={handleSaveSettings} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-bold text-sm shadow-md transition transform hover:-translate-y-0.5">💾 변경사항 저장</button>
                            </div>
                            <div className="flex flex-1 overflow-hidden">
                                {/* 왼쪽 리스트 */}
                                <div className="w-1/4 border-r border-gray-200 bg-gray-50 flex flex-col">
                                    <div className="p-3 border-b border-gray-200 bg-white">
                                        <button onClick={handleAddPlatform} className="w-full bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 py-2 rounded text-indigo-700 text-sm font-bold transition">+ 통신사 추가</button>
                                    </div>
                                    <div className="flex-1 overflow-y-auto">
                                        {formTemplates.map((tpl, idx) => (
                                            <div key={idx} onClick={() => setSelectedTemplateIdx(idx)} className={`p-4 cursor-pointer border-b border-gray-200 flex justify-between items-center transition ${selectedTemplateIdx === idx ? 'bg-white border-l-4 border-l-indigo-600 shadow-sm' : 'hover:bg-gray-100 text-gray-500'}`}>
                                                <div><div className={`font-bold ${selectedTemplateIdx === idx ? 'text-indigo-800' : 'text-gray-600'}`}>{tpl.name}</div><div className="text-[10px] text-gray-400 mt-1">정책: {tpl.cost}만</div></div>
                                                {formTemplates.length > 1 && <button onClick={(e) => { e.stopPropagation(); handleDeletePlatform(idx); }} className="text-gray-300 hover:text-red-500 text-xs font-bold">삭제</button>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                {/* 오른쪽 상세 설정 */}
                                <div className="flex-1 bg-white flex flex-col p-8 overflow-y-auto">
                                    <div className="mb-8 border-b border-gray-100 pb-8">
                                        <h4 className="text-gray-800 font-bold mb-4 flex items-center gap-2 text-sm border-l-4 border-gray-800 pl-2">기본 정보 설정</h4>
                                        <div className="flex gap-6">
                                            <div className="flex-1">
                                                <label className="block text-gray-500 text-xs font-bold mb-1">통신사 이름</label>
                                                <input className="w-full bg-white border border-gray-300 rounded p-2.5 text-gray-800 font-bold outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 transition" value={formTemplates[selectedTemplateIdx]?.name} onChange={(e) => handleUpdatePlatformMeta('name', e.target.value)} />
                                            </div>
                                            <div className="flex-1">
                                                <label className="block text-yellow-600 text-xs font-bold mb-1">💰 기본 정책 단가 (단위: 만원)</label>
                                                <input type="number" className="w-full bg-yellow-50 border border-yellow-300 rounded p-2.5 text-yellow-700 font-bold outline-none focus:border-yellow-500 transition" value={formTemplates[selectedTemplateIdx]?.cost} onChange={(e) => handleUpdatePlatformMeta('cost', e.target.value)} />
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <div className="flex justify-between items-center mb-4">
                                            <h4 className="text-gray-800 font-bold flex items-center gap-2 text-sm border-l-4 border-indigo-500 pl-2">팝업 입력 항목 <span className="text-gray-400 text-xs font-normal">(상담사가 접수 시 입력할 내용)</span></h4>
                                            <button onClick={handleAddField} className="bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 px-3 py-1.5 rounded text-xs font-bold transition">+ 항목 추가</button>
                                        </div>
                                        <div className="space-y-4">
                                            {formTemplates[selectedTemplateIdx]?.fields.map((field, fIdx) => (
                                                <div key={field.id} className="bg-white p-5 rounded-xl border border-gray-200 relative group hover:border-indigo-300 hover:shadow-md transition">
                                                    <button onClick={() => handleDeleteField(fIdx)} className="absolute top-3 right-3 text-gray-300 hover:text-red-500 transition">✖</button>
                                                    <div className="grid grid-cols-12 gap-4">
                                                        <div className="col-span-4">
                                                            <label className="text-[10px] text-gray-500 font-bold block mb-1">라벨 (제목)</label>
                                                            <input className="w-full bg-gray-50 border border-gray-300 rounded p-2 text-gray-800 text-sm outline-none focus:border-indigo-500" value={field.label} onChange={(e) => handleUpdateField(fIdx, 'label', e.target.value)} />
                                                        </div>
                                                        <div className="col-span-3">
                                                            <label className="text-[10px] text-gray-500 font-bold block mb-1">입력 타입</label>
                                                            <select className="w-full bg-gray-50 border border-gray-300 rounded p-2 text-gray-800 text-sm outline-none focus:border-indigo-500" value={field.type} onChange={(e) => handleUpdateField(fIdx, 'type', e.target.value)}>
                                                                <option value="text">텍스트 (한 줄)</option>
                                                                <option value="select">선택 박스 (Dropdown)</option>
                                                                <option value="radio">라디오 버튼 (택1)</option>
                                                                <option value="checkbox">체크 박스 (다중)</option>
                                                            </select>
                                                        </div>
                                                        <div className="col-span-5">
                                                            <label className="text-[10px] text-gray-500 font-bold block mb-1">옵션 (콤마 , 구분)</label>
                                                            <input disabled={field.type === 'text'} className={`w-full border rounded p-2 text-sm font-mono outline-none transition ${field.type === 'text' ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed' : 'bg-white border-gray-300 text-indigo-600 focus:border-indigo-500'}`} value={field.options || ''} onChange={(e) => handleUpdateField(fIdx, 'options', e.target.value)} placeholder={field.type === 'text' ? "텍스트 타입은 옵션 없음" : "예: 100M, 500M, 1G"} />
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                            {formTemplates[selectedTemplateIdx]?.fields.length === 0 && <div className="text-center text-gray-400 py-10 bg-gray-50 rounded-xl border border-dashed border-gray-300 text-sm">등록된 입력 항목이 없습니다. '+ 항목 추가'를 눌러 구성하세요.</div>}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {showUploadModal && <div className="fixed inset-0 bg-black/40 flex justify-center items-center backdrop-blur-sm z-50"><div className="bg-white p-8 rounded-2xl w-[600px] border border-gray-200 shadow-2xl animate-fade-in-up"><h2 className="text-2xl font-bold mb-4 text-indigo-900">📤 엑셀 복사 등록</h2><textarea placeholder="엑셀에서 복사한 내용을 붙여넣으세요... (이름 / 전화번호 / 플랫폼 / 메모)" className="w-full h-48 bg-gray-50 p-4 rounded-xl border border-gray-300 text-sm font-mono mb-6 text-gray-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition" value={pasteData} onChange={handlePaste} /><div className="flex justify-end gap-3"><button onClick={() => setShowUploadModal(false)} className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg font-bold transition">취소</button><button onClick={handleBulkSubmit} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-md transition">일괄 등록하기</button></div></div></div>}
        </div>
    );
}

export default AdminDashboard;
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

// ==================================================================================
// 3. 팝업 컴포넌트 (수정됨: 위치 기억 기능 추가)
// ==================================================================================
const PopoutWindow = ({ title, onClose, children, width = 600, height = 800, windowKey = 'default_popup_pos' }) => {
    const [containerEl, setContainerEl] = useState(null);
    const externalWindow = useRef(null);

    useEffect(() => {
        // 1. 저장된 위치 불러오기 (없으면 화면 중앙쯤 위치)
        const savedPos = localStorage.getItem(windowKey);
        let left = 200;
        let top = 100;

        if (savedPos) {
            try {
                const parsed = JSON.parse(savedPos);
                left = parsed.x;
                top = parsed.y;
            } catch (e) { }
        } else {
            // 처음 열 때 화면 중앙 정렬 계산
            left = (window.screen.width - width) / 2;
            top = (window.screen.height - height) / 2;
        }

        // 2. 윈도우 열기 (저장된 left, top 적용)
        if (!externalWindow.current || externalWindow.current.closed) {
            externalWindow.current = window.open(
                "",
                "",
                `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes`
            );
        }

        const win = externalWindow.current;

        if (!win) {
            alert("⚠️ 팝업이 차단되었습니다! 브라우저 주소창 우측의 팝업 차단을 해제해주세요.");
            if (onClose) onClose();
            return;
        }

        // 창 크기 강제 조정
        try {
            win.resizeTo(width, height);
        } catch (e) {
            console.error("Resizing blocked by browser", e);
        }

        // 3. HTML 구조 작성 (기존과 동일)
        try {
            win.document.open();
            win.document.write(`
                <!DOCTYPE html>
                <html lang="ko">
                <head>
                    <meta charset="utf-8" />
                    <title>${title || "관리자 팝업"}</title>
                    <style>
                        body { margin: 0; padding: 0; background-color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
                        #popout-root { height: 100vh; overflow: hidden; }
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

        // 스타일 복사 및 Tailwind 주입 (기존과 동일)
        document.querySelectorAll('link[rel="stylesheet"]').forEach(node => {
            win.document.head.appendChild(node.cloneNode(true));
        });
        document.querySelectorAll('style').forEach(node => {
            win.document.head.appendChild(node.cloneNode(true));
        });
        const script = win.document.createElement('script');
        script.src = "https://cdn.tailwindcss.com";
        win.document.head.appendChild(script);

        // 컨테이너 설정
        setTimeout(() => {
            const container = win.document.getElementById('popout-root');
            if (container) setContainerEl(container);
            else if (onClose) onClose();
        }, 100);

        // 4. [핵심] 윈도우 위치/상태 감시 및 저장
        const timer = setInterval(() => {
            if (win.closed) {
                clearInterval(timer);
                if (onClose) onClose();
            } else {
                // ⭐️ 현재 위치를 1초마다 저장 (창을 이동하면 자동 저장됨)
                // screenX, screenY는 모니터 기준 절대 좌표입니다.
                const currentPos = { x: win.screenX, y: win.screenY };
                localStorage.setItem(windowKey, JSON.stringify(currentPos));
            }
        }, 1000); // 1초마다 위치 확인

        return () => {
            clearInterval(timer);
            if (win && !win.closed) {
                win.close();
            }
        };
    }, []); // 의존성 배열 비움 (한 번만 실행)

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

    const [selectedImages, setSelectedImages] = useState([]); // 선택된 파일 배열
    const [previewUrls, setPreviewUrls] = useState([]);       // 미리보기 URL 배열
    const [isPolicyDragOver, setIsPolicyDragOver] = useState(false); // 드래그 상태

    const [focusedPolicyImage, setFocusedPolicyImage] = useState(null);

    const currentUserId = user ? String(user.user_id || user.id) : null;

    const [activeTab, setActiveTab] = useState('total_manage');
    const [periodFilter, setPeriodFilter] = useState('month');
    const [agents, setAgents] = useState([]);

    const [adChannels, setAdChannels] = useState([]);
    const [reasons, setReasons] = useState([]);
    const [customStatuses, setCustomStatuses] = useState([]);
    const [settlementStatuses, setSettlementStatuses] = useState([]);
    const [bankList, setBankList] = useState([]);

    const [clientList, setClientList] = useState([]); // 거래처 목록
    const [newClientInput, setNewClientInput] = useState(''); // 거래처 추가 입력
    const [clientFilter, setClientFilter] = useState('ALL'); // 정산 탭 필터링

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

    // 🟢 [신규] 건별 등록 제출 핸들러
    const handleSingleSubmit = async () => {
        // 1. 플랫폼 값 결정 (수동 모드면 수동 입력값, 아니면 선택값)
        const finalPlatform = singleData.isManual
            ? singleData.manualPlatform.trim()
            : singleData.platform;

        // 2. 유효성 검사
        if (!finalPlatform) return alert("통신사(플랫폼)를 선택하거나 입력해주세요.");
        if (!singleData.name.trim()) return alert("고객명을 입력해주세요.");
        if (!singleData.phone.trim()) return alert("연락처를 입력해주세요.");

        // 3. 전송할 데이터 구성
        const newCustomer = {
            owner_id: currentUserId, // 현재 로그인한 관리자 ID
            platform: finalPlatform, // ⭐️ 결정된 플랫폼 값 사용
            name: singleData.name,
            phone: singleData.phone,
            last_memo: singleData.memo,
            // 현재 보고 있는 탭에 따라 초기 상태 자동 설정
            status: activeTab === 'consult' ? '미통건' :
                activeTab === 'long_term' ? '장기가망' :
                    activeTab === 'reception' ? '접수완료' : '미통건',
            upload_date: new Date().toISOString().split('T')[0]
        };

        try {
            // 기존 일괄 등록 API를 재활용 (배열로 감싸서 전송)
            const res = await fetch(`${API_BASE}/api/customers/bulk_upload/`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ customers: [newCustomer] })
            });

            const data = await res.json();
            if (res.ok) {
                alert("✅ 등록되었습니다.");
                // 입력창 초기화 (플랫폼은 기본값 KT로 복귀)
                setSingleData({ platform: 'KT', manualPlatform: '', isManual: false, name: '', phone: '', memo: '' });
                loadCurrentTabData(); // 목록 새로고침
                // 연속 등록을 위해 모달은 닫지 않음 (원하면 setShowUploadModal(false) 추가)
            } else {
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

    const [newAgent, setNewAgent] = useState({ username: '', password: '' });
    const [newAdChannel, setNewAdChannel] = useState({ name: '', cost: '' });
    const [newReason, setNewReason] = useState('');
    const [newStatus, setNewStatus] = useState('');
    const [newSettlementStatus, setNewSettlementStatus] = useState('');

    const [dateFilter, setDateFilter] = useState({
        type: 'this_month',
        start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
        end: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0]
    });

    // 🟢 [신규] 접수 취소 사유 관리 State
    const [cancelReasons, setCancelReasons] = useState([]); // 서버에서 불러올 취소 사유 목록
    const [newCancelReason, setNewCancelReason] = useState(''); // 설정 탭 입력값

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

    const getAuthHeaders = useCallback(() => {
        const token = sessionStorage.getItem('token');
        return { 'Content-Type': 'application/json', 'Authorization': `Token ${token}` };
    }, []);

    // 🟢 [수정] fetchSettings 함수에 cancel_reasons 호출 추가
    const fetchSettings = useCallback(() => {
        const headers = getAuthHeaders();
        fetch(`${API_BASE}/api/ad_channels/`, { headers }).then(res => res.json()).then(setAdChannels).catch(() => setAdChannels([]));
        fetch(`${API_BASE}/api/failure_reasons/`, { headers }).then(res => res.json()).then(setReasons);

        // 👇 [추가됨] 접수 취소 사유 불러오기
        fetch(`${API_BASE}/api/cancel_reasons/`, { headers }).then(res => res.json()).then(setCancelReasons).catch(() => setCancelReasons([]));

        fetch(`${API_BASE}/api/custom_statuses/`, { headers }).then(res => res.json()).then(setCustomStatuses);
        fetch(`${API_BASE}/api/settlement_statuses/`, { headers }).then(res => res.json()).then(data => setSettlementStatuses(data.length ? data : []));
        fetch(`${API_BASE}/api/banks/`, { headers }).then(res => res.json()).then(setBankList).catch(() => setBankList([]));
        fetch(`${API_BASE}/api/clients/`, { headers })
            .then(res => res.json())
            .then(data => {
                // 서버 데이터 구조에 따라 매핑 (예: [{id:1, name:'농심'}, ...])
                // 편의상 이름만 추출해서 관리하거나 객체 그대로 쓸 수 있음. 여기선 이름 문자열 배열로 변환 예시
                const names = Array.isArray(data) ? data.map(c => c.name) : [];
                setClientList(names);
            })
            .catch(err => console.error(err));
        fetch(`${API_BASE}/api/clients/`, { headers })
            .then(res => res.json())
            .then(data => {
                // 백엔드에서 [{id:1, name:'농심'}, ...] 형태로 온다고 가정
                // 편의상 이름만 추출하여 리스트로 관리 (백엔드 Customer 모델이 CharField이므로)
                const names = Array.isArray(data) ? data.map(c => c.name) : [];
                setClientList(names);
            })
            .catch(err => console.error("거래처 로드 실패:", err));

    }, [getAuthHeaders]);

    // 🟢 [신규] 취소 사유 추가 핸들러
    const handleAddCancelReason = () => {
        if (!newCancelReason) return;
        fetch(`${API_BASE}/api/cancel_reasons/`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ reason: newCancelReason })
        }).then(() => {
            alert("완료");
            setNewCancelReason('');
            fetchSettings();
        });
    };


    // 🟢 [신규] 거래처 삭제 핸들러 (이름으로 삭제 가정, 실제론 ID로 하는게 좋음)
    const handleDeleteClient = (clientName) => {
        if (!window.confirm(`'${clientName}' 거래처를 삭제하시겠습니까?`)) return;

        // 편의상 리스트에서 이름에 해당하는 ID를 찾아 삭제 요청하는 로직 필요
        // 여기서는 UI 갱신 예시만 보여드림
        // 실제 구현: id 찾아서 DELETE /api/clients/{id}/
        alert("삭제 기능은 백엔드 ID 매핑이 필요합니다.");
    };

    // 🟢 [신규] 취소 사유 삭제 핸들러
    const handleDeleteCancelReason = (id) => {
        if (window.confirm("삭제하시겠습니까?")) {
            fetch(`${API_BASE}/api/cancel_reasons/${id}/`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            }).then(() => fetchSettings());
        }
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


    // -------------------------------------------------------------------------
    // 🖼️ [정책/공지] 이미지 다중 업로드 핸들러
    // -------------------------------------------------------------------------

    // 1. 파일 선택 및 미리보기 생성 (드래그 or 버튼 공용)
    const handlePolicyFileSelect = (files) => {
        if (!files || files.length === 0) return;

        const newFiles = Array.from(files);
        const newPreviews = newFiles.map(file => URL.createObjectURL(file));

        setSelectedImages(prev => [...prev, ...newFiles]);
        setPreviewUrls(prev => [...prev, ...newPreviews]);
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

    // 3. 미리보기에서 개별 삭제
    const handleRemovePolicyImage = (index) => {
        setSelectedImages(prev => prev.filter((_, i) => i !== index));
        setPreviewUrls(prev => prev.filter((_, i) => i !== index));
    };

    // 4. 서버로 일괄 전송
    const handleBulkImageUpload = async () => {
        if (selectedImages.length === 0) return alert("업로드할 이미지가 없습니다.");
        if (!window.confirm(`${selectedImages.length}장의 이미지를 업로드하시겠습니까?`)) return;

        try {
            // 여러 장을 순차적으로(혹은 병렬로) 업로드
            // 백엔드가 다중 파일을 한 번에 받지 않는다면 반복문 사용
            const uploadPromises = selectedImages.map(file => {
                const formData = new FormData();
                formData.append('platform', activePolicyTab);
                formData.append('image', file);

                return fetch(`${API_BASE}/api/policies/`, {
                    method: 'POST',
                    headers: { 'Authorization': `Token ${sessionStorage.getItem('token')}` },
                    body: formData
                });
            });

            await Promise.all(uploadPromises);

            alert("✅ 모든 이미지가 업로드되었습니다.");

            // 초기화 및 목록 갱신
            setSelectedImages([]);
            setPreviewUrls([]);
            fetchNoticesAndPolicies();
        } catch (e) {
            console.error(e);
            alert("일부 이미지 업로드 중 오류가 발생했습니다.");
        }
    };

    useEffect(() => {
        const handlePaste = (e) => {
            // 정책 탭이 아니거나 클립보드 데이터가 없으면 무시
            if (activeTab !== 'policy' || !e.clipboardData) return;

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
                        // 원본 파일 객체는 readOnly 속성이 있어 새 File 객체로 생성해주는 것이 안전함
                        const namedFile = new File([file], `paste_${timestamp}.png`, { type: file.type });
                        pastedFiles.push(namedFile);
                    }
                }
            }

            // 이미지가 발견되면 기존 업로드 로직 재사용
            if (pastedFiles.length > 0) {
                e.preventDefault(); // 브라우저 기본 붙여넣기 방지
                handlePolicyFileSelect(pastedFiles); // ⭐️ 기존 함수 호출
            }
        };

        // 탭이 'policy'일 때만 리스너 등록
        if (activeTab === 'policy') {
            window.addEventListener('paste', handlePaste);
        }

        // 뒷정리 (탭 이동 시 리스너 제거)
        return () => {
            window.removeEventListener('paste', handlePaste);
        };
    }, [activeTab, handlePolicyFileSelect]); // 의존성 배열

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
    const [isSending, setIsSending] = useState(false);
    const [chatInputNumber, setChatInputNumber] = useState('');

    const [showFailModal, setShowFailModal] = useState(false);
    const [failTarget, setFailTarget] = useState(null);
    const [selectedFailReason, setSelectedFailReason] = useState('');

    const [statPeriodType, setStatPeriodType] = useState('month');
    const [statDate, setStatDate] = useState(() => new Date().toISOString().substring(0, 7));
    const [statPlatform, setStatPlatform] = useState('ALL');
    const [selectedStatAgent, setSelectedStatAgent] = useState('ALL');
    const [serverStats, setServerStats] = useState(null);
    const [showCustomModal, setShowCustomModal] = useState(false);
    const [adSpend, setAdSpend] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortOrder, setSortOrder] = useState('desc');

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

    const [clientTemplates, setClientTemplates] = useState(() => {
        const saved = localStorage.getItem('admin_client_templates');
        return saved ? JSON.parse(saved) : {};
        // 예: { "농심본사": "■ 고객정보\n성명: {{NAME}}\n..." }
    });

    // ... 기존 State들 아래에 추가 ...

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
    useEffect(() => {
        setFocusedPolicyImage(null);
    }, [activePolicyTab, previewUrls]);


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

    // -------------------------------------------------------------------------
    // 🛠️ [AS 관리] 승인 워크플로우 핸들러
    // -------------------------------------------------------------------------

    // 1. AS 승인 (관리자 승인 → 수정 잠금)
    const handleApproveAS = async (customer) => {
        if (!window.confirm(`[${customer.name}] 님의 AS 요청을 승인하시겠습니까?\n승인 후에는 정보 수정이 제한됩니다.`)) return;

        try {
            // 로그 남기기
            await fetch(`${API_BASE}/api/customers/${customer.id}/add_log/`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ user_id: currentUserId, content: `[시스템] 관리자 AS 승인 완료 (상태 고정)` })
            });

            // 상태 변경 (AS승인)
            await handleInlineUpdate(customer.id, 'status', 'AS승인');
            alert("✅ AS 승인 처리되었습니다.");
        } catch (e) {
            alert("처리 중 오류가 발생했습니다.");
        }
    };

    // 2. AS 반려 (요청 거절 → 접수완료/설치완료 상태로 복귀)
    const handleRejectAS = async (customer) => {
        const reason = prompt("반려 사유를 입력해주세요:");
        if (!reason) return;

        try {
            await fetch(`${API_BASE}/api/customers/${customer.id}/add_log/`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ user_id: currentUserId, content: `[시스템] AS 요청 반려 (사유: ${reason})` })
            });

            // 원래 상태로 복구 (보통 설치완료 상태에서 AS가 발생하므로 설치완료로 되돌림, 상황에 따라 조정 가능)
            await handleInlineUpdate(customer.id, 'status', '설치완료');
            alert("반려되었습니다.");
        } catch (e) {
            alert("오류 발생");
        }
    };

    // 3. AS 승인 취소 (승인된 건을 다시 요청 상태로 되돌림 - 관리자 권한)
    const handleCancelASApproval = async (customer) => {
        if (!window.confirm("⚠️ 승인을 취소하고 다시 'AS요청' 상태로 되돌리시겠습니까?")) return;

        try {
            await fetch(`${API_BASE}/api/customers/${customer.id}/add_log/`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ user_id: currentUserId, content: `[시스템] 관리자가 AS 승인을 취소함` })
            });

            await handleInlineUpdate(customer.id, 'status', 'AS요청');
            alert("승인이 취소되었습니다.");
        } catch (e) {
            alert("오류 발생");
        }
    };


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
    const [chatFile, setChatFile] = useState(null); // 첨부된 파일

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
    const [assignedTasks, setAssignedTasks] = useState([]); // 서버에서 불러올 데이터
    const [taskInput, setTaskInput] = useState('');
    const [targetTaskAgent, setTargetTaskAgent] = useState(''); // 대상 직원 ID

    // 🟢 [API] 업무 지시 데이터 불러오기 (주기적으로 호출 필요)
    const fetchAssignedTasks = useCallback(async () => {
        try {
            // 백엔드 엔드포인트 예시: /api/todos/assigned/
            const res = await fetch(`${API_BASE}/api/todos/assigned/`, { headers: getAuthHeaders() });
            if (res.ok) {
                const data = await res.json();
                setAssignedTasks(data);
            }
        } catch (e) { console.error(e); }
    }, [getAuthHeaders]);

    // 탭이 'notepad'이고, 세부 탭이 'admin_assign'일 때 데이터 로드
    useEffect(() => {
        if (activeTab === 'notepad') {
            if (activeTodoTab === 'ADMIN_ASSIGN' || activeTodoTab === 'admin') {
                fetchAssignedTasks();
            }
        }
    }, [activeTab, activeTodoTab, fetchAssignedTasks]);

    // 🟢 [기능] 업무 지시 전송
    const handleAssignTask = async () => {
        if (!taskInput.trim() || !targetTaskAgent) return alert("내용과 직원을 선택해주세요.");
        if (!window.confirm("업무를 지시하시겠습니까?")) return;

        try {
            const res = await fetch(`${API_BASE}/api/todos/`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    content: taskInput,
                    assigned_to: targetTaskAgent === 'ALL' ? null : targetTaskAgent, // null이면 전체 공지
                    is_global: targetTaskAgent === 'ALL'
                })
            });
            if (res.ok) {
                alert("지시 완료");
                setTaskInput('');
                fetchAssignedTasks(); // 목록 갱신
            }
        } catch (e) { alert("전송 실패"); }
    };

    // 🟢 [기능] 지시 취소 (삭제)
    const handleDeleteAssignedTask = async (taskId) => {
        if (!window.confirm("지시를 취소(삭제)하시겠습니까?")) return;
        await fetch(`${API_BASE}/api/todos/${taskId}/`, { method: 'DELETE', headers: getAuthHeaders() });
        fetchAssignedTasks();
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

    // 칼럼 위로 지나갈 때 (시각적 효과용)
    const handleColDragOver = (e, idx) => {
        e.preventDefault();
        setOverColIdx(idx);
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
                        onChange={(e) => setDateFilter({ ...dateFilter, start: e.target.value })}
                    />
                    <span className="text-gray-400">~</span>
                    <input
                        type="date"
                        className="text-xs p-1 rounded border border-gray-300 outline-none bg-white"
                        value={dateFilter.end}
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
        let list = allCustomers; // 관리자는 allCustomers 사용
        if (chatListSearch) {
            const term = chatListSearch.toLowerCase();
            list = list.filter(c => (c.name && c.name.toLowerCase().includes(term)) || (c.phone && c.phone.includes(term)));
        }
        return list.sort((a, b) => new Date(b.upload_date) - new Date(a.upload_date));
    }, [allCustomers, chatListSearch]);

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

            // 🟢 [기존] 실패 사유 불러오기
            fetch(`${API_BASE}/api/cancel_reasons/`, { headers: getAuthHeaders() })
                .then(res => res.json())
                .then(data => setCancelReasons(Array.isArray(data) ? data : []))
                .catch(() => setCancelReasons([]));

            // 🟢 [추가/수정] 접수 취소 사유도 항상 불러오도록 추가 (이 부분이 없어서 연동이 안 된 것입니다)
            fetch(`${API_BASE}/api/cancel_reasons/`, { headers: getAuthHeaders() })
                .then(res => res.json())
                .then(setCancelReasons)
                .catch(() => setCancelReasons([]));

            if (activeTab === 'settlement') fetch(`${API_BASE}/api/settlement_statuses/`, { headers: getAuthHeaders() }).then(res => res.json()).then(setSettlementStatuses);

            // fetchSettings 내부에도 있지만, 탭이 다르면 실행되지 않으므로 위에서 따로 호출해주는 것이 안전합니다.
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

        // 공통 정렬
        if (activeTab !== 'consult' && activeTab !== 'long_term' && activeTab !== 'shared') {
            data.sort((a, b) => {
                const dateA = new Date(a.callback_schedule || a.upload_date || 0).getTime();
                const dateB = new Date(b.callback_schedule || b.upload_date || 0).getTime();
                return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
            });
        }

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

    // ... 기존 핸들러들 (handleAddReason, handleAddStatus 등) 근처에 추가 ...

    // 🟢 [추가] 거래처 추가 핸들러
    const handleAddClient = () => {
        if (!newClientInput.trim()) return;
        fetch(`${API_BASE}/api/clients/`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ name: newClientInput })
        }).then(res => {
            if (res.ok) {
                alert("✅ 거래처가 추가되었습니다.");
                setNewClientInput('');
                fetchSettings(); // 목록 갱신
            } else {
                alert("추가 실패 (중복된 이름일 수 있습니다)");
            }
        });
    };

    // 🟢 [수정됨] 일괄 등록 제출 (현재 탭에 따라 담당자/상태 자동 지정)
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


        // 🟢 [추가됨] 1. 가망등록(복사) 선택 시 로직 (설치완료 탭 전용)
        // 🟢 [수정됨] 가망등록(복사) 선택 시 로직
        if (newStatus === '가망등록') {
            const target = allCustomers.find(c => c.id === id);
            if (!target) return;

            if (!window.confirm(`[${target.name}] 님을 '내 가망관리' 탭으로 복사하시겠습니까?\n\n※ 기존 상담 이력을 모두 가져옵니다.`)) {
                return;
            }

            // 1. 기존 상담 이력(로그) 불러오기
            let combinedHistory = "";
            try {
                const logRes = await fetch(`${API_BASE}/api/customers/${target.id}/logs/`, {
                    headers: getAuthHeaders()
                });

                if (logRes.ok) {
                    const logs = await logRes.json();
                    // 로그를 텍스트로 변환 (최신순 or 과거순 정렬 후 합치기)
                    combinedHistory = logs
                        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at)) // 과거 -> 최신 순
                        .map(log => `[📅 ${new Date(log.created_at).toLocaleString()} / 👤 ${log.user_name || '시스템'}]\n${log.content}`)
                        .join('\n\n--------------------------------\n\n');
                }
            } catch (e) {
                console.error("히스토리 불러오기 실패", e);
                combinedHistory = "(히스토리 불러오기 실패)";
            }

            // 2. 저장할 최종 메모 구성
            // [현재 메모] + [구분선] + [과거 히스토리 전체] + [시스템 메시지]
            const systemMsg = `[시스템] 설치완료(ID:${target.id})에서 복사됨 - 이사/해지 후 신규가입 건`;

            const finalMemo =
                (target.last_memo ? `[마지막 메모]\n${target.last_memo}\n\n` : "") +
                `=========== 📜 과거 상담 이력 (ID:${target.id}) ===========\n\n` +
                combinedHistory +
                `\n\n===================================================\n\n` +
                systemMsg;

            // 3. 데이터 전송
            const newCustomerPayload = {
                customers: [{
                    name: target.name,
                    phone: target.phone,
                    platform: target.platform,
                    owner_id: currentUserId,
                    status: '장기가망',
                    upload_date: new Date().toISOString().split('T')[0],
                    last_memo: finalMemo // ⭐️ 여기에 합친 내용을 넣습니다.
                }]
            };

            try {
                const res = await fetch(`${API_BASE}/api/customers/bulk_upload/`, {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify(newCustomerPayload)
                });
                if (res.ok) {
                    alert("✅ 상담 이력과 함께 복사되었습니다.");
                    // loadCurrentTabData(); // 필요 시 주석 해제
                } else {
                    alert("오류가 발생했습니다.");
                }
            } catch (err) {
                console.error(err);
                alert("서버 통신 오류");
            }
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

    const handleConfirmCompletion = () => { if (!completionTarget) return; const finalProductInfo = `[${selectedPlatform}] ` + Object.entries(dynamicFormData).map(([k, v]) => `${k}:${v}`).join(', '); const payload = { status: '접수완료', platform: selectedPlatform, product_info: finalProductInfo, agent_policy: calculatedPolicy, installed_date: null }; fetch(`${API_BASE}/api/customers/${completionTarget.id}/`, { method: 'PATCH', headers: getAuthHeaders(), body: JSON.stringify(payload) }).then(() => { const logContent = `[시스템 자동접수]\n통신사: ${selectedPlatform}\n상품내역: ${finalProductInfo}\n예상 정책금: ${calculatedPolicy}만원`; return fetch(`${API_BASE}/api/customers/${completionTarget.id}/add_log/`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ user_id: user.user_id, content: logContent }) }); }).then(() => { alert("🎉 접수가 완료되었습니다!"); setShowCompletionModal(false); setCompletionTarget(null); loadCurrentTabData(); setActiveTab('reception'); }).catch(err => alert("오류 발생: " + err)); };
    const openMemoPopup = (e, customer, field) => { e.stopPropagation(); setMemoPopupTarget(customer); setMemoFieldType(field); setMemoPopupText(customer[field] || ''); };
    const saveMemoPopup = () => { if (!memoPopupTarget || !memoFieldType) return; handleInlineUpdate(memoPopupTarget.id, memoFieldType, memoPopupText); setMemoPopupTarget(null); };
    const handleResponse = (status) => { if (!requestTarget) return; setAllCustomers(prev => prev.map(c => c.id === requestTarget.id ? { ...c, request_status: status } : c)); fetch(`${API_BASE}/api/customers/${requestTarget.id}/`, { method: 'PATCH', headers: getAuthHeaders(), body: JSON.stringify({ request_status: status }) }).then(() => { alert("처리됨"); setShowResponseModal(false); setRequestTarget(null); }); };
    const handleResponseAction = (status) => { if (!responseTarget) return; setAllCustomers(prev => prev.map(c => c.id === responseTarget.id ? { ...c, request_status: status } : c)); fetch(`${API_BASE}/api/customers/${responseTarget.id}/`, { method: 'PATCH', headers: getAuthHeaders(), body: JSON.stringify({ request_status: status }) }).then(() => { alert("처리됨"); setShowResponseModal(false); setResponseTarget(null); }); };
    const enterChatRoom = (c) => { setChatTarget(c); setChatView('ROOM'); setChatMessages([]); fetchChatHistory(c.id); };
    const backToChatList = () => { setChatView('LIST'); setChatTarget(null); setChatMessages([]); };
    const handleOpenChat = (e, c) => { e.stopPropagation(); e.preventDefault(); setChatTarget(c); setChatView('ROOM'); setChatMessages([]); setIsChatOpen(true); fetchChatHistory(c.id); };
    // 🟢 [수정됨] 텍스트 + 이미지 전송 핸들러
    const handleSendManualChat = async (textToSend = null) => {
        const msg = textToSend || chatInput;

        // 1. 유효성 검사 수정: 텍스트가 없더라도 파일이 있으면 전송 허용
        if ((!msg?.trim() && !chatFile) || !chatTarget) return;

        setIsSending(true);

        try {
            // 2. FormData 객체 생성 (파일 전송을 위해 필수)
            const formData = new FormData();
            formData.append('customer_id', chatTarget.id);

            if (msg?.trim()) {
                formData.append('message', msg);
            }

            if (chatFile) {
                formData.append('image', chatFile); // ⭐️ 파일 추가
            }

            // 3. 헤더 설정 (FormData 전송 시 Content-Type은 브라우저가 자동 설정해야 함)
            const headers = getAuthHeaders();
            delete headers['Content-Type']; // 'application/json' 헤더 삭제

            const res = await fetch(`${API_BASE}/api/sales/manual-sms/`, {
                method: 'POST',
                headers: headers, // Content-Type이 제거된 헤더 사용
                body: formData    // JSON 문자열 대신 formData 전송
            });

            if (res.ok) {
                // 4. 성공 시 화면에 즉시 반영 (낙관적 업데이트)
                const newMsg = {
                    id: Date.now(),
                    sender: 'me',
                    text: msg,
                    // 방금 보낸 이미지 미리보기 생성
                    image: chatFile ? URL.createObjectURL(chatFile) : null,
                    created_at: '방금 전'
                };

                setChatMessages(prev => [...prev, newMsg]);

                // 입력창 및 파일 초기화
                if (!textToSend) setChatInput('');
                setChatFile(null);
            } else {
                alert("전송 실패: 서버 오류가 발생했습니다.");
            }
        } catch (e) {
            console.error(e);
            alert("오류가 발생했습니다.");
        } finally {
            setIsSending(false);
        }
    };
    const handleCreateAgent = () => { fetch(`${API_BASE}/api/agents/`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(newAgent) }).then(res => { if (res.ok) { alert("완료"); setNewAgent({ username: '', password: '' }); fetchAgents(); } else res.json().then(d => alert(d.message)); }); };
    const handleDeleteAgent = (id, name) => { if (window.confirm(`'${name}' 삭제?`)) fetch(`${API_BASE}/api/agents/${id}/`, { method: 'DELETE', headers: getAuthHeaders() }).then(() => { alert("삭제 완료"); fetchAgents(); }); };
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
    .sheet-table { border-collapse: collapse !important; table-layout: fixed; }
    .sheet-table th { 
        padding: 4px 6px !important; 
        font-size: 11px !important; 
        background-color: #f1f5f9 !important; /* 엑셀 헤더 색상 */
        border: 1px solid #e2e8f0 !important; 
        letter-spacing: -0.025em;
    }
    .sheet-table td { 
        padding: 2px 4px !important; 
        font-size: 12px !important; 
        border: 1px solid #e2e8f0 !important; 
        height: 30px !important; /* 칸 높이 축소 */
    }
    .sheet-input { 
        font-size: 12px !important; 
        padding: 2px !important; 
        border: none !important; 
        background: transparent;
    }
`}</style>
            <header className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm mb-6 border border-gray-200 sticky top-0 z-40">
                <h1 className="text-xl font-extrabold text-indigo-900 flex items-center gap-2">👑 관리자 대시보드</h1>

                <button
                    onClick={() => {
                        setViewerPlatform('KT'); // 열 때 기본값 KT로 초기화
                        setShowPolicyViewer(true);
                        fetchNoticesAndPolicies(); // 최신 이미지 데이터 갱신
                    }}
                    className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-sm"
                    title="새 창으로 정책표 열기"
                >
                    🖼️ 정책표 뷰어
                </button>

                {/* ... (헤더 내용은 동일) ... */}
                <div className="flex items-center gap-6">
                    <button
                        onClick={() => setIsTopStatsVisible(!isTopStatsVisible)}
                        className={`text-xs font-bold px-3 py-1.5 rounded-full border transition 
                        ${isTopStatsVisible ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-200'}`}
                    >
                        📊 현황판 {isTopStatsVisible ? 'ON' : 'OFF'}
                    </button>

                    {/* 🟢 [수정] 문자 전송 아이콘 */}
                    <div className="relative cursor-pointer" onClick={() => handleOpenChatGlobal()}>
                        <span className="text-2xl text-gray-400 hover:text-indigo-500 transition" title="문자 전송 및 목록">💬</span>
                    </div>

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

            {/* 탭 메뉴 + 검색창 영역 (수정됨: 스크롤 시 상단 고정 & 검색 버튼 추가) */}
            <div className="sticky top-[85px] z-30 bg-slate-50 pt-2 pb-1 flex justify-between items-end mb-4 border-b border-gray-200">

                {/* 1. 왼쪽: 탭 버튼들 */}
                <div className="flex gap-1 overflow-x-auto hide-scrollbar flex-nowrap w-full">
                    {[
                        { id: 'total_manage', label: '🗂️ 전체 DB' },
                        { id: 'shared', label: '🛒 미배정(공유)' },
                        { id: 'consult', label: '📞 상담' },
                        { id: 'long_term', label: '📅 가망' },
                        { id: 'reception', label: '📝 접수' },
                        { id: 'installation', label: '✅ 설치완료' },
                        { id: 'settlement', label: '💰 정산관리' },
                        { id: 'issue_manage', label: '🛠 AS/실패' },
                        { id: 'stats', label: '📊 통계' },
                        { id: 'users', label: '👥 상담사' },
                        { id: 'policy', label: '📢 정책/공지' },
                        { id: 'settings', label: '⚙️ 설정' },
                        { id: 'notepad', label: 'To-Do 리스트' },
                        { id: 'work_memo', label: '📒 메모장' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => { setActiveTab(tab.id); setStatusFilter('ALL'); }}
                            className={`px-4 py-2 rounded-t-lg text-[13px] font-bold transition whitespace-nowrap border-t border-l border-r 
                                ${activeTab === tab.id
                                    ? 'bg-white text-indigo-600 border-gray-200 border-b-white translate-y-[1px]'
                                    : 'bg-gray-100 text-gray-400 border-transparent hover:bg-gray-200'}`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {renderCommonControlPanel()}

            <div className="bg-white rounded-xl shadow-lg min-h-[600px] border border-gray-200 p-6 overflow-x-auto">
                {/* ⭐️ [신규] 정책/공지사항 탭 (다중 이미지 업로드 적용) */}
                {activeTab === 'policy' && (
                    <div className="flex gap-6 h-[750px] animate-fade-in">
                        
                        {/* 왼쪽: 공지사항 리스트 (기존 코드 유지) */}
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

                        {/* 오른쪽: 정책 이미지 관리 (업그레이드됨) */}
                        <div className="flex-1 flex flex-col h-full bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                            
                            {/* 1. 상단 탭 선택 */}
                            <div className="bg-white p-4 border-b border-gray-200 flex gap-2 overflow-x-auto hide-scrollbar">
                                {config.policy_tabs.map(p => (
                                    <button key={p} onClick={() => setActivePolicyTab(p)} className={`px-5 py-2 rounded-lg font-bold text-sm transition whitespace-nowrap ${activePolicyTab === p ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-gray-500 border border-gray-300 hover:bg-gray-100'}`}>
                                        {p} 정책
                                    </button>
                                ))}
                                <button onClick={handleAddCarrierTab} className="px-3 py-2 rounded-lg font-bold text-sm bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-300 whitespace-nowrap">+</button>
                            </div>

                            {/* 2. 드래그 앤 드롭 업로드 구역 */}
                            <div className="p-4 bg-gray-50 border-b border-gray-200">
                                <div 
                                    className={`relative w-full border-2 border-dashed rounded-xl transition-all duration-200 flex flex-col items-center justify-center p-4 
                                        ${isPolicyDragOver ? 'border-indigo-500 bg-indigo-50 scale-[1.01]' : 'border-gray-300 bg-white hover:border-indigo-300'}`}
                                    onDragOver={handlePolicyDragOver}
                                    onDragLeave={handlePolicyDragLeave}
                                    onDrop={handlePolicyDrop}
                                    style={{ minHeight: '120px' }}
                                >
                                    <input 
                                        type="file" 
                                        accept="image/*" 
                                        multiple // 다중 선택 가능
                                        id="policyMultiUpload" 
                                        className="hidden" 
                                        onChange={(e) => handlePolicyFileSelect(e.target.files)} 
                                    />

                                    {selectedImages.length === 0 ? (
                                        <label htmlFor="policyMultiUpload" className="flex flex-col items-center cursor-pointer w-full h-full justify-center">
                                            <span className="text-3xl mb-2 text-gray-300">📂</span>
                                            <span className="text-sm font-bold text-gray-600">이미지를 드래그하거나 클릭하여 추가하세요</span>
                                            <span className="text-xs text-gray-400 mt-1">여러 장 업로드 가능</span>
                                            <span className="text-xs text-indigo-500 mt-1 font-bold">또는 엑셀 차트/이미지를 복사 후 Ctrl+V 하세요</span>
                                        </label>
                                    ) : (
                                        <div className="w-full">
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-xs font-bold text-indigo-600">{selectedImages.length}장 선택됨</span>
                                                <div className="flex gap-2">
                                                    <label htmlFor="policyMultiUpload" className="text-xs bg-gray-100 px-2 py-1 rounded cursor-pointer hover:bg-gray-200 text-gray-600">추가</label>
                                                    <button onClick={() => { setSelectedImages([]); setPreviewUrls([]); }} className="text-xs text-red-400 hover:text-red-600">전체취소</button>
                                                </div>
                                            </div>
                                            
                                                {/* 미리보기 리스트 (가로 스크롤) */}
                                                <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
                                                    {previewUrls.map((url, idx) => (
                                                        <div key={idx} className="relative shrink-0 w-20 h-20 group cursor-pointer"> {/* cursor-pointer 추가 */}
                                                            <img
                                                                src={url}
                                                                alt="preview"
                                                                // 🟢 [수정] 클릭 시 해당 이미지를 크게 보기 설정
                                                                onClick={() => setFocusedPolicyImage(url)}
                                                                // 🟢 [수정] 선택된 이미지는 테두리 강조 (선택사항)
                                                                className={`w-full h-full object-cover rounded-lg shadow-sm transition-all ${focusedPolicyImage === url ? 'border-2 border-indigo-600 opacity-100' : 'border border-gray-200 hover:opacity-80'}`}
                                                            />
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation(); // 이미지 클릭 이벤트 전파 방지
                                                                    handleRemovePolicyImage(idx);
                                                                }}
                                                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs shadow-md opacity-80 group-hover:opacity-100 transition"
                                                            >
                                                                ×
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>

                                            <button 
                                                onClick={handleBulkImageUpload} 
                                                className="w-full mt-3 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg font-bold text-sm shadow-md transition"
                                            >
                                                🚀 선택한 이미지 업로드 ({activePolicyTab})
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* 3. 현재 등록된 정책 이미지 뷰어 */}
                            <div className="flex-1 bg-slate-100 p-6 flex flex-col items-center overflow-y-auto">
                                <h4 className="text-xs font-bold text-gray-400 mb-4 bg-white px-3 py-1 rounded-full shadow-sm">
                                    {focusedPolicyImage ? "🔍 선택된 이미지 미리보기" : "현재 등록된 최신 정책 이미지"}
                                </h4>

                                {/* 🟢 [수정] 선택된 이미지가 있으면 그걸 보여주고, 없으면 서버 이미지를 보여줌 */}
                                {(focusedPolicyImage || policyImages[activePolicyTab]) ? (
                                    <img
                                        src={focusedPolicyImage || policyImages[activePolicyTab]}
                                        alt={`${activePolicyTab} 정책`}
                                        className="max-w-full rounded-lg shadow-lg border border-gray-200 object-contain"
                                    />
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-gray-400">
                                        <p className="text-4xl mb-2">🖼️</p>
                                        <p>등록된 이미지가 없습니다.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* -------------------------------------------------------------------------------------- */}
                {/* 🛠 AS 및 실패/취소/해지 통합 관리 (4개 탭 구조) */}
                {/* -------------------------------------------------------------------------------------- */}
                {activeTab === 'issue_manage' && (
                    <div className="animate-fade-in flex flex-col h-[750px]">

                        {/* 1. 상단 헤더 (타이틀 + 날짜필터) */}
                        <div className="flex justify-between items-end mb-2 px-2">
                            <div>
                                <h2 className="text-xl font-extrabold flex items-center gap-2 text-gray-800">
                                    🛠 이슈 관리 센터
                                </h2>
                                <p className="text-xs text-gray-500 mt-1 ml-1">
                                    AS, 실패, 취소, 해지 건을 유형별로 분류하여 관리합니다.
                                </p>
                            </div>
                            <div className="flex gap-2 items-center">
                                {renderDateFilter()}
                            </div>
                        </div>

                        {/* 2. 폴더형 탭 버튼 영역 */}
                        <div className="flex items-end gap-1 border-b-2 border-indigo-600 px-2">
                            {[
                                { id: 'as', icon: '🆘', label: 'AS 요청/승인', count: allCustomers.filter(c => c.status === 'AS요청').length },
                                { id: 'fail', icon: '🚫', label: '실패 목록', count: allCustomers.filter(c => c.status === '실패').length },
                                { id: 'cancel', icon: '↩️', label: '접수 취소', count: allCustomers.filter(c => c.status === '접수취소').length },
                                { id: 'termination', icon: '📉', label: '해지 건', count: allCustomers.filter(c => ['해지', '해지진행'].includes(c.status)).length },
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setIssueSubTab(tab.id)}
                                    className={`relative px-5 py-3 rounded-t-xl text-sm font-bold transition-all border-t border-l border-r
                                        ${issueSubTab === tab.id
                                            ? 'bg-indigo-600 text-white border-indigo-600 translate-y-[2px] shadow-sm z-10'
                                            : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                                        }`}
                                >
                                    <span className="flex items-center gap-2">
                                        <span>{tab.icon}</span>
                                        <span>{tab.label}</span>
                                        {tab.count > 0 && (
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${issueSubTab === tab.id ? 'bg-white text-indigo-600' : 'bg-gray-200 text-gray-600'}`}>
                                                {tab.count}
                                            </span>
                                        )}
                                    </span>
                                </button>
                            ))}
                        </div>

                        {/* 3. 메인 데이터 테이블 영역 */}
                        <div className="flex-1 bg-white border border-t-0 border-gray-200 rounded-b-xl shadow-sm overflow-hidden flex flex-col p-4">

                            {/* 실패 탭일 때만 보이는 사유 필터 */}
                            {issueSubTab === 'fail' && (
                                <div className="flex justify-end mb-3">
                                    <select
                                        className="bg-gray-50 border border-gray-300 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-red-500"
                                        value={failReasonFilter}
                                        onChange={e => setFailReasonFilter(e.target.value)}
                                    >
                                        <option value="">🔍 전체 실패 사유 필터</option>
                                        {reasons.map(r => <option key={r.id} value={r.reason}>{r.reason}</option>)}
                                    </select>
                                </div>
                            )}

                            <div className="flex-1 overflow-auto custom-scrollbar border rounded-lg">
                                <table className="sheet-table w-full text-left">
                                    <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-xs tracking-wider border-b border-slate-200 sticky top-0 z-10">
                                        <tr>
                                            <th className="p-4 w-16 text-center">상태</th>
                                            <th className="p-4">접수일/담당자</th>
                                            <th className="p-4">고객 정보</th>
                                            <th className="p-4">통신사</th>
                                            <th className="p-4 w-1/3">
                                                {issueSubTab === 'fail' ? '실패 사유' :
                                                    issueSubTab === 'cancel' ? '취소 사유' :
                                                        issueSubTab === 'termination' ? '해지 사유/메모' :
                                                            'AS 요청 내용'}
                                            </th>
                                            <th className="p-4 w-48 text-center bg-slate-50">관리 (Action)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {displayedData.map(c => {
                                            const isLocked = c.status === 'AS승인'; // AS승인 건은 잠금

                                            return (
                                                <tr key={c.id} className={`transition duration-150 ${isLocked ? 'bg-gray-50/80' : 'hover:bg-indigo-50'}`}>

                                                    {/* 1. 상태 뱃지 */}
                                                    <td className="p-4 text-center align-top">
                                                        <span className={`px-2 py-1 rounded-md text-xs font-bold border block w-fit mx-auto ${getBadgeStyle(c.status)}`}>
                                                            {c.status}
                                                        </span>
                                                        {isLocked && <span className="text-[9px] text-gray-400 mt-1 block">🔒 잠김</span>}
                                                    </td>

                                                    {/* 2. 접수일/담당자 */}
                                                    <td className="p-4 align-top">
                                                        <div className="text-xs text-gray-500 font-mono mb-1">{c.upload_date}</div>
                                                        <div className="font-bold text-indigo-700 flex items-center gap-1">
                                                            👤 {getAgentName(c.owner)}
                                                        </div>
                                                    </td>

                                                    {/* 3. 고객 정보 */}
                                                    <td className="p-4 align-top">
                                                        <div className="flex flex-col gap-1">
                                                            {isLocked ? (
                                                                <>
                                                                    <span className="font-bold text-gray-800 text-base">{c.name}</span>
                                                                    <span className="text-sm text-gray-500 font-mono">{c.phone}</span>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <input type="text" className="font-bold text-gray-800 bg-transparent border-b border-dashed border-gray-300 focus:border-indigo-500 outline-none w-24" defaultValue={c.name} onBlur={(e) => handleInlineUpdate(c.id, 'name', e.target.value)} />
                                                                    <input type="text" className="text-sm text-gray-600 font-mono bg-transparent border-b border-dashed border-gray-300 focus:border-indigo-500 outline-none w-32" defaultValue={c.phone} onBlur={(e) => handleInlineUpdate(c.id, 'phone', e.target.value)} />
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>

                                                    {/* 4. 통신사 */}
                                                    <td className="p-4 align-top">
                                                        <span className="px-2 py-1 rounded bg-white border border-gray-200 text-xs font-bold text-gray-600 shadow-sm">{c.platform}</span>
                                                    </td>

                                                    {/* 5. 상세 내용 (사유/메모) */}
                                                    <td className="p-4 align-top">
                                                        {issueSubTab === 'fail' || issueSubTab === 'cancel' ? (
                                                            <div className="flex flex-col gap-1">
                                                                <span className="text-red-600 font-bold text-xs bg-red-50 px-2 py-0.5 rounded w-fit border border-red-100">
                                                                    {c.detail_reason || '사유 미지정'}
                                                                </span>
                                                                <p className="text-xs text-gray-600 line-clamp-2">{c.last_memo}</p>
                                                            </div>
                                                        ) : (
                                                            <textarea
                                                                className={`w-full bg-transparent resize-none text-sm outline-none leading-relaxed custom-scrollbar ${isLocked ? 'text-gray-500 cursor-not-allowed h-16' : 'border border-indigo-200 rounded-md p-2 focus:border-indigo-500 focus:bg-white h-20'}`}
                                                                readOnly={isLocked}
                                                                defaultValue={c.last_memo}
                                                                onBlur={(e) => !isLocked && handleInlineUpdate(c.id, 'last_memo', e.target.value)}
                                                                placeholder="내용이 없습니다."
                                                            />
                                                        )}
                                                    </td>

                                                    {/* 6. 관리 버튼 (탭별 기능) */}
                                                    <td className="p-4 align-middle text-center bg-slate-50 border-l border-slate-100">
                                                        <div className="flex flex-col items-center justify-center gap-2">

                                                            {/* [A] AS 탭 */}
                                                            {issueSubTab === 'as' && (
                                                                <>
                                                                    {c.status === 'AS요청' && (
                                                                        <>
                                                                            <button onClick={() => handleApproveAS(c)} className="w-full bg-green-600 text-white border border-green-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-green-700 shadow-sm">✅ 승인</button>
                                                                            <button onClick={() => handleRejectAS(c)} className="w-full bg-white text-gray-500 border border-gray-300 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-gray-100">반려</button>
                                                                        </>
                                                                    )}
                                                                    {c.status === 'AS승인' && (
                                                                        <button onClick={() => handleCancelASApproval(c)} className="w-full bg-white text-red-400 border border-red-200 px-3 py-1.5 rounded-lg text-[10px] font-bold hover:bg-red-50">↩️ 승인 취소</button>
                                                                    )}
                                                                </>
                                                            )}

                                                            {/* [B] 실패 탭 */}
                                                            {issueSubTab === 'fail' && (
                                                                <>
                                                                    <button onClick={() => handleRestoreCustomer(c.id)} className="w-full bg-blue-100 text-blue-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-200">↩️ 복구</button>
                                                                    <button onClick={() => handleDeleteCustomer(c.id)} className="w-full bg-white border border-red-200 text-red-500 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-50">🗑️ 삭제</button>
                                                                </>
                                                            )}

                                                            {/* [C] 접수 취소 탭 */}
                                                            {issueSubTab === 'cancel' && (
                                                                <>
                                                                    <button onClick={() => handleRestoreCustomer(c.id)} className="w-full bg-indigo-100 text-indigo-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-indigo-200">↩️ 재진행</button>
                                                                    <button onClick={() => handleDeleteCustomer(c.id)} className="w-full text-gray-400 hover:text-red-500 text-xs">영구 삭제</button>
                                                                </>
                                                            )}

                                                            {/* [D] 해지 탭 */}
                                                            {issueSubTab === 'termination' && (
                                                                <button onClick={() => handleRestoreCustomer(c.id)} className="w-full bg-white border border-gray-300 text-gray-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-gray-100">↩️ 상태 복구</button>
                                                            )}

                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {displayedData.length === 0 && (
                                            <tr>
                                                <td colSpan="6" className="p-20 text-center text-gray-400 bg-white">
                                                    <div className="text-4xl mb-2">📭</div>
                                                    <p>해당하는 데이터가 없습니다.</p>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

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

                {/* 1. [전체 DB 관리] - 좌우 분리형 상단 컨트롤 바 */}
                {activeTab === 'total_manage' && (
                    <div className="animate-fade-in h-full flex flex-col">

                        {/* (1) 타이틀 영역 */}
                        <div className="mb-2 shrink-0">
                            <h2 className="text-xl font-extrabold text-gray-800 flex items-center gap-2">
                                🗂️ 전체 DB 통합 관리
                            </h2>
                        </div>

                        {/* 🟢 [신규] 전체 DB 전용 운영 툴바 (정렬 / 날짜 / 배정) */}
                        <div className="flex flex-wrap justify-between items-center mb-3 bg-white p-2 rounded-lg border border-gray-100 shadow-sm">

                            {/* 왼쪽: 조회 옵션 (정렬 + 날짜) */}
                            <div className="flex gap-2 items-center">
                                {renderSortToggle()}
                                {renderDateFilter()}
                            </div>

                            {/* 오른쪽: 데이터 이동(배정) 기능 */}
                            <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-lg p-1.5">
                                <span className="text-[11px] text-indigo-800 font-bold px-1">⚡ 담당자 변경:</span>
                                <select
                                    className="bg-white border border-indigo-200 text-gray-700 text-xs rounded h-8 px-2 outline-none cursor-pointer font-bold focus:border-indigo-500"
                                    value={targetAgentId}
                                    onChange={e => setTargetAgentId(e.target.value)}
                                >
                                    <option value="">선택하세요...</option>
                                    {agents.map(a => <option key={a.id} value={a.id}>{a.username}</option>)}
                                </select>
                                <button
                                    onClick={() => handleAllocate(loadCurrentTabData)}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white h-8 px-3 rounded text-xs font-bold transition shadow-sm"
                                >
                                    실행
                                </button>
                            </div>
                        </div>

                        {/* (3) 테이블 영역 (기존의 Sticky Header/Column 유지) */}
                        <div className="flex-1 overflow-auto border border-gray-200 rounded-xl shadow-sm relative bg-white" style={{ maxHeight: 'calc(100vh - 220px)' }}>
                            <table className="sheet-table w-full text-left">
                                <thead className="bg-gray-100 text-gray-500 font-bold uppercase text-xs">
                                    <tr>
                                        {/* 1열: 체크박스 (좌측 상단 고정) */}
                                        <th className="p-3 w-10 text-center sticky top-0 left-0 z-30 bg-gray-100 border-b border-r border-gray-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                            <input type="checkbox" className="accent-indigo-600 cursor-pointer" onChange={(e) => handleSelectAll(e, displayedData)} checked={displayedData.length > 0 && selectedIds.length === displayedData.length} />
                                        </th>
                                        {/* 2열: 등록일 (상단 고정) */}
                                        <th className="p-3 sticky top-0 z-20 bg-gray-100 border-b border-gray-200 whitespace-nowrap">등록일</th>
                                        {/* 3열: 담당자 (상단 고정) */}
                                        <th className="p-3 text-indigo-600 sticky top-0 z-20 bg-gray-100 border-b border-gray-200 whitespace-nowrap">현재 담당자</th>
                                        {/* 4열: 고객명 (좌측 고정 - 체크박스 다음) */}
                                        <th className="p-3 sticky top-0 left-[40px] z-30 bg-gray-100 border-b border-r border-gray-200 whitespace-nowrap shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">고객명</th>

                                        {/* 나머지 열 (상단 고정만) */}
                                        <th className="p-3 sticky top-0 z-20 bg-gray-100 border-b border-gray-200 whitespace-nowrap">연락처</th>
                                        <th className="p-3 sticky top-0 z-20 bg-gray-100 border-b border-gray-200 whitespace-nowrap">플랫폼</th>
                                        <th className="p-3 sticky top-0 z-20 bg-gray-100 border-b border-gray-200 whitespace-nowrap">상태</th>
                                        <th className="p-3 text-center sticky top-0 z-20 bg-gray-100 border-b border-gray-200 whitespace-nowrap">확인요청</th>
                                        <th className="p-3 sticky top-0 z-20 bg-gray-100 border-b border-gray-200 whitespace-nowrap">관리</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 bg-white">
                                    {displayedData.map(c => (
                                        <tr key={c.id} className="h-12 hover:bg-indigo-50 transition duration-150 group">
                                            {/* 1열: 체크박스 (좌측 고정) */}
                                            <td className="p-3 text-center sticky left-0 z-10 bg-white group-hover:bg-indigo-50 border-r border-gray-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                                                <input type="checkbox" className="accent-indigo-600 cursor-pointer" checked={selectedIds.includes(c.id)} onChange={() => handleCheck(c.id)} />
                                            </td>
                                            {/* 2열: 등록일 */}
                                            <td className="p-3 text-gray-500 whitespace-nowrap font-mono text-xs">{c.upload_date}</td>
                                            {/* 3열: 담당자 */}
                                            <td className="p-3 font-bold text-indigo-600 whitespace-nowrap">{getAgentName(c.owner)}</td>
                                            {/* 4열: 고객명 (좌측 고정) */}
                                            <td className="p-3 font-bold text-gray-800 sticky left-[40px] z-10 bg-white group-hover:bg-indigo-50 border-r border-gray-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] whitespace-nowrap">
                                                {c.name}
                                            </td>

                                            {/* 나머지 데이터 */}
                                            <td className="p-3 text-gray-500 font-mono whitespace-nowrap text-xs">{c.phone}</td>
                                            <td className="p-3">
                                                <span className="bg-white border border-gray-200 px-2 py-1 rounded text-xs text-gray-600 font-medium shadow-sm whitespace-nowrap">{c.platform}</span>
                                            </td>
                                            <td className="p-3">
                                                <span className={`px-2 py-1 rounded text-xs font-bold border whitespace-nowrap ${getBadgeStyle(c.status)}`}>{c.status}</span>
                                            </td>
                                            <td className="p-3 text-center">
                                                {c.request_status === 'REQUESTED' ? (
                                                    <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full text-xs font-bold cursor-help border border-yellow-200 whitespace-nowrap" title={`요청내용: ${c.request_message}`}>⏳ 확인대기</span>
                                                ) : c.request_status === 'PROCESSING' ? (
                                                    <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs font-bold border border-blue-200 whitespace-nowrap">🚧 처리중</span>
                                                ) : c.request_status === 'COMPLETED' ? (
                                                    <button onClick={() => clearRequest(c.id)} className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-bold hover:bg-green-200 transition border border-green-200 whitespace-nowrap">✅ 처리완료</button>
                                                ) : (
                                                    <button onClick={() => openRequestModal(c)} className="text-gray-300 hover:text-indigo-500 transition text-lg transform hover:scale-110" title="확인 요청 보내기">🔔</button>
                                                )}
                                            </td>
                                            <td className="p-3">
                                                <button onClick={() => handleDeleteCustomer(c.id)} className="text-red-400 hover:text-red-600 font-bold text-xs border border-red-100 px-2 py-1 rounded hover:bg-red-50 transition whitespace-nowrap">삭제</button>
                                            </td>
                                        </tr>
                                    ))}
                                    {displayedData.length === 0 && (
                                        <tr><td colSpan="9" className="p-10 text-center text-gray-400 bg-white">데이터가 없습니다.</td></tr>
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
                                <button
                                    onClick={() => handleAllocate(loadCurrentTabData)}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white h-8 px-3 rounded text-xs font-bold transition shadow-sm"
                                >
                                    일괄 배정
                                </button>
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

                        {/* 🟢 [수정됨] 상담관리 테이블: 5개 컬럼 틀 고정 적용 */}
                        <div className="flex-1 overflow-auto border border-gray-200 rounded-xl shadow-sm relative bg-white" style={{ maxHeight: 'calc(100vh - 280px)' }}>
                            <table className="sheet-table w-full text-left">
                                <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-xs tracking-wider border-b border-slate-200 sticky top-0 z-50">
                                    <tr>
                                        {/* 1. 번호 (고정) */}
                                        <th className="px-4 py-3 w-14 text-center sticky left-0 z-50 bg-slate-100 border-r border-slate-200">No.</th>
                                        {/* 2. 플랫폼 (고정: 3.5rem) */}
                                        <th className="px-4 py-3 w-24 sticky left-14 z-50 bg-slate-100 border-r border-slate-200">플랫폼</th>
                                        {/* 3. 등록일 (고정: 3.5 + 6 = 9.5rem) */}
                                        <th className="px-4 py-3 w-28 sticky left-[9.5rem] z-50 bg-slate-100 border-r border-slate-200">등록일</th>
                                        {/* 4. 이름 (고정: 9.5 + 7 = 16.5rem) */}
                                        <th className="px-4 py-3 w-28 sticky left-[16.5rem] z-50 bg-slate-100 border-r border-slate-200">이름</th>
                                        {/* 5. 연락처 (고정: 16.5 + 7 = 23.5rem + 그림자) */}
                                        <th className="px-4 py-3 w-40 sticky left-[23.5rem] z-50 bg-slate-100 border-r border-slate-200 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.1)]">연락처</th>

                                        {/* --- 스크롤 영역 --- */}
                                        <th className="px-4 py-3 w-56 text-indigo-700">재통화(년/월/일/시)</th>
                                        <th className="px-4 py-3 w-28">상태</th>
                                        <th className="px-4 py-3">상담 메모</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm text-gray-700">
                                    {displayedData.map(c => {
                                        const scheduleDate = c.callback_schedule ? new Date(c.callback_schedule) : new Date();
                                        const currentH = isNaN(scheduleDate.getTime()) ? '' : scheduleDate.getHours();
                                        const checklistItems = parseChecklist(c.checklist);
                                        const isAlarmOn = checklistItems.includes('알림ON');

                                        return (
                                            <tr key={c.id} className="border-b border-slate-100 hover:bg-yellow-50 transition duration-150 group">
                                                {/* 1. 번호 */}
                                                <td className="px-4 py-3 text-center text-gray-400 sticky left-0 z-30 bg-white group-hover:bg-yellow-50 border-r border-slate-100">{c.id}</td>

                                                {/* 2. 플랫폼 */}
                                                <td className="px-4 py-3 sticky left-14 z-30 bg-white group-hover:bg-yellow-50 border-r border-slate-100">
                                                    <select
                                                        className="bg-transparent border border-transparent hover:border-gray-300 rounded text-xs px-1 py-1 outline-none cursor-pointer font-bold text-gray-700"
                                                        value={c.platform}
                                                        onChange={(e) => handleInlineUpdate(c.id, 'platform', e.target.value)}
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        {platformList.map(p => <option key={p} value={p}>{p}</option>)}
                                                    </select>
                                                </td>

                                                {/* 3. 등록일 */}
                                                <td className="px-4 py-3 text-gray-500 text-xs sticky left-[9.5rem] z-30 bg-white group-hover:bg-yellow-50 border-r border-slate-100">{c.upload_date}</td>

                                                {/* 4. 이름 */}
                                                <td className="px-4 py-3 font-bold sticky left-[16.5rem] z-30 bg-white group-hover:bg-yellow-50 border-r border-slate-100">
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="text"
                                                            className="bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-500 outline-none w-24 text-gray-800 font-bold transition"
                                                            defaultValue={c.name}
                                                            onBlur={(e) => handleInlineUpdate(c.id, 'name', e.target.value)}
                                                        />
                                                    </div>
                                                    <div className="mt-1">{renderInteractiveStars(c.id, c.rank)}</div>
                                                </td>

                                                {/* 5. 연락처 (마지막 고정열 - 그림자 추가) */}
                                                <td className="px-4 py-3 sticky left-[23.5rem] z-30 bg-white group-hover:bg-yellow-50 border-r border-slate-100 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.05)]">
                                                    <div>
                                                        <input
                                                            type="text"
                                                            className="bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-500 outline-none w-28 text-gray-600 font-mono text-xs transition"
                                                            defaultValue={c.phone}
                                                            onBlur={(e) => handleInlineUpdate(c.id, 'phone', e.target.value)}
                                                        />
                                                    </div>
                                                    <div className="mt-1">
                                                        <button onClick={(e) => handleOpenChat(e, c)} className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded border border-indigo-100 hover:bg-indigo-100 transition">💬 SMS전송</button>
                                                    </div>
                                                </td>

                                                {/* --- 스크롤 영역 --- */}
                                                <td className="px-4 py-3">
                                                    <div className="flex flex-col gap-1">
                                                        <input type="date" className="w-full bg-transparent text-gray-700 text-xs outline-none hover:text-indigo-600 cursor-pointer border-b border-gray-300 focus:border-indigo-500 text-center font-bold"
                                                            value={c.callback_schedule ? c.callback_schedule.split('T')[0] : ''}
                                                            onChange={(e) => {
                                                                const newDate = e.target.value;
                                                                const formattedH = String(currentH).padStart(2, '0');
                                                                if (newDate) handleInlineUpdate(c.id, 'callback_schedule', `${newDate}T${formattedH}:00:00`);
                                                            }}
                                                        />
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <select className="flex-1 border rounded text-xs p-1 text-center outline-none focus:border-indigo-500 cursor-pointer"
                                                                value={currentH}
                                                                onChange={(e) => {
                                                                    const newH = String(e.target.value).padStart(2, '0');
                                                                    const datePart = c.callback_schedule ? c.callback_schedule.split('T')[0] : new Date().toISOString().split('T')[0];
                                                                    handleInlineUpdate(c.id, 'callback_schedule', `${datePart}T${newH}:00:00`);
                                                                }}
                                                            >
                                                                <option value="" disabled>시간</option>
                                                                {TIME_OPTIONS.map(h => <option key={h} value={h}>{h}시</option>)}
                                                            </select>
                                                            <button onClick={(e) => handleToggleAlarm(e, c)} className={`text-[10px] px-2 py-1 rounded-full border transition-all ${isAlarmOn ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-400 border-gray-300'}`}>
                                                                {isAlarmOn ? <>🔔 알림중</> : <>🔕 (알림)</>}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </td>

                                                <td className="px-4 py-3">
                                                    <select className={`w-full p-2 rounded text-xs font-bold ${getBadgeStyle(c.status)}`} value={c.status} onChange={(e) => handleStatusChangeRequest(c.id, e.target.value)}>
                                                        {statusList.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                                    </select>
                                                </td>

                                                {/* 🟢 [수정됨] 상담 메모 셀: 초기 1줄 고정 + 내용에 맞춰 자동 조절 */}
                                                <td className="px-4 py-3 align-top">
                                                    {/* 부모 div에 h-8을 주어 테이블 행 높이를 유지합니다 */}
                                                    <div className="relative group w-full h-8">
                                                        <textarea
                                                            // 1. 스타일 변경: focus:min-h 삭제, focus:h-auto 추가
                                                            className="absolute top-0 left-0 w-full h-8 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-500 rounded p-1 text-sm transition-all resize-none leading-normal overflow-hidden whitespace-nowrap focus:whitespace-pre-wrap focus:bg-white focus:shadow-xl focus:z-50"
                                                            rows={1}
                                                            defaultValue={c.last_memo}

                                                            // 2. 포커스 시: 강제로 키우지 않고 '현재 텍스트 길이'만큼만 맞춤
                                                            onFocus={(e) => {
                                                                e.target.style.height = 'auto'; // 높이 초기화
                                                                e.target.style.height = (e.target.scrollHeight > 32 ? e.target.scrollHeight : 32) + 'px'; // 내용이 있으면 늘리고, 없으면 1줄 유지
                                                            }}

                                                            // 3. 입력 중: 내용이 늘어나면 높이도 따라 늘어남
                                                            onChange={(e) => {
                                                                e.target.style.height = 'auto';
                                                                e.target.style.height = e.target.scrollHeight + 'px';
                                                            }}

                                                            // 4. 포커스 해제(저장) 시: 1줄(32px)로 복귀 + 데이터 저장
                                                            onBlur={(e) => {
                                                                e.target.style.height = '2rem'; // h-8 = 2rem
                                                                handleInlineUpdate(c.id, 'last_memo', e.target.value);
                                                            }}

                                                            // 5. 키보드 이벤트 (Ctrl+Enter 줄바꿈 로직 포함)
                                                            onKeyDown={(e) => {
                                                                // (1) Ctrl + Enter: 줄바꿈 강제 삽입 및 높이 확장
                                                                if (e.key === 'Enter' && e.ctrlKey) {
                                                                    e.preventDefault();
                                                                    const val = e.target.value;
                                                                    const start = e.target.selectionStart;
                                                                    const end = e.target.selectionEnd;

                                                                    // 커서 위치에 줄바꿈 문자 삽입
                                                                    e.target.value = val.substring(0, start) + "\n" + val.substring(end);

                                                                    // 커서 위치 재설정
                                                                    e.target.selectionStart = e.target.selectionEnd = start + 1;

                                                                    // 높이 즉시 재계산 (확장)
                                                                    e.target.style.height = 'auto';
                                                                    e.target.style.height = e.target.scrollHeight + 'px';
                                                                    return;
                                                                }

                                                                // (2) 그냥 Enter: 저장 및 종료
                                                                handleMemoKeyDown(e, c.id, c.name);
                                                            }}

                                                            // 6. 히스토리 팝업
                                                            onDoubleClick={() => handleOpenHistory(c)}

                                                            placeholder="메모..."
                                                            title="더블클릭하여 히스토리 보기 (Ctrl+Enter: 줄바꿈)"
                                                        />
                                                        {/* 엔터 키 가이드 아이콘 */}
                                                        <span className="absolute right-1 top-2 text-[8px] text-gray-300 pointer-events-none group-focus-within:hidden">
                                                            ↵
                                                        </span>
                                                    </div>
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

                        {/* 🟢 (4) 가망관리 테이블 (기존 코드 유지) */}
                        <div className="flex-1 overflow-auto border border-gray-200 rounded-xl shadow-sm relative bg-white" style={{ maxHeight: 'calc(100vh - 280px)' }}>
                            <table className="sheet-table w-full text-left">
                                <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-xs tracking-wider border-b border-slate-200 sticky top-0 z-50">
                                    <tr>
                                        {/* 1. 번호 */}
                                        <th className="px-4 py-3 w-14 text-center sticky left-0 z-50 bg-slate-100 border-r border-slate-200">No.</th>
                                        {/* 2. 분류 */}
                                        <th className="px-4 py-3 w-24 sticky left-14 z-50 bg-slate-100 border-r border-slate-200">분류</th>
                                        {/* 3. 플랫폼 */}
                                        <th className="px-4 py-3 w-24 sticky left-[9.5rem] z-50 bg-slate-100 border-r border-slate-200">플랫폼</th>
                                        {/* 4. 등록일 */}
                                        <th className="px-4 py-3 w-28 sticky left-[15.5rem] z-50 bg-slate-100 border-r border-slate-200">등록일</th>
                                        {/* 5. 이름 */}
                                        <th className="px-4 py-3 w-28 sticky left-[22.5rem] z-50 bg-slate-100 border-r border-slate-200 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.1)]">이름</th>

                                        {/* --- 스크롤 영역 --- */}
                                        <th className="px-4 py-3 w-40">연락처</th>
                                        <th className="px-4 py-3 w-56 text-indigo-700">재통화(년/월/일/시)</th>
                                        <th className="px-4 py-3 w-28">상태</th>
                                        <th className="px-4 py-3">상담 메모</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm text-gray-700">
                                    {filteredLongTermData.map(c => {
                                        const scheduleDate = c.callback_schedule ? new Date(c.callback_schedule) : new Date();
                                        const currentH = isNaN(scheduleDate.getTime()) ? '' : scheduleDate.getHours();
                                        const checklistItems = parseChecklist(c.checklist);
                                        const isAlarmOn = checklistItems.includes('알림ON');
                                        const folderId = ltAssignments[c.id];
                                        const folderName = ltFolders.find(f => f.id === folderId)?.name || '미분류';

                                        return (
                                            <tr key={c.id} draggable={true} onDragStart={(e) => handleLtDragStart(e, c.id)}
                                                className="border-b border-slate-100 hover:bg-yellow-50 transition duration-150 cursor-grab active:cursor-grabbing group"
                                            >
                                                {/* 1. 번호 */}
                                                <td className="px-4 py-3 text-center text-gray-400 sticky left-0 z-30 bg-white group-hover:bg-yellow-50 border-r border-slate-100">{c.id}</td>

                                                {/* 2. 분류 */}
                                                <td className="px-4 py-3 sticky left-14 z-30 bg-white group-hover:bg-yellow-50 border-r border-slate-100">
                                                    <span className={`text-[10px] px-2 py-1 rounded border whitespace-nowrap ${folderId ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-gray-100 text-gray-500'}`}>
                                                        {folderId ? folderName : '미분류'}
                                                    </span>
                                                </td>

                                                {/* 3. 플랫폼 */}
                                                <td className="px-4 py-3 sticky left-[9.5rem] z-30 bg-white group-hover:bg-yellow-50 border-r border-slate-100">
                                                    <select className="bg-transparent border border-transparent hover:border-gray-300 rounded text-xs px-1 py-1 outline-none cursor-pointer font-bold text-gray-700"
                                                        value={c.platform} onChange={(e) => handleInlineUpdate(c.id, 'platform', e.target.value)} onClick={(e) => e.stopPropagation()}
                                                    >
                                                        {platformList.map(p => <option key={p} value={p}>{p}</option>)}
                                                    </select>
                                                </td>

                                                {/* 4. 등록일 */}
                                                <td className="px-4 py-3 text-gray-500 text-xs sticky left-[15.5rem] z-30 bg-white group-hover:bg-yellow-50 border-r border-slate-100">{c.upload_date}</td>

                                                {/* 5. 이름 */}
                                                <td className="px-4 py-3 font-bold sticky left-[22.5rem] z-30 bg-white group-hover:bg-yellow-50 border-r border-slate-100 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.05)]">
                                                    <input type="text" className="bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-500 outline-none w-24 text-gray-800 font-bold transition"
                                                        defaultValue={c.name} onBlur={(e) => handleInlineUpdate(c.id, 'name', e.target.value)} />
                                                    <div className="mt-1">{renderInteractiveStars(c.id, c.rank)}</div>
                                                </td>

                                                {/* --- 스크롤 영역 --- */}
                                                <td className="px-4 py-3">
                                                    <input type="text" className="bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-500 outline-none w-28 text-gray-600 font-mono text-xs transition"
                                                        defaultValue={c.phone} onBlur={(e) => handleInlineUpdate(c.id, 'phone', e.target.value)} />
                                                    <div className="mt-1">
                                                        <button onClick={(e) => handleOpenChat(e, c)} className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded border border-indigo-100 hover:bg-indigo-100 transition">💬 SMS전송</button>
                                                    </div>
                                                </td>

                                                <td className="px-4 py-3">
                                                    {/* 재통화 입력 로직 동일 */}
                                                    <div className="flex flex-col gap-1">
                                                        <input type="date" className="w-full bg-transparent text-gray-700 text-xs outline-none hover:text-indigo-600 cursor-pointer border-b border-gray-300 focus:border-indigo-500 text-center font-bold"
                                                            value={c.callback_schedule ? c.callback_schedule.split('T')[0] : ''}
                                                            onChange={(e) => {
                                                                const newDate = e.target.value;
                                                                const formattedH = String(currentH).padStart(2, '0');
                                                                if (newDate) handleInlineUpdate(c.id, 'callback_schedule', `${newDate}T${formattedH}:00:00`);
                                                            }}
                                                        />
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <select className="flex-1 border rounded text-xs p-1 text-center outline-none focus:border-indigo-500 cursor-pointer"
                                                                value={currentH}
                                                                onChange={(e) => {
                                                                    const newH = String(e.target.value).padStart(2, '0');
                                                                    const datePart = c.callback_schedule ? c.callback_schedule.split('T')[0] : new Date().toISOString().split('T')[0];
                                                                    handleInlineUpdate(c.id, 'callback_schedule', `${datePart}T${newH}:00:00`);
                                                                }}
                                                            >
                                                                <option value="" disabled>시간</option>
                                                                {TIME_OPTIONS.map(h => <option key={h} value={h}>{h}시</option>)}
                                                            </select>
                                                            <button onClick={(e) => handleToggleAlarm(e, c)} className={`text-[10px] px-2 py-1 rounded-full border transition-all ${isAlarmOn ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-400 border-gray-300'}`}>
                                                                {isAlarmOn ? <>🔔</> : <>🔕</>}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </td>

                                                <td className="px-4 py-3">
                                                    <select className={`w-full p-2 rounded text-xs font-bold ${getBadgeStyle(c.status)}`} value={c.status} onChange={(e) => handleStatusChangeRequest(c.id, e.target.value)}>
                                                        {statusList.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                                    </select>
                                                </td>

                                                <td className="px-4 py-3 align-top">
                                                    <div className="relative group w-full h-8">
                                                        <textarea
                                                            className="absolute top-0 left-0 w-full h-8 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-500 rounded p-1 text-sm transition-all resize-none leading-normal overflow-hidden whitespace-nowrap focus:whitespace-pre-wrap focus:bg-white focus:shadow-xl focus:z-50"
                                                            rows={1} defaultValue={c.last_memo}
                                                            onFocus={(e) => {
                                                                e.target.style.height = 'auto';
                                                                e.target.style.height = (e.target.scrollHeight > 32 ? e.target.scrollHeight : 32) + 'px';
                                                            }}
                                                            onChange={(e) => {
                                                                e.target.style.height = 'auto';
                                                                e.target.style.height = e.target.scrollHeight + 'px';
                                                            }}
                                                            onBlur={(e) => {
                                                                e.target.style.height = '2rem';
                                                                handleInlineUpdate(c.id, 'last_memo', e.target.value);
                                                            }}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter' && e.ctrlKey) {
                                                                    e.preventDefault();
                                                                    const val = e.target.value;
                                                                    const start = e.target.selectionStart;
                                                                    const end = e.target.selectionEnd;
                                                                    e.target.value = val.substring(0, start) + "\n" + val.substring(end);
                                                                    e.target.selectionStart = e.target.selectionEnd = start + 1;
                                                                    e.target.style.height = 'auto';
                                                                    e.target.style.height = e.target.scrollHeight + 'px';
                                                                    return;
                                                                }
                                                                handleMemoKeyDown(e, c.id, c.name);
                                                            }}
                                                            onDoubleClick={() => handleOpenHistory(c)}
                                                            placeholder="메모..."
                                                            title="더블클릭하여 히스토리 보기 (Ctrl+Enter: 줄바꿈)"
                                                        />
                                                        <span className="absolute right-1 top-2 text-[8px] text-gray-300 pointer-events-none group-focus-within:hidden">↵</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {filteredLongTermData.length === 0 && <tr><td colSpan="9" className="p-20 text-center text-gray-400">데이터가 없습니다.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}


                {/* ⭐️ [수정] 메모장 + 업무 지시 관리 기능 */}
                {activeTab === 'notepad' && (
                    <div className="flex h-full gap-6 animate-fade-in p-2">

                        {/* (Left) 카테고리 사이드바 */}
                        <div className="w-64 bg-white border border-gray-200 rounded-xl shadow-sm flex flex-col overflow-hidden shrink-0">
                            <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                                <h3 className="font-bold text-gray-700">📂 메뉴 선택</h3>
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                                {/* 1. 개인 업무 (기존 기능) */}
                                <div onClick={() => setActiveTodoTab('ALL')} className={`p-3 rounded-lg cursor-pointer flex justify-between items-center transition ${activeTodoTab === 'ALL' ? 'bg-indigo-100 text-indigo-700 font-bold' : 'hover:bg-gray-50 text-gray-600'}`}>
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

                                {/* 3. 관리자 업무 지시 메뉴 */}
                                <div onClick={() => setActiveTodoTab('ADMIN_ASSIGN')} className={`p-3 rounded-lg cursor-pointer flex justify-between items-center transition ${activeTodoTab === 'ADMIN_ASSIGN' ? 'bg-red-100 text-red-700 font-bold' : 'hover:bg-gray-50 text-gray-600'}`}>
                                    <span>📢 업무 지시 현황</span>
                                    <span className="text-xs bg-white px-2 py-0.5 rounded border border-gray-200 text-red-500">Admin</span>
                                </div>
                            </div>
                        </div>

                        {/* (Right) 컨텐츠 영역 */}
                        <div className="flex-1 bg-white border border-gray-200 rounded-xl shadow-sm flex flex-col overflow-hidden">

                            {/* [A] 업무 지시 모드 (관리자용) */}
                            {activeTodoTab === 'ADMIN_ASSIGN' ? (
                                <div className="flex flex-col h-full">
                                    {/* 상단: 지시 입력창 */}
                                    <div className="p-5 border-b border-gray-200 bg-red-50">
                                        <h3 className="font-bold text-red-800 mb-3 flex items-center gap-2">📢 직원 업무 지시 <span className="text-xs font-normal text-gray-500">(직원 화면에 즉시 노출됩니다)</span></h3>
                                        <div className="flex gap-2">
                                            <select className="bg-white border border-red-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-red-500 w-40" value={targetTaskAgent} onChange={e => setTargetTaskAgent(e.target.value)}>
                                                <option value="">대상 선택...</option>
                                                <option value="ALL">📢 전체 공지</option>
                                                {agents.map(a => <option key={a.id} value={a.id}>{a.username}</option>)}
                                            </select>
                                            <input
                                                className="flex-1 bg-white border border-red-200 rounded-lg px-4 py-2 text-sm outline-none focus:border-red-500"
                                                placeholder="지시할 업무 내용을 입력하세요..."
                                                value={taskInput} onChange={e => setTaskInput(e.target.value)}
                                            />
                                            <button onClick={handleAssignTask} className="bg-red-600 hover:bg-red-700 text-white px-6 rounded-lg font-bold text-sm shadow-sm transition">지시 보내기</button>
                                        </div>
                                    </div>

                                    {/* 하단: 직원별 현황판 */}
                                    <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
                                        <div className="grid grid-cols-3 gap-6">
                                            {/* 직원별 카드 생성 */}
                                            {agents.map(agent => {
                                                const agentTasks = assignedTasks.filter(t => {
                                                    const isAssignedToAgent = String(t.assigned_to) === String(agent.id);
                                                    const isGlobal = t.is_global === true;
                                                    return isAssignedToAgent || isGlobal;
                                                });

                                                return (
                                                    <div key={agent.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-80">
                                                        <div className="bg-gray-100 p-3 border-b border-gray-200 flex justify-between items-center">
                                                            <span className="font-bold text-gray-700 flex items-center gap-2">👤 {agent.username}</span>
                                                            <span className={`text-xs px-2 py-0.5 rounded border ${agentTasks.length > 0 ? 'bg-red-100 text-red-600 border-red-200' : 'bg-white text-gray-500'}`}>
                                                                {agentTasks.length}건
                                                            </span>
                                                        </div>
                                                        <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                                                            {agentTasks.length === 0 ? (
                                                                <div className="flex flex-col items-center justify-center h-full text-gray-300">
                                                                    <span className="text-2xl mb-1">✅</span>
                                                                    <span className="text-xs">대기중인 업무 없음</span>
                                                                </div>
                                                            ) : (
                                                                agentTasks.map(task => (
                                                                    <div key={task.id} className="text-sm bg-white border border-indigo-100 p-3 rounded-lg shadow-sm group relative hover:border-indigo-300 transition">
                                                                        <div className="flex justify-between items-start">
                                                                            <div className="flex-1">
                                                                                <div className="flex items-center gap-2 mb-1">
                                                                                    {task.is_global ? (
                                                                                        <span className="text-[10px] bg-red-100 text-red-600 px-1 rounded mr-1 font-bold">공지</span>
                                                                                    ) : (
                                                                                        <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-bold border border-blue-200">
                                                                                            To: {task.assigned_to_name || '직원'}
                                                                                        </span>
                                                                                    )}
                                                                                    <span className="text-[10px] text-gray-400">{task.created_at?.substring(0, 16)}</span>
                                                                                </div>
                                                                                <p className="text-gray-800 leading-snug font-medium">{task.content}</p>
                                                                            </div>
                                                                            <button
                                                                                onClick={() => handleDeleteAssignedTask(task.id)}
                                                                                className="text-gray-300 hover:text-red-500 text-xs ml-2 p-1"
                                                                                title="지시 취소(삭제)"
                                                                            >
                                                                                ✖
                                                                            </button>
                                                                        </div>
                                                                        <div className="mt-2 flex justify-end">
                                                                            {task.is_completed ? (
                                                                                <span className="text-[10px] text-green-600 font-bold">✅ 완료됨</span>
                                                                            ) : (
                                                                                <span className="text-[10px] text-red-400">⏳ 대기중</span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                ))
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                /* [B] 개인 To-Do List (Microsoft To Do 스타일 적용) */
                                <div className="flex flex-col h-full bg-white">

                                    {/* 1. 상단 타이틀 & 입력창 */}
                                    <div className="p-6 border-b border-gray-100 bg-white shrink-0">
                                        <div className="flex justify-between items-end mb-4">
                                            <div>
                                                <h2 className="text-2xl font-extrabold text-gray-800 flex items-center gap-2">
                                                    📅 오늘 할 일
                                                </h2>
                                                <p className="text-sm text-gray-500 mt-1">
                                                    {new Date().toLocaleDateString()} · {activeTodoTab === 'ALL' ? '전체 보기' : todoTabs.find(t => t.id === activeTodoTab)?.name}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-xl border border-gray-200 shadow-sm focus-within:ring-2 focus-within:ring-indigo-100 transition">
                                            <span className="text-gray-400 pl-2">➕</span>
                                            <input
                                                type="text"
                                                className="flex-1 bg-transparent text-sm font-medium text-gray-800 outline-none placeholder-gray-400"
                                                placeholder="작업 추가 (Enter로 입력)"
                                                value={newTodoInput}
                                                onChange={(e) => setNewTodoInput(e.target.value)}
                                                onKeyPress={(e) => e.key === 'Enter' && handleAddTodo()}
                                            />
                                            <button
                                                onClick={handleAddTodo}
                                                className="bg-white text-indigo-600 border border-gray-200 hover:bg-indigo-50 px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-sm"
                                            >
                                                추가
                                            </button>
                                        </div>
                                    </div>

                                    {/* 2. 리스트 영역 (할 일 / 완료됨 분리) */}
                                    <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-6">

                                        {/* 데이터 필터링 및 렌더링 */}
                                        {(() => {
                                            const currentTodos = todos.filter(t => activeTodoTab === 'ALL' ? true : t.tabId === activeTodoTab);
                                            // 할 일 (최신순)
                                            const activeList = currentTodos.filter(t => !t.done).sort((a, b) => b.id - a.id);
                                            // 완료된 일 (최신순)
                                            const doneList = currentTodos.filter(t => t.done).sort((a, b) => b.id - a.id);

                                            return (
                                                <>
                                                    {/* [A] 진행 중인 작업 */}
                                                    <div className="space-y-2">
                                                        {activeList.length === 0 && doneList.length === 0 && (
                                                            <div className="text-center py-20 text-gray-300">
                                                                <div className="text-5xl mb-3">🏖️</div>
                                                                <p>등록된 할 일이 없습니다.</p>
                                                            </div>
                                                        )}

                                                        {activeList.map(todo => (
                                                            <div
                                                                key={todo.id}
                                                                draggable={true}
                                                                onDragStart={(e) => handleDragStart(e, todo.id)}
                                                                className="group flex items-center gap-3 p-3.5 bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-indigo-300 cursor-grab active:cursor-grabbing transition-all"
                                                            >
                                                                {/* 체크박스 (빈 동그라미) */}
                                                                <div
                                                                    onClick={() => handleToggleTodo(todo.id)}
                                                                    className="w-5 h-5 rounded-full border-2 border-gray-300 cursor-pointer hover:border-indigo-500 hover:bg-indigo-50 transition flex-shrink-0"
                                                                ></div>

                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-sm font-bold text-gray-800 truncate">{todo.text}</p>
                                                                    <div className="flex gap-2 mt-0.5">
                                                                        <span className="text-[10px] text-gray-400">{todo.created_at}</span>
                                                                        {activeTodoTab === 'ALL' && (
                                                                            <span className="text-[10px] bg-gray-100 px-1.5 rounded text-gray-500">
                                                                                📁 {todoTabs.find(tab => tab.id === todo.tabId)?.name}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                <button
                                                                    onClick={() => handleDeleteTodo(todo.id)}
                                                                    className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition px-2"
                                                                    title="삭제"
                                                                >
                                                                    🗑️
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>

                                                    {/* [B] 완료됨 섹션 */}
                                                    {doneList.length > 0 && (
                                                        <div className="mt-6">
                                                            <h4 className="text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider flex items-center gap-2">
                                                                <span>완료됨 ({doneList.length})</span>
                                                                <div className="h-px bg-gray-200 flex-1"></div>
                                                            </h4>
                                                            <div className="space-y-1 opacity-70 hover:opacity-100 transition duration-300">
                                                                {doneList.map(todo => (
                                                                    <div
                                                                        key={todo.id}
                                                                        className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-transparent hover:bg-white hover:border-gray-200 transition"
                                                                    >
                                                                        {/* 체크된 상태 아이콘 (채워진 동그라미) */}
                                                                        <div
                                                                            onClick={() => handleToggleTodo(todo.id)}
                                                                            className="w-5 h-5 rounded-full bg-indigo-500 border-2 border-indigo-500 cursor-pointer flex items-center justify-center text-white text-xs flex-shrink-0"
                                                                        >
                                                                            ✓
                                                                        </div>

                                                                        <div className="flex-1 min-w-0">
                                                                            <p className="text-sm text-gray-400 line-through decoration-gray-400 truncate">
                                                                                {todo.text}
                                                                            </p>
                                                                        </div>

                                                                        <button
                                                                            onClick={() => handleDeleteTodo(todo.id)}
                                                                            className="text-gray-300 hover:text-red-500 text-xs transition px-2"
                                                                        >
                                                                            ✕
                                                                        </button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </>
                                            );
                                        })()}
                                    </div>
                                </div>
                            )}
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

                            {/* 테이블 구역 */}
                            <div className="flex-1 overflow-auto border-t border-gray-100 relative bg-white">
                                <table className="sheet-table w-full text-left table-fixed"> {/* table-fixed로 너비 고정 */}
                                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[11px] tracking-tight border-b border-slate-200 sticky top-0 z-10">
                                        <tr>
                                            <th className="p-2 w-[80px] text-right bg-indigo-50/50">순수익</th>
                                            <th className="p-2 w-[90px]">플랫폼</th>
                                            <th className="p-2 w-[100px]">접수일</th>
                                            <th className="p-2 w-[110px]">설치일</th>
                                            <th className="p-2 w-[90px]">고객명</th>
                                            <th className="p-2 w-[120px]">연락처</th>
                                            <th className="p-2 w-[65px] text-center">정책</th>
                                            <th className="p-2 w-[65px] text-center">지원</th>
                                            <th className="p-2 w-[50px] text-center">체크</th>
                                            <th className="p-2 w-[110px] text-center">상태</th>
                                            <th className="p-2 min-w-[300px]">후처리 메모 (누락방지 기록)</th> {/* 메모 영역 확장 */}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
    {displayedData.map(c => {
        // 1️⃣ 변수 선언 (에러 방지를 위해 반드시 최상단에 배치)
        const checklistItems = parseChecklist(c.checklist);
        const isPostProcessed = checklistItems.includes('후처리완료');
        
        const agentPolicy = safeParseInt(c.agent_policy);
        const supportAmt = safeParseInt(c.support_amt);
        const netProfit = agentPolicy - supportAmt;

        // 후처리 체크박스 토글 함수
        const togglePostProcess = (e) => {
            e.stopPropagation();
            const newList = isPostProcessed
                ? checklistItems.filter(item => item !== '후처리완료')
                : [...checklistItems, '후처리완료'];
            handleInlineUpdate(c.id, 'checklist', newList.join(','));
        };

        return (
            <tr key={c.id} className={`hover:bg-indigo-50/30 transition-colors ${isPostProcessed ? 'bg-gray-50' : ''}`}>
                
                {/* 1. 매출 (만 단위 표시) */}
                <td className={`p-2 text-right font-black border-r border-gray-50 ${netProfit >= 0 ? 'text-blue-600' : 'text-red-500'}`}>
                    {netProfit}만
                </td>

                {/* 2. 플랫폼 */}
                <td className="p-2">
                    <select className="w-full bg-transparent text-xs font-bold text-gray-600 outline-none cursor-pointer" value={c.platform} onChange={(e) => handleInlineUpdate(c.id, 'platform', e.target.value)}>
                        {platformList.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                </td>

                {/* 3. 접수일 (글자 크기 축소) */}
                <td className="p-2 text-[10px] text-gray-400 font-mono">{c.upload_date?.substring(2)}</td>

                {/* 4. 설치일 */}
                <td className="p-2">
                    <input type="date" className="w-full bg-transparent text-[11px] outline-none border-b border-transparent hover:border-gray-300 focus:border-indigo-500" 
                        value={c.installed_date || ''} onChange={(e) => handleInlineUpdate(c.id, 'installed_date', e.target.value)} />
                </td>

                {/* 5. 고객명 (너비 고정) */}
                <td className="p-2 font-bold text-gray-800 truncate text-xs">{c.name}</td>

                {/* 6. 연락처 + 💬 SMS 전송 버튼 (부활) */}
                <td className="p-2">
                    <div className="flex flex-col gap-1">
                        <span className="text-xs text-gray-500 font-mono tracking-tighter">{c.phone}</span>
                        <button 
                            onClick={(e) => handleOpenChat(e, c)} 
                            className="text-[9px] bg-white border border-gray-200 px-1.5 py-0.5 rounded hover:bg-indigo-50 hover:text-indigo-600 transition w-fit shadow-sm"
                        >
                            💬 SMS전송
                        </button>
                    </div>
                </td>
                
                {/* 7. 정책/지원금 (수정 가능 인풋) */}
                <td className="p-1">
                    <input type="number" className="w-full text-center bg-transparent text-xs font-bold text-indigo-600 outline-none border-b border-transparent hover:border-indigo-300 focus:border-indigo-500 no-spin" 
                        defaultValue={c.agent_policy} onBlur={(e) => handleInlineUpdate(c.id, 'agent_policy', e.target.value)} />
                </td>
                <td className="p-1">
                    <input type="number" className="w-full text-center bg-transparent text-xs font-bold text-red-500 outline-none border-b border-transparent hover:border-red-300 focus:border-red-500 no-spin" 
                        defaultValue={c.support_amt} onBlur={(e) => handleInlineUpdate(c.id, 'support_amt', e.target.value)} />
                </td>

                {/* 8. 후처리 체크박스 (작게 조정) */}
                <td className="p-2 text-center border-l border-gray-50">
                    <input 
                        type="checkbox" 
                        className="w-4 h-4 accent-green-600 cursor-pointer" 
                        checked={isPostProcessed} 
                        onChange={togglePostProcess} 
                    />
                </td>

                {/* 9. 상태 선택 */}
                <td className="p-2">
                    <select className={`w-full p-1 rounded text-[10px] font-bold outline-none border border-gray-100 ${getBadgeStyle(c.status)}`} value={c.status} onChange={(e) => handleStatusChangeRequest(c.id, e.target.value)}>
                        {receptionList.map(status => <option key={status} value={status}>{status}</option>)}
                    </select>
                </td>

                {/* 10. 후처리 메모 (너비 확장 및 완료 시 취소선) */}
                <td className="p-2 align-top">
                    <div className="relative group w-full h-7">
                        <textarea
                            className={`absolute top-0 left-0 w-full h-7 bg-transparent border-b border-transparent hover:border-gray-200 focus:border-indigo-400 rounded px-1 text-xs transition-all resize-none leading-normal overflow-hidden whitespace-nowrap focus:whitespace-pre-wrap focus:bg-white focus:shadow-xl focus:z-50 ${isPostProcessed ? 'text-gray-400 line-through italic' : 'text-gray-700'}`}
                            rows={1}
                            defaultValue={c.last_memo}
                            onFocus={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                            onBlur={(e) => { e.target.style.height = '1.75rem'; handleInlineUpdate(c.id, 'last_memo', e.target.value); }}
                            onDoubleClick={() => handleOpenHistory(c)}
                            placeholder="후처리 내용..."
                        />
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

                            {/* (3) 테이블 영역 */}
                            <div className="flex-1 overflow-auto border border-gray-200 rounded-xl shadow-sm relative bg-white" style={{ maxHeight: 'calc(100vh - 280px)' }}>
                                <table className="sheet-table w-full text-left">
                                    {/* 1. 테이블 헤더 */}
                                    <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-xs tracking-wider border-b border-slate-200 sticky top-0 z-10">
                                        <tr>
                                            <th className="px-4 py-3 bg-indigo-50 text-indigo-700 text-right">매출 (순수익)</th>
                                            <th className="px-4 py-3">플랫폼</th>
                                            <th className="px-4 py-3">접수일</th>
                                            <th className="px-4 py-3">설치일</th>
                                            <th className="px-4 py-3">고객명</th>
                                            <th className="px-4 py-3">연락처</th>
                                            <th className="px-4 py-3 text-right">정책(만)</th>
                                            <th className="px-4 py-3 text-right">지원금(만)</th>
                                            <th className="px-4 py-3">상태</th>
                                            <th className="px-4 py-3">후처리(메모)</th>
                                        </tr>
                                    </thead>

                                    <tbody className="divide-y divide-gray-100">
                                        {displayedData.map(c => {
                                            // 1. 매출 계산
                                            const policy = safeParseInt(c.agent_policy);
                                            const support = safeParseInt(c.support_amt);
                                            let revenue = (policy - support) * 10000;

                                            // 2. 체크리스트 (환수 여부 확인)
                                            const currentChecklist = parseChecklist(c.checklist);
                                            const isRefunded = currentChecklist.includes('환수완료');

                                            // 3. 해지진행 상태 로직 (매출 계산)
                                            if (c.status === '해지진행') {
                                                if (c.installed_date) {
                                                    const installDate = new Date(c.installed_date);
                                                    const today = new Date();
                                                    const isSameMonth =
                                                        installDate.getFullYear() === today.getFullYear() &&
                                                        installDate.getMonth() === today.getMonth();

                                                    if (isSameMonth) revenue = 0; // 당월 해지
                                                    else revenue = -Math.abs(revenue); // 익월 이후 해지
                                                } else {
                                                    revenue = 0;
                                                }
                                            }

                                            // 환수 상태 토글 함수
                                            const toggleRefundStatus = () => {
                                                const newChecklist = isRefunded
                                                    ? currentChecklist.filter(item => item !== '환수완료')
                                                    : [...currentChecklist, '환수완료'];
                                                handleInlineUpdate(c.id, 'checklist', newChecklist.join(','));
                                            };

                                            return (
                                                <tr key={c.id} className="hover:bg-green-50 transition duration-150">

                                                    {/* 1. 매출 */}
                                                    <td className={`px-4 py-3 text-right font-extrabold bg-indigo-50/30 border-r border-gray-100
                    ${revenue > 0 ? 'text-blue-600' : revenue < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                                                        {formatCurrency(revenue)}원
                                                    </td>

                                                    {/* 2. 플랫폼 */}
                                                    <td className="px-4 py-3">
                                                        <select
                                                            className="bg-transparent border-b border-transparent hover:border-gray-300 rounded px-1 py-1 outline-none cursor-pointer font-bold text-gray-700 text-xs"
                                                            value={c.platform}
                                                            onChange={(e) => handleInlineUpdate(c.id, 'platform', e.target.value)}
                                                        >
                                                            {platformList.map(p => <option key={p} value={p}>{p}</option>)}
                                                        </select>
                                                    </td>

                                                    {/* 3. 접수일 */}
                                                    <td className="px-4 py-3 text-gray-500 text-xs font-mono">{c.upload_date}</td>

                                                    {/* 4. 설치일 */}
                                                    <td className="px-4 py-3">
                                                        <input
                                                            type="date"
                                                            className="bg-transparent text-gray-800 font-bold text-xs outline-none border-b border-gray-200 hover:border-gray-400 focus:border-indigo-500 cursor-pointer w-24"
                                                            value={c.installed_date || ''}
                                                            onChange={(e) => handleInlineUpdate(c.id, 'installed_date', e.target.value)}
                                                        />
                                                    </td>

                                                    {/* 5. 고객명 */}
                                                    <td className="px-4 py-3">
                                                        <input
                                                            type="text"
                                                            className="bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-500 outline-none w-16 font-bold text-gray-800 transition"
                                                            defaultValue={c.name}
                                                            onBlur={(e) => handleInlineUpdate(c.id, 'name', e.target.value)}
                                                        />
                                                    </td>

                                                    {/* 6. 연락처 */}
                                                    <td className="px-4 py-3">
                                                        <input
                                                            type="text"
                                                            className="bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-500 outline-none w-28 text-gray-600 font-mono text-xs transition"
                                                            defaultValue={c.phone}
                                                            onBlur={(e) => handleInlineUpdate(c.id, 'phone', e.target.value)}
                                                        />
                                                        <div className="mt-1">
                                                            <button onClick={(e) => handleOpenChat(e, c)} className="text-[10px] bg-white border border-gray-200 px-2 py-0.5 rounded hover:bg-gray-50 transition flex items-center gap-1 w-fit">💬 SMS</button>
                                                        </div>
                                                    </td>

                                                    {/* 7. 정책 */}
                                                    <td className="px-4 py-3 text-right">
                                                        <input type="number" className="w-12 bg-transparent text-right outline-none border-b border-gray-200 focus:border-indigo-500 font-bold text-indigo-600 no-spin" defaultValue={c.agent_policy} onBlur={(e) => handleInlineUpdate(c.id, 'agent_policy', e.target.value)} />
                                                    </td>

                                                    {/* 8. 지원금 */}
                                                    <td className="px-4 py-3 text-right">
                                                        <input type="number" className="w-12 bg-transparent text-right outline-none border-b border-gray-200 focus:border-indigo-500 font-bold text-red-500 no-spin" defaultValue={c.support_amt} onBlur={(e) => handleInlineUpdate(c.id, 'support_amt', e.target.value)} />
                                                    </td>

                                                    {/* 9. 상태 (환수 관리 + 🟢 가망복사 옵션 추가) */}
                                                    <td className="px-4 py-3 align-top">
                                                        <div className="flex flex-col gap-1.5">
                                                            <select
                                                                className={`w-28 p-1.5 rounded text-xs font-bold outline-none border border-gray-200 cursor-pointer ${getBadgeStyle(c.status)}`}
                                                                value={c.status}
                                                                onChange={(e) => handleStatusChangeRequest(c.id, e.target.value)}
                                                            >
                                                                {/* 기존 설치/해지 상태들 */}
                                                                {installList.map(status => (
                                                                    <option key={status} value={status}>
                                                                        {status === '설치완료' ? '✅ 설치완료' :
                                                                            status === '해지진행' ? '⚠️ 해지진행' : status}
                                                                    </option>
                                                                ))}
                                                                {/* 🟢 구분선 및 가망등록 옵션 추가 */}
                                                                <optgroup label="데이터 이동">
                                                                    <option value="가망등록">⚡ 가망등록 (복사)</option>
                                                                </optgroup>
                                                            </select>

                                                            {/* 해지진행일 때: 환수 관리 버튼 */}
                                                            {c.status === '해지진행' && (
                                                                <button
                                                                    onClick={toggleRefundStatus}
                                                                    className={`w-28 py-1 rounded text-[10px] font-bold border transition flex items-center justify-center gap-1
                                ${isRefunded
                                                                            ? 'bg-gray-100 text-gray-500 border-gray-200'
                                                                            : 'bg-red-100 text-red-600 border-red-200 animate-pulse'}`}
                                                                >
                                                                    {isRefunded ? '✅ 환수완료' : '🚨 미환수 (관리)'}
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>

                                                    {/* 10. 후처리 (메모) */}
                                                    <td className="px-4 py-3 align-top min-w-[200px]">
                                                        <div className="relative group w-full h-8">
                                                            <textarea
                                                                className="absolute top-0 left-0 w-full h-8 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-500 rounded p-1 text-sm transition-all resize-none leading-normal overflow-hidden whitespace-nowrap focus:whitespace-pre-wrap focus:bg-white focus:shadow-xl focus:z-50"
                                                                rows={1}
                                                                defaultValue={c.last_memo}
                                                                onFocus={(e) => {
                                                                    e.target.style.height = 'auto';
                                                                    e.target.style.height = (e.target.scrollHeight > 32 ? e.target.scrollHeight : 32) + 'px';
                                                                }}
                                                                onChange={(e) => {
                                                                    e.target.style.height = 'auto';
                                                                    e.target.style.height = e.target.scrollHeight + 'px';
                                                                }}
                                                                onBlur={(e) => {
                                                                    e.target.style.height = '2rem';
                                                                    handleInlineUpdate(c.id, 'last_memo', e.target.value);
                                                                }}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter' && e.ctrlKey) {
                                                                        e.preventDefault();
                                                                        const val = e.target.value;
                                                                        const start = e.target.selectionStart;
                                                                        const end = e.target.selectionEnd;
                                                                        e.target.value = val.substring(0, start) + "\n" + val.substring(end);
                                                                        e.target.selectionStart = e.target.selectionEnd = start + 1;
                                                                        e.target.style.height = 'auto';
                                                                        e.target.style.height = e.target.scrollHeight + 'px';
                                                                        return;
                                                                    }
                                                                    handleMemoKeyDown(e, c.id, c.name);
                                                                }}
                                                                onDoubleClick={() => handleOpenHistory(c)}
                                                                placeholder={c.status === '해지진행' ? "후처리 내용 입력..." : "메모..."}
                                                                title="더블클릭하여 히스토리 보기"
                                                            />
                                                            <span className="absolute right-1 top-2 text-[8px] text-gray-300 pointer-events-none group-focus-within:hidden">↵</span>
                                                        </div>
                                                    </td>

                                                </tr>
                                            );
                                        })}
                                        {displayedData.length === 0 && (
                                            <tr>
                                                <td colSpan="10" className="p-10 text-center text-gray-400">설치 완료된 건이 없습니다.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'settlement' && (
                    <div className="flex flex-col h-[750px] gap-2 animate-fade-in">
                        {/* (1) 타이틀 영역 */}
                        <div className="mb-1 shrink-0">
                            <h2 className="text-xl font-extrabold text-gray-800 flex items-center gap-2">
                                💰 정산 실행 및 관리
                            </h2>
                        </div>

                        {/* (2) 메인 리스트 영역 */}
                        <div className="flex-1 bg-white border border-gray-200 rounded-xl shadow-sm flex flex-col overflow-hidden mt-1">
                            <div className="p-3 border-b border-gray-200 flex justify-between items-center bg-white shrink-0">
                                <div className="flex items-center gap-3">
                                    <h2 className="text-sm font-bold text-gray-800">정산 현황</h2>
                                    <span className="bg-indigo-50 text-indigo-600 text-[11px] px-2 py-0.5 rounded-full font-bold border border-indigo-100">
                                        총 {displayedData.length}건
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {renderSortToggle()}
                                    <select className="bg-white border border-gray-300 rounded-lg px-2 py-1.5 text-gray-700 text-xs font-bold outline-none" value={clientFilter} onChange={e => setClientFilter(e.target.value)}>
                                        <option value="ALL">🏢 전체 거래처</option>
                                        {clientList.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                    <select className="bg-white border border-gray-300 rounded-lg px-2 py-1.5 text-gray-700 text-xs font-bold outline-none" value={salesAgentFilter} onChange={e => setSalesAgentFilter(e.target.value)}>
                                        <option value="">👤 전체 상담사</option>
                                        {agents.map(a => <option key={a.id} value={a.id}>{a.username}</option>)}
                                    </select>
                                    {renderDateFilter()}
                                </div>
                            </div>

                            <div className="flex-1 overflow-auto relative bg-white">
                                <table className="sheet-table w-full text-left table-fixed">
                                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-tight border-b border-slate-200 sticky top-0 z-10">
                                        <tr>
                                            <th className="p-2 w-[120px]">담당자/고객</th>
                                            <th className="p-2 w-[100px] bg-slate-100/50">거래처</th>
                                            <th className="p-2 w-[55px] text-center">정책</th>
                                            <th className="p-2 w-[55px] text-center">본사</th>
                                            <th className="p-2 w-[40px] text-center">검수</th>
                                            <th className="p-2 w-[55px] text-center">지원</th>
                                            <th className="p-2 w-[65px] text-right bg-indigo-50 text-indigo-700">순수익</th>
                                            <th className="p-2 w-[100px] text-center">예정일</th>
                                            <th className="p-2 w-[100px] text-center">완료일</th>
                                            <th className="p-2 w-[90px] text-center">상태</th>
                                            <th className="p-2 min-w-[200px]">정산 메모 및 회신요청</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {displayedData.map(c => {
                                            const agentP = safeParseInt(c.agent_policy);
                                            const hqP = safeParseInt(c.policy_amt);
                                            const supp = safeParseInt(c.support_amt);
                                            const netP = hqP - supp; // '만' 단위

                                            return (
                                                <tr key={c.id} className="hover:bg-yellow-50/50 transition">
                                                    <td className="p-2 leading-tight">
                                                        <div className="text-[11px] text-indigo-600 font-bold">{getAgentName(c.owner)}</div>
                                                        <div className="text-xs font-bold text-gray-800">{c.name}</div>
                                                    </td>
                                                    <td className="p-2">
                                                        <select className="w-full bg-transparent text-[11px] font-bold text-gray-600 outline-none" value={c.client || ''} onChange={(e) => handleInlineUpdate(c.id, 'client', e.target.value)}>
                                                            <option value="">(미지정)</option>
                                                            {clientList.map(client => <option key={client} value={client}>{client}</option>)}
                                                        </select>
                                                    </td>
                                                    <td className="p-1 text-center font-bold text-gray-400 text-xs">{agentP}</td>
                                                    <td className="p-1">
                                                        <input type="number" className="w-full text-center bg-white border border-gray-200 rounded text-xs font-bold no-spin" defaultValue={hqP} onBlur={(e) => handleInlineUpdate(c.id, 'policy_amt', e.target.value)} />
                                                    </td>
                                                    <td className="p-1 text-center">
                                                        {agentP === hqP ? <span className="text-green-500 text-[10px]">OK</span> : <span className="text-red-500 font-bold text-[10px]">Diff</span>}
                                                    </td>
                                                    <td className="p-1">
                                                        <input type="number" className="w-full text-center bg-white border border-gray-200 rounded text-xs font-bold text-red-500 no-spin" defaultValue={supp} onBlur={(e) => handleInlineUpdate(c.id, 'support_amt', e.target.value)} />
                                                    </td>
                                                    <td className={`p-2 text-right font-black text-xs ${netP >= 0 ? 'text-indigo-600' : 'text-red-600'} bg-indigo-50/30`}>
                                                        {netP}만
                                                    </td>
                                                    <td className="p-1">
                                                        <input type="date" className="w-full bg-transparent text-[10px] text-center outline-none" value={c.settlement_due_date || ''} onChange={(e) => handleInlineUpdate(c.id, 'settlement_due_date', e.target.value)} />
                                                    </td>
                                                    <td className="p-1">
                                                        <input type="date" className="w-full bg-transparent text-[10px] text-center outline-none" value={c.settlement_complete_date || ''} onChange={(e) => handleInlineUpdate(c.id, 'settlement_complete_date', e.target.value)} />
                                                    </td>
                                                    <td className="p-1">
                                                        <select className={`w-full p-1 rounded text-[10px] font-bold border border-gray-200 ${c.settlement_status === '정산완료' ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-600'}`} value={c.settlement_status || '미정산'} onChange={(e) => handleInlineUpdate(c.id, 'settlement_status', e.target.value)}>
                                                            {settlementStatuses.map(s => <option key={s.id} value={s.status}>{s.status}</option>)}
                                                        </select>
                                                    </td>
                                                    <td className="p-2">
                                                        <div className="flex items-center gap-2">
                                                            <input
                                                                type="text"
                                                                className="flex-1 bg-gray-50 border border-gray-200 rounded px-2 py-1 text-xs outline-none focus:border-indigo-500"
                                                                defaultValue={c.settlement_memo}
                                                                onBlur={(e) => handleInlineUpdate(c.id, 'settlement_memo', e.target.value)}
                                                                placeholder="정산 비고..."
                                                            />
                                                            {/* 🟢 회신 요청 버튼 */}
                                                            <button
                                                                onClick={() => handleSettlementRequest(c)}
                                                                className={`shrink-0 px-2 py-1 rounded text-[10px] font-bold transition shadow-sm
                                                    ${c.request_status === 'REQUESTED'
                                                                        ? 'bg-red-500 text-white animate-pulse'
                                                                        : 'bg-white border border-red-200 text-red-500 hover:bg-red-50'}`}
                                                            >
                                                                {c.request_status === 'REQUESTED' ? '요청됨' : '회신요청'}
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

                {/* 🟢 [설정 탭] 리뉴얼: 좌측(그리드 설정) + 우측(정책 관리 유지) */}
                {activeTab === 'settings' && (
                    <div className="flex flex-col h-[750px] animate-fade-in gap-4">

                        {/* 헤더 */}
                        <div className="shrink-0 border-b border-gray-200 pb-2">
                            <h2 className="text-xl font-extrabold text-gray-800">⚙️ 시스템 환경 설정</h2>
                            <p className="text-xs text-gray-500">분류 값 관리 및 상품 정책을 설정합니다.</p>
                        </div>

                        <div className="flex gap-6 h-full overflow-hidden pb-4">

                            {/* [LEFT] 각종 분류 값 관리 (그리드 레이아웃) */}
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-1">
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                                    {/* 1. 마케팅 채널 */}
                                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                                        <div className="flex justify-between items-center mb-3">
                                            <h3 className="font-bold text-gray-800 text-sm">📢 마케팅 채널</h3>
                                            <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded">광고비용</span>
                                        </div>
                                        <div className="flex gap-2 mb-2">
                                            <input className="w-1/2 bg-gray-50 p-2 rounded border border-gray-300 text-xs outline-none focus:border-indigo-500" placeholder="채널명" value={newAdChannel.name} onChange={e => setNewAdChannel({ ...newAdChannel, name: e.target.value })} />
                                            <input type="number" className="w-1/3 bg-gray-50 p-2 rounded border border-gray-300 text-xs outline-none focus:border-indigo-500" placeholder="단가" value={newAdChannel.cost} onChange={e => setNewAdChannel({ ...newAdChannel, cost: e.target.value })} />
                                            <button onClick={handleAddAdChannel} className="bg-indigo-600 px-2 rounded text-white text-xs font-bold hover:bg-indigo-700">Add</button>
                                        </div>
                                        <div className="flex flex-col gap-1 max-h-32 overflow-y-auto">
                                            {adChannels.map(ad => (
                                                <div key={ad.id} className="flex justify-between items-center bg-gray-50 px-2 py-1.5 rounded border border-gray-100">
                                                    <span className="text-xs font-bold text-gray-700">{ad.name}</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] text-gray-500">{parseInt(ad.cost).toLocaleString()}원</span>
                                                        <button onClick={() => handleDeleteAdChannel(ad.id)} className="text-gray-400 hover:text-red-500 font-bold">×</button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* 2. 통신사(플랫폼) */}
                                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                                        <h3 className="font-bold mb-3 text-gray-800 text-sm">📡 통신사 (플랫폼)</h3>
                                        <div className="flex gap-2 mb-2">
                                            <input className="bg-gray-50 p-2 rounded flex-1 border border-gray-300 text-xs outline-none focus:border-indigo-500" placeholder="예: 알뜰폰" value={newPlatformInput} onChange={e => setNewPlatformInput(e.target.value)} />
                                            <button onClick={() => handleAddList('platform')} className="bg-indigo-600 px-3 rounded text-white text-xs font-bold hover:bg-indigo-700">Add</button>
                                        </div>
                                        <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                                            {platformList.map(item => (
                                                <span key={item} className="bg-white text-gray-700 px-2 py-1 rounded border border-gray-200 text-xs flex items-center gap-1 shadow-sm">
                                                    {item} <button onClick={() => handleDeleteList('platform', item)} className="text-gray-300 hover:text-red-500">×</button>
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    {/* 3. 공통 상태값 */}
                                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                                        <h3 className="font-bold mb-3 text-gray-800 text-sm">📊 공통 상태값 (전체/공유)</h3>
                                        <div className="flex gap-2 mb-2">
                                            <input className="bg-gray-50 p-2 rounded flex-1 border border-gray-300 text-xs outline-none focus:border-indigo-500" placeholder="예: 보류" value={newStatusInput} onChange={e => setNewStatusInput(e.target.value)} />
                                            <button onClick={() => handleAddList('status')} className="bg-indigo-600 px-3 rounded text-white text-xs font-bold hover:bg-indigo-700">Add</button>
                                        </div>
                                        <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                                            {statusList.map(item => (
                                                <span key={item} className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded border border-indigo-100 text-xs flex items-center gap-1">
                                                    {item} <button onClick={() => handleDeleteList('status', item)} className="text-indigo-300 hover:text-red-500">×</button>
                                                </span>
                                            ))}
                                        </div>
                                    </div>


                                    {/* 🟢 거래처 관리 섹션 */}
                                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                                        <h3 className="font-bold mb-3 text-indigo-800 text-sm">🏢 거래처 관리 (본사/대리점)</h3>
                                        <div className="flex gap-2 mb-2">
                                            <input
                                                className="bg-gray-50 p-2 rounded flex-1 border border-gray-300 text-xs outline-none focus:border-indigo-500"
                                                placeholder="예: 농심본사, 이영자대리점"
                                                value={newClientInput}
                                                onChange={e => setNewClientInput(e.target.value)}
                                                onKeyPress={(e) => e.key === 'Enter' && handleAddClient()}
                                            />
                                            <button onClick={handleAddClient} className="bg-indigo-600 px-3 rounded text-white text-xs font-bold hover:bg-indigo-700">Add</button>
                                        </div>
                                        <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto custom-scrollbar">
                                            {clientList.map((client, idx) => (
                                                <span key={idx} className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded border border-indigo-100 text-xs flex items-center gap-1">
                                                    {client}
                                                    {/* 삭제 버튼은 ID 연동 필요 */}
                                                    <button onClick={() => handleDeleteClient(client)} className="text-indigo-300 hover:text-red-500 font-bold ml-1">×</button>
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    {/* 4. 접수 탭 상태 (신규) */}
                                    <div className="bg-white p-4 rounded-xl border border-blue-200 shadow-sm relative overflow-hidden">
                                        <div className="absolute top-0 right-0 bg-blue-100 px-2 py-1 text-[9px] font-bold text-blue-600 rounded-bl-lg">접수 탭 전용</div>
                                        <h3 className="font-bold mb-3 text-blue-900 text-sm">📝 접수 상태값</h3>
                                        <div className="flex gap-2 mb-2">
                                            <input className="bg-gray-50 p-2 rounded flex-1 border border-gray-300 text-xs outline-none focus:border-blue-500" placeholder="예: 개통대기" value={newReceptionInput} onChange={e => setNewReceptionInput(e.target.value)} />
                                            <button onClick={() => handleAddList('reception')} className="bg-blue-600 px-3 rounded text-white text-xs font-bold hover:bg-blue-700">Add</button>
                                        </div>
                                        <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                                            {receptionList.map(item => (
                                                <span key={item} className="bg-blue-50 text-blue-700 px-2 py-1 rounded border border-blue-100 text-xs flex items-center gap-1">
                                                    {item} <button onClick={() => handleDeleteList('reception', item)} className="text-blue-300 hover:text-red-500">×</button>
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    {/* 5. 설치 탭 상태 (신규) */}
                                    <div className="bg-white p-4 rounded-xl border border-green-200 shadow-sm relative overflow-hidden">
                                        <div className="absolute top-0 right-0 bg-green-100 px-2 py-1 text-[9px] font-bold text-green-600 rounded-bl-lg">설치 탭 전용</div>
                                        <h3 className="font-bold mb-3 text-green-900 text-sm">✅ 설치/해지 상태값</h3>
                                        <div className="flex gap-2 mb-2">
                                            <input className="bg-gray-50 p-2 rounded flex-1 border border-gray-300 text-xs outline-none focus:border-green-500" placeholder="예: 재정비" value={newInstallInput} onChange={e => setNewInstallInput(e.target.value)} />
                                            <button onClick={() => handleAddList('install')} className="bg-green-600 px-3 rounded text-white text-xs font-bold hover:bg-green-700">Add</button>
                                        </div>
                                        <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                                            {installList.map(item => (
                                                <span key={item} className="bg-green-50 text-green-700 px-2 py-1 rounded border border-green-100 text-xs flex items-center gap-1">
                                                    {item} <button onClick={() => handleDeleteList('install', item)} className="text-green-300 hover:text-red-500">×</button>
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    {/* 6. 정산 상태 */}
                                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                                        <h3 className="font-bold mb-3 text-orange-600 text-sm">💰 정산 상태값</h3>
                                        <div className="flex gap-2 mb-2">
                                            <input className="bg-gray-50 p-2 rounded flex-1 border border-gray-300 text-xs outline-none focus:border-orange-500" placeholder="예: 부분정산" value={newSettlementStatus} onChange={e => setNewSettlementStatus(e.target.value)} />
                                            <button onClick={handleAddSettlementStatus} className="bg-orange-500 px-3 rounded text-white text-xs font-bold hover:bg-orange-600">Add</button>
                                        </div>
                                        <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                                            {settlementStatuses.map(s => (
                                                <span key={s.id} className="bg-orange-50 text-orange-700 px-2 py-1 rounded border border-orange-100 text-xs flex items-center gap-1">
                                                    {s.status} <button onClick={() => handleDeleteSettlementStatus(s.id)} className="text-orange-300 hover:text-red-500">×</button>
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    {/* 7. 실패 사유 */}
                                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                                        <h3 className="font-bold mb-3 text-red-600 text-sm">🚫 실패 사유</h3>
                                        <div className="flex gap-2 mb-2">
                                            <input className="bg-gray-50 p-2 rounded flex-1 border border-gray-300 text-xs outline-none focus:border-red-500" placeholder="사유 입력" value={newReason} onChange={e => setNewReason(e.target.value)} />
                                            <button onClick={handleAddReason} className="bg-red-500 px-3 rounded text-white text-xs font-bold hover:bg-red-600">Add</button>
                                        </div>
                                        <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                                            {reasons.map(r => (
                                                <span key={r.id} className="bg-red-50 text-red-700 px-2 py-1 rounded border border-red-100 text-xs flex items-center gap-1">
                                                    {r.reason} <button onClick={() => handleDeleteReason(r.id)} className="text-red-300 hover:text-red-600">×</button>
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    {/* 8. 접수 취소 사유 */}
                                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                                        <h3 className="font-bold mb-3 text-gray-700 text-sm">↩️ 접수 취소 사유</h3>

                                        {/* 입력창과 추가 버튼 */}
                                        <div className="flex gap-2 mb-2">
                                            <input
                                                className="bg-gray-50 p-2 rounded flex-1 border border-gray-300 text-xs outline-none focus:border-gray-500"
                                                placeholder="예: 단순변심"
                                                value={newCancelReason}
                                                onChange={e => setNewCancelReason(e.target.value)}
                                                // 엔터키로도 저장되도록 추가
                                                onKeyPress={(e) => e.key === 'Enter' && handleAddCancelReason()}
                                            />
                                            <button onClick={handleAddCancelReason} className="bg-gray-500 px-3 rounded text-white text-xs font-bold hover:bg-gray-600">Add</button>
                                        </div>

                                        {/* 👇 리스트 렌더링 영역 (이 부분이 중요합니다) */}
                                        <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto custom-scrollbar">
                                            {cancelReasons && cancelReasons.length > 0 ? (
                                                cancelReasons.map(r => (
                                                    <span key={r.id} className="bg-gray-100 text-gray-700 px-2 py-1 rounded border border-gray-200 text-xs flex items-center gap-1 transition hover:bg-gray-200">
                                                        {r.reason}
                                                        <button onClick={() => handleDeleteCancelReason(r.id)} className="text-gray-400 hover:text-red-500 font-bold ml-1">×</button>
                                                    </span>
                                                ))
                                            ) : (
                                                <span className="text-xs text-gray-400 p-1">등록된 사유가 없습니다.</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* 🟢 9. 거래처 관리 섹션 추가 */}
                                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                                        <h3 className="font-bold mb-3 text-indigo-800 text-sm">🏢 거래처 관리</h3>
                                        <div className="flex gap-2 mb-2">
                                            <input
                                                className="bg-gray-50 p-2 rounded flex-1 border border-gray-300 text-xs outline-none focus:border-indigo-500"
                                                placeholder="예: 농심본사"
                                                value={newClientInput}
                                                onChange={e => setNewClientInput(e.target.value)}
                                            />
                                            <button onClick={handleAddClient} className="bg-indigo-600 px-3 rounded text-white text-xs font-bold hover:bg-indigo-700">Add</button>
                                        </div>
                                        <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                                            {clientList.map((client, idx) => (
                                                <span key={idx} className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded border border-indigo-100 text-xs flex items-center gap-1">
                                                    {client}
                                                    {/* 삭제 버튼 연결 필요 */}
                                                    <button className="text-indigo-300 hover:text-red-500">×</button>
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* [RIGHT] 상품 정책 및 거래처 양식 통합 관리 구역 (450px 고정) */}
                            <div className="w-[450px] bg-white rounded-xl border border-gray-300 flex flex-col shadow-xl overflow-hidden shrink-0">

                                {/* (1) 우측 구역 전용 폴더형 탭 바 */}
                                <div className="flex bg-gray-100 border-b border-gray-200 shrink-0">
                                    <button
                                        onClick={() => setSettingsSubTab('policy')}
                                        className={`flex-1 py-3 text-xs font-bold transition-all ${settingsSubTab === 'policy'
                                                ? 'bg-white text-indigo-600 border-r border-gray-200 shadow-[inset_0_2px_0_0_#4f46e5]'
                                                : 'text-gray-400 hover:bg-gray-200 border-r border-gray-200'
                                            }`}
                                    >
                                        📁 상품 정책 관리
                                    </button>
                                    <button
                                        onClick={() => setSettingsSubTab('client_template')}
                                        className={`flex-1 py-3 text-xs font-bold transition-all ${settingsSubTab === 'client_template'
                                                ? 'bg-white text-indigo-600 shadow-[inset_0_2px_0_0_#4f46e5]'
                                                : 'text-gray-400 hover:bg-gray-200'
                                            }`}
                                    >
                                        📋 거래처별 양식
                                    </button>
                                </div>

                                <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">

                                    {/* [A] 폴더 1: 기존 상품 정책 관리 */}
                                    {settingsSubTab === 'policy' && (
                                        <div className="animate-fade-in flex flex-col h-full">
                                            <div className="p-4 bg-white border-b border-gray-100 sticky top-0 z-20">
                                                <div className="flex gap-1 overflow-x-auto hide-scrollbar">
                                                    {Object.keys(policyData).map(tab => (
                                                        <button key={tab} onClick={() => setActivePolicyTab(tab)} className={`px-3 py-1.5 rounded-lg font-bold text-xs transition border whitespace-nowrap ${activePolicyTab === tab ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'}`}>
                                                            {tab}
                                                            {Object.keys(policyData).length > 1 && <span onClick={(e) => { e.stopPropagation(); handleDeleteCarrierTab(tab); }} className="ml-2 text-[10px] opacity-60 hover:opacity-100">✕</span>}
                                                        </button>
                                                    ))}
                                                    <button onClick={handleAddCarrierTab} className="px-2 py-1.5 rounded-lg font-bold text-xs bg-gray-200 text-gray-600 hover:bg-gray-300 border border-gray-300">＋</button>
                                                </div>
                                            </div>
                                            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-white border border-t-0 rounded-b-xl space-y-8">

                                                {/* 1. 인터넷 단독 섹션 (필드 확장) */}
                                                <div>
                                                    <div className="flex justify-between items-center mb-2">
                                                        <h4 className="font-bold text-sm text-indigo-700 bg-indigo-50 px-2 py-1 rounded">🌐 인터넷 단독</h4>
                                                        <button onClick={() => handleAddPolicyItem('internet')} className="bg-indigo-600 text-white px-2 py-0.5 rounded text-[10px] font-bold shadow">＋ 상품 추가</button>
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                        {policyData[activePolicyTab].internet.map((p, idx) => (
                                                            <div key={p.id} className="border border-gray-200 rounded-xl p-3 bg-slate-50 relative group">
                                                                <button onClick={() => handleDeletePolicyItem('internet', idx)} className="absolute top-2 right-2 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition text-xs">✕</button>
                                                                <input className="w-full bg-white border border-gray-200 rounded-lg mb-2 p-2 text-sm font-bold text-gray-800 outline-none focus:border-indigo-500" placeholder="상품명" value={p.name} onChange={(e) => handleUpdatePolicyData('internet', idx, 'name', e.target.value)} />
                                                                <div className="grid grid-cols-4 gap-1">
                                                                    <input className="border border-gray-300 rounded p-1 text-[10px] outline-none bg-white" placeholder="요금" value={p.fee} onChange={(e) => handleUpdatePolicyData('internet', idx, 'fee', e.target.value)} />
                                                                    <input className="border border-gray-300 rounded p-1 text-[10px] outline-none bg-white" placeholder="설치비" value={p.install_fee} onChange={(e) => handleUpdatePolicyData('internet', idx, 'install_fee', e.target.value)} />
                                                                    <input className="border border-gray-300 rounded p-1 text-[10px] outline-none bg-white" placeholder="정책" value={p.policy} onChange={(e) => handleUpdatePolicyData('internet', idx, 'policy', e.target.value)} />
                                                                    <input className="border border-indigo-200 rounded p-1 text-[10px] font-bold text-indigo-600 outline-none bg-white" placeholder="합계" value={p.total} onChange={(e) => handleUpdatePolicyData('internet', idx, 'total', e.target.value)} />
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* 2. 번들/결합 섹션 (필드 확장) */}
                                                <div>
                                                    <div className="flex justify-between items-center mb-2">
                                                        <h4 className="font-bold text-sm text-emerald-700 bg-emerald-50 px-2 py-1 rounded">📺 TV / 번들 결합</h4>
                                                        <button onClick={() => handleAddPolicyItem('bundle')} className="bg-emerald-600 text-white px-2 py-0.5 rounded text-[10px] font-bold shadow">＋ 상품 추가</button>
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                        {policyData[activePolicyTab].bundle.map((p, idx) => (
                                                            <div key={p.id} className="border border-gray-200 rounded-xl p-3 bg-slate-50 relative group">
                                                                <button onClick={() => handleDeletePolicyItem('bundle', idx)} className="absolute top-2 right-2 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition text-xs">✕</button>
                                                                <input className="w-full bg-white border border-gray-200 rounded-lg mb-2 p-2 text-sm font-bold text-gray-800 outline-none focus:border-emerald-500" placeholder="결합상품명" value={p.name} onChange={(e) => handleUpdatePolicyData('bundle', idx, 'name', e.target.value)} />
                                                                <div className="grid grid-cols-4 gap-1">
                                                                    <input className="border border-gray-300 rounded p-1 text-[10px] outline-none bg-white" placeholder="요금" value={p.fee} onChange={(e) => handleUpdatePolicyData('bundle', idx, 'fee', e.target.value)} />
                                                                    <input className="border border-gray-300 rounded p-1 text-[10px] outline-none bg-white" placeholder="설치비" value={p.install_fee} onChange={(e) => handleUpdatePolicyData('bundle', idx, 'install_fee', e.target.value)} />
                                                                    <input className="border border-gray-300 rounded p-1 text-[10px] outline-none bg-white" placeholder="정책" value={p.policy} onChange={(e) => handleUpdatePolicyData('bundle', idx, 'policy', e.target.value)} />
                                                                    <input className="border border-emerald-200 rounded p-1 text-[10px] font-bold text-emerald-600 outline-none bg-white" placeholder="합계" value={p.total} onChange={(e) => handleUpdatePolicyData('bundle', idx, 'total', e.target.value)} />
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* 3. 🎬 OTT 서비스 섹션 (신규 추가) */}
                                                <div>
                                                    <div className="flex justify-between items-center mb-2">
                                                        <h4 className="font-bold text-sm text-orange-700 bg-orange-50 px-2 py-1 rounded">🎬 OTT 서비스</h4>
                                                        <button onClick={() => handleAddPolicyItem('ott')} className="bg-orange-600 text-white px-2 py-0.5 rounded text-[10px] font-bold shadow">＋ OTT 추가</button>
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                        {policyData[activePolicyTab].ott?.map((p, idx) => (
                                                            <div key={p.id} className="border border-gray-200 rounded-xl p-3 bg-slate-50 relative group">
                                                                <button onClick={() => handleDeletePolicyItem('ott', idx)} className="absolute top-2 right-2 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition text-xs">✕</button>
                                                                <input className="w-full bg-white border border-gray-200 rounded-lg mb-2 p-2 text-sm font-bold text-gray-800 outline-none focus:border-orange-500" placeholder="OTT 상품명 (예: 넷플릭스 패키지)" value={p.name} onChange={(e) => handleUpdatePolicyData('ott', idx, 'name', e.target.value)} />
                                                                <div className="grid grid-cols-3 gap-2">
                                                                    <input className="border border-gray-300 rounded p-1.5 text-xs outline-none bg-white" placeholder="정책" value={p.policy} onChange={(e) => handleUpdatePolicyData('ott', idx, 'policy', e.target.value)} />
                                                                    <input className="border border-gray-300 rounded p-1.5 text-xs outline-none bg-white" placeholder="지원" value={p.support} onChange={(e) => handleUpdatePolicyData('ott', idx, 'support', e.target.value)} />
                                                                    <input className="border border-orange-200 rounded p-1.5 text-xs font-bold text-orange-600 outline-none bg-white" placeholder="합계" value={p.total} onChange={(e) => handleUpdatePolicyData('ott', idx, 'total', e.target.value)} />
                                                                </div>
                                                            </div>
                                                        ))}
                                                        {(policyData[activePolicyTab].ott?.length === 0 || !policyData[activePolicyTab].ott) && <div className="col-span-2 py-4 text-center text-xs text-gray-400 border border-dashed border-gray-200 rounded-xl">등록된 OTT 서비스가 없습니다.</div>}
                                                    </div>
                                                </div>
                                            </div>
                                            {/* 👈 여기에 아래 코드를 붙여넣으세요! */}
                                            <div className="p-4 bg-gray-50 border-t border-gray-200 shrink-0 flex justify-end items-center gap-4 rounded-b-2xl">
                                                <span className="text-xs text-gray-400 font-bold">※ 모든 설정 변경 후 반드시 저장 버튼을 눌러주세요.</span>
                                                <button
                                                    onClick={handleSaveSettings}
                                                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-10 py-3 rounded-xl font-black shadow-lg transition transform active:scale-95 flex items-center gap-2"
                                                >
                                                    <span>💾 모든 설정 데이터 저장하기</span>
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* [B] 폴더 2: 거래처별 양식 관리 (신규) */}
                                    {settingsSubTab === 'client_template' && (
                                        <div className="animate-fade-in flex flex-col h-full bg-slate-50 p-4">
                                            <div className="flex flex-col h-full bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                                                <h4 className="font-bold text-gray-800 text-sm mb-3 flex justify-between items-center">
                                                    <span>📝 거래처 양식 편집기</span>
                                                    <span className="text-[10px] text-gray-400">변수 사용: {"{{NAME}}"}...</span>
                                                </h4>

                                                {/* 거래처 선택 드롭다운 */}
                                                <select
                                                    className="w-full p-2.5 mb-4 border border-indigo-200 rounded-lg text-xs font-bold bg-indigo-50 outline-none"
                                                    value={newClientInput}
                                                    onChange={(e) => setNewClientInput(e.target.value)}
                                                >
                                                    <option value="">-- 거래처를 선택하세요 --</option>
                                                    {clientList.map(c => <option key={c} value={c}>{c}</option>)}
                                                </select>

                                                {/* 템플릿 에디터 */}
                                                <textarea
                                                    className="flex-1 w-full p-4 border border-gray-200 rounded-xl text-xs font-mono leading-relaxed outline-none focus:border-indigo-500 bg-gray-50 resize-none"
                                                    placeholder={`거래처 선택 후 양식을 입력하세요.\n예시:\n■ 접수\n성명: {{NAME}}\n상품: {{PRODUCT}}`}
                                                    value={clientTemplates[newClientInput] || ""}
                                                    onChange={(e) => setClientTemplates(prev => ({ ...prev, [newClientInput]: e.target.value }))}
                                                    disabled={!newClientInput}
                                                />

                                                <button
                                                    onClick={() => alert('✅ 양식이 로컬에 임시 저장되었습니다.')}
                                                    className="w-full mt-4 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition shadow-lg shadow-indigo-100"
                                                >
                                                    해당 거래처 양식 적용
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* 🟢 [개편완료] 접수 완료 모달: 좌측 양식 / 우측 선택 / 상단 탭 */}
            {showCompletionModal && completionTarget && (
                <PopoutWindow title="📝 접수 양식 작성 및 확정" onClose={() => setShowCompletionModal(false)} width={1100} height={850}>
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

            {/* ⭐️ [수정됨] 독립된 팝업 채팅방 (기능 통합 완료) */}
            {isChatOpen && (
                <PopoutWindow
                    title={chatView === 'LIST' ? '💬 상담 채팅 목록' : `💬 ${chatTarget?.name}님 상담`}
                    onClose={() => setIsChatOpen(false)}
                    width={400}   // 👈 시작 너비 (모바일 비율)
                    height={600}  // 👈 시작 높이
                >
                    {/* 팝업 내부 컨테이너: 화면 전체 높이 사용 */}
                    <div className="flex flex-col h-screen bg-white">

                        {/* 1. 채팅방 헤더 */}
                        <div className="bg-indigo-600 p-4 flex justify-between items-center text-white shrink-0 shadow-md">
                            <div className="flex flex-col">
                                <span className="font-bold text-lg">
                                    {chatView === 'LIST' ? '💬 상담 채팅 목록' : chatTarget?.name}
                                </span>
                                {chatView === 'ROOM' && (
                                    <span className="text-xs opacity-80">{chatTarget?.phone}</span>
                                )}
                            </div>
                            <div className="flex gap-2">
                                {chatView === 'ROOM' && (
                                    <button
                                        onClick={() => setShowMacro(!showMacro)}
                                        className="text-white bg-indigo-500 hover:bg-indigo-400 px-3 py-1 rounded text-xs font-bold transition"
                                    >
                                        {showMacro ? '문구 닫기' : '자주 쓰는 문구'}
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* 2. 컨텐츠 영역 */}
                        {chatView === 'LIST' ? (
                            /* [A] 채팅 목록 뷰 */
                            <div className="flex-1 flex flex-col min-h-0 bg-gray-50">
                                <div className="p-3 border-b border-gray-200 bg-white shrink-0">
                                    <input
                                        type="text"
                                        placeholder="이름 또는 번호 검색..."
                                        className="w-full bg-gray-100 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                        value={chatListSearch}
                                        onChange={(e) => setChatListSearch(e.target.value)}
                                    />
                                </div>
                                <div className="flex-1 overflow-y-auto custom-scrollbar">
                                    {chatListCustomers.map(c => (
                                        <div key={c.id} onClick={() => enterChatRoom(c)} className="p-4 border-b border-gray-100 hover:bg-white cursor-pointer transition flex justify-between items-center">
                                            <div>
                                                <div className="font-bold text-gray-800">{c.name}</div>
                                                <div className="text-xs text-gray-500">{c.phone}</div>
                                            </div>
                                            <div className="text-right">
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${getBadgeStyle(c.status)}`}>{c.status}</span>
                                                <div className="text-xs text-gray-400 mt-1">{c.last_memo ? '메모 있음' : ''}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            /* [B] 채팅방 뷰 (드래그 앤 드롭 적용됨) */
                            <div
                                className="flex-1 flex flex-col min-h-0 bg-slate-50 relative"
                                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                                onDragLeave={() => setIsDragOver(false)}
                                onDrop={handleFileDrop}
                            >
                                {/* 드래그 오버레이 */}
                                {isDragOver && (
                                    <div className="absolute inset-0 bg-indigo-500/20 z-50 flex justify-center items-center backdrop-blur-sm border-4 border-dashed border-indigo-500 m-4 rounded-xl pointer-events-none">
                                        <div className="bg-white px-6 py-3 rounded-full shadow-xl font-bold text-indigo-700 animate-bounce">
                                            📂 이미지를 여기에 놓으세요
                                        </div>
                                    </div>
                                )}

                                {/* 매크로 사이드 패널 */}
                                {showMacro && (
                                    <div className="absolute top-0 right-0 w-64 h-full bg-white shadow-2xl border-l border-gray-200 z-40 flex flex-col animate-slide-in-right">
                                        <div className="flex border-b border-gray-200 shrink-0">
                                            {['공통', 'KT', 'SK', 'LG'].map(tab => (
                                                <button key={tab} onClick={() => setActiveMacroTab(tab)} className={`flex-1 py-3 text-xs font-bold transition ${activeMacroTab === tab ? 'bg-indigo-50 text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:bg-gray-50'}`}>{tab}</button>
                                            ))}
                                        </div>
                                        <div className="flex-1 overflow-y-auto p-2">
                                            {macros[activeMacroTab]?.map((text, i) => (
                                                <div key={i} className="group flex items-center justify-between p-3 hover:bg-indigo-50 rounded-lg cursor-pointer border-b border-gray-50 transition">
                                                    <span className="text-xs text-gray-700 w-44 break-words leading-relaxed" onClick={() => handleMacroClick(text)}>{text}</span>
                                                    <button onClick={() => handleDeleteMacro(i)} className="text-gray-300 hover:text-red-500 text-xs px-2 opacity-0 group-hover:opacity-100 transition">삭제</button>
                                                </div>
                                            ))}
                                            {(!macros[activeMacroTab] || macros[activeMacroTab].length === 0) && <div className="text-xs text-gray-400 text-center py-10">등록된 문구가 없습니다.</div>}
                                        </div>
                                        <div className="p-3 border-t border-gray-200 bg-gray-50 shrink-0">
                                            <div className="flex gap-2">
                                                <input type="text" className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-xs outline-none focus:border-indigo-500" placeholder="새 문구 추가..." value={newMacroText} onChange={(e) => setNewMacroText(e.target.value)} />
                                                <button onClick={handleAddMacro} className="bg-indigo-600 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-indigo-700 transition">등록</button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* 뒤로가기 바 */}
                                <div className="bg-white border-b border-gray-200 p-2 flex items-center gap-2 shrink-0 shadow-sm z-30">
                                    <button onClick={backToChatList} className="text-gray-500 hover:bg-gray-100 px-3 py-1 rounded text-sm font-bold border border-gray-200 transition">◀ 목록</button>
                                    <span className="text-xs text-gray-400 ml-auto">상담 내용은 서버에 저장되며 실제 SMS가 발송됩니다.</span>
                                </div>

                                {/* 메시지 리스트 */}
                                <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar" ref={chatScrollRef}>
                                    {chatMessages.length === 0 ? (
                                        <div className="h-full flex flex-col justify-center items-center text-gray-300 gap-3">
                                            <span className="text-5xl">💬</span>
                                            <p className="text-sm font-bold">대화 내역이 없습니다.</p>
                                        </div>
                                    ) : (
                                        chatMessages.map((msg, idx) => (
                                            <div key={msg.id || idx} className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
                                                <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm relative group ${msg.sender === 'me' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white text-gray-800 border border-gray-200 rounded-tl-none'}`}>
                                                    <div className="whitespace-pre-wrap leading-relaxed">{msg.text}</div>
                                                    {msg.image && <img src={msg.image} alt="첨부" className="mt-2 rounded-lg max-w-full border border-white/20" />}
                                                    <div className={`text-[10px] mt-1 text-right ${msg.sender === 'me' ? 'text-indigo-200' : 'text-gray-400'}`}>{msg.created_at}</div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>

                                {/* 입력창 영역 */}
                                <div className="p-4 bg-white border-t border-gray-200 shrink-0 z-30">
                                    {/* 파일 첨부 미리보기 */}
                                    {chatFile && (
                                        <div className="flex items-center gap-2 mb-2 bg-indigo-50 p-2 rounded-lg border border-indigo-100 animate-fade-in-up">
                                            <span className="text-lg">🖼️</span>
                                            <span className="text-xs font-bold text-indigo-700 truncate max-w-[200px]">{chatFile.name}</span>
                                            <button onClick={() => setChatFile(null)} className="text-gray-400 hover:text-red-500 font-bold px-2 ml-auto">✕ 제거</button>
                                        </div>
                                    )}

                                    <div className="flex gap-2 items-end">
                                        <textarea
                                            className="flex-1 bg-gray-100 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition resize-none custom-scrollbar border border-transparent focus:border-indigo-500"
                                            placeholder="메시지 입력"
                                            value={chatInput}
                                            rows={1}
                                            style={{ minHeight: '46px', maxHeight: '150px' }}
                                            onChange={(e) => {
                                                setChatInput(e.target.value);
                                                e.target.style.height = 'auto';
                                                e.target.style.height = Math.min(e.target.scrollHeight, 150) + 'px';
                                            }}
                                                onKeyDown={(e) => {
                                                    if (e.nativeEvent.isComposing) return; // 한글 조합 중 엔터 방지

                                                    if (e.key === 'Enter') {
                                                        // 1. Ctrl+Enter 또는 Shift+Enter: 줄바꿈 실행
                                                        if (e.ctrlKey || e.shiftKey) {
                                                            e.preventDefault(); // 기본 동작 막고 수동 처리

                                                            const val = e.target.value;
                                                            const start = e.target.selectionStart;
                                                            const end = e.target.selectionEnd;

                                                            // 커서 위치에 줄바꿈 문자(\n) 삽입
                                                            const newValue = val.substring(0, start) + "\n" + val.substring(end);
                                                            setChatInput(newValue);

                                                            // 입력창 높이 즉시 조절
                                                            setTimeout(() => {
                                                                e.target.style.height = 'auto';
                                                                e.target.style.height = Math.min(e.target.scrollHeight, 150) + 'px';
                                                                // 커서를 줄바꿈 뒤로 이동
                                                                e.target.selectionStart = e.target.selectionEnd = start + 1;
                                                            }, 0);

                                                            return;
                                                        }

                                                        // 2. 그냥 Enter: 전송
                                                        e.preventDefault();
                                                        handleSendManualChat();
                                                    }
                                                }}
                                        />
                                        <button
                                            onClick={() => handleSendManualChat()}
                                            disabled={isSending}
                                            className={`w-12 h-11 rounded-xl flex justify-center items-center text-white transition shadow-md shrink-0 mb-[1px] ${isSending ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 active:scale-95'}`}
                                        >
                                            {isSending ? <span className="animate-spin text-xs">⏳</span> : '➤'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </PopoutWindow>
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

            {/* 🟢 [수정됨] 고객 등록 모달 (건별 / 일괄 탭 분리 + 플랫폼 자유입력) */}
            {showUploadModal && (
                <div className="fixed inset-0 bg-black/50 z-[9999] flex justify-center items-center backdrop-blur-sm animate-fade-in">
                    <div className="bg-white p-0 rounded-2xl w-[600px] h-[650px] border border-gray-200 shadow-2xl flex flex-col overflow-hidden">

                        {/* 1. 헤더 & 탭 선택 */}
                        <div className="bg-indigo-600 p-4 shrink-0">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                        📋 고객 DB 등록
                                    </h2>
                                    <p className="text-indigo-200 text-xs mt-1">
                                        등록 위치: {activeTab === 'consult' ? '내 상담 리스트' : activeTab === 'reception' ? '접수 관리' : activeTab === 'long_term' ? '내 가망 관리' : '미배정/공유'}
                                    </p>
                                </div>
                                <button onClick={() => setShowUploadModal(false)} className="text-white/70 hover:text-white text-2xl transition">×</button>
                            </div>

                            {/* 탭 버튼 */}
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setUploadMode('single')}
                                    className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${uploadMode === 'single' ? 'bg-white text-indigo-600 shadow-md' : 'bg-indigo-700 text-indigo-200 hover:bg-indigo-500'}`}
                                >
                                    ✍️ 건별 등록 (기본)
                                </button>
                                <button
                                    onClick={() => setUploadMode('bulk')}
                                    className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${uploadMode === 'bulk' ? 'bg-white text-indigo-600 shadow-md' : 'bg-indigo-700 text-indigo-200 hover:bg-indigo-500'}`}
                                >
                                    📊 엑셀 일괄 등록
                                </button>
                            </div>
                        </div>

                        {/* 2. 본문 영역 */}
                        <div className="flex-1 overflow-y-auto p-6 bg-slate-50">

                            {/* [A] 건별 등록 모드 */}
                            {uploadMode === 'single' && (
                                <div className="flex flex-col gap-5">

                                    {/* 1. 플랫폼 선택 (목록 + 자유입력) */}
                                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                                        <label className="block text-xs font-bold text-gray-500 mb-2">📡 통신사(플랫폼) 선택</label>
                                        <div className="flex gap-2">
                                            {/* 드롭다운 */}
                                            <select
                                                className={`p-3 border rounded-lg text-sm outline-none focus:border-indigo-500 font-bold text-gray-700 cursor-pointer transition-all ${singleData.isManual ? 'w-1/3 border-gray-300' : 'w-full border-indigo-500 ring-1 ring-indigo-200'}`}
                                                value={singleData.isManual ? 'MANUAL' : singleData.platform}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    if (val === 'MANUAL') {
                                                        setSingleData(prev => ({ ...prev, isManual: true, manualPlatform: '' }));
                                                    } else {
                                                        setSingleData(prev => ({ ...prev, isManual: false, platform: val }));
                                                    }
                                                }}
                                            >
                                                {/* 관리자 설정 목록 */}
                                                {platformList.map(p => <option key={p} value={p}>{p}</option>)}
                                                {/* 자유 입력 옵션 */}
                                                <option value="MANUAL" className="font-bold text-indigo-600">✏️ 직접 입력 (기타)</option>
                                            </select>

                                            {/* 직접 입력창 (조건부 렌더링) */}
                                            {singleData.isManual && (
                                                <input
                                                    type="text"
                                                    className="flex-1 p-3 border border-indigo-500 rounded-lg text-sm outline-none ring-2 ring-indigo-100 bg-white animate-fade-in-right"
                                                    placeholder="플랫폼명 직접 입력 (예: 당근, 네이버)"
                                                    value={singleData.manualPlatform}
                                                    onChange={(e) => setSingleData(prev => ({ ...prev, manualPlatform: e.target.value }))}
                                                    autoFocus
                                                />
                                            )}
                                        </div>
                                    </div>

                                    {/* 2. 고객 정보 */}
                                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 mb-1">👤 고객명</label>
                                            <input
                                                type="text"
                                                className="w-full p-3 border border-gray-300 rounded-lg text-sm font-bold outline-none focus:border-indigo-500 transition"
                                                placeholder="예: 홍길동"
                                                value={singleData.name}
                                                onChange={(e) => setSingleData(prev => ({ ...prev, name: e.target.value }))}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 mb-1">📞 연락처</label>
                                            <input
                                                type="text"
                                                className="w-full p-3 border border-gray-300 rounded-lg text-sm font-mono outline-none focus:border-indigo-500 transition"
                                                placeholder="예: 010-1234-5678"
                                                value={singleData.phone}
                                                onChange={(e) => setSingleData(prev => ({ ...prev, phone: e.target.value }))}
                                                onKeyPress={(e) => {
                                                    if (e.key === 'Enter') handleSingleSubmit();
                                                }}
                                            />
                                        </div>
                                    </div>

                                    {/* 3. 상담 내용 */}
                                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex-1">
                                        <label className="block text-xs font-bold text-gray-500 mb-1">💬 상담/특이사항 (Memo)</label>
                                        <textarea
                                            className="w-full h-24 p-3 border border-gray-300 rounded-lg text-sm outline-none focus:border-indigo-500 resize-none transition"
                                            placeholder="초기 상담 내용을 입력하세요..."
                                            value={singleData.memo}
                                            onChange={(e) => setSingleData(prev => ({ ...prev, memo: e.target.value }))}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* [B] 엑셀 일괄 등록 모드 (기존 코드 유지) */}
                            {uploadMode === 'bulk' && (
                                <div className="flex flex-col gap-4 h-full">
                                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 text-xs text-blue-700">
                                        💡 엑셀에서 복사(Ctrl+C)한 데이터를 아래 칸에 붙여넣기(Ctrl+V) 하세요.<br />
                                        (순서: <strong>플랫폼 / 이름 / 전화번호 / 상담내용</strong>)
                                    </div>
                                    <textarea
                                        className="w-full h-32 bg-white border border-gray-300 rounded-xl p-4 text-xs font-mono outline-none focus:border-indigo-500 transition resize-none"
                                        placeholder={`[데이터 예시]\n기타\t홍길동\t010-1234-5678\t가입문의\n당근\t김철수\t010-9876-5432\t요금상담`}
                                        value={pasteData}
                                        onChange={(e) => setPasteData(e.target.value)}
                                        onPaste={handlePaste}
                                    />
                                    <div className="flex-1 overflow-y-auto border border-gray-200 rounded-xl custom-scrollbar bg-white">
                                        <table className="w-full text-xs text-left">
                                            <thead className="bg-gray-100 font-bold text-gray-600 sticky top-0">
                                                <tr>
                                                    <th className="p-2 w-10">No.</th>
                                                    <th className="p-2 w-20">플랫폼</th>
                                                    <th className="p-2 w-20">이름</th>
                                                    <th className="p-2 w-28">전화번호</th>
                                                    <th className="p-2">메모</th>
                                                    <th className="p-2 w-10 text-center">삭제</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-50">
                                                {parsedData.map((row, idx) => (
                                                    <tr key={row.id}>
                                                        <td className="p-2 text-gray-400">{idx + 1}</td>
                                                        <td className="p-2">{row.platform}</td>
                                                        <td className="p-2 font-bold">{row.name}</td>
                                                        <td className="p-2">{row.phone}</td>
                                                        <td className="p-2 truncate max-w-[100px]">{row.last_memo}</td>
                                                        <td className="p-2 text-center"><button onClick={() => handleDeleteParsedRow(row.id)} className="text-red-400 font-bold">×</button></td>
                                                    </tr>
                                                ))}
                                                {parsedData.length === 0 && <tr><td colSpan="6" className="p-10 text-center text-gray-400">데이터가 없습니다.</td></tr>}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 3. 하단 버튼 */}
                        <div className="p-4 border-t border-gray-200 bg-white flex justify-end gap-2 shrink-0">
                            <button onClick={() => setShowUploadModal(false)} className="px-5 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition">취소</button>
                            {uploadMode === 'single' ? (
                                <button
                                    onClick={handleSingleSubmit}
                                    className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-md transition flex items-center gap-2"
                                >
                                    <span>💾 등록하기</span>
                                </button>
                            ) : (
                                <button
                                    onClick={handleBulkSubmit}
                                    className="px-8 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 shadow-md transition flex items-center gap-2"
                                    disabled={parsedData.length === 0}
                                >
                                    <span>🚀 {parsedData.length}건 일괄 등록</span>
                                </button>
                            )}
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

            {/* 🟢 [수정됨] 정책표 뷰어 (독립 팝업 + 공지사항 + 확대/스크롤) */}
            {showPolicyViewer && (
                <PopoutWindow
                    title="📢 정책 및 공지사항 통합 뷰어"
                    onClose={() => setShowPolicyViewer(false)}
                    width={1000}
                    height={800}
                    windowKey="admin_policy_viewer_pos" // 위치 기억 키
                >
                    <div className="flex flex-col h-screen bg-slate-50 font-sans relative">

                        {/* 1. 뷰어 상단 헤더 (정책 vs 공지사항 탭) */}
                        <div className="bg-indigo-900 p-3 flex justify-between items-center text-white shrink-0 shadow-md z-20">
                            <div className="flex gap-4 items-center">
                                <h2 className="text-lg font-bold flex items-center gap-2">🏢 통합 뷰어</h2>
                                <div className="flex bg-indigo-800 rounded-lg p-1">
                                    <button
                                        onClick={() => setViewerTab('policy')}
                                        className={`px-4 py-1.5 rounded-md text-sm font-bold transition ${viewerTab === 'policy' ? 'bg-white text-indigo-900 shadow' : 'text-indigo-200 hover:bg-indigo-700'}`}
                                    >
                                        🖼️ 정책표
                                    </button>
                                    <button
                                        onClick={() => setViewerTab('notice')}
                                        className={`px-4 py-1.5 rounded-md text-sm font-bold transition ${viewerTab === 'notice' ? 'bg-white text-indigo-900 shadow' : 'text-indigo-200 hover:bg-indigo-700'}`}
                                    >
                                        📢 공지사항
                                    </button>
                                </div>
                            </div>
                            <div className="text-xs text-indigo-300">
                                {viewerTab === 'policy' ? '이미지를 클릭하면 확대됩니다.' : '공지사항을 확인하세요.'}
                            </div>
                        </div>

                        {/* 2. 메인 컨텐츠 영역 */}
                        <div className="flex-1 overflow-hidden relative">

                            {/* [A] 정책표 모드 */}
                            {viewerTab === 'policy' && (
                                <div className="flex flex-col h-full">
                                    {/* 통신사 선택 탭 */}
                                    <div className="bg-white p-3 border-b border-gray-200 flex gap-2 overflow-x-auto hide-scrollbar shrink-0 shadow-sm z-10">
                                        {(config?.policy_tabs || ['KT', 'SK', 'LG', 'SK POP', 'SKY LIFE']).map(p => (
                                            <button
                                                key={p}
                                                onClick={() => setViewerPlatform(p)}
                                                className={`px-5 py-2 rounded-full font-bold text-sm transition shadow-sm whitespace-nowrap border
                                                ${viewerPlatform === p
                                                        ? 'bg-indigo-600 text-white border-indigo-600 ring-2 ring-indigo-100'
                                                        : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}
                                            >
                                                {p}
                                            </button>
                                        ))}
                                    </div>

                                    {/* 이미지 스크롤 영역 */}
                                    <div className="flex-1 overflow-y-auto p-4 bg-slate-100 custom-scrollbar text-center">
                                        {policyImages[viewerPlatform] ? (
                                            <div className="inline-block relative group cursor-zoom-in">
                                                <img
                                                    src={policyImages[viewerPlatform]}
                                                    alt={`${viewerPlatform} 정책표`}
                                                    className="max-w-full h-auto rounded-lg shadow-lg border border-gray-300 bg-white"
                                                    onClick={() => setZoomImg(policyImages[viewerPlatform])} // 클릭 시 확대
                                                />
                                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition flex justify-center items-center pointer-events-none">
                                                    <span className="opacity-0 group-hover:opacity-100 bg-black/60 text-white px-3 py-1 rounded-full text-xs backdrop-blur-sm">🔍 클릭하여 확대</span>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center h-full text-gray-400 opacity-70">
                                                <span className="text-6xl mb-4">🖼️</span>
                                                <p className="text-lg font-bold">등록된 '{viewerPlatform}' 정책 이미지가 없습니다.</p>
                                            </div>
                                        )}
                                        {/* 👇 만약 다중 이미지를 리스트로 보여준다면 여기에 map을 돌리면 됩니다. */}
                                    </div>
                                </div>
                            )}

                            {/* [B] 공지사항 모드 */}
                            {viewerTab === 'notice' && (
                                <div className="h-full overflow-y-auto p-6 bg-white custom-scrollbar">
                                    <h3 className="font-bold text-xl text-gray-800 mb-6 flex items-center gap-2 border-b pb-4">
                                        📢 전체 공지사항 목록
                                    </h3>
                                    <div className="space-y-4">
                                        {notices && notices.length > 0 ? notices.map(n => (
                                            <div key={n.id} className={`p-5 rounded-xl border transition hover:shadow-md ${n.is_important ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
                                                <div className="flex justify-between items-start mb-2">
                                                    <div className="flex items-center gap-2">
                                                        {n.is_important && <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold shadow-sm">중요</span>}
                                                        <span className="font-bold text-lg text-gray-800">{n.title}</span>
                                                    </div>
                                                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">{n.created_at}</span>
                                                </div>
                                                <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed pl-1">
                                                    {n.content}
                                                </div>
                                                <div className="mt-3 text-right text-xs text-gray-400 font-bold">
                                                    ✍️ {n.writer_name || '관리자'}
                                                </div>
                                            </div>
                                        )) : (
                                            <div className="text-center py-20 text-gray-400">
                                                등록된 공지사항이 없습니다.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* [C] 이미지 확대 레이어 (Overlay) */}
                            {zoomImg && (
                                <div
                                    className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex justify-center items-center p-10 animate-fade-in"
                                    onClick={() => setZoomImg(null)} // 배경 클릭 시 닫기
                                >
                                    <img
                                        src={zoomImg}
                                        alt="확대보기"
                                        className="max-w-full max-h-full object-contain rounded-lg shadow-2xl scale-100"
                                        onClick={(e) => e.stopPropagation()} // 이미지 클릭 시 닫히지 않음 (선택사항)
                                    />
                                    <button
                                        onClick={() => setZoomImg(null)}
                                        className="absolute top-5 right-5 text-white bg-white/20 hover:bg-white/40 rounded-full w-10 h-10 flex justify-center items-center text-xl transition"
                                    >
                                        ✕
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </PopoutWindow>
            )}
        </div>
    );
}
export default AdminDashboard;
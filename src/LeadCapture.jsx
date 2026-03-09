// src/components/LeadCapture.jsx
import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';

const LeadCapture = () => {
    const [searchParams] = useSearchParams();
    const agentId = searchParams.get('agent_id');
    const [form, setForm] = useState({ name: '', phone: '' });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!agentId) return alert("잘못된 접근입니다.");
        setLoading(true);
        try {
            // 장고 서버의 LeadCaptureView API 호출
            await axios.post('http://127.0.0.1:8000/api/leads/capture/', {
                name: form.name,
                phone: form.phone,
                agent_id: agentId
            });
            alert("접수되었습니다! 담당자가 곧 연락드립니다.");
            setForm({ name: '', phone: '' });
        } catch (err) {
            alert("접수 중 오류가 발생했습니다.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-6">
            <div className="w-full max-w-md bg-gray-800 p-8 rounded-2xl shadow-2xl border border-gray-700">
                <h1 className="text-2xl font-bold text-center mb-2">📞 상담 신청하기</h1>
                <p className="text-gray-400 text-center mb-8 text-sm">정보를 남겨주시면 빠르게 안내 도와드립니다.</p>
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <input 
                        className="bg-gray-700 p-4 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="성함" 
                        required 
                        value={form.name}
                        onChange={e => setForm({...form, name: e.target.value})}
                    />
                    <input 
                        className="bg-gray-700 p-4 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="연락처 (010-0000-0000)" 
                        required
                        value={form.phone}
                        onChange={e => setForm({...form, phone: e.target.value})}
                    />
                    <button 
                        type="submit" 
                        disabled={loading}
                        className="bg-blue-600 hover:bg-blue-500 p-4 rounded-xl font-bold transition text-lg mt-4"
                    >
                        {loading ? "접수 중..." : "신청 완료"}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default LeadCapture;
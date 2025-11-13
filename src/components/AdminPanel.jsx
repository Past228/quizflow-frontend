import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function AdminPanel({ session }) {
    const [inviteCodes, setInviteCodes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newCode, setNewCode] = useState('');

    useEffect(() => {
        loadInviteCodes();
    }, []);

    const loadInviteCodes = async () => {
        const { data, error } = await supabase
            .from('invite_codes')
            .select('*')
            .order('created_at', { ascending: false });

        if (!error) setInviteCodes(data || []);
        setLoading(false);
    };

    const generateInviteCode = async () => {
        if (!newCode.trim()) return;

        const { error } = await supabase
            .from('invite_codes')
            .insert({
                code: newCode.trim().toUpperCase(),
                created_by: session.user.id,
                expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 дней
            });

        if (!error) {
            setNewCode('');
            loadInviteCodes();
        }
    };

    if (loading) return <div>Загрузка...</div>;

    return (
        <div style={{ padding: '20px' }}>
            <h1>Панель администратора - Управление кодами</h1>
            
            <div style={{ maxWidth: '500px' }}>
                <h2>Создать пригласительный код</h2>
                <div style={{ marginBottom: '16px' }}>
                    <input
                        type="text"
                        value={newCode}
                        onChange={(e) => setNewCode(e.target.value)}
                        placeholder="Введите код (например: TEACH123)"
                        style={{ 
                            padding: '8px', 
                            marginRight: '8px',
                            border: '1px solid #d1d5db',
                            borderRadius: '4px',
                            width: '200px'
                        }}
                    />
                    <button 
                        onClick={generateInviteCode}
                        style={{ 
                            background: '#3b82f6', 
                            color: 'white', 
                            border: 'none', 
                            padding: '8px 16px',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                    >
                        Создать код
                    </button>
                </div>

                <h2>Пригласительные коды ({inviteCodes.length})</h2>
                {inviteCodes.map(code => (
                    <div key={code.id} style={{ 
                        border: '1px solid #e5e7eb', 
                        padding: '12px', 
                        marginBottom: '8px',
                        borderRadius: '4px',
                        background: code.is_used ? '#f3f4f6' : 'white'
                    }}>
                        <strong>{code.code}</strong>
                        <div style={{ fontSize: '12px', color: '#6b7280' }}>
                            {code.is_used ? 'Использован' : 'Активен'} • 
                            Создан: {new Date(code.created_at).toLocaleDateString('ru-RU')}
                            {code.expires_at && ` • Истекает: ${new Date(code.expires_at).toLocaleDateString('ru-RU')}`}
                            {code.used_by && ` • Использован пользователем: ${code.used_by}`}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
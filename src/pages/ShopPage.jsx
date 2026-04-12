import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useStudentProfile } from '../context/StudentProfileContext';

const BONUS_GLYPH = { attempt: '↻', hint: '💡', skip: '?' };

// ─── Column component ────────────────────────────────────────────────────────

function ShopColumn({ title, items, loading, children }) {
  return (
    <div className="shop-column">
      <h2 className="shop-column__title">{title}</h2>
      <div className="shop-column__items">
        {loading ? (
          <div className="shop-col-placeholder">
            <span className="shop-col-spinner" />
          </div>
        ) : items.length === 0 ? (
          <div className="shop-col-placeholder">Нет предметов</div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

// ─── Item card ───────────────────────────────────────────────────────────────

function ShopCard({ preview, name, description, price, btnLabel, btnDisabled, btnVariant, onBuy }) {
  return (
    <article className="student-card shop-card">
      <div className="shop-card__preview">{preview}</div>
      <h3 className="shop-card__title">{name}</h3>
      {description && <p className="shop-card__desc">{description}</p>}
      <div className="shop-card__price">
        <img src="/icons/sp_coins.png" alt="" width={22} height={22} style={{ verticalAlign: 'middle' }} />
        <span className="shop-card__price-num">{price}</span>
      </div>
      <button
        type="button"
        className={`shop-card__btn shop-card__btn--${btnVariant}`}
        disabled={btnDisabled}
        onClick={onBuy}
      >
        {btnLabel}
      </button>
    </article>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function ShopPage() {
  const { profile, refreshProfile } = useStudentProfile();

  const [frames, setFrames] = useState([]);
  const [nameColors, setNameColors] = useState([]);
  const [prefixes, setPrefixes] = useState([]);
  const [bonuses, setBonuses] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [userPurchases, setUserPurchases] = useState([]);
  const [shopLoading, setShopLoading] = useState(true);
  const [shopError, setShopError] = useState(null);
  const [purchasing, setPurchasing] = useState(null);
  const [toast, setToast] = useState(null);

  // getSession() waits for the Supabase client to restore its auth token from
  // localStorage before we fire any queries, preventing silent RLS empty results.
  useEffect(() => {
    loadShopData();
  }, []);

  useEffect(() => {
    if (profile?.id) {
      loadInventory(profile.id);
      loadUserPurchases(profile.id);
    }
  }, [profile?.id]);

  // ── Data loaders ──────────────────────────────────────────────────────────

  async function loadShopData() {
    setShopLoading(true);
    setShopError(null);

    // Ensure the Supabase client has restored its session before querying.
    // Without this await the first requests may go out as anon (no bearer token)
    // and RLS silently returns [].
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setShopError('Необходимо войти в систему для просмотра магазина.');
      setShopLoading(false);
      return;
    }

    const [a, b, c, d] = await Promise.all([
      supabase.from('items_frames').select('*').order('price'),
      supabase.from('items_name_colors').select('*').order('price'),
      supabase.from('items_prefixes').select('*').order('price'),
      supabase.from('shop_bonuses').select('*').order('price'),
    ]);

    const firstError = a.error || b.error || c.error || d.error;
    if (firstError) {
      console.error('Shop query error:', firstError);
      setShopError(`Ошибка загрузки: ${firstError.message}`);
    }

    setFrames(a.data || []);
    setNameColors(b.data || []);
    setPrefixes(c.data || []);
    setBonuses(d.data || []);
    setShopLoading(false);
  }

  const loadInventory = useCallback(async (profileId) => {
    const { data } = await supabase.from('user_inventory').select('*').eq('profile_id', profileId);
    setInventory(data || []);
  }, []);

  const loadUserPurchases = useCallback(async (profileId) => {
    const { data } = await supabase.from('user_purchases').select('*').eq('profile_id', profileId);
    setUserPurchases(data || []);
  }, []);

  // ── Ownership helpers ─────────────────────────────────────────────────────

  const ownedFrame  = (id) => inventory.some((i) => i.frame_id === id);
  const ownedColor  = (id) => inventory.some((i) => i.name_color_id === id);
  const ownedPrefix = (id) => inventory.some((i) => i.prefix_id === id);
  const bonusTotal  = (bonusId) =>
    userPurchases.filter((p) => p.bonus_id === bonusId).reduce((s, p) => s + (p.amount ?? 1), 0);

  const isActiveFrame  = (id) => profile?.active_frame_id === id;
  const isActiveColor  = (id) => profile?.active_color_id === id;
  const isActivePrefix = (id) => profile?.active_prefix_id === id;

  // ── Toast ─────────────────────────────────────────────────────────────────

  function showToast(type, text) {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3500);
  }

  // ── Purchase / activate ───────────────────────────────────────────────────

  async function handleBuy(item, itemType) {
    if (!profile) return;
    const coins = profile.sp_coins ?? 0;

    if (coins < item.price) {
      showToast('error', 'Недостаточно монет!');
      return;
    }

    setPurchasing(`${itemType}_${item.id}`);
    try {
      // Deduct coins
      const { error: e1 } = await supabase
        .from('profiles')
        .update({ sp_coins: coins - item.price })
        .eq('id', profile.id);
      if (e1) throw e1;

      if (itemType === 'bonus') {
        const { error: e2 } = await supabase.from('user_purchases').insert({
          profile_id: profile.id,
          bonus_id: item.id,
          amount: 1,
          total_price: item.price,
        });
        if (e2) throw e2;
      } else {
        // Insert into inventory and immediately activate the item
        let invRow = { profile_id: profile.id };
        let profilePatch = {};
        if (itemType === 'frame') {
          invRow = { ...invRow, frame_id: item.id, item_type: 'frame' };
          profilePatch = { active_frame_id: item.id };
        } else if (itemType === 'name_color') {
          invRow = { ...invRow, name_color_id: item.id, item_type: 'name_color' };
          profilePatch = { active_color_id: item.id };
        } else if (itemType === 'prefix') {
          invRow = { ...invRow, prefix_id: item.id, item_type: 'prefix' };
          profilePatch = { active_prefix_id: item.id };
        }
        const { error: e2 } = await supabase.from('user_inventory').insert(invRow);
        if (e2) throw e2;
        // Set as active
        const { error: e3 } = await supabase.from('profiles').update(profilePatch).eq('id', profile.id);
        if (e3) throw e3;
      }

      await refreshProfile();
      await loadInventory(profile.id);
      await loadUserPurchases(profile.id);
      showToast('success', `${item.name || item.title} — куплено!`);
    } catch (err) {
      console.error('Purchase error:', err);
      showToast('error', 'Ошибка при покупке. Попробуйте снова.');
    } finally {
      setPurchasing(null);
    }
  }

  async function handleActivate(item, itemType) {
    if (!profile) return;
    setPurchasing(`${itemType}_${item.id}`);
    try {
      let patch = {};
      if (itemType === 'frame')      patch = { active_frame_id: item.id };
      else if (itemType === 'name_color') patch = { active_color_id: item.id };
      else if (itemType === 'prefix')     patch = { active_prefix_id: item.id };
      const { error } = await supabase.from('profiles').update(patch).eq('id', profile.id);
      if (error) throw error;
      await refreshProfile();
      showToast('success', `${item.name || item.title} — активировано!`);
    } catch (err) {
      console.error('Activate error:', err);
      showToast('error', 'Ошибка активации.');
    } finally {
      setPurchasing(null);
    }
  }

  // ── Button state resolver ─────────────────────────────────────────────────

  function resolveBtn(item, itemType, ownedFn, activeFn) {
    const isPurchasing = purchasing === `${itemType}_${item.id}`;
    if (isPurchasing) return { label: '…', disabled: true, variant: 'loading', onClick: null };

    if (itemType === 'bonus') {
      const count = bonusTotal(item.id);
      const canAfford = (profile?.sp_coins ?? 0) >= item.price;
      return {
        label: canAfford ? (count > 0 ? `Купить ещё (×${count})` : 'Купить') : 'Недостаточно монет',
        disabled: !canAfford,
        variant: canAfford ? 'buy' : 'broke',
        onClick: canAfford ? () => handleBuy(item, itemType) : null,
      };
    }

    if (ownedFn(item.id)) {
      if (activeFn(item.id)) {
        return { label: 'Активно', disabled: true, variant: 'active', onClick: null };
      }
      return {
        label: 'Активировать',
        disabled: false,
        variant: 'activate',
        onClick: () => handleActivate(item, itemType),
      };
    }

    const canAfford = (profile?.sp_coins ?? 0) >= item.price;
    return {
      label: canAfford ? 'Купить' : 'Недостаточно монет',
      disabled: !canAfford,
      variant: canAfford ? 'buy' : 'broke',
      onClick: canAfford ? () => handleBuy(item, itemType) : null,
    };
  }

  // ── Preview renderers ─────────────────────────────────────────────────────

  const coins = profile?.sp_coins ?? 0;

  return (
    <div className="student-page-wrap">
      <div className="student-page student-page--wide">
        <header style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, marginBottom: 8 }}>
          <h1 className="student-page-title" style={{ marginBottom: 0 }}>МАГАЗИН ПРЕДМЕТОВ</h1>
        </header>

        <div className="shop-header-balance">
          <span className="shop-header-balance__label">Монеты</span>
          <span className="shop-header-balance__value">
            <img src="/icons/sp_coins.png" alt="" width={50} height={50} style={{ verticalAlign: 'middle' }} />
            <span className="shop-balance-num">{coins}</span>
          </span>
        </div>

        {toast && <div className={`shop-toast shop-toast--${toast.type}`}>{toast.text}</div>}
        {shopError && <div className="shop-toast shop-toast--error">{shopError}</div>}

        <div className="shop-columns">
          {/* ── Frames ─────────────────────────────────────────────── */}
          <ShopColumn title="Рамки" items={frames} loading={shopLoading}>
            {frames.map((item) => {
              const btn = resolveBtn(item, 'frame', ownedFrame, isActiveFrame);
              return (
                <ShopCard
                  key={item.id}
                  name={item.name}
                  price={item.price}
                  preview={
                    <img
                      src={item.image_url}
                      alt={item.name}
                      style={{ width: 80, height: 80, objectFit: 'contain', borderRadius: 8 }}
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  }
                  btnLabel={btn.label}
                  btnDisabled={btn.disabled}
                  btnVariant={btn.variant}
                  onBuy={btn.onClick}
                />
              );
            })}
          </ShopColumn>

          {/* ── Name colours ────────────────────────────────────────── */}
          <ShopColumn title="Цвета имени" items={nameColors} loading={shopLoading}>
            {nameColors.map((item) => {
              const btn = resolveBtn(item, 'name_color', ownedColor, isActiveColor);
              return (
                <ShopCard
                  key={item.id}
                  name={item.name}
                  price={item.price}
                  preview={
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: item.hex_code }} />
                      <span style={{ color: item.hex_code, fontWeight: 900, fontSize: 20, fontFamily: 'var(--qf-font)' }}>Иван</span>
                    </div>
                  }
                  btnLabel={btn.label}
                  btnDisabled={btn.disabled}
                  btnVariant={btn.variant}
                  onBuy={btn.onClick}
                />
              );
            })}
          </ShopColumn>

          {/* ── Prefixes ────────────────────────────────────────────── */}
          <ShopColumn title="Приписки" items={prefixes} loading={shopLoading}>
            {prefixes.map((item) => {
              const btn = resolveBtn(item, 'prefix', ownedPrefix, isActivePrefix);
              return (
                <ShopCard
                  key={item.id}
                  name={item.title}
                  price={item.price}
                  preview={
                    <span style={{ fontWeight: 700, color: 'var(--qf-dark-blue)', fontSize: 22, fontFamily: 'var(--qf-font)' }}>
                      {item.title}
                    </span>
                  }
                  btnLabel={btn.label}
                  btnDisabled={btn.disabled}
                  btnVariant={btn.variant}
                  onBuy={btn.onClick}
                />
              );
            })}
          </ShopColumn>

          {/* ── Bonuses ─────────────────────────────────────────────── */}
          <ShopColumn title="Бонусы" items={bonuses} loading={shopLoading}>
            {bonuses.map((item) => {
              const btn = resolveBtn(item, 'bonus', () => false, () => false);
              return (
                <ShopCard
                  key={item.id}
                  name={item.name}
                  description={item.description}
                  price={item.price}
                  preview={
                    <span style={{ fontSize: 52, lineHeight: 1 }} aria-hidden>
                      {BONUS_GLYPH[item.id] || '★'}
                    </span>
                  }
                  btnLabel={btn.label}
                  btnDisabled={btn.disabled}
                  btnVariant={btn.variant}
                  onBuy={btn.onClick}
                />
              );
            })}
          </ShopColumn>
        </div>
      </div>

      <style>{`
        .shop-card__price-num {
          font-size: 18px;
          font-weight: var(--qf-fw-semibold);
          font-family: var(--qf-font);
          color: var(--qf-text-body);
          line-height: 1;
          transform: translateY(1.6px);
        }
        .shop-balance-num {
          font-size: 28px;
          font-weight: var(--qf-fw-black);
          font-family: var(--qf-font);
          color: var(--qf-text-body);
          line-height: 1;
          display: inline-block;
          vertical-align: middle;
          transform: translateY(3.5px);
        }
        .shop-header-balance {
          display: flex;
          justify-content: space-between;
          align-items: center;
          width: 100%;
          gap: 10px;
          font-family: var(--qf-font);
          margin-bottom: 20px;
        }
        .shop-header-balance__label {
          font-size: 35px;
          color: var(--qf-text-body);
          font-weight: var(--qf-fw-bold);
        }
        .shop-header-balance__value {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .shop-toast {
          padding: 12px 20px;
          border-radius: 10px;
          margin-bottom: 16px;
          font-weight: 600;
          text-align: center;
          font-family: var(--qf-font);
          font-size: 15px;
        }
        .shop-toast--success { background: #dcfce7; color: #166534; }
        .shop-toast--error   { background: #fee2e2; color: #991b1b; }
        .shop-columns {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 22px;
          width: 100%;
          align-items: start;
        }
        @media (max-width: 1100px) { .shop-columns { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 520px)  { .shop-columns { grid-template-columns: 1fr; } }
        .shop-column {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .shop-column__title {
          font-size: 17px;
          font-weight: var(--qf-fw-black);
          color: var(--qf-text-body);
          font-family: var(--qf-font);
          text-align: center;
          padding-bottom: 10px;
          margin: 0;
        }
        .shop-column__items {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .shop-col-placeholder {
          text-align: center;
          color: #9ca3af;
          padding: 24px 0;
          font-family: var(--qf-font);
          font-size: 14px;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 60px;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .shop-col-spinner {
          display: inline-block;
          width: 28px;
          height: 28px;
          border: 3px solid #e5e7eb;
          border-top-color: var(--qf-dark-blue, #127ab6);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        .shop-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: space-between;
          text-align: center;
          padding: 18px 14px 16px;
        }
        .shop-card__preview {
          min-height: 80px;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 12px;
        }
        .shop-card__title {
          font-size: 15px;
          font-weight: var(--qf-fw-bold);
          margin: 0 0 6px;
          color: var(--qf-text-body);
          font-family: var(--qf-font);
        }
        .shop-card__desc {
          font-size: 12px;
          color: #6b7280;
          margin: 0 0 10px;
          line-height: 1.4;
          font-family: var(--qf-font);
        }
        .shop-card__price {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          font-weight: var(--qf-fw-semibold);
          font-family: var(--qf-font);
          color: var(--qf-text-body);
          margin-bottom: 14px;
        }
        /* Button variants */
        .shop-card__btn {
          width: 100%;
          margin-top: auto;
          padding: 10px 14px;
          border-radius: 8px;
          border: none;
          font-size: 13px;
          font-weight: var(--qf-fw-semibold);
          font-family: var(--qf-font);
          cursor: pointer;
          transition: opacity 0.15s, background 0.15s;
        }
        .shop-card__btn--buy {
          background: var(--qf-dark-blue, #127ab6);
          color: #fff;
        }
        .shop-card__btn--buy:hover { opacity: 0.88; }
        .shop-card__btn--broke {
          background: #fee2e2;
          color: #b91c1c;
          cursor: not-allowed;
        }
        .shop-card__btn--activate {
          background: #dbeafe;
          color: #1e40af;
        }
        .shop-card__btn--activate:hover { background: #bfdbfe; }
        .shop-card__btn--active {
          background: #d1fae5;
          color: #065f46;
          cursor: not-allowed;
        }
        .shop-card__btn--loading {
          background: #f3f4f6;
          color: #9ca3af;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}

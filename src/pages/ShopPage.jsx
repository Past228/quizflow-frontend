import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useStudentProfile } from '../context/StudentProfileContext';

const BONUS_GLYPH = { attempt: '↻', hint: '💡', skip: '?' };

function ShopColumn({ title, items, itemType, loading, ownedCheck, bonusCountFn, purchasing, profile, onPurchase, renderPreview }) {
  return (
    <div className="shop-column">
      <h2 className="shop-column__title">{title}</h2>
      <div className="shop-column__items">
        {loading ? (
          <div className="shop-col-placeholder">Загрузка…</div>
        ) : items.length === 0 ? (
          <div className="shop-col-placeholder">Нет предметов</div>
        ) : (
          items.map((item) => {
            const owned = ownedCheck(item.id);
            const count = itemType === 'bonus' ? bonusCountFn(item.id) : 0;
            const isPurchasing = purchasing === `${itemType}_${item.id}`;
            const canAfford = (profile?.sp_coins ?? 0) >= item.price;
            const displayName = item.name || item.title;

            return (
              <article key={item.id} className="student-card shop-card">
                <div className="shop-card__preview">{renderPreview(item)}</div>
                <h3 className="shop-card__title">{displayName}</h3>
                {item.description && (
                  <p className="shop-card__desc">{item.description}</p>
                )}
                <div className="shop-card__price">
                  <img src="/icons/sp_coins.png" alt="" width={22} height={22} />
                  <span className="shop-card__price-txt">
                    <span className="qf-num" style={{ fontSize: 18 }}>{item.price}</span>
                  </span>
                </div>
                {owned && itemType !== 'bonus' ? (
                  <button type="button" className="shop-card__btn shop-card__btn--owned" disabled>
                    Куплено
                  </button>
                ) : (
                  <button
                    type="button"
                    className={`qf-btn-primary shop-card__btn${!canAfford ? ' shop-card__btn--dim' : ''}`}
                    onClick={() => onPurchase(item, itemType)}
                    disabled={isPurchasing || !profile}
                    title={!canAfford ? 'Недостаточно монет' : undefined}
                  >
                    {isPurchasing ? '…' : count > 0 ? `Купить (×${count + 1})` : 'Купить'}
                  </button>
                )}
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function ShopPage() {
  const { profile, refreshProfile } = useStudentProfile();

  const [frames, setFrames] = useState([]);
  const [nameColors, setNameColors] = useState([]);
  const [prefixes, setPrefixes] = useState([]);
  const [bonuses, setBonuses] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [userPurchases, setUserPurchases] = useState([]);
  const [shopLoading, setShopLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    loadShopData();
  }, []);

  useEffect(() => {
    if (profile?.id) {
      loadInventory(profile.id);
      loadUserPurchases(profile.id);
    }
  }, [profile?.id]);

  async function loadShopData() {
    setShopLoading(true);
    try {
      const [a, b, c, d] = await Promise.all([
        supabase.from('items_frames').select('*').order('price'),
        supabase.from('items_name_colors').select('*').order('price'),
        supabase.from('items_prefixes').select('*').order('price'),
        supabase.from('shop_bonuses').select('*').order('price'),
      ]);
      if (a.error) console.error('items_frames error:', a.error);
      if (b.error) console.error('items_name_colors error:', b.error);
      if (c.error) console.error('items_prefixes error:', c.error);
      if (d.error) console.error('shop_bonuses error:', d.error);
      setFrames(a.data || []);
      setNameColors(b.data || []);
      setPrefixes(c.data || []);
      setBonuses(d.data || []);
    } catch (err) {
      console.error('Shop load error:', err);
    } finally {
      setShopLoading(false);
    }
  }

  const loadInventory = useCallback(async (profileId) => {
    const { data, error } = await supabase
      .from('user_inventory')
      .select('*')
      .eq('profile_id', profileId);
    if (error) console.error('user_inventory error:', error);
    setInventory(data || []);
  }, []);

  const loadUserPurchases = useCallback(async (profileId) => {
    const { data, error } = await supabase
      .from('user_purchases')
      .select('*')
      .eq('profile_id', profileId);
    if (error) console.error('user_purchases error:', error);
    setUserPurchases(data || []);
  }, []);

  const ownedFrame  = (id) => inventory.some((i) => i.frame_id === id);
  const ownedColor  = (id) => inventory.some((i) => i.name_color_id === id);
  const ownedPrefix = (id) => inventory.some((i) => i.prefix_id === id);
  const bonusCountFn = (bonusId) =>
    userPurchases
      .filter((p) => p.bonus_id === bonusId)
      .reduce((sum, p) => sum + (p.amount ?? 1), 0);

  function showToast(type, text) {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3500);
  }

  async function handlePurchase(item, itemType) {
    if (!profile) return;
    const coins = profile.sp_coins ?? 0;
    if (coins < item.price) {
      showToast('error', 'Недостаточно монет!');
      return;
    }

    setPurchasing(`${itemType}_${item.id}`);
    try {
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
        let invRow = { profile_id: profile.id };
        if (itemType === 'frame')           invRow = { ...invRow, frame_id: item.id,      item_type: 'frame' };
        else if (itemType === 'name_color') invRow = { ...invRow, name_color_id: item.id, item_type: 'name_color' };
        else if (itemType === 'prefix')     invRow = { ...invRow, prefix_id: item.id,     item_type: 'prefix' };
        const { error: e2 } = await supabase.from('user_inventory').insert(invRow);
        if (e2) throw e2;
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

  const coins = profile?.sp_coins ?? 0;

  const renderFramePreview = (item) => (
    <img
      src={item.image_url}
      alt={item.name}
      style={{ width: 80, height: 80, objectFit: 'contain', borderRadius: 8 }}
      onError={(e) => { e.currentTarget.style.display = 'none'; }}
    />
  );

  const renderColorPreview = (item) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 36, height: 36, borderRadius: '50%', background: item.hex_code, flexShrink: 0 }} />
      <span style={{ color: item.hex_code, fontWeight: 900, fontSize: 20, fontFamily: 'var(--qf-font)' }}>
        Иван
      </span>
    </div>
  );

  const renderPrefixPreview = (item) => (
    <span style={{ fontWeight: 700, color: 'var(--qf-dark-blue)', fontSize: 20, fontFamily: 'var(--qf-font)' }}>
      {item.title}
    </span>
  );

  const renderBonusPreview = (item) => (
    <span style={{ fontSize: 48, lineHeight: 1 }} aria-hidden>
      {BONUS_GLYPH[item.id] || '★'}
    </span>
  );

  return (
    <div className="student-page-wrap">
      <div className="student-page student-page--wide">
        <header
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 16,
            marginBottom: 8,
          }}
        >
          <h1 className="student-page-title" style={{ marginBottom: 0 }}>
            МАГАЗИН ПРЕДМЕТОВ
          </h1>
        </header>

        <div className="shop-header-balance">
          <span className="shop-header-balance__label">Монеты</span>
          <span className="shop-header-balance__value">
            <img src="/icons/sp_coins.png" alt="" width={50} height={50} />
            <span className="qf-num" style={{ fontSize: 28 }}>{coins}</span>
          </span>
        </div>

        {toast && (
          <div className={`shop-toast shop-toast--${toast.type}`}>{toast.text}</div>
        )}

        <div className="shop-columns">
          <ShopColumn
            title="Рамки"
            items={frames}
            itemType="frame"
            loading={shopLoading}
            ownedCheck={ownedFrame}
            bonusCountFn={bonusCountFn}
            purchasing={purchasing}
            profile={profile}
            onPurchase={handlePurchase}
            renderPreview={renderFramePreview}
          />
          <ShopColumn
            title="Цвета имени"
            items={nameColors}
            itemType="name_color"
            loading={shopLoading}
            ownedCheck={ownedColor}
            bonusCountFn={bonusCountFn}
            purchasing={purchasing}
            profile={profile}
            onPurchase={handlePurchase}
            renderPreview={renderColorPreview}
          />
          <ShopColumn
            title="Приписки"
            items={prefixes}
            itemType="prefix"
            loading={shopLoading}
            ownedCheck={ownedPrefix}
            bonusCountFn={bonusCountFn}
            purchasing={purchasing}
            profile={profile}
            onPurchase={handlePurchase}
            renderPreview={renderPrefixPreview}
          />
          <ShopColumn
            title="Бонусы"
            items={bonuses}
            itemType="bonus"
            loading={shopLoading}
            ownedCheck={() => false}
            bonusCountFn={bonusCountFn}
            purchasing={purchasing}
            profile={profile}
            onPurchase={handlePurchase}
            renderPreview={renderBonusPreview}
          />
        </div>
      </div>

      <style>{`
        .qf-num {
          line-height: 1;
          display: inline-flex;
          align-items: center;
          height: 1em;
          vertical-align: middle;
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
        @media (max-width: 1100px) {
          .shop-columns { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 520px) {
          .shop-columns { grid-template-columns: 1fr; }
        }
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
          border-bottom: 2px solid #e5e7eb;
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
          padding: 20px 0;
          font-family: var(--qf-font);
          font-size: 14px;
        }
        .shop-card {
          display: flex;
          flex-direction: column;
          align-items: center;
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
          margin-bottom: 12px;
        }
        .shop-card__price-txt {
          font-weight: var(--qf-fw-semibold);
          line-height: 1;
          display: flex;
          align-items: center;
        }
        .shop-card__btn {
          width: 100%;
          margin-top: auto;
        }
        .shop-card__btn--owned {
          background: #e5e7eb;
          color: #6b7280;
          border: none;
          padding: 10px 16px;
          border-radius: 8px;
          font-size: 14px;
          cursor: not-allowed;
          width: 100%;
          font-family: var(--qf-font);
          font-weight: var(--qf-fw-semibold);
        }
        .shop-card__btn--dim { opacity: 0.55; }
      `}</style>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { budgets, categories, packages, retailPrice } from "./catalog";

const money = (value: number) => new Intl.NumberFormat("ru-RU").format(value) + " ₽";
const businessWhatsApp = "79296012248";
const recipientLabel = (recipient: Recipient) => recipient === "female" ? "Для женщины" : recipient === "male" ? "Для мужчины" : "Не выбрано";

type AlcoholMode = "included" | "separate" | "client";
type Recipient = "female" | "male" | "";
type ValidationField = "recipient" | "composition";
type BasketDraft = {
  id: number;
  budgetId: string;
  customBudget: string;
  recipient: Recipient;
  packageId: string;
  counts: Record<string, number>;
  alcoholMode: AlcoholMode;
  comment: string;
};

function PackageIcon({ basket }: { basket: boolean }) {
  return <span className={`package-illustration ${basket ? "basket-icon" : "crate-icon"}`} aria-hidden="true"><span className="package-handle" /><span className="package-body" /></span>;
}

const emptyBasket = (id: number): BasketDraft => ({
  id,
  budgetId: "",
  customBudget: "",
  recipient: "",
  packageId: "small-basket",
  counts: {},
  alcoholMode: "included",
  comment: "",
});

const calculateBasket = (basket: BasketDraft) => {
  const selectedBudget = budgets.find((item) => item.id === basket.budgetId);
  const budgetLimit = basket.budgetId === "custom" ? Number(basket.customBudget) || null : selectedBudget?.limit ?? null;
  const pack = packages.find((item) => item.id === basket.packageId) ?? packages[0];
  const count = Object.values(basket.counts).reduce((sum, value) => sum + value, 0);
  const productsTotal = categories.reduce((sum, item) => {
    if (item.id === "alcohol" && basket.alcoholMode !== "included") return sum;
    return sum + (basket.counts[item.id] ?? 0) * retailPrice(item);
  }, 0);
  const materials = count >= 5 ? 275 : 0;
  const subtotal = productsTotal + pack.base + materials;
  const service = count >= 5 ? Math.round(subtotal * 0.1) : 0;
  const total = count >= 5 ? subtotal + service : 0;
  const budgetDifference = budgetLimit && count >= 5 ? total - budgetLimit : 0;
  const overBudget = budgetDifference > 0;
  const slightOverBudget = overBudget && budgetDifference <= 2000;
  const packageUnder = count > 0 && count < pack.minItems;
  const lines = categories
    .filter((category) => (basket.counts[category.id] ?? 0) > 0)
    .map((category) => ({ id: category.id, label: category.label, count: basket.counts[category.id] ?? 0 }));

  return { budgetLimit, pack, count, total, overBudget, slightOverBudget, packageUnder, lines };
};

export default function Home() {
  const [baskets, setBaskets] = useState<BasketDraft[]>([emptyBasket(1)]);
  const [activeBasketId, setActiveBasketId] = useState(1);
  const [openGroups, setOpenGroups] = useState<string[]>([]);
  const [shareStatus, setShareStatus] = useState("");
  const [validationError, setValidationError] = useState<{ basketId: number; field: ValidationField; message: string } | null>(null);
  const [autoPackageNotice, setAutoPackageNotice] = useState<{ basketId: number; message: string } | null>(null);
  const nextBasketId = useRef(2);

  const activeBasket = baskets.find((basket) => basket.id === activeBasketId) ?? baskets[0];
  const results = useMemo(() => baskets.map((basket) => ({ basket, result: calculateBasket(basket) })), [baskets]);
  const result = results.find((item) => item.basket.id === activeBasket.id)?.result ?? calculateBasket(activeBasket);
  const activeIndex = baskets.findIndex((basket) => basket.id === activeBasket.id);
  const totalOrder = results.reduce((sum, item) => sum + item.result.total, 0);
  const groups = [...new Set(categories.map((item) => item.group))];

  useEffect(() => {
    const reportHeight = () => {
      window.parent.postMessage(
        { type: "vovkuse-calculator-height", height: document.documentElement.scrollHeight },
        "*",
      );
    };

    const observer = new ResizeObserver(reportHeight);
    observer.observe(document.documentElement);
    reportHeight();

    return () => observer.disconnect();
  }, []);

  const fittingPackage = (count: number) => [...packages]
    .filter((pack) => count >= pack.minItems && count <= pack.maxItems)
    .sort((a, b) => a.maxItems - b.maxItems || a.base - b.base)[0];

  const updateActiveBasket = (patch: Partial<BasketDraft>) => {
    setBaskets((current) => current.map((basket) => basket.id === activeBasket.id ? { ...basket, ...patch } : basket));
  };
  const changeCount = (id: string, next: number, max: number) => {
    const counts = { ...activeBasket.counts, [id]: Math.max(0, Math.min(max, next)) };
    const count = Object.values(counts).reduce((sum, value) => sum + value, 0);
    const currentPack = packages.find((pack) => pack.id === activeBasket.packageId) ?? packages[0];
    const nextPack = count > currentPack.maxItems ? fittingPackage(count) : undefined;

    updateActiveBasket({ counts, packageId: nextPack?.id ?? activeBasket.packageId });
    if (nextPack) {
      setAutoPackageNotice({ basketId: activeBasket.id, message: `Для ${count} позиций автоматически выбрано оформление «${nextPack.label}».` });
    }
    setValidationError((current) => current?.basketId === activeBasket.id && current.field === "composition" ? null : current);
  };
  const selectPackage = (packageId: string) => {
    const selectedPack = packages.find((pack) => pack.id === packageId) ?? packages[0];
    if (result.count > selectedPack.maxItems) {
      const nextPack = fittingPackage(result.count);
      if (nextPack) {
        updateActiveBasket({ packageId: nextPack.id });
        setAutoPackageNotice({ basketId: activeBasket.id, message: `«${selectedPack.label}» мала для этого состава, поэтому оставлено подходящее оформление «${nextPack.label}».` });
      } else {
        const largestPack = [...packages].sort((a, b) => b.maxItems - a.maxItems)[0];
        updateActiveBasket({ packageId: largestPack.id });
        setAutoPackageNotice(null);
      }
      return;
    }
    updateActiveBasket({ packageId });
    setAutoPackageNotice(null);
  };
  const toggleGroup = (group: string) => setOpenGroups((current) => current.includes(group) ? current.filter((x) => x !== group) : [...current, group]);
  const clearSelection = () => {
    updateActiveBasket({ counts: {}, alcoholMode: "included" });
    setShareStatus("");
    setValidationError(null);
    setAutoPackageNotice(null);
  };
  const addBasket = () => {
    const id = nextBasketId.current++;
    setBaskets((current) => [...current, emptyBasket(id)]);
    setActiveBasketId(id);
    setOpenGroups([]);
    setShareStatus("");
    setValidationError(null);
    setAutoPackageNotice(null);
    window.setTimeout(() => document.getElementById("config-start")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  };
  const removeBasket = () => {
    if (baskets.length === 1) return;
    const remaining = baskets.filter((basket) => basket.id !== activeBasket.id);
    setBaskets(remaining);
    setActiveBasketId(remaining[Math.max(0, activeIndex - 1)].id);
    setShareStatus("");
    setValidationError(null);
    setAutoPackageNotice(null);
  };

  const validateOrder = () => {
    const invalid = results.find(({ basket, result: basketResult }) => !basket.recipient || basketResult.count < 5);
    if (!invalid) {
      setValidationError(null);
      return true;
    }

    const basketIndex = baskets.findIndex((basket) => basket.id === invalid.basket.id);
    let field: ValidationField = "recipient";
    let message = `Для корзины ${basketIndex + 1} выберите, кому предназначен подарок.`;
    if (invalid.basket.recipient && invalid.result.count < 5) {
      field = "composition";
      message = `Для корзины ${basketIndex + 1} добавьте ещё ${5 - invalid.result.count} поз.`;
      setOpenGroups((current) => current.length ? current : ["Сыры и дополнения"]);
    }

    setActiveBasketId(invalid.basket.id);
    setValidationError({ basketId: invalid.basket.id, field, message });
    const targetId = field === "recipient" ? "recipient-step" : "composition-step";
    window.setTimeout(() => document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
    return false;
  };

  const orderText = () => {
    const basketTexts = results.map(({ basket, result: basketResult }, index) => {
      const composition = basketResult.lines.map((line) => `• ${line.label} — ${line.count} шт.`).join("\n");
      const alcoholText = (basket.counts.alcohol ?? 0) > 0
        ? `\nАлкоголь: ${basket.alcoholMode === "included" ? "включить в бюджет" : basket.alcoholMode === "separate" ? "рассчитать отдельно" : "алкоголь клиента"}`
        : "";
      const commentText = basket.comment.trim() ? `\nКомментарий: ${basket.comment.trim()}` : "";
      return `КОРЗИНА ${index + 1}\nПолучатель: ${recipientLabel(basket.recipient).toLowerCase()}\nБюджет: ${basketResult.budgetLimit ? money(basketResult.budgetLimit) : "не указан"}\nОформление: ${basketResult.pack.label} (${basketResult.pack.dimensions})\nКоличество позиций: ${basketResult.count}\nСостав:\n${composition}${alcoholText}${commentText}\nПредварительная стоимость: ${money(basketResult.total)}`;
    }).join("\n\n——————————\n\n");
    return `Здравствуйте! Хочу уточнить расчёт подарочного заказа ВоВкусе.\n\n${basketTexts}\n\nВсего корзин: ${baskets.length}\nОбщая предварительная стоимость: ${money(totalOrder)}.`;
  };

  const sendToWhatsApp = () => {
    if (!validateOrder()) return;
    window.open(`https://wa.me/${businessWhatsApp}?text=${encodeURIComponent(orderText())}`, "_blank", "noopener,noreferrer");
  };
  const shareOrder = async () => {
    if (!validateOrder()) return;
    const text = orderText();
    try {
      if (navigator.share) {
        await navigator.share({ title: "Подборка корзин ВоВкусе", text });
        setShareStatus("Подборкой можно отправить в почту или мессенджер.");
      } else {
        await navigator.clipboard.writeText(text);
        setShareStatus("Подборка скопирована — вставьте её в письмо или сообщение.");
      }
    } catch {
      setShareStatus("");
    }
  };

  return (
    <main>
<div className="workspace">
        <div className="configurator">
          <fieldset className="step" id="config-start">
            <legend><span>01</span> Бюджет на корзину {activeIndex + 1}</legend>
            <div className="budget-grid budget-grid-new">{budgets.map((budget) => <button key={budget.id} className={activeBasket.budgetId === budget.id ? "choice active" : "choice"} onClick={() => updateActiveBasket({ budgetId: budget.id })}>{budget.label}</button>)}</div>
            {activeBasket.budgetId === "custom" && <label className="custom-budget"><span>Введите максимальную сумму</span><div><input inputMode="numeric" value={activeBasket.customBudget} onChange={(event) => updateActiveBasket({ customBudget: event.target.value.replace(/\D/g, "") })} placeholder="Например, 12 000" /><b>₽</b></div></label>}
          </fieldset>

          <fieldset className="step recipient-step" id="recipient-step">
            <legend><span>02</span> Для кого подарок</legend>
            {validationError?.basketId === activeBasket.id && validationError.field === "recipient" && <p className="field-prompt">{validationError.message}</p>}
            <div className="recipient-grid">
              <button className={activeBasket.recipient === "female" ? "recipient-choice active" : "recipient-choice"} onClick={() => { updateActiveBasket({ recipient: "female" }); setValidationError(null); }}><i>♀</i><strong>Для женщины</strong></button>
              <button className={activeBasket.recipient === "male" ? "recipient-choice active" : "recipient-choice"} onClick={() => { updateActiveBasket({ recipient: "male" }); setValidationError(null); }}><i>♂</i><strong>Для мужчины</strong></button>
            </div>
          </fieldset>

          <section className="step categories-step" id="composition-step">
            <div className="step-heading"><h2><span>03</span> Выберите состав и количество</h2></div>
            <p className="hint">Нажимайте «+», чтобы добавить несколько товаров одной категории</p>
            {validationError?.basketId === activeBasket.id && validationError.field === "composition" && <p className="field-prompt">{validationError.message}</p>}
            <div className="category-groups">
              {groups.map((group) => {
                const items = categories.filter((item) => item.group === group);
                const groupCount = items.reduce((sum, item) => sum + (activeBasket.counts[item.id] ?? 0), 0);
                const opened = openGroups.includes(group);
                return <div className="category-group" key={group}>
                  <button className="group-title" onClick={() => toggleGroup(group)} aria-expanded={opened}><span>{group}</span><em>{groupCount ? `${groupCount} выбрано` : ""}</em><b>{opened ? "−" : "+"}</b></button>
                  {opened && <div className="counter-grid">{items.map((item) => {
                    const value = activeBasket.counts[item.id] ?? 0;
                    return <div className={value ? "counter-row active" : "counter-row"} key={item.id}>
                      <div><strong>{item.label}</strong></div>
                      <div className="stepper" aria-label={`Количество: ${item.label}`}><button onClick={() => changeCount(item.id, value - 1, item.max)} disabled={!value}>−</button><output>{value}</output><button onClick={() => changeCount(item.id, value + 1, item.max)} disabled={value >= item.max}>+</button></div>
                    </div>;
                  })}</div>}
                </div>;
              })}
            </div>
            {(activeBasket.counts.alcohol ?? 0) > 0 && <div className="alcohol-options"><strong>Как учесть алкоголь?</strong><div>{[
              ["included", "Включить в бюджет"], ["separate", "Рассчитать отдельно"], ["client", "Алкоголь клиента"],
            ].map(([id, label]) => <button key={id} className={activeBasket.alcoholMode === id ? "active" : ""} onClick={() => updateActiveBasket({ alcoholMode: id as AlcoholMode })}>{label}</button>)}</div></div>}
          </section>

          <fieldset className="step"><legend><span>04</span> Выберите оформление</legend><div className="card-grid package-grid">{packages.map((pack) => <button key={pack.id} className={activeBasket.packageId === pack.id ? "select-card active" : "select-card"} onClick={() => selectPackage(pack.id)}><PackageIcon basket={pack.id.includes("basket")} /><strong>{pack.label}</strong><small className="package-size">{pack.dimensions}</small><small>Вмещает {pack.detail}</small></button>)}</div><p className="package-note">Размер указан по внешним габаритам; фактическая раскладка зависит от формы выбранных товаров.</p></fieldset>

          <section className="step auto-size" id="capacity-step"><h2><span>05</span> Проверка вместимости</h2><div className={result.packageUnder ? "size-result capacity-note" : "size-result"}><i>{result.packageUnder ? "+" : "✓"}</i><div><strong>{result.count < 5 ? "Для расчёта нужно от 5 позиций" : result.packageUnder ? "Состав можно дополнить" : result.count > result.pack.maxItems ? "Состав выбран" : "Состав подходит по вместимости"}</strong><small>{result.count < 5 ? `Сейчас выбрано: ${result.count}. Добавьте ещё ${5 - result.count}.` : result.packageUnder ? `Для «${result.pack.label}» добавьте ещё ${result.pack.minItems - result.count} поз.` : result.count > result.pack.maxItems ? `${result.pack.label}: ${result.pack.dimensions}.` : `${result.pack.label}: ${result.pack.dimensions}, ${result.pack.detail}.`}</small></div></div>{autoPackageNotice?.basketId === activeBasket.id && <p className="auto-package-notice">{autoPackageNotice.message}</p>}</section>

          <section className="step comment-step">
            <div className="comment-heading"><h2><span>06</span> Комментарий к корзине</h2><em>Необязательно</em></div>
            <textarea value={activeBasket.comment} onChange={(event) => updateActiveBasket({ comment: event.target.value.slice(0, 600) })} maxLength={600} placeholder="Пожелания к составу, важные уточнения или текст для открытки" aria-label={`Комментарий к корзине ${activeIndex + 1}`} />
          </section>

          <section className="basket-manager" id="basket-tabs" aria-label="Корзины в заказе">
            <div className="basket-manager-head">
              <div><span>КОРЗИНЫ В ЗАКАЗЕ</span><strong>{baskets.length === 1 ? "Корзина 1" : `${baskets.length} корзины`}</strong></div>
              <div className="manager-buttons"><button className="clear-basket" onClick={clearSelection} disabled={!result.count}>↺ Сбросить состав</button><button className="add-basket" onClick={addBasket}>+ Добавить ещё корзину</button></div>
            </div>
            <div className="basket-tabs">{baskets.map((basket, index) => {
              const basketResult = results[index].result;
              return <button key={basket.id} className={basket.id === activeBasket.id ? "basket-tab active" : "basket-tab"} onClick={() => { setActiveBasketId(basket.id); window.setTimeout(() => document.getElementById("config-start")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0); }}><span>Корзина {index + 1}</span><small>{basketResult.count} поз. · {money(basketResult.total)}</small></button>;
            })}</div>
            {baskets.length > 1 && <div className="basket-actions"><span>Сейчас редактируется корзина {activeIndex + 1}</span><button onClick={removeBasket}>Удалить эту корзину</button></div>}
          </section>
        </div>

        <aside className="summary" id="summary" aria-live="polite">
          <p className="summary-label">ВАШ ЗАКАЗ</p>
          {baskets.length > 1 && <div className="order-overview">{results.map(({ basket, result: basketResult }, index) => <button key={basket.id} className={basket.id === activeBasket.id ? "active" : ""} onClick={() => setActiveBasketId(basket.id)}><span>Корзина {index + 1}<small>{basketResult.count} позиций</small></span><strong>{money(basketResult.total)}</strong></button>)}</div>}
          <div className="price"><small>{baskets.length > 1 ? "Предварительная стоимость заказа" : "Предварительная стоимость"}</small><strong>{money(totalOrder)}</strong></div>
          <div className="divider" />
          {baskets.length > 1 && <p className="editing-label">СОСТАВ КОРЗИНЫ {activeIndex + 1}</p>}
          {!result.count ? <p className="empty">Выберите состав. Расчёт начнётся после добавления пяти товарных позиций.</p> : <><h2>{result.count < 5 ? "Слишком мало позиций" : "Состав корзины:"}</h2><ul className="composition">{result.lines.map((line) => <li key={line.id}><span>✓</span>{line.label} — {line.count} шт.</li>)}<li><span>✓</span>оформление: {result.pack.label.toLowerCase()}</li></ul></>}
          {!activeBasket.recipient && <p className="recipient-warning">Выберите, для кого предназначен подарок.</p>}
          {result.count > 0 && result.count < 5 && <p className="warning">Для расчёта нужно минимум 5 позиций. Добавьте ещё {5 - result.count}.</p>}
          {result.count >= 5 && result.packageUnder && <p className="balance">Состав можно дополнить ещё на {result.pack.minItems - result.count} поз.</p>}
          {result.count >= 5 && result.overBudget && <p className={result.slightOverBudget ? "budget-message slight" : "budget-message"}>{result.slightOverBudget ? "Предварительная стоимость немного выше выбранного бюджета. Итог может измениться после согласования состава." : "Предварительная стоимость выше выбранного бюджета. При согласовании мы предложим подходящие замены и скорректируем состав."}</p>}
          {result.count >= 5 && result.budgetLimit && !result.overBudget && <p className="success">Предварительно укладываемся в выбранный бюджет.</p>}
          {(activeBasket.counts.alcohol ?? 0) > 0 && activeBasket.alcoholMode !== "included" && <p className="balance">{activeBasket.alcoholMode === "separate" ? "Стоимость алкоголя будет рассчитана отдельно." : "Алкоголь клиента не включён в итоговую стоимость."}</p>}
          {activeBasket.comment.trim() && <div className="summary-comment"><strong>Комментарий</strong><p>{activeBasket.comment.trim()}</p></div>}
          <dl className="details"><div><dt>Для кого</dt><dd>{recipientLabel(activeBasket.recipient)}</dd></div><div><dt>Оформление</dt><dd>{result.pack.label}</dd></div><div><dt>Размер</dt><dd>{result.pack.dimensions}</dd></div><div><dt>Вместимость</dt><dd>{result.pack.detail}</dd></div><div><dt>Товарных позиций</dt><dd>{result.count}</dd></div></dl>
          <button className="order-button" onClick={sendToWhatsApp}>Уточнить состав и стоимость в WhatsApp <span>→</span></button>
          <button className="share-button" onClick={shareOrder}>Поделиться подборкой</button>
          {shareStatus && <p className="share-status">{shareStatus}</p>}
        </aside>
      </div>

      <button className="mobile-total" onClick={() => document.getElementById("summary")?.scrollIntoView({ behavior: "smooth" })}><span><b>{baskets.length}</b> {baskets.length === 1 ? "корзина" : "корзины"}</span><strong>{money(totalOrder)}</strong><i>↑</i></button>
    </main>
  );
}

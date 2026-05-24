import { useState } from 'react';
import { USE_CASE_TABS } from './landingContent';
import { ProductVisual } from './ProductVisual';
import styles from './landing.module.css';

export function UseCaseTabs() {
  const [activeId, setActiveId] = useState(USE_CASE_TABS[0].id);
  const active = USE_CASE_TABS.find((t) => t.id === activeId) ?? USE_CASE_TABS[0];

  return (
    <section className={styles.useCaseSection} aria-labelledby="use-cases-heading">
      <div className={styles.sectionInner}>
        <header className={styles.sectionHeaderCentered}>
          <h2 id="use-cases-heading" className={styles.sectionTitleLarge}>
            Один продукт — три сценария, с которых начинают команды
          </h2>
          <p className={styles.sectionLeadCentered}>
            Выберите, что важнее сейчас: общий канал, приватная переписка или созвон без смены
            сервиса.
          </p>
        </header>

        <div className={styles.useCaseShell}>
          <div className={styles.useCaseTabs} role="tablist" aria-label="Сценарии использования">
            {USE_CASE_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeId === tab.id}
                aria-controls={`use-case-panel-${tab.id}`}
                id={`use-case-tab-${tab.id}`}
                className={`${styles.useCaseTab} ${activeId === tab.id ? styles.useCaseTabActive : ''}`}
                onClick={() => setActiveId(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div
            className={styles.useCasePanel}
            role="tabpanel"
            id={`use-case-panel-${active.id}`}
            aria-labelledby={`use-case-tab-${active.id}`}
          >
            <div className={styles.useCaseCopy}>
              <h3 className={styles.useCaseTitle}>{active.title}</h3>
              <p className={styles.useCaseLead}>{active.lead}</p>
              <ul className={styles.useCasePoints}>
                {active.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </div>
            <ProductVisual variant={active.visual} />
          </div>
        </div>
      </div>
    </section>
  );
}

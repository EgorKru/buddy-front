import Link from 'next/link';
import { useState } from 'react';
import styles from './landing.module.css';
import { useLandingEffects } from './useLandingEffects';
import {
  NAV_LINKS,
  HERO,
  AI_SCENARIOS,
  WHY_PAGER,
  WORKSPACE_FEATURES,
  VOICE_FEATURES,
  PLATFORMS,
  AUDIENCES,
  FINAL_CTA,
  TRUSTED_LOGOS,
} from './landingContent';
import { VoiceTaskDemo } from './VoiceTaskDemo';

function revealClassName(extra = '') {
  return [styles.reveal, extra].filter(Boolean).join(' ');
}

const MARQUEE_ITEMS = [
  'Контроль: я больше ничего не забываю',
  'Спокойствие: мне не нужно держать всё в голове',
  'Поддержка: система реально помогает',
  'Порядок: мой хаос структурирован',
  'Эффективность: меньше рутины, больше результата',
  '24k+ людей и команд уже с Pager',
];

function HeroMock() {
  return (
    <div className={styles.heroMock} aria-hidden>
      <div className={styles.mockWindow}>
        <div className={styles.mockTitlebar}>
          <span />
          <span />
          <span />
          <span className={styles.mockTitle}>Pager</span>
        </div>
        <div className={styles.mockBody}>
          <div className={styles.mockMessageUser}>Надо сходить в ресторан в 19:30</div>
          <div className={styles.mockMessageAi}>
            <span className={styles.mockAiLabel}>Pager</span>
            <p>Нашёл 3 ресторана рядом с хорошими отзывами. Добавить в календарь на 19:30?</p>
            <ul className={styles.mockAiSteps}>
              <li>Рестораны и отзывы</li>
              <li>Бронирование</li>
              <li>Маршрут</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export function LandingPage() {
  useLandingEffects(styles.revealVisible);
  const [activeExamples, setActiveExamples] = useState(() =>
    Object.fromEntries(WHY_PAGER.map((item) => [item.title, item.bullets[0]?.label || '']))
  );

  return (
    <div className={styles.page} data-theme="light">
      <nav className={styles.nav}>
        <Link href="/" className={styles.navLogo}>
          Pager
        </Link>
        <div className={styles.navLinks}>
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href} data-nav-link className={styles.navLink}>
              {link.label}
            </a>
          ))}
        </div>
        <div className={styles.navActions}>
          <Link href={HERO.secondaryCta.href} className={styles.navLogin}>
            {HERO.secondaryCta.label}
          </Link>
          <Link href={HERO.primaryCta.href} className={styles.navCta}>
            Начать ↗
          </Link>
        </div>
      </nav>

      <header className={styles.hero}>
        <div className={`${styles.orb} ${styles.orb1}`} aria-hidden />
        <div className={`${styles.orb} ${styles.orb2}`} aria-hidden />

        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <h1>
              {HERO.headline.replace(' для жизни и работы', '')}
              <br />
              <span className={styles.gradient}>для жизни и работы</span>
            </h1>

            <p className={styles.heroSub}>{HERO.subheadline}</p>
          </div>

          <HeroMock />
        </div>
      </header>

      <div className={styles.triggersStrip} aria-label="Ключевые преимущества Pager">
        <div className={styles.triggersMarquee}>
          {MARQUEE_ITEMS.map((item, index) => (
            <span key={`primary-${index}`} className={styles.triggersMarqueeItem}>
              {item}
            </span>
          ))}
        </div>
        <div className={styles.triggersMarquee} aria-hidden>
          {MARQUEE_ITEMS.map((item, index) => (
            <span key={`duplicate-${index}`} className={styles.triggersMarqueeItem}>
              {item}
            </span>
          ))}
        </div>
      </div>

      <section className={styles.trustedSection}>
        <h2>Нам доверяют</h2>
        <p>Личные пользователи, стартапы и продуктовые команды</p>
        <div className={styles.trustedLogos}>
          {TRUSTED_LOGOS.map((logo) => (
            <span key={logo} className={styles.trustedLogoItem}>
              {logo}
            </span>
          ))}
        </div>
      </section>

      <section id="ai" className={styles.sectionAi}>
        <div className={`${styles.sectionHeader} ${revealClassName()}`} data-reveal>
          <div className={styles.sectionEyebrow}>AI-помощь</div>
          <h2 className={styles.sectionTitle}>
            Написали — Pager
            <br />
            <span className={styles.gradientSoft}>уже помогает</span>
          </h2>
          <p className={styles.sectionSub}>
            Одно сообщение — и ассистент понимает, что нужно сделать. Без сложных команд и настроек.
          </p>
        </div>

        <div className={styles.scenariosGrid}>
          {AI_SCENARIOS.map((scenario) => (
            <article key={scenario.id} className={revealClassName(styles.scenarioCard)} data-reveal>
              <div className={styles.scenarioLabel}>{scenario.label}</div>
              <div className={styles.scenarioMessage}>{scenario.message}</div>
              <ol className={styles.scenarioSteps}>
                {scenario.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </article>
          ))}
        </div>
      </section>

      <section id="why" className={styles.sectionWhy}>
        <div className={`${styles.sectionHeader} ${revealClassName()}`} data-reveal>
          <div className={styles.sectionEyebrow}>Почему Pager</div>
          <h2 className={styles.sectionTitle}>
            Ваш второй мозг,
            <br />
            который снимает нагрузку
          </h2>
          <p className={styles.sectionSub}>
            Pager понимает контекст, уменьшает хаос и помогает не забывать важное — в личной жизни и
            на работе.
          </p>
        </div>

        <div className={styles.whyGrid}>
          {WHY_PAGER.map((item) => (
            <div key={item.title} className={revealClassName(styles.whyCard)} data-reveal>
              {item.icon ? <div className={styles.whyIcon}>{item.icon}</div> : null}
              <h3>{item.title}</h3>
              <p>{item.description}</p>
              <ul className={styles.whyBullets}>
                {item.bullets.map((bullet) => (
                  <li key={bullet.label}>
                    <button
                      type="button"
                      className={
                        activeExamples[item.title] === bullet.label
                          ? `${styles.whyChip} ${styles.whyChipActive}`
                          : styles.whyChip
                      }
                      onClick={() =>
                        setActiveExamples((prev) => ({ ...prev, [item.title]: bullet.label }))
                      }
                    >
                      {bullet.label}
                    </button>
                  </li>
                ))}
              </ul>
              <div className={styles.whyExample}>
                {
                  item.bullets.find((bullet) => bullet.label === activeExamples[item.title])
                    ?.example
                }
              </div>
            </div>
          ))}
        </div>

        <div className={styles.audienceGrid}>
          {AUDIENCES.map((audience) => (
            <div key={audience.title} className={revealClassName(styles.audienceCard)} data-reveal>
              <h3>{audience.title}</h3>
              <p>{audience.description}</p>
              <ul>
                {audience.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section id="workspace" className={styles.sectionWorkspace}>
        <div className={styles.workspaceLayout}>
          <div className={revealClassName()} data-reveal>
            <div className={styles.sectionEyebrow}>Рабочее пространство</div>
            <h2 className={styles.sectionTitle}>
              Встречи, идеи и задачи —
              <br />в одном умном месте
            </h2>
            <p className={styles.sectionSub}>
              Совместная работа без разрозненных инструментов: от брейншторма до задач после
              встречи.
            </p>
          </div>

          <div className={`${styles.workspaceList} ${revealClassName()}`} data-reveal>
            {WORKSPACE_FEATURES.map((feature) => (
              <div key={feature.title} className={styles.workspaceItem}>
                <span className={styles.workspaceDot} aria-hidden />
                <div>
                  <h4>{feature.title}</h4>
                  <p>{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={`${styles.workspacePreview} ${revealClassName()}`} data-reveal>
          <div className={styles.previewPanel}>
            <span className={styles.previewTag}>После встречи</span>
            <h4>Итоги: Sprint planning</h4>
            <p>3 решения · 5 задач · 2 напоминания</p>
          </div>
          <div className={styles.previewPanel}>
            <span className={styles.previewTag}>Задачи</span>
            <ul>
              <li>Обновить API-документацию — пятница</li>
              <li>Согласовать дизайн с командой</li>
              <li>Отправить summary в чат</li>
            </ul>
          </div>
        </div>
      </section>

      <section id="voice" className={styles.sectionVoice}>
        <div className={`${styles.sectionHeader} ${revealClassName()}`} data-reveal>
          <div className={styles.sectionEyebrow}>Голосовой ассистент</div>
          <h2 className={styles.sectionTitle}>
            Скажите &laquo;Привет, Pager&raquo; — и дело сделано
          </h2>
          <p className={styles.sectionSub}>
            Естественное голосовое взаимодействие: задачи, планирование и напоминания — без
            клавиатуры.
          </p>
        </div>

        <div className={styles.voiceLayout}>
          <div className={`${styles.voiceOrb} ${revealClassName()}`} data-reveal>
            <VoiceTaskDemo />
          </div>

          <div className={styles.voiceFeatures}>
            {VOICE_FEATURES.map((feature) => (
              <div key={feature.label} className={revealClassName(styles.voiceCard)} data-reveal>
                <h4>{feature.label}</h4>
                <p>{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="platforms" className={styles.sectionPlatforms}>
        <div className={`${styles.sectionHeader} ${revealClassName()}`} data-reveal>
          <div className={styles.sectionEyebrow}>Везде с вами</div>
          <h2 className={styles.sectionTitle}>Один Pager — все платформы</h2>
          <p className={styles.sectionSub}>
            Начните в вебе, продолжите на телефоне или в десктопе — ваш контекст всегда под рукой.
          </p>
        </div>

        <div className={styles.platformsGrid}>
          {PLATFORMS.map((platform) => (
            <div key={platform.name} className={revealClassName(styles.platformCard)} data-reveal>
              <span className={styles.platformIcon}>{platform.icon}</span>
              <h3>{platform.name}</h3>
              <p>{platform.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="cta" className={styles.sectionCta}>
        <div className={styles.orbCta} aria-hidden />
        <h2 className={revealClassName()} data-reveal>
          {FINAL_CTA.headline.split(' — ')[0]}
          <br />
          <span className={styles.gradient}>{FINAL_CTA.headline.split(' — ')[1]}</span>
        </h2>
        <p className={revealClassName()} data-reveal>
          {FINAL_CTA.subheadline}
        </p>
        <div
          className={`${styles.heroActions} ${styles.ctaActions} ${revealClassName()}`}
          data-reveal
        >
          <Link href={FINAL_CTA.primaryCta.href} className={styles.btnPrimary}>
            {FINAL_CTA.primaryCta.label}
          </Link>
          <Link href={FINAL_CTA.secondaryCta.href} className={styles.btnGhost}>
            {FINAL_CTA.secondaryCta.label}
          </Link>
        </div>
      </section>

      <footer className={styles.footer}>
        <span className={styles.footerLogo}>Pager</span>
        <span>Интеллектуальный ассистент для жизни и работы</span>
        <span>© 2026 Pager</span>
      </footer>
    </div>
  );
}

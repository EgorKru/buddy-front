import { CheckCircle2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { VOICE_DEMO_PRESETS } from './landingContent';
import { parseVoiceToTask } from './lib/parseVoiceToTask';
import { VoiceDemoIcon } from './VoiceDemoIcon';
import styles from './voiceTaskDemo.module.css';

const PROCESSING_MS = 1100;

function getSpeechRecognition() {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export function VoiceTaskDemo() {
  const recognitionRef = useRef(null);
  const [phase, setPhase] = useState('idle');
  const [statusText, setStatusText] = useState('Выберите фразу или нажмите микрофон');
  const [parsed, setParsed] = useState(null);
  const [speechSupported, setSpeechSupported] = useState(false);

  useEffect(() => {
    setSpeechSupported(Boolean(getSpeechRecognition()));
  }, []);

  const showResult = useCallback((transcript) => {
    const task = parseVoiceToTask(transcript);
    setParsed(task);
    setPhase('result');
    setStatusText('Pager распознал и создал задачу');
  }, []);

  const runDemo = useCallback(
    (phrase) => {
      setParsed(null);
      setPhase('processing');
      setStatusText('Pager слушает…');

      window.setTimeout(() => {
        setStatusText('Разбираю фразу…');
        window.setTimeout(() => showResult(phrase), 400);
      }, PROCESSING_MS);
    },
    [showResult]
  );

  const stopRecognition = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
  }, []);

  useEffect(() => () => stopRecognition(), [stopRecognition]);

  const startMic = useCallback(() => {
    const SpeechRecognitionCtor = getSpeechRecognition();
    if (!SpeechRecognitionCtor) return;

    stopRecognition();
    setParsed(null);
    setPhase('listening');
    setStatusText('Говорите…');

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = 'ru-RU';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim();
      if (!transcript) {
        setPhase('idle');
        setStatusText('Не расслышал — попробуйте ещё раз или выберите фразу');
        return;
      }
      setPhase('processing');
      setStatusText('Разбираю фразу…');
      window.setTimeout(() => showResult(transcript), 500);
    };

    recognition.onerror = () => {
      setPhase('idle');
      setStatusText('Микрофон недоступен — выберите готовую фразу ниже');
    };

    recognition.onend = () => {
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [showResult, stopRecognition]);

  const isBusy = phase === 'listening' || phase === 'processing';
  const waveActive = phase === 'listening' || phase === 'processing';

  return (
    <div className={styles.demo}>
      <span className={styles.demoBadge}>Демо · без регистрации</span>

      <div
        className={[styles.wave, waveActive ? styles.waveActive : styles.waveIdle].join(' ')}
        aria-hidden
      >
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>

      <p className={styles.status} role="status" aria-live="polite">
        {statusText}
      </p>

      {speechSupported ? (
        <>
          <button
            type="button"
            className={[styles.micBtn, phase === 'listening' ? styles.micBtnActive : ''].join(' ')}
            onClick={startMic}
            disabled={isBusy}
            aria-label="Надиктовать задачу"
          >
            <VoiceDemoIcon name="mic" size={22} className={styles.micIcon} />
          </button>
          <p className={styles.micHint}>Или выберите пример фразы</p>
        </>
      ) : null}

      <div className={styles.presets}>
        {VOICE_DEMO_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className={styles.presetBtn}
            onClick={() => runDemo(preset.phrase)}
            disabled={isBusy}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {parsed ? (
        <div className={styles.result}>
          <div className={styles.transcriptBlock}>
            <span className={styles.transcriptLabel}>Вы сказали</span>
            <p className={styles.transcript}>&laquo;{parsed.transcript}&raquo;</p>
          </div>

          <div className={styles.pagerPanel}>
            <span className={styles.pagerPanelTitle}>Pager понял и сделал</span>
            <ul className={styles.pagerSteps}>
              {parsed.pagerSteps.map((step) => (
                <li key={step}>
                  <CheckCircle2
                    size={14}
                    className={styles.stepIcon}
                    strokeWidth={2.25}
                    aria-hidden
                  />
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          </div>

          <article className={styles.taskCard}>
            <div className={styles.taskCardHeader}>
              <span className={styles.taskKind}>
                {parsed.kind === 'reminder' ? 'Напоминание' : 'Задача'}
              </span>
              <span className={styles.taskStatus}>Создано</span>
            </div>

            <h4 className={styles.taskTitle}>{parsed.title}</h4>

            <div className={styles.taskMetaGrid}>
              <div className={styles.taskMetaItem}>
                <span className={styles.taskMetaIcon}>
                  <VoiceDemoIcon name="calendar" size={18} />
                </span>
                <div>
                  <span className={styles.taskMetaLabel}>Дата</span>
                  <span className={styles.taskMetaValue}>{parsed.datePart || 'Не указана'}</span>
                </div>
              </div>
              <div className={styles.taskMetaItem}>
                <span className={styles.taskMetaIcon}>
                  <VoiceDemoIcon name="clock" size={18} />
                </span>
                <div>
                  <span className={styles.taskMetaLabel}>Время</span>
                  <span className={styles.taskMetaValue}>{parsed.timePart || '—'}</span>
                </div>
              </div>
              <div className={styles.taskMetaItem}>
                <span className={styles.taskMetaIcon}>
                  <VoiceDemoIcon name="priority" size={18} />
                </span>
                <div>
                  <span className={styles.taskMetaLabel}>Приоритет</span>
                  <span className={styles.taskMetaValue}>{parsed.priority}</span>
                </div>
              </div>
            </div>

            <div className={styles.taskTags}>
              <span className={styles.taskTag}>{parsed.category}</span>
              <span className={styles.taskTag}>Голосовой ввод</span>
              {parsed.dueLabel ? (
                <span className={styles.taskTagAccent}>Срок: {parsed.dueLabel}</span>
              ) : null}
            </div>

            <div className={styles.integrations}>
              <span className={styles.integrationsTitle}>Куда попадёт</span>
              <ul className={styles.integrationsList}>
                {parsed.integrations.map((item) => (
                  <li key={item.label}>
                    <span className={styles.integrationIcon}>
                      <VoiceDemoIcon name={item.iconId} size={16} />
                    </span>
                    {item.label}
                  </li>
                ))}
              </ul>
            </div>
          </article>
        </div>
      ) : null}
    </div>
  );
}

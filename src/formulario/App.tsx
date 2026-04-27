import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { ThemeProvider } from 'next-themes';
import { CheckCircle2, HeartHandshake, LoaderCircle, Send } from 'lucide-react';
import { getDynamicFormConfig, PublicFormApiError, submitDynamicForm } from './api';
import type { DynamicFormPublicPayload, DynamicFormQuestion } from './types';

const BARCA_LOGO_URL = new URL('../imports/logo-barca.png', import.meta.url).href;
const CHURCH_LOGO_URL = new URL(
  '../imports/logo-iglesia-pequeno-trimmed.png',
  import.meta.url,
).href;
const FORM_IMAGE_URL = new URL(
  '../imports/Diseño_sin_título__2_-removebg-preview.png',
  import.meta.url,
).href;

type SubmissionState = 'idle' | 'submitting' | 'success' | 'error';

function createInitialValues(questions: DynamicFormQuestion[]) {
  return questions.reduce<Record<string, string>>((values, question) => {
    values[question.key] = '';
    return values;
  }, {});
}

function renderQuestionInput(
  question: DynamicFormQuestion,
  value: string,
  onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void,
) {
  const baseClassName =
    'mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-800 shadow-sm outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100 dark:border-slate-500/60 dark:bg-slate-900/70 dark:text-slate-100 dark:focus:border-cyan-300 dark:focus:ring-cyan-500/20';

  if (question.type === 'textarea') {
    return (
      <textarea
        id={question.key}
        name={question.key}
        value={value}
        onChange={onChange}
        required={question.required}
        rows={question.rows || 6}
        placeholder={question.placeholder}
        className={`${baseClassName} resize-y`}
      />
    );
  }

  return (
    <input
      id={question.key}
      name={question.key}
      type={question.type}
      value={value}
      onChange={onChange}
      required={question.required}
      placeholder={question.placeholder}
      autoComplete={question.autoComplete}
      className={baseClassName}
    />
  );
}

function LogoOnlyNavbar() {
  return (
    <nav className="fixed left-0 right-0 top-0 z-50 overflow-hidden border-b border-gray-200 bg-white/80 backdrop-blur-lg dark:border-gray-800 dark:bg-gray-900/80">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0))]" />
      </div>

      <div className="relative container mx-auto flex items-center px-4 py-3">
        <div className="flex shrink-0 items-center gap-2">
          <img src={BARCA_LOGO_URL} alt="La Barca Logo" className="h-12 w-auto object-contain md:h-14" />
          <img
            src={CHURCH_LOGO_URL}
            alt="Cruzada Cristiana Logo"
            className="h-8 w-auto object-contain md:h-13"
          />
        </div>
      </div>
    </nav>
  );
}

export default function DynamicFormPage() {
  const [payload, setPayload] = useState<DynamicFormPublicPayload | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [submissionState, setSubmissionState] = useState<SubmissionState>('idle');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadConfig() {
      try {
        const config = await getDynamicFormConfig();
        if (cancelled) {
          return;
        }

        setPayload(config);
        setFormValues(createInitialValues(config.questions));
      } catch (error) {
        if (cancelled) {
          return;
        }

        const parsedError =
          error instanceof PublicFormApiError
            ? error
            : new PublicFormApiError('No pudimos cargar el formulario en este momento.');

        setSubmissionState('error');
        setFeedbackMessage(parsedError.message);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadConfig();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleInputChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = event.target;
    setFormValues((currentValues) => ({
      ...currentValues,
      [name]: value,
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!payload) {
      return;
    }

    setSubmissionState('submitting');
    setFeedbackMessage('');

    try {
      await submitDynamicForm(formValues);
      setSubmissionState('success');
      setFeedbackMessage(payload.settings.successMessage);
      setFormValues(createInitialValues(payload.questions));
    } catch (error) {
      const parsedError =
        error instanceof PublicFormApiError
          ? error
          : new PublicFormApiError(
              'No pudimos enviar el formulario en este momento. Intenta otra vez en unos minutos.',
            );

      setSubmissionState('error');
      setFeedbackMessage(parsedError.message);
    }
  };

  return (
    <ThemeProvider attribute="class" defaultTheme="dark">
      <div className="min-h-screen bg-white dark:bg-gray-800">
        <LogoOnlyNavbar />

        <section className="min-h-screen bg-white pb-20 pt-28 dark:bg-gray-800 md:pt-32">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-5xl">
              <div className="rounded-[32px] bg-gradient-to-br from-cyan-50 to-blue-50 p-8 shadow-xl dark:from-gray-700 dark:to-gray-600 md:p-12">
                <div className="flex flex-wrap items-center justify-center gap-5">
                  <img src={FORM_IMAGE_URL} alt="Logo La Barca" className="h-32 w-auto object-contain md:h-40" />
                  <img
                    src={CHURCH_LOGO_URL}
                    alt="Logo Cruzada Cristiana"
                    className="h-16 w-auto object-contain md:h-20"
                  />
                </div>

                {isLoading ? (
                  <div className="flex min-h-[420px] items-center justify-center">
                    <div className="flex items-center gap-3 text-slate-700 dark:text-slate-100">
                      <LoaderCircle className="h-6 w-6 animate-spin text-cyan-500" />
                      <p className="text-lg font-medium">Cargando formulario...</p>
                    </div>
                  </div>
                ) : payload ? (
                  <>
                    <div className="mt-8 text-center">
                      <div className="-translate-y-6 inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-cyan-700 shadow-sm dark:bg-slate-800/70 dark:text-cyan-200">
                        <HeartHandshake className="h-4 w-4" />
                        {payload.settings.eyebrow}
                      </div>

                      <h1 className="mt-6 text-4xl font-semibold text-slate-900 dark:text-white md:text-5xl">
                        {payload.settings.title}
                      </h1>

                      <p className="mx-auto mt-4 max-w-3xl text-lg leading-relaxed text-slate-600 dark:text-slate-200 md:text-xl">
                        {payload.settings.description}
                      </p>
                    </div>

                    <form className="mt-10" onSubmit={handleSubmit}>
                      <div className="grid gap-6 md:grid-cols-2">
                        {payload.questions.map((question) => (
                          <div
                            key={question.key}
                            className={question.layout === 'half' ? '' : 'md:col-span-2'}
                          >
                            <label
                              htmlFor={question.key}
                              className="text-base font-semibold text-slate-900 dark:text-white"
                            >
                              {question.label}
                              {question.required && <span className="ml-1 text-rose-500">*</span>}
                            </label>

                            {renderQuestionInput(
                              question,
                              formValues[question.key] || '',
                              handleInputChange,
                            )}

                            {question.helperText && (
                              <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">
                                {question.helperText}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>

                      {feedbackMessage && (
                        <div
                          className={`mt-8 rounded-2xl px-4 py-4 text-sm leading-6 ${
                            submissionState === 'success'
                              ? 'border border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-100'
                              : 'border border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-400/30 dark:bg-rose-500/10 dark:text-rose-100'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            {submissionState === 'success' ? (
                              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                            ) : (
                              <Send className="mt-0.5 h-5 w-5 shrink-0" />
                            )}
                            <p>{feedbackMessage}</p>
                          </div>
                        </div>
                      )}

                      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
                        <p className="text-sm text-slate-500 dark:text-slate-300">
                          {payload.settings.privacyNote}
                        </p>

                        <button
                          type="submit"
                          disabled={submissionState === 'submitting'}
                          className={`inline-flex items-center gap-2 rounded-2xl px-7 py-4 text-lg font-semibold text-white shadow-lg transition-all ${
                            submissionState === 'submitting'
                              ? 'cursor-not-allowed bg-slate-400'
                              : 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:scale-[1.02] hover:from-cyan-600 hover:to-blue-600'
                          }`}
                        >
                          {submissionState === 'submitting' ? (
                            <LoaderCircle className="h-5 w-5 animate-spin" />
                          ) : (
                            <Send className="h-5 w-5" />
                          )}
                          <span>
                            {submissionState === 'submitting'
                              ? 'Enviando...'
                              : payload.settings.submitButtonLabel}
                          </span>
                        </button>
                      </div>
                    </form>
                  </>
                ) : (
                  <div className="flex min-h-[420px] items-center justify-center">
                    <p className="max-w-xl text-center text-lg leading-8 text-slate-600 dark:text-slate-200">
                      {feedbackMessage || 'No pudimos cargar el formulario en este momento.'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </ThemeProvider>
  );
}

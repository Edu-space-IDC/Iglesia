import { useState, type ChangeEvent, type FormEvent } from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, HeartHandshake, Send } from 'lucide-react';
import { useInView } from './useInView';
import {
  NEW_HERE_FORM_QUESTIONS,
  NEW_HERE_FORM_SECTION_ID,
  NEW_HERE_FORM_SUBMIT_URL,
  type NewHereQuestion,
} from '../newHereConfig';

const BARCA_LOGO_URL = new URL('../../imports/logo-barca.png', import.meta.url).href;
const CHURCH_LOGO_URL = new URL(
  '../../imports/logo-cruzada-cristiana-blanco-trimmed.png',
  import.meta.url,
).href;

export const BOAT_IMAGE_URL = new URL(
  '../../imports/Diseño_sin_título__2_-removebg-preview.png',
  import.meta.url,
).href;

type FormValues = Record<string, string>;
type SubmissionState = 'idle' | 'submitting' | 'success' | 'error';

function createInitialFormValues() {
  return NEW_HERE_FORM_QUESTIONS.reduce<FormValues>((values, question) => {
    values[question.name] = '';
    return values;
  }, {});
}

function renderQuestionInput(
  question: NewHereQuestion,
  value: string,
  onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void,
) {
  const baseClassName =
    'mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-800 shadow-sm outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100 dark:border-slate-500/60 dark:bg-slate-900/70 dark:text-slate-100 dark:focus:border-cyan-300 dark:focus:ring-cyan-500/20';

  if (question.type === 'textarea') {
    return (
      <textarea
        id={question.id}
        name={question.name}
        value={value}
        onChange={onChange}
        required={question.required}
        rows={question.rows ?? 5}
        placeholder={question.placeholder}
        className={`${baseClassName} resize-y`}
      />
    );
  }

  return (
    <input
      id={question.id}
      name={question.name}
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

export function NewHereFormSection() {
  const { ref, isInView } = useInView();
  const [formValues, setFormValues] = useState<FormValues>(() => createInitialFormValues());
  const [submissionState, setSubmissionState] = useState<SubmissionState>('idle');
  const [feedbackMessage, setFeedbackMessage] = useState('');

  const isSubmitConfigured = NEW_HERE_FORM_SUBMIT_URL.trim().length > 0;

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

    if (!isSubmitConfigured) {
      setSubmissionState('error');
      setFeedbackMessage(
        'Activa la URL de envio en NEW_HERE_FORM_SUBMIT_URL para recibir respuestas en Google Sheets.',
      );
      return;
    }

    setSubmissionState('submitting');
    setFeedbackMessage('');

    const payload = new URLSearchParams();
    payload.set('source', 'la-barca-web');

    Object.entries(formValues).forEach(([fieldName, fieldValue]) => {
      payload.set(fieldName, fieldValue);
    });

    try {
      await fetch(NEW_HERE_FORM_SUBMIT_URL, {
        method: 'POST',
        mode: 'no-cors',
        body: payload,
      });

      setSubmissionState('success');
      setFeedbackMessage(
        'Gracias por compartir tu informacion. Muy pronto estaremos en contacto contigo.',
      );
      setFormValues(createInitialFormValues());
    } catch {
      setSubmissionState('error');
      setFeedbackMessage(
        'No pudimos enviar el formulario en este momento. Intenta otra vez en unos minutos.',
      );
    }
  };

  return (
    <section
      id={NEW_HERE_FORM_SECTION_ID}
      className="min-h-[calc(100vh-12rem)] bg-white pb-20 pt-28 dark:bg-gray-800 md:pt-32"
    >
      <div className="container mx-auto px-4">
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 50 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-5xl"
        >
          <div className="rounded-[32px] bg-gradient-to-br from-cyan-50 to-blue-50 p-8 shadow-xl dark:from-gray-700 dark:to-gray-600 md:p-12">
            <div className="flex flex-wrap items-center justify-center gap-5">
              <img
                src={BOAT_IMAGE_URL}
                alt="Logo La Barca"
                className="h-32 w-auto object-contain md:h-40"
              />
              <img
                src={CHURCH_LOGO_URL}
                alt="Logo Cruzada Cristiana"
                className="h-16 w-auto object-contain md:h-20"
              />
            </div>

            <div className="mt-8 text-center">
              <div className="-translate-y-6 inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-cyan-700 shadow-sm dark:bg-slate-800/70 dark:text-cyan-200">
                <HeartHandshake className="h-4 w-4" />
                Formulario de bienvenida
              </div>

              <h2 className="mt-6 text-4xl font-semibold text-slate-900 dark:text-white md:text-5xl">
                ¡NOS ALEGRA TENERTE AQUI!
              </h2>

              <p className="mx-auto mt-4 max-w-3xl text-lg leading-relaxed text-slate-600 dark:text-slate-200 md:text-xl">
                Queremos conocerte, darte la bienvenida a nuestra comunidad y orar contigo.
              </p>
            </div>

            <form className="mt-10" onSubmit={handleSubmit}>
              <div className="grid gap-6 md:grid-cols-2">
                {NEW_HERE_FORM_QUESTIONS.map((question) => (
                  <div
                    key={question.id}
                    className={question.layout === 'half' ? '' : 'md:col-span-2'}
                  >
                    <label
                      htmlFor={question.id}
                      className="text-base font-semibold text-slate-900 dark:text-white"
                    >
                      {question.label}
                      {question.required && <span className="ml-1 text-rose-500">*</span>}
                    </label>

                    {renderQuestionInput(question, formValues[question.name], handleInputChange)}

                    {question.helperText && (
                      <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">
                        {question.helperText}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {!isSubmitConfigured && (
                <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-900 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-100">
                  El formulario visual ya esta listo. Para que las respuestas lleguen a Google
                  Sheets, solo falta pegar la URL de tu Apps Script en
                  `NEW_HERE_FORM_SUBMIT_URL`.
                </div>
              )}

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
                  Tus datos se usaran solo para darte seguimiento y poder orar por ti.
                </p>

                <button
                  type="submit"
                  disabled={!isSubmitConfigured || submissionState === 'submitting'}
                  className={`inline-flex items-center gap-2 rounded-2xl px-7 py-4 text-lg font-semibold text-white shadow-lg transition-all ${
                    !isSubmitConfigured || submissionState === 'submitting'
                      ? 'cursor-not-allowed bg-slate-400'
                      : 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:scale-[1.02] hover:from-cyan-600 hover:to-blue-600'
                  }`}
                >
                  <Send className="h-5 w-5" />
                  <span>
                    {submissionState === 'submitting' ? 'Enviando...' : 'Enviar'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

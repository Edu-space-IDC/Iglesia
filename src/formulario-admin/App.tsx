import {
  useDeferredValue,
  useEffect,
  useState,
  type ComponentType,
  type FormEvent,
  type HTMLInputTypeAttribute,
  type ReactNode,
} from 'react';
import {
  BadgeCheck,
  CirclePlus,
  Download,
  FileText,
  KeyRound,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Mail,
  PencilLine,
  RefreshCw,
  Save,
  Search,
  Settings2,
  ShieldCheck,
  Trash2,
  UserRound,
} from 'lucide-react';
import {
  FormAdminApiError,
  createRecord,
  deleteAllRecords,
  deleteRecord,
  downloadRecordsExcel,
  getAdminSession,
  getBootstrap,
  getPublicConfig,
  loginAdmin,
  logoutAdmin,
  readStoredFormAdminToken,
  saveFormConfig,
  updateAccount,
  updateRecord,
  writeStoredFormAdminToken,
} from './api';
import type {
  AccountUpdateInput,
  DynamicFormBootstrapPayload,
  DynamicFormQuestion,
  DynamicFormQuestionType,
  DynamicFormRecord,
  DynamicFormSettings,
  PublicConfig,
} from '../formulario/types';

const BARCA_LOGO_URL = new URL('../imports/logo-barca.png', import.meta.url).href;
const CHURCH_LOGO_URL = new URL(
  '../imports/logo-cruzada-cristiana-blanco-trimmed.png',
  import.meta.url,
).href;

type ActiveTab = 'records' | 'form' | 'account';
type Notice =
  | { type: 'success' | 'error' | 'info'; message: string; details?: string[] }
  | null;
type RecordSelection = number | 'new' | null;
type RefreshDashboardOptions = {
  background?: boolean;
};

const AUTO_REFRESH_INTERVAL_MS = 10000;
const EMPTY_ACCOUNT_FORM: AccountUpdateInput = {
  username: '',
  displayName: '',
  email: '',
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
};
const EMPTY_FORM_SETTINGS: DynamicFormSettings = {
  eyebrow: '',
  title: '',
  description: '',
  submitButtonLabel: '',
  successMessage: '',
  privacyNote: '',
};

export default function FormularioAdminApp() {
  const [publicConfig, setPublicConfig] = useState<PublicConfig | null>(null);
  const [token, setToken] = useState(() => readStoredFormAdminToken());
  const [profile, setProfile] = useState<DynamicFormBootstrapPayload['profile'] | null>(null);
  const [settings, setSettings] = useState<DynamicFormSettings>(EMPTY_FORM_SETTINGS);
  const [questions, setQuestions] = useState<DynamicFormQuestion[]>([]);
  const [records, setRecords] = useState<DynamicFormRecord[]>([]);
  const [settingsDraft, setSettingsDraft] = useState<DynamicFormSettings>(EMPTY_FORM_SETTINGS);
  const [questionDrafts, setQuestionDrafts] = useState<DynamicFormQuestion[]>([]);
  const [recordDraft, setRecordDraft] = useState<DynamicFormRecord | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<RecordSelection>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('records');
  const [searchTerm, setSearchTerm] = useState('');
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [accountForm, setAccountForm] = useState<AccountUpdateInput>(EMPTY_ACCOUNT_FORM);
  const [notice, setNotice] = useState<Notice>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSavingRecord, setIsSavingRecord] = useState(false);
  const [isDeletingRecord, setIsDeletingRecord] = useState(false);
  const [isClearingAllRecords, setIsClearingAllRecords] = useState(false);
  const [isSavingFormConfig, setIsSavingFormConfig] = useState(false);
  const [isSavingAccount, setIsSavingAccount] = useState(false);
  const [isDownloadingExport, setIsDownloadingExport] = useState(false);
  const [isRecordDirty, setIsRecordDirty] = useState(false);
  const [isFormDirty, setIsFormDirty] = useState(false);
  const [isAccountDirty, setIsAccountDirty] = useState(false);
  const deferredSearchTerm = useDeferredValue(searchTerm);

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      try {
        const config = await getPublicConfig();
        if (cancelled) {
          return;
        }

        setPublicConfig(config);

        if (!config.ready) {
          setToken('');
          writeStoredFormAdminToken('');
          return;
        }

        const storedToken = readStoredFormAdminToken();
        if (!storedToken) {
          return;
        }

        setToken(storedToken);
        const session = await getAdminSession(storedToken);
        if (cancelled) {
          return;
        }

        setProfile(session.profile);
        await refreshDashboard(storedToken);
      } catch (error) {
        if (cancelled) {
          return;
        }

        const parsedError = parseFormAdminError(error);
        if (parsedError.statusCode === 401) {
          handleLocalLogout();
        } else {
          setNotice({
            type: 'error',
            message: parsedError.message,
            details: parsedError.details,
          });
        }
      } finally {
        if (!cancelled) {
          setIsInitializing(false);
        }
      }
    }

    void initialize();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!token || !profile || !publicConfig?.ready) {
      return;
    }

    const runBackgroundRefresh = () => {
      if (document.visibilityState !== 'visible') {
        return;
      }

      void refreshDashboard(token, selectedRecord, { background: true });
    };

    const intervalId = window.setInterval(runBackgroundRefresh, AUTO_REFRESH_INTERVAL_MS);
    const handleWindowFocus = () => {
      runBackgroundRefresh();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        runBackgroundRefresh();
      }
    };

    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [
    token,
    profile,
    publicConfig?.ready,
    selectedRecord,
    recordDraft,
    isRefreshing,
    isLoggingIn,
    isSavingRecord,
    isDeletingRecord,
    isClearingAllRecords,
    isSavingFormConfig,
    isSavingAccount,
    isRecordDirty,
    isFormDirty,
    isAccountDirty,
  ]);

  const filteredRecords = records.filter((record) => {
    const query = deferredSearchTerm.trim().toLowerCase();
    if (!query) {
      return true;
    }

    const searchable = [record.submittedAt, ...Object.values(record.values)]
      .join(' ')
      .toLowerCase();

    return searchable.includes(query);
  });

  const previewQuestions = questions.slice(0, 3);
  const totalRespondents = records.length;

  async function refreshDashboard(
    currentToken = token,
    preferredSelection?: RecordSelection,
    options: RefreshDashboardOptions = {},
  ) {
    if (!currentToken) {
      return;
    }

    if (
      options.background &&
      (isRefreshing ||
        isLoggingIn ||
        isSavingRecord ||
        isDeletingRecord ||
        isClearingAllRecords ||
        isSavingFormConfig ||
        isSavingAccount)
    ) {
      return;
    }

    if (!options.background) {
      setIsRefreshing(true);
    }

    try {
      const payload = await getBootstrap(currentToken);
      applyBootstrapState(payload, preferredSelection);
    } catch (error) {
      const parsedError = parseFormAdminError(error);
      if (parsedError.statusCode === 401) {
        handleLocalLogout();
      }

      if (!options.background) {
        setNotice({
          type: 'error',
          message: parsedError.message,
          details: parsedError.details,
        });
      }
    } finally {
      if (!options.background) {
        setIsRefreshing(false);
      }
    }
  }

  function applyBootstrapState(
    payload: DynamicFormBootstrapPayload,
    preferredSelection: RecordSelection = selectedRecord,
  ) {
    setProfile(payload.profile);
    setSettings(payload.settings);
    setQuestions(payload.questions);
    setRecords(payload.records);

    if (!isFormDirty) {
      setSettingsDraft({ ...payload.settings });
      setQuestionDrafts(payload.questions.map((question) => ({ ...question })));
    }

    if (!isAccountDirty) {
      setAccountForm({
        username: payload.profile.username,
        displayName: payload.profile.displayName,
        email: payload.profile.email,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    }

    if (preferredSelection === 'new') {
      setSelectedRecord('new');
      if (!isRecordDirty || !recordDraft) {
        setRecordDraft(createEmptyDynamicRecord(payload.questions));
      }
      return;
    }

    const matchedRecord = payload.records.find((record) => record.sheetRow === preferredSelection);
    const fallbackRecord = matchedRecord || payload.records[0] || null;

    if (!isRecordDirty && fallbackRecord) {
      setSelectedRecord(fallbackRecord.sheetRow);
      setRecordDraft(alignRecordWithQuestions(fallbackRecord, payload.questions));
      return;
    }

    if (!isRecordDirty) {
      setSelectedRecord(null);
      setRecordDraft(null);
    }
  }

  function handleLocalLogout() {
    setToken('');
    setProfile(null);
    setSettings(EMPTY_FORM_SETTINGS);
    setQuestions([]);
    setRecords([]);
    setSettingsDraft(EMPTY_FORM_SETTINGS);
    setQuestionDrafts([]);
    setRecordDraft(null);
    setSelectedRecord(null);
    setIsRecordDirty(false);
    setIsFormDirty(false);
    setIsAccountDirty(false);
    writeStoredFormAdminToken('');
  }

  async function handleLoginSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoggingIn(true);
    setNotice(null);

    try {
      const response = await loginAdmin(loginUsername, loginPassword);
      writeStoredFormAdminToken(response.token);
      setToken(response.token);
      setProfile(response.profile);
      await refreshDashboard(response.token);
      setNotice({
        type: 'success',
        message: 'Sesion iniciada correctamente en el formulario admin.',
      });
    } catch (error) {
      const parsedError = parseFormAdminError(error);
      setNotice({
        type: 'error',
        message: parsedError.message,
        details: parsedError.details,
      });
    } finally {
      setIsLoggingIn(false);
    }
  }

  async function handleLogout() {
    try {
      if (token) {
        await logoutAdmin(token);
      }
    } catch {
      // No bloqueamos el cierre local si el servidor ya no responde.
    } finally {
      handleLocalLogout();
      setNotice({
        type: 'info',
        message: 'Sesion cerrada.',
      });
    }
  }

  async function handleDownloadExcel() {
    if (!token) {
      return;
    }

    setIsDownloadingExport(true);
    setNotice(null);

    try {
      const { blob, filename } = await downloadRecordsExcel(token);
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);

      setNotice({
        type: 'success',
        message: 'Excel descargado correctamente.',
      });
    } catch (error) {
      const parsedError = parseFormAdminError(error);
      setNotice({
        type: 'error',
        message: parsedError.message,
        details: parsedError.details,
      });
    } finally {
      setIsDownloadingExport(false);
    }
  }

  function openNewRecord() {
    setActiveTab('records');
    setSelectedRecord('new');
    setRecordDraft(createEmptyDynamicRecord(questions));
    setIsRecordDirty(false);
  }

  function openExistingRecord(record: DynamicFormRecord) {
    setActiveTab('records');
    setSelectedRecord(record.sheetRow);
    setRecordDraft(alignRecordWithQuestions(record, questions));
    setIsRecordDirty(false);
  }

  function updateRecordValue(key: string, value: string) {
    setIsRecordDirty(true);
    setRecordDraft((currentRecord) =>
      currentRecord
        ? {
            ...currentRecord,
            values: {
              ...currentRecord.values,
              [key]: value,
            },
          }
        : currentRecord,
    );
  }

  function updateRecordDateTime(value: string) {
    setIsRecordDirty(true);
    setRecordDraft((currentRecord) =>
      currentRecord
        ? {
            ...currentRecord,
            submittedAt: fromDatetimeLocalValue(value),
          }
        : currentRecord,
    );
  }

  async function handleSaveRecord() {
    if (!token || !recordDraft) {
      return;
    }

    setIsSavingRecord(true);
    setNotice(null);

    try {
      if (selectedRecord === 'new' || recordDraft.sheetRow === 0) {
        const { record } = await createRecord(token, {
          submittedAt: recordDraft.submittedAt,
          values: recordDraft.values,
        });

        setIsRecordDirty(false);
        await refreshDashboard(token, record.sheetRow);
        setNotice({
          type: 'success',
          message: 'Encuestado creado y guardado en Google Sheets.',
        });
      } else {
        const { record } = await updateRecord(token, recordDraft);
        setIsRecordDirty(false);
        await refreshDashboard(token, record.sheetRow);
        setNotice({
          type: 'success',
          message: 'Encuestado actualizado en Google Sheets.',
        });
      }
    } catch (error) {
      const parsedError = parseFormAdminError(error);
      setNotice({
        type: 'error',
        message: parsedError.message,
        details: parsedError.details,
      });
    } finally {
      setIsSavingRecord(false);
    }
  }

  async function handleDeleteRecord() {
    if (!token || !recordDraft || selectedRecord === 'new') {
      return;
    }

    const recordName = previewQuestions
      .map((question) => recordDraft.values[question.key])
      .find(Boolean) || 'este registro';

    const confirmed = window.confirm(`Vas a borrar ${recordName}.`);
    if (!confirmed) {
      return;
    }

    setIsDeletingRecord(true);
    setNotice(null);

    try {
      await deleteRecord(token, recordDraft.sheetRow);
      setIsRecordDirty(false);
      await refreshDashboard(token);
      setNotice({
        type: 'success',
        message: 'Encuestado eliminado de la hoja principal.',
      });
    } catch (error) {
      const parsedError = parseFormAdminError(error);
      setNotice({
        type: 'error',
        message: parsedError.message,
        details: parsedError.details,
      });
    } finally {
      setIsDeletingRecord(false);
    }
  }

  async function handleClearAllRecords() {
    if (!token || records.length === 0) {
      return;
    }

    const confirmed = window.confirm(
      `Vas a borrar ${records.length} encuestado${records.length === 1 ? '' : 's'} de la hoja principal. Esta accion no se puede deshacer.`,
    );

    if (!confirmed) {
      return;
    }

    setIsClearingAllRecords(true);
    setNotice(null);

    try {
      await deleteAllRecords(token);
      setIsRecordDirty(false);
      setSelectedRecord(null);
      setRecordDraft(null);
      await refreshDashboard(token, null);
      setNotice({
        type: 'success',
        message: 'Todos los datos del formulario fueron eliminados de la hoja principal.',
      });
    } catch (error) {
      const parsedError = parseFormAdminError(error);
      setNotice({
        type: 'error',
        message: parsedError.message,
        details: parsedError.details,
      });
    } finally {
      setIsClearingAllRecords(false);
    }
  }

  function updateSettingsDraft<K extends keyof DynamicFormSettings>(
    key: K,
    value: DynamicFormSettings[K],
  ) {
    setIsFormDirty(true);
    setSettingsDraft((currentSettings) => ({
      ...currentSettings,
      [key]: value,
    }));
  }

  function updateQuestionDraft(
    targetKey: string,
    changes: Partial<DynamicFormQuestion>,
  ) {
    setIsFormDirty(true);
    setQuestionDrafts((currentQuestions) =>
      currentQuestions.map((question) =>
        question.key === targetKey
          ? {
              ...question,
              ...changes,
            }
          : question,
      ),
    );
  }

  function addQuestionDraft() {
    setIsFormDirty(true);
    const nextIndex = questionDrafts.length + 1;
    const nextKey = createUniqueQuestionKey(`pregunta-${nextIndex}`, questionDrafts);
    setQuestionDrafts((currentQuestions) => [
      ...currentQuestions,
      {
        key: nextKey,
        label: `Pregunta ${nextIndex}`,
        type: 'text',
        required: false,
        placeholder: '',
        helperText: '',
        autoComplete: '',
        layout: 'full',
        rows: 0,
        order: currentQuestions.length,
        active: true,
      },
    ]);
  }

  function removeQuestionDraft(targetKey: string) {
    if (questionDrafts.length <= 1) {
      setNotice({
        type: 'error',
        message: 'Debes dejar al menos una pregunta disponible.',
      });
      return;
    }

    setIsFormDirty(true);
    setQuestionDrafts((currentQuestions) =>
      currentQuestions
        .filter((question) => question.key !== targetKey)
        .map((question, index) => ({
          ...question,
          order: index,
        })),
    );
  }

  async function handleSaveFormConfig() {
    if (!token) {
      return;
    }

    setIsSavingFormConfig(true);
    setNotice(null);

    try {
      await saveFormConfig(
        token,
        settingsDraft,
        questionDrafts.map((question, index) => ({
          ...question,
          order: index,
        })),
      );
      setIsFormDirty(false);
      await refreshDashboard(token, selectedRecord);
      setNotice({
        type: 'success',
        message: 'Formulario guardado correctamente.',
      });
    } catch (error) {
      const parsedError = parseFormAdminError(error);
      setNotice({
        type: 'error',
        message: parsedError.message,
        details: parsedError.details,
      });
    } finally {
      setIsSavingFormConfig(false);
    }
  }

  async function handleSaveAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      return;
    }

    setIsSavingAccount(true);
    setNotice(null);

    try {
      const response = await updateAccount(token, accountForm);
      setProfile(response.profile);
      setIsAccountDirty(false);
      setAccountForm({
        username: response.profile.username,
        displayName: response.profile.displayName,
        email: response.profile.email,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setNotice({
        type: 'success',
        message: 'Cuenta admin actualizada correctamente.',
      });
    } catch (error) {
      const parsedError = parseFormAdminError(error);
      setNotice({
        type: 'error',
        message: parsedError.message,
        details: parsedError.details,
      });
    } finally {
      setIsSavingAccount(false);
    }
  }

  if (isInitializing) {
    return <LoadingScreen message="Preparando el formulario admin y la conexion con Google Sheets..." />;
  }

  if (!publicConfig?.ready) {
    return (
      <PageShell>
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <HeroPanel
            title="Formulario Admin"
            eyebrow="Configuracion inicial"
            description="La herramienta ya esta lista. Solo falta conectarla con tu Google Sheets para administrar el formulario y sus respuestas desde otra URL."
          />

          <Panel className="border-amber-400/25 bg-[linear-gradient(135deg,rgba(120,53,15,0.35)_0%,rgba(113,63,18,0.28)_100%)] text-white">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-amber-100" />
              <div>
                <h2 className="text-2xl font-semibold">Faltan pasos de conexion</h2>
                <p className="mt-2 text-sm leading-6 text-amber-50/90">
                  El servidor detecto que todavia no tiene permisos para entrar a la hoja.
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-3xl border border-white/10 bg-black/10 p-5">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-100">
                Checklist rapido
              </p>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-amber-50/90">
                {publicConfig.missing.map((item) => (
                  <li key={item} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </Panel>
        </div>
      </PageShell>
    );
  }

  if (!token || !profile) {
    return (
      <PageShell>
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <HeroPanel
            title="Formulario Admin"
            eyebrow="Dashboard privado"
            description="Aqui vas a poder administrar tus respuestas, editar preguntas del formulario y mantener todo sincronizado con Google Sheets desde otra URL."
          />

          <Panel className="text-white">
            <div className="flex items-center gap-4">
              <img src={BARCA_LOGO_URL} alt="Logo La Barca" className="h-16 w-auto object-contain" />
              <div>
                <p className={eyebrowClassName}>Acceso privado</p>
                <h2 className="text-3xl font-semibold text-white">Iniciar sesion</h2>
              </div>
            </div>

            <form className="mt-8 space-y-5" onSubmit={handleLoginSubmit}>
              <TextField label="Usuario" value={loginUsername} onChange={setLoginUsername} autoComplete="username" />
              <TextField
                label="Contrasena"
                value={loginPassword}
                onChange={setLoginPassword}
                type="password"
                autoComplete="current-password"
              />

              <button type="submit" disabled={isLoggingIn} className={`${primaryButtonClassName} w-full`}>
                {isLoggingIn ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <ShieldCheck className="h-5 w-5" />}
                <span>{isLoggingIn ? 'Entrando...' : 'Entrar al dashboard'}</span>
              </button>
            </form>
          </Panel>
        </div>

        <NoticeBanner notice={notice} />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <header className="rounded-[32px] border border-white/10 bg-gradient-to-br from-gray-700 to-gray-600 p-8 text-white shadow-xl">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-4">
            <img src={BARCA_LOGO_URL} alt="Logo La Barca" className="h-16 w-auto object-contain" />
            <img src={CHURCH_LOGO_URL} alt="Logo El Shaddai" className="h-10 w-auto object-contain opacity-80" />
            <div>
              <p className={eyebrowClassName}>Dashboard privado</p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight text-white">
                Formulario Dinamico
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-200">
                Todo queda sincronizado con una hoja dedicada dentro de tu mismo Google Sheets.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                void refreshDashboard();
              }}
              disabled={isRefreshing}
              className={secondaryButtonClassName}
            >
              {isRefreshing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              <span>{isRefreshing ? 'Actualizando...' : 'Actualizar'}</span>
            </button>

            <button type="button" onClick={openNewRecord} className={primaryButtonClassName}>
              <CirclePlus className="h-4 w-4" />
              <span>Nueva encuesta</span>
            </button>

            <button
              type="button"
              onClick={() => void handleDownloadExcel()}
              disabled={isDownloadingExport}
              className={secondaryButtonClassName}
            >
              {isDownloadingExport ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              <span>{isDownloadingExport ? 'Descargando...' : 'Descargar Excel'}</span>
            </button>

            <button
              type="button"
              onClick={() => void handleClearAllRecords()}
              disabled={isClearingAllRecords || records.length === 0}
              className={dangerButtonClassName}
            >
              {isClearingAllRecords ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              <span>{isClearingAllRecords ? 'Vaciando...' : 'Vaciar datos'}</span>
            </button>

            <button type="button" onClick={() => void handleLogout()} className={secondaryButtonClassName}>
              <LogOut className="h-4 w-4" />
              <span>Salir</span>
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <StatCard label="Total encuestados" value={String(totalRespondents)} detail="Hoja principal sincronizada" />
          <StatCard label="Campos activos" value={String(questions.length)} detail="Preguntas visibles del formulario" />
          <StatCard label="Administrador activo" value={profile.displayName || profile.username} detail={profile.username} />
        </div>
      </header>

      <NoticeBanner notice={notice} />

      <div className="mt-6 flex flex-wrap gap-3">
        <TabButton icon={LayoutDashboard} isActive={activeTab === 'records'} label="Encuestas" onClick={() => setActiveTab('records')} />
        <TabButton icon={FileText} isActive={activeTab === 'form'} label="Formulario" onClick={() => setActiveTab('form')} />
        <TabButton icon={UserRound} isActive={activeTab === 'account'} label="Cuenta" onClick={() => setActiveTab('account')} />
      </div>

      {activeTab === 'records' && (
        <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <Panel className="text-white">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">
                  Respuestas sincronizadas
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Encuestados guardados</h2>
                <p className="mt-2 text-sm leading-6 text-gray-200">
                  Cualquier cambio que hagas aqui se refleja en la hoja dedicada de este formulario.
                </p>
              </div>

              <div className="relative min-w-[240px] flex-1 lg:max-w-sm">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Buscar por respuestas o fecha..."
                  className={`${inputClassName} pl-11`}
                />
              </div>
            </div>

            <div className="mt-6 overflow-hidden rounded-[24px] border border-white/10 bg-slate-900/20 shadow-sm">
              <div className="max-h-[640px] overflow-auto">
                <table className="min-w-full divide-y divide-white/10">
                  <thead className="sticky top-0 bg-slate-900/70 text-left text-xs uppercase tracking-[0.22em] text-cyan-300 backdrop-blur-sm">
                    <tr>
                      {previewQuestions.map((question) => (
                        <th key={question.key} className="px-4 py-4 font-medium">
                          {question.label}
                        </th>
                      ))}
                      <th className="px-4 py-4 font-medium">Fecha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10 bg-transparent text-sm text-gray-200">
                    {filteredRecords.map((record) => {
                      const isSelected = selectedRecord === record.sheetRow;
                      return (
                        <tr
                          key={record.sheetRow}
                          className={`cursor-pointer transition-colors ${isSelected ? 'bg-white/10' : 'hover:bg-white/5'}`}
                          onClick={() => openExistingRecord(record)}
                        >
                          {previewQuestions.map((question) => (
                            <td key={question.key} className="px-4 py-4 align-top">
                              {record.values[question.key] || '-'}
                            </td>
                          ))}
                          <td className="px-4 py-4 align-top">{record.submittedAt || '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {filteredRecords.length === 0 && (
                <EmptyState
                  title="No hay resultados"
                  description="Ajusta la busqueda o crea un encuestado nuevo desde este mismo panel."
                />
              )}
            </div>
          </Panel>

          <Panel className="text-white">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">
                  Editor
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-white">
                  {selectedRecord === 'new' ? 'Nueva encuesta' : 'Detalle del registro'}
                </h2>
              </div>
            </div>

            {recordDraft ? (
              <>
                <div className="mt-6 space-y-5">
                  <div>
                    <label htmlFor="dynamic-record-date" className="mb-2 block text-base font-semibold text-white">
                      Fecha y hora
                    </label>
                    <input
                      id="dynamic-record-date"
                      type="datetime-local"
                      value={toDatetimeLocalValue(recordDraft.submittedAt)}
                      onChange={(event) => updateRecordDateTime(event.target.value)}
                      className={inputClassName}
                    />
                  </div>

                  <div className="grid gap-5 md:grid-cols-2">
                    {questions.map((question) => (
                      <div
                        key={question.key}
                        className={question.layout === 'half' ? '' : 'md:col-span-2'}
                      >
                        <label htmlFor={`record-${question.key}`} className="mb-2 block text-base font-semibold text-white">
                          {question.label}
                          {question.required && <span className="ml-1 text-rose-400">*</span>}
                        </label>
                        {renderDynamicQuestionInput(
                          `record-${question.key}`,
                          question,
                          recordDraft.values[question.key] || '',
                          (value) => updateRecordValue(question.key, value),
                        )}
                        {question.helperText && (
                          <p className="mt-2 text-sm text-gray-300">{question.helperText}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-8 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void handleSaveRecord()}
                    disabled={isSavingRecord}
                    className={primaryButtonClassName}
                  >
                    {isSavingRecord ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    <span>{isSavingRecord ? 'Guardando...' : 'Guardar cambios'}</span>
                  </button>

                  {selectedRecord !== 'new' && (
                    <button
                      type="button"
                      onClick={() => void handleDeleteRecord()}
                      disabled={isDeletingRecord}
                      className={dangerButtonClassName}
                    >
                      {isDeletingRecord ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                      <span>{isDeletingRecord ? 'Borrando...' : 'Borrar encuesta'}</span>
                    </button>
                  )}
                </div>
              </>
            ) : (
              <EmptyState
                title="Selecciona un registro"
                description="Haz clic en una fila de la tabla para editarla o crea una encuesta nueva."
              />
            )}
          </Panel>
        </div>
      )}

      {activeTab === 'form' && (
        <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_0.9fr]">
          <Panel className="text-white">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">
                  Constructor del formulario
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Configurar preguntas</h2>
                <p className="mt-2 text-sm leading-6 text-gray-200">
                  Aqui puedes editar el texto del formulario, crear campos nuevos y ajustar el
                  orden visual sin tocar codigo.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={addQuestionDraft} className={secondaryButtonClassName}>
                  <CirclePlus className="h-4 w-4" />
                  <span>Anadir pregunta</span>
                </button>

                <button
                  type="button"
                  onClick={() => void handleSaveFormConfig()}
                  disabled={isSavingFormConfig}
                  className={primaryButtonClassName}
                >
                  {isSavingFormConfig ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  <span>{isSavingFormConfig ? 'Guardando...' : 'Guardar formulario'}</span>
                </button>
              </div>
            </div>

            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <TextField label="Franja superior" value={settingsDraft.eyebrow} onChange={(value) => updateSettingsDraft('eyebrow', value)} />
              <TextField label="Boton enviar" value={settingsDraft.submitButtonLabel} onChange={(value) => updateSettingsDraft('submitButtonLabel', value)} />
              <div className="md:col-span-2">
                <TextField label="Titulo principal" value={settingsDraft.title} onChange={(value) => updateSettingsDraft('title', value)} />
              </div>
              <div className="md:col-span-2">
                <TextAreaField
                  label="Descripcion"
                  value={settingsDraft.description}
                  onChange={(value) => updateSettingsDraft('description', value)}
                  rows={4}
                />
              </div>
              <div className="md:col-span-2">
                <TextAreaField
                  label="Mensaje de exito"
                  value={settingsDraft.successMessage}
                  onChange={(value) => updateSettingsDraft('successMessage', value)}
                  rows={4}
                />
              </div>
              <div className="md:col-span-2">
                <TextAreaField
                  label="Texto legal"
                  value={settingsDraft.privacyNote}
                  onChange={(value) => updateSettingsDraft('privacyNote', value)}
                  rows={3}
                />
              </div>
            </div>

            <div className="mt-8 space-y-4">
              {questionDrafts.map((question) => (
                <div
                  key={question.key}
                  className="rounded-[24px] border border-white/10 bg-slate-900/20 p-5 shadow-sm"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">
                        Campo
                      </p>
                      <h3 className="mt-2 text-xl font-semibold text-white">{question.label}</h3>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeQuestionDraft(question.key)}
                      className={dangerButtonClassName}
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>Eliminar</span>
                    </button>
                  </div>

                  <div className="mt-5 grid gap-5 md:grid-cols-2">
                    <TextField
                      label="Titulo visible"
                      value={question.label}
                      onChange={(value) => updateQuestionDraft(question.key, { label: value })}
                    />
                    <TextField
                      label="Llave interna"
                      value={question.key}
                      onChange={(value) => updateQuestionDraft(question.key, { key: value })}
                    />
                    <SelectField
                      label="Tipo"
                      value={question.type}
                      onChange={(value) =>
                        updateQuestionDraft(question.key, {
                          type: value as DynamicFormQuestionType,
                          rows: value === 'textarea' ? question.rows || 6 : 0,
                        })
                      }
                      options={[
                        { value: 'text', label: 'Texto' },
                        { value: 'tel', label: 'Telefono' },
                        { value: 'email', label: 'Correo' },
                        { value: 'textarea', label: 'Area de texto' },
                      ]}
                    />
                    <SelectField
                      label="Ancho"
                      value={question.layout}
                      onChange={(value) =>
                        updateQuestionDraft(question.key, {
                          layout: value === 'half' ? 'half' : 'full',
                        })
                      }
                      options={[
                        { value: 'full', label: 'Ancho completo' },
                        { value: 'half', label: 'Media columna' },
                      ]}
                    />
                    <TextField
                      label="Placeholder"
                      value={question.placeholder}
                      onChange={(value) => updateQuestionDraft(question.key, { placeholder: value })}
                    />
                    <TextField
                      label="Auto complete"
                      value={question.autoComplete}
                      onChange={(value) => updateQuestionDraft(question.key, { autoComplete: value })}
                    />

                    {question.type === 'textarea' && (
                      <TextField
                        label="Filas"
                        value={String(question.rows || 6)}
                        onChange={(value) =>
                          updateQuestionDraft(question.key, {
                            rows: Number.parseInt(value || '6', 10) || 6,
                          })
                        }
                        type="number"
                      />
                    )}

                    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/30 px-4 py-3">
                      <input
                        id={`required-${question.key}`}
                        type="checkbox"
                        checked={question.required}
                        onChange={(event) =>
                          updateQuestionDraft(question.key, { required: event.target.checked })
                        }
                        className="h-4 w-4 rounded border-slate-500 bg-slate-900 text-cyan-400 focus:ring-cyan-500"
                      />
                      <label htmlFor={`required-${question.key}`} className="text-sm font-semibold text-white">
                        Campo obligatorio
                      </label>
                    </div>

                    <div className="md:col-span-2">
                      <TextAreaField
                        label="Texto de ayuda"
                        value={question.helperText}
                        onChange={(value) => updateQuestionDraft(question.key, { helperText: value })}
                        rows={3}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel className="text-white">
            <div className="flex items-start gap-3">
              <FileText className="mt-1 h-5 w-5 text-cyan-300" />
              <div>
                <h3 className="text-xl font-semibold text-white">Vista funcional</h3>
                <p className="mt-2 text-sm leading-6 text-gray-200">
                  El formulario publico usa exactamente estas preguntas y este mismo texto.
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-4 text-sm leading-6 text-gray-200">
              <InfoCard title="Llave interna" body="La llave se usa para guardar la respuesta en Google Sheets. Debe ser unica." />
              <InfoCard title="Eliminar preguntas" body="Si quitas una pregunta, deja de mostrarse en el formulario. Las respuestas anteriores siguen en la hoja." />
              <InfoCard title="Media columna" body="Usa media columna para preguntas cortas como nombre, correo o telefono." />
              <InfoCard title="Area de texto" body="Cuando el tipo es area de texto puedes ajustar cuantas filas visibles tendra el campo." />
            </div>
          </Panel>
        </div>
      )}

      {activeTab === 'account' && (
        <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_0.82fr]">
          <Panel className="text-white">
            <div className="flex items-start gap-3">
              <UserRound className="mt-1 h-5 w-5 text-cyan-300" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">
                  Cuenta principal
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Datos del administrador</h2>
                <p className="mt-2 text-sm leading-6 text-gray-200">
                  Desde aqui puedes cambiar el usuario de acceso, el nombre visible y la contrasena del panel.
                </p>
              </div>
            </div>

            <form className="mt-6 space-y-6" onSubmit={handleSaveAccount}>
              <div className="grid gap-5 md:grid-cols-2">
                <TextField
                  label="Usuario de acceso"
                  value={accountForm.username}
                  onChange={(value) => {
                    setIsAccountDirty(true);
                    setAccountForm((current) => ({ ...current, username: value }));
                  }}
                />
                <TextField
                  label="Nombre visible"
                  value={accountForm.displayName}
                  onChange={(value) => {
                    setIsAccountDirty(true);
                    setAccountForm((current) => ({ ...current, displayName: value }));
                  }}
                />
                <div className="md:col-span-2">
                  <TextField
                    label="Correo (opcional)"
                    value={accountForm.email}
                    onChange={(value) => {
                      setIsAccountDirty(true);
                      setAccountForm((current) => ({ ...current, email: value }));
                    }}
                    type="email"
                  />
                </div>
              </div>

              <div className="rounded-[24px] border border-white/10 bg-slate-900/20 p-5 shadow-sm">
                <h3 className="text-lg font-semibold text-white">Cambiar contrasena</h3>
                <div className="mt-4 grid gap-5 md:grid-cols-3">
                  <TextField
                    label="Contrasena actual"
                    value={accountForm.currentPassword}
                    onChange={(value) => {
                      setIsAccountDirty(true);
                      setAccountForm((current) => ({ ...current, currentPassword: value }));
                    }}
                    type="password"
                  />
                  <TextField
                    label="Nueva contrasena"
                    value={accountForm.newPassword}
                    onChange={(value) => {
                      setIsAccountDirty(true);
                      setAccountForm((current) => ({ ...current, newPassword: value }));
                    }}
                    type="password"
                  />
                  <TextField
                    label="Confirmar contrasena"
                    value={accountForm.confirmPassword}
                    onChange={(value) => {
                      setIsAccountDirty(true);
                      setAccountForm((current) => ({ ...current, confirmPassword: value }));
                    }}
                    type="password"
                  />
                </div>
              </div>

              <button type="submit" disabled={isSavingAccount} className={primaryButtonClassName}>
                {isSavingAccount ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                <span>{isSavingAccount ? 'Guardando...' : 'Guardar cuenta'}</span>
              </button>
            </form>
          </Panel>

          <Panel className="text-white">
            <div className="flex items-start gap-3">
              <KeyRound className="mt-1 h-5 w-5 text-cyan-300" />
              <div>
                <h3 className="text-xl font-semibold text-white">Notas utiles</h3>
                <p className="mt-2 text-sm leading-6 text-gray-200">
                  Esta cuenta comparte la misma base de usuarios del admin principal y tambien se respalda en Google Sheets.
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-4 text-sm leading-6 text-gray-200">
              <InfoCard title="Acceso compartido" body="Entra con cualquiera de los usuarios validos que tengas en la pestana Admin Usuarios del admin principal." />
              <InfoCard title="Varios administradores" body="Si agregas nuevas filas en la pestana Admin Usuarios, este panel tambien las reconoce." />
              <InfoCard title="Correo opcional" body="Puedes dejar el correo vacio si solo quieres un usuario local sencillo." />
            </div>
          </Panel>
        </div>
      )}
    </PageShell>
  );
}

function renderDynamicQuestionInput(
  id: string,
  question: DynamicFormQuestion,
  value: string,
  onChange: (value: string) => void,
) {
  if (question.type === 'textarea') {
    return (
      <textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={question.rows || 6}
        placeholder={question.placeholder}
        className={`${inputClassName} resize-y`}
      />
    );
  }

  return (
    <input
      id={id}
      type={question.type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={question.placeholder}
      autoComplete={question.autoComplete}
      className={inputClassName}
    />
  );
}

function alignRecordWithQuestions(record: DynamicFormRecord, questions: DynamicFormQuestion[]) {
  return {
    ...record,
    values: questions.reduce<Record<string, string>>((values, question) => {
      values[question.key] = record.values?.[question.key] || '';
      return values;
    }, {}),
  };
}

function createEmptyDynamicRecord(questions: DynamicFormQuestion[]) {
  return {
    sheetRow: 0,
    submittedAt: formatCurrentDateTime(),
    values: questions.reduce<Record<string, string>>((values, question) => {
      values[question.key] = '';
      return values;
    }, {}),
  };
}

function createUniqueQuestionKey(baseKey: string, questions: DynamicFormQuestion[]) {
  const takenKeys = new Set(questions.map((question) => question.key.toLowerCase()));
  let nextKey = slugifyQuestionKey(baseKey) || 'pregunta';
  let counter = 2;

  while (takenKeys.has(nextKey.toLowerCase())) {
    nextKey = `${slugifyQuestionKey(baseKey) || 'pregunta'}-${counter}`;
    counter += 1;
  }

  return nextKey;
}

function slugifyQuestionKey(value: string) {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseFormAdminError(error: unknown) {
  if (error instanceof FormAdminApiError) {
    return error;
  }

  return new FormAdminApiError('Ocurrio un error inesperado en el formulario admin.');
}

function formatCurrentDateTime() {
  return fromDatetimeLocalValue(toDatetimeLocalValue(''));
}

function toDatetimeLocalValue(sheetValue: string) {
  const normalized = sheetValue.trim();
  if (normalized) {
    return normalized.replace(' ', 'T').slice(0, 16);
  }

  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
}

function fromDatetimeLocalValue(inputValue: string) {
  if (!inputValue) {
    return '';
  }

  const [datePart, timePart = '00:00'] = inputValue.split('T');
  const fullTime = timePart.length === 5 ? `${timePart}:00` : timePart;
  return `${datePart} ${fullTime}`;
}

function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-800 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.12),rgba(34,211,238,0)_32%)]" />
      <main className="relative mx-auto flex min-h-screen w-full max-w-[1440px] flex-col px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}

function HeroPanel({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-gradient-to-br from-gray-700 to-gray-600 p-8 text-white shadow-xl sm:p-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.12),rgba(255,255,255,0)_42%)]" />
      <div className="relative">
        <div className={eyebrowClassName}>
          <BadgeCheck className="h-4 w-4" />
          {eyebrow}
        </div>
        <h1 className="mt-6 max-w-xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          {title}
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-gray-200 sm:text-lg">
          {description}
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <img src={BARCA_LOGO_URL} alt="Logo La Barca" className="h-20 w-auto object-contain" />
          <img src={CHURCH_LOGO_URL} alt="Logo El Shaddai" className="h-12 w-auto object-contain" />
        </div>
      </div>
    </section>
  );
}

function LoadingScreen({ message }: { message: string }) {
  return (
    <PageShell>
      <div className="flex min-h-[70vh] items-center justify-center">
        <Panel className="max-w-xl text-white">
          <div className="flex items-center gap-4">
            <LoaderCircle className="h-7 w-7 animate-spin text-cyan-600" />
            <div>
              <h1 className="text-2xl font-semibold text-white">Cargando formulario admin</h1>
              <p className="mt-2 text-sm text-gray-200">{message}</p>
            </div>
          </div>
        </Panel>
      </div>
    </PageShell>
  );
}

function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-[32px] border border-white/10 bg-gradient-to-br from-gray-700 to-gray-600 p-6 shadow-xl sm:p-8 ${className}`}>
      {children}
    </section>
  );
}

function NoticeBanner({ notice }: { notice: Notice }) {
  if (!notice) {
    return null;
  }

  const toneClassName =
    notice.type === 'success'
      ? 'border border-emerald-400/25 bg-emerald-500/12 text-emerald-100'
      : notice.type === 'error'
        ? 'border border-rose-400/25 bg-rose-500/12 text-rose-100'
        : 'border border-cyan-400/25 bg-cyan-500/12 text-cyan-100';

  return (
    <div className={`mt-6 rounded-2xl px-5 py-4 shadow-sm ${toneClassName}`}>
      <p className="font-semibold">{notice.message}</p>
      {notice.details && notice.details.length > 0 && (
        <ul className="mt-3 space-y-2 text-sm leading-6">
          {notice.details.map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-slate-900/20 p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">{label}</p>
      <p className="mt-3 text-2xl font-semibold text-white">{value}</p>
      <p className="mt-2 text-sm text-gray-200">{detail}</p>
    </div>
  );
}

function TabButton({
  icon: Icon,
  isActive,
  label,
  onClick,
}: {
  icon: ComponentType<{ className?: string }>;
  isActive: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold shadow-sm transition ${
        isActive
          ? 'border-transparent bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg hover:from-cyan-600 hover:to-blue-600'
          : 'border-white/10 bg-slate-900/20 text-gray-100 hover:bg-slate-900/35'
      }`}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </button>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = 'text',
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: HTMLInputTypeAttribute;
  autoComplete?: string;
}) {
  const fieldId = `field-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

  return (
    <div>
      <label htmlFor={fieldId} className="mb-2 block text-base font-semibold text-white">
        {label}
      </label>
      <input
        id={fieldId}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        className={inputClassName}
      />
    </div>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  rows,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows: number;
}) {
  const fieldId = `field-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

  return (
    <div>
      <label htmlFor={fieldId} className="mb-2 block text-base font-semibold text-white">
        {label}
      </label>
      <textarea
        id={fieldId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        className={`${inputClassName} resize-y`}
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  const fieldId = `field-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

  return (
    <div>
      <label htmlFor={fieldId} className="mb-2 block text-base font-semibold text-white">
        {label}
      </label>
      <select
        id={fieldId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={inputClassName}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center px-6 py-10 text-center">
      <LayoutDashboard className="h-8 w-8 text-cyan-500" />
      <h3 className="mt-4 text-xl font-semibold text-white">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-gray-200">{description}</p>
    </div>
  );
}

function InfoCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-slate-900/20 p-4 shadow-sm">
      <p className="font-semibold text-white">{title}</p>
      <p className="mt-2 text-sm leading-6 text-gray-200">{body}</p>
    </div>
  );
}

const inputClassName =
  'w-full rounded-2xl border border-slate-500/60 bg-slate-900/70 px-4 py-3 text-base text-slate-100 shadow-sm outline-none transition focus:border-cyan-300 focus:ring-4 focus:ring-cyan-500/20';

const eyebrowClassName =
  'inline-flex items-center gap-2 rounded-full bg-slate-900/30 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300 shadow-sm';

const primaryButtonClassName =
  'inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-500 px-6 py-4 text-base font-semibold text-white shadow-lg transition-all hover:scale-[1.02] hover:from-cyan-600 hover:to-blue-600 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:scale-100';

const secondaryButtonClassName =
  'inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/20 px-4 py-3 text-sm font-semibold text-gray-100 shadow-sm transition hover:bg-slate-900/35 disabled:cursor-not-allowed disabled:opacity-70';

const dangerButtonClassName =
  'inline-flex items-center gap-2 rounded-2xl border border-rose-400/25 bg-rose-500/12 px-4 py-3 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-70';

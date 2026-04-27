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
  HeartHandshake,
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
  AdminApiError,
  createRecord,
  deleteRecord,
  downloadRecordsExcel,
  getBootstrap,
  getPublicConfig,
  getAdminSession,
  loginAdmin,
  logoutAdmin,
  readStoredAdminToken,
  saveStatuses,
  updateAccount,
  updateRecord,
  writeStoredAdminToken,
} from './api';
import type {
  AccountUpdateInput,
  BootstrapPayload,
  PublicConfig,
  StatusOption,
  SurveyRecord,
} from './types';

const BARCA_LOGO_URL = new URL('../imports/logo-barca.png', import.meta.url).href;
const CHURCH_LOGO_URL = new URL(
  '../imports/logo-cruzada-cristiana-blanco-trimmed.png',
  import.meta.url,
).href;

type ActiveTab = 'records' | 'statuses' | 'account';
type Notice =
  | { type: 'success' | 'error' | 'info'; message: string; details?: string[] }
  | null;
type RecordSelection = number | 'new' | null;
type RefreshDashboardOptions = {
  background?: boolean;
};

const AUTO_REFRESH_INTERVAL_MS = 10000;
const STATUS_COLOR_PRESETS = ['#06b6d4', '#2563eb', '#f59e0b', '#10b981', '#ef4444', '#64748b'];

const EMPTY_ACCOUNT_FORM: AccountUpdateInput = {
  username: '',
  displayName: '',
  email: '',
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
};

export default function AdminApp() {
  const [publicConfig, setPublicConfig] = useState<PublicConfig | null>(null);
  const [token, setToken] = useState(() => readStoredAdminToken());
  const [profile, setProfile] = useState<BootstrapPayload['profile'] | null>(null);
  const [statuses, setStatuses] = useState<StatusOption[]>([]);
  const [records, setRecords] = useState<SurveyRecord[]>([]);
  const [statusDrafts, setStatusDrafts] = useState<StatusOption[]>([]);
  const [recordDraft, setRecordDraft] = useState<SurveyRecord | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<RecordSelection>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('records');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loginUsername, setLoginUsername] = useState('admin');
  const [loginPassword, setLoginPassword] = useState('1234');
  const [accountForm, setAccountForm] = useState<AccountUpdateInput>(EMPTY_ACCOUNT_FORM);
  const [notice, setNotice] = useState<Notice>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSavingRecord, setIsSavingRecord] = useState(false);
  const [isDeletingRecord, setIsDeletingRecord] = useState(false);
  const [isSavingStatuses, setIsSavingStatuses] = useState(false);
  const [isSavingAccount, setIsSavingAccount] = useState(false);
  const [isDownloadingExport, setIsDownloadingExport] = useState(false);
  const [isRecordDirty, setIsRecordDirty] = useState(false);
  const [isStatusesDirty, setIsStatusesDirty] = useState(false);
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
          writeStoredAdminToken('');
          return;
        }

        const storedToken = readStoredAdminToken();
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

        const parsedError = parseAdminError(error);
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
    isSavingStatuses,
    isSavingAccount,
    isRecordDirty,
    isStatusesDirty,
    isAccountDirty,
  ]);

  const filteredRecords = records.filter((record) => {
    const matchesStatus = statusFilter === 'all' || record.status === statusFilter;
    if (!matchesStatus) {
      return false;
    }

    const query = deferredSearchTerm.trim().toLowerCase();
    if (!query) {
      return true;
    }

    const searchable = [
      record.firstName,
      record.lastName,
      record.phone,
      record.email,
      record.prayerRequest,
      record.source,
      record.status,
      record.submittedAt,
    ]
      .join(' ')
      .toLowerCase();

    return searchable.includes(query);
  });

  const totalRecords = records.length;
  const defaultStatusLabel = statuses[0]?.label || 'Nuevo';
  const defaultStatusCount = records.filter((record) => record.status === defaultStatusLabel).length;
  const selectedStatusColor =
    statuses.find((status) => status.label === recordDraft?.status)?.color || '#06b6d4';

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
        isSavingStatuses ||
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
      const parsedError = parseAdminError(error);
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
    payload: BootstrapPayload,
    preferredSelection: RecordSelection = selectedRecord,
  ) {
    setProfile(payload.profile);
    setStatuses(payload.statuses);
    setRecords(payload.records);
    if (!isStatusesDirty) {
      setStatusDrafts(payload.statuses.map((status) => ({ ...status })));
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
        const blankRecord = createEmptyRecord(payload.statuses[0]?.label || 'Nuevo');
        setRecordDraft(blankRecord);
      }
      return;
    }

    const matchedRecord = payload.records.find((record) => record.sheetRow === preferredSelection);
    const fallbackRecord = matchedRecord || payload.records[0] || null;

    if (!isRecordDirty && fallbackRecord) {
      setSelectedRecord(fallbackRecord.sheetRow);
      setRecordDraft({ ...fallbackRecord });
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
    setRecords([]);
    setStatuses([]);
    setStatusDrafts([]);
    setRecordDraft(null);
    setSelectedRecord(null);
    setIsRecordDirty(false);
    setIsStatusesDirty(false);
    setIsAccountDirty(false);
    writeStoredAdminToken('');
  }

  async function handleLoginSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoggingIn(true);
    setNotice(null);

    try {
      const response = await loginAdmin(loginUsername, loginPassword);
      writeStoredAdminToken(response.token);
      setToken(response.token);
      setProfile(response.profile);
      await refreshDashboard(response.token);
      setNotice({
        type: 'success',
        message: 'Sesion iniciada correctamente en el panel admin.',
      });
    } catch (error) {
      const parsedError = parseAdminError(error);
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
      const parsedError = parseAdminError(error);
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
    setRecordDraft(createEmptyRecord(defaultStatusLabel));
    setIsRecordDirty(false);
  }

  function openExistingRecord(record: SurveyRecord) {
    setActiveTab('records');
    setSelectedRecord(record.sheetRow);
    setRecordDraft({ ...record });
    setIsRecordDirty(false);
  }

  function updateRecordField<K extends keyof SurveyRecord>(key: K, value: SurveyRecord[K]) {
    setIsRecordDirty(true);
    setRecordDraft((currentRecord) =>
      currentRecord
        ? {
            ...currentRecord,
            [key]: value,
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
          firstName: recordDraft.firstName,
          lastName: recordDraft.lastName,
          phone: recordDraft.phone,
          email: recordDraft.email,
          prayerRequest: recordDraft.prayerRequest,
          source: recordDraft.source,
          submittedAt: recordDraft.submittedAt,
          status: recordDraft.status,
        });

        setIsRecordDirty(false);
        await refreshDashboard(token, record.sheetRow);
        setNotice({
          type: 'success',
          message: 'Encuesta creada y guardada en Google Sheets.',
        });
      } else {
        const { record } = await updateRecord(token, recordDraft);
        setIsRecordDirty(false);
        await refreshDashboard(token, record.sheetRow);
        setNotice({
          type: 'success',
          message: 'Encuesta actualizada en Google Sheets.',
        });
      }
    } catch (error) {
      const parsedError = parseAdminError(error);
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

    const confirmed = window.confirm(
      `Vas a borrar la encuesta de ${recordDraft.firstName} ${recordDraft.lastName}.`,
    );

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
        message: 'Encuesta eliminada de la hoja principal.',
      });
    } catch (error) {
      const parsedError = parseAdminError(error);
      setNotice({
        type: 'error',
        message: parsedError.message,
        details: parsedError.details,
      });
    } finally {
      setIsDeletingRecord(false);
    }
  }

  function updateStatusDraft(
    targetKey: string,
    changes: Partial<Pick<StatusOption, 'label' | 'color'>>,
  ) {
    setIsStatusesDirty(true);
    setStatusDrafts((currentDrafts) =>
      currentDrafts.map((status) =>
        status.key === targetKey
          ? {
              ...status,
              ...changes,
            }
          : status,
      ),
    );
  }

  function addStatusDraft() {
    setIsStatusesDirty(true);
    const nextIndex = statusDrafts.length;
    const label = `Estado ${nextIndex + 1}`;
    const key = buildUniqueStatusKey(label, statusDrafts);
    const color = STATUS_COLOR_PRESETS[nextIndex % STATUS_COLOR_PRESETS.length];

    setStatusDrafts((currentDrafts) => [
      ...currentDrafts,
      {
        key,
        label,
        color,
        order: currentDrafts.length,
        active: true,
      },
    ]);
  }

  function deleteStatusDraft(targetKey: string) {
    if (statusDrafts.length <= 1) {
      setNotice({
        type: 'error',
        message: 'Debes dejar al menos un estado disponible.',
      });
      return;
    }

    setIsStatusesDirty(true);
    setStatusDrafts((currentDrafts) =>
      currentDrafts
        .filter((status) => status.key !== targetKey)
        .map((status, index) => ({ ...status, order: index })),
    );
  }

  async function handleSaveStatuses() {
    if (!token) {
      return;
    }

    setIsSavingStatuses(true);
    setNotice(null);

    try {
      await saveStatuses(
        token,
        statusDrafts.map((status, index) => ({
          ...status,
          order: index,
          active: true,
        })),
      );

      setIsStatusesDirty(false);
      await refreshDashboard(token, selectedRecord);
      setNotice({
        type: 'success',
        message:
          'Estados guardados. Los nombres, colores y cambios en registros quedaron sincronizados.',
      });
    } catch (error) {
      const parsedError = parseAdminError(error);
      setNotice({
        type: 'error',
        message: parsedError.message,
        details: parsedError.details,
      });
    } finally {
      setIsSavingStatuses(false);
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
      setAccountForm((currentForm) => ({
        ...currentForm,
        username: response.profile.username,
        displayName: response.profile.displayName,
        email: response.profile.email,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      }));
      setNotice({
        type: 'success',
        message: 'Cuenta admin actualizada correctamente.',
      });
    } catch (error) {
      const parsedError = parseAdminError(error);
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
    return (
      <LoadingFrame message="Preparando el panel admin y la conexion con Google Sheets..." />
    );
  }

  if (!publicConfig?.ready) {
    return (
      <PageShell>
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <HeroCard
            title="Panel Admin de Encuestas"
            eyebrow="Configuracion inicial"
            description="El panel separado ya esta listo. Solo falta conectarlo con tu Google Sheets usando un service account para que puedas leer, editar y borrar registros desde otra URL."
          />

          <PanelCard className="border-amber-400/25 bg-[linear-gradient(135deg,rgba(120,53,15,0.35)_0%,rgba(113,63,18,0.28)_100%)] text-white">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-amber-700" />
              <div>
                <h2 className="text-2xl font-semibold">Faltan pasos de conexion</h2>
                <p className="mt-2 text-sm leading-6 text-amber-50/90">
                  El servidor local detecto que todavia no tiene permisos para entrar a la hoja.
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

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <InfoMiniCard
                label="Hoja principal"
                value={publicConfig.responsesSheetName}
                caption={publicConfig.spreadsheetId}
              />
              <InfoMiniCard
                label="Archivo esperado"
                value={publicConfig.serviceAccountFile}
                caption="Pegas ahi tu JSON del service account"
              />
            </div>

            <p className="mt-6 text-sm leading-6 text-amber-50/90">
              Cuando termines la configuracion, enciende el servidor admin otra vez y entra a
              `admin.html`.
            </p>
          </PanelCard>
        </div>
      </PageShell>
    );
  }

  if (!token || !profile) {
    return (
      <PageShell>
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <HeroCard
            title="Panel privado de seguimiento"
            eyebrow="La Barca Admin"
            description="Aqui vas a poder ver las encuestas, organizarlas por estado, editar datos, borrar registros y dejar todo sincronizado con Google Sheets desde una URL separada del sitio publico."
          />

          <PanelCard className="text-white">
            <div className="flex items-center gap-4">
              <img src={BARCA_LOGO_URL} alt="Logo La Barca" className="h-16 w-auto object-contain" />
              <div>
                <p className={eyebrowClassName}>
                  Acceso privado
                </p>
                <h2 className="text-3xl font-semibold text-white">Iniciar sesion</h2>
              </div>
            </div>

            <form className="mt-8 space-y-5" onSubmit={handleLoginSubmit}>
              <div>
                <FieldLabel htmlFor="admin-username">Usuario</FieldLabel>
                <input
                  id="admin-username"
                  value={loginUsername}
                  onChange={(event) => setLoginUsername(event.target.value)}
                  className={inputClassName}
                  autoComplete="username"
                />
              </div>

              <div>
                <FieldLabel htmlFor="admin-password">Contrasena</FieldLabel>
                <input
                  id="admin-password"
                  type="password"
                  value={loginPassword}
                  onChange={(event) => setLoginPassword(event.target.value)}
                  className={inputClassName}
                  autoComplete="current-password"
                />
              </div>

              <button
                type="submit"
                disabled={isLoggingIn}
                className={`${primaryButtonClassName} w-full`}
              >
                {isLoggingIn ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <KeyRound className="h-5 w-5" />}
                <span>{isLoggingIn ? 'Entrando...' : 'Entrar al dashboard'}</span>
              </button>
            </form>
{/* 
            <div className="mt-8 rounded-[24px] border border-white/10 bg-black/10 p-5 text-sm leading-6 text-gray-200 shadow-sm">
              <p className="font-semibold text-white">Primer acceso automatico</p>
              <p className="mt-2">
                Usuario inicial: <span className="font-semibold">admin</span> o
                <span className="font-semibold"> administrador</span>
              </p>
              <p>
                Contrasena inicial: <span className="font-semibold">1234</span>
              </p>
              <p className="mt-3">
                Apenas entres, en la pestana de cuenta puedes cambiar el nombre de acceso, el
                nombre visible y la contrasena.
              </p>
            </div> */}
          </PanelCard>
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
            <img
              src={CHURCH_LOGO_URL}
              alt="Logo El Shaddai"
              className="h-10 w-auto object-contain opacity-80"
            />
            <div>
              <p className={eyebrowClassName}>
                Dashboard privado
              </p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight text-white">
                Seguimiento de Encuestas
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-200">
                Todo queda sincronizado con tu hoja principal. Si esta pagina se cae, la
                informacion sigue viva en Google Sheets.
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

            <button type="button" onClick={() => void handleLogout()} className={secondaryButtonClassName}>
              <LogOut className="h-4 w-4" />
              <span>Salir</span>
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <StatCard label="Total encuestas" value={String(totalRecords)} detail="Hoja principal sincronizada" />
          <StatCard label={`En ${defaultStatusLabel}`} value={String(defaultStatusCount)} detail="Primer estado activo" />
          <StatCard
            label="Administrador activo"
            value={profile.displayName || profile.username}
            detail={profile.username}
          />
        </div>
      </header>

      <NoticeBanner notice={notice} />

      <div className="mt-6 flex flex-wrap gap-3">
        <TabButton
          icon={LayoutDashboard}
          isActive={activeTab === 'records'}
          label="Encuestas"
          onClick={() => setActiveTab('records')}
        />
        <TabButton
          icon={BadgeCheck}
          isActive={activeTab === 'statuses'}
          label="Estados"
          onClick={() => setActiveTab('statuses')}
        />
        <TabButton
          icon={Settings2}
          isActive={activeTab === 'account'}
          label="Cuenta"
          onClick={() => setActiveTab('account')}
        />
      </div>

      {activeTab === 'records' && (
        <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <PanelCard className="text-white">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">
                  Base principal
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Encuestas guardadas</h2>
                <p className="mt-2 text-sm leading-6 text-gray-200">
                  Cualquier cambio que hagas aqui se refleja tambien en Google Sheets.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="relative min-w-[240px] flex-1">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
                  <input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Buscar por nombre, telefono, correo..."
                    className={`${inputClassName} pl-11`}
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className={`${inputClassName} min-w-[180px]`}
                >
                  <option value="all">Todos los estados</option>
                  {statuses.map((status) => (
                    <option key={status.key} value={status.label}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-6 overflow-hidden rounded-[24px] border border-white/10 bg-slate-900/20 shadow-sm">
              <div className="max-h-[640px] overflow-auto">
                <table className="min-w-full divide-y divide-white/10">
                  <thead className="sticky top-0 bg-slate-900/70 text-left text-xs uppercase tracking-[0.22em] text-cyan-300 backdrop-blur-sm">
                    <tr>
                      <th className="px-4 py-4 font-medium">Nombre</th>
                      <th className="px-4 py-4 font-medium">Estado</th>
                      <th className="px-4 py-4 font-medium">Telefono</th>
                      <th className="px-4 py-4 font-medium">Fecha</th>
                      <th className="px-4 py-4 font-medium">Origen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10 bg-transparent text-sm text-gray-200">
                    {filteredRecords.map((record) => {
                      const status = statuses.find((item) => item.label === record.status);
                      const isSelected = selectedRecord === record.sheetRow;
                      return (
                        <tr
                          key={record.sheetRow}
                          className={`cursor-pointer transition-colors ${
                            isSelected ? 'bg-white/10' : 'hover:bg-white/5'
                          }`}
                          onClick={() => openExistingRecord(record)}
                        >
                          <td className="px-4 py-4 align-top">
                            <div className="font-semibold text-white">
                              {record.firstName} {record.lastName}
                            </div>
                            <div className="mt-1 text-xs text-gray-300">{record.email || 'Sin correo'}</div>
                          </td>
                          <td className="px-4 py-4 align-top">
                            <StatusPill label={record.status} color={status?.color || '#06b6d4'} />
                          </td>
                          <td className="px-4 py-4 align-top">{record.phone || '-'}</td>
                          <td className="px-4 py-4 align-top">{record.submittedAt || '-'}</td>
                          <td className="px-4 py-4 align-top">{record.source || '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {filteredRecords.length === 0 && (
                <EmptyState
                  title="No hay resultados"
                  description="Ajusta el filtro o crea una encuesta nueva desde este mismo panel."
                />
              )}
            </div>
          </PanelCard>

          <PanelCard className="text-white">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">
                  Editor
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-white">
                  {selectedRecord === 'new' ? 'Nueva encuesta' : 'Detalle del registro'}
                </h2>
              </div>

              {recordDraft && (
                <StatusPill label={recordDraft.status || defaultStatusLabel} color={selectedStatusColor} />
              )}
            </div>

            {recordDraft ? (
              <>
                <div className="mt-6 grid gap-5 md:grid-cols-2">
                  <FormField
                    label="Nombre"
                    value={recordDraft.firstName}
                    onChange={(value) => updateRecordField('firstName', value)}
                  />
                  <FormField
                    label="Apellidos"
                    value={recordDraft.lastName}
                    onChange={(value) => updateRecordField('lastName', value)}
                  />
                  <FormField
                    label="Telefono"
                    value={recordDraft.phone}
                    onChange={(value) => updateRecordField('phone', value)}
                  />
                  <FormField
                    label="Correo"
                    value={recordDraft.email}
                    onChange={(value) => updateRecordField('email', value)}
                    type="email"
                  />
                  <FormField
                    label="Origen"
                    value={recordDraft.source}
                    onChange={(value) => updateRecordField('source', value)}
                  />
                  <div>
                    <FieldLabel htmlFor="record-date">Fecha y hora</FieldLabel>
                    <input
                      id="record-date"
                      type="datetime-local"
                      value={toDatetimeLocalValue(recordDraft.submittedAt)}
                      onChange={(event) =>
                        updateRecordField('submittedAt', fromDatetimeLocalValue(event.target.value))
                      }
                      className={inputClassName}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <FieldLabel htmlFor="record-status">Estado</FieldLabel>
                    <select
                      id="record-status"
                      value={recordDraft.status}
                      onChange={(event) => updateRecordField('status', event.target.value)}
                      className={inputClassName}
                    >
                      {statuses.map((status) => (
                        <option key={status.key} value={status.label}>
                          {status.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <FieldLabel htmlFor="record-prayer">Peticion de oracion</FieldLabel>
                    <textarea
                      id="record-prayer"
                      value={recordDraft.prayerRequest}
                      onChange={(event) => updateRecordField('prayerRequest', event.target.value)}
                      rows={6}
                      className={`${inputClassName} resize-y`}
                    />
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
                      className="inline-flex items-center gap-2 rounded-2xl border border-rose-400/25 bg-rose-500/12 px-4 py-3 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-70"
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
          </PanelCard>
        </div>
      )}

      {activeTab === 'statuses' && (
        <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_0.8fr]">
          <PanelCard className="text-white">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">
                  Estados editables
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Configurar estados</h2>
                <p className="mt-2 text-sm leading-6 text-gray-200">
                  Aqui puedes cambiar el nombre, color, orden y cantidad de estados sin tocar el
                  codigo otra vez.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={addStatusDraft} className={secondaryButtonClassName}>
                  <CirclePlus className="h-4 w-4" />
                  <span>Anadir estado</span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveStatuses()}
                  disabled={isSavingStatuses}
                  className={primaryButtonClassName}
                >
                  {isSavingStatuses ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  <span>{isSavingStatuses ? 'Guardando...' : 'Guardar estados'}</span>
                </button>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              {statusDrafts.map((status, index) => (
                <div
                  key={status.key}
                  className="grid gap-4 rounded-[24px] border border-white/10 bg-slate-900/20 p-4 shadow-sm lg:grid-cols-[auto_1fr_auto]"
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={status.color}
                      onChange={(event) => updateStatusDraft(status.key, { color: event.target.value })}
                      className="h-12 w-14 cursor-pointer rounded-xl border border-slate-300 bg-white p-1"
                    />
                    <StatusPill label={`#${index + 1}`} color={status.color} />
                  </div>

                  <div className="space-y-2">
                    <FieldLabel htmlFor={`status-label-${status.key}`}>Nombre del estado</FieldLabel>
                    <input
                      id={`status-label-${status.key}`}
                      value={status.label}
                      onChange={(event) => updateStatusDraft(status.key, { label: event.target.value })}
                      className={inputClassName}
                    />
                    <p className="text-xs text-gray-300">Llave interna: {status.key}</p>
                  </div>

                  <div className="flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => deleteStatusDraft(status.key)}
                      className={secondaryButtonClassName}
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>Eliminar</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </PanelCard>

          <PanelCard className="text-white">
            <div className="flex items-start gap-3">
              <PencilLine className="mt-1 h-5 w-5 text-cyan-300" />
              <div>
                <h3 className="text-xl font-semibold text-white">Como editarlos facil</h3>
                <p className="mt-2 text-sm leading-6 text-gray-200">
                  Todo queda guardado en la misma hoja de Google Sheets, dentro de la pestana
                  `Admin Estados`.
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-4 text-sm leading-6 text-gray-200">
              <InfoBlock
                title="Cambiar nombres"
                body="Solo editas el texto del estado y guardas. El panel actualiza tambien los registros que ya tenian ese estado."
              />
              <InfoBlock
                title="Cambiar colores"
                body="Seleccionas un color nuevo con el picker. Ese color se usa en las etiquetas del dashboard."
              />
              <InfoBlock
                title="Agregar estados"
                body="Pulsa Anadir estado y el sistema crea una nueva opcion con su llave interna."
              />
              <InfoBlock
                title="Eliminar estados"
                body="Si borras uno, los registros que lo usaban pasan automaticamente al primer estado activo."
              />
            </div>
          </PanelCard>
        </div>
      )}

      {activeTab === 'account' && (
        <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_0.82fr]">
          <PanelCard className="text-white">
            <div className="flex items-start gap-3">
              <UserRound className="mt-1 h-5 w-5 text-cyan-300" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">
                  Cuenta principal
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Datos del administrador</h2>
                <p className="mt-2 text-sm leading-6 text-gray-200">
                  Desde aqui puedes cambiar el usuario de acceso, el nombre visible y la
                  contrasena del panel.
                </p>
              </div>
            </div>

            <form className="mt-6 space-y-6" onSubmit={handleSaveAccount}>
              <div className="grid gap-5 md:grid-cols-2">
                <FormField
                  label="Usuario de acceso"
                  value={accountForm.username}
                  onChange={(value) => {
                    setIsAccountDirty(true);
                    setAccountForm((currentForm) => ({ ...currentForm, username: value }));
                  }}
                />
                <FormField
                  label="Nombre visible"
                  value={accountForm.displayName}
                  onChange={(value) => {
                    setIsAccountDirty(true);
                    setAccountForm((currentForm) => ({ ...currentForm, displayName: value }));
                  }}
                />
                <FormField
                  label="Correo (opcional)"
                  value={accountForm.email}
                  onChange={(value) => {
                    setIsAccountDirty(true);
                    setAccountForm((currentForm) => ({ ...currentForm, email: value }));
                  }}
                  type="email"
                />
              </div>

              <div className="rounded-[24px] border border-white/10 bg-slate-900/20 p-5 shadow-sm">
                <h3 className="text-lg font-semibold text-white">Cambiar contrasena</h3>
                <div className="mt-4 grid gap-5 md:grid-cols-3">
                  <div>
                    <FieldLabel htmlFor="current-password">Contrasena actual</FieldLabel>
                    <input
                      id="current-password"
                      type="password"
                      value={accountForm.currentPassword}
                      onChange={(event) => {
                        setIsAccountDirty(true);
                        setAccountForm((currentForm) => ({
                          ...currentForm,
                          currentPassword: event.target.value,
                        }));
                      }}
                      className={inputClassName}
                    />
                  </div>
                  <div>
                    <FieldLabel htmlFor="new-password">Nueva contrasena</FieldLabel>
                    <input
                      id="new-password"
                      type="password"
                      value={accountForm.newPassword}
                      onChange={(event) => {
                        setIsAccountDirty(true);
                        setAccountForm((currentForm) => ({
                          ...currentForm,
                          newPassword: event.target.value,
                        }));
                      }}
                      className={inputClassName}
                    />
                  </div>
                  <div>
                    <FieldLabel htmlFor="confirm-password">Confirmar contrasena</FieldLabel>
                    <input
                      id="confirm-password"
                      type="password"
                      value={accountForm.confirmPassword}
                      onChange={(event) => {
                        setIsAccountDirty(true);
                        setAccountForm((currentForm) => ({
                          ...currentForm,
                          confirmPassword: event.target.value,
                        }));
                      }}
                      className={inputClassName}
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSavingAccount}
                className={primaryButtonClassName}
              >
                {isSavingAccount ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                <span>{isSavingAccount ? 'Guardando...' : 'Guardar cuenta'}</span>
              </button>
            </form>
          </PanelCard>

          <PanelCard className="text-white">
            <div className="flex items-start gap-3">
              <Mail className="mt-1 h-5 w-5 text-cyan-300" />
              <div>
                <h3 className="text-xl font-semibold text-white">Notas utiles</h3>
                <p className="mt-2 text-sm leading-6 text-gray-200">
                  Esta cuenta vive dentro de la misma estructura del panel y se respalda junto a la
                  configuracion en Google Sheets.
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-4 text-sm leading-6 text-gray-200">
              <InfoBlock
                title="Usuario inicial"
                body="El primer acceso viene con admin / 1234 y un alias administrador para que no te bloquee el arranque."
              />
              <InfoBlock
                title="Cambio de nombre"
                body="Si cambias el usuario de acceso, el siguiente login ya se hace con el nuevo nombre."
              />
              <InfoBlock
                title="Correo opcional"
                body="Lo puedes dejar vacio si solo quieres un usuario local sencillo."
              />
            </div>
          </PanelCard>
        </div>
      )}
    </PageShell>
  );
}

function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-800 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.12),rgba(34,211,238,0)_32%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-[156px] h-16 text-cyan-500/20">
        <svg viewBox="0 0 1440 120" className="h-full w-full" preserveAspectRatio="none">
          <path
            d="M0,64 C140,28 280,28 420,64 C560,100 700,100 840,64 C980,28 1120,28 1260,64 C1340,84 1400,86 1440,80 L1440,120 L0,120 Z"
            fill="currentColor"
          />
        </svg>
      </div>

      <main className="relative mx-auto flex min-h-screen w-full max-w-[1440px] flex-col px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}

function HeroCard({
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
          <HeartHandshake className="h-4 w-4" />
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

function LoadingFrame({ message }: { message: string }) {
  return (
    <PageShell>
      <div className="flex min-h-[70vh] items-center justify-center">
        <PanelCard className="max-w-xl text-white">
          <div className="flex items-center gap-4">
            <LoaderCircle className="h-7 w-7 animate-spin text-cyan-600" />
            <div>
              <h1 className="text-2xl font-semibold text-white">Cargando panel admin</h1>
              <p className="mt-2 text-sm text-gray-200">{message}</p>
            </div>
          </div>
        </PanelCard>
      </div>
    </PageShell>
  );
}

function PanelCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={`rounded-[32px] border border-white/10 bg-gradient-to-br from-gray-700 to-gray-600 p-6 shadow-xl sm:p-8 ${className}`}
    >
      {children}
    </section>
  );
}

function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
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

function FormField({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: HTMLInputTypeAttribute;
}) {
  const htmlId = `field-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

  return (
    <div>
      <FieldLabel htmlFor={htmlId}>{label}</FieldLabel>
      <input
        id={htmlId}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={inputClassName}
      />
    </div>
  );
}

function FieldLabel({
  children,
  htmlFor,
}: {
  children: ReactNode;
  htmlFor: string;
}) {
  return (
    <label htmlFor={htmlFor} className="mb-2 block text-base font-semibold text-white">
      {children}
    </label>
  );
}

function StatusPill({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em]"
      style={{
        borderColor: `${color}33`,
        backgroundColor: `${color}1a`,
        color,
      }}
    >
      <span
        className="h-2.5 w-2.5 rounded-full"
        style={{
          backgroundColor: color,
        }}
      />
      <span>{label}</span>
    </span>
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

function InfoMiniCard({
  label,
  value,
  caption,
}: {
  label: string;
  value: string;
  caption: string;
}) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-slate-900/20 p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">{label}</p>
      <p className="mt-3 break-all text-base font-semibold text-white">{value}</p>
      <p className="mt-2 text-xs text-gray-200">{caption}</p>
    </div>
  );
}

function InfoBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-slate-900/20 p-4 shadow-sm">
      <p className="font-semibold text-white">{title}</p>
      <p className="mt-2 text-sm leading-6 text-gray-200">{body}</p>
    </div>
  );
}

function createEmptyRecord(defaultStatus: string): SurveyRecord {
  return {
    sheetRow: 0,
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    prayerRequest: '',
    source: 'panel-admin',
    submittedAt: formatCurrentDateTime(),
    status: defaultStatus || 'Nuevo',
  };
}

function buildUniqueStatusKey(label: string, currentStatuses: StatusOption[]) {
  const currentKeys = new Set(currentStatuses.map((status) => status.key));
  const baseKey = slugify(label) || 'estado';
  let nextKey = baseKey;
  let counter = 2;

  while (currentKeys.has(nextKey)) {
    nextKey = `${baseKey}-${counter}`;
    counter += 1;
  }

  return nextKey;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseAdminError(error: unknown) {
  if (error instanceof AdminApiError) {
    return error;
  }

  return new AdminApiError('Ocurrio un error inesperado en el panel admin.');
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

const inputClassName =
  'w-full rounded-2xl border border-slate-500/60 bg-slate-900/70 px-4 py-3 text-base text-slate-100 shadow-sm outline-none transition focus:border-cyan-300 focus:ring-4 focus:ring-cyan-500/20';

const eyebrowClassName =
  'inline-flex items-center gap-2 rounded-full bg-slate-900/30 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300 shadow-sm';

const primaryButtonClassName =
  'inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-500 px-6 py-4 text-base font-semibold text-white shadow-lg transition-all hover:scale-[1.02] hover:from-cyan-600 hover:to-blue-600 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:scale-100';

const secondaryButtonClassName =
  'inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/20 px-4 py-3 text-sm font-semibold text-gray-100 shadow-sm transition hover:bg-slate-900/35 disabled:cursor-not-allowed disabled:opacity-70';

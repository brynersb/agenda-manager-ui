import { useQueryClient } from '@tanstack/react-query';
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { UNSAFE_DataRouterContext, useBlocker } from 'react-router';

import { useAuthContext } from '@/auth/use-auth';
import { Button } from '@/components/ui/button';
import type { CreatableOption } from '@/components/ui/creatable-combobox';
import { FormSurface } from '@/components/ui/form-surface';
import { LeaveConfirmModal } from '@/components/ui/leave-confirm-modal';
import { Modal } from '@/components/ui/modal';
import { Spinner } from '@/components/ui/spinner';
import type { ToastVariant } from '@/components/ui/toast';
import {
  useContentBrief,
  useCreateContentBrief,
  useDeleteContentBrief,
  useUpdateContentBrief,
} from '@/hooks/use-content-briefs';
import { useCreateRegistry, useRegistries } from '@/hooks/use-registries';
import { getApiErrorMessage, getErrorStatus, isCode } from '@/lib/api-error';
import type {
  ContentBriefLink,
  ContentBriefResponse,
} from '@/types/content-brief';
import type { Registry, RegistryKind } from '@/types/registry';
import { ContentBriefForm } from './content-brief-form';
import {
  buildBody,
  type ContentBriefErrors,
  type ContentBriefValues,
  EMPTY_VALUES,
  errorsFromApi,
  isChanged,
  validate,
  valuesOf,
} from './content-brief-values';
import { DeleteButton } from './delete-button';

/** Toast quando a pauta aberta foi excluída por outra pessoa. */
export const BRIEF_NOT_FOUND_MESSAGE = 'Esta pauta não existe mais.';

/** Aviso do `409` de versão, no topo do painel (ADR-006). */
export const CONFLICT_MESSAGE = 'Esta pauta foi alterada por outra pessoa.';

const FORM_ID = 'content-brief-form';

interface ContentBriefEditorDrawerProps {
  /** Id da pauta a editar, ou `null` para criar uma nova. */
  briefId: string | null;
  /** Fecha o painel (a página remove `?brief`/`?new` da URL). */
  onClose: () => void;
  /** Avisos de sucesso e de erro que sobrevivem ao fechamento do painel. */
  onToast: (variant: ToastVariant, title: string) => void;
}

/** Foto do formulário: o que foi carregado e o que a pessoa fez com isso. */
interface FormState {
  /** Pauta carregada; `null` na pauta nova. Traz a `version` do `PUT`. */
  origin: ContentBriefResponse | null;
  base: ContentBriefValues;
  values: ContentBriefValues;
}

interface PendingExit {
  proceed: () => void;
  cancel?: () => void;
}

function stateOf(origin: ContentBriefResponse | null): FormState {
  const base = origin ? valuesOf(origin) : EMPTY_VALUES;
  return { origin, base, values: base };
}

/**
 * Lista do seletor: os cadastros da API mais o que a tela já sabe e a API
 * ainda não devolveu (o cadastro criado agora, ou o vínculo da pauta quando a
 * pessoa não tem `registry:read`). Sem isso o valor atual ficaria sem rótulo.
 */
function mergeOptions(
  registries: Registry[] | undefined,
  known: (CreatableOption | ContentBriefLink | null | undefined)[],
): CreatableOption[] {
  const byId = new Map<string, CreatableOption>();
  for (const r of registries ?? []) byId.set(r.id, r);
  for (const r of known) {
    if (r && !byId.has(r.id)) byId.set(r.id, r);
  }
  return [...byId.values()];
}

interface NavigationBlockerProps {
  active: boolean;
  /** Vira `true` quando a saída já foi decidida (salvou ou descartou). */
  released: { current: boolean };
  onBlock: (exit: PendingExit) => void;
}

/**
 * Intercepta a navegação do roteador (botão "voltar", link) enquanto há
 * alteração não salva e entrega a decisão a quem monta o aviso.
 *
 * Só existe num roteador de dados (`createBrowserRouter`); por isso é um
 * componente à parte, montado apenas quando o contexto existe.
 */
function NavigationBlocker({
  active,
  released,
  onBlock,
}: NavigationBlockerProps) {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      active &&
      !released.current &&
      (currentLocation.pathname !== nextLocation.pathname ||
        currentLocation.search !== nextLocation.search),
  );
  const blockerRef = useRef(blocker);
  blockerRef.current = blocker;
  const blocked = blocker.state === 'blocked';

  useEffect(() => {
    if (!blocked) return;
    onBlock({
      proceed: () => {
        released.current = true;
        blockerRef.current.proceed?.();
      },
      cancel: () => blockerRef.current.reset?.(),
    });
  }, [blocked, onBlock, released]);

  return null;
}

/**
 * Formulário de criar e editar pauta (o `dlg` do protótipo). Aparece em modal
 * ou em painel lateral, conforme a preferência da pessoa (`FormSurface`); o
 * nome do arquivo segue o ADR-015.
 *
 * Abre pela URL (`?new=1`, `?brief=<id>`): quem monta este componente decide
 * quando, e o desmonta ao fechar, o que zera o formulário e o botão de
 * excluir. Ao abrir uma pauta existente tira uma foto dela
 * (`GET content-briefs/:id`); o formulário não acompanha mudanças posteriores
 * do servidor, para a `version` que vai no `PUT` ser a da pauta que a pessoa
 * viu.
 *
 * Regras: título obrigatório; `PUT` com todos os campos; `409` de versão
 * mantém o texto digitado e oferece recarregar (ADR-006); fechar com
 * alteração pede confirmação, inclusive ao navegar; sem `content-brief:write`
 * tudo é somente leitura.
 *
 * @param props.briefId Pauta a editar, ou `null` para nova.
 * @param props.onClose Fecha o painel.
 * @param props.onToast Exibe um toast na tela principal.
 * @returns O painel.
 */
export function ContentBriefEditorDrawer({
  briefId,
  onClose,
  onToast,
}: ContentBriefEditorDrawerProps) {
  const isNew = briefId === null;
  const { hasPermission } = useAuthContext();
  const canWrite = hasPermission('content-brief:write');
  const canDelete = hasPermission('content-brief:delete');
  const canReadRegistries = hasPermission('registry:read');
  const canCreateRegistry = hasPermission('registry:write');
  const readOnly = !canWrite;

  const queryClient = useQueryClient();
  const detail = useContentBrief(briefId);
  const create = useCreateContentBrief();
  const update = useUpdateContentBrief();
  const remove = useDeleteContentBrief();
  const createEstateDevelopment = useCreateRegistry('estate-developments');
  const createOwner = useCreateRegistry('owners');
  const estateDevelopmentsQuery = useRegistries('estate-developments', {
    includeArchived: true,
    enabled: canReadRegistries,
  });
  const ownersQuery = useRegistries('owners', {
    includeArchived: true,
    enabled: canReadRegistries,
  });

  const [form, setForm] = useState<FormState | null>(
    isNew ? stateOf(null) : null,
  );
  if (form === null && detail.data) setForm(stateOf(detail.data));

  const [errors, setErrors] = useState<ContentBriefErrors>({});
  const [conflict, setConflict] = useState(false);
  const [created, setCreated] = useState<
    Record<RegistryKind, CreatableOption[]>
  >({
    'estate-developments': [],
    owners: [],
  });
  const [pendingExit, setPendingExit] = useState<PendingExit | null>(null);
  const [confirmingReload, setConfirmingReload] = useState(false);

  const titleRef = useRef<HTMLInputElement>(null);
  const submitting = useRef(false);
  const exitReleased = useRef(false);
  const notifiedMissing = useRef(false);

  const dirty = form !== null && !readOnly && isChanged(form.values, form.base);
  const saving = create.isPending || update.isPending;

  const finish = useCallback(() => {
    exitReleased.current = true;
    onClose();
  }, [onClose]);

  const briefMissing = useCallback(() => {
    if (notifiedMissing.current) return;
    notifiedMissing.current = true;
    onToast('error', BRIEF_NOT_FOUND_MESSAGE);
    void queryClient.invalidateQueries({ queryKey: ['content-briefs'] });
    finish();
  }, [onToast, queryClient, finish]);

  useEffect(() => {
    if (!isNew && getErrorStatus(detail.error) === 404) briefMissing();
  }, [isNew, detail.error, briefMissing]);

  // Perder a aba ou recarregar com texto por salvar também merece o aviso.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const inDataRouter = useContext(UNSAFE_DataRouterContext) !== null;

  const estateDevelopments = useMemo(
    () =>
      mergeOptions(estateDevelopmentsQuery.data, [
        ...created['estate-developments'],
        form?.origin?.estateDevelopment,
      ]),
    [estateDevelopmentsQuery.data, created, form?.origin],
  );
  const owners = useMemo(
    () =>
      mergeOptions(ownersQuery.data, [...created.owners, form?.origin?.owner]),
    [ownersQuery.data, created, form?.origin],
  );

  function change(partial: Partial<ContentBriefValues>) {
    setForm((current) =>
      current
        ? { ...current, values: { ...current.values, ...partial } }
        : current,
    );
    setErrors((currentErrors) => {
      const next = { ...currentErrors };
      for (const field of Object.keys(partial)) {
        delete next[field as keyof ContentBriefErrors];
      }
      return next;
    });
  }

  /**
   * Cria o cadastro na hora, antes de a pauta ser salva. Se salvar a pauta
   * falhar depois, o cadastro fica criado: é aceito (o protótipo fazia igual).
   */
  async function createRegistry(kind: RegistryKind, name: string) {
    const mutation =
      kind === 'estate-developments' ? createEstateDevelopment : createOwner;
    const registry = await mutation.mutateAsync(name);
    setCreated((current) => ({
      ...current,
      [kind]: [
        ...current[kind],
        { id: registry.id, name: registry.name, active: true },
      ],
    }));
    return { id: registry.id, name: registry.name };
  }

  function handleSaveError(error: unknown) {
    if (isCode(error, 'CONTENT_BRIEF_VERSION_OUTDATED')) {
      setConflict(true);
      return;
    }
    if (isCode(error, 'CONTENT_BRIEF_NOT_FOUND')) {
      briefMissing();
      return;
    }
    const fromServer = errorsFromApi(error);
    setErrors(fromServer);
    if (fromServer.title) titleRef.current?.focus();
  }

  async function submit() {
    if (!form || readOnly || submitting.current) return;

    const invalid = validate(form.values);
    if (Object.keys(invalid).length > 0) {
      setErrors(invalid);
      titleRef.current?.focus();
      return;
    }

    submitting.current = true;
    setErrors({});
    try {
      const body = buildBody(form.values);
      if (form.origin) {
        await update.mutateAsync({
          id: form.origin.id,
          body,
          version: form.origin.version,
        });
      } else {
        await create.mutateAsync(body);
      }
      onToast('success', 'Pauta salva');
      finish();
    } catch (error) {
      handleSaveError(error);
    } finally {
      submitting.current = false;
    }
  }

  async function deleteBrief() {
    if (!form?.origin || remove.isPending) return;
    try {
      await remove.mutateAsync(form.origin.id);
      onToast('success', 'Pauta excluída');
      finish();
    } catch (error) {
      if (isCode(error, 'CONTENT_BRIEF_NOT_FOUND')) briefMissing();
      else setErrors({ general: getApiErrorMessage(error) });
    }
  }

  async function reload() {
    setConfirmingReload(false);
    const result = await detail.refetch();
    if (result.isError) {
      if (getErrorStatus(result.error) === 404) briefMissing();
      else setErrors({ general: getApiErrorMessage(result.error) });
      return;
    }
    if (result.data) {
      setForm(stateOf(result.data));
      setErrors({});
      setConflict(false);
    }
  }

  function requestReload() {
    if (dirty) setConfirmingReload(true);
    else void reload();
  }

  function tryClose() {
    if (dirty && !exitReleased.current) setPendingExit({ proceed: finish });
    else finish();
  }

  function confirmExit() {
    const exit = pendingExit;
    setPendingExit(null);
    exit?.proceed();
  }

  function keepEditing() {
    pendingExit?.cancel?.();
    setPendingExit(null);
  }

  const loading = !isNew && form === null && !detail.isError;
  const loadFailed =
    !isNew &&
    form === null &&
    detail.isError &&
    getErrorStatus(detail.error) !== 404;

  const title = isNew ? 'Nova pauta' : readOnly ? 'Pauta' : 'Editar pauta';

  function footer() {
    if (form === null || readOnly) {
      return (
        <>
          <span className="flex-1" />
          <Button variant="secondary" onClick={tryClose}>
            Fechar
          </Button>
        </>
      );
    }
    return (
      <>
        {!isNew && canDelete && (
          <DeleteButton
            onDelete={() => void deleteBrief()}
            deleting={remove.isPending}
          />
        )}
        <span className="flex-1" />
        <Button variant="secondary" onClick={tryClose}>
          Cancelar
        </Button>
        <Button type="submit" form={FORM_ID} loading={saving}>
          Salvar
        </Button>
      </>
    );
  }

  return (
    <>
      <FormSurface
        open
        onOpenChange={(open) => {
          if (!open) tryClose();
        }}
        title={title}
        footer={footer()}
      >
        {conflict && (
          <div
            role="alert"
            className="mb-4 flex flex-col gap-2.5 rounded-lg border border-late bg-late-bg p-3 text-late text-sm"
          >
            <p className="m-0 font-semibold">{CONFLICT_MESSAGE}</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={requestReload}>
                Ver versão atual
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConflict(false)}
              >
                Continuar editando
              </Button>
            </div>
          </div>
        )}
        {errors.general && (
          <p
            role="alert"
            className="m-0 mb-4 rounded-lg border border-late bg-late-bg p-3 text-late text-sm"
          >
            {errors.general}
          </p>
        )}
        {loading && (
          <p role="status" className="flex items-center gap-2 text-muted">
            <Spinner label="Carregando" /> Carregando pauta…
          </p>
        )}
        {loadFailed && (
          <div role="alert" className="flex flex-col items-start gap-3">
            <p className="m-0 text-late text-sm">
              {getApiErrorMessage(detail.error)}
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void detail.refetch()}
            >
              Tentar de novo
            </Button>
          </div>
        )}
        {form && (
          <ContentBriefForm
            id={FORM_ID}
            values={form.values}
            onChange={change}
            errors={errors}
            readOnly={readOnly}
            estateDevelopments={estateDevelopments}
            owners={owners}
            canCreateRegistry={canCreateRegistry}
            onCreateRegistry={createRegistry}
            onSubmit={() => void submit()}
            titleRef={titleRef}
            focusTitle={isNew}
          />
        )}
      </FormSurface>

      {inDataRouter && (
        <NavigationBlocker
          active={dirty}
          released={exitReleased}
          onBlock={setPendingExit}
        />
      )}

      <LeaveConfirmModal
        open={pendingExit !== null}
        onOpenChange={(open) => {
          if (!open) keepEditing();
        }}
        onLeave={confirmExit}
      />

      <Modal
        open={confirmingReload}
        onOpenChange={setConfirmingReload}
        title="Ver a versão atual?"
        description="O que você digitou nesta pauta será descartado e o formulário mostrará a versão salva por outra pessoa."
        footer={
          <>
            <Button variant="secondary" onClick={() => void reload()}>
              Descartar e ver versão atual
            </Button>
            <Button onClick={() => setConfirmingReload(false)}>
              Continuar editando
            </Button>
          </>
        }
      />
    </>
  );
}
